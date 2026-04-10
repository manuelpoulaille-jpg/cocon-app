import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import logoBase64 from "../logoBase64";

const EMAILJS_SERVICE = "service_6ham4ay";
const EMAILJS_TEMPLATE = "template_vy44z8h";
const EMAILJS_KEY = "JPyrwrjE8dQD_dT0a";

export default function TechDashboard({ user }) {
  const [bons, setBons] = useState([]);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [obsCocon, setObsCocon] = useState("");
  const [obsClient, setObsClient] = useState("");
  const [saving, setSaving] = useState(false);
  const [sigMode, setSigMode] = useState(null);
  const [sigTech, setSigTech] = useState(null);
  const [sigClient, setSigClient] = useState(null);
  const [signataireNom, setSignataireNom] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState({});
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => { fetchBons(); }, []);

  const fetchBons = async () => {
    const today = new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });
    const snap = await getDocs(collection(db, "bons"));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = all.filter(b => 
      b.datePrevue === today && 
      (b.techId === user.uid || b.techNom === "Equipe")
    ).sort((a,b) => (a.heurePrevue || "").localeCompare(b.heurePrevue || ""));
    setBons(filtered);
  };

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
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });

  const calcDuree = (arrivee, fin) => {
    if (!arrivee || !fin) return "—";
    const diff = fin.toDate() - arrivee.toDate();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h${m.toString().padStart(2,"0")}` : `${m} min`;
  };

  const arriver = async () => {
    setSaving(true);
    const geo = await getGeoLocation();
    const now = Timestamp.now();
    await updateDoc(doc(db, "bons", selected.id), {
      heureArrivee: now,
      statut: "en cours",
      geoArrivee: geo
    });
    const updated = { ...selected, heureArrivee: now, statut: "en cours", geoArrivee: geo };
    setSelected(updated);
    fetchBons();
    setSaving(false);
  };

  const terminer = async () => {
    setSaving(true);
    const geo = await getGeoLocation();
    const now = Timestamp.now();
    const bonData = {
      heureFin: now,
      statut: "terminé",
      obsCocon,
      obsClient,
      signatureTech: sigTech,
      signatureClient: sigClient,
      geoFin: geo,
      signataire: signataireNom || selected.signataire || "",
      checklist: checklist,
      visiteSupplementaire: visiteSupplementaire,
    };
    await updateDoc(doc(db, "bons", selected.id), bonData);
    const fullBon = { ...selected, ...bonData };
    setSelected(fullBon);
    fetchBons();

    if (selected.clientEmail) {
      await sendEmail(fullBon);
    }
    setSaving(false);
    setShowChecklist(false);
    setShowSuccess(true);
  };

  const sauvegarder = async () => {
    setSaving(true);
    await updateDoc(doc(db, "bons", selected.id), { obsCocon, obsClient, signatureTech: sigTech, signatureClient: sigClient, signataire: signataireNom });
    setSaving(false);
  };

  const generatePDF = async (bon, autoSave = true) => {
    const { jsPDF } = await import("jspdf");
    const doc2 = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, ml = 15, mr = 195;
    const fmt = (ts) => ts ? new Date(ts.toDate ? ts.toDate() : ts).toLocaleString("fr-FR") : "—";

    try { doc2.addImage(logoBase64, "PNG", ml, 5, 28, 22); } catch(e) {}
    doc2.setFillColor(53, 180, 153);
    doc2.rect(45, 0, W - 45, 28, "F");
    doc2.setTextColor(255,255,255);
    doc2.setFontSize(16); doc2.setFont("helvetica","bold");
    doc2.text("BON D'INTERVENTION", 50, 12);
    doc2.setFontSize(9); doc2.setFont("helvetica","normal");
    doc2.text("Cocon+ — 0596 73 66 66 | www.cocon-plus.fr", 50, 20);
    doc2.text("N° " + bon.ref, mr, 12, { align:"right" });
    doc2.text("Le " + new Date().toLocaleDateString("fr-FR"), mr, 20, { align:"right" });

    let y = 35;
    const section = (title) => {
      doc2.setTextColor(53,180,153); doc2.setFontSize(9); doc2.setFont("helvetica","bold");
      doc2.text(title, ml, y); y += 3;
      doc2.setDrawColor(53,180,153); doc2.line(ml, y, mr, y); y += 5;
      doc2.setTextColor(60,60,60); doc2.setFont("helvetica","normal"); doc2.setFontSize(10);
    };
    const row = (label, val) => { doc2.text(label + " : " + (val || "—"), ml, y); y += 6; };

    section("COLLABORATEUR"); row("Nom", bon.techNom); y += 2;
    section("CLIENT");
    row("Nom", bon.clientNom + " " + bon.clientPrenom);
    row("Téléphone", bon.clientTel); row("Email", bon.clientEmail);
    row("Adresse", bon.clientAdresse); y += 2;
    section("INTERVENTION");
    row("Type", bon.type);
    row("Prévu le", bon.datePrevue + " à " + bon.heurePrevue);
    if (bon.signataire) row("Signataire", bon.signataire);
    row("Arrivée réelle", fmt(bon.heureArrivee));
    row("Fin intervention", fmt(bon.heureFin));
    row("Durée", calcDuree(bon.heureArrivee, bon.heureFin));
    if (bon.geoArrivee) row("Position arrivée", `Lat: ${bon.geoArrivee.lat?.toFixed(5)}, Lng: ${bon.geoArrivee.lng?.toFixed(5)}`);
    y += 2;
    section("OBSERVATIONS");
    const obsC = doc2.splitTextToSize("Cocon+ : " + (bon.obsCocon || "—"), 175);
    doc2.text(obsC, ml, y); y += obsC.length * 5 + 3;
    const obsCl = doc2.splitTextToSize("Client : " + (bon.obsClient || "—"), 175);
    doc2.text(obsCl, ml, y); y += obsCl.length * 5 + 5;
    section("SIGNATURES");
    doc2.setFontSize(9); doc2.text("Collaborateur", ml, y); doc2.text("Client", ml+90, y); y += 3;
    if (bon.signatureTech) { try { doc2.addImage(bon.signatureTech,"PNG",ml,y,80,30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml,y,80,30); }
    if (bon.signatureClient) { try { doc2.addImage(bon.signatureClient,"PNG",ml+90,y,80,30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml+90,y,80,30); }
    doc2.setFontSize(8); doc2.setTextColor(150,150,150);
    doc2.text("Cocon Plus SARL — Berges de Kerlys, 97200 Fort-de-France — SIRET : 47756829900028", W/2, 285, {align:"center"});

    const nomFichier = (bon.ref + "_" + (bon.clientNom||"").toUpperCase() + "_" + (bon.clientPrenom||"").toUpperCase() + "_" + (bon.datePrevue||"") + ".pdf")
      .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-\.]/g, "");
    if (autoSave) doc2.save(nomFichier);
    return doc2.output("datauristring");
  };

  const sendEmail = async (bon) => {
    const fmt = (ts) => ts ? new Date(ts.toDate ? ts.toDate() : ts).toLocaleString("fr-FR") : "—";
    setEmailStatus("sending");
    try {
      await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
        to_email: bon.clientEmail,
        client_nom: bon.clientNom + " " + bon.clientPrenom,
        client_tel: bon.clientTel || "—",
        client_email: bon.clientEmail || "—",
        adresse_facturation: bon.adresseFacturation || "—",
        adresse_intervention: bon.adresseIntervention || bon.clientAdresse || "—",
        signataire: bon.signataire || "Client",
        demande_client: bon.demandeClient || "—",
        num_devis: bon.numDevis || "—",
        ref: bon.ref,
        type: bon.type,
        date_prevue: bon.datePrevue,
        heure_prevue: bon.heurePrevue,
        heure_arrivee: fmt(bon.heureArrivee),
        heure_fin: fmt(bon.heureFin),
        collaborateur: bon.techNom,
        observations_cocon: bon.obsCocon || "—",
        observations_client: bon.obsClient || "—",
        signature_tech: bon.signatureTech || "",
        signature_client: bon.signatureClient || "",
      }, EMAILJS_KEY);
      setEmailStatus("sent");
      await updateDoc(doc(db, "bons", bon.id), { emailEnvoye: true });
    } catch(e) {
      console.error("Email error:", e);
      setEmailStatus("error: " + (e?.text || e?.message || JSON.stringify(e)));
    }
  };

  const CHECKLIST = [
    { id: "nettoyage", label: "Nettoyage du chantier effectué", required: true },
    { id: "outils", label: "Outils et matériel récupérés", required: true },
    { id: "produits", label: "Produits utilisés rangés / sécurisés", required: true },
    { id: "consignes", label: "Client informé des consignes post-intervention", required: true },
    { id: "photos", label: "Photos prises", required: false },
    { id: "signature", label: "Bon signé par le client", required: true },
  ];

  const [visiteSupplementaire, setVisiteSupplementaire] = useState(null); // null | true | false

  const checklistValid = CHECKLIST.filter(i => i.required).every(i => checklist[i.id]);

  if (showChecklist) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setShowChecklist(false)}>← Retour</button>
        <h2>Checklist de fin de chantier</h2>
      </div>
      <div className="card">
        <div className="card-title">Vérifications avant clôture</div>
        <div style={{height:4,background:"var(--color-border-tertiary)",borderRadius:2,marginBottom:"1rem"}}>
          <div style={{height:4,background:"#35B499",borderRadius:2,width:(Object.values(checklist).filter(Boolean).length / CHECKLIST.length * 100) + "%",transition:"width .3s"}} />
        </div>
        {CHECKLIST.map(item => (
          <div key={item.id} onClick={() => setChecklist(c => ({...c, [item.id]: !c[item.id]}))}
            style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",cursor:"pointer"}}>
            <div style={{width:24,height:24,borderRadius:6,border:"2px solid #35B499",background:checklist[item.id] ? "#35B499" : "transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
              {checklist[item.id] && <span style={{color:"white",fontSize:13,fontWeight:"bold"}}>✓</span>}
            </div>
            <span style={{fontSize:14,color:checklist[item.id] ? "var(--color-text-secondary)" : "var(--color-text-primary)",textDecoration:checklist[item.id] ? "line-through" : "none",flex:1}}>
              {item.label}
            </span>
            {!item.required && <span style={{fontSize:10,color:"#888",background:"var(--color-background-secondary)",padding:"2px 8px",borderRadius:20,flexShrink:0}}>Optionnel</span>}
          </div>
        ))}
        <p style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:"1rem",fontStyle:"italic"}}>
          Les points obligatoires doivent être cochés pour terminer.
        </p>
      </div>
      {/* Question visite suivante */}
      <div className="card" style={{marginTop:"0.5rem"}}>
        <div className="card-title">Une autre visite sera-t-elle nécessaire ?</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={() => setVisiteSupplementaire(true)}
            style={{flex:1,padding:"10px",borderRadius:8,border:"2px solid",
              borderColor:visiteSupplementaire===true?"#e76f51":"#e0e0e0",
              background:visiteSupplementaire===true?"#fff4f0":"white",
              color:visiteSupplementaire===true?"#e76f51":"#888",
              fontWeight:600,cursor:"pointer",fontSize:14}}>
            Oui
          </button>
          <button onClick={() => setVisiteSupplementaire(false)}
            style={{flex:1,padding:"10px",borderRadius:8,border:"2px solid",
              borderColor:visiteSupplementaire===false?"#2a9d8f":"#e0e0e0",
              background:visiteSupplementaire===false?"#e8f5f3":"white",
              color:visiteSupplementaire===false?"#2a9d8f":"#888",
              fontWeight:600,cursor:"pointer",fontSize:14}}>
            Non
          </button>
        </div>
      </div>

      {!checklistValid && (
        <p style={{color:"#e74c3c",fontSize:12,textAlign:"center",marginBottom:8}}>
          ⚠️ Veuillez cocher tous les points obligatoires
        </p>
      )}
      {visiteSupplementaire === null && (
        <p style={{color:"#e74c3c",fontSize:12,textAlign:"center",marginBottom:8}}>
          ⚠️ Veuillez répondre à la question sur la visite suivante
        </p>
      )}
      <button className="btn-finish" style={{width:"100%",opacity:(checklistValid && visiteSupplementaire !== null) ? 1 : 0.4}} disabled={saving || !checklistValid || visiteSupplementaire === null} onClick={terminer}>
        {saving ? "Finalisation…" : "✅ Terminer le chantier"}
      </button>
    </div>
  );

  if (showSuccess) return (
    <div className="container" style={{textAlign:"center",paddingTop:"3rem"}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"#35B499",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1.5rem",fontSize:36}}>✓</div>
      <h2 style={{color:"#35B499",marginBottom:8}}>Intervention terminée !</h2>
      <p style={{color:"var(--color-text-secondary)",fontSize:14,marginBottom:8}}>Le bon a été enregistré avec succès.</p>
      {emailStatus === "sent" && (
        <p style={{color:"#35B499",fontSize:14,marginBottom:24}}>✉️ Email envoyé au client</p>
      )}
      {emailStatus.startsWith("error") && (
        <p style={{color:"#e74c3c",fontSize:13,marginBottom:24}}>⚠️ Erreur envoi email — le bon est bien enregistré</p>
      )}
      {!selected.clientEmail && (
        <p style={{color:"#888",fontSize:13,marginBottom:24}}>Aucun email client renseigné</p>
      )}
      <button className="btn-primary" onClick={() => { setShowSuccess(false); setView("list"); }}>
        Retour à mes interventions
      </button>
    </div>
  );

  const startSig = (mode) => {
    setSigMode(mode);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - r.left) * (canvas.width / r.width), y: (src.clientY - r.top) * (canvas.height / r.height) };
      };
      canvas.onmousedown = canvas.ontouchstart = (e) => { e.preventDefault(); drawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      canvas.onmousemove = canvas.ontouchmove = (e) => { e.preventDefault(); if (!drawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      canvas.onmouseup = canvas.ontouchend = () => { drawing.current = false; };
    }, 100);
  };

  const saveSig = () => {
    const canvas = canvasRef.current;
    const compressed = document.createElement("canvas");
    compressed.width = 280;
    compressed.height = 100;
    const ctx2 = compressed.getContext("2d");
    ctx2.fillStyle = "white";
    ctx2.fillRect(0, 0, 280, 100);
    ctx2.drawImage(canvas, 0, 0, 280, 100);
    const data = compressed.toDataURL("image/jpeg", 0.3);
    if (sigMode === "tech") setSigTech(data);
    else setSigClient(data);
    setSigMode(null);
  };

  const fmt = (ts) => ts ? new Date(ts.toDate()).toLocaleString("fr-FR") : "—";
  const statutColor = (s) => ({ "planifié":"#d4f0ea","en cours":"#e8c9b8","terminé":"#35B499" }[s] || "#eee");
  const statutText = (s) => ({ "planifié":"#1a7a65","en cours":"#6b4a31","terminé":"white" }[s] || "#333");

  if (sigMode) return (
    <div className="container">
      <div className="page-header">
        <h2>Signature — {sigMode === "tech" ? "Collaborateur" : "Client"}</h2>
      </div>
      <div className="card" style={{textAlign:"center"}}>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12}}>Signez dans le cadre ci-dessous</p>
        <canvas ref={canvasRef} width={560} height={200} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,width:"100%",touchAction:"none",background:"white"}} />
        <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center"}}>
          <button className="btn-outline" onClick={() => setSigMode(null)}>Annuler</button>
          <button className="btn-primary" onClick={saveSig}>Valider la signature</button>
        </div>
      </div>
    </div>
  );

  if (view === "bon" && selected) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
        <h2>{selected.ref}</h2>
        <span className="badge" style={{background:statutColor(selected.statut),color:statutText(selected.statut)}}>{selected.statut}</span>
      </div>

      <div className="card readonly">
        <div className="card-title">Client <span className="locked-badge">🔒 Admin</span></div>
        <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
        <div className="info-row"><span>Téléphone</span><b>{selected.clientTel || "—"}</b></div>
        <div className="info-row"><span>Email</span><b>{selected.clientEmail || "—"}</b></div>
        <div className="info-row"><span>Adresse</span><b>
          {selected.adresseIntervention || selected.clientAdresse ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.adresseIntervention || selected.clientAdresse)}`}
              target="_blank" rel="noreferrer"
              style={{color:"#2a9d8f", textDecoration:"underline", cursor:"pointer"}}>
              {selected.adresseIntervention || selected.clientAdresse} 📍
            </a>
          ) : "—"}
        </b></div>
      </div>

      <div className="card readonly">
        <div className="card-title">Intervention <span className="locked-badge">🔒 Admin</span></div>
        <div className="info-row"><span>Type</span><b>{selected.type}</b></div>
        <div className="info-row"><span>Prévu le</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
        <div className="info-row"><span>Collaborateur</span><b>{selected.techNom}</b></div>
        {selected.numVisite && <div className="info-row"><span>N° Visite</span><b style={{color:"#2a9d8f"}}>{selected.numVisite}</b></div>}
      </div>

      {selected.demandeClient && (
        <div className="card readonly">
          <div className="card-title">Demande client <span className="locked-badge">🔒 Admin</span></div>
          <p style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.6}}>{selected.demandeClient}</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Suivi</div>
        <div className="info-row"><span>Arrivée réelle</span><b>{fmt(selected.heureArrivee)}</b></div>
        <div className="info-row"><span>Fin intervention</span><b>{fmt(selected.heureFin)}</b></div>
        {selected.heureArrivee && selected.heureFin && (
          <div className="info-row">
            <span>Durée</span>
            <b style={{color:"#35B499"}}>{calcDuree(selected.heureArrivee, selected.heureFin)}</b>
          </div>
        )}
        {selected.geoArrivee && (
          <div className="info-row">
            <span>Position arrivée</span>
            <b style={{fontSize:12}}>📍 {selected.geoArrivee.lat?.toFixed(4)}, {selected.geoArrivee.lng?.toFixed(4)}</b>
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          {selected.statut === "planifié" && (
            bons.some(b => b.statut === "en cours" && b.id !== selected.id)
              ? <p style={{color:"#e76f51",fontSize:13,fontWeight:600,padding:"10px 14px",background:"#fff4f0",borderRadius:8,width:"100%",textAlign:"center"}}>
                  ⚠️ Vous avez déjà une intervention en cours.
                </p>
              : <button className="btn-arrive" disabled={saving} onClick={arriver}>
                  📍 Arrivé sur le chantier
                </button>
          )}
          {selected.statut === "terminé" && selected.emailEnvoye && (
            <p style={{color:"#35B499",fontSize:13,marginTop:4}}>✅ Email envoyé au client</p>
          )}
        </div>
        {emailStatus === "sent" && <p style={{color:"#35B499",fontSize:13,marginTop:8}}>✅ Email envoyé au client !</p>}
        {emailStatus.startsWith("error") && <p style={{color:"#e74c3c",fontSize:11,marginTop:8,wordBreak:"break-all"}}>⚠️ {emailStatus}</p>}
        {emailStatus === "sending" && <p style={{color:"#888",fontSize:13,marginTop:8}}>Envoi de l'email…</p>}
      </div>

      {selected.statut !== "planifié" && (
        <>
          <div className="card">
            <div className="card-title">Observations</div>
            <div className="field" style={{marginBottom:12}}>
              <label>Commentaires Cocon+</label>
              <textarea value={obsCocon} onChange={e=>setObsCocon(e.target.value)} placeholder="Travaux réalisés, constats…" disabled={selected.statut === "terminé"} />
            </div>
            <div className="field">
              <label>Commentaires client</label>
              <textarea value={obsClient} onChange={e=>setObsClient(e.target.value)} placeholder="Retour du client…" disabled={selected.statut === "terminé"} />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Signatures</div>
            <div className="row2">
              <div>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>Collaborateur</p>
                {sigTech ? <img src={sigTech} alt="sig" style={{width:"100%",height:70,objectFit:"contain",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}} /> : <div className="sig-placeholder-sm">Non signé</div>}
                {selected.statut !== "terminé" && <button className="btn-outline sm" style={{marginTop:6}} onClick={()=>startSig("tech")}>Signer</button>}
              </div>
              <div>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>Client</p>
                {selected.statut !== "terminé" && (
                  <div style={{marginBottom:6}}>
                    <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:3}}>Nom du signataire</label>
                    <input
                      type="text"
                      placeholder={selected.clientNom + " " + selected.clientPrenom}
                      value={signataireNom || selected.clientNom + " " + selected.clientPrenom}
                      onChange={e => setSignataireNom(e.target.value)}
                      style={{width:"100%",padding:"6px 10px",fontSize:12,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}
                    />
                  </div>
                )}
                {selected.statut === "terminé" && selected.signataire && (
                  <p style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:4}}>{selected.signataire}</p>
                )}
                {sigClient ? <img src={sigClient} alt="sig" style={{width:"100%",height:70,objectFit:"contain",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}} /> : <div className="sig-placeholder-sm">Non signé</div>}
                {selected.statut !== "terminé" && <button className="btn-outline sm" style={{marginTop:6}} onClick={()=>startSig("cli")}>Signer</button>}
              </div>
            </div>
          </div>

          {selected.statut !== "terminé" && (
            <button className="btn-outline" style={{width:"100%",marginBottom:10}} disabled={saving} onClick={sauvegarder}>
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          )}
          {selected.statut === "en cours" && (
            <div>
              {(!sigTech || !sigClient) && (
                <p style={{color:"#e74c3c",fontSize:12,marginBottom:8,textAlign:"center"}}>
                  ⚠️ Les deux signatures sont requises pour continuer
                </p>
              )}
              <button className="btn-finish" style={{width:"100%",opacity:(!sigTech || !sigClient) ? 0.4 : 1}} disabled={!sigTech || !sigClient} onClick={() => { sauvegarder(); setShowChecklist(true); }}>
                Valider la checklist →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="container">
      <div className="page-header"><h2>Mes interventions du jour</h2></div>
      {bons.length === 0 ? (
        <div className="empty-state">Aucun bon assigné pour aujourd'hui.</div>
      ) : (
        bons.map(b => (
          <div key={b.id} className="bon-card" onClick={() => openBon(b)}>
            <div className="bon-card-top">
              <span className="bon-ref">{b.ref}</span>
              <span className="badge" style={{background:statutColor(b.statut),color:statutText(b.statut)}}>{b.statut}</span>
            </div>
            <div className="bon-card-body">
              <b>{b.clientNom} {b.clientPrenom}</b>
              <span>{b.type}</span>
            </div>
            <div className="bon-card-footer">
              <span>Prévu : {b.datePrevue} à {b.heurePrevue}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
