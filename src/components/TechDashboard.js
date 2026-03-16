import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection, query, where, getDocs, doc, updateDoc, Timestamp
} from "firebase/firestore";
import { jsPDF } from "jspdf";

export default function TechDashboard({ user }) {
  const [bons, setBons] = useState([]);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [obsCocon, setObsCocon] = useState("");
  const [obsClient, setObsClient] = useState("");
  const [saving, setSaving] = useState(false);
  const [sigMode, setSigMode] = useState(null); // "tech" | "client"
  const [sigTech, setSigTech] = useState(null);
  const [sigClient, setSigClient] = useState(null);
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => { fetchBons(); }, []);

  const fetchBons = async () => {
    const today = new Date().toISOString().split("T")[0];
    const q = query(collection(db, "bons"), where("techId", "==", user.uid));
    const snap = await getDocs(q);
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
    setBons(all.filter(b => b.datePrevue === today));
  };

  const openBon = (b) => {
    setSelected(b);
    setObsCocon(b.obsCocon || "");
    setObsClient(b.obsClient || "");
    setSigTech(b.signatureTech || null);
    setSigClient(b.signatureClient || null);
    setView("bon");
  };

  const arriver = async () => {
    setSaving(true);
    await updateDoc(doc(db, "bons", selected.id), {
      heureArrivee: Timestamp.now(),
      statut: "en cours"
    });
    const updated = { ...selected, heureArrivee: Timestamp.now(), statut: "en cours" };
    setSelected(updated);
    fetchBons();
    setSaving(false);
  };

  const terminer = async () => {
    setSaving(true);
    await updateDoc(doc(db, "bons", selected.id), {
      heureFin: Timestamp.now(),
      statut: "terminé",
      obsCocon,
      obsClient,
      signatureTech: sigTech,
      signatureClient: sigClient,
    });
    const updated = { ...selected, heureFin: Timestamp.now(), statut: "terminé" };
    setSelected(updated);
    fetchBons();
    setSaving(false);
    generatePDF({ ...selected, heureFin: Timestamp.now(), statut: "terminé", obsCocon, obsClient, signatureTech: sigTech, signatureClient: sigClient });
  };

  const sauvegarder = async () => {
    setSaving(true);
    await updateDoc(doc(db, "bons", selected.id), { obsCocon, obsClient, signatureTech: sigTech, signatureClient: sigClient });
    setSaving(false);
  };

  // Signature canvas
  const startSig = (mode) => {
    setSigMode(mode);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - r.left) * (canvas.width / r.width), y: (src.clientY - r.top) * (canvas.height / r.height) };
      };
      canvas.onmousedown = canvas.ontouchstart = (e) => { e.preventDefault(); drawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      canvas.onmousemove = canvas.ontouchmove = (e) => { e.preventDefault(); if (!drawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      canvas.onmouseup = canvas.ontouchend = () => { drawing.current = false; };
    }, 100);
  };

  const saveSig = () => {
    const canvas = canvasRef.current;
    const data = canvas.toDataURL("image/png");
    if (sigMode === "tech") setSigTech(data);
    else setSigClient(data);
    setSigMode(null);
  };

  const generatePDF = (bon) => {
    const { jsPDF: PDF } = window.jspdf || {};
    const doc2 = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, ml = 15, mr = 195;

    doc2.setFillColor(53, 180, 153);
    doc2.rect(0, 0, W, 28, "F");
    doc2.setTextColor(255, 255, 255);
    doc2.setFontSize(16); doc2.setFont("helvetica", "bold");
    doc2.text("BON D'INTERVENTION", ml, 12);
    doc2.setFontSize(9); doc2.setFont("helvetica", "normal");
    doc2.text("Cocon+ — 0596 73 66 66 | www.cocon-plus.fr", ml, 20);
    doc2.text("N° " + bon.ref, mr, 12, { align: "right" });
    doc2.text("Le " + new Date().toLocaleDateString("fr-FR"), mr, 20, { align: "right" });

    let y = 35;
    const section = (title) => {
      doc2.setTextColor(53, 180, 153); doc2.setFontSize(9); doc2.setFont("helvetica", "bold");
      doc2.text(title, ml, y); y += 3;
      doc2.setDrawColor(53, 180, 153); doc2.line(ml, y, mr, y); y += 5;
      doc2.setTextColor(60, 60, 60); doc2.setFont("helvetica", "normal"); doc2.setFontSize(10);
    };
    const row = (label, val) => { doc2.text(label + " : " + (val || "—"), ml, y); y += 6; };

    section("TECHNICIEN"); row("Nom", bon.techNom); y += 2;
    section("CLIENT");
    row("Nom", bon.clientNom + " " + bon.clientPrenom);
    row("Téléphone", bon.clientTel); row("Email", bon.clientEmail);
    row("Adresse", bon.clientAdresse); y += 2;
    section("INTERVENTION");
    row("Type", bon.type);
    row("Prévu le", bon.datePrevue + " à " + bon.heurePrevue);
    row("Arrivée réelle", bon.heureArrivee ? new Date(bon.heureArrivee.toDate()).toLocaleString("fr-FR") : "—");
    row("Fin intervention", bon.heureFin ? new Date(bon.heureFin.toDate()).toLocaleString("fr-FR") : "—"); y += 2;
    section("OBSERVATIONS");
    const obsC = doc2.splitTextToSize("Cocon+ : " + (bon.obsCocon || "—"), 175);
    doc2.text(obsC, ml, y); y += obsC.length * 5 + 3;
    const obsCl = doc2.splitTextToSize("Client : " + (bon.obsClient || "—"), 175);
    doc2.text(obsCl, ml, y); y += obsCl.length * 5 + 5;
    section("SIGNATURES");
    doc2.setFontSize(9); doc2.text("Technicien", ml, y); doc2.text("Client", ml + 90, y); y += 3;
    if (bon.signatureTech) { try { doc2.addImage(bon.signatureTech, "PNG", ml, y, 80, 30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml, y, 80, 30); }
    if (bon.signatureClient) { try { doc2.addImage(bon.signatureClient, "PNG", ml + 90, y, 80, 30); } catch(e){} }
    else { doc2.setDrawColor(200,200,200); doc2.rect(ml + 90, y, 80, 30); }
    y += 40;
    doc2.setFontSize(8); doc2.setTextColor(150,150,150);
    doc2.text("Cocon Plus SARL — Berges de Kerlys, 97200 Fort-de-France — SIRET : 47756829900028", W/2, 285, { align: "center" });

    doc2.save("bon-" + bon.ref + ".pdf");
  };

  const statutColor = (s) => ({ "planifié":"#E1F5EE","en cours":"#FFF3CD","terminé":"#D4EDDA" }[s] || "#eee");
  const statutText = (s) => ({ "planifié":"#085041","en cours":"#856404","terminé":"#155724" }[s] || "#333");
  const fmt = (ts) => ts ? new Date(ts.toDate()).toLocaleString("fr-FR") : "—";

  if (sigMode) return (
    <div className="container">
      <div className="page-header">
        <h2>Signature — {sigMode === "tech" ? "Technicien" : "Client"}</h2>
      </div>
      <div className="card" style={{textAlign:"center"}}>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12}}>Signez dans le cadre ci-dessous</p>
        <canvas ref={canvasRef} width={560} height={200} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,width:"100%",touchAction:"none",background:"white"}} />
        <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center"}}>
          <button className="btn-outline" onClick={() => setSigMode(null)}>Annuler</button>
          <button className="btn-primary" onClick={saveSig}>Valider la signature</button>
        </div>
      </div>
    </div>
  );

  if (view === "bon" && selected) return (
    <div className="container">
      <div className="page-header">
        <button className="btn-back" onClick={() => setView("list")}>← Retour</button>
        <h2>{selected.ref}</h2>
        <span className="badge" style={{background:statutColor(selected.statut),color:statutText(selected.statut)}}>{selected.statut}</span>
      </div>

      <div className="card readonly">
        <div className="card-title">Client <span className="locked-badge">🔒 Admin</span></div>
        <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
        <div className="info-row"><span>Téléphone</span><b>{selected.clientTel || "—"}</b></div>
        <div className="info-row"><span>Email</span><b>{selected.clientEmail || "—"}</b></div>
        <div className="info-row"><span>Adresse</span><b>{selected.clientAdresse}</b></div>
      </div>

      <div className="card readonly">
        <div className="card-title">Intervention <span className="locked-badge">🔒 Admin</span></div>
        <div className="info-row"><span>Type</span><b>{selected.type}</b></div>
        <div className="info-row"><span>Prévu le</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
        <div className="info-row"><span>Technicien</span><b>{selected.techNom}</b></div>
      </div>

      <div className="card">
        <div className="card-title">Suivi temps réel</div>
        <div className="info-row"><span>Arrivée réelle</span><b>{fmt(selected.heureArrivee)}</b></div>
        <div className="info-row"><span>Fin intervention</span><b>{fmt(selected.heureFin)}</b></div>
        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          {selected.statut === "planifié" && (
            <button className="btn-arrive" disabled={saving} onClick={arriver}>
              📍 Arrivé sur le chantier
            </button>
          )}
          {selected.statut === "en cours" && (
            <button className="btn-finish" disabled={saving} onClick={terminer}>
              ✅ Terminer le chantier
            </button>
          )}
          {selected.statut === "terminé" && (
            <button className="btn-primary sm" onClick={() => generatePDF(selected)}>
              📄 Télécharger le PDF
            </button>
          )}
        </div>
      </div>

      {selected.statut !== "planifié" && (
        <>
          <div className="card">
            <div className="card-title">Observations</div>
            <div className="field" style={{marginBottom:12}}>
              <label>Commentaires Cocon+</label>
              <textarea value={obsCocon} onChange={e=>setObsCocon(e.target.value)} placeholder="Travaux réalisés, constats…" disabled={selected.statut === "terminé"} />
            </div>
            <div className="field">
              <label>Commentaires client</label>
              <textarea value={obsClient} onChange={e=>setObsClient(e.target.value)} placeholder="Retour du client…" disabled={selected.statut === "terminé"} />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Signatures</div>
            <div className="row2">
              <div>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>Technicien</p>
                {sigTech ? <img src={sigTech} alt="sig" style={{width:"100%",height:70,objectFit:"contain",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}} /> : <div className="sig-placeholder-sm">Non signé</div>}
                {selected.statut !== "terminé" && <button className="btn-outline sm" style={{marginTop:6}} onClick={()=>startSig("tech")}>Signer</button>}
              </div>
              <div>
                <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:6}}>Client</p>
                {sigClient ? <img src={sigClient} alt="sig" style={{width:"100%",height:70,objectFit:"contain",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}} /> : <div className="sig-placeholder-sm">Non signé</div>}
                {selected.statut !== "terminé" && <button className="btn-outline sm" style={{marginTop:6}} onClick={()=>startSig("cli")}>Signer</button>}
              </div>
            </div>
          </div>

          {selected.statut !== "terminé" && (
            <button className="btn-outline" style={{width:"100%"}} disabled={saving} onClick={sauvegarder}>
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="container">
      <div className="page-header"><h2>Mes interventions</h2></div>
      {bons.length === 0 ? (
        <div className="empty-state">Aucun bon assigné pour l'instant.</div>
      ) : (
        bons.map(b => (
          <div key={b.id} className="bon-card" onClick={() => openBon(b)}>
            <div className="bon-card-top">
              <span className="bon-ref">{b.ref}</span>
              <span className="badge" style={{background:statutColor(b.statut),color:statutText(b.statut)}}>{b.statut}</span>
            </div>
            <div className="bon-card-body">
              <b>{b.clientNom} {b.clientPrenom}</b>
              <span>{b.type}</span>
            </div>
            <div className="bon-card-footer">
              <span>Prévu : {b.datePrevue} à {b.heurePrevue}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
