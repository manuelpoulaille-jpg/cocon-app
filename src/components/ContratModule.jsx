import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
} from "firebase/firestore";
import logoBase64 from "../logoBase64";

// ── CONSTANTES ──────────────────────────────────────────────────────────────

const ALERT_DAYS = 20;

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
  "Désinsectisation",
  "Dératisation",
  "Désinfection",
  "HACCP",
  "Traitement anti-termites",
  "Traitement anti-chauves-souris",
  "Étanchéité de toiture",
];

const EMPTY_FORM = {
  clientNom: "",
  clientResponsable: "",
  clientAdresse: "",
  clientTel: "",
  clientEmail: "",
  adresseIntervention: "",
  prestations: [],
  nbPassages: 4,
  montantHT: "",
  montantTTC: "",
  fraisDeplacement: 30,
  preavis: 1,
  dateSignature: "",
  dateDebut: "",
  statut: "actif",
  notes: "",
};

// ── HELPERS ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });
}

function addOneYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("fr-CA");
}

function getDaysToExpiry(dateFin) {
  if (!dateFin) return null;
  const diff = new Date(dateFin) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function computeStatut(c) {
  if (c.statut === "résilié" || c.statut === "brouillon") return c.statut;
  const days = getDaysToExpiry(c.dateFin);
  if (days === null) return c.statut || "actif";
  if (days < 0) return "expiré";
  if (days <= ALERT_DAYS) return "à renouveler";
  return "actif";
}

function statutStyle(s) {
  return {
    "actif":         { bg: "#e1f5ee", color: "#0e6b50" },
    "à renouveler":  { bg: "#f5e8d8", color: "#6b4a31" },
    "expiré":        { bg: "#fde8e8", color: "#9b2c2c" },
    "résilié":       { bg: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
    "brouillon":     { bg: "#f0f0f0", color: "#888" },
  }[s] || { bg: "#eee", color: "#333" };
}

// ── PDF ──────────────────────────────────────────────────────────────────────

async function generatePDF(c) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, ml = 15, mr = 195, cw = 180;
  const teal = [53, 180, 153];
  const dark = [30, 30, 30];
  const gray = [110, 110, 110];
  const lightBg = [243, 243, 243];

  // ── EN-TÊTE
  pdf.setFillColor(...teal);
  pdf.rect(0, 0, W, 30, "F");
  try { pdf.addImage(logoBase64, "PNG", ml, 4, 28, 22); } catch (e) {}
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(15); pdf.setFont("helvetica", "bold");
  pdf.text("CONTRAT DE PRESTATION DE SERVICES", 50, 13);
  pdf.setFontSize(8.5); pdf.setFont("helvetica", "normal");
  pdf.text("Lutte antiparasitaire & Protection du bâtiment", 50, 20);
  pdf.text(`Réf. ${c.ref}  |  Signé le ${fmtDate(c.dateSignature)}`, 50, 26);

  let y = 38;

  // ── PARTIES
  const hw = (cw - 8) / 2;
  const drawParty = (x, title, lines) => {
    pdf.setFillColor(...lightBg);
    pdf.rect(x, y, hw, 40, "F");
    pdf.setTextColor(...teal); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
    pdf.text(title, x + 4, y + 6);
    pdf.setTextColor(...dark); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
    lines.forEach((l, i) => { if (l) pdf.text(l, x + 4, y + 13 + i * 5); });
  };

  drawParty(ml, "LE PRESTATAIRE", [
    COCON_INFO.nom,
    COCON_INFO.adresse,
    `SIRET : ${COCON_INFO.siret}`,
    `Tél : ${COCON_INFO.tel}`,
    `Représenté par : ${COCON_INFO.representant}`,
  ]);

  drawParty(ml + hw + 8, "LE CLIENT", [
    c.clientNom,
    c.clientResponsable ? `Représenté par : ${c.clientResponsable}` : "",
    c.clientAdresse,
    c.clientTel ? `Tél : ${c.clientTel}` : "",
    c.clientEmail || "",
  ].filter(Boolean));

  y += 46;

  if (c.adresseIntervention && c.adresseIntervention !== c.clientAdresse) {
    pdf.setFillColor(230, 248, 242);
    pdf.rect(ml, y, cw, 10, "F");
    pdf.setTextColor(...gray); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
    pdf.text("LIEU D'INTERVENTION : ", ml + 4, y + 6);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(...dark);
    pdf.text(c.adresseIntervention, ml + 46, y + 6);
    y += 15;
  }

  // ── ARTICLES
  const article = (num, title, body) => {
    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFillColor(...teal);
    pdf.rect(ml, y, cw, 7, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
    pdf.text(`ARTICLE ${num} — ${title.toUpperCase()}`, ml + 4, y + 5);
    y += 10;
    pdf.setTextColor(...dark); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(body, cw - 4);
    lines.forEach(line => {
      if (y > 272) { pdf.addPage(); y = 20; }
      pdf.text(line, ml + 2, y);
      y += 5;
    });
    y += 4;
  };

  const prestStr = (c.prestations || []).join(", ") || "—";
  const mTTC = parseFloat(c.montantTTC) || 0;
  const mHT  = parseFloat(c.montantHT) || 0;
  const nb   = parseInt(c.nbPassages) || 4;
  const frais = parseFloat(c.fraisDeplacement) || 0;
  const preavis = parseInt(c.preavis) || 1;
  const annuel = (mTTC * nb).toFixed(2);

  article("1", "Descriptif de la prestation",
    `Le prestataire s'engage à réaliser les prestations suivantes au profit du client :\n${prestStr}.\n\nCes interventions comprennent la fourniture des produits homologués, du matériel et de la main-d'œuvre nécessaires à la bonne exécution des travaux. Toutes les prestations sont réalisées dans le strict respect de la réglementation en vigueur en matière de protection de l'environnement et de la santé publique.`
  );

  article("2", "Modalités de rémunération",
    `En contrepartie des prestations réalisées, le client s'engage à régler la somme de ${mTTC.toFixed(2)} € TTC (${mHT.toFixed(2)} € HT) par passage, soit un montant annuel de ${annuel} € TTC pour ${nb} passage(s).\n\nLe règlement sera effectué à réception de facture. En cas d'absence du client ou de son représentant lors d'une intervention planifiée et dûment confirmée, des frais de déplacement de ${frais} € seront facturés.`
  );

  article("3", "Fréquence et durée d'engagement",
    `Les interventions seront réalisées à raison de ${nb} passage(s) par an, selon un calendrier convenu d'un commun accord entre les parties.\n\nLe présent contrat est conclu pour une durée d'un (1) an à compter du ${fmtDate(c.dateDebut)}, soit jusqu'au ${fmtDate(c.dateFin)}. À l'issue de cette période, le contrat sera reconduit par tacite reconduction pour une durée identique, sauf dénonciation par l'une des parties dans le respect du préavis stipulé à l'article 7.`
  );

  article("4", "Engagements et obligations du client",
    `Le client s'engage à :\n- Permettre l'accès aux locaux aux techniciens du prestataire aux dates convenues ;\n- Respecter les consignes d'utilisation et de sécurité données après chaque intervention ;\n- Informer le prestataire de tout changement susceptible d'affecter la réalisation des prestations ;\n- Régler les sommes dues dans les délais impartis.`
  );

  article("5", "Durée de validité du contrat",
    `Le présent contrat prend effet à compter de la date de signature et est valable pour une durée d'un (1) an. Il est renouvelable par accord exprès des parties ou par tacite reconduction dans les conditions prévues à l'article 3.`
  );

  article("6", "Obligation de délivrance",
    `Le prestataire s'engage à réaliser les prestations décrites à l'article 1 avec tout le soin et le professionnalisme requis. Un bon d'intervention signé sera remis au client à l'issue de chaque passage, récapitulant les travaux effectués et les produits utilisés.`
  );

  article("7", "Rupture du contrat",
    `Chacune des parties peut mettre fin au présent contrat moyennant un préavis de ${preavis} mois, notifié par lettre recommandée avec accusé de réception. En cas de non-respect des obligations contractuelles par l'une des parties, le contrat pourra être résilié de plein droit après mise en demeure restée infructueuse pendant quinze (15) jours.`
  );

  article("8", "Loi applicable",
    `Le présent contrat est soumis au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut d'accord, tout différend sera porté devant les tribunaux compétents de Fort-de-France, Martinique.`
  );

  article("9", "Modifications du contrat",
    `Toute modification du présent contrat devra faire l'objet d'un avenant écrit, daté et signé par les deux parties. Aucune modification verbale ou tacite ne saurait être opposable.`
  );

  // ── SIGNATURES
  if (y > 235) { pdf.addPage(); y = 20; }
  y += 4;
  pdf.setFillColor(...teal);
  pdf.rect(ml, y, cw, 7, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
  pdf.text("SIGNATURES", ml + 4, y + 5);
  y += 12;
  pdf.setTextColor(...dark); pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  pdf.text(`Fait à Fort-de-France, le ${fmtDate(c.dateSignature)}`, ml, y);
  y += 10;
  pdf.text("Le Prestataire", ml + 4, y);
  pdf.text("Le Client", ml + 100, y);
  y += 4;
  pdf.setFontSize(8); pdf.setTextColor(...gray);
  pdf.text(COCON_INFO.nom, ml + 4, y);
  const clientSig = c.clientNom + (c.clientResponsable ? ` — ${c.clientResponsable}` : "");
  pdf.text(clientSig, ml + 100, y);
  y += 4;
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(ml, y, 82, 28);
  pdf.rect(ml + 98, y, 82, 28);

  // ── PIED DE PAGE
  pdf.setFontSize(7); pdf.setTextColor(...gray);
  pdf.text(
    `${COCON_INFO.nom} — ${COCON_INFO.adresse} — SIRET : ${COCON_INFO.siret} — ${COCON_INFO.tel} — ${COCON_INFO.web}`,
    W / 2, 288, { align: "center" }
  );

  pdf.save(`contrat-${c.ref}-${c.clientNom.replace(/\s+/g, "-")}.pdf`);
}

function fmtDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

// ── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function ContratModule() {
  const [view, setView]       = useState("list");   // "list" | "form" | "detail"
  const [contrats, setContrats] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]   = useState("tous");
  const [form, setForm]       = useState({ ...EMPTY_FORM });
  const [isEdit, setIsEdit]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [newPassage, setNewPassage] = useState("");

  useEffect(() => { fetchContrats(); }, []);

  // ── FIRESTORE ──────────────────────────────────────────────────────────────

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
      dateFin: addOneYear(form.dateDebut),
      montantHT:        parseFloat(form.montantHT)       || 0,
      montantTTC:       parseFloat(form.montantTTC)      || 0,
      fraisDeplacement: parseFloat(form.fraisDeplacement)|| 0,
      nbPassages:       parseInt(form.nbPassages)        || 4,
      preavis:          parseInt(form.preavis)           || 1,
    };
    delete payload.sc;
    if (isEdit && form.id) {
      await updateDoc(doc(db, "contrats", form.id), payload);
    } else {
      payload.ref         = nextRef(contrats);
      payload.dateCreation = Timestamp.now();
      payload.passages    = [];
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

  const renouveler = async (c) => {
    setSaving(true);
    const payload = {
      clientNom:          c.clientNom,
      clientResponsable:  c.clientResponsable || "",
      clientAdresse:      c.clientAdresse,
      clientTel:          c.clientTel || "",
      clientEmail:        c.clientEmail || "",
      adresseIntervention:c.adresseIntervention || "",
      prestations:        c.prestations || [],
      nbPassages:         c.nbPassages,
      montantHT:          c.montantHT,
      montantTTC:         c.montantTTC,
      fraisDeplacement:   c.fraisDeplacement,
      preavis:            c.preavis,
      dateSignature:      todayStr(),
      dateDebut:          c.dateFin,
      dateFin:            addOneYear(c.dateFin),
      statut:             "actif",
      notes:              `Renouvellement de ${c.ref}`,
      passages:           [],
      dateCreation:       Timestamp.now(),
      ref:                nextRef(contrats),
    };
    await addDoc(collection(db, "contrats"), payload);
    await updateDoc(doc(db, "contrats", c.id), { statut: "expiré" });
    await fetchContrats();
    setSaving(false);
    setView("list");
  };

  // ── FORM VIEW ──────────────────────────────────────────────────────────────

  if (view === "form") {
    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
          <h2>{isEdit ? `Modifier ${form.ref}` : "Nouveau contrat"}</h2>
        </div>

        {/* Client */}
        <div className="card">
          <div className="card-title">Client</div>
          {[
            ["clientNom",           "Nom / Raison sociale *"],
            ["clientResponsable",   "Responsable (si société)"],
            ["clientAdresse",       "Adresse du siège *"],
            ["clientTel",           "Téléphone"],
            ["clientEmail",         "Email"],
            ["adresseIntervention", "Adresse d'intervention (si différente du siège)"],
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                type="text"
                value={form[key] || ""}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Prestation */}
        <div className="card">
          <div className="card-title">Prestation</div>
          <div className="field">
            <label>Types de prestation</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {PRESTATION_OPTIONS.map(p => {
                const active = (form.prestations || []).includes(p);
                return (
                  <div
                    key={p}
                    onClick={() => set("prestations", active
                      ? form.prestations.filter(x => x !== p)
                      : [...(form.prestations || []), p]
                    )}
                    style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                      background: active ? "#35B499" : "transparent",
                      color: active ? "white" : "var(--color-text-secondary)",
                      border: active ? "none" : "0.5px solid var(--color-border-secondary)",
                    }}
                  >
                    {p}
                  </div>
                );
              })}
            </div>
          </div>
          {[
            ["nbPassages",       "Passages par an",                   "number"],
            ["montantHT",        "Montant par passage HT (€)",        "number"],
            ["montantTTC",       "Montant par passage TTC (€)",       "number"],
            ["fraisDeplacement", "Frais déplacement si absent (€)",   "number"],
            ["preavis",          "Préavis de résiliation (mois)",      "number"],
          ].map(([key, label, type]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                type={type}
                value={form[key] ?? ""}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
          {form.montantTTC && form.nbPassages && (
            <p style={{ fontSize: 12, color: "#35B499", marginTop: 4 }}>
              Total annuel TTC : {(parseFloat(form.montantTTC) * parseInt(form.nbPassages)).toFixed(2)} €
            </p>
          )}
        </div>

        {/* Dates & statut */}
        <div className="card">
          <div className="card-title">Dates & statut</div>
          <div className="field">
            <label>Date de signature</label>
            <input type="date" value={form.dateSignature || ""} onChange={e => set("dateSignature", e.target.value)} />
          </div>
          <div className="field">
            <label>Date de début</label>
            <input type="date" value={form.dateDebut || ""} onChange={e => set("dateDebut", e.target.value)} />
          </div>
          {form.dateDebut && (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
              Fin automatique : {fmtDate(addOneYear(form.dateDebut))}
            </p>
          )}
          <div className="field">
            <label>Statut</label>
            <select value={form.statut} onChange={e => set("statut", e.target.value)}>
              <option value="actif">Actif</option>
              <option value="expiré">Expiré (contrat historique)</option>
              <option value="résilié">Résilié</option>
              <option value="brouillon">Brouillon</option>
            </select>
          </div>
          <div className="field">
            <label>Notes internes</label>
            <textarea
              value={form.notes || ""}
              onChange={e => set("notes", e.target.value)}
              placeholder="Contexte, historique, observations…"
            />
          </div>
        </div>

        <button
          className="btn-finish"
          style={{ width: "100%", marginBottom: 24 }}
          disabled={saving || !form.clientNom}
          onClick={saveContrat}
        >
          {saving ? "Enregistrement…" : isEdit ? "Mettre à jour le contrat" : "Créer le contrat"}
        </button>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────

  if (view === "detail" && selected) {
    const sc   = selected.sc || computeStatut(selected);
    const days = getDaysToExpiry(selected.dateFin);
    const pct  = selected.nbPassages
      ? Math.min(100, Math.round(((selected.passages || []).length / selected.nbPassages) * 100))
      : 0;
    const sStyle = statutStyle(sc);
    const annuel = selected.montantTTC && selected.nbPassages
      ? (parseFloat(selected.montantTTC) * parseInt(selected.nbPassages)).toFixed(2)
      : "—";

    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
          <h2>{selected.ref}</h2>
          <span className="badge" style={{ background: sStyle.bg, color: sStyle.color }}>{sc}</span>
        </div>

        {/* Client */}
        <div className="card readonly">
          <div className="card-title">Client</div>
          <div className="info-row"><span>Nom</span><b>{selected.clientNom}</b></div>
          {selected.clientResponsable && (
            <div className="info-row"><span>Responsable</span><b>{selected.clientResponsable}</b></div>
          )}
          <div className="info-row"><span>Adresse siège</span><b>{selected.clientAdresse || "—"}</b></div>
          {selected.adresseIntervention && (
            <div className="info-row"><span>Intervention</span><b>{selected.adresseIntervention}</b></div>
          )}
          <div className="info-row"><span>Téléphone</span><b>{selected.clientTel || "—"}</b></div>
          <div className="info-row"><span>Email</span><b>{selected.clientEmail || "—"}</b></div>
        </div>

        {/* Prestation */}
        <div className="card readonly">
          <div className="card-title">Prestation</div>
          <div className="info-row"><span>Types</span><b>{(selected.prestations || []).join(", ") || "—"}</b></div>
          <div className="info-row"><span>Passages / an</span><b>{selected.nbPassages}</b></div>
          <div className="info-row">
            <span>Montant / passage TTC</span>
            <b style={{ color: "#35B499" }}>{parseFloat(selected.montantTTC || 0).toFixed(2)} €</b>
          </div>
          <div className="info-row">
            <span>Total annuel TTC</span>
            <b style={{ color: "#35B499" }}>{annuel} €</b>
          </div>
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
            <b style={{ color: days !== null && days < 0 ? "#c0392b" : days !== null && days <= ALERT_DAYS ? "#8B6A4E" : "var(--color-text-primary)" }}>
              {fmtDate(selected.dateFin)}
            </b>
          </div>
          {days !== null && (
            <div className="info-row">
              <span>Jours restants</span>
              <b style={{ color: days < 0 ? "#c0392b" : days <= ALERT_DAYS ? "#8B6A4E" : "#35B499" }}>
                {days < 0 ? "Expiré" : `${days} jour(s)`}
              </b>
            </div>
          )}
        </div>

        {/* Passages */}
        <div className="card">
          <div className="card-title">Passages effectués</div>
          <div style={{ height: 4, background: "var(--color-border-tertiary)", borderRadius: 2, marginBottom: 6 }}>
            <div style={{ height: 4, background: "#35B499", borderRadius: 2, width: pct + "%", transition: "width .3s" }} />
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14 }}>
            {(selected.passages || []).length} / {selected.nbPassages} passages réalisés
          </p>

          {(selected.passages || []).length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12, fontStyle: "italic" }}>
              Aucun passage enregistré.
            </p>
          )}

          {(selected.passages || []).map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#35B499", flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 13, flex: 1, color: "var(--color-text-primary)" }}>
                {fmtDate(p.date)}
              </span>
              {sc !== "résilié" && (
                <button
                  onClick={() => removePassage(i)}
                  style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}

          {sc !== "résilié" && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
              <input
                type="date"
                value={newPassage}
                onChange={e => setNewPassage(e.target.value)}
                style={{
                  flex: 1, padding: "8px 10px", fontSize: 13,
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: 8, background: "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button className="btn-primary" onClick={addPassage} disabled={!newPassage}>
                + Ajouter
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        {selected.notes && (
          <div className="card readonly">
            <div className="card-title">Notes</div>
            <p style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6 }}>
              {selected.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, marginBottom: 28 }}>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => generatePDF(selected)}
          >
            📄 Télécharger le contrat PDF
          </button>
          <button
            className="btn-outline"
            onClick={() => {
              setForm({ ...selected });
              setIsEdit(true);
              setView("form");
            }}
          >
            Modifier
          </button>
        </div>

        {(sc === "à renouveler" || sc === "expiré") && (
          <button
            className="btn-finish"
            style={{ width: "100%", marginBottom: 28 }}
            disabled={saving}
            onClick={() => renouveler(selected)}
          >
            {saving ? "Renouvellement en cours…" : "🔄 Renouveler le contrat (+1 an)"}
          </button>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  const counts = {
    tous:       contrats.length,
    actif:      contrats.filter(c => c.sc === "actif").length,
    renouveler: contrats.filter(c => c.sc === "à renouveler").length,
    expire:     contrats.filter(c => c.sc === "expiré").length,
    resilie:    contrats.filter(c => c.sc === "résilié").length,
    brouillon:  contrats.filter(c => c.sc === "brouillon").length,
  };

  const FILTERS = [
    ["tous",       "Tous"],
    ["actif",      "Actifs"],
    ["renouveler", "À renouveler"],
    ["expire",     "Expirés"],
    ["resilie",    "Résiliés"],
    ["brouillon",  "Brouillons"],
  ];

  const filtered = contrats.filter(c => {
    if (filter === "tous")       return true;
    if (filter === "renouveler") return c.sc === "à renouveler";
    if (filter === "expire")     return c.sc === "expiré";
    if (filter === "resilie")    return c.sc === "résilié";
    return c.sc === filter;
  });

  return (
    <div className="container">
      <div className="page-header">
        <h2>Contrats de maintenance</h2>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {FILTERS.map(([key, label]) => {
          const active = filter === key;
          const cnt = counts[key];
          if (cnt === 0 && key !== "tous" && key !== filter) return null;
          return (
            <div
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: "0.5px solid var(--color-border-tertiary)",
                background: active
                  ? key === "renouveler" ? "#f5e8d8"
                  : key === "expire" || key === "resilie" ? "#fde8e8"
                  : "#e1f5ee"
                  : "var(--color-background-secondary)",
                color: active
                  ? key === "renouveler" ? "#6b4a31"
                  : key === "expire" || key === "resilie" ? "#9b2c2c"
                  : "#0e6b50"
                  : "var(--color-text-secondary)",
              }}
            >
              {label} ({cnt})
            </div>
          );
        })}
        <button
          className="btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            setForm({ ...EMPTY_FORM, dateSignature: todayStr(), dateDebut: todayStr() });
            setIsEdit(false);
            setView("form");
          }}
        >
          + Nouveau contrat
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="empty-state">Aucun contrat dans cette catégorie.</div>
      ) : (
        filtered.map(c => {
          const sStyle = statutStyle(c.sc);
          const days   = getDaysToExpiry(c.dateFin);
          const pct    = c.nbPassages
            ? Math.min(100, Math.round(((c.passages || []).length / c.nbPassages) * 100))
            : 0;
          const annuel = c.montantTTC && c.nbPassages
            ? (parseFloat(c.montantTTC) * parseInt(c.nbPassages)).toFixed(2)
            : null;

          return (
            <div
              key={c.id}
              className="bon-card"
              onClick={() => { setSelected(c); setView("detail"); }}
            >
              <div className="bon-card-top">
                <span className="bon-ref">{c.ref}</span>
                <span className="badge" style={{ background: sStyle.bg, color: sStyle.color }}>
                  {c.sc}
                </span>
              </div>
              <div className="bon-card-body">
                <b>{c.clientNom}</b>
                <span>{(c.prestations || []).join(", ") || "—"}</span>
              </div>
              {c.nbPassages && (
                <>
                  <div style={{ height: 3, background: "var(--color-border-tertiary)", borderRadius: 2, margin: "8px 0 3px" }}>
                    <div style={{ height: 3, background: "#35B499", borderRadius: 2, width: pct + "%" }} />
                  </div>
                  <div className="bon-card-footer">
                    <span>{(c.passages || []).length}/{c.nbPassages} passages{annuel ? ` · ${annuel} € TTC/an` : ""}</span>
                    <span style={{
                      color: days !== null && days < 0 ? "#c0392b"
                           : days !== null && days <= ALERT_DAYS ? "#8B6A4E"
                           : "var(--color-text-secondary)",
                      fontWeight: days !== null && days <= ALERT_DAYS && days >= 0 ? 500 : 400,
                    }}>
                      {c.dateFin
                        ? days < 0 ? "Expiré"
                        : days <= ALERT_DAYS ? `⚠ ${days}j restants`
                        : `Fin : ${fmtDate(c.dateFin)}`
                        : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
