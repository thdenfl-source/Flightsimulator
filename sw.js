// VFR Flight Sim — Service Worker
// 버전을 올리면 캐시가 갱신됩니다
const CACHE = 'vfr-flight-v126';
const CORE  = [
  './index.html',
  './manifest.json',
  './icon.png',
  './icon-512.png',
];

// 설치 시 핵심 파일 캐시 (HTTP 캐시 우회로 항상 최신본 저장)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u =>
        fetch(new Request(u, { cache: 'reload' }))
          .then(res => res && res.ok ? c.put(u, res) : null)
          .catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

// 오래된 캐시 정리
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선 → 실패 시 캐시 (Leaflet 타일은 네트워크 필요)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // OSM 지도 타일: 캐시 우선
  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open('vfr-tiles').then(c =>
        c.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Esri 위성 타일: 캐시 우선
  if (url.includes('arcgisonline.com')) {
    e.respondWith(
      caches.open('vfr-sat-tiles').then(c =>
        c.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // 3D 지형(DEM) 타일: 캐시 우선 (CORS 응답만 캐시)
  if (url.includes('elevation-tiles-prod')) {
    e.respondWith(
      caches.open('vfr-dem-tiles').then(c =>
        c.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => {
            if (res && res.ok) c.put(e.request, res.clone());
            return res;
          });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Leaflet / Maplibre JS·CSS CDN: 캐시 우선 (정상 응답만 캐시)
  if (url.includes('unpkg.com') || url.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached => cached || fetch(e.request).then(res => {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // 앱 파일: 네트워크 우선 → 실패 시 캐시 (index.html 업데이트가 즉시 반영됨)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
