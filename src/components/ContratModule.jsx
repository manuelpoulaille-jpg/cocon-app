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
  // Parser en local (pas UTC) pour eviter le decalage Martinique UTC-4
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y + 1, m - 1, d);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDaysTo(dateStr) {
  if (!dateStr) return null;
  // Forcer parsing local avec T00:00:00 pour eviter decalage UTC Martinique
  const diff = new Date(dateStr + "T00:00:00") - new Date();
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
  // On retourne la VRAIE prochaine echeance meme si elle est depassee
  // pour alerter le retard — pas de saut automatique
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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
  const teal = [53, 180, 153];
  const dark = [30, 30, 30];
  const gray = [100, 100, 100];

  const setDark = () => { pdf.setTextColor(...dark); pdf.setFont("helvetica","normal"); pdf.setFontSize(10); };
  const setBold = () => { pdf.setTextColor(...dark); pdf.setFont("helvetica","bold"); pdf.setFontSize(10); };
  const setGray = () => { pdf.setTextColor(...gray); pdf.setFont("helvetica","normal"); pdf.setFontSize(9); };

  // ── EN-TÊTE ────────────────────────────────────────────────────────────────
  try { pdf.addImage(logoBase64, "PNG", ml, 6, 26, 20); } catch(e) {}

  pdf.setFontSize(14); setBold();
  pdf.setTextColor(...teal);
  pdf.text("Contrat dératisation / désinsectisation", W / 2, 14, { align: "center" });
  pdf.setFontSize(9); pdf.setFont("helvetica","italic"); pdf.setTextColor(...gray);
  pdf.text("La maison protégée – Solutions antiparasitaires", W / 2, 20, { align: "center" });

  pdf.setDrawColor(...teal); pdf.setLineWidth(0.5);
  pdf.line(ml, 24, mr, 24);

  // ── TABLEAU PARTIES ────────────────────────────────────────────────────────
  let y = 28;
  const hw = (cw / 2) - 2;
  const colR = ml + hw + 4;

  // Fond entêtes
  pdf.setFillColor(...teal);
  pdf.rect(ml, y, hw, 7, "F");
  pdf.rect(colR, y, hw, 7, "F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
  pdf.text("Le Prestataire", ml + hw/2, y + 5, { align:"center" });
  pdf.text("Le Client", colR + hw/2, y + 5, { align:"center" });
  y += 7;

  const prestRows = [
    ["Raison sociale :", "Cocon Plus SARL"],
    ["Adresse :", "Berges de Kerlys, 97200 Fort-de-France"],
    ["SIRET :", "47756829900028"],
    ["Représenté par :", COCON_INFO.representant],
    ["Téléphone :", "0596 73 66 66 / 06 96 69 48 00"],
    ["Email :", COCON_INFO.email],
  ];
  const clientRows = [
    ["Nom et Prénom :", c.clientNom + (c.clientResponsable ? " — " + c.clientResponsable : "")],
    ["Adresse :", c.clientAdresse || "—"],
    ["SIRET :", ""],
    ["Représenté par :", c.clientResponsable || ""],
    ["Téléphone :", c.clientTel || "—"],
    ["Email :", c.clientEmail || "—"],
  ];
  const rowH = 8;
  prestRows.forEach((r, i) => {
    const ry = y + i * rowH;
    pdf.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255);
    pdf.rect(ml, ry, hw, rowH, "F");
    pdf.rect(colR, ry, hw, rowH, "F");
    pdf.setDrawColor(220,220,220); pdf.setLineWidth(0.3);
    pdf.line(ml, ry + rowH, ml + hw, ry + rowH);
    pdf.line(colR, ry + rowH, colR + hw, ry + rowH);
    pdf.setFontSize(8);
    pdf.setFont("helvetica","bold"); pdf.setTextColor(...dark);
    pdf.text(r[0], ml + 2, ry + 5.5);
    pdf.setFont("helvetica","normal");
    pdf.text(pdf.splitTextToSize(r[1], hw - 28)[0] || "", ml + 30, ry + 5.5);
    pdf.setFont("helvetica","bold");
    pdf.text(clientRows[i][0], colR + 2, ry + 5.5);
    pdf.setFont("helvetica","normal");
    pdf.text(pdf.splitTextToSize(clientRows[i][1], hw - 30)[0] || "", colR + 30, ry + 5.5);
  });
  y += prestRows.length * rowH;

  // Ligne "Ci-après désigné"
  pdf.setFillColor(...teal);
  pdf.rect(ml, y, hw, 6, "F"); pdf.rect(colR, y, hw, 6, "F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(7.5); pdf.setFont("helvetica","italic");
  pdf.text('Ci-après désigné "Le Prestataire"', ml + hw/2, y + 4, { align:"center" });
  pdf.text('Ci-après désigné "Le Client"', colR + hw/2, y + 4, { align:"center" });
  y += 6;

  pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.3);
  pdf.rect(ml, 28, cw, y - 28);
  pdf.line(ml + hw + 2, 28, ml + hw + 2, y);

  y += 5;
  pdf.setFontSize(10); setBold(); pdf.setTextColor(...dark);
  pdf.text("Il a été arrêté et convenu ce qui suit :", ml, y);
  y += 7;

  // ── ARTICLES ───────────────────────────────────────────────────────────────

  const articleHeader = (num, title) => {
    if (y > 255) { pdf.addPage(); y = 15; }
    pdf.setFillColor(240, 250, 247);
    pdf.rect(ml, y, cw, 7, "F");
    pdf.setDrawColor(...teal); pdf.setLineWidth(0.5);
    pdf.rect(ml, y, cw, 7);
    pdf.setTextColor(...teal); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
    pdf.text(`Article ${num} : ${title}`, ml + 3, y + 5);
    y += 10;
    setDark();
  };

  const writeLine = (text, indent = 0) => {
    if (y > 268) { pdf.addPage(); y = 15; }
    const lines = pdf.splitTextToSize(text, cw - indent - 2);
    lines.forEach(l => {
      if (y > 268) { pdf.addPage(); y = 15; }
      pdf.text(l, ml + indent, y);
      y += 5;
    });
  };

  const writeBold = (label, value) => {
    if (y > 268) { pdf.addPage(); y = 15; }
    pdf.setFont("helvetica","bold"); pdf.setFontSize(9);
    pdf.text(label, ml, y);
    pdf.setFont("helvetica","normal");
    const lw = pdf.getTextWidth(label);
    pdf.text(value, ml + lw + 1, y);
    y += 5;
  };

  const checkbox = (checked, text) => {
    if (y > 268) { pdf.addPage(); y = 15; }
    pdf.setDrawColor(...dark); pdf.setLineWidth(0.3);
    pdf.rect(ml, y - 3.5, 4, 4);
    if (checked) {
      pdf.setFont("helvetica","bold"); pdf.setFontSize(9); pdf.setTextColor(...teal);
      pdf.text("✓", ml + 0.5, y);
    }
    setDark(); pdf.setFontSize(9);
    pdf.text(text, ml + 7, y);
    y += 5.5;
  };

  const prestations = c.prestations || [];
  const nb = parseInt(c.nbPassages) || 4;
  const mHT = parseFloat(c.montantHT) || 0;
  const mTTC = parseFloat(c.montantTTC) || 0;
  const annuelHT = (mHT * nb).toFixed(2);
  const annuelTTC = (mTTC * nb).toFixed(2);
  const intervalMois = Math.round(12 / nb);
  const preavis = parseInt(c.preavis) || 1;
  const frais = parseFloat(c.fraisDeplacement) || 30;
  const lieuIntervention = c.adresseIntervention || c.clientAdresse || "—";

  // ART 1
  articleHeader("1", "Descriptif de la prestation");
  pdf.setFontSize(9); setDark();
  checkbox(prestations.includes("Désinsectisation"), "Désinsectisation");
  checkbox(prestations.includes("Dératisation"), "Dératisation");
  checkbox(prestations.includes("HACCP"), "Dératisation et/ou désinsectisation conforme HACCP pour les zones alimentaires");
  checkbox(prestations.includes("Désinfection"), "Désinfection");
  y += 2;
  writeLine("Sur les lieux suivants :");
  writeLine(`•  ${lieuIntervention}`, 4);
  y += 2;
  setBold(); pdf.setFontSize(9);
  writeLine("Nature de l'intervention :");
  setDark(); pdf.setFontSize(9);
  writeLine("Le prestataire interviendra pour l'élimination et le contrôle des nuisibles présents dans les locaux désignés, conformément aux réglementations en vigueur. Le traitement vise à assurer l'éradication complète des nuisibles et à prévenir toute réinfestation.");
  y += 3;

  // ART 2
  articleHeader("2", "Modalités de rémunération");
  pdf.setFontSize(9); setDark();
  writeLine(`Le client s'engage à verser une rémunération au Prestataire d'un montant de ${annuelHT} € HT (soit ${annuelTTC} € TTC) pour les ${nb} passages annuels.`);
  y += 3;

  // ART 3
  articleHeader("3", "Fréquence et durée d'engagement");
  pdf.setFontSize(9); setDark();
  writeLine(`Nombre de passages annuels pour le traitement : ${nb} (tous les ${intervalMois} mois)`);
  y += 2;
  writeBold("Durée d'engagement : ", "1 an à compter de la date de la première intervention.");
  y += 1;
  writeLine("Le contrat est renouvelable par tacite reconduction, sauf dénonciation par l'une des parties dans les conditions prévues à l'article 5.");
  y += 3;

  // ART 4
  articleHeader("4", "Engagements et obligations du client");
  pdf.setFontSize(9); setDark();
  writeLine("Le client s'engage à :");
  [
    "Laisser au prestataire et à son personnel libre accès aux locaux, et particulièrement à ceux nommément désignés, chaque fois que cela sera nécessaire pour la réalisation des interventions.",
    "Ne pas faire usage d'autres produits ou autres procédés pendant la durée du contrat qui pourraient être nuisibles à l'efficacité des interventions.",
    "Ne pas déplacer les postes d'appâtage ou autre dispositif.",
    "Respecter les consignes et prescriptions de nos intervenants.",
  ].forEach(b => writeLine(`•  ${b}`, 4));
  y += 2;
  setBold(); pdf.setFontSize(9); writeLine("Précautions à prendre :");
  setDark(); pdf.setFontSize(9);
  writeLine("Nous utilisons des produits chimiques. Les enfants, animaux et végétaux doivent impérativement rester à l'écart des locaux traités pendant toute la durée des traitements. Le client s'engage à veiller à cette obligation, et d'en informer son entourage, son personnel et sa clientèle.");
  y += 2;
  setBold(); pdf.setFontSize(9); writeLine("Dommages causés par les nuisibles :");
  setDark(); pdf.setFontSize(9);
  writeLine("Le prestataire décline toute responsabilité pour les dommages causés par les rongeurs et les insectes aux installations, machines, matériels et marchandises. Il en est de même pour tout dommage direct ou indirect causé par les rongeurs et insectes aux personnes ou animaux.");
  y += 3;

  // ART 5
  articleHeader("5", "Durée de validité du contrat");
  pdf.setFontSize(9); setDark();
  writeLine("Le contrat est conclu pour une durée déterminée de 1 an.");
  writeLine("La validité du contrat commence dès la signature du présent contrat et se termine à la fin des prestations convenues entre les parties.");
  writeLine(`Chacune des parties peut y mettre fin avec un préavis de ${preavis} mois.`);
  writeLine("La durée du contrat peut être élargie par un consensus écrit des deux parties.");
  y += 3;

  // ART 6
  articleHeader("6", "Obligation de délivrance");
  pdf.setFontSize(9); setDark();
  writeLine("Les délais de l'intervention ne sont donnés qu'à titre indicatif ; ils ne constituent aucun engagement de notre part.");
  writeLine(`Dans le cas d'un rendez-vous, si l'intervention n'a pas été effectuée en raison d'un empêchement de la part du client, le déplacement sera facturé : ${frais.toFixed(2)} €.`);
  y += 3;

  // ART 7
  articleHeader("7", "Rupture du contrat");
  pdf.setFontSize(9); setDark();
  writeLine("Pour tout manquement des obligations par l'une des parties, l'autre partie pourra invoquer son droit de résiliation du contrat à tacite reconduction dans le cas où la mise en demeure persiste au-delà d'un mois.");
  y += 3;

  // ART 8
  articleHeader("8", "Loi applicable");
  pdf.setFontSize(9); setDark();
  writeLine("Le présent contrat est soumis aux lois françaises. En l'absence de la bonne exécution du contrat, ce dernier sera soumis par les tribunaux compétents de Fort-de-France, soumis au droit français.");
  y += 3;

  // ART 9
  articleHeader("9", "Modifications du contrat");
  pdf.setFontSize(9); setDark();
  writeLine("Chaque modification du contrat fera l'objet d'une signature entre chaque Partie ou leurs représentants autorisés.");
  y += 6;

  // ── SIGNATURES ─────────────────────────────────────────────────────────────
  if (y > 230) { pdf.addPage(); y = 15; }

  const [jj, mm2, aaaa] = (c.dateSignature || todayStr()).split("-").reverse();
  const dateFr = `${jj} / ${mm2} / ${aaaa}`;
  pdf.setFontSize(10); setBold();
  pdf.text(`Fait le ${dateFr} en deux exemplaires à Fort-de-France`, W / 2, y, { align:"center" });
  y += 8;

  // Tableau signatures
  const sigHW = (cw / 2) - 2;
  pdf.setFillColor(...teal); pdf.rect(ml, y, sigHW, 7, "F");
  pdf.rect(colR, y, sigHW, 7, "F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(9); pdf.setFont("helvetica","bold");
  pdf.text("Le Prestataire", ml + sigHW/2, y + 5, { align:"center" });
  pdf.text("Le Client", colR + sigHW/2, y + 5, { align:"center" });
  y += 7;
  pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.3);
  pdf.rect(ml, y, sigHW, 32); pdf.rect(colR, y, sigHW, 32);
  setGray(); pdf.setFontSize(8);
  pdf.text("Signature :", ml + 3, y + 8);
  pdf.text("Nom : " + COCON_INFO.representant, ml + 3, y + 20);
  pdf.text("Signature :", colR + 3, y + 8);
  pdf.text("Nom : " + (c.clientNom || ""), colR + 3, y + 20);
  y += 36;

  // Footer
  pdf.setFontSize(7.5); pdf.setFont("helvetica","italic"); pdf.setTextColor(...gray);
  pdf.text("Paraphez chaque page du contrat", W / 2, y, { align:"center" });

  // Pied de page sur toutes les pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7); pdf.setFont("helvetica","normal"); pdf.setTextColor(...gray);
    pdf.text(
      `${COCON_INFO.nom} — ${COCON_INFO.adresse} — SIRET : ${COCON_INFO.siret} — ${COCON_INFO.tel} — ${COCON_INFO.web}`,
      W / 2, 292, { align: "center" }
    );
    pdf.text(`Page ${i} / ${totalPages}`, mr, 292, { align: "right" });
  }

  pdf.save(`contrat-${c.ref}-${(c.clientNom||"").replace(/\s+/g,"-")}.pdf`);
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

  useEffect(() => {
    fetchContrats();
    if (!document.getElementById("ctr-styles")) {
      const el = document.createElement("style");
      el.id = "ctr-styles"; el.textContent = TABLE_CSS;
      document.head.appendChild(el);
    }
  }, []);

  // ── FIRESTORE ─────────────────────────────────────────────────────────────

  const fetchContrats = async (currentSel) => {
    const snap = await getDocs(collection(db, "contrats"));
    const all = snap.docs
      .map(d => {
        const data = { id: d.id, ...d.data() };
        data.passages = data.passages || [];
        data.relances = data.relances || [];
        return { ...data, sc: computeStatut(data) };
      })
      .sort((a, b) => {
        const order = { "à renouveler": 0, "expiré": 1, "brouillon": 2, "actif": 3, "résilié": 4 };
        return (order[a.sc] ?? 5) - (order[b.sc] ?? 5);
      });
    setContrats(all);
    // Resync selected depuis Firestore pour rafraichir date + relances + KPI
    const sel = currentSel || null;
    if (sel) {
      const fresh = all.find(c => c.id === sel.id);
      if (fresh) setSelected(fresh);
    }
    return all;
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
    fetchContrats(refreshed);
  };

  const removePassage = async (idx) => {
    const updated = (selected.passages || []).filter((_, i) => i !== idx);
    await updateDoc(doc(db, "contrats", selected.id), { passages: updated });
    const refreshed = { ...selected, passages: updated };
    setSelected({ ...refreshed, sc: computeStatut(refreshed) });
    fetchContrats(refreshed);
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
    fetchContrats(refreshed);
  };

  const removeRelance = async (idx) => {
    const updated = (selected.relances || []).filter((_, i) => i !== idx);
    await updateDoc(doc(db, "contrats", selected.id), { relances: updated });
    const refreshed = { ...selected, relances: updated };
    setSelected({ ...refreshed, sc: computeStatut(refreshed) });
    fetchContrats(refreshed);
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
          <div className="card" style={{
            borderLeft: daysToNext !== null && daysToNext < 0
              ? "3px solid #c0392b"
              : daysToNext !== null && daysToNext <= RELANCE_ALERT_DAYS
              ? "3px solid #8B6A4E"
              : "none"
          }}>
            <div className="card-title">Prochaine intervention estimée</div>
            <div className="info-row">
              <span>Date estimée</span>
              <b style={{color: daysToNext!==null&&daysToNext<0?"#c0392b":daysToNext!==null&&daysToNext<=RELANCE_ALERT_DAYS?"#8B6A4E":"#35B499", fontSize:15}}>
                {fmtDate(nextDate)}
              </b>
            </div>
            {daysToNext !== null && (
              <div className="info-row">
                <span>Statut</span>
                <b style={{color:daysToNext<0?"#c0392b":daysToNext<=RELANCE_ALERT_DAYS?"#8B6A4E":"#35B499"}}>
                  {daysToNext < 0
                    ? `⚠️ En retard de ${Math.abs(daysToNext)} jour(s)`
                    : daysToNext === 0
                    ? "Aujourd'hui"
                    : `Dans ${daysToNext} jour(s)`}
                </b>
              </div>
            )}
            {daysToNext !== null && daysToNext < 0 && (
              <p style={{fontSize:12,color:"#c0392b",marginTop:6,fontWeight:500}}>
                🔴 Passage en retard — à planifier et relancer le client
              </p>
            )}
            {daysToNext !== null && daysToNext >= 0 && daysToNext <= RELANCE_ALERT_DAYS && (
              <p style={{fontSize:12,color:"#8B6A4E",marginTop:6,fontWeight:500}}>
                ⚠️ Intervention imminente — pensez à contacter le client
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
    // En retard (d < 0) OU dans les RELANCE_ALERT_DAYS prochains jours
    return d!==null && d<=RELANCE_ALERT_DAYS;
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
                  const alert       = daysNext!==null&&(daysNext<0||(daysNext<=RELANCE_ALERT_DAYS&&c.sc!=="résilié"&&c.sc!=="expiré"));
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
                          <span style={{color:daysNext!==null&&daysNext<0?"#c0392b":alert?"#8B6A4E":"var(--color-text-primary)",fontWeight:daysNext!==null&&(daysNext<0||alert)?600:400}}>
                            {fmtDate(next)}
                            {daysNext!==null&&daysNext<0&&<span style={{display:"block",fontSize:10,color:"#c0392b"}}>🔴 retard {Math.abs(daysNext)}j</span>}
                            {daysNext!==null&&daysNext>=0&&alert&&<span style={{display:"block",fontSize:10,color:"#8B6A4E"}}>⚠ dans {daysNext}j</span>}
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
