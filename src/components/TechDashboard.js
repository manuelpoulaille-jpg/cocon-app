import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import logoBase64 from "../logoBase64";

const EMAILJS_SERVICE  = "service_6ham4ay";
const EMAILJS_TEMPLATE = "template_vy44z8h";
const EMAILJS_KEY      = "JPyrwrjE8dQD_dT0a";
const DRIVE_WEBHOOK    = "https://script.google.com/macros/s/AKfycbza4QR7FaxPNlYv_cFeOEhoRJfKX_HQzH2NSaKsX-lSZNZSMb-_ikfUKxzUZeb5S0J1/exec";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTs = (ts) => ts ? new Date(ts.toDate ? ts.toDate() : ts).toLocaleString("fr-FR") : "—";
const todayStr = () => new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });

const extractVille = (adresse) => {
  if (!adresse) return "";
  const match = adresse.match(/972\d{2}\s+([^,\n]+)/i);
  return match ? match[1].trim() : "";
};

const getTwoWeekRange = () => {
  const now  = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Martinique" }));
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0,0,0,0);
  const end  = new Date(mon);
  end.setDate(mon.getDate() + 13);
  const fmt = (d) => d.toLocaleDateString("fr-CA");
  return { start: fmt(mon), end: fmt(end) };
};

const getWeekDays = (offset = 0) => {
  const now  = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Martinique" }));
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff + offset * 7);
  mon.setHours(0,0,0,0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
};

const fmtDateKey = (d) => d.toLocaleDateString("fr-CA");
const fmtDayLabel = (d) => d.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"short" });
const isToday = (d) => fmtDateKey(d) === todayStr();

const calcDuree = (a, f) => {
  if (!a || !f) return "—";
  const diff = f.toDate() - a.toDate();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m.toString().padStart(2,"0")}` : `${m} min`;
};

const statutColor = (s) => ({ planifié:"#d4f0ea","en cours":"#e8c9b8",terminé:"#35B499" }[s] || "#eee");
const statutText  = (s) => ({ planifié:"#1a7a65","en cours":"#6b4a31",terminé:"white"   }[s] || "#333");

const CHECKLIST_ITEMS = [
  { id:"nettoyage", label:"Nettoyage du chantier effectué",               required:true  },
  { id:"outils",    label:"Outils et matériel récupérés",                 required:true  },
  { id:"produits",  label:"Produits utilisés rangés / sécurisés",         required:true  },
  { id:"consignes", label:"Client informé des consignes post-intervention",required:true  },
  { id:"photos",    label:"Photos prises",                                required:false },
  { id:"signature", label:"Bon signé par le client",                      required:true  },
];

const KPI = ({ label, value, color }) => (
  <div style={{background:"white",borderRadius:10,border:"0.5px solid #e0ddd8",padding:"10px",textAlign:"center",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
    <div style={{fontSize:22,fontWeight:800,color:"#1a1a1a",lineHeight:1}}>{value}</div>
    <div style={{fontSize:10,color:"#888",marginTop:4}}>{label}</div>
  </div>
);

// ── Composant ─────────────────────────────────────────────────────────────────

export default function TechDashboard({ user, tab = "interventions", refreshTrigger = 0 }) {
  const [bons,          setBons]         = useState([]);
  const [planBons,      setPlanBons]     = useState([]);
  const [view,          setView]         = useState("list");
  const [selected,      setSelected]     = useState(null);
  const [obsCocon,      setObsCocon]     = useState("");
  const [obsClient,     setObsClient]    = useState("");
  const [saving,        setSaving]       = useState(false);
  const [sigMode,       setSigMode]      = useState(null);
  const [sigTech,       setSigTech]      = useState(null);
  const [sigClient,     setSigClient]    = useState(null);
  const [signataireNom, setSignataireNom]= useState("");
  const [emailStatus,   setEmailStatus]  = useState("");
  const [showSuccess,   setShowSuccess]  = useState(false);
  const [showChecklist, setShowChecklist]= useState(false);
  const [checklist,     setChecklist]    = useState({});
  const canvasRef = useRef(null);
  const drawing   = useRef(false);

  useEffect(() => { fetchAll(); }, [refreshTrigger]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    await Promise.all([fetchBons(), fetchPlanningBons()]);
  };

  const fetchBons = async () => {
    const td   = todayStr();
    const snap = await getDocs(collection(db,"bons"));
    const all  = snap.docs.map(d => ({ id:d.id,...d.data() }));
    setBons(
      all.filter(b => b.datePrevue === td && (b.techId === user.uid || b.techNom === "Equipe"))
         .sort((a,b) => (a.heurePrevue||"").localeCompare(b.heurePrevue||""))
    );
  };

  const fetchPlanningBons = async () => {
    const { start, end } = getTwoWeekRange();
    const snap = await getDocs(collection(db,"bons"));
    const all  = snap.docs.map(d => ({ id:d.id,...d.data() }));
    setPlanBons(
      all.filter(b => b.datePrevue >= start && b.datePrevue <= end && (b.techId === user.uid || b.techNom === "Equipe"))
         .sort((a,b) => (a.datePrevue+(a.heurePrevue||"")).localeCompare(b.datePrevue+(b.heurePrevue||"")))
    );
  };

  // ── Bon actions ────────────────────────────────────────────────────────────

  const openBon = (b) => {
    setSelected(b);
    setObsCocon(b.obsCocon || "");
    setObsClient(b.obsClient || "");
    setSigTech(b.signatureTech || null);
    setSigClient(b.signatureClient || null);
    setSignataireNom(b.signataire || b.clientNom + " " + b.clientPrenom);
    setEmailStatus("");
    setView("bon");
  };

  const getGeoLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat:pos.coords.latitude, lng:pos.coords.longitude }),
      () => resolve(null),
      { timeout:5000 }
    );
  });

  const arriver = async () => {
    setSaving(true);
    const geo = await getGeoLocation();
    const now = Timestamp.now();
    await updateDoc(doc(db,"bons",selected.id), { heureArrivee:now, statut:"en cours", geoArrivee:geo });
    setSelected({ ...selected, heureArrivee:now, statut:"en cours", geoArrivee:geo });
    fetchAll();
    setSaving(false);
  };

  const terminer = async () => {
    setSaving(true);
    const geo = await getGeoLocation();
    const now = Timestamp.now();
    const bonData = {
      heureFin:now, statut:"terminé", obsCocon, obsClient,
      signatureTech:sigTech, signatureClient:sigClient,
      geoFin:geo, signataire:signataireNom||selected.signataire||"",
      checklist,
    };
    await updateDoc(doc(db,"bons",selected.id), bonData);
    const fullBon = { ...selected, ...bonData };
    setSelected(fullBon);
    fetchAll();
    if (selected.clientEmail) await sendEmail(fullBon);
    await sendToDrive(fullBon);
    setSaving(false);
    setShowChecklist(false);
    setShowSuccess(true);
  };

  const sauvegarder = async () => {
    setSaving(true);
    await updateDoc(doc(db,"bons",selected.id), { obsCocon, obsClient, signatureTech:sigTech, signatureClient:sigClient, signataire:signataireNom });
    setSaving(false);
  };

  // ── Email / Drive ──────────────────────────────────────────────────────────

  const sendToDrive = async (bon) => {
    if (!DRIVE_WEBHOOK || DRIVE_WEBHOOK.includes("COLLER_ICI")) return;
    try {
      const f = (ts) => ts ? new Date(ts.toDate?ts.toDate():ts).toLocaleString("fr-FR") : "—";
      await fetch(DRIVE_WEBHOOK, {
        method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain"},
        body: JSON.stringify({
          ref:bon.ref, numDevis:bon.numDevis||"",
          clientNom:bon.clientNom, clientPrenom:bon.clientPrenom,
          clientTel:bon.clientTel||"", clientEmail:bon.clientEmail||"",
          adresseFacturation:bon.adresseFacturation||"",
          adresseIntervention:bon.adresseIntervention||bon.clientAdresse||"",
          signataire:bon.signataire||"", demandeClient:bon.demandeClient||"",
          type:bon.type, datePrevue:bon.datePrevue, heurePrevue:bon.heurePrevue,
          heureArrivee:f(bon.heureArrivee), heureFin:f(bon.heureFin),
          duree:calcDuree(bon.heureArrivee,bon.heureFin),
          techNom:bon.techNom, obsCocon:bon.obsCocon||"", obsClient:bon.obsClient||"",
        }),
      });
    } catch(e) { console.warn("Drive webhook error:", e); }
  };

  const sendEmail = async (bon) => {
    const f = (ts) => ts ? new Date(ts.toDate?ts.toDate():ts).toLocaleString("fr-FR") : "—";
    setEmailStatus("sending");
    try {
      await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
        to_email:bon.clientEmail, client_nom:bon.clientNom+" "+bon.clientPrenom,
        client_tel:bon.clientTel||"—", client_email:bon.clientEmail||"—",
        adresse_facturation:bon.adresseFacturation||"—",
        adresse_intervention:bon.adresseIntervention||bon.clientAdresse||"—",
        signataire:bon.signataire||"Client", demande_client:bon.demandeClient||"—",
        num_devis:bon.numDevis||"—", ref:bon.ref, type:bon.type,
        date_prevue:bon.datePrevue, heure_prevue:bon.heurePrevue,
        heure_arrivee:f(bon.heureArrivee), heure_fin:f(bon.heureFin),
        collaborateur:bon.techNom, observations_cocon:bon.obsCocon||"—",
        observations_client:bon.obsClient||"—",
        signature_tech:bon.signatureTech||"", signature_client:bon.signatureClient||"",
      }, EMAILJS_KEY);
      setEmailStatus("sent");
      await updateDoc(doc(db,"bons",bon.id), { emailEnvoye:true });
    } catch(e) {
      setEmailStatus("error: "+(e?.text||e?.message||JSON.stringify(e)));
    }
  };

  // ── Signature ──────────────────────────────────────────────────────────────

  const startSig = (mode) => {
    setSigMode(mode);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle="#1a1a1a"; ctx.lineWidth=2.5; ctx.lineCap="round";
      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x:(src.clientX-r.left)*(canvas.width/r.width), y:(src.clientY-r.top)*(canvas.height/r.height) };
      };
      canvas.onmousedown = canvas.ontouchstart = (e) => { e.preventDefault(); drawing.current=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
      canvas.onmousemove = canvas.ontouchmove  = (e) => { e.preventDefault(); if (!drawing.current) return; const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); };
      canvas.onmouseup  = canvas.ontouchend   = () => { drawing.current=false; };
    }, 100);
  };

  const saveSig = () => {
    const canvas = canvasRef.current;
    const c2 = document.createElement("canvas");
    c2.width=280; c2.height=100;
    const ctx2 = c2.getContext("2d");
    ctx2.fillStyle="white"; ctx2.fillRect(0,0,280,100);
    ctx2.drawImage(canvas,0,0,280,100);
    const data = c2.toDataURL("image/jpeg",0.3);
    if (sigMode==="tech") setSigTech(data); else setSigClient(data);
    setSigMode(null);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Checklist
  // ══════════════════════════════════════════════════════════════════════════

  if (showChecklist) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setShowChecklist(false)}>← Retour</button>
        <h2>Checklist de fin de chantier</h2>
      </div>
      <div className="card">
        <div className="card-title">Vérifications avant clôture</div>
        <div style={{height:4,background:"var(--color-border-tertiary)",borderRadius:2,marginBottom:"1rem"}}>
          <div style={{height:4,background:"#35B499",borderRadius:2,width:(Object.values(checklist).filter(Boolean).length/CHECKLIST_ITEMS.length*100)+"%",transition:"width .3s"}}/>
        </div>
        {CHECKLIST_ITEMS.map(item => (
          <div key={item.id} onClick={() => setChecklist(c => ({...c,[item.id]:!c[item.id]}))}
            style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",cursor:"pointer"}}>
            <div style={{width:24,height:24,borderRadius:6,border:"2px solid #35B499",background:checklist[item.id]?"#35B499":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
              {checklist[item.id] && <span style={{color:"white",fontSize:13,fontWeight:"bold"}}>✓</span>}
            </div>
            <span style={{fontSize:14,color:checklist[item.id]?"var(--color-text-secondary)":"var(--color-text-primary)",textDecoration:checklist[item.id]?"line-through":"none",flex:1}}>
              {item.label}
            </span>
            {!item.required && <span style={{fontSize:10,color:"#888",background:"var(--color-background-secondary)",padding:"2px 8px",borderRadius:20,flexShrink:0}}>Optionnel</span>}
          </div>
        ))}
        <p style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:"1rem",fontStyle:"italic"}}>Les points obligatoires doivent être cochés pour terminer.</p>
      </div>
      {!CHECKLIST_ITEMS.filter(i=>i.required).every(i=>checklist[i.id]) && (
        <p style={{color:"#e74c3c",fontSize:12,textAlign:"center",marginBottom:8}}>⚠️ Veuillez cocher tous les points obligatoires</p>
      )}
      <button className="btn-finish" style={{width:"100%",opacity:CHECKLIST_ITEMS.filter(i=>i.required).every(i=>checklist[i.id])?1:0.4}}
        disabled={saving||!CHECKLIST_ITEMS.filter(i=>i.required).every(i=>checklist[i.id])} onClick={terminer}>
        {saving?"Finalisation…":"✅ Terminer le chantier"}
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Succès
  // ══════════════════════════════════════════════════════════════════════════

  if (showSuccess) return (
    <div className="container" style={{textAlign:"center",paddingTop:"3rem"}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"#35B499",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1.5rem",fontSize:36}}>✓</div>
      <h2 style={{color:"#35B499",marginBottom:8}}>Intervention terminée !</h2>
      <p style={{color:"var(--color-text-secondary)",fontSize:14,marginBottom:8}}>Le bon a été enregistré avec succès.</p>
      {emailStatus==="sent"            && <p style={{color:"#35B499",fontSize:14,marginBottom:24}}>✉️ Email envoyé au client</p>}
      {emailStatus.startsWith("error") && <p style={{color:"#e74c3c",fontSize:13,marginBottom:24}}>⚠️ Erreur envoi email — le bon est bien enregistré</p>}
      {!selected.clientEmail           && <p style={{color:"#888",fontSize:13,marginBottom:24}}>Aucun email client renseigné</p>}
      <button className="btn-primary" onClick={() => { setShowSuccess(false); setView("list"); }}>
        Retour à mes interventions
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Signature
  // ══════════════════════════════════════════════════════════════════════════

  if (sigMode) return (
    <div className="container">
      <div className="page-header">
        <h2>Signature — {sigMode==="tech"?"Collaborateur":"Client"}</h2>
      </div>
      <div className="card" style={{textAlign:"center"}}>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12}}>Signez dans le cadre ci-dessous</p>
        <canvas ref={canvasRef} width={560} height={200} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,width:"100%",touchAction:"none",background:"white"}}/>
        <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center"}}>
          <button className="btn-outline" onClick={() => setSigMode(null)}>Annuler</button>
          <button className="btn-primary" onClick={saveSig}>Valider la signature</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Détail bon
  // ══════════════════════════════════════════════════════════════════════════

  if (view==="bon" && selected) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
        <h2>{selected.ref}</h2>
        <span className="badge" style={{background:statutColor(selected.statut),color:statutText(selected.statut)}}>{selected.statut}</span>
      </div>

      <div className="card readonly">
        <div className="card-title">Client <span className="locked-badge">🔒 Admin</span></div>
        <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
        <div className="info-row"><span>Téléphone</span><b>{selected.clientTel||"—"}</b></div>
        <div className="info-row"><span>Email</span><b>{selected.clientEmail||"—"}</b></div>
        <div className="info-row"><span>Adresse</span><b>
          {selected.adresseIntervention||selected.clientAdresse ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.adresseIntervention||selected.clientAdresse)}`}
              target="_blank" rel="noreferrer"
              style={{color:"#2a9d8f",textDecoration:"underline"}}
              onClick={e=>e.stopPropagation()}>
              {selected.adresseIntervention||selected.clientAdresse} 📍
            </a>
          ) : "—"}
        </b></div>
      </div>

      <div className="card readonly">
        <div className="card-title">Intervention <span className="locked-badge">🔒 Admin</span></div>
        <div className="info-row"><span>Type</span><b>{selected.type}</b></div>
        <div className="info-row"><span>Prévu le</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
        <div className="info-row"><span>Collaborateur</span><b>{selected.techNom}</b></div>
      </div>

      {selected.demandeClient && (
        <div className="card readonly">
          <div className="card-title">Demande client <span className="locked-badge">🔒 Admin</span></div>
          <p style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.6}}>{selected.demandeClient}</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Suivi</div>
        <div className="info-row"><span>Arrivée réelle</span><b>{fmtTs(selected.heureArrivee)}</b></div>
        <div className="info-row"><span>Fin intervention</span><b>{fmtTs(selected.heureFin)}</b></div>
        {selected.heureArrivee && selected.heureFin && (
          <div className="info-row"><span>Durée</span><b style={{color:"#35B499"}}>{calcDuree(selected.heureArrivee,selected.heureFin)}</b></div>
        )}
        {selected.geoArrivee && (
          <div className="info-row"><span>Position arrivée</span><b style={{fontSize:12}}>📍 {selected.geoArrivee.lat?.toFixed(4)}, {selected.geoArrivee.lng?.toFixed(4)}</b></div>
        )}
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          {selected.statut==="planifié" && (
            <button className="btn-arrive" disabled={saving} onClick={arriver}>📍 Arrivé sur le chantier</button>
          )}
          {selected.statut==="terminé" && selected.emailEnvoye && (
            <p style={{color:"#35B499",fontSize:13,marginTop:4}}>✅ Email envoyé au client</p>
          )}
        </div>
        {emailStatus==="sent"            && <p style={{color:"#35B499",fontSize:13,marginTop:8}}>✅ Email envoyé au client !</p>}
        {emailStatus.startsWith("error") && <p style={{color:"#e74c3c",fontSize:11,marginTop:8,wordBreak:"break-all"}}>⚠️ {emailStatus}</p>}
        {emailStatus==="sending"         && <p style={{color:"#888",fontSize:13,marginTop:8}}>Envoi de l'email…</p>}
      </div>

      {selected.statut!=="planifié" && (
        <>
          <div className="card">
            <div className="card-title">Observations</div>
            <div className="field" style={{marginBottom:12}}>
              <label>Commentaires Cocon+</label>
              <textarea value={obsCocon} onChange={e=>setObsCocon(e.target.value)} placeholder="Travaux réalisés, constats…" disabled={selected.statut==="terminé"}/>
            </div>
            <div className="field">
              <label>Commentaires client</label>
              <textarea value={obsClient} onChange={e=>setObsClient(e.target.value)} placeholder="Retour du client…" disabled={selected.statut==="terminé"}/>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Signatures</div>
            <div className="row2">
              <div>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>Collaborateur</p>
                {sigTech ? <img src={sigTech} alt="sig" style={{width:"100%",height:70,objectFit:"contain",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}}/> : <div className="sig-placeholder-sm">Non signé</div>}
                {selected.statut!=="terminé" && <button className="btn-outline sm" style={{marginTop:6}} onClick={()=>startSig("tech")}>Signer</button>}
              </div>
              <div>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>Client</p>
                {selected.statut!=="terminé" && (
                  <div style={{marginBottom:6}}>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Nom du signataire</label>
                    <input type="text" placeholder={selected.clientNom+" "+selected.clientPrenom}
                      value={signataireNom||selected.clientNom+" "+selected.clientPrenom}
                      onChange={e=>setSignataireNom(e.target.value)}
                      style={{width:"100%",padding:"6px 10px",fontSize:12,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}/>
                  </div>
                )}
                {selected.statut==="terminé" && selected.signataire && <p style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:4}}>{selected.signataire}</p>}
                {sigClient ? <img src={sigClient} alt="sig" style={{width:"100%",height:70,objectFit:"contain",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}}/> : <div className="sig-placeholder-sm">Non signé</div>}
                {selected.statut!=="terminé" && <button className="btn-outline sm" style={{marginTop:6}} onClick={()=>startSig("cli")}>Signer</button>}
              </div>
            </div>
          </div>

          {selected.statut!=="terminé" && (
            <button className="btn-outline" style={{width:"100%",marginBottom:10}} disabled={saving} onClick={sauvegarder}>
              {saving?"Sauvegarde…":"Sauvegarder"}
            </button>
          )}
          {selected.statut==="en cours" && (
            <div>
              {(!sigTech||!sigClient) && <p style={{color:"#e74c3c",fontSize:12,marginBottom:8,textAlign:"center"}}>⚠️ Les deux signatures sont requises pour continuer</p>}
              <button className="btn-finish" style={{width:"100%",opacity:(!sigTech||!sigClient)?0.4:1}}
                disabled={!sigTech||!sigClient} onClick={()=>{ sauvegarder(); setShowChecklist(true); }}>
                Valider la checklist →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Planning (lecture seule)
  // ══════════════════════════════════════════════════════════════════════════

  if (tab==="planning") {
    const week1 = getWeekDays(0);
    const week2 = getWeekDays(1);

    const PlanWeek = ({ days, label }) => {
      const daysWithBons = days.filter(day => planBons.some(b => b.datePrevue === fmtDateKey(day)));
      return (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:600,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8}}>
            {label}
          </div>
          {daysWithBons.length === 0 && (
            <p style={{fontSize:12,color:"var(--color-text-secondary)",fontStyle:"italic",paddingBottom:8}}>Aucune intervention.</p>
          )}
          {days.map(day => {
            const dateStr = fmtDateKey(day);
            const dayBons = planBons.filter(b => b.datePrevue === dateStr);
            if (dayBons.length === 0) return null;
            const todayDay = isToday(day);
            return (
              <div key={dateStr} style={{marginBottom:8}}>
                <div style={{padding:"7px 12px",borderRadius:8,marginBottom:5,background:todayDay?"#35B499":"var(--color-background-secondary)",color:todayDay?"white":"var(--color-text-secondary)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:700,fontSize:13,textTransform:"capitalize"}}>
                    {todayDay?"📍 ":""}{fmtDayLabel(day)}
                  </span>
                  <span style={{fontSize:10,opacity:0.8}}>{dayBons.length} bon{dayBons.length>1?"s":""}</span>
                </div>
                {dayBons.map(b => {
                  const ville = extractVille(b.adresseIntervention||b.clientAdresse||"");
                  const borderColor = b.statut==="terminé"?"#35B499":b.statut==="en cours"?"#E8845C":"#35B499";
                  return (
                    <div key={b.id} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderLeft:`3px solid ${borderColor}`,borderRadius:"0 8px 8px 0",padding:"8px 12px",marginBottom:4}}>
                      <div style={{fontWeight:600,fontSize:12,color:"var(--color-text-primary)",marginBottom:2}}>
                        {b.heurePrevue} · {b.clientNom} {b.clientPrenom}
                      </div>
                      <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:2}}>{b.type}</div>
                      {ville && <div style={{fontSize:11,color:"#35B499",fontWeight:600}}>📍 {ville}</div>}
                      <span style={{display:"inline-block",marginTop:4,fontSize:9,padding:"1px 7px",borderRadius:20,background:statutColor(b.statut),color:statutText(b.statut),fontWeight:700,textTransform:"uppercase",letterSpacing:"0.3px"}}>
                        {b.statut}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    };

    const w1 = planBons.filter(b => b.datePrevue >= fmtDateKey(week1[0]) && b.datePrevue <= fmtDateKey(week1[6])).length;
    const w2 = planBons.filter(b => b.datePrevue >= fmtDateKey(week2[0]) && b.datePrevue <= fmtDateKey(week2[6])).length;

    return (
      <div className="container">
        <div style={{marginBottom:14}}>
          <h2 style={{fontSize:16,fontWeight:600,color:"var(--color-text-primary)",marginBottom:2}}>Mon planning</h2>
          <p style={{fontSize:11,color:"var(--color-text-secondary)"}}>Semaine en cours &amp; semaine suivante</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <KPI label="Cette semaine"  value={w1} color="#35B499"/>
          <KPI label="Sem. suivante" value={w2} color="#5C8EE8"/>
        </div>
        <PlanWeek days={week1} label="Semaine en cours"/>
        <PlanWeek days={week2} label="Semaine suivante"/>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Liste interventions du jour
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="container">
      <div style={{marginBottom:14}}>
        <h2 style={{fontSize:16,fontWeight:600,color:"var(--color-text-primary)",marginBottom:2}}>Mes interventions du jour</h2>
        <p style={{fontSize:11,color:"var(--color-text-secondary)",textTransform:"capitalize"}}>
          {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}
        </p>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <KPI label="Aujourd'hui" value={bons.length}                              color="#35B499"/>
        <KPI label="En cours"   value={bons.filter(b=>b.statut==="en cours").length} color="#E8845C"/>
      </div>

      {/* Liste */}
      {bons.length === 0 ? (
        <div style={{background:"var(--color-background-primary)",borderRadius:12,border:"0.5px solid var(--color-border-tertiary)",padding:"2rem",textAlign:"center",color:"var(--color-text-secondary)",fontSize:13}}>
          Aucun bon assigné pour aujourd'hui.
        </div>
      ) : (
        bons.map(b => {
          const ville = extractVille(b.adresseIntervention||b.clientAdresse||"");
          return (
            <div key={b.id} onClick={() => openBon(b)}
              style={{background:"var(--color-background-primary)",borderRadius:12,border:"0.5px solid var(--color-border-tertiary)",marginBottom:10,overflow:"hidden",cursor:"pointer"}}>
              <div style={{padding:"10px 14px",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,fontWeight:600,color:"#35B499"}}>{b.ref}</span>
                <span style={{fontSize:10,fontWeight:600,padding:"2px 10px",borderRadius:20,background:statutColor(b.statut),color:statutText(b.statut)}}>{b.statut}</span>
              </div>
              <div style={{padding:"10px 14px"}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)",marginBottom:4}}>{b.clientNom} {b.clientPrenom}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{b.type}</span>
                  {ville && <span style={{fontSize:12,color:"#35B499",fontWeight:600}}>📍 {ville}</span>}
                </div>
              </div>
              <div style={{padding:"8px 14px",background:"#fafaf8",borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>Prévu à {b.heurePrevue}</span>
                {b.statut==="planifié" && <span style={{fontSize:11,color:"#35B499",fontWeight:600}}>📍 Signaler arrivée →</span>}
                {b.statut==="en cours" && <span style={{fontSize:11,color:"#E8845C",fontWeight:600}}>Clôturer →</span>}
                {b.statut==="terminé"  && <span style={{fontSize:11,color:"#35B499",fontWeight:600}}>✓ Terminé</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
