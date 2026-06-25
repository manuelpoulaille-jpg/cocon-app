import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
} from "firebase/firestore";

const TYPES = [
  "Désinsectisation","Dératisation","Traitement anti-termites",
  "Traitement anti-chauves-souris","Désinfection","Étanchéité / Toiture",
];

const EMPTY_DEVIS = {
  clientNom:"", clientPrenom:"", clientSociete:"", clientTel:"", clientEmail:"",
  numDevis:"", type:"", montant:"", adresseIntervention:"", notes:"",
};

const inp = {
  width:"100%", padding:"7px 10px", fontSize:12,
  border:"0.5px solid var(--color-border-tertiary)",
  borderRadius:7,
  background:"var(--color-background-primary)",
  color:"var(--color-text-primary)",
  boxSizing:"border-box",
};

export default function DevisEncart({ onPlanifier }) {
  const [devis,    setDevis]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ ...EMPTY_DEVIS });
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  const fetchDevis = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "devis"));
      setDevis(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const createDevis = async () => {
    if (!form.clientNom || !form.type) return;
    setSaving(true);
    await addDoc(collection(db, "devis"), {
      ...form, statut:"en cours", createdAt: Timestamp.now(),
    });
    setForm({ ...EMPTY_DEVIS });
    setShowForm(false);
    await fetchDevis();
    setSaving(false);
  };

  const valider = async (d) => {
    await updateDoc(doc(db, "devis", d.id), {
      statut: "validé",
      dateValidation: new Date().toLocaleDateString("fr-CA"),
    });
    await fetchDevis();
  };

  const refuser = async (d) => {
    await updateDoc(doc(db, "devis", d.id), { statut:"refusé" });
    await fetchDevis();
  };

  const planifier = async (d) => {
    await updateDoc(doc(db, "devis", d.id), { statut:"planifié" });
    await fetchDevis();
    if (onPlanifier) onPlanifier(d);
  };

  /* ── Données dérivées ─────────────────────────────────────────────────── */

  const actifs   = devis.filter(d => d.statut !== "refusé" && d.statut !== "planifié");
  const aValider = actifs.filter(d => d.statut === "validé");
  const enCours  = actifs.filter(d => d.statut === "en cours");

  /* ── Rendu ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ padding:"16px 16px 0" }}>

      {/* ── Devis validés – à planifier ── */}
      {aValider.length > 0 && (
        <div style={{
          background:"#fff8f0", border:"0.5px solid #e8c9b8",
          borderRadius:10, padding:"12px 14px", marginBottom:12,
        }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <span style={{ width:8,height:8,borderRadius:"50%",background:"#8B6A4E",display:"inline-block",flexShrink:0 }}/>
            <span style={{ fontSize:12,fontWeight:700,color:"#6b4a31" }}>Devis validés — à planifier</span>
            <span style={{
              marginLeft:"auto", background:"#8B6A4E", color:"white",
              fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:20,
            }}>{aValider.length}</span>
          </div>

          {aValider.map(d => (
            <div key={d.id} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"9px 0", borderBottom:"0.5px solid rgba(139,106,78,0.15)",
            }}>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:13,fontWeight:600,color:"#1a1a1a",marginBottom:2,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {d.clientSociete || `${d.clientNom} ${d.clientPrenom}`}
                </p>
                <p style={{ fontSize:11,color:"#888",marginBottom:0 }}>
                  {d.type}
                  {d.numDevis  ? " · "+d.numDevis  : ""}
                  {d.montant   ? " · "+parseFloat(d.montant).toFixed(2)+" €" : ""}
                </p>
                {d.dateValidation && (
                  <p style={{ fontSize:10,color:"#8B6A4E",marginTop:2 }}>
                    Validé le {d.dateValidation}
                  </p>
                )}
              </div>
              <button onClick={() => planifier(d)} style={{
                flexShrink:0, padding:"7px 13px", borderRadius:8, border:"none",
                background:"#35B499", color:"white", cursor:"pointer",
                fontSize:12, fontWeight:700,
              }}>
                Planifier →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Devis en cours ── */}
      {!loading && enCours.length > 0 && (
        <div style={{
          background:"var(--color-background-primary)",
          border:"0.5px solid var(--color-border-tertiary)",
          borderRadius:10, padding:"12px 14px", marginBottom:12,
        }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <span style={{ width:8,height:8,borderRadius:"50%",background:"#5C8EE8",display:"inline-block",flexShrink:0 }}/>
            <span style={{ fontSize:12,fontWeight:600,color:"var(--color-text-primary)" }}>Devis en cours</span>
            <span style={{ marginLeft:"auto",fontSize:10,color:"var(--color-text-secondary)" }}>
              {enCours.length} en attente de réponse
            </span>
          </div>

          {enCours.map(d => (
            <div key={d.id} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"9px 0", borderBottom:"0.5px solid var(--color-border-tertiary)",
            }}>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:13,fontWeight:500,color:"var(--color-text-primary)",marginBottom:2,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {d.clientSociete || `${d.clientNom} ${d.clientPrenom}`}
                </p>
                <p style={{ fontSize:11,color:"var(--color-text-secondary)",marginBottom:0 }}>
                  {d.type}
                  {d.numDevis ? " · "+d.numDevis : ""}
                  {d.montant  ? " · "+parseFloat(d.montant).toFixed(2)+" €" : ""}
                </p>
              </div>
              <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                <button onClick={() => valider(d)} style={{
                  padding:"5px 10px", borderRadius:7, border:"0.5px solid #a0dece",
                  background:"#e1f5ee", color:"#0e6b50", cursor:"pointer",
                  fontSize:11, fontWeight:600,
                }}>✓ Validé</button>
                <button onClick={() => refuser(d)} style={{
                  padding:"5px 10px", borderRadius:7, border:"0.5px solid #f5c6cb",
                  background:"#fdecea", color:"#c0392b", cursor:"pointer", fontSize:11,
                }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bouton / Formulaire nouveau devis ── */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{
          width:"100%", padding:"10px", borderRadius:8,
          border:"0.5px dashed var(--color-border-tertiary)",
          background:"transparent", cursor:"pointer",
          fontSize:12, color:"var(--color-text-secondary)", marginBottom:14,
        }}>
          + Nouveau devis
        </button>
      ) : (
        <div style={{
          background:"var(--color-background-primary)",
          border:"0.5px solid var(--color-border-tertiary)",
          borderRadius:10, padding:14, marginBottom:14,
        }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
            <span style={{ fontSize:13,fontWeight:700,color:"var(--color-text-primary)" }}>Nouveau devis</span>
            <button onClick={() => { setShowForm(false); setForm({...EMPTY_DEVIS}); }} style={{
              background:"none", border:"none", cursor:"pointer", fontSize:18,
              color:"var(--color-text-secondary)", lineHeight:1,
            }}>✕</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              ["clientNom",   "Nom *",       "text",   false],
              ["clientPrenom","Prénom",       "text",   false],
              ["clientSociete","Société",     "text",   false],
              ["clientTel",   "Téléphone",   "tel",    false],
              ["clientEmail", "Email",       "email",  false],
              ["numDevis",    "N° Devis",    "text",   false],
              ["montant",     "Montant TTC (€)","number",false],
              ["adresseIntervention","Adresse intervention","text",true],
            ].map(([key,label,type,full]) => (
              <div key={key} style={{ gridColumn:full?"span 2":"span 1" }}>
                <label style={{ fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:3 }}>
                  {label}
                </label>
                <input type={type} value={form[key]||""}
                  onChange={e => setForm(f => ({...f,[key]:e.target.value}))}
                  style={inp}/>
              </div>
            ))}
          </div>

          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:3 }}>
              Type d'intervention *
            </label>
            <select value={form.type} onChange={e => setForm(f => ({...f,type:e.target.value}))}
              style={{...inp,padding:"8px 10px"}}>
              <option value="">Choisir…</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:3 }}>
              Notes / contexte
            </label>
            <textarea value={form.notes||""}
              onChange={e => setForm(f => ({...f,notes:e.target.value}))} rows={2}
              placeholder="Contexte, observations particulières…"
              style={{...inp,resize:"none"}}/>
          </div>

          <div style={{ display:"flex",gap:8,marginTop:14 }}>
            <button onClick={() => { setShowForm(false); setForm({...EMPTY_DEVIS}); }} style={{
              flex:1, padding:"9px", borderRadius:8,
              border:"0.5px solid var(--color-border-tertiary)",
              background:"transparent", cursor:"pointer",
              fontSize:12, color:"var(--color-text-secondary)",
            }}>Annuler</button>
            <button onClick={createDevis}
              disabled={saving || !form.clientNom || !form.type}
              style={{
                flex:1, padding:"9px", borderRadius:8, border:"none",
                background:"#35B499", color:"white", cursor:"pointer",
                fontSize:12, fontWeight:700,
                opacity:(!form.clientNom||!form.type)?0.4:1,
              }}>
              {saving ? "Création…" : "Créer le devis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
