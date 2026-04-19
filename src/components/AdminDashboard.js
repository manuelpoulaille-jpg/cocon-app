import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  Timestamp, doc, updateDoc, deleteDoc,
} from "firebase/firestore";
import logoBase64 from "../logoBase64";
import ContratModule from "./ContratModule";
import CarburantModule from "./CarburantModule";

const TYPES = [
  "Désinsectisation", "Dératisation", "Traitement anti-termites",
  "Traitement anti-chauves-souris", "Désinfection", "Étanchéité / Toiture",
];
const DRIVE_WEBHOOK = "https://script.google.com/macros/s/AKfycbza4QR7FaxPNlYv_cFeOEhoRJfKX_HQzH2NSaKsX-lSZNZSMb-_ikfUKxzUZeb5S0J1/exec";
const EMPTY_FORM = {
  clientSociete:"",clientNom:"",clientPrenom:"",clientTel:"",clientEmail:"",
  adresseFacturation:"",adresseIntervention:"",demandeClient:"",numDevis:"",signataire:"",
  types:[],datePrevue:"",heurePrevue:"",techId:"",numVisite:"1",montantFacture:"",
};
const SCOPED_CSS = `
.ca-root{display:flex!important;height:100vh!important;overflow:hidden!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;background:#f0ede8!important}
.ca-sidebar{width:210px!important;min-width:210px!important;background:#111d1b!important;display:flex!important;flex-direction:column!important;height:100vh!important;overflow-y:auto!important;flex-shrink:0!important;z-index:10!important}
.ca-logo-area{padding:20px 18px 16px!important;border-bottom:0.5px solid rgba(255,255,255,0.07)!important}
.ca-logo-mark{font-size:22px!important;font-weight:700!important;color:#35B499!important;letter-spacing:-0.5px!important;line-height:1!important;margin:0!important}
.ca-logo-sub{font-size:9px!important;color:rgba(255,255,255,0.28)!important;letter-spacing:2px!important;text-transform:uppercase!important;margin-top:3px!important}
.ca-nav{flex:1!important;padding:10px 0!important}
.ca-nav-sec{font-size:9px!important;color:rgba(255,255,255,0.22)!important;letter-spacing:1.8px!important;text-transform:uppercase!important;padding:14px 18px 5px!important}
.ca-nav-item{display:flex!important;align-items:center!important;gap:9px!important;padding:9px 18px!important;font-size:12px!important;cursor:pointer!important;position:relative!important;color:rgba(255,255,255,0.42)!important;background:transparent!important;border:none!important;width:100%!important;text-align:left!important;box-shadow:none!important;border-radius:0!important;transition:color .15s!important}
.ca-nav-item:hover{color:rgba(255,255,255,0.7)!important;background:rgba(255,255,255,0.04)!important}
.ca-nav-item.active{color:white!important;background:rgba(53,180,153,0.12)!important}
.ca-nav-bar{position:absolute!important;left:0!important;top:2px!important;bottom:2px!important;width:2.5px!important;background:#35B499!important;border-radius:0 2px 2px 0!important}
.ca-nav-pip{width:5px!important;height:5px!important;border-radius:50%!important;flex-shrink:0!important}
.ca-nav-badge{margin-left:auto!important;background:#35B499!important;color:white!important;font-size:9px!important;font-weight:600!important;padding:1px 7px!important;border-radius:20px!important}
.ca-user-area{padding:12px 18px!important;border-top:0.5px solid rgba(255,255,255,0.07)!important;display:flex!important;align-items:center!important;gap:8px!important}
.ca-avatar{width:28px!important;height:28px!important;border-radius:50%!important;background:#8B6A4E!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:10px!important;color:white!important;font-weight:600!important;flex-shrink:0!important}
.ca-user-name{font-size:11px!important;color:rgba(255,255,255,0.65)!important;font-weight:500!important;margin:0!important}
.ca-user-role{font-size:9px!important;color:rgba(255,255,255,0.3)!important;margin:0!important}
.ca-main{flex:1!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;min-width:0!important}
.ca-topbar{height:48px!important;min-height:48px!important;background:white!important;border-bottom:0.5px solid #e0ddd8!important;display:flex!important;align-items:center!important;padding:0 24px!important;gap:0!important;flex-shrink:0!important;box-shadow:none!important}
.ca-topbar-title{font-size:14px!important;font-weight:600!important;color:#1a1a1a!important;margin:0!important;flex-shrink:0!important}
.ca-period-tabs{display:flex!important;gap:2px!important;margin-left:20px!important}
.ca-period-tab{font-size:12px!important;padding:5px 14px!important;border-radius:20px!important;cursor:pointer!important;color:#888!important;background:transparent!important;border:none!important;box-shadow:none!important;font-weight:400!important}
.ca-period-tab.active{background:#35B499!important;color:white!important;font-weight:500!important}
.ca-topbar-actions{margin-left:auto!important;display:flex!important;gap:8px!important;align-items:center!important}
.ca-btn{font-size:11px!important;padding:7px 14px!important;border-radius:8px!important;cursor:pointer!important;font-weight:500!important;border:none!important;line-height:1!important}
.ca-btn.teal{background:#35B499!important;color:white!important}
.ca-btn.outline{background:transparent!important;border:0.5px solid #ccc!important;color:#333!important}
.ca-btn.drive{background:#e8f5f3!important;color:#1f7a6e!important;border:0.5px solid #2a9d8f!important}
.ca-content{flex:1!important;overflow-y:auto!important;padding:22px 24px!important}
.ca-kpi-row{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:12px!important;margin-bottom:20px!important}
.ca-kpi{background:white!important;border-radius:10px!important;padding:14px 16px!important;border:0.5px solid #e0ddd8!important;position:relative!important;overflow:hidden!important;cursor:pointer!important;transition:box-shadow .15s!important}
.ca-kpi:hover{box-shadow:0 2px 12px rgba(0,0,0,0.07)!important}
.ca-kpi-accent{position:absolute!important;top:0!important;left:0!important;right:0!important;height:3px!important}
.ca-kpi-label{font-size:10px!important;color:#888!important;text-transform:uppercase!important;letter-spacing:1px!important;margin:0 0 6px!important;font-weight:500!important}
.ca-kpi-val{font-size:28px!important;font-weight:700!important;color:#1a1a1a!important;letter-spacing:-1px!important;margin:0!important;line-height:1!important}
.ca-actions{display:flex!important;gap:10px!important;margin-bottom:20px!important;flex-wrap:wrap!important}
.ca-panel{background:white!important;border-radius:10px!important;border:0.5px solid #e0ddd8!important;overflow:hidden!important;margin-bottom:14px!important}
.ca-panel-head{padding:12px 16px!important;border-bottom:0.5px solid #e8e5e0!important;display:flex!important;align-items:center!important;gap:8px!important}
.ca-panel-title{font-size:12px!important;font-weight:600!important;color:#1a1a1a!important;margin:0!important}
.ca-panel-count{font-size:11px!important;color:#888!important;margin-left:auto!important}
.ca-table-wrap{overflow-x:auto!important}
.ca-table{width:100%!important;border-collapse:collapse!important;font-size:12px!important}
.ca-table th{text-align:left!important;font-size:9.5px!important;font-weight:500!important;color:#888!important;text-transform:uppercase!important;letter-spacing:0.8px!important;padding:8px 14px!important;border-bottom:0.5px solid #e8e5e0!important;white-space:nowrap!important;background:white!important}
.ca-table td{padding:9px 14px!important;border-bottom:0.5px solid #f0ede8!important;color:#1a1a1a!important;vertical-align:middle!important}
.ca-table tr:last-child td{border-bottom:none!important}
.ca-table tr:hover td{background:#fafaf8!important;cursor:pointer!important}
.ca-ref{font-size:11px!important;color:#35B499!important;font-weight:600!important}
.ca-badge{font-size:10px!important;font-weight:500!important;padding:3px 9px!important;border-radius:20px!important;white-space:nowrap!important;display:inline-block!important}
.ca-badge.planifie{background:#e1f5ee!important;color:#0e6b50!important}
.ca-badge.encours{background:#f5e8d8!important;color:#6b4a31!important}
.ca-badge.termine{background:#35B499!important;color:white!important}
.ca-btn-pdf{font-size:10px!important;padding:4px 10px!important;border-radius:6px!important;cursor:pointer!important;background:#e1f5ee!important;color:#0e6b50!important;border:0.5px solid #a0dece!important;font-weight:500!important;margin-right:4px!important}
.ca-btn-wa{font-size:10px!important;padding:4px 10px!important;border-radius:6px!important;cursor:pointer!important;background:#e8f9ee!important;color:#1a7a45!important;border:0.5px solid #a0d8b0!important;font-weight:500!important}
.ca-empty{padding:20px 14px!important;font-size:13px!important;color:#aaa!important;text-align:center!important}
.ca-msg{background:#e8f5f3!important;color:#1a7a65!important;padding:10px 24px!important;font-size:13px!important;font-weight:500!important;border-bottom:0.5px solid #b2ddd5!important}
.ca-form-zone{padding:24px 28px!important;overflow-y:auto!important;flex:1!important}
.ca-drive-progress{margin-bottom:16px!important;padding:12px 16px!important;background:#e8f5f3!important;border-radius:10px!important;border:1px solid #2a9d8f!important}
`;

const scBadge=(s)=>s==="planifié"?"planifie":s==="en cours"?"encours":s==="terminé"?"termine":"";
const fmt=(ts)=>ts?new Date(ts.toDate()).toLocaleString("fr-FR"):"—";
const calcDuree=(a,f)=>{if(!a||!f)return"—";const d=f.toDate()-a.toDate();const h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000);return h>0?h+"h"+m.toString().padStart(2,"0"):m+" min";};
const fmtDate=(str)=>str?new Date(str+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}):"—";

export default function AdminDashboard({ user, onLogout }) {
  const [bons,setBons]=useState([]);
  const [view,setView]=useState("dashboard");
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [editForm,setEditForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const [driveProgress,setDriveProgress]=useState(null);
  const [driveSending,setDriveSending]=useState(false);
  const [period,setPeriod]=useState("jour");
  const [form,setForm]=useState({...EMPTY_FORM});
  const today=new Date().toLocaleDateString("fr-CA",{timeZone:"America/Martinique"});

  useEffect(()=>{
    const id="ca-scoped-styles";
    if(!document.getElementById(id)){const el=document.createElement("style");el.id=id;el.textContent=SCOPED_CSS;document.head.appendChild(el);}
  },[]);
  useEffect(()=>{fetchBons();},[]);

  const fetchBons=async()=>{const q=query(collection(db,"bons"),orderBy("createdAt","desc"));const snap=await getDocs(q);setBons(snap.docs.map(d=>({id:d.id,...d.data()})));};
  const refNum=()=>"INT-"+Date.now().toString().slice(-6);
  const flashMsg=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),4000);};

  const createBon=async(e)=>{
    e.preventDefault();if(!form.types.length){alert("Sélectionnez au moins un type");return;}
    setSaving(true);
    try{
      await addDoc(collection(db,"bons"),{
        clientSociete:form.clientSociete||"",clientNom:form.clientNom,clientPrenom:form.clientPrenom,
        clientTel:form.clientTel,clientEmail:form.clientEmail,
        adresseFacturation:form.adresseFacturation,adresseIntervention:form.adresseIntervention,
        clientAdresse:form.adresseIntervention,demandeClient:form.demandeClient,
        numDevis:form.numDevis,signataire:form.signataire||"",
        types:form.types,type:form.types.join(", "),
        datePrevue:form.datePrevue,heurePrevue:form.heurePrevue,techNom:form.techId,
        ref:form.numDevis?"INT-"+form.numDevis.replace(/\D/g,"").slice(-5):refNum(),
        statut:"planifié",createdAt:Timestamp.now(),createdBy:user?.uid||"",
        heureArrivee:null,heureFin:null,obsCocon:"",obsClient:"",
        signatureTech:null,signatureClient:null,emailEnvoye:false,
        montantFacture:form.montantFacture?parseFloat(form.montantFacture):null,
        numVisite:form.numVisite||"1",
      });
      await fetchBons();setForm({...EMPTY_FORM});flashMsg("✅ Bon créé !");setView("dashboard");
    }catch(err){alert("Erreur : "+(err?.message||JSON.stringify(err)));}
    finally{setSaving(false);}
  };

  const deleteBon=async()=>{await deleteDoc(doc(db,"bons",selected.id));setConfirmDelete(false);setSelected(null);setView("list");fetchBons();};

  const terminerBon=async()=>{
    if(!selected) return;
    setSaving(true);
    const now=Timestamp.now();
    await updateDoc(doc(db,"bons",selected.id),{
      heureFin:now,
      statut:"terminé",
      // Pas d'email - terminé par admin
    });
    const updated={...selected,heureFin:now,statut:"terminé"};
    setSelected(updated);
    await fetchBons();
    setSaving(false);
    flashMsg("✅ Bon terminé par l'admin.");
  };

  const saveEdit=async()=>{
    setSaving(true);
    await updateDoc(doc(db,"bons",selected.id),{
      clientSociete:editForm.clientSociete||"",clientNom:editForm.clientNom,clientPrenom:editForm.clientPrenom,
      clientTel:editForm.clientTel,clientEmail:editForm.clientEmail,
      adresseFacturation:editForm.adresseFacturation,adresseIntervention:editForm.adresseIntervention,
      clientAdresse:editForm.adresseIntervention,demandeClient:editForm.demandeClient,
      numDevis:editForm.numDevis,signataire:editForm.signataire||"",
      datePrevue:editForm.datePrevue,heurePrevue:editForm.heurePrevue,techNom:editForm.techId,
      types:editForm.types,type:editForm.types.join(", "),
    });
    setSelected({...selected,...editForm,techNom:editForm.techId,type:editForm.types.join(", ")});
    setEditMode(false);fetchBons();setSaving(false);
  };

  const sendBonsToDrive=async()=>{
    const aEnvoyer=bons.filter(b=>b.statut==="terminé"&&!b.driveEnvoye);
    if(!aEnvoyer.length){alert("Tous les bons terminés ont déjà été envoyés !");return;}
    setDriveSending(true);setDriveProgress({total:aEnvoyer.length,done:0,errors:0});
    let done=0,errors=0;
    for(const bon of aEnvoyer){
      try{
        const uri=await downloadPDF(bon,false);
        const nom=(bon.ref+"_"+bon.clientNom+"_"+bon.datePrevue+".pdf").replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_\-.]/g,"");
        await fetch(DRIVE_WEBHOOK,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain"},body:JSON.stringify({pdf:uri.split(",")[1],nom})});
        await updateDoc(doc(db,"bons",bon.id),{driveEnvoye:true});done++;
      }catch(e){errors++;}
      setDriveProgress({total:aEnvoyer.length,done:done+errors,errors});
    }
    await fetchBons();setDriveSending(false);setDriveProgress(null);
    flashMsg(errors===0?`✅ ${done} bon(s) envoyé(s) vers Drive !`:`⚠️ ${done} envoyé(s), ${errors} erreur(s)`);
  };

  const downloadPDF=async(bon,autoSave=true)=>{
    const{jsPDF}=await import("jspdf");const p=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    const W=210,ml=15,mr=195;
    try{p.addImage(logoBase64,"PNG",ml,5,28,22);}catch(e){}
    p.setFillColor(53,180,153);p.rect(45,0,W-45,28,"F");
    p.setTextColor(255,255,255);p.setFontSize(16);p.setFont("helvetica","bold");p.text("BON D'INTERVENTION",50,12);
    p.setFontSize(9);p.setFont("helvetica","normal");
    p.text("Cocon+ — 0596 73 66 66 | www.cocon-plus.fr",50,20);
    p.text("N° "+bon.ref,mr,12,{align:"right"});p.text("Le "+new Date().toLocaleDateString("fr-FR"),mr,20,{align:"right"});
    let y=35;
    const sec=(t)=>{p.setTextColor(53,180,153);p.setFontSize(9);p.setFont("helvetica","bold");p.text(t,ml,y);y+=3;p.setDrawColor(53,180,153);p.line(ml,y,mr,y);y+=5;p.setTextColor(60,60,60);p.setFont("helvetica","normal");p.setFontSize(10);};
    const row=(l,v)=>{if(y>260){p.addPage();y=20;}p.text(l+" : "+(v||"—"),ml,y);y+=6;};
    sec("INFORMATIONS");row("Référence",bon.ref);if(bon.numDevis)row("N° Devis",bon.numDevis);if(bon.numVisite)row("N° Visite",bon.numVisite);row("Collaborateur",bon.techNom);y+=2;
    sec("CLIENT");if(bon.clientSociete)row("Société",bon.clientSociete);row("Nom",bon.clientNom+" "+bon.clientPrenom);row("Téléphone",bon.clientTel);row("Email",bon.clientEmail);
    if(bon.adresseFacturation)row("Adresse facturation",bon.adresseFacturation);row("Adresse intervention",bon.adresseIntervention||bon.clientAdresse);y+=2;
    if(bon.demandeClient){sec("DEMANDE CLIENT");const d=p.splitTextToSize(bon.demandeClient,175);p.text(d,ml,y);y+=d.length*5+5;}
    sec("INTERVENTION");row("Type",bon.type);row("Prévu le",bon.datePrevue+" à "+bon.heurePrevue);
    row("Arrivée réelle",fmt(bon.heureArrivee));row("Fin intervention",fmt(bon.heureFin));row("Durée",calcDuree(bon.heureArrivee,bon.heureFin));
    if(bon.geoArrivee)row("Position arrivée",`Lat:${bon.geoArrivee.lat?.toFixed(5)},Lng:${bon.geoArrivee.lng?.toFixed(5)}`);y+=2;
    sec("COMPTE RENDU");const oC=p.splitTextToSize("Cocon+ : "+(bon.obsCocon||"—"),175);p.text(oC,ml,y);y+=oC.length*5+3;
    const oCl=p.splitTextToSize("Client : "+(bon.obsClient||"—"),175);p.text(oCl,ml,y);y+=oCl.length*5+5;
    sec("SIGNATURES");p.setFontSize(9);p.text("Collaborateur",ml,y);p.text("Client",ml+90,y);y+=3;
    if(bon.signatureTech){try{p.addImage(bon.signatureTech,"PNG",ml,y,80,30);}catch(e){}}else{p.setDrawColor(200,200,200);p.rect(ml,y,80,30);}
    if(bon.signatureClient){try{p.addImage(bon.signatureClient,"PNG",ml+90,y,80,30);}catch(e){}}else{p.setDrawColor(200,200,200);p.rect(ml+90,y,80,30);}
    p.setFontSize(8);p.setTextColor(150,150,150);p.text("Cocon Plus SARL — Berges de Kerlys, 97200 Fort-de-France — SIRET : 47756829900028",W/2,285,{align:"center"});
    const nom=(bon.ref+"_"+(bon.clientSociete||bon.clientNom+"_"+bon.clientPrenom)+"_"+(bon.datePrevue||"")+".pdf").replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_\-.]/g,"");
    if(autoSave)p.save(nom);return p.output("datauristring");
  };

  const demanderAvis=(bon)=>{
    const prenom=bon.clientPrenom||bon.clientNom||"client";
    const raw=(bon.clientTel||"").replace(/\s/g,"");
    const tel=raw.startsWith("+")?raw.slice(1):raw.startsWith("0696")?"596"+raw.slice(1):"596"+raw.slice(1);
    window.open(`https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(`🌿 Bonjour ${prenom},\n\nNous venons de réaliser votre ${bon.type} et espérons que tout s'est bien passé !\n\nUn avis Google nous aiderait beaucoup 🙏\n👉 https://g.page/r/CcTWB8zHSCPzEAE/review\n\nMerci pour votre confiance,\nCocon Plus SARL`)}`,"_blank");
  };

  const stats={
    planifie:bons.filter(b=>b.statut==="planifié").length,
    enCours:bons.filter(b=>b.statut==="en cours").length,
    termine:bons.filter(b=>b.statut==="terminé").length,
    aujourdhui:bons.filter(b=>b.datePrevue===today).length,
    semaine:bons.filter(b=>{const now=new Date(),s=new Date(now);s.setDate(now.getDate()-now.getDay());const e=new Date(s);e.setDate(s.getDate()+6);return new Date(b.datePrevue)>=s&&new Date(b.datePrevue)<=e;}).length,
  };

  const filteredBons=bons.filter(b=>{
    const q=search.toLowerCase();
    const ms=!q||(b.clientNom+" "+b.clientPrenom).toLowerCase().includes(q)||b.ref?.toLowerCase().includes(q)||b.numDevis?.toLowerCase().includes(q)||b.type?.toLowerCase().includes(q)||b.techNom?.toLowerCase().includes(q)||b.statut?.toLowerCase().includes(q);
    const now=new Date(),s=new Date(now);s.setDate(now.getDate()-now.getDay());const e=new Date(s);e.setDate(s.getDate()+6);
    const mf=!filter||(filter==="planifié"&&b.statut==="planifié")||(filter==="en cours"&&b.statut==="en cours")||(filter==="terminé"&&b.statut==="terminé")||(filter==="aujourdhui"&&b.datePrevue===today)||(filter==="semaine"&&new Date(b.datePrevue)>=s&&new Date(b.datePrevue)<=e);
    return ms&&mf;
  });

  const BonsTable=({data,showDate=false})=>(
    <div className="ca-table-wrap">
      <table className="ca-table">
        <thead><tr><th>Réf.</th>{showDate&&<th>Date</th>}<th>Client</th><th>Type</th><th>Heure</th><th>Collaborateur</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          {data.map(b=>(
            <tr key={b.id} onClick={()=>{setSelected(b);setView("detail");}}>
              <td><span className="ca-ref">{b.ref}</span></td>
              {showDate&&<td style={{fontSize:11,color:"#888",whiteSpace:"nowrap"}}>{fmtDate(b.datePrevue)}</td>}
              <td>{b.clientSociete&&<span style={{display:"block",fontSize:10,color:"#35B499",fontWeight:600}}>{b.clientSociete}</span>}<span style={{fontWeight:500}}>{b.clientNom} {b.clientPrenom}</span><span style={{display:"block",fontSize:10,color:"#888"}}>{b.clientTel}</span></td>
              <td style={{fontSize:11,color:"#555"}}>{b.type}</td>
              <td style={{fontSize:12,whiteSpace:"nowrap"}}>{b.heurePrevue}</td>
              <td style={{fontSize:12}}>{b.techNom}</td>
              <td style={{fontSize:12,fontWeight:500,color:b.montantFacture?"#35B499":"#ccc"}}>{b.montantFacture?parseFloat(b.montantFacture).toFixed(2)+" €":"—"}</td>
              <td><span className={`ca-badge ${scBadge(b.statut)}`}>{b.statut}</span></td>
              <td onClick={e=>e.stopPropagation()} style={{whiteSpace:"nowrap"}}>
                {b.statut==="terminé"&&<><button className="ca-btn-pdf" onClick={()=>downloadPDF(b)}>PDF</button>{b.clientTel&&<button className="ca-btn-wa" onClick={()=>demanderAvis(b)}>WA</button>}</>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const isInterventionView=["list","new","detail"].includes(view);

  const renderContent=()=>{
    if(view==="contrats") return <div style={{flex:1,overflow:"auto"}}><ContratModule/></div>;
    if(view==="carburant") return <div style={{flex:1,overflow:"auto"}}><CarburantModule user={user}/></div>;

    if(view==="new") return(
      <div className="ca-form-zone">
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setView("dashboard")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#35B499",fontWeight:500}}>← Retour</button>
          <h2 style={{margin:0,fontSize:16,fontWeight:600}}>Nouveau bon d'intervention</h2>
        </div>
        <form onSubmit={createBon}>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-title">Informations générales</div>
            <div className="row2"><div className="field"><label>N° Devis</label><input value={form.numDevis} onChange={e=>setForm({...form,numDevis:e.target.value})} placeholder="DEV-2026-001"/></div><div className="field"><label>Date prévue</label><input type="date" required value={form.datePrevue} onChange={e=>setForm({...form,datePrevue:e.target.value})}/></div></div>
            <div className="row2"><div className="field"><label>N° visite</label><input value={form.numVisite} onChange={e=>setForm({...form,numVisite:e.target.value})} placeholder="1"/></div><div className="field"><label>Montant facturé (€)</label><input type="number" step="0.01" value={form.montantFacture} onChange={e=>setForm({...form,montantFacture:e.target.value})}/></div></div>
            <div className="row2"><div className="field"><label>Heure prévue</label><input type="time" required value={form.heurePrevue} onChange={e=>setForm({...form,heurePrevue:e.target.value})}/></div><div className="field"><label>Collaborateur</label><select required value={form.techId} onChange={e=>setForm({...form,techId:e.target.value})}><option value="">-- Sélectionner --</option><option>Dimitri</option><option>Georges</option><option>Equipe</option></select></div></div>
          </div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-title">Client</div>
            <div className="field"><label>Société (optionnel)</label><input value={form.clientSociete} onChange={e=>setForm({...form,clientSociete:e.target.value})}/></div>
            <div className="row2"><div className="field"><label>Nom</label><input required value={form.clientNom} onChange={e=>setForm({...form,clientNom:e.target.value})}/></div><div className="field"><label>Prénom</label><input required value={form.clientPrenom} onChange={e=>setForm({...form,clientPrenom:e.target.value})}/></div></div>
            <div className="row2"><div className="field"><label>Téléphone</label><input value={form.clientTel} onChange={e=>setForm({...form,clientTel:e.target.value})}/></div><div className="field"><label>Email</label><input type="email" value={form.clientEmail} onChange={e=>setForm({...form,clientEmail:e.target.value})}/></div></div>
            <div className="field"><label>Adresse facturation</label><input value={form.adresseFacturation} onChange={e=>setForm({...form,adresseFacturation:e.target.value})}/></div>
            <div className="field"><label>Adresse intervention</label><input required value={form.adresseIntervention} onChange={e=>setForm({...form,adresseIntervention:e.target.value})}/></div>
            <div className="field"><label>Signataire (si différent)</label><input value={form.signataire} onChange={e=>setForm({...form,signataire:e.target.value})}/></div>
          </div>
          <div className="card" style={{marginBottom:16}}><div className="card-title">Demande client</div><div className="field"><textarea value={form.demandeClient} onChange={e=>setForm({...form,demandeClient:e.target.value})} placeholder="Contexte, motif…"/></div></div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-title">Type(s) d'intervention</div>
            <div className="types-grid">{TYPES.map(t=><button key={t} type="button" className={"type-btn"+(form.types.includes(t)?" active":"")} onClick={()=>setForm(f=>({...f,types:f.types.includes(t)?f.types.filter(x=>x!==t):[...f.types,t]}))}>{form.types.includes(t)?"✓ ":""}{t}</button>)}</div>
          </div>
          <button type="submit" className="btn-primary" style={{width:"100%",marginBottom:32}} disabled={saving}>{saving?"Création…":"Créer le bon"}</button>
        </form>
      </div>
    );

    if(view==="detail"&&selected&&editMode) return(
      <div className="ca-form-zone">
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><button onClick={()=>setEditMode(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#35B499",fontWeight:500}}>← Annuler</button><h2 style={{margin:0,fontSize:16,fontWeight:600}}>Modifier — {selected.ref}</h2></div>
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title">Informations générales</div>
          <div className="row2"><div className="field"><label>N° Devis</label><input value={editForm.numDevis} onChange={e=>setEditForm({...editForm,numDevis:e.target.value})}/></div><div className="field"><label>Date prévue</label><input type="date" value={editForm.datePrevue} onChange={e=>setEditForm({...editForm,datePrevue:e.target.value})}/></div></div>
          <div className="row2"><div className="field"><label>Heure</label><input type="time" value={editForm.heurePrevue} onChange={e=>setEditForm({...editForm,heurePrevue:e.target.value})}/></div><div className="field"><label>Collaborateur</label><select value={editForm.techId} onChange={e=>setEditForm({...editForm,techId:e.target.value})}><option>Dimitri</option><option>Georges</option><option>Equipe</option></select></div></div>
        </div>
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title">Client</div>
          <div className="field"><label>Société</label><input value={editForm.clientSociete||""} onChange={e=>setEditForm({...editForm,clientSociete:e.target.value})}/></div>
          <div className="row2"><div className="field"><label>Nom</label><input value={editForm.clientNom} onChange={e=>setEditForm({...editForm,clientNom:e.target.value})}/></div><div className="field"><label>Prénom</label><input value={editForm.clientPrenom} onChange={e=>setEditForm({...editForm,clientPrenom:e.target.value})}/></div></div>
          <div className="row2"><div className="field"><label>Téléphone</label><input value={editForm.clientTel} onChange={e=>setEditForm({...editForm,clientTel:e.target.value})}/></div><div className="field"><label>Email</label><input value={editForm.clientEmail} onChange={e=>setEditForm({...editForm,clientEmail:e.target.value})}/></div></div>
          <div className="field"><label>Adresse facturation</label><input value={editForm.adresseFacturation} onChange={e=>setEditForm({...editForm,adresseFacturation:e.target.value})}/></div>
          <div className="field"><label>Adresse intervention</label><input value={editForm.adresseIntervention} onChange={e=>setEditForm({...editForm,adresseIntervention:e.target.value})}/></div>
          <div className="field"><label>Signataire</label><input value={editForm.signataire||""} onChange={e=>setEditForm({...editForm,signataire:e.target.value})}/></div>
          <div className="field"><label>Demande client</label><textarea value={editForm.demandeClient} onChange={e=>setEditForm({...editForm,demandeClient:e.target.value})}/></div>
        </div>
        <div className="card" style={{marginBottom:16}}><div className="card-title">Types d'intervention</div><div className="types-grid">{TYPES.map(t=><button key={t} type="button" className={"type-btn"+(editForm.types.includes(t)?" active":"")} onClick={()=>setEditForm(f=>({...f,types:f.types.includes(t)?f.types.filter(x=>x!==t):[...f.types,t]}))}>{editForm.types.includes(t)?"✓ ":""}{t}</button>)}</div></div>
        <button className="btn-primary" style={{width:"100%",marginBottom:32}} disabled={saving} onClick={saveEdit}>{saving?"Sauvegarde…":"Enregistrer"}</button>
      </div>
    );

    if(view==="detail"&&selected) return(
      <div className="ca-form-zone">
        {confirmDelete&&(<div style={{background:"#fdecea",border:"1px solid #f5c6cb",borderRadius:10,padding:"1rem",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><span style={{color:"#c0392b",fontSize:14,fontWeight:500}}>Confirmer la suppression ?</span><div style={{display:"flex",gap:8}}><button className="btn-outline" onClick={()=>setConfirmDelete(false)}>Annuler</button><button style={{background:"#c0392b",color:"white",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13}} onClick={deleteBon}>Supprimer</button></div></div>)}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>{setView("list");setSelected(null);setConfirmDelete(false);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#35B499",fontWeight:500}}>← Retour</button>
          <h2 style={{margin:0,fontSize:16,fontWeight:600}}>{selected.ref}</h2>
          <span className={`ca-badge ${scBadge(selected.statut)}`}>{selected.statut}</span>
          {selected.statut==="planifié"&&!editMode&&(<button style={{background:"#E1F5EE",color:"#1a7a65",border:"0.5px solid #35B499",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12}} onClick={()=>{setEditForm({clientNom:selected.clientNom,clientPrenom:selected.clientPrenom,clientTel:selected.clientTel,clientEmail:selected.clientEmail,clientSociete:selected.clientSociete||"",adresseFacturation:selected.adresseFacturation||"",adresseIntervention:selected.adresseIntervention||selected.clientAdresse||"",demandeClient:selected.demandeClient||"",numDevis:selected.numDevis||"",signataire:selected.signataire||"",datePrevue:selected.datePrevue,heurePrevue:selected.heurePrevue,techId:selected.techNom,types:selected.types||[]});setEditMode(true);}}>Modifier</button>)}
          <button style={{marginLeft:"auto",background:"#fdecea",color:"#c0392b",border:"0.5px solid #f5c6cb",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12}} onClick={()=>setConfirmDelete(true)}>Supprimer</button>
        </div>
        <div className="card" style={{marginBottom:12}}>
          <div className="card-title">Informations générales</div>
          {selected.numDevis&&<div className="info-row"><span>N° Devis</span><b>{selected.numDevis}</b></div>}
          {selected.numVisite&&<div className="info-row"><span>N° Visite</span><b style={{color:"#2a9d8f"}}>{selected.numVisite}</b></div>}
          {selected.montantFacture&&<div className="info-row"><span>Montant facturé</span><b style={{color:"#35B499"}}>{parseFloat(selected.montantFacture).toFixed(2)} €</b></div>}
          <div className="info-row"><span>Référence</span><b>{selected.ref}</b></div>
          <div className="info-row"><span>Date prévue</span><b>{selected.datePrevue} à {selected.heurePrevue}</b></div>
          <div className="info-row"><span>Collaborateur</span><b>{selected.techNom}</b></div>
        </div>
        <div className="card" style={{marginBottom:12}}>
          <div className="card-title">Client</div>
          {selected.clientSociete&&<div className="info-row"><span>Société</span><b>{selected.clientSociete}</b></div>}
          <div className="info-row"><span>Nom</span><b>{selected.clientNom} {selected.clientPrenom}</b></div>
          <div className="info-row"><span>Téléphone</span><b>{selected.clientTel||"—"}</b></div>
          <div className="info-row"><span>Email</span><b>{selected.clientEmail||"—"}</b></div>
          {selected.signataire&&<div className="info-row"><span>Signataire</span><b>{selected.signataire}</b></div>}
          <div className="info-row"><span>Adresse facturation</span><b>{selected.adresseFacturation?<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.adresseFacturation)}`} target="_blank" rel="noreferrer" style={{color:"#2a9d8f",textDecoration:"underline"}}>{selected.adresseFacturation} 📍</a>:"—"}</b></div>
          <div className="info-row"><span>Adresse intervention</span><b>{selected.adresseIntervention||selected.clientAdresse?<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.adresseIntervention||selected.clientAdresse)}`} target="_blank" rel="noreferrer" style={{color:"#2a9d8f",textDecoration:"underline"}}>{selected.adresseIntervention||selected.clientAdresse} 📍</a>:"—"}</b></div>
        </div>
        {selected.demandeClient&&<div className="card" style={{marginBottom:12}}><div className="card-title">Demande client</div><p style={{fontSize:13,lineHeight:1.6,margin:0}}>{selected.demandeClient}</p></div>}
        <div className="card" style={{marginBottom:12}}>
          <div className="card-title">Intervention</div>
          <div className="info-row"><span>Type(s)</span><b>{selected.type}</b></div>
          <div className="info-row"><span>Arrivée réelle</span><b>{fmt(selected.heureArrivee)}</b></div>
          <div className="info-row"><span>Fin</span><b>{fmt(selected.heureFin)}</b></div>
          {selected.heureArrivee&&selected.heureFin&&<div className="info-row"><span>Durée</span><b style={{color:"#35B499"}}>{calcDuree(selected.heureArrivee,selected.heureFin)}</b></div>}
          {selected.geoArrivee&&<div className="info-row"><span>Position arrivée</span><b style={{fontSize:12}}>📍 {selected.geoArrivee.lat?.toFixed(4)}, {selected.geoArrivee.lng?.toFixed(4)}</b></div>}
        </div>
        <div className="card" style={{marginBottom:12}}><div className="card-title">Compte rendu</div><div className="info-row"><span>Cocon+</span><b>{selected.obsCocon||"—"}</b></div><div className="info-row"><span>Client</span><b>{selected.obsClient||"—"}</b></div></div>
        {selected.signatureTech&&<div className="card" style={{marginBottom:12}}><div className="card-title">Signatures</div><div className="row2"><div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Collaborateur</p><img src={selected.signatureTech} alt="" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}}/></div>{selected.signatureClient&&<div><p style={{fontSize:12,color:"#888",marginBottom:4}}>Client</p><img src={selected.signatureClient} alt="" style={{border:"1px solid #eee",borderRadius:8,maxWidth:"100%",height:80}}/></div>}</div></div>}
        {selected.statut==="en cours"&&(
          <div style={{marginBottom:16,padding:"12px 16px",background:"#fff8f0",border:"0.5px solid #e8c9b8",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <p style={{fontSize:13,fontWeight:500,color:"#6b4a31",margin:0}}>Clôturer cette intervention côté admin</p>
              <p style={{fontSize:11,color:"#888",margin:"2px 0 0"}}>Aucun email ne sera envoyé au client.</p>
            </div>
            <button disabled={saving} onClick={terminerBon}
              style={{background:"#35B499",color:"white",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600}}>
              {saving?"Clôture…":"✅ Terminer l'intervention"}
            </button>
          </div>
        )}
        {selected.statut==="terminé"&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:32}}><button className="btn-primary" style={{flex:1}} onClick={()=>downloadPDF(selected)}>Télécharger le PDF</button>{selected.clientTel&&<button onClick={()=>demanderAvis(selected)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"white",border:"none",padding:"12px 16px",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600}}>💬 Demander un avis Google</button>}</div>}
      </div>
    );

    if(view==="list") return(
      <div className="ca-content">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button onClick={()=>setView("dashboard")} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#35B499",fontWeight:500}}>← Tableau de bord</button>
          <h2 style={{margin:0,fontSize:16,fontWeight:600,flex:1}}>Tous les bons</h2>
          <button className="ca-btn teal" onClick={()=>setView("new")}>+ Nouveau</button>
        </div>
        {filter&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:12,color:"#888"}}>Filtre :</span><span style={{background:"#35B499",color:"white",fontSize:12,padding:"3px 10px",borderRadius:20}}>{filter}</span><button onClick={()=>setFilter("")} style={{background:"transparent",border:"none",color:"#888",cursor:"pointer",fontSize:12}}>✕</button></div>}
        <div style={{marginBottom:14}}><input type="text" placeholder="Rechercher par client, référence, type…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"9px 16px",fontSize:13,border:"0.5px solid #e0ddd8",borderRadius:8,background:"white",boxSizing:"border-box"}}/></div>
        <div className="ca-panel">{filteredBons.length===0?<div className="ca-empty">Aucun bon trouvé.</div>:<BonsTable data={filteredBons} showDate/>}</div>
      </div>
    );

    // DASHBOARD
    const bonsDuJour=bons.filter(b=>b.datePrevue===today).sort((a,b)=>(a.heurePrevue||"").localeCompare(b.heurePrevue||""));
    const now=new Date(),day=now.getDay(),diff=day===0?-6:1-day;
    const mon=new Date(now);mon.setDate(now.getDate()+diff);mon.setHours(0,0,0,0);
    const sat=new Date(mon);sat.setDate(mon.getDate()+5);sat.setHours(23,59,59,999);
    const bonsSemaine=bons.filter(b=>{if(b.datePrevue===today)return false;const d=new Date(b.datePrevue+"T00:00:00");return d>=mon&&d<=sat;}).sort((a,b)=>a.datePrevue.localeCompare(b.datePrevue)||(a.heurePrevue||"").localeCompare(b.heurePrevue||""));
    return(
      <div className="ca-content">
        <div className="ca-kpi-row">
          {[{label:"Planifiés",val:stats.planifie,accent:"#d4f0ea",key:"planifié"},{label:"En cours",val:stats.enCours,accent:"#e8c9b8",key:"en cours"},{label:"Terminés",val:stats.termine,accent:"#35B499",key:"terminé"},{label:"Aujourd'hui",val:stats.aujourdhui,accent:"#8B6A4E",key:"aujourdhui"},{label:"Cette semaine",val:stats.semaine,accent:"#2a9a82",key:"semaine"}].map(({label,val,accent,key})=>(
            <div key={key} className="ca-kpi" onClick={()=>{setFilter(f=>f===key?"":key);setView("list");}}>
              <div className="ca-kpi-accent" style={{background:accent}}/>
              <p className="ca-kpi-label">{label}</p>
              <p className="ca-kpi-val">{val}</p>
            </div>
          ))}
        </div>
        <div className="ca-actions">
          <button className="ca-btn teal" onClick={()=>setView("new")}>+ Nouveau bon</button>
          <button className="ca-btn outline" onClick={()=>setView("list")}>Tous les bons</button>
          <button className="ca-btn drive" onClick={sendBonsToDrive} disabled={driveSending}>{driveSending?"Envoi…":"📤 Envoyer vers Drive"}</button>
        </div>
        {driveProgress&&(<div className="ca-drive-progress"><div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13,fontWeight:600,color:"#1f7a6e"}}><span>Envoi vers Drive…</span><span>{driveProgress.done}/{driveProgress.total}</span></div><div style={{height:8,background:"#d0ede8",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:"#2a9d8f",width:(driveProgress.done/driveProgress.total*100)+"%"}}/></div></div>)}
        <div className="ca-panel"><div className="ca-panel-head"><span className="ca-panel-title">Bons du jour</span><span className="ca-panel-count">{bonsDuJour.length} intervention{bonsDuJour.length!==1?"s":""}</span></div>{bonsDuJour.length===0?<div className="ca-empty">Aucun bon prévu aujourd'hui.</div>:<BonsTable data={bonsDuJour}/>}</div>
        <div className="ca-panel"><div className="ca-panel-head"><span className="ca-panel-title">Bons de la semaine</span><span className="ca-panel-count">{bonsSemaine.length} intervention{bonsSemaine.length!==1?"s":""}</span></div>{bonsSemaine.length===0?<div className="ca-empty">Aucun autre bon prévu cette semaine.</div>:<BonsTable data={bonsSemaine} showDate/>}</div>
      </div>
    );
  };

  const viewTitle={dashboard:"Tableau de bord",contrats:"Contrats",list:"Interventions",new:"Nouveau bon",detail:"Détail",carburant:"Carburant",facturation:"Facturation"}[view]||"";

  return(
    <div className="ca-root">
      <div className="ca-sidebar">
        <div className="ca-logo-area"><p className="ca-logo-mark">Cocon+</p><p className="ca-logo-sub">Administration</p></div>
        <div className="ca-nav">
          <div className="ca-nav-sec">Pilotage</div>
          <button className={`ca-nav-item${view==="dashboard"?" active":""}`} onClick={()=>setView("dashboard")}>{view==="dashboard"&&<div className="ca-nav-bar"/>}<div className="ca-nav-pip" style={{background:"#35B499"}}/> Tableau de bord</button>
          <button className={`ca-nav-item${isInterventionView?" active":""}`} onClick={()=>setView("list")}>{isInterventionView&&<div className="ca-nav-bar"/>}<div className="ca-nav-pip" style={{background:"#35B499"}}/> Interventions{(stats.planifie+stats.enCours)>0&&<span className="ca-nav-badge">{stats.planifie+stats.enCours}</span>}</button>
          <div className="ca-nav-sec">Opérations</div>
          <button className={`ca-nav-item${view==="contrats"?" active":""}`} onClick={()=>setView("contrats")}>{view==="contrats"&&<div className="ca-nav-bar"/>}<div className="ca-nav-pip" style={{background:"#8B6A4E"}}/> Contrats</button>
          <button className={`ca-nav-item${view==="carburant"?" active":""}`} onClick={()=>setView("carburant")}>{view==="carburant"&&<div className="ca-nav-bar"/>}<div className="ca-nav-pip" style={{background:"rgba(255,255,255,0.25)"}}/> Carburant</button>
          <button className={`ca-nav-item${view==="facturation"?" active":""}`} onClick={()=>setView("facturation")}>{view==="facturation"&&<div className="ca-nav-bar"/>}<div className="ca-nav-pip" style={{background:"rgba(255,255,255,0.25)"}}/> Facturation</button>
        </div>
        <div className="ca-user-area"><div className="ca-avatar">JM</div><div><p className="ca-user-name">Jean-Marc S.</p><p className="ca-user-role">Administrateur</p></div></div>
        {onLogout && <button onClick={onLogout} style={{margin:"0 12px 16px",padding:"8px 14px",background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.12)",borderRadius:8,color:"rgba(255,255,255,0.45)",fontSize:11,cursor:"pointer",width:"calc(100% - 24px)",textAlign:"left"}}>🚪 Déconnexion</button>}
      </div>
      <div className="ca-main">
        <div className="ca-topbar">
          <span className="ca-topbar-title">{viewTitle}</span>
          {view==="dashboard"&&<div className="ca-period-tabs">{[["jour","Aujourd'hui"],["semaine","7 jours"],["mois","Ce mois"]].map(([k,l])=><button key={k} className={`ca-period-tab${period===k?" active":""}`} onClick={()=>setPeriod(k)}>{l}</button>)}</div>}
          <div className="ca-topbar-actions">
            {view==="dashboard"&&<button className="ca-btn teal" onClick={()=>setView("new")}>+ Nouveau bon</button>}
            {view==="list"&&<button className="ca-btn teal" onClick={()=>setView("new")}>+ Nouveau</button>}
            {view==="contrats"&&<button className="ca-btn teal">+ Nouveau contrat</button>}
          </div>
        </div>
        {msg&&<div className="ca-msg">{msg}</div>}
        {renderContent()}
      </div>
    </div>
  );
}
