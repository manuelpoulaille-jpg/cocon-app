import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp, orderBy, query,
} from "firebase/firestore";

const TYPES = [
  "Désinsectisation", "Dératisation", "Traitement anti-termites",
  "Traitement anti-chauves-souris", "Désinfection", "Étanchéité / Toiture",
];

const STATUT_CONFIG = {
  "en cours":  { bg:"#eef1ff", color:"#3a5ab0", border:"0.5px solid #aabae8", label:"En cours" },
  "validé":    { bg:"#fff8f0", color:"#8B6A4E", border:"0.5px solid #e8c9b8", label:"Validé"   },
  "planifié":  { bg:"#e1f5ee", color:"#0e6b50", border:"0.5px solid #a0dece", label:"Planifié" },
  "refusé":    { bg:"#fdecea", color:"#c0392b", border:"0.5px solid #f5c6cb", label:"Refusé"   },
};

const StatutBadge = ({ s }) => {
  const cfg = STATUT_CONFIG[s] || { bg:"#eee", color:"#333", border:"none", label:s };
  return (
    <span style={{
      fontSize:10, fontWeight:600, padding:"3px 10px", borderRadius:20,
      background:cfg.bg, color:cfg.color, border:cfg.border,
      whiteSpace:"nowrap", display:"inline-block",
    }}>{cfg.label}</span>
  );
};

const EMPTY_FORM = {
  clientNom:"", clientPrenom:"", clientSociete:"", clientTel:"", clientEmail:"",
  numDevis:"", type:"", montant:"", adresseIntervention:"", notes:"",
};

const fieldStyle = {
  width:"100%", padding:"9px 12px", fontSize:13,
  border:"0.5px solid #e0ddd8", borderRadius:8,
  background:"white", color:"#1a1a1a", boxSizing:"border-box",
};

export default function DevisModule({ onPlanifier }) {
  const [devis,    setDevis]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState("tous");
  const [view,     setView]     = useState("list");   // "list" | "new" | "detail"
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  /* ── Fetch ────────────────────────────────────────────────────────────── */

  const fetchDevis = useCallback(async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "devis"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setDevis(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch(e) {
      console.error("fetchDevis error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);

  /* ── Stats ────────────────────────────────────────────────────────────── */

  const stats = {
    total:     devis.length,
    enCours:   devis.filter(d => d.statut === "en cours").length,
    valides:   devis.filter(d => d.statut === "validé").length,
    planifies: devis.filter(d => d.statut === "planifié").length,
    refuses:   devis.filter(d => d.statut === "refusé").length,
    caEnCours: devis.filter(d => d.statut === "en cours" || d.statut === "validé")
                    .reduce((s, d) => s + parseFloat(d.montant || 0), 0),
  };

  const filtered = filter === "tous"
    ? devis
    : devis.filter(d => d.statut === filter);

  const aValider = devis.filter(d => d.statut === "validé");

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const createDevis = async () => {
    if (!form.clientNom || !form.type) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "devis"), {
        ...form,
        statut: "en cours",
        createdAt: Timestamp.now(),
      });
      setForm({ ...EMPTY_FORM });
      setView("list");
      await fetchDevis();
    } catch(e) {
      console.error("createDevis error:", e);
      alert("Erreur création : " + (e?.message || JSON.stringify(e)));
    }
    setSaving(false);
  };

  const valider = async (d) => {
    try {
      await updateDoc(doc(db, "devis", d.id), {
        statut: "validé",
        dateValidation: new Date().toLocaleDateString("fr-CA"),
      });
      if (selected?.id === d.id)
        setSelected(s => ({ ...s, statut:"validé", dateValidation:new Date().toLocaleDateString("fr-CA") }));
      await fetchDevis();
    } catch(e) {
      alert("Erreur : " + (e?.message || e));
    }
  };

  const refuser = async (d) => {
    try {
      await updateDoc(doc(db, "devis", d.id), { statut:"refusé" });
      if (selected?.id === d.id) setSelected(s => ({ ...s, statut:"refusé" }));
      await fetchDevis();
    } catch(e) {
      alert("Erreur : " + (e?.message || e));
    }
  };

  const remettreEnCours = async (d) => {
    try {
      await updateDoc(doc(db, "devis", d.id), { statut:"en cours" });
      if (selected?.id === d.id) setSelected(s => ({ ...s, statut:"en cours" }));
      await fetchDevis();
    } catch(e) {
      alert("Erreur : " + (e?.message || e));
    }
  };

  const planifier = async (d) => {
    try {
      await updateDoc(doc(db, "devis", d.id), { statut:"planifié" });
      await fetchDevis();
      if (onPlanifier) onPlanifier(d);
    } catch(e) {
      alert("Erreur : " + (e?.message || e));
    }
  };

  const openDetail = (d) => { setSelected(d); setView("detail"); };

  /* ── Vue : formulaire nouveau devis ──────────────────────────────────── */

  if (view === "new") return (
    <div style={{ padding:20, maxWidth:620 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => { setView("list"); setForm({...EMPTY_FORM}); }}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#35B499", fontWeight:600 }}>
          ← Retour
        </button>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#1a1a1a" }}>Nouveau devis</h2>
      </div>

      <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 12px" }}>Client</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            ["clientNom",    "Nom *",       "text"],
            ["clientPrenom", "Prénom",      "text"],
            ["clientSociete","Société",     "text"],
            ["clientTel",    "Téléphone",   "tel" ],
            ["clientEmail",  "Email",       "email"],
            ["numDevis",     "N° Devis",   "text" ],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>{label}</label>
              <input type={type} value={form[key] || ""}
                onChange={e => setForm(f => ({ ...f, [key]:e.target.value }))}
                style={fieldStyle} />
            </div>
          ))}
          <div style={{ gridColumn:"span 2" }}>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Adresse intervention</label>
            <input value={form.adresseIntervention || ""}
              onChange={e => setForm(f => ({ ...f, adresseIntervention:e.target.value }))}
              style={fieldStyle} />
          </div>
        </div>
      </div>

      <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 12px" }}>Intervention</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ gridColumn:"span 2" }}>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Type *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type:e.target.value }))}
              style={{ ...fieldStyle, padding:"9px 12px" }}>
              <option value="">Choisir…</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Montant TTC (€)</label>
            <input type="number" step="0.01" value={form.montant || ""}
              onChange={e => setForm(f => ({ ...f, montant:e.target.value }))}
              style={fieldStyle} />
          </div>
          <div style={{ gridColumn:"span 2" }}>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Notes / contexte</label>
            <textarea value={form.notes || ""}
              onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} rows={3}
              placeholder="Contexte, demande client, observations…"
              style={{ ...fieldStyle, resize:"vertical" }} />
          </div>
        </div>
      </div>

      <button onClick={createDevis}
        disabled={saving || !form.clientNom || !form.type}
        style={{
          width:"100%", padding:"13px", borderRadius:10, border:"none",
          background:"#35B499", color:"white", cursor:"pointer",
          fontSize:14, fontWeight:700,
          opacity: (!form.clientNom || !form.type) ? 0.4 : 1,
        }}>
        {saving ? "Création…" : "Créer le devis"}
      </button>
    </div>
  );

  /* ── Vue : détail devis ───────────────────────────────────────────────── */

  if (view === "detail" && selected) {
    const cfg = STATUT_CONFIG[selected.statut] || {};
    return (
      <div style={{ padding:20, maxWidth:560 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
          <button onClick={() => { setView("list"); setSelected(null); }}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#35B499", fontWeight:600 }}>
            ← Retour
          </button>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#1a1a1a", flex:1 }}>
            {selected.clientSociete || `${selected.clientNom} ${selected.clientPrenom}`}
          </h2>
          <StatutBadge s={selected.statut} />
        </div>

        {/* Infos */}
        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:12 }}>
          <p style={{ fontSize:10, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 12px" }}>Client</p>
          {[
            ["Nom",     `${selected.clientNom} ${selected.clientPrenom}`],
            ["Société", selected.clientSociete],
            ["Tél.",    selected.clientTel],
            ["Email",   selected.clientEmail],
            ["Adresse", selected.adresseIntervention],
          ].filter(([,v]) => v).map(([label, val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"0.5px solid #f0ede8", fontSize:13 }}>
              <span style={{ color:"#888" }}>{label}</span>
              <b style={{ color:"#1a1a1a", textAlign:"right", maxWidth:"60%" }}>{val}</b>
            </div>
          ))}
        </div>

        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:12 }}>
          <p style={{ fontSize:10, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 12px" }}>Devis</p>
          {[
            ["N° Devis",  selected.numDevis],
            ["Type",      selected.type],
            ["Montant",   selected.montant ? parseFloat(selected.montant).toFixed(2) + " €" : null],
            ["Créé le",   selected.createdAt?.toDate ? selected.createdAt.toDate().toLocaleDateString("fr-FR") : null],
            ["Validé le", selected.dateValidation],
          ].filter(([,v]) => v).map(([label, val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"0.5px solid #f0ede8", fontSize:13 }}>
              <span style={{ color:"#888" }}>{label}</span>
              <b style={{ color: label === "Montant" ? "#35B499" : "#1a1a1a" }}>{val}</b>
            </div>
          ))}
          {selected.notes && (
            <div style={{ marginTop:10, padding:"10px 0", fontSize:13, color:"#555", lineHeight:1.6 }}>
              <span style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Notes</span>
              {selected.notes}
            </div>
          )}
        </div>

        {/* Actions selon statut */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {selected.statut === "en cours" && (
            <>
              <button onClick={() => valider(selected)}
                style={{ flex:1, padding:"11px", borderRadius:9, border:"none", background:"#35B499", color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                ✓ Marquer validé
              </button>
              <button onClick={() => refuser(selected)}
                style={{ padding:"11px 16px", borderRadius:9, border:"0.5px solid #f5c6cb", background:"#fdecea", color:"#c0392b", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                ✕ Refuser
              </button>
            </>
          )}
          {selected.statut === "validé" && (
            <>
              <button onClick={() => planifier(selected)}
                style={{ flex:1, padding:"11px", borderRadius:9, border:"none", background:"#35B499", color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                📅 Planifier l'intervention
              </button>
              <button onClick={() => remettreEnCours(selected)}
                style={{ padding:"11px 14px", borderRadius:9, border:"0.5px solid #e0ddd8", background:"transparent", color:"#888", cursor:"pointer", fontSize:12 }}>
                ← En cours
              </button>
            </>
          )}
          {selected.statut === "refusé" && (
            <button onClick={() => remettreEnCours(selected)}
              style={{ padding:"11px 16px", borderRadius:9, border:"0.5px solid #e0ddd8", background:"transparent", color:"#888", cursor:"pointer", fontSize:12 }}>
              ← Remettre en cours
            </button>
          )}
          {selected.statut === "planifié" && (
            <p style={{ color:"#35B499", fontSize:13, fontWeight:600, margin:0, padding:"8px 0" }}>
              ✅ Intervention planifiée
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── Vue : liste ──────────────────────────────────────────────────────── */

  return (
    <div style={{ padding:20 }}>

      {/* Alerte devis validés */}
      {aValider.length > 0 && (
        <div style={{
          background:"#fff8f0", border:"0.5px solid #e8c9b8",
          borderRadius:10, padding:"12px 16px", marginBottom:16,
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:"#6b4a31", margin:0 }}>
              {aValider.length} devis validé{aValider.length > 1 ? "s" : ""} en attente de planification
            </p>
            <p style={{ fontSize:11, color:"#8B6A4E", margin:"2px 0 0" }}>
              Ouvre le devis et clique "Planifier l'intervention" pour créer le bon correspondant.
            </p>
          </div>
          <button onClick={() => setFilter("validé")}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", background:"#8B6A4E", color:"white", cursor:"pointer", fontSize:12, fontWeight:600, flexShrink:0 }}>
            Voir →
          </button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Total",     val:stats.total,     accent:"#b4b2a9" },
          { label:"En cours",  val:stats.enCours,   accent:"#3a5ab0" },
          { label:"Validés",   val:stats.valides,   accent:"#8B6A4E" },
          { label:"Planifiés", val:stats.planifies, accent:"#35B499" },
          { label:"Refusés",   val:stats.refuses,   accent:"#c0392b" },
        ].map(({ label, val, accent }) => (
          <div key={label} onClick={() => setFilter(label === "Total" ? "tous" : label.toLowerCase().replace("és","é").replace("és","é"))}
            style={{
              background:"white", borderRadius:10, padding:"13px 15px",
              border:"0.5px solid #e0ddd8", position:"relative", overflow:"hidden",
              cursor:"pointer", transition:"box-shadow .15s",
            }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent }} />
            <p style={{ fontSize:"9.5px", color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 5px", fontWeight:500 }}>{label}</p>
            <p style={{ fontSize:22, fontWeight:700, color:"#1a1a1a", letterSpacing:"-0.5px", margin:0 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filtres + Nouveau */}
      <div style={{ display:"flex", gap:6, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
        {[
          ["tous",      "Tous"],
          ["en cours",  "En cours"],
          ["validé",    "Validés"],
          ["planifié",  "Planifiés"],
          ["refusé",    "Refusés"],
        ].map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20,
            border: filter === f ? "none" : "0.5px solid #e0ddd8",
            cursor:"pointer", fontSize:12, fontWeight: filter === f ? 600 : 400,
            background: filter === f ? "#35B499" : "white",
            color: filter === f ? "white" : "#555",
          }}>{l}</button>
        ))}
        <button onClick={() => setView("new")} style={{
          marginLeft:"auto", padding:"8px 16px", borderRadius:8, border:"none",
          background:"#35B499", color:"white", cursor:"pointer", fontSize:12, fontWeight:700,
        }}>+ Nouveau devis</button>
      </div>

      {/* Tableau */}
      {loading ? (
        <p style={{ textAlign:"center", color:"#aaa", padding:"3rem 0" }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:"32px", textAlign:"center", color:"#aaa", fontSize:13 }}>
          {filter === "tous" ? "Aucun devis pour l'instant." : `Aucun devis "${filter}".`}
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", overflow:"hidden" }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:620 }}>
              <thead>
                <tr style={{ borderBottom:"0.5px solid #e8e5e0" }}>
                  {["Client", "N° Devis", "Type", "Montant", "Date", "Statut", ""].map(h => (
                    <th key={h} style={{
                      textAlign:"left", fontSize:"9.5px", fontWeight:500, color:"#888",
                      textTransform:"uppercase", letterSpacing:"0.8px",
                      padding:"8px 12px", whiteSpace:"nowrap", background:"white",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} onClick={() => openDetail(d)}
                    style={{ borderBottom:"0.5px solid #f0ede8", cursor:"pointer" }}>
                    <td style={{ padding:"10px 12px" }}>
                      {d.clientSociete && (
                        <span style={{ display:"block", fontSize:10, color:"#35B499", fontWeight:600 }}>{d.clientSociete}</span>
                      )}
                      <span style={{ fontWeight:500 }}>{d.clientNom} {d.clientPrenom}</span>
                      {d.clientTel && (
                        <span style={{ display:"block", fontSize:10, color:"#888" }}>{d.clientTel}</span>
                      )}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:11, color:"#888" }}>
                      {d.numDevis || "—"}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:11, color:"#555", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {d.type}
                    </td>
                    <td style={{ padding:"10px 12px", fontWeight:600, whiteSpace:"nowrap", color: d.montant ? "#35B499" : "#ccc" }}>
                      {d.montant ? parseFloat(d.montant).toFixed(2) + " €" : "—"}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:11, color:"#888", whiteSpace:"nowrap" }}>
                      {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString("fr-FR") : "—"}
                      {d.dateValidation && (
                        <span style={{ display:"block", color:"#8B6A4E", fontSize:10 }}>
                          Validé {d.dateValidation}
                        </span>
                      )}
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <StatutBadge s={d.statut} />
                    </td>
                    <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}
                      onClick={e => e.stopPropagation()}>
                      {d.statut === "en cours" && (
                        <button onClick={() => valider(d)} style={{
                          fontSize:10, padding:"4px 10px", borderRadius:6, border:"0.5px solid #a0dece",
                          background:"#e1f5ee", color:"#0e6b50", cursor:"pointer", fontWeight:600, marginRight:4,
                        }}>✓</button>
                      )}
                      {d.statut === "validé" && (
                        <button onClick={() => planifier(d)} style={{
                          fontSize:10, padding:"4px 10px", borderRadius:6, border:"none",
                          background:"#35B499", color:"white", cursor:"pointer", fontWeight:700,
                        }}>Planifier →</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
