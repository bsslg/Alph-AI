# ALPH AI — Connexion du moteur IA

## 1. Déployer le backend

Le dossier contient un serveur Node.js/Express prêt pour Render.

- Build command : `npm install`
- Start command : `npm start`
- Runtime : Node

Variables à créer dans Render :

- `OPENAI_API_KEY` = ta clé API OpenAI (ne jamais la mettre dans GitHub)
- `OPENAI_MODEL` = `gpt-6-luna`
- `FRONTEND_URL` = `https://bsslg.github.io`
- `ADMIN_KEY` = une clé secrète de ton choix

## 2. Récupérer l'URL du backend

Après le déploiement Render donnera une adresse du type :

`https://alph-ai-moteur.onrender.com`

## 3. Brancher le site GitHub Pages

Dans `public/index.html`, remplacer :

`const API_BASE = "https://REMPLACE-MOI.onrender.com";`

par l'URL réelle du backend, par exemple :

`const API_BASE = "https://alph-ai-moteur.onrender.com";`

Puis envoyer le fichier `index.html` mis à jour dans le dépôt GitHub Pages `bsslg/Alph-AI`.

## 4. Vérifier

Ouvrir :

`https://bsslg.github.io/Alph-AI/`

Puis envoyer un message dans Chat.

Le navigateur appelle alors :

`POST https://TON-BACKEND.onrender.com/api/chat`

La clé OpenAI reste uniquement sur le serveur Render.
