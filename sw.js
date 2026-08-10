const CACHE='jrw-v0.9.2';
const SHELL=['/','/index.html','/command-center.html','/styles.css?v=0.9.2','/app.js?v=0.9.2','/icons/wedding-192.png','/icons/wedding-512.png'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(['/gift-release.html','/job-response.html','/config.js'].includes(url.pathname)){event.respondWith(fetch(request));return;}
  event.respondWith(fetch(request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  }).catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html'))));
});
