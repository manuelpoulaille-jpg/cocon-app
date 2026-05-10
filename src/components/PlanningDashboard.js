import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

// Couleurs attribuées aux collaborateurs
const TECH_COLORS = [
  "#35B499",
  "#E8845C",
  "#5C8EE8",
  "#E85C9A",
  "#8E5CE8",
  "#C8A84B",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d.toLocaleDateString("fr-CA", { timeZone: "America/Martinique" }); // YYYY-MM-DD

const fmtDayLabel = (d) =>
  d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "America/Martinique",
  });

const getWeekDays = () => {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Martinique" })
  );
  const day = today.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const statutBg = (s) =>
  ({ planifié: "#d4f0ea", "en cours": "#e8c9b8", terminé: "#35B499" }[s] ||
  "#eee");
const statutFg = (s) =>
  ({
    planifié: "#1a7a65",
    "en cours": "#6b4a31",
    terminé: "white",
  }[s] || "#333");

const TYPES_INTERVENTION = [
  "Dératisation",
  "Désinsectisation",
  "Désinfection",
  "Anti-termites",
  "Anti-chauves-souris",
  "Étanchéité",
  "Rénovation toiture",
  "Autre",
];

// ── Composant principal ───────────────────────────────────────────────────────

export default function PlanningDashboard({ user, isAdmin: isAdminProp }) {
  // isAdminProp peut être passé directement depuis AdminDashboard (toujours true)
  // Sinon, déduire depuis user.role pour une utilisation future dans TechDashboard
  const isAdmin = isAdminProp !== undefined ? isAdminProp : user?.role === "admin";

  const [weekDays] = useState(getWeekDays());
  const [bons, setBons] = useState([]);
  const [indispos, setIndispos] = useState([]);
  const [techColors, setTechColors] = useState({});
  const [filterTech, setFilterTech] = useState("tous");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Formulaire création rapide
  const [quickFormDate, setQuickFormDate] = useState(null);
  const [form, setForm] = useState({});

  // Formulaire indisponibilité
  const [indispoFormOpen, setIndispoFormOpen] = useState(false);
  const [indispoData, setIndispoData] = useState({
    techNom: "",
    dateDebut: "",
    dateFin: "",
    motif: "Congé",
  });

  useEffect(() => {
    fetchData();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    const weekStart = fmtDate(weekDays[0]);
    const weekEnd = fmtDate(weekDays[6]);

    try {
      // Bons de la semaine
      const bonsSnap = await getDocs(collection(db, "bons"));
      const allBons = bonsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const weekBons = allBons.filter(
        (b) => b.datePrevue >= weekStart && b.datePrevue <= weekEnd
      );
      setBons(weekBons);

      // Couleurs par technicien
      const names = [...new Set(weekBons.map((b) => b.techNom).filter(Boolean))];
      const colors = {};
      names.forEach((name, i) => {
        colors[name] = TECH_COLORS[i % TECH_COLORS.length];
      });
      setTechColors(colors);

      // Indisponibilités
      const indisposSnap = await getDocs(collection(db, "indispos"));
      setIndispos(
        indisposSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    } catch (e) {
      console.error("Planning fetchData error:", e);
    }
    setLoading(false);
  };

  // ── Données dérivées ───────────────────────────────────────────────────────

  const techList = [...new Set(bons.map((b) => b.techNom).filter(Boolean))];

  const getBonsForDay = (day) => {
    const dateStr = fmtDate(day);
    return bons
      .filter(
        (b) =>
          b.datePrevue === dateStr &&
          (filterTech === "tous" || b.techNom === filterTech)
      )
      .sort((a, b) => (a.heurePrevue || "").localeCompare(b.heurePrevue || ""));
  };

  const getIndisposForDay = (day) => {
    const dateStr = fmtDate(day);
    return indispos.filter(
      (i) =>
        i.dateDebut <= dateStr &&
        i.dateFin >= dateStr &&
        (filterTech === "tous" || i.techNom === filterTech)
    );
  };

  const isToday = (day) => fmtDate(day) === fmtDate(new Date());

  const totalWeek = bons.filter(
    (b) => filterTech === "tous" || b.techNom === filterTech
  ).length;

  const totalTermines = bons.filter(
    (b) =>
      b.statut === "terminé" &&
      (filterTech === "tous" || b.techNom === filterTech)
  ).length;

  // ── Actions ────────────────────────────────────────────────────────────────

  const createQuickBon = async () => {
    if (!form.clientNom || !form.type || !form.techNom) return;
    setSaving(true);
    try {
      const ref = "INT-" + Date.now().toString().slice(-6);
      await addDoc(collection(db, "bons"), {
        ref,
        clientNom: form.clientNom || "",
        clientPrenom: form.clientPrenom || "",
        clientTel: form.clientTel || "",
        clientEmail: form.clientEmail || "",
        clientAdresse: "",
        adresseFacturation: "",
        adresseIntervention: "",
        type: form.type,
        datePrevue: quickFormDate,
        heurePrevue: form.heurePrevue || "08:00",
        techNom: form.techNom,
        techId: "",
        statut: "planifié",
        demandeClient: form.demandeClient || "",
        obsCocon: "",
        obsClient: "",
      });
      setQuickFormDate(null);
      setForm({});
      await fetchData();
    } catch (e) {
      console.error("Erreur création bon:", e);
    }
    setSaving(false);
  };

  const createIndispo = async () => {
    if (!indispoData.techNom || !indispoData.dateDebut || !indispoData.dateFin)
      return;
    setSaving(true);
    try {
      await addDoc(collection(db, "indispos"), indispoData);
      setIndispoFormOpen(false);
      setIndispoData({ techNom: "", dateDebut: "", dateFin: "", motif: "Congé" });
      await fetchData();
    } catch (e) {
      console.error("Erreur création indispo:", e);
    }
    setSaving(false);
  };

  const deleteIndispo = async (id) => {
    try {
      await deleteDoc(doc(db, "indispos", id));
      await fetchData();
    } catch (e) {
      console.error("Erreur suppression indispo:", e);
    }
  };

  // ── Styles partagés ────────────────────────────────────────────────────────

  const selectStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 8,
    background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Formulaire création rapide
  // ══════════════════════════════════════════════════════════════════════════

  if (quickFormDate) {
    const dateLabel = new Date(quickFormDate + "T12:00:00").toLocaleDateString(
      "fr-FR",
      { weekday: "long", day: "numeric", month: "long" }
    );
    const canSubmit = form.clientNom && form.type && form.techNom;

    return (
      <div className="container">
        <div className="page-header">
          <button
            className="btn-back"
            onClick={() => {
              setQuickFormDate(null);
              setForm({});
            }}
          >
            ← Retour
          </button>
          <h2>Nouveau bon</h2>
        </div>

        <div
          style={{
            background: "#35B499",
            color: "white",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            textTransform: "capitalize",
          }}
        >
          📅 {dateLabel}
        </div>

        <div className="card">
          <div className="card-title">Client</div>
          {[
            ["clientNom", "Nom *", "text"],
            ["clientPrenom", "Prénom", "text"],
            ["clientTel", "Téléphone", "tel"],
            ["clientEmail", "Email", "email"],
          ].map(([key, label, type]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                type={type}
                value={form[key] || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Intervention</div>

          <div className="field">
            <label>Type *</label>
            <select
              style={selectStyle}
              value={form.type || ""}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">Choisir un type…</option>
              {TYPES_INTERVENTION.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Heure prévue</label>
            <input
              type="time"
              value={form.heurePrevue || "08:00"}
              onChange={(e) =>
                setForm((f) => ({ ...f, heurePrevue: e.target.value }))
              }
            />
          </div>

          <div className="field">
            <label>Collaborateur *</label>
            <select
              style={selectStyle}
              value={form.techNom || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, techNom: e.target.value }))
              }
            >
              <option value="">Choisir…</option>
              <option value="Equipe">Equipe</option>
              {techList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Demande client</label>
            <textarea
              value={form.demandeClient || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, demandeClient: e.target.value }))
              }
              placeholder="Description de l'intervention…"
              rows={3}
            />
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", opacity: canSubmit ? 1 : 0.4 }}
          disabled={saving || !canSubmit}
          onClick={createQuickBon}
        >
          {saving ? "Création…" : "✅ Créer le bon"}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Formulaire indisponibilité
  // ══════════════════════════════════════════════════════════════════════════

  if (indispoFormOpen) {
    const canSubmit =
      indispoData.techNom && indispoData.dateDebut && indispoData.dateFin;

    return (
      <div className="container">
        <div className="page-header">
          <button className="btn-back" onClick={() => setIndispoFormOpen(false)}>
            ← Retour
          </button>
          <h2>Indisponibilité</h2>
        </div>

        <div className="card">
          <div className="field">
            <label>Collaborateur *</label>
            <select
              style={selectStyle}
              value={indispoData.techNom}
              onChange={(e) =>
                setIndispoData((d) => ({ ...d, techNom: e.target.value }))
              }
            >
              <option value="">Choisir…</option>
              {techList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Du *</label>
            <input
              type="date"
              value={indispoData.dateDebut}
              onChange={(e) =>
                setIndispoData((d) => ({ ...d, dateDebut: e.target.value }))
              }
            />
          </div>

          <div className="field">
            <label>Au *</label>
            <input
              type="date"
              value={indispoData.dateFin}
              min={indispoData.dateDebut}
              onChange={(e) =>
                setIndispoData((d) => ({ ...d, dateFin: e.target.value }))
              }
            />
          </div>

          <div className="field">
            <label>Motif</label>
            <select
              style={selectStyle}
              value={indispoData.motif}
              onChange={(e) =>
                setIndispoData((d) => ({ ...d, motif: e.target.value }))
              }
            >
              {["Congé", "Maladie", "Formation", "Autre"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Indispos existantes cette semaine */}
        {indispos.length > 0 && (
          <div className="card">
            <div className="card-title">Indisponibilités en cours</div>
            {indispos.map((i) => (
              <div
                key={i.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {i.techNom}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {i.motif} · {i.dateDebut}
                    {i.dateDebut !== i.dateFin ? ` → ${i.dateFin}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => deleteIndispo(i.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#e74c3c",
                    fontSize: 16,
                    padding: "4px 8px",
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: "100%", opacity: canSubmit ? 1 : 0.4 }}
          disabled={saving || !canSubmit}
          onClick={createIndispo}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VUE : Planning semaine
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="container">
      {/* ── En-tête ── */}
      <div className="page-header">
        <h2>Planning — Semaine en cours</h2>
      </div>

      {/* ── Résumé semaine ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          { label: "Total", value: totalWeek, color: "#35B499" },
          {
            label: "Terminés",
            value: totalTermines,
            color: "#35B499",
          },
          {
            label: "Restants",
            value: totalWeek - totalTermines,
            color: "#E8845C",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "var(--color-background-secondary)",
              borderRadius: 10,
              padding: "10px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 22,
                fontWeight: 800,
                color,
                lineHeight: 1.1,
              }}
            >
              {value}
            </p>
            <p
              style={{ fontSize: 11, color: "var(--color-text-secondary)" }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filtre techniciens ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 16,
          scrollbarWidth: "none",
        }}
      >
        {["tous", ...techList].map((t) => {
          const active = filterTech === t;
          const color =
            t === "tous" ? "#35B499" : techColors[t] || "#35B499";
          return (
            <button
              key={t}
              onClick={() => setFilterTech(t)}
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                borderRadius: 20,
                border: active ? "none" : "0.5px solid var(--color-border-tertiary)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                background: active ? color : "var(--color-background-primary)",
                color: active ? "white" : "var(--color-text-secondary)",
                transition: "all .15s",
              }}
            >
              {t === "tous" ? "👥 Tous" : t}
            </button>
          );
        })}
      </div>

      {/* ── Chargement ── */}
      {loading && (
        <p
          style={{
            textAlign: "center",
            color: "var(--color-text-secondary)",
            fontSize: 13,
            padding: "2rem 0",
          }}
        >
          Chargement…
        </p>
      )}

      {/* ── Jours de la semaine ── */}
      {!loading &&
        weekDays.map((day) => {
          const dayBons = getBonsForDay(day);
          const dayIndispos = getIndisposForDay(day);
          const today = isToday(day);
          const dateStr = fmtDate(day);
          const isEmpty = dayBons.length === 0 && dayIndispos.length === 0;

          return (
            <div key={dateStr} style={{ marginBottom: 12 }}>
              {/* En-tête du jour */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 14px",
                  borderRadius: 10,
                  background: today
                    ? "#35B499"
                    : "var(--color-background-secondary)",
                  color: today ? "white" : "var(--color-text-secondary)",
                  marginBottom: dayBons.length > 0 || dayIndispos.length > 0 ? 6 : 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    textTransform: "capitalize",
                  }}
                >
                  {today ? "📍 " : ""}
                  {fmtDayLabel(day)}
                </span>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {dayBons.length > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        background: today
                          ? "rgba(255,255,255,0.25)"
                          : "var(--color-border-tertiary)",
                        padding: "2px 8px",
                        borderRadius: 10,
                        color: today ? "white" : "var(--color-text-secondary)",
                      }}
                    >
                      {dayBons.length} bon{dayBons.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setQuickFormDate(dateStr)}
                      style={{
                        background: today
                          ? "rgba(255,255,255,0.25)"
                          : "var(--color-background-primary)",
                        border: today
                          ? "none"
                          : "0.5px solid var(--color-border-tertiary)",
                        borderRadius: 8,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                        color: today ? "white" : "var(--color-text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      + Ajouter
                    </button>
                  )}
                </div>
              </div>

              {/* Indisponibilités */}
              {dayIndispos.map((i) => (
                <div
                  key={i.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--color-background-secondary)",
                    border: "1px dashed var(--color-border-tertiary)",
                    marginBottom: 5,
                    opacity: 0.8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    🚫{" "}
                    <b style={{ color: "var(--color-text-primary)" }}>
                      {i.techNom}
                    </b>{" "}
                    — {i.motif}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => deleteIndispo(i.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#e74c3c",
                        fontSize: 14,
                        padding: "0 4px",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {/* Bons d'intervention */}
              {dayBons.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    marginBottom: 5,
                    background: "var(--color-background-primary)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    borderLeft: `4px solid ${
                      techColors[b.techNom] || "#35B499"
                    }`,
                  }}
                >
                  {/* Heure */}
                  <div
                    style={{
                      minWidth: 40,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: techColors[b.techNom] || "#35B499",
                      }}
                    >
                      {b.heurePrevue || "—"}
                    </span>
                  </div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--color-text-primary)",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.clientNom} {b.clientPrenom}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {b.type}
                      </span>
                      {filterTech === "tous" && b.techNom && (
                        <span
                          style={{
                            fontSize: 11,
                            color: techColors[b.techNom] || "#35B499",
                            fontWeight: 600,
                          }}
                        >
                          · {b.techNom}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Statut */}
                  <span
                    style={{
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 12,
                      flexShrink: 0,
                      background: statutBg(b.statut),
                      color: statutFg(b.statut),
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {b.statut}
                  </span>
                </div>
              ))}

              {/* Jour vide — message discret */}
              {isEmpty && (
                <div
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    fontStyle: "italic",
                    opacity: 0.6,
                  }}
                >
                  Aucune intervention
                </div>
              )}
            </div>
          );
        })}

      {/* ── Bouton indisponibilités (Admin) ── */}
      {isAdmin && !loading && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "0.5px solid var(--color-border-tertiary)",
          }}
        >
          <button
            className="btn-outline"
            style={{ width: "100%" }}
            onClick={() => setIndispoFormOpen(true)}
          >
            🚫 Gérer les indisponibilités
          </button>
        </div>
      )}
    </div>
  );
}
