"use strict";
/* ================= Eigener Trainingsplan (Text oder PDF) =================
   Der Plan wird lokal ohne KI gelesen: "Woche 1" (oder KW/Week) startet eine Woche,
   Wochentage (Mo/Montag/Mon …) starten einen Tag. Ohne Wochen-Angabe gilt der Text als Wochenvorlage,
   die sich jede Woche wiederholt. Ergebnis landet in S.settings.cplan. */
const PL_DAYS=[["mo","montag","mon","monday"],["di","dienstag","tue","tuesday"],["mi","mittwoch","wed","wednesday"],["do","donnerstag","thu","thursday"],["fr","freitag","fri","friday"],["sa","samstag","sat","saturday","sonnabend"],["so","sonntag","sun","sunday"]];
const PL_DAYRE=new RegExp("^\\s*(?:[-•*·]\\s*)?("+PL_DAYS.flat().sort((a,b)=>b.length-a.length).join("|")+")(\\.?)(?=([\\s:,\\-–|)]|$))[\\s:,\\-–|)]*","i");
/* Tag am Zeilenanfang? Kurzformen (Mo, Do, So …) nur mit Satzzeichen danach oder vor Zahl/Großbuchstabe, damit „so locker wie …“ kein Sonntag wird */
function plDayStart(part){const m=part.match(PL_DAYRE);if(!m)return null;
  if(m[1].length<=3&&!m[2]){const sep=m[0].slice(m[0].search(/[\s:,\-–|)]/));
    if(!/[:\-–|),]/.test(sep)&&!/^[0-9A-ZÄÖÜ]/.test(part.slice(m[0].length)))return null}
  return m}
const PL_WEEKRE=/^\s*(?:[-•*#]\s*)?(?:woche|week|wo\.?|kw)\s*(\d{1,2})\b[\s:.\-–|)]*/i;
const plNum=s=>+String(s).replace(",",".");
function plDayIdx(w){w=w.toLowerCase().replace(".","");return PL_DAYS.findIndex(a=>a.includes(w))}

/* Eine Einheit aus Freitext lesen */
function plSession(txt){
  const t=" "+txt.toLowerCase().replace(/[×*]/g,"x")+" ";
  const o={t:txt.trim(),type:"other",km:0,min:0,kind:"easy",gym:null};
  if(!txt.trim()||/\b(ruhetag|ruhe|frei|rest|pause|off)\b/.test(t)&&!/\d+\s*km/.test(t))return{...o,type:"rest",kind:"rest"};
  // km: "5x1 km" zählt 5 km, sonst alle km-Angaben addieren; "gesamt/insgesamt 12 km" gewinnt
  let km=0;const tot=t.match(/(?:gesamt|insgesamt|total|summe)\D{0,6}(\d+(?:[.,]\d+)?)\s*km/);
  if(tot)km=plNum(tot[1]);
  else{const re=/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(km|m)\b/g;let m;while((m=re.exec(t))){let v=plNum(m[2]);if(m[3]==="m"){if(v<100)continue;v/=1000}km+=v*(m[1]?+m[1]:1)}}
  let min=0;const re2=/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(min|minuten|minute|')(?![a-z])/g;let m2;while((m2=re2.exec(t)))min+=plNum(m2[2])*(m2[1]?+m2[1]:1);
  const h_=t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|std|stunden?)\b/);if(h_)min+=plNum(h_[1])*60;
  o.min=Math.round(min);
  if(/schwimm|swim|kraul|bahnen/.test(t))o.type="swim";
  else if(/\b(rad|radfahren|bike|rennrad|spinning|ergometer|mtb)\b/.test(t))o.type="bike";
  else if(/kraft|gym|studio|hantel|beine|push|pull|oberkörper|ganzkörper|bankdrück|kniebeuge|kreuzheben|klimmz|kraftzirkel|core|stabi|athletik/.test(t)&&!/\b(lauf|laufen|run|joggen|dauerlauf)\b/.test(t))o.type="gym";
  else if(km>0||/lauf|laufen|run|jogg|dl\b|ga1|ga 1|intervall|tempo|fahrtspiel|steiger|bergsprint|long ?run/.test(t))o.type="run";
  if(o.type==="run"){
    if(!km&&min)km=Math.round(min/6.5*2)/2;
    o.km=Math.round(km*10)/10;
    o.kind=/long ?run|langer lauf|lange[rs]? (dauer)?lauf|\blang\b/.test(t)||o.km>=18?"long":/intervall|tempo|schwelle|fahrtspiel|wettkampf|\d+\s*x\s*\d|bergsprint|hügel|berg/.test(t)?"key":/steiger/.test(t)?"strides":/regener|recovery|auslaufen|sehr locker/.test(t)?"recovery":"easy";
    if(!o.km)o.km=5;
  }else if(o.type==="swim"||o.type==="bike"){o.km=Math.round(km*10)/10}
  if(o.type==="gym")o.gym=/bein|leg|kniebeuge|kreuzheb|unterkörper/.test(t)?"beine":/push|brust|drück|schulter/.test(t)?"push":/pull|rücken|klimm|ruder/.test(t)?"pull":/stabi|core|prehab|mobil/.test(t)?"prehab":"mix";
  // "Lauf + Kraft" am selben Tag
  if(o.type==="run"&&/kraft|gym|studio/.test(t))o.gym=/bein/.test(t)?"beine":/oberkörper|push|pull/.test(t)?"mix":"mix";
  return o}

function parsePlan(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
  const weeks=[];let cur=null,last=null,anyWeek=false;
  const newWeek=()=>{cur=[...Array(7)].map(()=>"");weeks.push(cur);last=null};
  for(let l of lines){
    const w=l.match(PL_WEEKRE);
    if(w){anyWeek=true;newWeek();l=l.slice(w[0].length).trim();if(!l)continue}
    // mehrere Tage in einer Zeile ("Mo: 8 km Di: Ruhe") auftrennen
    const parts=l.split(/(?=(?:^|\s)(?:mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\.?\s*[:\-–])/i).map(x=>x.trim()).filter(Boolean);
    for(const part of parts){
      const d=plDayStart(part);
      if(d&&plDayIdx(d[1])>=0){if(!cur)newWeek();const i=plDayIdx(d[1]);const rest=part.slice(d[0].length).trim();
        if(last!=null&&i<last)newWeek();cur[i]=(cur[i]?cur[i]+" · ":"")+rest;last=i}
      else if(cur&&last!=null)cur[last]+=(cur[last]?" ":"")+part}
  }
  const out=weeks.filter(w=>w.some(Boolean)).map(w=>w.map(plSession));
  return{weeks:out,repeat:!anyWeek&&out.length===1}}

function plMonday(ds){return addDays(ds,-dowOf(ds))}
function customPlanFor(ds){
  const P=S.settings.cplan;if(!P||!P.weeks||!P.weeks.length)return{pre:true,none:true};
  const diff=Math.round((parseD(ds)-parseD(P.start))/864e5);if(diff<0)return{pre:true};
  let wk=Math.floor(diff/7)+1;const dow=diff%7,n=P.weeks.length;
  if(!P.repeat&&wk>n)return{post:true};
  const W=P.weeks[P.repeat?0:wk-1],d=W[dow];
  const run=d.type==="run"?{km:d.km,kind:d.kind,key:d.kind==="key"?(d.t.replace(/^\s*\d+(?:[.,]\d+)?\s*km\s*/i,"").trim()||"Tempo"):undefined}:d.type==="rest"?{km:0,kind:"rest"}:{km:0,kind:"rest"};
  const sum=Math.round(W.reduce((s,x)=>s+(x.type==="run"?x.km:0),0));
  return{wk,dow,sum,note:"",phase:P.repeat?"Wochenplan":"Woche "+wk+" von "+n,run,gym:d.gym||null,gymNote:"",deload:false,legsLate:false,race:false,carbLoad:false,custom:true,txt:d.t,type:d.type,total:P.repeat?null:n}}

/* ---------- PDF lesen (pdf.js liegt in vendor/, nur bei Bedarf geladen) ---------- */
const PDFJS="vendor/pdfjs/"; // pdf.js 3.11.174 (Apache-2.0), nur bei Bedarf geladen
function loadPdfJs(){return window.pdfjsLib?Promise.resolve(window.pdfjsLib):new Promise((ok,no)=>{const s=h("script",{src:PDFJS+"pdf.min.js"});s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+"pdf.worker.min.js";ok(pdfjsLib)};s.onerror=()=>no(new Error("PDF-Leser konnte nicht geladen werden. Bist du online?"));document.head.append(s)})}
async function pdfText(file){
  const lib=await loadPdfJs();const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise;const out=[];
  for(let p=1;p<=Math.min(pdf.numPages,30);p++){const c=await (await pdf.getPage(p)).getTextContent();const rows=new Map();
    for(const it of c.items){if(!it.str.trim())continue;const y=Math.round(it.transform[5]/3)*3;if(!rows.has(y))rows.set(y,[]);rows.get(y).push([it.transform[4],it.str])}
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,r])=>out.push(r.sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(" ").replace(/\s+/g," ").trim()))}
  return out.join("\n")}

/* ---------- Editor in den Einstellungen ---------- */
let PLED=null;
const PL_TYPE={run:"Lauf",gym:"Kraft",swim:"Schwimmen",bike:"Rad",rest:"Ruhe",other:"Sonstiges"};
const PL_KIND={easy:"locker",long:"lang",key:"Schlüssel",strides:"mit Steigerungen",recovery:"Regeneration"};
function plSessTxt(d){if(d.type==="rest")return"Ruhe";if(d.type==="run")return"Lauf "+fmt(d.km,1)+" km "+(PL_KIND[d.kind]||"")+(d.gym?" + Kraft":"");
  return PL_TYPE[d.type]+(d.km?" "+fmt(d.km,1)+" km":"")+(d.min?" "+d.min+" min":"")+(d.gym?" ("+GYM[d.gym].name+")":"")}
function planEditor(){
  const P=S.settings.cplan;
  PLED??={text:P?P.src:"",start:P?P.start:plMonday(todayISO()),busy:false,msg:""};
  const ta=h("textarea",{rows:"9",placeholder:"Woche 1\nMo: 8 km locker\nDi: Kraft Beine\nMi: Ruhe\nDo: 6x1 km Intervalle, gesamt 10 km\nFr: Schwimmen 45 min\nSa: 18 km lang\nSo: Ruhe\n\nWoche 2\n…",value:PLED.text});
  const prev=h("div",{});
  const draw=()=>{const R=parsePlan(PLED.text);prev.replaceChildren();
    if(!R.weeks.length){prev.append(h("p",{class:"muted small"},PLED.text.trim()?"Ich erkenne noch keine Tage. Schreib die Wochentage an den Zeilenanfang (Mo, Di, … oder Montag, …) und optional „Woche 1“, „Woche 2“ davor.":"Noch kein Plan eingefügt."));return R}
    prev.append(h("p",{class:"small",style:"margin:10px 0 4px"},R.repeat?"Erkannt: ein Wochenplan, der sich jede Woche wiederholt.":"Erkannt: "+R.weeks.length+" Wochen, Ende am "+short(addDays(PLED.start,R.weeks.length*7-1))+"."));
    R.weeks.slice(0,30).forEach((w,i)=>{prev.append(h("div",{class:"tiny muted up"},R.repeat?"Jede Woche":"Woche "+(i+1)),
      h("div",{class:"tbl"},h("table",{},w.map((d,j)=>h("tr",{},h("td",{},WD[j]),h("td",{},plSessTxt(d)),h("td",{class:"muted"},d.t))))))});
    return R};
  ta.value=PLED.text;ta.oninput=()=>{PLED.text=ta.value;draw()};
  const st=h("input",{type:"date",value:PLED.start,onchange:e=>{PLED.start=plMonday(e.target.value||todayISO());draw()}});
  const fileIn=h("input",{type:"file",accept:"application/pdf,.pdf,.txt,text/plain",hidden:true,onchange:async e=>{const f=e.target.files[0];if(!f)return;PLED.busy=true;PLED.msg="Lese Datei …";render();
    try{const txt=/pdf/i.test(f.type)||/\.pdf$/i.test(f.name)?await pdfText(f):await f.text();PLED.text=txt;PLED.msg=txt.trim()?"Text aus der Datei übernommen. Prüf unten, ob die Tage stimmen, und korrigier den Text bei Bedarf.":"In der PDF steht kein lesbarer Text (eingescannt?). Tipp den Plan bitte ab."}
    catch(x){PLED.msg=x.message||"Datei konnte nicht gelesen werden"}PLED.busy=false;render()}});
  const s=sec("Eigenen Plan einfügen",h("button",{class:"link",onclick:()=>{PLED=null;OPEN.delete("pled");render()}},"Schließen"),
    h("p",{class:"muted small"},"Text einfügen oder eine PDF laden. Am besten klappt es mit „Woche 1“ und einer Zeile pro Tag, z. B. „Mo: 8 km locker“. Du siehst unten sofort, was ich erkannt habe."),
    h("div",{class:"btn-row",style:"margin-top:0"},h("button",{class:"btn",disabled:PLED.busy?true:null,onclick:()=>fileIn.click()},"PDF oder Textdatei laden"),fileIn),
    PLED.msg?h("p",{class:"small "+(/nicht|kein|Fehler/.test(PLED.msg)?"warn-t":"muted")},PLED.msg):null,
    h("label",{style:"margin-top:10px"},"Plan als Text",ta),h("label",{style:"margin-top:8px"},"Start (Montag von Woche 1)",st),prev,
    h("button",{class:"btn primary wide",onclick:()=>{const R=parsePlan(PLED.text);if(!R.weeks.length){toast("Keine Trainingstage erkannt");return}
      S.settings.cplan={src:PLED.text,start:plMonday(PLED.start),weeks:R.weeks,repeat:R.repeat,saved:Date.now()};S.settings.plan="custom";PLED=null;OPEN.delete("pled");save();toast("Plan gespeichert");setView("training")}},"Plan übernehmen"));
  draw();return s}

/* ---------- Abschnitt im Training-Tab ---------- */
function customPlanSec(){
  const P=S.settings.cplan,p=planFor(CUR),open=OPEN.has("plan");
  const wkIdx=p.wk?(P.repeat?0:p.wk-1):0,show=open?P.weeks.map((w,i)=>[i,w]):[[wkIdx,P.weeks[Math.min(wkIdx,P.weeks.length-1)]]];
  const s=sec("Dein Plan",h("button",{class:"link",onclick:()=>{open?OPEN.delete("plan"):OPEN.add("plan");render()}},open?"Zuklappen":P.repeat?"":"Alle Wochen"));
  s.append(h("p",{class:"muted tiny"},p.pre?"Dein Plan startet am "+short(P.start)+".":p.post?"Dein Plan ist abgeschlossen. Füg einen neuen ein oder trainiere ohne Plan weiter.":
    "Der Plan ist die Leitlinie, die Vorschläge oben passen sich an das an, was du wirklich einträgst."));
  for(const[i,w]of show){if(!w)continue;const mon=addDays(P.start,i*7);
    s.append(h("div",{class:"tiny muted up"},P.repeat?"Jede Woche":"Woche "+(i+1)+" · ab "+short(mon)),
      h("div",{class:"tbl"},h("table",{},w.map((d,j)=>h("tr",{class:!P.repeat&&addDays(mon,j)===CUR||P.repeat&&j===dowOf(CUR)?"cur":""},h("td",{},WD[j]),h("td",{},d.t||"–"),h("td",{class:"muted"},plSessTxt(d)))))))}
  s.append(h("button",{class:"link",onclick:()=>{OPEN.add("pled");PLED=null;setView("mehr")}},"Plan bearbeiten oder ersetzen"));
  return s}
