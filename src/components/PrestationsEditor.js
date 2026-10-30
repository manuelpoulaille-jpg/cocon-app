import React from "react";

// ── Prestations (lignes du devis à cocher par le technicien) ──────────────────
export const newPrestation=(label)=>({id:"p"+Date.now()+"_"+Math.random().toString(36).slice(2,7),label,done:false,nonRealise:false,motif:""});

export default function PrestationsEditor({ prestations, onChange, nonBloquant, onNonBloquantChange }) {
  const [draft,setDraft]=React.useState("");
  const add=()=>{
    const label=draft.trim();
    if(!label) return;
    onChange([...(prestations||[]),newPrestation(label)]);
    setDraft("");
  };
  return(
    <div>
      {(prestations||[]).length===0&&(
        <p style={{fontSize:12,color:"#aaa",fontStyle:"italic",margin:"0 0 10px"}}>Aucune ligne. Ajoutez chaque prestation du devis — le technicien devra toutes les cocher sur place.</p>
      )}
      {(prestations||[]).map((p,i)=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"0.5px solid #f0ede8"}}>
          <span style={{fontSize:11,color:"#35B499",fontWeight:700,width:18,flexShrink:0}}>{i+1}.</span>
          <input value={p.label}
            onChange={e=>onChange(prestations.map(x=>x.id===p.id?{...x,label:e.target.value}:x))}
            style={{flex:1,padding:"7px 10px",fontSize:13,border:"0.5px solid #e0ddd8",borderRadius:7,background:"white",color:"#1a1a1a",boxSizing:"border-box"}}/>
          <button type="button" onClick={()=>onChange(prestations.filter(x=>x.id!==p.id))}
            style={{background:"none",border:"none",cursor:"pointer",color:"#e74c3c",fontSize:15,padding:"2px 6px",flexShrink:0}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <input value={draft} onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}}
          placeholder="Ex : Traitement des combles, pose de 6 postes d'appâtage…"
          style={{flex:1,padding:"8px 10px",fontSize:13,border:"0.5px solid #e0ddd8",borderRadius:7,background:"white",color:"#1a1a1a",boxSizing:"border-box"}}/>
        <button type="button" onClick={add} disabled={!draft.trim()}
          style={{fontSize:12,padding:"8px 14px",borderRadius:7,border:"none",background:"#35B499",color:"white",cursor:"pointer",fontWeight:600,opacity:draft.trim()?1:0.4,flexShrink:0}}>＋ Ajouter</button>
      </div>
      {(prestations||[]).length>0&&onNonBloquantChange&&(
        <div onClick={()=>onNonBloquantChange(!nonBloquant)}
          style={{display:"flex",alignItems:"flex-start",gap:10,marginTop:14,padding:"10px 12px",borderRadius:8,cursor:"pointer",background:nonBloquant?"#fff8f0":"#fafaf8",border:nonBloquant?"0.5px solid #e8c9b8":"0.5px solid #e0ddd8"}}>
          <div style={{width:18,height:18,borderRadius:5,border:"2px solid #8B6A4E",background:nonBloquant?"#8B6A4E":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
            {nonBloquant&&<span style={{color:"white",fontSize:11,fontWeight:"bold"}}>✓</span>}
          </div>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:"#6b4a31",margin:0}}>⏳ Chantier sur plusieurs jours — clôture non bloquée</p>
            <p style={{fontSize:11,color:"#888",margin:"2px 0 0"}}>Le technicien pourra clôturer ce bon même si des prestations restent à faire (elles seront reportées aux jours suivants). Sans cette case, toutes les lignes doivent être cochées ou justifiées.</p>
          </div>
        </div>
      )}
    </div>
  );
}
