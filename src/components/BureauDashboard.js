import React, { useState } from "react";
import DevisModule from "./DevisModule";
import PlanningDashboard from "./PlanningDashboard";

// Espace « bureau » (rôle users/{uid}.role === "bureau") : accueil téléphonique.
// Saisie des demandes de devis et consultation du planning, sans montants ni facturation.
const ONGLETS = [
  { key: "devis",    label: "Demandes de devis", icon: "📋" },
  { key: "planning", label: "Planning",          icon: "📅" },
];

export default function BureauDashboard({ user, onLogout }) {
  const [view, setView] = useState("devis");
  const prenom = (user?.displayName || "").split(" ")[0] || user?.email || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#f0ede8" }}>
      <header style={{
        background: "#111d1b", padding: "10px 16px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#35B499", letterSpacing: "-0.5px" }}>Cocon+</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "1.8px", textTransform: "uppercase" }}>Bureau</span>
        <nav style={{ display: "flex", gap: 6, marginLeft: 6, flexWrap: "wrap" }}>
          {ONGLETS.map(({ key, label, icon }) => {
            const actif = view === key;
            return (
              <button key={key} onClick={() => setView(key)} style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: actif ? 600 : 400,
                border: actif ? "none" : "0.5px solid rgba(255,255,255,0.15)",
                background: actif ? "#35B499" : "transparent",
                color: actif ? "white" : "rgba(255,255,255,0.65)",
              }}>{icon} {label}</button>
            );
          })}
        </nav>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{prenom}</span>
        <button onClick={onLogout} title="Déconnexion" style={{
          padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12,
          border: "0.5px solid rgba(231,76,60,0.35)", background: "rgba(255,255,255,0.06)", color: "rgba(231,76,60,0.85)",
        }}>⏻ Déconnexion</button>
      </header>

      <main style={{ flex: 1, overflow: "auto" }}>
        {view === "devis"
          ? <DevisModule mode="bureau" />
          : <PlanningDashboard user={user} isAdmin={false} masquerMontants />}
      </main>
    </div>
  );
}
