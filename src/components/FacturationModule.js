import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, orderBy, query } from "firebase/firestore";

const SF_STYLES = {
  "à facturer":      { bg:"#fff8f0", color:"#8B6A4E", border:"0.5px solid #e8c9b8" },
  "facture envoyée": { bg:"#eef1ff", color:"#3a5ab0", border:"0.5px solid #aabae8" },
  "payé":            { bg:"#e1f5ee", color:"#0e6b50", border:"0.5px solid #a0dece" },
};

const SFBadge = ({ s }) => {
  const st = SF_STYLES[s] || { bg:"#eee", color:"#333", border:"none" };
  return (
    <span style={{
      fontSize:10, fontWeight:600, padding:"3px 10px", borderRadius:20,
      background:st.bg, color:st.color, border:st.border,
      whiteSpace:"nowrap", display:"inline-block", textTransform:"capitalize",
    }}>
      {s}
    </span>
  );
};

const fmtEur = (n) =>
  n > 0 ? n.toLocaleString("fr-FR", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " €" : "—";

export default function FacturationModule() {
  const [bons,       setBons]       = useState([]);
  const [filter,     setFilter]     = useState("tous");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(null);
  const [numFactures,setNumFactures]= useState({});

  const fetchBons = useCallback(async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "bons"), orderBy("createdAt","desc"));
      const snap = await getDocs(q);
      const termines = snap.docs
        .map(d => ({ id:d.id, ...d.data() }))
        .filter(b => b.statut === "terminé");
      setBons(termines);
      const nf = {};
      termines.forEach(b => { nf[b.id] = b.numFacture || ""; });
      setNumFactures(nf);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBons(); }, [fetchBons]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const avancerStatut = async (bon) => {
    const sf   = bon.statutFacture || "à facturer";
    const next = sf === "à facturer" ? "facture envoyée"
               : sf === "facture envoyée" ? "payé" : null;
    if (!next) return;
    setSaving(bon.id);
    const extra = {};
    if (next === "facture envoyée") extra.dateFacture   = new Date().toLocaleDateString("fr-CA");
    if (next === "payé")            extra.datePaiement  = new Date().toLocaleDateString("fr-CA");
    await updateDoc(doc(db, "bons", bon.id), {
      statutFacture: next,
      numFacture: numFactures[bon.id] || "",
      ...extra,
    });
    await fetchBons();
    setSaving(null);
  };

  const saveNumFacture = async (bon) => {
    setSaving(bon.id + "-num");
    await updateDoc(doc(db, "bons", bon.id), { numFacture: numFactures[bon.id] || "" });
    await fetchBons();
    setSaving(null);
  };

  /* ── Stats ────────────────────────────────────────────────────────────── */

  const stats = {
    aFacturer:   bons.filter(b => !b.statutFacture || b.statutFacture === "à facturer").length,
    envoyee:     bons.filter(b => b.statutFacture === "facture envoyée").length,
    paye:        bons.filter(b => b.statutFacture === "payé").length,
    caPaye:      bons.filter(b => b.statutFacture === "payé")
                     .reduce((s,b) => s + parseFloat(b.montantFacture||0), 0),
    caEnAttente: bons.filter(b => b.statutFacture !== "payé")
                     .reduce((s,b) => s + parseFloat(b.montantFacture||0), 0),
    caTotal:     bons.reduce((s,b) => s + parseFloat(b.montantFacture||0), 0),
  };

  const filtered = filter === "tous"
    ? bons
    : bons.filter(b => (b.statutFacture || "à facturer") === filter);

  /* ── Rendu ────────────────────────────────────────────────────────────── */

  return (
    <div style={{ padding:20 }}>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"À facturer",        val:stats.aFacturer,            accent:"#8B6A4E", sub:"interventions en attente" },
          { label:"Factures envoyées", val:stats.envoyee,              accent:"#3a5ab0", sub:"en attente de paiement" },
          { label:"Payées",            val:stats.paye,                 accent:"#35B499", sub:"dossiers clôturés" },
          { label:"CA encaissé",       val:fmtEur(stats.caPaye),       accent:"#35B499", sub:"paiements reçus" },
          { label:"CA en attente",     val:fmtEur(stats.caEnAttente),  accent:"#8B6A4E", sub:"non encore encaissé" },
          { label:"CA total (TTC)",    val:fmtEur(stats.caTotal),      accent:"#b4b2a9", sub:"tous bons terminés" },
        ].map(({ label,val,accent,sub }) => (
          <div key={label} style={{
            background:"white", borderRadius:10, padding:"13px 15px",
            border:"0.5px solid #e0ddd8", position:"relative", overflow:"hidden",
          }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:accent }}/>
            <p style={{ fontSize:"9.5px",color:"#888",textTransform:"uppercase",
              letterSpacing:"0.8px",margin:"0 0 4px",fontWeight:500 }}>{label}</p>
            <p style={{ fontSize:20,fontWeight:700,color:"#1a1a1a",
              letterSpacing:"-0.5px",margin:"0 0 3px",lineHeight:1.1 }}>{val}</p>
            <p style={{ fontSize:"9px",color:"#aaa",margin:0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
        {[
          ["tous",            "Tous"],
          ["à facturer",      "À facturer"],
          ["facture envoyée", "Envoyées"],
          ["payé",            "Payées"],
        ].map(([f,l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20,
            border: filter===f ? "none" : "0.5px solid #e0ddd8",
            cursor:"pointer", fontSize:12, fontWeight:filter===f?600:400,
            background: filter===f ? "#35B499" : "white",
            color: filter===f ? "white" : "#555", transition:"all .15s",
          }}>{l}</button>
        ))}
        <span style={{ marginLeft:"auto",fontSize:11,color:"#aaa" }}>
          {filtered.length} bon{filtered.length!==1?"s":""}
        </span>
      </div>

      {/* Tableau */}
      {loading ? (
        <p style={{ textAlign:"center",color:"#aaa",padding:"3rem 0",fontSize:13 }}>Chargement…</p>
      ) : (
        <div style={{ background:"white",borderRadius:10,border:"0.5px solid #e0ddd8",overflow:"hidden" }}>
          <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:780 }}>
              <thead>
                <tr style={{ borderBottom:"0.5px solid #e8e5e0" }}>
                  {["Réf.","Client","Date","Type","Montant","N° Facture","Statut","Action"].map(h => (
                    <th key={h} style={{
                      textAlign:"left", fontSize:"9.5px", fontWeight:500, color:"#888",
                      textTransform:"uppercase", letterSpacing:"0.8px",
                      padding:"8px 12px", whiteSpace:"nowrap", background:"white",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding:"28px",textAlign:"center",color:"#aaa",fontSize:13 }}>
                      Aucun bon trouvé.
                    </td>
                  </tr>
                )}
                {filtered.map(b => {
                  const sf        = b.statutFacture || "à facturer";
                  const nextLabel = sf === "à facturer"      ? "📄 Envoyer facture"
                                  : sf === "facture envoyée" ? "✅ Marquer payée" : null;
                  const isLoadingNum = saving === b.id + "-num";
                  const numChanged   = (numFactures[b.id] || "") !== (b.numFacture || "");

                  return (
                    <tr key={b.id} style={{ borderBottom:"0.5px solid #f0ede8" }}>
                      <td style={{ padding:"9px 12px" }}>
                        <span style={{ color:"#35B499",fontWeight:600,fontSize:12 }}>{b.ref}</span>
                      </td>
                      <td style={{ padding:"9px 12px" }}>
                        {b.clientSociete && (
                          <span style={{ display:"block",fontSize:10,color:"#35B499",fontWeight:600 }}>
                            {b.clientSociete}
                          </span>
                        )}
                        <span style={{ fontWeight:500 }}>{b.clientNom} {b.clientPrenom}</span>
                        <span style={{ display:"block",fontSize:10,color:"#888" }}>{b.clientTel}</span>
                      </td>
                      <td style={{ padding:"9px 12px",fontSize:11,color:"#888",whiteSpace:"nowrap" }}>
                        {b.datePrevue}
                        {b.dateFacture   && <span style={{ display:"block",color:"#3a5ab0",fontSize:10 }}>Fact. {b.dateFacture}</span>}
                        {b.datePaiement  && <span style={{ display:"block",color:"#35B499",fontSize:10 }}>Payé {b.datePaiement}</span>}
                      </td>
                      <td style={{ padding:"9px 12px",fontSize:11,color:"#555",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        {b.type}
                      </td>
                      <td style={{ padding:"9px 12px",fontWeight:600,whiteSpace:"nowrap",
                        color:b.montantFacture?"#35B499":"#ccc" }}>
                        {b.montantFacture ? parseFloat(b.montantFacture).toFixed(2)+" €" : "—"}
                      </td>
                      <td style={{ padding:"9px 12px" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                          <input
                            value={numFactures[b.id] || ""}
                            onChange={e => setNumFactures(prev => ({ ...prev,[b.id]:e.target.value }))}
                            placeholder="FAC-2026-001"
                            style={{
                              width:108, padding:"4px 8px", fontSize:11,
                              border:"0.5px solid #e0ddd8", borderRadius:6,
                              background:"#fafaf8", color:"#1a1a1a",
                            }}
                          />
                          {numChanged && (
                            <button onClick={() => saveNumFacture(b)} disabled={isLoadingNum} style={{
                              padding:"3px 8px", fontSize:10, borderRadius:5, border:"none",
                              background:"#35B499", color:"white", cursor:"pointer", flexShrink:0,
                            }}>
                              {isLoadingNum ? "…" : "✓"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding:"9px 12px" }}>
                        <SFBadge s={sf}/>
                      </td>
                      <td style={{ padding:"9px 12px",whiteSpace:"nowrap" }}>
                        {nextLabel ? (
                          <button onClick={() => avancerStatut(b)} disabled={saving===b.id} style={{
                            fontSize:10, padding:"5px 11px", borderRadius:6, cursor:"pointer", fontWeight:600,
                            background: sf==="à facturer" ? "#fff8f0" : "#e1f5ee",
                            color:      sf==="à facturer" ? "#6b4a31" : "#0e6b50",
                            border:     sf==="à facturer" ? "0.5px solid #e8c9b8" : "0.5px solid #a0dece",
                          }}>
                            {saving===b.id ? "…" : nextLabel}
                          </button>
                        ) : (
                          <span style={{ fontSize:11,color:"#35B499",fontWeight:600 }}>✓ Payée</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
