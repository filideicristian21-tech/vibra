const C='vibra-core-v4',M='vibra-media-v4',MAX=80,CORE=['./','index.html','style.css','app.js','data.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!==M).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function trim(){const c=await caches.open(M),ks=await c.keys();for(let i=0;i<ks.length-MAX;i++)await c.delete(ks[i])}
async function media(req,url){const c=await caches.open(M);let r=await c.match(url);
  if(r){await c.delete(url);await c.put(url,r.clone())}// LRU: sposta in coda
  else{try{r=await fetch(url);if(r.ok&&r.status===200){await c.put(url,r.clone());trim()}}catch(e){return new Response('',{status:504})}}
  const rg=req.headers.get('range');if(!rg||!r.ok)return r;
  const b=await r.blob(),m=/bytes=(\d+)-(\d*)/.exec(rg),st=+m[1],en=m[2]?Math.min(+m[2],b.size-1):b.size-1;
  return new Response(b.slice(st,en+1),{status:206,headers:{'Content-Type':r.headers.get('Content-Type')||'video/mp4','Content-Range':`bytes ${st}-${en}/${b.size}`,'Content-Length':String(en-st+1),'Accept-Ranges':'bytes'}})}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET')return;
  if(/\/v\/[^/]+\.mp4$/.test(u.pathname)){e.respondWith(media(e.request,u.origin+u.pathname));return}
  if(/\/v\/[^/]+\.jpg$/.test(u.pathname)){e.respondWith(media(e.request,u.origin+u.pathname));return}
  e.respondWith(fetch(e.request).then(res=>{if(res.ok&&res.status===200){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp))}return res}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
