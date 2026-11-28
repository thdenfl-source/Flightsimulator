'use strict';
// ══════════════════════════════════════════════════════
// 37-mission.js — 흰수리 전탐석(전술 임무 조작석 · MISSION CONSOLE)
//   (나눈 조각: 37a-dvr.js 녹화기 · 37b-msnview.js 조작기 · 영상 · 지도 칸 · Vendor 창 — 이 파일 바로 뒤에 차례로 읽힌다)
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
const MSN_ON = typeof acIs === 'function' && (acIs('aw189') || acIs('cn235'));   // 흰수리 · CN-235 면 Vendor 창(전탐석 · CN-235 는 전술 임무 콘솔)이 있다
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
// AIS — 선박 자동식별(VHF) — 화물선은 늘 · 어선 70% · 소형선 40% · 고속단정 10% 만 켜고 있다.
//   AIS 가 없는데 레이더에 잡히는 배는 'NO AIS'(불법 조업 · 밀입국 의심 — 해상 단속 연습)로 따로 보인다.
//   요구조자는 AIS-SART(MMSI 970…)를 켜 둔 것으로 본다(레이더 SART 응답과 같은 자리) · 함정도 AIS 를 켠다
//   지도 겹(CH4 항법지도 · 2D 지도)과 레이더 표적 꼬리표 · 지정 표적 정보(TGT)에 같은 표적으로 나온다 — 받는 거리 AIS_NM
const AIS_P = { 화물선: 1, 어선: 0.7, 소형선: 0.4, 고속단정: 0.1 }, AIS_NM = 30;
const AIS_NAMES = ['HANRA', 'SAMHO', 'DONGBANG', 'GEUMSEONG', 'DAEHAN', 'BADA', 'HAEWOO', 'JEJU', 'SEONGJIN', 'MIRAE'];
const ais = { map: false };
function _aisMake(ty) {
  if (Math.random() >= (AIS_P[ty] ?? 0.5)) return null;
  return { mmsi: '440' + String(Math.floor(100000 + Math.random() * 899999)), name: `${AIS_NAMES[Math.floor(Math.random() * AIS_NAMES.length)]} ${1 + Math.floor(Math.random() * 309)}` };
}
// 2D 지도(leaflet) 겹 — 2초마다 새로 그린다
let _aisLayer = null;
function aisMapSync() {
  try {
    if (typeof L === 'undefined' || typeof leafMap === 'undefined') return;
    if (!ais.map) { if (_aisLayer) { leafMap.removeLayer(_aisLayer); _aisLayer = null; } return; }
    if (!_aisLayer) _aisLayer = L.layerGroup().addTo(leafMap);
    _aisLayer.clearLayers();
    for (const c of aisTargets()) {
      const col = c.ais.sart ? '#ff4040' : '#3dff7a';
      L.circleMarker([c.lat, c.lon], { radius: c.ais.sart ? 7 : 5, color: col, weight: 2, fillOpacity: 0.25 })
        .bindTooltip(`${aisLabel(c)}<br>MMSI ${c.ais.mmsi}${c.spd > 0.5 ? `<br>${fmtA(c.hdg || 0)}° ${c.spd.toFixed(0)}kt` : ''}`, { direction: 'right' }).addTo(_aisLayer);
    }
  } catch (e) { _swallow(e); }
}
setInterval(() => { if (ais.map) aisMapSync(); }, 2000);
// 지금 받는 AIS(거리 안) — 레이더와 같은 id 로
function aisTargets() {
  const out = [];
  for (const c of msnContacts()) {
    if (!c.ais) continue;
    const nm = distance(S.lat, S.lon, c.lat, c.lon); if (nm > AIS_NM) continue;
    out.push(Object.assign({ nm }, c));
  }
  return out;
}
function aisLabel(c) { return c && c.ais ? `${c.ais.sart ? 'AIS-SART' : 'AIS'} ${c.ais.name}` : 'NO AIS'; }
function msnSpawn(n = 6, opts = {}) {
  let made = 0;
  for (let i = 0; i < n * 12 && made < n; i++) {
    const brg = opts.brg != null ? opts.brg : Math.random() * 360, nm = opts.nm != null ? opts.nm : 2 + Math.random() * 10;
    const [la, lo] = destPoint(S.lat, S.lon, brg, nm);
    if (!opts.anywhere && !_mWater(la, lo)) continue;
    const ty = opts.type ? VSL_TYPES.find(v => v.t === opts.type) || VSL_TYPES[0] : VSL_TYPES[Math.floor(Math.random() * VSL_TYPES.length)];
    msnVsl.push({ id: 'V' + (++_vslSeq), name: ty.t, lat: la, lon: lo, hdg: opts.hdg != null ? opts.hdg : Math.random() * 360,
      spd: opts.spd != null ? opts.spd : ty.spd[0] + Math.random() * (ty.spd[1] - ty.spd[0]), len: ty.len, rcs: ty.rcs, turnT: 20 + Math.random() * 60,
      ais: opts.ais !== undefined ? opts.ais : _aisMake(ty.t) });
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
  for (const v of msnVsl) out.push({ id: v.id, kind: 'vsl', name: v.name, lat: v.lat, lon: v.lon, hM: 0, len: v.len, hdg: v.hdg, spd: v.spd, rcs: v.rcs, ais: v.ais || null });
  try { if (typeof shipVisible !== 'undefined' && shipVisible && shipLat !== null) out.push({ id: 'SHIP', kind: 'ship', name: '함정', lat: shipLat, lon: shipLon, hM: 0, len: 90, hdg: shipHdg, spd: shipSpd, rcs: 30, ais: { mmsi: '440300150', name: 'KCG 3015' } }); } catch (e) { _swallow(e); }
  try { if (typeof sar !== 'undefined' && sar.on && sar.lat !== null && sar.state !== 'aboard') out.push({ id: 'SURV', kind: 'surv', name: sar.type === 'water' ? '익수자' : '요구조자', lat: sar.lat, lon: sar.lon, hM: sar.type === 'water' ? 0 : _mGndFt(sar.lat, sar.lon) * 0.3048, len: 1.8, hdg: 0, spd: 0, rcs: 1, ais: { mmsi: '970010001', name: 'SART ACTIVE', sart: true } }); } catch (e) { _swallow(e); }
  try { if (typeof crewAssets !== 'undefined') for (const a of crewAssets) out.push({ id: a.id, kind: 'vsl', name: a.name, lat: a.lat, lon: a.lon, hM: 0, len: a.len, hdg: a.hdg, spd: a.v, rcs: a.rcs, ais: { mmsi: a.mmsi, name: a.cs } }); } catch (e) { _swallow(e); }   // 협동 구조 자산(40-crew.js)
  try { if (typeof traffic !== 'undefined') for (const t of traffic) out.push({ id: 'A' + t.id, kind: 'air', name: t.cs || (t.ac === 'b206' ? 'Bell 206' : '흰수리'), lat: t.lat, lon: t.lon, hM: (t.alt || 0) * 0.3048, len: 15, hdg: t.hdg, spd: t.spd, rcs: 8 }); } catch (e) { _swallow(e); }
  return out;
}
// ══ ② 탐색레이더 — Seaspray 5000E(Osprey) · VCCP 조작기 (KUH-1CG FLM 5.20 · SDS 34-47-01) ══
//   X 대역 9.45~10.00GHz · 최대 200NM · 표적 200개 자동 추적 · 전원 DC-ESS BUS 1(RADAR) · 다시 켜면 90초 예열
//   안테나: 회전하지 않는다 — 전방 180°(좌우 90°씩)로 동시에 전파를 내 그 안에 음영 구역이 없다(스캔선 없이 화면 전체가 한꺼번에 새로 그려진다)
//   화면: 처음 180°(반원) · SCN/BLK 로 120 · 60 · 20° 부채꼴만 볼 수도 있다
//   모드: LRS(장거리 해상 · 해면 클러터 억제 · FREEZE) · WX(강수 밀도 색) · PT(소형 표적 자동 추적) · SART(수색구조 트랜스폰더) · ISAR(표적 영상)
//   제어 권한(RDR > CMD): CKPT(조종실 · 처음) · CABIN(전탐석) · SHARED(함께) — CKPT 이면 전탐석 VCCP 는 CMD 말고는 듣지 않는다
//   화면: 위 Hdg · Trk · SRV RDR CMD · RNG · Tilt · Gain / 아래 Alt · RAlt · GS · 위경도 · 커서 거리 · 방위 / RDR TX · STBY · FREEZE · R ONLY · NO ALT · NO HDG · NO POS
const RDR_RNG = [10, 20, 50, 100, 200];
const RDR_MODES = ['PT', 'LRS', 'WX', 'TURB', 'SART', 'STM', 'MTI', 'ISAR'];   // FLM 5.20 표 4 — PT · LRS · WX · TURB · SART · STM(탐색 · 추적) · MTI(움직이는 표적) · ISAR
const RDR_CMD_NM = { CKPT: 'CKPT', CABIN: 'CABIN', SHARED: 'INTRLV' };   // RDR > CMD — INTRLV(번갈아 · 함께 쓰기)는 안에서 SHARED
const _rdrWx = () => rdr.mode === 'WX' || rdr.mode === 'TURB';
const RDR_CMDS = ['CKPT', 'CABIN', 'SHARED'];
const RDR_SECTORS = [180, 120, 60, 20];
const RDR_REFRESH_S = 0.5;                            // 전 방향 그림이 한 번 다 새로 그려지는 시간(초) — 회전 스캔이 아니라 화면 전체를 고르게 나눠 그린다
const RDR_WARM_S = 90;                                 // 다시 켠 뒤 예열(초)
const RDR_RPM_S = 1;                                   // 칠해진 표적이 살아 있는 시간(초)의 바탕 — 전 방향 동시 갱신이라 짧다
const rdr = { pwr: true, warm: 0, tx: false, mode: 'LRS', cmd: 'CKPT', rng: 20, tilt: 0, gain: 15, sector: 180, frz: false, ronly: false, wxr: false, tws: true,
  az: 0, dir: 1, cur: { az: 0, nm: 10 }, tgt: null, trkNo: {}, nTrk: 0, menu: null, menuI: 0, paint: {}, trk: {}, pcv: null, wx: null,
  sub: null, subI: 0, menuT: 0, agc: false, sts: false, tails: false, grey: false, link: false, flt: 'ALL', lblAll: true, ais: true, info: '', infoT: 0 };
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
  if (rdr.frz) return;                                 // FREEZE — 화면을 붙든다(그림 · 표적을 바꾸지 않는다)
  // 전 방향 동시 — 회전하는 스캔선이 없다: 보는 범위(±sector/2) 안의 표적을 매번 모두 갱신한다
  const half = rdr.sector / 2, lo = -half, hi = half;
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
  rdr.phase = ((rdr.phase || 0) + 1) % _RDR_STRIDE;
  _rdrPaintBeam(lo, hi - lo, dt, _RDR_STRIDE, rdr.phase);   // 화면 전체를 고르게 나눠(줄을 건너뛰며) 그린다 — 0.5초에 한 번 다 새로
}
// 잔상 캔버스 — 기수 기준(가운데가 안테나). 한 줄씩: 육지(TWS) · 해면 반사 · 강수 · 잡음 · 표적
const _RDR_STRIDE = 10;   // 한 걸음에 줄 1/10 씩(0.05초 × 10 = RDR_REFRESH_S)
function _rdrPaintBeam(a0, sweep, dt, stride = 1, phase = 0) {
  const N = 360;
  if (!rdr.pcv) { rdr.pcv = document.createElement('canvas'); rdr.pcv.width = rdr.pcv.height = N; }
  const g = rdr.pcv.getContext('2d'), c = N / 2, R = N / 2 - 2;
  g.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-dt / (rdr.sts ? 7 : 2.4))).toFixed(3)})`; g.fillRect(0, 0, N, N);   // STS(Scan-To-Scan) — 잔상을 오래
  const sea = (typeof env !== 'undefined' && env.sea) || 0, gk = rdr.gain / 30;
  const clutNm = rdr.mode === 'MTI' ? 0 : (0.3 + sea * 0.45) * (rdr.mode === 'LRS' ? 0.35 : 1) * Math.max(0.2, 1 - rdr.tilt / 30);   // MTI — 해면 반사 · 육지는 걸러 낸다
  const cells = (_rdrWx() || rdr.wxr) ? _rdrWxCells() : [];
  const steps = Math.max(1, Math.ceil(sweep / 1.0));   // 1° 마다 한 줄(바깥쪽에 줄무늬가 생기지 않게)
  for (let s = phase; s <= steps; s += stride) {
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
      if (v > 0) { g.fillStyle = `rgba(${col},${v.toFixed(2)})`; g.fillRect(c + sx * r - 1.9, c + sy * r - 1.9, 3.8, 3.8); }
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
    _rdrTog('AIS', 'ais'),                                                  // AIS 겹(초록 삼각형 · 이름) — 레이더 송신과 따로(AIS 수신기)
  ] },
  { n: 'TRACK', v: () => `${Object.keys(rdr.trkNo).length}`, sub: [
    { n: 'MK TRK', v: () => '', set: () => rdrCursorTrk() },
    { n: 'IN AREA', v: () => '', set: () => { const L = _rdrInArea(); L.forEach(id => rdrTrack(id, true)); _rdrInfo(`IN AREA — ${L.length}개 추적`); } },
    { n: 'EX AREA', v: () => '', set: () => { const L = _rdrInArea().filter(id => rdr.trkNo[id]); L.forEach(id => rdrTrack(id, false)); _rdrInfo(`EX AREA — ${L.length}개 풀기`); } },
    { n: 'DEL ALL', v: () => '', set: () => { rdr.trkNo = {}; rdr.tgt = null; _rdrInfo('DEL ALL — 추적 모두 지움'); } },
    { n: 'FILTER', v: () => rdr.flt, set: () => { rdr.flt = { ALL: 'SURF', SURF: 'AIR', AIR: 'ALL' }[rdr.flt]; } },
  ] },
  { n: 'SCN/BLK', v: () => `${rdr.sector}°`, sub: [
    { n: 'WIDE 180°', v: () => rdr.sector === 180 ? '●' : '', set: () => { rdr.sector = 180; rdrClearPicture(); } },   // 전방 180°(처음)
    { n: 'BLN 20°', v: () => rdr.sector === 20 ? '●' : '', set: () => { rdr.sector = 20; rdrClearPicture(); } },
    { n: 'BLN 60°', v: () => rdr.sector === 60 ? '●' : '', set: () => { rdr.sector = 60; rdrClearPicture(); } },
    { n: 'MAP OVERLAY', v: () => rdr.ronly ? 'OFF' : 'ON', set: () => { rdr.ronly = !rdr.ronly; } },
    { n: 'SEARCH', v: () => rdr.sector === 180 ? '●' : '', set: () => { rdr.sector = 180; rdrClearPicture(); } },   // 넓게 찾기 — 전방 180°
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
    <button data-mact="fly">▶ 비행</button><button data-mact="spawn">선박 표적 생성</button><button data-mact="clear">표적 지우기</button><button data-mact="ais" title="AIS 선박 · AIS-SART 를 2D 지도(지도 창)에도 겹친다 — CH4 항법지도에는 늘 보인다">AIS 지도</button>
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
