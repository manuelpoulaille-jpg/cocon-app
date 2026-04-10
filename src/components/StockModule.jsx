// ─────────────────────────────────────────────────────────────────────────────
// StockModule.jsx — Gestion du Stock pour Cocon+
// À placer dans : src/components/StockModule.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Données initiales ─────────────────────────────────────────────────────────
const STOCK_INITIAL = [
  // Équipements
  { nom: "Marteau",           categorie: "Équipement", unite: "unité",  quantiteBon: 2, quantiteMauvais: 0 },
  { nom: "Perforateur",       categorie: "Équipement", unite: "unité",  quantiteBon: 2, quantiteMauvais: 0 },
  { nom: "Pince multiple",    categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Tournevis plat",    categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Visseuse à choc",   categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Visseuse normale",  categorie: "Équipement", unite: "unité",  quantiteBon: 2, quantiteMauvais: 0 },
  { nom: "Batterie",          categorie: "Équipement", unite: "unité",  quantiteBon: 2, quantiteMauvais: 0 },
  { nom: "Chargeur",          categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Meuleuse",          categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Cisailleuse",       categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Rallonge",          categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Pompe",             categorie: "Équipement", unite: "unité",  quantiteBon: 2, quantiteMauvais: 0 },
  { nom: "Flexible",          categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 1 },
  { nom: "Ciseaux",           categorie: "Équipement", unite: "paire",  quantiteBon: 1, quantiteMauvais: 0 },
  { nom: "Mètre",             categorie: "Équipement", unite: "unité",  quantiteBon: 3, quantiteMauvais: 0 },
  { nom: "Pulvérisateur",     categorie: "Équipement", unite: "unité",  quantiteBon: 1, quantiteMauvais: 0 },
  // Consommables
  { nom: "Insecticide",               categorie: "Consommable", unite: "L",      quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Raticide (blocs appâts)",   categorie: "Consommable", unite: "kg",     quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Gel anti-cafards",          categorie: "Consommable", unite: "tube",   quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Appâts fourmis",            categorie: "Consommable", unite: "unité",  quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Produit anti-termites",     categorie: "Consommable", unite: "L",      quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Produit désinfectant",      categorie: "Consommable", unite: "L",      quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Répulsif chauves-souris",   categorie: "Consommable", unite: "L",      quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Masques FFP2",              categorie: "Consommable", unite: "unité",  quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Gants",                     categorie: "Consommable", unite: "paire",  quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Combinaisons jetables",     categorie: "Consommable", unite: "unité",  quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Sacs poubelle",             categorie: "Consommable", unite: "rouleau",quantiteBon: 0, quantiteMauvais: 0 },
  { nom: "Ruban adhésif",             categorie: "Consommable", unite: "rouleau",quantiteBon: 0, quantiteMauvais: 0 },
];

const UNITES = ["unité", "paire", "L", "kg", "tube", "rouleau", "boîte"];

const TEAL      = "#2a9d8f";
const TEAL_DARK = "#1f7a6e";
const TEAL_LIGHT= "#e8f5f3";
const ORANGE    = "#e76f51";
const GRAY      = "#6b7280";
const LIGHT     = "#f7fbfa";
const WHITE     = "#ffffff";

// ── Composants utilitaires ────────────────────────────────────────────────────

function StateBadge({ quantiteBon, quantiteMauvais, unite }) {
  const total = quantiteBon + quantiteMauvais;
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ background:"#e8f5e9", color:"#2e7d32", padding:"2px 8px", borderRadius:20, fontSize:12, fontWeight:600 }}>
        ✅ {quantiteBon} {unite} bon{quantiteBon > 1 ? "s" : ""}
      </span>
      {quantiteMauvais > 0 && (
        <span style={{ background:"#fff4f0", color:ORANGE, padding:"2px 8px", borderRadius:20, fontSize:12, fontWeight:600 }}>
          ⚠️ {quantiteMauvais} mauvais
        </span>
      )}
    </div>
  );
}

function Field({ label, children, error }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:4 }}>{label}</label>
      {children}
      {error && <span style={{ fontSize:11, color:ORANGE }}>{error}</span>}
    </div>
  );
}

const inp = {
  width:"100%", padding:"9px 12px", border:"1px solid #e0e0e0",
  borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box",
};

// ── Composant principal ───────────────────────────────────────────────────────
export default function StockModule({ user, role }) {
  const [articles, setArticles]       = useState([]);
  const [vue, setVue]                 = useState("stock");
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");
  const [editArticle, setEditArticle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filtre, setFiltre]           = useState("Tous");
  const [initializing, setInitializing] = useState(false);

  const [form, setForm] = useState({
    nom:"", categorie:"Équipement", unite:"unité",
    quantiteBon:0, quantiteMauvais:0,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "stock"), orderBy("categorie"), orderBy("nom"));
      const snap = await getDocs(q);
      setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) {
      console.error("Erreur chargement stock :", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Initialisation avec la liste de base ──────────────────────────────────
  const initStock = async () => {
    if (!window.confirm(`Initialiser le stock avec ${STOCK_INITIAL.length} articles ? Cette action ne doublonnera pas les articles existants.`)) return;
    setInitializing(true);
    const nomsExistants = articles.map(a => a.nom.toLowerCase());
    let count = 0;
    for (const item of STOCK_INITIAL) {
      if (!nomsExistants.includes(item.nom.toLowerCase())) {
        await addDoc(collection(db, "stock"), { ...item, createdAt: serverTimestamp(), createdBy: user?.uid || "" });
        count++;
      }
    }
    await fetchArticles();
    setInitializing(false);
    notify(`✅ ${count} articles ajoutés !`);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.nom.trim()) e.nom = "Requis";
    if (form.quantiteBon < 0) e.quantiteBon = "Invalide";
    if (form.quantiteMauvais < 0) e.quantiteMauvais = "Invalide";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    try {
      const data = {
        nom:             form.nom.trim(),
        categorie:       form.categorie,
        unite:           form.unite,
        quantiteBon:     parseInt(form.quantiteBon) || 0,
        quantiteMauvais: parseInt(form.quantiteMauvais) || 0,
      };
      if (editArticle) {
        await updateDoc(doc(db, "stock", editArticle.id), data);
        notify("✅ Article mis à jour !");
      } else {
        await addDoc(collection(db, "stock"), { ...data, createdAt: serverTimestamp(), createdBy: user?.uid || "" });
        notify("✅ Article ajouté !");
      }
      await fetchArticles();
      resetForm();
      setVue("stock");
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "stock", id));
    await fetchArticles();
    setConfirmDelete(null);
    notify("🗑️ Article supprimé.");
  };

  const openEdit = (article) => {
    setEditArticle(article);
    setForm({
      nom:             article.nom,
      categorie:       article.categorie,
      unite:           article.unite,
      quantiteBon:     article.quantiteBon,
      quantiteMauvais: article.quantiteMauvais,
    });
    setErrors({});
    setVue("form");
  };

  const resetForm = () => {
    setForm({ nom:"", categorie:"Équipement", unite:"unité", quantiteBon:0, quantiteMauvais:0 });
    setEditArticle(null);
    setErrors({});
  };

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const articlesFiltres = articles.filter(a =>
    filtre === "Tous" || a.categorie === filtre
  );

  const stats = {
    total:       articles.length,
    equipements: articles.filter(a => a.categorie === "Équipement").length,
    consommables:articles.filter(a => a.categorie === "Consommable").length,
    mauvaisEtat: articles.filter(a => a.quantiteMauvais > 0).length,
  };

  const isAdmin = role === "admin";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Segoe UI', sans-serif", maxWidth:720, margin:"0 auto", padding:"0 16px 40px" }}>

      {/* HEADER */}
      <div style={{ background:`linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff", boxShadow:"0 4px 16px rgba(42,157,143,0.3)" }}>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:14 }}>📦 Gestion du Stock</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { id:"stock", label:"📦 Stock" },
            ...(isAdmin ? [{ id:"form", label: editArticle ? "✏️ Modifier" : "+ Ajouter" }] : []),
          ].map(({ id, label }) => (
            <button key={id} onClick={() => { if (id !== "form") resetForm(); setVue(id); }} style={{
              padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer",
              fontWeight:600, fontSize:13,
              background: vue === id ? "#fff" : "rgba(255,255,255,0.18)",
              color:      vue === id ? TEAL_DARK : "#fff",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Notification */}
      {msg && (
        <div style={{ background:"#e8f5e9", border:"1px solid #a5d6a7", color:"#2e7d32", padding:"12px 16px", borderRadius:10, marginBottom:16, fontWeight:600 }}>
          {msg}
        </div>
      )}

      {/* Modal suppression */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, maxWidth:340, width:"90%", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
            <p style={{ fontWeight:600, marginBottom:8 }}>Supprimer cet article ?</p>
            <p style={{ fontSize:13, color:GRAY, marginBottom:20 }}>Cette action est irréversible.</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:600 }}>Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background:ORANGE, color:"#fff", cursor:"pointer", fontWeight:700 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ VUE STOCK ══ */}
      {vue === "stock" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Cartes stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:12 }}>
            {[
              { label:"Total articles",  val:stats.total,        color:TEAL_DARK },
              { label:"Équipements",     val:stats.equipements,  color:"#1d4ed8" },
              { label:"Consommables",    val:stats.consommables, color:"#7c3aed" },
              { label:"En mauvais état", val:stats.mauvaisEtat,  color:stats.mauvaisEtat > 0 ? ORANGE : GRAY },
            ].map((s, i) => (
              <div key={i} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
                <div style={{ fontSize:11, color:GRAY, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:".04em" }}>{s.label}</div>
                <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["Tous", "Équipement", "Consommable"].map(f => (
              <button key={f} onClick={() => setFiltre(f)} style={{
                padding:"6px 16px", borderRadius:20, border:"none", cursor:"pointer",
                fontWeight:600, fontSize:13,
                background: filtre === f ? TEAL : "#fff",
                color:      filtre === f ? "#fff" : GRAY,
                boxShadow:  filtre === f ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
              }}>{f === "Tous" ? `Tous (${stats.total})` : f === "Équipement" ? `Équipements (${stats.equipements})` : `Consommables (${stats.consommables})`}</button>
            ))}
          </div>

          {/* Bouton initialisation (admin + stock vide) */}
          {isAdmin && articles.length === 0 && !loading && (
            <div style={{ background:"#fff", borderRadius:12, padding:"20px", textAlign:"center", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
              <p style={{ color:GRAY, marginBottom:16, fontSize:14 }}>Aucun article dans le stock.</p>
              <button onClick={initStock} disabled={initializing} style={{ background:TEAL, color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
                {initializing ? "Initialisation…" : "🚀 Initialiser avec la liste de base"}
              </button>
            </div>
          )}

          {/* Liste articles */}
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:GRAY }}>Chargement…</div>
          ) : articlesFiltres.length === 0 && articles.length > 0 ? (
            <div style={{ textAlign:"center", padding:40, color:GRAY }}>Aucun article dans cette catégorie.</div>
          ) : (
            articlesFiltres.map((a, i) => (
              <div key={a.id} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:15 }}>{a.nom}</span>
                    <span style={{ fontSize:11, background: a.categorie === "Équipement" ? "#dbeafe" : "#ede9fe", color: a.categorie === "Équipement" ? "#1d4ed8" : "#7c3aed", padding:"2px 8px", borderRadius:20, fontWeight:600 }}>
                      {a.categorie}
                    </span>
                  </div>
                  <StateBadge quantiteBon={a.quantiteBon} quantiteMauvais={a.quantiteMauvais} unite={a.unite} />
                </div>
                {isAdmin && (
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <button onClick={() => openEdit(a)} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${TEAL}`, background:"#fff", color:TEAL, cursor:"pointer", fontWeight:600, fontSize:13 }}>✏️</button>
                    <button onClick={() => setConfirmDelete(a.id)} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${ORANGE}`, background:"#fff", color:ORANGE, cursor:"pointer", fontWeight:600, fontSize:13 }}>🗑️</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ FORMULAIRE (admin uniquement) ══ */}
      {vue === "form" && isAdmin && (
        <div style={{ background:"#fff", borderRadius:12, padding:"20px 22px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
          <h3 style={{ margin:"0 0 18px", color:TEAL_DARK }}>{editArticle ? "Modifier l'article" : "Nouvel article"}</h3>

          <Field label="Nom de l'article *" error={errors.nom}>
            <input style={inp} placeholder="ex : Pulvérisateur" value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} />
          </Field>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
            <Field label="Catégorie">
              <select style={inp} value={form.categorie} onChange={e => setForm({...form, categorie:e.target.value})}>
                <option>Équipement</option>
                <option>Consommable</option>
              </select>
            </Field>
            <Field label="Unité">
              <select style={inp} value={form.unite} onChange={e => setForm({...form, unite:e.target.value})}>
                {UNITES.map(u => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
            <Field label="Quantité en bon état" error={errors.quantiteBon}>
              <input style={inp} type="number" min="0" value={form.quantiteBon} onChange={e => setForm({...form, quantiteBon:e.target.value})} />
            </Field>
            <Field label="Quantité en mauvais état" error={errors.quantiteMauvais}>
              <input style={inp} type="number" min="0" value={form.quantiteMauvais} onChange={e => setForm({...form, quantiteMauvais:e.target.value})} />
            </Field>
          </div>

          {/* Aperçu */}
          <div style={{ padding:"10px 14px", background:TEAL_LIGHT, borderRadius:8, marginBottom:16, fontSize:13, color:TEAL_DARK }}>
            Total : <b>{(parseInt(form.quantiteBon)||0) + (parseInt(form.quantiteMauvais)||0)} {form.unite}(s)</b>
            &nbsp;—&nbsp;
            {parseInt(form.quantiteBon)||0} en bon état
            {(parseInt(form.quantiteMauvais)||0) > 0 && `, ${form.quantiteMauvais} en mauvais état`}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => { resetForm(); setVue("stock"); }} style={{ flex:1, padding:"11px 0", borderRadius:8, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:600, color:"#555" }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:"11px 0", borderRadius:8, border:"none", background:saving?"#aaa":TEAL, color:"#fff", cursor:saving?"not-allowed":"pointer", fontWeight:700, fontSize:15 }}>
              {saving ? "Enregistrement…" : editArticle ? "Mettre à jour" : "Ajouter l'article"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
