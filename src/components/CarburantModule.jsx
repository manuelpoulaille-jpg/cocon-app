// ─────────────────────────────────────────────────────────────────────────────
// CarburantModule.jsx — Suivi Carburant pour Cocon+
// À placer dans : src/components/CarburantModule.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase"; // ← adapter si nécessaire

// ══════════════════════════════════════════════════════════════════════════════
// ⚙️  CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════
const BUDGET_MENSUEL_EUROS = 300; // 👈 MODIFIEZ CETTE VALEUR
// ══════════════════════════════════════════════════════════════════════════════

const TEAL       = "#2a9d8f";
const TEAL_DARK  = "#1f7a6e";
const TEAL_LIGHT = "#e8f5f3";
const ORANGE     = "#e76f51";
const YELLOW     = "#f4a261";
const LIGHT_BG   = "#f7fbfa";
const GRAY       = "#6b7280";

// ─── Composants utilitaires ───────────────────────────────────────────────────

function StatCard({ icon, titre, valeur, sous }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "16px 18px",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)", flex: 1, minWidth: 140
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 12, color: GRAY, marginBottom: 2 }}>{titre}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: TEAL_DARK }}>{valeur}</div>
      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{sous}</div>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: GRAY, marginLeft: 6, fontSize: 12 }}>{hint}</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: ORANGE }}>{error}</span>}
    </div>
  );
}

function PleinRow({ plein }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 12px", background: LIGHT_BG, borderRadius: 8,
      fontSize: 14, flexWrap: "wrap", gap: 6
    }}>
      <span>📅 {new Date(plein.date).toLocaleDateString("fr-FR")}</span>
      <span>🛢️ {plein.litres?.toFixed(2)} L</span>
      <span>📍 {plein.kilometrage?.toLocaleString("fr-FR")} km</span>
      <span style={{ fontWeight: 700, color: TEAL_DARK }}>💶 {plein.montant?.toFixed(2)} €</span>
      <span style={{ color: GRAY, fontSize: 12 }}>{plein.conducteur}</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CarburantModule({ user }) {
  const [pleins, setPleins]             = useState([]);
  const [vue, setVue]                   = useState("dashboard");
  const [loading, setLoading]           = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [successMsg, setSuccessMsg]     = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    date:        today,
    kilometrage: "",
    montant:     "",   // ← saisi manuellement depuis le ticket
    prixLitre:   "",   // ← saisi manuellement
    conducteur:  user?.displayName || user?.email || "",
    commentaire: "",
  });
  const [errors, setErrors] = useState({});

  // Litres calculés automatiquement
  const litresCalcules =
    form.montant && form.prixLitre &&
    !isNaN(form.montant) && !isNaN(form.prixLitre) &&
    parseFloat(form.prixLitre) > 0
      ? (parseFloat(form.montant) / parseFloat(form.prixLitre)).toFixed(2)
      : null;

  // ── Chargement Firebase ───────────────────────────────────────────────────
  useEffect(() => { fetchPleins(); }, []);

  const fetchPleins = async () => {
    setFetchLoading(true);
    try {
      const q = query(collection(db, "carburant"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setPleins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Erreur chargement carburant :", e);
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.date)                                 e.date        = "Champ requis";
    if (!form.kilometrage || isNaN(form.kilometrage)) e.kilometrage = "Valeur invalide";
    if (!form.montant     || isNaN(form.montant))   e.montant     = "Valeur invalide";
    if (!form.prixLitre   || isNaN(form.prixLitre) || parseFloat(form.prixLitre) <= 0)
                                                    e.prixLitre   = "Valeur invalide";
    if (!form.conducteur)                           e.conducteur  = "Champ requis";
    return e;
  };

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    try {
      const litres = parseFloat(form.montant) / parseFloat(form.prixLitre);
      await addDoc(collection(db, "carburant"), {
        date:        form.date,
        kilometrage: parseFloat(form.kilometrage),
        montant:     parseFloat(parseFloat(form.montant).toFixed(2)),
        prixLitre:   parseFloat(parseFloat(form.prixLitre).toFixed(3)),
        litres:      parseFloat(litres.toFixed(2)),
        conducteur:  form.conducteur,
        commentaire: form.commentaire,
        createdAt:   serverTimestamp(),
        createdBy:   user?.uid || "unknown",
      });
      setForm({ date: today, kilometrage: "", montant: "", prixLitre: "", conducteur: user?.displayName || user?.email || "", commentaire: "" });
      setErrors({});
      await fetchPleins();
      setSuccessMsg("✅ Plein enregistré avec succès !");
      setTimeout(() => setSuccessMsg(""), 3000);
      setVue("dashboard");
    } catch (err) {
      console.error("Erreur ajout plein :", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Calculs stats ─────────────────────────────────────────────────────────
  const now          = new Date();
  const moisCourant  = now.getMonth();
  const anneeCourant = now.getFullYear();
  const nomMois      = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const pleinsMois   = pleins.filter((p) => {
    const d = new Date(p.date);
    return d.getMonth() === moisCourant && d.getFullYear() === anneeCourant;
  });

  const depenseMois  = pleinsMois.reduce((acc, p) => acc + (p.montant || 0), 0);
  const litresMois   = pleinsMois.reduce((acc, p) => acc + (p.litres  || 0), 0);
  const nbPleinsMois = pleinsMois.length;

  // Conso moyenne L/100km
  const sorted = [...pleins].sort((a, b) => a.kilometrage - b.kilometrage);
  let conso = null;
  if (sorted.length >= 2) {
    const deltaKm = sorted[sorted.length - 1].kilometrage - sorted[0].kilometrage;
    const totalL  = sorted.slice(1).reduce((acc, p) => acc + p.litres, 0);
    if (deltaKm > 0) conso = ((totalL / deltaKm) * 100).toFixed(1);
  }

  const budgetPct    = Math.min((depenseMois / BUDGET_MENSUEL_EUROS) * 100, 100);
  const alerteBudget = depenseMois > BUDGET_MENSUEL_EUROS;
  const alerteProche = !alerteBudget && budgetPct >= 80;
  const jaugeColor   = alerteBudget ? ORANGE : alerteProche ? YELLOW : TEAL;
  const totalGeneral = pleins.reduce((acc, p) => acc + (p.montant || 0), 0);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", maxWidth: 720, margin: "0 auto", padding: "0 16px 40px" }}>

      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`,
        borderRadius: 16, padding: "20px 24px", marginBottom: 20,
        color: "#fff", boxShadow: "0 4px 16px rgba(42,157,143,0.3)"
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>⛽ Suivi Carburant</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "dashboard",  label: "🏠 Tableau de bord" },
            { id: "ajouter",    label: "+ Ajouter un plein" },
            { id: "historique", label: "📋 Historique" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setVue(id)} style={{
              padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, transition: "all .2s",
              background: vue === id ? "#fff" : "rgba(255,255,255,0.18)",
              color:      vue === id ? TEAL_DARK : "#fff",
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification succès */}
      {successMsg && (
        <div style={{
          background: "#e8f5e9", border: "1px solid #a5d6a7", color: "#2e7d32",
          padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontWeight: 600
        }}>
          {successMsg}
        </div>
      )}

      {/* ══════════ DASHBOARD ══════════ */}
      {vue === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {(alerteBudget || alerteProche) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 10, border: "2px solid",
              borderColor: alerteBudget ? ORANGE : YELLOW,
              background:  alerteBudget ? "#fff4f0" : "#fffbf0",
            }}>
              <span style={{ fontSize: 22 }}>{alerteBudget ? "🔴" : "🟡"}</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: alerteBudget ? ORANGE : "#c07020" }}>
                {alerteBudget
                  ? `Budget dépassé ! ${depenseMois.toFixed(2)} € dépensés pour un budget de ${BUDGET_MENSUEL_EUROS} €.`
                  : `Attention : ${budgetPct.toFixed(0)} % du budget atteint — ${depenseMois.toFixed(2)} € / ${BUDGET_MENSUEL_EUROS} €`}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard icon="💶" titre={`Dépense — ${nomMois}`} valeur={`${depenseMois.toFixed(2)} €`} sous={`${nbPleinsMois} plein${nbPleinsMois > 1 ? "s" : ""}`} />
            <StatCard icon="🛢️" titre="Litres ce mois"         valeur={`${litresMois.toFixed(1)} L`}  sous="consommés" />
            <StatCard icon="📊" titre="Conso. moyenne"          valeur={conso ? `${conso} L/100` : "—"} sous={conso ? "sur tout l'historique" : "min. 2 pleins requis"} />
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "#333" }}>Budget mensuel</span>
              <span style={{ fontWeight: 700, color: jaugeColor }}>{depenseMois.toFixed(2)} € / {BUDGET_MENSUEL_EUROS} €</span>
            </div>
            <div style={{ height: 12, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, transition: "width .5s ease", width: `${budgetPct}%`, background: jaugeColor }} />
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#888", marginTop: 4 }}>
              Il reste {Math.max(0, BUDGET_MENSUEL_EUROS - depenseMois).toFixed(2)} €
            </div>
          </div>

          {pleins.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ fontWeight: 600, color: "#333", marginBottom: 10 }}>Dernier plein enregistré</div>
              <PleinRow plein={pleins[0]} />
            </div>
          )}

          {pleins.length === 0 && !fetchLoading && (
            <div style={{ textAlign: "center", padding: 40, color: GRAY }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⛽</div>
              <p>Aucun plein enregistré pour l'instant.</p>
              <button onClick={() => setVue("ajouter")} style={{
                marginTop: 10, background: TEAL, color: "#fff", border: "none",
                borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600
              }}>
                Ajouter le premier plein
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════ FORMULAIRE ══════════ */}
      {vue === "ajouter" && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <h3 style={{ margin: "0 0 18px", color: TEAL_DARK }}>Nouveau plein</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            <Field label="Date *" error={errors.date}>
              <input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Kilométrage au compteur (km) *" error={errors.kilometrage}>
              <input type="number" placeholder="ex : 45 320" value={form.kilometrage}
                onChange={(e) => setForm({ ...form, kilometrage: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Montant total (€) *" hint="depuis votre ticket" error={errors.montant}>
              <input type="number" step="0.01" placeholder="ex : 75.50" value={form.montant}
                onChange={(e) => setForm({ ...form, montant: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Prix au litre (€) *" hint="depuis votre ticket" error={errors.prixLitre}>
              <input type="number" step="0.001" placeholder="ex : 1.879" value={form.prixLitre}
                onChange={(e) => setForm({ ...form, prixLitre: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Conducteur *" error={errors.conducteur}>
              <input type="text" placeholder="Prénom Nom" value={form.conducteur}
                onChange={(e) => setForm({ ...form, conducteur: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="Commentaire (optionnel)">
              <input type="text" placeholder="Station, remarque…" value={form.commentaire}
                onChange={(e) => setForm({ ...form, commentaire: e.target.value })} style={inputStyle} />
            </Field>

          </div>

          {/* Litres calculés automatiquement */}
          {litresCalcules && (
            <div style={{
              marginTop: 16, padding: "12px 16px", background: TEAL_LIGHT,
              borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <span style={{ color: TEAL_DARK, fontWeight: 600 }}>
                🛢️ Litres calculés automatiquement
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: TEAL_DARK }}>
                {litresCalcules} L
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setVue("dashboard")} style={{
              flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #ddd",
              background: "#fff", cursor: "pointer", fontWeight: 600, color: "#555"
            }}>
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={loading} style={{
              flex: 2, padding: "11px 0", borderRadius: 8, border: "none",
              background: loading ? "#aaa" : TEAL, color: "#fff",
              cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15
            }}>
              {loading ? "Enregistrement…" : "Enregistrer le plein"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ HISTORIQUE ══════════ */}
      {vue === "historique" && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <h3 style={{ margin: "0 0 16px", color: TEAL_DARK }}>
            Historique des pleins {pleins.length > 0 && `(${pleins.length})`}
          </h3>

          {fetchLoading ? (
            <div style={{ textAlign: "center", padding: 30, color: GRAY }}>Chargement…</div>
          ) : pleins.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: GRAY }}>Aucun plein enregistré.</div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: TEAL }}>
                      {["Date", "Km", "Montant", "Prix/L", "Litres", "Conducteur", "Commentaire"].map((h) => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pleins.map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : LIGHT_BG }}>
                        <td style={tdStyle}>{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                        <td style={tdStyle}>{p.kilometrage?.toLocaleString("fr-FR")} km</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: TEAL_DARK }}>{p.montant?.toFixed(2)} €</td>
                        <td style={tdStyle}>{p.prixLitre?.toFixed(3)} €</td>
                        <td style={tdStyle}>{p.litres?.toFixed(2)} L</td>
                        <td style={tdStyle}>{p.conducteur}</td>
                        <td style={{ ...tdStyle, color: GRAY, fontStyle: p.commentaire ? "normal" : "italic" }}>
                          {p.commentaire || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, textAlign: "right", fontWeight: 700, color: TEAL_DARK, fontSize: 15 }}>
                Total général : {totalGeneral.toFixed(2)} €
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db",
  fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
};

const tdStyle = {
  padding: "9px 12px", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap"
};
