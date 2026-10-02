
const express = require("express");
const Database = require("better-sqlite3");
const OpenAI = require("openai");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// Render utilise un proxy
app.set("trust proxy", 1);

// =========================
// BASE DE DONNÉES
// =========================

const db = new Database(process.env.DB_PATH || "alph-ai.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  message TEXT NOT NULL,
  reply TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// =========================
// CONFIGURATION
// =========================

const allowedOrigins = new Set([
  "https://alph-ai-moteur.onrender.com",
  "https://bsslg.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
    : [])
]);

// =========================
// CORS
// =========================

app.use(
  cors({
    origin(origin, callback) {
      // Autorise les requêtes sans Origin
      // et les navigateurs utilisant le même serveur.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin non autorisée"));
    },

    methods: ["GET", "POST", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "x-admin-key"
    ]
  })
);

// =========================
// EXPRESS
// =========================

app.use(express.json({ limit: "1mb" }));

// =========================
// OPENAI
// =========================

const ai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const ADMIN_KEY =
  process.env.ADMIN_KEY || "change-me";

// =========================
// FICHIER PRINCIPAL
// =========================

const INDEX_FILE = path.join(__dirname, "index.html");

// =========================
// ADMIN
// =========================

function admin(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({
      error: "Accès administrateur refusé."
    });
  }

  next();
}

// =========================
// HEALTH CHECK
// =========================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiConfigured: !!ai,
    model: MODEL,
    time: new Date().toISOString()
  });
});

// =========================
// UTILISATEURS
// =========================

app.post("/api/users", (req, res) => {
  const { name, email } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({
      error: "Nom et email requis."
    });
  }

  try {
    const cleanName = String(name).trim();
    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const result = db
      .prepare(
        "INSERT INTO users(name,email) VALUES(?,?)"
      )
      .run(cleanName, cleanEmail);

    res.json({
      id: result.lastInsertRowid,
      name: cleanName,
      email: cleanEmail
    });
  } catch (error) {
    res.status(409).json({
      error: "Cet email existe déjà."
    });
  }
});

// =========================
// HISTORIQUE
// =========================

app.get("/api/history/:userId", (req, res) => {
  const userId = Number(req.params.userId);

  const history = db
    .prepare(
      `SELECT id, message, reply, created_at
       FROM chats
       WHERE user_id=?
       ORDER BY id DESC
       LIMIT 100`
    )
    .all(userId);

  res.json(history);
});

// =========================
// CHAT ALPH AI
// =========================

app.post("/api/chat", async (req, res) => {
  const message = String(
    req.body?.message || ""
  ).trim();

  const userId = Number(
    req.body?.userId || 0
  );

  if (!message) {
    return res.status(400).json({
      error: "Message vide."
    });
  }

  if (!ai) {
    return res.status(503).json({
      error:
        "Le moteur IA n'est pas disponible. Vérifiez OPENAI_API_KEY dans Render."
    });
  }

  try {
    const response = await ai.responses.create({
      model: MODEL,

      instructions: `
Tu es ALPH AI, un assistant francophone pratique,
fiable et intelligent, conçu notamment pour les
utilisateurs en Guinée.

Réponds clairement et utilement.

N'invente jamais une information.

Pour les actualités, prix, lois, démarches
administratives ou informations susceptibles
de changer, indique lorsqu'une vérification
auprès d'une source officielle est nécessaire.

Ne prétends jamais avoir effectué une action
réelle si tu ne l'as pas faite.

Tu peux répondre en français, simplement
et naturellement.
`,

      input: message
    });

    const reply =
      response.output_text ||
      "Je n'ai pas pu générer une réponse.";

    // Sauvegarde de la conversation
    if (userId) {
      db.prepare(
        `INSERT INTO chats(user_id,message,reply)
         VALUES(?,?,?)`
      ).run(
        userId,
        message,
        reply
      );
    }

    res.json({
      reply
    });

  } catch (error) {

    console.error(
      "Erreur OpenAI :",
      error
    );

    res.status(500).json({
      error:
        "Erreur du moteur IA."
    });
  }
});

// =========================
// ALERTES
// =========================

app.get("/api/alerts", (req, res) => {
  const alerts = db
    .prepare(
      "SELECT * FROM alerts ORDER BY id DESC"
    )
    .all();

  res.json(alerts);
});

app.post("/api/alerts", admin, (req, res) => {
  const { title, body } =
    req.body || {};

  if (!title || !body) {
    return res.status(400).json({
      error: "Titre et contenu requis."
    });
  }

  const result = db
    .prepare(
      "INSERT INTO alerts(title,body) VALUES(?,?)"
    )
    .run(title, body);

  res.json({
    id: result.lastInsertRowid,
    title,
    body
  });
});

app.delete(
  "/api/alerts/:id",
  admin,
  (req, res) => {

    db.prepare(
      "DELETE FROM alerts WHERE id=?"
    ).run(
      Number(req.params.id)
    );

    res.json({
      ok: true
    });
  }
);

// =========================
// DOCUMENTS
// =========================

app.get("/api/documents", (req, res) => {
  const documents = db
    .prepare(
      "SELECT * FROM documents ORDER BY id DESC"
    )
    .all();

  res.json(documents);
});

app.post(
  "/api/documents",
  admin,
  (req, res) => {

    const {
      title,
      description
    } = req.body || {};

    if (!title || !description) {
      return res.status(400).json({
        error:
          "Titre et description requis."
      });
    }

    const result = db
      .prepare(
        `INSERT INTO documents(title,description)
         VALUES(?,?)`
      )
      .run(
        title,
        description
      );

    res.json({
      id: result.lastInsertRowid,
      title,
      description
    });
  }
);

// =========================
// STATISTIQUES ADMIN
// =========================

app.get(
  "/api/stats",
  admin,
  (req, res) => {

    res.json({
      users: db
        .prepare(
          "SELECT COUNT(*) n FROM users"
        )
        .get().n,

      chats: db
        .prepare(
          "SELECT COUNT(*) n FROM chats"
        )
        .get().n,

      alerts: db
        .prepare(
          "SELECT COUNT(*) n FROM alerts"
        )
        .get().n,

      documents: db
        .prepare(
          "SELECT COUNT(*) n FROM documents"
        )
        .get().n
    });
  }
);

// =========================
// PAGE ALPH AI
// =========================

app.get("/{*splat}", (req, res) => {
  res.sendFile(INDEX_FILE);
});

// =========================
// SERVEUR
// =========================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ALPH AI prêt sur le port ${PORT}`
    );
  }
);
