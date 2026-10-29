// src/components/PropositionRdv.js
// Page publique ouverte par le client depuis le lien WhatsApp (https://cocon-app.vercel.app/?rdv=<jeton>).
// Pas de connexion : le client lit uniquement sa proposition (rdvPropositions/<jeton>) et choisit un créneau, une fois.
// Cocon+ le rappelle ensuite pour confirmer, puis crée le bon depuis le planning.
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const VERT = "#35B499";
const BRUN = "#8B6A4E";
const TEL_COCON = "0596 73 66 66";

const fmtJour = (str) => {
  const s = new Date(str + "T12:00:00").toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const fmtHeure = (h) => {
  if (!h) return "";
  const [hh, mm] = h.split(":").map(Number);
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2,"0")}`;
};

// Le client voit l'heure d'arrivée et une durée approximative, jamais l'heure de fin
const fmtDuree = (minutes) => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h${m ? String(m).padStart(2,"0") : ""}` : `${m} min`;
};

const dureeProposition = (p) => {
  if (p.dureeMinutes) return p.dureeMinutes;
  const c = (p.creneaux || [])[0];
  if (!c?.debut || !c?.fin) return null;
  const [dh, dm] = c.debut.split(":").map(Number), [fh, fm] = c.fin.split(":").map(Number);
  return fh * 60 + fm - dh * 60 - dm;
};

const aujourdhui = () => new Date().toLocaleDateString("fr-CA", { timeZone: "America/Martinique" });

export default function PropositionRdv({ token }) {
  const [prop, setProp]             = useState(null);
  const [etat, setEtat]             = useState("chargement"); // chargement | ok | introuvable
  const [choix, setChoix]           = useState(null);
  const [aucun, setAucun]           = useState(false);
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi]           = useState(false);
  const [erreur, setErreur]         = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "rdvPropositions", token));
        if (!snap.exists()) { setEtat("introuvable"); return; }
        setProp({ id: snap.id, ...snap.data() });
        setEtat("ok");
      } catch (e) {
        console.error("Lecture proposition :", e);
        setEtat("introuvable");
      }
    })();
  }, [token]);

  const repondre = async (patch) => {
    setEnvoi(true);
    setErreur("");
    try {
      await updateDoc(doc(db, "rdvPropositions", token), { ...patch, reponduLe: serverTimestamp() });
      setProp(p => ({ ...p, ...patch }));
    } catch (e) {
      console.error("Réponse proposition :", e);
      setErreur(`Votre réponse n'a pas pu être enregistrée. Merci d'appeler le ${TEL_COCON}.`);
    }
    setEnvoi(false);
  };

  const page  = { minHeight:"100vh", background:"#f0ede8", padding:"24px 16px", display:"flex", justifyContent:"center" };
  const carte = { background:"white", borderRadius:16, padding:"24px 20px", width:"100%", maxWidth:440, boxShadow:"0 2px 20px rgba(0,0,0,0.08)", alignSelf:"flex-start" };
  const bouton = (bg, color = "white", actif = true) => ({
    width:"100%", padding:"15px", fontSize:16, fontWeight:700, borderRadius:12, border:"none",
    background:bg, color, fontFamily:"inherit", marginBottom:10,
    cursor:!actif ? "not-allowed" : envoi ? "wait" : "pointer", opacity:!actif || envoi ? 0.5 : 1,
  });
  const encadre = (bg, border, color) => ({ background:bg, border:`1px solid ${border}`, color, borderRadius:12, padding:"14px 16px", fontSize:14, lineHeight:1.5, marginBottom:14 });

  const entete = (
    <div style={{textAlign:"center", marginBottom:20}}>
      <img src="/logo.png" alt="Cocon+ — La maison protégée" style={{height:72, objectFit:"contain"}} />
    </div>
  );

  const pied = (
    <div style={{textAlign:"center", fontSize:13, color:"#777", marginTop:18, lineHeight:1.6}}>
      Une question ? <a href="tel:+596596736666" style={{color:VERT, fontWeight:700, textDecoration:"none"}}>{TEL_COCON}</a>
      <br />Cocon Plus SARL · Fort-de-France
    </div>
  );

  if (etat === "chargement") return (
    <div style={page}><div style={carte}>{entete}<p style={{textAlign:"center", color:"#888"}}>Chargement…</p></div></div>
  );

  if (etat === "introuvable") return (
    <div style={page}><div style={carte}>
      {entete}
      <div style={encadre("#fdf3ec", "#e8c9b8", "#6b4a31")}>
        Ce lien n'est pas valide ou n'est plus actif. Pour votre rendez-vous, contactez-nous au {TEL_COCON}.
      </div>
      {pied}
    </div></div>
  );

  const creneaux = prop.creneaux || [];
  const today    = aujourdhui();
  const ouverts  = creneaux.map(c => c.date > today); // le jour même et les dates passées ne sont plus proposés
  const expire   = !ouverts.some(Boolean);
  const choisi   = prop.choix !== null && prop.choix !== undefined ? creneaux[prop.choix] : null;

  const recapIntervention = (
    <div style={{fontSize:14, color:"#444", marginBottom:16, lineHeight:1.6}}>
      {prop.type && <div>🔧 {prop.type}</div>}
      {dureeProposition(prop) > 0 && <div>⏱️ Durée : environ {fmtDuree(dureeProposition(prop))}</div>}
      {prop.adresse && <div>📍 {prop.adresse}</div>}
    </div>
  );

  return (
    <div style={page}><div style={carte}>
      {entete}

      <h1 style={{fontSize:20, fontWeight:800, color:"#1a1a1a", marginBottom:6}}>Votre rendez-vous Cocon+</h1>
      <p style={{fontSize:14, color:"#555", marginBottom:12}}>Bonjour {prop.salutation || ""},</p>
      {recapIntervention}

      {erreur && <div style={encadre("#fdecea", "#f5b7b1", "#922b21")}>{erreur}</div>}

      {/* ── Réponse déjà donnée ── */}
      {prop.statut === "choisi" && choisi && (
        <div style={encadre("#e8f5f3", VERT, "#1a7a65")}>
          ✅ <b>Merci, vous avez choisi :</b><br />
          📅 {fmtJour(choisi.date)} à {fmtHeure(choisi.debut)}<br />
          <span style={{color:"#444"}}>Nous vous appelons très prochainement pour confirmer ce rendez-vous.</span>
        </div>
      )}

      {prop.statut === "aucun" && (
        <div style={encadre("#fff4e6", "#e8c9b8", BRUN)}>
          📞 <b>Message bien reçu.</b> Nous vous recontactons rapidement pour trouver une autre date.
        </div>
      )}

      {prop.statut === "planifié" && (
        <div style={encadre("#e8f5f3", VERT, "#1a7a65")}>
          ✅ <b>Votre rendez-vous est fixé.</b> Merci de votre confiance !
        </div>
      )}

      {prop.statut === "annulé" && (
        <div style={encadre("#fdf3ec", "#e8c9b8", "#6b4a31")}>
          Cette proposition n'est plus active. Contactez-nous pour fixer votre rendez-vous.
        </div>
      )}

      {prop.statut === "en attente" && expire && (
        <div style={encadre("#f4f4f4", "#ddd", "#666")}>
          Les créneaux proposés sont passés. Contactez-nous pour fixer une nouvelle date.
        </div>
      )}

      {/* ── Choix du créneau ── */}
      {prop.statut === "en attente" && !expire && !aucun && (
        <>
          <p style={{fontSize:15, fontWeight:700, color:"#1a1a1a", marginBottom:10}}>
            {creneaux.length > 1 ? "Choisissez le créneau qui vous convient le mieux :" : "Ce créneau vous convient-il ?"}
          </p>
          {creneaux.map((c, i) => {
            const actif = ouverts[i];
            const selectionne = choix === i;
            return (
              <button key={i} type="button" disabled={!actif || envoi} onClick={() => setChoix(i)}
                style={{
                  width:"100%", textAlign:"left", padding:"14px 16px", marginBottom:10, borderRadius:12,
                  fontFamily:"inherit", fontSize:15, cursor:actif ? "pointer" : "not-allowed",
                  border:selectionne ? `2px solid ${VERT}` : "1px solid #ddd",
                  background:selectionne ? "#e8f5f3" : actif ? "white" : "#f4f4f4",
                  color:actif ? "#1a1a1a" : "#aaa", display:"flex", alignItems:"center", gap:12,
                }}>
                <span style={{width:22, height:22, borderRadius:"50%", flexShrink:0,
                  border:`2px solid ${selectionne ? VERT : "#bbb"}`, background:selectionne ? VERT : "white",
                  boxShadow:selectionne ? "inset 0 0 0 3px white" : "none"}} />
                <span>
                  <b>{fmtJour(c.date)}</b><br />
                  <span style={{fontSize:14, color:actif ? "#555" : "#aaa"}}>Arrivée à {fmtHeure(c.debut)}{!actif ? " · plus disponible" : ""}</span>
                </span>
              </button>
            );
          })}
          <button style={bouton(VERT, "white", choix !== null)} disabled={choix === null || envoi}
            onClick={() => repondre({ statut:"choisi", choix })}>
            {envoi ? "Enregistrement…" : "✅ Je choisis ce créneau"}
          </button>
          <button style={bouton("#f0ede8", BRUN)} disabled={envoi} onClick={() => setAucun(true)}>
            {creneaux.length > 1 ? "Aucun créneau ne me convient" : "Ce créneau ne me convient pas"}
          </button>
          <p style={{fontSize:12, color:"#888", textAlign:"center", marginTop:4}}>
            Nous vous rappellerons pour confirmer le rendez-vous.
          </p>
        </>
      )}

      {prop.statut === "en attente" && !expire && aucun && (
        <>
          <label style={{display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:6}}>
            Vos disponibilités (facultatif)
          </label>
          <textarea value={commentaire} maxLength={500} rows={3}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="Ex. : plutôt la semaine prochaine, le matin"
            style={{width:"100%", padding:"10px 12px", fontSize:15, border:"1px solid #ddd", borderRadius:10, marginBottom:12, fontFamily:"inherit", resize:"vertical"}} />
          <button style={bouton(BRUN)} disabled={envoi}
            onClick={() => repondre({ statut:"aucun", commentaireClient:commentaire.trim().slice(0, 500) })}>
            {envoi ? "Envoi…" : "Envoyer"}
          </button>
          <button style={bouton("transparent", "#888")} disabled={envoi} onClick={() => setAucun(false)}>
            ← Revenir aux créneaux
          </button>
        </>
      )}

      {pied}
    </div></div>
  );
}
