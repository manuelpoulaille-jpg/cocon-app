// src/firebase.js
// ⚠️ REMPLACEZ ces valeurs par celles de votre projet Firebase
// Allez sur https://console.firebase.google.com -> Nouveau projet -> Web app

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXnOQrqtvIiZ0YReuCekT816UP-I6vE38",
  authDomain: "cocon-app-2b4df.firebaseapp.com",
  projectId: "cocon-app-2b4df",
  storageBucket: "cocon-app-2b4df.firebasestorage.app",
  messagingSenderId: "744917110806",
  appId: "1:744917110806:web:90c0e7d0ba183ed0926537"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
