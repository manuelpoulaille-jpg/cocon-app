import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import AdminDashboard from "./components/AdminDashboard";
import TechDashboard from "./components/TechDashboard";
import "./App.css";

export default function App() {
  const [user, setUser]           = useState(null);
  const [role, setRole]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setRole(snap.data().role);
        setUser(u);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setError("");
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Email ou mot de passe incorrect.");
    }
    setLoggingIn(false);
  };

  // ── CHARGEMENT ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="loading-screen">
      <div className="logo-big">C+</div>
      <p>Chargement…</p>
    </div>
  );

  // ── CONNEXION ─────────────────────────────────────────────────────────────

  if (!user) return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Cocon+" style={{height:80,objectFit:"contain",marginBottom:4,background:"white",borderRadius:12,padding:"4px 8px"}} />
          <h1>Cocon+</h1>
          <p>La maison protégée</p>
        </div>
        <form onSubmit={login}>
          {error && <div className="error-msg">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" required />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary" disabled={loggingIn}>
            {loggingIn ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );

  // ── ADMIN : plein écran, pas de header ───────────────────────────────────

  if (role === "admin") {
    return <AdminDashboard user={user} onLogout={() => signOut(auth)} />;
  }

  // ── TECHNICIEN : layout mobile avec header ────────────────────────────────

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-left">
          <img src="/logo.png" alt="Cocon+" style={{height:40,objectFit:"contain",marginRight:8,background:"white",borderRadius:8,padding:"3px 6px"}} />
          <span className="header-role" style={{color:"rgba(255,255,255,0.9)",fontSize:12}}>
            Collaborateur
          </span>
        </div>
        <button className="btn-logout" onClick={() => signOut(auth)}>
          <span className="logout-label">Déconnexion</span>
        </button>
      </header>
      <main className="app-main">
        <TechDashboard user={user} />
      </main>
      <nav className="bottom-nav">
        <button className="bottom-nav-btn active">
          <span style={{fontSize:20}}>🏠</span>
          <span>Interventions</span>
        </button>
        <button className="bottom-nav-btn" onClick={() => signOut(auth)}>
          <span style={{fontSize:20}}>🚪</span>
          <span>Quitter</span>
        </button>
      </nav>
    </div>
  );
}
