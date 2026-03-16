import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from "firebase/firestore";

const TYPES = [
  "Désinsectisation","Dératisation","Traitement anti-termites",
  "Traitement anti-chauves-souris","Désinfection","Étanchéité / Toiture"
];

export default function AdminDashboard({ user }) {
  const [bons, setBons] = useState([]);
  const [techs, setTechs] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    clientNom:"",clientPrenom:"",clientTel:"",clientEmail:"",
    clientAdresse:"",types:[],datePrevue:"",heurePrevue:"",techId:""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchBons(); fetchTechs(); }, []);

  const fetchBons = async () => {
    const q = query(collection(db, "bons"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setBons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchTechs = async () => {
    const snap = await getDocs(collection(db, "users"));
    setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === "technicien"));
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
    await addDoc(collection(db, "bons"), {
      ...form,
      type: form.types.join(", "),
      techNom: form.techId,
      ref: refNum(),
      statut: "planifié",
      createdAt: Timestamp.now(),
      createdBy: user.uid,
      heureArrivee: null, heureFin: null,
      obsCocon: "", obsClient: "",
      signatureTech: null, signatureClient: null,
    });
    setMsg("Bon créé !");
    setForm({ clientNom:"",clientPrenom:"",clientTel:"",clientEmail:"",clientAdresse:"",types:[],datePrevue:"",heurePrevue:"",techId:"" });
    setView("dashboard");
    fetchBons();
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const sc = (s) => ({ "planifié":"#d4f0ea","en cours":"#e8c9b8","terminé":"#35B499" }[s] || "#eee");
  const st = (s) => ({ "planifié":"#1a7a65","en cours":"#6b4a31","terminé":"white" }[s] || "#333");
  const today = new Date().toISOString().split("T")[0];
  const fmt = (ts) => ts ? new Date(ts.toDate()).toLocaleString("fr-FR") : "—";

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

  const downloadPDF = async (bon) => {
    const { jsPDF } = await import("jspdf");
    const doc2 = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, ml = 15, mr = 195;
    doc2.setFillColor(53, 180, 153);
    doc2.rect(0, 0, W, 28, "F");
    doc2.setTextColor(255,255,255);
    doc2.setFontSize(16); doc2.setFont("helvetica","bold");
    doc2.text("BON D'INTERVENTION", ml, 12);
    doc2.setFontSize(9); doc2.setFont("helvetica","normal");
    doc2.text("Cocon+ — 0596 73 66 66 | www.cocon-plus.fr", ml, 20);
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
    section("TECHNICIEN"); row("Nom", bon.techNom); y += 2;
    section("CLIENT");
    row("Nom", bon.clientNom + " " + bon.clientPrenom);
    row("Téléphone", bon.clientTel); row("Email", bon.clientEmail);
    row("Adresse", bon.clientAdresse); y += 2;
    section("INTERVENTION");
    row("Type", bon.type);
    row("Prévu le", bon.datePrevue + " à " + bon.heurePrevue);
    row("Arrivée réelle", fmt(bon.heureArrivee));
    row("Fin intervention", fmt(bon.heureFin)); y += 2;
    section("OBSERVATIONS");
    const obsC = doc2.splitTextToSize("Cocon+ : " + (bon.obsCocon || "—"), 175);
    doc2.text(obsC, ml, y); y += obsC.length * 5 + 3;
    const obsCl = doc2.splitTextToSize("Client : " + (bon.obsClient || "—"), 175);
    doc2.text(obsCl, ml, y); y += obsCl.length * 5 + 5;
    section("SIGNATURES");
    doc2.setFontSize(9); doc2.text("Technicien", ml, y); doc2.text("Client", ml+90, y); y += 3;
    if (bon.signatureTech) { try { doc2.addImage(bon.signatureTech,"PNG",ml,y,80,30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml,y,80,30); }
    if (bon.signatureClient) { try { doc2.addImage(bon.signatureClient,"PNG",ml+90,y,80,30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml+90,y,80,30); }
    doc2.setFontSize(8); doc2.setTextColor(150,150,150);
    doc2.text("Cocon Plus SARL — Berges de Kerlys, 97200 Fort-de-France — SIRET : 47756829900028", W/2, 285, {align:"center"});
    doc2.save("bon-" + bon.ref + ".pdf");
  };

  const BonCard = ({ b, onClick }) => (
    <div className="bon-card" onClick={onClick}>
      <div className="bon-card-top">
        <span className="bon-ref">{b.ref}</span>
        <span className="badge" style={{background:sc(b.statut),color:st(b.statut)}}>{b.statut}</span>
      </div>
      <div className="bon-card-body"><b>{b.clientNom} {b.clientPrenom}</b><span>{b.type}</span></div>
      <div className="bon-card-footer"><span>{b.datePrevue} à {b.heurePrevue}</span><span>{b.techNom}</span></div>
    </div>
  );

  if (view === "new") return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setView("dashboard")}>← Retour</button>
        <h2>Nouveau bon</h2>
      </div>
      <form onSubmit={createBon}>
        <div className="card">
          <div className="card-title">Client</div>
          <div className="row2">
            <div className="field"><label>Nom</label><input required value={form.clientNom} onChange={e=>setForm({...form,clientNom:e.target.value})} /></div>
            <div className="field"><label>Prénom</label><input required value={form.clientPrenom} onChange={e=>setForm({...form,clientPrenom:e.target.value})} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Téléphone</label><input value={form.clientTel} onChange={e=>setForm({...form,clientTel:e.target.value})} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.clientEmail} onChange={e=>setForm({...form,clientEmail:e.target.value})} /></div>
          </div>
          <div className="field"><label>Adresse</label><input required value={form.clientAdresse} onChange={e=>setForm({...form,clientAdresse:e.target.value})} /></div>
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
        <div className="card">
          <div className="card-title">Planification</div>
          <div className="row2">
            <div className="field"><label>Date prévue</label><input type="date" required value={form.datePrevue} onChange={e=>setForm({...form,datePrevue:e.target.value})} /></div>
            <div className="field"><label>Heure prévue</label><input type="time" required value={form.heurePrevue} onChange={e=>setForm({...form,heurePrevue:e.target.value})} /></div>
          </div>
          <div className="field">
            <label>Collaborateur assigné</label>
            <select required value={form.techId} onChange={e=>setForm({...form,techId:e.target.value,techNom:e.target.value})}>
              <option value="">-- Sélectionner --</option>
              <option value="Dimitri">Dimitri</option>
              <option value="Georges">Georges</option>
              <option value="Equipe">Equipe</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Création…" : "Créer le bon"}</button>
      </form>
    </div>
  );

  if (view === "detail" && selected) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => { setView("list"); setSelected(null); }}>← Retour</button>
        <h2>{selected.ref}</h2>
        <span className="badge" style={{background:sc(selected.statut),color:st(selected.statut)}}>{selected.statut}</span>
      </div>
      <div className="card">
        <div className="card-title">Client</div>
        <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
        <div className="info-row"><span>Téléphone</span><b>{selected.clientTel || "—"}</b></div>
        <div className="info-row"><span>Email</span><b>{selected.clientEmail || "—"}</b></div>
        <div className="info-row"><span>Adresse</span><b>{selected.clientAdresse}</b></div>
      </div>
      <div className="card">
        <div className="card-title">Intervention</div>
        <div className="info-row"><span>Type(s)</span><b>{selected.type}</b></div>
        <div className="info-row"><span>Prévu le</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
        <div className="info-row"><span>Collaborateur</span><b>{selected.techNom}</b></div>
        <div className="info-row"><span>Arrivée réelle</span><b>{fmt(selected.heureArrivee)}</b></div>
        <div className="info-row"><span>Fin</span><b>{fmt(selected.heureFin)}</b></div>
      </div>
      <div className="card">
        <div className="card-title">Observations</div>
        <div className="info-row"><span>Cocon+</span><b>{selected.obsCocon || "—"}</b></div>
        <div className="info-row"><span>Client</span><b>{selected.obsClient || "—"}</b></div>
      </div>
      {selected.statut === "terminé" && (
        <button className="btn-primary" onClick={() => downloadPDF(selected)}>Télécharger le PDF</button>
      )}
      {selected.signatureTech && (
        <div className="card" style={{marginTop:"1rem"}}>
          <div className="card-title">Signatures</div>
          <div className="row2">
            <div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Technicien</p><img src={selected.signatureTech} alt="" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}} /></div>
            {selected.signatureClient && <div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Client</p><img src={selected.signatureClient} alt="" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}} /></div>}
          </div>
        </div>
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
      {bons.length === 0 ? <div className="empty-state">Aucun bon.</div> :
        bons.map(b => <BonCard key={b.id} b={b} onClick={() => { setSelected(b); setView("detail"); }} />)
      }
    </div>
  );

  return (
    <div className="container">
      {msg && <div className="success-msg">{msg}</div>}

      <div className="stats-grid">
        <div className="stat-card" style={{background:"#d4f0ea"}}>
          <div className="stat-num" style={{color:"#1a7a65"}}>{stats.planifie}</div>
          <div className="stat-label" style={{color:"#1a7a65"}}>Planifiés</div>
        </div>
        <div className="stat-card" style={{background:"#e8c9b8"}}>
          <div className="stat-num" style={{color:"#6b4a31"}}>{stats.enCours}</div>
          <div className="stat-label" style={{color:"#6b4a31"}}>En cours</div>
        </div>
        <div className="stat-card" style={{background:"#35B499"}}>
          <div className="stat-num" style={{color:"white"}}>{stats.termine}</div>
          <div className="stat-label" style={{color:"white"}}>Terminés</div>
        </div>
        <div className="stat-card" style={{background:"#8B6A4E"}}>
          <div className="stat-num" style={{color:"white"}}>{stats.aujourdhui}</div>
          <div className="stat-label" style={{color:"white"}}>Aujourd'hui</div>
        </div>
        <div className="stat-card" style={{background:"#2a9a82"}}>
          <div className="stat-num" style={{color:"white"}}>{stats.semaine}</div>
          <div className="stat-label" style={{color:"white"}}>Cette semaine</div>
        </div>
      </div>
      <div className="dash-actions">
        <button className="btn-primary" onClick={() => setView("new")}>+ Nouveau bon</button>
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
                      <td>
                        <b style={{display:"block"}}>{b.clientNom} {b.clientPrenom}</b>
                        <span style={{fontSize:11,color:"#888"}}>{b.clientTel}</span>
                      </td>
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
