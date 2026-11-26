'use strict';
// ══════════════════════════════════════════════════════
// 37-mission.js — 흰수리 전탐석(전술 임무 조작석 · MISSION CONSOLE)
//
// 흰수리(aw189 갈래)면 창 위 탭 'Vendor' 로 이 화면을 어느 창(분할 창 · Simple 위 막대)에나 띄운다(07-sim.js applyPanels → msnPanelSync).
// 기체는 흰수리 그대로 난다(비행계획 · 자동비행 · 교관 창) — 전탐석은 그 위에서 세 장비를 다룬다.
//   ① EO/IR 터릿(FLIR) — 3D 지형 위에 터릿 시선(방위 · 고각)과 화각으로 그린 영상 + MFD 오버레이
//      센서 EOW(광각 연속 줌) · EON(협각 단계 줌 · DL/LL) · IR(열영상 WHT/BLK) · 전자 줌 1 · 1.5 · 2 · 4X
//      조종 MAN(수동 rate) · AID(지면 고정 보조) · AUTO(지리 좌표 고정) · AVT(자동영상추적) · SLEW(표적 · POI 지향) · FWD · STOW
//      LRF(1회 · 2초 누름 연속) · LASER(ARMED 일 때) · GEO FOCUS · FOCUS · SENS · OFFSET · FILTER · SCENE · IR CAL · POL
//   ② SAR 해상 수색 레이더 — PPI(2.5초에 한 바퀴) · 거리 2~40NM · 이득 · 해면 반사 억제(STC) · 우천 억제(FTC) · HUP/NUP
//      표적(선박 · 함정 · 요구조자 · 항공기)을 누르면 지정 → 침로 · 속력(추적) → EO/IR · 서치라이트를 그리로
//   ③ 탐조등 HSL-1600 · HCU(FLM 5.22) — 수동 · AUTO(EO/IR 연동 SLASS) · 레이더 표적 연동 · VIS/IR · 빔폭 · INIT/STOW
// 조작기(HCU) — 교범 그림(면판 17개 · 상부 버튼 14개)대로 화면에 그렸고, 조이스틱 버튼에도 배정할 수 있다(12-joystick.js).
// 기준: KUH-1CG 비행교범(FLM 5.17) · 계통설명교범(SDS 23-71-00) — EO/IR HCU · MFD 오버레이 요약
// 3D 전탐석 콘솔 모형은 사진을 받은 뒤 얹는다(지금은 MFD 테두리 · 콘솔 판 모양).
// ══════════════════════════════════════════════════════
const MSN_ON = typeof acIs === 'function' && acIs('aw189');   // 흰수리면 Vendor 창(전탐석)이 있다
const EO_ON = typeof acIs === 'function' && acIs('aw189');   // 흰수리 갈래 — EO/IR 영상은 조종석 SYSTEM 창에도 나온다
const MSN_RE = 6371000 * 4 / 3;                     // 대기 굴절을 넣은 지구 반지름(m) — 시선 · 레이더 수평선
const _mD = Math.PI / 180;
const _mClamp = (v, a, b) => Math.max(a, Math.min(b, v));
function _mGndFt(lat, lon) { let f = null; try { f = terrainFtAt(lat, lon); } catch (e) { f = null; } return Number.isFinite(f) ? f : 0; }
// 지도 시점을 옮긴다 — 그대로면 손대지 않는다(jumpTo 는 같은 자리여도 지도를 다시 그려, 기체가 멈춰 있어도 초당 10번 넘게 그렸다)
//   live — 시점 말고도 그림이 바뀌는 지도(EO/IR — 탐조등 빛 · 움직이는 선박 · 요구조자): live 값(탐조등 · 환경)이 바뀌면 곧바로,
//          그대로여도 초당 4번은 다시 그린다(종전 초당 20번)
function _mJump(map, o, live, dyn = true) {
  const key = JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(6) : v) + (live === undefined ? '' : '|' + live), now = performance.now();
  if (map._mJumpKey === key) {
    if (live !== undefined && dyn && now - (map._mRepT || 0) > 250) { map._mRepT = now; try { map.jumpTo(o); } catch (e) { _swallow(e); } }   // (다시 그리기만으로는 탐조등 빛 · 지형이 덜 따라와 시점을 다시 건다)
    return;
  }
  map._mJumpKey = key; map._mRepT = now;
  map.jumpTo(o);
}
// 시점이 그대로여도 그림이 움직이는가 — 탐조등이 켜졌거나 · 선박 · 요구조자 · 교통이 있거나 · 비행 중
function _eoDyn() {
  try { return !!(hsl.lit || msnVsl.length || (typeof S !== 'undefined' && S.running) || (typeof sar !== 'undefined' && sar.on) || (typeof traffic !== 'undefined' && traffic.length)); } catch (e) { return true; }
}
// EO/IR 지도 그림에 들어가는 것 — 탐조등 · 환경(시간대 · 시정 · NVG)
function _eoLiveKey() {
  let e = ''; try { if (typeof env !== 'undefined') e = [env.tod, env.vis, env.nvg, env.rain].join(','); } catch (er) { _swallow(er); }
  return [hsl.lit ? 1 : 0, hsl.ir ? 1 : 0, Math.round(hsl.az), Math.round(hsl.el), Math.round(hsl.focus * 10), e].join(',');
}
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
// ══ ② 탐색레이더 — Seaspray 5000E(Osprey) · VCCP 조작기 (KUH-1CG FLM 5.20 · SDS 34-47-01) ══
//   X 대역 9.45~10.00GHz · 최대 200NM · 표적 200개 자동 추적 · 전원 DC-ESS BUS 1(RADAR) · 다시 켜면 90초 예열
//   안테나: 기계 스캔 ±60° + 전자 스캔(E-scan) ±120° — 부채꼴(Sector) 화면 · 스캔 폭 120 · 60 · 20 · 240°
//   모드: LRS(장거리 해상 · 해면 클러터 억제 · FREEZE) · WX(강수 밀도 색) · PT(소형 표적 자동 추적) · SART(수색구조 트랜스폰더) · ISAR(표적 영상)
//   제어 권한(RDR > CMD): CKPT(조종실 · 처음) · CABIN(전탐석) · SHARED(함께) — CKPT 이면 전탐석 VCCP 는 CMD 말고는 듣지 않는다
//   화면: 위 Hdg · Trk · SRV RDR CMD · RNG · Tilt · Gain / 아래 Alt · RAlt · GS · 위경도 · 커서 거리 · 방위 / RDR TX · STBY · FREEZE · R ONLY · NO ALT · NO HDG · NO POS
const RDR_RNG = [10, 20, 50, 100, 200];
const RDR_MODES = ['PT', 'LRS', 'WX', 'TURB', 'SART', 'STM', 'MTI', 'ISAR'];   // FLM 5.20 표 4 — PT · LRS · WX · TURB · SART · STM(탐색 · 추적) · MTI(움직이는 표적) · ISAR
const RDR_CMD_NM = { CKPT: 'CKPT', CABIN: 'CABIN', SHARED: 'INTRLV' };   // RDR > CMD — INTRLV(번갈아 · 함께 쓰기)는 안에서 SHARED
const _rdrWx = () => rdr.mode === 'WX' || rdr.mode === 'TURB';
const RDR_CMDS = ['CKPT', 'CABIN', 'SHARED'];
const RDR_SECTORS = [120, 60, 20, 240];
const RDR_SWEEP = 45;                                  // 스캔 속도(°/s)
const RDR_WARM_S = 90;                                 // 다시 켠 뒤 예열(초)
const RDR_RPM_S = 2 * 120 / RDR_SWEEP;                 // 한 번 오가는 시간(초) — 칠해진 표적이 살아 있는 시간에 쓴다
const rdr = { pwr: true, warm: 0, tx: false, mode: 'LRS', cmd: 'CKPT', rng: 20, tilt: 0, gain: 15, sector: 120, frz: false, ronly: false, wxr: false, tws: true,
  az: 0, dir: 1, cur: { az: 0, nm: 10 }, tgt: null, trkNo: {}, nTrk: 0, menu: null, menuI: 0, paint: {}, trk: {}, pcv: null, wx: null,
  sub: null, subI: 0, menuT: 0, agc: false, sts: false, tails: false, grey: false, link: false, flt: 'ALL', lblAll: true, info: '', infoT: 0 };
// 전탐석 VCCP 가 다룰 수 있는가 — 제어 권한
function rdrCabinOk() { return rdr.cmd !== 'CKPT'; }
function rdrPower(on) { rdr.pwr = !!on; if (rdr.pwr) rdr.warm = RDR_WARM_S; else { rdr.tx = false; rdr.warm = 0; } }
function rdrTx(on) {
  if (on && (!rdr.pwr || rdr.warm > 0)) { _mToast(rdr.pwr ? `RDR 예열 중 — ${Math.ceil(rdr.warm)}초` : 'RDR 전원 꺼짐'); return false; }
  rdr.tx = !!on; _mNote(`레이더 ${rdr.tx ? 'TX' : 'STBY'}`); return true;
}
// 그 표적을 이 레이더가 볼 수 있는 거리(NM) — 수평선(안테나 · 표적 높이) · 반사 면적 · 해상 상태 · 이득 · 모드
function rdrDetNm(c) {
  const hA = Math.max(10, Number(S.alt) || 0), hT = c.kind === 'air' ? Math.max(10, c.hM / 0.3048) : Math.max(3, c.len * 0.5 / 0.3048 * 0.3);
  const horizon = 1.23 * (Math.sqrt(hA) + Math.sqrt(hT));
  const sea = (typeof env !== 'undefined' && env.sea) || 0;
  let rcsNm = c.kind === 'surv' ? Math.max(0.3, 1.6 * (1 - sea / 7)) : c.rcs * (1 - sea * 0.06);
  if (rdr.mode === 'LRS') rcsNm *= c.kind === 'surv' ? 0.7 : 1.6;           // 장거리 — 큰 표적은 멀리 · 아주 작은 것은 클러터 억제에 묻힌다
  else if (rdr.mode === 'PT') rcsNm *= c.rcs <= 10 ? 1.4 : 1;               // 소형 표적 우선
  else if (rdr.mode === 'MTI' && !(c.spd > 1)) return 0;                      // MTI — 멈춰 있는 것은 걸러 낸다
  else if (_rdrWx()) rcsNm *= 0.5;
  rcsNm *= 0.55 + rdr.gain / 30 * 0.6;
  // 기울기 — 표적 높이 쪽에서 멀어질수록 약해진다(해상 표적은 0° 근처 · 위로 들면 약해진다)
  rcsNm *= Math.max(0.3, 1 - Math.abs(rdr.tilt - (c.kind === 'air' ? 2 : -1)) / 35);
  return Math.min(horizon, rcsNm);
}
// 강수 구역(비가 오면 둘레에 몇 개) — WX 모드 · WXR 겹
function _rdrWxCells() {
  const rain = (typeof env !== 'undefined' && env.rain) || 0;
  if (!rain) { rdr.wx = null; return []; }
  if (!rdr.wx || rdr.wx.rain !== rain) {
    const cells = [];
    for (let i = 0; i < 3 + rain * 2; i++) { const [la, lo] = destPoint(S.lat, S.lon, (i * 137) % 360, 6 + (i * 23) % 60); cells.push({ lat: la, lon: lo, r: 3 + (i % 3) * 3, k: Math.min(1, 0.35 + rain * 0.25 + (i % 2) * 0.2) }); }
    rdr.wx = { rain, cells };
  }
  return rdr.wx.cells;
}
function rdrStep(dt) {
  if (rdr.pwr && rdr.warm > 0) rdr.warm = Math.max(0, rdr.warm - dt);
  if (rdr.menu && rdr.menuT && performance.now() - rdr.menuT > 10000) { rdr.menu = null; rdr.sub = null; }   // 10초 동안 조작이 없으면 메뉴를 닫는다(FLM 5.20 NOTE)
  if (rdr.agc) { const sea = (typeof env !== 'undefined' && env.sea) || 0; rdr.gain = _mClamp(Math.round(17 - sea * 1.5), 6, 22); }   // AUTO GAIN — 해면 상태에 맞춰
  if (!rdr.tx || !rdr.pwr) return;
  if (rdr.frz) return;                                 // FREEZE — 화면을 붙든다(안테나는 돌지만 그림을 바꾸지 않는다)
  // 부채꼴 스캔 — 기수 기준 ±sector/2 를 오간다
  const half = rdr.sector / 2, a0 = rdr.az;
  let a1 = a0 + rdr.dir * RDR_SWEEP * dt;
  if (a1 >= half) { a1 = half; rdr.dir = -1; } else if (a1 <= -half) { a1 = -half; rdr.dir = 1; }
  rdr.az = a1;
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  const now = performance.now();
  for (const c of msnContacts()) {
    const brg = bearing(S.lat, S.lon, c.lat, c.lon), nm = distance(S.lat, S.lon, c.lat, c.lon), rel = normAS(brg - S.hdg);
    if (rel < lo || rel > hi) continue;
    if (nm > rdrDetNm(c) || nm > RDR_RNG[RDR_RNG.length - 1]) { if (!rdr.trkNo[c.id]) delete rdr.paint[c.id]; continue; }
    rdr.paint[c.id] = { brg, nm, t: now, kind: c.kind, rcs: c.rcs };
    const T = rdr.trk[c.id] || (rdr.trk[c.id] = { h: [] });
    T.h.push({ lat: c.lat, lon: c.lon, t: now }); if (T.h.length > 4) T.h.shift();
    if (T.h.length >= 2) {
      const a = T.h[0], b = T.h[T.h.length - 1], hrs = (b.t - a.t) / 3600000;
      if (hrs > 0) { T.spd = distance(a.lat, a.lon, b.lat, b.lon) / hrs; T.cse = bearing(a.lat, a.lon, b.lat, b.lon); }
    }
    // PT — 소형 표적은 저절로 추적
    if (((rdr.mode === 'PT' && c.rcs <= 10) || rdr.mode === 'STM') && !rdr.trkNo[c.id]) rdrTrack(c.id, true);   // STM — 잡히는 대로 추적
    if (rdr.trkNo[c.id]) { T.tail = T.tail || []; const L = T.tail[T.tail.length - 1]; if (!L || now - L.t > 4000) { T.tail.push({ lat: c.lat, lon: c.lon, t: now }); if (T.tail.length > 10) T.tail.shift(); } }   // 꼬리(CONTACT TAILS)
  }
  _rdrPaintBeam(lo, hi - lo, dt);
}
// 잔상 캔버스 — 기수 기준(가운데가 안테나). 한 줄씩: 육지(TWS) · 해면 반사 · 강수 · 잡음 · 표적
function _rdrPaintBeam(a0, sweep, dt) {
  const N = 360;
  if (!rdr.pcv) { rdr.pcv = document.createElement('canvas'); rdr.pcv.width = rdr.pcv.height = N; }
  const g = rdr.pcv.getContext('2d'), c = N / 2, R = N / 2 - 2;
  g.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-dt / (rdr.sts ? 7 : 2.4))).toFixed(3)})`; g.fillRect(0, 0, N, N);   // STS(Scan-To-Scan) — 잔상을 오래
  const sea = (typeof env !== 'undefined' && env.sea) || 0, gk = rdr.gain / 30;
  const clutNm = rdr.mode === 'MTI' ? 0 : (0.3 + sea * 0.45) * (rdr.mode === 'LRS' ? 0.35 : 1) * Math.max(0.2, 1 - rdr.tilt / 30);   // MTI — 해면 반사 · 육지는 걸러 낸다
  const cells = (_rdrWx() || rdr.wxr) ? _rdrWxCells() : [];
  const steps = Math.max(1, Math.ceil(sweep / 1.2));
  for (let s = 0; s <= steps; s++) {
    const rel = a0 + sweep * s / steps, brg = normA(rel + S.hdg);
    const sx = Math.sin(rel * _mD), sy = -Math.cos(rel * _mD);
    const bins = 56;
    for (let b = 1; b <= bins; b++) {
      const nm = rdr.rng * b / bins, r = R * b / bins;
      let v = 0, col = '80,255,120';
      const [la, lo] = destPoint(S.lat, S.lon, brg, nm);
      if (!_rdrWx() && rdr.mode !== 'MTI' && !_mWater(la, lo)) v = Math.max(v, 0.5 + 0.4 * gk);                                     // 육지 반사(해안선)
      if (nm < clutNm && Math.random() < (1 - nm / clutNm) * 0.8 * gk) v = Math.max(v, 0.25 + 0.5 * Math.random());   // 해면 반사
      for (const w of cells) { const d = distance(la, lo, w.lat, w.lon); if (d < w.r) { const k = w.k * (1 - d / w.r); const wk = rdr.mode === 'TURB' ? (k > 0.45 ? '255,60,255' : '40,120,60') : k > 0.6 ? '255,60,60' : k > 0.35 ? '255,200,0' : '40,200,60'; if (k > v || _rdrWx()) { v = Math.max(v, 0.35 + k * 0.6); col = wk; } } }
      if (Math.random() < gk * gk * 0.02) v = Math.max(v, 0.2);                                                         // 잡음
      if (rdr.grey && col === '80,255,120') col = '205,215,205';   // GREY-GREEN — 회색 화면
      if (v > 0) { g.fillStyle = `rgba(${col},${v.toFixed(2)})`; g.fillRect(c + sx * r - 1.5, c + sy * r - 1.5, 3.2, 3.2); }
    }
  }
  // 표적 — 반사 면적만큼 크게
  const now = performance.now();
  for (const [, p] of Object.entries(rdr.paint)) {
    if (now - p.t > 120 || p.nm > rdr.rng) continue;
    const rel = normAS(p.brg - S.hdg), r = R * p.nm / rdr.rng;
    const sz = p.kind === 'surv' ? 2.5 : Math.min(8, 2.2 + p.rcs / 6) * Math.max(0.5, 20 / rdr.rng);
    g.fillStyle = p.kind === 'air' ? 'rgba(160,255,255,0.95)' : rdr.grey ? 'rgba(235,235,235,1)' : 'rgba(190,255,190,1)';
    g.beginPath(); g.arc(c + Math.sin(rel * _mD) * r, c - Math.cos(rel * _mD) * r, Math.max(1.8, sz), 0, 2 * Math.PI); g.fill();
  }
}
function rdrClearPicture() { if (rdr.pcv) rdr.pcv.getContext('2d').clearRect(0, 0, rdr.pcv.width, rdr.pcv.height); }
function rdrRngStep(d) { const i = RDR_RNG.indexOf(rdr.rng); rdr.rng = RDR_RNG[_mClamp((i < 0 ? 1 : i) + d, 0, RDR_RNG.length - 1)]; rdr.cur.nm = Math.min(rdr.cur.nm, rdr.rng); rdrClearPicture(); if (rdr.link) rdrLinkMap(); }
// LINK R — 전탐석 지도(NAVI) 거리를 레이더 거리에 맞춘다
function rdrLinkMap() { try { nv.nm = NV_RNG.reduce((b, v) => Math.abs(v - rdr.rng / 2) < Math.abs(b - rdr.rng / 2) ? v : b, NV_RNG[0]); } catch (e) { _swallow(e); } }
// 추적(TRK) — 번호를 붙인다(최대 200)
function rdrTrack(id, on) {
  if (on) { if (!rdr.trkNo[id]) { if (Object.keys(rdr.trkNo).length >= 200) return false; rdr.trkNo[id] = ++rdr.nTrk; } rdr.tgt = id; _mNote(`레이더 추적 TRK${String(rdr.trkNo[id]).padStart(2, '0')} — ${id}`); }
  else { delete rdr.trkNo[id]; if (rdr.tgt === id) rdr.tgt = null; }
  return true;
}
// 기수 기준 방위 · 거리 자리에 가까운 표적
function rdrNearRB(rel, nm) {
  const [la, lo] = destPoint(S.lat, S.lon, normA(rel + S.hdg), nm);
  let best = null, bd = rdr.rng * 0.06;
  const now = performance.now();
  for (const [id, p] of Object.entries(rdr.paint)) {
    if (now - p.t > RDR_RPM_S * 1000 * 1.5 && !rdr.trkNo[id]) continue;
    const [pa, po] = destPoint(S.lat, S.lon, p.brg, p.nm);
    const d = distance(la, lo, pa, po); if (d < bd) { bd = d; best = id; }
  }
  return best;
}
// 화면에서 누른 자리(기수 기준 방위 · 거리)의 표적을 지정하고 추적한다
function rdrPickRB(rel, nm) {
  rdr.cur = { az: _mClamp(normAS(rel), -120, 120), nm: _mClamp(nm, 0, rdr.rng) };
  const id = rdrNearRB(rel, nm);
  if (id) rdrTrack(id, true); else rdr.tgt = null;
  return id;
}
// 커서 자리의 표적 추적 · 풀기(VCCP 누름)
function rdrCursorTrk() {
  const id = rdrNearRB(rdr.cur.az, rdr.cur.nm);
  if (!id) { _mToast('커서 자리에 표적이 없습니다'); return null; }
  if (rdr.trkNo[id] && rdr.tgt === id) rdrTrack(id, false); else rdrTrack(id, true);
  return id;
}
function rdrSlaveEo() { if (!rdr.tgt) { _mToast('먼저 레이더 표적을 지정(추적)하십시오'); return false; } eoSlewTo({ kind: 'obj', id: rdr.tgt }); return true; }
// SART — 수색구조 트랜스폰더(요구조자) 응답: 바깥쪽으로 점 12개(0.64NM 간격)
function rdrSartReply() {
  if (rdr.mode !== 'SART' || !rdr.tx || typeof sar === 'undefined' || !sar.on || sar.lat === null || sar.state === 'aboard') return null;
  const nm = distance(S.lat, S.lon, sar.lat, sar.lon); if (nm > 10) return null;
  return { brg: bearing(S.lat, S.lon, sar.lat, sar.lon), nm };
}
// ══ 메뉴 — FLM 5.20 · SDS 34-47-01 표 2(메인 페이지 메뉴) · 표 4(레이더 화면 메뉴) ══
//   FNC 를 누르면 레이더 화면 왼쪽에 세로 메뉴가 뜨고, ▷ 가 붙은 항목을 누르면(VCCP 손잡이 누름) 바로 오른쪽에 하위 메뉴가 뜬다
//   손잡이 돌림 — 고르기 · 누름 — 실행 / 하위 메뉴 열기 · ESC · CLR — 하위 메뉴 닫기 → 메뉴 닫기 · FNC — 메뉴 켜고 끄기
//   10초 동안 아무 조작이 없으면 저절로 닫힌다(교범 NOTE) · MAP 키는 지도 겹 메뉴(종전 그대로)
const _rdrTog = (n, k, after) => ({ n, v: () => rdr[k] ? 'ON' : 'OFF', set: () => { rdr[k] = !rdr[k]; if (after) after(); } });
const _rdrInfo = t => { rdr.info = t; rdr.infoT = performance.now(); _mNote('레이더 ' + t); };
// 추적 목록(번호 차례) · 커서 둘레의 표적
function _rdrTrkList() { return Object.entries(rdr.trkNo).sort((a, b) => a[1] - b[1]).map(([id]) => id); }
function _rdrFltOk(p) { return rdr.flt === 'ALL' || (rdr.flt === 'AIR' ? p.kind === 'air' : p.kind !== 'air'); }
function _rdrInArea() {
  const out = [], rad = Math.max(0.5, rdr.rng * 0.15), [cl, cn] = destPoint(S.lat, S.lon, normA(rdr.cur.az + S.hdg), rdr.cur.nm);
  for (const [id, p] of Object.entries(rdr.paint)) { const [la, lo] = destPoint(S.lat, S.lon, p.brg, p.nm); if (distance(cl, cn, la, lo) <= rad && _rdrFltOk(p)) out.push(id); }
  return out;
}
function _rdrSelTrk(id) { if (!id) { _mToast('추적 중인 표적이 없습니다'); return; } rdr.tgt = id; const p = rdr.paint[id]; if (p) rdr.cur = { az: _mClamp(normAS(p.brg - S.hdg), -rdr.sector / 2, rdr.sector / 2), nm: Math.min(rdr.rng, p.nm) }; }
const RDR_MAIN = [
  { n: 'RDR RNG +', v: () => `${rdr.rng}NM`, set: () => rdrRngStep(1) },
  { n: 'RDR RNG -', v: () => `${rdr.rng}NM`, set: () => rdrRngStep(-1) },
  { n: 'MODE', v: () => rdr.mode, sub: RDR_MODES.map(m => ({ n: m, v: () => rdr.mode === m ? '●' : '', set: () => { rdr.mode = m; rdrClearPicture(); } })) },
  { n: 'CMD', any: true, v: () => RDR_CMD_NM[rdr.cmd], sub: RDR_CMDS.map(c => ({ n: RDR_CMD_NM[c], any: true, v: () => rdr.cmd === c ? '●' : '', set: () => { rdr.cmd = c; _mNote(`RDR > CMD ${RDR_CMD_NM[c]}`); } })) },
  { n: 'R SET', v: () => '', sub: [
    { n: 'TILT +', v: () => `${rdr.tilt > 0 ? '+' : ''}${rdr.tilt}°`, set: () => { rdr.tilt = _mClamp(rdr.tilt + 1, -30, 30); } },
    { n: 'TILT -', v: () => `${rdr.tilt > 0 ? '+' : ''}${rdr.tilt}°`, set: () => { rdr.tilt = _mClamp(rdr.tilt - 1, -30, 30); } },
    { n: 'GAIN +', v: () => rdr.agc ? 'AUTO' : String(rdr.gain), set: () => { rdr.agc = false; rdr.gain = _mClamp(rdr.gain + 1, 0, 30); } },
    { n: 'GAIN -', v: () => rdr.agc ? 'AUTO' : String(rdr.gain), set: () => { rdr.agc = false; rdr.gain = _mClamp(rdr.gain - 1, 0, 30); } },
    _rdrTog('AUTO GAIN', 'agc'), _rdrTog('STS', 'sts'), _rdrTog('CONTACT TAILS', 'tails'), _rdrTog('GREY-GREEN', 'grey', rdrClearPicture),
    _rdrTog('LINK R', 'link', () => { if (rdr.link) rdrLinkMap(); }),
  ] },
  { n: 'TRACK', v: () => `${Object.keys(rdr.trkNo).length}`, sub: [
    { n: 'MK TRK', v: () => '', set: () => rdrCursorTrk() },
    { n: 'IN AREA', v: () => '', set: () => { const L = _rdrInArea(); L.forEach(id => rdrTrack(id, true)); _rdrInfo(`IN AREA — ${L.length}개 추적`); } },
    { n: 'EX AREA', v: () => '', set: () => { const L = _rdrInArea().filter(id => rdr.trkNo[id]); L.forEach(id => rdrTrack(id, false)); _rdrInfo(`EX AREA — ${L.length}개 풀기`); } },
    { n: 'DEL ALL', v: () => '', set: () => { rdr.trkNo = {}; rdr.tgt = null; _rdrInfo('DEL ALL — 추적 모두 지움'); } },
    { n: 'FILTER', v: () => rdr.flt, set: () => { rdr.flt = { ALL: 'SURF', SURF: 'AIR', AIR: 'ALL' }[rdr.flt]; } },
  ] },
  { n: 'SCN/BLK', v: () => `${rdr.sector}°`, sub: [
    { n: 'BLN 20°', v: () => rdr.sector === 20 ? '●' : '', set: () => { rdr.sector = 20; rdrClearPicture(); } },
    { n: 'BLN 60°', v: () => rdr.sector === 60 ? '●' : '', set: () => { rdr.sector = 60; rdrClearPicture(); } },
    { n: 'MAP OVERLAY', v: () => rdr.ronly ? 'OFF' : 'ON', set: () => { rdr.ronly = !rdr.ronly; } },
    { n: 'SEARCH', v: () => rdr.sector === 240 ? '●' : '', set: () => { rdr.sector = 240; rdrClearPicture(); } },
    { n: 'SCAN 120°', v: () => rdr.sector === 120 ? '●' : '', set: () => { rdr.sector = 120; rdrClearPicture(); } },
  ] },
  { n: 'SEARCH', v: () => '', sub: [
    ...[1, 2, 3, 4, 5, 6].map(n => ({ n: `USER ${n}`, v: () => { const id = _rdrTrkList()[n - 1]; return id ? `TRK${String(rdr.trkNo[id]).padStart(2, '0')}` : '—'; }, set: () => _rdrSelTrk(_rdrTrkList()[n - 1]) })),
    _rdrTog('ALL', 'lblAll'),
    { n: 'BY DISTANCE', v: () => '', set: () => { const L = _rdrTrkList().filter(id => rdr.paint[id]).sort((a, b) => rdr.paint[a].nm - rdr.paint[b].nm); _rdrSelTrk(L[0]); } },
    { n: 'STEER CAM', v: () => '', set: () => rdrSlaveEo() },
  ] },
  { n: 'MAINT', v: () => '', sub: [
    { n: 'FAULTS LOG', v: () => '', set: () => { let f = []; try { if (typeof instFail !== 'undefined') { if (instFail.alt !== null) f.push('NO ALT'); if (instFail.hdg) f.push('NO HDG'); } } catch (e) { _swallow(e); } _rdrInfo(`FAULTS LOG — ${f.length ? f.join(' · ') : 'NO FAULTS'}`); } },
    { n: 'SYS BIT RESULT', v: () => '', set: () => _rdrInfo(rdr.pwr ? 'BIT T3 PASS · T4 PASS · T5 PASS · T6 PASS' : 'BIT — RDR OFF') },
    { n: 'RDR NAV', v: () => '', set: () => { let h = 'AHRS'; try { if (typeof instFail !== 'undefined' && instFail.hdg) h = 'NO HDG'; } catch (e) { _swallow(e); } _rdrInfo(`RDR NAV — POS GPS · HDG ${h} · ALT ${Math.round(S.alt)}FT`); } },
  ] },
  { n: 'RDR TX', v: () => rdr.tx ? '✓' : 'STBY', set: () => rdrTx(!rdr.tx) },
  { n: 'R ONLY', v: () => rdr.ronly ? '✓' : '', set: () => { rdr.ronly = !rdr.ronly; } },
  { n: 'FREEZE', v: () => rdr.frz ? '✓' : '', set: () => { rdr.frz = !rdr.frz; } },
];
const RDR_MENU = {
  FNC: RDR_MAIN,
  MAP: [
    { n: 'WXR LAYER', v: () => rdr.wxr ? 'ON' : 'OFF', set: () => { rdr.wxr = !rdr.wxr; } },
    { n: 'TWS TERRAIN', v: () => rdr.tws ? 'ON' : 'OFF', set: () => { rdr.tws = !rdr.tws; } },
    { n: 'R ONLY', v: () => rdr.ronly ? 'ON' : 'OFF', set: () => { rdr.ronly = !rdr.ronly; } },
    { n: 'RANGE', v: () => `${rdr.rng} NM`, set: d => rdrRngStep(d || 1), def: () => { rdr.rng = 20; rdrClearPicture(); } },
  ],
};

// ══ ③ 탐조등 HSL-1600 · 수동제어장치(HCU) — FLM 5.22 · SDS 33-41-06 ══
//   중앙동체 왼쪽 바깥 · 1,600W(5,000 lx) · 가시광(VIS) · 적외선(IR) 한 램프 · 빔폭 4°(Spot) ~ 13°(Flood)
//   구동: 고각 −20° ~ −90°(아래) · 방위 −150°(왼쪽) ~ +30°(오른쪽) · 전원 SEARCH LT PWR(28V DC · 65A · 승객실 항전장비실)
//   LAMP ON → 5초 안에 켜진다 · 끄면 냉각팬 7분(그동안 전원을 끊지 않는다) · INIT/STOW(STOW 25초 · 램프 끄고 연동 풀고 −90°)
//   MAN/AUTO — AUTO 는 EO/IR 터릿 연동(SLASS) · 경고: 10ft(3.04m) 안의 물체를 비추면 100~300℃ — 사람 · 가연물 금지
//   주의: NVG 를 쓴 조종사의 허락 없이 가시광으로 켜지 않는다 · 조종석 컬렉티브 SRCH LT(35-kuhgrip.js kgLt)와는 다른 등이다
const HSL_LDG_K = 2, HSL_LDG_REACH = 10;   // 외장형 탐조등 — 착륙등의 2배 밝기 · 10배 거리
const HSL = { azMin: -150, azMax: 30, elMin: -90, elMax: -20, azRate: 25, elRate: 20, fMin: 4, fMax: 13, ignS: 5, stowS: 25, initS: 8, coolS: 420, reach: 1500, hazM: 3.04 };
const hsl = { pwr: true, lamp: false, lit: false, ign: 0, ir: false, az: 0, el: -90, focus: 8, stowed: true, mv: null, cool: 0, fault: false, haz: false, _hazT: 0 };
const srch = { mode: 'MAN', lim: false };            // MAN · EO(EO/IR 연동 — AUTO) · RDR(레이더 지정 표적)
function hslLampSet(on) {
  if (on) {
    if (!hsl.pwr) { _mToast('SEARCH LT PWR 꺼짐'); return false; }
    if (hsl.stowed || hsl.mv) { _mToast(hsl.mv ? `탐조등 ${hsl.mv.to} 중 — 기다리십시오` : '탐조등 STOW — INIT 으로 먼저 푸십시오'); return false; }
    if (!hsl.ir && typeof env !== 'undefined' && env.nvg) _mToast('⚠ 주의 — NVG 를 쓴 조종사의 허락 없이 가시광(VIS)으로 켜지 마십시오');
    if (!hsl.lamp) { hsl.lamp = true; hsl.ign = HSL.ignS; _mNote(`탐조등 LAMP ON(${hsl.ir ? 'IR' : 'VIS'})`); }
  } else if (hsl.lamp) { hsl.lamp = false; hsl.lit = false; hsl.ign = 0; hsl.cool = HSL.coolS; _mNote('탐조등 LAMP OFF — 냉각팬 7분'); }
  return true;
}
function hslPwrSet(on) {
  if (!on && hsl.pwr && (hsl.lamp || hsl.cool > 0)) { hsl.fault = true; _mToast('⚠ 냉각팬이 도는 중 전원을 끊었습니다 — 램프 소등 뒤 7분 기다려야 합니다(FAULT)'); }
  hsl.pwr = !!on;
  if (!hsl.pwr) { hsl.lamp = false; hsl.lit = false; hsl.ign = 0; hsl.cool = 0; srch.mode = 'MAN'; }
}
function hslStow() { hsl.autoLamp = false; hslLampSet(false); srch.mode = 'MAN'; if (!hsl.pwr) return; hsl.mv = { to: 'STOW', t: HSL.stowS, az0: hsl.az, el0: hsl.el, T: HSL.stowS }; _mNote('탐조등 STOW(25초)'); }
function hslInit() { if (!hsl.pwr) { _mToast('SEARCH LT PWR 꺼짐'); return; } hsl.mv = { to: 'INIT', t: HSL.initS, az0: hsl.az, el0: hsl.el, T: HSL.initS }; hsl.fault = false; _mNote('탐조등 INIT'); }
// ── 조종석 컬렉티브 SRCH LT · SRCH CTR(35-kuhgrip.js) · 배정한 조이스틱 단추 — 같은 외장형 탐조등을 다룬다 ──
//   SRCH LT: 꺼져 있으면 — 접혀(STOW) 있으면 INIT(8초) 뒤 저절로 켠다 · 켜져 있으면 끈다(냉각팬 7분)
//   SRCH CTR ◀▶▲▼: 수동(MAN)으로 돌린다(EO/IR · 레이더 연동은 풀린다) — 방위 −150~+30° · 고각 −90~−20°
function hslLink() { return EO_ON; }
function hslGripLamp() {
  if (hsl.lamp || hsl.autoLamp) { hsl.autoLamp = false; hslLampSet(false); return false; }
  if (!hsl.pwr) hslPwrSet(true);
  if (hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW')) { hsl.autoLamp = true; hslInit(); _mToast('탐조등 INIT — 8초 뒤 켜집니다'); return true; }
  if (hsl.mv) { hsl.autoLamp = true; return true; }
  return hslLampSet(true);
}
function hslGripMove(dir, dt) { srchMan(dir, dt); }
function hslGripState() { return { on: !!(hsl.lamp || hsl.autoLamp), lit: hsl.lit, az: hsl.az, el: -hsl.el, mode: srch.mode }; }
function srchMode(m) { srch.mode = m; _mNote(`탐조등 ${m === 'EO' ? 'AUTO — EO/IR 연동(SLASS)' : m === 'RDR' ? '레이더 표적 연동' : 'MAN'}`); }
function hslStep(dt) {
  if (hsl.mv) {   // INIT(0° · −45°) · STOW(0° · −90°) — 걸린 시간만큼 고르게 옮긴다
    const M = hsl.mv; M.t -= dt; const f = Math.max(0, Math.min(1, 1 - M.t / M.T)), el1 = M.to === 'STOW' ? -90 : -45;
    hsl.az = M.az0 + (0 - M.az0) * f; hsl.el = M.el0 + (el1 - M.el0) * f;
    if (M.t <= 0) { hsl.az = 0; hsl.el = el1; hsl.stowed = M.to === 'STOW'; hsl.mv = null; if (M.to === 'INIT' && hsl.autoLamp) { hsl.autoLamp = false; hslLampSet(true); } }
  }
  if (hsl.lamp && hsl.ign > 0) { hsl.ign -= dt; if (hsl.ign <= 0) { hsl.ign = 0; hsl.lit = true; } }
  if (!hsl.lamp && hsl.cool > 0) hsl.cool = Math.max(0, hsl.cool - dt);
  // 10ft 열 위험 — 켜진 빛이 3.04m 안에 닿는가(지면 · 해면까지 비스듬한 거리)
  let agl = 1000; try { agl = radarAltFt(); } catch (e) { agl = 1000; }
  const slant = (agl * 0.3048) / Math.max(0.05, Math.sin(-hsl.el * _mD));
  const haz = hsl.lit && slant <= HSL.hazM;
  if (haz && !hsl.haz && performance.now() - hsl._hazT > 5000) { hsl._hazT = performance.now(); _mToast('⚠ WARNING — 탐조등이 10ft(3.04m) 안을 비춥니다: 100~300℃ — 사람 · 가연물 금지'); _mNote('탐조등 10ft 열 위험'); }
  hsl.haz = haz;
}
// 3D 빛 무리(35-kuhgrip.js kgBeams → 29-env.js envBeams) — IR 은 NVG 로만 보인다 · 좁힐수록 밝고 멀리
function hslBeam() {
  if (!hsl.lit) return null;
  if (hsl.ir && !(typeof env !== 'undefined' && env.nvg)) return null;
  const nar = Math.sqrt(8 / hsl.focus);
  // 착륙등(35-kuhgrip.js KG_LDG)보다 2배 밝고 10배 멀리 — 빛은 왼쪽 승무원 도어 밑 램프(앞 6.45m · 왼쪽 1.05m)에서 나간다
  const L = typeof KG_LDG !== 'undefined' ? KG_LDG : { k: 1.4, reach: 2400 };
  return { az: hsl.az, down: -hsl.el, k: (hsl.ir ? 0.6 : 1.0) * nar * L.k * HSL_LDG_K * (typeof kgLt !== 'undefined' ? kgLt.br : 1), reach: L.reach * HSL_LDG_REACH * Math.min(1.25, nar), wide: Math.tan(hsl.focus / 2 * _mD) * 2,
           src: { f: 6.45, r: -1.05 }, hsl: true };
}
function srchStep(dt) {
  if (srch.mode === 'MAN' || !hsl.pwr || hsl.stowed || hsl.mv) { srch.lim = false; return; }
  let p = null;
  if (srch.mode === 'EO') p = eo.pwr && eo.mode !== 'STOW' ? eoAimPoint() : null;
  else if (srch.mode === 'RDR' && rdr.tgt) { const c = msnContacts().find(x => x.id === rdr.tgt); if (c) p = c; }
  if (!p) return;
  const a = eoAngTo(p.lat, p.lon, p.hM);
  const az = _mClamp(a.az, HSL.azMin, HSL.azMax), el = _mClamp(a.el, HSL.elMin, HSL.elMax);
  srch.lim = Math.abs(az - a.az) > 0.5 || Math.abs(el - a.el) > 0.5;
  hsl.az += _mClamp(az - hsl.az, -HSL.azRate * dt, HSL.azRate * dt); hsl.el += _mClamp(el - hsl.el, -HSL.elRate * dt, HSL.elRate * dt);
}
function srchMan(dir, dt = 0.2) {
  if (!hsl.pwr || hsl.stowed || hsl.mv) return;
  srch.mode = 'MAN';
  if (dir === 'L') hsl.az = Math.max(HSL.azMin, hsl.az - HSL.azRate * dt);
  if (dir === 'R') hsl.az = Math.min(HSL.azMax, hsl.az + HSL.azRate * dt);
  if (dir === 'U') hsl.el = Math.min(HSL.elMax, hsl.el + HSL.elRate * dt);
  if (dir === 'D') hsl.el = Math.max(HSL.elMin, hsl.el - HSL.elRate * dt);
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
.msn-link{display:none;font:bold 11px monospace;padding:2px 7px;border-radius:9px;border:1px solid #3a4b5c}
.msn-link.ok{color:#7fffb0;border-color:#2ecc71}.msn-link.slow{color:#ffb000;border-color:#ffb000}.msn-link.lost{color:#ff5050;border-color:#ff5050;animation:msnBlink 1s steps(2) infinite}.msn-link.wait{color:#9ab}
@keyframes msnBlink{50%{opacity:.35}}
#msn-root.in-panel{position:absolute;z-index:auto;container-type:size}
#msn-root.in-panel [data-mact="close"],#msn-root.in-panel [data-mact="fly"]{display:none}
.msn-top{display:flex;align-items:center;gap:8px;padding:5px 10px;background:#0b0e11;border-bottom:1px solid #2a3540;font-size:12px;flex-wrap:wrap}
.msn-top b{color:#ffd23a;letter-spacing:.5px}
.msn-top .msn-ac{color:#8fd;font-family:monospace;font-size:12px}
.msn-top button,.msn-btn{background:#1c2733;border:1px solid #3a4b5c;color:#cfe;border-radius:4px;padding:4px 9px;font-size:11px;font-weight:bold;cursor:pointer}
.msn-top button.on,.msn-btn.on{background:#0d4a2a;border-color:#2ecc71;color:#bfffd5}
.msn-sp{flex:1}
.msn-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 560px;gap:10px;padding:8px;background:linear-gradient(#262c33,#1b2026)}
/* 전탐석 표시기 — 4분할(MULTI) · 2분할(SPLIT) · 한 화면 */
.msn-disp{position:relative;display:flex;flex-direction:column;min-height:0;background:#1d2a2c;border:3px solid #0e1415;border-radius:16px;box-shadow:inset 0 1px 0 #3d4d50,0 4px 10px #000b;padding:14px 14px 8px}
.msn-scr{flex:1;min-height:0;position:relative;display:grid;gap:2px;background:#9aa;border:10px solid #101617;border-radius:6px;box-shadow:inset 0 0 0 1px #000}
.msn-scr.dark{filter:brightness(0)}
.msn-nopwr{position:absolute;left:24px;right:24px;top:24px;bottom:58px;display:none;align-items:center;justify-content:center;text-align:center;font:bold 14px "Segoe UI",Arial,sans-serif;color:#7f8f99;pointer-events:none;z-index:4;line-height:1.7}
.msn-nopwr.on{display:flex;flex-direction:column}.msn-nopwr b{color:#ffb000}
.msn-cell{position:relative;background:#000;overflow:hidden;min-width:0;min-height:0}
.msn-cell canvas,.msn-cell .nv-map{position:absolute;inset:0;width:100%;height:100%}
.msn-cell .eo-vid{position:absolute;inset:0}
.msn-cell .eo-spr,.msn-cell .eo-map{position:absolute;inset:0;width:100%;height:100%}
.msn-cell .eo-hud,.msn-cell .nv-ov{pointer-events:none}
.nv-zb{position:absolute;right:6px;bottom:6px;display:flex;flex-direction:column;gap:4px;z-index:4}
.nv-zb b{width:26px;height:24px;border-radius:4px;background:rgba(10,20,25,.8);border:1px solid #567;color:#cfe;font:bold 14px Arial;display:flex;align-items:center;justify-content:center;cursor:pointer}
.msn-chl{position:absolute;left:8px;top:6px;font:bold 15px "Segoe UI",Arial,sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000;pointer-events:none;z-index:3}
.msn-dkeys{display:flex;align-items:flex-end;justify-content:center;gap:9px;padding-top:7px;flex-wrap:wrap}
.msn-dk{display:flex;flex-direction:column;align-items:center;gap:3px;font:bold 10px Arial;color:#cde}
.msn-dk b{min-width:34px;height:26px;border-radius:4px;background:linear-gradient(#2b3436,#151b1c);border:1px solid #000;box-shadow:inset 0 1px 0 #4a5759;color:#eef;font:bold 13px Arial;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0 4px}
.msn-dk b.on{color:#7fffb0;box-shadow:inset 0 0 6px #2ecc71}
.msn-dk i{font-style:normal;display:flex;gap:2px}
.msn-dk i u{width:16px;height:16px;border-radius:50%;background:#0b0f10;border:1px solid #556;text-decoration:none;font:bold 9px Arial;color:#9ab;display:flex;align-items:center;justify-content:center;cursor:pointer}
.msn-dk i u.on{background:#1c6;color:#000}
/* 오른쪽 — EO/IR 조작기 · 탐색등 조작기 · 레이더 조작기 */
.msn-right{display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto}
.msn-ctl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:stretch}
.msn-colA{display:flex;flex-direction:column;gap:6px;align-items:center}
.msn-colB{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-width:0}
.msn-slcz{zoom:1.24}
.msn-slcz .slc{gap:14px;padding-top:18px;padding-bottom:52px}
.msn-slcz .slc-st{margin-top:10px}
.msn-clnz{zoom:.82}
.msn-dvrz{zoom:.86}
/* 녹화기(DVR) — EO/IR · 레이더 · 호이스트 · 지도 화면 녹화· 재생 · USB(FLM 5.19) */
.dvr{width:350px;background:linear-gradient(#1f2226,#141619);border:2px solid #07080a;border-radius:6px;padding:12px 14px 10px;box-shadow:0 3px 8px #000b,inset 0 1px 0 #3a3f45;
  display:grid;grid-template-columns:1fr 150px;grid-template-areas:"l pad" "t t" "ch ch" "slot slot";gap:8px 10px;font:bold 10px Arial;color:#9aa3ab}
.dvr b{background:linear-gradient(#5b6168,#3c4146);border:1px solid #111;border-radius:4px;color:#c8ced3;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 1px 0 #7a8187}
.dvr b.dn{background:#2a2e32;color:#ffd23a}
.dvr-l{grid-area:l;display:flex;flex-direction:column;gap:8px;justify-content:center}
.dvr-r{display:flex;align-items:center;gap:10px}.dvr-r b{width:76px;height:20px;font-size:9px}
.dvr-led{width:14px;height:14px;border-radius:50%;background:#9fb4c4;opacity:.35;box-shadow:inset 0 1px 2px #000}
.dvr-led.on{opacity:1;background:#5f6;box-shadow:0 0 8px #5f6}.dvr-led.rec{opacity:1;background:#f44;box-shadow:0 0 8px #f44}
.dvr-led.red{opacity:1;background:#f44;box-shadow:0 0 8px #f44}.dvr-led.blue{opacity:1;background:#3af;box-shadow:0 0 8px #3af}
.dvr-st{font:bold 10px Arial;color:#7fffb0;letter-spacing:.5px}
.msn-cell canvas.dvr-pb{z-index:3}
.dvr-osd{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;min-width:300px;max-width:90%;background:rgba(6,12,20,.92);border:2px solid #3af;border-radius:6px;padding:10px 14px;color:#dfe8ef;font:13px Arial}
.dvr-osd h4{margin:0 0 6px;color:#4aa8ff;font-size:14px}.dvr-osd p{margin:2px 0;padding:2px 6px;border-radius:3px}.dvr-osd p.sel,.dvr-osd span.sel{background:#3af;color:#001}
.dvr-osd small{display:block;margin-top:6px;color:#8aa}.dvr-dt{font:bold 18px monospace;margin:4px 0}.dvr-dt span{padding:0 2px;border-radius:2px}
.dvr-cal{display:grid;grid-template-columns:repeat(7,26px);gap:2px;margin:6px 0;font:11px Arial;text-align:center}.dvr-cal i{font-style:normal;padding:2px 0;color:#9ab}
.dvr-cal i.rec{background:#1f6f3f;color:#fff;border-radius:3px}.dvr-cal i.cur{outline:1px solid #3af}
.dvr-pad{grid-area:pad;display:grid;grid-template-columns:30px 1fr 30px;grid-template-rows:24px 40px 24px;gap:3px}
.dvr-pad .u{grid-column:1/4;grid-row:1}.dvr-pad .d{grid-column:1/4;grid-row:3}.dvr-pad .l{grid-column:1;grid-row:2}.dvr-pad .r{grid-column:3;grid-row:2}.dvr-pad .e{grid-column:2;grid-row:2;font-size:10px}
.dvr-t{grid-area:t;display:grid;grid-template-columns:repeat(3,44px) 1fr 54px 54px;gap:10px;height:28px}
.dvr-ch{grid-area:ch;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.dvr-ch div{display:flex;flex-direction:column;align-items:center;gap:4px}.dvr-ch .dvr-led{width:9px;height:9px}.dvr-ch b{width:56px;height:20px;font-size:9px}
.dvr-slot{grid-area:slot;height:30px;border:1px solid #000;border-radius:3px;background:#0c0d0f;display:flex;align-items:center;justify-content:space-between;padding:0 10px;color:#e8e8e8;font:bold 14px Arial}
.dvr-slot i{width:60px;height:22px;background:#1b1d20;border:1px solid #000}
.msn-eohcu{zoom:.74;display:flex;flex-direction:column;align-items:center;gap:6px}
.msn-panel{background:#11161b;border:1px solid #2f3b46;border-radius:6px;padding:6px 8px;font-size:11px}
.msn-panel h4{margin:0 0 5px;font-size:11px;color:#9fb3c4;letter-spacing:1px}
.msn-keys{display:flex;flex-wrap:wrap;gap:4px}
.msn-keys .msn-btn{flex:1 1 auto;padding:3px 6px;font-size:10px}
.msn-tdata{font-family:monospace;font-size:11px;color:#9f9;min-height:28px;white-space:pre}
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
/* 탐색등 조작기(HSL-1600 HCU) */
.slc{width:178px;background:linear-gradient(#2c3034,#1c1f22);border:2px solid #0c0e10;border-radius:34px 34px 46px 46px/30px 30px 120px 120px;padding:12px 10px 18px;box-shadow:0 3px 8px #000b,inset 0 1px 0 #4a5056;
  display:flex;flex-direction:column;align-items:center;gap:7px;font:bold 9px Arial;color:#d8dde2;position:relative}
.slc-top{display:grid;grid-template-columns:22px 1fr 22px;gap:4px;align-items:center;width:100%}
.slc-rk{display:flex;flex-direction:column;align-items:center;gap:1px;font:bold 7px/1 Arial;color:#cfd4d8;cursor:pointer;text-align:center}
.slc-rk u{text-decoration:none;font-size:9px;color:#9aa}
.slc-lm{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:#0a0c0d;border:2px solid #000;border-radius:4px;padding:2px}
.slc-lm span{font:bold 8.5px Arial;color:#69707a;background:#191c1f;border-radius:2px;text-align:center;padding:4px 0}
.slc-lm span.on{color:#fff;background:#3a4a2a;text-shadow:0 0 5px #9f9}
.slc-lm span.on.f{background:#5a2020;text-shadow:0 0 5px #f88}
.slc-lm.dim span.on{opacity:.55}
.slc-sw{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;width:100%}
.slc-sw div{display:flex;flex-direction:column;align-items:center;gap:2px;font:bold 8px Arial}
.slc-sw .k{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#4b535b,#14171a);border:2px solid #000;position:relative;cursor:pointer}
.slc-sw .k i{position:absolute;left:8px;width:6px;height:6px;border-radius:50%;background:#aab;top:8px;transition:top .08s}
.slc-sw .k.up i{top:2px}.slc-sw .k.dn i{top:14px}
.slc-mid{display:grid;grid-template-columns:1fr 1fr 40px;gap:4px;width:100%;align-items:center}
.slc-pb{display:flex;flex-direction:column;align-items:center;gap:2px;font:bold 7px Arial}
.slc-pb b{width:14px;height:14px;border-radius:50%;background:radial-gradient(#eee,#9aa);border:2px solid #222;cursor:pointer}
.slc-pb b.dn{background:radial-gradient(#9aa,#566)}
.slc-fc{width:10px;height:44px;border-radius:5px;background:repeating-linear-gradient(#1a1a1a 0 3px,#3a3a3a 3px 5px);border:1px solid #000;margin:0 auto;cursor:ns-resize;touch-action:none}
.slc-st{width:86px;height:86px;border-radius:50%;background:radial-gradient(#23272b,#0f1113);border:2px solid #000;position:relative;touch-action:none;cursor:grab;margin-top:2px}
.slc-st i{position:absolute;left:25px;top:25px;width:32px;height:32px;border-radius:50%;background:repeating-radial-gradient(circle,#d8dcdf 0 3px,#b8bcbf 3px 5px);box-shadow:0 2px 4px #000}
.slc-st em{position:absolute;color:#8a9298;font-style:normal;font-size:10px}
.slc-xs{font:bold 11px Arial;color:#aab;margin-top:2px}
/* 레이더 조작기(EuroNav CLN) */
.cln{display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(#30363b,#1d2124);border:2px solid #0c0e10;border-radius:8px;padding:10px 14px;box-shadow:0 3px 8px #000b,inset 0 1px 0 #4b5257}
.cln-k{display:grid;grid-template-columns:44px 44px;gap:8px}
.cln-k b{height:38px;border-radius:5px;background:linear-gradient(#22272b,#111416);border:2px solid #000;box-shadow:inset 0 0 0 2px #3a4046;color:#eee;font:bold 11px Arial;display:flex;align-items:center;justify-content:center;cursor:pointer}
.cln-k b.on{color:#7fffb0}
.cln-knob{width:118px;height:118px;position:relative}
.cln-knob .ring{position:absolute;inset:14px;border-radius:50%;background:repeating-conic-gradient(#3b4248 0 6deg,#23282c 6deg 12deg);border:2px solid #000;box-shadow:0 2px 5px #000}
.cln-knob .cap{position:absolute;inset:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#4c545b,#1a1e21);border:2px solid #000;cursor:pointer}
.cln-knob em{position:absolute;width:16px;height:16px;font:bold 11px/16px Arial;text-align:center;color:#9fb;cursor:pointer;font-style:normal}
.cln-rot{display:flex;flex-direction:column;gap:6px}
.cln-rot b{width:26px;height:22px;border-radius:4px;background:#1c2226;border:1px solid #000;color:#cde;font:bold 12px Arial;display:flex;align-items:center;justify-content:center;cursor:pointer}
.vccp-l{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(#2b3135,#1a1e21);border-radius:6px}
.vccp-z{zoom:.86}
.vccp-cap{font:bold 9px Arial;color:#9aa;letter-spacing:1px;margin-top:2px}
.vccp-cmd{position:absolute;right:8px;top:4px;font:bold 9px Arial;color:#7fffb0}
.vccp-cmd.lock{color:#ffb000}
.msn-cap2{font:bold 9px Arial;color:#9aa;text-align:center;letter-spacing:1px;margin-top:3px}
#msn-open-btn{position:fixed;left:8px;bottom:60px;z-index:3900;display:none;background:#0d2a40;border:1px solid #3a8fd0;color:#cfe8ff;border-radius:6px;padding:7px 11px;font:bold 12px Arial;cursor:pointer;box-shadow:0 2px 6px #000a}
html.ac-aw189 #msn-open-btn{display:block}
#msn-open-btn.in-ctl{position:static;left:auto;bottom:auto;z-index:auto;box-shadow:none;padding:4px 6px;font:bold 11px Arial;border-radius:4px;background:#0d2a40;border:1px solid #3a8fd0;color:#cfe8ff}
@media (max-width:1100px){.msn-body{grid-template-columns:1fr;overflow:auto}.msn-disp{min-height:70vh}.msn-right{overflow:visible}}
/* Vendor 창(창 안의 전탐석) — 좁으면 표시기를 위 · 조작기를 아래에(조작기는 창 너비에 맞춰 줄인다 --msn-z) */
@container (max-width:1100px){.msn-body{grid-template-columns:1fr;grid-template-rows:auto auto;overflow:auto}.msn-disp{height:62cqh;min-height:260px}.msn-right{overflow:visible;zoom:var(--msn-z,1)}}
`;
  document.head.appendChild(st);
}
const HCU_TOP = [['menu', 'MENU'], ['laser', 'LASER'], ['geo', 'GEO<br>FOCUS'], ['map', 'MAP'], ['ez', '2X'], ['irgate', 'IR<br>GATE'], ['stow', 'STOW'],
                 ['aux', 'AUX'], ['lrf', 'LRF'], ['tx', 'TX'], ['ctrl', 'CTRL<br>AUTH'], ['pol', 'POL'], ['ircal', 'IR<br>CAL'], ['scene', 'SCENE']];
const HCU_SW = [['zoom', 'ZOOM', ''], ['vic', 'VIC', ''], ['avtg', 'AVT<br>GATE', 'AVT<br>MODE'], ['steer', 'AUTO', 'MANUAL'], ['aid', 'AID', 'ZMULTI'],
                ['slew', 'SLEW', 'FWD'], ['img', 'MAN/<br>AUTO', 'FILTER'], ['pip', 'IMAGE<br>INT', 'IMAGE<br>MODE']];
// 표시기 칸 — CH1 EO/IR · CH2 레이더 · CH3 호이스트 카메라 · CH4 NAVI 지도(4분할: 왼쪽 위 지도 · 오른쪽 위 호이스트 · 왼쪽 아래 레이더 · 오른쪽 아래 EO/IR)
const DISP_CH = { 1: 'eo', 2: 'rdr', 3: 'hoist', 4: 'map' };
const DISP_PAIRS = [['map', 'eo'], ['rdr', 'eo'], ['hoist', 'eo'], ['map', 'rdr']];
const disp = { lay: 'quad', ch: 1, pair: 0, bri: 100, pwr: true };
// ── 전원 — 표시기 · 녹화기는 하부 콘솔 MPP 패널의 DMM 전원(⑩ MPP · DMM ON)에 물려 있다 ──
//   DMM ON(기체 DC 전원 있음) → 녹화기 POWER 를 누르면(3초 시동) → 표시기 화면 전체가 들어온다. DMM 을 끄면 녹화기 · 화면이 함께 꺼진다
function msnDmmPwr() {
  try { if (typeof ovhdGet !== 'function') return true; return ovhdGet('mpp2') === 'IN' && (typeof pwrDc !== 'function' || !!pwrDc()); } catch (e) { return true; }
}
function msnScreenOn() { return disp.pwr && dvr.pwr && dvr.boot <= 0 && msnDmmPwr(); }
// 화면이 꺼져 있으면 까맣게 · 무엇을 켜야 하는지 적어 둔다(표시기 M-PWR · 녹화기 POWER · DMM 전원)
function _msnScrPwr() {
  if (!_msnEl) return;
  const scr = _msnEl.querySelector('.msn-scr'), np = _msnEl.querySelector('[data-m="nopwr"]'); if (!scr) return;
  const on = msnScreenOn();
  scr.classList.toggle('dark', !on);
  scr.style.filter = on && disp.bri !== 100 ? `brightness(${disp.bri / 100})` : '';
  if (np) {
    const L = (a, b) => `<div>${a}</div><div>${b}</div>`;
    const t = on ? '' : !msnDmmPwr() ? L('NO POWER', '<b>하부 콘솔 MPP 패널 — DMM ON</b>')
      : !dvr.pwr ? L('NO POWER', '<b>녹화기(가운데) POWER</b> 를 누르십시오')
      : dvr.boot > 0 ? L('녹화기 시동 중', `${Math.ceil(dvr.boot)}초`) : L('표시기 꺼짐', '<b>M-PWR</b>');
    np.classList.toggle('on', !on); if (np.innerHTML !== t) np.innerHTML = t;
  }
}
function dispSet(o) {
  Object.assign(disp, o || {});
  if (!_msnEl) return;
  const scr = _msnEl.querySelector('.msn-scr'); if (!scr) return;
  const cells = { map: '.c-map', hoist: '.c-hoist', rdr: '.c-rdr', eo: '.c-eo' }, el = k => scr.querySelector(cells[k]);
  let show = [];
  if (disp.lay === 'quad') { scr.style.gridTemplate = '1fr 1fr / 1fr 1fr'; show = [['map', 1, 1], ['hoist', 1, 2], ['rdr', 2, 1], ['eo', 2, 2]]; }
  else if (disp.lay === 'split') { scr.style.gridTemplate = '1fr / 1fr 1fr'; const P = DISP_PAIRS[disp.pair % DISP_PAIRS.length]; show = [[P[0], 1, 1], [P[1], 1, 2]]; }
  else { scr.style.gridTemplate = '1fr / 1fr'; show = [[DISP_CH[disp.ch] || 'eo', 1, 1]]; }
  Object.keys(cells).forEach(k => { const e = el(k); if (e) e.style.display = 'none'; });
  show.forEach(([k, r, c]) => { const e = el(k); if (e) { e.style.display = ''; e.style.gridRow = r; e.style.gridColumn = c; } });
  _msnScrPwr();
  try { if (_nvMap) _nvMap.resize(); if (_eoMap) { _eoHostPlace(); _eoMap.resize(); } } catch (e) { _swallow(e); }
  msnRenderPanels();
}
function dispKey(k) {
  if (k === 'multi') dispSet({ lay: 'quad' });
  else if (k === 'split') dispSet(disp.lay === 'split' ? { pair: disp.pair + 1 } : { lay: 'split' });
  else if (k === 'navi') dispSet({ lay: 'one', ch: 4 });
  else if (k === 'video') dispSet({ lay: 'one', ch: disp.ch === 4 ? 1 : disp.ch });
  else if (k === 'ch') { if (disp.lay === 'split') dispSet({ pair: disp.pair + 1 }); else if (disp.lay === 'one') dispSet({ ch: disp.ch % 4 + 1 }); else dispSet({ lay: 'one', ch: 1 }); }
  else if (/^v[1-4]$/.test(k)) dispSet({ lay: 'one', ch: +k[1] });
  else if (k === 'pip') { eo.pip = eo.pip === 'OFF' ? 'RDR' : 'OFF'; }
  else if (k === 'up') dispSet({ bri: Math.min(100, disp.bri + 10) });
  else if (k === 'dn') dispSet({ bri: Math.max(20, disp.bri - 10) });
  else if (k === 'bri') dispSet({ bri: disp.bri >= 100 ? 60 : 100 });
  else if (k === 'pwr') dispSet({ pwr: !disp.pwr });
  else if (k === 'menu') _mToast('표시기 MENU — 기능은 이후에 갖춥니다');
}
// VCCP 면판(DOM) — 전탐석 · 조종석 하부 콘솔 ⑮ 가 같은 것을 쓴다
function _clnHtml() {
  return `<div class="cln">
        <div class="cln-k"><b data-cln="map">MAP</b><b data-cln="esc">ESC</b><b data-cln="com">COM</b><b data-cln="tfc">TFC</b></div>
        <div class="cln-knob" data-m="clnknob"><div class="ring"></div><div class="cap" data-cln="push"></div>
          ${[['n', 51, 0, '▲'], ['ne', 92, 10, '◥'], ['e', 102, 51, '▶'], ['se', 92, 92, '◢'], ['s', 51, 102, '▼'], ['sw', 10, 92, '◣'], ['w', 0, 51, '◀'], ['nw', 10, 10, '◤']].map(([d, x, y, t]) => `<em data-cln="pan:${d}" style="left:${x}px;top:${y}px">${t}</em>`).join('')}</div>
        <div class="cln-rot"><b data-cln="rot:-1" title="왼쪽으로 돌림 — 넓게">⟲</b><b data-cln="rot:1" title="오른쪽으로 돌림 — 좁게">⟳</b></div>
        <div class="cln-k"><b data-cln="clr">CLR</b><b data-cln="fnc">FNC</b><b data-cln="wxr">WXR</b><b data-cln="tws">TWS</b></div>
      </div>`;
}
function _clnLeds(root) {
  if (!root) return;
  root.querySelectorAll('[data-cln]').forEach(b => { const k = b.dataset.cln; if (k === 'wxr') b.classList.toggle('on', rdr.wxr); if (k === 'tws') b.classList.toggle('on', rdr.tws); if (k === 'map') b.classList.toggle('on', rdr.menu === 'MAP'); if (k === 'fnc') b.classList.toggle('on', rdr.menu === 'FNC'); });
}
// ── 조종석 하부 콘솔 ⑮ VCCP(19-lower.js 'html' 자리 #vccpL) — 전탐석 VCCP 와 같은 면판 · 같은 레이더. 권한은 조종실(CKPT · SHARED)
//   화면은 조종석 SYSTEM 창 Video(Channel RADAR) — 전탐석 레이더 화면과 같다(rdrDrawTo)
function vccpBuild() {
  const host = document.getElementById('vccpL');
  if (!host || host.dataset.built) return;
  host.dataset.built = '1'; _msnCss();
  host.innerHTML = `<div class="vccp-l"><div class="vccp-z">${_clnHtml()}</div><div class="vccp-cap">VCCP — SEARCH RADAR (CKPT)</div><div class="vccp-cmd" data-m="vccmd"></div></div>`;
  const downK = new Map();
  host.addEventListener('pointerdown', e => {
    const cl = e.target.closest('[data-cln]'); if (!cl) return;
    e.preventDefault(); e.stopPropagation(); const k = cl.dataset.cln; downK.set(e.pointerId, k); clnPress(k, true, 'CKPT');
    try { cl.setPointerCapture(e.pointerId); } catch (er) { _swallow(er); }
  });
  const up = e => { const k = downK.get(e.pointerId); if (k == null) return; downK.delete(e.pointerId); clnPress(k, false, 'CKPT'); };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  vccpRender();
}
let _vccpKey = '';
function vccpRender() {
  const host = document.getElementById('vccpL'); if (!host || !host.dataset.built) return;
  const key = `${rdr.wxr}${rdr.tws}${rdr.menu}${rdr.cmd}`; if (key === _vccpKey) return; _vccpKey = key;
  _clnLeds(host);
  const c = host.querySelector('[data-m="vccmd"]'); if (c) { c.textContent = `RDR CMD ${rdr.cmd}`; c.classList.toggle('lock', !rdrCkptOk()); }
}
function _msnBuild() {
  if (_msnEl) return _msnEl;
  _msnCss();
  const R = document.createElement('div'); R.id = 'msn-root';
  const sw = ([k, u, d]) => `<div class="hcu-tg"><div class="lb">${u}</div><div class="sw" data-sw="${k}"><i></i><b class="u" data-hcu="${k}:up"></b><b class="d" data-hcu="${k}:dn"></b></div><div class="lb">${d}</div></div>`;
  const dk = (k, lbl, face) => `<div class="msn-dk">${lbl}<b data-dk="${k}">${face}</b></div>`;
  const slsw = (k, u, d) => `<div>${u}<span class="k" data-slc="${k}"><i></i></span>${d}</div>`;
  R.innerHTML = `
  <div class="msn-top"><b>Vendor · 흰수리 전탐석 MISSION CONSOLE</b><span class="msn-ac" data-m="ac"></span><span class="msn-link" data-m="link"></span><span class="msn-sp"></span>
    <button data-mact="fly">▶ 비행</button><button data-mact="spawn">선박 표적 생성</button><button data-mact="clear">표적 지우기</button>
    <button data-mact="help">❓</button><button data-mact="popout" title="전탐석을 새 창으로 — 다른 모니터에서 전탐요원이 · 조종석은 이 창에">⧉ 새 창</button><button data-mact="close">조종석 보기 ⤴</button></div>
  <div class="msn-body">
    <div class="msn-disp"><div class="msn-nopwr" data-m="nopwr"></div>
      <div class="msn-scr">
        <div class="msn-cell c-map"><div class="nv-map"></div><canvas class="nv-ov"></canvas><span class="msn-chl">CH4 / 10fps</span><div class="nv-zb"><b data-mact="nv+">＋</b><b data-mact="nv-">−</b><b data-mact="nvc">⌖</b></div></div>
        <div class="msn-cell c-hoist"><canvas class="hc-cv"></canvas><span class="msn-chl">CH3 / 28fps</span></div>
        <div class="msn-cell msn-rdr c-rdr"><canvas></canvas><span class="msn-chl">CH2 / 28fps</span></div>
        <div class="msn-cell msn-eo c-eo"><div class="eo-vid"><canvas class="eo-spr"></canvas></div><canvas class="eo-hud"></canvas><span class="msn-chl">CH1 / 30fps</span></div>
      </div>
      <div class="msn-dkeys">${dk('navi', 'NAVI', 'N')}${dk('video', 'VIDEO', 'V')}${dk('pip', 'PIP', '◰')}${dk('split', 'SPLIT', '◫')}${dk('multi', 'MULTI', '⊞')}${dk('ch', 'CH', 'CH')}${dk('menu', 'MENU', 'M')}
        <div class="msn-dk">V-IN<i>${[1, 2, 3, 4].map(n => `<u data-dk="v${n}">${n}</u>`).join('')}</i></div>${dk('up', '&nbsp;', '▲')}${dk('dn', '&nbsp;', '▼')}${dk('bri', '&nbsp;', '☀')}${dk('pwr', 'M-PWR', '⏻')}</div>
    </div>
    <div class="msn-right">
      <div class="msn-ctl"><div class="msn-colA">
        <div class="msn-eohcu">
          <div><div class="hcu-top">${HCU_TOP.map(([k, n]) => `<div class="hcu-key" data-hcu="${k}">${n}</div>`).join('')}</div></div>
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
            </div></div><div class="hcu-cap">EO/IR HAND CONTROLLER (HCU)</div></div>
        </div>
      <div class="msn-dvrz"><div class="dvr">
        <div class="dvr-l">${[['power', 'POWER', 'pwr'], ['rec', 'REC', 'rec'], ['playback', 'PLAYBACK', 'play']].map(([k, n, l]) => `<div class="dvr-r"><i class="dvr-led" data-dvl="${l}"></i><b data-dvr="${k}">${n}</b></div>`).join('')}</div>
        <div class="dvr-pad"><b class="u" data-dvr="up">▲</b><b class="l" data-dvr="left">◀</b><b class="e" data-dvr="enter">ENTER</b><b class="r" data-dvr="right">▶</b><b class="d" data-dvr="down">▼</b></div>
        <div class="dvr-t"><b data-dvr="rew">◀◀/◀</b><b data-dvr="play">❙❙▶</b><b data-dvr="ff">▶/▶▶</b><span></span><b data-dvr="menu">MENU</b><b data-dvr="back">↩</b></div>
        <div class="dvr-ch">${[1, 2, 3, 4].map(n => `<div><i class="dvr-led" data-dvl="ch${n}"></i><b data-dvr="ch${n}">CH${n}</b></div>`).join('')}</div>
        <div class="dvr-slot"><span>⟵ OPEN</span><em class="dvr-st" data-m="dvrst"></em><i></i></div>
      </div><div class="msn-cap2">VIDEO RECORDER — EO/IR · RADAR · HOIST · MAP</div></div>
      <div class="msn-clnz">${_clnHtml()}<div class="msn-cap2">SEARCH RADAR CONTROL — VCCP (SEASPRAY 5000E)</div></div>
      </div><div class="msn-colB">
        <div class="msn-slcz"><div class="slc">
          <div class="slc-top"><div class="slc-rk"><u data-slc="hdim:up">▲</u>HCU<br>DIM<u data-slc="hdim:dn">▼</u><span data-slc="test" style="margin-top:3px">TEST ▷</span></div>
            <div class="slc-lm" data-m="slclm">${['FAULT', 'LSR', 'LAMP', 'PWR', 'BLK', 'AUTO', 'IR', 'STW'].map(n => `<span data-sll="${n}">${n}</span>`).join('')}</div>
            <div class="slc-rk"><u data-slc="rdim:up">▲</u>RAD<br>DIM<u data-slc="rdim:dn">▼</u></div></div>
          <div class="slc-sw">${slsw('lsr', 'LSR', 'OFF')}${slsw('ir', 'IR', 'VIS')}${slsw('lamp', 'LAMP', 'OFF')}${slsw('init', 'INIT', 'STOW')}</div>
          <div class="slc-mid"><div class="slc-pb"><b data-slc="offset"></b>OFFSET</div><div class="slc-pb"><b data-slc="manauto"></b>MAN/AUTO</div><div class="slc-pb">FOCUS<div class="slc-fc" data-m="slfocus"></div></div></div>
          <div class="slc-st" data-m="slstick"><em style="left:37px;top:-1px">▲</em><em style="left:37px;bottom:-2px">▼</em><em style="left:1px;top:35px">◀</em><em style="right:1px;top:35px">▶</em><i></i></div>
          <div class="slc-xs">XS1</div>
        </div></div><div class="msn-cap2">SEARCH LIGHT HCU (HSL-1600)</div><button class="msn-btn" data-mact="slpwr" style="width:100%;margin-top:4px">SEARCH LT PWR ON</button><div class="msn-tdata" data-m="sdata"></div></div>
      </div>
      <div class="msn-panel"><h4>SEARCH RADAR — 빠른 단추(메뉴 FNC · MAP 과 같다)</h4><div class="msn-keys">
        <button class="msn-btn" data-mact="rtx">TX</button><button class="msn-btn" data-mact="rmode">MODE</button><button class="msn-btn" data-mact="rcmd">CMD</button>
        <button class="msn-btn" data-mact="rng-">RNG −</button><button class="msn-btn" data-mact="rng+">RNG +</button>
        <button class="msn-btn" data-mact="tilt-">TILT −</button><button class="msn-btn" data-mact="tilt+">TILT +</button>
        <button class="msn-btn" data-mact="gain-">GAIN −</button><button class="msn-btn" data-mact="gain+">GAIN +</button>
        <button class="msn-btn" data-mact="rsec">SCAN</button><button class="msn-btn" data-mact="rfrz">FREEZE</button><button class="msn-btn" data-mact="ronly">R ONLY</button>
        <button class="msn-btn" data-mact="r2eo">EO/IR → 표적</button><button class="msn-btn" data-mact="r2sl">서치라이트 → 표적</button></div>
        <div class="msn-tdata" data-m="tdata"></div></div>
    </div>
  </div>`;
  document.body.appendChild(R);
  _msnEl = R;
  // HCU 누름 · 뗌(EO/IR · 탐색등 · 레이더 조작기)
  const downK = new Map();
  R.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-hcu]');
    if (h) { e.preventDefault(); const k = h.dataset.hcu; downK.set(e.pointerId, ['hcu', k]); hcuPress(k, true); try { h.setPointerCapture(e.pointerId); } catch (er) { _swallow(er); } return; }
    const sl = e.target.closest('[data-slc]');
    if (sl) { e.preventDefault(); const k = sl.dataset.slc; downK.set(e.pointerId, ['slc', k]); slcPress(k, true); try { sl.setPointerCapture(e.pointerId); } catch (er) { _swallow(er); } return; }
    const cl = e.target.closest('[data-cln]');
    if (cl) { e.preventDefault(); const k = cl.dataset.cln; downK.set(e.pointerId, ['cln', k]); clnPress(k, true); try { cl.setPointerCapture(e.pointerId); } catch (er) { _swallow(er); } return; }
    const dv = e.target.closest('[data-dvr]');
    if (dv) { e.preventDefault(); dvrPress(dv.dataset.dvr); return; }
    const d = e.target.closest('[data-dk]');
    if (d) { e.preventDefault(); dispKey(d.dataset.dk); }
  });
  const up = e => { const k = downK.get(e.pointerId); if (!k) return; downK.delete(e.pointerId); if (k[0] === 'hcu') hcuPress(k[1], false); else if (k[0] === 'slc') slcPress(k[1], false); else clnPress(k[1], false); };
  R.addEventListener('pointerup', up); R.addEventListener('pointercancel', up);
  R.addEventListener('click', e => { const b = e.target.closest('[data-mact]'); if (b) msnAct(b.dataset.mact); });
  // 조이스틱(화면) — 끌면 기울기 · 놓으면 가운데
  const stick = (sel, J) => {
    const st = R.querySelector(sel), knob = st.querySelector('i');
    const mv = e => { const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, m = r.width / 2 - 14;
      let x = (e.clientX - cx) / m, y = (e.clientY - cy) / m; const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; }
      J.x = x; J.y = -y; knob.style.transform = `translate(${x * m * 0.6}px,${y * m * 0.6}px)`; };
    st.addEventListener('pointerdown', e => { if (e.target.closest('[data-slc],[data-hcu]')) return; e.preventDefault(); st.setPointerCapture(e.pointerId); st._on = true; mv(e); });
    st.addEventListener('pointermove', e => { if (st._on) mv(e); });
    const end = () => { st._on = false; J.x = 0; J.y = 0; knob.style.transform = ''; };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  };
  stick('[data-m="stick"]', eo.joy); stick('[data-m="slstick"]', slc.joy);
  // FOCUS 다이얼 — 위아래로 끌기 · 휠
  const dial = (sel, by) => { const fc = R.querySelector(sel); let fy = null;
    fc.addEventListener('pointerdown', e => { fy = e.clientY; fc.setPointerCapture(e.pointerId); });
    fc.addEventListener('pointermove', e => { if (fy === null) return; by((fy - e.clientY) * 0.6); fy = e.clientY; });
    fc.addEventListener('pointerup', () => { fy = null; });
    fc.addEventListener('wheel', e => { e.preventDefault(); by(-e.deltaY * 0.05); }, { passive: false }); };
  dial('[data-m="focus"]', eoFocusBy); dial('[data-m="slfocus"]', d => { hsl.focus = _mClamp(hsl.focus + d * 0.08, HSL.fMin, HSL.fMax); });
  // 레이더 조작기 손잡이 — 휠로 돌린다
  R.querySelector('[data-m="clnknob"]').addEventListener('wheel', e => { e.preventDefault(); clnPress('rot:' + (e.deltaY > 0 ? -1 : 1), true); }, { passive: false });
  // 레이더 화면 — 누른 자리의 표적 지정
  const rc = R.querySelector('.msn-rdr canvas');
  rc.addEventListener('pointerdown', e => {
    if (!rdrCabinOk()) { _rdrGuard('pick'); return; }
    const r = rc.getBoundingClientRect(), G = _rdrGeo(rc.width, rc.height);
    const x = (e.clientX - r.left) * rc.width / r.width - G.ox, y = (e.clientY - r.top) * rc.height / r.height - G.oy;
    rdrPickRB(Math.atan2(x, -y) / _mD, Math.hypot(x, y) / G.R * rdr.rng);
  });
  dispSet();
  return R;
}
// ══ 녹화기(DVR · FLM 5.19) — 호이스트 카메라 · 탐색레이더 · EO/IR · 지도 화면을 SSD 에 녹화(.MUX) · 재생 · USB 로 AVI 내보내기 ══
//   POWER(빨강 표시등) · REC(전체 녹화 — 녹화 중 초록 깜박 · 멈춤 초록) · PLAYBACK(파랑 — 재생 0.5~256배 · 앞 · 뒤)
//   CH1 EO/IR · CH2 탐색레이더 · CH3 호이스트 카메라(12V) · CH4 DMM 지도 — 표시기 채널(DISP_CH)과 같은 번호 · 채널 단추로 그 채널 녹화를 켜고 끈다
//     채널 표시등: 녹화 중 초록 깜박 · 멈춤 초록 · 연결 안 됨(기체 전원 꺼짐 · 센서 꺼짐) 꺼짐
//   ▲▼◀▶ · ENTER — 메뉴 · 날짜/시간 검색 / 재생 중: ◀▶ 10초 앞뒤 · ▲▼ 속도 · ENTER 멈춤/재생 · ↩ 뒤로(메뉴 닫기 · 재생 끝)
//   ◀◀/◀ · ❙❙▶ · ▶/▶▶ — 뒤로 빨리(누를 때마다 2 · 4 · … 256배) · 재생/멈춤 · 앞으로 빨리
//   (시뮬레이터 — 채널마다 2초에 한 장(320×240 JPEG)을 메모리에 담는다. 가장 오래된 것부터 지워 1시간 분량까지 둔다. 실기 SSD 는 5시간 넘게)
const DVR_CH = { 1: 'EO/IR', 2: 'RADAR', 3: 'HOIST CAM', 4: 'DMM MAP' };
const DVR_CELL = { 1: 'eo', 2: 'rdr', 3: 'hoist', 4: 'map' };       // 표시기 칸(DISP_CH 와 같은 번호)
const DVR_W = 320, DVR_H = 240, DVR_DT = 2000, DVR_KEEP = 1800, DVR_BOOT_S = 3, DVR_SSD_H = 5.5;
const DVR_SPEEDS = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
const DVR_MENU = ['SEARCH — 날짜 · 시간', 'PLAYBACK VIEW', 'EXPORT → USB (AVI)', 'SSD INFO', 'SSD FORMAT'];
const DVR_VIEWS = ['QUAD', 'CH1', 'CH2', 'CH3', 'CH4'];
const dvr = { pwr: false, boot: 0, rec: false, play: false, ch: { 1: true, 2: true, 3: true, 4: true },
  fr: [], seg: [], capT: 0, pb: { t: 0, si: 1, dir: 1, pause: false }, menu: null, menuI: 0, view: 0,
  srch: { t: 0, f: 3 }, fmtArm: false, exp: null, info: '' };
// 채널이 연결(신호가 들어오는가) — CH3 호이스트 카메라는 기체 전원(DC)이 있으면 들어온다
//   (종전에는 상부 콘솔 HOIST ENABLE 까지 켜야 했다 — 표시기 CH3 칸에는 영상이 보이는데 녹화기만 '신호 없음'이라 헷갈렸다)
function dvrConn(n) {
  if (n === 1) return eo.pwr;
  if (n === 2) return rdr.pwr;
  if (n === 3) { try { return typeof pwrDc !== 'function' || !!pwrDc(); } catch (e) { return false; } }
  return true;
}
function dvrRecCh(n) { return dvr.pwr && dvr.boot <= 0 && dvr.rec && dvr.ch[n] && dvrConn(n); }
const _dvrT = t => { const d = new Date(t), p = v => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const _dvrHm = s => `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m`;
function dvrSpeed() { return DVR_SPEEDS[dvr.pb.si]; }
// 채널 한 장 그리기(320×240)
let _dvrCv = null;
function _dvrGrab(n) {
  if (!_dvrCv) { _dvrCv = document.createElement('canvas'); _dvrCv.width = DVR_W; _dvrCv.height = DVR_H; }
  const g = _dvrCv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.fillStyle = '#000'; g.fillRect(0, 0, DVR_W, DVR_H);
  try {
    if (n === 1) eoirVideoDrawTo(g, 0, 0, DVR_W, DVR_H);
    else if (n === 2) { g.save(); _rdrPaint(g, DVR_W, DVR_H); g.restore(); }
    else if (n === 3) { if (typeof sarHoistCamDrawTo === 'function') sarHoistCamDrawTo(g, 0, 0, DVR_W, DVR_H); }
    else if (n === 4) {
      const cell = _msnEl && _msnEl.querySelector('.c-map');
      const mc = _nvMap && _cellVis(cell) ? _nvMap.getCanvas() : null, ov = cell && cell.querySelector('.nv-ov');
      if (mc && mc.width) { g.drawImage(mc, 0, 0, DVR_W, DVR_H); if (ov && ov.width) g.drawImage(ov, 0, 0, DVR_W, DVR_H); }
      else { g.fillStyle = '#5a6a75'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('DMM MAP — NO VIDEO', DVR_W / 2, DVR_H / 2); }
    }
  } catch (e) { _swallow(e); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
  g.font = 'bold 10px Arial'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
  const s = `CH${n} ${DVR_CH[n]}  ${_dvrT(Date.now())}`; g.strokeText(s, 4, DVR_H - 5); g.fillText(s, 4, DVR_H - 5);
  try { return _dvrCv.toDataURL('image/jpeg', 0.6); } catch (e) { return null; }
}
function dvrCapture(now) {
  const c = {}; let any = false;
  for (const n of [1, 2, 3, 4]) if (dvrRecCh(n)) { const u = _dvrGrab(n); if (u) { c[n] = u; any = true; } }
  if (!any) return;
  dvr.fr.push({ t: now, c });
  const sg = dvr.seg[dvr.seg.length - 1];
  if (sg && now - sg.t1 <= DVR_DT * 3) sg.t1 = now; else dvr.seg.push({ t0: now, t1: now });
  while (dvr.fr.length > DVR_KEEP) { dvr.fr.shift(); const s0 = dvr.seg[0]; if (s0 && dvr.fr[0]) { if (s0.t1 < dvr.fr[0].t) dvr.seg.shift(); else s0.t0 = Math.max(s0.t0, dvr.fr[0].t); } }
}
// 재생 자리 pb.t 에 맞는 장(그 시각 이전의 마지막 장)
function dvrFrameAt(t) {
  const F = dvr.fr; if (!F.length) return -1;
  let lo = 0, hi = F.length - 1; if (t < F[0].t) return 0;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (F[m].t <= t) lo = m; else hi = m - 1; }
  return lo;
}
function dvrSeek(t) {
  const F = dvr.fr; if (!F.length) return;
  t = _mClamp(t, F[0].t, F[F.length - 1].t);
  // 녹화가 끊긴 틈에 들면 가는 쪽의 다음 녹화로 건너뛴다
  const i = dvrFrameAt(t);
  if (t - F[i].t > DVR_DT * 3) t = dvr.pb.dir > 0 && F[i + 1] ? F[i + 1].t : F[i].t;
  dvr.pb.t = t;
}
function dvrPlay(on, t) {
  if (on && !dvr.fr.length) { _mToast('녹화기 — 녹화된 영상이 없습니다'); dvr.play = false; return; }
  dvr.play = !!on;
  if (dvr.play) { dvr.pb.pause = false; dvr.pb.si = 1; dvr.pb.dir = 1; dvrSeek(t != null ? t : (dvr.seg.length ? dvr.seg[dvr.seg.length - 1].t0 : dvr.fr[0].t)); _mNote('녹화기 PLAYBACK'); }
  dvrView();
}
// 재생 화면 차림 — QUAD(4분할) · 한 채널 전체
function dvrView() {
  if (!dvr.play) return;
  const v = DVR_VIEWS[dvr.view];
  if (v === 'QUAD') dispSet({ lay: 'quad' });
  else { const cell = DVR_CELL[+v[2]], ch = +Object.keys(DISP_CH).find(k => DISP_CH[k] === cell); dispSet({ lay: 'one', ch }); }
}
function dvrStep(dt) {
  if (!dvr.pwr) return;
  if (!msnDmmPwr()) { dvr.pwr = false; dvr.rec = false; dvr.play = false; dvr.menu = null; dvr.boot = 0; _mNote('DMM 전원 꺼짐 — 녹화기 · 표시기 꺼짐'); try { dvrRender(); } catch (e) { _swallow(e); } return; }
  if (dvr.boot > 0) { dvr.boot -= dt; return; }
  const now = Date.now();
  if (dvr.rec && now - dvr.capT >= DVR_DT) { dvr.capT = now; try { dvrCapture(now); } catch (e) { _swallow(e); } }
  if (dvr.play && !dvr.pb.pause && dvr.fr.length) {
    const F = dvr.fr, t = dvr.pb.t + dt * 1000 * dvrSpeed() * dvr.pb.dir;
    if (t >= F[F.length - 1].t && dvr.pb.dir > 0) { dvr.pb.t = F[F.length - 1].t; dvr.pb.pause = true; }
    else if (t <= F[0].t && dvr.pb.dir < 0) { dvr.pb.t = F[0].t; dvr.pb.pause = true; }
    else dvrSeek(t);
  }
}
function _dvrSpeedStep(dir) {
  const pb = dvr.pb;
  if (pb.pause) { pb.pause = false; pb.dir = dir; pb.si = dir > 0 ? 1 : 2; return; }
  if (pb.dir !== dir) { pb.dir = dir; pb.si = dir > 0 ? 1 : 2; return; }
  pb.si = Math.min(DVR_SPEEDS.length - 1, pb.si + 1);
}
function dvrPress(k) {
  if (k === 'power') {
    if (!dvr.pwr && !msnDmmPwr()) { _mToast('DMM 전원이 없습니다 — 하부 콘솔 MPP 패널 DMM ON'); return; }
    dvr.pwr = !dvr.pwr;
    if (dvr.pwr) dvr.boot = DVR_BOOT_S; else { dvr.rec = false; dvr.play = false; dvr.menu = null; dvr.boot = 0; }
    _mNote(`녹화기 POWER ${dvr.pwr ? 'ON' : 'OFF'}`); dvrRender(); return;
  }
  if (!dvr.pwr) { _mToast('녹화기 POWER 가 꺼져 있습니다'); return; }
  if (dvr.boot > 0) { _mToast(`녹화기 시동 중 — ${Math.ceil(dvr.boot)}초`); return; }
  const pb = dvr.pb;
  if (k === 'rec') { dvr.rec = !dvr.rec; dvr.capT = 0; _mNote(`녹화기 REC ${dvr.rec ? '시작' : '멈춤'}`); }
  else if (k === 'playback') dvrPlay(!dvr.play);
  else if (/^ch[1-4]$/.test(k)) { const n = +k[2]; if (!dvrConn(n)) _mToast(`CH${n} ${DVR_CH[n]} — 신호 없음(연결 안 됨)`); dvr.ch[n] = !dvr.ch[n]; }
  else if (k === 'menu') { dvr.menu = dvr.menu ? null : 'MAIN'; dvr.menuI = 0; dvr.fmtArm = false; }
  else if (k === 'back') { if (dvr.menu === 'MAIN') dvr.menu = null; else if (dvr.menu) { dvr.menu = 'MAIN'; dvr.fmtArm = false; } else if (dvr.play) dvrPlay(false); }
  else if (dvr.menu) _dvrMenuKey(k);
  else if (k === 'play') { if (!dvr.play) dvrPlay(true); else if (pb.si !== 1 || pb.dir < 0) { pb.si = 1; pb.dir = 1; pb.pause = false; } else pb.pause = !pb.pause; }
  else if (!dvr.play) { if (['rew', 'ff', 'left', 'right', 'up', 'down', 'enter'].includes(k)) _mToast('녹화기 — PLAYBACK 이나 MENU 에서 씁니다'); }
  else if (k === 'ff') _dvrSpeedStep(1);
  else if (k === 'rew') _dvrSpeedStep(-1);
  else if (k === 'left' || k === 'right') dvrSeek(pb.t + (k === 'right' ? 10000 : -10000));
  else if (k === 'up') { pb.si = Math.min(DVR_SPEEDS.length - 1, pb.si + 1); pb.pause = false; }
  else if (k === 'down') { pb.si = Math.max(0, pb.si - 1); pb.pause = false; }
  else if (k === 'enter') pb.pause = !pb.pause;
  dvrRender();
}
function _dvrMenuKey(k) {
  if (dvr.menu === 'MAIN') {
    if (k === 'up' || k === 'down') { dvr.menuI = (dvr.menuI + (k === 'down' ? 1 : -1) + DVR_MENU.length) % DVR_MENU.length; dvr.fmtArm = false; }
    else if (k === 'enter' || k === 'right') {
      const i = dvr.menuI;
      if (i === 0) { dvr.menu = 'SEARCH'; dvr.srch.t = dvr.fr.length ? (dvr.play ? dvr.pb.t : dvr.seg[dvr.seg.length - 1].t0) : Date.now(); dvr.srch.f = 3; }
      else if (i === 1) { dvr.view = (dvr.view + 1) % DVR_VIEWS.length; dvrView(); }
      else if (i === 2) dvrExport();
      else if (i === 3) dvr.menu = 'INFO';
      else if (i === 4) { if (!dvr.fmtArm) { dvr.fmtArm = true; _mToast('SSD FORMAT — ENTER 를 한 번 더 누르면 모든 녹화를 지웁니다'); } else { dvr.fr = []; dvr.seg = []; dvr.play = false; dvr.fmtArm = false; _mNote('녹화기 SSD FORMAT'); } }
    }
    return;
  }
  if (dvr.menu === 'SEARCH') {
    // 칸: 0 년 · 1 월 · 2 일 · 3 시 · 4 분 · 5 초 — ◀▶ 칸 · ▲▼ 값 · ENTER 그 시각부터 재생
    const s = dvr.srch;
    if (k === 'left') s.f = Math.max(0, s.f - 1);
    else if (k === 'right') s.f = Math.min(5, s.f + 1);
    else if (k === 'up' || k === 'down') {
      const d = new Date(s.t), v = k === 'up' ? 1 : -1;
      [() => d.setFullYear(d.getFullYear() + v), () => d.setMonth(d.getMonth() + v), () => d.setDate(d.getDate() + v),
       () => d.setHours(d.getHours() + v), () => d.setMinutes(d.getMinutes() + v), () => d.setSeconds(d.getSeconds() + v)][s.f]();
      s.t = d.getTime();
    } else if (k === 'enter') {
      if (!dvr.fr.length) { _mToast('녹화기 — 녹화된 영상이 없습니다'); return; }
      const F = dvr.fr; let t = s.t;
      if (t < F[0].t || t > F[F.length - 1].t) { _mToast('그 시각에는 녹화가 없습니다 — 가장 가까운 녹화부터'); }
      dvr.menu = null; dvrPlay(true, t);
    }
    return;
  }
  if (dvr.menu === 'INFO' && (k === 'enter' || k === 'left')) dvr.menu = 'MAIN';
}
// SSD 사용량 — 실기 용량(5.5시간)에 견준다
function dvrSsd() {
  let sec = 0; for (const s of dvr.seg) sec += (s.t1 - s.t0 + DVR_DT) / 1000;
  return { sec, pct: Math.min(100, sec / (DVR_SSD_H * 3600) * 100), left: Math.max(0, DVR_SSD_H * 3600 - sec), clips: dvr.seg.length };
}
// ── USB 내보내기 — 지금 재생 중인 녹화(없으면 마지막 녹화)를 채널마다 MJPEG AVI 로 묶어 ZIP 으로 내려받는다 ──
function _dvrB64(u) { const b = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function dvrAvi(jpegs, frameMs, w, h) {
  const n = jpegs.length, pad = x => x + (x & 1);
  let movi = 4; for (const j of jpegs) movi += 8 + pad(j.length);
  const hdrl = 4 + (8 + 56) + (8 + 4 + (8 + 56) + (8 + 40)), idx = 16 * n;
  const total = 12 + (8 + hdrl) + (8 + movi) + (8 + idx), buf = new ArrayBuffer(total), v = new DataView(buf), u8 = new Uint8Array(buf);
  let p = 0; const S4 = s => { for (let i = 0; i < 4; i++) v.setUint8(p++, s.charCodeAt(i)); }, U32 = x => { v.setUint32(p, x, true); p += 4; }, U16 = x => { v.setUint16(p, x, true); p += 2; };
  const maxJ = jpegs.reduce((m, j) => Math.max(m, j.length), 0);
  S4('RIFF'); U32(total - 8); S4('AVI ');
  S4('LIST'); U32(hdrl); S4('hdrl');
  S4('avih'); U32(56); U32(Math.round(frameMs * 1000)); U32(Math.ceil(maxJ * 1000 / frameMs)); U32(0); U32(0x10); U32(n); U32(0); U32(1); U32(maxJ); U32(w); U32(h); U32(0); U32(0); U32(0); U32(0);
  S4('LIST'); U32(4 + 64 + 48); S4('strl');
  S4('strh'); U32(56); S4('vids'); S4('MJPG'); U32(0); U16(0); U16(0); U32(0); U32(frameMs); U32(1000); U32(0); U32(n); U32(maxJ); U32(0xFFFFFFFF); U32(0); U16(0); U16(0); U16(w); U16(h);
  S4('strf'); U32(40); U32(40); U32(w); U32(h); U16(1); U16(24); S4('MJPG'); U32(w * h * 3); U32(0); U32(0); U32(0); U32(0);
  S4('LIST'); U32(movi); const m0 = p; S4('movi');
  const offs = [];
  for (const j of jpegs) { offs.push(p - m0); S4('00dc'); U32(j.length); u8.set(j, p); p += pad(j.length); }
  S4('idx1'); U32(idx);
  jpegs.forEach((j, i) => { S4('00dc'); U32(0x10); U32(offs[i]); U32(j.length); });
  return buf;
}
async function dvrExport() {
  if (!dvr.fr.length) { _mToast('녹화기 — 내보낼 녹화가 없습니다'); return null; }
  const t = dvr.play ? dvr.pb.t : dvr.seg[dvr.seg.length - 1].t0;
  const sg = dvr.seg.find(s => t >= s.t0 - 1 && t <= s.t1 + 1) || dvr.seg[dvr.seg.length - 1];
  const fr = dvr.fr.filter(f => f.t >= sg.t0 && f.t <= sg.t1), stamp = _dvrT(sg.t0).replace(/[-: ]/g, '').replace(/^(\d{8})/, '$1_');
  const files = {};
  for (const n of [1, 2, 3, 4]) {
    const js = fr.filter(f => f.c[n]).map(f => _dvrB64(f.c[n]));
    if (js.length) files[`DVR_${stamp}_CH${n}_${DVR_CH[n].replace(/[^A-Z]/g, '')}.avi`] = dvrAvi(js, DVR_DT, DVR_W, DVR_H);
  }
  dvr.exp = { name: `DVR_${stamp}.zip`, n: Object.keys(files).length, frames: fr.length };
  _mNote(`녹화기 USB 내보내기 ${dvr.exp.name}`);
  try {
    if (typeof JSZip === 'undefined') throw new Error('zip');
    const z = new JSZip(); for (const [f, b] of Object.entries(files)) z.file(f, b);
    const blob = await z.generateAsync({ type: 'blob' });
    dvr.exp.size = blob.size;
    if (!window.__dvrNoDl) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = dvr.exp.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
    _mToast(`USB — ${dvr.exp.name} (AVI ${dvr.exp.n}개 · ${fr.length}장)`);
  } catch (e) { _swallow(e); _mToast('USB 내보내기 실패'); }
  dvrRender();
  return files;
}
// ── 표시 — 표시등 · 재생 화면(칸마다 그 채널) · 메뉴 OSD ──
const _dvrImg = new Map();
function _dvrImgOf(u) {
  let im = _dvrImg.get(u);
  if (!im) { im = new Image(); im.src = u; _dvrImg.set(u, im); if (_dvrImg.size > 40) _dvrImg.delete(_dvrImg.keys().next().value); }
  return im;
}
function dvrRender() {
  if (!_msnEl) return;
  const blink = Math.floor(performance.now() / 500) % 2 === 0, on = dvr.pwr && dvr.boot <= 0;
  const L = (n, c) => { const e = _msnEl.querySelector(`[data-dvl="${n}"]`); if (e) e.className = 'dvr-led' + (c ? ' ' + c : ''); };
  L('pwr', dvr.pwr ? 'red' : ''); L('rec', on ? (dvr.rec ? (blink ? 'on' : '') : 'on') : ''); L('play', on && dvr.play ? 'blue' : '');
  [1, 2, 3, 4].forEach(n => L('ch' + n, on && dvrConn(n) && dvr.ch[n] ? (dvr.rec ? (blink ? 'on' : '') : 'on') : ''));
  const sl = _msnEl.querySelector('[data-m="dvrst"]');
  if (sl) { const s = dvrSsd(); sl.textContent = !dvr.pwr ? '' : dvr.boot > 0 ? 'BOOT…' : `${dvr.rec ? '●REC ' : ''}${dvr.play ? (dvr.pb.pause ? '❙❙ ' : (dvr.pb.dir < 0 ? '◀' : '▶') + dvrSpeed() + 'x ') : ''}SSD ${s.pct.toFixed(1)}%`; }
  _dvrOsd();
}
function _dvrOsd() {
  const scr = _msnEl.querySelector('.msn-scr'); if (!scr) return;
  let o = scr.querySelector('.dvr-osd');
  if (!o) { o = document.createElement('div'); o.className = 'dvr-osd'; scr.appendChild(o); }
  const show = dvr.pwr && dvr.boot <= 0 && dvr.menu;
  o.style.display = show ? '' : 'none';
  if (!show) return;
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  let h = '';
  if (dvr.menu === 'MAIN') h = `<h4>DVR MENU</h4>` + DVR_MENU.map((m, i) => `<p class="${i === dvr.menuI ? 'sel' : ''}">${esc(m)}${i === 1 ? ` : <b>${DVR_VIEWS[dvr.view]}</b>` : ''}${i === 4 && dvr.fmtArm ? ' — ENTER 다시' : ''}</p>`).join('') + `<small>▲▼ 고르기 · ENTER · ↩ 닫기</small>`;
  else if (dvr.menu === 'SEARCH') {
    const d = new Date(dvr.srch.t), p = v => String(v).padStart(2, '0');
    const fld = [d.getFullYear(), p(d.getMonth() + 1), p(d.getDate()), p(d.getHours()), p(d.getMinutes()), p(d.getSeconds())].map((v, i) => `<span class="${i === dvr.srch.f ? 'sel' : ''}">${v}</span>`);
    // 달력 — 녹화가 있는 날은 초록
    const y = d.getFullYear(), mo = d.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    const has = new Set(dvr.seg.filter(s => { const a = new Date(s.t0); return a.getFullYear() === y && a.getMonth() === mo; }).map(s => new Date(s.t0).getDate()));
    let cal = '<div class="dvr-cal">' + '일월화수목금토'.split('').map(x => `<i>${x}</i>`).join('') + '<i></i>'.repeat(first);
    for (let i = 1; i <= days; i++) cal += `<i class="${has.has(i) ? 'rec' : ''}${i === d.getDate() ? ' cur' : ''}">${i}</i>`;
    cal += '</div>';
    const list = dvr.seg.slice(-5).reverse().map(s => `<p>● ${_dvrT(s.t0)} ~ ${_dvrT(s.t1).slice(11)}</p>`).join('') || '<p>녹화 없음</p>';
    h = `<h4>SEARCH — 날짜 · 시간</h4><div class="dvr-dt">${fld[0]}-${fld[1]}-${fld[2]} ${fld[3]}:${fld[4]}:${fld[5]}</div>${cal}${list}<small>◀▶ 칸 · ▲▼ 값 · ENTER 재생 · ↩ 뒤로</small>`;
  } else if (dvr.menu === 'INFO') {
    const s = dvrSsd();
    h = `<h4>SSD INFO</h4><p>사용 ${_dvrHm(s.sec)} / ${DVR_SSD_H}h (${s.pct.toFixed(1)}%)</p><p>남은 녹화 ${_dvrHm(s.left)}</p><p>녹화 ${s.clips}개 · ${dvr.fr.length}장 (.MUX)</p>` +
      [1, 2, 3, 4].map(n => `<p>CH${n} ${DVR_CH[n]} — ${dvrConn(n) ? (dvr.ch[n] ? 'REC ON' : 'REC OFF') : 'NO SIGNAL'}</p>`).join('') +
      (dvr.exp ? `<p>USB: ${esc(dvr.exp.name)}</p>` : '') + `<small>↩ 뒤로</small>`;
  }
  if (o._h !== h) { o.innerHTML = h; o._h = h; }
}
// 재생 — 보이는 칸마다 그 채널의 녹화 장을 덮어 그린다
function dvrPlayDraw() {
  if (!_msnEl) return;
  const on = dvr.pwr && dvr.boot <= 0 && dvr.play && dvr.fr.length;
  const i = on ? dvrFrameAt(dvr.pb.t) : -1, f = i >= 0 ? dvr.fr[i] : null;
  for (const n of [1, 2, 3, 4]) {
    const cell = _msnEl.querySelector('.c-' + DVR_CELL[n]); if (!cell) continue;
    let cv = cell.querySelector('canvas.dvr-pb');
    if (!on) { if (cv) cv.style.display = 'none'; continue; }
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'dvr-pb'; cell.appendChild(cv); }
    cv.style.display = '';
    if (!_cellVis(cell)) continue;
    const d = _msnFit(cv), g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, d.W, d.H);
    const u = f && f.c[n];
    if (u) { const im = _dvrImgOf(u); if (im.complete && im.naturalWidth) { const s = Math.min(d.W / DVR_W, d.H / DVR_H); g.drawImage(im, (d.W - DVR_W * s) / 2, (d.H - DVR_H * s) / 2, DVR_W * s, DVR_H * s); } }
    else { g.fillStyle = '#667'; g.font = `bold ${Math.round(d.H / 14)}px Arial`; g.textAlign = 'center'; g.fillText(`CH${n} — NO RECORD`, d.W / 2, d.H / 2); }
    const k = Math.max(1, d.H / 300); g.font = `bold ${Math.round(12 * k)}px Arial`; g.textAlign = 'left';
    const pb = dvr.pb, st = pb.pause ? '❙❙ PAUSE' : `${pb.dir < 0 ? '◀◀' : '▶'} ${dvrSpeed()}x`;
    g.fillStyle = '#4aa8ff'; g.fillText(`PLAYBACK  ${st}`, 8 * k, 16 * k);
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(_dvrT(pb.t), d.W - 8 * k, 16 * k);
    // 시간 막대 — 처음 ~ 끝 · 녹화 구간 · 지금 자리
    const F = dvr.fr, a = F[0].t, b = Math.max(a + 1, F[F.length - 1].t), x0 = 8 * k, x1 = d.W - 8 * k, y = d.H - 10 * k, X = t => x0 + (x1 - x0) * (t - a) / (b - a);
    g.fillStyle = '#333'; g.fillRect(x0, y, x1 - x0, 4 * k); g.fillStyle = '#2f8f4f'; for (const s of dvr.seg) g.fillRect(X(s.t0), y, Math.max(2, X(s.t1) - X(s.t0)), 4 * k);
    g.fillStyle = '#4aa8ff'; g.fillRect(X(pb.t) - 2 * k, y - 4 * k, 4 * k, 12 * k);
  }
}
// ══ 탐색등 조작기(HSL-1600 HCU) — LSR/OFF · IR/VIS · LAMP/OFF · INIT/STOW · OFFSET · MAN/AUTO · FOCUS · 조이스틱 · 표시등 ══
//   (자세한 기능은 교범을 받아 더한다 — 지금은 켜고 끄기 · 수동/연동 · 지향 · 표시등)
const slc = { lsr: false, ir: false, test: false, dim: 1, rdim: 1, joy: { x: 0, y: 0 }, down: {} };
function slcPress(k, down) {
  if (down) slc.down[k] = true; else delete slc.down[k];
  if (k === 'test') slc.test = down;
  if (!down) { slcRender(); return; }
  switch (k) {
    case 'lsr': slc.lsr = !slc.lsr; break;
    case 'ir': hsl.ir = !hsl.ir; slc.ir = hsl.ir; if (hsl.lamp && !hsl.ir && typeof env !== 'undefined' && env.nvg) _mToast('⚠ 주의 — NVG 를 쓴 조종사의 허락 없이 가시광(VIS)으로 바꾸지 마십시오'); _mNote(`탐조등 ${hsl.ir ? 'IR' : 'VIS'}`); break;
    case 'lamp': hslLampSet(!hsl.lamp); break;
    case 'init': if (hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW')) hslInit(); else hslStow(); break;
    case 'manauto': if (!hsl.pwr) { _mToast('SEARCH LT PWR 꺼짐'); break; } srchMode(srch.mode === 'MAN' ? 'EO' : 'MAN'); break;
    case 'offset': _mToast('탐조등 OFFSET — 기능은 교범을 받아 더합니다'); break;
    case 'hdim:up': slc.dim = Math.min(1, slc.dim + 0.25); break; case 'hdim:dn': slc.dim = Math.max(0.25, slc.dim - 0.25); break;
    case 'rdim:up': slc.rdim = Math.min(1, slc.rdim + 0.25); break; case 'rdim:dn': slc.rdim = Math.max(0.25, slc.rdim - 0.25); break;
  }
  slcRender(); msnRenderPanels();
}
function slcStep(dt) {
  const j = slc.joy; if (Math.hypot(j.x, j.y) < 0.05 || !hsl.pwr || hsl.stowed || hsl.mv) return;
  srch.mode = 'MAN';
  hsl.az = _mClamp(hsl.az + j.x * Math.abs(j.x) * HSL.azRate * dt, HSL.azMin, HSL.azMax);
  hsl.el = _mClamp(hsl.el + j.y * Math.abs(j.y) * HSL.elRate * dt, HSL.elMin, HSL.elMax);
}
function slcRender() {
  if (!_msnEl) return;
  const T = slc.test, blink = Math.floor(performance.now() / 400) % 2 === 0;
  const L = { FAULT: hsl.fault, LSR: slc.lsr, LAMP: hsl.lit || (hsl.lamp && blink), PWR: hsl.pwr, BLK: hsl.pwr && (hsl.stowed || !!hsl.mv), AUTO: srch.mode !== 'MAN', IR: hsl.ir, STW: hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW' && blink) };
  _msnEl.querySelectorAll('[data-sll]').forEach(e => { const n = e.dataset.sll; e.classList.toggle('on', !!(T || L[n])); e.classList.toggle('f', n === 'FAULT'); });
  const lm = _msnEl.querySelector('[data-m="slclm"]'); if (lm) { lm.classList.toggle('dim', slc.dim < 0.75); lm.style.opacity = String(0.4 + 0.6 * slc.dim); }
  const kpos = { lsr: slc.lsr, ir: hsl.ir, lamp: hsl.lamp, init: !(hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW')) };
  _msnEl.querySelectorAll('.slc-sw .k').forEach(e => { const v = kpos[e.dataset.slc]; e.classList.toggle('up', !!v); e.classList.toggle('dn', !v); });
  _msnEl.querySelectorAll('.slc-pb b').forEach(e => e.classList.toggle('dn', !!slc.down[e.dataset.slc]));
  const pw = _msnEl.querySelector('[data-mact="slpwr"]'); if (pw) { pw.classList.toggle('on', hsl.pwr); pw.textContent = `SEARCH LT PWR ${hsl.pwr ? 'ON' : 'OFF'}`; }
}
// ══ 탐색레이더 조작기(VCCP — Video Converter Control Panel · FLM 5.20) ══
//   MAP 지도 메뉴 · ESC · CLR 뒤로(하위 메뉴 → 메뉴 닫기) · 메뉴 밖 CLR 은 추적 풀기 · FNC 메인 메뉴(화면 왼쪽 세로) · WXR 강수 겹 · TWS 지형 겹 · COM/TFC 쓰지 않음
//   손잡이: 돌림 — 메뉴가 없으면 거리(RNG), 메뉴가 있으면 칸 옮기기 / 누름 — 메뉴 칸 실행 · 없으면 커서 자리 표적 추적(TRK) / 4축(8방향) — 커서
const nv = { nm: 5, cur: null, ctr: null, pushT: 0 };
const NV_RNG = [1, 2, 5, 10, 20, 40];
// 조종실(하부 콘솔 ⑮ VCCP · CDU 노브)이 다룰 수 있는가 — CABIN 이면 전탐석만
function rdrCkptOk() { return rdr.cmd !== 'CABIN'; }
function rdrSideOk(side) { return side === 'CKPT' ? rdrCkptOk() : rdrCabinOk(); }
let _clnSide = 'CABIN';
function _rdrGuard(k) {
  if (rdrSideOk(_clnSide)) return true;
  // 권한이 없는 쪽 — 메뉴를 열어 RDR > CMD 만 바꿀 수 있다
  if (k === 'fnc' || k === 'esc' || (rdr.menu && (k.startsWith('rot:') || k === 'push' || k === 'clr' || /^n[1-9]$/.test(k)))) return true;
  _mToast(_clnSide === 'CKPT' ? 'RDR CMD CABIN — 전탐석이 레이더를 쥐고 있습니다(FNC → CMD ▷ 를 CKPT · INTRLV 로)'
                              : 'RDR CMD CKPT — 조종실이 레이더를 쥐고 있습니다(FNC → CMD ▷ 를 CABIN · INTRLV 로)');
  return false;
}
// 메뉴 — 누름(실행 · 하위 메뉴 열기) · 뒤로(하위 메뉴 닫기 → 메뉴 닫기)
function rdrMenuPush() {
  const M = RDR_MENU[rdr.menu]; if (!M) return;
  rdr.menuT = performance.now();
  const ok = it => rdrSideOk(_clnSide) || it.any;
  if (rdr.sub !== null) {
    const it = M[rdr.sub].sub[rdr.subI]; if (!it) return;
    if (!ok(it)) { _mToast(`RDR CMD ${RDR_CMD_NM[rdr.cmd]} — CMD 만 바꿀 수 있습니다`); return; }
    it.set(1); return;
  }
  const it = M[rdr.menuI]; if (!it) return;
  if (it.sub) { if (!ok(it)) { _mToast(`RDR CMD ${RDR_CMD_NM[rdr.cmd]} — CMD 만 바꿀 수 있습니다`); return; } rdr.sub = rdr.menuI; rdr.subI = 0; return; }
  if (!ok(it)) { _mToast(`RDR CMD ${RDR_CMD_NM[rdr.cmd]} — CMD 만 바꿀 수 있습니다`); return; }
  it.set(1);
}
function rdrMenuBack() { if (rdr.sub !== null) rdr.sub = null; else rdr.menu = null; }
// side: 'CABIN'(전탐석 VCCP · 처음) · 'CKPT'(조종석 하부 콘솔 ⑮ VCCP) — 두 VCCP 는 같은 레이더(rdr)를 다룬다
function clnPress(k, down, side) {
  _clnSide = side === 'CKPT' ? 'CKPT' : 'CABIN';
  if (k === 'push') {
    if (down) { nv.pushT = performance.now(); return; }
    if (!_rdrGuard('push')) return;
    if (rdr.menu) rdrMenuPush();
    else rdrCursorTrk();
    msnRenderPanels(); vccpRender(); return;
  }
  if (!down || !_rdrGuard(k)) return;
  if (rdr.menu) rdr.menuT = performance.now();
  if (k.startsWith('rot:')) {
    const d = +k.slice(4);
    if (rdr.menu && rdr.sub !== null) { const L = RDR_MENU[rdr.menu][rdr.sub].sub.length; rdr.subI = (rdr.subI + d + L) % L; }
    else if (rdr.menu) rdr.menuI = (rdr.menuI + d + RDR_MENU[rdr.menu].length) % RDR_MENU[rdr.menu].length; else rdrRngStep(d);
    return;
  }
  if (/^n[1-9]$/.test(k)) { if (rdr.menu && rdr.sub !== null) { const L = RDR_MENU[rdr.menu][rdr.sub].sub; const i = +k[1] - 1; if (i < L.length) { rdr.subI = i; rdrMenuPush(); } } msnRenderPanels(); vccpRender(); return; }   // 하위 메뉴 번호 바로 고르기
  if (k.startsWith('pan:')) {
    const d = k.slice(4), lim = rdr.sector / 2;
    if (d.includes('n')) rdr.cur.nm = Math.min(rdr.rng, rdr.cur.nm + rdr.rng * 0.04);
    if (d.includes('s')) rdr.cur.nm = Math.max(0, rdr.cur.nm - rdr.rng * 0.04);
    if (d.includes('e')) rdr.cur.az = Math.min(lim, rdr.cur.az + 2);
    if (d.includes('w')) rdr.cur.az = Math.max(-lim, rdr.cur.az - 2);
    return;
  }
  switch (k) {
    case 'map': rdr.menu = rdr.menu === 'MAP' ? null : 'MAP'; rdr.menuI = 0; rdr.sub = null; rdr.menuT = performance.now(); break;
    case 'fnc': rdr.menu = rdr.menu === 'FNC' ? null : 'FNC'; rdr.menuI = 0; rdr.sub = null; rdr.menuT = performance.now(); break;
    case 'esc': rdrMenuBack(); break;
    case 'clr': if (rdr.menu) rdrMenuBack(); else { if (rdr.tgt) rdrTrack(rdr.tgt, false); rdr.cur = { az: 0, nm: rdr.rng / 2 }; } break;
    case 'wxr': rdr.wxr = !rdr.wxr; rdrClearPicture(); break;
    case 'tws': rdr.tws = !rdr.tws; break;
    case 'com': case 'tfc': break;   // 쓰지 않는다
  }
  msnRenderPanels(); vccpRender();
}
function nvPickAt(lat, lon) {
  let best = null, bd = nv.nm * 0.12;
  for (const c of msnContacts()) { const d = distance(lat, lon, c.lat, c.lon); if (d < bd) { bd = d; best = c.id; } }
  return best;
}
let _slHold = null;
function eoFocusBy(d) { if (eo.geo) eo.geoTrim = _mClamp(eo.geoTrim + d, -99, 99); else eo.focus = _mClamp(eo.focus + d, 0, 100); }
function msnAct(a) {
  switch (a) {
    case 'fly': try { toggleSim(); } catch (e) { _swallow(e); } break;
    case 'spawn': { const n = msnSpawn(6); _mToast(n ? `선박 표적 ${n}척을 둘레 바다(2~12NM)에 띄웠습니다` : '둘레에 바다가 없어 띄우지 못했습니다(지형을 아직 모르면 잠시 뒤에)'); break; }
    case 'clear': msnVslClear(); break;
    case 'nv+': { const i = NV_RNG.indexOf(nv.nm); nv.nm = NV_RNG[_mClamp((i < 0 ? 2 : i) - 1, 0, NV_RNG.length - 1)]; break; }
    case 'nv-': { const i = NV_RNG.indexOf(nv.nm); nv.nm = NV_RNG[_mClamp((i < 0 ? 2 : i) + 1, 0, NV_RNG.length - 1)]; break; }
    case 'nvc': nv.ctr = null; nv.cur = null; break;
    case 'help': msnHelp(); break;
    case 'close': if (msnPopped()) { try { popoutElement('msn'); } catch (e) { _swallow(e); } } msnShow(false); setTimeout(() => { try { applyPanels(); } catch (e) { _swallow(e); } }, 0); break;   // Vendor 창이 고른 것이면 그 창으로 돌아간다
    case 'popout': msnPopout(); break;
    case 'rcmd': rdr.cmd = RDR_CMDS[(RDR_CMDS.indexOf(rdr.cmd) + 1) % 3]; _mNote(`RDR > CMD ${rdr.cmd}`); break;
    case 'rtx': case 'rmode': case 'rng-': case 'rng+': case 'tilt-': case 'tilt+': case 'gain-': case 'gain+': case 'rsec': case 'rfrz': case 'ronly':
      if (!_rdrGuard(a)) break;
      if (a === 'rtx') rdrTx(!rdr.tx);
      else if (a === 'rmode') { rdr.mode = RDR_MODES[(RDR_MODES.indexOf(rdr.mode) + 1) % RDR_MODES.length]; rdrClearPicture(); }
      else if (a === 'rng-') rdrRngStep(-1); else if (a === 'rng+') rdrRngStep(1);
      else if (a === 'tilt-') rdr.tilt = Math.max(-30, rdr.tilt - 1); else if (a === 'tilt+') rdr.tilt = Math.min(30, rdr.tilt + 1);
      else if (a === 'gain-') rdr.gain = Math.max(0, rdr.gain - 1); else if (a === 'gain+') rdr.gain = Math.min(30, rdr.gain + 1);
      else if (a === 'rsec') { rdr.sector = RDR_SECTORS[(RDR_SECTORS.indexOf(rdr.sector) + 1) % RDR_SECTORS.length]; rdrClearPicture(); }
      else if (a === 'rfrz') rdr.frz = !rdr.frz; else if (a === 'ronly') rdr.ronly = !rdr.ronly;
      break;
    case 'r2eo': rdrSlaveEo(); break;
    case 'r2sl': if (rdr.tgt) srchMode('RDR'); else _mToast('먼저 레이더 화면에서 표적을 누르십시오'); break;
    case 'rclr': rdr.tgt = null; break;
    case 'slon': hslLampSet(!hsl.lamp); break;
    case 'slpwr': hslPwrSet(!hsl.pwr); break;
    case 'slman': srchMode('MAN'); break;
    case 'sleo': srchMode('EO'); break;
    case 'slrdr': if (rdr.tgt) srchMode('RDR'); else _mToast('먼저 레이더 화면에서 표적을 누르십시오'); break;
    case 'slctr': hslInit(); break;
  }
  msnRenderPanels();
}
function msnHelp() {
  const t = ['흰수리 전탐석 — EO/IR · SAR 레이더 · 서치라이트',
    '· 표시기: MULTI 4분할(왼쪽 위 지도 · 오른쪽 위 호이스트 카메라 · 왼쪽 아래 레이더 · 오른쪽 아래 EO/IR) · SPLIT 2분할(CH 로 짝 바꾸기) · V-IN 1~4 / VIDEO / NAVI 한 화면 · ▲▼ 밝기 · M-PWR',
    '· 탐조등 HSL-1600 조작기(오른쪽 위 · FLM 5.22): 처음엔 STOW — INIT 로 풀고(−45°) LAMP 를 켜면 5초 뒤 점등 · IR/VIS(IR 은 NVG 로만 보인다)',
    '  MAN/AUTO(AUTO = EO/IR 연동 SLASS) · 조이스틱(고각 −20~−90° · 방위 −150~+30°) · FOCUS 빔폭 4~13° · STOW 25초 · 끄면 냉각팬 7분(그동안 SEARCH LT PWR 를 끄지 않는다)',
    '  ⚠ 10ft(3.04m) 안의 물체를 비추면 100~300℃ · NVG 를 쓴 조종사 허락 없이 가시광 금지 · 조종석 컬렉티브 SRCH LT 와는 다른 등',
    '· 탐색레이더(Seaspray 5000E · VCCP): RDR > CMD 가 CKPT(조종실)이면 전탐석은 다루지 못한다 — FNC 메뉴의 CMD ▷ 를 CABIN · INTRLV 로',
    '· 조종석에서도 같은 레이더: 하부 콘솔 ⑮ VCCP(같은 면판 · CKPT/SHARED 일 때) · SYSTEM 창 Video Channel RADAR 가 이 레이더 화면 그대로 · CDU 조이스틱 Push:Radar',
    '· 전원: 하부 콘솔 MPP 패널 DMM ON → 녹화기(가운데) POWER → 3초 뒤 표시기 화면 전체가 들어온다(DMM 을 끄면 함께 꺼진다)',
    '· 녹화기(DVR): POWER(빨강) → 3초 뒤 REC(초록 깜박) · CH1 EO/IR · CH2 레이더 · CH3 호이스트 · CH4 지도 · PLAYBACK(파랑) ▶▶/◀◀ 0.5~256배 · ◀▶ 10초 · MENU — 날짜/시간 검색 · QUAD/한 채널 · USB(AVI) · SSD INFO',
    '  손잡이 돌림 — 거리 10~200NM(메뉴가 열려 있으면 칸 옮기기) · 누름 — 메뉴 실행 · 커서 자리 표적 추적(TRK) · 4축 — 커서',
    '  FNC — 화면 왼쪽 세로 메뉴(FLM 5.20 표 2 · 표 4): RDR RNG ± · MODE ▷(PT · LRS · WX · TURB · SART · STM · MTI · ISAR) · CMD ▷(CKPT · CABIN · INTRLV) · R SET ▷(TILT · GAIN · AUTO GAIN · STS · CONTACT TAILS · GREY-GREEN · LINK R) · TRACK ▷(MK TRK · IN/EX AREA · DEL ALL · FILTER) · SCN/BLK ▷ · SEARCH ▷(USER 1~6 · ALL · BY DISTANCE · STEER CAM) · MAINT ▷(FAULTS · BIT · RDR NAV) · RDR TX · R ONLY · FREEZE',
    '  손잡이 돌림 고르기 · 누름 실행(▷ 는 오른쪽에 하위 메뉴) · ESC/CLR 뒤로 · 10초 조작 없으면 닫힘 · 키보드(마우스를 Vendor 위에): M 메뉴 · ↑↓ · Enter · 1~9 · Esc · MAP(WXR · TWS · R ONLY · RANGE) · 다시 켜면 90초 예열',
    '· EO/IR: 조이스틱(화면 HCU 가운데 · 실제 조종 장치의 사이클릭 축)으로 터릿을 돌린다. ZOOM ▲확대 ▼축소 · VIC 센서(EOW → EON → IR) · 2X 전자 줌 · POL 백상/흑상',
    '· AVT: 한 번 누르면 게이트(ACQ) — 표적을 게이트에 넣고 한 번 더 누르면 잠금(LOCKED) · 1.5초 누르면 해제',
    '· AUTO: 지금 보는 자리를 좌표로 고정 · MANUAL: 수동 · AID: 지면 고정 보조 · ZMULTI: 화각에 맞춘 감도',
    '· SLEW: MAP 으로 고른 POI(레이더 표적 · 선박 · 함정 · 요구조자 · 비행계획 지점)로 · FWD: 전방(2초 누르면 지금 자리를 새 전방으로) · STOW',
    '· LRF: 한 번 측정 · 2초 누르면 연속 · LASER: MENU 에서 LASER ARM 일 때 누르는 동안 조사',
    '· MENU: ZOOM 으로 고르고 SENS 로 바꾼다(LASER ARM · 서치라이트 연동 · PIP · AVT MODE · 단위)',
    '· 레이더: TX 를 켜고 화면의 표적을 누르면 지정 → "EO/IR → 표적" 으로 터릿을, "서치라이트 → 표적" 으로 빛을 돌린다',
    '· 외장형 탐조등(HSL-1600 · 왼쪽 승무원 도어 밑 검정 램프): 착륙등의 2배 밝기 · 10배 거리 · 조종석 컬렉티브 SRCH LT(접혀 있으면 INIT 뒤 켜짐) · SRCH CTR(◀▶▲▼) · 배정한 조이스틱 단추로도',
    '· EO/IR 영상: 탐조등 · 착륙등이 비춘 자리는 밤에도 밝게 보인다(주간 · 저광 카메라 — 열상 IR 은 가시광을 보지 못한다 · IR 탐조등은 EON 저광에만)',
    '· 서치라이트: 수동(◀▲▼▶) · EO/IR 연동(시선이 닿는 자리를 비춘다 · HCU AUX) · 레이더 표적 연동',
    '· 조종석 SYSTEM 창 Video(CDU Aircraft Systems → Video → Channel EO/IR)에 같은 영상 · 오버레이가 나온다 — 전탐석이 터릿을 돌리면 조종사도 그대로 본다',
    '· 기체는 흰수리 그대로 난다 — "조종석 보기" 로 비행계획 · 자동비행을 다루고, 지도 왼쪽 아래 🎯 전탐석 으로 돌아온다'];
  try { uiAlert(t.join('\n')); } catch (e) { _swallow(e); }
}
// 실제 조종 장치 — 사이클릭(롤 · 피치)으로 배정한 축, 없으면 지금 쓰는 장치의 축 0 · 1
function _msnJoyAxes() {
  if (!msnOpen || typeof joyAxVal !== 'function' || typeof joyOn === 'undefined' || !joyOn) return null;
  try {
    if (!MSN_REMOTE && typeof simModeOn !== 'undefined' && simModeOn) return null;   // SIM 으로 몰고 있으면 사이클릭은 비행에 쓴다(다른 기기의 Vendor 는 제 장치)
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
let _eoHost = null, _eoWantT = -Infinity;   // 처음에는 아무도 보지 않는다(0 이면 페이지가 뜨자마자 5초 동안 3D 지도를 만들었다 — 페이지마다)
const EO_IDLE_MS = 5000;
function _eoNeed() { return msnOpen || performance.now() - _eoWantT < EO_IDLE_MS; }
function _eoHostPlace() {
  if (!_eoHost) { _eoHost = document.createElement('div'); _eoHost.className = 'eo-map'; }
  let vid = msnOpen && _msnEl ? _msnEl.querySelector('.eo-vid') : null;
  if (vid && !(vid.clientWidth > 20 && vid.clientHeight > 20)) vid = null;   // 표시기에 EO/IR 칸이 없으면 화면 밖에
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
    try { if (typeof mapGlGuard === 'function') mapGlGuard(map, 'EO/IR', m => { if (_eoMap === m) _eoMapDrop(); }); } catch (e) { _swallow(e); }   // 그래픽 문맥을 잃고 안 돌아오면 거둔다(다음 그림에서 새로 만든다)
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
  try { _mJump(map, _ml3dCamOptions(S.lon, S.lat, camAlt, normA(S.hdg + eo.az), _mClamp(90 + eo.el, 0, 180), 0, dist, map), _eoLiveKey(), _eoDyn()); } catch (e) { _swallow(e); }
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
      g.save(); g.translate(ox, oy); g.scale(s, s); try { _eoBeamsG(g, cw, ch); } catch (e) { _swallow(e); } g.restore();   // 빛 무리(필터 밖)
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
  if (!hsl.lit || hsl.ir) return false;
  const p = eoLosPoint(); if (!p) return false;
  const a = eoAngTo(p.lat, p.lon, p.hM);
  const w = Math.max(3, hsl.focus / 2 + 1);
  const B = hslBeam(); return a.rng < (B ? B.reach : HSL.reach) * 1.3 && Math.abs(normAS(a.az - hsl.az)) < w && Math.abs(a.el - hsl.el) < w;
}
// 탐조등 · 착륙등 빛 무리 — EO/IR 영상 위(영상 필터 밖: 밤에 어둡게 깎인 영상 위로 빛난 자리가 밝게 보인다)
//   주간 · 저광 카메라(EOW · EON)에 보인다. 열상(IR)은 가시광을 보지 못한다(IR 탐조등은 EON 저광에만).
//   빛 무리 크기는 거리에 맞춰(초점거리 px ÷ 거리) · 내려다보는 각만큼 납작한 타원
function eoBeamSpots() {
  if (!_eoMap || !eo.pwr || eo.mode === 'STOW' || eo.sensor === 'IR') return [];
  const out = [], losB = normA(S.hdg + eo.az), fov = eoFov();
  let bs = []; try { bs = typeof envBeams === 'function' ? envBeams() : []; } catch (e) { _swallow(e); }
  // IR 탐조등(맨눈 · NVG 없으면 envBeams 에 없다) — 저광(EON LL)은 근적외선을 본다
  if (hsl.lit && hsl.ir && eo.sensor === 'EON' && eo.ll && typeof env !== 'undefined' && !env.nvg) {
    const sv = env.nvg; env.nvg = true;
    try { bs = bs.concat(envBeams().filter(b => b.src)); } catch (e) { _swallow(e); } finally { env.nvg = sv; }
  }
  for (const b of bs) {
    const hM = _mGndFt(b.lat, b.lon) * 0.3048, a = eoAngTo(b.lat, b.lon, hM);
    if (Math.abs(normAS(a.brg - losB)) > fov * 0.75 + 2 || Math.abs(a.el - eo.el) > fov * 0.75 + 2) continue;   // 화면 밖(뒤에 있으면 project 가 엉뚱한 자리를 준다)
    out.push({ lat: b.lat, lon: b.lon, r: b.r, k: b.k, rng: a.rng, dn: Math.max(0.05, Math.sin(Math.max(1, -a.el) * _mD)) });
  }
  return out;
}
let _eoLitCv = null;
function _eoBeamsG(g, W, H) {
  const spots = eoBeamSpots(); if (!spots.length) return;
  const tod = (typeof env !== 'undefined' && env.tod) || 'DAY', ll = eo.sensor === 'EON' && eo.ll;
  let a0 = tod === 'NIGHT' ? 0.9 : tod === 'DUSK' ? 0.6 : 0.18;
  if (eo.filt === 'ND') a0 *= 0.6;
  const fx = (W / 2) / Math.tan(eoFov() / 2 * _mD), col = ll ? '255,255,255' : '255,246,222';
  const mc = _eoMap.getCanvas();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const sp of spots) {
    let pt; try { pt = _eoMap.project([sp.lon, sp.lat]); } catch (e) { continue; }
    if (!pt || !Number.isFinite(pt.x) || pt.x < -W || pt.x > 2 * W || pt.y < -H || pt.y > 2 * H) continue;
    const rp = _mClamp(fx * sp.r / Math.max(1, sp.rng), 4, Math.max(W, H) * 1.5), al = Math.min(1, a0 * Math.min(1.6, sp.k / 1.4));
    // 비친 자리의 땅 · 바다가 낮처럼 보이게 — 영상(필터 전)을 그 타원에만 부드럽게 덧그린다
    if (mc && mc.width && tod !== 'DAY') {
      const bw = Math.ceil(rp * 2), bh = Math.max(2, Math.ceil(rp * 2 * sp.dn)), x0 = pt.x - rp, y0 = pt.y - rp * sp.dn;
      if (!_eoLitCv) _eoLitCv = document.createElement('canvas');
      const oc = _eoLitCv; if (oc.width < bw) oc.width = bw; if (oc.height < bh) oc.height = bh;
      const q = oc.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, oc.width, oc.height);
      try { q.filter = ll ? 'grayscale(1) brightness(1.15)' : 'brightness(1.05) sepia(0.15)'; } catch (e) { _swallow(e); }
      try { q.drawImage(mc, x0 * mc.width / W, y0 * mc.height / H, bw * mc.width / W, bh * mc.height / H, 0, 0, bw, bh); } catch (e) { _swallow(e); }
      try { q.filter = 'none'; } catch (e) { _swallow(e); }
      q.globalCompositeOperation = 'destination-in';
      q.save(); q.translate(bw / 2, bh / 2); q.scale(1, sp.dn);
      const m = q.createRadialGradient(0, 0, 0, 0, 0, rp); m.addColorStop(0, `rgba(0,0,0,${Math.min(1, al * 1.1).toFixed(3)})`); m.addColorStop(0.6, `rgba(0,0,0,${(al * 0.7).toFixed(3)})`); m.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = m; q.beginPath(); q.arc(0, 0, rp, 0, 2 * Math.PI); q.fill(); q.restore();
      g.save(); g.globalCompositeOperation = 'source-over'; g.drawImage(oc, 0, 0, bw, bh, x0, y0, bw, bh); g.restore();
    }
    g.save(); g.translate(pt.x, pt.y); g.scale(1, sp.dn);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rp);
    const ga = tod === 'DAY' ? al : al * 0.55; gr.addColorStop(0, `rgba(${col},${ga.toFixed(3)})`); gr.addColorStop(0.45, `rgba(${col},${(ga * 0.5).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rp, 0, 2 * Math.PI); g.fill(); g.restore();
  }
  g.restore();
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
  if (hsl.lit) T(`SRCH ${hsl.ir ? 'IR ' : ''} ${srch.mode === 'EO' ? 'SLAVE' : srch.mode}${srch.lim ? ' LIMIT' : ''}`, R, y0 + 92 * k, 'right', 12, srch.lim ? '#ffd23a' : '#f4f6f4');
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
  if (_eoMap && eo.pwr) {   // 빛 무리(영상 필터 밖)
    const el = _eoMap.getContainer(), cw = el.clientWidth || W, ch = el.clientHeight || H;
    g.setTransform(W / cw, 0, 0, H / ch, 0, 0); try { _eoBeamsG(g, cw, ch); } catch (e) { _swallow(e); } g.setTransform(1, 0, 0, 1, 0, 0);
  }
  _eoHudG(g, 0, 0, W, H, true);
}
// 레이더 화면
// 탐색레이더 화면 — 부채꼴(Sector · B-scope) · 240°(E-scan)는 가운데가 안테나
function _rdrGeo(W, H) {
  const top = 64, bot = 46;   // 위 — 채널 이름(CH2) 한 줄 + 머리 글 두 줄
  if (rdr.sector <= 120) { const half = rdr.sector / 2 * _mD, R = Math.max(40, Math.min(H - top - bot - 8, (W / 2 - 12) / Math.max(0.5, Math.sin(half)))); return { ox: W / 2, oy: H - bot - 4, R }; }
  const R = Math.max(40, Math.min(W / 2 - 14, (H - top - bot) / 2 - 4)); return { ox: W / 2, oy: top + (H - top - bot) / 2 + 4, R };
}
function _rdrDraw(cv) {
  const W = cv.width, H = cv.height; if (!(W > 0 && H > 0)) return;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
  _rdrPaint(g, W, H);
}
// 조종석 SYSTEM 창 Video(Channel RADAR) · 3D 조종석 MFD — 그 칸(x, y, w, h)에 전탐석과 같은 탐색레이더 화면(18-system.js 가 부른다)
function rdrDrawTo(g, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y);
  try { _rdrPaint(g, w, h); } finally { g.restore(); }
}
// 탐색레이더 화면 한 장 — (0,0)~(W,H) 에 그린다
function _rdrPaint(g, W, H) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const k = _mClamp(Math.min(W, H) / 420, 0.6, 2), C = '#3dff6a', A = '#ffc400', G = _rdrGeo(W, H), { ox, oy, R } = G;
  const half = rdr.sector / 2, P = (rel, nm) => [ox + Math.sin(rel * _mD) * R * nm / rdr.rng, oy - Math.cos(rel * _mD) * R * nm / rdr.rng];
  const sectorPath = () => { g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, (-90 - half) * _mD, (-90 + half) * _mD); g.closePath(); };
  // 바탕 · 지형(TWS) · 레이더 잔상
  g.save(); sectorPath(); g.clip();
  if (!rdr.ronly && rdr.tws) { g.fillStyle = '#0a1430'; g.fill(); _rdrTws(g, ox, oy, R); }
  if (rdr.tx && rdr.pcv) { const N = rdr.pcv.width, s2 = R / (N / 2 - 2); g.drawImage(rdr.pcv, ox - N / 2 * s2, oy - N / 2 * s2, N * s2, N * s2); }
  g.restore();
  // 거리 호 · 방위 살
  g.strokeStyle = 'rgba(61,255,106,0.5)'; g.lineWidth = 1; g.font = `bold ${Math.round(11 * k)}px monospace`; g.fillStyle = C; g.textAlign = 'left';
  for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(ox, oy, R * i / 3, (-90 - half) * _mD, (-90 + half) * _mD); g.stroke(); const [lx, ly] = P(Math.min(half, 45) - 6, rdr.rng * i / 3); g.fillText(`${+(rdr.rng * i / 3).toFixed(1)}`, lx + 3, ly); }
  for (let a = -Math.floor(half / 30) * 30; a <= half; a += 30) { const [x, y] = P(a, rdr.rng); g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); g.textAlign = 'center'; g.fillText(fmtA(S.hdg + a), ox + Math.sin(a * _mD) * (R + 11 * k), oy - Math.cos(a * _mD) * (R + 11 * k) + 4 * k); }
  // 스캔선
  if (rdr.tx && !rdr.frz) { const [x, y] = P(rdr.az, rdr.rng); g.strokeStyle = 'rgba(140,255,170,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); }
  // EO/IR 시선 · 서치라이트
  if (eo.pwr && eo.mode !== 'STOW' && Math.abs(eo.az) <= half) { const [x, y] = P(eo.az, rdr.rng); g.strokeStyle = 'rgba(80,220,255,0.85)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); g.setLineDash([]); }
  if (hsl.lit && Math.abs(hsl.az) <= half) { const [x, y] = P(hsl.az, rdr.rng * 0.4); g.strokeStyle = 'rgba(255,220,80,0.8)'; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); }
  // SART 응답 — 바깥쪽으로 점 12개(0.64NM)
  const sr = rdrSartReply();
  if (sr) { const rel = normAS(sr.brg - S.hdg); if (Math.abs(rel) <= half) { g.strokeStyle = '#5ef'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { const nm = sr.nm + i * 0.64; if (nm > rdr.rng) break; const [x, y] = P(rel, nm); g.beginPath(); g.arc(x, y, 3.5 * k, 0, 2 * Math.PI); g.stroke(); } const [x, y] = P(rel, sr.nm); g.fillStyle = '#5ef'; g.textAlign = 'left'; g.fillText('SART', x + 8 * k, y - 6 * k); } }
  // 추적 표적(TRK) — 상자 · 번호 · 침로 막대
  const now = performance.now();
  for (const [id, no] of Object.entries(rdr.trkNo)) {
    const p = rdr.paint[id]; if (!p || p.nm > rdr.rng) continue;
    const rel = normAS(p.brg - S.hdg); if (Math.abs(rel) > half) continue;
    const [x, y] = P(rel, p.nm), s2 = 8 * k, sel = id === rdr.tgt;
    g.strokeStyle = sel ? A : '#ff5050'; g.lineWidth = 2; g.strokeRect(x - s2, y - s2, 2 * s2, 2 * s2);
    const T = rdr.trk[id];
    if (T && T.spd > 1) { const [la, lo] = destPoint(...destPoint(S.lat, S.lon, p.brg, p.nm), T.cse, T.spd / 60 * 3); const [x2, y2] = P(normAS(bearing(S.lat, S.lon, la, lo) - S.hdg), distance(S.lat, S.lon, la, lo)); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); }
    if (rdr.tails && T && T.tail) { g.fillStyle = sel ? A : '#ff7070'; for (const q of T.tail) { const rq = normAS(bearing(S.lat, S.lon, q.lat, q.lon) - S.hdg), nq = distance(S.lat, S.lon, q.lat, q.lon); if (Math.abs(rq) > half || nq > rdr.rng) continue; const [tx, ty] = P(rq, nq); g.beginPath(); g.arc(tx, ty, 1.8 * k, 0, 2 * Math.PI); g.fill(); } }   // CONTACT TAILS
    if (rdr.lblAll || sel) { g.fillStyle = sel ? A : '#ff7070'; g.textAlign = 'left'; g.fillText(`TRK${String(no).padStart(2, '0')}`, x + s2 + 2, y - s2); }   // SEARCH > ALL 꺼지면 고른 표적만 번호
  }
  // 커서
  { const [x, y] = P(rdr.cur.az, rdr.cur.nm); g.strokeStyle = A; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 12 * k, y); g.lineTo(x + 12 * k, y); g.moveTo(x, y - 12 * k); g.lineTo(x, y + 12 * k); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 15 * k, 0, 2 * Math.PI); g.stroke(); }
  // ISAR — 추적 표적 영상
  if (rdr.mode === 'ISAR' && rdr.tx) _rdrIsar(g, W, k);
  // 위 · 아래 글자
  const T2 = (s3, x, y, col = C, al = 'left', n = 12) => { g.font = `bold ${Math.round(n * k)}px monospace`; g.textAlign = al; g.fillStyle = col; g.fillText(s3, x, y); };
  const trk = Number.isFinite(S.trk) ? S.trk : S.hdg;
  const h1 = `Hdg ${fmtA(S.hdg)}°  Trk ${fmtA(trk)}°  SRV RDR CMD `; T2(h1, 8 * k, 38 * k); T2(rdr.cmd, 8 * k + g.measureText(h1).width, 38 * k, rdr.cmd === 'CKPT' ? A : C);
  T2(`${rdr.mode}  RNG ${rdr.rng}NM  Tilt ${rdr.tilt > 0 ? '+' : ''}${rdr.tilt.toFixed(1)}°  Gain ${rdr.gain}  SCN ${rdr.sector}°`, 8 * k, 54 * k);
  const fl = []; if (rdr.frz) fl.push(['FREEZE', '#ff5050']); if (rdr.ronly) fl.push(['R ONLY', '#5ef']); if (rdr.wxr) fl.push(['WXR', C]); if (!rdr.tws) fl.push(['TWS OFF', '#888']);
  try { if (typeof instFail !== 'undefined') { if (instFail.alt !== null) fl.push(['NO ALT', A]); if (instFail.hdg) fl.push(['NO HDG', A]); } } catch (e) { _swallow(e); }
  T2(!rdr.pwr ? 'RDR OFF' : rdr.warm > 0 ? `RDR WARM ${Math.ceil(rdr.warm)}` : rdr.tx ? 'RDR TX' : 'RDR STBY', W - 8 * k, 18 * k, rdr.tx ? C : A, 'right', 13);
  T2(fl.map(f => f[0]).join('  '), W - 8 * k, 38 * k, fl.length ? fl[0][1] : C, 'right');
  let ra = 0; try { ra = radarAltFt(); } catch (e) { ra = 0; }
  const [cl, cn] = destPoint(S.lat, S.lon, normA(rdr.cur.az + S.hdg), rdr.cur.nm), dm = (v, h) => { const a = Math.abs(v), d = Math.floor(a); return `${h}${d}°${((a - d) * 60).toFixed(2).padStart(5, '0')}'`; };
  T2(`Alt ${Math.round(S.alt)}ft  RAlt ${Math.round(ra)}ft  GS ${Math.round(S.spd)}kt  ${dm(S.lat, S.lat >= 0 ? 'N' : 'S')} ${dm(S.lon, S.lon >= 0 ? 'E' : 'W')}`, 8 * k, H - 24 * k);
  T2(`CUR ${rdr.cur.nm.toFixed(1)}NM ${fmtA(rdr.cur.az + S.hdg)}°  ${dm(cl, cl >= 0 ? 'N' : 'S')} ${dm(cn, cn >= 0 ? 'E' : 'W')}`, 8 * k, H - 8 * k, A);
  if (!rdr.tx) T2(rdr.pwr ? (rdr.warm > 0 ? '예열 중 — 90초 뒤 TX' : 'STANDBY — TX 를 누르십시오') : '전원 꺼짐', W / 2, oy - R * 0.45, '#888', 'center', 13);
  // 메뉴(FNC · MAP)
  // 메뉴 — 화면 왼쪽 세로(x 10~155) · 하위 메뉴는 그 오른쪽 상자(FLM 5.20 표 2 · 표 4)
  if (rdr.menu) {
    const M = RDR_MENU[rdr.menu], row = 19 * k, mx = 10 * k, mw = 145 * k, my = 66 * k, mh = M.length * row + 26 * k;
    g.fillStyle = 'rgba(0,18,8,0.92)'; g.fillRect(mx, my, mw, mh); g.strokeStyle = C; g.lineWidth = 1; g.strokeRect(mx, my, mw, mh);
    T2(rdr.menu === 'FNC' ? 'RDR MENU' : 'MAP', mx + mw / 2, my + 15 * k, C, 'center', 12);
    M.forEach((m, i) => {
      const y = my + 22 * k + (i + 0.75) * row, sel = i === rdr.menuI;
      if (sel) { g.fillStyle = rdr.sub === i ? 'rgba(255,210,60,0.22)' : 'rgba(61,255,106,0.25)'; g.fillRect(mx + 3, y - 13 * k, mw - 6, row - 2); }
      T2(m.n + (m.sub ? ' ▷' : ''), mx + 7 * k, y, C, 'left', 11);
      const v = String(m.v()); if (v) T2(v, mx + mw - 6 * k, y, sel ? A : C, 'right', 11);
    });
    if (rdr.sub !== null && M[rdr.sub] && M[rdr.sub].sub) {
      const L = M[rdr.sub].sub, sx = mx + mw + 5 * k, sw = 160 * k, sh = L.length * row + 24 * k;
      let sy = my + 22 * k + rdr.sub * row - 4 * k; sy = Math.max(my, Math.min(sy, H - 40 * k - sh));
      g.fillStyle = 'rgba(0,18,8,0.95)'; g.fillRect(sx, sy, sw, sh); g.strokeStyle = A; g.strokeRect(sx, sy, sw, sh);
      T2(M[rdr.sub].n, sx + sw / 2, sy + 14 * k, A, 'center', 11);
      L.forEach((m, i) => {
        const y = sy + 20 * k + (i + 0.75) * row, sel = i === rdr.subI;
        if (sel) { g.fillStyle = 'rgba(61,255,106,0.25)'; g.fillRect(sx + 3, y - 13 * k, sw - 6, row - 2); }
        T2(`${i + 1} ${m.n}`, sx + 7 * k, y, C, 'left', 11);
        const v = String(m.v()); if (v) T2(v, sx + sw - 6 * k, y, sel ? A : C, 'right', 11);
      });
    }
  }
  if (rdr.info && performance.now() - rdr.infoT < 8000) T2(rdr.info, W / 2, H - 42 * k, A, 'center', 12);   // MAINT · TRACK 결과 한 줄(8초)
}
// TWS — 지형 겹(육지를 어두운 녹색으로) · 2초마다 다시 셈
function _rdrTws(g, ox, oy, R) {
  const key = `${rdr.rng}|${Math.round(S.hdg)}|${S.lat.toFixed(3)}|${S.lon.toFixed(3)}|${rdr.sector}`, now = performance.now();
  if (!rdr.twsC || (rdr.twsK !== key && now - rdr.twsT > 2000)) {
    const N = 200, cv = rdr.twsC || document.createElement('canvas'); cv.width = cv.height = N; const q = cv.getContext('2d'); q.clearRect(0, 0, N, N);
    q.fillStyle = 'rgba(70,95,55,0.75)'; const c = N / 2, Rr = N / 2 - 2, half = rdr.sector / 2;
    for (let a = -half; a <= half; a += 3) for (let b = 1; b <= 30; b++) { const nm = rdr.rng * b / 30, [la, lo] = destPoint(S.lat, S.lon, normA(a + S.hdg), nm); if (!_mWater(la, lo)) { const r = Rr * b / 30; q.fillRect(c + Math.sin(a * _mD) * r - 3, c - Math.cos(a * _mD) * r - 3, 6, 6); } }
    rdr.twsC = cv; rdr.twsK = key; rdr.twsT = now;
  }
  const N = rdr.twsC.width, s2 = R / (N / 2 - 2); g.drawImage(rdr.twsC, ox - N / 2 * s2, oy - N / 2 * s2, N * s2, N * s2);
}
// ISAR — 지정 표적의 옆모습(길이 · 도플러 줄)
function _rdrIsar(g, W, k) {
  const c = rdr.tgt && msnContacts().find(x => x.id === rdr.tgt);
  const w = 170 * k, h = 96 * k, x = W - w - 8 * k, y = 62 * k;
  g.fillStyle = 'rgba(0,10,0,0.9)'; g.fillRect(x, y, w, h); g.strokeStyle = '#3dff6a'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
  g.fillStyle = '#3dff6a'; g.font = `bold ${Math.round(11 * k)}px monospace`; g.textAlign = 'left';
  if (!c) { g.fillText('ISAR — 표적을 추적하십시오', x + 6 * k, y + 16 * k); return; }
  g.fillText(`ISAR TRK${String(rdr.trkNo[c.id] || 0).padStart(2, '0')}  ${Math.round(c.len)}M`, x + 6 * k, y + 15 * k);
  const L = Math.min(w - 20 * k, (w - 20 * k) * c.len / 130 + 20 * k), cx = x + w / 2, cy = y + h * 0.66, t = performance.now() / 300;
  for (let i = 0; i < 26; i++) { const px = cx - L / 2 + L * i / 25, hh = (c.kind === 'vsl' || c.kind === 'ship') ? (i > 8 && i < 16 ? 22 : 9) * k : 6 * k; g.fillStyle = `rgba(120,255,140,${(0.4 + 0.5 * Math.abs(Math.sin(t + i))).toFixed(2)})`; g.fillRect(px, cy - hh, Math.max(1.5, L / 30), hh); }
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
  try { _msnScrPwr(); } catch (e) { _swallow(e); }
  if (!_msnEl) return;
  const set = (a, on) => { const b = _msnEl.querySelector(`[data-mact="${a}"]`); if (b) b.classList.toggle('on', !!on); };
  set('fly', S.running); const fb = _msnEl.querySelector('[data-mact="fly"]'); if (fb) fb.textContent = S.running ? '❚❚ 멈춤' : '▶ 비행';
  set('rtx', rdr.tx); set('rfrz', rdr.frz); set('ronly', rdr.ronly); set('rcmd', rdr.cmd !== 'CKPT');
  const lb = (a, t) => { const b = _msnEl.querySelector(`[data-mact="${a}"]`); if (b) b.textContent = t; };
  lb('rmode', `MODE ${rdr.mode}`); lb('rcmd', `CMD ${rdr.cmd}`); lb('rsec', `SCAN ${rdr.sector}°`); lb('rtx', rdr.tx ? 'TX' : rdr.warm > 0 ? `WARM ${Math.ceil(rdr.warm)}` : 'STBY');
  const sOn = hsl.lit;
  set('slon', sOn); set('slman', srch.mode === 'MAN'); set('sleo', srch.mode === 'EO'); set('slrdr', srch.mode === 'RDR');
  const ac = _msnEl.querySelector('[data-m="ac"]'); if (ac) ac.textContent = `HDG ${fmtA(S.hdg)}  ALT ${Math.round(S.alt)}FT  GS ${Math.round(S.spd)}KT`;
  // 다른 기기의 Vendor — 조종석 기기와의 연결(받은 지 얼마 · 왕복 시간). 끊기면 화면이 멈춘 채 보이므로 빨갛게 깜박인다
  const lk = _msnEl.querySelector('[data-m="link"]');
  if (lk && MSN_REMOTE && typeof iosLinkState === 'function') {
    const L = iosLinkState(), sec = L.age === null ? 0 : Math.round(L.age / 1000);
    const t = L.st === 'wait' ? '○ 조종석 기다림' : L.st === 'lost' ? `● 연결 끊김 ${sec}초` : L.st === 'slow' ? `● 응답 늦음 ${sec}초` : `● 조종석 연결 ${L.rtt === null ? '' : L.rtt + 'ms'}`;
    lk.style.display = 'inline-block'; lk.className = 'msn-link ' + L.st; if (lk.textContent !== t) lk.textContent = t;
    lk.title = '조종석 기기와의 연결 — 왕복 시간 · 마지막으로 상태를 받은 뒤 지난 시간(끊기면 화면은 마지막 상태로 멈춘다)';
  }
  const td = _msnEl.querySelector('[data-m="tdata"]');
  if (td) {
    const c = rdr.tgt && msnContacts().find(x => x.id === rdr.tgt), T = rdr.tgt && rdr.trk[rdr.tgt];
    td.textContent = c ? `TGT ${c.id} (${c.name})\nRNG ${distance(S.lat, S.lon, c.lat, c.lon).toFixed(2)}NM  BRG ${fmtA(bearing(S.lat, S.lon, c.lat, c.lon))}°` +
      (T && T.spd != null ? `\nCSE ${fmtA(T.cse || 0)}°  SPD ${T.spd.toFixed(1)}KT` : '\nCSE ---  SPD ---') : (rdr.tx ? '표적을 누르면 지정합니다' : '');
  }
  slcRender(); dvrRender();
  _msnEl.querySelectorAll('[data-dk]').forEach(b => { const k = b.dataset.dk; b.classList.toggle('on', (k === 'multi' && disp.lay === 'quad') || (k === 'split' && disp.lay === 'split') || (k === 'pip' && eo.pip !== 'OFF') || (k === 'pwr' && disp.pwr) || (k === 'navi' && disp.lay === 'one' && disp.ch === 4) || (k === 'v' + disp.ch && disp.lay === 'one')); });
  _clnLeds(_msnEl);
  const sd = _msnEl.querySelector('[data-m="sdata"]');
  if (sd) {
    const lamp = !hsl.pwr ? 'PWR OFF' : hsl.lit ? `LAMP ${hsl.ir ? 'IR' : 'VIS'}` : hsl.lamp ? `IGN ${Math.ceil(hsl.ign)}s` : hsl.cool > 0 ? `FAN ${Math.floor(hsl.cool / 60)}:${String(Math.floor(hsl.cool % 60)).padStart(2, '0')}` : 'OFF';
    const pos = hsl.mv ? `${hsl.mv.to} ${Math.ceil(hsl.mv.t)}s` : hsl.stowed ? 'STOWED' : srch.mode === 'EO' ? 'AUTO(SLASS)' : srch.mode === 'RDR' ? 'RDR SLAVE' : 'MAN';
    sd.textContent = `${lamp}  ${pos}${srch.lim ? '  LIMIT' : ''}\nAZ ${hsl.az >= 0 ? '+' : ''}${hsl.az.toFixed(0)}°  EL ${hsl.el.toFixed(0)}°  BEAM ${hsl.focus.toFixed(1)}°${hsl.haz ? '\n⚠ 10ft THERMAL HAZARD' : ''}`;
    sd.style.color = hsl.haz ? '#ff6060' : '';
  }
}
function _msnFit(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(r.width * d), h = Math.round(r.height * d); if (w > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; } return { W: w, H: h }; }
// ── NAVI 지도 칸(왼쪽 위) — 위성 지도 · 기체(원 안의 헬기 · 기수) · 비행계획 · 항적선 · 레이더 표적 · EO/IR 시선 · 커서 ──
let _nvMap = null;
function _nvEnsure(el) {
  if (_nvMap || typeof maplibregl === 'undefined' || !(el.clientWidth > 20 && el.clientHeight > 20)) return _nvMap;
  try {
    _nvMap = new maplibregl.Map({ container: el, style: _map3dStyle(), center: [S.lon, S.lat], zoom: 11, pitch: 0, bearing: 0, interactive: false, attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },   // 녹화기 CH4 가 옮겨 담을 수 있게
      pixelRatio: (typeof map3dPixelRatio === 'function') ? map3dPixelRatio(true) : 1 });
    _nvMap.on('error', e => console.warn('[NAVI]', e && e.error ? e.error.message : e));
    try { if (typeof mapGlGuard === 'function') mapGlGuard(_nvMap, '전탐석 지도', m => { if (_nvMap === m) _nvDrop(); }); } catch (e) { _swallow(e); }
  } catch (e) { console.warn('[NAVI] map failed:', e); _nvMap = null; }
  return _nvMap;
}
function _nvDrop() { try { if (_nvMap) _nvMap.remove(); } catch (e) { _swallow(e); } _nvMap = null; }
function _nvRender(cell) {
  const el = cell.querySelector('.nv-map'), ov = cell.querySelector('.nv-ov');
  const map = _nvEnsure(el); if (!map) return;
  const W = el.clientWidth, H = el.clientHeight;
  // 기수가 위 · 기체는 아래쪽(앞을 넓게) — 커서로 가운데를 옮겼으면 그 자리 · 북쪽 위
  const hdgUp = !nv.ctr, mpp = nv.nm * 1852 * 2 / Math.max(50, W);
  const z = Math.log2(40075016.686 * Math.cos(S.lat * _mD) / (512 * mpp));
  let c = nv.ctr; if (!c) { const [la, lo] = destPoint(S.lat, S.lon, S.hdg, nv.nm * 0.45 * H / W); c = { lat: la, lon: lo }; }
  try { _mJump(map, { center: [c.lon, c.lat], zoom: z, bearing: hdgUp ? S.hdg : 0, pitch: 0 }); } catch (e) { _swallow(e); }
  const d = _msnFit(ov), k = d.W / Math.max(1, W), g = ov.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, d.W, d.H); g.setTransform(k, 0, 0, k, 0, 0);
  const P = (lat, lon) => { try { return map.project([lon, lat]); } catch (e) { return null; } };
  // 비행계획(빨강) · 항적선(초록)
  try {
    const wps = (S.wps || []).filter(w => w && Number.isFinite(w.lat));
    if (wps.length > 1) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 1.5; g.beginPath(); wps.forEach((w, i) => { const q = P(w.lat, w.lon); if (q) i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); g.stroke(); }
  } catch (e) { _swallow(e); }
  const a = P(S.lat, S.lon);
  if (a) {
    const [fl, fo] = destPoint(S.lat, S.lon, S.hdg, nv.nm * 3), f = P(fl, fo);
    if (f) { g.strokeStyle = '#3dff6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(f.x, f.y); g.stroke(); }
    // EO/IR 시선(하늘색 점선) · 서치라이트(노랑)
    if (eo.pwr && eo.mode !== 'STOW') { const [la, lo] = destPoint(S.lat, S.lon, normA(S.hdg + eo.az), nv.nm * 2), q = P(la, lo), pt = eoAimPoint(); if (q) { g.setLineDash([5, 4]); g.strokeStyle = 'rgba(120,230,255,0.9)'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke(); g.setLineDash([]); } if (pt) { const r = P(pt.lat, pt.lon); if (r) { g.strokeStyle = '#7df'; g.beginPath(); g.arc(r.x, r.y, 6, 0, 2 * Math.PI); g.stroke(); } } }
    if (hsl.lit) { const [la, lo] = destPoint(S.lat, S.lon, normA(S.hdg + hsl.az), nv.nm * 0.6), q = P(la, lo); if (q) { g.strokeStyle = 'rgba(255,220,80,0.85)'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke(); } }
    // 기체 — 원 안의 헬기 · 위에 기수
    const rot = (hdgUp ? 0 : S.hdg) * _mD;
    g.save(); g.translate(a.x, a.y);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 18, 0, 2 * Math.PI); g.stroke();
    g.rotate(rot); g.beginPath(); g.moveTo(-14, -9); g.lineTo(14, 9); g.moveTo(14, -9); g.lineTo(-14, 9); g.moveTo(0, -8); g.lineTo(0, 14); g.stroke();
    g.restore();
    g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
    g.strokeText(fmtA(S.hdg), a.x, a.y - 26); g.fillText(fmtA(S.hdg), a.x, a.y - 26);
  }
  // 레이더 표적(WXR 이 켜져 있으면 레이더가 그린 것 · 아니면 지정 표적만)
  const now = performance.now();
  for (const c2 of msnContacts()) {
    const pnt = rdr.paint[c2.id], painted = pnt && now - pnt.t < RDR_RPM_S * 1500;
    if (!(rdr.tx && painted) && c2.id !== rdr.tgt) continue;
    const q = P(c2.lat, c2.lon); if (!q) continue;
    g.fillStyle = c2.kind === 'air' ? '#9ff' : '#ffef6a'; g.beginPath(); g.moveTo(q.x, q.y - 6); g.lineTo(q.x + 6, q.y); g.lineTo(q.x, q.y + 6); g.lineTo(q.x - 6, q.y); g.fill();
    if (c2.id === rdr.tgt) { g.strokeStyle = '#ffc400'; g.lineWidth = 2; g.strokeRect(q.x - 10, q.y - 10, 20, 20); g.fillStyle = '#ffc400'; g.font = 'bold 11px Arial'; g.textAlign = 'left'; g.fillText(c2.id, q.x + 12, q.y - 8); }
  }
  // 커서
  if (nv.cur) { const q = P(nv.cur.lat, nv.cur.lon); if (q) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(q.x - 12, q.y); g.lineTo(q.x + 12, q.y); g.moveTo(q.x, q.y - 12); g.lineTo(q.x, q.y + 12); g.stroke(); } }
  // 위 — 좌표(초록) · 시각(노랑) · 아래 — 축척 · 레이어
  const dms = (v, h) => { const x = Math.abs(v), dd = Math.floor(x), mm = Math.floor((x - dd) * 60), ss = ((x - dd) * 60 - mm) * 60; return `${h}${dd}°${String(mm).padStart(2, '0')}'${ss.toFixed(3).padStart(6, '0')}"`; };
  const ref = nv.cur || { lat: S.lat, lon: S.lon }, t = new Date(), d2 = n => String(n).padStart(2, '0');
  g.textAlign = 'left'; g.font = 'bold 14px Arial'; g.lineWidth = 3; g.strokeStyle = '#000';
  const tx = (s2, x, y, col) => { g.strokeText(s2, x, y); g.fillStyle = col; g.fillText(s2, x, y); };
  tx('----- ----- -----', W * 0.22, 26, '#fff');
  tx(`${dms(ref.lat, ref.lat >= 0 ? 'N' : 'S')}, ${dms(ref.lon, ref.lon >= 0 ? 'E' : 'W')}`, W * 0.22, 46, '#3dff6a');
  g.textAlign = 'right'; tx(`${d2(t.getHours())}:${d2(t.getMinutes())}:${d2(t.getSeconds())}`, W - 10, 30, '#ffd23a');
  g.textAlign = 'left'; g.font = 'bold 11px Arial';
  tx(`${nv.nm * 2}NM  ${hdgUp ? 'HDG UP' : 'N UP'}`, 8, H - 8, '#cfe');
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// ── 호이스트 카메라 칸(오른쪽 위) — 24-sar.js HOIST CAM 을 옮겨 그린다 ──
let _hcWantT = -Infinity;
function msnHoistWant() { return performance.now() - _hcWantT < 3000; }
let _hcSeen = '', _hcCopyT = 0;
function _hcRender(cell) {
  const cv = cell.querySelector('.hc-cv'), d = _msnFit(cv); if (!(d.W > 0)) return;
  // 지도 · HUD 가 새로 그려졌을 때만 옮긴다 — 3D 지도 그림(WebGL)을 2D 캔버스로 옮기는 것이 무거워(초당 20번이면 CPU 를 크게 먹었다)
  const seq = typeof sarHoistCamSeq === 'function' && typeof sarHoistCamOn === 'function' && sarHoistCamOn() ? sarHoistCamSeq() : -1, key = `${seq}|${d.W}x${d.H}`;
  const now = performance.now();
  if (seq >= 0 && (key === _hcSeen || (key.split('|')[1] === _hcSeen.split('|')[1] && now - _hcCopyT < 100))) { _hcWantT = now; return; }   // 바뀌어도 초당 10번까지
  _hcSeen = key; _hcCopyT = now;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, d.W, d.H);
  if (typeof sarHoistCamDrawTo !== 'function') return;
  _hcWantT = performance.now();
  const s = Math.min(d.W / 640, d.H / 480);   // 다 보이게(글씨가 잘리지 않게)
  g.save(); g.beginPath(); g.rect(0, 0, d.W, d.H); g.clip();
  try { sarHoistCamDrawTo(g, (d.W - 640 * s) / 2, (d.H - 480 * s) / 2, 640 * s, 480 * s); } catch (e) { _swallow(e); }
  g.restore();
}
const _cellVis = c => c && c.style.display !== 'none' && c.clientWidth > 20 && c.clientHeight > 20;
function msnRender() {
  if (_eoNeed()) _eoCamera(); else if (_eoMap) _eoMapDrop();
  // 조종석 SYSTEM 창이 EO/IR 영상을 띄우고 있으면 자주 다시 그린다(평소 4번/초 → 10번/초)
  try {
    if (typeof sysPage !== 'undefined' && (sysPage === 'asys_video' || (typeof sysLayout !== 'undefined' && sysLayout === 'HALF' && (sysHalf.L === 'asys_video' || sysHalf.R === 'asys_video'))) && typeof videoCfg !== 'undefined' && videoCfg.ch === 'EO/IR' && (_msnFrame++ % 2 === 0)) {
      const w = document.getElementById('sysp-wrap'); if (w && !w.classList.contains('page-hidden') && w.clientWidth > 40) sysDraw();
    }
  } catch (e) { _swallow(e); }
  if (!msnOpen || !_msnEl) return;
  if (!msnScreenOn()) { if (performance.now() - _msnTickT > 300) { _msnTickT = performance.now(); msnRenderPanels(); } return; }   // 화면이 꺼져 있으면 그리지 않는다(DMM 전원 · 녹화기 POWER · M-PWR) — 조작기 · 표시등은 그린다
  const ceo = _msnEl.querySelector('.c-eo');
  if (_cellVis(ceo)) {
    if (_eoMap && _eoHost && !ceo.contains(_eoHost)) _eoHostPlace();
    const vid = ceo.querySelector('.eo-vid'), f = eo.pwr && eo.mode !== 'STOW' ? eoVideoFilter() : 'brightness(0)';
    if (vid.style.filter !== f) vid.style.filter = f;
    const spr = ceo.querySelector('.eo-spr'), s = _msnFit(spr); _eoSprites(spr, s.W, s.H);
    const hud = ceo.querySelector('.eo-hud'), h = _msnFit(hud); _eoHud(hud, h.W, h.H);
  } else if (_eoHost && ceo && ceo.contains(_eoHost)) _eoHostPlace();
  const crd = _msnEl.querySelector('.c-rdr'), rc = crd.querySelector('canvas'); _msnFit(rc);
  if (_cellVis(crd) || eo.pip === 'RDR') _rdrDraw(rc);
  const cmap = _msnEl.querySelector('.c-map'); if (_cellVis(cmap)) _nvRender(cmap); else if (_nvMap && !_cellVis(cmap)) _nvDrop();
  const chc = _msnEl.querySelector('.c-hoist'); if (_cellVis(chc)) _hcRender(chc);
  try { dvrPlayDraw(); } catch (e) { _swallow(e); }
  if (performance.now() - _msnTickT > 300) { _msnTickT = performance.now(); msnRenderPanels(); }
}
// 전탐석을 새 창으로(00-popout.js popoutElement) — 조종사는 이 창의 조종석, 전탐요원은 다른 모니터의 전탐석
function msnPopped() { return typeof popoutHas === 'function' && popoutHas('el-msn'); }
function msnPopout() {
  if (typeof popoutElement !== 'function') return false;
  if (msnPopped()) { popoutElement('msn'); return true; }   // 다시 누르면 이 창으로
  msnShow(true);
  const ok = popoutElement('msn', 'msn-root', '흰수리 전탐석', [1500, 900]);
  if (ok) { _mNote('전탐석 새 창'); setTimeout(() => { try { dispSet(); msnRenderPanels(); } catch (e) { _swallow(e); } }, 300); }
  return ok;
}
function msnShow(on) {
  if (!MSN_ON) return;
  const R = _msnBuild();
  msnOpen = on !== undefined ? !!on : !msnOpen;
  R.classList.toggle('on', msnOpen);
  if (!msnOpen) _nvDrop(); else dispSet();
  if (_eoMap) _eoHostPlace();                 // 지도를 전탐석 화면 ⇄ 화면 밖으로 옮긴다(조종석 SYSTEM 창이 계속 쓸 수 있게)
  msnRenderHcu(); msnRenderPanels();
}
// ── Vendor 창 — 창 위 탭 'Vendor'(07-sim.js applyPanels)가 고르면 전탐석(#msn-root)을 그 창(#msn-wrap)에 넣는다 ──
//   창이 보일 때만 연다(Cockpit Mode 처럼 분할 창이 숨으면 닫아 EO/IR 3D 지도를 쉬게) · 탭을 바꾸면 닫고 본 문서로 되돌린다
//   새 창(⧉)에 떠 있으면 그대로 둔다(새 창을 닫으면 이 창 자리로 돌아온다)
let _msnInPanel = false, _msnPanelWant = false;
function msnInPanel() { return _msnInPanel; }
function msnPanelSync(want) {
  if (!MSN_ON) return;
  if (want !== undefined) _msnPanelWant = !!want;
  const W = document.getElementById('msn-wrap'); if (!W) return;
  if (msnPopped()) return;
  const vis = _msnPanelWant && !W.classList.contains('page-hidden') && W.getClientRects().length > 0;
  const R = _msnEl || (vis ? _msnBuild() : null); if (!R) return;
  if (vis) {
    if (R.parentElement !== W) W.appendChild(R);
    R.classList.add('in-panel');
    if (!_msnInPanel || !msnOpen) { _msnInPanel = true; msnShow(true); }
    _msnPanelZoom();
  } else if (_msnInPanel) {
    _msnInPanel = false;
    R.classList.remove('in-panel');
    if (R.parentElement === W) { if (_msnPanelWant) R.classList.add('in-panel'); else document.body.appendChild(R); }   // 창은 그대로(숨었을 뿐)면 자리에 둔다
    msnShow(false);
  }
}
// 창이 숨거나 다시 보이는 것(Cockpit Mode · Simple 등)은 applyPanels 를 거치지 않을 수도 있어 가끔 다시 본다
if (MSN_ON) setInterval(() => { try { msnPanelSync(); _msnPanelZoom(); } catch (e) { _swallow(e); } }, 700);
// 좁은 창(1100px 아래)에서는 표시기를 위에 · 조작기를 아래에 쌓고, 조작기를 창 너비에 맞춰 줄인다(--msn-z)
function _msnPanelZoom() {
  const R = _msnEl; if (!R || !_msnInPanel) return;
  const w = R.clientWidth; if (!(w > 50)) return;
  const z = w < 1100 ? Math.max(0.4, Math.min(1, (w - 20) / MSN_CTL_W)).toFixed(3) : '1';
  if (R.style.getPropertyValue('--msn-z') !== z) R.style.setProperty('--msn-z', z);
}
const MSN_CTL_W = 820;   // 조작기 묶음(HCU · DVR · 탐조등 · 레이더)이 다 보이는 너비(px)
// 한 걸음(전탐석이 닫혀 있어도 — 선박 · 서치라이트 연동 · 터릿 · 레이더는 계속 돈다)
let _msnT = 0, _msnFrame = 0;
function msnStep() {
  const now = performance.now(), dt = _msnT ? Math.min(0.25, (now - _msnT) / 1000) : 0; _msnT = now;
  if (!dt) return;
  if (MSN_REMOTE) {   // 다른 기기의 Vendor — 계산은 조종석 기기가 하고(상태를 받는다) 여기서는 레이더 그림 · 화면만
    try { rdrStep(dt); } catch (e) { _swallow(e); }
    try { msnRender(); } catch (e) { _swallow(e); }
    return;
  }
  if (_msnRjT && now - _msnRjT > 1000) { eo.joy.x = eo.joy.y = 0; slc.joy.x = slc.joy.y = 0; _msnRjT = 0; }   // 다른 기기의 조이스틱 소식이 끊기면 가운데로
  const run = typeof S !== 'undefined' && S.running;
  try { if (run) _vslStep(dt * ((typeof simSpeed !== 'undefined' && Number(simSpeed)) || 1)); } catch (e) { _swallow(e); }
  try { eoStep(dt); } catch (e) { _swallow(e); }
  try { rdrStep(dt); } catch (e) { _swallow(e); }
  try { hslStep(dt); if (_slHold) srchMan(_slHold, dt); slcStep(dt); srchStep(dt); } catch (e) { _swallow(e); }
  try { if (typeof _kgHslSync === 'function') _kgHslSync(); } catch (e) { _swallow(e); }   // 컬렉티브 SRCH 표시
  try { if (MSN_ON) dvrStep(dt); } catch (e) { _swallow(e); }
  try { msnRender(); } catch (e) { _swallow(e); }
  try { vccpRender(); } catch (e) { _swallow(e); }
}
// ══ 레이더 메뉴 키보드(FLM 5.20) — Vendor 위에 마우스가 있을 때만: M 메뉴 · ↑↓ 고르기 · Enter 실행 · 1~9 하위 메뉴 · Esc 뒤로 ══
//   (마우스가 Vendor 밖이면 이 키들은 종전처럼 비행 조작에 쓰인다)
let _msnHover = false;
if (MSN_ON) {
  document.addEventListener('pointerover', e => { _msnHover = !!(_msnEl && e.target && _msnEl.contains(e.target)); }, true);
  document.addEventListener('keydown', e => {
    if (!_msnHover || !msnOpen || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    let k = null;
    if (e.key === 'm' || e.key === 'M') k = 'fnc';
    else if (rdr.menu) {
      if (e.key === 'ArrowUp') k = 'rot:-1'; else if (e.key === 'ArrowDown') k = 'rot:1';
      else if (e.key === 'Enter') k = 'push'; else if (e.key === 'Escape') k = 'esc';
      else if (/^[1-9]$/.test(e.key)) k = 'n' + e.key;
    }
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (k === 'push') { clnPress('push', true); clnPress('push', false); } else clnPress(k, true);
  }, true);
}
// ══ Vendor 를 다른 기기에서 — 교관 화면(?ios=1 · 같은 브라우저 · 다른 기기는 QR 연결)의 위 막대 Vendor ══
//   조종석 기기가 계산한다(EO/IR 터릿 · 레이더 · 탐조등 · 선박 · DVR) — 교관 화면은 그 상태를 받아(31-ios.js iosMirror → msnSyncApply) 그린다
//   교관 화면에서 누른 HCU · 탐조등 · 레이더 조작기 · 표시기 단추 · 조이스틱은 조종석 기기로 보내 그쪽에서 누른다(msnRemoteCmd)
//   그래서 조종사 SYSTEM 창 EO/IR 영상 · 3D 탐조등 빛과 다른 기기의 Vendor 가 늘 같다
const MSN_REMOTE = MSN_ON && typeof IOS_MODE !== 'undefined' && IOS_MODE;
const MSN_RCMD = ['hcuPress', 'slcPress', 'clnPress', 'dvrPress', 'dispKey', 'rdrPickRB', 'eoFocusBy', 'msnSpawn', 'msnVslClear', 'srchMode', 'rdrTrack', 'msnAct'];
const MSN_LOCAL_ACT = new Set(['help', 'close', 'popout', 'fly']);   // 이 기기에서만(화면 · 도움말) — 비행 시작/멈춤은 교관 화면의 단추로
let _msnRjT = 0;
// 보낼 상태 — 그림(캔버스) · 누르고 있는 단추 · 녹화 영상은 빼고 값만
function msnSyncState() {
  if (!MSN_ON) return null;
  const { pcv, ...r } = rdr, { down, ...sl } = slc;
  return { eo, rdr: r, hsl, srch, disp, slc: sl, nv, vsl: msnVsl,
    dvr: { pwr: dvr.pwr, boot: dvr.boot, rec: dvr.rec, play: dvr.play, ch: dvr.ch, menu: dvr.menu, menuI: dvr.menuI, view: dvr.view, pb: dvr.pb } };
}
// 받은 상태를 넣는다(교관 화면) — 조이스틱 객체(eo.joy · slc.joy)는 화면 스틱이 쥐고 있어 바꿔 끼우지 않는다
function msnSyncApply(o) {
  if (!MSN_ON || !o) return;
  const put = (t, v, keep = []) => { if (!v || typeof v !== 'object') return; const k0 = {}; keep.forEach(k => { k0[k] = t[k]; }); Object.assign(t, v); Object.assign(t, k0); };
  put(eo, o.eo, ['joy']); put(rdr, o.rdr, ['pcv']); put(hsl, o.hsl); put(srch, o.srch); put(slc, o.slc, ['joy', 'down']); put(nv, o.nv); put(dvr, o.dvr);
  if (o.disp) { const was = JSON.stringify(disp); Object.assign(disp, o.disp); if (JSON.stringify(disp) !== was) { try { dispSet(); } catch (e) { _swallow(e); } } }
  if (Array.isArray(o.vsl)) { msnVsl.length = 0; msnVsl.push(...o.vsl); }
}
// 조종석 기기 — 교관 화면이 보낸 조작(이름이 정해진 것만)
function msnRemoteCmd(m) {
  if (!MSN_ON || MSN_REMOTE || !m) return;
  if (m.f === '_joy') { const a = (m.a || []).map(v => _mClamp(+v || 0, -1, 1)); eo.joy.x = a[0]; eo.joy.y = a[1]; slc.joy.x = a[2]; slc.joy.y = a[3]; _msnRjT = performance.now(); return; }
  if (!MSN_RCMD.includes(m.f) || (m.f === 'msnAct' && MSN_LOCAL_ACT.has((m.a || [])[0]))) return;
  const fn = window[m.f]; if (typeof fn !== 'function') return;
  try { fn(...(Array.isArray(m.a) ? m.a.slice(0, 4) : [])); } catch (e) { _swallow(e); }
}
if (MSN_REMOTE) {
  // 조작은 조종석 기기로 — 이 기기의 같은 이름 함수를 '보내기'로 바꿔 낀다(화면 단추 · 조이스틱 배정이 모두 이 이름을 부른다)
  for (const f of MSN_RCMD) {
    const orig = window[f]; if (typeof orig !== 'function') continue;
    window[f] = function (...a) {
      if (f === 'msnAct' && MSN_LOCAL_ACT.has(a[0])) return orig.apply(this, a);
      try { iosCmd('msn', { f, a }); } catch (e) { _swallow(e); }
    };
  }
  // 조이스틱(화면 스틱 · 이 기기에 꽂은 장치) — 바뀌면 보낸다(움직이는 동안은 0.3초마다 다시)
  let _rjLast = '', _rjT = 0;
  setInterval(() => {
    const pj = _msnJoyAxes(), x = _mClamp(eo.joy.x + (pj ? pj.x : 0), -1, 1), y = _mClamp(eo.joy.y + (pj ? pj.y : 0), -1, 1);
    const a = [x, y, slc.joy.x, slc.joy.y].map(v => +v.toFixed(3)), k = a.join(','), moving = a.some(v => v !== 0), now = performance.now();
    if (k !== _rjLast || (moving && now - _rjT > 300)) { _rjLast = k; _rjT = now; try { iosCmd('msn', { f: '_joy', a }); } catch (e) { _swallow(e); } }
  }, 100);
}
// 흰수리(전탐석 · 조종석 모두)는 EO/IR 터릿이 돈다 — 조종석 SYSTEM 창 Video(EO/IR) 가 영상을 띄운다
if (EO_ON) setInterval(msnStep, 50);
if (MSN_ON) {
  // 🎯 Vendor — 3D 조종석 화면(Cockpit Mode · 분할 창이 숨는다)에서만 오른쪽 버튼 줄(#ctl3d) 맨 아래 — 전탐석을 화면 가득(조종석 보기 ⤴ 로 돌아온다)
  //   그 밖에서는 창 위 탭 'Vendor' 로 띄운다(분할 창 · Simple 위 막대)
  setInterval(() => {
    const b = document.getElementById('msn-open-btn'); if (!b) return;
    const ctl = document.getElementById('ctl3d'), inCtl = !!(ctl && ctl.offsetParent);
    if (inCtl) { if (ctl.lastElementChild !== b) ctl.appendChild(b); b.classList.add('sim-btn', 'in-ctl'); b.style.display = ''; }
    else { if (b.parentElement !== document.body) document.body.appendChild(b); b.classList.remove('sim-btn', 'in-ctl'); b.style.display = 'none'; }
    const t = msnPopped() ? '🎯 Vendor 창' : '🎯 Vendor'; if (b.textContent !== t) b.textContent = t;
  }, 500);
  try {
    const b = document.createElement('button'); b.id = 'msn-open-btn'; b.type = 'button'; b.textContent = '🎯 Vendor'; b.style.display = 'none';
    b.addEventListener('click', () => {
      if (msnPopped() && popoutFocus('el-msn')) return;
      const R = _msnBuild(); _msnInPanel = false; R.classList.remove('in-panel'); if (R.parentElement !== document.body) document.body.appendChild(R);   // 숨은 창 안이면 화면 가득으로 꺼낸다
      msnShow(true);
    });
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
  try { if (typeof HELP_ITEMS !== 'undefined') HELP_ITEMS.push(['🎯 Vendor · 흰수리 전탐석', '흰수리면 창 위 탭(CDU · MAP · UPPER … 옆)에 Vendor 가 있다 — 누르면 그 창에 전탐석(EO/IR · SAR 레이더 · 서치라이트 · HCU 조작기 · DVR)이 뜬다. 다른 창에는 PFD · 3D 를 두고 나란히 보며 조종사와 전탐요원이 함께 훈련한다. 창 위 ⧉ POP UP 이나 전탐석 위 막대 ⧉ 새 창 으로 다른 모니터에 띄운다. Simple Mode 는 위 막대의 Vendor, Cockpit Mode 는 오른쪽 버튼 줄 맨 아래 🎯 Vendor(화면 가득 · 조종석 보기 ⤴ 로 돌아온다). 전탐석이 움직이는 EO/IR 영상은 조종석 SYSTEM 창 Video(Channel EO/IR)에도 나온다. 전탐석 위 막대 ❓ 에 조작법.']); } catch (e) { _swallow(e); }
}
try { appRegister({ msnShow, msnAct, msnSpawn, hcuPress, msnPanelSync }); } catch (e) { _swallow(e); }
