# ALPH AI — VERSION FINALE V5

## Contenu
- Interface mobile/PWA
- Chat IA via OpenAI Responses API
- Profils utilisateurs
- Historique des conversations
- Base SQLite
- Centre d'alertes
- Base de documents
- Panneau administrateur
- Statistiques
- Clé API conservée côté serveur

## Lancer en local
1. Installer Node.js.
2. Ouvrir ce dossier dans un terminal.
3. `npm install`
4. Copier `.env.example` vers `.env`
5. Renseigner `OPENAI_API_KEY`
6. Changer `ADMIN_KEY`
7. `npm start`
8. Ouvrir `http://localhost:3000`

## Test rapide
- Accueil → Chat → poser « Bonjour ALPH AI »
- Profil → créer un utilisateur
- Administration → dans l'URL ajouter `#admin` ne suffit pas encore : pour tester l'API admin, l'interface admin est intégrée mais peut être ouverte en modifiant temporairement le bouton/menu ou en allant à `/#admin`. Pour une mise en production, ajouter une vraie authentification admin.
