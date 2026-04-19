import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  Timestamp, doc, updateDoc, deleteDoc,
} from "firebase/firestore";
import logoBase64 from "../logoBase64";
import ContratModule from "./ContratModule";

// ── CONSTANTES ───────────────────────────────────────────────────────────────

const TYPES = [
  "Désinsectisation", "Dératisation", "Traitement anti-termites",
  "Traitement anti-chauves-souris", "Désinfection", "Étanchéité / Toiture",
];

const DRIVE_WEBHOOK = "https://script.google.com/macros/s/AKfycbza4QR7FaxPNlYv_cFeOEhoRJfKX_HQzH2NSaKsX-lSZNZSMb-_ikfUKxzUZeb5S0J1/exec";

const EMPTY_FORM = {
  clientSociete: "", clientNom: "", clientPrenom: "", clientTel: "", clientEmail: "",
  adresseFacturation: "", adresseIntervention: "",
  demandeClient: "", numDevis: "", signataire: "",
  types: [], datePrevue: "", heurePrevue: "", techId: "",
  numVisite: "1", montantFacture: "",
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

const sc  = (s) => ({ "planifié":"#d4f0ea","en cours":"#e8c9b8","terminé":"#35B499" }[s] || "#eee");
const st  = (s) => ({ "planifié":"#1a7a65","en cours":"#6b4a31","terminé":"white"  }[s] || "#333");
const fmt = (ts) => ts ? new Date(ts.toDate()).toLocaleString("fr-FR") : "—";

const calcDuree = (arrivee, fin) => {
  if (!arrivee || !fin) return "—";
  const diff = fin.toDate() - arrivee.toDate();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? h + "h" + m.toString().padStart(2, "0") : m + " min";
};

// ── STYLES SIDEBAR ────────────────────────────────────────────────────────────

const S = {
  root:    { display:"flex", minHeight:"100vh", fontFamily:"inherit" },
  sidebar: {
    width:220, background:"#111d1b", display:"flex", flexDirection:"column",
    flexShrink:0, position:"sticky", top:0, height:"100vh", overflowY:"auto",
  },
  logoArea:{ padding:"20px 18px 16px", borderBottom:"0.5px solid rgba(255,255,255,0.07)" },
  logoMark:{ fontFamily:"Georgia, serif", fontSize:22, fontWeight:700, color:"#35B499", letterSpacing:"-0.5px", lineHeight:1 },
  logoSub: { fontSize:9, color:"rgba(255,255,255,0.28)", letterSpacing:"2px", textTransform:"uppercase", marginTop:3 },
  nav:     { flex:1, padding:"10px 0" },
  navSec:  { fontSize:9, color:"rgba(255,255,255,0.22)", letterSpacing:"1.8px", textTransform:"uppercase", padding:"14px 18px 5px" },
  navItem: (active) => ({
    display:"flex", alignItems:"center", gap:9, padding:"9px 18px",
    fontSize:12, cursor:"pointer", position:"relative",
    color: active ? "white" : "rgba(255,255,255,0.42)",
    background: active ? "rgba(53,180,153,0.12)" : "transparent",
  }),
  navBar:  { position:"absolute", left:0, top:2, bottom:2, width:2.5, background:"#35B499", borderRadius:"0 2px 2px 0" },
  navPip:  (color) => ({ width:5, height:5, borderRadius:"50%", background:color, flexShrink:0 }),
  navBadge:{ marginLeft:"auto", background:"#8B6A4E", color:"white", fontSize:9, fontWeight:600, padding:"1px 6px", borderRadius:20 },
  userArea:{ padding:"12px 18px", borderBottom:"none", borderTop:"0.5px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:8 },
  avatar:  { width:28, height:28, borderRadius:"50%", background:"#8B6A4E", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"white", fontWeight:600, flexShrink:0 },
  main:    { flex:1, overflowY:"auto", background:"var(--color-background-primary, #fafafa)" },
};

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────

export default function AdminDashboard({ user }) {
  const [bons,          setBons]          = useState([]);
  const [view,          setView]          = useState("dashboard");
  const [selected,      setSelected]      = useState(null);
  const [search,        setSearch]        = useState("");
  const [filter,        setFilter]        = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode,      setEditMode]      = useState(false);
  const [editForm,      setEditForm]      = useState({});
  const [saving,        setSaving]        = useState(false);
  const [msg,           setMsg]           = useState("");
  const [driveProgress, setDriveProgress] = useState(null);
  const [driveSending,  setDriveSending]  = useState(false);
  const [form,          setForm]          = useState({ ...EMPTY_FORM });

  const today = new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });

  useEffect(() => { fetchBons(); }, []);

  // ── FIRESTORE ───────────────────────────────────────────────────────────────

  const fetchBons = async () => {
    const q = query(collection(db, "bons"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setBons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const refNum = () => "INT-" + Date.now().toString().slice(-6);

  const createBon = async (e) => {
    e.preventDefault();
    if (form.types.length === 0) { alert("Sélectionnez au moins un type d'intervention"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "bons"), {
        clientSociete:       form.clientSociete || "",
        clientNom:           form.clientNom,
        clientPrenom:        form.clientPrenom,
        clientTel:           form.clientTel,
        clientEmail:         form.clientEmail,
        adresseFacturation:  form.adresseFacturation,
        adresseIntervention: form.adresseIntervention,
        clientAdresse:       form.adresseIntervention,
        demandeClient:       form.demandeClient,
        numDevis:            form.numDevis,
        signataire:          form.signataire || "",
        types:               form.types,
        type:                form.types.join(", "),
        datePrevue:          form.datePrevue,
        heurePrevue:         form.heurePrevue,
        techNom:             form.techId,
        ref:                 form.numDevis ? "INT-" + form.numDevis.replace(/\D/g, "").slice(-5) : refNum(),
        statut:              "planifié",
        createdAt:           Timestamp.now(),
        createdBy:           user?.uid || "",
        heureArrivee:        null,
        heureFin:            null,
        obsCocon:            "",
        obsClient:           "",
        signatureTech:       null,
        signatureClient:     null,
        emailEnvoye:         false,
        montantFacture:      form.montantFacture ? parseFloat(form.montantFacture) : null,
        numVisite:           form.numVisite || "1",
      });
      await fetchBons();
      setForm({ ...EMPTY_FORM });
      flashMsg("✅ Bon créé !");
      setView("dashboard");
    } catch (err) {
      alert("Erreur : " + (err?.message || JSON.stringify(err)));
    } finally { setSaving(false); }
  };

  const deleteBon = async () => {
    await deleteDoc(doc(db, "bons", selected.id));
    setConfirmDelete(false);
    setSelected(null);
    setView("list");
    fetchBons();
  };

  const saveEdit = async () => {
    setSaving(true);
    await updateDoc(doc(db, "bons", selected.id), {
      clientSociete:       editForm.clientSociete || "",
      clientNom:           editForm.clientNom,
      clientPrenom:        editForm.clientPrenom,
      clientTel:           editForm.clientTel,
      clientEmail:         editForm.clientEmail,
      adresseFacturation:  editForm.adresseFacturation,
      adresseIntervention: editForm.adresseIntervention,
      clientAdresse:       editForm.adresseIntervention,
      demandeClient:       editForm.demandeClient,
      numDevis:            editForm.numDevis,
      signataire:          editForm.signataire || "",
      datePrevue:          editForm.datePrevue,
      heurePrevue:         editForm.heurePrevue,
      techNom:             editForm.techId,
      types:               editForm.types,
      type:                editForm.types.join(", "),
    });
    const updated = { ...selected, ...editForm, techNom: editForm.techId, type: editForm.types.join(", ") };
    setSelected(updated);
    setEditMode(false);
    fetchBons();
    setSaving(false);
  };

  // ── DRIVE ────────────────────────────────────────────────────────────────────

  const sendBonsToDrive = async () => {
    const aEnvoyer = bons.filter(b => b.statut === "terminé" && !b.driveEnvoye);
    if (aEnvoyer.length === 0) { alert("Tous les bons terminés ont déjà été envoyés vers Drive !"); return; }
    setDriveSending(true);
    setDriveProgress({ total: aEnvoyer.length, done: 0, errors: 0 });
    let done = 0, errors = 0;
    for (const bon of aEnvoyer) {
      try {
        const pdfDataUri = await downloadPDF(bon, false);
        const base64 = pdfDataUri.split(",")[1];
        const nom = (bon.ref + "_" + bon.clientNom + "_" + bon.clientPrenom + "_" + bon.datePrevue + ".pdf")
          .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-.]/g, "");
        await fetch(DRIVE_WEBHOOK, {
          method:"POST", mode:"no-cors",
          headers:{ "Content-Type":"text/plain" },
          body: JSON.stringify({ pdf: base64, nom }),
        });
        await updateDoc(doc(db, "bons", bon.id), { driveEnvoye: true });
        done++;
      } catch(e) { errors++; }
      setDriveProgress({ total: aEnvoyer.length, done: done + errors, errors });
    }
    await fetchBons();
    setDriveSending(false);
    setDriveProgress(null);
    flashMsg(errors === 0
      ? `✅ ${done} bon${done > 1 ? "s" : ""} envoyé${done > 1 ? "s" : ""} vers Drive !`
      : `⚠️ ${done} envoyé${done > 1 ? "s" : ""}, ${errors} erreur${errors > 1 ? "s" : ""}`
    );
  };

  // ── PDF ──────────────────────────────────────────────────────────────────────

  const downloadPDF = async (bon, autoSave = true) => {
    const { jsPDF } = await import("jspdf");
    const doc2 = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
    const W = 210, ml = 15, mr = 195;
    try { doc2.addImage(logoBase64, "PNG", ml, 5, 28, 22); } catch(e) {}
    doc2.setFillColor(53, 180, 153);
    doc2.rect(45, 0, W - 45, 28, "F");
    doc2.setTextColor(255, 255, 255);
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
    const row = (label, val) => {
      if (y > 260) { doc2.addPage(); y = 20; }
      doc2.text(label + " : " + (val || "—"), ml, y); y += 6;
    };
    section("INFORMATIONS");
    row("Référence", bon.ref);
    if (bon.numDevis)  row("N° Devis",  bon.numDevis);
    if (bon.numVisite) row("N° Visite", bon.numVisite);
    row("Collaborateur", bon.techNom); y += 2;
    section("CLIENT");
    if (bon.clientSociete) row("Société", bon.clientSociete);
    row("Nom", bon.clientNom + " " + bon.clientPrenom);
    row("Téléphone", bon.clientTel); row("Email", bon.clientEmail);
    if (bon.adresseFacturation) row("Adresse facturation", bon.adresseFacturation);
    row("Adresse intervention", bon.adresseIntervention || bon.clientAdresse); y += 2;
    if (bon.demandeClient) {
      section("DEMANDE CLIENT");
      const d = doc2.splitTextToSize(bon.demandeClient, 175);
      doc2.text(d, ml, y); y += d.length * 5 + 5;
    }
    section("INTERVENTION");
    row("Type", bon.type);
    row("Prévu le", bon.datePrevue + " à " + bon.heurePrevue);
    row("Arrivée réelle", fmt(bon.heureArrivee));
    row("Fin intervention", fmt(bon.heureFin));
    row("Durée", calcDuree(bon.heureArrivee, bon.heureFin));
    if (bon.geoArrivee) row("Position arrivée", `Lat: ${bon.geoArrivee.lat?.toFixed(5)}, Lng: ${bon.geoArrivee.lng?.toFixed(5)}`);
    if (bon.geoFin)     row("Position fin",    `Lat: ${bon.geoFin.lat?.toFixed(5)}, Lng: ${bon.geoFin.lng?.toFixed(5)}`);
    y += 2;
    section("COMPTE RENDU D'INTERVENTION");
    const obsC  = doc2.splitTextToSize("Cocon+ : " + (bon.obsCocon  || "—"), 175);
    doc2.text(obsC, ml, y); y += obsC.length * 5 + 3;
    const obsCl = doc2.splitTextToSize("Client : " + (bon.obsClient || "—"), 175);
    doc2.text(obsCl, ml, y); y += obsCl.length * 5 + 5;
    section("SIGNATURES");
    doc2.setFontSize(9); doc2.text("Collaborateur", ml, y); doc2.text("Client", ml + 90, y); y += 3;
    if (bon.signatureTech)   { try { doc2.addImage(bon.signatureTech,  "PNG", ml,      y, 80, 30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml, y, 80, 30); }
    if (bon.signatureClient) { try { doc2.addImage(bon.signatureClient,"PNG", ml + 90, y, 80, 30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml + 90, y, 80, 30); }
    doc2.setFontSize(8); doc2.setTextColor(150,150,150);
    doc2.text("Cocon Plus SARL — Berges de Kerlys, 97200 Fort-de-France — SIRET : 47756829900028", W/2, 285, { align:"center" });
    const clientLabel = bon.clientSociete
      ? bon.clientSociete.toUpperCase()
      : (bon.clientNom||"").toUpperCase() + "_" + (bon.clientPrenom||"").toUpperCase();
    const nomFichier = (bon.ref + "_" + clientLabel + "_" + (bon.datePrevue||"") + ".pdf")
      .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-.]/g, "");
    if (autoSave) doc2.save(nomFichier);
    return doc2.output("datauristring");
  };

  // ── WHATSAPP ─────────────────────────────────────────────────────────────────

  const demanderAvis = (bon) => {
    const prenom = bon.clientPrenom || bon.clientNom || "client";
    const raw = (bon.clientTel || "").replace(/\s/g, "");
    let tel = raw;
    if (raw.startsWith("+")) tel = raw.slice(1);
    else if (raw.startsWith("0696")) tel = "596" + raw.slice(1);
    else if (raw.startsWith("06") || raw.startsWith("07")) tel = "33" + raw.slice(1);
    else tel = "596" + raw.slice(1);
    const message = encodeURIComponent(
      `🌿 Bonjour ${prenom},\n\nNous venons de réaliser votre ${bon.type} et espérons que tout s'est bien passé !\n\nSi vous souhaitez partager votre expérience, un avis Google nous aiderait beaucoup — cela ne prend qu'une minute 🙏\n👉 https://g.page/r/CcTWB8zHSCPzEAE/review\n\nMerci pour votre confiance,\nCocon Plus SARL`
    );
    window.open(`https://web.whatsapp.com/send?phone=${tel}&text=${message}`, "_blank");
  };

  // ── STATS & FILTRES ───────────────────────────────────────────────────────────

  const stats = {
    planifie:   bons.filter(b => b.statut === "planifié").length,
    enCours:    bons.filter(b => b.statut === "en cours").length,
    termine:    bons.filter(b => b.statut === "terminé").length,
    aujourdhui: bons.filter(b => b.datePrevue === today).length,
    semaine:    bons.filter(b => {
      const now   = new Date();
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      const end   = new Date(start); end.setDate(start.getDate() + 6);
      const d     = new Date(b.datePrevue);
      return d >= start && d <= end;
    }).length,
  };

  const filteredBons = bons.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (b.clientNom + " " + b.clientPrenom).toLowerCase().includes(q) ||
      b.ref?.toLowerCase().includes(q) ||
      b.numDevis?.toLowerCase().includes(q) ||
      b.type?.toLowerCase().includes(q) ||
      b.techNom?.toLowerCase().includes(q) ||
      b.statut?.toLowerCase().includes(q);
    const now   = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    const matchFilter = !filter ||
      (filter === "planifié"   && b.statut === "planifié") ||
      (filter === "en cours"   && b.statut === "en cours") ||
      (filter === "terminé"    && b.statut === "terminé")  ||
      (filter === "aujourdhui" && b.datePrevue === today)  ||
      (filter === "semaine"    && new Date(b.datePrevue) >= start && new Date(b.datePrevue) <= end);
    return matchSearch && matchFilter;
  });

  const flashMsg = (text) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };

  // ── BON CARD (liste mobile) ───────────────────────────────────────────────────

  const BonCard = ({ b, onClick }) => (
    <div className="bon-card" onClick={onClick}>
      <div className="bon-card-top">
        <span className="bon-ref">{b.ref}{b.numDevis ? " · " + b.numDevis : ""}</span>
        <span className="badge" style={{ background:sc(b.statut), color:st(b.statut) }}>{b.statut}</span>
      </div>
      <div className="bon-card-body">
        <b>{b.clientSociete ? <span style={{display:"block",fontSize:11,color:"#2a9d8f",fontWeight:600}}>{b.clientSociete}</span> : null}{b.clientNom} {b.clientPrenom}</b>
        <span>{b.type}</span>
      </div>
      <div className="bon-card-footer"><span>{b.datePrevue} à {b.heurePrevue}</span><span>{b.techNom}</span></div>
    </div>
  );

  // ── CONTENU PRINCIPAL (vues) ──────────────────────────────────────────────────

  const renderContent = () => {

    // Contrats
    if (view === "contrats") return <ContratModule />;

    // Nouveau bon
    if (view === "new") return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setView("dashboard")}>← Retour</button>
          <h2>Nouveau bon d'intervention</h2>
        </div>
        <form onSubmit={createBon}>
          <div className="card">
            <div className="card-title">Informations générales</div>
            <div className="row2">
              <div className="field"><label>N° Devis</label><input value={form.numDevis} onChange={e=>setForm({...form,numDevis:e.target.value})} placeholder="ex: DEV-2026-001" /></div>
              <div className="field"><label>Date prévue</label><input type="date" required value={form.datePrevue} onChange={e=>setForm({...form,datePrevue:e.target.value})} /></div>
            </div>
            <div className="row2">
              <div className="field">
                <label>N° de visite <span style={{fontWeight:400,fontSize:12,color:"#888"}}>ex: 1, 2/3</span></label>
                <input value={form.numVisite} onChange={e=>setForm({...form,numVisite:e.target.value})} placeholder="1" />
              </div>
              <div className="field">
                <label>Montant facturé (€) <span style={{fontWeight:400,fontSize:12,color:"#888"}}>optionnel</span></label>
                <input type="number" step="0.01" placeholder="ex : 250.00" value={form.montantFacture} onChange={e=>setForm({...form,montantFacture:e.target.value})} />
              </div>
            </div>
            <div className="row2">
              <div className="field"><label>Heure prévue</label><input type="time" required value={form.heurePrevue} onChange={e=>setForm({...form,heurePrevue:e.target.value})} /></div>
              <div className="field">
                <label>Collaborateur assigné</label>
                <select required value={form.techId} onChange={e=>setForm({...form,techId:e.target.value})}>
                  <option value="">-- Sélectionner --</option>
                  <option value="Dimitri">Dimitri</option>
                  <option value="Georges">Georges</option>
                  <option value="Equipe">Equipe</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Client</div>
            <div className="field"><label>Société <span style={{fontWeight:400,fontSize:12,color:"#888"}}>optionnel</span></label><input value={form.clientSociete} onChange={e=>setForm({...form,clientSociete:e.target.value})} placeholder="Nom de l'entreprise" /></div>
            <div className="row2">
              <div className="field"><label>Nom</label><input required value={form.clientNom} onChange={e=>setForm({...form,clientNom:e.target.value})} /></div>
              <div className="field"><label>Prénom</label><input required value={form.clientPrenom} onChange={e=>setForm({...form,clientPrenom:e.target.value})} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>Téléphone</label><input value={form.clientTel} onChange={e=>setForm({...form,clientTel:e.target.value})} /></div>
              <div className="field"><label>Email</label><input type="email" value={form.clientEmail} onChange={e=>setForm({...form,clientEmail:e.target.value})} /></div>
            </div>
            <div className="field"><label>Adresse de facturation</label><input value={form.adresseFacturation} onChange={e=>setForm({...form,adresseFacturation:e.target.value})} /></div>
            <div className="field"><label>Adresse d'intervention</label><input required value={form.adresseIntervention} onChange={e=>setForm({...form,adresseIntervention:e.target.value})} /></div>
            <div className="field"><label>Signataire si différent du client</label><input value={form.signataire} onChange={e=>setForm({...form,signataire:e.target.value})} /></div>
          </div>
          <div className="card">
            <div className="card-title">Demande client</div>
            <div className="field"><textarea value={form.demandeClient} onChange={e=>setForm({...form,demandeClient:e.target.value})} placeholder="Contexte, motif, demandes spécifiques…" /></div>
          </div>
          <div className="card">
            <div className="card-title">Type(s) d'intervention</div>
            <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:10}}>Sélection multiple possible</p>
            <div className="types-grid">
              {TYPES.map(t => (
                <button key={t} type="button"
                  className={"type-btn" + (form.types.includes(t) ? " active" : "")}
                  onClick={() => setForm(f => ({ ...f, types: f.types.includes(t) ? f.types.filter(x=>x!==t) : [...f.types,t] }))}>
                  {form.types.includes(t) ? "✓ " : ""}{t}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{width:"100%",marginBottom:24}} disabled={saving}>
            {saving ? "Création…" : "Créer le bon d'intervention"}
          </button>
        </form>
      </div>
    );

    // Modifier un bon (edit mode)
    if (view === "detail" && selected && editMode) return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setEditMode(false)}>← Annuler</button>
          <h2>Modifier — {selected.ref}</h2>
        </div>
        <div className="card">
          <div className="card-title">Informations générales</div>
          <div className="row2">
            <div className="field"><label>N° Devis</label><input value={editForm.numDevis} onChange={e=>setEditForm({...editForm,numDevis:e.target.value})} /></div>
            <div className="field"><label>Date prévue</label><input type="date" value={editForm.datePrevue} onChange={e=>setEditForm({...editForm,datePrevue:e.target.value})} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Heure prévue</label><input type="time" value={editForm.heurePrevue} onChange={e=>setEditForm({...editForm,heurePrevue:e.target.value})} /></div>
            <div className="field"><label>Collaborateur</label>
              <select value={editForm.techId} onChange={e=>setEditForm({...editForm,techId:e.target.value})}>
                <option value="Dimitri">Dimitri</option>
                <option value="Georges">Georges</option>
                <option value="Equipe">Equipe</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Client</div>
          <div className="field"><label>Société</label><input value={editForm.clientSociete||""} onChange={e=>setEditForm({...editForm,clientSociete:e.target.value})} /></div>
          <div className="row2">
            <div className="field"><label>Nom</label><input value={editForm.clientNom} onChange={e=>setEditForm({...editForm,clientNom:e.target.value})} /></div>
            <div className="field"><label>Prénom</label><input value={editForm.clientPrenom} onChange={e=>setEditForm({...editForm,clientPrenom:e.target.value})} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Téléphone</label><input value={editForm.clientTel} onChange={e=>setEditForm({...editForm,clientTel:e.target.value})} /></div>
            <div className="field"><label>Email</label><input value={editForm.clientEmail} onChange={e=>setEditForm({...editForm,clientEmail:e.target.value})} /></div>
          </div>
          <div className="field"><label>Adresse facturation</label><input value={editForm.adresseFacturation} onChange={e=>setEditForm({...editForm,adresseFacturation:e.target.value})} /></div>
          <div className="field"><label>Adresse intervention</label><input value={editForm.adresseIntervention} onChange={e=>setEditForm({...editForm,adresseIntervention:e.target.value})} /></div>
          <div className="field"><label>Signataire</label><input value={editForm.signataire||""} onChange={e=>setEditForm({...editForm,signataire:e.target.value})} /></div>
        </div>
        <div className="card">
          <div className="card-title">Demande client</div>
          <div className="field"><textarea value={editForm.demandeClient} onChange={e=>setEditForm({...editForm,demandeClient:e.target.value})} /></div>
        </div>
        <div className="card">
          <div className="card-title">Type(s) d'intervention</div>
          <div className="types-grid">
            {TYPES.map(t => (
              <button key={t} type="button"
                className={"type-btn" + (editForm.types.includes(t) ? " active" : "")}
                onClick={() => setEditForm(f => ({ ...f, types: f.types.includes(t) ? f.types.filter(x=>x!==t) : [...f.types,t] }))}>
                {editForm.types.includes(t) ? "✓ " : ""}{t}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary" style={{width:"100%",marginBottom:24}} disabled={saving} onClick={saveEdit}>
          {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
        </button>
      </div>
    );

    // Détail d'un bon
    if (view === "detail" && selected) return (
      <div className="container">
        {confirmDelete && (
          <div style={{background:"#fdecea",border:"1px solid #f5c6cb",borderRadius:10,padding:"1rem",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <span style={{color:"#c0392b",fontSize:14,fontWeight:500}}>Confirmer la suppression ?</span>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
              <button style={{background:"#c0392b",color:"white",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13}} onClick={deleteBon}>Supprimer définitivement</button>
            </div>
          </div>
        )}
        <div className="page-header">
          <button className="btn-back" onClick={() => { setView("list"); setSelected(null); setConfirmDelete(false); }}>← Retour</button>
          <h2>{selected.ref}</h2>
          <span className="badge" style={{background:sc(selected.statut),color:st(selected.statut)}}>{selected.statut}</span>
          {selected.statut === "planifié" && !editMode && (
            <button style={{background:"#E1F5EE",color:"#1a7a65",border:"0.5px solid #35B499",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12}}
              onClick={() => {
                setEditForm({
                  clientNom: selected.clientNom, clientPrenom: selected.clientPrenom,
                  clientTel: selected.clientTel, clientEmail: selected.clientEmail,
                  clientSociete: selected.clientSociete || "",
                  adresseFacturation: selected.adresseFacturation || "",
                  adresseIntervention: selected.adresseIntervention || selected.clientAdresse || "",
                  demandeClient: selected.demandeClient || "",
                  numDevis: selected.numDevis || "",
                  signataire: selected.signataire || "",
                  datePrevue: selected.datePrevue, heurePrevue: selected.heurePrevue,
                  techId: selected.techNom, types: selected.types || [],
                });
                setEditMode(true);
              }}>
              Modifier
            </button>
          )}
          <button style={{background:"#fdecea",color:"#c0392b",border:"0.5px solid #f5c6cb",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12,marginLeft:"auto"}}
            onClick={() => setConfirmDelete(true)}>Supprimer</button>
        </div>

        <div className="card">
          <div className="card-title">Informations générales</div>
          {selected.numDevis  && <div className="info-row"><span>N° Devis</span><b>{selected.numDevis}</b></div>}
          {selected.numVisite && <div className="info-row"><span>N° Visite</span><b style={{color:"#2a9d8f"}}>{selected.numVisite}</b></div>}
          {selected.montantFacture && <div className="info-row"><span>Montant facturé</span><b style={{color:"#35B499"}}>{parseFloat(selected.montantFacture).toFixed(2)} €</b></div>}
          <div className="info-row"><span>Référence</span><b>{selected.ref}</b></div>
          <div className="info-row"><span>Date prévue</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
          <div className="info-row"><span>Collaborateur</span><b>{selected.techNom}</b></div>
        </div>

        <div className="card">
          <div className="card-title">Client</div>
          {selected.clientSociete && <div className="info-row"><span>Société</span><b>{selected.clientSociete}</b></div>}
          <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
          <div className="info-row"><span>Téléphone</span><b>{selected.clientTel || "—"}</b></div>
          <div className="info-row"><span>Email</span><b>{selected.clientEmail || "—"}</b></div>
          {selected.signataire && <div className="info-row"><span>Signataire</span><b>{selected.signataire}</b></div>}
          <div className="info-row"><span>Adresse facturation</span><b>
            {selected.adresseFacturation
              ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.adresseFacturation)}`} target="_blank" rel="noreferrer" style={{color:"#2a9d8f",textDecoration:"underline"}}>{selected.adresseFacturation} 📍</a>
              : "—"}
          </b></div>
          <div className="info-row"><span>Adresse intervention</span><b>
            {selected.adresseIntervention || selected.clientAdresse
              ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.adresseIntervention || selected.clientAdresse)}`} target="_blank" rel="noreferrer" style={{color:"#2a9d8f",textDecoration:"underline"}}>{selected.adresseIntervention || selected.clientAdresse} 📍</a>
              : "—"}
          </b></div>
        </div>

        {selected.demandeClient && (
          <div className="card">
            <div className="card-title">Demande client</div>
            <p style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.6}}>{selected.demandeClient}</p>
          </div>
        )}

        <div className="card">
          <div className="card-title">Intervention</div>
          <div className="info-row"><span>Type(s)</span><b>{selected.type}</b></div>
          <div className="info-row"><span>Arrivée réelle</span><b>{fmt(selected.heureArrivee)}</b></div>
          <div className="info-row"><span>Fin</span><b>{fmt(selected.heureFin)}</b></div>
          {selected.heureArrivee && selected.heureFin && (
            <div className="info-row"><span>Durée</span><b style={{color:"#35B499"}}>{calcDuree(selected.heureArrivee, selected.heureFin)}</b></div>
          )}
          {selected.geoArrivee && <div className="info-row"><span>Position arrivée</span><b style={{fontSize:12}}>📍 {selected.geoArrivee.lat?.toFixed(4)}, {selected.geoArrivee.lng?.toFixed(4)}</b></div>}
          {selected.geoFin     && <div className="info-row"><span>Position fin</span><b style={{fontSize:12}}>📍 {selected.geoFin.lat?.toFixed(4)}, {selected.geoFin.lng?.toFixed(4)}</b></div>}
        </div>

        <div className="card">
          <div className="card-title">Compte rendu d'intervention</div>
          <div className="info-row"><span>Cocon+</span><b>{selected.obsCocon || "—"}</b></div>
          <div className="info-row"><span>Client</span><b>{selected.obsClient || "—"}</b></div>
        </div>

        {selected.signatureTech && (
          <div className="card">
            <div className="card-title">Signatures</div>
            <div className="row2">
              <div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Collaborateur</p><img src={selected.signatureTech} alt="" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}} /></div>
              {selected.signatureClient && <div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Client</p><img src={selected.signatureClient} alt="" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}} /></div>}
            </div>
          </div>
        )}

        {selected.statut === "terminé" && (
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:24}}>
            <button className="btn-primary" style={{flex:1}} onClick={() => downloadPDF(selected)}>Télécharger le PDF</button>
            {selected.clientTel && (
              <button onClick={() => demanderAvis(selected)}
                style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"white",border:"none",padding:"12px 16px",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600}}>
                💬 Demander un avis Google
              </button>
            )}
          </div>
        )}
      </div>
    );

    // Liste de tous les bons
    if (view === "list") return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setView("dashboard")}>← Tableau de bord</button>
          <h2>Tous les bons</h2>
          <button className="btn-primary sm" onClick={() => setView("new")}>+ Nouveau</button>
        </div>
        {filter && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:12,color:"#888"}}>Filtre actif :</span>
            <span style={{background:"#35B499",color:"white",fontSize:12,padding:"3px 10px",borderRadius:20}}>{filter}</span>
            <button onClick={() => setFilter("")} style={{background:"transparent",border:"none",color:"#888",cursor:"pointer",fontSize:12}}>✕ Effacer</button>
          </div>
        )}
        <div className="search-bar">
          <input type="text" placeholder="Rechercher par client, référence, devis, type…" value={search} onChange={e => setSearch(e.target.value)}
            style={{width:"100%",padding:"10px 16px",fontSize:14,border:"1px solid #e0e0e0",borderRadius:10,background:"white"}} />
          {search && <span className="search-count">{filteredBons.length} résultat{filteredBons.length > 1 ? "s" : ""}</span>}
        </div>
        {filteredBons.length === 0
          ? <div className="empty-state">Aucun bon trouvé.</div>
          : filteredBons.map(b => <BonCard key={b.id} b={b} onClick={() => { setSelected(b); setView("detail"); }} />)
        }
      </div>
    );

    // ── DASHBOARD (vue par défaut) ─────────────────────────────────────────────

    const bonsAujourdhui = bons.filter(b => b.datePrevue === today)
      .sort((a,b) => (a.heurePrevue||"").localeCompare(b.heurePrevue||""));

    const bonsSemaine = (() => {
      const now  = new Date();
      const day  = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
      const sat  = new Date(mon); sat.setDate(mon.getDate() + 5); sat.setHours(23,59,59,999);
      return bons.filter(b => {
        if (b.datePrevue === today) return false;
        const d = new Date(b.datePrevue + "T00:00:00");
        return d >= mon && d <= sat;
      }).sort((a,b) => a.datePrevue.localeCompare(b.datePrevue) || (a.heurePrevue||"").localeCompare(b.heurePrevue||""));
    })();

    return (
      <div style={{ padding:"24px 28px" }}>

        {/* KPI CARDS */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:24 }}>
          {[
            { label:"Planifiés",      val:stats.planifie,   bg:"#d4f0ea", color:"#1a7a65", key:"planifié"    },
            { label:"En cours",       val:stats.enCours,    bg:"#e8c9b8", color:"#6b4a31", key:"en cours"    },
            { label:"Terminés",       val:stats.termine,    bg:"#35B499", color:"white",   key:"terminé"     },
            { label:"Aujourd'hui",    val:stats.aujourdhui, bg:"#8B6A4E", color:"white",   key:"aujourdhui"  },
            { label:"Cette semaine",  val:stats.semaine,    bg:"#2a9a82", color:"white",   key:"semaine"     },
          ].map(({ label, val, bg, color, key }) => (
            <div key={key}
              onClick={() => { setFilter(f => f === key ? "" : key); setView("list"); }}
              style={{
                background:bg, borderRadius:12, padding:"16px 18px", cursor:"pointer",
                outline: filter === key ? `3px solid ${color === "white" ? "rgba(255,255,255,0.6)" : color}` : "none",
                transition:"transform .1s",
              }}>
              <div style={{fontSize:28,fontWeight:700,color,letterSpacing:"-1px"}}>{val}</div>
              <div style={{fontSize:12,color,opacity:0.85,marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>

        {/* ACTIONS */}
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          <button className="btn-primary" onClick={() => setView("new")}>+ Nouveau bon d'intervention</button>
          <button className="btn-outline" onClick={() => setView("list")}>Tous les bons</button>
          <button className="btn-outline" onClick={sendBonsToDrive} disabled={driveSending}
            style={{background:"#e8f5f3",color:"#1f7a6e",border:"1px solid #2a9d8f"}}>
            {driveSending ? "Envoi en cours…" : "📤 Envoyer vers Drive"}
          </button>
        </div>

        {/* BARRE PROGRESSION DRIVE */}
        {driveProgress && (
          <div style={{marginBottom:16,padding:"12px 16px",background:"#e8f5f3",borderRadius:10,border:"1px solid #2a9d8f"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13,fontWeight:600,color:"#1f7a6e"}}>
              <span>Envoi vers Drive…</span><span>{driveProgress.done} / {driveProgress.total}</span>
            </div>
            <div style={{height:8,background:"#d0ede8",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:99,background:"#2a9d8f",transition:"width .3s",width:(driveProgress.done/driveProgress.total*100)+"%"}} />
            </div>
            {driveProgress.errors > 0 && <p style={{fontSize:11,color:"#e76f51",marginTop:4}}>{driveProgress.errors} erreur(s)</p>}
          </div>
        )}

        {/* TABLE BONS DU JOUR */}
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div className="card-title" style={{margin:0}}>Bons du jour</div>
            <span style={{fontSize:12,color:"#888"}}>{bonsAujourdhui.length} intervention{bonsAujourdhui.length > 1 ? "s" : ""}</span>
          </div>
          {bonsAujourdhui.length === 0
            ? <div className="empty-state" style={{padding:"0.75rem 0"}}>Aucun bon prévu aujourd'hui.</div>
            : <div className="table-wrapper">
                <table className="bons-table">
                  <thead><tr><th>Réf.</th><th>N° Devis</th><th>Client</th><th>Type</th><th>Heure</th><th>Collaborateur</th><th>Montant</th><th>Statut</th><th>PDF</th></tr></thead>
                  <tbody>
                    {bonsAujourdhui.map(b => (
                      <tr key={b.id} onClick={() => { setSelected(b); setView("detail"); }} style={{cursor:"pointer"}}>
                        <td><span className="bon-ref">{b.ref}</span></td>
                        <td style={{fontSize:12,color:"#888"}}>{b.numDevis || "—"}</td>
                        <td>
                          {b.clientSociete && <span style={{color:"#2a9d8f",display:"block",fontSize:11,fontWeight:600}}>{b.clientSociete}</span>}
                          <b style={{display:"block"}}>{b.clientNom} {b.clientPrenom}</b>
                          <span style={{fontSize:11,color:"#888"}}>{b.clientTel}</span>
                        </td>
                        <td style={{fontSize:12}}>{b.type}</td>
                        <td style={{fontSize:13,whiteSpace:"nowrap"}}>{b.heurePrevue}</td>
                        <td style={{fontSize:13}}>{b.techNom}</td>
                        <td style={{fontSize:13,fontWeight:500,color:b.montantFacture ? "#35B499" : "#ccc"}}>
                          {b.montantFacture ? parseFloat(b.montantFacture).toFixed(2) + " €" : "—"}
                        </td>
                        <td><span className="badge" style={{background:sc(b.statut),color:st(b.statut),whiteSpace:"nowrap"}}>{b.statut}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          {b.statut === "terminé"
                            ? <button className="btn-pdf" onClick={() => downloadPDF(b)}>↓ PDF</button>
                            : <span style={{color:"#ccc",fontSize:12}}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>

        {/* TABLE BONS DE LA SEMAINE */}
        <div className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div className="card-title" style={{margin:0}}>Bons de la semaine</div>
            <span style={{fontSize:12,color:"#888"}}>{bonsSemaine.length} intervention{bonsSemaine.length > 1 ? "s" : ""}</span>
          </div>
          {bonsSemaine.length === 0
            ? <div className="empty-state" style={{padding:"0.75rem 0"}}>Aucun autre bon prévu cette semaine.</div>
            : <div className="table-wrapper">
                <table className="bons-table">
                  <thead><tr><th>Réf.</th><th>Date</th><th>Client</th><th>Type</th><th>Heure</th><th>Collaborateur</th><th>Montant</th><th>Statut</th></tr></thead>
                  <tbody>
                    {bonsSemaine.map(b => (
                      <tr key={b.id} onClick={() => { setSelected(b); setView("detail"); }} style={{cursor:"pointer"}}>
                        <td><span className="bon-ref">{b.ref}</span></td>
                        <td style={{fontSize:12,whiteSpace:"nowrap"}}>{new Date(b.datePrevue+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</td>
                        <td>
                          {b.clientSociete && <span style={{display:"block",fontSize:11,color:"#2a9d8f",fontWeight:600}}>{b.clientSociete}</span>}
                          <b style={{display:"block"}}>{b.clientNom} {b.clientPrenom}</b>
                          <span style={{fontSize:11,color:"#888"}}>{b.clientTel}</span>
                        </td>
                        <td style={{fontSize:12}}>{b.type}</td>
                        <td style={{fontSize:13,whiteSpace:"nowrap"}}>{b.heurePrevue}</td>
                        <td style={{fontSize:13}}>{b.techNom}</td>
                        <td style={{fontSize:13,fontWeight:500,color:b.montantFacture ? "#35B499" : "#ccc"}}>
                          {b.montantFacture ? parseFloat(b.montantFacture).toFixed(2) + " €" : "—"}
                        </td>
                        <td><span className="badge" style={{background:sc(b.statut),color:st(b.statut),whiteSpace:"nowrap"}}>{b.statut}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>

      </div>
    );
  };

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────

  const isInterventionView = ["list","new","detail"].includes(view);

  const NavItem = ({ label, active, onClick, pip, badge }) => (
    <div style={S.navItem(active)} onClick={onClick}>
      {active && <div style={S.navBar} />}
      {pip && <div style={S.navPip(pip)} />}
      <span>{label}</span>
      {badge > 0 && <span style={S.navBadge}>{badge}</span>}
    </div>
  );

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────────────────

  const contratsBadge = 0; // à connecter quand ContratModule expose ses données

  return (
    <div style={S.root}>

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={S.logoArea}>
          <div style={S.logoMark}>Cocon+</div>
          <div style={S.logoSub}>Administration</div>
        </div>

        <div style={S.nav}>
          <div style={S.navSec}>Pilotage</div>
          <NavItem label="Tableau de bord"  active={view==="dashboard"}         onClick={() => setView("dashboard")} pip="#35B499" />
          <NavItem label="Interventions"    active={isInterventionView}          onClick={() => setView("list")}      pip="#35B499" badge={stats.planifie + stats.enCours} />

          <div style={S.navSec}>Opérations</div>
          <NavItem label="Contrats"         active={view==="contrats"}           onClick={() => setView("contrats")}  pip="#8B6A4E" />
          <NavItem label="Carburant"        active={view==="carburant"}          onClick={() => setView("carburant")} pip="rgba(255,255,255,0.3)" />
          <NavItem label="Facturation"      active={view==="facturation"}        onClick={() => setView("facturation")} pip="rgba(255,255,255,0.3)" />
        </div>

        <div style={S.userArea}>
          <div style={S.avatar}>JM</div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:500}}>Jean-Marc S.</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>Administrateur</div>
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div style={S.main}>
        {msg && (
          <div style={{background:"#e8f5f3",color:"#1a7a65",padding:"10px 24px",fontSize:13,fontWeight:500,borderBottom:"0.5px solid #b2ddd5"}}>
            {msg}
          </div>
        )}
        {renderContent()}
      </div>

    </div>
  );
}
