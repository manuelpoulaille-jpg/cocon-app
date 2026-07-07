import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// FacturationModule — Vue d'ensemble de la facturation (Cocon+)
// Reçoit les bons déjà chargés par AdminDashboard (pas de fetch propre)
// Le champ montantPaye est dénormalisé sur chaque bon (mis à jour depuis
// la vue détail à chaque ajout/suppression de paiement dans la sous-collection
// bons/{id}/paiements).
// ─────────────────────────────────────────────────────────────────────────────

const normFacture = (s) => {
  if (!s) return "à facturer";
  const map = { a_facturer: "à facturer", facture: "facturé", paye: "payé", payee: "payé" };
  return map[s] || s;
};

const styleFacture = (s) =>
  ({
    "à facturer": { background: "#fdecea", color: "#c0392b", border: "0.5px solid #f0b8b0" },
    "facturé": { background: "#fdf2d8", color: "#8a6d1f", border: "0.5px solid #e6cf8a" },
    "payé partiellement": { background: "#fde9d0", color: "#b5620a", border: "0.5px solid #f0c48a" },
    "payé": { background: "#e1f5ee", color: "#0e6b50", border: "0.5px solid #a0dece" },
  }[normFacture(s)]);

const STATUTS = ["à facturer", "facturé", "payé partiellement", "payé"];

export default function FacturationModule({ bons = [], onOpenBon }) {
  const [filter, setFilter] = useState("tous");
  const [search, setSearch] = useState("");

  // On ne considère que les bons ayant un montant facturé renseigné
  const bonsFactures = bons.filter((b) => b.montantFacture && parseFloat(b.montantFacture) > 0);

  const enrichis = bonsFactures.map((b) => {
    const montantDu = parseFloat(b.montantFacture) || 0;
    const montantPaye = parseFloat(b.montantPaye) || 0;
    const resteDu = montantDu - montantPaye;
    return { ...b, montantDu, montantPaye, resteDu };
  });

  const totaux = enrichis.reduce(
    (acc, b) => ({
      facture: acc.facture + b.montantDu,
      encaisse: acc.encaisse + b.montantPaye,
      resteDu: acc.resteDu + Math.max(b.resteDu, 0),
    }),
    { facture: 0, encaisse: 0, resteDu: 0 }
  );

  const aFacturerCount = enrichis.filter((b) => normFacture(b.statutFacture) === "à facturer").length;

  const filtered = enrichis.filter((b) => {
    const okFilter = filter === "tous" || normFacture(b.statutFacture) === filter;
    const q = search.toLowerCase();
    const okSearch =
      !q ||
      (b.clientNom + " " + b.clientPrenom).toLowerCase().includes(q) ||
      b.ref?.toLowerCase().includes(q) ||
      b.clientSociete?.toLowerCase().includes(q);
    return okFilter && okSearch;
  }).sort((a, b) => (b.datePrevue || "").localeCompare(a.datePrevue || ""));

  const kpiStyle = { background: "white", borderRadius: 10, padding: "13px 15px", border: "0.5px solid #e0ddd8", position: "relative", overflow: "hidden" };
  const accentStyle = (color) => ({ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color });

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>Facturation</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        <div style={kpiStyle}>
          <div style={accentStyle("#35B499")} />
          <p style={{ fontSize: 9.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px", fontWeight: 500 }}>Total facturé</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{totaux.facture.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
        </div>
        <div style={kpiStyle}>
          <div style={accentStyle("#0e6b50")} />
          <p style={{ fontSize: 9.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px", fontWeight: 500 }}>Encaissé</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#0e6b50", margin: 0 }}>{totaux.encaisse.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
        </div>
        <div style={kpiStyle}>
          <div style={accentStyle("#c0392b")} />
          <p style={{ fontSize: 9.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px", fontWeight: 500 }}>Reste dû</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: totaux.resteDu > 0.01 ? "#c0392b" : "#1a1a1a", margin: 0 }}>{totaux.resteDu.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
        </div>
        <div style={kpiStyle}>
          <div style={accentStyle("#8B6A4E")} />
          <p style={{ fontSize: 9.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px", fontWeight: 500 }}>À facturer</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{aFacturerCount}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setFilter("tous")}
          style={{
            fontSize: 11, padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 500,
            border: filter === "tous" ? "none" : "0.5px solid #e0ddd8",
            background: filter === "tous" ? "#35B499" : "white",
            color: filter === "tous" ? "white" : "#555",
          }}
        >
          Tous ({enrichis.length})
        </button>
        {STATUTS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "tous" : s)}
            style={{
              fontSize: 11, padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 500,
              border: filter === s ? "none" : "0.5px solid #e0ddd8",
              ...(filter === s ? styleFacture(s) : { background: "white", color: "#555" }),
            }}
          >
            {s} ({enrichis.filter((b) => normFacture(b.statutFacture) === s).length})
          </button>
        ))}
        <input
          type="text"
          placeholder="Rechercher client, référence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: "auto", padding: "7px 14px", fontSize: 12, border: "0.5px solid #e0ddd8", borderRadius: 8, minWidth: 200 }}
        />
      </div>

      <div style={{ background: "white", borderRadius: 10, border: "0.5px solid #e0ddd8", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
            <thead>
              <tr>
                {["Réf.", "Date", "Client", "Dû", "Payé", "Reste dû", "Statut", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 9.5, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, padding: "8px 12px", borderBottom: "0.5px solid #e8e5e0", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "20px 14px", fontSize: 13, color: "#aaa", textAlign: "center" }}>Aucun bon facturé trouvé.</td></tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} onClick={() => onOpenBon && onOpenBon(b)} style={{ cursor: onOpenBon ? "pointer" : "default" }}>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8" }}><span style={{ fontSize: 11, color: "#35B499", fontWeight: 600 }}>{b.ref}</span></td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8", fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{b.datePrevue}</td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8" }}>
                      {b.clientSociete && <span style={{ display: "block", fontSize: 10, color: "#35B499", fontWeight: 600 }}>{b.clientSociete}</span>}
                      <span style={{ fontWeight: 500 }}>{b.clientNom} {b.clientPrenom}</span>
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8", fontWeight: 500 }}>{b.montantDu.toFixed(2)} €</td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8", color: "#0e6b50", fontWeight: 500 }}>{b.montantPaye.toFixed(2)} €</td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8", color: b.resteDu > 0.01 ? "#c0392b" : "#0e6b50", fontWeight: 600 }}>{b.resteDu.toFixed(2)} €</td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8" }}>
                      <span style={{ ...styleFacture(b.statutFacture), fontSize: 10, fontWeight: 500, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-block" }}>
                        {normFacture(b.statutFacture)}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", borderBottom: "0.5px solid #f0ede8" }}>
                      {onOpenBon && <span style={{ fontSize: 11, color: "#35B499", fontWeight: 500 }}>Voir →</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
