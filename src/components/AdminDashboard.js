import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc
} from "firebase/firestore";

const TYPES = [
  "Désinsectisation","Dératisation","Traitement anti-termites",
  "Traitement anti-chauves-souris","Désinfection","Étanchéité / Toiture"
];

export default function AdminDashboard({ user }) {
  const [bons, setBons] = useState([]);
  const [techs, setTechs] = useState([]);
  const [view, setView] = useState("list"); // list | new | detail
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    clientNom: "", clientPrenom: "", clientTel: "", clientEmail: "",
    clientAdresse: "", type: "", datePrevue: "", heurePrevue: "", techId: ""
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

  const createBon = async (e) => {
    e.preventDefault();
    setSaving(true);
    const tech = techs.find(t => t.id === form.techId);
    await addDoc(collection(db, "bons"), {
      ...form,
      techNom: tech ? tech.nom + " " + tech.prenom : "",
      ref: refNum(),
      statut: "planifié",
      createdAt: Timestamp.now(),
      createdBy: user.uid,
      heureArrivee: null,
      heureFin: null,
      obsCocon: "",
      obsClient: "",
      signatureTech: null,
      signatureClient: null,
    });
    setMsg("Bon créé avec succès !");
    setForm({ clientNom:"",clientPrenom:"",clientTel:"",clientEmail:"",clientAdresse:"",type:"",datePrevue:"",heurePrevue:"",techId:"" });
    setView("list");
    fetchBons();
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const statutColor = (s) => ({
    "planifié": "#E1F5EE", "en cours": "#FFF3CD", "terminé": "#D4EDDA", "annulé": "#F8D7DA"
  }[s] || "#eee");

  const statutText = (s) => ({
    "planifié": "#085041", "en cours": "#856404", "terminé": "#155724", "annulé": "#721c24"
  }[s] || "#333");

  if (view === "new") return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
        <h2>Nouveau bon d'intervention</h2>
      </div>
      <form onSubmit={createBon}>
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
          <div className="field"><label>Adresse complète</label><input required value={form.clientAdresse} onChange={e=>setForm({...form,clientAdresse:e.target.value})} /></div>
        </div>

        <div className="card">
          <div className="card-title">Intervention</div>
          <div className="field">
            <label>Type d'intervention</label>
            <select required value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
              <option value="">-- Sélectionner --</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="row2">
            <div className="field"><label>Date prévue</label><input type="date" required value={form.datePrevue} onChange={e=>setForm({...form,datePrevue:e.target.value})} /></div>
            <div className="field"><label>Heure prévue</label><input type="time" required value={form.heurePrevue} onChange={e=>setForm({...form,heurePrevue:e.target.value})} /></div>
          </div>
          <div className="field">
            <label>Technicien assigné</label>
            <select required value={form.techId} onChange={e=>setForm({...form,techId:e.target.value})}>
              <option value="">-- Sélectionner --</option>
              {techs.map(t => <option key={t.id} value={t.id}>{t.nom} {t.prenom}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Création…" : "Créer le bon d'intervention"}
        </button>
      </form>
    </div>
  );

  if (view === "detail" && selected) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => { setView("list"); setSelected(null); }}>← Retour</button>
        <h2>{selected.ref}</h2>
        <span className="badge" style={{background: statutColor(selected.statut), color: statutText(selected.statut)}}>{selected.statut}</span>
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
        <div className="info-row"><span>Type</span><b>{selected.type}</b></div>
        <div className="info-row"><span>Prévu le</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
        <div className="info-row"><span>Technicien</span><b>{selected.techNom}</b></div>
        <div className="info-row"><span>Arrivée réelle</span><b>{selected.heureArrivee ? new Date(selected.heureArrivee.toDate()).toLocaleString("fr-FR") : "—"}</b></div>
        <div className="info-row"><span>Fin</span><b>{selected.heureFin ? new Date(selected.heureFin.toDate()).toLocaleString("fr-FR") : "—"}</b></div>
      </div>
      <div className="card">
        <div className="card-title">Observations</div>
        <div className="info-row"><span>Cocon+</span><b>{selected.obsCocon || "—"}</b></div>
        <div className="info-row"><span>Client</span><b>{selected.obsClient || "—"}</b></div>
      </div>
      {selected.signatureTech && (
        <div className="card">
          <div className="card-title">Signatures</div>
          <div className="row2">
            <div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Technicien</p><img src={selected.signatureTech} alt="sig tech" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}} /></div>
            {selected.signatureClient && <div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Client</p><img src={selected.signatureClient} alt="sig client" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}} /></div>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container">
      {msg && <div className="success-msg">{msg}</div>}
      <div className="page-header">
        <h2>Bons d'intervention</h2>
        <button className="btn-primary sm" onClick={() => setView("new")}>+ Nouveau bon</button>
      </div>
      {bons.length === 0 ? (
        <div className="empty-state">Aucun bon créé pour l'instant.</div>
      ) : (
        bons.map(b => (
          <div key={b.id} className="bon-card" onClick={() => { setSelected(b); setView("detail"); }}>
            <div className="bon-card-top">
              <span className="bon-ref">{b.ref}</span>
              <span className="badge" style={{background: statutColor(b.statut), color: statutText(b.statut)}}>{b.statut}</span>
            </div>
            <div className="bon-card-body">
              <b>{b.clientNom} {b.clientPrenom}</b>
              <span>{b.type}</span>
            </div>
            <div className="bon-card-footer">
              <span>Prévu : {b.datePrevue} à {b.heurePrevue}</span>
              <span>Tech : {b.techNom}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
