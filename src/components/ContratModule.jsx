import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
} from "firebase/firestore";
import logoBase64 from "../logoBase64";

// ── CONSTANTES ────────────────────────────────────────────────────────────────

const ALERT_DAYS        = 20;  // alerte renouvellement contrat
const RELANCE_ALERT_DAYS = 15; // alerte prochaine intervention

const COCON_INFO = {
  nom: "Cocon Plus SARL",
  adresse: "Berges de Kerlys, 97200 Fort-de-France",
  siret: "47756829900028",
  tel: "0596 73 66 66",
  email: "contact@cocon-protection.fr",
  web: "www.cocon-plus.fr",
  representant: "Jean-Marc SERVAND",
};

const PRESTATION_OPTIONS = [
  "Désinsectisation", "Dératisation", "Désinfection", "HACCP",
  "Traitement anti-termites", "Traitement anti-chauves-souris", "Étanchéité de toiture",
];

const EMPTY_FORM = {
  clientNom: "", clientResponsable: "", clientAdresse: "",
  clientTel: "", clientEmail: "", adresseIntervention: "",
  prestations: [], nbPassages: 4, montantHT: "", montantTTC: "",
  fraisDeplacement: 30, preavis: 1,
  dateSignature: "", dateDebut: "", statut: "actif", notes: "",
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });
}

function addOneYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("fr-CA");
}

function getDaysTo(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Calcule la date approximative du prochain passage
function nextPassageDate(c) {
  const nb = parseInt(c.nbPassages) || 4;
  const intervalDays = Math.round(365 / nb);
  const passages = (c.passages || []).map(p => p.date).filter(Boolean).sort();
  let baseDate;
  if (passages.length > 0) {
    // Depuis le dernier passage
    baseDate = new Date(passages[passages.length - 1] + "T00:00:00");
  } else if (c.dateDebut) {
    // Depuis le début du contrat
    baseDate = new Date(c.dateDebut + "T00:00:00");
  } else {
    return null;
  }
  const next = new Date(baseDate);
  next.setDate(next.getDate() + intervalDays);
  // Si la date calculée est déjà passée, avancer d'un intervalle
  const today = new Date();
  while (next < today) {
    next.setDate(next.getDate() + intervalDays);
  }
  return next.toLocaleDateString("fr-CA");
}

function fmtDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function computeStatut(c) {
  if (c.statut === "résilié" || c.statut === "brouillon") return c.statut;
  const days = getDaysTo(c.dateFin);
  if (days === null) return c.statut || "actif";
  if (days < 0) return "expiré";
  if (days <= ALERT_DAYS) return "à renouveler";
  return "actif";
}

function statutStyle(s) {
  return {
    "actif":        { bg: "#e1f5ee", color: "#0e6b50" },
    "à renouveler": { bg: "#f5e8d8", color: "#6b4a31" },
    "expiré":       { bg: "#fde8e8", color: "#9b2c2c" },
    "résilié":      { bg: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
    "brouillon":    { bg: "#f0f0f0", color: "#888" },
  }[s] || { bg: "#eee", color: "#333" };
}

// ── PDF ───────────────────────────────────────────────────────────────────────

async function generatePDF(c) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, ml = 15, mr = 195, cw = 180;
  const teal = [53, 180, 153], dark = [30, 30, 30], gray = [110, 110, 110], lightBg = [243, 243, 243];

  pdf.setFillColor(...teal); pdf.rect(0, 0, W, 30, "F");
  try { pdf.addImage(logoBase64, "PNG", ml, 4, 28, 22); } catch(e) {}
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(15); pdf.setFont("helvetica", "bold");
  pdf.text("CONTRAT DE PRESTATION DE SERVICES", 50, 13);
  pdf.setFontSize(8.5); pdf.setFont("helvetica", "normal");
  pdf.text("Lutte antiparasitaire & Protection du bâtiment", 50, 20);
  pdf.text(`Réf. ${c.ref}  |  Signé le ${fmtDate(c.dateSignature)}`, 50, 26);

  let y = 38;
  const hw = (cw - 8) / 2;
  const drawParty = (x, title, lines) => {
    pdf.setFillColor(...lightBg); pdf.rect(x, y, hw, 40, "F");
    pdf.setTextColor(...teal); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
    pdf.text(title, x + 4, y + 6);
    pdf.setTextColor(...dark); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
    lines.filter(Boolean).forEach((l, i) => pdf.text(l, x + 4, y + 13 + i * 5));
  };
  drawParty(ml, "LE PRESTATAIRE", [COCON_INFO.nom, COCON_INFO.adresse, `SIRET : ${COCON_INFO.siret}`, `Tél : ${COCON_INFO.tel}`, `Représenté par : ${COCON_INFO.representant}`]);
  drawParty(ml + hw + 8, "LE CLIENT", [c.clientNom, c.clientResponsable ? `Représenté par : ${c.clientResponsable}` : null, c.clientAdresse, c.clientTel ? `Tél : ${c.clientTel}` : null, c.clientEmail || null]);
  y += 46;

  if (c.adresseIntervention && c.adresseIntervention !== c.clientAdresse) {
    pdf.setFillColor(230, 248, 242); pdf.rect(ml, y, cw, 10, "F");
    pdf.setTextColor(...gray); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
    pdf.text("LIEU D'INTERVENTION : ", ml + 4, y + 6);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(...dark);
    pdf.text(c.adresseIntervention, ml + 46, y + 6);
    y += 15;
  }

  const article = (num, title, body) => {
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFillColor(...teal); pdf.rect(ml, y, cw, 7, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
    pdf.text(`ARTICLE ${num} — ${title.toUpperCase()}`, ml + 4, y + 5);
    y += 10;
    pdf.setTextColor(...dark); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(body, cw - 4);
    lines.forEach(line => { if (y > 272) { pdf.addPage(); y = 20; } pdf.text(line, ml + 2, y); y += 5; });
    y += 4;
  };

  const prestStr = (c.prestations || []).join(", ") || "—";
  const mTTC = parseFloat(c.montantTTC) || 0, mHT = parseFloat(c.montantHT) || 0;
  const nb = parseInt(c.nbPassages) || 4, frais = parseFloat(c.fraisDeplacement) || 0;
  const preavis = parseInt(c.preavis) || 1, annuel = (mTTC * nb).toFixed(2);
  const intervalMois = Math.round(12 / nb);

  article("1", "Descriptif de la prestation",
    `Le prestataire s'engage à réaliser les prestations suivantes au profit du client :\n${prestStr}.\n\nCes interventions comprennent la fourniture des produits homologués, du matériel et de la main-d'œuvre nécessaires à la bonne exécution des travaux.`);
  article("2", "Modalités de rémunération",
    `En contrepartie des prestations réalisées, le client s'engage à régler la somme de ${mTTC.toFixed(2)} € TTC (${mHT.toFixed(2)} € HT) par passage, soit un montant annuel de ${annuel} € TTC pour ${nb} passage(s).\n\nEn cas d'absence du client lors d'une intervention planifiée, des frais de déplacement de ${frais} € seront facturés.`);
  article("3", "Fréquence et durée d'engagement",
    `Les interventions seront réalisées à raison de ${nb} passage(s) par an, soit environ tous les ${intervalMois} mois, selon un calendrier convenu d'un commun accord.\n\nLe présent contrat est conclu pour une durée d'un (1) an à compter du ${fmtDate(c.dateDebut)}, soit jusqu'au ${fmtDate(c.dateFin)}.`);
  article("4", "Engagements et obligations du client",
    `Le client s'engage à :\n- Permettre l'accès aux locaux aux techniciens aux dates convenues ;\n- Respecter les consignes d'utilisation et de sécurité données après chaque intervention ;\n- Informer le prestataire de tout changement susceptible d'affecter les prestations ;\n- Régler les sommes dues dans les délais impartis.`);
  article("5", "Durée de validité du contrat",
    `Le présent contrat prend effet à compter de la date de signature et est valable pour une durée d'un (1) an. Il est renouvelable par accord exprès ou par tacite reconduction.`);
  article("6", "Obligation de délivrance",
    `Le prestataire s'engage à réaliser les prestations avec tout le soin et le professionnalisme requis. Un bon d'intervention signé sera remis au client à l'issue de chaque passage.`);
  article("7", "Rupture du contrat",
    `Chacune des parties peut mettre fin au présent contrat moyennant un préavis de ${preavis} mois, notifié par lettre recommandée avec accusé de réception.`);
  article("8", "Loi applicable",
    `Le présent contrat est soumis au droit français. Tout litige sera porté devant les tribunaux compétents de Fort-de-France, Martinique.`);
  article("9", "Modifications du contrat",
    `Toute modification devra faire l'objet d'un avenant écrit, daté et signé par les deux parties.`);

  if (y > 235) { pdf.addPage(); y = 20; }
  y += 4;
  pdf.setFillColor(...teal); pdf.rect(ml, y, cw, 7, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
  pdf.text("SIGNATURES", ml + 4, y + 5); y += 12;
  pdf.setTextColor(...dark); pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  pdf.text(`Fait à Fort-de-France, le ${fmtDate(c.dateSignature)}`, ml, y); y += 10;
  pdf.text("Le Prestataire", ml + 4, y); pdf.text("Le Client", ml + 100, y); y += 4;
  pdf.setFontSize(8); pdf.setTextColor(...gray);
  pdf.text(COCON_INFO.nom, ml + 4, y);
  pdf.text(c.clientNom + (c.clientResponsable ? ` — ${c.clientResponsable}` : ""), ml + 100, y); y += 4;
  pdf.setDrawColor(200, 200, 200); pdf.rect(ml, y, 82, 28); pdf.rect(ml + 98, y, 82, 28);
  pdf.setFontSize(7); pdf.setTextColor(...gray);
  pdf.text(`${COCON_INFO.nom} — ${COCON_INFO.adresse} — SIRET : ${COCON_INFO.siret} — ${COCON_INFO.tel} — ${COCON_INFO.web}`, W / 2, 288, { align: "center" });
  pdf.save(`contrat-${c.ref}-${c.clientNom.replace(/\s+/g, "-")}.pdf`);
}

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────

export default function ContratModule() {
  const [view,     setView]     = useState("list");
  const [contrats, setContrats] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState("tous");
  const [form,     setForm]     = useState({ ...EMPTY_FORM });
  const [isEdit,   setIsEdit]   = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Passages
  const [newPassage, setNewPassage] = useState("");

  // Relances
  const [newRelanceDate, setNewRelanceDate] = useState("");
  const [newRelanceNote, setNewRelanceNote] = useState("");

  useEffect(() => { fetchContrats(); }, []);

  // ── FIRESTORE ─────────────────────────────────────────────────────────────

  const fetchContrats = async () => {
    const snap = await getDocs(collection(db, "contrats"));
    const all = snap.docs
      .map(d => { const data = { id: d.id, ...d.data() }; return { ...data, sc: computeStatut(data) }; })
      .sort((a, b) => {
        const order = { "à renouveler": 0, "expiré": 1, "brouillon": 2, "actif": 3, "résilié": 4 };
        return (order[a.sc] ?? 5) - (order[b.sc] ?? 5);
      });
    setContrats(all);
  };

  const nextRef = (list) => {
    const nums = list.map(c => parseInt((c.ref || "").replace("CTR-", "") || "0")).filter(Boolean);
    return "CTR-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(5, "0");
  };

  const saveContrat = async () => {
    setSaving(true);
    const payload = {
      ...form,
      dateFin:          addOneYear(form.dateDebut),
      montantHT:        parseFloat(form.montantHT)        || 0,
      montantTTC:       parseFloat(form.montantTTC)       || 0,
      fraisDeplacement: parseFloat(form.fraisDeplacement) || 0,
      nbPassages:       parseInt(form.nbPassages)         || 4,
      preavis:          parseInt(form.preavis)            || 1,
    };
    delete payload.sc;
    if (isEdit && form.id) {
      await updateDoc(doc(db, "contrats", form.id), payload);
    } else {
      payload.ref          = nextRef(contrats);
      payload.dateCreation = Timestamp.now();
      payload.passages     = [];
      payload.relances     = [];
      await addDoc(collection(db, "contrats"), payload);
    }
    await fetchContrats();
    setSaving(false);
    setView("list");
  };

  const addPassage = async () => {
    if (!newPassage || !selected) return;
    const updated = [...(selected.passages || []), { date: newPassage }]
      .sort((a, b) => a.date.localeCompare(b.date));
    await updateDoc(doc(db, "contrats", selected.id), { passages: updated });
    const refreshed = { ...selected, passages: updated };
    setSelected({ ...refreshed, sc: computeStatut(refreshed) });
    setNewPassage("");
    fetchContrats();
  };

  const removePassage = async (idx) => {
    const updated = (selected.passages || []).filter((_, i) => i !== idx);
    await updateDoc(doc(db, "contrats", selected.id), { passages: updated });
    const refreshed = { ...selected, passages: updated };
    setSelected({ ...refreshed, sc: computeStatut(refreshed) });
    fetchContrats();
  };

  const addRelance = async () => {
    if (!newRelanceDate || !selected) return;
    const updated = [
      ...(selected.relances || []),
      { date: newRelanceDate, note: newRelanceNote || "" },
    ].sort((a, b) => a.date.localeCompare(b.date));
    await updateDoc(doc(db, "contrats", selected.id), { relances: updated });
    const refreshed = { ...selected, relances: updated };
    setSelected({ ...refreshed, sc: computeStatut(refreshed) });
    setNewRelanceDate("");
    setNewRelanceNote("");
    fetchContrats();
  };

  const removeRelance = async (idx) => {
    const updated = (selected.relances || []).filter((_, i) => i !== idx);
    await updateDoc(doc(db, "contrats", selected.id), { relances: updated });
    const refreshed = { ...selected, relances: updated };
    setSelected({ ...refreshed, sc: computeStatut(refreshed) });
    fetchContrats();
  };

  const renouveler = async (c) => {
    setSaving(true);
    const payload = {
      clientNom: c.clientNom, clientResponsable: c.clientResponsable || "",
      clientAdresse: c.clientAdresse, clientTel: c.clientTel || "",
      clientEmail: c.clientEmail || "", adresseIntervention: c.adresseIntervention || "",
      prestations: c.prestations || [], nbPassages: c.nbPassages,
      montantHT: c.montantHT, montantTTC: c.montantTTC,
      fraisDeplacement: c.fraisDeplacement, preavis: c.preavis,
      dateSignature: todayStr(), dateDebut: c.dateFin,
      dateFin: addOneYear(c.dateFin), statut: "actif",
      notes: `Renouvellement de ${c.ref}`,
      passages: [], relances: [],
      dateCreation: Timestamp.now(), ref: nextRef(contrats),
    };
    await addDoc(collection(db, "contrats"), payload);
    await updateDoc(doc(db, "contrats", c.id), { statut: "expiré" });
    await fetchContrats();
    setSaving(false);
    setView("list");
  };

  // ── VUE FORMULAIRE ────────────────────────────────────────────────────────

  if (view === "form") {
    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
          <h2>{isEdit ? `Modifier ${form.ref}` : "Nouveau contrat"}</h2>
        </div>

        <div className="card">
          <div className="card-title">Client</div>
          {[
            ["clientNom",           "Nom / Raison sociale *"],
            ["clientResponsable",   "Responsable (si société)"],
            ["clientAdresse",       "Adresse du siège *"],
            ["clientTel",           "Téléphone"],
            ["clientEmail",         "Email"],
            ["adresseIntervention", "Adresse d'intervention (si différente)"],
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input type="text" value={form[key] || ""} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Prestation</div>
          <div className="field">
            <label>Types de prestation</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
              {PRESTATION_OPTIONS.map(p => {
                const active = (form.prestations || []).includes(p);
                return (
                  <div key={p} onClick={() => set("prestations", active ? form.prestations.filter(x=>x!==p) : [...(form.prestations||[]),p])}
                    style={{ padding:"6px 14px", borderRadius:20, fontSize:13, cursor:"pointer", background:active?"#35B499":"transparent", color:active?"white":"var(--color-text-secondary)", border:active?"none":"0.5px solid var(--color-border-secondary)" }}>
                    {p}
                  </div>
                );
              })}
            </div>
          </div>
          {[
            ["nbPassages",       "Passages par an",              "number"],
            ["montantHT",        "Montant / passage HT (€)",     "number"],
            ["montantTTC",       "Montant / passage TTC (€)",    "number"],
            ["fraisDeplacement", "Frais déplacement absent (€)", "number"],
            ["preavis",          "Préavis résiliation (mois)",   "number"],
          ].map(([key, label, type]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input type={type} value={form[key] ?? ""} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          {form.montantTTC && form.nbPassages && (
            <p style={{ fontSize:12, color:"#35B499", marginTop:4 }}>
              Total annuel TTC : {(parseFloat(form.montantTTC) * parseInt(form.nbPassages)).toFixed(2)} €
            </p>
          )}
          {form.nbPassages && (
            <p style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>
              Intervalle entre passages : ~{Math.round(12 / parseInt(form.nbPassages))} mois
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-title">Dates & statut</div>
          <div className="field"><label>Date de signature</label><input type="date" value={form.dateSignature||""} onChange={e=>set("dateSignature",e.target.value)}/></div>
          <div className="field"><label>Date de début</label><input type="date" value={form.dateDebut||""} onChange={e=>set("dateDebut",e.target.value)}/></div>
          {form.dateDebut && <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:12}}>Fin automatique : {fmtDate(addOneYear(form.dateDebut))}</p>}
          <div className="field">
            <label>Statut</label>
            <select value={form.statut} onChange={e=>set("statut",e.target.value)}>
              <option value="actif">Actif</option>
              <option value="expiré">Expiré (contrat historique)</option>
              <option value="résilié">Résilié</option>
              <option value="brouillon">Brouillon</option>
            </select>
          </div>
          <div className="field"><label>Notes internes</label><textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Contexte, historique…"/></div>
        </div>

        <button className="btn-finish" style={{width:"100%",marginBottom:24}} disabled={saving||!form.clientNom} onClick={saveContrat}>
          {saving ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer le contrat"}
        </button>
      </div>
    );
  }

  // ── VUE DÉTAIL ────────────────────────────────────────────────────────────

  if (view === "detail" && selected) {
    const sc        = selected.sc || computeStatut(selected);
    const days      = getDaysTo(selected.dateFin);
    const sStyle    = statutStyle(sc);
    const annuel    = selected.montantTTC && selected.nbPassages ? (parseFloat(selected.montantTTC) * parseInt(selected.nbPassages)).toFixed(2) : "—";
    const pct       = selected.nbPassages ? Math.min(100, Math.round(((selected.passages||[]).length / selected.nbPassages) * 100)) : 0;
    const intervalMois = Math.round(12 / (parseInt(selected.nbPassages) || 4));
    const nextDate  = nextPassageDate(selected);
    const daysToNext = getDaysTo(nextDate);
    const relances  = (selected.relances || []).sort((a,b) => b.date.localeCompare(a.date));

    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
          <h2>{selected.ref}</h2>
          <span className="badge" style={{ background:sStyle.bg, color:sStyle.color }}>{sc}</span>
        </div>

        {/* Client */}
        <div className="card readonly">
          <div className="card-title">Client</div>
          <div className="info-row"><span>Nom</span><b>{selected.clientNom}</b></div>
          {selected.clientResponsable && <div className="info-row"><span>Responsable</span><b>{selected.clientResponsable}</b></div>}
          <div className="info-row"><span>Adresse siège</span><b>{selected.clientAdresse||"—"}</b></div>
          {selected.adresseIntervention && <div className="info-row"><span>Intervention</span><b>{selected.adresseIntervention}</b></div>}
          <div className="info-row"><span>Téléphone</span><b>{selected.clientTel||"—"}</b></div>
          <div className="info-row"><span>Email</span><b>{selected.clientEmail||"—"}</b></div>
        </div>

        {/* Prestation */}
        <div className="card readonly">
          <div className="card-title">Prestation</div>
          <div className="info-row"><span>Types</span><b>{(selected.prestations||[]).join(", ")||"—"}</b></div>
          <div className="info-row"><span>Passages / an</span><b>{selected.nbPassages} (tous les ~{intervalMois} mois)</b></div>
          <div className="info-row"><span>Montant / passage TTC</span><b style={{color:"#35B499"}}>{parseFloat(selected.montantTTC||0).toFixed(2)} €</b></div>
          <div className="info-row"><span>Total annuel TTC</span><b style={{color:"#35B499"}}>{annuel} €</b></div>
          <div className="info-row"><span>Frais déplacement</span><b>{selected.fraisDeplacement} €</b></div>
          <div className="info-row"><span>Préavis résiliation</span><b>{selected.preavis} mois</b></div>
        </div>

        {/* Durée */}
        <div className="card readonly">
          <div className="card-title">Durée du contrat</div>
          <div className="info-row"><span>Signé le</span><b>{fmtDate(selected.dateSignature)}</b></div>
          <div className="info-row"><span>Début</span><b>{fmtDate(selected.dateDebut)}</b></div>
          <div className="info-row">
            <span>Fin</span>
            <b style={{color: days!==null&&days<0?"#c0392b":days!==null&&days<=ALERT_DAYS?"#8B6A4E":"var(--color-text-primary)"}}>
              {fmtDate(selected.dateFin)}
            </b>
          </div>
          {days !== null && (
            <div className="info-row">
              <span>Jours restants</span>
              <b style={{color:days<0?"#c0392b":days<=ALERT_DAYS?"#8B6A4E":"#35B499"}}>
                {days<0?"Expiré":`${days} jour(s)`}
              </b>
            </div>
          )}
        </div>

        {/* Prochaine intervention */}
        {nextDate && sc !== "résilié" && sc !== "expiré" && (
          <div className="card" style={{borderLeft: daysToNext !== null && daysToNext <= RELANCE_ALERT_DAYS && daysToNext >= 0 ? "3px solid #8B6A4E" : "none"}}>
            <div className="card-title">Prochaine intervention estimée</div>
            <div className="info-row">
              <span>Date estimée</span>
              <b style={{color: daysToNext!==null&&daysToNext<=RELANCE_ALERT_DAYS&&daysToNext>=0?"#8B6A4E":"#35B499", fontSize:15}}>
                {fmtDate(nextDate)}
              </b>
            </div>
            {daysToNext !== null && (
              <div className="info-row">
                <span>Dans</span>
                <b style={{color:daysToNext<=RELANCE_ALERT_DAYS&&daysToNext>=0?"#8B6A4E":"var(--color-text-primary)"}}>
                  {daysToNext<=0?"Aujourd'hui ou dépassé":`${daysToNext} jour(s)`}
                </b>
              </div>
            )}
            {daysToNext !== null && daysToNext <= RELANCE_ALERT_DAYS && daysToNext >= 0 && (
              <p style={{fontSize:12,color:"#8B6A4E",marginTop:6,fontWeight:500}}>
                ⚠️ Intervention à planifier — pensez à contacter le client
              </p>
            )}
            <p style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:6,fontStyle:"italic"}}>
              Calculé depuis le dernier passage · intervalle {intervalMois} mois
            </p>
          </div>
        )}

        {/* Passages */}
        <div className="card">
          <div className="card-title">Passages effectués</div>
          <div style={{height:4,background:"var(--color-border-tertiary)",borderRadius:2,marginBottom:6}}>
            <div style={{height:4,background:"#35B499",borderRadius:2,width:pct+"%",transition:"width .3s"}}/>
          </div>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14}}>
            {(selected.passages||[]).length} / {selected.nbPassages} passages réalisés
          </p>
          {(selected.passages||[]).length===0 && (
            <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12,fontStyle:"italic"}}>Aucun passage enregistré.</p>
          )}
          {(selected.passages||[]).map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#35B499",flexShrink:0,display:"inline-block"}}/>
              <span style={{fontSize:13,flex:1}}>{fmtDate(p.date)}</span>
              {sc!=="résilié" && (
                <button onClick={()=>removePassage(i)} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontSize:12,padding:"2px 6px"}}>Supprimer</button>
              )}
            </div>
          ))}
          {sc!=="résilié" && (
            <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center"}}>
              <input type="date" value={newPassage} onChange={e=>setNewPassage(e.target.value)}
                style={{flex:1,padding:"8px 10px",fontSize:13,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}/>
              <button className="btn-primary" onClick={addPassage} disabled={!newPassage}>+ Ajouter</button>
            </div>
          )}
        </div>

        {/* Relances */}
        <div className="card">
          <div className="card-title">Relances client</div>
          <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14}}>
            Historique des contacts effectués pour planifier les passages.
          </p>
          {relances.length===0 && (
            <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12,fontStyle:"italic"}}>Aucune relance enregistrée.</p>
          )}
          {relances.map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:"#8B6A4E",flexShrink:0,display:"inline-block",marginTop:5}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>{fmtDate(r.date)}</div>
                {r.note && <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:2}}>{r.note}</div>}
              </div>
              <button onClick={()=>removeRelance(i)} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontSize:12,padding:"2px 6px",flexShrink:0}}>Supprimer</button>
            </div>
          ))}
          {sc!=="résilié" && (
            <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="date" value={newRelanceDate} onChange={e=>setNewRelanceDate(e.target.value)}
                  style={{flex:1,padding:"8px 10px",fontSize:13,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}/>
              </div>
              <input type="text" placeholder="Note (optionnel) — ex: Contact par téléphone, RDV pris pour le 12/05" value={newRelanceNote} onChange={e=>setNewRelanceNote(e.target.value)}
                style={{width:"100%",padding:"8px 10px",fontSize:13,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box"}}/>
              <button className="btn-outline" onClick={addRelance} disabled={!newRelanceDate} style={{width:"100%"}}>
                + Enregistrer une relance
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        {selected.notes && (
          <div className="card readonly">
            <div className="card-title">Notes internes</div>
            <p style={{fontSize:13,lineHeight:1.6}}>{selected.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8,marginBottom:12}}>
          <button className="btn-primary" style={{flex:1}} onClick={()=>generatePDF(selected)}>📄 Télécharger PDF</button>
          <button className="btn-outline" onClick={()=>{setForm({...selected});setIsEdit(true);setView("form");}}>Modifier</button>
        </div>
        {(sc==="à renouveler"||sc==="expiré") && (
          <button className="btn-finish" style={{width:"100%",marginBottom:28}} disabled={saving} onClick={()=>renouveler(selected)}>
            {saving?"Renouvellement…":"🔄 Renouveler le contrat (+1 an)"}
          </button>
        )}
      </div>
    );
  }

  // ── VUE LISTE ─────────────────────────────────────────────────────────────

  const counts = {
    tous:       contrats.length,
    actif:      contrats.filter(c=>c.sc==="actif").length,
    renouveler: contrats.filter(c=>c.sc==="à renouveler").length,
    expire:     contrats.filter(c=>c.sc==="expiré").length,
    resilie:    contrats.filter(c=>c.sc==="résilié").length,
    brouillon:  contrats.filter(c=>c.sc==="brouillon").length,
  };

  // Contrats avec prochaine intervention dans <= 15j
  const aRelancer = contrats.filter(c => {
    if (c.sc==="résilié"||c.sc==="expiré") return false;
    const d = getDaysTo(nextPassageDate(c));
    return d!==null && d>=0 && d<=RELANCE_ALERT_DAYS;
  }).length;

  // CA annuel total des contrats actifs
  const caAnnuel = contrats
    .filter(c=>c.sc==="actif"||c.sc==="à renouveler")
    .reduce((acc,c)=>acc+(parseFloat(c.montantTTC||0)*parseInt(c.nbPassages||0)),0);

  const FILTERS = [
    ["tous","Tous"],["actif","Actifs"],["renouveler","À renouveler"],
    ["expire","Expirés"],["resilie","Résiliés"],["brouillon","Brouillons"],
  ];

  const filtered = contrats.filter(c => {
    if (filter==="tous") return true;
    if (filter==="renouveler") return c.sc==="à renouveler";
    if (filter==="expire") return c.sc==="expiré";
    if (filter==="resilie") return c.sc==="résilié";
    return c.sc===filter;
  });

  // CSS tableau injecté (cohérence avec AdminDashboard)
  const TABLE_CSS = `
    .ctr-table-wrap{overflow-x:auto}
    .ctr-table{width:100%;border-collapse:collapse;font-size:12px}
    .ctr-table th{text-align:left;font-size:9.5px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.8px;padding:8px 14px;border-bottom:.5px solid #e8e5e0;white-space:nowrap;background:white}
    .ctr-table td{padding:10px 14px;border-bottom:.5px solid #f0ede8;color:var(--color-text-primary);vertical-align:middle}
    .ctr-table tr:last-child td{border-bottom:none}
    .ctr-table tr:hover td{background:#fafaf8;cursor:pointer}
    .ctr-ref{font-size:11px;color:#35B499;font-weight:600}
    .ctr-badge{font-size:10px;font-weight:500;padding:3px 9px;border-radius:20px;white-space:nowrap;display:inline-block}
    .ctr-badge.actif{background:#e1f5ee;color:#0e6b50}
    .ctr-badge.renouveler{background:#f5e8d8;color:#6b4a31}
    .ctr-badge.expire,.ctr-badge.resilie{background:#fde8e8;color:#9b2c2c}
    .ctr-badge.brouillon{background:#f0f0f0;color:#888}
    .ctr-prog{height:4px;background:#f0ede8;border-radius:2px;overflow:hidden;width:70px}
    .ctr-prog-fill{height:100%;border-radius:2px;background:#35B499}
    .ctr-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .ctr-kpi{background:white;border-radius:10px;padding:14px 16px;border:.5px solid #e0ddd8;position:relative;overflow:hidden;cursor:pointer}
    .ctr-kpi:hover{box-shadow:0 2px 12px rgba(0,0,0,.07)}
    .ctr-kpi-accent{position:absolute;top:0;left:0;right:0;height:3px}
    .ctr-kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;font-weight:500}
    .ctr-kpi-val{font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-1px;margin:0;line-height:1}
    .ctr-kpi-sub{font-size:10px;color:#888;margin:4px 0 0}
    .ctr-panel{background:white;border-radius:10px;border:.5px solid #e0ddd8;overflow:hidden}
    .ctr-panel-head{padding:12px 16px;border-bottom:.5px solid #e8e5e0;display:flex;align-items:center;gap:8px}
    .ctr-panel-title{font-size:12px;font-weight:600;color:#1a1a1a;margin:0}
    .ctr-panel-count{font-size:11px;color:#888;margin-left:auto}
  `;

  if (!document.getElementById("ctr-styles")) {
    const el = document.createElement("style");
    el.id = "ctr-styles"; el.textContent = TABLE_CSS;
    document.head.appendChild(el);
  }

  const badgeClass = (sc) => ({
    "actif":"actif","à renouveler":"renouveler","expiré":"expire","résilié":"resilie","brouillon":"brouillon"
  }[sc]||"brouillon");

  return (
    <div style={{padding:"22px 24px"}}>

      {/* KPI */}
      <div className="ctr-kpi-row">
        <div className="ctr-kpi" onClick={()=>setFilter("actif")}>
          <div className="ctr-kpi-accent" style={{background:"#35B499"}}/>
          <p className="ctr-kpi-label">Contrats actifs</p>
          <p className="ctr-kpi-val">{counts.actif}</p>
          <p className="ctr-kpi-sub" style={{color:"#1a7a65"}}>sur {counts.tous} au total</p>
        </div>
        <div className="ctr-kpi" onClick={()=>setFilter("renouveler")}>
          <div className="ctr-kpi-accent" style={{background:"#8B6A4E"}}/>
          <p className="ctr-kpi-label">À renouveler</p>
          <p className="ctr-kpi-val">{counts.renouveler}</p>
          <p className="ctr-kpi-sub" style={{color:counts.renouveler>0?"#8B6A4E":"#888"}}>
            {counts.renouveler>0?"Action requise":"Aucun"}
          </p>
        </div>
        <div className="ctr-kpi" onClick={()=>{}}>
          <div className="ctr-kpi-accent" style={{background:aRelancer>0?"#8B6A4E":"#35B499"}}/>
          <p className="ctr-kpi-label">Relances à faire</p>
          <p className="ctr-kpi-val">{aRelancer}</p>
          <p className="ctr-kpi-sub" style={{color:aRelancer>0?"#8B6A4E":"#888"}}>
            {aRelancer>0?"Passage à planifier":"À jour"}
          </p>
        </div>
        <div className="ctr-kpi" onClick={()=>{}}>
          <div className="ctr-kpi-accent" style={{background:"#35B499"}}/>
          <p className="ctr-kpi-label">CA annuel contrats</p>
          <p className="ctr-kpi-val" style={{fontSize:18}}>{caAnnuel.toFixed(0)} €</p>
          <p className="ctr-kpi-sub">TTC — contrats actifs</p>
        </div>
      </div>

      {/* Filtres + bouton */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        {FILTERS.map(([key,label])=>{
          const active=filter===key, cnt=counts[key];
          if(cnt===0&&key!=="tous"&&key!==filter) return null;
          return(
            <div key={key} onClick={()=>setFilter(key)}
              style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",border:".5px solid #e0ddd8",
                background:active?(key==="renouveler"?"#f5e8d8":key==="expire"||key==="resilie"?"#fde8e8":"#e1f5ee"):"#f5f5f2",
                color:active?(key==="renouveler"?"#6b4a31":key==="expire"||key==="resilie"?"#9b2c2c":"#0e6b50"):"#888"}}>
              {label} ({cnt})
            </div>
          );
        })}
        <button className="btn-primary" style={{marginLeft:"auto"}}
          onClick={()=>{setForm({...EMPTY_FORM,dateSignature:todayStr(),dateDebut:todayStr()});setIsEdit(false);setView("form");}}>
          + Nouveau contrat
        </button>
      </div>

      {/* Tableau */}
      <div className="ctr-panel">
        <div className="ctr-panel-head">
          <span className="ctr-panel-title">Contrats d'intervention</span>
          <span className="ctr-panel-count">{filtered.length} contrat{filtered.length!==1?"s":""}</span>
        </div>
        {filtered.length===0 ? (
          <div style={{padding:"24px",textAlign:"center",fontSize:13,color:"#aaa"}}>Aucun contrat dans cette catégorie.</div>
        ) : (
          <div className="ctr-table-wrap">
            <table className="ctr-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Prestations</th>
                  <th>Passages</th>
                  <th>Montant TTC/an</th>
                  <th>Prochaine intervention</th>
                  <th>Dernière relance</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c=>{
                  const next        = nextPassageDate(c);
                  const daysNext    = getDaysTo(next);
                  const daysContrat = getDaysTo(c.dateFin);
                  const alert       = daysNext!==null&&daysNext>=0&&daysNext<=RELANCE_ALERT_DAYS&&c.sc!=="résilié"&&c.sc!=="expiré";
                  const annuel      = c.montantTTC&&c.nbPassages?(parseFloat(c.montantTTC)*parseInt(c.nbPassages)).toFixed(2):null;
                  const pct         = c.nbPassages?Math.min(100,Math.round(((c.passages||[]).length/c.nbPassages)*100)):0;
                  const lastRelance = (c.relances||[]).length>0?[...(c.relances||[])].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
                  const sStyle      = statutStyle(c.sc);
                  return(
                    <tr key={c.id} onClick={()=>{setSelected(c);setView("detail");}}>
                      <td><span className="ctr-ref">{c.ref}</span></td>
                      <td>
                        <span style={{fontWeight:500,display:"block"}}>{c.clientNom}</span>
                        {c.clientResponsable&&<span style={{fontSize:10,color:"#888"}}>{c.clientResponsable}</span>}
                      </td>
                      <td style={{fontSize:11,color:"#555",maxWidth:140}}>
                        {(c.prestations||[]).join(", ")||"—"}
                      </td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div className="ctr-prog"><div className="ctr-prog-fill" style={{width:pct+"%"}}/></div>
                          <span style={{fontSize:11,color:"#888",whiteSpace:"nowrap"}}>{(c.passages||[]).length}/{c.nbPassages}</span>
                        </div>
                      </td>
                      <td style={{fontWeight:500,color:"#35B499",whiteSpace:"nowrap"}}>
                        {annuel?annuel+" €":"—"}
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>
                        {next?(
                          <span style={{color:alert?"#8B6A4E":"var(--color-text-primary)",fontWeight:alert?600:400}}>
                            {fmtDate(next)}
                            {alert&&<span style={{display:"block",fontSize:10,color:"#8B6A4E"}}>⚠ dans {daysNext}j</span>}
                          </span>
                        ):"—"}
                      </td>
                      <td style={{fontSize:11,color:"#888",maxWidth:160}}>
                        {lastRelance?(
                          <span>
                            {fmtDate(lastRelance.date)}
                            {lastRelance.note&&<span style={{display:"block",fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{lastRelance.note}</span>}
                          </span>
                        ):<span style={{color:"#ccc"}}>—</span>}
                      </td>
                      <td style={{fontSize:11,whiteSpace:"nowrap",color:daysContrat!==null&&daysContrat<=ALERT_DAYS&&daysContrat>=0?"#8B6A4E":daysContrat!==null&&daysContrat<0?"#c0392b":"#888"}}>
                        {fmtDate(c.dateFin)}
                        {daysContrat!==null&&daysContrat>=0&&daysContrat<=ALERT_DAYS&&<span style={{display:"block",fontSize:10}}>dans {daysContrat}j</span>}
                        {daysContrat!==null&&daysContrat<0&&<span style={{display:"block",fontSize:10}}>expiré</span>}
                      </td>
                      <td>
                        <span className={`ctr-badge ${badgeClass(c.sc)}`}>{c.sc}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
