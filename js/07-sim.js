// ─────────────────────────────────────────────────────────────
// 07-sim.js — 조종 입력 · 시뮬레이션 루프 · 초기화 · 측정자 · 솔로모드
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════
// CONTROLS  — pitch & bank are AUTO; no manual buttons
// ══════════════════════════════════════════════════════
// SIM 모드가 꺼져 있을 때(절차 훈련)의 IAS 모드 — FCP IAS 노브를 누르면 걸고 풀고(AFCS 상태 띠 · FCP 등),
// 노브를 돌리면 다시 걸린다. (SIM 이 꺼져 있으면 속도는 노브로만 바뀌므로 풀어도 지금 속도 그대로 난다)
let iasNsOn = true;
function iasModeOn() { return (typeof simModeOn !== 'undefined' && simModeOn) ? simIasOn : iasNsOn; }
let _collTrimNoMode = false, _spdDirect = false;   // _spdDirect — 4-WAY 전후 트림(속도를 곧바로)   // COLL TRIM 이 부른 'vs' — 걸린 수직 모드가 없으면 승강(01-state.js collTrimStep)
function applyDelta(field, d){
  afcsCmd();
  switch(field){
    case 'spd':
      // SIM 모드에서는 속도를 곧바로 바꾸지 않는다 — IAS 기준 속도를 옮기고(꺼져 있으면
      // 지금 속도에서 켠다) 기수 자세가 그 속도로 데려간다(14-simmode.js)
      if (simModeOn) { simIasStep(d); break; }
      if (typeof acIs === 'function' && acIs('b206')) {   // Bell 206 — AFCS 가 없다: 속도를 곧바로
        S.spd = Math.max(0, Math.min(B206P.vne, S.spd + d)); S.pit = pitchFromSpd(S.spd); break;
      }
      if (_spdDirect) { iasNsOn = true; S.spd = Math.max(0, Math.min(320, S.spd + d)); S.pit = pitchFromSpd(S.spd); selSpd = S.spd; break; }
      // IAS 노브는 기준 속도만 고른다 — 걸려 있으면 그 속도로, 꺼져 있으면 누를 때(fcpSync 'ias') 그 속도로 건다
      if (iasNsOn) selSpd = S.spd;                                  // 걸려 있으면(SIM 이 아니면 속도가 곧 기준) 지금 속도에서
      else if (!fcpPre.ias) selSpd = Math.round(S.spd);
      if (!iasNsOn) fcpPre.ias = true;
      selSpd = Math.max(0, Math.min(320, selSpd + d));
      if (iasNsOn) { S.spd = selSpd; S.pit = pitchFromSpd(S.spd); }   // auto pitch from speed
      break;
    case 'hdg':
      // GSPD(호버) 중에는 HDG 화살표와 기수를 분리 — 요 조작은 ANTI-TORQUE PEDAL로만
      if (gspdOn) break;
      // 기수를 즉시 돌리지 않고 선택 헤딩(HDG bug)만 이동 → AFCS가 표준선회로 추종
      if (hdgTurnDir && Math.sign(d) !== hdgTurnDir) hdgTurnDir = 0;   // 마킹을 도는 반대쪽으로 돌리면 방향을 다시 고른다
      selHdg = ((Math.round(selHdg + d) + 359) % 360) + 1;   // 1–360
      // HDG 노브는 버그만 옮긴다 — HDG 가 걸려 있으면 그리로 돌고, 꺼져 있으면 누를 때(fcpSync 'hdg') 그 버그로 건다
      if (!hdgSelOn) fcpPre.hdg = true;
      break;
    case 'yaw':
      // ANTI-TORQUE PEDAL — 뱅크 없이 기수만 즉시 회전(홀드 시 약 12°/s)
      S.hdg = normA(S.hdg + d);
      selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1;   // HDG SEL이 되돌리지 않도록 동기
      break;
    case 'crs':
      if (navSrc !== 'FMS') {
        vorObsCrs = normA(vorObsCrs + d); updateNav();
      } else if (obsOn) {
        S.crs = normA(S.crs + d); updateNav();
      }
      break;
    case 'vs':
      if ((typeof gaOn !== 'undefined') && gaOn && !altHoldOn && !crhtOn) {
        selVS = Math.max(GA_VS_MIN, Math.min(3000, selVS + d));   // G/A — 상승률(최저 300fpm)
      } else if (field === 'vs' && d && Math.abs(d) <= 100 && _collTrimNoMode) {
        S.vs = Math.max(-3000, Math.min(3000, S.vs + d));        // (COLL TRIM — 걸린 수직 모드가 없을 때의 승강 · 절차 훈련)
      } else {
        // VS 노브 — 부호 있는 승강률(시계 + 상승 · 반시계로 0 을 지나 − 강하 · ±3,000fpm)을 고른다.
        // 고르기만 한다 — 누르면(vsPush) 건다. VS 가 걸려 있으면 곧바로 그 승강률로 · ALT 가 걸려 있으면 수렴 빠르기(크기)
        selVS = Math.max(-3000, Math.min(3000, selVS + d));
      }
      break;
    case 'alt':
      // 기준이 그 단위가 아니면(1,237 처럼) 먼저 그 단위로 맞춘다(▲ 1,300 · ▼ 1,200)
      // ALT.A 노브 — 목표 고도(altaSel)를 고르기만 한다. 누르면(altaPush) VS + ALT 무장(01-state.js)
      { const st = Math.abs(d) || 100, a = altaSelGet();
        const next = d > 0 ? Math.floor(a / st) * st + st : Math.ceil(a / st) * st - st;
        altaSel = Math.max(0, Math.min(45000, next)); }
      break;
    case 'crht': {
      // CRHT +/- adjusts selCrht in fine 10 ft steps. Auto-engages CRHT hold.
      // 기준이 10 단위가 아니면(지금 고도로 걸면 1,237 처럼) 먼저 10 단위로 맞춘다 —
      // ▲ 는 위의 10 단위(1,240), ▼ 는 아래의 10 단위(1,230)로 간다.
      // CR.HT 노브는 기준 높이만 고른다 — 걸려 있으면 그 높이로, 꺼져 있으면 누를 때(crhtPush) 그 높이로 건다
      if (!crhtOn && !fcpPre.crht) selCrht = Math.round(radarAltFt());
      if (!crhtOn) fcpPre.crht = true;
      const st = Math.abs(d) || 10;
      const next = d > 0 ? Math.floor(selCrht / st) * st + st : Math.ceil(selCrht / st) * st - st;
      selCrht   = Math.max(0, Math.min(45000, next));
      updateHoverBtns();
      break;
    }
    case 'hht':
      // HHT — T/D to H 가 내려가 멈출 호버 높이(전파고도). 10ft 단위 · 20~1,000ft. 모드는 걸지 않는다.
      selHht = Math.max(20, Math.min(1000, Math.round(selHht / 10) * 10 + d));
      break;
    case 'uplim': altLimStep('up', Math.sign(d)); break;   // UPLIM · DH — 고도 경고 경계(01-state.js)
    case 'dh':    altLimStep('dh', Math.sign(d)); break;
    case 'wdir': windDir = normA(windDir + d); break;
    case 'wspd': windSpd = Math.max(0, Math.min(150, windSpd + d));    break;
  }
}

// ── HDG 를 푼다 ──
// HDG 버튼을 한 번 더 누르거나 상위모드를 모두 풀 때. 지금 뱅크를 그대로 이어 잡는다
// (SIM 은 트림으로 · 평소에는 뱅크 목표로) — 푸는 순간 자세가 튀지 않게.
function hdgRelease() {
  if (simModeOn && typeof simAfcsLatRelease === 'function') simAfcsLatRelease();
  else { hdgSelOn = false; rollApOn = false; bankTarget = S.bnk; }
}
// ── 상위모드 모두 해제(조이스틱 B1) ──
// NAV · HDG · ALT · CRHT · G/S(무장 포함) · IAS(SIM) · GSPD 를 한꺼번에 푼다.
// 각 모드를 끌 때와 같은 길로 풀어 자세·상승률이 튀지 않는다.
function afcsReleaseAll() {
  afcsCmd();
  try { if (navApOn) toggleNavAp(); } catch (e) { _swallow(e); }   // NAV 를 풀면 HDG 로 넘어간다 — 그것도 푼다
  try { if (hdgSelOn || rollApOn) hdgRelease(); } catch (e) { _swallow(e); }
  try { if (altHoldOn) toggleAltHold(); } catch (e) { _swallow(e); }
  try { if (crhtOn) toggleCrht(); } catch (e) { _swallow(e); }
  try { if (gsOn || gsArmed) toggleGs(); } catch (e) { _swallow(e); }
  try { if (simIasOn && typeof simIasRelease === 'function') simIasRelease(); } catch (e) { _swallow(e); }
  try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
  iasNsOn = false;                         // SIM 이 꺼져 있을 때의 IAS(FMA 오른쪽 칸)도 푼다
  try { if (typeof gaRelease === 'function') gaRelease(); } catch (e) { _swallow(e); }
  try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); }
}

// FCP 라벨(IAS/HDG/CRS) 누름: 해당 상위모드 인게이지 + 현재값 동기화
// - IAS: 속도 프리셀렉트(selSpd)를 현재 속도로
//        (SIM 모드에서는 IAS 상위모드를 켜고 끈다 — 켜면 지금 속도가 기준)
// - HDG: 헤딩 프리셀렉트(selHdg)를 현재 기수방위로 + 현재 헤딩 유지(롤 AP)
// - CRS: 현재 위치에서 NAV 소스(VOR/LOC 국·FMS 활성 웨이포인트)로의 코스 세팅(Direct-To)
function fcpSync(which) {
  afcsCmd();
  if (which === 'ias') {
    // 켜져 있으면 끄고, 꺼져 있으면 건다 — 노브로 고른 속도가 있으면 그 속도로, 없으면 지금 속도로
    const pre = fcpPre.ias ? selSpd : null; fcpPre.ias = false;
    if (simModeOn) { const was = simIasOn; simIasToggle(); if (!was && simIasOn && pre !== null) selSpd = simIasClamp(pre); }
    else {
      iasNsOn = !iasNsOn;
      if (iasNsOn) { if (pre !== null) { S.spd = pre; S.pit = pitchFromSpd(S.spd); } selSpd = Math.max(0, Math.round(S.spd)); }
    }
    try { drawPFD(); fcpsSync(); } catch (e) { _swallow(e); }
  } else if (which === 'hdg') {
    // IAS·ALT 처럼 한 번 더 누르면 푼다. NAV 가 걸려 있으면 HDG 로 넘긴다(지금 헤딩 유지).
    if (navApOn) toggleNavAp();
    else if (hdgSelOn) hdgRelease();
    else {
      // 노브로 버그를 옮겨 두었으면 그 버그로, 아니면 지금 헤딩으로 건다
      if (!fcpPre.hdg) selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1;   // 1–360
      hdgSelOn = true; bankTarget = 0; rollApOn = true;
    }
    fcpPre.hdg = false;
  } else if (which === 'crs') {
    S.dtoLive = false;   // 코스를 손으로 정하는 순간 '현 위치 기준' 은 끝난다
    // 코스선은 '그 지점을 지나고, 그 지점에서의 방위가 CRS 인 대권' 이다.
    // 그래서 지금 자리를 지나게 하려면 '지점에서 본 항공기 방위의 반대' 를 넣어야
    // 한다. 항공기에서 본 지점 방위를 그대로 넣으면 대권의 방위가 양 끝에서
    // 다른 만큼(수렴각) 어긋나, 먼 거리에서는 코스선이 항공기를 비켜 간다
    // (82NM 에서 1° ≈ 1.4NM — 지도에서 눈에 띄게 벌어진다).
    // 반올림도 하지 않는다. 1° 를 버리면 그 거리에서 0.7NM 이 다시 벌어진다.
    if ((navSrc !== 'FMS') && navLat !== null) {
      vorObsCrs = normA(bearing(navLat, navLon, S.lat, S.lon) + 180);
      updateNav();
    } else if (navSrc === 'FMS' && S.awp >= 0 && obsOn) {   // FMS — OBS 가 켜져 있을 때만(꺼져 있으면 비행계획의 코스 그대로)
      const _w = S.wps[S.awp];
      S.crs = normA(bearing(_w.lat, _w.lon, S.lat, S.lon) + 180);
      S.fwp = -1;   // 이전 leg 대신 활성 WP 를 지나는 S.crs 선을 추적
      updateNav();
    } else {
      return;   // 세팅할 NAV 소스 없음 → 피드백 없이 무시
    }
  }
  // 시각 피드백(짧은 초록 플래시)
  const el = document.getElementById(which === 'ias' ? 'ias-lbl-btn' : which === 'hdg' ? 'hdg-lbl-btn' : 'crs-lbl-btn');
  if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 350); }
}

// ── 키보드 매핑 (FCP 조작) ──
// 1/2: IAS ∓1 · 3/4: HDG 좌/우 1° · 5/6: CRS 좌/우 1°
// 7/8: VS ∓10fpm · 9/0: ALT ∓10ft · -/=: CRHT ∓10ft
// 키를 누르고 있으면 OS 키 반복으로 연속 조작. 입력창 포커스 중에는 무시.
const _keyMap = {
  '1': ['spd', -1],  '2': ['spd', 1],
  '3': ['hdg', -1],  '4': ['hdg', 1],
  '5': ['crs', -1],  '6': ['crs', 1],
  '7': ['vs', -10],  '8': ['vs', 10],
  '9': ['alt', -10], '0': ['alt', 10],
  '-': ['crht', -10], '=': ['crht', 10],
};
// 물리 키보드 단축키(DeX·데스크톱에서 오작동 시 설정에서 끌 수 있음)
let kbdShortcuts = true;
try { kbdShortcuts = localStorage.getItem('kbdShortcuts') !== '0'; } catch(e) { _swallow(e); }
function toggleKbdShortcuts() {
  kbdShortcuts = !kbdShortcuts;
  try { localStorage.setItem('kbdShortcuts', kbdShortcuts ? '1' : '0'); } catch(e) { _swallow(e); }
  stopAllHolds();
}
document.addEventListener('keydown', e => {
  if (!kbdShortcuts) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (typeof joyKeyOwned === 'function' && joyKeyOwned(e)) return;   // 조종 장치에 배정한 키
  const m = _keyMap[e.key];
  if (!m) return;
  e.preventDefault();
  applyDelta(m[0], m[1]);
});
// Enter: Force Trim Release · 우측 Shift: GSPD 토글 · 방향키: 트림(←→↑↓)
const _keyTrimMap = { 'ArrowLeft': 'L', 'ArrowRight': 'R', 'ArrowUp': 'F', 'ArrowDown': 'A' };
document.addEventListener('keydown', e => {
  if (!kbdShortcuts) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (typeof joyKeyOwned === 'function' && joyKeyOwned(e)) return;   // 조종 장치에 배정한 키
  if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) forceTrim(); return; }
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();                        // 페이지 스크롤 방지
    if (typeof simModeOn !== 'undefined' && simModeOn) {   // SIM: 휠 브레이크 · 두 번이면 파킹 브레이크
      if (!e.repeat) simSpaceDown(performance.now());
    } else if (!e.repeat) toggleSim();         // FLY ⇄ PAUSE
    return;
  }
  if (e.key === 'Shift' && e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT && !e.repeat) {
    e.preventDefault(); toggleGspd(); return;
  }
  const dir = _keyTrimMap[e.key];
  if (dir) {
    e.preventDefault();
    if (!e.repeat) startTrimHold(dir);   // 버튼 홀드와 동일(자체 반복 타이머 사용)
  }
});
document.addEventListener('keyup', e => {
  // HDG 키(3/4)를 떼면 버튼과 동일하게 뱅크 목표 해제(수평 복귀)
  if (_keyTrimMap[e.key]) stopTrimHold();
  if (e.key === 'Enter' && typeof forceTrimRelease === 'function') forceTrimRelease();
  if ((e.key === ' ' || e.code === 'Space') && typeof simSpaceUp === 'function') simSpaceUp();
});

const btnMap={
  'spd-dn':['spd',-1],'spd-up':['spd',1],
  'hdg-dn':['hdg',-1],'hdg-up':['hdg',1],
  'ped-l':['yaw',-1],'ped-r':['yaw',1],
  'crs-dn':['crs',-1],'crs-up':['crs',1],
  'vs-dn':['vs',-100],'vs-up':['vs',100],
  // COLLECTIVE TRIM — 현재는 VS ▲▼와 동일 동작.
  // 상위모드(AFCS) 해제 기능이 들어가면 파워(출력) 직접 제어로 바꾼다.
  'coll-up':['vs',100],'coll-dn':['vs',-100],
  'alt-dn':['alt',-100],'alt-up':['alt',100],
  'crht-dn':['crht',-10],'crht-up':['crht',10],
  'hht-dn':['hht',-10],'hht-up':['hht',10],
  'wdir-dn':['wdir',-5],'wdir-up':['wdir',5],
  'wspd-dn':['wspd',-1],'wspd-up':['wspd',1],
};
// Per-button independent hold state using PointerEvent.
// Each button owns its timer/interval — simultaneous touches no longer bleed
// into each other (fixes the multi-touch "stuck button" bug).
// ── 홀드(연속 조작) 안전 장치 ──
// DeX·데스크톱처럼 창 포커스가 바뀌는 환경에서는 pointerup/keyup을 놓칠 수 있고,
// 그러면 반복 타이머가 살아남아 속도가 0으로 수렴하거나 계속 증가한다.
// 활성 홀드만 등록해 두고 전역 이벤트에서 일괄 해제한다.
const _holdStops = new Set();
const HOLD_MAX_MS = 20000;      // 어떤 홀드도 20초를 넘기지 않음(런어웨이 방지)
function stopAllHolds() {
  Array.from(_holdStops).forEach(fn => { try { fn(); } catch(e) { _swallow(e); } });
  try { stopTrimHold(); } catch(e) { _swallow(e); }
}
window.addEventListener('blur', stopAllHolds);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAllHolds(); });
document.addEventListener('pointerup', stopAllHolds);
document.addEventListener('pointercancel', stopAllHolds);

Object.entries(btnMap).forEach(([id,[f,d]])=>{
  const el=document.getElementById(id);
  if (!el) return;   // FCP 1행(IAS · HDG · CRS · VS · ALT · CRHT · HHT ▲▼)은 없앴다 — SIMPLE 패널 노브가 같은 일을 한다
  let timer=null, interval=null, guard=null;
  function start(e){
    e.preventDefault();
    if(timer||interval) return;
    applyDelta(f,d);
    _holdStops.add(stop);
    guard = setTimeout(stop, HOLD_MAX_MS);          // 런어웨이 방지
    timer=setTimeout(()=>{interval=setInterval(()=>applyDelta(f,d),80);},350);
  }
  function stop(){
    clearTimeout(timer); timer=null;
    clearInterval(interval); interval=null;
    clearTimeout(guard); guard=null;
    _holdStops.delete(stop);
  }
  el.addEventListener('pointerdown',start);
  el.addEventListener('pointerup',stop);
  el.addEventListener('pointercancel',stop);
  el.addEventListener('pointerleave',stop);
});

// Trim cells: hold-to-repeat (initial gspdTrim + 1 kt/sec after delay)
['trim-l','trim-r','trim-fwd','trim-aft'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const dir = el.getAttribute('data-trim-dir');
  el.addEventListener('mousedown',  () => startTrimHold(dir));
  el.addEventListener('touchstart', e => { e.preventDefault(); startTrimHold(dir); }, {passive:false});
});
document.addEventListener('mouseup',     stopTrimHold);
document.addEventListener('touchend',    stopTrimHold);
document.addEventListener('touchcancel', stopTrimHold);

// CRS button initial state (OBS off, FMS mode → disabled)
updateCrsButtons();
// 인터셉트 각도 버튼 초기 표기
updateInterceptBtn();
// Hover/GSPD/trim initial state
updateHoverBtns();

// ══════════════════════════════════════════════════════
// SIMULATION
// ══════════════════════════════════════════════════════
function updateFlyBtns(){
  const txt = S.running ? '⏸ PAUSE' : '▶ FLY';
  ['fly-btn','map-fly-btn','fly3d-btn'].forEach(id=>{   // fly3d-btn: 3D 창의 같은 버튼
    const b=document.getElementById(id);
    if(!b) return;
    b.textContent=txt;
    b.classList.toggle('on',S.running);
  });
}

// ── MG(Slaved) / DG — 3D 창과 지도 창의 같은 버튼(누를 때마다 바뀐다) ──
// MG 로 돌아오면 자이로가 곧 자기 헤딩에 다시 맞는다(오차 0). DG 에서만 −/+ 가 살아 있다.
function toggleHdgRef() {
  hdgRef = hdgRef === 'MG' ? 'DG' : 'MG';
  if (hdgRef === 'MG') dgErr = 0;
  updateHdgRefBtns();
  // LOWER 창 AHRS 패널 — 고른 AHRS 의 TG/MG DG 버튼도 함께(19-lower.js)
  try { if (typeof lconAhrsDgFromRef === 'function') lconAhrsDgFromRef(); } catch (e) { _swallow(e); }
}
// HSI 를 왼쪽(−)·오른쪽(+)으로 1° — 계기 헤딩이 그만큼 줄고 는다
function dgAdjust(d) {
  if (hdgRef !== 'DG') return;
  dgErr = normAS(dgErr + d);
  updateHdgRefBtns();
}
function updateHdgRefBtns() {
  const dg = hdgRef === 'DG';
  document.querySelectorAll('.hdgref').forEach(box => {
    box.classList.toggle('dg', dg);
    const b = box.querySelector('.hdgref-btn');
    if (b) b.textContent = dg ? 'DG' : 'MG (Slaved)';
    box.querySelectorAll('.hdgref-adj button').forEach(x => { x.disabled = !dg; });
  });
  updateDgCompass();
}
// 자기 나침반(스탠바이) — DG 를 맞출 때 견주는 값(°M). DG 일 때만 보인다
function updateDgCompass() {
  if (hdgRef !== 'DG') return;
  const t = 'COMP ' + fmtA(toMag(S.hdg)) + '°';
  document.querySelectorAll('.hdgref-comp').forEach(el => { if (el.textContent !== t) el.textContent = t; });
}
function toggleSim(){
  S.running=!S.running;
  updateFlyBtns();
  S.lastT=null;
  if(S.running&&S.trail.length===0) S.trail.push([S.lat,S.lon]);
}
// ── 배속 ───────────────────────────────────────────────────────────
// 홀딩 한 바퀴가 4분, 절차 하나가 20분씩 걸린다. 그 시간을 실시간으로
// 앉아 기다리게 하지 않는다. 시뮬 시간만 빨리 흐르게 하고 계산은 그대로다
// (프레임 간격을 늘리는 게 아니라 한 프레임에 흐를 시간을 늘린다).
const SIM_SPEEDS = [1, 2, 4, 8];
function setSimSpeed(v) {
  simSpeed = SIM_SPEEDS.includes(v) ? v : 1;
  updateSimSpeedBtns();
}
function updateSimSpeedBtns() {
  SIM_SPEEDS.forEach(v => {
    const el = document.getElementById('simspd-' + v);
    if (el) el.classList.toggle('active', simSpeed === v);
  });
}

function resetSim(){
  S.running=false;
  setSimSpeed(1);            // 리셋하면 실시간으로 돌아온다
  suspOn = false; try { updateSuspBtn(); } catch(e) { _swallow(e); }
  gsArmed = false; gsOn = false; try { updateGsBtn(); } catch(e) { _swallow(e); }
  updateFlyBtns();
  S.trail=[];trailLine.setLatLngs([]);_update3dTrail();S.lastT=null;
  updateAcOnMap();
}

// ── 내활·외활 볼(slip/skid) ──
// 볼은 기체가 느끼는 옆 방향 힘을 따라 구른다 — 기울어진 쪽으로 중력이 끄는 몫(tan 뱅크)과
// 선회의 원심력(속도 × 요율 / g)의 차이다.
//   뱅크만큼 돌면(협조 선회)              → 가운데
//   뱅크보다 덜 돌면(저속 옆걸음 등)       → 낮은 날개 쪽(내활 slip)
//   뱅크 없이 돌면(페달로 기수만 돌리면)   → 선회 바깥쪽(외활 skid)
// 볼은 액체 속에서 구르므로 조금 늦게 따라온다(SLIP_TAU).
const SLIP_TAU = 0.3;   // 볼이 따라오는 시간 상수(s)
function slipUpdate(dt) {
  let dh = _slipHdg === null ? 0 : normAS(S.hdg - _slipHdg) - _hdgJump;
  _slipHdg = S.hdg; _hdgJump = 0;
  if (Math.abs(dh) > 10) dh = 0;                  // 배치·리셋처럼 한 번에 옮긴 것 — 돈 것이 아니다
  const r = dh * D2R / dt;                        // 요율(rad/s, 오른쪽 +)
  const v = Math.abs(S.spd) * 1.6878;             // ft/s
  let tgt = Math.max(-1, Math.min(1, Math.tan(S.bnk * D2R) - v * r / 32.174));
  // SIM — 상위모드가 걸려 있으면 AFCS 가 협조 선회로 잡는다(볼 가운데). 내활·외활은 순수 수동 비행에서만
  try { if (typeof simAfcsAny === 'function' && simAfcsAny()) tgt = 0; } catch (e) { _swallow(e); }
  slipBall += (tgt - slipBall) * Math.min(1, dt / SLIP_TAU);
}

let _swPrevTs = null;   // 스톱워치에 시간을 흘려 넣기 위한 직전 프레임 시각
let _simLastTick = 0;   // 렌더 루프 생존 감시용
let _pfdDrawLast = 0;   // GPS 모드 PFD 10fps 제한용
function simStep(ts, noLoop){   // noLoop — 새 창이 대신 한 프레임을 돌릴 때(00-popout.js), 본 창의 rAF 를 또 걸지 않는다
  _simLastTick = performance.now();
  try {
  try { shipTacanSync(); } catch (e) { _swallow(e); }   // 함정 TACAN — 국이 함정을 따라 움직인다
  // 롤·피칭(흔들리는 갑판) — 시뮬이 도는 동안만 흐른다. 헬기 운동보다 먼저 흘려야 갑판에 앉은
  // 헬기의 높이·자세가 이번에 그려질 갑판과 같은 순간이 된다(한 박자 늦으면 갑판에서 떠 보인다).
  if (shipVisible && S.running && S.lastT !== null) {
    const mdt = (ts - S.lastT) / 1000 * simSpeed;
    if (mdt > 0 && mdt < 0.5 * simSpeed) { try { shipMotionStep(mdt); } catch (e) { _swallow(e); } }
  }
  if(S.running && !gpsMode && !_fdrPlaying && S.lastT!==null){
    const _raw=(ts-S.lastT)/1000;
    // 배속: 한 프레임에 흐르게 할 시뮬 시간 = 실제 경과시간 × simSpeed.
    // 한 번에 몰아 적분하면 큰 dt 에서 오차가 커지므로(선회 중 특히) 0.2초를
    // 넘지 않게 쪼갠다. 60fps·8배속이면 0.133초라 그대로 한 번에 돈다 —
    // 프레임이 튀었을 때만 나뉜다.
    const _tot=_raw>0&&_raw<0.5 ? _raw*simSpeed : 0;
    const _n=Math.max(1, Math.ceil(_tot/0.2));
    for(let _sub=0;_sub<_n;_sub++){
    const dt=_tot/_n;
    if(dt>0&&dt<0.5){
      // DG — 방향 자이로가 1시간에 DG_DRIFT(6°) 씩 어긋난다(나는 동안만, 배속이면 그만큼 빨리)
      if (hdgRef === 'DG') dgErr = normAS(dgErr - DG_DRIFT / 3600 * dt);
      // SIM 모드: 조종간 입력을 먼저 자세·속도에 반영한다(아래 운동식은 그대로 쓴다)
      try { simFly(dt); } catch(e) { _swallow(e); }
      try { if (!simModeOn && typeof acFixedWing === 'function' && acFixedWing()) fwKinStep(dt); } catch(e) { _swallow(e); }   // 고정익 — 최소 속도 · 평형 자세 · 토크(42-cn235.js)
      // smooth bank toward target — GSPD 중에는 ADI 자세 변화 없음(수평 유지)
      const bt = gspdOn ? 0 : bankTarget;
      const bankDiff=bt-S.bnk;
      if (simModeOn && !simAfcsLat()) {
        // 조종간이 이미 자세를 정했다 — 여기서 다시 손대지 않는다
        // (HDG·NAV 가 걸려 있으면 SIM 모드라도 아래 AFCS 선회가 뱅크를 잡는다)
        _rollRate = 0;
      } else if ((hdgSelOn || navApOn) && !gspdOn) {
        // AFCS 선회: 롤 각가속도 제한(사다리꼴 프로파일).
        // 목표 롤율은 남은 뱅크차로 감속거리를 계산해 정하므로 오버슛 없이 수렴한다.
        const want = Math.sign(bankDiff) *
                     Math.min(ROLL_RATE_MAX, Math.sqrt(2 * ROLL_ACC_MAX * Math.abs(bankDiff)));
        const dR = Math.max(-ROLL_ACC_MAX * dt, Math.min(ROLL_ACC_MAX * dt, want - _rollRate));
        _rollRate += dR;
        S.bnk += _rollRate * dt;
        if (Math.abs(bt - S.bnk) < 0.05 && Math.abs(_rollRate) < 0.3) { S.bnk = bt; _rollRate = 0; }
      } else {
        _rollRate = 0;
        S.bnk+=Math.sign(bankDiff)*Math.min(Math.abs(bankDiff),50*dt);
        if(Math.abs(bt-S.bnk)<0.3) S.bnk=bt;
      }
      // GSPD 중 피치도 수평(0°)으로 수렴 — 지상속도 제어라 자세 지시 없음
      // (SIM 모드에서는 GSPD 가 가감속에 맞춰 자세를 잡는다 — simGspdAfter)
      if (gspdOn && !simModeOn && Math.abs(S.pit) > 0.05) {
        S.pit -= Math.sign(S.pit) * Math.min(Math.abs(S.pit), 15 * dt);
      }

      if (!acDragging) {
        let gsN, gsE;
        if (gspdOn || gspdCoasting) {
          // Body-frame motion. Convergence runs only while GSPD is
          // engaged; in coasting state we keep integrating at constant
          // body velocity until the next engagement.
          if (gspdOn) {
            // SIM 모드: 조종간을 중립 밖으로 밀고 있는 축은 조종사가 몬다(fly-through) —
            // 그동안은 기준속도로 끌어가지 않는다. 놓으면 다시 기준으로 수렴하고,
            // FORCE TRIM 을 누르면 그 순간의 속도가 새 기준이 된다.
            const fly = (typeof simGspdStick === 'function') ? simGspdStick() : null;
            const f0 = gspdActFwd, l0 = gspdActLat;
            // Rate is scaled by current actual speed magnitude so that
            // the last few kt slew at ~1 kt/sec for a smooth arrival.
            // 남은 차이보다 빨리는 가지 않는다(최소 1kt/s) — 4방향 트림을 누르고 있으면
            // 기준속도가 1초마다 1kt 씩 옮겨 가는데, 빠른 속도에서 그 1kt 를 한순간에
            // 따라가 버리면 1초마다 속도·지도·PFD 가 계단처럼 튄다. 이렇게 두면
            // 1kt 를 1초에 걸쳐 따라가 끊김 없는 경사가 된다.
            // (그래서 끝에 남는 몫도 정확히 닿는다 — 마지막에 덥석 채우지 않는다)
            const gspdRate = (act, d) => Math.min(gspdSlewRate(act), Math.max(GSPD_RATE_SLOW, Math.abs(d)));
            if (fly && fly.lat) {
              gspdActLat = simGspdFly(gspdActLat, fly.lat, dt, -SIDE_MAX_KT, SIDE_MAX_KT);
            } else if (gspdRefLat !== null) {
              const dLat = gspdRefLat - gspdActLat;
              const rLat = gspdRate(gspdActLat, dLat);
              gspdActLat += Math.sign(dLat) * Math.min(Math.abs(dLat), rLat * dt);
              if (Math.abs(gspdRefLat - gspdActLat) < 1e-3) gspdActLat = gspdRefLat;
            }
            if (fly && fly.fwd) {
              gspdActFwd = simGspdFly(gspdActFwd, fly.fwd, dt, SIM_SPD_BACK, SIM_SPD_MAX);
            } else if (gspdRefFwd !== null) {
              const dFwd = gspdRefFwd - gspdActFwd;
              const rFwd = gspdRate(gspdActFwd, dFwd);
              gspdActFwd += Math.sign(dFwd) * Math.min(Math.abs(dFwd), rFwd * dt);
              if (Math.abs(gspdRefFwd - gspdActFwd) < 1e-3) gspdActFwd = gspdRefFwd;
            }
            if (fly) simGspdAfter(dt, f0, l0, fly);   // 자세·가감속(SIM 모드)
          }
          // Body frame → ground frame (ignores wind; this is direct
          // ground-speed control)
          const ch = Math.cos(S.hdg * D2R), sh = Math.sin(S.hdg * D2R);
          gsN =  gspdActFwd * ch - gspdActLat * sh;
          gsE =  gspdActFwd * sh + gspdActLat * ch;
          // Keep S.spd in sync for the speed tape
          S.spd = Math.sqrt(gspdActFwd*gspdActFwd + gspdActLat*gspdActLat);
          // While coasting, bleed lateral velocity toward zero so the exit
          // condition (|gspdActLat| < 0.5) can eventually be reached without
          // re-engaging GSPD.
          if (gspdCoasting) {
            gspdActLat -= Math.sign(gspdActLat) * Math.min(Math.abs(gspdActLat), GSPD_RATE_SLOW * dt);
          }
          // Exit coasting once motion is representable in the base model
          // (no lateral, no aft). Hand off forward component to S.spd.
          if (gspdCoasting && Math.abs(gspdActLat) < 0.5 && gspdActFwd >= 0) {
            gspdCoasting = false;
            S.spd = Math.max(0, gspdActFwd);
          }
        } else {
          // Ground velocity = TAS vector + (effective) wind vector. The
          // effect factor is 0 in hover/low-speed regime (basic stabilization
          // holds heading) and ramps to 1 as IAS pushes into cruise, so the
          // helicopter only starts drifting once it is no longer in hover.
          const wt = normA(windDir + 180) * D2R;
          const wEff = effectiveWindSpd();
          // SIM 모드의 옆미끄럼(저속에서 뱅크를 주면 옆으로 간다)도 함께 더한다
          const lat = simModeOn ? simLat : 0;
          const ch = Math.cos(S.hdg * D2R), sh = Math.sin(S.hdg * D2R);
          // SIM 은 진대기속도(TAS)로 움직인다 — 높은 곳에서는 같은 IAS 로 더 멀리 간다(01-state.js tasKt)
          const vT = tasKt(S.spd), lT = tasKt(lat);
          gsN = vT * ch - lT * sh + wEff * Math.cos(wt);
          gsE = vT * sh + lT * ch + wEff * Math.sin(wt);
        }
        const sc = 1852/3600 * dt / 111320;
        const _lat0 = S.lat, _lon0 = S.lon;
        S.lat += gsN * sc;
        S.lon += gsE * sc / Math.cos(S.lat * D2R);
        // SIM 모드: 함정 선체 옆면·함교에 부딪히면 그 앞에서 선다(14-simmode.js)
        if (simModeOn && typeof simShipCollide === 'function') {
          try { simShipCollide(_lat0, _lon0); } catch (e) { _swallow(e); }
        }
        // Altitude update — hold modes override manual VS while engaged
        // G/S 를 잡고 있으면 고도는 강하선이 정한다(ALT·CRHT 보다 앞선다).
        try { gsCaptureCheck(); } catch(e) { _swallow(e); }
        const _gs = (gsOn && !simModeOn) ? gsDeviation() : null;
        if (_gs) {
          // 강하선 고도로 수렴시킨다. 기본 강하율은 지상속도와 강하각으로 정해지고
          // (3°·120kt ≈ 640fpm), 벗어난 만큼만 더 얹어 부드럽게 되돌아온다.
          const gsKt = Math.max(20, groundSpdKt());
          const base = gsKt * Math.tan(_gs.angle * D2R) * FT_PER_NM / 60;   // fpm
          const diff = _gs.path - S.alt;                                    // + = 더 올라야
          const corr = Math.max(-400, Math.min(400, diff * 0.5));           // fpm
          const vs = Math.max(-2000, Math.min(500, -base + corr));
          const step = vs / 60 * dt;
          S.alt = Math.max(0, Math.min(45000, S.alt + step));
          S.vs = vs;
        } else if (altHoldOn && !simModeOn) {
          // (SIM 모드의 ALT·CRHT 는 고도를 바로 옮기지 않고 출력(컬렉티브)으로 지킨다 —
          //  14-simmode.js simAfcsVsCmd. 그 상승률은 아래 S.vs 적분으로 고도가 된다)
          // ALT hold: converge S.alt → selAlt at the pilot-set selVS rate.
          // Sign of climb/descent is determined automatically from the
          // current altitude relative to the target.
          const diff = selAlt - S.alt;
          if (Math.abs(diff) < 0.5) { S.alt = selAlt; S.vs = 0; }
          else {
            const rate = Math.max(50, Math.abs(selVS));   // fpm magnitude
            const step = Math.sign(diff) * Math.min(Math.abs(diff), rate / 60 * dt);
            S.alt = Math.max(0, Math.min(45000, S.alt + step));
            S.vs  = Math.sign(diff) * rate;
          }
        } else if (crhtOn && !simModeOn) {
          // CRHT hold: always 500 fpm — rate is NOT user-configurable.
          // 전파고도(AGL)를 지킨다 — 땅이 오르면 따라 오르고, 바다 위면 기압고도와 같다
          const ct = crhtTgtFt(), diff = ct - radarAltFt();   // CRHT(또는 HHT)
          if (Math.abs(diff) < 0.5) { S.alt = ct + radarGroundFt(); S.vs = 0; }
          else {
            const step = Math.sign(diff) * Math.min(Math.abs(diff), 500 / 60 * dt);
            S.alt = Math.max(0, Math.min(45000, S.alt + step));
            S.vs  = Math.sign(diff) * 500;
          }
        } else if (typeof vsModeOn !== 'undefined' && vsModeOn && !simModeOn) {
          // VS — 고른 승강률로 계속 오르내린다(ALT.A 무장이면 300ft 전에 ALT 로 — 01-state.js altaStep)
          S.vs = selVS;
          S.alt = Math.max(0, Math.min(45000, S.alt + S.vs / 60 * dt));
        } else if (S.vs !== 0) {
          S.alt = Math.max(0, Math.min(45000, S.alt + S.vs / 60 * dt));
        }
        // SIM 모드에서는 지면이 바닥이다(해수면이 아니라) — ALT·CRHT 가 몰 때도 같다
        if (simModeOn) {
          try {
            const g = simFloorFt();      // 발밑 바닥(지면·함정 갑판) — 지면은 '아는 때' 만
            if (S.alt < g) { S.alt = g; S.vs = 0; }
          } catch (e) { _swallow(e); }
        }

        // Coordinated turn: bank angle drives heading change (g·tan(bank)/V).
        if (Math.abs(S.bnk) > 0.5 && !gspdOn && !gspdCoasting) {
          const V_ms = Math.max(10, Math.abs(tasKt(S.spd))) * 0.5144;   // 선회율 = g·tanφ / TAS
          let turnRate = 9.81 * Math.tan(S.bnk * D2R) / V_ms / D2R;  // °/s
          // SIM 모드의 저속에서는 뱅크가 선회가 아니라 옆걸음으로 쓰인다
          // 저속일수록 선회 몫이 급히 줄어든다(제곱) — 그 자리에서 도는 것이 아니라
          // 옆으로 미끄러지는 것이 헬기의 저속 거동이다.
          if (simModeOn) {
            try { const f = simTurnFrac(); turnRate *= f * f; } catch(e) { _swallow(e); }
          }
          S.hdg = normA(S.hdg + turnRate * dt);
        }

        // Update body-frame actual readout while hover page is on. Skip when
        // GSPD is engaged or coasting — both already integrate the body
        // velocity directly. The readout shows controlled body-frame intent
        // (S.spd along heading), so wind drift is intentionally absent from
        // the Actual display — the helicopter is still drifting in the
        // base motion model, but the readout reflects only what is being
        // commanded, not transient wind effects.
        if (hoverPageOn && !gspdOn && !gspdCoasting) {
          gspdActLat = simModeOn ? simLat : 0;
          gspdActFwd = S.spd;
        }

        const last=S.trail[S.trail.length-1];
        if(!last||distance(last[0],last[1],S.lat,S.lon)>0.04){
          S.trail.push([S.lat,S.lon]);
          if(S.trail.length>600) S.trail.shift();
          updateTrail();
        }
      }
      updateAcOnMap();updateNav();

      // FMS waypoint sequencing (fly-by when NAV AP active)
      // 활성 웨이포인트에 홀딩이 걸려 있으면(아직 진입 전이라도) 시퀀싱하지 않는다.
      // TOFIX 상태만 제외하면, 픽스 통과 프레임에서 진입 판정보다 시퀀싱이 먼저
      // 돌아 "마지막 WP 통과" 로 NAV 가 해제되고 HDG 모드로 떨어진다.
      // SUSP 가 걸려 있으면 지나가도 넘어가지 않는다(홀딩이면 저절로 걸린다).
      if (S.awp >= 0 && !obsOn && !navSuspended()) {
        if (navApOn && navSrc === 'FMS' && S.awp + 1 < S.wps.length) {
          // Fly-by: anticipate turn toward next leg before reaching WP
          const nextLegCrs = bearing(S.wps[S.awp].lat, S.wps[S.awp].lon,
                                     S.wps[S.awp + 1].lat, S.wps[S.awp + 1].lon);
          // 현재 레그 코스는 활성 코스선의 WP 도달 시점 방위(대권 보정 포함)
          const _cl = activeCourseLine();
          const curLegCrs = _cl ? normA(bearing(_cl.to[0], _cl.to[1], _cl.from[0], _cl.from[1]) + 180)
                                : activeCrs();
          const anticipateDist = flyByAnticipationDist(nextLegCrs, curLegCrs);
          if (S.dtw < anticipateDist) { selectWP(S.awp + 1); }
        } else if (S.dtw < 0.25) {
          if (S.awp + 1 < S.wps.length) {
            selectWP(S.awp + 1);
          } else if (navApOn && navSrc === 'FMS' && !obsOn) {
            // Last WP passed in NAV AP mode — revert to HDG hold
            navApOn = false;
            { const b = document.getElementById('nav-ap-btn'); if (b) b.classList.remove('on'); }
            bankTarget = 0;
            selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; hdgSelOn = true;
          }
        }
      }

      // HDG SEL: 선택 헤딩까지 표준선회(속도의 16% 뱅크). NAV AP·GSPD가 우선.
      // 계기 헤딩(hdgInd)을 맞춘다 — DG 오차가 있으면 실제 기수는 그만큼 비껴 난다.
      if (hdgSelOn && rollApOn && !navApOn && !gspdOn && !gspdCoasting) {
        let err  = normAS(selHdg - hdgInd());           // -180 ~ +180
        // 선회 방향 래치 — 돌고 있는 쪽을 지킨다(롤아웃 구간 밖에서만 · 맞춘 뒤 살짝 넘친 것은 그대로 되돌린다)
        if (hdgTurnDir && Math.sign(err) === -hdgTurnDir && Math.abs(err) > HDG_ROLLOUT_DEG) err += 360 * hdgTurnDir;
        else if (!hdgTurnDir && Math.abs(err) > 2) hdgTurnDir = Math.sign(err);
        const bMax = stdRateBank(S.spd);
        const aErr = Math.abs(err);
        if (aErr < 0.5) { bankTarget = 0; _hdgJump += err; S.hdg = normA(selHdg - dgErr); hdgTurnDir = 0; }
        else {
          // 롤아웃 구간에서도 최소 뱅크를 유지 — 비행모델이 |bank|<=0.5°를 무시하므로
          // 그 아래로 떨어지면 선회가 멈춘 채 오차가 남는다(저속에서 발생)
          const b = aErr >= HDG_ROLLOUT_DEG ? bMax : Math.max(1.2, bMax * aErr / HDG_ROLLOUT_DEG);
          bankTarget = Math.sign(err) * b;
        }
      } else hdgTurnDir = 0;

      // NAV AP: drive bankTarget for course tracking
      if (navApOn) {
        if (navSrc === 'FMS' && !obsOn && S.awp < 0) {
          // No active WP — disengage NAV AP
          navApOn = false;
          { const b = document.getElementById('nav-ap-btn'); if (b) b.classList.remove('on'); }
          bankTarget = 0;
          selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; hdgSelOn = true;
        } else {
          holdSyncFromWp();                  // 활성 WP 에 홀딩이 있으면 자동 무장
          const hb = holdBankTarget(dt);     // 홀딩 중이면 홀딩 로직이 우선
          bankTarget = (hb === null) ? navApBankTarget() : hb;
        }
      }

      // Update speed trend (6s extrapolation, smoothed)
      {
        const acc = (S.spd - _spdPrev) / dt;
        spdTrend += (acc * 6 - spdTrend) * Math.min(1, dt * 2);
        _spdPrev = S.spd;
      }
      slipUpdate(dt);
      try { simDeckLock(); } catch (e) { _swallow(e); }   // 갑판에 앉아 있으면 자세 = 갑판 자세(계기도 그대로)
    }
    }
  } else if(!S.running){
    // bank snaps back to level even when not flying
    const bankDiff=bankTarget-S.bnk;
    if(Math.abs(bankDiff)>0.2) S.bnk+=Math.sign(bankDiff)*Math.min(Math.abs(bankDiff),60/60);
    else S.bnk=bankTarget;
  }

  // Ship movement (wind-independent)
  if (shipVisible && shipMarker && shipSpd > 0 && S.lastT !== null) {
    const sdt = (ts - S.lastT) / 1000 * simSpeed;   // 배가 항공기와 같은 시간을 흐르게
    if (sdt > 0 && sdt < 0.5 * simSpeed) {
      shipVarStep(sdt);                               // 난이도만큼 속도가 흔들린다
      const [nLat, nLon] = destPoint(shipLat, shipLon, shipHdg, shipSpdNow() * sdt / 3600);
      // 갑판에 앉아 있는 헬기는 함정과 함께 간다(일시정지 중에도 — 함정은 계속 가므로)
      if (typeof simOnDeck === 'function' && simOnDeck()) {
        S.lat += nLat - shipLat; S.lon += nLon - shipLon;
        if (!S.running) { try { updateAcOnMap(); } catch (e) { _swallow(e); } }
      }
      shipLat = nLat; shipLon = nLon;
      if (!shipDragging) shipMarker.setLatLng([shipLat, shipLon]);
      try { updateShip3d(); } catch (e) { _swallow(e); }
      const slast = shipTrail[shipTrail.length - 1];
      if (!slast || distance(slast[0], slast[1], shipLat, shipLon) > 0.01) {
        shipTrail.push([shipLat, shipLon]);
        if (shipTrail.length > 600) shipTrail.shift();
        updateShipTrail();
      }
    }
  }
  S.lastT=ts;
  updateHoverBtns();
  try { updateSuspBtn(); } catch(e) { _swallow(e); }
  try { updateGsBtn(); } catch(e) { _swallow(e); }
  try { updateDgCompass(); } catch(e) { _swallow(e); }
  try { sndFrame(); } catch(e) { _swallow(e); }   // 로터 소리(16-sound.js)
  try { fpWptLiveTick(ts); } catch(e) { _swallow(e); }
  // 스톱워치에 흘려 넣을 시간 — 기체가 겪는 시간과 같아야 한다.
  // 배속이 걸리면 그만큼 빨리, 시뮬이 멈춰 있으면 함께 멈춘다.
  // GPS 모드는 실제 비행이므로 실시간으로 간다(여기서 멈추면 안 된다).
  if (_swPrevTs !== null) {
    const _swReal = ts - _swPrevTs;
    if (_swReal > 0 && _swReal < 2000) {
      swAddMs(gpsMode ? _swReal
            : (S.running && !_fdrPlaying) ? _swReal * simSpeed : 0);
    }
  }
  _swPrevTs = ts;
  swRender();
  // 발열 저감: GPS 모드(데이터 3초 주기)에서는 PFD를 10fps로 제한.
  // 시뮬 비행·FDR 리플레이는 기존 60fps 유지.
  let _lowFps = false;
  if (gpsMode) _lowFps = !_fdrPlaying;
  // 시뮬이 멈춰 있으면(일시정지 · 시작 전) PFD 는 초당 20번이면 충분하다 — 노브 · 버튼은 그대로 바로 보인다(누르면 drawPFD 를 따로 부른다)
  const _pfdGap = _lowFps ? 100 : (!S.running && !_fdrPlaying ? 50 : 0);
  if (!_pfdGap || performance.now() - _pfdDrawLast >= _pfdGap) {
    _pfdDrawLast = performance.now();
    // 자가치유: PFD가 보이는데 캔버스 크기가 표시영역과 어긋나면 재조정.
    // (풀스크린→분할 복귀 시 레이아웃이 늦게 잡혀 캔버스가 0크기로 남아
    //  PFD가 검게 되는 경우를 감지해 자동 복구)
    {
      // (PFD가 좌/우 어느 패널에 있든 clientHeight>0 이면 표시 중)
      const _pw = document.getElementById('pfd-wrap');
      if (_pw && _pw.clientHeight > 0 &&
          (cvs.width !== pfdCanvasW() || cvs.height !== _pw.clientHeight)) {
        resizePFD();
      }
    }
    drawPFD();
    try { pfdOverlayDraw(); } catch (e) { _swallow(e); }   // 3D 화면에 겹친 계기
  }
  } catch(e) {
    // 한 프레임의 예외로 rAF 체인이 끊겨 PFD가 검게 멈추는 것을 방지
    console.warn('simStep error:', e);
  }
  if (!noLoop) requestAnimationFrame(simStep);
}
// 이중 안전장치: 루프가 어떤 이유로든 3초 이상 멈추면 재기동
// (백그라운드 탭에서는 rAF가 원래 멈추므로 visible일 때만, 중복 기동 방지 포함)
setInterval(() => {
  if (document.visibilityState === 'visible' && performance.now() - _simLastTick > 3000) {
    console.warn('simStep watchdog: 렌더 루프 재기동');
    _simLastTick = performance.now();
    requestAnimationFrame(simStep);
  }
}, 2000);
// (창 배치 · 화면 모드는 07a-panels.js · FCP SIMPLE · PFD 소프트키는 07b-fcp.js — 이 파일 다음에 읽힌다)
