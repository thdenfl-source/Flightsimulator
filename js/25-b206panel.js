'use strict';
// ══════════════════════════════════════════════════════
// Bell 206B-3 아날로그 계기판 — 기종이 b206 일 때(00-aircraft.js) PFD 창 · Cockpit 모드 계기판 자리에 그린다.
// 배치는 실제 훈련 장치 사진을 따른다(5열):
//   1열 ENG OIL · XMSN OIL · FUEL QTY · LOAD/FUEL PSI   2열 TORQUE · TOT · N1 · 시계
//   3열 속도계 · 이중 회전계(ROTOR / POWER TURBINE) · RMI(ADF · NAV 2)   4열 자세계 · CDI(VOR) · 방향지시계(DG)
//   5열 고도계 · 승강계 · 선회경사계(2 MIN TURN)   위: 경고등(ENG OUT · RPM) · 주의등 줄 · 오른쪽 FUEL VALVE
// 그림 좌표는 1000×600(B206_W×B206_H) — 칸에 맞춰 줄이고 남는 곳은 판 색으로 채운다.
// 값은 다른 파일의 것을 '있으면' 읽는다(엔진 03-pfd.js engParams · 연료 18-system.js · 항법 03-pfd.js 와 같은 셈).
// 계기 한계(206B-3 RFM 기준, 연습용 근사): TQ 연속 85% · 이륙 100%(5분) / TOT 738°C 연속 · 810°C 한계 /
//   N1 105% / N2 97~100% / NR 90~107% / VNE 130 KIAS(해면)
// ══════════════════════════════════════════════════════
const B206_W = 1000, B206_H = 600;
const B206_LIM = {
  tqCont: 85, tqMax: 100,          // 토크(%)
  totCont: 738, totMax: 810,       // TOT(°C)
  n1Max: 105, n1Idle: 62,          // N1(%)
  n2Lo: 97, n2Hi: 100,             // N2(%)
  nrLo: 90, nrHi: 107,             // NR(%)
  vne: 130,                        // KIAS
  fuelCap: 91, fuelLow: 20,        // 갤런
};
// 비행 모델이 206 눈금(연속 85 · 한계 100 · 01-state.js B206P)으로 셈하므로 그대로 보인다
const B206_TQ_K = 1;

// ── 값 읽기 ──
function _b206Num(f, d) { try { const v = f(); return Number.isFinite(v) ? v : d; } catch (e) { return d; } }
function b206Vals() {
  let ep = null;
  try { if (typeof engParams === 'function') ep = engParams(); } catch (e) { /* 없으면 아래 기본 */ }
  const e1 = ep ? ep.e1 : { tq: 60, ng: 82, tgt: 620, np: 100 };
  const nr = ep ? ep.nr : 100;
  const tq = Math.max(0, e1.tq * B206_TQ_K);
  const run = e1.ng > 50;
  const n1 = e1.ng > 0 ? Math.min(108, e1.ng + (e1.tq > 0 ? 2 : 0)) : 0;
  const tot = e1.ng > 0 ? (run && e1.tq > 0 ? 400 + 3.6 * tq : 420) : 30;
  const gal = b206FuelGal();
  // 시동 중(27-b206coll.js 시동 절차)에는 그 N1 · TOT · N2
  const sv = (typeof b206cStartVals === 'function') ? b206cStartVals() : null;
  const on = e1.ng > 0 || !!(sv && sv.lit);
  if (sv) return Object.assign(_b206ValsRest(on, tq, nr, gal, sv.n1), { tq: 0, n1: sv.n1, tot: sv.tot, nr: Math.max(nr, sv.n2 * 0.95), n2: sv.n2, run: on && sv.n1 > 50 });
  return Object.assign(_b206ValsRest(on, tq, nr, gal, n1), {
    tq, n1, tot, nr, n2: e1.np, run: on });
}
function _b206ValsRest(on, tq, nr, gal, n1) {
  return {
    engOilP: on ? Math.min(130, 50 + n1 * 0.85) : 0, engOilT: on ? 72 + tq * 0.12 : 20,
    xmsnP: nr > 30 ? 30 + nr * 0.22 : nr * 0.5, xmsnT: 60 + tq * 0.18,
    gal, fuelP: on ? 12 : 0, load: on ? 32 : 0,
    ias: _b206Num(() => S.spd, 0), alt: _b206Num(() => S.alt, 0), vs: _b206Num(() => S.vs, 0),
    pit: _b206Num(() => S.pit, 0), bnk: _b206Num(() => S.bnk, 0),
    hdg: _b206Num(() => (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg), 0),
    hdgBug: _b206Num(() => selHdg, 0),
    slip: _b206Num(() => ((typeof gpsMode !== 'undefined' && gpsMode) ? 0 : slipBall) / (typeof SLIP_BALL_FS !== 'undefined' ? SLIP_BALL_FS : 8), 0),
    baro: _b206Num(() => (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa) ? window._qnhHpa : 1013.25) / 33.8639, 29.92),
  };
};
// ── 연료(91 갤런 · Jet-A) — 흰수리 연료 계통과 따로 셈한다 ──
// 흐름(gph) = IDLE 약 9 · 토크 1% 당 0.21 더(85% 에서 약 27gph) · 시동 중 점화되면 6. 20 갤런 아래 LOW FUEL, 0 이면 엔진이 멎는다.
// 처음엔 76 갤런. 계기판의 FUEL QTY 계기를 누르면 바꿀 수 있다(재급유).
const B206_FUEL = { start: 76, idleGph: 9, perTq: 0.21 };
let _b206Gal = B206_FUEL.start, _b206FuelT = 0;
function b206FuelGal() { return _b206Gal; }
function b206FuelSet(g) { _b206Gal = Math.max(0, Math.min(B206_LIM.fuelCap, +g || 0)); }
function b206FuelGph() {
  let ep = null; try { ep = engParams(); } catch (e) { /* 없으면 0 */ }
  const sv = (typeof b206cStartVals === 'function') ? b206cStartVals() : null;
  if (ep && ep.e1.ng > 0) return B206_FUEL.idleGph + B206_FUEL.perTq * Math.max(0, ep.e1.tq);
  return sv && sv.lit ? 6 : 0;
}
// 흐른 시간(s)만큼 태운다 — 멈춰 있으면(PAUSE) 그대로 · 배속이면 그만큼
function b206FuelStep(dt) { if (dt > 0) _b206Gal = Math.max(0, _b206Gal - b206FuelGph() * dt / 3600); }
// CDI — PFD HSI 와 같은 셈(03-pfd.js drawHSI): FMS 는 구간 옆 거리 / RNP, NAV 는 VOR 15° 가 끝. dev −1…1(+ 는 바늘 오른쪽)
function b206Cdi() {
  try {
    if (navSrc === 'FMS' && S.awp >= 0 && S.awp < S.wps.length) {
      const xtk = courseXtk(activeCourseLine());
      // 눈금 끝 — GNS 430 의 비행 단계 감도(ENR 2 · TERM 1 · APR 0.3NM · 26-b206radio.js gnsCdiScale)
      const fs = (typeof gnsCdiScale === 'function') ? gnsCdiScale().fs : rnp;
      return { ok: true, dev: Math.max(-1, Math.min(1, -xtk / fs)), crs: activeCrs(), to: true, src: 'GPS', fs };
    }
    if (navSrc !== 'FMS' && navLat !== null && navLon !== null) {
      const brgFrom = bearing(navLat, navLon, S.lat, S.lon);
      const d = normAS(brgFrom - normA(vorObsCrs + 180));
      return { ok: true, dev: Math.max(-1, Math.min(1, Math.sin(d * D2R) / Math.sin(15 * D2R))), crs: activeCrs(), to: Math.abs(d) < 90, src: navSrc };
    }
  } catch (e) { /* 항법이 없으면 깃발 */ }
  return { ok: false, dev: 0, crs: _b206Num(() => S.crs, 0), to: true, src: '' };
}
// RMI 바늘 — 지금 기수에서 잰 상대 방위(°)
//   가는 초록 바늘 = ADF(하부 콘솔 KR-87 의 USE 주파수 NDB — 26-b206radio.js b206AdfStation)
//   굵은 노랑 두 줄 바늘 = NAV 2(하부 콘솔 NAV 수신기가 잡은 VOR — 01-state.js navRadios.NAV2)
//   잡은 국이 없으면 그 바늘은 3시 방향에 눕는다(실기 RMI 처럼)
function b206RmiRel() {
  const rel = (lat, lon) => normAS(bearing(S.lat, S.lon, lat, lon) - S.hdg);
  const o = { adf: null, nav: null, adfId: '', navId: '' };
  try { const st = typeof b206AdfStation === 'function' ? b206AdfStation() : null; if (st) { o.adf = rel(st.lat, st.lon); o.adfId = st.id; } } catch (e) { /* 없음 */ }
  try { const r = navRadios.NAV2; if (r && r.lat != null && r.lon != null && !r.loc) { o.nav = rel(r.lat, r.lon); o.navId = r.id || ''; } } catch (e) { /* 없음 */ }
  return o;
}
// 선회율(°/s) — 헤딩이 바뀌는 빠르기를 매끄럽게
let _b206Turn = { h: null, t: 0, r: 0 };
function _b206TurnRate(hdg) {
  const now = performance.now();
  if (_b206Turn.h === null) { _b206Turn = { h: hdg, t: now, r: 0 }; return 0; }
  const dt = (now - _b206Turn.t) / 1000;
  if (dt > 0.05) {
    let d = hdg - _b206Turn.h; if (d > 180) d -= 360; if (d < -180) d += 360;
    const r = dt < 2 ? d / dt : 0;
    _b206Turn.r += (r - _b206Turn.r) * Math.min(1, dt * 2.5);
    _b206Turn.h = hdg; _b206Turn.t = now;
  }
  return _b206Turn.r;
}

// ── 그리기 도구 ──
const B206_FONT = 'Arial Narrow, Helvetica Neue, Arial, sans-serif';
const B206_COL = { panel: '#7f8a93', panelEdge: '#5d666e', face: '#0b0b0c', mark: '#f2f2ee', green: '#18c23a', yellow: '#f2c418', red: '#e8231c', needle: '#f6f6f0' };
const _rad = a => (a - 90) * Math.PI / 180;           // 12시가 0°, 시계 방향
function _pt(cx, cy, r, a) { return [cx + Math.cos(_rad(a)) * r, cy + Math.sin(_rad(a)) * r]; }
function _b206Case(g, cx, cy, R, square) {
  g.save();
  // 판에 박힌 나사 넷
  g.fillStyle = '#3a3f44';
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(cx + dx * R * 0.93, cy + dy * R * 0.93, R * 0.045, 0, 7); g.fill(); }
  if (square) { g.fillStyle = '#111'; g.fillRect(cx - R * 1.05, cy - R * 1.05, R * 2.1, R * 2.1); }
  const gr = g.createRadialGradient(cx, cy - R * 0.2, R * 0.6, cx, cy, R * 1.08);
  gr.addColorStop(0, '#2a2d30'); gr.addColorStop(1, '#050505');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 1.04, 0, 7); g.fill();
  g.fillStyle = B206_COL.face; g.beginPath(); g.arc(cx, cy, R * 0.94, 0, 7); g.fill();
  g.restore();
}
function _b206Arc(g, cx, cy, r, a0, a1, col, w) {
  g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt';
  g.beginPath(); g.arc(cx, cy, r, _rad(Math.min(a0, a1)), _rad(Math.max(a0, a1))); g.stroke(); g.restore();
}
function _b206Radial(g, cx, cy, r0, r1, a, col, w) {
  const [x0, y0] = _pt(cx, cy, r0, a), [x1, y1] = _pt(cx, cy, r1, a);
  g.save(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
}
function _b206Text(g, s, x, y, size, col, bold = true, align = 'center') {
  g.save(); g.fillStyle = col || B206_COL.mark; g.font = `${bold ? 'bold ' : ''}${size}px ${B206_FONT}`;
  g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); g.restore();
}
function _b206Needle(g, cx, cy, len, a, w = 4, col = B206_COL.needle, tail = 0.18) {
  g.save(); g.translate(cx, cy); g.rotate(a * Math.PI / 180);
  g.fillStyle = col;
  g.beginPath(); g.moveTo(-w / 2, len * tail); g.lineTo(-w / 2, -len * 0.82); g.lineTo(0, -len); g.lineTo(w / 2, -len * 0.82); g.lineTo(w / 2, len * tail); g.closePath(); g.fill();
  g.restore();
}
function _b206Hub(g, cx, cy, r) { g.save(); g.fillStyle = '#222'; g.strokeStyle = '#888'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke(); g.restore(); }
// 눈금 — 값 → 각 셈(map), 큰 눈금 간격(maj) · 작은 눈금(min) · 숫자(lab: 값 → 글자 | null)
function _b206Scale(g, cx, cy, R, map, lo, hi, maj, min, lab, fs) {
  for (let v = lo; v <= hi + 1e-6; v += min) {
    const big = Math.abs(v / maj - Math.round(v / maj)) < 1e-6;
    _b206Radial(g, cx, cy, R * (big ? 0.72 : 0.80), R * 0.90, map(v), B206_COL.mark, big ? 2.4 : 1.2);
    if (big && lab) { const s = lab(v); if (s != null) { const [x, y] = _pt(cx, cy, R * 0.56, map(v)); _b206Text(g, s, x, y, fs || R * 0.2, B206_COL.mark); } }
  }
}
const _cl = (v, a, b) => Math.max(a, Math.min(b, v));
const _lin = (v0, v1, a0, a1) => v => a0 + (_cl(v, Math.min(v0, v1), Math.max(v0, v1)) - v0) / (v1 - v0) * (a1 - a0);

// ── 계기마다 ──
// 1) 원형 한 바늘(TORQUE · TOT · FUEL 등) — 270° 쓸기
function b206RoundGauge(g, cx, cy, R, o) {
  _b206Case(g, cx, cy, R);
  const map = _lin(o.lo, o.hi, o.a0 != null ? o.a0 : -135, o.a1 != null ? o.a1 : 135);
  for (const b of (o.bands || [])) _b206Arc(g, cx, cy, R * 0.86, map(b[0]), map(b[1]), b[2], R * 0.09);
  for (const v of (o.redline || [])) _b206Radial(g, cx, cy, R * 0.70, R * 0.92, map(v), B206_COL.red, R * 0.06);
  _b206Scale(g, cx, cy, R, map, o.lo, o.hi, o.maj, o.min, o.lab, o.fs);
  (o.title || []).forEach((t, i) => _b206Text(g, t, cx, cy + R * (o.ty != null ? o.ty : 0.36) + i * R * 0.15, R * 0.13, B206_COL.mark));
  _b206Needle(g, cx, cy, R * 0.84, map(o.val), R * 0.07);
  _b206Hub(g, cx, cy, R * 0.08);
}
// 2) 겹 계기(ENG OIL · XMSN OIL · LOAD/FUEL PSI) — 왼쪽 반은 압력, 오른쪽 반은 온도. 두 바늘이 가운데서 갈라진다
function b206DualGauge(g, cx, cy, R, L, Rr, title) {
  _b206Case(g, cx, cy, R);
  const side = (s, a0, a1) => {
    const map = _lin(s.lo, s.hi, a0, a1);
    for (const b of (s.bands || [])) _b206Arc(g, cx, cy, R * 0.86, map(b[0]), map(b[1]), b[2], R * 0.09);
    for (const v of (s.redline || [])) _b206Radial(g, cx, cy, R * 0.70, R * 0.92, map(v), B206_COL.red, R * 0.06);
    _b206Scale(g, cx, cy, R, map, s.lo, s.hi, s.maj, s.min, s.lab, R * 0.16);
    return map;
  };
  const mL = side(L, 225, 315), mR = side(Rr, 135, 45);
  (title || []).forEach((t, i) => _b206Text(g, t, cx, cy - R * 0.30 + i * R * 0.15, R * 0.13, B206_COL.mark));
  _b206Text(g, L.unit || '', cx - R * 0.2, cy + R * 0.62, R * 0.12, B206_COL.mark);
  _b206Text(g, Rr.unit || '', cx + R * 0.2, cy + R * 0.62, R * 0.12, B206_COL.mark);
  _b206Needle(g, cx, cy, R * 0.82, mL(L.val), R * 0.065, B206_COL.needle, 0);
  _b206Needle(g, cx, cy, R * 0.82, mR(Rr.val), R * 0.065, B206_COL.needle, 0);
  _b206Hub(g, cx, cy, R * 0.09);
}
// 3) 속도계 — 20kt 가 12시, 시계 방향으로 150kt 까지(330°)
function b206Airspeed(g, cx, cy, R, ias) {
  _b206Case(g, cx, cy, R);
  const map = v => v <= 20 ? (v / 20) * 8 - 8 : (v - 20) / 130 * 322;
  _b206Arc(g, cx, cy, R * 0.86, map(20), map(B206_LIM.vne), B206_COL.green, R * 0.09);
  _b206Radial(g, cx, cy, R * 0.68, R * 0.93, map(B206_LIM.vne), B206_COL.red, R * 0.07);
  for (let v = 20; v <= 150; v += 5) {
    const big = v % 10 === 0;
    _b206Radial(g, cx, cy, R * (big ? 0.72 : 0.80), R * 0.90, map(v), B206_COL.mark, big ? 2.4 : 1.2);
    if (v % 20 === 0 || v === 150) { const [x, y] = _pt(cx, cy, R * 0.57, map(v)); _b206Text(g, String(v), x, y, R * 0.17); }
  }
  _b206Text(g, 'AIRSPEED', cx, cy - R * 0.22, R * 0.12);
  _b206Text(g, 'KNOTS', cx, cy + R * 0.26, R * 0.12);
  _b206Needle(g, cx, cy, R * 0.86, map(_cl(ias, 0, 160)), R * 0.065);
  _b206Hub(g, cx, cy, R * 0.08);
}
// 4) 자세계 — 하늘(밝은 청록) · 땅(적갈) 공이 피치 · 뱅크로 움직이고, 주황 비행기 표지는 고정
function b206Attitude(g, cx, cy, R, pit, bnk) {
  _b206Case(g, cx, cy, R);
  const r = R * 0.9;
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
  g.translate(cx, cy); g.rotate(-bnk * Math.PI / 180);
  const pp = r / 30;                                   // 피치 1° 의 픽셀
  const hy = _cl(pit, -28, 28) * pp;
  g.fillStyle = '#5fc4d8'; g.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 1.6 + hy);
  g.fillStyle = '#b8401f'; g.fillRect(-r * 1.6, hy, r * 3.2, r * 1.6);
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 1.6, hy); g.lineTo(r * 1.6, hy); g.stroke();
  g.lineWidth = 1.2;
  for (const p of [-20, -10, 10, 20]) {
    const y = hy - p * pp, w = r * (Math.abs(p) === 10 ? 0.22 : 0.32);
    g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke();
  }
  g.restore();
  // 뱅크 눈금(고정 · 위쪽) + 뱅크 지표(공과 함께 돈다)
  for (const a of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) _b206Radial(g, cx, cy, r * 0.84, r * (a % 30 === 0 ? 1.0 : 0.95), a, '#fff', a === 0 ? 3 : 1.8);
  g.save(); g.translate(cx, cy); g.rotate(-bnk * Math.PI / 180);
  g.fillStyle = '#ff8a1c'; g.beginPath(); g.moveTo(0, -r * 0.83); g.lineTo(-r * 0.07, -r * 0.70); g.lineTo(r * 0.07, -r * 0.70); g.closePath(); g.fill();
  g.restore();
  // 비행기 표지(주황) — 날개 · 가운데 점 · 아래 받침
  g.save(); g.strokeStyle = '#ff8a1c'; g.fillStyle = '#ff8a1c'; g.lineWidth = R * 0.06; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - r * 0.55, cy); g.lineTo(cx - r * 0.18, cy); g.lineTo(cx - r * 0.08, cy + r * 0.1); g.moveTo(cx + r * 0.55, cy); g.lineTo(cx + r * 0.18, cy); g.lineTo(cx + r * 0.08, cy + r * 0.1); g.stroke();
  g.beginPath(); g.arc(cx, cy, R * 0.05, 0, 7); g.fill();
  g.fillRect(cx - R * 0.03, cy + r * 0.12, R * 0.06, r * 0.65);
  g.restore();
}
// 5) 고도계 — 세 바늘(100 · 1,000 · 10,000ft) + 콜스만 창(inHg)
function b206Altimeter(g, cx, cy, R, alt, baro) {
  _b206Case(g, cx, cy, R);
  const map = v => v * 36;
  for (let v = 0; v < 10; v += 0.2) {
    const big = Math.abs(v - Math.round(v)) < 1e-6;
    _b206Radial(g, cx, cy, R * (big ? 0.72 : 0.82), R * 0.90, map(v), B206_COL.mark, big ? 2.6 : 1.2);
    if (big) { const [x, y] = _pt(cx, cy, R * 0.58, map(v)); _b206Text(g, String(Math.round(v)), x, y, R * 0.22); }
  }
  _b206Text(g, 'ALT', cx - R * 0.02, cy - R * 0.26, R * 0.14);
  // 콜스만 창
  g.save(); g.fillStyle = '#000'; g.strokeStyle = '#666'; g.fillRect(cx - R * 0.2, cy + R * 0.24, R * 0.4, R * 0.18); g.strokeRect(cx - R * 0.2, cy + R * 0.24, R * 0.4, R * 0.18); g.restore();
  _b206Text(g, baro.toFixed(2), cx, cy + R * 0.335, R * 0.13, '#fff');
  const a = Math.max(0, alt);
  // 10,000ft 바늘(가는 바늘 + 끝 삼각)
  g.save(); g.translate(cx, cy); g.rotate(map((a / 10000) % 10) * Math.PI / 180);
  g.fillStyle = B206_COL.needle; g.fillRect(-1, -R * 0.86, 2, R * 0.86);
  g.beginPath(); g.moveTo(0, -R * 0.9); g.lineTo(-R * 0.07, -R * 0.74); g.lineTo(R * 0.07, -R * 0.74); g.closePath(); g.fill(); g.restore();
  // 1,000ft 바늘(짧고 넓다)
  g.save(); g.translate(cx, cy); g.rotate(map((a / 1000) % 10) * Math.PI / 180);
  g.fillStyle = B206_COL.needle; g.beginPath(); g.moveTo(-R * 0.07, 0); g.lineTo(-R * 0.06, -R * 0.42); g.lineTo(0, -R * 0.52); g.lineTo(R * 0.06, -R * 0.42); g.lineTo(R * 0.07, 0); g.closePath(); g.fill(); g.restore();
  // 100ft 바늘(길다)
  _b206Needle(g, cx, cy, R * 0.86, map((a / 100) % 10), R * 0.06);
  _b206Hub(g, cx, cy, R * 0.08);
}
// 6) 이중 회전계 — 바깥 눈금 0~120%. 긴 바늘 T(POWER TURBINE · N2) · 짧은 바늘 R(ROTOR · NR)
function b206Tach(g, cx, cy, R, nr, n2) {
  _b206Case(g, cx, cy, R);
  const map = _lin(0, 120, -150, 150);
  _b206Arc(g, cx, cy, R * 0.88, map(B206_LIM.n2Lo), map(B206_LIM.n2Hi), B206_COL.green, R * 0.08);
  _b206Radial(g, cx, cy, R * 0.80, R * 0.94, map(B206_LIM.n2Lo), B206_COL.red, R * 0.05);
  _b206Arc(g, cx, cy, R * 0.88, map(B206_LIM.n2Hi), map(105), B206_COL.yellow, R * 0.08);   // 100~105% 잠깐(transient)
  _b206Radial(g, cx, cy, R * 0.80, R * 0.94, map(105), B206_COL.red, R * 0.05);
  _b206Arc(g, cx, cy, R * 0.66, map(B206_LIM.nrLo), map(B206_LIM.nrHi), B206_COL.green, R * 0.07);
  _b206Radial(g, cx, cy, R * 0.60, R * 0.72, map(B206_LIM.nrLo), B206_COL.red, R * 0.05);
  _b206Radial(g, cx, cy, R * 0.60, R * 0.72, map(B206_LIM.nrHi), B206_COL.red, R * 0.05);
  for (let v = 0; v <= 120; v += 5) {
    const big = v % 10 === 0;
    _b206Radial(g, cx, cy, R * (big ? 0.76 : 0.82), R * 0.90, map(v), B206_COL.mark, big ? 2.2 : 1.1);
    if (v % 20 === 0) { const [x, y] = _pt(cx, cy, R * 0.52, map(v)); _b206Text(g, String(v), x, y, R * 0.15); }
  }
  _b206Text(g, 'ROTOR', cx, cy - R * 0.2, R * 0.11);
  _b206Text(g, 'POWER TURBINE', cx, cy + R * 0.22, R * 0.09);
  _b206Text(g, 'PERCENT RPM', cx, cy + R * 0.34, R * 0.09);
  _b206Needle(g, cx, cy, R * 0.9, map(_cl(n2, 0, 125)), R * 0.06);
  _b206Needle(g, cx, cy, R * 0.66, map(_cl(nr, 0, 125)), R * 0.08, '#ffffff', 0.1);
  const [tx, ty] = _pt(cx, cy, R * 0.78, map(_cl(n2, 0, 125))); _b206Text(g, 'T', tx, ty, R * 0.1, '#000');
  const [rx, ry] = _pt(cx, cy, R * 0.52, map(_cl(nr, 0, 125))); _b206Text(g, 'R', rx, ry, R * 0.1, '#000');
  _b206Hub(g, cx, cy, R * 0.08);
}
// 7) N1(GAS PRODUCER) — 큰 바늘 0~110% · 작은 창 바늘이 1의 자리(0~10)
function b206N1(g, cx, cy, R, n1) {
  b206RoundGauge(g, cx, cy, R, {
    lo: 0, hi: 110, maj: 10, min: 2, lab: v => v % 20 === 0 ? String(v) : null, fs: R * 0.98 * 0.17,
    bands: [[B206_LIM.n1Idle, B206_LIM.n1Max, B206_COL.green]], redline: [B206_LIM.n1Max], val: _cl(n1, 0, 112),
    title: ['GAS PROD', '% RPM'], ty: -0.32,
  });
  const sx = cx, sy = cy + R * 0.46, sr = R * 0.2;
  g.save(); g.strokeStyle = '#888'; g.lineWidth = 1; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.stroke(); g.restore();
  for (let i = 0; i < 10; i++) _b206Radial(g, sx, sy, sr * 0.75, sr, i * 36, B206_COL.mark, 1);
  _b206Needle(g, sx, sy, sr * 0.9, (n1 % 10) * 36, R * 0.035, B206_COL.needle, 0);
}
// 8) 시계
function b206Clock(g, cx, cy, R) {
  _b206Case(g, cx, cy, R);
  const map = v => v * 30;
  for (let i = 0; i < 60; i++) _b206Radial(g, cx, cy, R * (i % 5 ? 0.82 : 0.72), R * 0.9, i * 6, B206_COL.mark, i % 5 ? 1 : 2.2);
  for (let h = 1; h <= 12; h++) { const [x, y] = _pt(cx, cy, R * 0.58, map(h)); _b206Text(g, String(h), x, y, R * 0.18); }
  const d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  _b206Needle(g, cx, cy, R * 0.5, map(h), R * 0.08);
  _b206Needle(g, cx, cy, R * 0.8, m * 6, R * 0.06);
  _b206Needle(g, cx, cy, R * 0.86, s * 6, R * 0.02, '#ff5a3a', 0.2);
  _b206Hub(g, cx, cy, R * 0.07);
}
// 9) 승강계 — 0 이 9시, 위로 오르면 시계 방향(+2,000 ft/min 까지), 내리면 반대
function b206Vsi(g, cx, cy, R, vs) {
  _b206Case(g, cx, cy, R);
  const map = v => -90 + _cl(v, -2000, 2000) / 2000 * 170;
  for (let v = -2000; v <= 2000; v += 100) {
    const big = v % 500 === 0;
    _b206Radial(g, cx, cy, R * (big ? 0.72 : 0.82), R * 0.9, map(v), B206_COL.mark, big ? 2.2 : 1);
    if (v % 1000 === 0 || v === 500 || v === -500) { const [x, y] = _pt(cx, cy, R * 0.55, map(v)); _b206Text(g, String(Math.abs(v) / 1000 === 0.5 ? '.5' : Math.abs(v) / 1000), x, y, R * 0.19); }
  }
  _b206Text(g, 'UP', cx - R * 0.3, cy - R * 0.14, R * 0.11);
  _b206Text(g, 'DN', cx - R * 0.3, cy + R * 0.16, R * 0.11);
  _b206Text(g, 'CLIMB', cx + R * 0.15, cy - R * 0.2, R * 0.13);
  _b206Text(g, '1000 FT/MIN', cx + R * 0.15, cy + R * 0.22, R * 0.1);
  _b206Needle(g, cx, cy, R * 0.86, map(vs), R * 0.07);
  _b206Hub(g, cx, cy, R * 0.08);
}
// 10) 선회경사계 — 표준 선회(3°/s)에 날개가 L · R 표에 닿는다 + 볼
function b206Turn(g, cx, cy, R, rate, slip) {
  _b206Case(g, cx, cy, R);
  for (const a of [-90 - 20, -90, 90, 90 + 20]) _b206Radial(g, cx, cy, R * 0.72, R * 0.88, a, '#fff', 3);
  _b206Text(g, 'L', cx - R * 0.6, cy + R * 0.32, R * 0.16); _b206Text(g, 'R', cx + R * 0.6, cy + R * 0.32, R * 0.16);
  _b206Text(g, '2 MIN TURN', cx, cy + R * 0.72, R * 0.1);
  g.save(); g.translate(cx, cy); g.rotate(_cl(rate / 3, -1.5, 1.5) * 20 * Math.PI / 180);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = R * 0.07; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-R * 0.62, 0); g.lineTo(R * 0.62, 0); g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.12, 0, 7); g.fill();
  g.beginPath(); g.moveTo(0, -R * 0.12); g.lineTo(0, -R * 0.3); g.stroke();
  g.restore();
  // 볼 관(아래로 휜 관)
  const by = cy + R * 0.42, bw = R * 0.5;
  g.save(); g.fillStyle = '#d8d0b0'; g.beginPath(); g.ellipse(cx, by, bw, R * 0.1, 0, 0, 7); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - R * 0.1, by - R * 0.1); g.lineTo(cx - R * 0.1, by + R * 0.1); g.moveTo(cx + R * 0.1, by - R * 0.1); g.lineTo(cx + R * 0.1, by + R * 0.1); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx + _cl(slip, -1, 1) * (bw - R * 0.09), by, R * 0.085, 0, 7); g.fill();
  g.restore();
}
// 나침반 카드 — 지금 헤딩이 위(카드가 돈다)
function _b206Card(g, cx, cy, r, hdg, fs) {
  g.save(); g.translate(cx, cy); g.rotate(-hdg * Math.PI / 180);
  for (let a = 0; a < 360; a += 5) {
    const big = a % 10 === 0;
    _b206Radial(g, 0, 0, r * (big ? 0.84 : 0.9), r, a, '#fff', big ? 2 : 1);
    if (a % 30 === 0) {
      const t = a === 0 ? 'N' : a === 90 ? 'E' : a === 180 ? 'S' : a === 270 ? 'W' : String(a / 10);
      g.save(); g.rotate(a * Math.PI / 180); _b206Text(g, t, 0, -r * 0.68, fs, a % 90 === 0 ? '#ffd23a' : '#fff'); g.restore();
    }
  }
  g.restore();
}
// 11) 방향지시계(DG) — 카드 · 위 기준선 · 비행기 · HDG 벅(주황)
function b206Dg(g, cx, cy, R, hdg, bug) {
  _b206Case(g, cx, cy, R);
  _b206Card(g, cx, cy, R * 0.88, hdg, R * 0.17);
  g.save(); g.translate(cx, cy); g.rotate((bug - hdg) * Math.PI / 180);
  g.fillStyle = '#ff8a1c'; g.fillRect(-R * 0.07, -R * 0.92, R * 0.14, R * 0.09); g.restore();
  g.save(); g.fillStyle = '#ff8a1c';
  g.beginPath(); g.moveTo(cx, cy - R * 0.9); g.lineTo(cx - R * 0.06, cy - R * 1.0); g.lineTo(cx + R * 0.06, cy - R * 1.0); g.closePath(); g.fill(); g.restore();
  g.save(); g.strokeStyle = '#fff'; g.lineWidth = R * 0.05; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy - R * 0.36); g.lineTo(cx, cy + R * 0.32); g.moveTo(cx - R * 0.3, cy - R * 0.02); g.lineTo(cx + R * 0.3, cy - R * 0.02); g.moveTo(cx - R * 0.12, cy + R * 0.28); g.lineTo(cx + R * 0.12, cy + R * 0.28); g.stroke(); g.restore();
}
// 12) CDI(VOR · GPS) — 네모 케이스 · OBS 카드(CRS 가 위) · 세로 바늘 · TO/FROM · 깃발
function b206CdiGauge(g, cx, cy, R, c) {
  _b206Case(g, cx, cy, R, true);
  _b206Card(g, cx, cy, R * 0.88, c.crs, R * 0.15);
  g.save(); g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(cx, cy - R * 0.92); g.lineTo(cx - R * 0.06, cy - R * 1.02); g.lineTo(cx + R * 0.06, cy - R * 1.02); g.closePath(); g.fill(); g.restore();
  for (let i = -5; i <= 5; i++) if (i) { g.save(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + i * R * 0.11, cy, R * 0.025, 0, 7); g.fill(); g.restore(); }
  g.save(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(cx - R * 0.04, cy - R * 0.04, R * 0.08, R * 0.08); g.restore();
  g.save(); g.strokeStyle = '#f0d000'; g.lineWidth = R * 0.05;
  const nx = cx + c.dev * R * 0.55;
  g.beginPath(); g.moveTo(nx, cy - R * 0.55); g.lineTo(nx, cy + R * 0.55); g.stroke(); g.restore();
  if (c.ok) _b206Text(g, c.to ? 'TO' : 'FR', cx + R * 0.3, cy - R * 0.28, R * 0.12, '#fff');
  else { g.save(); g.fillStyle = '#e8231c'; g.fillRect(cx - R * 0.45, cy - R * 0.36, R * 0.24, R * 0.13); g.restore(); _b206Text(g, 'NAV', cx - R * 0.33, cy - R * 0.295, R * 0.09, '#fff'); }
  _b206Text(g, c.src || '', cx, cy + R * 0.7, R * 0.1, '#9ad');
}
// 13) RMI — 카드(기수 위) · 가는 초록 바늘 ADF · 굵은 노랑 두 줄 바늘 NAV 2. 잡은 국이 없으면 3시에 눕는다
function b206Rmi(g, cx, cy, R, hdg, rel) {
  _b206Case(g, cx, cy, R);
  _b206Card(g, cx, cy, R * 0.88, hdg, R * 0.16);
  rel = (rel && typeof rel === 'object') ? rel : { adf: rel, nav: null };
  _b206Text(g, 'ADF', cx - R * 0.3, cy + R * 0.42, R * 0.11, '#7dff3a');
  _b206Text(g, 'NAV2', cx + R * 0.3, cy + R * 0.42, R * 0.11, '#ffd23a');
  if (rel.adfId) _b206Text(g, rel.adfId.slice(0, 7), cx - R * 0.3, cy + R * 0.56, R * 0.09, '#7dff3a');
  if (rel.navId) _b206Text(g, rel.navId.slice(0, 5), cx + R * 0.3, cy + R * 0.56, R * 0.09, '#ffd23a');
  // NAV 2 — 굵은 두 줄(아래에)
  g.save(); g.translate(cx, cy); g.rotate((rel.nav != null ? rel.nav : 90) * Math.PI / 180);
  g.strokeStyle = '#ffd23a'; g.fillStyle = '#ffd23a'; g.lineWidth = R * 0.035;
  for (const dx of [-R * 0.045, R * 0.045]) { g.beginPath(); g.moveTo(dx, R * 0.8); g.lineTo(dx, -R * 0.58); g.stroke(); }
  g.beginPath(); g.moveTo(0, -R * 0.82); g.lineTo(-R * 0.12, -R * 0.56); g.lineTo(R * 0.12, -R * 0.56); g.closePath(); g.fill();
  g.restore();
  // ADF — 가는 한 줄(위에)
  g.save(); g.translate(cx, cy); g.rotate((rel.adf != null ? rel.adf : 90) * Math.PI / 180);
  g.strokeStyle = '#7dff3a'; g.fillStyle = '#7dff3a'; g.lineWidth = R * 0.045;
  g.beginPath(); g.moveTo(0, R * 0.78); g.lineTo(0, -R * 0.6); g.stroke();
  g.beginPath(); g.moveTo(0, -R * 0.8); g.lineTo(-R * 0.09, -R * 0.58); g.lineTo(R * 0.09, -R * 0.58); g.closePath(); g.fill();
  g.restore();
  _b206Hub(g, cx, cy, R * 0.07);
}
// 경고 · 주의등 — 켜지면 밝게, 꺼지면 어둡게
function _b206Lamp(g, x, y, w, h, txt, on, col) {
  g.save();
  g.fillStyle = on ? col : '#2a1d16'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  g.restore();
  _b206Text(g, txt, x + w / 2, y + h / 2 + 1, Math.min(h * 0.5, 13), on ? '#1a0a00' : '#5a4434');
}
// 지금 켜진 경고 · 주의등
// RPM 경고등은 로터가 처질 때(NR 90% 아래)만 — 넘침(107% 위)은 회전계의 빨간 선으로 본다(실기와 같다)
function b206Annun(v) {
  return {
    engOut: v.run ? v.n1 < 55 : true,
    rpm: v.nr < B206_LIM.nrLo,
    lowFuel: v.gal < B206_LIM.fuelLow,
    xmsnOil: v.xmsnP < 30,
    engOil: v.run && v.engOilP < 50,
  };
}
// ── 주의등 줄 · MASTER CAUTION · CAUTION LT TEST ──
// 새 주의등이 켜지면 MASTER CAUTION 이 깜빡인다 — 누르면 지금 켜진 것을 알았다고 치고 끈다(새 것이 켜지면 다시).
// CAUTION LT TEST 를 누르고 있는 동안 경고 · 주의등이 다 켜지고 경고음이 난다(전구 · 경고음 점검).
let b206TestOn = false, _b206Ack = new Set();
function b206Cautions(v, an) {
  return [['BATT RLY', false], ['GEN FAIL', !v.run], ['ENG CHIP', false], ['XMSN OIL', an.xmsnOil], ['ENG OIL', an.engOil], ['T/R CHIP', false], ['FUEL FILT', false], ['LOW FUEL', an.lowFuel]];
}
function b206MasterCaution(v, an) {
  const on = b206Cautions(v, an).filter(c => c[1]).map(c => c[0]);
  for (const k of [..._b206Ack]) if (!on.includes(k)) _b206Ack.delete(k);   // 꺼진 것은 잊는다 — 다시 켜지면 새 것
  return on.some(k => !_b206Ack.has(k));
}
function b206MasterAck() {
  const v = b206Vals(), an = b206Annun(v);
  b206Cautions(v, an).forEach(([k, on]) => { if (on) _b206Ack.add(k); });
}
// 판 그림 좌표의 단추 — CAUTION LT TEST · MASTER CAUTION · FUEL QTY(재급유)
const B206_HIT = { test: [888, 22, 52, 52], master: [810, 26, 70, 36], fuel: [94, 340, 112, 112], mute: [12, 24, 44, 40] };

// ── 판 전체 — g 에 (x, y, w, h) 칸으로 그린다 ──
function b206Draw(g, x, y, w, h) {
  if (!(w > 40 && h > 40)) return;
  const v = b206Vals(), cdi = b206Cdi(), an = b206Annun(v);
  const rate = _b206TurnRate(v.hdg);
  g.save();
  g.fillStyle = B206_COL.panel; g.fillRect(x, y, w, h);
  const k = Math.min(w / B206_W, h / B206_H);
  g.translate(x + (w - B206_W * k) / 2, y + (h - B206_H * k) / 2); g.scale(k, k);
  // 판 테두리 · 나사
  g.save(); g.strokeStyle = B206_COL.panelEdge; g.lineWidth = 3; g.strokeRect(6, 6, B206_W - 12, B206_H - 12);
  g.fillStyle = '#4e565d'; for (const [sx, sy] of [[18, 18], [B206_W - 18, 18], [18, B206_H - 18], [B206_W - 18, B206_H - 18]]) { g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill(); }
  g.restore();
  // 위 — 경고등(ENG OUT · RPM) · 주의등 줄 · CAUTION LT TEST
  g.save(); g.fillStyle = '#121212'; g.fillRect(60, 24, 150, 40); g.fillRect(240, 24, 560, 40); g.restore();
  const T = b206TestOn;
  _b206Lamp(g, 66, 30, 66, 28, 'ENG OUT', T || an.engOut, '#ff3a2a');
  _b206Lamp(g, 138, 30, 66, 28, 'RPM', T || an.rpm, '#ff3a2a');
  const cau = b206Cautions(v, an);
  cau.forEach(([t, on], i) => _b206Lamp(g, 246 + i * 69, 30, 65, 28, t, T || on, '#ffb21a'));
  // MASTER CAUTION — 새 주의등이면 깜빡인다(누르면 끈다)
  { const m = T || (b206MasterCaution(v, an) && (performance.now() % 1000) < 600);
    g.save(); g.fillStyle = '#121212'; g.fillRect(806, 24, 78, 40); g.restore();
    _b206Lamp(g, 810, 28, 70, 32, '', m, '#ffb21a');
    _b206Text(g, 'MASTER', 845, 38, 10, m ? '#1a0a00' : '#5a4434'); _b206Text(g, 'CAUTION', 845, 51, 10, m ? '#1a0a00' : '#5a4434'); }
  g.save(); g.fillStyle = '#1a1a1a'; g.fillRect(888, 22, 52, 52); g.fillStyle = T ? '#ff3a2a' : '#7a0d0d'; g.beginPath(); g.arc(914, 46, T ? 9 : 11, 0, 7); g.fill(); g.restore();
  // HORN MUTE — 울리는 경고음을 끈다(경고가 풀리면 다시 산다)
  { const m = _b206HornMuted; g.save(); g.fillStyle = '#1a1a1a'; g.fillRect(12, 24, 44, 40); g.strokeStyle = m ? '#ffb21a' : '#444'; g.lineWidth = 2; g.strokeRect(13, 25, 42, 38); g.restore();
    _b206Text(g, 'HORN', 34, 38, 9, m ? '#ffb21a' : '#aaa'); _b206Text(g, 'MUTE', 34, 50, 9, m ? '#ffb21a' : '#aaa'); }
  // 누를 자리를 캔버스에 적어 둔다(아래 b206PanelHit)
  try { const m = g.getTransform(); g.canvas._b206 = { a: m.a, e: m.e, f: m.f }; } catch (e) { /* 그만 */ }
  _b206Text(g, 'CAUTION', 914, 16, 9, '#222'); _b206Text(g, 'LT TEST', 914, 84, 9, '#222');
  // 1열 — 엔진 · 변속기 오일 · 연료 · 전기
  const c1 = 150, c2 = 282, Re = 56;
  b206DualGauge(g, c1, 140, Re,
    { lo: 0, hi: 150, maj: 50, min: 10, lab: v => String(v / 10), bands: [[115, 130, B206_COL.green]], redline: [50, 130], val: v.engOilP, unit: 'PSI' },
    { lo: 0, hi: 150, maj: 50, min: 10, lab: v => String(v / 10), bands: [[0, 107, B206_COL.green]], redline: [107], val: v.engOilT, unit: '°C' },
    ['ENG', 'OIL']);
  b206DualGauge(g, c1, 268, Re,
    { lo: 0, hi: 100, maj: 50, min: 10, lab: v => String(v / 10), bands: [[30, 70, B206_COL.green]], redline: [30, 70], val: v.xmsnP, unit: 'PSI' },
    { lo: 0, hi: 150, maj: 50, min: 10, lab: v => String(v / 10), bands: [[15, 110, B206_COL.green]], redline: [110], val: v.xmsnT, unit: '°C' },
    ['XMSN', 'OIL']);
  b206RoundGauge(g, c1, 396, Re, { lo: 0, hi: 100, maj: 20, min: 5, lab: v => v === 0 ? 'E' : String(v), bands: [[0, B206_LIM.fuelLow, B206_COL.yellow], [B206_LIM.fuelLow, 100, B206_COL.green]], val: v.gal, title: ['FUEL', 'QTY GALS'], a0: -120, a1: 120 });
  b206DualGauge(g, c1, 524, Re,
    { lo: 0, hi: 100, maj: 50, min: 10, lab: v => String(v / 10), bands: [[0, 70, B206_COL.green]], redline: [100], val: v.load, unit: 'DC' },
    { lo: 0, hi: 30, maj: 10, min: 5, lab: v => String(v), bands: [[4, 25, B206_COL.green]], redline: [4, 25], val: v.fuelP, unit: 'PSI' },
    ['LOAD', 'FUEL']);
  // 2열 — 토크 · TOT · N1 · 시계
  b206RoundGauge(g, c2, 140, Re, { lo: 0, hi: 120, maj: 10, min: 5, lab: v => v % 20 === 0 ? String(v) : null, fs: Re * 0.17,
    bands: [[0, B206_LIM.tqCont, B206_COL.green], [B206_LIM.tqCont, B206_LIM.tqMax, B206_COL.yellow]], redline: [B206_LIM.tqMax], val: _cl(v.tq, 0, 125), title: ['TORQUE', 'PERCENT'] });
  b206RoundGauge(g, c2, 268, Re, { lo: 0, hi: 900, maj: 100, min: 50, lab: v => v % 200 === 0 ? String(v / 100) : null, fs: Re * 0.19,
    bands: [[100, B206_LIM.totCont, B206_COL.green], [B206_LIM.totCont, B206_LIM.totMax, B206_COL.yellow]], redline: [B206_LIM.totMax], val: _cl(v.tot, 0, 920), title: ['TURB OUT', 'TEMP °C×100'] });
  b206N1(g, c2, 396, Re, v.n1);
  b206Clock(g, c2, 524, Re * 0.92);
  // 3 · 4 · 5열 — 비행 계기
  const c3 = 446, c4 = 620, c5 = 790, Rf = 72, Rs = 58;
  b206Airspeed(g, c3, 156, Rf, v.ias);
  b206Tach(g, c3, 324, Rf, v.nr, v.n2);
  b206Rmi(g, c3, 492, Rf, v.hdg, b206RmiRel());
  b206Attitude(g, c4, 156, Rf, v.pit, v.bnk);
  b206CdiGauge(g, c4, 324, Rf * 0.94, cdi);
  b206Dg(g, c4, 492, Rf, v.hdg, v.hdgBug);
  b206Altimeter(g, c5, 156, Rf, v.alt, v.baro);
  b206Vsi(g, c5, 316, Rs, v.vs);
  b206Turn(g, c5, 450, Rs, rate, v.slip);
  // 오른쪽 아래 — FUEL VALVE(빨간 덮개 스위치 · ON)
  g.save(); g.fillStyle = '#151515'; g.fillRect(888, 500, 64, 80);
  g.fillStyle = '#c4161c'; g.fillRect(902, 512, 22, 44); g.fillStyle = '#ddd'; g.fillRect(908, 506, 10, 16); g.restore();
  _b206Text(g, 'ON', 940, 512, 10, '#ddd'); _b206Text(g, 'FUEL', 940, 532, 10, '#ddd'); _b206Text(g, 'VALVE', 940, 546, 10, '#ddd'); _b206Text(g, 'OFF', 940, 568, 10, '#ddd');
  // 판 이름
  _b206Text(g, 'BELL 206B-3', 918, 300, 12, '#33393f'); _b206Text(g, 'JETRANGER III', 918, 316, 10, '#33393f');
  g.restore();
}
// PFD 창에서 판이 쓸 높이(캔버스 px) — 소프트키 줄(#pfd-sk) · FCP(.ctrl-bar)가 캔버스 위로 실제로 시작하는 자리를 재서 그 위까지만.
// FCP 높이(CTRL_H) 한 값으로만 빼면 기기 · 배율에 따라 판 아래쪽이 FCP 에 가려졌다(태블릿 1920 폭 화면)
function b206RoomH(canvas, H, ctrlH) {
  let room = H - (ctrlH || 0);
  try {
    const cr = canvas.getBoundingClientRect();
    if (cr.height > 0) {
      const k = canvas.height / cr.height;
      let top = cr.bottom;
      canvas.ownerDocument.querySelectorAll('#pfd-sk, .ctrl-bar').forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.height > 0 && r.top > cr.top + 20 && r.top < top && r.left < cr.right - 1 && r.right > cr.left + 1) top = r.top;
      });
      room = Math.min(room, (top - cr.top) * k);
    }
  } catch (e) { /* 재지 못하면 FCP 높이로 */ }
  return Math.max(40, room);
}
// ── 3D 화면에 겹친 계기(계기 ON · 07-sim.js pfdOverlayDraw) — 비행에 꼭 필요한 여섯만 ──
//   위 왼쪽 속도계 · 아래 왼쪽 TORQUE · 위 가운데 자세계(+ 아래 볼) · 위 오른쪽 고도계 · 아래 가운데 방향지시계(DG) · 아래 오른쪽 승강계
//   그림 좌표 600×420(B206_OV_W×B206_OV_H) — 칸에 맞춰 줄인다. 판은 살짝 비쳐 3D 가 보인다
const B206_OV_W = 600, B206_OV_H = 420;
function b206OverlayDraw(g, x, y, w, h) {
  if (!(w > 40 && h > 40)) return;
  const v = b206Vals(), rate = _b206TurnRate(v.hdg);
  g.save();
  g.clearRect(x, y, w, h);
  const k = Math.min(w / B206_OV_W, h / B206_OV_H);
  g.translate(x + (w - B206_OV_W * k) / 2, y + (h - B206_OV_H * k) / 2); g.scale(k, k);
  g.fillStyle = 'rgba(127,138,147,0.82)';                               // 판(살짝 비침)
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, B206_OV_W, B206_OV_H, 14) : g.rect(0, 0, B206_OV_W, B206_OV_H); g.fill();
  const R = 88;
  b206Airspeed(g, 104, 108, R, v.ias);                                  // 속도계 — 토크 위
  b206RoundGauge(g, 104, 318, R * 0.98, { lo: 0, hi: 120, maj: 10, min: 5, lab: q => q % 20 === 0 ? String(q) : null, fs: R * 0.98 * 0.17,
    bands: [[0, B206_LIM.tqCont, B206_COL.green], [B206_LIM.tqCont, B206_LIM.tqMax, B206_COL.yellow]], redline: [B206_LIM.tqMax], val: _cl(v.tq, 0, 125), title: ['TORQUE', 'PERCENT'] });
  b206Attitude(g, 300, 108, R, v.pit, v.bnk);
  // 볼 — 자세계 아래(미끄럼 · 외활)
  const by = 214, bw = 46;
  g.save(); g.fillStyle = '#d8d0b0'; g.beginPath(); g.ellipse(300, by, bw, 9, 0, 0, 7); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(291, by - 9); g.lineTo(291, by + 9); g.moveTo(309, by - 9); g.lineTo(309, by + 9); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(300 + _cl(v.slip, -1, 1) * (bw - 8), by, 7.5, 0, 7); g.fill(); g.restore();
  b206Altimeter(g, 496, 108, R, v.alt, v.baro);
  b206Dg(g, 300, 318, R * 0.98, v.hdg, v.hdgBug);
  b206Vsi(g, 496, 318, R * 0.98, v.vs);
  g.restore();
  return rate;
}
// 아무 캔버스에 판을 가득 그린다(Cockpit 모드 계기판 자리 · 팝아웃)
function b206DrawTo(canvas) {
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  b206Draw(g, 0, 0, canvas.width, canvas.height);
}

// ── 계기판을 누르면 — CAUTION LT TEST(누르는 동안) · MASTER CAUTION(알았음) · FUEL QTY(재급유) ──
// b206Draw 가 캔버스에 적어 둔 변환(_b206)으로 판 그림 좌표를 되짚는다. 맞으면 그 누름은 여기서 끝낸다(팝아웃이 열리지 않게).
function b206PanelHit(ev) {
  const c = ev.target; if (!c || c.tagName !== 'CANVAS' || !c._b206 || !acB206()) return null;
  const r = c.getBoundingClientRect(); if (!(r.width > 0)) return null;
  const px = (ev.clientX - r.left) * c.width / r.width, py = (ev.clientY - r.top) * c.height / r.height;
  const k = c._b206.a, x = (px - c._b206.e) / k, y = (py - c._b206.f) / k;
  for (const [n, [bx, by, bw, bh]] of Object.entries(B206_HIT)) if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return n;
  return null;
}
function _b206TestEnd() { if (b206TestOn) { b206TestOn = false; try { drawPFD(); } catch (e) { /* 그만 */ } } }
document.addEventListener('pointerdown', ev => {
  try { if (_b206Horn && _b206Horn.ctx.state === 'suspended') _b206Horn.ctx.resume(); } catch (e) { /* 그만 */ }
  const h = b206PanelHit(ev); if (!h) return;
  ev.stopPropagation(); ev.preventDefault();
  if (h === 'test') { b206TestOn = true; b206HornAudio(true); }
  else if (h === 'master') b206MasterAck();
  else if (h === 'mute') { if (b206HornCond()) _b206HornMuted = true; }
  else if (h === 'fuel') b206WbOpen();
  try { drawPFD(); } catch (e) { /* 그만 */ }
}, true);
document.addEventListener('click', ev => { if (b206PanelHit(ev)) { ev.stopPropagation(); ev.preventDefault(); } }, true);
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, _b206TestEnd, true));

// ── 경고음(ENG OUT · 낮은 로터 RPM) — 공중에서 N1 55% 아래 · NR 90% 아래면 울린다 ──
// 소리 장치는 처음 누를 때 연다(브라우저 규칙). 같은 음(약 700Hz)을 0.25초마다 끊어 낸다.
// HORN MUTE(계기판 왼쪽 위)로 끌 수 있다 — 경고가 풀리면 다시 산다(다음 경고에는 울린다).
// 경고음이 울리는 동안은 다른 소리가 비킨다(소리 우선순위: 경고음 > ADF 식별음 · 로터 소리는 반으로 · 16-sound.js · 26-b206radio.js)
let _b206Horn = null, _b206HornMuted = false;
function b206HornCond() {
  let air = false;
  try { air = typeof sndOnGround === 'function' ? !sndOnGround() : S.alt > 5; } catch (e) { air = false; }
  if (!air) return false;
  const v = b206Vals(), an = b206Annun(v);
  return an.engOut || an.rpm;
}
function b206HornWant() {
  if (b206TestOn) return true;
  const c = b206HornCond();
  if (!c) { _b206HornMuted = false; return false; }
  return !_b206HornMuted;
}
function b206HornAudio(on) {
  try {
    if (on && !_b206Horn) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = new AC(), o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 700;
      lfo.type = 'square'; lfo.frequency.value = 4; lg.gain.value = 0.05; g.gain.value = 0.05;   // 0.25초 끊음
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(ctx.destination); o.start(); lfo.start();
      _b206Horn = { ctx, o, lfo };
    } else if (!on && _b206Horn) {
      const h = _b206Horn; _b206Horn = null;
      try { h.o.stop(); h.lfo.stop(); h.ctx.close(); } catch (e) { /* 그만 */ }
    }
  } catch (e) { _swallow(e); }
}
function b206HornOn() { return !!_b206Horn; }
// 연료 · 경고음 — 0.25초마다(Bell 일 때만)
let _b206TickT = 0;
setInterval(() => {
  if (!acB206()) { if (_b206Horn) b206HornAudio(false); return; }
  const now = performance.now(), dt = _b206TickT ? Math.min(2, (now - _b206TickT) / 1000) : 0; _b206TickT = now;
  let k = 0; try { k = S.running ? (typeof simSpeed === 'number' ? simSpeed : 1) : 0; } catch (e) { k = 0; }
  b206FuelStep(dt * k);
  if (k > 0) b206ExceedStep(dt * k);
  const want = b206HornWant();
  if (want !== !!_b206Horn) b206HornAudio(want);
}, 250);

// ── 무게 · 연료(W&B) — 자중 · 사람 · 화물 · 연료(갤런 × 6.7lb)로 총중량을 셈한다. 성능(09-cdu.js Bell PERF)이 이 무게를 쓴다 ──
// 최대 총중량 3,200lb. 연료는 타는 만큼 무게가 준다. 계기판 FUEL QTY 를 누르거나 컬렉티브 창의 W&B 단추로 연다.
const B206_WB = { empty: 1950, pilot: 170, copilot: 170, rear: 0, cargo: 0, max: 3200, lbPerGal: 6.7 };
const b206Wb = { empty: B206_WB.empty, pilot: B206_WB.pilot, copilot: B206_WB.copilot, rear: B206_WB.rear, cargo: B206_WB.cargo };
function b206GrossWt() { return b206Wb.empty + b206Wb.pilot + b206Wb.copilot + b206Wb.rear + b206Wb.cargo + b206FuelGal() * B206_WB.lbPerGal; }
function b206WbSet(o) {
  for (const k of ['empty', 'pilot', 'copilot', 'rear', 'cargo']) if (Number.isFinite(+o[k])) b206Wb[k] = Math.max(0, +o[k]);
  if (Number.isFinite(+o.gal)) b206FuelSet(+o.gal);
}
function b206WbOpen() {
  let w = document.getElementById('wb-wrap');
  if (!w) {
    w = document.createElement('div'); w.id = 'wb-wrap';
    const row = (k, t, u) => `<label><span>${t}</span><input type="number" inputmode="decimal" data-wb="${k}"><em>${u}</em></label>`;
    w.innerHTML = `<div class="wb-box"><div class="wb-bar"><b>Bell 206B-3 무게 · 연료 (W&amp;B)</b><button class="sim-btn" data-wbx="close">✕</button></div>` +
      row('empty', '기본 자중', 'lb') + row('pilot', '조종사', 'lb') + row('copilot', '부조종사 · 교관', 'lb') + row('rear', '뒷좌석(3석 합)', 'lb') + row('cargo', '화물', 'lb') +
      row('gal', '연료', `gal (최대 ${B206_LIM.fuelCap})`) +
      `<div class="wb-sum" data-wbv="sum"></div><div class="wb-btns"><button class="sim-btn" data-wbx="full">연료 가득</button><button class="sim-btn on" data-wbx="ok">적용</button></div></div>`;
    document.body.appendChild(w);
    const read = () => { const o = {}; w.querySelectorAll('[data-wb]').forEach(i => { o[i.dataset.wb] = parseFloat(i.value); }); return o; };
    const sum = () => {
      const o = read(), gal = Math.max(0, Math.min(B206_LIM.fuelCap, o.gal || 0));
      const gw = ['empty', 'pilot', 'copilot', 'rear', 'cargo'].reduce((a, k) => a + (o[k] || 0), 0) + gal * B206_WB.lbPerGal;
      const over = gw > B206_WB.max;
      w.querySelector('[data-wbv="sum"]').innerHTML = `총중량 <b class="${over ? 'over' : ''}">${gw.toFixed(0)} lb</b> / 최대 ${B206_WB.max} lb` + (over ? ' — <b class="over">최대 총중량 초과</b>' : ` · 여유 ${(B206_WB.max - gw).toFixed(0)} lb`);
    };
    w.addEventListener('input', sum);
    w.addEventListener('click', e => {
      const b = e.target.closest('[data-wbx]'); if (!b) return;
      if (b.dataset.wbx === 'close') w.style.display = 'none';
      else if (b.dataset.wbx === 'full') { w.querySelector('[data-wb="gal"]').value = B206_LIM.fuelCap; sum(); }
      else if (b.dataset.wbx === 'ok') {
        b206WbSet(read()); w.style.display = 'none';
        const gw = b206GrossWt();
        try { uiToast(`총중량 ${gw.toFixed(0)} lb · 연료 ${b206FuelGal().toFixed(0)} gal${gw > B206_WB.max ? ' — 최대 총중량 초과!' : ''}`, gw > B206_WB.max ? 'err' : ''); } catch (er) { /* 그만 */ }
      }
    });
    w._sum = sum;
  }
  w.querySelectorAll('[data-wb]').forEach(i => { i.value = i.dataset.wb === 'gal' ? Math.round(b206FuelGal()) : b206Wb[i.dataset.wb]; });
  w.style.display = 'flex'; w._sum();
}

// ── 엔진 · 로터 한계 넘음 기록(점검 필요) — 넘을 때마다 알림 · 비행 기록(28-debrief.js) 사건 ──
//   TOT 시동 927°C 10초 넘게 · 1,093°C · 비행 810°C(빨강) · 738~810°C 5분 넘게 · TQ 100% · N1 105% · N2 105% · NR 107%
const b206Exceed = [];
const _b206Ex = {};
function _b206ExHit(key, on, txt, val, dt, minS = 0) {
  const e = _b206Ex[key] || (_b206Ex[key] = { t: 0, max: 0, logged: false });
  if (on) {
    e.t += dt; e.max = Math.max(e.max, val);
    if (!e.logged && e.t >= minS) {
      e.logged = true;
      const m = `${txt} (${val.toFixed(0)})`;
      b206Exceed.push({ key, txt: m, at: Date.now() });
      try { uiToast(`한계 넘음 — ${m} · 엔진 점검 필요`, 'err', 3500); } catch (er) { /* 그만 */ }
      try { if (typeof fdrNote === 'function') fdrNote(`한계 넘음 — ${m}`, 'err'); } catch (er) { /* 그만 */ }
    }
  } else { e.t = 0; e.max = 0; e.logged = false; }
}
function b206ExceedStep(dt) {
  if (!(dt > 0)) return;
  const v = b206Vals(), sv = (typeof b206cStartVals === 'function') ? b206cStartVals() : null;
  if (sv) {
    _b206ExHit('totStart', v.tot > 927, 'TOT 시동 한계 927°C 10초 넘게', v.tot, dt, 10);
    _b206ExHit('totStartMax', v.tot > 1093, 'TOT 1,093°C 넘음', v.tot, dt);
    return;
  }
  if (!v.run) return;
  _b206ExHit('tot', v.tot > 810, 'TOT 810°C 넘음', v.tot, dt);
  _b206ExHit('tot5', v.tot > 738 && v.tot <= 810, 'TOT 738~810°C 5분 넘게', v.tot, dt, 300);
  _b206ExHit('tq', v.tq > 100, 'TORQUE 100% 넘음', v.tq, dt);
  _b206ExHit('n1', v.n1 > 105, 'N1 105% 넘음', v.n1, dt);
  _b206ExHit('n2', v.n2 > 105, 'N2 105% 넘음', v.n2, dt);
  _b206ExHit('nr', v.nr > 107, 'NR 107% 넘음', v.nr, dt);
}
