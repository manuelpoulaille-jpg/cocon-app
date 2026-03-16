import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, getDocs, query, orderBy, Timestamp
} from "firebase/firestore";

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
    const tech = techs.find(t => t.id === form.techId);
    await addDoc(collection(db, "bons"), {
      ...form,
      type: form.types.join(", "),
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
    setMsg("Bon créé !");
    setForm({ clientNom:"",clientPrenom:"",clientTel:"",clientEmail:"",clientAdresse:"",types:[],datePrevue:"",heurePrevue:"",techId:"" });
    setView("dashboard");
    fetchBons();
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const sc = (s) => ({ "planifié":"#E1F5EE","en cours":"#FFF3CD","terminé":"#D4EDDA" }[s] || "#eee");
  const st = (s) => ({ "planifié":"#085041","en cours":"#856404","terminé":"#155724" }[s] || "#333");
  const today = new Date().toISOString().split("T")[0];

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
            <label>Technicien assigné</label>
            <select required value={form.techId} onChange={e=>setForm({...form,techId:e.target.value})}>
              <option value="">-- Sélectionner --</option>
              {techs.map(t => <option key={t.id} value={t.id}>{t.nom} {t.prenom}</option>)}
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
      <div className="dashboard-logo">
        <img src="/logo.png" alt="Cocon+" style={{height:80,objectFit:"contain"}} />
      </div>
      <div className="stats-grid">
        <div className="stat-card" style={{background:"#E1F5EE"}}>
          <div className="stat-num" style={{color:"#085041"}}>{stats.planifie}</div>
          <div className="stat-label" style={{color:"#085041"}}>Planifiés</div>
        </div>
        <div className="stat-card" style={{background:"#FFF3CD"}}>
          <div className="stat-num" style={{color:"#856404"}}>{stats.enCours}</div>
          <div className="stat-label" style={{color:"#856404"}}>En cours</div>
        </div>
        <div className="stat-card" style={{background:"#D4EDDA"}}>
          <div className="stat-num" style={{color:"#155724"}}>{stats.termine}</div>
          <div className="stat-label" style={{color:"#155724"}}>Terminés</div>
        </div>
        <div className="stat-card" style={{background:"#E8F4FD"}}>
          <div className="stat-num" style={{color:"#0c5460"}}>{stats.aujourdhui}</div>
          <div className="stat-label" style={{color:"#0c5460"}}>Aujourd'hui</div>
        </div>
        <div className="stat-card" style={{background:"#F3E5F5"}}>
          <div className="stat-num" style={{color:"#4a148c"}}>{stats.semaine}</div>
          <div className="stat-label" style={{color:"#4a148c"}}>Cette semaine</div>
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
          : bons.filter(b => b.datePrevue === today).map(b =>
              <BonCard key={b.id} b={b} onClick={() => { setSelected(b); setView("detail"); }} />
            )
        }
      </div>
    </div>
  );
}
