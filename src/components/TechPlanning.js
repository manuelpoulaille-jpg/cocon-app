// src/components/TechPlanning.js
// Onglet « Planning » du technicien (lecture seule) : agenda jour par jour
// sur la semaine en cours et la suivante, avec une fiche par bon
// (Appeler, Itinéraire, demande client, prestations).
// Styles : classes .tp-* dans App.css.

import React, { useEffect, useMemo, useRef, useState } from "react";

const TZ = "America/Martinique";
const TERMITILES = "Termit'iles";

// ── Dates (heure de Martinique) ──────────────────────────────────────────────

const nowMq = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
const keyOf = (d) => d.toLocaleDateString("fr-CA");               // AAAA-MM-JJ
const fromKey = (k) => new Date(k + "T12:00:00");

const lundiDe = (offset) => {
  const now = nowMq();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  mon.setHours(12, 0, 0, 0);
  return mon;
};
const joursSemaine = (offset) => {
  const mon = lundiDe(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return keyOf(d);
  });
};
const ajouterJours = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

const maj = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const dateLongue = (k) => fromKey(k).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const jourCourt = (k) => fromKey(k).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase();
const numJour = (k) => fromKey(k).getDate();
const moisCourt = (k) => fromKey(k).toLocaleDateString("fr-FR", { month: "long" });

const libelleSemaine = (jours) => {
  const a = jours[0];
  const b = jours[4];
  return moisCourt(a) === moisCourt(b)
    ? `du ${numJour(a)} au ${numJour(b)} ${moisCourt(b)}`
    : `du ${numJour(a)} ${moisCourt(a)} au ${numJour(b)} ${moisCourt(b)}`;
};

// ── Bons ─────────────────────────────────────────────────────────────────────

const minutes = (h) => {
  if (!h || !/^\d{1,2}:\d{2}$/.test(h)) return null;
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
};
const fmtDuree = (debut, fin) => {
  const a = minutes(debut);
  const b = minutes(fin);
  if (a === null || b === null || b <= a) return "";
  const d = b - a;
  const h = Math.floor(d / 60);
  const m = d % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

const extractVille = (adresse) => {
  if (!adresse) return "";
  const match = adresse.match(/972\d{2}\s+([^,\n]+)/i);
  return match ? match[1].trim() : "";
};
const villeDe = (b) => extractVille(b.adresseIntervention || b.clientAdresse || "");
const adresseDe = (b) => (b.adresseIntervention || b.clientAdresse || "").trim();
const estTermitiles = (b) => b.entreprise === TERMITILES;

// Premier numéro d'un champ téléphone (« 0696… / 0596… ») au format tel:
const premierTel = (tel) => (tel || "").split(/[/;,\n]|\s+-\s+|\s+ou\s+/i)[0].trim();
const telLien = (tel) => {
  let chiffres = premierTel(tel).replace(/[^\d+]/g, "");
  if (/^0\d{10,}/.test(chiffres)) chiffres = chiffres.slice(0, 10);          // « 0696123456 0596123456 »
  else if (/^\+\d{12,}/.test(chiffres)) chiffres = chiffres.slice(0, 12);    // « +596696123456… »
  return chiffres.replace(/\D/g, "").length >= 6 ? chiffres : "";
};
const telAffiche = (tel) => {
  const t = telLien(tel);
  return /^0\d{9}$/.test(t) ? t.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4") : premierTel(tel);
};
const itineraireLien = (b) => {
  const adr = adresseDe(b);
  if (!adr) return "";
  const q = /martinique|972\d{2}/i.test(adr) ? adr : `${adr}, Martinique`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
};

const prestationsInfo = (b) => {
  const p = b.prestations || [];
  return { total: p.length, faites: p.filter((x) => x.done || x.nonRealise).length };
};

// Un ancien bon peut couvrir plusieurs jours (dateFinPrevue) : on l'affiche sur chacun.
const joursDuBon = (b) => {
  const debut = b.datePrevue;
  const fin = b.dateFinPrevue && b.dateFinPrevue > debut ? b.dateFinPrevue : debut;
  const out = [];
  for (let k = debut; k <= fin && out.length < 31; k = ajouterJours(k, 1)) out.push(k);
  return out;
};

// « J2/3 » : bons du planning (jourNum/joursTotal) ou anciens bons avec dateFinPrevue
const infoJour = (b, k) => {
  if (b.joursTotal > 1) return { num: b.jourNum, total: b.joursTotal };
  const jours = joursDuBon(b);
  return jours.length > 1 ? { num: jours.indexOf(k) + 1, total: jours.length } : null;
};

const STATUT_STYLE = {
  "planifié": { background: "#d4f0ea", color: "#1a7a65" },
  "en cours": { background: "#e8c9b8", color: "#6b4a31" },
  "terminé": { background: "#35B499", color: "#fff" },
};

const Badges = ({ b, jour }) => {
  const { total, faites } = prestationsInfo(b);
  const j = infoJour(b, jour);
  return (
    <div className="tp-badges">
      {estTermitiles(b) && <span className="tp-bdg tp-bleu">Termit'iles</span>}
      {b.isRetouche && <span className="tp-bdg tp-orange">🔧 Retouche</span>}
      {j && <span className="tp-bdg tp-brun">J{j.num}/{j.total}</span>}
      {total > 0 && <span className="tp-bdg tp-vert">📋 {faites}/{total}</span>}
      <span className="tp-bdg tp-statut" style={STATUT_STYLE[b.statut] || { background: "#eee", color: "#333" }}>
        {b.statut || "—"}
      </span>
    </div>
  );
};

// Jour consulté, gardé quand on ouvre un bon puis revient (« ← Retour »)
let dernierJour = null;

// ── Composant ────────────────────────────────────────────────────────────────

export default function TechPlanning({ bons, onOpenBon }) {
  const today = keyOf(nowMq());
  const tomorrow = ajouterJours(today, 1);

  // Bons rangés par jour (AAAA-MM-JJ), triés par heure
  const parJour = useMemo(() => {
    const map = {};
    (bons || []).forEach((b) => {
      if (!b.datePrevue) return;
      joursDuBon(b).forEach((k) => { (map[k] = map[k] || []).push(b); });
    });
    Object.values(map).forEach((l) => l.sort((x, y) => (x.heurePrevue || "99:99").localeCompare(y.heurePrevue || "99:99")));
    return map;
  }, [bons]);

  // Le week-end sans bon, on s'ouvre sur le lundi suivant.
  const jourDepart = () => {
    const dow = fromKey(today).getDay();
    if ((dow === 0 || dow === 6) && !(parJour[today] || []).length) return joursSemaine(1)[0];
    return today;
  };
  const semaineDe = (k) => (joursSemaine(1).includes(k) ? 1 : 0);

  const jourInitial = () =>
    dernierJour && [...joursSemaine(0), ...joursSemaine(1)].includes(dernierJour) ? dernierJour : jourDepart();
  const [selection, setSelectionState] = useState(jourInitial);
  const [semaine, setSemaine] = useState(() => semaineDe(jourInitial()));
  const [ouvertId, setOuvertId] = useState(null);
  const enteteJour = useRef(null);
  const selecteur = useRef(null);

  const setSelection = (k) => {
    dernierJour = k;
    setSelectionState(k);
    // Si la liste est défilée, ramener le titre du jour sous le sélecteur collant
    requestAnimationFrame(() => {
      const h = enteteJour.current;
      const sel = selecteur.current;
      if (!h || !sel) return;
      const basSelecteur = sel.getBoundingClientRect().bottom;
      const haut = h.getBoundingClientRect().top;
      if (haut < basSelecteur) h.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  // Fermer la fiche avec la touche Échap (clavier, ordinateur)
  useEffect(() => {
    if (!ouvertId) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOuvertId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvertId]);

  const jours = joursSemaine(semaine);
  const ouvres = jours.slice(0, 5);
  const weekEnd = jours.slice(5).filter((k) => (parJour[k] || []).length);
  const nbSemaine = jours.reduce((n, k) => n + (parJour[k] || []).length, 0);

  const changerSemaine = (s) => {
    setSemaine(s);
    const js = joursSemaine(s);
    setSelection(js.includes(today) ? today : js[0]);
  };
  const allerAujourdhui = () => { setSemaine(semaineDe(today)); setSelection(today); };

  const bonsDuJour = parJour[selection] || [];
  const villes = [...new Set(bonsDuJour.map(villeDe).filter(Boolean))];
  const debutJour = bonsDuJour.find((b) => b.heurePrevue)?.heurePrevue;
  const finJour = bonsDuJour.reduce((m, b) => {
    const f = b.heureFinPrevue || b.heurePrevue || "";
    return f > m ? f : m;
  }, "");

  const tag = selection === today ? { cls: "tp-tag-auj", txt: "Aujourd'hui" }
    : selection === tomorrow ? { cls: "tp-tag-demain", txt: "Demain" }
    : selection < today ? { cls: "tp-tag-passe", txt: "Passé" }
    : null;

  // ── Fiche (panneau bas) ────────────────────────────────────────────────────

  const renderFiche = (b) => {
    const tel = telLien(b.clientTel);
    const iti = itineraireLien(b);
    const ville = villeDe(b);
    const adr = adresseDe(b);
    const duree = fmtDuree(b.heurePrevue, b.heureFinPrevue);
    const { total, faites } = prestationsInfo(b);
    const jourBon = selection;
    return (
      <div className="tp-voile" onClick={() => setOuvertId(null)}>
        <div className="tp-panneau" role="dialog" aria-modal="true" aria-label={`Bon ${b.ref || ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="tp-poignee" />
          <div className="tp-p-tete">
            <div className="tp-p-ref">
              {b.ref && <span className="tp-ref">{b.ref}</span>}
              <span className="tp-bdg tp-statut" style={STATUT_STYLE[b.statut] || {}}>{b.statut}</span>
            </div>
            <button type="button" className="tp-fermer" onClick={() => setOuvertId(null)} aria-label="Fermer">✕</button>
          </div>

          {b.clientSociete && <div className="tp-p-soc">{b.clientSociete}</div>}
          <div className="tp-p-nom">{b.clientNom} {b.clientPrenom}</div>
          <div className="tp-p-quand">
            {maj(dateLongue(jourBon))} · <b>{b.heurePrevue || "—"}{b.heureFinPrevue ? ` → ${b.heureFinPrevue}` : ""}</b>
            {duree && <span> ({duree})</span>}
          </div>

          <div className="tp-actions">
            {tel
              ? <a className="tp-act tp-appel" href={`tel:${tel}`}>📞 Appeler<small>{telAffiche(b.clientTel)}</small></a>
              : <span className="tp-act tp-inactif">📞 Appeler<small>Pas de numéro</small></span>}
            {iti
              ? <a className="tp-act tp-iti" href={iti} target="_blank" rel="noopener noreferrer">🧭 Itinéraire<small>{ville || "Ouvrir la carte"}</small></a>
              : <span className="tp-act tp-inactif">🧭 Itinéraire<small>Pas d'adresse</small></span>}
          </div>

          {b.demandeClient && (
            <div className="tp-note">
              <b>📝 Demande client</b>
              <p>{b.demandeClient}</p>
            </div>
          )}

          <dl className="tp-infos">
            <div><dt>Adresse</dt><dd>{adr || <span className="tp-muet">Non renseignée</span>}</dd></div>
            <div><dt>Type</dt><dd>{b.type || "—"}</dd></div>
            <div><dt>Entreprise</dt><dd className={estTermitiles(b) ? "tp-txt-bleu" : "tp-txt-vert"}>{estTermitiles(b) ? TERMITILES : "Cocon+"}</dd></div>
            <div><dt>Collaborateur</dt><dd>{b.techNom || "—"}</dd></div>
            {infoJour(b, jourBon) && <div><dt>Chantier</dt><dd>Jour {infoJour(b, jourBon).num} sur {infoJour(b, jourBon).total}</dd></div>}
          </dl>

          {total > 0 && (
            <div className="tp-prest">
              <b>📋 Prestations ({faites} traitée{faites > 1 ? "s" : ""} sur {total})</b>
              <ul>
                {(b.prestations || []).map((p) => (
                  <li key={p.id || p.label} className={p.done ? "tp-fait" : p.nonRealise ? "tp-nonfait" : ""}>
                    <span>{p.done ? "✓" : p.nonRealise ? "✕" : "○"}</span> {p.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {jourBon > today && b.statut !== "terminé" && (
            <div className="tp-rappel">🔒 <span><b>Consultation seulement.</b> Le chantier pourra être démarré le jour J, {dateLongue(jourBon)}.</span></div>
          )}
          {jourBon < today && b.statut !== "terminé" && (
            <div className="tp-rappel">🗂️ <span>Bon d'un jour passé, pas encore clôturé : le bureau s'en charge.</span></div>
          )}
          {b.statut === "terminé" && (
            <div className="tp-rappel tp-ok">✓ <span>Intervention terminée.</span></div>
          )}

          {jourBon >= today && b.datePrevue >= today && (
            <button type="button" className="tp-cta" onClick={() => { setOuvertId(null); onOpenBon(b); }}>
              {jourBon > today ? "Voir le bon complet →"
                : b.statut === "planifié" ? "Ouvrir le bon · signaler l'arrivée →"
                : b.statut === "en cours" ? "Ouvrir le bon pour le clôturer →"
                : "Voir le bon →"}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="tp-root">
      <div className="tp-titre-row">
        <div>
          <h2 className="tp-h">Mon planning</h2>
          <p className="tp-sous">Touchez un jour, puis une intervention</p>
        </div>
        {selection !== today && (
          <button type="button" className="tp-pill-auj" onClick={allerAujourdhui}>Aujourd'hui</button>
        )}
      </div>

      <div className="tp-semaine" ref={selecteur}>
        <div className="tp-sem-nav">
          <button type="button" className="tp-fleche" disabled={semaine === 0} onClick={() => changerSemaine(0)} aria-label="Semaine en cours">‹</button>
          <div className="tp-sem-lib">
            <b>{semaine === 0 ? "Cette semaine" : "Semaine prochaine"} · {nbSemaine ? `${nbSemaine} bon${nbSemaine > 1 ? "s" : ""}` : "aucun bon"}</b>
            <span>{libelleSemaine(jours)}</span>
          </div>
          <button type="button" className="tp-fleche" disabled={semaine === 1} onClick={() => changerSemaine(1)} aria-label="Semaine prochaine">›</button>
        </div>

        <div className="tp-jours" role="tablist">
          {ouvres.map((k) => {
            const n = (parJour[k] || []).length;
            const tousFaits = n > 0 && (parJour[k] || []).every((b) => b.statut === "terminé");
            const cls = ["tp-jour", k === today && "tp-auj", k === selection && "tp-sel", k < today && "tp-passe"].filter(Boolean).join(" ");
            return (
              <button key={k} type="button" role="tab" aria-selected={k === selection} className={cls} onClick={() => setSelection(k)}>
                <span className="tp-j-lib">{k === today ? "Auj." : jourCourt(k)}</span>
                <span className="tp-j-num">{numJour(k)}</span>
                <span className={n ? "tp-j-cpt" : "tp-j-cpt tp-vide"}>{n ? `${tousFaits ? "✓ " : ""}${n} bon${n > 1 ? "s" : ""}` : "aucun"}</span>
              </button>
            );
          })}
        </div>

        {weekEnd.map((k) => (
          <button key={k} type="button" className={k === selection ? "tp-weekend tp-sel" : "tp-weekend"} onClick={() => setSelection(k)}>
            <span>{maj(dateLongue(k))}</span>
            <b>{(parJour[k] || []).length} bon{(parJour[k] || []).length > 1 ? "s" : ""}</b>
          </button>
        ))}
      </div>

      <div className="tp-j-tete" ref={enteteJour}>
        <div className="tp-j-titre">
          <h3>{maj(dateLongue(selection))}</h3>
          {tag && <span className={`tp-tag ${tag.cls}`}>{tag.txt}</span>}
        </div>
        {bonsDuJour.length > 0 && (
          <p className="tp-j-resume">
            <b>{bonsDuJour.length} intervention{bonsDuJour.length > 1 ? "s" : ""}</b>
            {debutJour ? ` · de ${debutJour} à ${finJour || debutJour}` : ""}
            {villes.length > 0 && <><br />📍 {villes.join(" · ")}</>}
          </p>
        )}
        {selection > today && bonsDuJour.some((b) => b.statut !== "terminé") && (
          <p className="tp-j-lecture"><span>🔒</span><span>Consultation seulement : {bonsDuJour.length > 1 ? "ces chantiers pourront être démarrés" : "ce chantier pourra être démarré"} le jour J.</span></p>
        )}
      </div>

      {bonsDuJour.length === 0 ? (
        <div className="tp-vide-box">
          <span className="tp-em">🌴</span>
          <b>Aucune intervention</b>
          <p>{nbSemaine ? "Rien n'est prévu pour vous ce jour-là pour l'instant." : "Rien n'est encore planifié sur cette semaine. Le bureau ajoutera les bons au fur et à mesure."}</p>
        </div>
      ) : (
        <div className="tp-liste">
          {bonsDuJour.map((b, i) => {
            const ville = villeDe(b);
            const villePrec = i > 0 ? villeDe(bonsDuJour[i - 1]) : "";
            const cls = ["tp-bon", estTermitiles(b) && "tp-termitiles", b.statut === "en cours" && "tp-encours", b.statut === "terminé" && "tp-termine"].filter(Boolean).join(" ");
            return (
              <React.Fragment key={`${b.id}-${selection}`}>
                {i > 0 && ville && villePrec && ville !== villePrec && (
                  <div className="tp-secteur">Changement de secteur : <b>{villePrec}</b> → <b>{ville}</b></div>
                )}
                <button type="button" className={cls} onClick={() => setOuvertId(b.id)}>
                  <span className="tp-accent" />
                  <span className="tp-heure">
                    <b>{b.heurePrevue || "—"}</b>
                    {b.heureFinPrevue && <span>→ {b.heureFinPrevue}</span>}
                  </span>
                  <span className="tp-corps">
                    {b.clientSociete && <span className="tp-soc">{b.clientSociete}</span>}
                    <span className="tp-nom">{b.clientNom} {b.clientPrenom}</span>
                    <span className="tp-ligne">
                      {b.type}{ville && <> · <span className="tp-ville">📍 {ville}</span></>}
                    </span>
                    <Badges b={b} jour={selection} />
                  </span>
                  <span className="tp-chev">›</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {ouvertId && bonsDuJour.some((b) => b.id === ouvertId) && renderFiche(bonsDuJour.find((b) => b.id === ouvertId))}
    </div>
  );
}
