import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from "firebase/firestore";

const CATEGORIES     = ["Rappel client", "Envoi devis", "Relance", "Suivi contrat", "Autre"];
const PRIORITES      = ["Normale", "Haute"];
const COLLABORATEURS = ["Manuel", "Loris", "Jean-Marc"];

const EMPTY_FORM = {
  titre: "", categorie: "Rappel client", echeance: "",
  priorite: "Normale", contact: "", assignee: "", notes: "",
};

const CAT_STYLE = {
  "Rappel client": { bg: "#e6f1fb", color: "#0c447c" },
  "Envoi devis":   { bg: "#f5e8d8", color: "#6b4a31" },
  "Relance":       { bg: "#fbeaf0", color: "#72243e" },
  "Suivi contrat": { bg: "#e1f5ee", color: "#0e6b50" },
  "Autre":         { bg: "#f1efe8", color: "#5f5e5a" },
};

const ASSIGNEE_COLOR = {
  "Manuel":    { bg: "#e8f0fb", color: "#2c4fa5", dot: "#2c4fa5" },
  "Loris":     { bg: "#f0e8fb", color: "#6a2ca5", dot: "#6a2ca5" },
  "Jean-Marc": { bg: "#fbe8f0", color: "#a52c6a", dot: "#a52c6a" },
};

function todayStr() {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });
}

function getDaysTo(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24));
}

function computeStatut(t) {
  if (t.statut === "faite") return "faite";
  const d = getDaysTo(t.echeance);
  if (d !== null && d < 0) return "en retard";
  return "à faire";
}

function echeanceLabel(dateStr) {
  if (!dateStr) return "—";
  const d = getDaysTo(dateStr);
  if (d === null) return "—";
  if (d < 0)  return `Il y a ${Math.abs(d)} j`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `Dans ${d} j`;
}

function fmtDateShort(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

const CSS = `
.tk-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.tk-table{width:100%;border-collapse:collapse;font-size:12px}
.tk-table th{text-align:left;font-size:9px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.8px;padding:7px 14px;border-bottom:.5px solid #e8e5e0;white-space:nowrap;background:white}
.tk-table td{padding:9px 14px;border-bottom:.5px solid #f0ede8;color:#1a1a1a;vertical-align:middle}
.tk-table tr:last-child td{border-bottom:none}
.tk-table tr:hover td{background:#fafaf8;cursor:pointer}
.tk-chk{width:16px;height:16px;border-radius:4px;border:1.5px solid #35B499;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;background:transparent;transition:all .15s}
.tk-chk.done{background:#35B499;border-color:#35B499}
.tk-prio-haute{background:#fde8e8;color:#9b2c2c;font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px}
.tk-prio-norm{background:#f1efe8;color:#5f5e5a;font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px}
.tk-panel{background:white;border-radius:10px;border:.5px solid #e0ddd8;overflow:hidden}
.tk-panel-head{padding:11px 16px;border-bottom:.5px solid #e8e5e0;display:flex;align-items:center;gap:8px}
.tk-input{width:100%;padding:7px 10px;font-size:12px;border:.5px solid #e0ddd8;border-radius:6px;background:#fafaf8;color:#1a1a1a;font-family:inherit;box-sizing:border-box;outline:none}
.tk-input:focus{border-color:#35B499}
.tk-select{width:100%;padding:7px 10px;font-size:12px;border:.5px solid #e0ddd8;border-radius:6px;background:#fafaf8;color:#1a1a1a;font-family:inherit;outline:none}
.tk-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;font-weight:500;display:block}
.tk-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px}
.tk-drawer{background:white;border-radius:14px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.2)}
.tk-drawer-head{padding:16px 20px;border-bottom:.5px solid #e8e5e0;display:flex;align-items:flex-start;gap:10px;position:sticky;top:0;background:white;z-index:1}
.tk-drawer-body{padding:18px 20px;display:flex;flex-direction:column;gap:13px}
`;

export default function TachesModule() {
  const [taches,      setTaches]      = useState([]);
  const [filter,      setFilter]      = useState("tous");
  const [filterAssig, setFilterAssig] = useState("tous");
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [editData,    setEditData]    = useState({});
  const [confirmDel,  setConfirmDel]  = useState(null);

  useEffect(() => {
    if (!document.getElementById("tk-styles")) {
      const el = document.createElement("style");
      el.id = "tk-styles"; el.textContent = CSS;
      document.head.appendChild(el);
    }
    fetchTaches();
  }, []);

  const fetchTaches = async () => {
    try {
      const snap = await getDocs(collection(db, "taches"));
      const all = snap.docs
        .map(d => { const data = { id: d.id, ...d.data() }; return { ...data, sc: computeStatut(data) }; })
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTaches(all);
    } catch(e) { console.error("fetchTaches error:", e); }
  };

  // ── Détail ────────────────────────────────────────────────────────────────
  const openDetail = (t) => {
    setSelected(t);
    setConfirmDel(null);
    setEditData({
      titre:     t.titre     || "",
      categorie: t.categorie || "Rappel client",
      echeance:  t.echeance  || "",
      priorite:  t.priorite  || "Normale",
      contact:   t.contact   || "",
      assignee:  t.assignee  || "",
      notes:     t.notes     || "",
    });
  };

  const closeDetail = () => { setSelected(null); setEditData({}); setConfirmDel(null); };

  const saveEdit = async () => {
    if (!selected || !editData.titre.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "taches", selected.id), {
        titre:     editData.titre,
        categorie: editData.categorie,
        echeance:  editData.echeance,
        priorite:  editData.priorite,
        contact:   editData.contact   || "",
        assignee:  editData.assignee  || "",
        notes:     editData.notes     || "",
      });
      await fetchTaches();
      closeDetail();
    } catch(e) { console.error("saveEdit:", e); }
    setSaving(false);
  };

  // ── Toggle done ───────────────────────────────────────────────────────────
  const toggleDone = async (t, e) => {
    e?.stopPropagation();
    const newStatut = t.sc === "faite" ? "à faire" : "faite";
    await updateDoc(doc(db, "taches", t.id), { statut: newStatut });
    if (selected?.id === t.id) closeDetail();
    await fetchTaches();
  };

  // ── Suppression ───────────────────────────────────────────────────────────
  const deleteTache = async (id) => {
    await deleteDoc(doc(db, "taches", id));
    setConfirmDel(null);
    if (selected?.id === id) closeDetail();
    await fetchTaches();
  };

  // ── Ajout ─────────────────────────────────────────────────────────────────
  const addTache = async () => {
    if (!form.titre.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "taches"), { ...form, statut: "à faire", createdAt: Timestamp.now() });
      setForm({ ...EMPTY_FORM });
      await fetchTaches();
    } catch(e) {
      console.error("addTache:", e);
      alert("Erreur : " + (e?.message || JSON.stringify(e)));
    }
    setSaving(false);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const today      = todayStr();
  const aFaire     = taches.filter(t => t.sc !== "faite").length;
  const enRetard   = taches.filter(t => t.sc === "en retard").length;
  const today_n    = taches.filter(t => t.echeance === today && t.sc !== "faite").length;
  const now        = new Date();
  const moisDebut  = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("fr-CA");
  const faitesMois = taches.filter(t => t.statut === "faite" && t.echeance >= moisDebut).length;
  const totalMois  = taches.filter(t => t.echeance >= moisDebut).length;
  const taux       = totalMois > 0 ? Math.round(faitesMois / totalMois * 100) : 0;

  // ── Filtres ───────────────────────────────────────────────────────────────
  const filtered = taches.filter(t => {
    const mF =
      filter === "tous"    ? true :
      filter === "afaire"  ? t.sc === "à faire" :
      filter === "retard"  ? t.sc === "en retard" :
      filter === "faites"  ? t.sc === "faite" :
      filter === "aujourd" ? t.echeance === today : true;
    const mA =
      filterAssig === "tous"          ? true :
      filterAssig === "non-assigne"   ? !t.assignee :
      t.assignee === filterAssig;
    return mF && mA;
  });

  const scStyle = (sc) => ({
    "à faire":   { bg: "#f5e8d8", color: "#6b4a31" },
    "en retard": { bg: "#fde8e8", color: "#9b2c2c" },
    "faite":     { bg: "#e1f5ee", color: "#0e6b50" },
  }[sc] || { bg: "#eee", color: "#333" });

  // ── Drawer ────────────────────────────────────────────────────────────────
  const renderDrawer = () => {
    if (!selected) return null;
    const isDone = selected.sc === "faite";
    const isLate = selected.sc === "en retard";
    const ss     = scStyle(selected.sc);

    return (
      <div className="tk-overlay" onClick={closeDetail}>
        <div className="tk-drawer" onClick={e => e.stopPropagation()}>

          {/* En-tête */}
          <div className="tk-drawer-head">
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:"#aaa", marginBottom:4 }}>
                Créée le {selected.createdAt?.toDate ? new Date(selected.createdAt.toDate()).toLocaleDateString("fr-FR") : "—"}
              </div>
              <div style={{ fontSize:15, fontWeight:700, lineHeight:1.3,
                color: isDone ? "#aaa" : isLate ? "#c0392b" : "#1a1a1a",
                textDecoration: isDone ? "line-through" : "none" }}>
                {selected.titre}
              </div>
              {/* Badges rapides */}
              <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                <span style={{ background:ss.bg, color:ss.color, fontSize:10, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>
                  {isLate ? "⚠️ " : ""}{selected.sc}
                </span>
                {selected.echeance && (
                  <span style={{ fontSize:10, color: isLate ? "#c0392b" : "#888", padding:"3px 10px", background:"#f5f5f2", borderRadius:20 }}>
                    📅 {fmtDateShort(selected.echeance)} — {echeanceLabel(selected.echeance)}
                  </span>
                )}
                {selected.assignee && (() => {
                  const ac = ASSIGNEE_COLOR[selected.assignee];
                  return ac ? (
                    <span style={{ background:ac.bg, color:ac.color, fontSize:10, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>
                      👤 {selected.assignee}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
            <button onClick={closeDetail}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#bbb", padding:"0 4px", lineHeight:1, flexShrink:0 }}>
              ✕
            </button>
          </div>

          {/* Corps */}
          <div className="tk-drawer-body">

            {/* Action rapide marquer faite */}
            <button onClick={(e) => toggleDone(selected, e)}
              style={{ padding:"10px", borderRadius:9, border:"none", fontWeight:600, fontSize:13, cursor:"pointer",
                background: isDone ? "#f5e8d8" : "#35B499", color: isDone ? "#8B6A4E" : "white" }}>
              {isDone ? "↩ Rouvrir la tâche" : "✓ Marquer comme faite"}
            </button>

            <hr style={{ border:"none", borderTop:".5px solid #f0ede8", margin:0 }} />

            {/* Titre */}
            <div>
              <label className="tk-label">Titre *</label>
              <input className="tk-input" value={editData.titre}
                onChange={e => setEditData(d => ({ ...d, titre: e.target.value }))} />
            </div>

            {/* Attribution */}
            <div>
              <label className="tk-label">Attribuer à</label>
              <div style={{ display:"flex", gap:8 }}>
                {COLLABORATEURS.map(name => {
                  const ac = ASSIGNEE_COLOR[name];
                  const isActive = editData.assignee === name;
                  return (
                    <button key={name} type="button"
                      onClick={() => setEditData(d => ({ ...d, assignee: isActive ? "" : name }))}
                      style={{ flex:1, padding:"9px 0", borderRadius:8, fontSize:12, fontWeight: isActive ? 600 : 400,
                        cursor:"pointer", transition:"all .15s", textAlign:"center",
                        background: isActive ? ac.bg  : "#fafaf8",
                        color:      isActive ? ac.color : "#888",
                        border:     isActive ? `.5px solid ${ac.dot}` : ".5px solid #e0ddd8" }}>
                      {name}
                    </button>
                  );
                })}
              </div>
              {editData.assignee && (
                <button type="button" onClick={() => setEditData(d => ({ ...d, assignee: "" }))}
                  style={{ marginTop:6, background:"none", border:"none", cursor:"pointer", fontSize:11, color:"#aaa" }}>
                  ✕ Retirer l'attribution
                </button>
              )}
            </div>

            {/* Catégorie + Priorité */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label className="tk-label">Catégorie</label>
                <select className="tk-select" value={editData.categorie}
                  onChange={e => setEditData(d => ({ ...d, categorie: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="tk-label">Priorité</label>
                <select className="tk-select" value={editData.priorite}
                  onChange={e => setEditData(d => ({ ...d, priorite: e.target.value }))}>
                  {PRIORITES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Échéance */}
            <div>
              <label className="tk-label">Échéance</label>
              <input type="date" className="tk-input" value={editData.echeance}
                onChange={e => setEditData(d => ({ ...d, echeance: e.target.value }))} />
            </div>

            {/* Contact */}
            <div>
              <label className="tk-label">Contact / note courte</label>
              <input className="tk-input" placeholder="Nom, téléphone…" value={editData.contact}
                onChange={e => setEditData(d => ({ ...d, contact: e.target.value }))} />
            </div>

            {/* Notes */}
            <div>
              <label className="tk-label">Notes / description</label>
              <textarea className="tk-input" rows={3} placeholder="Contexte, détails…"
                value={editData.notes} style={{ resize:"vertical" }}
                onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} />
            </div>

            {/* Boutons */}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={saveEdit} disabled={saving || !editData.titre.trim()}
                style={{ flex:1, padding:"10px", borderRadius:8, border:"none",
                  background: editData.titre.trim() ? "#35B499" : "#ccc",
                  color:"white", fontWeight:600, fontSize:13,
                  cursor: editData.titre.trim() ? "pointer" : "default" }}>
                {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
              </button>
              <button onClick={() => setConfirmDel(selected.id)}
                style={{ padding:"10px 14px", borderRadius:8, border:".5px solid #f5c6cb",
                  background:"#fdecea", color:"#c0392b", fontSize:12, cursor:"pointer", fontWeight:500 }}>
                🗑
              </button>
            </div>

            {/* Confirm suppression */}
            {confirmDel === selected.id && (
              <div style={{ background:"#fdecea", border:"1px solid #f5c6cb", borderRadius:8, padding:"12px 14px",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <span style={{ color:"#c0392b", fontSize:12, fontWeight:500 }}>Confirmer la suppression ?</span>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ background:"#fff", border:".5px solid #ccc", padding:"5px 12px", borderRadius:6, cursor:"pointer", fontSize:11 }}
                    onClick={() => setConfirmDel(null)}>Annuler</button>
                  <button style={{ background:"#c0392b", color:"white", border:"none", padding:"5px 14px", borderRadius:6, cursor:"pointer", fontSize:11 }}
                    onClick={() => deleteTache(selected.id)}>Supprimer</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: "22px 24px" }} className="tk-root">

      {renderDrawer()}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"À faire",         val:aFaire,       accent:"#35B499", sub: today_n > 0 ? `dont ${today_n} aujourd'hui` : "aucune aujourd'hui", subColor: today_n > 0 ? "#8B6A4E" : "#888" },
          { label:"En retard",       val:enRetard,     accent:"#c0392b", sub: enRetard > 0 ? "Action requise" : "Aucun retard",                   subColor: enRetard > 0 ? "#c0392b" : "#888" },
          { label:"Faites ce mois",  val:faitesMois,   accent:"#8B6A4E", sub: `sur ${totalMois} au total`,                                        subColor:"#888" },
          { label:"Taux complétion", val:taux + " %",  accent:"#2a9a82", sub: "tâches avec échéance",                                             subColor:"#888" },
        ].map(({ label, val, accent, sub, subColor }) => (
          <div key={label} style={{ background:"white", borderRadius:10, padding:"13px 15px", border:".5px solid #e0ddd8", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent }} />
            <div style={{ fontSize:"9.5px", color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:5, fontWeight:500 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:"#1a1a1a", letterSpacing:"-0.5px", lineHeight:1.1 }}>{val}</div>
            <div style={{ fontSize:"9.5px", color:subColor, marginTop:4 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", flexWrap:"wrap-reverse", gap:14, alignItems:"flex-start" }}>

        {/* ── TABLEAU ─────────────────────────────────────────────────────── */}
        <div style={{ flex:"1 1 500px", minWidth:0 }}>

          {/* Filtres statut */}
          <div style={{ display:"flex", gap:7, marginBottom:8, flexWrap:"wrap" }}>
            {[
              ["tous",    "Toutes"],
              ["afaire",  "À faire"],
              ["retard",  "En retard"],
              ["aujourd", "Aujourd'hui"],
              ["faites",  "Faites"],
            ].map(([key, label]) => {
              const active = filter === key;
              return (
                <div key={key} onClick={() => setFilter(key)}
                  style={{ padding:"4px 12px", borderRadius:20, fontSize:11, cursor:"pointer",
                    border:".5px solid #e0ddd8",
                    background: active ? (key === "retard" ? "#fde8e8" : "#e1f5ee") : "#f5f5f2",
                    color: active ? (key === "retard" ? "#9b2c2c" : "#0e6b50") : "#888" }}>
                  {label}
                </div>
              );
            })}
          </div>

          {/* Filtres assignee */}
          <div style={{ display:"flex", gap:7, marginBottom:12, flexWrap:"wrap" }}>
            {[
              ["tous",         "👥 Tous",        null],
              ["Manuel",       "Manuel",         "#2c4fa5"],
              ["Loris",        "Loris",          "#6a2ca5"],
              ["Jean-Marc",    "Jean-Marc",      "#a52c6a"],
              ["non-assigne",  "Non assigné",    "#aaa"],
            ].map(([key, label, color]) => {
              const active = filterAssig === key;
              return (
                <div key={key} onClick={() => setFilterAssig(key)}
                  style={{ padding:"4px 12px", borderRadius:20, fontSize:11, cursor:"pointer",
                    border: active && color ? `.5px solid ${color}` : ".5px solid #e0ddd8",
                    background: active ? (color ? color + "18" : "#e1f5ee") : "#f5f5f2",
                    color: active && color ? color : active ? "#0e6b50" : "#888",
                    fontWeight: active ? 600 : 400 }}>
                  {label}
                </div>
              );
            })}
          </div>

          <div className="tk-panel">
            <div className="tk-panel-head">
              <span style={{ fontSize:12, fontWeight:600, color:"#1a1a1a" }}>Tâches</span>
              <span style={{ fontSize:11, color:"#888", marginLeft:"auto" }}>{filtered.length} tâche{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding:"28px", textAlign:"center", fontSize:13, color:"#aaa" }}>Aucune tâche.</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table className="tk-table">
                  <thead>
                    <tr>
                      <th style={{ width:28 }}></th>
                      <th>Tâche</th>
                      <th>Catégorie</th>
                      <th>Attribué à</th>
                      <th>Échéance</th>
                      <th>Priorité</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const ss    = scStyle(t.sc);
                      const cat   = CAT_STYLE[t.categorie] || CAT_STYLE["Autre"];
                      const isDone = t.sc === "faite";
                      const isLate = t.sc === "en retard";
                      const ac    = t.assignee ? ASSIGNEE_COLOR[t.assignee] : null;
                      return (
                        <tr key={t.id} onClick={() => openDetail(t)}
                          style={{ background: isLate ? "#fff8f8" : "transparent", opacity: isDone ? 0.6 : 1 }}>
                          <td onClick={e => e.stopPropagation()}>
                            <div className={`tk-chk${isDone ? " done" : ""}`}
                              style={{ borderColor: isLate ? "#c0392b" : "#35B499" }}
                              onClick={e => toggleDone(t, e)}>
                              {isDone && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: isDone ? 400 : 500, textDecoration: isDone ? "line-through" : "none",
                            color: isDone ? "#aaa" : isLate ? "#c0392b" : "#1a1a1a",
                            maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {t.titre}
                          </td>
                          <td>
                            <span style={{ background:cat.bg, color:cat.color, fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>
                              {t.categorie}
                            </span>
                          </td>
                          <td>
                            {ac ? (
                              <span style={{ background:ac.bg, color:ac.color, fontSize:10, fontWeight:600, padding:"2px 9px", borderRadius:20 }}>
                                {t.assignee}
                              </span>
                            ) : (
                              <span style={{ fontSize:11, color:"#ddd" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize:11, whiteSpace:"nowrap", fontWeight: isLate ? 500 : 400,
                            color: isLate ? "#c0392b" : t.echeance === today ? "#8B6A4E" : "#888" }}>
                            {echeanceLabel(t.echeance)}{isLate ? " ⚠" : ""}
                          </td>
                          <td>
                            <span className={t.priorite === "Haute" ? "tk-prio-haute" : "tk-prio-norm"}>{t.priorite}</span>
                          </td>
                          <td>
                            <span style={{ background:ss.bg, color:ss.color, fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20 }}>{t.sc}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, flex:"1 1 280px", minWidth:"260px" }}>

          {/* Tâches du jour */}
          <div className="tk-panel">
            <div className="tk-panel-head">
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#c0392b", flexShrink:0 }} />
              <span style={{ fontSize:11, fontWeight:600, color:"#1a1a1a" }}>Tâches du jour</span>
              <span style={{ fontSize:10, color:"#888", marginLeft:"auto" }}>
                {taches.filter(t => t.echeance === today && t.sc !== "faite").length} restantes
              </span>
            </div>
            {taches.filter(t => (t.echeance === today || t.sc === "en retard") && t.sc !== "faite").length === 0 ? (
              <div style={{ padding:"14px", textAlign:"center", fontSize:11, color:"#aaa" }}>Tout est à jour 🎉</div>
            ) : (
              taches
                .filter(t => (t.echeance === today || t.sc === "en retard") && t.sc !== "faite")
                .sort((a, b) => (a.sc === "en retard" ? -1 : 1))
                .map(t => {
                  const ac = t.assignee ? ASSIGNEE_COLOR[t.assignee] : null;
                  return (
                    <div key={t.id} onClick={() => openDetail(t)}
                      style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 14px",
                        borderBottom:".5px solid #f0ede8", cursor:"pointer",
                        background: t.sc === "en retard" ? "#fff5f5" : "transparent" }}>
                      <div className={`tk-chk${t.sc === "faite" ? " done" : ""}`}
                        style={{ borderColor: t.sc === "en retard" ? "#c0392b" : "#35B499" }}
                        onClick={e => toggleDone(t, e)} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          color: t.sc === "en retard" ? "#c0392b" : "#1a1a1a" }}>
                          {t.titre}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                          <span style={{ fontSize:10, color: t.sc === "en retard" ? "#c0392b" : "#888" }}>
                            {t.sc === "en retard" ? `En retard · ${echeanceLabel(t.echeance)}` : t.categorie}
                          </span>
                          {ac && <span style={{ fontSize:9, fontWeight:600, padding:"1px 6px", borderRadius:20, background:ac.bg, color:ac.color }}>{t.assignee}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Formulaire nouvelle tâche */}
          <div className="tk-panel">
            <div className="tk-panel-head">
              <span style={{ fontSize:11, fontWeight:600, color:"#1a1a1a" }}>Nouvelle tâche</span>
            </div>
            <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>

              <div>
                <label className="tk-label">Titre *</label>
                <input className="tk-input" type="text" placeholder="Ex : Rappeler M. Dupont"
                  value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
              </div>

              {/* Attribution rapide */}
              <div>
                <label className="tk-label">Attribuer à</label>
                <div style={{ display:"flex", gap:6 }}>
                  {COLLABORATEURS.map(name => {
                    const ac = ASSIGNEE_COLOR[name];
                    const isActive = form.assignee === name;
                    return (
                      <button key={name} type="button"
                        onClick={() => setForm(f => ({ ...f, assignee: isActive ? "" : name }))}
                        style={{ flex:1, padding:"7px 0", borderRadius:7, fontSize:11, fontWeight: isActive ? 600 : 400,
                          cursor:"pointer", transition:"all .15s", textAlign:"center",
                          background: isActive ? ac.bg  : "#fafaf8",
                          color:      isActive ? ac.color : "#888",
                          border:     isActive ? `.5px solid ${ac.dot}` : ".5px solid #e0ddd8" }}>
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="tk-label">Catégorie</label>
                <select className="tk-select" value={form.categorie}
                  onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <label className="tk-label">Échéance</label>
                  <input type="date" className="tk-input" value={form.echeance}
                    onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))} />
                </div>
                <div>
                  <label className="tk-label">Priorité</label>
                  <select className="tk-select" value={form.priorite}
                    onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}>
                    {PRIORITES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="tk-label">Contact / note</label>
                <input className="tk-input" type="text" placeholder="Nom, tél ou note libre"
                  value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
              </div>

              <button disabled={saving || !form.titre.trim()} onClick={addTache}
                style={{ background: form.titre.trim() ? "#35B499" : "#ccc", color:"white", border:"none",
                  borderRadius:8, padding:"9px", fontSize:12, fontWeight:500, width:"100%",
                  cursor: form.titre.trim() ? "pointer" : "default" }}>
                {saving ? "Enregistrement…" : "+ Ajouter la tâche"}
              </button>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
