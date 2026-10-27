/* 예전 /fb/ 주소의 서비스 워커를 스스로 지움 — 캠첵!은 이제 /camping/ 에서 돌아감 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("campfb-")).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
