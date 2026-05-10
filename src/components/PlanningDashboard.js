import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, deleteDoc, doc, Timestamp,
} from "firebase/firestore";

const TECH_COLORS_MAP = {
  "Dimitri": "#35B499",
  "Georges": "#E8845C",
  "Equipe":  "#5C8EE8",
};
const TECH_COLORS_ARRAY = ["#35B499","#E8845C","#5C8EE8","#E85C9A","#8E5CE8","#C8A84B"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h → 18h
const TYPES_INTERVENTION = [
  "Dératisation","Désinsectisation","Désinfection",
  "Anti-termites","Anti-chauves-souris","Étanchéité","Rénovation toiture","Autre",
];
const TECHS_DEFAULT = ["Dimitri","Georges","Equipe"];
const CELL_HEIGHT = 68;

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d.toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });

const getWeekDays = () => {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Martinique" })
  );
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

// Extrait la ville après le code postal 972XX (ex: "97200 Fort-de-France" → "Fort-de-France")
const extractVille = (adresse) => {
  if (!adresse) return "";
  const match = adresse.match(/972\d{2}\s+([^,\n]+)/i);
  return match ? match[1].trim() : "";
};

const statutBg = (s) =>
  ({ planifié:"#d4f0ea","en cours":"#fff0e0",terminé:"#35B499" }[s] || "#eee");
const statutFg = (s) =>
  ({ planifié:"#1a7a65","en cours":"#7a4010",terminé:"white" }[s] || "#333");

// ── Composant ─────────────────────────────────────────────────────────────────

export default function PlanningDashboard({ user, isAdmin: isAdminProp }) {
  const isAdmin = isAdminProp !== undefined ? isAdminProp : user?.role === "admin";

  const [weekDays]      = useState(getWeekDays());
  const [bons,setBons]  = useState([]);
  const [indispos,setIndispos] = useState([]);
  const [techColors,setTechColors] = useState({...TECH_COLORS_MAP});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving]   = useState(false);

  // Formulaire création
  const [formStep,setFormStep] = useState(null); // null | 1 | 2
  const [form,setForm]         = useState({});

  // Formulaire indispo
  const [indispoFormOpen,setIndispoFormOpen] = useState(false);
  const [indispoData,setIndispoData] = useState({
    techNom:"",dateDebut:"",dateFin:"",motif:"Congé",
  });

  useEffect(() => { fetchData(); }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    const weekStart = fmtDate(weekDays[0]);
    const weekEnd   = fmtDate(weekDays[6]);
    try {
      const bonsSnap = await getDocs(collection(db,"bons"));
      const allBons  = bonsSnap.docs.map(d => ({ id:d.id,...d.data() }));
      const weekBons = allBons.filter(b => b.datePrevue >= weekStart && b.datePrevue <= weekEnd);
      setBons(weekBons);

      const names = [...new Set(weekBons.map(b => b.techNom).filter(Boolean))];
      const colors = { ...TECH_COLORS_MAP };
      names.forEach((name,i) => {
        if (!colors[name]) colors[name] = TECH_COLORS_ARRAY[i % TECH_COLORS_ARRAY.length];
      });
      setTechColors(colors);

      const indisposSnap = await getDocs(collection(db,"indispos"));
      setIndispos(indisposSnap.docs.map(d => ({ id:d.id,...d.data() })));
    } catch(e) {
      console.error("Planning fetchData error:", e);
    }
    setLoading(false);
  };

  // ── Données dérivées ───────────────────────────────────────────────────────

  const techList = [
    ...new Set([...TECHS_DEFAULT, ...bons.map(b => b.techNom).filter(Boolean)])
  ];

  const getBonsForSlot = (day, hour) => {
    const dateStr = fmtDate(day);
    return bons.filter(b => {
      if (b.datePrevue !== dateStr) return false;
      const h = parseInt((b.heurePrevue || "0:00").split(":")[0]);
      return h === hour;
    });
  };

  const isToday = (day) => fmtDate(day) === fmtDate(new Date());

  const isDayIndispo = (dateStr) =>
    indispos.some(i => i.dateDebut <= dateStr && i.dateFin >= dateStr);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCellClick = (dateStr, hour) => {
    if (!isAdmin) return;
    const hStr = `${String(hour).padStart(2,"0")}:00`;
    setForm({ datePrevue:dateStr, heurePrevue:hStr });
    setFormStep(1);
  };

  const createBon = async () => {
    if (!form.clientNom || !form.adresseIntervention) return;
    setSaving(true);
    try {
      const ref = "INT-" + Date.now().toString().slice(-6);
      await addDoc(collection(db,"bons"), {
        ref,
        clientSociete:        form.clientSociete || "",
        clientNom:            form.clientNom || "",
        clientPrenom:         form.clientPrenom || "",
        clientTel:            form.clientTel || "",
        clientEmail:          form.clientEmail || "",
        adresseFacturation:   form.adresseFacturation || "",
        adresseIntervention:  form.adresseIntervention || "",
        clientAdresse:        form.adresseIntervention || "",
        demandeClient:        form.demandeClient || "",
        numDevis:             form.numDevis || "",
        signataire:           form.signataire || "",
        types:                [form.type],
        type:                 form.type,
        datePrevue:           form.datePrevue,
        heurePrevue:          form.heurePrevue,
        techNom:              form.techNom,
        techId:               "",
        statut:               "planifié",
        createdAt:            Timestamp.now(),
        heureArrivee:         null,
        heureFin:             null,
        obsCocon:             "",
        obsClient:            "",
        signatureTech:        null,
        signatureClient:      null,
        emailEnvoye:          false,
        montantFacture:       form.montantFacture ? parseFloat(form.montantFacture) : null,
        numVisite:            form.numVisite || "1",
      });
      setFormStep(null);
      setForm({});
      await fetchData();
    } catch(e) {
      console.error("Erreur création bon:", e);
    }
    setSaving(false);
  };

  const createIndispo = async () => {
    if (!indispoData.techNom || !indispoData.dateDebut || !indispoData.dateFin) return;
    setSaving(true);
    try {
      await addDoc(collection(db,"indispos"), indispoData);
      setIndispoFormOpen(false);
      setIndispoData({ techNom:"",dateDebut:"",dateFin:"",motif:"Congé" });
      await fetchData();
    } catch(e) {}
    setSaving(false);
  };

  const deleteIndispo = async (id) => {
    try { await deleteDoc(doc(db,"indispos",id)); await fetchData(); } catch(e) {}
  };

  // ── Style partagé ──────────────────────────────────────────────────────────

  const selectStyle = {
    width:"100%", padding:"10px 12px", fontSize:14,
    border:"0.5px solid var(--color-border-tertiary)", borderRadius:8,
    background:"var(--color-background-primary)", color:"var(--color-text-primary)",
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Formulaire étape 1 — Créneau
  // ══════════════════════════════════════════════════════════════════════════

  if (formStep === 1) {
    const dateLabel = new Date(form.datePrevue + "T12:00:00").toLocaleDateString("fr-FR",{
      weekday:"long",day:"numeric",month:"long",
    });
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => { setFormStep(null); setForm({}); }}>← Retour</button>
          <h2>Nouvelle intervention</h2>
          <span style={{fontSize:11,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",padding:"3px 10px",borderRadius:20}}>Étape 1 / 2</span>
        </div>

        <div style={{background:"#35B499",color:"white",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,marginBottom:16,textTransform:"capitalize"}}>
          📅 {dateLabel}
        </div>

        <div className="card">
          <div className="card-title">Créneau &amp; intervention</div>
          <div className="field">
            <label>Heure prévue</label>
            <input type="time" value={form.heurePrevue || ""} onChange={e => setForm(f => ({...f,heurePrevue:e.target.value}))} />
          </div>
          <div className="field">
            <label>Collaborateur *</label>
            <select style={selectStyle} value={form.techNom || ""} onChange={e => setForm(f => ({...f,techNom:e.target.value}))}>
              <option value="">Choisir…</option>
              {techList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Type d'intervention *</label>
            <select style={selectStyle} value={form.type || ""} onChange={e => setForm(f => ({...f,type:e.target.value}))}>
              <option value="">Choisir un type…</option>
              {TYPES_INTERVENTION.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button className="btn-primary" style={{width:"100%",opacity:(!form.techNom||!form.type)?0.4:1}}
          disabled={!form.techNom||!form.type} onClick={() => setFormStep(2)}>
          Suivant — Informations client →
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Formulaire étape 2 — Client & Bon complet
  // ══════════════════════════════════════════════════════════════════════════

  if (formStep === 2) {
    const canSubmit = form.clientNom && form.adresseIntervention;
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setFormStep(1)}>← Étape 1</button>
          <h2>Informations client</h2>
          <span style={{fontSize:11,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",padding:"3px 10px",borderRadius:20}}>Étape 2 / 2</span>
        </div>

        {/* Récap étape 1 */}
        <div className="card readonly" style={{marginBottom:12}}>
          <div className="card-title">Récapitulatif <span className="locked-badge">🔒 Étape 1</span></div>
          <div className="info-row"><span>Date</span><b>{form.datePrevue} à {form.heurePrevue}</b></div>
          <div className="info-row"><span>Type</span><b>{form.type}</b></div>
          <div className="info-row"><span>Collaborateur</span><b>{form.techNom}</b></div>
        </div>

        {/* Client */}
        <div className="card">
          <div className="card-title">Client</div>
          <div className="field"><label>Société (optionnel)</label>
            <input value={form.clientSociete||""} onChange={e=>setForm(f=>({...f,clientSociete:e.target.value}))} />
          </div>
          <div className="row2">
            <div className="field"><label>Nom *</label>
              <input value={form.clientNom||""} onChange={e=>setForm(f=>({...f,clientNom:e.target.value}))} />
            </div>
            <div className="field"><label>Prénom</label>
              <input value={form.clientPrenom||""} onChange={e=>setForm(f=>({...f,clientPrenom:e.target.value}))} />
            </div>
          </div>
          <div className="row2">
            <div className="field"><label>Téléphone</label>
              <input type="tel" value={form.clientTel||""} onChange={e=>setForm(f=>({...f,clientTel:e.target.value}))} />
            </div>
            <div className="field"><label>Email</label>
              <input type="email" value={form.clientEmail||""} onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))} />
            </div>
          </div>
          <div className="field"><label>Adresse facturation</label>
            <input value={form.adresseFacturation||""} onChange={e=>setForm(f=>({...f,adresseFacturation:e.target.value}))} />
          </div>
          <div className="field"><label>Adresse intervention *</label>
            <input value={form.adresseIntervention||""} onChange={e=>setForm(f=>({...f,adresseIntervention:e.target.value}))}
              placeholder="12 rue des Fleurs, 97200 Fort-de-France" />
          </div>
          <div className="field"><label>Signataire (si différent)</label>
            <input value={form.signataire||""} onChange={e=>setForm(f=>({...f,signataire:e.target.value}))} />
          </div>
        </div>

        {/* Compléments */}
        <div className="card">
          <div className="card-title">Compléments</div>
          <div className="row2">
            <div className="field"><label>N° Devis</label>
              <input value={form.numDevis||""} onChange={e=>setForm(f=>({...f,numDevis:e.target.value}))} placeholder="DEV-2026-001" />
            </div>
            <div className="field"><label>N° Visite</label>
              <input value={form.numVisite||"1"} onChange={e=>setForm(f=>({...f,numVisite:e.target.value}))} />
            </div>
          </div>
          <div className="field"><label>Montant facturé (€)</label>
            <input type="number" step="0.01" value={form.montantFacture||""} onChange={e=>setForm(f=>({...f,montantFacture:e.target.value}))} />
          </div>
          <div className="field"><label>Demande client</label>
            <textarea value={form.demandeClient||""} onChange={e=>setForm(f=>({...f,demandeClient:e.target.value}))}
              placeholder="Contexte, motif…" rows={3} />
          </div>
        </div>

        <button className="btn-primary" style={{width:"100%",marginBottom:32,opacity:canSubmit?1:0.4}}
          disabled={saving||!canSubmit} onClick={createBon}>
          {saving ? "Création…" : "✅ Créer le bon d'intervention"}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Formulaire indisponibilité
  // ══════════════════════════════════════════════════════════════════════════

  if (indispoFormOpen) {
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setIndispoFormOpen(false)}>← Retour</button>
          <h2>Indisponibilité</h2>
        </div>
        <div className="card">
          <div className="field"><label>Collaborateur *</label>
            <select style={selectStyle} value={indispoData.techNom} onChange={e=>setIndispoData(d=>({...d,techNom:e.target.value}))}>
              <option value="">Choisir…</option>
              {techList.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field"><label>Du *</label>
            <input type="date" value={indispoData.dateDebut} onChange={e=>setIndispoData(d=>({...d,dateDebut:e.target.value}))} />
          </div>
          <div className="field"><label>Au *</label>
            <input type="date" value={indispoData.dateFin} min={indispoData.dateDebut} onChange={e=>setIndispoData(d=>({...d,dateFin:e.target.value}))} />
          </div>
          <div className="field"><label>Motif</label>
            <select style={selectStyle} value={indispoData.motif} onChange={e=>setIndispoData(d=>({...d,motif:e.target.value}))}>
              {["Congé","Maladie","Formation","Autre"].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {indispos.length > 0 && (
          <div className="card">
            <div className="card-title">Indisponibilités en cours</div>
            {indispos.map(i=>(
              <div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)",marginBottom:2}}>{i.techNom}</p>
                  <p style={{fontSize:11,color:"var(--color-text-secondary)"}}>{i.motif} · {i.dateDebut}{i.dateDebut!==i.dateFin?` → ${i.dateFin}`:""}</p>
                </div>
                <button onClick={()=>deleteIndispo(i.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#e74c3c",fontSize:16,padding:"4px 8px"}}>🗑</button>
              </div>
            ))}
          </div>
        )}

        <button className="btn-primary" style={{width:"100%",opacity:(indispoData.techNom&&indispoData.dateDebut&&indispoData.dateFin)?1:0.4}}
          disabled={saving||!indispoData.techNom||!indispoData.dateDebut||!indispoData.dateFin} onClick={createIndispo}>
          {saving?"Enregistrement…":"Enregistrer"}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Grille Hebdomadaire
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="container">
      <div className="page-header">
        <h2>Planning — Semaine en cours</h2>
      </div>

      {/* Résumé semaine */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {label:"Total semaine",val:bons.length,color:"#35B499"},
          {label:"Terminés",val:bons.filter(b=>b.statut==="terminé").length,color:"#35B499"},
          {label:"Restants",val:bons.filter(b=>b.statut!=="terminé").length,color:"#E8845C"},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <p style={{fontSize:22,fontWeight:800,color,lineHeight:1.1}}>{val}</p>
            <p style={{fontSize:11,color:"var(--color-text-secondary)"}}>{label}</p>
          </div>
        ))}
      </div>

      {/* Légende techniciens */}
      <div style={{display:"flex",gap:14,marginBottom:12,flexWrap:"wrap"}}>
        {Object.entries(techColors).map(([name,color])=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
            <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>{name}</span>
          </div>
        ))}
        {isAdmin && (
          <span style={{fontSize:11,color:"var(--color-text-secondary)",marginLeft:"auto",fontStyle:"italic"}}>
            Cliquez sur un créneau pour créer un bon
          </span>
        )}
      </div>

      {loading && <p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:13,padding:"2rem 0"}}>Chargement…</p>}

      {/* Grille */}
      {!loading && (
        <div style={{overflowX:"auto",borderRadius:12,border:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-primary)"}}>

          {/* En-tête jours */}
          <div style={{display:"grid",gridTemplateColumns:`52px repeat(7, minmax(90px,1fr))`,borderBottom:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-secondary)",minWidth:700}}>
            <div style={{width:52}}/>
            {weekDays.map(day => {
              const today = isToday(day);
              const dateStr = fmtDate(day);
              const bonCount = bons.filter(b=>b.datePrevue===dateStr).length;
              return (
                <div key={dateStr} style={{padding:"8px 4px",textAlign:"center",borderLeft:"0.5px solid var(--color-border-tertiary)"}}>
                  <div style={{fontSize:10,color:today?"#35B499":"var(--color-text-secondary)",fontWeight:500,textTransform:"capitalize",marginBottom:3}}>
                    {day.toLocaleDateString("fr-FR",{weekday:"short"})}
                  </div>
                  <div style={{
                    fontSize:16,fontWeight:800,
                    color:today?"white":"var(--color-text-primary)",
                    background:today?"#35B499":"transparent",
                    borderRadius:"50%",width:28,height:28,
                    display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px",
                  }}>
                    {day.getDate()}
                  </div>
                  {bonCount > 0 && (
                    <div style={{fontSize:9,color:today?"#35B499":"var(--color-text-secondary)",fontWeight:600}}>
                      {bonCount} bon{bonCount>1?"s":""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lignes heures */}
          {HOURS.map(hour => (
            <div key={hour} style={{display:"grid",gridTemplateColumns:`52px repeat(7, minmax(90px,1fr))`,borderBottom:"0.5px solid var(--color-border-tertiary)",minWidth:700,minHeight:CELL_HEIGHT}}>

              {/* Label heure */}
              <div style={{
                padding:"6px 8px 0 0",textAlign:"right",fontSize:10,
                color:"var(--color-text-secondary)",borderRight:"0.5px solid var(--color-border-tertiary)",
                paddingTop:6,flexShrink:0,
              }}>
                {String(hour).padStart(2,"0")}h
              </div>

              {/* Cellules */}
              {weekDays.map(day => {
                const dateStr    = fmtDate(day);
                const dayBons    = getBonsForSlot(day, hour);
                const today      = isToday(day);
                const indispo    = isDayIndispo(dateStr);

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleCellClick(dateStr, hour)}
                    style={{
                      borderLeft:"0.5px solid var(--color-border-tertiary)",
                      padding:"3px",
                      minHeight:CELL_HEIGHT,
                      background: indispo
                        ? "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 10px)"
                        : today ? "rgba(53,180,153,0.03)" : "transparent",
                      cursor: isAdmin ? "pointer" : "default",
                      position:"relative",
                    }}
                  >
                    {/* Bons dans ce créneau */}
                    {dayBons.map(b => {
                      const ville = extractVille(b.adresseIntervention || b.clientAdresse || "");
                      const color = techColors[b.techNom] || "#35B499";
                      return (
                        <div key={b.id} style={{
                          background: statutBg(b.statut),
                          borderLeft:`3px solid ${color}`,
                          borderRadius:"0 6px 6px 0",
                          padding:"4px 6px",
                          marginBottom:2,
                          fontSize:10,
                          lineHeight:1.4,
                          overflow:"hidden",
                        }}>
                          {/* Heure + Nom */}
                          <div style={{fontWeight:700,color:"var(--color-text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {b.heurePrevue} · {b.clientNom} {b.clientPrenom}
                          </div>
                          {/* Type */}
                          <div style={{color:"var(--color-text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:9}}>
                            {b.type}
                          </div>
                          {/* Ville */}
                          {ville && (
                            <div style={{color,fontWeight:600,fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              📍 {ville}
                            </div>
                          )}
                          {/* Statut */}
                          <span style={{
                            display:"inline-block",marginTop:2,fontSize:8,padding:"1px 6px",borderRadius:20,
                            background:b.statut==="terminé"?"#35B499":b.statut==="en cours"?"#e8c9b8":"#d4f0ea",
                            color:b.statut==="terminé"?"white":b.statut==="en cours"?"#6b4a31":"#1a7a65",
                            fontWeight:700,textTransform:"uppercase",letterSpacing:"0.3px",
                          }}>
                            {b.statut}
                          </span>
                        </div>
                      );
                    })}

                    {/* Hint "+" si admin et cellule vide */}
                    {isAdmin && dayBons.length === 0 && !indispo && (
                      <div style={{
                        position:"absolute",inset:0,display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:18,color:"#35B499",opacity:0.15,
                        pointerEvents:"none",
                      }}>+</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Bouton indispos admin */}
      {isAdmin && !loading && (
        <div style={{marginTop:16,paddingTop:16,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
          <button className="btn-outline" style={{width:"100%"}} onClick={()=>setIndispoFormOpen(true)}>
            🚫 Gérer les indisponibilités
          </button>
        </div>
      )}
    </div>
  );
}
