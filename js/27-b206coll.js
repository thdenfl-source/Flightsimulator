'use strict';
// ══════════════════════════════════════════════════════
// Bell 206B-3 컬렉티브 머리(스위치 상자) + 스로틀 그립 — Bell Cockpit Mode(15-heli3d.js #sim-ckpit) 하부 콘솔 오른쪽(흰수리 CDU 자리)에 작게, 누르면 크게(120%)
// 실기 사진대로: 위 스위치 상자
//   SRCH LT(ON · OFF · STOW) 단추 · LDG LT(ON · OFF) 토글 · GOV RPM(INCR · DECR) 비프 스위치
//   SRCH LT 방향(EXT · RETR) 단추 · STARTER 누름 단추
// 아래 IDLE REL 단추가 달린 목 · 코르크 스로틀 그립(돌려서 FULL OPEN · IDLE · OFF)
// 엔진:
//   스로틀 OFF → 엔진 꺼짐(연료 차단). 시동은 실기 절차대로 — STARTER(N1 12%↑) → 스로틀 IDLE(점화 · TOT) → N1 58%↑ 에서 STARTER 놓기(B206S · b206cStep).
//   IDLE → FULL OPEN 은 그냥 돌린다. FULL/IDLE → OFF 는 IDLE REL 단추를 누른 뒤에만(3초 동안) 닫힌다(실기처럼 실수로 끄지 않게).
//   엔진 상태는 시뮬레이터의 엔진 레버(17-upper.js pcd1 · pcd2 — OFF · IDLE · FLY)로 넘긴다 — NR · 토크 · 계기는 그대로 따른다.
//   FULL OPEN 이면 GOV RPM INCR/DECR 를 누르는 동안 거버너 NR(03-pfd.js NR_GOV)을 97 ~ 100% 사이에서 1%/초로 맞춘다.
// 눈금은 FULL OPEN · IDLE · OFF 순(왼→오른). 그립은 왼쪽을 누르면 열리고(FULL 쪽) 오른쪽을 누르면 닫힌다(OFF 쪽) · 휠도 듣는다.
// ══════════════════════════════════════════════════════
const B206C_TH = ['OFF', 'IDLE', 'FULL'];
const B206C_GOV_MIN = 97, B206C_GOV_MAX = 100, B206C_REL_S = 3;
const b206c = { th: 'FULL', run: true, idleRel: 0, start: 0, ldg: false, srch: 'OFF', srchExt: false, beep: 0,
                // 시동 중의 N1(%) · TOT(°C) · 점화(light-off)됐나 · 연료가 든 지 몇 초 · 이번 시동의 TOT 최고 · HOT START · 엔진 고장(훈련)
                n1: 0, tot: 30, lit: false, litT: 0, peak: 0, totMax: 0, hot: false, fail: false };
// ── 시동 절차(Bell 206B-3 · Allison 250) ──
//   ① 스로틀 OFF 로 STARTER 를 누른다 — 스타터만으로 N1 이 오른다(약 22% 까지)
//   ② N1 12% 넘어서 스로틀을 IDLE 로 연다 — 1초 뒤 점화(light-off), TOT 가 치솟았다(최고 약 760~820°C) 가라앉는다
//   (STARTER 단추는 한 번 누르면 ON · 다시 누르면 OFF)
//   ③ N1 58% 넘어서 STARTER 를 놓는다(다시 눌러 OFF) — 엔진 스스로 IDLE(N1 약 63%)로 선다
//   N1 12% 전에 스로틀을 열면(연료가 먼저) TOT 가 927°C 를 넘는다 — HOT START. 58% 전에 놓으면 HUNG START(N1 이 처지고 TOT 가 오른다).
const B206S = { lightN1: 12, relN1: 58, idleN1: 63, crankMax: 22, startLim: 927, idleTot: 450 };
// 지금 엔진 레버(pcd1)에서 처음 상태를 읽는다(시작 상태 — 09-cdu.js startStateApply 는 FLY)
function _b206cRead() {
  try {
    const p = typeof ovhdGet === 'function' ? ovhdGet('pcd1') : 'FLY';
    b206c.th = p === 'OFF' ? 'OFF' : p === 'IDLE' ? 'IDLE' : 'FULL';
    b206c.run = p !== 'OFF';
  } catch (e) { _swallow(e); }
}
// 엔진 레버로 넘긴다 — 시동이 안 걸렸거나 스로틀이 닫혔으면 OFF
function _b206cApply() {
  const v = (!b206c.run || b206c.th === 'OFF') ? 'OFF' : b206c.th === 'IDLE' ? 'IDLE' : 'FLY';
  try {
    if (typeof ovhdSet === 'function') {
      for (const id of ['pcd1', 'pcd2']) if (ovhdGet(id) !== v) ovhdSet(id, v);
      for (const id of ['fuel1', 'fuel2']) if (ovhdGet(id) !== 'OPEN') ovhdSet(id, 'OPEN');
    }
  } catch (e) { _swallow(e); }
  if (b206c.th !== 'FULL' || !b206c.run) NR_GOV = 100;                 // 거버너는 FULL OPEN 에서만 맞춘다
}
function b206cThrottle(d) {
  const i = B206C_TH.indexOf(b206c.th), j = Math.max(0, Math.min(2, i + d));
  if (j === i) return;
  // IDLE → OFF(닫기)는 IDLE REL 을 누른 뒤에만
  if (B206C_TH[j] === 'OFF' && !(performance.now() < b206c.idleRel)) {
    try { uiToast('IDLE REL 단추를 누른 뒤에 스로틀을 OFF 로 닫으십시오'); } catch (e) { _swallow(e); }
    return;
  }
  b206c.th = B206C_TH[j];
  if (b206c.th === 'OFF') { b206c.run = false; b206c.idleRel = 0; b206c.fail = false; b206c.lit = false; b206c.litT = 0; b206c.hung = false; }      // 연료 차단 — 엔진이 꺼진다
  _b206cApply(); b206cRender();
}
function b206cIdleRel() { b206c.idleRel = performance.now() + B206C_REL_S * 1000; b206cRender(); }
// STARTER — 누르는 동안 돌린다(시동 절차는 위 B206S · b206cStep)
function b206cStarter(on) {
  if (on) {
    if (b206c.run) return;
    b206c.start = performance.now();
    if (!b206c.lit) { b206c.totMax = 0; b206c.hot = false; }
  } else b206c.start = 0;
  b206cRender();
}
function _b206cToast(m, k) { try { uiToast(m, k || '', 3000); } catch (e) { _swallow(e); } }
// 엔진 고장(교관 훈련) — 엔진이 멎는다(ENG OUT · 경고음). 스로틀을 OFF 로 닫았다가 다시 시동하면 되살아난다
function b206cFail(on = true) {
  b206c.fail = !!on;
  if (on) { b206c.run = false; b206c.lit = false; b206c.litT = 0; b206c.n1 = B206S.idleN1 + 20; b206c.tot = 600; _b206cApply(); _b206cToast('엔진 고장(훈련) — ENG OUT · 오토로테이션', 'err'); }
  b206cRender();
}
// 시동 중 계기 값 — 엔진이 서 있지 않을 때만(돌고 있으면 비행 모델 값) · 25-b206panel.js b206Vals
function b206cStartVals() {
  if (b206c.run || !(b206c.n1 > 0.5 || b206c.tot > 40)) return null;
  const n2 = b206c.lit ? Math.max(0, Math.min(60, (b206c.n1 - 22) * 1.6)) : 0;
  return { n1: b206c.n1, tot: b206c.tot, n2, lit: b206c.lit, hot: b206c.hot };
}
// 시동 · 정지 한 걸음(dt 초) — 100ms 타이머가 부른다(검사는 곧바로 부른다)
function b206cStep(dt) {
  const c = b206c, crank = !!c.start;
  if (c.run) { c.n1 = 0; c.tot = 30; c.lit = false; c.litT = 0; return; }
  const fuel = c.th !== 'OFF' && !c.fail && !(typeof b206FuelGal === 'function' && b206FuelGal() <= 0);
  // 연료가 들고 돌고 있으면 1초 뒤 점화 — 그때의 N1 으로 TOT 최고가 정해진다
  if (!c.lit && fuel && (crank || c.n1 > 5)) {
    c.litT += dt;
    if (c.litT >= 1) {
      c.lit = true;
      c.peak = c.n1 >= B206S.lightN1 ? 760 + Math.max(0, 15 - c.n1) * 20 : B206S.startLim + 30 + (B206S.lightN1 - c.n1) * 45;
    }
  }
  if (!fuel) { c.lit = false; c.litT = 0; }
  // N1
  if (c.lit) {
    if (crank) c.n1 = Math.min(B206S.idleN1 + 2, c.n1 + 4.5 * dt);
    else if (c.n1 >= B206S.relN1) c.n1 = Math.min(B206S.idleN1, c.n1 + 3 * dt);
    else { c.n1 = Math.max(0, c.n1 - 1.2 * dt); c.peak = Math.max(c.peak, c.tot + 60 * dt); if (!c.hung) { c.hung = true; _b206cToast(`HUNG START — N1 ${c.n1.toFixed(0)}% 에서 STARTER 를 놓았습니다(58% 넘어서 놓습니다) · 스로틀 OFF`, 'err'); } }
  } else if (crank) c.n1 += (B206S.crankMax - c.n1) * Math.min(1, 0.6 * dt);
  else c.n1 = Math.max(0, c.n1 - (c.n1 > 30 ? 8 : 4) * dt);
  // TOT — 점화되면 최고까지 치솟았다가 N1 이 오를수록 IDLE TOT 로 가라앉는다
  const tgt = c.lit ? (c.n1 < 35 ? c.peak : c.peak - (c.n1 - 35) / (B206S.idleN1 - 35) * (c.peak - B206S.idleTot)) : 30;
  c.tot += (tgt > c.tot ? Math.min(tgt - c.tot, 320 * dt) : Math.max(tgt - c.tot, -60 * dt));
  c.totMax = Math.max(c.totMax, c.tot);
  if (c.tot > B206S.startLim && !c.hot) { c.hot = true; _b206cToast(`HOT START — TOT ${B206S.startLim}°C 초과 · 스로틀 OFF(N1 ${B206S.lightN1}% 넘어서 연료를 넣습니다)`, 'err'); }
  // 시동 완료 — 점화된 채 N1 58% 넘어서 STARTER 를 놓았다
  if (c.lit && !crank && c.n1 >= B206S.idleN1 - 0.5) {
    c.run = true; c.hung = false; c.fail = false; _b206cApply(); b206cRender();
    _b206cToast(c.hot ? `엔진 시동 — IDLE (HOT START: TOT 최고 ${c.totMax.toFixed(0)}°C · 엔진 점검 필요)` : `엔진 시동 — IDLE (TOT 최고 ${c.totMax.toFixed(0)}°C)`, c.hot ? 'err' : '');
  }
}
function b206cBeep(d) { b206c.beep = d; b206cRender(); }
function b206cToggle(k) {
  if (k === 'ldg') b206c.ldg = !b206c.ldg;
  else if (k === 'srch') b206c.srch = { OFF: 'ON', ON: 'STOW', STOW: 'OFF' }[b206c.srch];
  else if (k === 'srchExt') b206c.srchExt = !b206c.srchExt;
  b206cRender();
}
let _b206cT = 0;
setInterval(() => {
  if (typeof acIs !== 'function' || !acIs('b206')) return;
  const now = performance.now(), dt = _b206cT ? Math.min(1.5, (now - _b206cT) / 1000) : 0; _b206cT = now;   // 타이머가 느리게 돌아도(배경 · 바쁜 기기) 실제 흐른 시간대로
  // 시동 절차 · 엔진 정지 후 N1/TOT 가 가라앉는 것
  { const wasRun = b206c.run, n = Math.round(b206c.n1); b206cStep(dt); if (b206c.run !== wasRun || Math.round(b206c.n1) !== n) b206cRender(); }
  // 연료가 다 떨어지면 엔진이 멎는다(flameout)
  if (b206c.run && typeof b206FuelGal === 'function' && b206FuelGal() <= 0) { b206c.run = false; _b206cApply(); _b206cToast('연료 소진 — 엔진 정지(FLAMEOUT)', 'err'); b206cRender(); }
  // 거버너 — FULL OPEN 에서 INCR/DECR 를 누르는 동안 1%/초
  if (b206c.beep && b206c.run && b206c.th === 'FULL') {
    NR_GOV = Math.max(B206C_GOV_MIN, Math.min(B206C_GOV_MAX, NR_GOV + b206c.beep * dt));
  }
  // 엔진 레버가 다른 데서 바뀌었으면(시작 상태 · 되살림) 따른다
  try {
    const p = ovhdGet('pcd1'), want = (!b206c.run || b206c.th === 'OFF') ? 'OFF' : b206c.th === 'IDLE' ? 'IDLE' : 'FLY';
    if (p && p !== want && !b206c.start) { _b206cRead(); b206cRender(); }
  } catch (e) { _swallow(e); }
  if (b206c.idleRel && now > b206c.idleRel) { b206c.idleRel = 0; b206cRender(); }
  _b206cMount();
}, 100);

// ── 그림(SVG · 빛과 그림자로 입체감) ──
function _b206cSvg() {
  const th = b206c.th, rel = performance.now() < b206c.idleRel, run = b206c.run;
  const twist = { FULL: -26, IDLE: 0, OFF: 26 }[th];                   // 눈금 FULL · IDLE · OFF(왼→오른) — 그립 줄무늬가 돌아간 만큼(좌우로 비켜 그린다)
  const lab = (x, y, t, s = 8, a = 'middle', c = '#e9ecef') => `<text x="${x}" y="${y}" font-size="${s}" fill="${c}" text-anchor="${a}" font-family="Arial" font-weight="bold">${t}</text>`;
  const ldgY = b206c.ldg ? 40 : 60;
  return `<svg viewBox="0 0 175 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible">
  <defs>
    <linearGradient id="bc-box" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#34373b"/><stop offset="1" stop-color="#121315"/></linearGradient>
    <linearGradient id="bc-tube" x1="0" x2="1"><stop offset="0" stop-color="#0c0d0e"/><stop offset="0.35" stop-color="#4a4e53"/><stop offset="0.55" stop-color="#2a2d30"/><stop offset="1" stop-color="#08090a"/></linearGradient>
    <linearGradient id="bc-cork" x1="0" x2="1"><stop offset="0" stop-color="#4b3a26"/><stop offset="0.4" stop-color="#9c8058"/><stop offset="0.6" stop-color="#7d6342"/><stop offset="1" stop-color="#3a2c1c"/></linearGradient>
    <radialGradient id="bc-btn" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#4a4d51"/><stop offset="1" stop-color="#0b0c0d"/></radialGradient>
    <linearGradient id="bc-tog" x1="0" x2="1"><stop offset="0" stop-color="#8a8f95"/><stop offset="0.5" stop-color="#f1f3f5"/><stop offset="1" stop-color="#7d8288"/></linearGradient>
  </defs>
  <!-- 스위치 상자 -->
  <rect x="6" y="6" width="163" height="152" rx="8" fill="url(#bc-box)" stroke="#000" stroke-width="2"/>
  <rect x="9" y="9" width="157" height="146" rx="6" fill="none" stroke="#4d5156" stroke-width="1"/>
  ${[[14, 14], [161, 14], [14, 150], [161, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#b9bec3" stroke="#555"/><line x1="${x - 3}" y1="${y}" x2="${x + 3}" y2="${y}" stroke="#555"/>`).join('')}
  ${lab(54, 22, 'SRCH LT — LDG LT', 7.5)}${lab(30, 31, 'ON', 7.5)}${lab(87, 31, 'ON', 7.5)}${lab(140, 31, 'INCR', 7.5)}
  ${lab(36, 82, 'STOW', 7.5)}${lab(87, 82, 'OFF', 7.5)}${lab(140, 82, 'DECR', 7.5)}${lab(40, 92, 'EXT', 7)}
  <!-- SRCH LT 단추(ON · OFF · STOW) -->
  <g data-bc="srch" style="cursor:pointer"><circle cx="40" cy="57" r="15" fill="url(#bc-btn)" stroke="#000" stroke-width="1.5"/>
    ${lab(40, 60, b206c.srch, 7, 'middle', b206c.srch === 'ON' ? '#ffd23a' : '#9aa0a6')}</g>
  <!-- LDG LT 토글 -->
  <g data-bc="ldg" style="cursor:pointer"><circle cx="87" cy="57" r="10" fill="#1b1c1e" stroke="#777" stroke-width="2"/>
    <rect x="83" y="${Math.min(ldgY, 57)}" width="8" height="${Math.abs(ldgY - 57) + 6}" rx="3" fill="url(#bc-tog)"/><circle cx="87" cy="${ldgY}" r="5.5" fill="url(#bc-tog)"/></g>
  <!-- GOV RPM 비프 스위치(INCR 위 · DECR 아래) -->
  <g><rect x="129" y="42" width="22" height="32" rx="4" fill="#0d0e0f" stroke="#555"/>
    <rect data-bc="incr" x="131" y="44" width="18" height="13" rx="3" fill="${b206c.beep > 0 ? '#4a4e53' : '#232528'}" style="cursor:pointer"/>
    <rect data-bc="decr" x="131" y="59" width="18" height="13" rx="3" fill="${b206c.beep < 0 ? '#4a4e53' : '#232528'}" style="cursor:pointer"/></g>
  <!-- SRCH LT 방향(EXT · RETR) -->
  <g data-bc="srchExt" style="cursor:pointer"><circle cx="44" cy="120" r="15" fill="url(#bc-btn)" stroke="#000" stroke-width="1.5"/>
    ${lab(44, 123, b206c.srchExt ? 'EXT' : 'RETR', 6.5, 'middle', '#9aa0a6')}</g>
  ${lab(14, 108, 'E', 7)}${lab(14, 117, 'X', 7)}${lab(14, 126, 'T', 7)}${lab(52, 150, 'RETR', 7.5)}
  ${[...'RIGHT'].map((c, i) => lab(86, 100 + i * 9, c, 7)).join('')}
  <!-- STARTER -->
  <g data-bc="starter" style="cursor:pointer"><circle cx="134" cy="118" r="17" fill="#060707" stroke="${b206c.start ? '#7dff3a' : '#3a3d40'}" stroke-width="${b206c.start ? 3 : 2}"/>
    <circle cx="134" cy="${b206c.start ? 120 : 117}" r="10" fill="url(#bc-btn)" stroke="#000"/></g>
  ${lab(134, 150, b206c.start ? 'STARTER ON' : 'STARTER', b206c.start ? 7 : 8, 'middle', b206c.start ? '#7dff3a' : '#e9ecef')}
  <!-- 목(관) · IDLE REL -->
  <path d="M44 158 H131 L127 236 H48 Z" fill="url(#bc-tube)" stroke="#000"/>
  <rect x="44" y="196" width="87" height="6" fill="#1a1b1d"/>
  <g data-bc="idlerel" style="cursor:pointer"><circle cx="118" cy="182" r="16" fill="#0c0d0e" stroke="${rel ? '#ffcf4a' : '#333'}" stroke-width="${rel ? 3 : 1.5}"/>
    ${lab(118, 180, 'IDLE', 7, 'middle', '#d9a85a')}${lab(118, 189, 'REL', 7, 'middle', '#d9a85a')}</g>
  <!-- 스로틀 눈금 띠(고정) · 지시 -->
  <rect x="46" y="238" width="83" height="14" fill="#0e0f10" stroke="#333"/>
  ${lab(58, 248, 'FULL', 7, 'middle', th === 'FULL' ? '#7dff3a' : '#888')}${lab(87.5, 248, 'IDLE', 7, 'middle', th === 'IDLE' ? '#ffd23a' : '#888')}${lab(117, 248, 'OFF', 7, 'middle', th === 'OFF' ? '#ff5a4a' : '#888')}
  <!-- 코르크 그립(돌아간 만큼 줄무늬가 비킨다) -->
  <g data-bc="grip" style="cursor:ew-resize">
    <rect x="44" y="254" width="87" height="104" rx="10" fill="url(#bc-cork)" stroke="#2a1f14" stroke-width="1.5"/>
    <line x1="${87.5 + twist}" y1="256" x2="${87.5 + twist}" y2="356" stroke="#2a1f14" stroke-width="2.5" opacity="0.8"/>
    <polygon points="${87.5 + twist - 5},254 ${87.5 + twist + 5},254 ${87.5 + twist},262" fill="#fff"/>
  </g>
  <!-- 엔진 상태(작게) -->
  ${lab(87.5, 372, run ? (th === 'FULL' ? `GOV ${NR_GOV.toFixed(0)}%` : 'ENG IDLE') : b206c.fail ? 'ENG FAIL' : b206c.n1 > 0.5 ? `N1 ${b206c.n1.toFixed(0)}%${b206c.lit ? ' · LIT' : ''}` : 'ENG OFF', 8, 'middle', run ? '#7dff3a' : '#ffb000')}
</svg>`;
}
function b206cRender() {
  const h = _b206cSvg();
  for (const id of ['b206-coll', 'b206-coll-pop-body']) {
    const el = document.getElementById(id);
    if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }
}
// ── 자리 ── 조종석 그림(#sim-ckpit · 1600×900) 의 하부 콘솔 오른쪽 — 흰수리의 CDU 칸 자리(15-heli3d.js CKPIT_CDU 근처)에 작게.
// 작은 것은 누르면 크게 띄울 뿐(조작은 큰 창에서) — 다른 화면(MFD · 콘솔)처럼. 큰 창은 지금 그림 크기(175×360 그림 단위)의 120%,
// 오른쪽 3D 버튼 줄(#ctl3d)과 겹치지 않게 그 왼쪽에 세로 가운데로 띄운다(#ck-layer 위).
const B206C_MINI = { x: 896, y: 808, w: 80, h: 165 }, B206C_DESIGN = { w: 175, h: 360 }, B206C_POP_K = 1.2;
let b206cPopOn = false;
function _b206cMount() {
  const ck = document.getElementById('sim-ckpit');
  if (ck && !document.getElementById('b206-coll')) {
    const el = document.createElement('div'); el.id = 'b206-coll';
    const m = B206C_MINI;
    el.style.cssText = `position:absolute;left:${m.x / 16}%;top:${m.y / 9}%;width:${m.w / 16}%;height:${m.h / 9}%;pointer-events:auto;cursor:zoom-in;z-index:2`;
    el.title = 'COLLECTIVE — 눌러 크게(스로틀 · STARTER · GOV RPM)';
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b206cPop(true); });
    ck.appendChild(el);
    _b206cRead(); b206cRender();
  }
  _b206cPopSync();
}
function b206cPop(on) { b206cPopOn = on === undefined ? !b206cPopOn : !!on; _b206cPopSync(); }
function _b206cPopSync() {
  const ck = document.getElementById('sim-ckpit');
  const show = b206cPopOn && !!ck && ck.classList.contains('show') && ck.offsetWidth > 0;
  let p = document.getElementById('b206-coll-pop');
  if (!show) { if (p) p.style.display = 'none'; if (!ck || !ck.classList.contains('show')) b206cPopOn = false; return; }
  const L = typeof _ckLayer === 'function' ? _ckLayer() : null;
  if (!L) return;
  if (!p) {
    p = document.createElement('div'); p.id = 'b206-coll-pop';
    p.innerHTML = '<div class="bcp-bar"><span>COLLECTIVE</span><button type="button" class="sim-btn bcp-fail" title="교관 훈련 — 엔진 고장(ENG OUT)">ENG FAIL</button><button type="button" class="sim-btn bcp-x" title="닫기">✕</button></div><div id="b206-coll-pop-body"></div>';
    p.querySelector('.bcp-x').addEventListener('click', e => { e.stopPropagation(); b206cPop(false); });
    p.querySelector('.bcp-fail').addEventListener('click', e => { e.stopPropagation(); if (b206c.run) b206cFail(true); else _b206cToast('엔진이 돌고 있을 때만 고장을 넣습니다'); });
    const body = p.querySelector('#b206-coll-pop-body');
    body.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-bc]'); if (!t) return;
      e.preventDefault(); e.stopPropagation();
      const k = t.dataset.bc;
      if (k === 'grip') { const r = t.getBoundingClientRect(); b206cThrottle(e.clientX < r.left + r.width / 2 ? 1 : -1); }
      else if (k === 'idlerel') b206cIdleRel();
      else if (k === 'starter') b206cStarter(!b206c.start);   // 한 번 누르면 ON · 다시 누르면 OFF(마우스로 스로틀을 돌리는 동안 손을 뗄 수 있게)
      else if (k === 'incr') b206cBeep(1);
      else if (k === 'decr') b206cBeep(-1);
      else b206cToggle(k);
    });
    const up = () => { if (b206c.beep) b206cBeep(0); };   // STARTER 는 눌러 켜고 눌러 끈다(손을 떼도 그대로)
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => body.addEventListener(ev, up));
    body.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); if (e.target.closest('[data-bc="grip"]')) b206cThrottle(e.deltaY > 0 ? -1 : 1); }, { passive: false });
  }
  if (p.parentElement !== L) L.appendChild(p);
  // 크기 — 종전 그림 크기(조종석 그림 좌표 175×360)의 120% · 위치 — 오른쪽 버튼 줄 왼쪽 12px · 세로 가운데
  const cw = ck.clientWidth, chh = ck.clientHeight, bar = 26;
  let w = B206C_DESIGN.w / 1600 * cw * B206C_POP_K, h = B206C_DESIGN.h / 900 * chh * B206C_POP_K;
  const k = Math.min(1, (L.clientHeight - 16 - bar) / h); w *= k; h *= k;          // 화면이 낮으면 줄인다
  const lr = L.getBoundingClientRect(), btn = document.getElementById('ctl3d');
  const br = btn && btn.offsetWidth > 0 ? btn.getBoundingClientRect() : null;
  const rightEdge = br ? br.left - lr.left - 12 : L.clientWidth - 140;
  const st = { display: 'flex', width: Math.round(w) + 'px', height: Math.round(h + bar) + 'px',
               left: Math.round(Math.max(6, rightEdge - w)) + 'px', top: Math.round(Math.max(6, (L.clientHeight - h - bar) / 2)) + 'px' };
  for (const kk in st) if (p.style[kk] !== st[kk]) p.style[kk] = st[kk];
  if (!document.getElementById('b206-coll-pop-body').dataset.h) b206cRender();
}
