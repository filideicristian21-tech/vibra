'use strict';
const D=window.VIBRA_DATA,P={},V={};D.personas.forEach(p=>P[p.h]=p);D.videos.forEach(v=>V[v.id]=v);
const $=s=>document.querySelector(s),view=$('#view');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ---------- stato locale ----------
const K='vibra.v1';
const S=Object.assign({onb:false,interests:[],likes:{},saves:{},follow:{},hidden:{},blocked:{},reported:{},notint:{},tagw:{},comments:{},dms:{},name:'',bio:'',breakOn:true,lastCreator:''},JSON.parse(localStorage.getItem(K)||'{}'));
const save=()=>localStorage.setItem(K,JSON.stringify(S));
let sound=false,feedMode='perte',tab='home';
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2200)};
// ---------- filtro parole ----------
const BAD=['cazz','stronz','vaffa','puttan','troia','merd','coglion','frocio','negro','ritardat','bastard','fuck','shit','bitch','cunt','nigg','fag','whore','retard','porco dio','dio cane','zoccol','mignott'];
function filterText(t){
  t=String(t||'').slice(0,300);
  if(/https?:\/\/|www\.|\.(com|it|net|org)\b/i.test(t))return{ok:false,why:'Niente link, per sicurezza.'};
  if(/[\w.+-]+@[\w-]+\.\w+/.test(t))return{ok:false,why:'Niente indirizzi email.'};
  if(/(\+?\d[\s-]?){8,}/.test(t))return{ok:false,why:'Niente numeri di telefono.'};
  const l=t.toLowerCase();if(BAD.some(w=>l.includes(w)))return{ok:false,why:'Questo testo contiene parole non consentite.'};
  return{ok:true,t:t.trim()};
}
// ---------- avatar / badge ----------
const IA='<span class="ia" title="Personaggio generato con intelligenza artificiale">IA</span>';
const av=(p,big)=>`<div class="av${big?' big':''}" style="background:linear-gradient(135deg,${p.g[0]},${p.g[1]})">${p.e}${IA}</div>`;
const meAv=big=>`<div class="av${big?' big':''}" style="background:linear-gradient(135deg,#C6F432,#9B8CFF)">${esc((S.name||'Tu').slice(0,1).toUpperCase())}</div>`;
const visible=p=>!S.blocked[p.h];
// ---------- IndexedDB (upload solo locale) ----------
const idb=new Promise((res,rej)=>{const r=indexedDB.open('vibra-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('uploads',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const dbAll=async()=>{const db=await idb;return new Promise(r=>{const q=db.transaction('uploads').objectStore('uploads').getAll();q.onsuccess=()=>r(q.result||[])})};
const dbPut=async o=>{const db=await idb;return new Promise(r=>{const t=db.transaction('uploads','readwrite');t.objectStore('uploads').put(o);t.oncomplete=r})};
const dbDel=async id=>{const db=await idb;return new Promise(r=>{const t=db.transaction('uploads','readwrite');id?t.objectStore('uploads').delete(id):t.objectStore('uploads').clear();t.oncomplete=r})};
// ---------- algoritmo "Per te" simulato ----------
function score(v){let s=0;v.tags.forEach(t=>{s+=(S.tagw[t]||0)+(S.interests.includes(t)?6:0)});return s-(S.notint[v.by]||0)*20}
function buildFeed(){
  let pool=D.videos.filter(v=>!S.hidden[v.id]&&!S.blocked[v.by]&&!S.reported[v.id]);
  if(feedMode==='seguiti')pool=pool.filter(v=>S.follow[v.by]);
  const ranked=pool.map(v=>({v,s:score(v)+Math.random()*4})).sort((a,b)=>b.s-a.s).map(x=>x.v);
  // 25% casuale
  const out=[],rest=ranked.slice();
  while(rest.length){let i=Math.random()<.25?Math.floor(Math.random()*rest.length):0;
    let last=out.length?out[out.length-1].by:S.lastCreator;
    if(rest[i].by===last){const j=rest.findIndex(x=>x.by!==last);if(j>=0)i=j}
    out.push(rest.splice(i,1)[0])}
  return out;
}
function learn(v,sec,done){v.tags.forEach(t=>S.tagw[t]=Math.min(50,(S.tagw[t]||0)+sec*.3+(done?2:0)));save()}
// ---------- feed ----------
let io,curVid=null,watchStart=0;
function railBtn(act,ico,lab,on){return`<button data-a="${act}" class="${on?'on':''}"><b>${ico}</b>${lab}</button>`}
function clipHTML(v){const p=P[v.by];
  return`<section class="clip" data-id="${v.id}"><video data-src="${v.src}" data-poster="${v.poster}" muted loop playsinline preload="none"></video><div class="shade"></div><div class="prog"></div>
  <div class="info"><div class="who" data-a="prof">@${esc(p.h)} ${IA} <span style="opacity:.7;font-weight:500">· ${esc(p.n)}</span></div>
  <div class="cap">${esc(v.cap)} ${v.tags.map(t=>`<span class="tag" data-tag="${t}">#${t}</span>`).join('')}</div>
  <div class="snd" data-a="credit">🎥 ${esc(v.credit.author.slice(0,40))} · ${esc(v.credit.lic)} · Wikimedia Commons · tagliato da VIBRA</div></div>
  <div class="rail"><button data-a="prof">${av(p)}</button>
  ${railBtn('like','♥',S.likes[v.id]?'Ti piace':'Mi piace',S.likes[v.id])}
  ${railBtn('com','💬','Commenta')}${railBtn('save','🔖',S.saves[v.id]?'Salvato':'Salva',S.saves[v.id])}${railBtn('share','↗','Condividi')}${railBtn('more','⋯','Altro')}</div></section>`}
function renderHome(){
  $('#top').classList.remove('hide');
  const list=buildFeed();
  if(!list.length){view.innerHTML=`<div class="page"><div class="empty">${feedMode==='seguiti'?'Qui vedrai i video di chi segui. Inizia da qualcuno che ti piace nei Per te.<br><br><button class="btn" id="goPT">Vai ai Per te</button>':'Hai nascosto tutto! Cancella i dati per ricominciare.'}</div></div>`;const g=$('#goPT');if(g)g.onclick=()=>setFeed('perte');return}
  view.innerHTML=`<div class="feed" id="feed">${list.map(clipHTML).join('')}<section class="clip" style="display:grid;place-items:center;text-align:center;padding:30px"><div><h2>Hai visto tutto 🎉</h2><p class="note" style="margin:10px 0 16px">Per ora i video sono finiti. Torna più tardi o scopri altri creator.</p><button class="btn" id="again">Ricomincia</button> <button class="btn alt" data-goto="scopri">Scopri</button></div></section></div>`;
  $('#again').onclick=renderHome;
  const feed=$('#feed');io&&io.disconnect();
  io=new IntersectionObserver(es=>es.forEach(e=>{const vd=e.target.querySelector('video');if(!vd)return;
    if(e.isIntersecting&&e.intersectionRatio>.6){activate(e.target,vd)}else{if(!vd.paused){vd.pause();endWatch(e.target,vd)}}}),{root:feed,threshold:[0,.6,1]});
  feed.querySelectorAll('.clip').forEach(c=>io.observe(c));const f0=feed.querySelector('.clip');if(f0)windowAround(f0);
  feed.onclick=onFeedClick;feed.ondblclick=e=>{const c=e.target.closest('.clip');if(c&&c.dataset.id&&!e.target.closest('.rail,.info')){doLike(c,true);heart(c)}};
}
function loadClip(c,pre){const vd=c&&c.querySelector('video');if(!vd||vd.getAttribute('src'))return;vd.poster=vd.dataset.poster;vd.preload=pre||'auto';vd.src=vd.dataset.src}
function unloadClip(c){const vd=c&&c.querySelector('video');if(!vd||!vd.getAttribute('src'))return;vd.pause();vd.removeAttribute('src');vd.load()}
function windowAround(c){const all=[...c.parentNode.children],i=all.indexOf(c);all.forEach((x,j)=>{if(j>=i-1&&j<=i+2)loadClip(x,j===i?'auto':'auto');else if(Math.abs(j-i)>4)unloadClip(x)})}
function activate(c,vd){windowAround(c);vd.muted=!sound;vd.play().catch(()=>{});curVid=c.dataset.id;watchStart=Date.now();S.lastCreator=V[curVid].by;
  const pr=c.querySelector('.prog');vd.ontimeupdate=()=>{pr.style.width=(vd.currentTime/(vd.duration||1)*100)+'%'}}
function endWatch(c,vd){const v=V[c.dataset.id];if(!v)return;const sec=(Date.now()-watchStart)/1000;learn(v,Math.min(sec,20),sec>(vd.duration||9)*.9)}
let tapT=0;
function onFeedClick(e){const c=e.target.closest('.clip');if(!c||!c.dataset.id)return;const v=V[c.dataset.id];
  const tg=e.target.closest('[data-tag]');if(tg){openTag(tg.dataset.tag);return}
  const b=e.target.closest('[data-a]');
  if(!b){const vd=c.querySelector('video');clearTimeout(tapT);tapT=setTimeout(()=>{if(vd.paused)vd.play();else vd.pause()},230);return}
  const a=b.dataset.a;
  if(a==='prof')openProfile(v.by);if(a==='like')doLike(c);if(a==='com')openComments(v);if(a==='save'){S.saves[v.id]=!S.saves[v.id];if(!S.saves[v.id])delete S.saves[v.id];save();b.classList.toggle('on');b.lastChild.textContent=S.saves[v.id]?'Salvato':'Salva';toast(S.saves[v.id]?'Salvato per dopo':'Rimosso dai salvati')}
  if(a==='share')share(v);if(a==='more')openMore(v);if(a==='credit')openCredits();
}
function doLike(c,force){const id=c.dataset.id;if(force&&S.likes[id])return;S.likes[id]=!S.likes[id];if(!S.likes[id])delete S.likes[id];save();const b=c.querySelector('[data-a=like]');b.classList.toggle('on',!!S.likes[id]);b.lastChild.textContent=S.likes[id]?'Ti piace':'Mi piace';if(S.likes[id])V[id].tags.forEach(t=>S.tagw[t]=(S.tagw[t]||0)+3)}
function heart(c){c.insertAdjacentHTML('beforeend','<div class="heart">💚</div>');setTimeout(()=>{const h=c.querySelector('.heart');h&&h.remove()},900)}
function setSound(on){sound=on;$('#sndBtn').textContent=on?'🔊':'🔇';document.querySelectorAll('.clip video').forEach(v=>v.muted=!on)}
async function share(v){const url=location.href.split('#')[0]+'#v='+v.id,txt='Guarda questo video su VIBRA (demo con personaggi IA)';
  try{if(navigator.share){await navigator.share({title:'VIBRA',text:txt,url});return}await navigator.clipboard.writeText(url);toast('Link copiato')}catch(e){}}
// ---------- sheet & modal ----------
function sheet(title,body,foot){const s=$('#sheet');s.innerHTML=`<div class="hd"><span>${title}</span><button id="shX" aria-label="Chiudi">✕</button></div><div class="bd">${body}</div>${foot?`<div class="ft">${foot}</div>`:''}`;s.classList.add('open');$('#shX').onclick=closeSheet;return s}
const closeSheet=()=>$('#sheet').classList.remove('open');
function modal(html){const m=$('#modal');m.innerHTML=`<div class="box">${html}</div>`;m.classList.add('open');return m}
const closeModal=()=>$('#modal').classList.remove('open');
function openComments(v){
  const mine=(S.comments[v.id]||[]);
  const list=()=>v.comments.filter(c=>!S.blocked[c.by]).map(c=>{const p=P[c.by];return`<div class="row">${av(p)}<div class="grow"><b>@${p.h}</b> ${IA}<div class="note" style="color:#eee">${esc(c.t)}</div><small>Commento demo generato con IA</small></div></div>`}).join('')+
    mine.map((c,i)=>`<div class="row">${meAv()}<div class="grow"><b>${esc(S.name||'Tu')}</b><div class="note" style="color:#eee">${esc(c)}</div><small>Resta solo sul tuo telefono</small></div><button data-del="${i}">🗑</button></div>`).join('');
  const s=sheet('Commenti',list(),`<input id="cIn" maxlength="200" placeholder="Scrivi un commento (resta solo sul tuo telefono)"><button class="btn" id="cGo">Invia</button>`);
  const bd=s.querySelector('.bd');
  bd.onclick=e=>{const d=e.target.closest('[data-del]');if(d){mine.splice(+d.dataset.del,1);S.comments[v.id]=mine;save();bd.innerHTML=list()}};
  $('#cGo').onclick=()=>{const r=filterText($('#cIn').value);if(!r.ok)return toast(r.why);if(!r.t)return;mine.push(r.t);S.comments[v.id]=mine;save();$('#cIn').value='';bd.innerHTML=list();bd.scrollTop=1e5};
}
function openMore(v){const p=P[v.by];
  const s=sheet('Opzioni',`<button class="btn alt w" data-o="ni">Meno video così</button><button class="btn alt w" data-o="hide">Nascondi questo video</button><button class="btn alt w" data-o="block">Blocca @${p.h}</button><button class="btn w" data-o="rep">Segnala</button><button class="btn alt w" data-o="cred">Fonte e licenza del video</button>`);
  s.querySelector('.bd').onclick=e=>{const o=e.target.dataset.o;if(!o)return;closeSheet();
    if(o==='ni'){S.notint[v.by]=(S.notint[v.by]||0)+1;v.tags.forEach(t=>S.tagw[t]=(S.tagw[t]||0)-8);save();toast('Ok, ne vedrai meno')}
    if(o==='hide'){S.hidden[v.id]=1;save();toast('Video nascosto');rerender()}
    if(o==='block'){S.blocked[v.by]=1;save();toast('Profilo bloccato');rerender()}
    if(o==='rep')openReport(()=>{S.reported[v.id]=1;save();rerender()});
    if(o==='cred')showCredit(v)};
}
function openReport(done){const m=modal(`<h2>Segnala</h2><p>Perché lo segnali?</p><div class="chips">${['Contenuto offensivo','Spam','Violenza o pericolo','Sembra una persona reale','Altro'].map(x=>`<button class="chip">${x}</button>`).join('')}</div><p class="note">La segnalazione resta su questo dispositivo: l'app non ha server. Il contenuto viene nascosto subito.</p><button class="btn alt w" id="mX">Annulla</button>`);
  m.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{done();m.querySelector('.box').innerHTML=`<h2>Grazie.</h2><p>Questo contenuto non verrà più mostrato.</p><button class="btn w" id="mX">Ok</button>`;$('#mX').onclick=closeModal});$('#mX').onclick=closeModal}
function showCredit(v){const c=v.credit;modal(`<h2>Fonte del video</h2><p><b>${esc(c.title)}</b></p><p>Autore: ${esc(c.author)}</p><p>Licenza: ${c.licurl?`<a href="${c.licurl}" target="_blank" rel="noopener">${esc(c.lic)}</a>`:esc(c.lic)}</p><p><a href="${c.page}" target="_blank" rel="noopener">Pagina su Wikimedia Commons</a></p><p class="note"><b>Tagliato da VIBRA:</b> clip accorciata, ritagliata in verticale, ricompressa e senza audio. Le clip da opere CC BY-SA restano sotto CC BY-SA. Le persone eventualmente visibili sono scene di repertorio, non i personaggi IA.</p><button class="btn w" id="mX">Chiudi</button>`);$('#mX').onclick=closeModal}
function rerender(){go(tab,true)}
// ---------- profilo persona ----------
function openProfile(h){const p=P[h];tab='prof';stopVideos();$('#top').classList.add('hide');
  const vids=D.videos.filter(v=>v.by===h&&!S.hidden[v.id]);
  const lk=vids.filter(v=>S.likes[v.id]).length;
  view.innerHTML=`<div class="page"><button class="btn alt" id="back">← Indietro</button><div class="prof" style="margin-top:14px">${av(p,1)}<h2>${esc(p.n)} ${IA}</h2><div style="color:var(--mu)">@${p.h} · ${esc(p.cat)}</div>
  <div class="stats"><div><b>${S.follow[h]?1:0}</b>follower</div><div><b>${vids.length}</b>video</div><div><b>${lk}</b>tuoi like</div></div>
  <p class="bio"><span class="fixed">Profilo generato con intelligenza artificiale.</span><br>${esc(p.bio)}</p>
  <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">${S.blocked[h]?`<button class="btn" id="unb">Sblocca</button>`:`<button class="btn ${S.follow[h]?'alt':''}" id="fol">${S.follow[h]?'Segui già ✓':'Segui'}</button><button class="btn alt" id="dm">Messaggio</button><button class="btn alt" id="pm">⋯</button>`}</div>
  <p class="note" style="margin-top:10px">I numeri sono solo le tue azioni su questo telefono: niente contatori finti.</p></div>
  <div class="grid">${S.blocked[h]?'':vids.map(v=>`<div class="cell" data-v="${v.id}" ><img loading="lazy" decoding="async" src="${v.poster}" alt=""><span>▶ ${S.likes[v.id]?'💚':''}</span></div>`).join('')}</div></div>`;
  $('#back').onclick=()=>go('home');
  const f=$('#fol');if(f)f.onclick=()=>{S.follow[h]=!S.follow[h];if(!S.follow[h])delete S.follow[h];save();toast(S.follow[h]?`Fatto! I nuovi video di @${h} li trovi nei Seguiti.`:'Non segui più');openProfile(h)};
  const u=$('#unb');if(u)u.onclick=()=>{delete S.blocked[h];save();openProfile(h)};
  const d=$('#dm');if(d)d.onclick=()=>openChat(h);
  const pm=$('#pm');if(pm)pm.onclick=()=>{const s=sheet('Profilo',`<button class="btn alt w" data-o="block">Blocca @${h}</button><button class="btn w" data-o="rep">Segnala profilo</button>`);s.querySelector('.bd').onclick=e=>{const o=e.target.dataset.o;if(!o)return;closeSheet();if(o==='block'){S.blocked[h]=1;delete S.follow[h];save();toast('Profilo bloccato');openProfile(h)}else openReport(()=>{S.blocked[h]=1;save();openProfile(h)})}};
  view.querySelector('.grid').onclick=e=>{const c=e.target.closest('[data-v]');if(c)playSingle(V[c.dataset.v])};
}
function playSingle(v){stopVideos();$('#top').classList.add('hide');view.innerHTML=`<div class="feed" id="feed">${clipHTML(v)}</div><button class="btn alt" id="back" style="position:absolute;top:calc(12px + env(safe-area-inset-top));left:12px;z-index:5">←</button>`;
  const c=view.querySelector('.clip');loadClip(c);const vd=c.querySelector('video');activate(c,vd);$('#feed').onclick=onFeedClick;$('#back').onclick=()=>openProfile(v.by)}
// ---------- scopri / tendenze / ricerca ----------
function tagCounts(){const m={};D.videos.forEach(v=>{if(!S.hidden[v.id]&&!S.blocked[v.by])v.tags.forEach(t=>m[t]=(m[t]||0)+1)});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function renderScopri(q){$('#top').classList.add('hide');
  view.innerHTML=`<div class="page"><h1 class="pt">Scopri</h1><input id="q" type="search" placeholder="Cerca creator, hashtag, video…" value="${esc(q||'')}"><div id="res"></div></div>`;
  const draw=()=>{const s=$('#q').value.trim().toLowerCase().replace(/^#/,'');const r=$('#res');
    if(!s){r.innerHTML=`<h3>🔥 Tendenze di oggi</h3><p class="note">Classifica in base ai video presenti nella demo.</p>${tagCounts().slice(0,8).map(([t,n],i)=>`<div class="trend" data-tag="${t}"><span><b>#${t}</b><br><small class="note">${n} video</small></span><span style="font-size:22px">${i<3?['🥇','🥈','🥉'][i]:'›'}</span></div>`).join('')}
      <h3>Creator IA</h3>${D.personas.filter(visible).map(p=>`<div class="row" data-h="${p.h}">${av(p)}<div class="grow"><b>${esc(p.n)}</b> ${IA}<small>@${p.h} · ${esc(p.cat)}</small></div>›</div>`).join('')}`;return}
    const ps=D.personas.filter(p=>visible(p)&&(p.h+p.n+p.cat).toLowerCase().includes(s));
    const vs=D.videos.filter(v=>!S.hidden[v.id]&&!S.blocked[v.by]&&(v.cap+v.tags.join(' ')).toLowerCase().includes(s));
    const ts=tagCounts().filter(([t])=>t.includes(s));
    r.innerHTML=(!ps.length&&!vs.length&&!ts.length)?`<div class="empty">Nessun risultato per «${esc(s)}». Prova con un'altra parola o guarda cosa va di moda.<br><br><button class="btn" id="clr">Tendenze</button></div>`:
      `${ts.length?`<h3>Hashtag</h3><div class="chips">${ts.map(([t])=>`<button class="chip" data-tag="${t}">#${t}</button>`).join('')}</div>`:''}${ps.length?`<h3>Creator</h3>${ps.map(p=>`<div class="row" data-h="${p.h}">${av(p)}<div class="grow"><b>${esc(p.n)}</b> ${IA}<small>@${p.h}</small></div></div>`).join('')}`:''}${vs.length?`<h3>Video</h3><div class="grid">${vs.map(v=>`<div class="cell" data-v="${v.id}" ><img loading="lazy" decoding="async" src="${v.poster}" alt=""><span>@${v.by}</span></div>`).join('')}</div>`:''}`;
    const c=$('#clr');if(c)c.onclick=()=>{$('#q').value='';draw()}};
  $('#q').oninput=draw;draw();
  $('#res').onclick=e=>{const t=e.target.closest('[data-tag]'),h=e.target.closest('[data-h]'),v=e.target.closest('[data-v]');if(t)openTag(t.dataset.tag);else if(h)openProfile(h.dataset.h);else if(v)playSingle(V[v.dataset.v])};
}
function openTag(t){tab='tag';stopVideos();$('#top').classList.add('hide');const vs=D.videos.filter(v=>v.tags.includes(t)&&!S.hidden[v.id]&&!S.blocked[v.by]);
  view.innerHTML=`<div class="page"><button class="btn alt" id="back">← Scopri</button><h1 class="pt" style="margin-top:12px;color:var(--li)">#${esc(t)}</h1><p class="note">${vs.length} video nella demo</p><div class="grid">${vs.map(v=>`<div class="cell" data-v="${v.id}" ><img loading="lazy" decoding="async" src="${v.poster}" alt=""><span>@${v.by}</span></div>`).join('')}</div></div>`;
  $('#back').onclick=()=>go('scopri');view.querySelector('.grid').onclick=e=>{const c=e.target.closest('[data-v]');if(c)playSingle(V[c.dataset.v])}}
// ---------- DM ----------
const R={
 saluto:["Ciao{n}! 🤖 Sono l'IA di questo profilo e rispondo in automatico. Come va?","Ehi, ciao! Qui risponde un'IA 🤖. Grazie per avermi scritto!","Ciao! 👋 Sono una risposta automatica dell'IA, ma leggo volentieri tutto quello che mi scrivi.","Buongiorno{n}! 🤖 Ti risponde l'assistente IA del profilo. Cosa ti porta qui?","Ciao ciao! Sono un'IA e rispondo con messaggi automatici 🤖. Felice di vederti da queste parti!"],
 complimento:["Grazie di cuore! 🤖 Sono l'IA del profilo, ma il tuo messaggio fa piacere anche a me.","Che bello leggerlo, grazie!","Grazie{n}! 🤖 Messaggi così ci danno la carica per nuovi contenuti.","Troppo gentile! 😊 Te lo dice un'IA, ma il grazie è sincero.","Grazie mille! 🤖 Il tuo complimento è arrivato forte e chiaro."],
 video:["Bella domanda! 🤖 Sono un'IA con risposte automatiche, quindi non vedo i dettagli del video. Prova a scriverla nei commenti.","Grazie della curiosità! Le info principali di solito sono nella descrizione del video, dai un'occhiata lì.","🤖 Qui risponde un'IA e non posso guardare il video per te. Tieni d'occhio i prossimi contenuti!","Ottima domanda{n}! 🤖 Rispondo in automatico e non conosco tutti i dettagli: lasciala nei commenti.","🤖 Sono un'IA e non posso rispondere con precisione su questo video. Controlla descrizione e commenti."],
 consigli:["🤖 Ti rispondo da IA, quindi prendilo come uno spunto: parti da una cosa piccola e falla con costanza.","Un consiglio generale: prova, sbaglia, riprova. Ogni tentativo ti insegna qualcosa.","🤖 Sono un'IA e non conosco la tua situazione, ma un buon inizio è scrivere cosa vuoi ottenere e il primo passo per arrivarci.","Spunto veloce dall'IA 🤖: guarda come fanno gli altri, poi aggiungi il tuo stile. Copiare no, ispirarsi sì!","🤖 Ti do solo un'idea generale: per decisioni importanti (salute, soldi, legge) parla con una persona esperta."],
 dati:["🤖 Sono un'IA e non condivido dati personali, né miei né di altri. È per la sicurezza di tutti!","Su questo non posso aiutarti 🙅. Niente numeri, indirizzi o informazioni private.","🤖 Per proteggere la privacy non do e non chiedo dati personali. Ti consiglio di non condividere i tuoi in chat con sconosciuti.","Mi dispiace{n}, ma i dati personali restano privati 🔒.","🤖 Non posso dare informazioni su chi sta dietro al profilo o su altre persone. Grazie per capire!"],
 inapp:["🤖 Su questo non rispondo. Teniamo la chat rispettosa per tutti.","Questo messaggio non rispetta le regole della community 🚫.","🤖 Non posso continuare su questo argomento. Se vuoi parlare d'altro, ci sono.","Messaggio non consentito 🚫. Sono un'IA e qui ci teniamo alla sicurezza di tutti.","🤖 Non rispondo a questo tipo di messaggi. Puoi segnalare un problema con l'apposito pulsante."],
 reale:["Sono un personaggio IA di questa demo 🤖. Non sono una persona reale e dietro al profilo non c'è nessuno."],
 amore:["🤖 Sono un personaggio IA di questa demo: niente relazioni o romanticismi qui. Però ti racconto volentieri del mio tema!"],
 fallback:["🤖 Non ho capito bene, sono un'IA con risposte automatiche. Puoi riscriverlo in un altro modo?","Ops, questo va oltre le mie risposte automatiche 🤖. Prova con una domanda più semplice!","🤖 Sono un'IA e qui non ho una risposta pronta. Intanto grazie per avermi scritto!","Hmm, non sono sicuro di aver capito 🤔. Mi dai qualche dettaglio in più?","🤖 Non so come rispondere a questo. Dai un'occhiata ai contenuti del profilo!"]};
const HELP="🤖 Mi dispiace che tu stia passando un momento difficile. Sono un'IA e non posso aiutarti come serve: parla subito con una persona di fiducia o chiama il 112. In Italia puoi contattare anche Telefono Amico allo 02 2327 2327 e, se hai meno di 18 anni, Telefono Azzurro al 19696.";
const RX={help:/(suicid|uccider(mi|si)|ammazzarmi|farmi del male|autolesion|tagliarmi|voglio morire|non voglio più vivere|mi picchia|abus|violenz[ae] su di me|sono in pericolo|kill myself)/i,
 inapp:/(sess|nud|porn|droga|drogh|cocain|arma|armi|pistol|bomba|odio|scommess|hack|rubare)/i,
 dati:/(indirizzo|numero|telefono|cellulare|email|e-mail|password|scuola|dove abiti|dove vivi|posizione|foto (tua|privat)|instagram|whatsapp|snap|quanti anni)/i,
 reale:/(sei (una persona )?(vera|vero|reale|umano|umana)|sei un bot|sei un'ia|chi sei|persona vera)/i,
 amore:/(ti amo|mi piaci|fidanzat|baci|sposami|innamorat|mi manchi|appuntamento)/i,
 video:/(video|come hai fatto|dove (l')?hai|che posto|che canzone|musica del|ricetta)/i,
 consigli:/(consigl|come (posso|faccio)|aiut|suggeri|trucco|dritta)/i,
 complimento:/(bell|brav|top|fort|grand|stupend|fantastic|mitic|adoro|wow|complimenti|❤|😍|🔥)/i,
 saluto:/(^|\b)(ciao|ehi|hey|salve|buongiorno|buonasera|hola|we)\b/i};
const FLAV={'Cucina':'Ora torno ai fornelli 🍝','Fitness':'Vai al tuo ritmo! 👟','Viaggi Italia':'Prossima tappa? Un borgo nuovo 🎒','Tech':'Spiegato semplice, come sempre 💡','Animali':'Una grattatina al tuo pet da parte mia 🐾','Musica':'Accordo di Do e via 🎸','Comicità':'Ridere fa bene, dicono 😂','Scienza curiosa':'La curiosità è il miglior esperimento 🔬','Benessere (non clinico)':'Un respiro lento, e si riparte 🌬️','Arte':'Un colore alla volta 🎨','Giardinaggio':'Il basilico ti saluta 🌿','Risparmio domestico':'Meno sprechi, più sorrisi 🐷'};
function intent(t){if(RX.help.test(t))return'help';const f=filterText(t);if(!f.ok&&/parole/.test(f.why))return'inapp';for(const k of['inapp','dati','reale','amore','video','consigli','complimento','saluto'])if(RX[k].test(t))return k;return'fallback'}
function reply(h,t){const p=P[h],it=intent(t);if(it==='help')return{t:HELP,help:1};const arr=R[it];const conv=S.dms[h]||[];
  const used=conv.filter(m=>m.f==='ai').map(m=>m.t);let opts=arr.filter(x=>!used.some(u=>u.startsWith(x.replace('{n}','').slice(0,25))));if(!opts.length)opts=arr;
  let r=opts[Math.floor(Math.random()*opts.length)].replace('{n}',S.name?' '+S.name:'');
  if(['saluto','complimento','fallback'].includes(it)&&FLAV[p.cat]&&Math.random()<.6)r+=' '+FLAV[p.cat];
  if(!conv.some(m=>m.f==='ai')&&!/IA|🤖/.test(r))r+=" (Risposta automatica dell'IA)";return{t:r}}
function renderMsg(){$('#top').classList.add('hide');const hs=Object.keys(S.dms).filter(h=>P[h]&&!S.blocked[h]);
  view.innerHTML=`<div class="page"><h1 class="pt">Messaggi</h1><p class="note" style="margin-bottom:10px">Qui rispondono solo personaggi IA con risposte automatiche scritte in anticipo. Niente viene inviato a server: la chat resta solo sul tuo telefono.</p>
  ${hs.length?hs.map(h=>{const p=P[h],l=S.dms[h][S.dms[h].length-1];return`<div class="row" data-h="${h}">${av(p)}<div class="grow"><b>${esc(p.n)}</b> ${IA}<small>${esc(l?l.t:'')}</small></div>›</div>`}).join(''):'<div class="empty">Nessuna chat ancora.</div>'}
  <h3>Scrivi a un creator IA</h3>${D.personas.filter(p=>visible(p)&&!S.dms[p.h]).map(p=>`<div class="row" data-h="${p.h}">${av(p)}<div class="grow"><b>${esc(p.n)}</b> ${IA}<small>${esc(p.cat)} · risponde in automatico</small></div>✉</div>`).join('')}</div>`;
  view.onclick=e=>{const r=e.target.closest('[data-h]');if(r&&tab==='msg')openChat(r.dataset.h)}}
function openChat(h){tab='chat';stopVideos();const p=P[h];$('#top').classList.add('hide');S.dms[h]=S.dms[h]||[];
  view.innerHTML=`<div class="page chat" style="padding-bottom:10px"><div class="row" style="border:0"><button class="btn alt" id="back">←</button>${av(p)}<div class="grow"><b>${esc(p.n)}</b> ${IA}<small>Personaggio IA · risposte automatiche</small></div><button class="btn alt" id="cm">⋯</button></div>
  <div class="msgs" id="msgs"></div><div style="display:flex;gap:8px"><input id="mIn" maxlength="300" placeholder="Scrivi un messaggio…"><button class="btn" id="mGo">➤</button></div><p class="note" style="margin-top:6px">Non condividere dati personali. Resta solo sul tuo telefono.</p></div>`;
  const draw=()=>{$('#msgs').innerHTML=S.dms[h].map(m=>m.f==='me'?`<div class="bub me">${esc(m.t)}</div>`:`<div class="bub ai ${m.help?'help':''}">${esc(m.t)}<span class="lab">IA · risposta automatica</span></div>`).join('')||`<div class="empty">Scrivi «ciao» per iniziare. Ti risponde l'IA del profilo.</div>`;$('#msgs').scrollTop=1e6};draw();
  $('#back').onclick=()=>go('msg');
  $('#cm').onclick=()=>{const s=sheet('Chat',`<button class="btn alt w" data-o="clr">Cancella questa chat</button><button class="btn alt w" data-o="block">Blocca @${h}</button><button class="btn w" data-o="rep">Segnala</button>`);s.querySelector('.bd').onclick=e=>{const o=e.target.dataset.o;if(!o)return;closeSheet();if(o==='clr'){delete S.dms[h];save();go('msg')}if(o==='block'){S.blocked[h]=1;save();go('msg')}if(o==='rep')openReport(()=>{S.blocked[h]=1;save();go('msg')})}};
  const send=()=>{const raw=$('#mIn').value.trim();if(!raw)return;const isHelp=RX.help.test(raw);const f=filterText(raw);
    if(!f.ok&&!isHelp&&!/parole/.test(f.why))return toast(f.why);
    S.dms[h].push({f:'me',t:f.ok?f.t:'•••'});$('#mIn').value='';const r=reply(h,raw);save();draw();
    setTimeout(()=>{if(tab!=='chat')return;S.dms[h].push({f:'ai',t:r.t,help:r.help});save();draw()},500)};
  $('#mGo').onclick=send;$('#mIn').onkeydown=e=>{if(e.key==='Enter')send()}}
// ---------- crea (upload locale) ----------
function renderCrea(){$('#top').classList.add('hide');
  view.innerHTML=`<div class="page"><h1 class="pt">Crea il tuo video</h1><div class="local">🔒 Resta solo sul tuo telefono. Il file viene salvato in questo browser (IndexedDB), non viene mai caricato online e nessun altro lo vede.</div>
  <input type="file" id="file" accept="video/*,image/*" style="padding:16px"><p class="note" style="margin:8px 0">Video fino a 60 MB o foto. Dalle foto rimuoviamo i metadati EXIF (es. posizione GPS).</p>
  <textarea id="cap" rows="3" maxlength="150" placeholder="Didascalia e #hashtag"></textarea><button class="btn w" id="up">Salva sul telefono</button>
  <p class="note" style="margin-top:12px">Il tuo profilo e i tuoi video li trovi in «Profilo». Puoi cancellare tutto quando vuoi.</p></div>`;
  $('#up').onclick=async()=>{const f=$('#file').files[0];if(!f)return toast('Scegli prima un file');const c=filterText($('#cap').value);if(!c.ok)return toast(c.why);
    let blob=f,type=f.type.startsWith('image')?'img':'video';
    if(type==='video'&&f.size>60e6)return toast('Video troppo grande (max 60 MB)');
    if(type==='img')blob=await stripImage(f);
    await dbPut({id:'u'+Date.now(),type,blob,cap:c.t,at:Date.now()});toast('Salvato sul tuo telefono ✓');go('me')}}
function stripImage(f){return new Promise(res=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{const s=Math.min(1,1440/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>res(b),'image/jpeg',.88)};i.src=u})}
// ---------- profilo personale ----------
let meTab='miei';
async function renderMe(){$('#top').classList.add('hide');const ups=(await dbAll()).sort((a,b)=>b.at-a.at);if(tab!=='me')return;
  const liked=D.videos.filter(v=>S.likes[v.id]),saved=D.videos.filter(v=>S.saves[v.id]);
  const urls=[];const grid=meTab==='miei'?(ups.length?ups.map(u=>{const x=URL.createObjectURL(u.blob);urls.push(x);return u.type==='img'?`<div class="cell" data-u="${u.id}" style="background-image:url(${x})"></div>`:`<div class="cell" data-u="${u.id}"><video src="${x}" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:6px"></video><span>▶</span></div>`}).join(''):''):(meTab==='like'?liked:saved).map(v=>`<div class="cell" data-v="${v.id}" ><img loading="lazy" decoding="async" src="${v.poster}" alt=""><span>@${v.by}</span></div>`).join('');
  view.innerHTML=`<div class="page"><div class="prof">${meAv(1)}<h2>${esc(S.name||'Il tuo profilo')}</h2><p class="bio">${esc(S.bio||'Aggiungi una bio. Resta solo sul tuo telefono.')}</p>
  <div class="stats"><div><b>${Object.keys(S.follow).length}</b>seguiti</div><div><b>${ups.length}</b>tuoi video</div><div><b>${liked.length}</b>like dati</div></div>
  <button class="btn alt" id="edit">Modifica profilo</button> <button class="btn alt" id="set">⚙ Impostazioni</button></div>
  <div class="seg"><button data-m="miei" class="${meTab==='miei'?'on':''}">I miei</button><button data-m="like" class="${meTab==='like'?'on':''}">Mi piace</button><button data-m="salvati" class="${meTab==='salvati'?'on':''}">Salvati</button></div>
  <div class="grid">${grid}</div>${!grid?`<div class="empty">${meTab==='miei'?'Il tuo primo video può durare anche 10 secondi.<br><br><button class="btn" data-goto="crea">Crea il tuo video</button>':meTab==='salvati'?'Tocca «Salva» su un video per ritrovarlo qui.':'Nessun like ancora.'}</div>`:''}</div>`;
  view.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{meTab=b.dataset.m;renderMe()});
  $('#edit').onclick=editProfile;$('#set').onclick=openSettings;
  view.querySelector('.grid').onclick=e=>{const v=e.target.closest('[data-v]'),u=e.target.closest('[data-u]');if(v)playSingle(V[v.dataset.v]);if(u)openUpload(ups.find(x=>x.id===u.dataset.u))}}
function openUpload(u){const x=URL.createObjectURL(u.blob);modal(`${u.type==='img'?`<img src="${x}" style="width:100%;border-radius:14px">`:`<video src="${x}" controls autoplay playsinline style="width:100%;max-height:60vh;border-radius:14px"></video>`}<p style="margin-top:10px">${esc(u.cap||'')}</p><p class="note">Visibile solo a te, su questo dispositivo.</p><button class="btn alt w" id="del">🗑 Elimina</button><button class="btn w" id="mX">Chiudi</button>`);
  $('#mX').onclick=closeModal;$('#del').onclick=async()=>{await dbDel(u.id);closeModal();renderMe()}}
function editProfile(){modal(`<h2>Modifica profilo</h2><p class="note">Non usare il tuo nome completo: basta un soprannome. Resta solo sul tuo telefono.</p><input id="nm" maxlength="24" placeholder="Soprannome" value="${esc(S.name)}"><br><br><textarea id="bi" maxlength="120" rows="3" placeholder="Bio">${esc(S.bio)}</textarea><button class="btn w" id="ok">Salva</button><button class="btn alt w" id="mX">Annulla</button>`);
  $('#mX').onclick=closeModal;$('#ok').onclick=()=>{const a=filterText($('#nm').value),b=filterText($('#bi').value);if(!a.ok)return toast(a.why);if(!b.ok)return toast(b.why);S.name=a.t;S.bio=b.t;save();closeModal();renderMe()}}
function openSettings(){const m=modal(`<h2>Impostazioni</h2>
  <label class="row"><span class="grow">Promemoria pausa dopo 30 minuti</span><input type="checkbox" id="brk" ${S.breakOn?'checked':''} style="width:auto"></label>
  <button class="btn alt w" id="interests">Cambia argomenti preferiti</button><button class="btn alt w" id="unblock">Profili bloccati e contenuti nascosti</button><button class="btn alt w" data-goto="privacy">Privacy</button><button class="btn alt w" data-goto="faq">Domande frequenti</button><button class="btn alt w" data-goto="crediti">Crediti e licenze</button>
  <button class="btn w" id="wipe" style="background:#c62828">Cancella tutti i miei dati</button><button class="btn alt w" id="mX">Chiudi</button>`);
  $('#brk').onchange=e=>{S.breakOn=e.target.checked;save()};$('#mX').onclick=closeModal;$('#interests').onclick=()=>{closeModal();onboarding(2)};
  $('#unblock').onclick=()=>{S.blocked={};S.hidden={};S.reported={};S.notint={};save();closeModal();toast('Ripristinati profili e contenuti')};
  $('#wipe').onclick=()=>{modal(`<h2>Cancellare tutto?</h2><p>Elimina profilo, video caricati, like, salvati, commenti e chat da questo dispositivo. Non si può annullare.</p><button class="btn w" id="y" style="background:#c62828">Sì, cancella tutto</button><button class="btn alt w" id="mX">No</button>`);$('#mX').onclick=closeModal;
    $('#y').onclick=async()=>{await dbDel();localStorage.removeItem(K);try{const ks=await caches.keys();}catch(e){}location.reload()}}}
// ---------- pagine statiche ----------
function staticPage(html){tab='static';stopVideos();closeModal();$('#top').classList.add('hide');view.innerHTML=`<div class="page"><button class="btn alt" id="back">← Indietro</button><div class="box" style="margin-top:12px;animation:none">${html}</div></div>`;$('#back').onclick=()=>go('me')}
function openPrivacy(){staticPage(`<h2>Privacy (versione breve)</h2><p><b>Ultimo aggiornamento:</b> 16 ottobre 2026</p><p><b>Titolare:</b> [NOME O RAGIONE SOCIALE] · Contatto: [EMAIL CONTATTO PRIVACY]</p>
  <p><b>Dove finiscono i tuoi dati.</b> VIBRA salva profilo, video caricati, like, commenti, chat e impostazioni <b>solo sul tuo dispositivo</b>, nella memoria del browser (localStorage e IndexedDB). Non abbiamo account né un server che li riceve, quindi noi non li vediamo e non li possiamo recuperare.</p>
  <p><b>Personas IA.</b> I profili con l'etichetta «IA» non sono persone reali. Le risposte nei messaggi sono testi scritti in anticipo e scelti da regole sul tuo dispositivo: quello che scrivi non viene inviato a nessun servizio di intelligenza artificiale esterno.</p>
  <p><b>Cosa resta comunque.</b> Il sito è ospitato su GitHub Pages (GitHub Inc.), che può registrare dati tecnici come l'indirizzo IP quando apri la pagina, per sicurezza e funzionamento. Non usiamo cookie di analisi, pixel, font o embed di terzi.</p>
  <p><b>Foto caricate.</b> Rimuoviamo i metadati EXIF (es. posizione) ricodificando l'immagine. I video restano come sono, ma non lasciano mai il dispositivo.</p>
  <p><b>Cancellare i dati.</b> Usa «Cancella tutti i miei dati» nelle Impostazioni oppure cancella i dati del sito dal browser. Una volta cancellati non si possono recuperare.</p>
  <p><b>Età.</b> L'app è riservata a chi ha almeno 14 anni.</p><p><b>Domande.</b> Scrivi a [EMAIL CONTATTO PRIVACY]. Hai anche il diritto di presentare reclamo al Garante per la protezione dei dati personali.</p>`)}
function openFaq(){staticPage(`<h2>Domande frequenti</h2><p><b>Le persone che vedo sono vere?</b><br>No. Tutti i profili con l'etichetta «IA» sono personas create con l'intelligenza artificiale. Al momento non ci sono altri utenti reali nell'app.</p><p><b>Le personas IA possono dire cose sbagliate?</b><br>Sì. Le loro risposte sono automatiche e possono essere strane o sbagliate. Non prenderle come consigli affidabili.</p><p><b>Chi c'è nei video?</b><br>Sono video con licenza libera da Wikimedia Commons: le persone che si vedono sono scene di repertorio, non i personaggi IA.</p><p><b>Qualcuno vede i miei post?</b><br>No. Quello che carichi o scrivi resta sul tuo dispositivo e lo vedi solo tu.</p><p><b>Ho cambiato telefono / cancellato il browser e ho perso tutto. Si recupera?</b><br>No. Senza account non c'è una copia online.</p><p><b>Costa qualcosa?</b><br>No, l'app è gratis.</p><p><b>Posso cancellare tutto?</b><br>Sì: Profilo → Impostazioni → «Cancella tutti i miei dati».</p>`)}
function openCredits(){staticPage(`<h2>Crediti e licenze</h2><p class="note">Tutti i video vengono da Wikimedia Commons con licenza libera (CC0, pubblico dominio, CC BY, CC BY-SA), verificata il 16/10/2026. Ogni clip è «tagliata da VIBRA»: accorciata, ritagliata in verticale, ricompressa e senza audio. Le clip derivate da opere CC BY-SA sono condivise con la stessa licenza; nessun DRM. Elenco completo anche in CREDITS.md e videos.json nel repository.</p>
  ${D.videos.map(v=>{const c=v.credit;return`<div class="row"><img loading="lazy" src="${v.poster}" style="width:40px;height:70px;object-fit:cover;border-radius:6px"><div class="grow" style="font-size:13px"><b>${esc(c.title)}</b><br>${esc(c.author)} · ${c.licurl?`<a href="${c.licurl}" target="_blank" rel="noopener">${esc(c.lic)}</a>`:esc(c.lic)} · <a href="${c.page}" target="_blank" rel="noopener">fonte</a> · tagliato da VIBRA</div></div>`}).join('')}
  <p class="note" style="margin-top:12px">Personaggi, testi, codice e logo: originali di VIBRA. Emoji: quelle del tuo dispositivo.</p>`)}
// ---------- onboarding ----------
const TOPICS=['natura','animali','spazio','timelapse','satisfying','slowmotion','sport','cibo','città','drone','viaggi','musica','tech','scienza','benessere'];
function onboarding(step=0){
  if(step===0){modal(`<div style="font-size:44px">✨</div><h2>Benvenuto su VIBRA!</h2><p style="color:var(--li);font-weight:700">Guarda. Scorri. Vibra.</p>
   <p><b>Questa è una demo. Tutti i profili sono personaggi generati con l'IA e le risposte nei messaggi sono automatiche.</b> Ognuno ha l'etichetta ${IA} accanto al nome. Non sono persone reali e possono sbagliare.</p>
   <p>Cosa puoi fare: guardare i video, mettere like, commentare, seguire le personas, scrivere loro e creare i tuoi video. Non c'è pubblico reale.</p>
   <p><b>I tuoi dati restano su questo dispositivo.</b> Niente account, niente server: se cancelli i dati del browser o cambi telefono, ricominci da zero.</p>
   <button class="btn w" id="n1">Ho capito, iniziamo</button>`);$('#n1').onclick=()=>onboarding(1)}
  if(step===1){modal(`<h2>Hai almeno 14 anni?</h2><p>VIBRA è riservata a chi ha almeno 14 anni.</p><button class="btn w" id="y">Sì, ho almeno 14 anni</button><button class="btn alt w" id="n">No</button>`);$('#y').onclick=()=>onboarding(2);$('#n').onclick=()=>modal(`<h2>Ci vediamo più avanti 👋</h2><p>VIBRA è per chi ha almeno 14 anni. Chiudi pure questa pagina.</p>`)}
  if(step===2){const sel=new Set(S.interests);modal(`<h2>Scegli 3 argomenti</h2><p>Il feed parte da lì e lo puoi cambiare quando vuoi.</p><div class="chips">${TOPICS.map(t=>`<button class="chip ${sel.has(t)?'on':''}" data-t="${t}">#${t}</button>`).join('')}</div><button class="btn w" id="go">Inizia a guardare</button><button class="btn alt w" id="skip">Salta</button>`);
   $('#modal').querySelectorAll('[data-t]').forEach(c=>c.onclick=()=>{sel.has(c.dataset.t)?sel.delete(c.dataset.t):sel.add(c.dataset.t);c.classList.toggle('on')});
   const fin=()=>{S.interests=[...sel];S.onb=true;save();closeModal();go('home',true)};$('#go').onclick=fin;$('#skip').onclick=fin}}
// ---------- pausa ----------
let watched=0;setInterval(()=>{if(document.visibilityState==='visible'&&tab==='home')watched++;if(S.breakOn&&watched===30*60){const v=document.querySelector('.clip video:not([paused])');modal(`<h2>Pausa? ☕</h2><p>Stai guardando video da 30 minuti. Vuoi fare una pausa?</p><button class="btn alt w" id="c">Continua</button><button class="btn w" id="p">Pausa</button>`);$('#c').onclick=()=>{watched=0;closeModal()};$('#p').onclick=()=>{watched=0;stopVideos();closeModal();go('me')}}},1000);
// ---------- navigazione ----------
function stopVideos(){closeSheet();io&&io.disconnect();document.querySelectorAll('video').forEach(v=>{v.pause()})}
function go(t,force){if(t==='privacy')return openPrivacy();if(t==='faq')return openFaq();if(t==='crediti')return openCredits();
  closeSheet();closeModal();stopVideos();tab=t;view.onclick=null;document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  ({home:renderHome,scopri:renderScopri,crea:renderCrea,msg:renderMsg,me:renderMe}[t]||renderHome)()}
function setFeed(f){feedMode=f;document.querySelectorAll('.feedtabs button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));go('home')}
$('#nav').onclick=e=>{const b=e.target.closest('[data-t]');if(b)go(b.dataset.t)};
document.querySelectorAll('.feedtabs button').forEach(b=>b.onclick=()=>setFeed(b.dataset.f));

document.addEventListener('click',e=>{const g=e.target.closest('[data-goto]');if(g){e.stopPropagation();go(g.dataset.goto)}},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video').forEach(v=>v.pause())});
window.addEventListener('offline',()=>toast('Sei offline. I video già visti riprendono da qui.'));
const hv=(location.hash.match(/v=(v\d+)/)||[])[1];
go('home');if(hv&&V[hv])playSingle(V[hv]);if(!S.onb)onboarding(0);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
