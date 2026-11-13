// ─────────────────────────────────────────────────────────────
// 04-map.js — 2D 지도 · 3D 지형
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════
// MAP
// ══════════════════════════════════════════════════════
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:18});
const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19});
let currentLayer = 'sat';
const leafMap = L.map('map',{center:[37.3895,126.6550],zoom:12,zoomControl:false,attributionControl:false});
L.control.zoom({position:'bottomright'}).addTo(leafMap);
satLayer.addTo(leafMap);

// Custom dual-unit scale bar (km + NM)
L.Control.DualScale = L.Control.extend({
  options: { position: 'bottomleft', maxWidth: 120 },
  onAdd(map) {
    const div = L.DomUtil.create('div', 'vfr-scale');
    this._kmRow = L.DomUtil.create('div', 'vfr-scale-row', div);
    this._kmBar = L.DomUtil.create('div', 'vfr-scale-bar vfr-scale-km', this._kmRow);
    this._kmLbl = L.DomUtil.create('span', '', this._kmRow);
    this._nmRow = L.DomUtil.create('div', 'vfr-scale-row', div);
    this._nmBar = L.DomUtil.create('div', 'vfr-scale-bar vfr-scale-nm', this._nmRow);
    this._nmLbl = L.DomUtil.create('span', '', this._nmRow);
    map.on('zoomend moveend', this._update, this);
    this._update();
    return div;
  },
  _mpp() {
    const z = this._map.getZoom(), lat = this._map.getCenter().lat;
    return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
  },
  _nice(maxM, unitM, unit) {
    const steps = [0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10,20,50,100,200,500,1000];
    const maxU = maxM / unitM;
    // largest clean step that fits within maxWidth (≤ maxU)
    let v = steps[0];
    for (const s of steps) { if (s <= maxU) v = s; else break; }
    return { px: v * unitM / this._mpp(), label: v + ' ' + unit };
  },
  _update() {
    const maxM = this.options.maxWidth * this._mpp();
    const km = this._nice(maxM, 1000, 'km');
    const nm = this._nice(maxM, 1852, 'NM');
    this._kmBar.style.width = Math.min(km.px, this.options.maxWidth) + 'px';
    this._kmLbl.textContent = km.label;
    this._nmBar.style.width = Math.min(nm.px, this.options.maxWidth) + 'px';
    this._nmLbl.textContent = nm.label;
  }
});
new L.Control.DualScale().addTo(leafMap);

// ── 단일 공항 마스터 데이터 ──
// WX_AIRPORTS, APT_LATLNG, APT_NAME 모두 여기서 파생
const AIRPORTS_KR = [
  { icao:'RKSI', name:'인천',  lat:37.4603, lon:126.4400 },
  { icao:'RKSS', name:'김포',  lat:37.5581, lon:126.7911 },
  { icao:'RKPK', name:'김해',  lat:35.1786, lon:128.9389 },
  { icao:'RKPC', name:'제주',  lat:33.5108, lon:126.4947 },
  { icao:'RKTU', name:'청주',  lat:36.7186, lon:127.4989 },
  { icao:'RKJJ', name:'광주',  lat:35.1231, lon:126.8092 },
  { icao:'RKJK', name:'군산',  lat:35.9039, lon:126.6158 },
  { icao:'RKJY', name:'여수',  lat:34.8423, lon:127.6170 },
  { icao:'RKJB', name:'무안',  lat:34.9914, lon:126.3829 },
  { icao:'RKPS', name:'사천',  lat:35.0886, lon:128.0703 },
  { icao:'RKTH', name:'포항',  lat:35.9878, lon:129.4201 },
  { icao:'RKPU', name:'울산',  lat:35.5934, lon:129.3520 },
  { icao:'RKTN', name:'대구',  lat:35.8939, lon:128.6586 },
  { icao:'RKNN', name:'강릉',  lat:37.7537, lon:128.9437 },
  { icao:'RKNY', name:'양양',  lat:38.0611, lon:128.6689 },
  { icao:'RKNS', name:'속초',  lat:38.1427, lon:128.5986 },
  { icao:'RKSM', name:'성남',  lat:37.4458, lon:127.1142 },
  { icao:'RKSW', name:'수원',  lat:37.2394, lon:127.0070 },
  { icao:'RKSO', name:'오산',  lat:37.0911, lon:127.0300 },
  { icao:'RKNW', name:'원주',  lat:37.4381, lon:127.9603 },
  { icao:'RKTY', name:'예천',  lat:36.6319, lon:128.3519 },
  { icao:'RKTI', name:'중원',  lat:37.0295, lon:127.8862 },
  { icao:'RKTL', name:'울진',  lat:36.7769, lon:129.4617 },
  // 이천의 ICAO는 RKRN이다. RKUC는 조치원 — 좌표(37.20N/127.47E)와 AIRFIELD_INFO의
  // 코드 체계(이천 'RN' / 조치원 'UC') 두 곳이 모두 이천임을 가리켜 ICAO를 바로잡았다.
  { icao:'RKRN', name:'이천',  lat:37.2011, lon:127.4719 },
  { icao:'RKPD', name:'정석',  lat:33.3983, lon:126.7131 },
  { icao:'RKSG', name:'평택',  lat:36.9600, lon:127.0333 },
  // 서산은 AIP AD 2 차트로 ARP를 아직 대조하지 못했다(공개 위치값).
  { icao:'RKTP', name:'서산',  lat:36.7039, lon:126.4861 },
  // 태안 ARP — 한서대학교 태안비행장 비행절차(2025-09-01) 제2장 제1절 7항
  //   N 36°35.63′ / E 126°17.80′
  // 검증: 활주로 시단 두 점(RWY34 N36°35.36′ E126°17.99′, RWY16 N36°35.91′ E126°17.59′)
  //       사이 거리 1180m = 문서의 활주로 길이, 진방위 329.7°+자편차 = 338° = 문서 방향.
  { icao:'RKTA', name:'태안',  lat:36.5938, lon:126.2967 },
];

// ── 공항 목록 단일 소스 ──
// 과거에 AIRPORTS(15개)와 AIRPORTS_KR(26개)이 따로 있어 6개 공항 좌표가 어긋나 있었고,
// 사천이 RKTL(실제 울진), 울산이 RKDU(존재하지 않는 코드)로 잘못 들어가 있었다.
// 이제 AIRPORTS_KR만 유지하고 나머지는 전부 여기서 파생한다.
const AIRPORTS = AIRPORTS_KR.map(a => ({ ident: a.icao, name: a.name, lat: a.lat, lon: a.lon }));
// 비행계획 화면의 빠른 추가 버튼(표시 순서) — 좌표·명칭은 위 단일 소스에서 조회
const FP_PRESET_ICAOS = ['RKSI','RKSS','RKPK','RKPC','RKTU','RKJJ','RKJK','RKJY',
                         'RKJB','RKPS','RKTH','RKPU','RKNN','RKNY','RKNS'];
const FP_PRESETS = FP_PRESET_ICAOS.map(ic => AIRPORTS.find(a => a.ident === ic)).filter(Boolean);


function toggleLayer() {
  const btn = document.getElementById('layer-btn');
  if (currentLayer === 'osm') {
    leafMap.removeLayer(osmLayer);
    satLayer.addTo(leafMap);
    currentLayer = 'sat';
    btn.textContent = 'MAP';
    btn.classList.add('sat');
  } else {
    leafMap.removeLayer(satLayer);
    osmLayer.addTo(leafMap);
    currentLayer = 'osm';
    btn.textContent = 'SAT';
    btn.classList.remove('sat');
  }
}

// ── RainViewer precipitation overlay ──


// ══════════════════════════════════════════════════════
// 3D TERRAIN MAP  (Maplibre GL JS)
// ══════════════════════════════════════════════════════
let _ml3d = null;          // Maplibre GL map instance (lazy init)
let _ml3dMarker = null;    // aircraft marker on 3D map
// 3D 지도의 지형 과장비 — 화면에 보이는 땅은 실제 표고의 이 배다.
// 1인칭 카메라를 땅 위에 놓으려면 같은 값을 써야 한다(05-gps.js).
const MAP3D_EXAG = 1.5;
// ── 3D 화질(상·중·하) ──
// 화면을 몇 배 해상도로 그리는가(ratio · CHIN 창은 chin)와 위성 사진·지형을 몇 단계까지
// 자세히 받는가(satMax · demMax). 낮출수록 그릴 픽셀과 받을 타일이 줄어 낮게 빨리 날 때도
// 부드럽다. 고른 값은 이 기기에 적어 둔다.
// CHIN 창(지도 두 장)은 정면만큼 자주 다시 그리지 않아도 된다 — 발밑을 내려다보는
// 창이라 덜 자주 그려도 티가 덜 난다. 그리는 횟수를 chinHz 로 묶는다(0 = 매 프레임).
// (그래픽을 셈하는 데 CHIN 창 두 장이 정면 한 장만큼 든다 — 화질을 낮춰도 이것을
//  묶지 않으면 덜 부드러워진다)
const MAP3D_QUALITY = {
  high: { name: '상', ratio: Infinity, chin: 1.5, chinHz: 0,  satMax: 19, demMax: 15 },   // 기기 해상도 그대로
  mid:  { name: '중', ratio: 1.25,     chin: 1,   chinHz: 30, satMax: 17, demMax: 14 },
  low:  { name: '하', ratio: 0.8,      chin: 0.6, chinHz: 15, satMax: 15, demMax: 12 },
};
const MAP3D_QUALITY_ORDER = ['high', 'mid', 'low'];
let map3dQuality = 'mid';
try { const v = localStorage.getItem('map3dQuality'); if (MAP3D_QUALITY[v]) map3dQuality = v; } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
function map3dPixelRatio(chin) {
  const q = MAP3D_QUALITY[map3dQuality];
  return Math.min(window.devicePixelRatio || 1, chin ? q.chin : q.ratio);
}
let _view3dOn = false;
// 3D 가 화면에 떠 있는가 — 2D 위에 겹쳐 있거나, 제 창(탭의 '3D')을 쓰고 있거나.
// 창 배치는 07-sim.js 가 쥐고 있고 그쪽이 나중에 로드되므로 있을 때만 묻는다.
function _map3dShown() {
  if (_view3dOn) return true;
  return (typeof map3dPanelOn === 'function') && map3dPanelOn();
}
let _ml3dPitch = 70;       // current 3D map pitch (adjustable via tilt buttons)
// 카메라를 움직여도 되는 상태인가.
// 종전에는 _ml3d.loaded() 로 물었다. 그건 "스타일도 타일도 전부 준비됨" 이라
// 비행 중 새 타일을 받는 동안 계속 false 가 되고, 그 사이 1인칭 추종과 방위
// 맞추기가 통째로 멈췄다 — 네트워크가 느릴수록 "3D 에서 안 된다" 가 된다.
// (load 이벤트를 기다리는 것도 같은 함정이다. 타일이 안 잡히면 영영 안 온다)
// 카메라 이동(easeTo)은 타일도 스타일도 필요 없다 — 지도 객체가 만들어진
// 순간부터 허용한다. 타일이 필요한 일(항적 소스·비 레이어)만 따로 기다린다.
let _ml3dReady = false;

function tiltAdj(delta) {
  _ml3dPitch = Math.max(0, Math.min(85, _ml3dPitch + delta));
  if (_ml3d && _ml3dReady) {
    if (followMode) {
      _applyFollow(); // let follow recalculate with new pitch
    } else {
      _ml3d.easeTo({ pitch: _ml3dPitch, duration: 200 });
    }
  }
}

function toggle3dMap() {
  const btn = document.getElementById('layer-btn-3d');
  const div3d = document.getElementById('map3d');
  const wrap = document.getElementById('map-wrap');

  // Library must be loaded
  if (typeof maplibregl === 'undefined') {
    if (btn) { btn.textContent = '3D ✕'; setTimeout(() => btn.textContent = '3D', 1500); }
    console.error('[3D] maplibre-gl failed to load');
    return;
  }

  // 3D 가 이미 제 창(탭의 '3D')을 쓰고 있으면 2D 위에 또 겹칠 일이 아니다.
  // 그 상태에서 켜면 2D 창이 빈 화면이 되므로 눌러도 바뀌지 않게 한다.
  if (typeof map3dPanelOn === 'function' && map3dPanelOn()) {
    // MAP 단독 화면이면 3D 단독으로 바꾼다(3D 단독 → CDU 의 MAP 등으로 넘어왔을 때 되돌아가는 길)
    if (typeof _soloActive !== 'undefined' && _soloActive && _soloCurrent === 'map') {
      try { setSolo('m3d'); updateSoloBtn(); } catch (e) { _swallow(e); }
      return;
    }
    btn.textContent = '3D 창';
    setTimeout(() => { btn.textContent = '3D'; }, 1200);
    return;
  }
  _view3dOn = !_view3dOn;
  btn.classList.toggle('active', _view3dOn);

  const tiltCtrl = document.getElementById('tilt-ctrl');
  if (_view3dOn) {
    div3d.classList.add('active');
    wrap.classList.add('map3d-on');
    if (tiltCtrl) tiltCtrl.classList.add('active');
    _init3dMap();
    // Container just became visible — force a resize once layout settles
    requestAnimationFrame(() => {
      if (_ml3d) { _ml3d.resize(); _applyFollow(); }
    });
  } else {
    div3d.classList.remove('active');
    wrap.classList.remove('map3d-on');
    if (tiltCtrl) tiltCtrl.classList.remove('active');
    try { syncChinView(); } catch (e) { _swallow(e); }   // 3D 를 닫으면 CHIN 창도 닫는다
    // Returning to 2D — Leaflet needs to recompute its size; apply follow immediately
    setTimeout(() => {
      try { leafMap.invalidateSize(); } catch (e) { _swallow(e); }
      _applyFollow();
    }, 50);
  }
}

// ── 위성 사진의 빈 칸 메우기 ──
// Esri 위성 사진은 넓은 바다나 일부 시골처럼 자세한 사진이 없는 곳에서 확대 단계가
// 높으면 회색 'Map data not yet available' 그림을 대신 보낸다. 1인칭으로 바다·땅에
// 가까이 내려가면 발밑에 그 높은 단계 타일이 깔려 화면이 깨진 것처럼 보였다
// (가까운 것까지 그리려고 카메라 확대 단계를 올린 뒤로 더 잦아졌다).
// 없는 타일은 404 로 받고(blankTile=false), 한 단계씩 위(덜 자세한) 타일에서 그
// 자리를 잘라 늘려 채운다. 끝내 없으면 바다 빛으로 채운다.
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const SAT_UP_LEVELS = 8;          // 이만큼 위 단계까지 찾아 올라간다
const SAT_SEA = '#0b2638';        // 끝내 사진이 없을 때의 바다 빛
// 사진이 없다고 확인된 타일 — 그 아래(더 자세한) 단계도 없으므로 다시 묻지 않는다.
// 위 단계 사진은 자식 타일 여럿이 함께 쓰므로 잠깐 들고 있는다. 그래야 낮게 날 때
// 발밑 타일이 빨리 채워진다(늦게 채워지면 빈 칸이 깜빡이는 것처럼 보인다).
const _satMissing = new Set();
const _satBmp = new Map();        // 'z/x/y' → Promise<ImageBitmap|null>
function _satKnownMissing(z, x, y) {
  for (let k = 0; k <= z; k++) if (_satMissing.has(`${z - k}/${x >> k}/${y >> k}`)) return true;
  return false;
}
async function _satFetch(z, x, y) {
  if (_satKnownMissing(z, x, y)) return null;
  const r = await fetch(`${SAT_URL}/${z}/${y}/${x}?blankTile=false`);
  if (r.status === 404) { _satMissing.add(`${z}/${x}/${y}`); return null; }   // 그 단계에는 사진이 없다
  if (!r.ok) throw new Error('sat ' + r.status);                              // 그 밖의 오류는 그대로 던진다
  return r.blob();
}
function _satAncestor(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (!_satBmp.has(key)) {
    if (_satBmp.size > 96) _satBmp.delete(_satBmp.keys().next().value);
    // 여러 타일이 함께 기다리므로 한 타일의 취소 신호에 묶지 않는다
    _satBmp.set(key, _satFetch(z, x, y).then(b => (b ? createImageBitmap(b) : null))
      .catch(e => { _satBmp.delete(key); throw e; }));
  }
  return _satBmp.get(key);
}
function _mapCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function _canvasToBlob(cv, type, q) {
  if (cv.convertToBlob) return cv.convertToBlob({ type, quality: q });
  return new Promise(res => cv.toBlob(res, type, q));
}
// 위성 타일(ArrayBuffer) — 다 만든 것은 타일 저장소(_tileGet)에 두고 지도 세 장이 함께 쓴다
async function _satTile(z, x, y) {
  const b = await _tileGet('sat', z, x, y, () => _satMake(z, x, y));
  return b.arrayBuffer();
}
async function _satMake(z, x, y) {
  const own = await _satFetch(z, x, y);
  if (own) return own;
  const cv = _mapCanvas(256, 256), ctx = cv.getContext('2d');
  for (let k = 1; k <= SAT_UP_LEVELS && z - k >= 0; k++) {
    const bmp = await _satAncestor(z - k, x >> k, y >> k);
    if (!bmp) continue;
    const n = 1 << k, sz = bmp.width / n;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bmp, (x & (n - 1)) * sz, (y & (n - 1)) * sz, sz, sz, 0, 0, 256, 256);
    return _canvasToBlob(cv, 'image/jpeg', 0.9);   // 사진이다 — PNG 보다 빨리 만들고 작다
  }
  ctx.fillStyle = SAT_SEA; ctx.fillRect(0, 0, 256, 256);
  return _canvasToBlob(cv, 'image/png');
}

// ── 바다는 무조건 평평하게 ──
// 지형 타일의 바다에는 수심(음수)이 들어 있는데 확대 단계마다 다르고(덜 자세한 단계는
// 0m, 자세한 단계는 서해 수십 m · 동해 수 km), 해안 가까이에는 수심과 육지 자료를 이어
// 붙인 흔적으로 0~5m 의 잔물결 같은 값까지 섞여 있다. 그대로 그리면 낮게 날 때 바다가
// 0m 와 수심 사이를 오가며 뛰어(1인칭 카메라가 그 높이를 따라 튀어 화면이 점멸하고,
// 수면의 함정이 보이지 않았다) 바다가 울퉁불퉁하다.
// 5m 아래는 모두 해수면(0m)으로 펴고, 5~15m 는 0~15m 로 부드럽게 이어 15m 위의 땅은
// 그대로 둔다(턱이 지지 않게). 해안의 아주 낮은 땅(부두·모래사장)도 해수면이 된다.
// 3D 지형(_demTile)과 SIM 의 땅(simTerrainFt)이 같은 규칙을 쓴다.
const SEA_FLAT_M = 5, SEA_BLEND_M = 15;
function seaFlatM(m) {
  if (!(m > SEA_FLAT_M)) return 0;                 // 수심·잔물결(그리고 NaN)
  if (m >= SEA_BLEND_M) return m;
  return (m - SEA_FLAT_M) * SEA_BLEND_M / (SEA_BLEND_M - SEA_FLAT_M);
}
// ── 활주로는 공항표고로 평평하게 ──
// 지형 자료는 활주로 위에서도 수 m 씩 들쑥날쑥하다(칸이 성기고 주변 건물·둑이 섞인다).
// 지도의 ICAO 공항 활주로(data/runways.js — 끝 너머 RWY_END_M · 옆 RWY_SIDE_M 여유)를
// 공항표고로 펴고, 그 밖 RWY_BLEND_M 에 걸쳐 원래 땅으로 부드럽게 잇는다(턱이 지지 않게).
// 바다 펴기 다음에 건다. 3D 지형(_demMake)과 SIM 의 땅(simTerrainFt)·전파고도(terrainFtAt)가
// 같은 규칙을 쓴다 — 화면 속 활주로와 바퀴가 닿는 높이가 같다.
const RWY_END_M = 60, RWY_SIDE_M = 30, RWY_BLEND_M = 150;
const RWY_MIN_Z = 12;     // 3D 지형은 이 단계부터 편다(한 칸 30m 안팎 — 그보다 성기면 활주로가 한 칸도 안 된다)
const _rwyZones = (typeof RUNWAYS === 'undefined' ? [] : RUNWAYS).flatMap(ap => {
  const elevM = ap.elev * 0.3048;
  const zone = (lat0, lon0, ux, uy, half, halfW, rad) => {
    const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
    const R = half + halfW + rad + RWY_BLEND_M;
    return { elevM, lat0, lon0, kx, ky, ux, uy, half, halfW, rad,
             s: lat0 - R / ky, n: lat0 + R / ky, w0: lon0 - R / kx, e: lon0 + R / kx };
  };
  if (ap.rwys) return ap.rwys.map(r => {
    const lat0 = (r.a[0] + r.b[0]) / 2, lon0 = (r.a[1] + r.b[1]) / 2;
    const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
    const dx = (r.b[1] - r.a[1]) * kx, dy = (r.b[0] - r.a[0]) * ky, L = Math.hypot(dx, dy) || 1;
    return zone(lat0, lon0, dx / L, dy / L, L / 2 + RWY_END_M, r.w / 2 + RWY_SIDE_M, 0);
  });
  const ref = (typeof AIRPORTS_KR !== 'undefined') ? AIRPORTS_KR.find(a => a.icao === ap.apt) : null;
  return (ap.disk && ref) ? [zone(ref.lat, ref.lon, 1, 0, 0, 0, ap.disk)] : [];
});
// 그 자리를 얼마나 펴는가 — { elevM(공항표고, m), w(0 … 1) } · 활주로 둘레 밖이면 null
function rwyFlatAt(lat, lon, zones = _rwyZones) {
  let best = null;
  for (const z of zones) {
    if (lat < z.s || lat > z.n || lon < z.w0 || lon > z.e) continue;
    const x = (lon - z.lon0) * z.kx, y = (lat - z.lat0) * z.ky;
    const u = x * z.ux + y * z.uy, v = y * z.ux - x * z.uy;          // 활주로 방향 · 옆
    const d = Math.max(0, Math.hypot(Math.max(0, Math.abs(u) - z.half), Math.max(0, Math.abs(v) - z.halfW)) - z.rad);
    if (d >= RWY_BLEND_M) continue;
    const t = 1 - d / RWY_BLEND_M, w = t * t * (3 - 2 * t);
    if (!best || w > best.w) best = { elevM: z.elevM, w };
  }
  return best;
}
// 지형 높이(m · 바다를 편 뒤)에 활주로 평탄화를 얹는다
function rwyFlatM(lat, lon, m, zones) {
  const f = rwyFlatAt(lat, lon, zones);
  return f ? m + (f.elevM - m) * f.w : m;
}
// 이 위경도 범위에 걸치는 활주로들(3D 지형 타일 한 장을 고칠 때 미리 추린다)
function _rwyZonesIn(s, n, w0, e) {
  return _rwyZones.filter(z => z.n >= s && z.s <= n && z.e >= w0 && z.w0 <= e);
}
const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
// 지형 타일(ArrayBuffer) — 바다를 편 것을 타일 저장소에 두고 함께 쓴다
async function _demTile(z, x, y) {
  const b = await _tileGet('dem', z, x, y, () => _demMake(z, x, y));
  return b.arrayBuffer();
}
async function _demMake(z, x, y) {
  const r = await fetch(`${DEM_URL}/${z}/${x}/${y}.png`);
  if (!r.ok) throw new Error('dem ' + r.status);
  const blob = await r.blob();
  // 색 보정·알파 곱셈이 끼면 높이 값(RGB)이 틀어진다 — 받은 값 그대로 읽는다
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const cv = _mapCanvas(bmp.width, bmp.height), ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height), d = img.data;
  const W = bmp.width, H = bmp.height, n = 1 << z;
  const put = (i, m) => {                      // terrarium 부호로 적는다
    const v = m + 32768, vi = Math.floor(v);
    d[i] = vi >> 8; d[i + 1] = vi & 255; d[i + 2] = Math.min(255, Math.round((v - vi) * 256)); d[i + 3] = 255;
  };
  const get = i => d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;   // 높이 = R×256 + G + B/256 − 32768
  let changed = false;
  // ① 바다 펴기 — 타일 전체
  for (let i = 0; i < d.length; i += 4) {
    const m = get(i);
    if (m >= SEA_BLEND_M) continue;
    put(i, seaFlatM(m)); changed = true;
  }
  // ② 활주로 펴기 — 걸치는 활주로 둘레의 칸만(한 칸이 30m 보다 작은 단계부터 · RWY_MIN_Z)
  if (z >= RWY_MIN_Z) {
    const gx = lon => (lon + 180) / 360 * n * W - x * W;
    const gy = lat => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n * H - y * H; };
    const lonAt = px => (x + (px + 0.5) / W) / n * 360 - 180;
    const latAt = py => Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + (py + 0.5) / H) / n))) * 180 / Math.PI;
    const zones = _rwyZonesIn(latAt(H - 1), latAt(0), lonAt(0), lonAt(W - 1));
    const done = zones.length ? new Uint8Array(W * H) : null;   // 겹친 둘레의 칸을 두 번 펴지 않게
    for (const zn of zones) {
      const x0 = Math.max(0, Math.floor(gx(zn.w0))), x1 = Math.min(W - 1, Math.ceil(gx(zn.e)));
      const y0 = Math.max(0, Math.floor(gy(zn.n))), y1 = Math.min(H - 1, Math.ceil(gy(zn.s)));
      for (let py = y0; py <= y1; py++) {
        const lat = latAt(py);
        for (let px = x0; px <= x1; px++) {
          const k = py * W + px;
          if (done[k]) continue;
          done[k] = 1;
          const i = k * 4, m = get(i), m2 = rwyFlatM(lat, lonAt(px), m, zones);
          if (m2 !== m) { put(i, m2); changed = true; }
        }
      }
    }
  }
  if (!changed) return blob;                   // 바다·낮은 땅·활주로가 없는 타일은 받은 그대로
  ctx.putImageData(img, 0, 0);
  return _canvasToBlob(cv, 'image/png');       // 높이 값이다 — 손실 없이(PNG)
}

// ── 3D 타일 저장소 — 20NM 안의 지형·사진을 들고 있는다 ──
// 3D 본 화면과 CHIN 창 둘(지도 세 장)이 같은 타일을 저마다 받고 저마다 고치면(바다 펴기 ·
// 빈 칸 메우기) 같은 일을 세 번 한다 — 낮게 빨리 날 때 화면이 버벅이던 큰 까닭이다.
// 다 고친 타일을 한 곳에 두고 함께 쓴다. 한 지도가 그 타일을 버려도(화면 밖으로 지나감)
// 받기를 끊지 않는다 — 다른 지도가 기다리고 있을 수 있고, 다시 오면 바로 쓴다.
//   · 항공기에서 20NM(TILE_KEEP_NM) 밖으로 벗어난 타일은 지운다
//   · 20NM 안의 덜 자세한 단계(11·12)와 발밑 4NM 의 지형(14)은 미리 받아 둔다 —
//     낮게 빨리 날 때도 먼 곳·발밑이 비지 않는다
//   · 그래도 너무 많아지면(TILE_MAX) 오래 안 쓴 것부터 지운다
const TILE_KEEP_NM = 20;
const TILE_MAX = { sat: 600, dem: 300 };   // 휴대 기기에서도 수십 MB 를 넘지 않게
const _tileStore = { sat: new Map(), dem: new Map() };     // 'z/x/y' → Promise<Blob>
function _tileGet(kind, z, x, y, make) {
  const m = _tileStore[kind], key = `${z}/${x}/${y}`;
  let p = m.get(key);
  if (p) { m.delete(key); m.set(key, p); return p; }       // 최근에 쓴 것으로 옮긴다
  p = make().catch(e => { if (m.get(key) === p) m.delete(key); throw e; });
  m.set(key, p);
  if (m.size > TILE_MAX[kind]) m.delete(m.keys().next().value);
  return p;
}
function tileStoreClear() {
  _tileStore.sat.clear(); _tileStore.dem.clear();
  _pfQueue = []; _pfFail.clear(); _pfAt = null;
}
// 타일 한가운데와 반 대각선(NM)
function _tileCenter(z, x, y) {
  const n = 1 << z, lon = (x + 0.5) / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) / D2R;
  return { lat, lon, half: 40075 / 1.852 * Math.cos(lat * D2R) / n * 0.7072 };
}
function _tileXY(z, lat, lon) {
  const n = 1 << z, r = lat * D2R;
  return { x: Math.floor((lon + 180) / 360 * n),
           y: Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n) };
}
// 항공기에서 nm 안에 걸치는 타일인가
function _tileNear(z, x, y, lat, lon, nm) {
  const c = _tileCenter(z, x, y);
  return distance(lat, lon, c.lat, c.lon) - c.half <= nm;
}
// 20NM 밖으로 벗어난 타일을 지운다(아주 덜 자세한 단계 — 8 아래 — 는 넓어서 그대로 둔다)
function tileStoreTrim(lat = S.lat, lon = S.lon) {
  let n = 0;
  for (const kind of ['sat', 'dem']) {
    const m = _tileStore[kind];
    for (const key of [...m.keys()]) {
      const [z, x, y] = key.split('/').map(Number);
      if (z >= 8 && !_tileNear(z, x, y, lat, lon, TILE_KEEP_NM)) { m.delete(key); n++; }
    }
  }
  return n;
}
// 미리 받아 둘 것 — [종류, 단계, 반경 NM]. 화질이 그 단계를 쓰지 않으면 건너뛴다
const TILE_PREFETCH = [['dem', 11, 20], ['sat', 11, 20], ['dem', 12, 20], ['sat', 12, 20], ['dem', 14, 4]];
const TILE_PF_PAR = 4;          // 한꺼번에 받는 수
let _pfQueue = [], _pfActive = 0, _pfAt = null;
const _pfFail = new Map();      // 받지 못한 타일 — 1분 동안은 다시 묻지 않는다
function _tilePrefetchList(lat, lon) {
  const q = MAP3D_QUALITY[map3dQuality], out = [];
  TILE_PREFETCH.forEach(([kind, z, nm]) => {
    if (z > (kind === 'sat' ? q.satMax : q.demMax)) return;
    const c = _tileXY(z, lat, lon), span = Math.ceil(nm / _tileCenter(z, c.x, c.y).half / 1.4) + 1;
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (y < 0 || y >= (1 << z) || !_tileNear(z, x, y, lat, lon, nm)) continue;
      const cc = _tileCenter(z, x, y);
      out.push({ kind, z, x, y, d: distance(lat, lon, cc.lat, cc.lon) });
    }
  });
  return out.sort((a, b) => a.d - b.d);               // 가까운 것부터
}
function _pfPump() {
  while (_pfActive < TILE_PF_PAR && _pfQueue.length) {
    const t = _pfQueue.shift(), key = `${t.z}/${t.x}/${t.y}`;
    if (_tileStore[t.kind].has(key)) continue;
    const f = _pfFail.get(t.kind + key);
    if (f && Date.now() - f < 60000) continue;
    _pfActive++;
    (t.kind === 'sat' ? _satTile : _demTile)(t.z, t.x, t.y)
      .catch(() => { _pfFail.set(t.kind + key, Date.now()); })
      .finally(() => { _pfActive--; _pfPump(); });
  }
}
// 3D 가 떠 있는 동안 몇 초마다 — 20NM 밖은 지우고, 1NM 넘게 옮겨 왔으면 받을 목록을 새로 짠다
function tilePrefetchTick() {
  if (!_ml3d || !_map3dShown()) return;
  tileStoreTrim(S.lat, S.lon);
  if (!_pfAt || distance(_pfAt[0], _pfAt[1], S.lat, S.lon) > 1) {
    _pfAt = [S.lat, S.lon];
    _pfQueue = _tilePrefetchList(S.lat, S.lon);
  }
  _pfPump();
}
setInterval(() => { try { tilePrefetchTick(); } catch (e) { _swallow(e); } }, 4000);

try {
  if (typeof maplibregl !== 'undefined' && maplibregl.addProtocol) {
    const zxy = (re, url) => { const m = re.exec(url); return m ? [+m[1], +m[2], +m[3]] : null; };
    maplibregl.addProtocol('sat', (params) => {
      const t = zxy(/^sat:\/\/(\d+)\/(\d+)\/(\d+)/, params.url);
      if (!t) return Promise.reject(new Error('bad sat url ' + params.url));
      return _satTile(t[0], t[1], t[2]).then(data => ({ data }));
    });
    maplibregl.addProtocol('dem', (params) => {
      const t = zxy(/^dem:\/\/(\d+)\/(\d+)\/(\d+)/, params.url);
      if (!t) return Promise.reject(new Error('bad dem url ' + params.url));
      return _demTile(t[0], t[1], t[2]).then(data => ({ data }));
    });
  }
} catch (e) { _swallow(e); }

// 3D 지도의 하늘·안개 — 본 화면과 CHIN 창이 같이 쓴다
const MAP3D_SKY = {
  'sky-color': '#1a2a4a',
  'sky-horizon-blend': 0.5,
  'horizon-color': '#6699bb',
  'horizon-fog-blend': 0.3,
  'fog-color': '#aabbcc',
  'fog-ground-blend': 0.9
};
// 3D 지도의 바탕(위성 사진 + 지형) — 본 화면과 CHIN 창이 같이 쓴다.
// 몇 단계까지 자세히 받는지는 화질(map3dQuality)을 따른다. 그보다 가까이 가면 그 단계를
// 늘려 쓴다(타일을 더 받지 않는다).
function _map3dStyle() {
  const q = MAP3D_QUALITY[map3dQuality];
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['sat://{z}/{x}/{y}'],      // 빈 칸은 위 단계 사진으로 메운다(_satTile)
        tileSize: 256,
        maxzoom: q.satMax,
        attribution: 'Tiles © Esri'
      },
      terrain: {
        type: 'raster-dem',
        encoding: 'terrarium',
        tiles: ['dem://{z}/{x}/{y}'],      // 바다 밑은 0m 로 편다(_demTile)
        minzoom: 0, maxzoom: q.demMax,
        tileSize: 256,
        attribution: 'Terrain © Tilezen/AWS'
      }
    },
    layers: [
      // 새 타일이 들어올 때 서서히 나타나게(0.3초) 하지 않는다 — 그동안 화면을 계속
      // 다시 그려야 해서, 타일이 쉴 새 없이 들어오는 저고도 비행에서 버벅임이 된다
      { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-fade-duration': 0 } }
    ]
  };
}
// 지도가 지금 어느 화질의 바탕으로 그려져 있는가 — { q: 화질, loaded: 바탕을 다 얹었나 }
const _map3dQ = new WeakMap();
// 이미 뜬 지도의 바탕을 지금 화질로 바꿔 얹는다(위성 사진 맨 아래 · 지형)
function _map3dApplyQuality(map, chin) {
  const st = _map3dQ.get(map);
  try { map.setPixelRatio(map3dPixelRatio(chin)); } catch (e) { _swallow(e); }
  if (!st || !st.loaded || st.q === map3dQuality) return;
  const sty = _map3dStyle(), layers = map.getStyle().layers;
  const i = layers.findIndex(l => l.id === 'satellite');
  const before = (i >= 0 && layers[i + 1]) ? layers[i + 1].id : undefined;
  const terr = !!map.getTerrain();
  if (terr) map.setTerrain(null);
  map.removeLayer('satellite'); map.removeSource('satellite');
  map.addSource('satellite', sty.sources.satellite);
  map.addLayer(sty.layers[0], before);
  map.removeSource('terrain'); map.addSource('terrain', sty.sources.terrain);
  if (terr) map.setTerrain({ source: 'terrain', exaggeration: MAP3D_EXAG });
  st.q = map3dQuality;
}
// ── 수평 시선에서 화질이 떨어지지 않게 ──
// maplibre 는 화면 중심이 땅 위에 있다고 보고, '카메라가 중심보다 얼마나 높은가'
// (= cos(피치) × 중심까지 거리)로 타일마다 화질(줌)을 정한다. SIM 1인칭에서 기수가 꼭
// 수평이면(120kt 수평 자세 · 카메라 피치 90°) 그 높이가 0 이 되어, 모든 타일을 비스듬히
// 누운 것으로 보고 화질을 크게 낮춘다 — 1° 만 들거나 숙여도 되돌아왔다.
// 그래서 그 높이를 '시선 1°' 만큼은 늘 있는 것으로 셈한다(그 밖에는 maplibre 셈 그대로).
const LOD_MIN_SIN = Math.sin(1 * Math.PI / 180);
function _map3dLodGuard(map) {
  if (!map || !map.style || !map.style.tileManagers || typeof map.setSourceTileLodParams !== 'function') return;
  for (const id in map.style.tileManagers) {
    let src = null;
    try { src = map.style.tileManagers[id].getSource(); } catch (e) { _swallow(e); }
    if (!src || (src.calculateTileZoom && src.calculateTileZoom._lodGuard)) continue;
    // 따로 정한 셈이 없으면 maplibre 기본값(9.314 · 3)으로 하나 받아 감싼다
    if (typeof src.calculateTileZoom !== 'function') {
      try { map.setSourceTileLodParams(9.314, 3, id); } catch (e) { _swallow(e); continue; }
    }
    const base = src.calculateTileZoom;
    if (typeof base !== 'function') continue;
    // (요청 줌, 타일까지 수평 거리, 카메라 높이(중심 기준), 중심까지 거리, 시야각)
    const guarded = (zoom, d2, dz, d3, fov) => {
      const z = Math.max(dz, d3 * LOD_MIN_SIN);
      if (z === dz) return base(zoom, d2, dz, d3, fov);
      return base(zoom, d2, z, Math.hypot(Math.sqrt(Math.max(0, d3 * d3 - dz * dz)), z), fov);
    };
    guarded._lodGuard = true;
    src.calculateTileZoom = guarded;
  }
}
function setMap3dQuality(q) {
  if (!MAP3D_QUALITY[q]) return;
  map3dQuality = q;
  try { localStorage.setItem('map3dQuality', q); } catch (e) { _swallow(e); }
  _q3dBtnSync();
  if (_ml3d) { try { _map3dApplyQuality(_ml3d, false); } catch (e) { _swallow(e); } }
  // CHIN 창은 새로 연다(작은 지도라 금방이다)
  if (_chinMaps.length) { _chinDestroy(); try { syncChinView(); } catch (e) { _swallow(e); } }
  _pfAt = null;                                  // 미리 받을 목록도 새 화질로
  requestAnimationFrame(() => { try { if (_ml3d) _applyFollow(); } catch (e) { _swallow(e); } });
}
// 화질 버튼 — 상 → 중 → 하 → 상
function cycleMap3dQuality() {
  const i = MAP3D_QUALITY_ORDER.indexOf(map3dQuality);
  setMap3dQuality(MAP3D_QUALITY_ORDER[(i + 1) % MAP3D_QUALITY_ORDER.length]);
}
function _q3dBtnSync() {
  const b = document.getElementById('q3d-btn');
  if (b) b.textContent = '화질 ' + MAP3D_QUALITY[map3dQuality].name;
}

function _init3dMap() {
  if (_ml3d) {
    // Already initialised — just jump to current aircraft position
    _ml3d.resize();
    _ml3d.jumpTo({ center: [S.lon, S.lat] });
    _update3dMarker();
    return;
  }

  try {
    _ml3d = new maplibregl.Map({
      container: 'map3d',
      style: _map3dStyle(),
      center: [S.lon, S.lat],
      zoom: 11,
      pitch: 55,
      bearing: 0,
      // SIM 모드 1인칭은 기수를 들면 하늘을 봐야 하므로 90° 너머까지 연다
      // (평소 3D 추종·기울기 버튼은 종전대로 85° 안에서 쓴다)
      maxPitch: 180,
      pixelRatio: map3dPixelRatio(false),          // 화질(상·중·하)
      attributionControl: false
    });
    _map3dQ.set(_ml3d, { q: map3dQuality, loaded: false });
  } catch (e) {
    console.error('[3D] map init failed:', e);
    return;
  }

  _ml3dReady = true;   // 카메라는 지금부터 움직일 수 있다(타일을 기다리지 않는다)
  _q3dBtnSync();       // 이 기기에 적어 둔 화질을 버튼에 적는다
  // 흰수리 3D 모형(15-heli3d.js) — 지도 꾸밈이 서는 대로 얹는다(타일을 기다리지 않는다)
  const _heliAdd = () => { try { if (typeof heli3dAddTo === 'function') heli3dAddTo(_ml3d); } catch (e) { _swallow(e); } };
  _ml3d.on('style.load', _heliAdd);
  try { if (_ml3d.isStyleLoaded()) _heliAdd(); } catch (e) { _swallow(e); }

  _ml3d.on('error', (e) => console.warn('[3D] map error:', e && e.error ? e.error.message : e));
  // 사용자가 3D 지도를 수동 회전할 때도 마커가 실제 기수를 가리키도록 갱신
  _ml3d.on('rotate', () => { try { _update3dMarker(); } catch(e) { _swallow(e); } });

  _ml3d.on('load', () => {
    _ml3dReady = true;
    // Terrain is best-effort — a DEM failure must not blank the satellite view
    try { _ml3d.setTerrain({ source: 'terrain', exaggeration: MAP3D_EXAG }); }
    catch (e) { console.warn('[3D] terrain unavailable:', e); }
    try { _ml3d.setSky(MAP3D_SKY); } catch (e) { /* sky optional */ }
    // 다 뜨기 전에 화질을 바꿨으면 이제 바꿔 얹는다
    try { _map3dQ.get(_ml3d).loaded = true; _map3dApplyQuality(_ml3d, false); } catch (e) { _swallow(e); }

    // Aircraft marker. Maplibre controls the OUTER element's transform for
    // positioning, so heading rotation is applied to an INNER wrapper instead.
    const el = document.createElement('div');
    el.style.cssText = 'width:18px;height:18px;';
    const inner = document.createElement('div');
    inner.className = 'ac3d-inner';
    inner.style.cssText = 'width:18px;height:18px;transition:transform 0.1s linear;';
    inner.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,2 15,18 12,15 9,18" fill="#00ff88" stroke="#000" stroke-width="1"/>
    </svg>`;
    el.appendChild(inner);
    _ml3dMarker = new maplibregl.Marker({ element: el, pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
      .setLngLat([S.lon, S.lat])
      .addTo(_ml3d);
    // Aircraft trail — draped on terrain surface (no z, terrain-following)
    _ml3d.addSource('ac-trail', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
    });
    _ml3d.addLayer({
      id: 'ac-trail', type: 'line', source: 'ac-trail',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#00ff88',
        'line-width': 2.5,
        'line-opacity': 0.85
      }
    }, _firstSymbolLayerId());

    _update3dMarker();
    _update3dTrail();
    // 함정(09-cdu.js) — 실제 크기 모형과 항적
    try { if (typeof _ship3dEnsure === 'function') _ship3dEnsure(); } catch (e) { _swallow(e); }
    // 흰수리 3D 모형(15-heli3d.js) — 실제 크기(전장 20m)
    try { if (typeof heli3dAddTo === 'function') heli3dAddTo(_ml3d); } catch (e) { _swallow(e); }
    if (_fdrTrack.length) _fdrDraw3dTrackRoute();
    // 레이더가 이미 켜져 있으면 3D에도 적용
    if (rainActive && _rainFrames.length) {
      const f = _rainFrames[_rainFrameIdx];
      const tileUrl = `${f._host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`;
      try {
        _ml3d.addSource('rain-src', { type:'raster', tiles:[tileUrl], tileSize:256, attribution:'RainViewer' });
        _ml3d.addLayer({ id:'rain-layer', type:'raster', source:'rain-src', paint:{'raster-opacity':0.55} }, _firstSymbolLayerId());
      } catch {}
    }
    _ml3d.resize();
  });

  // 확대·나침반 버튼은 왼쪽 아래 축척 바로 위에(기울기 ▲▼ 는 그 오른쪽 · index.html #tilt-ctrl)
  _ml3d.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');
  // 2D와 동일한 km+NM 이중 축척 위젯(.vfr-scale) — maplibre 컨트롤 컨테이너를
  // 거치지 않고 지도 컨테이너에 직접 절대배치(left:10px)해 2D와 픽셀 단위로 정렬
  const _sc3d = new DualScale3D();
  window._ml3dScale = _sc3d;          // 검사에서 축척 계산을 직접 확인한다
  const _sc3dEl = _sc3d.onAdd(_ml3d);
  _sc3dEl.style.cssText += ';position:absolute;left:10px;bottom:62px;z-index:850;margin:0;';
  _ml3d.getContainer().appendChild(_sc3dEl);
}

// ── CHIN BUBBLE(SIM 1인칭) ──
// 헬기 조종석 발밑의 둥근 창처럼, 3D 창(정면 시야) 아래 왼쪽·오른쪽 모서리에 작은
// CHIN 창을 겹쳐 띄운다 — 정면 시야는 창 가득 그대로 두어 전방을 넓게 본다
// (창 하나가 너비 약 1/3 · 높이 2/9 · index.html). CHIN 창은 같은 바탕(위성·지형·함정)을 그리는 작은 3D 지도
// 두 장이다 — 카메라는 같은 눈 자리에서 기체를 따라 앞아래를 본다(05-gps.js 의
// _ml3dChinCamera). SIM 1인칭에서만 쓰고, 나오면 지도를 지워 그래픽 자원을 돌려준다.
let chinL = false, chinR = false;   // L CHIN · R CHIN — 왼쪽만·오른쪽만·둘 다·모두 끔(처음에는 꺼 둔다)
let chinViewOn = false;            // 둘 중 하나라도 켜져 있는가(chinL || chinR)
let _chinMaps = [];               // [{ map, side: -1 왼쪽 · +1 오른쪽, ship: 함정 레이어를 얹었나 }]
function _chinWanted() {
  // 외부 시점(15-heli3d.js)에서는 조종석 창이 뜻이 없다 — 닫는다
  const ext = (typeof simExtView !== 'undefined') && simExtView;
  const tx = (typeof simCamTx !== 'undefined') && simCamTx;   // 시점이 바뀌는 동안은 닫아 둔다(조종석에 들어선 뒤 연다)
  return chinViewOn && !ext && !tx && (typeof simModeOn !== 'undefined') && simModeOn && !!_ml3d && _map3dShown();
}
// 지금 상태에 맞춰 CHIN 창을 열고 닫는다 — SIM 진입·해제, 3D 창 옮기기, 버튼에서 부른다
// (1인칭 카메라가 매 프레임 부르지만 바뀐 것이 없으면 아무것도 하지 않는다)
function syncChinView() {
  const d3 = document.getElementById('map3d');
  const row = document.getElementById('chin-row');
  if (!d3 || !row) return;
  const sim = (typeof simModeOn !== 'undefined') && simModeOn;
  const btn = document.getElementById('chin-btn');
  if (btn) {
    if (btn.classList.contains('show') !== sim) btn.classList.toggle('show', sim);
    const bl = document.getElementById('chin-l-btn'), br = document.getElementById('chin-r-btn');
    if (bl && bl.classList.contains('on') !== chinL) bl.classList.toggle('on', chinL);
    if (br && br.classList.contains('on') !== chinR) br.classList.toggle('on', chinR);
  }
  // SIM 이면 축척·3D 확대/기울기 버튼을 감춘다(index.html #map3d.sim3d)
  // (Cockpit Mode 의 조종석 시야도 같다 — 07-sim.js cockpitStart · 15-heli3d.js ckCamOn)
  const fp = sim || (typeof ckCamOn === 'function' && ckCamOn());
  if (d3.classList.contains('sim3d') !== fp) d3.classList.toggle('sim3d', fp);
  // 켜진 쪽 CHIN 창만 보인다
  const pl = document.getElementById('chin-l'), pr = document.getElementById('chin-r');
  if (pl) pl.style.visibility = chinL ? '' : 'hidden';
  if (pr) pr.style.visibility = chinR ? '' : 'hidden';
  // 1인칭의 기수(15-heli3d.js) — 외부 시점·SIM 해제면 숨긴다
  try { if (typeof heli3dNoseSync === 'function' && !(sim && !((typeof simExtView !== 'undefined') && simExtView))) heli3dNoseSync(null); }
  catch (e) { _swallow(e); }
  // 외부 시점 버튼(EXT) — SIM 에서만 보인다
  const ext = document.getElementById('ext-btn');
  const extOn = (typeof simExtView !== 'undefined') && simExtView;
  if (ext) {
    if (ext.classList.contains('show') !== sim) ext.classList.toggle('show', sim);
    if (ext.classList.contains('on') !== extOn) ext.classList.toggle('on', extOn);
  }
  // 외부 시점 카메라 버튼 — SIM 의 EXT 일 때만
  const ec = document.getElementById('extcam-3d');
  if (ec && ec.classList.contains('show') !== (sim && extOn)) ec.classList.toggle('show', sim && extOn);
  // 3D 지도 바로 뒤에 붙어 다닌다(2D 위에 겹쳐 쓰든, 제 창으로 옮겨 가든)
  if (row.previousElementSibling !== d3) d3.after(row);
  const want = _chinWanted();
  // 정면 시야의 크기는 그대로다(CHIN 창은 그 위에 겹친다) — 다시 잴 것이 없다
  if (d3.classList.contains('chin-on') !== want) d3.classList.toggle('chin-on', want);
  if (want && !_chinMaps.length) _chinCreate();
  else if (!want && _chinMaps.length) _chinDestroy();
}
function _chinCreate() {
  if (typeof maplibregl === 'undefined') return;
  [['chin-l', -1], ['chin-r', 1]].forEach(([id, side]) => {
    const el = document.getElementById(id);
    if (!el) return;
    let map;
    try {
      map = new maplibregl.Map({
        container: el, style: _map3dStyle(),
        center: [S.lon, S.lat], zoom: 14, pitch: 45, bearing: S.hdg, maxPitch: 180,
        interactive: false, attributionControl: false,
        // 작은 창이다 — 화질(상 1.5배 · 중 1배 · 하 0.6배)을 넘지 않게 그려 그래픽 부담을 줄인다
        pixelRatio: map3dPixelRatio(true)
      });
    } catch (e) { console.warn('[3D] chin view failed:', e); return; }
    const c = { map, side, ship: false };
    map.on('error', (e) => console.warn('[3D] chin error:', e && e.error ? e.error.message : e));
    map.on('load', () => {
      try { map.setTerrain({ source: 'terrain', exaggeration: MAP3D_EXAG }); } catch (e) { _swallow(e); }
      try { map.setSky(MAP3D_SKY); } catch (e) { _swallow(e); }
      // 함정도 같이 보인다(발밑 창으로 갑판을 보며 내려앉는다)
      try { if (typeof _ship3dAddTo === 'function') { _ship3dAddTo(map); c.ship = true; } } catch (e) { _swallow(e); }
    });
    // 카메라가 눈 자리에 있어야 하므로 화면 중심을 지면에 묶지 않는다
    try { if (map.setCenterClampedToGround) map.setCenterClampedToGround(false); } catch (e) { _swallow(e); }
    _chinMaps.push(c);
  });
  try { if (typeof _ml3dChinCamera === 'function') _ml3dChinCamera(true); } catch (e) { _swallow(e); }
}
function _chinDestroy() {
  _chinMaps.forEach(c => { try { c.map.remove(); } catch (e) { _swallow(e); } });
  _chinMaps = [];
}
function toggleChinView(side) {
  // FCP 가 그 자리(같은 쪽 아래 모서리)를 쓰고 있으면 CHIN 창을 켤 수 없다
  // (R 자리는 화면 조종간 — 14-simmode.js vStickActive)
  const busy = k => k === 'L' ? (fcpL && fcp3dAvail()) : ((fcpR && fcp3dAvail()) || (typeof vStickActive === 'function' && vStickActive()));
  if ((side === 'L' || side === 'R') && busy(side) && !(side === 'L' ? chinL : chinR)) {
    try { uiToast(side === 'L' ? 'FCP 가 켜져 있어 L CHIN 을 열 수 없습니다' : '화면 조종간이 켜져 있어 R CHIN 을 열 수 없습니다', '', 2000); } catch (e) { _swallow(e); }
    return;
  }
  if (side === 'L') chinL = !chinL;
  else if (side === 'R') chinR = !chinR;
  else { const v = !(chinL || chinR); chinL = v && !busy('L'); chinR = v && !busy('R'); }
  chinViewOn = chinL || chinR;
  syncChinView();
  requestAnimationFrame(() => { try { if (_ml3d) _applyFollow(); } catch (e) { _swallow(e); } });
}

// ── 3D 화면의 FCP ──
// PFD 아래 FCP(.ctrl-bar 의 세 줄)를 통째로 3D 화면 왼쪽 아래에 한 창으로 띄운다(FCP ON/OFF 버튼 하나).
// 버튼 그 자체를 옮겨 오므로 기능·상태가 그대로다(닫으면 제자리로 돌려놓는다). PFD 가 화면에 없는
// 3D 단독(3D Only) 화면에서만 연다 — 분할 화면은 PFD 아래에 FCP 가 이미 있다. 켜면 L CHIN 창은 닫힌다.
// (안쪽 이름은 L·R 두 칸이던 때를 따른다 — 지금은 L 칸 하나만 쓴다)
let fcpL = false, fcpR = false;
let _fcpParts = null;            // [{ el, side, row, ph(제자리 표시) }]
let _fcpKey = '';
function fcp3dAvail() {
  return (typeof _soloActive !== 'undefined') && _soloActive && _soloCurrent === 'm3d' && !!_ml3d && _map3dShown();
}
function _fcpSplit() {
  if (_fcpParts) return _fcpParts;
  const bar = document.querySelector('#pfd-wrap .ctrl-bar');
  if (!bar) return [];
  _fcpParts = [];
  // 3D 단독 화면에서도 비행 조작에 쓰는 PFD 소프트키를 FCP 패널 바로 위에 — 첫 줄 소프트키, 둘째 줄 FCP 패널(07-sim.js)
  const sk = bar.querySelector(':scope > #pfd-sk');
  const simple = bar.querySelector(':scope > #fcp-simple');
  let off = 0;
  if (sk) _fcpParts.push({ el: sk, side: 'L', row: off++, ph: null });
  if (simple) _fcpParts.push({ el: simple, side: 'L', row: off++, ph: null });
  [...bar.querySelectorAll(':scope > .ctrl-sub-row')].forEach((row, r0) => {
    const ri = r0 + off;
    // 칸(무리)만 세어 반으로 가르고, 칸 사이 구분선(.ctrl-div)은 뒤 칸을 따라간다(반의 맨 앞 구분선은 두고 간다)
    const kids = [...row.children];
    const items = kids.filter(e => !e.classList.contains('ctrl-div'));
    const half = items.length;          // 한 창 — 모두 왼쪽(L) 칸으로
    let seen = 0, last = { L: false, R: false };
    kids.forEach((el, i) => {
      if (el.classList.contains('ctrl-div')) {
        const next = kids.slice(i + 1).find(e => !e.classList.contains('ctrl-div'));
        if (!next) return;
        const sd = items.indexOf(next) < half ? 'L' : 'R';
        if (last[sd]) _fcpParts.push({ el, side: sd, row: ri, ph: null });
        return;
      }
      const sd = seen < half ? 'L' : 'R'; seen++;
      last[sd] = true;
      _fcpParts.push({ el, side: sd, row: ri, ph: null });
    });
  });
  return _fcpParts;
}
function _fcpBox(side) {
  const d3 = document.getElementById('map3d');
  if (!d3) return null;
  const id = side === 'L' ? 'fcp3d-l' : 'fcp3d-r';
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement('div'); box.id = id; box.className = 'fcp3d fcp3d-' + side.toLowerCase();
    const inner = document.createElement('div'); inner.className = 'fcp3d-in ctrl-bar';
    for (let r = 0; r < 3; r++) { const rd = document.createElement('div'); rd.className = 'ctrl-sub-row'; inner.appendChild(rd); }
    box.appendChild(inner);
    d3.appendChild(box);
  }
  return box;
}
// 3D 화면 너비의 반 · 높이의 45% 안에 들도록 줄여 그리고(키우지는 않는다) 상자를 그 크기로
function _fcpFit(box) {
  const inner = box && box.firstElementChild;
  const host = box && box.parentElement;
  if (!inner || !host) return;
  inner.style.transform = 'none';
  const nw = inner.scrollWidth, nh = inner.scrollHeight;
  if (!nw || !nh) return;
  const k = Math.min(1, host.clientWidth * 0.5 / nw, host.clientHeight * 0.45 / nh);
  inner.style.transform = `scale(${k.toFixed(4)})`;
  box.style.width = Math.ceil(nw * k) + 4 + 'px';
  box.style.height = Math.ceil(nh * k) + 4 + 'px';
}
function syncFcp3d() {
  const avail = fcp3dAvail();
  const wantL = avail && fcpL, wantR = avail && fcpR;
  ['L', 'R'].forEach(sd => {
    const b = document.getElementById('fcp-' + sd.toLowerCase() + '-btn');
    if (!b) return;
    const on = sd === 'L' ? wantL : wantR;
    if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    if (sd === 'L') { const t = fcpL ? 'FCP ON' : 'FCP OFF'; if (b.textContent !== t) b.textContent = t; }
    if (b.classList.contains('dim') === avail) b.classList.toggle('dim', !avail);
  });
  const key = `${wantL}|${wantR}`;
  if (key === _fcpKey) return;
  _fcpKey = key;
  _fcpSplit().forEach(p => {
    const want = p.side === 'L' ? wantL : wantR;
    if (want && !p.ph) {
      p.ph = document.createComment('fcp3d'); p.el.before(p.ph);
      const box = _fcpBox(p.side);
      if (box) box.firstElementChild.children[p.row].appendChild(p.el);
    } else if (!want && p.ph) {
      p.ph.replaceWith(p.el); p.ph = null;
    }
  });
  ['L', 'R'].forEach(sd => {
    const box = _fcpBox(sd); if (!box) return;
    const on = sd === 'L' ? wantL : wantR;
    box.classList.toggle('show', on);
    if (on) requestAnimationFrame(() => _fcpFit(box));
  });
  // FCP 를 연 쪽의 CHIN 창은 닫는다
  let ch = false;
  if (wantL && chinL) { chinL = false; ch = true; }
  if (wantR && chinR) { chinR = false; ch = true; }
  if (ch) { chinViewOn = chinL || chinR; try { syncChinView(); } catch (e) { _swallow(e); } }
}
function toggleFcp3d(side) {
  if (!fcp3dAvail()) {
    try { uiToast('FCP 는 3D 단독(3D Only) 화면에서 엽니다 — 분할 화면은 PFD 아래에 FCP 가 있습니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  fcpL = !fcpL; fcpR = false;          // 한 창(왼쪽 아래)
  syncFcp3d();
}
window.addEventListener('resize', () => {
  ['fcp3d-l', 'fcp3d-r'].forEach(id => { const b = document.getElementById(id); if (b && b.classList.contains('show')) _fcpFit(b); });
});
// (버튼 연결은 14-simmode.js 에서 — 이 파일은 appRegister(09-cdu.js)보다 먼저 읽힌다)

// 3D 조작 버튼 묶음 접기/펴기(index.html #ctl3d)
function toggleCtl3d() {
  const box = document.getElementById('ctl3d'); if (!box) return;
  const c = box.classList.toggle('collapsed');
  const t = document.getElementById('ctl3d-tog'); if (t) t.textContent = c ? '▼ 3D 버튼' : '▲ 접기';
}
// 3D(maplibre)용 이중 축척 — 2D L.Control.DualScale과 동일한 마크업/CSS·계산방식
class DualScale3D {
  onAdd(map) {
    this._map = map;
    const div = document.createElement('div');
    div.className = 'vfr-scale';
    const kmRow = document.createElement('div'); kmRow.className = 'vfr-scale-row';
    this._kmBar = document.createElement('div'); this._kmBar.className = 'vfr-scale-bar vfr-scale-km';
    this._kmLbl = document.createElement('span');
    kmRow.appendChild(this._kmBar); kmRow.appendChild(this._kmLbl);
    const nmRow = document.createElement('div'); nmRow.className = 'vfr-scale-row';
    this._nmBar = document.createElement('div'); this._nmBar.className = 'vfr-scale-bar vfr-scale-nm';
    this._nmLbl = document.createElement('span');
    nmRow.appendChild(this._nmBar); nmRow.appendChild(this._nmLbl);
    div.appendChild(kmRow); div.appendChild(nmRow);
    this._div = div;
    this._upd = () => this._update();
    map.on('move', this._upd);
    this._update();
    return div;
  }
  onRemove() { if (this._map) this._map.off('move', this._upd); if (this._div) this._div.remove(); }
  _mpp() {
    // 화면 하단(축척 위치) 줄의 m/px — 카메라 기하로 셈한다.
    // 종전에는 unproject() 로 땅 위 두 점을 집었는데, 지형을 켜면 unproject 가
    // GPU 에서 화면을 읽어 와야 해서(readPixels) 그릴 때마다 렌더링이 멈췄다.
    // 카메라가 매 프레임 움직이는 추종·SIM 에서 3D 가 버벅거린 원인이 그것이다.
    //   중심의 m/px = 78,271.5 × cos(위도) / 2^zoom   (512px 타일)
    //   아래쪽 줄은 원근으로 가까워진다: × cos(a)·cos(φ) / cos(φ − a)
    //     φ = 기울기, a = 그 줄이 중심선에서 아래로 벌어진 각
    const m = this._map, H = m.getContainer().clientHeight || 1;
    const mppC = 78271.51696 * Math.cos(m.getCenter().lat * D2R) / Math.pow(2, m.getZoom());
    let fov = 36.87;
    try { if (Number.isFinite(m.transform.fov)) fov = m.transform.fov; } catch (e) { _swallow(e); }
    const f = (H / 2) / Math.tan(fov / 2 * D2R);
    const a = Math.atan(Math.max(0, H / 2 - 60) / f);
    const phi = Math.min(85, Math.max(0, m.getPitch())) * D2R;
    return mppC * Math.cos(a) * Math.cos(phi) / Math.cos(phi - a);
  }
  _nice(maxM, unitM, unit, mpp) {
    const steps = [0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10,20,50,100,200,500,1000];
    const maxU = maxM / unitM;
    let v = steps[0];
    for (const s of steps) { if (s <= maxU) v = s; else break; }
    return { px: v * unitM / mpp, label: v + ' ' + unit };
  }
  _update() {
    // 1인칭(SIM)은 지평선을 보는 그림이라 축척이 뜻이 없다 — 숨긴다
    const hide = (typeof simModeOn !== 'undefined') && simModeOn;
    if (this._div.style.display !== (hide ? 'none' : '')) this._div.style.display = hide ? 'none' : '';
    if (hide) return;
    const MAXW = 120, mpp = this._mpp();
    if (!isFinite(mpp) || mpp <= 0) return;
    const maxM = MAXW * mpp;
    const km = this._nice(maxM, 1000, 'km', mpp);
    const nm = this._nice(maxM, 1852, 'NM', mpp);
    this._kmBar.style.width = Math.min(km.px, MAXW) + 'px'; this._kmLbl.textContent = km.label;
    this._nmBar.style.width = Math.min(nm.px, MAXW) + 'px'; this._nmLbl.textContent = nm.label;
  }
}

function _update3dMarker() {
  // 흰수리 모형(15-heli3d.js)이 화면에 있으면 매 프레임 다시 그린다(SIM 외부 시점 포함)
  try { if (typeof heli3dTick === 'function') heli3dTick(); } catch (e) { _swallow(e); }
  if (!_ml3d || !_ml3dMarker || !_map3dShown()) return;
  // 1인칭(SIM)에서는 눈이 곧 헬기 자리다 — 제 마커는 지도에서 아예 뗀다.
  // 숨기기만 하면 maplibre 가 지형에 가렸는지 보려고 GPU 에서 화면을 읽어 와
  // (readPixels) 매 프레임 렌더링이 멈칫한다.
  const sim = (typeof simModeOn !== 'undefined') && simModeOn;
  const onMap = !!_ml3dMarker.getElement().isConnected;
  if (sim) { if (onMap) _ml3dMarker.remove(); return; }
  if (!onMap) _ml3dMarker.addTo(_ml3d);
  _ml3dMarker.setLngLat([S.lon, S.lat]);
  // 모형이 충분히 크게 보이면 삼각형 표식은 숨긴다 — 멀어서 작으면 표식으로 자리를 보인다
  {
    let big = false;
    try { if (typeof heli3dScreenLen === 'function') big = heli3dScreenLen(_ml3d) >= HELI3D_MARKER_PX; }
    catch (e) { _swallow(e); }
    const el = _ml3dMarker.getElement();
    if ((el.style.visibility === 'hidden') !== big) el.style.visibility = big ? 'hidden' : '';
  }
  // Rotate the inner wrapper (outer element's transform is owned by maplibre)
  // rotationAlignment:'viewport'(화면 기준)이므로 카메라 방위를 빼야
  // 삼각형이 실제 기수방향을 가리킨다 (예: 팔로우 중에는 항상 화면 위쪽).
  const inner = _ml3dMarker.getElement().querySelector('.ac3d-inner');
  if (inner) inner.style.transform = `rotate(${S.hdg - _ml3d.getBearing()}deg)`;
}

let rainLayer = null;
let rainActive = false;
let _rainFrames = [];
let _rainFrameIdx = 0;
let _rainAnimTimer = null;
let _rainRefreshTimer = null;
let _rain3dLayerId = null;

async function _loadRainFrames() {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  const data = await res.json();
  return { host: data.host, frames: data.radar.past.slice(-6) }; // 최근 6프레임
}

function _setRainFrame(host, frame) {
  if (rainLayer) { leafMap.removeLayer(rainLayer); rainLayer = null; }
  const tileUrl = `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  rainLayer = L.tileLayer(tileUrl, { opacity: 0.6, attribution: 'RainViewer', zIndex: 500 });
  rainLayer.addTo(leafMap);

  // 3D 맵에도 적용
  if (_ml3d && _ml3d.loaded()) {
    const src = _ml3d.getSource ? _ml3d.getSource('rain-src') : null;
    if (src) {
      src.tiles = [tileUrl];
      src.setTiles([tileUrl]);
    } else {
      try {
        if (_ml3d.getSource('rain-src')) _ml3d.removeLayer('rain-layer'), _ml3d.removeSource('rain-src');
      } catch {}
      _ml3d.addSource('rain-src', { type:'raster', tiles:[tileUrl], tileSize:256, attribution:'RainViewer' });
      _ml3d.addLayer({ id:'rain-layer', type:'raster', source:'rain-src', paint:{'raster-opacity':0.55} }, _firstSymbolLayerId());
      _rain3dLayerId = 'rain-layer';
    }
  }

  // 타임스탬프 표시
  const ts = new Date(frame.time * 1000);
  const label = `${ts.getUTCHours().toString().padStart(2,'0')}:${ts.getUTCMinutes().toString().padStart(2,'0')}Z`;
  const btn = document.getElementById('rain-btn');
  if (btn) btn.textContent = `RAIN ${label}`;
}

function _startRainAnim() {
  if (_rainAnimTimer) clearInterval(_rainAnimTimer);
  _rainAnimTimer = setInterval(() => {
    if (!_rainFrames.length) return;
    _rainFrameIdx = (_rainFrameIdx + 1) % _rainFrames.length;
    _setRainFrame(_rainFrames[0]._host, _rainFrames[_rainFrameIdx]);
  }, 800);
}

function _stopRainAnim() {
  if (_rainAnimTimer) { clearInterval(_rainAnimTimer); _rainAnimTimer = null; }
}

async function toggleRain() {
  const btn = document.getElementById('rain-btn');
  if (rainActive) {
    _stopRainAnim();
    if (_rainRefreshTimer) { clearInterval(_rainRefreshTimer); _rainRefreshTimer = null; }
    if (rainLayer) { leafMap.removeLayer(rainLayer); rainLayer = null; }
    if (_ml3d && _ml3d.loaded()) {
      try { _ml3d.removeLayer('rain-layer'); _ml3d.removeSource('rain-src'); } catch {}
    }
    rainActive = false;
    btn.classList.remove('rain-active');
    btn.textContent = 'RAIN';
    return;
  }
  btn.textContent = '…';
  try {
    const { host, frames } = await _loadRainFrames();
    _rainFrames = frames.map(f => ({ ...f, _host: host }));
    _rainFrameIdx = _rainFrames.length - 1;
    _setRainFrame(host, _rainFrames[_rainFrameIdx]);
    rainActive = true;
    btn.classList.add('rain-active');
    _startRainAnim();
    // 5분마다 자동 갱신
    _rainRefreshTimer = setInterval(async () => {
      try {
        const { host: h2, frames: f2 } = await _loadRainFrames();
        _rainFrames = f2.map(f => ({ ...f, _host: h2 }));
        _rainFrameIdx = _rainFrames.length - 1;
      } catch {}
    }, 5 * 60 * 1000);
  } catch (e) {
    btn.textContent = 'RAIN';
    uiAlert('강수 레이더 로드 실패. 네트워크를 확인하세요.');
  }
}

let windLayer = null;
let windActive = false;

async function loadWindLayer() {
  const bounds = leafMap.getBounds();
  const latMin = bounds.getSouth(), latMax = bounds.getNorth();
  const lonMin = bounds.getWest(), lonMax = bounds.getEast();
  const gridN = 8;
  const latStep = (latMax - latMin) / (gridN - 1);
  const lonStep = (lonMax - lonMin) / (gridN - 1);

  const lats = [], lons = [];
  for (let i = 0; i < gridN; i++) {
    lats.push(+(latMin + i * latStep).toFixed(4));
    lons.push(+(lonMin + i * lonStep).toFixed(4));
  }

  const latParam = lats.join(',');
  const lonParam = lons.join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latParam}&longitude=${lonParam}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timeformat=unixtime`;

  const res = await fetch(url);
  const data = await res.json();
  const entries = Array.isArray(data) ? data : [data];

  const uData = [], vData = [];
  for (let j = 0; j < gridN; j++) {
    const row = entries[j] || entries[0];
    const spd = row.current.wind_speed_10m;
    const dir = row.current.wind_direction_10m * Math.PI / 180;
    const u = -spd * Math.sin(dir);
    const v = -spd * Math.cos(dir);
    for (let i = 0; i < gridN; i++) {
      uData.push(u);
      vData.push(v);
    }
  }

  const velocityData = [
    {
      header: {
        parameterCategory: 2, parameterNumber: 2,
        lo1: lonMin, lo2: lonMax, la1: latMax, la2: latMin,
        dx: (lonMax - lonMin) / (gridN - 1), dy: (latMax - latMin) / (gridN - 1),
        nx: gridN, ny: gridN
      },
      data: uData
    },
    {
      header: {
        parameterCategory: 2, parameterNumber: 3,
        lo1: lonMin, lo2: lonMax, la1: latMax, la2: latMin,
        dx: (lonMax - lonMin) / (gridN - 1), dy: (latMax - latMin) / (gridN - 1),
        nx: gridN, ny: gridN
      },
      data: vData
    }
  ];

  return L.velocityLayer({
    data: velocityData,
    maxVelocity: 20,
    velocityScale: 0.008,
    particleAge: 64,
    lineWidth: 1.5,
    particleMultiplier: 0.003,
    colorScale: ['#ffffcc','#a1dab4','#41b6c4','#2c7fb8','#253494'],
    displayValues: true,
    displayOptions: {
      velocityType: 'Wind',
      position: 'bottomleft',
      emptyString: '바람 데이터 없음',
      angleConvention: 'bearingCCW',
      speedUnit: 'm/s'
    }
  });
}

let _windAptLayer = null;

async function _loadAirportWinds() {
  // Open-Meteo에서 모든 공항 풍향/풍속 병렬 요청
  const base = 'https://api.open-meteo.com/v1/forecast?current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timeformat=unixtime';
  const results = await Promise.allSettled(
    AIRPORTS_KR.map(a =>
      fetch(`${base}&latitude=${a.lat}&longitude=${a.lon}`)
        .then(r => r.json())
        .then(d => ({ icao: a.icao, name: a.name, lat: a.lat, lon: a.lon,
          spd: Math.round(d.current.wind_speed_10m),
          dir: Math.round(d.current.wind_direction_10m) }))
    )
  );
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

function _makeWindIcon(dir, spd) {
  const color = spd < 10 ? '#88ffcc' : spd < 20 ? '#ffdd44' : '#ff6644';
  return L.divIcon({
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    html: `<div style="width:48px;height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
      <div style="font-size:18px;transform:rotate(${dir}deg);line-height:1;color:${color};">↑</div>
      <div style="font-size:9px;color:${color};font-weight:bold;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;line-height:1.2;">${spd}kt</div>
    </div>`,
  });
}

async function toggleWind() {
  const btn = document.getElementById('wind-btn');
  if (windActive) {
    if (windLayer) { leafMap.removeLayer(windLayer); windLayer = null; }
    if (_windAptLayer) { leafMap.removeLayer(_windAptLayer); _windAptLayer = null; }
    windActive = false;
    btn.classList.remove('wind-active');
    btn.textContent = 'WIND';
    return;
  }
  btn.textContent = '…';
  try {
    // 속도장 레이어 + 공항 풍향 화살표 동시 로드
    const [wl, aptWinds] = await Promise.all([loadWindLayer(), _loadAirportWinds()]);
    windLayer = wl;
    windLayer.addTo(leafMap);

    _windAptLayer = L.layerGroup(
      aptWinds.map(w => L.marker([w.lat, w.lon], { icon: _makeWindIcon(w.dir, w.spd), zIndexOffset: 600 })
        .bindTooltip(`${w.icao} ${w.name}<br>${fmtA(toMag(w.dir))}° / ${w.spd}kt`, { direction:'top', offset:[0,-24] }))
    ).addTo(leafMap);

    windActive = true;
    btn.classList.add('wind-active');
    btn.textContent = 'WIND';
  } catch (e) {
    console.error('Wind layer error:', e);
    btn.textContent = 'WIND';
    uiAlert('바람 데이터 로드 실패. 네트워크를 확인하세요.');
  }
}

// 2D 지도의 내 헬기 — 흰수리 평면도(위에서 본 모습). 1.8px = 1m 로 그려 전장 20m 가 36px 다.
// 기준점(가운데 20,20)은 3D 모형·착함 판정과 같은 전장의 한가운데. 기수가 위(북)이고 기수 방향만큼 돌린다.
//   흰 동체 · 붉은 엔진 덮개 · 노랑 → 파랑 꼬리 · 연료탱크 · 왼쪽 수평안정판 · 오른쪽 꼬리로터 · 주로터 4엽
const AC_ICON_SVG = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="14.7" r="12.7" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-dasharray="1.6 1.4" opacity="0.6"/>
  <ellipse cx="16.76" cy="19.5" rx="0.95" ry="2.8" fill="#f4f5f6" stroke="#111" stroke-width="0.45"/>
  <ellipse cx="23.24" cy="19.5" rx="0.95" ry="2.8" fill="#f4f5f6" stroke="#111" stroke-width="0.45"/>
  <path d="M20 2.9 L20.9 3.8 L21.4 4.9 L22.1 7 L22.34 8.8 L22.38 10.1 L22.38 20.7 L22.2 22.2 L21.8 23.6 L21.44 25
           L21.08 27.2 L20.81 29.9 L20.6 32.6 L20.47 35.1 L20 36.65 L19.53 35.1 L19.4 32.6 L19.19 29.9 L18.92 27.2
           L18.56 25 L18.2 23.6 L17.8 22.2 L17.62 20.7 L17.62 10.1 L17.66 8.8 L17.9 7 L18.6 4.9 L19.1 3.8 Z"
        fill="#f4f5f6" stroke="#111" stroke-width="0.6" stroke-linejoin="round"/>
  <path d="M18.5 8.1 Q20 7.3 21.5 8.1 L21.6 22.9 L18.4 22.9 Z" fill="#d9262c"/>
  <rect x="17.85" y="13.5" width="0.75" height="8.1" rx="0.35" fill="#3b3f45"/>
  <rect x="21.4" y="13.5" width="0.75" height="8.1" rx="0.35" fill="#3b3f45"/>
  <path d="M18 22.9 L22 22.9 L21.17 26.7 L18.83 26.7 Z" fill="#f2c21b"/>
  <path d="M18.83 26.7 L21.17 26.7 L21.08 27.2 L20.81 29.9 L20.6 32.6 L20.47 35.1 L20 36.65 L19.53 35.1 L19.4 32.6
           L19.19 29.9 L18.92 27.2 Z" fill="#233f94"/>
  <path d="M18.3 6.6 L21.7 6.6 L22.1 8.3 L17.9 8.3 Z" fill="#2a3846"/>
  <ellipse cx="20" cy="3.7" rx="0.8" ry="0.75" fill="#33363a"/>
  <path d="M19.64 32.6 L15.95 32.9 L16 34.2 L19.64 34.4 Z" fill="#d9262c" stroke="#111" stroke-width="0.35"/>
  <line x1="20.8" y1="32.8" x2="20.8" y2="38" stroke="#3b3f45" stroke-width="0.9" stroke-linecap="round"/>
  <g stroke="#3b3f45" stroke-width="1.15" stroke-linecap="round" opacity="0.9">
    <line x1="11" y1="5.7" x2="29" y2="23.7"/><line x1="29" y1="5.7" x2="11" y2="23.7"/>
  </g>
  <circle cx="20" cy="14.7" r="1.2" fill="#2b2e33"/>
</svg>`;
function makeAircraftIcon(hdg) {
  return L.divIcon({
    html:`<div class="ac-marker" style="transform:rotate(${hdg}deg);transform-origin:20px 20px;filter:drop-shadow(0 0 1px rgba(0,0,0,0.9));">${AC_ICON_SVG}</div>`,
    iconSize:[40,40],iconAnchor:[20,20],className:'',
  });
}

let acMarker = L.marker([S.lat,S.lon],{icon:makeAircraftIcon(S.hdg),draggable:true,zIndexOffset:1000}).addTo(leafMap);
let acDragging = false;
let _acEl = null; // track DOM element to avoid duplicate listeners

function _bindAcPointerDown() {
  const el = acMarker.getElement();
  if (!el || el === _acEl) return;
  _acEl = el;
  const onDown = () => { acDragging = true; };
  el.addEventListener('mousedown',  onDown);
  el.addEventListener('touchstart', onDown, {passive: true});
}
setTimeout(_bindAcPointerDown, 0);

// dragstart is too late (after Leaflet detects movement threshold), so we use DOM events above
acMarker.on('drag',    e => { const p=e.target.getLatLng(); S.lat=p.lat; S.lon=p.lng; updateNav(); });
acMarker.on('dragend', () => { acDragging=false; S.trail=[]; updateTrail(); updateNav(); });

// Fallback reset in case dragend doesn't fire
document.addEventListener('mouseup',  () => { acDragging = false; });
document.addEventListener('touchend', () => { acDragging = false; });

