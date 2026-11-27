"use strict";
/* ================= Hilfen ================= */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function h(tag,attrs={},...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)))}return e}
const fmt=(n,d=0)=>(n==null||!isFinite(n))?"–":Number(n).toLocaleString("de-DE",{minimumFractionDigits:d,maximumFractionDigits:d});
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseD=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return iso(d)};
const WD=["Mo","Di","Mi","Do","Fr","Sa","So"],WDL=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
const MON=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const dowOf=s=>(parseD(s).getDay()+6)%7;
const short=s=>{const d=parseD(s);return WD[dowOf(s)]+", "+d.getDate()+"."+(d.getMonth()+1)+"."};
const long=s=>{const d=parseD(s);return WDL[dowOf(s)]+", "+d.getDate()+". "+MON[d.getMonth()]};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ratio=(a,b)=>b>0?clamp(a/b,0,1):1;
const uid=()=>Math.random().toString(36).slice(2,10);
const pace=sec=>{if(!sec||!isFinite(sec))return"–";sec=Math.round(sec);return Math.floor(sec/60)+":"+pad(sec%60)};
const todayISO=()=>iso(new Date());
function toast(msg){const t=h("div",{class:"toast",role:"status"},msg);document.body.append(t);setTimeout(()=>t.remove(),2200)}
const NI=Object.fromEntries(NK.map((k,i)=>[k,i]));
const NMETA=Object.fromEntries(NUTR.map(n=>[n[0],{key:n[0],name:n[1],unit:n[2],t:n[3],ul:n[4],g:n[5],d:n[6]}]));

/* ================= Speicher (nur auf dem Gerät) ================= */
const KEY="ultra100.v2";
function freshState(){return{days:{},custom:[],settings:{weight:78,p5:null,p5date:null,supps:SUPP_DEFAULT.map(s=>({...s,active:!s.optional}))}}}
let S;
try{S=JSON.parse(localStorage.getItem(KEY))||freshState()}catch(e){S=freshState()}
S.days??={};S.custom??=[];S.learn??={};S.settings??=freshState().settings;S.settings.supps??=freshState().settings.supps;
for(const d of SUPP_DEFAULT)if(!S.settings.supps.find(s=>s.id===d.id))S.settings.supps.push({...d,active:!d.optional});
if(!S.settings.mig6){for(const s of S.settings.supps){const d=SUPP_DEFAULT.find(x=>x.id===s.id);if(!d)continue;if(["d3","k2","evoo"].includes(s.id)){s.active=true;if(s.id==="d3")s.dose=d.dose}s.nut=d.nut;s.food=d.food;s.fac=d.fac;s.al=d.al;s.name=d.name;s.unit=d.unit}S.settings.mig6=true}
let saveT=null;
/* Änderungszeit je Tag merken, damit der Sync Tage zusammenführen kann */
let HASH={};function stamp(){const now=Date.now();for(const[k,d]of Object.entries(S.days)){const{u,...rest}=d;const j=JSON.stringify(rest);if(HASH[k]!==undefined&&HASH[k]!==j)d.u=now;HASH[k]=j}
  const st=JSON.stringify([S.settings,S.custom.length,Object.keys(S.learn||{}).length].map((x,i)=>i?x:{...x,u:0}));if(HASH._s!==undefined&&HASH._s!==st)S.settings.u=now;HASH._s=st;
  for(const k of Object.keys(S.days))if(HASH[k]===undefined)HASH[k]=JSON.stringify((({u,...r})=>r)(S.days[k]))}
function rehash(){HASH={};stamp()}
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{for(const k of Object.keys(S.days))if(HASH[k]===undefined){HASH[k]=dayWeight(S.days[k])?"":JSON.stringify((({u,...r})=>r)(S.days[k]));}stamp();localStorage.setItem(KEY,JSON.stringify(S))}catch(e){toast("Speichern fehlgeschlagen: Speicher voll?")}syncSoon()},150)}
function day(ds){const d=S.days[ds]||(S.days[ds]={});d.entries??=[];d.workouts??=[];d.check??={};d.supps??={};return d}
const hasDay=ds=>!!S.days[ds];
function foodById(id){return FOODS[id]||S.custom.find(c=>c.id===id)||null}

/* ================= Plan ================= */
function planFor(ds){
  const diff=Math.round((parseD(ds)-START)/864e5);
  if(diff<0)return{pre:true};const wk=Math.floor(diff/7)+1;if(wk>41)return{post:true};
  const dow=diff%7,r=PLAN[wk-1],[key,di,mi,dn,sa,so,sum,note]=r;
  const[keyTue,keyThu]=key.split(" · Do: ");
  let run={km:0,kind:"rest"};
  if(dow===1)run={km:di,kind:/^GA locker/.test(keyTue)?"easy":/^GA/.test(keyTue)?"strides":"key",key:keyTue};
  if(dow===2)run=mi?{km:mi,kind:"easy"}:{km:0,kind:"rest"};
  if(dow===3)run=keyThu?{km:dn,kind:"key",key:keyThu,hilly:true}:{km:dn,kind:"easy",hilly:true};
  if(dow===5)run=wk===41?{km:100,kind:"race"}:{km:sa,kind:"long"};
  if(dow===6)run=so?{km:so,kind:so>=10?"b2b":"recovery"}:{km:0,kind:"walk",min:45};
  let gym=null,gymNote="";
  if(dow===0){const prevSat=wk>1?PLAN[wk-2][4]:0;if(/Mo kein Gym/.test(note))gymNote="Laut Plan diesen Montag kein Gym.";else if(prevSat>=42)gymNote="Beine fallen aus (Long Run ab 42 km).";else if(wk===41)gymNote="Ab 10 Tage vor dem Rennen keine schweren Beine.";else gym="beine"}
  if(dow===1)gym="push";if(dow===3)gym="pull";if(dow===4)gym="mix";if(dow===6)gym="prehab";
  const ph=PHASES.find(p=>wk>=p[0]&&wk<=p[1]);
  return{wk,dow,sum,note,phase:ph[2],run,gym,gymNote,deload:/Entlastung|Erholung/.test(note),legsLate:ds>="2027-06-01",race:wk===41&&dow===5,carbLoad:wk===41&&dow>=2&&dow<=4};
}

/* ================= Training: Auswertung & Vorschläge ================= */
function runsOf(ds){return hasDay(ds)?day(ds).workouts.filter(w=>w.type==="run"):[]}
function kmOf(ds){return runsOf(ds).reduce((a,w)=>a+(w.km||0),0)}
function kmRange(from,to){let k=0;for(let d=from;d<=to;d=addDays(d,1))k+=kmOf(d);return k}
function isHardDay(ds){if(!hasDay(ds))return false;if((day(ds).check.strain||0)>=15)return true;return day(ds).workouts.some(w=>(w.type==="run"&&((w.rpe||0)>=6||(w.km||0)>=20))||((w.type==="swim"||w.type==="bike")&&(w.rpe||0)>=7))}
function gymOf(ds){return hasDay(ds)?day(ds).workouts.filter(w=>w.type==="gym"):[]}
function zones(){
  const p5=S.settings.p5;
  if(p5)return{src:"aus deinem 5-km-Test",R:[p5+120,null],GA:[p5+75,p5+120],M:[p5+30,p5+50],S:[p5+12,p5+28]};
  return{src:"Startwerte aus dem Plan",R:[435,null],GA:[390,435],M:[350,375],S:[320,340]};
}
const zoneTxt=z=>z[1]?pace(z[0])+"–"+pace(z[1])+" /km":"langsamer als "+pace(z[0])+" /km";
function easyPaceRecent(ds){const p=[];for(let i=1;i<=28;i++){for(const w of runsOf(addDays(ds,-i)))if(w.km>=3&&w.min&&(w.rpe||4)<=4.5)p.push(w.min*60/w.km)}if(p.length<2)return null;p.sort((a,b)=>a-b);return p[Math.floor(p.length/2)]}
function lastEx(name,before){
  const keys=Object.keys(S.days).filter(k=>k<before).sort().reverse();const res=[];
  for(const k of keys){for(const w of S.days[k].workouts||[])if(w.type==="gym")for(const e of w.ex||[])if(e.name===name&&(e.reps||e.kg)){res.push({...e,ds:k});if(res.length>=2)return res}}
  return res;
}
function prescribe(ex,sets){
  const[name,,lo,hi,inc]=ex;const hist=lastEx(name,"9999");const last=hist[0];
  if(hi<=1)return{name,sets,reps:"",kg:null,hint:""};
  if(!last||!last.kg)return{name,sets,reps:lo,kg:last?last.kg||null:null,range:lo===hi?String(lo):lo+"–"+hi,hint:last?"Letztes Mal "+(last.reps||"?")+" Wdh.":"Gewicht wählen, bei dem 2 Wdh. Reserve bleiben"};
  let kg=last.kg,reps=lo,hint;
  if((last.reps||0)>=hi&&inc>0){kg=Math.round((last.kg+inc)*4)/4;reps=lo;hint="Oberes Ende geschafft: +"+fmt(inc,1)+" kg"}
  else if((last.reps||0)<lo){const twice=hist[1]&&hist[1].kg===last.kg&&(hist[1].reps||0)<lo;if(twice){kg=Math.round(last.kg*0.95*4)/4;hint="Zweimal unter "+lo+" Wdh.: 5 % leichter"}else{hint="Gleiches Gewicht, Ziel "+lo+" Wdh."}reps=lo}
  else{reps=Math.min(hi,(last.reps||lo)+1);hint="Gleiches Gewicht, 1 Wdh. mehr als letztes Mal"}
  return{name,sets,reps,kg,range:lo===hi?String(lo):lo+"–"+hi,hint};
}
/* Körperwerte (WHOOP/Noop, Apple Health oder von Hand): Basis = Ø der 28 Tage davor */
function bioBase(ds,k){const v=[];for(let i=1;i<=28;i++){const x=addDays(ds,-i);if(hasDay(x)&&day(x).check[k]!=null)v.push(day(x).check[k])}return v.length>=4?v.reduce((a,b)=>a+b,0)/v.length:null}
function readiness(ds){const ch=hasDay(ds)?day(ds).check:{};const r={sig:0,rot:false,why:[],good:false};
  if(ch.rec!=null){if(ch.rec<34){r.sig++;r.why.push("Recovery "+fmt(ch.rec)+" % (rot)")}else if(ch.rec>=67)r.good=true}
  const bh=bioBase(ds,"hrv"),br=bioBase(ds,"rhr");let hd=false,rd=false;
  if(ch.hrv!=null&&bh){if(ch.hrv<0.85*bh){r.sig++;hd=ch.hrv<0.75*bh;r.why.push("HRV "+fmt(ch.hrv)+" ms, sonst Ø "+fmt(bh))}}
  if(ch.rhr!=null&&br){if(ch.rhr>=br+5){r.sig++;rd=ch.rhr>=br+8;r.why.push("Ruhepuls "+fmt(ch.rhr)+", sonst Ø "+fmt(br))}}
  if(hd&&rd){r.rot=true}
  return r}
function ampelOf(ch,ds){if(!ch)return null;const f=ch.flags||[];const R=ds?readiness(ds):{sig:0,rot:false};
  if(ch.sleep==null&&ch.knee==null&&!f.length&&ch.rec==null&&ch.hrv==null&&ch.rhr==null)return null;
  if((ch.knee??0)>=5||f.includes("fieber")||f.includes("hinken")||R.rot)return"rot";
  if(f.includes("müde")||f.includes("stress")||(ch.sleep!=null&&ch.sleep<6.5)||(ch.knee??0)>=3||R.sig>0)return"gelb";return"grün"}
function runDesc(kind,key,km,z,extra={}){
  const GA=zoneTxt(z.GA);
  if(kind==="rest")return{title:"Lauffrei",detail:"Erholung gehört zum Training. Gern 20–30 min spazieren."};
  if(kind==="walk")return{title:"45 min spazieren",detail:"Locker gehen statt laufen. Fördert die Erholung."};
  if(kind==="race")return{title:"RENNEN: 100 km",detail:"Start 5:30 Uhr. km 0–25 RPE 3, jede Steigung gehen, ab Minute 20 essen, 60–80 g KH/h."};
  if(kind==="long"||kind==="b2b"){const c=km>=25?"60–75":km>=16?"30–60":"0–30";return{title:fmt(km,km%1?1:0)+" km "+(kind==="b2b"?"lang, 2. Tag (B2B)":"Long Run"),detail:"RPE 3–4 · "+GA+" · bergauf gehen erlaubt · "+c+" g KH pro Stunde"}}
  if(kind==="recovery")return{title:fmt(km)+" km Regeneration",detail:"RPE 2–3 · "+zoneTxt(z.R)+" · sehr locker"};
  if(kind==="strides")return{title:fmt(km)+" km locker + Steigerungen",detail:"GA "+GA+", am Ende "+((key||"").match(/\d+×\d+ s/)||["4–6×20 s"])[0]+" zügig steigern, dazwischen locker traben"};
  if(kind==="easy")return{title:fmt(km,km%1?1:0)+" km locker"+(extra.hilly?", hügelig":""),detail:"GA · RPE 3–4 · "+GA+" · ganze Sätze reden"};
  // Schlüsseleinheit
  let m,t=key||"";
  if(/5-km-Test/.test(t))return{title:"5-km-Test ("+fmt(km)+" km gesamt)",detail:"1,5 km ein, 5 km so schnell wie gleichmäßig möglich, 1,5 km aus. Trag die 5-km-Zeit ein, dann berechne ich deine Zonen neu."};
  if((m=t.match(/^S (\d+)×(\d+) min/)))return{title:fmt(km)+" km mit Schwelle "+m[1]+"×"+m[2]+" min",detail:"2 km einlaufen, "+m[1]+"× "+m[2]+" min Schwelle ("+zoneTxt(z.S)+", RPE 6–7, nur kurze Sätze), 2 min Trabpause, Rest locker"};
  if((m=t.match(/^M (\d+)×(\d+) min/)))return{title:fmt(km)+" km mit "+m[1]+"×"+m[2]+" min Steady",detail:"Einlaufen, "+m[1]+"× "+m[2]+" min M ("+zoneTxt(z.M)+", RPE 5), 2 min locker dazwischen"};
  if((m=t.match(/(\d+) min M/)))return{title:fmt(km)+" km mit "+m[1]+" min Steady",detail:"Locker einlaufen, dann "+m[1]+" min am Stück M ("+zoneTxt(z.M)+", RPE 5), locker aus"};
  if((m=t.match(/Fahrtspiel (\d+)×(\d+) (min|s)/)))return{title:fmt(km)+" km Fahrtspiel "+m[1]+"×"+m[2]+" "+m[3],detail:"Im lockeren Lauf "+m[1]+"× "+m[2]+" "+m[3]+" zügig (RPE 6–7), dazwischen gleich lang locker"};
  if((m=t.match(/(\d+)×(\d+) s Bergsprints/)))return{title:fmt(km)+" km locker + "+m[1]+"×"+m[2]+" s Bergsprints",detail:"GA "+GA+", am Hügel "+m[1]+"× "+m[2]+" s kräftig bergauf, zurück gehen"};
  if((m=t.match(/bergab/)))return{title:fmt(km)+" km mit 6×1 min bergab",detail:"Locker, 6× 1 min zügig bergab mit kurzen Schritten, zurück locker"};
  if((m=t.match(/Berg.*?(\d+)×(\d+) (min|s)/)))return{title:fmt(km)+" km mit Berg "+m[1]+"×"+m[2]+" "+m[3],detail:"Einlaufen, "+m[1]+"× "+m[2]+" "+m[3]+" bergauf (RPE 7–8)"+(/Power-Hiking/.test(t)?" als Power-Hiking":"")+", runter locker traben oder gehen"};
  return{title:fmt(km)+" km "+t,detail:"GA "+GA};
}
/* Vorschläge für mehrere Tage, beginnend bei ds */
function suggest(from,n=3){
  const out=[];let carry=null;const today=todayISO();
  for(let i=0;i<n;i++){
    const ds=addDays(from,i),p=planFor(ds),z=zones(),why=[];
    const d=hasDay(ds)?day(ds):null;
    const amp=ds===today&&d?ampelOf(d.check,ds):null;const R=ds===today&&d?readiness(ds):null;
    let kind="rest",km=0,key=null,extra={};
    if(p.wk){kind=p.run.kind;km=p.run.km;key=p.run.key;extra={hilly:p.run.hilly}}
    else if(p.pre){const dw=dowOf(ds);if(dw===1||dw===3||dw===5){kind="easy";km=6}}
    else{kind="easy";km=5}
    // gestern hart? (eingetragen oder vorgeschlagen)
    const y=addDays(ds,-1);const yHard=isHardDay(y)||(i>0&&out[i-1].hard&&!runsOf(y).length);
    if((kind==="key")&&yHard){carry={key,km};kind="easy";why.push("Gestern war hart: heute locker, die Schlüsseleinheit kommt morgen (nie zwei harte Tage hintereinander).")}
    else if(carry&&(kind==="easy"||kind==="strides")&&!yHard&&p.dow!==4&&p.dow!==5){kind="key";key=carry.key;km=Math.max(km,carry.km);why.push("Schlüsseleinheit von gestern hierher verschoben.");carry=null}
    if(carry&&p.dow>=4){carry=null}
    // Belastung der letzten Wochen
    const acute=kmRange(addDays(ds,-7),addDays(ds,-1)),chronic=kmRange(addDays(ds,-28),addDays(ds,-8))/3;
    if(km>0&&chronic>8&&acute>1.3*chronic){km=Math.round(km*0.85*2)/2;why.push(`Die letzten 7 Tage ${fmt(acute)} km, sonst Ø ${fmt(chronic)} km: heute etwas kürzer.`)}
    // Wochensumme
    if(p.wk&&km>0){const mon=addDays(ds,-p.dow);const done=kmRange(mon,addDays(ds,-1));if(done+km>p.sum*1.15&&kind!=="race"){const nk=Math.max(0,Math.round((p.sum*1.1-done)*2)/2);if(nk<km){why.push(`Diese Woche schon ${fmt(done,1)} von ${p.sum} km: heute weniger.`);km=nk;if(km<3){kind="rest";km=0}}}}
    // Ampel
    if(amp==="gelb"&&km>0){km=Math.round(km*0.7*2)/2;if(kind==="key"||kind==="strides")kind="easy";why.push("Ampel gelb"+(R&&R.why.length?" ("+R.why.join(", ")+")":"")+": alles locker, Umfang −30 %.")}
    if(amp==="rot"){kind="rest";km=0;why.push(R&&R.rot?"HRV deutlich unten und Ruhepuls deutlich oben: oft ein Zeichen, dass ein Infekt kommt. Heute Pause.":"Ampel rot: Pause. Hält es 3 Tage an, zum Arzt oder Physio.")}
    if(amp==="grün"&&R&&R.good&&kind==="key")why.push("Recovery grün: gute Voraussetzungen für die Schlüsseleinheit.");
    const knee=d&&d.check.knee;
    if(knee>=3&&knee<5&&km>0)why.push("Knie "+knee+"/10: Alternative wäre 40 min locker Rad oder Schwimmen.");
    const run=runDesc(kind,key,km,z,extra);
    // Gym
    let gym=null,gymWhy=[];
    if(amp!=="rot"){
      let g=p.wk?p.gym:(p.pre?null:null);
      const mon=p.wk?addDays(ds,-p.dow):addDays(ds,-dowOf(ds));
      const done=new Set();for(let x=mon;x<ds;x=addDays(x,1))for(const w of gymOf(x))done.add(w.session);
      if(i>0)for(let j=0;j<i;j++)if(out[j].gym)done.add(out[j].gym.id);
      const upper=["push","pull","mix"];
      if(g&&upper.includes(g)&&done.has(g)){const miss=upper.find(u=>!done.has(u));if(miss){gymWhy.push(GYM[g].name+" hast du diese Woche schon gemacht, deshalb heute "+GYM[miss].name+".");g=miss}else{g=null;gymWhy.push("Alle Oberkörper-Einheiten dieser Woche erledigt.")}}
      if(!g&&p.wk&&p.dow===2){const plannedBefore=["push"].filter(u=>!done.has(u));if(plannedBefore.length){g=plannedBefore[0];gymWhy.push("Push von Dienstag fehlt noch: heute nachholen (≥ 6 h nach dem Lauf).")}}
      if(g){
        const tpl=GYM[g];let adj=(p.deload?-1:0)+(amp==="gelb"?-1:0);
        const exs=tpl.ex.map(e=>{let s=e[1]+adj;if(tpl.leg&&p.legsLate)s=Math.min(s,2);return prescribe(e,Math.max(1,s))});
        if(p.deload)gymWhy.push("Entlastungswoche: 1 Satz weniger.");
        gym={id:g,name:tpl.name,ex:exs,rir:tpl.leg?"RIR 2–3, nie bis zum Muskelversagen":"RIR 0–2"};
      }
    }
    const hard=kind==="key"||kind==="long"&&km>=20||kind==="race";
    const loggedRuns=runsOf(ds),loggedGym=gymOf(ds);
    out.push({ds,p,kind,km,key,run,why,gym,gymWhy:gymWhy.concat(p.gymNote?[p.gymNote]:[]),hard,amp,loggedRuns,loggedGym,easyPace:easyPaceRecent(ds),z});
  }
  return out;
}

/* ================= Ernährung: Ziele & Summen ================= */
function targetsFor(ds){
  const p=planFor(ds),w=S.settings.weight||78,d=hasDay(ds)?day(ds):null;
  // tatsächliches Training hat Vorrang vor dem Plan
  const loggedKm=kmOf(ds);const sug=ds>=todayISO()?suggest(ds,1)[0]:null;
  const km=loggedKm||(sug?sug.km:(p.run?p.run.km:0));const longRun=(d&&runsOf(ds).some(r=>r.km>=16))||(sug&&(sug.kind==="long"||sug.kind==="b2b"));
  const gym=gymOf(ds).length>0||(sug&&sug.gym);const keyDay=(sug&&sug.kind==="key")||runsOf(ds).some(r=>(r.rpe||0)>=6);
  const other=d?d.workouts.filter(x=>x.type==="swim"||x.type==="bike"||x.type==="other").reduce((a,x)=>a+(x.min||0),0):0;
  let t;
  // Basis: 3200 kcal, 200 g Protein, 400 g KH, ~90 g Fett. Trainingstage mehr KH.
  const mk=(kcal,f,label)=>({kcal,p:200,f,c:Math.round((kcal-200*4-f*9)/4),label});
  if(p.race)t={kcal:7000,p:170,c:1100,f:110,label:"Renntag"};
  else if(p.carbLoad){const c=Math.round(9*w);t={kcal:200*4+c*4+80*9,p:200,c,f:80,label:"Carb-Loading"}}
  else if(longRun&&km>=35)t=mk(6250,110,"Long Run 35–50 km");
  else if(longRun&&km>=20)t=mk(4800,100,"Long Run 20–30 km");
  else if(keyDay&&gym)t=mk(3800,90,"Schlüsseleinheit + Gym");
  else if(km>0)t=mk(3500,90,"Lauftag");
  else t=mk(3200,89,"Gym- oder Ruhetag");
  if(!p.race&&!p.carbLoad){
    if(km>12&&!(longRun&&km>=20)){const add=Math.round((km-10)*w*0.9);t.kcal+=add;t.c+=Math.round(add/4)}
    if(other>=30){const add=Math.round(other*8);t.kcal+=add;t.c+=Math.round(add/4)}
  }
  return t;
}
function itemNut(it){const f=it.fid?foodById(it.fid):null;const per=f?f.n:it.n;if(!per)return NK.map(()=>0);return NK.map((k,i)=>(per[i]||0)*(it.g||0)/100)}
function itemFlags(it){if(it.fid){const f=foodById(it.fid);return f?f.fl||"":""}return it.fl||""}
function itemName(it){if(it.fid){const f=foodById(it.fid);return f?f.name:it.fid}return it.name||"Lebensmittel"}
function totals(ds){
  const T={};NK.forEach(k=>T[k]=0);T.veg=0;T.addSug=0;T.proc=0;T.alc=0;T.pMeals=0;T.suppMg=0;
  if(!hasDay(ds))return T;const d=day(ds);
  for(const e of d.entries){let ep=0;for(const it of e.items){const n=itemNut(it);NK.forEach((k,i)=>T[k]+=n[i]);ep+=n[NI.p];const fl=itemFlags(it);
    if(fl.includes("v"))T.veg+=it.g;if(fl.includes("s"))T.addSug+=n[NI.sug];if(fl.includes("x"))T.proc+=n[NI.kcal];if(fl.includes("a")){const f=foodById(it.fid);T.alc+=it.g/((f&&f.dr)||250)}}
    if(ep>=25)T.pMeals++}
  for(const s of S.settings.supps){if(!d.supps[s.id])continue;if(s.food&&FOODS[s.food]){const g=s.dose*(s.fac||1);FOODS[s.food].n.forEach((v,i)=>T[NK[i]]+=(v||0)*g/100)}else if(s.nut){const amt=s.dose*(s.fac||1);T[s.nut]+=amt;if(s.nut==="mg")T.suppMg+=amt}}
  return T;
}
function workSum(ds){let km=0,min=0,hard=false,gym=0,walk=0,other=0;if(!hasDay(ds))return{km,min,hard,gym,walk,other};
  for(const w of day(ds).workouts){if(w.type==="run"){km+=w.km||0;min+=w.min||0;if((w.rpe||0)>=6)hard=true}else if(w.type==="gym")gym++;else if(w.type==="walk")walk+=w.min||0;else other+=w.min||0}
  return{km,min,hard,gym,walk,other}}

/* ================= Speicher-Nährstoffe =================
   Was der Körper speichert, muss nicht jeden Tag gedeckt sein: Fettlösliche Vitamine (A, D, E), B12 und Folat
   (Leber), Eisen (Ferritin), Jod (Schilddrüse), Selen, Kupfer, EPA/DHA (Zellmembranen), Lutein/Lycopin (Gewebe).
   Für sie zählt der Schnitt der letzten Tage mit Einträgen. Zink, Calcium, Magnesium und Vitamin K haben nur kleine
   oder langsam verfügbare Speicher: kurzes Fenster. Vitamin C, B1, B2, B3, B5, B6, Biotin, Cholin, Kalium, Protein
   und Ballaststoffe zählen pro Tag. */
const DEPOT={vA:7,vD:7,vE:7,b9:7,b12:7,fe:7,io:7,se:7,cu:7,o3:7,lut:7,lyc:7,vK:3,zn:3,ca:3,mg:2};
function depotDays(ds,n){const out=[ds];for(let i=1;i<n;i++){const d=addDays(ds,-i);if(hasDay(d)&&day(d).entries.length)out.push(d)}return out}
function effT(ds,T=totals(ds)){const E={...T},win={},memo={[ds]:T};const tot=d=>memo[d]||(memo[d]=totals(d));
  for(const[k,n]of Object.entries(DEPOT)){const dd=depotDays(ds,n);E[k]=dd.reduce((a,d)=>a+tot(d)[k],0)/dd.length;win[k]=dd.length}
  E._win=win;return E}

/* ================= Tagesbilanz (Scores) ================= */
function scores(ds){
  const T=totals(ds),E=effT(ds,T),tg=targetsFor(ds),W=workSum(ds),d=hasDay(ds)?day(ds):{check:{}},w=S.settings.weight||78;
  const sleep=d.check.sleep,sl=x=>sleep==null?0.5:ratio(sleep,x);
  const sug=suggest(ds,1)[0];const planKm=sug.km;
  const mk=(got,max,text)=>({got:max?clamp(got,0,max):got,max,text});
  const U=[],M=[],L=[],X=[];
  if(planKm>0){let g=35*ratio(W.km,planKm),t=fmt(W.km,1)+" von "+fmt(planKm,1)+" km gelaufen";if(W.km>planKm*1.3){g-=8;t+=", deutlich mehr als vorgeschlagen"}U.push(mk(g,35,t))}
  else U.push(mk(W.hard?20:35,35,W.km?"Lauf an einem lauffreien Tag":"Lauffreier Tag eingehalten"));
  U.push(mk(30*ratio(T.c,tg.c),30,fmt(T.c)+" von "+fmt(tg.c)+" g Kohlenhydraten"));
  U.push(mk(20*ratio(T.kcal,tg.kcal),20,fmt(T.kcal)+" von "+fmt(tg.kcal)+" kcal"));
  U.push(mk(15*sl(8),15,sleep==null?"Schlaf nicht eingetragen":fmt(sleep,1)+" h Schlaf"));
  if(W.hard&&isHardDay(addDays(ds,-1)))U.push(mk(-10,0,"Zwei harte Tage hintereinander"));
  M.push(mk(35*ratio(T.p,tg.p),35,fmt(T.p)+" von "+fmt(tg.p)+" g Protein"));
  M.push(mk(20*ratio(T.kcal,tg.kcal),20,"Energie für den Aufbau: "+fmt(T.kcal)+" von "+fmt(tg.kcal)+" kcal"));
  const gymPlanned=!!sug.gym;M.push(mk(gymPlanned?(W.gym?20:0):20,20,gymPlanned?(W.gym?"Krafttraining erledigt":sug.gym.name+" noch offen"):"Kein Krafttraining vorgesehen"));
  M.push(mk(10*ratio(T.pMeals,4),10,T.pMeals+" von 4 Mahlzeiten mit mind. 25 g Protein"));
  M.push(mk(15*sl(8),15,sleep==null?"Schlaf nicht eingetragen":fmt(sleep,1)+" h Schlaf"));
  const micro=NUTR.filter(n=>n[5]==="v"||n[5]==="n").filter(n=>n[0]!=="na"&&n[3]>0);
  const cover=micro.reduce((a,n)=>a+ratio(E[n[0]],n[3]),0)/micro.length;
  L.push(mk(25*cover,25,"Vitamine und Mineralstoffe zu "+fmt(cover*100)+" % gedeckt"));
  L.push(mk(15*ratio(T.fib,38),15,fmt(T.fib)+" von 38 g Ballaststoffen"));
  L.push(mk(15*ratio(T.veg,500),15,fmt(T.veg)+" von 500 g Obst und Gemüse"));
  L.push(mk(10*ratio(E.o3,0.25),10,fmt(E.o3,2)+" von 0,25 g Omega-3 (EPA+DHA)"+(E._win.o3>1?", Ø "+E._win.o3+" Tage":"")));
  L.push(mk(W.km||W.walk>=30||W.gym||W.other>=20?10:0,10,W.km||W.walk||W.gym||W.other?"Bewegt":"Noch keine Bewegung"));
  L.push(mk(25*sl(8.5),25,sleep==null?"Schlaf nicht eingetragen":fmt(sleep,1)+" von 8–9 h Schlaf"));
  const longDay=W.min>=90;if(T.addSug>(longDay?150:50))L.push(mk(-Math.min(15,(T.addSug-(longDay?150:50))/3),0,fmt(T.addSug)+" g zugesetzter Zucker"));
  if(T.kcal>500&&T.proc/T.kcal>0.25)L.push(mk(-10,0,fmt(100*T.proc/T.kcal)+" % der Kalorien aus Fast Food"));
  if(T.alc>=0.5)L.push(mk(-Math.min(20,10*T.alc),0,fmt(T.alc,1)+" alkoholische Getränke"));
  for(const n of NUTR)if(n[4]&&E[n[0]]>n[4])L.push(mk(-5,0,n[1]+" über der Obergrenze ("+fmt(n[4])+" "+n[2]+")"));
  X.push(mk(25*ratio(T.kcal,tg.kcal*0.9),25,"Kein Energiedefizit: "+fmt(T.kcal)+" von "+fmt(tg.kcal)+" kcal"));
  const fatMin=Math.max(0.8*w,tg.f*0.85);X.push(mk(15*ratio(T.f,fatMin),15,fmt(T.f)+" von "+fmt(fatMin)+" g Fett"));
  X.push(mk(12*ratio(E.zn,14),12,fmt(E.zn,1)+" von 14 mg Zink"+(E._win.zn>1?" (Ø "+E._win.zn+" Tage)":"")));X.push(mk(12*ratio(E.vD,20),12,fmt(E.vD,1)+" von 20 µg Vitamin D"+(E._win.vD>1?" (Ø "+E._win.vD+" Tage)":"")));
  X.push(mk(8*ratio(E.mg,400),8,fmt(E.mg)+" von 400 mg Magnesium"+(E._win.mg>1?" (Ø "+E._win.mg+" Tage)":"")));X.push(mk(28*sl(8.5),28,sleep==null?"Schlaf nicht eingetragen":fmt(sleep,1)+" von 8–9 h Schlaf"));
  if(T.alc>=0.5)X.push(mk(-Math.min(20,12*T.alc),0,"Alkohol senkt das Testosteron"));
  const sc=a=>Math.round(clamp(a.reduce((s,x)=>s+x.got,0),0,100));
  const pack=(name,col,a)=>({name,col,v:sc(a),parts:a,miss:a.filter(x=>x.max===0||x.got<x.max-0.5).sort((p,q)=>((q.max?q.max-q.got:15)-(p.max?p.max-p.got:15)))});
  return{T,tg,W,list:[pack("Ultra","var(--c1)",U),pack("Muskelaufbau","var(--c2)",M),pack("Longevity","var(--c3)",L),pack("Testosteron","var(--c4)",X)]};
}

/* ================= Essensvorschläge ================= */
function foodSuggestions(ds,T,tg,count=4){
  const gaps={};const want=["p","fib","vA","vD","vE","vK","vC","b1","b2","b3","b6","b9","b12","cho","ca","mg","k","fe","zn","se","io","o3","ala","poly","lut"];
  for(const k of want){const t=k==="p"?tg.p:NMETA[k].t;if(t&&T[k]<t)gaps[k]=t-T[k]}
  const kcalLeft=tg.kcal-T.kcal;const picked=[];const g={...gaps};
  const cands=FOOD_LIST.filter(f=>!/[sxal]/.test(f.fl)&&!["salz","tee","kaffee","oel","rapsoel","leinoel","butter","whey","leber","zucker","honig","sportdrink","gel","proteinriegel","kresse","nori","hefeflocken","kakaopulver","evoo","kokosoel","ghee","huehnerleber","austern","goji","knoblauch","ingwer","chili1"].includes(f.id));
  for(let r=0;r<count;r++){
    let best=null,bv=0;
    for(const f of cands){if(picked.some(p=>p.f.id===f.id))continue;
      const portion=f.id==="paranuss"?10:Math.min(f.p||f.u,f.u>=100?f.u:f.u*2,300);const kc=f.n[0]*portion/100;
      if(kcalLeft<150&&kc>150)continue;
      let v=0;const contrib=[];
      for(const k in g){const amt=f.n[NI[k]]*portion/100;if(amt<=0)continue;const t=k==="p"?tg.p:NMETA[k].t;const c=Math.min(g[k],amt)/t;v+=c*(k==="p"?2.5:k==="o3"?1.5:1);if(amt/t>=0.12)contrib.push([k,amt/t])}
      if(kcalLeft<0)v-=kc/800;
      if(v>bv){bv=v;best={f,portion,kc,contrib:contrib.sort((a,b)=>b[1]-a[1]).slice(0,3)}}
    }
    if(!best||bv<0.15)break;picked.push(best);
    for(const k in g){g[k]-=best.f.n[NI[k]]*best.portion/100;if(g[k]<=0)delete g[k]}
  }
  return picked;
}

/* ================= Parser (lokal, kostenlos) ================= */
const NUMW={ein:1,eine:1,einen:1,einem:1,einer:1,eins:1,zwei:2,drei:3,vier:4,"fünf":5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,"zwölf":12,"fünfzehn":15,zwanzig:20,"dreißig":30,vierzig:40,"fünfzig":50,hundert:100,halbe:0.5,halben:0.5,halbes:0.5,halb:0.5,anderthalb:1.5,eineinhalb:1.5,zweieinhalb:2.5,viertel:0.25,paar:2};
const UNITW={ein:1,zwei:2,drei:3,vier:4,"fünf":5,sechs:6,sieben:7,acht:8,neun:9};
function wordNum(w){if(w in NUMW)return NUMW[w];const m=w.match(/^(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)?hundert(.*)$/);if(m){const b=(m[1]?UNITW[m[1]]:1)*100;const r=m[2]?m[2].replace(/^und/,""):"";const rv=r?(NUMW[r]??null):0;return rv==null?null:b+rv}return null}
function normalize(t){t=" "+t.toLowerCase().replace(/[“”„"]/g," ")+" ";t=t.replace(/(\d),(\d)/g,"$1.$2");t=t.replace(/(\d+(?:\.\d+)?)\s*(?:%|prozent\w*)/g," pct$1 ");
  t=t.replace(/\bein paar\b/g," 3 ").replace(/\b(eine?n?|1)\s+halbe?[ns]?\b/g," 0.5 ");
  t=t.replace(/[a-zäöüß]+/g,w=>{const n=wordNum(w);return n==null?w:String(n)});
  t=t.replace(/(\d)(kg|g|ml|l|km|min|h|mg)\b/g,"$1 $2");return t.replace(/\s+/g," ")}
const FILLER=/\b(ich|habe|hab|hatte|gegessen|getrunken|gemacht|genommen|heute|gestern|morgens|mittags|abends|nachmittags|zum|zur|zu|frühstück|mittagessen|abendessen|mittag|abend|snack|noch|danach|also|so|ungefähr|circa|ca|etwa|rund|gut|bisschen|etwas|wenig|viel|große?n?|kleine?n?|normale?n?|portion|portionen|stück|davon|vom|von|dem|der|die|das|den|ein|eine|mit|ohne|und|auch|dazu|vor|nach|training|schlafen|beim|im|lauf|als|nachtisch|dessert|frisch|gebraten|gekocht|roh|ungekocht|geröstet|light|zero|wieder|war|waren|mal|insgesamt|plus|sowie|in|auf|aus|einer|einem|einen|lecker|schnell|selbst|selbstgemacht)\b/g;
const UNIT_RE=/(\d+(?:\.\d+)?)\s*(kg|kilo|gramm|gr|g|ml|milliliter|liter|l|el|esslöffel|tl|teelöffel|stück|stk|scheiben?|portionen?|schüsseln?|schalen?|teller|tassen?|gläser|glas|becher|dosen?|handvoll|packungen?|scoops?|messlöffel|riegel|flaschen?|schuss|prise|kugeln?)?(?![a-zäöüß])/;
function allFoods(){return S.custom.length?FOOD_LIST.concat(S.custom):FOOD_LIST}
function findFood(text){
  const words=text.split(/[^a-zäöüß0-9%-]+/).filter(Boolean);let best=null,bl=0;
  for(const f of allFoods())for(const a of f.al){let hit=false;
    if(a.includes(" ")||/[0-9%-]/.test(a))hit=text.includes(a);
    else for(const w of words){if(w===a||(w.startsWith(a)&&(a.length>=4||/^(e|n|en|er|s|es|ern)$/.test(w.slice(a.length))))||(a.length>=5&&w.endsWith(a))){hit=true;break}}
    if(hit&&a.length>bl){best=f;bl=a.length}}
  return best;
}
function gramsFor(f,num,unit,text,side){
  const liquid=(f.fl||"").includes("l");let mult=1;
  if(/\b(viel|große?n?|großer|doppelte?)\b/.test(text))mult=1.5;if(/\b(wenig|bisschen|kleine?n?|etwas)\b/.test(text))mult=0.6;
  if(num==null){if(/\bschuss\b/.test(text))return 30;if(side&&liquid)return 30;return Math.round((f.p||f.u)*mult)}
  const u=(unit||"").replace(/n$/,"");let g;
  switch(u){case"kg":case"kilo":g=num*1000;break;case"g":case"gr":case"gramm":case"ml":case"milliliter":g=num;break;case"l":case"liter":g=num*1000;break;
    case"el":case"esslöffel":g=num*((f.fl||"").includes("o")?10:15);break;case"tl":case"teelöffel":g=num*5;break;case"scheibe":g=num*(f.s||30);break;
    case"portion":case"schüssel":case"schale":case"teller":g=num*(f.p||f.u);break;case"tasse":g=num*(liquid?150:(f.p||f.u));break;case"gläser":case"glas":g=num*(liquid?200:(f.p||f.u));break;
    case"becher":g=num*f.u;break;case"dose":g=num*(f.d||400);break;case"handvoll":g=num*30;break;case"packung":g=num*250;break;case"scoop":case"messlöffel":g=num*30;break;
    case"flasche":g=num*(liquid?500:f.u);break;case"schus":return 30;case"prise":return 1;case"kugel":g=num*60;break;default:g=num*f.u}
  return Math.round(g*mult);
}

/* ---------- Krafttraining frei gesprochen ---------- */
const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const EX_RE=new RegExp("(^|[^a-zäöüß])("+EX_ALIAS.map(a=>esc(a[0])).join("|")+")(?:e|n|en|s)?(?=[^a-zäöüß]|$)","g");
const EX_MAP=Object.fromEntries(EX_ALIAS);
const EQ=[[/\b(?:e\s?-?\s?z|s\s?-?\s?z|easy\s?-?\s?bar|easybar|isi\s?bar)(?:\s?-?\s?(?:stange|hantel|bar|curl\w*))?\b|\bezstange\b|\bszstange\b/,"SZ-Stange"],[/\b(?:kurzhantel\w*|kh|dumbbells?)\b/,"Kurzhantel"],[/\b(?:langhantel\w*|lh|barbell)\b/,"Langhantel"],[/\b(?:kabel\w*|cable|seilzug|seil)\b/,"Kabel"],[/\b(?:maschine|gerät|machine)\b/,"Maschine"],[/\b(?:multipresse|smith)\b/,"Multipresse"],[/\b(?:kettlebell|kugelhantel)\b/,"Kettlebell"],[/\b(?:widerstandsband|theraband|band)\b/,"Band"]];
const GYMW=/(\d\s*(?:x|×|\*|mal)\s*\d|\b(?:sätze|satz|wdh|wiederholung\w*|reps?|kg|kilo|supersatz|superset|pro seite|pro hand|je seite|körpergewicht|eigengewicht|versagen|rir|rpe|aufwärmsatz|aufwärmsätze|warm ?up)\b)/;
const SEP=/[.;!?\n]+|,(?!\s*\d+(?:\.\d+)?\s*(?:,|\/|kg|kilo|wdh|wiederholung\w*|reps?|sätze|satz|x|×|mal|und|$))|\b(?:und dann|dann noch|danach|anschließend|als nächstes|zum schluss|zum abschluss|außerdem)\b/;
function parseSets(r){
  const e={};let m;const notes=[];
  const nums=[...r.matchAll(/\d+(?:\.\d+)?/g)].length;
  // Gewichte
  const r2=r.replace(/(\d+)\s*(?:x|×|\*|mal)\s*(\d+)/g," # ").replace(/\d+\s*(?:sätze|satz|runden)\b/g," # ");const LS="(?:\\s*(?:,|\\/|und|dann)\\s*|\\s+)";
  const kgs=[];let km;const kgList=r2.match(new RegExp("((?:\\d+(?:\\.\\d+)?"+LS+")+\\d+(?:\\.\\d+)?)\\s*(?:kg|kilo)"));
  if(kgList)kgList[1].split(new RegExp(LS)).filter(Boolean).forEach(x=>kgs.push(+x));
  else for(km of r.matchAll(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/g))kgs.push(+km[1]);
  // Sätze × Wiederholungen
  if((m=r.match(/(\d+)\s*(?:x|×|\*|mal)\s*(\d+)(?!\s*(?:\.\d)?\s*(?:kg|kilo))/))){e.sets=+m[1];e.reps=+m[2]}
  if((m=r.match(/(\d+)\s*(?:sätze|satz|runden|durchgänge|durchgang)\b/)))e.sets=+m[1];
  if((m=r.match(/(?:sätze|satz|runden)\s*(?:à|a|á|mit|zu|je|von|x|mal|für)?\s*(?:je\s*)?(\d+)(?!\s*(?:\.\d)?\s*(?:kg|kilo|sätze|satz))/))&&e.reps==null)e.reps=+m[1];
  if((m=r.match(/(\d+)\s*(?:wdh|wiederholung\w*|reps?|mal\b)(?!\s*\d)/))&&e.reps==null&&!/x|×/.test(m[0]))e.reps=+m[1];
  // Wiederholungsliste: 10, 8, 6 (ohne kg dahinter)
  const rl=[...r2.matchAll(new RegExp("(\\d+(?:"+LS+"\\d+)+)(?!\\s*(?:\\.\\d)?\\s*(?:kg|kilo|\\d))","g"))].map(x=>x[1]).filter(x=>!kgList||!kgList[1].includes(x));
  if(rl.length){const list=rl[0].split(new RegExp(LS)).filter(Boolean).map(Number);if(list.every(x=>x>0&&x<=50)){e.repList=list;if(e.sets==null||e.sets===list.length)e.sets=list.length;e.reps=null}}
  // „mit 60“ ohne Einheit
  if(!kgs.length&&(m=r.match(/(?:mit|@|bei|à)\s*(\d+(?:\.\d+)?)(?!\s*(?:x|×|mal|sätze|satz|wdh|wiederholung|reps?|\d))/))){const v=+m[1];if(e.reps==null&&!e.repList&&v<=30)e.reps=v;else if(v!==e.reps&&!(e.repList||[]).includes(v))kgs.push(v)}
  if(kgs.length===1)e.kg=kgs[0];
  else if(kgs.length>1){e.kgList=kgs;e.kg=Math.max(...kgs);if(e.sets==null)e.sets=kgs.length}
  if(e.sets==null&&e.reps!=null&&!e.repList)e.sets=1;
  // nur Zahlen ohne Wort: „Bankdrücken 3 10 60“
  if(e.sets==null&&e.reps==null&&!e.repList&&nums>=2&&!kgs.length){const n=[...r.matchAll(/\d+(?:\.\d+)?/g)].map(x=>+x[0]);if(n[0]<=10&&n[1]<=50){e.sets=n[0];e.reps=n[1];if(n[2]!=null)e.kg=n[2]}}
  if(/\b(?:körpergewicht|eigengewicht|ohne gewicht|bodyweight|bw)\b/.test(r)){e.bw=true;if(!/\b(?:plus|zusatz\w*|extra|mit)\b/.test(r))delete e.kg}
  if(/\b(?:plus|zusatz\w*|extra)\b/.test(r)&&e.kg)notes.push("Zusatzgewicht");
  if(/\b(?:pro|je)\s*(?:seite|hand|arm|bein)\b/.test(r))notes.push("pro Seite");
  if(/\b(?:versagen|failure|muskelversagen)\b/.test(r))notes.push("bis Versagen");
  if((m=r.match(/\brir\s*(\d)/))||(m=r.match(/(\d)\s*(?:im tank|in reserve|reserve)/)))notes.push(m[1]+" in Reserve");
  if((m=r.match(/\brpe\s*(\d+(?:\.\d)?)/)))notes.push("RPE "+m[1]);
  if(/\b(?:aufwärm\w*|warm ?up)\b/.test(r))notes.push("inkl. Aufwärmen");
  if(/\b(?:dropsatz|dropset|drop set)\b/.test(r))notes.push("Dropsatz");
  if(notes.length)e.note=notes.join(", ");
  // Kennzahlen für Fortschritt: schwerster Satz
  if(e.repList){const i=e.kgList&&e.kgList.length===e.repList.length?e.kgList.indexOf(e.kg):e.repList.length-1;e.reps=e.repList[Math.max(0,i)]}
  return e}
const hasData=e=>e.sets!=null||e.reps!=null||e.kg!=null||e.repList||e.bw;
function parseGym(t,fallbackSess){
  const clauses=t.split(SEP).map(x=>(x||"").trim()).filter(Boolean);
  const ex=[],rest=[];let last=null,grp=0;
  for(const c of clauses){
    const ms=[...c.matchAll(EX_RE)].map(m=>({i:m.index+m[1].length,a:m[2],e:m.index+m[0].length})).filter((m,k,arr)=>!(k>0&&/^[\s-]*$/.test(c.slice(arr[k-1].e,m.i))));
    if(!ms.length){
      const data=c.replace(/\d+(?:\.\d+)?/g," ").replace(GYMW,"").replace(new RegExp(GYMW.source,"g"),"").replace(/\b(?:noch|mit|à|a|je|und|von|zu|bei|ich|habe|hab|dann|wieder|nochmal|weitere?)\b/g,"").replace(/[^a-zäöüß]/g,"");
      if(last&&GYMW.test(c)&&data.length<3){const add=parseSets(c);if(add.sets&&last.sets){const rl=[...(last.repList||Array(last.sets).fill(last.reps)),...(add.repList||Array(add.sets).fill(add.reps))];last.sets+=add.sets;if(rl.every(x=>x!=null)&&new Set(rl).size>1){last.repList=rl}if(add.kg!=null&&last.kg==null)last.kg=add.kg}else Object.assign(last,Object.fromEntries(Object.entries(add).filter(([k,v])=>last[k]==null)));continue}
      if(GYMW.test(c)&&/\d/.test(c)&&!/\b(km|kilometer|gelaufen|laufen|joggen|schwimm\w*|rad|min|minuten|gegessen|getrunken|g|gramm|ml)\b/.test(c)){
        const nm=c.replace(/\d+(?:\.\d+)?/g," ").replace(new RegExp(GYMW.source,"g")," ").replace(FILLER," ").replace(/\b(?:mit|à|je|sätze|satz)\b/g," ").replace(/[^a-zäöüß -]/g," ").replace(/\s+/g," ").trim();
        if(nm.length>=3){const e={name:nm.split(" ").map(cap).join(" "),...parseSets(c),own:true};ex.push(e);last=e;continue}}
      rest.push(c);continue}
    const ss=/\b(?:supersatz|superset|im wechsel|abwechselnd)\b/.test(c);if(ss)grp++;
    const parts=ms.map((m,k)=>({...m,txt:c.slice(k===0?0:m.i,k+1<ms.length?ms[k+1].i:c.length)}));
    const inClause=[];
    for(const pt of parts){let name=EX_MAP[pt.a];if(name==="Curls + Trizeps Supersatz"){continue}
      const eq=EQ.find(([re])=>re.test(pt.txt));if(eq&&!name.includes(eq[1].split("-")[0])&&!/KH|Maschine/.test(name))name+=" ("+eq[1]+")";
      const e={name,...parseSets(pt.txt)};if(ss)e.ss=String.fromCharCode(64+grp);
      inClause.push(e)}
    if(ss){const src=inClause.find(hasData);if(src)for(const e of inClause)if(!hasData(e))for(const k of["sets","reps","repList","kg","kgList","bw"])if(src[k]!=null)e[k]=src[k]}
    const sessionTalk=/\b(?:trainiert|training|tag|session|einheit|gemacht)\b/.test(c);
    let skipped=false;for(const e of inClause){if(!hasData(e)&&sessionTalk&&!ss){skipped=true;continue}ex.push(e);last=e}
    if(!inClause.length||skipped)rest.push(c)}
  const cnt={};for(const e of ex){const s=sessionFor(e.name.replace(/ \(.*\)$/,""));if(s)cnt[s]=(cnt[s]||0)+1}
  const session=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||fallbackSess||"push";
  return{ex,session,rest:rest.join(". ")}}
function setsTxt(e){return e.sets!=null?String(e.sets):"–"}
function repsTxt(e){return e.repList?e.repList.join("/"):e.reps!=null?String(e.reps):"–"}
function kgTxt(e){return e.kgList?e.kgList.map(x=>kgf(x)).join("/")+" kg":e.kg!=null?kgf(e.kg)+" kg":e.bw?"Körpergewicht":"–"}
function exTable(list){
  return h("table",{class:"ex-t"},h("thead",{},h("tr",{},h("th",{},"Übung"),h("th",{},"Sätze"),h("th",{},"Wdh."),h("th",{},"Gewicht"))),
    h("tbody",{},list.map(e=>h("tr",{},h("td",{},e.ss?h("span",{class:"ss"},e.ss):null,e.name,e.note?h("div",{class:"tiny muted"},e.note):null),h("td",{class:"num"},setsTxt(e)),h("td",{class:"num"},repsTxt(e)),h("td",{class:"num"},kgTxt(e))))))}

function parseExercise(seg){for(const[a,name]of EX_ALIAS){if(seg.includes(a)){const ex={name};let m=seg.match(/(\d+)\s*(?:x|×|mal|\*)\s*(\d+)/);
  if(m){ex.sets=+m[1];ex.reps=+m[2]}else{const s=seg.match(/(\d+)\s*sätze?/),r=seg.match(/(\d+)\s*(?:wdh|wiederholungen|reps)/);if(s)ex.sets=+s[1];if(r)ex.reps=+r[1]}
  const k=seg.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/)||seg.match(/(?:mit|@|à|bei)\s*(\d+(?:\.\d+)?)(?!\s*(?:x|×|mal|sätze|wdh))/);if(k)ex.kg=+k[1];return ex}}return null}
const SESSION_RE=[[/\b(push|oberkörper a|brust)\b/,"push"],[/\b(pull|oberkörper b|rücken)\b/,"pull"],[/\b(mix|oberkörper c|ganzkörper)\b/,"mix"],[/\b(beine|beintag|leg day|legday|unterkörper)\b/,"beine"],[/\bprehab\b/,"prehab"]];
function sessionFor(name){for(const[k,s]of Object.entries(GYM))if(s.ex.some(e=>e[0]===name))return k;return null}
function suppIn(t){const found={};for(const s of S.settings.supps){for(const a of s.al.split(",")){if(new RegExp("(^|[^a-zäöüß])"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(t)){found[s.id]=true;break}}}return found}
function parseText(raw,ds){
  const sug=suggest(ds,1)[0];
  const out={text:raw.trim(),meal:null,items:[],workouts:[],check:{},supps:{},unknown:[]};
  const t=normalize(raw);let m;
  const mealM=t.match(/\b(frühstück|mittagessen|mittag|abendessen|abend|snack|vor dem training|nach dem training|im lauf|beim laufen|vor dem schlafen)\b/);
  if(mealM)out.meal={mittagessen:"mittag",abendessen:"abend","beim laufen":"im lauf"}[mealM[1]]||mealM[1];
  if((m=t.match(/(?:schlaf|sleep)\w*\D{0,6}(\d{1,2}):(\d{2})\b/)))out.check.sleep=Math.round((+m[1]+ +m[2]/60)*100)/100;
  else if((m=t.match(/(\d+(?:\.\d+)?)\s*(?:h|std|stunden?)\s*(?:lang\s*)?(?:geschlafen|schlaf)/))||(m=t.match(/(?:geschlafen|schlaf)\w*\s*(?:nur\s*|ca\s*|etwa\s*)?(\d+(?:\.\d+)?)/)))out.check.sleep=+m[1];
  if((m=t.match(/knie\w*\s*(?:bei|auf|ist|war|schmerz\w*|so)?\s*(\d+)/)))out.check.knee=+m[1];
  if((m=t.match(/(?:gewicht|wiege|gewogen|waage)\D{0,12}(\d{2,3}(?:\.\d)?)/))||(m=t.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo)\s*(?:gewogen|gewicht|auf der waage)/)))out.check.weight=+m[1];
  if((m=t.match(/\b(?:hrv|herzfrequenzvariabilität|variabilität)\D{0,10}(\d{2,3})/)))out.check.hrv=+m[1];
  if((m=t.match(/\b(?:ruhepuls|ruheherzfrequenz|rhr|resting hr|ruhe-?hf)\D{0,10}(\d{2,3})/)))out.check.rhr=+m[1];
  if((m=t.match(/\b(?:recovery|erholung|regeneration)\D{0,10}(\d{1,3})\s*(?:%|prozent)?/))&&+m[1]<=100)out.check.rec=+m[1];
  if((m=t.match(/\b(?:strain|belastung)\s*(gestern)?\D{0,10}?(\d{1,2}(?:\.\d)?)/))&&+m[2]<=21){if(m[1]||/strain\D{0,12}gestern|gestern\D{0,12}strain/.test(t))out.strainY=+m[2];else out.check.strain=+m[2]}
  out.supps=suppIn(t);
  if(/\b(alle|meine)\s+(supplements|supps|nahrungsergänzung|tabletten|kapseln)\b/.test(t))for(const s of S.settings.supps)if(s.active)out.supps[s.id]=true;
  const suppWords=S.settings.supps.flatMap(s=>s.al.split(","));
  const G=parseGym(t,sug.gym&&sug.gym.id);
  if(G.ex.length)out.workouts.push({type:"gym",session:G.session,ex:G.ex,min:Math.max(30,Math.round(G.ex.reduce((s,e)=>s+(e.sets||3),0)*3))});
  const segs=(" "+G.rest+" ").split(/[;\n!?]|\.(?!\d)|,|\bund dann\b|\bund\b|\bdann\b|\bdanach\b|\bplus\b|\bsowie\b|\bdazu\b|\baußerdem\b/).map(s=>s.trim()).filter(Boolean);
  let lastGym=null;
  for(const seg of segs){
    const stripped=seg.replace(/(geschlafen|schlaf\w*|knie\w*|gewicht|gewogen|wiege|waage|supplements|tabletten|kapseln)/g,"");
    if(/(geschlafen|schlaf|knie|gewicht|gewogen|wiege|supplements)/.test(seg)&&!findFood(stripped))continue;
    if(/\b(hrv|herzfrequenzvariabilität|variabilität|ruhepuls|ruheherzfrequenz|rhr|resting hr|ruhe-?hf|recovery|erholung|regeneration|strain|belastung|whoop|noop|ms|bpm)\b/.test(seg))continue;
    if(suppWords.some(a=>seg.includes(a))&&!findFood(suppWords.reduce((s,a)=>s.split(a).join(" "),seg).replace(/\d+\s*(mg|g|ie|µg)?/g,"")))continue;
    const isRun=/(gelaufen|laufen|lauf\b|läufe|joggen|gejoggt|jogging|\brun\b|long ?run|dauerlauf|intervall|fahrtspiel|steigerungen|bergsprints?|5-?km-?test|tempolauf|\d\s*km\b)/.test(seg)&&!/(spazier|wander|gegangen|walk|rad|fahrrad|bike|schwimm|geschwommen)/.test(seg);
    const isWalk=/(spazier|wander|gegangen|walk|hike|power-?hiking)/.test(seg);
    const isSwim=/(schwimm|geschwommen|kraulen|bahnen)/.test(seg);
    const isBike=/(rad gefahren|fahrrad|radfahren|rennrad|bike|radeln|ergometer|spinning)/.test(seg);
    const isOther=/(fußball|basketball|tennis|klettern|bouldern|yoga|mobility|stretching|dehnen|rudergerät|crosstrainer|hiit)/.test(seg);
    if(isRun||isWalk||isSwim||isBike||isOther){
      const w={type:isRun?"run":isWalk?"walk":isSwim?"swim":isBike?"bike":"other"};
      if((m=seg.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometer)/)))w.km=+m[1];
      if((m=seg.match(/(\d+(?:\.\d+)?)\s*(?:m|meter)\b/))&&isSwim)w.km=+m[1]/1000;
      if((m=seg.match(/(\d+):(\d{2})\s*(?:h|std|stunden)/)))w.min=+m[1]*60+ +m[2];
      else if((m=seg.match(/(\d+):(\d{2})\s*(?:min)?/))&&isRun&&w.km){w.min=+m[1]+(+m[2])/60}
      else{let mi=0;if((m=seg.match(/(\d+(?:\.\d+)?)\s*(?:h|std|stunden?)\b/)))mi+=+m[1]*60;if((m=seg.match(/(\d+)\s*(?:min|minuten)/)))mi+=+m[1];if(mi)w.min=mi}
      if((m=seg.match(/rpe\s*(\d+(?:\.\d+)?)/)))w.rpe=+m[1];
      else if(w.type==="run"){if(/(berg|sprint|hart|5-?km-?test|test)/.test(seg))w.rpe=7.5;else if(/(schwelle|intervall|fahrtspiel|tempo|zügig)/.test(seg))w.rpe=6.5;else if(/(steady|marathontempo)/.test(seg))w.rpe=5;else w.rpe=3.5}
      else if(/(hart|intensiv|intervall)/.test(seg))w.rpe=7;else w.rpe=4;
      if(w.type==="run"&&/5-?km-?test|5 km test/.test(seg))w.test=true;
      if(w.type==="run"&&!w.km&&w.min)w.km=Math.round(w.min/6.8*10)/10;
      if(w.type==="run"&&w.km&&!w.min)w.min=Math.round(w.km*6.8);
      if(!w.min&&w.type!=="run")w.min=w.type==="walk"?(w.km?Math.round(w.km*12):45):45;
      if(w.type==="other")w.name=(seg.match(/(fußball|basketball|tennis|klettern|bouldern|yoga|mobility|stretching|dehnen|rudergerät|crosstrainer|hiit)/)||["Sport"])[0];
      out.workouts.push(w);continue}
    let sess=null;for(const[re,s]of SESSION_RE)if(re.test(seg)){sess=s;break}
    if((sess||/(\bgym\b|fitnessstudio|krafttraining|\bstudio\b|pumpen|trainiert)/.test(seg))&&!findFood(seg)){if(out.workouts.some(w=>w.type==="gym"))continue;const s=sess||(sug.gym&&sug.gym.id)||"push";if(!out.workouts.find(w=>w.type==="gym"&&w.session===s))out.workouts.push({type:"gym",session:s,ex:[],min:60});lastGym=s;continue}
    const parts=[];seg.split(/\bmit\b/).forEach((piece,i)=>piece.split(/\s+(?=\d)/).forEach((pp,j)=>parts.push({s:pp.trim(),side:i>0&&j===0})));
    let lastIt=null;
    for(let i=0;i<parts.length;i++){const pt=parts[i];if(!pt.s)continue;let f=findFood(pt.s);
      if(!f&&lastIt&&!/[a-zäöüß]{3,}/.test(pt.s.replace(UNIT_RE,"").replace(/pct[\d.]+/g,"").replace(FILLER,""))){const um2=pt.s.match(UNIT_RE);
        if(um2&&um2[1]){const lf=foodById(lastIt.fid);if(lf)lastIt.g=gramsFor(lf,+um2[1],um2[2]||null,pt.s,false);else{lastIt.num=+um2[1];lastIt.unit=um2[2]||null;lastIt.g=/^(g|gr|gramm|ml|milliliter)$/.test(um2[2]||"")?+um2[1]:/^(kg|kilo|l|liter)$/.test(um2[2]||"")?+um2[1]*1000:lastIt.g}}lastIt=null;continue}
      if(!f&&i+1<parts.length&&!/[a-zäöüß]{3,}/.test(pt.s.replace(UNIT_RE,"").replace(/pct[\d.]+/g,"").replace(FILLER,""))){parts[i+1].s=pt.s+" "+parts[i+1].s;continue}
      const pct=+((pt.s.match(/pct([\d.]+)/)||[])[1]||0),brand=brandIn(pt.s),um=pt.s.replace(/pct[\d.]+/g," ").match(UNIT_RE);
      const q=searchText(pt.s);
      if(!f){if(q.replace(/pct[\d.]+/g,"").trim().length>=3){out.items.push({name:cap(q.replace(/pct([\d.]+)/g,"$1 %")),g:um&&/^(g|gr|gramm|ml|milliliter)$/.test(um[2]||"")?+um[1]:um&&/^(kg|kilo|l|liter)$/.test(um[2]||"")?+um[1]*1000:100,num:um?+um[1]:null,unit:um?um[2]||null:null,n:NK.map(()=>0),look:true,q,brand,pct});lastIt=um?null:out.items.at(-1)}continue}
      if(f.raw&&/\b(roh|ungekocht|trocken)\b/.test(pt.s+" "+seg))f=FOODS[f.raw];
      if(f.id==="schoko"&&pct>=50)f=FOODS.zartbitter;
      const it={fid:f.id,g:gramsFor(f,um?+um[1]:null,um?um[2]:null,pt.s,pt.side)};
      if(brand||pct||S.learn[q]){it.q=q;it.brand=brand;it.pct=pct;it.gen=f.id}
      else if(extraWords(q,f).length){it.q=q;it.gen=f.id;it.alt=true}
      out.items.push(it);lastIt=um?null:it}
  }
  return out;
}

/* ================= Zustand der Oberfläche ================= */
let CUR=todayISO(),VIEW="training",PREVIEW=null,LOGFORM=null,OPEN=new Set();
function setView(v){VIEW=v;$$("main.view").forEach(m=>m.hidden=m.id!=="v-"+v);$$("nav.tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.v===v?"page":"false"));render();window.scrollTo(0,0)}
function commit(ds,P){
  const d=day(ds);
  if(P.items.length)d.entries.push({id:uid(),ts:Date.now(),meal:P.meal||guessMeal(),items:P.items.map(it=>it.fid?{fid:it.fid,g:it.g}:{name:it.name,g:it.g,n:it.n,fl:it.fl||""})});
  for(const w of P.workouts){d.workouts.push({...w,id:uid()});if(w.type==="run"&&w.test&&w.km>=4.8&&w.km<=5.3&&w.min){S.settings.p5=w.min*60/w.km;S.settings.p5date=ds;toast("Neue Zonen aus deinem 5-km-Test")}}
  for(const[k,v]of Object.entries(P.check))if(v!=null)d.check[k]=v;
  if(P.check.weight)S.settings.weight=P.check.weight;
  if(P.strainY!=null)day(addDays(ds,-1)).check.strain=P.strainY;
  Object.assign(d.supps,P.supps);save();
}
function guessMeal(){const x=new Date().getHours();return x<10?"frühstück":x<12?"snack":x<15?"mittag":x<18?"snack":x<22?"abend":"vor dem schlafen"}
const MEALS=["frühstück","snack","mittag","vor dem training","nach dem training","im lauf","abend","vor dem schlafen"];
const cap=s=>s?s[0].toUpperCase()+s.slice(1):"";

/* ================= Rendering ================= */
function render(){
  const isToday=CUR===todayISO();
  $("#dTitle").textContent=isToday?"Heute":long(CUR);
  const p=planFor(CUR),toRace=Math.round((parseD(RACE)-parseD(CUR))/864e5);
  $("#dSub").textContent=(isToday?short(CUR)+" · ":"")+(p.wk?"Woche "+p.wk+"/41 · ":"")+(toRace>0?"noch "+toRace+" Tage bis zum 100er":"");
  $$("main.view").forEach(m=>{if(m.id!=="v-"+VIEW)m.replaceChildren()});
  const v={training:renderTraining,ernaehrung:renderErnaehrung,fortschritt:renderFortschritt,longevity:renderLongevity,mehr:renderMehr}[VIEW];v();
}
function sec(title,right,...body){return h("section",{class:"sec"},h("div",{class:"sec-h"},h("h2",{},title),right||null),...body)}
function bar(v,t,cls="",warnOver=true){const r=t>0?v/t:0;return h("div",{class:"bar "+cls},h("i",{style:`width:${Math.min(100,r*100).toFixed(1)}%`+(warnOver&&r>1.12?";background:var(--warn)":"")}))}
const kgf=n=>Number(n).toLocaleString("de-DE",{maximumFractionDigits:2});

/* ---------- Bausteine ---------- */
function nutriSummary(){
  const T=totals(CUR),tg=targetsFor(CUR),left=tg.kcal-T.kcal;
  const macro=(l,v,t,u)=>h("div",{class:"mrow"},h("span",{},l),bar(v,t),h("span",{class:"num muted"},fmt(v)+" / "+fmt(t)+" "+u));
  return sec("Heute",h("span",{class:"muted small"},tg.label),
    h("div",{class:"kcal"},h("div",{},h("div",{class:"big num"},fmt(Math.abs(left))),h("div",{class:"muted small"},left>=0?"kcal übrig":"kcal über dem Ziel")),h("div",{class:"num muted small",style:"text-align:right"},fmt(T.kcal)+" gegessen",h("br"),fmt(tg.kcal)+" Ziel")),
    macro("Protein",T.p,tg.p,"g"),macro("Kohlenhydrate",T.c,tg.c,"g"),macro("Fett",T.f,tg.f,"g"),
    suggestBox(CUR,effT(CUR,T),tg));
}
function warnSec(){
  const T=effT(CUR);const warn=[];for(const n of NUTR)if(n[4]&&T[n[0]]>n[4])warn.push(n[1]+": "+fmt(T[n[0]],n[6])+" "+n[2]+(T._win[n[0]]>1?" im Schnitt der letzten "+T._win[n[0]]+" Tage":"")+" liegt über der sicheren Obergrenze von "+fmt(n[4])+" "+n[2]+".");
  if(T.suppMg>250)warn.push("Magnesium aus Supplements "+fmt(T.suppMg)+" mg: Die EFSA nennt 250 mg pro Tag als Obergrenze für Zusätze.");
  return warn.length?sec("Hinweise",null,h("ul",{class:"list warn"},warn.map(w=>h("li",{},w)))):null;
}
function scoreSec(){
  const sc=scores(CUR);
  return sec("Tagesbilanz",h("span",{class:"muted small"},CUR<todayISO()?"Endstand":"Stand jetzt"),h("div",{class:"scores"},sc.list.map(s=>{
    const open=OPEN.has("sc"+s.name);
    return h("button",{class:"score",onclick:()=>{open?OPEN.delete("sc"+s.name):OPEN.add("sc"+s.name);render()},"aria-expanded":open?"true":"false"},
      h("div",{class:"score-top"},h("span",{class:"score-n"},s.name),h("span",{class:"num score-v"},s.v)),
      h("div",{class:"bar thin"},h("i",{style:`width:${s.v}%;background:${s.col}`})),
      h("div",{class:"muted small"},s.miss.length?s.miss[0].text:"Alles im Soll"),
      open?h("ul",{class:"score-d"},s.parts.map(x=>h("li",{},h("span",{},x.text),h("span",{class:"num muted"},x.max?fmt(x.got)+"/"+x.max:fmt(x.got))))):null)})));
}
function quickInput(kind){
  const ta=h("textarea",{id:"qIn",rows:"2",placeholder:kind==="training"?"Was hast du trainiert? Einfach reinsprechen.":"Was hast du gegessen? Einfach reinsprechen."});
  ta.value=$("#qIn")?.value||"";
  const go=()=>{const t=ta.value.trim();if(!t){ta.focus();return}PREVIEW={...parseText(t,CUR),where:VIEW};enrich(PREVIEW);render();setTimeout(()=>$("#pv")?.scrollIntoView({behavior:"smooth",block:"start"}),30)};
  const mic=h("button",{class:"icon-btn",id:"micBtn","aria-label":"Spracheingabe",onclick:()=>startMic(ta,go)},micIcon());
  return h("div",{class:"quick"},h("div",{class:"quick-row"},ta,mic),h("div",{class:"quick-row2"},h("span",{class:"muted tiny"},kind==="training"?"Tipp ins Feld, dann aufs Mikro der Tastatur. z. B. „8 km locker in 52 min, Bankdrücken 4x8 70 kg, Klimmzüge 4x8“":"Tipp ins Feld, dann aufs Mikro der Tastatur. Grob reicht: „Teller Nudeln mit Bolognese und Salat“"),h("button",{class:"btn primary",onclick:go},"Erkennen")));
}
function micIcon(){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width","22");s.setAttribute("height","22");s.innerHTML='<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';return s}
let REC=null;
/* iPhone-Homescreen-Apps: Die Web-Spracherkennung von Safari läuft dort nicht zuverlässig.
   Darum: Feld fokussieren (Tastatur geht auf) und auf das Diktier-Mikrofon der Tastatur verweisen. */
const STANDALONE=navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;
function micHint(ta){let el=$("#micHint");if(!el){el=h("div",{id:"micHint",class:"hint small"});ta.closest(".quick").append(el)}
  el.replaceChildren(h("b",{},"Jetzt unten auf der Tastatur das Mikrofon 🎤 antippen und sprechen."),h("br"),
    h("span",{class:"muted tiny"},"Wenn ihr Mikrofon fehlt: iPhone-Einstellungen › Allgemein › Tastatur › „Diktierfunktion“ einschalten. Danach mit „Erkennen“ auswerten."));
  clearTimeout(el._t);el._t=setTimeout(()=>el.remove(),15000)}
function startMic(ta,go){
  const SR=window.webkitSpeechRecognition||window.SpeechRecognition;const b=$("#micBtn");
  if(REC){REC.stop();return}
  if(!SR||STANDALONE){ta.focus();micHint(ta);return}
  let got=false,base=ta.value.trim();
  try{REC=new SR();REC.lang="de-DE";REC.interimResults=true;REC.continuous=true;
    REC.onresult=e=>{got=true;const txt=[...e.results].map(r=>r[0].transcript).join(" ");ta.value=(base?base+" ":"")+txt};
    REC.onerror=e=>{if(!got){ta.focus();micHint(ta)}};
    REC.onend=()=>{REC=null;b&&b.classList.remove("on");if(got&&ta.value.trim())go()};REC.start();b&&b.classList.add("on");toast("Ich höre zu … zum Beenden nochmal tippen")}
  catch(e){REC=null;ta.focus();micHint(ta)}
}
function previewBox(){
  const P=PREVIEW;const n=P.items.map(itemNut).reduce((a,b)=>a.map((v,i)=>v+b[i]),NK.map(()=>0));
  const box=h("div",{class:"pv",id:"pv"});
  box.append(h("div",{class:"sec-h"},h("h2",{},"Erkannt"),h("button",{class:"link",onclick:()=>{PREVIEW=null;render()}},"Verwerfen")));
  if(P.items.length){
    const ms=h("select",{"aria-label":"Mahlzeit"},h("option",{value:""},"Mahlzeit: automatisch"),MEALS.map(m=>h("option",{value:m,selected:P.meal===m?true:null},cap(m))));ms.onchange=()=>P.meal=ms.value||null;box.append(ms);
    P.items.forEach((it,i)=>{const nn=itemNut(it);const gi=h("input",{type:"number",inputmode:"numeric",value:it.g,"aria-label":"Gramm"});gi.onchange=()=>{it.g=Math.max(0,+gi.value||0);render()};
      box.append(h("div",{class:"pv-row"},h("div",{},h("button",{class:"pv-name",onclick:()=>openPicker(f=>{it.fid=f.id;delete it.n;delete it.look;if(it.q){S.learn[it.q]=f.id;save()}render()})},itemName(it)),it.pending?h("div",{class:"tiny muted"},"Suche genaues Produkt …"):it.bls?h("div",{class:"tiny muted"},"BLS 4.0"+(foodById(it.fid)?.est?" · "+estTxt(foodById(it.fid))+" geschätzt":"")+(it.gen?" · ":""),it.gen?h("button",{class:"link tiny",onclick:()=>{it.fid=it.gen;it.bls=false;save();render()}},"allgemein nehmen"):null):it.off?h("div",{class:"tiny muted"},"Produkt aus Open Food Facts"+(it.gen?" · fehlende Vitamine ergänzt":"")+" · ",h("button",{class:"link tiny",onclick:()=>{it.fid=it.gen||it.fid;it.off=false;if(it.q)delete S.learn[it.q];save();render()}},"allgemein nehmen")):it.offMiss?h("div",{class:"tiny muted"},"Genaues Produkt nicht gefunden, Durchschnittswerte"):null),gi,h("span",{class:"muted tiny num"},"g · "+fmt(nn[0])+" kcal"),h("button",{class:"x","aria-label":"Entfernen",onclick:()=>{P.items.splice(i,1);render()}},"×")))});
    box.append(h("div",{class:"small num",style:"margin-top:6px"},fmt(n[0])+" kcal · "+fmt(n[1])+" g Protein · "+fmt(n[2])+" g KH · "+fmt(n[3])+" g Fett"));
  }
  if(P.where!=="training"||P.items.length)box.append(h("button",{class:"link",onclick:()=>openPicker(f=>{P.items.push({fid:f.id,g:f.p||f.u});render()})},"+ Lebensmittel hinzufügen"));
  P.workouts.forEach((w,i)=>{box.append(h("div",{class:"pv-row w"},h("span",{},workoutLine(w)),h("button",{class:"x","aria-label":"Entfernen",onclick:()=>{P.workouts.splice(i,1);render()}},"×")));box.append(wEditor(w,re=>{if(re)render()}))});
  if(P.where==="training")box.append(addUnitRow(w=>{P.workouts.push(w);render()}));
  const ex=[];if(P.check.sleep!=null)ex.push("Schlaf "+fmt(P.check.sleep,1)+" h");if(P.check.knee!=null)ex.push("Knie "+P.check.knee+"/10");if(P.check.weight)ex.push("Gewicht "+fmt(P.check.weight,1)+" kg");if(P.check.hrv!=null)ex.push("HRV "+P.check.hrv+" ms");if(P.check.rhr!=null)ex.push("Ruhepuls "+P.check.rhr);if(P.check.rec!=null)ex.push("Recovery "+P.check.rec+" %");if(P.check.strain!=null)ex.push("Strain "+fmt(P.check.strain,1));if(P.strainY!=null)ex.push("Strain gestern "+fmt(P.strainY,1));
  for(const s of S.settings.supps)if(P.supps[s.id])ex.push(s.name);
  if(ex.length)box.append(h("div",{class:"small",style:"margin-top:6px"},"Außerdem: "+ex.join(" · ")));
  if(P.unknown.length)box.append(h("div",{class:"small warn-t",style:"margin-top:6px"},"Nicht erkannt: „"+P.unknown.join("“, „")+"“. Tipp auf „+ Lebensmittel hinzufügen“ und such danach."));
  box.append(h("button",{class:"btn primary wide",onclick:()=>{P.items=P.items.filter(it=>!it.look);P.workouts=P.workouts.map(cleanW).filter(w=>w.type!=="gym"||w.ex.length||w.session);commit(CUR,P);PREVIEW=null;const q=$("#qIn");if(q)q.value="";toast("Gespeichert");render()}},"Speichern"));
  return box;
}
function workoutLine(w){
  const nm={run:"Laufen",walk:"Gehen",swim:"Schwimmen",bike:"Rad",other:cap(w.name||"Sport"),gym:"Kraft: "+(GYM[w.session]?GYM[w.session].name:"Gym")}[w.type];
  const m=[];if(w.km)m.push(w.type==="swim"?fmt(w.km*1000)+" m":fmt(w.km,1)+" km");if(w.min)m.push(fmt(w.min)+" min");if(w.type==="run"&&w.km&&w.min)m.push(pace(w.min*60/w.km)+" /km");if(w.rpe)m.push("RPE "+fmt(w.rpe,1));
  if(w.ex&&w.ex.length)m.push(w.ex.length+" Übung"+(w.ex.length>1?"en":""));
  return nm+(m.length?" · "+m.join(" · "):"");
}
function trainingCard(s,withActions){
  const done=s.loggedRuns.length,doneGym=s.loggedGym.length;
  const c=h("section",{class:"sec train"});
  c.append(h("div",{class:"sec-h"},h("h2",{},s.ds===todayISO()?"Vorschlag für heute":"Vorschlag für "+short(s.ds)),h("span",{class:"muted tiny"},"Plan als Leitlinie, du entscheidest")));
  if(s.p.note)c.append(h("div",{class:"tiny muted"},"Diese Woche: "+s.p.note));
  const runBlock=h("div",{class:"tb"},h("div",{class:"tb-t"},done?"✓ ":"",s.run.title),h("div",{class:"muted small"},s.run.detail));
  if(s.easyPace&&(s.kind==="easy"||s.kind==="long"))runBlock.append(h("div",{class:"muted tiny"},"Deine lockeren Läufe zuletzt: Ø "+pace(s.easyPace)+" /km"));
  if(done)runBlock.append(h("div",{class:"ok-t small"},"Eingetragen: "+s.loggedRuns.map(workoutLine).join("; ")));
  c.append(runBlock);
  if(s.why.length)c.append(h("ul",{class:"why"},s.why.map(w=>h("li",{},w))));
  if(s.gym){
    const g=h("div",{class:"tb"},h("div",{class:"tb-t"},doneGym?"✓ ":"",s.gym.name),h("div",{class:"muted tiny"},s.gym.rir));
    const tbl=h("div",{class:"ex"});
    for(const e of s.gym.ex)tbl.append(h("div",{class:"ex-r"},h("span",{},e.name),h("span",{class:"num"},e.sets+" × "+(e.range||"")+(e.kg?" · "+kgf(e.kg)+" kg":"")),e.hint?h("span",{class:"muted tiny ex-h"},e.hint):null));
    g.append(tbl);c.append(g);
  }
  if(s.gymWhy.length)c.append(h("ul",{class:"why"},s.gymWhy.map(w=>h("li",{},w))));
  if(withActions&&s.ds<=todayISO()){
    const row=h("div",{class:"btn-row"});const go=()=>{render();setTimeout(()=>$("#logf")?.scrollIntoView({behavior:"smooth",block:"start"}),30)};
    if(s.km>0&&!done)row.append(h("button",{class:"btn",onclick:()=>{LOGFORM={type:"run",km:s.km,min:Math.round(s.km*(s.easyPace?s.easyPace/60:6.8)),rpe:s.kind==="key"?6.5:3.5};go()}},"Lauf übernehmen"));
    if(s.gym&&!doneGym)row.append(h("button",{class:"btn",onclick:()=>{LOGFORM={type:"gym",session:s.gym.id,ex:s.gym.ex.map(e=>({name:e.name,sets:e.sets,reps:typeof e.reps==="number"?e.reps:"",kg:e.kg||""}))};go()}},"Kraft übernehmen"));
    c.append(row);
  }
  return c;
}
function checkSec(){
  const d=day(CUR),ch=d.check,a=ampelOf(ch,CUR),R=readiness(CUR);
  const inp=(id,ph,val,step)=>{const i=h("input",{id,type:"number",inputmode:"decimal",step,placeholder:ph,value:val??""});i.onchange=()=>{const v=i.value.replace(",",".");const k={cSleep:"sleep",cKnee:"knee",cW:"weight",cHrv:"hrv",cRhr:"rhr",cRec:"rec",cStr:"strain"}[id];ch[k]=v===""?null:+v;if(k==="weight"&&ch.weight)S.settings.weight=ch.weight;save();render()};return i};
  const M={"grün":["good","Grün","Plan wie vorgeschlagen."],"gelb":["warn","Gelb","Tempo raus, Umfang −30 %, 1 Satz weniger."],"rot":["bad","Rot","Pause. Hält es 3 Tage an: Arzt oder Physio."]};
  const flag=(f,l)=>h("button",{class:"chip","aria-pressed":(ch.flags||[]).includes(f)?"true":"false",onclick:()=>{ch.flags=ch.flags||[];ch.flags=ch.flags.includes(f)?ch.flags.filter(x=>x!==f):[...ch.flags,f];save();render()}},l);
  return sec("Morgen-Check",a?h("span",{class:"pill "+M[a][0]},M[a][1]):h("span",{class:"muted small"},"offen"),
    h("div",{class:"grid3"},h("label",{},"Schlaf (h)",inp("cSleep","8",ch.sleep,"0.25")),h("label",{},"Knie (0–10)",inp("cKnee","0",ch.knee,"1")),h("label",{},"Gewicht (kg)",inp("cW","78,0",ch.weight,"0.1"))),
    h("div",{class:"grid2",style:"margin-top:8px"},h("label",{},"HRV (ms)",inp("cHrv","60",ch.hrv,"1")),h("label",{},"Ruhepuls",inp("cRhr","52",ch.rhr,"1")),h("label",{},"Recovery (%)",inp("cRec","70",ch.rec,"1")),h("label",{},"Strain (0–21)",inp("cStr","10",ch.strain,"0.1"))),
    h("div",{class:"chips"},flag("müde","müde"),flag("stress","Prüfungsstress"),flag("fieber","Fieber"),flag("hinken","Hinken")),
    h("button",{class:"link",onclick:pasteVitals},"Werte aus der Zwischenablage einfügen"),
    a?h("div",{class:"small muted"},M[a][2]+(R.why.length?" Grund: "+R.why.join(", ")+".":"")):null);
}
async function pasteVitals(){let t="";try{t=await navigator.clipboard.readText()}catch(e){}
  if(!t){toast("Zwischenablage leer oder nicht erlaubt");return}
  const P=parseText(t,CUR);const c={};for(const k of["sleep","hrv","rhr","rec","strain","weight"])if(P.check[k]!=null)c[k]=P.check[k];
  if(!Object.keys(c).length&&P.strainY==null){toast("Keine Werte erkannt");return}
  commit(CUR,{items:[],workouts:[],check:c,supps:{},strainY:P.strainY});toast("Werte übernommen");render()
}
function suppSec(){
  const d=day(CUR);const act=S.settings.supps.filter(s=>s.active);
  const all=act.every(s=>d.supps[s.id]);
  return sec("Supplements",h("button",{class:"link",onclick:()=>{for(const s of act){if(all)delete d.supps[s.id];else d.supps[s.id]=true}save();render()}},all?"Alle zurücksetzen":"Alle genommen"),
    h("div",{class:"chips"},act.map(s=>h("button",{class:"chip","aria-pressed":d.supps[s.id]?"true":"false",onclick:()=>{if(d.supps[s.id])delete d.supps[s.id];else d.supps[s.id]=true;save();render()}},s.name+" "+fmt(s.dose)+" "+s.unit.split(" ")[0]))));
}
function suggestBox(ds,T,tg){
  const sg=foodSuggestions(ds,T,tg);if(!sg.length)return h("div",{class:"small ok-t"},"Deine Nährstoffe sind heute gut gedeckt.");
  return h("div",{class:"sug"},h("div",{class:"tiny muted up"},"Iss noch"),sg.map(x=>h("div",{class:"sug-r"},
    h("div",{},h("div",{},fmt(x.portion)+" g "+x.f.name),h("div",{class:"muted tiny"},x.contrib.map(([k,r])=>(k==="p"?"Protein":NMETA[k].name)+(r>=1?" voll gedeckt":" "+fmt(r*100)+" %")).join(" · ")+" · "+fmt(x.kc)+" kcal")),
    h("button",{class:"add","aria-label":x.f.name+" eintragen",onclick:()=>{commit(ds,{items:[{fid:x.f.id,g:x.portion}],workouts:[],check:{},supps:{},meal:guessMeal()});toast(x.f.name+" eingetragen");render()}},"+"))));
}

/* ---------- Genaue Produkte: Marke, Prozent, Unbekanntes über Open Food Facts ---------- */
const BRANDS=["rewe","rewe bio","beste wahl","gut & günstig","gut und günstig","edeka","aldi","lidl","netto","penny","kaufland","k-classic","milbona","milsani","moser roth","fin carré","alnatura","dm","dmbio","ehrmann","müller","lindt","ritter sport","milka","alpro","oatly","barilla","oetker","dr. oetker","kölln","seitenbacher","mymuesli","esn","more nutrition","weihenstephan","arla","zott","danone","nestlé","nestle","ferrero","kinder","haribo","coca cola","coca-cola","red bull","landliebe","bärenmarke","harry","golden toast","iglo","frosta","wagner","gustavo gusto","rügenwalder","garden gourmet","valensina","hohes c","leibniz","bahlsen","oreo","kellogg's","kelloggs","exquisa","philadelphia","almighurt","activia","andechser","schwarzwaldmilch","bauer","frosta","mestemacher","lieken","harry brot","rauch","innocent","true fruits","nutella","snickers","kitkat","ültje","seeberger","rapunzel","davert","bio company","foodspring","myprotein","yfood","powerbar","clif","huel","barebells","wasa","pema","mühlenhof","ja!"];
const BRAND_RE=new RegExp("(?:^|\\s)("+BRANDS.map(b=>b.replace(/[.*+?^${}()|[\]\\!&-]/g,"\\$&")).sort((a,b)=>b.length-a.length).join("|")+")(?=\\s|$)");
function brandIn(t){const m=(" "+t+" ").match(BRAND_RE);if(m)return m[1];const v=t.match(/\b(?:von|vom|marke)\s+([a-zäöüß][a-zäöüß0-9&!.-]{1,})/);if(v&&!FILLER_ONE.test(v[1])&&!findFood(v[1]))return v[1];return null}
const FILLER_ONE=new RegExp("^"+FILLER.source.replace(/^\\b/,"").replace(/\\b$/,"")+"$");
function searchText(t){const pc=t.match(/pct[\d.]+/g)||[];t=t.replace(/pct[\d.]+/g," ");return (t.replace(UNIT_RE,"").replace(FILLER,"").replace(/\b(von|vom|marke|sorte)\b/g,"").replace(/[^a-zäöüß0-9.&! -]/g," ").replace(/\s+/g," ").trim()+" "+pc.join(" ")).trim()}
const STOP=new Set(["und","mit","von","vom","der","die","das","bio","g","ml"]);
async function offSearch(q,brand,pct){
  const terms=q.replace(/pct([\d.]+)/g,"$1%");
  const url=h=>"https://"+h+".openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=30&fields=code,product_name,product_name_de,generic_name_de,brands,nutriments,serving_quantity,quantity&search_terms="+encodeURIComponent(terms);
  const words=q.replace(/pct[\d.]+/g,"").split(/\s+/).filter(w=>w.length>1&&!STOP.has(w));
  const score=p=>{const name=((p.product_name_de||p.product_name||"")+" "+(p.generic_name_de||"")).toLowerCase(),br=(p.brands||"").toLowerCase(),all=name+" "+br;let s=0;
    for(const w of words){if(brand&&brand.includes(w))continue;if(all.includes(w))s+=1;else if(w.length>=5&&all.includes(w.slice(0,-1)))s+=0.7}
    if(brand){const b=brand.replace(/!$/,"");if(br.includes(b)||name.includes(b))s+=3;else s-=2}
    if(pct){const re=new RegExp("(^|\\D)"+String(pct).replace(".","[.,]")+"\\s*%");if(re.test(name))s+=3;else s-=1}
    const n=p.nutriments||{};s+=Object.keys(n).filter(k=>/_100g$/.test(k)).length*0.01;return s};
  const need=(brand?3:0)+(pct?2:0)+Math.min(1,words.length);
  for(const host of["de","world"]){
    try{const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),9000);
      const r=await fetch(url(host),{signal:ctl.signal});clearTimeout(tm);const j=await r.json();
      const c=(j.products||[]).filter(p=>(p.product_name_de||p.product_name)&&p.nutriments&&p.nutriments["energy-kcal_100g"]!=null).map(p=>({p,s:score(p)})).sort((a,b)=>b.s-a.s);
      if(c.length&&c[0].s>=need)return c[0].p}catch(e){if(e.name==="AbortError"||e instanceof TypeError)return"offline"}}
  return null}
function offFood(p,gen){const f=offToFood({...p,product_name:p.product_name_de||p.product_name});
  if(!gen){const b=BLS&&blsFind(searchText(normalize(p.product_name_de||p.product_name||"")));gen=b?blsFood(b):findFood(normalize(f.name))}
  if(gen){[NI.fib,...NK.map((k,i)=>i).filter(i=>i>=NI.vA)].forEach(i=>{if(!f.n[i])f.n[i]=gen.n[i]});f.fl=gen.fl||f.fl;f.gen=gen.id}
  if(+p.serving_quantity>0)f.u=+p.serving_quantity;else if(gen)f.u=gen.u;
  return f}
async function enrich(P){
  const todo=P.items.filter(it=>it.q&&!it.done);if(!todo.length)return;
  todo.forEach(it=>it.pending=true);if(PREVIEW===P)render();
  let offline=false;
  await Promise.all(todo.map(async it=>{
    let f=S.learn[it.q]&&foodById(S.learn[it.q]),src=f?(f.src==="bls"?"bls":/^off/.test(f.id)?"off":"own"):null;
    if(!f&&!it.brand){await loadBLS();const b=blsFind(it.q,it.pct);if(b&&(!it.alt||blsBetter(b,it))){f=blsFood(b);src="bls"}}
    if(!f&&!it.alt){const p=await offSearch(it.q,it.brand,it.pct);if(p==="offline")offline=true;else if(p){await loadBLS();f=offFood(p,it.gen&&FOODS[it.gen]);if(!S.custom.find(c=>c.id===f.id))S.custom.push(f);S.learn[it.q]=f.id;src="off";save()}}
    if(!f&&it.look){await loadBLS();const b=blsFind(it.brand?it.q.replace(it.brand,""):it.q,0);if(b){f=blsFood(b);src="bls"}}
    it.pending=false;it.done=true;
    if(f&&it.alt&&src!=="bls"){f=null}
    if(f){if(it.look){it.g=it.num!=null?gramsFor(f,it.num,it.unit,it.q,false):f.u||100;delete it.name;delete it.n;delete it.look}it.fid=f.id;it.off=src==="off";it.bls=src==="bls"}
    else if(it.alt){}
    else if(it.look){it.drop=true;P.unknown.push(it.name)}
    else it.offMiss=true}));
  P.items=P.items.filter(it=>!it.drop);
  if(offline)toast("Offline: Produktsuche später nochmal");
  if(PREVIEW===P)render()}

/* ---------- Lebensmittel-Auswahl (Suche, lokal + Open Food Facts) ---------- */
function openPicker(onPick){
  const dlg=$("#picker");const q=$("#pkQ"),list=$("#pkList");q.value="";
  const pick=f=>{dlg.close();onPick(f)};
  const msg=t=>h("p",{class:"muted small pk-m"},t);
  const kc=f=>fmt(f.n[0])+" kcal · "+fmt(f.n[1],1)+" g P /100 g";
  const row=(f,sub,fn)=>h("button",{class:"pk-i",onclick:fn},h("span",{},f.name),h("span",{class:"muted tiny num"},sub));
  const tag=f=>f.src==="bls"?" · BLS":f.src==="own"?" · eigenes":/^off/.test(f.id)?" · Produkt":"";
  const byCode=async code=>{list.replaceChildren(msg("Suche Barcode "+code+" …"));const f=await foodByCode(code);if(f)return pick(f);
    list.replaceChildren(msg("Produkt "+code+" ist nicht in Open Food Facts. Leg es mit den Werten von der Packung an."),ownFoodForm(pick,{code}))};
  const filter=()=>{const s=q.value.trim().toLowerCase();
    if(/^\d{8,14}$/.test(s))return list.replaceChildren(row({name:"Barcode "+s+" suchen"},"Open Food Facts",()=>byCode(s)));
    if(!s)return list.replaceChildren(...allFoods().slice().sort((a,b)=>a.name.localeCompare(b.name,"de")).slice(0,60).map(f=>row(f,kc(f)+tag(f),()=>pick(f))));
    const own=allFoods().filter(f=>f.name.toLowerCase().includes(s)||f.al.some(a=>a.startsWith(s)||a.includes(s))).slice(0,15);const seen=new Set(own.map(f=>f.id));
    const bl=blsRank(s,{prefix:true,limit:45}).filter(x=>!seen.has(x.b.id)).slice(0,35);
    if(!own.length&&!bl.length)return list.replaceChildren(msg(BLS?"Nichts gefunden. Scanne den Barcode, such online oder leg es selbst an.":"Datenbank lädt …"));
    list.replaceChildren(...own.map(f=>row(f,kc(f)+tag(f),()=>pick(f))),...bl.map(({b})=>row(b,kc(b)+" · BLS",()=>pick(blsFood(b)))))};
  q.oninput=filter;filter();if(!BLS)loadBLS().then(()=>{if(dlg.open)filter()});
  $("#pkScan").onclick=async()=>{const code=await scanBarcode();if(code){q.value=code;byCode(code)}};
  $("#pkOwn").onclick=()=>list.replaceChildren(ownFoodForm(pick,{name:q.value.trim()}));
  $("#pkOff").onclick=async()=>{const s=q.value.trim();if(s.length<2){q.focus();return}$("#pkOff").textContent="Suche läuft …";
    try{const ctl=new AbortController();setTimeout(()=>ctl.abort(),9000);
      const r=await fetch("https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=20&fields="+OFF_FIELDS+"&search_terms="+encodeURIComponent(s),{signal:ctl.signal});
      const j=await r.json();const ps=(j.products||[]).filter(p=>(p.product_name_de||p.product_name)&&p.nutriments&&p.nutriments["energy-kcal_100g"]!=null);
      if(!ps.length){toast("Nichts gefunden");return}
      list.replaceChildren(...ps.map(p=>{const v=offToFood({...p,product_name:p.product_name_de||p.product_name});return row(v,kc(v)+" · Produkt",()=>{const f=offFood(p);const ex=S.custom.find(c=>c.id===f.id);if(!ex){S.custom.push(f);save()}pick(ex||f)})}));
    }catch(e){toast("Online-Suche nicht erreichbar")}finally{$("#pkOff").textContent="Online suchen"}};
  dlg.showModal();setTimeout(()=>q.focus(),50);
}
function offToFood(p){const n=p.nutriments,g=k=>+n[k+"_100g"]||0;const v=NK.map(()=>0);
  v[NI.kcal]=g("energy-kcal");v[NI.p]=g("proteins");v[NI.c]=g("carbohydrates");v[NI.f]=g("fat");v[NI.fib]=g("fiber");v[NI.sug]=g("sugars");v[NI.sfa]=g("saturated-fat");
  v[NI.na]=g("sodium")*1000||g("salt")*400;v[NI.ca]=g("calcium")*1000;v[NI.fe]=g("iron")*1000;v[NI.mg]=g("magnesium")*1000;v[NI.k]=g("potassium")*1000;v[NI.zn]=g("zinc")*1000;v[NI.vC]=g("vitamin-c")*1000;v[NI.vD]=g("vitamin-d")*1e6;v[NI.b12]=g("vitamin-b12")*1e6;
  for(const[k,o,f]of[["vA","vitamin-a",1e6],["vE","vitamin-e",1000],["vK","vitamin-k",1e6],["b1","vitamin-b1",1000],["b2","vitamin-b2",1000],["b3","vitamin-pp",1000],["b5","pantothenic-acid",1000],["b6","vitamin-b6",1000],["b7","biotin",1e6],["b9","vitamin-b9",1e6],["b9","folates",1e6],["ph","phosphorus",1000],["cu","copper",1000],["mn","manganese",1000],["se","selenium",1e6],["io","iodine",1e6],["ala","alpha-linolenic-acid",1],["cho","choline",1000]])if(!v[NI[k]]&&g(o))v[NI[k]]=g(o)*f;
  if(g("eicosapentaenoic-acid")||g("docosahexaenoic-acid"))v[NI.o3]=g("eicosapentaenoic-acid")+g("docosahexaenoic-acid");
  const name=(p.product_name+(p.brands?" ("+p.brands.split(",")[0]+")":"")).slice(0,60);
  return{id:"off"+(p.code||uid()),name,al:[name.toLowerCase()],n:v,u:100,fl:(g("sugars")>20?"s":"")+"x"};
}

/* ---------- Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut, CC BY 4.0) ----------
   bls.json: 7.140 Lebensmittel, je 100 g essbarer Anteil. Fehlende Werte (Selen, Cholin,
   Pflanzenstoffe, Kreatin stehen nicht im BLS) werden aus dem ähnlichsten App-Lebensmittel geschätzt. */
let BLS=null,BLSP=null;
const fold=s=>String(s).toLowerCase().replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u").replace(/ß/g,"ss").replace(/ae/g,"a").replace(/oe/g,"o").replace(/ue/g,"u");
const PREPW=new Set(["roh","gekocht","gegart","gebraten","gegrillt","gedunstet","gedampft","frittiert","gebacken","geroestet","gerostet","getrocknet","geschmort","tiefgefroren","konserve","pulver","instant","ungesusst","gesusst","zubereitet","uberbacken","geraucht"]);
const COOKED=/\b(gegart|gekocht|gebraten|gegrillt|gedunstet|gedampft|geschmort)\b/;
function loadBLS(){if(BLS)return Promise.resolve(BLS);
  return BLSP||(BLSP=fetch("bls.json").then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{const ix=j.k.map(k=>NI[k]??-1);
    BLS=j.d.map(([code,name,v])=>{const n=NK.map(()=>0),miss=[];NK.forEach((k,i)=>{if(!j.k.includes(k))miss.push(i)});
      v.forEach((x,i)=>{const t=ix[i];if(t<0)return;if(x==null)miss.push(t);else n[t]=x});
      const fn=fold(name),w=fn.split(/[^a-z0-9]+/).filter(t=>t.length>1&&!/^\d+$/.test(t));return{id:"bls"+code,code,name,n,miss,fn,w,c:w.join("")}});
    return BLS}).catch(()=>{BLSP=null;return null}))}
const BLS_SYN={brezel:"laugengebäck",brezeln:"laugengebäck",laugenbrezel:"laugengebäck",hüttenkäse:"körniger frischkäse",cottage:"körniger frischkäse",kaiserschmarrn:"kaiserschmarren",nudeln:"teigwaren",pasta:"teigwaren",spaghetti:"teigwaren",hack:"hackfleisch",gehacktes:"hackfleisch",pommes:"pommes frites",semmel:"brötchen",schrippe:"brötchen",wecken:"brötchen",paradeiser:"tomate",erdäpfel:"kartoffel",topfen:"speisequark",quark:"speisequark",hendl:"hähnchen",huhn:"hähnchen",hühnchen:"hähnchen",pute:"pute",truthahn:"pute",obers:"sahne",rahm:"sahne",karotten:"karotte",möhren:"karotte",möhre:"karotte"};
const NAMEIGN=new Set(["roh","reif","frisch","fett","mind","max","tr","bis","pasteurisiert","ultrahocherhitzt","ohne","pfanne","ofen","natur","ganzes","abgetropft","gegart","gekocht","gebraten","gegrillt","gedunstet","gedampft","geschmort","vorgegart","zubereitet","selbstgemacht"]);
const INFL=/^(e|n|en|er|s|es|ern|nen|se|ns)$/;
function blsWords(q){return fold(q.replace(/pct[\d.]+/g," ").replace(/[a-zäöüß]+/g,w=>BLS_SYN[w]||w)).split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!/^\d/.test(w)&&!STOP.has(w))}
/* Treffer eines Suchworts in den Wörtern eines BLS-Namens: [Punkte, abgedeckte Wörter] */
function wordHit(w,T,pre){let best=0,cov=0;const set=(p,c)=>{if(p>best){best=p;cov=c}};
  for(let i=0;i<T.length;i++){const t=T[i];
    if(t===w){set(3,1);continue}
    if(t.length>=3&&w.length>=3){
      if(w.startsWith(t)){const r=w.slice(t.length);if(INFL.test(r))set(2.9,1);
        else{const r2=r.replace(/^(er|en|es|e|s|n)/,"");for(let j=0;j<T.length;j++)if(j!==i&&r2.length>=3&&(T[j].startsWith(r2)||(T[j].length>=4&&r2.startsWith(T[j])))){set(2.8,2);break}
          if(i+1<T.length&&(t+T[i+1]===w||INFL.test(w.slice((t+T[i+1]).length))&&w.startsWith(t+T[i+1])))set(2.9,2);
          if(t.length>=4)set(1.4,1)}}
      else if(t.startsWith(w)){const r=t.slice(w.length);set(INFL.test(r)?2.9:pre?2:1.7,1)}}}
  if(!best&&w.length>=4&&T.join("").includes(w))set(1.3,1);
  return[best,cov]}
function blsScore(b,qw,prefix){let s=0,hit=0,cov=0;
  qw.forEach((w,qi)=>{const[p,c]=wordHit(w,b.w,prefix&&qi===qw.length-1);
    if(p){hit++;cov+=c;s+=p;if(qi===0&&(b.w[0]===w||(p>=2.8&&(w.startsWith(b.w[0])||b.w[0].startsWith(w)))))s+=1}else s-=2.5});
  if(!hit)return{s:-99,hit};
  const extra=b.w.filter(t=>!NAMEIGN.has(t)).length-cov;s-=0.55*Math.max(0,extra);const g=b.code[0];
  if(!qw.some(w=>PREPW.has(w))){
    if("FGH".includes(g)&&b.w.includes("roh"))s+=0.5;
    if("UVTECK".includes(g)&&COOKED.test(b.fn))s+=0.4;
    if(/\b(getrocknet|pulver|instantpulver|konserve|tiefgefroren|gesalzen|gezuckert|laktosefrei)\b/.test(b.fn))s-=0.6}
  if("XY".includes(g))s-=0.6;
  return{s,hit}}
function blsRank(q,{prefix=false,pct=0,limit=40}={}){if(!BLS)return[];const qw=blsWords(q);if(!qw.length)return[];
  const pc=pct?String(pct).replace(".",",")+" %":null;
  return BLS.map(b=>{const r=blsScore(b,qw,prefix);if(pc&&b.fn.includes(pc))r.s+=2.5;return{b,...r,pc:!pc||b.fn.includes(pc)}})
    .filter(x=>x.hit===qw.length||(qw.length>=3&&x.hit>=qw.length-1)).sort((a,b)=>b.s-a.s).slice(0,limit)}
function blsFind(q,pct){const r=blsRank(q,{pct,limit:1})[0];if(!r||r.s<0.5)return null;if(pct&&!r.pc)return null;return r.b}
/* Wörter der Eingabe, die das erkannte App-Lebensmittel nicht abdeckt (z. B. „paniert“, „Vollkorn“). */
const GENERIC=new Set(["frisch","bio","natur","klein","gross","stuck","portion","scheibe","scheiben","glas","tasse","becher","dose","pct"]);
function extraWords(q,f){const al=f.al.map(fold).concat(fold(f.name).split(/[^a-z0-9]+/));
  return blsWords(q).filter(w=>!PREPW.has(w)&&!GENERIC.has(w)&&!al.some(a=>a&&(a===w||(a.length>=3&&w.startsWith(a)&&INFL.test(w.slice(a.length)))||(w.length>=4&&a.startsWith(w))||(a.length>=5&&a.includes(w)))))}
function blsBetter(b,it){const g=FOODS[it.gen];return!g||extraWords(it.q,g).every(w=>b.w.some(t=>t===w||(w.length>=4&&(t.startsWith(w)||w.startsWith(t))))||b.c.includes(w))}
/* Werte, die im BLS fehlen, aus dem ähnlichsten App-Lebensmittel schätzen (über die Energiedichte skaliert). */
function fillMissing(f,miss,name){const gen=findFood(normalize(name));if(!gen)return null;
  const sc=f.n[NI.kcal]>0&&gen.n[NI.kcal]>0?Math.min(3,Math.max(0.3,f.n[NI.kcal]/gen.n[NI.kcal])):1;const est=[];
  for(const i of miss)if(gen.n[i]){f.n[i]=Math.round(gen.n[i]*sc*100)/100;est.push(NK[i])}
  if(est.length)f.est=est;f.u=gen.u||f.u;return gen}
function estTxt(f){const L={se:"Selen",cho:"Cholin",poly:"Polyphenole",lut:"Lutein",lyc:"Lycopin",cr:"Kreatin"};const e=(f.est||[]).map(k=>L[k]||NUTR[NI[k]][1]);return e.length>2?e.slice(0,2).join(", ")+" u. a.":e.join(", ")}
function blsFlags(b){const g=b.code[0],n=b.fn;let fl="";
  if((g==="G"&&!/suppe|pulver/.test(n))||(g==="F"&&!/saft|nektar|getrank|konfit|gezuckert|sirup/.test(n)))fl+="v";
  if(g==="S"||(/\b(gesusst|gezuckert)\b/.test(n)&&!/ungesusst/.test(n)))fl+="s";
  if("WSDR".includes(g)||/instant/.test(n))fl+="x";
  if(g==="P")fl+="a";
  if("NP".includes(g)||/saft|nektar|\bdrink\b|getrank|smoothie|bruhe|milch\b|vollmilch|magermilch|buttermilch|kefir|eistee|limonade/.test(n)&&!/kase|pulver|schokolade/.test(n))fl+="l";
  return fl}
function blsFood(b){const ex=foodById(b.id);if(ex)return ex;
  const f={id:b.id,name:b.name,al:[],n:b.n.slice(),u:100,fl:blsFlags(b),src:"bls"};
  if(f.fl.includes("l"))f.u=250;if(f.fl.includes("a"))f.dr=b.name.match(/bier/i)?500:b.name.match(/wein|sekt/i)?150:40;
  fillMissing(f,b.miss,b.name);S.custom.push(f);save();return f}

/* ---------- Barcode: Kamera (BarcodeDetector oder ZXing) + Open Food Facts ---------- */
const OFF_FIELDS="code,product_name,product_name_de,generic_name_de,brands,nutriments,serving_quantity,quantity";
function loadScript(src){return new Promise((ok,no)=>{if(window.ZXing)return ok();const s=h("script",{src});s.onload=ok;s.onerror=no;document.head.append(s)})}
async function scanBarcode(){
  const dlg=$("#scan"),vid=$("#scVid"),st=$("#scSt");let stream;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast("Kamera wird hier nicht unterstützt");return null}
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false})}catch(e){toast("Kein Kamerazugriff. In den Einstellungen erlauben.");return null}
  vid.srcObject=stream;st.textContent="Barcode ins Bild halten …";dlg.showModal();try{await vid.play()}catch(e){}
  return new Promise(res=>{let done=false;
    const stop=code=>{if(done)return;done=true;stream.getTracks().forEach(t=>t.stop());vid.srcObject=null;if(dlg.open)dlg.close();res(code)};
    $("#scClose").onclick=()=>stop(null);dlg.onclose=()=>stop(null);
    const fmts=["ean_13","ean_8","upc_a","upc_e"];
    const native=async()=>{try{if(!("BarcodeDetector" in window))return false;const ok=(await BarcodeDetector.getSupportedFormats()).some(f=>fmts.includes(f));if(!ok)return false;
      const det=new BarcodeDetector({formats:fmts});const tick=async()=>{if(done)return;try{const r=await det.detect(vid);if(r[0])return stop(r[0].rawValue)}catch(e){}setTimeout(tick,150)};tick();return true}catch(e){return false}};
    native().then(async ok=>{if(ok)return;
      try{await loadScript("vendor/zxing.min.js")}catch(e){st.textContent="Scanner konnte nicht geladen werden. Gib die Nummer unter dem Barcode in die Suche ein.";return}
      const Z=window.ZXing,hints=new Map();hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E]);hints.set(Z.DecodeHintType.TRY_HARDER,true);
      const rd=new Z.MultiFormatReader();rd.setHints(hints);const cv=document.createElement("canvas"),cx=cv.getContext("2d",{willReadFrequently:true});
      const tick=()=>{if(done)return;const w=vid.videoWidth,hh=vid.videoHeight;
        if(w&&hh){const cw=Math.min(w,960),ch=Math.round(hh*cw/w);cv.width=cw;cv.height=ch;cx.drawImage(vid,0,0,cw,ch);
          try{const r=rd.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv))));if(r&&r.getText())return stop(r.getText())}catch(e){}}
        setTimeout(tick,120)};tick()})})}
async function offByCode(code){
  try{const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),9000);
    const r=await fetch("https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields="+OFF_FIELDS,{signal:ctl.signal});clearTimeout(tm);
    const j=await r.json();const p=j&&j.product;if(!p||!(p.product_name_de||p.product_name)||!p.nutriments||p.nutriments["energy-kcal_100g"]==null)return null;p.code=p.code||code;return p}
  catch(e){return"offline"}}
async function foodByCode(code){const known=S.custom.find(c=>c.code===code);if(known)return known;
  await loadBLS();const p=await offByCode(code);if(p==="offline"){toast("Offline: Barcode später nochmal scannen");return null}
  if(!p)return null;const f=offFood(p);f.code=code;if(!S.custom.find(c=>c.id===f.id))S.custom.push(f);save();return f}

/* ---------- Eigenes Lebensmittel anlegen (Werte von der Packung) ---------- */
function ownFoodForm(onDone,pre={}){
  const fld=(k,label,unit)=>{const i=h("input",{type:"number",inputmode:"decimal",step:"any",id:"own_"+k,value:pre[k]??""});return h("label",{},label+" ("+unit+")",i)};
  const nm=h("input",{type:"text",id:"own_name",placeholder:"z. B. Proteinriegel Cookie",value:pre.name||""});
  const box=h("div",{class:"own"},h("p",{class:"small"},"Werte pro 100 g von der Packung. Vitamine und Mineralstoffe ergänzt die App aus dem ähnlichsten Lebensmittel."+(pre.code?" Barcode "+pre.code+" wird gemerkt.":"")),
    h("label",{},"Name",nm),
    h("div",{class:"grid2"},fld("kcal","Energie","kcal"),fld("p","Protein","g"),fld("c","Kohlenhydrate","g"),fld("f","Fett","g"),fld("sug","davon Zucker","g"),fld("sfa","gesättigte Fette","g"),fld("fib","Ballaststoffe","g"),fld("salt","Salz","g"),fld("u","Portion","g")),
    h("button",{class:"btn primary wide",onclick:()=>{const name=nm.value.trim();const v=k=>+String($("#own_"+k).value).replace(",",".")||0;
      if(!name||!v("kcal")){toast("Name und Energie angeben");return}
      const f={id:"own"+uid(),name,al:[name.toLowerCase()],n:NK.map(()=>0),u:v("u")||100,fl:"",src:"own"};if(pre.code)f.code=pre.code;
      for(const k of["kcal","p","c","f","sug","sfa","fib"])f.n[NI[k]]=v(k);f.n[NI.na]=v("salt")*400;
      const b=BLS&&blsFind(searchText(normalize(name)));const src=b?{n:b.n}:findFood(normalize(name));
      if(src){const sc=src.n[NI.kcal]>0?Math.min(3,Math.max(0.3,f.n[NI.kcal]/src.n[NI.kcal])):1;const est=[];NK.forEach((k,i)=>{if(i>=NI.vA&&!f.n[i]&&src.n[i]&&k!=="na"){f.n[i]=Math.round(src.n[i]*sc*100)/100;est.push(k)}});if(b)fillMissing(f,b.miss.filter(i=>!f.n[i]),b.name);if(est.length)f.est=[...new Set([...(f.est||[]),...est])];f.u=v("u")||f.u}
      S.custom.push(f);save();onDone(f)}},"Speichern"));
  return box}

/* ---------- Ernährung ---------- */
function renderErnaehrung(){
  const root=$("#v-ernaehrung");root.replaceChildren();
  root.append(quickInput("food"));if(PREVIEW&&PREVIEW.where==="ernaehrung")root.append(previewBox());
  root.append(h("button",{class:"btn wide",onclick:()=>openPicker(f=>{PREVIEW={text:"",meal:guessMeal(),items:[{fid:f.id,g:f.p||f.u}],workouts:[],check:{},supps:{},unknown:[],where:"ernaehrung"};render()})},"Lebensmittel suchen"));
  root.append(nutriSummary());root.append(suppSec());const w=warnSec();if(w)root.append(w);
  const d=hasDay(CUR)?day(CUR):{entries:[]};
  const byMeal={};for(const e of d.entries)(byMeal[e.meal||"snack"]??=[]).push(e);
  const list=h("div",{});
  if(!d.entries.length)list.append(h("p",{class:"muted small"},"Noch nichts gegessen eingetragen."));
  for(const m of MEALS.concat(Object.keys(byMeal).filter(k=>!MEALS.includes(k)))){if(!byMeal[m])continue;
    const items=byMeal[m].flatMap(e=>e.items.map((it,i)=>({e,it,i})));const kc=items.reduce((a,x)=>a+itemNut(x.it)[0],0);
    list.append(h("div",{class:"meal-h"},h("span",{},cap(m)),h("span",{class:"num muted"},fmt(kc)+" kcal")));
    for(const{e,it}of items){const n=itemNut(it);const gi=h("input",{type:"number",inputmode:"numeric",value:it.g,"aria-label":"Gramm"});gi.onchange=()=>{it.g=Math.max(0,+gi.value||0);save();render()};
      list.append(h("div",{class:"food-r"},h("div",{class:"food-n"},h("div",{},itemName(it)),h("div",{class:"muted tiny num"},fmt(n[0])+" kcal · "+fmt(n[1])+" P · "+fmt(n[2])+" KH · "+fmt(n[3])+" F")),gi,h("span",{class:"muted tiny"},"g"),
        h("button",{class:"x","aria-label":"Löschen",onclick:()=>{e.items=e.items.filter(x=>x!==it);if(!e.items.length)d.entries=d.entries.filter(x=>x!==e);save();render()}},"×")))}
  }
  root.append(sec("Gegessen",null,list));
  // Nährstoffe komplett
  const T=effT(CUR),tg=targetsFor(CUR);
  const grp=(title,g)=>{const rows=NUTR.filter(n=>n[5]===g&&n[3]>0).map(n=>{const v=T[n[0]],r=v/n[3];const over=n[4]&&v>n[4];const wn=T._win[n[0]];
    return h("div",{class:"nr"+(over?" over":r<0.6?" low":"")},h("span",{},n[1],wn>1?h("span",{class:"tiny muted"}," Ø "+wn+" T"):null),h("span",{class:"num muted"},fmt(v,n[6])+" / "+fmt(n[3],n[6])+" "+n[2]),bar(v,n[3],"",false),h("span",{class:"num pct"},fmt(Math.min(r*100,999))+" %"))});
    return h("div",{class:"ngroup"},h("div",{class:"tiny muted up"},title),rows)};
  const m=h("div",{class:"ngroup"},h("div",{class:"tiny muted up"},"Makros"),
    [["Energie",T.kcal,tg.kcal,"kcal"],["Protein",T.p,tg.p,"g"],["Kohlenhydrate",T.c,tg.c,"g"],["Fett",T.f,tg.f,"g"],["Ballaststoffe",T.fib,38,"g"]].map(([l,v,t,u])=>h("div",{class:"nr"},h("span",{},l),h("span",{class:"num muted"},fmt(v)+" / "+fmt(t)+" "+u),bar(v,t),h("span",{class:"num pct"},fmt(Math.min(v/t*100,999))+" %"))),
    h("div",{class:"nr"},h("span",{},"Zugesetzter Zucker"),h("span",{class:"num muted"},fmt(T.addSug)+" g, Ziel < 50 g"),h("span",{}),h("span",{})),
    h("div",{class:"nr"},h("span",{},"Gesättigte Fette"),h("span",{class:"num muted"},fmt(T.sfa)+" g, Ziel < "+fmt(tg.kcal*0.1/9)+" g"),h("span",{}),h("span",{})));
  root.append(sec("Alle Nährstoffe",h("span",{class:"muted tiny"},"Ziele: optimal, unter den Obergrenzen"),m,grp("Vitamine","v"),grp("Mineralstoffe","n"),grp("Fettsäuren","o"),grp("Pflanzenstoffe & Kreatin","x"),
    h("p",{class:"muted tiny"},"„Ø … T“: Diese Nährstoffe speichert der Körper (Leber, Fettgewebe, Schilddrüse, Zellmembranen). Ein Tag mit viel gleicht einen Tag mit wenig aus, deshalb zählt der Schnitt deiner letzten Tage mit Einträgen. Vitamin C, die meisten B-Vitamine, Cholin, Kalium und Protein brauchst du täglich. Nährwerte sind Durchschnittswerte, keine Laborwerte. Jod und Biotin sind in den meisten Tabellen lückenhaft, beim Jod hilft Jodsalz. Rot heißt über der sicheren Obergrenze.")));
  root.append(gapSec());
}


/* ---------- Einheit bearbeiten ---------- */
let EDIT=null;
const WTYPES=[["run","Laufen"],["gym","Kraft"],["swim","Schwimmen"],["bike","Rad"],["walk","Gehen"],["other","Sonstiges"]];
function parseList(v){return String(v).replace(/kg|kilo|wdh\.?|x/gi,"").split(/[\/,;\s]+/).map(x=>x.replace(",",".")).filter(x=>x!==""&&!isNaN(+x)).map(Number)}
function setReps(e,v){delete e.repList;delete e.reps;const l=parseList(v);if(l.length>1){e.repList=l;e.reps=l[l.length-1];if(!e.sets||e.sets<l.length)e.sets=l.length}else if(l.length)e.reps=l[0]}
function setKg(e,v){delete e.kgList;delete e.kg;delete e.bw;if(/körper|eigen|bw/i.test(v)){e.bw=true;return}const l=/^\s*\d+,\d{1,3}\s*(kg)?\s*$/i.test(v)?[+v.replace(/kg/i,"").replace(",",".")]:parseList(v);if(l.length>1){e.kgList=l;e.kg=Math.max(...l)}else if(l.length)e.kg=l[0]}
function wEditor(w,changed){
  const box=h("div",{class:"wed"});
  const inp=(val,ph,on,mode="decimal",cls="")=>{const i=h("input",{type:"text",inputmode:mode,placeholder:ph,value:val??"",class:cls});i.onchange=()=>{on(i.value.trim());changed(false)};return i};
  if(w.type==="gym"){
    w.ex??=[];
    const tb=h("table",{class:"ex-t ex-ed"},h("thead",{},h("tr",{},h("th",{},"Übung"),h("th",{},"Sätze"),h("th",{},"Wdh."),h("th",{},"Gewicht"),h("th",{}))));
    const body=h("tbody",{});
    w.ex.forEach((e,i)=>body.append(h("tr",{},
      h("td",{},inp(e.name,"Übung",v=>e.name=v||"Übung","text","n")),
      h("td",{},inp(e.sets,"3",v=>{const n=parseInt(v);if(n>0)e.sets=n;else delete e.sets},"numeric","s")),
      h("td",{},inp(e.repList?e.repList.join("/"):e.reps,"10",v=>setReps(e,v),"text","r")),
      h("td",{},inp(e.kgList?e.kgList.join("/"):e.bw?"Körpergewicht":e.kg,"kg",v=>setKg(e,v),"text","k")),
      h("td",{},h("button",{class:"x","aria-label":"Übung entfernen",onclick:()=>{w.ex.splice(i,1);changed(true)}},"×")))));
    tb.append(body);box.append(tb);
    box.append(h("button",{class:"link",onclick:()=>{w.ex.push({name:""});changed(true);setTimeout(()=>{const ns=[...document.querySelectorAll(".ex-ed input.n")];ns.length&&ns[ns.length-1].focus()},30)}},"+ Übung hinzufügen"));
    box.append(h("p",{class:"muted tiny"},"Mehrere Sätze verschieden? Einfach „10/8/6“ bzw. „60/65/70“ eintragen. Gewicht leer lassen, wenn keins."));
  }else{
    const g=h("div",{class:"grid3"});
    if(w.type==="swim")g.append(h("label",{},"Meter",inp(w.km?Math.round(w.km*1000):"","1500",v=>{const n=+v.replace(",",".");if(n>0)w.km=n/1000;else delete w.km})));
    else if(w.type!=="other")g.append(h("label",{},"km",inp(w.km,"8",v=>{const n=+v.replace(",",".");if(n>0)w.km=n;else delete w.km})));
    g.append(h("label",{},"Minuten",inp(w.min,"50",v=>{const n=+v.replace(",",".");if(n>0)w.min=n;else delete w.min})),h("label",{},"RPE 1–10",inp(w.rpe,"4",v=>{const n=+v.replace(",",".");if(n>0)w.rpe=n;else delete w.rpe})));
    box.append(g);
    if(w.type==="other")box.append(h("label",{},"Was",inp(w.name,"z. B. Fußball, Yoga",v=>w.name=v,"text")));
  }
  return box}
function addUnitRow(onAdd){return h("div",{class:"add-unit"},h("span",{class:"small"},"+ Einheit hinzufügen:"),h("div",{class:"chips"},WTYPES.map(([t,l])=>h("button",{class:"chip",onclick:()=>onAdd(t==="gym"?{type:"gym",session:(suggest(CUR,1)[0].gym||{id:"push"}).id,ex:[{name:""}],min:60}:{type:t,rpe:4})},l))))}
function cleanW(w){if(w.ex)w.ex=w.ex.filter(e=>e.name&&e.name.trim());if(w.type==="run"&&w.km&&!w.min)w.min=Math.round(w.km*6.8);if(w.type==="run"&&w.min&&!w.km)w.km=Math.round(w.min/6.8*10)/10;return w}

/* ---------- Heute noch zu wenig: eine Kombination, die möglichst alles abdeckt ---------- */
const COMBO_SKIP=new Set(["salz","tee","kaffee","whey","zucker","honig","sportdrink","gel","proteinriegel","hefeflocken","nori","leber","huehnerleber","austern","kokosoel","ghee","butter","oel","rapsoel","leinoel","evoo","kresse","knoblauch","ingwer","goji","chili1","kakaopulver"]);
function portionOf(f){return f.id==="paranuss"?10:Math.min(f.p||f.u||100,(f.u||100)>=100?(f.u||100):(f.u||100)*2,300)}
/* Gierige Mengenüberdeckung: nimmt nacheinander das Lebensmittel, das von den noch offenen Lücken
   am meisten schließt (jede Lücke zählt höchstens 1×), bis alles gedeckt ist oder max Lebensmittel. */
function comboFor(rows,kcalLeft,max=4){
  const gap={};for(const x of rows)gap[x.k]=(x.t-x.v)*(x.w||1);
  const cands=FOOD_LIST.filter(f=>!/[sxal]/.test(f.fl)&&!COMBO_SKIP.has(f.id));
  const picked=[];const g={...gap};let kc=0;
  for(let r=0;r<max&&Object.keys(g).length;r++){
    let best=null,bv=0;
    for(const f of cands){if(picked.some(p=>p.f.id===f.id))continue;
      const portion=portionOf(f),fk=f.n[0]*portion/100;let v=0;const hits=[];
      for(const k in g){const amt=(f.n[NI[k]]||0)*portion/100;if(amt<=0)continue;const c=Math.min(1,amt/g[k]);v+=c;if(c>=0.25||amt>=0.15*gap[k])hits.push([k,c])}
      const room=kcalLeft-kc;if(fk>Math.max(room,250))v-=(fk-Math.max(room,250))/500;
      if(v>bv){bv=v;best={f,portion,kc:fk,hits}}}
    if(!best||bv<0.35)break;best.hits=best.hits.sort((a,b)=>b[1]-a[1]).map(x=>x[0]);picked.push(best);kc+=best.kc;
    for(const k in g){g[k]-=(best.f.n[NI[k]]||0)*best.portion/100;if(g[k]<=gap[k]*0.1)delete g[k]}}
  const add={};for(const k in gap)add[k]=picked.reduce((a,p)=>a+(p.f.n[NI[k]]||0)*p.portion/100,0);
  return{picked,add,kc}}
function gapSec(){
  const T=effT(CUR),tg=targetsFor(CUR);
  const all=NUTR.filter(n=>"vnox".includes(n[5])&&n[3]>0&&n[0]!=="na"&&n[0]!=="cr");
  const rows=[["p","Protein",T.p,tg.p,"g",0],["fib","Ballaststoffe",T.fib,NMETA.fib.t,"g",0],...all.map(n=>[n[0],n[1],T[n[0]],n[3],n[2],n[6]])]
    .map(([k,l,v,t,u,d])=>({k,l,v,t,u,d,w:T._win[k]||1,r:t?v/t:1})).filter(x=>x.r<1).sort((a,b)=>a.r-b.r);
  if(!rows.length)return sec("Nährstoffe heute",null,h("p",{class:"small ok-t"},"Alles gedeckt."));
  const C=comboFor(rows,tg.kcal-T.kcal);
  const after=x=>(x.v+(C.add[x.k]||0)/x.w)/x.t;
  const full=rows.filter(x=>after(x)>=0.9),rest=rows.filter(x=>after(x)<0.9);
  const nm=k=>{const r=rows.find(x=>x.k===k);return r?r.l.replace(/ \(.*\)/,"").replace(/ Thiamin| Riboflavin| Niacin| Pantothens\./,""):k};
  const s=sec("Heute noch zu wenig",h("span",{class:"muted tiny"},rows.length+" von "+(all.length+2)+" Nährstoffen"));
  s.append(h("div",{class:"gap-tags"},rows.map(x=>h("span",{class:"gtag"},x.l.replace(/ \(.*\)/,"")+" "+fmt(Math.min(x.r*100,99))+" %"+(x.w>1?" Ø":"")))));
  if(C.picked.length){
    s.append(h("div",{class:"tiny muted up",style:"margin-top:12px"},"Diese "+C.picked.length+" Lebensmittel zusammen"));
    for(const p of C.picked)s.append(h("div",{class:"sug-r"},
      h("div",{},h("div",{},fmt(p.portion)+" g "+p.f.name),h("div",{class:"muted tiny"},(p.hits.length?p.hits.slice(0,5).map(nm).join(", ")+(p.hits.length>5?" + "+(p.hits.length-5)+" weitere":""):"rundet ab")+" · "+fmt(p.kc)+" kcal")),
      h("button",{class:"add","aria-label":p.f.name+" eintragen",onclick:()=>{commit(CUR,{items:[{fid:p.f.id,g:p.portion}],workouts:[],check:{},supps:{},meal:guessMeal()});toast(p.f.name+" eingetragen");render()}},"+")));
    s.append(h("div",{class:"combo-sum"},h("span",{class:"small"},h("b",{},full.length+" von "+rows.length)," Lücken danach (fast) gedeckt · "+fmt(C.kc)+" kcal"),
      h("button",{class:"btn small-btn",onclick:()=>{commit(CUR,{items:C.picked.map(p=>({fid:p.f.id,g:p.portion})),workouts:[],check:{},supps:{},meal:guessMeal()});toast("Kombination eingetragen");render()}},"Alle eintragen")));
    if(rest.length)s.append(h("p",{class:"muted tiny"},"Bleibt knapp: "+rest.map(x=>x.l.replace(/ \(.*\)/,"")+" ("+fmt(Math.min(after(x)*100,99))+" %)").join(", ")+(rest.some(x=>x.k==="vD")?". Vitamin D kommt vor allem aus Sonne und deinem D3.":"")+(rest.some(x=>x.k==="io")?" Jod: Jodsalz nutzen.":"")))}
  s.append(h("p",{class:"muted tiny"},"Gesucht wird automatisch die kleinste Kombination aus normalen Portionen, die möglichst viele Lücken auf einmal schließt."));
  return s}

/* ---------- Training ---------- */
function renderTraining(){
  const root=$("#v-training");root.replaceChildren();
  root.append(quickInput("training"));
  if(PREVIEW&&PREVIEW.where==="training")root.append(previewBox());
  const ws=hasDay(CUR)?day(CUR).workouts:[];
  root.append(sec(CUR===todayISO()?"Heute trainiert":"Trainiert am "+short(CUR),ws.length?h("span",{class:"num muted small"},fmt(kmOf(CUR),1)+" km"):null,
    ws.length?h("div",{class:"done-list"},ws.map(w=>{const ed=EDIT===w.id;return h("div",{class:ed?"done-ed":""},h("div",{class:"done-i"},h("span",{},workoutLine(w)),
        h("span",{class:"done-a"},h("button",{class:"link",onclick:()=>{if(ed){cleanW(w);save();EDIT=null;toast("Gespeichert")}else EDIT=w.id;render()}},ed?"Fertig":"Bearbeiten"),
          h("button",{class:"x","aria-label":"Löschen",onclick:()=>{day(CUR).workouts=day(CUR).workouts.filter(x=>x!==w);save();render()}},"×"))),
        ed?wEditor(w,re=>{save();if(re)render()}):w.ex&&w.ex.length?exTable(w.ex):null)}))
      :h("p",{class:"muted small"},"Noch nichts eingetragen. Sprich oben rein, was du gemacht hast, egal ob es zum Vorschlag passt."),
    addUnitRow(w=>{w.id=uid();day(CUR).workouts.push(w);EDIT=w.id;save();render()})));
  const sg=suggest(CUR,3);
  root.append(trainingCard(sg[0],true));
  root.append(checkSec());
  root.append(sec("Vorschläge nächste Tage",null,sg.slice(1).map(s=>h("div",{class:"day-s"},h("div",{class:"muted small"},long(s.ds)),h("div",{class:"tb-t"},s.run.title),h("div",{class:"muted tiny"},s.run.detail),s.gym?h("div",{class:"small",style:"margin-top:2px"},s.gym.name):null))));
  const p=planFor(CUR);const mon=addDays(CUR,-(p.wk?p.dow:dowOf(CUR)));
  const wk=h("div",{class:"week"});let tot=0;
  for(let i=0;i<7;i++){const ds=addDays(mon,i),wl=hasDay(ds)?day(ds).workouts:[];tot+=kmOf(ds);
    wk.append(h("div",{class:"wk-r"+(ds===CUR?" cur":"")},h("span",{class:"muted"},WD[i]),h("span",{},wl.length?wl.map(w=>h("div",{},workoutLine(w))):h("span",{class:"muted"},"–"))))}
  root.append(sec("Diese Woche",h("span",{class:"num muted small"},fmt(tot,1)+(p.wk?" km · Plan "+p.sum:" km")),wk));
  root.append(logForm());
  const z=zones();
  root.append(sec("Deine Zonen",h("span",{class:"muted tiny"},z.src),h("div",{class:"zones"},[["R Regeneration","RPE 2–3",zoneTxt(z.R)],["GA Grundlage","RPE 3–4",zoneTxt(z.GA)],["M Steady","RPE 5",zoneTxt(z.M)],["S Schwelle","RPE 6–7",zoneTxt(z.S)],["Berg","RPE 7–8","nur RPE"]].map(r=>h("div",{class:"zr"},h("span",{},r[0]),h("span",{class:"muted"},r[1]),h("span",{class:"num"},r[2])))),
    h("p",{class:"muted tiny"},"RPE geht vor Pace. Nach einem 5-km-Test („5 km Test in 24:30“) rechne ich die Zonen neu.")));
  const open=OPEN.has("plan");
  root.append(sec("Dein Plan (Leitlinie)",h("button",{class:"link",onclick:()=>{open?OPEN.delete("plan"):OPEN.add("plan");render()}},open?"Zuklappen":"Anzeigen"),open?planTable():h("p",{class:"muted tiny"},"41 Wochen bis zum 100er. Die Vorschläge richten sich danach, passen sich aber an das an, was du wirklich trainierst.")));
  root.append(gapSec());
}
function logForm(){
  const F=LOGFORM||(LOGFORM={type:"run"});
  const types=[["run","Laufen"],["gym","Kraft"],["swim","Schwimmen"],["bike","Rad"],["walk","Gehen"],["other","Sonstiges"]];
  const box=h("section",{class:"sec",id:"logf"},h("div",{class:"sec-h"},h("h2",{},"Von Hand eintragen"),h("span",{class:"muted small"},short(CUR))));
  box.append(h("div",{class:"chips"},types.map(([t,l])=>h("button",{class:"chip","aria-pressed":F.type===t?"true":"false",onclick:()=>{LOGFORM={type:t};if(t==="gym"){const s=suggest(CUR,1)[0];const g=s.gym||{id:"push",ex:GYM.push.ex.map(e=>prescribe(e,e[1]))};LOGFORM.session=g.id;LOGFORM.ex=g.ex.map(e=>({name:e.name,sets:e.sets,reps:typeof e.reps==="number"?e.reps:"",kg:e.kg||""}))}render()}},l))));
  const num=(k,l,ph,step="any")=>{const i=h("input",{type:"number",inputmode:"decimal",step,placeholder:ph,value:F[k]??""});i.oninput=()=>F[k]=i.value===""?null:+i.value.replace(",",".");return h("label",{},l,i)};
  if(F.type==="gym"){
    const sel=h("select",{"aria-label":"Einheit"},Object.entries(GYM).map(([k,g])=>h("option",{value:k,selected:F.session===k?true:null},g.name)));
    sel.onchange=()=>{F.session=sel.value;F.ex=GYM[sel.value].ex.map(e=>{const p=prescribe(e,e[1]);return{name:e[0],sets:p.sets,reps:typeof p.reps==="number"?p.reps:"",kg:p.kg||""}});render()};
    box.append(sel);F.ex??=GYM[F.session||"push"].ex.map(e=>({name:e[0],sets:e[1],reps:"",kg:""}));
    box.append(h("div",{class:"exf-h tiny muted"},h("span",{},"Übung"),h("span",{},"Sätze"),h("span",{},"Wdh."),h("span",{},"kg")));
    F.ex.forEach(e=>{const c=(k,st)=>{const i=h("input",{type:"number",inputmode:"decimal",step:st,value:e[k]??""});i.oninput=()=>e[k]=i.value===""?"":+i.value.replace(",",".");return i};
      box.append(h("div",{class:"exf"},h("span",{class:"small"},e.name),c("sets","1"),c("reps","1"),c("kg","0.25")))});
    box.append(h("p",{class:"muted tiny"},"Wdh. = was du im letzten Satz geschafft hast. Leere Zeilen werden ignoriert."));
  }else{
    const g=h("div",{class:"grid3"});
    if(F.type==="swim")g.append(num("m","Meter","1500","50"));else if(F.type!=="other")g.append(num("km","km","8","0.1"));
    g.append(num("min","Minuten","50","1"),num("rpe","RPE 1–10","4","0.5"));box.append(g);
    if(F.type==="run"){const t=h("label",{class:"inline"},h("input",{type:"checkbox",checked:F.test?true:null,onchange:e=>F.test=e.target.checked}),"Das war ein 5-km-Test");box.append(t)}
    if(F.type==="other"){const i=h("input",{type:"text",placeholder:"z. B. Fußball, Yoga",value:F.name||""});i.oninput=()=>F.name=i.value;box.append(h("label",{},"Was",i))}
  }
  box.append(h("button",{class:"btn primary wide",onclick:()=>{
    const w={type:F.type};
    if(F.type==="gym"){w.session=F.session||"push";w.ex=(F.ex||[]).filter(e=>e.reps||e.kg).map(e=>({name:e.name,sets:+e.sets||undefined,reps:+e.reps||undefined,kg:+e.kg||undefined}));w.min=60}
    else{if(F.type==="swim"&&F.m)w.km=F.m/1000;else if(F.km)w.km=F.km;if(F.min)w.min=F.min;if(F.rpe)w.rpe=F.rpe;if(F.test)w.test=true;if(F.name)w.name=F.name;
      if(w.type==="run"&&!w.km){toast("Bitte km eintragen");return}if(!w.min&&!w.km){toast("Bitte Dauer eintragen");return}}
    commit(CUR,{items:[],workouts:[w],check:{},supps:{}});LOGFORM=null;toast("Training gespeichert");render()}},"Speichern"));
  return box;
}
function planTable(){
  const p=planFor(CUR);
  const tb=h("table",{},h("tr",{},["Wo","ab","Di: Schlüssel","Di/Mi/Do","Sa","So","Σ"].map(x=>h("th",{},x))));
  PLAN.forEach((r,i)=>{const mon=new Date(START.getFullYear(),START.getMonth(),START.getDate()+i*7);tb.append(h("tr",{class:p.wk===i+1?"cur":""},h("td",{},i+1),h("td",{},mon.getDate()+"."+(mon.getMonth()+1)+"."),h("td",{},r[0],r[7]?h("div",{class:"muted tiny"},r[7]):null),h("td",{},r[1]+"/"+(r[2]||"–")+"/"+r[3]),h("td",{},i===40?"100":r[4]),h("td",{},r[5]||"geh."),h("td",{},r[6])))});
  return h("div",{class:"tbl"},tb);
}

/* ---------- Verlauf ---------- */
function chart(data,{unit,dec=0,col="var(--ink)",tcol="var(--accent)"}){
  const W=360,H=150,L=34,R=4,T=8,B=20,iw=W-L-R,ih=H-T-B;
  const mxv=Math.max(1,...data.map(d=>Math.max(d.v||0,d.t||0)))*1.08;const p10=Math.pow(10,Math.floor(Math.log10(mxv)));const mx=Math.ceil(mxv/p10*2)/2*p10;
  const NS="http://www.w3.org/2000/svg";const s=document.createElementNS(NS,"svg");s.setAttribute("viewBox",`0 0 ${W} ${H}`);
  const add=(t,a,txt)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;s.append(e);return e};
  for(let i=0;i<=3;i++){const y=T+ih-ih*i/3;add("line",{x1:L,x2:W-R,y1:y,y2:y,stroke:"var(--line)","stroke-width":1});add("text",{x:L-4,y:y+3,"text-anchor":"end",class:"ax"},fmt(mx*i/3))}
  const bw=iw/data.length;const capEl=h("div",{class:"muted tiny cap"},"Tipp auf einen Balken");
  data.forEach((d,i)=>{const x=L+i*bw,bh=ih*(d.v||0)/mx,w=Math.max(3,bw-4),y=T+ih-bh,r=Math.min(3,w/2,bh);
    if(d.v>0)add("path",{d:`M${x+2},${T+ih}V${y+r}Q${x+2},${y} ${x+2+r},${y}H${x+2+w-r}Q${x+2+w},${y} ${x+2+w},${y+r}V${T+ih}Z`,fill:col});
    if(d.t)add("line",{x1:x+1,x2:x+bw-1,y1:T+ih-ih*d.t/mx,y2:T+ih-ih*d.t/mx,stroke:tcol,"stroke-width":2,"stroke-linecap":"round"});
    if(data.length<=9||i%2===0)add("text",{x:x+bw/2,y:H-5,"text-anchor":"middle",class:"ax"},d.label);
    const hit=add("rect",{x,y:T,width:bw,height:ih,fill:"transparent"});hit.addEventListener("click",()=>capEl.textContent=d.full+": "+fmt(d.v,dec)+" "+unit+(d.t?" · Ziel "+fmt(d.t,dec)+" "+unit:""))});
  return h("div",{class:"chart"},s,capEl);
}
function legend(a,b){return h("div",{class:"legend tiny muted"},h("span",{},h("i",{style:"background:var(--ink)"}),a),h("span",{},h("i",{class:"ln",style:"background:var(--accent)"}),b))}
function longestRun(a,b){let m=0;for(let d=a;d<=b;d=addDays(d,1))for(const w of runsOf(d))m=Math.max(m,w.km||0);return m}
function easyPaces(a,b){const p=[];for(let d=a;d<=b;d=addDays(d,1))for(const w of runsOf(d))if(w.km>=3&&w.min&&(w.rpe||4)<=4.5)p.push(w.min*60/w.km);p.sort((x,y)=>x-y);return p.length?p[Math.floor(p.length/2)]:null}
function delta(a,b,unit,dec=0,invert=false){if(a==null||b==null||!isFinite(a)||!isFinite(b))return h("span",{class:"muted"},"");const d=a-b;if(Math.abs(d)<Math.pow(10,-dec)/2)return h("span",{class:"muted"},"gleich");const good=invert?d<0:d>0;return h("span",{class:good?"ok-t":"warn-t"},(d>0?"+":"−")+fmt(Math.abs(d),dec)+(unit?" "+unit:""))}
function progRow(label,value,change,note){return h("div",{class:"pr"},h("div",{},h("div",{},label),note?h("div",{class:"muted tiny"},note):null),h("div",{class:"num pr-v"},h("div",{},value),change?h("div",{class:"tiny"},change):null))}
/* ================= Ultra-Bereitschaft & Verletzungsrisiko (Schätzung, lokal berechnet) ================= */
/* Muskelgruppen je Übung: beine, waden (Waden/Fuß/Schienbein), huefte (Hüft- und Beckenstabilität), core (Rumpf). */
const MG_RULES=[
  [/kniebeuge|squat|kreuzheben|deadlift|rdl|beinpresse|beinstrecker|beinbeuger|ausfallschritt|lunge|hip thrust|step-up|hackenschmidt|nordic|good morning|glute ham|wall sit|thruster|clean|snatch|schlitten|box jump|kettlebell|pull through|reverse hyper|wall ball|sandsack|burpee/,"beine"],
  [/waden|tibialis|calf|seilspringen|einbeinstand|box jump/,"waden"],
  [/glute bridge|abduk|abduction|adduk|copenhagen|glute kickback|single-leg|einbein|bulgarian|split squat|step-up|cossack|pistol|ausfallschritt|hip thrust|einbeinstand/,"huefte"],
  [/plank|crunch|sit-up|beinheben|russian twist|bauchroller|dead bug|pallof|farmers|suitcase|hollow|l-sit|dragon flag|toes to bar|woodchopper|scheibenwischer|mountain|bird dog|back extension|rückenstrecker|turkish|kreuzheben|deadlift|good morning|reverse hyper|landmine/,"core"]];
const MG_NAMES={beine:"Beine",waden:"Waden & Füße",huefte:"Hüfte & Becken",core:"Rumpf & Core"};
const MG_WEEK={beine:8,waden:4,huefte:4,core:6};// harte Sätze pro Woche, die Läufer schützen
const MG_TIP={beine:"Kniebeuge oder Rumänisches Kreuzheben",waden:"Wadenheben einbeinig, Tibialis Raises",huefte:"Bulgarian Split Squat, Copenhagen Plank, Glute Bridge",core:"Dead Bug, Side Plank, Back Extension"};
function exGroups(name){const n=String(name||"").toLowerCase();return MG_RULES.filter(([re])=>re.test(n)).map(r=>r[1])}
function gymSets(from,to){const s={beine:0,waden:0,huefte:0,core:0};
  for(let d=from;d<=to;d=addDays(d,1))for(const w of gymOf(d)){
    const ex=(w.ex&&w.ex.length)?w.ex:(GYM[w.session]?GYM[w.session].ex.map(e=>({name:e[0],sets:e[1]})):[]);
    for(const e of ex){const n=e.sets||(e.repList?e.repList.length:3);for(const g of exGroups(e.name))s[g]+=n}}
  return s}
function strengthProtection(ds){const sets=gymSets(addDays(ds,-13),ds);const per={};let sum=0,wt=0;
  const W={beine:1,waden:1.2,huefte:1.2,core:1};
  for(const g in MG_WEEK){per[g]={sets:sets[g]/2,r:clamp(sets[g]/2/MG_WEEK[g],0,1)};sum+=W[g]*per[g].r;wt+=W[g]}
  return{per,score:sum/wt}}
function runStats(from,to){let km=0,runs=0,q=0,lr=0,b2b=0;
  for(let d=from;d<=to;d=addDays(d,1)){const rs=runsOf(d);km+=kmOf(d);runs+=rs.length;q+=rs.filter(w=>(w.rpe||0)>=6||w.test).length;lr=Math.max(lr,...rs.map(w=>w.km||0),0);
    if(dowOf(d)===6)b2b=Math.max(b2b,kmOf(d)+kmOf(addDays(d,-1)))}
  return{km,runs,q,lr,b2b}}
const READY_T={km:70,lr:50,b2b:58,runs:5,q:1};// Rennbereit: Ø 70 km/Woche, 50 km am Stück, 58 km Sa+So, 5 Läufe und 1 harte Einheit pro Woche
function readyParts(v){return[
  {id:"km",l:"Wochenkilometer",w:30,r:clamp(v.km/READY_T.km,0,1),txt:fmt(v.km,0)+" von "+READY_T.km+" km Ø pro Woche"},
  {id:"lr",l:"Längster Lauf",w:30,r:clamp(v.lr/READY_T.lr,0,1),txt:fmt(v.lr,1)+" von "+READY_T.lr+" km (6 Wochen)"},
  {id:"b2b",l:"Wochenende Sa + So",w:10,r:clamp(v.b2b/READY_T.b2b,0,1),txt:fmt(v.b2b,1)+" von "+READY_T.b2b+" km an einem Wochenende (6 Wochen)"},
  {id:"runs",l:"Regelmäßigkeit",w:10,r:clamp(v.runs/READY_T.runs,0,1),txt:fmt(v.runs,1)+" von "+READY_T.runs+" Läufen pro Woche"},
  {id:"q",l:"Tempo, Intervalle, Berg",w:10,r:clamp(v.q/READY_T.q,0,1),txt:fmt(v.q,1)+" harte Einheit(en) pro Woche"},
  {id:"kraft",l:"Kraft Beine/Rumpf",w:10,r:clamp(v.kraft,0,1),txt:fmt(v.kraft*100)+" % vom Soll an Beine, Waden, Hüfte, Core"}]}
function ultraReadiness(ds){const a=runStats(addDays(ds,-27),ds),b=runStats(addDays(ds,-41),ds);
  const v={km:a.km/4,lr:b.lr,b2b:b.b2b,runs:a.runs/4,q:a.q/4,kraft:strengthProtection(ds).score};
  const parts=readyParts(v);return{parts,score:Math.round(parts.reduce((s,p)=>s+p.w*p.r,0))}}
function planReadiness(ds){const p=planFor(ds);if(p.pre)return 0;const wk=p.post?40:Math.min(40,p.wk);
  const rows=[];for(let w=Math.max(1,wk-3);w<=wk;w++)rows.push(PLAN[w-1]);const rows6=[];for(let w=Math.max(1,wk-5);w<=wk;w++)rows6.push(PLAN[w-1]);
  const avg=f=>rows.reduce((s,r)=>s+f(r),0)/rows.length;
  const v={km:avg(r=>r[6]),lr:Math.max(...rows6.map(r=>r[4])),b2b:Math.max(...rows6.map(r=>r[4]+r[5])),runs:avg(r=>[r[1],r[2],r[3],r[4],r[5]].filter(x=>x>0).length),
    q:avg(r=>/^GA/.test(r[0])?0:1)+avg(r=>/ · Do: /.test(r[0])?1:0),kraft:1};
  return Math.round(readyParts(v).reduce((s,x)=>s+x.w*x.r,0))}
function ring(pct,mark){const NS="http://www.w3.org/2000/svg",s=document.createElementNS(NS,"svg"),R=52,C=2*Math.PI*R;s.setAttribute("viewBox","0 0 128 128");s.setAttribute("class","ring");
  const add=(t,a,txt)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;s.append(e);return e};
  add("circle",{cx:64,cy:64,r:R,fill:"none",stroke:"var(--line)","stroke-width":12});
  add("circle",{cx:64,cy:64,r:R,fill:"none",stroke:"var(--accent)","stroke-width":12,"stroke-linecap":"round","stroke-dasharray":(C*clamp(pct,0,100)/100).toFixed(1)+" "+C.toFixed(1),transform:"rotate(-90 64 64)"});
  if(mark!=null){const a=(mark/100)*2*Math.PI-Math.PI/2;add("line",{x1:64+(R-9)*Math.cos(a),y1:64+(R-9)*Math.sin(a),x2:64+(R+9)*Math.cos(a),y2:64+(R+9)*Math.sin(a),stroke:"var(--ink)","stroke-width":2.5,"stroke-linecap":"round"})}
  add("text",{x:64,y:66,"text-anchor":"middle",class:"ring-v"},pct+" %");add("text",{x:64,y:84,"text-anchor":"middle",class:"ring-l"},"bereit");return s}
function readySec(ds){const R=ultraReadiness(ds),soll=planReadiness(ds),diff=R.score-soll;
  const status=diff>=-5?["ok-t",diff>8?"Vor dem Plan":"Auf Kurs"]:diff>=-15?["warn-t","Etwas hinter dem Plan"]:["warn-t","Deutlich hinter dem Plan"];
  const weakest=R.parts.slice().sort((a,b)=>(a.r-1)*a.w-(b.r-1)*b.w)[0];
  const s=sec("Ultra-Bereitschaft",h("span",{class:"muted tiny"},"Schätzung"));
  s.append(h("div",{class:"ring-wrap"},ring(R.score,soll),h("div",{},
    h("div",{class:status[0],style:"font-weight:600"},status[1]),
    h("div",{class:"small muted"},"Laut Plan wärst du jetzt bei etwa "+soll+" % (Strich am Ring)."),
    h("div",{class:"small muted",style:"margin-top:6px"},"100 % heißt: Umfang wie in den Peak-Wochen vor dem Rennen. Am meisten bringt dir gerade: "+weakest.l+"."))));
  const open=OPEN.has("readyD");
  s.append(h("button",{class:"link",onclick:()=>{open?OPEN.delete("readyD"):OPEN.add("readyD");render()}},open?"Details ausblenden":"Woraus sich das zusammensetzt"));
  if(open)for(const p of R.parts)s.append(h("div",{class:"rd"},h("div",{class:"rd-h"},h("span",{},p.l),h("span",{class:"num muted tiny"},fmt(p.r*p.w,0)+"/"+p.w)),bar(p.r,1),h("div",{class:"muted tiny"},p.txt)));
  return s}
function injuryRisk(ds){const why=[];let pts=0;
  const acute=kmRange(addDays(ds,-6),ds),chronic=kmRange(addDays(ds,-27),ds)/4;let acwr=null;
  if(chronic>=8){acwr=acute/chronic;const l=acwr<=1.2?0:acwr<=1.5?(acwr-1.2)/0.3*0.6:clamp(0.6+(acwr-1.5)/0.5*0.4,0,1);pts+=35*l;
    if(acwr>1.3)why.push("Diese Woche "+fmt(acute,0)+" km, das ist "+fmt(acwr,1)+"× dein Schnitt der letzten 4 Wochen ("+fmt(chronic,0)+" km). Mehr als etwa 1,3× erhöht das Risiko.")}
  else if(acute>25){pts+=15;why.push("Viele Kilometer ohne längere Vorgeschichte in der App: langsam steigern.")}
  const lr7=longestRun(addDays(ds,-6),ds),lrPrev=longestRun(addDays(ds,-34),addDays(ds,-7));
  if(lrPrev>0&&lr7>lrPrev*1.3&&lr7-lrPrev>=5){pts+=10;why.push("Längster Lauf ("+fmt(lr7,1)+" km) ist viel länger als zuletzt ("+fmt(lrPrev,1)+" km).")}
  const SP=strengthProtection(ds);pts+=35*(1-SP.score);
  const weak=Object.entries(SP.per).filter(([g,x])=>x.r<0.6).map(([g])=>g);
  if(weak.length)why.push("Zu wenig Kraft für "+weak.map(g=>MG_NAMES[g]).join(", ")+" (letzte 14 Tage).");
  let active=0,hard=0;for(let i=0;i<7;i++){const d=addDays(ds,-i);if(hasDay(d)&&day(d).workouts.some(w=>w.type!=="walk"))active++;if(isHardDay(d))hard++}
  if(active>=7){pts+=7;why.push("Kein Ruhetag in den letzten 7 Tagen.")}if(hard>=4){pts+=5;why.push(hard+" harte Tage in einer Woche.")}
  let knee=0,limp=false;for(let i=0;i<3;i++){const d=addDays(ds,-i);if(!hasDay(d))continue;const c=day(d).check;knee=Math.max(knee,c.knee||0);if((c.flags||[]).includes("hinken"))limp=true}
  if(limp||knee>=5){pts=Math.max(pts,75);why.unshift(limp?"Du hast Hinken eingetragen: erst auskurieren.":"Knie-Schmerz "+knee+"/10 in den letzten Tagen.")}
  else if(knee>=3){pts+=8;why.push("Knie meldet sich ("+knee+"/10).")}
  const score=Math.round(clamp(pts,0,100));
  return{score,level:score<35?["good","niedrig"]:score<60?["warn","mittel"]:["bad","erhöht"],why,SP,acwr,acute,chronic}}
function riskSec(ds){const I=injuryRisk(ds);
  const s=sec("Verletzungsrisiko",h("span",{class:"pill "+I.level[0]},I.level[1]));
  s.append(h("div",{class:"risk"},h("i",{style:"left:"+I.score+"%"})),h("div",{class:"risk-l tiny muted"},h("span",{},"niedrig"),h("span",{},"mittel"),h("span",{},"erhöht")));
  s.append(h("div",{class:"tiny muted up",style:"margin-top:12px"},"Krafttraining für Läufer (Sätze pro Woche, Ø 14 Tage)"));
  for(const[g,x]of Object.entries(I.SP.per))s.append(h("div",{class:"mrow mg"},h("span",{},MG_NAMES[g]),bar(x.sets,MG_WEEK[g],"",false),h("span",{class:"num muted"},fmt(x.sets,0)+" / "+MG_WEEK[g])));
  if(I.acwr!=null)s.append(h("div",{class:"small muted",style:"margin-top:6px"},"Laufbelastung: "+fmt(I.acute,0)+" km in 7 Tagen, Ø "+fmt(I.chronic,0)+" km/Woche davor ("+fmt(I.acwr,2)+"×, ideal 0,8–1,3×)."));
  if(I.why.length)s.append(h("ul",{class:"list"},I.why.map(w=>h("li",{class:"small"},w))));
  else s.append(h("p",{class:"small ok-t"},"Belastung und Krafttraining passen gerade gut zusammen."));
  const weak=Object.entries(I.SP.per).filter(([g,x])=>x.r<1).sort((a,b)=>a[1].r-b[1].r).slice(0,2);
  if(weak.length)s.append(h("p",{class:"small"},"Diese Woche noch: "+weak.map(([g,x])=>Math.ceil(MG_WEEK[g]-x.sets)+" Sätze "+MG_NAMES[g]+" ("+MG_TIP[g]+")").join("; ")+"."));
  s.append(h("p",{class:"muted tiny"},"Schätzung aus deinen Einträgen, keine Diagnose. Die App ordnet jede Übung automatisch Beinen, Waden, Hüfte oder Core zu. Bei Schmerzen zählt dein Körper, nicht die Zahl."));
  return s}
function renderFortschritt(){
  const root=$("#v-fortschritt");root.replaceChildren();
  const today=CUR,p=planFor(today);
  root.append(readySec(today),riskSec(today));
  // Langfristig: Ziel 100 km
  const MS=[["2027-04-03",32,"32 km Meilenstein"],["2027-07-10",42,"Marathon im Training"],["2027-07-31",50,"Generalprobe 50 km"],[RACE,100,"100 km Solo"]];
  const next=MS.find(m=>m[0]>=today)||MS[3];
  const lr28=longestRun(addDays(today,-27),today),lrAll=Math.max(0,...Object.keys(S.days).filter(k=>k<=today).map(k=>longestRun(k,k)));
  let planKm4=0,act4=0,planDays=0,runDays=0;
  for(let i=1;i<=28;i++){const ds=addDays(today,-i),pp=planFor(ds);if(pp.wk&&pp.run.km>0){planDays++;planKm4+=pp.run.km;if(runsOf(ds).length)runDays++}act4+=kmOf(ds)}
  const toRace=Math.max(0,Math.round((parseD(RACE)-parseD(today))/864e5));
  const goal=sec("Ziel: 100 km am 4.9.2027",h("span",{class:"muted small"},"noch "+toRace+" Tage"));
  goal.append(h("div",{class:"tiny muted up"},"Planfortschritt"),bar(p.wk||0,41),h("div",{class:"tiny muted",style:"margin-top:4px"},p.wk?"Woche "+p.wk+" von 41 · Phase "+p.phase:""));
  goal.append(progRow("Längster Lauf (4 Wochen)",fmt(lr28,1)+" km",null,"Nächster Meilenstein: "+next[2]+" bis "+short(next[0])+" · Rekord bisher "+fmt(lrAll,1)+" km"),bar(lr28,next[1]));
  if(planDays>=3){goal.append(progRow("Kilometer (4 Wochen)",fmt(act4)+" km",h("span",{class:"muted"},"Plan "+fmt(planKm4)+" km"),act4>planKm4*1.2?"Deutlich über Plan: Verletzungsrisiko im Blick behalten.":act4<planKm4*0.7?"Unter Plan. Kein Problem, aber nicht auf einmal nachholen.":"Im Rahmen des Plans."));
    goal.append(progRow("Regelmäßigkeit",fmt(100*runDays/planDays)+" %",null,runDays+" von "+planDays+" Lauftagen im Plan gelaufen"))}
  else goal.append(progRow("Kilometer (4 Wochen)",fmt(act4)+" km",null,"Der Vergleich mit dem Plan startet nach der ersten Planwoche."));
  root.append(goal);
  // Kurzfristig
  const a14=addDays(today,-13),b14=addDays(today,-27),b14e=addDays(today,-14);
  const short_=sec("Kurzfristig",h("span",{class:"muted tiny"},"letzte 14 Tage gegen die 14 davor"));
  const lrA=longestRun(a14,today),lrB=longestRun(b14,b14e);
  short_.append(progRow("Länger",fmt(lrA,1)+" km",delta(lrA,lrB,"km",1),"längster Lauf"));
  const epA=easyPaces(a14,today),epB=easyPaces(b14,b14e);
  short_.append(progRow("Schneller",epA?pace(epA)+" /km":"–",epA&&epB?h("span",{class:epA<epB?"ok-t":"warn-t"},(epA<=epB?"−":"+")+fmt(Math.abs(epA-epB))+" s/km"):null,"Ø Pace bei lockeren Läufen (RPE ≤ 4)"+(S.settings.p5?" · 5 km: "+pace(S.settings.p5)+" /km":"")));
  const kmA=kmRange(a14,today),kmB=kmRange(b14,b14e);
  short_.append(progRow("Mehr",fmt(kmA,1)+" km",delta(kmA,kmB,"km",1),"Laufumfang"));
  let gA=0,gB=0;for(let d=a14;d<=today;d=addDays(d,1))gA+=gymOf(d).length;for(let d=b14;d<=b14e;d=addDays(d,1))gB+=gymOf(d).length;
  short_.append(progRow("Krafteinheiten",String(gA),delta(gA,gB,"")));
  // Stärker: e1RM je Übung
  const ex={};for(const k of Object.keys(S.days).filter(k=>k<=today&&k>=addDays(today,-90)).sort())for(const w of S.days[k].workouts||[])if(w.type==="gym")for(const e of w.ex||[])if(e.kg&&e.reps){(ex[e.name]??=[]).push({ds:k,e1:e.kg*(1+e.reps/30),kg:e.kg,reps:e.reps})}
  const rows=Object.entries(ex).map(([n,a])=>{const last=a.at(-1),first=a.find(x=>x.ds>=addDays(today,-35))||a[0];return{n,last,first,cnt:a.length}}).sort((x,y)=>y.last.ds.localeCompare(x.last.ds)).slice(0,8);
  short_.append(h("div",{class:"tiny muted up"},"Stärker (geschätztes 1RM)"));
  if(!rows.length)short_.append(h("p",{class:"muted small"},"Sobald du Übungen mit Gewicht und Wiederholungen einträgst (z. B. „Bankdrücken 4x8 70 kg“), siehst du hier, wie du stärker wirst."));
  for(const r of rows){const pct=r.first&&r.first!==r.last?(r.last.e1/r.first.e1-1)*100:null;
    short_.append(progRow(r.n,fmt(r.last.e1,1)+" kg",pct!=null?h("span",{class:pct>=0?"ok-t":"warn-t"},(pct>=0?"+":"−")+fmt(Math.abs(pct),1)+" %"):h("span",{class:"muted"},"erster Wert"),"zuletzt "+r.last.reps+" × "+kgf(r.last.kg)+" kg am "+short(r.last.ds)))}
  root.append(short_);
  root.append(scoreSec());
  // Diagramme
  const wks=[];if(p.wk)for(let w=Math.max(1,p.wk-9);w<=p.wk;w++){const mon=iso(new Date(START.getFullYear(),START.getMonth(),START.getDate()+(w-1)*7));wks.push({w,mon})}
  if(wks.length){root.append(sec("Langer Lauf pro Woche",h("span",{class:"muted tiny"},"Ist und Plan"),h("div",{class:"legend tiny muted"},h("span",{},h("i",{style:"background:var(--accent)"}),"längster Lauf"),h("span",{},h("i",{class:"ln",style:"background:var(--ink)"}),"Plan Sa")),chart(wks.map(x=>({label:"W"+x.w,full:"Woche "+x.w,v:longestRun(x.mon,addDays(x.mon,6)),t:x.w===41?100:PLAN[x.w-1][4]})),{unit:"km",dec:1,col:"var(--accent)",tcol:"var(--ink)"})))}
  
  const days=[];for(let i=13;i>=0;i--)days.push(addDays(CUR,-i));
  const ev=days.map(ds=>({ds,T:totals(ds),tg:targetsFor(ds)}));
  root.append(sec("Kalorien",h("span",{class:"muted tiny"},"14 Tage"),legend("gegessen","Ziel"),chart(ev.map(e=>({label:parseD(e.ds).getDate()+".",full:short(e.ds),v:e.T.kcal,t:e.tg.kcal})),{unit:"kcal"})));
  root.append(sec("Protein",h("span",{class:"muted tiny"},"14 Tage"),legend("gegessen","Ziel"),chart(ev.map(e=>({label:parseD(e.ds).getDate()+".",full:short(e.ds),v:e.T.p,t:e.tg.p})),{unit:"g"})));
  if(p.wk){const wks2=[];for(let w=Math.max(1,p.wk-7);w<=p.wk;w++){const mon=iso(new Date(START.getFullYear(),START.getMonth(),START.getDate()+(w-1)*7));wks2.push({label:"W"+w,full:"Woche "+w,v:kmRange(mon,addDays(mon,6)),t:PLAN[w-1][6]})}
    root.append(sec("Lauf-km pro Woche",h("span",{class:"muted tiny"},"Ist und Plan"),h("div",{class:"legend tiny muted"},h("span",{},h("i",{style:"background:var(--accent)"}),"gelaufen"),h("span",{},h("i",{class:"ln",style:"background:var(--ink)"}),"Plan")),chart(wks2,{unit:"km",dec:1,col:"var(--accent)",tcol:"var(--ink)"})))}
  // Gewicht
  const pts=Object.keys(S.days).filter(k=>S.days[k].check&&S.days[k].check.weight&&k<=CUR).sort().slice(-60).map(k=>({ds:k,v:S.days[k].check.weight}));
  const wsec=sec("Gewicht",h("span",{class:"muted tiny"},"Ziel bis Mai: +0,25–0,5 kg/Monat"));
  if(pts.length<2)wsec.append(h("p",{class:"muted small"},"Trag morgens im Morgen-Check dein Gewicht ein. Ab zwei Werten siehst du den Verlauf."));
  else{const NS="http://www.w3.org/2000/svg",W=360,H=130,L=34,R=8,T=8,B=18,iw=W-L-R,ih=H-T-B;const s=document.createElementNS(NS,"svg");s.setAttribute("viewBox",`0 0 ${W} ${H}`);
    const t0=parseD(pts[0].ds).getTime(),t1=parseD(pts.at(-1).ds).getTime();const lo=Math.floor(Math.min(...pts.map(p=>p.v))-0.5),hi=Math.ceil(Math.max(...pts.map(p=>p.v))+0.5);
    const X=ds=>L+iw*(parseD(ds).getTime()-t0)/Math.max(1,t1-t0),Y=v=>T+ih-ih*(v-lo)/(hi-lo);
    const add=(t,a,txt)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;s.append(e)};
    for(let i=0;i<=2;i++){const v=lo+(hi-lo)*i/2;add("line",{x1:L,x2:W-R,y1:Y(v),y2:Y(v),stroke:"var(--line)"});add("text",{x:L-4,y:Y(v)+3,"text-anchor":"end",class:"ax"},fmt(v,1))}
    add("path",{d:pts.map((p,i)=>(i?"L":"M")+X(p.ds).toFixed(1)+","+Y(p.v).toFixed(1)).join(""),fill:"none",stroke:"var(--accent)","stroke-width":2});
    add("circle",{cx:X(pts.at(-1).ds),cy:Y(pts.at(-1).v),r:4,fill:"var(--accent)",stroke:"var(--bg)","stroke-width":2});
    add("text",{x:L,y:H-4,class:"ax"},short(pts[0].ds));add("text",{x:W-R,y:H-4,"text-anchor":"end",class:"ax"},short(pts.at(-1).ds));
    const avg=a=>a.reduce((x,y)=>x+y.v,0)/a.length,l7=pts.filter(p=>p.ds>addDays(CUR,-7)),p7=pts.filter(p=>p.ds<=addDays(CUR,-7)&&p.ds>addDays(CUR,-14));
    wsec.append(h("div",{class:"chart"},s),h("p",{class:"muted small"},"Wochenschnitt "+(l7.length?fmt(avg(l7),1)+" kg":"–")+(l7.length&&p7.length?" ("+(avg(l7)-avg(p7)>=0?"+":"")+fmt(avg(l7)-avg(p7),2)+" kg zur Vorwoche)":"")))}
  root.append(wsec);
  // 7-Tage-Schnitt Nährstoffe
  const last7=days.slice(-7).filter(ds=>hasDay(ds)&&day(ds).entries.length);
  if(last7.length>=2){const avgT={};NK.forEach(k=>avgT[k]=last7.reduce((a,ds)=>a+totals(ds)[k],0)/last7.length);
    const low=NUTR.filter(n=>n[3]>0&&n[0]!=="na"&&n[5]!=="m").map(n=>({n,r:avgT[n[0]]/n[3]})).sort((a,b)=>a.r-b.r).slice(0,5);
    root.append(sec("Dauerhaft knapp",h("span",{class:"muted tiny"},"Ø der letzten "+last7.length+" Tage mit Einträgen"),h("ul",{class:"list"},low.map(x=>h("li",{},x.n[1]+": "+fmt(x.r*100)+" % vom Ziel")))))}
  // Bilanz-Tabelle
  const tb=h("table",{},h("tr",{},["Tag","Ultra","Muskel","Longev.","Testo"].map(x=>h("th",{},x))));
  days.slice(-7).reverse().forEach(ds=>{const has=hasDay(ds)&&(day(ds).entries.length||day(ds).workouts.length);const sc=has?scores(ds).list:null;tb.append(h("tr",{},h("td",{},short(ds)),(sc||[0,0,0,0]).map(s=>h("td",{class:"num"},has?String(s.v):"–"))))});
  root.append(sec("Bilanz der letzten 7 Tage",null,h("div",{class:"tbl"},tb)));
}


/* ================= Longevity ================= */
const c01=v=>Math.max(0,Math.min(1,v));
const linS=(v,t)=>c01(v/t),invS=(v,ok,bad)=>v<=ok?1:v>=bad?0:1-(v-ok)/(bad-ok);
const GRP={greens:["spinat","spinat1","mangold","rucola","feldsalat","romana","kresse","gruenkohl","salat","brokkoli","brokkoli1","rosenkohl","weisskohl","rotkohl","pakchoi","chicoree"],berries:["beeren","erdbeere","himbeere","heidelbeere","brombeere","johannisb","kirsche","stachelb","cranberry","goji"],nuts:["mandeln","mandel1","cashew","haselnuss","pistazien","macadamia","pinien","walnuss","nuesse","erdnuss","paranuss","nussmus","kuerbisk","kuerbiskerne","sonnenbl","sesam","hanfsamen","leinsamen","chia"],fish:["lachs","raeucherlachs","thunfisch","thunfrisch","hering","hering1","makrele","sardinen","forelle","fisch","kabeljau","pangasius","garnelen","muscheln","austern","tintenfisch","fischst"],
  ferm:["sauerkraut","sauerkr1","kefir","joghurt","grjoghurt","skyr","tempeh"],coffee:["kaffee","gruentee","schwtee"],
  legume:["linsen","rotelinsen","kichererb","bohnen","kidney","weissebohnen","schwarzebohnen","sojabohnen","edamame","erbsen","erbsen1","hummus","tofu","tempeh","falafel"],red:{hack:1,rind:1,rinderfilet:1,kalb:1,lamm:1,wild:1,schweinefilet:1,schwein:1,bolognese:.35,chili:.3,gyros:1,frikadelle:.8,burger:.5,doener:.4,leber:1,lasagne:.15},proc:{salami:1,schinken:1,bratwurst:1,leberkaese:1,schweinebauch:1,raeucherlachs:0}};
function longData(end){
  const keys=Object.keys(S.days).filter(k=>k<=end).sort();const first=keys[0]||end;
  const n=Math.max(1,Math.min(28,Math.round((parseD(end)-parseD(first))/864e5)+1));const ds=[];for(let i=n-1;i>=0;i--)ds.push(addDays(end,-i));
  const fed=ds.filter(d=>hasDay(d)&&day(d).entries.length);const wk=n/7;
  const avg=f=>fed.length?fed.reduce((s,d)=>s+f(totals(d)),0)/fed.length:null;
  const serv={greens:0,berries:0,nuts:0,fish:0,legume:0,ferm:0,coffee:0},meat={red:0,proc:0};
  for(const d of fed)for(const e of day(d).entries)for(const it of e.items){const id=it.fid&&(foodById(it.fid)||{}).gen||it.fid;if(!id)continue;
    for(const g in serv)if(GRP[g].includes(id)&&it.g>=(g==="nuts"?15:g==="coffee"?120:40))serv[g]++;
    if(GRP.red[id])meat.red+=it.g*GRP.red[id];if(GRP.proc[id])meat.proc+=it.g*GRP.proc[id]}
  let act=0,str=0;for(const d of ds){if(!hasDay(d))continue;for(const w of day(d).workouts){if(w.type==="gym"){str++;act+=w.min||60}else act+=w.min||0}}
  const chk=k=>{const v=ds.map(d=>hasDay(d)?day(d).check[k]:null).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const micro=NUTR.filter(x=>(x[5]==="v"||x[5]==="n")&&x[0]!=="na"&&x[3]>0);
  const w=S.settings.weight||78;
  return{n,fedN:fed.length,wk,act:act/wk,str:str/wk,sleep:chk("sleep"),rhr:chk("rhr"),bmi:w/(1.85*1.85),
    fib:avg(T=>T.fib),veg:avg(T=>T.veg),sug:avg(T=>T.addSug),sfa:avg(T=>T.kcal?T.sfa*9/T.kcal*100:0),na:avg(T=>T.na),k:avg(T=>T.k),o3:avg(T=>T.o3),
    ca:avg(T=>T.ca),vD:avg(T=>T.vD),vK:avg(T=>T.vK),mg:avg(T=>T.mg),b12:avg(T=>T.b12),b9:avg(T=>T.b9),prot:avg(T=>T.p/w),upf:avg(T=>T.kcal?T.proc/T.kcal:0),
    alc:fed.length?fed.reduce((s,d)=>s+totals(d).alc,0)/wk:null,cover:avg(T=>micro.reduce((s,x)=>s+ratio(T[x[0]],x[3]),0)/micro.length),
    ferm:serv.ferm/wk,coffee:fed.length?serv.coffee/fed.length:null,vC:avg(T=>T.vC),vE:avg(T=>T.vE),zn:avg(T=>T.zn),se:avg(T=>T.se),poly:avg(T=>T.poly),lut:avg(T=>T.lut),greens:serv.greens/wk,berries:serv.berries/wk,nuts:serv.nuts/wk,fish:serv.fish/wk,legume:serv.legume/wk,red:fed.length?meat.red/fed.length:null,proc:fed.length?meat.proc/fed.length:null}}
function longFactors(D){const F={},food=D.fedN>=3,add=(id,label,ok,score,val,goal)=>{if(ok)F[id]={label,s:score(),val:val(),goal}};
  add("act","Bewegung",true,()=>linS(D.act,300),()=>fmt(D.act)+" min/Woche","Ziel 150–300+ min");
  add("str","Krafttraining",true,()=>linS(D.str,2),()=>fmt(D.str,1)+"× pro Woche","Ziel 2×+");
  add("sleep","Schlaf",D.sleep!=null,()=>D.sleep>=7&&D.sleep<=9.5?1:D.sleep<7?c01((D.sleep-5)/2):c01(1-(D.sleep-9.5)/1.5),()=>fmt(D.sleep,1)+" h","Ziel 7–9 h");
  add("bmi","Körpergewicht (BMI)",true,()=>D.bmi<18.5?0.6:D.bmi<=25?1:D.bmi>=30?0.2:1-(D.bmi-25)/5*0.8,()=>fmt(D.bmi,1),"18,5–25");
  add("rhr","Ruhepuls",D.rhr!=null,()=>invS(D.rhr,60,80),()=>fmt(D.rhr)+" /min","unter 60");
  add("fib","Ballaststoffe",food,()=>linS(D.fib,30),()=>fmt(D.fib)+" g/Tag","30 g+");
  add("veg","Obst & Gemüse",food,()=>linS(D.veg,500),()=>fmt(D.veg)+" g/Tag","500 g");
  add("legume","Hülsenfrüchte",food,()=>linS(D.legume,3),()=>fmt(D.legume,1)+"× pro Woche","3×+");
  add("greens","Grünes Blattgemüse & Kohl",food,()=>linS(D.greens,6),()=>fmt(D.greens,1)+"× pro Woche","6×+");
  add("berries","Beeren",food,()=>linS(D.berries,2),()=>fmt(D.berries,1)+"× pro Woche","2×+");
  add("nuts","Nüsse & Kerne",food,()=>linS(D.nuts,5),()=>fmt(D.nuts,1)+"× pro Woche","5×+");
  add("o3","Omega-3 (Fisch)",food,()=>linS(D.o3,0.25),()=>fmt(D.o3*1000)+" mg/Tag","250 mg");
  add("proc","Wurst & verarbeitetes Fleisch",food,()=>invS(D.proc,0,50),()=>fmt(D.proc)+" g/Tag","möglichst 0");
  add("red","Rotes Fleisch",food,()=>invS(D.red,70,150),()=>fmt(D.red)+" g/Tag","max. 70 g");
  add("sug","Zugesetzter Zucker",food,()=>invS(D.sug,25,75),()=>fmt(D.sug)+" g/Tag","unter 25–50 g");
  add("sfa","Gesättigte Fette",food,()=>invS(D.sfa,10,15),()=>fmt(D.sfa)+" % der kcal","unter 10 %");
  add("salt","Salz",food,()=>invS(D.na,2000,3500),()=>fmt(D.na/400,1)+" g/Tag","unter 5 g");
  add("k","Kalium",food,()=>linS(D.k,3500),()=>fmt(D.k)+" mg/Tag","3500 mg+");
  add("upf","Hochverarbeitete Lebensmittel",food,()=>invS(D.upf,0.15,0.5),()=>fmt(D.upf*100)+" % der kcal","unter 15 %");
  add("alc","Alkohol",D.alc!=null,()=>invS(D.alc,0,7),()=>fmt(D.alc,1)+" Getränke/Woche","0 ist am besten");
  add("ca","Calcium",food,()=>linS(D.ca,1000),()=>fmt(D.ca)+" mg/Tag","1000 mg");
  add("vD","Vitamin D",food,()=>linS(D.vD,20),()=>fmt(D.vD,1)+" µg/Tag","20 µg");
  add("vK","Vitamin K",food,()=>linS(D.vK,70),()=>fmt(D.vK)+" µg/Tag","70 µg");
  add("mg","Magnesium",food,()=>linS(D.mg,350),()=>fmt(D.mg)+" mg/Tag","350 mg");
  add("b12","Vitamin B12",food,()=>linS(D.b12,4),()=>fmt(D.b12,1)+" µg/Tag","4 µg");
  add("b9","Folat",food,()=>linS(D.b9,300),()=>fmt(D.b9)+" µg/Tag","300 µg");
  add("prot","Protein",food,()=>linS(D.prot,1.6),()=>fmt(D.prot,1)+" g/kg","1,6 g/kg");
  add("ferm","Fermentiertes (Joghurt, Kefir, Sauerkraut)",food,()=>linS(D.ferm,5),()=>fmt(D.ferm,1)+"× pro Woche","5×+");
  add("coffee","Kaffee / Tee",food,()=>D.coffee<=0.3?0.5:D.coffee<=5?1:0.7,()=>fmt(D.coffee,1)+" Tassen/Tag","1–4 Tassen");
  add("poly","Polyphenole",food,()=>linS(D.poly,1000),()=>fmt(D.poly)+" mg/Tag","1000 mg");
  add("lut","Lutein + Zeaxanthin",food,()=>linS(D.lut,6000),()=>fmt(D.lut/1000,1)+" mg/Tag","6 mg");
  add("vC","Vitamin C",food,()=>linS(D.vC,200),()=>fmt(D.vC)+" mg/Tag","200 mg");
  add("vE","Vitamin E",food,()=>linS(D.vE,20),()=>fmt(D.vE,1)+" mg/Tag","20 mg");
  add("zn","Zink",food,()=>linS(D.zn,14),()=>fmt(D.zn,1)+" mg/Tag","14 mg");
  add("se","Selen",food,()=>linS(D.se,100),()=>fmt(D.se)+" µg/Tag","100 µg");
  return F}
const DISEASES=[
 {id:"cvd",name:"Herz & Kreislauf",sub:"Herzinfarkt, Schlaganfall, Bluthochdruck",w:{act:3,sleep:1,bmi:1.5,rhr:1,fib:1.5,veg:1.5,legume:.5,nuts:1,o3:1,sfa:1,salt:1.5,k:1,alc:1,proc:1,upf:.5,poly:.5},
  not:"Blutdruck, Cholesterin, Rauchen und Familie fließen nicht ein."},
 {id:"t2d",name:"Typ-2-Diabetes",sub:"Insulinresistenz, Stoffwechsel",w:{act:2.5,str:1.5,bmi:2.5,fib:1.5,sug:1.5,proc:1,red:.5,upf:1,legume:.5,nuts:.5,mg:.5,sleep:1,alc:.5},
  not:"Blutzucker, HbA1c und Familie fließen nicht ein."},
 {id:"cancer",name:"Krebs",sub:"v. a. Darm, Leber, Speiseröhre, Prostata",w:{act:1.5,bmi:1.5,alc:2.5,proc:2,red:1,fib:1.5,veg:1.5,legume:.5,upf:1,sug:.5,ca:.5,vD:.5,poly:.5},
  not:"Rauchen, Sonnenschutz, Impfungen (HPV, Hepatitis B), Gene und Vorsorge fließen nicht ein."},
 {id:"dem",name:"Alzheimer & Demenz",sub:"Gehirn, Gedächtnis",w:{act:2.5,sleep:1.5,greens:1,berries:1,nuts:.5,o3:1,legume:.5,alc:1,sfa:.5,b12:.5,b9:.5,salt:.5,bmi:.5,proc:.5,rhr:.5,poly:.5,lut:.5},
  not:"Hören, Bildung, soziale Kontakte, Blutdruck, Kopfverletzungen und Gene (APOE) fließen nicht ein."},
 {id:"bone",name:"Knochen & Muskeln",sub:"Osteoporose, Muskelschwund im Alter",w:{str:2.5,act:1,ca:1.5,vD:1.5,prot:1.5,vK:.5,mg:.5,k:.5,alc:.5,bmi:.5},
  not:"Knochendichte, Hormone und Gene fließen nicht ein."},
 {id:"bp",name:"Bluthochdruck",sub:"Gefäße, Herz, Nieren",w:{salt:2.5,k:2,act:2,bmi:2,alc:1.5,veg:1,fib:.5,mg:.5,rhr:1,sleep:.5,poly:.5},
  not:"Deinen gemessenen Blutdruck kennt die App nicht. Miss ihn ab und zu, Ziel unter 120/80."},
 {id:"dep",name:"Depression",sub:"Stimmung, psychische Gesundheit",w:{act:2.5,sleep:2,o3:1,veg:1,fib:.5,upf:1,alc:1,sug:.5,legume:.5,nuts:.5,b9:.5,b12:.5,vD:.5,ferm:.5},
  not:"Soziale Kontakte, Stress, Sinn und Gene fließen nicht ein. Wenn es dir länger schlecht geht, sprich mit jemandem oder einem Arzt."},
 {id:"park",name:"Parkinson",sub:"Nervensystem, Bewegung",w:{act:3,berries:1,poly:1,coffee:1,veg:.5,o3:.5},
  not:"Gene, Pestizide und Kopfverletzungen fließen nicht ein."},
 {id:"eye",name:"Augen (Makuladegeneration)",sub:"Netzhaut, Sehkraft im Alter",w:{lut:2.5,o3:1.5,zn:1,vC:1,vE:1,greens:1,veg:1,bmi:.5},
  not:"Rauchen, UV-Licht (Sonnenbrille) und Gene fließen nicht ein."},
 {id:"gout",name:"Gicht & Nierensteine",sub:"Harnsäure, Gelenke",w:{alc:2,sug:2,red:1,bmi:1.5,act:.5,veg:.5,k:.5,vC:.5},
  not:"Trinkmenge und Harnsäure-Blutwert fließen nicht ein. Trink genug, vor allem bei langen Läufen."},
 {id:"arth",name:"Arthrose & Gelenke",sub:"Knie, Hüfte, Knorpel",w:{bmi:2.5,str:2,act:1,o3:1,vD:.5,vK:.5,poly:.5},
  not:"Verletzungen und Gene fließen nicht ein. Laufen schadet gesunden Knien nach heutigem Wissen nicht."},
 {id:"kidney",name:"Chronische Nierenerkrankung",sub:"Nierenfunktion",w:{salt:2,bmi:1.5,act:1.5,sug:1,alc:.5,veg:1,upf:1,rhr:.5},
  not:"Blutdruck, Blutzucker und Schmerzmittel (Ibuprofen bei Läufen!) fließen nicht ein."},
 {id:"imm",name:"Infekte & Immunsystem",sub:"Abwehrkräfte",w:{sleep:2.5,vD:1.5,zn:1,vC:1,prot:1,act:1,veg:1,alc:.5,se:.5,ferm:.5},
  not:"Impfungen und Hygiene fließen nicht ein. Sehr lange Läufe schwächen die Abwehr kurzzeitig."},
 {id:"gut",name:"Darm & Divertikel",sub:"Verdauung, Darmflora",w:{fib:2.5,veg:1.5,legume:1,ferm:1,poly:.5,red:1,proc:1,act:1,upf:.5},
  not:"Vorsorge (Darmspiegelung) und Gene fließen nicht ein."},
 {id:"liver",name:"Fettleber",sub:"Leber, Stoffwechsel",w:{bmi:2,act:2,sug:2,alc:2,upf:1,fib:.5,o3:.5},
  not:"Leberwerte und Medikamente fließen nicht ein."}];
function diseaseScore(d,F){let sw=0,ss=0,tot=0;const parts=[];for(const[k,w]of Object.entries(d.w)){tot+=w;if(!F[k])continue;sw+=w;ss+=w*F[k].s;parts.push({k,w,...F[k],gap:w*(1-F[k].s)})}
  parts.sort((a,b)=>b.gap-a.gap);return{v:sw?Math.round(ss/sw*100):null,parts,cov:sw/tot}}
function renderLongevity(){
  const root=$("#v-longevity");root.replaceChildren();
  const D=longData(CUR),F=longFactors(D);
  const res=DISEASES.map(d=>({d,...diseaseScore(d,F)}));const ok=res.filter(r=>r.v!=null);
  const all=ok.length?Math.round(ok.reduce((s,r)=>s+r.v,0)/ok.length):null;
  const col=v=>v>=80?"var(--good)":v>=60?"var(--warn)":"var(--bad)";
  root.append(sec("Longevity",h("span",{class:"muted tiny"},D.n<28?"letzte "+D.n+" Tage":"letzte 4 Wochen"),
    h("div",{class:"kcal"},h("div",{},h("div",{class:"big num"},all!=null?all+" %":"–"),h("div",{class:"muted small"},"Schutzfaktoren erfüllt")),
      h("div",{class:"muted small",style:"text-align:right;max-width:58%"},"Wie gut deine Gewohnheiten die wissenschaftlich belegten Schutzfaktoren gegen diese Krankheiten erfüllen.")),
    D.fedN<3?h("p",{class:"small warn-t"},"Erst "+D.fedN+" Tag(e) mit Essen eingetragen. Ab 3 Tagen zählen die Ernährungsfaktoren mit."):null,
    h("p",{class:"muted tiny"},"Das ist keine Diagnose und keine Vorhersage deines persönlichen Risikos. Gene, Blutwerte, Blutdruck und Vorerkrankungen kennt die App nicht. 100 % heißt: Du tust bei den messbaren Faktoren alles, was die Studienlage hergibt.")));
  for(const r of res){const key="ds"+r.d.id,open=OPEN.has(key);const top=r.parts.filter(x=>x.s<0.8).slice(0,1)[0];
    root.append(h("button",{class:"score dis",onclick:()=>{open?OPEN.delete(key):OPEN.add(key);render()},"aria-expanded":open?"true":"false"},
      h("div",{class:"score-top"},h("span",{class:"score-n"},r.d.name),h("span",{class:"num score-v",style:r.v!=null?"color:"+col(r.v):""},r.v!=null?r.v+" %":"–")),
      h("div",{class:"muted tiny"},r.d.sub),
      h("div",{class:"bar thin"},h("i",{style:`width:${r.v||0}%;background:${col(r.v||0)}`})),
      h("div",{class:"small"},top?"Größter Hebel: "+top.label+" ("+top.val+", "+top.goal+")":"Alle Faktoren im grünen Bereich"),
      open?h("div",{},h("ul",{class:"score-d"},r.parts.map(x=>h("li",{},h("span",{},(x.s>=0.8?"✓ ":x.s>=0.5?"◐ ":"✗ ")+x.label),h("span",{class:"num muted"},x.val)))),
        h("p",{class:"muted tiny"},r.d.not+(r.cov<0.99?" Für "+fmt((1-r.cov)*100)+" % der Faktoren fehlen noch Daten.":""))):null))}
  // Longevity langfristig
  const win=(a,b)=>{const ds=[];for(let d=a;d<=b;d=addDays(d,1))ds.push(d);const fed=ds.filter(d=>hasDay(d)&&day(d).entries.length);const sl=ds.map(d=>hasDay(d)?day(d).check.sleep:null).filter(x=>x!=null);const av=k=>{const v=ds.map(d=>hasDay(d)?day(d).check[k]:null).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
    const micro=NUTR.filter(n=>(n[5]==="v"||n[5]==="n")&&n[0]!=="na"&&n[3]>0);
    const avg=f=>fed.length?fed.reduce((s,d)=>s+f(totals(d)),0)/fed.length:null;
    return{hrv:av("hrv"),rhr:av("rhr"),n:fed.length,sleep:sl.length?sl.reduce((a,b)=>a+b,0)/sl.length:null,cover:avg(T=>micro.reduce((s,n)=>s+ratio(T[n[0]],n[3]),0)/micro.length*100),fib:avg(T=>T.fib),veg:avg(T=>T.veg),o3w:fed.length?fed.reduce((s,d)=>s+totals(d).o3,0)/fed.length*7:null,
      move:ds.filter(d=>{const w=workSum(d);return w.km||w.gym||w.walk>=30||w.other>=20}).length/ds.length*100,alc:fed.length?fed.reduce((s,d)=>s+totals(d).alc,0)/ds.length*7:null}};
  const today=CUR;const L=win(addDays(today,-27),today),P=win(addDays(today,-55),addDays(today,-28));
  const lon=sec("Trends",h("span",{class:"muted tiny"},"Ø 4 Wochen gegen die 4 davor"));
  if(L.n<2)lon.append(h("p",{class:"muted small"},"Trag ein paar Tage Essen und Schlaf ein, dann siehst du hier deine langfristigen Trends."));
  else{
    lon.append(progRow("Schlaf",L.sleep!=null?fmt(L.sleep,1)+" h":"–",delta(L.sleep,P.sleep,"h",1),"Ziel 8–9 h"));
    if(L.hrv!=null)lon.append(progRow("HRV",fmt(L.hrv)+" ms",delta(L.hrv,P.hrv,"ms"),"höher ist besser, steigt mit Ausdauer und Schlaf"));
    if(L.rhr!=null)lon.append(progRow("Ruhepuls",fmt(L.rhr),delta(L.rhr,P.rhr,"",0,true),"sinkt, wenn die Ausdauer wächst"));
    lon.append(progRow("Vitamine & Mineralstoffe",fmt(L.cover)+" %",delta(L.cover,P.cover,"%"),"Ø Abdeckung der Tagesziele"));
    lon.append(progRow("Ballaststoffe",fmt(L.fib)+" g",delta(L.fib,P.fib,"g"),"Ziel 45 g"));
    lon.append(progRow("Obst & Gemüse",fmt(L.veg)+" g",delta(L.veg,P.veg,"g"),"Ziel 500 g"));
    lon.append(progRow("Omega-3 pro Woche",fmt(L.o3w,1)+" g",delta(L.o3w,P.o3w,"g",1),"Ziel ≈ 1,75 g EPA+DHA (1–2× Fisch)"));
    lon.append(progRow("Aktive Tage",fmt(L.move)+" %",delta(L.move,P.move,"%")));
    if(L.alc>0.2)lon.append(progRow("Alkohol pro Woche",fmt(L.alc,1)+" Getränke",delta(L.alc,P.alc,"",1,true)));
  }
  root.append(lon);
}


/* ================= Sync über ein geheimes GitHub-Gist (kostenlos) ================= */
const SKEY="ultra100.sync";let SY={};try{SY=JSON.parse(localStorage.getItem(SKEY))||{}}catch(e){SY={}}
const saveSY=()=>{try{localStorage.setItem(SKEY,JSON.stringify(SY))}catch(e){}};
let syncT=null,SYNCING=false,SYNCMSG="";
function syncSoon(){if(!SY.token)return;clearTimeout(syncT);syncT=setTimeout(()=>syncNow(false),4000)}
async function gh(path,opt={}){const r=await fetch("https://api.github.com"+path,{...opt,headers:{Authorization:"Bearer "+SY.token,Accept:"application/vnd.github+json","Content-Type":"application/json",...(opt.headers||{})},cache:"no-store"});
  if(r.status===401)throw new Error("Token ungültig oder abgelaufen");if(r.status===403||r.status===404&&path==="/gists")throw new Error("Token hat keine Gist-Berechtigung");if(!r.ok)throw new Error("GitHub antwortet mit "+r.status);return r.json()}
const dayWeight=d=>(d.entries||[]).length+(d.workouts||[]).length+Object.keys(d.check||{}).length;
function mergeState(L,R){
  const out={...L,days:{...L.days}};
  for(const[k,rd]of Object.entries(R.days||{})){const ld=out.days[k];if(!ld){out.days[k]=rd;continue}
    const lu=ld.u||0,ru=rd.u||0;if(ru>lu||(ru===lu&&dayWeight(rd)>dayWeight(ld)))out.days[k]=rd}
  const ids=new Set(out.custom.map(c=>c.id));out.custom=[...out.custom,...(R.custom||[]).filter(c=>!ids.has(c.id))];
  out.learn={...(R.learn||{}),...(L.learn||{})};
  if((R.settings&&R.settings.u||0)>(L.settings.u||0))out.settings={...L.settings,...R.settings};
  return out}
async function syncNow(manual){
  if(!SY.token||SYNCING)return;SYNCING=true;SYNCMSG="Synchronisiere …";if(VIEW==="mehr")render();
  try{
    if(!SY.gist){const list=await gh("/gists?per_page=100");const g=list.find(x=>x.description==="ultra100-sync"&&x.files["ultra100.json"]);
      if(g)SY.gist=g.id;else{const c=await gh("/gists",{method:"POST",body:JSON.stringify({description:"ultra100-sync",public:false,files:{"ultra100.json":{content:JSON.stringify(S)}}})});SY.gist=c.id}saveSY()}
    const g=await gh("/gists/"+SY.gist);const f=g.files["ultra100.json"];let R=null;
    if(f){let txt=f.content;if(f.truncated)txt=await (await fetch(f.raw_url,{cache:"no-store"})).text();try{R=JSON.parse(txt)}catch(e){R=null}}
    const before=JSON.stringify(S);
    if(R&&R.days){S=mergeState(S,R);S.days??={};S.custom??=[];S.learn??={};rehash();localStorage.setItem(KEY,JSON.stringify(S))}
    const mine=JSON.stringify(S);
    if(!R||mine!==JSON.stringify(mergeState(R,S)))await gh("/gists/"+SY.gist,{method:"PATCH",body:JSON.stringify({files:{"ultra100.json":{content:mine}}})});
    SY.last=Date.now();saveSY();SYNCMSG="";if(manual)toast("Synchronisiert");
    if(mine!==before)render();else if(VIEW==="mehr")render();
  }catch(e){SYNCMSG="Sync-Fehler: "+e.message;if(manual)toast(SYNCMSG)}finally{SYNCING=false}}
function syncSec(){
  const on=!!SY.token;const t=h("input",{type:"password",placeholder:"ghp_…",autocomplete:"off",value:""});
  const when=SY.last?new Date(SY.last).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"noch nie";
  return sec("Sync zwischen Geräten",on?h("span",{class:"pill good"},"an"):h("span",{class:"pill warn"},"aus"),
    on?h("div",{},h("p",{class:"small"},"Zuletzt synchronisiert: "+when+(SYNCMSG?" · ":""),SYNCMSG?h("span",{class:SYNCMSG.startsWith("Sync-Fehler")?"warn-t":"muted"},SYNCMSG):null),
        h("div",{class:"btn-row"},h("button",{class:"btn",onclick:()=>syncNow(true)},"Jetzt synchronisieren"),h("button",{class:"btn",onclick:()=>{SY={};saveSY();toast("Sync auf diesem Gerät aus");render()}},"Sync ausschalten")),
        h("p",{class:"muted tiny"},"Synchronisiert automatisch beim Öffnen und ein paar Sekunden nach jeder Änderung. Gleicher Tag auf zwei Geräten gleichzeitig geändert: die neuere Änderung gewinnt."))
      :h("div",{},h("p",{class:"small"},"Kostenlos über dein GitHub-Konto. Deine Daten liegen dann in einem geheimen Gist (nicht öffentlich gelistet, aber jeder mit dem genauen Link könnte es lesen)."),
        h("ol",{class:"list small"},h("li",{},"Öffne ",h("a",{href:"https://github.com/settings/tokens/new?scopes=gist&description=Ultra100%20Sync",target:"_blank",rel:"noopener"},"diesen Link")," (GitHub, eingeloggt)."),
          h("li",{},"Bei „Expiration“ „No expiration“ wählen, nur „gist“ ist angehakt, unten „Generate token“."),h("li",{},"Den Token (ghp_…) kopieren, hier einfügen, „Verbinden“."),h("li",{},"Auf dem zweiten Gerät denselben Token einfügen. Fertig.")),
        h("label",{},"Token",t),h("button",{class:"btn primary wide",onclick:async()=>{const v=t.value.trim();if(!/^(ghp_|github_pat_)/.test(v)){toast("Das sieht nicht nach einem GitHub-Token aus");return}SY={token:v};saveSY();await syncNow(true);if(SYNCMSG.startsWith("Sync-Fehler")){toast(SYNCMSG);SY={};saveSY()}render()}},"Verbinden")))}

/* ---------- Mehr / Einstellungen ---------- */
function renderMehr(){
  const root=$("#v-mehr");root.replaceChildren();
  const n=(label,val,on,step="any")=>{const i=h("input",{type:"number",inputmode:"decimal",step,value:val??""});i.onchange=()=>on(i.value===""?null:+i.value.replace(",","."));return h("label",{},label,i)};
  root.append(sec("Profil",null,h("div",{class:"grid2"},n("Gewicht (kg)",S.settings.weight,v=>{if(v>30){S.settings.weight=v;save()}}),
    n("5-km-Pace (Sek./km)",S.settings.p5?Math.round(S.settings.p5):null,v=>{S.settings.p5=v;S.settings.p5date=v?todayISO():null;save();render()},"1")),
    h("p",{class:"muted tiny"},S.settings.p5?"Zonen basieren auf "+pace(S.settings.p5)+" /km (5 km).":"Noch kein 5-km-Test: Zonen aus dem Plan.")));
  const sl=h("div",{});
  S.settings.supps.forEach(s=>{const i=h("input",{type:"number",inputmode:"decimal",value:s.dose,"aria-label":"Dosis"});i.onchange=()=>{s.dose=+i.value.replace(",",".")||0;save()};
    sl.append(h("div",{class:"supp-r"},h("label",{class:"inline"},h("input",{type:"checkbox",checked:s.active?true:null,onchange:e=>{s.active=e.target.checked;save()}}),s.name),i,h("span",{class:"muted tiny"},s.unit)))});
  root.append(sec("Meine Supplements",null,sl,h("p",{class:"muted tiny"},"Bei Magnesium und Zink zählt die Menge des reinen Minerals (steht auf der Packung als „davon Magnesium“). Die Dosis fließt in die Nährstoffe ein.")));
  root.append(syncSec());
  root.append(sec("Daten",null,h("p",{class:"muted small"},SY.token?"Zusätzlich zum Sync kannst du ein Backup als Datei sichern.":"Ohne Sync liegt alles nur auf diesem Gerät. Mach ab und zu ein Backup."),
    h("div",{class:"btn-row"},h("button",{class:"btn",onclick:exportData},"Backup exportieren"),h("button",{class:"btn",onclick:()=>$("#impF").click()},"Backup laden")),
    h("button",{class:"link danger",onclick:()=>{const b=$("#delC");b.hidden=!b.hidden}},"Alle Daten löschen …"),
    h("div",{id:"delC",hidden:true,class:"small"},"Wirklich alles löschen? ",h("button",{class:"btn danger",onclick:()=>{S=freshState();save();toast("Gelöscht");setView("training")}},"Ja, löschen"))));
  root.append(sec("So nutzt du die App",null,h("ul",{class:"list small"},
    h("li",{},"Auf den Homescreen: in Safari auf Teilen tippen, dann „Zum Home-Bildschirm“."),
    h("li",{},"Sprechen: im Textfeld auf das Mikrofon der iPhone-Tastatur tippen. Falls es fehlt: Einstellungen › Allgemein › Tastatur › Diktierfunktion an."),
    h("li",{},"Grobe Angaben reichen. Unbekanntes suchst du über „+ Lebensmittel hinzufügen“: über 7.000 Lebensmittel aus dem Bundeslebensmittelschlüssel, Barcode-Scan, Online-Suche oder selbst anlegen."))));
  root.append(sec("Datenquellen",null,h("p",{class:"muted tiny"},"Nährwerte: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0, Deutsche Nährstoffdatenbank, Karlsruhe, DOI 10.25826/Data20251217-134202-0, Lizenz CC BY 4.0. Umgerechnet auf die Nährstoffe der App; Selen, Cholin, Polyphenole, Lutein, Lycopin und Kreatin stehen nicht im BLS und werden aus ähnlichen Lebensmitteln geschätzt. Markenprodukte: Open Food Facts (ODbL). Barcode-Scanner: ZXing für JavaScript (MIT).")));
}
function exportData(){const blob=new Blob([JSON.stringify(S)],{type:"application/json"});const f=new File([blob],"ultra100-backup-"+todayISO()+".json",{type:"application/json"});
  if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f]}).catch(()=>{});else{const a=h("a",{href:URL.createObjectURL(blob),download:f.name});document.body.append(a);a.click();a.remove()}}

/* ================= Start ================= */
$$("nav.tabs button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.v)));
$("#prev").onclick=()=>{CUR=addDays(CUR,-1);PREVIEW=null;render()};
$("#next").onclick=()=>{CUR=addDays(CUR,1);PREVIEW=null;render()};
$("#dTitle").onclick=()=>{CUR=todayISO();render()};
$("#settingsBtn").onclick=()=>setView("mehr");
$("#pkClose").onclick=()=>$("#picker").close();
$("#impF").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text());if(!j.days)throw 0;S=j;save();toast("Backup geladen");render()}catch(x){toast("Datei ist kein gültiges Backup")}e.target.value=""};
document.addEventListener("visibilitychange",()=>{if(document.hidden)return;if(CUR!==todayISO()&&CUR===addDays(todayISO(),-1)){CUR=todayISO();render()}syncNow(false)});
rehash();
render();
syncNow(false);
setTimeout(loadBLS,1500);
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
