// ─────────────────────────────────────────────────────────────
// 10-tools.js — 항적 기록 · 공역 경보 · 로그북 · FDR 재생
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
//  TRACK RECORDER — 비행 항적 기록 → GPX/KML 저장
// ═══════════════════════════════════════════════════════════════
let _trkRec = false;
let _trkPts = [];        // {lat, lon, altM, t(ms)}
let _trkTimer = null;
const TRK_BAK_KEY = 'trkRecBackup';   // 새로고침/크래시 대비 진행분 백업

// 진행 중 항적을 localStorage에 백업(간이 배열 포맷으로 용량 절약)
function _trkSaveBackup() {
  try {
    localStorage.setItem(TRK_BAK_KEY, JSON.stringify(
      _trkPts.map(p => [ +p.lat.toFixed(6), +p.lon.toFixed(6), Math.round(p.altM), p.t ])
    ));
  } catch(e) { _swallow(e); }
}
function _trkClearBackup() { try { localStorage.removeItem(TRK_BAK_KEY); } catch(e) { _swallow(e); } }
function _trkStartTimer() {
  if (_trkTimer) { clearInterval(_trkTimer); _trkTimer = null; }   // 이중 기동 방지
  document.getElementById('rec-btn').classList.add('active');
  document.getElementById('rec-btn').textContent = '● REC';
  _trkCapture();
  _trkTimer = setInterval(_trkCapture, 2000);   // 2초 간격 기록
}

function toggleTrackRec() {
  if (_trkRec) { _trkStop(); return; }
  _trkRec = true;
  _trkPts = [];
  _trkStartTimer();
}
function _trkCapture() {
  if (typeof S === 'undefined' || S.lat == null) return;
  const last = _trkPts[_trkPts.length - 1];
  // 정지 상태 중복 기록 방지(약 5m 미만 이동 시 60초에 1점만)
  if (last && distance(last.lat, last.lon, S.lat, S.lon) < 0.0027 && Date.now() - last.t < 60000) return;
  _trkPts.push({ lat: S.lat, lon: S.lon, altM: (S.alt || 0) * 0.3048, t: Date.now() });
  // 10초(5점)마다 백업 → 새로고침·크래시에도 진행분 보존
  if (_trkPts.length % 5 === 0) _trkSaveBackup();
}
// 화면 이탈/새로고침 직전 마지막 상태 백업
window.addEventListener('pagehide', () => { if (_trkRec) _trkSaveBackup(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _trkRec) _trkSaveBackup();
});
function _trkStop() {
  _trkRec = false;
  if (_trkTimer) { clearInterval(_trkTimer); _trkTimer = null; }
  const btn = document.getElementById('rec-btn');
  btn.classList.remove('active'); btn.textContent = 'REC';
  _trkClearBackup();   // 정상 종료 → 백업 불필요
  if (_trkPts.length < 2) { alert('기록된 항적이 없습니다 (2점 미만).'); return; }
  // 로그북(IndexedDB)에 자동 저장 → 나중에 FDR 패널에서 내보내기/삭제 가능
  const rec = {
    id: Date.now(), t0: _trkPts[0].t, t1: _trkPts[_trkPts.length-1].t,
    n: _trkPts.length, distNM: _logTrackDist(_trkPts), pts: _trkPts
  };
  _logPut(rec).catch(e => console.warn('로그북 저장 실패:', e.message));
  const asGpx = confirm(
    `항적 ${_trkPts.length}점 · 로그북 저장 완료.\n\n` +
    `확인 = 지금 GPX로 내보내기\n취소 = 나중에 (FDR 패널 → 로그북에서 GPX/KML 내보내기)`);
  if (asGpx) {
    const d = new Date(_trkPts[0].t);
    const p2 = n => String(n).padStart(2, '0');
    const fname = `track_${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
    _trkDownload(fname + '.gpx', _trkToGpx(_trkPts), 'application/gpx+xml');
  }
}
function _trkToGpx(trkPts = _trkPts) {
  const pts = trkPts.map(p =>
    `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.altM.toFixed(1)}</ele><time>${new Date(p.t).toISOString()}</time></trkpt>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FlightSimulator" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>Flight Track</name><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>`;
}
function _trkToKml(trkPts = _trkPts) {
  // gx:Track(시간 포함) — 앱 FDR로 그대로 리플레이 가능
  const whens  = trkPts.map(p => `<when>${new Date(p.t).toISOString()}</when>`).join('\n');
  const coords = trkPts.map(p => `<gx:coord>${p.lon.toFixed(6)} ${p.lat.toFixed(6)} ${p.altM.toFixed(1)}</gx:coord>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">\n<Document><Placemark><name>Flight Track</name>\n<gx:Track>\n${whens}\n${coords}\n</gx:Track>\n</Placemark></Document>\n</kml>`;
}
// 시작 시 미종료 백업이 있으면 복구 제안(새로고침·크래시로 끊긴 녹화)
setTimeout(() => {
  let bak = null;
  try { bak = JSON.parse(localStorage.getItem(TRK_BAK_KEY) || 'null'); } catch(e) { _swallow(e); }
  if (!Array.isArray(bak) || bak.length < 2) return;
  const pts = bak.map(a => ({ lat: a[0], lon: a[1], altM: a[2], t: a[3] }));
  const from = new Date(pts[0].t), p2 = n => String(n).padStart(2, '0');
  const resume = confirm(
    `이전 세션에서 녹화 중이던 항적 ${pts.length}점이 복구되었습니다.\n` +
    `(시작: ${p2(from.getHours())}:${p2(from.getMinutes())})\n\n` +
    `확인 = 이어서 녹화 계속\n취소 = 지금 파일로 저장하고 종료`
  );
  _trkPts = pts;
  if (resume) {
    _trkRec = true;
    _trkStartTimer();
  } else {
    _trkRec = false;
    _trkStop();   // 저장 다이얼로그(GPX/KML) → 백업 정리
  }
}, 1500);

function _trkDownload(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// ═══════════════════════════════════════════════════════════════
//  화면 꺼짐 방지 (Wake Lock) — GPS/비행/녹화 중 자동 유지
// ═══════════════════════════════════════════════════════════════
let _wakeLock = null;
async function _wakeAcquire() {
  try {
    if (!_wakeLock && 'wakeLock' in navigator) {
      _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release', () => { _wakeLock = null; });
    }
  } catch(e) { _swallow(e); }
}
function _wakeRelease() {
  try { if (_wakeLock) { _wakeLock.release(); _wakeLock = null; } } catch(e) { _swallow(e); }
}
function _wakeWanted() { return gpsMode || S.running || _trkRec; }
setInterval(() => { _wakeWanted() ? _wakeAcquire() : _wakeRelease(); }, 5000);
// 백그라운드 복귀 시 OS가 해제한 락 재획득
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && _wakeWanted()) _wakeAcquire();
});

// ═══════════════════════════════════════════════════════════════
//  공역 접근/진입 경보 — 패널에서 켠(aspcOn) 구역 대상
// ═══════════════════════════════════════════════════════════════
const ASPC_WARN_NM = 3;          // 접근 경보 거리
let _aspcAlertState = {};        // id → 'in' | 'near' | undefined

// ── 경보 INHIBIT (공역경보 / HTAWS) ──
let inhibAspc = false, inhibTaws = false;
try {
  inhibAspc = localStorage.getItem('inhibAspc') === '1';
  inhibTaws = localStorage.getItem('inhibTaws') === '1';
} catch(e) { _swallow(e); }
function toggleInhibMenu(force) {
  const m = document.getElementById('inhib-menu');
  if (force === false) m.classList.remove('open');
  else m.classList.toggle('open');
  _inhibRender();
}
function toggleInhib(which) {
  if (which === 'aspc') {
    inhibAspc = !inhibAspc;
    try { localStorage.setItem('inhibAspc', inhibAspc ? '1' : '0'); } catch(e) { _swallow(e); }
    if (inhibAspc) { const el = document.getElementById('aspc-alert'); if (el) el.className = ''; _aspcAlertState = {}; }
  } else {
    inhibTaws = !inhibTaws;
    try { localStorage.setItem('inhibTaws', inhibTaws ? '1' : '0'); } catch(e) { _swallow(e); }
    if (inhibTaws) { const ta = document.getElementById('terrain-alert'); if (ta) ta.classList.remove('on'); }
  }
  _inhibRender();
}
function _inhibRender() {
  const a = document.getElementById('inhib-aspc-btn');
  const t = document.getElementById('inhib-taws-btn');
  if (a) { a.classList.toggle('inhibited', inhibAspc); a.querySelector('span').textContent = inhibAspc ? 'INHIBIT' : 'ON'; }
  if (t) { t.classList.toggle('inhibited', inhibTaws); t.querySelector('span').textContent = inhibTaws ? 'INHIBIT' : 'ON'; }
  const b = document.getElementById('inhib-btn');
  if (b) b.classList.toggle('inhib-active', inhibAspc || inhibTaws);
}
setTimeout(_inhibRender, 100);   // 초기 상태 반영

function _aspcPointIn(a, lat, lon) {
  if (a.circle) return distance(lat, lon, a.circle.c[0], a.circle.c[1]) <= a.circle.r;
  // ray casting
  const p = a.poly; let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const yi = p[i][0], xi = p[i][1], yj = p[j][0], xj = p[j][1];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function _aspcDistNM(a, lat, lon) {
  if (a.circle) return Math.max(0, distance(lat, lon, a.circle.c[0], a.circle.c[1]) - a.circle.r);
  if (_aspcPointIn(a, lat, lon)) return 0;
  // 등장방형 근사 평면에서 점-선분 최소거리(NM)
  const k = Math.cos(lat * D2R);
  const px = lon * k * 60, py = lat * 60;
  let best = Infinity;
  const p = a.poly;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const ax = p[j][1] * k * 60, ay = p[j][0] * 60;
    const bx = p[i][1] * k * 60, by = p[i][0] * 60;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy;
    best = Math.min(best, Math.hypot(px - qx, py - qy));
  }
  return best;
}
function _aspcAlertCheck() {
  const el = document.getElementById('aspc-alert');
  if (!el) return;
  if (inhibAspc || !(gpsMode || S.running)) { el.className = ''; _aspcAlertState = {}; return; }
  let insideA = null, nearA = null, nearD = ASPC_WARN_NM;
  AIRSPACE_DB.forEach(a => {
    if (!aspcOn[a.id]) return;
    if (a.grp === 'FIR' || a.grp === 'KADIZ') return;   // 광역 경계는 진입 경보 제외
    const d = _aspcDistNM(a, S.lat, S.lon);
    if (d <= 0.001) { if (!insideA) insideA = a; }
    else if (d < nearD) { nearD = d; nearA = a; }
  });
  // 상태 전이 시에만 진동(반복 경보 방지)
  if (insideA) {
    if (_aspcAlertState[insideA.id] !== 'in') {
      _aspcAlertState = { [insideA.id]: 'in' };
      try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch(e) { _swallow(e); }
    }
    el.textContent = `⚠ ${insideA.name} 진입`;
    el.className = 'inside';
  } else if (nearA) {
    if (_aspcAlertState[nearA.id] !== 'near') {
      _aspcAlertState = { [nearA.id]: 'near' };
      try { navigator.vibrate && navigator.vibrate(150); } catch(e) { _swallow(e); }
    }
    el.textContent = `${nearA.name} 접근 ${uDist(nearD)}`;
    el.className = 'near';
  } else {
    _aspcAlertState = {};
    el.className = '';
  }
}
setInterval(() => { try { _aspcAlertCheck(); } catch(e) { _swallow(e); } }, 5000);

// ═══════════════════════════════════════════════════════════════
//  항적 로그북 — REC 종료 시 IndexedDB 자동 저장, FDR 패널에서 관리
// ═══════════════════════════════════════════════════════════════
function _logDB() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('TrackLog', 1);
    q.onupgradeneeded = e => e.target.result.createObjectStore('tracks', { keyPath: 'id' });
    q.onsuccess = e => res(e.target.result);
    q.onerror = e => rej(e.target.error);
  });
}
async function _logPut(rec) {
  const db = await _logDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').put(rec);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}
async function _logAll() {
  const db = await _logDB();
  return new Promise((res, rej) => {
    const q = db.transaction('tracks', 'readonly').objectStore('tracks').getAll();
    q.onsuccess = e => res(e.target.result || []);
    q.onerror = e => rej(e.target.error);
  });
}
async function _logDel(id) {
  const db = await _logDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').delete(id);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}
function _logTrackDist(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += distance(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
  return d;
}
async function renderLogbook() {
  const box = document.getElementById('logbook-list');
  if (!box) return;
  let recs = [];
  try { recs = await _logAll(); } catch(e) { _swallow(e); }
  recs.sort((a, b) => b.id - a.id);
  if (!recs.length) { box.innerHTML = '<div style="color:#556;font-size:9px;padding:3px 0;">저장된 항적 없음</div>'; return; }
  const p2 = n => String(n).padStart(2, '0');
  box.innerHTML = recs.map(r => {
    const d = new Date(r.id);
    const mins = Math.round((r.t1 - r.t0) / 60000);
    return `<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid #1a2436;font-size:9px;color:#aab;">
      <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${d.getMonth()+1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())} · ${mins}분 · ${r.distNM.toFixed(1)}NM</div>
      <span onclick="logExport(${r.id},'gpx')" style="cursor:pointer;color:#7ab8f5;border:1px solid #2a4a6a;border-radius:3px;padding:1px 5px;">GPX</span>
      <span onclick="logExport(${r.id},'kml')" style="cursor:pointer;color:#8bc34a;border:1px solid #3a5a2a;border-radius:3px;padding:1px 5px;">KML</span>
      <span onclick="logDelete(${r.id})" style="cursor:pointer;color:#f44336;border:1px solid #5a2222;border-radius:3px;padding:1px 5px;">✕</span>
    </div>`;
  }).join('');
}
async function logExport(id, fmt) {
  const recs = await _logAll();
  const r = recs.find(x => x.id === id);
  if (!r) return;
  const d = new Date(r.t0), p2 = n => String(n).padStart(2, '0');
  const fname = `track_${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
  if (fmt === 'gpx') _trkDownload(fname + '.gpx', _trkToGpx(r.pts), 'application/gpx+xml');
  else               _trkDownload(fname + '.kml', _trkToKml(r.pts), 'application/vnd.google-earth.kml+xml');
}
async function logDelete(id) {
  if (!confirm('이 항적을 로그북에서 삭제할까요?')) return;
  await _logDel(id);
  renderLogbook();
}

// ═══════════════════════════════════════════════════════════════
//  FDR (GPX REPLAY)
// ═══════════════════════════════════════════════════════════════
let _fdrTrack      = [];     // interpolated track for playback
let _fdrRawTrack   = [];     // original GPX points — used for route preview line only
let _fdrIdx        = 0;      // current playback index
let _fdrSpeed      = 1;      // playback speed multiplier
let _fdrRafId      = null;   // requestAnimationFrame handle
let _fdrWallStart  = 0;      // wall-clock ms when play/resume began
let _fdrTrackStart = 0;      // track timeMs at start of current play segment
let _fdrLayer2d    = null;   // Leaflet polyline
let _fdrMarker2d   = null;   // Leaflet marker for current position
let _fdrLayer3d    = null;   // maplibre source id flag

function toggleFdrPanel() {
  const panel = document.getElementById('fdr-panel');
  const btn   = document.getElementById('fdr-btn');
  const open  = panel.classList.toggle('open');
  btn.classList.toggle('active', open);
  if (open) { try { renderLogbook(); } catch(e) { _swallow(e); } }
}

// ── NOTAM / KML / GPX overlay ──────────────────────────
// ── ENR 항로 픽스 오버레이 (AIP ENR 픽스 좌표표에서 전사) ──
// 형식: 이름 위도(DDMMSS) 경도(DDDMMSS). 교차검증: SAKTI/BIGOB/ATASO/NONOS = ENR 3.6과 일치
const ENR_FIX_RAW =
  'AGAVO 371000 1240000,AGSUS 364521 1304044,AKPON 334650 1271953,ANDOL 373958 1330000,' +
  'ANKUS 350730 1284616,ANROD 343758 1282952,ANSIM 372323 1245009,ANUBA 350746 1273523,' +
  'APARU 352442 1290932,APELA 344323 1291400,ATASO 355344 1265657,ATINA 334320 1270423,' +
  'ATOTI 300013 1251154,BASEM 365037 1275710,BEDAR 315401 1262910,BEDES 360905 1264844,' +
  'BEDOM 352513 1291754,BELTU 371218 1254759,BEPKO 333910 1265514,BESNA 343718 1290751,' +
  'BIDRI 362007 1242453,BIGOB 364325 1280952,BIKSI 374032 1283504,BILUM 334613 1270439,' +
  'BINIL 372349 1251359,BITUX 361645 1280148,BODOL 371122 1244954,BOGAN 371241 1262812,' +
  'BONSO 302840 1250851,BOPTA 364406 1263658,BULGA 355609 1294924,BULTI 364322 1264930,' +
  'BUSKO 374033 1301610,DABIK 361743 1301143,DALPO 365835 1242453,DALSU 350731 1264206,' +
  'DANPA 353036 1242453,DANTI 371806 1243929,DOMKO 322848 1255859,DOTOL 341515 1263637,' +
  'EGOBA 372915 1272246,ELAPI 362014 1285051,ELGEP 314653 1255617,ELPOS 355410 1264707,' +
  'ENGOT 344834 1282952,ENSAL 365554 1274747,ENSUM 321302 1244635,ENTEL 362311 1265705,' +
  'ESNEG 371014 1295051,GOGET 372442 1263036,GONAV 371048 1242453,GONAX 362311 1265016,' +
  'GOSBO 341517 1274734,GUKDO 370111 1273823,GUKSU 335251 1264357,GUNKU 363414 1265949,' +
  'IGDOK 353104 1274907,IGRAS 371846 1324411,IKEDO 314314 1253948,INVOK 344719 1291923,' +
  'IPDAS 341515 1264301,KAKSO 370745 1272637,KALEK 351232 1295305,KALMA 371845 1270645,' +
  'KALOD 353012 1284626,KAMIT 341514 1264618,KANKA 313155 1253504,KANSU 383800 1322830,' +
  'KARBU 373159 1273952,KIDOS 335028 1263402,LAMEN 313636 1240000,LANAT 362224 1312542,' +
  'LAPAL 355413 1290452,LESBU 374116 1294104,LIMDI 333313 1254953,LINTA 353116 1265119,' +
  'LOSNI 333315 1264153,LOSTO 362016 1292548,MAKDU 362712 1274909,MAKET 335452 1271953,' +
  'MAKSA 353011 1265422,MALSO 375440 1314904,MANGI 353011 1264432,MANOL 333629 1265514,' +
  'MASTA 352847 1283340,MEKIL 363322 1264953,MELES 355251 1271542,MONSI 371247 1265015,' +
  'MOXID 362311 1264359,MUGUS 300006 1245712,NIRAT 320354 1260329,NISAV 341519 1275835,' +
  'NOBUT 370715 1291957,NOGON 372250 1242505,NONOS 364046 1242453,NOPIK 372412 1253905,' +
  'NULDI 342514 1263739,OLBIM 371411 1240751,OLMEN 364413 1265928,OLMUD 350225 1284916,' +
  'OMKIM 331320 1264114,OMOTU 350033 1285022,ONATA 382832 1320602,ONIKU 321142 1263917,' +
  'OPEDA 355149 1273652,OROGA 364456 1272718,OSPOT 365018 1272055,OSVOM 363844 1292331,' +
  'PALDU 375813 1323625,PALSA 340131 1242453,PANSI 330014 1261225,PAPLU 333441 1270337,' +
  'PEBRI 362311 1270013,PILIT 372631 1291731,POLEG 371249 1265935,PONIK 320021 1254659,' +
  'POSAN 365615 1271316,POVEM 345523 1285416,POVOR 341520 1274400,REBIT 371203 1252913,' +
  'REMOS 332605 1262329,RILRO 371033 1241442,RIMPO 350739 1273502,RINBO 355352 1265349,' +
  'RUGMA 323012 1265753,RUNIT 350734 1282952,SABET 373829 1324019,SADLI 314948 1250000,' +
  'SAKTI 365100 1274600,SAMDO 333503 1281857,SAMLO 323223 1261536,SAMUL 350736 1265154,' +
  'SAPDI 350737 1282952,SAPRA 354926 1304325,SARAM 350736 1283147,SELPA 375515 1304911,' +
  'SOSDO 330012 1262735,TAMNA 332815 1271953,TEBEX 363341 1275929,TEDAN 350744 1271852,' +
  'TENAS 373820 1313427,TESIM 313526 1255128,TOLIS 335030 1242453,TOPAX 344555 1282952,' +
  'TORUS 373625 1280807,TOSAN 330012 1264619,UGOVI 374105 1295051,UPGOS 335733 1271953,' +
  'VASLI 364252 1273003';

let _fixMarkers = [];
let fixLayerOn = false;
try { fixLayerOn = localStorage.getItem('fixLayerOn') === '1'; } catch(e) { _swallow(e); }

function _enrFixList() {
  const dms = (d, degLen) => (+d.slice(0, degLen)) + (+d.slice(degLen, degLen + 2)) / 60 + (+d.slice(degLen + 2)) / 3600;
  return ENR_FIX_RAW.split(',').map(s => {
    const [name, la, lo] = s.trim().split(/\s+/);
    return { name, lat: dms(la, 2), lon: dms(lo, 3) };
  });
}
// ── 지도 심볼 공통 팝업: 좌표 확인·복사 / Flight Plan 추가 (+심볼별 추가 동작) ──
//   o = { title, color, name, lat, lon, sub, note, extra:[{label,onclick,fg,bg}] }
function _mapSymPopup(o) {
  const btn = 'cursor:pointer;border-radius:4px;padding:5px 8px;font-size:11px;font-weight:bold;text-align:center;flex:1;';
  const extra = (o.extra || []).map(e =>
    `<span onclick="${e.onclick}" style="${btn}background:${e.bg};color:${e.fg};border:1px solid ${e.fg}55;">${e.label}</span>`).join('');
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:11px;color:#333;line-height:1.5;min-width:210px;">` +
    `<div style="color:${o.color};font-weight:bold;font-size:13px;margin-bottom:2px;">${o.title}</div>` +
    (o.sub ? `<div style="color:#555;font-size:10px;margin-bottom:2px;">${o.sub}</div>` : '') +
    `<div style="color:#333;">${decToDMS(o.lat, true)} ${decToDMS(o.lon, false)}</div>` +
    `<div style="color:#777;font-size:10px;">${o.lat.toFixed(5)}, ${o.lon.toFixed(5)}</div>` +
    (o.note ? `<div style="color:#b26a00;font-size:10px;margin-top:2px;">${o.note}</div>` : '') +
    `<div style="display:flex;gap:5px;margin-top:6px;">` +
      `<span onclick="fixCopyCoord(this,'${o.name}',${o.lat},${o.lon})" style="${btn}background:#eef3f7;color:#3b5a70;border:1px solid #3b5a7055;">📋 좌표 복사</span>` +
      `<span onclick="fixAddToPlan('${o.name}',${o.lat},${o.lon})" style="${btn}background:#e3f2ee;color:#00796b;border:1px solid #00796b55;">✈ 플랜 추가</span>` +
    `</div>` +
    (extra ? `<div style="display:flex;gap:5px;margin-top:5px;">${extra}</div>` : '') +
    `</div>`;
}
// ── 항로 픽스 팝업 ──
function _fixPopupHtml(name, lat, lon) {
  return _mapSymPopup({ title: `▲ ${name}`, color: '#00788a', name, lat, lon });
}
// ── 지도 공항 ↔ CDU INFO 연결 ──
// AIRFIELD_INFO는 2자리 코드에서 'RK'+code로 ICAO를 파생하는데, 군 비행장 일부는
// 이 규칙이 AIRPORTS_KR의 ICAO와 어긋난다(예: 이천 = INFO 'RN' → RKRN vs 지도 RKUC).
// 그래서 ICAO로 먼저 찾고, 실패하면 공항 명칭으로 한 번 더 찾는다.
function _afldIndexOf(icao) {
  try {
    let i = AIRFIELD_INFO.findIndex(a => _afldIcao(a) === icao);
    if (i >= 0) return i;
    const nm = (typeof APT_NAME !== 'undefined') ? APT_NAME[icao] : '';
    if (nm) i = AIRFIELD_INFO.findIndex(a => a.name === nm || a.name.startsWith(nm));
    return i;
  } catch(e) { return -1; }
}
function _mapOpenAirfield(icao) {
  try { leafMap.closePopup(); } catch(e) { _swallow(e); }
  const i = _afldIndexOf(icao);
  if (i < 0) return;
  if (leftSel !== 'cdu' && rightSel !== 'cdu') selectPanel(leftSel === 'map' ? 'right' : 'left', 'cdu');
  try { openAirfield(i); } catch(e) { _swallow(e); }
}
// INFO 목록에 있고, 공개 비행장이거나 잠금 해제된 경우에만 '공항 정보' 버튼을 준다(보안)
function _aptInfoAvailable(icao) {
  try {
    const i = _afldIndexOf(icao);
    if (i < 0) return false;
    const a = AIRFIELD_INFO[i];
    return !!a.pub || _afldUnlocked;
  } catch(e) { return false; }
}
// 지도 팝업 → 기존 METAR/TAF 팝업으로 전환
function mapAptWx(icao, lat, lon) {
  try { leafMap.closePopup(); } catch(e) { _swallow(e); }
  try { showAptWx(icao, APT_NAME[icao] || '', [lat, lon]); } catch(e) { _swallow(e); }
}
// 지도 VOR 팝업 → NAV1/NAV2 튜닝
function mapTuneNav(navId, freq, id) {
  try { setNavRadio(navId, freq, id); } catch(e) { _swallow(e); }
  try { leafMap.closePopup(); } catch(e) { _swallow(e); }
}
// 클립보드 복사(비보안·구형 환경 폴백 포함) + 버튼 피드백
function fixCopyCoord(el, name, lat, lon) {
  const txt = `${name} ${decToDMS(lat, true)} ${decToDMS(lon, false)} (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  const done = ok => {
    if (!el) return;
    const orig = el.textContent;
    el.textContent = ok ? '✓ 복사됨' : '복사 실패';
    setTimeout(() => { try { el.textContent = orig; } catch(e) { _swallow(e); } }, 1200);
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(() => done(true), () => done(false));
      return;
    }
  } catch(e) { _swallow(e); }
  try {   // 폴백: 임시 textarea + execCommand
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    done(ok);
  } catch(e) { done(false); }
}
// 픽스를 비행계획 웨이포인트로 추가
function fixAddToPlan(name, lat, lon) {
  pushWP({ ident: name, lat, lon });
  try { leafMap.closePopup(); } catch(e) { _swallow(e); }
}

function _drawFixLayer() {
  _clearFixLayer();
  _enrFixList().forEach(f => {
    const icon = L.divIcon({
      html: `<div style="position:relative;">
        <div style="position:absolute;left:-10px;top:-11px;width:30px;height:30px;"></div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #26c6da;filter:drop-shadow(0 0 1.5px #000);"></div>
        <div style="position:absolute;left:11px;top:-2px;color:#4dd0e1;font-size:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;font-weight:bold;white-space:nowrap;text-shadow:1px 1px 2px #000;">${f.name}</div>
      </div>`,
      iconSize: [10, 9], iconAnchor: [5, 5], className: ''
    });
    const mk = L.marker([f.lat, f.lon], { icon, interactive: true });
    mk.bindPopup(_fixPopupHtml(f.name, f.lat, f.lon), { maxWidth: 260 });
    mk.addTo(leafMap);
    _fixMarkers.push(mk);
  });
}
function _clearFixLayer() {
  _fixMarkers.forEach(m => { try { leafMap.removeLayer(m); } catch(e){ _swallow(e); } });
  _fixMarkers = [];
}
// ── 접근절차 픽스 ─────────────────────────────────────────────
// 한서대학교 태안비행장 비행절차(2025-09-01) 별첨 7 "주요 Point 좌표" 기재값.
// 문서에 함께 적힌 기준점 라디얼/거리와 대조해 검증했다(거리 오차 0.01NM 이내,
// 방위차 +0.7°는 앱의 자편차 -9° 와 현지 실제 편차의 차이).
//   MAGUM = RWY16 시단, GOSUM = RWY34 시단 (제2장 제1절 6항과 일치)
// ※ RNP 접근절차 자체는 문서상 "훈련 목적용이며 공식 인가 절차가 아님" 이라
//   IFR_DB(절차)에는 넣지 않고, 지도 표시용 좌표로만 둔다.
const APP_FIX_DB = [
  { grp:'태안 RNP 16', name:'BACKA', lat:36.784667, lon:126.286167, note:'SOWON 070R 5NM' },
  { grp:'태안 RNP 16', name:'SOWON', lat:36.745167, lon:126.194500, note:'MAGUM 340R 10NM' },
  { grp:'태안 RNP 16', name:'MOSAN', lat:36.671833, lon:126.244000, note:'MAGUM 340R 5NM · FAF 1500ft' },
  { grp:'태안 RNP 16', name:'MAGUM', lat:36.598500, lon:126.293167, note:'RWY 16 시단' },
  { grp:'태안 RNP 34', name:'KWANG', lat:36.482000, lon:126.489333, note:'YUMOK 070R 5NM' },
  { grp:'태안 RNP 34', name:'YUMOK', lat:36.442500, lon:126.398000, note:'GOSUM 160R 10NM' },
  { grp:'태안 RNP 34', name:'CASLE', lat:36.516000, lon:126.349000, note:'GOSUM 160R 5NM · FAF 1500ft' },
  { grp:'태안 RNP 34', name:'GOSUM', lat:36.589333, lon:126.299833, note:'RWY 34 시단' },
  { grp:'태안 IFR',    name:'KODOK', lat:36.782806, lon:126.695472, note:'SOT 229R 24.7D' },
  { grp:'태안 IFR',    name:'NAMPO', lat:36.386111, lon:126.759722, note:'SAN 154R 23.4D' },
  { grp:'태안 IFR',    name:'SAN',   lat:36.710000, lon:126.482333, note:'서산 TACAN · ILS I-SAN 111.50' },
  // NOROO(N37°17'46" E127°19'09", KSM 141R 13.5D)는 문서 표에 취소선이 그어져 있어 제외.
  // PDF 벡터 검사에서 그 행의 모든 셀에만 가로 취소선이 걸린 것을 확인했다.
];
let _appFixMarkers = [];
let appFixOn = {};
try { appFixOn = JSON.parse(localStorage.getItem('appFixOn') || '{}') || {}; } catch(e) { appFixOn = {}; }
const _appFixGrps = () => { const g = []; APP_FIX_DB.forEach(f => { if (!g.includes(f.grp)) g.push(f.grp); }); return g; };
const _appFixAnyOn = () => _appFixGrps().some(g => appFixOn[g]);

function _drawAppFixLayer() {
  _clearAppFixLayer();
  APP_FIX_DB.filter(f => appFixOn[f.grp]).forEach(f => {
    const icon = L.divIcon({
      html: `<div style="position:relative;">
        <div style="position:absolute;left:-10px;top:-11px;width:30px;height:30px;"></div>
        <div style="width:9px;height:9px;border:1.6px solid #ffb74d;transform:rotate(45deg);filter:drop-shadow(0 0 1.5px #000);"></div>
        <div style="position:absolute;left:13px;top:-3px;color:#ffb74d;font-size:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;font-weight:bold;white-space:nowrap;text-shadow:1px 1px 2px #000;">${f.name}</div>
      </div>`,
      iconSize: [12, 12], iconAnchor: [6, 6], className: ''
    });
    const mk = L.marker([f.lat, f.lon], { icon, interactive: true });
    mk.bindPopup(_mapSymPopup({ title: `◇ ${f.name}`, color: '#b26a00', name: f.name,
      lat: f.lat, lon: f.lon, sub: f.grp, note: f.note }), { maxWidth: 260 });
    mk.addTo(leafMap);
    _appFixMarkers.push(mk);
  });
}
function _clearAppFixLayer() {
  _appFixMarkers.forEach(m => { try { leafMap.removeLayer(m); } catch(e){ _swallow(e); } });
  _appFixMarkers = [];
}

// ── FIX 패널 (ENR 항로 픽스 / 접근절차 픽스) ──
function toggleFixPanel() {
  const p = document.getElementById('fix-panel');
  const open = !p.classList.contains('open');
  p.classList.toggle('open', open);
  if (open) _fixRenderPanel();
  _fixUpdateBtn();
}
function _fixUpdateBtn() {
  const p = document.getElementById('fix-panel');
  document.getElementById('fix-btn')
    .classList.toggle('active', fixLayerOn || _appFixAnyOn() || (p && p.classList.contains('open')));
}
function toggleFixLayer() {
  fixLayerOn = !fixLayerOn;
  if (fixLayerOn) _drawFixLayer(); else _clearFixLayer();
  try { localStorage.setItem('fixLayerOn', fixLayerOn ? '1' : '0'); } catch(e) { _swallow(e); }
  _fixRenderPanel(); _fixUpdateBtn();
}
function toggleAppFixGrp(grp) {
  appFixOn[grp] = !appFixOn[grp];
  _drawAppFixLayer();
  try { localStorage.setItem('appFixOn', JSON.stringify(appFixOn)); } catch(e) { _swallow(e); }
  _fixRenderPanel(); _fixUpdateBtn();
}
function _fixRenderPanel() {
  const p = document.getElementById('fix-panel');
  if (!p || !p.classList.contains('open')) return;
  let html = `<div class="fixp-hdr">항로 픽스</div>
    <label><input type="checkbox" ${fixLayerOn ? 'checked' : ''} onchange="toggleFixLayer()">
      <span style="color:#26c6da;">▲</span> ENR 항로 픽스 <span style="color:#678;">(${_enrFixList().length})</span></label>
    <div class="fixp-hdr" style="margin-top:6px;">접근절차 픽스</div>`;
  _appFixGrps().forEach(g => {
    const n = APP_FIX_DB.filter(f => f.grp === g).length;
    html += `<label><input type="checkbox" ${appFixOn[g] ? 'checked' : ''} onchange="toggleAppFixGrp('${g}')">
      <span style="color:#ffb74d;">◇</span> ${g} <span style="color:#678;">(${n})</span></label>`;
  });
  html += `<div style="color:#5a7a80;font-size:8px;line-height:1.5;padding:6px 3px 0;">
    태안 접근절차 픽스는 한서대 태안비행장 비행절차(2025-09-01) 별첨 7 기재 좌표입니다.
    RNP 절차는 문서상 훈련 목적용이라 IFR 절차 DB에는 넣지 않았습니다.</div>`;
  p.innerHTML = html;
}
// 저장된 상태 복원
if (fixLayerOn) { try { _drawFixLayer(); } catch(e) { _swallow(e); } }
try { if (_appFixAnyOn()) _drawAppFixLayer(); } catch(e) { _swallow(e); }
try { _fixUpdateBtn(); } catch(e) { _swallow(e); }

// ── VOR 표지소 + 항로(AWY) 오버레이 (AIP ENR 4.1 / 3.x) ──
// ── 국내 비행장 주파수/VOR/ILS/ATIS/RWY/표고 (2022.1 자료) ──
const AIRFIELD_INFO = [
  { pub:1, code:'JJ', name:'광주',        elev:48,  rwy:'04R-22R / 04L-22L', twr:'118.05, 254.6', app:'광주APP 130.0 / 228.9', gnd:'121.8, 275.8', vor:'114.4 (128.475 / 234.7)', ils:'app037°R 111.1 / app217°L 108.5' },
  { code:'JM', name:'목포',        elev:23,  rwy:'06-24', twr:'134.4, 235.1', app:'광주APP 130.0 / 228.9', gnd:'-', vor:'117.8 (MKP) (CH 125)', ils:'-' },
  { pub:1, code:'JB', name:'무안',        elev:51,  rwy:'01-19', twr:'118.25, 118.85', app:'무안APP 120.475 / 130.0', gnd:'121.7, 317.45', vor:'111.0 (127.425 / 335.425)', ils:'app007° 111.9 / app187° 108.9' },
  { pub:1, code:'JK', name:'군산',        elev:29,  rwy:'18-36', twr:'126.5, 292.3', app:'군산APP 124.1, 292.65', gnd:'123.5, 273.525', vor:'112.8 (120.225 / 304.8)', ils:'app351°R 110.3 / app186°R 110.3' },
  { pub:1, code:'JY', name:'여수',        elev:53,  rwy:'17-35', twr:'122.5, 121.5, 240.9, 243.0', app:'사천APP 135.4, 344.7', gnd:'118.525', vor:'115.7 (128.275)', ils:'app345° 109.7 / app165° 111.5' },
  { pub:1, code:'PC', name:'제주',        elev:119, rwy:'07-25 / 13-31', twr:'118.2, 121.65, 236.6', app:'121.2, 124.05, 279.8, 317.7', gnd:'121.65', vor:'109.0 (YDM) / 116.1 (VORTAC) (126.8 / 239.5)', ils:'app065° 109.9 / app245° 111.3' },
  { code:'ND', name:'속초',        elev:98,  rwy:'23-05', twr:'125.450, 346.775', app:'-', gnd:'236.60', vor:'110.8 (SHO) app 229°', ils:'-' },
  { pub:1, code:'NY', name:'양양',        elev:241, rwy:'15-33', twr:'118.85', app:'강릉APP 124.6', gnd:'123.15, 240.4, 124.375', vor:'110.6 (YAG) (128.825 / 233.975)', ils:'109.3 / 330°' },
  { code:'NN', name:'강릉',        elev:32,  rwy:'08-26', twr:'126.2', app:'강릉APP 124.6', gnd:'275.8', vor:'(126.675 / 226.175)', ils:'111.75 / 256°' },
  { pub:1, code:'NW', name:'원주',        elev:330, rwy:'03-21', twr:'126.2, 118.325, 236.6, 265.5', app:'원주APP 130.2, 255.0, 234.4', gnd:'275.8', vor:'110.2 (CH 39) (128.4 / 225.575)', ils:'app028° VOR/DME-A' },
  { code:'RN', name:'이천',        elev:255, rwy:'10L-28R / 10R-28L', twr:'124.9, 346.7, 45.00', app:'오산APP 127.9, 306.3', gnd:'127.8, 40.00', vor:'117.2 (ICN)', ils:'app093°' },
  { code:'SW', name:'수원',        elev:88,  rwy:'15L-33L / 15R-33R', twr:'126.2, 236.6, 244.4', app:'오산APP 127.9, 234.3', gnd:'275.8', vor:'SWN (CH 22) (126.425 / 225.975)', ils:'app332°L 108.5' },
  { pub:1, code:'SI', name:'인천 / 영종도(RE)', elev:23, rwy:'15L-33R / 15R-33L / 16-34', twr:'118.2, 118.275, 118.8, 231.8', app:'서울APP 119.05, 119.9, 124.1, 293.3', gnd:'121.925, 121.7, 121.75, 226.9', vor:'113.8 (NCN) A(128.4 / 230.25) / 112.9 (WNG) (128.65 / 344.2)', ils:'app153°L 111.9 / app153°R 109.1 / app333°L 109.3 / app333°R 108.9 / RWY16 110.35 / RWY34 108.10' },
  { pub:1, code:'SS', name:'김포',        elev:59,  rwy:'14R-32R / 14L-32L', twr:'118.1, 118.05, 240.9', app:'서울APP 119.05, 119.9, 119.1, 119.75, 120.8, 121.35', gnd:'121.90, 121.95, DLVRY 125.975', vor:'113.6 (KIP) (126.4 / 317.8) / 115.5 (SEL) (CH 102X)', ils:'app143°L 109.9 / app143°R 108.7 / app323°L 108.3 / app323°R 110.7' },
  { code:'',   name:'포승',        elev:27,  rwy:'30-02', twr:'120.2, 385.2, 42.20', app:'-', gnd:'134.1, 231.4', vor:'CH 51X', ils:'-' },
  { code:'TI', name:'중원',        elev:281, rwy:'18R-36R / 18L-36L', twr:'126.2, 236.6, 230.15', app:'중원APP 306.7, 132.55', gnd:'275.8', vor:'(CH 31X) (126.875 / 226.275)', ils:'app003°R 111.3' },
  { pub:1, code:'TU', name:'청주',        elev:192, rwy:'06L-24L / 06R-24R', twr:'118.7, 126.2, 236.6, 249.6', app:'청주APP 134.0, 265.75', gnd:'121.875', vor:'109.0 (CHO) (128.85 / 305.5)', ils:'app240°R 111.7' },
  { code:'TY', name:'예천',        elev:null, rwy:'06-24', twr:'126.2, 236.6, 269.5', app:'예천APP 134.5, 229.35', gnd:'275.8', vor:'YCN (CH 26) (126.625 / 226.075)', ils:'app277° 109.3' },
  { code:'G515', name:'논산',      elev:104, rwy:'11L-29R / 11R-29L', twr:'133.350, 30.20', app:'군산APP 124.1, 292.65', gnd:'386.4, 계룡OPS 46.30', vor:'117.5', ils:'RWY11 109.7' },
  { code:'UC', name:'조치원',      elev:89,  rwy:'14-32', twr:'121.850, 346.750, 36.40', app:'중원APP 132.55, 306.7', gnd:'NIL', vor:'NIL', ils:'NIL' },
  { pub:1, code:'TN', name:'대구',        elev:120, rwy:'13L-31L / 13R-31R', twr:'126.2, 236.6, 365.0', app:'대구APP 135.9, 346.3', gnd:'121.95, 275.8', vor:'116.5 (DOC) / 112.2 (TGU) (127.65 / 240.6)', ils:'app132°R 108.7 / app312°L 108.7 / app312°L 111.9' },
  { pub:1, code:'TL', name:'울진',        elev:175, rwy:'17-35', twr:'118.55, 317.45', app:'울진ARR 120.875, 317.65', gnd:'121.775, 317.450', vor:'115.3 (UJN) (CH 100X)', ils:'app351° 108.1 / app171° 108.1' },
  { pub:1, code:'TH', name:'포항',        elev:76,  rwy:'10-28 (1200S / 900N)', twr:'118.05, 236.6, 308.5', app:'120.2, 124.25, 232.4', gnd:'126.2, 275.8', vor:'109.6 (NPH) CH33X / 110.9 (I-KPO) / 112.5 (KPO) (127.4 / 317.375)', ils:'VT 100°/275° / I 097° / PA 097°' },
  // 태안 — 한서대학교 태안비행장 비행절차(2025-09-01) 제2장 제1·4절 기재값
  //   활주로 34-16 / 338°-158° / 1180m×25m(3871ft×82ft) 아스팔트, 표고 16ft
  //   접근관제는 해미(서산) APP. RNP 접근절차는 문서상 "훈련 목적용, 공식 인가 절차 아님"
  //   이라 IFR DB에는 넣지 않았다.
  { pub:1, code:'TA', name:'태안',        elev:16,  rwy:'34-16 (1180m×25m, 338°-158°)', twr:'118.625, 240.4', app:'해미APP 134.1, 124.6', gnd:'121.825', vor:'-', ils:'- (비상 121.50, 243.0)' },
  { code:'UY', name:'영천',        elev:376, rwy:'09-27 (1400S)', twr:'133.350 / 346.675, 31.00', app:'대구APP', gnd:'-', vor:'-', ils:'52S DE 83732 86768' },
  { pub:1, code:'PU', name:'울산',        elev:42,  rwy:'18-36', twr:'118.75, 225.55, 236.6', app:'포항APP 124.25, 120.2, 232.4', gnd:'121.75', vor:'111.4 (USN) (CH 51) (126.625 / 233.55)', ils:'app004° 110.3' },
  { pub:1, code:'PK', name:'김해',        elev:13,  rwy:'18L-36L / 18R-36R', twr:'118.1, 118.45, 233.3, 236.6', app:'125.5, 364.0', gnd:'121.9(GND), 121.65(APRON), 221.8(DLVRY)', vor:'113.8 (CH 98X) (126.6 / 235.1)', ils:'app001°R 109.5 / app001°L 108.5' },
  { code:'PE', name:'진해',        elev:12,  rwy:'18-36', twr:'236.6, 350.0, 126.2, 42.20', app:'김해APP 135.7, 225.1', gnd:'275.8, 120.2', vor:'NUE (CH 12)', ils:'NIL' },
  { pub:1, code:'PS', name:'사천',        elev:25,  rwy:'06L-24R / 06R-24L', twr:'118.675, 236.6, 305.4', app:'사천APP 135.4, 344.7', gnd:'118.675, 275.8(DLVRY)', vor:'115.1 (SAC) (126.425 / 225.475)', ils:'app063°L 108.1 / app243°R 108.1' },
  { code:'DD', name:'독도헬기장',  elev:390, rwy:'080-260', twr:'130.35', app:'-', gnd:'-', vor:'-', ils:'-', note:'N 37-14-52 E 131-52-06 · 독항대 054-791-0001 / 118전대 054-791-0242' },
  { code:'',   name:'동해가스전',  elev:null, rwy:'017-350', twr:'130.50 / CH72(156.625)', app:'-', gnd:'-', vor:'-', ils:'-', note:'N 35-26 E 130-00 · 052-240-4754 / 4727 · KADIZ 이탈/진입 N 35-31 E 129-58' }
];

const ENR_VORS = [
  { id: 'SEL', name: 'ANYANG VORTAC', freq: '115.5', lat: 37.41361, lon: 126.92833 },   // 372449N 1265542E
  { id: 'PSN', name: 'BUSAN VORTAC', freq: '114.0', lat: 35.1225, lon: 128.99944 },   // 350721N 1285958E
  { id: 'TGU', name: 'DALSEONG VORTAC', freq: '112.2', lat: 35.80972, lon: 128.59083 },   // 354835N 1283527E
  { id: 'KAE', name: 'GANGWON VORTAC', freq: '115.6', lat: 37.70083, lon: 128.75389 },   // 374203N 1284514E
  { id: 'KUZ', name: 'GUNSAN VORTAC', freq: '112.8', lat: 35.91028, lon: 126.61139 },   // 355437N 1263641E
  { id: 'KWA', name: 'GWANGJU VOR/DME', freq: '114.4', lat: 35.12611, lon: 126.81222 },   // 350734N 1264844E
  { id: 'CJU', name: 'JEJU VORTAC', freq: '116.1', lat: 33.38472, lon: 126.62417 },   // 332305N 1263727E
  { id: 'KPO', name: 'POHANG VORTAC', freq: '112.5', lat: 35.97722, lon: 129.47444 },   // 355838N 1292828E
  { id: 'SOT', name: 'SONGTAN VORTAC', freq: '116.9', lat: 37.09444, lon: 127.03167 },   // 370540N 1270154E
  { id: 'CUN', name: 'YECHEON VOR/DME', freq: '114.8', lat: 36.63194, lon: 128.32528 },   // 363755N 1281931E
  { id: 'KWJ', name: 'GWANGJU TACAN', freq: '', lat: 35.12306, lon: 126.80278 },   // 350723N 1264810E
  // ── 비행장 VOR ──
  //   apt:1  = 비행장 항행표지(AWY 패널의 '비행장 VOR' 항목으로 별도 제어)
  //   pub:1  = AIP 공개 비행장 → 지도에 표시. 미표기(군 비행장)는 INFO 게이트와 동일하게 지도 미표시
  //   src    = 'AIP' 공표 좌표(AD 2 차트/코딩테이블 판독) | 'ARP' 공항 기준점 근사값
  { apt:1, pub:1, src:'ARP', id: 'NCN', name: '인천 VOR',   freq: '113.8', lat: 37.4602,  lon: 126.4407 },
  { apt:1, pub:1, src:'ARP', id: 'WNG', name: '인천(WNG)',  freq: '112.9', lat: 37.4600,  lon: 126.4400 },
  { apt:1, pub:1, src:'ARP', id: 'KIP', name: '김포 VOR',   freq: '113.6', lat: 37.5583,  lon: 126.7942 },
  { apt:1, pub:1, src:'ARP', id: 'MUA', name: '무안 VOR',   freq: '111.0', lat: 34.9914,  lon: 126.3829 },
  { apt:1, pub:1, src:'AIP', id: 'YSU', name: '여수 VOR',   freq: '115.7', lat: 34.84286, lon: 127.61908 },
  { apt:1, pub:1, src:'ARP', id: 'YDM', name: '제주 VOR',   freq: '109.0', lat: 33.5108,  lon: 126.4947 },
  { apt:1, pub:1, src:'AIP', id: 'YAG', name: '양양 VOR',   freq: '110.6', lat: 38.0633,  lon: 128.6615 },
  { apt:1, pub:1, src:'ARP', id: 'WJU', name: '원주 VOR',   freq: '110.2', lat: 37.4381,  lon: 127.9604 },
  { apt:1, pub:1, src:'AIP', id: 'CHO', name: '청주 VOR/DME', freq: '109.0', lat: 36.71806, lon: 127.49417 },
  { apt:1, pub:1, src:'AIP', id: 'DOC', name: '동촌(대구) VOR/DME', freq: '116.5', lat: 35.90378, lon: 128.64139 },
  { apt:1, pub:1, src:'AIP', id: 'UJN', name: '울진 VOR/DME', freq: '115.3', lat: 36.77639, lon: 129.4575 },
  { apt:1, pub:1, src:'AIP', id: 'USN', name: '울산 VOR/DME', freq: '111.4', lat: 35.59861, lon: 129.35333 },
  { apt:1, pub:1, src:'AIP', id: 'NPH', name: '포항 VORTAC', freq: '109.6', lat: 35.98636, lon: 129.40883 },
  { apt:1, pub:1, src:'AIP', id: 'KMH', name: '김해 VOR/DME', freq: '113.8', lat: 35.19917, lon: 128.93556 },
  { apt:1, pub:1, src:'ARP', id: 'SAC', name: '사천 VOR',   freq: '115.1', lat: 35.0886,  lon: 128.0703 },
  // 아래는 CDU INFO 목록에서 ALL 코드로 가려지는 비행장 — 항행표지 자체는 지도에 표시
  { apt:1, src:'ARP', id: 'MKP', name: '목포 VOR',   freq: '117.8', lat: 34.7585,  lon: 126.3806 },
  { apt:1, src:'ARP', id: 'NSN', name: '논산 VOR',   freq: '117.5', lat: 36.1636,  lon: 127.1147 },
  { apt:1, src:'ARP', id: 'SHO', name: '속초 VOR',   freq: '110.8', lat: 38.1427,  lon: 128.5986 },
  { apt:1, src:'ARP', id: 'ICN', name: '이천 VOR',   freq: '117.2', lat: 37.2028,  lon: 127.4746 },
];
// 항로(ATS Routes): VOR는 id 참조(vor:1), 그 외 경유점은 제공된 십진수 좌표 내장
const ENR_ROUTES = [
  { route: 'A582', type: 'CONV', wps: [{n:'SEL',vor:1},{n:'POLEG',lat:37.21361,lon:126.99306},{n:'SOT',vor:1},{n:'OSPOT',lat:36.83833,lon:127.34861},{n:'VASLI',lat:36.71444,lon:127.50083},{n:'MAKDU',lat:36.45333,lon:127.81917},{n:'BITUX',lat:36.27917,lon:128.03},{n:'TGU',vor:1},{n:'KALOD',lat:35.50333,lon:128.77389},{n:'PSN',vor:1},{n:'APELA',lat:34.72306,lon:129.23333}] },
  { route: 'A586', type: 'CONV', wps: [{n:'TENAS',lat:37.63889,lon:131.57417},{n:'AGSUS',lat:36.75583,lon:130.67889},{n:'DABIK',lat:36.29528,lon:130.19528},{n:'BULGA',lat:35.93583,lon:129.82333},{n:'BEDOM',lat:35.42028,lon:129.29833},{n:'PSN',vor:1},{n:'OMOTU',lat:35.00917,lon:128.83944},{n:'TOPAX',lat:34.76528,lon:128.49778},{n:'GOSBO',lat:34.25472,lon:127.79278},{n:'MAKET',lat:33.91444,lon:127.33139},{n:'ATINA',lat:33.72222,lon:127.07306},{n:'MANOL',lat:33.60806,lon:126.92056},{n:'CJU',vor:1},{n:'TOSAN',lat:33.00333,lon:126.77194},{n:'RUGMA',lat:32.50333,lon:126.96472}] },
  { route: 'A593', type: 'CONV', wps: [{n:'ONIKU',lat:32.195,lon:126.65472},{n:'NIRAT',lat:32.065,lon:126.05806},{n:'PONIK',lat:32.00583,lon:125.78306},{n:'SADLI',lat:31.83,lon:125.0},{n:'LAMEN',lat:31.61,lon:124.0}] },
  { route: 'A595', type: 'CONV', wps: [{n:'CJU',vor:1},{n:'TAMNA',lat:33.47083,lon:127.33139},{n:'SAMDO',lat:33.58417,lon:128.31583}] },
  { route: 'B332', type: 'CONV', wps: [{n:'KANSU',lat:38.63333,lon:132.475},{n:'PALDU',lat:37.97028,lon:132.60694},{n:'SABET',lat:37.64139,lon:132.67194},{n:'IGRAS',lat:37.31278,lon:132.73639}] },
  { route: 'B467', type: 'CONV', wps: [{n:'KAE',vor:1},{n:'LESBU',lat:37.68778,lon:129.68444},{n:'UGOVI',lat:37.68472,lon:129.8475},{n:'BUSKO',lat:37.67583,lon:130.26944},{n:'TENAS',lat:37.63889,lon:131.57417},{n:'MALSO',lat:37.91111,lon:131.81778},{n:'KANSU',lat:38.63333,lon:132.475}] },
  { route: 'B576', type: 'CONV', wps: [{n:'SEL',vor:1},{n:'POLEG',lat:37.21361,lon:126.99306},{n:'SOT',vor:1},{n:'OLMEN',lat:36.73694,lon:126.99111},{n:'ENTEL',lat:36.38639,lon:126.95139},{n:'RINBO',lat:35.89778,lon:126.89694},{n:'LINTA',lat:35.52111,lon:126.85528},{n:'KWA',vor:1},{n:'IPDAS',lat:34.25417,lon:126.71694},{n:'CJU',vor:1},{n:'SOSDO',lat:33.00333,lon:126.45972},{n:'SAMLO',lat:32.53972,lon:126.26},{n:'NIRAT',lat:32.065,lon:126.05806},{n:'ELGEP',lat:31.78139,lon:125.93806},{n:'TESIM',lat:31.59056,lon:125.85778},{n:'ATOTI',lat:30.00361,lon:125.19833}] },
  { route: 'G339', type: 'CONV', wps: [{n:'PSN',vor:1},{n:'INVOK',lat:34.78861,lon:129.32306}] },
  { route: 'G585', type: 'CONV', wps: [{n:'SEL',vor:1},{n:'KALMA',lat:37.3125,lon:127.1125},{n:'KAKSO',lat:37.12917,lon:127.44361},{n:'GUKDO',lat:37.01972,lon:127.63972},{n:'ENSAL',lat:36.93167,lon:127.79639},{n:'BASEM',lat:36.84361,lon:127.95278},{n:'BIGOB',lat:36.72361,lon:128.16444},{n:'CUN',vor:1},{n:'ELAPI',lat:36.33722,lon:128.8475},{n:'KPO',vor:1},{n:'BULGA',lat:35.93583,lon:129.82333},{n:'SAPRA',lat:35.82389,lon:130.72361}] },
  { route: 'G597', type: 'CONV', wps: [{n:'AGAVO',lat:37.16667,lon:124.0},{n:'GONAV',lat:37.18,lon:124.41472},{n:'DANTI',lat:37.30167,lon:124.65806},{n:'ANSIM',lat:37.38972,lon:124.83583},{n:'BINIL',lat:37.39694,lon:125.23306},{n:'NOPIK',lat:37.40333,lon:125.65139},{n:'GOGET',lat:37.41167,lon:126.51},{n:'SEL',vor:1},{n:'EGOBA',lat:37.4875,lon:127.37944},{n:'KARBU',lat:37.53306,lon:127.66444},{n:'TORUS',lat:37.60694,lon:128.13528},{n:'BIKSI',lat:37.67556,lon:128.58444},{n:'KAE',vor:1},{n:'PILIT',lat:37.44194,lon:129.29194},{n:'ESNEG',lat:37.17056,lon:129.8475},{n:'AGSUS',lat:36.75583,lon:130.67889},{n:'LANAT',lat:36.37333,lon:131.42833}] },
  { route: 'V11', type: 'CONV', wps: [{n:'PILIT',lat:37.44194,lon:129.29194},{n:'NOBUT',lat:37.12083,lon:129.3325},{n:'OSVOM',lat:36.64556,lon:129.39194},{n:'LOSTO',lat:36.33778,lon:129.43},{n:'KPO',vor:1},{n:'APARU',lat:35.41167,lon:129.15889},{n:'PSN',vor:1}] },
  { route: 'V543', type: 'CONV', wps: [{n:'DALSU',lat:35.12528,lon:126.70167},{n:'KWA',vor:1},{n:'SAMUL',lat:35.12667,lon:126.865},{n:'TEDAN',lat:35.12889,lon:127.31444},{n:'ANUBA',lat:35.12944,lon:127.58972},{n:'SAPDI',lat:35.12694,lon:128.49778},{n:'SARAM',lat:35.12667,lon:128.52972},{n:'ANKUS',lat:35.125,lon:128.77111},{n:'PSN',vor:1}] },
  { route: 'V547', type: 'CONV', wps: [{n:'KWA',vor:1},{n:'IGDOK',lat:35.51778,lon:127.81861},{n:'TGU',vor:1}] },
  { route: 'V549', type: 'CONV', wps: [{n:'KUZ',vor:1},{n:'ELPOS',lat:35.90278,lon:126.78528},{n:'RINBO',lat:35.89778,lon:126.89694},{n:'MELES',lat:35.88083,lon:127.26167},{n:'OPEDA',lat:35.86361,lon:127.61444},{n:'TGU',vor:1},{n:'LAPAL',lat:35.90361,lon:129.08111},{n:'KPO',vor:1}] },
  { route: 'W45', type: 'CONV', wps: [{n:'KWJ',vor:1},{n:'RIMPO',lat:35.1275,lon:127.58389},{n:'RUNIT',lat:35.12611,lon:128.49778},{n:'PSN',vor:1}] },
  { route: 'W61', type: 'CONV', wps: [{n:'SOT',vor:1},{n:'MONSI',lat:37.21306,lon:126.8375},{n:'GOGET',lat:37.41167,lon:126.51}] },
  { route: 'W62', type: 'CONV', wps: [{n:'SOT',vor:1},{n:'EGOBA',lat:37.4875,lon:127.37944}] },
  { route: 'W526', type: 'CONV', wps: [{n:'TGU',vor:1},{n:'MASTA',lat:35.47972,lon:128.56111},{n:'SARAM',lat:35.12667,lon:128.52972},{n:'TOPAX',lat:34.76528,lon:128.49778}] },
  { route: 'L512', type: 'RNAV', wps: [{n:'TENAS',lat:37.63889,lon:131.57417},{n:'SABET',lat:37.64139,lon:132.67194},{n:'ANDOL',lat:37.66611,lon:133.0}] },
  { route: 'Y233', type: 'RNAV', wps: [{n:'BUSKO',lat:37.67583,lon:130.26944},{n:'SELPA',lat:37.92083,lon:130.81972},{n:'ONATA',lat:38.47556,lon:132.10056},{n:'KANSU',lat:38.63333,lon:132.475}] },
  { route: 'Y253', type: 'RNAV', wps: [{n:'DALSU',lat:35.12528,lon:126.70167},{n:'KWA',vor:1},{n:'SAMUL',lat:35.12667,lon:126.865},{n:'TEDAN',lat:35.12889,lon:127.31444},{n:'ANUBA',lat:35.12944,lon:127.58972},{n:'SAPDI',lat:35.12694,lon:128.49778},{n:'SARAM',lat:35.12667,lon:128.52972},{n:'ANKUS',lat:35.125,lon:128.77111}] },
  { route: 'Y437', type: 'RNAV', wps: [{n:'KAE',vor:1},{n:'LESBU',lat:37.68778,lon:129.68444},{n:'UGOVI',lat:37.68472,lon:129.8475},{n:'BUSKO',lat:37.67583,lon:130.26944},{n:'TENAS',lat:37.63889,lon:131.57417},{n:'MALSO',lat:37.91111,lon:131.81778},{n:'KANSU',lat:38.63333,lon:132.475}] },
  { route: 'Y571', type: 'RNAV', wps: [{n:'SOSDO',lat:33.00333,lon:126.45972},{n:'OMKIM',lat:33.22222,lon:126.68722},{n:'PAPLU',lat:33.57806,lon:127.06028},{n:'AKPON',lat:33.78056,lon:127.33139},{n:'NISAV',lat:34.25528,lon:127.97639},{n:'ANROD',lat:34.63278,lon:128.49778},{n:'POVEM',lat:34.92306,lon:128.90444},{n:'PSN',vor:1}] },
  { route: 'Y572', type: 'RNAV', wps: [{n:'PSN',vor:1},{n:'OLMUD',lat:35.04028,lon:128.82111},{n:'ENGOT',lat:34.80944,lon:128.49778},{n:'POVOR',lat:34.25556,lon:127.73333},{n:'UPGOS',lat:33.95917,lon:127.33139},{n:'BILUM',lat:33.77028,lon:127.0775},{n:'BEPKO',lat:33.65278,lon:126.92056},{n:'CJU',vor:1},{n:'OMKIM',lat:33.22222,lon:126.68722},{n:'TOSAN',lat:33.00333,lon:126.77194},{n:'RUGMA',lat:32.50333,lon:126.96472}] },
  { route: 'Y579', type: 'RNAV', wps: [{n:'TENAS',lat:37.63889,lon:131.57417},{n:'AGSUS',lat:36.75583,lon:130.67889},{n:'DABIK',lat:36.29528,lon:130.19528},{n:'BULGA',lat:35.93583,lon:129.82333},{n:'BEDOM',lat:35.42028,lon:129.29833},{n:'PSN',vor:1}] },
  { route: 'Y644', type: 'RNAV', wps: [{n:'AGAVO',lat:37.16667,lon:124.0},{n:'RILRO',lat:37.17583,lon:124.245},{n:'GONAV',lat:37.18,lon:124.41472},{n:'BODOL',lat:37.18944,lon:124.83167},{n:'REBIT',lat:37.20083,lon:125.48694},{n:'BELTU',lat:37.205,lon:125.79972},{n:'BOGAN',lat:37.21139,lon:126.47},{n:'MONSI',lat:37.21306,lon:126.8375},{n:'POLEG',lat:37.21361,lon:126.99306},{n:'EGOBA',lat:37.4875,lon:127.37944}] },
  { route: 'Y655', type: 'RNAV', wps: [{n:'GONAV',lat:37.18,lon:124.41472},{n:'DALPO',lat:36.97639,lon:124.41472},{n:'NONOS',lat:36.67944,lon:124.41472},{n:'BIDRI',lat:36.33528,lon:124.41472},{n:'DANPA',lat:35.51,lon:124.41472},{n:'PALSA',lat:34.02528,lon:124.41472},{n:'TOLIS',lat:33.84167,lon:124.41472},{n:'ENSUM',lat:32.21722,lon:124.77639},{n:'BONSO',lat:30.47778,lon:125.1475},{n:'ATOTI',lat:30.00361,lon:125.19833},{n:'KWA',vor:1},{n:'IGDOK',lat:35.51778,lon:127.81861},{n:'TGU',vor:1}] },
  { route: 'Y659', type: 'RNAV', wps: [{n:'KUZ',vor:1},{n:'ELPOS',lat:35.90278,lon:126.78528},{n:'RINBO',lat:35.89778,lon:126.89694},{n:'MELES',lat:35.88083,lon:127.26167},{n:'OPEDA',lat:35.86361,lon:127.61444},{n:'TGU',vor:1},{n:'LAPAL',lat:35.90361,lon:129.08111},{n:'KPO',vor:1}] },
  { route: 'Y677', type: 'RNAV', wps: [{n:'TOLIS',lat:33.84167,lon:124.41472},{n:'LIMDI',lat:33.55361,lon:125.83139},{n:'REMOS',lat:33.43472,lon:126.39139},{n:'CJU',vor:1},{n:'TAMNA',lat:33.47083,lon:127.33139},{n:'SAMDO',lat:33.58417,lon:128.31583}] },
  { route: 'Y685', type: 'RNAV', wps: [{n:'SEL',vor:1},{n:'KALMA',lat:37.3125,lon:127.1125},{n:'KAKSO',lat:37.12917,lon:127.44361},{n:'GUKDO',lat:37.01972,lon:127.63972},{n:'ENSAL',lat:36.93167,lon:127.79639},{n:'BASEM',lat:36.84361,lon:127.95278},{n:'BIGOB',lat:36.72361,lon:128.16444},{n:'CUN',vor:1},{n:'ELAPI',lat:36.33722,lon:128.8475},{n:'KPO',vor:1},{n:'BULGA',lat:35.93583,lon:129.82333},{n:'SAPRA',lat:35.82389,lon:130.72361}] },
  { route: 'Y697', type: 'RNAV', wps: [{n:'AGAVO',lat:37.16667,lon:124.0},{n:'OLBIM',lat:37.23639,lon:124.13083},{n:'NOGON',lat:37.38056,lon:124.41806},{n:'ANSIM',lat:37.38972,lon:124.83583},{n:'BINIL',lat:37.39694,lon:125.23306},{n:'NOPIK',lat:37.40333,lon:125.65139},{n:'GOGET',lat:37.41167,lon:126.51},{n:'SEL',vor:1},{n:'EGOBA',lat:37.4875,lon:127.37944},{n:'KARBU',lat:37.53306,lon:127.66444},{n:'TORUS',lat:37.60694,lon:128.13528},{n:'BIKSI',lat:37.67556,lon:128.58444},{n:'KAE',vor:1},{n:'PILIT',lat:37.44194,lon:129.29194},{n:'ESNEG',lat:37.17056,lon:129.8475},{n:'AGSUS',lat:36.75583,lon:130.67889},{n:'LANAT',lat:36.37333,lon:131.42833}] },
  { route: 'Y711', type: 'RNAV', wps: [{n:'MONSI',lat:37.21306,lon:126.8375},{n:'BULTI',lat:36.72278,lon:126.825},{n:'MEKIL',lat:36.55611,lon:126.83139},{n:'GONAX',lat:36.38639,lon:126.83778},{n:'BEDES',lat:36.15139,lon:126.81222},{n:'ELPOS',lat:35.90278,lon:126.78528},{n:'MANGI',lat:35.50306,lon:126.74222},{n:'DALSU',lat:35.12528,lon:126.70167},{n:'NULDI',lat:34.42056,lon:126.6275},{n:'DOTOL',lat:34.25417,lon:126.61028},{n:'KIDOS',lat:33.84111,lon:126.56722},{n:'REMOS',lat:33.43472,lon:126.39139},{n:'PANSI',lat:33.00389,lon:126.20694},{n:'DOMKO',lat:32.48,lon:125.98306},{n:'PONIK',lat:32.00583,lon:125.78306},{n:'IKEDO',lat:31.72056,lon:125.66333},{n:'KANKA',lat:31.53194,lon:125.58444},{n:'BONSO',lat:30.47778,lon:125.1475},{n:'MUGUS',lat:30.00167,lon:124.95333}] },
  { route: 'Y722', type: 'RNAV', wps: [{n:'SOT',vor:1},{n:'OLMEN',lat:36.73694,lon:126.99111},{n:'GUNKU',lat:36.57056,lon:126.99694},{n:'PEBRI',lat:36.38639,lon:127.00361},{n:'ATASO',lat:35.89556,lon:126.94917},{n:'MAKSA',lat:35.50306,lon:126.90611},{n:'SAMUL',lat:35.12667,lon:126.865},{n:'KAMIT',lat:34.25389,lon:126.77167},{n:'GUKSU',lat:33.88083,lon:126.7325},{n:'LOSNI',lat:33.55417,lon:126.69806},{n:'CJU',vor:1},{n:'SOSDO',lat:33.00333,lon:126.45972},{n:'SAMLO',lat:32.53972,lon:126.26},{n:'NIRAT',lat:32.065,lon:126.05806},{n:'ELGEP',lat:31.78139,lon:125.93806},{n:'TESIM',lat:31.59056,lon:125.85778},{n:'ATOTI',lat:30.00361,lon:125.19833}] },
  { route: 'Y744', type: 'RNAV', wps: [{n:'PILIT',lat:37.44194,lon:129.29194},{n:'NOBUT',lat:37.12083,lon:129.3325},{n:'OSVOM',lat:36.64556,lon:129.39194},{n:'LOSTO',lat:36.33778,lon:129.43},{n:'KPO',vor:1},{n:'PSN',vor:1}] },
  { route: 'Y781', type: 'RNAV', wps: [{n:'TGU',vor:1},{n:'MASTA',lat:35.47972,lon:128.56111},{n:'ANKUS',lat:35.125,lon:128.77111},{n:'OMOTU',lat:35.00917,lon:128.83944},{n:'BESNA',lat:34.62167,lon:129.13083}] },
  { route: 'Y782', type: 'RNAV', wps: [{n:'SEL',vor:1},{n:'POLEG',lat:37.21361,lon:126.99306},{n:'SOT',vor:1},{n:'OSPOT',lat:36.83833,lon:127.34861},{n:'VASLI',lat:36.71444,lon:127.50083},{n:'MAKDU',lat:36.45333,lon:127.81917},{n:'BITUX',lat:36.27917,lon:128.03},{n:'TGU',vor:1},{n:'KALOD',lat:35.50333,lon:128.77389},{n:'PSN',vor:1},{n:'APELA',lat:34.72306,lon:129.23333}] },
  { route: 'Z50', type: 'RNAV', wps: [{n:'EGOBA',lat:37.4875,lon:127.37944},{n:'SOT',vor:1},{n:'BULTI',lat:36.72278,lon:126.825}] },
  { route: 'Z51', type: 'RNAV', wps: [{n:'BOPTA',lat:36.735,lon:126.61611},{n:'MOXID',lat:36.38639,lon:126.73306},{n:'BEDES',lat:36.15139,lon:126.81222}] },
  { route: 'Z52', type: 'RNAV', wps: [{n:'OLMEN',lat:36.73694,lon:126.99111},{n:'POSAN',lat:36.9375,lon:127.22111},{n:'KAKSO',lat:37.12917,lon:127.44361}] },
  { route: 'Z53', type: 'RNAV', wps: [{n:'BITUX',lat:36.27917,lon:128.03},{n:'TEBEX',lat:36.56139,lon:127.99139},{n:'BASEM',lat:36.84361,lon:127.95278}] },
  { route: 'Z54', type: 'RNAV', wps: [{n:'SOT',vor:1},{n:'MONSI',lat:37.21306,lon:126.8375},{n:'GOGET',lat:37.41167,lon:126.51}] },
  { route: 'Z55', type: 'RNAV', wps: [{n:'AGAVO',lat:37.16667,lon:124.0},{n:'NONOS',lat:36.67944,lon:124.41472}] },
  { route: 'Z56', type: 'RNAV', wps: [{n:'KANSU',lat:38.63333,lon:132.475},{n:'PALDU',lat:37.97028,lon:132.60694},{n:'SABET',lat:37.64139,lon:132.67194},{n:'IGRAS',lat:37.31278,lon:132.73639}] },
  { route: 'Z57', type: 'RNAV', wps: [{n:'RILRO',lat:37.17583,lon:124.245},{n:'DALPO',lat:36.97639,lon:124.41472}] },
  { route: 'Z63', type: 'RNAV', wps: [{n:'PILIT',lat:37.44194,lon:129.29194},{n:'LESBU',lat:37.68778,lon:129.68444}] },
  { route: 'Z81', type: 'RNAV', wps: [{n:'KIDOS',lat:33.84111,lon:126.56722},{n:'CJU',vor:1}] },
  { route: 'Z82', type: 'RNAV', wps: [{n:'CJU',vor:1},{n:'PANSI',lat:33.00389,lon:126.20694}] },
  { route: 'Z83', type: 'RNAV', wps: [{n:'TGU',vor:1},{n:'MASTA',lat:35.47972,lon:128.56111},{n:'SARAM',lat:35.12667,lon:128.52972},{n:'ENGOT',lat:34.80944,lon:128.49778},{n:'ANROD',lat:34.63278,lon:128.49778}] },
  { route: 'Z84', type: 'RNAV', wps: [{n:'PSN',vor:1},{n:'KALEK',lat:35.20889,lon:129.88472}] },
  { route: 'Z85', type: 'RNAV', wps: [{n:'BILUM',lat:33.77028,lon:127.0775},{n:'PAPLU',lat:33.57806,lon:127.06028},{n:'RUGMA',lat:32.50333,lon:126.96472}] },
  { route: 'Z86', type: 'RNAV', wps: [{n:'BONSO',lat:30.47778,lon:125.1475},{n:'ATOTI',lat:30.00361,lon:125.19833}] },
  { route: 'Z91', type: 'RNAV', wps: [{n:'PSN',vor:1},{n:'INVOK',lat:34.78861,lon:129.32306}] },
  { route: 'Y590', type: 'RNAV', wps: [{n:'BEDAR',lat:31.90028,lon:126.48611},{n:'ELGEP',lat:31.78139,lon:125.93806},{n:'IKEDO',lat:31.72056,lon:125.66333},{n:'SADLI',lat:31.83,lon:125.0}] },
];

let _awyLayers = [];
// 카테고리별 표시 상태: Conventional 항로 / RNAV 항로 / VOR 표지소
let awyCat = { conv: false, rnav: false, vor: false, aptvor: false };
try {
  const s = JSON.parse(localStorage.getItem('awyCat') || 'null');
  // 이전 버전은 VOR이 한 항목이었으므로, 저장값에 aptvor가 없으면 vor 상태를 물려받는다
  if (s) awyCat = { conv: !!s.conv, rnav: !!s.rnav, vor: !!s.vor,
                    aptvor: s.aptvor === undefined ? !!s.vor : !!s.aptvor };
} catch(e) { _swallow(e); }

// 경유점 → 좌표 (VOR는 id 참조, 그 외는 내장 좌표)
function _awyWpCoord(w) {
  if (w.vor) {
    const v = ENR_VORS.find(x => x.id === w.n);
    return v ? [v.lat, v.lon] : null;
  }
  return (w.lat != null && w.lon != null) ? [w.lat, w.lon] : null;
}
function _drawAwyLayer() {
  _clearAwyLayer();
  // 항로선 (CONV=녹색, RNAV=하늘색) — 카테고리별 표시
  ENR_ROUTES.forEach(r => {
    if (r.type === 'RNAV' ? !awyCat.rnav : !awyCat.conv) return;
    const coordsAll = r.wps.map(_awyWpCoord);   // 경유점 인덱스 보존(미해결=null)
    const coords = coordsAll.filter(Boolean);
    if (coords.length < 2) return;
    const color = r.type === 'RNAV' ? '#4dd0e1' : '#8bc34a';
    const pl = L.polyline(coords, { color, weight: 2, opacity: 0.85 });
    pl.bindTooltip(`${r.route} (${r.type}) · ${r.wps.map(w => w.n).join(' – ')}`, { sticky: true });
    pl.bindPopup(`<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;font-size:12px;"><b style="color:${r.type === 'RNAV' ? '#00838f' : '#558b2f'};">${r.route}</b> <span style="color:#888;font-size:10px;">(${r.type})</span><br>${r.wps.map(w => w.n).join(' → ')}</div>`, { maxWidth: 280 });
    pl.addTo(leafMap); _awyLayers.push(pl);
    // 항로명 라벨 — 모든 구간 중앙에 표시(어느 구간에서 봐도 항로명 확인 가능)
    for (let i = 0; i < coords.length - 1; i++) {
      const midLat = (coords[i][0] + coords[i + 1][0]) / 2;
      const midLon = (coords[i][1] + coords[i + 1][1]) / 2;
      const lbl = L.marker([midLat, midLon], {
        icon: L.divIcon({
          html: `<div style="color:${color};font-size:9px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;font-weight:bold;white-space:nowrap;text-shadow:1px 1px 2px #000;background:rgba(0,0,0,0.55);padding:0 3px;border-radius:3px;transform:translate(-50%,-50%);">${r.route}</div>`,
          iconSize: [0, 0], className: ''
        }), interactive: false
      });
      lbl.addTo(leafMap); _awyLayers.push(lbl);
    }
    // 경유 픽스 점 + 이름 (FIX 레이어를 켜지 않아도 항로 경유점 확인 가능)
    r.wps.forEach((w, i) => {
      if (!coordsAll[i] || w.vor) return;   // VOR은 별도 육각형 심볼로 표시됨
      const mk = L.circleMarker(coordsAll[i], {
        radius: 3.5, color: '#fff', weight: 1, fillColor: color, fillOpacity: 1
      });
      mk.bindTooltip(`${w.n} (${r.route})`, { sticky: true });
      mk.bindPopup(_mapSymPopup({
        title: `▲ ${w.n}`, color: '#00788a', name: w.n,
        lat: coordsAll[i][0], lon: coordsAll[i][1], sub: `항로 ${r.route}`
      }), { maxWidth: 260 });
      mk.addTo(leafMap); _awyLayers.push(mk);
      const nmLbl = L.marker(coordsAll[i], {
        icon: L.divIcon({
          html: `<div style="color:#eee;font-size:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;font-weight:bold;white-space:nowrap;text-shadow:1px 1px 2px #000;transform:translate(7px,-11px);">${w.n}</div>`,
          iconSize: [0, 0], className: ''
        }), interactive: false
      });
      nmLbl.addTo(leafMap); _awyLayers.push(nmLbl);
    });
  });
  // VOR 표지소 — 항로(ENR 4.1) VOR과 비행장 VOR을 각각 제어
  _drawVorGroup(enrVorList(),  '#8bc34a', '#aed581');   // 항로 VOR (연두)
  _drawVorGroup(aptVorList(),  '#ffb74d', '#ffcc80');   // 비행장 VOR (호박색)
}
// AWY 패널 분류용 목록
function enrVorList() { return awyCat.vor    ? ENR_VORS.filter(v => !v.apt) : []; }
// 비행장 VOR은 AIP 게재 항행표지이므로 잠금 없이 모두 표시(군 비행장 포함).
// CDU INFO 화면의 ALL 코드 게이트는 비행장 상세정보에만 적용되며 이 레이어와 무관하다.
function _aptVorVisible(v) { return !!v.apt; }
function aptVorList() { return awyCat.aptvor ? ENR_VORS.filter(_aptVorVisible) : []; }
// 육각형 심볼 + ID·주파수 라벨. 좌표가 공항 기준점 근사값(src:'ARP')이면 속을 비워 구분한다.
function _drawVorGroup(list, col, lblCol) {
  list.forEach(v => {
    const approx = v.src === 'ARP';
    const body = approx
      ? `<div style="width:13px;height:13px;background:${col};clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);opacity:0.35;filter:drop-shadow(0 0 1.5px #000);"></div>`
      : `<div style="width:13px;height:13px;background:${col};clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);filter:drop-shadow(0 0 1.5px #000);"></div>`;
    const icon = L.divIcon({
      html: `<div style="position:relative;">${body}
        <div style="position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#0a0a0a;border-radius:50%;"></div>
        <div style="position:absolute;left:16px;top:-1px;color:${lblCol};font-size:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;font-weight:bold;white-space:nowrap;text-shadow:1px 1px 2px #000;">${v.id}${v.freq ? ' ' + v.freq : ''}</div>
      </div>`,
      iconSize: [13, 13], iconAnchor: [6, 6], className: ''
    });
    const mk = L.marker([v.lat, v.lon], { icon });
    mk.bindTooltip(`${v.name} (${v.id})${v.freq ? '<br>' + v.freq + ' MHz' : ''}`, { sticky: true });
    mk.bindPopup(_mapSymPopup({
      title: `⬡ ${v.id}`, color: col, name: v.id, lat: v.lat, lon: v.lon,
      sub: `${v.name}${v.freq ? ' · ' + v.freq + ' MHz' : ''}`,
      note: approx ? '※ 좌표는 공항 기준점 근사값' : '',
      extra: v.freq ? [
        { label: 'NAV1 튜닝', onclick: `mapTuneNav('NAV1','${v.freq}','${v.id}')`, fg: '#3b5a70', bg: '#eef3f7' },
        { label: 'NAV2 튜닝', onclick: `mapTuneNav('NAV2','${v.freq}','${v.id}')`, fg: '#3b5a70', bg: '#eef3f7' },
      ] : []
    }), { maxWidth: 280 });
    mk.addTo(leafMap); _awyLayers.push(mk);
  });
}
function _clearAwyLayer() {
  _awyLayers.forEach(l => { try { leafMap.removeLayer(l); } catch(e){ _swallow(e); } });
  _awyLayers = [];
}
function _awySave() { try { localStorage.setItem('awyCat', JSON.stringify(awyCat)); } catch(e) { _swallow(e); } }
function _awyUpdateBtn() {
  const any = awyCat.conv || awyCat.rnav || awyCat.vor || awyCat.aptvor;
  const p = document.getElementById('awy-panel');
  document.getElementById('awy-btn').classList.toggle('active', any || (p && p.classList.contains('open')));
}
function toggleAwyCat(k) {
  awyCat[k] = !awyCat[k];
  _drawAwyLayer(); _awySave(); _awyUpdateBtn(); _awyRenderPanel();
}
function _awySetAll(on) {
  awyCat = { conv: on, rnav: on, vor: on, aptvor: on };
  _drawAwyLayer(); _awySave(); _awyUpdateBtn(); _awyRenderPanel();
}
function _awyRenderPanel() {
  const p = document.getElementById('awy-panel'); if (!p) return;
  const rows = [
    ['conv', 'Conventional 항로', '#8bc34a', ENR_ROUTES.filter(r=>r.type==='CONV').length + '개'],
    ['rnav', 'RNAV(Area) 항로',   '#4dd0e1', ENR_ROUTES.filter(r=>r.type==='RNAV').length + '개'],
    ['vor',    '항로(ENR) VOR', '#aed581', ENR_VORS.filter(v=>!v.apt).length + '개소'],
    ['aptvor', '비행장 VOR',    '#ffb74d', ENR_VORS.filter(_aptVorVisible).length + '개소'],
  ];
  p.innerHTML = `<div class="aspc-grp" style="color:#8bc34a;">항로(AWY) 표시
      <div style="flex-shrink:0;"><span onclick="_awySetAll(true)">모두</span><span onclick="_awySetAll(false)">해제</span></div></div>` +
    rows.map(([k, nm, col, cnt]) =>
      `<label class="aspc-item"><input type="checkbox" ${awyCat[k] ? 'checked' : ''} onchange="toggleAwyCat('${k}')">
        <span style="color:${col};">■</span> ${nm} <span style="color:#666;font-size:8px;">${cnt}</span></label>`).join('');
}
function toggleAwyLayer() {   // AWY 버튼 → 카테고리 패널 열기/닫기
  const p = document.getElementById('awy-panel');
  const open = !p.classList.contains('open');
  p.classList.toggle('open', open);
  if (open) _awyRenderPanel();
  _awyUpdateBtn();
}
// 저장된 상태 복원
try { _drawAwyLayer(); _awyUpdateBtn(); } catch(e) { _swallow(e); }

// AIP ENR 2.1/2.2에서 추출한 공역 데이터 (TMA/CTA/제주 Class B/ATZ/관제권/소음방지)
const AIRSPACE_DB = [
  {id:'TMA_Seoul_T01',grp:'TMA Seoul',name:'T01',alt:'1 000 ft AGL1)',poly:[[37.35278,125.54806],[37.65278,126.16472],[37.71944,126.68111],[37.63611,126.88111],[37.96944,127.66444],[37.27194,127.66444],[37.25278,127.39778],[37.30278,127.31444],[37.30278,127.14778],[37.35278,126.96444],[37.34028,126.80611],[37.14861,126.61028],[37.14194,126.52861],[37.09389,126.36611],[37.08806,125.8025],[37.26944,125.79806]]},
  {id:'TMA_Seoul_T02',grp:'TMA Seoul',name:'T02',poly:[[37.96944,127.66444],[38.00278,127.91444],[37.16944,127.91444],[37.16944,127.76444],[37.11111,127.66444]]},
  {id:'TMA_Seoul_T03',grp:'TMA Seoul',name:'T03',poly:[[37.34028,126.80611],[37.35278,126.96444],[37.30278,127.14778],[37.30278,127.31444],[37.25278,127.39778],[37.25278,127.11444],[37.16083,126.72611],[37.14861,126.61028]]},
  {id:'TMA_Seoul_T04',grp:'TMA Seoul',name:'T04',alt:'FL 185',poly:[[37.08806,125.8025],[37.09389,126.36611],[37.14194,126.52861],[37.16083,126.72611],[37.22583,126.99361],[37.09194,127.02972],[36.96944,126.48111],[37.01389,126.28111],[36.94778,125.80639]]},
  {id:'TMA_Seoul_T05',grp:'TMA Seoul',name:'T05',poly:[[37.22583,126.99361],[37.25278,127.11444],[37.25278,127.39778],[37.27194,127.66444],[37.1775,127.66444],[37.09194,127.02972]]},
  {id:'TMA_Seoul_T06',grp:'TMA Seoul',name:'T06',alt:'9 500 ft AMSL ~ FL 185',poly:[[36.96944,126.48111],[37.09194,127.02972],[37.1775,127.66444],[37.04167,127.66444],[36.87944,126.58444]]},
  {id:'TMA_Seoul_T07',grp:'TMA Seoul',name:'T07',alt:'FL 185',poly:[[36.87944,126.58444],[37.04167,127.66444],[37.03611,127.66444],[37.01286,127.61881],[36.98241,127.58522],[36.95327,127.54987],[36.9255,127.51285],[36.89915,127.47424],[36.8743,127.43413],[36.85099,127.3926],[36.82928,127.34976],[36.80921,127.3057],[36.79083,127.26051],[36.77419,127.2143],[36.7593,127.16717],[36.74622,127.11923],[36.73496,127.07057],[36.72556,127.02132],[36.71803,126.97156],[36.71239,126.92143],[36.70866,126.87102],[36.70683,126.82045],[36.72083,126.77028]]},
  {id:'TMA_Seoul_T08',grp:'TMA Seoul',name:'T08',alt:'11 500 ft AMSL',poly:[[36.98056,126.43139],[36.96944,126.48111],[36.87944,126.58444],[36.86111,126.46583]]},
  {id:'TMA_Seoul_T09',grp:'TMA Seoul',name:'T09',alt:'FL 185',poly:[[36.98083,126.04361],[37.01389,126.28111],[36.98056,126.43139],[36.86111,126.46583],[36.87944,126.58444],[36.72083,126.77028],[36.72462,126.72963],[36.72736,126.68901],[36.73136,126.64855],[36.73661,126.60831],[36.74311,126.56835],[36.75084,126.52873],[36.7598,126.48951],[36.76997,126.45075],[36.78133,126.4125],[36.79388,126.37483],[36.80758,126.33778],[36.82242,126.30142],[36.83839,126.26581],[36.85544,126.23098],[36.87357,126.197],[36.89273,126.16391],[36.91291,126.13178],[36.93408,126.10064],[36.95619,126.07054]]},
  {id:'TMA_Seoul_S1',grp:'TMA Seoul',name:'S1',alt:'1 600 ft AMSL ~ 6 000 ft AMSL',poly:[[37.69806,126.27444],[37.72667,126.4925],[37.70222,126.56944],[37.66,126.24333],[37.67444,126.24611]]},
  {id:'TMA_OSAN_T11',grp:'TMA OSAN',name:'T11',alt:'1 000 ft AGL1)',poly:[[37.08806,125.8025],[37.09389,126.36611],[37.14194,126.52861],[37.16083,126.72611],[37.22583,126.99361],[37.09194,127.02972],[36.99528,126.595],[37.04306,126.55694],[37.01389,126.28111],[36.94778,125.80639]]},
  {id:'TMA_OSAN_T03',grp:'TMA OSAN',name:'T03',alt:'1 000 ft AGL1)',poly:[[37.34028,126.80611],[37.35278,126.96444],[37.30278,127.14778],[37.30278,127.31444],[37.25278,127.39778],[37.25278,127.11444],[37.16083,126.72611],[37.14861,126.61028]]},
  {id:'TMA_OSAN_T05',grp:'TMA OSAN',name:'T05',alt:'1 000 ft AGL ~ 7 500 ft AMSL',poly:[[37.22583,126.99361],[37.25278,127.11444],[37.25278,127.39778],[37.27194,127.66444],[37.1775,127.66444],[37.09194,127.02972]]},
  {id:'TMA_OSAN_T06',grp:'TMA OSAN',name:'T06',alt:'1 000 ft AGL ~ 9 500 ft AMSL',poly:[[36.96944,126.48111],[37.09194,127.02972],[37.1775,127.66444],[37.04167,127.66444],[36.87944,126.58444]]},
  {id:'TMA_OSAN_T12',grp:'TMA OSAN',name:'T12',alt:'4 500 ft AMSL ~ 6 500 ft AMSL',poly:[[37.01389,126.28111],[37.04306,126.55694],[36.99528,126.595],[36.96944,126.48111]]},
  {id:'TMA_OSAN_T13',grp:'TMA OSAN',name:'T13',alt:'4 500 ft AMSL ~ 9 500 ft AMSL',poly:[[36.96944,126.48111],[36.99528,126.595],[36.89361,126.67556],[36.87944,126.58444]]},
  {id:'TMA_OSAN_T14',grp:'TMA OSAN',name:'T14',alt:'4 500 ft AMSL ~ 11 500 ft AMSL',poly:[[36.87944,126.58444],[36.89361,126.67556],[36.74083,126.74306]]},
  {id:'TMA_OSAN_T15',grp:'TMA OSAN',name:'T15',alt:'1 000 ft AGL1) ~ 11 500 ft AMSL',poly:[[36.89361,126.67556],[37.04167,127.66444],[37.03611,127.66444],[37.01286,127.61881],[36.98241,127.58522],[36.95327,127.54987],[36.9255,127.51285],[36.89915,127.47424],[36.8743,127.43413],[36.85099,127.3926],[36.82928,127.34976],[36.80921,127.3057],[36.79083,127.26051],[36.77419,127.2143],[36.7593,127.16717],[36.74622,127.11923],[36.73496,127.07057],[36.72556,127.02132],[36.71803,126.97156],[36.71239,126.92143],[36.70866,126.87102],[36.70683,126.82045],[36.72083,126.77028],[36.74083,126.74306]]},
  {id:'TMA_OSAN_T16',grp:'TMA OSAN',name:'T16',alt:'1 000 ft AGL1) ~ FL 145',poly:[[36.72083,126.77028],[36.70683,126.82045],[36.70866,126.87102],[36.71239,126.92143],[36.71803,126.97156],[36.72556,127.02132],[36.73496,127.07057],[36.74622,127.11923],[36.7593,127.16717],[36.77419,127.2143],[36.79083,127.26051],[36.80921,127.3057],[36.82928,127.34976],[36.85099,127.3926],[36.8743,127.43413],[36.89915,127.47424],[36.9255,127.51285],[36.95327,127.54987],[36.98241,127.58522],[37.01286,127.61881],[37.03611,127.66444],[36.66944,127.08111],[36.38639,127.06444],[36.38611,126.87972],[36.58278,126.92111],[36.63444,126.88639]]},
  {id:'TMA_OSAN_T17',grp:'TMA OSAN',name:'T17',alt:'6 500 ft AMSL ~ FL 145',poly:[[37.03611,127.66444],[36.83611,127.66444],[36.38639,127.06444],[36.66944,127.08111]]},
  {id:'TMA_Jungwon_T18',grp:'TMA Jungwon',name:'T18',poly:[[37.11111,127.66444],[37.11944,127.84778],[37.16944,127.91444],[37.23611,128.06444],[37.51944,128.33111],[37.55278,128.60611],[37.11944,128.68111],[36.95278,128.68111],[36.83611,128.16444]]},
  {id:'TMA_Jungwon_T19',grp:'TMA Jungwon',name:'T19',poly:[[37.11111,127.66444],[36.83611,128.16444],[36.74944,127.96444],[36.48639,127.84778],[36.48639,128.16444],[36.38639,128.16444],[36.11972,127.83111],[36.20306,127.61444],[36.38639,127.06444],[36.83611,127.66444]]},
  {id:'TMA_Jungwon_T20',grp:'TMA Jungwon',name:'T20',alt:'5 500 ft AMSL ~ FL 145',poly:[[36.74944,127.96444],[36.83611,128.16444],[36.48639,128.16444],[36.48639,127.84778]]},
  {id:'TMA_Jungwon_T17',grp:'TMA Jungwon',name:'T17',alt:'6 500 ft AMSL',poly:[[37.03611,127.66444],[36.83611,127.66444],[36.38639,127.06444],[36.66944,127.08111]]},
  {id:'TMA_Jungwon_T21',grp:'TMA Jungwon',name:'T21',alt:'3 500 ft AMSL',poly:[[37.11111,127.66444],[37.16944,127.76444],[37.16944,127.91444],[37.11944,127.84778]]},
  {id:'TMA_Jungwon_T22',grp:'TMA Jungwon',name:'T22',alt:'9 500 ft AMSL ~ FL 175',poly:[[36.83611,128.16444],[36.95278,128.68111],[36.80278,128.46444],[36.76111,128.29778]]},
  {id:'TMA_Jeju_T23',grp:'TMA Jeju',name:'T23',poly:[[33.00333,125.99806],[34.25306,125.99806],[34.25333,127.33139],[33.27,127.33139],[33.00333,126.99806]]},
  {id:'TMA_Jeju_T43',grp:'TMA Jeju',name:'T43',poly:[[33.00333,125.83139],[34.25306,125.83139],[34.25306,125.99806],[33.00333,125.99806]]},
  {id:'TMA_Gangneung_T24',grp:'TMA Gangneung',name:'T24',poly:[[38.13611,128.53111],[38.20278,128.59778],[38.20278,129.8475],[37.11944,129.8475],[37.11944,128.68111],[38.06944,128.51444]]},
  {id:'TMA_Gangneung_T25',grp:'TMA Gangneung',name:'T25',alt:'FL 145',poly:[[38.26667,128.55],[38.3525,128.75],[38.35278,129.0],[38.20278,129.0],[38.20278,128.59778]]},
  {id:'TMA_Gimhae_T26',grp:'TMA Gimhae',name:'T26',poly:[[35.50306,128.49778],[35.47972,128.56111],[35.50333,128.77389],[35.50306,129.03111],[35.41972,129.08944],[35.41972,129.83111],[35.23639,129.79778],[34.50306,128.86444],[34.50306,128.49778]]},
  {id:'TMA_Gunsan_T27',grp:'TMA Gunsan',name:'T27',alt:'FL 225',poly:[[36.38639,126.53139],[36.38611,125.81472],[35.50306,125.83139],[35.50306,126.49806],[35.91306,126.60972]]},
  {id:'TMA_Gunsan_T28',grp:'TMA Gunsan',name:'T28',poly:[[36.38639,126.53139],[36.38639,127.06444],[36.20306,127.61444],[35.75306,127.61444],[35.75306,127.16444],[35.50306,126.83139],[35.50306,126.49806],[35.91306,126.60972]]},
  {id:'TMA_Gwangju_T29',grp:'TMA Gwangju',name:'T29',alt:'1 000 ft AGL1)',poly:[[35.50306,125.83139],[35.50306,126.83139],[35.75306,127.16444],[35.75306,127.61444],[35.50306,127.83111],[34.25306,126.99806],[34.25306,125.83139]]},
  {id:'TMA_Gwangju_T30',grp:'TMA Gwangju',name:'T30',poly:[[35.21972,127.64778],[35.15306,127.31444],[34.73639,127.31472]]},
  {id:'TMA_Sacheon_T31',grp:'TMA Sacheon',name:'T31',poly:[[35.50306,127.83111],[35.50306,128.49778],[34.25333,128.49778],[34.25306,126.99806]]},
  {id:'TMA_Sacheon_T30',grp:'TMA Sacheon',name:'T30',poly:[[35.15306,127.31444],[35.21972,127.64778],[34.73639,127.31472]]},
  {id:'TMA_Pohang_T32',grp:'TMA Pohang',name:'T32',poly:[[36.33639,128.66444],[36.33639,129.84778],[35.83639,129.83111],[36.0,129.25],[36.1,129.08333]]},
  {id:'TMA_Pohang_T33',grp:'TMA Pohang',name:'T33',poly:[[36.0,129.25],[35.83639,129.83111],[35.41972,129.83111],[35.41972,129.16444],[35.65,129.225],[35.75,129.25]]},
  {id:'TMA_Pohang_T34',grp:'TMA Pohang',name:'T34',alt:'1 000 ft AGL',poly:[[36.1,129.08333],[36.0,129.25],[35.75,129.25],[35.65,129.225],[35.81667,129.16667],[35.90361,129.08111]]},
  {id:'TMA_Pohang_T42',grp:'TMA Pohang',name:'T42',alt:'1 000 ft AGL ~ 9 500 ft AMSL',poly:[[37.11944,129.26778],[37.11944,129.8475],[36.33639,129.84778],[36.33639,129.43528],[36.59167,129.43528],[36.94194,129.26778]]},
  {id:'TMA_Daegu_T35',grp:'TMA Daegu',name:'T35',poly:[[36.48639,128.16444],[36.48639,128.39778],[36.33639,128.66444],[36.1,129.08333],[35.90361,129.08111],[35.81667,129.16667],[35.65,129.225],[35.41972,129.16444],[35.41972,129.08944],[35.50306,129.03111],[35.50333,128.77389],[35.47972,128.56111],[35.50306,128.49778],[35.50306,127.83111],[35.75306,127.61444],[36.20306,127.61444],[36.11972,127.83111],[36.38639,128.16444]]},
  {id:'TMA_Daegu_T33',grp:'TMA Daegu',name:'T33',alt:'10 500 ft AMSL ~ FL 225',poly:[[36.0,129.25],[35.83639,129.83111],[35.41972,129.83111],[35.41972,129.16444],[35.65,129.225],[35.75,129.25]]},
  {id:'TMA_Daegu_T34',grp:'TMA Daegu',name:'T34',alt:'7 500 ft AMSL ~ FL 225',poly:[[36.1,129.08333],[36.0,129.25],[35.75,129.25],[35.65,129.225],[35.81667,129.16667],[35.90361,129.08111]]},
  {id:'TMA_Yecheon_T36',grp:'TMA Yecheon',name:'T36',poly:[[37.11944,128.68111],[37.11944,129.26778],[36.94194,129.26778],[36.59167,129.43528],[36.33639,129.43528],[36.33639,128.66444],[36.48639,128.39778],[36.48639,128.16444],[36.83611,128.16444],[36.76111,128.29778],[36.80278,128.46444],[36.95278,128.68111]]},
  {id:'TMA_Yecheon_T42',grp:'TMA Yecheon',name:'T42',poly:[[37.11944,129.26778],[37.11944,129.8475],[36.33639,129.84778],[36.33639,129.43528],[36.59167,129.43528],[36.94194,129.26778]]},
  {id:'TMA_Yecheon_T22',grp:'TMA Yecheon',name:'T22',alt:'1 000 ft AGL ~ 9 500 ft AMSL',poly:[[36.83611,128.16444],[36.95278,128.68111],[36.80278,128.46444],[36.76111,128.29778]]},
  {id:'TMA_Yecheon_T20',grp:'TMA Yecheon',name:'T20',alt:'1 000 ft AGL ~ 5 500 ft AMSL',poly:[[36.74944,127.96444],[36.83611,128.16444],[36.48639,128.16444],[36.48639,127.84778]]},
  {id:'TMA_Haemi_T37',grp:'TMA Haemi',name:'T37',alt:'1 000 ft AGL1) ~ FL 145',poly:[[36.94778,125.80639],[37.01389,126.28111],[36.98056,126.43139],[36.86111,126.46583],[36.87944,126.58444],[36.74083,126.74306],[36.63444,126.88639],[36.58278,126.92111],[36.38611,126.87972],[36.38611,125.81472]]},
  {id:'TMA_Haemi_T38',grp:'TMA Haemi',name:'T38',alt:'11 500 ft AMSL',poly:[[36.98056,126.43139],[36.96944,126.48111],[36.87944,126.58444],[36.86111,126.46583]]},
  {id:'TMA_Haemi_T39',grp:'TMA Haemi',name:'T39',poly:[[37.01389,126.28111],[37.04306,126.55694],[36.89361,126.67556],[36.87944,126.58444],[36.96944,126.48111],[36.98056,126.43139]]},
  {id:'TMA_Haemi_T14',grp:'TMA Haemi',name:'T14',alt:'4 500 ft AMSL',poly:[[36.87944,126.58444],[36.89361,126.67556],[36.74083,126.74306]]},
  {id:'TMA_Wonju_T02',grp:'TMA Wonju',name:'T02',alt:'FL 175',poly:[[37.96944,127.66444],[38.00278,127.91444],[37.16944,127.91444],[37.16944,127.76444],[37.11111,127.66444]]},
  {id:'TMA_Wonju_T40',grp:'TMA Wonju',name:'T40',poly:[[37.11111,127.66444],[37.16944,127.76444],[37.16944,127.91444],[37.11944,127.84778]]},
  {id:'TMA_Wonju_T41',grp:'TMA Wonju',name:'T41',alt:'1 000 ft AGL ~ FL 175',poly:[[38.00278,127.91444],[38.06944,128.51444],[37.55278,128.60611],[37.51944,128.33111],[37.23611,128.06444],[37.16944,127.91444]]},
  {id:'CTA_West-sea High Sector_',grp:'CTA',name:'West-sea High Sector',alt:'FL 295',poly:[[38.0,124.0],[38.0,124.85],[38.33889,127.66444],[37.03611,127.66444],[36.97111,127.56083],[37.11944,127.23111],[37.08389,126.9375],[36.94722,125.80611],[36.90861,125.6],[36.33333,125.6],[36.33333,124.0]]},
  {id:'CTA_West-sea Low Sector_',grp:'CTA',name:'West-sea Low Sector',alt:'1 000 ft AGL1) ~ FL 295',poly:[[38.0,124.0],[38.0,124.85],[38.33889,127.66444],[37.03611,127.66444],[36.97111,127.56083],[37.11944,127.23111],[37.08389,126.9375],[36.94722,125.80611],[36.90861,125.6],[36.33333,125.6],[36.33333,124.0]]},
  {id:'CTA_East-sea Low Sector_',grp:'CTA',name:'East-sea Low Sector',alt:'1 000 ft AGL1)',poly:[[38.33889,127.66444],[38.63333,128.36667],[38.63333,129.8475],[37.11944,129.8475],[36.33639,129.84778],[37.11944,128.68111],[37.11944,127.84778],[37.11944,127.84778],[37.11111,127.66444]]},
  {id:'CTA_East-sea Sector_1',grp:'CTA',name:'East-sea Sector ◯1',alt:'1 000 ft AGL1) ~ FL 600',poly:[[38.63333,129.8475],[38.63333,133.65],[38.0,133.0],[37.5,133.0],[37.31278,132.73639],[36.37333,131.42833],[36.175,131.1675],[36.33639,129.84778]]},
  {id:'CTA_East-sea Sector_2',grp:'CTA',name:'East-sea Sector ◯2',alt:'FL 295 ~ FL 600',poly:[[38.33889,127.66444],[38.63333,128.36667],[38.63333,129.8475],[37.11944,129.8475],[36.33639,129.84778],[37.11944,128.68111],[37.11944,127.84778],[37.11944,127.84778],[37.11111,127.66444]]},
  {id:'CTA_Daegu Sector_',grp:'CTA',name:'Daegu Sector',alt:'FL 600',poly:[[36.73861,127.19111],[36.83833,127.34861],[36.97111,127.56083],[35.90361,129.08111],[35.41167,129.15972],[35.41167,130.17],[35.20889,129.88472],[34.78861,129.32306],[34.72306,129.23333],[34.66667,129.16667],[34.50306,129.01778],[34.50306,128.49778],[34.76528,128.49778],[35.21028,128.49778],[35.50306,127.83111],[35.51778,127.81861],[35.75306,127.61444],[35.86361,127.61444],[36.20306,127.61444]]},
  {id:'CTA_Pohang Sector_',grp:'CTA',name:'Pohang Sector',alt:'1 000 ft AGL1) ~ FL 600',poly:[[36.97111,127.56083],[37.03611,127.66444],[37.11111,127.66444],[37.11944,127.84778],[37.11944,128.68111],[36.33639,129.84778],[36.175,131.1675],[35.82389,130.72361],[35.41167,130.17],[35.41167,129.15972],[35.90361,129.08111]]},
  {id:'CTA_South-sea Sector_',grp:'CTA',name:'South-sea Sector',alt:'1 000 ft AGL1) ~ FL 600',poly:[[35.50306,127.83111],[35.21028,128.49778],[34.50306,128.49778],[34.50306,129.01778],[33.75389,128.45167],[33.62556,127.33139],[33.91444,127.33139],[34.25333,127.33139],[35.15306,127.31444],[35.21972,127.64778]]},
  {id:'CTA_Gunsan Low Sector_',grp:'CTA',name:'Gunsan Low Sector',alt:'1 000 ft AGL1) ~ FL 255',poly:[[36.33333,124.0],[36.33333,125.6],[36.90861,125.6],[36.94722,125.80611],[37.08389,126.9375],[37.11944,127.23111],[36.97111,127.56083],[36.83833,127.34861],[36.73861,127.19111],[36.20306,127.61444],[35.75306,127.61444],[35.50306,127.83111],[35.50306,126.63972],[35.50306,124.0]]},
  {id:'CTA_Gunsan High Sector_',grp:'CTA',name:'Gunsan High Sector',alt:'FL 255 ~ FL 600',poly:[[36.33333,124.0],[36.33333,125.6],[36.90861,125.6],[36.94722,125.80611],[37.08389,126.9375],[37.11944,127.23111],[36.97111,127.56083],[36.83833,127.34861],[36.73861,127.19111],[36.20306,127.61444],[35.75306,127.61444],[35.50306,127.83111],[35.50306,126.63972],[35.50306,124.0]]},
  {id:'CTA_Gwangju Low Sector_',grp:'CTA',name:'Gwangju Low Sector',alt:'FL 255 ~ 1 000 ft AGL1)',poly:[[35.50306,124.0],[35.50306,127.83111],[35.21972,127.64778],[35.15306,127.31444],[34.25333,127.33139],[34.08333,127.33139],[33.88083,126.7325],[33.84167,126.56722],[33.84167,124.0],[35.50306,124.0],[35.50306,124.0],[35.50306,127.83111],[35.21972,127.64778],[35.15306,127.31444],[34.25333,127.33139],[34.08333,127.33139],[33.88083,126.7325],[33.84167,126.56722],[33.84167,124.0]]},
  {id:'CTA_Jeju North Sector_',grp:'CTA',name:'Jeju North Sector',alt:'1 000 ft AGL1) ~ FL 600',poly:[[33.84167,124.0],[33.84167,126.56722],[33.88083,126.7325],[34.08333,127.33139],[33.62556,127.33139],[33.75389,128.45167],[32.5,127.5],[32.5,126.83333],[32.53972,126.26],[32.48,125.98306],[32.04139,124.0]]},
  {id:'CTA_Jeju South High Sector_',grp:'CTA',name:'Jeju South High Sector',alt:'FL 335',poly:[[32.04139,124.0],[32.48,125.98306],[32.53972,126.26],[32.5,126.83333],[30.0,125.41667],[30.0,125.19833],[30.0,124.95333],[30.0,124.0],[31.61,124.0]]},
  {id:'CTA_Jeju South Low Sector_',grp:'CTA',name:'Jeju South Low Sector',alt:'1 000 ft AGL1)',poly:[[32.04139,124.0],[32.48,125.98306],[32.53972,126.26],[32.5,126.83333],[30.0,125.41667],[30.0,125.19833],[30.0,124.95333],[30.0,124.0],[31.61,124.0],[32.04139,124.0],[37.09056,127.02972],[34.75889,126.38111],[35.14472,128.69417],[36.96,127.03333],[36.26944,127.11389],[37.20111,127.47194],[37.23944,127.00694],[37.75389,128.945],[36.70444,126.48611],[37.03028,127.88583],[36.56806,127.5],[36.63167,128.355],[38.14417,128.60278]]},
  // ── ENR 5.1 금지구역(Prohibited)·제한구역(Restricted) ──
  {id:'PA_P518W',grp:'금지구역(P)',name:'P518W Korean Tactical Zone(West)',alt:'UNL/GND',poly:[[38.0, 124.15], [38.0, 124.85], [37.71528, 126.10917], [37.70361, 126.16417], [37.65, 126.16667], [37.5, 125.83333], [37.5, 124.63333]]},
  {id:'PA_P518',grp:'금지구역(P)',name:'P518 Korean Tactical Zone (근사)',alt:'UNL/GND',poly:[[37.65, 126.16667], [37.71667, 126.68333], [37.63333, 126.88333], [37.96667, 127.66667], [38.06667, 128.51667], [38.13333, 128.53333], [38.2, 128.6]]},
  {id:'PA_P518E',grp:'금지구역(P)',name:'P518E Korean Tactical Zone(East)',alt:'UNL/GND',poly:[[38.63333, 128.36667], [38.63333, 128.63333], [38.36667, 128.78333], [38.26667, 128.55]]},
  {id:'PA_P73_1',grp:'금지구역(P)',name:'P73 Seoul (Center 1)',alt:'UNL/GND',circle:{c:[37.53583,126.97722],r:2.0}},
  {id:'PA_P73_2',grp:'금지구역(P)',name:'P73 Seoul (Center 2)',alt:'UNL/GND',circle:{c:[37.54222,126.99528],r:2.0}},
  {id:'RA_R1',grp:'제한구역(R)',name:'R1 Yongmun',alt:'6 000 ft/GND',poly:[[37.52056, 127.47036], [37.53669, 127.52061], [37.51169, 127.52975], [37.51169, 127.47033]]},
  {id:'RA_R10',grp:'제한구역(R)',name:'R10 Maebong',alt:'5 000 ft/GND',poly:[[37.63333, 127.68333], [37.65, 127.73333], [37.61667, 127.78333], [37.53333, 127.8], [37.53333, 127.68333]]},
  {id:'RA_R14',grp:'제한구역(R)',name:'R14 Pyeongdong',alt:'By NOTAM',poly:[[35.15, 126.7], [35.15, 126.73333], [35.13795, 126.75744], [35.08845, 126.72954], [35.1, 126.68333], [35.12944, 126.68806], [35.135, 126.68222]]},
  {id:'RA_R72',grp:'제한구역(R)',name:'R72 Yokjido',alt:'UNL/GND',poly:[[34.16139, 128.0], [34.30028, 128.19083], [34.3, 128.58333], [34.33667, 128.58722], [34.15361, 128.71972], [34.0, 128.58333], [34.0, 128.0]]},
  {id:'RA_R74',grp:'제한구역(R)',name:'R74 Dong-Hae-Nam-Bu',alt:'FL500/GND',poly:[[36.86667, 130.0], [36.83333, 130.21667], [36.73333, 130.41667], [36.03333, 130.41667], [36.03333, 130.0]]},
  {id:'RA_R75',grp:'제한구역(R)',name:'R75 (수도권)',alt:'10 000 ft AMSL/SFC',poly:[[37.66361, 126.80667], [37.63111, 126.80361], [37.61694, 126.79833], [37.59167, 126.80472], [37.56917, 126.80667], [37.44806, 126.95611], [37.44806, 127.06056], [37.5425, 127.11306], [37.57972, 127.15833], [37.61556, 127.14167], [37.64083, 127.13333], [37.67583, 127.08694], [37.69333, 127.05472], [37.7, 127.02778], [37.63278, 126.88306]]},
  {id:'RA_R77',grp:'제한구역(R)',name:'R77 Machajin',alt:'FL150/GND',poly:[[38.55, 128.4], [38.56667, 128.51667], [38.53333, 128.53333], [38.5, 128.51667], [38.51667, 128.4]]},
  {id:'RA_R80',grp:'제한구역(R)',name:'R80 Seo-Hae-Jung-Bu',alt:'FL500/GND',poly:[[36.53333, 124.83333], [36.53333, 125.6], [36.08361, 125.60111], [36.08194, 124.52556], [36.39889, 124.52389]]},
  {id:'RA_R84',grp:'제한구역(R)',name:'R84 Seo-Hae-Nam-Bu',alt:'FL500/GND',poly:[[35.24917, 124.52889], [35.25028, 125.60278], [34.83333, 125.60333], [34.8325, 124.53056]]},
  {id:'RA_R88',grp:'제한구역(R)',name:'R88 Seo-Hae-Buk-Bu',alt:'FL500/GND',poly:[[37.0225, 124.83333], [37.03556, 125.6], [36.53333, 125.6], [36.53333, 124.83333]]},
  {id:'RA_R89',grp:'제한구역(R)',name:'R89 Ochon',alt:'1 000 ft/GND',poly:[[35.93636, 129.34769], [35.95303, 129.39769], [35.95303, 129.43103], [35.86969, 129.33103]]},
  {id:'RA_R90A',grp:'제한구역(R)',name:'R90A Susong-A',alt:'2 000 ft/GND',poly:[[35.92692, 129.42989], [35.92275, 129.45489], [35.89053, 129.52128], [35.88636, 129.51711], [35.89469, 129.47408], [35.89192, 129.44297]]},
  {id:'RA_R90B',grp:'제한구역(R)',name:'R90B Susong-B',alt:'5 500 ft/GND',poly:[[35.89192, 129.44297], [35.89469, 129.47408], [35.88636, 129.51711], [35.84358, 129.496], [35.83692, 129.46267]]},
  {id:'RA_R97A',grp:'제한구역(R)',name:'R97A Cheolmae-A',alt:'FL300/GND',poly:[[36.33333, 126.51667], [36.3, 126.58333], [36.03333, 126.4], [36.21667, 126.18333]]},
  {id:'RA_R97B',grp:'제한구역(R)',name:'R97B Cheolmae-B',alt:'UNL/GND',poly:[[36.33333, 125.95], [36.33333, 126.16667], [36.36875, 126.24547], [36.35625, 126.50211], [36.23333, 126.63333], [35.88333, 126.36667], [36.2, 126.05], [36.23333, 125.95]]},
  {id:'RA_R97C',grp:'제한구역(R)',name:'R97C Cheolmae-C',alt:'UNL/GND',poly:[[36.35819, 126.38183], [36.35625, 126.50211], [36.23333, 126.63333], [35.68333, 125.73333], [35.85, 125.58333]]},
  {id:'RA_R97D',grp:'제한구역(R)',name:'R97D Cheolmae-D',alt:'UNL/GND',poly:[[36.35486, 126.41214], [36.35625, 126.50211], [36.23333, 126.63333], [35.58333, 126.1], [35.7, 125.86667]]},
  {id:'RA_R97E',grp:'제한구역(R)',name:'R97E Cheolmae-E',alt:'FL300/SFC',poly:[[36.31083, 126.55056], [36.23333, 126.63333], [36.10639, 126.53639], [36.23028, 126.41667]]},
  {id:'RA_R97F',grp:'제한구역(R)',name:'R97F Cheolmae-F',alt:'FL150/SFC',poly:[[36.33333, 126.51667], [36.3, 126.58333], [36.20194, 126.51583], [36.28833, 126.41667]]},
  {id:'RA_R99',grp:'제한구역(R)',name:'R99 Geojedo',alt:'FL360/GND',poly:[[34.68444, 128.72417], [34.76833, 128.84194], [34.77889, 128.89389], [34.56306, 129.05583], [34.15361, 128.71972], [34.33667, 128.58722]]},
  {id:'RA_R107',grp:'제한구역(R)',name:'R107 Dong-Hae-Buk-Bu',alt:'FL400/GND',poly:[[38.25, 129.85], [38.23333, 130.16667], [37.78333, 130.16667], [37.8, 129.85]]},
  {id:'RA_R108A',grp:'제한구역(R)',name:'R108A Anheung-A',alt:'FL270/GND',poly:[[36.67953, 126.15464], [36.67675, 126.19964], [36.55233, 126.23047], [36.54956, 126.15131]]},
  {id:'RA_R108B',grp:'제한구역(R)',name:'R108B Anheung-B',alt:'FL330/GND',poly:[[36.67953, 126.15464], [36.67675, 126.19964], [36.49039, 126.25047], [36.46956, 126.12464]]},
  {id:'RA_R108C',grp:'제한구역(R)',name:'R108C Anheung-C',alt:'UNL/GND',poly:[[36.67731, 126.17325], [36.56956, 126.29794], [34.97336, 126.05219], [35.02194, 125.71389], [36.63619, 125.998]]},
  {id:'RA_R108D',grp:'제한구역(R)',name:'R108D Anheung-D',alt:'UNL/GND',poly:[[36.67953, 126.15464], [36.67675, 126.19797], [36.36125, 126.15214], [36.38625, 126.00633]]},
  {id:'RA_R108E',grp:'제한구역(R)',name:'R108E Anheung-E',alt:'FL400/GND',poly:[[36.67758, 126.16769], [36.68647, 126.19992], [36.61594, 126.26519], [36.56011, 126.26519], [36.55956, 126.22853]]},
  {id:'RA_R108F',grp:'제한구역(R)',name:'R108F Anheung-F',alt:'FL800/GND',poly:[[36.67953, 126.15464], [36.67675, 126.19797], [36.28875, 126.00911], [36.30292, 125.94383]]},
  {id:'RA_R110',grp:'제한구역(R)',name:'R110 Pilseung',alt:'FL400/GND',poly:[[37.21667, 128.68333], [37.21667, 129.05], [36.91667, 129.05], [36.91667, 128.68333]]},
  {id:'RA_R111',grp:'제한구역(R)',name:'R111 Ungchon',alt:'FL250/GND',poly:[[36.23528, 126.41667], [36.24056, 126.64944], [36.15444, 126.65222], [36.10694, 126.63806], [36.10194, 126.42083]]},
  {id:'RA_R114',grp:'제한구역(R)',name:'R114 Biseung',alt:'3 000 ft/GND',poly:[[37.57222, 127.78528], [37.57222, 127.86167], [37.55972, 127.87556], [37.53056, 127.87], [37.51667, 127.82833], [37.53333, 127.80333]]},
  {id:'RA_R115',grp:'제한구역(R)',name:'R115 Donghae',alt:'FL380/GND',poly:[[37.4, 129.75], [37.225, 131.0], [36.81667, 131.0]]},
  {id:'RA_R118',grp:'제한구역(R)',name:'R118 Jeju',alt:'2 500 ft/GND',poly:[[34.0, 127.66667], [34.0, 128.5], [33.16667, 127.83333], [33.16667, 127.66667]]},
  {id:'RA_R119',grp:'제한구역(R)',name:'R119 Ulsan',alt:'2 500 ft/GND',poly:[[35.78333, 129.66806], [35.71667, 130.20333], [35.62667, 130.20333], [35.46556, 129.86333], [35.46667, 129.66806]]},
  {id:'RA_R120',grp:'제한구역(R)',name:'R120 Dong-Hae-Dong-Bu',alt:'FL380/GND',poly:[[36.73333, 130.41667], [36.41667, 130.91667], [36.28333, 130.91667], [36.03333, 130.48333], [36.03333, 130.41667]]},
  {id:'RA_R121',grp:'제한구역(R)',name:'R121 Sokcho',alt:'2 500 ft/GND',poly:[[38.41667, 128.75], [38.41667, 129.5], [38.16667, 129.5], [38.16667, 129.0], [38.28333, 129.0], [38.28333, 128.75]]},
  {id:'RA_R122',grp:'제한구역(R)',name:'R122 Cheondukbong',alt:'3 700 ft/GND',poly:[[37.37086, 127.44478], [37.36725, 127.47311], [37.32197, 127.42867], [37.33475, 127.41256]]},
  {id:'RA_R123',grp:'제한구역(R)',name:'R123 Eochungdo',alt:'3 700 ft/GND',poly:[[36.0, 125.0], [36.0, 125.5], [35.58333, 125.5], [35.58333, 125.0]]},
  {id:'RA_R124',grp:'제한구역(R)',name:'R124 Deokjukdo',alt:'2 500 ft/GND',poly:[[37.1, 125.7], [37.1, 126.16667], [36.91667, 125.95], [36.91667, 125.7]]},
  {id:'RA_R126',grp:'제한구역(R)',name:'R126 Chujado',alt:'3 000 ft/GND',poly:[[34.0, 125.8], [34.0, 126.0], [33.5, 126.0], [33.5, 125.8]]},
  {id:'RA_R128',grp:'제한구역(R)',name:'R128 Seoguipo',alt:'7 000 ft/GND',poly:[[33.0, 126.61667], [32.66667, 126.75], [32.66667, 126.46667]]},
  {id:'RA_R129',grp:'제한구역(R)',name:'R129 Suryunsan',alt:'3 500 ft/GND',poly:[[35.34972, 126.66861], [35.35667, 126.68861], [35.35139, 126.70917], [35.28028, 126.71111], [35.28889, 126.68889]]},
  {id:'RA_R131',grp:'제한구역(R)',name:'R131 Baengnyeong',alt:'5 000 ft/SFC',poly:[[37.98333, 124.06944], [37.98333, 124.63611], [37.98917, 124.70833], [37.9, 124.70833], [37.9, 124.63611], [37.9, 124.06944]]},
  {id:'RA_R132',grp:'제한구역(R)',name:'R132 Daechongdo East',alt:'10 000 ft/GND',poly:[[37.95, 124.68333], [37.95, 124.73333], [37.75, 124.83333], [37.75, 124.78333]]},
  {id:'RA_R134',grp:'제한구역(R)',name:'R134 Yeonpyongdo',alt:'5 000 ft/GND',poly:[[37.64444, 124.75], [37.7, 124.75], [37.7, 124.93333], [37.625, 125.025], [37.56667, 125.24583], [37.66667, 125.53333], [37.68333, 125.65833], [37.68333, 125.69444], [37.62222, 125.69444], [37.62222, 125.65], [37.5125, 125.4], [37.43333, 125.4], [37.43333, 125.06667], [37.5375, 124.8]]},
  {id:'RA_R135',grp:'제한구역(R)',name:'R135 Gisamun',alt:'500 ft/GND',poly:[[38.15833, 129.06667], [38.1, 128.9625], [37.55833, 129.40417], [37.61667, 129.50556]]},
  {id:'RA_R136',grp:'제한구역(R)',name:'R136 Samcheok',alt:'500 ft/GND',poly:[[37.41667, 129.5125], [37.46944, 129.61667], [37.10833, 129.78611], [37.075, 129.66667]]},
  {id:'RA_R137',grp:'제한구역(R)',name:'R137 Woodo',alt:'5 000 ft AMSL/SFC',poly:[[37.64083, 125.92417], [37.63972, 126.00583], [37.60639, 126.00528], [37.60611, 125.92333]]},
  {id:'RA_R141',grp:'제한구역(R)',name:'R141 Donghae KCG',alt:'300 ft AMSL/SFC',poly:[[37.66806, 131.2], [37.66806, 131.41667], [37.50139, 131.41667], [37.50139, 131.2]]},
  {id:'RA_R143',grp:'제한구역(R)',name:'R143 Busan KCG',alt:'300 ft AMSL/SFC',poly:[[35.11944, 129.28333], [35.07361, 129.34444], [34.97222, 129.23611], [35.01944, 129.17361]]},
  {id:'RA_R150',grp:'제한구역(R)',name:'R150 Seogwipo KCG Buk-Bu',alt:'300 ft AMSL/SFC',poly:[[33.14167, 126.36667], [33.14167, 126.48333], [32.975, 126.48333], [32.975, 126.36667]]},
  {id:'RA_R151A',grp:'제한구역(R)',name:'R151A Gunsan',alt:'100 ft AMSL/SFC',poly:[[35.83333, 126.31389], [35.83333, 126.33333], [35.75, 126.33333], [35.75, 126.25]]},
  {id:'RA_R153',grp:'제한구역(R)',name:'R153 Daechongdo Seobu',alt:'3 000 ft AMSL/SFC',poly:[[37.74861, 124.08611], [37.74861, 124.61111], [37.50278, 124.61111], [37.50389, 124.08611]]},
  {id:'RA_R154',grp:'제한구역(R)',name:'R154 Yeonpyongdo Nambu',alt:'3 000 ft AMSL/SFC',poly:[[37.69611, 125.72], [37.65917, 125.70083], [37.58806, 125.90333], [37.62972, 125.91944]]},
  {id:'RA_R156',grp:'제한구역(R)',name:'R156 Jumunjin',alt:'3 500 ft AMSL/SFC',poly:[[38.23333, 129.0], [38.23333, 129.76667], [37.8, 129.76667], [37.8, 129.63333], [38.16667, 129.31667], [38.16667, 129.0]]},
  {id:'RA_R17',grp:'제한구역(R)',name:'R17 Yeoju',alt:'FL150/GND',circle:{c:[37.33611,127.59778],r:5}},
  {id:'RA_R19',grp:'제한구역(R)',name:'R19 Jochiwon',alt:'3 400 ft/GND',circle:{c:[36.61111,127.22444],r:2}},
  {id:'RA_R20',grp:'제한구역(R)',name:'R20 Boeun',alt:'5 000 ft/GND',circle:{c:[36.47667,127.78333],r:2}},
  {id:'RA_R21',grp:'제한구역(R)',name:'R21 Eonyang',alt:'5 000 ft/GND',circle:{c:[35.52167,129.075],r:2}},
  {id:'RA_R35',grp:'제한구역(R)',name:'R35 Maesanri',alt:'2 500 ft/GND',circle:{c:[37.36056,127.25639],r:2}},
  {id:'RA_R81',grp:'제한구역(R)',name:'R81 Nakdong',alt:'FL220/SFC',circle:{c:[36.40278,128.28083],r:5}},
  {id:'RA_R100',grp:'제한구역(R)',name:'R100 Namhyongjedo',alt:'500 ft/GND',circle:{c:[34.88333,128.95],r:2}},
  {id:'RA_R104',grp:'제한구역(R)',name:'R104 Miyeodo',alt:'FL150/GND',circle:{c:[35.5475,126.44056],r:5}},
  {id:'RA_R105',grp:'제한구역(R)',name:'R105 Jikdo',alt:'FL400/GND',circle:{c:[35.89056,126.07667],r:10}},
  {id:'RA_R116',grp:'제한구역(R)',name:'R116 Daechongdo',alt:'2 500 ft/GND',circle:{c:[37.79861,124.65917],r:4}},
  {id:'RA_R117',grp:'제한구역(R)',name:'R117 Jaeundo',alt:'3 000 ft/GND',circle:{c:[34.70833,125.73333],r:5}},
  {id:'RA_R125',grp:'제한구역(R)',name:'R125 Heuksando',alt:'3 500 ft/GND',circle:{c:[34.55,125.35],r:5}},
  {id:'RA_R127',grp:'제한구역(R)',name:'R127 Beolgyo',alt:'3 000 ft/GND',circle:{c:[34.89056,127.30694],r:0.75}},
  {id:'RA_R133',grp:'제한구역(R)',name:'R133 Chochido',alt:'500 ft/GND',circle:{c:[37.37222,126.19306],r:2}},
  {id:'RA_R138',grp:'제한구역(R)',name:'R138 Daecheon',alt:'4 400 ft/SFC',circle:{c:[36.33639,126.53139],r:0.7}},
  {id:'RA_R139',grp:'제한구역(R)',name:'R139 Jincheon',alt:'5 400 ft/GND',circle:{c:[36.84056,127.40694],r:0.7}},
  {id:'RA_R140',grp:'제한구역(R)',name:'R140 Sokcho KCG',alt:'300 ft AMSL/SFC',circle:{c:[38.15,128.85],r:4}},
  {id:'RA_R142A',grp:'제한구역(R)',name:'R142A Pohang KCG A',alt:'300 ft AMSL/SFC',circle:{c:[37.13333,129.56667],r:2}},
  {id:'RA_R142B',grp:'제한구역(R)',name:'R142B Pohang KCG B',alt:'300 ft AMSL/SFC',circle:{c:[36.33333,129.83333],r:5}},
  {id:'RA_R142C',grp:'제한구역(R)',name:'R142C Pohang KCG C',alt:'300 ft AMSL/SFC',circle:{c:[36.08333,129.75],r:5}},
  {id:'RA_R144',grp:'제한구역(R)',name:'R144 Tongyeong KCG',alt:'300 ft AMSL/SFC',circle:{c:[34.65,128.43333],r:4}},
  {id:'RA_R145',grp:'제한구역(R)',name:'R145 Yeosu KCG',alt:'300 ft AMSL/SFC',circle:{c:[34.49889,128.08111],r:5}},
  {id:'RA_R146',grp:'제한구역(R)',name:'R146 Wando KCG',alt:'300 ft AMSL/SFC',circle:{c:[34.06972,126.86472],r:5}},
  {id:'RA_R147',grp:'제한구역(R)',name:'R147 Seogwipo KCG',alt:'300 ft AMSL/SFC',circle:{c:[32.66667,126.33333],r:6}},
  {id:'RA_R148A',grp:'제한구역(R)',name:'R148A Mokpo KCG A',alt:'300 ft AMSL/SFC',circle:{c:[34.75944,126.22333],r:2.5}},
  {id:'RA_R148B',grp:'제한구역(R)',name:'R148B Mokpo KCG B',alt:'300 ft AMSL/SFC',circle:{c:[34.41972,125.91472],r:4}},
  {id:'RA_R149',grp:'제한구역(R)',name:'R149 Jeju KCG',alt:'300 ft AMSL/SFC',circle:{c:[33.74583,126.21667],r:5}},
  {id:'RA_R152',grp:'제한구역(R)',name:'R152 Goesan',alt:'2 100 ft AMSL/SFC',circle:{c:[36.87361,127.80528],r:2}},
  {id:'RA_R155A',grp:'제한구역(R)',name:'R155A Seongju',alt:'9 500 ft AMSL/SFC',circle:{c:[36.04528,128.22583],r:1.5}},
  {id:'RA_R155B',grp:'제한구역(R)',name:'R155B Seongju (반원 근사)',alt:'FL196/SFC',circle:{c:[36.04528,128.22583],r:3}},
  {id:'RA_R157',grp:'제한구역(R)',name:'R157 Jangsan',alt:'6 000 ft AMSL/SFC',circle:{c:[35.20056,129.15083],r:0.7}},
  {id:'RA_R158',grp:'제한구역(R)',name:'R158 Jonjae',alt:'6 400 ft AMSL/SFC',circle:{c:[34.85444,127.22972],r:0.7}},
  // ── ENR 5.1 위험구역(Danger) — 원전(고리·월성·한빛·한울) 포함 ──
  {id:'DA_D1',grp:'위험구역(D)',name:'D1 Gori (고리원전)',alt:'10 000 ft AGL/GND',circle:{c:[35.31667,129.3],r:2}},
  {id:'DA_D2',grp:'위험구역(D)',name:'D2 Wolseong (월성원전)',alt:'10 000 ft AGL/GND',circle:{c:[35.7,129.46667],r:2}},
  {id:'DA_D5',grp:'위험구역(D)',name:'D5 Wanju',alt:'3 000 ft AGL/GND',circle:{c:[35.71389,127.2125],r:1}},
  {id:'DA_D6',grp:'위험구역(D)',name:'D6 Yeongdong',alt:'3 000 ft AGL/GND',circle:{c:[36.15222,127.73139],r:1.7}},
  {id:'DA_D7',grp:'위험구역(D)',name:'D7 Hanbit (한빛원전)',alt:'10 000 ft AGL/GND',circle:{c:[35.40806,126.40806],r:2}},
  {id:'DA_D8',grp:'위험구역(D)',name:'D8 Hanul (한울원전)',alt:'8 000 ft AGL/GND',circle:{c:[37.1,129.38333],r:2}},
  {id:'DA_D9',grp:'위험구역(D)',name:'D9 Yeongcheon',alt:'3 000 ft AGL/GND',circle:{c:[35.96083,128.97667],r:1}},
  {id:'DA_D13',grp:'위험구역(D)',name:'D13 Seonghwan',alt:'3 000 ft AGL/GND',circle:{c:[36.92639,127.16194],r:1.1}},
  {id:'DA_D14',grp:'위험구역(D)',name:'D14 Jaecheon',alt:'3 000 ft AGL/GND',circle:{c:[37.10139,128.24694],r:1.8}},
  {id:'DA_D15',grp:'위험구역(D)',name:'D15 Jeonui',alt:'3 000 ft AGL/GND',circle:{c:[36.65861,127.165],r:1.4}},
  {id:'DA_D16',grp:'위험구역(D)',name:'D16 Jangdong',alt:'2 000 ft AGL/GND',circle:{c:[36.42111,127.44389],r:1}},
  {id:'DA_D17',grp:'위험구역(D)',name:'D17 Imsil',alt:'3 000 ft AGL/GND',circle:{c:[35.66306,127.25417],r:2}},
  {id:'DA_D18',grp:'위험구역(D)',name:'D18 Haksan',alt:'3 000 ft AGL/GND',circle:{c:[36.07083,127.70722],r:1}},
  {id:'DA_D19',grp:'위험구역(D)',name:'D19 Judeok',alt:'1 000 ft AGL/GND',circle:{c:[36.97444,127.74611],r:1.3}},
  {id:'DA_D20',grp:'위험구역(D)',name:'D20 Guui',alt:'1 600 ft AGL/GND',circle:{c:[37.53556,127.09639],r:0.2}},
  {id:'DA_D21',grp:'위험구역(D)',name:'D21 Jayang',alt:'1 700 ft AGL/GND',circle:{c:[37.5375,127.07278],r:0.3}},
  {id:'DA_D25',grp:'위험구역(D)',name:'D25 Seocho',alt:'1 500 ft AGL/GND',circle:{c:[37.48333,127.01667],r:0.3}},
  {id:'DA_D26',grp:'위험구역(D)',name:'D26 Sindaebang',alt:'1 600 ft AGL/GND',circle:{c:[37.49111,126.92444],r:0.3}},
  {id:'DA_D28',grp:'위험구역(D)',name:'D28 Sindorim',alt:'1 700 ft AGL/GND',circle:{c:[37.50806,126.89083],r:0.3}},
  {id:'DA_D30',grp:'위험구역(D)',name:'D30 Mokdong',alt:'1 900 ft AGL/GND',circle:{c:[37.52722,126.87444],r:0.4}},
  {id:'DA_D31',grp:'위험구역(D)',name:'D31 Gupo',alt:'1 600 ft AGL/GND',circle:{c:[35.20833,128.99944],r:0.3}},
  {id:'DA_D33',grp:'위험구역(D)',name:'D33 Yeonje',alt:'1 500 ft AGL/GND',circle:{c:[35.17472,129.08361],r:0.3}},
  {id:'DA_D34',grp:'위험구역(D)',name:'D34 Suyeong',alt:'1 600 ft AGL/GND',circle:{c:[35.14028,129.10667],r:0.3}},
  {id:'DA_D22',grp:'위험구역(D)',name:'D22 Samseong',alt:'1 800 ft AGL/GND',poly:[[37.5225, 127.05917], [37.51861, 127.065], [37.51222, 127.06639], [37.50111, 127.055], [37.50556, 127.04944], [37.51444, 127.05806], [37.51778, 127.05389]]},
  {id:'DA_D23',grp:'위험구역(D)',name:'D23 Dogok',alt:'1 900 ft AGL/GND',poly:[[37.49, 127.05472], [37.48833, 127.05583], [37.48583, 127.05167], [37.48806, 127.05028]]},
  {id:'DA_D24',grp:'위험구역(D)',name:'D24 Yeoksam',alt:'1 700 ft AGL/GND',poly:[[37.50528, 127.0375], [37.50056, 127.04333], [37.49361, 127.02611], [37.49833, 127.02417]]},
  {id:'DA_D27',grp:'위험구역(D)',name:'D27 Yeoui',alt:'1 900 ft AGL/GND',poly:[[37.52861, 126.92972], [37.51972, 126.94139], [37.5175, 126.93972], [37.51889, 126.92083], [37.52167, 126.91722]]},
  {id:'DA_D29',grp:'위험구역(D)',name:'D29 Mullae',alt:'1 600 ft AGL/GND',poly:[[37.52167, 126.90083], [37.51722, 126.90611], [37.515, 126.90306], [37.51944, 126.8975]]},
  {id:'DA_D32',grp:'위험구역(D)',name:'D32 Dongnae',alt:'1 600 ft AGL/GND',poly:[[35.2275, 129.08306], [35.22361, 129.0925], [35.21, 129.085], [35.21444, 129.07417]]},
  {id:'DA_D35',grp:'위험구역(D)',name:'D35 Seomyeon',alt:'2 000 ft AGL/GND',poly:[[35.15722, 129.04833], [35.16389, 129.05806], [35.14694, 129.07389], [35.14028, 129.06417]]},
  {id:'DA_D36',grp:'위험구역(D)',name:'D36 Haeundae',alt:'2 000 ft AGL/GND',poly:[[35.17861, 129.11056], [35.18667, 129.12083], [35.15889, 129.16194], [35.14694, 129.145]]},
  {id:'DA_D37',grp:'위험구역(D)',name:'D37 Moonten',alt:'1 600 ft AGL/GND',poly:[[35.17083, 129.18278], [35.16, 129.17056], [35.15361, 129.17917], [35.16444, 129.19111]]},
  {id:'FIR_Incheon',grp:'FIR',name:'Incheon FIR',alt:'GND ~ UNL',poly:[[38.0,124.0],[38.0,124.85],[38.6333,128.3667],[38.6333,133.65],[38.0,133.0],[37.5,133.0],[34.6667,129.1667],[32.5,127.5],[32.5,126.8333],[30.0,125.4167],[30.0,124.0]]},
  {id:'KADIZ',grp:'KADIZ',name:'Korea ADIZ (KADIZ)',alt:'SFC ~ UNL',poly:[[39.0,123.5],[39.0,133.0],[37.2833,133.0],[36.0,130.5],[35.2167,129.8],[34.7167,129.15],[34.2833,128.8667],[32.5,127.5],[32.5,126.8333],[30.0,125.4167],[30.0,124.0],[37.0,124.0],[39.0,123.5]]},
  {id:'JJB_1',grp:'제주 Class B',name:'1구역 (5NM)',alt:'SFC ~ 10,000ft',circle:{c:[33.51222,126.49278],r:5}},
  {id:'JJB_2',grp:'제주 Class B',name:'2구역 (5–10NM)',alt:'1,000 ~ 10,000ft',poly:[[33.4432,126.43733],[33.45408,126.42162],[33.4674,126.4089],[33.48261,126.39969],[33.49906,126.3944],[33.51607,126.39324],[33.53291,126.39626],[33.54889,126.40335],[33.56333,126.41419],[33.57562,126.42835],[33.58524,126.44523],[33.59179,126.4641],[33.59499,126.48419],[33.59471,126.50464],[33.59096,126.52459],[33.5839,126.54319],[33.57382,126.55968],[33.56115,126.57334],[33.54642,126.58361],[33.53025,126.59006],[33.51333,126.59242],[33.51417,126.69194],[33.51417,126.69228],[33.54808,126.68764],[33.58049,126.67479],[33.61003,126.65426],[33.63544,126.6269],[33.65567,126.59388],[33.66985,126.55658],[33.67738,126.51658],[33.67795,126.47557],[33.67153,126.43529],[33.65838,126.39744],[33.63908,126.36363],[33.61443,126.33528],[33.58548,126.31358],[33.55345,126.29944],[33.51968,126.29346],[33.48561,126.29587],[33.45267,126.30655],[33.42223,126.32507],[33.39559,126.35062],[33.37385,126.38213]]},
  {id:'JJB_3',grp:'제주 Class B',name:'3구역 (10–20NM)',alt:'2,000 ~ 10,000ft',poly:[[33.37385,126.38213],[33.39559,126.35062],[33.42223,126.32507],[33.45267,126.30655],[33.48561,126.29587],[33.51968,126.29346],[33.55345,126.29944],[33.58548,126.31358],[33.61443,126.33528],[33.63908,126.36363],[33.65838,126.39744],[33.67153,126.43529],[33.67795,126.47557],[33.67738,126.51658],[33.66985,126.55658],[33.65567,126.59388],[33.63544,126.6269],[33.61003,126.65426],[33.58049,126.67479],[33.54808,126.68764],[33.51417,126.69228],[33.51583,126.89111],[33.51584,126.89182],[33.58369,126.88269],[33.64855,126.85709],[33.70769,126.81608],[33.75859,126.76137],[33.79911,126.69524],[33.8275,126.62051],[33.84258,126.54034],[33.84369,126.45815],[33.83079,126.37743],[33.80443,126.30162],[33.76573,126.23394],[33.71633,126.17726],[33.65834,126.13396],[33.5942,126.10584],[33.52663,126.09406],[33.45848,126.09908],[33.39262,126.12065],[33.33181,126.15782],[33.2786,126.20902],[33.23522,126.27206]]},
  {id:'ATZ_Gapyeong',grp:'ATZ',name:'Gapyeong ATZ',alt:'SFC~1,500ft',circle:{c:[37.81167,127.35667],r:3.0}},
  {id:'ATZ_Yangpyeong',grp:'ATZ',name:'Yangpyeong ATZ',alt:'SFC~1,500ft',circle:{c:[37.49972,127.63],r:2.0}},
  {id:'ATZ_Hongcheon',grp:'ATZ',name:'Hongcheon ATZ',alt:'SFC~1,500ft',circle:{c:[37.70333,127.90583],r:2.0}},
  {id:'ATZ_Hyeonri',grp:'ATZ',name:'Hyeonri ATZ',alt:'SFC~1,500ft',circle:{c:[37.95639,128.31639],r:3.0}},
  {id:'ATZ_Yongin',grp:'ATZ',name:'Yongin ATZ',alt:'SFC~1,500ft',circle:{c:[37.28694,127.22556],r:3.0}},
  {id:'ATZ_Jeonju',grp:'ATZ',name:'Jeonju ATZ',alt:'SFC~1,500ft',circle:{c:[35.88139,127.01583],r:3.0}},
  {id:'ATZ_Youngcheon',grp:'ATZ',name:'Youngcheon ATZ',alt:'SFC~1,500ft',circle:{c:[36.02556,128.81889],r:3.0}},
  {id:'ATZ_Geumwang',grp:'ATZ',name:'Geumwang ATZ',alt:'SFC~1,500ft',circle:{c:[37.00222,127.5625],r:3.0}},
  {id:'ATZ_Chuncheon',grp:'ATZ',name:'Chuncheon ATZ',alt:'SFC~1,500ft',circle:{c:[37.92917,127.75722],r:3.0}},
  {id:'ATZ_Deokso',grp:'ATZ',name:'Deokso ATZ',alt:'SFC~1,500ft',circle:{c:[37.60694,127.21889],r:2.0}},
  {id:'ATZ_Jochiwon',grp:'ATZ',name:'Jochiwon ATZ',alt:'SFC~1,500ft',circle:{c:[36.57417,127.29556],r:3.0}},
  {id:'ATZ_Poseung',grp:'ATZ',name:'Poseung ATZ',alt:'SFC~1,500ft',circle:{c:[36.99139,126.8075],r:3.0}},
  {id:'NP_CEM',grp:'소음방지구역',name:'서울현충원',alt:'SFC~3,000ft',poly:[[37.50278,126.96583],[37.50278,126.98611],[37.49306,126.97444],[37.49306,126.95778]]},
  {id:'NP_ARB',grp:'소음방지구역',name:'국립수목원',alt:'SFC~5,000ft',circle:{c:[37.7525,127.16444],r:1.5}},
  {id:'CZ_인천_5',grp:'관제권',name:'인천 (RKSI) 5NM',alt:'SFC~3,000ft AGL · B',circle:{c:[37.4625,126.43917],r:5}},
  {id:'CZ_인천_10',grp:'관제권',name:'인천 (RKSI) 10NM',circle:{c:[37.4625,126.43917],r:10}},
  {id:'CZ_인천_20',grp:'관제권',name:'인천 (RKSI) 20NM',circle:{c:[37.4625,126.43917],r:20}},
  {id:'CZ_김포_5',grp:'관제권',name:'김포 (RKSS) 5NM',circle:{c:[37.55694,126.7975],r:5}},
  {id:'CZ_김포_10',grp:'관제권',name:'김포 (RKSS) 10NM',circle:{c:[37.55694,126.7975],r:10}},
  {id:'CZ_김포_20',grp:'관제권',name:'김포 (RKSS) 20NM',circle:{c:[37.55694,126.7975],r:20}},
  {id:'CZ_서울_5',grp:'관제권',name:'서울 (RKSM) 5NM',alt:'SFC~4,000ft AGL · D',circle:{c:[37.44583,127.11417],r:5}},
  {id:'CZ_이천_5',grp:'관제권',name:'이천 5NM',circle:{c:[37.20111,127.47194],r:5}},
  {id:'CZ_평택_5',grp:'관제권',name:'평택 5NM',circle:{c:[36.96,127.03333],r:5}},
  {id:'CZ_오산_5',grp:'관제권',name:'오산 (RKSO) 5NM',circle:{c:[37.09056,127.02972],r:5}},
  {id:'CZ_수원_5',grp:'관제권',name:'수원 (RKSW) 5NM',circle:{c:[37.23944,127.00694],r:5}},
  {id:'CZ_군산_5',grp:'관제권',name:'군산 (RKJK) 5NM',alt:'SFC~5,000ft AGL · C',circle:{c:[35.90389,126.61583],r:5}},
  {id:'CZ_원주_5',grp:'관제권',name:'원주 (RKNW) 5NM',alt:'SFC~5,000ft AGL · C',circle:{c:[37.43806,127.96028],r:5}},
  {id:'CZ_여수_5',grp:'관제권',name:'여수 (RKJY) 5NM',alt:'SFC~3,000ft AGL · D',circle:{c:[34.84222,127.61722],r:5}},
  {id:'CZ_여수_N',grp:'관제권',name:'여수 북측 확장',alt:'1,000~3,000ft AGL',poly:[[34.90056,127.545],[34.93806,127.52667],[34.96306,127.60167],[34.92583,127.62]]},
  {id:'CZ_여수_S',grp:'관제권',name:'여수 남측 확장',alt:'1,000~3,000ft AGL',poly:[[34.75889,127.61444],[34.72139,127.63278],[34.74639,127.70778],[34.78389,127.68944]]},
  {id:'CZ_무안_5',grp:'관제권',name:'무안 (RKJB) 5NM',alt:'SFC~3,000ft AGL · D',circle:{c:[34.99139,126.38278],r:5}},
  {id:'CZ_무안_N',grp:'관제권',name:'무안 북측 확장',alt:'SFC~3,000ft AGL · D',poly:[[35.06917,126.34583],[35.10028,126.34556],[35.10056,126.41861],[35.06944,126.41889]]},
  {id:'CZ_무안_S',grp:'관제권',name:'무안 남측 확장',alt:'SFC~3,000ft AGL · D',poly:[[34.91361,126.41972],[34.88194,126.42],[34.88167,126.34722],[34.91333,126.34694]]},
  {id:'CZ_광주_5',grp:'관제권',name:'광주 (RKJJ) 5NM',alt:'SFC~4,000ft AGL · C',circle:{c:[35.12639,126.80889],r:5}},
  {id:'CZ_울산_5',grp:'관제권',name:'울산 (RKPU) 5NM',alt:'SFC~3,000ft AGL · D',circle:{c:[35.59333,129.35222],r:5}},
  {id:'CZ_양양_5',grp:'관제권',name:'양양 (RKNY) 5NM',alt:'SFC~3,000ft AGL · D',circle:{c:[38.06139,128.66917],r:5}},
  {id:'CZ_제주_5',grp:'관제권',name:'제주 (RKPC) 5NM',alt:'SFC~3,000ft AGL · B',circle:{c:[33.51222,126.49278],r:5}},
  {id:'CZ_정석_5',grp:'관제권',name:'정석 (RKPD) 5NM',alt:'SFC~3,000ft AGL · D',circle:{c:[33.39833,126.71306],r:5}},
  {id:'CZ_김해_5',grp:'관제권',name:'김해 (RKPK) 5NM',alt:'SFC~3,000ft AGL · C',circle:{c:[35.18056,128.93806],r:5}},
  {id:'CZ_사천_5',grp:'관제권',name:'사천 (RKPS) 5NM',alt:'SFC~4,000ft AGL · C',circle:{c:[35.08861,128.07056],r:5}},
  {id:'CZ_청주_5',grp:'관제권',name:'청주 (RKTU) 5NM',alt:'SFC~5,000ft AGL · C',circle:{c:[36.71639,127.49917],r:5}},
  {id:'CZ_속초_3',grp:'관제권',name:'속초 3NM',circle:{c:[38.1427,128.5986],r:3}},
  {id:'CZ_포항_5',grp:'관제권',name:'포항경주 (RKTH) 5NM',alt:'SFC~3,000ft AGL · C',circle:{c:[35.98778,129.41861],r:5}},
  {id:'CZ_대구_5',grp:'관제권',name:'대구 (RKTN) 5NM',alt:'SFC~4,000ft AGL · C',circle:{c:[35.89417,128.65889],r:5}},
  {id:'CZ_울진_5',grp:'관제권',name:'울진 (RKTL) 5NM',alt:'SFC~2,500ft AGL · D',circle:{c:[36.77694,129.46167],r:5}},
  {id:'CZ_울진_N',grp:'관제권',name:'울진 북측 확장',alt:'1,000~2,500ft AGL · D',poly:[[36.84006,129.39382],[36.8443,129.40051],[36.84808,129.4076],[36.85139,129.41506],[36.85419,129.42283],[36.85648,129.43086],[36.85823,129.43911],[36.85944,129.4475],[36.86009,129.45599],[36.86019,129.46451],[36.85972,129.47302],[36.89833,129.45833],[36.87861,129.37889]]},
  {id:'CZ_울진_S',grp:'관제권',name:'울진 남측 확장',alt:'1,000~2,500ft AGL · D',poly:[[36.71395,129.52965],[36.7097,129.52298],[36.7059,129.5159],[36.70258,129.50845],[36.69976,129.50069],[36.69745,129.49267],[36.69569,129.48444],[36.69446,129.47606],[36.6938,129.46758],[36.69369,129.45906],[36.69414,129.45056],[36.65556,129.46528],[36.67528,129.54444]]},
  // APP 운용 공항 20NM — VFR도 통과 시 해당 APP 교신 권장 범위
  // 서산 반경권 — 한서대 태안비행장 비행절차 제3장 제4절: 해미 APPROACH 허가 없이는
  // 서산비행장(RKTP)으로부터 10NM 안에서 비행 금지(단서 조항 있음). 상황 파악용 거리권.
  // 중심은 지도상 RKTP 마커 위치. RKTP ARP 는 AIP AD 2 로 미검증이며, 같은 문서의
  // 서산 TACAN(SAN, N36°42'36.0" E126°28'56.4")과는 약 0.4NM 떨어져 있다.
  {id:'SS_R05',grp:'서산 반경권',name:'서산 5NM',alt:'RKTP 기준',circle:{c:[36.7039,126.4861],r:5}},
  {id:'SS_R10',grp:'서산 반경권',name:'서산 10NM',alt:'해미APP 허가 없이 진입 금지',circle:{c:[36.7039,126.4861],r:10}},
  {id:'SS_R15',grp:'서산 반경권',name:'서산 15NM',alt:'RKTP 기준',circle:{c:[36.7039,126.4861],r:15}},
  {id:'SS_R18',grp:'서산 반경권',name:'서산 18NM',alt:'RKTP 기준',circle:{c:[36.7039,126.4861],r:18}},
  {id:'AP20_오산',grp:'APP 교신권 20NM',name:'오산 APP (RKSO)',alt:'VFR 통과 시 교신',circle:{c:[37.09056,127.02972],r:20}},
  {id:'AP20_중원',grp:'APP 교신권 20NM',name:'중원 APP (RKTI)',alt:'VFR 통과 시 교신',circle:{c:[37.0295,127.8862],r:20}},
  {id:'AP20_청주',grp:'APP 교신권 20NM',name:'청주 APP (RKTU)',alt:'VFR 통과 시 교신',circle:{c:[36.71639,127.49917],r:20}},
  {id:'AP20_강릉',grp:'APP 교신권 20NM',name:'강릉 APP (RKNN)',alt:'VFR 통과 시 교신',circle:{c:[37.7537,128.9437],r:20}},
  {id:'AP20_원주',grp:'APP 교신권 20NM',name:'원주 APP (RKNW)',alt:'VFR 통과 시 교신',circle:{c:[37.43806,127.96028],r:20}},
  {id:'AP20_예천',grp:'APP 교신권 20NM',name:'예천 APP (RKTY)',alt:'VFR 통과 시 교신',circle:{c:[36.6319,128.3519],r:20}},
  {id:'AP20_대구',grp:'APP 교신권 20NM',name:'대구 APP (RKTN)',alt:'VFR 통과 시 교신',circle:{c:[35.89417,128.65889],r:20}},
  {id:'AP20_포항',grp:'APP 교신권 20NM',name:'포항 APP (RKTH)',alt:'VFR 통과 시 교신',circle:{c:[35.98778,129.41861],r:20}},
  {id:'AP20_김해',grp:'APP 교신권 20NM',name:'김해 APP (RKPK)',alt:'VFR 통과 시 교신',circle:{c:[35.18056,128.93806],r:20}},
  {id:'AP20_사천',grp:'APP 교신권 20NM',name:'사천 APP (RKPS)',alt:'VFR 통과 시 교신',circle:{c:[35.08861,128.07056],r:20}},
  {id:'AP20_군산',grp:'APP 교신권 20NM',name:'군산 APP (RKJK)',alt:'VFR 통과 시 교신',circle:{c:[35.90389,126.61583],r:20}},
  {id:'AP20_광주',grp:'APP 교신권 20NM',name:'광주 APP (RKJJ)',alt:'VFR 통과 시 교신',circle:{c:[35.12639,126.80889],r:20}},
  {id:'AP20_제주',grp:'APP 교신권 20NM',name:'제주 APP (RKPC)',alt:'VFR 통과 시 교신',circle:{c:[33.51222,126.49278],r:20}},
  // ── MOA·훈련공역 (AIP ENR 5.2) ──
  {id:'MOA_MOA_1',grp:'MOA',name:'MOA 1',alt:'FL 500 / 10 000 ft AMSL',poly:[[36.53333,125.6],[36.53333,125.7],[36.68333,126.16639],[36.68333,126.475],[36.33333,126.41667],[36.28333,126.41667],[36.28306,125.60056]]},
  {id:'MOA_MOA_2H',grp:'MOA',name:'MOA 2H',alt:'FL 400 / 10 000 ft AMSL',poly:[[36.58333,127.11667],[36.58333,127.36667],[36.49972,127.50194],[35.96667,127.36667],[35.98333,127.06667],[36.14333,127.08],[36.38389,127.10694],[36.44361,127.105]]},
  {id:'MOA_MOA_2L',grp:'MOA',name:'MOA 2L',alt:'9 000 ft AMSL / 3 000 ft AGL',poly:[[36.58333,127.11667],[36.58333,127.36667],[35.96667,127.36667],[35.98333,127.06667]]},
  {id:'MOA_MOA_3A',grp:'MOA',name:'MOA 3A',alt:'7 000 ft AMSL / 3 000 ft AGL',poly:[[36.56667,127.53333],[36.58333,127.71667],[36.38333,127.95],[36.3,127.85],[36.45,127.61667]]},
  {id:'MOA_MOA_3L',grp:'MOA',name:'MOA 3L',alt:'9 000 ft AMSL / 3 000 ft AGL',poly:[[36.26667,127.36667],[36.36667,127.71667],[35.93333,128.25],[35.96667,127.36667]]},
  {id:'MOA_MOA_3H',grp:'MOA',name:'MOA 3H',alt:'FL 400 / 10 000 ft AMSL',poly:[[36.49972,127.50194],[36.36667,127.71667],[35.93333,128.25],[35.96667,127.36667]]},
  {id:'MOA_MOA_4',grp:'MOA',name:'MOA 4',alt:'9 000 ft AMSL / 3 000 ft AGL',poly:[[36.75,127.66667],[36.85,127.76667],[36.58333,128.23333],[36.45,128.08333]]},
  {id:'MOA_MOA_5',grp:'MOA',name:'MOA 5',alt:'9 000 ft AMSL / FL 400 / 3 000 ft AGL / 12 000 ft AMSL',poly:[[37.45,127.96667],[37.53333,128.51667],[37.2,128.51667],[37.1,127.98333]]},
  {id:'MOA_MOA_6',grp:'MOA',name:'MOA 6',alt:'9 000 ft AMSL / FL 400 / 3 000 ft AGL / 10 000 ft AMSL',poly:[[37.53333,128.51667],[37.56667,128.71667],[37.38333,129.1],[37.21667,129.05],[37.21667,128.68333],[37.2,128.51667]]},
  {id:'MOA_MOA_7',grp:'MOA',name:'MOA 7',alt:'FL 400 / 10 000 ft AMSL',poly:[[38.26667,129.0],[38.25,129.85],[37.8,129.85],[37.81667,129.0]]},
  {id:'MOA_MOA_8',grp:'MOA',name:'MOA 8',alt:'8 000 ft AMSL / FL 400 / 3 000 ft AGL / 11 000 ft AMSL',poly:[[37.21667,129.05],[37.38333,129.1],[36.96667,130.0],[36.83333,130.0],[36.83333,129.25],[36.91667,129.05]]},
  {id:'MOA_MOA_9E',grp:'MOA',name:'MOA 9E',alt:'10 000 ft AMSL / FL 400 / 3 000 ft AGL / 11 000 ft AMSL',poly:[[36.83333,129.53333],[36.83333,130.0],[36.5,130.0],[36.5,129.58333]]},
  {id:'MOA_MOA_9W',grp:'MOA',name:'MOA 9W',alt:'7 000 ft AMSL / FL 400 / 3 000 ft AGL / 11 000 ft AMSL',poly:[[36.83333,129.25],[36.83333,129.53333],[36.5,129.58333],[36.5,129.25]]},
  {id:'MOA_MOA_10',grp:'MOA',name:'MOA 10',alt:'FL 400 / 10 000 ft AMSL',poly:[[36.91667,128.68333],[36.91667,129.05],[36.83333,129.25],[36.5,129.25],[36.35,129.1],[36.71667,128.5]]},
  {id:'MOA_MOA_11',grp:'MOA',name:'MOA 11',alt:'FL 400 / 12 000 ft AMSL',poly:[[37.1,127.98333],[37.2,128.51667],[37.21667,128.68333],[36.91667,128.68333],[36.71667,128.5],[36.93333,128.05]]},
  {id:'MOA_MOA_12W',grp:'MOA',name:'MOA 12W',alt:'7 000 ft AMSL / FL 400 / 3 000 ft AGL / 11 000 ft AMSL',poly:[[36.5,129.25],[36.5,129.58333],[36.08333,129.61667],[36.35,129.1]]},
  {id:'MOA_MOA_12E',grp:'MOA',name:'MOA 12E',alt:'10 000 ft AMSL / FL 400 / 3 000 ft AGL / 11 000 ft AMSL',poly:[[36.5,129.58333],[36.5,130.0],[36.03333,130.0],[36.08333,129.61667]]},
  {id:'MOA_MOA_13W',grp:'MOA',name:'MOA 13W',alt:'8 000 ft AMSL / FL 400 / 3 000 ft AGL / 11 000 ft AMSL',poly:[[35.73333,128.83333],[35.86667,129.5],[35.85,129.6],[35.26667,129.35],[35.23333,129.11667]]},
  {id:'MOA_MOA_13E',grp:'MOA',name:'MOA 13E',alt:'9 000 ft AMSL / FL 400 / 3 000 ft AGL / 10 000 ft AMSL',poly:[[35.85,129.6],[35.76667,130.21667],[35.33333,129.83333],[35.26667,129.35]]},
  {id:'MOA_MOA_14',grp:'MOA',name:'MOA 14',alt:'FL 330 / 10 000 ft AMSL',poly:[[36.43333,128.48333],[36.03333,129.2],[36.0,129.05],[36.0,128.53333],[36.2,128.28333]]},
  {id:'MOA_MOA_15A',grp:'MOA',name:'MOA 15A',alt:'9 000 ft AMSL / 3 000 ft AGL',poly:[[35.76667,127.03333],[35.73333,128.1],[35.31667,126.98333]]},
  {id:'MOA_MOA_15',grp:'MOA',name:'MOA 15',alt:'FL 400 / 11 000 ft AMSL',poly:[[35.98333,127.06667],[35.96667,127.54444],[35.23333,127.4],[35.31583,126.98806]]},
  {id:'MOA_MOA_16',grp:'MOA',name:'MOA 16',alt:'FL 500 / 5 000 ft AMSL',poly:[[36.08194,124.52556],[36.08361,125.60111],[35.66667,125.60194],[35.66583,124.52722]]},
  {id:'MOA_MOA_17',grp:'MOA',name:'MOA 17',alt:'FL 500 / 5 000 ft AMSL',poly:[[36.28306,125.60056],[36.28333,126.41667],[35.66667,126.41667],[35.66667,125.60194]]},
  {id:'MOA_MOA_18',grp:'MOA',name:'MOA 18',alt:'FL 500 / 5 000 ft AMSL',poly:[[35.66583,124.52722],[35.66667,125.60194],[35.25028,125.60278],[35.24917,124.52889]]},
  {id:'MOA_MOA_19L',grp:'MOA',name:'MOA 19L',alt:'8 000 ft AMSL / 3 000 ft AGL',poly:[[35.66667,125.60194],[35.66667,126.66667],[35.25,126.66667],[35.25028,125.60278]]},
  {id:'MOA_MOA_19H',grp:'MOA',name:'MOA 19H',alt:'FL 500 / 10 000 ft AMSL',poly:[[35.66667,125.60194],[35.66667,126.65694],[35.25028,126.61306],[35.25028,125.60278]]},
  {id:'MOA_MOA_20',grp:'MOA',name:'MOA 20',alt:'FL 500 / 10 000 ft AMSL',poly:[[35.25028,125.60278],[35.25028,126.61306],[34.83361,126.56917],[34.83333,125.60333]]},
  {id:'MOA_MOA_21',grp:'MOA',name:'MOA 21',alt:'FL 500 / 10 000 ft AMSL',poly:[[34.83333,125.60333],[34.83361,126.56917],[34.41667,126.52611],[34.41694,125.60361]]},
  {id:'MOA_MOA_22',grp:'MOA',name:'MOA 22',alt:'FL 500 / 5 000 ft AMSL',poly:[[34.8325,124.53056],[34.83333,125.60333],[34.41694,125.60361],[34.41583,124.53194]]},
  {id:'MOA_MOA_23',grp:'MOA',name:'MOA 23',alt:'FL 500 / 5 000 ft AMSL',poly:[[34.41583,124.53194],[34.41694,125.60361],[34.0,125.60389],[34.00028,124.88389],[34.0,124.72361],[34.045,124.53306]]},
  {id:'MOA_MOA_24',grp:'MOA',name:'MOA 24',alt:'FL 500 / 10 000 ft AMSL',poly:[[34.41694,125.60361],[34.41667,126.52611],[34.0,126.48306],[34.0,125.60389]]},
  {id:'MOA_MOA_25L',grp:'MOA',name:'MOA 25L',alt:'9 000 ft AMSL / 3 000 ft AGL / FL 400 / 10 000 ft AMSL',poly:[[34.75,126.93333],[34.75,127.28333],[34.25,127.28333],[34.25,126.88333]]},
  {id:'MOA_MOA_25H',grp:'MOA',name:'MOA 25H',alt:'FL 400 / FL 170',poly:[[35.0,126.95333],[35.0,127.30389],[34.14639,127.30361],[34.14639,126.86083]]},
  {id:'MOA_MOA_25H_②',grp:'MOA',name:'MOA 25H ②',alt:'FL 400 / FL 170',poly:[[34.14639,126.86083],[34.14639,127.30361],[34.0,127.08333],[34.0,126.84528]]},
  {id:'MOA_MOA_26L',grp:'MOA',name:'MOA 26L',alt:'9 000 ft AMSL / 3 000 ft AGL',poly:[[35.0,127.28333],[35.0,128.375],[34.825,128.35833],[34.13333,127.28333]]},
  {id:'MOA_MOA_26H',grp:'MOA',name:'MOA 26H',alt:'FL 400 / 10 000 ft AMSL',poly:[[35.0,127.30389],[35.0,128.375],[34.825,128.35833],[34.14639,127.30361]]},
  {id:'MOA_MOA_27N',grp:'MOA',name:'MOA 27N',alt:'FL 400 / 11 000 ft AMSL',poly:[[35.96667,127.54444],[35.93333,128.25],[35.66111,128.40278],[35.63611,127.48056]]},
  {id:'MOA_MOA_27S',grp:'MOA',name:'MOA 27S',alt:'FL 400 / 11 000 ft AMSL',poly:[[35.63611,127.48056],[35.66111,128.40278],[35.62917,128.43056],[35.25417,128.39722],[35.23333,127.4]]},
  {id:'MOA_MOA_27A',grp:'MOA',name:'MOA 27A',alt:'9 000 ft AMSL / 3 000 ft AGL',poly:[[35.23333,127.4],[35.62917,128.43056],[35.25417,128.39722]]},
  {id:'MOA_MOA_28',grp:'MOA',name:'MOA 28',alt:'FL 400 / 200 ft AGL',poly:[[34.16139,128.0],[34.30028,128.19083],[34.68444,128.72417],[34.33667,128.58722],[34.17139,128.70694],[33.70528,128.34472],[33.66667,128.0]]},
  {id:'MOA_MOA_29',grp:'MOA',name:'MOA 29',alt:'FL 400 / 3 000 ft AGL',poly:[[33.68722,127.35611],[34.16139,128.0],[33.66667,128.0],[33.605,127.46556]]},
  {id:'MOA_MOA_30L',grp:'MOA',name:'MOA 30L',alt:'9 000 ft AMSL / 2 000 ft AGL',poly:[[37.98333,127.78333],[38.03333,128.2],[37.75,128.2],[37.68333,127.78333]]},
  {id:'MOA_MOA_30H',grp:'MOA',name:'MOA 30H',alt:'FL 400 / 10 000 ft AMSL',poly:[[37.98333,127.78333],[38.03333,128.2],[37.75,128.2],[37.68333,127.78333]]},
  {id:'MOA_MOA_31L',grp:'MOA',name:'MOA 31L',alt:'9 000 ft AMSL / 2 000 ft AGL',poly:[[38.03333,128.2],[38.06667,128.6],[37.8,128.6],[37.75,128.2]]},
  {id:'MOA_MOA_31H',grp:'MOA',name:'MOA 31H',alt:'FL 400 / 10 000 ft AMSL',poly:[[38.03333,128.2],[38.06667,128.6],[37.8,128.6],[37.75,128.2]]},
  {id:'MOA_MOA_32',grp:'MOA',name:'MOA 32',alt:'FL 400 / 10 000 ft AMSL',poly:[[37.55,129.63333],[37.51667,131.0],[36.7,131.0],[37.43333,129.55]]},
  {id:'MOA_MOA_33',grp:'MOA',name:'MOA 33',alt:'FL 400 / 10 000 ft AMSL',poly:[[37.51667,131.0],[37.5,132.0],[37.28333,132.58333],[36.58333,131.21667],[36.7,131.0]]},
  {id:'MOA_MOA_34',grp:'MOA',name:'MOA 34',alt:'4 000 ft AMSL / 500 ft AMSL',poly:[[34.58333,125.41667],[34.58333,125.83333],[34.83333,125.83333],[34.83333,125.41667]]},
  {id:'MOA_MOA_35',grp:'MOA',name:'MOA 35',alt:'4 000 ft AMSL / 500 ft AMSL',poly:[[34.33333,125.41667],[34.33333,125.83333],[34.58333,125.83333],[34.58333,125.41667]]},
  {id:'MOA_MOA_36',grp:'MOA',name:'MOA 36',alt:'4 000 ft AMSL / 500 ft AMSL',poly:[[34.33333,125.0],[34.33333,125.41667],[34.83333,125.41667],[34.83333,125.0]]},
  {id:'MOA_MOA_37',grp:'MOA',name:'MOA 37',alt:'8 000 ft AMSL / SFC',poly:[[37.41667,129.5],[37.41667,131.0],[36.5,131.0],[36.25,130.58333],[36.75,130.58333],[37.25,129.5]]},
  {id:'MOA_MOA_38',grp:'MOA',name:'MOA 38',alt:'8 000 ft AMSL / SFC',poly:[[37.5,131.0],[37.5,132.0],[37.0,132.0],[36.5,131.0]]},
  {id:'MOA_MOA_39',grp:'MOA',name:'MOA 39',alt:'5 000 ft AMSL / SFC',poly:[[33.45,126.86667],[33.75,127.25],[33.55,127.53333],[33.18333,127.06667]]},
  {id:'MOA_MOA_40',grp:'MOA',name:'MOA 40',alt:'5 000 ft AMSL / SFC',poly:[[34.33333,124.5],[34.33333,126.0],[33.75,126.0],[33.75,124.5]]},
  {id:'MOA_MOA_41',grp:'MOA',name:'MOA 41',alt:'5 000 ft AMSL / SFC',poly:[[33.75,124.5],[33.75,126.0],[33.16667,126.0],[33.16667,124.5]]},
  {id:'MOA_ACMI_A',grp:'훈련·급유공역',name:'ACMI A',alt:'5 000 ft AMSL / SFC',poly:[[37.03694,125.7],[37.04222,126.16667],[36.68333,126.16667],[36.68333,125.7]]},
  {id:'MOA_ACMI_B',grp:'훈련·급유공역',name:'ACMI B',alt:'9 000 ft AMSL / 6 000 ft AMSL',poly:[[37.03694,125.7],[37.04222,126.16667],[36.68333,126.16667],[36.68333,125.7]]},
  {id:'MOA_ACMI_C',grp:'훈련·급유공역',name:'ACMI C',alt:'FL 600 / 10 000 ft AMSL',poly:[[37.03556,125.6],[37.04417,126.39833],[37.00278,126.425],[36.8,126.48333],[36.73333,126.48333],[36.68333,126.475],[36.68333,126.16667],[36.53333,125.7],[36.53333,125.6]]},
  {id:'MOA_ACMI_D',grp:'훈련·급유공역',name:'ACMI D',alt:'FL 600 / SFC',poly:[[37.03556,125.6],[37.03694,125.7],[36.53333,125.7],[36.53333,125.6]]},
  {id:'MOA_ACMI_E',grp:'훈련·급유공역',name:'ACMI E',alt:'FL 600 / 10 000 ft AMSL',poly:[[36.68333,125.7],[36.68333,126.16667],[36.53333,125.7]]},
  {id:'MOA_DOKDO',grp:'훈련·급유공역',name:'DOKDO',alt:'2 000 ft AGL / 500 ft AGL',poly:[[35.99996,130.26961],[36.66662,130.27049],[36.66662,130.06285],[35.99996,130.06373]]},
  {id:'MOA_MALLIPO',grp:'훈련·급유공역',name:'MALLIPO',alt:'FL 250 / FL 140',poly:[[36.33333,125.16667],[36.33333,125.56667],[35.93333,125.56667],[35.93333,125.16667]]},
  {id:'MOA_WIDO',grp:'훈련·급유공역',name:'WIDO',alt:'FL 250 / FL 140',poly:[[35.15,125.11667],[35.06667,125.51667],[34.5,125.51667],[34.6,125.11667]]},
  {id:'MOA_ULLEUNGDO',grp:'훈련·급유공역',name:'ULLEUNGDO',alt:'FL 250 / FL 140',poly:[[36.75,130.06667],[36.65,130.4],[36.08333,130.4],[36.18333,130.06667]]},
  {id:'MOA_JINDO',grp:'훈련·급유공역',name:'JINDO',alt:'FL 250 / 11 000 ft AMSL',poly:[[34.93917,125.59583],[34.94,126.01472],[34.25306,126.01528],[34.25444,125.59667]]},
  {id:'MOA_GANGGU',grp:'훈련·급유공역',name:'GANGGU',alt:'FL 250 / 12 000 ft AMSL',poly:[[36.82972,129.58472],[36.83333,130.0],[36.26278,130.0],[36.26556,129.63722]]},
  {id:'MOA_HTA_1',grp:'훈련·급유공역',name:'HTA 1',alt:'1 000 ft AMSL / SFC',poly:[[37.18333,126.61667],[37.18333,126.76667],[37.05,126.76667],[37.05,126.61667]]},
  {id:'MOA_HTA_2',grp:'훈련·급유공역',name:'HTA 2',alt:'1 500 ft AMSL / SFC',poly:[[37.18333,126.41667],[37.18333,126.61667],[37.05,126.61667],[37.05,126.41667]]},
];

// ── 공역(Airspace) 오버레이 — 항목별 시현/미시현 ──
const _aspcColors={};
(function(){ const pal=['#26a69a','#ef5350','#42a5f5','#ffa726','#ab47bc','#66bb6a','#ec407a','#8d6e63','#78909c','#d4e157','#5c6bc0','#ff7043','#29b6f6','#9ccc65','#f06292','#ffca28','#26c6da','#7e57c2','#c0ca33','#8bc34a','#e57373'];
  let i=0; AIRSPACE_DB.forEach(a=>{ if(!(a.grp in _aspcColors)) _aspcColors[a.grp]=pal[i++%pal.length]; });})();
const _aspcLayers={};   // id -> [layers]
let aspcOn={};
try { aspcOn=JSON.parse(localStorage.getItem('aspcOn')||'{}'); } catch(e){ aspcOn={}; }

function _aspcDraw(item){
  _aspcClear(item.id);
  const color=_aspcColors[item.grp];
  const tip=`${item.grp} · ${item.name}`+(item.alt?`<br>${item.alt}`:'');
  const ls=[];
  // 모든 공역은 테두리만 그린다 — 내부를 채우면 그 위의 심볼(FIX·VOR·공항)을 터치할 수 없다.
  // 테두리 선 자체는 터치 가능하게 두어 공역 정보 툴팁을 유지한다.
  // 단 FIR·KADIZ는 경계선이 워낙 길어 다른 요소와 겹치므로 선까지 클릭 통과시킨다.
  const lineOnly = (item.grp === 'FIR' || item.grp === 'KADIZ');
  const style = { color, weight:1.5, opacity:0.9, fill:false, interactive: !lineOnly };
  let sh = null;
  if(item.poly)        sh = L.polygon(item.poly, style);
  else if(item.circle) sh = L.circle(item.circle.c, Object.assign({ radius:item.circle.r*1852 }, style));
  if(sh){
    if(!lineOnly) sh.bindTooltip(tip,{sticky:true});
    sh.addTo(leafMap); ls.push(sh);
  }
  _aspcLayers[item.id]=ls;
}
function _aspcClear(id){ (_aspcLayers[id]||[]).forEach(l=>{try{leafMap.removeLayer(l);}catch(e){ _swallow(e); }}); _aspcLayers[id]=[]; }
function _aspcSave(){ try{ localStorage.setItem('aspcOn',JSON.stringify(aspcOn)); }catch(e){ _swallow(e); } }
function toggleAspcItem(id){
  aspcOn[id]=!aspcOn[id];
  const item=AIRSPACE_DB.find(a=>a.id===id);
  if(aspcOn[id]&&item) _aspcDraw(item); else _aspcClear(id);
  _aspcSave(); _aspcUpdateBtn();
}
function _aspcGroupSet(grp,on){
  AIRSPACE_DB.filter(a=>a.grp===grp).forEach(a=>{
    aspcOn[a.id]=on;
    if(on)_aspcDraw(a); else _aspcClear(a.id);
    const cb=document.getElementById('aspc-cb-'+a.id); if(cb)cb.checked=on;
  });
  _aspcSave(); _aspcUpdateBtn();
  _aspcRenderPanel();   // 헤더 ON 카운트 갱신
}
function _aspcUpdateBtn(){
  const any=AIRSPACE_DB.some(a=>aspcOn[a.id]);
  document.getElementById('aspc-btn').classList.toggle('active',any||document.getElementById('aspc-panel').classList.contains('open'));
}
const _aspcOpen = {};   // 그룹 펼침 상태 (기본: 모두 접힘)
function _aspcToggleGrp(g){
  _aspcOpen[g] = !_aspcOpen[g];
  _aspcRenderPanel();
}
function _aspcRenderPanel(){
  const p=document.getElementById('aspc-panel');
  const grps=[]; AIRSPACE_DB.forEach(a=>{ if(!grps.includes(a.grp)) grps.push(a.grp); });
  let html='';
  grps.forEach(g=>{
    const col=_aspcColors[g];
    const open=!!_aspcOpen[g];
    const onCnt=AIRSPACE_DB.filter(a=>a.grp===g&&aspcOn[a.id]).length;
    html+=`<div class="aspc-grp" style="color:#fff;cursor:pointer;" onclick="_aspcToggleGrp('${g}')">
      <span style="border:none;background:none;padding:0;margin:0;color:#fff;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${open?'▼':'▶'} <span style="color:${col};">■</span> ${g}${onCnt?` <b style=\"color:#fff;\">(${onCnt})</b>`:''}</span>
      <div style="flex-shrink:0;" onclick="event.stopPropagation()"><span onclick="_aspcGroupSet('${g}',true)">모두</span><span onclick="_aspcGroupSet('${g}',false)">해제</span></div></div>`;
    if(open){
      AIRSPACE_DB.filter(a=>a.grp===g).forEach(a=>{
        html+=`<label class="aspc-item"><input type="checkbox" id="aspc-cb-${a.id}" ${aspcOn[a.id]?'checked':''} onchange="toggleAspcItem('${a.id}')">
          <span style="color:${col};">■</span> ${a.name}${a.alt?` <span style=\"color:#666;font-size:8px;\">${a.alt}</span>`:''}</label>`;
      });
    }
  });
  p.innerHTML=html;
}
function toggleAspcPanel(){
  const p=document.getElementById('aspc-panel');
  const open=!p.classList.contains('open');
  p.classList.toggle('open',open);
  if(open)_aspcRenderPanel();
  _aspcUpdateBtn();
}
// 저장된 표시 상태 복원
try { AIRSPACE_DB.forEach(a=>{ if(aspcOn[a.id]) _aspcDraw(a); }); _aspcUpdateBtn(); } catch(e){ _swallow(e); }

// ── Flight Plan IFR DB를 AIP ENR 데이터로 동기화 (항로·픽스 단일 소스) ──
(function syncIfrDbFromAip() {
  try {
    // ① 픽스: AIP 픽스 149개 + VOR id → IFR_FIXES 갱신/추가 (기존 오류 좌표 덮어씀)
    _enrFixList().forEach(f => { IFR_FIXES[f.name] = { lat: +f.lat.toFixed(5), lon: +f.lon.toFixed(5) }; });
    ENR_VORS.forEach(v => { IFR_FIXES[v.id] = { lat: v.lat, lon: v.lon }; });
    // ② 항로: 임시 항로망 전면 교체 → AIP ENR 3.1/3.2의 53개 항로
    Object.keys(IFR_AIRWAYS).forEach(k => delete IFR_AIRWAYS[k]);
    ENR_ROUTES.forEach(r => { IFR_AIRWAYS[r.route] = r.wps.map(w => w.n); });
    // ②-b 터미널 픽스 등록(항로 픽스에 없는 SID 전용 지점)
    Object.entries(TERMINAL_FIXES).forEach(([k,v]) => { if (!IFR_FIXES[k]) IFR_FIXES[k] = { lat:v[0], lon:v[1] }; });
    // ③ SID/STAR/APP 절차 경유점 좌표를 AIP 픽스와 동기화(이름 일치 시)
    Object.values(IFR_DB).forEach(ap => {
      ['sids', 'stars', 'approaches'].forEach(k => (ap[k] || []).forEach(proc => {
        (proc.wps || []).forEach(wp => {
          const f = IFR_FIXES[wp.ident];
          if (f) { wp.lat = f.lat; wp.lon = f.lon; }
        });
      }));
    });
  } catch(e) { console.warn('IFR DB 동기화 실패:', e); }
})();

let _notamLayers = [];
let _notamActive = false;

function toggleNotamLayer() {
  if (_notamActive) {
    _notamLayers.forEach(l => { try { leafMap.removeLayer(l); } catch(e){ _swallow(e); } });
    _notamLayers = [];
    _notamActive = false;
    document.getElementById('notam-btn').classList.remove('active');
  } else {
    document.getElementById('notamFileInput').click();
  }
}

function loadNotamFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const isKml = file.name.toLowerCase().endsWith('.kml');
    try {
      const features = isKml ? _parseKml(text) : _parseGpx2(text);
      _notamLayers.forEach(l => { try { leafMap.removeLayer(l); } catch(e){ _swallow(e); } });
      _notamLayers = [];
      features.forEach(f => {
        const popup = _notamPopupHtml(f.name, f.desc);
        const popupOpts = { maxWidth: 320 };
        let layer;
        if (f.type === 'point') {
          layer = L.circleMarker([f.lat, f.lon], {
            radius: 6, color: '#ff9800', fillColor: '#ff9800', fillOpacity: 0.8, weight: 2
          }).bindPopup(popup, popupOpts);
          layer.addTo(leafMap);
          _notamLayers.push(layer);
          // 폴리곤/다각형 영역 추가 (텍스트 좌표열 파싱)
          const notamText = f.name + '\n' + (f.desc || '');
          const polyCoords = _extractNotamPolygon(notamText);
          if (polyCoords) {
            const poly = L.polygon(polyCoords, {
              color: '#ff0000', weight: 0.5, opacity: 1, fill: false
            }).bindPopup(popup, popupOpts);
            poly.addTo(leafMap);
            _notamLayers.push(poly);
          } else {
            // 폴리곤 없으면 반경 원 표시
            const radiusM = _extractNotamRadius(notamText);
            if (radiusM) {
              const circle = L.circle([f.lat, f.lon], {
                radius: radiusM,
                color: '#ff0000', weight: 0.5, opacity: 1,
                fill: false
              }).bindPopup(popup, popupOpts);
              circle.addTo(leafMap);
              _notamLayers.push(circle);
            }
          }
        } else if (f.type === 'line') {
          layer = L.polyline(f.coords, { color: '#ff0000', weight: 0.5, opacity: 1 })
            .bindPopup(popup, popupOpts);
          layer.addTo(leafMap);
          _notamLayers.push(layer);
        } else if (f.type === 'polygon') {
          layer = L.polygon(f.coords, { color: '#ff0000', weight: 0.5, fill: false })
            .bindPopup(popup, popupOpts);
          layer.addTo(leafMap);
          _notamLayers.push(layer);
        }
      });
      if (_notamLayers.length === 0) {
        const hasPm = isKml ? _xmlAll(new DOMParser().parseFromString(text, 'application/xml'), 'Placemark').length : 0;
        const hasWpt = !isKml ? _xmlAll(new DOMParser().parseFromString(text, 'application/xml'), 'wpt').length + _xmlAll(new DOMParser().parseFromString(text, 'application/xml'), 'trkpt').length : 0;
        if (isKml && hasPm === 0)
          alert('표시할 지형지물이 없습니다.\n\n이 KML 파일에 Placemark(위치/도형) 데이터가 없습니다.\nNOTAM 좌표 정보가 포함된 KML 파일을 사용해 주세요.');
        else if (!isKml && hasWpt === 0)
          alert('표시할 지형지물이 없습니다.\n\n이 GPX 파일에 wpt/trkpt 데이터가 없습니다.');
        else
          alert('표시할 지형지물이 없습니다.\n(좌표가 누락되었거나 지원하지 않는 형식입니다)');
        return;
      }
      _notamActive = true;
      document.getElementById('notam-btn').classList.add('active');
      const group = L.featureGroup(_notamLayers);
      leafMap.fitBounds(group.getBounds().pad(0.1));
    } catch(err) {
      alert('파일 파싱 오류: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ── NOTAM 텍스트 좌표 파싱 ───────────────────────────────
// DMS 좌표 한 토큰을 십진도로 변환
// 지원: 3700N / 12700E / 370000N / 1270000E / N3700 / E12700 / N370000 / E1270000
function _parseDms(s) {
  s = s.trim().toUpperCase().replace(/\s/g,'');
  let m;
  // 접미사형: digits + 반구
  m = s.match(/^(\d{4,7})([NS])$/);
  if (m) {
    const d = m[1];
    const [deg, min, sec] = d.length >= 6
      ? [+d.slice(0,2), +d.slice(2,4), +d.slice(4,6)]
      : [+d.slice(0,2), +d.slice(2,4), 0];
    const v = deg + min/60 + sec/3600;
    return m[2]==='N' ? v : -v;
  }
  m = s.match(/^(\d{5,8})([EW])$/);
  if (m) {
    const d = m[1];
    const [deg, min, sec] = d.length >= 7
      ? [+d.slice(0,3), +d.slice(3,5), +d.slice(5,7)]
      : [+d.slice(0,3), +d.slice(3,5), 0];
    const v = deg + min/60 + sec/3600;
    return m[2]==='E' ? v : -v;
  }
  // 접두사형: 반구 + digits
  m = s.match(/^([NS])(\d{4,7})$/);
  if (m) {
    const d = m[2];
    const [deg, min, sec] = d.length >= 6
      ? [+d.slice(0,2), +d.slice(2,4), +d.slice(4,6)]
      : [+d.slice(0,2), +d.slice(2,4), 0];
    const v = deg + min/60 + sec/3600;
    return m[1]==='N' ? v : -v;
  }
  m = s.match(/^([EW])(\d{5,8})$/);
  if (m) {
    const d = m[2];
    const [deg, min, sec] = d.length >= 7
      ? [+d.slice(0,3), +d.slice(3,5), +d.slice(5,7)]
      : [+d.slice(0,3), +d.slice(3,5), 0];
    const v = deg + min/60 + sec/3600;
    return m[1]==='E' ? v : -v;
  }
  return null;
}

// NOTAM 설명 텍스트에서 위경도 쌍 목록을 추출 → 3점 이상이면 폴리곤 반환
// 한국 NOTAM E) 항목 형식 예:
//   370000N 1270000E - 370000N 1273000E - 373000N 1273000E - ...
//   N3700 E12700 TO N3730 E12730
function _extractNotamPolygon(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  const pairs = [];

  // 접미사형: DDMM(SS)N DDDMM(SS)E (공백 0~3개로 분리)
  const re1 = /(\d{4,7}[NS])[\s]{0,3}(\d{5,8}[EW])/g;
  let m;
  while ((m = re1.exec(t)) !== null) {
    const lat = _parseDms(m[1]), lon = _parseDms(m[2]);
    if (lat !== null && lon !== null) pairs.push([lat, lon]);
  }

  // 접두사형: N/SDDMM(SS) E/WDDDMM(SS)
  if (pairs.length === 0) {
    const re2 = /([NS]\d{4,7})[\s]{1,3}([EW]\d{5,8})/g;
    while ((m = re2.exec(t)) !== null) {
      const lat = _parseDms(m[1]), lon = _parseDms(m[2]);
      if (lat !== null && lon !== null) pairs.push([lat, lon]);
    }
  }

  if (pairs.length < 3) return null;

  // 첫 점과 마지막 점이 같으면(닫힌 링) 마지막 제거
  const [f, l] = [pairs[0], pairs[pairs.length-1]];
  if (Math.abs(f[0]-l[0]) < 0.0001 && Math.abs(f[1]-l[1]) < 0.0001) pairs.pop();

  return pairs.length >= 3 ? pairs : null;
}

// NOTAM 텍스트에서 반경(미터) 추출
// 우선순위: ① Q라인 좌표+반경 필드(가장 권위 있음) → ② 본문 자유 텍스트 패턴
function _extractNotamRadius(text) {
  if (!text) return null;
  const t = text.toUpperCase();

  // ① Q라인 마지막 필드: <lat><lon><radius>
  //    좌표 = DDMM[N/S]DDDMM[E/W] (초 단위 없음), 반경 = 3자리 NM
  const qm = t.match(/Q\)[^\n]*?(\d{4}[NS]\d{5}[EW])(\d{3})\b/);
  if (qm) {
    const r = parseInt(qm[2], 10);
    if (r > 0 && r < 1000) return r * 1852;   // 999NM 미만이면 유효
  }

  // ② 본문 자유 텍스트 — NM 단위
  const num = '(\\d+(?:\\.\\d+)?)';
  const nmPats = [
    new RegExp(`RADIUS\\s+OF\\s+${num}\\s*NM`),
    new RegExp(`RADIUS[:\\s]+${num}\\s*NM`),
    new RegExp(`${num}\\s*NM\\s+RADIUS`),
    new RegExp(`WITHIN\\s+(?:A\\s+)?${num}\\s*NM`),
    new RegExp(`${num}\\s*NM\\s+(?:OF|FROM)\\b`),
    new RegExp(`CIRCLE[^,\\n]*?${num}\\s*NM`),
    new RegExp(`반경\\s*${num}\\s*(?:NM|해리)`),
  ];
  for (const p of nmPats) {
    const m = t.match(p);
    if (m) return parseFloat(m[1]) * 1852;
  }

  // ③ 미터/킬로미터 단위 (드물지만 일부 NOTAM 사용)
  let m = t.match(new RegExp(`RADIUS[:\\s]+${num}\\s*KM`)) || t.match(new RegExp(`${num}\\s*KM\\s+RADIUS`));
  if (m) return parseFloat(m[1]) * 1000;
  m = t.match(new RegExp(`RADIUS[:\\s]+${num}\\s*M\\b`)) || t.match(new RegExp(`반경\\s*${num}\\s*(?:M|미터)\\b`));
  if (m) return parseFloat(m[1]);

  return null;
}

// NOTAM 팝업 HTML 생성
function _notamPopupHtml(name, desc) {
  const raw = (desc || '').trim();
  const interp = _interpretNotam(raw || name || '');
  let html = '<div style="max-height:220px;overflow-y:auto;font-size:11px;line-height:1.5">';
  if (name) html += `<div style="font-weight:bold;color:#ffcc00;margin-bottom:4px">${_escHtml(name)}</div>`;
  if (interp) {
    html += `<div style="background:rgba(0,60,120,0.7);border-radius:4px;padding:4px 6px;color:#a8d8ff;margin-bottom:5px">${interp.replace(/\n/g,'<br>')}</div>`;
  }
  if (raw) {
    html += `<div style="color:#ccc;white-space:pre-wrap;font-size:10px">${_escHtml(raw)}</div>`;
  }
  html += '</div>';
  return html;
}

function _escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// NOTAM 텍스트 자동 해석
function _interpretNotam(text) {
  if (!text) return '';
  const lines = [];
  // Q라인 파싱
  const qm = text.match(/Q\)\s*([^\n\r]+)/);
  if (qm) {
    const parts = qm[1].split('/');
    if (parts.length >= 2) {
      const subj = _notamSubject(parts[1] || '');
      if (subj) lines.push('종류: ' + subj);
    }
    if (parts.length >= 3) {
      const tr = { 'IV':'IFR+VFR', 'I':'IFR만', 'V':'VFR만', 'K':'체크리스트' };
      const tv = tr[(parts[2]||'').trim()];
      if (tv) lines.push('해당: ' + tv);
    }
    // 고도 범위 (하한/상한 FL — Q라인 6·7번째 필드)
    if (parts.length >= 7) {
      const lo = (parts[5]||'').trim(), hi = (parts[6]||'').trim();
      if (/^\d{3}$/.test(lo) && /^\d{3}$/.test(hi)) {
        const fl = v => v === '000' ? 'GND/SFC' : 'FL' + v;
        lines.push(`고도: ${fl(lo)} – ${hi==='999'?'무제한':fl(hi)}`);
      }
    }
  }
  // 시작/종료
  const bm = text.match(/B\)\s*(\d{10})/);
  const cm = text.match(/C\)\s*(\d{10}|PERM)/i);
  if (bm) lines.push('시작: ' + _fmtNotamDt(bm[1]));
  if (cm) lines.push('종료: ' + (cm[1].toUpperCase()==='PERM'?'영구':_fmtNotamDt(cm[1])));
  // E라인 (본문)
  const em = text.match(/E\)\s*([\s\S]+?)(?=\r?\n[A-Z]\)|$)/);
  if (em) {
    const body = em[1].trim();
    if (body) lines.push('내용: ' + body.substring(0, 300) + (body.length > 300 ? '…' : ''));
  }
  // 반경 정보 표시
  const rm = _extractNotamRadius(text);
  if (rm) lines.push(`반경: ${(rm/1852).toFixed(1)} NM (${Math.round(rm)} m)`);
  return lines.join('\n');
}

function _notamSubject(code) {
  const c = code.toUpperCase();
  const map = [
    ['QRTCA','임시비행제한구역(TFR)'], ['QRDCA','위험구역(D)'], ['QRPCA','금지구역(P)'],
    ['QRACA','제한구역(R)'], ['QWWXX','경고'], ['QLCAS','착륙구역 폐쇄'],
    ['QFAXX','공항 운영정보'], ['QNVAS','항법장비 운용 중단'],
    ['QOBCE','장애물 신설'], ['QOBCL','조명 장애물'],
    ['QPICH','PIC 주의'], ['QSPAH','공역 변경'],
  ];
  for (const [k, v] of map) if (c.includes(k)) return v;
  return code;
}

function _fmtNotamDt(s) {
  if (!s || s.length < 10) return s;
  return `20${s.slice(0,2)}-${s.slice(2,4)}-${s.slice(4,6)} ${s.slice(6,8)}:${s.slice(8,10)}Z`;
}

// ── 공통 GPX 헬퍼 ──────────────────────────────────────
// getElementsByTagName은 네임스페이스를 무시 → xmlns 선언된 KML/GPX에서도 동작
function _gpxLatLon(el) {
  return [parseFloat(el.getAttribute('lat')), parseFloat(el.getAttribute('lon'))];
}
// XML 조회는 네임스페이스 접두사(gpx:trkpt 등)와 무관하게 로컬명으로 찾는다.
// getElementsByTagName은 XML 문서에서 접두사까지 일치해야 하므로 기기·도구별
// 내보내기 형식에 따라 조회가 통째로 실패한다.
function _xmlAll(parent, tag) { return Array.from(parent.getElementsByTagNameNS('*', tag)); }
function _xml1(parent, tag)   { return parent.getElementsByTagNameNS('*', tag)[0] ?? null; }

function _parseGpx2(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const features = [];
  _xmlAll(doc, 'wpt').forEach(w => {
    const [lat, lon] = _gpxLatLon(w);
    features.push({ type: 'point', lat, lon,
      name: _xml1(w, 'name')?.textContent || '',
      desc: _xml1(w, 'desc')?.textContent || '' });
  });
  _xmlAll(doc, 'trk').forEach(trk => {
    const name = _xml1(trk, 'name')?.textContent || '';
    const desc = _xml1(trk, 'desc')?.textContent  || '';
    _xmlAll(trk, 'trkseg').forEach(seg => {
      const coords = _xmlAll(seg, 'trkpt').map(_gpxLatLon);
      if (coords.length > 1) features.push({ type: 'line', coords, name, desc });
    });
  });
  _xmlAll(doc, 'rte').forEach(rte => {
    const name = _xml1(rte, 'name')?.textContent || '';
    const desc = _xml1(rte, 'desc')?.textContent  || '';
    const coords = _xmlAll(rte, 'rtept').map(_gpxLatLon);
    if (coords.length > 1) features.push({ type: 'line', coords, name, desc });
  });
  return features;
}

function _parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const features = [];
  const parseCoordStr = s => s.trim().split(/\s+/).map(c => {
    const [lon, lat] = c.split(',').map(Number);
    return [lat, lon];
  }).filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon));

  // Placemark 하나에서 도형 목록 추출 (MultiGeometry 포함)
  function extractGeoms(pm) {
    const geoms = [];
    // MultiGeometry 내 자식 도형들 재귀 처리
    const mgEl = _xml1(pm, 'MultiGeometry');
    if (mgEl) {
      _xmlAll(mgEl, 'Point').forEach(el => { const c = _xml1(el,'coordinates'); if(c) geoms.push({tag:'Point',el:c}); });
      _xmlAll(mgEl, 'LineString').forEach(el => { const c = _xml1(el,'coordinates'); if(c) geoms.push({tag:'LineString',el:c}); });
      _xmlAll(mgEl, 'Polygon').forEach(el => geoms.push({tag:'Polygon',el}));
      _xmlAll(mgEl, 'LinearRing').forEach(el => { const c = _xml1(el,'coordinates'); if(c) geoms.push({tag:'LinearRing',el:c}); });
      return geoms;
    }
    const ptEl = _xml1(pm, 'Point');
    if (ptEl) { const c = _xml1(ptEl,'coordinates'); if(c) geoms.push({tag:'Point',el:c}); return geoms; }
    const lsEl = _xml1(pm, 'LineString');
    if (lsEl) { const c = _xml1(lsEl,'coordinates'); if(c) geoms.push({tag:'LineString',el:c}); return geoms; }
    const pgEl = _xml1(pm, 'Polygon');
    if (pgEl) { geoms.push({tag:'Polygon',el:pgEl}); return geoms; }
    // LinearRing이 Placemark 바로 아래 있는 경우 (비표준이지만 일부 앱이 생성)
    const lrEl = _xml1(pm, 'LinearRing');
    if (lrEl) { const c = _xml1(lrEl,'coordinates'); if(c) geoms.push({tag:'LinearRing',el:c}); }
    return geoms;
  }

  _xmlAll(doc, 'Placemark').forEach(pm => {
    const name = _xml1(pm, 'name')?.textContent || '';
    const descEl = _xml1(pm, 'description');
    const desc   = descEl ? (descEl.textContent || '') : '';
    const extPairs = _xmlAll(pm, 'Data').map(d =>
      `${d.getAttribute('name')}: ${_xml1(d, 'value')?.textContent || ''}`).join('\n');
    const fullDesc = [desc, extPairs].filter(Boolean).join('\n');

    const geoms = extractGeoms(pm);
    geoms.forEach(g => {
      if (g.tag === 'Point') {
        const [lon, lat] = g.el.textContent.trim().split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lon)) features.push({ type: 'point', lat, lon, name, desc: fullDesc });
      } else if (g.tag === 'LineString') {
        const coords = parseCoordStr(g.el.textContent);
        if (coords.length > 1) features.push({ type: 'line', coords, name, desc: fullDesc });
      } else if (g.tag === 'LinearRing') {
        const coords = parseCoordStr(g.el.textContent);
        if (coords.length > 2) features.push({ type: 'polygon', coords, name, desc: fullDesc });
      } else if (g.tag === 'Polygon') {
        const obEl = _xml1(g.el, 'outerBoundaryIs') || g.el;
        const lrEl = _xml1(obEl, 'LinearRing') || obEl;
        const cEl  = _xml1(lrEl, 'coordinates');
        if (cEl) {
          const coords = parseCoordStr(cEl.textContent);
          if (coords.length > 2) features.push({ type: 'polygon', coords, name, desc: fullDesc });
        }
      }
    });
  });
  return features;
}

function loadFdrFile(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('fdr-status').textContent = '파싱 중…';
  const reader = new FileReader();
  const isKml = /\.kml$/i.test(file.name);
  reader.onload = e => {
    try {
      _fdrRawTrack = isKml ? _parseFdrKml(e.target.result) : _parseFdrGpx(e.target.result);
      _fdrTrack    = _fdrInterpolate(_fdrRawTrack, 50);
      if (_fdrTrack.length < 2) {
        document.getElementById('fdr-status').textContent = '트랙 포인트 없음';
        return;
      }
      _fdrIdx = 0;
      _fdrShowTrackOnMap();
      document.getElementById('fdr-status').textContent = `✔ ${file.name}`;
      const info = document.getElementById('fdr-track-info');
      const totalSec = (_fdrTrack[_fdrTrack.length-1].timeMs - _fdrTrack[0].timeMs) / 1000;
      const hh = Math.floor(totalSec/3600), mm = Math.floor((totalSec%3600)/60), ss = Math.floor(totalSec%60);
      info.textContent = `${_fdrTrack.length}pt · ${hh?hh+'h ':''}${mm}m ${ss}s`;
      info.style.display = 'block';
      // show controls
      document.getElementById('fdr-controls').style.display = 'flex';
      document.getElementById('fdr-speed').style.display    = 'flex';
      document.getElementById('fdr-timeline').style.display = 'block';
      const slider = document.getElementById('fdr-slider');
      slider.max   = _fdrTrack.length - 1;
      slider.value = 0;
      _fdrRenderFrame(0);
    } catch(err) {
      document.getElementById('fdr-status').textContent = '파싱 오류: ' + err.message;
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function _parseFdrGpx(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  const perr = doc.getElementsByTagName('parsererror')[0];
  if (perr) throw new Error('GPX XML 형식 오류');
  // 트랙(trkpt)이 우선. 앱의 '트랙 저장소 → GPX 내보내기'는 rte/rtept로,
  // 일부 도구는 wpt만으로 내보내므로 순서대로 대체한다.
  let pts = _xmlAll(doc, 'trkpt');
  if (!pts.length) pts = _xmlAll(doc, 'rtept');
  if (!pts.length) pts = _xmlAll(doc, 'wpt');
  if (pts.length < 2) throw new Error('좌표점 없음 (trkpt·rtept·wpt 모두 2점 미만)');
  const track = [];
  let prevLat = null, prevLon = null, prevTimeMs = null;
  for (const pt of pts) {
    const [lat, lon] = _gpxLatLon(pt);
    const eleEl  = _xml1(pt, 'ele');
    const timeEl = _xml1(pt, 'time');
    const altM   = eleEl ? (parseFloat(eleEl.textContent) || 0) : 0;
    // 시간이 없거나 형식이 이상하면 1초 간격으로 채운다(NaN이 들어가면 재생이 멈춘다)
    let timeMs = timeEl ? new Date(timeEl.textContent).getTime() : NaN;
    if (!isFinite(timeMs)) timeMs = track.length * 1000;
    // Speed: distance from previous point / time delta
    let speedKt = 0;
    if (prevLat !== null) {
      const distNM  = distance(prevLat, prevLon, lat, lon);
      const dtH     = (timeMs - prevTimeMs) / 3600000;
      speedKt = dtH > 0 ? distNM / dtH : 0;
    }
    track.push({ lat, lon, altM, speedKt, timeMs });
    prevLat = lat; prevLon = lon; prevTimeMs = timeMs;
  }
  // 시간이 단조증가하지 않으면(모두 같거나 역행) index 기반으로 다시 부여
  let monotonic = true;
  for (let i = 1; i < track.length; i++) if (track[i].timeMs <= track[i-1].timeMs) { monotonic = false; break; }
  if (!monotonic) {
    track.forEach((t, i) => { t.timeMs = i * 1000; });
    let prev = null;
    for (const t of track) {
      if (prev) t.speedKt = distance(prev.lat, prev.lon, t.lat, t.lon) / ((t.timeMs - prev.timeMs) / 3600000);
      prev = t;
    }
  }
  // Smooth speed with simple 3-point average
  for (let i = 1; i < track.length - 1; i++) {
    track[i].speedKt = (track[i-1].speedKt + track[i].speedKt + track[i+1].speedKt) / 3;
  }
  return track;
}

// KML FDR 파서 — gx:Track(시간 포함) 우선, 없으면 LineString 좌표열 사용
function _parseFdrKml(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  // 네임스페이스(gx:) 무관하게 로컬명으로 조회
  const byLocal = local => Array.from(doc.getElementsByTagNameNS('*', local));
  const track = [];

  // ① gx:Track: <when> … <gx:coord>lon lat alt</gx:coord> 쌍
  const coords = byLocal('coord');
  const whens  = byLocal('when');
  if (coords.length) {
    for (let i = 0; i < coords.length; i++) {
      const p = coords[i].textContent.trim().split(/\s+/).map(Number); // lon lat alt
      if (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) continue;
      const timeMs = whens[i] ? new Date(whens[i].textContent).getTime() : (track.length * 1000);
      track.push({ lat: p[1], lon: p[0], altM: p[2] || 0, speedKt: 0, timeMs });
    }
  }

  // ② LineString/coordinates 좌표열(시간 없음 → 1초 간격 부여)
  if (track.length < 2) {
    track.length = 0;
    const csNodes = byLocal('coordinates');
    for (const cs of csNodes) {
      const tokens = cs.textContent.trim().split(/\s+/);
      for (const tk of tokens) {
        const p = tk.split(',').map(Number); // lon,lat,alt
        if (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) continue;
        track.push({ lat: p[1], lon: p[0], altM: p[2] || 0, speedKt: 0, timeMs: track.length * 1000 });
      }
      if (track.length >= 2) break;   // 첫 유효 트랙만 사용
    }
  }

  if (track.length < 2) throw new Error('KML 트랙 좌표 없음 (gx:Track 또는 LineString 필요)');

  // 시간이 없는(모두 0) 경우 index 기반 시간 부여 보정
  if (track[track.length - 1].timeMs <= track[0].timeMs) {
    track.forEach((t, i) => { t.timeMs = i * 1000; });
  }

  // 속도 계산 + 3점 평활(_parseFdrGpx와 동일)
  let prev = null;
  for (const t of track) {
    if (prev) {
      const distNM = distance(prev.lat, prev.lon, t.lat, t.lon);
      const dtH    = (t.timeMs - prev.timeMs) / 3600000;
      t.speedKt = dtH > 0 ? distNM / dtH : 0;
    }
    prev = t;
  }
  for (let i = 1; i < track.length - 1; i++) {
    track[i].speedKt = (track[i-1].speedKt + track[i].speedKt + track[i+1].speedKt) / 3;
  }
  return track;
}

// Linear interpolation between raw GPX points at stepMs intervals (default 500ms).
// Lat/lon use great-circle interpolation via destPoint; alt/speed are lerped linearly.
function _fdrInterpolate(raw, stepMs) {
  if (raw.length < 2) return raw;
  const out = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const a  = raw[i], b = raw[i + 1];
    const dt = b.timeMs - a.timeMs;
    if (dt <= 0) { out.push(a); continue; }
    // heading from a → b (used for all sub-points in this segment)
    const segHdg = bearing(a.lat, a.lon, b.lat, b.lon);
    const distNM = distance(a.lat, a.lon, b.lat, b.lon);
    const steps  = Math.max(1, Math.round(dt / stepMs));
    for (let s = 0; s < steps; s++) {
      const t   = s / steps;            // 0 … <1
      const p   = destPoint(a.lat, a.lon, segHdg, distNM * t);
      out.push({
        lat:     p[0],
        lon:     p[1],
        altM:    a.altM    + (b.altM    - a.altM)    * t,
        speedKt: a.speedKt + (b.speedKt - a.speedKt) * t,
        timeMs:  a.timeMs  + dt * t,
      });
    }
  }
  out.push(raw[raw.length - 1]); // always include the last original point
  return out;
}

function _fdrShowTrackOnMap() {
  // ── 2D Leaflet: full route preview + start marker ──
  if (_fdrLayer2d)  { leafMap.removeLayer(_fdrLayer2d);  _fdrLayer2d  = null; }
  if (_fdrMarker2d) { leafMap.removeLayer(_fdrMarker2d); _fdrMarker2d = null; }

  // Use original (non-interpolated) GPX points for the route preview line
  const src = _fdrRawTrack.length ? _fdrRawTrack : _fdrTrack;
  const latlngs = src.map(p => [p.lat, p.lon]);
  _fdrLayer2d  = L.polyline(latlngs, { color: '#ff8800', weight: 2.5, opacity: 0.9 }).addTo(leafMap);
  _fdrMarker2d = L.circleMarker([src[0].lat, src[0].lon],
    { radius: 7, color: '#ff8800', fillColor: '#ffaa00', fillOpacity: 1, weight: 2 }).addTo(leafMap);
  leafMap.fitBounds(_fdrLayer2d.getBounds(), { padding: [20, 20] });

  // ── 3D maplibre: draw now if loaded, otherwise queue for when it loads ──
  _fdrDraw3dTrackRoute();
}

// Draws (or redraws) the full GPX route preview on the 3D map.
// Called immediately if the map is ready, or deferred to the next 'load' event.
function _fdrDraw3dTrackRoute() {
  if (!_ml3d) return;                // 3D not open yet — _init3dMap will call this on load
  if (!_ml3d.loaded()) {
    _ml3d.once('load', _fdrDraw3dTrackRoute);
    return;
  }
  // Remove old layer/source if present
  if (_fdrLayer3d) {
    try { _ml3d.removeLayer('fdr-track'); } catch(e) { _swallow(e); }
    try { _ml3d.removeSource('fdr-track'); } catch(e) { _swallow(e); }
    _fdrLayer3d = false;
  }
  const src = _fdrRawTrack.length ? _fdrRawTrack : _fdrTrack;
  if (!src.length) return;
  const coords = src.map(p => [p.lon, p.lat]);
  _ml3d.addSource('fdr-track', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
  });
  _ml3d.addLayer({
    id: 'fdr-track', type: 'line', source: 'fdr-track',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ff8800', 'line-width': 2.5, 'line-opacity': 0.9 }
  }, _firstSymbolLayerId());
  _fdrLayer3d = true;
}

function _fdrRenderFrame(idx) {
  _fdrIdx = Math.max(0, Math.min(_fdrTrack.length - 1, idx));
  const p = _fdrTrack[_fdrIdx];

  // Update position marker on 2D map
  if (_fdrMarker2d) _fdrMarker2d.setLatLng([p.lat, p.lon]);

  // Calculate heading from next point (or previous if at end)
  let hdg = 0;
  if (_fdrIdx < _fdrTrack.length - 1) {
    hdg = bearing(p.lat, p.lon, _fdrTrack[_fdrIdx+1].lat, _fdrTrack[_fdrIdx+1].lon);
  } else if (_fdrIdx > 0) {
    hdg = bearing(_fdrTrack[_fdrIdx-1].lat, _fdrTrack[_fdrIdx-1].lon, p.lat, p.lon);
  }

  // Inject into sim state (replay mode — overrides physics)
  S.lat = p.lat;
  S.lon = p.lon;
  S.alt = p.altM * 3.28084;   // metres → feet
  S.spd = Math.round(p.speedKt);
  S.hdg = hdg;
  syncHdgBug();   // 리플레이 종료 후 옛 HDG bug로 선회하지 않도록

  // Accumulate trail so 2D/3D trail lines update during FDR replay
  const last = S.trail[S.trail.length - 1];
  if (!last || distance(last[0], last[1], S.lat, S.lon) > 0.001) {
    S.trail.push([S.lat, S.lon]);
    if (S.trail.length > 3000) S.trail.shift();
  }

  // Update map aircraft marker + follow (triggers _applyFollow for 3D follow mode)
  updateAcOnMap();
  _update3dTrail();
  drawPFD();

  // Update timeline slider
  document.getElementById('fdr-slider').value = _fdrIdx;
  // Time label
  const elapsed = (_fdrTrack[_fdrIdx].timeMs - _fdrTrack[0].timeMs) / 1000;
  const total   = (_fdrTrack[_fdrTrack.length-1].timeMs - _fdrTrack[0].timeMs) / 1000;
  document.getElementById('fdr-time-label').textContent =
    _fmtTime(elapsed) + ' / ' + _fmtTime(total);
}

function _fmtTime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
           : `${m}:${String(s).padStart(2,'0')}`;
}

// rAF-based playback loop: advances to the track point whose timeMs matches
// current elapsed wall-clock time × speed multiplier.
function _fdrRafLoop(wallNow) {
  if (!_fdrPlaying) return;

  const trackNow = _fdrTrackStart + (wallNow - _fdrWallStart) * _fdrSpeed;
  const last     = _fdrTrack[_fdrTrack.length - 1];

  if (trackNow >= last.timeMs) {
    _fdrRenderFrame(_fdrTrack.length - 1);
    fdrPause();
    return;
  }

  // Binary search for the correct index
  let lo = _fdrIdx, hi = _fdrTrack.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (_fdrTrack[mid].timeMs <= trackNow) lo = mid; else hi = mid;
  }
  if (lo !== _fdrIdx) {
    _fdrRenderFrame(lo);
  } else {
    // Index unchanged but 3D camera (follow/track-up) must update every frame
    if (_view3dOn && _ml3d && _ml3d.loaded() && followMode) _applyFollow();
  }

  _fdrRafId = requestAnimationFrame(_fdrRafLoop);
}

function fdrPlay() {
  if (!_fdrTrack.length) return;
  if (_fdrIdx >= _fdrTrack.length - 1) _fdrIdx = 0;
  _fdrPlaying    = true;
  _fdrWallStart  = performance.now();
  _fdrTrackStart = _fdrTrack[_fdrIdx].timeMs;
  document.getElementById('fdr-play-btn').classList.add('active');
  if (_fdrRafId) cancelAnimationFrame(_fdrRafId);
  _fdrRafId = requestAnimationFrame(_fdrRafLoop);
}

function fdrPause() {
  _fdrPlaying = false;
  if (_fdrRafId) { cancelAnimationFrame(_fdrRafId); _fdrRafId = null; }
  document.getElementById('fdr-play-btn').classList.remove('active');
}

function fdrStop() {
  fdrPause();
  _fdrIdx = 0;
  S.trail = []; updateTrail();   // clear trail when rewinding to start
  if (_fdrTrack.length) _fdrRenderFrame(0);
}

function fdrSeek(val) {
  const idx = parseInt(val);
  const wasPlaying = _fdrPlaying;
  if (wasPlaying) {
    // cancel current loop, move index, restart from new position
    _fdrPlaying = false;
    if (_fdrRafId) { cancelAnimationFrame(_fdrRafId); _fdrRafId = null; }
  }
  _fdrRenderFrame(idx);
  if (wasPlaying) fdrPlay();
}

function fdrSetSpeed(val) {
  const wasPlaying = _fdrPlaying;
  if (wasPlaying) fdrPause();
  _fdrSpeed = parseFloat(val);
  if (wasPlaying) fdrPlay();
}

