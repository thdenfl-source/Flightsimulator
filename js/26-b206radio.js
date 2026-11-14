'use strict';
// ══════════════════════════════════════════════════════
// Bell 206B-3 항공전자 스택(Avionics Stack) — 기종이 b206 일 때(00-aircraft.js) LOWER CONSOLE 자리(19-lower.js 의 'html' 칸 #b206rad)
// 위에서 아래로(실기 사진 순서):
//   ① 오디오 패널 — 위 줄(SPEAKER) · 아래 줄(PHONE) 버튼: 1 COM 2 COM 3 COM 4 · 1 NAV 2 · DME · MKR · 1 ADF 2
//      왼쪽 INTERCOM VOL 노브 · 오른쪽 MIC 선택 노브(EMG · 1 · 2 · 3 · 4 · PA)
//   ② Garmin GNS 430(GPS / NAV / COM) — 켜면 데이터베이스 화면(PACIFIC · Cycle) → ENT 로 넘긴다
//      왼쪽 COM · VLOC 주파수(위 = 사용 · 아래 = 예비), 오른쪽 기본 항법 화면(WPT · DIS · DTK · TRK · GS · ETE) · 아래 CDI 막대
//      C⇄ · V⇄ 로 주 · 예비 바꾸기 · 왼쪽 큰/작은 노브(바깥 MHz · 안 kHz, 누르면 C/V 고르기) · FPL · CLR · ENT · D→ · RNG
//      VLOC 사용 주파수 = 시뮬레이터 NAV1(01-state.js setNavRadio)
//   ③ COMM 무전기(COM2) — USE · STBY · ⇄ · 바깥 MHz / 안 kHz 노브 · OFF/PULL TEST
//   ④ NAV 수신기(NAV2) — USE · STBY · ⇄ · 노브 · OFF/PULL IDENT  — USE 주파수 = 시뮬레이터 NAV2
//   ⑤ ADF(KR-87) — USE · STBY/TIMER · ADF · BFO · FRQ(바꾸기) · FLT/ET · SET/RST · 노브(바깥 100 · 안 1 kHz)
//   ⑥ 트랜스폰더(KT-76C) — FL(기압고도 · ALT 모드) · 코드 네 자리(아래 노브 넷) · IDT · VFR(1200) · 모드(OFF · SBY · TST · ON · ALT)
//      코드는 CDU XPDR 코드와 같다(09-cdu.js cduXpdrCode)
// 노브는 왼쪽을 누르면 −, 오른쪽을 누르면 +(바깥 고리 · 안 원판을 가린다) · 마우스 휠도 듣는다.
// 상태는 이 기기(localStorage 'b206rad')에 남는다. 실제 교신은 하지 않는다(조작 연습용).
// ══════════════════════════════════════════════════════
const B206R_KEY = 'b206rad';
const B206R_DEF = {
  aud: { spk: { com1: true, com2: false, com3: false, com4: false, nav1: false, nav2: false, dme: false, mkr: true, adf1: false, adf2: false },
         phn: { com1: true, com2: true, com3: false, com4: false, nav1: false, nav2: false, dme: false, mkr: false, adf1: false, adf2: false },
         mic: '1', ivol: 6 },
  gns: { on: true, page: 'BOOT', foc: 'C', com: [118.85, 124.6], vloc: [111.75, 113.6] },
  com: { on: true, f: [134.9, 126.47] },
  nav: { on: true, f: [111.75, 113.6] },
  adf: { on: true, f: [266, 440], mode: 'ADF', bfo: false, timer: 'FLT', et: 0 },
  xpdr: { mode: 'ALT', code: '0000', idt: 0 },
};
let b206r = JSON.parse(JSON.stringify(B206R_DEF));
try { const v = JSON.parse(localStorage.getItem(B206R_KEY) || 'null'); if (v) for (const k of Object.keys(B206R_DEF)) if (v[k]) b206r[k] = Object.assign(b206r[k], v[k]); } catch (e) { _swallow(e); }
b206r.gns.page = 'BOOT';                     // 켤 때마다 데이터베이스 화면부터
function _b206rSave() { try { localStorage.setItem(B206R_KEY, JSON.stringify(b206r)); } catch (e) { _swallow(e); } }

// ── 주파수 돌리기 ──
const _wrap = (v, lo, hi) => { const n = hi - lo + 1; return ((v - lo) % n + n) % n + lo; };
// COM 118.000 ~ 136.975 (25 kHz) · NAV 108.00 ~ 117.95 (50 kHz)
function _comTune(f, outer, d) {
  let mhz = Math.floor(f + 1e-6), khz = Math.round((f - mhz) * 1000);
  if (outer) mhz = _wrap(mhz + d, 118, 136); else khz = _wrap(khz / 25 + d, 0, 39) * 25;
  return +(mhz + khz / 1000).toFixed(3);
}
function _navTune(f, outer, d) {
  let mhz = Math.floor(f + 1e-6), khz = Math.round((f - mhz) * 100);
  if (outer) mhz = _wrap(mhz + d, 108, 117); else khz = _wrap(khz / 5 + d, 0, 19) * 5;
  return +(mhz + khz / 100).toFixed(2);
}
const _fCom = f => f.toFixed(2), _fNav = f => f.toFixed(2);
// 시뮬레이터 NAV 수신기에 넣는다(VOR · LOC 을 그 주파수로 찾는다)
function _b206rNavSet(id, f) { try { if (typeof setNavRadio === 'function') setNavRadio(id, f.toFixed(2), null); } catch (e) { _swallow(e); } }
function _b206rXpdrPush() { try { if (typeof window.cduXpdrCode === 'function') window.cduXpdrCode(b206r.xpdr.code); } catch (e) { _swallow(e); } }

// ── GNS 430 기본 항법 화면 값 ──
function _gnsNav() {
  const o = { wpt: '_____', dis: '__._', dtk: '___', trk: '___', gs: '___', ete: '__:__', dev: null };
  try {
    o.trk = String(Math.round((typeof toMag === 'function' ? toMag(S.hdg) : S.hdg) + 360) % 360).padStart(3, '0');
    o.gs = String(Math.round(Math.max(0, S.spd)));
    if (S.awp >= 0 && S.awp < S.wps.length) {
      const w = S.wps[S.awp], d = distance(S.lat, S.lon, w.lat, w.lon);
      o.wpt = (w.ident || 'WPT').slice(0, 6);
      o.dis = d < 100 ? d.toFixed(1) : String(Math.round(d));
      const dtk = typeof activeCrs === 'function' ? activeCrs() : S.crs;
      o.dtk = String(Math.round((typeof toMag === 'function' ? toMag(dtk) : dtk) + 360) % 360).padStart(3, '0');
      if (S.spd > 5) { const m = Math.round(d / S.spd * 60); o.ete = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
      try { if (typeof b206Cdi === 'function') { const c = b206Cdi(); if (c.ok) o.dev = c.dev; } } catch (e) { _swallow(e); }
    }
  } catch (e) { _swallow(e); }
  return o;
}

// ── 조작 ──
function b206rKnob(dev, part, d) {           // part: 'outer' | 'inner'
  const outer = part === 'outer';
  if (dev === 'gns') {
    const g = b206r.gns; if (!g.on) return;
    if (g.foc === 'C') g.com[1] = _comTune(g.com[1], outer, d); else g.vloc[1] = _navTune(g.vloc[1], outer, d);
  } else if (dev === 'com') { if (b206r.com.on) b206r.com.f[1] = _comTune(b206r.com.f[1], outer, d); }
  else if (dev === 'nav') { if (b206r.nav.on) b206r.nav.f[1] = _navTune(b206r.nav.f[1], outer, d); }
  else if (dev === 'adf') { if (b206r.adf.on) b206r.adf.f[1] = _wrap(b206r.adf.f[1] + d * (outer ? 100 : 1), 190, 1799); }
  else if (dev === 'ivol') b206r.aud.ivol = Math.max(0, Math.min(10, b206r.aud.ivol + d));
  else if (dev === 'mic') { const M = ['EMG', '1', '2', '3', '4', 'PA']; b206r.aud.mic = M[_wrap(M.indexOf(b206r.aud.mic) + d, 0, M.length - 1)]; }
  else if (dev === 'xmode') { const M = ['OFF', 'SBY', 'TST', 'ON', 'ALT']; b206r.xpdr.mode = M[Math.max(0, Math.min(4, M.indexOf(b206r.xpdr.mode) + d))]; }
  else if (/^xd[0-3]$/.test(dev)) {
    const i = +dev[2], c = b206r.xpdr.code.split('');
    c[i] = String(_wrap(+c[i] + d, 0, 7)); b206r.xpdr.code = c.join(''); _b206rXpdrPush();
  }
  _b206rSave(); b206rRender();
}
function b206rAct(a) {
  const g = b206r.gns;
  if (a.startsWith('aud:')) { const [, row, k] = a.split(':'); b206r.aud[row][k] = !b206r.aud[row][k]; }
  else if (a === 'gns:pwr') { g.on = !g.on; g.page = 'BOOT'; }
  else if (!g.on && a.startsWith('gns:')) return;
  else if (a === 'gns:ent') { if (g.page === 'BOOT') g.page = 'NAV'; }
  else if (a === 'gns:clr' || a === 'gns:nav') { if (g.page !== 'BOOT') g.page = 'NAV'; }
  else if (a === 'gns:fpl') { if (g.page !== 'BOOT') g.page = g.page === 'FPL' ? 'NAV' : 'FPL'; }
  else if (a === 'gns:cv') g.foc = g.foc === 'C' ? 'V' : 'C';
  else if (a === 'gns:cflip') { g.com.reverse(); }
  else if (a === 'gns:vflip') { g.vloc.reverse(); _b206rNavSet('NAV1', g.vloc[0]); }
  else if (a === 'gns:dto') { try { if (g.page !== 'BOOT' && S.awp >= 0 && S.awp < S.wps.length && typeof selectWP === 'function') selectWP(S.awp); } catch (e) { _swallow(e); } }   // 지금 자리에서 활성 지점으로 곧장
  else if (a === 'com:flip') { if (b206r.com.on) b206r.com.f.reverse(); }
  else if (a === 'com:pwr') b206r.com.on = !b206r.com.on;
  else if (a === 'nav:flip') { if (b206r.nav.on) { b206r.nav.f.reverse(); _b206rNavSet('NAV2', b206r.nav.f[0]); } }
  else if (a === 'nav:pwr') b206r.nav.on = !b206r.nav.on;
  else if (a === 'adf:pwr') b206r.adf.on = !b206r.adf.on;
  else if (a === 'adf:frq') { if (b206r.adf.on) { b206r.adf.f.reverse(); b206r.adf.timer = 'FRQ'; } }
  else if (a === 'adf:mode') b206r.adf.mode = b206r.adf.mode === 'ADF' ? 'ANT' : 'ADF';
  else if (a === 'adf:bfo') b206r.adf.bfo = !b206r.adf.bfo;
  else if (a === 'adf:fltet') b206r.adf.timer = b206r.adf.timer === 'FLT' ? 'ET' : 'FLT';
  else if (a === 'adf:setrst') { if (b206r.adf.timer === 'ET') b206r.adf.et = 0; }
  else if (a === 'xp:idt') { if (b206r.xpdr.mode === 'ON' || b206r.xpdr.mode === 'ALT') b206r.xpdr.idt = performance.now() + 18000; }
  else if (a === 'xp:vfr') { b206r.xpdr.code = '1200'; _b206rXpdrPush(); }
  _b206rSave(); b206rRender();
}
// 비행시간(FLT) · 경과시간(ET) — ADF 창의 타이머
let _b206rT = 0, _b206rFlt = 0;
setInterval(() => {
  const now = performance.now(), dt = _b206rT ? (now - _b206rT) / 1000 : 0; _b206rT = now;
  try { if (S.running) { _b206rFlt += dt * (simSpeed || 1); b206r.adf.et += dt * (simSpeed || 1); } } catch (e) { _swallow(e); }
  if (document.getElementById('b206rad') && document.getElementById('b206rad').dataset.built) b206rRender();
}, 500);

// ── 그리기 ──
const _seg = (t, cls = '') => `<span class="b2r-seg ${cls}">${t}</span>`;
const _mmss = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60) % 100}:${String(s % 60).padStart(2, '0')}`; };
function b206rRender() {
  const host = document.getElementById('b206rad');
  if (!host || !host.dataset.built) return;
  const set = (id, html) => { const e = host.querySelector(`[data-b2r="${id}"]`); if (e && e.innerHTML !== html) e.innerHTML = html; };
  const tog = (sel, on) => { host.querySelectorAll(sel).forEach(e => e.classList.toggle('on', !!on)); };
  // ① 오디오 패널
  for (const row of ['spk', 'phn']) for (const k of Object.keys(b206r.aud[row])) tog(`[data-act2="aud:${row}:${k}"]`, b206r.aud[row][k]);
  set('mic', b206r.aud.mic); set('ivol', String(b206r.aud.ivol));
  // ② GNS 430
  const g = b206r.gns, scr = host.querySelector('[data-b2r="gns"]');
  if (scr) {
    let html;
    if (!g.on) html = '';
    else if (g.page === 'BOOT') html = `<div class="b2r-boot"><b>PACIFIC</b><b>Aviation Database</b><i>Copyright 2023.<br>Jeppesen</i><b>Cycle 2311</b>` +
      `<i>Effective&nbsp; 02-NOV-23<br>Expires&nbsp;&nbsp; 30-NOV-23</i><span class="b2r-ok">OK?</span><div class="b2r-globe"></div></div>`;
    else {
      const n = _gnsNav();
      const fr = (lbl, a, s, foc) => `<div class="b2r-gf${foc ? ' foc' : ''}"><em>${lbl}</em><b>${a}</b><span>${s}</span></div>`;
      const left = fr('COM', g.com[0].toFixed(3), g.com[1].toFixed(3), g.foc === 'C') + fr('VLOC', _fNav(g.vloc[0]), _fNav(g.vloc[1]), g.foc === 'V');
      let right;
      if (g.page === 'FPL') {
        const rows = (S.wps || []).slice(0, 6).map((w, i) => `<div class="${i === S.awp ? 'act' : ''}">${i === S.awp ? '→' : '&nbsp;'} ${(w.ident || 'WPT').slice(0, 7)}</div>`).join('') || '<div>NO FLIGHT PLAN</div>';
        right = `<div class="b2r-gfpl"><em>ACTIVE FLIGHT PLAN</em>${rows}</div>`;
      } else {
        const kv = (k, v) => `<div><em>${k}</em><b>${v}</b></div>`;
        const cdi = n.dev === null ? '<div class="b2r-cdi off">CDI</div>'
          : `<div class="b2r-cdi"><i style="left:${(50 + n.dev * 45).toFixed(1)}%"></i></div>`;
        right = `<div class="b2r-gnav"><div class="b2r-gwpt">GPS&nbsp; <b>${n.wpt}</b></div>${kv('DIS', n.dis + 'nm')}${kv('DTK', n.dtk + '°')}${kv('TRK', n.trk + '°')}${kv('GS', n.gs + 'kt')}${kv('ETE', n.ete)}</div>${cdi}`;
      }
      html = `<div class="b2r-gl">${left}</div><div class="b2r-gr">${right}</div>`;
    }
    if (scr.dataset.h !== html) { scr.dataset.h = html; scr.innerHTML = html; }
    scr.classList.toggle('off', !g.on);
  }
  // ③ COMM · ④ NAV
  set('com', b206r.com.on ? _seg(_fCom(b206r.com.f[0])) + _seg(_fCom(b206r.com.f[1])) : '');
  set('nav', b206r.nav.on ? _seg(_fNav(b206r.nav.f[0])) + _seg(_fNav(b206r.nav.f[1])) : '');
  // ⑤ ADF — STBY 칸은 FRQ(예비 주파수) · FLT(비행시간) · ET(경과시간)
  const a = b206r.adf;
  const right = a.timer === 'FRQ' ? _seg(String(a.f[1])) : _seg(_mmss(a.timer === 'FLT' ? _b206rFlt : a.et)) + `<small>${a.timer}</small>`;
  set('adf', a.on ? `<small class="b2r-ann">${a.mode}${a.bfo ? ' BFO' : ''}</small>` + _seg(String(a.f[0])) + right : '');
  // ⑥ 트랜스폰더 — FL(기압고도/100 · ALT 모드에서) · 코드 · R(응답 · IDT 18초)
  const x = b206r.xpdr, on = x.mode !== 'OFF';
  let fl = '---';
  try { fl = String(Math.max(0, Math.round(S.alt / 100))).padStart(3, '0'); } catch (e) { _swallow(e); }
  const reply = on && x.mode !== 'SBY' && (performance.now() < x.idt ? Math.floor(performance.now() / 300) % 2 === 0 : Math.floor(performance.now() / 1500) % 2 === 0);
  set('xpdr', on ? `<small class="b2r-fl">FL</small>${_seg(x.mode === 'ALT' ? fl : '---')}<small class="b2r-alt">${x.mode === 'TST' ? 'TST' : x.mode}</small>` +
    `${reply ? '<small class="b2r-r">R</small>' : ''}${_seg(x.mode === 'TST' ? '8888' : x.code)}` : '');
  set('xmode', x.mode);
  host.querySelectorAll('[data-knob="xmode"]').forEach(e => e.style.setProperty('--a', `${(['OFF', 'SBY', 'TST', 'ON', 'ALT'].indexOf(x.mode) - 2) * 32}deg`));
  ['com', 'nav', 'adf'].forEach(k => tog(`[data-act2="${k}:pwr"]`, b206r[k].on));
  tog('[data-act2="gns:pwr"]', g.on);
  tog('[data-act2="adf:bfo"]', a.bfo);
}
function b206rBuild() {
  const host = document.getElementById('b206rad');
  if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  const AUD = [['com1', '1'], ['com2', 'COM 2'], ['com3', 'COM 3'], ['com4', 'COM 4'], ['nav1', '1'], ['nav2', 'NAV 2'], ['dme', 'DME'], ['mkr', 'MKR'], ['adf1', '1'], ['adf2', 'ADF 2']];
  const ab = row => AUD.map(([k]) => `<button class="b2r-ab" data-act2="aud:${row}:${k}"><i></i></button>`).join('');
  const knob = (id, cls, title) => `<div class="b2r-knob ${cls}" data-knob="${id}" title="${title}"><div class="b2r-kin"></div></div>`;
  const flip = id => `<button class="b2r-flip" data-act2="${id}">↔</button>`;
  const pwr = (id, t) => `<button class="b2r-pwr" data-act2="${id}" title="${t}"></button>`;
  host.innerHTML =
    // ① 오디오 패널
    `<div class="b2r-unit b2r-aud"><div class="b2r-brand">BENDIX/KING</div>${knob('ivol', 'sm', 'INTERCOM VOL — 왼쪽 − · 오른쪽 +')}<div class="b2r-ivl">INTERCOM <b data-b2r="ivol"></b></div>` +
    `<div class="b2r-arow t">${ab('spk')}</div><div class="b2r-alab">1 COM 2 COM 3 COM 4 &nbsp; 1 NAV 2 &nbsp; DME&nbsp; MKR &nbsp; 1 ADF 2</div><div class="b2r-arow b">${ab('phn')}</div>` +
    `<div class="b2r-sl t">SPEAKER</div><div class="b2r-sl b">PHONE</div>` +
    `${knob('mic', 'mic', 'MIC 선택 — EMG · 1 · 2 · 3 · 4 · PA')}<div class="b2r-micl">MIC <b data-b2r="mic"></b></div></div>` +
    // ② GNS 430
    `<div class="b2r-unit b2r-gns"><div class="b2r-brand">GARMIN</div><div class="b2r-model">GNS 430</div>` +
    `${pwr('gns:pwr', 'GNS 430 전원(COM VOL)')}<button class="b2r-gk cflip" data-act2="gns:cflip">C↔</button><button class="b2r-gk vflip" data-act2="gns:vflip">V↔</button>` +
    `<div class="b2r-scr" data-b2r="gns"></div>` +
    `${knob('gns', 'big gl', 'COM/VLOC 노브 — 바깥 MHz · 안 kHz(왼쪽 − · 오른쪽 +)')}<button class="b2r-gk cv" data-act2="gns:cv">C/V</button>` +
    `<div class="b2r-gbtm">${['CDI', 'OBS', 'MSG', 'FPL', 'PROC'].map(t => `<button class="b2r-gb" data-act2="gns:${t.toLowerCase()}">${t}</button>`).join('')}</div>` +
    `<div class="b2r-gright"><button class="b2r-gb" data-act2="gns:rng">RNG</button><button class="b2r-gb" data-act2="gns:dto">D→</button><button class="b2r-gb" data-act2="gns:nav">MENU</button>` +
    `<button class="b2r-gb" data-act2="gns:clr">CLR</button><button class="b2r-gb" data-act2="gns:ent">ENT</button></div>${knob('gns2', 'big gr2', 'PUSH CRSR')}</div>` +
    // ③ COMM
    `<div class="b2r-unit b2r-rad"><div class="b2r-tag">COMM</div><div class="b2r-disp" data-b2r="com"></div><div class="b2r-ul">USE</div><div class="b2r-sl2">STBY</div>` +
    `${pwr('com:pwr', 'OFF / PULL TEST')}<div class="b2r-pl">PULL<br>TEST</div>${knob('com', 'big', '주파수 — 바깥 MHz · 안 kHz')}${flip('com:flip')}</div>` +
    // ④ NAV
    `<div class="b2r-unit b2r-rad"><div class="b2r-tag">NAV</div><div class="b2r-disp" data-b2r="nav"></div><div class="b2r-ul">USE</div><div class="b2r-sl2">STBY</div>` +
    `${pwr('nav:pwr', 'OFF / PULL IDENT')}<div class="b2r-pl">PULL<br>IDENT</div>${knob('nav', 'big', '주파수 — 바깥 MHz · 안 kHz')}${flip('nav:flip')}</div>` +
    // ⑤ ADF
    `<div class="b2r-unit b2r-rad b2r-adf"><div class="b2r-tag">ADF</div><div class="b2r-disp" data-b2r="adf"></div><div class="b2r-ul">USE</div><div class="b2r-sl2">STBY/TIMER</div>` +
    `${pwr('adf:pwr', 'OFF / VOL')}<div class="b2r-pl">VOL</div>${knob('adf', 'big', '주파수 — 바깥 100 · 안 1 kHz')}` +
    `<div class="b2r-abtn">${[['adf:mode', 'ADF'], ['adf:bfo', 'BFO'], ['adf:frq', 'FRQ'], ['adf:fltet', 'FLT/ET'], ['adf:setrst', 'SET/RST']].map(([a, t]) => `<button class="b2r-wb" data-act2="${a}">${t}</button>`).join('')}</div></div>` +
    // ⑥ 트랜스폰더
    `<div class="b2r-unit b2r-rad b2r-xp"><button class="b2r-wb idt" data-act2="xp:idt">IDT</button><div class="b2r-disp" data-b2r="xpdr"></div>` +
    `${knob('xmode', 'mode', '모드 — OFF · SBY · TST · ON · ALT')}<div class="b2r-xml">OFF SBY TST ON ALT</div><div class="b2r-xmv" data-b2r="xmode"></div>` +
    `<div class="b2r-xk">${[0, 1, 2, 3].map(i => knob('xd' + i, 'xd', `코드 ${i + 1}째 자리 — 왼쪽 − · 오른쪽 +`)).join('')}</div>` +
    `<button class="b2r-wb vfr" data-act2="xp:vfr">VFR</button><div class="b2r-tag xptag">XPNDR</div></div>`;
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-act2]'); if (!b) return;
    e.stopPropagation(); b206rAct(b.dataset.act2);
  });
  // 노브 — 누른 자리로 바깥 고리 · 안 원판, 왼쪽 − · 오른쪽 +(누르고 있으면 계속) · 휠
  host.querySelectorAll('[data-knob]').forEach(kn => {
    let t0 = null, rep = null;
    const zone = e => {
      const r = kn.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      return { part: Math.hypot(dx, dy) / (r.width / 2) < 0.55 ? 'inner' : 'outer', d: dx < 0 ? -1 : 1 };
    };
    const stop = () => { clearTimeout(t0); clearInterval(rep); t0 = rep = null; };
    kn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const z = zone(e), id = kn.dataset.knob;
      if (id === 'gns2') return;                                   // PUSH CRSR — 아직 쓰지 않는다
      b206rKnob(id, z.part, z.d);
      t0 = setTimeout(() => { rep = setInterval(() => b206rKnob(id, z.part, z.d), 140); }, 400);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => kn.addEventListener(ev, stop));
    kn.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); const z = zone(e); b206rKnob(kn.dataset.knob, z.part, e.deltaY > 0 ? -1 : 1); }, { passive: false });
  });
  // 처음 — VLOC · NAV 사용 주파수를 시뮬레이터 NAV1 · NAV2 에 맞추고, 트랜스폰더 코드를 CDU 에
  _b206rNavSet('NAV1', b206r.gns.vloc[0]); _b206rNavSet('NAV2', b206r.nav.f[0]); _b206rXpdrPush();
  b206rRender();
}
if (document.getElementById('b206rad')) b206rBuild();
