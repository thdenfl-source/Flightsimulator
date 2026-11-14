'use strict';
// ══════════════════════════════════════════════════════
// Bell 206B-3 컬렉티브 머리(스위치 상자) + 스로틀 그립 — Bell Cockpit Mode(15-heli3d.js #sim-ckpit) 하부 콘솔 오른쪽(흰수리 CDU 자리)에 작게, 누르면 크게(120%)
// 실기 사진대로: 위 스위치 상자
//   SRCH LT(ON · OFF · STOW) 단추 · LDG LT(ON · OFF) 토글 · GOV RPM(INCR · DECR) 비프 스위치
//   SRCH LT 방향(EXT · RETR) 단추 · STARTER 누름 단추
// 아래 IDLE REL 단추가 달린 목 · 코르크 스로틀 그립(돌려서 OFF · IDLE · FULL OPEN)
// 엔진:
//   스로틀 OFF → 엔진 꺼짐(연료 차단). OFF 에서 IDLE 로 열고 STARTER 를 1.5초 누르고 있으면 시동(light-off).
//   IDLE → FULL OPEN 은 그냥 돌린다. FULL/IDLE → OFF 는 IDLE REL 단추를 누른 뒤에만(3초 동안) 닫힌다(실기처럼 실수로 끄지 않게).
//   엔진 상태는 시뮬레이터의 엔진 레버(17-upper.js pcd1 · pcd2 — OFF · IDLE · FLY)로 넘긴다 — NR · 토크 · 계기는 그대로 따른다.
//   FULL OPEN 이면 GOV RPM INCR/DECR 를 누르는 동안 거버너 NR(03-pfd.js NR_GOV)을 97 ~ 100% 사이에서 1%/초로 맞춘다.
// 그립은 왼쪽을 누르면 닫히고(OFF 쪽) 오른쪽을 누르면 열린다(FULL 쪽) · 휠도 듣는다.
// ══════════════════════════════════════════════════════
const B206C_TH = ['OFF', 'IDLE', 'FULL'];
const B206C_GOV_MIN = 97, B206C_GOV_MAX = 100, B206C_START_S = 1.5, B206C_REL_S = 3;
const b206c = { th: 'FULL', run: true, idleRel: 0, start: 0, ldg: false, srch: 'OFF', srchExt: false, beep: 0 };
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
  if (b206c.th === 'OFF') { b206c.run = false; b206c.idleRel = 0; }      // 연료 차단 — 엔진이 꺼진다
  _b206cApply(); b206cRender();
}
function b206cIdleRel() { b206c.idleRel = performance.now() + B206C_REL_S * 1000; b206cRender(); }
// STARTER — 누르는 동안 돌린다. 스로틀이 IDLE 에서 1.5초 넘게 돌리면 시동이 걸린다
function b206cStarter(on) {
  if (on) {
    if (b206c.run) return;
    b206c.start = performance.now();
    if (b206c.th === 'OFF') { try { uiToast('스타터 — 스로틀을 IDLE 로 열어야 시동이 걸립니다'); } catch (e) { _swallow(e); } }
  } else b206c.start = 0;
  b206cRender();
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
  // 시동 — 스로틀 IDLE · STARTER 1.5초
  if (b206c.start && !b206c.run && b206c.th === 'IDLE' && now - b206c.start >= B206C_START_S * 1000) {
    b206c.run = true; b206c.start = 0; _b206cApply(); b206cRender();
    try { uiToast('엔진 시동 — IDLE'); } catch (e) { _swallow(e); }
  }
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
  const twist = { OFF: -26, IDLE: 0, FULL: 26 }[th];                   // 그립 줄무늬가 돌아간 만큼(좌우로 비켜 그린다)
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
  <g data-bc="starter" style="cursor:pointer"><circle cx="134" cy="118" r="17" fill="#060707" stroke="#3a3d40" stroke-width="2"/>
    <circle cx="134" cy="${b206c.start ? 120 : 117}" r="10" fill="url(#bc-btn)" stroke="#000"/></g>
  ${lab(134, 150, 'STARTER', 8)}
  <!-- 목(관) · IDLE REL -->
  <path d="M44 158 H131 L127 236 H48 Z" fill="url(#bc-tube)" stroke="#000"/>
  <rect x="44" y="196" width="87" height="6" fill="#1a1b1d"/>
  <g data-bc="idlerel" style="cursor:pointer"><circle cx="118" cy="182" r="16" fill="#0c0d0e" stroke="${rel ? '#ffcf4a' : '#333'}" stroke-width="${rel ? 3 : 1.5}"/>
    ${lab(118, 180, 'IDLE', 7, 'middle', '#d9a85a')}${lab(118, 189, 'REL', 7, 'middle', '#d9a85a')}</g>
  <!-- 스로틀 눈금 띠(고정) · 지시 -->
  <rect x="46" y="238" width="83" height="14" fill="#0e0f10" stroke="#333"/>
  ${lab(58, 248, 'OFF', 7, 'middle', th === 'OFF' ? '#ff5a4a' : '#888')}${lab(87.5, 248, 'IDLE', 7, 'middle', th === 'IDLE' ? '#ffd23a' : '#888')}${lab(117, 248, 'FULL', 7, 'middle', th === 'FULL' ? '#7dff3a' : '#888')}
  <!-- 코르크 그립(돌아간 만큼 줄무늬가 비킨다) -->
  <g data-bc="grip" style="cursor:ew-resize">
    <rect x="44" y="254" width="87" height="104" rx="10" fill="url(#bc-cork)" stroke="#2a1f14" stroke-width="1.5"/>
    <line x1="${87.5 + twist}" y1="256" x2="${87.5 + twist}" y2="356" stroke="#2a1f14" stroke-width="2.5" opacity="0.8"/>
    <polygon points="${87.5 + twist - 5},254 ${87.5 + twist + 5},254 ${87.5 + twist},262" fill="#fff"/>
  </g>
  <!-- 엔진 상태(작게) -->
  ${lab(87.5, 372, run ? (th === 'FULL' ? `GOV ${NR_GOV.toFixed(0)}%` : 'ENG IDLE') : (b206c.start ? 'CRANKING' : 'ENG OFF'), 8, 'middle', run ? '#7dff3a' : '#ffb000')}
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
    p.innerHTML = '<div class="bcp-bar"><span>COLLECTIVE</span><button type="button" class="sim-btn bcp-x" title="닫기">✕</button></div><div id="b206-coll-pop-body"></div>';
    p.querySelector('.bcp-x').addEventListener('click', e => { e.stopPropagation(); b206cPop(false); });
    const body = p.querySelector('#b206-coll-pop-body');
    body.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-bc]'); if (!t) return;
      e.preventDefault(); e.stopPropagation();
      const k = t.dataset.bc;
      if (k === 'grip') { const r = t.getBoundingClientRect(); b206cThrottle(e.clientX < r.left + r.width / 2 ? -1 : 1); }
      else if (k === 'idlerel') b206cIdleRel();
      else if (k === 'starter') b206cStarter(true);
      else if (k === 'incr') b206cBeep(1);
      else if (k === 'decr') b206cBeep(-1);
      else b206cToggle(k);
    });
    const up = () => { if (b206c.start) b206cStarter(false); if (b206c.beep) b206cBeep(0); };
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
