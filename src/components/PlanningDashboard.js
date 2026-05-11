import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc, Timestamp,
} from "firebase/firestore";

const TECH_COLORS_MAP = {
  "Dimitri": "#35B499",
  "Georges": "#E8845C",
  "Equipe":  "#5C8EE8",
};
const TECH_COLORS_ARRAY = ["#35B499","#E8845C","#5C8EE8","#E85C9A","#8E5CE8","#C8A84B"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);
const TYPES_INTERVENTION = [
  "Dératisation","Désinsectisation","Désinfection",
  "Anti-termites","Anti-chauves-souris","Étanchéité","Rénovation toiture","Autre",
];
const TECHS_DEFAULT = ["Dimitri","Georges","Equipe"];
const CELL_HEIGHT = 68;

const fmtDate = (d) =>
  d.toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });

const getWeekFrom = (monday) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

const getCurrentMonday = () => {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Martinique" }));
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const extractVille = (adresse) => {
  if (!adresse) return "";
  const match = adresse.match(/972\d{2}\s+([^,\n]+)/i);
  return match ? match[1].trim() : "";
};

// Calcule la durée en heures entre deux heures "HH:MM"
const getDurationHours = (debut, fin) => {
  if (!debut || !fin) return 1;
  const [dh, dm] = debut.split(":").map(Number);
  const [fh, fm] = fin.split(":").map(Number);
  const duration = (fh * 60 + fm - dh * 60 - dm) / 60;
  return Math.max(0.25, duration);
};

// Calcule le décalage vertical en px depuis le début de la grille (7h = 0)
const getTopOffset = (heure) => {
  if (!heure) return 0;
  const [h, m] = heure.split(":").map(Number);
  return (h - 7 + m / 60) * CELL_HEIGHT;
};

const GRID_HEIGHT = 12 * CELL_HEIGHT; // 7h → 18h

// Calcule l'heure de fin par défaut (+2h)
const defaultHeureFinPrevue = (heurePrevue) => {
  if (!heurePrevue) return "10:00";
  const [h, m] = heurePrevue.split(":").map(Number);
  const fin = h + 2;
  return `${String(Math.min(fin, 20)).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

const statutBg = (s) =>
  ({ planifié:"#d4f0ea","en cours":"#fff0e0",terminé:"#35B499" }[s] || "#eee");

export default function PlanningDashboard({ user, isAdmin: isAdminProp, onOpenBon }) {
  const isAdmin = isAdminProp !== undefined ? isAdminProp : user?.role === "admin";

  const currentMonday = getCurrentMonday();
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);

  const week1 = getWeekFrom(currentMonday);
  const week2 = getWeekFrom(nextMonday);
  const rangeStart = fmtDate(week1[0]);
  const rangeEnd   = fmtDate(week2[6]);

  const [bons, setBons]             = useState([]);
  const [indispos, setIndispos]     = useState([]);
  const [techColors, setTechColors] = useState({ ...TECH_COLORS_MAP });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [formStep, setFormStep]     = useState(null);
  const [form, setForm]             = useState({});
  const [selectedBon, setSelectedBon] = useState(null);
  const [editingBon,  setEditingBon]  = useState(null);
  const [waPanel,  setWaPanel]  = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [indispoFormOpen, setIndispoFormOpen] = useState(false);
  const [indispoData, setIndispoData] = useState({ techNom:"",dateDebut:"",dateFin:"",motif:"Congé",jourUnique:false });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const bonsSnap = await getDocs(collection(db,"bons"));
      const allBons  = bonsSnap.docs.map(d => ({ id:d.id,...d.data() }));
      const filtered = allBons.filter(b => b.datePrevue >= rangeStart && b.datePrevue <= rangeEnd);
      setBons(filtered);
      const names = [...new Set(filtered.map(b=>b.techNom).filter(Boolean))];
      const colors = { ...TECH_COLORS_MAP };
      names.forEach((name,i) => { if (!colors[name]) colors[name] = TECH_COLORS_ARRAY[i % TECH_COLORS_ARRAY.length]; });
      setTechColors(colors);
      const indisposSnap = await getDocs(collection(db,"indispos"));
      setIndispos(indisposSnap.docs.map(d => ({ id:d.id,...d.data() })));
    } catch(e) { console.error("Planning fetchData error:", e); }
    setLoading(false);
  };

  const techList = [...new Set([...TECHS_DEFAULT,...bons.map(b=>b.techNom).filter(Boolean)])];

  const getBonsForSlot = (day, hour) => {
    const dateStr = fmtDate(day);
    return bons.filter(b => {
      if (b.datePrevue !== dateStr) return false;
      const h = parseInt((b.heurePrevue||"0:00").split(":")[0]);
      return h === hour;
    });
  };

  const isToday      = (day) => fmtDate(day) === fmtDate(new Date());
  const isDayIndispo = (dateStr) => indispos.some(i => i.dateDebut <= dateStr && i.dateFin >= dateStr);

  const handleCellClick = (dateStr, hour) => {
    if (!isAdmin) return;
    const hStr = `${String(hour).padStart(2,"0")}:00`;
    setForm({ datePrevue:dateStr, heurePrevue:hStr, heureFinPrevue:defaultHeureFinPrevue(hStr) });
    setFormStep(1);
  };

  const handleAddButton = () => {
    const hStr = "08:00";
    setForm({ datePrevue:fmtDate(new Date()), heurePrevue:hStr, heureFinPrevue:defaultHeureFinPrevue(hStr) });
    setFormStep(1);
  };

  const handleBonClick = (e, bon) => {
    e.stopPropagation();
    setSelectedBon(bon);
  };

  const createBon = async () => {
    if (!form.clientNom || !form.adresseIntervention) return;
    setSaving(true);
    try {
      const ref = "INT-" + Date.now().toString().slice(-6);
      await addDoc(collection(db,"bons"), {
        ref, clientSociete:form.clientSociete||"", clientNom:form.clientNom||"",
        clientPrenom:form.clientPrenom||"", clientTel:form.clientTel||"",
        clientEmail:form.clientEmail||"", adresseFacturation:form.adresseFacturation||"",
        adresseIntervention:form.adresseIntervention||"", clientAdresse:form.adresseIntervention||"",
        demandeClient:form.demandeClient||"", numDevis:form.numDevis||"",
        signataire:form.signataire||"", types:[form.type], type:form.type,
        datePrevue:form.datePrevue, heurePrevue:form.heurePrevue, heureFinPrevue:form.heureFinPrevue||"", techNom:form.techNom, techId:"",
        statut:"planifié", createdAt:Timestamp.now(),
        heureArrivee:null, heureFin:null, obsCocon:"", obsClient:"",
        signatureTech:null, signatureClient:null, emailEnvoye:false,
        montantFacture:form.montantFacture?parseFloat(form.montantFacture):null,
        numVisite:form.numVisite||"1",
      });
      setFormStep(null); setForm({}); await fetchData();
    } catch(e) { console.error("Erreur création bon:", e); }
    setSaving(false);
  };

  const [indispoError, setIndispoError] = useState("");

  const createIndispo = async () => {
    if (!indispoData.techNom||!indispoData.dateDebut) return;
    setSaving(true);
    setIndispoError("");
    try {
      const dataToSave = {
        techNom:   indispoData.techNom,
        dateDebut: indispoData.dateDebut,
        dateFin:   indispoData.jourUnique ? indispoData.dateDebut : indispoData.dateFin,
        motif:     indispoData.motif,
      };
      await addDoc(collection(db,"indispos"), dataToSave);
      setIndispoFormOpen(false);
      setIndispoData({ techNom:"",dateDebut:"",dateFin:"",motif:"Congé",jourUnique:false });
      setIndispoError("");
      await fetchData();
    } catch(e) {
      console.error("Erreur indispo:", e);
      setIndispoError("Erreur : " + (e?.message || "Vérifiez les règles Firestore pour la collection 'indispos'"));
    }
    setSaving(false);
  };

  const deleteIndispo = async (id) => {
    try { await deleteDoc(doc(db,"indispos",id)); await fetchData(); } catch(e) {}
  };

  const saveEditBon = async () => {
    if (!editingBon) return;
    setSaving(true);
    try {
      await updateDoc(doc(db,"bons",editingBon.id), {
        datePrevue:     editingBon.datePrevue,
        heurePrevue:    editingBon.heurePrevue,
        heureFinPrevue: editingBon.heureFinPrevue || "",
        techNom:        editingBon.techNom,
        type:           editingBon.type,
        types:          [editingBon.type],
      });
      setEditingBon(null);
      setSelectedBon(null);
      await fetchData();
    } catch(e) { console.error("Erreur modification bon:", e); }
    setSaving(false);
  };

  // ── WhatsApp ───────────────────────────────────────────────────────────────

  const TECH_EMOJIS = { "Dimitri":"🟢", "Georges":"🟠", "Equipe":"🔵" };

  const fmtHeure = (h) => {
    if (!h) return "?h";
    const [hh, mm] = h.split(":").map(Number);
    return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2,"0")}`;
  };

  const generateWAMessage = (period) => {
    const todayDate = new Date();
    const tomDate   = new Date(); tomDate.setDate(todayDate.getDate() + 1);
    const todayStr  = fmtDate(todayDate);
    const tomStr    = fmtDate(tomDate);
    const w1start   = fmtDate(week1[0]);
    const w1end     = fmtDate(week1[6]);

    let header = "";
    let days   = [];
    let filteredBons = [];

    if (period === "today") {
      header = `📅 *Planning Cocon+ · ${todayDate.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}*`;
      filteredBons = bons.filter(b => b.datePrevue === todayStr);
      days = [todayStr];
    } else if (period === "tomorrow") {
      header = `📅 *Planning Cocon+ · ${tomDate.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}*`;
      filteredBons = bons.filter(b => b.datePrevue === tomStr);
      days = [tomStr];
    } else {
      const d1 = week1[0].toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
      const d2 = week1[6].toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
      header = `📅 *Planning semaine · ${d1} – ${d2}*`;
      filteredBons = bons.filter(b => b.datePrevue >= w1start && b.datePrevue <= w1end);
      days = [...new Set(filteredBons.map(b => b.datePrevue).filter(Boolean))].sort();
    }

    if (filteredBons.length === 0) {
      return `${header}\n\nAucune intervention prévue.`;
    }

    const lines = [header, ""];

    days.forEach(dateStr => {
      const dayBons = filteredBons
        .filter(b => b.datePrevue === dateStr)
        .sort((a,b) => (a.heurePrevue||"").localeCompare(b.heurePrevue||""));
      if (dayBons.length === 0) return;

      // En-tête jour pour la vue semaine
      if (period === "week") {
        const d = new Date(dateStr + "T12:00:00");
        const dayLabel = d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
        lines.push(`*${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}*`);
      }

      dayBons.forEach(b => {
        const emoji  = TECH_EMOJIS[b.techNom] || "⚫";
        const heure  = fmtHeure(b.heurePrevue);
        const client = b.clientSociete || `${b.clientNom} ${b.clientPrenom||""}`.trim();
        const ville  = extractVille(b.adresseIntervention||b.clientAdresse||"");
        const villeStr = ville ? ` · ${ville}` : "";
        lines.push(`${emoji} ${heure} ${client} → ${b.type}${villeStr}`);
      });

      if (period === "week") lines.push("");
    });

    // Résumé
    const nbJours = days.filter(d => filteredBons.some(b => b.datePrevue === d)).length;
    const resume  = period === "week"
      ? `${filteredBons.length} intervention${filteredBons.length>1?"s":""} · ${nbJours} jour${nbJours>1?"s":""}`
      : `${filteredBons.length} intervention${filteredBons.length>1?"s":""}`;

    lines.push("━━━━━━━━━━━━━");
    lines.push(resume);
    lines.push(`🔗 ${window.location.origin}`);
    lines.push("");
    lines.push("_Cocon+ · 0596 73 66 66_");

    return lines.join("\n");
  };

  const handleWAPeriod = (period) => {
    const msg = generateWAMessage(period);
    setWaMessage(msg);
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(waMessage)}`, "_blank");
  };

  const selectStyle = {
    width:"100%", padding:"10px 12px", fontSize:14,
    border:"0.5px solid var(--color-border-tertiary)", borderRadius:8,
    background:"var(--color-background-primary)", color:"var(--color-text-primary)",
  };

  // ── ÉTAPE 1 ───────────────────────────────────────────────────────────────
  if (formStep === 1) {
    const canGoNext = form.datePrevue && form.heurePrevue && form.heureFinPrevue && form.techNom && form.type;
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={()=>{ setFormStep(null); setForm({}); }}>← Retour</button>
          <h2>Nouvelle intervention</h2>
          <span style={{fontSize:11,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",padding:"3px 10px",borderRadius:20}}>Étape 1 / 2</span>
        </div>
        <div className="card">
          <div className="card-title">Créneau &amp; intervention</div>
          <div className="field"><label>Date *</label>
            <input type="date" min={rangeStart} max={rangeEnd} value={form.datePrevue||""} onChange={e=>setForm(f=>({...f,datePrevue:e.target.value}))} />
          </div>
          <div className="row2">
            <div className="field"><label>Heure de début *</label>
              <input type="time" value={form.heurePrevue||""} onChange={e=>setForm(f=>({...f,heurePrevue:e.target.value,heureFinPrevue:defaultHeureFinPrevue(e.target.value)}))} />
            </div>
            <div className="field"><label>Heure de fin *</label>
              <input type="time" value={form.heureFinPrevue||""} min={form.heurePrevue||""} onChange={e=>setForm(f=>({...f,heureFinPrevue:e.target.value}))} />
            </div>
          </div>
          <div className="field"><label>Collaborateur *</label>
            <select style={selectStyle} value={form.techNom||""} onChange={e=>setForm(f=>({...f,techNom:e.target.value}))}>
              <option value="">Choisir…</option>
              {techList.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field"><label>Type d'intervention *</label>
            <select style={selectStyle} value={form.type||""} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              <option value="">Choisir un type…</option>
              {TYPES_INTERVENTION.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <button className="btn-primary" style={{width:"100%",opacity:canGoNext?1:0.4}} disabled={!canGoNext} onClick={()=>setFormStep(2)}>
          Suivant — Informations client →
        </button>
      </div>
    );
  }

  // ── ÉTAPE 2 ───────────────────────────────────────────────────────────────
  if (formStep === 2) {
    const canSubmit = form.clientNom && form.adresseIntervention;
    const dateLabel = new Date(form.datePrevue+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={()=>setFormStep(1)}>← Étape 1</button>
          <h2>Informations client</h2>
          <span style={{fontSize:11,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",padding:"3px 10px",borderRadius:20}}>Étape 2 / 2</span>
        </div>
        <div className="card readonly" style={{marginBottom:12}}>
          <div className="card-title">Récapitulatif <span className="locked-badge">🔒 Étape 1</span></div>
          <div className="info-row"><span>Date</span><b style={{textTransform:"capitalize"}}>{dateLabel} · {form.heurePrevue} → {form.heureFinPrevue}</b></div>
          <div className="info-row"><span>Type</span><b>{form.type}</b></div>
          <div className="info-row"><span>Collaborateur</span><b>{form.techNom}</b></div>
        </div>
        <div className="card">
          <div className="card-title">Client</div>
          <div className="field"><label>Société (optionnel)</label>
            <input value={form.clientSociete||""} onChange={e=>setForm(f=>({...f,clientSociete:e.target.value}))} />
          </div>
          <div className="row2">
            <div className="field"><label>Nom *</label><input value={form.clientNom||""} onChange={e=>setForm(f=>({...f,clientNom:e.target.value}))} /></div>
            <div className="field"><label>Prénom</label><input value={form.clientPrenom||""} onChange={e=>setForm(f=>({...f,clientPrenom:e.target.value}))} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Téléphone</label><input type="tel" value={form.clientTel||""} onChange={e=>setForm(f=>({...f,clientTel:e.target.value}))} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.clientEmail||""} onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))} /></div>
          </div>
          <div className="field"><label>Adresse facturation</label>
            <input value={form.adresseFacturation||""} onChange={e=>setForm(f=>({...f,adresseFacturation:e.target.value}))} />
          </div>
          <div className="field"><label>Adresse intervention *</label>
            <input value={form.adresseIntervention||""} onChange={e=>setForm(f=>({...f,adresseIntervention:e.target.value}))} placeholder="12 rue des Fleurs, 97200 Fort-de-France" />
          </div>
          <div className="field"><label>Signataire (si différent)</label>
            <input value={form.signataire||""} onChange={e=>setForm(f=>({...f,signataire:e.target.value}))} />
          </div>
        </div>
        <div className="card">
          <div className="card-title">Compléments</div>
          <div className="row2">
            <div className="field"><label>N° Devis</label><input value={form.numDevis||""} onChange={e=>setForm(f=>({...f,numDevis:e.target.value}))} placeholder="DEV-2026-001" /></div>
            <div className="field"><label>N° Visite</label><input value={form.numVisite||"1"} onChange={e=>setForm(f=>({...f,numVisite:e.target.value}))} /></div>
          </div>
          <div className="field"><label>Montant facturé (€)</label>
            <input type="number" step="0.01" value={form.montantFacture||""} onChange={e=>setForm(f=>({...f,montantFacture:e.target.value}))} />
          </div>
          <div className="field"><label>Demande client</label>
            <textarea value={form.demandeClient||""} onChange={e=>setForm(f=>({...f,demandeClient:e.target.value}))} placeholder="Contexte, motif…" rows={3} />
          </div>
        </div>
        <button className="btn-primary" style={{width:"100%",marginBottom:32,opacity:canSubmit?1:0.4}} disabled={saving||!canSubmit} onClick={createBon}>
          {saving?"Création…":"✅ Créer le bon d'intervention"}
        </button>
      </div>
    );
  }

  // ── PANNEAU WHATSAPP ──────────────────────────────────────────────────────
  if (waPanel) {
    const periods = [
      { key:"today",    label:"Aujourd'hui",   icon:"📅", sub: new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}) },
      { key:"tomorrow", label:"Demain",         icon:"📆", sub: (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}); })() },
      { key:"week",     label:"Cette semaine",  icon:"🗓️",  sub: `${week1[0].toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} → ${week1[6].toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}` },
    ];
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => { setWaPanel(false); setWaMessage(""); }}>← Retour</button>
          <h2>Envoyer le planning</h2>
        </div>

        {/* Sélection période */}
        {!waMessage && (
          <>
            <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}>
              Choisissez la période à partager avec l'équipe :
            </p>
            {periods.map(({ key, label, icon, sub }) => (
              <div key={key} onClick={() => handleWAPeriod(key)}
                style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
                onMouseLeave={e=>e.currentTarget.style.background="var(--color-background-primary)"}>
                <div style={{fontSize:28}}>{icon}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)"}}>{label}</div>
                  <div style={{fontSize:11,color:"var(--color-text-secondary)",textTransform:"capitalize"}}>{sub}</div>
                </div>
                <div style={{marginLeft:"auto",fontSize:18,color:"#35B499"}}>→</div>
              </div>
            ))}
          </>
        )}

        {/* Prévisualisation du message */}
        {waMessage && (
          <>
            <div style={{background:"#e9f5e9",border:"0.5px solid #c3e6cb",borderRadius:12,padding:"14px",marginBottom:14,fontFamily:"monospace",fontSize:12,lineHeight:1.7,color:"#1a1a1a",whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:360,overflowY:"auto"}}>
              {waMessage}
            </div>
            <button onClick={openWhatsApp}
              style={{width:"100%",background:"#25D366",color:"white",border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              💬 Ouvrir WhatsApp
            </button>
            <button className="btn-outline" style={{width:"100%"}} onClick={() => setWaMessage("")}>
              ← Choisir une autre période
            </button>
          </>
        )}
      </div>
    );
  }

  // ── PANNEAU BON EXISTANT ──────────────────────────────────────────────────
  if (selectedBon && !editingBon) {
    const ville    = extractVille(selectedBon.adresseIntervention||selectedBon.clientAdresse||"");
    const color    = techColors[selectedBon.techNom] || "#35B499";
    const termine  = selectedBon.statut === "terminé";
    const duration = getDurationHours(selectedBon.heurePrevue, selectedBon.heureFinPrevue);
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setSelectedBon(null)}>← Retour</button>
          <h2>Intervention</h2>
          <span className="badge" style={{background:selectedBon.statut==="terminé"?"#35B499":selectedBon.statut==="en cours"?"#e8c9b8":"#d4f0ea",color:selectedBon.statut==="terminé"?"white":selectedBon.statut==="en cours"?"#6b4a31":"#1a7a65"}}>
            {selectedBon.statut}
          </span>
        </div>

        {/* Résumé */}
        <div className="card" style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:4,borderRadius:2,alignSelf:"stretch",background:color,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:"var(--color-text-primary)",marginBottom:2}}>
                {selectedBon.clientNom} {selectedBon.clientPrenom}
              </div>
              {selectedBon.clientSociete && <div style={{fontSize:11,color:"#35B499",fontWeight:600,marginBottom:2}}>{selectedBon.clientSociete}</div>}
              <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{selectedBon.type}</div>
            </div>
          </div>
          <div className="info-row"><span>Date</span><b>{selectedBon.datePrevue}</b></div>
          <div className="info-row">
            <span>Créneau</span>
            <b>{selectedBon.heurePrevue}{selectedBon.heureFinPrevue ? ` → ${selectedBon.heureFinPrevue}` : ""}{selectedBon.heureFinPrevue ? ` (${duration % 1 === 0 ? duration+"h" : duration.toFixed(1)+"h"})` : ""}</b>
          </div>
          <div className="info-row"><span>Collaborateur</span><b style={{color}}>{selectedBon.techNom}</b></div>
          {ville && <div className="info-row"><span>Ville</span><b>📍 {ville}</b></div>}
          <div className="info-row"><span>Réf.</span><b style={{color:"#35B499",fontSize:11}}>{selectedBon.ref}</b></div>
        </div>

        {/* Actions */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {!termine && isAdmin && (
            <button className="btn-primary" onClick={() => setEditingBon({ ...selectedBon })}>
              ✏️ Modifier le créneau
            </button>
          )}
          {onOpenBon && (
            <button className="btn-outline" onClick={() => { onOpenBon(selectedBon); setSelectedBon(null); }}>
              📋 Voir le bon complet
            </button>
          )}
          {termine && (
            <p style={{fontSize:12,color:"#888",textAlign:"center",fontStyle:"italic"}}>
              Ce bon est terminé — modification non disponible.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── FORMULAIRE MODIFICATION CRÉNEAU ───────────────────────────────────────
  if (editingBon) {
    const canSave = editingBon.datePrevue && editingBon.heurePrevue && editingBon.heureFinPrevue && editingBon.techNom && editingBon.type;
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setEditingBon(null)}>← Retour</button>
          <h2>Modifier le créneau</h2>
        </div>

        <div className="card readonly" style={{marginBottom:12}}>
          <div className="card-title">Bon concerné <span className="locked-badge">🔒 Infos client</span></div>
          <div className="info-row"><span>Client</span><b>{editingBon.clientNom} {editingBon.clientPrenom}</b></div>
          <div className="info-row"><span>Réf.</span><b style={{color:"#35B499"}}>{editingBon.ref}</b></div>
        </div>

        <div className="card">
          <div className="card-title">Créneau</div>
          <div className="field"><label>Date *</label>
            <input type="date" min={rangeStart} max={rangeEnd}
              value={editingBon.datePrevue||""}
              onChange={e=>setEditingBon(b=>({...b,datePrevue:e.target.value}))} />
          </div>
          <div className="row2">
            <div className="field"><label>Heure de début *</label>
              <input type="time" value={editingBon.heurePrevue||""}
                onChange={e=>setEditingBon(b=>({...b,heurePrevue:e.target.value,heureFinPrevue:defaultHeureFinPrevue(e.target.value)}))} />
            </div>
            <div className="field"><label>Heure de fin *</label>
              <input type="time" value={editingBon.heureFinPrevue||""} min={editingBon.heurePrevue||""}
                onChange={e=>setEditingBon(b=>({...b,heureFinPrevue:e.target.value}))} />
            </div>
          </div>
          <div className="field"><label>Collaborateur *</label>
            <select style={selectStyle} value={editingBon.techNom||""} onChange={e=>setEditingBon(b=>({...b,techNom:e.target.value}))}>
              <option value="">Choisir…</option>
              {techList.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field"><label>Type d'intervention *</label>
            <select style={selectStyle} value={editingBon.type||""} onChange={e=>setEditingBon(b=>({...b,type:e.target.value}))}>
              <option value="">Choisir un type…</option>
              {TYPES_INTERVENTION.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button className="btn-primary" style={{width:"100%",opacity:canSave?1:0.4,marginBottom:10}}
          disabled={saving||!canSave} onClick={saveEditBon}>
          {saving?"Sauvegarde…":"✅ Enregistrer les modifications"}
        </button>
        <button className="btn-outline" style={{width:"100%"}} onClick={() => setEditingBon(null)}>
          Annuler
        </button>
      </div>
    );
  }

  // ── INDISPO FORM ──────────────────────────────────────────────────────────
  if (indispoFormOpen) {
    const canSave = indispoData.techNom && indispoData.dateDebut && (indispoData.jourUnique || indispoData.dateFin);
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={()=>setIndispoFormOpen(false)}>← Retour</button>
          <h2>Indisponibilité</h2>
        </div>
        <div className="card">
          <div className="field"><label>Collaborateur *</label>
            <select style={selectStyle} value={indispoData.techNom} onChange={e=>setIndispoData(d=>({...d,techNom:e.target.value}))}>
              <option value="">Choisir…</option>
              {techList.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Toggle jour unique */}
          <div onClick={()=>setIndispoData(d=>({...d,jourUnique:!d.jourUnique,dateFin:""}))}
            style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",cursor:"pointer",marginBottom:4}}>
            <div style={{width:44,height:24,borderRadius:12,background:indispoData.jourUnique?"#35B499":"#ddd",position:"relative",transition:"background .2s",flexShrink:0}}>
              <div style={{position:"absolute",top:2,left:indispoData.jourUnique?20:2,width:20,height:20,borderRadius:"50%",background:"white",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>Jour unique</div>
              <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Jour férié, absence ponctuelle</div>
            </div>
          </div>

          <div className="field"><label>{indispoData.jourUnique?"Date *":"Du *"}</label>
            <input type="date" value={indispoData.dateDebut} onChange={e=>setIndispoData(d=>({...d,dateDebut:e.target.value}))} />
          </div>
          {!indispoData.jourUnique && (
            <div className="field"><label>Au *</label>
              <input type="date" value={indispoData.dateFin} min={indispoData.dateDebut} onChange={e=>setIndispoData(d=>({...d,dateFin:e.target.value}))} />
            </div>
          )}
          <div className="field"><label>Motif</label>
            <select style={selectStyle} value={indispoData.motif} onChange={e=>setIndispoData(d=>({...d,motif:e.target.value}))}>
              {["Congé","Maladie","Formation","Jour férié","Autre"].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {indispos.length > 0 && (
          <div className="card">
            <div className="card-title">Indisponibilités en cours</div>
            {indispos.map(i=>{
              const jourUnique = i.dateDebut === i.dateFin;
              return (
                <div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)",marginBottom:2}}>{i.techNom}</p>
                    <p style={{fontSize:11,color:"var(--color-text-secondary)"}}>
                      {i.motif} · {jourUnique ? i.dateDebut : `${i.dateDebut} → ${i.dateFin}`}
                      {jourUnique && <span style={{marginLeft:6,fontSize:9,background:"#e8f0fe",color:"#185FA5",padding:"1px 6px",borderRadius:20,fontWeight:600}}>Jour unique</span>}
                    </p>
                  </div>
                  <button onClick={()=>deleteIndispo(i.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#e74c3c",fontSize:16,padding:"4px 8px"}}>🗑</button>
                </div>
              );
            })}
          </div>
        )}

        <button className="btn-primary" style={{width:"100%",opacity:canSave?1:0.4}}
          disabled={saving||!canSave} onClick={createIndispo}>
          {saving?"Enregistrement…":"Enregistrer"}
        </button>
        {indispoError && (
          <p style={{color:"#e74c3c",fontSize:12,marginTop:10,padding:"8px 12px",background:"#fdecea",borderRadius:8,lineHeight:1.5}}>
            ⚠️ {indispoError}
          </p>
        )}
      </div>
    );
  }

  // ── GRILLE (composant interne — positionnement absolu) ────────────────────
  const WeekGrid = ({ days, label }) => (
    <div style={{marginBottom:24}}>
      <div style={{fontSize:11,fontWeight:600,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
        {label}
        <span style={{fontSize:10,fontWeight:400,color:"var(--color-text-secondary)"}}>
          {days[0].toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} – {days[6].toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}
        </span>
      </div>
      <div style={{overflowX:"auto",borderRadius:12,border:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-primary)"}}>
        <div style={{minWidth:700}}>

          {/* ── En-tête jours ── */}
          <div style={{display:"grid",gridTemplateColumns:`52px repeat(7, minmax(90px,1fr))`,borderBottom:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-secondary)"}}>
            <div style={{width:52}}/>
            {days.map(day => {
              const today   = isToday(day);
              const dateStr = fmtDate(day);
              const count   = bons.filter(b=>b.datePrevue===dateStr).length;
              return (
                <div key={dateStr} style={{padding:"8px 4px",textAlign:"center",borderLeft:"0.5px solid var(--color-border-tertiary)"}}>
                  <div style={{fontSize:10,color:today?"#35B499":"var(--color-text-secondary)",fontWeight:500,textTransform:"capitalize",marginBottom:3}}>
                    {day.toLocaleDateString("fr-FR",{weekday:"short"})}
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:today?"white":"var(--color-text-primary)",background:today?"#35B499":"transparent",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px"}}>
                    {day.getDate()}
                  </div>
                  {count > 0 && <div style={{fontSize:9,color:today?"#35B499":"var(--color-text-secondary)",fontWeight:600}}>{count} bon{count>1?"s":""}</div>}
                </div>
              );
            })}
          </div>

          {/* ── Corps : colonne heure + colonnes jours ── */}
          <div style={{display:"grid",gridTemplateColumns:`52px repeat(7, minmax(90px,1fr))`}}>

            {/* Colonne heures */}
            <div style={{position:"relative",height:GRID_HEIGHT,borderRight:"0.5px solid var(--color-border-tertiary)"}}>
              {HOURS.map((hour, i) => (
                <div key={hour} style={{
                  position:"absolute", top: i * CELL_HEIGHT,
                  right:6, fontSize:10, color:"var(--color-text-secondary)",
                  lineHeight:`${CELL_HEIGHT}px`,
                }}>
                  {String(hour).padStart(2,"0")}h
                </div>
              ))}
            </div>

            {/* Colonnes jours */}
            {days.map(day => {
              const dateStr = fmtDate(day);
              const dayBons = bons.filter(b => b.datePrevue === dateStr);
              const today   = isToday(day);
              const indispo = isDayIndispo(dateStr);

              return (
                <div key={dateStr} style={{
                  position:"relative", height:GRID_HEIGHT,
                  borderLeft:"0.5px solid var(--color-border-tertiary)",
                  background: indispo
                    ? "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 10px)"
                    : today ? "rgba(53,180,153,0.03)" : "transparent",
                }}>
                  {/* Lignes horizontales par heure (cliquables) */}
                  {HOURS.map((hour, i) => (
                    <div key={hour}
                      onClick={() => handleCellClick(dateStr, hour)}
                      style={{
                        position:"absolute", top: i * CELL_HEIGHT, left:0, right:0, height: CELL_HEIGHT,
                        borderBottom:"0.5px solid var(--color-border-tertiary)",
                        cursor: isAdmin ? "pointer" : "default",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                      {isAdmin && !indispo && dayBons.length === 0 && (
                        <div style={{fontSize:18,color:"#35B499",opacity:0.12,pointerEvents:"none"}}>+</div>
                      )}
                    </div>
                  ))}

                  {/* Bons positionnés absolument selon heure */}
                  {dayBons.map(b => {
                    const ville      = extractVille(b.adresseIntervention||b.clientAdresse||"");
                    const color      = techColors[b.techNom]||"#35B499";
                    const topOffset  = getTopOffset(b.heurePrevue);
                    const duration   = getDurationHours(b.heurePrevue, b.heureFinPrevue);
                    const blockH     = Math.max(28, duration * CELL_HEIGHT - 4);

                    return (
                      <div key={b.id}
                        onClick={e => handleBonClick(e, b)}
                        style={{
                          position:"absolute",
                          top: topOffset + 2,
                          left: 3, right: 3,
                          height: blockH,
                          background: statutBg(b.statut),
                          borderLeft:`3px solid ${color}`,
                          borderRadius:"0 6px 6px 0",
                          padding:"4px 6px",
                          fontSize:10, lineHeight:1.4,
                          overflow:"hidden",
                          cursor:"pointer",
                          zIndex:2,
                          transition:"opacity .15s",
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.opacity="0.75";}}
                        onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
                        <div style={{fontWeight:700,color:"var(--color-text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {b.heurePrevue}{b.heureFinPrevue?` → ${b.heureFinPrevue}`:""} · {b.clientNom} {b.clientPrenom}
                        </div>
                        {blockH > 40 && (
                          <div style={{color:"var(--color-text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:9}}>
                            {b.type}
                          </div>
                        )}
                        {blockH > 55 && ville && (
                          <div style={{color,fontWeight:600,fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            📍 {ville}
                          </div>
                        )}
                        {blockH > 68 && (
                          <span style={{display:"inline-block",marginTop:2,fontSize:8,padding:"1px 6px",borderRadius:20,
                            background:b.statut==="terminé"?"#35B499":b.statut==="en cours"?"#e8c9b8":"#d4f0ea",
                            color:b.statut==="terminé"?"white":b.statut==="en cours"?"#6b4a31":"#1a7a65",
                            fontWeight:700,textTransform:"uppercase",letterSpacing:"0.3px"}}>
                            {b.statut}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── VUE PRINCIPALE ────────────────────────────────────────────────────────
  return (
    <div className="container">
      <div className="page-header" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <h2>Planning</h2>
        <div style={{display:"flex",gap:8}}>
          {isAdmin && (
            <button onClick={() => { setWaPanel(true); setWaMessage(""); }}
              style={{background:"#25D366",color:"white",border:"none",borderRadius:8,padding:"9px 14px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              💬 WA
            </button>
          )}
          {isAdmin && (
            <button className="btn-primary" style={{padding:"9px 18px",fontSize:13}} onClick={handleAddButton}>
              + Ajouter
            </button>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {label:"Cette semaine",val:bons.filter(b=>b.datePrevue>=fmtDate(week1[0])&&b.datePrevue<=fmtDate(week1[6])).length,color:"#35B499"},
          {label:"Semaine suivante",val:bons.filter(b=>b.datePrevue>=fmtDate(week2[0])&&b.datePrevue<=fmtDate(week2[6])).length,color:"#5C8EE8"},
          {label:"Terminés",val:bons.filter(b=>b.statut==="terminé").length,color:"#35B499"},
          {label:"Restants",val:bons.filter(b=>b.statut!=="terminé").length,color:"#E8845C"},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <p style={{fontSize:20,fontWeight:800,color,lineHeight:1.1}}>{val}</p>
            <p style={{fontSize:10,color:"var(--color-text-secondary)"}}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:14,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {Object.entries(techColors).map(([name,color])=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
            <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>{name}</span>
          </div>
        ))}
        {onOpenBon && (
          <span style={{fontSize:10,color:"var(--color-text-secondary)",marginLeft:"auto",fontStyle:"italic"}}>
            Cliquez sur un bon pour l'ouvrir
          </span>
        )}
      </div>

      {loading && <p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:13,padding:"2rem 0"}}>Chargement…</p>}
      {!loading && <WeekGrid days={week1} label="Semaine en cours" />}
      {!loading && <WeekGrid days={week2} label="Semaine suivante" />}

      {isAdmin && !loading && (
        <div style={{marginTop:8,paddingTop:16,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
          <button className="btn-outline" style={{width:"100%"}} onClick={()=>setIndispoFormOpen(true)}>
            🚫 Gérer les indisponibilités
          </button>
        </div>
      )}
    </div>
  );
}
