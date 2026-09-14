const CACHE='pesmac-live-v2';
const STATIC=[
  './','./index.html','./live.html','./bracket.html','./overlay.html',
  './styles.css','./tournament-ui.css','./dashboard-ui.css','./team-logo.css','./pwa.css','./live-fix.css',
  './app.js','./dashboard-ui.js','./live.js','./bracket.js','./overlay.js','./ui.js','./data.js','./config.js','./supabase-client.js','./pwa.js',
  './manifest.webmanifest','./assets/pesmac-logo.svg'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res}).catch(()=>caches.match(req).then(r=>r||caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res})));
});
