import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp, orderBy, query,
} from "firebase/firestore";

const TYPES = [
  "Désinsectisation", "Dératisation", "Traitement anti-termites",
  "Traitement anti-chauves-souris", "Désinfection", "Étanchéité / Toiture",
];

const SOURCES = ["Téléphone", "WhatsApp", "Email", "Sur place", "Site web", "Autre"];

const STATUT_CONFIG = {
  "demande": { bg:"#f0eeff", color:"#5c35b4", border:"0.5px solid #c5b8f0", label:"Demande" },
  "validé":  { bg:"#fff8f0", color:"#8B6A4E", border:"0.5px solid #e8c9b8", label:"Validé"  },
  "planifié":{ bg:"#e1f5ee", color:"#0e6b50", border:"0.5px solid #a0dece", label:"Planifié"},
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
  clientNom:"", clientSociete:"", clientTel:"",
  type:"", source:"Téléphone", numDevis:"", notes:"",
};

const fieldStyle = {
  width:"100%", padding:"9px 12px", fontSize:13,
  border:"0.5px solid #e0ddd8", borderRadius:8,
  background:"white", color:"#1a1a1a", boxSizing:"border-box",
};

const envoieWA = (d) => {
  const date = d.createdAt?.toDate
    ? d.createdAt.toDate().toLocaleDateString("fr-FR")
    : new Date().toLocaleDateString("fr-FR");
  const msg = [
    "🌿 *Nouvelle demande de devis*",
    "",
    `👤 ${[d.clientSociete, d.clientNom].filter(Boolean).join(" — ")}${d.clientTel ? " — " + d.clientTel : ""}`,
    `🔧 ${d.type}`,
    `📞 Source : ${d.source || "—"}`,
    d.notes ? `📝 "${d.notes}"` : null,
    "",
    `Reçu le ${date}`,
  ].filter(l => l !== null).join("\n");
  window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
};

export default function DevisModule({ onPlanifier }) {
  const [devis,    setDevis]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState("tous");
  const [view,     setView]     = useState("list");
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState({ ...EMPTY_FORM });

  /* ── Fetch ────────────────────────────────────────────────────────────── */

  const fetchDevis = useCallback(async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "devis"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setDevis(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch(e) { console.error("fetchDevis:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);

  /* ── Stats ────────────────────────────────────────────────────────────── */

  const stats = {
    demandes:  devis.filter(d => d.statut === "demande").length,
    valides:   devis.filter(d => d.statut === "validé").length,
    planifies: devis.filter(d => d.statut === "planifié").length,
  };

  const filtered = filter === "tous"
    ? devis
    : devis.filter(d => d.statut === filter);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const createDevis = async () => {
    if (!form.clientNom && !form.clientSociete) return;
    if (!form.type) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "devis"), {
        ...form, statut:"demande", createdAt: Timestamp.now(),
      });
      setForm({ ...EMPTY_FORM });
      setView("list");
      await fetchDevis();
    } catch(e) {
      console.error("createDevis:", e);
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
        setSelected(s => ({ ...s, statut:"validé", dateValidation: new Date().toLocaleDateString("fr-CA") }));
      await fetchDevis();
    } catch(e) { alert("Erreur : " + (e?.message || e)); }
  };

  const remettreEnDemande = async (d) => {
    try {
      await updateDoc(doc(db, "devis", d.id), { statut:"demande" });
      if (selected?.id === d.id) setSelected(s => ({ ...s, statut:"demande" }));
      await fetchDevis();
    } catch(e) { alert("Erreur : " + (e?.message || e)); }
  };

  const planifier = async (d) => {
    try {
      await updateDoc(doc(db, "devis", d.id), { statut:"planifié" });
      await fetchDevis();
      if (onPlanifier) onPlanifier(d);
    } catch(e) { alert("Erreur : " + (e?.message || e)); }
  };

  const openDetail = (d) => { setSelected(d); setView("detail"); };

  /* ── Vue : formulaire nouvelle demande ───────────────────────────────── */

  if (view === "new") return (
    <div style={{ padding:20, maxWidth:520 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => { setView("list"); setForm({...EMPTY_FORM}); }}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#35B499", fontWeight:600 }}>
          ← Retour
        </button>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#1a1a1a" }}>Nouvelle demande</h2>
      </div>

      <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 12px" }}>Contact</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Nom *</label>
            <input value={form.clientNom} onChange={e => setForm(f => ({...f, clientNom:e.target.value}))} style={fieldStyle}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Société</label>
            <input value={form.clientSociete} onChange={e => setForm(f => ({...f, clientSociete:e.target.value}))} style={fieldStyle}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Téléphone</label>
            <input type="tel" value={form.clientTel} onChange={e => setForm(f => ({...f, clientTel:e.target.value}))} style={fieldStyle}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Source</label>
            <select value={form.source} onChange={e => setForm(f => ({...f, source:e.target.value}))}
              style={{ ...fieldStyle, padding:"9px 12px" }}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 12px" }}>Demande</p>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Type d'intervention *</label>
          <select value={form.type} onChange={e => setForm(f => ({...f, type:e.target.value}))}
            style={{ ...fieldStyle, padding:"9px 12px" }}>
            <option value="">Choisir…</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} rows={3}
            placeholder="Ce qui a été dit, contexte, urgence…"
            style={{ ...fieldStyle, resize:"vertical" }}/>
        </div>
      </div>

      <button onClick={createDevis}
        disabled={saving || (!form.clientNom && !form.clientSociete) || !form.type}
        style={{
          width:"100%", padding:"13px", borderRadius:10, border:"none",
          background:"#35B499", color:"white", cursor:"pointer",
          fontSize:14, fontWeight:700,
          opacity:((!form.clientNom && !form.clientSociete) || !form.type) ? 0.4 : 1,
        }}>
        {saving ? "Enregistrement…" : "Enregistrer la demande"}
      </button>
    </div>
  );

  /* ── Vue : détail ─────────────────────────────────────────────────────── */

  if (view === "detail" && selected) return (
    <div style={{ padding:20, maxWidth:500 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <button onClick={() => { setView("list"); setSelected(null); }}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#35B499", fontWeight:600 }}>
          ← Retour
        </button>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#1a1a1a", flex:1 }}>
          {selected.clientSociete || selected.clientNom}
        </h2>
        <StatutBadge s={selected.statut}/>
      </div>

      <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:12 }}>
        {[
          ["Nom",        `${selected.clientNom}${selected.clientSociete ? " — " + selected.clientSociete : ""}`],
          ["Téléphone",  selected.clientTel],
          ["Source",     selected.source],
          ["Type",       selected.type],
          ["N° MediaBat",selected.numDevis],
          ["Reçu le",    selected.createdAt?.toDate ? selected.createdAt.toDate().toLocaleDateString("fr-FR") : null],
          ["Validé le",  selected.dateValidation],
        ].filter(([,v]) => v).map(([label, val]) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid #f0ede8", fontSize:13 }}>
            <span style={{ color:"#888", flexShrink:0 }}>{label}</span>
            <b style={{ color:"#1a1a1a", textAlign:"right", marginLeft:12 }}>{val}</b>
          </div>
        ))}
        {selected.notes && (
          <div style={{ marginTop:10, fontSize:13, color:"#555", lineHeight:1.6 }}>
            <span style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Notes</span>
            {selected.notes}
          </div>
        )}
      </div>

      {/* Champ N° devis MediaBat — éditable si validé */}
      {selected.statut === "validé" && (
        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:16, marginBottom:12 }}>
          <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:6 }}>N° devis MediaBat</label>
          <input
            value={selected.numDevis || ""}
            onChange={async e => {
              const val = e.target.value;
              setSelected(s => ({ ...s, numDevis:val }));
              await updateDoc(doc(db, "devis", selected.id), { numDevis:val });
            }}
            placeholder="Référence du devis MediaBat"
            style={fieldStyle}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {selected.statut === "demande" && (
          <>
            <button onClick={() => envoieWA(selected)} style={{
              flex:1, padding:"11px", borderRadius:9,
              border:"0.5px solid #a0d8b0", background:"#e8f9ee",
              color:"#1a7a45", cursor:"pointer", fontSize:13, fontWeight:700,
            }}>
              📲 Envoyer au responsable
            </button>
            <button onClick={() => valider(selected)} style={{
              flex:1, padding:"11px", borderRadius:9, border:"none",
              background:"#35B499", color:"white", cursor:"pointer", fontSize:13, fontWeight:700,
            }}>
              ✓ Marquer validé
            </button>
          </>
        )}
        {selected.statut === "validé" && (
          <>
            <button onClick={() => planifier(selected)} style={{
              flex:1, padding:"11px", borderRadius:9, border:"none",
              background:"#35B499", color:"white", cursor:"pointer", fontSize:13, fontWeight:700,
            }}>
              📅 Planifier l'intervention
            </button>
            <button onClick={() => remettreEnDemande(selected)} style={{
              padding:"11px 14px", borderRadius:9, border:"0.5px solid #e0ddd8",
              background:"transparent", color:"#aaa", cursor:"pointer", fontSize:12,
            }}>
              ← Demande
            </button>
          </>
        )}
        {selected.statut === "planifié" && (
          <p style={{ color:"#35B499", fontSize:13, fontWeight:700, margin:0, padding:"8px 0" }}>
            ✅ Intervention planifiée
          </p>
        )}
      </div>
    </div>
  );

  /* ── Vue : liste ──────────────────────────────────────────────────────── */

  return (
    <div style={{ padding:20 }}>

      {/* Alerte validés en attente */}
      {stats.valides > 0 && (
        <div style={{
          background:"#fff8f0", border:"0.5px solid #e8c9b8",
          borderRadius:10, padding:"12px 16px", marginBottom:16,
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:"#6b4a31", margin:0 }}>
              {stats.valides} devis validé{stats.valides > 1 ? "s" : ""} à planifier
            </p>
            <p style={{ fontSize:11, color:"#8B6A4E", margin:"2px 0 0" }}>
              Ouvre le devis et clique "Planifier l'intervention".
            </p>
          </div>
          <button onClick={() => setFilter("validé")} style={{
            padding:"8px 14px", borderRadius:8, border:"none",
            background:"#8B6A4E", color:"white", cursor:"pointer",
            fontSize:12, fontWeight:600, flexShrink:0,
          }}>Voir →</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Demandes",  val:stats.demandes,  accent:"#5c35b4", f:"demande"  },
          { label:"Validés",   val:stats.valides,   accent:"#8B6A4E", f:"validé"   },
          { label:"Planifiés", val:stats.planifies, accent:"#35B499", f:"planifié" },
        ].map(({ label, val, accent, f }) => (
          <div key={label} onClick={() => setFilter(f)} style={{
            background:"white", borderRadius:10, padding:"13px 15px",
            border: filter === f ? `1.5px solid ${accent}` : "0.5px solid #e0ddd8",
            position:"relative", overflow:"hidden", cursor:"pointer",
          }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent }}/>
            <p style={{ fontSize:"9.5px", color:"#888", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 5px", fontWeight:500 }}>{label}</p>
            <p style={{ fontSize:22, fontWeight:700, color:"#1a1a1a", letterSpacing:"-0.5px", margin:0 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filtres + Nouveau */}
      <div style={{ display:"flex", gap:6, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
        {[["tous","Tous"],["demande","Demandes"],["validé","Validés"],["planifié","Planifiés"]].map(([f,l]) => (
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
        }}>+ Nouvelle demande</button>
      </div>

      {/* Tableau */}
      {loading ? (
        <p style={{ textAlign:"center", color:"#aaa", padding:"3rem 0" }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", padding:"32px", textAlign:"center", color:"#aaa", fontSize:13 }}>
          Aucune entrée pour ce filtre.
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:10, border:"0.5px solid #e0ddd8", overflow:"hidden" }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:500 }}>
              <thead>
                <tr style={{ borderBottom:"0.5px solid #e8e5e0" }}>
                  {["Contact","Type","Source","Statut",""].map(h => (
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
                      <span style={{ fontWeight:500 }}>{d.clientNom}</span>
                      {d.clientTel && (
                        <span style={{ display:"block", fontSize:10, color:"#888" }}>{d.clientTel}</span>
                      )}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:11, color:"#555", maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {d.type}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:11, color:"#888" }}>
                      {d.source || "—"}
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <StatutBadge s={d.statut}/>
                    </td>
                    <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}
                      onClick={e => e.stopPropagation()}>
                      {d.statut === "demande" && (
                        <button onClick={() => envoieWA(d)} style={{
                          fontSize:10, padding:"4px 9px", borderRadius:6,
                          border:"0.5px solid #a0d8b0", background:"#e8f9ee",
                          color:"#1a7a45", cursor:"pointer", fontWeight:600,
                        }}>📲 WA</button>
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
