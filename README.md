# Cocon+ — Application Bons d'Intervention

## 🚀 Installation en 4 étapes

### Étape 1 — Créer le projet Firebase (gratuit)
1. Allez sur https://console.firebase.google.com
2. Cliquez "Nouveau projet" → nommez-le "cocon-app"
3. Dans le menu gauche → **Authentication** → "Commencer" → activer **Email/Mot de passe**
4. Dans le menu gauche → **Firestore Database** → "Créer une base de données" → mode Production
5. Dans le menu gauche → **Paramètres du projet** (⚙️) → "Vos applications" → ajouter une app Web (</>)
6. Copiez les valeurs `firebaseConfig` affichées

### Étape 2 — Configurer l'application
Ouvrez le fichier `src/firebase.js` et remplacez les valeurs :
```js
const firebaseConfig = {
  apiKey: "COLLER_ICI",
  authDomain: "COLLER_ICI",
  projectId: "COLLER_ICI",
  ...
};
```

### Étape 3 — Créer les utilisateurs Firebase
Dans Firebase Console → Authentication → Ajouter un utilisateur :
- Email admin : admin@cocon-plus.fr | mot de passe de votre choix
- Email technicien : prenom.nom@cocon-plus.fr | mot de passe de votre choix

Puis dans Firestore → collection "users" → créer un document par utilisateur :
```
Document ID = UID de l'utilisateur (visible dans Authentication)
Champs :
  - role : "admin"  (ou "technicien")
  - nom : "SERVAND"
  - prenom : "Jean-Marc"
```

### Étape 4 — Déployer sur Vercel (gratuit)
1. Créez un compte sur https://vercel.com
2. Installez Vercel CLI : `npm install -g vercel`
3. Dans le dossier du projet : `npm install` puis `vercel`
4. Suivez les instructions → votre app sera en ligne en 2 minutes !

---

## 📱 Fonctionnalités

### Accès Admin
- Créer un bon d'intervention (infos client, type, date, technicien assigné)
- Voir tous les bons et leur statut
- Consulter le détail complet avec signatures

### Accès Technicien
- Voir ses bons assignés
- Bouton **"Arrivé sur le chantier"** → horodate l'arrivée automatiquement
- Bouton **"Terminer le chantier"** → horodate la fin + génère le PDF
- Ajouter observations Cocon+ et client
- Signer + faire signer le client sur le téléphone
- Télécharger le PDF du bon complété

### Champs verrouillés pour le technicien
- Infos client (nom, adresse, téléphone, email)
- Type d'intervention
- Date et heure prévues
- Nom du technicien assigné

---

## 🔒 Règles Firestore (à configurer)
Dans Firebase Console → Firestore → Règles, copiez :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /bons/{bonId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```
