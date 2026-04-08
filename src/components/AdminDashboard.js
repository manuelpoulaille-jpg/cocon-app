import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import logoBase64 from "../logoBase64";

const TYPES = [
  "Désinsectisation","Dératisation","Traitement anti-termites",
  "Traitement anti-chauves-souris","Désinfection","Étanchéité / Toiture"
];

export default function AdminDashboard({ user }) {
  const [bons, setBons] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    clientNom:"", clientPrenom:"", clientTel:"", clientEmail:"",
    adresseFacturation:"", adresseIntervention:"",
    demandeClient:"", numDevis:"", signataire:"",
    types:[], datePrevue:"", heurePrevue:"", techId:"",
    montantFacture:"", // 👈 NOUVEAU
  });

  useEffect(() => { fetchBons(); }, []);

  const fetchBons = async () => {
    const q = query(collection(db, "bons"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setBons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const refNum = () => "INT-" + Date.now().toString().slice(-6);

  const toggleType = (t) => {
    setForm(f => ({
      ...f,
      types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t]
    }));
  };

  const createBon = async (e) => {
    e.preventDefault();
    if (form.types.length === 0) { alert("Sélectionnez au moins un type d'intervention"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "bons"), {
        ...form,
        clientAdresse: form.adresseIntervention,
        signataire: form.signataire,
        type: form.types.join(", "),
        techNom: form.techId,
        ref: form.numDevis ? "INT-" + form.numDevis.replace(/\D/g, "").slice(-5) : refNum(),
        statut: "planifié",
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        heureArrivee: null, heureFin: null,
        obsCocon: "", obsClient: "",
        signatureTech: null, signatureClient: null,
        montantFacture: form.montantFacture ? parseFloat(form.montantFacture) : null,
      });
      await fetchBons();
      setForm({ clientNom:"",clientPrenom:"",clientTel:"",clientEmail:"",adresseFacturation:"",adresseIntervention:"",demandeClient:"",numDevis:"",types:[],datePrevue:"",heurePrevue:"",techId:"",montantFacture:"" });
      setMsg("Bon créé !");
      setView("dashboard");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      console.error("Erreur création bon :", err);
      alert("Une erreur est survenue, veuillez réessayer.");
    } finally {
      setSaving(false);
    }
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
      clientNom: editForm.clientNom,
      clientPrenom: editForm.clientPrenom,
      clientTel: editForm.clientTel,
      clientEmail: editForm.clientEmail,
      adresseFacturation: editForm.adresseFacturation,
      adresseIntervention: editForm.adresseIntervention,
      clientAdresse: editForm.adresseIntervention,
      demandeClient: editForm.demandeClient,
      numDevis: editForm.numDevis,
      signataire: editForm.signataire||"",
      datePrevue: editForm.datePrevue,
      heurePrevue: editForm.heurePrevue,
      techNom: editForm.techId,
      types: editForm.types,
      type: editForm.types.join(", "),
      montantFacture: editForm.montantFacture ? parseFloat(editForm.montantFacture) : null, // 👈 NOUVEAU
    });
    const updated = { ...selected, ...editForm, techNom: editForm.techId, type: editForm.types.join(", ") };
    setSelected(updated);
    setEditMode(false);
    fetchBons();
    setSaving(false);
  };

  const sc = (s) => ({ "planifié":"#d4f0ea","en cours":"#e8c9b8","terminé":"#35B499" }[s] || "#eee");
  const st = (s) => ({ "planifié":"#1a7a65","en cours":"#6b4a31","terminé":"white" }[s] || "#333");
  const today = new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });
  const fmt = (ts) => ts ? new Date(ts.toDate()).toLocaleString("fr-FR") : "—";

  const calcDuree = (arrivee, fin) => {
    if (!arrivee || !fin) return "—";
    const diff = fin.toDate() - arrivee.toDate();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? h + "h" + m.toString().padStart(2,"0") : m + " min";
  };

  const downloadPDF = async (bon) => {
    const { jsPDF } = await import("jspdf");
    const doc2 = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, ml = 15, mr = 195;
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
    const row = (label, val) => { if (y > 260) { doc2.addPage(); y = 20; } doc2.text(label + " : " + (val || "—"), ml, y); y += 6; };
    section("INFORMATIONS");
    row("Référence", bon.ref);
    if (bon.numDevis) row("N° Devis", bon.numDevis);
    row("Collaborateur", bon.techNom); y += 2;
    section("CLIENT");
    row("Nom", bon.clientNom + " " + bon.clientPrenom);
    row("Téléphone", bon.clientTel); row("Email", bon.clientEmail);
    if (bon.adresseFacturation) row("Adresse facturation", bon.adresseFacturation);
    row("Adresse intervention", bon.adresseIntervention || bon.clientAdresse); y += 2;
    if (bon.demandeClient) { section("DEMANDE CLIENT"); const d = doc2.splitTextToSize(bon.demandeClient, 175); doc2.text(d, ml, y); y += d.length * 5 + 5; }
    section("INTERVENTION");
    row("Type", bon.type);
    row("Prévu le", bon.datePrevue + " à " + bon.heurePrevue);
    row("Arrivée réelle", fmt(bon.heureArrivee));
    row("Fin intervention", fmt(bon.heureFin));
    row("Durée", calcDuree(bon.heureArrivee, bon.heureFin));
    if (bon.geoArrivee) row("Position arrivée", "Lat: " + bon.geoArrivee.lat?.toFixed(5) + ", Lng: " + bon.geoArrivee.lng?.toFixed(5));
    if (bon.geoFin) row("Position fin", "Lat: " + bon.geoFin.lat?.toFixed(5) + ", Lng: " + bon.geoFin.lng?.toFixed(5));
    y += 2;
    section("COMPTE RENDU D'INTERVENTION");
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
    doc2.save("bon-" + bon.ref + ".pdf");
  };

  const stats = {
    planifie: bons.filter(b => b.statut === "planifié").length,
    enCours: bons.filter(b => b.statut === "en cours").length,
    termine: bons.filter(b => b.statut === "terminé").length,
    aujourdhui: bons.filter(b => b.datePrevue === today).length,
    semaine: bons.filter(b => {
      const d = new Date(b.datePrevue);
      const now = new Date();
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return d >= start && d <= end;
    }).length,
  };

  const BonCard = ({ b, onClick }) => (
    <div className="bon-card" onClick={onClick}>
      <div className="bon-card-top">
        <span className="bon-ref">{b.ref}{b.numDevis ? " · " + b.numDevis : ""}</span>
        <span className="badge" style={{background:sc(b.statut),color:st(b.statut)}}>{b.statut}</span>
      </div>
      <div className="bon-card-body"><b>{b.clientNom} {b.clientPrenom}</b><span>{b.type}</span></div>
      <div className="bon-card-footer"><span>{b.datePrevue} à {b.heurePrevue}</span><span>{b.techNom}</span></div>
    </div>
  );

  const filteredBons = bons.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (b.clientNom + " " + b.clientPrenom).toLowerCase().includes(q) ||
      b.ref?.toLowerCase().includes(q) ||
      b.numDevis?.toLowerCase().includes(q) ||
      b.type?.toLowerCase().includes(q) ||
      b.techNom?.toLowerCase().includes(q) ||
      b.statut?.toLowerCase().includes(q);
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const matchFilter = !filter ||
      (filter === "planifié" && b.statut === "planifié") ||
      (filter === "en cours" && b.statut === "en cours") ||
      (filter === "terminé" && b.statut === "terminé") ||
      (filter === "aujourdhui" && b.datePrevue === today) ||
      (filter === "semaine" && new Date(b.datePrevue) >= start && new Date(b.datePrevue) <= end);
    return matchSearch && matchFilter;
  });

  if (view === "new") return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setView("dashboard")}>← Retour</button>
        <h2>Nouveau bon</h2>
      </div>
      <form onSubmit={createBon}>
        <div className="card">
          <div className="card-title">Informations générales</div>
          <div className="row2">
            <div className="field"><label>N° Devis</label><input value={form.numDevis} onChange={e=>setForm({...form,numDevis:e.target.value})} placeholder="ex: DEV-2026-001" /></div>
            <div className="field"><label>Date prévue</label><input type="date" required value={form.datePrevue} onChange={e=>setForm({...form,datePrevue:e.target.value})} /></div>
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
          {/* 👇 NOUVEAU — Montant facturé */}
          <div className="field">
            <label>Montant facturé (€) <span style={{fontWeight:400,fontSize:12,color:"#888"}}>optionnel — pour l'analyse de rentabilité</span></label>
            <input type="number" step="0.01" placeholder="ex : 250.00" value={form.montantFacture} onChange={e=>setForm({...form,montantFacture:e.target.value})} />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Informations client</div>
          <div className="row2">
            <div className="field"><label>Nom</label><input required value={form.clientNom} onChange={e=>setForm({...form,clientNom:e.target.value})} /></div>
            <div className="field"><label>Prénom</label><input required value={form.clientPrenom} onChange={e=>setForm({...form,clientPrenom:e.target.value})} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Téléphone</label><input value={form.clientTel} onChange={e=>setForm({...form,clientTel:e.target.value})} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.clientEmail} onChange={e=>setForm({...form,clientEmail:e.target.value})} /></div>
          </div>
          <div className="field"><label>Adresse de facturation</label><input value={form.adresseFacturation} onChange={e=>setForm({...form,adresseFacturation:e.target.value})} placeholder="Adresse de facturation" /></div>
          <div className="field"><label>Adresse d'intervention</label><input required value={form.adresseIntervention} onChange={e=>setForm({...form,adresseIntervention:e.target.value})} placeholder="Adresse du chantier" /></div>
          <div className="field"><label>Signataire si différent du client</label><input value={form.signataire} onChange={e=>setForm({...form,signataire:e.target.value})} placeholder="Nom du signataire" /></div>
        </div>

        <div className="card">
          <div className="card-title">Informations sur la demande du client</div>
          <div className="field"><label>Description de la demande</label><textarea value={form.demandeClient} onChange={e=>setForm({...form,demandeClient:e.target.value})} placeholder="Contexte, motif, demandes spécifiques du client…" /></div>
        </div>

        <div className="card">
          <div className="card-title">Type(s) d'intervention</div>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:10}}>Sélection multiple possible</p>
          <div className="types-grid">
            {TYPES.map(t => (
              <button key={t} type="button"
                className={"type-btn" + (form.types.includes(t) ? " active" : "")}
                onClick={() => toggleType(t)}>
                {form.types.includes(t) ? "✓ " : ""}{t}
              </button>
            ))}
          </div>
          {form.types.length > 0 && (
            <div className="selected-types">
              {form.types.map(t => <span key={t} className="type-tag">{t}</span>)}
            </div>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Création…" : "Créer le bon"}</button>
      </form>
    </div>
  );

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
        {/* 👇 NOUVEAU — Montant facturé */}
        <div className="field">
          <label>Montant facturé (€) <span style={{fontWeight:400,fontSize:12,color:"#888"}}>optionnel</span></label>
          <input type="number" step="0.01" placeholder="ex : 250.00" value={editForm.montantFacture||""} onChange={e=>setEditForm({...editForm,montantFacture:e.target.value})} />
        </div>
      </div>
      <div className="card">
        <div className="card-title">Client</div>
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
        <div className="field"><label>Signataire si différent du client</label><input value={editForm.signataire||""} onChange={e=>setEditForm({...editForm,signataire:e.target.value})} /></div>
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
      <button className="btn-primary" disabled={saving} onClick={saveEdit}>{saving ? "Sauvegarde…" : "Enregistrer les modifications"}</button>
    </div>
  );

  if (view === "detail" && selected) return (
    <div className="container">
      {confirmDelete && (
        <div style={{background:"#fdecea",border:"1px solid #f5c6cb",borderRadius:10,padding:"1rem",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{color:"#c0392b",fontSize:14,fontWeight:500}}>Confirmer la suppression de ce bon ?</span>
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
          <button style={{background:"#E1F5EE",color:"#1a7a65",border:"0.5px solid #35B499",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12}} onClick={() => {
            setEditForm({
              clientNom:selected.clientNom, clientPrenom:selected.clientPrenom,
              clientTel:selected.clientTel, clientEmail:selected.clientEmail,
              adresseFacturation:selected.adresseFacturation||"",
              adresseIntervention:selected.adresseIntervention||selected.clientAdresse||"",
              demandeClient:selected.demandeClient||"", numDevis:selected.numDevis||"",
              signataire:selected.signataire||"", datePrevue:selected.datePrevue,
              heurePrevue:selected.heurePrevue, techId:selected.techNom,
              types:selected.types||[],
              montantFacture:selected.montantFacture||"", // 👈 NOUVEAU
            });
            setEditMode(true);
          }}>Modifier</button>
        )}
        <button style={{background:"#fdecea",color:"#c0392b",border:"0.5px solid #f5c6cb",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12,marginLeft:"auto"}} onClick={() => setConfirmDelete(true)}>Supprimer</button>
      </div>

      <div className="card">
        <div className="card-title">Informations générales</div>
        {selected.numDevis && <div className="info-row"><span>N° Devis</span><b>{selected.numDevis}</b></div>}
        <div className="info-row"><span>Référence</span><b>{selected.ref}</b></div>
        <div className="info-row"><span>Date prévue</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
        <div className="info-row"><span>Collaborateur</span><b>{selected.techNom}</b></div>
        {/* 👇 NOUVEAU */}
        {selected.montantFacture && (
          <div className="info-row"><span>Montant facturé</span><b style={{color:"#1a7a65"}}>{parseFloat(selected.montantFacture).toFixed(2)} €</b></div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Client</div>
        <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
        <div className="info-row"><span>Téléphone</span><b>{selected.clientTel || "—"}</b></div>
        <div className="info-row"><span>Email</span><b>{selected.clientEmail || "—"}</b></div>
        {selected.signataire && <div className="info-row"><span>Signataire</span><b>{selected.signataire}</b></div>}
        <div className="info-row"><span>Adresse facturation</span><b>{selected.adresseFacturation || "—"}</b></div>
        <div className="info-row"><span>Adresse intervention</span><b>{selected.adresseIntervention || selected.clientAdresse || "—"}</b></div>
      </div>

      {selected.demandeClient && (
        <div className="card">
          <div className="card-title">Informations sur la demande du client</div>
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
        {selected.geoArrivee && (
          <div className="info-row"><span>Position arrivée</span><b style={{fontSize:12}}>📍 {selected.geoArrivee.lat?.toFixed(4)}, {selected.geoArrivee.lng?.toFixed(4)}</b></div>
        )}
        {selected.geoFin && (
          <div className="info-row"><span>Position fin</span><b style={{fontSize:12}}>📍 {selected.geoFin.lat?.toFixed(4)}, {selected.geoFin.lng?.toFixed(4)}</b></div>
        )}
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
        <button className="btn-primary" onClick={() => downloadPDF(selected)}>Télécharger le PDF</button>
      )}
    </div>
  );

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
        <input type="text" placeholder="Rechercher par client, référence, devis, type…" value={search} onChange={e => setSearch(e.target.value)} style={{width:"100%",padding:"10px 16px",fontSize:14,border:"1px solid #e0e0e0",borderRadius:10,background:"white"}} />
        {search && <span className="search-count">{filteredBons.length} résultat{filteredBons.length > 1 ? "s" : ""}</span>}
      </div>
      {filteredBons.length === 0 ? <div className="empty-state">Aucun bon trouvé.</div> :
        filteredBons.map(b => <BonCard key={b.id} b={b} onClick={() => { setSelected(b); setView("detail"); }} />)
      }
    </div>
  );

  return (
    <div className="container">
      {msg && <div className="success-msg">{msg}</div>}
      <div className="dashboard-logo">
        <img src="/logo.png" alt="Cocon+" style={{height:80,objectFit:"contain",borderRadius:16,background:"white",padding:8,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}} />
      </div>
      <div className="stats-grid">
        <div className="stat-card" style={{background:"#d4f0ea",cursor:"pointer",outline:filter==="planifié" ? "3px solid #1a7a65" : "none"}} onClick={() => { setFilter(f => f==="planifié" ? "" : "planifié"); setView("list"); }}><div className="stat-num" style={{color:"#1a7a65"}}>{stats.planifie}</div><div className="stat-label" style={{color:"#1a7a65"}}>Planifiés</div></div>
        <div className="stat-card" style={{background:"#e8c9b8",cursor:"pointer",outline:filter==="en cours" ? "3px solid #6b4a31" : "none"}} onClick={() => { setFilter(f => f==="en cours" ? "" : "en cours"); setView("list"); }}><div className="stat-num" style={{color:"#6b4a31"}}>{stats.enCours}</div><div className="stat-label" style={{color:"#6b4a31"}}>En cours</div></div>
        <div className="stat-card" style={{background:"#35B499",cursor:"pointer",outline:filter==="terminé" ? "3px solid white" : "none"}} onClick={() => { setFilter(f => f==="terminé" ? "" : "terminé"); setView("list"); }}><div className="stat-num" style={{color:"white"}}>{stats.termine}</div><div className="stat-label" style={{color:"white"}}>Terminés</div></div>
        <div className="stat-card" style={{background:"#8B6A4E",cursor:"pointer",outline:filter==="aujourdhui" ? "3px solid white" : "none"}} onClick={() => { setFilter(f => f==="aujourdhui" ? "" : "aujourdhui"); setView("list"); }}><div className="stat-num" style={{color:"white"}}>{stats.aujourdhui}</div><div className="stat-label" style={{color:"white"}}>Aujourd'hui</div></div>
        <div className="stat-card" style={{background:"#2a9a82",cursor:"pointer",outline:filter==="semaine" ? "3px solid white" : "none"}} onClick={() => { setFilter(f => f==="semaine" ? "" : "semaine"); setView("list"); }}><div className="stat-num" style={{color:"white"}}>{stats.semaine}</div><div className="stat-label" style={{color:"white"}}>Cette semaine</div></div>
      </div>
      <div className="dash-actions">
        <button className="btn-primary" onClick={() => setView("new")}>+ Nouveau bon d'intervention</button>
        <button className="btn-outline" onClick={() => setView("list")}>Tous les bons</button>
      </div>
      <div className="card" style={{marginTop:"1rem"}}>
        <div className="card-title">Bons du jour</div>
        {bons.filter(b => b.datePrevue === today).length === 0
          ? <div className="empty-state" style={{padding:"1rem 0"}}>Aucun bon prévu aujourd'hui.</div>
          : <div className="table-wrapper">
              <table className="bons-table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>N° Devis</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Heure</th>
                    <th>Collaborateur</th>
                    <th>Statut</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {bons.filter(b => b.datePrevue === today).map(b => (
                    <tr key={b.id} onClick={() => { setSelected(b); setView("detail"); }} style={{cursor:"pointer"}}>
                      <td><span className="bon-ref">{b.ref}</span></td>
                      <td style={{fontSize:12,color:"#888"}}>{b.numDevis || "—"}</td>
                      <td><b style={{display:"block"}}>{b.clientNom} {b.clientPrenom}</b><span style={{fontSize:11,color:"#888"}}>{b.clientTel}</span></td>
                      <td style={{fontSize:12}}>{b.type}</td>
                      <td style={{fontSize:13,whiteSpace:"nowrap"}}>{b.heurePrevue}</td>
                      <td style={{fontSize:13}}>{b.techNom}</td>
                      <td><span className="badge" style={{background:sc(b.statut),color:st(b.statut),whiteSpace:"nowrap"}}>{b.statut}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        {b.statut === "terminé"
                          ? <button className="btn-pdf" onClick={() => downloadPDF(b)}>↓ PDF</button>
                          : <span style={{color:"#ccc",fontSize:12}}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}
