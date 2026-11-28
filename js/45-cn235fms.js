'use strict';
// ══════════════════════════════════════════════════════
// CN-235 FMS(Universal) · RTU(무전 튜닝 패널) · ACU(오디오) — CN235-110 AFM · AOM 의 구성 · 절차대로
//
// FMS — NCU(GPS/WAAS · INS · ADC · VOR · DME 를 모아 최적 위치 BCP) · CDU(페데스탈) · SSDTU(자료 넣기)
//   PWR/DIM       전원 → 자가진단(센서 · BCP · ANP/RNP) → NAV 쪽
//   NAV 1/2       FR/TO · DTK · TKE · XTK · GS · ETE / BCP 센서 · ANP · RNP · 위치
//   DTO           비행계획 지점 · 다른 지점(입력한 식별부호) 곧장 · 선회 방향(AUTO · LEFT · RIGHT) · DIVERT(가까운 공항)
//   FPL           비행계획 보기 · 넣기(식별부호 + LSK) · 지우기(DEL + LSK) · 지점 자동 넘김(06-nav.js)
//   HDG(CMD HDG)  지시 침로(HDG SEL) · TURN L/R xx° · INTERCEPT(NAV 무장) · CNCL HDG
//   VNAV          TO 지점의 고도 · 필요 승강률 · 수직 이탈(VDEV) · VNAV 켜면 그 승강률로 내려가/올라가 고도에서 ALT
//   MENU → SEARCH MMMS 수색 6가지 — RISING LADDER · EXP SQUARE · RACE TRACK · SECTOR · ORBIT · BORDER PATROL
//   TUNE · DATA · PERF · FUEL · LIST · MSG · PREV/NEXT
//   FMS CDU SEL(RH 콘솔 CKPT/TACCO) — TACCO 면 조종석 CDU 는 듣지 않는다 · 전원 · 회로차단기 FMS
//   FMS 횡 항법이면 AP(NAV)에 롤 스티어링(06-nav.js · 01-state.js 의 NAV AP 가 그대로 따라간다)
// RTU(VHF COM · NAV 조작 패널) — 위 창 ACTIVE · 아래 창 PRESELECT · 등(ACT · MEM · TX)
//   동축 노브 — 바깥 1MHz · 안 25kHz(COM) · 50kHz(NAV) · COM 118.000~151.975 · NAV 108.00~117.95
//   XFR(주 ↔ 예비 바꿈 · 무전기 다시 맞춤) · MEM(채널 1~6 을 아래 창에) · STO(누르면 채널 고르기 · 5초 안 다시 누르면 저장)
//   ACT 2초 — 아래 창 '---' · 노브가 위 창을 곧바로 · TEST 5초 BITE(--- / 00) · GUARD 121.5
// ACU — 송신 셀렉터 TX1(V/U1) · TX2(VHF2) · TX3(VHF1) · TX4(V/U2) · TX5(HF) · D · IC — PTT 면 그 무전기 TX 등 · 스피커 묵음
// ══════════════════════════════════════════════════════

// ── RTU ──
const RTU_RANGE = { com: [118.0, 151.975, 0.025], nav: [108.0, 117.95, 0.05] };
function _rtuMk(k) {
  const isNav = k.startsWith('nav');
  let r = null; try { r = typeof cduRadio === 'function' ? cduRadio(k) : null; } catch (e) { _swallow(e); }
  const d = isNav ? ['115.50', '116.10'] : ['118.850', '124.600'];
  return { k, nav: isNav, act: +(r ? r.act : d[0]), pre: +(r ? r.stb : d[1]), mem: isNav ? [108.1, 109.9, 110.3, 113.6, 115.5, 116.1] : [118.1, 121.5, 123.45, 124.6, 126.2, 129.05],
           memI: -1, memLamp: false, actT: 0, direct: 0, sto: null, test: 0 };
}
cn.rtu = { com1: _rtuMk('com1'), com2: _rtuMk('com2'), nav1: _rtuMk('nav1'), nav2: _rtuMk('nav2') };
cn.acu = { tx: 'TX3', mute: false };
const CN_TX = { TX1: 'V/U1', TX2: 'VHF2', TX3: 'VHF1', TX4: 'V/U2', TX5: 'HF', D: 'MULTI', IC: 'ICS' };
function _rtuClamp(r, f) {
  const [lo, hi, st] = RTU_RANGE[r.nav ? 'nav' : 'com'];
  f = Math.round(f / st) * st;
  if (f > hi + 1e-6) f = lo + (f - hi - st); if (f < lo - 1e-6) f = hi - (lo - f - st);
  return +Math.max(lo, Math.min(hi, f)).toFixed(3);
}
function rtuFmt(r, f) { return r.nav ? f.toFixed(2) : f.toFixed(3); }
// 무전기에 맞춘다 — CDU AUDIO 의 주 · 예비(09b-cdu-screens.js) · NAV 는 VOR/ILS 국도(01-state.js setNavRadio)
function rtuApply(r) {
  try { if (typeof cduSetRadio === 'function') cduSetRadio(r.k, r.act, r.pre); } catch (e) { _swallow(e); }
  if (r.nav) { try { setNavRadio(r.k.toUpperCase(), r.act.toFixed(2)); } catch (e) { _swallow(e); } }
  r.actT = performance.now() + 900;                 // ACT 등 — 다시 맞추는 동안 깜빡
}
function rtuKnob(k, outer, d) {
  const r = cn.rtu[k]; if (!r || r.test > performance.now()) return;
  if (r.sto) { r.sto.ch = ((r.sto.ch - 1 + d + 6) % 6) + 1; r.sto.t = performance.now(); return; }   // STO — 채널 고르기
  const st = outer ? 1 : RTU_RANGE[r.nav ? 'nav' : 'com'][2];
  if (r.direct > performance.now()) { r.act = _rtuClamp(r, r.act + d * st); r.direct = performance.now() + 5000; rtuApply(r); }
  else { r.pre = _rtuClamp(r, r.pre + d * st); r.memLamp = false; r.memI = -1; }
}
function rtuXfr(k) { const r = cn.rtu[k]; if (!r) return; const a = r.act; r.act = r.pre; r.pre = a; r.memLamp = false; r.direct = 0; rtuApply(r); }
function rtuMem(k) { const r = cn.rtu[k]; if (!r) return; r.memI = (r.memI + 1) % 6; r.pre = r.mem[r.memI]; r.memLamp = true; }
function rtuSto(k) {
  const r = cn.rtu[k]; if (!r) return; const now = performance.now();
  if (r.sto && now - r.sto.t < 5000) { r.mem[r.sto.ch - 1] = r.pre; try { uiToast(`${k.toUpperCase()} CH ${r.sto.ch} ← ${rtuFmt(r, r.pre)} 저장`, 'ok'); } catch (e) { _swallow(e); } r.sto = null; return; }
  r.sto = { ch: Math.max(1, r.memI + 1), t: now };
}
function rtuAct(k) { const r = cn.rtu[k]; if (r) r.direct = r.direct > performance.now() ? 0 : performance.now() + 5000; }
function rtuTest(k) { const r = cn.rtu[k]; if (r) r.test = performance.now() + 7000; }
function rtuGuard(k) { const r = cn.rtu[k]; if (!r || r.nav) return; r.pre = r.act; r.act = 121.5; rtuApply(r); try { uiToast(`${k.toUpperCase()} GUARD 121.500`, 'warn'); } catch (e) { _swallow(e); } }
// 이 무전기가 지금 송신 중인가 — ACU 송신 셀렉터 + PTT
function rtuTx(k) {
  let tx = false; try { tx = typeof kuhTxOn === 'function' && kuhTxOn(); } catch (e) { _swallow(e); }
  if (!tx) return false;
  const s = cn.acu.tx; return s === 'D' || (s === 'TX3' && k === 'com1') || (s === 'TX2' && k === 'com2');
}
// RTU 한 대(그림 좌표 w×h) — 창 둘 · 등 · XFR/MEM · STO · TEST · ACT · 노브(바깥 · 안 — 왼쪽 반 −, 오른쪽 반 +)
function cnRtuDraw(g, x, y, w, h, k) {
  const r = cn.rtu[k], now = performance.now(), test = r.test > now, s = Math.min(w / 240, h / 182);
  _cnBlackPanel(g, x, y, w, h, null);
  x += (w - 240 * s) / 2;
  _cnT(g, (r.nav ? 'NAV ' : 'COM ') + k.slice(-1), x + 30 * s, y + 18 * s, 11 * s, '#ddd');
  const dim = test && r.test - now > 2000 ? 0.3 + 0.7 * Math.abs(Math.sin(now / 200)) : 1;
  g.save(); g.globalAlpha = dim;
  const a = test && r.test - now <= 2000 ? '---' : rtuFmt(r, r.act), p = test && r.test - now <= 2000 ? '00' : r.sto ? `CH ${r.sto.ch}` : r.direct > now ? '---' : rtuFmt(r, r.pre);
  _cnDig(g, x + 20 * s, y + 30 * s, 150 * s, 38 * s, a, '#ff7a3a');
  _cnDig(g, x + 20 * s, y + 74 * s, 150 * s, 30 * s, p, r.memLamp ? '#ffd21a' : '#ff9a5a');
  g.restore();
  _cnLamp(g, x + 180 * s, y + 30 * s, 46 * s, 14 * s, 'ACT', r.actT > now && (now / 150 | 0) % 2 || r.direct > now, '#f39a1f', 8 * s);
  _cnLamp(g, x + 180 * s, y + 48 * s, 46 * s, 14 * s, 'MEM', r.memLamp || !!r.sto, '#f39a1f', 8 * s);
  _cnLamp(g, x + 180 * s, y + 66 * s, 46 * s, 14 * s, 'TX', rtuTx(k), '#28e04a', 8 * s);
  // XFR / MEM 토글 · STO · TEST · ACT · GUARD
  _cnBtn(g, x + 14 * s, y + 116 * s, 44 * s, 22 * s, 'XFR', false, 9 * s); _cnHit(x + 14 * s, y + 116 * s, 44 * s, 22 * s, () => rtuXfr(k));
  _cnBtn(g, x + 14 * s, y + 142 * s, 44 * s, 22 * s, 'MEM', r.memLamp, 9 * s); _cnHit(x + 14 * s, y + 142 * s, 44 * s, 22 * s, () => rtuMem(k));
  _cnBtn(g, x + 64 * s, y + 116 * s, 40 * s, 22 * s, 'STO', !!r.sto, 9 * s); _cnHit(x + 64 * s, y + 116 * s, 40 * s, 22 * s, () => rtuSto(k));
  _cnBtn(g, x + 64 * s, y + 142 * s, 40 * s, 22 * s, 'TEST', test, 9 * s); _cnHit(x + 64 * s, y + 142 * s, 40 * s, 22 * s, () => rtuTest(k));
  _cnBtn(g, x + 110 * s, y + 116 * s, 40 * s, 22 * s, 'ACT', r.direct > now, 9 * s); _cnHit(x + 110 * s, y + 116 * s, 40 * s, 22 * s, () => rtuAct(k));
  if (!r.nav) { _cnBtn(g, x + 110 * s, y + 142 * s, 40 * s, 22 * s, 'GUARD', false, 8 * s); _cnHit(x + 110 * s, y + 142 * s, 40 * s, 22 * s, () => rtuGuard(k)); }
  // 동축 노브
  const cx = x + 196 * s, cy = y + 136 * s;
  g.save(); g.fillStyle = '#6c7378'; g.beginPath(); g.arc(cx, cy, 30 * s, 0, 7); g.fill(); g.fillStyle = '#9aa1a6'; g.beginPath(); g.arc(cx, cy, 16 * s, 0, 7); g.fill(); g.restore();
  _cnT(g, '−', cx - 23 * s, cy, 10 * s, '#fff'); _cnT(g, '+', cx + 23 * s, cy, 10 * s, '#fff'); _cnT(g, '−', cx - 8 * s, cy, 9 * s, '#111'); _cnT(g, '+', cx + 8 * s, cy, 9 * s, '#111');
  _cnT(g, 'MHz', cx, cy - 36 * s, 7 * s, '#aaa', false); _cnT(g, r.nav ? '50k' : '25k', cx, cy + 22 * s, 6 * s, '#222', false);
  _cnHit(cx - 30 * s, cy - 30 * s, 14 * s, 60 * s, () => rtuKnob(k, true, -1)); _cnHit(cx + 16 * s, cy - 30 * s, 14 * s, 60 * s, () => rtuKnob(k, true, 1));
  _cnHit(cx - 16 * s, cy - 16 * s, 16 * s, 32 * s, () => rtuKnob(k, false, -1)); _cnHit(cx, cy - 16 * s, 16 * s, 32 * s, () => rtuKnob(k, false, 1));
}
// RTU · ACU 쪽(1000×640)
function cnRtuPage(g) {
  g.fillStyle = CNP_BG; g.fillRect(0, 0, 1000, 640);
  _cnT(g, 'RADIO TUNING UNITS · AUDIO CONTROL', 500, 18, 14, '#111');
  [['nav1', 20, 36], ['nav2', 510, 36], ['com1', 20, 250], ['com2', 510, 250]].forEach(([k, x, y]) => cnRtuDraw(g, x, y, 470, 200, k));
  _cnBlackPanel(g, 20, 466, 960, 160, 'ACU — TRANSMIT SELECTOR');
  Object.entries(CN_TX).forEach(([t, lab], i) => {
    const bx = 50 + i * 130; _cnBtn(g, bx, 500, 110, 40, t, cn.acu.tx === t, 14); _cnT(g, lab, bx + 55, 556, 11, '#9fd', false);
    _cnHit(bx, 500, 110, 40, () => { cn.acu.tx = t; });
  });
  let tx = false; try { tx = typeof kuhTxOn === 'function' && kuhTxOn(); } catch (e) { _swallow(e); }
  _cnLamp(g, 50, 580, 120, 26, tx ? 'TX · SPKR MUTE' : 'RX', tx, '#28e04a', 11);
  _cnT(g, 'PTT(조종간 · V 키) — 고른 무전기로 송신 · 그동안 조종석 스피커 묵음(되먹임 방지)', 560, 594, 11, '#ddd', false);
}

// ══ FMS(Universal) ══
cn.fms = { on: true, init: 0, page: 'NAV', sub: 0, sp: '', msgs: [], turn: 'AUTO', vnav: false, dim: 1, pendDir: 0,
           pat: { type: 0, sp: 2, len: 8, n: 6, trk: null, datum: 'PPOS' } };
cn.ov.fmsSel = 'CKPT';
const CN_PATS = ['RISING LADDER', 'EXP SQUARE', 'RACE TRACK', 'SECTOR', 'ORBIT', 'BORDER PATROL'];
function cnFmsOk() { return cnElecOn() && cnCbOk('FMS') && cn.fms.on; }
function _fmsMsg(t) { cn.fms.msgs.unshift(t); cn.fms.msgs = cn.fms.msgs.slice(0, 8); }
function _fmsCand(id) { id = String(id || '').toUpperCase(); try { return fpRefCandidates().find(c => c.ident === id) || null; } catch (e) { return null; } }
function _fmsRefresh() { try { updateWpMarkers(); fpRender(); updateNav(); _fplPersist(); } catch (e) { _swallow(e); } }
// 곧장(DTO) — 비행계획 i 번째로, 또는 새 지점을 TO 자리에 넣고 · 선회 방향이 정해져 있으면 그쪽으로 돌아 NAV
function fmsDirect(target) {
  let i = typeof target === 'number' ? target : S.wps.findIndex(w => w && w.ident === String(target).toUpperCase());
  if (i < 0) {
    const c = _fmsCand(target); if (!c) { cn.fms.sp = 'NOT IN DATA BASE'; return false; }
    i = Math.max(0, S.awp);
    S.wps.splice(i, 0, { ident: c.ident, lat: c.lat, lon: c.lon });
  }
  const wp = S.wps[i]; if (!wp) return false;
  delete wp.inCrs; S.awp = i; S.fwp = -1; S.dtoLive = true;
  try { if (!obsOn) S.crs = bearing(S.lat, S.lon, wp.lat, wp.lon); if (holdOn) holdExit(); } catch (e) { _swallow(e); }
  try { navSrc = 'FMS'; } catch (e) { _swallow(e); }
  _fmsRefresh();
  // 선회 방향 — LEFT/RIGHT 면 HDG 로 그쪽으로 돌다가 30° 안에 들면 NAV(롤 스티어링)
  const brg = bearing(S.lat, S.lon, wp.lat, wp.lon);
  if (cn.fms.turn !== 'AUTO') {
    try { if (navApOn) toggleNavAp(); selHdg = ((Math.round(toMag(brg)) + 359) % 360) + 1; hdgSelOn = true; rollApOn = true; hdgTurnDir = cn.fms.turn === 'LEFT' ? -1 : 1; cn.fms.pendDir = 1; } catch (e) { _swallow(e); }
  } else { try { if (!navApOn) toggleNavAp(); } catch (e) { _swallow(e); } }
  _fmsMsg(`DTO ${wp.ident || 'WPT'} ${cn.fms.turn}`);
  return true;
}
// 수색 패턴(MMMS) — 기준점(PPOS · 식별부호)에서 지점들을 만들어 비행계획으로
function fmsPattern() {
  const P = cn.fms.pat, nm = 1852;
  let d0 = { lat: S.lat, lon: S.lon };
  if (P.datum !== 'PPOS') { const c = _fmsCand(P.datum); if (c) d0 = c; }
  const trk = Number.isFinite(P.trk) ? P.trk : S.hdg;
  const at = (p, brg, dist) => { const b = brg * D2R; const [la, lo] = _sarOff ? _sarOff(p.lat, p.lon, Math.cos(b) * dist * nm, Math.sin(b) * dist * nm) : [p.lat, p.lon]; return { lat: la, lon: lo }; };
  const pts = [], S2 = P.sp, L = P.len, n = Math.max(2, P.n);
  const t = CN_PATS[P.type];
  if (t === 'RISING LADDER') { let p = d0; for (let i = 0; i < n; i++) { const q = at(p, i % 2 ? trk + 180 : trk, L); pts.push(q); p = at(q, trk + 90, S2); if (i < n - 1) pts.push(p); } }
  else if (t === 'EXP SQUARE') { let p = d0; pts.push(p); for (let i = 0; i < n * 2; i++) { p = at(p, trk + 90 * i, S2 * (Math.floor(i / 2) + 1)); pts.push(p); } }
  else if (t === 'RACE TRACK') { const a = d0, b = at(a, trk, L), c = at(b, trk + 90, S2), d = at(a, trk + 90, S2); for (let i = 0; i < Math.ceil(n / 2); i++) pts.push(a, b, c, d); }
  else if (t === 'SECTOR') { [0, 60, 120, 180, 240, 300].forEach((o, i) => { pts.push(at(d0, trk + o, L)); if (i % 2) pts.push(d0); }); }
  else if (t === 'ORBIT') { for (let i = 0; i <= 12; i++) pts.push(at(d0, trk + i * 30, S2)); }
  else { const B = at(d0, trk, L), A = at(d0, trk + 90, S2), B2 = at(A, trk, L); for (let i = 0; i < n; i++) pts.push(i % 2 ? A : B, i % 2 ? d0 : B2); }   // 국경 순찰 — 선을 따라 오가며 한쪽으로 비켜 돈다
  S.wps = pts.map((p, i) => ({ ident: `SP${String(i + 1).padStart(2, '0')}`, lat: p.lat, lon: p.lon, phase: 'SAR' }));
  S.awp = 0; S.fwp = -1; S.dtoLive = true;
  try { navSrc = 'FMS'; S.crs = bearing(S.lat, S.lon, S.wps[0].lat, S.wps[0].lon); } catch (e) { _swallow(e); }
  _fmsRefresh();
  try { if (cn.ap && !navApOn) toggleNavAp(); } catch (e) { _swallow(e); }
  _fmsMsg(`SEARCH ${t} ${S.wps.length} WPT`);
  return S.wps.length;
}
// 한 걸음 — 자가진단 · 선회 방향 DTO 의 NAV 넘김 · VNAV · FMS 고장(전원 · 차단기)
function cnFmsStep(dt) {
  const f = cn.fms;
  if (f.init > 0) f.init = Math.max(0, f.init - dt);
  if (!cnFmsOk() && typeof navApOn !== 'undefined' && navApOn && navSrc === 'FMS') { try { toggleNavAp(); _fmsMsg('FMS FAIL — NAV 풀림'); } catch (e) { _swallow(e); } }
  if (f.pendDir && S.awp >= 0 && S.wps[S.awp]) {
    const b = bearing(S.lat, S.lon, S.wps[S.awp].lat, S.wps[S.awp].lon);
    if (Math.abs(normAS(b - S.hdg)) < 30) { f.pendDir = 0; try { hdgTurnDir = 0; if (!navApOn) toggleNavAp(); } catch (e) { _swallow(e); } }
  }
  if (f.vnav && S.awp >= 0) {
    const wp = S.wps[S.awp];
    if (!wp || !Number.isFinite(wp.alt)) f.vnav = false;
    else {
      const req = _fmsVsReq(wp);
      try {
        if (Math.abs(S.alt - wp.alt) < 80) { f.vnav = false; if (!altHoldOn) { selAlt = Math.round(wp.alt); toggleAltHold(); } _fmsMsg(`VNAV ALT ${Math.round(wp.alt)}`); }
        else { if (altHoldOn) toggleAltHold(); vsModeOn = true; selVS = Math.round(req / 50) * 50; }
      } catch (e) { _swallow(e); }
    }
  }
}
function _fmsVsReq(wp) {
  let gs = 150; try { gs = Math.max(60, groundSpdKt()); } catch (e) { _swallow(e); }
  const d = distance(S.lat, S.lon, wp.lat, wp.lon), min = Math.max(0.5, d / gs * 60);
  return Math.max(-2500, Math.min(2000, (wp.alt - S.alt) / min));
}

// ── 쪽들 — { title, rows: [[왼쪽, 오른쪽, 색] × 10], L: [fn × 5], R: [fn × 5] } ──
const _f3 = v => String(Math.round(((v % 360) + 360) % 360) || 360).padStart(3, '0');
function _fmsPage() {
  const f = cn.fms, sp = f.sp.trim(), take = () => { const v = f.sp.trim(); f.sp = ''; return v; };
  const wp = S.awp >= 0 ? S.wps[S.awp] : null, fr = S.awp > 0 ? S.wps[S.awp - 1] : null;
  let gs = 0; try { gs = groundSpdKt(); } catch (e) { _swallow(e); }
  const d = wp ? distance(S.lat, S.lon, wp.lat, wp.lon) : 0, ete = gs > 30 ? d / gs * 60 : 0;
  const E = () => ['', '', ''];
  const P = { title: '', rows: Array.from({ length: 10 }, E), L: [], R: [] };
  const set = (i, l, r, c) => { P.rows[i] = [l || '', r || '', c || '']; };
  if (f.page === 'NAV' && f.sub === 0) {
    P.title = 'NAV 1/2';
    set(0, 'FR', 'TO', 'c'); set(1, fr ? fr.ident : 'PPOS', wp ? `${wp.ident} ${d.toFixed(1)}NM` : '----');
    let xtk = 0, dtk = 0; try { xtk = courseXtk(activeCourseLine()); dtk = toMag(activeCrs()); } catch (e) { _swallow(e); }
    set(2, 'DTK   TKE', 'XTK', 'c'); set(3, `${_f3(dtk)}°  ${Math.round(Math.abs(normAS((typeof toMag === 'function' ? toMag(S.hdg) : S.hdg) - dtk)))}°`, `${Math.abs(xtk).toFixed(2)}${xtk < 0 ? 'L' : 'R'}`);
    set(4, 'GS    ETE', 'CMD HDG', 'c'); set(5, `${Math.round(gs)}  ${Math.floor(ete / 60)}+${String(Math.round(ete % 60)).padStart(2, '0')}`, hdgSelOn ? `${_f3(toMag(selHdg))}° HDG SEL` : 'HDG>');
    set(6, 'NAV MODE', 'VNAV', 'c'); set(7, navApOn ? (navSrc === 'FMS' ? 'FMS ROLL STEER' : navSrc) : 'NAV OFF', `${f.vnav ? 'ON' : 'OFF'}>`);
    set(8, 'TURN', 'DTO', 'c'); set(9, f.turn, 'DTO>');
    P.R[2] = () => { f.page = 'HDG'; }; P.R[3] = () => { f.page = 'VNAV'; }; P.R[4] = () => { f.page = 'DTO'; };
    P.L[4] = () => { f.turn = { AUTO: 'LEFT', LEFT: 'RIGHT', RIGHT: 'AUTO' }[f.turn]; };
  } else if (f.page === 'NAV') {
    P.title = 'NAV 2/2 · BCP';
    set(0, 'SENSORS', 'STATUS', 'c'); set(1, 'GPS/WAAS', 'NAV'); set(2, 'INS H764', 'NAV'); set(3, 'ADC C-32', cnCbOk('ADC') ? 'NAV' : 'FAIL');
    let vor = '----'; try { vor = navRadios.NAV1.id || '----'; } catch (e) { _swallow(e); }
    set(4, `VOR ${vor}`, 'NAV'); set(5, 'DME-42', 'NAV');
    let r = 2; try { r = rnp; } catch (e) { _swallow(e); }
    set(6, 'ANP   RNP', 'BCP', 'c'); set(7, `0.05  ${(+r).toFixed(2)}`, 'GPS+INS');
    set(8, 'POS', '', 'c'); set(9, (typeof sarFmtDdm === 'function' ? sarFmtDdm(S.lat, S.lon) : `${S.lat.toFixed(4)} ${S.lon.toFixed(4)}`).slice(0, 26), '');
  } else if (f.page === 'DTO') {
    P.title = 'DIRECT TO';
    const list = S.wps.map((w, i) => ({ w, i })).filter(x => x.i >= Math.max(0, S.awp)).slice(0, 4);
    list.forEach((x, j) => { set(j * 2, j ? '' : 'FPL', '', 'c'); set(j * 2 + 1, `<${x.w.ident || 'WPT'}`, `${distance(S.lat, S.lon, x.w.lat, x.w.lon).toFixed(1)}NM`); P.L[j] = () => fmsDirect(x.i); });
    set(8, 'TURN / DIVERT', '[ ] DTO', 'c'); set(9, `<${f.turn}`, sp ? `${sp}>` : 'DIVERT>');
    P.L[4] = () => { f.turn = { AUTO: 'LEFT', LEFT: 'RIGHT', RIGHT: 'AUTO' }[f.turn]; };
    P.R[4] = () => { if (sp) fmsDirect(take()); else f.page = 'DIVERT'; };
    P.R[0] = () => { if (sp) fmsDirect(take()); };
    set(0, list.length ? 'FPL' : 'FPL EMPTY', sp ? `${sp}>` : 'IDENT>', 'c');
  } else if (f.page === 'DIVERT') {
    P.title = 'DIVERT — NEAREST APT';
    let A = []; try { A = AIRPORTS.map(a => ({ a, d: distance(S.lat, S.lon, a.lat, a.lon) })).sort((p, q) => p.d - q.d).slice(0, 5); } catch (e) { _swallow(e); }
    A.forEach((x, j) => { set(j * 2, j ? '' : 'AIRPORT', j ? '' : 'DIST', 'c'); set(j * 2 + 1, `<${x.a.ident}`, `${x.d.toFixed(0)}NM`); P.L[j] = () => { fmsDirect(x.a.ident); f.page = 'NAV'; f.sub = 0; }; });
  } else if (f.page === 'FPL') {
    P.title = `FPL ${f.sub + 1}`;
    const s0 = f.sub * 5;
    for (let j = 0; j < 5; j++) {
      const i = s0 + j, w = S.wps[i];
      if (!w) { set(j * 2 + 1, j === 0 && !S.wps.length ? '*END OF PLAN*' : '', ''); P.L[j] = () => { const v = take(); const c = _fmsCand(v); if (c) { S.wps.push({ ident: c.ident, lat: c.lat, lon: c.lon }); if (S.awp < 0) S.awp = 0; _fmsRefresh(); } }; break; }
      const prev = i > 0 ? S.wps[i - 1] : null;
      set(j * 2, prev ? `${_f3(toMag(bearing(prev.lat, prev.lon, w.lat, w.lon)))}° ${distance(prev.lat, prev.lon, w.lat, w.lon).toFixed(1)}NM` : '', Number.isFinite(w.alt) ? `${Math.round(w.alt)}FT` : '', 'c');
      set(j * 2 + 1, `${i === S.awp ? '>' : ' '}${w.ident || 'WPT'}`, i === S.awp ? 'ACTV' : '', i === S.awp ? 'm' : '');
      P.L[j] = () => { const v = take(); if (!v) f.sp = w.ident || ''; else if (v === 'DEL') { try { removeWP(i); } catch (e) { _swallow(e); } } else { const c = _fmsCand(v); if (c) { S.wps.splice(i, 0, { ident: c.ident, lat: c.lat, lon: c.lon }); if (S.awp >= i) S.awp++; _fmsRefresh(); } else f.sp = 'NOT IN DATA BASE'; } };
      P.R[j] = () => { const v = take(); const n = parseInt(v, 10); if (Number.isFinite(n)) { w.alt = n; _fmsRefresh(); } };
    }
  } else if (f.page === 'HDG') {
    P.title = 'CMD HDG';
    set(0, 'CMD HDG', 'INTERCEPT', 'c'); set(1, `${hdgSelOn ? _f3(toMag(selHdg)) + '°' : '---'}`, navApOn ? 'NAV CPL' : 'ARM>');
    set(2, 'TURN L/R xx°', '', 'c'); set(3, '<L90 · R45 …', '');
    set(8, '', 'CNCL HDG', 'c'); set(9, '', 'CNCL>');
    P.L[0] = () => { const n = parseInt(take(), 10); if (Number.isFinite(n)) { try { selHdg = toTrue(Math.max(1, Math.min(360, n))) || 360; hdgTurnDir = 0; hdgSelOn = true; rollApOn = true; if (navApOn) toggleNavAp(); } catch (e) { _swallow(e); } } };
    P.L[1] = () => { const m = /^([LR])(\d{1,3})$/.exec(take()); if (m) { const n = +m[2] * (m[1] === 'L' ? -1 : 1); try { selHdg = ((Math.round(hdgInd() + n) + 359) % 360) + 1; hdgTurnDir = Math.sign(n); hdgSelOn = true; rollApOn = true; if (navApOn) toggleNavAp(); } catch (e) { _swallow(e); } } };
    P.R[0] = () => { try { if (!navApOn) toggleNavAp(); } catch (e) { _swallow(e); } };
    P.R[4] = () => { try { hdgRelease(); if (S.awp >= 0 && !navApOn) toggleNavAp(); } catch (e) { _swallow(e); } };
  } else if (f.page === 'VNAV') {
    P.title = 'VNAV';
    const req = wp && Number.isFinite(wp.alt) ? _fmsVsReq(wp) : null;
    set(0, 'TO WPT   ALT', 'VNAV', 'c'); set(1, wp ? `${wp.ident} ${Number.isFinite(wp.alt) ? Math.round(wp.alt) : '-----'}` : '----', `${f.vnav ? 'ON' : 'OFF'}>`);
    set(2, 'VS REQ', 'VDEV', 'c'); set(3, req != null ? `${Math.round(req)} FPM` : '----', wp && Number.isFinite(wp.alt) ? `${Math.round(S.alt - wp.alt)} FT` : '');
    set(4, 'DIST', '', 'c'); set(5, wp ? `${d.toFixed(1)} NM` : '', '');
    P.L[0] = () => { const n = parseInt(take(), 10); if (wp && Number.isFinite(n)) { wp.alt = n; _fmsRefresh(); } };
    P.R[0] = () => { f.vnav = !f.vnav && !!wp && Number.isFinite(wp.alt); if (!f.vnav) { try { vsModeOn = false; } catch (e) { _swallow(e); } } };
  } else if (f.page === 'MENU') {
    P.title = 'MENU';
    [['SEARCH PATTERN', 'SEARCH'], ['TUNE', 'TUNE'], ['DATA', 'DATA'], ['PERF', 'PERF'], ['FUEL', 'FUEL']].forEach(([t, pg], j) => { set(j * 2 + 1, `<${t}`, ''); P.L[j] = () => { f.page = pg; f.sub = 0; }; });
  } else if (f.page === 'SEARCH') {
    const p = f.pat;
    P.title = 'SEARCH PATTERN (MMMS)';
    set(0, 'PATTERN', 'DATUM', 'c'); set(1, `<${CN_PATS[p.type]}`, `${p.datum}>`);
    set(2, 'SPACING / RADIUS', 'TRACK', 'c'); set(3, `<${p.sp} NM`, `${Number.isFinite(p.trk) ? _f3(toMag(p.trk)) + '°' : 'HDG'}>`);
    set(4, 'LEG', '', 'c'); set(5, `<${p.len} NM`, '');
    set(6, 'LEGS / TURNS', '', 'c'); set(7, `<${p.n}`, '');
    set(8, '', 'ACTIVATE', 'c'); set(9, '', 'ACTV>');
    P.L[0] = () => { p.type = (p.type + 1) % CN_PATS.length; };
    P.L[1] = () => { const v = parseFloat(take()); if (v > 0) p.sp = v; };
    P.L[2] = () => { const v = parseFloat(take()); if (v > 0) p.len = v; };
    P.L[3] = () => { const v = parseInt(take(), 10); if (v > 1) p.n = Math.min(20, v); };
    P.R[0] = () => { const v = take(); p.datum = v && _fmsCand(v) ? v.toUpperCase() : 'PPOS'; };
    P.R[1] = () => { const v = parseInt(take(), 10); p.trk = Number.isFinite(v) ? toTrue(v) : null; };
    P.R[4] = () => { fmsPattern(); f.page = 'FPL'; f.sub = 0; };
  } else if (f.page === 'TUNE') {
    P.title = 'TUNE';
    ['com1', 'com2', 'nav1', 'nav2'].forEach((k, j) => { const r = cn.rtu[k]; set(j * 2, k.toUpperCase(), 'PRESET', 'c'); set(j * 2 + 1, rtuFmt(r, r.act), `${rtuFmt(r, r.pre)}`);
      P.L[j] = () => { const v = parseFloat(take()); if (v > 100) { r.pre = _rtuClamp(r, v); rtuXfr(k); } }; P.R[j] = () => { const v = parseFloat(take()); if (v > 100) r.pre = _rtuClamp(r, v); else rtuXfr(k); }; });
    set(8, 'TX', '', 'c'); set(9, `${cn.acu.tx} ${CN_TX[cn.acu.tx]}`, '');
  } else if (f.page === 'DATA') {
    P.title = 'DATA';
    set(0, 'NAV DATA BASE', 'SSDTU', 'c'); set(1, 'KOR 2611 · 28NOV', 'LOADED');
    set(2, 'CDU CONTROL', '', 'c'); set(3, cn.ov.fmsSel, '');
    set(4, 'SW', '', 'c'); set(5, 'UNS-1 NCU 1000.6', '');
    set(8, '', 'FMS PWR', 'c'); set(9, '', 'OFF>');
    P.R[4] = () => { f.on = false; };
  } else if (f.page === 'PERF' || f.page === 'FUEL') {
    P.title = f.page;
    const ff = (cn.eng[0].ff + cn.eng[1].ff) * 2.2046, fuel = cn.fuelKg * 2.2046, last = S.wps[S.wps.length - 1];
    const dd = last ? distance(S.lat, S.lon, last.lat, last.lon) : 0, t = gs > 30 ? dd / gs : 0;
    set(0, 'GW LB', 'FUEL LB', 'c'); set(1, String(Math.round(cnMassKg() * 2.2046)), String(Math.round(fuel)));
    set(2, 'FF PPH', 'ENDUR', 'c'); set(3, String(Math.round(ff)), ff > 0 ? `${Math.floor(fuel / ff)}+${String(Math.round(fuel / ff * 60 % 60)).padStart(2, '0')}` : '--');
    set(4, 'DEST', 'FUEL AT DEST', 'c'); set(5, last ? `${last.ident} ${dd.toFixed(0)}NM` : '----', last ? String(Math.round(fuel - ff * t)) : '');
    set(6, 'TAS', 'GS', 'c'); set(7, String(Math.round((S.spd || 0) * (typeof tasRatio === 'function' ? tasRatio() : 1))), String(Math.round(gs)));
  } else if (f.page === 'LIST') {
    P.title = 'LIST — NEAREST';
    let A = []; try { A = fpRefCandidates().filter(c => c.cat !== 'FPL').map(c => ({ c, d: distance(S.lat, S.lon, c.lat, c.lon) })).sort((p, q) => p.d - q.d).slice(0, 5); } catch (e) { _swallow(e); }
    A.forEach((x, j) => { set(j * 2, x.c.cat, '', 'c'); set(j * 2 + 1, `<${x.c.ident}`, `${x.d.toFixed(1)}NM`); P.L[j] = () => { f.sp = x.c.ident; }; });
  } else if (f.page === 'MSG') {
    P.title = 'MESSAGES';
    (f.msgs.length ? f.msgs : ['NO MESSAGES']).slice(0, 10).forEach((m, j) => set(j, m, ''));
  }
  return P;
}
function fmsKey(k) {
  const f = cn.fms;
  if (k === 'PWR') { if (!f.on) { f.on = true; f.init = 5; f.page = 'NAV'; f.sub = 0; _fmsMsg('SELF TEST PASS · BCP VALID'); } else f.dim = f.dim > 0.5 ? 0.45 : 1; return; }
  if (!cnFmsOk() || f.init > 0) return;
  if (cn.ov.fmsSel === 'TACCO') { f.sp = 'TACCO HAS CONTROL'; return; }
  if (/^[A-Z0-9]$/.test(k)) { if (f.sp.length >= 20 || /NOT IN|TACCO/.test(f.sp)) f.sp = ''; f.sp += k; return; }
  if (k === 'BACK') { f.sp = f.sp.slice(0, -1); return; }
  if (k === '±') { f.sp = f.sp.startsWith('-') ? f.sp.slice(1) : '-' + f.sp; return; }
  if (k === 'ENTER') return;
  if (k === 'NEXT' || k === 'PREV') { const d = k === 'NEXT' ? 1 : -1; if (f.page === 'NAV') f.sub = (f.sub + 2 + d) % 2; else if (f.page === 'FPL') f.sub = Math.max(0, Math.min(Math.floor(S.wps.length / 5), f.sub + d)); return; }
  const map = { NAV: 'NAV', DTO: 'DTO', FPL: 'FPL', VNAV: 'VNAV', LIST: 'LIST', MENU: 'MENU', PERF: 'PERF', MSG: 'MSG', DATA: 'DATA', FUEL: 'FUEL', TUNE: 'TUNE' };
  if (map[k]) { f.page = map[k]; f.sub = 0; }
}
function fmsLsk(side, i) {
  if (!cnFmsOk() || cn.fms.init > 0 || cn.ov.fmsSel === 'TACCO') return;
  const P = _fmsPage(), fn = (side === 'L' ? P.L : P.R)[i];
  if (fn) try { fn(); } catch (e) { _swallow(e); }
}
// ── CDU 그리기(700×960 — 그림 1-1-10 의 UNIVERSAL CDU) ──
function cnFmsDraw(g) {
  const W = 700, H = 960, f = cn.fms;
  g.fillStyle = '#1c1f22'; g.fillRect(0, 0, W, H);
  _cnBlackPanel(g, 10, 10, W - 20, H - 20, null); _cnT(g, 'UNIVERSAL', W / 2, 30, 14, '#eee');
  const sx = 110, sy = 50, sw = 480, sh = 400;
  g.save(); g.fillStyle = '#020403'; g.fillRect(sx, sy, sw, sh); g.restore();
  const ok = cnFmsOk(), row = i => sy + 46 + i * 33;
  g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip(); g.globalAlpha = f.dim;
  const T = (s, x, y, col, al) => { g.font = 'bold 21px "Courier New", monospace'; g.fillStyle = col; g.textAlign = al || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  if (!ok) { T(cnElecOn() ? (f.on ? 'FMS FAIL' : '') : '', sx + sw / 2, sy + sh / 2, '#ff4a3a', 'center'); }
  else if (f.init > 0) {
    T('UNS-1 SELF TEST', sx + 20, row(0), '#3cff6a');
    ['GPS/WAAS', 'INS H764-GU', 'ADC C-32', 'VIR-32', 'DME-42'].forEach((s, i) => T(`${s.padEnd(14, '.')}${5 - f.init > i ? 'OK' : '..'}`, sx + 20, row(1 + i), '#fff'));
    T(f.init < 1 ? 'BCP VALID  ANP 0.05' : 'BCP INIT ...', sx + 20, row(7), '#3cf');
  } else if (cn.ov.fmsSel === 'TACCO') { T('TACCO HAS CONTROL', sx + sw / 2, sy + sh / 2, '#ffd21a', 'center'); }
  else {
    const P = _fmsPage();
    T(P.title, sx + sw / 2, sy + 20, '#3cf', 'center');
    P.rows.forEach(([l, r, c], i) => {
      const col = c === 'c' ? '#3cf' : c === 'm' ? '#ff5cd6' : '#fff', fs = c === 'c' ? 15 : 21;
      g.font = `bold ${fs}px "Courier New", monospace`;
      if (l) { g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(l, sx + 12, row(i) - (c === 'c' ? 6 : 0)); }
      if (r) { g.fillStyle = col; g.textAlign = 'right'; g.fillText(r, sx + sw - 12, row(i) - (c === 'c' ? 6 : 0)); }
    });
    g.strokeStyle = '#3cff6a'; g.lineWidth = 1; g.strokeRect(sx + 8, sy + sh - 34, sw - 16, 28);
    T(f.sp || '', sx + 16, sy + sh - 20, /NOT IN|TACCO|FAIL/.test(f.sp) ? '#ff4a3a' : '#3cff6a');
  }
  g.restore();
  // LSK 다섯 쌍 — 줄 2 · 4 · 6 · 8 · 10 에 맞춘다
  for (let i = 0; i < 5; i++) {
    const y = row(i * 2 + 1) - 12;
    _cnBtn(g, sx - 56, y, 42, 24, '—', false, 14); _cnHit(sx - 56, y, 42, 24, () => fmsLsk('L', i));
    _cnBtn(g, sx + sw + 14, y, 42, 24, '—', false, 14); _cnHit(sx + sw + 14, y, 42, 24, () => fmsLsk('R', i));
  }
  // 기능 키 — 왼쪽 MSG · DATA · FUEL · TUNE · PREV · NEXT · PWR/DIM · 오른쪽 NAV · DTO · FPL · VNAV · LIST · MENU · PERF
  const keyB = (x, y, w, h, t, k, on) => { _cnBtn(g, x, y, w, h, t, !!on, 13); _cnHit(x, y, w, h, () => fmsKey(k)); };
  ['MSG', 'DATA', 'FUEL', 'TUNE', 'PREV', 'NEXT', 'PWR'].forEach((k, i) => keyB(24, 470 + i * 40, 66, 32, k === 'PWR' ? 'PWR/DIM' : k, k, k === 'MSG' && f.msgs.length && ok));
  ['NAV', 'DTO', 'FPL', 'VNAV', 'LIST', 'MENU', 'PERF'].forEach((k, i) => keyB(W - 90, 470 + i * 40, 66, 32, k, k, f.page === k));
  // 영숫자 키
  const keys = 'ABCDEFG123HIJKLMN456OPQRSTU789VWXYZ'.split('').concat(['ENTER', 'BACK', '0', '±']);
  keys.forEach((k, i) => {
    let x, y, w = 40;
    if (i < 35) { const r = Math.floor(i / 10), c = i % 10; x = 106 + c * 49; y = 470 + r * 46; if (r === 3) { x = 106 + c * 49; } }
    else { const j = i - 35; x = [106 + 5 * 49, 106 + 7 * 49 - 10, 106 + 8 * 49, 106 + 9 * 49][j]; y = 470 + 3 * 46; w = j === 0 ? 88 : j === 1 ? 46 : 40; }
    keyB(x, y, w, 38, k, k);
  });
  _cnT(g, `CDU ${cn.ov.fmsSel} · ${ok ? 'ON' : 'OFF'} · TURN ${f.turn}${f.vnav ? ' · VNAV' : ''}`, W / 2, 700, 12, '#9fd', false);
  _cnT(g, '식별부호를 치고 LSK(—)를 누른다 · FPL 에서 DEL + LSK 는 지우기 · 오른쪽 LSK 는 고도', W / 2, 726, 11, '#8a96a0', false);
  _cnT(g, 'MENU → SEARCH PATTERN : RISING LADDER · EXP SQUARE · RACE TRACK · SECTOR · ORBIT · BORDER PATROL', W / 2, 748, 11, '#8a96a0', false);
}
if (CN_ON) {
  setInterval(() => { try { cnFmsStep(0.25); } catch (e) { _swallow(e); } }, 250);
}
