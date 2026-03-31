// ─────────────────────────────────────────────────────────────────────────────
// CarburantModule.jsx — Suivi Carburant + Performance pour Cocon+
// À placer dans : src/components/CarburantModule.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ══════════════════════════════════════════════════════════════════════════════
const BUDGET_MENSUEL_EUROS = 300; // 👈 MODIFIEZ CETTE VALEUR
// ══════════════════════════════════════════════════════════════════════════════

const TEAL      = "#2a9d8f";
const TEAL_DARK = "#1f7a6e";
const TEAL_LIGHT= "#e8f5f3";
const ORANGE    = "#e76f51";
const YELLOW    = "#f4a261";
const LIGHT_BG  = "#f7fbfa";
const GRAY      = "#6b7280";
const PURPLE    = "#7c3aed";
const GREEN     = "#16a34a";
const RED       = "#dc2626";

// ── Zones Martinique ──────────────────────────────────────────────────────────
const ZONES_MARTINIQUE = {
  "Nord Caraïbes": [
    "saint-pierre","prêcheur","le prêcheur","carbet","le carbet",
    "case-pilote","case pilote","bellefontaine","schoelcher"
  ],
  "Nord Atlantique": [
    "basse-pointe","basse pointe","macouba","grand-rivière","grand rivière",
    "lorrain","le lorrain","marigot","sainte-marie","trinité","la trinité"
  ],
  "Centre": [
    "fort-de-france","fort de france","lamentin","le lamentin",
    "saint-joseph","saint joseph","gros-morne","gros morne","schœlcher"
  ],
  "Sud Caraïbes": [
    "trois-îlets","les trois-îlets","trois ilets","anses-d'arlet","anses d'arlet",
    "diamant","le diamant","sainte-luce","sainte luce","rivière-pilote","rivière pilote"
  ],
  "Sud Atlantique": [
    "vauclin","le vauclin","françois","le françois","robert","le robert",
    "sainte-anne","sainte anne","marin","le marin","rivière-salée","rivière salée"
  ],
};

const getZone = (adresse) => {
  if (!adresse) return "Non défini";
  const a = adresse.toLowerCase();
  for (const [zone, communes] of Object.entries(ZONES_MARTINIQUE)) {
    if (communes.some(c => a.includes(c))) return zone;
  }
  return "Non défini";
};

// ── Composants utilitaires ────────────────────────────────────────────────────
function StatCard({ icon, titre, valeur, sous, color }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", flex:1, minWidth:120 }}>
      <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:11, color:GRAY, marginBottom:2 }}>{titre}</div>
      <div style={{ fontSize:18, fontWeight:700, color: color || TEAL_DARK }}>{valeur}</div>
      {sous && <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{sous}</div>}
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:13, fontWeight:600, color:"#444" }}>
        {label}
        {hint && <span style={{ fontWeight:400, color:GRAY, marginLeft:6, fontSize:12 }}>{hint}</span>}
      </label>
      {children}
      {error && <span style={{ fontSize:11, color:ORANGE }}>{error}</span>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontWeight:700, color:TEAL_DARK, fontSize:15, marginBottom:4, marginTop:8 }}>{children}</div>;
}

// ── Graphique barres ──────────────────────────────────────────────────────────
function CombinedChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxMontant = Math.max(...data.map(d => d.montant), 1);
  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:9, color: d.montant > BUDGET_MENSUEL_EUROS ? ORANGE : TEAL_DARK, fontWeight:600 }}>
              {d.montant > 0 ? `${d.montant.toFixed(0)}€` : ""}
            </span>
            <div style={{ width:"60%", height:`${Math.max((d.montant / maxMontant) * 90, d.montant > 0 ? 4 : 0)}px`, background: d.montant > BUDGET_MENSUEL_EUROS ? ORANGE : TEAL, borderRadius:"4px 4px 0 0", position:"relative" }}>
              {d.bons > 0 && (
                <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", width:10, height:10, borderRadius:"50%", background:PURPLE, border:"2px solid white" }} title={`${d.bons} intervention(s)`} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginTop:4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1, textAlign:"center", fontSize:9, color:GRAY }}>{d.label}</div>
        ))}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:GRAY }}><div style={{ width:12, height:12, background:TEAL, borderRadius:3 }} /> Carburant (€)</div>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:GRAY }}><div style={{ width:10, height:10, background:PURPLE, borderRadius:"50%" }} /> Interventions</div>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:GRAY }}><div style={{ width:12, height:12, background:ORANGE, borderRadius:3 }} /> Budget dépassé</div>
      </div>
    </div>
  );
}

// ── Formulaire plein ──────────────────────────────────────────────────────────
function PleinForm({ user, initial, onSave, onCancel }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState(initial || {
    date: today, kilometrage: "", montant: "", prixLitre: "",
    conducteur: user?.displayName || user?.email || "", commentaire: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const litresCalcules =
    form.montant && form.prixLitre && !isNaN(form.montant) &&
    !isNaN(form.prixLitre) && parseFloat(form.prixLitre) > 0
      ? (parseFloat(form.montant) / parseFloat(form.prixLitre)).toFixed(2) : null;

  const validate = () => {
    const e = {};
    if (!form.date)                                   e.date        = "Champ requis";
    if (!form.kilometrage || isNaN(form.kilometrage)) e.kilometrage = "Valeur invalide";
    if (!form.montant     || isNaN(form.montant))     e.montant     = "Valeur invalide";
    if (!form.conducteur)                             e.conducteur  = "Champ requis";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    const litres = form.prixLitre !== "" && parseFloat(form.prixLitre) > 0
      ? parseFloat((parseFloat(form.montant) / parseFloat(form.prixLitre)).toFixed(2)) : null;
    await onSave({
      date: form.date, kilometrage: parseFloat(form.kilometrage),
      montant: parseFloat(parseFloat(form.montant).toFixed(2)),
      prixLitre: form.prixLitre !== "" ? parseFloat(parseFloat(form.prixLitre).toFixed(3)) : null,
      litres, conducteur: form.conducteur, commentaire: form.commentaire,
    });
    setLoading(false);
  };

  const inp = { padding:"9px 12px", borderRadius:8, border:"1px solid #d1d5db", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ background:"#fff", borderRadius:12, padding:"20px 22px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
      <h3 style={{ margin:"0 0 18px", color:TEAL_DARK }}>{initial ? "Modifier le plein" : "Nouveau plein"}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Field label="Date *" error={errors.date}>
          <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} style={inp} />
        </Field>
        <Field label="Kilométrage (km) *" error={errors.kilometrage}>
          <input type="number" placeholder="ex : 45 320" value={form.kilometrage} onChange={e => setForm({...form, kilometrage:e.target.value})} style={inp} />
        </Field>
        <Field label="Montant total (€) *" hint="depuis votre ticket" error={errors.montant}>
          <input type="number" step="0.01" placeholder="ex : 75.50" value={form.montant} onChange={e => setForm({...form, montant:e.target.value})} style={inp} />
        </Field>
        <Field label="Prix au litre (€)" hint="optionnel" error={errors.prixLitre}>
          <input type="number" step="0.001" placeholder="ex : 1.879" value={form.prixLitre}
            onChange={e => { setForm({...form, prixLitre:e.target.value}); setErrors(p => ({...p, prixLitre:undefined})); }} style={inp} />
        </Field>
        <Field label="Conducteur *" error={errors.conducteur}>
          <input type="text" placeholder="Prénom Nom" value={form.conducteur} onChange={e => setForm({...form, conducteur:e.target.value})} style={inp} />
        </Field>
        <Field label="Commentaire (optionnel)">
          <input type="text" placeholder="Station, remarque…" value={form.commentaire} onChange={e => setForm({...form, commentaire:e.target.value})} style={inp} />
        </Field>
      </div>
      {litresCalcules && (
        <div style={{ marginTop:16, padding:"12px 16px", background:TEAL_LIGHT, borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:TEAL_DARK, fontWeight:600 }}>🛢️ Litres calculés automatiquement</span>
          <span style={{ fontSize:22, fontWeight:700, color:TEAL_DARK }}>{litresCalcules} L</span>
        </div>
      )}
      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <button onClick={onCancel} style={{ flex:1, padding:"11px 0", borderRadius:8, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:600, color:"#555" }}>Annuler</button>
        <button onClick={handleSubmit} disabled={loading} style={{ flex:2, padding:"11px 0", borderRadius:8, border:"none", background:loading?"#aaa":TEAL, color:"#fff", cursor:loading?"not-allowed":"pointer", fontWeight:700, fontSize:15 }}>
          {loading ? "Enregistrement…" : initial ? "Mettre à jour" : "Enregistrer le plein"}
        </button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CarburantModule({ user }) {
  const [pleins, setPleins]               = useState([]);
  const [bons, setBons]                   = useState([]);
  const [vue, setVue]                     = useState("dashboard");
  const [fetchLoading, setFetchLoading]   = useState(true);
  const [successMsg, setSuccessMsg]       = useState("");
  const [editPlein, setEditPlein]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setFetchLoading(true);
    try {
      const [snapPleins, snapBons] = await Promise.all([
        getDocs(query(collection(db, "carburant"), orderBy("date", "desc"))),
        getDocs(query(collection(db, "bons"), orderBy("createdAt", "desc"))),
      ]);
      setPleins(snapPleins.docs.map(d => ({ id: d.id, ...d.data() })));
      setBons(snapBons.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Erreur :", e); }
    finally { setFetchLoading(false); }
  };

  const handleAdd  = async (data) => { await addDoc(collection(db, "carburant"), { ...data, createdAt: serverTimestamp(), createdBy: user?.uid||"unknown" }); await fetchAll(); notify("✅ Plein enregistré !"); setVue("dashboard"); };
  const handleEdit = async (data) => { await updateDoc(doc(db,"carburant",editPlein.id), data); await fetchAll(); notify("✅ Plein mis à jour !"); setEditPlein(null); setVue("historique"); };
  const handleDelete = async (id) => { await deleteDoc(doc(db,"carburant",id)); await fetchAll(); setConfirmDelete(null); notify("🗑️ Plein supprimé."); };
  const notify = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3000); };

  // ── Stats générales ───────────────────────────────────────────────────────
  const now          = new Date();
  const moisCourant  = now.getMonth();
  const anneeCourant = now.getFullYear();
  const nomMois      = now.toLocaleDateString("fr-FR", { month:"long", year:"numeric" });

  const pleinsMois  = pleins.filter(p => { const d = new Date(p.date); return d.getMonth()===moisCourant && d.getFullYear()===anneeCourant; });
  const depenseMois = pleinsMois.reduce((a,p) => a+(p.montant||0), 0);
  const litresMois  = pleinsMois.reduce((a,p) => a+(p.litres||0), 0);
  const nbPleins    = pleinsMois.length;

  const bonsTerminesMois = bons.filter(b => {
    if (b.statut !== "terminé") return false;
    const d = new Date(b.datePrevue);
    return d.getMonth()===moisCourant && d.getFullYear()===anneeCourant;
  });

  // Conso L/100
  const sorted = [...pleins].sort((a,b) => a.kilometrage-b.kilometrage);
  let conso = null;
  if (sorted.length >= 2) {
    const avecL = sorted.filter(p=>p.litres);
    if (avecL.length >= 2) {
      const dKm = sorted[sorted.length-1].kilometrage - sorted[0].kilometrage;
      const tL  = avecL.slice(1).reduce((a,p)=>a+p.litres,0);
      if (dKm>0) conso = ((tL/dKm)*100).toFixed(1);
    }
  }

  // Km par plein
  const pleinsAvecKm = [...pleins]
    .sort((a,b) => a.kilometrage-b.kilometrage)
    .map((p,i,arr) => ({...p, kmParcourus: i>0 ? p.kilometrage-arr[i-1].kilometrage : null}))
    .sort((a,b) => new Date(b.date)-new Date(a.date));

  const kmMoyenParPlein = () => {
    const av = pleinsAvecKm.filter(p=>p.kmParcourus>0);
    return av.length ? (av.reduce((a,p)=>a+p.kmParcourus,0)/av.length).toFixed(0) : null;
  };

  // Budget
  const budgetPct    = Math.min((depenseMois/BUDGET_MENSUEL_EUROS)*100,100);
  const alerteBudget = depenseMois > BUDGET_MENSUEL_EUROS;
  const alerteProche = !alerteBudget && budgetPct >= 80;
  const jaugeColor   = alerteBudget ? ORANGE : alerteProche ? YELLOW : TEAL;
  const totalGeneral = pleins.reduce((a,p)=>a+(p.montant||0),0);
  const tdStyle      = { padding:"9px 12px", borderBottom:"1px solid #f0f0f0", whiteSpace:"nowrap", fontSize:13 };

  // ── Données Performance 6 mois ────────────────────────────────────────────
  const perfData = Array.from({length:6},(_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    const label = d.toLocaleDateString("fr-FR",{month:"short"});
    const mois  = d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
    const montant = pleins.filter(p=>{const pd=new Date(p.date);return pd.getMonth()===m&&pd.getFullYear()===y;}).reduce((a,p)=>a+(p.montant||0),0);
    const nbBons  = bons.filter(b=>{if(b.statut!=="terminé")return false;const bd=new Date(b.datePrevue);return bd.getMonth()===m&&bd.getFullYear()===y;}).length;
    const montantFacture = bons.filter(b=>{if(b.statut!=="terminé"||!b.montantFacture)return false;const bd=new Date(b.datePrevue);return bd.getMonth()===m&&bd.getFullYear()===y;}).reduce((a,b)=>a+(b.montantFacture||0),0);
    const kmMois = pleinsAvecKm.filter(p=>{const pd=new Date(p.date);return pd.getMonth()===m&&pd.getFullYear()===y;}).reduce((a,p)=>a+(p.kmParcourus||0),0);
    return {
      label, mois, montant, bons:nbBons, montantFacture,
      rentabilite: montantFacture>0 ? montantFacture-montant : null,
      coutParBon:  nbBons>0 ? (montant/nbBons).toFixed(2) : null,
      kmParBon:    nbBons>0&&kmMois>0 ? Math.round(kmMois/nbBons) : null,
    };
  });

  // ── KPI : Coût carburant par type d'intervention ──────────────────────────
  const coutParType = (() => {
    const map = {};
    bons.filter(b => b.statut==="terminé").forEach(b => {
      const types = b.types || (b.type ? b.type.split(", ") : []);
      types.forEach(t => {
        if (!map[t]) map[t] = { nbBons:0, montantTotal:0 };
        map[t].nbBons++;
      });
    });
    // Répartir le coût carburant proportionnellement par mois
    perfData.forEach(pd => {
      if (pd.montant<=0 || pd.bons<=0) return;
      const coutParBon = pd.montant/pd.bons;
      bons.filter(b=>{
        if(b.statut!=="terminé")return false;
        const bd=new Date(b.datePrevue);
        const pd2=new Date(b.datePrevue);
        return bd.getFullYear()===pd2.getFullYear();
      });
    });
    // Calcul simplifié : coût total carburant / nombre total de bons par type
    const totalBons   = bons.filter(b=>b.statut==="terminé").length;
    const totalCarbu  = pleins.reduce((a,p)=>a+(p.montant||0),0);
    const coutMoyBon  = totalBons>0 ? totalCarbu/totalBons : 0;
    return Object.entries(map)
      .map(([type, v]) => ({ type, nbBons:v.nbBons, coutEstime:(v.nbBons*coutMoyBon).toFixed(2), coutParBon:coutMoyBon.toFixed(2) }))
      .sort((a,b) => b.nbBons-a.nbBons);
  })();

  // ── KPI : Km & efficacité par jour ───────────────────────────────────────
  const parJour = (() => {
    const map = {};
    bons.filter(b=>b.statut==="terminé").forEach(b => {
      const j = b.datePrevue;
      if (!map[j]) map[j] = { nbBons:0, adresses:[] };
      map[j].nbBons++;
      if (b.adresseIntervention || b.clientAdresse) map[j].adresses.push(b.adresseIntervention||b.clientAdresse);
    });
    return Object.entries(map)
      .map(([date, v]) => ({
        date,
        nbBons: v.nbBons,
        zones: [...new Set(v.adresses.map(a=>getZone(a)).filter(z=>z!=="Non défini"))],
      }))
      .sort((a,b) => new Date(b.date)-new Date(a.date))
      .slice(0,10);
  })();

  // ── KPI : Coût carburant par zone ─────────────────────────────────────────
  const coutParZone = (() => {
    const map = {};
    const totalBons  = bons.filter(b=>b.statut==="terminé").length;
    const totalCarbu = pleins.reduce((a,p)=>a+(p.montant||0),0);
    const coutMoyBon = totalBons>0 ? totalCarbu/totalBons : 0;

    bons.filter(b=>b.statut==="terminé").forEach(b => {
      const adresse = b.adresseIntervention||b.clientAdresse||"";
      const zone    = getZone(adresse);
      if (!map[zone]) map[zone] = { nbBons:0 };
      map[zone].nbBons++;
    });

    return Object.entries(map)
      .map(([zone,v]) => ({ zone, nbBons:v.nbBons, coutEstime:(v.nbBons*coutMoyBon).toFixed(2) }))
      .sort((a,b) => b.nbBons-a.nbBons);
  })();

  // ── Rentabilité ce mois ───────────────────────────────────────────────────
  const montantFactureMois = bonsTerminesMois.reduce((a,b)=>a+(b.montantFacture||0),0);
  const rentabiliteMois    = montantFactureMois>0 ? montantFactureMois-depenseMois : null;

  // ── Mode édition ──────────────────────────────────────────────────────────
  if (editPlein) {
    const initial = {
      date:String(editPlein.date), kilometrage:String(editPlein.kilometrage),
      montant:String(editPlein.montant),
      prixLitre: editPlein.prixLitre!=null ? String(editPlein.prixLitre) : "",
      conducteur:editPlein.conducteur, commentaire:editPlein.commentaire||"",
    };
    return (
      <div style={{ fontFamily:"'Segoe UI', sans-serif", maxWidth:720, margin:"0 auto", padding:"0 16px 40px" }}>
        <div style={{ background:`linear-gradient(135deg,${TEAL},${TEAL_DARK})`, borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff" }}>
          <div style={{ fontSize:22, fontWeight:700 }}>⛽ Suivi Carburant</div>
        </div>
        <PleinForm user={user} initial={initial} onSave={handleEdit} onCancel={() => setEditPlein(null)} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'Segoe UI', sans-serif", maxWidth:720, margin:"0 auto", padding:"0 16px 40px" }}>

      {/* HEADER */}
      <div style={{ background:`linear-gradient(135deg,${TEAL},${TEAL_DARK})`, borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff", boxShadow:"0 4px 16px rgba(42,157,143,0.3)" }}>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:14 }}>⛽ Suivi Carburant</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            {id:"dashboard",  label:"🏠 Tableau de bord"},
            {id:"ajouter",    label:"+ Ajouter un plein"},
            {id:"historique", label:"📋 Historique"},
            {id:"performance",label:"📈 Performance"},
          ].map(({id,label}) => (
            <button key={id} onClick={() => setVue(id)} style={{ padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:vue===id?"#fff":"rgba(255,255,255,0.18)", color:vue===id?TEAL_DARK:"#fff" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {successMsg && <div style={{ background:"#e8f5e9", border:"1px solid #a5d6a7", color:"#2e7d32", padding:"12px 16px", borderRadius:10, marginBottom:16, fontWeight:600 }}>{successMsg}</div>}

      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, maxWidth:340, width:"90%", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
            <p style={{ fontWeight:600, color:"#333", marginBottom:20 }}>Supprimer ce plein ?<br/><span style={{ fontWeight:400, fontSize:13, color:GRAY }}>Cette action est irréversible.</span></p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:600 }}>Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background:ORANGE, color:"#fff", cursor:"pointer", fontWeight:700 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DASHBOARD ══ */}
      {vue === "dashboard" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {(alerteBudget||alerteProche) && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:10, border:"2px solid", borderColor:alerteBudget?ORANGE:YELLOW, background:alerteBudget?"#fff4f0":"#fffbf0" }}>
              <span style={{ fontSize:22 }}>{alerteBudget?"🔴":"🟡"}</span>
              <span style={{ fontWeight:600, fontSize:14, color:alerteBudget?ORANGE:"#c07020" }}>
                {alerteBudget ? `Budget dépassé ! ${depenseMois.toFixed(2)} € dépensés pour ${BUDGET_MENSUEL_EUROS} € prévus.` : `Attention : ${budgetPct.toFixed(0)} % du budget atteint — ${depenseMois.toFixed(2)} € / ${BUDGET_MENSUEL_EUROS} €`}
              </span>
            </div>
          )}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            <StatCard icon="💶" titre={`Dépense — ${nomMois}`} valeur={`${depenseMois.toFixed(2)} €`} sous={`${nbPleins} plein${nbPleins>1?"s":""}`} />
            <StatCard icon="🛢️" titre="Litres ce mois" valeur={litresMois>0?`${litresMois.toFixed(1)} L`:"—"} sous="consommés" />
            <StatCard icon="📊" titre="Conso. moyenne" valeur={conso?`${conso} L/100`:"—"} sous={conso?"sur l'historique":"min. 2 pleins"} />
            <StatCard icon="📍" titre="Km moyen / plein" valeur={kmMoyenParPlein()?`${kmMoyenParPlein()} km`:"—"} />
          </div>
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontWeight:600, color:"#333" }}>Budget mensuel</span>
              <span style={{ fontWeight:700, color:jaugeColor }}>{depenseMois.toFixed(2)} € / {BUDGET_MENSUEL_EUROS} €</span>
            </div>
            <div style={{ height:12, background:"#e5e7eb", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:99, width:`${budgetPct}%`, background:jaugeColor }} />
            </div>
            <div style={{ textAlign:"right", fontSize:12, color:"#888", marginTop:4 }}>Il reste {Math.max(0,BUDGET_MENSUEL_EUROS-depenseMois).toFixed(2)} €</div>
          </div>
          {pleinsAvecKm.length>0 && (
            <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight:600, color:"#333", marginBottom:10 }}>Dernier plein</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, fontSize:14 }}>
                <span>📅 {new Date(pleinsAvecKm[0].date).toLocaleDateString("fr-FR")}</span>
                {pleinsAvecKm[0].litres && <span>🛢️ {pleinsAvecKm[0].litres.toFixed(2)} L</span>}
                <span>📍 {pleinsAvecKm[0].kilometrage?.toLocaleString("fr-FR")} km</span>
                {pleinsAvecKm[0].kmParcourus && <span>🛣️ {pleinsAvecKm[0].kmParcourus} km parcourus</span>}
                <span style={{ fontWeight:700, color:TEAL_DARK }}>💶 {pleinsAvecKm[0].montant?.toFixed(2)} €</span>
              </div>
            </div>
          )}
          {pleins.length===0 && !fetchLoading && (
            <div style={{ textAlign:"center", padding:40, color:GRAY }}>
              <div style={{ fontSize:40, marginBottom:10 }}>⛽</div>
              <p>Aucun plein enregistré.</p>
              <button onClick={() => setVue("ajouter")} style={{ marginTop:10, background:TEAL, color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontWeight:600 }}>Ajouter le premier plein</button>
            </div>
          )}
        </div>
      )}

      {/* ══ FORMULAIRE ══ */}
      {vue === "ajouter" && <PleinForm user={user} onSave={handleAdd} onCancel={() => setVue("dashboard")} />}

      {/* ══ HISTORIQUE ══ */}
      {vue === "historique" && (
        <div style={{ background:"#fff", borderRadius:12, padding:"20px 22px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
          <h3 style={{ margin:"0 0 16px", color:TEAL_DARK }}>Historique {pleins.length>0&&`(${pleins.length} — total : ${totalGeneral.toFixed(2)} €)`}</h3>
          {fetchLoading ? <div style={{ textAlign:"center", padding:30, color:GRAY }}>Chargement…</div> : pleins.length===0 ? <div style={{ textAlign:"center", padding:30, color:GRAY }}>Aucun plein.</div> : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:TEAL }}>
                    {["Date","Km","Km parcourus","Montant","Prix/L","Litres","Conducteur","Actions"].map(h => (
                      <th key={h} style={{ padding:"9px 12px", textAlign:"left", color:"#fff", fontWeight:600, whiteSpace:"nowrap", fontSize:13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pleinsAvecKm.map((p,i) => (
                    <tr key={p.id} style={{ background:i%2===0?"#fff":LIGHT_BG }}>
                      <td style={tdStyle}>{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                      <td style={tdStyle}>{p.kilometrage?.toLocaleString("fr-FR")} km</td>
                      <td style={{...tdStyle, color:p.kmParcourus?TEAL_DARK:GRAY, fontStyle:p.kmParcourus?"normal":"italic"}}>{p.kmParcourus?`${p.kmParcourus} km`:"—"}</td>
                      <td style={{...tdStyle, fontWeight:700, color:TEAL_DARK}}>{p.montant?.toFixed(2)} €</td>
                      <td style={tdStyle}>{p.prixLitre?`${p.prixLitre.toFixed(3)} €`:"—"}</td>
                      <td style={tdStyle}>{p.litres?`${p.litres.toFixed(2)} L`:"—"}</td>
                      <td style={tdStyle}>{p.conducteur}</td>
                      <td style={tdStyle}>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={() => setEditPlein(p)} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${TEAL}`, background:"#fff", color:TEAL, cursor:"pointer", fontSize:12 }}>✏️</button>
                          <button onClick={() => setConfirmDelete(p.id)} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${ORANGE}`, background:"#fff", color:ORANGE, cursor:"pointer", fontSize:12 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ PERFORMANCE ══ */}
      {vue === "performance" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* ── Rentabilité ce mois ── */}
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <SectionTitle>💰 Rentabilité — {nomMois}</SectionTitle>
            <div style={{ fontSize:12, color:GRAY, marginBottom:12 }}>Basé sur les montants facturés saisis dans les bons</div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <StatCard icon="🔧" titre="Interventions terminées" valeur={bonsTerminesMois.length} color={PURPLE} />
              <StatCard icon="💶" titre="Carburant ce mois" valeur={`${depenseMois.toFixed(2)} €`} />
              <StatCard icon="📋" titre="Total facturé" valeur={montantFactureMois>0?`${montantFactureMois.toFixed(2)} €`:"—"} sous={montantFactureMois===0?"renseignez les bons":undefined} color={GREEN} />
              <StatCard icon={rentabiliteMois!==null?(rentabiliteMois>=0?"📈":"📉"):"💡"}
                titre="Marge nette carburant"
                valeur={rentabiliteMois!==null?`${rentabiliteMois>=0?"+":""}${rentabiliteMois.toFixed(2)} €`:"—"}
                sous={rentabiliteMois===null?"montants facturés manquants":undefined}
                color={rentabiliteMois===null?GRAY:rentabiliteMois>=0?GREEN:RED} />
              <StatCard icon="⛽" titre="Coût carbu / intervention"
                valeur={bonsTerminesMois.length>0?`${(depenseMois/bonsTerminesMois.length).toFixed(2)} €`:"—"}
                color={ORANGE} />
            </div>
          </div>

          {/* ── Graphique 6 mois ── */}
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <SectionTitle>📊 Carburant & interventions — 6 mois</SectionTitle>
            <div style={{ fontSize:12, color:GRAY, marginBottom:12 }}>Les points violets = nombre d'interventions terminées</div>
            <CombinedChart data={perfData} />
          </div>

          {/* ── Coût carburant par type ── */}
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <SectionTitle>🔧 Coût carburant par type d'intervention</SectionTitle>
            <div style={{ fontSize:12, color:GRAY, marginBottom:12 }}>Estimation basée sur le coût moyen par bon sur l'historique complet</div>
            {coutParType.length===0 ? <div style={{ color:GRAY, fontSize:13 }}>Aucune donnée.</div> : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:TEAL }}>
                      {["Type d'intervention","Nb bons","Coût carbu estimé","Coût/bon"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#fff", fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coutParType.map((r,i) => (
                      <tr key={i} style={{ background:i%2===0?"#fff":LIGHT_BG }}>
                        <td style={tdStyle}>{r.type}</td>
                        <td style={{...tdStyle, color:PURPLE, fontWeight:600}}>{r.nbBons}</td>
                        <td style={{...tdStyle, fontWeight:700, color:TEAL_DARK}}>{r.coutEstime} €</td>
                        <td style={tdStyle}>{r.coutParBon} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Coût carburant par zone ── */}
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <SectionTitle>🗺️ Coût carburant par zone Martinique</SectionTitle>
            <div style={{ fontSize:12, color:GRAY, marginBottom:12 }}>Basé sur les adresses d'intervention des bons terminés</div>
            {coutParZone.length===0 ? <div style={{ color:GRAY, fontSize:13 }}>Aucune donnée.</div> : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {coutParZone.map((z,i) => {
                  const pct = Math.max((z.nbBons / Math.max(...coutParZone.map(x=>x.nbBons)))*100, 4);
                  const zoneColors = { "Nord Caraïbes":"#0ea5e9","Nord Atlantique":"#8b5cf6","Centre":"#2a9d8f","Sud Caraïbes":"#f59e0b","Sud Atlantique":"#ef4444","Non défini":"#9ca3af" };
                  const color = zoneColors[z.zone] || TEAL;
                  return (
                    <div key={i}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
                        <span style={{ fontWeight:600 }}>{z.zone}</span>
                        <span style={{ color:GRAY }}>{z.nbBons} bon{z.nbBons>1?"s":""} — <b style={{ color:TEAL_DARK }}>{z.coutEstime} €</b></span>
                      </div>
                      <div style={{ height:8, background:"#e5e7eb", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Km parcourus & efficacité par jour ── */}
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <SectionTitle>📅 Efficacité par jour d'activité</SectionTitle>
            <div style={{ fontSize:12, color:GRAY, marginBottom:12 }}>10 derniers jours avec des interventions terminées</div>
            {parJour.length===0 ? <div style={{ color:GRAY, fontSize:13 }}>Aucune donnée.</div> : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:TEAL }}>
                      {["Date","Bons terminés","Zones couvertes"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#fff", fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parJour.map((j,i) => (
                      <tr key={i} style={{ background:i%2===0?"#fff":LIGHT_BG }}>
                        <td style={tdStyle}>{new Date(j.date).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</td>
                        <td style={{...tdStyle, color:PURPLE, fontWeight:700}}>{j.nbBons}</td>
                        <td style={tdStyle}>
                          {j.zones.length>0
                            ? j.zones.map((z,zi) => <span key={zi} style={{ display:"inline-block", background:TEAL_LIGHT, color:TEAL_DARK, borderRadius:10, padding:"2px 8px", fontSize:11, marginRight:4, marginBottom:2, fontWeight:600 }}>{z}</span>)
                            : <span style={{ color:GRAY, fontStyle:"italic" }}>Non défini</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Tableau 6 mois ── */}
          <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <SectionTitle>📋 Synthèse mensuelle</SectionTitle>
            <div style={{ overflowX:"auto", marginTop:12 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:TEAL }}>
                    {["Mois","Carburant","Bons","Facturé","Marge","Coût/bon","Km/bon"].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#fff", fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...perfData].reverse().map((d,i) => (
                    <tr key={i} style={{ background:i%2===0?"#fff":LIGHT_BG }}>
                      <td style={tdStyle}>{d.mois}</td>
                      <td style={{...tdStyle, fontWeight:700, color:d.montant>BUDGET_MENSUEL_EUROS?ORANGE:TEAL_DARK}}>
                        {d.montant>0?`${d.montant.toFixed(2)} €`:"—"}
                        {d.montant>BUDGET_MENSUEL_EUROS&&<span style={{fontSize:10,marginLeft:4}}>⚠️</span>}
                      </td>
                      <td style={{...tdStyle, color:PURPLE, fontWeight:600}}>{d.bons>0?d.bons:"—"}</td>
                      <td style={{...tdStyle, color:GREEN, fontWeight:600}}>{d.montantFacture>0?`${d.montantFacture.toFixed(2)} €`:"—"}</td>
                      <td style={{...tdStyle, fontWeight:700, color:d.rentabilite===null?GRAY:d.rentabilite>=0?GREEN:RED}}>
                        {d.rentabilite===null?"—":`${d.rentabilite>=0?"+":""}${d.rentabilite.toFixed(2)} €`}
                      </td>
                      <td style={tdStyle}>{d.coutParBon?`${d.coutParBon} €`:"—"}</td>
                      <td style={tdStyle}>{d.kmParBon?`${d.kmParBon} km`:"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
