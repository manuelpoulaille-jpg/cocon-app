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
  const [tab, setTab]             = useState("interventions");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // ── ADMIN : plein écran, pas de header ────────────────────────────────────

  if (role === "admin") {
    return <AdminDashboard user={user} onLogout={() => signOut(auth)} />;
  }

  // ── TECHNICIEN : layout mobile avec header + bottom nav ───────────────────

  const prenom    = user?.displayName?.split(" ")[0] || "Équipe";
  const initiales = (user?.displayName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",background:"#f0ede8"}}>

      {/* ── Header dark ── */}
      <header style={{
        background:"#111d1b", padding:"12px 16px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0, zIndex:10,
      }}>
        <span style={{fontSize:17,fontWeight:700,color:"#35B499",letterSpacing:"-0.5px"}}>
          Cocon+
        </span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Rafraîchir */}
          <button
            onClick={() => setRefreshTrigger(t => t + 1)}
            style={{width:30,height:30,borderRadius:8,border:"0.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:"rgba(255,255,255,0.55)"}}
            title="Rafraîchir"
          >↻</button>
          {/* Nom + Avatar */}
          <span style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{prenom}</span>
          <div style={{width:28,height:28,borderRadius:"50%",background:"#35B499",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>
            {initiales}
          </div>
          {/* Déconnexion */}
          <button
            onClick={() => signOut(auth)}
            style={{width:30,height:30,borderRadius:8,border:"0.5px solid rgba(231,76,60,0.35)",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"rgba(231,76,60,0.75)"}}
            title="Déconnexion"
          >⏻</button>
        </div>
      </header>

      {/* ── Contenu principal ── */}
      <main style={{flex:1,overflowY:"auto"}}>
        <TechDashboard
          user={user}
          tab={tab}
          refreshTrigger={refreshTrigger}
        />
      </main>

      {/* ── Navigation bas ── */}
      <nav style={{
        display:"flex", background:"white",
        borderTop:"0.5px solid #e0ddd8", flexShrink:0, zIndex:10,
      }}>
        {[
          { key:"interventions", label:"Interventions", icon:"📋" },
          { key:"planning",      label:"Planning",      icon:"📅" },
        ].map(({ key, label, icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                padding:"10px 8px 8px", gap:3, cursor:"pointer",
                border:"none", background:"transparent",
              }}
            >
              <span style={{fontSize:20,color:active?"#35B499":"#aaa"}}>{icon}</span>
              <span style={{fontSize:9,fontWeight:active?600:400,color:active?"#35B499":"#aaa"}}>{label}</span>
              {active && <div style={{width:4,height:4,borderRadius:"50%",background:"#35B499",marginTop:2}}/>}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
