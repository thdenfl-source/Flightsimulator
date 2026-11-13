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
function applyDelta(field, d){
  switch(field){
    case 'spd':
      // SIM 모드에서는 속도를 곧바로 바꾸지 않는다 — IAS 기준 속도를 옮기고(꺼져 있으면
      // 지금 속도에서 켠다) 기수 자세가 그 속도로 데려간다(14-simmode.js)
      if (simModeOn) { simIasStep(d); break; }
      iasNsOn = true;
      S.spd = Math.max(0, Math.min(320, S.spd + d));
      S.pit = pitchFromSpd(S.spd);   // auto pitch from speed
      break;
    case 'hdg':
      // GSPD(호버) 중에는 HDG 화살표와 기수를 분리 — 요 조작은 ANTI-TORQUE PEDAL로만
      if (gspdOn) break;
      // 기수를 즉시 돌리지 않고 선택 헤딩(HDG bug)만 이동 → AFCS가 표준선회로 추종
      selHdg = ((Math.round(selHdg + d) + 359) % 360) + 1;   // 1–360
      hdgSelOn = true;
      rollApOn = true;
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
      if ((typeof gaOn !== 'undefined') && (gaOn || vsModeOn) && !altHoldOn && !crhtOn) {
        selVS = Math.max(GA_VS_MIN, Math.min(3000, selVS + d));   // G/A · VS — 상승률(최저 300fpm)
      } else if (altHoldOn || crhtOn) {
        // Hold mode active: VS ▲/▼ adjusts the convergence rate preselect.
        // altHoldOn uses selVS directly; crhtOn uses fixed 500 fpm but
        // pre-setting selVS here means it takes effect if ALT hold is engaged next.
        selVS = Math.max(50, Math.min(3000, selVS + d));
      } else {
        S.vs = Math.max(-3000, Math.min(3000, S.vs + d));
      }
      break;
    case 'alt':
      // ALT +/- now adjusts the AFCS target (selAlt). Auto-engages ALT hold so
      // S.alt converges to the new target at selVS rate. Disengages CRHT.
      // 기준이 그 단위가 아니면(누른 순간 고도 1,237 처럼) 먼저 그 단위로 맞춘다(▲ 1,300 · ▼ 1,200)
      { const st = Math.abs(d) || 100;
        const next = d > 0 ? Math.floor(selAlt / st) * st + st : Math.ceil(selAlt / st) * st - st;
        selAlt = Math.max(0, Math.min(45000, next)); }
      altHoldOn = true;
      crhtOn    = false;
      updateHoverBtns();
      break;
    case 'crht': {
      // CRHT +/- adjusts selCrht in fine 10 ft steps. Auto-engages CRHT hold.
      // 기준이 10 단위가 아니면(지금 고도로 걸면 1,237 처럼) 먼저 10 단위로 맞춘다 —
      // ▲ 는 위의 10 단위(1,240), ▼ 는 아래의 10 단위(1,230)로 간다.
      const st = Math.abs(d) || 10;
      const next = d > 0 ? Math.floor(selCrht / st) * st + st : Math.ceil(selCrht / st) * st - st;
      selCrht   = Math.max(0, Math.min(45000, next));
      crhtOn    = true;
      altHoldOn = false;
      updateHoverBtns();
      break;
    }
    case 'hht':
      // HHT — T/D to H 가 내려가 멈출 호버 높이(전파고도). 10ft 단위 · 20~1,000ft. 모드는 걸지 않는다.
      selHht = Math.max(20, Math.min(1000, Math.round(selHht / 10) * 10 + d));
      break;
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
  try { if (navApOn) toggleNavAp(); } catch (e) { _swallow(e); }   // NAV 를 풀면 HDG 로 넘어간다 — 그것도 푼다
  try { if (hdgSelOn || rollApOn) hdgRelease(); } catch (e) { _swallow(e); }
  try { if (altHoldOn) toggleAltHold(); } catch (e) { _swallow(e); }
  try { if (crhtOn) toggleCrht(); } catch (e) { _swallow(e); }
  try { if (gsOn || gsArmed) toggleGs(); } catch (e) { _swallow(e); }
  try { if (simIasOn && typeof simIasRelease === 'function') simIasRelease(); } catch (e) { _swallow(e); }
  try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
  try { if (typeof gaRelease === 'function') gaRelease(); } catch (e) { _swallow(e); }
  try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); }
}

// FCP 라벨(IAS/HDG/CRS) 누름: 해당 상위모드 인게이지 + 현재값 동기화
// - IAS: 속도 프리셀렉트(selSpd)를 현재 속도로
//        (SIM 모드에서는 IAS 상위모드를 켜고 끈다 — 켜면 지금 속도가 기준)
// - HDG: 헤딩 프리셀렉트(selHdg)를 현재 기수방위로 + 현재 헤딩 유지(롤 AP)
// - CRS: 현재 위치에서 NAV 소스(VOR/LOC 국·FMS 활성 웨이포인트)로의 코스 세팅(Direct-To)
function fcpSync(which) {
  if (which === 'ias') {
    if (simModeOn) simIasToggle();
    else { iasNsOn = !iasNsOn; if (iasNsOn) selSpd = Math.max(0, Math.round(S.spd)); }   // 한 번 더 누르면 푼다
    try { drawPFD(); fcpsSync(); } catch (e) { _swallow(e); }
  } else if (which === 'hdg') {
    // IAS·ALT 처럼 한 번 더 누르면 푼다. NAV 가 걸려 있으면 HDG 로 넘긴다(지금 헤딩 유지).
    if (navApOn) toggleNavAp();
    else if (hdgSelOn) hdgRelease();
    else {
      selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1;   // 1–360
      hdgSelOn = true; bankTarget = 0; rollApOn = true;  // 현재 헤딩 유지
    }
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
    } else if (navSrc === 'FMS' && S.awp >= 0) {
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
          const diff = selCrht - radarAltFt();
          if (Math.abs(diff) < 0.5) { S.alt = selCrht + radarGroundFt(); S.vs = 0; }
          else {
            const step = Math.sign(diff) * Math.min(Math.abs(diff), 500 / 60 * dt);
            S.alt = Math.max(0, Math.min(45000, S.alt + step));
            S.vs  = Math.sign(diff) * 500;
          }
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
        const err  = normAS(selHdg - hdgInd());         // -180 ~ +180
        const bMax = stdRateBank(S.spd);
        const aErr = Math.abs(err);
        if (aErr < 0.5) { bankTarget = 0; _hdgJump += err; S.hdg = normA(selHdg - dgErr); }
        else {
          // 롤아웃 구간에서도 최소 뱅크를 유지 — 비행모델이 |bank|<=0.5°를 무시하므로
          // 그 아래로 떨어지면 선회가 멈춘 채 오차가 남는다(저속에서 발생)
          const b = aErr >= HDG_ROLLOUT_DEG ? bMax : Math.max(1.2, bMax * aErr / HDG_ROLLOUT_DEG);
          bankTarget = Math.sign(err) * b;
        }
      }

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
  if (!_lowFps || performance.now() - _pfdDrawLast >= 100) {
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

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
let currentPage = 0;
let leftPage = 0;
// 354×567 규격의 화면(CDU · Flight Plan)을 패널 크기에 맞춰 축소·중앙정렬
// CDU 화면(354×567 규격)이 패널 안에서 실제로 차지하는 사각형.
// 패널이 넓으면 좌우가, 높으면 위아래가 남는다(레터박스).
// CDU 화면들은 이 사각형 안에 그린다 — 차트 뷰어만 예외로 패널 전체를 쓴다.
function cduFrameRect(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return null;
  void wrap.offsetWidth;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return null;
  const s = Math.min(w / 354, h / 567);
  return { left: (w - 354*s)/2, top: (h - 567*s)/2, w: 354*s, h: 567*s, scale: s };
}
function _scaleFrame(wrapId, scalerId) {
  const scaler = document.getElementById(scalerId);
  const r = cduFrameRect(wrapId);
  if (!scaler || !r) return;
  scaler.style.transform = `translate(${r.left}px,${r.top}px) scale(${r.scale})`;
}
function scaleCdu() {
  _scaleFrame('cdu-wrap', 'cdu-scaler');
  _scaleFrame('fp-wrap',  'fp-scaler');   // Flight Plan도 같은 규격
}

// ── 패널 선택 시스템: 좌/우 각각 PFD·MAP·CDU 중 하나를 표시 ──
// pfd-wrap/map-wrap/cdu-wrap 은 각 1개뿐 → 선택된 패널로 DOM 이동.
// 양쪽에 같은 창은 불가(사용자 클릭은 거부 피드백, 프로그램 호출은 스왑).
let leftSel = 'pfd', rightSel = 'map';   // 'pfd' | 'map' | 'cdu' | (우측 한정 'plan')
let midSel  = 'map';                    // 3분할일 때만 사용하는 중앙 패널
// 처음 켜면 3분할 — 좌 PFD · 중 CDU · 우 MAP 이 기본 구성이다(2분할이면 PFD · MAP).
// 사용자가 2분할을 골라 뒀으면(저장값 '0') 그 뜻을 따른다(배치를 바꾼 뒤로는 새 키로 본다).
let tripleMode = true;                  // 3분할(PFD·CDU·MAP) 여부 — 4분할도 가운데 창을 쓰므로 함께 참
// 4분할 — 위에 PFD · 3D · MAP, 아래에 CDU(아래 창 botSel)
let quadMode = false, botSel = 'cdu';
try {
  const v = localStorage.getItem('tripleMode2');
  if (v !== null) tripleMode = (v === '1');
  const m = localStorage.getItem('splitMode');
  if (m === '4') { quadMode = true; tripleMode = true; }
  else if (m === '3') tripleMode = true;
  else if (m === '2') tripleMode = false;
} catch(e) { _swallow(e); }
if (quadMode) { leftSel = 'pfd'; midSel = 'm3d'; rightSel = 'map'; botSel = 'cdu'; }
else if (tripleMode) { leftSel = 'pfd'; midSel = 'cdu'; rightSel = 'map'; }
// 지금 쓰는 패널들(4분할이면 아래 창까지)
function panelSides() { return quadMode ? ['left', 'mid', 'right', 'bot'] : tripleMode ? ['left', 'mid', 'right'] : ['left', 'right']; }

// 3분할 분할 비율 [좌%, 중%] — null 이면 기본 배분(PFD 호스트 1.4배)
const TRI_MIN = 12;                     // 한 창의 최소 비율(%)
let triRatio = null;
try {
  const s = JSON.parse(localStorage.getItem('triSplit') || 'null');
  if (Array.isArray(s) && s.length === 2 && s.every(v => typeof v === 'number')) triRatio = s;
} catch(e) { _swallow(e); }

// 기본 3분할 배분 — PFD 가 있는 창만 FCP 조작부가 다 보이도록 1.4배
function triDefaultRatio() {
  const w = [leftSel, midSel, rightSel].map(s => s === 'pfd' ? 1.4 : 1);
  const t = w[0] + w[1] + w[2];
  return [w[0] / t * 100, w[1] / t * 100];
}
function applyTriRatio() {
  const app = document.getElementById('app');
  if (!app) return;
  const [l, m] = triRatio || triDefaultRatio();
  app.style.setProperty('--tri-l', l.toFixed(3) + '%');
  app.style.setProperty('--tri-m', m.toFixed(3) + '%');
}
function saveTriRatio() {
  try { localStorage.setItem('triSplit', JSON.stringify(triRatio)); } catch(e) { _swallow(e); }
}

// 3분할 ⇄ 2분할 전환. 3분할 진입 시 PFD·MAP·CDU를 좌·중·우로 배치한다.
function toggleTriple(on) {
  setSplitMode(((on === undefined) ? !tripleMode : !!on) ? 3 : 2);
}
// 2 · 3 · 4 분할. 기본 배치 — 2분할 PFD · MAP / 3분할 PFD · CDU · MAP / 4분할 위 PFD · 3D · MAP · 아래 CDU
function setSplitMode(n) {
  quadMode = n === 4; tripleMode = n >= 3;
  try { localStorage.setItem('splitMode', String(n)); localStorage.setItem('tripleMode2', tripleMode ? '1' : '0'); } catch(e) { _swallow(e); }
  if (quadMode) { leftSel = 'pfd'; midSel = 'm3d'; rightSel = 'map'; botSel = 'cdu'; }
  else if (tripleMode) { leftSel = 'pfd'; midSel = 'cdu'; rightSel = 'map'; }
  else { leftSel = 'pfd'; rightSel = 'map'; }
  applyPanels();
}
// ── 4분할 비율 — [1열 폭 %, 2열 폭 %, 3열 위 창 높이 %] · 경계 그립을 끌어 바꾼다 ──
const QUAD_DEF = [36, 32, 55], QUAD_MIN = 12;
let quadRatio = QUAD_DEF.slice();
try { const q = JSON.parse(localStorage.getItem('quadSplit') || 'null'); if (Array.isArray(q) && q.length === 3 && q.every(Number.isFinite)) quadRatio = q; } catch (e) { _swallow(e); }
function applyQuadRatio() {
  const app = document.getElementById('app'); if (!app) return;
  app.style.setProperty('--q1', quadRatio[0].toFixed(2) + '%');
  app.style.setProperty('--q2', quadRatio[1].toFixed(2) + '%');
  app.style.setProperty('--q3', quadRatio[2].toFixed(2) + '%');
}
(function initQuadGrips() {
  const app = document.getElementById('app');
  if (!app) return;
  const after = () => {
    requestAnimationFrame(() => { try { resizePFD(); drawPFD(); } catch (e) { _swallow(e); } });
    setTimeout(() => {
      try { leafMap.invalidateSize(); } catch (e) { _swallow(e); }
      try { if (_ml3d) _ml3d.resize(); } catch (e) { _swallow(e); }
      try { scaleCdu(); } catch (e) { _swallow(e); }
    }, 60);
  };
  const bind = (id, which) => {
    const el = document.getElementById(id); if (!el) return;
    let drag = false;
    el.addEventListener('pointerdown', e => { if (!quadMode) return; e.preventDefault(); drag = true; try { el.setPointerCapture(e.pointerId); } catch (err) { _swallow(err); } });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = app.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
      let [a, b, c] = quadRatio;
      if (which === 1) { const edge = a + b; a = Math.max(QUAD_MIN, Math.min(edge - QUAD_MIN, px)); b = edge - a; }
      else if (which === 2) { b = Math.max(QUAD_MIN, Math.min(100 - QUAD_MIN - a, px - a)); }
      else { c = Math.max(15, Math.min(85, py)); }
      quadRatio = [a, b, c]; applyQuadRatio();
      try { resizePFD(); } catch (err) { _swallow(err); }
      try { scaleCdu(); } catch (err) { _swallow(err); }   // CDU 도 PFD 처럼 끄는 동안 바로 맞춘다
    });
    const end = () => { if (!drag) return; drag = false; try { localStorage.setItem('quadSplit', JSON.stringify(quadRatio)); } catch (err) { _swallow(err); } after(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => {
      const d = QUAD_DEF;
      if (which === 1) { quadRatio[0] = d[0]; quadRatio[1] = d[1]; } else if (which === 2) quadRatio[1] = d[1]; else quadRatio[2] = d[2];
      applyQuadRatio(); try { localStorage.setItem('quadSplit', JSON.stringify(quadRatio)); } catch (err) { _swallow(err); } after();
    });
  };
  bind('qgrip-1', 1); bind('qgrip-2', 2); bind('qgrip-3', 3);
  applyQuadRatio();
})();
// 분할 버튼 — 2 → 3 → 4 → 2 분할로 돌아간다
function cycleSplit() { setSplitMode(quadMode ? 2 : tripleMode ? 4 : 3); }

// ── 3D 지도의 자리 옮기기 ──
// 3D 지도(#map3d)는 한 벌뿐이다. 평소에는 2D 지도 위에 겹쳐 쓰고(지도 툴바의 3D 버튼),
// 탭에서 '3D' 를 고르면 그 창으로 통째로 옮겨 간다. 그러면 2D 와 3D 를 나란히 볼 수 있다.
function map3dPanelOn() {
  return leftSel === 'm3d' || (tripleMode && midSel === 'm3d') || rightSel === 'm3d' || (quadMode && botSel === 'm3d');
}
// 3D 지도가 지금 화면에 떠 있는가(겹쳐 쓰든, 제 창을 쓰든) — 카메라 추종 판단에 쓴다
function syncMap3dHost(toPanel) {
  const d3 = document.getElementById('map3d');
  const w3 = document.getElementById('map3d-wrap');
  const mw = document.getElementById('map-wrap');
  const tilt = document.getElementById('tilt-ctrl');
  if (!d3 || !w3 || !mw) return;
  if (toPanel) {
    if (d3.parentElement !== w3) w3.appendChild(d3);
    const chin = document.getElementById('chin-row');    // CHIN 창은 3D 지도 바로 뒤에 붙어 다닌다
    if (chin && chin.previousElementSibling !== d3) d3.after(chin);
    d3.classList.add('panel-3d', 'active');
    mw.classList.remove('map3d-on');          // 2D 는 제 창에서 그대로 보인다
    if (tilt) tilt.classList.add('active');
    try { _init3dMap(); } catch (e) { _swallow(e); }
    requestAnimationFrame(() => {
      try { if (_ml3d) { _ml3d.resize(); _applyFollow(); } } catch (e) { _swallow(e); }
    });
  } else {
    if (d3.parentElement !== mw) mw.insertBefore(d3, mw.firstElementChild.nextSibling);
    const chin = document.getElementById('chin-row');
    if (chin && chin.previousElementSibling !== d3) d3.after(chin);
    d3.classList.remove('panel-3d');
    // 3D 창 안에서 열었던 함정 메뉴·설정창은 2D 지도 창으로 돌려보낸다
    try { if (typeof shipUiHome === 'function') shipUiHome(false); } catch (e) { _swallow(e); }
    // 제 창에서 빠져나오면 겹치기 모드의 상태(3D 버튼)를 그대로 따른다
    d3.classList.toggle('active', _view3dOn);
    mw.classList.toggle('map3d-on', _view3dOn);
    if (tilt) tilt.classList.toggle('active', _view3dOn);
    setTimeout(() => { try { leafMap.invalidateSize(); } catch (e) { _swallow(e); } }, 50);
  }
}

// 같은 창으로 치는 묶음 — PLAN 은 CDU 창의 한 화면이다.
// 2D 지도(map)와 3D 지도(m3d)는 서로 다른 창이라 나란히 둘 수 있다.
function panelFam(sel) { return sel === 'plan' ? 'cdu' : sel; }
function panelGet(k) { return k === 'left' ? leftSel : k === 'mid' ? midSel : k === 'bot' ? botSel : rightSel; }
function panelSet(k, v) { if (k === 'left') leftSel = v; else if (k === 'mid') midSel = v; else if (k === 'bot') botSel = v; else rightSel = v; }
// 두 창이 같은 것을 가리키고 있으면 바로잡는다. 저장된 배치를 되살릴 때처럼
// selectPanel 을 거치지 않는 길도 있어서, 그릴 때 한 번 더 본다.
// (지도는 2D·3D 가 서로 다른 창이라 나란히 둘 수 있다)
function fixPanelDupes() {
  const sides = panelSides();
  // 화면 배치 — 좌측은 PFD 창(탭으로 SYSTEM 창으로도 바꿀 수 있다)이고, 가운데·우측은 CDU·MAP·3D 중에서 고른다(단독 화면 중은 빼고)
  const solo = document.body.classList.contains('solo-mode');
  if (!solo) {
    if (leftSel !== 'sysp') leftSel = 'pfd';
    if (midSel === 'pfd') midSel = 'cdu';
    if (rightSel === 'pfd') rightSel = 'map';
    if (botSel === 'pfd') botSel = 'cdu';
  }
  const seen = new Set();
  sides.forEach(k => {
    let v = panelGet(k);
    if (seen.has(panelFam(v))) {
      v = (solo ? ['pfd', 'map', 'cdu', 'm3d'] : ['map', 'cdu', 'm3d']).find(x => !seen.has(panelFam(x))) || 'map';
      panelSet(k, v);
    }
    seen.add(panelFam(v));
  });
}

function selectPanel(side, sel, force) {
  const get = panelGet, set = panelSet;
  const sides = panelSides();
  if (!sides.includes(side)) side = 'right';
  // 같은 창을 이미 다른 패널이 갖고 있으면 서로 맞바꾼다(창이 사라지지 않게).
  // CDU 와 PLAN 은 '한 창의 두 화면' 이므로 같은 것으로 친다 — 따로 보면
  // 두 패널에 CDU 가 겹쳐 뜨고, 한쪽에서 FPL 을 눌러도 다른 쪽이 바뀐다.
  const holder = sides.find(k => k !== side && panelFam(get(k)) === panelFam(sel));
  if (holder) set(holder, get(side));
  set(side, sel);
  applyPanels();
}

function applyPanels() {
  fixPanelDupes();
  const L = document.getElementById('left-panel');
  const M = document.getElementById('mid-panel');
  const R = document.getElementById('right-panel');
  const B = document.getElementById('bot-panel');
  const app = document.getElementById('app');
  app.classList.toggle('triple', tripleMode);
  app.classList.toggle('quad', quadMode);
  try { applyPoRatio(); } catch (e) { _swallow(e); }
  // 새로고침은 CDU 창(3분할의 가운데) 탭에 — 2분할에는 가운데가 없으니 우측 탭 끝에
  try {
    const rb = document.getElementById('reload-btn');
    const tabs = document.getElementById(quadMode ? 'bot-tabs' : tripleMode ? 'mid-tabs' : 'page-tabs');
    if (rb && tabs && rb.parentElement !== tabs) tabs.appendChild(rb);
  } catch (e) { _swallow(e); }
  const btn = document.getElementById('split-toggle');
  if (btn) btn.textContent = quadMode ? '⿰ 2분할' : tripleMode ? '▦ 4분할' : '⿲ 3분할';

  const wrapIds = { pfd: 'pfd-wrap', map: 'map-wrap', cdu: 'cdu-wrap', m3d: 'map3d-wrap',
                    plan: 'fp-wrap', ovhd: 'ovhd-wrap', sysp: 'sysp-wrap', lcon: 'lcon-wrap' };
  // 화면 하나만 새 창에 띄운 것(SIM Mode 창 배치판 · 00-popout.js popoutScreen)은 그 그릇이 먼저다
  const scrHost = k => (window._scrHost && window._scrHost[k]) ? document.getElementById('po-host-' + k) : null;
  // Simple mode — 고른 화면 하나가 전체 화면 그릇(#simple-host)을 차지한다
  const simpleHost = k => (window._simpleScr === k) ? document.getElementById('simple-host') : null;
  const hostOf0 = k => simpleHost(k) || scrHost(k) || (leftSel === k ? L : (tripleMode && midSel === k ? M : (rightSel === k ? R : (quadMode && botSel === k ? B : null))));
  // SYSTEM 창의 Map 화면(18-system.js) — 지도가 다른 창에 없고 SYSTEM 창이 보이면 그 큰 칸이 지도 그릇
  const sysMapHost = () => { try { return (typeof sysMapSlot === 'function' && (ckC('sysp', 'pop') || hostOf0('sysp'))) ? sysMapSlot() : null; } catch (e) { return null; } };
  // SIM 3D 조종석(15-heli3d.js) — 콘솔 팝아웃(LowerC · UpperC)은 무엇보다 먼저, 조종석 안의 작은 콘솔은 다른 창에 없을 때만
  const ckC = (k, ph) => { try { return typeof ckpitConsoleHost === 'function' ? ckpitConsoleHost(k, ph) : null; } catch (e) { return null; } };
  const hostOf = k => ckC(k, 'pop') || hostOf0(k) || (k === 'map' ? sysMapHost() : null) || ckC(k, 'mini');
  ['pfd', 'map', 'cdu', 'm3d', 'plan', 'ovhd', 'sysp', 'lcon'].forEach(k => {
    const el = document.getElementById(wrapIds[k]);
    if (!el) return;
    const host = hostOf(k);
    if (host && el.parentElement !== host) host.appendChild(el);
    el.classList.toggle('page-hidden', !host);
  });
  // 3D 지도를 어느 창이 쓰는지 — 지도 위에 겹칠지, 제 창을 통째로 쓸지
  syncMap3dHost(!!hostOf('m3d'));
  // 상부 콘솔은 처음 보일 때 만들고, 창 크기에 맞춘다(17-upper.js)
  if (hostOf('ovhd')) { try { if (typeof ovhdShow === 'function') ovhdShow(); } catch (e) { _swallow(e); } }
  if (hostOf('lcon')) { try { if (typeof lconShow === 'function') lconShow(); } catch (e) { _swallow(e); } }
  if (hostOf('sysp')) { try { if (typeof sysShow === 'function') requestAnimationFrame(sysShow); } catch (e) { _swallow(e); } }
  try { syncChinView(); } catch (e) { _swallow(e); }   // CHIN 창도 3D 지도를 따라간다

  // PFD 호스트 패널은 FCP 조작부가 다 보이도록 넓게(2분할 55% / 3분할 1.4배)
  L.classList.toggle('pfd-host', leftSel === 'pfd');
  M.classList.toggle('pfd-host', tripleMode && midSel === 'pfd');
  R.classList.toggle('pfd-host', rightSel === 'pfd');

  // 탭 활성 표시
  // PLAN 은 CDU 자리에서 열리는 화면이라 탭은 CDU 가 켜진 것으로 본다
  const tabSel = v => (v === 'plan' ? 'cdu' : v);
  document.querySelectorAll('#left-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(leftSel)));
  document.querySelectorAll('#mid-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(midSel)));
  document.querySelectorAll('#page-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(rightSel)));
  document.querySelectorAll('#bot-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(botSel)));

  // 레거시 상태 동기화(솔로 모드 진입 판단 등에서 사용)
  leftPage = (leftSel === 'map' || leftSel === 'm3d') ? 1 : 0;
  currentPage = rightSel === 'map' ? 0 : rightSel === 'plan' ? 1 : rightSel === 'cdu' ? 2 : 0;

  // 3분할은 --tri-l/--tri-m 로 배분한다(2분할의 인라인 flex 는 무효화)
  if (tripleMode) { L.style.flex = ''; applyTriRatio(); }
  // 크기 재계산
  requestAnimationFrame(() => { resizePFD(); drawPFD(); scaleCdu(); });
  setTimeout(() => {
    try { leafMap.invalidateSize(); } catch(e) { _swallow(e); }
    try { if (_ml3d) _ml3d.resize(); } catch(e) { _swallow(e); }
    scaleCdu();
  }, 60);
}

// 처음 켤 때 한 번 맞춘다. 마크업의 초기 배치는 2분할(PFD|MAP)이라,
// 위에서 정한 기본값(3분할 · 좌 PFD · 중 MAP · 우 CDU)을 여기서 화면에 반영한다.
// 저장된 세션을 복원하면 그쪽에서 다시 applyPanels 를 부르므로 그 뜻이 이긴다.
try { applyPanels(); } catch(e) { _swallow(e); }

// 레거시 래퍼 — 기존 호출부(CDU 버튼·솔로 모드 등) 호환
function setLeftPage(n) { selectPanel('left', n === 0 ? 'pfd' : 'map', true); }
function setPage(n) { selectPanel('right', ['map', 'plan', 'cdu'][n] || 'map', true); }

// ── 분할 비율 조절: 경계선 그립을 드래그(좌우/위아래) ──
// 2분할: 좌측 패널에 인라인 flex-basis를 지정(pfd-host 55% 규칙보다 우선)
// 3분할: 두 경계선을 각각 드래그. 인접한 두 창만 서로 크기를 주고받는다.
// ── 패널을 새 창으로 띄운 뒤 본 창에 남은 패널(00-popout.js) ──
// 둘이 남으면 그 사이 경계를 끌어 비율을 고른다 — 앞쪽 패널이 poRatio(%)를 갖고 뒤쪽이 나머지를 채운다
let poRatio = 50;
function poRemaining() {
  const sides = (typeof popoutSides === 'function') ? popoutSides() : [];
  if (!sides.length) return [];
  if (quadMode) return [];   // 4분할은 경계 끌기를 쓰지 않는다
  return ['left', 'mid', 'right'].filter(k => !sides.includes(k) && (k !== 'mid' || tripleMode))
    .map(k => document.getElementById(k + '-panel')).filter(el => el && el.ownerDocument === document);
}
function applyPoRatio() {
  const app = document.getElementById('app');
  if (!app) return;
  const rem = poRemaining();
  ['left', 'mid', 'right'].forEach(k => { const el = document.getElementById(k + '-panel'); if (el) el.classList.remove('po-a'); });
  if (rem.length === 2) rem[0].classList.add('po-a');
  app.style.setProperty('--po-a', poRatio.toFixed(2) + '%');
  try { resizePFD(); } catch (e) { _swallow(e); }
}
(function initDividerDrag() {
  const grip  = document.getElementById('divider-grip');
  const grip2 = document.getElementById('divider-grip-2');
  const app   = document.getElementById('app');
  const L     = document.getElementById('left-panel');
  if (!grip || !app || !L) return;

  // 좌측을 고정폭으로 두고, 우측은 남은 공간을 채우도록(split-custom) 전환
  const applyRatio = pct => { L.style.flex = `0 0 ${pct}%`; app.classList.add('split-custom'); };
  const afterResize = () => {
    requestAnimationFrame(() => { try { resizePFD(); drawPFD(); } catch(e) { _swallow(e); } });
    setTimeout(() => {
      try { leafMap.invalidateSize(); } catch(e) { _swallow(e); }
      try { if (_ml3d) _ml3d.resize(); } catch(e) { _swallow(e); }
      try { scaleCdu(); } catch(e) { _swallow(e); }
    }, 60);
  };

  // 저장된 비율 복원
  const saved = parseFloat(localStorage.getItem('splitRatio'));
  if (!isNaN(saved) && saved >= 25 && saved <= 75) applyRatio(saved);
  if (tripleMode) applyTriRatio();
  afterResize();

  // 포인터 위치를 앱 기준 0~100% 로
  const pctOf = e => {
    const r = app.getBoundingClientRect();
    return (r.width >= r.height)
      ? (e.clientX - r.left) / r.width * 100
      : (e.clientY - r.top) / r.height * 100;
  };

  // which: 1 = 좌|중 경계, 2 = 중|우 경계(3분할 전용)
  function bind(el, which) {
    if (!el) return;
    let dragging = false;
    el.addEventListener('pointerdown', e => {
      if (which === 2 && !tripleMode && !poRemaining().length) return;
      e.preventDefault(); dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch(err) { _swallow(err); }
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      const pct = pctOf(e);
      // 패널 하나를 새 창으로 띄워 둘만 남았으면 — 남은 경계로 그 둘의 비율을 고른다(00-popout.js)
      if (poRemaining().length === 2) {
        poRatio = Math.max(15, Math.min(85, pct));
        applyPoRatio();
      } else if (!tripleMode) {
        applyRatio(Math.max(25, Math.min(75, pct)));
      } else {
        const cur = triRatio || triDefaultRatio();
        let [l, m] = cur;
        if (which === 1) {
          // 좌|중 경계 — 좌·중이 서로 주고받고 우측 폭은 유지
          const edge = l + m;
          l = Math.max(TRI_MIN, Math.min(edge - TRI_MIN, pct));
          m = edge - l;
        } else {
          // 중|우 경계 — 중·우가 서로 주고받고 좌측 폭은 유지
          const edge = Math.max(l + TRI_MIN, Math.min(100 - TRI_MIN, pct));
          m = edge - l;
        }
        triRatio = [l, m];
        applyTriRatio();
      }
      try { resizePFD(); } catch(err) { _swallow(err); }
      try { scaleCdu(); } catch(err) { _swallow(err); }   // CDU 도 PFD HSI 처럼 끄는 동안 바로 맞춘다(놓은 뒤가 아니라)
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (poRemaining().length === 2) { /* 새 창 배치의 비율은 그 동안만 쓴다 */ }
      else if (tripleMode) saveTriRatio();
      else {
        const mm = /0 0 ([\d.]+)%/.exec(L.style.flex || '');
        if (mm) try { localStorage.setItem('splitRatio', mm[1]); } catch(err) { _swallow(err); }
      }
      afterResize();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 더블탭/더블클릭 → 기본 배분으로 되돌리기
    el.addEventListener('dblclick', () => {
      if (poRemaining().length === 2) { poRatio = 50; applyPoRatio(); }
      else if (tripleMode) { triRatio = null; applyTriRatio(); saveTriRatio(); }
      else { L.style.flex = ''; app.classList.remove('split-custom');
             try { localStorage.removeItem('splitRatio'); } catch(err) { _swallow(err); } }
      afterResize();
    });
  }
  bind(grip, 1);
  bind(grip2, 2);
})();

// CDU 홈의 MAP 버튼 — 분할/전체화면 모두에서 MAP 창을 연다.
// 전체화면(solo)에서는 map-wrap이 숨겨진 좌측 패널에 있을 수 있어 setPage(0)로는
// 검은 화면이 되므로, solo 모드일 때는 solo MAP 화면으로 전환한다.
function cduOpenMap() {
  // 지도가 어느 창에도 안 보이고 SYSTEM 창이 보이면(예: Cockpit Mode) — SYSTEM 창의 큰 칸에 지도(Map 화면)
  try {
    const mw = document.getElementById('map-wrap'), sw = document.getElementById('sysp-wrap');
    const shown = el => el && !el.classList.contains('page-hidden') && el.getBoundingClientRect().width > 0;
    if (typeof sysPageSet === 'function' && shown(sw) && (!shown(mw) || (typeof sysPage !== 'undefined' && sysPage === 'map'))) { sysPageSet('map'); return; }
  } catch (e) { _swallow(e); }
  // 3D 단독에서는 단독 화면을 바꾸지 않고 MAP 을 계기 칸 크기로 겹쳐 띄운다(MAP ON/OFF 와 같다)
  if (_soloActive && _soloCurrent === 'm3d') {
    if (!mapOvOn) { mapOvOn = true; try { localStorage.setItem(MAP_OV_PREF, '1'); } catch (e) { _swallow(e); } }
    syncMapOverlay(); return;
  }
  if (_soloActive) setSolo('map');
  else setPage(0);
}

// ══════════════════════════════════════════════════════
// 화면 터치 잠금 — 비행 중 오조작 방지 (길게 눌러 해제)
// ══════════════════════════════════════════════════════
const LOCK_HOLD_MS = 1200;
let _screenLocked = false;
function lockScreen() {
  _screenLocked = true;
  document.getElementById('lock-overlay').classList.add('on');
  const b = document.getElementById('lock-btn'); if (b) b.classList.add('locked');
  try { navigator.vibrate && navigator.vibrate(40); } catch(e) { _swallow(e); }
}
function unlockScreen() {
  _screenLocked = false;
  document.getElementById('lock-overlay').classList.remove('on');
  const b = document.getElementById('lock-btn'); if (b) b.classList.remove('locked');
  const f = document.getElementById('lock-unlock-fill'); if (f) f.style.width = '0%';
  const t = document.getElementById('lock-unlock-txt'); if (t) t.textContent = '길게 눌러 해제';
  try { navigator.vibrate && navigator.vibrate([40, 60, 40]); } catch(e) { _swallow(e); }
}
(function initScreenLock() {
  const btn  = document.getElementById('lock-unlock');
  const fill = document.getElementById('lock-unlock-fill');
  const txt  = document.getElementById('lock-unlock-txt');
  const ov   = document.getElementById('lock-overlay');
  if (!btn || !ov) return;
  let t0 = 0, raf = null;
  const stop = () => {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    t0 = 0; fill.style.width = '0%'; txt.textContent = '길게 눌러 해제';
  };
  const tick = () => {
    if (!t0) return;
    const el = performance.now() - t0;
    const p = Math.min(1, el / LOCK_HOLD_MS);
    fill.style.width = (p * 100) + '%';
    txt.textContent = p < 1 ? '해제 중…' : '해제';
    if (p >= 1) { stop(); unlockScreen(); return; }
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    try { btn.setPointerCapture(e.pointerId); } catch(err) { _swallow(err); }
    t0 = performance.now(); tick();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(ev =>
    btn.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); stop(); }));
  // 오버레이 자체는 모든 입력을 흡수(잠금 유지)
  ['pointerdown','pointerup','click','touchstart','touchmove','wheel'].forEach(ev =>
    ov.addEventListener(ev, e => { if (e.target === ov || e.target.id === 'lock-badge') { e.preventDefault(); e.stopPropagation(); } },
      { passive: false }));
})();

// ══════════════════════════════════════════════════════
// RULER — 지도에서 두 점 이상을 찍어 거리·방위 측정
// ══════════════════════════════════════════════════════
let _rulerOn = false, _rulerPts = [], _rulerLayer = null;
// RULER_VAR(자기편차)는 HOVER PAGE 판독에서도 쓰이므로 D2R 옆(상단)에 선언한다.

function toggleRuler() {
  _rulerOn = !_rulerOn;
  const b = document.getElementById('map-ruler-btn');
  if (b) b.classList.toggle('ruler-active', _rulerOn);
  if (_rulerOn) {
    leafMap.on('click', _rulerClick);
    try { leafMap.getContainer().style.cursor = 'crosshair'; } catch(e) { _swallow(e); }
    _rulerRender();
  } else {
    leafMap.off('click', _rulerClick);
    try { leafMap.getContainer().style.cursor = ''; } catch(e) { _swallow(e); }
    _rulerClearAll();
  }
}
function _rulerClick(e) { _rulerPts.push([e.latlng.lat, e.latlng.lng]); _rulerRender(); }
function _rulerUndo() { _rulerPts.pop(); _rulerRender(); }
function _rulerReset() { _rulerPts = []; _rulerRender(); }
function _rulerClearAll() {
  _rulerPts = [];
  if (_rulerLayer) { try { leafMap.removeLayer(_rulerLayer); } catch(e) { _swallow(e); } _rulerLayer = null; }
  const el = document.getElementById('ruler-readout');
  if (el) el.style.display = 'none';
}
function _rulerRender() {
  if (_rulerLayer) { try { leafMap.removeLayer(_rulerLayer); } catch(e) { _swallow(e); } _rulerLayer = null; }
  const g = L.layerGroup();
  const P = _rulerPts;
  // 점 표시
  P.forEach((p, i) => {
    L.circleMarker(p, { radius: 4, color: '#ffd54f', weight: 2, fillColor: '#000', fillOpacity: 1, interactive: false }).addTo(g);
    if (i === 0) L.marker(p, { interactive: false, icon: L.divIcon({ className:'', iconSize:[0,0],
      html:`<div style="transform:translate(6px,-16px);color:#ffd54f;font-size:9px;font-weight:bold;text-shadow:1px 1px 2px #000;">START</div>` }) }).addTo(g);
  });
  let total = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i-1], b = P[i];
    const d = distance(a[0], a[1], b[0], b[1]);
    const brg = bearing(a[0], a[1], b[0], b[1]);
    total += d;
    L.polyline([a, b], { color: '#ffd54f', weight: 2, opacity: 0.95, dashArray: '6 4', interactive: false }).addTo(g);
    // 구간 라벨(중점)
    const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
    L.marker(mid, { interactive: false, icon: L.divIcon({ className:'', iconSize:[0,0],
      html:`<div style="transform:translate(-50%,-50%);background:rgba(8,10,14,0.85);border:1px solid #ffd54f88;border-radius:3px;` +
           `padding:1px 4px;color:#ffd54f;font-size:9px;font-weight:bold;white-space:nowrap;">` +
           `${fmtA(toMag(brg))}° · ${d.toFixed(1)}NM</div>` }) }).addTo(g);
  }
  _rulerLayer = g.addTo(leafMap);

  // 판독창
  const el = document.getElementById('ruler-readout');
  if (!el) return;
  if (!_rulerOn) { el.style.display = 'none'; return; }
  const R = (l, v) => `<div class="rr-row"><span class="rr-lbl">${l}</span><span class="rr-val">${v}</span></div>`;
  let html = '';
  if (P.length < 2) {
    html = `<div style="color:#8a9aa8;font-size:10px;line-height:1.5;">지도를 탭해 점을 찍으세요.<br>두 점 이상이면 거리·방위가 표시됩니다.</div>`;
  } else {
    const a = P[P.length-2], b = P[P.length-1];
    const legD = distance(a[0], a[1], b[0], b[1]);
    const legB = bearing(a[0], a[1], b[0], b[1]);
    const magB = ((Math.round(legB - RULER_VAR) % 360) + 360) % 360;
    html = R('구간 방위', `${String(Math.round(legB)).padStart(3,'0')}°T / ${String(magB).padStart(3,'0')}°M`)
         + R('구간 거리', `${legD.toFixed(2)} NM`)
         + R('합계', `${total.toFixed(2)} NM · ${(total*1.852).toFixed(2)} km`);
    if (P.length > 2) {
      const dd = distance(P[0][0], P[0][1], b[0], b[1]);
      html += R('직선(시작→끝)', `${dd.toFixed(2)} NM`);
    }
  }
  html += `<div class="rr-btns"><button data-act="_rulerUndo">⟲ 취소</button>` +
          `<button data-act="_rulerReset">↺ 초기화</button>` +
          `<button data-act="toggleRuler">✕ 닫기</button></div>`;
  el.innerHTML = html;
  el.style.display = 'block';
}

// ── 단독(전체화면) 진입 ──
// 들어가기 전 창 배치를 적어 둔다. 나올 때 그대로 되돌리기 위해서다
// (종전에는 나오면 무조건 2분할 PFD|MAP 이 되어 3분할 배치가 흐트러졌다).
function enterSolo(screen) {
  if (!_soloActive) _soloSaved = { l: leftSel, m: midSel, r: rightSel, tri: tripleMode, q: quadMode, b: botSel };
  if (quadMode) { quadMode = false; try { document.getElementById('app').classList.remove('quad'); } catch (e) { _swallow(e); } }   // 단독 화면은 4분할 격자를 접고 본다
  _soloActive = true;
  document.getElementById('solo-bar').style.display = 'flex';
  setSolo(screen);
}

// 단독 버튼 — 각 창 탭 줄의 오른쪽 끝. 한 번 더 누르면 원래 배치로 돌아온다.
function panelSolo(screen) {
  if (_soloActive && _soloCurrent === screen) { exitSolo(); return; }
  enterSolo(screen);
}
function pfdSolo() { panelSolo('pfd'); }        // 종전 이름(좌측 상단 버튼)

// 단독 버튼 라벨(단독 ⇄ 분할) — 지금 단독으로 떠 있는 창의 버튼만 되돌리기가 된다
const SOLO_BTNS = { pfd: 'pfd-solo-btn', map: 'map-solo-btn', cdu: 'cdu-solo-btn', m3d: 'm3d-solo-btn' };
const SOLO_NAMES = { pfd: 'PFD', map: 'MAP', cdu: 'CDU', m3d: '3D' };
function updateSoloBtn() {
  Object.keys(SOLO_BTNS).forEach(k => {
    const b = document.getElementById(SOLO_BTNS[k]);
    if (!b) return;
    const on = (_soloActive && _soloCurrent === k);
    b.textContent = on ? '✥ 분할' : `⛶ ${SOLO_NAMES[k]} 단독`;
    b.classList.toggle('active', on);
  });  const ob = document.getElementById('m3d-only-btn');
  if (ob) { const on = _soloActive && _soloCurrent === 'm3d'; ob.textContent = on ? '✥ 분할' : '⛶ 3D Only'; ob.classList.toggle('active', on); }
  try { if (typeof syncFcp3d === 'function') syncFcp3d(); } catch (e) { _swallow(e); }   // 3D 단독에서만 FCP L·R
  try { syncCduOverlay(); } catch (e) { _swallow(e); }   // 3D 단독에서만 CDU 겹치기
  try { syncMapOverlay(); } catch (e) { _swallow(e); }   // 3D 단독에서만 MAP 겹치기
  try { if (typeof syncVStick === 'function') syncVStick(); } catch (e) { _swallow(e); }   // 3D 단독 · SIM 에서만 화면 조종간
}

// MAP 상단 툴바의 FULL/HALF 토글 — 상황에 맞게 전체화면 진입/분할 복귀
function toggleMapFull() {
  if (_soloActive) { exitSolo(); return; }
  enterSolo('map');
}

// ── CDU · PLAN 이 있는 자리 ──
// Flight Plan 은 CDU 의 한 화면이므로 'CDU 가 있는 창' 에서 열려야 한다.
// 종전에는 늘 우측이어서, CDU 를 좌측에 둔 3분할에서 FPL 을 누르면
// 엉뚱하게 우측(PFD) 창이 Flight Plan 으로 바뀌었다.
function cduSide(want) {
  const sides = panelSides();
  const get = panelGet;
  return sides.find(k => get(k) === want)
      || sides.find(k => get(k) === 'cdu' || get(k) === 'plan')
      || 'right';
}
function goCduPage(sel) { selectPanel(cduSide(sel), sel, true); }

// Flight Plan 하단 Home 버튼 — CDU 홈 화면으로 전환
function fpGoCduHome() {
  if (_soloActive) setSolo('cdu');
  else goCduPage('cdu');
  try { switchMode('HOME'); } catch(e) { _swallow(e); }
}

// CDU 하단 Full 버튼 — 상단 Full Screen 탭과 동일하게 CDU 전체화면 진입
function cduFullScreen() { enterSolo('cdu'); }

// ── CDU 하단 푸터 표준화 ──
// 전체화면(solo)일 땐 FULL → HALF(우측 상단 ✕와 동일: exitSolo)
function cduFullNavBtn() {
  // 3D 단독에 겹친 CDU — 단독 화면을 바꾸는 FULL/HALF 는 두지 않는다(3D 단독을 지킨다)
  try { if (cduOvActive()) return `<div class="nav-btn" style="opacity:.35;pointer-events:none"><span>✥</span>3D</div>`; } catch (e) { _swallow(e); }
  return _soloActive
    ? `<div class="nav-btn" data-act="exitSolo"><span>✥</span>Half</div>`
    : `<div class="nav-btn" data-act="cduFullScreen"><span>✥</span>Full</div>`;
}
// PLAN 버튼 — Flight Plan 화면 열기(분할/전체화면 모두 대응)
function openFlightPlan() {
  // 직전에 PROC(IFR) 등을 열어 fpMode가 남아있으면 플랜 목록으로 되돌림
  try { fpMode = 'LIST'; fpRender(); } catch(e) { _swallow(e); }
  if (_soloActive) setSolo('plan'); else goCduPage('plan');
}
// Flight Plan 화면의 FULL — 플랜을 전체화면으로
function planFullScreen() { enterSolo('plan'); }
// Flight Plan 푸터용 FULL/HALF 버튼(solo 상태 반영)
function fpFullBtn() {
  try { if (cduOvActive()) return `<div class="fp-nav-btn" style="opacity:.35;pointer-events:none"><span>✥</span>3D</div>`; } catch (e) { _swallow(e); }
  return _soloActive
    ? `<div class="fp-nav-btn" data-act="exitSolo"><span>✥</span>Half</div>`
    : `<div class="fp-nav-btn" data-act="planFullScreen"><span>✥</span>Full</div>`;
}
// Flight Plan 화면의 BACK — CDU(직전 화면)로 복귀
function fpBackToCdu() {
  if (_soloActive) setSolo('cdu'); else goCduPage('cdu');
}
// 표준 CDU 푸터: HOME · FULL/HALF · PLAN · BACK (+ 필요 시 Enter 등 extra)
// backOnclick이 비어있으면 BACK 버튼은 생략(예: HOME 화면)
// back 인자는 두 가지를 받는다.
//   · 문자열 : 인라인 onclick 으로 그대로 넣는다(전역 함수만 가능).
//   · 함수   : data-act 위임으로 실행한다. CDU 캡슐화 IIFE 안의 함수(clBack 등)는
//             전역에 없어 인라인 onclick 으로는 "not defined" 가 나므로 이쪽을 써야 한다.
let _cduBackFn = null;
function cduFooter(back, extra) {
  let h = `<div class="nav-btn" data-act="switchMode" data-arg='["HOME"]'><span>🏠</span>Home</div>`
        + cduFullNavBtn()
        + `<div class="nav-btn" data-act="switchMode" data-arg='["SETTINGS"]'><span>⚙</span>Setting</div>`;
  if (extra) h += extra;
  // BACK은 항상 제일 우측
  if (typeof back === 'function') {
    _cduBackFn = back;
    h += `<div class="nav-btn" data-act="cduBack"><span>↩</span>Back</div>`;
  } else if (back) {
    h += `<div class="nav-btn" onclick="${back}"><span>↩</span>Back</div>`;
  }
  return h;
}

// ══════════════════════════════════════════════════════
// SOLO (단일화면) 모드
// ══════════════════════════════════════════════════════
let _soloActive = false;
let _soloSaved = null;          // 단독 진입 전 창 배치
let _soloCurrent = null;

function setSolo(screen) {
  // 3D 단독에 CDU 를 겹쳐 쓰는 중이면 CDU·Flight Plan 화면 바꾸기는 그 칸 안에서 — 3D 단독은 그대로
  try { if (_soloActive && _soloCurrent === 'm3d' && cduOvRoute(screen)) return; } catch (e) { _swallow(e); }
  _soloCurrent = screen;
  const leftPanel  = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const divider    = document.getElementById('panel-divider');
  const midPanel   = document.getElementById('mid-panel');

  // 모든 패널 숨기기 — 3분할이면 가운데 창도 함께 접는다
  leftPanel.classList.remove('solo-panel-visible');
  rightPanel.classList.remove('solo-panel-visible');
  leftPanel.style.display  = 'none';
  rightPanel.style.display = 'none';
  divider.style.display = 'none';
  if (midPanel) { midPanel.classList.remove('solo-panel-visible'); midPanel.style.display = 'none'; }
  document.body.classList.add('solo-mode');

  // solo-bar 버튼 강조
  document.querySelectorAll('#solo-bar button:not(.solo-exit)').forEach(b => {
    b.classList.toggle('solo-active', b.textContent.trim().toLowerCase() === screen);
  });

  if (screen === 'pfd') {
    // PFD = left-panel, leftPage=0
    leftPanel.style.display = '';
    leftPanel.classList.add('solo-panel-visible');
    setLeftPage(0);
    void leftPanel.offsetHeight;
    resizePFD();
  } else if (screen === 'm3d') {
    // 3D 단독 — 3D 지도를 창 가득(제 창으로) 띄운다. 계기는 왼쪽 위에 겹쳐 뜬다(pfdOverlayDraw).
    // 다른 패널이 3D 를 갖고 있었으면 서로 맞바꾼다 — 풀면 들어가기 전 배치로 돌아온다.
    leftPanel.style.display = '';
    leftPanel.classList.add('solo-panel-visible');
    selectPanel('left', 'm3d', true);
  } else if (screen === 'map') {
    // MAP: left-panel에 배치 (setLeftPage(1) 방식)
    leftPanel.style.display = '';
    leftPanel.classList.add('solo-panel-visible');
    setLeftPage(1);
    setTimeout(() => leafMap.invalidateSize(), 80);
  } else if (screen === 'plan') {
    rightPanel.style.display = '';
    rightPanel.classList.add('solo-panel-visible');
    setPage(1);
    setTimeout(() => scaleCdu(), 80);   // Flight Plan도 354×567 규격이라 재스케일 필요
  } else if (screen === 'cdu') {
    rightPanel.style.display = '';
    rightPanel.classList.add('solo-panel-visible');
    setPage(2);
    setTimeout(() => scaleCdu(), 80);
  }
  // PFD 전체화면은 하단 푸터가 없으므로 떠 있는 HALF 버튼 표시
  // (MAP은 상단 툴바의 FULL/HALF 버튼 사용)
  const halfBtn = document.getElementById('solo-half-btn');
  // (3D 단독도 툴바가 없다 — 위 가운데에 띄운다)
  if (halfBtn) { halfBtn.classList.toggle('show', screen === 'pfd' || screen === 'm3d'); halfBtn.classList.toggle('m3d', screen === 'm3d'); }
  // 3D Only — 'Split screen' 으로 이름을 바꿔 오른쪽 3D 버튼 묶음 맨 아래에 둔다
  try {
    const ctl = document.getElementById('ctl3d');
    if (halfBtn && screen === 'm3d' && ctl) { ctl.appendChild(halfBtn); halfBtn.textContent = 'Split screen'; halfBtn.classList.add('sim-btn'); }
  } catch (e) { _swallow(e); }
  // MAP 상단 툴바 버튼 라벨: 전체화면(map)일 때 HALF, 그 외 FULL
  const mapFullBtn = document.getElementById('map-full-btn');
  if (mapFullBtn) mapFullBtn.textContent = (screen === 'map') ? 'HALF' : 'FULL';
  updateSoloBtn();
  _refreshCduFooters();   // FULL⇄HALF 라벨 갱신
  try { pfdOverlaySync(); } catch (e) { _swallow(e); }   // 3D 가 켜져 있으면 PFD 를 겹쳐 띄운다
}

// ── 3D 화면에 겹쳐 띄우는 계기(PFD 일부) ──
// 3D 지도가 화면에 떠 있으면(3D 창 · 2D 위 3D 겹치기 · 3D 단독) 그 왼쪽 위에 PFD 의 계기
// (FCP 없이 · 칸은 3D 화면의 가로 1/4 · 높이 3/5)를 겹쳐 띄운다 — 조작부 없이 비행에 몰입하도록.
// 3D 창의 '계기' 버튼으로 켜고 끈다(이 기기에 적어 둔다). 칸은 3D 가 떠 있는 창에 붙인다
// (3D 창·3D 단독 = #map3d-wrap · 2D 위 겹치기 = #map-wrap, 지도 툴바 아래).
// PFD 창이 함께 보여도 되도록 칸에는 제 캔버스(#pfd-ov-cvs)를 두고 매 프레임 따로 그린다.
const PFD_OV_PREF = 'pfdOverlay';
let pfdOvOn = true;
try { pfdOvOn = localStorage.getItem(PFD_OV_PREF) !== '0'; } catch (e) { pfdOvOn = true; }
// 3D 지도가 지금 화면에 떠 있으면 그 창(겹친 계기를 붙일 자리)
function pfdOvHost() {
  const d3 = document.getElementById('map3d');
  if (!d3 || !d3.classList.contains('active') || !(d3.offsetWidth > 40) || !(d3.offsetHeight > 40)) return null;
  return d3.parentElement;
}
// 겹친 계기 크기(3D 단독 등) — 3D 창의 계기 −/+ 로 60~160%(이 기기에 적어 둔다)
const PFD_OV_SCALE_KEY = 'pfdOvScale';
let pfdOvScale = 1;
try { const v = parseFloat(localStorage.getItem(PFD_OV_SCALE_KEY)); if (v >= 0.6 && v <= 1.6) pfdOvScale = v; } catch (e) { _swallow(e); }
function pfdOvSize(d) {
  pfdOvScale = Math.round(Math.max(0.6, Math.min(1.6, pfdOvScale + 0.1 * (Number(d) || 0))) * 10) / 10;
  try { localStorage.setItem(PFD_OV_SCALE_KEY, String(pfdOvScale)); } catch (e) { _swallow(e); }
  pfdOverlaySync(); pfdOverlayDraw(true);
}
function pfdOverlaySync() {
  const ov = document.getElementById('pfd-ov');
  if (!ov) return false;
  const w = `${(25 * pfdOvScale).toFixed(1)}%`, h = `${Math.min(92, 60 * pfdOvScale).toFixed(1)}%`;
  if (ov.style.width !== w) { ov.style.width = w; ov.style.height = h; }
  const lb = document.getElementById('pfdov-pct');
  if (lb) { const t = `${Math.round(pfdOvScale * 100)}%`; if (lb.textContent !== t) lb.textContent = t; }
  // 외부 시점(EXT)에서도 계기 ON 이면 띄운다(모형이 가리면 계기 OFF 나 EXT 카메라 버튼으로 비켜 본다)
  const host = pfdOvOn ? pfdOvHost() : null;
  if (host && ov.parentElement !== host) host.appendChild(ov);
  ov.classList.toggle('show', !!host);
  return !!host;
}
// 칸이 좁으면(PFD_OV_MINW 보다) 그 너비로 그려 줄여 보인다 — 계기 배치가 비좁게 겹치지 않고
// 보통 PFD 를 작게 본 것처럼 보이게(가로·세로를 같은 비율로 줄인다)
const PFD_OV_MINW = 340;
// 화면이 바뀌는 주기(약 60fps)보다 자주 그릴 까닭이 없다 — 시뮬을 몰아서 돌릴 때(배속에서 프레임이
// 튀거나 검사가 수천 번 연달아 부를 때)는 건너뛴다. 매번 그리면 PFD 를 두 번 그리는 셈이라 그만큼 느려진다.
const PFD_OV_MIN_MS = 15;
let _pfdOvT = -Infinity;
function pfdOverlayDraw(force) {
  const now = performance.now();
  if (!force && now - _pfdOvT < PFD_OV_MIN_MS) return;
  _pfdOvT = now;
  if (!pfdOverlaySync()) return;
  const ov = document.getElementById('pfd-ov'), c = document.getElementById('pfd-ov-cvs');
  if (!c) return;
  const w = ov.clientWidth, h = ov.clientHeight;
  if (!(w > 0) || !(h > 0)) return;
  const k = Math.min(1, w / PFD_OV_MINW);
  const cw = Math.round(w / k), ch = Math.round(h / k);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  drawPfdTo(c);
}
// ADI 의 예상 항적(FPV · 초록 원) 켜기/끄기 — 3D 창의 FPV 버튼
let fpvOn = true;
try { fpvOn = localStorage.getItem('fpvOn') !== '0'; } catch (e) { _swallow(e); }
// PFD 를 그리는 모든 곳(본 PFD · 3D 에 겹친 계기 · SIM 조종석 MFD)과 FCP 값을 지금 다시 그린다 — 단위 · FPV 처럼
// 표시만 바뀌는 설정을 바꾼 즉시 보이게(다음 프레임을 기다리지 않는다)
function pfdRefreshAll() {
  try { drawPFD(); } catch (e) { _swallow(e); }
  try { pfdOverlayDraw(true); } catch (e) { _swallow(e); }
  try { if (typeof ckpitDraw === 'function') ckpitDraw(); } catch (e) { _swallow(e); }
  try { fcpsSync(); } catch (e) { _swallow(e); }
}
function toggleFpv() {
  fpvOn = !fpvOn;
  try { localStorage.setItem('fpvOn', fpvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  pfdRefreshAll();
  updateFpvBtn();
}
function updateFpvBtn() {
  const b = document.getElementById('fpv-btn'); if (!b) return;
  b.classList.toggle('on', fpvOn); b.textContent = fpvOn ? 'FPV ON' : 'FPV OFF';
}
try { document.addEventListener('DOMContentLoaded', updateFpvBtn); updateFpvBtn(); } catch (e) { _swallow(e); }
function togglePfdOverlay() {
  pfdOvOn = !pfdOvOn;
  try { localStorage.setItem(PFD_OV_PREF, pfdOvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  updatePfdOvBtn();
  pfdOverlaySync();
}
// ── 3D 단독(3D Only) 화면의 CDU ── 3D 버튼 줄 바로 왼쪽에 계기 칸과 같은 크기(가로 1/4 · 높이 3/5)로
// CDU 를 겹쳐 띄운다. CDU 창(#cdu-wrap) 그대로를 옮겨 오므로 버튼·화면이 같다(끄거나 단독을 나오면 제자리로).
// 3D 창의 'CDU' 버튼으로 켜고 끈다(이 기기에 적어 둔다). 분할 화면에는 CDU 창이 따로 있다.
const CDU_OV_PREF = 'cduOverlay';
let cduOvOn = false;
try { cduOvOn = localStorage.getItem(CDU_OV_PREF) === '1'; } catch (e) { cduOvOn = false; }
const _cduOvHome = { cdu: null, plan: null };   // 제자리 표시
const CDU_OV_WRAP = { cdu: 'cdu-wrap', plan: 'fp-wrap' };
// 겹친 CDU 가 보여 줄 화면 — CDU 또는 그 안에서 연 Flight Plan(PROC 포함). CDU 의 버튼이 단독 화면을 바꾸려 하면
// (Flight Plan · Home · BACK 등 setSolo) 3D 단독은 그대로 두고 이 칸 안에서 바꾼다.
let cduOvPage = 'cdu';
function cduOvAvail() { return _soloActive && _soloCurrent === 'm3d' && !!pfdOvHost(); }
// SIM 3D 조종석(15-heli3d.js)이 켜져 있으면 CDU 를 하부 콘솔 오른쪽 칸에 작게 둔다(CDU ON 이면 원래 겹친 칸이 먼저).
// 작아도 같은 CDU 라 누르면 그 버튼이 그대로 듣는다.
function _ckCduSlot() { try { return typeof ckpitCduSlot === 'function' ? ckpitCduSlot() : null; } catch (e) { return null; } }
function cduOvActive() { return cduOvAvail() && (cduOvOn || !!_ckCduSlot()); }
function syncCduOverlay() {
  const want = cduOvActive();
  const inCk = want && !cduOvOn;
  if (!want) cduOvPage = 'cdu';
  const b = document.getElementById('cduov-btn');
  if (b) {
    b.textContent = cduOvOn ? 'CDU ON' : 'CDU OFF';
    b.classList.toggle('on', want && !inCk);
    b.classList.toggle('dim', !cduOvAvail());
  }
  let box = document.getElementById('cdu-ov');
  if (want) {
    const host = inCk ? _ckCduSlot() : pfdOvHost();
    if (!box) { box = document.createElement('div'); box.id = 'cdu-ov'; }
    if (box.parentElement !== host) host.appendChild(box);
    box.classList.add('show');
    box.classList.toggle('ck-in', inCk);
  } else if (box) box.classList.remove('show');
  // 보여 줄 화면만 칸 안에, 나머지는 제자리로
  Object.keys(CDU_OV_WRAP).forEach(k => {
    const wrap = document.getElementById(CDU_OV_WRAP[k]);
    if (!wrap) return;
    const inBox = want && cduOvPage === k;
    if (inBox && wrap.parentElement !== box) {
      _cduOvHome[k] = document.createComment('cdu-ov'); wrap.before(_cduOvHome[k]);
      box.appendChild(wrap);
    } else if (!inBox && _cduOvHome[k]) { _cduOvHome[k].replaceWith(wrap); _cduOvHome[k] = null; }
  });
  requestAnimationFrame(() => { try { scaleCdu(); } catch (e) { _swallow(e); } });
  if (want !== _cduOvWas) { _cduOvWas = want; _refreshCduFooters(); }   // FULL/HALF 자리
  requestAnimationFrame(() => { const m = document.getElementById('map-ov'); if (m && m.classList.contains('show')) _mapOvPlace(m); });
}
let _cduOvWas = false;
// ── 3D 단독(3D Only) 화면의 MAP ── 계기 칸과 같은 크기(가로 1/4 · 높이 3/5)로 2D 지도(#map-wrap)를 겹쳐 띄운다.
// 자리는 CDU 칸(켜져 있으면) 또는 3D 버튼 줄 바로 왼쪽. 'MAP' 버튼(CDU 아래)이나 겹친 CDU 의 MAP 으로 켠다.
const MAP_OV_PREF = 'mapOverlay';
let mapOvOn = false;
try { mapOvOn = localStorage.getItem(MAP_OV_PREF) === '1'; } catch (e) { mapOvOn = false; }
let _mapOvHome = null;
function mapOvActive() { return mapOvOn && cduOvAvail(); }
function _mapOvPlace(box) {
  const host = box.parentElement; if (!host) return;
  const hr = host.getBoundingClientRect();
  const cdu = document.getElementById('cdu-ov');
  const ctl = document.getElementById('ctl3d');
  let edge = ctl ? ctl.getBoundingClientRect().left : hr.right - 104;
  if (cdu && cdu.classList.contains('show') && !cdu.classList.contains('ck-in')) edge = Math.min(edge, cdu.getBoundingClientRect().left);
  box.style.right = Math.max(8, Math.round(hr.right - edge + 8)) + 'px';
}
function syncMapOverlay() {
  const want = mapOvActive();
  const b = document.getElementById('mapov-btn');
  if (b) {
    b.textContent = mapOvOn ? 'MAP ON' : 'MAP OFF';
    b.classList.toggle('on', want);
    b.classList.toggle('dim', !cduOvAvail());
  }
  const wrap = document.getElementById('map-wrap');
  if (!wrap) return;
  let box = document.getElementById('map-ov');
  if (want) {
    const host = pfdOvHost();
    if (!box) {
      box = document.createElement('div'); box.id = 'map-ov';
      try { new ResizeObserver(() => { try { leafMap.invalidateSize(); } catch (e) { _swallow(e); } }).observe(box); } catch (e) { _swallow(e); }
    }
    if (box.parentElement !== host) host.appendChild(box);
    if (wrap.parentElement !== box) {
      _mapOvHome = document.createComment('map-ov'); wrap.before(_mapOvHome);
      box.appendChild(wrap);
    }
    box.classList.add('show');
    _mapOvPlace(box);
  } else {
    if (_mapOvHome) { _mapOvHome.replaceWith(wrap); _mapOvHome = null; }
    if (box) box.classList.remove('show');
  }
  requestAnimationFrame(() => { try { leafMap.invalidateSize(); } catch (e) { _swallow(e); } if (box && want) _mapOvPlace(box); });
}
function toggleMapOverlay() {
  if (!cduOvAvail()) {
    try { uiToast('MAP 겹치기는 3D 단독(3D Only) 화면에서 씁니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  mapOvOn = !mapOvOn;
  try { localStorage.setItem(MAP_OV_PREF, mapOvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  syncMapOverlay();
}
window.addEventListener('resize', () => { const b = document.getElementById('map-ov'); if (b && b.classList.contains('show')) _mapOvPlace(b); });
// 겹친 CDU 안에서 화면 바꾸기(setSolo 가 부른다) — 바꿨으면 true
function cduOvRoute(screen) {
  if (!cduOvActive() || (screen !== 'cdu' && screen !== 'plan')) return false;
  cduOvPage = screen;
  syncCduOverlay();
  _refreshCduFooters();
  return true;
}
function toggleCduOverlay() {
  if (!cduOvAvail()) {
    try { uiToast('CDU 겹치기는 3D 단독(3D Only) 화면에서 씁니다 — 분할 화면에는 CDU 창이 따로 있습니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  cduOvOn = !cduOvOn;
  try { localStorage.setItem(CDU_OV_PREF, cduOvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  syncCduOverlay();
}
function updatePfdOvBtn() {
  const b = document.getElementById('pfdov-btn');
  if (!b) return;
  b.textContent = pfdOvOn ? '계기 ON' : '계기 OFF';
  b.classList.toggle('on', pfdOvOn);
}

// solo 상태 변화 시 CDU/Flight Plan 푸터를 다시 그려 FULL⇄HALF 반영
function _refreshCduFooters() {
  try { renderCduContent(); } catch (e) { _swallow(e); }
  try { if (typeof fpRender === 'function') fpRender(); } catch (e) { _swallow(e); }
}

function exitSolo() {
  try { if (window._cockpitOn) cockpitExit(); } catch (e) { _swallow(e); }   // Cockpit Mode 도 함께 끝난다
  _soloActive = false;
  _soloCurrent = null;
  document.getElementById('solo-bar').style.display = 'none';
  const halfBtn = document.getElementById('solo-half-btn');
  if (halfBtn) {
    halfBtn.classList.remove('show', 'm3d', 'sim-btn');
    if (halfBtn.parentElement !== document.body) document.body.appendChild(halfBtn);   // 3D Only 에서 옮겨 둔 것을 제자리로
    halfBtn.textContent = '✥ HALF';
  }
  const mapFullBtn = document.getElementById('map-full-btn');
  if (mapFullBtn) mapFullBtn.textContent = 'FULL';
  document.body.classList.remove('solo-mode');
  try { pfdOverlaySync(); } catch (e) { _swallow(e); }   // 겹친 계기도 다시 본다(3D 가 아직 떠 있는가)

  const leftPanel  = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const divider    = document.getElementById('panel-divider');

  leftPanel.classList.remove('solo-panel-visible');
  rightPanel.classList.remove('solo-panel-visible');
  leftPanel.style.display  = '';
  rightPanel.style.display = '';
  divider.style.display = '';
  const midPanel = document.getElementById('mid-panel');
  if (midPanel) { midPanel.classList.remove('solo-panel-visible'); midPanel.style.display = ''; }

  // 들어가기 전 배치로 되돌린다(없으면 종전대로 좌 PFD · 우 MAP)
  if (_soloSaved) {
    tripleMode = _soloSaved.tri; leftSel = _soloSaved.l;
    quadMode = !!_soloSaved.q; botSel = _soloSaved.b || botSel;
    midSel = _soloSaved.m; rightSel = _soloSaved.r;
    _soloSaved = null;
    applyPanels();
  } else { setLeftPage(0); setPage(0); }
  updateSoloBtn();
  _refreshCduFooters();   // FULL⇄HALF 라벨 갱신
  setTimeout(() => {
    leafMap.invalidateSize();
    resizePFD();
    scaleCdu();
  }, 80);
}

// ── SIM Mode 창 배치판 ── 시작 화면에서 'SIM Mode' 를 고르면 SIM 조종을 켜고 이 판을 띄운다.
// 화면마다 버튼을 누르면 그 화면만 새 창으로 떠서(00-popout.js popoutScreen) 모니터마다 따로 배치한다.
// 브라우저는 한 번 누를 때 새 창을 하나만 열어 주므로 하나씩 누른다. 본 창은 시뮬을 돌리는 바탕으로 남는다
// (최소화하면 브라우저가 멈춰 세우니 다른 모니터 구석에 두거나 작게 둔다). 탭 줄의 '⧉ 창 배치' 로 다시 연다.
const SIM_LAYOUT_ORDER = ['pfd', 'm3d', 'map', 'cdu', 'ovhd', 'lcon', 'sysp'];
function simLayoutShow() {
  let el = document.getElementById('simlay');
  if (!el) {
    el = document.createElement('div'); el.id = 'simlay';
    const names = window.POPOUT_SCREENS || {};
    el.innerHTML = `<div class="simlay-box"><div class="simlay-title">SIM Mode — 창 배치</div>` +
      `<div class="simlay-note">화면마다 눌러 새 창으로 띄운 뒤, 창을 모니터마다 끌어다 놓으십시오(한 번에 한 창).<br>` +
      `본 창은 시뮬을 돌리는 바탕입니다 — 닫거나 최소화하지 마십시오.</div>` +
      `<div class="simlay-grid">` + SIM_LAYOUT_ORDER.map(k =>
        `<button type="button" class="simlay-btn" data-act="popoutScreen" data-arg='["${k}"]' data-scr="${k}"><b>${names[k] || k}</b><span></span></button>`).join('') +
      `</div><div class="simlay-foot"><button type="button" class="simlay-sm" data-act="simLayoutAllBack">모두 본 창으로</button>` +
      `<button type="button" class="simlay-sm" data-act="simLayoutHide">닫기</button></div></div>`;
    document.body.appendChild(el);
  }
  el.classList.add('show');
  simLayoutSync();
}
function simLayoutHide() { const el = document.getElementById('simlay'); if (el) el.classList.remove('show'); }
function simLayoutAllBack() { try { if (typeof popoutCloseAll === 'function') popoutCloseAll(); } catch (e) { _swallow(e); } simLayoutSync(); }
function simLayoutSync() {
  const open = (typeof popoutScreens === 'function') ? popoutScreens() : [];
  document.querySelectorAll('#simlay .simlay-btn').forEach(b => {
    const on = open.includes(b.dataset.scr);
    b.classList.toggle('on', on);
    const sp = b.querySelector('span'); const t = on ? '새 창에 떠 있음 · 누르면 복귀' : '누르면 새 창으로';
    if (sp && sp.textContent !== t) sp.textContent = t;
  });
}
function simLayoutStart() {
  try { if (typeof simModeOn !== 'undefined' && !simModeOn && typeof toggleSimMode === 'function') toggleSimMode(true); } catch (e) { _swallow(e); }
  simLayoutShow();
}
// (화면 버튼 등록은 19-lower.js — appRegister 는 09-cdu.js 에서 정의되어 이 파일보다 늦다)

// ── Simple mode ── 시작 화면에서 'Simple Mode' 를 고르면 창 하나만 화면 가득 본다.
// 위 막대에 쓸 수 있는 창(PFD · 3D · MAP · CDU · UPPER · LOWER · SYSTEM)이 다 있고, 누른 창 하나만 보인다.
// 분할 패널(#app)은 감추고, 고른 화면 묶음을 그릇(#simple-host)에 옮긴다(applyPanels 의 hostOf).
const SIMPLE_SCREENS = [['pfd', 'PFD'], ['m3d', '3D'], ['map', 'MAP'], ['cdu', 'CDU'], ['ovhd', 'UPPER'], ['lcon', 'LOWER'], ['sysp', 'SYSTEM']];
let simpleOn = false;
function _simpleEnsure() {
  if (document.getElementById('simple-bar')) return;
  const bar = document.createElement('div'); bar.id = 'simple-bar';
  bar.innerHTML = SIMPLE_SCREENS.map(([k, n]) => `<button type="button" data-act="simpleSet" data-arg='["${k}"]' data-scr="${k}">${n}</button>`).join('') +
    `<button type="button" class="simple-exit" data-act="simpleExit" title="Simple mode 끝내기 — 분할 화면(PC 모드)으로">PC 모드</button>`;
  const view = document.createElement('div'); view.id = 'simple-view';
  view.innerHTML = '<div id="simple-host"></div>';
  document.body.appendChild(bar); document.body.appendChild(view);
}
function simpleModeStart(k) {
  try { if (typeof _soloActive !== 'undefined' && _soloActive) exitSolo(); } catch (e) { _swallow(e); }
  _simpleEnsure();
  simpleOn = true;
  document.body.classList.add('simple-mode');
  simpleSet(k || window._simpleScr || 'pfd');
}
function simpleSet(k) {
  if (!SIMPLE_SCREENS.some(s => s[0] === k)) return;
  if (!simpleOn) { simpleModeStart(k); return; }
  window._simpleScr = k;
  try { applyPanels(); } catch (e) { _swallow(e); }
  document.querySelectorAll('#simple-bar [data-scr]').forEach(b => b.classList.toggle('on', b.dataset.scr === k));
  const kick = () => {
    try { window.dispatchEvent(new Event('resize')); } catch (e) { _swallow(e); }
    try { if (k === 'pfd' && typeof resizePFD === 'function') { resizePFD(); drawPFD(); } } catch (e) { _swallow(e); }
    try { if (k === 'cdu' && typeof scaleCdu === 'function') scaleCdu(); } catch (e) { _swallow(e); }
    try { if (k === 'map' && typeof leafMap !== 'undefined') leafMap.invalidateSize(); } catch (e) { _swallow(e); }
    try { if (k === 'sysp' && typeof sysDraw === 'function') sysDraw(); } catch (e) { _swallow(e); }
  };
  kick(); setTimeout(kick, 80); setTimeout(kick, 300);
}
function simpleExit() {
  simpleOn = false;
  window._simpleScr = null;
  document.body.classList.remove('simple-mode');
  try { applyPanels(); } catch (e) { _swallow(e); }
  try { sessionStorage.setItem('vfrStartMode', 'pc'); } catch (e) { _swallow(e); }
  setTimeout(() => { try { window.dispatchEvent(new Event('resize')); resizePFD(); } catch (e) { _swallow(e); } }, 60);
}


// ── Cockpit Mode ── 시작 화면에서 'Cockpit Mode' 를 고르면 3D 조종석으로 바로 들어간다:
//   3D 를 화면 가득(3D 단독) · 1인칭 조종석 시야 · 조종석 패널(MFD 넷 · 위아래 콘솔 · CDU — 15-heli3d.js)을 켠다.
//   SIM 이 꺼져 있어도(절차 훈련판 · AFCS 로 나는 비행) 카메라가 조종석에 앉는다(05-gps.js _follow3d · ckCamOn).
//   화면을 누르면 그 화면이 가운데에 크게 뜬다. 오른쪽 위 'Split screen' 으로 끝낸다(분할 화면).
// (예전의 세로 칸 배치 Cockpit mode 와 '3D 단독 모드' 는 이것으로 합쳤다)
window._cockpitOn = false;
function cockpitStart() {
  try { if (typeof simpleOn !== 'undefined' && simpleOn) simpleExit(); } catch (e) { _swallow(e); }
  window._cockpitOn = true;
  try { if (!followMode) toggleFollow(); } catch (e) { _swallow(e); }          // 카메라가 헬기를 따라간다
  try { if (!(_soloActive && _soloCurrent === 'm3d')) panelSolo('m3d'); } catch (e) { _swallow(e); }
  try { if (typeof ckpitSet === 'function') ckpitSet(true); } catch (e) { _swallow(e); }
  const kick = () => { try { if (_ml3d) { _ml3d.resize(); _follow3d(); } } catch (e) { _swallow(e); } };
  kick(); setTimeout(kick, 200); setTimeout(kick, 800);
}
function cockpitExit() {
  if (!window._cockpitOn) return;
  window._cockpitOn = false;
  // SIM 이 아니면 1인칭 카메라를 풀어 지도처럼 내려다보게 되돌린다
  try { if (!simModeOn && typeof _ml3dSimCameraOff === 'function') _ml3dSimCameraOff(); } catch (e) { _swallow(e); }
  try { if (typeof heli3dNoseSync === 'function') heli3dNoseSync(null); } catch (e) { _swallow(e); }
  try { syncChinView(); } catch (e) { _swallow(e); }      // 축척 · 확대 버튼을 되살린다(#map3d.sim3d)
  try { sessionStorage.setItem('vfrStartMode', 'pc'); } catch (e) { _swallow(e); }
}


// ══════════════════════════════════════════════════════
// FCP SIMPLE — 실기 AFCS 조작 패널 모양(사진)으로 간추린 FCP. 왼쪽 세로 탭 하나로 지금 FCP ⇄ SIMPLE.
//   위: IAS · HDG · VS · ALT.A · [ALT] · CR.HT  |  BARO · UPLIM
//   아래: [ ] · [NAVD CPL] · [ ] · [T-DOWN] · [T.D.HOV] · H.HT  |  CRS · DH
// 노브: 왼쪽(‹)/오른쪽(›)을 누르면 돌린다(누르고 있으면 계속) · 가운데를 누르면 노브 누름(PUSH).
// 기능은 지금 FCP 와 같은 함수(applyDelta · fcpSync · toggleAltHold …)를 부른다.
// UPLIM · DH 와 빈 버튼 둘은 아직 기능이 없다(자리만).
const FCPS_KNOBS = {
  ias:  { lbl: 'IAS',   rot: ['spd', 1],   push: ['fcpSync', 'ias'] },
  hdg:  { lbl: 'HDG',   rot: ['hdg', 1],   push: ['fcpSync', 'hdg'] },
  vs:   { lbl: 'VS',    rot: ['vs', 100] },
  alta: { lbl: 'ALT.A', rot: ['alt', 100] },
  crht: { lbl: 'CR.HT', rot: ['crht', 10], push: ['toggleCrht'] },
  hht:  { lbl: 'H.HT',  rot: ['hht', 10] },
  baro: { lbl: 'BARO',  rot: ['baro', 1],  push: ['fcpsBaroStd'] },
  uplim:{ lbl: 'UPLIM', none: true },
  crs:  { lbl: 'CRS',   rot: ['crs', 1],   push: ['fcpSync', 'crs'] },
  dh:   { lbl: 'DH',    none: true },
  // 오른쪽 영역(사용자 기능) — 바람
  wdir: { lbl: 'WIND DIR', rot: ['wdir', 5] },
  wspd: { lbl: 'WIND SPD', rot: ['wspd', 1] },
};
function _fcpsKnob(k) {
  const d = FCPS_KNOBS[k];
  const push = d.push ? ` data-act="${d.push[0]}"${d.push[1] ? ` data-arg='["${d.push[1]}"]'` : ''}` : '';
  return `<div class="fks-cell${d.none ? ' fks-none' : ''}" data-k="${k}"><div class="fks-lbl">${d.lbl}</div>` +
    `<div class="fks-knob">${d.rot ? `<b class="fks-dn" data-rot="${d.rot[0]},${-d.rot[1]}">‹</b><b class="fks-up" data-rot="${d.rot[0]},${d.rot[1]}">›</b>` : ''}` +
    `<i class="fks-push"${push}></i></div><div class="fks-val" id="fks-${k}"></div></div>`;
}
function _fcpsBtn(id, lbl, act, framed) {
  return `<div class="fks-cell"><div class="fks-lbl">${lbl || '&nbsp;'}</div>` +
    `<div class="fks-sq${framed ? ' framed' : ''}${act ? '' : ' fks-none'}" id="fks-${id}"${act ? ` data-act="${act}"` : ''}></div><div class="fks-val"></div></div>`;
}
function _fcpsBuild() {
  const bar = document.querySelector('#pfd-wrap .ctrl-bar');
  if (!bar || document.getElementById('fcp-simple')) return;
  const p = document.createElement('div'); p.id = 'fcp-simple';
  p.innerHTML = `<div class="fks-main"><div class="fks-l">` +
      _fcpsKnob('ias') + _fcpsKnob('hdg') + _fcpsKnob('vs') + _fcpsKnob('alta') + _fcpsBtn('alt', 'ALT', 'toggleAltHold', true) + _fcpsKnob('crht') +
      _fcpsBtn('b1', '', '') + _fcpsBtn('navd', 'NAVD CPL', 'toggleNavAp', true) + _fcpsBtn('b2', '', '') +
      _fcpsBtn('tdown', 'T-DOWN', 'tdownSet') + _fcpsBtn('tdh', 'T.D.HOV', 'tdhEngage') + _fcpsKnob('hht') +
    `</div><div class="fks-div"></div><div class="fks-r">` +
      _fcpsKnob('baro') + _fcpsKnob('uplim') + _fcpsKnob('crs') + _fcpsKnob('dh') + `</div></div>` +
    // UPLIM · DH 오른쪽 — 구분선 + 사용자 기능 영역(바람 노브 · RNP · SIM SPD · FORCE TRIM · G/A · GSPD · 트림 · 페달)
    `<div class="fks-div fks-div2"></div><div class="fks-x"><div class="fks-xw">` + _fcpsKnob('wdir') + _fcpsKnob('wspd') + `</div>` +
    `<div class="fks-xr"><div class="fks-xr1"></div><div class="fks-xr2"></div></div></div>`;
  bar.appendChild(p);
  // 옛 FCP 의 나머지 버튼 무리를 그대로(누름 · 홀드가 붙은 채) 옮겨 온다 — 옛 FCP 줄은 모두 없앤다
  const r1 = p.querySelector('.fks-xr1'), r2 = p.querySelector('.fks-xr2');
  const mv = (sel, to) => { const e = bar.querySelector(sel); if (e) to.appendChild(e); };
  // 두 줄의 폭이 가장 좁게 — 윗줄: RNP · SIM SPD · FORCE TRIM/G/A · GSPD / 아랫줄: COLLECTIVE TRIM · 4-WAY TRIM · ANTI-TORQUE PEDAL
  mv('.nav-src-group', r1);            // RNP
  mv('.simspd-group', r1);             // SIM SPD
  mv('.ftr-col', r1);                  // FORCE TRIM · G/A
  mv('#gspd-btn', r1);                 // GSPD
  mv('#trim-group', r2);               // COLLECTIVE TRIM · 4-WAY TRIM · ANTI-TORQUE PEDAL
  bar.querySelectorAll(':scope > .ctrl-sub-row').forEach(r => r.remove());
  // 노브 돌리기 — 누르고 있으면 계속(지금 FCP ▲▼ 와 같은 빠르기)
  p.querySelectorAll('[data-rot]').forEach(el => {
    const [f, dStr] = el.dataset.rot.split(','), d = +dStr;
    let timer = null, interval = null, guard = null;
    const step = () => { if (f === 'baro') fcpsBaro(d); else applyDelta(f, d); fcpsSync(); };
    function stop() { clearTimeout(timer); clearInterval(interval); clearTimeout(guard); timer = interval = guard = null; _holdStops.delete(stop); }
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (timer || interval) return;
      step(); _holdStops.add(stop);
      guard = setTimeout(stop, HOLD_MAX_MS);
      timer = setTimeout(() => { interval = setInterval(step, 80); }, 350);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, stop));
  });
  fcpsSync();
  requestAnimationFrame(() => { try { resizePFD(); drawPFD(); } catch (e) { _swallow(e); } });
}
// BARO — QNH 를 1 hPa(IN 이면 0.01 inHg) 씩 · 누르면 STD(29.92 inHg = 1013.25 hPa)
// 표준 기압 — 29.92 inHg = 1013.25 hPa. IN 으로 볼 때는 0.01 inHg 씩, HPA 로 볼 때는 1 hPa 씩 돈다
const QNH_STD = 1013.25, HPA_PER_IN = 33.8639;
function fcpsBaro(d) {
  const q = (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa)) ? window._qnhHpa : QNH_STD;
  const inHg = typeof pfdBaroUnit !== 'undefined' && pfdBaroUnit === 'IN';
  const nq = inHg ? (Math.round(q / HPA_PER_IN * 100) + d) / 100 * HPA_PER_IN : Math.round(q) + d;
  window._qnhHpa = Math.max(940, Math.min(1060, nq));
  try { drawPFD(); } catch (e) { _swallow(e); }
}
function fcpsBaroStd() { window._qnhHpa = QNH_STD; try { drawPFD(); } catch (e) { _swallow(e); } fcpsSync(); }
// 노브 아래 작은 값 · 걸린 모드는 노브 테·버튼이 녹색
function fcpsSync() {
  const p = document.getElementById('fcp-simple');
  if (!p) return;
  const set = (id, txt) => { const e = document.getElementById('fks-' + id); if (e && e.textContent !== txt) e.textContent = txt; };
  const on = (k, v) => { const c = p.querySelector(`[data-k="${k}"]`) || document.getElementById('fks-' + k); if (c && c.classList.contains('on') !== !!v) c.classList.toggle('on', !!v); };
  const g = (f, d) => { try { return f(); } catch (e) { return d; } };
  // 노브가 실제로 옮기는 값을 보인다(applyDelta 와 같은 갈래)
  set('ias', String(Math.round(simModeOn ? selSpd : S.spd)));
  set('hdg', String(((Math.round(selHdg) + 359) % 360) + 1).padStart(3, '0') + '°');
  const vsSel = g(() => ((gaOn || vsModeOn) && !altHoldOn && !crhtOn) || altHoldOn || crhtOn, false);
  set('vs', String(Math.round(vsSel ? selVS : S.vs)));
  set('alta', String(Math.round(selAlt)));
  set('crht', String(Math.round(selCrht)));
  set('hht', String(Math.round(selHht)));
  { const q = g(() => (Number.isFinite(window._qnhHpa) ? window._qnhHpa : QNH_STD), QNH_STD);
    set('baro', (typeof pfdBaroUnit !== 'undefined' && pfdBaroUnit === 'IN') ? (q / HPA_PER_IN).toFixed(2) : String(Math.round(q))); }
  set('crs', fmtA(g(() => (navSrc !== 'FMS' ? vorObsCrs : S.crs), S.crs)) + '°');
  on('ias', g(() => iasModeOn(), false));
  on('hdg', g(() => hdgSelOn, false));
  on('crht', g(() => crhtOn, false));
  on('alt', g(() => altHoldOn, false));
  on('navd', g(() => navApOn, false));
  on('tdh', g(() => tdOn, false));
  set('wdir', fmtA(toMag(windDir)) + '°');
  set('wspd', Math.round(windSpd) + 'kt');
  // GSPD 중에는 NAV 가 조향하지 못한다(updateApInhibit) — NAVD CPL 도 흐린 테로
  const nv = document.getElementById('fks-navd');
  if (nv) nv.classList.toggle('ap-inh', g(() => gspdOn || gspdCoasting, false));
}
try { _fcpsBuild(); } catch (e) { _swallow(e); }
setInterval(() => { try { fcpsSync(); } catch (e) { _swallow(e); } }, 250);

// ══════════════════════════════════════════════════════
// PFD 소프트키(터치바) — KUH-1CG FLM 그림 5~8 의 트리. PFD 바로 아래(FCP 맨 위 한 줄) 12칸.
// 최상위: Map Range − · Map Range + · PFD Map Settings ▸ · Traffic Map · PFD Settings ▸ · OBS · Active NAV(VOR1→VOR2→FMS) ·
//         Sensors ▸ · Hover Display · Hover Position · CAS · SIM
// 하위 메뉴(▸)는 Back 으로 한 단계 위로, 45초 동안 누르지 않으면 최상위로 돌아간다.
// 켜진 기능은 칸 아래 녹색 바, 지금 쓸 수 없는 칸은 회색으로 흐려진다.
// 아직 시뮬레이터와 잇지 않은 칸(Traffic · Terrain · WX · Detail · Map Layout · Meters · RA1/2 · CAS)은 고른 상태만 기억한다.
const SK_IDLE_MS = 45000;
const skState = { tfcMap: false, traffic: false, detail: 'ALL', terrain: 'OFF', wx: false, ltg: false, layout: 'Inset Map',
                  meters: false, ra: 'RA1' };
let pfdBaroUnit = 'HPA';      // PFD 기압 칸 단위(UNITS 메뉴의 IN · HPA)
try { const v = JSON.parse(localStorage.getItem('pfdSk') || 'null'); if (v) { Object.assign(skState, v.s || {}); if (v.baro) pfdBaroUnit = v.baro; } } catch (e) { _swallow(e); }
function _skSave() { try { localStorage.setItem('pfdSk', JSON.stringify({ s: skState, baro: pfdBaroUnit })); } catch (e) { _swallow(e); } }
const _skCyc = (k, arr) => () => { skState[k] = arr[(arr.indexOf(skState[k]) + 1) % arr.length]; _skSave(); };
const _skTog = k => () => { skState[k] = !skState[k]; _skSave(); };
const _skRadio = (k, v) => ({ lbl: v, on: () => skState[k] === v, act: () => { skState[k] = v; _skSave(); } });
const _skBack = { lbl: 'Back', back: true };
const _skDis = id => { const b = document.getElementById(id); return !!(b && b.disabled); };
const SK_MENUS = {
  TOP: [
    { lbl: 'Map<br>Range −', act: () => { try { leafMap.setZoom(leafMap.getZoom() - 1); } catch (e) { _swallow(e); } } },
    { lbl: 'Map<br>Range +', act: () => { try { leafMap.setZoom(leafMap.getZoom() + 1); } catch (e) { _swallow(e); } } },
    { lbl: 'PFD Map<br>Settings', go: 'MAPSET' },
    { lbl: 'Traffic<br>Map', on: () => skState.tfcMap, act: _skTog('tfcMap') },
    { lbl: 'PFD<br>Settings', go: 'PFDSET' },
    // OBS — 홀딩 · 오비트 · 미스드어프로치처럼 다음 지점으로 넘어갈지 정할 자리면 SUSP 로 바뀐다(suspSoftkey)
    //   SUSP 는 옛 FCP 의 SUSP 와 같다(toggleSusp). 걸려 있으면(손으로 켬 · 홀딩으로 저절로) 녹색 바
    { lbl: () => suspSoftkey() ? 'SUSP' : 'OBS',
      on: () => suspSoftkey() ? navSuspended() : obsOn,   // 보류가 걸려 있으면(손으로 · 홀딩으로 저절로) 녹색 바
      dim: () => !suspSoftkey() && _skDis('obs-btn'),
      act: () => { if (suspSoftkey()) toggleSusp(); else toggleObs(); } },
    { lbl: 'Active NAV', sub: () => ({ FMS: 'FMS', NAV1: 'VOR1', NAV2: 'VOR2' })[navSrc] || navSrc, act: () => pfdSkNavCycle() },
    { lbl: 'Sensors', go: 'SENS' },
    // Hover Display — 80kt 아래(또는 켜져 있을 때)만 · FCP 의 HOVER PAGE · HOVER POS 버튼은 없앴다
    { lbl: 'Hover<br>Display', on: () => hoverPageOn, dim: () => !(hoverEligible() || hoverPageOn), act: () => { toggleHoverPage(); try { updateHoverBtns(); } catch (e) { _swallow(e); } } },
    { lbl: 'Hover<br>Position', on: () => hoverPosOn, act: () => toggleHoverPosition() },
    { lbl: 'CAS' },
    // SIM — 조종간으로 직접 모는 모드(FCP 의 SIM 버튼을 옮겨 왔다 · simModeBtnPress)
    // (절차 훈련판 — 00-edition.js SIM_ENABLED 거짓 — 에서는 빈칸)
    { lbl: () => (typeof SIM_ENABLED === 'undefined' || SIM_ENABLED) ? 'SIM' : '', on: () => simModeOn,
      dim: () => typeof SIM_ENABLED !== 'undefined' && !SIM_ENABLED, act: () => { if (typeof SIM_ENABLED === 'undefined' || SIM_ENABLED) simModeBtnPress(); } },
  ],
  // 그림 6 — PFD 지도 선택
  MAPSET: [
    { lbl: 'Map Layout', go: 'LAYOUT' },
    { lbl: 'Detail', sub: () => skState.detail, act: _skCyc('detail', ['ALL', 'DCLTR1', 'DCLTR2', 'Least']) },
    {}, { lbl: 'Traffic', on: () => skState.traffic, act: _skTog('traffic') }, {},
    { lbl: 'Terrain', sub: () => skState.terrain, act: _skCyc('terrain', ['OFF', 'absolute', 'relative']) },
    {}, { lbl: 'WX Overlay', sub: () => 'Connext', on: () => skState.wx, act: _skTog('wx') },
    { lbl: 'Lightning', on: () => skState.ltg, act: _skTog('ltg') }, {}, _skBack, {},
  ],
  LAYOUT: [
    _skRadio('layout', 'Map off'), _skRadio('layout', 'Inset Map'), _skRadio('layout', 'HSI Map'),
    _skRadio('layout', 'Inset<br>Traffic'), _skRadio('layout', 'HSI<br>Traffic'), {}, {}, {}, {}, {}, _skBack, {},
  ],
  // 그림 7 — PFD 조절
  PFDSET: [
    {}, {}, {}, {}, {},
    { lbl: 'Bearing1', sub: () => brgSrcLabel(1), act: () => brgSrcCycle(1) },
    { lbl: 'Bearing2', sub: () => brgSrcLabel(2), act: () => brgSrcCycle(2) },
    {}, { lbl: 'Other PFD<br>Settings', go: 'OTHER' }, {}, _skBack, {},
  ],
  OTHER: [{}, {}, { lbl: 'Altitude<br>Units', go: 'UNITS' }, {}, {}, {}, {}, {}, {}, {}, _skBack, {}],
  UNITS: [
    {}, {}, {}, {}, {},
    { lbl: 'Meters', on: () => skState.meters, act: _skTog('meters') }, {},
    { lbl: 'IN', on: () => pfdBaroUnit === 'IN', act: () => { pfdBaroUnit = 'IN'; _skSave(); pfdRefreshAll(); } },
    { lbl: 'HPA', on: () => pfdBaroUnit === 'HPA', act: () => { pfdBaroUnit = 'HPA'; _skSave(); pfdRefreshAll(); } },
    {}, _skBack, {},
  ],
  // 그림 8 — PFD 센서
  SENS: [{}, {}, { lbl: 'RA<br>Settings', go: 'RA' }, {}, {}, {}, {}, {}, {}, {}, _skBack, {}],
  RA: [{}, _skRadio('ra', 'RA1'), _skRadio('ra', 'RA2'), {}, {}, {}, {}, {}, {}, {}, _skBack, {}],
};
let skMenu = 'TOP', _skStack = [], _skIdle = null;
function _pfdSkBuild() {
  const bar = document.querySelector('#pfd-wrap .ctrl-bar');
  if (!bar || document.getElementById('pfd-sk')) return;
  const sk = document.createElement('div'); sk.id = 'pfd-sk';
  sk.innerHTML = Array.from({ length: 12 }, (_, i) => `<div class="pfd-sk" id="sk-${i}" data-act="pfdSkPress" data-arg='[${i}]'><span></span><em></em><i></i></div>`).join('');
  bar.prepend(sk);   // FCP 맨 위 — 그 아래 FCP 패널
  pfdSkRender();
}
function pfdSkGo(m) {
  _skStack = m === 'TOP' ? [] : _skStack;
  skMenu = m; pfdSkRender(); _skArmIdle();
}
function _skArmIdle() {
  clearTimeout(_skIdle);
  if (skMenu !== 'TOP') _skIdle = setTimeout(() => { _skStack = []; skMenu = 'TOP'; pfdSkRender(); }, SK_IDLE_MS);
}
function pfdSkPress(i) {
  const it = (SK_MENUS[skMenu] || [])[i];
  if (!it || !it.lbl) { _skArmIdle(); return; }
  if (it.dim && it.dim()) return;
  if (it.back) { skMenu = _skStack.pop() || 'TOP'; }
  else if (it.go) { _skStack.push(skMenu); skMenu = it.go; }
  else if (it.act) { try { it.act(); } catch (e) { _swallow(e); } }
  pfdSkRender(); _skArmIdle();
}
// Active NAV — VOR1(NAV1) → VOR2(NAV2) → FMS → VOR1
function pfdSkNavCycle() {
  const order = ['NAV1', 'NAV2', 'FMS'];
  setNavSrc(order[(order.indexOf(navSrc) + 1) % order.length]);
}
function pfdSkRender() {
  const sk = document.getElementById('pfd-sk');
  if (!sk) return;
  const M = SK_MENUS[skMenu] || SK_MENUS.TOP;
  sk.dataset.menu = skMenu;
  [...sk.children].forEach((el, i) => {
    const it = M[i] || {};
    const lbl = (typeof it.lbl === 'function' ? it.lbl() : it.lbl) || '';
    const span = el.firstElementChild, em = span.nextElementSibling;
    if (span.innerHTML !== lbl) span.innerHTML = lbl;
    const sub = it.sub ? it.sub() : '';
    if (em.textContent !== sub) em.textContent = sub;
    const flags = { none: !it.lbl, on: !!(it.on && it.on()), auto: !!(it.auto && it.auto()), off: !!(it.dim && it.dim()), go: !!it.go };
    Object.entries(flags).forEach(([c, v]) => { if (el.classList.contains(c) !== v) el.classList.toggle(c, v); });
  });
}
function pfdSkSync() { pfdSkRender(); }
try { _pfdSkBuild(); } catch (e) { _swallow(e); }
setInterval(() => { try { pfdSkRender(); } catch (e) { _swallow(e); } }, 250);
