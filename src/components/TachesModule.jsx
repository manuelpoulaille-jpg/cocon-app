import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from "firebase/firestore";

const CATEGORIES = ["Rappel client", "Envoi devis", "Relance", "Suivi contrat", "Autre"];
const PRIORITES  = ["Normale", "Haute"];

const EMPTY_FORM = {
  titre: "", categorie: "Rappel client", echeance: "",
  priorite: "Normale", contact: "",
};

const CAT_STYLE = {
  "Rappel client": { bg: "#e6f1fb", color: "#0c447c" },
  "Envoi devis":   { bg: "#f5e8d8", color: "#6b4a31" },
  "Relance":       { bg: "#fbeaf0", color: "#72243e" },
  "Suivi contrat": { bg: "#e1f5ee", color: "#0e6b50" },
  "Autre":         { bg: "#f1efe8", color: "#5f5e5a" },
};

function todayStr() {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });
}

function fmtDate(str) {
  if (!str) return "—";
  const today = todayStr();
  const yesterday = new Date(today + "T00:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toLocaleDateString("fr-CA");
  if (str === today) return "Aujourd'hui";
  if (str === yStr)  return "Hier";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function getDaysTo(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00") - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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

const CSS = `
.tk-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
@media(max-width:700px){.tk-table{min-width:500px}}
.tk-table{width:100%;border-collapse:collapse;font-size:12px}
.tk-table th{text-align:left;font-size:9px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.8px;padding:7px 14px;border-bottom:.5px solid #e8e5e0;white-space:nowrap;background:white}
.tk-table td{padding:9px 14px;border-bottom:.5px solid #f0ede8;color:#1a1a1a;vertical-align:middle}
.tk-table tr:last-child td{border-bottom:none}
.tk-table tr:hover td{background:#fafaf8}
.tk-chk{width:16px;height:16px;border-radius:4px;border:1.5px solid #35B499;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;background:transparent}
.tk-chk.done{background:#35B499;border-color:#35B499}
.tk-prio-haute{background:#fde8e8;color:#9b2c2c;font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px}
.tk-prio-norm{background:#f1efe8;color:#5f5e5a;font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px}
.tk-badge{font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px;white-space:nowrap;display:inline-block}
.tk-panel{background:white;border-radius:10px;border:.5px solid #e0ddd8;overflow:hidden}
.tk-panel-head{padding:11px 16px;border-bottom:.5px solid #e8e5e0;display:flex;align-items:center;gap:8px}
`;

export default function TachesModule() {
  const [taches,    setTaches]    = useState([]);
  const [filter,    setFilter]    = useState("tous");
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

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
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
      setTaches(all);
    } catch(e) {
      console.error("fetchTaches error:", e);
    }
  };

  const addTache = async () => {
    if (!form.titre.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "taches"), {
        ...form,
        statut:    "à faire",
        createdAt: Timestamp.now(),
      });
      console.log("Tâche créée :", ref.id);
      setForm({ ...EMPTY_FORM });
      await fetchTaches();
    } catch(e) {
      console.error("Erreur addTache:", e);
      alert("Erreur enregistrement tâche :\n" + (e?.message || e?.code || JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (t) => {
    const newStatut = t.sc === "faite" ? "à faire" : "faite";
    await updateDoc(doc(db, "taches", t.id), { statut: newStatut });
    await fetchTaches();
  };

  const deleteTache = async (id) => {
    await deleteDoc(doc(db, "taches", id));
    setConfirmDel(null);
    await fetchTaches();
  };

  // Stats
  const today   = todayStr();
  const aFaire  = taches.filter(t => t.sc !== "faite").length;
  const enRetard= taches.filter(t => t.sc === "en retard").length;
  const today_n = taches.filter(t => t.echeance === today && t.sc !== "faite").length;
  const now     = new Date();
  const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("fr-CA");
  const faitesMois= taches.filter(t => t.statut === "faite" && t.echeance >= moisDebut).length;
  const totalMois = taches.filter(t => t.echeance >= moisDebut).length;
  const taux = totalMois > 0 ? Math.round(faitesMois / totalMois * 100) : 0;

  const filtered = taches.filter(t => {
    if (filter === "tous")      return true;
    if (filter === "afaire")    return t.sc === "à faire";
    if (filter === "retard")    return t.sc === "en retard";
    if (filter === "faites")    return t.sc === "faite";
    if (filter === "aujourd") return t.echeance === today;
    return true;
  });

  const scStyle = (sc) => ({
    "à faire":   { bg: "#f5e8d8", color: "#6b4a31" },
    "en retard": { bg: "#fde8e8", color: "#9b2c2c" },
    "faite":     { bg: "#e1f5ee", color: "#0e6b50" },
  }[sc] || { bg: "#eee", color: "#333" });

  return (
    <div style={{ padding: "22px 24px" }} className="tk-root">

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"À faire",         val:aFaire,      accent:"#35B499",  sub: today_n > 0 ? `dont ${today_n} aujourd'hui` : "aucune aujourd'hui",     subColor: today_n > 0 ? "#8B6A4E" : "#888" },
          { label:"En retard",       val:enRetard,    accent:"#c0392b",  sub: enRetard > 0 ? "Action requise" : "Aucun retard",   subColor: enRetard > 0 ? "#c0392b" : "#888" },
          { label:"Faites ce mois",  val:faitesMois,  accent:"#8B6A4E",  sub: `sur ${totalMois} au total`,                        subColor:"#888" },
          { label:"Taux complétion", val:taux + " %", accent:"#2a9a82",  sub: "tâches avec échéance",                             subColor:"#888" },
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

        {/* TABLEAU */}
        <div style={{flex:"1 1 500px",minWidth:0}}>
          {/* Filtres */}
          <div style={{ display:"flex", gap:7, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            {[
              ["tous",     "Toutes"],
              ["afaire",   "À faire"],
              ["retard",   "En retard"],
              ["aujourd",  "Aujourd'hui"],
              ["faites",   "Faites"],
            ].map(([key, label]) => {
              const active = filter === key;
              const isRetard = key === "retard";
              return (
                <div key={key} onClick={() => setFilter(key)}
                  style={{ padding:"4px 12px", borderRadius:20, fontSize:11, cursor:"pointer",
                    border:".5px solid #e0ddd8",
                    background: active ? (isRetard ? "#fde8e8" : "#e1f5ee") : "#f5f5f2",
                    color: active ? (isRetard ? "#9b2c2c" : "#0e6b50") : "#888" }}>
                  {label}
                </div>
              );
            })}
          </div>

          {/* Confirm delete */}
          {confirmDel && (
            <div style={{ background:"#fdecea", border:"1px solid #f5c6cb", borderRadius:10, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
              <span style={{ color:"#c0392b", fontSize:13, fontWeight:500 }}>Supprimer cette tâche ?</span>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-outline" style={{ fontSize:12, padding:"5px 12px" }} onClick={() => setConfirmDel(null)}>Annuler</button>
                <button style={{ background:"#c0392b", color:"white", border:"none", padding:"5px 14px", borderRadius:8, cursor:"pointer", fontSize:12 }} onClick={() => deleteTache(confirmDel)}>Supprimer</button>
              </div>
            </div>
          )}

          <div className="tk-panel">
            <div className="tk-panel-head">
              <span style={{ fontSize:12, fontWeight:600, color:"#1a1a1a" }}>Tâches commerciales</span>
              <span style={{ fontSize:11, color:"#888", marginLeft:"auto" }}>{filtered.length} tâche{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding:"24px", textAlign:"center", fontSize:13, color:"#aaa" }}>Aucune tâche dans cette catégorie.</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table className="tk-table">
                  <thead>
                    <tr>
                      <th style={{ width:28 }}></th>
                      <th>Tâche</th>
                      <th>Catégorie</th>
                      <th>Contact / note</th>
                      <th>Échéance</th>
                      <th>Priorité</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const ss    = scStyle(t.sc);
                      const cat   = CAT_STYLE[t.categorie] || CAT_STYLE["Autre"];
                      const isDone = t.sc === "faite";
                      const dLabel = echeanceLabel(t.echeance);
                      const isLate = t.sc === "en retard";
                      return (
                        <tr key={t.id} style={{ background: isLate ? "#fff8f8" : "transparent", opacity: isDone ? 0.6 : 1 }}>
                          <td>
                            <div className={`tk-chk${isDone ? " done" : ""}`} onClick={() => toggleDone(t)}>
                              {isDone && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: isDone ? 400 : 500, textDecoration: isDone ? "line-through" : "none", color: isDone ? "#aaa" : isLate ? "#c0392b" : "#1a1a1a" }}>
                            {t.titre}
                          </td>
                          <td>
                            <span style={{ background:cat.bg, color:cat.color, fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>
                              {t.categorie}
                            </span>
                          </td>
                          <td style={{ fontSize:11, color:"#888", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {t.contact || "—"}
                          </td>
                          <td style={{ fontSize:11, whiteSpace:"nowrap", fontWeight: isLate ? 500 : 400, color: isLate ? "#c0392b" : t.echeance === today ? "#8B6A4E" : "#888" }}>
                            {dLabel}{isLate ? " ⚠" : ""}
                          </td>
                          <td>
                            <span className={t.priorite === "Haute" ? "tk-prio-haute" : "tk-prio-norm"}>{t.priorite}</span>
                          </td>
                          <td>
                            <span style={{ background:ss.bg, color:ss.color, fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20 }}>{t.sc}</span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button onClick={() => setConfirmDel(t.id)}
                              style={{ background:"none", border:"none", color:"#ccc", cursor:"pointer", fontSize:14, padding:"0 4px" }}>✕</button>
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

        {/* FORMULAIRE + TÂCHES DU JOUR */}
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
                .map(t => (
                  <div key={t.id} style={{
                    display:"flex", alignItems:"center", gap:9, padding:"8px 14px",
                    borderBottom:".5px solid #f0ede8",
                    background: t.sc === "en retard" ? "#fff5f5" : "transparent"
                  }}>
                    <div className={`tk-chk${t.sc === "faite" ? " done" : ""}`}
                      style={{ borderColor: t.sc === "en retard" ? "#c0392b" : "#35B499" }}
                      onClick={() => toggleDone(t)}>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color: t.sc === "en retard" ? "#c0392b" : "#1a1a1a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {t.titre}
                      </div>
                      <div style={{ fontSize:10, color: t.sc === "en retard" ? "#c0392b" : "#888", marginTop:1 }}>
                        {t.sc === "en retard" ? `En retard · ${echeanceLabel(t.echeance)}` : t.categorie + " · " + t.priorite}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Formulaire nouvelle tâche */}
          <div className="tk-panel">
            <div className="tk-panel-head">
              <span style={{ fontSize:11, fontWeight:600, color:"#1a1a1a" }}>Nouvelle tâche</span>
            </div>
            <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4, fontWeight:500 }}>Titre *</div>
                <input
                  type="text"
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex : Rappeler M. Dupont"
                  style={{ width:"100%", padding:"7px 10px", fontSize:12, border:".5px solid #e0ddd8", borderRadius:6, background:"#fafaf8", color:"#1a1a1a", fontFamily:"inherit", boxSizing:"border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4, fontWeight:500 }}>Catégorie</div>
                <select
                  value={form.categorie}
                  onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                  style={{ width:"100%", padding:"7px 10px", fontSize:12, border:".5px solid #e0ddd8", borderRadius:6, background:"#fafaf8", color:"#1a1a1a", fontFamily:"inherit" }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4, fontWeight:500 }}>Échéance</div>
                  <input
                    type="date"
                    value={form.echeance}
                    onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))}
                    style={{ width:"100%", padding:"7px 8px", fontSize:11, border:".5px solid #e0ddd8", borderRadius:6, background:"#fafaf8", color:"#1a1a1a", fontFamily:"inherit" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4, fontWeight:500 }}>Priorité</div>
                  <select
                    value={form.priorite}
                    onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                    style={{ width:"100%", padding:"7px 8px", fontSize:11, border:".5px solid #e0ddd8", borderRadius:6, background:"#fafaf8", color:"#1a1a1a", fontFamily:"inherit" }}>
                    {PRIORITES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4, fontWeight:500 }}>Contact / note</div>
                <input
                  type="text"
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                  placeholder="Nom, tél ou note libre"
                  style={{ width:"100%", padding:"7px 10px", fontSize:12, border:".5px solid #e0ddd8", borderRadius:6, background:"#fafaf8", color:"#1a1a1a", fontFamily:"inherit", boxSizing:"border-box" }}
                />
              </div>
              <button
                disabled={saving || !form.titre.trim()}
                onClick={addTache}
                style={{ background: form.titre.trim() ? "#35B499" : "#ccc", color:"white", border:"none", borderRadius:8, padding:"9px", fontSize:12, fontWeight:500, cursor: form.titre.trim() ? "pointer" : "default", width:"100%" }}>
                {saving ? "Enregistrement…" : "+ Ajouter la tâche"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
