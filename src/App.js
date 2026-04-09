import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import AdminDashboard from "./components/AdminDashboard";
import TechDashboard from "./components/TechDashboard";
import CarburantModule from "./components/CarburantModule";
import "./App.css";

const IconBons = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#2a9d8f" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const IconCarburant = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#2a9d8f" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>
    <line x1="3" y1="22" x2="15" y2="22"/>
    <rect x="6" y="10" width="6" height="4" rx="1"/>
    <path d="M15 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L21 7"/>
  </svg>
);

const IconStock = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#2a9d8f" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// ── Pull-to-refresh ──────────────────────────────────────────────────────────
function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const startY = React.useRef(null);
  const THRESHOLD = 80;

  React.useEffect(() => {
    const el = document.querySelector(".app-main");
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        e.preventDefault();
        const pct = Math.min(delta / THRESHOLD, 1);
        setProgress(pct);
        setPulling(delta >= THRESHOLD);
      }
    };

    const onTouchEnd = () => {
      if (pulling) onRefresh();
      startY.current = null;
      setProgress(0);
      setPulling(false);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pulling, onRefresh]);

  return { pulling, progress };
}

export default function App() {
  const [user, setUser]             = useState(null);
  const [role, setRole]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [loggingIn, setLoggingIn]   = useState(false);
  const [activePage, setActivePage] = useState("dashboard");

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

  const adminTabs = [
    { id: "dashboard", label: "Bons",      Icon: IconBons },
    { id: "carburant", label: "Carburant", Icon: IconCarburant },
    { id: "stock",     label: "Stock",     Icon: IconStock },
  ];
  const collabTabs = [
    { id: "dashboard", label: "Bons", Icon: IconBons },
  ];
  const tabs = role === "admin" ? adminTabs : collabTabs;

  if (loading) return (
    <div className="loading-screen">
      <div className="logo-big">C+</div>
      <p>Chargement…</p>
    </div>
  );

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

  return (
    <div className="app-root">

      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="header-left">
          <img src="/logo.png" alt="Cocon+"
            style={{height:34,objectFit:"contain",marginRight:8,background:"white",borderRadius:8,padding:"3px 6px",flexShrink:0}} />
          <span style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontWeight:500,whiteSpace:"nowrap"}}>
            {role === "admin" ? "Administration" : "Collaborateur"}
          </span>
        </div>

        {/* Navigation desktop — cachée sur mobile via CSS */}
        <nav className="desktop-nav">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActivePage(id)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"6px 14px", borderRadius:20, border:"none",
                cursor:"pointer", fontWeight:600, fontSize:13,
                background: activePage === id ? "#fff" : "rgba(255,255,255,0.15)",
                color:      activePage === id ? "#1f7a6e" : "#fff",
                transition: "all .2s",
              }}>
              <Icon active={activePage === id} />
              {label}
            </button>
          ))}
        </nav>

        <button className="btn-logout" onClick={() => signOut(auth)}>
          <span className="logout-label">Déconnexion</span>
        </button>
      </header>

      {/* ── Indicateur pull-to-refresh ── */}
      {(pulling || progress > 0 || refreshing) && (
        <div style={{
          position:"fixed", top:56, left:0, right:0, zIndex:99,
          display:"flex", justifyContent:"center", alignItems:"center",
          paddingTop: 8,
          pointerEvents:"none",
        }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display:"flex", alignItems:"center", justifyContent:"center",
            transform: refreshing ? "none" : `scale(${0.5 + progress * 0.5})`,
            transition: refreshing ? "none" : "transform .1s",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#2a9d8f" strokeWidth="2.5" strokeLinecap="round"
              style={{
                animation: refreshing ? "spin 0.8s linear infinite" : "none",
                transform: refreshing ? "none" : `rotate(${progress * 360}deg)`,
              }}>
              <path d="M23 4v6h-6"/>
              <path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── CONTENU ── */}
      <main className="app-main">
        {activePage === "dashboard" && (
          role === "admin" ? <AdminDashboard user={user} /> : <TechDashboard user={user} />
        )}
        {activePage === "carburant" && role === "admin" && (
          <CarburantModule user={user} />
        )}
        {activePage === "stock" && role === "admin" && (
          <div className="container" style={{textAlign:"center",paddingTop:"3rem",color:"#6b7280"}}>
            <div style={{fontSize:48,marginBottom:16}}>📦</div>
            <h2 style={{color:"#2a9d8f",marginBottom:8}}>Module Stock</h2>
            <p style={{fontSize:14}}>Bientôt disponible</p>
          </div>
        )}
      </main>

      {/* ── NAVIGATION BAS — mobile uniquement ── */}
      <nav className="bottom-nav">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActivePage(id)}
            className={`bottom-nav-btn ${activePage === id ? "active" : ""}`}>
            <Icon active={activePage === id} />
            <span>{label}</span>
          </button>
        ))}
        <button className="bottom-nav-btn" onClick={() => signOut(auth)}>
          <IconLogout />
          <span>Quitter</span>
        </button>
      </nav>

    </div>
  );
}
