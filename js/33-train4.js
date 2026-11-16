'use strict';
// ══════════════════════════════════════════════════════
// 33-train4.js — 훈련 보강 4
//   계기 고장(속도계 · 고도계 · 승강계 고착 · AHRS · 나침반 오차) · 브라운아웃/화이트아웃 · 교통(TCAS 연습) ·
//   METAR 로 환경 맞추기 · 설정 한곳(⚙) · 도구 메뉴(🧰) · 다른 기기 교관 연결(WebRTC)
// ══════════════════════════════════════════════════════

// ── ① 계기 고장(교관 · IOS) — 그리는 동안만 값을 바꿔 보인다(비행 모델은 그대로) ──
//   asi · alt · vsi — 고장 난 순간의 값에 굳는다(피토 · 정압 막힘) / ahrs — 자세가 그 자리에 굳고 ATT FAIL
//   hdg — 나침반(기수)이 n° 어긋난다
const instFail = { asi: null, alt: null, vsi: null, ahrs: null, hdg: 0 };
function instFailSet(kind, on, val) {
  if (kind === 'asi') instFail.asi = on ? S.spd : null;
  else if (kind === 'alt') instFail.alt = on ? S.alt : null;
  else if (kind === 'vsi') instFail.vsi = on ? S.vs : null;
  else if (kind === 'ahrs') instFail.ahrs = on ? { pit: S.pit, bnk: S.bnk } : null;
  else if (kind === 'hdg') instFail.hdg = on ? (Number.isFinite(+val) ? +val : 25) : 0;
  try { if (typeof fdrNote === 'function') fdrNote(`계기 고장 ${kind} ${on ? '걸림' : '풀림'}`, on ? 'err' : ''); } catch (e) { _swallow(e); }
}
function instFailAny() { return instFail.asi !== null || instFail.alt !== null || instFail.vsi !== null || !!instFail.ahrs || !!instFail.hdg; }
// 계기에 보일 값(S 를 건드리지 않는다) — 새로 짜는 계기는 이것을 읽는다
function instView() {
  const v = { spd: S.spd, alt: S.alt, vs: S.vs, pit: S.pit, bnk: S.bnk, hdg: S.hdg };
  if (instFail.asi !== null) v.spd = instFail.asi;
  if (instFail.alt !== null) v.alt = instFail.alt;
  if (instFail.vsi !== null) v.vs = instFail.vsi;
  if (instFail.ahrs) { v.pit = instFail.ahrs.pit; v.bnk = instFail.ahrs.bnk; }
  if (instFail.hdg) v.hdg = ((S.hdg + instFail.hdg) % 360 + 360) % 360;
  return v;
}
// 그리는 동안 S 를 바꿔 두고 되돌리는 함수를 돌려준다 — 옛 계기 그림(drawPFD · b206Draw …)이 S 를 직접 읽어서.
//   · 겹쳐 불려도(그림 안에서 다른 그림) 한 번만 바꾼다(나침반 오차가 두 번 더해지지 않게)
//   · 되돌릴 때는 바꾼 칸만 — 그림이 그 사이 칸을 고쳐 썼으면(있어서는 안 된다) 진짜 값으로 되돌리고 진단 기록에 남긴다
let _instDepth = 0;
function instFailApply() {
  if (_instDepth > 0 || !instFailAny()) { _instDepth++; return () => { _instDepth--; }; }
  const v = instView(), keep = {}, put = {};
  for (const k of Object.keys(v)) if (v[k] !== S[k]) { keep[k] = S[k]; put[k] = v[k]; S[k] = v[k]; }
  _instDepth = 1;
  return () => {
    _instDepth = 0;
    for (const k of Object.keys(keep)) {
      if (S[k] !== put[k]) try { _swallow(new Error(`계기 고장 표시 중 S.${k} 가 바뀜(되돌림)`)); } catch (e) { /* 무시 */ }
      S[k] = keep[k];
    }
  };
}
(function wrapDraw() {
  const wrap = (name, after) => {
    const f = window[name]; if (typeof f !== 'function' || f._instWrapped) return;
    const g = function (...a) { const r = instFailApply(); try { return f.apply(this, a); } finally { r(); if (after) try { after.apply(this, a); } catch (e) { _swallow(e); } } };
    g._instWrapped = true; window[name] = g;
  };
  // PFD — AHRS 고장이면 ATT FAIL(빨강)
  wrap('drawPFD', () => {
    if (!instFail.ahrs || typeof ctx === 'undefined' || !cvs || (typeof acB206 === 'function' && acB206())) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `bold ${Math.max(14, cvs.width * 0.04)}px Arial`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff3030';
    ctx.fillText('ATT FAIL', cvs.width * 0.36, cvs.height * 0.18); ctx.restore();
  });
  wrap('b206Draw'); wrap('b206OverlayDraw');
})();

// ── 설정(⚙) — 이 기기 'appSet' ──
const appSet = { callsign: 'Coastguard zero one', atcVoice: true, readback: true, rate: 1.05, mission: 'patrol', voice: '', stickK: 1, stickDead: 0 };   // voice — 관제 목소리 이름('' 이면 자동)   // mission — Watchman 교신의 임무(patrol · medevac · sar)
try { Object.assign(appSet, JSON.parse(localStorage.getItem('appSet') || '{}')); } catch (e) { _swallow(e); }
function appSetSave() { try { localStorage.setItem('appSet', JSON.stringify(appSet)); } catch (e) { _swallow(e); } }

// ── ② 브라운아웃 · 화이트아웃 — ENV 지면(모래 · 눈) 위 40ft 아래 저속 호버면 하강풍 먼지가 시야를 가린다 ──
let envDustOp = 0, _dustWarn = false;
function envDustStep() {
  const host = document.getElementById('map3d'); if (!host) return;
  let el = host.querySelector('.env-dust');
  if (!el) { el = document.createElement('div'); el.className = 'env-dust'; host.appendChild(el); }
  const sf = (typeof env !== 'undefined') ? env.surface : 'normal';
  let tgt = 0;
  if (sf === 'sand' || sf === 'snow') {
    let agl = 1000; try { agl = radarAltFt(); } catch (e) { _swallow(e); }
    let tq = 0; try { tq = tqShown(); } catch (e) { _swallow(e); }
    let gnd = false; try { gnd = typeof sndOnGround === 'function' && sndOnGround(); } catch (e) { _swallow(e); }
    const spd = Math.abs(S.spd || 0);
    if (agl < 40 && tq > 30 && spd < 20 && !(gnd && tq < 45)) tgt = Math.min(1, (40 - agl) / 25) * Math.min(1, (20 - spd) / 10) * (sf === 'snow' ? 0.95 : 0.9);
  }
  envDustOp += (tgt - envDustOp) * 0.12;
  el.className = 'env-dust ' + (sf === 'snow' ? 'snow' : 'sand');
  el.style.opacity = envDustOp.toFixed(2);
  if (envDustOp > 0.7 && !_dustWarn) { _dustWarn = true; try { if (typeof fdrNote === 'function') fdrNote(sf === 'snow' ? '화이트아웃' : '브라운아웃', 'warn'); } catch (e) { _swallow(e); } }
  if (envDustOp < 0.2) _dustWarn = false;
}
setInterval(() => { try { envDustStep(); } catch (e) { _swallow(e); } }, 100);

// ── ③ 교통(TCAS 연습) — ENV 교통량(0 · 1 · 3 · 5) 만큼 둘레에 다른 항공기를 띄운다 ──
//   셋에 하나는 내 기체 쪽으로 다가온다. TA(6NM · ±1,200ft 안에서 다가오면) "Traffic, traffic" ·
//   RA(흰수리 · 3NM · ±600ft · 25초 안) "Climb, climb" / "Descend, descend" · 풀리면 "Clear of conflict"
//   PFD 오른쪽 아래 TCAS 창 · 지도 · 3D 화면(밤에는 불빛)에 보인다
const traffic = [];
let _tfcT = 0, _tfcSeq = 0;
const _tNE = (la1, lo1, la2, lo2) => ({ n: (la2 - la1) * 60, e: (lo2 - lo1) * 60 * Math.cos(la1 * Math.PI / 180) });   // NM
//   기종 — 흰수리 · Bell 206 을 번갈아(3D 화면에는 실제 모형 — 15-heli3d.js TFC3D_LAYER)
//   비행 — 셋에 하나(1 · 4 …번째)는 가까운 공항(15NM 안)에서 장주비행(왼쪽 장주 · 1,000ft AGL · 접지 후 이륙),
//          나머지는 항로비행(곧게 · 교통 연습용으로 셋에 하나는 내 쪽으로)
const TFC_SPD = { kuh: [125, 140], b206: [100, 110] }, TFC_PAT_SPD = { kuh: 90, b206: 80 };
const _TT = TUNE.tfc;   // 00-params.js — 장주 옆 · 연장 · 이륙 뒤(NM) · 고도(ft AGL) · 선회율(°/s) · 승강 한계(fpm)
const TFC_PAT = { off: _TT.patOff, ext: _TT.patExt, up: _TT.patUp, alt: _TT.patAlt, turn: _TT.patTurn, vsMax: _TT.patVs };
const TFC_LEG = ['upwind', 'crosswind', 'downwind', 'base', 'final', 'touch and go'];
const _tfcR2D = 180 / Math.PI;
function _tfcBrg(la1, lo1, la2, lo2) { const v = _tNE(la1, lo1, la2, lo2); return (Math.atan2(v.e, v.n) * _tfcR2D + 360) % 360; }
// 가까운 활주로(15NM 안) — { ap, r }
function _tfcNearRwy() {
  let best = null, bd = 15;
  try {
    for (const ap of (typeof RUNWAYS !== 'undefined' ? RUNWAYS : [])) for (const r of (ap.rwys || [])) {
      const v = _tNE(S.lat, S.lon, r.a[0], r.a[1]), d = Math.hypot(v.n, v.e);
      if (d < bd) { bd = d; best = { ap, r }; }
    }
  } catch (e) { _swallow(e); }
  return best;
}
// 장주 꼭짓점 — a → b 로 이륙, 왼쪽으로 돌아 a 로 내려와 활주로 가운데에서 접지 후 다시 이륙
function _tfcPatWps(ap, r) {
  const el = ap.elev || 0, v = _tNE(r.a[0], r.a[1], r.b[0], r.b[1]), L = Math.hypot(v.n, v.e) || 0.5;
  const u = { n: v.n / L, e: v.e / L }, lf = { n: u.e, e: -u.n };          // 활주로 방향 · 왼쪽
  const P = (base, au, al, agl) => {
    const n = au * u.n + al * lf.n, e = au * u.e + al * lf.e;
    return { lat: base[0] + n / 60, lon: base[1] + e / 60 / Math.cos(base[0] * Math.PI / 180), alt: el + agl };
  };
  const C = TFC_PAT;
  return [P(r.b, C.up, 0, 600), P(r.b, C.up, C.off, C.alt), P(r.a, -C.ext, C.off, C.alt), P(r.a, -C.ext, 0, 600),
          P(r.a, 0, 0, 50), P(r.a, L / 2, 0, 15)];
}
// ENV 교통 기종(env.tfcType: mix · kuh · b206) · 장주 몫(env.tfcPat: 0 없음 · 1 셋에 하나 · 2 반 · 3 모두)
function _tfcAc(seq) { const t = (typeof env !== 'undefined' && env.tfcType) || 'mix'; return t === 'kuh' || t === 'b206' ? t : (seq % 2 === 0 ? 'kuh' : 'b206'); }
function _tfcWantPat(i) { const p = (typeof env !== 'undefined' && Number.isFinite(env.tfcPat)) ? env.tfcPat : 1; return p === 3 ? true : p === 2 ? i % 2 === 1 : p === 1 ? i % 3 === 1 : false; }
// 교통 하나를 바로 띄운다(교관 화면 — 방위 · 거리 · 상대고도 · 침로 · 기종 · 장주) — 내 기체 기준
function trafficAdd(o = {}) {
  const ac = o.ac === 'b206' ? 'b206' : 'kuh', id = ++_tfcSeq;
  if (o.pat) { const nr = _tfcNearRwy(); if (nr) { const t = _tfcPatOne(nr, ac, id, 0); t.byIos = true; traffic.push(t); _tfcEnvSync(); return t; } }
  const b = (+o.brg || 0) * Math.PI / 180, r = Math.max(0.2, +o.nm || 3);
  const t = { id, ac, mode: 'rte', byIos: true, lat: S.lat + r * Math.cos(b) / 60, lon: S.lon + r * Math.sin(b) / 60 / Math.cos(S.lat * Math.PI / 180),
              alt: Math.max(100, S.alt + (+o.rel || 0)), hdg: ((+o.hdg || 0) % 360 + 360) % 360, spd: +o.spd || (ac === 'kuh' ? 130 : 105), vs: 0, bnk: 0, pit: -3, st: 'OT' };
  traffic.push(t); _tfcEnvSync(); return t;
}
function trafficClear() { traffic.length = 0; try { if (typeof env !== 'undefined') env.traffic = 0; } catch (e) { _swallow(e); } }
// 교관이 띄운 교통은 ENV 교통량에 더해진다 — 그만큼 교통량 칸을 넓혀 두어 지우지 않게
function _tfcEnvSync() { try { if (typeof env !== 'undefined') env.traffic = Math.max(env.traffic || 0, traffic.length); } catch (e) { _swallow(e); } }
function _tfcPatOne(nr, ac, id, wi0) {
  const wp = _tfcPatWps(nr.ap, nr.r), wi = wi0 === undefined ? Math.floor(Math.random() * wp.length) : wi0, pv = wp[(wi + wp.length - 1) % wp.length];
  return { id, ac, mode: 'pat', apt: nr.ap.apt, rwy: String(nr.r.id || '').split('/')[0], wp, wi, lat: pv.lat, lon: pv.lon, alt: pv.alt,
           hdg: _tfcBrg(pv.lat, pv.lon, wp[wi].lat, wp[wi].lon), spd: TFC_PAT_SPD[ac], vs: 0, bnk: 0, pit: 0, st: 'OT' };
}
// 장주 위치 보고(무전) — 다른 다리로 들어설 때, 내 기체에서 reportNm 안이면 · 6초에 하나
let _tfcSayT = 0;
function _tfcReport(t) {
  const now = Date.now(); if (now - _tfcSayT < 6000) return;
  const v = _tNE(S.lat, S.lon, t.lat, t.lon); if (Math.hypot(v.n, v.e) > TUNE.tfc.reportNm) return;
  _tfcSayT = now;
  const cs = t.ac === 'b206' ? `Bell ${String(200 + t.id).split('').join(' ')}` : `Coast guard ${String(500 + t.id).split('').join(' ')}`;
  const leg = TFC_LEG[t.wi] || '', rw = t.rwy ? `, runway ${t.rwy.replace(/^0/, '').split('').join(' ').replace('L', 'left').replace('R', 'right').replace('C', 'center')}` : '';
  const txt = `${t.apt || ''} traffic, ${cs}, ${leg}${rw}`;
  try { if (typeof speak === 'function') speak(txt); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function') fdrNote(`교통 위치 보고 — ${cs} ${leg}`); } catch (e) { _swallow(e); }
  tfcLastReport = { t: now, txt };
}
let tfcLastReport = null;
function _tfcSpawn(toward, i) {
  const ac = _tfcAc(_tfcSeq);
  const id = ++_tfcSeq;
  if ((!toward || (typeof env !== 'undefined' && env.tfcPat === 3)) && _tfcWantPat(i)) {   // 장주비행
    const nr = _tfcNearRwy();
    if (nr) return _tfcPatOne(nr, ac, id);
  }
  const b = Math.random() * 2 * Math.PI, r = 6 + Math.random() * 6;
  const la = S.lat + r * Math.cos(b) / 60, lo = S.lon + r * Math.sin(b) / 60 / Math.cos(S.lat * Math.PI / 180);
  const hd = toward ? ((b * 180 / Math.PI + 180) % 360 + (Math.random() - 0.5) * 20) : Math.random() * 360;
  const sp = TFC_SPD[ac];
  return { id, ac, mode: 'rte', lat: la, lon: lo, alt: Math.max(500, S.alt + (toward ? (Math.random() - 0.5) * 600 : (Math.random() - 0.5) * 3000)),
           hdg: (hd + 360) % 360, spd: sp[0] + Math.random() * (sp[1] - sp[0]), vs: 0, bnk: 0, pit: -3, st: 'OT' };
}
// 장주 한 걸음 — 다음 꼭짓점 쪽으로 초당 6° 까지 돌고(그만큼 기울고) 높이를 맞춘다
function _tfcPatStep(t, dt) {
  const w = t.wp[t.wi], want = _tfcBrg(t.lat, t.lon, w.lat, w.lon);
  let dh = ((want - t.hdg + 540) % 360) - 180;
  const turn = Math.max(-TFC_PAT.turn * dt, Math.min(TFC_PAT.turn * dt, dh));
  t.hdg = (t.hdg + turn + 360) % 360;
  const rate = dt > 0 ? turn / dt : 0;                                   // °/s
  t.bnk = Math.atan(t.spd * 0.5144 * rate * Math.PI / 180 / 9.81) * _tfcR2D;
  const v = _tNE(t.lat, t.lon, w.lat, w.lon), dist = Math.hypot(v.n, v.e);
  const tLeft = dist / Math.max(1, t.spd) * 60;                          // 분
  t.vs = Math.max(-TFC_PAT.vsMax, Math.min(TFC_PAT.vsMax, (w.alt - t.alt) / Math.max(0.2, tLeft)));
  t.pit = t.vs > 200 ? 4 : t.vs < -200 ? -2 : 0;
  if (dist < Math.max(0.12, t.spd * dt / 3600 * 1.5)) { t.wi = (t.wi + 1) % t.wp.length; try { _tfcReport(t); } catch (e) { _swallow(e); } }
}
function trafficStep(dtSim) {
  const want = (typeof env !== 'undefined') ? (env.traffic || 0) : 0;
  while (traffic.length > want) traffic.pop();
  while (traffic.length < want) traffic.push(_tfcSpawn(traffic.length % 3 === 0, traffic.length));
  traffic.forEach((t, i) => {
    if (t.mode === 'pat' && dtSim > 0) _tfcPatStep(t, dtSim);
    const d = t.spd * dtSim / 3600, h = t.hdg * Math.PI / 180;
    t.lat += d * Math.cos(h) / 60; t.lon += d * Math.sin(h) / 60 / Math.cos(t.lat * Math.PI / 180); t.alt += t.vs * dtSim / 60;
    const v = _tNE(S.lat, S.lon, t.lat, t.lon); if (Math.hypot(v.n, v.e) > 16) { const id = t.id; for (const k in t) delete t[k]; Object.assign(t, _tfcSpawn(Math.random() < 0.4, i), { id }); }
  });
  tcasEval();
}
// ── TCAS II 설정(KUH-1CG FLM · CDU Home > TCAS — Traffic Settings · Transponder) ──
//   XPDR/TCAS 모드: Auto(지상 · AGL 1,000ft 아래 TA Only · 그 위 TA/RA) · TA Only · Altitude Reporting · On · Standby(뒤 셋은 TCAS 대기 —
//     교통정보를 시현하지 않고 TA · RA 를 내지 않는다)
//   고도 표시: Relative(자기 기준 ±백 ft) · Absolute(침입기 고도 백 ft)
//   고도 범위: Normal ±2,700 · Above +9,000/−2,700 · Below +2,700/−9,000 · Unrestricted ±9,900(비위협 · 근접 교통만 거른다 —
//     범위 밖이어도 TA · RA 는 계속 시현)
//   ADS-B: Traffic Display(끄면 비위협 교통을 숨긴다) · Motion Vector(켜면 VECT Duration 동안 갈 자리까지 선) · VECT Duration 30초 · 1 · 2 · 5분
//   System Test: 8초 동안 시험 그림(+10 비위협 · +02 RA · −02 TA · 근접) 뒤 "TCAS two system test passed"
const tcasCfg = { mode: 'Auto', alt: 'Relative', range: 'Normal', adsb: true, motion: false, vect: 60 };
try { Object.assign(tcasCfg, JSON.parse(localStorage.getItem('tcasCfg') || '{}')); } catch (e) { _swallow(e); }
function tcasCfgSave() { try { localStorage.setItem('tcasCfg', JSON.stringify(tcasCfg)); } catch (e) { _swallow(e); } }
const TCAS_RANGE = { Normal: [2700, 2700], Above: [9000, 2700], Below: [2700, 9000], Unrestricted: [9900, 9900] };
const TCAS_RANGES = ['Normal', 'Above', 'Below', 'Unrestricted'], TCAS_VECTS = [30, 60, 120, 300];
const TCAS_STBY_MODES = ['Standby', 'On', 'Altitude Reporting'];
// 지금 TCAS 가 실제로 하는 일 — 'STBY'(대기) · 'TA'(TA Only) · 'TA/RA'
function tcasActMode() {
  const m = tcasCfg.mode;
  if (TCAS_STBY_MODES.includes(m)) return 'STBY';
  const b2 = typeof acB206 === 'function' && acB206();
  if (m === 'TA Only' || b2) return 'TA';                          // Bell 은 RA 가 없다
  let agl = 5000; try { agl = typeof radarAltFt === 'function' ? radarAltFt() : S.alt; } catch (e) { _swallow(e); }
  return agl < 1000 ? 'TA' : 'TA/RA';                              // Auto — 지상 · AGL 1,000ft 아래는 TA Only
}
// 이 교통을 그리나 — 대기면 아무것도 · TA · RA 는 늘 · 나머지는 ADS-B Traffic Display · 고도 범위로 거른다
function tcasShow(t) {
  if (tcasActMode() === 'STBY') return false;
  if (t.st === 'TA' || t.st === 'RA') return true;
  if (!tcasCfg.adsb && t.st === 'OT') return false;
  const rel = (t.alt || 0) - S.alt, R = TCAS_RANGE[tcasCfg.range] || TCAS_RANGE.Normal;
  return rel <= R[0] && rel >= -R[1];
}
// 고도 꼬리표 — Relative: +02 · −05(백 ft) · Absolute: 045(그 교통의 고도 백 ft)
function tcasAltTag(t) {
  if (tcasCfg.alt === 'Absolute') return String(Math.max(0, Math.round((t.alt || 0) / 100))).padStart(3, '0');
  const rel = Math.round(((t.alt || 0) - S.alt) / 100);
  return (rel >= 0 ? '+' : '−') + String(Math.abs(rel)).padStart(2, '0');
}
function tcasSetMode(m) { tcasCfg.mode = m; tcasCfgSave(); try { tcasEval(); } catch (e) { _swallow(e); } try { if (typeof fdrNote === 'function') fdrNote(`XPDR/TCAS ${m}`); } catch (e) { _swallow(e); } }
function tcasSet(k, v) { tcasCfg[k] = v; tcasCfgSave(); }
function tcasCycle(k) { const L = k === 'range' ? TCAS_RANGES : TCAS_VECTS, i = L.indexOf(tcasCfg[k]); tcasCfg[k] = L[(i + 1) % L.length]; tcasCfgSave(); }
// TCAS II System Test — 8초 시험 그림 · 끝나면 음성(통과). 대기 모드여도 시험은 한다
let tcasTest = null;
function tcasTestStart() {
  if (tcasTest && performance.now() - tcasTest.t0 < 8000) return false;
  tcasTest = { t0: performance.now(), ok: null };
  try { if (typeof fdrNote === 'function') fdrNote('TCAS II 시스템 시험'); } catch (e) { _swallow(e); }
  setTimeout(() => { if (!tcasTest) return; tcasTest.ok = true; try { if (typeof speak === 'function') speak('TCAS two system test passed'); } catch (e) { _swallow(e); } }, 8000);
  try { if (typeof skState !== 'undefined' && !skState.tfcMap) { skState.tfcMap = true; if (typeof _skSave === 'function') _skSave(); } } catch (e) { _swallow(e); }   // PFD 교통 지도로
  return true;
}
function tcasTesting() { return !!tcasTest && performance.now() - tcasTest.t0 < 8000; }
// ── TCAS II(GTS 8000) 판정 — KUH-1CG FLM ──
//   감도 단계(SL) — 전파고도로 고른다. SL 2(1,000ft 아래 · RA 없음) · SL 3(1,000~2,350ft) · SL 4(그 위)
//   (교범에 SL 별 표가 없어 GTS 8000 의 흔한 값을 바꿀 수 있게 따로 둔다 — TCAS_SL)
//   하나하나: 수평 tau = 거리 ÷ 다가오는 빠르기 · 수직 tau = 고도 차 ÷ 고도 차가 줄어드는 빠르기
//     RA — (수평 tau ≤ RA tau 또는 거리 ≤ DMOD) 이고 (수직 tau ≤ RA tau 또는 고도 차 ≤ ZTHR)
//     TA — 같은 식을 TA 값으로 · PT(가까운 교통) — 6NM · ±1,200ft 안 · 나머지 OT
//   RA 종류 — 예방(Monitor Vertical Speed: 고도 차 450ft 넘고 내 승강 200fpm 안) · 상승 · 강하(1,000ft AGL 아래는 강하 RA 없음)
//     음성: Climb, climb · Descend, descend · 건너면 Crossing · 이미 빠르면 Increase · 뒤집히면 … NOW · 풀리면 Clear of conflict
//   PFD — TRAFFIC 알림(TA 황 · RA 적 · 처음 5초 점멸) · 자세계 피치 띠(붉은 금지 · 초록 목표) · 승강계 띠
const TCAS_SL = [
  { sl: 2, lo: 0,    hi: 1000,     ra: false, taTau: 25, raTau: null, taDmod: 0.30, raDmod: null, taZ: 850, raZ: null },
  { sl: 3, lo: 1000, hi: 2350,     ra: true,  taTau: 25, raTau: 18,   taDmod: 0.33, raDmod: 0.20, taZ: 850, raZ: 600 },
  { sl: 4, lo: 2350, hi: Infinity, ra: true,  taTau: 35, raTau: 25,   taDmod: 0.48, raDmod: 0.35, taZ: 850, raZ: 600 },
];
function tcasSl() { let agl = 5000; try { agl = typeof radarAltFt === 'function' ? radarAltFt() : S.alt; } catch (e) { _swallow(e); } return TCAS_SL.find(s => agl >= s.lo && agl < s.hi) || TCAS_SL[TCAS_SL.length - 1]; }
let tcasState = 'CLEAR', _tcasPrev = 'CLEAR', tcasRaSense = 0, tcasRaType = null, tcasRaVoice = '', tcasRaCue = null, tcasAnnT = 0;
function _tcasRaCmd(t, ownVs, agl) {
  const rel = t.rel, crossing = rel * ownVs > 0 && Math.abs(rel) < 300, prev = tcasRaType;
  if (Math.abs(rel) >= 450 && Math.abs(ownVs) < 200)
    return { type: 'MONITOR', sense: 0, voice: 'Monitor vertical speed', vsNo: rel < 0 ? [[-3000, -300]] : [[300, 3000]], vsGo: null, pNo: null, pGo: null };
  if (rel <= 0 || agl < 1000)
    return { type: 'CLIMB', sense: 1, voice: prev === 'DESCEND' ? 'Climb, climb NOW' : crossing ? 'Climb, crossing climb' : ownVs > 1500 ? 'Increase climb' : 'Climb, climb',
             vsNo: [[-3000, 1400]], vsGo: [1500, 2200], pNo: [-20, 4], pGo: [5, 12] };
  return { type: 'DESCEND', sense: -1, voice: prev === 'CLIMB' ? 'Descend, descend NOW' : crossing ? 'Descend, crossing descend' : ownVs < -1500 ? 'Increase descent' : 'Descend, descend',
           vsNo: [[-1400, 3000]], vsGo: [-2200, -1500], pNo: [-4, 20], pGo: [-12, -5] };
}
function tcasEval() {
  const sl = tcasSl(), am = tcasActMode(), ownVs = +S.vs || 0;
  let agl = 5000; try { agl = typeof radarAltFt === 'function' ? radarAltFt() : S.alt; } catch (e) { _swallow(e); }
  const raOk = am === 'TA/RA' && sl.ra;
  let worst = 'CLEAR', ras = [];
  for (const t of traffic) {
    const v = _tNE(S.lat, S.lon, t.lat, t.lon), r = Math.hypot(v.n, v.e), rel = t.alt - S.alt;
    const h = t.hdg * Math.PI / 180, oh = S.hdg * Math.PI / 180;
    const rv = { n: t.spd * Math.cos(h) - (S.spd || 0) * Math.cos(oh), e: t.spd * Math.sin(h) - (S.spd || 0) * Math.sin(oh) };
    const close = -(v.n * rv.n + v.e * rv.e) / Math.max(0.01, r);     // kt(+ 면 다가온다)
    const tau = close > 1 ? r / close * 3600 : Infinity;
    const rvs = (t.vs || 0) - ownVs, tauV = rel * rvs < 0 ? Math.abs(rel) / Math.max(1, Math.abs(rvs)) * 60 : Infinity;
    Object.assign(t, { r, rel, close, tau, tauV });
    const hit = (T, D, Z) => (tau <= T || r <= D) && (tauV <= T || Math.abs(rel) <= Z);
    t.st = raOk && hit(sl.raTau, sl.raDmod, sl.raZ) ? 'RA' : hit(sl.taTau, sl.taDmod, sl.taZ) ? 'TA' : (r <= 6 && Math.abs(rel) <= 1200) ? 'PT' : 'OT';
    if (t.st === 'RA') { worst = 'RA'; ras.push(t); } else if (t.st === 'TA' && worst !== 'RA') worst = 'TA';
  }
  if (am === 'STBY') { worst = 'CLEAR'; ras = []; traffic.forEach(t => { if (t.st === 'RA' || t.st === 'TA') t.st = 'OT'; }); }
  const say = (typeof speak === 'function') ? speak : () => {};
  let cmd = null;
  if (worst === 'RA') cmd = _tcasRaCmd(ras.reduce((a, b) => (a.r <= b.r ? a : b)), ownVs, agl);
  const prevVoice = tcasRaVoice;
  tcasState = worst;
  tcasRaSense = cmd ? cmd.sense : 0;
  tcasRaCue = cmd;
  if (worst !== _tcasPrev && worst !== 'CLEAR') tcasAnnT = performance.now();      // TRAFFIC 알림 — 처음 5초 점멸
  if (cmd) {
    if (cmd.voice !== prevVoice) say(cmd.voice);
    tcasRaType = cmd.type; tcasRaVoice = cmd.voice;
  } else {
    if (_tcasPrev === 'RA') say('Clear of conflict');            // RA 가 풀리면(TA 로 내려와도)
    else if (worst === 'TA' && _tcasPrev === 'CLEAR') say('Traffic, traffic');
    tcasRaType = null; tcasRaVoice = '';
  }
  if (worst !== _tcasPrev) {
    try { if (typeof fdrNote === 'function' && worst !== 'CLEAR') fdrNote(`TCAS ${worst}${cmd ? ' ' + cmd.type : ''}`, worst === 'RA' ? 'err' : 'warn'); } catch (e) { _swallow(e); }
    _tcasPrev = worst;
  }
}
// PFD TRAFFIC 알림 — { txt, col, blink } (RA 와 TA 가 함께면 RA 만)
function tcasAnn() {
  if (tcasState === 'CLEAR') return null;
  return { txt: 'TRAFFIC', col: tcasState === 'RA' ? '#ff3030' : '#ffb000', blink: performance.now() - tcasAnnT < 5000 };
}
function tcasTargets() { return traffic; }
// PFD TCAS 창에 그린다(03-pfd.js drawPfdInset) — 기수 위 · 6NM 고리
function tcasDrawInset(g, cx, cy, r) {
  const hd = (S.hdg || 0) * Math.PI / 180;
  if (tcasTesting()) { tcasDrawTest(g, cx, cy, r); return; }
  for (const t of traffic) {
    if (t.r > 6.5 || !tcasShow(t)) continue;
    const v = _tNE(S.lat, S.lon, t.lat, t.lon), x = v.e * Math.cos(hd) - v.n * Math.sin(hd), y = v.e * Math.sin(hd) + v.n * Math.cos(hd);
    const px = cx + x / 6 * r, py = cy - y / 6 * r, s = 6;
    // Motion Vector — VECT Duration 동안 갈 자리까지(땅에 대한 움직임 · 기수 위)
    if (tcasCfg.motion) {
      const d = (t.spd || 0) * tcasCfg.vect / 3600, th = (t.hdg || 0) * Math.PI / 180;
      const vx = d * Math.sin(th), vy = d * Math.cos(th), mx = vx * Math.cos(hd) - vy * Math.sin(hd), my = vx * Math.sin(hd) + vy * Math.cos(hd);
      g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px + mx / 6 * r, py - my / 6 * r); g.stroke();
    }
    const col = t.st === 'RA' ? '#ff3030' : t.st === 'TA' ? '#ffb000' : '#ffffff';
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
    if (t.st === 'RA') g.rect(px - s, py - s, s * 2, s * 2);
    else if (t.st === 'TA') g.arc(px, py, s, 0, 7);
    else { g.moveTo(px, py - s); g.lineTo(px + s, py); g.lineTo(px, py + s); g.lineTo(px - s, py); g.closePath(); }
    if (t.st === 'OT') g.stroke(); else g.fill();
    const rel = Math.round(t.rel / 100);
    g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.fillText(tcasAltTag(t), px, rel >= 0 ? py - s - 3 : py + s + 10);
  }
}
// System Test 그림(KUH-1CG FLM 그림 8) — 오른쪽 위 +10 비위협(빈 마름모) · 오른쪽 +02 RA(빨강 네모) · 왼쪽 −02 TA(노랑 동그라미) · 근접(찬 마름모)
function tcasDrawTest(g, cx, cy, r) {
  const at = (bx, by) => [cx + bx * r, cy - by * r];
  const sym = (k, [px, py], tag, up) => {
    const s = 7, col = k === 'RA' ? '#ff3030' : k === 'TA' ? '#ffd23a' : '#ffffff';
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
    if (k === 'RA') g.rect(px - s, py - s, s * 2, s * 2); else if (k === 'TA') g.arc(px, py, s, 0, 7);
    else { g.moveTo(px, py - s); g.lineTo(px + s, py); g.lineTo(px, py + s); g.lineTo(px - s, py); g.closePath(); }
    if (k === 'OT') g.stroke(); else g.fill();
    g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.fillText(tag, px, up ? py - s - 3 : py + s + 11);
  };
  sym('OT', at(0.42, 0.55), '+10', true); sym('RA', at(0.42, -0.05), '+02', true); sym('TA', at(-0.42, -0.05), '−02', false); sym('PT', at(0.18, 0.34), '+05', true);
  g.fillStyle = '#ffffff'; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.fillText('TCAS TEST', cx, cy + r * 0.55);
}
// 지도 표식
const _tfcMk = new Map();
function trafficMapSync() {
  if (typeof L === 'undefined' || typeof leafMap === 'undefined') return;
  const shown = traffic.filter(tcasShow);                       // XPDR/TCAS 모드 · 고도 범위(CDU TCAS)를 따른다
  const live = new Set(shown.map(t => t.id));
  for (const [id, m] of _tfcMk) if (!live.has(id)) { leafMap.removeLayer(m); _tfcMk.delete(id); }
  for (const t of shown) {
    const col = t.st === 'RA' ? '#ff3030' : t.st === 'TA' ? '#ffb000' : '#ffffff';
    const html = `<div style="color:${col};font:bold 11px Arial;transform:translate(-50%,-50%);white-space:nowrap;text-shadow:0 0 2px #000">◆ ${tcasAltTag(t)}</div>`;
    let m = _tfcMk.get(t.id);
    if (!m) { m = L.marker([t.lat, t.lon], { icon: L.divIcon({ className: 'tfc-mk', html, iconSize: [0, 0] }), interactive: false }).addTo(leafMap); _tfcMk.set(t.id, m); m._h = html; }
    else { m.setLatLng([t.lat, t.lon]); if (m._h !== html) { m.setIcon(L.divIcon({ className: 'tfc-mk', html, iconSize: [0, 0] })); m._h = html; } }
  }
}
setInterval(() => {
  const now = performance.now(), dt = _tfcT ? Math.min(2, (now - _tfcT) / 1000) : 0; _tfcT = now;
  let k = 0; try { k = S.running ? (typeof simSpeed === 'number' ? simSpeed : 1) : 0; } catch (e) { k = 0; }
  try { trafficStep(dt * k); trafficMapSync(); } catch (e) { _swallow(e); }
}, 250);

// ── ④ METAR 로 환경 맞추기 — 바람 · 돌풍 · 시정 · 구름 밑면(가장 낮은 BKN/OVC) · 비 · 해(시간대) ──
function envFromMetar(raw, fieldElevFt = 0, when = new Date(), lat = S.lat, lon = S.lon) {
  const o = {}, w = {};
  const wm = raw.match(/\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/);
  if (wm) { const k = wm[4] === 'MPS' ? 1.944 : 1; w.dir = wm[1] === 'VRB' ? null : +wm[1]; w.spd = Math.round(+wm[2] * k); o.gust = wm[3] ? Math.min(20, Math.round((+wm[3] - +wm[2]) * k / 5) * 5) : 0; }
  if (/\bCAVOK\b/.test(raw)) { o.vis = 0; o.ceil = 0; o.rain = 0; }
  else {
    const vm = raw.match(/\s(\d{4})(?:\s|NDV)/); const sm = raw.match(/\b(\d+(?:\/\d+)?)SM\b/);
    let km = vm ? (+vm[1] >= 9999 ? 99 : +vm[1] / 1000) : sm ? (sm[1].includes('/') ? eval(sm[1]) : +sm[1]) * 1.609 : 99;
    const steps = [10, 5, 3, 1.5, 0.8, 0.4];
    o.vis = km >= 10 ? 0 : steps.reduce((b, s) => Math.abs(s - km) < Math.abs(b - km) ? s : b, 10);
    let ceil = 0; const re = /\b(BKN|OVC|VV)(\d{3})\b/g; let m;
    while ((m = re.exec(raw))) { const ft = +m[2] * 100 + fieldElevFt; if (!ceil || ft < ceil) ceil = ft; }
    o.ceil = ceil ? [500, 1000, 1500, 2500, 4000].reduce((b, s) => Math.abs(s - ceil) < Math.abs(b - ceil) ? s : b, 500) : 0;
    o.rain = /\+(?:SH|TS)?RA\b/.test(raw) ? 2 : /\b-?(?:SH|TS)?(?:RA|DZ)\b/.test(raw) ? 1 : 0;
  }
  // 해의 높이(°)로 시간대 — 6° 위 주간 · −6 ~ 6° 황혼 · 그 밑 야간
  const el = sunElevation(when, lat, lon);
  o.tod = el > 6 ? 'DAY' : el > -6 ? 'DUSK' : 'NIGHT';
  return { env: o, wind: w, sunEl: el };
}
function sunElevation(d, lat, lon) {
  const rad = Math.PI / 180, day = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const decl = -23.44 * Math.cos(rad * 360 / 365 * (day + 10));
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60, ha = (utcH + lon / 15 - 12) * 15;
  return Math.asin(Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(ha * rad)) / rad;
}
function envApplyMetar(raw, icao, elevFt) {
  const r = envFromMetar(raw, elevFt || 0);
  if (typeof envSet === 'function') envSet(r.env);
  if (r.wind.spd != null) { try { if (r.wind.dir != null) windDir = r.wind.dir; windSpd = r.wind.spd; } catch (e) { _swallow(e); } }
  try { uiToast(`METAR ${icao || ''} — 바람 ${r.wind.dir ?? 'VRB'}°/${r.wind.spd ?? 0}kt${r.env.gust ? ' G+' + r.env.gust : ''} · 시정 ${r.env.vis ? r.env.vis + 'km' : '10km+'} · 구름 ${r.env.ceil ? r.env.ceil + 'ft' : '없음'} · ${({ DAY: '주간', DUSK: '황혼', NIGHT: '야간' })[r.env.tod]}`); } catch (e) { _swallow(e); }
  return r;
}
async function envMetarNearest() {
  const near = (typeof _nearestAirport === 'function') ? _nearestAirport() : null;
  if (!near) { try { uiToast('가까운 공항이 없습니다'); } catch (e) { _swallow(e); } return null; }
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 7000);
  let raw = null;
  try { raw = await _ivaoMetar(near.a.icao, ctl.signal); } catch (e) { try { raw = await _vatsimMetar(near.a.icao, ctl.signal); } catch (e2) { _swallow(e2); } }
  if (!raw) { try { uiToast(`${near.a.icao} METAR 를 받지 못했습니다(인터넷 연결 확인)`, 'warn'); } catch (e) { _swallow(e); } return null; }
  const rw = (typeof RUNWAYS !== 'undefined') ? RUNWAYS.find(x => x.apt === near.a.icao) : null;
  return envApplyMetar(raw.split('\n')[0], near.a.icao, rw ? rw.elev : 0);
}

// ── ⑤ 설정 창(⚙) — 흩어진 설정을 한곳에 · 모든 설정 내보내기/들여오기/초기화 ──
function toggleSettings() {
  let w = document.getElementById('set-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'set-wrap';
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-set]'); if (!b) return;
      const [k, v] = b.dataset.set.split(':');
      if (k === 'x') { w.style.display = 'none'; return; }
      if (k === 'sound' && typeof toggleSound === 'function') toggleSound();
      else if (k === 'atcVoice' || k === 'readback') { appSet[k] = v === '1'; appSetSave(); }
      else if (k === 'rate') { appSet.rate = +v; appSetSave(); }
      else if (k === 'mission') { appSet.mission = v; appSetSave(); }
      else if (k === 'stickK' || k === 'stickDead') { appSet[k] = +v; appSetSave(); }   // 화면 조종간(STICK) 감도 · 데드존(14-simmode.js vStickCyclic)
      else if (k === 'voiceTest') { if (typeof speak === 'function') speak(`${appSet.callsign}, radar contact, maintain VFR.`); }
      else if (k === 'raCall' && typeof envSet === 'function') envSet({ raCall: v === '1' });
      else if (k === 'export') settingsExport();
      else if (k === 'reset') Promise.resolve(typeof uiConfirm === 'function' ? uiConfirm('모든 설정 · 시나리오 · 저장 비행을 지우고 처음으로 돌릴까요?') : false).then(ok => { if (ok) settingsReset(); });
      else if (k === 'ios') toggleRemoteIos();
      _setRender();
    });
    w.addEventListener('change', e => {
      if (e.target.dataset.setv === 'voice') { appSet.voice = e.target.value; appSetSave(); if (typeof speak === 'function') speak(`${appSet.callsign}, wind two seven zero at eight, cleared to land.`); }
      if (e.target.dataset.setv === 'callsign') { appSet.callsign = e.target.value.trim() || 'Coastguard zero one'; appSetSave(); }
      if (e.target.dataset.setv === 'file') { const f = e.target.files && e.target.files[0]; if (f) f.text().then(settingsImport); e.target.value = ''; }
    });
  }
  w.style.display = 'flex'; _setRender();
}
function _setRender() {
  const w = document.getElementById('set-wrap'); if (!w) return;
  const on = (k, v, cur) => `<button class="sim-btn ${cur ? 'on' : ''}" data-set="${k}:${v}">${cur ? '켬' : '끔'}</button>`;
  const tg = (k, val) => `<button class="sim-btn ${val ? 'on' : ''}" data-set="${k}:1">켬</button><button class="sim-btn ${!val ? 'on' : ''}" data-set="${k}:0">끔</button>`;
  w.innerHTML = `<div class="set-box"><div class="set-bar"><b>⚙ 설정</b><button class="sim-btn" data-set="x">✕</button></div>
    <div class="set-row"><span>로터 소리</span><div>${on('sound', 1, typeof sndOn !== 'undefined' && sndOn)}</div></div>
    <div class="set-row"><span>RA 콜아웃(흰수리)</span><div>${tg('raCall', typeof env !== 'undefined' && env.raCall)}</div></div>
    <div class="set-row"><span>관제 음성</span><div>${tg('atcVoice', appSet.atcVoice)}</div></div>
    <div class="set-row"><span>리드백 확인(음성 인식)</span><div>${tg('readback', appSet.readback)}</div></div>
    <div class="set-row"><span>말 빠르기</span><div>${[0.85, 1.05, 1.3].map(r => `<button class="sim-btn ${appSet.rate === r ? 'on' : ''}" data-set="rate:${r}">${r === 0.85 ? '느리게' : r === 1.05 ? '보통' : '빠르게'}</button>`).join('')}</div></div>
    <div class="set-row"><span>관제 목소리</span><div><select data-setv="voice">${(() => {
      const vs = typeof speakVoices === 'function' ? speakVoices() : [], cur = typeof speakVoice === 'function' ? speakVoice() : null;
      const esc = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `<option value="" ${!appSet.voice ? 'selected' : ''}>자동(자연스러운 여성 영어${cur && !appSet.voice ? ' — ' + esc(cur.name) : ''})</option>` +
        vs.map(v => `<option value="${esc(v.name)}" ${appSet.voice === v.name ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('');
    })()}</select><button class="sim-btn" data-set="voiceTest:1">▶ 들어 보기</button></div></div>
    <div class="set-row"><span>임무(Watchman 교신)</span><div>${[['patrol', 'Sea patrol'], ['medevac', 'MEDEVAC'], ['sar', 'Search and Rescue']].map(([v, l]) => `<button class="sim-btn ${appSet.mission === v ? 'on' : ''}" data-set="mission:${v}">${l}</button>`).join('')}</div></div>
    <div class="set-row"><span>콜사인(관제)</span><div><input type="text" data-setv="callsign" value="${appSet.callsign.replace(/"/g, '&quot;')}"></div></div>
    <div class="set-row"><span>STICK 감도</span><div>${[0.5, 0.75, 1, 1.5].map(v => `<button class="sim-btn ${appSet.stickK === v ? 'on' : ''}" data-set="stickK:${v}">×${v}</button>`).join('')}</div></div>
    <div class="set-row"><span>STICK 데드존</span><div>${[0, 0.05, 0.1].map(v => `<button class="sim-btn ${appSet.stickDead === v ? 'on' : ''}" data-set="stickDead:${v}">${v ? Math.round(v * 100) + '%' : '없음'}</button>`).join('')}</div></div>
    <div class="set-row"><span>교관 기기 연결</span><div><button class="sim-btn" data-set="ios">📱 Instructor Sync(QR)</button></div></div>
    <div class="set-row"><span>모든 설정</span><div><button class="sim-btn" data-set="export">내보내기</button><label class="sim-btn">들여오기<input type="file" accept=".json" data-setv="file" hidden></label><button class="sim-btn" data-set="reset">초기화</button></div></div>
    <div class="set-note">환경(시간대 · 시정 · 바다 · 돌풍 · 구름 · 지면 · 교통량)은 🌙 ENV 에서 고릅니다.</div></div>`;
}
const SET_KEYS = ['appSet', 'envSet', 'scnList', 'fdrSaved', 'b206rad', 'shipMotion', 'simSound', 'autoMetarOn'];
function settingsExport() {
  const o = {}; SET_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) o[k] = v; } catch (e) { _swallow(e); } });
  try { if (typeof fdrSavedList === 'function' && fdrSavedList().length) o.fdrSaved = JSON.stringify(fdrSavedList()); } catch (e) { _swallow(e); }   // 저장 비행은 IndexedDB
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })); a.download = 'shinesong-settings.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return o;
}
function settingsImport(text) {
  let n = 0; try { const o = JSON.parse(text); for (const k of SET_KEYS) if (typeof o[k] === 'string') { if (k === 'fdrSaved' && typeof fdrSavedReplace === 'function') fdrSavedReplace(JSON.parse(o[k])); else localStorage.setItem(k, o[k]); n++; } } catch (e) { _swallow(e); }
  try { uiToast(n ? `설정 ${n}가지를 들여왔습니다 — 다시 열면 반영됩니다` : '설정 파일을 읽지 못했습니다', n ? '' : 'err'); } catch (e) { _swallow(e); }
  return n;
}
function settingsReset() { SET_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { _swallow(e); } }); try { if (typeof fdrSavedReplace === 'function') fdrSavedReplace([]); } catch (e) { _swallow(e); } try { uiToast('설정을 지웠습니다 — 다시 열면 처음 상태입니다'); } catch (e) { _swallow(e); } }

// ── ⑥ 도구 메뉴(🧰) — 작은 화면(폭 900 · 높이 700 아래)에서는 낱 단추 대신 이 메뉴 하나로 ──
const TOOLS = [['🎬 시나리오', 'toggleScenario'], ['🌙 환경', 'toggleEnvPanel'], ['📋 강평', 'toggleDebrief'], ['🧑‍✈️ Instructor View', 'openIos'], ['📱 Instructor Sync', 'toggleRemoteIos'], ['⚙ 설정', 'toggleSettings'], ['🩺 진단 기록', 'toggleDiag'], ['📘 교관 교범', 'openManual'], ['❓ 도움말', 'toggleHelp']];
function toggleTools(ev) {
  let m = document.getElementById('tools-menu');
  if (m && m.style.display === 'block') { m.style.display = 'none'; return; }
  if (!m) {
    m = document.createElement('div'); m.id = 'tools-menu';
    m.innerHTML = TOOLS.map(([t, f]) => `<button class="sim-btn" data-tool="${f}">${t}</button>`).join('');
    document.body.appendChild(m);
    m.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (!b) return; m.style.display = 'none'; try { const fn = window[b.dataset.tool]; if (typeof fn === 'function') fn(); } catch (er) { _swallow(er); } });
    document.addEventListener('pointerdown', e => { if (m.style.display === 'block' && !m.contains(e.target) && !e.target.closest('[data-act="toggleTools"]')) m.style.display = 'none'; }, true);
  }
  // 누른 단추 곁에 연다 — 이벤트가 없으면(단추 위임) 지금 보이는 🧰 단추를 찾는다
  const evT = (ev && ev.target) || (window.event && window.event.target);
  const src = (evT && evT.closest && evT.closest('[data-act="toggleTools"]')) || [...document.querySelectorAll('[data-act="toggleTools"]')].find(b => b.offsetParent);
  const r = src ? src.getBoundingClientRect() : { left: 20, top: 60, bottom: 60, right: 200 };
  m.style.display = 'block';
  const mw = m.offsetWidth || 180, mh = m.offsetHeight || 260;
  m.style.left = Math.max(6, Math.min(window.innerWidth - mw - 6, r.right - mw)) + 'px';
  // 아래 자리가 모자라면(지도 창 아래 단추 줄) 단추 위로 연다
  const below = r.bottom + 4, above = r.top - mh - 4;
  m.style.top = Math.max(6, below + mh <= window.innerHeight - 6 ? below : above) + 'px';
}

// ── ⑦ 다른 기기 교관 연결(WebRTC 데이터 통로) — 메인 기기는 PC 일 수도 있어 카메라를 쓰지 않는다 ──
//   ① 메인(교육생) 기기(🧰 도구 → 📱 Instructor Sync): [연결 요청] → 화면에 QR
//   ② 교관 태블릿(교관 화면 📱): [📷 교육생 QR 찍어 잇기] → 카메라로 찍으면 연결을 청한다
//   ③ 메인 기기에 '교관 기기가 연결을 청합니다 [수락] [거절]' 창 → 수락하면 바로 이어진다
//   태블릿의 답(연결 정보)은 QR 에 든 일회용 방 이름으로 공개 중계(ntfy.sh)를 거쳐 메인 기기에 닿는다 —
//   QR 에 든 열쇠로 암호화(AES-GCM)해 보내므로 중계는 내용을 읽지 못한다. 비행 내용은 이어진 뒤 두 기기 사이로만 오간다.
//   중계가 막혔으면 아래 '코드로 잇기'(글자로 주고받기)로 잇는다.
//   같은 네트워크가 아니어도(다른 와이파이 · LTE) 온라인이면 이어진다 — 직접 통로가 막히면 인터넷 중계(MQTT · 암호화)로 주고받는다.
//   연결 정보(SDP)는 꼭 필요한 값(ICE 이름 · 암호 · 인증서 지문 · 주소)만 남겨 짧게 줄인다 — QR 한 장에 들어가게.
//   같은 와이파이면 바로 잇고, 다른 망이면 공개 STUN(구글) 서버로 길만 찾는다(비행 내용은 두 기기 사이로만 오간다)
const RTC_ICE = () => (Array.isArray(window._rtcIce) ? window._rtcIce : [{ urls: 'stun:stun.l.google.com:19302' }]);
const rtc = { pc: null, ch: null, open: false };
const _b64 = s => btoa(unescape(encodeURIComponent(s))), _unb64 = s => decodeURIComponent(escape(atob(s.trim())));
function _rtcWire(ch) {
  rtc.ch = ch;
  ch.onopen = () => { rtc.open = true; try { uiToast('다른 기기와 이어졌습니다(교관 연결)'); } catch (e) { _swallow(e); } qrScanStop(); _rtcRender(); };
  ch.onclose = () => { rtc.open = !!rtc.linkPeer; _rtcRender(); };   // 직접 통로가 끊겨도 중계가 있으면 이어진 채
  ch.onmessage = e => { let m = null; try { m = JSON.parse(e.data); } catch (er) { return; } _rtcOnData(m); };
}
// 받은 것 — 직접 통로(WebRTC)든 인터넷 중계든 같은 곳으로
function _rtcOnData(m) {
  if (!m) return;
  if (typeof IOS_MODE !== 'undefined' && IOS_MODE) { if (m.type === 'mirror') { if (typeof iosMirrorApply === 'function') iosMirrorApply(m); } else if (typeof iosRender === 'function') iosRender(m); }
  else if (typeof iosHandle === 'function') iosHandle(m);
}
function _rtcGather(pc) { return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }
// ── 연결 정보 줄이기 — 'SS1|o(또는 a)|ufrag|pwd|지문(base64)|setup|주소:포트:종류,…' ──
function sdpPack(desc) {
  const sdp = desc.sdp, g = re => { const m = sdp.match(re); return m ? m[1] : ''; };
  const fp = g(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/), fpB = btoa(String.fromCharCode(...fp.split(':').map(h => parseInt(h, 16))));
  const cands = [...sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ (host|srflx|relay)/gi)].map(m => `${m[1]}:${m[2]}:${m[3][0]}`);
  return ['SS1', desc.type === 'offer' ? 'o' : 'a', g(/a=ice-ufrag:(\S+)/), g(/a=ice-pwd:(\S+)/), fpB, g(/a=setup:(\S+)/), [...new Set(cands)].join(',')].join('|');
}
function sdpUnpack(str) {
  const p = String(str).trim().split('|'); if (p[0] !== 'SS1' || p.length < 7) throw new Error('연결 코드가 아닙니다');
  const fp = [...atob(p[4])].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(':');
  const cands = (p[6] ? p[6].split(',') : []).map((c, i) => {
    const k = c.lastIndexOf(':'), j = c.lastIndexOf(':', k - 1), ip = c.slice(0, j), port = c.slice(j + 1, k), t = { h: 'host', s: 'srflx', r: 'relay' }[c.slice(k + 1)] || 'host';
    return `a=candidate:${i + 1} 1 udp ${2122260223 - i * 1000} ${ip} ${port} typ ${t}${t !== 'host' ? ' raddr 0.0.0.0 rport 0' : ''}`;
  });
  const sdp = ['v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', `a=ice-ufrag:${p[2]}`, `a=ice-pwd:${p[3]}`, 'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${fp}`, `a=setup:${p[5]}`, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', ...cands, ''].join('\r\n');
  return { type: p[1] === 'o' ? 'offer' : 'answer', sdp };
}
// 종전의 긴 코드(base64 JSON)도 받는다
const _descFrom = code => /^SS1\|/.test(String(code).trim()) ? sdpUnpack(code) : JSON.parse(_unb64(code));
async function rtcOffer() {
  try { if (rtc.pc) rtc.pc.close(); } catch (e) { _swallow(e); }
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE() }); rtc.pc = pc; rtc.open = false;
  _rtcWire(pc.createDataChannel('ios'));
  pc.addEventListener('connectionstatechange', _rtcRender);
  await pc.setLocalDescription(await pc.createOffer()); await _rtcGather(pc);
  return sdpPack(pc.localDescription);
}
async function rtcAnswer(code) {
  try { if (rtc.pc) rtc.pc.close(); } catch (e) { _swallow(e); }
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE() }); rtc.pc = pc; rtc.open = false;
  pc.ondatachannel = e => _rtcWire(e.channel);
  pc.addEventListener('connectionstatechange', _rtcRender);
  await pc.setRemoteDescription(_descFrom(code));
  await pc.setLocalDescription(await pc.createAnswer()); await _rtcGather(pc);
  return sdpPack(pc.localDescription);
}
async function rtcAccept(code) { await rtc.pc.setRemoteDescription(_descFrom(code)); }
// ── 중계(일회용 방) · 암호 ──
const RTC_RELAY_URL = 'https://ntfy.sh';
const _ntfyRelay = {
  sub(topic, on) {
    const es = new EventSource(`${RTC_RELAY_URL}/${topic}/sse`);
    es.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m && typeof m.message === 'string' && (!m.event || m.event === 'message')) on(m.message); } catch (er) { _swallow(er); } });
    return () => { try { es.close(); } catch (er) { _swallow(er); } };
  },
  pub(topic, text) { return fetch(`${RTC_RELAY_URL}/${topic}`, { method: 'POST', body: text }).then(r => { if (!r.ok) throw new Error('중계 ' + r.status); }); },
};
const rtcRelay = () => window._rtcRelay || _ntfyRelay;           // 검사는 window._rtcRelay 로 바꿔 낀다
const _u8b64 = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const _b64u8 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function _rtcKey(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function rtcEnc(keyB64, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), k = await _rtcKey(_b64u8(keyB64));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return _u8b64(out);
}
async function rtcDec(keyB64, b64) {
  const all = _b64u8(b64), k = await _rtcKey(_b64u8(keyB64));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, k, all.slice(12)));
}
// 메인 — 연결 요청: 'SS2|방|열쇠|요청 코드' 를 QR 로 · 방을 듣다가 태블릿의 답이 오면 수락/거절 창
async function rtcRequest() {
  rtcRoomClose();
  const offer = await rtcOffer();
  const room = 'shinesong-' + _u8b64(crypto.getRandomValues(new Uint8Array(9))).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  const key = _u8b64(crypto.getRandomValues(new Uint8Array(16)));
  rtc.room = room; rtc.key = key;
  rtc.unsub = rtcRelay().sub(room, async msg => {
    let ans = null; try { ans = await rtcDec(key, msg); } catch (e) { return; }            // 다른 사람 · 잘못된 것은 버린다
    if (!/^SS1\|a\|/.test(ans) || rtc.open) return;
    rtcAsk(ans);
  });
  return `SS2|${room}|${key}|${offer}`;
}
function rtcRoomClose() { try { if (rtc.unsub) rtc.unsub(); } catch (e) { _swallow(e); } rtc.unsub = null; }
// 메인 — '교관 기기가 연결을 청합니다' [수락] [거절]
function rtcAsk(ans) {
  let w = document.getElementById('rtc-ask');
  if (!w) {
    w = document.createElement('div'); w.id = 'rtc-ask';
    w.innerHTML = '<div class="set-box rtc-askbox"><div class="set-bar"><b>📱 교관 기기 연결 요청</b></div><div class="rtc-steps">교관 기기가 이 기기와 연결을 청합니다.<br>수락하면 교관이 고장 · 환경 · 메시지를 걸 수 있습니다.</div>' +
      '<div class="rtc-btns"><button class="sim-btn on rtc-big" data-rtcask="ok">수락</button><button class="sim-btn rtc-big" data-rtcask="no">거절</button></div></div>';
    document.body.appendChild(w);
    w.addEventListener('click', async e => {
      const b = e.target.closest('[data-rtcask]'); if (!b) return;
      const a = w._ans; w.style.display = 'none'; w._ans = null;
      if (b.dataset.rtcask === 'ok' && a) {
        try { await rtcAccept(a); rtcReply('ok'); rtcLinkStart(); } catch (er) { _swallow(er); try { uiToast('잇지 못했습니다 — 처음부터 다시 연결 요청을 누르십시오', 'err'); } catch (e2) { _swallow(e2); } }
      } else { rtcReply('no'); try { uiToast('교관 기기 연결을 거절했습니다'); } catch (er) { _swallow(er); } }
      _rtcRender();
    });
  }
  w._ans = ans; w.style.display = 'flex';
}
function rtcReply(v) { const room = rtc.room, key = rtc.key; if (!room) return; rtcEnc(key, v).then(t => rtcRelay().pub(room + '-r', t)).catch(_swallow); if (v === 'ok') rtcRoomClose(); }
// 태블릿 — 찍은 'SS2|…' 로 답을 만들어 중계로 보낸다 · 메인이 거절하면 알린다. 중계가 막혔으면 답 코드를 돌려준다(글자로 잇기)
async function rtcJoin(qr) {
  const p = String(qr).trim().split('|'); if (p[0] !== 'SS2' || p.length < 4) throw new Error('교관 연결 QR 이 아닙니다');
  const room = p[1], key = p[2], offer = p.slice(3).join('|');
  const ans = await rtcAnswer(offer);
  rtcRoomClose(); rtc.room = room; rtc.key = key;
  rtc.unsub = rtcRelay().sub(room + '-r', async msg => {
    let v = null; try { v = await rtcDec(key, msg); } catch (e) { return; }
    if (v === 'no') { try { uiToast('교육생 기기가 연결을 거절했습니다', 'warn', 4000); } catch (e) { _swallow(e); } try { rtc.pc.close(); } catch (e) { _swallow(e); } rtc.pc = null; }
    else if (v === 'ok') rtcLinkStart();                                   // 수락 — 직접 통로가 막혀도 인터넷 중계로 이어지게
    rtcRoomClose(); _rtcRender();
  });
  try { await rtcRelay().pub(room, await rtcEnc(key, ans)); return { sent: true, ans }; }
  catch (e) { _swallow(e); return { sent: false, ans }; }
}
function rtcP2pOpen() { return !window._rtcForceRelay && !!rtc.ch && rtc.ch.readyState === 'open'; }
function rtcSend(m) {
  try {
    if (rtcP2pOpen()) { rtc.ch.send(JSON.stringify(m)); return; }
    if (rtc.link && rtc.link.ready) {                                    // 직접 통로가 없으면 인터넷 중계로 — 미러는 0.6초에 한 번으로 줄인다
      if (m && m.type === 'mirror') {                                     // 미러는 바뀐 것만 오니 버리지 않고 모아서 0.6초에 한 번
        const P = rtc._mirPend || (rtc._mirPend = { type: 'mirror', S: {}, g: {}, ov: {} });
        Object.assign(P.S, m.S || {}); Object.assign(P.g, m.g || {}); Object.assign(P.ov, m.ov || {}); if (m.full) P.full = true;
        if (!rtc._mirTimer) rtc._mirTimer = setTimeout(() => {
          const out = rtc._mirPend; rtc._mirPend = null; rtc._mirTimer = null; rtc._mirT = Date.now();
          if (out && rtc.link && rtc.link.ready) rtcEnc(rtc.key, JSON.stringify(out)).then(t => rtc.link.pub(t)).catch(_swallow);
        }, Math.max(0, 600 - (Date.now() - (rtc._mirT || 0))));
        rtc._mirT = rtc._mirT || 0;
        return;
      }
      rtcEnc(rtc.key, JSON.stringify(m)).then(t => rtc.link.pub(t)).catch(_swallow);
    }
  } catch (e) { _swallow(e); }
}

// ── 인터넷 중계(다른 네트워크) — 두 기기가 같은 와이파이가 아니면 WebRTC 직접 연결이 통신사 NAT · 방화벽에 막히곤 한다 ──
//   짝을 맺은 뒤(QR · 수락) 두 기기가 공개 MQTT 중계(웹소켓)의 같은 방 이름에 붙어 서로 주고받는다.
//   내용은 QR 의 열쇠로 암호화(AES-GCM)해 중계는 읽지 못한다. 직접 통로가 열리면 그쪽을 쓰고, 막히면 중계로 계속 간다.
const RTC_MQTT_URLS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081'];
// MQTT 3.1.1(QoS 0) 아주 작은 부분만 — CONNECT · SUBSCRIBE · PUBLISH · PINGREQ
const _mq = {
  str(t) { const b = new TextEncoder().encode(t); return [b.length >> 8, b.length & 255, ...b]; },
  len(n) { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; },
  pkt(type, body) { return new Uint8Array([type, ..._mq.len(body.length), ...body]); },
  connect(id) { return _mq.pkt(0x10, [..._mq.str('MQTT'), 4, 0x02, 0, 60, ..._mq.str(id)]); },
  subscribe(topic) { return _mq.pkt(0x82, [0, 1, ..._mq.str(topic), 0]); },
  publish(topic, text) { return _mq.pkt(0x30, [..._mq.str(topic), ...new TextEncoder().encode(text)]); },
  // 받은 바이트를 패킷으로 — [{ type, topic, text }] · 남은 조각은 buf 에 둔다
  parse(st) {
    const out = [], b = st.buf;
    let i = 0;
    while (i + 2 <= b.length) {
      let mul = 1, n = 0, j = i + 1, d;
      do { if (j >= b.length) return out; d = b[j++]; n += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (j + n > b.length) break;
      const type = b[i] & 0xf0, body = b.subarray(j, j + n);
      if (type === 0x30) { const tl = (body[0] << 8) | body[1]; out.push({ type, topic: new TextDecoder().decode(body.subarray(2, 2 + tl)), text: new TextDecoder().decode(body.subarray(2 + tl)) }); }
      else out.push({ type });
      i = j + n;
    }
    st.buf = b.slice(i);
    return out;
  },
};
// 링크 하나 — rx 방을 듣고 tx 방으로 보낸다. 검사는 window._rtcLinkFactory 로 바꿔 낀다
function rtcLinkOpen(rx, tx, onText) {
  if (typeof window._rtcLinkFactory === 'function') return window._rtcLinkFactory(rx, tx, onText);
  const L = { ready: false, closed: false, ws: null, ping: null, pub(t) { if (L.ready) try { L.ws.send(_mq.publish(tx, t)); } catch (e) { _swallow(e); } },
    close() { L.closed = true; clearInterval(L.ping); try { L.ws.close(); } catch (e) { _swallow(e); } } };
  let k = 0;
  const go = () => {
    if (L.closed) return;
    if (k >= RTC_MQTT_URLS.length) { k = 0; setTimeout(go, 5000); return; }      // 모두 안 되면 5초 뒤 처음부터
    let ws; try { ws = new WebSocket(RTC_MQTT_URLS[k++], ['mqtt']); } catch (e) { _swallow(e); go(); return; }
    L.ws = ws; ws.binaryType = 'arraybuffer';
    const st = { buf: new Uint8Array(0) };
    ws.onopen = () => ws.send(_mq.connect('ss' + Math.random().toString(36).slice(2, 12)));
    ws.onmessage = e => {
      const nb = new Uint8Array(e.data), m = new Uint8Array(st.buf.length + nb.length); m.set(st.buf); m.set(nb, st.buf.length); st.buf = m;
      for (const p of _mq.parse(st)) {
        if (p.type === 0x20) { ws.send(_mq.subscribe(rx)); L.ready = true; clearInterval(L.ping); L.ping = setInterval(() => { try { ws.send(new Uint8Array([0xc0, 0])); } catch (er) { _swallow(er); } }, 30000); _rtcRender(); }
        else if (p.type === 0x30 && p.topic === rx) onText(p.text);
      }
    };
    ws.onclose = () => { const was = L.ready; L.ready = false; clearInterval(L.ping); if (!L.closed) setTimeout(go, was ? 1000 : 0); _rtcRender(); };   // 끊기면 다시(다음 중계로)
    ws.onerror = () => { try { ws.close(); } catch (e) { _swallow(e); } };
  };
  go();
  return L;
}
// 짝을 맺은 뒤 두 기기가 중계에 붙는다(메인: 수락할 때 · 태블릿: 수락 알림을 받을 때)
function rtcLinkStart() {
  if (!rtc.room || !rtc.key) return;
  // 짝을 기억한다 — 새로고침 · 잠깐 꺼짐 뒤에도 묻지 않고 다시 이어진다(12시간 · '연결 끊기' 로 지운다)
  try { localStorage.setItem('rtcPair', JSON.stringify({ room: rtc.room, key: rtc.key, t: Date.now() })); } catch (e) { _swallow(e); }
  try { if (rtc.link) rtc.link.close(); } catch (e) { _swallow(e); }
  const ios = typeof IOS_MODE !== 'undefined' && IOS_MODE, base = 'shinesong/' + rtc.room;
  rtc.linkPeer = false;
  rtc.link = rtcLinkOpen(base + (ios ? '/m2i' : '/i2m'), base + (ios ? '/i2m' : '/m2i'), async text => {
    let m = null; try { m = JSON.parse(await rtcDec(rtc.key, text)); } catch (e) { return; }
    if (!rtc.linkPeer) { rtc.linkPeer = true; if (!rtcP2pOpen()) { rtc.open = true; try { uiToast('다른 기기와 이어졌습니다(인터넷 중계)'); } catch (e) { _swallow(e); } qrScanStop(); } _rtcRender(); }
    if (m.type === 'hello') return;
    if (!rtcP2pOpen()) _rtcOnData(m);                                    // 직접 통로가 열려 있으면 그쪽 것만 쓴다(겹침 방지)
  });
  // 서로 있음을 알린다(중계로만 이어질 때 첫 소식)
  let n = 0; const hi = setInterval(() => { if (rtc.linkPeer || ++n > 30 || !rtc.link) { clearInterval(hi); return; } if (rtc.link.ready) rtcEnc(rtc.key, JSON.stringify({ type: 'hello' })).then(t => rtc.link && rtc.link.pub(t)).catch(_swallow); }, 1000);
}

// Instructor Sync 다시 잇기 — 기억해 둔 짝(rtcPair)이 12시간 안이면 앱을 열 때 인터넷 중계로 곧바로 다시 붙는다
//   (중계가 끊겨도 rtcLinkOpen 이 다음 중계로 계속 다시 붙는다 · 미러는 상대가 다시 보이면 전체를 한 번 보낸다)
const RTC_PAIR_MS = 12 * 3600 * 1000;
function rtcPairForget() {
  try { localStorage.removeItem('rtcPair'); } catch (e) { _swallow(e); }
  try { if (rtc.link) rtc.link.close(); } catch (e) { _swallow(e); }
  rtc.link = null; rtc.linkPeer = false; rtc.open = false; rtc.room = null; rtc.key = null;
  try { if (rtc.pc) rtc.pc.close(); } catch (e) { _swallow(e); } rtc.pc = null; rtc.ch = null;
  try { _rtcRender(); } catch (e) { _swallow(e); }
  try { uiToast('Instructor Sync — 연결을 끊고 짝을 지웠습니다'); } catch (e) { _swallow(e); }
}
function rtcResume() {
  let p = null; try { p = JSON.parse(localStorage.getItem('rtcPair') || 'null'); } catch (e) { p = null; }
  if (!p || !p.room || !p.key || !(Date.now() - (p.t || 0) < RTC_PAIR_MS)) return false;
  if (rtc.link) return true;
  rtc.room = p.room; rtc.key = p.key; rtcLinkStart();
  return true;
}
setTimeout(() => { try { rtcResume(); } catch (e) { _swallow(e); } }, 1500);
// ── QR — 만들기(vendor/qrcode.js) · 읽기(BarcodeDetector 가 있으면 그것, 없으면 vendor/jsQR.js) — 필요할 때만 읽어 온다 ──
const _jsLoaded = {};
function _loadJs(src) {
  if (_jsLoaded[src]) return _jsLoaded[src];
  return (_jsLoaded[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete _jsLoaded[src]; no(new Error('불러오지 못함: ' + src)); }; document.head.appendChild(s); }));
}
async function qrSvg(text) {
  if (typeof qrcode !== 'function') await _loadJs('vendor/qrcode.js');
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 3 });
}
async function qrDecode(imgData) {
  if (typeof jsQR !== 'function') await _loadJs('vendor/jsQR.js');
  const r = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
  return r ? r.data : null;
}
let _qrScan = null;
// 카메라로 'SS1|' · 'SS2|' 로 시작하는 QR 을 찾을 때까지 본다 — host 안에 화면을 띄운다
async function qrScan(host) {
  qrScanStop();
  const v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.className = 'rtc-cam';
  host.innerHTML = ''; host.appendChild(v);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  v.srcObject = stream; await v.play();
  const st = { stream, stop: false }; _qrScan = st;
  const det = ('BarcodeDetector' in window) ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  return new Promise((ok, no) => {
    st.reject = no;
    const tick = async () => {
      if (st.stop) return;
      try {
        let txt = null;
        if (det) { const r = await det.detect(v); txt = r && r[0] ? r[0].rawValue : null; }
        else if (v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; g.drawImage(v, 0, 0); txt = await qrDecode(g.getImageData(0, 0, cv.width, cv.height)); }
        if (txt && /^SS[12]\|/.test(txt)) { qrScanStop(); host.innerHTML = ''; ok(txt); return; }
      } catch (e) { _swallow(e); }
      setTimeout(tick, 200);
    };
    tick();
  });
}
function qrScanStop() { const st = _qrScan; _qrScan = null; if (!st) return; st.stop = true; try { st.stream.getTracks().forEach(t => t.stop()); } catch (e) { _swallow(e); } }

// ── 연결 창 ──
function toggleRemoteIos() {
  let w = document.getElementById('rtc-wrap');
  if (w && w.style.display === 'flex') { qrScanStop(); w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'rtc-wrap';
    const ios = typeof IOS_MODE !== 'undefined' && IOS_MODE;
    w.innerHTML = `<div class="set-box rtc-box"><div class="set-bar"><b>${ios ? '📱 교육생 기기와 잇기' : '📱 Instructor Sync'}</b><button class="sim-btn" data-rtc="x">✕</button></div>
      <div class="rtc-steps">${ios
        ? '<div>교육생(메인) 기기에서 <b>🧰 도구 → 📱 Instructor Sync → [연결 요청]</b>을 누르면 QR 이 나옵니다.</div><div>아래 <b>[📷 교육생 QR 찍어 잇기]</b>를 누르고 그 QR 을 찍습니다.</div><div>교육생 기기에서 <b>[수락]</b>을 누르면 이어집니다.</div>'
        : '<div><b>[연결 요청]</b>을 누르면 QR 이 나옵니다.</div><div>교관 태블릿의 교관 화면에서 <b>[📷 교육생 QR 찍어 잇기]</b>로 이 QR 을 찍습니다.</div><div>이 기기에 뜨는 창에서 <b>[수락]</b>을 누르면 바로 이어집니다.</div>'}</div>
      <div class="rtc-btns">${ios ? '<button class="sim-btn on rtc-big" data-rtc="join">📷 교육생 QR 찍어 잇기</button>'
        : '<button class="sim-btn on rtc-big" data-rtc="request">연결 요청</button>'}</div>
      <div class="rtc-view" data-rtcv="view"></div>
      <div class="set-note rtc-st" data-rtcv="st"></div>
      <div class="rtc-btns"><button class="sim-btn" data-rtc="forget" title="기억해 둔 짝을 지운다 — 다음에는 처음부터 연결 요청">연결 끊기</button></div>
      <details class="rtc-txt"><summary>카메라가 없을 때 — 코드로 잇기</summary>
        <div class="set-row"><textarea data-rtcv="out" readonly placeholder="${ios ? '여기 나온 답 코드를 교육생 기기로' : '여기 나온 요청 코드를 교관 기기로'}"></textarea></div>
        <div class="set-row"><button class="sim-btn" data-rtc="copy">복사</button><button class="sim-btn" data-rtc="share">공유</button></div>
        <div class="set-row"><textarea data-rtcv="in" placeholder="${ios ? '교육생 기기의 요청 코드를 붙여 넣기' : '교관 기기의 답 코드를 붙여 넣기'}"></textarea></div>
        <div class="set-row"><button class="sim-btn" data-rtc="${ios ? 'acceptTxt' : 'finishTxt'}">${ios ? '수락(답 코드 만들기)' : '연결'}</button></div>
      </details></div>`;
    document.body.appendChild(w);
    const view = w.querySelector('[data-rtcv="view"]'), out = w.querySelector('[data-rtcv="out"]'), inp = w.querySelector('[data-rtcv="in"]');
    const showQr = async (code, msg) => { out.value = code; view.innerHTML = `<div class="rtc-qr">${await qrSvg(code)}</div><div class="set-note">${msg}</div>`; };
    w.addEventListener('click', async e => {
      const b = e.target.closest('[data-rtc]'); if (!b) { if (e.target === w) { qrScanStop(); w.style.display = 'none'; } return; }
      const k = b.dataset.rtc;
      try {
        if (k === 'x') { qrScanStop(); w.style.display = 'none'; return; }
        if (k === 'forget') { rtcPairForget(); return; }
        if (k === 'request') {
          view.innerHTML = '<div class="set-note">요청 QR 을 만드는 중…</div>';
          const q = await rtcRequest(); await showQr(q, '교관 태블릿의 <b>[📷 교육생 QR 찍어 잇기]</b>로 이 QR 을 찍게 하세요. 찍으면 이 기기에 <b>수락</b> 창이 뜹니다.');
          out.value = q.split('|').slice(3).join('|');                     // 글자로 잇기 — 요청 코드(SS1)
        }
        else if (k === 'join') {
          const code = await qrScan(view);
          if (/^SS1\|/.test(code)) { view.innerHTML = ''; await showQr(await rtcAnswer(code), '옛 방식 QR 입니다 — 이 답 QR(코드)을 교육생 기기로 보내세요.'); }
          else {
            view.innerHTML = '<div class="set-note">교육생 QR 을 읽었습니다 — 연결을 청하는 중…</div>';
            const r = await rtcJoin(code);
            if (r.sent) view.innerHTML = '<div class="set-note">교육생 기기의 <b>수락</b>을 기다리는 중… (교육생 기기 화면에 수락 창이 떴습니다)</div>';
            else { await showQr(r.ans, '중계에 닿지 못했습니다(인터넷 확인) — 아래 답 코드를 교육생 기기의 "코드로 잇기"에 붙여 넣으십시오.'); const d = w.querySelector('details.rtc-txt'); if (d) d.open = true; }
          }
        }
        else if (k === 'acceptTxt') await showQr(await rtcAnswer(inp.value), '이 QR(또는 위 답 코드)을 교육생 기기로 보내세요.');
        else if (k === 'finishTxt') await rtcAccept(inp.value);
        else if (k === 'copy') { await navigator.clipboard.writeText(out.value); uiToast('복사했습니다'); }
        else if (k === 'share') { if (navigator.share) await navigator.share({ text: out.value }); else { await navigator.clipboard.writeText(out.value); uiToast('공유를 쓸 수 없어 복사했습니다'); } }
      } catch (er) {
        _swallow(er);
        const msg = /Permission|NotAllowed/i.test(String(er && er.name) + er) ? '카메라를 쓸 수 없습니다 — 브라우저의 카메라 허용을 켜거나 아래 "코드로 잇기"를 쓰십시오'
          : /NotFound|Devices/i.test(String(er && er.name) + er) ? '카메라가 없습니다 — 아래 "코드로 잇기"를 쓰십시오' : (er && er.message) || '연결 코드가 맞지 않습니다';
        try { uiToast(msg, 'err', 4000); } catch (e2) { _swallow(e2); }
      }
      _rtcRender();
    });
  }
  w.style.display = 'flex'; _rtcRender();
}
function _rtcRender() {
  const s = document.querySelector('#rtc-wrap [data-rtcv="st"]'); if (!s) return;
  const cs = rtc.pc ? rtc.pc.connectionState : '';
  const via = rtcP2pOpen() ? '직접 연결' : rtc.linkPeer ? '인터넷 중계' : '';
  s.textContent = rtc.open ? `● 이어졌습니다${via ? '(' + via + ')' : ''} — 이 창을 닫아도 됩니다`
    : cs === 'failed' && !(rtc.link && rtc.link.ready) ? '✕ 잇지 못했습니다 — 두 기기가 인터넷에 이어져 있는지 보고 처음부터 다시'
    : rtc.link && rtc.link.ready ? '○ 인터넷 중계로 잇는 중…' : rtc.pc ? '○ 기다리는 중…' : '';
  s.classList.toggle('ok', rtc.open);
}
try { appRegister({ toggleSettings, toggleTools, toggleRemoteIos, envMetarNearest }); } catch (e) { _swallow(e); }
