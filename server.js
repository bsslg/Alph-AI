const express = require("express");
const Database = require("better-sqlite3");
const OpenAI = require("openai");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
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

const allowedOrigins = new Set([
  "https://bsslg.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map(x => x.trim()).filter(Boolean) : [])
]);

app.use(cors({
  origin(origin, callback){
    if(!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin non autorisée"));
  },
  methods:["GET","POST","DELETE","OPTIONS"],
  allowedHeaders:["Content-Type","x-admin-key"]
}));
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

const ai = process.env.OPENAI_API_KEY
  ? new OpenAI({apiKey: process.env.OPENAI_API_KEY})
  : null;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const ADMIN_KEY = process.env.ADMIN_KEY || "change-me";

function admin(req,res,next){
  if(req.headers["x-admin-key"] !== ADMIN_KEY)
    return res.status(401).json({error:"Accès administrateur refusé."});
  next();
}

app.get("/api/health",(req,res)=>res.json({
  ok:true, aiConfigured:!!ai, model:MODEL, time:new Date().toISOString()
}));

app.post("/api/users",(req,res)=>{
  const {name,email}=req.body||{};
  if(!name || !email) return res.status(400).json({error:"Nom et email requis."});
  try{
    const r=db.prepare("INSERT INTO users(name,email) VALUES(?,?)").run(String(name).trim(),String(email).trim().toLowerCase());
    res.json({id:r.lastInsertRowid,name,email});
  }catch(e){res.status(409).json({error:"Cet email existe déjà."});}
});

app.get("/api/history/:userId",(req,res)=>{
  res.json(db.prepare("SELECT id,message,reply,created_at FROM chats WHERE user_id=? ORDER BY id DESC LIMIT 100").all(Number(req.params.userId)));
});

app.post("/api/chat",async(req,res)=>{
  const message=String(req.body?.message||"").trim();
  const userId=Number(req.body?.userId||0);
  if(!message) return res.status(400).json({error:"Message vide."});
  if(!ai) return res.status(503).json({error:"Le moteur IA n'est pas configuré. Ajoutez OPENAI_API_KEY dans .env."});
  try{
    const response=await ai.responses.create({
      model:MODEL,
      instructions:`Tu es ALPH AI, un assistant francophone pratique et fiable, conçu notamment pour les utilisateurs en Guinée.
Réponds clairement, utilement et sans inventer. Pour les actualités, prix, lois, démarches administratives ou informations susceptibles de changer, précise quand une vérification auprès d'une source officielle est nécessaire.
Ne prétends pas avoir effectué une action réelle si tu ne l'as pas faite.`,
      input:message
    });
    const reply=response.output_text || "Je n'ai pas pu générer une réponse.";
    if(userId) db.prepare("INSERT INTO chats(user_id,message,reply) VALUES(?,?,?)").run(userId,message,reply);
    res.json({reply});
  }catch(e){
    console.error(e);
    res.status(500).json({error:"Erreur du moteur IA."});
  }
});

app.get("/api/alerts",(req,res)=>res.json(db.prepare("SELECT * FROM alerts ORDER BY id DESC").all()));
app.post("/api/alerts",admin,(req,res)=>{
  const {title,body}=req.body||{};
  if(!title||!body) return res.status(400).json({error:"Titre et contenu requis."});
  const r=db.prepare("INSERT INTO alerts(title,body) VALUES(?,?)").run(title,body);
  res.json({id:r.lastInsertRowid,title,body});
});
app.delete("/api/alerts/:id",admin,(req,res)=>{
  db.prepare("DELETE FROM alerts WHERE id=?").run(Number(req.params.id));
  res.json({ok:true});
});

app.get("/api/documents",(req,res)=>res.json(db.prepare("SELECT * FROM documents ORDER BY id DESC").all()));
app.post("/api/documents",admin,(req,res)=>{
  const {title,description}=req.body||{};
  if(!title||!description) return res.status(400).json({error:"Titre et description requis."});
  const r=db.prepare("INSERT INTO documents(title,description) VALUES(?,?)").run(title,description);
  res.json({id:r.lastInsertRowid,title,description});
});

app.get("/api/stats",admin,(req,res)=>res.json({
  users:db.prepare("SELECT COUNT(*) n FROM users").get().n,
  chats:db.prepare("SELECT COUNT(*) n FROM chats").get().n,
  alerts:db.prepare("SELECT COUNT(*) n FROM alerts").get().n,
  documents:db.prepare("SELECT COUNT(*) n FROM documents").get().n
}));

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>console.log(`ALPH AI prêt sur le port ${PORT}`));
