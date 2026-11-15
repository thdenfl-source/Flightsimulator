// ─────────────────────────────────────────────────────────────
// 09-cdu.js — CDU (세션 복원 · 액션 위임) — 화면들은 09b-cdu-screens.js · 출발 공항은 09a-start.js
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
//  세션 상태 지속/복원 — 화면 꺼짐·앱 전환으로 탭이 자동 리로드돼도
//  마지막 상태를 그대로 복원한다. (모바일 브라우저는 백그라운드에서 JS를
//  계속 돌릴 수 없으므로, "리로드 후 즉시 복원"으로 연속성을 확보)
//  ⟳ 새로고침 버튼(hardReload)만 세션을 지워 초기 상태로 시작한다.
// ═══════════════════════════════════════════════════════════════
const SESSION_KEY = 'flightSession';
const SESSION_TTL = 6 * 3600 * 1000;   // 6시간 이내 스냅샷만 복원

function saveSession() {
  try {
    const snap = {
      v: 1, ts: Date.now(),
      s: { lat:S.lat, lon:S.lon, hdg:S.hdg, spd:S.spd, alt:S.alt, pit:S.pit, bnk:S.bnk,
           crs:S.crs, vs:S.vs, running:S.running, wps:S.wps, awp:S.awp, fwp:S.fwp },
      gps: gpsMode,
      fcp: { selSpd, selAlt, selCrht, selVS, selHdg, hdgSelOn, altHoldOn, crhtOn, gspdOn, rollApOn, bankTarget,
             gspdActLat, gspdActFwd, gspdRefLat, gspdRefFwd, gspdCoasting, hdgRef, dgErr },
      nav: { obsOn, navSrc, navRadios, vorObsCrs },
      view: { mapHdgUp, followMode, leftSel, midSel, rightSel, tripleMode },
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(snap));
  } catch(e) { _swallow(e); }
}

function restoreSession() {
  let snap = null;
  try { snap = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e) { _swallow(e); }
  if (!snap || snap.v !== 1 || (Date.now() - snap.ts) > SESSION_TTL) return false;
  try {
    const s = snap.s || {};
    Object.assign(S, {
      lat:s.lat, lon:s.lon, hdg:s.hdg, spd:s.spd, alt:s.alt, pit:s.pit, bnk:s.bnk,
      crs:s.crs, vs:s.vs, running:!!s.running, lastT:null,
      wps:Array.isArray(s.wps)?s.wps:[], awp:s.awp??-1, fwp:s.fwp??-1,
    });
    const f = snap.fcp || {};
    if (f.selSpd!=null) selSpd=f.selSpd; if (f.selAlt!=null) selAlt=f.selAlt;
    if (f.selCrht!=null) selCrht=f.selCrht; if (f.selVS!=null) selVS=f.selVS; if (f.selHdg!=null) selHdg=f.selHdg; if (f.hdgSelOn!=null) hdgSelOn=f.hdgSelOn;
    altHoldOn=!!f.altHoldOn; crhtOn=!!f.crhtOn; gspdOn=!!f.gspdOn; rollApOn=f.rollApOn!==false;
    bankTarget=f.bankTarget||0;
    gspdActLat=f.gspdActLat||0; gspdActFwd=f.gspdActFwd||0;
    gspdRefLat=(f.gspdRefLat===undefined?null:f.gspdRefLat); gspdRefFwd=(f.gspdRefFwd===undefined?null:f.gspdRefFwd);
    gspdCoasting=!!f.gspdCoasting;
    hdgRef = f.hdgRef === 'DG' ? 'DG' : 'MG'; dgErr = hdgRef === 'DG' ? (+f.dgErr || 0) : 0;
    const n = snap.nav || {};
    obsOn=!!n.obsOn; navSrc=n.navSrc||'FMS'; vorObsCrs=n.vorObsCrs??360;
    if (n.navRadios) { try { ['NAV1','NAV2'].forEach(k => { if (n.navRadios[k]) navRadios[k] = Object.assign({}, navRadios[k], n.navRadios[k]); }); } catch(e) { _swallow(e); } }
    const v = snap.view || {};
    mapHdgUp=!!v.mapHdgUp; followMode=!!v.followMode;
    if (v.leftSel) leftSel='pfd'; if (v.midSel) midSel=v.midSel; if (v.rightSel) rightSel=v.rightSel;
    if (v.tripleMode != null) tripleMode = !!v.tripleMode;
    // 재적용
    try { updateFlyBtns(); } catch(e) { _swallow(e); }
    try { updateHoverBtns(); } catch(e) { _swallow(e); }
    try { updateCrsButtons(); } catch(e) { _swallow(e); }
    try { setNavSrc(navSrc); } catch(e) { _swallow(e); }
    try { applyPanels(); } catch(e) { _swallow(e); }
    try { updateWpMarkers(); fpRender(); updateNav(); } catch(e) { _swallow(e); }
    try { updateAcOnMap(); leafMap.setView([S.lat, S.lon]); } catch(e) { _swallow(e); }
    if (snap.gps) { try { startGPS(); } catch(e) { _swallow(e); } }   // GPS 켜져 있었으면 재개
    return true;
  } catch(e) { return false; }
}

// ── 야간 모드 ──
let nightMode = false;
try { nightMode = localStorage.getItem('nightMode') === '1'; } catch(e) { _swallow(e); }
function applyNightMode() { document.body.classList.toggle('night-mode', nightMode); }
function toggleNightMode() {
  nightMode = !nightMode;
  try { localStorage.setItem('nightMode', nightMode ? '1' : '0'); } catch(e) { _swallow(e); }
  applyNightMode();
}

// ── 근처 공항 자동 METAR → OAT/QNH 자동 반영 ──
let autoMetarOn = true, _autoMetarLast = 0, _autoMetarIcao = '';
try { autoMetarOn = localStorage.getItem('autoMetarOn') !== '0'; } catch(e) { _swallow(e); }
function _nearestAirport() {
  let best = null, bd = Infinity;
  (WX_AIRPORTS || []).forEach(a => {
    const d = distance(S.lat, S.lon, a.lat, a.lon);
    if (d < bd) { bd = d; best = a; }
  });
  return best ? { a: best, d: bd } : null;
}
async function _autoMetarTick() {
  if (!autoMetarOn) return;
  if (!(gpsMode || S.running)) return;             // 실제 비행/시뮬 중에만
  if (Date.now() - _autoMetarLast < 5 * 60 * 1000) return;   // 5분 스로틀
  const near = _nearestAirport();
  if (!near || near.d > 60) return;                // 60NM 넘으면 생략
  _autoMetarLast = Date.now();
  _autoMetarIcao = near.a.icao;
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 6000);
    let raw = null;
    try { raw = await _ivaoMetar(near.a.icao, ctl.signal); }
    catch(e) { try { raw = await _vatsimMetar(near.a.icao, ctl.signal); } catch(e2) { _swallow(e2); } }
    if (raw) _parseMetar(raw.split('\n')[0]);       // _oatSurfaceC 자동 갱신
  } catch(e) { _swallow(e); }
}
setInterval(() => { try { _autoMetarTick(); } catch(e) { _swallow(e); } }, 30000);

// ── PWA 설치 프롬프트 ──
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _deferredPrompt = e; });
function pwaInstall() {
  if (_deferredPrompt) { _deferredPrompt.prompt(); _deferredPrompt = null; }
  else uiAlert('홈 화면에 추가:\n\niOS Safari — 공유 버튼 → "홈 화면에 추가"\nAndroid Chrome — 메뉴(⋮) → "앱 설치"');
}

// ── 지도 타일 프리캐시(현재 화면 주변) — 음영지역 대비 ──
function _lonLatToTile(lon, lat, z) {
  const n = 1 << z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latR = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);
  return { x, y, n };
}
async function prefetchTiles() {
  const c = leafMap.getCenter(), z0 = Math.round(leafMap.getZoom());
  const sat = document.getElementById('layer-btn')?.classList.contains('sat');
  const urlFor = (z, x, y) => sat
    ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  let count = 0;
  const zs = [z0, Math.min(18, z0 + 1)];
  for (const z of zs) {
    const t = _lonLatToTile(c.lng, c.lat, z);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      const x = t.x + dx, y = t.y + dy;
      if (x < 0 || y < 0 || x >= t.n || y >= t.n) continue;
      try { await fetch(urlFor(z, x, y), { mode: 'no-cors' }); count++; } catch(e) { _swallow(e); }
    }
  }
  uiAlert(`주변 지도 타일 ${count}개를 캐시했습니다.\n(오프라인/음영지역에서 이 영역이 표시됩니다)`);
}

// ⟳ 새로고침: 세션을 지우고 초기 상태로 리로드(백그라운드 복원 종료)
function hardReload() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) { _swallow(e); }
  location.reload();
}

// 주기적 + 이탈 시점 저장
setInterval(saveSession, 4000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveSession(); });
window.addEventListener('pagehide', saveSession);

function init(){
  resizePFD();
  applyNightMode();   // 야간 모드 복원
  showHelpOnLaunch();
  const _restored = restoreSession();   // 자동 리로드 복원(있으면 FPL 복원 생략)
  if (!_restored) _fplRestore();        // 저장된 비행계획 복원(새로고침 대비)
  _startPosInit(_restored);             // 시작 위치(GPS 는 쓰지 않는다) · 처음이면 출발 공항을 묻는다
  fpRender();
  updateAcOnMap();
  try { updateHdgRefBtns(); } catch(e) { _swallow(e); }   // MG/DG 버튼(복원됐으면 그 상태)
  try { updatePfdOvBtn(); } catch(e) { _swallow(e); }     // 3D 화면의 계기 ON/OFF
  S.pit = pitchFromSpd(S.spd);
  // NAV1/NAV2 무선의 튜닝 VOR 좌표 해석(ENR_VORS 정의 이후에 실행되도록 지연)
  setTimeout(() => {
    try { ['NAV1','NAV2'].forEach(k => setNavRadio(k, navRadios[k].freq, navRadios[k].id)); } catch(e) { _swallow(e); }
    try { setNavSrc(navSrc); } catch(e) { _swallow(e); }   // 현재 소스 라벨/CDI 반영
  }, 0);
  // 처음 켤 때의 우측 창 — 3분할이면 CDU(좌 PFD · 중 MAP · 우 CDU), 2분할이면 MAP.
  // 종전에는 늘 setPage(0) 이라 3분할에서도 우측이 MAP 이 되고, 그 바람에
  // 중앙에 있던 MAP 과 자리가 맞바뀌어 CDU 가 가운데로 밀려났다.
  if (!_restored) setPage(0);   // 3분할 PFD · CDU · MAP / 2분할 PFD · MAP — 우측은 늘 MAP 으로 시작   // 복원 시엔 restoreSession의 applyPanels로 배치 유지
  window.addEventListener('resize', () => { resizePFD(); try { leafMap.invalidateSize(); } catch(e) { _swallow(e); } scaleCdu(); });
  setTimeout(() => leafMap.invalidateSize(), 100);
  // 저장된 표시 포인트를 지도에 복원.
  // init()은 CDU 캡슐화 IIFE보다 먼저 실행되므로, 그 시점엔 _tpRenderMapPoints가
  // 아직 공개되지 않았다. 스크립트 전체가 끝난 뒤로 미룬다.
  // CDU 화면들이 따로 읽히므로(09b-cdu-screens.js) 그것이 읽힐 때까지 기다렸다 부른다
  (function tpRestore(n) {
    if (typeof window._tpRenderMapPoints === 'function') { try { window._tpRenderMapPoints(); } catch(e) { _swallow(e); } }
    else if (n < 100) setTimeout(() => tpRestore(n + 1), 50);
  })(0);
  if (!_simLoopRunning) { _simLoopRunning = true; requestAnimationFrame(simStep); }

  // ── PFD canvas tap-to-edit ──
  // FMA row (top of AI)  : middle cell → HDG preselect, right cell → IAS preselect
  // ALT header box (top of ALT tape, right column top half) → selAlt
  // CRHT header box (top of CRHT display, right column bottom half) → selCrht
  async function onPfdTap(clientX, clientY) {
    const rect = cvs.getBoundingClientRect();
    const scX  = cvs.width  / rect.width;
    const scY  = cvs.height / rect.height;
    const px   = (clientX - rect.left) * scX;
    const py   = (clientY - rect.top)  * scY;
    // 스톱워치 버튼(HSI 오른쪽 아래 — 03-pfd.js drawStopwatch)
    try { if (typeof swHitTest === 'function' && swHitTest(px, py)) return; } catch (e) { _swallow(e); }
    if (typeof acIs === 'function' && acIs('b206')) return;   // Bell 206 아날로그 계기판에는 누를 칸(FMA · ALT 칸 · MAP/TCAS 창 등)이 없다
    // 오른쪽 아래 MAP · TCAS 창 — 누르면 서로 바꾼다(03-pfd.js drawPfdInset)
    try { if (typeof pfdInsetHit === 'function' && pfdInsetHit(px, py)) return; } catch (e) { _swallow(e); }

    // Mirror drawPFD geometry
    const ctrlEl = document.querySelector('#pfd-wrap > .ctrl-bar') || document.querySelector('.ctrl-bar');
    const CTRL_H = (typeof pfdFcpSide === 'function' && pfdFcpSide()) ? 0 : (ctrlEl ? ctrlEl.offsetHeight : 80);
    const W      = cvs.width;
    const H      = cvs.height;
    const L      = pfdLayout(W, H, CTRL_H);       // drawPFD 와 같은 배치(03-pfd.js)
    const aiX    = L.ai.x, aiW = L.ai.w;

    // Header boxes (where selAlt / selCrht + VS are shown)
    const HEAD_H   = 26;

    // — ALT tape header (x in alt tape) —
    // Header is sub-divided: top half ≈ selAlt, bottom half ≈ selVS
    if (py >= L.alt.y && py <= L.alt.y + HEAD_H && px >= L.alt.x && px <= L.alt.x + L.alt.w) {
      if (py < L.alt.y + HEAD_H * 0.5) {
        const v = await uiPrompt('ALT preselect (ft):', selAlt, { numeric: true });
        if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) selAlt = n; }
      } else {
        const v = await uiPrompt('VS preselect (fpm, magnitude — direction is auto):', Math.abs(selVS), { numeric: true });
        if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) selVS = Math.max(50, Math.min(3000, n)); }
      }
      return;
    }
    // — CRHT display header (bottom half, x in [altX, crhtRight]) —
    // Tap for a free-form CRHT target entry (alternative to the
    // 10 ft step CRHT +/- buttons in the ctrl-bar's first row).
    if (py >= L.crht.y && py <= L.crht.y + HEAD_H && px >= L.crht.x && px <= L.crht.x + L.crht.w) {
      const v = await uiPrompt('CRHT preselect (ft):', selCrht, { numeric: true });
      if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) selCrht = n; }
      return;
    }

    // — FMA row (centre AI column, top) — HDG / IAS preselect entry —
    if (px < aiX || px > aiX + aiW) return;
    const { cellW, x0: fx0, total: fTot } = fmaCells(aiX, aiW);   // 03-pfd.js — 세 칸은 가운데에 모여 있다
    const relX   = px - fx0;
    const boxIdx = (relX < 0 || relX > fTot) ? -1 : Math.max(0, Math.min(2, Math.floor(relX / (cellW + FMA_GAP))));

    const fmaTop = FMA_MARGIN;
    const fmaBtm = FMA_MARGIN + FMA_BOX_H;
    if (py >= fmaTop && py <= fmaBtm) {
      if (boxIdx === 1) {
        const v = await uiPrompt('HDG preselect (1–360°M):', fmtA(toMag(selHdg)), { numeric: true });
        if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n)) { selHdg = toTrue(Math.max(1, Math.min(360, n))) || 360; hdgTurnDir = 0; hdgSelOn = true; rollApOn = true; } }
      } else if (boxIdx === 2) {
        const v = await uiPrompt('IAS preselect (kt):', selSpd, { numeric: true });
        if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) selSpd = n; }
      }
    }
  }

  // Touch: guard against scroll drags; click: desktop support
  let pfdTouchX = 0, pfdTouchY = 0;
  cvs.addEventListener('touchstart', e => {
    pfdTouchX = e.touches[0].clientX;
    pfdTouchY = e.touches[0].clientY;
  }, { passive: true });
  cvs.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - pfdTouchX, dy = t.clientY - pfdTouchY;
    if (Math.sqrt(dx*dx + dy*dy) < 10) onPfdTap(t.clientX, t.clientY);
  }, { passive: true });
  cvs.addEventListener('click', e => onPfdTap(e.clientX, e.clientY));
}
// ── Ship Feature ──
let shipLat = null, shipLon = null;
let shipHdg = 0, shipSpd = 0;
let shipMarker = null, shipVisible = false, shipDragging = false;
let shipInputMode = 'SPD', shipInput = '';

// ── 난이도(상·중·하) — 배 속도의 흔들림(Flightsimulator 와 같다) ──
// 실제 배는 설정 속도를 그대로 지키지 못하고 너울·조타로 조금씩 빨라졌다 느려졌다 한다.
//   하: 흔들림 없음 · 중: ±1kt · 상: ±2kt — 15~40초마다 새 목표를 골라 0.1kt/s 로 천천히 다가간다.
const SHIP_LVL_KT = { HI: 2, MID: 1, LO: 0 };
const SHIP_VAR_RATE = 0.1;
let shipLvl = 'LO';
try { const v = localStorage.getItem('shipLvl'); if (v && SHIP_LVL_KT[v] !== undefined) shipLvl = v; } catch (e) { _swallow(e); }
let shipVar = 0, shipVarTgt = 0, shipVarNext = 0;
function shipSpdNow() { return shipSpd > 0 ? Math.max(0, shipSpd + shipVar) : 0; }
function shipVarStep(dt, rnd) {
  const A = SHIP_LVL_KT[shipLvl] || 0;
  if (!A) { shipVar = shipVarTgt = shipVarNext = 0; return; }
  rnd = rnd || Math.random;
  shipVarNext -= dt;
  if (shipVarNext <= 0) {
    shipVarTgt = (rnd() < 0.5 ? -1 : 1) * A * (0.5 + 0.5 * rnd());
    shipVarNext = 15 + 25 * rnd();
  }
  const d = shipVarTgt - shipVar, m = SHIP_VAR_RATE * dt;
  shipVar = Math.abs(d) <= m ? shipVarTgt : shipVar + Math.sign(d) * m;
  shipVar = Math.max(-A, Math.min(A, shipVar));
}
function shipSetLvl(lvl) {
  if (SHIP_LVL_KT[lvl] === undefined) return;
  shipLvl = lvl;
  try { localStorage.setItem('shipLvl', lvl); } catch (e) { _swallow(e); }
  const A = SHIP_LVL_KT[lvl];
  shipVar = Math.max(-A, Math.min(A, shipVar)); shipVarTgt = shipVar; shipVarNext = 0;
  if (!A) shipVar = shipVarTgt = 0;
  updateShipStatus();
}

// ── 롤·피칭(너울에 흔들리는 갑판) — 설정창 ROLL(최대 10°) · PITCH(최대 5°) ──
// 롤은 9초, 피칭은 6.5초 주기로 흔든다. 갑판 높이(착함 바닥)와 3D 모형이 함께 기울고,
// 갑판에 앉은 헬기도 그 자세로 기운다.
const SHIP_ROLL_MAX = 10, SHIP_PITCH_MAX = 5, SHIP_ROLL_T = 9, SHIP_PITCH_T = 6.5;
let shipRollAmp = 0, shipPitchAmp = 0, shipMotT = 0;
try {
  const a = JSON.parse(localStorage.getItem('shipMotion') || 'null');
  if (a && Number.isFinite(a.r) && Number.isFinite(a.p)) {
    shipRollAmp = Math.max(0, Math.min(SHIP_ROLL_MAX, a.r)); shipPitchAmp = Math.max(0, Math.min(SHIP_PITCH_MAX, a.p));
  }
} catch (e) { _swallow(e); }
function shipMotionOn() { return shipRollAmp > 0 || shipPitchAmp > 0; }
// 지금 함정의 롤(°, 우현이 내려가면 +) · 피치(°, 함수가 들리면 +)
function shipMotion() {
  return { roll: shipRollAmp * Math.sin(2 * Math.PI * shipMotT / SHIP_ROLL_T),
           pitch: shipPitchAmp * Math.sin(2 * Math.PI * shipMotT / SHIP_PITCH_T + 1) };
}
// 함정 좌표 [오른쪽 +, 함미 쪽 +](m) · 높이 h(m, 기본 갑판)의 점이 롤·피칭으로 오르내린 높이(m).
// 3D 모형(_ship3dLayer)과 똑같은 회전(갑판 높이 · 함정 가운데를 축으로)으로 셈한다 — 그래야 갑판에
// 앉은 헬기가 그려진 갑판에서 뜨거나 묻히지 않는다.
function shipHeaveAt(x, y, h) {
  if (!shipMotionOn()) return 0;
  const m = shipMotion(), R = heli3dRot(0, m.pitch, m.roll);
  const v = [-y, x, (h == null ? SHIP3D_DECK : h) - SHIP3D_DECK];
  return R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2] - v[2];
}
let _shipMot3dT = 0;
// 시뮬 시간만큼 흔들림을 진행한다(07-sim.js — 일시정지 중에는 멈춘다)
function shipMotionStep(dt) {
  if (!shipVisible || !shipMotionOn() || !(dt > 0)) return;
  shipMotT += dt;
  const now = performance.now();
  if (now - _shipMot3dT > 30) { _shipMot3dT = now; try { _ship3dMaps().forEach(m => m.triggerRepaint()); } catch (e) { _swallow(e); } }
}

function shipIcon() {
  return L.divIcon({
    html: `<div data-act="openShipPanel" style="transform:rotate(${shipHdg}deg);transform-origin:12px 20px;line-height:0;cursor:pointer;"><svg width="24" height="40" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg"><path d="M12 1 Q20 7 21 17 L21 33 Q21 39 12 39 Q3 39 3 33 L3 17 Q4 7 12 1Z" fill="#2f7d4a" stroke="#f2f3f4" stroke-width="1.5"/><rect x="8" y="13.8" width="8" height="10" rx="2" fill="#fafafa" stroke="#23418f" stroke-width="0.7"/><circle cx="12" cy="5" r="2.5" fill="#e3e5e7" opacity="0.9"/><line x1="12" y1="1" x2="12" y2="39" stroke="#88ccff" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.4"/></svg></div>`,
    iconSize: [24, 40], iconAnchor: [12, 20], className: ''
  });
}

// 하단 SHIP 버튼: INHIBIT처럼 선택 메뉴(배 표시 / 설정창) 열기·닫기
function toggleShip(force) {
  if (force !== false) shipUiHome(false);    // 지도 아래 막대의 SHIP — 2D 지도 창에서 연다
  const m = document.getElementById('ship-menu');
  if (force === false) m.classList.remove('open');
  else m.classList.toggle('open');
  _shipPanelFollowMenu(m);
  renderShipOnOff();
}
// SHIP 메뉴를 닫으면 배 설정창(SHIP CONTROL)도 함께 닫는다
function _shipPanelFollowMenu(m) {
  if (m && !m.classList.contains('open')) {
    const p = document.getElementById('ship-panel');
    if (p) p.style.display = 'none';
  }
}

// 메뉴: 배 표시 ON/OFF (마커 생성/제거)
function shipToggleOn() {
  if (shipVisible) {
    if (shipMarker) { leafMap.removeLayer(shipMarker); shipMarker = null; }
    shipVisible = false;
    shipTrail = []; updateShipTrail();
    document.getElementById('ship-panel').style.display = 'none';   // 배 끄면 설정창도 닫음
  } else {
    [shipLat, shipLon] = _shipSpawn();
    shipTrail = []; updateShipTrail();
    shipVisible = true;
    createShipMarker();
  }
  renderShipOnOff();
  updateShip3d();
}

// 새 함정을 놓을 자리 — 지금 보고 있는 지도의 가운데(3D 창에서 켰거나 2D 지도가
// 화면에 없으면 3D 의 가운데). SIM 1인칭에서는 화면 가운데가 지평선 너머이거나
// 헬기 바로 아래라, 기수 앞 0.3NM 에 놓는다.
function _shipSpawn() {
  try {
    if (typeof simModeOn !== 'undefined' && simModeOn) return destPoint(S.lat, S.lon, S.hdg, 0.3);
    const mw = document.getElementById('map-wrap');
    const map2d = !!mw && !mw.classList.contains('page-hidden') && !_view3dOn;
    const on3d = _ml3d && _ml3dReady && _map3dShown() && (_shipUiIn3d() || !map2d);
    if (on3d) { const c = _ml3d.getCenter(); return [c.lat, c.lng]; }
  } catch (e) { _swallow(e); }
  const c = leafMap.getCenter();
  return [c.lat, c.lng];
}

// 메뉴: 설정창 ON/OFF (배가 있어야 열림)
function shipTogglePanel() {
  const panel = document.getElementById('ship-panel');
  const open = panel.style.display === 'block';
  if (open) { panel.style.display = 'none'; }
  else {
    if (!shipVisible) shipToggleOn();   // 설정창을 열면 배도 자동 ON
    openShipPanel();
  }
  renderShipOnOff();
}

// 상태 표시 갱신(메뉴·패널 토글·하단 버튼)
function renderShipOnOff() {
  const panelOpen = document.getElementById('ship-panel').style.display === 'block';
  const sShow = document.getElementById('ship-menu-show');
  if (sShow) { sShow.classList.toggle('on', shipVisible); sShow.querySelector('span').textContent = shipVisible ? 'ON' : 'OFF'; }
  const sPanel = document.getElementById('ship-menu-panel');
  if (sPanel) { sPanel.classList.toggle('on', panelOpen); sPanel.querySelector('span').textContent = panelOpen ? 'ON' : 'OFF'; }
  ['map-ship-btn', 'ship3d-btn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('ship-active', shipVisible);
  });
}

// SHIP 메뉴의 '항공기 위치' — 헬기를 함정 비행갑판의 착함 원 위에 앉힌 채로 SIM 을 시작한다.
// 기수는 함정 침로와 같이, 레버는 내려 둔 채(토크 0). 함정이 가고 있으면 갑판에 앉은 채 함께 간다.
function shipPlaceHeli() {
  if (!shipVisible) shipToggleOn();
  if (shipLat === null) return;
  try { if (typeof simModeOn !== 'undefined' && !simModeOn) toggleSimMode(true); } catch (e) { _swallow(e); }
  // 갑판 위에서 새로 시작한다 — 날던 중의 상위모드(GSPD·CRHT·ALT·HDG 등)는 모두 풀고, 트림·속도·GSPD 몫도 비운다
  // (풀지 않으면 GSPD 가 갑판 위로 미끄러뜨리고 CRHT·ALT 가 띄워 올린다)
  try { if (typeof afcsReleaseAll === 'function') afcsReleaseAll(); } catch (e) { _swallow(e); }
  try { gspdActFwd = 0; gspdActLat = 0; gspdRefFwd = 0; gspdRefLat = 0; gspdCoasting = false; } catch (e) { _swallow(e); }
  try { if (typeof simTrimReset === 'function') simTrimReset(); } catch (e) { _swallow(e); }
  try { if (typeof simParkBrake !== 'undefined') simParkBrake = false; } catch (e) { _swallow(e); }
  try { if (typeof simEmerBrake !== 'undefined') simEmerBrake = false; } catch (e) { _swallow(e); }
  const fwd = SHIP3D_TD.fwd, h = shipHdg * D2R;                   // 착함 원 한가운데(함정 가운데에서 30m 뒤)
  S.lat = shipLat + fwd * Math.cos(h) / 111320;
  S.lon = shipLon + fwd * Math.sin(h) / (111320 * Math.cos(shipLat * D2R));
  S.hdg = shipHdg;
  try { simStartGround(); } catch (e) { _swallow(e); }           // 갑판 높이에 세운다(simFloorFt 가 갑판을 본다)
  try { if (typeof _simOnDeck !== 'undefined') _simOnDeck = true; } catch (e) { _swallow(e); }   // 이미 갑판 위 — 함정 속도를 또 얹지 않는다
  try { selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; } catch (e) { _swallow(e); }
  try { updateAcOnMap(); leafMap.setView([S.lat, S.lon]); } catch (e) { _swallow(e); }
  try { const m = document.getElementById('ship-menu'); if (m) m.classList.remove('open'); } catch (e) { _swallow(e); }
  try { uiToast('헬기를 함정 갑판(착함 원)에 앉혔습니다', '', 2500); } catch (e) { _swallow(e); }
}
// 함정이 흔들리는 동안 그 위 헬기가 느끼는 갑판 자세(헬기 기수 기준) — 피치(기수 들림 +) · 뱅크(오른쪽 내림 +)
function shipDeckAttitude(hdg) {
  if (!shipMotionOn()) return { pitch: 0, bank: 0 };
  const m = shipMotion(), rel = normAS(hdg - shipHdg) * D2R;
  return { pitch: m.pitch * Math.cos(rel) - m.roll * Math.sin(rel), bank: m.roll * Math.cos(rel) + m.pitch * Math.sin(rel) };
}
function createShipMarker() {
  shipMarker = L.marker([shipLat, shipLon], { icon: shipIcon(), draggable: true, zIndexOffset: 500 }).addTo(leafMap);
  shipMarker.on('drag', e => { shipLat = e.latlng.lat; shipLon = e.latlng.lng; shipDragging = true; updateShip3d(); });
  shipMarker.on('dragend', () => { shipDragging = false; shipTrail = []; updateShipTrail(); });
  // 배를 두 번 터치(더블탭/더블클릭)하면 속도·방향 설정 창 다시 열기
  let _shipLastTap = 0;
  shipMarker.on('click', e => {
    const t = Date.now();
    if (t - _shipLastTap < 450) { try { L.DomEvent.stop(e); } catch(_) { _swallow(_); } shipUiHome(false); openShipPanel(); _shipLastTap = 0; }
    else { _shipLastTap = t; }
  });
  shipMarker.on('dblclick', e => { try { L.DomEvent.stop(e); } catch(_) { _swallow(_); } shipUiHome(false); openShipPanel(); });
}

function updateShipMarker() {
  updateShip3d();
  if (!shipMarker || shipDragging) return;
  shipMarker.setLatLng([shipLat, shipLon]);
  shipMarker.setIcon(shipIcon());
}

function openShipPanel() {
  shipSetMode(shipInputMode);
  updateShipStatus();
  renderShipOnOff();
  document.getElementById('ship-panel').style.display = 'block';
}

function shipSetMode(mode) {
  shipInputMode = mode; shipInput = '';
  ['SPD','CRS','ROLL','PITCH'].forEach(m => {
    const b = document.getElementById('ship-tab-' + m.toLowerCase());
    if (b) b.classList.toggle('ship-tab-active', m === mode);
  });
  const units = { SPD: 'kt · max 50', CRS: '° · 000–359', ROLL: '° · 롤 max 10', PITCH: '° · 피칭 max 5' };
  document.getElementById('ship-unit').textContent = units[mode];
  updateShipDisplay();
}

function updateShipDisplay() {
  const cur = shipInputMode === 'SPD' ? String(shipSpd) : shipInputMode === 'ROLL' ? String(shipRollAmp)
            : shipInputMode === 'PITCH' ? String(shipPitchAmp) : fmtA(toMag(shipHdg));
  document.getElementById('ship-display').textContent = shipInput || cur;
}

function updateShipStatus() {
  document.getElementById('ship-stat-spd').textContent = shipSpd + 'kt' + (shipVar ? ` (${shipSpdNow().toFixed(1)})` : '');
  document.getElementById('ship-stat-crs').textContent = fmtA(toMag(shipHdg)) + '°';
  const mo = document.getElementById('ship-stat-mot');
  if (mo) mo.textContent = `±${shipRollAmp}° / ±${shipPitchAmp}°`;
  document.querySelectorAll('.ship-lvl').forEach(b => b.classList.toggle('ship-tab-active', b.dataset.lvl === shipLvl));
}

function shipKey(k) {
  if (k === 'CLR') { shipInput = shipInput.slice(0, -1); updateShipDisplay(); return; }
  if (k === 'ENT') {
    const v = parseInt(shipInput, 10);
    if (!isNaN(v)) {
      if (shipInputMode === 'SPD')      shipSpd = Math.min(50, Math.max(0, v));
      else if (shipInputMode === 'ROLL' || shipInputMode === 'PITCH') {
        if (shipInputMode === 'ROLL') shipRollAmp = Math.min(SHIP_ROLL_MAX, Math.max(0, v));
        else shipPitchAmp = Math.min(SHIP_PITCH_MAX, Math.max(0, v));
        try { localStorage.setItem('shipMotion', JSON.stringify({ r: shipRollAmp, p: shipPitchAmp })); } catch (e) { _swallow(e); }
        try { updateShip3d(); } catch (e) { _swallow(e); }
      }
      else if (shipInputMode === 'CRS') {
        const was = shipHdg;
        shipHdg = toTrue(v);                         // 입력은 자북 → 내부는 진북
        _shipCarryTurn(normAS(shipHdg - was));
      }
    }
    shipInput = '';
    updateShipDisplay();
    updateShipStatus();
    updateShipMarker();
    return;
  }
  if (shipInput.length < 5) { shipInput += k; updateShipDisplay(); }
}

// Ship panel drag
// 패널 헤더를 잡아 끌어 옮기는 공용 헬퍼 (SHIP·WX 패널이 같은 코드를 각자 갖고 있던 것을 통합)
function makePanelDraggable(panelId, headerId) {
  const panel = document.getElementById(panelId);
  const hdr   = document.getElementById(headerId);
  if (!panel || !hdr) return;
  let sx, sy, sl, st;
  const onMM = e => { panel.style.left=(sl+e.clientX-sx)+'px'; panel.style.top=(st+e.clientY-sy)+'px'; };
  const onTM = e => { panel.style.left=(sl+e.touches[0].clientX-sx)+'px'; panel.style.top=(st+e.touches[0].clientY-sy)+'px'; };
  function stopD() {
    document.removeEventListener('mousemove',onMM);
    document.removeEventListener('mouseup',stopD);
    document.removeEventListener('touchmove',onTM);
    document.removeEventListener('touchend',stopD);
    hdr.style.cursor='grab';
  }
  function startD(cx,cy) {
    const r=panel.getBoundingClientRect();
    sx=cx; sy=cy; sl=r.left; st=r.top;
    panel.style.left=sl+'px'; panel.style.top=st+'px';
    panel.style.right='auto'; panel.style.bottom='auto';
    hdr.style.cursor='grabbing';
    document.addEventListener('mousemove',onMM);
    document.addEventListener('mouseup',stopD);
    document.addEventListener('touchmove',onTM,{passive:true});
    document.addEventListener('touchend',stopD);
  }
  hdr.addEventListener('mousedown', e=>{e.preventDefault();startD(e.clientX,e.clientY);});
  hdr.addEventListener('touchstart', e=>startD(e.touches[0].clientX,e.touches[0].clientY),{passive:true});
}
makePanelDraggable('ship-panel', 'ship-panel-header');

// Ship marker tap on touch (Leaflet drag handler blocks touch→click on draggable markers)
(function() {
  let _tx = 0, _ty = 0;
  const mc = document.getElementById('map');
  mc.addEventListener('touchstart', function(e) {
    _tx = e.touches[0].clientX;
    _ty = e.touches[0].clientY;
  }, {passive: true, capture: true});
  mc.addEventListener('touchend', function(e) {
    if (!shipVisible || !shipMarker) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - _tx, dy = t.clientY - _ty;
    if (dx * dx + dy * dy > 100) return; // moved >10px = drag, skip
    const rect = mc.getBoundingClientRect();
    const cx = t.clientX - rect.left;
    const cy = t.clientY - rect.top;
    const mp = leafMap.latLngToContainerPoint(shipMarker.getLatLng());
    if ((cx - mp.x) * (cx - mp.x) + (cy - mp.y) * (cy - mp.y) < 900) {
      shipUiHome(false); openShipPanel(); // tapped within 30px of marker center
    }
  }, {passive: true, capture: true});
})();

// ── 3D 지도의 함정 ──
// 지도의 함정 모양(shipIcon 의 SVG)을 실제 크기 — 길이 100m · 폭 25m — 로 키워
// 3D 지도에 세운다. 선체·함교·함수 구조물은 높이만 달리해 세우고(fill-extrusion),
// 갑판 위에는 아이콘처럼 점선 중심선을 둔다. 위치·침로·속도는 2D 와 같은 값
// (shipLat · shipLon · shipHdg · shipSpd)을 쓰므로 어느 쪽에서 바꿔도 함께 움직인다.
// 3D 에서도 끌어 옮기고, 두 번 누르면 설정창이 열린다(2D 와 같다).
const SHIP3D_LEN = 100, SHIP3D_BEAM = 25;   // m
const SHIP3D_DECK = 7;                      // 갑판 높이(수면 위 m)
const SHIP3D_BOOT = 1.2;                    // 붉은 선저(흘수선 아래로 보이는 몫)의 높이(m)
// 해경 3016함 도면의 색 — 흰 선체 · 붉은 선저 · 초록 갑판 · 빨강·노랑·파랑 띠 · 파란 상부 띠
const SHIP3D_C = { hull: '#f2f3f4', bridge: '#fafafa', bow: '#e3e5e7', boot: '#7b1e1e', deck: '#2f7d4a',
  red: '#d42a2a', yellow: '#f2c200', blue: '#1f3f9a', band: '#23418f', mast: '#b9bec3', radome: '#ffffff',
  funnel: '#d0d3d6', black: '#1a1a1a', boat: '#e8552b', gun: '#8a8f94' };
// 아이콘 좌표(24×40, 가운데 12·20) → 함정 좌표(m) [오른쪽 +, 함미 쪽 +]
const _ship3dM = ([x, y]) => [(x - 12) * SHIP3D_BEAM / 18, (y - 20) * SHIP3D_LEN / 38];
function _ship3dQuad(out, p0, c, p1, n) {   // 2차 베지어(Q)를 점으로 펼친다
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
}
// ── 비행갑판 표시(함교 뒤 갑판) ──
//   · 노란 정렬선 — 함교 뒷면 한가운데를 위에서 아래로, 이어서 갑판 중심선을 함미까지
//   · 착함 원(흰색)과 그 안의 X
//   · 어깨선(흰색) — 원 앞쪽에 원과 맞닿게 가로로. 헬기에 앉은 조종사의 어깨 자리다
//   · 전방한계선(흰색) — 어깨선 2m 앞을 가로로
// 모두 갑판에 칠한 것이라 갑판 위로 5cm 만 나온다(착함 바닥은 갑판 그대로).
// 단위 m. 여기서만 [오른쪽 +, 앞 +] 로 그리고(반시계가 바깥 고리) 함정 좌표로 바꾼다.
const SHIP3D_DECK_LEN = 40;                                // 비행갑판 길이(함교 뒷면 → 함미)
const SHIP3D_BRIDGE_AFT = -SHIP3D_LEN / 2 + SHIP3D_DECK_LEN; // 함교 뒷면(가운데에서 10m 뒤)
const SHIP3D_BRIDGE_Y = 20 - SHIP3D_BRIDGE_AFT * 38 / SHIP3D_LEN - 10;   // 아이콘 좌표의 함교 윗변(13.8)
const SHIP3D_TD = { fwd: (SHIP3D_BRIDGE_AFT - SHIP3D_LEN / 2) / 2, r: 5, w: 0.6 };   // 착함 원 — 갑판 한가운데(30m 뒤)
const SHIP3D_SHOULDER = SHIP3D_TD.fwd + SHIP3D_TD.r + 0.2;  // 어깨선(굵기 0.4m) 가운데
const SHIP3D_FWD_LIMIT = SHIP3D_SHOULDER + 2;              // 전방한계선 — 어깨선 2m 앞
const SHIP3D_DECK_MARKS = (() => {
  const paint = SHIP3D_DECK + 0.05;
  const YEL = '#ffd200', WHT = '#ffffff';
  const rect = (x, f, hw, hl) =>
    [[x - hw, f - hl], [x + hw, f - hl], [x + hw, f + hl], [x - hw, f + hl], [x - hw, f - hl]];
  const bar = (x, f, deg, hl, hw) => {        // 기울어진 막대(X 의 한 획)
    const a = deg * D2R, u = [Math.cos(a), Math.sin(a)], v = [-Math.sin(a), Math.cos(a)];
    const p = (s, t) => [x + u[0] * s + v[0] * t, f + u[1] * s + v[1] * t];
    return [p(-hl, -hw), p(hl, -hw), p(hl, hw), p(-hl, hw), p(-hl, -hw)];
  };
  const circle = (x, f, r, ccw) => {
    const out = [];
    for (let i = 0; i <= 48; i++) {
      const a = (ccw ? i : -i) / 48 * 2 * Math.PI;
      out.push([x + r * Math.cos(a), f + r * Math.sin(a)]);
    }
    return out;
  };
  const toShip = ring => ring && ring.map(([x, f]) => [x, -f]);
  const td = SHIP3D_TD;
  const stern = -(39 - 20) * SHIP3D_LEN / 38 + 1.3;          // 함미 끝 조금 안쪽
  return [
    // 노란 정렬선 — 갑판 중심선(함교 뒷면 → 함미), 함교 뒷면의 세로선(갑판 → 함교 꼭대기)
    { ring: rect(0, (SHIP3D_BRIDGE_AFT + stern) / 2, 0.15, (SHIP3D_BRIDGE_AFT - stern) / 2),
      h: paint, c: YEL, k: 'lineup' },
    // 함교 뒷면에 붙은 세로선 — 갑판에서 함교 꼭대기까지(뒷면보다 20cm 나와 파란 띠 위로도 보인다)
    { ring: rect(0, SHIP3D_BRIDGE_AFT - 0.1, 0.3, 0.1), b: SHIP3D_DECK, h: SHIP3D_DECK + 10, c: YEL, k: 'lineup-wall' },
    // 착함 원과 X
    { ring: circle(0, td.fwd, td.r, true), hole: circle(0, td.fwd, td.r - td.w, false),
      h: paint, c: WHT, k: 'td' },
    { ring: bar(0, td.fwd, 45, 2.5, 0.2),  h: paint, c: WHT, k: 'x' },
    { ring: bar(0, td.fwd, -45, 2.5, 0.2), h: paint, c: WHT, k: 'x' },
    // 어깨선 — 원 앞쪽에 맞닿게, 전방한계선 — 그 2m 앞
    { ring: rect(0, SHIP3D_SHOULDER, td.r, 0.2), h: paint, c: WHT, k: 'shoulder' },
    { ring: rect(0, SHIP3D_FWD_LIMIT, 11, 0.2),  h: paint, c: WHT, k: 'limit' },
  ].map(p => ({ ...p, ring: toShip(p.ring), hole: toShip(p.hole), line: true }));
})();
const SHIP3D_PARTS = (() => {
  // 선체 — M12 1 Q20 7 21 17 L21 33 Q21 39 12 39 Q3 39 3 33 L3 17 Q4 7 12 1Z
  const hull = [[12, 1]];
  _ship3dQuad(hull, [12, 1], [20, 7], [21, 17], 10);
  hull.push([21, 33]);
  _ship3dQuad(hull, [21, 33], [21, 39], [12, 39], 6);
  _ship3dQuad(hull, [12, 39], [3, 39], [3, 33], 6);
  hull.push([3, 17]);
  _ship3dQuad(hull, [3, 17], [4, 7], [12, 1], 10);
  // 함교 — rect x8 y13.8 w8 h10 rx2 (모서리를 둥글게). 뒷면을 함미에서 40m 에 두어
  // 함교 뒤 비행갑판이 40m 가 되게 한다(SHIP3D_BRIDGE_AFT).
  const bridge = [], by = SHIP3D_BRIDGE_Y;
  [[10, by + 2, 180], [14, by + 2, 270], [14, by + 8, 0], [10, by + 8, 90]].forEach(([cx, cy, a0]) => {
    for (let i = 0; i <= 4; i++) {
      const a = (a0 + i * 22.5) * D2R;
      bridge.push([cx + 2 * Math.cos(a), cy + 2 * Math.sin(a)]);
    }
  });
  bridge.push(bridge[0]);
  // 함수 구조물 — circle cx12 cy5 r2.5
  const bow = [];
  for (let i = 0; i <= 16; i++) { const a = i / 16 * 2 * Math.PI; bow.push([12 + 2.5 * Math.cos(a), 5 + 2.5 * Math.sin(a)]); }
  const parts = [
    { ring: hull,   h: SHIP3D_DECK,      b: SHIP3D_BOOT, c: SHIP3D_C.hull, k: 'hull' },
    { ring: bridge, h: SHIP3D_DECK + 10, c: SHIP3D_C.bridge, k: 'bridge' },
    { ring: bow,    h: SHIP3D_DECK + 3,  c: SHIP3D_C.bow, k: 'bow' },
  ];
  // 중심선 — x=12, 점선(2 칸 긋고 3 칸 띄움), 굵기 0.5. 갑판 위로 살짝(5cm)만 나온다.
  // 함교 앞쪽만 둔다 — 함교 뒤 비행갑판에는 노란 정렬선이 있다.
  for (let y = 1; y + 2 < SHIP3D_BRIDGE_Y; y += 5) {
    parts.push({ ring: [[11.75, y], [12.25, y], [12.25, y + 2], [11.75, y + 2], [11.75, y]],
                 h: SHIP3D_DECK + 0.05, c: '#e8e8e8', k: 'dash', line: true });
  }
  // 아이콘은 화면 좌표(아래가 +)라 돌림 방향이 지도와 반대다 — 바깥 고리를 반시계로 맞춘다
  parts.forEach(p => { p.ring = p.ring.map(_ship3dM).reverse(); });
  // ── 꾸밈(해경 3016함 도면) — 부딪힘·착함 바닥에는 쓰지 않는다(deco) ──
  const hullM = parts[0].ring;
  const scaled = (k, kx, ky) => hullM.map(([x, y]) => [x * kx, y * ky]);
  const rect = (x, f, hw, hl) => [[x - hw, -(f - hl)], [x + hw, -(f - hl)], [x + hw, -(f + hl)], [x - hw, -(f + hl)], [x - hw, -(f - hl)]];
  const circ = (x, f, rr) => { const o = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * 2 * Math.PI; o.push([x + rr * Math.cos(a), -(f + rr * Math.sin(a))]); } return o; };
  const deco = (ring, b, h, c, k) => ({ ring, b, h, c, k: k || 'deco', deco: true });
  const C = SHIP3D_C;
  const decoParts = [
    deco(hullM, 0, SHIP3D_BOOT, C.boot, 'boot'),                         // 흘수선 아래 붉은 선저
    deco(scaled(0, 0.96, 0.985), SHIP3D_DECK, SHIP3D_DECK + 0.03, C.deck, 'deck'),   // 초록 갑판
    // 함수 쪽 선체의 빨강·노랑·파랑 띠(좌·우현)
    ...[[C.red, 1.6], [C.yellow, 2.8], [C.blue, 4.0]].flatMap(([c, f]) => [
      deco(rect(12.55, f + 0.6, 0.12, 0.6), SHIP3D_BOOT, SHIP3D_DECK - 0.3, c, 'stripe'),
      deco(rect(-12.55, f + 0.6, 0.12, 0.6), SHIP3D_BOOT, SHIP3D_DECK - 0.3, c, 'stripe')]),
    // 상부 구조물 윗단의 파란 띠
    deco(rect(0, 3.15, 5.75, 13.3), SHIP3D_DECK + 8.4, SHIP3D_DECK + 9.4, C.band, 'band'),
    // 마스트 · 가로대 · 레이돔
    deco(rect(0, 8, 0.45, 0.45), SHIP3D_DECK + 10, SHIP3D_DECK + 24, C.mast, 'mast'),
    deco(rect(0, 8, 3.2, 0.2), SHIP3D_DECK + 20, SHIP3D_DECK + 20.4, C.mast, 'mast'),
    deco(circ(0, 12, 1.3), SHIP3D_DECK + 10, SHIP3D_DECK + 12.6, C.radome, 'radome'),
    deco(circ(3.2, 2, 1), SHIP3D_DECK + 10, SHIP3D_DECK + 12, C.radome, 'radome'),
    deco(circ(-3.2, 2, 1), SHIP3D_DECK + 10, SHIP3D_DECK + 12, C.radome, 'radome'),
    // 연돌(검은 배기구)
    deco(circ(0, -5.5, 2.2), SHIP3D_DECK + 10, SHIP3D_DECK + 13.5, C.funnel, 'funnel'),
    deco(circ(0, -5.5, 1.4), SHIP3D_DECK + 13.5, SHIP3D_DECK + 13.8, C.black, 'funnel'),
    // 구명정(주황) — 상부 구조물 좌·우현
    deco(rect(6.7, -5.5, 1.1, 3.6), SHIP3D_DECK + 4, SHIP3D_DECK + 6, C.boat, 'boat'),
    deco(rect(-6.7, -5.5, 1.1, 3.6), SHIP3D_DECK + 4, SHIP3D_DECK + 6, C.boat, 'boat'),
    // 함포 포신
    deco(rect(0, 44, 0.25, 2.6), SHIP3D_DECK + 2.2, SHIP3D_DECK + 2.6, C.gun, 'gun'),
  ];
  return parts.concat(decoParts, SHIP3D_DECK_MARKS);
})();
// 함정 좌표(m) → 경위도. 함수(앞)가 침로를 향한다.
function _ship3dLngLat([xr, ya]) {
  const h = shipHdg * D2R, sh = Math.sin(h), ch = Math.cos(h);
  const east = -ya * sh + xr * ch, north = -ya * ch - xr * sh;
  return [shipLon + east / (111320 * Math.cos(shipLat * D2R)), shipLat + north / 111320];
}
// 지도 데이터(채움 돌출) — 함정을 누르고 끌기(이벤트)·CHIN 창·검사가 쓴다. 눈에 보이는 함정은
// 아래 _ship3dLayer(진짜 3D 모형 — 롤·피칭을 회전으로 기울인다)가 그린다.
function _ship3dGeo() {
  if (!shipVisible || shipLat === null) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: SHIP3D_PARTS.map(p => ({
      type: 'Feature', properties: { h: p.h, b: p.b || 0, c: p.c, k: p.k },
      geometry: { type: 'Polygon',
                  coordinates: [p.ring.map(_ship3dLngLat)].concat(p.hole ? [p.hole.map(_ship3dLngLat)] : []) },
    })),
  };
}
// ── 함정 3D 모형(WebGL) ──
// 지도 돌출(fill-extrusion)은 기울일 수 없어 롤·피칭을 칸으로 잘라 계단처럼 보였다. 같은 부분들(SHIP3D_PARTS)을
// 한 번 입체로 지어 두고(위면 · 옆면), 흰수리 모형과 같은 그리기(15-heli3d.js)로 함정 자리 · 침로 · 롤 · 피칭만큼
// 돌려 그린다 — 매끈하게 기울고, 매 프레임 지을 것도 없다.
function _shipHexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function _ship3dBuildMesh() {
  const m = [];
  // 함정 좌표(오른쪽 · 함미) → 모형(앞 X · 오른쪽 Y · 위 Z). 원점은 함정 가운데 '갑판 높이' — 롤·피칭의 축이다
  // (갑판 위 점이 옆으로 밀리지 않아 앉은 헬기와 어긋나지 않는다).
  const M = ([x, y], z) => [-y, x, z - SHIP3D_DECK];
  const put = (p, n, c) => m.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], 0);
  const tri = (a, b, c, n, col) => { put(a, n, col); put(b, n, col); put(c, n, col); };
  SHIP3D_PARTS.forEach(p => {
    const col = _shipHexRgb(p.c);
    // 위면이 서로 겹치는 칠(갑판 · 표시)은 조금씩 띄워 깜빡이지 않게
    let top = p.h; const lift = p.line ? 0.10 : p.k === 'deck' ? 0.05 : 0;
    top += lift;
    const bot = p.b != null ? p.b : p.line ? top - 0.06 : 0;   // 세로로 선 표시(함교 뒷면 선)는 제 바닥부터
    const ring = p.ring.slice(0, -1);
    const n = ring.length;
    let cx = 0, cy = 0; ring.forEach(q => { cx += q[0]; cy += q[1]; }); cx /= n; cy /= n;
    // 옆면
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const A0 = M(a, bot), B0 = M(b, bot), A1 = M(a, top), B1 = M(b, top);
      let nx = B0[1] - A0[1], ny = -(B0[0] - A0[0]);                // 모형 평면에서 변에 수직
      const mx = (A0[0] + B0[0]) / 2 - (-cy), my = (A0[1] + B0[1]) / 2 - cx;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }             // 바깥쪽으로
      const l = Math.hypot(nx, ny) || 1, N = [nx / l, ny / l, 0];
      tri(A0, B0, B1, N, col); tri(A0, B1, A1, N, col);
    }
    // 위면 — 구멍이 있으면(착함 원) 고리, 없으면 가운데서 부채꼴(모두 볼록한 꼴이다)
    const up = [0, 0, 1];
    if (p.hole) {
      const ho = p.hole.slice(0, -1), k = ho.length;
      for (let i = 0; i < n; i++) {
        const o0 = ring[i], o1 = ring[(i + 1) % n];
        const h0 = ho[(k - i) % k], h1 = ho[(k - i - 1 + k) % k];
        tri(M(o0, top), M(o1, top), M(h1, top), up, col); tri(M(o0, top), M(h1, top), M(h0, top), up, col);
      }
    } else {
      const C = M([cx, cy], top);
      for (let i = 0; i < n; i++) tri(C, M(ring[i], top), M(ring[(i + 1) % n], top), up, col);
    }
  });
  return m;
}
// ── 수평 지시등(HRS · Horizon Reference System) ──
// 함교 뒷면 파란 띠 위에 전구 20개를 가로로 늘어놓은 막대. 안정화되어 함정이 롤을 해도 늘 참 수평을
// 가리킨다 — 헬기에서 보면 막대와 함정(갑판·함교)이 어긋나는 만큼이 롤이다. 스스로 빛난다(재질 −1).
const SHIP_HRS_N = 20, SHIP_HRS_PITCH = 0.5;                       // 전구 개수 · 간격(m)
const SHIP_HRS_AT = [0, -SHIP3D_BRIDGE_AFT + 0.35, SHIP3D_DECK + 8.9];   // 막대 가운데(함정 좌표 x · y(함미 +) · 높이)
function _shipBox(m, c, sz, col, mat) {
  const [cx, cy, cz] = c, [hx, hy, hz] = sz.map(v => v / 2);
  const P = (i, j, k) => [cx + i * hx, cy + j * hy, cz + k * hz];
  const face = (n, a, b, cc, d) => [[a, b, cc], [a, cc, d]].forEach(t => t.forEach(p => m.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], mat)));
  face([1, 0, 0], P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1));
  face([-1, 0, 0], P(-1, 1, -1), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1));
  face([0, 1, 0], P(1, 1, -1), P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1));
  face([0, -1, 0], P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1));
  face([0, 0, 1], P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1));
  face([0, 0, -1], P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1));
}
// 막대 모형 — 원점이 막대 가운데, 모형 축(앞 X · 오른쪽 Y · 위 Z). 전구는 뒤(−X, 헬기 쪽)를 본다.
function _shipHrsMesh() {
  const m = [], span = (SHIP_HRS_N - 1) * SHIP_HRS_PITCH;
  _shipBox(m, [0.05, 0, 0], [0.2, span + 0.6, 0.55], [0.08, 0.08, 0.09], 0);               // 검은 받침
  for (let i = 0; i < SHIP_HRS_N; i++)
    _shipBox(m, [-0.12, -span / 2 + i * SHIP_HRS_PITCH, 0], [0.16, 0.3, 0.3], [0.35, 1.0, 0.45], -1);   // 초록 전구
  return m;
}
const _shipGL = new WeakMap();      // 지도(그림판)마다 그리기 준비 — 본 3D 화면 · CHIN 창
function _shipGLInit(gl) {
  let h = _shipGL.get(gl);
  if (h) return h;
  const prog = gl.createProgram();
  gl.attachShader(prog, _h3Shader(gl, gl.VERTEX_SHADER, H3_VS));
  gl.attachShader(prog, _h3Shader(gl, gl.FRAGMENT_SHADER, H3_FS));
  gl.linkProgram(prog);
  const loc = {
    pos: gl.getAttribLocation(prog, 'a_pos'), nrm: gl.getAttribLocation(prog, 'a_nrm'),
    col: gl.getAttribLocation(prog, 'a_col'), mat: gl.getAttribLocation(prog, 'a_mat'),
    mvp: gl.getUniformLocation(prog, 'u_mvp'), rot: gl.getUniformLocation(prog, 'u_rot'),
    light: gl.getUniformLocation(prog, 'u_light'), alpha: gl.getUniformLocation(prog, 'u_alpha'),
  };
  let vao = null;
  if (typeof gl.createVertexArray === 'function') vao = { create: () => gl.createVertexArray(), bind: v => gl.bindVertexArray(v) };
  else { const ext = gl.getExtension('OES_vertex_array_object'); if (ext) vao = { create: () => ext.createVertexArrayOES(), bind: v => ext.bindVertexArrayOES(v) }; }
  const up = arr => {
    const part = _h3Upload(gl, arr);
    if (vao) {
      part.vao = vao.create(); vao.bind(part.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.buf);
      [[loc.pos, 3, 0], [loc.nrm, 3, 12], [loc.col, 3, 24], [loc.mat, 1, 36]].forEach(([l, n, o]) => {
        if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 40, o);
      });
      vao.bind(null);
    }
    return part;
  };
  h = { gl, prog, loc, vao, part: up(_ship3dBuildMesh()), hrs: up(_shipHrsMesh()) };
  _shipGL.set(gl, h);
  return h;
}
function _ship3dLayer() {
  return {
    id: 'ship-3d-model', type: 'custom', renderingMode: '3d',
    onAdd(map) { this.map = map; },
    render(gl, args) {
      if (!shipVisible || shipLat === null) return;
      let h;
      try { h = _shipGLInit(gl); } catch (e) { _swallow(e); return; }
      const main = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix)
                || (args && args.modelViewProjectionMatrix) || args;
      if (!main || main.length !== 16) return;
      let sea = 0;
      try { const z = this.map.queryTerrainElevation([shipLon, shipLat]); if (Number.isFinite(z)) sea = z; } catch (e) { _swallow(e); }
      const mo = shipMotionOn() ? shipMotion() : { roll: 0, pitch: 0 };
      const mc = maplibregl.MercatorCoordinate.fromLngLat([shipLon, shipLat], sea + SHIP3D_DECK);   // 축 = 갑판 높이
      const sc = mc.meterInMercatorCoordinateUnits(), Sc = [[sc, 0, 0], [0, -sc, 0], [0, 0, sc]];
      const R = heli3dRot(shipHdg, mo.pitch, mo.roll);
      const r3 = R => new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
      const SR = _m3Mul(Sc, R);
      gl.useProgram(h.prog);
      gl.uniform3fv(h.loc.light, H3_LIGHT);
      _h3Draw(h, h.part, new Float32Array(_m4Mul(main, _m4From(SR, [mc.x, mc.y, mc.z]))), r3(R), 1);
      // 수평 지시등 — 자리는 함정을 따라가고(함교 뒷면), 기울기는 롤을 빼고(참 수평) 그린다
      const a = [-SHIP_HRS_AT[1], SHIP_HRS_AT[0], SHIP_HRS_AT[2] - SHIP3D_DECK];
      const t = [0, 1, 2].map(i => [mc.x, mc.y, mc.z][i] + SR[i][0] * a[0] + SR[i][1] * a[1] + SR[i][2] * a[2]);
      const Rh = heli3dRot(shipHdg, mo.pitch, 0);
      _h3Draw(h, h.hrs, new Float32Array(_m4Mul(main, _m4From(_m3Mul(Sc, Rh), t))), r3(Rh), 1);
    },
  };
}
// 그 자리 바로 아래에 있는 함정 부분의 윗면 높이(m, 수면 위) — 갑판 7m · 함수
// 구조물 10m · 함교 17m. 함정 밖이면 null. 착함(14-simmode.js)이 이것을 바닥으로 쓴다.
function shipDeckTopM(lat, lon) {
  if (!shipVisible || shipLat === null) return null;
  const n = (lat - shipLat) * 111320, e = (lon - shipLon) * 111320 * Math.cos(shipLat * D2R);
  if (n * n + e * e > 60 * 60) return null;            // 함정(반 길이 50m)에서 멀다
  const h = shipHdg * D2R;
  const x = e * Math.cos(h) - n * Math.sin(h);           // 오른쪽 +
  const y = -(n * Math.cos(h) + e * Math.sin(h));        // 함미 쪽 +
  const inside = ring => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  let top = null;
  SHIP3D_PARTS.forEach(p => {
    if (p.line || p.deco || !inside(p.ring)) return;    // 중심선·비행갑판 표시·꾸밈은 바닥이 아니다
    if (top === null || p.h > top) top = p.h;
  });
  return top === null ? null : top + shipHeaveAt(x, y, top);   // 롤·피칭으로 오르내린 만큼
}
// 함정이 침로를 바꾸면 갑판에 앉아 있는 헬기도 함정 중심을 축으로 같이 돈다
function _shipCarryTurn(d) {
  if (!d || typeof simOnDeck !== 'function' || !simOnDeck()) return;
  const n = (S.lat - shipLat) * 111320, e = (S.lon - shipLon) * 111320 * Math.cos(shipLat * D2R);
  const r = d * D2R;
  const n2 = n * Math.cos(r) - e * Math.sin(r), e2 = n * Math.sin(r) + e * Math.cos(r);
  S.lat = shipLat + n2 / 111320;
  S.lon = shipLon + e2 / (111320 * Math.cos(shipLat * D2R));
  S.hdg = normA(S.hdg + d);
  try { updateAcOnMap(); } catch (e) { _swallow(e); }
}
let _ship3dReady = false;
// 함정·항적 레이어를 한 지도에 얹는다 — 3D 본 화면과 CHIN 창(04-map.js)이 같이 쓴다
function _ship3dAddTo(map) {
  map.addSource('ship-trail-3d', { type: 'geojson', data: _ship3dTrailGeo() });
  map.addLayer({ id: 'ship-trail-3d', type: 'line', source: 'ship-trail-3d',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ff3333', 'line-width': 2, 'line-opacity': 0.75 } });
  map.addSource('ship-3d', { type: 'geojson', data: _ship3dGeo() });
  // 채움 돌출은 보이지 않게(누르기·끌기에만) 두고, 눈에 보이는 함정은 3D 모형이 그린다
  map.addLayer({ id: 'ship-3d', type: 'fill-extrusion', source: 'ship-3d',
    paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-height': ['get', 'h'],
             'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-opacity': 0 } });
  try { map.addLayer(_ship3dLayer()); } catch (e) { console.warn('[3D] ship model:', e); }
}
// 3D 지도가 다 뜨면(04-map.js 의 load) 함정·항적 레이어를 한 번 얹는다
function _ship3dEnsure() {
  if (!_ml3d || _ship3dReady) return;
  _ship3dAddTo(_ml3d);
  _ship3dReady = true;
  _ship3dBindEvents();
  updateShip3d();
  updateShip3dTrail();
}
// 함정 레이어가 얹힌 지도들 — 3D 본 화면 + 열려 있는 CHIN 창
function _ship3dMaps() {
  const a = (_ml3d && _ship3dReady) ? [_ml3d] : [];
  return a;
}
function _ship3dTrailGeo() {
  return { type: 'Feature', geometry: { type: 'LineString',
    coordinates: (shipVisible ? shipTrail : []).map(t => [t[1], t[0]]) } };
}
function updateShip3d() {
  const maps = _ship3dMaps();
  if (!maps.length) return;
  const geo = _ship3dGeo();
  maps.forEach(m => { const src = m.getSource('ship-3d'); if (src) src.setData(geo); });
}
function updateShip3dTrail() {
  const maps = _ship3dMaps();
  if (!maps.length) return;
  const geo = _ship3dTrailGeo();
  maps.forEach(m => { const src = m.getSource('ship-trail-3d'); if (src) src.setData(geo); });
}
// 3D 에서 함정을 누르고 끌면 옮기고, 두 번 누르면 설정창을 연다(2D 마커와 같다)
function _ship3dBindEvents() {
  let lastTap = 0, grab = null;
  const open = e => {
    try { e.preventDefault(); } catch (_) { _swallow(_); }
    shipUiHome(typeof map3dPanelOn === 'function' && map3dPanelOn());
    openShipPanel();
  };
  _ml3d.on('dblclick', 'ship-3d', open);
  _ml3d.on('click', 'ship-3d', e => {
    const t = Date.now();
    if (t - lastTap < 450) { open(e); lastTap = 0; } else lastTap = t;
  });
  // 끄는 동안은 창 전체에서 듣는다 — 커서가 설정창 같은 다른 창 위로 지나가도
  // 놓치지 않게(지도 이벤트로만 들으면 그 순간부터 끌기가 멈춘다)
  const move = ev => {
    const pt = ev.touches ? ev.touches[0] : ev;
    if (!grab || !pt) return;
    const r = _ml3d.getCanvas().getBoundingClientRect();
    const ll = _ml3d.unproject([pt.clientX - r.left, pt.clientY - r.top]);
    if (!ll) return;
    shipLat = ll.lat + grab.dLat; shipLon = ll.lng + grab.dLon;
    shipDragging = true; grab.moved = true;
    updateShip3d();
    try { if (shipMarker) shipMarker.setLatLng([shipLat, shipLon]); } catch (_) { _swallow(_); }
  };
  const end = () => {
    window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
    ['mouseup', 'touchend', 'touchcancel'].forEach(k => window.removeEventListener(k, end));
    if (grab && grab.moved) { shipTrail = []; updateShipTrail(); }
    grab = null; shipDragging = false;
  };
  const start = e => {
    if (e.points && e.points.length !== 1) return;   // 두 손가락은 지도 확대·회전
    try { e.preventDefault(); } catch (_) { _swallow(_); }   // 지도가 따라 밀리지 않게
    grab = { dLat: shipLat - e.lngLat.lat, dLon: shipLon - e.lngLat.lng, moved: false };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: true });
    ['mouseup', 'touchend', 'touchcancel'].forEach(k => window.addEventListener(k, end));
  };
  _ml3d.on('mousedown', 'ship-3d', start);
  _ml3d.on('touchstart', 'ship-3d', start);
  _ml3d.on('mouseenter', 'ship-3d', () => { _ml3d.getCanvas().style.cursor = 'pointer'; });
  _ml3d.on('mouseleave', 'ship-3d', () => { _ml3d.getCanvas().style.cursor = ''; });
}

// 함정 메뉴·설정창은 하나뿐이다. 3D 가 제 창(탭의 '3D')을 쓰고 있으면 그 창
// 안으로 옮겨 연다 — 2D 지도 창은 그때 화면에 없을 수도 있다.
function shipUiHome(to3d) {
  const host = document.getElementById(to3d ? 'map3d' : 'map-wrap');
  if (!host) return;
  ['ship-menu', 'ship-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== host) host.appendChild(el);
  });
}
function _shipUiIn3d() {
  const m = document.getElementById('ship-menu');
  return !!(m && m.parentElement && m.parentElement.id === 'map3d');
}
// 3D 창의 SHIP 버튼 — 메뉴를 3D 창 안에서 연다
function toggleShip3d() {
  shipUiHome(true);
  const m = document.getElementById('ship-menu');
  m.classList.toggle('open');
  _shipPanelFollowMenu(m);
  renderShipOnOff();
}

// ── METAR / TAF Weather Panel ────────────────────────────────────────────
function openWxPanel() {
  document.getElementById('wx-panel').style.display = 'block';
  document.getElementById('wx-btn').classList.add('wx-active');
}

function closeWxPanel() {
  document.getElementById('wx-panel').style.display = 'none';
  document.getElementById('wx-btn').classList.remove('wx-active');
}

function toggleWxPanel() {
  const panel = document.getElementById('wx-panel');
  if (panel.style.display === 'block') closeWxPanel();
  else openWxPanel();
}

// PP: 현재 항공기 위치를 Flight Plan에 웨이포인트로 추가
function togglePpMenu(force) {
  const m = document.getElementById('pp-menu');
  const open = (force !== undefined) ? force : !m.classList.contains('open');
  m.classList.toggle('open', open);
  if (open) {
    // ＋ 버튼 바로 아래 위치 정렬
    const btn = document.getElementById('pp-btn');
    const bar = document.getElementById('map-top-bar');
    m.style.left = Math.max(4, btn.offsetLeft + bar.offsetLeft - 6) + 'px';
  }
}
// 십자(지도 중앙) 위치에 웨이포인트 추가
function chAddWaypoint() {
  const c = leafMap.getCenter();
  const cnt = S.wps.filter(w => /^WP\d*$/.test(w.ident)).length;
  pushWP({ ident: 'WP' + (cnt + 1), lat: c.lat, lon: c.lng });
  const btn = document.getElementById('pp-btn');
  btn.style.background = 'rgba(0,50,10,0.95)'; btn.style.borderColor = '#00ff88'; btn.style.color = '#00ff88';
  setTimeout(() => { btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; }, 700);
}
function ppAddWaypoint() {
  const ppCount = S.wps.filter(w => /^PP\d*$/.test(w.ident)).length;
  const name = 'PP' + (ppCount + 1);
  pushWP({ ident: name, lat: S.lat, lon: S.lon });
  const btn = document.getElementById('pp-btn');
  btn.style.background = 'rgba(0,50,10,0.95)';
  btn.style.borderColor = '#00ff88';
  btn.style.color = '#00ff88';
  setTimeout(() => {
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }, 700);
}


function setWxIcao(icao, btn) {
  document.getElementById('wx-icao').value = icao;
  document.querySelectorAll('.wx-ap-btn').forEach(b => b.classList.remove('wx-ap-sel'));
  if (btn) btn.classList.add('wx-ap-sel');
}

// ── METAR/TAF fetcher ──
// Strategy: fire all 6 transport options simultaneously and take the FIRST
// valid response (Promise.any). Then cache by URL for 5 min.
// aviationweather.gov blocks some proxies → wider net + JSON wrapper
// (allorigins /get) lets us verify upstream HTTP status to filter HTML errors.

const _wxCache = new Map();
const WX_CACHE_TTL = 10 * 60 * 1000;

// 첫 번째 유효 결과 반환, 3초 초과 시 timeout으로 reject
const raceValid = (promises, guard) => {
  const race = new Promise((resolve, reject) => {
    let pending = promises.length, lastErr = null;
    if (!pending) return reject(new Error('no sources'));
    promises.forEach(p => p
      .then(v => { if (guard(v)) resolve(v); else if (--pending === 0) reject(lastErr || new Error('no valid data')); })
      .catch(e => { lastErr = e; if (--pending === 0) reject(e); })
    );
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
  return Promise.race([race, timeout]);
};

async function _wxGet(url, sig) {
  const c = _wxCache.get(url);
  if (c && Date.now() - c.ts < WX_CACHE_TTL) return c.data;

  const proxies = [
    url, // 직접 시도 (모바일 등 CORS 허용 환경)
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    'https://corsproxy.io/?' + encodeURIComponent(url),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
  ];

  const tryFetch = async (u) => {
    const r = await fetch(u, { signal: sig });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = (await r.text()).trim();
    if (body.startsWith('<')) throw new Error('html');
    if (!body) throw new Error('empty');
    return body;
  };

  const body = await Promise.race([
    Promise.any(proxies.map(u => tryFetch(u))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
  ]);

  if (body) _wxCache.set(url, { data: body, ts: Date.now() });
  return body;
}

function _ivaoMetar(icao, sig) {
  return _wxGet(`https://metar.ivao.aero/${icao}`, sig);
}
function _vatsimMetar(icao, sig) {
  return _wxGet(`https://metar.vatsim.net/metar.php?id=${icao}`, sig);
}

async function _metarTafScrape(icao, sig) {
  const target = `https://metar-taf.com/metar/${icao}`;
  const proxies = [
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(target),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(target),
    'https://corsproxy.io/?' + encodeURIComponent(target),
  ];
  const re = new RegExp(icao + '\\s+\\d{6}Z\\b[^<\\n]*', 'i');
  return Promise.any(proxies.map(async px => {
    const r = await fetch(px, { signal: sig });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const m = html.match(re);
    if (!m) throw new Error('no match');
    const txt = m[0].replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (txt.length < 8) throw new Error('too short');
    return txt;
  }));
}

async function fetchWx(type) {
  const icao = (document.getElementById('wx-icao').value || '').trim().toUpperCase();
  if (icao.length < 3) {
    const r = document.getElementById('wx-result');
    r.style.display = 'block';
    r.innerHTML = '<span style="color:#ff8800;">ICAO 코드를 입력하거나 선택하세요</span>';
    return;
  }
  const resultEl = document.getElementById('wx-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `<span style="color:#446644;">🔄 ${icao} ${type} 조회 중…</span>`;

  const ctl = new AbortController();
  const sig = ctl.signal;
  const AMO_LINK = `<a href="https://global.amo.go.kr/observation/metar.do" target="_blank" style="color:#66aaff;">AMO METAR 조회</a>`;

  try {
    if (type === 'METAR') {
      let raw = '';
      try {
        raw = await raceValid(
          [_ivaoMetar(icao, sig), _vatsimMetar(icao, sig), _metarTafScrape(icao, sig)],
          v => typeof v === 'string' && v.length >= 8 && v.toUpperCase().includes(icao)
        );
      } catch { raw = ''; }

      if (raw.length < 8) {
        resultEl.innerHTML = `<span style="color:#ff8800;">${icao}: METAR 없음</span> — ${AMO_LINK}`;
        return;
      }
      renderWxMetar(raw, resultEl, icao);

    } else {
      let rawTaf = '';
      try {
        const awUrl = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao)}&format=json`;
        const noaaUrl = `https://tgftp.weather.gov/data/forecasts/taf/stations/${icao}.TXT`;
        const proxies = [
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(awUrl),
          'https://corsproxy.io/?' + encodeURIComponent(awUrl),
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(noaaUrl),
          'https://corsproxy.io/?' + encodeURIComponent(noaaUrl),
        ];
        const fetchTaf = async (url) => {
          const r = await fetch(url, { signal: sig });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const body = (await r.text()).trim();
          // JSON 응답 (aviationweather)
          if (body.startsWith('[') || body.startsWith('{')) {
            let data; try { data = JSON.parse(body); } catch { throw new Error('parse'); }
            const t = (data?.[0]?.rawTAF || data?.[0]?.rawTaf || data?.[0]?.taf || '').trim();
            if (t.length >= 10) return t;
            throw new Error('empty');
          }
          // 평문 TAF (NOAA tgftp) — 첫 줄 타임스탬프 제거
          const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
          const t = (lines.length > 1 ? lines.slice(1).join(' ') : lines[0] || '').trim();
          if (t.length >= 10) return t;
          throw new Error('empty');
        };
        rawTaf = await Promise.race([
          Promise.any(proxies.map(u => fetchTaf(u))),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]);
      } catch { rawTaf = ''; }

      if (!rawTaf) { resultEl.innerHTML = `<span style="color:#ff8800;">${icao}: TAF 없음</span>`; return; }
      renderWxTaf(rawTaf, resultEl, icao);
    }
  } catch (e) {
    resultEl.innerHTML = `<span style="color:#ff8800;">${icao}: 조회 실패</span> — ${AMO_LINK}`;
  } finally {
    ctl.abort();
  }
}

// Regex-based METAR parser — works on raw METAR string
function _parseMetar(raw) {
  const p = { time:'---', wind:'---', vis:'---', wx:'', sky:[], temp:'---', qnh:'---' };

  // Time: DDHHmmZ
  const tm = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (tm) p.time = `${tm[1]}일 ${tm[2]}:${tm[3]}Z`;

  // Wind: VRB or 3-digit dir, 2-3 digit speed, optional gust, KT or MPS
  const wm = raw.match(/\b(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)\b/);
  if (wm) {
    const dir = wm[1] === 'VRB' ? 'VRB' : wm[1] + '°';
    p.wind = `${dir} ${wm[2]}${wm[5]}${wm[4] ? ' G' + wm[4] + wm[5] : ''}`;
  }

  // CAVOK
  if (/\bCAVOK\b/.test(raw)) {
    p.vis = 'CAVOK (>10km, 무구름, 기상현상 없음)';
    p.sky = ['CAVOK'];
  } else {
    // Metric visibility: 4-digit (meters)
    const vm = raw.match(/\b(9999|\d{4})\b/);
    if (vm) {
      const m = parseInt(vm[1]);
      p.vis = m >= 9999 ? '10km 이상' : `${m}m`;
    }
    // SM visibility (US format)
    const sm = raw.match(/\b(\d+(?:\/\d+)?)\s*SM\b/);
    if (sm) p.vis = `${sm[1]}SM (${(parseFloat(sm[1]) * 1.852).toFixed(1)}km)`;

    // Present weather (simplified: tokens between vis and clouds)
    const wxM = raw.match(/\b([-+]?(?:VC)?(?:MI|BC|PR|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|FG|BR|SA|DU|HZ|FU|PY|VA|PO|SQ|FC|SS|DS)+)\b/g);
    if (wxM) p.wx = wxM.join(' ');

    // Cloud layers: FEW/SCT/BKN/OVC + 3-digit height + optional CB/TCU
    const skRe = /\b(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?\b/g;
    let sk;
    while ((sk = skRe.exec(raw)) !== null)
      p.sky.push(`${sk[1]} ${parseInt(sk[2]) * 100}ft${sk[3] ? ' ' + sk[3] : ''}`);
    if (!p.sky.length && /\b(SKC|CLR|NSC|NCD)\b/.test(raw)) p.sky.push('Clear');
  }

  // Temp/Dew: ##/## or M##/## etc.
  const tdm = raw.match(/\b(M?\d{1,2})\/(M?\d{1,2})\b/);
  if (tdm) {
    const toC = s => uTemp(parseInt(s.replace('M', '-'), 10));
    p.temp = `${toC(tdm[1])} / DP ${toC(tdm[2])}`;
    // PFD OAT 계산용 지면 온도 갱신(가장 최근 조회한 METAR 기준)
    _oatSurfaceC = parseInt(tdm[1].replace('M', '-'), 10);
  }

  // QNH
  const qm = raw.match(/\bQ(\d{4})\b/);
  if (qm) { p.qnh = `Q${qm[1]} hPa`; window._qnhHpa = parseInt(qm[1], 10); }
  else {
    const am = raw.match(/\bA(\d{4})\b/);
    if (am) { p.qnh = `${(parseInt(am[1]) / 100).toFixed(2)} inHg (≈${Math.round(parseInt(am[1]) / 100 * 33.8639)} hPa)`; window._qnhHpa = parseInt(am[1]) / 100 * 33.8639; }
  }

  return p;
}

function renderWxMetar(text, el, icao) {
  // text may contain multiple METARs (one per line) — use the most recent
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const raw = lines[0];
  const p = _parseMetar(raw);

  const ROW = (lbl, val, clr) =>
    `<div style="display:grid;grid-template-columns:60px 1fr;gap:4px;margin-bottom:4px;">` +
    `<span style="color:#446644;font-size:18px;">${lbl}</span>` +
    `<span style="color:${clr || '#cccccc'};font-size:18px;">${val}</span></div>`;

  el.innerHTML =
    `<div style="color:#00ff88;font-size:20px;font-weight:bold;margin-bottom:5px;letter-spacing:0.5px;">${icao} — METAR</div>` +
    `<div style="color:#559955;font-size:16px;margin-bottom:8px;word-break:break-all;line-height:1.6;border-left:2px solid #1a3a1a;padding-left:5px;">${raw}</div>` +
    ROW('TIME', p.time) +
    ROW('WIND', p.wind) +
    ROW('VIS',  p.vis) +
    (p.wx ? ROW('WX', p.wx, '#ffaa44') : '') +
    ROW('SKY',  p.sky.join('  ') || '---') +
    ROW('TEMP', p.temp) +
    ROW('QNH',  p.qnh, '#66ccff') +
    (lines.length > 1
      ? `<div style="color:#335533;font-size:16px;margin-top:5px;">+ ${lines.length - 1}건 추가 관측</div>`
      : '');
}

function renderWxTaf(text, el, icao) {
  const raw = text.trim();
  const fmt = raw.replace(/(BECMG|TEMPO|FM\d{6}|PROB\d{2}\s+TEMPO|PROB\d{2}(?!\s+TEMPO))/g, '\n  $1');
  el.innerHTML =
    `<div style="color:#00ff88;font-size:20px;font-weight:bold;margin-bottom:5px;letter-spacing:0.5px;">${icao} — TAF</div>` +
    `<pre style="color:#aaa;font-size:16px;white-space:pre-wrap;word-break:break-all;line-height:1.6;margin:0;border-left:2px solid #1a3a1a;padding-left:5px;">${fmt}</pre>`;
}

// WX panel drag (same pattern as ship panel)
makePanelDraggable('wx-panel', 'wx-panel-header');

init();

// ── Service Worker 등록 (PWA 오프라인 지원) ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.warn('SW 등록 실패:', err));
  });
}

// ── CDU Logic ──
// ── CDU 액션 위임 ────────────────────────────────────────────────────
// 인라인 data-act="foo" data-arg='["X"]'은 전역 스코프에서만 동작한다. 그래서 CDU 내부 함수를
// 캡슐화할 수 없고, 이름을 잘못 적어도 문자열이라 정적으로 잡히지 않아 버튼이
// 조용히 죽는다. data-act/data-arg로 바꾸고 여기서 이름→함수를 명시적으로 잇는다.
//   · data-act : 액션 이름(레지스트리 키)
//   · data-arg : 인자 JSON 배열. 문자열 "$event"는 실제 이벤트 객체로 치환된다.
// ── 앱 전역 액션 위임 ────────────────────────────────────────────
// 인라인 onclick 은 전역 스코프에서만 이름을 찾기 때문에, 함수를 모듈/IIFE 안으로
// 옮기는 순간 "버튼이 조용히 죽는다"(clBack 사례). 위임을 쓰면 등록된 이름만
// 부르므로 그런 사고가 나지 않고, 미등록이면 콘솔에 경고가 남는다.
//
// 레지스트리는 APP_ACT · CDU_ACT 둘이지만 "이름 → 함수" 는 한 곳에서만 푼다.
// 종전에는 듣는 자리로 갈랐다 — CDU 안(#cdu-wrap)은 CDU_ACT, 밖은 APP_ACT.
// 그런데 PDF 뷰어·Flight Plan 처럼 APP_ACT 에 등록된 화면이 CDU 안에 그려지면
// 어느 쪽도 처리하지 않아 버튼이 통째로 죽었다(◀/▶ 페이지 넘김, 📍 위치 보정 등).
// 이제 듣는 자리는 그대로 두되(중복 발화 방지) 조회는 양쪽을 다 본다.
const APP_ACT = {};
function appRegister(map) { Object.assign(APP_ACT, map); }
// 이름을 두 레지스트리에서 찾는다. 자기 쪽을 먼저 보고 없으면 반대쪽.
function _actLookup(name, mine, other) {
  const fn = mine[name];
  return typeof fn === 'function' ? fn : other[name];
}
(function initAppDelegation() {
  const run = (e, kind) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    // CDU 리스너(#cdu-wrap)가 먼저 잡았으면 여기서 또 부르지 않는다.
    // contains() 만으로는 부족하다 — 핸들러가 화면을 다시 그리면 el 이 DOM 에서
    // 떨어져 나가 contains() 가 false 가 되고, 같은 클릭이 두 번 실행된다
    // (체크리스트 Back 을 한 번 눌렀는데 두 단계 올라가 HOME 으로 튀던 증상).
    if (e.__actDone) return;
    const cdu = document.getElementById('cdu-wrap');
    if (cdu && cdu.contains(el)) return;
    if ((el.dataset.on || 'click') !== kind) return;
    const fn = _actLookup(el.dataset.act, APP_ACT, CDU_ACT);
    if (typeof fn !== 'function') { console.warn('[APP] 미등록 액션:', el.dataset.act); return; }
    let args = [];
    if (el.dataset.arg) {
      try { args = JSON.parse(el.dataset.arg); }
      catch (err) { console.warn('[APP] 인자 파싱 실패:', el.dataset.arg); return; }
    }
    args = args.map(a => a === '$event' ? e : (a === '$el' ? el : a));
    fn(...args);
  };
  document.addEventListener('click', e => run(e, 'click'));
  document.addEventListener('pointerdown', e => run(e, 'pointerdown'));
})();

const CDU_ACT = {};
function cduRegister(map) { Object.assign(CDU_ACT, map); }
// cduFooter(함수) 로 지정한 Back 실행기
CDU_ACT.cduBack = () => { if (typeof _cduBackFn === 'function') _cduBackFn(); };
function act(name, ...args) {
  if (!args.length) return `data-act="${name}"`;
  return `data-act="${name}" data-arg='${JSON.stringify(args).replace(/'/g, "&#39;")}'`;
}
(function initCduDelegation() {
  const root = document.getElementById('cdu-wrap');
  if (!root) return;
  // 기본은 click. 볼륨 슬라이더처럼 누르는 즉시 반응해야 하는 요소는 data-on="pointerdown".
  const run = (e, kind) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    if ((el.dataset.on || 'click') !== kind) return;
    e.__actDone = true;    // 문서 리스너가 같은 클릭을 다시 처리하지 않게
    const fn = _actLookup(el.dataset.act, CDU_ACT, APP_ACT);
    if (typeof fn !== 'function') { console.warn('[CDU] 미등록 액션:', el.dataset.act); return; }
    let args = [];
    if (el.dataset.arg) {
      try { args = JSON.parse(el.dataset.arg); }
      catch (err) { console.warn('[CDU] 인자 파싱 실패:', el.dataset.arg); return; }
    }
    fn(...args.map(a => a === '$event' ? e : a === '$el' ? el : a));
  };
  root.addEventListener('click',       e => run(e, 'click'));
  root.addEventListener('pointerdown', e => run(e, 'pointerdown'));
})();

// ── CDU 캡슐화 ───────────────────────────────────────────────────────
// 이 IIFE 안의 이름 190여 개는 전역에 노출되지 않는다. 화면 버튼은 위에서 만든
// data-act 위임(CDU_ACT)으로 연결되므로 전역일 필요가 없다.
// 밖에서 실제로 쓰는 이름만 아래 '공개' 블록에서 명시적으로 내보낸다.

// CDU 화면들(클로저)은 09b-cdu-screens.js · 시작 위치 · 출발 공항은 09a-start.js 로 나눴다.
