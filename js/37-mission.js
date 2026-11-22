'use strict';
// ══════════════════════════════════════════════════════
// 37-mission.js — 흰수리 전탐석(전술 임무 조작석 · MISSION CONSOLE)
//
// 시작 화면에서 기종 '흰수리 전탐석'(00-aircraft.js kuhm — 흰수리 aw189 갈래)을 고르면 이 화면이 뜬다.
// 기체는 흰수리 그대로 난다(비행계획 · 자동비행 · 교관 창) — 전탐석은 그 위에서 세 장비를 다룬다.
//   ① EO/IR 터릿(FLIR) — 3D 지형 위에 터릿 시선(방위 · 고각)과 화각으로 그린 영상 + MFD 오버레이
//      센서 EOW(광각 연속 줌) · EON(협각 단계 줌 · DL/LL) · IR(열영상 WHT/BLK) · 전자 줌 1 · 1.5 · 2 · 4X
//      조종 MAN(수동 rate) · AID(지면 고정 보조) · AUTO(지리 좌표 고정) · AVT(자동영상추적) · SLEW(표적 · POI 지향) · FWD · STOW
//      LRF(1회 · 2초 누름 연속) · LASER(ARMED 일 때) · GEO FOCUS · FOCUS · SENS · OFFSET · FILTER · SCENE · IR CAL · POL
//   ② SAR 해상 수색 레이더 — PPI(2.5초에 한 바퀴) · 거리 2~40NM · 이득 · 해면 반사 억제(STC) · 우천 억제(FTC) · HUP/NUP
//      표적(선박 · 함정 · 요구조자 · 항공기)을 누르면 지정 → 침로 · 속력(추적) → EO/IR · 서치라이트를 그리로
//   ③ 서치라이트(35-kuhgrip.js kgLt) — 수동 · EO/IR 연동(시선 따라) · 레이더 표적 연동
// 조작기(HCU) — 교범 그림(면판 17개 · 상부 버튼 14개)대로 화면에 그렸고, 조이스틱 버튼에도 배정할 수 있다(12-joystick.js).
// 기준: KUH-1CG 비행교범(FLM 5.17) · 계통설명교범(SDS 23-71-00) — EO/IR HCU · MFD 오버레이 요약
// 3D 전탐석 콘솔 모형은 사진을 받은 뒤 얹는다(지금은 MFD 테두리 · 콘솔 판 모양).
// ══════════════════════════════════════════════════════
const MSN_ON = typeof acExact === 'function' && acExact('kuhm');
const EO_ON = typeof acIs === 'function' && acIs('aw189');   // 흰수리 갈래 — EO/IR 영상은 조종석 SYSTEM 창에도 나온다
const MSN_RE = 6371000 * 4 / 3;                     // 대기 굴절을 넣은 지구 반지름(m) — 시선 · 레이더 수평선
const _mD = Math.PI / 180;
const _mClamp = (v, a, b) => Math.max(a, Math.min(b, v));
function _mGndFt(lat, lon) { let f = null; try { f = terrainFtAt(lat, lon); } catch (e) { f = null; } return Number.isFinite(f) ? f : 0; }
function _mWater(lat, lon) { try { const m = _tcElev(lat, lon); return m == null || m <= 1; } catch (e) { return true; } }
function _mAltM() { return Math.max(0, Number(S.alt) || 0) * 0.3048; }

// ══ ① EO/IR 터릿 ══
const EO_SENSORS = ['EOW', 'EON', 'IR'];
const EO_FOV = { EOW: [30, 1.6], EON: [1.2, 0.6, 0.3], IR: [25, 8, 2.4, 0.8] };   // EOW: 연속 줌(넓게 ~ 좁게) · EON · IR: 단계(가로 화각 °)
const EO_EZ = [1, 1.5, 2, 4];
const EO_GATES = ['SMALL', 'MEDIUM', 'LARGE', 'X-LARGE'], EO_GATE_K = { SMALL: 0.06, MEDIUM: 0.1, LARGE: 0.16, 'X-LARGE': 0.25 };   // 화면 너비 몫
const EO_ALGS = ['CENT', 'COR-M', 'COR-A', 'SCENE'];
const EO_FILTS = ['CLR', 'LP', 'XLP', 'ND'];
const EO_SCENES = ['NORM', 'HAZE', 'LOW CON', 'HIGH CON'];
const EO_RATE = 40;                                  // 조이스틱 끝까지 — 넓은 화각에서 °/s
const EO_DRIVE = 60;                                 // 자동 구동(FWD · STOW · SLEW · 고정) °/s
const LRF_MAX_M = 20000;
const eo = {
  pwr: true, mode: 'FWD', sensor: 'EOW', ll: false, fovW: 30, step: { EON: 0, IR: 0 }, ez: 1, pol: 'WHT',
  gate: 'LARGE', irGate: 'LARGE', alg: 'CENT', trk: 'IDLE', trkT: 0, lock: null, az: 0, el: -5, fwd: { az: 0, el: -5 },
  aid: false, zmulti: true, imgAuto: true, filt: 'LP', sens: 50, off: 50, scene: 'NORM', focus: 50, geo: true, geoTrim: 0,
  lrf: { st: 'OFF', rng: null, t: 0, cont: false, pt: null, contT: 0 }, laserArm: false, laserFire: false, cal: 0,
  poi: -1, slewTgt: null, menu: false, menuI: 0, pip: 'OFF', ctrl: 'OPR', tx: false, units: 'NM', joy: { x: 0, y: 0 }, hold: {}, holdT: {},
};
function eoFovBase() { return eo.sensor === 'EOW' ? eo.fovW : EO_FOV[eo.sensor][eo.step[eo.sensor]]; }
function eoFov() { return eoFovBase() / eo.ez; }                                    // 가로 화각(°)
function eoFocalMm() { const w = eo.sensor === 'IR' ? 12.8 : 9.6; return w / (2 * Math.tan(eoFovBase() / 2 * _mD)); }
function eoSensorLabel() { return eo.sensor === 'IR' ? `IR ${eo.pol}` : eo.sensor === 'EON' ? `EON ${eo.ll ? 'LL' : 'DL'}` : 'EOW'; }

// 시선(방위 az: 기수 기준 · 고각 el: 수평 기준)이 땅 · 바다에 닿는 자리 — 굴절 지구 · 지형
const _losC = { k: '', t: 0, v: null };
function eoLosPoint(az = eo.az, el = eo.el) {
  if (!(el < -0.05)) return null;
  const key = `${az.toFixed(3)},${el.toFixed(3)},${S.lat.toFixed(6)},${S.lon.toFixed(6)},${Math.round(S.alt)},${S.hdg.toFixed(2)}`, now = performance.now();
  if (_losC.k === key && now - _losC.t < 200) return _losC.v;
  const v = _eoLos(az, el); _losC.k = key; _losC.t = now; _losC.v = v;
  return v;
}
function _eoLos(az, el) {
  const brg = normA(S.hdg + az), h0 = _mAltM(), t = Math.tan(-el * _mD);
  const above = d => { const [la, lo] = destPoint(S.lat, S.lon, brg, d / 1852); return { la, lo, dh: h0 - d * t - (_mGndFt(la, lo) * 0.3048 - d * d / (2 * MSN_RE)) }; };
  let a = 0, d = 15;
  for (let i = 0; i < 160 && d < 80000; i++) {
    const p = above(d);
    if (p.dh <= 0) {
      let lo = a, hi = d, q = p;
      for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2, r = above(m); if (r.dh <= 0) { hi = m; q = r; } else lo = m; }
      const g = _mGndFt(q.la, q.lo) * 0.3048, hd = hi;
      return { lat: q.la, lon: q.lo, hM: g, rng: Math.hypot(hd, h0 - g), gnd: hd };
    }
    a = d; d *= 1.07;
  }
  return null;
}
// 기체에서 그 자리(높이 hM)를 보는 터릿 각
function eoAngTo(lat, lon, hM) {
  const d = distance(S.lat, S.lon, lat, lon) * 1852, brg = bearing(S.lat, S.lon, lat, lon);
  const dh = (hM || 0) - d * d / (2 * MSN_RE) - _mAltM();
  return { az: normAS(brg - S.hdg), el: Math.atan2(dh, Math.max(1, d)) / _mD, rng: Math.hypot(d, dh), brg };
}
function _eoDrive(az, el, dt, rate = EO_DRIVE) {
  const da = normAS(az - eo.az), de = el - eo.el, m = rate * dt;
  eo.az = normAS(eo.az + _mClamp(da, -m, m)); eo.el = _mClamp(eo.el + _mClamp(de, -m, m), -90, 20);
  return Math.abs(da) < 0.05 && Math.abs(de) < 0.05;
}
// 고정 대상(lock) — { kind: 'geo', lat, lon, hM } 또는 { kind: 'obj', id }
function eoLockPos(L = eo.lock) {
  if (!L) return null;
  if (L.kind === 'geo') return L;
  const c = msnContacts().find(x => x.id === L.id);
  return c ? { lat: c.lat, lon: c.lon, hM: c.hM, obj: c } : null;
}
function _eoGeoHere() { const p = eoLosPoint(); return p ? { kind: 'geo', lat: p.lat, lon: p.lon, hM: p.hM } : null; }
// 지금 LOS 가 가리키는 자리(고정 대상이 있으면 그 자리)
function eoAimPoint() { return eoLockPos() || eoLosPoint(); }

// 게이트 안의 물체(시선에서 게이트 반폭 안 · 가장 가까운 것)
function eoObjInGate() {
  const half = EO_GATE_K[eo.gate] * eoFov() / 2;
  let best = null, bd = half;
  for (const c of msnContacts()) {
    const a = eoAngTo(c.lat, c.lon, c.hM);
    if (a.rng > 30000) continue;
    const off = Math.hypot(normAS(a.az - eo.az) * Math.cos(eo.el * _mD), a.el - eo.el);
    if (off < bd) { bd = off; best = c; }
  }
  return best;
}

// ── HCU 조작 — 키(data-hcu) 하나의 누름 · 뗌 ──
const HCU_HOLD = ['zoom:up', 'zoom:dn', 'sens:up', 'sens:dn', 'off:up', 'off:dn', 'focus:up', 'focus:dn'];
function hcuPress(k, down) {
  const now = performance.now();
  if (down) { eo.holdT[k] = now; if (HCU_HOLD.includes(k)) eo.hold[k] = true; }
  else { delete eo.hold[k]; }
  const held = down ? 0 : (now - (eo.holdT[k] || now)) / 1000;
  if (!down) delete eo.holdT[k];
  try { _hcuAct(k, down, held); } catch (e) { _swallow(e); }
  msnRenderHcu();
}
function _hcuAct(k, down, held) {
  if (k === 'pwr') { if (down) { eo.pwr = !eo.pwr; if (!eo.pwr) { eo.lrf.st = 'OFF'; eo.lrf.cont = false; eo.laserFire = false; eo.trk = 'IDLE'; eo.lock = null; } else { eo.mode = 'FWD'; } _mNote(`EO/IR 전원 ${eo.pwr ? 'ON' : 'OFF'}`); } return; }
  if (!eo.pwr) return;
  // 메뉴가 열려 있으면 ZOOM 은 커서 · SENS 는 값 바꾸기(교범 Table 2 ①⑪)
  if (eo.menu && down && (k === 'zoom:up' || k === 'zoom:dn')) { delete eo.hold[k]; eo.menuI = (eo.menuI + (k === 'zoom:up' ? -1 : 1) + MSN_MENU.length) % MSN_MENU.length; return; }
  if (eo.menu && down && (k === 'sens:up' || k === 'sens:dn')) { delete eo.hold[k]; MSN_MENU[eo.menuI].set(k === 'sens:up' ? 1 : -1); return; }
  switch (k) {
    case 'vic:up': if (down) { const i = EO_SENSORS.indexOf(eo.sensor); eo.sensor = EO_SENSORS[(i + 1) % 3]; eo.ez = 1; } break;
    case 'vic:dn': if (down && eo.sensor === 'EON') eo.ll = !eo.ll; else if (down) eo.sensor = eo.sensor === 'IR' ? 'EOW' : 'IR'; break;   // SVIC — EON 이면 주광 · 저광 전환
    case 'avtg:up': if (down) eo.gate = EO_GATES[(EO_GATES.indexOf(eo.gate) + 1) % EO_GATES.length]; break;
    case 'avtg:dn': if (down) eo.alg = EO_ALGS[(EO_ALGS.indexOf(eo.alg) + 1) % EO_ALGS.length]; break;
    case 'steer:up': if (down) { eo.lock = _eoGeoHere(); eo.mode = eo.lock ? 'AUTO' : 'MAN'; eo.trk = 'IDLE'; } break;                // AUTO — 지금 보는 땅 · 바다 자리를 지리 좌표로 고정
    case 'steer:dn': if (down) { eo.mode = 'MAN'; eo.trk = 'IDLE'; eo.lock = null; eo.aid = false; eo.slewTgt = null; } break;      // MANUAL — 다른 모드를 모두 멈춘다
    case 'aid:up': if (down) { eo.aid = !eo.aid; if (eo.aid && eo.mode === 'MAN') eo.lock = _eoGeoHere(); } break;
    case 'aid:dn': if (down) eo.zmulti = !eo.zmulti; break;
    case 'slew:up': if (down) eoSlewPoi(); break;
    case 'slew:dn':
      if (down) { eo.mode = 'FWD'; eo.trk = 'IDLE'; eo.lock = null; eo.slewTgt = null; }
      else if (held >= 2) { eo.fwd = { az: eo.az, el: eo.el }; _mToast(`EO/IR — 새 전방 위치 ${eo.az.toFixed(1)}° · ${eo.el.toFixed(1)}°`); }
      break;
    case 'img:up': if (down) eo.imgAuto = !eo.imgAuto; break;
    case 'img:dn': if (down && eo.sensor !== 'IR') eo.filt = EO_FILTS[(EO_FILTS.indexOf(eo.filt) + 1) % EO_FILTS.length]; break;
    case 'pip:up': if (down) eo.pip = eo.pip === 'OFF' ? 'RDR' : 'OFF'; break;
    case 'pip:dn': if (down) eo.pip = eo.pip === 'OFF' ? 'RDR' : 'OFF'; break;
    case 'avt':
      if (down) {
        if (eo.mode !== 'AVT') { eo.mode = 'AVT'; eo.trk = 'ACQ'; eo.lock = _eoGeoHere(); eo.slewTgt = null; }
        else if (eo.trk === 'ACQ' || eo.trk === 'COAST') eoAvtLock();
        else if (eo.trk === 'LOCKED') { eo.trk = 'ACQ'; eo.lock = _eoGeoHere(); }
      } else if (held >= 1.5 && eo.mode === 'AVT') { eo.mode = 'MAN'; eo.trk = 'IDLE'; eo.lock = null; }
      break;
    case 'menu': if (down) { eo.menu = !eo.menu; } break;
    case 'laser': if (eo.laserArm) { eo.laserFire = down; if (down) _mNote('레이저 조사(LASER) — 발사'); } else if (down) _mToast('LASER — ARMED 가 아닙니다(MENU → LASER ARM)'); break;
    case 'geo': if (down) { eo.geo = !eo.geo; eo.geoTrim = 0; } break;
    case 'map': if (down) eoNextPoi(); break;
    case 'ez': if (down) eo.ez = EO_EZ[(EO_EZ.indexOf(eo.ez) + 1) % EO_EZ.length]; break;
    case 'irgate': if (down) eo.irGate = EO_GATES[(EO_GATES.indexOf(eo.irGate) + 1) % EO_GATES.length]; break;
    case 'stow': if (down) { eo.mode = 'STOW'; eo.trk = 'IDLE'; eo.lock = null; eo.slewTgt = null; eo.lrf.cont = false; } break;
    case 'scene': if (down) eo.scene = EO_SCENES[(EO_SCENES.indexOf(eo.scene) + 1) % EO_SCENES.length]; break;
    case 'ircal': if (down && eo.sensor === 'IR') eo.cal = 1.5; break;
    case 'pol': if (down) eo.pol = eo.pol === 'WHT' ? 'BLK' : 'WHT'; break;
    case 'ctrl': if (down) eo.ctrl = eo.ctrl === 'OPR' ? 'PLT' : 'OPR'; break;
    case 'tx': if (down) eo.tx = !eo.tx; break;
    case 'lrf':
      if (down) { if (eo.lrf.cont) { eo.lrf.cont = false; eo.lrf.st = eo.lrf.rng ? 'VALID' : 'READY'; } else eoLrfFire(); }
      else if (held >= 2) { eo.lrf.cont = true; eo.lrf.contT = 0; _mNote('LRF 연속 측정'); }
      break;
    case 'aux': if (down) srchMode(srch.mode === 'EO' ? 'MAN' : 'EO'); break;                                       // AUX — 서치라이트를 EO/IR 시선에 연동 · 풀기
  }
}
// AVT 잠금 — 게이트 안에 물체가 있으면 그것을 쫓고, 없으면(또는 SCENE) 그 자리를 붙든다
function eoAvtLock() {
  const o = eo.alg === 'SCENE' ? null : eoObjInGate();
  if (o) { eo.lock = { kind: 'obj', id: o.id }; eo.trk = 'LOCKED'; _mNote(`AVT 잠금 — ${o.name} (${o.id})`); return true; }
  const g = _eoGeoHere();
  if (g) { eo.lock = g; eo.trk = 'LOCKED'; return true; }
  eo.trk = 'ACQ'; return false;
}
function eoLrfFire() {
  if (!eo.pwr || eo.mode === 'STOW') return;
  eo.lrf.st = 'RANGING'; eo.lrf.t = 0.35;
}
function _eoLrfResult() {
  const p = eoAimPoint();
  const a = p ? eoAngTo(p.lat, p.lon, p.hM) : null;
  if (!a || a.rng > LRF_MAX_M) { eo.lrf.st = 'FAIL'; eo.lrf.rng = null; eo.lrf.pt = null; return; }
  eo.lrf.st = 'VALID'; eo.lrf.rng = a.rng; eo.lrf.pt = { lat: p.lat, lon: p.lon, hM: p.hM };
}
// POI — 레이더 지정 표적 · 표적들 · SAR 기준점 · 함정 · 비행계획 지점(MAP 버튼으로 차례로)
function eoPoiList() {
  const out = [];
  const t = rdr.tgt && msnContacts().find(c => c.id === rdr.tgt);
  if (t) out.push({ id: t.id, name: `RDR ${t.id}`, obj: t.id });
  for (const c of msnContacts()) if (!t || c.id !== t.id) out.push({ id: c.id, name: `${c.id} ${c.name}`, obj: c.id });
  try { (S.wps || []).forEach((w, i) => { if (w && Number.isFinite(w.lat)) out.push({ id: 'WP' + i, name: w.ident || ('WP' + (i + 1)), lat: w.lat, lon: w.lon, hM: _mGndFt(w.lat, w.lon) * 0.3048 }); }); } catch (e) { _swallow(e); }
  return out;
}
function eoNextPoi() { const L = eoPoiList(); if (!L.length) { eo.poi = -1; _mToast('POI 가 없습니다'); return; } eo.poi = (eo.poi + 1) % L.length; _mToast(`POI ${L[eo.poi].name} — SLEW 로 지향`); }
function eoSlewPoi() {
  const L = eoPoiList();
  const p = L[eo.poi] || L[0];
  if (!p) { _mToast('POI 가 없습니다 — 레이더 표적을 지정하거나 MAP 으로 고르십시오'); return; }
  eoSlewTo(p.obj ? { kind: 'obj', id: p.obj } : { kind: 'geo', lat: p.lat, lon: p.lon, hM: p.hM });
}
function eoSlewTo(L) { if (!eo.pwr) return; eo.slewTgt = L; eo.mode = 'SLEW'; eo.trk = 'IDLE'; eo.lock = null; }

function eoStep(dt) {
  if (eo.cal > 0) eo.cal = Math.max(0, eo.cal - dt);
  if (!eo.pwr) return;
  // 누르고 있는 스위치 — ZOOM(EOW 는 연속 · 나머지는 한 단계씩) · SENS · OFFSET · FOCUS
  const H = eo.hold, rep = k => { const t0 = eo.holdT[k]; if (!t0) return false; const n = Math.floor((performance.now() - t0) / 350); if (n !== (eo['_r' + k] === undefined ? -1 : eo['_r' + k])) { eo['_r' + k] = n; return true; } return false; };
  if (H['zoom:up'] || H['zoom:dn']) {
    const zin = !!H['zoom:up'];
    if (eo.sensor === 'EOW') eo.fovW = _mClamp(eo.fovW * Math.pow(zin ? 0.55 : 1.8, dt), EO_FOV.EOW[1], EO_FOV.EOW[0]);
    else if (rep(zin ? 'zoom:up' : 'zoom:dn')) { const n = EO_FOV[eo.sensor].length; eo.step[eo.sensor] = _mClamp(eo.step[eo.sensor] + (zin ? 1 : -1), 0, n - 1); }
  } else { delete eo['_rzoom:up']; delete eo['_rzoom:dn']; }
  if (H['sens:up']) eo.sens = Math.min(100, eo.sens + 30 * dt); if (H['sens:dn']) eo.sens = Math.max(0, eo.sens - 30 * dt);
  if (H['off:up']) eo.off = Math.min(100, eo.off + 30 * dt); if (H['off:dn']) eo.off = Math.max(0, eo.off - 30 * dt);
  const fd = (H['focus:up'] ? 1 : 0) - (H['focus:dn'] ? 1 : 0);
  if (fd) { if (eo.geo) eo.geoTrim = _mClamp(eo.geoTrim + fd * 40 * dt, -99, 99); else eo.focus = _mClamp(eo.focus + fd * 25 * dt, 0, 100); }

  // 조이스틱(화면 HCU + 실제 조종 장치)
  let jx = eo.joy.x, jy = eo.joy.y;
  const pj = _msnJoyAxes(); if (pj) { jx += pj.x; jy += pj.y; }
  jx = _mClamp(jx, -1, 1); jy = _mClamp(jy, -1, 1);
  const moving = Math.hypot(jx, jy) > 0.04;
  const rate = EO_RATE * (eo.zmulti ? _mClamp(eoFov() / 30, 0.015, 1) : 1);
  const sh = v => Math.sign(v) * v * v;
  const nudge = () => { eo.az = normAS(eo.az + sh(jx) * rate * dt / Math.max(0.2, Math.cos(eo.el * _mD))); eo.el = _mClamp(eo.el + sh(jy) * rate * dt, -90, 20); };
  if (moving && (eo.mode === 'FWD' || eo.mode === 'STOW' || eo.mode === 'SLEW')) { eo.mode = 'MAN'; eo.slewTgt = null; eo.lock = eo.aid ? _eoGeoHere() : null; }
  if (moving && eo.mode === 'AVT' && eo.trk === 'LOCKED') { eo.trk = 'ACQ'; eo.lock = null; }

  switch (eo.mode) {
    case 'STOW': _eoDrive(180, 0, dt); break;
    case 'FWD': _eoDrive(eo.fwd.az, eo.fwd.el, dt); break;
    case 'SLEW': {
      const p = eoLockPos(eo.slewTgt);
      if (!p) { eo.mode = 'MAN'; eo.slewTgt = null; break; }
      const a = eoAngTo(p.lat, p.lon, p.hM); _eoDrive(a.az, a.el, dt);
      break;
    }
    case 'AUTO': case 'AVT': {
      // 지리 고정 · 추적 — 조이스틱으로 그 자리를 옮긴다(AUTO AID)
      if (moving) { nudge(); if (eo.mode === 'AUTO' || eo.trk === 'ACQ') eo.lock = _eoGeoHere(); break; }
      const p = eoLockPos();
      if (eo.mode === 'AVT' && eo.trk === 'LOCKED' && eo.lock && eo.lock.kind === 'obj' && !p) { eo.trk = 'COAST'; eo.trkT = 2; eo.lock = _eoGeoHere(); break; }
      if (eo.trk === 'COAST') { eo.trkT -= dt; if (eo.trkT <= 0) { eo.trk = 'ACQ'; } }
      if (p) { const a = eoAngTo(p.lat, p.lon, p.hM); _eoDrive(a.az, a.el, dt, 120); }
      break;
    }
    default: {   // MAN — rate 수동 조종(AID 면 지면에 붙들어 기체가 움직여도 그 자리를 본다)
      if (moving) { nudge(); if (eo.aid) eo.lock = _eoGeoHere(); }
      else if (eo.aid) { const p = eoLockPos(); if (p) { const a = eoAngTo(p.lat, p.lon, p.hM); _eoDrive(a.az, a.el, dt, 120); } else eo.lock = _eoGeoHere(); }
    }
  }
  // LRF
  const L = eo.lrf;
  if (L.st === 'RANGING') { L.t -= dt; if (L.t <= 0) _eoLrfResult(); }
  if (L.cont) { L.contT -= dt; if (L.contT <= 0) { L.contT = 1; _eoLrfResult(); } }
}

// ══ 레이더 · 표적 ══
// 선박 표적(연습용) — 전탐석 위 막대 '표적 생성'(또는 교관이) 둘레 바다에 띄운다
const VSL_TYPES = [
  { t: '어선', len: 22, spd: [0, 8], rcs: 12 }, { t: '소형선', len: 9, spd: [0, 14], rcs: 6 },
  { t: '화물선', len: 120, spd: [9, 15], rcs: 28 }, { t: '고속단정', len: 12, spd: [18, 32], rcs: 7 },
];
const msnVsl = [];
let _vslSeq = 0;
function msnSpawn(n = 6, opts = {}) {
  let made = 0;
  for (let i = 0; i < n * 12 && made < n; i++) {
    const brg = opts.brg != null ? opts.brg : Math.random() * 360, nm = opts.nm != null ? opts.nm : 2 + Math.random() * 10;
    const [la, lo] = destPoint(S.lat, S.lon, brg, nm);
    if (!opts.anywhere && !_mWater(la, lo)) continue;
    const ty = opts.type ? VSL_TYPES.find(v => v.t === opts.type) || VSL_TYPES[0] : VSL_TYPES[Math.floor(Math.random() * VSL_TYPES.length)];
    msnVsl.push({ id: 'V' + (++_vslSeq), name: ty.t, lat: la, lon: lo, hdg: opts.hdg != null ? opts.hdg : Math.random() * 360,
      spd: opts.spd != null ? opts.spd : ty.spd[0] + Math.random() * (ty.spd[1] - ty.spd[0]), len: ty.len, rcs: ty.rcs, turnT: 20 + Math.random() * 60 });
    made++;
  }
  return made;
}
function msnVslClear() { msnVsl.length = 0; if (rdr.tgt && /^V/.test(rdr.tgt)) rdr.tgt = null; }
function _vslStep(dt) {
  for (const v of msnVsl) {
    v.turnT -= dt;
    if (v.turnT <= 0) { v.turnT = 30 + Math.random() * 90; if (v.spd < 16) v.hdg = normA(v.hdg + (Math.random() - 0.5) * 70); }
    if (v.spd > 0.1) {
      const [la, lo] = destPoint(v.lat, v.lon, v.hdg, v.spd * dt / 3600);
      if (_mWater(la, lo)) { v.lat = la; v.lon = lo; } else { v.hdg = normA(v.hdg + 150); }
    }
  }
}
// 레이더 · EO/IR 가 볼 수 있는 것 — 선박 표적 · 함정 · 요구조자 · 항공기
function msnContacts() {
  const out = [];
  for (const v of msnVsl) out.push({ id: v.id, kind: 'vsl', name: v.name, lat: v.lat, lon: v.lon, hM: 0, len: v.len, hdg: v.hdg, spd: v.spd, rcs: v.rcs });
  try { if (typeof shipVisible !== 'undefined' && shipVisible && shipLat !== null) out.push({ id: 'SHIP', kind: 'ship', name: '함정', lat: shipLat, lon: shipLon, hM: 0, len: 90, hdg: shipHdg, spd: shipSpd, rcs: 30 }); } catch (e) { _swallow(e); }
  try { if (typeof sar !== 'undefined' && sar.on && sar.lat !== null && sar.state !== 'aboard') out.push({ id: 'SURV', kind: 'surv', name: sar.type === 'water' ? '익수자' : '요구조자', lat: sar.lat, lon: sar.lon, hM: sar.type === 'water' ? 0 : _mGndFt(sar.lat, sar.lon) * 0.3048, len: 1.8, hdg: 0, spd: 0, rcs: 1 }); } catch (e) { _swallow(e); }
  try { if (typeof traffic !== 'undefined') for (const t of traffic) out.push({ id: 'A' + t.id, kind: 'air', name: t.ac === 'b206' ? 'Bell 206' : '흰수리', lat: t.lat, lon: t.lon, hM: (t.alt || 0) * 0.3048, len: 15, hdg: t.hdg, spd: t.spd, rcs: 8 }); } catch (e) { _swallow(e); }
  return out;
}
const RDR_RNG = [2, 5, 10, 20, 40];
const RDR_RPM_S = 2.5;                                // 한 바퀴(초)
const rdr = { tx: false, rng: 10, gain: 60, stc: 50, ftc: false, nup: false, ang: 0, tgt: null, paint: {}, trk: {}, pcv: null, flash: 0 };
// 그 표적을 이 레이더가 볼 수 있는 거리(NM) — 수평선(안테나 · 표적 높이) · 반사 면적 · 해상 상태
function rdrDetNm(c) {
  const hA = Math.max(10, Number(S.alt) || 0), hT = c.kind === 'air' ? Math.max(10, c.hM / 0.3048) : Math.max(3, c.len * 0.5 / 0.3048 * 0.3);
  const horizon = 1.23 * (Math.sqrt(hA) + Math.sqrt(hT));
  const sea = (typeof env !== 'undefined' && env.sea) || 0;
  let rcsNm = c.kind === 'surv' ? Math.max(0.3, 1.6 * (1 - sea / 7)) : c.rcs * (1 - sea * 0.06);
  rcsNm *= 0.55 + rdr.gain / 100 * 0.6;
  return Math.min(horizon, rcsNm);
}
function rdrStep(dt) {
  if (!rdr.tx) return;
  const a0 = rdr.ang, sweep = 360 / RDR_RPM_S * dt;
  rdr.ang = normA(a0 + sweep);
  const inArc = a => { const d = normA(a - a0); return d > 0 && d <= sweep + 1e-9; };
  const now = performance.now();
  for (const c of msnContacts()) {
    const brg = bearing(S.lat, S.lon, c.lat, c.lon), nm = distance(S.lat, S.lon, c.lat, c.lon);
    const disp = rdr.nup ? brg : normA(brg - S.hdg);
    if (!inArc(disp)) continue;
    if (nm > rdrDetNm(c) || nm > RDR_RNG[RDR_RNG.length - 1]) { delete rdr.paint[c.id]; continue; }
    rdr.paint[c.id] = { brg, nm, t: now, kind: c.kind, rcs: c.rcs };
    // 추적(지정한 표적) — 지난 두 바퀴의 자리로 침로 · 속력
    const T = rdr.trk[c.id] || (rdr.trk[c.id] = { h: [] });
    T.h.push({ lat: c.lat, lon: c.lon, t: now }); if (T.h.length > 4) T.h.shift();
    if (T.h.length >= 2) {
      const a = T.h[0], b = T.h[T.h.length - 1], hrs = (b.t - a.t) / 3600000;
      if (hrs > 0) { T.spd = distance(a.lat, a.lon, b.lat, b.lon) / hrs; T.cse = bearing(a.lat, a.lon, b.lat, b.lon); }
    }
  }
  _rdrPaintBeam(a0, sweep, dt);
}
// 잔상 캔버스(PPI) — 한 줄씩 그린다: 해면 반사 · 비 · 육지 · 표적
function _rdrPaintBeam(a0, sweep, dt) {
  const N = 320;
  if (!rdr.pcv) { rdr.pcv = document.createElement('canvas'); rdr.pcv.width = rdr.pcv.height = N; }
  const g = rdr.pcv.getContext('2d'), c = N / 2, R = N / 2 - 2;
  g.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-dt / 1.4)).toFixed(3)})`; g.fillRect(0, 0, N, N);
  const sea = (typeof env !== 'undefined' && env.sea) || 0, rain = (typeof env !== 'undefined' && env.rain) || 0;
  const clutNm = (0.3 + sea * 0.45) * (1 - rdr.stc / 130), gk = rdr.gain / 100;
  const steps = Math.max(1, Math.ceil(sweep / 1.2));
  for (let s = 0; s < steps; s++) {
    const disp = normA(a0 + sweep * (s + 1) / steps), brg = rdr.nup ? disp : normA(disp + S.hdg);
    const sx = Math.sin(disp * _mD), sy = -Math.cos(disp * _mD);
    const bins = 48;
    for (let b = 1; b <= bins; b++) {
      const nm = rdr.rng * b / bins, r = R * b / bins;
      let v = 0;
      // 육지 반사(해안선)
      const [la, lo] = destPoint(S.lat, S.lon, brg, nm);
      if (!_mWater(la, lo)) v = Math.max(v, 0.55 + 0.4 * gk);
      // 해면 반사 — 가까이서 해상 상태만큼(STC 로 누른다)
      if (nm < clutNm && Math.random() < (1 - nm / clutNm) * 0.8 * gk) v = Math.max(v, 0.25 + 0.5 * Math.random());
      // 비(FTC 로 누른다)
      if (rain && Math.random() < rain * (rdr.ftc ? 0.04 : 0.18) * gk) v = Math.max(v, 0.3 * Math.random() + 0.15);
      // 잡음
      if (Math.random() < gk * gk * 0.025) v = Math.max(v, 0.2);
      if (v > 0) { g.fillStyle = `rgba(80,255,120,${v.toFixed(2)})`; g.fillRect(c + sx * r - 1.5, c + sy * r - 1.5, 3, 3); }
    }
  }
  // 표적 — 반사 면적만큼 크게
  const now = performance.now();
  for (const [, p] of Object.entries(rdr.paint)) {
    if (now - p.t > 120 || p.nm > rdr.rng) continue;
    const disp = rdr.nup ? p.brg : normA(p.brg - S.hdg), r = R * p.nm / rdr.rng;
    const sz = p.kind === 'surv' ? 2.5 : Math.min(9, 2.5 + p.rcs / 5);
    g.fillStyle = p.kind === 'air' ? 'rgba(160,255,255,0.95)' : 'rgba(170,255,170,1)';
    g.beginPath(); g.arc(c + Math.sin(disp * _mD) * r, c - Math.cos(disp * _mD) * r, sz, 0, 2 * Math.PI); g.fill();
  }
}
function rdrRngStep(d) { const i = RDR_RNG.indexOf(rdr.rng); rdr.rng = RDR_RNG[_mClamp((i < 0 ? 2 : i) + d, 0, RDR_RNG.length - 1)]; if (rdr.pcv) rdr.pcv.getContext('2d').clearRect(0, 0, rdr.pcv.width, rdr.pcv.height); }
// 화면에서 누른 자리(캔버스 기준 -1…1)에 가까운 표적을 지정한다
function rdrPick(nx, ny) {
  const nm = Math.hypot(nx, ny) * rdr.rng, disp = normA(Math.atan2(nx, -ny) / _mD), brg = rdr.nup ? disp : normA(disp + S.hdg);
  const [la, lo] = destPoint(S.lat, S.lon, brg, nm);
  let best = null, bd = rdr.rng * 0.08;
  const now = performance.now();
  for (const [id, p] of Object.entries(rdr.paint)) {
    if (now - p.t > RDR_RPM_S * 1000 * 1.5) continue;
    const [pa, po] = destPoint(S.lat, S.lon, p.brg, p.nm);
    const d = distance(la, lo, pa, po);
    if (d < bd) { bd = d; best = id; }
  }
  rdr.tgt = best;
  if (best) _mNote(`레이더 표적 지정 — ${best}`);
  return best;
}
function rdrSlaveEo() { if (!rdr.tgt) { _mToast('먼저 레이더 화면에서 표적을 누르십시오'); return false; } eoSlewTo({ kind: 'obj', id: rdr.tgt }); return true; }

// ══ ③ 서치라이트(35-kuhgrip.js kgLt) ══
const srch = { mode: 'MAN', lim: false };            // MAN · EO(EO/IR 시선) · RDR(레이더 지정 표적)
function srchMode(m) { srch.mode = m; if (m !== 'MAN' && typeof kgLt !== 'undefined' && !kgLt.srch && typeof kgSrchSet === 'function') kgSrchSet(true); _mNote(`서치라이트 ${m === 'EO' ? 'EO/IR 연동' : m === 'RDR' ? '레이더 표적 연동' : '수동'}`); }
function srchStep(dt) {
  if (typeof kgLt === 'undefined' || srch.mode === 'MAN') { srch.lim = false; return; }
  let p = null;
  if (srch.mode === 'EO') p = eo.pwr && eo.mode !== 'STOW' ? eoAimPoint() : null;
  else if (srch.mode === 'RDR' && rdr.tgt) { const c = msnContacts().find(x => x.id === rdr.tgt); if (c) p = c; }
  if (!p) return;
  const a = eoAngTo(p.lat, p.lon, p.hM);
  const lim = typeof KG_SRCH !== 'undefined' ? KG_SRCH : { azMax: 120, elMin: 2.5, elMax: 80 };
  const az = _mClamp(a.az, -lim.azMax, lim.azMax), dn = _mClamp(-a.el, lim.elMin, lim.elMax);
  srch.lim = Math.abs(az - a.az) > 0.5 || Math.abs(dn + a.el) > 0.5;
  const m = 45 * dt;
  kgLt.az += _mClamp(az - kgLt.az, -m, m); kgLt.el += _mClamp(dn - kgLt.el, -m, m);
}
function srchMan(dir, dt = 0.2) {
  if (typeof kgLt === 'undefined') return;
  srch.mode = 'MAN';
  const lim = typeof KG_SRCH !== 'undefined' ? KG_SRCH : { azMax: 120, elMin: 2.5, elMax: 80 };
  if (dir === 'L') kgLt.az = Math.max(-lim.azMax, kgLt.az - 45 * dt);
  if (dir === 'R') kgLt.az = Math.min(lim.azMax, kgLt.az + 45 * dt);
  if (dir === 'U') kgLt.el = Math.max(lim.elMin, kgLt.el - 25 * dt);
  if (dir === 'D') kgLt.el = Math.min(lim.elMax, kgLt.el + 25 * dt);
}

// ══ 메뉴(MENU) — ZOOM 으로 고르고 SENS 로 바꾼다 ══
const MSN_MENU = [
  { n: 'LASER ARM', v: () => eo.laserArm ? 'ARMED' : 'SAFE', set: () => { eo.laserArm = !eo.laserArm; if (!eo.laserArm) eo.laserFire = false; } },
  { n: 'SRCH LT SLAVE', v: () => srch.mode, set: d => { const L = ['MAN', 'EO', 'RDR']; srchMode(L[(L.indexOf(srch.mode) + d + 3) % 3]); } },
  { n: 'PIP', v: () => eo.pip, set: () => { eo.pip = eo.pip === 'OFF' ? 'RDR' : 'OFF'; } },
  { n: 'AVT MODE', v: () => eo.alg, set: d => { eo.alg = EO_ALGS[(EO_ALGS.indexOf(eo.alg) + d + EO_ALGS.length) % EO_ALGS.length]; } },
  { n: 'RANGE UNITS', v: () => eo.units, set: () => { eo.units = eo.units === 'NM' ? 'KM' : 'NM'; } },
  { n: 'CTRL AUTH', v: () => eo.ctrl, set: () => { eo.ctrl = eo.ctrl === 'OPR' ? 'PLT' : 'OPR'; } },
];

// ══ 화면 ══
let msnOpen = false, _msnEl = null, _eoMap = null, _msnTickT = 0;
function _mToast(t) { try { uiToast(t, '', 2200); } catch (e) { _swallow(e); } }
function _mNote(t) { try { if (typeof fdrNote === 'function') fdrNote('전탐석 — ' + t); } catch (e) { _swallow(e); } }
function _msnCss() {
  if (document.getElementById('msn-css')) return;
  const st = document.createElement('style'); st.id = 'msn-css';
  st.textContent = `
#msn-root{position:fixed;inset:0;z-index:4000;display:none;flex-direction:column;background:#1b2026;color:#cfd8df;font-family:"Helvetica Neue",Arial,sans-serif;user-select:none;-webkit-user-select:none}
#msn-root.on{display:flex}
.msn-top{display:flex;align-items:center;gap:8px;padding:5px 10px;background:#0b0e11;border-bottom:1px solid #2a3540;font-size:12px;flex-wrap:wrap}
.msn-top b{color:#ffd23a;letter-spacing:.5px}
.msn-top .msn-ac{color:#8fd;font-family:monospace;font-size:12px}
.msn-top button,.msn-btn{background:#1c2733;border:1px solid #3a4b5c;color:#cfe;border-radius:4px;padding:4px 9px;font-size:11px;font-weight:bold;cursor:pointer}
.msn-top button.on,.msn-btn.on{background:#0d4a2a;border-color:#2ecc71;color:#bfffd5}
.msn-sp{flex:1}
.msn-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);grid-template-rows:minmax(0,1fr) auto;gap:8px;padding:8px;
  background:linear-gradient(#262c33,#1b2026)}
.msn-mfd{position:relative;background:#000;border:12px solid #2c3137;border-radius:12px;box-shadow:inset 0 0 0 2px #000,0 3px 8px #000a,0 0 0 1px #45505b;overflow:hidden;min-height:0}
.msn-eo{grid-column:1;grid-row:1}
.msn-eo .eo-vid{position:absolute;inset:0}
.msn-eo .eo-map,.msn-eo .eo-spr{position:absolute;inset:0;width:100%;height:100%}
.msn-eo .eo-hud{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.msn-right{grid-column:2;grid-row:1/span 2;display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto}
.msn-rdr{aspect-ratio:1/1;width:100%;flex:0 0 auto}
.msn-rdr canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
.msn-keys{display:flex;flex-wrap:wrap;gap:4px}
.msn-keys .msn-btn{flex:1 1 auto}
.msn-panel{background:#11161b;border:1px solid #2f3b46;border-radius:6px;padding:6px 8px;font-size:11px}
.msn-panel h4{margin:0 0 5px;font-size:11px;color:#9fb3c4;letter-spacing:1px}
.msn-tdata{font-family:monospace;font-size:11px;color:#9f9;min-height:30px;white-space:pre}
.msn-hcu{grid-column:1;grid-row:2;display:flex;gap:10px;justify-content:center;align-items:flex-start;flex-wrap:wrap}
.hcu-top,.hcu-face{background:linear-gradient(#3a4047,#2b3036);border:2px solid #15191d;border-radius:14px;box-shadow:0 3px 6px #000a,inset 0 1px 0 #5a636c;padding:8px 10px}
.hcu-top{display:grid;grid-template-columns:repeat(7,44px);gap:6px}
.hcu-key{height:34px;border-radius:5px;background:linear-gradient(#20252a,#121518);border:1px solid #000;box-shadow:inset 0 1px 0 #444,0 1px 0 #555;color:#e8e8e8;
  font:bold 8.5px/1.05 Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer}
.hcu-key.dn{background:#0b0d0f;box-shadow:inset 0 2px 3px #000;color:#ffd23a}
.hcu-face{display:grid;grid-template-columns:repeat(8,46px);grid-template-rows:auto auto auto;gap:4px 6px;position:relative}
.hcu-tg{display:flex;flex-direction:column;align-items:center;gap:2px;font:bold 8px/1 Arial,sans-serif;color:#eee;text-align:center}
.hcu-tg .lb{min-height:16px;display:flex;align-items:flex-end;justify-content:center}
.hcu-tg .sw{width:22px;height:40px;border-radius:11px;background:#111;border:1px solid #000;box-shadow:inset 0 0 0 2px #2a2f35;position:relative;cursor:pointer}
.hcu-tg .sw i{position:absolute;left:5px;width:12px;height:12px;border-radius:50%;background:radial-gradient(#ddd,#888);top:14px;transition:top .06s}
.hcu-tg .sw.up i{top:3px}.hcu-tg .sw.dn i{top:25px}
.hcu-tg .sw b{position:absolute;left:0;right:0;height:50%}
.hcu-tg .sw b.u{top:0}.hcu-tg .sw b.d{bottom:0}
.hcu-row2{grid-column:1/span 8;display:grid;grid-template-columns:60px 1fr 120px;gap:8px;align-items:center}
.hcu-avt{width:34px;height:34px;border-radius:50%;background:radial-gradient(#4a4f55,#1b1e21);border:2px solid #000;box-shadow:0 0 0 2px #666;cursor:pointer;margin:0 auto}
.hcu-avt.dn{background:radial-gradient(#222,#000)}
.hcu-focus{width:16px;height:64px;border-radius:6px;background:repeating-linear-gradient(#1a1a1a 0 3px,#3a3a3a 3px 5px);border:1px solid #000;margin:4px auto 0;cursor:ns-resize;touch-action:none}
.hcu-stick{width:92px;height:92px;border-radius:50%;background:radial-gradient(#2c3238,#14171a);border:2px solid #000;box-shadow:inset 0 0 0 6px #23282d;margin:0 auto;position:relative;touch-action:none;cursor:grab}
.hcu-stick i{position:absolute;left:31px;top:31px;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#bbb,#555 60%,#222);box-shadow:0 2px 4px #000}
.hcu-lamps{display:flex;flex-direction:column;gap:6px;align-items:center;font:bold 8px Arial;color:#eee}
.hcu-lamp{width:14px;height:14px;border-radius:50%;background:#2a2a2a;border:2px solid #111;box-shadow:inset 0 1px 2px #000}
.hcu-lamp.g{background:#3f3;box-shadow:0 0 8px #3f3}.hcu-lamp.a{background:#fb0;box-shadow:0 0 8px #fb0}.hcu-lamp.r{background:#f33;box-shadow:0 0 8px #f33}
.hcu-cap{font:bold 9px Arial;color:#9aa;text-align:center;margin-top:3px;letter-spacing:1px}
#msn-open-btn{position:fixed;left:8px;bottom:60px;z-index:3900;display:none;background:#0d2a40;border:1px solid #3a8fd0;color:#cfe8ff;border-radius:6px;padding:7px 11px;font:bold 12px Arial;cursor:pointer;box-shadow:0 2px 6px #000a}
html.ac-kuhm #msn-open-btn{display:block}
@media (max-width:980px){.msn-body{grid-template-columns:1fr;grid-template-rows:auto auto auto;overflow:auto}.msn-eo{aspect-ratio:4/3}.msn-right{grid-column:1;grid-row:2}.msn-hcu{grid-row:3}.msn-rdr{max-width:420px;margin:0 auto}}
`;
  document.head.appendChild(st);
}
const HCU_TOP = [['menu', 'MENU'], ['laser', 'LASER'], ['geo', 'GEO<br>FOCUS'], ['map', 'MAP'], ['ez', '2X'], ['irgate', 'IR<br>GATE'], ['stow', 'STOW'],
                 ['aux', 'AUX'], ['lrf', 'LRF'], ['tx', 'TX'], ['ctrl', 'CTRL<br>AUTH'], ['pol', 'POL'], ['ircal', 'IR<br>CAL'], ['scene', 'SCENE']];
const HCU_SW = [['zoom', 'ZOOM', ''], ['vic', 'VIC', ''], ['avtg', 'AVT<br>GATE', 'AVT<br>MODE'], ['steer', 'AUTO', 'MANUAL'], ['aid', 'AID', 'ZMULTI'],
                ['slew', 'SLEW', 'FWD'], ['img', 'MAN/<br>AUTO', 'FILTER'], ['pip', 'IMAGE<br>INT', 'IMAGE<br>MODE']];
function _msnBuild() {
  if (_msnEl) return _msnEl;
  _msnCss();
  const R = document.createElement('div'); R.id = 'msn-root';
  const sw = ([k, u, d]) => `<div class="hcu-tg"><div class="lb">${u}</div><div class="sw" data-sw="${k}"><i></i><b class="u" data-hcu="${k}:up"></b><b class="d" data-hcu="${k}:dn"></b></div><div class="lb">${d}</div></div>`;
  R.innerHTML = `
  <div class="msn-top"><b>흰수리 전탐석 · MISSION CONSOLE</b><span class="msn-ac" data-m="ac"></span><span class="msn-sp"></span>
    <button data-mact="fly">▶ 비행</button><button data-mact="spawn">선박 표적 생성</button><button data-mact="clear">표적 지우기</button>
    <button data-mact="help">❓</button><button data-mact="close">조종석 보기 ⤴</button></div>
  <div class="msn-body">
    <div class="msn-mfd msn-eo"><div class="eo-vid"><canvas class="eo-spr"></canvas></div><canvas class="eo-hud"></canvas></div>
    <div class="msn-right">
      <div class="msn-mfd msn-rdr"><canvas></canvas></div>
      <div class="msn-panel"><h4>SAR RADAR</h4><div class="msn-keys">
        <button class="msn-btn" data-mact="rtx">TX</button><button class="msn-btn" data-mact="rng-">RNG −</button><button class="msn-btn" data-mact="rng+">RNG +</button>
        <button class="msn-btn" data-mact="gain-">GAIN −</button><button class="msn-btn" data-mact="gain+">GAIN +</button>
        <button class="msn-btn" data-mact="stc-">STC −</button><button class="msn-btn" data-mact="stc+">STC +</button>
        <button class="msn-btn" data-mact="ftc">FTC</button><button class="msn-btn" data-mact="nup">H UP</button></div>
        <div class="msn-keys" style="margin-top:4px"><button class="msn-btn" data-mact="r2eo">EO/IR → 표적</button><button class="msn-btn" data-mact="r2sl">서치라이트 → 표적</button><button class="msn-btn" data-mact="rclr">지정 해제</button></div>
        <div class="msn-tdata" data-m="tdata"></div></div>
      <div class="msn-panel"><h4>SEARCH LIGHT</h4><div class="msn-keys">
        <button class="msn-btn" data-mact="slon">ON/OFF</button><button class="msn-btn" data-mact="slman">MAN</button><button class="msn-btn" data-mact="sleo">EO/IR 연동</button><button class="msn-btn" data-mact="slrdr">레이더 연동</button></div>
        <div class="msn-keys" style="margin-top:4px"><button class="msn-btn" data-slh="L">◀</button><button class="msn-btn" data-slh="U">▲ 멀리</button><button class="msn-btn" data-slh="D">▼ 가까이</button><button class="msn-btn" data-slh="R">▶</button>
        <button class="msn-btn" data-mact="slctr">CTR</button></div>
        <div class="msn-tdata" data-m="sdata"></div></div>
    </div>
    <div class="msn-hcu">
      <div><div class="hcu-top">${HCU_TOP.map(([k, n]) => `<div class="hcu-key" data-hcu="${k}">${n}</div>`).join('')}</div><div class="hcu-cap">TOP PLATE</div></div>
      <div><div class="hcu-face">${HCU_SW.map(sw).join('')}
        <div class="hcu-row2">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;font:bold 8px Arial;color:#eee">AVT<div class="hcu-avt" data-hcu="avt"></div>FOCUS<div class="hcu-focus" data-m="focus"></div></div>
          <div><div class="hcu-stick" data-m="stick"><i></i></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;align-items:start">
            <div class="hcu-lamps">ARMED<span class="hcu-lamp" data-lamp="armed"></span>ACTIVE<span class="hcu-lamp" data-lamp="active"></span></div>
            <div class="hcu-lamps">ON<span class="hcu-lamp" data-lamp="on"></span></div>
            <div class="hcu-lamps"><span>POWER</span><div class="hcu-tg"><div class="sw" data-sw="pwr"><i></i><b class="u" data-hcu="pwr"></b><b class="d" data-hcu="pwr"></b></div></div></div>
            ${sw(['sens', 'SENS', ''])}${sw(['off', 'OFFSET', ''])}<div></div>
          </div>
        </div></div><div class="hcu-cap">HAND CONTROLLER (HCU) — FACE PLATE</div></div>
    </div>
  </div>`;
  document.body.appendChild(R);
  _msnEl = R;
  // HCU 누름 · 뗌
  const downK = new Map();
  R.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-hcu]');
    if (h) { e.preventDefault(); const k = h.dataset.hcu; downK.set(e.pointerId, k); hcuPress(k, true); try { h.setPointerCapture(e.pointerId); } catch (er) { _swallow(er); } return; }
    const sl = e.target.closest('[data-slh]');
    if (sl) { e.preventDefault(); _slHold = sl.dataset.slh; try { sl.setPointerCapture(e.pointerId); } catch (er) { _swallow(er); } }
  });
  const up = e => { const k = downK.get(e.pointerId); if (k) { downK.delete(e.pointerId); hcuPress(k, false); } if (_slHold) _slHold = null; };
  R.addEventListener('pointerup', up); R.addEventListener('pointercancel', up);
  R.addEventListener('click', e => { const b = e.target.closest('[data-mact]'); if (b) msnAct(b.dataset.mact); });
  // 조이스틱(화면) — 끌면 기울기 · 놓으면 가운데
  const st = R.querySelector('[data-m="stick"]'), knob = st.querySelector('i');
  const stMove = e => { const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, m = r.width / 2 - 14;
    let x = (e.clientX - cx) / m, y = (e.clientY - cy) / m; const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; }
    eo.joy.x = x; eo.joy.y = -y; knob.style.transform = `translate(${x * m * 0.6}px,${y * m * 0.6}px)`; };
  st.addEventListener('pointerdown', e => { e.preventDefault(); st.setPointerCapture(e.pointerId); st._on = true; stMove(e); });
  st.addEventListener('pointermove', e => { if (st._on) stMove(e); });
  const stUp = () => { st._on = false; eo.joy.x = 0; eo.joy.y = 0; knob.style.transform = ''; };
  st.addEventListener('pointerup', stUp); st.addEventListener('pointercancel', stUp);
  // FOCUS 다이얼 — 위아래로 끌기 · 휠
  const fc = R.querySelector('[data-m="focus"]');
  let fy = null;
  fc.addEventListener('pointerdown', e => { fy = e.clientY; fc.setPointerCapture(e.pointerId); });
  fc.addEventListener('pointermove', e => { if (fy === null) return; eoFocusBy((fy - e.clientY) * 0.6); fy = e.clientY; });
  fc.addEventListener('pointerup', () => { fy = null; });
  fc.addEventListener('wheel', e => { e.preventDefault(); eoFocusBy(-e.deltaY * 0.05); }, { passive: false });
  // 레이더 — 누른 자리의 표적 지정
  const rc = R.querySelector('.msn-rdr canvas');
  rc.addEventListener('pointerdown', e => { const r = rc.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1; rdrPick(nx / 0.92, ny / 0.92); });
  return R;
}
let _slHold = null;
function eoFocusBy(d) { if (eo.geo) eo.geoTrim = _mClamp(eo.geoTrim + d, -99, 99); else eo.focus = _mClamp(eo.focus + d, 0, 100); }
function msnAct(a) {
  switch (a) {
    case 'fly': try { toggleSim(); } catch (e) { _swallow(e); } break;
    case 'spawn': { const n = msnSpawn(6); _mToast(n ? `선박 표적 ${n}척을 둘레 바다(2~12NM)에 띄웠습니다` : '둘레에 바다가 없어 띄우지 못했습니다(지형을 아직 모르면 잠시 뒤에)'); break; }
    case 'clear': msnVslClear(); break;
    case 'help': msnHelp(); break;
    case 'close': msnShow(false); break;
    case 'rtx': rdr.tx = !rdr.tx; _mNote(`레이더 ${rdr.tx ? 'TX' : 'STBY'}`); break;
    case 'rng-': rdrRngStep(-1); break; case 'rng+': rdrRngStep(1); break;
    case 'gain-': rdr.gain = Math.max(0, rdr.gain - 10); break; case 'gain+': rdr.gain = Math.min(100, rdr.gain + 10); break;
    case 'stc-': rdr.stc = Math.max(0, rdr.stc - 10); break; case 'stc+': rdr.stc = Math.min(100, rdr.stc + 10); break;
    case 'ftc': rdr.ftc = !rdr.ftc; break;
    case 'nup': rdr.nup = !rdr.nup; if (rdr.pcv) rdr.pcv.getContext('2d').clearRect(0, 0, rdr.pcv.width, rdr.pcv.height); break;
    case 'r2eo': rdrSlaveEo(); break;
    case 'r2sl': if (rdr.tgt) srchMode('RDR'); else _mToast('먼저 레이더 화면에서 표적을 누르십시오'); break;
    case 'rclr': rdr.tgt = null; break;
    case 'slon': try { kgSrchSet(!kgLt.srch); } catch (e) { _swallow(e); } break;
    case 'slman': srchMode('MAN'); break;
    case 'sleo': srchMode('EO'); break;
    case 'slrdr': if (rdr.tgt) srchMode('RDR'); else _mToast('먼저 레이더 화면에서 표적을 누르십시오'); break;
    case 'slctr': srch.mode = 'MAN'; try { kgLt.az = 0; kgLt.el = KG_SRCH.el0; } catch (e) { _swallow(e); } break;
  }
  msnRenderPanels();
}
function msnHelp() {
  const t = ['흰수리 전탐석 — EO/IR · SAR 레이더 · 서치라이트',
    '· EO/IR: 조이스틱(화면 HCU 가운데 · 실제 조종 장치의 사이클릭 축)으로 터릿을 돌린다. ZOOM ▲확대 ▼축소 · VIC 센서(EOW → EON → IR) · 2X 전자 줌 · POL 백상/흑상',
    '· AVT: 한 번 누르면 게이트(ACQ) — 표적을 게이트에 넣고 한 번 더 누르면 잠금(LOCKED) · 1.5초 누르면 해제',
    '· AUTO: 지금 보는 자리를 좌표로 고정 · MANUAL: 수동 · AID: 지면 고정 보조 · ZMULTI: 화각에 맞춘 감도',
    '· SLEW: MAP 으로 고른 POI(레이더 표적 · 선박 · 함정 · 요구조자 · 비행계획 지점)로 · FWD: 전방(2초 누르면 지금 자리를 새 전방으로) · STOW',
    '· LRF: 한 번 측정 · 2초 누르면 연속 · LASER: MENU 에서 LASER ARM 일 때 누르는 동안 조사',
    '· MENU: ZOOM 으로 고르고 SENS 로 바꾼다(LASER ARM · 서치라이트 연동 · PIP · AVT MODE · 단위)',
    '· 레이더: TX 를 켜고 화면의 표적을 누르면 지정 → "EO/IR → 표적" 으로 터릿을, "서치라이트 → 표적" 으로 빛을 돌린다',
    '· 서치라이트: 수동(◀▲▼▶) · EO/IR 연동(시선이 닿는 자리를 비춘다 · HCU AUX) · 레이더 표적 연동',
    '· 조종석 SYSTEM 창 Video(CDU Aircraft Systems → Video → Channel EO/IR)에 같은 영상 · 오버레이가 나온다 — 전탐석이 터릿을 돌리면 조종사도 그대로 본다',
    '· 기체는 흰수리 그대로 난다 — "조종석 보기" 로 비행계획 · 자동비행을 다루고, 지도 왼쪽 아래 🎯 전탐석 으로 돌아온다'];
  try { uiAlert(t.join('\n')); } catch (e) { _swallow(e); }
}
// 실제 조종 장치 — 사이클릭(롤 · 피치)으로 배정한 축, 없으면 지금 쓰는 장치의 축 0 · 1
function _msnJoyAxes() {
  if (!msnOpen || typeof joyAxVal !== 'function' || typeof joyOn === 'undefined' || !joyOn) return null;
  try {
    if (typeof simModeOn !== 'undefined' && simModeOn) return null;   // SIM 으로 몰고 있으면 사이클릭은 비행에 쓴다
    if (joyAxes.roll || joyAxes.pitch) return { x: joyAxVal('roll'), y: -joyAxVal('pitch') };
    const pads = joyPads(); const p = pads.find(q => q.index === joyActiveIdx) || pads[0];
    if (!p) return null;
    const neu = _joyNeutral[p.index] || [];
    const r = i => { const v = (p.axes || [])[i]; if (!Number.isFinite(v)) return 0; const d = v - (Number.isFinite(neu[i]) ? neu[i] : 0); return Math.abs(d) < 0.08 ? 0 : d; };
    return { x: r(0), y: -r(1) };
  } catch (e) { return null; }
}

// ── EO/IR 영상(3D 지도) ──
// 지도 하나를 그릇(_eoHost)에 담아 둔다 — 전탐석이 열려 있으면 그 화면 안에, 아니면 화면 밖에 두고
// 조종석 SYSTEM 창 Video(Channel EO/IR) · 3D 조종석 MFD 가 그 그림을 옮겨 그린다(eoirVideoDrawTo).
// 보는 곳이 없으면(5초) 거둔다 — 그래픽 부담.
let _eoHost = null, _eoWantT = 0;
const EO_IDLE_MS = 5000;
function _eoNeed() { return msnOpen || performance.now() - _eoWantT < EO_IDLE_MS; }
function _eoHostPlace() {
  if (!_eoHost) { _eoHost = document.createElement('div'); _eoHost.className = 'eo-map'; }
  const vid = msnOpen && _msnEl ? _msnEl.querySelector('.eo-vid') : null;
  const want = vid || document.body;
  if (_eoHost.parentElement !== want) {
    if (vid) { _eoHost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; vid.insertBefore(_eoHost, vid.firstChild); }
    else { _eoHost.style.cssText = 'position:fixed;left:-10000px;top:0;width:768px;height:576px;pointer-events:none;overflow:hidden'; document.body.appendChild(_eoHost); }
    try { if (_eoMap) _eoMap.resize(); } catch (e) { _swallow(e); }
  }
  return _eoHost;
}
function _eoMapEnsure() {
  if (typeof maplibregl === 'undefined' || !document.body) return null;
  const el = _eoHostPlace();
  if (_eoMap) return _eoMap;
  if (!(el.clientWidth > 20 && el.clientHeight > 20)) return null;
  try {
    const map = new maplibregl.Map({ container: el, style: _map3dStyle(), center: [S.lon, S.lat], zoom: 14, pitch: 80, bearing: S.hdg, maxPitch: 180, maxZoom: 24,
      interactive: false, attributionControl: false, pixelRatio: (typeof map3dPixelRatio === 'function') ? map3dPixelRatio(true) : 1,
      canvasContextAttributes: { preserveDrawingBuffer: true } });   // 조종석 SYSTEM 창 · MFD 로 옮겨 그릴 수 있게
    map.on('error', e => console.warn('[EO/IR]', e && e.error ? e.error.message : e));
    map.on('style.load', () => {
      try { if (typeof _ship3dAddTo === 'function' && !map.getSource('ship-3d')) _ship3dAddTo(map); } catch (e) { _swallow(e); }
      try { if (typeof _sarLayer === 'function' && !map.getLayer('sar-3d')) map.addLayer(_sarLayer(true)); } catch (e) { _swallow(e); }
      try { if (typeof TFC3D_LAYER !== 'undefined' && !map.getLayer('traffic-3d')) map.addLayer(Object.assign({}, TFC3D_LAYER)); } catch (e) { _swallow(e); }
    });
    map.on('load', () => {
      try { map.setTerrain({ source: 'terrain', exaggeration: MAP3D_EXAG }); } catch (e) { _swallow(e); }
      try { map.setSky(MAP3D_SKY); } catch (e) { _swallow(e); }
    });
    try { map.setCenterClampedToGround(false); } catch (e) { _swallow(e); }
    _eoMap = map;
  } catch (e) { console.warn('[EO/IR] map failed:', e); _eoMap = null; }
  return _eoMap;
}
function _eoMapDrop() { try { if (_eoMap) _eoMap.remove(); } catch (e) { _swallow(e); } _eoMap = null; try { if (_eoHost) _eoHost.remove(); } catch (e) { _swallow(e); } _eoHost = null; }
function _eoCamera() {
  const map = _eoMapEnsure(); if (!map) return;
  const el = map.getContainer(), W = el.clientWidth, Hh = el.clientHeight;
  if (!(W > 0 && Hh > 0)) return;
  const hf = eoFov(), vf = _mClamp(2 * Math.atan(Math.tan(hf / 2 * _mD) * Hh / W) / _mD, 0.1, 150);
  try { if (Math.abs(map.getVerticalFieldOfView() - vf) > 1e-3) map.setVerticalFieldOfView(vf); } catch (e) { _swallow(e); }
  // 카메라 높이 — 지도가 그린 땅(과장비가 곱해져 있다) + 실제 지면 위 높이
  let drawn = null; try { drawn = map.queryTerrainElevation([S.lon, S.lat]); } catch (e) { drawn = null; }
  const phys = _mGndFt(S.lat, S.lon) * 0.3048, agl = Math.max(2, _mAltM() - phys);
  const camAlt = (Number.isFinite(drawn) ? drawn : phys) + agl - 1.2;
  const p = eoLosPoint(), dist = _mClamp(p ? p.gnd : 5000, 150, 30000);
  try { map.jumpTo(_ml3dCamOptions(S.lon, S.lat, camAlt, normA(S.hdg + eo.az), _mClamp(90 + eo.el, 0, 180), 0, dist, map)); } catch (e) { _swallow(e); }
}
// 조종석 SYSTEM 창 Video(Channel EO/IR) · 3D 조종석 MFD — 그 칸(x, y, w, h)에 EO/IR 영상 + 오버레이를 그린다(18-system.js 가 부른다)
//   전탐석에서 터릿을 움직이면 그대로 보인다. CDU Video 의 Brightness · Contrast · Saturation 도 먹는다.
function eoirVideoDrawTo(g, x, y, w, h) {
  _eoWantT = performance.now();
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#000'; g.fillRect(x, y, w, h);
  const map = _eoMapEnsure();
  if (map && eo.pwr && eo.mode !== 'STOW') {
    const mc = map.getCanvas(), el = map.getContainer(), cw = el.clientWidth, ch = el.clientHeight;
    if (mc && mc.width && cw > 0) {
      // 칸을 다 채우게(가운데를 기준으로 남는 쪽을 자른다)
      const s = Math.max(w / cw, h / ch), ox = x + (w - cw * s) / 2, oy = y + (h - ch * s) / 2;
      let f = eoVideoFilter();
      try { const V = typeof videoCfg !== 'undefined' ? videoCfg : null; if (V) f += ` brightness(${(V.bri / 50).toFixed(2)}) contrast(${(V.con / 50).toFixed(2)}) saturate(${(V.sat / 50).toFixed(2)})`; } catch (e) { _swallow(e); }
      try { g.filter = f; } catch (e) { _swallow(e); }
      try { g.drawImage(mc, ox, oy, cw * s, ch * s); } catch (e) { _swallow(e); }
      g.save(); g.translate(ox, oy); g.scale(s, s); try { _eoSpritesG(g, cw, ch); } catch (e) { _swallow(e); } g.restore();
      try { g.filter = 'none'; } catch (e) { _swallow(e); }
    }
  }
  try { _eoHudG(g, x, y, w, h, false); } catch (e) { _swallow(e); }
  g.restore();
}
function eoirVideoShown() { return !!_eoMap; }
// 영상 필터 — 센서 · 밤낮 · 시정 · 비 · 극성 · 수동 감도 · 초점
function eoVideoFilter() {
  const E = typeof env !== 'undefined' ? env : {};
  const tod = E.tod || 'DAY', vis = +E.vis || 0, rain = +E.rain || 0;
  const f = [];
  let bri = 1, con = 1, blur = 0;
  if (eo.sensor === 'IR') {
    f.push('grayscale(1)'); con *= 1.5; bri *= tod === 'NIGHT' ? 0.85 : 0.95;
    if (vis && vis < 3) { blur += (3 - vis) * 0.4; con *= 0.85; }
    if (rain) { con *= 1 - rain * 0.12; blur += rain * 0.3; }
  } else {
    if (tod === 'NIGHT') { if (eo.sensor === 'EON' && eo.ll) { f.push('grayscale(1)'); bri *= 0.75; con *= 1.3; } else bri *= 0.16; }
    else if (tod === 'DUSK') bri *= eo.sensor === 'EON' && eo.ll ? 0.85 : 0.5;
    if (vis && vis < 5) { blur += (5 - vis) * 0.5; con *= 0.55 + vis * 0.09; bri *= 1.05; }
    if (rain) { con *= 1 - rain * 0.2; blur += rain * 0.5; }
    if (eo.filt === 'ND') bri *= 0.6; else if (eo.filt === 'XLP') con *= 1.15; else if (eo.filt === 'LP') con *= 1.07;
    // 서치라이트가 시선 자리를 비추면 밤에도 보인다
    if (tod !== 'DAY' && _srchLights()) bri = Math.max(bri, 0.6);
  }
  if (eo.scene === 'HAZE') { con *= 1.25; blur = Math.max(0, blur - 0.6); } else if (eo.scene === 'LOW CON') con *= 1.4; else if (eo.scene === 'HIGH CON') con *= 0.8;
  if (!eo.imgAuto) { con *= 0.3 + eo.sens / 50 * 0.7; bri *= 0.3 + eo.off / 50 * 0.7; }
  blur += eoFocusBlur();
  f.push(`brightness(${bri.toFixed(2)})`, `contrast(${con.toFixed(2)})`);
  if (blur > 0.05) f.push(`blur(${blur.toFixed(1)}px)`);
  if (eo.sensor === 'IR' && eo.pol === 'BLK') f.push('invert(1)');
  return f.join(' ');
}
// 초점 — GEO FOCUS 면 거리에 맞춰 저절로(트림만큼 흐림), 아니면 FOCUS 다이얼이 거리에 맞아야 선명
function eoIdealFocus() { const p = eoAimPoint(); const r = p ? eoAngTo(p.lat, p.lon, p.hM).rng : 20000; return 100 * (1 - Math.exp(-r / 2500)); }
function eoFocusBlur() {
  const k = _mClamp(30 / Math.max(1, eoFov()), 1, 6);   // 좁게 볼수록 초점에 민감
  if (eo.geo) return Math.abs(eo.geoTrim) * 0.012 * k;
  return Math.min(8, Math.abs(eo.focus - eoIdealFocus()) * 0.05 * k);
}
function _srchLights() {
  if (typeof kgLt === 'undefined' || !kgLt.srch) return false;
  const p = eoLosPoint(); if (!p) return false;
  const a = eoAngTo(p.lat, p.lon, p.hM);
  const reach = typeof KG_SRCH !== 'undefined' ? KG_SRCH.reach : 1200;
  return a.rng < reach * 1.3 && Math.abs(normAS(a.az - kgLt.az)) < 8 && Math.abs(-a.el - kgLt.el) < 8;
}
// 선박 표적 — 지도 위에 실루엣(IR 에서는 뜨겁게). g 는 지도 그릇의 CSS px 좌표(W × H)
function _eoSprites(cv, W, H) {
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  if (!_eoMap) return;
  const el = _eoMap.getContainer(), cw = el.clientWidth || W, ch = el.clientHeight || H;
  g.setTransform(W / cw, 0, 0, H / ch, 0, 0);
  _eoSpritesG(g, cw, ch);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function _eoSpritesG(g, W, H) {
  if (!_eoMap || !eo.pwr) return;
  const fx = (W / 2) / Math.tan(eoFov() / 2 * _mD), ir = eo.sensor === 'IR', tod = (typeof env !== 'undefined' && env.tod) || 'DAY';
  const losB = normA(S.hdg + eo.az);
  for (const c of msnContacts()) {
    if (c.kind !== 'vsl' && !(ir && (c.kind === 'surv' || c.kind === 'ship'))) continue;
    const a = eoAngTo(c.lat, c.lon, c.hM);
    if (a.rng > 25000 || Math.abs(normAS(a.brg - losB)) > eoFov()) continue;
    let pt; try { pt = _eoMap.project([c.lon, c.lat]); } catch (e) { continue; }
    if (!pt || !Number.isFinite(pt.x)) continue;
    const s = fx / a.rng;                                  // m → px
    if (c.kind !== 'vsl') { if (ir) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(pt.x, pt.y - Math.max(1.5, 0.5 * s), Math.max(1.5, (c.kind === 'ship' ? 6 : 0.5) * s), 0, 2 * Math.PI); g.fill(); } continue; }
    const rel = (c.hdg - a.brg) * _mD, Lp = Math.max(2, (c.len * Math.abs(Math.sin(rel)) + c.len * 0.3 * Math.abs(Math.cos(rel))) * s);
    const hh = Math.max(1.5, c.len * 0.12 * s), cab = Math.max(1, c.len * 0.14 * s), dir = Math.sin(rel) >= 0 ? 1 : -1;
    if (!ir && tod === 'NIGHT') {   // 밤 — 항해등만
      g.fillStyle = dir > 0 ? '#3f3' : '#f33'; g.fillRect(pt.x - 1.5, pt.y - hh - cab - 2, 3, 3);
      g.fillStyle = '#fff'; g.fillRect(pt.x - 1, pt.y - hh - cab * 2 - 3, 2, 2); continue;
    }
    if (c.spd > 2 && !ir) { g.fillStyle = 'rgba(240,250,255,0.55)'; g.fillRect(pt.x - dir * Lp * 0.5 - dir * Lp * 0.9, pt.y - hh * 0.3, dir * Lp * 0.9, hh * 0.35); }   // 항적(흰 물결)
    g.fillStyle = ir ? 'rgb(225,225,225)' : '#3b4148';
    g.beginPath(); g.moveTo(pt.x - Lp / 2, pt.y - hh); g.lineTo(pt.x + Lp / 2, pt.y - hh); g.lineTo(pt.x + Lp / 2 - dir * Lp * 0.1, pt.y); g.lineTo(pt.x - Lp / 2 + dir * Lp * 0.05, pt.y); g.closePath(); g.fill();
    g.fillStyle = ir ? 'rgb(255,255,255)' : '#dfe3e6'; g.fillRect(pt.x - dir * Lp * 0.15 - Lp * 0.12, pt.y - hh - cab, Lp * 0.24, cab);
    if (ir) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(pt.x - dir * Lp * 0.38, pt.y - hh * 0.8, Math.max(1.5, Lp * 0.08), hh * 0.7); }   // 기관실 열
  }
  if (eo.laserFire && ir) { g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, H / 2, 3, 0, 2 * Math.PI); g.fill(); }   // 레이저 조사 점(IR 에서 보인다)
}
// 도 · 분 · 초(37:31:25N)
function eoDms(v, h) { const a = Math.abs(v); let d = Math.floor(a), m = Math.floor((a - d) * 60), sc = Math.round(((a - d) * 60 - m) * 60); if (sc === 60) { sc = 0; m++; } if (m === 60) { m = 0; d++; } const p2 = n => String(n).padStart(2, '0'); return `${d}:${p2(m)}:${p2(sc)}${v >= 0 ? h[0] : h[1]}`; }
function eoZoomStep() {
  if (eo.sensor === 'EOW') return Math.round(Math.log(EO_FOV.EOW[0] / eo.fovW) / Math.log(EO_FOV.EOW[0] / EO_FOV.EOW[1]) * 9) + 1;
  return eo.step[eo.sensor] + 1;
}
// EO/IR 영상 오버레이 — 흰수리 SYSTEM 창 Video(실기 사진) 배치 · 흰 글씨에 검은 테
//   왼쪽 위: 날짜 · 모드(AUTO 등은 반전) · VIC · 초점 MAN/GEO · 현지 시각 · UTC 차
//   가운데 위: 센서(EOW · EON · IR — 테두리) · 필터 표시
//   오른쪽 위: 줌 단계 · COL/WHT/BLK · AUTO/MAN · 장면(DFLT) · 감도 · 초점(∞)
//   왼쪽: 고각 띠(10° 눈금 — 01 · 00 · −01) · 가운데 작은 + · 북쪽 화살표
//   아래: ACFT 위경도 · 기수 · 고도 | 시선 방위 띠(34 35 00 01) | 표적 높이 · 거리 · LOS/LRF | 레이저 · 추적 · MAP TGT 좌표
//   full(전탐석 화면)일 때만 AVT 게이트 · MENU · PIP · CUE 를 더 그린다
function _eoHudG(g, x0, y0, W, H, full) {
  const k = _mClamp(Math.min(W / 760, H / 560), 0.45, 1.6), F = n => `${Math.round(n * k)}px Consolas, "Lucida Console", "Courier New", monospace`;
  const T = (s, x, y, al = 'left', n = 15, col = '#f4f6f4', inv = false) => {
    g.font = F(n); g.textAlign = al; g.lineJoin = 'round';
    if (inv) { const w = g.measureText(s).width, xl = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x; g.fillStyle = '#f4f6f4'; g.fillRect(xl - 3 * k, y - 13 * k, w + 6 * k, 17 * k); g.fillStyle = '#111'; g.fillText(s, x, y); return; }
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  };
  const L = x0 + 14 * k, R = x0 + W - 14 * k, cx = x0 + W / 2, cy = y0 + H / 2;
  if (!eo.pwr) { T('EO/IR OFF', cx, cy, 'center', 20, '#888'); return; }
  // ── 왼쪽 위 ──
  const now = new Date(), tzh = -now.getTimezoneOffset() / 60, loc = new Date(now.getTime() + tzh * 3600000), d2 = n => String(n).padStart(2, '0');
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mode = eo.mode === 'MAN' ? (eo.aid ? 'RAID' : 'MAN') : eo.mode === 'AVT' ? 'AVT' : eo.mode;
  T(`${d2(loc.getUTCDate())}${MON[loc.getUTCMonth()]}${loc.getUTCFullYear()}`, L, y0 + 28 * k);
  T(mode, L + 128 * k, y0 + 28 * k, 'left', 15, '#f4f6f4', mode !== 'FWD' && mode !== 'MAN');
  T('VIC', L + 196 * k, y0 + 28 * k);
  T(`${d2(loc.getUTCHours())}:${d2(loc.getUTCMinutes())}:${d2(loc.getUTCSeconds())}`, L, y0 + 46 * k);
  T(eo.geo ? 'GEO' : 'MAN', L + 196 * k, y0 + 46 * k);
  T(`UTC${tzh >= 0 ? '+' : ''}${tzh.toFixed(1)}`, L, y0 + 64 * k);
  // ── 가운데 위: 센서(테두리) ──
  const sn = eo.sensor === 'EON' ? (eo.ll ? 'EON LL' : 'EON') : eo.sensor;
  g.font = F(15); const sw = g.measureText(sn).width;
  g.strokeStyle = '#f4f6f4'; g.lineWidth = 1.5 * k; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - sw / 2 - 4 * k, y0 + 14 * k, sw + 8 * k, 19 * k); g.strokeRect(cx - sw / 2 - 4 * k, y0 + 14 * k, sw + 8 * k, 19 * k);
  T(sn, cx, y0 + 29 * k, 'center');
  if (eo.sensor !== 'IR' && eo.filt !== 'CLR') T('≋', cx, y0 + 50 * k, 'center', 13);
  if (eo.ez > 1) T(`${eo.ez}X`, cx + sw / 2 + 12 * k, y0 + 29 * k, 'left', 13);
  // ── 오른쪽 위 ──
  T(`${eoZoomStep()}  ${eo.sensor === 'IR' ? eo.pol : 'COL'}  ${eo.imgAuto ? 'AUTO' : 'MAN'}`, R - 30 * k, y0 + 28 * k, 'right');
  T(`${eo.scene === 'NORM' ? 'DFLT' : eo.scene}  ${Math.round(eo.sens)}`, R - 30 * k, y0 + 46 * k, 'right');
  const ideal = eoIdealFocus(), fc = eo.geo ? ideal + eo.geoTrim * 0.3 : eo.focus;
  T(fc >= 96 ? '∞' : String(Math.round(fc)), R, y0 + 30 * k, 'right', 17);
  // ── 북쪽 화살표 ──
  const losB = normA(S.hdg + eo.az), na = -losB * _mD, nx = L + 22 * k, ny = y0 + 0.2 * H;
  g.save(); g.translate(nx, ny); g.rotate(na);
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3.5 * k; g.beginPath(); g.moveTo(0, 14 * k); g.lineTo(0, -14 * k); g.moveTo(-4 * k, -8 * k); g.lineTo(0, -14 * k); g.lineTo(4 * k, -8 * k); g.stroke();
  g.strokeStyle = '#f4f6f4'; g.lineWidth = 1.5 * k; g.stroke();
  g.restore();
  T('N', nx + Math.sin(-na) * 0 + 9 * k, ny + 4 * k, 'left', 12);
  // ── 왼쪽 고각 띠(10° 마다 두 자리 · 사이 점) ──
  const tx = L + 4 * k, sp = 36 * k;
  for (let d = Math.floor((eo.el - 60) / 10) * 10; d <= eo.el + 60; d += 5) {
    const yy = cy - (d - eo.el) / 10 * sp;
    if (yy < y0 + 0.28 * H || yy > y0 + 0.74 * H) continue;
    if (d % 10 === 0) { const n = d / 10; T(`${n < 0 ? '-' : ''}${String(Math.abs(n)).padStart(2, '0')}-`, tx, yy + 5 * k, 'left', 14); }
    else { g.fillStyle = '#f4f6f4'; g.fillRect(tx + 28 * k, yy - 1, 2 * k, 2 * k); }
  }
  // ── 가운데 작은 + ──
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(cx - 6 * k, cy); g.lineTo(cx + 6 * k, cy); g.moveTo(cx, cy - 6 * k); g.lineTo(cx, cy + 6 * k); g.stroke();
  g.strokeStyle = '#f4f6f4'; g.lineWidth = 1.2 * k; g.stroke();
  // ── 아래 가운데 시선 방위 띠(10° 마다 두 자리) ──
  const by = y0 + H - 42 * k, bs = 34 * k;
  for (let d = Math.floor((losB - 40) / 5) * 5; d <= losB + 40; d += 5) {
    const xx = cx - (normAS(losB - d)) / 10 * bs;
    if (d % 10 === 0) { T(String(normA(d) / 10).padStart(2, '0'), xx, by, 'center', 15); g.fillStyle = '#f4f6f4'; g.fillRect(xx - 0.5, by - 22 * k, 1.5 * k, 5 * k); }
    else { g.fillStyle = '#f4f6f4'; g.fillRect(xx - 0.5, by - 20 * k, 1.5 * k, 3 * k); }
  }
  g.fillStyle = '#f4f6f4'; g.fillRect(cx - 0.75 * k, by - 28 * k, 1.5 * k, 12 * k);
  // ── 아래 왼쪽: ACFT ──
  T('ACFT', L - 4 * k, y0 + H - 62 * k);
  T(`${eoDms(S.lat, 'NS')} ${fmtA(S.hdg)}°`, L + 16 * k, y0 + H - 43 * k);
  T(`${eoDms(S.lon, 'EW')}  ${Math.round(S.alt)}FT`, L, y0 + H - 24 * k);
  // ── 표적 — 높이 · 거리 · 거리 출처 · 좌표 ──
  const p = eoAimPoint(), lrfOk = eo.lrf.st === 'VALID' && eo.lrf.rng;
  const tp = (lrfOk && eo.lrf.pt) || p;
  const rngM = lrfOk ? eo.lrf.rng : tp ? eoAngTo(tp.lat, tp.lon, tp.hM).rng : null;
  const rs = rngM == null ? '' : eo.units === 'KM' ? `${(rngM / 1000).toFixed(1)}KM` : `${(rngM / 1852).toFixed(1)}NM`;
  const mx = x0 + W * 0.69;
  T(tp ? `${Math.round((tp.hM || 0) / 0.3048)}FT` : '', mx - 70 * k, y0 + H - 16 * k, 'right');
  if (rs) T(`${rs} ${lrfOk ? 'LRF' : 'LOS'}`, mx + 50 * k, y0 + H - 16 * k, 'right');
  const lzr = eo.laserFire ? 'FIRE' : eo.laserArm ? 'ARM' : 'OFF', avt = eo.mode !== 'AVT' ? 'NONE' : eo.trk === 'LOCKED' ? 'LOCK' : eo.trk === 'ACQ' ? 'ACQ' : eo.trk;
  T(`${eo.lrf.cont ? 'CONT' : eo.lrf.st === 'RANGING' ? 'RNG' : lzr}  ${avt}`, R, y0 + H - 74 * k, 'right', 15, eo.laserFire ? '#ff6060' : '#f4f6f4');
  T('MAP TGT', R, y0 + H - 54 * k, 'right');
  if (tp) {
    T(`${fmtA(bearing(S.lat, S.lon, tp.lat, tp.lon))}°  ${eoDms(tp.lat, 'NS')}`, R, y0 + H - 36 * k, 'right');
    T(eoDms(tp.lon, 'EW'), R, y0 + H - 18 * k, 'right');
  } else {
    T(`${fmtA(losB)}°  NO TGT SOL`, R, y0 + H - 36 * k, 'right');
    T('ENABLE LRF', R, y0 + H - 18 * k, 'right');
  }
  if (eo.mode === 'STOW') { g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(x0, y0 + 80 * k, W, H - 170 * k); T('STOW', cx, cy, 'center', 22); }
  if (eo.cal > 0) { g.fillStyle = 'rgba(80,80,80,0.92)'; g.fillRect(x0, y0 + 80 * k, W, H - 170 * k); T('IR CAL', cx, cy, 'center', 20); }
  // ── AVT 게이트(조종석에도 보인다) ──
  if (eo.mode === 'AVT') {
    const gw = EO_GATE_K[eo.gate] * W / 2, b = 12 * k, col = eo.trk === 'LOCKED' ? '#ffd23a' : '#f4f6f4';
    g.strokeStyle = col; g.lineWidth = 2 * k;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { g.beginPath(); g.moveTo(cx + sx * gw, cy + sy * gw - sy * b); g.lineTo(cx + sx * gw, cy + sy * gw); g.lineTo(cx + sx * gw - sx * b, cy + sy * gw); g.stroke(); });
    if (full) T(`${eo.gate} ${eo.alg}`, cx, cy - gw - 6 * k, 'center', 12, col);
    if (eo.trk === 'LOCKED' && eo.lock && eo.lock.kind === 'obj') T(`TRK ${eo.lock.id}`, cx, cy + gw + 16 * k, 'center', 12, col);
  }
  if (!full) return;
  // ── 전탐석 화면만 ──
  if (eo.mode === 'SLEW' && eo.slewTgt) T(`CUE ${eo.slewTgt.kind === 'obj' ? eo.slewTgt.id : 'POI'}`, cx, cy + 52 * k, 'center', 13, '#ffd23a');
  if (typeof kgLt !== 'undefined' && kgLt.srch) T(`SRCH ${srch.mode === 'EO' ? 'SLAVE' : srch.mode}${srch.lim ? ' LIMIT' : ''}`, R, y0 + 92 * k, 'right', 12, srch.lim ? '#ffd23a' : '#f4f6f4');
  if (eo.pip === 'RDR') { const pc = _msnEl && _msnEl.querySelector('.msn-rdr canvas'); if (pc && pc.width) { const s2 = 150 * k; g.drawImage(pc, x0 + W - s2 - 14 * k, y0 + 100 * k, s2, s2); g.strokeStyle = '#f4f6f4'; g.lineWidth = 1; g.strokeRect(x0 + W - s2 - 14 * k, y0 + 100 * k, s2, s2); } }
  if (eo.menu) {
    const mw = 290 * k, mh = (MSN_MENU.length * 21 + 36) * k, mx2 = cx - mw / 2, my = cy - mh / 2;
    g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(mx2, my, mw, mh); g.strokeStyle = '#f4f6f4'; g.lineWidth = 1; g.strokeRect(mx2, my, mw, mh);
    T('MAIN MENU', cx, my + 20 * k, 'center', 14);
    MSN_MENU.forEach((m, i) => { const yy = my + (42 + i * 21) * k; T(m.n, mx2 + 12 * k, yy, 'left', 13, '#f4f6f4', i === eo.menuI); T(String(m.v()), mx2 + mw - 12 * k, yy, 'right', 13, i === eo.menuI ? '#ffd23a' : '#f4f6f4'); });
  }
}
function _eoHud(cv, W, H) {
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  _eoHudG(g, 0, 0, W, H, true);
}
// 레이더 화면
function _rdrDraw(cv) {
  const W = cv.width, H = cv.height; if (!(W > 0)) return;
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const c = W / 2, R = W / 2 * 0.92, C = '#3dff6a', k = W / 400;
  if (rdr.tx && rdr.pcv) g.drawImage(rdr.pcv, c - R, c - R, 2 * R, 2 * R);
  g.strokeStyle = 'rgba(61,255,106,0.45)'; g.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(c, c, R * i / 4, 0, 2 * Math.PI); g.stroke(); }
  g.font = `${Math.round(11 * k)}px monospace`; g.fillStyle = C; g.textAlign = 'center';
  const up = rdr.nup ? 0 : S.hdg;
  for (let b = 0; b < 360; b += 30) { const a = (b - up) * _mD; g.fillText(String(b).padStart(3, '0'), c + Math.sin(a) * (R + 9 * k) * 0.97, c - Math.cos(a) * (R + 9 * k) * 0.97 + 4 * k); }
  // 기수선 · 북쪽
  const ha = (S.hdg - up) * _mD; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(ha) * R, c - Math.cos(ha) * R); g.stroke();
  // 소인선
  if (rdr.tx) { const sa = rdr.ang * _mD; g.strokeStyle = 'rgba(120,255,150,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(sa) * R, c - Math.cos(sa) * R); g.stroke(); }
  const toXY = (brg, nm) => { const a = (brg - up) * _mD, r = R * nm / rdr.rng; return [c + Math.sin(a) * r, c - Math.cos(a) * r]; };
  // EO/IR 시선 · 서치라이트 방향
  if (eo.pwr && eo.mode !== 'STOW') {
    const p = eoAimPoint(), brg = normA(S.hdg + eo.az);
    g.strokeStyle = 'rgba(80,220,255,0.85)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; const [x1, y1] = toXY(brg, rdr.rng); g.beginPath(); g.moveTo(c, c); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
    if (p) { const nm = distance(S.lat, S.lon, p.lat, p.lon); if (nm < rdr.rng) { const [x, y] = toXY(bearing(S.lat, S.lon, p.lat, p.lon), nm); g.strokeStyle = '#5df'; g.beginPath(); g.arc(x, y, 5 * k, 0, 2 * Math.PI); g.stroke(); } }
  }
  if (typeof kgLt !== 'undefined' && kgLt.srch) { const [x, y] = toXY(normA(S.hdg + kgLt.az), rdr.rng * 0.5); g.strokeStyle = 'rgba(255,220,80,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c, c); g.lineTo(x, y); g.stroke(); }
  // 지정 표적
  if (rdr.tgt && rdr.paint[rdr.tgt]) {
    const P = rdr.paint[rdr.tgt]; if (P.nm <= rdr.rng) {
      const [x, y] = toXY(P.brg, P.nm), s = 9 * k; g.strokeStyle = '#ffc400'; g.lineWidth = 2; g.strokeRect(x - s, y - s, 2 * s, 2 * s);
      const T = rdr.trk[rdr.tgt]; if (T && T.spd > 1) { const [x2, y2] = toXY(...(() => { const q = destPoint(...destPoint(S.lat, S.lon, P.brg, P.nm), T.cse, T.spd / 60 * 3); return [bearing(S.lat, S.lon, q[0], q[1]), distance(S.lat, S.lon, q[0], q[1])]; })()); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); }
      g.fillStyle = '#ffc400'; g.textAlign = 'left'; g.fillText(rdr.tgt, x + s + 2, y - s);
    }
  }
  g.textAlign = 'left'; g.fillStyle = C; g.font = `bold ${Math.round(12 * k)}px monospace`;
  g.fillText(rdr.tx ? 'TX' : 'STBY', 8 * k, 16 * k); g.fillText(`${rdr.rng}NM`, 8 * k, 31 * k);
  g.textAlign = 'right'; g.fillText(`${rdr.nup ? 'N UP' : 'H UP'}  G${rdr.gain}`, W - 8 * k, 16 * k); g.fillText(`STC${rdr.stc}${rdr.ftc ? ' FTC' : ''}`, W - 8 * k, 31 * k);
  if (!rdr.tx) { g.textAlign = 'center'; g.fillStyle = '#888'; g.fillText('STANDBY — TX 를 누르십시오', c, c + 30 * k); }
}
function msnRenderHcu() {
  if (!_msnEl) return;
  _msnEl.querySelectorAll('.hcu-key').forEach(b => b.classList.toggle('dn', !!eo.holdT[b.dataset.hcu]));
  _msnEl.querySelectorAll('.hcu-tg .sw').forEach(s => { const k = s.dataset.sw; s.classList.toggle('up', k === 'pwr' ? eo.pwr : !!eo.holdT[k + ':up']); s.classList.toggle('dn', k === 'pwr' ? !eo.pwr : !!eo.holdT[k + ':dn']); });
  const avt = _msnEl.querySelector('.hcu-avt'); if (avt) avt.classList.toggle('dn', !!eo.holdT.avt);
  const lamp = (n, c) => { const e = _msnEl.querySelector(`[data-lamp="${n}"]`); if (e) e.className = 'hcu-lamp' + (c ? ' ' + c : ''); };
  lamp('on', eo.pwr ? 'g' : ''); lamp('armed', eo.pwr && eo.laserArm ? 'a' : ''); lamp('active', eo.pwr && eo.laserFire ? 'r' : '');
}
function msnRenderPanels() {
  if (!_msnEl) return;
  const set = (a, on) => { const b = _msnEl.querySelector(`[data-mact="${a}"]`); if (b) b.classList.toggle('on', !!on); };
  set('fly', S.running); const fb = _msnEl.querySelector('[data-mact="fly"]'); if (fb) fb.textContent = S.running ? '❚❚ 멈춤' : '▶ 비행';
  set('rtx', rdr.tx); set('ftc', rdr.ftc); const nb = _msnEl.querySelector('[data-mact="nup"]'); if (nb) nb.textContent = rdr.nup ? 'N UP' : 'H UP';
  const sOn = typeof kgLt !== 'undefined' && kgLt.srch;
  set('slon', sOn); set('slman', srch.mode === 'MAN'); set('sleo', srch.mode === 'EO'); set('slrdr', srch.mode === 'RDR');
  const ac = _msnEl.querySelector('[data-m="ac"]'); if (ac) ac.textContent = `HDG ${fmtA(S.hdg)}  ALT ${Math.round(S.alt)}FT  GS ${Math.round(S.spd)}KT`;
  const td = _msnEl.querySelector('[data-m="tdata"]');
  if (td) {
    const c = rdr.tgt && msnContacts().find(x => x.id === rdr.tgt), T = rdr.tgt && rdr.trk[rdr.tgt];
    td.textContent = c ? `TGT ${c.id} (${c.name})\nRNG ${distance(S.lat, S.lon, c.lat, c.lon).toFixed(2)}NM  BRG ${fmtA(bearing(S.lat, S.lon, c.lat, c.lon))}°` +
      (T && T.spd != null ? `\nCSE ${fmtA(T.cse || 0)}°  SPD ${T.spd.toFixed(1)}KT` : '\nCSE ---  SPD ---') : (rdr.tx ? '표적을 누르면 지정합니다' : '');
  }
  const sd = _msnEl.querySelector('[data-m="sdata"]');
  if (sd && typeof kgLt !== 'undefined') sd.textContent = `${sOn ? 'ON' : 'OFF'}  ${srch.mode === 'EO' ? 'EO/IR SLAVE' : srch.mode === 'RDR' ? 'RADAR SLAVE' : 'MANUAL'}${srch.lim ? '  LIMIT' : ''}\nAZ ${kgLt.az >= 0 ? '+' : ''}${kgLt.az.toFixed(0)}°  DN ${kgLt.el.toFixed(0)}°`;
}
function _msnFit(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(r.width * d), h = Math.round(r.height * d); if (w > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; } return { W: w, H: h }; }
function msnRender() {
  if (_eoNeed()) _eoCamera(); else if (_eoMap) _eoMapDrop();
  // 조종석 SYSTEM 창이 EO/IR 영상을 띄우고 있으면 자주 다시 그린다(평소 4번/초 → 10번/초)
  try {
    if (typeof sysPage !== 'undefined' && (sysPage === 'asys_video' || (typeof sysLayout !== 'undefined' && sysLayout === 'HALF' && (sysHalf.L === 'asys_video' || sysHalf.R === 'asys_video'))) && typeof videoCfg !== 'undefined' && videoCfg.ch === 'EO/IR' && (_msnFrame++ % 2 === 0)) {
      const w = document.getElementById('sysp-wrap'); if (w && !w.classList.contains('page-hidden') && w.clientWidth > 40) sysDraw();
    }
  } catch (e) { _swallow(e); }
  if (!msnOpen || !_msnEl) return;
  const vid = _msnEl.querySelector('.eo-vid'), f = eo.pwr && eo.mode !== 'STOW' ? eoVideoFilter() : 'brightness(0)';
  if (vid.style.filter !== f) vid.style.filter = f;
  const spr = _msnEl.querySelector('.eo-spr'), s = _msnFit(spr); _eoSprites(spr, s.W, s.H);
  const hud = _msnEl.querySelector('.eo-hud'), h = _msnFit(hud); _eoHud(hud, h.W, h.H);
  const rc = _msnEl.querySelector('.msn-rdr canvas'); _msnFit(rc); _rdrDraw(rc);
  if (performance.now() - _msnTickT > 300) { _msnTickT = performance.now(); msnRenderPanels(); }
}
function msnShow(on) {
  if (!MSN_ON) return;
  const R = _msnBuild();
  msnOpen = on !== undefined ? !!on : !msnOpen;
  R.classList.toggle('on', msnOpen);
  if (_eoMap) _eoHostPlace();                 // 지도를 전탐석 화면 ⇄ 화면 밖으로 옮긴다(조종석 SYSTEM 창이 계속 쓸 수 있게)
  msnRenderHcu(); msnRenderPanels();
}
// 한 걸음(전탐석이 닫혀 있어도 — 선박 · 서치라이트 연동 · 터릿 · 레이더는 계속 돈다)
let _msnT = 0, _msnFrame = 0;
function msnStep() {
  const now = performance.now(), dt = _msnT ? Math.min(0.25, (now - _msnT) / 1000) : 0; _msnT = now;
  if (!dt) return;
  const run = typeof S !== 'undefined' && S.running;
  try { if (run) _vslStep(dt * ((typeof simSpeed !== 'undefined' && Number(simSpeed)) || 1)); } catch (e) { _swallow(e); }
  try { eoStep(dt); } catch (e) { _swallow(e); }
  try { rdrStep(dt); } catch (e) { _swallow(e); }
  try { if (_slHold) srchMan(_slHold, dt); srchStep(dt); } catch (e) { _swallow(e); }
  try { msnRender(); } catch (e) { _swallow(e); }
}
// 흰수리(전탐석 · 조종석 모두)는 EO/IR 터릿이 돈다 — 조종석 SYSTEM 창 Video(EO/IR) 가 영상을 띄운다
if (EO_ON) setInterval(msnStep, 50);
if (MSN_ON) {
  // 전탐석 — CDU Video Channel 을 따로 고른 적이 없으면 EO/IR 로(조종석 SYSTEM 창 Video 에 전탐석 영상이 나온다)
  try { if (!localStorage.getItem('videoCfg') && typeof videoCfg !== 'undefined') videoCfg.ch = 'EO/IR'; } catch (e) { _swallow(e); }
  // 시작 잠금(비밀번호 · 화면 고르기)이 풀리면 전탐석을 연다 — 지도 왼쪽 아래 🎯 전탐석 으로 다시 연다
  const _open0 = setInterval(() => { if (window.gateLocked) return; clearInterval(_open0); try { msnShow(true); } catch (e) { _swallow(e); } }, 400);
  try {
    const b = document.createElement('button'); b.id = 'msn-open-btn'; b.type = 'button'; b.textContent = '🎯 전탐석';
    b.addEventListener('click', () => msnShow(true));
    (document.body ? Promise.resolve() : new Promise(r => document.addEventListener('DOMContentLoaded', r))).then(() => { _msnCss(); document.body.appendChild(b); });
  } catch (e) { _swallow(e); }
  // 조이스틱 버튼에 HCU 동작을 배정할 수 있게(12-joystick.js 설정 화면 '전탐석 HCU' 묶음)
  try {
    const add = (id, label, key, kind = 'hold') => { const a = { id, grp: '전탐석 HCU', label, kind, on: () => hcuPress(key, true), off: () => hcuPress(key, false), run: () => { hcuPress(key, true); hcuPress(key, false); } }; JOY_ACTIONS.push(a); JOY_ACT_BY_ID[id] = a; };
    add('hcuAvt', 'AVT (누름 · 1.5초 해제)', 'avt'); add('hcuLrf', 'LRF (누름 · 2초 연속)', 'lrf'); add('hcuZin', 'ZOOM ▲ 확대', 'zoom:up'); add('hcuZout', 'ZOOM ▼ 축소', 'zoom:dn');
    add('hcuVic', 'VIC 센서 바꾸기', 'vic:up', 'press'); add('hcuEz', '2X 전자 줌', 'ez', 'press'); add('hcuPol', 'POL 백상/흑상', 'pol', 'press');
    add('hcuAuto', 'STEERING AUTO', 'steer:up', 'press'); add('hcuMan', 'STEERING MANUAL', 'steer:dn', 'press'); add('hcuSlew', 'SLEW (POI)', 'slew:up', 'press');
    add('hcuFwd', 'FWD (2초 — 새 전방)', 'slew:dn'); add('hcuStow', 'STOW', 'stow', 'press'); add('hcuMap', 'MAP (POI 고르기)', 'map', 'press');
    add('hcuLaser', 'LASER (누르는 동안)', 'laser'); add('hcuAux', 'AUX — 서치라이트 EO/IR 연동', 'aux', 'press');
    const s = { id: 'hcuSrch', grp: '전탐석 HCU', label: '서치라이트 ON/OFF', kind: 'press', run: () => msnAct('slon') }; JOY_ACTIONS.push(s); JOY_ACT_BY_ID[s.id] = s;
  } catch (e) { _swallow(e); }
  try { if (typeof HELP_ITEMS !== 'undefined') HELP_ITEMS.push(['🎯 흰수리 전탐석', '시작 화면에서 "흰수리 전탐석"을 고르면 전탐석(EO/IR · SAR 레이더 · 서치라이트 · HCU 조작기) 화면이 뜬다. 기체는 흰수리 그대로 난다 — "조종석 보기"로 비행을 다루고 지도 왼쪽 아래 🎯 전탐석 으로 돌아온다. 전탐석이 움직이는 EO/IR 영상은 조종석 SYSTEM 창 Video(Channel EO/IR)에도 나온다. 전탐석 위 막대 ❓ 에 조작법.']); } catch (e) { _swallow(e); }
}
try { appRegister({ msnShow, msnAct, msnSpawn, hcuPress }); } catch (e) { _swallow(e); }
