import{r as m,j as e,c as Vn,a as Zt,f as rs,g as ls}from"./index-CYfFzljI.js";import{a as De,c as os,S as cs,I as ds,q as us}from"./preflight-CrvggTst.js";import{E as Qe,c as ps,f as ms,a as In,P as Ke,S as An,g as un,b as yt,d as hs,e as gs,m as xs,h as fs,i as bs,j as vs,n as Rn,k as ys,l as js,o as ws,p as Ns,q as ks}from"./CPieChart-DYu-cTR0.js";import{u as Ss,b as Cs,c as As,i as $e,r as ea,D as na,d as tt,e as Yn,s as jt,f as wt,w as Nt,Z as ta,g as aa,h as sa,j as ia,k as ra,l as at,m as kn,n as st,o as _s,p as $s,q as la,t as oa,v as Es,x as ca,y as kt,z as Ds,A as Is,B as Rs,E as Ps,F as Wn,L as zn,G as Mn,H as zs,I as Ms,J as Ts,S as Ls,K as Os,M as Bs,N as Tn,O as da,Q as Fs,U as Ws,V as Js,W as qs,_ as Hs,$ as Gs,a0 as Ks,a1 as Us,a2 as Vs,a3 as Jn,a4 as St,a5 as Ys,a6 as Xs,a7 as Qs,a8 as Ct,a9 as Zs,aa as ei,ab as ni,ac as ti,ad as ai,ae as si,af as ii,ag as ri,ah as li,R as Ie,P as ua,a as pa,C as it,T as Re,X as Me,Y as Te}from"./PieChart-CoyFJ-Zd.js";import{g as oi,A as At,D as ci,L as Pn,a as di,b as qn}from"./LineChart-oA51W1AB.js";import{s as rt,b as lt,B as en,a as Le}from"./BarChart-Chxb6v1P.js";import{r as _t,a as ui,S as pi}from"./sourceSystem-BFB1ulLt.js";import{u as mi,s as _e,R as X,b as be,c as $t,d as hi,K as gi,e as Hn,P as We,f as Se,C as xi,E as fi,A as bi,g as Ze,h as vi,i as ot}from"./ReportPrimitives-B1O0RUyW.js";import"./string-CFFdVFMV.js";var yi={grid:{stroke:"#ccc",fill:"none"}},ma=m.createContext(yi);ma.Provider;var ji=()=>m.useContext(ma),wi=["x1","y1","x2","y2","key"],Ni=["offset"],ki=["xAxisId","yAxisId"],Si=["xAxisId","yAxisId"];function Et(n,t){var s=Object.keys(n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(n);t&&(a=a.filter(function(r){return Object.getOwnPropertyDescriptor(n,r).enumerable})),s.push.apply(s,a)}return s}function Ae(n){for(var t=1;t<arguments.length;t++){var s=arguments[t]!=null?arguments[t]:{};t%2?Et(Object(s),!0).forEach(function(a){Ci(n,a,s[a])}):Object.getOwnPropertyDescriptors?Object.defineProperties(n,Object.getOwnPropertyDescriptors(s)):Et(Object(s)).forEach(function(a){Object.defineProperty(n,a,Object.getOwnPropertyDescriptor(s,a))})}return n}function Ci(n,t,s){return(t=Ai(t))in n?Object.defineProperty(n,t,{value:s,enumerable:!0,configurable:!0,writable:!0}):n[t]=s,n}function Ai(n){var t=_i(n,"string");return typeof t=="symbol"?t:t+""}function _i(n,t){if(typeof n!="object"||!n)return n;var s=n[Symbol.toPrimitive];if(s!==void 0){var a=s.call(n,t);if(typeof a!="object")return a;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(n)}function ln(){return ln=Object.assign?Object.assign.bind():function(n){for(var t=1;t<arguments.length;t++){var s=arguments[t];for(var a in s)({}).hasOwnProperty.call(s,a)&&(n[a]=s[a])}return n},ln.apply(null,arguments)}function Ln(n,t){if(n==null)return{};var s,a,r=$i(n,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(n);for(a=0;a<i.length;a++)s=i[a],t.indexOf(s)===-1&&{}.propertyIsEnumerable.call(n,s)&&(r[s]=n[s])}return r}function $i(n,t){if(n==null)return{};var s={};for(var a in n)if({}.hasOwnProperty.call(n,a)){if(t.indexOf(a)!==-1)continue;s[a]=n[a]}return s}var Ei=n=>{var t=n.fill;if(!t||t==="none")return null;var s=n.fillOpacity,a=n.x,r=n.y,i=n.width,d=n.height,p=n.ry;return m.createElement("rect",{x:a,y:r,ry:p,width:i,height:d,stroke:"none",fill:t,fillOpacity:s,className:"recharts-cartesian-grid-bg"})};function ha(n){var t=n.option,s=n.lineItemProps,a;if(m.isValidElement(t))a=m.cloneElement(t,s);else if(typeof t=="function")a=t(s);else{var r,i=s.x1,d=s.y1,p=s.x2,o=s.y2,c=s.key,l=Ln(s,wi),f=(r=at(l))!==null&&r!==void 0?r:{};f.offset;var u=Ln(f,Ni),g=Array.isArray(u.strokeDasharray)?u.strokeDasharray.join(","):u.strokeDasharray;a=m.createElement("line",ln({},u,{strokeDasharray:g,x1:i,y1:d,x2:p,y2:o,fill:"none",key:c}))}return a}function Di(n){var t=n.x,s=n.width,a=n.horizontal,r=a===void 0?!0:a,i=n.horizontalPoints;if(!r||!i||!i.length)return null;n.xAxisId,n.yAxisId;var d=Ln(n,ki),p=i.map((o,c)=>{var l=Ae(Ae({},d),{},{x1:t,y1:o,x2:t+s,y2:o,key:"line-".concat(c),index:c});return m.createElement(ha,{key:"line-".concat(c),option:r,lineItemProps:l})});return m.createElement("g",{className:"recharts-cartesian-grid-horizontal"},p)}function Ii(n){var t=n.y,s=n.height,a=n.vertical,r=a===void 0?!0:a,i=n.verticalPoints;if(!r||!i||!i.length)return null;n.xAxisId,n.yAxisId;var d=Ln(n,Si),p=i.map((o,c)=>{var l=Ae(Ae({},d),{},{x1:o,y1:t,x2:o,y2:t+s,key:"line-".concat(c),index:c});return m.createElement(ha,{option:r,lineItemProps:l,key:"line-".concat(c)})});return m.createElement("g",{className:"recharts-cartesian-grid-vertical"},p)}function Ri(n){var t=n.horizontalFill,s=n.fillOpacity,a=n.x,r=n.y,i=n.width,d=n.height,p=n.horizontalPoints,o=n.horizontal,c=o===void 0?!0:o;if(!c||!t||!t.length||p==null)return null;var l=p.map(u=>Math.round(u+r-r)).sort((u,g)=>u-g);r!==l[0]&&l.unshift(0);var f=l.map((u,g)=>{var v=l[g+1],j=v==null,_=j?r+d-u:v-u;if(_<=0)return null;var I=g%t.length;return m.createElement("rect",{key:"react-".concat(g),y:u,x:a,height:_,width:i,stroke:"none",fill:t[I],fillOpacity:s,className:"recharts-cartesian-grid-bg"})});return m.createElement("g",{className:"recharts-cartesian-gridstripes-horizontal"},f)}function Pi(n){var t=n.vertical,s=t===void 0?!0:t,a=n.verticalFill,r=n.fillOpacity,i=n.x,d=n.y,p=n.width,o=n.height,c=n.verticalPoints;if(!s||!a||!a.length)return null;var l=c.map(u=>Math.round(u+i-i)).sort((u,g)=>u-g);i!==l[0]&&l.unshift(0);var f=l.map((u,g)=>{var v=l[g+1],j=v==null,_=j?i+p-u:v-u;if(_<=0)return null;var I=g%a.length;return m.createElement("rect",{key:"react-".concat(g),x:u,y:d,width:_,height:o,stroke:"none",fill:a[I],fillOpacity:r,className:"recharts-cartesian-grid-bg"})});return m.createElement("g",{className:"recharts-cartesian-gridstripes-vertical"},f)}var zi=(n,t)=>{var s=n.xAxis,a=n.width,r=n.height,i=n.offset;return aa(sa(Ae(Ae(Ae({},ra),s),{},{ticks:ia(s),viewBox:{x:0,y:0,width:a,height:r}})),i.left,i.left+i.width,t)},Mi=(n,t)=>{var s=n.yAxis,a=n.width,r=n.height,i=n.offset;return aa(sa(Ae(Ae(Ae({},ra),s),{},{ticks:ia(s),viewBox:{x:0,y:0,width:a,height:r}})),i.top,i.top+i.height,t)},Ti={horizontal:!0,vertical:!0,horizontalPoints:[],verticalPoints:[],verticalFill:[],horizontalFill:[],xAxisId:0,yAxisId:0,syncWithTicks:!1,zIndex:na.grid};function sn(n){var t,s,a,r,i,d,p=Ss(),o=Cs(),c=As(),l=Ae(Ae({},ea(n,Ti)),{},{x:$e(n.x)?n.x:c.left,y:$e(n.y)?n.y:c.top,width:$e(n.width)?n.width:c.width,height:$e(n.height)?n.height:c.height}),f=l.xAxisId,u=l.yAxisId,g=l.x,v=l.y,j=l.width,_=l.height,I=l.syncWithTicks,x=l.horizontalValues,S=l.verticalValues,T=tt(),C=Yn(y=>jt(y,"xAxis",f,T)),B=Yn(y=>jt(y,"yAxis",u,T)),E=ji(),D={stroke:(t=l.stroke)!==null&&t!==void 0?t:E.grid.stroke,strokeWidth:(s=l.strokeWidth)!==null&&s!==void 0?s:E.grid.strokeWidth,strokeOpacity:(a=l.strokeOpacity)!==null&&a!==void 0?a:E.grid.strokeOpacity,strokeDasharray:(r=l.strokeDasharray)!==null&&r!==void 0?r:E.grid.strokeDasharray};if(!wt(j)||!wt(_)||!$e(g)||!$e(v))return null;var h=l.verticalCoordinatesGenerator||zi,k=l.horizontalCoordinatesGenerator||Mi,$=l.horizontalPoints,A=l.verticalPoints;if((!$||!$.length)&&typeof k=="function"){var Y=x&&x.length,ae=k({yAxis:B?Ae(Ae({},B),{},{ticks:Y?x:B.ticks}):void 0,width:p??j,height:o??_,offset:c},Y?!0:I);Nt(Array.isArray(ae),"horizontalCoordinatesGenerator should return Array but instead it returned [".concat(typeof ae,"]")),Array.isArray(ae)&&($=ae)}if((!A||!A.length)&&typeof h=="function"){var b=S&&S.length,L=h({xAxis:C?Ae(Ae({},C),{},{ticks:b?S:C.ticks}):void 0,width:p??j,height:o??_,offset:c},b?!0:I);Nt(Array.isArray(L),"verticalCoordinatesGenerator should return Array but instead it returned [".concat(typeof L,"]")),Array.isArray(L)&&(A=L)}return m.createElement(ta,{zIndex:l.zIndex},m.createElement("g",{className:"recharts-cartesian-grid"},m.createElement(Ei,{fill:(i=l.fill)!==null&&i!==void 0?i:E.grid.fill,fillOpacity:(d=l.fillOpacity)!==null&&d!==void 0?d:E.grid.fillOpacity,x:l.x,y:l.y,width:l.width,height:l.height,ry:l.ry}),m.createElement(Ri,ln({},l,{horizontalPoints:$})),m.createElement(Pi,ln({},l,{verticalPoints:A})),m.createElement(Di,ln({},l,D,{offset:c,horizontalPoints:$,xAxis:C,yAxis:B})),m.createElement(Ii,ln({},l,D,{offset:c,verticalPoints:A,xAxis:C,yAxis:B}))))}sn.displayName="CartesianGrid";var ga=(n,t,s)=>la(n,"xAxis",rt(n,t),s),xa=(n,t,s)=>oa(n,"xAxis",rt(n,t),s),fa=(n,t,s)=>la(n,"yAxis",lt(n,t),s),ba=(n,t,s)=>oa(n,"yAxis",lt(n,t),s),Li=kn([st,ga,fa,xa,ba],(n,t,s,a,r)=>ca(n,"xAxis")?kt(t,a,!1):kt(s,r,!1)),Oi=(n,t)=>t,ct=kn([Ds,Oi],(n,t)=>n.filter(s=>s.type==="area").find(s=>s.id===t)),va=n=>{var t=st(n),s=ca(t,"xAxis");return s?"yAxis":"xAxis"},Bi=(n,t)=>{var s=va(n);return s==="yAxis"?lt(n,t):rt(n,t)},ya=(n,t,s)=>Rs(n,va(n),Bi(n,t),s),Fi=kn([ct,ya],(n,t)=>{var s;if(!(n==null||t==null)){var a=n.stackId,r=Es(n);if(!(a==null||r==null)){var i=(s=t[a])===null||s===void 0?void 0:s.stackedData,d=i==null?void 0:i.find(p=>p.key===r);if(d!=null)return d.map(p=>[p[0],p[1]])}}}),Wi=kn([ct,ya],(n,t)=>{if(!(n==null||n.stackId==null||t==null)){var s=t[n.stackId];if(s!=null)return s.graphicalItems.map(a=>a.dataKey).filter(Is)}}),Ji=kn([st,ga,fa,xa,ba,Fi,_s,Li,ct,$s,Wi],(n,t,s,a,r,i,d,p,o,c,l)=>{var f=d.chartData,u=d.dataStartIndex,g=d.dataEndIndex;if(!(o==null||n!=="horizontal"&&n!=="vertical"||t==null||s==null||a==null||r==null||a.length===0||r.length===0||p==null)){var v=o.data,j;if(v&&v.length>0?j=v:j=f==null?void 0:f.slice(u,g+1),j!=null)return gr({layout:n,xAxis:t,yAxis:s,xAxisTicks:a,yAxisTicks:r,dataStartIndex:u,areaSettings:o,stackedData:i,displayedData:j,chartBaseValue:c,bandSize:p,stackDataKeys:l})}}),qi=["animationElapsedTime","isAnimating","isEntrance","layout","isRange","stroke","connectNulls"],Hi=["id","baseLine"];function jn(){return jn=Object.assign?Object.assign.bind():function(n){for(var t=1;t<arguments.length;t++){var s=arguments[t];for(var a in s)({}).hasOwnProperty.call(s,a)&&(n[a]=s[a])}return n},jn.apply(null,arguments)}function Dt(n,t){if(n==null)return{};var s,a,r=Gi(n,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(n);for(a=0;a<i.length;a++)s=i[a],t.indexOf(s)===-1&&{}.propertyIsEnumerable.call(n,s)&&(r[s]=n[s])}return r}function Gi(n,t){if(n==null)return{};var s={};for(var a in n)if({}.hasOwnProperty.call(n,a)){if(t.indexOf(a)!==-1)continue;s[a]=n[a]}return s}function Ki(n){var t,s,a=n.alpha,r=n.baseLine,i=n.points,d=n.strokeWidth,p=(t=i[0])===null||t===void 0?void 0:t.x,o=(s=i[i.length-1])===null||s===void 0?void 0:s.x;if(!Mn(p)||!Mn(o))return null;var c=a*Math.abs(p-o),l=Math.max(...i.map(f=>f.y||0));return $e(r)?l=Math.max(r,l):r&&Array.isArray(r)&&r.length&&(l=Math.max(...r.map(f=>f.y||0),l)),$e(l)?m.createElement("rect",{x:p<o?p:p-c,y:0,width:c,height:Math.floor(l+(d?parseInt("".concat(d),10):1))}):null}function Ui(n){var t,s,a=n.alpha,r=n.baseLine,i=n.points,d=n.strokeWidth,p=(t=i[0])===null||t===void 0?void 0:t.y,o=(s=i[i.length-1])===null||s===void 0?void 0:s.y;if(!Mn(p)||!Mn(o))return null;var c=a*Math.abs(p-o),l=Math.max(...i.map(f=>f.x||0));return $e(r)?l=Math.max(r,l):r&&Array.isArray(r)&&r.length&&(l=Math.max(...r.map(f=>f.x||0),l)),$e(l)?m.createElement("rect",{x:0,y:p<o?p:p-c,width:l+(d?parseInt("".concat(d),10):1),height:Math.floor(c)}):null}function Vi(n){var t=n.alpha,s=n.layout,a=n.points,r=n.baseLine,i=n.strokeWidth;return s==="vertical"?m.createElement(Ui,{alpha:t,points:a,baseLine:r,strokeWidth:i}):m.createElement(Ki,{alpha:t,points:a,baseLine:r,strokeWidth:i})}function Yi(n){var t=n.animationElapsedTime,s=t===void 0?1:t,a=n.isAnimating,r=a===void 0?!1:a,i=n.isEntrance,d=i===void 0?!1:i,p=n.layout,o=n.isRange,c=n.stroke,l=n.connectNulls,f=Dt(n,qi),u=p==="vertical"?"vertical":"horizontal",g=l??!1,v=Ps(),j=f.id,_=f.baseLine,I=Dt(f,Hi),x=at(I),S=m.createElement(Wn,jn({},f,{id:j,baseLine:_,connectNulls:g,stroke:"none",className:"recharts-area-area",layout:u})),T=c!=="none"&&m.createElement(Wn,jn({},x,{className:"recharts-area-curve",layout:u,type:f.type,connectNulls:g,fill:"none",stroke:c,points:f.points})),C=c!=="none"&&o&&Array.isArray(_)&&m.createElement(Wn,jn({},x,{className:"recharts-area-curve",layout:u,type:f.type,connectNulls:g,fill:"none",stroke:c,points:_}));if(d&&(r||s<1)){var B;return m.createElement(zn,null,m.createElement("defs",null,m.createElement("clipPath",{id:v},m.createElement(Vi,{alpha:s,points:(B=f.points)!==null&&B!==void 0?B:[],baseLine:_,layout:u,strokeWidth:f.strokeWidth}))),m.createElement(zn,{clipPath:"url(#".concat(v,")")},S,T,C))}return m.createElement(m.Fragment,null,S,T,C)}var Xi=["id"],Qi=["activeDot","animationBegin","animationDuration","animationEasing","connectNulls","dot","fill","fillOpacity","hide","isAnimationActive","legendType","stroke","xAxisId","yAxisId"];function On(){return On=Object.assign?Object.assign.bind():function(n){for(var t=1;t<arguments.length;t++){var s=arguments[t];for(var a in s)({}).hasOwnProperty.call(s,a)&&(n[a]=s[a])}return n},On.apply(null,arguments)}function ja(n,t){if(n==null)return{};var s,a,r=Zi(n,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(n);for(a=0;a<i.length;a++)s=i[a],t.indexOf(s)===-1&&{}.propertyIsEnumerable.call(n,s)&&(r[s]=n[s])}return r}function Zi(n,t){if(n==null)return{};var s={};for(var a in n)if({}.hasOwnProperty.call(n,a)){if(t.indexOf(a)!==-1)continue;s[a]=n[a]}return s}function It(n,t){var s=Object.keys(n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(n);t&&(a=a.filter(function(r){return Object.getOwnPropertyDescriptor(n,r).enumerable})),s.push.apply(s,a)}return s}function hn(n){for(var t=1;t<arguments.length;t++){var s=arguments[t]!=null?arguments[t]:{};t%2?It(Object(s),!0).forEach(function(a){er(n,a,s[a])}):Object.getOwnPropertyDescriptors?Object.defineProperties(n,Object.getOwnPropertyDescriptors(s)):It(Object(s)).forEach(function(a){Object.defineProperty(n,a,Object.getOwnPropertyDescriptor(s,a))})}return n}function er(n,t,s){return(t=nr(t))in n?Object.defineProperty(n,t,{value:s,enumerable:!0,configurable:!0,writable:!0}):n[t]=s,n}function nr(n){var t=tr(n,"string");return typeof t=="symbol"?t:t+""}function tr(n,t){if(typeof n!="object"||!n)return n;var s=n[Symbol.toPrimitive];if(s!==void 0){var a=s.call(n,t);if(typeof a!="object")return a;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(n)}var ar=(n,t)=>n==null?[]:t===1?n.flatMap(s=>s.status==="removed"?[]:[s.next]):n.flatMap(s=>s.status==="matched"?[hn(hn({},s.next),{},{x:Tn(s.prev.x,s.next.x,t),y:Tn(s.prev.y,s.next.y,t)})]:s.status==="added"?[s.next]:[]),wa={activeDot:!0,animationBegin:0,animationDuration:1500,animationEasing:"ease",animationMatchBy:Ms,animationInterpolateFn:ar,connectNulls:!1,dot:!1,fill:"#3182bd",fillOpacity:.6,hide:!1,isAnimationActive:"auto",legendType:"line",stroke:"#3182bd",strokeWidth:1,type:"linear",label:!1,shape:Yi,xAxisId:0,yAxisId:0,zIndex:na.area};function Bn(n,t){return n&&n!=="none"?n:t}var sr=n=>{var t=n.dataKey,s=n.name,a=n.stroke,r=n.fill,i=n.legendType,d=n.hide;return[{inactive:d,dataKey:t,type:i,color:Bn(a,r),value:da(s,t),payload:n}]},ir=m.memo(n=>{var t=n.dataKey,s=n.data,a=n.stroke,r=n.strokeWidth,i=n.fill,d=n.name,p=n.hide,o=n.unit,c=n.formatter,l=n.tooltipType,f=n.id,u={dataDefinedOnItem:s,getPosition:Ws,settings:{stroke:a,strokeWidth:r,fill:i,dataKey:t,nameKey:void 0,name:da(d,t),hide:p,type:l,color:Bn(a,i),unit:o,formatter:c,graphicalItemId:f}};return m.createElement(Fs,{tooltipEntrySettings:u})});function rr(n){var t=n.clipPathId,s=n.points,a=n.props,r=a.needClip,i=a.dot,d=a.dataKey,p=at(a);return m.createElement(ci,{points:s,dot:i,className:"recharts-area-dots",dotClassName:"recharts-area-dot",dataKey:d,baseProps:p,needClip:r,clipPathId:t})}function lr(n){var t=n.showLabels,s=n.children,a=n.points,r=a.map(i=>{var d,p,o={x:(d=i.x)!==null&&d!==void 0?d:0,y:(p=i.y)!==null&&p!==void 0?p:0,width:0,lowerWidth:0,upperWidth:0,height:0};return hn(hn({},o),{},{value:i.value,payload:i.payload,parentViewBox:void 0,viewBox:o,fill:void 0})});return m.createElement(ni,{value:t?r:void 0},s)}function or(n){var t=n.points,s=n.baseLine,a=n.needClip,r=n.clipPathId,i=n.props,d=n.animationElapsedTime,p=n.isAnimating,o=n.isEntrance,c=i.layout,l=i.type,f=i.stroke,u=i.connectNulls,g=i.isRange,v=i.shape,j=i.id,_=ja(i,Xi),I=ti(_),x=hn(hn({},I),{},{id:j,points:t,connectNulls:u,type:l,baseLine:s,layout:c,stroke:f,isRange:g,animationElapsedTime:d,isAnimating:p,isEntrance:o});return m.createElement(m.Fragment,null,(t==null?void 0:t.length)>1&&m.createElement(zn,{clipPath:a?"url(#clipPath-".concat(r,")"):void 0},m.createElement(ai,{option:v,DefaultShape:wa.shape,shapeProps:x})),m.createElement(rr,{points:t,props:_,clipPathId:r}))}function cr(n,t,s){if($e(n)){var a=$e(t)?t:void 0;return Tn(a,n,s)}if(si(n)||ii(n)){var r=$e(t)?t:void 0;return Tn(r,0,s)}return n}function dr(n){var t=n.needClip,s=n.clipPathId,a=n.props,r=n.previousPointsRef,i=n.previousBaselineRef,d=a.points,p=a.baseLine,o=a.isAnimationActive,c=a.animationBegin,l=a.animationDuration,f=a.animationEasing,u=a.animationMatchBy,g=a.animationInterpolateFn,v=m.useMemo(()=>({points:d,baseLine:p}),[d,p]),j=Ys(v,i),_=Xs(),I=Qs(a.onAnimationStart,a.onAnimationEnd),x=I.isAnimating,S=I.handleAnimationStart,T=I.handleAnimationEnd,C=j.startValue;if(_==null)return null;var B;return Array.isArray(p)&&Array.isArray(C)?B=Ct(C,p,u):Array.isArray(p)?B=Ct(null,p,u):B=null,m.createElement(Zs,{animationInput:v,animationIdPrefix:"recharts-area-",items:d,previousItemsRef:r,isAnimationActive:o,animationBegin:c,animationDuration:l,animationEasing:f,onAnimationStart:S,onAnimationEnd:T,animationInterpolateFn:g,animationMatchBy:u,layout:_},(E,D,h)=>{var k;return D===1?k=p:Array.isArray(p)?k=g(B,D,_):k=h?p:cr(p,C,D),j.syncStepValue(k,D),m.createElement(lr,{showLabels:!x,points:d},a.children,m.createElement(or,{points:E,baseLine:k,needClip:t,clipPathId:s,props:a,animationElapsedTime:D,isAnimating:x||D<1,isEntrance:h}),m.createElement(ei,{label:a.label}))})}function ur(n){var t=n.needClip,s=n.clipPathId,a=n.props,r=m.useRef(null),i=m.useRef();return m.createElement(dr,{needClip:t,clipPathId:s,props:a,previousPointsRef:r,previousBaselineRef:i})}class pr extends m.PureComponent{render(){var t=this.props,s=t.hide,a=t.dot,r=t.points,i=t.className,d=t.top,p=t.left,o=t.needClip,c=t.xAxisId,l=t.yAxisId,f=t.width,u=t.height,g=t.id,v=t.baseLine,j=t.zIndex;if(s)return null;var _=Ks("recharts-area",i),I=g,x=oi(a),S=x.r,T=x.strokeWidth,C=Us(a),B=S*2+T,E=o?"url(#clipPath-".concat(C?"":"dots-").concat(I,")"):void 0;return m.createElement(ta,{zIndex:j},m.createElement(zn,{className:_},o&&m.createElement("defs",null,m.createElement(Vs,{clipPathId:I,xAxisId:c,yAxisId:l}),!C&&m.createElement("clipPath",{id:"clipPath-dots-".concat(I)},m.createElement("rect",{x:p-B/2,y:d-B/2,width:f+B,height:u+B}))),m.createElement(ur,{needClip:o,clipPathId:I,props:this.props})),m.createElement(At,{points:r,mainColor:Bn(this.props.stroke,this.props.fill),itemDataKey:this.props.dataKey,activeDot:this.props.activeDot,clipPath:E}),this.props.isRange&&Array.isArray(v)&&m.createElement(At,{points:v,mainColor:Bn(this.props.stroke,this.props.fill),itemDataKey:this.props.dataKey,activeDot:this.props.activeDot,clipPath:E}))}}function mr(n){var t,s=n.activeDot,a=n.animationBegin,r=n.animationDuration,i=n.animationEasing,d=n.connectNulls,p=n.dot,o=n.fill,c=n.fillOpacity,l=n.hide,f=n.isAnimationActive,u=n.legendType,g=n.stroke,v=n.xAxisId,j=n.yAxisId,_=ja(n,Qi),I=Js(),x=qs(),S=Hs(v,j),T=S.needClip,C=tt(),B=(t=Yn(b=>Ji(b,n.id,C)))!==null&&t!==void 0?t:{},E=B.points,D=B.isRange,h=B.baseLine,k=Gs();if(I!=="horizontal"&&I!=="vertical"||k==null||x!=="AreaChart"&&x!=="ComposedChart")return null;var $=k.height,A=k.width,Y=k.x,ae=k.y;return!E||!E.length?null:m.createElement(pr,On({},_,{activeDot:s,animationBegin:a,animationDuration:r,animationEasing:i,baseLine:h,connectNulls:d,dot:p,fill:o,fillOpacity:c,height:$,hide:l,layout:I,isAnimationActive:f,isRange:D,legendType:u,needClip:T,points:E,stroke:g,width:A,left:Y,top:ae,xAxisId:v,yAxisId:j}))}var hr=(n,t,s,a,r)=>{var i=s??t;if($e(i))return i;var d=n==="horizontal"?r:a,p=d.scale.domain();if(d.type==="number"){var o=Math.max(p[0],p[1]),c=Math.min(p[0],p[1]);return i==="dataMin"?c:i==="dataMax"||o<0?o:Math.max(Math.min(p[0],p[1]),0)}return i==="dataMin"?p[0]:i==="dataMax"?p[1]:p[0]};function gr(n){var t=n.areaSettings,s=t.connectNulls,a=t.baseValue,r=t.dataKey,i=n.stackedData,d=n.layout,p=n.chartBaseValue,o=n.xAxis,c=n.yAxis,l=n.displayedData,f=n.dataStartIndex,u=n.xAxisTicks,g=n.yAxisTicks,v=n.bandSize,j=n.stackDataKeys,_=i&&i.length,I=hr(d,p,a,o,c),x=d==="horizontal",S=!1,T=l.map((B,E)=>{var D,h,k,$;if(_)$=i[f+E];else{var A=Jn(B,r);Array.isArray(A)?($=A,S=!0):$=[I,A]}var Y=(D=(h=$)===null||h===void 0?void 0:h[1])!==null&&D!==void 0?D:null,ae=Jn(B,r),b=_&&ae==null&&j!=null&&j.length>0&&j.every(Z=>Jn(B,Z)==null),L=Y==null||_&&!s&&ae==null||b;if(x){var y;return{x:St({axis:o,ticks:u,bandSize:v,entry:B,index:E}),y:L?null:(y=c.scale.map(Y))!==null&&y!==void 0?y:null,value:$,payload:B}}return{x:L?null:(k=o.scale.map(Y))!==null&&k!==void 0?k:null,y:St({axis:c,ticks:g,bandSize:v,entry:B,index:E}),value:$,payload:B}}),C;return _||S?C=T.map(B=>{var E,D=Array.isArray(B.value)?B.value[0]:null;if(x){var h;return{x:B.x,y:D!=null&&B.y!=null&&(h=c.scale.map(D))!==null&&h!==void 0?h:null,payload:B.payload}}return{x:D!=null&&(E=o.scale.map(D))!==null&&E!==void 0?E:null,y:B.y,payload:B.payload}}):C=x?c.scale.map(I):o.scale.map(I),{points:T,baseLine:C??0,isRange:S}}function xr(n){var t=ea(n,wa),s=tt();return m.createElement(Ts,{id:t.id,type:"area"},a=>m.createElement(m.Fragment,null,m.createElement(Ls,{legendPayload:sr(t)}),m.createElement(ir,{dataKey:t.dataKey,data:t.data,stroke:t.stroke,strokeWidth:t.strokeWidth,fill:t.fill,name:t.name,hide:t.hide,unit:t.unit,formatter:t.formatter,tooltipType:t.tooltipType,id:a}),m.createElement(Os,{type:"area",id:a,data:t.data,dataKey:t.dataKey,xAxisId:t.xAxisId,yAxisId:t.yAxisId,zAxisId:0,stackId:Bs(t.stackId),hide:t.hide,barSize:void 0,baseValue:t.baseValue,isPanorama:s,connectNulls:t.connectNulls}),m.createElement(mr,On({},t,{id:a}))))}var Xn=m.memo(xr,zs);Xn.displayName="Area";var fr=["axis"],Rt=m.forwardRef((n,t)=>m.createElement(ri,{chartName:"AreaChart",defaultTooltipEventType:"axis",validateTooltipEventTypes:fr,tooltipPayloadSearcher:li,categoricalChartProps:n,ref:t}));const Pt=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#14b8a6"];function dt(n){return Number(n||0).toLocaleString("en-US")}function br(n,t){const s=String(n||"");return t&&s.length>18?`${s.slice(0,16)}…`:s}function vr(n,t,s){const a=t.reduce((r,i)=>r+Number(i.value||0),0);return e.jsx("div",{style:{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"8px",marginTop:"12px"},children:t.map(r=>(a&&(r.value/a*100).toFixed(1),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"6px 10px",border:"1px solid var(--border)",borderRadius:"8px",background:"var(--bg-secondary)",minWidth:s?"110px":"140px"},children:[e.jsx("span",{style:{width:"10px",height:"10px",borderRadius:"50%",background:r.fill,flexShrink:0}}),e.jsxs("div",{style:{flex:1},children:[e.jsx("div",{style:{fontSize:"12px",fontWeight:700,color:"var(--text-primary)"},children:br(r.name,s)}),e.jsx("div",{style:{fontSize:"12px",color:"var(--text-muted)",fontWeight:600},children:dt(r.value)})]})]},r.name)))})}function yr({active:n,payload:t}){var a;if(!n||!(t!=null&&t.length))return null;const s=((a=t[0])==null?void 0:a.payload)||{};return e.jsxs("div",{className:"c-pie-tooltip",children:[e.jsx("strong",{children:s.name}),e.jsxs("div",{children:[e.jsx("span",{style:{background:s.fill}}),dt(s.value)]})]})}function Na({data:n=[],title:t,note:s,compact:a=!1,height:r=300,centerLabel:i="Total",showLegend:d=!0,showCenter:p=!0}){const o=m.useMemo(()=>(n||[]).map((g,v)=>({name:g.label??g.name,value:Math.max(0,Number(g.value||0)),fill:g.color||Pt[v%Pt.length]})).filter(g=>g.value>0),[n]),c=o.reduce((g,v)=>g+v.value,0);if(c<=0)return e.jsxs("div",{className:"c-pie-card",children:[t&&e.jsx("div",{className:"c-pie-title",children:t}),s&&e.jsx("div",{className:"c-pie-note",children:s}),e.jsx("div",{className:"c-pie-empty",children:"No data available"})]});const l=a?285:r,f=a?62:82,u=a?34:50;return e.jsxs("div",{className:"c-pie-card",children:[(t||s)&&e.jsx("div",{className:"c-pie-head",children:t&&e.jsx("div",{className:"c-pie-title",children:t})}),e.jsxs("div",{className:"c-pie-chart-area",style:{height:l},children:[e.jsx(Ie,{width:"100%",height:"100%",children:e.jsxs(ua,{margin:{top:18,right:40,bottom:d?30:10,left:40},children:[e.jsx(pa,{data:o,dataKey:"value",nameKey:"name",cx:"50%",cy:"48%",innerRadius:u,outerRadius:f,paddingAngle:o.length>1?2:0,minAngle:3,isAnimationActive:!1,labelLine:!1,label:!1,children:o.map((g,v)=>e.jsx(it,{fill:g.fill,stroke:"var(--bg-card)",strokeWidth:2},`${g.name}-${v}`))}),e.jsx(Re,{content:yr,wrapperStyle:{outline:"none"}}),d?e.jsx(Pn,{verticalAlign:"bottom",align:"center",content:g=>vr(g,o,a)}):null]})}),p?e.jsxs("div",{className:"c-pie-center",style:{textAlign:"center"},children:[e.jsx("strong",{style:{fontSize:a?"18px":"24px",fontWeight:800,color:"var(--text-primary)"},children:dt(c)}),i&&e.jsx("span",{style:{display:"block",fontSize:"11px",fontWeight:600,color:"var(--text-muted)",marginTop:"2px"},children:i})]}):null]})]})}const jr=`:root {
  color-scheme: dark;
  font-family: "Segoe UI", Tahoma, sans-serif;
  background: #080b10;
  color: #e2eaf4;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100vh;
  background: #080b10;
}

body {
  overflow: hidden;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  border: 0;
}

.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* background:
    radial-gradient(circle at top right, rgba(38, 128, 235, 0.08), transparent 28%),
    radial-gradient(circle at top left, rgba(200, 155, 60, 0.07), transparent 30%),
    #080b10; */
  color: #e2eaf4;
}

.app-shell.embedded {
  height: 100%;
  min-height: 100%;
}

.topbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid #111a26;
  background: rgba(4, 8, 13, 0.95);
}

.adobe-mark {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  background: #fa0f00;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

.exl-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 24px;
  padding: 0 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 122, 0, 0.24), rgba(255, 122, 0, 0.08));
  border: 1px solid rgba(255, 122, 0, 0.32);
}

.exl-mark span {
  color: #ff7a00;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.topbar-brand {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
}

.topbar-product,
.topbar-path {
  font-size: 11px;
  color: #7a8fa8;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.badge.subtle {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
  color: #9bb0c9;
}

.badge.gold {
  background: rgba(200, 155, 60, 0.12);
  border-color: rgba(200, 155, 60, 0.35);
  color: #e5c97a;
}

.badge.blue {
  background: rgba(38, 128, 235, 0.12);
  border-color: rgba(38, 128, 235, 0.32);
  color: #9ac9ff;
}

.badge.teal {
  background: rgba(15, 184, 184, 0.12);
  border-color: rgba(15, 184, 184, 0.32);
  color: #70e8e8;
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: flex;
}

.sidebar {
  width: 292px;
  flex: 0 0 292px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1e2d42;
  background: rgba(14, 20, 32, 0.92);
  backdrop-filter: blur(18px);
}

.sidebar-head {
  padding: 20px 18px 16px;
  border-bottom: 1px solid #1e2d42;
}

.sidebar-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9bb0c9;
}

.sidebar-copy {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #7a8fa8;
}

.sidebar-body {
  flex: 1;
  overflow: auto;
  padding: 16px 14px 18px;
}

.sidebar-section {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  border-radius: 16px;
  background: rgba(19, 27, 40, 0.78);
}

.sidebar-section-head {
  margin-bottom: 10px;
}

.sidebar-section-title {
  font-size: 13px;
  font-weight: 700;
}

.sidebar-section-copy {
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.55;
  color: #7a8fa8;
}

.sidebar-links {
  display: grid;
  gap: 8px;
}

.sidebar-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 11, 16, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #9bb0c9;
  cursor: pointer;
  text-align: left;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease, transform 160ms ease;
}

.sidebar-link:hover {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.12);
}

.sidebar-link.on {
  color: #ffffff;
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, rgba(19, 27, 40, 0.92));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.sidebar-link-pill {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: inherit;
}

.workspace-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  display: flex;
}

.workspace-main > * {
  flex: 1;
  min-height: 0;
}

.loading-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.loading-title {
  font-size: 16px;
  font-weight: 700;
}

.loading-copy {
  max-width: 440px;
  color: #7a8fa8;
  text-align: center;
  line-height: 1.6;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-top-color: #ffffff;
  animation: spin 700ms linear infinite;
}

.spinner.large {
  width: 26px;
  height: 26px;
}

.workspace-panel {
  width: 100%;
  overflow: auto;
  padding: 8px;
}

.workspace-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.workspace-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.workspace-copy {
  max-width: 760px;
  margin-top: 6px;
  line-height: 1.6;
  color: #7a8fa8;
}

.workspace-pill-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.workspace-grid {
  display: grid;
  gap: 16px;
}

.workspace-grid.two-one {
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr);
}

.workspace-grid.three-col {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 16px;
}

.stack-panel {
  display: grid;
  gap: 16px;
}

.module-overview {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.module-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.module-kpi-card {
  position: relative;
  overflow: hidden;
  min-height: 94px;
  padding: 14px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  border-radius: 12px;
  /* background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--kpi-accent) 18%, transparent), transparent 58%),
    rgba(19, 27, 40, 0.92); */
    background-color: var(--bg-card);
}

.module-kpi-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: var(--kpi-accent);
}

.module-kpi-card.blue { --kpi-accent: #2680eb; }
.module-kpi-card.teal { --kpi-accent: #0fb8b8; }
.module-kpi-card.green { --kpi-accent: #22c55e; }
.module-kpi-card.gold { --kpi-accent: #c89b3c; }

.module-kpi-card span {
  display: block;
  color: #8aa0ba;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.module-kpi-card strong {
  display: block;
  margin-top: 10px;
  color: #f4f8ff;
  font-size: 24px;
  font-weight: 850;
  line-height: 1;
}

.module-kpi-card p {
  margin-top: 8px;
  color: #8aa0ba;
  font-size: 12px;
}

.module-overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.overview-mini-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  border-radius: 12px;
  background: rgba(13, 22, 38, 0.58);
}

.overview-mini-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.overview-mini-head strong {
  color: #eef5ff;
  font-size: 13px;
  font-weight: 800;
}

.overview-mini-head span {
  color: #7a8fa8;
  font-size: 11px;
  font-weight: 700;
}

.overview-status-list,
.overview-compact-table {
  display: grid;
  gap: 7px;
}

.overview-status-row,
.overview-compact-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  border-radius: 10px;
  background: rgba(8, 11, 16, 0.35);
}

.overview-compact-row {
  grid-template-columns: 1fr auto;
  text-align: left;
}

.overview-compact-row.as-button {
  width: 100%;
  color: inherit;
  cursor: pointer;
  font: inherit;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.overview-compact-row.as-button:hover {
  border-color: rgba(200, 155, 60, 0.4);
  background: rgba(200, 155, 60, 0.08);
  transform: translateY(-1px);
}

.overview-status-row p {
  color: #c9d7e8;
  font-size: 12px;
  font-weight: 650;
}

.overview-status-row strong,
.overview-compact-row b {
  color: #f4f8ff;
  font-size: 12px;
  font-weight: 850;
}

.overview-compact-row div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.overview-compact-row strong {
  overflow: hidden;
  color: #f4f8ff;
  font-size: 12px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-compact-row span {
  overflow: hidden;
  color: #7a8fa8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #7a8fa8;
  box-shadow: 0 0 0 4px rgba(122, 143, 168, 0.12);
}

.status-dot.ok {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.status-dot.warn {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
}

.connector-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.connector-card,
.segment-card,
.segment-mini-card {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  background: rgba(8, 11, 16, 0.34);
}

.connector-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.csv-upload-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.api-source-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.csv-upload-input {
  display: none;
}

.csv-upload-button {
  margin-top: 2px;
}

.segment-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.segment-catalog-toolbar,
.button-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.segment-catalog-toolbar {
  margin-bottom: 14px;
}

.segment-source-inline {
  min-width: 340px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 420px;
}

.segment-source-inline .field-input {
  flex: 1;
}

.segment-library-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.create-segment-menu {
  position: relative;
}

.create-segment-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 12;
  width: 248px;
  border: 1px solid #1e2d42;
  border-radius: 14px;
  background: #1d2436;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34);
  overflow: hidden;
}

.create-segment-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: transparent;
  color: #e2eaf4;
  text-align: left;
  cursor: pointer;
}

.create-segment-option + .create-segment-option {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.create-segment-option:hover {
  background: rgba(255, 255, 255, 0.04);
}

.create-segment-option strong {
  display: block;
  font-size: 15px;
}

.create-segment-option small {
  display: block;
  margin-top: 2px;
  color: #7a8fa8;
  font-size: 13px;
}

.create-segment-icon {
  min-width: 52px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(38, 128, 235, 0.1);
  border: 1px solid rgba(38, 128, 235, 0.18);
  color: #9ac9ff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.example-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.example-chip {
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid rgba(38, 128, 235, 0.28);
  background: rgba(38, 128, 235, 0.08);
  color: #2e9bff;
  cursor: pointer;
  font-size: 12px;
}

.ai-modal-card {
  width: min(620px, 100%);
}

.segment-filter-select {
  width: 180px;
  flex: 0 0 180px;
}

.detail-stack {
  display: grid;
  gap: 0;
  margin-top: 10px;
}

.error-text {
  margin-top: 10px;
  color: #f5a2a2;
  font-size: 11px;
  line-height: 1.5;
}

.segment-mini-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.segment-form {
  display: block;
}

.segment-rule-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.segment-rule-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid rgba(139, 92, 246, 0.24);
  background: rgba(139, 92, 246, 0.08);
  color: #ddd6fe;
  font-size: 10px;
  font-weight: 700;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 11, 16, 0.78);
  backdrop-filter: blur(12px);
}

.modal-card {
  width: min(760px, 100%);
  max-height: min(86vh, 820px);
  overflow: auto;
  border: 1px solid #1e2d42;
  border-radius: 18px;
  background: #0e1420;
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.42);
}

.rule-stack,
.activate-list {
  display: grid;
  gap: 10px;
}

.modal-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-row {
  display: grid;
  grid-template-columns: 78px 1fr 1fr;
  gap: 10px;
  align-items: center;
}

.rule-joiner {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #9bb0c9;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.06em;
}

.activate-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  background: rgba(8, 11, 16, 0.34);
}

.activate-row input {
  margin-top: 3px;
}

.activate-copy {
  flex: 1;
}

.segment-feed-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.journey-catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.journey-catalog-card {
  position: relative;
  width: 100%;
  padding: 14px 14px 30px;
  border-radius: 14px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  background: rgba(8, 11, 16, 0.4);
  color: #e2eaf4;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
}

.journey-catalog-card:hover {
  border-color: rgba(200, 155, 60, 0.4);
  background: rgba(200, 155, 60, 0.08);
  transform: translateY(-1px);
}

.journey-catalog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.journey-catalog-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

.journey-client-tag {
  position: absolute;
  right: 10px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid rgba(14, 184, 184, 0.4);
  background: rgba(15, 184, 184, 0.14);
  color: #8de7e7;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.journey-client-tag-inline {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid rgba(14, 184, 184, 0.4);
  background: rgba(15, 184, 184, 0.14);
  color: #8de7e7;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.section-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  background: rgba(13, 22, 38, 0.45);
}

.section-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #e5c97a;
  letter-spacing: 0.02em;
}

.section-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.journey-mini-card {
  position: relative;
  width: 100%;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 14px 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(8, 11, 16, 0.55);
  color: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.journey-mini-card.state-active { --card-accent: #22c55e; }
.journey-mini-card.state-inactive { --card-accent: #c89b3c; }

.journey-mini-card.state-active,
.journey-mini-card.state-inactive {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--card-accent) 16%, transparent),
    color-mix(in srgb, var(--card-accent) 4%, transparent)
  );
  border-color: color-mix(in srgb, var(--card-accent) 32%, rgba(30, 45, 66, 0.95));
}

.journey-mini-card.state-active::before,
/* .journey-mini-card.state-inactive::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: var(--card-accent);
} */

.journey-mini-card.status-production-ready {
  border-color: rgba(34, 197, 94, 0.38);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.16), rgba(34, 197, 94, 0.05));
}

.journey-mini-card.status-ready-for-activation {
  border-color: rgba(38, 128, 235, 0.4);
  background: linear-gradient(135deg, rgba(38, 128, 235, 0.16), rgba(38, 128, 235, 0.05));
}

.journey-mini-card.status-in-qa-review {
  border-color: rgba(245, 158, 11, 0.42);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.17), rgba(245, 158, 11, 0.05));
}

.journey-mini-card.status-needs-review {
  border-color: rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(139, 92, 246, 0.05));
}

.journey-mini-card.status-draft {
  border-color: rgba(122, 143, 168, 0.44);
  background: linear-gradient(135deg, rgba(122, 143, 168, 0.2), rgba(122, 143, 168, 0.06));
}

.journey-mini-card:hover {
  border-color: rgba(200, 155, 60, 0.4);
  background: rgba(200, 155, 60, 0.08);
  transform: translateY(-1px);
}

.journey-mini-card.state-active:hover,
.journey-mini-card.state-inactive:hover {
  border-color: color-mix(in srgb, var(--card-accent) 55%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--card-accent) 24%, transparent),
    color-mix(in srgb, var(--card-accent) 7%, transparent)
  );
  transform: translateY(-1px);
}

.journey-mini-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: #e2eaf4;
  padding-right: 80px;
}

.journey-mini-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.journey-card-tag {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.journey-card-tag.tag-prebuilt {
  border-color: rgba(38, 128, 235, 0.45);
  background: rgba(38, 128, 235, 0.16);
  color: #6aa9f0;
}

.journey-card-tag.tag-custom {
  border-color: rgba(15, 184, 184, 0.45);
  background: rgba(15, 184, 184, 0.16);
  color: #5fd7d7;
}

[data-theme="light"] .journey-card-tag.tag-prebuilt {
  border-color: rgba(38, 128, 235, 0.55);
  background: rgba(38, 128, 235, 0.18);
  color: #1d4ed8;
}

[data-theme="light"] .journey-card-tag.tag-custom {
  border-color: rgba(15, 184, 184, 0.55);
  background: rgba(15, 184, 184, 0.2);
  color: #0e7490;
}

.journey-card-status-tag {
  position: absolute;
  right: 10px;
  top: 10px;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.journey-card-status-tag.is-active {
  border-color: rgba(34, 197, 94, 0.45);
  background: rgba(34, 197, 94, 0.14);
  color: #22c55e;
}

.journey-card-status-tag.is-inactive {
  border-color: rgba(148, 163, 184, 0.35);
  background: rgba(148, 163, 184, 0.14);
  color: #94a3b8;
}

[data-theme="light"] .journey-card-status-tag.is-active {
  color: #15803d;
  border-color: rgba(21, 128, 61, 0.45);
  background: rgba(34, 197, 94, 0.18);
}

[data-theme="light"] .journey-card-status-tag.is-inactive {
  color: #475569;
  border-color: rgba(71, 85, 105, 0.4);
  background: rgba(148, 163, 184, 0.22);
}

@media (min-width: 1500px) {
  .section-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .section-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.segment-feed-card {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  background: rgba(15, 22, 35, 0.9);
  color: #e2eaf4;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.segment-feed-card:hover,
.segment-feed-card.on {
  border-color: rgba(38, 128, 235, 0.4);
  background: rgba(19, 31, 49, 0.95);
  transform: translateY(-1px);
}

.segment-feed-card-top,
.segment-feed-card-foot,
.segment-profile-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.segment-feed-card-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.segment-feed-card-count {
  flex: 0 0 auto;
  color: #2e9bff;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.segment-feed-card-copy {
  min-height: 34px;
  margin-top: 10px;
  color: #7a8fa8;
  font-size: 11px;
  line-height: 1.55;
}

.segment-feed-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.segment-feed-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(38, 128, 235, 0.18);
  background: rgba(38, 128, 235, 0.08);
  color: #9ac9ff;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.segment-feed-meter {
  margin-top: 14px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.segment-feed-meter-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2680eb, #5aa3f5);
}

.segment-feed-card-foot {
  margin-top: 10px;
  color: #7a8fa8;
  font-size: 11px;
}

.segment-detail-meta {
  display: grid;
  gap: 0;
}

.segment-profile-shell {
  margin-top: 14px;
  border: 1px solid rgba(30, 45, 66, 0.95);
  border-radius: 12px;
  background: rgba(8, 11, 16, 0.26);
  overflow: hidden;
}

.segment-profile-head {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.segment-profile-table-wrap {
  overflow: auto;
}

.segment-profile-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.segment-profile-table thead th {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #7a8fa8;
  font-family: Consolas, Monaco, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
}

.segment-profile-table tbody td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: #dce7f4;
}

.segment-profile-table tbody tr:hover {
  background: rgba(38, 128, 235, 0.05);
}

.helper-text.no-top {
  margin-top: 4px;
}

.prompt-example-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 10px;
}

.prompt-example-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(95, 129, 171, 0.3);
  background: rgba(38, 128, 235, 0.08);
  color: #9ac9ff;
  font-size: 10px;
  line-height: 1.2;
}

.empty-state.compact {
  min-height: 160px;
}

.audience-bottom-grid {
  align-items: start;
}

.helper-bullet {
  position: relative;
  padding-left: 16px;
  margin-bottom: 10px;
  color: #9bb0c9;
  line-height: 1.55;
}

.helper-bullet::before {
  content: "";
  position: absolute;
  left: 0;
  top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
}

.module-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border: 1px solid #1e2d42;
  border-radius: 18px;
  background: rgba(14, 20, 32, 0.94);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
}

.blueprint-layout {
  min-width: 0;
}

.panel {
  min-height: 0;
  background: transparent;
}

.side-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid #1e2d42;
}

.side-panel.narrow {
  width: 300px;
  flex: 0 0 300px;
}

.side-panel.wide {
  width: 364px;
  flex: 0 0 364px;
}

.canvas-panel,
.content-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-bottom: 1px solid #1e2d42;
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
}

.panel-subtitle {
  font-size: 11px;
  line-height: 1.5;
  color: #7a8fa8;
}

.panel-body,
.content-body,
.list-body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 16px;
}

.list-body {
  padding: 0;
}

.field {
  display: block;
  margin-bottom: 12px;
}

.field.compact {
  margin-bottom: 8px;
}

.field-label {
  display: block;
  margin-bottom: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #7a8fa8;
}

.field-label.small {
  font-size: 9px;
}

.purple-text {
  color: #c4b5fd;
}

.teal-text {
  color: #70e8e8;
}

.field-input {
  width: 100%;
  border: 1px solid #1e2d42;
  border-radius: 8px;
  padding: 9px 10px;
  background: #131b28;
  color: #e2eaf4;
  outline: none;
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.field-input.multiline {
  min-height: 148px;
  resize: vertical;
  line-height: 1.55;
}

.field-input.multiline.short {
  min-height: 88px;
}

.color-input {
  min-height: 40px;
  padding: 4px;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.three-col {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: filter 160ms ease, opacity 160ms ease, transform 160ms ease;
  font-size: 12px;
  font-weight: 700;
}

.button:hover {
  filter: brightness(1.08);
}

.button:disabled {
  cursor: default;
  opacity: 0.65;
  filter: none;
}

.button.full {
  width: 100%;
}

.button.small {
  padding: 8px 10px;
  font-size: 11px;
}

.button.primary {
  background: #2680eb;
  color: #ffffff;
}

.button.success {
  background: #16a34a;
  border: 1px solid rgba(134, 239, 172, 0.52);
  color: #ffffff;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.12), 0 10px 26px rgba(22, 163, 74, 0.2);
}

.button.success:disabled {
  opacity: 1;
}

.button.gold {
  background: rgba(200, 155, 60, 0.14);
  border: 1px solid rgba(200, 155, 60, 0.32);
  color: #e5c97a;
}

.button.teal {
  background: rgba(15, 184, 184, 0.12);
  border: 1px solid rgba(15, 184, 184, 0.32);
  color: #70e8e8;
}

.button.secondary {
  background: #131b28;
  border: 1px solid #1e2d42;
  color: #9bb0c9;
}

.toolbar-stack {
  display: grid;
  gap: 10px;
}

.progress-stack {
  margin-top: 10px;
}

.progress-track {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.progress-track.wide {
  width: 220px;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2680eb, #0fb8b8);
  transition: width 320ms ease;
}

.progress-fill.gold {
  background: linear-gradient(90deg, #c89b3c, #f59e0b);
}

.progress-fill.teal {
  background: linear-gradient(90deg, #0fb8b8, #5eead4);
}

.progress-fill.looping {
  width: 55%;
  animation: run 1.2s ease infinite;
}

.progress-label {
  margin-top: 6px;
  font-size: 10px;
  color: #7a8fa8;
}

.save-card {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(38, 128, 235, 0.28);
  border-radius: 12px;
  background: rgba(38, 128, 235, 0.08);
}

.stats-card {
  margin-top: 16px;
  padding-top: 6px;
}

.section-label {
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #7a8fa8;
}

.stat-row,
.detail-row,
.inspector-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-row span,
.detail-key,
.inspector-key {
  color: #7a8fa8;
}

.stat-row strong,
.detail-value,
.inspector-value {
  text-align: right;
  color: #e2eaf4;
}

.detail-key,
.inspector-key {
  min-width: 138px;
  font-family: Consolas, Monaco, monospace;
  font-size: 10px;
}

.detail-value,
.inspector-value {
  white-space: pre-line;
  line-height: 1.5;
  font-size: 12px;
}

.stack-actions {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.flow-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.flow-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 12px;
  min-height: 54px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 12px;
  border-bottom: 1px solid #1e2d42;
  background: rgba(8, 11, 16, 0.32);
}

.flow-toolbar-group {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 8px;
}

.flow-toolbar-help {
  margin-left: auto;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.flow-toolbar-label {
  font-size: 10px;
  color: #7a8fa8;
}

.flow-hint {
  font-size: 10px;
  color: #7a8fa8;
}

.zoom-button {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #1e2d42;
  background: #131b28;
  color: #9bb0c9;
  font-size: 10px;
  cursor: pointer;
}

.zoom-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.zoom-button-icon {
  min-width: 30px;
  padding: 4px 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.zoom-readout {
  min-width: 56px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #cdd9e8;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.zoom-button-focus {
  min-width: 108px;
}

.zoom-button.is-active {
  border-color: rgba(38, 128, 235, 0.45);
  background: rgba(38, 128, 235, 0.14);
  color: #9ac9ff;
}

.flow-tags {
  display: flex;
  gap: 6px;
}

.flow-tag {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #7a8fa8;
  font-size: 10px;
}

.flow-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #080b10;
  cursor: grab;
}

.flow-scrollbar-shell {
  padding: 8px 12px 10px;
  border-top: 1px solid #1e2d42;
  background: rgba(8, 11, 16, 0.28);
}

.flow-scrollbar {
  overflow-x: auto;
  overflow-y: hidden;
  height: 12px;
}

.flow-scrollbar-track {
  height: 1px;
}

.flow-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.empty-state,
.inspector-empty {
  height: 100%;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: #7a8fa8;
}

.empty-state-mark,
.inspector-empty-mark,
.flow-overlay-mark {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
}

.flow-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(8, 11, 16, 0.92);
}

.flow-overlay-message {
  color: #dfe8f7;
  font-size: 13px;
}

.flow-lane-label,
.flow-phase-label,
.flow-edge-label,
.flow-legend-label,
.flow-badge,
.flow-node-subtitle {
  font-family: Consolas, Monaco, monospace;
}

.flow-lane-label {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 1px;
}

.flow-phase-label {
  font-size: 7px;
  fill: rgba(255, 255, 255, 0.25);
}

.flow-edge-label,
.flow-legend-label {
  font-size: 8px;
}

.flow-badge {
  font-size: 6.5px;
  font-weight: 700;
  fill: #e9ddff;
}

.flow-node {
  cursor: move;
}

.flow-node.is-selected {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.16));
}

.flow-edge.is-selected {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.14));
}

.flow-edge-hit {
  cursor: pointer;
}

.flow-node-title {
  font-size: 9.5px;
  font-weight: 700;
}

.flow-node-title.decision {
  font-size: 8.5px;
}

.flow-node-subtitle {
  font-size: 7px;
}

.inspector-body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 16px;
}

.inspector-title {
  font-size: 14px;
  font-weight: 700;
}

.inspector-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #7a8fa8;
  font-family: Consolas, Monaco, monospace;
}

.inspector-divider {
  height: 2px;
  margin: 12px 0;
  border-radius: 999px;
  opacity: 0.8;
}

.inspector-input,
.inspector-textarea {
  background: rgba(19, 27, 40, 0.96);
}

.inspector-textarea {
  min-height: 88px;
  resize: vertical;
  line-height: 1.5;
}

.inspector-textarea.short {
  min-height: 70px;
}

.inspector-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.inspector-editor-card {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.025);
}

.info-box {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(38, 128, 235, 0.25);
  border-radius: 10px;
  background: rgba(38, 128, 235, 0.08);
  color: #9ac9ff;
  line-height: 1.55;
}

.info-blue {
  border-color: rgba(38, 128, 235, 0.25);
  color: #9ac9ff;
}

.segment-selection-box {
  margin-top: 18px;
  margin-bottom: 10px;
  padding: 14px 16px;
}

.journey-back-button {
  margin-bottom: 14px;
}

.content-tabs {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1e2d42;
  background: rgba(8, 11, 16, 0.24);
}

.tab-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.tab-button {
  padding: 12px 16px;
  color: #7a8fa8;
  background: transparent;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tab-button.on {
  color: #ffffff;
  border-bottom-color: #2680eb;
}

.tab-actions {
  display: flex;
  gap: 8px;
  padding-right: 16px;
}

.ajo-activation-card {
  position: absolute;
  top: calc(100% + 10px);
  right: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 330px;
  max-width: min(430px, calc(100vw - 48px));
  padding: 14px;
  border: 1px solid rgba(15, 184, 184, 0.42);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(15, 184, 184, 0.18), rgba(38, 128, 235, 0.12)), #131b28;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
}

.ajo-activation-card::before {
  content: "";
  position: absolute;
  top: -7px;
  right: 44px;
  width: 12px;
  height: 12px;
  border-left: 1px solid rgba(15, 184, 184, 0.42);
  border-top: 1px solid rgba(15, 184, 184, 0.42);
  background: #131b28;
  transform: rotate(45deg);
}

.ajo-activation-card strong,
.ajo-activation-card span {
  display: block;
}

.ajo-activation-card strong {
  margin-bottom: 4px;
  color: #e7ffff;
  font-size: 12px;
}

.ajo-activation-card span {
  color: #9bb1c9;
  font-size: 11px;
  line-height: 1.4;
}

.ajo-activation-card.done {
  border-color: rgba(34, 197, 94, 0.46);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.26), rgba(15, 184, 184, 0.12)), #101a22;
}

.ajo-activation-card.done::before {
  border-color: rgba(34, 197, 94, 0.46);
  background: #101a22;
}

.ajo-activation-card.done strong {
  color: #ffffff;
  font-size: 13px;
}

.ajo-activation-card.done span {
  color: #d8ffe5;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 10px;
  font-weight: 700;
}

.status-chip.ok {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.24);
  color: #93f0b4;
}

.status-chip.warn {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.24);
  color: #f7ce75;
}

.content-card {
  border: 1px solid #1e2d42;
  border-radius: 12px;
  background: #131b28;
  overflow: hidden;
}

.content-body > .content-card + .content-card,
.stack-panel > .content-card + .content-card {
  margin-top: 14px;
}

.content-card-accent {
  height: 3px;
}

.content-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.content-card-title {
  font-size: 13px;
  font-weight: 700;
}

.content-card-body {
  padding: 14px;
}

.group-box {
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #1e2d42;
  background: rgba(255, 255, 255, 0.02);
}

.group-box.purple {
  border-color: rgba(139, 92, 246, 0.25);
  background: rgba(139, 92, 246, 0.06);
}

.group-box.teal {
  border-color: rgba(15, 184, 184, 0.25);
  background: rgba(15, 184, 184, 0.06);
}

.toggle-row,
.slider-row,
.suite-score-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.toggle-row {
  flex-wrap: wrap;
}

.toggle-row.no-gap-bottom {
  margin-bottom: 0;
}

.channel-chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
}

.channel-chip.on {
  border-color: rgba(38, 128, 235, 0.4);
  background: rgba(38, 128, 235, 0.16);
  color: #9ac9ff;
}

.channel-chip.off {
  border-color: rgba(122, 143, 168, 0.18);
  background: rgba(255, 255, 255, 0.03);
  color: #7a8fa8;
}

.slider-row input[type="range"] {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: orange;
}

.slider-row input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #ffffff;
  border: 2px solid #2680eb;
  cursor: pointer;
}

.slider-value {
  min-width: 78px;
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  color: #d7e6f9;
}

.helper-text {
  margin-top: 8px;
  color: #7a8fa8;
  font-size: 11px;
  line-height: 1.5;
}

.canvas-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.canvas-preview-step {
  display: flex;
  align-items: center;
  gap: 6px;
}

.canvas-preview-box {
  min-width: 68px;
  padding: 10px 8px;
  border-radius: 10px;
  border: 1px solid rgba(38, 128, 235, 0.25);
  background: rgba(38, 128, 235, 0.08);
  text-align: center;
  font-size: 11px;
  font-weight: 700;
}

.canvas-preview-arrow {
  color: #425b79;
}

.json-block {
  margin: 0;
  overflow: auto;
  padding: 14px;
  border-radius: 10px;
  background: #06080d;
  border: 1px solid #1e2d42;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: #d4dce8;
}

.qa-grid {
  display: grid;
  grid-template-columns: 280px 320px minmax(0, 1fr);
  gap: 14px;
  min-height: 100%;
}

.qa-column,
.qa-results {
  min-height: 0;
}

.qa-suite-stack,
.qa-playbook-stack {
  display: grid;
  gap: 10px;
}

.list-card,
.suite-card {
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: transparent;
  text-align: left;
}

.qa-suite-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(8, 11, 16, 0.22);
}

.list-card {
  cursor: pointer;
}

.list-card.on,
.list-card:hover {
  background: rgba(15, 184, 184, 0.05);
}

.list-card-top,
.suite-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.profile-avatar {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(15, 184, 184, 0.25);
  background: rgba(15, 184, 184, 0.08);
  color: #70e8e8;
  font-size: 11px;
  font-weight: 700;
}

.list-card-title,
.simulation-step-title {
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.list-card-meta,
.simulation-step-text {
  margin-top: 3px;
  font-size: 11px;
  color: #7a8fa8;
  line-height: 1.45;
}

.outcome-chip,
.score-pill {
  display: inline-flex;
  margin-top: 10px;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 10px;
  font-weight: 700;
}

.outcome-chip.teal,
.summary-box.teal {
  border-color: rgba(15, 184, 184, 0.24);
  background: rgba(15, 184, 184, 0.08);
  color: #70e8e8;
}

.outcome-chip.amber,
.summary-box.amber {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.08);
  color: #f7ce75;
}

.summary-box.green,
.score-pill.green {
  border-color: rgba(34, 197, 94, 0.24);
  background: rgba(34, 197, 94, 0.08);
  color: #93f0b4;
}

.score-pill.red {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(239, 68, 68, 0.08);
  color: #f5a2a2;
}

.suite-status {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(122, 143, 168, 0.24);
  background: rgba(122, 143, 168, 0.08);
  color: #7a8fa8;
  font-size: 9px;
  font-weight: 700;
}

.suite-status.pass,
.simulation-step-state.pass {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.1);
  color: #93f0b4;
}

.suite-status.fail,
.simulation-step-state.fail {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
  color: #f5a2a2;
}

.suite-status.running,
.simulation-step-state.running {
  border-color: rgba(38, 128, 235, 0.3);
  background: rgba(38, 128, 235, 0.1);
  color: #9ac9ff;
}

.suite-status.blocked,
.simulation-step-state.blocked,
.simulation-step-state.skip {
  border-color: rgba(15, 184, 184, 0.3);
  background: rgba(15, 184, 184, 0.1);
  color: #70e8e8;
}

.suite-status.warn,
.simulation-step-state.warn,
.suite-status.skip {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.1);
  color: #f7ce75;
}

.profile-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.profile-stat {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px;
}

.profile-stat-value {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 700;
}

.simulation-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.simulation-step-copy {
  flex: 1;
}

.simulation-step-state {
  align-self: flex-start;
  padding: 4px 6px;
  border-radius: 999px;
  border: 1px solid rgba(122, 143, 168, 0.24);
  background: rgba(122, 143, 168, 0.08);
  font-size: 9px;
  font-weight: 700;
}

.simulation-running {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: #7a8fa8;
  font-size: 11px;
}

.summary-box {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  line-height: 1.55;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  background: #223248;
  border-radius: 999px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes run {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(260%);
  }
}

[data-theme="light"] .app-shell {
  background:
    radial-gradient(circle at top right, rgba(11, 113, 230, 0.1), transparent 32%),
    radial-gradient(circle at top left, rgba(200, 155, 60, 0.08), transparent 34%),
    #f4f7fc;
  color: #0f1b2b;
}

[data-theme="light"] {
  color-scheme: light;
}

[data-theme="light"] .topbar,
[data-theme="light"] .content-tabs,
[data-theme="light"] .flow-toolbar,
[data-theme="light"] .flow-scrollbar-shell {
  background: rgba(255, 255, 255, 0.92);
  border-color: #d4deec;
}

[data-theme="light"] .sidebar,
[data-theme="light"] .module-layout,
[data-theme="light"] .content-card,
[data-theme="light"] .modal-card,
[data-theme="light"] .create-segment-popover,
[data-theme="light"] .ajo-activation-card::before {
  background: #ffffff;
  border-color: #d4deec;
}

[data-theme="light"] .sidebar-head,
[data-theme="light"] .sidebar-section,
[data-theme="light"] .sidebar-link,
[data-theme="light"] .panel-head,
[data-theme="light"] .group-box,
[data-theme="light"] .module-kpi-card,
[data-theme="light"] .overview-mini-card,
[data-theme="light"] .overview-status-row,
[data-theme="light"] .overview-compact-row,
[data-theme="light"] .json-block,
[data-theme="light"] .segment-profile-shell,
[data-theme="light"] .segment-feed-card,
[data-theme="light"] .journey-catalog-card,
[data-theme="light"] .section-card,
[data-theme="light"] .journey-mini-card,
[data-theme="light"] .activate-row,
[data-theme="light"] .inspector-editor-card,
[data-theme="light"] .ajo-activation-card {
  background: #f8fbff;
  border-color: #d4deec;
}

[data-theme="light"] .ajo-activation-card {
  background: linear-gradient(135deg, rgba(15, 184, 184, 0.16), rgba(38, 128, 235, 0.1)), #ffffff;
  box-shadow: 0 18px 44px rgba(29, 50, 80, 0.16);
}

[data-theme="light"] .ajo-activation-card.done {
  border-color: rgba(22, 163, 74, 0.42);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(15, 184, 184, 0.1)), #ffffff;
}

[data-theme="light"] .ajo-activation-card.done::before {
  border-color: rgba(22, 163, 74, 0.42);
  background: #ffffff;
}

[data-theme="light"] .journey-mini-card.state-active,
[data-theme="light"] .journey-mini-card.state-inactive {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--card-accent) 16%, transparent),
    color-mix(in srgb, var(--card-accent) 4%, transparent)
  );
  /* border-color: color-mix(in srgb, var(--card-accent) 32%, #d4deec); */
}

[data-theme="light"] .journey-mini-card.state-active:hover,
[data-theme="light"] .journey-mini-card.state-inactive:hover {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--card-accent) 24%, transparent),
    color-mix(in srgb, var(--card-accent) 7%, transparent)
  );
  border-color: color-mix(in srgb, var(--card-accent) 55%, transparent);
}

[data-theme="light"] .field-input,
[data-theme="light"] .button.secondary,
[data-theme="light"] .zoom-button,
[data-theme="light"] .zoom-readout,
[data-theme="light"] .canvas-preview-box {
  background: #ffffff;
  border-color: #c2cfdf;
  color: #0f1b2b;
}

[data-theme="light"] .button.secondary {
  color: #31445d;
}

[data-theme="light"] .topbar-product,
[data-theme="light"] .topbar-path {
  color: #000000;
}

[data-theme="light"] .sidebar-link.on {
  color: #000000;
  border-color: rgba(11, 113, 230, 0.38);
  background: rgba(11, 113, 230, 0.16);
  box-shadow: inset 0 0 0 1px rgba(11, 113, 230, 0.16);
}

[data-theme="light"] .sidebar-link:hover {
  color: #000000;
  border-color: rgba(47, 68, 96, 0.3);
}

[data-theme="light"] .sidebar-link-pill {
  border-color: rgba(47, 68, 96, 0.24);
  background: rgba(47, 68, 96, 0.06);
}

[data-theme="light"] .badge.subtle {
  background: #eef4fc;
  border-color: #cbd8ea;
  color: #000000;
}

[data-theme="light"] .flow-viewport,
[data-theme="light"] .json-block {
  background: #f8fbff;
  color: #0f1b2b;
}

[data-theme="light"] .tab-button,
[data-theme="light"] .sidebar-link,
[data-theme="light"] .helper-text,
[data-theme="light"] .panel-subtitle,
[data-theme="light"] .flow-hint,
[data-theme="light"] .flow-toolbar-label,
[data-theme="light"] .progress-label,
[data-theme="light"] .detail-key,
[data-theme="light"] .inspector-key,
[data-theme="light"] .section-label,
[data-theme="light"] .field-label {
  color: #000000;
}

[data-theme="light"] .workspace-copy,
[data-theme="light"] .module-kpi-card span,
[data-theme="light"] .module-kpi-card strong,
[data-theme="light"] .module-kpi-card p,
[data-theme="light"] .overview-mini-head strong,
[data-theme="light"] .overview-mini-head span,
[data-theme="light"] .overview-status-row p,
[data-theme="light"] .overview-status-row strong,
[data-theme="light"] .overview-compact-row strong,
[data-theme="light"] .overview-compact-row span,
[data-theme="light"] .overview-compact-row b,
[data-theme="light"] .detail-value,
[data-theme="light"] .inspector-value,
[data-theme="light"] .content-card-title,
[data-theme="light"] .ajo-activation-card strong,
[data-theme="light"] .ajo-activation-card span,
[data-theme="light"] .journey-catalog-title,
[data-theme="light"] .list-card-title,
[data-theme="light"] .workspace-title,
[data-theme="light"] .panel-title,
[data-theme="light"] .tab-button.on {
  color: #000000;
}

[data-theme="light"] .sidebar-copy,
[data-theme="light"] .sidebar-section-copy,
[data-theme="light"] .panel-subtitle,
[data-theme="light"] .helper-text,
[data-theme="light"] .list-card-meta,
[data-theme="light"] .simulation-step-text,
[data-theme="light"] .progress-label,
[data-theme="light"] .inspector-meta,
[data-theme="light"] .flow-hint,
[data-theme="light"] .flow-toolbar-label,
[data-theme="light"] .flow-tag {
  color: #000000;
}

[data-theme="light"] .zoom-readout {
  color: #000000;
  border-color: rgba(47, 68, 96, 0.24);
  background: rgba(47, 68, 96, 0.08);
}

[data-theme="light"] .flow-phase-label {
  fill: rgba(0, 0, 0, 0.72);
}

[data-theme="light"] .stat-row strong,
[data-theme="light"] .slider-value,
[data-theme="light"] .empty-state,
[data-theme="light"] .inspector-empty,
[data-theme="light"] .simulation-running {
  color: #000000;
}

[data-theme="light"] .field-input::placeholder,
[data-theme="light"] textarea::placeholder {
  color: #222222;
}

[data-theme="light"] .prompt-example-chip {
  border-color: rgba(47, 68, 96, 0.26);
  background: rgba(47, 68, 96, 0.08);
  color: #000000;
}

[data-theme="light"] .flow-tag {
  border-color: rgba(95, 115, 143, 0.22);
  background: rgba(95, 115, 143, 0.08);
  color: #000000;
}

[data-theme="light"] .topbar-brand,
[data-theme="light"] .workspace-copy,
[data-theme="light"] .field-input,
[data-theme="light"] .journey-catalog-card,
[data-theme="light"] .journey-mini-card,
[data-theme="light"] .journey-mini-title,
[data-theme="light"] .segment-feed-card,
[data-theme="light"] .segment-feed-card-copy,
[data-theme="light"] .segment-feed-card-foot,
[data-theme="light"] .segment-profile-table thead th,
[data-theme="light"] .segment-profile-table tbody td,
[data-theme="light"] .flow-overlay-message,
[data-theme="light"] .flow-legend-label,
[data-theme="light"] .flow-edge-label,
[data-theme="light"] .zoom-button,
[data-theme="light"] .button.secondary,
[data-theme="light"] .button.primary,
[data-theme="light"] .button.gold,
[data-theme="light"] .button.teal,
[data-theme="light"] .canvas-preview-box,
[data-theme="light"] .status-chip,
[data-theme="light"] .stat-row span,
[data-theme="light"] .detail-row span,
[data-theme="light"] .inspector-row span,
[data-theme="light"] .detail-value,
[data-theme="light"] .inspector-value {
  color: #000000;
}

[data-theme="light"] .flow-overlay-mark,
[data-theme="light"] .empty-state-mark,
[data-theme="light"] .inspector-empty-mark {
  color: rgba(0, 0, 0, 0.56);
  border-color: rgba(0, 0, 0, 0.16);
  background: rgba(0, 0, 0, 0.05);
}

[data-theme="light"] .list-card,
[data-theme="light"] .suite-card,
[data-theme="light"] .simulation-step {
  border-bottom-color: #c7d4e6;
}

[data-theme="light"] .qa-suite-card {
  border-color: #cbd8ea;
  background: #ffffff;
}

[data-theme="light"] .list-card.on,
[data-theme="light"] .list-card:hover {
  background: #eaf3ff;
}

[data-theme="light"] .profile-stat {
  background: #ffffff;
  border-color: #d4deec;
}

[data-theme="light"] .profile-avatar {
  border-color: #90badf;
  background: #e7f3ff;
  color: #000000;
}

[data-theme="light"] .outcome-chip,
[data-theme="light"] .score-pill,
[data-theme="light"] .suite-status,
[data-theme="light"] .simulation-step-state {
  color: #000000;
}

[data-theme="light"] .outcome-chip.teal,
[data-theme="light"] .summary-box.teal {
  border-color: rgba(15, 184, 184, 0.34);
  background: rgba(15, 184, 184, 0.15);
  color: #000000;
}

[data-theme="light"] .journey-client-tag {
  border-color: rgba(15, 184, 184, 0.4);
  background: rgba(15, 184, 184, 0.22);
  color: #000000;
}

[data-theme="light"] .outcome-chip.amber,
[data-theme="light"] .summary-box.amber {
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(245, 158, 11, 0.16);
  color: #000000;
}

[data-theme="light"] .summary-box.green,
[data-theme="light"] .score-pill.green {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.14);
  color: #000000;
}

[data-theme="light"] .score-pill.red {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.14);
  color: #000000;
}

[data-theme="light"] .suite-status.pass,
[data-theme="light"] .simulation-step-state.pass,
[data-theme="light"] .suite-status.fail,
[data-theme="light"] .simulation-step-state.fail,
[data-theme="light"] .suite-status.running,
[data-theme="light"] .simulation-step-state.running,
[data-theme="light"] .suite-status.blocked,
[data-theme="light"] .simulation-step-state.blocked,
[data-theme="light"] .simulation-step-state.skip,
[data-theme="light"] .suite-status.warn,
[data-theme="light"] .simulation-step-state.warn,
[data-theme="light"] .suite-status.skip {
  color: #000000;
}

/* Global light-mode text policy for copilot surfaces */
[data-theme="light"] .app-shell,
[data-theme="light"] .app-shell * {
  color: #000000 !important;
}

/* Do not force button text to black in light mode. Let each button style decide (white on dark, dark on light). */
[data-theme="light"] .app-shell button,
[data-theme="light"] .app-shell button *,
[data-theme="light"] .app-shell .button,
[data-theme="light"] .app-shell .button *,
[data-theme="light"] .app-shell .btn,
[data-theme="light"] .app-shell .btn *,
[data-theme="light"] .app-shell .seg-btn,
[data-theme="light"] .app-shell .seg-btn * {
  color: inherit !important;
}

[data-theme="light"] .app-shell input::placeholder,
[data-theme="light"] .app-shell textarea::placeholder {
  color: #000000 !important;
  opacity: 1;
}

[data-theme="light"] .app-shell .button.primary,
[data-theme="light"] .app-shell .seg-btn.is-primary {
  color: #ffffff !important;
}

[data-theme="light"] .button.primary,
[data-theme="light"] .btn-primary,
[data-theme="light"] .seg-btn.is-primary {
  color: #ffffff !important;
}

[data-theme="light"] .button.primary *,
[data-theme="light"] .btn-primary *,
[data-theme="light"] .seg-btn.is-primary * {
  color: #ffffff !important;
}

[data-theme="light"] .journey-card-tag {
  color: #0f1b2b;
  border-color: rgba(15, 184, 184, 0.35);
  background: rgba(15, 184, 184, 0.2);
}

[data-theme="light"] .journey-mini-card.status-production-ready {
  border-color: rgba(34, 197, 94, 0.45);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.08));
}

[data-theme="light"] .journey-mini-card.status-ready-for-activation {
  border-color: rgba(38, 128, 235, 0.46);
  background: linear-gradient(135deg, rgba(38, 128, 235, 0.19), rgba(38, 128, 235, 0.08));
}

[data-theme="light"] .journey-mini-card.status-in-qa-review {
  border-color: rgba(245, 158, 11, 0.46);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.08));
}

[data-theme="light"] .journey-mini-card.status-needs-review {
  border-color: rgba(139, 92, 246, 0.44);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.08));
}

[data-theme="light"] .journey-mini-card.status-draft {
  border-color: rgba(95, 115, 143, 0.45);
  background: linear-gradient(135deg, rgba(95, 115, 143, 0.17), rgba(95, 115, 143, 0.07));
}

@media (max-width: 1500px) {
  .qa-grid {
    grid-template-columns: 1fr;
  }

  .blueprint-layout {
    display: grid;
    grid-template-columns: minmax(280px, 300px) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(260px, 36vh);
  }

  .blueprint-layout .editor-panel {
    grid-column: 1;
    grid-row: 1 / span 2;
    width: auto;
    flex: initial;
    border-right: 1px solid #1e2d42;
    border-bottom: 0;
  }

  .blueprint-layout .canvas-panel {
    grid-column: 2;
    grid-row: 1;
  }

  .blueprint-layout .inspector-panel {
    grid-column: 2;
    grid-row: 2;
    width: auto;
    flex: initial;
    border-right: 0;
    border-top: 1px solid #1e2d42;
  }

  .blueprint-layout .inspector-panel .panel-head {
    padding-bottom: 12px;
  }
}

@media (max-width: 1360px) {
  .module-layout {
    flex-direction: column;
  }

  .blueprint-layout {
    display: flex;
  }

  .side-panel.narrow,
  .side-panel.wide {
    width: 100%;
    flex: 0 0 auto;
    border-right: 0;
    border-bottom: 1px solid #1e2d42;
  }

  .panel-body {
    max-height: 360px;
  }
}

@media (max-width: 1180px) {
  body {
    overflow: auto;
  }

  .app-shell {
    height: auto;
    min-height: 100vh;
  }

  .workspace-shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex: 0 0 auto;
    border-right: 0;
    border-bottom: 1px solid #1e2d42;
  }

  .workspace-grid.two-one,
  .workspace-grid.three-col,
  .module-kpi-grid,
  .module-overview-grid,
  .connector-grid,
  .journey-catalog-grid,
  .section-card-grid,
  .segment-feed-grid,
  .segment-grid,
  .profile-stat-grid,
  .three-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 880px) {
  .topbar {
    flex-wrap: wrap;
    height: auto;
    padding: 10px 12px;
  }

  .topbar-right {
    width: 100%;
    margin-left: 0;
    flex-wrap: wrap;
  }

  .workspace-main {
    padding: 10px;
  }

  .two-col {
    grid-template-columns: 1fr;
  }

  .segment-source-inline {
    min-width: 100%;
  }

  .rule-row {
    grid-template-columns: 1fr;
  }

  .flow-toolbar,
  .content-tabs,
  .workspace-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .tab-actions {
    padding: 0 16px 12px;
  }

  .ajo-activation-card {
    position: static;
    min-width: min(100%, 330px);
    max-width: 100%;
    margin-top: 10px;
  }

  .ajo-activation-card::before {
    display: none;
  }
}
`,fn=152,nn=112,Ue=128,on=68,bn=58,rn=28,wn=34,wr=rn+wn+5*nn+70,Qn=3,zt=.55,Mt=2.2,_n=.12,Nr=[{label:"75%",scale:.88},{label:"100%",scale:1.08},{label:"125%",scale:1.48},{label:"150%",scale:Qn},{label:"175%",scale:2.08},{label:"200%",scale:2.5},{label:"300%",scale:3.5}];function Tt(n,t){if(typeof n!="string")return n;const s=n.trim();return/^#[0-9a-f]{6}$/i.test(s)?`${s}${t}`:s}function kr(n){return n==="#C89B3C"?"#8A6200":n==="#F59E0B"?"#A55300":n}function Sr(n,t){return rn+wn+n.findIndex(s=>s.id===t)*nn}function Cr(n,t){return{x:bn+n.column*fn,y:Sr(t,n.lane)+(nn-on)/2+(n.offsetY??0)}}function Ve(n,t){const s=typeof n.x=="number"&&typeof n.y=="number"?{x:n.x,y:n.y}:Cr(n,t);return{...s,cx:s.x+Ue/2,cy:s.y+on/2}}function Ar(n,t,s){const a=t[n.from],r=t[n.to];if(!a||!r)return"";const i=Ve(a,s),d=Ve(r,s);if(Math.abs(d.cx-i.cx)>=Math.abs(d.cy-i.cy)){const g=d.cx>=i.cx?i.x+Ue:i.x,v=d.cx>=i.cx?d.x:d.x+Ue,j=i.cy,_=d.cy,I=(g+v)/2;return`M ${g} ${j} C ${I} ${j} ${I} ${_} ${v} ${_}`}const o=i.cx,c=d.cx,l=d.cy>=i.cy?i.y+on:i.y,f=d.cy>=i.cy?d.y:d.y+on,u=(l+f)/2;return`M ${o} ${l} C ${o} ${u} ${c} ${u} ${c} ${f}`}function _r(n,t,s){const a=t[n.from],r=t[n.to];if(!a||!r)return null;const i=Ve(a,s),d=Ve(r,s);return{x:(i.cx+d.cx)/2,y:(i.cy+d.cy)/2}}function $r({edge:n,nodesById:t,lanes:s,selected:a,onSelectEdge:r}){const i=Ar(n,t,s),d=Qe[n.type]??Qe.flow,p=n.type==="holdout"||n.type==="varB",o=t[n.from],c=t[n.to];if(!i||!o||!c)return null;const l=Ve(o,s),f=Ve(c,s),u=(l.cx+f.cx)/2+4,g=(l.cy+f.cy)/2-6;return e.jsxs("g",{className:`flow-edge ${a?"is-selected":""}`,children:[a?e.jsx("path",{d:i,fill:"none",stroke:typeof document<"u"&&document.documentElement.dataset.theme==="light"?"rgba(15,23,42,0.18)":"rgba(255,255,255,0.16)",strokeWidth:"5",strokeLinecap:"round"}):null,e.jsx("path",{d:i,fill:"none",stroke:d,strokeWidth:"1.6",strokeDasharray:p?"6 4":void 0,markerEnd:`url(#arrow-${n.type})`,opacity:"0.92"}),e.jsx("path",{d:i,fill:"none",stroke:"transparent",strokeWidth:"12",className:"flow-edge-hit",onMouseDown:v=>{v.stopPropagation(),r(n.id)}}),n.label?e.jsx("text",{x:u,y:g,textAnchor:"middle",className:"flow-edge-label",fill:d,children:n.label}):null]})}function Er({node:n,lanes:t,selectedNodeId:s,onSelectNode:a,onDragStart:r}){const i=typeof document<"u"&&document.documentElement.dataset.theme==="light",d=n.accent==="#C89B3C"||n.accent==="#F59E0B",p=i&&d?kr(n.accent):n.accent,o=i?d?"46":"2F":"1A",c=i?d?"3F":"25":"16",l=Tt((n.kind==="end"||n.kind==="endDashed",n.accent),n.kind==="end"||n.kind==="endDashed"?c:o),f=i&&d?p:n.accent,u=i&&d?"#4B2D00":Tt(n.accent,"AA"),g=Ve(n,t),v=n.id===s,j=(n.title??[]).filter(Boolean).slice(0,2),_=(n.subtitle??[]).filter(Boolean).slice(0,2),I=g.cy-(j.length>1?10:4)-(_.length?6:0);return e.jsxs("g",{"data-node":n.id,className:`flow-node ${v?"is-selected":""}`,onMouseDown:x=>r(x,n),onClick:x=>{x.stopPropagation(),a(n.id)},children:[n.kind==="decision"?e.jsx("polygon",{points:`${g.cx},${g.y} ${g.x+Ue},${g.cy} ${g.cx},${g.y+on} ${g.x},${g.cy}`,fill:l,stroke:p,strokeWidth:"1.5"}):e.jsx("rect",{x:g.x,y:g.y,width:Ue,height:on,rx:n.kind==="start"||n.kind.startsWith("end")?on/2:8,fill:l,stroke:p,strokeWidth:n.kind==="split"?2.2:1.6,strokeDasharray:n.kind==="holdout"||n.kind==="wait"||n.kind==="endDashed"?"6 4":void 0}),n.variantBadge?e.jsxs(e.Fragment,{children:[e.jsx("rect",{x:g.x+Ue-27,y:g.y-2,width:27,height:12,rx:5,fill:"rgba(139,92,246,0.3)",stroke:"rgba(196,181,253,0.75)",strokeWidth:"0.8"}),e.jsx("text",{x:g.x+Ue-13.5,y:g.y+6.8,textAnchor:"middle",className:"flow-badge",children:n.variantBadge})]}):null,j.map((x,S)=>e.jsx("text",{x:g.cx,y:I+S*13,textAnchor:"middle",className:`flow-node-title ${n.kind==="decision"?"decision":""}`,fill:f,children:x},`${n.id}-title-${S}`)),_.map((x,S)=>e.jsx("text",{x:g.cx,y:g.cy+(j.length>1?13:9)+S*10,textAnchor:"middle",className:"flow-node-subtitle",fill:u,children:x},`${n.id}-subtitle-${S}`))]})}function Dr({generated:n,busy:t,progress:s,nodes:a,edges:r,lanes:i,phaseHeaders:d,selectedNodeId:p,selectedEdgeId:o,onSelectNode:c,onSelectEdge:l,onClearSelection:f,onNodeMove:u}){const[g,v]=m.useState(Qn),[j,_]=m.useState({x:0,y:0}),I=m.useRef(null),x=m.useRef(null),[S,T]=m.useState(0),C=m.useMemo(()=>a.reduce((P,N)=>(P[N.id]=N,P),{}),[a]),{SVG_WIDTH:B,SVG_HEIGHT:E,columnCount:D}=m.useMemo(()=>{const P=a.reduce((F,q)=>Math.max(F,q.column??0),12),N=Math.max(P+1,13);return{SVG_WIDTH:bn*2+N*fn+Ue,SVG_HEIGHT:wr,columnCount:N}},[a]),h=Math.round(g/1.08*100),k=!!(p||o),$=typeof document<"u"&&document.documentElement.dataset.theme==="light",A=$?"#f7fbff":"#080B10",Y=$?"rgba(15,23,42,0.03)":"rgba(255,255,255,0.015)",ae=$?"rgba(15,23,42,0.015)":"rgba(255,255,255,0.008)",b=$?"rgba(15,23,42,0.08)":"rgba(255,255,255,0.05)",L=$?"rgba(15,23,42,0.04)":"rgba(255,255,255,0.025)",y=$?"rgba(15,23,42,0.08)":"rgba(255,255,255,0.025)",Z=$?"#101828":"#8ea2bf";function de(P=g,N=S){return Math.max(0,B*P-N)}function Q(P,N=g,F=S){const q=de(N,F);return Math.min(0,Math.max(-q,P))}m.useEffect(()=>{const P=x.current;if(!P)return;const N=()=>{T(P.clientWidth)};if(N(),typeof ResizeObserver<"u"){const F=new ResizeObserver(()=>{N()});return F.observe(P),()=>F.disconnect()}return window.addEventListener("resize",N),()=>window.removeEventListener("resize",N)},[]),m.useEffect(()=>{_(P=>{const N=Q(P.x);return N===P.x?P:{...P,x:N}})},[S,g]),m.useEffect(()=>{function P(F){const q=I.current;if(q){if(q.mode==="pan"){const oe=F.clientX-q.startClientX,ge=F.clientY-q.startClientY;_({x:Q(q.originPan.x+oe),y:q.originPan.y+ge});return}if(q.mode==="node"){const oe=q.originNode.x+(F.clientX-q.startClientX)/g,ge=q.originNode.y+(F.clientY-q.startClientY)/g;u(q.nodeId,{x:Math.max(44,oe),y:Math.max(rn+wn+8,ge)})}}}function N(){I.current=null}return window.addEventListener("mousemove",P),window.addEventListener("mouseup",N),()=>{window.removeEventListener("mousemove",P),window.removeEventListener("mouseup",N)}},[u,g]);function se(P,N=1.1){const F=x.current;if(!F||!P)return;const q=P.cx??P.x,oe=P.cy??P.y,ge=F.clientWidth,K=F.clientHeight;v(N),_({x:Q(ge/2-q*N,N,ge),y:K/2-oe*N})}function ie(P){P.button===0&&(f(),I.current={mode:"pan",startClientX:P.clientX,startClientY:P.clientY,originPan:j})}function V(P,N){if(P.button!==0)return;P.stopPropagation();const F=Ve(N,i);c(N.id),I.current={mode:"node",nodeId:N.id,startClientX:P.clientX,startClientY:P.clientY,originNode:{x:F.x,y:F.y}}}function le(){_({x:0,y:0}),v(Qn)}function je(P){const N=x.current,F=Math.min(Mt,Math.max(zt,Number((g+P).toFixed(2))));if(!N||F===g)return;const q=N.clientWidth,oe=N.clientHeight;v(F),_({x:Q(q/2-(q/2-j.x)/g*F,F,q),y:oe/2-(oe/2-j.y)/g*F})}function ve(P){const N=x.current;if(!N)return;P.preventDefault();const F=N.getBoundingClientRect(),q=P.clientX-F.left,oe=P.clientY-F.top,ge=(q-j.x)/g,K=(oe-j.y)/g,xe=P.deltaY<0?_n:-_n,we=Math.min(Mt,Math.max(zt,Number((g+xe).toFixed(2))));v(we),_({x:Q(q-ge*we,we,N.clientWidth),y:oe-K*we})}function H(){if(p&&C[p]){se(Ve(C[p],i),1.35);return}if(o){const P=r.find(N=>N.id===o);P&&se(_r(P,C,i),1.18)}}return e.jsxs("div",{className:"flow-shell",children:[e.jsxs("div",{className:"flow-toolbar",children:[e.jsxs("div",{className:"flow-toolbar-group",children:[e.jsx("span",{className:"flow-toolbar-label",children:"Zoom"}),e.jsx("button",{type:"button",className:"zoom-button zoom-button-icon",onClick:()=>je(-_n),"aria-label":"Zoom out",children:"-"}),e.jsxs("div",{className:"zoom-readout",children:[h,"%"]}),e.jsx("button",{type:"button",className:"zoom-button zoom-button-icon",onClick:()=>je(_n),"aria-label":"Zoom in",children:"+"}),Nr.map(P=>e.jsx("button",{type:"button",className:`zoom-button ${g===P.scale?"is-active":""}`,onClick:()=>v(P.scale),children:P.label},P.label)),e.jsx("button",{type:"button",className:"zoom-button",onClick:le,children:"Reset"}),e.jsx("button",{type:"button",className:"zoom-button zoom-button-focus",onClick:H,disabled:!k,children:"Focus Selection"})]}),e.jsxs("div",{className:"flow-toolbar-group flow-toolbar-help",children:[e.jsx("span",{className:"flow-hint",children:"Drag nodes to reposition. Click arrows to reroute in the inspector."}),n?e.jsxs("div",{className:"flow-tags",children:[e.jsxs("span",{className:"flow-tag",children:[a.length," nodes"]}),e.jsxs("span",{className:"flow-tag",children:[r.length," arrows"]}),e.jsx("span",{className:"flow-tag",children:"A/B + holdout"})]}):null]})]}),e.jsxs("div",{ref:x,className:"flow-viewport",onMouseDown:ie,onWheel:ve,children:[!n&&!t?e.jsxs("div",{className:"empty-state",children:[e.jsx("div",{className:"empty-state-mark",children:"FLOW"}),e.jsx("p",{children:"Generate the blueprint to reveal the swimlane canvas, then drag nodes and edit arrows from the inspector."})]}):null,n?e.jsxs("svg",{className:"flow-svg",viewBox:`0 0 ${B} ${E}`,preserveAspectRatio:"xMinYMin meet",children:[e.jsx("defs",{children:Object.entries(Qe).map(([P,N])=>e.jsx("marker",{id:`arrow-${P}`,markerWidth:"6",markerHeight:"6",refX:"5",refY:"3",orient:"auto",children:e.jsx("polygon",{points:"0,0 6,3 0,6",fill:N})},P))}),e.jsxs("g",{transform:`translate(${j.x} ${j.y}) scale(${g})`,children:[e.jsx("rect",{width:B,height:E,fill:A}),i.map((P,N)=>{const F=rn+wn+N*nn;return e.jsxs("g",{children:[e.jsx("rect",{x:"0",y:F,width:B,height:nn,fill:N%2===0?Y:ae}),e.jsx("rect",{x:"0",y:F,width:"44",height:nn,fill:`${P.color}16`}),e.jsx("text",{transform:`rotate(-90 22 ${F+nn/2})`,x:"22",y:F+nn/2,textAnchor:"middle",className:"flow-lane-label",fill:`${P.color}CC`,children:P.label}),e.jsx("line",{x1:"0",y1:F,x2:B,y2:F,stroke:b})]},P.id)}),e.jsx("rect",{x:"0",y:rn,width:B,height:wn,fill:L}),d.map((P,N)=>e.jsx("text",{x:bn+N*fn+Ue/2,y:rn+21,textAnchor:"middle",className:"flow-phase-label",children:P},P)),Array.from({length:D+1}).map((P,N)=>e.jsx("line",{x1:bn+N*fn,y1:rn,x2:bn+N*fn,y2:E-28,stroke:y},`grid-${N}`)),r.map(P=>e.jsx($r,{edge:P,nodesById:C,lanes:i,selected:P.id===o,onSelectEdge:l},P.id??`${P.from}-${P.to}`)),a.map(P=>e.jsx(Er,{node:P,lanes:i,selectedNodeId:p,onSelectNode:c,onDragStart:V},P.id)),e.jsx("g",{transform:`translate(52 ${E-20})`,children:[{label:"Yes / conversion",color:Qe.yes,dashed:!1},{label:"No / alternate",color:Qe.no,dashed:!1},{label:"Holdout exit",color:Qe.holdout,dashed:!0},{label:"Variant B",color:Qe.varB,dashed:!0},{label:"Variant A",color:Qe.varA,dashed:!1}].map((P,N)=>e.jsxs("g",{transform:`translate(${N*168} 0)`,children:[e.jsx("line",{x1:"0",y1:"0",x2:"18",y2:"0",stroke:P.color,strokeWidth:"1.6",strokeDasharray:P.dashed?"6 4":void 0}),e.jsx("polygon",{points:"14,-2.5 19,0 14,2.5",fill:P.color}),e.jsx("text",{x:"24",y:"4",className:"flow-legend-label",fill:Z,children:P.label})]},P.label))})]})]}):null,t?e.jsxs("div",{className:"flow-overlay",children:[e.jsx("div",{className:"flow-overlay-mark",children:"FLOW"}),e.jsx("div",{className:"flow-overlay-message",children:s.message}),e.jsx("div",{className:"progress-track wide",children:e.jsx("span",{className:"progress-fill",style:{width:`${s.percent}%`}})})]}):null]})]})}const Ir=[["start","Start pill"],["action","Action box"],["decision","Decision diamond"],["wait","Wait"],["holdout","Holdout"],["split","A/B split"],["end","Exit pill"],["endDashed","Exit dashed"]],Rr=[["flow","Flow"],["yes","Yes"],["no","No"],["holdout","Holdout"],["varA","Variant A"],["varB","Variant B"]],Pr={sports:"sports",media:"media",telecom:"telecom",automotive:"automotive"};function ka(){if(typeof window>"u")return"all";try{const n=String(window.localStorage.getItem("cdp_source_system")??"").trim().toLowerCase();return Pr[n]??"all"}catch{return"all"}}function Je(n){return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Number(n||0))}function Gn(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(n||0))}function pn({label:n,value:t,sub:s,color:a,icon:r}){return e.jsxs("div",{style:{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,position:"relative",overflow:"hidden"},children:[e.jsx("div",{style:{position:"absolute",inset:0,background:`linear-gradient(135deg, ${a}1f, transparent 55%)`}}),e.jsx("div",{style:{width:38,height:38,borderRadius:10,background:`${a}22`,color:a,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,zIndex:1},children:r}),e.jsxs("div",{style:{display:"flex",flexDirection:"column",zIndex:1},children:[e.jsx("span",{style:{fontSize:10,fontWeight:800,textTransform:"uppercase",color:"var(--text-muted)",letterSpacing:"0.06em"},children:n}),e.jsx("div",{style:{fontSize:18,fontWeight:800,color:"var(--text-primary)"},children:t}),e.jsx("div",{style:{fontSize:11,color:"var(--text-muted)"},children:s})]})]})}function Zn(n){return String((n==null?void 0:n.name)??"").trim().toLowerCase()==="new journey"}function Sa(){return e.jsxs("div",{className:"inspector-empty",children:[e.jsx("div",{className:"inspector-empty-mark",children:"EDIT"}),e.jsx("p",{children:"Select a node or arrow to customize labels, shape, placement, routing, and config details."})]})}function zr({node:n,detail:t,lanes:s,onDeleteSelection:a,onNodeFieldChange:r,onNodeLineChange:i,onDetailChange:d,onDetailRowChange:p,onAddDetailRow:o,onRemoveDetailRow:c}){if(!n||!t)return e.jsx(Sa,{});const l=[...n.title??[],""].slice(0,2),f=[...n.subtitle??[],""].slice(0,2);return e.jsxs("div",{className:"inspector-body",children:[e.jsx("div",{className:"inspector-title",style:{color:t.accent},children:t.title||l.join(" ")||n.id}),e.jsxs("div",{className:"inspector-meta",children:[n.id," / ",n.kind]}),e.jsx("div",{className:"inspector-divider",style:{background:t.accent}}),e.jsx("div",{className:"inspector-actions",children:e.jsx("button",{type:"button",className:"button secondary small",onClick:a,children:"Remove Node"})}),e.jsx("div",{className:"section-label",children:"Shape & placement"}),e.jsxs("div",{className:"two-col",children:[e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Lane"}),e.jsx("select",{className:"field-input",value:n.lane,onChange:u=>r("lane",u.target.value),children:s.map(u=>e.jsx("option",{value:u.id,children:u.label},u.id))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Shape"}),e.jsx("select",{className:"field-input",value:n.kind,onChange:u=>r("kind",u.target.value),children:Ir.map(([u,g])=>e.jsx("option",{value:u,children:g},u))})]})]}),e.jsxs("div",{className:"three-col",children:[e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Column"}),e.jsx("input",{className:"field-input inspector-input",type:"number",value:n.column,onChange:u=>r("column",Number(u.target.value))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Accent"}),e.jsx("input",{className:"field-input color-input",type:"color",value:n.accent,onChange:u=>r("accent",u.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Variant badge"}),e.jsx("input",{className:"field-input inspector-input",value:n.variantBadge??"",onChange:u=>r("variantBadge",u.target.value||void 0)})]})]}),e.jsx("div",{className:"section-label",children:"Canvas text"}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Title line 1"}),e.jsx("input",{className:"field-input inspector-input",value:l[0],onChange:u=>i("title",0,u.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Title line 2"}),e.jsx("input",{className:"field-input inspector-input",value:l[1],onChange:u=>i("title",1,u.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Subtitle line 1"}),e.jsx("input",{className:"field-input inspector-input",value:f[0],onChange:u=>i("subtitle",0,u.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Subtitle line 2"}),e.jsx("input",{className:"field-input inspector-input",value:f[1],onChange:u=>i("subtitle",1,u.target.value)})]}),e.jsx("div",{className:"section-label",children:"Inspector details"}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Inspector title"}),e.jsx("input",{className:"field-input inspector-input",value:t.title,onChange:u=>d("title",u.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Context note"}),e.jsx("textarea",{className:"field-input inspector-textarea",value:t.note,onChange:u=>d("note",u.target.value)})]}),e.jsx("div",{className:"section-label",children:"Property rows"}),e.jsx("div",{className:"inspector-actions",children:e.jsx("button",{type:"button",className:"button secondary small",onClick:o,children:"Add Property"})}),t.rows.map((u,g)=>e.jsxs("div",{className:"inspector-editor-card",children:[e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Key"}),e.jsx("input",{className:"field-input inspector-input",value:u.key,onChange:v=>p(g,"key",v.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Value"}),e.jsx("textarea",{className:"field-input inspector-textarea short",value:u.value,onChange:v=>p(g,"value",v.target.value)})]}),e.jsx("button",{type:"button",className:"button secondary small",onClick:()=>c(g),children:"Remove"})]},`${n.id}-row-${g}`)),e.jsx("div",{className:"section-label",children:"Canvas coordinates"}),e.jsxs("div",{className:"three-col",children:[e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"X"}),e.jsx("input",{className:"field-input inspector-input",type:"number",value:n.x??"",onChange:u=>r("x",u.target.value===""?void 0:Number(u.target.value))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Y"}),e.jsx("input",{className:"field-input inspector-input",type:"number",value:n.y??"",onChange:u=>r("y",u.target.value===""?void 0:Number(u.target.value))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Offset Y"}),e.jsx("input",{className:"field-input inspector-input",type:"number",value:n.offsetY??0,onChange:u=>r("offsetY",Number(u.target.value))})]})]}),e.jsx("div",{className:"info-box",style:{borderColor:`${t.accent}55`,color:t.accent},children:"Drag nodes directly on the canvas or fine-tune the coordinates here for exact placement."})]})}function Mr({edge:n,nodes:t,onDeleteSelection:s,onEdgeFieldChange:a}){return n?e.jsxs("div",{className:"inspector-body",children:[e.jsx("div",{className:"inspector-title",style:{color:"#9AC9FF"},children:"Arrow / connector"}),e.jsxs("div",{className:"inspector-meta",children:[n.id," / ",n.type]}),e.jsx("div",{className:"inspector-divider",style:{background:"#2680EB"}}),e.jsx("div",{className:"inspector-actions",children:e.jsx("button",{type:"button",className:"button secondary small",onClick:s,children:"Remove Arrow"})}),e.jsx("div",{className:"section-label",children:"Routing"}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"From node"}),e.jsx("select",{className:"field-input",value:n.from,onChange:r=>a("from",r.target.value),children:t.map(r=>e.jsxs("option",{value:r.id,children:[r.id," - ",(r.title??[]).filter(Boolean).join(" ")]},r.id))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"To node"}),e.jsx("select",{className:"field-input",value:n.to,onChange:r=>a("to",r.target.value),children:t.map(r=>e.jsxs("option",{value:r.id,children:[r.id," - ",(r.title??[]).filter(Boolean).join(" ")]},r.id))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Arrow type"}),e.jsx("select",{className:"field-input",value:n.type,onChange:r=>a("type",r.target.value),children:Rr.map(([r,i])=>e.jsx("option",{value:r,children:i},r))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Arrow label"}),e.jsx("input",{className:"field-input inspector-input",value:n.label,onChange:r=>a("label",r.target.value)})]}),e.jsx("div",{className:"info-box info-blue",children:"Use this panel to reroute branches, update A/B connectors, or rename decision labels like Yes, No, or Holdout."})]}):e.jsx(Sa,{})}function Tr({categories:n,subcategories:t,journeys:s,report:a,onSelectJourney:r,categoryFilter:i,subCategoryFilter:d,onCategoryChange:p,onSubCategoryChange:o}){const[c,l]=m.useState(!1);m.useEffect(()=>{o("all")},[i]),m.useEffect(()=>{i!=="all"&&!n.some(x=>x.id===i)&&p("all")},[n,i,p]),m.useEffect(()=>{if(c)return;const x=ka();x!=="all"&&n.some(S=>S.id===x)&&x!==i&&p(x)},[n,i,c]);const f=m.useMemo(()=>n.reduce((x,S)=>(x.set(S.id,S),x),new Map),[n]),u=m.useMemo(()=>{const x=["sports","media","telecom","automotive"],S=x.map(C=>n.find(B=>B.id===C)).filter(Boolean),T=n.filter(C=>!x.includes(C.id)).sort((C,B)=>C.name.localeCompare(B.name));return[...S,...T]},[n]),g=m.useMemo(()=>[...i==="all"?t:t.filter(S=>S.categoryId===i)].sort((S,T)=>{const C=S.categoryId.localeCompare(T.categoryId);return C!==0?C:S.name.localeCompare(T.name)}),[i,t]),v=m.useMemo(()=>{const x=i==="all"?s:s.filter(T=>T.categoryId===i);let S=x;return d!=="all"&&(i==="all"?S=x.filter(T=>`${T.categoryId}::${T.subCategoryId??"general"}`===d):S=x.filter(T=>T.subCategoryId===d)),[...S].sort((T,C)=>T.name.localeCompare(C.name))},[s,i,d]),j=m.useMemo(()=>{const x=new Map;v.forEach(T=>{var D;const C=T.subCategoryId??"general",B=`${T.categoryId}::${C}`,E=x.get(B);if(E){E.journeys.push(T);return}x.set(B,{key:B,categoryId:T.categoryId,categoryName:((D=f.get(T.categoryId))==null?void 0:D.name)??T.categoryName??"Journey",subCategoryId:C,subCategoryName:T.subCategoryName??"General",journeys:[T]})});const S=new Map(u.map((T,C)=>[T.id,C]));return[...x.values()].sort((T,C)=>{const B=(S.get(T.categoryId)??999)-(S.get(C.categoryId)??999);return B!==0?B:T.subCategoryName.localeCompare(C.subCategoryName)})},[f,u,v]),_=m.useMemo(()=>{const x=new Map;return j.forEach(S=>{var C;const T=x.get(S.categoryId);if(T){T.sections.push(S),T.totalJourneys+=S.journeys.length;return}x.set(S.categoryId,{categoryId:S.categoryId,categoryName:S.categoryName,description:((C=f.get(S.categoryId))==null?void 0:C.description)??"",sections:[S],totalJourneys:S.journeys.length})}),[...x.values()]},[f,j]),I=m.useMemo(()=>{const x=new Map;v.forEach(k=>{var b;const $=((b=f.get(k.categoryId))==null?void 0:b.name)??k.categoryName??"Journey",A=k.subCategoryName??"General",Y=`${k.categoryId}::${k.subCategoryId??"general"}`,ae=x.get(Y);ae?ae.count+=1:x.set(Y,{key:Y,categoryName:$,subCategoryName:A,count:1})});const S=u.map(k=>({...k,count:v.filter($=>$.categoryId===k.id).length})).filter(k=>k.count>0),T=v.filter(k=>{const $=String(k.status??k.runStatus??"").toLowerCase();return k.active===!0||k.isActive===!0||$==="active"}).length,C=v.filter(k=>{const $=String(k.status??k.runStatus??"").toLowerCase();return k.active===!1||k.isActive===!1||$==="inactive"}).length,B=T>0?T:v.length-C,E=Math.max(0,v.length-B),D=v.filter(k=>Zn(k)).length,h=Math.max(0,v.length-D);return{total:v.length,active:B,inactive:E,preset:h,custom:D,sections:x.size,categoryRows:S,topSections:[...x.values()].sort((k,$)=>$.count-k.count).slice(0,5),recentJourneys:v.slice(0,5)}},[f,u,v]);return e.jsxs("section",{className:"workspace-panel",children:[e.jsxs("div",{className:"workspace-head",children:[e.jsxs("div",{children:[e.jsx("div",{className:"workspace-title",children:"Campaigns & Journeys"}),e.jsx("div",{className:"workspace-copy",children:"Start in the catalogue, pick any saved journey, and open it in the Journey Editor for updates, QA prep, and save-as flows."})]}),e.jsxs("div",{style:{display:"flex",gap:10,flexWrap:"wrap"},children:[e.jsxs("label",{className:"field compact",style:{minWidth:220},children:[e.jsx("span",{className:"field-label small",children:"Filter by vertical"}),e.jsxs("select",{className:"field-input",value:i,onChange:x=>{l(!0),p(x.target.value)},children:[e.jsx("option",{value:"all",children:"All Journeys"}),u.map(x=>e.jsx("option",{value:x.id,children:x.name},x.id))]})]}),e.jsxs("label",{className:"field compact",style:{minWidth:240},children:[e.jsx("span",{className:"field-label small",children:"Filter by section"}),e.jsxs("select",{className:"field-input",value:d,onChange:x=>o(x.target.value),children:[e.jsx("option",{value:"all",children:i==="all"?"All Sections":"All Sections in Vertical"}),g.map(x=>{var S;return e.jsx("option",{value:i==="all"?`${x.categoryId}::${x.id}`:x.id,children:i==="all"?`${((S=f.get(x.categoryId))==null?void 0:S.name)??x.categoryId} / ${x.name}`:x.name},`${x.categoryId}-${x.id}`)})]})]})]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:12,marginTop:12,marginBottom:16},children:[e.jsx(pn,{label:"Total Journeys",value:I.total,sub:"catalogue size",color:"#E5C97A",icon:"🧭"}),e.jsx(pn,{label:"Active Journeys",value:I.active,sub:"currently running",color:"#22c55e",icon:" "}),e.jsx(pn,{label:"Inactive Journeys",value:I.inactive,sub:"paused / inactive",color:"#f59e0b",icon:"⏸"}),e.jsx(pn,{label:"Prebuilt Journeys",value:I.preset,sub:"template journeys",color:"#2680eb",icon:"📦"}),e.jsx(pn,{label:"Custom Journeys",value:I.custom,sub:"user created",color:"#14b8a6",icon:"✨"})]}),e.jsx("div",{className:"stack-panel",children:_.length?_.map(x=>e.jsxs("div",{className:"content-card",children:[e.jsxs("div",{className:"content-card-head",children:[e.jsxs("div",{children:[e.jsx("div",{className:"content-card-title",children:x.categoryName}),e.jsx("div",{className:"helper-text no-top",children:x.description||"Journey catalogue"})]}),e.jsxs("span",{className:"badge subtle",children:[x.totalJourneys," journeys"]})]}),e.jsx("div",{className:"content-card-body",children:e.jsx("div",{className:"section-card-grid",children:x.sections.map(S=>e.jsxs("div",{className:"section-card",children:[e.jsxs("div",{className:"section-card-head",children:[e.jsx("div",{className:"section-card-title",children:S.subCategoryName}),e.jsx("span",{className:"badge subtle",children:S.journeys.length})]}),e.jsx("div",{className:"section-card-body",children:S.journeys.map(T=>{const C=T.active!==!1,B=Zn(T);return e.jsxs("button",{type:"button",className:`journey-mini-card ${C?"state-active":"state-inactive"}`,onClick:()=>r(T.slug),children:[e.jsx("div",{className:"journey-mini-title",children:T.name}),e.jsx("span",{className:`journey-card-status-tag ${C?"is-active":"is-inactive"}`,children:C?"Active":"Inactive"}),e.jsx("span",{className:`journey-card-tag ${B?"tag-custom":"tag-prebuilt"}`,children:B?"Custom":"Pre Built"})]},T.slug)})})]},S.key))})})]},x.categoryId)):e.jsx("div",{className:"content-card",children:e.jsx("div",{className:"content-card-body",children:e.jsx("div",{className:"helper-text",children:"No journeys found for the selected filters."})})})})]})}function Lr({report:n,journeys:t=[]}){var $;const[s,a]=m.useState("");if(!(n!=null&&n.summary))return null;const r=n.summary,i=Array.isArray(n.delivery_funnel)?n.delivery_funnel:[],d=Array.isArray(n.channel_mix)?n.channel_mix:[],p=Array.isArray(n.campaign_performance)?n.campaign_performance.slice(0,5):[],o=Math.max(...i.map(A=>Number(A.value||0)),1),c=i.map((A,Y)=>({name:A.stage,value:Number(A.value||0),color:["#1f6fb8","#3b8ddb","#7fb6e9","#b5d6f3","#d8ebfa"][Y%5]})),l=d.map((A,Y)=>({label:A.channel,name:A.channel,value:Number(A.value||0),count:Number(A.count||0),color:A.color||["#3b8ddb","#22a979","#7c73dd","#66a329","#f59e0b"][Y%5]})),f=Array.isArray(n.performance_rate_trend)?n.performance_rate_trend:[],u=Array.isArray(n.revenue_trend)?n.revenue_trend:[],g=Array.isArray(n.channel_effectiveness)?n.channel_effectiveness:[],v=Array.isArray(n.top_campaigns_comparison)?n.top_campaigns_comparison:[],j=Array.isArray(n.journey_completion_funnel)?n.journey_completion_funnel:[],_=Math.max(...j.map(A=>Number(A.value||0)),1),I=Array.isArray(t)?t:[],x=I.length||Number(r.total_journeys||r.active_journeys||0),S=I.length?I.filter(A=>A.active!==!1).length:Number(r.active_journeys||0),T=Math.max(0,x-S),C=I.filter(A=>Zn(A)).length,B=Math.max(0,x-C),E=[{label:"Total Journeys",value:Je(x),sub:"catalogue size",color:"#E5C97A",icon:"J"},{label:"Active Journeys",value:Je(S),sub:"currently running",color:"#22c55e",icon:"A"},{label:"Inactive Journeys",value:Je(T),sub:"paused / inactive",color:"#f59e0b",icon:"I"},{label:"Prebuilt Journeys",value:Je(B),sub:"template journeys",color:"#2680eb",icon:"P"},{label:"Custom Journeys",value:Je(C),sub:"user created",color:"#14b8a6",icon:"C"}],D=[{id:"delivery-funnel",title:"Delivery Funnel",defaultVisible:!0,render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Delivery Funnel"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Ie,{width:"100%",height:260,children:e.jsxs(en,{layout:"vertical",data:c,margin:{top:12,right:18,bottom:8,left:8},children:[e.jsx(sn,{stroke:"rgba(148, 163, 184, 0.18)",horizontal:!1}),e.jsx(Me,{type:"number",domain:[0,o],tickFormatter:Je,tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700},axisLine:!1,tickLine:!1,allowDecimals:!1}),e.jsx(Te,{type:"category",dataKey:"name",width:92,tick:{fontSize:12,fill:"var(--text-muted)",fontWeight:800},axisLine:!1,tickLine:!1}),e.jsx(Re,{formatter:A=>[Je(A),"Count"],cursor:{fill:"rgba(59, 130, 246, 0.06)"}}),e.jsx(Le,{dataKey:"value",radius:[5,5,5,5],children:c.map(A=>e.jsx(it,{fill:A.color},`funnel-${A.name}`))})]})})})]})},{id:"channel-mix",title:"Channel Mix",defaultVisible:!0,render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Channel Mix"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Na,{compact:!0,height:260,title:"",note:"",centerLabel:"",data:l,showLegend:!0,showCenter:!1})})]})},{id:"performance-rate-trend",title:"Performance Rate Trend",defaultVisible:!0,render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Performance Rate Trend"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Ie,{width:"100%",height:260,children:e.jsxs(di,{data:f,margin:{top:12,right:18,bottom:8,left:0},children:[e.jsx(sn,{stroke:"rgba(148, 163, 184, 0.18)"}),e.jsx(Me,{dataKey:"date",tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700}}),e.jsx(Te,{tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700},tickFormatter:A=>`${A}%`}),e.jsx(Re,{formatter:A=>[`${Number(A||0).toFixed(1)}%`,""]}),e.jsx(Pn,{}),e.jsx(qn,{type:"monotone",dataKey:"delivery_rate",name:"Delivery Rate %",stroke:"#22c55e",strokeWidth:2.5,dot:{r:3}}),e.jsx(qn,{type:"monotone",dataKey:"open_rate",name:"Open Rate %",stroke:"#3b82f6",strokeWidth:2.5,dot:{r:3}}),e.jsx(qn,{type:"monotone",dataKey:"click_rate",name:"Click Rate %",stroke:"#f59e0b",strokeWidth:2.5,dot:{r:3}})]})})})]})},{id:"revenue-trend",title:"Revenue Trend",defaultVisible:!0,render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Revenue Trend"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Ie,{width:"100%",height:260,children:e.jsxs(en,{data:u,margin:{top:12,right:18,bottom:8,left:0},children:[e.jsx(sn,{stroke:"rgba(148, 163, 184, 0.18)"}),e.jsx(Me,{dataKey:"date",tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700}}),e.jsx(Te,{tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700},tickFormatter:Gn}),e.jsx(Re,{formatter:A=>[Gn(A),"Revenue"]}),e.jsx(Le,{dataKey:"revenue",fill:"#14b8a6",radius:[5,5,0,0]})]})})})]})},{id:"channel-effectiveness",title:"Channel Effectiveness",render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Channel Effectiveness"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Ie,{width:"100%",height:260,children:e.jsxs(en,{data:g,margin:{top:12,right:18,bottom:8,left:0},children:[e.jsx(sn,{stroke:"rgba(148, 163, 184, 0.18)"}),e.jsx(Me,{dataKey:"channel",tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700}}),e.jsx(Te,{tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700},tickFormatter:A=>`${A}%`}),e.jsx(Re,{formatter:A=>[`${Number(A||0).toFixed(1)}%`,""]}),e.jsx(Pn,{}),e.jsx(Le,{dataKey:"open_rate",name:"Open Rate %",fill:"#3b82f6",radius:[5,5,0,0]}),e.jsx(Le,{dataKey:"click_rate",name:"Click Rate %",fill:"#f59e0b",radius:[5,5,0,0]})]})})})]})},{id:"top-campaigns-comparison",title:"Top Campaigns Comparison",render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Top Campaigns Comparison"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Ie,{width:"100%",height:260,children:e.jsxs(en,{layout:"vertical",data:v,margin:{top:12,right:18,bottom:8,left:132},children:[e.jsx(sn,{stroke:"rgba(148, 163, 184, 0.18)",horizontal:!1}),e.jsx(Me,{type:"number",tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700},tickFormatter:A=>`${A}%`}),e.jsx(Te,{type:"category",dataKey:"campaign",tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700},width:132}),e.jsx(Re,{formatter:A=>[`${Number(A||0).toFixed(1)}%`,""]}),e.jsx(Pn,{}),e.jsx(Le,{dataKey:"open_rate",name:"Open Rate %",fill:"#3b82f6",radius:[5,5,5,5]}),e.jsx(Le,{dataKey:"click_rate",name:"Click Rate %",fill:"#f59e0b",radius:[5,5,5,5]})]})})})]})},{id:"journey-completion-funnel",title:"Journey Completion Funnel",render:()=>e.jsxs("div",{className:"section-card",children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Journey Completion Funnel"})}),e.jsx("div",{className:"section-card-body",children:e.jsx(Ie,{width:"100%",height:260,children:e.jsxs(en,{layout:"vertical",data:j,margin:{top:12,right:24,bottom:8,left:18},children:[e.jsx(sn,{stroke:"rgba(148, 163, 184, 0.18)",horizontal:!1}),e.jsx(Me,{type:"number",domain:[0,_],tickFormatter:Je,tick:{fontSize:11,fill:"var(--text-muted)",fontWeight:700}}),e.jsx(Te,{type:"category",dataKey:"stage",width:92,tick:{fontSize:12,fill:"var(--text-muted)",fontWeight:800}}),e.jsx(Re,{formatter:A=>[Je(A),"Profiles"]}),e.jsx(Le,{dataKey:"value",fill:"#8b5cf6",radius:[5,5,5,5]})]})})})]})}],h=D.filter(A=>A.defaultVisible||A.id===s),k=D.filter(A=>!A.defaultVisible);return d.reduce((A,Y)=>A+Number(Y.count||0),0),e.jsxs("div",{className:"content-card",style:{marginTop:12,marginBottom:16},children:[e.jsxs("div",{className:"content-card-head",children:[e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Campaigns & Journeys Performance"}),e.jsxs("div",{className:"helper-text no-top",children:[String(n.source_system??"source").toUpperCase()," / ",(($=n.date_range)==null?void 0:$.label)??"Current window"]})]}),e.jsxs("span",{className:"badge subtle",children:[r.total_campaigns??p.length," campaigns"]})]}),e.jsxs("div",{className:"content-card-body",children:[e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:14},children:[E.map(A=>e.jsx(pn,{label:A.label,value:A.value,sub:A.sub,color:A.color,icon:A.icon},A.label)),!1]}),e.jsxs("div",{className:"report-chart-toolbar",style:{marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",padding:"12px 14px",border:"1px solid var(--border)",borderRadius:"12px",background:"var(--bg-card)"},children:[e.jsxs("div",{children:[e.jsx("strong",{children:"Reporting Charts"}),e.jsx("br",{}),e.jsx("span",{children:"Default view shows the primary 4 charts. Choose another chart to add below."})]}),e.jsxs("select",{value:s,onChange:A=>a(A.target.value),style:{minWidth:"230px",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"8px",background:"var(--bg-secondary)",color:"var(--text-primary)",font:"inherit",fontSize:"12px",fontWeight:"700"},children:[e.jsx("option",{value:"",children:"Select additional chart"}),k.map(A=>e.jsx("option",{value:A.id,children:A.title},A.id))]})]}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))",gap:14,marginTop:14},children:h.map(A=>e.jsx("div",{children:A.render()},A.id))}),!1,e.jsxs("div",{className:"section-card",style:{marginTop:14},children:[e.jsx("div",{className:"section-card-head",children:e.jsx("div",{style:{fontSize:"20px",fontWeight:"700",color:"var(--text-primary)",marginBottom:"5px"},children:"Top Campaigns"})}),e.jsx("div",{className:"section-card-body",style:{gap:8},children:p.map(A=>e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"minmax(160px, 1fr) 90px 90px 110px",gap:10,alignItems:"center",fontSize:16,fontWeight:"500"},children:[e.jsx("strong",{children:A.campaign}),e.jsxs("span",{children:[A.open_rate,"% open"]}),e.jsxs("span",{children:[A.click_rate,"% click"]}),e.jsx("span",{style:{textAlign:"right"},children:Gn(A.revenue)})]},A.campaign_id))})]})]})]})}function Or({journeys:n=[],apiReport:t=null}){const s=Array.isArray(n)?n:[],[a,r]=m.useState(1),i=5;if(t!=null&&t.summary)return e.jsx(Lr,{report:t,journeys:s});const d=h=>{var k,$;return(h==null?void 0:h.name)||((k=h==null?void 0:h.journeyTable)==null?void 0:k.journeyName)||(($=h==null?void 0:h.journeyOverrides)==null?void 0:$.name)||"Untitled Journey"},p=(h,k)=>(h==null?void 0:h.slug)||(h==null?void 0:h.useCaseId)||(h==null?void 0:h.id)||`journey-${k+1}`,o=h=>{var k,$;return((k=h==null?void 0:h.category)==null?void 0:k.categoryName)||(h==null?void 0:h.categoryName)||(($=h==null?void 0:h.journeyTable)==null?void 0:$.journeyCategory)||(h==null?void 0:h.subCategoryName)||"Uncategorized"},c=h=>{const k=String((h==null?void 0:h.status)||(h==null?void 0:h.runStatus)||"").trim().toUpperCase();return(h==null?void 0:h.active)===!0||(h==null?void 0:h.isActive)===!0?"Active":(h==null?void 0:h.active)===!1||(h==null?void 0:h.isActive)===!1?"Inactive":k==="READY"?"Ready":k==="ACTIVE"?"Active":k==="PAUSED"||k==="INACTIVE"?"Inactive":k==="DRAFT"?"Draft":"Ready"},l=h=>{const k=String(h||"").toLowerCase();return k==="active"||k==="ready"?"pass":k==="inactive"||k==="paused"?"warn":k==="draft"?"neutral":"pass"},f=h=>h?Array.isArray(h)?h:[h]:[],u=h=>{const k=String(h||"Unknown").trim();if(!k)return"Unknown";const $=k.toUpperCase();return $==="EMAIL"?"Email":$==="SMS"?"SMS":$==="PUSH"?"Push":$==="IN_APP"||$==="INAPP"?"In-App":$==="CALL"?"Call":$==="WHATSAPP"?"WhatsApp":k},g=h=>Array.isArray(h==null?void 0:h.touchpoints)?h.touchpoints:[],v=h=>{var k;return Array.isArray((k=h==null?void 0:h.tracking)==null?void 0:k.trackingEvents)?h.tracking.trackingEvents.length:0},j=h=>g(h).some($=>{var A,Y;return((A=$==null?void 0:$.tracking)==null?void 0:A.campaignId)||((Y=$==null?void 0:$.tracking)==null?void 0:Y.deliveryId)||v($)>0}),_=h=>Array.isArray(h==null?void 0:h.exitConditions)&&h.exitConditions.length>0,I=h=>{var k;return!!((k=h==null?void 0:h.analytics)!=null&&k.primaryKPI)},x=h=>{var k;return!!((k=h==null?void 0:h.entryCriteria)!=null&&k.audienceName)},S=h=>!!(h!=null&&h.ajoConfig),T=h=>{const k=[g(h).length>0,j(h),_(h),I(h),x(h),S(h)],$=k.filter(Boolean).length;return Math.round($/k.length*100)},C=m.useMemo(()=>{const h=s.length,k=s.flatMap((N,F)=>g(N).map(q=>({journey:N,journeyIndex:F,tp:q}))),$=new Map;k.forEach(({journey:N,journeyIndex:F,tp:q})=>{var xe,we,Be,te;const oe=((xe=q==null?void 0:q.tracking)==null?void 0:xe.campaignId)||((we=q==null?void 0:q.tracking)==null?void 0:we.deliveryId)||null;if(!oe)return;const ge=f(q.channel).map(u);$.has(oe)||$.set(oe,{campaignId:oe,campaign:oe,journey:d(N),journeyId:p(N,F),category:o(N),channels:new Set,trackingEvents:new Set,primaryKPI:((Be=N==null?void 0:N.analytics)==null?void 0:Be.primaryKPI)||"-",status:c(N)});const K=$.get(oe);ge.forEach(ce=>K.channels.add(ce)),(((te=q==null?void 0:q.tracking)==null?void 0:te.trackingEvents)||[]).forEach(ce=>K.trackingEvents.add(ce))});const A=[...$.values()].map(N=>({...N,channelText:[...N.channels].join(", ")||"-",trackingEventCount:N.trackingEvents.size})),Y={};k.forEach(({tp:N})=>{f(N.channel).forEach(F=>{const q=u(F);Y[q]=(Y[q]||0)+1})});const ae=["#2f84dc","#22a979","#7c73dd","#66a329","#f59e0b","#14b8a6","#ef4444"],b=Object.entries(Y).sort((N,F)=>F[1]-N[1]),L=7,y=b.slice(0,L).map(([N,F],q)=>({label:N,value:F,color:ae[q%ae.length]})),Z=b.slice(L).reduce((N,[,F])=>N+F,0);Z>0&&y.push({label:"Other",value:Z,color:"#94a3b8"});const de=y,Q=s.filter(N=>{const F=c(N).toLowerCase();return F==="active"||F==="ready"}).length,se=Math.max(0,h-Q),ie=s.flatMap((N,F)=>{var q;return(((q=N==null?void 0:N.ajoConfig)==null?void 0:q.suppressionRules)||[]).map(oe=>({journey:d(N),journeyId:p(N,F),ruleId:(oe==null?void 0:oe.ruleId)||"rule",condition:(oe==null?void 0:oe.condition)||"-"}))}),V={};s.forEach(N=>{const F=o(N);V[F]=(V[F]||0)+1});const le=Object.entries(V).map(([N,F])=>({name:N.length>26?`${N.slice(0,26)}...`:N,value:F})).sort((N,F)=>F.value-N.value).slice(0,8),je=[{name:"Journeys",value:h},{name:"With touchpoints",value:s.filter(N=>g(N).length>0).length},{name:"With tracking",value:s.filter(j).length},{name:"With exit rules",value:s.filter(_).length},{name:"With KPI",value:s.filter(I).length}],ve=s.map((N,F)=>{var K;const q=T(N),oe=g(N),ge=[...new Set(oe.flatMap(xe=>f(xe.channel).map(u)))];return{id:p(N,F),name:d(N),category:o(N),score:q,status:c(N),touchpoints:oe.length,channels:ge.join(", ")||"-",primaryKPI:((K=N==null?void 0:N.analytics)==null?void 0:K.primaryKPI)||"-"}}).sort((N,F)=>F.score-N.score).slice(0,8),H={};s.forEach(N=>{var q,oe;const F=((q=N==null?void 0:N.journey)==null?void 0:q.type)||((oe=N==null?void 0:N.journeyTable)==null?void 0:oe.journeyCategory)||"Blueprint";H[F]=(H[F]||0)+1});const P=Object.entries(H).map(([N,F],q)=>({label:N,value:F,color:["#2f84dc","#22a979","#7c73dd","#f59e0b"][q%4]}));return{totalJourneys:h,totalCampaigns:A.length,totalTouchpoints:k.length,activeJourneys:Q,inactiveJourneys:se,totalChannels:Object.keys(Y).length,suppressionRules:ie,campaignRows:A,channelMix:de,categoryData:le,funnelData:je,journeyPerformance:ve,journeyTypeData:P}},[s]),B=C.totalJourneys?Math.round(C.activeJourneys/C.totalJourneys*100):0,E=C.totalJourneys?(C.totalTouchpoints/C.totalJourneys).toFixed(1):0,D=[{label:"Total Journeys",value:C.totalJourneys,sub:`${C.activeJourneys} active · ${C.inactiveJourneys} inactive`,color:"#2f84dc",icon:"🧭"},{label:"Touchpoints",value:C.totalTouchpoints,sub:`avg ${E} per journey`,color:"#7c73dd",icon:"📨"},{label:"Ready / Active",value:C.activeJourneys,sub:`${B}% of all journeys`,color:"#10b981",icon:"✅"},{label:"Channels",value:C.totalChannels,sub:`across ${C.totalTouchpoints} touchpoints`,color:"#f59e0b",icon:"📡"},{label:"Suppression Rules",value:C.suppressionRules.length,sub:C.suppressionRules.length>0?`in ${new Set(C.suppressionRules.map(h=>h.journeyId)).size} journeys`:"no rules configured",color:"#ef4444",icon:"🚫"}];return e.jsxs("div",{className:"cj-report-wrap",children:[e.jsx("style",{children:`
        .cj-report-wrap {
          display: grid;
          gap: 16px;
        }

        .cj-report-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .cj-report-title {
          font-size: 22px;
          font-weight: 850;
          color: var(--text-primary);
          margin: 0;
        }

        .cj-report-subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .cj-report-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cj-filter-pill {
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
        }

        .cj-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
        }

        .cj-kpi-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          min-height: 104px;
          position: relative;
          overflow: hidden;
        }

        .cj-kpi-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--kpi-color-soft), transparent 58%);
          pointer-events: none;
        }

        .cj-kpi-label {
          position: relative;
          z-index: 1;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .cj-kpi-value {
          position: relative;
          z-index: 1;
          font-size: 28px;
          font-weight: 850;
          color: var(--text-primary);
          margin-top: 8px;
          line-height: 1;
        }

        .cj-kpi-sub {
          position: relative;
          z-index: 1;
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .cj-grid-2 {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.8fr);
          gap: 16px;
        }

        .cj-grid-equal {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 16px;
        }

        .cj-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        .cj-card-head {
          padding: 18px 22px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .cj-card-title {
          font-size: 16px;
          font-weight: 850;
          color: var(--text-primary);
        }

        .cj-card-note {
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .cj-card-body {
          padding: 16px 22px 20px;
        }

        .cj-table-wrap {
          overflow-x: auto;
        }

        .cj-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: 860px;
        }

        .cj-table th {
          text-align: left;
          padding: 12px 10px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border);
        }

        .cj-table td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
          vertical-align: middle;
        }

        .cj-table tr:last-child td {
          border-bottom: 0;
        }

        .cj-table strong {
          color: var(--text-primary);
        }

        .cj-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cj-status-pass {
          color: #2f6e1f;
          background: #dff2d7;
        }

        .cj-status-warn {
          color: #7a560b;
          background: #f8edcf;
        }

        .cj-status-neutral {
          color: #4b5563;
          background: #e5e7eb;
        }

        .cj-journey-list {
          display: grid;
          gap: 16px;
        }

        .cj-journey-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
        }

        .cj-journey-title {
          font-size: 14px;
          font-weight: 750;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .cj-journey-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .cj-progress-track {
          height: 6px;
          border-radius: 999px;
          background: var(--bg-secondary);
          overflow: hidden;
        }

        .cj-progress-fill {
          height: 100%;
          background: #2f84dc;
          border-radius: 999px;
        }

        .cj-score {
          text-align: right;
          font-size: 12px;
          color: var(--text-muted);
        }

        .cj-score strong {
          display: block;
          color: var(--text-primary);
          font-size: 13px;
        }

        .cj-suppression-list {
          display: grid;
          gap: 12px;
        }

        .cj-suppression-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-secondary);
        }

        .cj-rule-id {
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
          font-size: 11px;
          font-weight: 800;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.12);
          padding: 4px 7px;
          border-radius: 7px;
        }

        .cj-empty {
          padding: 18px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
          border: 1px dashed var(--border);
          border-radius: 12px;
          background: var(--bg-secondary);
        }

        .content-pie-card {
          padding: 0;
          overflow: hidden;
        }

        .content-pie-card .c-pie-card {
          height: 100%;
          border: 0;
          border-radius: inherit;
          background: transparent;
          box-shadow: none;
        }

        .content-pie-card .c-pie-chart-area {
          min-height: 260px;
        }

        @media (max-width: 980px) {
          .cj-grid-2 {
            grid-template-columns: 1fr;
          }
        }
      `}),e.jsxs("div",{className:"cj-report-header",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"cj-report-title",children:"Campaign & journey reporting"}),e.jsxs("div",{className:"cj-report-subtitle",children:["Blueprint metadata · All channels · ",C.totalJourneys," journeys ·"," ",C.totalCampaigns," campaigns"]})]}),e.jsxs("div",{className:"cj-report-actions",children:[e.jsx("div",{className:"cj-filter-pill",children:"Blueprint API data only"}),e.jsx("div",{className:"cj-filter-pill",children:"No synthetic metrics"})]})]}),e.jsx("div",{className:"cj-kpi-grid",children:D.map(h=>e.jsxs("div",{className:"cj-kpi-card",style:{"--kpi-color-soft":`${h.color}18`},children:[e.jsx("div",{className:"cj-kpi-label",children:h.label}),e.jsx("div",{className:"cj-kpi-value",children:h.value}),e.jsxs("div",{className:"cj-kpi-sub",children:[h.icon," ",h.sub]})]},h.label))}),e.jsxs("div",{className:"cj-grid-2",children:[e.jsxs("div",{className:"cj-card",children:[e.jsx("div",{className:"cj-card-head",children:e.jsxs("div",{children:[e.jsx("div",{className:"cj-card-title",children:"Journey setup funnel"}),e.jsx("div",{className:"cj-card-note",children:"Derived from journey blueprint fields: touchpoints, tracking, exits, and KPI."})]})}),e.jsx("div",{className:"cj-card-body",children:e.jsx(Ie,{width:"100%",height:300,children:e.jsxs(en,{layout:"vertical",data:C.funnelData,margin:{top:12,right:28,bottom:8,left:28},children:[e.jsx(Me,{type:"number",allowDecimals:!1}),e.jsx(Te,{type:"category",dataKey:"name",width:120,tick:{fontSize:12,fill:"var(--text-secondary)"}}),e.jsx(Re,{}),e.jsx(Le,{dataKey:"value",fill:"#2f84dc",radius:[4,4,4,4]})]})})})]}),e.jsxs("div",{className:"cj-card",children:[e.jsx("div",{className:"cj-card-head",children:e.jsxs("div",{children:[e.jsx("div",{className:"cj-card-title",children:"Channel mix"}),e.jsx("div",{className:"cj-card-note",children:"Channel distribution across journey touchpoints."})]})}),e.jsxs("div",{className:"cj-card-body",style:{display:"flex",gap:16,alignItems:"center",minHeight:260},children:[e.jsx("div",{style:{flex:"0 0 180px"},children:e.jsx(Ie,{width:180,height:180,children:e.jsxs(ua,{children:[e.jsx(pa,{data:C.channelMix.map(h=>({...h,name:h.label})),dataKey:"value",cx:"50%",cy:"50%",innerRadius:42,outerRadius:72,paddingAngle:2,isAnimationActive:!1,label:!1,labelLine:!1,children:C.channelMix.map((h,k)=>e.jsx(it,{fill:h.color,stroke:"var(--bg-card)",strokeWidth:2},h.label))}),e.jsx(Re,{formatter:(h,k)=>[h,k]})]})})}),e.jsx("div",{style:{flex:1,overflowY:"auto",maxHeight:260,display:"grid",gap:6},children:C.channelMix.map(h=>{const k=C.channelMix.reduce((A,Y)=>A+Y.value,0)||1,$=Math.round(h.value/k*100);return e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"10px 1fr 36px 36px",gap:8,alignItems:"center"},children:[e.jsx("span",{style:{width:10,height:10,borderRadius:"50%",background:h.color,flexShrink:0}}),e.jsx("span",{style:{fontSize:12,fontWeight:700,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:h.label}),e.jsx("span",{style:{fontSize:11,color:"var(--text-muted)",textAlign:"right"},children:h.value}),e.jsxs("span",{style:{fontSize:11,color:"var(--text-muted)",textAlign:"right"},children:[$,"%"]})]},h.label)})})]})]})]}),e.jsxs("div",{className:"cj-grid-equal",children:[e.jsx("div",{className:"cj-card content-pie-card",children:e.jsx(Na,{compact:!1,height:300,title:"Journey type split",note:"Journey type distribution based on blueprint metadata.",centerLabel:"",showCenter:!1,data:C.journeyTypeData})}),e.jsxs("div",{className:"cj-card",children:[e.jsx("div",{className:"cj-card-head",children:e.jsxs("div",{children:[e.jsx("div",{className:"cj-card-title",children:"Top journey categories"}),e.jsx("div",{className:"cj-card-note",children:"Journey counts grouped by category."})]})}),e.jsx("div",{className:"cj-card-body",children:e.jsx(Ie,{width:"100%",height:280,children:e.jsxs(en,{data:C.categoryData,margin:{top:16,right:28,bottom:8,left:0},barCategoryGap:18,children:[e.jsx(Me,{dataKey:"name",tick:{fontSize:11,fill:"var(--text-secondary)"},axisLine:!1,tickLine:!1}),e.jsx(Te,{allowDecimals:!1,tick:{fontSize:11,fill:"var(--text-muted)"},axisLine:!1,tickLine:!1}),e.jsx(Re,{}),e.jsx(Le,{dataKey:"value",fill:"#22a979",radius:[6,6,0,0]})]})})})]})]}),e.jsxs("div",{className:"cj-card",children:[e.jsxs("div",{className:"cj-card-head",children:[e.jsxs("div",{children:[e.jsx("div",{className:"cj-card-title",children:"Campaign metadata"}),e.jsx("div",{className:"cj-card-note",children:"Campaign rows are derived from touchpoint tracking campaign IDs."})]}),e.jsxs("div",{style:{fontSize:12,color:"var(--text-muted)",alignSelf:"center"},children:[C.campaignRows.length," total"]})]}),e.jsx("div",{className:"cj-table-wrap",children:e.jsxs("table",{className:"cj-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Campaign"}),e.jsx("th",{children:"Journey"}),e.jsx("th",{children:"Channel"}),e.jsx("th",{children:"Tracking events"}),e.jsx("th",{children:"Primary KPI"}),e.jsx("th",{children:"Status"})]})}),e.jsx("tbody",{children:C.campaignRows.length>0?C.campaignRows.slice((a-1)*i,a*i).map(h=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("strong",{children:h.campaign})}),e.jsx("td",{children:h.journey}),e.jsx("td",{children:h.channelText}),e.jsx("td",{children:h.trackingEventCount}),e.jsx("td",{children:h.primaryKPI}),e.jsx("td",{children:e.jsx("span",{className:`cj-status cj-status-${l(h.status)}`,children:h.status})})]},h.campaignId)):e.jsx("tr",{children:e.jsx("td",{colSpan:6,children:e.jsx("div",{className:"cj-empty",children:"No campaign IDs found in touchpoint tracking metadata."})})})})]})}),C.campaignRows.length>i&&(()=>{const h=Math.ceil(C.campaignRows.length/i);return e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 22px",borderTop:"1px solid var(--border)"},children:[e.jsxs("span",{style:{fontSize:12,color:"var(--text-muted)"},children:["Page ",a," of ",h," · ",C.campaignRows.length," records"]}),e.jsxs("div",{style:{display:"flex",gap:6},children:[e.jsx("button",{onClick:()=>r(k=>Math.max(1,k-1)),disabled:a===1,style:{padding:"5px 12px",borderRadius:7,border:"1px solid var(--border)",background:"var(--bg-card)",color:"var(--text-secondary)",fontSize:12,fontWeight:600,cursor:a===1?"default":"pointer",opacity:a===1?.4:1},children:"← Prev"}),Array.from({length:Math.min(5,h)},(k,$)=>{let A=$+1;return h>5&&a>3&&(A=a-2+$),A>h?null:e.jsx("button",{onClick:()=>r(A),style:{padding:"5px 10px",borderRadius:7,border:"1px solid var(--border)",background:A===a?"var(--accent, #2563eb)":"var(--bg-card)",color:A===a?"#fff":"var(--text-secondary)",fontSize:12,fontWeight:700,cursor:"pointer",minWidth:32},children:A},A)}),e.jsx("button",{onClick:()=>r(k=>Math.min(h,k+1)),disabled:a===h,style:{padding:"5px 12px",borderRadius:7,border:"1px solid var(--border)",background:"var(--bg-card)",color:"var(--text-secondary)",fontSize:12,fontWeight:600,cursor:a===h?"default":"pointer",opacity:a===h?.4:1},children:"Next →"})]})]})})()]}),e.jsxs("div",{className:"cj-grid-2",children:[e.jsxs("div",{className:"cj-card",children:[e.jsx("div",{className:"cj-card-head",children:e.jsxs("div",{children:[e.jsx("div",{className:"cj-card-title",children:"Journey configuration score"}),e.jsx("div",{className:"cj-card-note",children:"Score is calculated from available blueprint metadata completeness."})]})}),e.jsx("div",{className:"cj-card-body",children:e.jsxs("div",{className:"cj-journey-list",children:[C.journeyPerformance.map(h=>e.jsxs("div",{className:"cj-journey-item",children:[e.jsxs("div",{children:[e.jsx("div",{className:"cj-journey-title",children:h.name}),e.jsxs("div",{className:"cj-journey-meta",children:[h.touchpoints," touchpoints · ",h.channels," · KPI:"," ",h.primaryKPI]}),e.jsx("div",{className:"cj-progress-track",children:e.jsx("div",{className:"cj-progress-fill",style:{width:`${h.score}%`}})})]}),e.jsxs("div",{className:"cj-score",children:[e.jsx("span",{className:`cj-status cj-status-${l(h.status)}`,children:h.status}),e.jsxs("strong",{children:[h.score,"%"]})]})]},h.id)),C.journeyPerformance.length===0?e.jsx("div",{className:"cj-empty",children:"No journey metadata available."}):null]})})]}),e.jsxs("div",{className:"cj-card",children:[e.jsx("div",{className:"cj-card-head",children:e.jsxs("div",{children:[e.jsx("div",{className:"cj-card-title",children:"Suppression rules"}),e.jsx("div",{className:"cj-card-note",children:"Rules derived from AJO configuration in the journey payload."})]})}),e.jsx("div",{className:"cj-card-body",children:e.jsxs("div",{className:"cj-suppression-list",children:[C.suppressionRules.length>0?C.suppressionRules.slice(0,6).map((h,k)=>e.jsxs("div",{className:"cj-suppression-item",children:[e.jsx("div",{className:"cj-rule-id",children:h.ruleId}),e.jsxs("div",{children:[e.jsx("div",{className:"cj-journey-title",children:h.journey}),e.jsx("div",{className:"cj-journey-meta",children:h.condition})]})]},`${h.journeyId}-${h.ruleId}-${k}`)):e.jsx("div",{className:"cj-empty",children:"No suppression rules configured in selected journeys."}),C.suppressionRules.length>6&&e.jsxs("div",{style:{textAlign:"center",fontSize:12,color:"var(--text-muted)",paddingTop:4},children:["Showing 6 of ",C.suppressionRules.length," rules"]})]})})]})]})]})}function Br({data:n,form:t,busy:s,progress:a,generateLabel:r="Generate Flowchart",selectedNode:i,selectedEdge:d,selectedDetail:p,activatedSegments:o,filteredJourneyOptions:c,onSelectNode:l,onSelectEdge:f,onClearSelection:u,onFormChange:g,onJourneyCategoryChange:v,onJourneyTypeChange:j,onGenerate:_,onSendConfig:I,onOpenQa:x,isDirty:S,saveName:T,saveBusy:C,onSaveNameChange:B,onSaveJourney:E,onAddNode:D,onAddEdge:h,onDeleteSelection:k,onNodeFieldChange:$,onNodeLineChange:A,onDetailChange:Y,onDetailRowChange:ae,onAddDetailRow:b,onRemoveDetailRow:L,onNodeMove:y,onEdgeFieldChange:Z,onBackToCampaignManager:de=null}){const[Q,se]=m.useState("campaigns"),[ie,V]=m.useState(ka()),[le,je]=m.useState("all"),ve=m.useMemo(()=>{const H=n.availableJourneys||[];let P=ie==="all"?H:H.filter(N=>N.categoryId===ie);return le!=="all"&&(ie==="all"?P=P.filter(N=>`${N.categoryId}::${N.subCategoryId??"general"}`===le):P=P.filter(N=>N.subCategoryId===le)),P},[n.availableJourneys,ie,le]);return t.journeyType?e.jsxs("section",{className:"module-layout blueprint-layout",children:[e.jsxs("aside",{className:"panel side-panel narrow editor-panel",children:[e.jsxs("div",{className:"panel-head",children:[e.jsx("div",{className:"panel-title",style:{color:"#E5C97A"},children:"Journey Editor"}),e.jsx("div",{className:"panel-subtitle",children:"Edit the selected journey, update its flowchart, and save a new version back into the journey catalogue."})]}),e.jsxs("div",{className:"panel-body",children:[e.jsx("button",{type:"button",className:"button secondary full journey-back-button",onClick:()=>de?de():v(""),children:de?"Back to Campaign Manager":"Back to Campaigns & Journeys"}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Journey category"}),e.jsxs("select",{className:"field-input",value:t.journeyCategory,disabled:!0,onChange:H=>v(H.target.value),children:[e.jsx("option",{value:"",children:"Select journey category"}),n.availableJourneyCategories.map(H=>e.jsx("option",{value:H.id,children:H.name},H.id))]})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Journey type"}),e.jsxs("select",{className:"field-input",value:t.journeyType,disabled:!0,onChange:H=>j(H.target.value),children:[e.jsx("option",{value:"",children:"Select journey type"}),c.map(H=>e.jsx("option",{value:H.slug,children:H.name},H.slug))]})]}),e.jsxs("div",{className:"helper-text",children:["Journey selection is locked in the editor. Use ",e.jsx("strong",{children:"Back to Campaigns & Journeys"})," to open a different journey."]}),e.jsxs("div",{className:"group-box",children:[e.jsx("div",{className:"field-label",children:"Campaign flow"}),e.jsx("span",{style:{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,marginBottom:8,fontSize:11,fontWeight:700,letterSpacing:"0.04em",background:t.orchestrationType==="single-touchpoint"?"rgba(100,180,255,0.12)":"rgba(100,220,160,0.12)",color:t.orchestrationType==="single-touchpoint"?"#64B4FF":"#64DCA0",border:`1px solid ${t.orchestrationType==="single-touchpoint"?"rgba(100,180,255,0.3)":"rgba(100,220,160,0.3)"}`},children:t.orchestrationType==="single-touchpoint"?"Single touchpoint":"Multi-touch journey"}),t.orchestrationType==="single-touchpoint"?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"two-col",children:[e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Single channel"}),e.jsxs("select",{className:"field-input",value:t.singleChannel??"email",onChange:H=>g("singleChannel",H.target.value),children:[e.jsx("option",{value:"email",children:"Email"}),e.jsx("option",{value:"push",children:"Push"}),e.jsx("option",{value:"sms",children:"SMS"}),e.jsx("option",{value:"inApp",children:"In-App"})]})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Trigger type"}),e.jsxs("select",{className:"field-input",value:t.singleTriggerType??"event",onChange:H=>g("singleTriggerType",H.target.value),children:[e.jsx("option",{value:"event",children:"Event trigger"}),e.jsx("option",{value:"scheduled",children:"Scheduled trigger"})]})]})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:t.singleTriggerType==="scheduled"?"Schedule key":"Trigger event"}),e.jsx("input",{className:"field-input",value:t.singleTriggerEvent??"",onChange:H=>g("singleTriggerEvent",H.target.value)})]}),e.jsxs("div",{className:"two-col",children:[e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Send offset (hours)"}),e.jsx("input",{className:"field-input",type:"number",min:0,max:168,value:t.singleSendOffsetHours??0,onChange:H=>g("singleSendOffsetHours",Number(H.target.value))})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Outcome window (hours)"}),e.jsx("input",{className:"field-input",type:"number",min:1,max:168,value:t.singleOutcomeWindowHours??24,onChange:H=>g("singleOutcomeWindowHours",Number(H.target.value))})]})]}),e.jsxs("div",{className:"toggle-row no-gap-bottom",children:[e.jsxs("button",{type:"button",className:`channel-chip ${t.singleUseHoldout?"on":"off"}`,onClick:()=>g("singleUseHoldout",!t.singleUseHoldout),children:["Holdout ",t.singleUseHoldout?"On":"Off"]}),e.jsxs("button",{type:"button",className:`channel-chip ${t.singleUseAB?"on":"off"}`,onClick:()=>g("singleUseAB",!t.singleUseAB),children:["A/B Split ",t.singleUseAB?"On":"Off"]})]}),e.jsx("div",{className:"helper-text no-top",children:"Regenerate flowchart after changing these controls to rebuild the campaign path."})]}):e.jsx("div",{className:"helper-text no-top",children:"Multi-touch mode keeps holdout, experiment, and wait nodes across a full journey path."})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Prompt"}),e.jsx("textarea",{className:"field-input multiline",value:t.brief,placeholder:"Describe journey updates in plain language (for example: set wait period to 4 days, holdout to 15%, and split to 60/40).",onChange:H=>g("brief",H.target.value)})]}),e.jsxs("div",{className:"two-col",children:[e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Platform"}),e.jsxs("select",{className:"field-input",value:t.platform,onChange:H=>g("platform",H.target.value),children:[e.jsx("option",{children:"Adobe AJO"}),e.jsx("option",{children:"Braze"}),e.jsx("option",{children:"SFMC"})]})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Target date"}),e.jsx("input",{className:"field-input",type:"date",value:t.targetDate,onChange:H=>g("targetDate",H.target.value)})]})]}),o!=null&&o.length?e.jsxs("div",{className:"info-box info-blue segment-selection-box",children:[e.jsx("div",{className:"section-label",children:"Selected Segments"}),e.jsx("div",{className:"segment-rule-list",children:o.map(H=>e.jsxs("div",{className:"segment-rule-chip",children:[H.name," / ",H.status]},H.id))})]}):null,e.jsxs("div",{className:"toolbar-stack",children:[e.jsxs("button",{type:"button",className:"button gold full",onClick:_,disabled:s||!t.journeyCategory||!t.journeyType,children:[s?e.jsx("span",{className:"spinner"}):null,s?"Generating...":r]}),e.jsxs("div",{className:"two-col",children:[e.jsx("button",{type:"button",className:"button secondary full",onClick:D,children:"Add Node"}),e.jsx("button",{type:"button",className:"button secondary full",onClick:h,children:"Add Arrow"})]}),i||d?e.jsx("button",{type:"button",className:"button secondary full",onClick:k,children:"Remove Selected"}):null]}),s?e.jsxs("div",{className:"progress-stack",children:[e.jsx("div",{className:"progress-track",children:e.jsx("span",{className:"progress-fill gold",style:{width:`${a.percent}%`}})}),e.jsx("div",{className:"progress-label",children:a.message})]}):null,S?e.jsxs("div",{className:"save-card",children:[e.jsx("div",{className:"section-label",children:"Unsaved journey changes"}),e.jsx("div",{className:"helper-text",children:"Save this edited brief and flowchart as a new JSON-backed journey so it appears in the selector next time."}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"New journey name"}),e.jsx("input",{className:"field-input",placeholder:"Example: Priority Access Last-Chance Push",value:T,onChange:H=>B(H.target.value)})]}),e.jsxs("button",{type:"button",className:"button primary full",onClick:E,disabled:C,children:[C?e.jsx("span",{className:"spinner"}):null,C?"Saving...":"Save as New Journey"]})]}):null,n.generated?e.jsxs("div",{className:"stats-card",children:[e.jsx("div",{className:"section-label",children:"Generated elements"}),n.stats.map(H=>e.jsxs("div",{className:"stat-row",children:[e.jsx("span",{children:H.label}),e.jsx("strong",{style:{color:H.color},children:H.value})]},H.label)),e.jsxs("div",{className:"stack-actions",children:[e.jsx("button",{type:"button",className:"button primary full",onClick:I,children:"Send to Journey Config"}),e.jsx("button",{type:"button",className:"button teal full",onClick:x,children:"Open QA & Automation"}),e.jsx("button",{type:"button",className:"button secondary full",onClick:u,children:"Clear Selection"})]})]}):null]})]}),e.jsx("div",{className:"panel canvas-panel",children:e.jsx(Dr,{generated:n.generated,busy:s,progress:a,nodes:n.nodes,edges:n.edges,lanes:n.lanes,phaseHeaders:n.phaseHeaders,selectedNodeId:(i==null?void 0:i.id)??null,selectedEdgeId:(d==null?void 0:d.id)??null,onSelectNode:l,onSelectEdge:f,onClearSelection:u,onNodeMove:y})}),e.jsxs("aside",{className:"panel side-panel narrow inspector-panel",style:{maxHeight:"100vh"},children:[e.jsxs("div",{className:"panel-head",children:[e.jsx("div",{className:"panel-title",children:d?"Arrow Inspector":"Node Inspector"}),e.jsx("div",{className:"panel-subtitle",children:"Edit labels, routing, shape, color, and layout for the selected canvas object."})]}),d?e.jsx(Mr,{edge:d,nodes:n.nodes,onDeleteSelection:k,onEdgeFieldChange:Z}):e.jsx(zr,{node:i,detail:p,lanes:n.lanes,onDeleteSelection:k,onNodeFieldChange:$,onNodeLineChange:A,onDetailChange:Y,onDetailRowChange:ae,onAddDetailRow:b,onRemoveDetailRow:L})]})]}):e.jsxs("div",{children:[e.jsxs("div",{style:{display:"flex",gap:12,marginBottom:12,alignItems:"center"},children:[e.jsx("button",{type:"button",onClick:()=>se("campaigns"),style:{color:Q==="campaigns"?"#ffffff":"var(--text-secondary)",WebkitTextFillColor:Q==="campaigns"?"#ffffff":"var(--text-secondary)",background:Q==="campaigns"?"var(--accent-light)":"var(--bg-card)",display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",border:Q==="campaigns"?"none":"1px solid var(--border)",borderRadius:"var(--radius-sm)",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s",fontFamily:"var(--font)",boxShadow:Q==="campaigns"?"0 6px 16px rgba(37, 99, 235, 0.25)":"none"},children:"Campaigns & Journeys"}),e.jsx("button",{type:"button",onClick:()=>se("report"),style:{color:Q==="report"?"#ffffff":"var(--text-secondary)",WebkitTextFillColor:Q==="report"?"#ffffff":"var(--text-secondary)",background:Q==="report"?"var(--accent-light)":"var(--bg-card)",display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",border:Q==="report"?"none":"1px solid var(--border)",borderRadius:"var(--radius-sm)",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s",fontFamily:"var(--font)",boxShadow:Q==="report"?"0 6px 16px rgba(37, 99, 235, 0.25)":"none"},children:"Reporting"})]}),e.jsx("div",{className:"workspace-panel",children:Q==="campaigns"?e.jsx(Tr,{categories:n.availableJourneyCategories,subcategories:n.availableJourneySubcategories??[],journeys:ve,report:n.campaignsJourneysReport,categoryFilter:ie,subCategoryFilter:le,onCategoryChange:V,onSelectJourney:j,onSubCategoryChange:je}):e.jsx(Or,{journeys:ve,apiReport:n.campaignsJourneysReport})})]})}const Lt={status:"idle",visited:new Set,active:null,logs:[],progress:0};function Fr({initialJourneyId:n=null,autoSynth:t=!1}){var we,Be;const[s,a]=m.useState([]),[r,i]=m.useState(null),[d,p]=m.useState(n),[o,c]=m.useState([]),[l]=m.useState(null),[f,u]=m.useState(new Set),[g,v]=m.useState(Lt),[j,_]=m.useState(null),[I,x]=m.useState([]),[S,T]=m.useState(null),[C,B]=m.useState(!1),[E,D]=m.useState([]),[h,k]=m.useState(null),[$,A]=m.useState([]),[Y,ae]=m.useState(null),[b,L]=m.useState(!1),[y,Z]=m.useState(null),[de,Q]=m.useState("profiles"),[se,ie]=m.useState(null),[V,le]=m.useState([]),[je,ve]=m.useState(null),H=m.useRef(!1);m.useEffect(()=>{let te=!1;return(async()=>{var ce,G;try{const ue=await De.listJourneys();if(te)return;const fe=n??((ce=ue[0])==null?void 0:ce.id)??"season-ticket-renewal-journey",[w,z]=await Promise.all([De.getJourney(fe),De.listSegments(fe)]);if(te)return;a(ue),i(w),p(w.id),x(z),T(((G=z[0])==null?void 0:G.id)??null)}catch(ue){if(te)return;_(ue instanceof Error?ue.message:String(ue))}})(),()=>{te=!0}},[]),m.useEffect(()=>{if(!d||!r||d===r.id)return;let te=!1;return(async()=>{try{const[ce,G]=await Promise.all([De.getJourney(d),De.listSegments(d)]);if(te)return;i(ce),x(G),T(ue=>{var fe;return ue&&G.some(w=>w.id===ue)?ue:((fe=G[0])==null?void 0:fe.id)??null}),A([]),ae(null),D([]),k(null),c([]),u(new Set),v(Lt),le([]),ve(null),H.current=!1}catch{}})(),()=>{te=!0}},[d,r]);const P=m.useMemo(()=>((r==null?void 0:r.nodes)??[]).find(te=>te.id===l)??null,[r,l]),N=m.useMemo(()=>r?os(r,o):null,[r,o]);m.useMemo(()=>{var te,ce;return((te=E.find(G=>G.id===h))==null?void 0:te.report)??((ce=E[E.length-1])==null?void 0:ce.report)??null},[E,h]),m.useMemo(()=>V.length===0?g:{status:"passed",visited:new Set(V),active:V[V.length-1]??null,progress:100,logs:[]},[V,g]);const F=m.useCallback((te,ce)=>{const G=te,ue=G.globalConsent??G.consent,fe=typeof ue=="boolean"?ue:ue==null?!0:!!ue,w=typeof G.fcap=="number"?G.fcap:Number(G.fcap)||0,z=(G.archetype??"").toLowerCase(),ne=G.suppressionReason,U=ne==="holdout_segment"||G.holdout===!0||z==="holdout"?"holdout":ne==="no_consent"||ne==="experiment_holdback"||G.category==="ineligible"||z==="ineligible"||z==="consent_suppressed"||z==="experiment_holdback"?"suppressed":w>=3||z==="fcap_capped"?"fcap-risk":z.startsWith("experiment_variant")?"control":"test";return{id:G.id??`gen_${ce}`,name:typeof G.name=="string"?G.name:"Generated",region:typeof G.region=="string"?G.region:"—",age:typeof G.age=="number"?G.age:30,consent:fe,fcap:w,lastSend:typeof G.lastSend=="string"?G.lastSend:"0d",segment:G.archetype??"",tag:U,scenario:G.scenario,archetype:G.archetype}},[]),q=m.useCallback(async()=>{if(!d||!S)return null;L(!0),c([]);try{const{synthId:te}=await De.synthProfiles({journeyId:d,segmentId:S}),ce=Date.now(),G=5*60*1e3;for(;;){if(await new Promise(fe=>setTimeout(fe,2e3)),Date.now()-ce>G)throw new Error("Synth job timed out after 5 minutes.");const ue=await De.getSynthStatus(te);if(ue.status==="done"){const fe=ue.suites??[],w=ue.profiles??[],z={id:`plan-${Date.now()}`,createdAt:new Date().toISOString(),journeyId:d,segmentId:S,suites:fe,profiles:w};return A(ne=>[...ne,z]),ae(z.id),c(w.map((ne,U)=>F(ne,U))),u(new Set),z}if(ue.status==="failed")throw new Error(ue.error||"Synth job failed")}}catch(te){return console.error(te),null}finally{L(!1)}},[d,S,F]),oe=m.useCallback(async(te,ce)=>{if(!d||!S||!te.trim())return;const G=$.find(ue=>ue.id===Y)??$[$.length-1];if(G){L(!0),ie(null);try{const ue=G.profiles.map(ne=>({id:ne.id??"",name:ne.name??""})),{synthId:fe}=await De.extendProfiles({journeyId:d,segmentId:S,instruction:te,existingProfiles:ue,count:ce}),w=Date.now(),z=5*60*1e3;for(;;){if(await new Promise(U=>setTimeout(U,2e3)),Date.now()-w>z)throw new Error("Extend job timed out after 5 minutes.");const ne=await De.getSynthStatus(fe);if(ne.status==="done"){const U=ne.profiles??[],ye=[...G.profiles,...U],Ce={id:`plan-${Date.now()}`,createdAt:new Date().toISOString(),journeyId:G.journeyId,segmentId:G.segmentId,suites:G.suites,profiles:ye};A(pe=>[...pe,Ce]),ae(Ce.id),c(ye.map((pe,Pe)=>F(pe,Pe)));break}if(ne.status==="failed")throw new Error(ne.error||"Extend job failed")}}catch(ue){const fe=ue instanceof Error?ue.message:String(ue);console.error("Extend failed:",fe),ie(fe)}finally{L(!1)}}},[d,S,$,Y,F]),ge=m.useCallback(async(te,ce)=>{var z;if(!d||!S)return;const G=d,ue=S,fe=Y??((z=$[$.length-1])==null?void 0:z.id)??null,w=ce.length;B(!0),v({status:"running",visited:new Set,active:null,logs:[],progress:0});try{const{runId:ne}=await De.startQARun({journeyId:G,segmentId:ue,suites:te,baseProfiles:ce}),U=pe=>{const Pe={id:ne,createdAt:new Date().toISOString(),journeyId:G,segmentId:ue,planId:fe,profileCount:w,report:pe};D(gn=>[...gn.filter(dn=>dn.id!==ne),Pe]),k(ne),Z(null)},ye=async(pe,Pe,gn)=>{B(!1),v(cn=>({...cn,status:Pe,progress:100,duration:gn}));try{U(await De.getReport(pe))}catch(cn){console.error(cn)}};let Ce=null;De.subscribeRun(ne,{onStep:pe=>{v(Pe=>({...Pe,status:"running",active:pe.nodeId,progress:pe.progress,logs:[...Pe.logs,{ts:pe.ts,level:pe.level,node:pe.node,label:pe.label,msg:pe.msg}]}))},onDone:async pe=>{Ce==null||Ce(),await ye(ne,pe.status,pe.duration)},onError:()=>{console.warn("SSE stream failed, switching to poll-based fallback for run",ne),v(pe=>({...pe,logs:[...pe.logs,{ts:new Date().toLocaleTimeString("en",{hour12:!1}),level:"warn",node:"stream",label:"Connection",msg:"Live stream unavailable — polling for results…"}]})),Ce=De.pollReport(ne,pe=>{B(!1),v(Pe=>({...Pe,status:"passed",progress:100})),U(pe)},()=>{console.error("Poll gave up waiting for report",ne),B(!1)})}})}catch(ne){console.error(ne),B(!1)}},[d,S,Y,$]),K=m.useCallback(te=>{if(f.size===0)return te;const ce=te.filter(G=>f.has(String(G.id)));return ce.length>0?ce:te},[f]),xe=m.useCallback(async()=>{const te=$.find(G=>G.id===Y)??$[$.length-1],ce=(te==null?void 0:te.suites)??[];ce.length===0||!te||await ge(ce,K(te.profiles))},[$,Y,ge,K]);return m.useCallback(async()=>{if(!d||!S)return;const te=$.find(G=>G.id===Y)??$[$.length-1],ce=(te==null?void 0:te.suites)??[];if(ce.length===0){const G=await q();if(!G||G.suites.length===0)return;await ge(G.suites,G.profiles)}else te&&await ge(ce,K(te.profiles))},[d,S,$,Y,q,ge,K]),m.useEffect(()=>{t&&(!d||!S||H.current||(H.current=!0,Q("qa"),q()))},[t,d,S,q]),j?e.jsxs("div",{className:"jo jo-bootstrap-error",style:{padding:"24px"},children:[e.jsx("h2",{style:{marginBottom:8,fontSize:15},children:"Could not reach the QA API"}),e.jsx("p",{style:{fontSize:13,opacity:.7},children:j})]}):!r||!N?e.jsx("div",{className:"jo jo-bootstrap",style:{padding:"24px",fontSize:13,opacity:.6},children:"Loading journey…"}):e.jsxs("div",{className:"jo mode-test jo-embedded",children:[e.jsx(cs,{journey:r,journeys:s,onSelectJourney:p,segments:I,selectedSegmentId:S,onSegmentChange:T,qaRunning:C,synthRunning:b,onGenerateAndRun:async()=>{Q("qa"),await q()},canSynth:!!d&&!!S,hasSuites:((Be=(we=$.find(te=>te.id===Y)??$[$.length-1])==null?void 0:we.suites)==null?void 0:Be.length)>0,disableSelectors:!0}),e.jsx("div",{className:"jo-workspace jo-workspace--embedded",children:e.jsx(ds,{journey:r,selectedNode:P,profiles:o,setProfiles:c,selectedProfileIds:f,setSelectedProfileIds:u,qaRuns:E,activeRunId:h,onSelectRun:k,testPlans:$,activePlanId:Y,onSelectPlan:ae,onSynthSuites:q,onExtendSuites:oe,extendError:se,clearExtendError:()=>ie(null),synthRunning:b,onRunQA:xe,qaRunning:C,qaProgress:g.progress,qaLogs:g.logs,canSynth:!!d&&!!S,selectedWalkId:y,onSelectWalk:Z,onPathChange:le,onSimResult:ve,activeTab:de,onTabChange:Q})})]})}const Wr=[{id:"audience",label:"Audience Config"},{id:"canvas",label:"Journey Canvas"},{id:"measurement",label:"Measurement"},{id:"qa",label:"QA"},{id:"json",label:"JSON Export"}];function Jr(){const n=[{label:"Brief parsed",tone:"ok"},{label:"Schema validated",tone:"ok"},{label:"Audience ready",tone:"ok"},{label:"Canvas generated",tone:"ok"},{label:"SMS not configured",tone:"warn"}];return e.jsx("div",{className:"chip-row",children:n.map(t=>e.jsx("span",{className:`status-chip ${t.tone}`,children:t.label},t.label))})}function Xe({accent:n,title:t,badge:s,children:a}){return e.jsxs("div",{className:"content-card",children:[e.jsx("div",{className:"content-card-accent",style:{background:n}}),e.jsxs("div",{className:"content-card-head",children:[e.jsx("div",{className:"content-card-title",children:t}),s?e.jsx("span",{className:"badge",children:s}):null]}),e.jsx("div",{className:"content-card-body",children:a})]})}function Ca(n){return n==="inApp"?"In-App":String(n??"email").trim().toUpperCase()}function qr({orchestrationType:n="journey",singleChannel:t="email",singleUseHoldout:s=!0,singleUseAB:a=!0}){const r=n==="single-touchpoint"?["Entry",...s?["Holdout"]:[],...a?["A/B"]:[],Ca(t),"Outcome","Exit"]:["Entry","Holdout","A/B","Wait","Email","Cond","Wait","Push","Exit"];return e.jsx("div",{className:"canvas-preview",children:r.map((i,d)=>e.jsxs("div",{className:"canvas-preview-step",children:[e.jsx("div",{className:"canvas-preview-box",children:i}),d<r.length-1?e.jsx("div",{className:"canvas-preview-arrow",children:"-"}):null]},i))})}function Hr(n){return n==="Braze"?"Send to Braze":n==="SFMC"?"Send to SFMC":"Send to AJO"}function Ot(n){return n==="Braze"?"Sent to Braze":n==="SFMC"?"Sent to SFMC":"Sent to AJO"}function Gr({data:n,form:t,tab:s,busy:a,progress:r,platform:i,orchestrationType:d="journey",singleTouchpoint:p=null,sendState:o,showActivationCard:c=!1,journeyId:l=null,onTabChange:f,onFormChange:u,onToggleChannel:g,onGenerate:v,onSend:j,onActivate:_}){const[I,x]=m.useState(!1),S=Array.from(new Set(["21 days","14 days","30 days",t.duration].filter(Boolean))),T=Array.from(new Set(["Max 3 per week","Max 2 per week","Max 1 per week",t.frequencyCap].filter(Boolean))),C=d==="single-touchpoint",B=(p==null?void 0:p.singleChannel)??"email",E=Ca(B),D=C?!!(p!=null&&p.singleUseHoldout)&&Number(t.holdout)>0:!0,h=C?!!(p!=null&&p.singleUseAB):!0,k=Number((p==null?void 0:p.singleSendOffsetHours)??0),$=Number((p==null?void 0:p.singleOutcomeWindowHours)??24),A=D?ps(t.holdout):0,Y=C?E:ms(t.channels),ae=`LAC_${t.name.replace(/[^a-z0-9]+/gi,"_")}`.replace(/_+/g,"_"),b=m.useMemo(()=>({platform:i,name:ae,orchestration:{type:C?"single-touchpoint":"journey",...C?{singleChannel:B,triggerType:(p==null?void 0:p.singleTriggerType)??"event",trigger:(p==null?void 0:p.singleTriggerEvent)??"audienceQualified",sendOffsetHours:k,outcomeWindowHours:$}:{}},objective:t.objective,audience:{segmentName:t.audience,entryTrigger:t.entryTrigger,exclusions:[`holdout_${t.holdout}pct`,"marketing_opt_out","active_journey"]},channels:C?[B]:Object.entries(t.channels).filter(([,y])=>y).map(([y])=>y),holdout:D?{percentage:Number(t.holdout),segmentName:`Holdout_${t.holdout}pct`}:{enabled:!1},experiment:h?{variants:[{id:"VarA",label:t.variantA,percentage:Number(t.split)},{id:"VarB",label:t.variantB,percentage:100-Number(t.split)}]}:{enabled:!1,variants:[{id:"VarA",label:t.variantA,percentage:100}]},timing:{duration:t.duration,frequencyCap:t.frequencyCap},measurement:{attribution:t.attribution,workspaceName:`${ae}_Measurement`}}),[t,C,ae,$,i,k,B,p==null?void 0:p.singleTriggerEvent,p==null?void 0:p.singleTriggerType,h,D]);async function L(){try{await navigator.clipboard.writeText(JSON.stringify(b,null,2)),x(!0),window.setTimeout(()=>x(!1),1800)}catch{x(!1)}}return e.jsxs("section",{className:"module-layout config-layout",children:[e.jsxs("aside",{className:"panel side-panel wide",children:[e.jsxs("div",{className:"panel-head",children:[e.jsx("div",{className:"panel-title",style:{color:"#4A9EF5"},children:"Journey Config"}),e.jsx("div",{className:"panel-subtitle",children:"Tune audience, channels, experiment controls, and export settings for the selected platform."})]}),e.jsxs("div",{className:"panel-body",children:[e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Journey name"}),e.jsx("input",{className:"field-input",value:t.name,onChange:y=>u("name",y.target.value)})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Objective"}),e.jsx("textarea",{className:"field-input multiline short",value:t.objective,onChange:y=>u("objective",y.target.value)})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Entry trigger"}),e.jsxs("select",{className:"field-input",value:t.entryTrigger,onChange:y=>u("entryTrigger",y.target.value),children:[e.jsx("option",{value:"audienceQualified",children:"audienceQualified"}),e.jsx("option",{value:"ticketPurchase",children:"ticketPurchase"}),e.jsx("option",{value:"appSessionStart",children:"appSessionStart"})]})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Audience"}),e.jsxs("select",{className:"field-input",value:t.audience,onChange:y=>u("audience",y.target.value),children:[e.jsx("option",{value:"Recent_Attendees_No_App_30d",children:"Recent_Attendees_No_App_30d"}),e.jsx("option",{value:"Recent_Event_Attendees_No_Purchase",children:"Recent_Event_Attendees_No_Purchase"}),e.jsx("option",{value:"Lapsed_Customers_45d",children:"Lapsed_Customers_45d"}),e.jsx("option",{value:"Subscription_Renewal_Window_10d",children:"Subscription_Renewal_Window_10d"})]})]}),e.jsxs("div",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Channels"}),e.jsx("div",{className:"toggle-row",children:[["email","Email"],["push","Push"],["sms","SMS"],["inApp","In-App"]].map(([y,Z])=>e.jsx("button",{type:"button",className:`channel-chip ${t.channels[y]?"on":"off"}`,onClick:()=>g(y),children:Z},y))})]}),e.jsxs("div",{className:"two-col",children:[e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Duration"}),e.jsx("select",{className:"field-input",value:t.duration,onChange:y=>u("duration",y.target.value),children:S.map(y=>e.jsx("option",{children:y},y))})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Frequency cap"}),e.jsx("select",{className:"field-input",value:t.frequencyCap,onChange:y=>u("frequencyCap",y.target.value),children:T.map(y=>e.jsx("option",{children:y},y))})]})]}),e.jsxs("div",{className:"group-box purple",children:[e.jsx("div",{className:"field-label purple-text",children:"A/B experiment"}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Variant A"}),e.jsx("input",{className:"field-input",value:t.variantA,onChange:y=>u("variantA",y.target.value)})]}),e.jsxs("label",{className:"field compact",children:[e.jsx("span",{className:"field-label small",children:"Variant B"}),e.jsx("input",{className:"field-input",value:t.variantB,onChange:y=>u("variantB",y.target.value)})]}),e.jsxs("div",{className:"slider-row",children:[e.jsx("input",{type:"range",min:"10",max:"90",value:t.split,onChange:y=>u("split",Number(y.target.value))}),e.jsxs("span",{className:"slider-value",children:[t.split,"% / ",100-t.split,"%"]})]})]}),e.jsxs("div",{className:"group-box teal",children:[e.jsx("div",{className:"field-label teal-text",children:"Holdout"}),e.jsxs("div",{className:"slider-row",children:[e.jsx("input",{type:"range",min:"5",max:"30",value:t.holdout,onChange:y=>u("holdout",Number(y.target.value))}),e.jsxs("span",{className:"slider-value",children:[t.holdout,"%"]})]}),e.jsx("div",{className:"helper-text",children:"Excluded from outbound messages and reserved for incrementality tracking."})]}),e.jsxs("label",{className:"field",children:[e.jsx("span",{className:"field-label",children:"Attribution"}),e.jsxs("select",{className:"field-input",value:t.attribution,onChange:y=>u("attribution",y.target.value),children:[e.jsx("option",{children:"Last-touch (21-day)"}),e.jsx("option",{children:"First-touch"}),e.jsx("option",{children:"Linear"})]})]}),e.jsxs("button",{type:"button",className:"button primary full",onClick:v,disabled:a,children:[a?e.jsx("span",{className:"spinner"}):null,a?"Generating...":"Generate Journey Config & QA"]}),a?e.jsxs("div",{className:"progress-stack",children:[e.jsx("div",{className:"progress-track",children:e.jsx("span",{className:"progress-fill",style:{width:`${r.percent}%`}})}),e.jsx("div",{className:"progress-label",children:r.message})]}):null]})]}),e.jsxs("div",{className:"panel content-panel",children:[e.jsxs("div",{className:"content-tabs",children:[e.jsx("div",{className:"tab-strip",children:Wr.map(y=>e.jsx("button",{type:"button",className:`tab-button ${s===y.id?"on":""}`,onClick:()=>f(y.id),children:y.label},y.id))}),n.generated?e.jsxs("div",{className:"tab-actions",children:[e.jsx("button",{type:"button",className:"button secondary small",onClick:L,children:I?"Copied":"Copy"}),e.jsxs("button",{type:"button",className:`button primary small ${o==="sent"?"success":""}`,onClick:()=>j(),disabled:o!=="idle",children:[o==="sending"?e.jsx("span",{className:"spinner"}):null,o==="sending"?"Preparing...":o==="sent"?Ot(i):Hr(i)]}),c&&["ready","activating","sent"].includes(o)?e.jsxs("div",{className:`ajo-activation-card ${o==="sent"?"done":""}`,children:[e.jsxs("div",{children:[e.jsx("strong",{children:o==="sent"?Ot(i):"Activate Journey"}),e.jsx("span",{children:o==="sent"?"Journey has been activated in AJO.":"Review complete. Activate the journey when ready."})]}),o!=="sent"?e.jsxs("button",{type:"button",className:"button primary small",onClick:()=>_==null?void 0:_(),disabled:o==="activating",children:[o==="activating"?e.jsx("span",{className:"spinner"}):null,o==="activating"?"Activating...":"Activate Journey"]}):null]}):null]}):null]}),e.jsx("div",{className:`content-body${s==="qa"?" content-body--qa":""}`,children:n.generated?e.jsxs(e.Fragment,{children:[e.jsx(Jr,{}),s==="audience"?e.jsxs(e.Fragment,{children:[e.jsx(Xe,{accent:"#2680EB",title:"Primary Audience Segment",badge:"Audience",children:e.jsxs("div",{className:"detail-grid",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"segment.name"}),e.jsx("span",{className:"detail-value",children:t.audience})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"entry.trigger"}),e.jsx("span",{className:"detail-value",children:t.entryTrigger})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"channels"}),e.jsx("span",{className:"detail-value",children:Y})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"est.audience"}),e.jsx("span",{className:"detail-value",children:D?`14,200 total / ${A.toLocaleString()} holdout excluded`:"14,200 total / holdout disabled"})]})]})}),e.jsx(Xe,{accent:"#0FB8B8",title:"Holdout Segment",badge:"Incrementality",children:e.jsx("div",{className:"detail-grid",children:D?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"segment.name"}),e.jsx("span",{className:"detail-value",children:`Holdout_${t.holdout}pct`})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"sampling"}),e.jsxs("span",{className:"detail-value",children:[t.holdout,"% deterministic sample on profile id"]})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"tracking"}),e.jsx("span",{className:"detail-value",children:"liftBaselineTracked"})]})]}):e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"status"}),e.jsx("span",{className:"detail-value",children:"Holdout disabled for this campaign"})]})})}),e.jsx(Xe,{accent:"#8B5CF6",title:"Experiment Segments",badge:"A/B Test",children:e.jsx("div",{className:"detail-grid",children:h?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"variant.A"}),e.jsxs("span",{className:"detail-value",children:[t.split,"% / ",t.variantA]})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"variant.B"}),e.jsxs("span",{className:"detail-value",children:[100-t.split,"% / ",t.variantB]})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"success.metric"}),e.jsx("span",{className:"detail-value",children:"purchase or primary conversion event at 21d"})]})]}):e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"status"}),e.jsx("span",{className:"detail-value",children:"Single-arm campaign (A/B disabled)"})]})})})]}):null,s==="canvas"?e.jsxs(e.Fragment,{children:[e.jsxs(Xe,{accent:"#2680EB",title:"Journey Canvas Preview",badge:"Canvas",children:[e.jsx(qr,{orchestrationType:d,singleChannel:B,singleUseHoldout:D,singleUseAB:h}),e.jsx("div",{className:"info-box info-blue",children:"The generated canvas mirrors the blueprint path and the current control values."})]}),e.jsx(Xe,{accent:"#2680EB",title:"Journey Config",badge:"Settings",children:e.jsxs("div",{className:"detail-grid",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"platform"}),e.jsx("span",{className:"detail-value",children:i})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"journey.name"}),e.jsx("span",{className:"detail-value",children:ae})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"orchestration"}),e.jsx("span",{className:"detail-value",children:C?`single touchpoint / ${E}`:"multi-touch journey"})]}),C?e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"timing.window"}),e.jsxs("span",{className:"detail-value",children:["send +",k,"h / outcome ",$,"h"]})]}):null,e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"duration"}),e.jsx("span",{className:"detail-value",children:t.duration})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"frequency.cap"}),e.jsx("span",{className:"detail-value",children:t.frequencyCap})]})]})})]}):null,s==="measurement"?e.jsxs(e.Fragment,{children:[e.jsx(Xe,{accent:"#C89B3C",title:"Measurement Workspace",badge:"Reporting",children:e.jsxs("div",{className:"detail-grid",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"workspace.name"}),e.jsx("span",{className:"detail-value",children:`${ae}_Measurement`})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"primary.metric"}),e.jsx("span",{className:"detail-value",children:"primary conversion rate"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"attribution"}),e.jsx("span",{className:"detail-value",children:t.attribution})]})]})}),e.jsx(Xe,{accent:"#0FB8B8",title:"Incrementality",badge:"Holdout",children:e.jsxs("div",{className:"detail-grid",children:[e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"holdout.segment"}),e.jsx("span",{className:"detail-value",children:`Holdout_${t.holdout}pct`})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"lift.metric"}),e.jsx("span",{className:"detail-value",children:"journey conversion minus holdout conversion"})]}),e.jsxs("div",{className:"detail-row",children:[e.jsx("span",{className:"detail-key",children:"incremental.value"}),e.jsx("span",{className:"detail-value",children:"lift % x reachable audience x average order value"})]})]})})]}):null,s==="qa"?e.jsx(Fr,{initialJourneyId:l,autoSynth:!0}):null,s==="json"?e.jsx(Xe,{accent:"#2680EB",title:"Journey API Payload",badge:"JSON",children:e.jsx("pre",{className:"json-block",children:JSON.stringify(b,null,2)})}):null]}):e.jsxs("div",{className:"empty-state",children:[e.jsx("div",{className:"empty-state-mark",children:"CFG"}),e.jsx("p",{children:"Generate the journey config to populate the audience, canvas, measurement, and API export tabs."})]})})]})]})}function Kr(n){return n==="teal"||n==="blocked"?"teal":n==="amber"||n==="warning"?"amber":"green"}function Bt(n){switch(n){case"pass":return"OK";case"fail":return"NO";case"running":return"...";case"blocked":return"BL";case"warn":return"WR";case"skip":return"SK";default:return"--"}}function Ur(n){return[["Segment",n.segment],["Games",n.games],["Last game",n.lastGame],["App active",typeof n.appActive=="boolean"?n.appActive?"Yes":"No":void 0],["Loyalty pts",Number.isFinite(n.loyaltyPoints)?n.loyaltyPoints.toLocaleString():void 0],["Fan ID",n.fanId]].filter(([,s])=>s!=null&&s!=="").map(([s,a])=>({label:s,value:a}))}function Vr({profiles:n,suites:t,suiteScore:s,runAllBusy:a,selectedProfileId:r,profileRun:i,automationPlaybook:d,sourceLabel:p,onRunAll:o,onSelectProfile:c}){const l=n.find(u=>u.id===r)??null,f=Array.isArray(l==null?void 0:l.attributes)&&l.attributes.length?l.attributes:l?Ur(l):[];return e.jsxs("div",{className:"qa-grid",children:[e.jsxs("div",{className:"content-card qa-column",children:[e.jsx("div",{className:"content-card-accent",style:{background:"#0FB8B8"}}),e.jsx("div",{className:"content-card-head",children:e.jsx("div",{className:"content-card-title",children:"Profiles"})}),e.jsx("div",{className:"list-body",children:n.map(u=>e.jsxs("button",{type:"button",className:`list-card ${r===u.id?"on":""}`,onClick:()=>c(u.id),children:[e.jsxs("div",{className:"list-card-top",children:[e.jsx("div",{className:"profile-avatar",children:u.name.slice(0,2).toUpperCase()}),e.jsxs("div",{children:[e.jsx("div",{className:"list-card-title",children:u.name}),e.jsxs("div",{className:"list-card-meta",children:[u.type," / ",u.id]})]})]}),e.jsx("div",{className:`outcome-chip ${u.expectedTone}`,children:u.expectedOutcome})]},u.id))})]}),e.jsxs("div",{className:"content-card qa-column",children:[e.jsx("div",{className:"content-card-accent",style:{background:"#0FB8B8"}}),e.jsxs("div",{className:"content-card-head",children:[e.jsx("div",{className:"content-card-title",children:"QA Suites"}),e.jsxs("button",{type:"button",className:"button teal small",onClick:o,disabled:a,children:[a?e.jsx("span",{className:"spinner"}):null,a?"Running...":"Run All"]})]}),e.jsxs("div",{className:"content-card-body",children:[s?e.jsxs("div",{className:"suite-score-row",children:[e.jsxs("span",{className:"score-pill green",children:[s.passed," passed"]}),e.jsxs("span",{className:"score-pill red",children:[s.failed," failed"]})]}):null,e.jsx("div",{className:"qa-suite-stack",children:t.map(u=>e.jsxs("div",{className:"suite-card qa-suite-card",children:[e.jsxs("div",{className:"suite-card-top",children:[e.jsx("div",{className:`suite-status ${u.status}`,children:Bt(u.status)}),e.jsxs("div",{children:[e.jsx("div",{className:"list-card-title",children:u.name}),e.jsxs("div",{className:"list-card-meta",children:[u.description," / ",u.testCount," tests"]})]})]}),u.status==="running"?e.jsx("div",{className:"progress-track",children:e.jsx("span",{className:"progress-fill teal looping"})}):null]},u.id))}),e.jsx("div",{className:"section-label",style:{marginTop:16},children:"Automation Playbook"}),e.jsx("div",{className:"qa-playbook-stack",children:d.map(u=>e.jsxs("div",{className:"group-box",children:[e.jsx("div",{className:"content-card-title",style:{color:u.accent},children:u.title}),e.jsx("div",{className:"helper-text",children:u.note})]},u.title))})]})]}),e.jsxs("div",{className:"content-card qa-column qa-results",children:[e.jsx("div",{className:"content-card-accent",style:{background:"#0FB8B8"}}),e.jsxs("div",{className:"content-card-head",children:[e.jsx("div",{className:"content-card-title",children:"Simulation Results"}),e.jsx("span",{className:"badge subtle",children:l?`${l.name} / ${l.id}`:"Select a profile"})]}),e.jsx("div",{className:"content-card-body",children:!l||!i?e.jsxs("div",{className:"empty-state",children:[e.jsx("div",{className:"empty-state-mark",children:"QA"}),e.jsxs("p",{children:["Select a synthetic ",p?`${p.toLowerCase()} `:"","profile to animate the journey simulation."]})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"profile-stat-grid",children:f.map(({label:u,value:g})=>e.jsxs("div",{className:"profile-stat",children:[e.jsx("div",{className:"detail-key",children:u}),e.jsx("div",{className:"profile-stat-value",children:g})]},u))}),e.jsxs("div",{className:`outcome-chip ${l.expectedTone}`,children:["Expected: ",l.expectedOutcome]}),e.jsx("div",{className:"section-label",style:{marginTop:18},children:"Journey Simulation"}),i.steps.map((u,g)=>e.jsxs("div",{className:"simulation-step",children:[e.jsx("div",{className:`suite-status ${u.status}`,children:Bt(u.status)}),e.jsxs("div",{className:"simulation-step-copy",children:[e.jsx("div",{className:"simulation-step-title",children:u.label}),e.jsx("div",{className:"simulation-step-text",children:u.description})]}),e.jsx("div",{className:`simulation-step-state ${u.status}`,children:u.status.toUpperCase()})]},`${u.label}-${g}`)),i.running?e.jsxs("div",{className:"simulation-running",children:[e.jsx("span",{className:"spinner"}),"Running next check..."]}):null,i.running?null:e.jsx("div",{className:`summary-box ${Kr(i.summaryTone)}`,children:i.summaryText})]})})]})]})}const et="/api/copilot",Yr=3e3,Xr=4200,Ft=9e3,Wt=new Set(["sports","media","telecom","automotive"]);function an(n){return new Promise(t=>{window.setTimeout(t,n)})}function vn(n,t="sports"){const s=String(n??"").trim().toLowerCase();return Wt.has(s)?s:Wt.has(t)?t:"sports"}function nt(n="sports"){if(typeof window>"u")return vn(n);try{const t=new URLSearchParams(window.location.search).get("sourceSystem");if(t)return vn(t,n)}catch{}try{return vn(window.localStorage.getItem("cdp_source_system"),n)}catch{return vn(n)}}function Jt(...n){const t=new Map;return n.flat().forEach(s=>{if(!s||typeof s!="object")return;const a=String(s.segment_id??s.id??"").trim();if(!a)return;const r=s.pipeline_status??s._pipelineStatus??s.status??"Ready for activation";t.set(a,{...t.get(a),...s,id:a,segment_id:a,status:r})}),[...t.values()]}function qt(n,t){const s=String((n==null?void 0:n.source_system)??(n==null?void 0:n.sourceSystem)??"").trim().toLowerCase();return!s||s==="all"||s===t}async function Qr(n,t={}){const s=await fetch(n,{...t,headers:{accept:"application/json",...t.headers}});if(!s.ok)throw new Error(`Request failed with ${s.status} ${s.statusText}.`);return s.json()}async function Aa(n,t){const s=await fetch(n,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify(t)});if(!s.ok)throw new Error(`Request failed with ${s.status} ${s.statusText}.`);return s.json()}function Kn(n,t){return JSON.stringify({form:n,phaseHeaders:t.phaseHeaders,nodes:t.nodes,edges:t.edges,nodeDetails:Rn(t.nodeDetails)})}function Zr(n){var t;return{title:((t=n.title)==null?void 0:t.filter(Boolean).join(" "))||"New Node",kind:n.kind,accent:n.accent,rows:[{key:"segment",value:"Define audience or eligibility"},{key:"action",value:"Document channel, condition, or wait logic"}],note:"Customize this node to match the journey logic you want to activate."}}function _a({activeRoute:n,meta:t,routes:s,sections:a,embedded:r=!1,showSidebar:i=!0,onRouteChange:d,children:p}){const o=s.find(c=>c.id===n)??s[0];return e.jsxs("div",{className:`app-shell ${r?"embedded":""}`,style:{"--accent":(o==null?void 0:o.accent)??"#2680EB"},children:[r?null:e.jsxs("header",{className:"topbar",children:[e.jsx("div",{className:"exl-mark","aria-hidden":"true",children:e.jsx("span",{children:"EXL"})}),e.jsx("div",{className:"topbar-brand",children:t.brand})]}),e.jsxs("div",{className:"workspace-shell",children:[i?e.jsxs("aside",{className:"sidebar",children:[e.jsxs("div",{className:"sidebar-head",children:[e.jsx("div",{className:"sidebar-title",children:"Workspace"}),e.jsx("div",{className:"sidebar-copy",children:"Build campaigns, configure journeys, and validate automation from one activation suite."})]}),e.jsx("div",{className:"sidebar-body",children:a.map(c=>e.jsxs("div",{className:"sidebar-section",children:[e.jsxs("div",{className:"sidebar-section-head",children:[e.jsx("div",{className:"sidebar-section-title",style:{color:c.accent},children:c.title}),e.jsx("div",{className:"sidebar-section-copy",children:c.description})]}),e.jsx("div",{className:"sidebar-links",children:c.items.map(l=>e.jsxs("button",{type:"button",className:`sidebar-link ${n===l.id?"on":""}`,onClick:()=>d(l.id),children:[e.jsx("span",{children:l.label}),e.jsx("span",{className:"sidebar-link-pill",children:l.pill})]},l.id))})]},c.id))})]}):null,e.jsx("main",{className:"workspace-main",children:p})]})]})}function el({embedded:n=!1,showSidebar:t=!0,message:s="Loading the workspace shell, journey library, and editable activation canvas."}){var r;const a=un(In());return e.jsx(_a,{activeRoute:n?"bp":((r=a.routes[0])==null?void 0:r.id)??"bp",meta:a.meta,routes:a.routes,sections:a.sections,embedded:n,showSidebar:t,onRouteChange:()=>{},children:e.jsxs("div",{className:"loading-screen",children:[e.jsx("span",{className:"spinner large"}),e.jsx("div",{className:"loading-title",children:"Preparing EXL AI Accelerator"}),e.jsx("div",{className:"loading-copy",children:s})]})})}function nl({bootstrap:n,actions:t,embedded:s=!1,initialRoute:a="bp",forcedRoute:r=null,showSidebar:i=!0,onRouteRequest:d,externalActivatedSegments:p=[]}){var vt;const[o,c]=m.useState(r??a),[l,f]=m.useState("audience"),[u,g]=m.useState(n.blueprint.form),[v,j]=m.useState(n.journey.form),[_,I]=m.useState(n.blueprint),[x,S]=m.useState(n.journey),[T,C]=m.useState(n.qa.suites),[B,E]=m.useState(n.qa.suiteScore),[D,h]=m.useState(null),[k,$]=m.useState(null),[A,Y]=m.useState(null),[ae,b]=m.useState(null),[L,y]=m.useState(""),[Z,de]=m.useState(!1),[Q,se]=m.useState(!1),[ie,V]=m.useState(!1),[le,je]=m.useState(!1),[ve,H]=m.useState("idle"),[P,N]=m.useState(!1),[F,q]=m.useState(!1),[oe,ge]=m.useState(p),[K,xe]=m.useState({percent:0,message:"Ready to generate"}),[we,Be]=m.useState({percent:0,message:"Ready to generate"}),te=m.useRef(0),ce=m.useRef(Kn(n.blueprint.form,n.blueprint)),G=m.useRef(""),ue=m.useRef(0),fe=m.useRef(((vt=n.blueprint.form)==null?void 0:vt.brief)??""),w=m.useRef(u),z=m.useRef(_),ne=m.useRef(v),U=n.qa.sourceSystem??"sports",ye=m.useRef(U),Ce=D?_.nodes.find(R=>R.id===D):null,pe=k?_.edges.find(R=>R.id===k):null,Pe=D?_.nodeDetails[D]:null,gn=_.availableJourneyCategories??[],cn=u.journeyCategory?vs(u.journeyCategory,_.availableJourneys??[]):[],dn=gn.find(R=>R.id===u.journeyCategory)??null,Fe=(_.availableJourneys??[]).find(R=>R.slug===u.journeyType),Pa=!!u.journeyType&&Kn(u,_)!==ce.current,Sn=m.useMemo(()=>JSON.stringify({platform:u.platform,targetDate:u.targetDate,brief:u.brief,journeyForm:v,nodes:_.nodes,edges:_.edges,nodeDetails:Rn(_.nodeDetails)}),[u.brief,u.platform,u.targetDate,_.edges,_.nodeDetails,_.nodes,v]),xn=m.useRef(Sn);m.useEffect(()=>{ge(p??[])},[p]),m.useEffect(()=>{w.current=u},[u]),m.useEffect(()=>{z.current=_},[_]),m.useEffect(()=>{ne.current=v},[v]),m.useEffect(()=>{xn.current=Sn,ve!=="idle"&&G.current&&G.current!==Sn&&(H("idle"),N(!1),G.current="")},[Sn,ve]),m.useEffect(()=>{if(ve!=="sent"||!P)return;const R=window.setTimeout(()=>{N(!1)},Xr);return()=>window.clearTimeout(R)},[ve,P]),m.useEffect(()=>{r&&c(r)},[r]),m.useEffect(()=>{ye.current!==U&&(ye.current=U,C(n.qa.suites.map(R=>({...R,status:"idle"}))),E(null),Y(R=>n.qa.profiles.some(W=>W.id===R)?R:null),b(null))},[n.qa.profiles,n.qa.suites,U]);function za(R,W){ce.current=Kn(R,W)}function Cn(){h(null),$(null)}function ht(R,W){var J;g(R.form),I(R),j(W.form),S(W),Cn(),y(""),H("idle"),N(!1),q(!1),G.current="",fe.current=((J=R.form)==null?void 0:J.brief)??"",za(R.form,R)}function gt(R,W){const J=["brief","orchestrationType","singleChannel","singleTriggerType","singleTriggerEvent","singleSendOffsetHours","singleOutcomeWindowHours","singleUseHoldout","singleUseAB"].includes(R);if(g(re=>({...re,[R]:W})),R==="brief"){q(W!==fe.current);return}J&&q(!0)}function Ma(R,W){j(J=>({...J,[R]:W}))}function Ta(R){j(W=>({...W,channels:{...W.channels,[R]:!W.channels[R]}}))}function xt(R){h(R),$(null)}function ft(R){$(R),h(null)}function La(R,W){D&&I(J=>{const re=J.nodes.map(he=>he.id===D?(()=>{const Ee={...he};return W===void 0&&(R==="x"||R==="y"||R==="variantBadge")?delete Ee[R]:Ee[R]=W,Ee})():he),me=J.nodeDetails[D]?{...J.nodeDetails[D],...R==="accent"?{accent:W}:{},...R==="kind"?{kind:W}:{}}:null;return{...J,nodes:re,nodeDetails:me?{...J.nodeDetails,[D]:me}:J.nodeDetails}})}function Oa(R,W,J){D&&I(re=>({...re,nodes:re.nodes.map(me=>{if(me.id!==D)return me;const he=[...me[R]??[],""];return he[W]=J,{...me,[R]:he.slice(0,2)}})}))}function Ba(R,W){D&&I(J=>({...J,nodeDetails:{...J.nodeDetails,[D]:{...J.nodeDetails[D],[R]:W}}}))}function Fa(R,W,J){D&&I(re=>{const me=re.nodeDetails[D].rows.map((he,Ee)=>Ee===R?{...he,[W]:J}:he);return{...re,nodeDetails:{...re.nodeDetails,[D]:{...re.nodeDetails[D],rows:me}}}})}function Wa(){D&&I(R=>({...R,nodeDetails:{...R.nodeDetails,[D]:{...R.nodeDetails[D],rows:[...R.nodeDetails[D].rows,{key:"newKey",value:"newValue"}]}}}))}function Ja(R){D&&I(W=>({...W,nodeDetails:{...W.nodeDetails,[D]:{...W.nodeDetails[D],rows:W.nodeDetails[D].rows.filter((J,re)=>re!==R)}}}))}function qa(R,W){I(J=>({...J,nodes:J.nodes.map(re=>re.id===R?{...re,x:Math.round(W.x),y:Math.round(W.y)}:re)}))}function Ha(){const R=_.nodes.length,W=Ns(R);I(J=>({...J,nodes:[...J.nodes,W],nodeDetails:{...J.nodeDetails,[W.id]:Zr(W)},stats:J.stats.map(re=>re.label==="Journey nodes"?{...re,value:String(J.nodes.length+1)}:re)})),xt(W.id)}function Ga(R){I(W=>{const J=W.nodes.filter(he=>he.id!==R),re=W.edges.filter(he=>he.from!==R&&he.to!==R),me={...W.nodeDetails};return delete me[R],{...W,nodes:J,edges:re,nodeDetails:me,stats:W.stats.map(he=>he.label==="Journey nodes"?{...he,value:String(J.length)}:he)}}),Cn()}function Ka(){var me;const R=ys(_.nodes,_.edges.length),W=D??R.from,J=((me=_.nodes.find(he=>he.id!==W))==null?void 0:me.id)??R.to,re={...R,from:W,to:J};I(he=>({...he,edges:[...he.edges,re]})),ft(re.id)}function Ua(R,W){k&&I(J=>({...J,edges:J.edges.map(re=>re.id===k?{...re,[R]:W}:re)}))}function Va(R){I(W=>({...W,edges:W.edges.filter(J=>J.id!==R)})),Cn()}function Ya(){if(D){Ga(D);return}k&&Va(k)}async function bt(R,W,J){for(const re of R)W(re),await an(J)}async function Xa(R){if(!R){g(W=>({...W,journeyCategory:"",journeyType:""}));return}g(W=>({...W,journeyCategory:R,journeyType:""}))}async function Qa(R){if(!R){gt("journeyType","");return}const W=await t.selectJourney(R);ht(W.blueprint,W.journey)}async function Za(){var R,W;de(!0);try{let J=js({prompt:w.current.brief,blueprintForm:w.current,blueprintNodes:z.current.nodes,blueprintEdges:z.current.edges,blueprintNodeDetails:z.current.nodeDetails,journeyForm:ne.current,blueprintStats:z.current.stats}),re=z.current.phaseHeaders;if(J.blueprintForm.orchestrationType==="single-touchpoint"){const tn=ws({blueprintForm:{...J.blueprintForm,...Number.isFinite((R=J.adjustments)==null?void 0:R.waitDays)?{singleSendOffsetHours:Math.max(0,Math.min(168,Number(J.adjustments.waitDays)*24))}:{}},journeyForm:J.journeyForm,blueprintStats:z.current.stats});J={...J,blueprintForm:tn.blueprintForm,journeyForm:tn.journeyForm,nodes:tn.nodes,edges:tn.edges,nodeDetails:tn.nodeDetails,stats:tn.stats},re=tn.phaseHeaders}const me={...z.current,phaseHeaders:re,nodes:J.nodes,edges:J.edges,nodeDetails:J.nodeDetails,stats:J.stats};w.current=J.blueprintForm,ne.current=J.journeyForm,z.current=me;const he={form:J.blueprintForm,phaseHeaders:me.phaseHeaders,nodes:me.nodes,edges:me.edges,nodeDetails:Rn(me.nodeDetails)},[Ee]=await Promise.all([t.generateBlueprint(he),bt(z.current.progress,xe,420)]);g(J.blueprintForm),j(J.journeyForm),I({...Ee,stats:J.stats}),q(!1),fe.current=((W=J.blueprintForm)==null?void 0:W.brief)??""}finally{de(!1)}}async function es(){const R=L.trim();if(!(!R||!dn||!u.journeyType)){V(!0);try{const W=await t.saveJourneyAsNew({categoryId:u.journeyCategory,categoryName:dn.name,categoryDescription:dn.description,subCategoryId:(Fe==null?void 0:Fe.subCategoryId)??u.journeyCategory,subCategoryName:(Fe==null?void 0:Fe.subCategoryName)??dn.name,clientTag:(Fe==null?void 0:Fe.clientTag)??"",name:R,form:u,phaseHeaders:_.phaseHeaders,nodes:_.nodes,edges:_.edges,nodeDetails:Rn(_.nodeDetails),journeyForm:v});ht(W.blueprint,W.journey)}finally{V(!1)}}}async function ns(){se(!0);try{const[R]=await Promise.all([t.generateJourneyConfig(v),bt(x.progress,Be,420)]);S(R)}finally{se(!1)}m.startTransition(()=>f("qa"))}async function ts(){const R=ue.current+1;ue.current=R;const W=xn.current;if(N(!1),H("sending"),await an(Yr),ue.current===R){if(xn.current===W){G.current=W,N(!0),H("ready");return}H("idle"),N(!1)}}async function as(){if(!G.current)return;const R=ue.current+1;ue.current=R;const W=xn.current,J=Date.now(),re=nt(U);N(!0),H("activating");try{const me=await Aa(`${et}/send-to-ajo`,{journeyPayload:{sourceSystem:re}}),he=Date.now()-J,Ee=Math.max(0,Ft-he);if(Ee>0&&await an(Ee),!(me!=null&&me.sent))throw new Error("Send to AJO returned an unsuccessful response.")}catch(me){const he=Date.now()-J,Ee=Math.max(0,Ft-he);if(Ee>0&&await an(Ee),ue.current!==R)return;console.error("Failed to activate journey in AJO.",me),H("ready");return}if(ue.current===R){if(xn.current===W){G.current=W,N(!0),H("sent");return}H("idle"),N(!1),G.current=""}}async function ss(){je(!0),E(null),C(R=>R.map(W=>({...W,status:"idle"})));try{const R=await t.runAllSuites();for(const W of R.results)C(J=>J.map(re=>re.id===W.suiteId?{...re,status:"running"}:re)),await an(W.durationMs),C(J=>J.map(re=>re.id===W.suiteId?{...re,status:W.status}:re)),await an(200);E(R.score)}finally{je(!1)}}async function is(R){te.current+=1;const W=te.current;Y(R),b({steps:[],running:!0,summaryTone:"teal",summaryText:""});const J=await t.runProfileSimulation(R,v);if(W!==te.current)return;b({profile:J.profile,steps:[],running:!0,summaryTone:J.summaryTone,summaryText:J.summaryText});const re=[];for(const me of J.steps){if(await an(380),W!==te.current)return;re.push(me),b({profile:J.profile,steps:[...re],running:!0,summaryTone:J.summaryTone,summaryText:J.summaryText})}b({profile:J.profile,steps:J.steps,running:!1,summaryTone:J.summaryTone,summaryText:J.summaryText})}function Fn(R){if(d){d(R);return}m.startTransition(()=>c(R))}return e.jsxs(_a,{activeRoute:o,meta:n.meta,routes:n.routes,sections:n.sections,embedded:s,showSidebar:i,onRouteChange:Fn,children:[o==="bp"?e.jsx(Br,{data:_,form:u,busy:Z,progress:K,generateLabel:F?"Regenerate flowchart":"Generate Flowchart",selectedNode:Ce,selectedEdge:pe,selectedDetail:Pe,activatedSegments:oe,filteredJourneyOptions:cn,onSelectNode:xt,onSelectEdge:ft,onClearSelection:Cn,onFormChange:gt,onJourneyCategoryChange:Xa,onJourneyTypeChange:Qa,onGenerate:Za,onSendConfig:()=>{f("audience"),Fn("cfg")},onOpenQa:()=>Fn("qa"),isDirty:Pa,saveName:L,saveBusy:ie,onSaveNameChange:y,onSaveJourney:es,onAddNode:Ha,onBackToCampaignManager:d?()=>d("campaigns"):null,onAddEdge:Ka,onDeleteSelection:Ya,onNodeFieldChange:La,onNodeLineChange:Oa,onDetailChange:Ba,onDetailRowChange:Fa,onAddDetailRow:Wa,onRemoveDetailRow:Ja,onNodeMove:qa,onEdgeFieldChange:Ua}):null,o==="cfg"?e.jsx(Gr,{data:x,form:v,tab:l,busy:Q,progress:we,platform:u.platform,orchestrationType:u.orchestrationType,singleTouchpoint:u,sendState:ve,showActivationCard:P,journeyId:u.journeyType||null,onTabChange:R=>m.startTransition(()=>f(R)),onFormChange:Ma,onToggleChannel:Ta,onGenerate:ns,onSend:ts,onActivate:as}):null,o==="qa"?e.jsx(Vr,{profiles:n.qa.profiles,suites:T,suiteScore:B,runAllBusy:le,selectedProfileId:A,profileRun:ae,automationPlaybook:n.qa.automationPlaybook,sourceLabel:n.qa.sourceLabel,onRunAll:ss,onSelectProfile:is}):null]})}function tl({activatedSegments:n=[],forcedRoute:t="bp",showSidebar:s=!1,onRouteRequest:a,initialJourneySlug:r=null}){const[i,d]=m.useState(In()),[p,o]=m.useState(Ke),[c,l]=m.useState(An),[f,u]=m.useState([]),[g,v]=m.useState(()=>nt()),[j,_]=m.useState(!0),I=m.useRef(i),x=m.useRef(p),S=m.useRef(c),T=m.useRef(!1);m.useEffect(()=>{I.current=i},[i]),m.useEffect(()=>{x.current=p},[p]),m.useEffect(()=>{S.current=c},[c]),m.useEffect(()=>{const E=D=>{const h=D!=null&&D.detail?vn(D.detail,g):nt(g);v(k=>k===h?k:h)};return window.addEventListener("focus",E),window.addEventListener("storage",E),window.addEventListener("cdp-source-system-change",E),()=>{window.removeEventListener("focus",E),window.removeEventListener("storage",E),window.removeEventListener("cdp-source-system-change",E)}},[g]),m.useEffect(()=>{let E=!0;const D=new AbortController;_(!0),T.current=!1;const h=In();x.current=Ke,S.current=An,o(Ke),l(An),u([]),d(h);async function k(){try{const $=await Qr(`${et}/bootstrap?source_system=${encodeURIComponent(g)}`,{signal:D.signal});if(!E)return;const A=Array.isArray($.journeys)&&$.journeys.length?bs($.journeys):Ke,Y=Array.isArray($.customSegments)?$.customSegments:[],ae=Jt(An,Y),b=Array.isArray($.activatedSegments)?$.activatedSegments:[];x.current=A,S.current=ae,o(A),l(ae),u(b),d(L=>{const y=In();return{...y,segmentSourceUrl:$.defaultSegmentSourceUrl??L.segmentSourceUrl,campaignsJourneysReport:$.campaignsJourneysReport??y.campaignsJourneysReport}})}catch($){if(!E||($==null?void 0:$.name)==="AbortError")return;console.error("Unable to load copilot bootstrap from Flask.",$)}finally{E&&_(!1)}}return k(),()=>{E=!1,D.abort()}},[g]);const C=un({...i,availableJourneys:p,availableSegments:c}),B=m.useMemo(()=>Jt(f.filter(E=>qt(E,g)),(n??[]).filter(E=>qt(E,g))),[f,n,g]);if(j)return e.jsx(el,{embedded:!0,showSidebar:s,message:"Loading Activation workspace, saved journeys, and custom audience segments."});if(r&&!T.current){T.current=!0;let E=r.startsWith("ai-generated-")?(()=>{try{const D=JSON.parse(sessionStorage.getItem("ai_generated_journey")||"null");return D&&D.slug===r?D:JSON.parse(localStorage.getItem("ai_generated_journeys")||"[]").find(k=>k.slug===r)||null}catch{return null}})():null;if(E||(E=yt(r,x.current)),E){E._aiGenerated&&!x.current.find(k=>k.slug===E.slug)&&(x.current=[E,...x.current]);const D=Array.isArray(E.nodes)&&E.nodes.length>0,h={...I.current,blueprintForm:E.blueprintForm,blueprintPhaseHeaders:E.phaseHeaders,journeyForm:E.journeyForm,blueprintNodes:E.nodes,blueprintEdges:E.edges,blueprintNodeDetails:E.nodeDetails,selectedJourneySlug:E.slug,blueprintGenerated:D,blueprintGeneratedAt:D?Date.now():void 0,journeyGenerated:!1};I.current=h,d(h)}}return e.jsx(nl,{bootstrap:C,embedded:!0,initialRoute:t,forcedRoute:t,showSidebar:s,onRouteRequest:a,externalActivatedSegments:B,actions:{selectJourney:async E=>{const D=yt(E,x.current),h={...I.current,blueprintForm:D.blueprintForm,blueprintPhaseHeaders:D.phaseHeaders,journeyForm:D.journeyForm,blueprintNodes:D.nodes,blueprintEdges:D.edges,blueprintNodeDetails:D.nodeDetails,selectedJourneySlug:D.slug,blueprintGenerated:!1,journeyGenerated:!1};I.current=h,d(h);const k=un({...h,availableJourneys:x.current,availableSegments:S.current});return{blueprint:k.blueprint,journey:k.journey}},generateBlueprint:async({form:E,phaseHeaders:D,nodes:h,edges:k,nodeDetails:$})=>{const A={...I.current,blueprintForm:E,blueprintPhaseHeaders:D??I.current.blueprintPhaseHeaders,blueprintNodes:h,blueprintEdges:k,blueprintNodeDetails:$,selectedJourneySlug:E.journeyType,blueprintGenerated:!0,blueprintGeneratedAt:Date.now()};return I.current=A,d(A),un({...A,availableJourneys:x.current,availableSegments:S.current}).blueprint},saveJourneyAsNew:async({categoryId:E,categoryName:D,categoryDescription:h,subCategoryId:k,subCategoryName:$,clientTag:A,name:Y,form:ae,phaseHeaders:b,nodes:L,edges:y,nodeDetails:Z,journeyForm:de})=>{const Q=xs(Y,x.current),se=fs({categoryId:E,categoryName:D,categoryDescription:h,subCategoryId:k,subCategoryName:$,clientTag:A,slug:Q,name:Y,blueprintForm:ae,phaseHeaders:b,journeyForm:de,nodes:L,edges:y,nodeDetails:Z,isPreset:!1});await Aa(`${et}/journeys`,{journey:se});const ie=[...x.current,se],V={...I.current,blueprintForm:se.blueprintForm,blueprintPhaseHeaders:se.phaseHeaders,journeyForm:se.journeyForm,blueprintNodes:se.nodes,blueprintEdges:se.edges,blueprintNodeDetails:se.nodeDetails,selectedJourneySlug:se.slug,blueprintGenerated:!0,journeyGenerated:!0,blueprintGeneratedAt:Date.now(),journeyGeneratedAt:Date.now()};x.current=ie,I.current=V,o(ie),d(V);const le=un({...V,availableJourneys:ie,availableSegments:S.current});return{savedJourney:{slug:se.slug,name:se.name,isPreset:!1},blueprint:le.blueprint,journey:le.journey}},generateJourneyConfig:async E=>{const D={...I.current,journeyForm:E,journeyGenerated:!0,journeyGeneratedAt:Date.now()};return I.current=D,d(D),un({...D,availableJourneys:x.current,availableSegments:S.current}).journey},runAllSuites:async()=>{const E=gs(C.qa.sourceSystem),D={...I.current,suiteStatuses:E.results.map(h=>({suiteId:h.suiteId,status:h.status})),suiteScore:E.score,lastRunAt:Date.now()};return I.current=D,d(D),E},runProfileSimulation:async(E,D)=>hs(E,D,C.qa.sourceSystem)}},g)}function qe(n){return Array.isArray(n)?n:[]}function M(n){if(n==null||n==="")return null;const t=Number(n);return Number.isFinite(t)&&t>=0?t:null}function O(n){return Se(n,"N/A")}function Oe(n){return ot(n,"N/A")}function ee(n){return Ze(n,1,"N/A")}function Ne(n,t=!1){return vi(n,t,"N/A")}function Nn(n,t){return be(n,t)??0}function Un(n,t){return!!n&&Object.prototype.hasOwnProperty.call(n,t)}async function al(n,t){const s=await fetch(n,{signal:t,headers:{Accept:"application/json"}}),a=await s.json().catch(()=>null);if(!s.ok)throw new Error((a==null?void 0:a.error)||(a==null?void 0:a.message)||`Request failed (${s.status})`);return a}function Ye({children:n="No measured rows are available."}){return e.jsx("div",{className:"rp-inline-empty",children:n})}function He({label:n="Explain ↗",onClick:t}){return e.jsx("button",{type:"button",className:"rp-cj-explain-action",onClick:t,children:n})}function sl({primaryKeys:n=[],optionalKeys:t=[],weights:s={},selector:a=null,children:r}){const i=new Map(Vn.Children.toArray(r).filter(p=>Vn.isValidElement(p)&&p.props.reportKey).map(p=>[p.props.reportKey,p])),d=(p,o)=>{const c=p.filter(g=>i.has(g));if(!c.length)return null;if(o==="primary")return e.jsx("div",{className:"rp-cj-paired-grid","data-report-group":"primary",children:c.map((g,v)=>e.jsx("div",{className:"rp-cj-report-slot","data-report-key":g,style:{order:v},children:i.get(g)},`primary-${g}`))});const l=[[],[]],f=[0,0];c.forEach((g,v)=>{const j=f[0]<=f[1]?0:1,_=Number(s[g])||1;l[j].push({key:g,index:v}),f[j]+=_});const u=g=>e.jsx("div",{className:"rp-cj-report-column",children:l[g].map(v=>e.jsx("div",{className:"rp-cj-report-slot","data-report-key":v.key,style:{order:v.index},children:i.get(v.key)},`${o}-${v.key}`))});return e.jsxs("div",{className:"rp-cj-natural-columns","data-report-group":o,children:[u(0),u(1)]})};return e.jsxs(e.Fragment,{children:[d(n,"primary"),a,d(t,"optional")]})}function il({sent:n,summary:t,conversionRate:s,onExplain:a}){const r=[["Target Population",n,Oe(n),"Reported sends · repeat recipients possible",X.blue,"sends"],["Open rate",t.open_rate,ee(t.open_rate),"Opened / delivered",X.cyan,"open_rate"],["Click rate",t.click_rate,ee(t.click_rate),"Clicked / delivered",X.violet,"click_rate"],["Conversion rate",s,ee(s),"Converted / sent",X.magenta,"conversion_rate"]].filter(([,i])=>M(i)!==null);return r.length?e.jsx("section",{className:"rp-cj-analytics","aria-label":"Journey analytics headline measures",children:r.map(([i,,d,p,o,c])=>e.jsxs("article",{style:{"--rp-signal":o},children:[e.jsx("span",{children:i}),e.jsx("b",{children:d}),e.jsx("small",{children:p}),e.jsx("button",{type:"button",className:"rp-cj-analytics-evidence","aria-label":`Explain ${i}`,onClick:()=>a==null?void 0:a(c),children:"Evidence"})]},i))}):null}function rl({rows:n,sent:t}){if(!n.length)return e.jsx(Ye,{children:"No journey funnel outcome evidence is available for this source."});const s=M(t)??n[0].value,a=998,r=142,i=12,d=a-i*2-r,p=n.map((o,c)=>i+(n.length===1?0:d*c/(n.length-1)));return e.jsx("div",{className:"rp-cj-flow-wrap",children:e.jsxs("svg",{className:"rp-cj-flow-svg",viewBox:"0 0 998 285",role:"img","aria-label":"Customer Journey Funnel",children:[e.jsx("line",{className:"rp-cj-flow-guide",x1:"12",y1:"263",x2:"986",y2:"263"}),n.slice(1).map((o,c)=>{const l=p[c]+r,f=p[c+1],u=Nn(o.value,s);return e.jsxs("g",{style:{"--rp-signal":o.color,"--rp-delay":`${c*120}ms`},children:[e.jsx("path",{className:"rp-cj-flow-link",d:`M${l},113 C${l+25},113 ${f-25},113 ${f},113`,style:{"--rp-width":Math.min(30,7+u*.22)}}),e.jsx("path",{className:"rp-cj-flow-core",d:`M${l},113 C${l+25},113 ${f-25},113 ${f},113`})]},`link-${o.label}`)}),n.map((o,c)=>{const l=c?n[c-1].value:s,f=c?be(o.value,l):100;return e.jsxs("g",{className:"rp-cj-flow-node",style:{"--rp-signal":o.color,"--rp-delay":`${120+c*100}ms`},children:[e.jsx("rect",{x:p[c],y:"72",width:r,height:"82",rx:"13"}),e.jsx("text",{className:"rp-cj-stage-name",x:p[c]+15,y:"94",children:o.label}),e.jsx("text",{className:"rp-cj-stage-count",x:p[c]+15,y:"120",children:ot(o.value)}),e.jsx("text",{className:"rp-cj-stage-rate",x:p[c]+15,y:"141",children:c?`${ee(f)} of prior stage`:"Funnel entry"})]},o.label)}),n.slice(1).map((o,c)=>{const l=n[c],f=Math.max(l.value-o.value,0),u=be(f,l.value),g=(p[c]+r+p[c+1])/2,v=194+c%2*32;return e.jsxs("g",{className:"rp-cj-drop",children:[e.jsx("line",{x1:g,y1:"155",x2:g,y2:v}),e.jsx("rect",{x:g-43,y:v,width:"86",height:"25",rx:"7"}),e.jsxs("text",{x:g,y:v+16,textAnchor:"middle",children:["−",Oe(f)," · ",ee(u)]})]},`drop-${o.label}`)})]})})}function ll({rows:n,sent:t}){if(!n.length)return e.jsx(Ye,{children:"No channel distribution is available for this source."});const s=n.slice().sort((d,p)=>p.value-d.value),a=s.reduce((d,p)=>d+p.value,0);if(a<=0)return e.jsx(Ye,{children:"Channel share is N/A because the supplied channel counts do not contain a positive represented total."});const r=M(t);let i=0;return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"rp-cj-channel-layout",children:[e.jsxs("div",{className:"rp-cj-channel-ring",children:[e.jsxs("svg",{viewBox:"0 0 176 176","aria-label":"Channel mix",children:[e.jsx("circle",{cx:"88",cy:"88",r:"62",pathLength:"100",className:"rp-cj-channel-track"}),s.map((d,p)=>{const o=Nn(d.value,a),c=i;return i-=o,e.jsx("circle",{cx:"88",cy:"88",r:"62",pathLength:"100",className:"rp-cj-channel-arc",style:{"--rp-signal":d.color,"--rp-dash":o,"--rp-offset":c,"--rp-delay":`${p*110}ms`},children:e.jsxs("title",{children:[d.label,": ",Se(d.value)," (",Ze(o),")"]})},d.label)})]}),e.jsxs("div",{children:[e.jsx("b",{children:Oe(r??a)}),e.jsx("span",{children:r===null?"Represented sends":"Total sends"})]})]}),e.jsx("div",{className:"rp-cj-channel-rank",children:s.map(d=>e.jsxs("div",{style:{"--rp-signal":d.color},children:[e.jsx("i",{}),e.jsxs("span",{children:[e.jsx("strong",{children:d.label}),e.jsxs("small",{children:[Se(d.value)," sends"]})]}),e.jsx("b",{children:ee(be(d.value,a))})]},d.label))})]}),e.jsxs("p",{className:"rp-cj-caption",children:[e.jsx("strong",{children:"Largest channel:"})," ",s[0].label," at ",ee(be(s[0].value,a))," (",O(s[0].value)," sends)."]})]})}function ol({campaigns:n,summary:t,coverage:s={},onExplain:a}){const r=M(t.revenue),i=M(t.total_sent),d=r!==null&&i!==null&&i>0?r/i*1e3:null,p=n.map((u,g)=>{const v=M(u.revenue),j=M(u.sent);return v===null||j===null||j<=0?null:{...u,index:g,revenue:v,sent:j,efficiency:v/j*1e3}}).filter(Boolean).sort((u,g)=>g.efficiency-u.efficiency);if(!p.length)return e.jsx(Ye,{children:"Revenue efficiency is unavailable because no supplied campaign outcome row contains both revenue and a positive send count."});const o=Math.max(...d===null?[]:[d],...p.map(u=>u.efficiency),1),c=Math.ceil(o/100)*100,l=d===null?null:be(d,c),f={Email:X.blue,Push:X.cyan,"In-App":X.violet,SMS:X.green,WhatsApp:X.green,Call:X.amber};return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"rp-cj-value-board",children:[e.jsxs("div",{className:"rp-cj-value-axis",children:[e.jsx("span",{children:"Campaign outcome evidence for journey reporting"}),e.jsxs("div",{children:[l!==null&&e.jsxs("i",{style:{left:`${l}%`},children:["Benchmark ",Ne(d)]}),e.jsx("b",{style:{left:0},children:"0"}),e.jsx("b",{style:{left:"100%"},children:Ne(c)})]}),e.jsx("span",{children:"Attributed revenue / 1K sends"})]}),p.map((u,g)=>{const v=f[u.channel]||Object.values(X)[g%Object.values(X).length];return e.jsxs("article",{className:String(u.status).toLowerCase()==="paused"?"is-paused":"",style:{"--rp-signal":v,"--rp-delay":`${g*90}ms`},children:[e.jsxs("div",{className:"rp-cj-value-label",children:[e.jsx("strong",{title:u.campaign,children:u.campaign}),(u.channel||u.status)&&e.jsx("span",{children:[u.channel,u.status].filter(Boolean).join(" · ")}),[u.open_rate,u.click_rate,u.bounce_rate].some(j=>M(j)!==null)&&e.jsxs("div",{children:[M(u.open_rate)!==null&&e.jsxs("small",{children:["Open ",e.jsx("b",{children:ee(u.open_rate)})]}),M(u.click_rate)!==null&&e.jsxs("small",{children:["Click ",e.jsx("b",{children:ee(u.click_rate)})]}),M(u.bounce_rate)!==null&&e.jsxs("small",{children:["Bounce ",e.jsx("b",{children:ee(u.bounce_rate)})]})]})]}),e.jsx("button",{type:"button",className:`rp-cj-value-track${l===null?" has-no-benchmark":""}`,style:l===null?void 0:{"--rp-benchmark":`${l}%`},title:`${u.campaign}: ${Ne(Math.round(u.efficiency))} attributed revenue per 1,000 sends`,"aria-label":`Explain ${u.campaign} attributed revenue efficiency`,onClick:()=>a==null?void 0:a(u),children:e.jsx("i",{style:{"--rp-value":`${Nn(u.efficiency,c)}%`}})}),e.jsxs("div",{className:"rp-cj-value-result",children:[e.jsxs("b",{children:[Ne(Math.round(u.efficiency))," / 1K"]}),e.jsxs("small",{children:[Ne(u.revenue,!0)," attributed · ",Oe(u.sent)," sends"]})]})]},u.campaign_id||u.campaign)})]}),e.jsxs("p",{className:"rp-cj-caption",children:[e.jsxs("strong",{children:["Efficiency leader among the ",p.length," measurable campaign outcome rows:"]})," ",p[0].campaign," at ",Ne(Math.round(p[0].efficiency))," attributed revenue per 1,000 sends. These campaign-grain outcomes are supporting evidence for journey reporting; they cover ",ee(s.campaign_send_pct)," of sends and ",ee(s.campaign_revenue_pct)," of attributed revenue and are not journey-level ROI or causal lift."]})]})}function cl(n,t){const s=n.map(i=>i.value),a=Math.min(...s),r=Math.max(...s);return n.map(({value:i,index:d})=>{const p=d*360/Math.max(t-1,1),o=51-(i-a)*42/Math.max(r-a,1);return`${p.toFixed(1)},${o.toFixed(1)}`})}function dl({rows:n,source:t}){if(!n.length)return e.jsx(Ye,{children:"No sampled engagement observations are available."});const s=[["Delivered","delivered",X.blue],["Opened","opened",X.cyan],["Clicked","clicked",X.magenta]].map(([a,r,i])=>({label:a,key:r,color:i,observations:n.map((d,p)=>({index:p,value:M(d[r])})).filter(d=>d.value!==null)})).filter(a=>a.observations.length);return s.length?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"rp-cj-pulse-stack",children:s.map(({label:a,key:r,color:i,observations:d},p)=>{const o=d.map(f=>f.value),c=cl(d,n.length),l=`rp-cj-pulse-${t}-${r}`;return e.jsxs("div",{className:"rp-cj-pulse-row",style:{"--rp-signal":i,"--rp-delay":`${p*120}ms`},children:[e.jsxs("div",{children:[e.jsx("strong",{children:a}),e.jsx("span",{children:"Independent scale"})]}),e.jsxs("svg",{viewBox:"0 0 360 58",preserveAspectRatio:"none","aria-label":`${a} sampled trend`,children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:l,x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{stopColor:i,stopOpacity:".72"}),e.jsx("stop",{offset:"1",stopColor:i,stopOpacity:"0"})]})}),e.jsx("path",{className:"rp-cj-pulse-area",d:`M0,58 L${c.join(" L")} L360,58 Z`,style:{fill:`url(#${l})`}}),e.jsx("polyline",{className:"rp-cj-pulse-line",points:c.join(" ")})]}),e.jsxs("b",{children:[Oe(o.at(-1)),e.jsxs("small",{children:[Oe(Math.min(...o)),"–",Oe(Math.max(...o))]})]})]},r)})}),e.jsx("div",{className:"rp-cj-pulse-axis",children:n.map((a,r)=>e.jsx("span",{children:a.label},`${a.label}-${r}`))}),e.jsxs("p",{className:"rp-cj-caption",children:[e.jsx("strong",{children:"Sampled observations:"})," the points show direction and are not summed into headline totals."]})]}):e.jsx(Ye,{children:"No measured delivered, opened, or clicked observations are available."})}function ul({campaigns:n}){if(!n.length)return null;const t=[["Delivery",a=>M(a.delivered_rate)??be(a.delivered,a.sent),X.green,a=>ee(a)],["Open",a=>M(a.open_rate),X.cyan,a=>ee(a)],["Click",a=>M(a.click_rate),X.blue,a=>ee(a)],["Bounce",a=>M(a.bounce_rate),X.amber,a=>ee(a)],["Revenue",a=>M(a.revenue),X.violet,a=>Ne(a,!0)]].filter(([,a])=>n.every(r=>a(r)!==null));if(!t.length)return null;const s=t.map(([,a])=>{const r=n.map(a).filter(i=>i!==null);return r.length?[Math.min(...r),Math.max(...r)]:[null,null]});return e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"rp-cj-heatmap-scroll",children:e.jsxs("div",{className:"rp-cj-heatmap",children:[e.jsx("div",{className:"rp-cj-heat-head",children:"Campaign evidence"}),t.map(([a])=>e.jsx("div",{className:"rp-cj-heat-head",children:a},a)),n.map((a,r)=>e.jsxs(Vn.Fragment,{children:[e.jsxs("div",{className:"rp-cj-heat-label",children:[e.jsx("strong",{children:a.campaign}),(a.channel||a.status)&&e.jsx("small",{children:[a.channel,a.status].filter(Boolean).join(" · ")})]}),t.map(([i,d,p,o],c)=>{const l=d(a),[f,u]=s[c],g=l!==null&&f!==null&&u!==null,v=g?(l-f)/Math.max(u-f,1):null;return e.jsx("div",{className:`rp-cj-heat-cell${g?"":" is-unavailable"}`,style:g?{"--rp-signal":p,"--rp-intensity":`${14+v*30}%`,"--rp-delay":`${(r*t.length+c)*25}ms`}:{"--rp-delay":`${(r*t.length+c)*25}ms`},children:o(l)},`${a.campaign}-${i}`)})]},a.campaign_id||a.campaign))]})}),e.jsxs("p",{className:"rp-cj-caption",children:[e.jsx("strong",{children:"Color intensity is column-relative:"})," compare supplied campaigns within a metric and use the printed value for exact interpretation."]})]})}function pl({catalog:n}){const t=Math.max(...n.touchpointDistribution.map(a=>a.value),1),s=n.triggerTypes.reduce((a,r)=>a+r.value,0);return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"rp-cj-data-note rp-cj-provenance-note",children:[e.jsx("strong",{children:"Definition provenance:"})," ",n.provenance,"."," ","Only measured API catalog fields are displayed."]}),e.jsxs("div",{className:"rp-cj-library",children:[n.triggerTypes.length>0&&e.jsxs("div",{children:[e.jsx("span",{className:"rp-cj-library-subtitle",children:"Definitions by trigger type"}),n.triggerTypes.length?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"rp-cj-library-bar",children:n.triggerTypes.map((a,r)=>e.jsx("i",{style:{"--rp-share":`${Nn(a.value,s)}%`,"--rp-signal":a.color,"--rp-delay":`${r*100}ms`}},a.label))}),e.jsx("div",{className:"rp-cj-library-legend",children:n.triggerTypes.map(a=>e.jsxs("div",{style:{"--rp-signal":a.color},children:[e.jsx("i",{}),e.jsx("span",{children:a.label}),e.jsxs("b",{children:[Se(a.value)," · ",ee(be(a.value,s))]})]},a.label))})]}):e.jsx(Ye,{children:"Trigger-type distribution is N/A in the selected definition catalog."})]}),n.touchpointDistribution.length>0&&e.jsxs("div",{children:[e.jsx("span",{className:"rp-cj-library-subtitle",children:"Definitions by touchpoint count"}),n.touchpointDistribution.length?e.jsx("div",{className:"rp-cj-touchpoints",children:n.touchpointDistribution.map((a,r)=>e.jsxs("i",{style:{"--rp-height":`${Math.max(4,Nn(a.value,t))}%`,"--rp-delay":`${r*80}ms`},children:[e.jsx("b",{children:Se(a.value)}),e.jsx("span",{children:a.label})]},a.label))}):e.jsx(Ye,{children:"Touchpoint distribution is N/A in the selected definition catalog."})]})]}),e.jsxs("div",{className:"rp-cj-data-note",children:[e.jsxs("strong",{children:[O(n.presetDefinitions)," preset files + ",O(n.customDefinitions)," saved custom journey."]})," ",O(n.readyDefinitions)," presets are READY; the active flag exists on ",O(n.activeFlagCoverage),"/",O(n.presetDefinitions),"."]})]})}function ml({catalog:n,source:t}){const s=n.experiment;if(!(s!=null&&s.hasSplit)||s.holdout===null||s.treatment===null||s.split===null)return null;const a=`${s.holdout}%`,r=`${s.treatment}%`,i=`${s.split}%`,d=`${100-s.split}%`,p=s.originCategory||"Global catalog",c=String(p).trim().toLowerCase()===String(t).trim().toLowerCase()?`${p} saved custom configuration`:`${p} saved custom configuration in the global catalog`,l=s.declaredEvents.length,f=l?s.declaredEvents.join(", "):"configured outcome signals";return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"rp-cj-experiment-wrap",children:[e.jsx("div",{className:"rp-cj-experiment-scroll",children:e.jsxs("svg",{className:"rp-cj-experiment",viewBox:"0 0 760 270",role:"img","aria-label":"Configured experiment routing",children:[e.jsx("path",{className:"rp-cj-exp-link",d:"M155 132 C185 132 190 51 220 51",style:{"--rp-signal":X.amber,"--rp-width":8,"--rp-delay":"50ms"}}),e.jsx("path",{className:"rp-cj-exp-link-core",d:"M155 132 C185 132 190 51 220 51",style:{"--rp-signal":X.amber}}),e.jsx("path",{className:"rp-cj-exp-link",d:"M155 132 C185 132 190 190 220 190",style:{"--rp-signal":X.blue,"--rp-width":21,"--rp-delay":"120ms"}}),e.jsx("path",{className:"rp-cj-exp-link-core",d:"M155 132 C185 132 190 190 220 190",style:{"--rp-signal":X.blue}}),e.jsx("path",{className:"rp-cj-exp-link",d:"M355 190 C385 190 397 137 430 137",style:{"--rp-signal":X.cyan,"--rp-width":11,"--rp-delay":"200ms"}}),e.jsx("path",{className:"rp-cj-exp-link-core",d:"M355 190 C385 190 397 137 430 137",style:{"--rp-signal":X.cyan}}),e.jsx("path",{className:"rp-cj-exp-link",d:"M355 190 C385 190 397 224 430 224",style:{"--rp-signal":X.violet,"--rp-width":11,"--rp-delay":"270ms"}}),e.jsx("path",{className:"rp-cj-exp-link-core",d:"M355 190 C385 190 397 224 430 224",style:{"--rp-signal":X.violet}}),e.jsx("path",{className:"rp-cj-exp-link",d:"M565 137 C590 137 595 180 620 180",style:{"--rp-signal":X.magenta,"--rp-width":5,"--rp-delay":"340ms"}}),e.jsx("path",{className:"rp-cj-exp-link",d:"M565 224 C590 224 595 180 620 180",style:{"--rp-signal":X.magenta,"--rp-width":5,"--rp-delay":"390ms"}}),[[20,99,135,66,"ROUTED DESIGNS",O(n.variantDefinitions),"variant-defined",X.green,!0],[220,20,135,62,"CONTROL HOLDOUT",a,"configured",X.amber,!1],[220,159,135,62,"TREATMENT PATH",r,"configured",X.blue,!1],[430,106,135,62,"VARIANT A",i,"of treatment",X.cyan,!1],[430,193,135,62,"VARIANT B",d,"of treatment",X.violet,!1],[620,144,120,72,"DECLARED EVENTS",O(l),"measurement plan",X.magenta,!0]].map(([u,g,v,j,_,I,x,S,T],C)=>e.jsxs("g",{className:"rp-cj-exp-node",style:{"--rp-signal":S,"--rp-delay":`${50+C*70}ms`},children:[e.jsx("rect",{x:u,y:g,width:v,height:j,rx:"13"}),e.jsx("text",{className:"rp-cj-exp-kicker",x:u+15,y:g+21,children:_}),e.jsx("text",{className:"rp-cj-exp-value",x:u+15,y:g+44,children:I}),e.jsx("text",{className:"rp-cj-exp-detail",x:T?u+15:u+54,y:T?g+59:g+44,children:x})]},_))]})}),e.jsx("div",{className:"rp-cj-proof-strip",children:[[n.variantDefinitions,"variant-defined journey definitions",X.green],...s.assignment?[[1,`saved routed split with ${s.assignment}`,X.cyan]]:[],[l,`declared events: ${f}`,X.violet]].filter(([u])=>M(u)!==null).map(([u,g,v])=>e.jsxs("div",{style:{"--rp-signal":v},children:[e.jsx("b",{children:O(u)}),e.jsx("span",{children:g})]},g))}),s.toggleOn===!1&&e.jsxs("div",{className:"rp-cj-exp-conflict",children:[e.jsxs("span",{children:[e.jsx("strong",{children:"Configuration conflict:"})," a routed split exists while the saved journey’s A/B toggle is off."]}),e.jsx("b",{children:"A/B toggle off · split present"})]})]}),e.jsxs("p",{className:"rp-cj-caption",children:[e.jsx("strong",{children:"Configured design, not a live result:"})," the ",a,"/",r," allocation,"," ",i,"/",d," treatment split",s.outcomeWindowHours!==null?`, ${s.outcomeWindowHours}-hour outcome window`:"",", and declared events come from the ",c,". They are not ",_e(t)," execution evidence. This design-readiness view makes no winner, lift, or significance claim."]})]})}function hl({campaigns:n,funnel:t}){const a=t.slice(1).map((p,o)=>{const c=t[o],l=Math.max(c.value-p.value,0);return{from:c.label,to:p.label,lost:l,rate:be(l,c.value)}}).filter(p=>p.rate!==null).slice().sort((p,o)=>o.rate-p.rate)[0],r=n.filter(p=>M(p.click_rate)!==null).sort((p,o)=>M(o.click_rate)-M(p.click_rate))[0],i=n.filter(p=>M(p.bounce_rate)!==null).sort((p,o)=>M(o.bounce_rate)-M(p.bounce_rate))[0],d=[a&&["P1","Repair the largest funnel loss",`${a.from} to ${a.to} loses ${ot(a.lost)} events, ${Ze(a.rate)} of its prior stage.`,`${Ze(a.rate)} loss`,X.magenta],r&&["P2",`Learn from ${r.campaign}`,`It leads the ${n.length} supplied campaign outcome rows at ${Ze(r.click_rate)} click rate. Use it as a controlled-test pattern for journey optimization.`,`${Ze(r.click_rate)} CTR`,X.green],i&&["P3",Number(i.bounce_rate)>=4?`Review ${i.campaign}`:"Protect delivery health",`${i.campaign} has the highest supplied-row bounce rate at ${Ze(i.bounce_rate)}. Validate eligibility and suppression.`,`${Ze(i.bounce_rate)} bounce`,X.amber]].filter(Boolean);return d.length?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"rp-cj-actions",children:d.map(([p,o,c,l,f])=>e.jsxs("article",{style:{"--rp-signal":f},children:[e.jsx("span",{children:p}),e.jsxs("div",{children:[e.jsx("strong",{children:o}),e.jsx("p",{children:c})]}),e.jsxs("b",{children:[l,e.jsx("small",{children:"Current artifact"})]})]},p))}),e.jsxs("div",{className:"rp-cj-data-note",children:[e.jsx("strong",{children:"Optimization guardrail:"})," actions prioritize supplied measured evidence; they do not promise statistical or causal lift."]})]}):e.jsx(Ye,{children:"No observed funnel or supporting outcome evidence is available for journey recommendations."})}function gl({campaigns:n,totalCampaigns:t,coverage:s={}}){const a=n.filter(i=>i==null?void 0:i.campaign);if(!a.length)return null;const r=[{key:"channel",label:"Channel",available:a.every(i=>!!i.channel),render:i=>i.channel},{key:"sent",label:"Sends",available:a.every(i=>M(i.sent)!==null),render:i=>O(i.sent)},{key:"delivery",label:"Delivery",available:a.every(i=>M(i.delivered_rate)!==null||be(i.delivered,i.sent)!==null),render:i=>ee(M(i.delivered_rate)??be(i.delivered,i.sent))},{key:"open",label:"Open",available:a.every(i=>M(i.open_rate)!==null),render:i=>ee(i.open_rate)},{key:"click",label:"Click",available:a.every(i=>M(i.click_rate)!==null),render:i=>ee(i.click_rate)},{key:"revenue",label:"Revenue",available:a.every(i=>M(i.revenue)!==null),render:i=>Ne(i.revenue)},{key:"bounce",label:"Bounce",available:a.every(i=>M(i.bounce_rate)!==null),render:i=>ee(i.bounce_rate)},{key:"status",label:"Status",available:a.every(i=>!!i.status),render:i=>{const d=String(i.status).toLowerCase()==="live"?X.green:X.amber;return e.jsx("span",{className:"rp-cj-status",style:{"--rp-signal":d},children:i.status})}}].filter(i=>i.available);return e.jsxs("div",{className:"rp-cj-table-wrap",children:[e.jsxs("table",{className:"rp-cj-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Campaign outcome / mapped journey"}),r.map(i=>e.jsx("th",{children:i.label},i.key))]})}),e.jsx("tbody",{children:a.map(i=>e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsx("strong",{children:i.campaign}),i.journey&&e.jsx("small",{children:i.journey})]}),r.map(d=>e.jsx("td",{children:d.render(i)},d.key))]},i.campaign_id||i.campaign))})]}),[t,s.campaign_row_pct,s.unallocated_sends,s.unallocated_revenue].every(i=>M(i)!==null)&&e.jsxs("p",{className:"rp-cj-caption",children:[e.jsx("strong",{children:"Evidence coverage:"})," ",Se(a.length)," detailed rows are supplied for ",O(t)," reported campaigns (",ee(s.campaign_row_pct),"). The residual is ",Oe(s.unallocated_sends)," sends and ",Ne(s.unallocated_revenue)," attributed revenue. This is a ranked subset, not the complete inventory."]})]})}function xl(){const n=mi("media"),[t,s]=m.useState({loading:!0,error:"",report:null}),[a,r]=m.useState(0),[i,d]=m.useState(null),[p,o]=m.useState([]);m.useEffect(()=>{d(null),o([])},[n]),m.useEffect(()=>{const b=new AbortController;let L=!0;return s(y=>({...y,loading:!0,error:""})),al(`/api/copilot/campaigns-journeys/report?source_system=${encodeURIComponent(n)}`,b.signal).then(y=>{if(L){if((y==null?void 0:y.source_system)!==n)throw new Error("The reporting API returned a different source system.");if(String((y==null?void 0:y.status)||"").toLowerCase()==="error")throw new Error((y==null?void 0:y.message)||"The journey reporting evidence could not be read.");if((y==null?void 0:y.data_available)===!1)throw new Error(`No journey reporting evidence is available for ${_e(n)}.`);if(!(y!=null&&y.summary)||!Object.keys(y.summary).length)throw new Error(`No journey reporting contract is available for ${_e(n)}.`);if(!(y!=null&&y.journey_catalog)||typeof y.journey_catalog!="object"||!Object.keys(y.journey_catalog).length)throw new Error("The journey definition catalog is missing from the reporting API contract.");s({loading:!1,error:"",report:y})}}).catch(y=>{!L||(y==null?void 0:y.name)==="AbortError"||s({loading:!1,error:(y==null?void 0:y.message)||"Unable to load journey reporting.",report:null})}),()=>{L=!1,b.abort()}},[n,a]);const c=m.useMemo(()=>{var ie;const b=(ie=t.report)==null?void 0:ie.journey_catalog;if(!b||typeof b!="object")return null;const L=[X.blue,X.cyan,X.violet,X.amber],y=b.custom_experiment,Z=qe(b.trigger_type_distribution),de=qe(b.touchpoint_distribution),Q=Z.length>0&&Z.every(V=>(V==null?void 0:V.label)&&M(V.value)!==null),se=de.length>0&&de.every(V=>(V==null?void 0:V.label)!==void 0&&M(V.value)!==null);return{provenance:"API journey catalog",presetDefinitions:M(b.preset_definitions),customDefinitions:M(b.custom_definitions),totalDefinitions:M(b.total_definitions),readyDefinitions:M(b.ready_definitions),activeFlagCoverage:M(b.active_flag_coverage),explicitlyActive:M(b.explicitly_active),variantPresetDefinitions:M(b.variant_preset_definitions),variantDefinitions:M(b.variant_definitions),triggerTypes:(Q?Z:[]).map((V,le)=>({label:V.label,value:M(V.value),color:L[le%L.length]})).filter(V=>V.label&&V.value!==null),touchpointDistribution:(se?de:[]).map(V=>{const le=String(V.label);return{label:`${le} touchpoint${le==="1"?"":"s"}`,value:M(V.value)}}).filter(V=>V.value!==null),experiment:y?{hasSplit:Un(y,"topology_present")?!!y.topology_present:null,toggleOn:Un(y,"ab_toggle")?!!y.ab_toggle:null,holdout:M(y.holdout_pct),treatment:M(y.treatment_pct),split:M(y.variant_a_pct),assignment:y.assignment||null,declaredEvents:String(y.declared_events||"").split(",").map(V=>V.trim()).filter(Boolean),originCategory:y.category||"Global catalog",outcomeWindowHours:M(y.outcome_window_hours),resultsAvailable:Un(y,"results_available")?!!y.results_available:null}:null}},[t.report]),l=m.useMemo(()=>{var q,oe,ge;const b=t.report||{},L=b.summary||{},y=qe(b.delivery_funnel),Z=["sent","delivered","opened","clicked","converted"],Q=y.length===Z.length&&y.every((K,xe)=>String((K==null?void 0:K.stage)||"").trim().toLowerCase()===Z[xe]&&M(K.value)!==null)?y.map((K,xe)=>({label:K.stage,value:M(K.value),color:[X.blue,X.cyan,X.violet,X.magenta,X.green][xe%5]})):[],se=Object.fromEntries(Q.map(K=>[String(K.label).toLowerCase(),K.value])),ie=qe(b.campaign_performance),V=M(L.total_sent)??M(se.sent),le=M(L.revenue),je=ie.map(K=>M(K.sent)).filter(K=>K!==null),ve=ie.map(K=>M(K.revenue)).filter(K=>K!==null),H=ie.length>0&&je.length===ie.length?je.reduce((K,xe)=>K+xe,0):null,P=ie.length>0&&ve.length===ie.length?ve.reduce((K,xe)=>K+xe,0):null,N=M(L.total_campaigns),F={campaign_rows:ie.length,total_campaigns:N,campaign_row_pct:be(ie.length,N),campaign_send_pct:be(H,V),campaign_revenue_pct:be(P,le),unallocated_sends:V===null||H===null?null:V>=H?Math.round(V-H):null,unallocated_revenue:le===null||P===null?null:le>=P?le-P:null,journey_rows:qe(b.journey_performance).length,total_journeys:M(L.total_journeys),journey_row_pct:be(qe(b.journey_performance).length,M(L.total_journeys))};return{summary:L,funnel:Q,funnelLookup:se,trend:qe(b.performance_trend).map(K=>({label:K.date,delivered:M(K.delivered),opened:M(K.opened),clicked:M(K.clicked)})).filter(K=>K.label&&[K.delivered,K.opened,K.clicked].some(xe=>xe!==null)),channels:qe(b.channel_mix).every(K=>(K==null?void 0:K.channel)&&M(K.count)!==null)?qe(b.channel_mix).map((K,xe)=>({label:K.channel,value:M(K.count),color:K.color||[X.blue,X.green,X.violet,X.amber][xe%4]})):[],campaigns:ie,detailCoverage:b.detail_coverage&&Object.keys(b.detail_coverage).length?b.detail_coverage:F,period:(q=b.date_range)!=null&&q.from&&((oe=b.date_range)!=null&&oe.to)?`${b.date_range.from} to ${b.date_range.to}`:((ge=b.date_range)==null?void 0:ge.label)||"Current artifact window"}},[t.report]),f=m.useMemo(()=>{var Z,de,Q,se,ie,V;const b=l.funnel.length>1,L=l.channels.reduce((le,je)=>le+(M(je.value)??0),0),y=l.campaigns.length>0;return{funnel:b,channels:l.channels.length>0&&L>0,valueEfficiency:l.campaigns.some(le=>M(le.sent)!==null&&M(le.sent)>0&&M(le.revenue)!==null),actions:b||l.campaigns.some(le=>M(le.click_rate)!==null||M(le.bounce_rate)!==null),trend:l.trend.length>0,comparison:y,templates:M(c==null?void 0:c.totalDefinitions)!==null&&((((Z=c==null?void 0:c.triggerTypes)==null?void 0:Z.length)||0)>0||(((de=c==null?void 0:c.touchpointDistribution)==null?void 0:de.length)||0)>0),experiment:!!((Q=c==null?void 0:c.experiment)!=null&&Q.hasSplit&&M((se=c==null?void 0:c.experiment)==null?void 0:se.holdout)!==null&&M((ie=c==null?void 0:c.experiment)==null?void 0:ie.treatment)!==null&&M((V=c==null?void 0:c.experiment)==null?void 0:V.split)!==null),details:y}},[l,c]),u=Object.entries(f).filter(([,b])=>b).map(([b])=>b).join("|");if(m.useEffect(()=>{const b=new Set(u.split("|").filter(Boolean)),L=new Set(["valueEfficiency","channels","funnel","actions","trend","comparison","templates","experiment","details"].filter(y=>b.has(y)).slice(4));o(y=>y.filter(Z=>L.has(Z)))},[u]),t.loading)return e.jsx("div",{className:"rp-report","data-page":"journeys",children:e.jsx($t,{title:`Loading ${_e(n)} journey reporting`,children:"Reading campaign outcome evidence and the journey definition catalog."})});if(t.error)return e.jsx("div",{className:"rp-report","data-page":"journeys",children:e.jsx($t,{type:"error",title:"Journey report unavailable",onRetry:()=>r(b=>b+1),children:t.error})});const g=M(l.summary.total_sent)??M(l.funnelLookup.sent),v=M(l.funnelLookup.converted),j=be(v,g),_="Campaign & Journey Reporting API",I="Journey Definition Catalog",x=b=>{const{evidenceStatus:L="Observed",artifact:y=_,grain:Z="Source + reporting window",selectedSource:de=_e(n),scope:Q=`${_e(n)} journey reporting from campaign outcome evidence`,window:se=l.period,freshness:ie="Current artifact set · source as-of timestamp not published",provenance:V,...le}=b;return{...le,provenance:[{label:"Evidence status",value:L},...Array.isArray(V)?V:[...de?[{label:"Selected source",value:de}]:[],{label:"Scope",value:Q},{label:"Reporting window",value:se},{label:"Freshness / version",value:ie},{label:"API / artifact",value:y},{label:"Evidence grain",value:Z}]]}},S=b=>d(x(b)),T=b=>{const L=M(l.funnelLookup.delivered),y=M(l.funnelLookup.opened),Z=M(l.funnelLookup.clicked),de={sends:{title:"Target Population (message volume)",evidenceStatus:"Observed · current campaign report",meaning:`${O(g)} sends are reported for ${_e(n)} in ${l.period}. The KPI is labelled Target Population for business navigation, but the available source fact is message volume, not a count of unique people.`,calculation:`reported sends = source summary sends, reconciled to the funnel entry when available
current value = ${O(g)}`,businessInsight:"Use this as the addressable communication workload for the reporting window and as the denominator for send-based conversion and value-efficiency measures.",artifact:_,grain:"Source + reporting window",caveat:"One person can receive multiple sends. This value must not be presented as unique reach or people enrolled."},open_rate:{title:"Open rate",evidenceStatus:"Derived from observed funnel counts",meaning:`${O(y)} opens are reported from ${O(L)} delivered messages, producing the displayed ${ee(l.summary.open_rate)} open rate.`,calculation:`open rate = opened / delivered × 100
${O(y)} / ${O(L)} × 100 = ${ee(l.summary.open_rate)}`,businessInsight:"Use open rate to investigate subject line, sender identity, timing, and channel-level attention before optimizing deeper funnel stages.",artifact:`${_} · delivery funnel`,grain:"Source + reporting window + funnel stage",caveat:"Open tracking can be affected by client privacy behavior and is an engagement signal, not conversion or incremental lift."},click_rate:{title:"Click rate",evidenceStatus:"Derived from observed funnel counts",meaning:`${O(Z)} clicks are reported from ${O(L)} delivered messages, producing the displayed ${ee(l.summary.click_rate)} click rate.`,calculation:`click rate = clicked / delivered × 100
${O(Z)} / ${O(L)} × 100 = ${ee(l.summary.click_rate)}`,businessInsight:"Use click rate to assess call-to-action and content engagement, then compare the available campaign outcome evidence to identify where journey creative or targeting review is most valuable.",artifact:`${_} · delivery funnel`,grain:"Source + reporting window + funnel stage",caveat:"Clicks do not prove purchase, journey completion, or causal campaign impact."},conversion_rate:{title:"Send-to-conversion rate",evidenceStatus:"Derived from observed funnel counts",meaning:`${O(v)} reported conversions follow ${O(g)} sends, producing the displayed ${ee(j)} send-to-conversion rate.`,calculation:`send-to-conversion rate = converted / sent × 100
${O(v)} / ${O(g)} × 100 = ${ee(j)}`,businessInsight:"Use this portfolio outcome rate to monitor lower-funnel health and locate whether improvement work belongs earlier in delivery/engagement or after the click.",artifact:`${_} · delivery funnel`,grain:"Source + reporting window + funnel stage",caveat:"A reported conversion is not relabelled as journey Completed and does not establish incremental lift without a comparison design."}};de[b]&&S(de[b])},C=f.funnel;l.channels.reduce((b,L)=>b+(M(L.value)??0),0),f.channels,f.comparison,f.valueEfficiency,f.trend,f.templates,f.experiment,f.actions;const B=[{key:"valueEfficiency",label:"Top Journeys by Revenue Efficiency",purpose:"Uses available campaign outcome evidence to compare attributed revenue per 1,000 sends for journey optimization; it is not journey-level ROI."},{key:"channels",label:"Channel Mix",purpose:"Shows where reported message volume is concentrated; it does not claim which channel caused the result."},{key:"funnel",label:"Customer Journey Funnel",purpose:"Shows how sends move through delivery, opens, clicks, and reported conversions, including the loss at each step."},{key:"actions",label:"Journey Actions",purpose:"Prioritizes measured funnel signals and supporting campaign outcomes for journey optimization without inventing projected lift."},{key:"trend",label:"Engagement Trend",purpose:"Shows the direction of delivered, opened, and clicked observations so unusual movement can be investigated."},{key:"comparison",label:"Campaign Outcome Comparison",purpose:"Compares the campaign-grain delivery, engagement, bounce, and attributed-revenue evidence used to support journey reporting."},{key:"templates",label:"Journey Templates & Readiness",purpose:"Shows reusable journey templates, trigger mix, and touchpoint complexity for planning; it does not prove execution."},{key:"experiment",label:"Experiment Design Readiness",purpose:"Explains configured holdout, treatment split, variants, and measurement events; it does not claim a winner."},{key:"details",label:"Campaign Outcome Evidence",purpose:"Provides the campaign-grain evidence behind the journey reports and shows how much of the source outcome inventory the detailed rows cover."}].filter(b=>f[b.key]),E=B.slice(0,4),D=B.slice(4),h=E.map(b=>b.key),k=new Set(D.map(b=>b.key)),$=B.filter(b=>h.includes(b.key)||k.has(b.key)&&p.includes(b.key)),A=b=>h.includes(b)||k.has(b)&&p.includes(b),Y=D.length>0?e.jsx("div",{style:{marginTop:14},children:e.jsx(bi,{reports:D,selected:p,onAdd:b=>o(L=>L.includes(b)?L:[...L,b]),onRemove:b=>o(L=>L.filter(y=>y!==b)),title:"Add another journey report",description:"Choose a populated supporting report. It will be added below the four priority reports."})}):null,ae=e.jsxs(e.Fragment,{children:[e.jsxs("p",{children:["This report helps a marketer understand journey communication scale, where customers drop out of the response funnel, which channels and outcome signals deserve attention, and whether reusable journey designs are ready for review. It shows only measures backed by the current ",_e(n)," campaign outcome artifact or journey definition catalog."]}),e.jsx("h4",{children:"What the visible reports mean"}),e.jsx("ul",{children:$.map(b=>e.jsxs("li",{children:[e.jsxs("strong",{children:[b.label,":"]})," ",b.purpose]},b.key))})]});return e.jsxs("div",{className:"rp-report","data-page":"journeys",children:[e.jsx(hi,{eyebrow:`Journey report · ${l.period}`,score:ee(j),scoreLabel:"send-to-conversion",color:X.magenta,title:"Journey reporting summary",summary:`${_e(n)} recorded ${Oe(g)} sends and ${Oe(v)} conversions in the available campaign outcome evidence. The ${c.provenance.toLowerCase()} contains ${O(c.totalDefinitions)} journeys: ${O(c.presetDefinitions)} reusable presets and ${O(c.customDefinitions)} saved custom journeys.`,tags:[l.period,c.provenance,`${O(c.readyDefinitions)} ready for activation`],explanation:ae,evidence:x({evidenceStatus:"Mixed · observed outcomes + configured definitions",calculation:[C?`send-to-conversion rate = reported conversions / reported sends × 100
${O(v)} / ${O(g)} × 100 = ${ee(j)}`:null,M(l.funnelLookup.delivered)!==null&&g>0?`delivery rate = delivered / sent × 100
${O(l.funnelLookup.delivered)} / ${O(g)} × 100 = ${ee(be(l.funnelLookup.delivered,g))}`:null,M(l.funnelLookup.opened)!==null&&M(l.funnelLookup.delivered)>0?`open rate = opened / delivered × 100
${O(l.funnelLookup.opened)} / ${O(l.funnelLookup.delivered)} × 100 = ${ee(be(l.funnelLookup.opened,l.funnelLookup.delivered))}`:null,M(l.funnelLookup.clicked)!==null&&M(l.funnelLookup.delivered)>0?`click rate = clicked / delivered × 100
${O(l.funnelLookup.clicked)} / ${O(l.funnelLookup.delivered)} × 100 = ${ee(be(l.funnelLookup.clicked,l.funnelLookup.delivered))}`:null,M(l.summary.revenue)!==null&&g>0?`campaign outcome value efficiency = attributed revenue / sends × 1,000
${Ne(l.summary.revenue)} / ${O(g)} × 1,000 = ${Ne(M(l.summary.revenue)/g*1e3)}`:null,M(c.totalDefinitions)!==null?`total journeys = preset journey definitions + saved custom journey definitions
${O(c.presetDefinitions)} + ${O(c.customDefinitions)} = ${O(c.totalDefinitions)}`:null].filter(Boolean).join(`

`),businessInsight:`${_e(n)} produced ${O(v)} reported conversions from ${O(g)} sends, a ${ee(j)} send-to-conversion rate. Review the largest visible funnel loss first, then use channel and campaign outcome evidence to decide whether the next journey test should address delivery, message relevance, call-to-action, or the post-click experience. ${O(c.readyDefinitions)} of ${O(c.presetDefinitions)} preset journeys are ready for activation review; this does not prove they are deployed or running.`,provenance:[{label:"Selected source",value:_e(n)},{label:"Scope",value:"Source campaign outcomes + global journey definition catalog"},{label:"Reporting window",value:l.period},{label:"Freshness / version",value:"Source as-of timestamp and catalog version not published"},{label:"Campaign report API",value:_},{label:"Runtime evidence",value:`Observed sends, conversions, channels, and attributed value for ${l.period}`},{label:"Definition evidence",value:`${I} · ${O(c.totalDefinitions)} definitions`},{label:"Evidence grain",value:"Source window, campaign row, funnel stage, and global journey definition"}],callout:"Only source outcomes and configured definition measures backed by the current APIs are displayed."})}),e.jsxs(gi,{columns:3,children:[M(c.totalDefinitions)!==null&&e.jsx(Hn,{label:"Total Journeys",value:O(c.totalDefinitions),detail:`${O(c.presetDefinitions)} preset + ${O(c.customDefinitions)} saved custom`,color:X.violet,evidence:"View evidence",onClick:()=>S({title:"Total Journeys",evidenceStatus:"Configured · global journey library",meaning:`The journey library contains ${O(c.presetDefinitions)} reusable preset journeys and ${O(c.customDefinitions)} saved custom journeys.`,calculation:`total journeys = preset journey definitions + saved custom journey definitions
${O(c.presetDefinitions)} + ${O(c.customDefinitions)} = ${O(c.totalDefinitions)}`,businessInsight:"Use this inventory to plan template reuse and governance. It measures available configuration, not source-specific execution or customer enrollment.",selectedSource:null,scope:"Global journey definition catalog",window:"Not source-scoped",freshness:"Catalog version / as-of timestamp not published",artifact:I,grain:"Global journey definition",caveat:"Definition inventory is global configuration metadata and is deliberately not presented as source-specific runtime execution."})}),M(c.readyDefinitions)!==null&&e.jsx(Hn,{label:"Ready for Activation",value:O(c.readyDefinitions),detail:`${ee(be(c.readyDefinitions,c.presetDefinitions))} of presets`,color:X.green,evidence:"View evidence",onClick:()=>S({title:"Ready for Activation",evidenceStatus:"Configured · definition readiness",meaning:`${O(c.readyDefinitions)} preset journeys are marked READY in the journey library, indicating that their configuration passed the library’s readiness state.`,calculation:`ready-for-activation share = READY preset journeys / preset journeys
${O(c.readyDefinitions)} / ${O(c.presetDefinitions)} = ${ee(be(c.readyDefinitions,c.presetDefinitions))}`,businessInsight:"Use this measure to identify templates ready for business review or customization. It does not prove a journey is deployed, running, or producing outcomes.",selectedSource:null,scope:"Global journey definition catalog",window:"Not source-scoped",freshness:"Catalog version / as-of timestamp not published",artifact:I,grain:"Global preset journey definition",caveat:"READY describes configuration readiness. It is not the same as a journey that is deployed and running."})}),M(c.explicitlyActive)!==null&&M(c.activeFlagCoverage)!==null&&e.jsx(Hn,{label:"Active Journeys",value:O(c.explicitlyActive),detail:`Configured active · status coverage ${O(c.activeFlagCoverage)}/${O(c.presetDefinitions)}`,color:X.amber,evidence:"View evidence",onClick:()=>S({title:"Active Journeys",evidenceStatus:"Configured · incomplete active-flag coverage",meaning:`${O(c.explicitlyActive)} preset journeys explicitly mark their configuration active. The status flag is available on ${O(c.activeFlagCoverage)} of ${O(c.presetDefinitions)} presets, so the displayed count covers only journeys with explicit configuration evidence.`,calculation:`active journeys (configured) = count(preset journeys where active flag is present and true)
= ${O(c.explicitlyActive)}
status coverage = ${O(c.activeFlagCoverage)} / ${O(c.presetDefinitions)} = ${ee(be(c.activeFlagCoverage,c.presetDefinitions))}`,businessInsight:"Use this as the configured-active inventory within the published status coverage, and complete missing status metadata before using it for portfolio decisions. Live execution requires a journey runtime ledger.",selectedSource:null,scope:"Global journey definition catalog",window:"Not source-scoped",freshness:"Catalog version / as-of timestamp not published",artifact:I,grain:"Global preset journey definition",caveat:"This is configured active status, not proof that a journey is deployed or currently running. Incomplete status coverage can understate the true configured-active count."})})]}),e.jsx(il,{sent:g,summary:l.summary,conversionRate:j,onExplain:T}),e.jsxs(sl,{primaryKeys:E.map(b=>b.key),optionalKeys:D.filter(b=>p.includes(b.key)).map(b=>b.key),weights:{funnel:5,channels:3,valueEfficiency:4,actions:2,trend:3,comparison:4,templates:3,experiment:3,details:4},selector:Y,children:[A("funnel")&&e.jsxs(We,{reportKey:"funnel",className:"rp-cj-flow",title:"Customer Journey Funnel",subtitle:"Stage-to-stage retention and drop-off drawn from the source-specific campaign funnel.",action:e.jsx(He,{label:"Explain flow ↗",onClick:()=>S({title:"Customer Journey Funnel",evidenceStatus:"Derived from observed campaign funnel counts",meaning:"The flow shows how many campaign events remain at each reported stage. Connector thickness visualizes retention, and each callout shows the exact loss from the previous stage.",calculation:`reported stage values = ${l.funnel.map(b=>`${b.label} ${O(b.value)}`).join(" → ")}
overall conversion = Converted / Sent × 100
${O(v)} / ${O(g)} × 100 = ${ee(j)}
current stage losses = ${l.funnel.slice(1).map((b,L)=>`${l.funnel[L].label}→${b.label}: ${O(Math.max(l.funnel[L].value-b.value,0))}`).join(" · ")}`,businessInsight:"Use the largest stage loss to choose the next optimization focus—for example deliverability, opens, clicks, or conversion. Converted is not the same as journey completion.",artifact:`${_} · campaign conversion funnel`,grain:"Source + reporting window + funnel stage",caveat:"Converted is a campaign outcome and is not relabelled as journey Completed. Enrollment and completion require journey execution records."})}),children:[e.jsx(rl,{rows:l.funnel,sent:g}),e.jsxs("p",{className:"rp-cj-caption",children:[e.jsx("strong",{children:"Overall conversion:"})," ",O(v)," converted, ",ee(j)," of sends. Converted is not relabelled as journey Completed."]})]}),A("channels")&&e.jsx(We,{reportKey:"channels",className:"rp-cj-channel",title:"Channel Mix",subtitle:"Exact share of reported sends by represented channel.",action:e.jsx(He,{label:`${Se(l.channels.length)} channels · Explain ↗`,onClick:()=>{const b=l.channels.reduce((y,Z)=>y+Z.value,0),L=l.channels.slice().sort((y,Z)=>Z.value-y.value)[0];S({title:"Channel Mix",evidenceStatus:"Observed · reported channel counts",meaning:`The chart distributes ${O(b)} represented sends across ${Se(l.channels.length)} channels for ${_e(n)} in ${l.period}.`,calculation:`represented channel sends = sum(channel send counts) = ${O(b)}${L?`
${L.label} share = ${O(L.value)} / ${O(b)} = ${ee(be(L.value,b))}`:`
no positive channel counts are available`}
reported source sends = ${O(g)}`,businessInsight:"Use channel share to understand delivery concentration, capacity exposure, and where channel-specific performance or resilience analysis should start.",artifact:`${_} · channel mix`,grain:"Source + reporting window + channel",caveat:b===g?"Channel counts reconcile to reported sends, but the chart measures send volume—not unique people, channel effectiveness, or causal value.":`Represented channel sends (${O(b)}) do not reconcile to reported sends (${O(g)}). Treat the distribution as partial until the source artifact is corrected.`})}}),children:e.jsx(ll,{rows:l.channels,sent:g})}),A("valueEfficiency")&&e.jsx(We,{reportKey:"valueEfficiency",className:"rp-cj-value",title:"Top Journeys by Revenue Efficiency",subtitle:"Campaign outcome evidence used for journey reporting, normalized to attributed revenue per 1,000 sends.",action:e.jsx(He,{label:"Explain metric ↗",onClick:()=>{const b=M(l.summary.revenue),L=b!==null&&g!==null&&g>0?b/g*1e3:null;S({title:"Top Journeys by Revenue Efficiency",evidenceStatus:"Derived from observed campaign values",meaning:"The leaderboard uses campaign outcome evidence to normalize reported attributed revenue to 1,000 sends. It supports journey optimization, but source rows are not relabelled as journey-level outcomes when no journey mapping is supplied.",calculation:`campaign value efficiency = attributed campaign revenue / campaign sends × 1,000
source benchmark = ${Ne(b)} / ${O(g)} × 1,000 = ${Ne(L)}`,businessInsight:"Use this comparison to identify journey creative, offer, or targeting patterns that deserve investigation. Do not treat it as journey-level ROI or incremental lift because the evidence remains campaign-grain and spend and causal evidence are unavailable.",artifact:`${_} · detailed campaign rows`,grain:"Detailed campaign row",caveat:`The ${Se(l.campaigns.length)} supplied rows cover ${ee(l.detailCoverage.campaign_send_pct)} of sends and ${ee(l.detailCoverage.campaign_revenue_pct)} of attributed revenue. Revenue is attributed, not proven incremental lift; this is not ROI.`})}}),children:e.jsx(ol,{campaigns:l.campaigns,summary:l.summary,coverage:l.detailCoverage,onExplain:b=>S({title:`${b.campaign} value efficiency`,evidenceStatus:"Derived from observed campaign values",meaning:`${b.campaign} reports ${Ne(b.efficiency)} in attributed revenue per 1,000 sends, allowing direct comparison with campaigns of different size.`,calculation:`attributed revenue efficiency = campaign revenue / campaign sends × 1,000
${Ne(b.revenue)} / ${O(b.sent)} × 1,000 = ${Ne(b.efficiency)}`,businessInsight:"Use this value to decide whether the campaign deserves deeper analysis relative to peers and the source benchmark. Do not scale or stop it on this measure alone.",artifact:`${_} · detailed campaign rows`,grain:`Campaign ${b.campaign_id||b.campaign} · ${l.period}`,caveat:"This is a volume-normalized attributed-revenue measure, not ROI, incremental lift, or causal performance."})})}),A("actions")&&e.jsx(We,{reportKey:"actions",className:"rp-cj-actions-panel",title:"Journey Actions",subtitle:"Recommended journey priorities generated from observed funnel and supporting campaign outcome evidence.",action:e.jsx(He,{label:"Explain priorities ↗",onClick:()=>{const L=l.funnel.slice(1).map((Q,se)=>{const ie=l.funnel[se],V=Math.max(ie.value-Q.value,0);return{from:ie.label,to:Q.label,lost:V,rate:be(V,ie.value)}}).filter(Q=>Q.rate!==null).slice().sort((Q,se)=>se.rate-Q.rate)[0],y=l.campaigns.filter(Q=>M(Q.click_rate)!==null).slice().sort((Q,se)=>M(se.click_rate)-M(Q.click_rate))[0],Z=l.campaigns.filter(Q=>M(Q.bounce_rate)!==null).slice().sort((Q,se)=>M(se.bounce_rate)-M(Q.bounce_rate))[0],de=[L?`P1 = largest funnel loss = ${L.from}→${L.to}: ${O(L.lost)} lost (${ee(L.rate)})`:null,y?`P2 = highest supplied campaign click rate = ${y.campaign}: ${ee(y.click_rate)}`:null,Z?`P3 = highest supplied campaign bounce rate = ${Z.campaign}: ${ee(Z.bounce_rate)}`:null].filter(Boolean);S({title:"Journey Actions",evidenceStatus:"Diagnostic · deterministic rules on observed evidence",meaning:"The queue ranks three journey-optimization signals from the current artifact: the largest funnel loss, the highest click rate among supplied campaign outcome rows, and the highest supplied bounce rate.",calculation:de.join(`
`),businessInsight:"Use the queue to order investigation and controlled-test planning. It focuses attention on measurable friction and reusable patterns without inventing expected lift.",artifact:`${_} · funnel and detailed campaign rows`,grain:"Source reporting window + funnel stage + detailed campaign row",caveat:`The rules are diagnostic, not causal recommendations. The ${Se(l.campaigns.length)} detailed rows cover ${ee(l.detailCoverage.campaign_row_pct)} of reported campaigns, and no projected impact or statistical confidence is asserted.`})}}),children:e.jsx(hl,{campaigns:l.campaigns,funnel:l.funnel})}),A("trend")&&e.jsx(We,{reportKey:"trend",className:"rp-cj-pulse",title:"Engagement Trend",subtitle:"Independent-scale small multiples preserve the shape of delivered, opened, and clicked samples.",action:e.jsx(He,{label:"Explain samples ↗",onClick:()=>{const b=l.trend[0],L=l.trend.at(-1);S({title:"Engagement Trend",evidenceStatus:"Observed · sampled performance trend",meaning:`The panel plots ${Se(l.trend.length)} supplied observations for delivered, opened, and clicked events from ${b.label} to ${L.label}. Each series uses its own vertical scale so its direction remains visible.`,calculation:`each point = reported metric value at the supplied observation label
latest delivered = ${O(L==null?void 0:L.delivered)}
latest opened = ${O(L==null?void 0:L.opened)}
latest clicked = ${O(L==null?void 0:L.clicked)}
observation count = ${Se(l.trend.length)}`,businessInsight:"Use the pulse to spot directional changes or unusual samples that deserve campaign, channel, or tracking investigation before reviewing aggregate rates.",artifact:`${_} · performance trend`,grain:"Source + reporting window + supplied observation + engagement stage",caveat:"The three series use independent scales and supplied samples are not summed into headline totals. Visual slope must not be used to compare absolute magnitude across series or infer statistical trend."})}}),children:e.jsx(dl,{rows:l.trend,source:n})}),A("comparison")&&e.jsx(We,{reportKey:"comparison",className:"rp-cj-heat",title:"Campaign Outcome Comparison",subtitle:"Campaign-grain outcome evidence used to support journey reporting and optimization.",action:e.jsx(He,{label:"Explain matrix ↗",onClick:()=>S({title:"Campaign Outcome Comparison",evidenceStatus:"Observed and derived · detailed campaign subset",meaning:`The matrix compares ${Se(l.campaigns.length)} supplied campaign rows across delivery, open, click, bounce, and attributed-revenue measures. Exact values are printed in every available cell.`,calculation:`delivery rate = delivered / sent when a supplied delivery rate is absent
open, click, and bounce = supplied campaign rates
revenue = supplied attributed campaign revenue
detailed-row coverage = ${Se(l.campaigns.length)} / ${O(l.summary.total_campaigns)} = ${ee(l.detailCoverage.campaign_row_pct)}`,businessInsight:"Use the matrix to find campaign outcome rows with contrasting strengths or risks—for example strong engagement with high bounce pressure—and decide which journey patterns need deeper investigation.",artifact:`${_} · detailed campaign rows`,grain:"Detailed campaign row + metric",caveat:"Color intensity is relative within each column and the detailed rows are a ranked subset. Compare exact printed values and do not treat color intensity across different metrics as a common score."})}),children:e.jsx(ul,{campaigns:l.campaigns})}),A("templates")&&e.jsx(We,{reportKey:"templates",className:"rp-cj-library-panel",title:"Journey Templates & Readiness",subtitle:"Definition evidence, intentionally separated from source runtime metrics.",action:e.jsx(He,{label:"Explain library ↗",onClick:()=>{const b=c.triggerTypes.reduce((y,Z)=>y+Z.value,0),L=c.touchpointDistribution.reduce((y,Z)=>y+Z.value,0);S({title:"Journey Templates & Readiness",evidenceStatus:"Configured · global journey definition catalog",meaning:`The global catalog contains ${O(c.totalDefinitions)} journey definitions and groups them by trigger type and touchpoint count. These are reusable configuration assets, not ${_e(n)} execution records.`,calculation:`total definitions = preset definitions + saved custom definitions
${O(c.presetDefinitions)} + ${O(c.customDefinitions)} = ${O(c.totalDefinitions)}
trigger-distribution total = ${O(b)} definitions
touchpoint-distribution total = ${O(L)} definitions`,businessInsight:"Use the library view to assess template coverage, trigger diversity, and journey complexity before creating or governing new journeys.",selectedSource:null,scope:"Global journey definition catalog",window:"Not source-scoped",freshness:"Catalog version / as-of timestamp not published",artifact:I,grain:"Global journey definition",caveat:"The catalog is global configuration metadata. READY, active flags, triggers, and touchpoints do not prove deployment, people enrolled, recent use, or outcomes for the selected source."})}}),children:e.jsx(pl,{catalog:c})}),A("experiment")&&e.jsx(We,{reportKey:"experiment",className:"rp-cj-experiment-panel",title:"Experiment Design Readiness",subtitle:"Configured holdout, treatment, variant allocation, and declared measurement events.",action:e.jsx(He,{label:"Explain design ↗",onClick:()=>{var de;const b=c.experiment,L=M(b==null?void 0:b.holdout),y=M(b==null?void 0:b.treatment),Z=M(b==null?void 0:b.split);S({title:"Experiment Design Readiness",evidenceStatus:"Configured design",meaning:b!=null&&b.hasSplit?`The global catalog contains a routed experiment design with ${ee(L)} control holdout, ${ee(y)} treatment allocation, and a ${ee(Z)}/${ee(100-Z)} treatment split.`:"The journey catalog does not provide a complete routed experiment topology for this view.",calculation:`configured audience allocation = holdout ${ee(L)} + treatment ${ee(y)} = ${ee(L+y)}
configured treatment allocation = variant A ${ee(Z)} + variant B ${ee(100-Z)} = 100.0%
declared measurement events = ${Se(((de=b==null?void 0:b.declaredEvents)==null?void 0:de.length)||0)}`,businessInsight:"Use this view to review experiment topology and instrumentation requirements before launch. Resolve any toggle/split conflict and connect assignment and outcome ledgers before making a winner decision.",selectedSource:null,scope:"Global journey definition catalog",window:"Not source-scoped",freshness:"Catalog version / as-of timestamp not published",artifact:`${I} · experiment configuration`,grain:"Global journey definition + configured experiment route",caveat:"This is configured design, not source-scoped execution evidence. Eligible population, assignment, exposure, outcomes, lift, confidence, and statistical significance remain unavailable."})}}),children:e.jsx(ml,{catalog:c,source:n})}),!1,A("details")&&e.jsx(We,{reportKey:"details",className:"rp-cj-evidence-panel",title:"Campaign Outcome Evidence",subtitle:"Campaign-grain rows supporting the journey reports; this is a ranked subset, not the complete campaign inventory.",action:e.jsx(He,{label:"View lineage ↗",onClick:()=>S({title:"Campaign Outcome Evidence",evidenceStatus:"Observed · supplied detailed campaign subset",meaning:`The evidence table exposes ${Se(l.campaigns.length)} detailed campaign rows from ${_e(n)} alongside the source summary total of ${O(l.summary.total_campaigns)} campaigns.`,calculation:`detailed row coverage = ${Se(l.campaigns.length)} / ${O(l.summary.total_campaigns)} = ${ee(l.detailCoverage.campaign_row_pct)}
unallocated sends = reported sends ${O(g)} − detailed-row sends = ${O(l.detailCoverage.unallocated_sends)}
unallocated attributed revenue = source revenue ${Ne(l.summary.revenue)} − detailed-row revenue = ${Ne(l.detailCoverage.unallocated_revenue)}`,businessInsight:"Use this table as the row-level audit trail behind the comparative charts and to identify where summary totals are not represented by detailed campaign records.",artifact:`${_} · detailed campaign rows`,grain:"Detailed campaign row",caveat:"The table is a supplied ranked subset, not the complete campaign inventory. Residual sends and revenue remain explicitly unallocated rather than being guessed across displayed rows."})}),children:e.jsx(gl,{campaigns:l.campaigns,totalCampaigns:l.summary.total_campaigns,coverage:l.detailCoverage})})]}),e.jsxs(xi,{status:"Artifact + catalog",children:["Source outcomes retain their reporting window. Definition inventory is global configuration metadata from the ",c.provenance.toLowerCase(),"; the page displays only measures backed by those current APIs."]}),e.jsx(fi,{detail:i,onClose:()=>d(null)})]})}const $a=Object.fromEntries(Ke.map(n=>[n.slug,n]));function fl(n={}){const t={email:"email",push:"push",sms:"sms",inApp:"inapp"},s=Object.entries(n).filter(([,a])=>a).map(([a])=>t[a]||a);return s.length?s:["email"]}function mn(n){return n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n)}function yn(n){return n>=1e6?"$"+(n/1e6).toFixed(1)+"M":n>=1e3?"$"+(n/1e3).toFixed(0)+"K":"$"+n}function bl(n){return n.split(" ").map(t=>t[0]).join("").slice(0,2).toUpperCase()}function vl(n){return String((n==null?void 0:n.segment_id)??(n==null?void 0:n.id)??"").trim()}function yl(n,t,s,a){const r=new Map,i=(d,p=!1)=>{if(!d||typeof d!="object")return;const o=vl(d);if(!o)return;const c=String(d.source_system??d.sourceSystem??"").trim().toLowerCase();p&&!c&&!a.has(o)&&a.set(o,s);const l=pi.includes(c)?c:c==="all"?"all":a.get(o)??"all";if(l!=="all"&&l!==s)return;const f=d.pipeline_status??d._pipelineStatus??d.status??"Ready for activation",u=r.get(o),g=d.published_to_journey_builder===!0||String(d.journey_builder_status??"").toLowerCase()==="published"||(u==null?void 0:u.published)===!0;r.set(o,{...u,...d,id:o,segment_id:o,source_system:l,status:f,published:g})};return(n??[]).forEach(d=>i(d)),(t??[]).forEach(d=>i(d,!0)),[...r.values()]}function ke(n,t,s){const a=Math.sin(n+1)*1e4,r=a-Math.floor(a);return Math.floor(r*(s-t+1))+t}function $n(n,t,s){const a=Math.sin(n+73)*1e4;return+((a-Math.floor(a))*(s-t)+t).toFixed(1)}const En=["Priya Sharma","Raj Menon","Anita Desai","Kiran Bose","Sameer Patel"],Ht=["National","North","South","East","West"],Gt=["Fan Engagement","Ticketing","Commerce","Digital","Retention","Growth","Loyalty","Events"],Kt=["Core Brand","Premium Brand","Commerce Brand","App Brand","Events Brand"],jl=["Email","Multi-channel","SMS","Push","In-App"],Ut=["Active","Active","Draft","Scheduled","Active","Completed","Active","Draft","Failed","Scheduled","Active","Paused","Active","Draft","Scheduled","Active","Completed","Active","Draft","Scheduled"],Vt=["High","Medium","Medium","Low","High"];function wl(n,t=4){const s=[];return n.forEach((a,r)=>{var f,u;const i=a.journeyForm||{},d=fl(i.channels),p=i.audience||"General Audience",o=i.objective||((f=a.blueprintForm)==null?void 0:f.brief)||"",c=a.categoryName||"General",l=a.subCategoryName||c;for(let g=0;g<t;g++){const v=r*37+g*13+7,j=Ut[(r*t+g)%Ut.length],_=j==="Active"||j==="Paused"||j==="Completed"||j==="Failed",I=En[ke(v,0,En.length-1)],x=Ht[ke(v+1,0,Ht.length-1)],S=Gt[ke(v+2,0,Gt.length-1)],T=Kt[ke(v+3,0,Kt.length-1)],C=d.length>1?"Multi-channel":jl[ke(v+4,0,3)],B=((u=a.blueprintForm)==null?void 0:u.orchestrationType)==="single-touchpoint"?"Single-touch":"Multi-touch",E=Vt[ke(v+5,0,Vt.length-1)],h=new Date().getFullYear(),k=h-1,$=[`${k}-10`,`${k}-11`,`${k}-12`,`${h}-01`,`${h}-02`],A=["05","12","01","18","07"],Y=$[ke(v+6,0,4)]+"-"+A[ke(v+6,0,4)],b=[`${h}-04`,`${h}-05`,`${h}-06`,`${h}-07`,`${h}-08`][ke(v+7,0,4)]+"-"+A[ke(v+7,0,4)],L=_?$n(v+10,18,52):0,y=_?$n(v+11,2,14):0,Z=_?$n(v+12,1,10):0,de=ke(v+13,5e3,18e4),Q=_?ke(v+14,1e4,9e5):0,se=ke(v+15,5e3,6e4),ie=_?Math.round(se*$n(v+16,.3,.95)):0,V=_?ke(v+17,40,98):0,le=["Wave 1","Wave 2","Sprint A","Sprint B","Phase 1","Phase 2","Drive","Push"],je=le[g%le.length],ve=g===0?a.name:`${a.name} — ${je}`,H=[];if(j!=="Draft"){const N=new Date,F=N.getFullYear(),q=String(N.getMonth()+1).padStart(2,"0"),oe=String(N.getMonth()===0?12:N.getMonth()).padStart(2,"0"),ge=N.getMonth()===0?F-1:F,K=String(N.getMonth()===11?1:N.getMonth()+2).padStart(2,"0"),xe=N.getMonth()===11?F+1:F,we=[`${F}-${q}-03`,`${F}-${q}-07`,`${F}-${q}-12`,`${F}-${q}-18`,`${F}-${q}-22`,`${F}-${q}-28`,`${ge}-${oe}-20`,`${xe}-${K}-05`,`${xe}-${K}-14`];H.push({type:j==="Active"?"Launch":j,date:we[ke(v+18,0,we.length-1)],status:j}),_&&g%2===0&&H.push({type:"Mid-Check",date:we[ke(v+19,0,we.length-1)],status:"Scheduled"})}const P=[{event:"Campaign Created",date:Y+" 09:00",user:I,type:"create",description:`Created ${ve}.`}];if(j!=="Draft"){const N=En[ke(v+20,0,En.length-1)];P.push({event:"Audience Assigned",date:Y+" 14:30",user:I,type:"audience",description:`Audience "${p}" attached.`}),P.push({event:"Journey Mapped",date:b+" 10:00",user:N,type:"journey",description:`Journey "${a.name}" configured.`}),_&&(P.push({event:"Approved",date:b+" 15:00",user:"Director CMO",type:"approval",description:"Campaign approved for activation."}),P.push({event:"Activated",date:b+" 08:00",user:"System",type:"activate",description:"Campaign went live."})),j==="Completed"&&P.push({event:"Completed",date:b+" 23:59",user:"System",type:"update",description:"Campaign concluded successfully."}),j==="Failed"&&P.push({event:"Failed",date:b+" 11:30",user:"System",type:"update",description:"Campaign encountered an error during execution."}),j==="Paused"&&P.push({event:"Paused",date:b+" 14:00",user:I,type:"update",description:"Campaign paused pending review."})}s.push({id:`${a.slug}-${g}`,name:ve,type:C,status:j,journey:a.name,journeySlug:a.slug,segment:p,audienceSize:de,owner:I,createdBy:I,createdDate:Y,scheduledDate:b,lastModified:b,channels:d,budget:se,budgetSpent:ie,brand:T,region:x,businessUnit:S,tags:[a.categoryId,a.subCategoryId,j.toLowerCase()].filter(Boolean),priority:E,performanceScore:V,metrics:{openRate:L,ctr:y,conversionRate:Z,revenue:Q,reach:de},startDate:b,endDate:b,calendarEvents:H,timeline:P,touchType:B,journeyData:a,journeyObjective:o,journeyCategory:c,journeySubCategory:l,variantA:i.variantA||"Standard cadence",variantB:i.variantB||"Personalised variant",journeyDuration:i.duration||"21 days"})}}),s}const ze=wl(Ke,1),Nl={Active:{color:"#10b981",bg:"rgba(16,185,129,0.12)"},Draft:{color:"#8b5cf6",bg:"rgba(139,92,246,0.12)"},Scheduled:{color:"#3b82f6",bg:"rgba(59,130,246,0.12)"},Paused:{color:"#f59e0b",bg:"rgba(245,158,11,0.12)"},Completed:{color:"#64748b",bg:"rgba(100,116,139,0.12)"},Failed:{color:"#ef4444",bg:"rgba(239,68,68,0.12)"}},ut={email:{color:"#3b82f6",bg:"rgba(59,130,246,0.15)",label:"Email"},sms:{color:"#10b981",bg:"rgba(16,185,129,0.15)",label:"SMS"},push:{color:"#8b5cf6",bg:"rgba(139,92,246,0.15)",label:"Push"},inapp:{color:"#06b6d4",bg:"rgba(6,182,212,0.15)",label:"In-App"},web:{color:"#f97316",bg:"rgba(249,115,22,0.15)",label:"Web"},whatsapp:{color:"#25d366",bg:"rgba(37,211,102,0.15)",label:"WA"}},Yt={create:{color:"#3b82f6",border:"#3b82f6"},audience:{color:"#10b981",border:"#10b981"},journey:{color:"#8b5cf6",border:"#8b5cf6"},approval:{color:"#f59e0b",border:"#f59e0b"},publish:{color:"#06b6d4",border:"#06b6d4"},activate:{color:"#10b981",border:"#10b981"},update:{color:"#64748b",border:"#64748b"}},kl=[...new Set(ze.map(n=>n.owner))].sort(),Sl=[...new Set(ze.map(n=>n.type))].sort(),Cl=Ke.map(n=>({slug:n.slug,name:n.name,category:n.categoryName})),Ea=[...new Set(Ke.map(n=>n.categoryName).filter(Boolean))].sort();function pt({status:n}){const t=Nl[n]||{color:"#64748b",bg:"rgba(100,116,139,0.12)"};return e.jsxs("span",{className:"cm-status-badge",style:{color:t.color,background:t.bg},children:[e.jsx("span",{className:"cm-status-dot",style:{background:t.color}}),n]})}function mt({channel:n}){const t=ut[n]||{color:"#64748b",bg:"rgba(100,116,139,0.15)",label:n};return e.jsx("span",{className:"cm-channel-chip",style:{color:t.color,background:t.bg},children:t.label})}function Da({score:n}){const t=n>70?"#10b981":n>=50?"#f59e0b":"#ef4444";return e.jsxs("div",{className:"cm-score-wrap",children:[e.jsx("div",{className:"cm-score-bar",children:e.jsx("div",{className:"cm-score-fill",style:{width:n+"%",background:t}})}),e.jsx("span",{className:"cm-score-num",style:{color:t},children:n})]})}function Ia({priority:n}){const t={High:"cm-priority-high",Medium:"cm-priority-medium",Low:"cm-priority-low"}[n]||"cm-priority-low";return e.jsxs("span",{className:t,children:["● ",n]})}const Al=[{key:"",label:"Total",color:"#3b8de6"},{key:"Active",label:"Active",color:"#10b981"},{key:"Draft",label:"Draft",color:"#8b5cf6"},{key:"Scheduled",label:"Upcoming",color:"#3b82f6"},{key:"Completed",label:"Completed",color:"#64748b"},{key:"Failed",label:"Failed",color:"#ef4444"}];function _l({label:n,value:t,color:s,isActive:a,onClick:r}){return e.jsxs("div",{className:"cm-health-card"+(a?" active":""),style:{"--hc":s},onClick:r,children:[e.jsx("div",{className:"cm-health-card-top",children:e.jsx("div",{className:"cm-health-card-icon",children:e.jsx("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})})})}),e.jsx("div",{className:"cm-health-card-value",children:t}),e.jsx("div",{className:"cm-health-card-label",children:n})]})}function $l({value:n,onChange:t,campaigns:s,recentSearches:a,onRecentClick:r}){const[i,d]=m.useState(!1),p=m.useRef(null),o=m.useMemo(()=>{if(!n||n.length<2)return[];const l=n.toLowerCase();return s.filter(f=>f.name.toLowerCase().includes(l)||f.journey.toLowerCase().includes(l)||f.segment.toLowerCase().includes(l)).slice(0,7)},[n,s]);m.useEffect(()=>{function l(f){p.current&&!p.current.contains(f.target)&&d(!1)}return document.addEventListener("mousedown",l),()=>document.removeEventListener("mousedown",l)},[]);const c=i&&(o.length>0||a.length>0&&!n);return e.jsxs("div",{className:"cm-search-wrap",ref:p,children:[e.jsxs("svg",{className:"cm-search-icon",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("circle",{cx:"11",cy:"11",r:"8",stroke:"currentColor",strokeWidth:"2"}),e.jsx("path",{d:"m21 21-4.35-4.35",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]}),e.jsx("input",{className:"cm-search-input",type:"text",placeholder:"Search campaigns, journeys, segments…",value:n,onChange:l=>t(l.target.value),onFocus:()=>d(!0)}),c&&e.jsxs("div",{className:"cm-search-dropdown",children:[!n&&a.length>0&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cm-search-section-label",children:"Recent Searches"}),a.map(l=>e.jsxs("div",{className:"cm-search-item",onClick:()=>{t(l),r(l),d(!1)},children:[e.jsx("svg",{className:"cm-search-item-icon",width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})}),l]},l))]}),o.length>0&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cm-search-section-label",children:"Campaigns"}),o.map(l=>e.jsxs("div",{className:"cm-search-item",onClick:()=>{t(l.name),d(!1)},children:[e.jsx(pt,{status:l.status}),e.jsx("span",{style:{flex:1,overflow:"hidden",textOverflow:"ellipsis"},children:l.name}),e.jsx("span",{style:{fontSize:10,color:"var(--text-muted)"},children:l.journey})]},l.id))]})]})]})}function El({filters:n,onChange:t,onApply:s,onReset:a,onSave:r}){const i=["Active","Draft","Scheduled","Paused","Completed","Failed"],d=["email","sms","push","inapp","web","whatsapp"];function p(o,c){const l=n[o]||[];t({[o]:l.includes(c)?l.filter(f=>f!==c):[...l,c]})}return e.jsxs("div",{className:"cm-filter-panel",children:[e.jsxs("div",{className:"cm-filter-sections",children:[e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Status"}),e.jsx("div",{className:"cm-filter-pills",children:i.map(o=>e.jsx("button",{className:"cm-filter-pill"+((n.statuses||[]).includes(o)?" active":""),onClick:()=>p("statuses",o),children:o},o))})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Channel"}),e.jsx("div",{className:"cm-filter-pills",children:d.map(o=>e.jsx("button",{className:"cm-filter-pill"+((n.channels||[]).includes(o)?" active":""),onClick:()=>p("channels",o),children:(ut[o]||{}).label||o},o))})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Journey"}),e.jsxs("select",{className:"cm-filter-input",value:n.journeySlug||"",onChange:o=>t({journeySlug:o.target.value}),children:[e.jsx("option",{value:"",children:"All Journeys"}),Cl.map(o=>e.jsx("option",{value:o.slug,children:o.name},o.slug))]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Vertical / Category"}),e.jsx("div",{className:"cm-filter-pills",children:Ea.map(o=>e.jsx("button",{className:"cm-filter-pill"+((n.categories||[]).includes(o)?" active":""),onClick:()=>p("categories",o),children:o},o))})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Created Date"}),e.jsxs("div",{className:"cm-filter-row",children:[e.jsx("input",{type:"date",className:"cm-filter-input",value:n.dateCreatedFrom||"",onChange:o=>t({dateCreatedFrom:o.target.value})}),e.jsx("span",{className:"cm-filter-row-label",children:"to"}),e.jsx("input",{type:"date",className:"cm-filter-input",value:n.dateCreatedTo||"",onChange:o=>t({dateCreatedTo:o.target.value})})]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Scheduled Date"}),e.jsxs("div",{className:"cm-filter-row",children:[e.jsx("input",{type:"date",className:"cm-filter-input",value:n.scheduledFrom||"",onChange:o=>t({scheduledFrom:o.target.value})}),e.jsx("span",{className:"cm-filter-row-label",children:"to"}),e.jsx("input",{type:"date",className:"cm-filter-input",value:n.scheduledTo||"",onChange:o=>t({scheduledTo:o.target.value})})]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Audience Size"}),e.jsxs("div",{className:"cm-filter-row",children:[e.jsx("input",{type:"number",className:"cm-filter-input",placeholder:"Min",value:n.audienceSizeMin||"",onChange:o=>t({audienceSizeMin:o.target.value})}),e.jsx("span",{className:"cm-filter-row-label",children:"–"}),e.jsx("input",{type:"number",className:"cm-filter-input",placeholder:"Max",value:n.audienceSizeMax||"",onChange:o=>t({audienceSizeMax:o.target.value})})]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Performance"}),e.jsxs("div",{className:"cm-filter-row",children:[e.jsx("span",{className:"cm-filter-row-label",children:"Open ≥"}),e.jsx("input",{type:"number",className:"cm-filter-input",placeholder:"%",value:n.openRateMin||"",onChange:o=>t({openRateMin:o.target.value})}),e.jsx("span",{className:"cm-filter-row-label",children:"CTR ≥"}),e.jsx("input",{type:"number",className:"cm-filter-input",placeholder:"%",value:n.ctrMin||"",onChange:o=>t({ctrMin:o.target.value})})]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Owner"}),e.jsxs("select",{className:"cm-filter-input",value:n.owner||"",onChange:o=>t({owner:o.target.value}),children:[e.jsx("option",{value:"",children:"All Owners"}),kl.map(o=>e.jsx("option",{value:o,children:o},o))]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Campaign Type"}),e.jsxs("select",{className:"cm-filter-input",value:n.type||"",onChange:o=>t({type:o.target.value}),children:[e.jsx("option",{value:"",children:"All Types"}),Sl.map(o=>e.jsx("option",{value:o,children:o},o))]})]}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-filter-section-title",children:"Priority"}),e.jsxs("select",{className:"cm-filter-input",value:n.priority||"",onChange:o=>t({priority:o.target.value}),children:[e.jsx("option",{value:"",children:"All Priorities"}),e.jsx("option",{value:"High",children:"High"}),e.jsx("option",{value:"Medium",children:"Medium"}),e.jsx("option",{value:"Low",children:"Low"})]})]})]}),e.jsxs("div",{className:"cm-filter-actions",children:[e.jsx("button",{className:"cm-btn cm-btn-ghost",onClick:a,children:"Reset"}),e.jsx("button",{className:"cm-btn cm-btn-ghost",onClick:r,children:"Save Filter"}),e.jsx("button",{className:"cm-btn cm-btn-primary",onClick:s,children:"Apply"})]})]})}function Dl({campaign:n,onView:t,onOpenBuilder:s}){const[a,r]=m.useState(!1),[i,d]=m.useState({top:0,right:0}),p=m.useRef(null),o=m.useRef(null);m.useEffect(()=>{function l(f){p.current&&!p.current.contains(f.target)&&o.current&&!o.current.contains(f.target)&&r(!1)}return document.addEventListener("mousedown",l),()=>document.removeEventListener("mousedown",l)},[]);function c(l){if(l.stopPropagation(),!a){const f=p.current.getBoundingClientRect();d({top:f.bottom+4,right:window.innerWidth-f.right})}r(f=>!f)}return e.jsxs("div",{className:"cm-actions-cell",children:[e.jsx("button",{className:"cm-actions-btn",ref:p,onClick:c,children:"⋯"}),a&&e.jsxs("div",{className:"cm-actions-dropdown",ref:o,style:{top:i.top,right:i.right},children:[e.jsxs("div",{className:"cm-action-item",onClick:()=>{t(n),r(!1)},children:[e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("path",{d:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z",stroke:"currentColor",strokeWidth:"2"}),e.jsx("circle",{cx:"12",cy:"12",r:"3",stroke:"currentColor",strokeWidth:"2"})]}),"View Details"]}),e.jsxs("div",{className:"cm-action-item",style:{color:"#3b8de6"},onClick:()=>{s(n.journeySlug),r(!1)},children:[e.jsx("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"Open in Builder"]}),e.jsxs("div",{className:"cm-action-item",onClick:()=>r(!1),children:[e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("path",{d:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"}),e.jsx("path",{d:"M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]}),"Edit"]}),e.jsxs("div",{className:"cm-action-item",onClick:()=>r(!1),children:[e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("rect",{x:"9",y:"9",width:"13",height:"13",rx:"2",stroke:"currentColor",strokeWidth:"2"}),e.jsx("path",{d:"M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]}),"Duplicate"]}),e.jsxs("div",{className:"cm-action-item danger",onClick:()=>r(!1),children:[e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("polyline",{points:"3 6 5 6 21 6",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"}),e.jsx("path",{d:"M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]}),"Delete"]})]})]})}function Ge({field:n,sort:t}){const s=t.field===n;return e.jsx("svg",{className:"cm-sort-icon"+(s?" cm-sort-active":""),width:"10",height:"10",viewBox:"0 0 24 24",fill:"none",children:s&&t.direction==="asc"?e.jsx("path",{d:"M12 19V5M5 12l7-7 7 7",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round"}):e.jsx("path",{d:"M12 5v14M5 12l7 7 7-7",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round"})})}function Il({campaigns:n,selected:t,onSelect:s,onSelectAll:a,onSort:r,sort:i,onRowClick:d,pageSize:p,onPageSizeChange:o,page:c,onPageChange:l,onView:f,onOpenBuilder:u}){const g=Math.max(1,Math.ceil(n.length/p)),v=(c-1)*p,j=n.slice(v,v+p),_=j.length>0&&j.every(x=>t.includes(x.id));function I(){const x=[];for(let T=1;T<=g;T++)T===1||T===g||T>=c-1&&T<=c+1?x.push(T):x[x.length-1]!=="…"&&x.push("…");return x}return e.jsxs("div",{className:"cm-table-wrap",children:[e.jsxs("table",{className:"cm-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{style:{width:36},children:e.jsx("input",{type:"checkbox",checked:_,onChange:()=>a(j),style:{cursor:"pointer"}})}),e.jsx("th",{style:{width:"20%"},onClick:()=>r("name"),children:e.jsxs("div",{className:"cm-th-inner",children:["Name ",e.jsx(Ge,{field:"name",sort:i})]})}),e.jsx("th",{style:{width:110},onClick:()=>r("status"),children:e.jsxs("div",{className:"cm-th-inner",children:["Status ",e.jsx(Ge,{field:"status",sort:i})]})}),e.jsx("th",{style:{width:90},onClick:()=>r("touchType"),children:e.jsxs("div",{className:"cm-th-inner",children:["Type ",e.jsx(Ge,{field:"touchType",sort:i})]})}),e.jsx("th",{style:{width:"16%"},onClick:()=>r("journey"),children:e.jsxs("div",{className:"cm-th-inner",children:["Journey ",e.jsx(Ge,{field:"journey",sort:i})]})}),e.jsx("th",{style:{width:"10%"},onClick:()=>r("journeyCategory"),children:e.jsxs("div",{className:"cm-th-inner",children:["Vertical ",e.jsx(Ge,{field:"journeyCategory",sort:i})]})}),e.jsx("th",{style:{width:105},onClick:()=>r("owner"),children:e.jsxs("div",{className:"cm-th-inner",children:["Owner ",e.jsx(Ge,{field:"owner",sort:i})]})}),e.jsx("th",{style:{width:120},children:"Channels"}),e.jsx("th",{style:{width:85},onClick:()=>r("audienceSize"),children:e.jsxs("div",{className:"cm-th-inner",children:["Audience ",e.jsx(Ge,{field:"audienceSize",sort:i})]})}),e.jsx("th",{style:{width:80},onClick:()=>r("performanceScore"),children:e.jsxs("div",{className:"cm-th-inner",children:["Score ",e.jsx(Ge,{field:"performanceScore",sort:i})]})}),e.jsx("th",{style:{width:85},onClick:()=>r("priority"),children:e.jsxs("div",{className:"cm-th-inner",children:["Priority ",e.jsx(Ge,{field:"priority",sort:i})]})}),e.jsx("th",{style:{width:50},children:"Actions"})]})}),e.jsxs("tbody",{children:[j.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:12,style:{textAlign:"center",padding:40,color:"var(--text-muted)"},children:"No campaigns match your filters."})}),j.map(x=>e.jsxs("tr",{className:t.includes(x.id)?"cm-row-selected":"",style:{cursor:"pointer"},onClick:()=>d(x),children:[e.jsx("td",{onClick:S=>S.stopPropagation(),children:e.jsx("input",{type:"checkbox",checked:t.includes(x.id),onChange:()=>s(x.id),style:{cursor:"pointer"}})}),e.jsx("td",{children:e.jsxs("div",{className:"cm-name-cell",children:[e.jsx("strong",{children:x.name}),e.jsx("span",{className:"cm-type-badge",children:x.type})]})}),e.jsx("td",{children:e.jsx(pt,{status:x.status})}),e.jsx("td",{children:e.jsx("span",{style:{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:"0.04em",background:x.touchType==="Single-touch"?"rgba(100,180,255,0.1)":"rgba(100,220,160,0.1)",color:x.touchType==="Single-touch"?"#64B4FF":"#64DCA0"},children:x.touchType})}),e.jsx("td",{style:{overflow:"hidden",textOverflow:"ellipsis",maxWidth:0},title:x.journey,children:x.journey}),e.jsx("td",{style:{overflow:"hidden",textOverflow:"ellipsis",maxWidth:0},children:e.jsx("span",{style:{fontSize:11,color:"var(--text-muted)"},children:x.journeyCategory})}),e.jsx("td",{style:{overflow:"hidden",textOverflow:"ellipsis",maxWidth:0},title:x.owner,children:x.owner}),e.jsx("td",{children:e.jsxs("div",{className:"cm-channels",children:[x.channels.slice(0,3).map(S=>e.jsx(mt,{channel:S},S)),x.channels.length>3&&e.jsxs("span",{style:{fontSize:10,color:"var(--text-muted)"},children:["+",x.channels.length-3]})]})}),e.jsx("td",{children:mn(x.audienceSize)}),e.jsx("td",{children:e.jsx(Da,{score:x.performanceScore})}),e.jsx("td",{children:e.jsx(Ia,{priority:x.priority})}),e.jsx("td",{onClick:S=>S.stopPropagation(),children:e.jsx(Dl,{campaign:x,onView:f,onOpenBuilder:u})})]},x.id))]})]}),e.jsxs("div",{className:"cm-pagination",children:[e.jsxs("div",{className:"cm-pagination-info",children:["Showing ",n.length===0?0:v+1,"–",Math.min(v+p,n.length)," of ",n.length]}),e.jsxs("div",{className:"cm-page-btns",children:[e.jsx("button",{className:"cm-page-btn",disabled:c===1,onClick:()=>l(c-1),children:"‹"}),I().map((x,S)=>x==="…"?e.jsx("span",{style:{padding:"0 4px",color:"var(--text-muted)",fontSize:13},children:"…"},"e"+S):e.jsx("button",{className:"cm-page-btn"+(x===c?" active":""),onClick:()=>l(x),children:x},x)),e.jsx("button",{className:"cm-page-btn",disabled:c===g,onClick:()=>l(c+1),children:"›"})]}),e.jsxs("select",{className:"cm-page-size-select",value:p,onChange:x=>{o(Number(x.target.value))},children:[e.jsx("option",{value:10,children:"10 / page"}),e.jsx("option",{value:25,children:"25 / page"}),e.jsx("option",{value:50,children:"50 / page"}),e.jsx("option",{value:100,children:"100 / page"})]})]})]})}const Rl=["January","February","March","April","May","June","July","August","September","October","November","December"],Pl=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];function zl({campaigns:n,calDate:t,onDateChange:s,selectedDay:a,onDayClick:r}){const i=t.getFullYear(),d=t.getMonth(),p=new Date(i,d,1).getDay(),o=new Date(i,d+1,0).getDate(),c=new Date(i,d,0).getDate(),l=new Date,f=[];for(let j=p-1;j>=0;j--)f.push({day:c-j,curMonth:!1});for(let j=1;j<=o;j++)f.push({day:j,curMonth:!0});for(;f.length%7!==0;)f.push({day:f.length-o-p+1,curMonth:!1});function u(j,_){if(!_)return[];const I=`${i}-${String(d+1).padStart(2,"0")}-${String(j).padStart(2,"0")}`,x=[];return n.forEach(S=>{(S.calendarEvents||[]).forEach(T=>{T.date===I&&x.push({...T,name:S.name})})}),x}function g(j,_){return _&&j===l.getDate()&&d===l.getMonth()&&i===l.getFullYear()}const v={Active:"#10b981",Scheduled:"#3b82f6",Draft:"#8b5cf6",Completed:"#64748b",Failed:"#ef4444",Paused:"#f59e0b"};return e.jsxs("div",{className:"cm-calendar",children:[e.jsxs("div",{className:"cm-cal-header",children:[e.jsxs("div",{className:"cm-cal-title",children:[Rl[d]," ",i]}),e.jsxs("div",{className:"cm-cal-controls",children:[e.jsx("button",{className:"cm-cal-nav-btn",onClick:()=>s(new Date(i,d-1,1)),children:"‹"}),e.jsx("button",{className:"cm-cal-today-btn",onClick:()=>{const j=new Date;s(new Date(j.getFullYear(),j.getMonth(),1))},children:"Today"}),e.jsx("button",{className:"cm-cal-nav-btn",onClick:()=>s(new Date(i,d+1,1)),children:"›"})]})]}),e.jsxs("div",{className:"cm-cal-grid",children:[Pl.map(j=>e.jsx("div",{className:"cm-cal-day-header",children:j},j)),f.map((j,_)=>{const I=u(j.day,j.curMonth),x=j.curMonth?`${i}-${String(d+1).padStart(2,"0")}-${String(j.day).padStart(2,"0")}`:null,S=x&&a===x;return e.jsxs("div",{className:"cm-cal-day"+(j.curMonth?"":" other-month")+(g(j.day,j.curMonth)?" today":"")+(S?" is-selected":""),onClick:()=>j.curMonth&&r&&r(x,I),style:j.curMonth?{cursor:"pointer"}:void 0,children:[e.jsx("div",{className:"cm-cal-date",children:j.day}),I.slice(0,2).map((T,C)=>e.jsx("div",{className:"cm-cal-event",style:{background:(v[T.status]||"#3b82f6")+"22",color:v[T.status]||"#3b82f6"},title:T.name,children:T.name.slice(0,20)},C)),I.length>2&&e.jsxs("div",{className:"cm-cal-more",children:["+",I.length-2," more"]})]},_)})]}),e.jsx("div",{className:"cm-cal-legend",children:Object.entries(v).map(([j,_])=>e.jsxs("div",{className:"cm-cal-legend-item",children:[e.jsx("div",{className:"cm-cal-legend-dot",style:{background:_}}),j]},j))})]})}function Ra({campaign:n,onClose:t}){if(!n)return null;const s=$a[n.journeySlug]||{},a=s.journeyForm||{},r=[{type:"Campaign",name:n.name,detail:`Type: ${n.type}
Status: ${n.status}`},{type:"Journey",name:s.name||n.journey,detail:`Vertical: ${s.categoryName||n.journeyCategory}
Sub-category: ${s.subCategoryName||n.journeySubCategory}`,extra:a.objective||n.journeyObjective},{type:"Segment / Audience",name:a.audience||n.segment,detail:`Size: ${mn(n.audienceSize)} members
Duration: ${a.duration||n.journeyDuration}`},{type:"Channels",name:n.channels.map(i=>(ut[i]||{}).label||i).join(", "),detail:`${n.channels.length} channel${n.channels.length!==1?"s":""} configured`,chips:n.channels}];return e.jsxs("div",{className:"cm-journey-panel",children:[e.jsxs("div",{className:"cm-journey-panel-header",children:[e.jsxs("h3",{className:"cm-journey-panel-title",children:["Journey Association — ",n.journey]}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:28,padding:"0 10px",fontSize:12},onClick:t,children:"Close"})]}),(n.variantA||n.variantB)&&e.jsxs("div",{style:{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"},children:[e.jsxs("div",{style:{flex:1,minWidth:180,background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px"},children:[e.jsx("div",{style:{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#e5c97a",marginBottom:3},children:"Variant A"}),e.jsx("div",{style:{fontSize:12,color:"var(--text-secondary)"},children:n.variantA})]}),e.jsxs("div",{style:{flex:1,minWidth:180,background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px"},children:[e.jsx("div",{style:{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#c4b5fd",marginBottom:3},children:"Variant B"}),e.jsx("div",{style:{fontSize:12,color:"var(--text-secondary)"},children:n.variantB})]})]}),e.jsx("div",{className:"cm-journey-chain",children:r.map((i,d)=>e.jsxs("div",{style:{display:"flex",alignItems:"flex-start"},children:[d>0&&e.jsx("div",{className:"cm-journey-arrow",children:e.jsx("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M5 12h14M12 5l7 7-7 7",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})})}),e.jsx("div",{className:"cm-journey-node",children:e.jsxs("div",{className:"cm-journey-node-card",children:[e.jsx("div",{className:"cm-journey-node-type",children:i.type}),e.jsx("div",{className:"cm-journey-node-name",children:i.name}),e.jsx("div",{className:"cm-journey-node-detail",children:i.detail}),i.extra&&e.jsxs("div",{style:{fontSize:11,color:"var(--text-muted)",marginTop:6,fontStyle:"italic"},children:[i.extra.slice(0,80),"…"]}),i.chips&&e.jsx("div",{className:"cm-journey-node-chips",children:i.chips.map(p=>e.jsx(mt,{channel:p},p))})]})})]},d))})]})}function Ml({events:n}){return!n||n.length===0?e.jsx("div",{style:{color:"var(--text-muted)",fontSize:13,padding:20,textAlign:"center"},children:"No timeline events."}):e.jsx("div",{className:"cm-timeline",children:n.map((t,s)=>{const a=Yt[t.type]||Yt.update;return e.jsxs("div",{className:"cm-timeline-item",children:[e.jsx("div",{className:"cm-timeline-icon",style:{borderColor:a.border,color:a.color},children:e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:[t.type==="create"&&e.jsx("path",{d:"M12 5v14M5 12h14",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round"}),t.type==="audience"&&e.jsx("path",{d:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"}),t.type==="journey"&&e.jsx("path",{d:"M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"}),t.type==="approval"&&e.jsx("polyline",{points:"20 6 9 17 4 12",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round"}),t.type==="activate"&&e.jsx("polygon",{points:"5,3 19,12 5,21",stroke:"currentColor",strokeWidth:"2",strokeLinejoin:"round"}),(t.type==="update"||t.type==="publish")&&e.jsx("path",{d:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]})}),e.jsxs("div",{className:"cm-timeline-body",children:[e.jsxs("div",{className:"cm-timeline-header",children:[e.jsx("span",{className:"cm-timeline-event",children:t.event}),e.jsx("span",{className:"cm-timeline-time",children:t.date})]}),e.jsx("div",{className:"cm-timeline-desc",children:t.description}),e.jsxs("div",{className:"cm-timeline-user",children:[e.jsx("div",{className:"cm-timeline-avatar",children:bl(t.user)}),t.user]})]})]},s)})})}function Tl({campaign:n,open:t,onClose:s,onOpenBuilder:a}){const[r,i]=m.useState("overview");m.useEffect(()=>{t&&i("overview")},[t,n==null?void 0:n.id]);const d=n?[{d:"W1",v:+(n.metrics.openRate*.7).toFixed(1)},{d:"W2",v:+(n.metrics.openRate*.85).toFixed(1)},{d:"W3",v:+(n.metrics.openRate*.95).toFixed(1)},{d:"W4",v:n.metrics.openRate}]:[],p=n?[{d:"W1",v:+(n.metrics.ctr*.6).toFixed(1)},{d:"W2",v:+(n.metrics.ctr*.8).toFixed(1)},{d:"W3",v:+(n.metrics.ctr*.9).toFixed(1)},{d:"W4",v:n.metrics.ctr}]:[],o=n?[{d:"Jan",v:Math.round(n.metrics.revenue*.2)},{d:"Feb",v:Math.round(n.metrics.revenue*.35)},{d:"Mar",v:Math.round(n.metrics.revenue*.6)},{d:"Apr",v:Math.round(n.metrics.revenue*.85)}]:[],c=n&&n.budget>0?Math.round(n.budgetSpent/n.budget*100):0;return(n?$a[n.journeySlug]||{}:{}).journeyForm,e.jsxs(e.Fragment,{children:[t&&e.jsx("div",{className:"cm-drawer-overlay",onClick:s}),e.jsx("div",{className:"cm-drawer"+(t?" open":""),children:n&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"cm-drawer-header",children:[e.jsxs("div",{className:"cm-drawer-title-row",children:[e.jsx("div",{className:"cm-drawer-title",style:{flex:1},children:n.name}),e.jsx(pt,{status:n.status})]}),e.jsxs("div",{style:{fontSize:11,color:"var(--text-muted)",marginTop:3},children:[n.journeyCategory," · ",n.journeySubCategory]}),e.jsxs("div",{className:"cm-drawer-quick-actions",children:[e.jsxs("button",{className:"cm-btn cm-btn-primary",style:{height:28,fontSize:12,padding:"0 12px"},onClick:()=>{s(),a(n.journeySlug)},children:[e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",style:{marginRight:4},children:e.jsx("path",{d:"M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"Open in Builder"]}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:28,fontSize:12,padding:"0 10px"},children:"Edit"}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:28,fontSize:12,padding:"0 10px"},children:"Duplicate"}),n.status==="Active"?e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:28,fontSize:12,padding:"0 10px",color:"#f59e0b",borderColor:"#f59e0b"},children:"Pause"}):e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:28,fontSize:12,padding:"0 10px"},children:"Activate"})]}),e.jsx("button",{className:"cm-drawer-close",onClick:s,children:"✕"})]}),e.jsx("div",{className:"cm-drawer-tabs",children:["overview","audience","journey","timeline","analytics"].map(f=>e.jsx("button",{className:"cm-drawer-tab"+(r===f?" active":""),onClick:()=>i(f),children:f.charAt(0).toUpperCase()+f.slice(1)},f))}),e.jsxs("div",{className:"cm-drawer-body",children:[r==="overview"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"cm-drawer-meta-grid",children:[e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Campaign Type"}),e.jsx("span",{children:n.type})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Priority"}),e.jsx("span",{children:e.jsx(Ia,{priority:n.priority})})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Owner"}),e.jsx("span",{children:n.owner})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Created Date"}),e.jsx("span",{children:n.createdDate})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Scheduled"}),e.jsx("span",{children:n.scheduledDate})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Brand"}),e.jsx("span",{children:n.brand})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Region"}),e.jsx("span",{children:n.region})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Business Unit"}),e.jsx("span",{children:n.businessUnit})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Vertical"}),e.jsx("span",{children:n.journeyCategory})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Performance Score"}),e.jsx("span",{children:e.jsx(Da,{score:n.performanceScore})})]})]}),n.journeyObjective&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cm-drawer-section-title",children:"Journey Objective"}),e.jsx("div",{style:{fontSize:13,color:"var(--text-secondary)",lineHeight:1.6},children:n.journeyObjective})]}),e.jsx("div",{className:"cm-drawer-section-title",children:"Budget"}),e.jsxs("div",{className:"cm-drawer-meta-grid",children:[e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Total Budget"}),e.jsx("span",{children:yn(n.budget)})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Spent"}),e.jsx("span",{children:yn(n.budgetSpent)})]})]}),e.jsxs("div",{style:{marginTop:8},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11,color:"var(--text-muted)"},children:[e.jsx("span",{children:"Budget utilisation"}),e.jsxs("span",{children:[c,"%"]})]}),e.jsx("div",{className:"cm-score-bar",style:{width:"100%",height:8},children:e.jsx("div",{className:"cm-score-fill",style:{width:c+"%",background:c>90?"#ef4444":c>70?"#f59e0b":"#10b981"}})})]}),e.jsx("div",{className:"cm-drawer-section-title",children:"Channels"}),e.jsx("div",{className:"cm-channels",children:n.channels.map(f=>e.jsx(mt,{channel:f},f))}),e.jsx("div",{className:"cm-drawer-section-title",children:"Tags"}),e.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:6},children:n.tags.map(f=>e.jsx("span",{style:{fontSize:11,padding:"2px 8px",borderRadius:999,border:"1px solid var(--border)",color:"var(--text-muted)",background:"var(--bg-secondary)"},children:f},f))})]}),r==="audience"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"cm-aud-stat-strip",children:[e.jsxs("div",{className:"cm-aud-stat",children:[e.jsx("div",{className:"cm-aud-stat-val",children:mn(n.audienceSize)}),e.jsx("div",{className:"cm-aud-stat-label",children:"Reach"})]}),e.jsxs("div",{className:"cm-aud-stat",children:[e.jsx("div",{className:"cm-aud-stat-val",children:n.metrics.openRate>0?mn(Math.round(n.audienceSize*n.metrics.openRate/100)):"—"}),e.jsx("div",{className:"cm-aud-stat-label",children:"Opened"})]}),e.jsxs("div",{className:"cm-aud-stat",children:[e.jsx("div",{className:"cm-aud-stat-val",children:n.metrics.ctr>0?mn(Math.round(n.audienceSize*n.metrics.ctr/100)):"—"}),e.jsx("div",{className:"cm-aud-stat-label",children:"Clicked"})]}),e.jsxs("div",{className:"cm-aud-stat",children:[e.jsx("div",{className:"cm-aud-stat-val",children:n.metrics.conversionRate>0?mn(Math.round(n.audienceSize*n.metrics.conversionRate/100)):"—"}),e.jsx("div",{className:"cm-aud-stat-label",children:"Converted"})]})]}),e.jsx("div",{className:"cm-drawer-section-title",children:"Segment"}),e.jsxs("div",{className:"cm-drawer-meta-grid",children:[e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Segment Name"}),e.jsx("span",{children:n.segment})]}),e.jsxs("div",{className:"cm-drawer-meta-item",children:[e.jsx("label",{children:"Duration"}),e.jsx("span",{children:n.journeyDuration})]})]}),n.variantA&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cm-drawer-section-title",children:"A/B Variants"}),e.jsxs("div",{style:{display:"flex",gap:10,flexWrap:"wrap"},children:[e.jsxs("div",{style:{flex:1,minWidth:160,background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px"},children:[e.jsx("div",{style:{fontSize:10,fontWeight:700,color:"#e5c97a",marginBottom:4},children:"VARIANT A"}),e.jsx("div",{style:{fontSize:12,color:"var(--text-secondary)"},children:n.variantA})]}),e.jsxs("div",{style:{flex:1,minWidth:160,background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px"},children:[e.jsx("div",{style:{fontSize:10,fontWeight:700,color:"#c4b5fd",marginBottom:4},children:"VARIANT B"}),e.jsx("div",{style:{fontSize:12,color:"var(--text-secondary)"},children:n.variantB})]})]})]}),n.metrics.openRate>0&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cm-drawer-section-title",children:"Engagement Funnel"}),[{label:"Delivered",pct:98,color:"#3b82f6"},{label:"Opened",pct:n.metrics.openRate,color:"#10b981"},{label:"Clicked",pct:n.metrics.ctr,color:"#8b5cf6"},{label:"Converted",pct:n.metrics.conversionRate,color:"#f59e0b"}].map(f=>e.jsxs("div",{style:{marginBottom:10},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:12},children:[e.jsx("span",{style:{color:"var(--text-secondary)"},children:f.label}),e.jsxs("span",{style:{color:"var(--text-primary)",fontWeight:700},children:[f.pct.toFixed(1),"%"]})]}),e.jsx("div",{className:"cm-score-bar",style:{width:"100%",height:6},children:e.jsx("div",{className:"cm-score-fill",style:{width:f.pct+"%",background:f.color}})})]},f.label))]})]}),r==="journey"&&e.jsx(Ra,{campaign:n,onClose:()=>{}}),r==="timeline"&&e.jsx(Ml,{events:n.timeline}),r==="analytics"&&e.jsxs("div",{className:"cm-analytics-grid",children:[e.jsxs("div",{className:"cm-analytics-chart-card",children:[e.jsx("div",{className:"cm-analytics-chart-title",children:"Open Rate Trend"}),e.jsx(Ie,{width:"100%",height:100,children:e.jsxs(Rt,{data:d,margin:{top:4,right:4,bottom:0,left:-28},children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:"gradOR",x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{offset:"5%",stopColor:"#10b981",stopOpacity:.3}),e.jsx("stop",{offset:"95%",stopColor:"#10b981",stopOpacity:0})]})}),e.jsx(Me,{dataKey:"d",tick:{fontSize:10,fill:"#8fa3b8"},axisLine:!1,tickLine:!1}),e.jsx(Te,{tick:{fontSize:10,fill:"#8fa3b8"},axisLine:!1,tickLine:!1}),e.jsx(Re,{contentStyle:{background:"#1a1f2e",border:"1px solid #1e293b",borderRadius:8,fontSize:12}}),e.jsx(Xn,{type:"monotone",dataKey:"v",stroke:"#10b981",fill:"url(#gradOR)",strokeWidth:2})]})})]}),e.jsxs("div",{className:"cm-analytics-chart-card",children:[e.jsx("div",{className:"cm-analytics-chart-title",children:"CTR Trend"}),e.jsx(Ie,{width:"100%",height:100,children:e.jsxs(Rt,{data:p,margin:{top:4,right:4,bottom:0,left:-28},children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:"gradCTR",x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{offset:"5%",stopColor:"#3b8de6",stopOpacity:.3}),e.jsx("stop",{offset:"95%",stopColor:"#3b8de6",stopOpacity:0})]})}),e.jsx(Me,{dataKey:"d",tick:{fontSize:10,fill:"#8fa3b8"},axisLine:!1,tickLine:!1}),e.jsx(Te,{tick:{fontSize:10,fill:"#8fa3b8"},axisLine:!1,tickLine:!1}),e.jsx(Re,{contentStyle:{background:"#1a1f2e",border:"1px solid #1e293b",borderRadius:8,fontSize:12}}),e.jsx(Xn,{type:"monotone",dataKey:"v",stroke:"#3b8de6",fill:"url(#gradCTR)",strokeWidth:2})]})})]}),e.jsxs("div",{className:"cm-analytics-chart-card",children:[e.jsx("div",{className:"cm-analytics-chart-title",children:"Revenue (Monthly)"}),e.jsx(Ie,{width:"100%",height:100,children:e.jsxs(en,{data:o,margin:{top:4,right:4,bottom:0,left:-28},children:[e.jsx(Me,{dataKey:"d",tick:{fontSize:10,fill:"#8fa3b8"},axisLine:!1,tickLine:!1}),e.jsx(Te,{tick:{fontSize:10,fill:"#8fa3b8"},axisLine:!1,tickLine:!1}),e.jsx(Re,{contentStyle:{background:"#1a1f2e",border:"1px solid #1e293b",borderRadius:8,fontSize:12},formatter:f=>yn(f)}),e.jsx(Le,{dataKey:"v",fill:"#8b5cf6",radius:[3,3,0,0]})]})})]}),e.jsxs("div",{className:"cm-analytics-chart-card",children:[e.jsx("div",{className:"cm-analytics-chart-title",children:"Key KPIs"}),e.jsxs("div",{style:{paddingTop:4},children:[e.jsxs("div",{className:"cm-kpi-row",children:[e.jsx("span",{className:"cm-kpi-row-label",children:"Open Rate"}),e.jsxs("span",{className:"cm-kpi-row-value",children:[n.metrics.openRate.toFixed(1),"%"]})]}),e.jsxs("div",{className:"cm-kpi-row",children:[e.jsx("span",{className:"cm-kpi-row-label",children:"CTR"}),e.jsxs("span",{className:"cm-kpi-row-value",children:[n.metrics.ctr.toFixed(1),"%"]})]}),e.jsxs("div",{className:"cm-kpi-row",children:[e.jsx("span",{className:"cm-kpi-row-label",children:"Conv. Rate"}),e.jsxs("span",{className:"cm-kpi-row-value",children:[n.metrics.conversionRate.toFixed(1),"%"]})]}),e.jsxs("div",{className:"cm-kpi-row",children:[e.jsx("span",{className:"cm-kpi-row-label",children:"Revenue"}),e.jsx("span",{className:"cm-kpi-row-value",children:yn(n.metrics.revenue)})]})]})]})]})]})]})})]})}const Dn={statuses:[],channels:[],categories:[],journeySlug:"",dateCreatedFrom:"",dateCreatedTo:"",scheduledFrom:"",scheduledTo:"",owner:"",priority:"",type:"",audienceSizeMin:"",audienceSizeMax:"",openRateMin:"",ctrMin:""};function Ll({activatedSegments:n=[]}){const t=Zt(),[s,a]=m.useState("campaigns"),[r,i]=m.useState(()=>_t("sports")),[d,p]=m.useState([]),[o,c]=m.useState(!0),[l,f]=m.useState(""),u=m.useRef(new Map);m.useEffect(()=>{const w=()=>{i(_t("sports"))};return window.addEventListener("focus",w),window.addEventListener("storage",w),window.addEventListener("cdp-source-system-change",w),()=>{window.removeEventListener("focus",w),window.removeEventListener("storage",w),window.removeEventListener("cdp-source-system-change",w)}},[]),m.useEffect(()=>{const w=new AbortController;return c(!0),f(""),fetch(`/api/segments/published?source_system=${encodeURIComponent(r)}`,{signal:w.signal,headers:{Accept:"application/json"}}).then(async z=>{const ne=await z.json().catch(()=>({}));if(!z.ok)throw new Error(ne.error||`Published audiences request failed (${z.status})`);return ne}).then(z=>{p(Array.isArray(z.segments)?z.segments:[])}).catch(z=>{(z==null?void 0:z.name)!=="AbortError"&&(p([]),f("Published audiences are temporarily unavailable."))}).finally(()=>{w.signal.aborted||c(!1)}),()=>w.abort()},[r]);const g=m.useMemo(()=>yl(d,n,r,u.current),[d,n,r]);function v(w){t(`/campaigns-and-journeys?journey=${encodeURIComponent(w)}`)}const[j,_]=m.useState("list"),[I,x]=m.useState(!1),[S,T]=m.useState(""),[C,B]=m.useState(Dn),[E,D]=m.useState(Dn),[h,k]=m.useState(""),[$,A]=m.useState({field:"scheduledDate",direction:"desc"}),[Y,ae]=m.useState(1),[b,L]=m.useState(10),[y,Z]=m.useState([]),[de,Q]=m.useState(null),[se,ie]=m.useState(!1),[V,le]=m.useState(!1),[je,ve]=m.useState(()=>{const w=new Date;return new Date(w.getFullYear(),w.getMonth(),1)}),[H,P]=m.useState(null),[N]=m.useState(["Playoff","Season Ticket","Winback"]),F=m.useMemo(()=>{const w={Active:0,Draft:0,Scheduled:0,Paused:0,Completed:0,Failed:0};return ze.forEach(z=>{w[z.status]!==void 0&&w[z.status]++}),w},[]),q=m.useMemo(()=>{let w=ze;if(h&&(w=w.filter(U=>U.status===h)),S){const U=S.toLowerCase();w=w.filter(ye=>ye.name.toLowerCase().includes(U)||ye.journey.toLowerCase().includes(U)||ye.segment.toLowerCase().includes(U)||ye.owner.toLowerCase().includes(U)||(ye.journeyCategory||"").toLowerCase().includes(U)||ye.tags.some(Ce=>Ce.toLowerCase().includes(U)))}const z=E;z.statuses.length&&(w=w.filter(U=>z.statuses.includes(U.status))),z.channels.length&&(w=w.filter(U=>U.channels.some(ye=>z.channels.includes(ye)))),z.categories.length&&(w=w.filter(U=>z.categories.includes(U.journeyCategory))),z.journeySlug&&(w=w.filter(U=>U.journeySlug===z.journeySlug)),z.dateCreatedFrom&&(w=w.filter(U=>U.createdDate>=z.dateCreatedFrom)),z.dateCreatedTo&&(w=w.filter(U=>U.createdDate<=z.dateCreatedTo)),z.scheduledFrom&&(w=w.filter(U=>U.scheduledDate&&U.scheduledDate>=z.scheduledFrom)),z.scheduledTo&&(w=w.filter(U=>U.scheduledDate&&U.scheduledDate<=z.scheduledTo)),z.owner&&(w=w.filter(U=>U.owner===z.owner)),z.priority&&(w=w.filter(U=>U.priority===z.priority)),z.type&&(w=w.filter(U=>U.type===z.type)),z.audienceSizeMin&&(w=w.filter(U=>U.audienceSize>=Number(z.audienceSizeMin))),z.audienceSizeMax&&(w=w.filter(U=>U.audienceSize<=Number(z.audienceSizeMax))),z.openRateMin&&(w=w.filter(U=>U.metrics.openRate>=Number(z.openRateMin))),z.ctrMin&&(w=w.filter(U=>U.metrics.ctr>=Number(z.ctrMin)));const ne=$.direction==="asc"?1:-1;return w=[...w].sort((U,ye)=>{const Ce=U[$.field],pe=ye[$.field];return Ce==null?1:pe==null?-1:typeof Ce=="number"?(Ce-pe)*ne:String(Ce).localeCompare(String(pe))*ne}),w},[S,E,h,$]),oe=m.useMemo(()=>{let w=0;return E.statuses.length&&w++,E.channels.length&&w++,E.categories.length&&w++,E.journeySlug&&w++,(E.dateCreatedFrom||E.dateCreatedTo)&&w++,(E.scheduledFrom||E.scheduledTo)&&w++,E.owner&&w++,E.priority&&w++,E.type&&w++,(E.audienceSizeMin||E.audienceSizeMax)&&w++,(E.openRateMin||E.ctrMin)&&w++,w},[E]);function ge(w){A(z=>({field:w,direction:z.field===w&&z.direction==="asc"?"desc":"asc"})),ae(1)}function K(w){Z(z=>z.includes(w)?z.filter(ne=>ne!==w):[...z,w])}function xe(w){const z=w.every(ne=>y.includes(ne.id));Z(z?ne=>ne.filter(U=>!w.some(ye=>ye.id===U)):ne=>[...new Set([...ne,...w.map(U=>U.id)])])}function we(w){Q(w),ie(!0)}function Be(w){k(z=>z===w?"":w),ae(1)}const te=m.useMemo(()=>ze.reduce((w,z)=>w+z.metrics.revenue,0),[]),ce=m.useMemo(()=>ze.filter(w=>w.metrics.openRate>0),[]),G=ce.length?(ce.reduce((w,z)=>w+z.metrics.openRate,0)/ce.length).toFixed(1):"0",ue=ce.length?(ce.reduce((w,z)=>w+z.metrics.ctr,0)/ce.length).toFixed(1):"0",fe=ce.length?(ce.reduce((w,z)=>w+z.metrics.conversionRate,0)/ce.length).toFixed(1):"0";return e.jsxs("div",{className:"cm-page",children:[e.jsxs("div",{className:"cm-header",children:[e.jsxs("div",{className:"cm-header-left",children:[e.jsx("h1",{children:s==="reporting"?"Campaign & journey reporting":"Campaign Manager"}),e.jsx("span",{className:"cm-subtitle",children:s==="reporting"?`${ks.length} audited preset definitions · source outcomes and global catalog evidence are kept separate`:`${ze.length} campaigns across ${Ke.length} journeys · ${Ea.join(", ")}`})]}),e.jsxs("div",{className:"cm-header-actions",children:[e.jsxs("button",{className:"cm-btn cm-btn-ghost",children:[e.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("path",{d:"M23 4v6h-6M1 20v-6h6",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"}),e.jsx("path",{d:"M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})]}),"Refresh"]}),e.jsxs("button",{className:"cm-btn cm-btn-ghost",children:[e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"Export"]}),e.jsxs("button",{className:"cm-btn cm-btn-ghost",disabled:y.length===0,children:["Duplicate ",y.length>0&&e.jsx("span",{style:{fontSize:10,fontWeight:700,background:"rgba(0,102,204,0.2)",color:"#3b8de6",padding:"1px 5px",borderRadius:4},children:y.length})]}),e.jsxs("button",{className:"cm-btn cm-btn-primary",children:[e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M12 5v14M5 12h14",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round"})}),"Create Campaign"]})]})]}),e.jsxs("div",{className:"cm-main-tabs",children:[e.jsxs("button",{className:"cm-main-tab"+(s==="campaigns"?" active":""),onClick:()=>a("campaigns"),children:[e.jsx("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"Campaigns"]}),e.jsxs("button",{className:"cm-main-tab"+(s==="reporting"?" active":""),onClick:()=>a("reporting"),children:[e.jsx("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M18 20V10M12 20V4M6 20v-6",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"Reporting"]})]}),s==="reporting"&&e.jsx("div",{className:"cm-reporting-wrap",children:e.jsx(xl,{})}),s==="campaigns"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"cm-health-strip",children:Al.map(({key:w,label:z,color:ne})=>e.jsx(_l,{label:z,value:w===""?ze.length:F[w]||0,color:ne,isActive:h===w,onClick:()=>Be(w)},w||"total"))}),e.jsxs("section",{className:"cm-published-audiences","aria-labelledby":"cm-published-audiences-title",children:[e.jsxs("div",{className:"cm-published-audiences__header",children:[e.jsxs("div",{children:[e.jsx("h2",{id:"cm-published-audiences-title",children:"Available Published Audiences"}),e.jsxs("p",{children:["Source-scoped audiences ready for campaign and journey configuration in"," ",ui[r]??r,"."]})]}),e.jsx("span",{className:"cm-published-audiences__count",children:o?"Loading…":`${g.length} available`})]}),l?e.jsx("div",{className:"cm-published-audiences__message",role:"status",children:l}):o?e.jsx("div",{className:"cm-published-audiences__message",role:"status",children:"Loading published audiences…"}):g.length?e.jsx("div",{className:"cm-published-audiences__list",children:g.map(w=>e.jsxs("article",{className:"cm-published-audience",children:[e.jsx("div",{className:"cm-published-audience__name",children:w.name||w.id}),e.jsxs("div",{className:"cm-published-audience__meta",children:[e.jsxs("span",{children:[Number(w.count??w.total??w._count??0).toLocaleString()," profiles"]}),e.jsx("span",{children:w.status}),e.jsx("span",{className:w.published?"is-published":"",children:w.published?"Published":"Available this session"})]})]},w.id))}):e.jsx("div",{className:"cm-published-audiences__message",children:"No audiences have been published for this source yet."})]}),e.jsxs("div",{className:"cm-toolbar",children:[e.jsx($l,{value:S,onChange:w=>{T(w),ae(1)},campaigns:ze,recentSearches:N,onRecentClick:()=>{}}),e.jsxs("button",{className:"cm-filter-toggle-btn"+(I?" active":""),onClick:()=>x(w=>!w),children:[e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M22 3H2l8 9.46V19l4 2v-8.54L22 3z",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"Filters",oe>0&&e.jsx("span",{className:"cm-filter-badge",children:oe})]}),e.jsxs("div",{className:"cm-view-toggle",children:[e.jsxs("button",{className:"cm-view-btn"+(j==="list"?" active":""),onClick:()=>_("list"),children:[e.jsx("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})}),"List"]}),e.jsxs("button",{className:"cm-view-btn"+(j==="calendar"?" active":""),onClick:()=>_("calendar"),children:[e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",children:[e.jsx("rect",{x:"3",y:"4",width:"18",height:"18",rx:"2",stroke:"currentColor",strokeWidth:"2"}),e.jsx("path",{d:"M16 2v4M8 2v4M3 10h18",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]}),"Calendar"]})]}),j==="list"&&e.jsxs("span",{className:"cm-count-label",children:[q.length," of ",ze.length]})]}),I&&e.jsx(El,{filters:C,onChange:w=>B(z=>({...z,...w})),onApply:()=>{D(C),ae(1),x(!1)},onReset:()=>{B(Dn),D(Dn),ae(1)},onSave:()=>{}}),y.length>0&&j==="list"&&e.jsxs("div",{className:"cm-bulk-bar",children:[e.jsxs("span",{className:"cm-bulk-count",children:[y.length," selected"]}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:30,fontSize:12,padding:"0 10px"},onClick:()=>Z([]),children:"Clear"}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:30,fontSize:12,padding:"0 10px"},children:"Pause All"}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:30,fontSize:12,padding:"0 10px"},children:"Activate All"}),e.jsx("button",{className:"cm-btn cm-btn-ghost",style:{height:30,fontSize:12,padding:"0 10px"},children:"Export Selected"}),e.jsx("button",{className:"cm-btn cm-btn-danger",style:{height:30,fontSize:12,padding:"0 10px"},children:"Delete"})]}),j==="list"?e.jsx(Il,{campaigns:q,selected:y,onSelect:K,onSelectAll:xe,onSort:ge,sort:$,onRowClick:we,pageSize:b,onPageSizeChange:w=>{L(w),ae(1)},page:Y,onPageChange:ae,onView:w=>{Q(w),ie(!0)},onOpenBuilder:v}):e.jsxs(e.Fragment,{children:[e.jsx(zl,{campaigns:ze,calDate:je,onDateChange:ve,selectedDay:H,onDayClick:(w,z)=>P(ne=>ne===w?null:w)}),H&&(()=>{const w=ze.flatMap(z=>(z.calendarEvents||[]).filter(ne=>ne.date===H).map(ne=>({...ne,campaignName:z.name,campaign:z})));return e.jsxs("div",{className:"cm-cal-daydetail",children:[e.jsxs("div",{className:"cm-cal-daydetail__head",children:[e.jsx("span",{children:H}),e.jsx("button",{className:"cm-cal-daydetail__close",onClick:()=>P(null),children:"✕"})]}),w.length===0?e.jsx("div",{className:"cm-cal-daydetail__empty",children:"No events on this day."}):e.jsx("ul",{className:"cm-cal-daydetail__list",children:w.map((z,ne)=>e.jsxs("li",{className:"cm-cal-daydetail__item",onClick:()=>{Q(z.campaign),ie(!0),P(null)},children:[e.jsx("span",{className:"cm-cal-daydetail__dot",style:{background:{Active:"#10b981",Scheduled:"#3b82f6",Draft:"#8b5cf6",Completed:"#64748b",Failed:"#ef4444",Paused:"#f59e0b"}[z.status]||"#3b82f6"}}),e.jsxs("div",{children:[e.jsx("div",{className:"cm-cal-daydetail__name",children:z.campaignName}),e.jsxs("div",{className:"cm-cal-daydetail__type",children:[z.type," · ",z.status]})]})]},ne))})]})})()]}),j==="list"&&de&&V&&e.jsx(Ra,{campaign:de,onClose:()=>le(!1)}),j==="list"&&de&&!se&&e.jsx("div",{style:{marginTop:16},children:e.jsxs("button",{className:"cm-btn cm-btn-ghost",onClick:()=>le(w=>!w),children:[V?"Hide":"Show"," Journey Association — ",de.journey]})}),j==="list"&&e.jsxs("div",{className:"cm-analytics-strip",children:[e.jsxs("div",{className:"cm-analytics-stat-card",children:[e.jsx("div",{className:"cm-analytics-stat-label",children:"Total Revenue"}),e.jsx("div",{className:"cm-analytics-stat-value",children:yn(te)}),e.jsx("div",{className:"cm-analytics-stat-sub",children:"across all live campaigns"})]}),e.jsxs("div",{className:"cm-analytics-stat-card",children:[e.jsx("div",{className:"cm-analytics-stat-label",children:"Avg Open Rate"}),e.jsxs("div",{className:"cm-analytics-stat-value",children:[G,"%"]}),e.jsxs("div",{className:"cm-analytics-stat-sub",children:[ce.length," active campaigns"]})]}),e.jsxs("div",{className:"cm-analytics-stat-card",children:[e.jsx("div",{className:"cm-analytics-stat-label",children:"Avg CTR"}),e.jsxs("div",{className:"cm-analytics-stat-value",children:[ue,"%"]}),e.jsx("div",{className:"cm-analytics-stat-sub",children:"click-through rate"})]}),e.jsxs("div",{className:"cm-analytics-stat-card",children:[e.jsx("div",{className:"cm-analytics-stat-label",children:"Avg Conversion"}),e.jsxs("div",{className:"cm-analytics-stat-value",children:[fe,"%"]}),e.jsx("div",{className:"cm-analytics-stat-sub",children:"conversion rate"})]})]}),e.jsx(Tl,{campaign:de,open:se,onClose:()=>ie(!1),onOpenBuilder:v})]})]})}const Xt={bp:{title:"Campaigns & Journeys",description:"Browse journeys, open a campaign, and edit the orchestration blueprint."},cfg:{title:"Journey Config",description:"Review audience setup, journey canvas, measurement, and export configuration."},qa:{title:"QA & Automation",description:"Run journey validation suites, profile simulations, and automation checks."}},Ol=`
/* ── Layout: QA tab fills panel height ───────────────────────────────── */
.content-body--qa { padding: 0 !important; overflow: hidden !important; display: flex; flex-direction: column; }
.content-body--qa .jo-embedded { flex: 1; min-height: 0; }
.jo-embedded { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.jo-embedded .jo-subhead { flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; }
.jo-workspace--embedded { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.jo-workspace--embedded .jo-inspector { flex: 1; min-width: 0; overflow-y: auto; border-left: none; }

/* ── Base font: bump everything to 14px for readability ─────────────── */
.jo-embedded, .jo-embedded * { font-size: 14px; }
.jo-embedded .jo-eyebrow { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.6; }
.jo-embedded .jo-jpicker__name { font-size: 14px; font-weight: 600; }
.jo-embedded .jo-spicker__name { font-size: 14px; font-weight: 500; }
.jo-embedded .jo-subhead__meta { font-size: 12px; opacity: 0.6; }
.jo-embedded .jo-btn { font-size: 13px; padding: 7px 16px; border-radius: 6px; font-weight: 600; }
.jo-embedded .jo-inspector__tabs button { font-size: 13px; font-weight: 600; padding: 10px 16px; }

/* ── Locked selectors: disabled appearance with a lock hint ─────────── */
.jo-embedded .jo-jpicker__btn:disabled,
.jo-embedded .jo-spicker__btn:disabled { opacity: 1; cursor: default; }
.jo-embedded .jo-jpicker__btn.is-locked,
.jo-embedded .jo-spicker__btn.is-locked { cursor: default; }
.jo-embedded .jo-jpicker__chev,
.jo-embedded .jo-spicker__btn.is-locked svg { display: none; }

/* ── Profile cards: visible border, padding, larger text ─────────────── */
.jo-embedded .qa-pcard {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.03);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.jo-embedded .qa-pcard:hover { border-color: rgba(74,126,255,0.4); background: rgba(74,126,255,0.06); }
.jo-embedded .qa-pcard.is-active { border-color: #4a7eff; background: rgba(74,126,255,0.12); }
.jo-embedded .qa-pcard__avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(74,126,255,0.2); color: #8ab4ff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.jo-embedded .qa-pcard__name { font-size: 14px; font-weight: 600; color: #dde6f5; }
.jo-embedded .qa-pcard__sub { font-size: 12px; color: #576880; margin-top: 2px; }
.jo-embedded .qa-pgroup__head { font-size: 12px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: #576880; padding: 8px 0 4px; }

/* ── Verdict on profile card: bold green / red text ─────────────────── */
.jo-embedded .qa-pcard__verdict { font-size: 12px; font-weight: 700; border-radius: 4px; padding: 2px 7px; }

/* ── Suite cards: visible border, clear spacing ─────────────────────── */
.jo-embedded .qa-scard {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  background: rgba(255,255,255,0.02);
}
.jo-embedded .qa-scard__head { padding: 12px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
.jo-embedded .qa-scard__head:hover { background: rgba(255,255,255,0.04); }
.jo-embedded .qa-scard.is-open .qa-scard__head { background: rgba(74,126,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); }
.jo-embedded .qa-scard__name { font-size: 14px; font-weight: 600; color: #dde6f5; }
.jo-embedded .qa-scard__desc { font-size: 12px; color: #576880; margin-top: 3px; }
.jo-embedded .qa-scard__meta { font-size: 11px; color: #3a4e6a; margin-top: 3px; }

/* Suite status badge on the card header */
.jo-embedded .qa-scard__status {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #8a9bb5;
}

/* ── Test case list items: bordered rows, clear pass/fail ────────────── */
.jo-embedded .qa-tcase-list { list-style: none; margin: 0; padding: 0; }
.jo-embedded .qa-tcase {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.jo-embedded .qa-tcase:last-child { border-bottom: none; }
.jo-embedded .qa-tcase__title { font-size: 13px; font-weight: 500; color: #dde6f5; }
.jo-embedded .qa-tcase__desc { font-size: 12px; color: #576880; margin-top: 3px; }
.jo-embedded .qa-tcase__badge {
  flex-shrink: 0; padding: 3px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 700; border: 1px solid transparent;
  white-space: nowrap; min-width: 52px; text-align: center;
  background: rgba(255,255,255,0.07); color: #8a9bb5;
}

/* ── PASS = solid green, FAIL = solid red (override CSS vars) ────────── */
.jo-embedded [style*="var(--ok)"],
.jo-embedded .qa-tcase--pass .qa-tcase__badge,
.jo-embedded .qa-scard__status[title="PASS"] { background: #16a34a !important; color: #fff !important; border-color: transparent !important; }

.jo-embedded [style*="var(--danger)"],
.jo-embedded .qa-tcase--fail .qa-tcase__badge,
.jo-embedded .qa-scard__status[title="FAIL"] { background: #dc2626 !important; color: #fff !important; border-color: transparent !important; }

/* QA check rows in simulation results */
.jo-embedded .qa-check {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.jo-embedded .qa-check:last-child { border-bottom: none; }
.jo-embedded .qa-check__title { font-size: 13px; font-weight: 500; color: #dde6f5; }
.jo-embedded .qa-check__desc { font-size: 12px; color: #576880; margin-top: 2px; }
.jo-embedded .qa-check__ok {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #fff;
}
.jo-embedded .qa-check--pass .qa-check__ok { background: #16a34a !important; }
.jo-embedded .qa-check--fail .qa-check__ok { background: #dc2626 !important; }
.jo-embedded .qa-check--skipped .qa-check__ok { background: #6b7280 !important; }

.jo-embedded .qa-check__verdict { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
.jo-embedded .qa-check__verdict--pass { background: rgba(22,163,74,0.18); color: #4ade80 !important; }
.jo-embedded .qa-check__verdict--fail { background: rgba(220,38,38,0.18); color: #f87171 !important; }
.jo-embedded .qa-check__verdict--skipped { background: rgba(107,114,128,0.18); color: #9ca3af !important; }

/* Profile card verdict pill */
.jo-embedded .qa-pcard__verdict { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }

/* ── Simulation results column ───────────────────────────────────────── */
.jo-embedded .qa-simgroup { margin-bottom: 16px; }
.jo-embedded .qa-simgroup__head { font-size: 13px; font-weight: 700; color: #8ab4ff; padding: 8px 14px; background: rgba(74,126,255,0.08); border-radius: 6px; margin-bottom: 4px; }
.jo-embedded .qa-meta-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 12px; }
.jo-embedded .qa-meta-card__label { font-size: 11px; color: #576880; text-transform: uppercase; letter-spacing: 0.04em; }
.jo-embedded .qa-meta-card__value { font-size: 13px; font-weight: 500; color: #dde6f5; margin-top: 2px; }

/* ── Workbench columns ───────────────────────────────────────────────── */
.jo-embedded .qa-wb { display: flex; height: 100%; min-height: 0; }
.jo-embedded .qa-wb__col { flex: 1; min-width: 0; border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; overflow: hidden; }
.jo-embedded .qa-wb__col:last-child { border-right: none; }
.jo-embedded .qa-wb__head { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.jo-embedded .qa-wb__head h3 { font-size: 14px; font-weight: 700; color: #dde6f5; margin: 0; }
.jo-embedded .qa-wb__count { font-size: 12px; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 10px; color: #8a9bb5; }
.jo-embedded .qa-wb__scroll { flex: 1; overflow-y: auto; padding: 10px 12px; }
.jo-embedded .qa-wb__filters { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
/* Column-3 chip: clamp width so it never overflows the column header */
.jo-embedded .qa-wb__chip { font-size: 11px; padding: 2px 9px; border-radius: 9px; background: rgba(74,126,255,0.12); color: #8ab4ff; font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 1; min-width: 0; }
.jo-embedded .qa-chip-btn { font-size: 12px; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #8a9bb5; cursor: pointer; }
.jo-embedded .qa-chip-btn.is-on { background: rgba(74,126,255,0.2); border-color: #4a7eff; color: #8ab4ff; font-weight: 600; }

/* ── Table in ProfilesTab ────────────────────────────────────────────── */
.jo-embedded .jo-table { width: 100%; border-collapse: collapse; }
.jo-embedded .jo-table th { font-size: 12px; font-weight: 600; color: #576880; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
.jo-embedded .jo-table td { font-size: 13px; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #dde6f5; }
.jo-embedded .jo-table tr:last-child td { border-bottom: none; }
.jo-embedded .jo-tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.jo-embedded .jo-tag--test { background: rgba(74,126,255,0.16); color: #8ab4ff; }
.jo-embedded .jo-tag--control { background: rgba(167,139,250,0.16); color: #c4b5fd; }
.jo-embedded .jo-tag--holdout { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-embedded .jo-tag--suppressed { background: rgba(248,113,113,0.14); color: #f87171; }
.jo-embedded .jo-tag--fcap-risk { background: rgba(251,191,36,0.14); color: #fbbf24; }
.jo-embedded .jo-prof__name { font-size: 13px; font-weight: 600; }
.jo-embedded .jo-prof__id { font-size: 11px; color: #576880; }

/* ── Responsive: embedded QA ─────────────────────────────────────────── */
@media (max-width: 1200px) {
  .jo-embedded .jo-subhead { flex-wrap: wrap; height: auto; min-height: 56px; padding: 8px 16px; gap: 8px; }
  .jo-embedded .jo-subhead__title { flex-wrap: wrap; gap: 10px; }
  .jo-embedded .jo-jpicker { min-width: 180px; max-width: 260px; }
  .jo-embedded .jo-spicker { min-width: 140px; max-width: 200px; }
  .jo-embedded .jo-subhead__meta { display: none; }
}

@media (max-width: 900px) {
  .jo-embedded .jo-subhead { flex-direction: column; align-items: flex-start; padding: 10px 16px; gap: 10px; }
  .jo-embedded .jo-subhead__title { width: 100%; }
  .jo-embedded .jo-subhead__right { width: 100%; justify-content: flex-end; }
  .jo-embedded .jo-jpicker { min-width: 0; max-width: 100%; flex: 1 1 160px; }
  .jo-embedded .jo-spicker { min-width: 0; max-width: 100%; flex: 1 1 140px; }
  .jo-embedded .jo-jpicker__btn, .jo-embedded .jo-spicker__btn { width: 100%; }
  /* Workbench: scroll horizontally so columns don't crush below 900px */
  .jo-embedded .qa-wb { overflow-x: auto; }
  .jo-embedded .qa-wb__col { min-width: 220px; flex: 0 0 220px; }
}

@media (max-width: 640px) {
  /* Workbench: stack vertically */
  .jo-embedded .qa-wb { flex-direction: column; height: auto; overflow-x: hidden; overflow-y: auto; }
  .jo-embedded .qa-wb__col { min-width: 0; flex: none; height: 300px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .jo-embedded .qa-wb__col:last-child { border-bottom: none; height: auto; min-height: 220px; }
  /* Inspector fills full width */
  .jo-embedded .jo-inspector { min-width: 0; width: 100%; }
}
`;function Qt({activatedSegments:n,section:t,onRouteRequest:s,themeMode:a,initialJourneySlug:r=null}){const i=m.useRef(null),[d,p]=m.useState(null);return m.useEffect(()=>{i.current&&p(o=>o??i.current.shadowRoot??i.current.attachShadow({mode:"open"}))},[]),e.jsx("div",{ref:i,style:{flex:1,minHeight:0,display:"block"},children:d?ls.createPortal(e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`:host{display:block;height:100%;}${jr}${us.replace(":root {",":host {").replace("body {",".jo {")}${Ol}`}),e.jsx("div",{"data-theme":a,style:{height:"100%"},children:e.jsx(tl,{activatedSegments:n,forcedRoute:t,showSidebar:!1,onRouteRequest:s,initialJourneySlug:r})})]}),d):null})}function Vl({activatedSegments:n,section:t="bp",themeMode:s="dark"}){const a=Zt(),[r]=rs(),i=r.get("journey"),d=Xt[t]??Xt.bp;function p(o){if(o==="cfg"){a("/journey-config");return}if(o==="qa"){a("/qa-automation");return}a("/campaigns-and-journeys")}return t==="bp"&&!i?e.jsx(Ll,{activatedSegments:n}):t==="bp"&&i?e.jsxs("section",{style:{minHeight:"100%",display:"flex",flexDirection:"column"},children:[e.jsxs("div",{className:"page-header",style:{display:"flex",alignItems:"center",gap:12},children:[e.jsx("button",{onClick:()=>a("/campaigns-and-journeys"),style:{display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"1px solid var(--border)",color:"var(--text-secondary)",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0},children:"← Campaign Manager"}),e.jsxs("div",{children:[e.jsx("div",{className:"page-title",children:"Journey Builder"}),e.jsxs("div",{className:"page-description",children:["Editing: ",i.replace(/-/g," ").replace(/\b\w/g,o=>o.toUpperCase())]})]})]}),e.jsx("div",{className:"page-body",style:{flex:1,minHeight:0,display:"flex",flexDirection:"column"},children:e.jsx("div",{style:{flex:1,minHeight:760,display:"flex",overflow:"hidden",borderRadius:12,border:"1px solid var(--border)",background:"var(--bg-primary)",boxShadow:"var(--shadow-lg)"},children:e.jsx(Qt,{activatedSegments:n,section:"bp",onRouteRequest:p,themeMode:s,initialJourneySlug:i})})})]}):e.jsxs("section",{style:{minHeight:"100%",display:"flex",flexDirection:"column"},children:[e.jsxs("div",{className:"page-header",children:[e.jsx("div",{className:"page-title",children:d.title}),e.jsx("div",{className:"page-description",children:d.description})]}),e.jsx("div",{className:"page-body",style:{flex:1,minHeight:0,display:"flex",flexDirection:"column"},children:e.jsx("div",{style:{flex:1,minHeight:760,display:"flex",overflow:"hidden",borderRadius:12,border:"1px solid var(--border)",background:"var(--bg-primary)",boxShadow:"var(--shadow-lg)"},children:e.jsx(Qt,{activatedSegments:n,section:t,onRouteRequest:p,themeMode:s})})})]})}export{Vl as default};
