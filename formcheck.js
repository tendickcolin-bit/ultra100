/* ================= Formcheck: Fotos lokal (IndexedDB) + KI-Auswertung über die Claude-API ================= */
/* Wird vor app.js geladen; nutzt dessen Helfer (h, sec, toast, …) erst beim Aufruf. */
const FC_POSES=[["front","Vorne"],["side","Seite"],["back","Rücken"]];
const FC_POSE_NAME=Object.fromEntries(FC_POSES);
const FC_STORE_MAX=1280,FC_API_MAX=800;
const FC={list:null,loading:null,draft:null,a:null,b:null,pose:"front",busy:null,open:null,del:null,urls:[]};

/* ---------- IndexedDB ---------- */
let fcDbP=null;
function fcDb(){return fcDbP||(fcDbP=new Promise((res,rej)=>{const r=indexedDB.open("ultra100-photos",1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("checks"))r.result.createObjectStore("checks",{keyPath:"id"})};
  r.onsuccess=()=>res(r.result);r.onerror=()=>{fcDbP=null;rej(r.error)}}))}
async function fcTx(mode,fn){const db=await fcDb();return new Promise((res,rej)=>{const t=db.transaction("checks",mode);const r=fn(t.objectStore("checks"));
  t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
async function fcLoad(){const all=await fcTx("readonly",s=>s.getAll());FC.list=(all||[]).sort((x,y)=>x.date.localeCompare(y.date)||x.created-y.created);return FC.list}
const fcPut=c=>fcTx("readwrite",s=>s.put(c));
const fcDel=id=>fcTx("readwrite",s=>s.delete(id));

/* ---------- Bilder ---------- */
async function fcShrink(blob,max,q){const url=URL.createObjectURL(blob);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Bild lässt sich nicht öffnen"));i.src=url});
    const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement("canvas");
    c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("Bild konnte nicht verkleinert werden")),"image/jpeg",q))}
  finally{URL.revokeObjectURL(url)}}
const fcB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
function fcUrl(b){const u=URL.createObjectURL(b);FC.urls.push(u);return u}
function fcImg(b,alt,cls="fc-img"){return b?h("img",{class:cls,src:fcUrl(b),alt,loading:"lazy"}):h("div",{class:cls+" fc-none"},"kein Foto")}

/* ---------- Kontext aus der App ---------- */
function fcWeight(ds){for(let i=0;i<=10;i++){const d=addDays(ds,-i);if(hasDay(d)&&day(d).check.weight)return day(d).check.weight}return null}
function fcBetween(from,to){let km=0,gym=0,runs=0,n=0,kcal=0,p=0;
  for(let d=addDays(from,1);d<=to;d=addDays(d,1)){if(!hasDay(d))continue;const W=workSum(d);km+=W.km;gym+=W.gym;runs+=runsOf(d).length;
    if(day(d).entries.length){const T=totals(d);n++;kcal+=T.kcal;p+=T.p}}
  return{km,gym,runs,n,kcal:n?kcal/n:null,p:n?p/n:null,days:Math.round((parseD(to)-parseD(from))/864e5)}}
const fcDate=ds=>{const d=parseD(ds);return d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear()};

/* ---------- KI-Einstellungen (nur auf diesem Gerät, nicht im Sync/Backup) ---------- */
const AIKEY="ultra100.ai";let AI={};try{AI=JSON.parse(localStorage.getItem(AIKEY))||{}}catch(e){AI={}}
const saveAI=()=>{try{localStorage.setItem(AIKEY,JSON.stringify(AI))}catch(e){}};
const AI_MODELS={"claude-sonnet-5-5":{name:"Claude Sonnet 5.5",in:2,out:10,hint:"genauer, ca. 1–3 Cent pro Auswertung"},
  "claude-haiku-5-5":{name:"Claude Haiku 5.5",in:0.1,out:0.5,hint:"sehr günstig, ca. 0,1–0,3 Cent, etwas ungenauer"}};
const aiModel=()=>AI_MODELS[AI.model]?AI.model:"claude-sonnet-5-5";
const usdTxt=u=>u<0.01?fmt(u*100,2)+" Cent":fmt(u*100,1)+" Cent";

const FC_SYSTEM=`Du bist ein sachlicher, erfahrener Coach für Krafttraining und Ausdauersport. Du bekommst Formcheck-Fotos eines 18-jährigen Mannes (185 cm), der für einen 100-km-Ultralauf im September 2027 trainiert und gleichzeitig Muskeln aufbauen will (Ziel: langsam zunehmen, etwa +0,25 bis 0,5 kg pro Monat).

Deine Aufgabe: Vergleiche den aktuellen Formcheck mit den früheren und sag ehrlich, ob Fortschritt sichtbar ist.
- Beurteile nur, was auf den Fotos wirklich zu sehen ist: Muskelumfang und Definition je Region (Schultern, Brust, Arme, Rücken/Lat, Bauch/Rumpf, Beine), grobe Körperfett-Tendenz, Haltung.
- Anderes Licht, Abstand, Winkel, Pose oder Pump täuschen leicht Veränderungen vor. Benenne das und sag klar, wenn ein Vergleich nicht sicher möglich ist. Erfinde keine Veränderungen.
- Nach ein bis zwei Wochen ist meist kaum etwas zu sehen. Das ist normal, sag das dann ruhig so.
- Bleib konstruktiv und respektvoll. Keine Abwertung des Körpers, keine Idealmaße, keine medizinischen Diagnosen. Keine exakte Körperfettzahl, höchstens eine grobe Spanne mit dem Hinweis, dass Fotos dafür ungenau sind.
- Gibt es nur einen Formcheck, beschreibe ihn als Ausgangspunkt: Stärken und Ansatzpunkte.

Antworte auf Deutsch, knapp (höchstens etwa 180 Wörter), ohne Markdown-Fettschrift, genau in diesem Format:
Fazit: <Fortschritt sichtbar | leichter Fortschritt | keine sichtbare Veränderung | Vergleich nicht sicher möglich | Ausgangspunkt> – <ein Satz>
Veränderungen:
- <Region>: <Beobachtung>
Fotos: <ein Tipp für bessere Vergleichbarkeit, nur falls nötig, sonst "passt">
Nächster Fokus: <ein bis zwei konkrete Tipps, passend zu Training und Ernährung>`;

function fcContextText(cur,refs){
  const lines=[];
  const lab=c=>"Formcheck vom "+fcDate(c.date)+(c.weight?", "+fmt(c.weight,1)+" kg":"")+(c.note?", Notiz: „"+c.note+"“":"");
  refs.forEach((c,i)=>lines.push((i===0&&refs.length>1?"Erster ":"Vorheriger ")+lab(c)));
  lines.push("Aktueller "+lab(cur));
  const prev=refs.at(-1);
  if(prev){const B=fcBetween(prev.date,cur.date);
    lines.push("Zwischen vorherigem und aktuellem Formcheck ("+B.days+" Tage): "+fmt(B.km,1)+" km in "+B.runs+" Läufen, "+B.gym+" Krafteinheiten"+
      (B.n?", Ernährung an "+B.n+" Tagen erfasst: Ø "+fmt(B.kcal)+" kcal und "+fmt(B.p)+" g Protein pro Tag (Ziel 3200 kcal, 200 g Protein)":"")+".")}
  if(refs[0]&&refs.length>1){const B=fcBetween(refs[0].date,cur.date);lines.push("Seit dem ersten Formcheck: "+B.days+" Tage, "+fmt(B.km)+" km, "+B.gym+" Krafteinheiten.")}
  return lines.join("\n")}

async function fcImages(c,label){const out=[];for(const[p,n]of FC_POSES){const b=c.poses&&c.poses[p];if(!b)continue;
  const small=await fcShrink(b,FC_API_MAX,0.8);out.push({type:"text",text:label+" – "+n+":"},{type:"image",source:{type:"base64",media_type:"image/jpeg",data:await fcB64(small)}})}return out}

async function fcCall(body,withFallback){
  const headers={"content-type":"application/json","x-api-key":AI.key,"anthropic-version":"2026-10-21","anthropic-dangerous-direct-browser-access":"true"};
  const b={...body};if(withFallback){headers["anthropic-beta"]="server-side-fallback-2026-07-01";b.fallbacks="default"}
  let r;try{r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers,body:JSON.stringify(b)})}
  catch(e){throw new Error("Keine Verbindung. Bist du online?")}
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){const msg=(j&&j.error&&j.error.message)||"";
    if(withFallback&&r.status===400&&/fallback|beta/i.test(msg))return fcCall(body,false);
    if(r.status===401)throw new Error("API-Schlüssel ungültig. Prüf ihn unter Einstellungen › KI-Auswertung.");
    if(r.status===403)throw new Error("Der API-Schlüssel hat keine Berechtigung.");
    if(/credit balance|billing|purchase credits/i.test(msg))throw new Error("Kein API-Guthaben. Lade es unter console.anthropic.com › Billing auf (das Guthaben in der Claude-App zählt hier nicht).");
    if(r.status===429)throw new Error("Zu viele Anfragen. Versuch es in einer Minute nochmal.");
    if(r.status===529||r.status>=500)throw new Error("Claude ist gerade ausgelastet. Versuch es gleich nochmal.");
    throw new Error("Fehler "+r.status+(msg?": "+msg:""))}
  return j}

async function fcAnalyze(cur){
  if(!AI.key){toast("Erst den API-Schlüssel in den Einstellungen eintragen");setView("mehr");return}
  const list=FC.list||await fcLoad();const before=list.filter(c=>c.id!==cur.id&&(c.date<cur.date||(c.date===cur.date&&c.created<cur.created)));
  const refs=[];if(before.length>1)refs.push(before[0]);if(before.length)refs.push(before.at(-1));
  FC.busy=cur.id;render();
  try{
    const content=[{type:"text",text:fcContextText(cur,refs)}];
    for(const[i,c]of refs.entries())content.push(...await fcImages(c,(i===0&&refs.length>1?"Erster":"Vorheriger")+" Formcheck ("+fcDate(c.date)+")"));
    content.push(...await fcImages(cur,"Aktueller Formcheck ("+fcDate(cur.date)+")"));
    content.push({type:"text",text:refs.length?"Ist im aktuellen Formcheck Fortschritt sichtbar? Antworte im vorgegebenen Format.":"Das ist der erste Formcheck. Beschreibe ihn als Ausgangspunkt im vorgegebenen Format."});
    const model=aiModel();
    const body={model,max_tokens:4000,system:FC_SYSTEM,thinking:{type:"adaptive"},output_config:{effort:"low"},messages:[{role:"user",content}]};
    const j=await fcCall(body,model==="claude-sonnet-5-5");
    if(j.stop_reason==="refusal")throw new Error("Claude hat die Auswertung abgelehnt. Probier andere Fotos (z. B. mit Shorts) oder das andere Modell.");
    const text=(j.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n").trim();
    if(!text)throw new Error(j.stop_reason==="max_tokens"?"Antwort zu lang abgebrochen. Bitte nochmal versuchen.":"Leere Antwort. Bitte nochmal versuchen.");
    const used=AI_MODELS[j.model]||AI_MODELS[model],u=j.usage||{};
    const usd=((u.input_tokens||0)+(u.cache_creation_input_tokens||0)*1.25+(u.cache_read_input_tokens||0)*0.1)*used.in/1e6+(u.output_tokens||0)*used.out/1e6;
    delete cur.aiErr;cur.ai={text,at:Date.now(),model:j.model||model,usd,refs:refs.map(c=>c.id)};
    await fcPut(cur);AI.spent=(AI.spent||0)+usd;AI.count=(AI.count||0)+1;saveAI();FC.open=cur.id;toast("Auswertung fertig · ca. "+usdTxt(usd))
  }catch(e){toast(e.message.length>70?"Auswertung fehlgeschlagen":e.message);cur.aiErr=e.message}
  finally{FC.busy=null;if(VIEW==="fortschritt")render()}}

function fcVerdict(text){const m=text.match(/^\s*Fazit:\s*([^–\-\n]+)/im);if(!m)return null;const v=m[1].trim().toLowerCase();
  const cls=/^fortschritt/.test(v)?"good":/leicht/.test(v)?"good":/ausgang/.test(v)?"warn":/keine/.test(v)?"warn":"bad";return{v:m[1].trim(),cls}}
function fcAiBlock(c){const t=c.ai.text.replace(/\*\*/g,"");
  return h("div",{class:"fc-ai small"},...t.split("\n").filter(l=>l.trim()).map(l=>{const k=l.match(/^(Fazit|Veränderungen|Fotos|Nächster Fokus):/);
      return k?h("p",{},h("b",{},k[1]+":"),l.slice(k[0].length)):h("p",{class:/^\s*[-•]/.test(l)?"fc-li":""},l.replace(/^\s*[-•]\s*/,"• "))}),
    h("p",{class:"muted tiny"},"Ausgewertet am "+new Date(c.ai.at).toLocaleDateString("de-DE")+" mit "+((AI_MODELS[c.ai.model]||{}).name||c.ai.model)+" · ca. "+usdTxt(c.ai.usd||0)+". Fotos sind nur ein grober Hinweis, Licht und Pose machen viel aus."))}

/* ---------- Neuer Formcheck ---------- */
function fcNewForm(){
  const D=FC.draft;
  const tiles=FC_POSES.map(([p,n])=>{
    const inp=h("input",{type:"file",accept:"image/*",hidden:true});
    const tile=h("button",{class:"fc-tile",type:"button",onclick:()=>inp.click()});
    const paint=()=>{tile.replaceChildren(D.poses[p]?h("img",{src:fcUrl(D.poses[p]),alt:n}):h("span",{class:"fc-plus"},"+"),h("span",{class:"fc-tl"},n))};
    inp.onchange=async()=>{const f=inp.files[0];inp.value="";if(!f)return;try{tile.classList.add("busy");D.poses[p]=await fcShrink(f,FC_STORE_MAX,0.85);paint()}catch(e){toast(e.message)}finally{tile.classList.remove("busy")}};
    paint();return h("div",{},tile,inp)});
  const dt=h("input",{type:"date",value:D.date,max:todayISO(),onchange:e=>{D.date=e.target.value||todayISO();if(!D.wTouched){D.weight=fcWeight(D.date);wi.value=D.weight??""}}});
  const wi=h("input",{type:"number",inputmode:"decimal",step:"0.1",placeholder:"78,0",value:D.weight??"",onchange:e=>{D.wTouched=true;const v=e.target.value.replace(",",".");D.weight=v===""?null:+v}});
  const note=h("input",{type:"text",placeholder:"z. B. morgens nüchtern",value:D.note||"",oninput:e=>{D.note=e.target.value}});
  return h("div",{class:"pv"},
    h("div",{class:"fc-grid"},tiles),
    h("p",{class:"muted tiny"},"Tippe auf ein Feld: Foto aufnehmen oder aus der Mediathek wählen. Mindestens ein Foto."),
    h("div",{class:"grid2"},h("label",{},"Datum",dt),h("label",{},"Gewicht (kg)",wi)),
    h("label",{style:"margin-top:8px"},"Notiz (optional)",note),
    h("div",{class:"btn-row two"},h("button",{class:"btn",onclick:()=>{FC.draft=null;render()}},"Abbrechen"),
      h("button",{class:"btn primary",onclick:async e=>{if(!Object.keys(D.poses).length){toast("Mindestens ein Foto hinzufügen");return}
        e.target.disabled=true;const c={id:uid(),date:D.date,created:Date.now(),poses:D.poses,weight:D.weight||null,note:(D.note||"").trim()};
        try{await fcPut(c);if(c.weight&&c.date===todayISO()){day(c.date).check.weight??=c.weight;save()}
          try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(x){}
          FC.draft=null;await fcLoad();FC.a=null;FC.b=null;FC.open=c.id;toast("Formcheck gespeichert");
          if(AI.key&&AI.auto!==false)fcAnalyze(c);else render()}
        catch(x){e.target.disabled=false;toast("Speichern fehlgeschlagen: Speicher voll?")}}},"Speichern"+(AI.key&&AI.auto!==false?" und auswerten":""))))}

/* ---------- Vergleich ---------- */
function fcCompare(list){
  const ids=list.map(c=>c.id);
  if(!ids.includes(FC.a))FC.a=list.length>1?list.at(-2).id:list[0].id;
  if(!ids.includes(FC.b))FC.b=list.at(-1).id;
  const A=list.find(c=>c.id===FC.a),B=list.find(c=>c.id===FC.b);
  const sel=(v,on)=>h("select",{onchange:e=>{on(e.target.value);render()}},list.map(c=>h("option",{value:c.id,selected:c.id===v?true:null},fcDate(c.date)+(c.weight?" · "+fmt(c.weight,1)+" kg":""))));
  const days=Math.round((parseD(B.date)-parseD(A.date))/864e5);
  const dW=A.weight&&B.weight?B.weight-A.weight:null;
  return h("div",{},
    h("div",{class:"grid2"},h("label",{},"Vorher",sel(FC.a,v=>FC.a=v)),h("label",{},"Nachher",sel(FC.b,v=>FC.b=v))),
    h("div",{class:"chips"},FC_POSES.map(([p,n])=>h("button",{class:"chip","aria-pressed":FC.pose===p?"true":"false",onclick:()=>{FC.pose=p;render()}},n))),
    h("div",{class:"fc-cmp"},h("figure",{},fcImg(A.poses[FC.pose],"Vorher "+FC_POSE_NAME[FC.pose]),h("figcaption",{class:"tiny muted"},fcDate(A.date))),
      h("figure",{},fcImg(B.poses[FC.pose],"Nachher "+FC_POSE_NAME[FC.pose]),h("figcaption",{class:"tiny muted"},fcDate(B.date)))),
    h("p",{class:"small",style:"margin:6px 0 0"},days>0?days+" Tage dazwischen ("+fmt(days/7,1)+" Wochen)":days<0?"„Vorher“ liegt nach „Nachher“.":"Gleicher Tag.",
      dW!=null?" · Gewicht "+(dW>=0?"+":"−")+fmt(Math.abs(dW),1)+" kg":""))}

/* ---------- Abschnitt im Fortschritt-Tab ---------- */
function formSec(){
  if(!featureOn("formcheck"))return sec("Formcheck",h("span",{class:"pill warn"},"nicht freigeschaltet"),h("p",{class:"muted small"},"Diese Funktion ist für dein Konto nicht freigeschaltet."));
  FC.urls.forEach(u=>URL.revokeObjectURL(u));FC.urls=[];
  if(!window.indexedDB)return sec("Formcheck",null,h("p",{class:"muted small"},"Dieser Browser kann keine Fotos speichern."));
  if(!FC.list){if(!FC.loading)FC.loading=fcLoad().catch(()=>{FC.list=[]}).finally(()=>{FC.loading=null;if(VIEW==="fortschritt")render()});
    return sec("Formcheck",null,h("p",{class:"muted small"},"Lade Fotos …"))}
  const list=FC.list,last=list.at(-1),since=last?Math.round((parseD(todayISO())-parseD(last.date))/864e5):null;
  const s=sec("Formcheck",h("span",{class:"muted tiny"},list.length?list.length+(list.length===1?" Check":" Checks"):"1× pro Woche"));
  if(FC.draft)s.append(fcNewForm());
  else{
    if(since!=null&&since>=7)s.append(h("p",{class:"hint small"},"Letzter Formcheck vor "+since+" Tagen. Zeit für neue Fotos."));
    s.append(h("button",{class:"btn primary wide",style:"margin-top:0",onclick:()=>{FC.draft={date:todayISO(),poses:{},weight:fcWeight(todayISO())};render()}},"Neuer Formcheck"));
  }
  if(!list.length){s.append(h("ul",{class:"list small",style:"margin-top:12px"},
    h("li",{},"Einmal pro Woche, am besten morgens vor dem Frühstück."),
    h("li",{},"Immer gleicher Ort, gleiches Licht, gleicher Abstand. Handy auf Hüfthöhe, Selbstauslöser."),
    h("li",{},"Drei Posen: vorne, seitlich, Rücken. Locker stehen, nicht anspannen."),
    h("li",{},"Die Fotos bleiben nur auf diesem iPhone. Zur KI gehen sie nur, wenn du auswertest.")));return s}
  if(list.length>=2)s.append(h("div",{class:"tiny muted up",style:"margin-top:16px"},"Vergleich"),fcCompare(list));
  s.append(h("div",{class:"tiny muted up",style:"margin-top:16px"},"Alle Formchecks"));
  for(const c of list.slice().reverse()){
    const vd=c.ai?fcVerdict(c.ai.text):null,open=FC.open===c.id;
    const head=h("button",{class:"fc-head",onclick:()=>{FC.open=open?null:c.id;FC.del=null;render()}},
      h("div",{class:"fc-thumbs"},FC_POSES.map(([p,n])=>c.poses[p]?fcImg(c.poses[p],n,"fc-th"):null)),
      h("div",{class:"fc-meta"},h("div",{style:"font-weight:600"},fcDate(c.date)),h("div",{class:"tiny muted"},(c.weight?fmt(c.weight,1)+" kg":"")+(c.note?(c.weight?" · ":"")+c.note:"")),
        FC.busy===c.id?h("span",{class:"pill warn"},"wird ausgewertet …"):vd?h("span",{class:"pill "+vd.cls},vd.v):null));
    const row=h("div",{class:"fc-row"},head);
    if(open){
      row.append(h("div",{class:"fc-full"},FC_POSES.map(([p,n])=>c.poses[p]?h("figure",{},fcImg(c.poses[p],n),h("figcaption",{class:"tiny muted"},n)):null)));
      if(c.ai)row.append(fcAiBlock(c));else if(c.aiErr)row.append(h("p",{class:"small warn-t"},c.aiErr));
      row.append(h("div",{class:"btn-row"},
        h("button",{class:"btn",disabled:FC.busy?true:null,onclick:()=>fcAnalyze(c)},FC.busy===c.id?"Läuft …":c.ai?"Neu auswerten":"Mit KI auswerten"),
        h("button",{class:"btn",onclick:()=>fcShare(c)},"Fotos sichern"),
        h("button",{class:"link danger",onclick:async()=>{if(FC.del!==c.id){FC.del=c.id;render();return}await fcDel(c.id);FC.del=null;FC.open=null;await fcLoad();toast("Formcheck gelöscht");render()}},FC.del===c.id?"Wirklich löschen?":"Löschen")));
      if(!AI.key)row.append(h("p",{class:"muted tiny"},"Für die KI-Auswertung brauchst du einen eigenen API-Schlüssel: Einstellungen › KI-Auswertung."))}
    s.append(row)}
  return s}

async function fcShare(c){const files=FC_POSES.filter(([p])=>c.poses[p]).map(([p,n])=>new File([c.poses[p]],"formcheck-"+c.date+"-"+n.toLowerCase().replace("ü","ue")+".jpg",{type:"image/jpeg"}));
  if(navigator.canShare&&navigator.canShare({files})){navigator.share({files}).catch(()=>{});return}
  for(const f of files){const a=h("a",{href:URL.createObjectURL(f),download:f.name});document.body.append(a);a.click();a.remove()}}

/* ---------- Einstellungen ---------- */
function aiSec(){
  const on=!!AI.key,m=aiModel();
  const k=h("input",{type:"password",placeholder:"sk-ant-…",autocomplete:"off"});
  const ms=h("select",{onchange:e=>{AI.model=e.target.value;saveAI();render()}},Object.entries(AI_MODELS).map(([id,x])=>h("option",{value:id,selected:id===m?true:null},x.name)));
  const mh=h("span",{class:"muted tiny"},AI_MODELS[m].hint);
  const s=sec("KI-Auswertung (Formcheck)",on?h("span",{class:"pill good"},"an"):h("span",{class:"pill warn"},"aus"));
  if(on){s.append(h("p",{class:"small"},"Schlüssel gespeichert (…"+AI.key.slice(-4)+"). Bisher "+(AI.count||0)+" Auswertungen für ca. "+usdTxt(AI.spent||0)+"."),
      h("label",{},"Modell",ms,mh),
      h("label",{class:"inline",style:"margin-top:10px"},h("input",{type:"checkbox",checked:AI.auto!==false?true:null,onchange:e=>{AI.auto=e.target.checked;saveAI()}}),"Neue Formchecks gleich auswerten"),
      h("div",{class:"btn-row"},h("button",{class:"btn",onclick:()=>{delete AI.key;saveAI();toast("Schlüssel gelöscht");render()}},"Schlüssel entfernen")))}
  else{s.append(h("p",{class:"small"},"Die KI vergleicht deine Formcheck-Fotos und sagt, ob Fortschritt sichtbar ist. Dafür brauchst du einen eigenen Schlüssel für die Claude-API. Achtung: Das Guthaben oder Abo in der Claude-App zählt hier nicht, die API hat ein eigenes Guthaben."),
      h("ol",{class:"list small"},
        h("li",{},"Öffne ",h("a",{href:"https://console.anthropic.com/",target:"_blank",rel:"noopener"},"console.anthropic.com")," und melde dich an (gleiche E-Mail wie bei Claude geht)."),
        h("li",{},"Unter „Billing“ Guthaben kaufen. Das Minimum sind etwa 5 $, das reicht bei einer Auswertung pro Woche für Jahre."),
        h("li",{},"Unter „Limits“ ein Monatslimit setzen, z. B. 2 $. Dann kann nie mehr abgebucht werden."),
        h("li",{},"Unter „API Keys“ auf „Create Key“, den Schlüssel (sk-ant-…) kopieren und hier einfügen.")),
      h("label",{},"API-Schlüssel",k),h("label",{style:"margin-top:8px"},"Modell",ms,mh),
      h("button",{class:"btn primary wide",onclick:()=>{const v=k.value.trim();if(!/^sk-ant-/.test(v)){toast("Das sieht nicht nach einem Claude-API-Schlüssel aus");return}AI.key=v;saveAI();toast("Schlüssel gespeichert");render()}},"Speichern"))}
  s.append(h("p",{class:"muted tiny"},"Der Schlüssel bleibt nur auf diesem Gerät (nicht im Sync, nicht im Backup). Fotos gehen nur an Anthropic, wenn du „auswerten“ tippst, verkleinert auf 800 Pixel. Laut Anthropic werden API-Daten nicht zum Training genutzt. Die Fotos selbst liegen nur auf diesem iPhone und sind nicht im Backup: sichere sie bei Bedarf mit „Fotos sichern“."));
  return s}
