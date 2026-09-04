import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { readSelectedSourceSystem, writeSelectedSourceSystem } from "../sourceSystem";

// FIX #1: dynamic hostname — no hardcoded localhost
const API = "";

const S = {
  bgPrimary:"var(--bg-primary)",bgSecondary:"var(--bg-secondary)",bgCard:"var(--bg-card)",bgHover:"var(--bg-card-hover)",
  border:"var(--border)",borderLight:"var(--border-light)",textPrimary:"var(--text-primary)",textSecondary:"var(--text-secondary)",
  textMuted:"var(--text-muted)",accent:"var(--accent)",accentLight:"var(--accent-light)",success:"var(--success)",
  warning:"var(--warning)",error:"var(--error)",
};

const INDUSTRY_OPTIONS = ["All Industries","Sports","Media & OTT","Telecom","Automotive"];
const SOURCE_EXAMPLES = {
  media: [
    "High LTV sports fans who haven't streamed in 60 days",
    "Active subscribers with high engagement watching kids content",
    "Lapsing customers with medium LTV likely to churn",
    "Low engagement subscribers who opened emails but never streamed",
    "Consented high value customers ready for email activation",
    "Inactive users with documentary or news affinity for win-back",
  ],
  sports: [
    "High fan score males aged 25-34 in the North region",
    "Season ticket holders with high LTV and low recent engagement",
    "Lapsed fans who opened emails but have not purchased tickets",
    "VIP fans ready for premium suite upsell",
    "Merch buyers with high engagement ready for game day offers",
    "Fantasy players with high fan score and active app engagement",
  ],
  telecom: [
    "Contract renewal customers with high churn risk",
    "High data users eligible for multi-product upsell",
    "New joiners who have not activated the mobile app",
    "Lapsing customers with medium LTV likely to churn",
    "Customers with network issues and recent support cases",
    "Active subscribers ready for plan upgrade",
  ],
  automotive: [
    "High fan score males aged 25-34 in the North region",
    "Find customers who have not replaced battery in 5 years",
    "Find customers with more than 50000 miles and no tire change",
    "Households with multiple vehicles",
    "Customers eligible for premium service upsell",
    "Customers who have not serviced vehicle in 9 months",
  ],
};
const SOURCE_TO_INDUSTRY = {
  all: "All Industries",
  media: "Media & OTT",
  sports: "Sports",
  telecom: "Telecom",
  automotive: "Automotive",
};
const INDUSTRY_TO_SOURCE = {
  "All Industries": "all",
  "Media & OTT": "media",
  Sports: "sports",
  Telecom: "telecom",
  Automotive: "automotive",
};
const PGA_JOURNEY_SHOWCASE = [
  { slug: "stream-engagement", name: "Streaming Engagement Journey", section: "Real-Time Engagement" },
  { slug: "merch-shopping", name: "Merch Shopping Journey", section: "Revenue Growth" },
  { slug: "volunteer-engagement", name: "Volunteer Recruitment Journey", section: "Community Engagement" },
  { slug: "newsletter-signup", name: "Newsletter Acquisition Journey", section: "User Acquisition" },
  { slug: "golf-travel", name: "Golf Travel Booking Journey", section: "Revenue Growth" },
  { slug: "fantasy-engagement", name: "Fantasy Golf Engagement Journey", section: "Fan Engagement" },
];

const SEGMENT_INDUSTRY = {
  sth_active:["Sports"],sth_lapsed:["Sports"],sth_firstyear:["Sports"],
  single_game:["Sports"],playoff_buyers:["Sports"],vip_fans:["Sports"],
  suite_holders:["Sports"],group_buyers:["Sports"],away_travelers:["Sports"],
  merch_buyers:["Sports"],fb_spenders:["Sports"],fantasy_players:["Sports"],
  offseason_engagers:["Sports"],app_nonbuyer:["Sports"],digital_fans:["Sports"],
  email_nonbuyer:["Sports"],winback_lapsed:["Sports"],youth_family:["Sports"],
  legacy_fans:["Sports"],corporate_b2b:["Sports"],
  active_subs:["Media & OTT"],at_risk_subs:["Media & OTT"],
  churned_subs:["Media & OTT"],free_to_paid:["Media & OTT"],heavy_consumers:["Media & OTT"],
  contract_renewal:["Telecom"],high_data:["Telecom"],
  multi_product:["Telecom"],churn_risk_tel:["Telecom"],new_joiners:["Telecom"],
  auto_high_ltv:["Automotive"],auto_service_due:["Automotive"],auto_ev_battery_risk:["Automotive"],
  auto_connected_services:["Automotive"],auto_trade_in_ready:["Automotive"],auto_loyalty_vip:["Automotive"],
  auto_insurance_cross_sell:["Automotive"],auto_recall_open:["Automotive"],auto_nps_recovery:["Automotive"],
  auto_app_engaged:["Automotive"],auto_warranty_service:["Automotive"],
};

const FILTERABLE_FIELDS = [
  {key:"ltv_tier",label:"LTV Tier",options:["High","Medium","Low"],group:"1P Behavioural"},
  {key:"recency_tier",label:"Recency",options:["Active","Lapsing","Inactive"],group:"1P Behavioural"},
  {key:"engagement_tier",label:"Engagement Tier",options:["High","Medium","Low"],group:"1P Behavioural"},
  {key:"primary_affinity",label:"Content Affinity",options:["Sports","Movies","Music","News","Kids","Documentary"],group:"1P Behavioural"},
  {key:"fan_score_band",label:"Fan Score",options:["35+","20-35","<20"],group:"2P · SportsIQ"},
  {key:"home_dma",label:"DMA / Region",options:["Chicago DMA","Los Angeles DMA","New York DMA","Dallas DMA","Miami DMA"],group:"2P · GeoSignal"},
  {key:"estimated_age_range",label:"Age Range",options:["18-24","25-34","35-44","45-54","55-64","65+"],group:"3P · DataBridge"},
  {key:"estimated_income_band",label:"Income Band",options:["<$30K","$30-50K","$50-75K","$75-100K","$100-150K","$150K+"],group:"3P · DataBridge"},
  {key:"ltv_band",label:"LTV Band",options:["High","Medium","Low"],group:"3P · TrueSignal"},
  {key:"segment_code",label:"Segment Code",options:["HIGH_VALUE_SPORTS","LOYAL_SUBSCRIBER","CHURN_RISK","UPSELL_READY"],group:"3P · TrueSignal"},
];

const REFRESH_OPTIONS=["Streaming","Hourly","Daily","Weekly"];
const PIPELINE_STATUS_OPTIONS=["Draft","Needs review","In QA review","Ready for activation","Production ready"];
const JOURNEY_READY_STATUSES=["Production ready","Ready for activation"];

function resolveNLPToFilters(prompt){
  const p=prompt.toLowerCase(),f={};
  if(p.includes("high ltv")||p.includes("high value"))f.ltv_tier="High";
  else if(p.includes("medium ltv")||p.includes("mid"))f.ltv_tier="Medium";
  else if(p.includes("low ltv")||p.includes("low value"))f.ltv_tier="Low";
  if(p.includes("lapsing")||p.includes("haven't")||p.includes("60 days")||p.includes("90 days"))f.recency_tier="Lapsing";
  else if(p.includes("active")||p.includes("recent"))f.recency_tier="Active";
  else if(p.includes("inactive")||p.includes("dormant")||p.includes("win-back"))f.recency_tier="Inactive";
  if(p.includes("high engagement")||p.includes("highly engaged"))f.engagement_tier="High";
  else if(p.includes("low engagement")||p.includes("never streamed"))f.engagement_tier="Low";
  if(p.includes("sports"))f.primary_affinity="Sports";
  else if(p.includes("movie"))f.primary_affinity="Movies";
  else if(p.includes("music"))f.primary_affinity="Music";
  else if(p.includes("news"))f.primary_affinity="News";
  else if(p.includes("kids"))f.primary_affinity="Kids";
  else if(p.includes("documentary"))f.primary_affinity="Documentary";
  if(p.includes("high fan score")||p.includes("fan score 70")||p.includes("fan score > 70"))f.fan_score_band="35+";
  else if(p.includes("medium fan score")||p.includes("fan score 50"))f.fan_score_band="20-35";
  else if(p.includes("low fan score"))f.fan_score_band="<20";
  if(p.includes("25-34")||p.includes("millennial"))f.estimated_age_range="25-34";
  else if(p.includes("18-24")||p.includes("gen z"))f.estimated_age_range="18-24";
  else if(p.includes("35-44"))f.estimated_age_range="35-44";
  else if(p.includes("45-54"))f.estimated_age_range="45-54";
  else if(p.includes("55-64"))f.estimated_age_range="55-64";
  else if(p.includes("65+")||p.includes("senior"))f.estimated_age_range="65+";
  if(p.includes("high income")||p.includes("$100k")||p.includes("$150k"))f.estimated_income_band="$100-150K";
  else if(p.includes("low income")||p.includes("$30k"))f.estimated_income_band="<$30K";
  if(p.includes("high ltv band"))f.ltv_band="High";
  else if(p.includes("low ltv band"))f.ltv_band="Low";
  if(p.includes("churn risk"))f.segment_code="CHURN_RISK";
  else if(p.includes("upsell"))f.segment_code="UPSELL_READY";
  else if(p.includes("loyal"))f.segment_code="LOYAL_SUBSCRIBER";
  else if(p.includes("high value sports"))f.segment_code="HIGH_VALUE_SPORTS";
  if(p.includes("chicago"))f.home_dma="Chicago DMA";
  else if(p.includes("los angeles")||p.includes("la "))f.home_dma="Los Angeles DMA";
  else if(p.includes("new york")||p.includes("nyc"))f.home_dma="New York DMA";
  else if(p.includes("dallas"))f.home_dma="Dallas DMA";
  else if(p.includes("miami"))f.home_dma="Miami DMA";
  return f;
}

function resolveSegmentActivationStatus(segment){
  const s=segment._pipelineStatus||segment.status||segment.pipeline_status;
  if(segment?._custom&&segment?._status==="active"&&!JOURNEY_READY_STATUSES.includes(s))return"Ready for activation";
  if(s)return s;
  const coverage=Number(segment.coverage_pct??segment.coveragePct??segment._coverage??0);
  const count=Number(segment.count??segment._count??0);
  if(count<=0)return"Needs review";
  if(coverage>=30)return"Production ready";
  return"Ready for activation";
}
function isJourneyReadySegment(segment){return JOURNEY_READY_STATUSES.includes(resolveSegmentActivationStatus(segment));}

function Btn({onClick,children,secondary,disabled,style}){
  return<button className={`seg-btn ${secondary?"is-secondary":"is-primary"}`} onClick={onClick} disabled={disabled} style={{padding:"8px 16px",background:disabled?S.bgCard:secondary?S.bgCard:S.accent,color:disabled?S.textMuted:secondary?S.textSecondary:"#fff",border:secondary?`1px solid ${S.border}`:"none",borderRadius:4,fontSize:13,cursor:disabled?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",opacity:disabled?0.6:1,...style}}>{children}</button>;
}
function Input({value,onChange,onKeyDown,placeholder,style}){
  return<input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{padding:"8px 12px",borderRadius:4,border:`1px solid ${S.border}`,background:S.bgSecondary,color:S.textPrimary,fontSize:13,outline:"none",fontFamily:"inherit",...style}}/>;
}
function Select({value,onChange,children,style}){
  return<select value={value} onChange={onChange} style={{padding:"7px 10px",borderRadius:4,border:`1px solid ${S.border}`,background:S.bgSecondary,color:S.textPrimary,fontSize:13,outline:"none",fontFamily:"inherit",...style}}>{children}</select>;
}

async function runConsentGate(rows,channel="email"){
  if(!rows||rows.length===0)return null;
  const moscids=rows.map(r=>r.golden_id||r.customer_id).filter(Boolean);
  if(moscids.length===0)return null;
  try{
    const res=await fetch(`${API}/api/consent/gate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({moscids,channel})});
    return await res.json();
  }catch{return null;}
}

async function readJsonApiResponse(response,fallbackMessage){
  const raw=await response.text();
  if(!raw.trim()){
    return{error:`${fallbackMessage} (HTTP ${response.status}).`,code:"EMPTY_RESPONSE",retryable:response.status>=500};
  }
  try{
    return JSON.parse(raw);
  }catch{
    const upstreamFailure=/upstream|gateway|timeout|temporarily unavailable/i.test(raw);
    return{
      error:upstreamFailure
        ?"The AI service did not respond in time. Please try again shortly."
        :`${fallbackMessage} (HTTP ${response.status}).`,
      code:"NON_JSON_RESPONSE",
      retryable:response.status>=500,
    };
  }
}

function wait(milliseconds){
  return new Promise(resolve=>setTimeout(resolve,milliseconds));
}

async function waitForSegmentJob(job,maxWaitMs=210000){
  const statusUrl=job?.status_url;
  if(!statusUrl)throw new Error("Segment generation did not return a status URL.");
  const started=Date.now();
  while(Date.now()-started<maxWaitMs){
    await wait(1500);
    const response=await fetch(`${API}${statusUrl}`,{
      method:"GET",
      headers:{"Accept":"application/json"},
      cache:"no-store",
    });
    const payload=await readJsonApiResponse(response,"Unable to check segment generation");
    if(response.status===202||payload.status==="queued"||payload.status==="running")continue;
    if(!response.ok||payload.status==="failed"||payload.error){
      throw new Error(payload.error||"Unable to generate segment.");
    }
    if(payload.status==="completed")return payload.result||{};
  }
  throw new Error("Segment generation is still taking longer than expected. Please try again.");
}

function ConsentValidationBanner({gateResult,loading}){
  if(loading)return<div style={{background:"rgba(0,102,204,0.08)",border:`1px solid rgba(0,102,204,0.2)`,borderRadius:6,padding:"10px 14px",marginTop:10,fontSize:12,color:S.accentLight}}>🔒 Running consent gate validation…</div>;
  if(!gateResult)return null;
  const{total,send,block}=gateResult;
  const blockPct=total>0?Math.round(block/total*100):0;
  const sendPct=total>0?Math.round(send/total*100):0;
  const isClean=block===0;
  return(
    <div style={{background:isClean?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.07)",border:`1px solid ${isClean?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`,borderRadius:6,padding:"12px 14px",marginTop:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:12,color:isClean?S.success:S.error}}>{isClean?"  Consent Gate — All Clear":"⚠️ Consent Gate — Blocked Users Detected"}</div>
        <span style={{fontSize:10,color:S.textMuted}}>Email channel</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div style={{background:"rgba(16,185,129,0.1)",borderRadius:4,padding:"6px 10px",textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:800,color:S.success}}>{send.toLocaleString()}</div>
          <div style={{fontSize:10,color:S.textMuted}}>  Eligible to activate ({sendPct}%)</div>
        </div>
        <div style={{background:"rgba(239,68,68,0.1)",borderRadius:4,padding:"6px 10px",textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:800,color:S.error}}>{block.toLocaleString()}</div>
          <div style={{fontSize:10,color:S.textMuted}}>⛔ Will be suppressed ({blockPct}%)</div>
        </div>
      </div>
      {block>0&&<div style={{fontSize:11,color:S.textMuted}}>{block} customer{block>1?"s":""} opted out or suppressed — automatically excluded. Gate enforcement applies at send time.</div>}
      {isClean&&<div style={{fontSize:11,color:S.success}}>All {send.toLocaleString()} customers have valid email consent. Safe to activate.</div>}
    </div>
  );
}

const EXPORT_CONFIG_BY_SOURCE = {
  automotive: {
    headers: ["golden_id","full_name","email","customer_id","household_id","vehicle_id","loyalty_id","membership_tier","zip"],
    note: "Export includes: golden_id, name, email, customer ID, household ID, vehicle ID, loyalty ID, tier, and ZIP",
  },
  default: {
    headers: ["golden_id","full_name","email","fan_score","ltv_band","estimated_age_range","churn_propensity_score","home_dma"],
    note: "Export includes: golden_id, name, email, fan score (SportsIQ), LTV band, age range, churn % (TrueSignal), DMA (GeoSignal)",
  },
};

function getExportConfig(sourceSystem){
  if(sourceSystem==="dynamic"||sourceSystem==="ai")return null;
  return EXPORT_CONFIG_BY_SOURCE[normalizeSourceSystem(sourceSystem)]||EXPORT_CONFIG_BY_SOURCE.default;
}

function downloadCSV(rows,filename,sourceSystem){
  if(!rows||rows.length===0)return;
  const headers=getExportConfig(sourceSystem)?.headers||Object.keys(rows[0]);
  const lines=[headers.join(","),...rows.map(r=>headers.map(h=>{const val=r[h]??"";return String(val).includes(",")?`"${val}"`:val;}).join(","))];
  const blob=new Blob([lines.join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename||"segment_members.csv";a.click();URL.revokeObjectURL(url);
}

function segmentLifecycleDefinition(segment,sourceSystem){
  const segmentId=segment?.segment_id||segment?.id;
  return{
    id:segmentId,
    segment_id:segmentId,
    name:segment?.name,
    description:segment?.description,
    source_system:normalizeSourceSystem(segment?.source_system||segment?.sourceSystem||sourceSystem),
    count:Number(segment?.count??segment?._count??segment?.total??segment?._total??0),
    total:Number(segment?.total??segment?._total??segment?.count??segment?._count??0),
    filters:segment?.filters,
    root:segment?.root,
    domain:segment?.domain,
    pipeline_status:resolveSegmentActivationStatus(segment),
    refresh:segment?._refresh||segment?.refresh,
  };
}

async function pushToCRM(segment,sourceSystem){
  const definition=segmentLifecycleDefinition(segment,sourceSystem);
  try{
    const res=await fetch(`${API}/api/segments/${definition.id}/activate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({channel:"crm",segment_name:definition.name,source_system:definition.source_system,segment_definition:definition})});
    const payload=await readJsonApiResponse(res,"Unable to activate segment");
    return res.ok?payload:{...payload,success:false};
  }catch{return null;}
}

async function publishToJourneyBuilder(segments,sourceSystem){
  try{
    const definitions=segments.map(segment=>segmentLifecycleDefinition(segment,sourceSystem));
    const res=await fetch(`${API}/api/segments/publish`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        segment_ids:definitions.map(segment=>segment.id),
        segments:definitions,
        destination:"journey_builder",
        source_system:normalizeSourceSystem(sourceSystem),
      }),
    });
    const payload=await readJsonApiResponse(res,"Unable to publish segments to Journey Builder");
    return res.ok?payload:{...payload,success:false};
  }catch{return null;}
}

function normalizeSourceSystem(source){
  const normalized=(source||"").toLowerCase();
  return ["all","media","sports","telecom","automotive"].includes(normalized)?normalized:"sports";
}

function sourceParam(sourceSystem){
  return `source=${encodeURIComponent(normalizeSourceSystem(sourceSystem))}`;
}

function segmentSourceSystem(segment,fallbackSource){
  return normalizeSourceSystem(segment?.source_system||segment?.sourceSystem||fallbackSource);
}

function aiDomainForSource(sourceSystem){
  return normalizeSourceSystem(sourceSystem)==="automotive"?"automotive":"streaming";
}

function flattenRuleFilters(node,chips=[]){
  if(!node||typeof node!=="object")return chips;
  const attribute=node.attribute||node.field||node.column;
  if(attribute){
    const operator=node.operator||node.op||"=";
    const rawValue=node.value??node.values??node.threshold??"";
    const value=Array.isArray(rawValue)?rawValue.join(", "):String(rawValue);
    chips.push({attribute,operator,value,label:`${attribute} ${operator} ${value}`});
  }
  ["conditions","children","rules","filters"].forEach(key=>{
    if(Array.isArray(node[key]))node[key].forEach(child=>flattenRuleFilters(child,chips));
  });
  if(node.root)flattenRuleFilters(node.root,chips);
  return chips;
}

function aiFilterChips(result){
  const filters=Array.isArray(result?.filters)?result.filters.filter(f=>f&&(f.attribute||f.label)):[];
  return filters.length?filters:flattenRuleFilters(result?.root||{});
}

async function saveAsCustomSegment(name,filters,rows,total,sourceSystem,metadata={}){
  try{
    const res=await fetch(`${API}/api/copilot/segments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...metadata,name,filters,rows,total,source_system:normalizeSourceSystem(sourceSystem)})});
    const payload=await readJsonApiResponse(res,"Unable to save segment");
    return res.ok?payload:{...payload,success:false};
  }catch{return null;}
}

function hydrateCreatedSegment(segment,{ai=false}={}){
  const count=Number(segment?.count??segment?.total??segment?._count??0);
  const pipelineStatus=segment?._pipelineStatus||segment?.pipeline_status||segment?.status||"Draft";
  const active=segment?._status==="active"||segment?.activation_status==="activated";
  return{
    ...segment,
    id:segment?.id||segment?.segment_id,
    segment_id:segment?.segment_id||segment?.id,
    _ai:ai,
    _custom:true,
    _status:active?"active":"inactive",
    _count:count,
    _rows:segment?._rows??segment?.rows??[],
    _total:Number(segment?._total??segment?.total??count),
    _coverage:Number(segment?.coverage_pct??segment?._coverage??0),
    _refresh:segment?._refresh||segment?.refresh||"Daily",
    _pipelineStatus:pipelineStatus,
  };
}

function isAiSegment(segment){
  return segment?._ai===true||segment?.definition_origin==="AI custom segment";
}

function ExportActivationBar({seg,members,sourceSystem}){
  const[crmStatus,setCrmStatus]=useState(null);
  const isAI=isAiSegment(seg);
  const exportConfig=getExportConfig(isAI?"dynamic":sourceSystem);
  const handleDownload=()=>downloadCSV(members?.rows||seg._rows||[],`${seg.name.replace(/\s+/g,"_")}_members.csv`,isAI?"dynamic":sourceSystem);
  const handlePushCRM=async()=>{
    setCrmStatus("loading");
    const result=await pushToCRM(seg,sourceSystem);
    setCrmStatus(result?.success?"success":"error");
    setTimeout(()=>setCrmStatus(null),3000);
  };
  return(
    <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap",alignItems:"center"}}>
      <Btn secondary onClick={handleDownload} style={{fontSize:12,padding:"6px 14px"}}>⬇ Download List</Btn>
      <Btn secondary onClick={handlePushCRM} disabled={crmStatus==="loading"} style={{fontSize:12,padding:"6px 14px"}}>
        {crmStatus==="loading"?"Pushing…":crmStatus==="success"?"  Pushed!":crmStatus==="error"?"❌ Failed":"📤 Push to CRM/Channel"}
      </Btn>
      <span style={{fontSize:11,color:S.textMuted}}>{exportConfig?.note||"Export includes the generated segment fields returned by the AI segment service"}</span>
    </div>
  );
}

function AudienceOverlapModal({allSegments,onClose,sourceSystem}){
  const[segA,setSegA]=useState("");
  const[segB,setSegB]=useState("");
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);

  const analyze=async()=>{
    if(!segA||!segB||segA===segB)return;
    setLoading(true);setResult(null);
    try{
      // FIX #3: GET with query params (not POST with body)
      const res=await fetch(`${API}/api/segments/overlap?seg1=${encodeURIComponent(segA)}&seg2=${encodeURIComponent(segB)}&${sourceParam(sourceSystem)}`);
      const d=await readJsonApiResponse(res,"Unable to generate segment");
      setResult(d);
    }catch{
      const a=allSegments.find(s=>s.id===segA);
      const b=allSegments.find(s=>s.id===segB);
      const countA=a?.count||a?._count||0;
      const countB=b?.count||b?._count||0;
      const overlap=Math.round(Math.min(countA,countB)*0.18);
      setResult({overlap,total_a:countA,total_b:countB,pct_a:countA>0?Math.round(overlap/countA*100):0,pct_b:countB>0?Math.round(overlap/countB*100):0});
    }
    setLoading(false);
  };

  const segOptions=allSegments.filter(s=>s.id);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:S.bgCard,border:`1px solid ${S.borderLight}`,borderRadius:12,width:540,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:15,color:S.textPrimary}}>🔁 Audience Overlap Analysis</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:S.textMuted,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{fontSize:12,color:S.textMuted,marginBottom:16}}>Identify how many customers appear in both segments — useful for deduplication and frequency capping.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:S.textPrimary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Segment A</div>
            <Select value={segA} onChange={e=>setSegA(e.target.value)} style={{width:"100%"}}>
              <option value="">Select segment…</option>
              {segOptions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:S.textPrimary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Segment B</div>
            <Select value={segB} onChange={e=>setSegB(e.target.value)} style={{width:"100%"}}>
              <option value="">Select segment…</option>
              {segOptions.filter(s=>s.id!==segA).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <Btn onClick={analyze} disabled={!segA||!segB||segA===segB||loading}>{loading?"Analyzing…":"🔍 Analyze Overlap"}</Btn>
        {result&&(
          <div style={{marginTop:20}}>
            <div style={{fontWeight:700,fontSize:13,color:S.textPrimary,marginBottom:12}}>Overlap Results</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[
                {label:"Segment A",value:result.total_a?.toLocaleString(),sub:"total customers",color:S.accentLight},
                {label:"Overlap",value:result.overlap?.toLocaleString(),sub:`${result.pct_a}% of A · ${result.pct_b}% of B`,color:S.warning},
                {label:"Segment B",value:result.total_b?.toLocaleString(),sub:"total customers",color:S.accentLight},
              ].map(item=>(
                <div key={item.label} style={{background:S.bgSecondary,border:`1px solid ${S.border}`,borderRadius:8,padding:"12px 10px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:S.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{item.label}</div>
                  <div style={{fontSize:20,fontWeight:800,color:item.color}}>{item.value}</div>
                  <div style={{fontSize:10,color:S.textMuted,marginTop:4}}>{item.sub}</div>
                </div>
              ))}
            </div>
            {result.overlap>0&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,fontSize:12,color:S.warning}}>⚠️ {result.overlap.toLocaleString()} customers are in both segments. Consider deduplication before activation.</div>}
            {result.overlap===0&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:6,fontSize:12,color:S.success}}>  No overlap detected. These are fully distinct audiences — safe to activate both simultaneously.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${color}1f, transparent 55%)`,
        }}
      />
 
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}20`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        {icon || "•"}
      </div>
 
      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
 
        <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>
          {value}
        </div>
 
        {sub && (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentsOverview({allSegments}){
  const statusCounts = allSegments.reduce((acc, seg) => {
    const status = resolveSegmentActivationStatus(seg);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pipelineStatuses = ["Production ready","Ready for activation","In QA review","Needs review","Draft"];

  const kpis = [
    { label: "Total Segments", value: allSegments.length.toLocaleString(), detail: "segments", accent: "#2680eb" },
    ...pipelineStatuses.map((status) => {
      const accent =
        status === "Production ready" ? "#22c55e" :
        status === "Ready for activation" ? "#2680eb" :
        status === "In QA review" ? "#f59e0b" :
        status === "Needs review" ? "#8b5cf6" :
        "#7a8fa8";
      return { label: status, value: (statusCounts[status] || 0).toLocaleString(), detail: "segments", accent };
    }),
  ];

  const statusDotColor = (status) => {
    if (status === "Production ready" || status === "Ready for activation") return S.success;
    if (status === "In QA review" || status === "Needs review") return S.warning;
    return S.textMuted;
  };

   return (
    <div style={{display:"grid",gap:12,marginBottom:20}}>
     
     <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  }}
>
  {kpis.map((kpi) => {
    const icon =
      kpi.label === "Total Segments"
        ? "🎯"
        : kpi.label.includes("Production")
        ? " "
        : kpi.label.includes("Ready")
        ? "🚀"
        : kpi.label.includes("QA")
        ? "🧪"
        : kpi.label.includes("Needs")
        ? "⚠️"
        : "📊";
 
    return (
      <KpiCard
        key={kpi.label}
        label={kpi.label}
        value={kpi.value}
        sub={kpi.detail}
        color={kpi.accent}
        icon={icon}
      />
    );
  })}
</div>
 
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:10}}>
        {/* <div style={{padding:12,border:`1px solid ${S.border}`,borderRadius:12,background:S.bgCard}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
            <strong style={{color:S.textPrimary,fontSize:13,fontWeight:800}}>Pipeline Status</strong>
            <span style={{color:S.textMuted,fontSize:11,fontWeight:700}}>{allSegments.length} segments</span>
          </div>
          <div style={{display:"grid",gap:7}}>
            {pipelineStatuses.map((status) => (
              <div
                key={status}
                style={{
                  display:"grid",
                  gridTemplateColumns:"auto 1fr auto",
                  alignItems:"center",
                  gap:9,
                  minHeight:36,
                  padding:"8px 10px",
                  border:`1px solid ${S.border}`,
                  borderRadius:10,
                  background:S.bgSecondary,
                }}
              >
                <span style={{width:8,height:8,borderRadius:"50%",background:statusDotColor(status)}}/>
                <p style={{margin:0,color:S.textSecondary,fontSize:12,fontWeight:650}}>{status}</p>
                <strong style={{color:S.textPrimary,fontSize:12,fontWeight:800}}>{(statusCounts[status] || 0).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div> */}
      </div>
    </div>
  );
}
function SegmentCard({seg,onClick,isSelected}){
  const isCustom=seg._custom,isActive=seg._status==="active",consentValidated=seg._consentValidated,eligibleCount=seg._eligibleCount;
  const filterChips=aiFilterChips(seg).slice(0,3);
  const status = resolveSegmentActivationStatus(seg);
  const statusGradient =
    status === "Production ready" ? "linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))" :
    status === "Ready for activation" ? "linear-gradient(135deg, rgba(38,128,235,0.14), rgba(38,128,235,0.04))" :
    status === "In QA review" ? "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.04))" :
    status === "Needs review" ? "linear-gradient(135deg, rgba(139,92,246,0.16), rgba(139,92,246,0.05))" :
    "linear-gradient(135deg, rgba(122,143,168,0.16), rgba(122,143,168,0.05))";
  return(
    <div onClick={()=>onClick(seg)} style={{background:isSelected?`linear-gradient(135deg, rgba(0,102,204,0.2), rgba(0,102,204,0.06)), ${statusGradient}`:statusGradient,border:`1px solid ${isSelected?S.accent:S.border}`,borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",position:"relative",minHeight:120,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
      {isCustom&&<div style={{position:"absolute",top:10,right:10,display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}}>
        <span style={{background:isActive?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)",color:isActive?S.success:S.warning,padding:"2px 8px",borderRadius:9999,fontSize:10,fontWeight:700}}>{isActive?"Active":"Inactive"}</span>
        {consentValidated&&<span style={{background:"rgba(16,185,129,0.12)",color:S.success,padding:"2px 8px",borderRadius:9999,fontSize:10,fontWeight:700,border:"1px solid rgba(16,185,129,0.25)"}}>Consent ok</span>}
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginRight:isCustom?80:0}}>
        <div style={{fontWeight:600,fontSize:13,color:S.textPrimary,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{seg.name}</div>
        <div style={{textAlign:"right",marginLeft:8,flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:16,color:S.accentLight}}>{(seg.count||seg._count||0).toLocaleString()}</div>
          {consentValidated&&eligibleCount!==undefined&&<div style={{fontSize:10,color:S.success,fontWeight:600}}>{eligibleCount.toLocaleString()} eligible</div>}
          {seg._consentSummary&&!consentValidated&&<div style={{fontSize:10,color:S.success,fontWeight:600,marginTop:2}}>{seg._consentSummary.send?.toLocaleString()} eligible</div>}
        </div>
      </div>
      <div style={{fontSize:11,color:S.textMuted,margin:"4px 0 8px"}}>{seg.description}</div>
      {filterChips.length>0&&(
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
          {filterChips.map((f,i)=>(
            <span key={`${f.attribute||f.label||"filter"}-${i}`} style={{background:"rgba(0,102,204,0.1)",color:S.accentLight,border:"1px solid rgba(0,102,204,0.2)",padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>
              {f.label||`${f.attribute} ${f.operator||"="} ${f.value??""}`}
            </span>
          ))}
          {aiFilterChips(seg).length>filterChips.length&&<span style={{fontSize:10,color:S.textMuted,padding:"2px 4px"}}>+{aiFilterChips(seg).length-filterChips.length} more</span>}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,height:3,background:S.border,borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${seg.coverage_pct||seg._coverage||0}%`,background:isCustom?S.success:S.accent,borderRadius:99}}/>
        </div>
        <span style={{fontSize:11,color:S.textMuted,flexShrink:0}}>{seg.coverage_pct||seg._coverage||0}%</span>
      </div>
      {isCustom&&!isActive&&<div style={{marginTop:10}}><Btn onClick={e=>{e.stopPropagation();onClick({...seg,_activate:true});}} style={{padding:"5px 12px",fontSize:11}}>Activate Segment</Btn></div>}
      {isCustom&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
        {seg._refresh&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"rgba(59,130,246,0.1)",color:S.accentLight,fontWeight:600}}>Refresh: {seg._refresh}</span>}
        {seg._pipelineStatus&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"rgba(100,116,139,0.15)",color:S.textSecondary,fontWeight:600}}>{seg._pipelineStatus}</span>}
      </div>}
    </div>
  );
}
function CreateSegmentModal({onClose,onCreated,initialMode,sourceSystem,totalRecords=6852}){
  const[mode,setMode]=useState(initialMode||null);
  const[segName,setSegName]=useState("");
  const[rules,setRules]=useState([{field:"ltv_tier",value:"High"}]);
  const[refresh,setRefresh]=useState("Daily");
  const[pipelineStatus,setPipelineStatus]=useState("Draft");
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);
  const[gateResult,setGateResult]=useState(null);
  const[gateLoading,setGateLoading]=useState(false);
  const[saveStatus,setSaveStatus]=useState(null);
  const sourceKey=normalizeSourceSystem(sourceSystem);
  const domain=aiDomainForSource(sourceKey);
  const[prompt,setPrompt]=useState("");
  const[aiName,setAiName]=useState("");
  const[resolved,setResolved]=useState(null);
  const[aiLoading,setAiLoading]=useState(false);
  const[aiResult,setAiResult]=useState(null);
  const[aiGate,setAiGate]=useState(null);
  const[aiGateLoading,setAiGateLoading]=useState(false);
  const[aiSaveStatus,setAiSaveStatus]=useState(null);
  const[aiError,setAiError]=useState(null);
  const examples=SOURCE_EXAMPLES[sourceKey]||SOURCE_EXAMPLES.sports||[];

  const addRule=()=>setRules(r=>[...r,{field:"ltv_tier",value:"High"}]);
  const removeRule=i=>setRules(r=>r.filter((_,idx)=>idx!==i));
  const updateRule=(i,k,v)=>setRules(r=>r.map((rule,idx)=>idx===i?{...rule,[k]:v}:rule));

  const runManual=async()=>{
    if(!segName.trim())return alert("Please enter a segment name before generating.");
    setLoading(true);setGateResult(null);setSaveStatus(null);
    const filterObj={};
    rules.forEach(r=>{if(r.field&&r.value)filterObj[r.field]=r.value;});
    try{
      const res=await fetch(`${API}/api/segments/dynamic`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...filterObj,source_system:normalizeSourceSystem(sourceSystem)})});
      const d=await res.json();
      setResult({...d,name:segName,rules:filterObj});
      setGateLoading(true);
      const gate=await runConsentGate(d.rows||[]);
      setGateResult(gate);setGateLoading(false);
    }catch{}
    setLoading(false);
  };


  // Live filter preview — resolves on every keystroke, no button needed

  const runAI=async()=>{
    if(!prompt.trim())return;
    setAiLoading(true);setAiResult(null);setAiGate(null);setAiError(null);setAiSaveStatus(null);
    try{
      const res=await fetch(`${API}/api/segment/generate?async=1`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({query:prompt,domain,name:aiName||"",source_system:normalizeSourceSystem(sourceSystem)}),
      });
      let d=await readJsonApiResponse(res,"Unable to generate segment");
      if(!res.ok||d.error){
        setAiError(d.error||"Unable to generate segment.");
        setAiLoading(false);
        return;
      }
      if(res.status===202||d.status==="queued"||d.status==="running"){
        d=await waitForSegmentJob(d);
      }
      setAiResult(d);
      setAiGateLoading(true);
      const gate=await runConsentGate(d.rows||[]);
      setAiGate(gate);setAiGateLoading(false);
    }catch(e){setAiError(e?.message||String(e));}
    setAiLoading(false);
  };

  const liveFilters = domain==="streaming"&&prompt.trim() ? resolveNLPToFilters(prompt) : {};

  const handleCreate=async(r,gate,rf,ps)=>{
    if(!r?.rules&&(r?.segment_id||r?.domain)){handleAICreate();return;}
    const eligibleCount=gate?.send??r.total??0;
    const description=Object.entries(r.rules).map(([k,v])=>`${k} = ${v}`).join(", ");
    const coverage=Math.round((r.total||0)/Math.max(Number(totalRecords)||1,1)*100);
    const candidate={name:r.name,description,count:r.total||0,total:r.total||0,coverage_pct:coverage,source_system:normalizeSourceSystem(sourceSystem),_custom:true,_status:"inactive",_count:r.total||0,_coverage:coverage,_rows:r.rows||[],_total:r.total||0,_refresh:rf||"Daily",_pipelineStatus:ps||"Draft",pipeline_status:ps||"Draft",_consentValidated:!!gate,_eligibleCount:eligibleCount,_gateResult:gate,filters:r.rules};
    setSaveStatus("saving");
    const saved=await saveAsCustomSegment(r.name,r.rules,r.rows||[],r.total||0,sourceSystem,candidate);
    if(!saved?.success||!saved?.segment){
      setSaveStatus("error");
      return;
    }
    onCreated({...candidate,...saved.segment,_custom:true,_status:saved.segment._status||"inactive",_pipelineStatus:saved.segment._pipelineStatus||saved.segment.pipeline_status||ps||"Draft"});
    onClose();
  };

  const handleAICreate=()=>{
    if(!aiResult)return;
    const count=Number(aiResult.count??aiResult.total??0);
    const coverage=Math.round(count/Math.max(Number(totalRecords)||1,1)*100);
    const eligibleCount=aiGate?.send??count;
    onCreated({
      id:aiResult.segment_id||`ai_${Date.now()}`,
      segment_id:aiResult.segment_id,
      name:aiResult.name,
      description:aiResult.description,
      count,
      coverage_pct:coverage,
      domain:aiResult.domain,
      source_system:aiResult.source_system||aiResult.sourceSystem||normalizeSourceSystem(sourceSystem),
      _ai:true,
      _custom:true,
      _status:aiResult._status||(aiResult.activation_status==="activated"?"active":"inactive"),
      _count:count,
      _coverage:coverage,
      _rows:aiResult.rows||[],
      _total:count,
      _refresh:"Daily",
      _pipelineStatus:aiResult._pipelineStatus||aiResult.pipeline_status||"Draft",
      filters:aiResult.filters||[],
      root:aiResult.root,
      sql_view:aiResult.sql_view,
      _consentValidated:!!aiGate,
      _eligibleCount:eligibleCount,
      _gateResult:aiGate,
    });
    onClose();
  };

  const handleAISaveAsCustom=async()=>{
    if(!aiResult)return;
    setAiSaveStatus("saving");
    const filters=aiFilterChips(aiResult).reduce((acc,f)=>({...acc,[f.attribute||f.key||"rule"]:f.value||f.label||""}),{});
    const saved=await saveAsCustomSegment(aiResult.name,filters,aiResult.rows||[],aiResult.count||0,aiResult.source_system||sourceSystem);
    setAiSaveStatus(saved?.success?"saved":"error");
    setTimeout(()=>setAiSaveStatus(null),3000);
  };

  const handleSaveAsCustom=async(r,setStatus)=>{
    setStatus("saving");
    const saved=await saveAsCustomSegment(r.name,r.rules,r.rows||[],r.total||0,sourceSystem);
    setStatus(saved?.success?"saved":"error");
    setTimeout(()=>setStatus(null),3000);
  };

  const fieldOptions=key=>FILTERABLE_FIELDS.find(f=>f.key===key)?.options||[];
  const fieldGroups=FILTERABLE_FIELDS.reduce((acc,f)=>{if(!acc[f.group])acc[f.group]=[];acc[f.group].push(f);return acc;},{});
  const labelStyle={fontSize:11,color:S.textPrimary,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:S.bgCard,border:`1px solid ${S.borderLight}`,borderRadius:12,width:660,maxHeight:"92vh",overflow:"auto",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:15,color:S.textPrimary}}>Create New Segment</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:S.textMuted,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>

        {!mode&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[{id:"manual",icon:"⚙️",label:"Manual",sub:"Define filter rules — field, operator, value"},{id:"ai",icon:"🤖",label:"AI",sub:"Describe your audience in plain English"}].map(m=>(
              <div key={m.id} onClick={()=>setMode(m.id)} style={{background:S.bgSecondary,border:`1px solid ${S.border}`,borderRadius:8,padding:"20px 16px",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=S.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=S.border}>
                <div style={{fontSize:28,marginBottom:10}}>{m.icon}</div>
                <div style={{fontWeight:600,fontSize:14,color:S.textPrimary,marginBottom:6}}>{m.label}</div>
                <div style={{fontSize:12,color:S.textMuted}}>{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {mode==="manual"&&(
          <div>
            <button onClick={()=>{setMode(null);setResult(null);setGateResult(null);setSaveStatus(null);}} style={{background:"none",border:"none",color:S.accentLight,cursor:"pointer",fontSize:12,padding:0,fontFamily:"inherit",marginBottom:16}}>← Back</button>
            <div style={{marginBottom:16}}>
              <div style={labelStyle}>Segment Name <span style={{color:S.error}}>*</span></div>
              <Input value={segName} onChange={e=>setSegName(e.target.value)} placeholder="e.g. High LTV Lapsing Fans" style={{width:"100%",boxSizing:"border-box",borderColor:!segName.trim()?"rgba(239,68,68,0.4)":S.border}}/>
              {!segName.trim()&&<div style={{fontSize:10,color:S.error,marginTop:4}}>Required before generating segment</div>}
            </div>
            <div style={{marginBottom:4}}>
              <div style={labelStyle}>Filter Rules</div>
              <div style={{fontSize:11,color:S.textMuted,marginBottom:8}}>Supports 1P behavioural and 2P/3P enrichment fields — Fan Score (SportsIQ), LTV Band & Segment Code (TrueSignal), Age Range & Income (DataBridge), DMA (GeoSignal).</div>
            </div>
            {rules.map((rule,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:11,color:S.textPrimary,fontWeight:600,minWidth:36,textAlign:"center"}}>{i===0?"WHERE":"AND"}</span>
                <Select value={rule.field} onChange={e=>updateRule(i,"field",e.target.value)} style={{flex:1}}>
                  {Object.entries(fieldGroups).map(([group,fields])=>(
                    <optgroup key={group} label={group}>{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
                  ))}
                </Select>
                <Select value={rule.value} onChange={e=>updateRule(i,"value",e.target.value)} style={{flex:1}}>
                  {fieldOptions(rule.field).map(o=><option key={o} value={o}>{o}</option>)}
                </Select>
                {rules.length>1&&<button onClick={()=>removeRule(i)} style={{background:"none",border:"none",color:S.textMuted,cursor:"pointer",fontSize:16,padding:"0 4px"}}>✕</button>}
              </div>
            ))}
            <button onClick={addRule} style={{background:"none",border:`1px dashed ${S.borderLight}`,borderRadius:4,color:S.textMuted,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:20}}>+ Add AND Condition</button>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
              <div><div style={labelStyle}>Refresh</div><Select value={refresh} onChange={e=>setRefresh(e.target.value)} style={{width:"100%"}}>{REFRESH_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}</Select></div>
              <div><div style={labelStyle}>Pipeline Status</div><Select value={pipelineStatus} onChange={e=>setPipelineStatus(e.target.value)} style={{width:"100%"}}>{PIPELINE_STATUS_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}</Select></div>
            </div>
            <Btn onClick={runManual} disabled={loading||!segName.trim()}>{loading?"Generating...":"⚡ Generate Segment"}</Btn>
            {result&&(
              <div style={{background:S.bgSecondary,border:`1px solid ${S.border}`,borderRadius:8,padding:14,marginTop:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:S.textPrimary}}>{result.name}</div>
                    <div style={{fontSize:12,color:S.textMuted}}><span style={{color:S.success,fontWeight:700}}>{result.total?.toLocaleString()}</span> customers matched</div>
                    <div style={{fontSize:11,color:S.textMuted,marginTop:4}}>Refresh: {refresh} · Status: {pipelineStatus}</div>
                  </div>
                  <div style={{display:"flex",gap:8,flexDirection:"column",alignItems:"flex-end"}}>
                    <Btn onClick={()=>handleCreate(result,gateResult,refresh,pipelineStatus)} disabled={saveStatus==="saving"}>{saveStatus==="saving"?"Creating…":"✓ Create Segment"}</Btn>
                    <Btn secondary onClick={()=>handleSaveAsCustom(result,setSaveStatus)} disabled={saveStatus==="saving"} style={{fontSize:12,padding:"5px 12px"}}>
                      {saveStatus==="saving"?"Saving…":saveStatus==="saved"?"  Saved!":saveStatus==="error"?"❌ Failed":"💾 Save as Custom Segment"}
                    </Btn>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {Object.entries(result.rules).map(([k,v])=><span key={k} style={{background:"rgba(0,102,204,0.12)",color:S.accentLight,border:`1px solid rgba(0,102,204,0.2)`,padding:"2px 8px",borderRadius:4,fontSize:11}}>{k} = {v}</span>)}
                </div>
                <ConsentValidationBanner gateResult={gateResult} loading={gateLoading}/>
              </div>
            )}
          </div>
        )}

        {mode==="ai"&&(
          <div>
            <button onClick={()=>{setMode(null);setResolved(null);setAiResult(null);setAiGate(null);setAiSaveStatus(null);}} style={{background:"none",border:"none",color:S.accentLight,cursor:"pointer",fontSize:12,padding:0,fontFamily:"inherit",marginBottom:16}}>← Back</button>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:600,color:S.textPrimary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Try an example</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {examples.map(ex=>(
                  <button key={ex} onClick={()=>{setPrompt(ex);setResolved(null);setAiResult(null);setAiError(null);}} style={{background:"rgba(0,102,204,0.1)",border:`1px solid rgba(0,102,204,0.2)`,borderRadius:4,color:S.textPrimary,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{ex}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:S.textPrimary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Segment Description</div>
              <textarea value={prompt} onChange={e=>{setPrompt(e.target.value);setResolved(null);setAiResult(null);setAiGate(null);}} placeholder={examples[0]?`e.g. ${examples[0]}`:"e.g. High value customers ready for activation"} style={{width:"100%",padding:"10px 12px",background:S.bgSecondary,border:`1px solid ${S.border}`,borderRadius:4,color:S.textPrimary,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:80,boxSizing:"border-box"}}/>
            </div>

            {/* ── Live filter chips — appear as user types ── */}
            {domain==="streaming"&&prompt.trim()&&Object.keys(liveFilters).length>0&&(
              <div style={{marginBottom:14,padding:"10px 12px",background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:6}}>
                <div style={{fontSize:10,color:S.success,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Detected filters</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.entries(liveFilters).map(([k,v])=>(
                    <span key={k} style={{background:"rgba(16,185,129,0.12)",color:S.success,border:`1px solid rgba(16,185,129,0.3)`,padding:"4px 10px",borderRadius:4,fontSize:12,fontWeight:600}}>{k} = {v}</span>
                  ))}
                </div>
              </div>
            )}
            {domain==="streaming"&&prompt.trim()&&Object.keys(liveFilters).length===0&&(
              <div style={{marginBottom:14,fontSize:11,color:S.textMuted,padding:"8px 10px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:6}}>
                No filters detected yet — try mentioning LTV, recency, fan score, age range, DMA, or segment code.
              </div>
            )}

            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:600,color:S.textPrimary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Segment Name (optional)</div>
              <Input value={aiName} onChange={e=>setAiName(e.target.value)} placeholder="e.g. High LTV Lapsing Sports Fans" style={{width:"100%",boxSizing:"border-box"}}/>
            </div>
            <Btn onClick={runAI} disabled={!prompt.trim()||aiLoading} style={{marginBottom:16}}>
              {loading?"Generating...":"⚡ Generate Segment"}
            </Btn>
            {aiError&&<div style={{marginBottom:12,padding:"10px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:6,fontSize:12,color:S.error}}>{aiError}</div>}
            {resolved&&aiResult==null&&!loading&&(
              <div style={{fontSize:11,color:S.textMuted,padding:"6px 8px",background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:4,marginBottom:12}}>
                🔒 Consent gate will run automatically. Suppressed users will be flagged.
              </div>
            )}
            {aiResult&&(
              <div style={{background:S.bgSecondary,border:`1px solid ${S.border}`,borderRadius:8,padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:S.textPrimary}}>{aiResult.name}</div>
                    <div style={{fontSize:12,color:S.textMuted}}><span style={{color:S.success,fontWeight:700}}>{(aiResult.count??aiResult.total??0).toLocaleString()}</span> customers matched</div>
                  </div>
                  <div style={{display:"flex",gap:8,flexDirection:"column",alignItems:"flex-end"}}>
                    <Btn onClick={()=>handleCreate(aiResult,aiGate,"Daily","Draft")}>✓ Create Segment</Btn>
                    <Btn secondary onClick={handleAISaveAsCustom} disabled={aiSaveStatus==="saving"} style={{fontSize:12,padding:"5px 12px"}}>
                      {aiSaveStatus==="saving"?"Saving…":aiSaveStatus==="saved"?"  Saved!":aiSaveStatus==="error"?"❌ Failed":"💾 Save as Custom Segment"}
                    </Btn>
                  </div>
                </div>
                {aiFilterChips(aiResult).length>0&&(
                  <div style={{marginTop:12,marginBottom:4}}>
                    <div style={{fontSize:10,color:S.success,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Detected Filters</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {aiFilterChips(aiResult).map((f,i)=>(
                        <span key={`${f.attribute||f.label||"filter"}-${i}`} style={{background:"rgba(16,185,129,0.12)",color:S.success,border:"1px solid rgba(16,185,129,0.3)",padding:"4px 10px",borderRadius:4,fontSize:12,fontWeight:600}}>
                          {f.label||`${f.attribute} ${f.operator||"="} ${f.value??""}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <ConsentValidationBanner gateResult={aiGate} loading={aiGateLoading}/>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AudiencesSegments({onSendToJourneyBuilder}){
  const navigate=useNavigate();
  const [searchParams]=useSearchParams();
  const getInitialSource=()=>{
    return normalizeSourceSystem(readSelectedSourceSystem("sports"));
  };
  const getInitialIndustry=()=>{
    return SOURCE_TO_INDUSTRY[getInitialSource()]||"Sports";
  };
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[sourceSystem,setSourceSystem]=useState(getInitialSource);
  const[industry,setIndustry]=useState(getInitialIndustry);
  const[search,setSearch]=useState("");
  const[showCreateModal,setShowCreateModal]=useState(false);
  const[showCreateMenu,setShowCreateMenu]=useState(false);
  const[aiSegments,setAiSegments]=useState([]);
  const[customSegments,setCustomSegments]=useState(()=>{try{return JSON.parse(localStorage.getItem("cdp_custom_segments")||"[]");}catch{return[];}});

  useEffect(()=>{try{localStorage.setItem("cdp_custom_segments",JSON.stringify(customSegments));}catch{}},[customSegments]);

  useEffect(()=>{
    fetch(`${API}/api/segment/list?domain=${encodeURIComponent(aiDomainForSource(sourceSystem))}&source_system=${encodeURIComponent(sourceSystem)}`)
      .then(r=>r.json())
      .then(d=>setAiSegments((d.segments||[]).map(seg=>hydrateCreatedSegment(seg,{ai:true}))))
      .catch(()=>{});
  },[sourceSystem]);

  useEffect(()=>{
    const nextSource=normalizeSourceSystem(readSelectedSourceSystem("sports"));
    const nextIndustry=SOURCE_TO_INDUSTRY[nextSource];
    if(nextSource&&nextSource!==sourceSystem)setSourceSystem(nextSource);
    if(nextIndustry&&nextIndustry!==industry)setIndustry(nextIndustry);
  },[searchParams, sourceSystem, industry]);

  useEffect(()=>{
    const syncSourceSystem=()=>{
      const nextSource=normalizeSourceSystem(readSelectedSourceSystem("sports"));
      const nextIndustry=SOURCE_TO_INDUSTRY[nextSource];
      if(nextSource&&nextSource!==sourceSystem)setSourceSystem(nextSource);
      if(nextIndustry&&nextIndustry!==industry)setIndustry(nextIndustry);
    };
    window.addEventListener("focus",syncSourceSystem);
    window.addEventListener("storage",syncSourceSystem);
    window.addEventListener("cdp-source-system-change",syncSourceSystem);
    return()=>{
      window.removeEventListener("focus",syncSourceSystem);
      window.removeEventListener("storage",syncSourceSystem);
      window.removeEventListener("cdp-source-system-change",syncSourceSystem);
    };
  },[sourceSystem,industry]);

  const[selectedSeg,setSelectedSeg]=useState(null);
  const[createMode,setCreateMode]=useState(null);
  const[members,setMembers]=useState(null);
  const[membersLoading,setMembersLoading]=useState(false);
  const[showSendModal,setShowSendModal]=useState(false);
  const[showOverlapModal,setShowOverlapModal]=useState(false);
  const[selectedJourneySegmentIds,setSelectedJourneySegmentIds]=useState([]);
  const[publishingJourneySegments,setPublishingJourneySegments]=useState(false);
  const[showCreatedSegments,setShowCreatedSegments]=useState(true);
  const[showPrebuiltSegments,setShowPrebuiltSegments]=useState(true);

  useEffect(()=>{
    setLoading(true);
    fetch(`${API}/api/segments?${sourceParam(sourceSystem)}`).then(r=>r.json()).then(d=>{
      setData(d);
      const persistedManual=(d.custom_segments||[])
        .filter(segment=>segment.definition_origin!=="AI custom segment")
        .map(segment=>hydrateCreatedSegment(segment));
      setCustomSegments(previous=>{
        const merged=new Map();
        persistedManual.forEach(segment=>merged.set(segment.segment_id||segment.id,segment));
        previous.forEach(segment=>{
          const key=segment.segment_id||segment.id;
          if(key&&!merged.has(key))merged.set(key,hydrateCreatedSegment(segment));
        });
        return [...merged.values()];
      });
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[sourceSystem]);

  const handleIndustryChange=(e)=>{
    const nextIndustry=e.target.value;
    setIndustry(nextIndustry);
    const nextSource=INDUSTRY_TO_SOURCE[nextIndustry];
    if(nextSource){
      writeSelectedSourceSystem(nextSource);
      setSourceSystem(nextSource);
    }
  };

  const handleSegmentClick=async(seg)=>{
    if(seg._activate){
      const key=seg.segment_id||seg.id;
      const activationResult=await pushToCRM(seg,segmentSourceSystem(seg,sourceSystem));
      if(!activationResult?.success){
        window.alert("Unable to activate this segment. Please try again.");
        return;
      }
      const activate=(s)=>{
        if((s.segment_id||s.id)!==key)return s;
        const currentStatus=resolveSegmentActivationStatus(s);
        return hydrateCreatedSegment({
          ...s,
          ...(activationResult.segment||{}),
          _status:"active",
          _pipelineStatus:JOURNEY_READY_STATUSES.includes(currentStatus)?currentStatus:"Ready for activation",
        },{ai:!!s._ai});
      };
      const nextCustomSegments=customSegments.map(activate);
      const nextAiSegments=aiSegments.map(activate);
      setCustomSegments(nextCustomSegments);
      setAiSegments(nextAiSegments);
      setSelectedSeg(prev=>prev&&activate(prev));
      const activatedForJourney=[...nextAiSegments,...nextCustomSegments]
        .filter(item=>item._status==="active")
        .map(item=>({
          id:item.segment_id||item.id,
          name:item.name,
          status:resolveSegmentActivationStatus(item),
          source:item._ai?"AI segment":"Custom segment",
          source_system:segmentSourceSystem(item,sourceSystem),
        }));
      onSendToJourneyBuilder?.(activatedForJourney);
      return;
    }
    const selectedKey=selectedSeg?.segment_id||selectedSeg?.id;
    const nextKey=seg?.segment_id||seg?.id;
    if(selectedKey===nextKey){setSelectedSeg(null);setMembers(null);return;}
    setSelectedSeg(seg);setMembers(null);
    if(isAiSegment(seg)){
      const sid=seg.segment_id||seg.id;
      setMembersLoading(true);
      fetch(`${API}/api/segment/${sid}`)
        .then(r=>r.json())
        .then(async d=>{
          const rows=d.rows||[];
          const gate=await runConsentGate(rows);
          const total=d.count||d.total||0;
          const withConsent={
            ...seg,
            _consentValidated:!!gate,
            _eligibleCount:gate?.send??total,
            _gateResult:gate,
          };
          setSelectedSeg(withConsent);
          setAiSegments(prev=>prev.map(s=>(s.segment_id||s.id)===sid?{...s,...withConsent}:s));
          setMembers({rows,total,columns:d.columns||[]});
          setMembersLoading(false);
        })
        .catch(()=>setMembersLoading(false));
      return;
    }
    if(seg._custom){setMembers({rows:seg._rows||[],total:seg._total||0});return;}
    setMembersLoading(true);
    const segSource=segmentSourceSystem(seg,sourceSystem);
    // FIX #2: enrichment=true (was enrich=true — backend requires exact param name)
    fetch(`${API}/api/segments/${seg.id}/members?limit=50&enrichment=true&${sourceParam(segSource)}`)
      .then(r=>r.json()).then(d=>{setMembers(d);setMembersLoading(false);}).catch(()=>setMembersLoading(false));
  };

  const[consentSummaries,setConsentSummaries]=useState({});
  const fetchConsentSummary=useCallback((seg)=>{
    const segId=typeof seg==="string"?seg:seg?.id;
    if(!segId)return;
    const segSource=typeof seg==="string"?sourceSystem:segmentSourceSystem(seg,sourceSystem);
    const summaryKey=`${segSource}:${segId}`;
    if(consentSummaries[summaryKey])return;
    fetch(`${API}/api/segments/${segId}/consent-summary?${sourceParam(segSource)}`).then(r=>r.json()).then(d=>setConsentSummaries(prev=>({...prev,[summaryKey]:d}))).catch(()=>{});
  },[consentSummaries,sourceSystem]);

  const handleCreated=(seg)=>{
    if(isAiSegment(seg)){
      const key=seg.segment_id||seg.id;
      setAiSegments(prev=>[seg,...prev.filter(s=>(s.segment_id||s.id)!==key)]);
      return;
    }
    setCustomSegments(prev=>[seg,...prev]);
  };
  const openCreate=(mode)=>{setShowCreateMenu(false);setCreateMode(mode);setShowCreateModal(true);};

  const prebuilt=(data?.segments||[]).filter(s=>{
    const matchIndustry=industry==="All Industries"||(SEGMENT_INDUSTRY[s.id]||[]).includes(industry);
    const matchSearch=!search||s.name.toLowerCase().includes(search.toLowerCase())||s.description.toLowerCase().includes(search.toLowerCase());
    return matchIndustry&&matchSearch;
  }).sort((a,b)=>{
    const countA=Number(a?.count??a?._count??0);
    const countB=Number(b?.count??b?._count??0);
    if(countB!==countA)return countB-countA;
    return String(a?.name??"").localeCompare(String(b?.name??""));
  });

  const allCreated=[...aiSegments,...customSegments].filter(s=>{
    const segmentSource=segmentSourceSystem(s,sourceSystem);
    const matchesSource=sourceSystem==="all"||segmentSource==="all"||segmentSource===sourceSystem;
    const matchesSearch=!search||s.name.toLowerCase().includes(search.toLowerCase());
    return matchesSource&&matchesSearch;
  });
  const custom=customSegments.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase()));
  const allSegments=[...allCreated,...prebuilt];
  const totalCount=data?.total_records||0;

  const journeyReadySegments=allSegments
    .filter(segment=>isJourneyReadySegment(segment)&&(!segment._custom||segment._status==="active"))
    .map(segment=>({
      ...segment,
      selectionId:segment.segment_id||segment.id,
      id:segment.segment_id||segment.id,
      name:segment.name,
      status:resolveSegmentActivationStatus(segment),
      source:segment._ai?"AI segment":segment._custom?"Custom segment":"Imported feed",
      source_system:segmentSourceSystem(segment,sourceSystem),
    }));
  const showPgaJourneys = industry === "Sports" || industry === "All Industries";

  const toggleJourneySelection=(segmentId)=>setSelectedJourneySegmentIds(current=>current.includes(segmentId)?current.filter(id=>id!==segmentId):[...current,segmentId]);

  const handleSendJourneySegments=async()=>{
    if(!selectedJourneySegmentIds.length||publishingJourneySegments)return;
    setPublishingJourneySegments(true);
    const selectedSegments=journeyReadySegments.filter(segment=>selectedJourneySegmentIds.includes(segment.selectionId));
    const published=await publishToJourneyBuilder(selectedSegments,sourceSystem);
    if(!published?.segments?.length){
      setPublishingJourneySegments(false);
      window.alert(published?.error||"Unable to publish the selected segments to Journey Builder.");
      return;
    }
    const journeySegments=published.segments.map(segment=>({
      id:segment.segment_id||segment.id,
      name:segment.name,
      status:segment.pipeline_status||segment._pipelineStatus||segment.status||"Ready for activation",
      source:segment.definition_origin||"Custom segment",
      source_system:segment.source_system,
    }));
    onSendToJourneyBuilder?.(journeySegments);
    setPublishingJourneySegments(false);
    setSelectedJourneySegmentIds([]);setShowSendModal(false);navigate("/campaigns-and-journeys");
  };

  // Member table columns — exact CSV field names, vendor badges in header
  const memberSourceSystem=segmentSourceSystem(selectedSeg,sourceSystem);
  const MEMBER_COLS=normalizeSourceSystem(memberSourceSystem)==="automotive"?[
    {key:"golden_id",label:"Golden ID",style:{fontFamily:"monospace",color:S.textMuted,fontSize:11}},
    {key:"full_name",label:"Full Name",style:{color:S.textPrimary}},
    {key:"email",label:"Email",style:{color:S.textSecondary}},
    {key:"customer_id",label:"Customer ID",style:{fontFamily:"monospace",color:S.textSecondary,fontSize:11}},
    {key:"household_id",label:"Household ID",style:{fontFamily:"monospace",color:S.textMuted,fontSize:11}},
    {key:"vehicle_id",label:"Vehicle ID",style:{fontFamily:"monospace",color:S.accentLight,fontSize:11}},
    {key:"loyalty_id",label:"Loyalty ID",style:{fontFamily:"monospace",color:S.textSecondary,fontSize:11}},
    {key:"membership_tier",label:"Loyalty Tier",style:{color:S.success,fontWeight:600}},
    {key:"zip",label:"ZIP",style:{fontFamily:"monospace",color:S.textSecondary,fontSize:11}},
  ]:[
    {key:"golden_id",label:"Golden ID",style:{fontFamily:"monospace",color:S.textMuted,fontSize:11}},
    {key:"full_name",label:"Full Name",style:{color:S.textPrimary}},
    {key:"email",label:"Email",style:{color:S.textSecondary}},
    {key:"fan_score",label:"Fan Score · 2P · SportsIQ",style:{color:S.accentLight,fontWeight:600}},
    {key:"ltv_band",label:"LTV Band · 3P · TrueSignal",style:{color:S.success,fontWeight:600}},
    {key:"estimated_age_range",label:"Age · 3P · DataBridge",style:{color:S.textSecondary}},
    {key:"churn_propensity_score",label:"Churn % · 3P · TrueSignal",style:{color:S.warning,fontWeight:600}},
  ];
  const getMemberCols=(seg,rows)=>{
    if(isAiSegment(seg)&&rows?.length){
      return Object.keys(rows[0]).map(key=>({
        key,
        label:key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
        style:{fontFamily:key.includes("id")?"monospace":"inherit",fontSize:key.includes("id")?11:12,color:S.textSecondary},
      }));
    }
    return MEMBER_COLS;
  };
  const memberCols=getMemberCols(selectedSeg,members?.rows);

  return(
    <div style={{fontFamily:"var(--font)",background:"var(--bg-primary)",minHeight:"100vh",color:"var(--text-primary)"}}>
      {/* <div className="page-header" style={{padding:0,marginBottom:20}}>
        <div className="page-title">Audiences & Segments</div>
        <div className="page-description">Pre-built segment library by industry · Create custom segments with consent enforcement</div>
      </div> */}

      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <select value={industry} onChange={handleIndustryChange} style={{padding:"7px 10px",borderRadius:4,border:`1px solid ${S.border}`,background:S.bgSecondary,color:S.textPrimary,fontSize:13,outline:"none",fontFamily:"inherit"}}>
          {INDUSTRY_OPTIONS.map(i=><option key={i} value={i}>{i}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search segments..." style={{flex:1,minWidth:160,padding:"8px 12px",borderRadius:4,border:`1px solid ${S.border}`,background:S.bgSecondary,color:S.textPrimary,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        <span style={{fontSize:12,color:S.textMuted,whiteSpace:"nowrap"}}>{allSegments.length} segments · {totalCount.toLocaleString()} profiles</span>
        <button onClick={()=>setShowOverlapModal(true)} style={{padding:"8px 14px",background:S.bgCard,color:S.textSecondary,border:`1px solid ${S.border}`,borderRadius:4,fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>🔁 Overlap Analysis</button>
        <Btn onClick={()=>setShowSendModal(true)} disabled={!journeyReadySegments.length} style={journeyReadySegments.length?{background:S.success}:undefined}>Send to Journey Builder</Btn>
        <div style={{position:"relative"}}>
          <button className="seg-btn is-primary" onClick={()=>setShowCreateMenu(m=>!m)} style={{padding:"8px 16px",background:S.accent,color:"#fff",border:"none",borderRadius:4,fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>+ Create Segment <span style={{fontSize:10}}>▼</span></button>
          {showCreateMenu&&(
            <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",background:S.bgCard,border:`1px solid ${S.borderLight}`,borderRadius:8,minWidth:180,zIndex:100,overflow:"hidden"}}>
              {[{mode:"manual",icon:"⚙️",label:"Manual",sub:"Define filter rules"},{mode:"ai",icon:"🤖",label:"AI",sub:"Describe in plain English"}].map((item,i)=>(
                <div key={item.mode}>
                  {i>0&&<div style={{height:1,background:S.border}}/>}
                  <button onClick={()=>openCreate(item.mode)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 16px",background:"none",border:"none",color:S.textPrimary,fontSize:13,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.background=S.bgHover} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <span>{item.icon}</span><div><div style={{fontWeight:600}}>{item.label}</div><div style={{fontSize:11,color:S.textMuted}}>{item.sub}</div></div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* {showPgaJourneys && (
        <div style={{marginBottom:18,background:S.bgCard,border:`1px solid ${S.border}`,borderRadius:8,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:S.textPrimary}}>PGA Sports Journeys Added</div>
              <div style={{fontSize:11,color:S.textMuted,marginTop:2}}>Pitch-ready journeys now available under Sports in Campaigns & Journeys.</div>
            </div>
            <Btn secondary onClick={()=>navigate("/campaigns-and-journeys")} style={{padding:"6px 12px",fontSize:12}}>Open Campaigns & Journeys</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
            {PGA_JOURNEY_SHOWCASE.map((journey)=>(
              <div key={journey.slug} style={{position:"relative",background:S.bgSecondary,border:`1px solid ${S.border}`,borderRadius:8,padding:"10px 12px 26px"}}>
                <div style={{fontSize:12,fontWeight:700,color:S.textPrimary,lineHeight:1.4}}>{journey.name}</div>
                <div style={{fontSize:10,color:S.textMuted,marginTop:4}}>{journey.section}</div>
                <span style={{position:"absolute",right:8,bottom:6,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:9999,border:"1px solid rgba(15,184,184,0.4)",background:"rgba(15,184,184,0.14)",color:S.textPrimary}}>PGA</span>
              </div>
            ))}
          </div>
        </div>
      )} */}

      {!loading && (
        <SegmentsOverview
          allSegments={allSegments}
        />
      )}

      {loading?(
        <div style={{textAlign:"center",padding:60,color:S.textMuted}}>
          <div style={{width:24,height:24,border:`3px solid ${S.border}`,borderTop:`3px solid ${S.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
          Loading segments...
          <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
      ):(
        <>
                    <div style={{marginBottom:16,border:`1px solid ${S.border}`,borderRadius:10,background:S.bgCard}}>
            <button onClick={()=>setShowCreatedSegments(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 12px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:11,color:S.success,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Created Segments ({allCreated.length})</span>
              <span style={{fontSize:12,color:S.textMuted,fontWeight:700}}>{showCreatedSegments ? "Hide" : "Show"}</span>
            </button>
            {showCreatedSegments && (
              <div style={{padding:"0 12px 12px"}}>
                {allCreated.length ? (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))",gap:10}}>
                    {allCreated.map(seg=><SegmentCard key={seg.segment_id||seg.id} seg={seg} onClick={handleSegmentClick} isSelected={(selectedSeg?.segment_id||selectedSeg?.id)===(seg.segment_id||seg.id)}/>)}
                  </div>
                ) : (
                  <div style={{fontSize:12,color:S.textMuted,padding:"6px 2px"}}>No created segments found.</div>
                )}
              </div>
            )}
          </div>

          <div style={{marginBottom:16,border:`1px solid ${S.border}`,borderRadius:10,background:S.bgCard}}>
            <button onClick={()=>setShowPrebuiltSegments(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 12px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:11,color:S.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Pre-built Segments ({prebuilt.length})</span>
              <span style={{fontSize:12,color:S.textMuted,fontWeight:700}}>{showPrebuiltSegments ? "Hide" : "Show"}</span>
            </button>
            {showPrebuiltSegments && (
              <div style={{padding:"0 12px 12px"}}>
                {prebuilt.length ? (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))",gap:10}}>
                    {prebuilt.map(seg=>{
                      const segSource=segmentSourceSystem(seg,sourceSystem);
                      const summaryKey=`${segSource}:${seg.id}`;
                      return (
                      <div key={seg.id} onMouseEnter={()=>fetchConsentSummary(seg)}>
                        <SegmentCard seg={{...seg,_consentSummary:consentSummaries[summaryKey]}} onClick={handleSegmentClick} isSelected={selectedSeg?.id===seg.id}/>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{fontSize:12,color:S.textMuted,padding:"6px 2px"}}>No pre-built segments found.</div>
                )}
              </div>
            )}
          </div>
{allSegments.length===0&&<div style={{textAlign:"center",padding:60,color:S.textMuted}}><div style={{fontSize:32,marginBottom:12}}>🔍</div><div style={{fontSize:14,fontWeight:600,color:S.textSecondary}}>No segments found</div><div style={{fontSize:13,marginTop:4}}>Try a different industry or search term</div></div>}
        </>
      )}

      {selectedSeg&&(
        <div style={{marginTop:20,background:"var(--bg-card)",border:`1px solid ${S.border}`,borderRadius:8,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontWeight:600,fontSize:14,color:S.textPrimary}}>{selectedSeg.name}</span>
                {selectedSeg._consentValidated&&<span style={{background:"rgba(16,185,129,0.12)",color:S.success,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:9999,border:"1px solid rgba(16,185,129,0.25)"}}>🔒 Consent Validated</span>}
              </div>
              <div style={{fontSize:12,color:S.textMuted,marginTop:2}}>
                {members?.total?.toLocaleString()||"..."} members
                {selectedSeg._eligibleCount!==undefined&&<span style={{color:S.success,marginLeft:6,fontWeight:600}}>· {selectedSeg._eligibleCount.toLocaleString()} consent-eligible</span>}
                {" · "}{selectedSeg.description}
              </div>
            </div>
            <button onClick={()=>{setSelectedSeg(null);setMembers(null);}} style={{background:"none",border:"none",color:S.textMuted,cursor:"pointer",fontSize:18,padding:"0 4px"}}>✕</button>
          </div>

          {selectedSeg._gateResult&&<ConsentValidationBanner gateResult={selectedSeg._gateResult} loading={false}/>}
          {!selectedSeg._gateResult&&members&&members.suppressed!==undefined&&<ConsentValidationBanner gateResult={{total:members.total_unfiltered,send:members.total,block:members.suppressed}} loading={false}/>}

          <ExportActivationBar seg={selectedSeg} members={members} sourceSystem={memberSourceSystem}/>

          {membersLoading?(
            <div style={{textAlign:"center",padding:24,color:S.textMuted}}>
              <div style={{width:20,height:20,border:`3px solid ${S.border}`,borderTop:`3px solid ${S.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 8px"}}/>
              Loading members...
            </div>
          ):members?.rows?.length>0?(
            <div style={{overflowX:"auto",border:`1px solid ${S.border}`,borderRadius:8,marginTop:12}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:S.bgSecondary}}>
                    {memberCols.map(col=>(
                      <th key={col.key} style={{padding:"10px 14px",textAlign:"left",color:S.textMuted,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:`1px solid ${S.border}`,whiteSpace:"nowrap"}}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.rows.map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${S.border}`}} onMouseEnter={e=>e.currentTarget.style.background=S.bgHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      {memberCols.map(col=>(
                        <td key={col.key} style={{padding:"7px 14px",...col.style}}>
                          {col.key==="churn_propensity_score"&&r[col.key]!=null
                            ?`${Math.round(Number(r[col.key])*100)}%`
                            :r[col.key]??"—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {members.total>50&&<div style={{padding:"10px 14px",fontSize:12,color:S.textMuted,borderTop:`1px solid ${S.border}`}}>Showing 50 of {members.total.toLocaleString()} members · Download full list using the export button above</div>}
            </div>
          ):(
            <div style={{textAlign:"center",padding:24,color:S.textMuted,fontSize:13,marginTop:12}}>No members found for this segment in current data.</div>
          )}
        </div>
      )}

      {showCreateModal&&<CreateSegmentModal initialMode={createMode} sourceSystem={sourceSystem} totalRecords={totalCount} onClose={()=>{setShowCreateModal(false);setShowCreateMenu(false);}} onCreated={handleCreated}/>}
      {showCreateMenu&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setShowCreateMenu(false)}/>}

      {showSendModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:S.bgCard,border:`1px solid ${S.borderLight}`,borderRadius:12,width:620,maxHeight:"80vh",overflow:"auto",padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:16,color:S.textPrimary}}>Send to Journey Builder</div>
              <div style={{display:"flex",gap:10}}><Btn secondary onClick={()=>{setSelectedJourneySegmentIds([]);setShowSendModal(false);}}>Close</Btn><Btn onClick={handleSendJourneySegments} disabled={!selectedJourneySegmentIds.length||publishingJourneySegments}>{publishingJourneySegments?"Publishing…":"Send to Journey Builder"}</Btn></div>
            </div>
            <div style={{fontSize:12,color:S.textMuted,marginBottom:14}}>Select one or more segments marked Production ready or Ready for activation.</div>
            <div style={{display:"grid",gap:8}}>
              {journeyReadySegments.map(segment=>(
                <label key={segment.selectionId} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 14px",borderRadius:8,border:`1px solid ${S.border}`,background:S.bgSecondary,cursor:"pointer"}}>
                  <input type="checkbox" checked={selectedJourneySegmentIds.includes(segment.selectionId)} onChange={()=>toggleJourneySelection(segment.selectionId)} style={{marginTop:2}}/>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:S.textPrimary}}>{segment.name}</div><div style={{fontSize:11,color:S.textMuted,marginTop:4}}>{segment.status} · {segment.source}</div></div>
                </label>
              ))}
              {!journeyReadySegments.length&&<div style={{fontSize:12,color:S.textMuted,padding:"10px 0"}}>No segments are currently marked Ready for activation or Production ready.</div>}
            </div>
          </div>
        </div>
      )}

      {showOverlapModal&&<AudienceOverlapModal allSegments={allSegments} sourceSystem={sourceSystem} onClose={()=>setShowOverlapModal(false)}/>}
    </div>
  );
}
