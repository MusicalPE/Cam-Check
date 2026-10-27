/* 캠첵! — 화면 파일을 저장해 두었다가 인터넷이 약한 캠핑장에서도 열리게 함.
   화면은 늘 새로 받아 보고(업데이트 바로 반영), 안 되면 저장해 둔 것으로 엶.
   가족 공간 자료(파이어베이스)는 건드리지 않음 — 파이어베이스가 스스로 이 기기에 저장해 둠. */
const CACHE = "camcheck-v1.9.6";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./app-firebase.js", "./firebase-config.js", "./kakao-config.js", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./logo.png", "./privacy.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const mine = url.origin === location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "cdnjs.cloudflare.com" || url.hostname === "www.gstatic.com";
  if (!mine && !font) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(mine && req.mode === "navigate" ? url.origin + url.pathname : req, copy));
      }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true})
      .then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
