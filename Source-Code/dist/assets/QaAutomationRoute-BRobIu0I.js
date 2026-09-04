import{r as a,j as e,g as ke}from"./index-CYfFzljI.js";import{a as N,c as Se,S as we,I as Ee,q as Ne}from"./preflight-CrvggTst.js";function Ie({journey:s,preflight:w,runState:i,qaReport:j}){const r=Object.values(w.nodeReach).reduce((v,h)=>Math.max(v,h),0),p=a.useMemo(()=>new Set(s.nodes.map(v=>v.id)),[s]),m=s.nodes.length,b=s.edges.length,S=a.useMemo(()=>{const v=new Set;for(const h of i.visited)p.has(h)&&v.add(h);if(j)for(const h of j.walks)for(const I of h.steps)p.has(I.nodeId)&&v.add(I.nodeId);return v.size},[i.visited,j,p]);return e.jsxs("div",{className:"jo-cvtools",children:[e.jsxs("div",{className:"jo-cvtools__hint",children:[e.jsx("span",{className:"jo-mode-dot jo-mode-dot--test"}),"Test mode — Generate test suites and start a run from the QA Runs tab."]}),e.jsxs("div",{className:"jo-cvtools__right",children:[e.jsxs("div",{className:"jo-cvtools__stat",children:[e.jsx("span",{children:"Reachable"}),e.jsx("b",{children:r.toLocaleString()})]}),e.jsxs("div",{className:"jo-cvtools__stat",children:[e.jsx("span",{children:"Nodes"}),e.jsx("b",{children:m})]}),e.jsxs("div",{className:"jo-cvtools__stat",children:[e.jsx("span",{children:"Edges"}),e.jsx("b",{children:b})]}),e.jsxs("div",{className:"jo-cvtools__stat",children:[e.jsx("span",{children:"Coverage"}),e.jsxs("b",{children:[S,"/",m,m>0&&e.jsxs("span",{style:{color:"var(--ink-3)",fontWeight:400,marginLeft:4,fontSize:11},children:["(",Math.round(S/m*100),"%)"]})]})]})]})]})}const le={entry:{label:"Segment Qualification",glyph:"SQ",tone:"source",category:"Sources"},read_audience:{label:"Read Audience",glyph:"RA",tone:"source",category:"Sources"},unitary_event:{label:"Unitary Event",glyph:"UE",tone:"source",category:"Sources"},business_event:{label:"Business Event",glyph:"BE",tone:"source",category:"Sources"},reaction_event:{label:"Reaction",glyph:"RX",tone:"source",category:"Sources"},condition:{label:"Condition",glyph:"IF",tone:"logic",category:"Orchestration"},wait:{label:"Wait",glyph:"WT",tone:"logic",category:"Orchestration"},wait_until:{label:"Wait Until",glyph:"WU",tone:"logic",category:"Orchestration"},jump:{label:"Jump",glyph:"JP",tone:"logic",category:"Orchestration"},split:{label:"Holdout / A-B Split",glyph:"AB",tone:"accent",category:"Orchestration"},increment:{label:"Increment Metric",glyph:"++",tone:"logic",category:"Orchestration"},channel:{label:"Email",glyph:"EM",tone:"action",category:"Actions"},channel_email:{label:"Email",glyph:"EM",tone:"action",category:"Actions"},channel_push:{label:"Push Notification",glyph:"PN",tone:"action",category:"Actions"},channel_sms:{label:"SMS",glyph:"SM",tone:"action",category:"Actions"},channel_inapp:{label:"In-App Message",glyph:"IA",tone:"action",category:"Actions"},channel_web:{label:"Web Personalization",glyph:"WB",tone:"action",category:"Actions"},channel_card:{label:"Content Card",glyph:"CC",tone:"action",category:"Actions"},channel_dm:{label:"Direct Mail",glyph:"DM",tone:"action",category:"Actions"},code:{label:"Code",glyph:"{}",tone:"action",category:"Actions"},custom_action:{label:"Custom Action",glyph:"CA",tone:"action",category:"Actions"},ac_delivery:{label:"Campaign Delivery",glyph:"AC",tone:"action",category:"Actions"},update_audience:{label:"Update Audience",glyph:"UA",tone:"data",category:"Audience"},update_profile:{label:"Update Profile",glyph:"UP",tone:"data",category:"Audience"},data_source:{label:"Data Source",glyph:"DS",tone:"data",category:"Data sources"},aep_query:{label:"Profile Query",glyph:"QY",tone:"data",category:"Data sources"},external_ds:{label:"External Source",glyph:"EX",tone:"data",category:"Data sources"},suppression:{label:"Global Suppression",glyph:"SU",tone:"danger",category:"Analytics"},criteria:{label:"Frequency Cap",glyph:"FC",tone:"warn",category:"Analytics"},consent:{label:"Consent Gate",glyph:"CG",tone:"warn",category:"Analytics"},quiet_hours:{label:"Quiet Hours",glyph:"QH",tone:"warn",category:"Analytics"},exit:{label:"End",glyph:"ED",tone:"exit",category:"Exits"},end_success:{label:"End — Success",glyph:"OK",tone:"exit",category:"Exits"},end_error:{label:"End — Error",glyph:"ER",tone:"exit",category:"Exits"},end_timeout:{label:"End — Timeout",glyph:"TO",tone:"exit",category:"Exits"}},J=196,O=80;function qe({kind:s}){const w=le[s]??le.entry;return e.jsx("div",{className:`jo-node__glyph jo-node__glyph--${w.tone}`,children:e.jsx("span",{children:w.glyph})})}function Ae({from:s,to:w,label:i,highlight:j}){const r=s.x+J,p=s.y+O/2,m=w.x,b=w.y+O/2,S=Math.max(40,(m-r)*.45),v=`M ${r} ${p} C ${r+S} ${p}, ${m-S} ${b}, ${m} ${b}`,h=(r+m)/2,I=(p+b)/2-6;return e.jsxs("g",{className:"jo-edge"+(j?" is-on":""),children:[e.jsx("path",{d:v,fill:"none"}),i?e.jsxs("g",{transform:`translate(${h}, ${I})`,children:[e.jsx("rect",{x:"-22",y:"-10",width:"44",height:"18",rx:"9"}),e.jsx("text",{textAnchor:"middle",y:3,children:i})]}):null]})}function Re({journey:s,selectedId:w,onSelect:i,runState:j,preflight:r}){const p=a.useRef(null),[m,b]=a.useState(.6),[S,v]=a.useState({x:12,y:10}),[h,I]=a.useState(null);a.useEffect(()=>{if(!p.current||s.nodes.length===0)return;const o=p.current.clientWidth,f=p.current.clientHeight,x=Math.max(...s.nodes.map(d=>d.x+J))+60,q=Math.max(...s.nodes.map(d=>d.y+O))+60,E=(o-32)/x,M=(f-32)/q;b(Math.max(.7,Math.min(.9,Math.min(E,M)))),v({x:16,y:16})},[s.id]);const W=a.useMemo(()=>Object.fromEntries(s.nodes.map(o=>[o.id,o])),[s.nodes]),C=j.visited,U=j.active;function Z(o){!o.ctrlKey&&!o.metaKey||(o.preventDefault(),b(f=>Math.min(1.4,Math.max(.5,f-o.deltaY*.0015))))}function ee(o){o.target.closest(".jo-node")||I({sx:o.clientX,sy:o.clientY,px:S.x,py:S.y})}a.useEffect(()=>{if(!h)return;function o(x){v({x:h.px+(x.clientX-h.sx),y:h.py+(x.clientY-h.sy)})}function f(){I(null)}return window.addEventListener("mousemove",o),window.addEventListener("mouseup",f),()=>{window.removeEventListener("mousemove",o),window.removeEventListener("mouseup",f)}},[h]);const Q=r.nodeReach,_=s.nodes.length>0?Math.max(...s.nodes.map(o=>o.x+J))+120:1800,z=s.nodes.length>0?Math.max(...s.nodes.map(o=>o.y+O))+120:400;return e.jsxs("div",{className:"jo-canvas mode-test",ref:p,onWheel:Z,onMouseDown:ee,children:[e.jsx("div",{className:"jo-canvas__grid"}),e.jsxs("div",{className:"jo-canvas__inner",style:{transform:`translate(${S.x}px, ${S.y}px) scale(${m})`},children:[e.jsxs("svg",{className:"jo-canvas__edges",width:_,height:z,children:[e.jsx("defs",{children:e.jsx("marker",{id:"arr",viewBox:"0 0 10 10",refX:"9",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto",children:e.jsx("path",{d:"M0,0 L10,5 L0,10 z"})})}),s.edges.map((o,f)=>{const[x,q,E]=o,M=W[x],d=W[q];return!M||!d?null:e.jsx(Ae,{from:M,to:d,label:E,highlight:C.has(x)&&C.has(q)},f)})]}),s.nodes.map(o=>{const f=le[o.type],x=o.id===w,q=o.id===U,E=C.has(o.id);return e.jsxs("div",{className:"jo-node"+(x?" is-selected":"")+(q?" is-active":"")+(E?" is-visited":"")+` jo-node--${o.type}`,style:{left:o.x,top:o.y,width:J,height:O},onClick:M=>{M.stopPropagation(),i(o.id)},children:[e.jsx(qe,{kind:o.type}),e.jsxs("div",{className:"jo-node__body",children:[e.jsx("div",{className:"jo-node__kind",children:f.label}),e.jsx("div",{className:"jo-node__title",children:o.title}),e.jsx("div",{className:"jo-node__sub",children:o.sub})]}),Q[o.id]!=null?e.jsx("div",{className:"jo-node__reach",children:Q[o.id].toLocaleString()}):null,o.meta?e.jsx("div",{className:"jo-node__meta",children:o.meta}):null]},o.id)})]}),e.jsxs("div",{className:"jo-canvas__controls",children:[e.jsx("button",{type:"button",onClick:()=>b(o=>Math.min(1.4,o+.1)),title:"Zoom in",children:"+"}),e.jsx("button",{type:"button",onClick:()=>b(o=>Math.max(.5,o-.1)),title:"Zoom out",children:"−"}),e.jsx("button",{type:"button",onClick:()=>{if(!p.current||s.nodes.length===0)return;const o=p.current.clientWidth,f=p.current.clientHeight,x=Math.max(...s.nodes.map(E=>E.x+J))+60,q=Math.max(...s.nodes.map(E=>E.y+O))+60;b(Math.max(.7,Math.min(.9,Math.min((o-32)/x,(f-32)/q)))),v({x:16,y:16})},title:"Reset",children:"⤺"}),e.jsxs("div",{className:"jo-canvas__zoom",children:[Math.round(m*100),"%"]})]}),e.jsxs("div",{className:"jo-canvas__legend",children:[e.jsxs("span",{children:[e.jsx("i",{className:"lg lg--danger"})," Suppression"]}),e.jsxs("span",{children:[e.jsx("i",{className:"lg lg--warn"})," Criteria"]}),e.jsxs("span",{children:[e.jsx("i",{className:"lg lg--accent"})," Holdout split"]}),e.jsxs("span",{children:[e.jsx("i",{className:"lg lg--neutral"})," Step"]})]})]})}const he={status:"idle",visited:new Set,active:null,logs:[],progress:0};function Ce(){var be,pe;const[s,w]=a.useState([]),[i,j]=a.useState(null),[r,p]=a.useState(null),[m,b]=a.useState([]),[S,v]=a.useState(null),[h,I]=a.useState(new Set),[W,C]=a.useState(he),[U,Z]=a.useState(null),[ee,Q]=a.useState([]),[_,z]=a.useState(null),[o,f]=a.useState(!1),[x,q]=a.useState([]),[E,M]=a.useState(null),[d,te]=a.useState([]),[T,G]=a.useState(null),[ie,X]=a.useState(!1),[fe,de]=a.useState(null),[oe,ue]=a.useState("profiles"),[me,ae]=a.useState(null);a.useEffect(()=>{let n=!1;return(async()=>{var u;try{const t=await N.listJourneys();if(n)return;const c=((u=t[0])==null?void 0:u.id)??"season-ticket-renewal-journey",[y,R]=await Promise.all([N.getJourney(c),N.listSegments(c)]);if(n)return;w(t),j(y),p(y.id),Q(R)}catch(t){if(n)return;Z(t instanceof Error?t.message:String(t))}})(),()=>{n=!0}},[]),a.useEffect(()=>{if(!r||!i||r===i.id)return;let n=!1;return(async()=>{try{const[u,t]=await Promise.all([N.getJourney(r),N.listSegments(r)]);if(n)return;j(u),Q(t),z(c=>c&&t.some(y=>y.id===c)?c:null),te([]),G(null),q([]),M(null),b([]),I(new Set),v(null),C(he),se([]),re(null)}catch{}})(),()=>{n=!0}},[r,i]);const _e=a.useMemo(()=>((i==null?void 0:i.nodes)??[]).find(n=>n.id===S)??null,[i,S]),ne=a.useMemo(()=>i?Se(i,m):null,[i,m]),xe=a.useMemo(()=>{var n,u;return((n=x.find(t=>t.id===E))==null?void 0:n.report)??((u=x[x.length-1])==null?void 0:u.report)??null},[x,E]),[L,se]=a.useState([]),[A,re]=a.useState(null),ge=a.useMemo(()=>L.length===0?W:{status:"passed",visited:new Set(L),active:L[L.length-1]??null,progress:100,logs:[]},[L,W]),Y=a.useCallback((n,u)=>{const t=n,c=t.globalConsent??t.consent,y=typeof c=="boolean"?c:c==null?!0:!!c,R=typeof t.fcap=="number"?t.fcap:Number(t.fcap)||0,k=(t.archetype??"").toLowerCase(),l=t.suppressionReason,P=l==="holdout_segment"||t.holdout===!0||k==="holdout"?"holdout":l==="no_consent"||l==="experiment_holdback"||t.category==="ineligible"||k==="ineligible"||k==="consent_suppressed"||k==="experiment_holdback"?"suppressed":R>=3||k==="fcap_capped"?"fcap-risk":k.startsWith("experiment_variant")?"control":"test";return{id:t.id??`gen_${u}`,name:typeof t.name=="string"?t.name:"Generated",region:typeof t.region=="string"?t.region:"—",age:typeof t.age=="number"?t.age:30,consent:y,fcap:R,lastSend:typeof t.lastSend=="string"?t.lastSend:"0d",segment:t.archetype??"",tag:P,scenario:t.scenario,archetype:t.archetype}},[]),B=a.useCallback(async()=>{if(!r||!_)return null;X(!0),b([]);try{const{synthId:n}=await N.synthProfiles({journeyId:r,segmentId:_}),u=Date.now(),t=5*60*1e3;for(;;){if(await new Promise(y=>setTimeout(y,2e3)),Date.now()-u>t)throw new Error("Synth job timed out after 5 minutes.");const c=await N.getSynthStatus(n);if(c.status==="done"){const y=c.suites??[],R=c.profiles??[],k={id:`plan-${Date.now()}`,createdAt:new Date().toISOString(),journeyId:r,segmentId:_,suites:y,profiles:R};return te(l=>[...l,k]),G(k.id),b(R.map((l,P)=>Y(l,P))),I(new Set),k}if(c.status==="failed")throw new Error(c.error||"Synth job failed")}}catch(n){return console.error(n),null}finally{X(!1)}},[r,_,Y]),ye=a.useCallback(async(n,u)=>{if(!r||!_||!n.trim())return;const t=d.find(c=>c.id===T)??d[d.length-1];if(t){X(!0),ae(null);try{const c=t.profiles.map(l=>({id:l.id??"",name:l.name??""})),{synthId:y}=await N.extendProfiles({journeyId:r,segmentId:_,instruction:n,existingProfiles:c,count:u}),R=Date.now(),k=5*60*1e3;for(;;){if(await new Promise(P=>setTimeout(P,2e3)),Date.now()-R>k)throw new Error("Extend job timed out after 5 minutes.");const l=await N.getSynthStatus(y);if(l.status==="done"){const P=l.profiles??[],F=[...t.profiles,...P],$={id:`plan-${Date.now()}`,createdAt:new Date().toISOString(),journeyId:t.journeyId,segmentId:t.segmentId,suites:t.suites,profiles:F};te(g=>[...g,$]),G($.id),b(F.map((g,D)=>Y(g,D)));break}if(l.status==="failed")throw new Error(l.error||"Extend job failed")}}catch(c){const y=c instanceof Error?c.message:String(c);console.error("Extend failed:",y),ae(y)}finally{X(!1)}}},[r,_,d,T,Y]),H=a.useCallback(async(n,u)=>{var k;if(!r||!_)return;const t=r,c=_,y=T??((k=d[d.length-1])==null?void 0:k.id)??null,R=u.length;f(!0),C({status:"running",visited:new Set,active:null,logs:[],progress:0});try{const{runId:l}=await N.startQARun({journeyId:t,segmentId:c,suites:n,baseProfiles:u}),P=g=>{const D={id:l,createdAt:new Date().toISOString(),journeyId:t,segmentId:c,planId:y,profileCount:R,report:g};q(ce=>[...ce.filter(ve=>ve.id!==l),D]),M(l),de(null)},F=async(g,D,ce)=>{f(!1),C(V=>({...V,status:D,progress:100,duration:ce}));try{P(await N.getReport(g))}catch(V){console.error(V)}};let $=null;N.subscribeRun(l,{onStep:g=>{C(D=>({...D,status:"running",active:g.nodeId,progress:g.progress,logs:[...D.logs,{ts:g.ts,level:g.level,node:g.node,label:g.label,msg:g.msg}]}))},onDone:async g=>{$==null||$(),await F(l,g.status,g.duration)},onError:()=>{console.warn("SSE stream failed, switching to poll-based fallback for run",l),C(g=>({...g,logs:[...g.logs,{ts:new Date().toLocaleTimeString("en",{hour12:!1}),level:"warn",node:"stream",label:"Connection",msg:"Live stream unavailable — polling for results…"}]})),$=N.pollReport(l,g=>{f(!1),C(D=>({...D,status:"passed",progress:100})),P(g)},()=>{console.error("Poll gave up waiting for report",l),f(!1)})}})}catch(l){console.error(l),f(!1)}},[r,_]),K=a.useCallback(n=>{if(h.size===0)return n;const u=n.filter(t=>h.has(String(t.id)));return u.length>0?u:n},[h]),je=a.useCallback(async()=>{const n=d.find(t=>t.id===T)??d[d.length-1],u=(n==null?void 0:n.suites)??[];u.length===0||!n||await H(u,K(n.profiles))},[d,T,H,K]);return a.useCallback(async()=>{if(!r||!_)return;const n=d.find(t=>t.id===T)??d[d.length-1],u=(n==null?void 0:n.suites)??[];if(u.length===0){const t=await B();if(!t||t.suites.length===0)return;await H(t.suites,t.profiles)}else n&&await H(u,K(n.profiles))},[r,_,d,T,B,H,K]),U?e.jsx("div",{className:"jo jo-bootstrap-error",children:e.jsxs("div",{children:[e.jsx("h2",{children:"Could not reach the API"}),e.jsx("p",{children:U}),e.jsxs("p",{className:"hint",children:["Make sure the FastAPI server is running on ",e.jsx("code",{children:"localhost:8000"})," — see",e.jsx("code",{children:" README.md"}),"."]})]})}):!i||!ne?e.jsx("div",{className:"jo jo-bootstrap",children:e.jsx("div",{children:"Loading journey…"})}):e.jsxs("div",{className:"jo mode-test",children:[e.jsx(we,{journey:i,journeys:s,onSelectJourney:p,segments:ee,selectedSegmentId:_,onSegmentChange:z,qaRunning:o,synthRunning:ie,onGenerateAndRun:async()=>{ue("qa"),await B()},canSynth:!!r&&!!_,hasSuites:((pe=(be=d.find(n=>n.id===T)??d[d.length-1])==null?void 0:be.suites)==null?void 0:pe.length)>0}),e.jsxs("div",{className:`jo-workspace${oe==="qa"?" jo-workspace--qa":""}`,children:[e.jsxs("main",{className:"jo-main",children:[e.jsx(Ie,{journey:i,preflight:ne,runState:ge,qaReport:xe}),e.jsx(Re,{journey:i,selectedId:S,onSelect:v,runState:ge,preflight:ne}),oe==="qa"&&A&&e.jsxs("div",{className:`qa-sim-overlay qa-sim-overlay--${A.verdict}`,children:[e.jsx("button",{type:"button",className:"qa-sim-overlay__close",onClick:()=>{re(null),se([])},"aria-label":"Dismiss",children:"×"}),e.jsxs("div",{className:"qa-sim-overlay__head",children:[e.jsx("span",{className:`qa-sim-overlay__verdict qa-sim-overlay__verdict--${A.verdict}`,children:A.verdict.toUpperCase()}),e.jsx("span",{className:"qa-sim-overlay__name",children:A.profileName})]}),e.jsxs("div",{className:"qa-sim-overlay__stats",children:[e.jsxs("span",{className:"qa-sim-overlay__stat qa-sim-overlay__stat--pass",children:[A.pass," pass"]}),e.jsxs("span",{className:"qa-sim-overlay__stat qa-sim-overlay__stat--fail",children:[A.fail," fail"]}),e.jsxs("span",{className:"qa-sim-overlay__stat qa-sim-overlay__stat--skipped",children:[A.skipped," did not execute"]})]}),e.jsxs("div",{className:"qa-sim-overlay__foot",children:[A.steps," node",A.steps===1?"":"s"," visited",A.stopped&&e.jsx("span",{className:"qa-sim-overlay__stopped",children:"· stopped early"})]})]})]}),e.jsx(Ee,{journey:i,selectedNode:_e,profiles:m,setProfiles:b,selectedProfileIds:h,setSelectedProfileIds:I,qaRuns:x,activeRunId:E,onSelectRun:M,testPlans:d,activePlanId:T,onSelectPlan:G,onSynthSuites:B,onExtendSuites:ye,extendError:me,clearExtendError:()=>ae(null),synthRunning:ie,onRunQA:je,qaRunning:o,qaProgress:W.progress,qaLogs:W.logs,canSynth:!!r&&!!_,selectedWalkId:fe,onSelectWalk:de,onPathChange:se,onSimResult:re,activeTab:oe,onTabChange:ue})]})]})}const Me=`
:host {
  --accent: #2c5cdf; --accent-ink: #1e3fa0; --accent-soft: #eef2fc;
  --bg: #f5f6f8; --bg-deep: #ecedf1; --bg-subtle: #fafbfc; --panel: #ffffff;
  --ink: #15171a; --ink-2: #46484e; --ink-3: #74767c; --ink-4: #9b9da4;
  --line: #e2e3e8; --line-2: #ebecf0; --line-3: #d5d7dd;
  --ok: #117a45; --ok-bg: #e3f4ea;
  --warn: #9b6a14; --warn-bg: #fbf1dc;
  --danger: #b3261e; --danger-bg: #fbe5e3;
  --info-bg: #e9eef9; --log-bg: #0f1115;
  --shadow-sm: 0 1px 2px rgba(20,22,26,0.04), 0 1px 1px rgba(20,22,26,0.03);
  --shadow-md: 0 4px 14px rgba(20,22,26,0.07), 0 1px 3px rgba(20,22,26,0.05);
  --shadow-lg: 0 18px 40px rgba(20,22,26,0.12), 0 6px 18px rgba(20,22,26,0.08);
}`,Pe=`
/* Node glyphs */
.jo-node__glyph--source  { background: rgba(74,126,255,0.18); color: #8ab4ff; }
.jo-node__glyph--logic   { background: rgba(138,155,181,0.14); color: #8a9bb5; }
.jo-node__glyph--action  { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-node__glyph--data    { background: rgba(167,139,250,0.16); color: #c4b5fd; }
.jo-node__glyph--accent  { background: rgba(74,126,255,0.16); color: #8ab4ff; }
.jo-node__glyph--danger  { background: rgba(248,113,113,0.14); color: #f87171; }
.jo-node__glyph--warn    { background: rgba(251,191,36,0.14); color: #fbbf24; }
.jo-node__glyph--exit    { background: rgba(90,104,128,0.2); color: #8a9bb5; }
.jo-node__glyph--neutral { background: rgba(90,104,128,0.14); color: #8a9bb5; }

/* Canvas */
.jo-canvas__grid { background-image: radial-gradient(circle, rgba(138,155,181,0.12) 1px, transparent 1px); }
.jo-edge path { stroke: rgba(90,104,128,0.5); }
.jo-edge rect { fill: var(--bg-subtle); stroke: var(--line-3); }
.jo-edge text { fill: var(--ink-3); }
.jo-node { background: var(--panel); border-color: var(--line-2); }
.jo-node__meta { background: var(--bg-subtle); border-top-color: var(--line-2); }
.jo-node__reach { background: var(--bg-subtle); border-color: var(--line-2); color: var(--ink-2); }

/* Panels */
.jo-globalhead, .jo-subhead, .jo-cvtools, .jo-leftrail, .jo-inspector, .jo-run { background: var(--panel); }
.jo-table th { background: var(--bg-subtle); }
.jo-table tr.is-sel { background: var(--accent-soft); }

/* Tags */
.jo-tag--test    { background: rgba(74,126,255,0.16); color: #8ab4ff; }
.jo-tag--control { background: rgba(167,139,250,0.16); color: #c4b5fd; }
.jo-tag--holdout { background: rgba(52,211,153,0.14); color: #34d399; }

/* Pills */
.jo-pill--ok   { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-pill--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }

/* Suite counts (jo- prefix) */
.jo-qa-suite__count--pass { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-qa-suite__count--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.jo-qa-suite__count--fail { background: rgba(248,113,113,0.14); color: #f87171; }

/* KPI ok */
.jo-kpi--ok { border-color: rgba(52,211,153,0.2); background: rgba(52,211,153,0.07); }
.jo-kpi--ok .jo-kpi__v { color: #34d399; }

/* Suites */
.jo-suite { background: var(--panel); }
.jo-suite:hover { background: var(--bg-subtle); border-color: var(--line-3); }
.jo-suite.is-selected { background: rgba(74,126,255,0.12); border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }

/* Cards */
.jo-card { background: var(--bg-subtle); }

/* Warn banners */
.jo-warn--warn { background: rgba(251,191,36,0.12); color: #fbbf24; border-left-color: #fbbf24; }
.jo-warn--info { background: rgba(74,126,255,0.12); color: #8ab4ff; border-left-color: var(--accent); }

/* Results */
.jo-results__summary { border-color: var(--line-2); background: var(--bg-subtle); }

/* Journey + Segment picker dropdowns — hardcoded for guaranteed visibility in dark mode */
.jo-jpicker__menu { background: #1a2540; border: 1px solid #2a3d60; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.5); }
.jo-jpicker__search { background: #121c30; border-bottom-color: #2a3d60; }
.jo-jpicker__item:hover { background: #1f2f4a; }
.jo-jpicker__item.is-active { background: rgba(74,126,255,0.18); }
.jo-jpicker__item-name { color: #dde6f5; }
.jo-jpicker__item-meta { color: #576880; }
.jo-jpicker__search input { color: #dde6f5; }
.jo-spicker__menu { background: #1a2540; border: 1px solid #2a3d60; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.5); }
.jo-spicker__item { color: #dde6f5; }
.jo-spicker__item:hover { background: #1f2f4a; }
.jo-spicker__item.is-active { background: rgba(74,126,255,0.18); }
.jo-spicker__item.is-active .jo-spicker__item-name { color: #8ab4ff; }
.jo-spicker__item-size { color: #576880; }
/* Journey picker button — visible dropdown affordance */
.jo-jpicker__btn { background: #0d1828; border-color: #2a3d60; }
.jo-jpicker__btn:hover { background: #131f35; border-color: #3a5080; }
.jo-jpicker__btn.is-open { background: #101e32; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(74,126,255,0.18); }
.jo-jpicker__name { color: #dde6f5; }
.jo-jpicker__chev { color: #576880; }

/* Segment picker button — visible dropdown affordance */
.jo-spicker__btn { background: #0d1828; border-color: #2a3d60; }
.jo-spicker__btn:hover { background: #131f35; border-color: #3a5080; }
.jo-spicker.is-open .jo-spicker__btn { background: #101e32; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(74,126,255,0.18); }
.jo-spicker__name { color: #dde6f5; }

/* Inputs default */
input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea { background: var(--bg-deep); color: var(--ink); }
input:not([type="checkbox"]):not([type="radio"]):focus, select:focus, textarea:focus { background: var(--panel); border-color: var(--accent); }

/* Walk verdicts */
.qa-walk__verdict--pass { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-walk__verdict--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.qa-walk__verdict--fail { background: rgba(248,113,113,0.14); color: #f87171; }

/* Walk row */
.qa-walk:hover { background: var(--bg-subtle); border-color: var(--line-3); }
.qa-walk-detail { background: var(--bg-deep); }
.qa-walk-detail--warn { border-color: var(--warn); }

/* Scenario / suite-preview head hover */
.qa-scenario__head:hover { background: var(--bg-subtle); }
.qa-suite-preview__head:hover { background: var(--bg-subtle); }

/* Tag chips */
.qa-tagchip--eligible { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-tagchip--variant  { background: rgba(74,126,255,0.14); color: #8ab4ff; }

/* Category badges */
.qa-cat--eligible  { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-cat--ineligible { background: rgba(248,113,113,0.14); color: #f87171; }

/* Suite counts (no prefix) */
.qa-suite__count--pass { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-suite__count--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.qa-suite__count--fail { background: rgba(248,113,113,0.14); color: #f87171; }

/* Run pill */
.qa-run-pill--warn .qa-run-pill__verdict { color: var(--warn); }

/* Extend example hover & error */
.jo-extend__example:hover { background: var(--bg-subtle); color: var(--ink); }
.jo-extend__error { background: rgba(248,113,113,0.12); color: #f87171; border-color: rgba(248,113,113,0.25); }
.jo-extend__error-close { color: #f87171; }

/* Profile group dot */
.qa-pgroup__dot--eligible { background: #34d399; }

/* Profile cards — visible border in dark mode */
.qa-pcard { border-color: #2a3d60; background: #0d1828; }
.qa-pcard:hover { background: #131f35; border-color: #3a5080; }
.qa-pcard.is-active { border-color: var(--accent); background: rgba(74,126,255,0.12); }
.qa-pgroup__head { color: #8aa3c0; }
.qa-pcard__name { color: #dde6f5; }
.qa-pcard__sub { color: #576880; }
.qa-pcard__avatar { background: rgba(74,126,255,0.2); color: #8ab4ff; }

/* QA suite cards — visible border in dark mode */
.qa-scard { border-color: #2a3d60; background: #0d1828; }
.qa-scard__head:hover { background: #131f35; }
.qa-scard__name { color: #dde6f5; }
.qa-scard__desc { color: #576880; }
.qa-scard.is-open .qa-scard__head { background: #101e32; }

/* Workbench columns */
.qa-wb__col { border-color: #2a3d60; background: var(--panel); }
`;function De({themeMode:s="dark",initialJourneyId:w=null,autoSynth:i=!1}){const j=a.useRef(null),[r,p]=a.useState(null);a.useEffect(()=>{j.current&&p(b=>b??j.current.shadowRoot??j.current.attachShadow({mode:"open"}))},[]);const m=a.useMemo(()=>{const b=Ne.replace(":root {",":host {").replace("body {",".jo {");return s==="light"?b+Me:b+Pe},[s]);return e.jsx("div",{ref:j,style:{flex:1,minHeight:0,display:"block"},children:r?ke.createPortal(e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`:host{display:block;height:100%;}${m}`}),e.jsx(Ce,{initialJourneyId:w,autoSynth:i})]}),r):null})}function $e({themeMode:s="dark"}){return e.jsxs("section",{style:{minHeight:"100%",display:"flex",flexDirection:"column"},children:[e.jsxs("div",{className:"page-header",children:[e.jsx("div",{className:"page-title",children:"QA & Automation"}),e.jsx("div",{className:"page-description",children:"Select a journey and segment, generate profiles and QA suites, then run validation end to end."})]}),e.jsx("div",{className:"page-body",style:{flex:1,minHeight:0,display:"flex",flexDirection:"column"},children:e.jsx("div",{style:{flex:1,minHeight:760,display:"flex",overflow:"hidden",borderRadius:12,border:"1px solid var(--border)",background:"var(--bg-primary)",boxShadow:"var(--shadow-lg)"},children:e.jsx(De,{themeMode:s})})})]})}export{De as QaAutomationShadowHost,$e as default};
