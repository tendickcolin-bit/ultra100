"use strict";
/* ================= Konten über Supabase (kostenloser Tarif) =================
   Ohne Eintrag in config.js: ACCT = null, die App läuft wie bisher nur auf dem Gerät.
   Mit Eintrag: Anmeldung nötig. Jedes Konto hat eigene Daten (localStorage-Schlüssel je Konto + Cloud-Zeile),
   die Datenbank lässt per Row Level Security nur das eigene Konto an die eigenen Daten. */
(function(){
const C=window.U100_CLOUD||{};const ON=!!(C.url&&C.key);
const AKEY="ultra100.auth",PKEY="ultra100.profile",LEGACY="ultra100.v2",MIGR="ultra100.v2.migrated";
const base=ON?C.url.replace(/\/+$/,""):"";
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
let SESS=ON?ls.get(AKEY):null;

async function call(path,{method="GET",body,token,headers={}}={}){
  const r=await fetch(base+path,{method,cache:"no-store",headers:{apikey:C.key,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...headers},body:body==null?undefined:JSON.stringify(body)});
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok){const m=(j&&(j.msg||j.message||j.error_description||j.error))||("Fehler "+r.status);const e=new Error(de(m));e.status=r.status;throw e}
  return j}
function de(m){m=String(m);
  if(/invalid login credentials/i.test(m))return"E-Mail oder Passwort falsch.";
  if(/email not confirmed/i.test(m))return"Bitte bestätige zuerst deine E-Mail (Link im Postfach).";
  if(/already registered|already exists/i.test(m))return"Für diese E-Mail gibt es schon ein Konto. Melde dich an.";
  if(/password should be at least|weak/i.test(m))return"Das Passwort ist zu kurz (mindestens 6 Zeichen, besser 10).";
  if(/rate limit|too many/i.test(m))return"Zu viele Versuche. Warte ein paar Minuten.";
  if(/unable to validate email|invalid format/i.test(m))return"Die E-Mail-Adresse stimmt nicht.";
  if(/row-level security|permission denied/i.test(m))return"Dein Konto ist noch nicht freigeschaltet.";
  return m}
function keep(s){SESS={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),user:{id:s.user.id,email:s.user.email}};ls.set(AKEY,SESS)}
let refreshing=null;
async function token(){
  if(!SESS)throw new Error("Nicht angemeldet");
  if(SESS.expires_at-60>Date.now()/1000)return SESS.access_token;
  if(!refreshing)refreshing=call("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:SESS.refresh_token}})
    .then(s=>{keep(s);return SESS.access_token})
    .catch(e=>{if(e.status===400||e.status===401){ls.del(AKEY);SESS=null;location.reload()}throw e})
    .finally(()=>{refreshing=null});
  return refreshing}
async function api(path,opt={}){return call("/rest/v1"+path,{...opt,token:await token()})}

/* ---------- öffentliche Schnittstelle für app.js ---------- */
const uid=SESS&&SESS.user.id;
window.ACCT=ON&&SESS?{uid,email:SESS.user.email,key:"ultra100.u."+uid,profile:(ls.get(PKEY)||{})[uid]||null}:null;
window.Cloud={on:ON,api,token,
  async profile(){const r=await api("/profiles?id=eq."+uid+"&select=*");const p=r&&r[0]||null;if(p){const all=ls.get(PKEY)||{};all[uid]=p;ls.set(PKEY,all);ACCT.profile=p}return p},
  async load(){const r=await api("/user_state?user_id=eq."+uid+"&select=data,updated_at");return r&&r[0]||null},
  async store(data){return api("/user_state",{method:"POST",body:{user_id:uid,data,updated_at:new Date().toISOString()},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}})},
  async users(){return api("/profiles?select=*&order=created_at.asc")},
  async setUser(id,patch){return api("/profiles?id=eq."+id,{method:"PATCH",body:patch,headers:{Prefer:"return=minimal"}})},
  async setName(n){return api("/rpc/set_my_name",{method:"POST",body:{n}})},
  async setPassword(password){return call("/auth/v1/user",{method:"PUT",body:{password},token:await token()})},
  async deleteMe(){await api("/rpc/delete_me",{method:"POST",body:{}});this.logout(true)},
  logout(wipe){const t=SESS&&SESS.access_token;if(t)fetch(base+"/auth/v1/logout",{method:"POST",headers:{apikey:C.key,Authorization:"Bearer "+t}}).catch(()=>{});
    if(wipe&&ACCT){ls.del(ACCT.key);ls.del("ultra100.sync."+uid)}ls.del(AKEY);SESS=null;location.reload()}
};
if(!ON)return;

/* ---------- Links aus E-Mails (Bestätigung, Passwort zurücksetzen) ---------- */
const hp=new URLSearchParams(location.hash.slice(1));
const linkType=hp.get("type"),linkTok=hp.get("access_token");
if(hp.get("error_description")){history.replaceState(null,"",location.pathname+location.search);setTimeout(()=>alertBox(de(hp.get("error_description"))),0)}

if(SESS&&!linkTok)return; // angemeldet: App normal starten
window.AUTH_GATE=true;     // app.js startet erst nach der Anmeldung

/* ---------- Anmeldebildschirm ---------- */
const css=`#auth{max-width:420px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 40px) 20px 40px}
#auth h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}#auth .sub{color:var(--muted);margin:0 0 24px;font-size:15px}
#auth form{display:flex;flex-direction:column;gap:12px}#auth .err{color:var(--bad);font-size:14px;min-height:1em}#auth .ok{color:var(--good);font-size:14px}
#auth .tabs2{display:flex;gap:6px;margin-bottom:18px}#auth .tabs2 button{flex:1}
#auth .box{background:var(--soft);border-radius:12px;padding:12px 14px;font-size:14px;margin:12px 0}`;
document.head.append(Object.assign(document.createElement("style"),{textContent:css}));
const wrap=document.querySelector(".wrap"),nav=document.querySelector("nav.tabs");if(wrap)wrap.hidden=true;if(nav)nav.hidden=true;
const root=document.createElement("div");root.id="auth";document.body.prepend(root);
function el(tag,attrs={},...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(v==null||v===false)continue;if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat())if(c!=null&&c!==false)e.append(c.nodeType?c:document.createTextNode(String(c)));return e}
function alertBox(msg){const e=root.querySelector(".err");if(e)e.textContent=msg}
const field=(label,attrs)=>{const i=el("input",attrs);return[el("label",{},label,i),i]};

let MODE="login";
function screen(){
  root.replaceChildren();
  root.append(el("h1",{},"Ultra 100"),el("p",{class:"sub"},"Ernährung und Training. Jedes Konto hat seine eigenen Daten."));
  root.append(el("div",{class:"tabs2"},
    el("button",{class:"chip","aria-pressed":MODE==="login"?"true":"false",onclick:()=>{MODE="login";screen()}},"Anmelden"),
    el("button",{class:"chip","aria-pressed":MODE==="signup"?"true":"false",onclick:()=>{MODE="signup";screen()}},"Registrieren")));
  const err=el("div",{class:"err"});
  const [lN,iN]=field("Vorname",{type:"text",autocomplete:"given-name",maxlength:"40"});
  const [lE,iE]=field("E-Mail",{type:"email",autocomplete:"email",inputmode:"email",autocapitalize:"off",required:true});
  const [lP,iP]=field("Passwort",{type:"password",autocomplete:MODE==="signup"?"new-password":"current-password",minlength:"6",required:true});
  const btn=el("button",{class:"btn primary wide",type:"submit"},MODE==="signup"?"Konto erstellen":"Anmelden");
  const f=el("form",{onsubmit:async e=>{e.preventDefault();err.textContent="";btn.disabled=true;
    try{const email=iE.value.trim().toLowerCase(),password=iP.value;
      if(MODE==="signup"){
        const r=await call("/auth/v1/signup?redirect_to="+encodeURIComponent(location.origin+location.pathname),{method:"POST",body:{email,password,data:{name:iN.value.trim()}}});
        if(r&&r.access_token){keep(r);return after()}
        root.replaceChildren(el("h1",{},"Fast geschafft"),el("p",{class:"sub"},"Wir haben dir eine E-Mail an "+email+" geschickt. Tippe auf den Link darin, dann bist du angemeldet."),
          el("button",{class:"btn wide",onclick:()=>{MODE="login";screen()}},"Zur Anmeldung"));return}
      const s=await call("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password}});keep(s);await after();
    }catch(x){err.textContent=x.message||"Keine Verbindung"}finally{btn.disabled=false}}},
    MODE==="signup"?lN:null,lE,lP,err,btn);
  root.append(f);
  if(MODE==="login")root.append(el("button",{class:"link",onclick:async()=>{const email=iE.value.trim();if(!email){err.textContent="Trag oben deine E-Mail ein, dann tippe nochmal hier.";return}
    try{await call("/auth/v1/recover?redirect_to="+encodeURIComponent(location.origin+location.pathname),{method:"POST",body:{email}});err.textContent="";root.append(el("p",{class:"ok"},"Falls es ein Konto gibt, kommt gleich eine E-Mail mit einem Link zum Zurücksetzen."))}catch(x){err.textContent=x.message}}},"Passwort vergessen?"));
  root.append(el("p",{class:"muted tiny",style:"margin-top:24px"},"Deine Daten liegen bei Supabase und werden verschlüsselt übertragen. Niemand sonst sieht sie, auch der Admin nicht. Formcheck-Fotos bleiben nur auf deinem Gerät."));
}

/* Nach dem Link aus der Passwort-E-Mail: neues Passwort setzen */
function recoverScreen(){
  root.replaceChildren(el("h1",{},"Neues Passwort"));
  const [lP,iP]=field("Neues Passwort",{type:"password",autocomplete:"new-password",minlength:"6",required:true});const err=el("div",{class:"err"});
  root.append(el("form",{onsubmit:async e=>{e.preventDefault();try{await Cloud.setPassword(iP.value);await after()}catch(x){err.textContent=x.message}}},lP,err,el("button",{class:"btn primary wide",type:"submit"},"Speichern")))}

/* Nach der Anmeldung: Daten für dieses Konto auf dem Gerät vorbereiten, dann App starten */
async function after(){
  const id=SESS.user.id,key="ultra100.u."+id;
  root.replaceChildren(el("h1",{},"Einen Moment"),el("p",{class:"sub"},"Lade deine Daten …"));
  if(localStorage.getItem(key))return location.replace(location.pathname);
  let cloud=null;try{const r=await call("/rest/v1/user_state?user_id=eq."+id+"&select=data",{token:SESS.access_token});cloud=r&&r[0]&&r[0].data||null}catch(e){}
  let legacy=null;if(!localStorage.getItem(MIGR)){try{legacy=JSON.parse(localStorage.getItem(LEGACY))}catch(e){}}
  const nDays=legacy&&legacy.days?Object.keys(legacy.days).length:0;
  if(nDays>0)return migrateScreen(legacy,cloud,key,nDays);
  if(cloud)localStorage.setItem(key,JSON.stringify(cloud));
  location.replace(location.pathname)}

function migrateScreen(legacy,cloud,key,nDays){
  const first=Object.keys(legacy.days).sort()[0];const [y,m,d]=first.split("-");
  root.replaceChildren(el("h1",{},"Daten übernehmen?"),
    el("p",{class:"sub"},"Auf diesem Gerät liegen schon Einträge von "+nDays+" Tagen (seit "+(+d)+"."+(+m)+"."+y+"), angelegt ohne Konto."),
    el("div",{class:"box"},"Gehören sie dir ("+SESS.user.email+")? Dann übernehme ich sie in dein Konto"+(cloud?" und führe sie mit den Daten aus deinem Konto zusammen":"")+". Vorher sicherst du ein Backup als Datei. Die alten Daten bleiben außerdem unverändert auf dem Gerät liegen."),
    el("button",{class:"btn primary wide",onclick:()=>{
      const blob=new Blob([JSON.stringify(legacy)],{type:"application/json"});const f=new File([blob],"ultra100-backup-vor-konto.json",{type:"application/json"});
      const go=()=>{const s=JSON.parse(JSON.stringify(legacy));s.settings=s.settings||{};s.settings.onboarded=true;s.settings.u=Date.now();
        localStorage.setItem(key,JSON.stringify(s));localStorage.setItem(MIGR,JSON.stringify(SESS.user.id));location.replace(location.pathname)};
      if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f]}).then(go,go);
      else{const a=el("a",{href:URL.createObjectURL(blob),download:f.name});document.body.append(a);a.click();a.remove();setTimeout(go,600)}}},"Backup sichern und übernehmen"),
    el("button",{class:"btn wide",onclick:()=>{if(cloud)localStorage.setItem(key,JSON.stringify(cloud));location.replace(location.pathname)}},"Nein, nicht meine Daten"),
    el("p",{class:"muted tiny",style:"margin-top:16px"},"„Nein“ lässt die alten Daten unberührt. Dieses Konto startet dann leer."))}

if(linkTok){
  history.replaceState(null,"",location.pathname+location.search);
  const exp=+hp.get("expires_at")||Math.floor(Date.now()/1000)+(+hp.get("expires_in")||3600);
  call("/auth/v1/user",{token:linkTok}).then(u=>{keep({access_token:linkTok,refresh_token:hp.get("refresh_token"),expires_at:exp,user:u});
    if(linkType==="recovery")recoverScreen();else after()}).catch(e=>{screen();alertBox(e.message)});
}else screen();
})();
