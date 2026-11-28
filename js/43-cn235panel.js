'use strict';
// ══════════════════════════════════════════════════════
// CN-235 조종석 — 해양경찰 CN235-110 비행교범(AOM) 그림의 배치를 따른다(42-cn235.js 가 비행 모델)
//   그림 1-1-8  LH 계기판 : 위 BETA MODE ×2 · STALL · WARNING · CAUTION · AHS · 대기 속도계 · HSI · AOA
//                           가운데 Universal PFD(속도 띠 · 자세 · 고도 띠 · 헤딩 · FMA) · TAWS · 대기 자세계 · 고도계 · 승강계
//   그림 1-1-8  가운데 계기판 : TORQUE · ITT · NP · NG · FF(좌우) · PROP OIL · ENG OIL · TRIM · AIR TEMP · FLAP ·
//                           EXT DOORS · Universal MFD(지도 · 비행계획 상태) · FLAPS · 착륙장치 등 · 레버
//   그림 1-1-9  글레어실드 : 경고 패널(A · E) · FEATHER SYS(B) · 오토파일럿 모드 선택(C) · AP 조종(D)
//   그림 1-1-10 페데스탈 : CONSTANT TORQUE · APR · 무전 · CDU · 파워 레버 · 컨디션 레버 · 플랩 레버 · 착륙장치 비상 ·
//                           EMER & PARK BR · GUST LOCK · RUDDER TRIM · EMER TRIMS · ANTISKID
//   그림 1-1-14 조종간 : AP(끊기) · GA(복행) · SYN · PTT · 승강타 트림 · 도움날개 트림 — 키 · 조이스틱 단추
// PFD 창(03-pfd.js)이 cnDraw 를 부른다 — 창이 넓으면 셋(글레어실드 위 · LH · 가운데)을 함께, 좁으면 하나씩(위 탭으로 고른다)
// ══════════════════════════════════════════════════════
const CNP_BG = '#97aab1', CNP_EDGE = '#6f8288', CNP_DARK = '#222528';
const CNP_SIZE = { LH: [1000, 640], CTR: [1000, 660], GLR: [2000, 260], ALL: [2000, 920] };
let cnPage = (() => { try { return localStorage.getItem('cnPage') || 'AUTO'; } catch (e) { return 'AUTO'; } })();
function cnPageSet(p) { cnPage = p; try { localStorage.setItem('cnPage', p); } catch (e) { _swallow(e); } _cnRedraw(); }

// ── 누를 자리(그림 좌표) — 그리면서 적고, 캔버스에 붙여 둔다 ──
let _cnHits = null, _cnOX = 0, _cnOY = 0;
function _cnHit(x, y, w, h, fn, drag) { if (_cnHits) _cnHits.push({ x: x + _cnOX, y: y + _cnOY, w, h, fn, drag, ox: _cnOX, oy: _cnOY }); }

// ── 그리기 도구 ──
function _cnT(g, s, x, y, size, col, bold = true, align = 'center') { _b206Text(g, s, x, y, size, col || '#fff', bold, align); }
function _cnScrew(g, x, y, r = 5) {
  g.save(); g.fillStyle = '#6b767c'; g.strokeStyle = '#3c4448'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = '#2b3135'; g.beginPath(); g.moveTo(x - r * 0.6, y); g.lineTo(x + r * 0.6, y); g.moveTo(x, y - r * 0.6); g.lineTo(x, y + r * 0.6); g.stroke(); g.restore();
}
// 팔각 테(AOM 계기의 회색 테 · 나사 넷)
function _cnOct(g, cx, cy, R) {
  const r = R * 1.22, c = r * 0.42;
  g.save();
  const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, '#8d999f'); gr.addColorStop(1, '#4f5a60');
  g.fillStyle = gr; g.strokeStyle = '#3a4246'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx - r + c, cy - r); g.lineTo(cx + r - c, cy - r); g.lineTo(cx + r, cy - r + c); g.lineTo(cx + r, cy + r - c);
  g.lineTo(cx + r - c, cy + r); g.lineTo(cx - r + c, cy + r); g.lineTo(cx - r, cy + r - c); g.lineTo(cx - r, cy - r + c); g.closePath(); g.fill(); g.stroke();
  g.restore();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => _cnScrew(g, cx + dx * r * 0.80, cy + dy * r * 0.80, R * 0.07));
}
function _cnDig(g, x, y, w, h, s, col = '#ffd21a') {
  g.save(); g.fillStyle = '#0b0b0b'; g.strokeStyle = '#555'; g.lineWidth = 1; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
  g.font = `bold ${Math.round(h * 0.82)}px "Courier New", monospace`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x + w / 2, y + h / 2 + 1); g.restore();
}
// 알림등 — 켜지면 그 색으로 밝게 · 꺼지면 어두운 같은 색
function _cnLamp(g, x, y, w, h, txt, on, col, fs) {
  g.save();
  g.fillStyle = '#151617'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
  if (on) { g.shadowColor = col; g.shadowBlur = 10; }
  g.fillStyle = on ? col : _cnDim(col); g.fillRect(x, y, w, h); g.shadowBlur = 0;
  const L = String(txt).split('\n'), f = fs || Math.min(h * 0.42 / Math.max(1, L.length * 0.8), 15);
  L.forEach((t, i) => _cnT(g, t, x + w / 2, y + h / 2 + (i - (L.length - 1) / 2) * f * 1.05, f, on ? (col === '#ffd21a' || col === '#f39a1f' ? '#2a1600' : '#fff') : 'rgba(255,255,255,0.28)'));
  g.restore();
}
function _cnDim(col) { return { '#e8231c': '#4a1210', '#f39a1f': '#4d3410', '#ffd21a': '#4a4010', '#28e04a': '#11331a', '#3cf': '#123040' }[col] || '#2a2a2a'; }
function _cnBtn(g, x, y, w, h, txt, on, fs) {
  g.save(); g.fillStyle = '#0f1011'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = on ? '#25512f' : '#232526'; g.fillRect(x, y, w, h); g.strokeStyle = on ? '#3cff6a' : '#555'; g.lineWidth = 1.2; g.strokeRect(x, y, w, h); g.restore();
  _cnT(g, txt, x + w / 2, y + h / 2, fs || Math.min(16, h * 0.42), on ? '#cfffd8' : '#e6e6e6');
}
function _cnBlackPanel(g, x, y, w, h, title) {
  g.save(); g.fillStyle = CNP_DARK; g.fillRect(x, y, w, h); g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(x, y, w, h); g.restore();
  [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]].forEach(([a, b]) => _cnScrew(g, a, b, 4));
  if (title) _cnT(g, title, x + w / 2, y + 16, 13, '#e6e6e6');
}

// ── 값 ──
function cnPanelVals() {
  const e = cn.eng, v = {
    ias: Math.max(0, S.spd || 0), alt: S.alt || 0, vs: S.vs || 0, pit: S.pit || 0, bnk: S.bnk || 0,
    hdg: (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg), bug: (typeof selHdg !== 'undefined' ? selHdg : 0),
    tq: e.map(x => x.tq), itt: e.map(x => x.itt), np: e.map(x => x.np), ng: e.map(x => x.ng), ff: e.map(x => x.ff * 2.2046),
    oilP: e.map(x => x.ng > 50 ? 70 + x.tq * 0.3 : x.ng), oilT: e.map(x => x.ng > 50 ? 60 + x.tq * 0.25 : 20),
    pOilP: e.map(x => x.np > 30 ? 120 + x.tq * 0.4 : x.np), pOilT: e.map(x => x.np > 30 ? 55 + x.tq * 0.2 : 20),
    alpha: cn.alpha, as: cnAlphaStall(), flap: cn.flap, flapSel: cn.flapSel, gear: cn.gearPos, gearDn: cn.gearDn,
    fuel: cn.fuelKg, baro: (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa) ? window._qnhHpa : 1013.25),
    vmo: cnVmo(), ra: (() => { try { return radarAltFt(); } catch (er) { return 9999; } })(),
    oat: (typeof _oatSurfaceC === 'number' ? _oatSurfaceC : 15) - 2 * (S.alt || 0) / 1000,
  };
  return v;
}

// ── 경고 패널(그림 1-1-9 A · E) — 글자 · 색 · 켜지는 때 ──
const _CNR = '#e8231c', _CNA = '#f39a1f';
function _cnW(fn) { return () => { try { return !!fn(); } catch (e) { return false; } }; }
const CN_ANN_A = [
  [['#1 ENG\nFIRE DET', _CNA], ['#1AC\nGEN', _CNA, _cnW(() => !cn.eng[0].run)], ['#1\nINVERTER', _CNA], ['STBY\nINVERTER', _CNA]],
  [['#1 ENG\nCHIP', _CNA], ['#1 INLET\nANTI ICE', _CNA], ['#1 PITOT\nHEATING', _CNA], ['AUX\nPITOT', _CNA]],
  [['#1 ENG\nOIL FLTR', _CNA], ['#1 WSHLD\nHEATING', _CNA], ['#1 HYD\nPRESS', _CNA, _cnW(() => !cn.eng[0].run)], ['HOT\nHYD OIL', _CNA]],
  [['#1 ENG\nFUEL FLTR', _CNA], ['#1 FUEL\nCOLD', _CNA], ['#1 FUEL\nLEVEL', _CNA, _cnW(() => cn.fuelKg < 400)], ['FLAP\nFAIL', _CNA]],
  [['—', _CNA], ['—', _CNA], ['—', _CNA], ['—', _CNA]],
];
const CN_ANN_A2 = [
  [['ELEVATOR\nFWD DISC', _CNA], ['AUTO\nFEATHER', _CNR], ['#1 DC\nGEN', _CNR, _cnW(() => !cn.eng[0].run)], ['#1 ENG\nFIRE', _CNR]],
  [['ELEVATOR\nREAR DISC', _CNA], ['FLAP\nASYM', _CNR], ['#1 DC\nGEN HOT', _CNR], ['#1 ENG\nFUEL PRESS', _CNR, _cnW(() => cn.cond[0] === 'OFF')]],
  [['AILERON\nFWD DISC', _CNA], ['WING\nOVERHEAT', _CNR], ['#1 BLEED\nHOT', _CNR], ['#1 ENG\nOIL PRESS', _CNR, _cnW(() => cn.eng[0].ng < 40)]],
  [['AILERON\nREAR DISC', _CNA], ['DOOR\nUNLOCKED', _CNR], ['CABIN\nALTITUDE', _CNR], ['#1 PROP\nOIL PRESS', _CNR, _cnW(() => cn.eng[0].np < 30)]],
  [['#1 TRU', _CNA], ['—', _CNR], ['—', _CNR], ['LAVATORY\nFIRE', _CNR]],
];
const CN_ANN_E = [
  [['#2 ENG\nFIRE', _CNR], ['#2 DC\nGEN', _CNR, _cnW(() => !cn.eng[1].run)], ['BAT HOT', _CNR], ['FRONT\nANTISKID', _CNA, _cnW(() => !cn.antiskid)]],
  [['#2 ENG\nFUEL PRESS', _CNR, _cnW(() => cn.cond[1] === 'OFF')], ['#2 DC\nGEN HOT', _CNR], ['BAT-GEN\nUNTIE', _CNR], ['REAR\nANTISKID', _CNA, _cnW(() => !cn.antiskid)]],
  [['#2 ENG\nOIL PRESS', _CNR, _cnW(() => cn.eng[1].ng < 40)], ['#2 BLEED\nHOT', _CNR], ['GEAR UP', _CNR, _cnW(() => cnPanelAnn().gear)], ['EMER LTS', _CNA]],
  [['#2 PROP\nOIL PRESS', _CNR, _cnW(() => cn.eng[1].np < 30)], ['PROP\nBRAKE', _CNR], ['AUTO\nPILOT', _CNR, _cnW(() => cn.apWarn > 0)], ['—', _CNA]],
  [['CARGO\nFIRE', _CNR], ['—', _CNR], ['—', _CNR], ['—', _CNA]],
];
const CN_ANN_E2 = [
  [['ICE\nFORM', _CNA, _cnW(() => typeof env !== 'undefined' && env.icing)], ['#2\nINVERTER', _CNA], ['#2 AC\nGEN', _CNA, _cnW(() => !cn.eng[1].run)], ['#2 ENG\nFIRE DET', _CNA]],
  [['HIGH PRESS\nDEICING', _CNA], ['#2 PITOT\nHEATING', _CNA], ['#2 INLET\nANTI ICE', _CNA], ['#2 ENG\nCHIP', _CNA]],
  [['WING/TAIL\nDEICING', _CNA], ['#2 HYD\nPRESS', _CNA, _cnW(() => !cn.eng[1].run)], ['#2 WSHLD\nHEATING', _CNA], ['#2 ENG\nOIL FLTR', _CNA]],
  [['—', _CNA], ['#2 FUEL\nLEVEL', _CNA, _cnW(() => cn.fuelKg < 400)], ['#2 FUEL\nCOLD', _CNA], ['#2 ENG\nFUEL FLTR', _CNA]],
  [['#2 TRU', _CNA], ['—', _CNA], ['—', _CNA], ['—', _CNA]],
];
let _cnAnnTest = 0;
const _cnAck = new Set();
function cnAnnLit() {
  const lit = [];
  [CN_ANN_A, CN_ANN_A2, CN_ANN_E, CN_ANN_E2].forEach(T => T.forEach(r => r.forEach(([t, c, f]) => { if (f && f()) lit.push([t, c]); })));
  return lit;
}
function cnMaster() {
  const lit = cnAnnLit();
  ['W', 'C'].forEach(k => { for (const key of [..._cnAck]) if (key[0] === k && !lit.some(([t]) => k + t === key)) _cnAck.delete(key); });
  return { warn: lit.some(([t, c]) => c === _CNR && !_cnAck.has('W' + t)), caut: lit.some(([t, c]) => c === _CNA && !_cnAck.has('C' + t)) };
}
function cnMasterAck(k) { cnAnnLit().forEach(([t, c]) => { if ((k === 'W') === (c === _CNR)) _cnAck.add(k + t); }); _cnRedraw(); }
function cnPanelAnn() {
  const v = cnPanelVals(), air = !cn.onGnd;
  return {
    stall: cn.stallWarn, gear: air && v.gear < 0.99 && v.ra < 1000 && cn.pl < 0.25 && !cn.mute,
    ovspd: v.ias > v.vmo + 1 || (v.flap > 0.5 && v.ias > 162) || (v.gear > 0.01 && v.ias > CN_P.vle + 2),
    pullUp: air && v.ra < 1500 && v.vs < -Math.max(1500, v.ra * 2.2),
  };
}

// ══ Universal PFD(그림 1-1-8 가운데) — 속도 띠 · 자세 · 고도 띠 · 승강 · 헤딩 띠 · FMA ══
function cnPfd(g, x, y, w, h, v) {
  g.save();
  g.fillStyle = '#5d676c'; g.fillRect(x - 22, y - 26, w + 44, h + 74);           // 테(UNIVERSAL)
  _cnT(g, 'UNIVERSAL', x + w / 2, y - 13, 10, '#e8e8e8', false);
  g.fillStyle = '#000'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  const cx = x + w / 2, cy = y + h * 0.48, ppd = h / 52;
  // 자세
  g.save(); g.translate(cx, cy); g.rotate(-v.bnk * D2R); g.translate(0, v.pit * ppd);
  g.fillStyle = '#2f6cb8'; g.fillRect(-w * 2, -h * 4, w * 4, h * 4); g.fillStyle = '#8a6a44'; g.fillRect(-w * 2, 0, w * 4, h * 4);
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w * 2, 0); g.lineTo(w * 2, 0); g.stroke();
  for (let p = -30; p <= 30; p += 5) {
    if (!p) continue;
    const yy = -p * ppd, half = p % 10 === 0 ? w * 0.11 : w * 0.05;
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(-half, yy); g.lineTo(half, yy); g.stroke();
    if (p % 10 === 0) { _cnT(g, String(Math.abs(p)), -half - 14, yy, 13, '#fff', false); _cnT(g, String(Math.abs(p)), half + 14, yy, 13, '#fff', false); }
  }
  g.restore();
  // 뱅크 눈금 · 지시(흰 삼각)
  g.save(); g.translate(cx, cy); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 2; const r = h * 0.36;
  for (const b of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) { const a = (b - 90) * D2R, l = Math.abs(b) % 30 === 0 ? 12 : 7; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + l), Math.sin(a) * (r + l)); g.stroke(); }
  g.beginPath(); g.moveTo(0, -r); g.lineTo(-7, -r - 11); g.lineTo(7, -r - 11); g.closePath(); g.fill();
  g.rotate(-v.bnk * D2R); g.beginPath(); g.moveTo(0, -r + 1); g.lineTo(-8, -r + 13); g.lineTo(8, -r + 13); g.closePath(); g.fill();
  // 미끄럼(볼 대신 사다리꼴 — 방향타 트림 · 한 엔진)
  g.fillRect(-8 + (cn.slip || 0) * 14, -r + 15, 16, 4);
  g.restore();
  // FD(마젠타) — 원하는 자세 · 뱅크
  if (cn.fd.on) {
    g.save(); g.translate(cx, cy); g.rotate(-(cn.fd.roll - v.bnk) * D2R); g.translate(0, -(cn.fd.pitch - v.pit) * ppd);
    g.fillStyle = '#ff3fd0'; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-w * 0.2, 16); g.lineTo(-w * 0.2, 10); g.lineTo(0, -4); g.lineTo(w * 0.2, 10); g.lineTo(w * 0.2, 16); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  // 비행기 표지(검은 V · 노랑 테)
  g.save(); g.fillStyle = '#111'; g.strokeStyle = '#ffd21a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - w * 0.17, cy + 14); g.lineTo(cx - w * 0.07, cy + 14); g.lineTo(cx, cy + 6); g.lineTo(cx + w * 0.07, cy + 14); g.lineTo(cx + w * 0.17, cy + 14); g.closePath(); g.fill(); g.stroke();
  g.fillRect(cx - w * 0.30, cy - 3, w * 0.07, 6); g.strokeRect(cx - w * 0.30, cy - 3, w * 0.07, 6); g.fillRect(cx + w * 0.23, cy - 3, w * 0.07, 6); g.strokeRect(cx + w * 0.23, cy - 3, w * 0.07, 6); g.restore();
  // 속도 띠(왼쪽) — 10kt 당 h/14 · VMO 빨강 · 실속 빨강/노랑 · VREF
  const tx = x + 6, tw = w * 0.13, tt = y + h * 0.10, tb = y + h * 0.86, pk = (tb - tt) / 90;
  g.fillStyle = 'rgba(70,78,88,0.75)'; g.fillRect(tx, tt, tw, tb - tt);
  g.save(); g.beginPath(); g.rect(tx, tt, tw + 10, tb - tt); g.clip();
  for (let s = Math.floor((v.ias - 50) / 10) * 10; s <= v.ias + 50; s += 10) {
    if (s < 0) continue; const yy = cy - (s - v.ias) * pk;
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tx + tw - 10, yy); g.lineTo(tx + tw, yy); g.stroke();
    if (s % 20 === 0) _cnT(g, String(s), tx + tw * 0.42, yy, 15, '#fff', false);
  }
  const band = (a, b, col, off) => { const y0 = cy - (b - v.ias) * pk, y1 = cy - (a - v.ias) * pk; g.fillStyle = col; g.fillRect(tx + tw + (off || 0), Math.min(y0, y1), 5, Math.abs(y1 - y0)); };
  const vs1 = cnVs(1);
  band(v.vmo, v.vmo + 60, '#e8231c'); band(0, vs1, '#e8231c'); band(vs1, vs1 * 1.13, '#ffd21a');
  g.restore();
  g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.fillRect(tx, cy - 15, tw + 4, 30); g.strokeRect(tx, cy - 15, tw + 4, 30);
  _cnT(g, String(Math.round(v.ias)), tx + tw / 2 + 2, cy, 20, v.ias > v.vmo ? '#ff4a3a' : '#fff');
  let sel = null; try { sel = (simModeOn ? simIasOn : iasNsOn) ? selSpd : null; } catch (e) { _swallow(e); }
  _cnT(g, sel != null ? String(Math.round(sel)) : '', tx + tw / 2, tt - 12, 15, '#3cff6a');
  // 고도 띠(오른쪽) — 100ft 당 · 고른 고도(청록)
  const ax = x + w - w * 0.17 - 6, aw = w * 0.17, ak = (tb - tt) / 1000;
  g.fillStyle = 'rgba(70,78,88,0.75)'; g.fillRect(ax, tt, aw, tb - tt);
  g.save(); g.beginPath(); g.rect(ax, tt, aw, tb - tt); g.clip();
  for (let a = Math.floor((v.alt - 600) / 100) * 100; a <= v.alt + 600; a += 100) {
    const yy = cy - (a - v.alt) * ak; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ax, yy); g.lineTo(ax + 9, yy); g.stroke();
    if (a % 500 === 0) _cnT(g, String(a), ax + aw * 0.58, yy, 14, '#fff', false);
  }
  g.restore();
  g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.fillRect(ax - 4, cy - 15, aw + 4, 30); g.strokeRect(ax - 4, cy - 15, aw + 4, 30);
  _cnT(g, String(Math.round(v.alt / 20) * 20), ax + aw / 2, cy, 18, '#fff');
  let selA = null; try { selA = altHoldOn ? selAlt : (typeof altaSel !== 'undefined' && altArmed ? altaSel : null); } catch (e) { _swallow(e); }
  _cnT(g, selA != null ? String(selA) : '', ax + aw / 2, tt - 12, 15, '#3cf');
  _cnT(g, `${(v.baro / 33.8639).toFixed(2)} IN`, ax + aw / 2, tb + 12, 12, '#3cf', false);
  // 승강(오른쪽 끝 바늘)
  const vsx = x + w - 4, vsk = Math.max(-1, Math.min(1, v.vs / 2000));
  g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(vsx + 20, cy); g.lineTo(vsx - 4, cy - vsk * h * 0.32); g.stroke();
  if (Math.abs(v.vs) > 90) _cnT(g, String(Math.round(v.vs / 50) * 50), ax - 26, cy + h * 0.26 * -Math.sign(v.vs), 12, '#fff', false);
  // 전파고도
  if (v.ra < 2500) _cnT(g, `RA ${Math.round(v.ra / 10) * 10}`, cx + w * 0.18, cy + h * 0.24, 14, '#fff');
  // 헤딩 띠(아래)
  const hy = y + h - 26, hw = w * 0.56, hx = cx - hw / 2;
  g.fillStyle = 'rgba(70,78,88,0.75)'; g.fillRect(hx, hy, hw, 24);
  g.save(); g.beginPath(); g.rect(hx, hy, hw, 24); g.clip();
  for (let d = Math.floor((v.hdg - 40) / 5) * 5; d <= v.hdg + 40; d += 5) {
    const xx = cx + (d - v.hdg) * hw / 80, dd = ((d % 360) + 360) % 360;
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xx, hy); g.lineTo(xx, hy + (d % 10 === 0 ? 8 : 4)); g.stroke();
    if (d % 30 === 0) _cnT(g, dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : String(dd / 10), xx, hy + 16, 13, '#fff', false);
  }
  const bx = cx + normAS(v.bug - v.hdg) * hw / 80; g.fillStyle = '#3cf'; g.fillRect(bx - 6, hy, 12, 5);
  g.restore();
  g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.fillRect(cx - 24, hy - 4, 48, 24); g.strokeRect(cx - 24, hy - 4, 48, 24);
  _cnT(g, String(Math.round(v.hdg) % 360 || 360).padStart(3, '0'), cx, hy + 8, 16, '#fff');
  // FMA(위) — 옆 · AP/YD · 아래위
  let lat = '', ver = '', arm = '';
  try {
    lat = navApOn ? (navSrc === 'FMS' ? 'FMS' : 'LOC') : hdgSelOn ? 'HDG' : cn.ga ? 'GA' : 'ROLL';
    ver = cn.ga ? 'GA' : gsOn ? 'GS' : altHoldOn ? 'ALT' : vsModeOn ? (selVS >= 1200 ? 'CLM' : selVS <= -1200 ? 'DSC' : 'VS') : (simModeOn ? simIasOn : iasNsOn) ? 'IAS' : 'PIT';
    arm = (gsArmed ? 'GS ' : '') + (altArmed ? 'ASEL' : '');
  } catch (e) { _swallow(e); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, 40);
  _cnT(g, lat, x + 44, y + 13, 16, '#3cff6a'); _cnT(g, ver, x + w - 44, y + 13, 16, '#3cff6a');
  _cnT(g, `${cn.ap ? 'AP1' : ''}${cn.ap && cn.yd ? ' / ' : ''}${cn.yd ? 'YD1' : ''}`, cx, y + 13, 15, cn.ap ? '#3cff6a' : cn.apWarn > 0 && (performance.now() / 300 | 0) % 2 ? '#ff3a2a' : '#ffd21a');
  _cnT(g, arm, x + w - 44, y + 31, 12, '#fff', false);
  if (cn.stallWarn) _cnT(g, 'STALL', cx, cy - h * 0.22, 24, (performance.now() / 250 | 0) % 2 ? '#ff3a2a' : '#fff');
  if (cnPanelAnn().pullUp) _cnT(g, 'PULL UP', cx, cy + h * 0.16, 22, '#ff3a2a');
  g.restore();
  // 아래 테 — TEST · 밝기
  g.save(); g.fillStyle = '#868f94'; g.fillRect(x - 22, y + h + 6, w + 44, 42); g.restore();
  _cnBtn(g, x + 60, y + h + 18, 52, 20, 'TEST', false, 11);
}
// ══ Universal MFD(그림 1-1-8 가운데 아래) — 비행계획 상태 · 지도(기수 위 원) ══
function cnNd(g, x, y, w, h, v) {
  g.save();
  g.fillStyle = '#5d676c'; g.fillRect(x - 22, y - 20, w + 44, h + 62);
  g.fillStyle = '#000'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  // 비행계획 상태(위 표)
  const wps = (typeof S !== 'undefined' && S.wps) || [], i0 = Math.max(0, S.awp || 0);
  _cnT(g, 'FLIGHT PLAN STATUS', x + 84, y + 14, 12, '#3cff6a', false, 'center');
  _cnT(g, 'FUEL', x + w * 0.66, y + 14, 12, '#3cff6a', false); _cnT(g, 'WEIGHT', x + w * 0.86, y + 14, 12, '#3cff6a', false);
  let gs = 140; try { gs = Math.max(60, groundSpdKt()); } catch (e) { _swallow(e); }
  let acc = 0; const rows = [['TO', i0], ['NX', i0 + 1], ['DEST', wps.length - 1]];
  rows.forEach(([lab, i], r) => {
    const wp = wps[i]; if (!wp || i < 0) return;
    let d = 0; try { d = r === 0 ? (S.dtw || 0) : distance(S.lat, S.lon, wp.lat, wp.lon); } catch (e) { _swallow(e); }
    const t = d / gs, fu = Math.max(0, cn.fuelKg * 2.2046 - (cn.eng[0].ff + cn.eng[1].ff) * 2.2046 * t);
    const yy = y + 36 + r * 19;
    _cnT(g, lab, x + 18, yy, 12, '#ff5aa8', false); _cnT(g, (wp.name || wp.id || 'WPT').slice(0, 6), x + 62, yy, 14, '#fff', false);
    _cnT(g, `${d.toFixed(1)}NM`, x + 150, yy, 14, '#fff', false); _cnT(g, `${Math.floor(t)}+${String(Math.round(t * 60 % 60)).padStart(2, '0')}`, x + 220, yy, 14, '#fff', false);
    _cnT(g, String(Math.round(fu)), x + w * 0.66, yy, 13, '#fff', false); _cnT(g, String(Math.round(cnMassKg() * 2.2046 - (cn.fuelKg * 2.2046 - fu))), x + w * 0.86, yy, 13, '#fff', false);
    acc += d;
  });
  let tas = v.ias; try { tas = v.ias * tasRatio(); } catch (e) { _swallow(e); }
  _cnT(g, `TAS ${Math.round(tas)}`, x + 50, y + 104, 15, '#fff', false); _cnT(g, `GS ${Math.round(gs)}`, x + 50, y + 122, 15, '#fff', false);
  try { _cnT(g, `W ${Math.round(normA(windDir))}/${Math.round(windSpd)}`, x + 50, y + 140, 12, '#fff', false); } catch (e) { _swallow(e); }
  _cnT(g, 'MENU', x + w - 50, y + 104, 12, '#3cff6a', false);
  // 원형 지도(기수 위)
  const cx = x + w / 2, cy = y + h * 0.66, R = Math.min(w * 0.36, h * 0.31);
  g.save(); g.translate(cx, cy);
  g.save(); g.rotate(-v.hdg * D2R);
  g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
  for (let d = 0; d < 360; d += 5) { const a = (d - 90) * D2R, l = d % 10 === 0 ? 10 : 5; g.beginPath(); g.moveTo(Math.cos(a) * R, Math.sin(a) * R); g.lineTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l)); g.stroke(); }
  for (let d = 0; d < 360; d += 30) { g.save(); g.rotate(d * D2R); _cnT(g, d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10), 0, -R + 20, 15, '#fff', false); g.restore(); }
  g.save(); g.rotate(v.bug * D2R); g.fillStyle = '#3cf'; g.fillRect(-8, -R - 6, 16, 6); g.restore();
  g.restore();
  // 비행계획 선(마젠타) — 50NM 범위
  const rng = 25, k = R / rng;
  const pt = wp => { const b = (bearing(S.lat, S.lon, wp.lat, wp.lon) - S.hdg) * D2R, d = distance(S.lat, S.lon, wp.lat, wp.lon) * k; return [Math.sin(b) * d, -Math.cos(b) * d]; };
  g.save(); g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip();
  try {
    g.strokeStyle = '#ff3fd0'; g.lineWidth = 2; g.beginPath();
    wps.forEach((wp, i) => { const [px, py] = pt(wp); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }); g.stroke();
    wps.forEach((wp, i) => { const [px, py] = pt(wp); g.fillStyle = i === S.awp ? '#ff3fd0' : '#fff'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); _cnT(g, (wp.name || '').slice(0, 6), px + 22, py - 8, 11, '#fff', false); });
  } catch (e) { _swallow(e); }
  g.restore();
  // 기체
  g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.moveTo(-11, 0); g.lineTo(11, 0); g.moveTo(-5, 10); g.lineTo(5, 10); g.stroke();
  g.restore();
  _cnT(g, String(Math.round(v.hdg) % 360 || 360).padStart(3, '0'), cx, cy - R - 22, 16, '#fff');
  _cnT(g, `${rng}NM`, x + 30, y + h - 40, 12, '#3cf', false);
  try { if (S.awp >= 0 && S.wps[S.awp]) _cnT(g, `FMS1  ${S.wps[S.awp].name || ''}`, x + 70, y + h - 18, 13, '#ff3fd0', false); } catch (e) { _swallow(e); }
  try { const r2 = navRadios.NAV2; if (r2 && r2.id) _cnT(g, `VOR 2  ${r2.id}`, x + w - 70, y + h - 18, 13, '#fff', false); } catch (e) { _swallow(e); }
  g.restore();
}

// ══ 대기 계기 ══
function cnStbyAsi(g, cx, cy, R, v) {
  _cnOct(g, cx, cy, R); _b206Case(g, cx, cy, R);
  const map = s => 20 + (Math.max(50, Math.min(350, s)) - 50) / 300 * 310;
  for (let s = 50; s <= 350; s += 10) { const big = s % 50 === 0; _b206Radial(g, cx, cy, R * (big ? 0.72 : 0.80), R * 0.9, map(s), '#fff', big ? 2 : 1); if (big) { const [tx, ty] = _pt(cx, cy, R * 0.56, map(s)); _cnT(g, String(s), tx, ty, R * 0.15, '#fff'); } }
  _cnT(g, 'AIRSPEED', cx, cy - R * 0.18, R * 0.11, '#fff'); _cnT(g, 'KNOTS', cx, cy + R * 0.22, R * 0.11, '#fff');
  // VMO 바늘(빨강 · 흰 줄무늬)
  g.save(); g.translate(cx, cy); g.rotate(map(v.vmo) * D2R); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#d22'; g.fillRect(-2.5, -R * 0.82 + i * R * 0.12, 5, R * 0.12); } g.restore();
  _b206Needle(g, cx, cy, R * 0.85, map(v.ias), R * 0.07); _b206Hub(g, cx, cy, R * 0.07);
}
function cnStbyHsi(g, cx, cy, R, v) {
  g.save(); g.fillStyle = '#4c565b'; g.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4); g.fillStyle = '#060606'; g.beginPath(); g.arc(cx, cy, R * 1.05, 0, 7); g.fill(); g.restore();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => _cnScrew(g, cx + a * R * 1.08, cy + b * R * 1.08, R * 0.08));
  g.save(); g.translate(cx, cy); g.rotate(-v.hdg * D2R);
  for (let d = 0; d < 360; d += 5) { const a = (d - 90) * D2R, l = d % 10 === 0 ? R * 0.13 : R * 0.07; g.strokeStyle = '#fff'; g.lineWidth = d % 10 === 0 ? 2 : 1; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95); g.lineTo(Math.cos(a) * (R * 0.95 - l), Math.sin(a) * (R * 0.95 - l)); g.stroke(); }
  for (let d = 0; d < 360; d += 30) { g.save(); g.rotate(d * D2R); _cnT(g, String(d / 10), 0, -R * 0.68, R * 0.15, '#fff'); g.restore(); }
  g.restore();
  // RMI 바늘 — 노랑(NAV 1 · VOR/FMS 쪽) · 초록(코스 · CDI)
  let c = { ok: false, dev: 0, crs: 0 }; try { c = b206Cdi(); } catch (e) { _swallow(e); }
  const crs = typeof toMag === 'function' ? toMag(c.crs) : c.crs;
  g.save(); g.translate(cx, cy); g.rotate((crs - v.hdg) * D2R); g.strokeStyle = '#59d35c'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-R * 0.6, 0); g.lineTo(R * 0.6, 0); g.stroke(); g.restore();
  let brg = null; try { if (S.awp >= 0 && S.wps[S.awp]) brg = bearing(S.lat, S.lon, S.wps[S.awp].lat, S.wps[S.awp].lon) - S.hdg; } catch (e) { _swallow(e); }
  if (brg != null) { g.save(); g.translate(cx, cy); g.rotate(brg * D2R); g.strokeStyle = '#ffd21a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, R * 0.8); g.lineTo(0, -R * 0.8); g.stroke(); g.fillStyle = '#ffd21a'; g.beginPath(); g.moveTo(0, -R * 0.88); g.lineTo(-7, -R * 0.72); g.lineTo(7, -R * 0.72); g.closePath(); g.fill(); g.restore(); }
  g.save(); g.fillStyle = '#ffd21a'; g.beginPath(); g.moveTo(cx, cy - R * 0.96); g.lineTo(cx - 6, cy - R * 1.08); g.lineTo(cx + 6, cy - R * 1.08); g.closePath(); g.fill(); g.restore();
  g.save(); g.translate(cx, cy); g.rotate((v.bug - v.hdg) * D2R); g.fillStyle = '#e8231c'; g.beginPath(); g.moveTo(0, -R * 0.95); g.lineTo(-9, -R * 1.1); g.lineTo(9, -R * 1.1); g.closePath(); g.fill(); g.restore();
}
function cnAoaGauge(g, cx, cy, R, v) {
  _b206Case(g, cx, cy, R);
  const u = Math.max(0, Math.min(55, 5 + v.alpha * 2.3)), map = q => -150 + q / 50 * 270;
  _b206Arc(g, cx, cy, R * 0.84, map(10), map(28), '#18c23a', R * 0.12); _b206Arc(g, cx, cy, R * 0.84, map(28), map(36), '#f2c418', R * 0.12); _b206Arc(g, cx, cy, R * 0.84, map(36), map(50), '#e8231c', R * 0.12);
  [10, 20, 30, 40, 50].forEach(q => { const [tx, ty] = _pt(cx, cy, R * 0.58, map(q)); _cnT(g, String(q), tx, ty, R * 0.15, '#fff'); });
  _cnT(g, 'ANGLE', cx - R * 0.25, cy - R * 0.25, R * 0.12, '#fff'); _cnT(g, 'OF', cx - R * 0.25, cy - R * 0.12, R * 0.12, '#fff'); _cnT(g, 'ATTACK', cx - R * 0.25, cy + R * 0.01, R * 0.12, '#fff');
  _b206Needle(g, cx, cy, R * 0.8, map(u), R * 0.07); _b206Hub(g, cx, cy, R * 0.07);
}

// ══ LH 계기판(그림 1-1-8 · 1000×640) ══
function cnLhDraw(g, v) {
  const W = 1000, H = 640;
  g.save(); g.fillStyle = CNP_BG; g.strokeStyle = CNP_EDGE; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 92); g.lineTo(205, 92); g.bezierCurveTo(300, 92, 350, 4, 440, 4); g.lineTo(W, 4); g.lineTo(W, H - 40); g.lineTo(W - 22, H - 40); g.lineTo(W - 22, H); g.lineTo(0, H); g.closePath(); g.fill(); g.stroke(); g.restore();
  [[38, 120], [38, 265], [38, 410], [38, 555]].forEach(([a, b]) => _cnScrew(g, a, b, 7));
  const an = cnPanelAnn(), M = cnMaster();
  // 위 등
  _cnLamp(g, 398, 30, 48, 34, 'BETA\nMODE', cn.pl < 0 && cn.eng[0].run, '#f39a1f', 11);
  _cnLamp(g, 543, 30, 48, 34, 'BETA\nMODE', cn.pl < 0 && cn.eng[1].run, '#f39a1f', 11);
  _cnLamp(g, 625, 28, 62, 34, 'STALL', an.stall, '#e8231c', 15);
  _cnLamp(g, 733, 28, 62, 34, 'WARNING', M.warn && (performance.now() / 400 | 0) % 2 === 0, '#e8231c', 13); _cnHit(733, 28, 62, 34, () => cnMasterAck('W'));
  _cnLamp(g, 840, 28, 62, 34, 'CAUTION', M.caut, '#f39a1f', 13); _cnHit(840, 28, 62, 34, () => cnMasterAck('C'));
  // AHS(◀ ▶ DG)
  _cnBlackPanel(g, 95, 112, 148, 54); _cnT(g, 'AHS', 169, 122, 10, '#ddd'); _cnT(g, 'SLEW     MODE', 169, 132, 8, '#bbb', false);
  let dg = false; try { dg = hdgRef === 'DG'; } catch (e) { _swallow(e); }
  _cnBtn(g, 108, 138, 30, 22, '◀', false, 12); _cnBtn(g, 142, 138, 30, 22, '▶', false, 12); _cnBtn(g, 178, 138, 40, 22, 'D G', dg, 11);
  _cnHit(108, 138, 30, 22, () => { try { dgAdjust(-1); } catch (e) { _swallow(e); } }); _cnHit(142, 138, 30, 22, () => { try { dgAdjust(1); } catch (e) { _swallow(e); } });
  _cnHit(178, 138, 40, 22, () => { try { toggleHdgRef(); } catch (e) { _swallow(e); } });
  // 왼쪽 열 — 대기 속도계 · HSI · AOA
  cnStbyAsi(g, 166, 252, 60, v);
  cnStbyHsi(g, 172, 412, 62, v);
  cnAoaGauge(g, 166, 560, 46, v);
  _cnLamp(g, 236, 548, 40, 26, 'AOA\nICE', false, '#f39a1f', 9);
  // Universal PFD
  cnPfd(g, 352, 98, 272, 270, v);
  // STANDBY ATT PWR · LH HOT BUS · TAWS
  _cnLamp(g, 668, 100, 58, 28, 'STANDBY\nATT PWR', false, '#f39a1f', 9);
  _cnLamp(g, 736, 102, 34, 24, 'LH HOT\nBUS', false, '#e8231c', 7);
  _cnBlackPanel(g, 784, 82, 184, 58); _cnT(g, 'TAWS', 876, 92, 10, '#ddd');
  _cnLamp(g, 798, 104, 36, 28, 'PULL\nUP', an.pullUp, '#e8231c', 9); _cnLamp(g, 838, 104, 36, 28, 'BELOW\nG/S', false, '#f39a1f', 7);
  _cnLamp(g, 878, 104, 36, 28, 'GPWS\nINOP', false, '#f39a1f', 8); _cnLamp(g, 918, 104, 36, 28, 'TERR\nINHB', false, '#f39a1f', 8);
  // 오른쪽 — 대기 자세계 · 고도계 · 승강계
  _cnOct(g, 729, 228, 56); b206Attitude(g, 729, 228, 56, v.pit, v.bnk);
  _cnOct(g, 900, 228, 56); b206Altimeter(g, 900, 228, 56, v.alt, v.baro / 33.8639);
  _cnOct(g, 900, 366, 56); b206Vsi(g, 900, 366, 56, v.vs);
  // LAUNCHER INDICATION · 속도 한계표
  _cnBlackPanel(g, 845, 438, 108, 104); _cnT(g, 'LAUNCHER', 899, 456, 10, '#eee', false); _cnT(g, 'INDICATION', 899, 468, 10, '#eee', false);
  _cnT(g, 'FLARE', 899, 482, 9, '#eee', false); _cnBtn(g, 875, 490, 48, 16, 'OPEN', false, 9); _cnBtn(g, 875, 508, 48, 16, 'OPEN', false, 9); _cnT(g, 'MARINE MARKER', 899, 532, 8, '#eee', false);
  g.save(); g.fillStyle = '#121314'; g.fillRect(760, 556, 200, 66); g.restore();
  _cnT(g, 'AIRSPEED LIMITS (I A S)', 860, 566, 9, '#fff', false);
  ['VMO  SL 230 · 20000FT 200 · 25000FT 180 KT', 'VA (MANEUVERING) 160 KT', 'VFE  T/OFF 10 · APPR 15 · LNDG 23  160 KT', 'VLE (LANDING GEAR EXTENDED) 150 KT'].forEach((t, i) => _cnT(g, t, 860, 580 + i * 11, 7.5, '#ddd', false));
}

// ══ 가운데 계기판(그림 1-1-8 · 1000×660) ══
function cnCtrDraw(g, v) {
  const W = 1000, H = 660;
  g.save(); g.fillStyle = CNP_BG; g.strokeStyle = CNP_EDGE; g.lineWidth = 3; g.fillRect(2, 2, W - 4, H - 4); g.strokeRect(2, 2, W - 4, H - 4); g.restore();
  const R = 44;
  const pair = (y, title, vals, o, dig) => [0, 1].forEach(i => {
    const cx = 146 + i * 108; _cnOct(g, cx, y, R);
    b206RoundGauge(g, cx, y, R, Object.assign({ fs: R * 0.18 }, o, { val: _cl(vals[i], o.lo, o.hi * 1.04), title: title, ty: -0.12 }));
    if (dig) _cnDig(g, cx - 22, y + R * 0.42, 44, 15, dig(vals[i]));
  });
  pair(80, ['TORQUE', 'X 100 FT/LB'], v.tq.map(q => q * 0.042), { lo: 0, hi: 5, maj: 1, min: 0.5, bands: [[0.4, 4.2, '#18c23a'], [4.2, 4.45, '#f2c418']], redline: [4.45], lab: q => q ? String(q) : null });
  pair(196, ['ITT', 'X 100 °C'], v.itt.map(t => t / 100), { lo: 2, hi: 10, maj: 1, min: 0.5, bands: [[4, 8.2, '#18c23a'], [8.2, 8.7, '#f2c418']], redline: [8.7], lab: q => q % 2 === 0 ? String(q) : null }, t => String(Math.round(t * 100)));
  pair(312, ['NP', '% RPM'], v.np, { lo: 15, hi: 125, maj: 20, min: 10, bands: [[84, 102, '#18c23a'], [40, 84, '#f2c418']], redline: [102], lab: q => (q === 15 || q === 45 || q === 65 || q === 85 || q === 105 || q === 125) ? String(q) : null }, n => n.toFixed(1));
  pair(428, ['NG', '% RPM'], v.ng, { lo: 0, hi: 110, maj: 20, min: 10, bands: [[60, 101, '#18c23a']], redline: [101], lab: q => q % 20 === 0 ? String(q) : null }, n => n.toFixed(1));
  pair(544, ['FF', 'PPH X 100'], v.ff.map(f => f / 100), { lo: 0, hi: 10, maj: 2, min: 1, bands: [[1, 8, '#18c23a']], lab: q => String(q) }, f => (f * 10).toFixed(1));
  // PROP OIL · ENG OIL(겹 계기)
  [0, 1].forEach(i => {
    const cx = 372 + i * 120;
    _cnOct(g, cx, 80, R); b206DualGauge(g, cx, 80, R, { lo: 0, hi: 125, maj: 25, min: 25, val: v.pOilT[i], bands: [[50, 100, '#18c23a'], [100, 125, '#f2c418']], unit: '°C', lab: q => q % 50 === 0 ? String(q) : null }, { lo: 0, hi: 200, maj: 50, min: 50, val: v.pOilP[i], bands: [[100, 180, '#18c23a']], unit: 'PSI', lab: q => q % 100 === 0 ? String(q) : null }, ['PROP OIL']);
    _cnOct(g, cx, 196, R); b206DualGauge(g, cx, 196, R, { lo: 0, hi: 150, maj: 50, min: 25, val: v.oilT[i], bands: [[50, 120, '#18c23a'], [120, 150, '#f2c418']], unit: '°C', lab: q => q % 50 === 0 ? String(q) : null }, { lo: 0, hi: 200, maj: 50, min: 50, val: v.oilP[i], bands: [[60, 160, '#18c23a']], unit: 'PSI', lab: q => q % 100 === 0 ? String(q) : null }, ['ENG OIL']);
  });
  // TRIM(도움날개 · 승강타 · 방향타)
  {
    const x0 = 576, y0 = 28; g.save(); g.fillStyle = '#5e6a70'; g.fillRect(x0, y0, 118, 214); g.fillStyle = '#0b0b0b'; g.fillRect(x0 + 10, y0 + 10, 98, 194); g.restore();
    _cnT(g, 'TRIM', x0 + 59, y0 + 22, 12, '#fff');
    const ail = typeof simTrim !== 'undefined' ? simTrim.roll : 0, ele = typeof simTrim !== 'undefined' ? -simTrim.pitch : 0;
    const arc = (cx, cy, r, val, lab) => { _b206Arc(g, cx, cy, r, -60, 60, '#666', 2); _b206Needle(g, cx, cy + 0, r, _cl(val, -1, 1) * 55, 3, '#fff', 0.1); _cnT(g, lab, cx, cy + 14, 9, '#fff'); };
    arc(x0 + 40, y0 + 80, 30, ail / 10, '10 AILERON 10');
    arc(x0 + 40, y0 + 170, 30, cn.rudTrim, 'L RUDDER R');
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x0 + 84, y0 + 44, 14, 140); g.fillStyle = '#3cff6a'; g.fillRect(x0 + 82, y0 + 112 - _cl(ele / 20, -1, 1) * 64, 18, 5); g.restore();
    _cnT(g, 'NOSE', x0 + 92, y0 + 36, 7, '#fff'); _cnT(g, 'UP', x0 + 92, y0 + 42, 6, '#fff'); _cnT(g, 'NOSE DN', x0 + 92, y0 + 192, 6, '#fff');
  }
  // AIR TEMP · FLAP(UP · TO · APP · DN) · EXT DOORS
  {
    _cnOct(g, 760, 82, 46); _b206Case(g, 760, 82, 46);
    const map = t => -135 + (t + 60) / 120 * 270; [-40, -20, 0, 20, 40, 60].forEach(t => { const [tx, ty] = _pt(760, 82, 46 * 0.6, map(t)); _cnT(g, String(t), tx, ty, 9, '#fff'); });
    _cnT(g, 'AIR °C', 778, 70, 8, '#fff'); _cnT(g, 'TEMP', 778, 80, 8, '#fff'); _b206Needle(g, 760, 82, 40, map(v.oat), 3); _b206Hub(g, 760, 82, 4);
    _cnOct(g, 760, 206, 46); _b206Case(g, 760, 206, 46);
    const fm = f => f <= 10 ? f / 10 * 60 : f <= 15 ? 60 + (f - 10) / 5 * 60 : 120 + (f - 15) / 8 * 60;
    [['UP', 0], ['TO', 10], ['APP', 15], ['DN', 23]].forEach(([t, f]) => { const [tx, ty] = _pt(760, 206, 46 * 0.6, fm(f)); _cnT(g, t, tx, ty, 9, '#fff'); _b206Radial(g, 760, 206, 46 * 0.78, 46 * 0.9, fm(f), '#fff', 1.5); });
    _cnT(g, 'FLAP', 738, 214, 10, '#fff'); _b206Needle(g, 760, 206, 38, fm(v.flap), 4); _b206Hub(g, 760, 206, 4);
    _cnHit(714, 160, 92, 92, () => { const F = CN_P.flaps, i = F.indexOf(cn.flapSel); cnFlapSet(F[(i + 1) % F.length]); });
    _cnBlackPanel(g, 820, 32, 104, 190, null); _cnT(g, 'EXT DOORS', 872, 46, 11, '#fff'); _cnT(g, 'TEST', 896, 58, 8, '#ccc');
    g.save(); g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(872, 70); g.quadraticCurveTo(882, 80, 882, 110); g.lineTo(906, 120); g.lineTo(906, 128); g.lineTo(882, 128); g.lineTo(880, 190); g.lineTo(894, 200); g.lineTo(850, 200); g.lineTo(864, 190); g.lineTo(862, 128); g.lineTo(838, 128); g.lineTo(838, 120); g.lineTo(862, 110); g.quadraticCurveTo(862, 80, 872, 70); g.stroke(); g.restore();
    [[862, 104], [882, 104], [862, 150], [882, 150], [872, 184]].forEach(([a, b]) => { g.save(); g.fillStyle = '#4a1210'; g.beginPath(); g.arc(a, b, 6, 0, 7); g.fill(); g.restore(); });
  }
  // Universal MFD
  cnNd(g, 360, 296, 314, 302, v);
  // FLAPS(ASYM · RESET · BITE) · STALL/FLAP JOE MODE
  _cnBlackPanel(g, 744, 290, 118, 112); _cnT(g, 'FLAPS', 803, 302, 10, '#ddd'); _cnLamp(g, 768, 312, 70, 18, 'ASYM / FLAPS', false, '#e8231c', 7);
  g.save(); g.fillStyle = '#111'; g.beginPath(); g.arc(780, 366, 13, 0, 7); g.fill(); g.restore(); _cnT(g, 'RESET', 780, 345, 8, '#ddd'); _cnBtn(g, 812, 356, 36, 22, 'BITE', false, 8);
  g.save(); g.fillStyle = '#6a7a80'; g.fillRect(868, 284, 62, 26); g.restore(); _cnT(g, 'STALL/FLAP', 899, 292, 7, '#fff'); _cnT(g, 'JOE MODE', 899, 302, 7, '#fff');
  _cnBtn(g, 876, 318, 46, 28, 'ENABLE', false, 8); _cnBtn(g, 876, 358, 46, 28, 'FLAP 23 DIS', false, 7);
  // 착륙장치 — 세 초록등 · 레버(빨간 바퀴 손잡이)
  const tr = v.gear > 0.01 && v.gear < 0.99;
  [[796, 436], [767, 468], [826, 468]].forEach(([a, b]) => { g.save(); g.fillStyle = '#1a1c1e'; g.fillRect(a - 14, b - 14, 28, 28); g.fillStyle = v.gear > 0.99 ? '#28e04a' : tr ? '#e8231c' : '#183020'; if (v.gear > 0.99) { g.shadowColor = '#28e04a'; g.shadowBlur = 8; } g.fillRect(a - 11, b - 11, 22, 22); g.restore(); });
  g.save(); g.fillStyle = '#2a2d30'; g.fillRect(752, 508, 80, 124); g.fillStyle = '#0c0d0e'; g.fillRect(784, 520, 16, 100); g.restore();
  _cnT(g, 'UP', 766, 530, 9, '#ddd'); _cnT(g, 'UP', 818, 530, 9, '#ddd'); _cnT(g, 'DOWN', 766, 590, 7, '#ddd'); _cnT(g, 'DOWN', 818, 590, 7, '#ddd');
  const ly = v.gearDn ? 604 : 534;
  g.save(); g.fillStyle = '#c0c4c8'; g.fillRect(788, Math.min(ly, 560), 8, Math.abs(ly - 560) + 6); g.fillStyle = '#d42020'; g.beginPath(); g.ellipse(792, ly, 13, 17, 0, 0, 7); g.fill(); g.restore();
  _cnHit(752, 508, 80, 124, () => cnGearToggle());
  // 연료 · 무게(가운데 아래 작은 판)
  g.save(); g.fillStyle = '#121314'; g.fillRect(864, 420, 120, 84); g.restore();
  _cnT(g, 'FUEL QTY', 924, 432, 9, '#9fd'); _cnT(g, `${Math.round(v.fuel * 2.2046)} LB`, 924, 450, 14, cn.fuelKg < 400 ? '#ffd21a' : '#3cff6a');
  _cnT(g, `GW ${Math.round(cnMassKg() * 2.2046)}`, 924, 470, 11, '#cfd'); _cnT(g, `VS1 ${Math.round(cnVs(1))} KT`, 924, 488, 11, '#cfd');
}

// ══ 글레어실드(그림 1-1-9 · 2000×260) — A · B · C · D · E ══
function _cnAnnGrid(g, x, y, T, cw, ch) {
  T.forEach((row, r) => row.forEach(([t, c, f], i) => {
    const on = _cnAnnTest > performance.now() || (f && f());
    _cnLamp(g, x + i * (cw + 6), y + r * (ch + 5), cw, ch, t, on, c, Math.min(10.5, ch * 0.3));
  }));
}
function cnGlareDraw(g, v) {
  const W = 2000, H = 260;
  g.save(); g.fillStyle = '#4a4d51'; g.beginPath(); g.moveTo(0, H); g.lineTo(140, 6); g.lineTo(W - 140, 6); g.lineTo(W, H); g.closePath(); g.fill(); g.restore();
  // 양 끝 시계
  [60, W - 60].forEach(cx => { _b206Case(g, cx, 110, 34); const d = new Date(); _b206Needle(g, cx, 110, 28, (d.getHours() % 12) * 30 + d.getMinutes() * 0.5, 3); _b206Needle(g, cx, 110, 32, d.getMinutes() * 6, 2); _b206Hub(g, cx, 110, 3); });
  // A(왼쪽) — 주황 4×5 · 빨강/주황 4×5 · TEST/BRIGHT
  g.save(); g.fillStyle = '#1b1c1e'; g.fillRect(104, 14, 640, 236); g.restore();
  _cnAnnGrid(g, 112, 22, CN_ANN_A, 64, 40); _cnAnnGrid(g, 396, 22, CN_ANN_A2, 64, 40);
  _cnT(g, 'TEST', 712, 40, 11, '#ddd'); _cnBtn(g, 695, 52, 34, 34, '◉', _cnAnnTest > performance.now(), 14); _cnHit(695, 52, 34, 34, () => { _cnAnnTest = performance.now() + 3000; _cnRedraw(); });
  _cnT(g, 'BRIGHT', 712, 120, 9, '#ddd'); _cnT(g, 'DIM', 712, 200, 9, '#ddd');
  g.save(); g.translate(-96, 0); const _ox0 = _cnOX; _cnOX -= 96;
  // B — FEATHER SYS
  _cnBlackPanel(g, 852, 14, 150, 236, 'FEATHER SYS');
  const arm = cn.apr && cn.eng[0].run && cn.eng[1].run && cn.pl > 0.6;
  _cnLamp(g, 900, 50, 56, 22, 'ARM', arm, '#28e04a', 12); _cnLamp(g, 900, 76, 56, 22, 'FAIL', !cn.eng[0].run || !cn.eng[1].run, '#e8231c', 12);
  _cnT(g, 'AUTO', 880, 120, 10, '#ddd'); _cnT(g, 'MAN', 960, 120, 10, '#ddd'); _cnT(g, 'CONTROL', 927, 222, 9, '#ddd');
  g.save(); g.fillStyle = '#888'; g.beginPath(); g.arc(927, 180, 18, 0, 7); g.fill(); g.restore();
  // C — 오토파일럿 모드 선택(위 표시 · 단추 열)
  const md = cnApModes();
  _cnBlackPanel(g, 1014, 14, 380, 120);
  g.save(); g.fillStyle = '#060606'; g.fillRect(1030, 24, 348, 30); g.restore();
  [['TRIM', md.trim, '#ffd21a'], ['HDG', md.HDG], ['NAV', md.NAV], ['APPR', md.APPR], ['B/C', md.BC], ['CLM', md.CLIMB], ['ALT', md.ALT], ['VS', md.VS], ['GS', md.GS], ['IAS', md.IAS], ['GA', md.GA], ['DSC', md.DSC], ['AP', cn.ap]].forEach(([t, on, col], i) => _cnT(g, t, 1044 + i * 26.5, 39, 10, on ? (col || '#3cff6a') : '#2c3a30'));
  const bc = [['HDG', 'HDG'], ['NAV', 'NAV'], ['APPR', 'APPR'], ['B/C', 'BC'], ['CLIMB', 'CLIMB'], ['ALT', 'ALT'], ['ALT SEL', 'ASEL'], ['VS', 'VS'], ['IAS', 'IAS'], ['DSC', 'DSC']];
  bc.forEach(([t, k], i) => { const bx = 1034 + (i % 5) * 70, by = 62 + (i / 5 | 0) * 34; _cnBtn(g, bx, by, 60, 26, t, md[k], 12); _cnHit(bx, by, 60, 26, () => cnApMode(k)); });
  // D — YAW ENG · AP ENG · 선회 노브 · SR · 1/2φ · 피치 휠
  _cnBlackPanel(g, 1014, 138, 380, 112);
  g.save(); g.fillStyle = '#060606'; g.fillRect(1030, 146, 348, 22); g.restore();
  _cnT(g, `YAW ${cn.yd ? '' : 'DIS'}   AP ${cn.ap ? '' : 'DIS'}   ${cn.sr ? 'SR' : ''} ${cn.half ? '1/2Ø' : ''}`, 1204, 157, 11, cn.ap ? '#3cff6a' : '#ffd21a');
  _cnBtn(g, 1032, 178, 40, 54, 'YAW\nENG', cn.yd, 9); _cnHit(1032, 178, 40, 54, () => { cn.yd = !cn.yd; _cnRedraw(); });
  _cnBtn(g, 1080, 178, 40, 54, 'AP\nENG', cn.ap, 9); _cnHit(1080, 178, 40, 54, () => cnApEng());
  g.save(); g.fillStyle = '#9aa0a4'; g.beginPath(); g.arc(1190, 204, 30, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.fillRect(1186, 176, 8, 28); g.restore();
  _cnT(g, 'L', 1150, 182, 10, '#ddd'); _cnT(g, 'R', 1230, 182, 10, '#ddd');
  _cnHit(1158, 174, 32, 60, () => applyDelta('hdg', -10)); _cnHit(1190, 174, 32, 60, () => applyDelta('hdg', 10));
  _cnBtn(g, 1248, 176, 32, 24, 'SR', cn.sr, 9); _cnHit(1248, 176, 32, 24, () => { cn.sr = !cn.sr; _cnRedraw(); });
  _cnBtn(g, 1248, 208, 32, 24, '1/2Ø', cn.half, 8); _cnHit(1248, 208, 32, 24, () => { cn.half = !cn.half; _cnRedraw(); });
  g.save(); g.fillStyle = '#7d8388'; g.fillRect(1296, 172, 66, 68); g.strokeStyle = '#444'; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(1300, 180 + i * 6); g.lineTo(1358, 180 + i * 6); g.stroke(); } g.restore();
  _cnT(g, '▲DN', 1329, 168, 9, '#fff'); _cnT(g, '▼UP', 1329, 248, 9, '#fff');
  _cnHit(1296, 172, 66, 34, () => cnPitchWheel(-1)); _cnHit(1296, 206, 66, 34, () => cnPitchWheel(1));
  _cnOX = _ox0; g.restore();
  // E(오른쪽)
  g.save(); g.fillStyle = '#1b1c1e'; g.fillRect(1310, 14, 590, 236); g.restore();
  _cnAnnGrid(g, 1318, 22, CN_ANN_E, 64, 40); _cnAnnGrid(g, 1610, 22, CN_ANN_E2, 64, 40);
}
// 오토파일럿 모드(그림 1-1-9 C) — 이 앱의 상위모드에 잇는다
function cnApModes() {
  const o = {};
  try {
    o.HDG = hdgSelOn && !navApOn; o.NAV = navApOn && !gsOn && !gsArmed; o.APPR = navApOn && (gsOn || gsArmed); o.BC = false;
    o.CLIMB = vsModeOn && selVS >= 1200; o.DSC = vsModeOn && selVS <= -1200; o.VS = vsModeOn && !o.CLIMB && !o.DSC;
    o.ALT = altHoldOn; o.ASEL = !!altArmed; o.GS = gsOn; o.IAS = simModeOn ? simIasOn : iasNsOn; o.GA = cn.ga;
    o.trim = Math.abs(simTrim.pitch || 0) > 15;
  } catch (e) { _swallow(e); }
  return o;
}
function cnApMode(k) {
  try {
    afcsCmd();
    const vsOff = () => { vsModeOn = false; };
    if (k === 'HDG') fcpSync('hdg');
    else if (k === 'NAV') toggleNavAp();
    else if (k === 'APPR') { if (!navApOn) toggleNavAp(); if (!gsOn && !gsArmed) toggleGs(); }
    else if (k === 'BC') { uiToast('B/C(백코스) — 이 앱에서는 NAV 로 잡는다', 'warn'); if (!navApOn) toggleNavAp(); }
    else if (k === 'CLIMB' || k === 'DSC') {
      const on = cnApModes()[k];
      if (altHoldOn) toggleAltHold();
      if (on) vsOff(); else { selVS = k === 'CLIMB' ? 1500 : -1500; vsModeOn = true; }
    }
    else if (k === 'VS') { if (altHoldOn) toggleAltHold(); if (vsModeOn) vsOff(); else { selVS = Math.round((S.vs || 0) / 100) * 100; vsModeOn = true; } }
    else if (k === 'ALT') { vsOff(); toggleAltHold(); }
    else if (k === 'ASEL') { if (typeof altaPush === 'function') altaPush(); }
    else if (k === 'IAS') { vsOff(); fcpSync('ias'); }
    cn.ga = false;
  } catch (e) { _swallow(e); }
  _cnRedraw();
}
// 피치 휠 — VS 면 승강률 100fpm · ALT 면 고도 100ft · 그 밖은 VS 로
function cnPitchWheel(d) {
  try {
    if (altHoldOn) { selAlt = Math.max(0, selAlt + (d < 0 ? -100 : 100)); }
    else { if (!vsModeOn) { selVS = Math.round((S.vs || 0) / 100) * 100; vsModeOn = true; } selVS = Math.max(-3000, Math.min(3000, selVS + (d < 0 ? -100 : 100))); }
  } catch (e) { _swallow(e); }
  _cnRedraw();
}

// ══ 판 한 장(PFD 창 · Cockpit 모드) — 넓으면 셋을 함께, 좁으면 위 탭으로 고른 하나 ══
function cnDraw(g, x, y, w, h) {
  if (!(w > 40 && h > 40)) return;
  const page = cnPage === 'AUTO' ? (w / h > 1.75 ? 'ALL' : 'LH') : cnPage;
  cnDrawPage(g, x, y, w, h, page, true);
}
function cnDrawPage(g, x, y, w, h, page, tabs) {
  const v = cnPanelVals(), [PW, PH] = CNP_SIZE[page] || CNP_SIZE.LH;
  _cnHits = [];
  g.save(); g.fillStyle = '#20262a'; g.fillRect(x, y, w, h);
  const k = Math.min(w / PW, h / PH), tx = x + (w - PW * k) / 2, ty = y + (h - PH * k) / 2;
  g.translate(tx, ty); g.scale(k, k);
  const sub = (ox, oy, fn) => { g.save(); g.translate(ox, oy); _cnOX = ox; _cnOY = oy; fn(g, v); g.restore(); _cnOX = 0; _cnOY = 0; };
  if (page === 'ALL') { sub(0, 0, cnGlareDraw); sub(0, 270, cnLhDraw); sub(1000, 260, cnCtrDraw); }
  else if (page === 'GLR') sub(0, 0, cnGlareDraw);
  else if (page === 'CTR') sub(0, 0, cnCtrDraw);
  else sub(0, 0, cnLhDraw);
  g.restore();
  // 고르는 탭(위 왼쪽 · 화면 픽셀)
  if (tabs) {
    const T = [['AUTO', 'AUTO'], ['ALL', 'ALL'], ['LH', 'LH'], ['CTR', 'CTR'], ['GLR', 'GLARE'], ['PED', 'PED ▸']];
    const bw = Math.max(34, Math.min(60, w / 11)), bh = Math.max(16, Math.min(24, h / 22));
    T.forEach(([kk, t], i) => {
      const bx = x + 4 + i * (bw + 3), by = y + 3, on = kk === cnPage || (kk === 'PED' && _cnPed && _cnPed.style.display === 'flex');
      g.save(); g.fillStyle = on ? '#1d6b34' : 'rgba(20,24,28,0.85)'; g.strokeStyle = on ? '#3cff6a' : '#667'; g.lineWidth = 1; g.fillRect(bx, by, bw, bh); g.strokeRect(bx, by, bw, bh); g.restore();
      _cnT(g, t, bx + bw / 2, by + bh / 2, Math.max(9, bh * 0.5), '#e6e9ec');
      (_cnHits.tabs = _cnHits.tabs || []).push({ x: bx, y: by, w: bw, h: bh, fn: () => kk === 'PED' ? cnPedToggle() : cnPageSet(kk) });
    });
  }
  try { g.canvas._cnHit = { hits: _cnHits, tabs: _cnHits.tabs || [], k, tx, ty }; } catch (e) { _swallow(e); }
  _cnHits = null;
}
function cnDrawTo(canvas, page) { const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); if (page) cnDrawPage(g, 0, 0, canvas.width, canvas.height, page, false); else cnDraw(g, 0, 0, canvas.width, canvas.height); }
// 3D 화면에 겹친 계기(계기 ON) — PFD 하나 · 토크 둘
function cnOverlayDraw(g, x, y, w, h) {
  if (!(w > 40 && h > 40)) return;
  const v = cnPanelVals();
  g.save(); g.clearRect(x, y, w, h);
  const W0 = 600, H0 = 360, k = Math.min(w / W0, h / H0);
  g.translate(x + (w - W0 * k) / 2, y + (h - H0 * k) / 2); g.scale(k, k);
  g.fillStyle = 'rgba(151,170,177,0.82)'; g.fillRect(0, 0, W0, H0);
  cnPfd(g, 40, 40, 300, 270, v);
  [0, 1].forEach(i => { _cnOct(g, 450 + i * 100, 90, 40); b206RoundGauge(g, 450 + i * 100, 90, 40, { lo: 0, hi: 5, maj: 1, min: 0.5, bands: [[0.4, 4.2, '#18c23a'], [4.2, 4.45, '#f2c418']], redline: [4.45], lab: q => q ? String(q) : null, val: v.tq[i] * 0.042, title: ['TORQUE'], ty: -0.1, fs: 8 }); });
  [0, 1].forEach(i => { _cnOct(g, 450 + i * 100, 230, 40); b206RoundGauge(g, 450 + i * 100, 230, 40, { lo: 2, hi: 10, maj: 1, min: 0.5, bands: [[4, 8.2, '#18c23a']], redline: [8.7], lab: q => q % 2 === 0 ? String(q) : null, val: v.itt[i] / 100, title: ['ITT'], ty: -0.1, fs: 8 }); });
  g.restore();
}
// 판을 누르면 — 판 그림 좌표로 되짚어 그 자리 일을 한다(누름은 여기서 끝낸다)
function _cnCanvasHit(ev, c) {
  const H = c && c._cnHit; if (!H) return null;
  const r = c.getBoundingClientRect(); if (!(r.width > 0)) return null;
  const px = (ev.clientX - r.left) * c.width / r.width, py = (ev.clientY - r.top) * c.height / r.height;
  for (const t of H.tabs) if (px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.h) return t;
  const x = (px - H.tx) / H.k, y = (py - H.ty) / H.k;
  for (let i = H.hits.length - 1; i >= 0; i--) { const t = H.hits[i]; if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return Object.assign({ lx: x - t.ox, ly: y - t.oy }, t); }
  return null;
}
if (CN_ON) {
  document.addEventListener('pointerdown', ev => {
    const c = ev.target; if (!c || c.tagName !== 'CANVAS' || !c._cnHit) return;
    const h = _cnCanvasHit(ev, c); if (!h) return;
    ev.stopPropagation(); ev.preventDefault();
    try { h.fn(ev, h.lx, h.ly); } catch (e) { _swallow(e); }
    _cnRedraw();
  }, true);
  document.addEventListener('click', ev => { const c = ev.target; if (c && c.tagName === 'CANVAS' && c._cnHit && _cnCanvasHit(ev, c)) { ev.stopPropagation(); ev.preventDefault(); } }, true);
}

// ══ 페데스탈(그림 1-1-10 · 700×1000) — 끌어서 레버 · 눌러서 스위치 ══
let _cnPed = null, _cnPedDrag = null;
function cnPedToggle(on) {
  if (!_cnPed) _cnPedBuild();
  const show = on === undefined ? _cnPed.style.display !== 'flex' : !!on;
  _cnPed.style.display = show ? 'flex' : 'none';
  if (show) cnPedSync();
}
function _cnPedBuild() {
  const d = document.createElement('div');
  d.id = 'cn-ped';
  d.innerHTML = '<div class="cnp-bar"><b>CN-235 PEDESTAL</b><span class="cnp-k">PgUp/PgDn 파워 · F/Shift+F 플랩 · G 기어 · , . 방향타 트림</span><button data-cnp="close" class="cnp-x">✕</button></div><canvas class="cnp-cv" width="700" height="1000"></canvas>';
  document.body.appendChild(d);
  _cnPed = d;
  d.querySelector('[data-cnp="close"]').addEventListener('click', () => cnPedToggle(false));
  const cv = d.querySelector('canvas');
  const at = ev => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * 700 / r.width, (ev.clientY - r.top) * 1000 / r.height]; };
  cv.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    const [x, y] = at(ev), H = cv._cnPedHits || [];
    for (let i = H.length - 1; i >= 0; i--) {
      const t = H[i];
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
        if (t.drag) { _cnPedDrag = t; try { cv.setPointerCapture(ev.pointerId); } catch (e) { _swallow(e); } t.drag(x, y); }
        else if (t.fn) t.fn(x - t.x, y - t.y);
        cnPedSync(); _cnRedraw(); return;
      }
    }
  });
  cv.addEventListener('pointermove', ev => { if (_cnPedDrag) { const [x, y] = at(ev); _cnPedDrag.drag(x, y); cnPedSync(); } });
  ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { _cnPedDrag = null; }));
}
function cnPedSync() {
  if (!_cnPed || _cnPed.style.display === 'none') return;
  const cv = _cnPed.querySelector('canvas'); if (!cv) return;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
  _cnHits = []; _cnOX = 0; _cnOY = 0;
  cnPedDraw(g);
  cv._cnPedHits = _cnHits; _cnHits = null;
}
const CN_PL_Y = { max: 300, fi: 420, rev: 515 }, CN_CL_Y = { MAX: 360, MIN: 428, START: 462, OFF: 520 };
function _cnPlY(pl) { return pl >= 0 ? CN_PL_Y.fi - pl * (CN_PL_Y.fi - CN_PL_Y.max) : CN_PL_Y.fi + (-pl / 0.3) * (CN_PL_Y.rev - CN_PL_Y.fi); }
function _cnYPl(y) { return y <= CN_PL_Y.fi ? (CN_PL_Y.fi - y) / (CN_PL_Y.fi - CN_PL_Y.max) : -(y - CN_PL_Y.fi) / (CN_PL_Y.rev - CN_PL_Y.fi) * 0.3; }
function cnPedDraw(g) {
  const W = 700, H = 1000;
  g.fillStyle = '#1c1f22'; g.fillRect(0, 0, W, H);
  g.fillStyle = CNP_BG; g.beginPath(); g.moveTo(10, 4); g.lineTo(690, 4); g.lineTo(690, 830); g.lineTo(480, 830); g.lineTo(480, 990); g.lineTo(220, 990); g.lineTo(220, 830); g.lineTo(10, 830); g.closePath(); g.fill();
  // CONSTANT TORQUE · APR · ATC/TCAS
  _cnBlackPanel(g, 40, 30, 200, 232);
  _cnT(g, 'CONSTANT TORQUE', 112, 46, 11, '#fff'); _cnT(g, 'APR', 214, 46, 11, '#fff');
  _cnDig(g, 116, 60, 64, 24, String(cn.ctq), '#ff5a3a'); _cnLamp(g, 60, 60, 28, 28, '', cn.ctqOn, '#e8231c');
  _cnHit(60, 60, 28, 28, () => { cn.ctqOn = !cn.ctqOn; });
  _cnHit(116, 60, 32, 24, () => { cn.ctq = Math.max(200, cn.ctq - 10); }); _cnHit(148, 60, 32, 24, () => { cn.ctq = Math.min(440, cn.ctq + 10); });
  _cnT(g, 'TORQUE SELECT  − / +', 120, 98, 8, '#ccc', false);
  _cnLamp(g, 196, 60, 34, 16, 'ARM', cn.apr, '#28e04a', 9); _cnLamp(g, 196, 78, 34, 14, 'FAIL', false, '#e8231c', 8); _cnHit(196, 60, 34, 32, () => { cn.apr = !cn.apr; });
  _cnLamp(g, 196, 104, 34, 14, 'L ENG', cn.apr && !cn.eng[0].run, '#f39a1f', 8); _cnLamp(g, 196, 120, 34, 14, 'R ENG', cn.apr && !cn.eng[1].run, '#f39a1f', 8);
  g.save(); g.fillStyle = '#5b6871'; g.fillRect(58, 148, 92, 96); g.fillStyle = '#123a8a'; g.fillRect(66, 158, 76, 24); g.restore();
  let xp = '7000'; try { if (typeof xpdrCode !== 'undefined') xp = String(xpdrCode); } catch (e) { _swallow(e); }
  _cnT(g, 'ATC/TCAS', 104, 152, 7, '#fff'); _cnT(g, xp, 104, 170, 14, '#9cf');
  // NAV · COM 넷
  const freq = k => { try { const r = navRadios && navRadios[k]; if (r && r.freq) return String(r.freq); } catch (e) { _swallow(e); } return ''; };
  [['NAV', 'NAV1'], ['NAV', 'NAV2'], ['COM', 'COM1'], ['COM', 'COM2']].forEach(([t, k], i) => {
    const bx = 252 + (i % 2) * 96, by = 30 + (i / 2 | 0) * 108; _cnBlackPanel(g, bx, by, 90, 100);
    _cnDig(g, bx + 8, by + 10, 74, 26, freq(k).slice(0, 7), '#ff7a3a'); _cnT(g, t, bx + 70, by + 46, 9, '#fff');
    g.save(); g.fillStyle = '#9aa'; [bx + 24, bx + 66].forEach(cx => { g.beginPath(); g.arc(cx, by + 72, 12, 0, 7); g.fill(); }); g.restore();
  });
  // UNIVERSAL CDU(누르면 CDU 를 연다)
  _cnBlackPanel(g, 446, 90, 200, 190); _cnT(g, 'UNIVERSAL', 546, 106, 11, '#fff');
  g.save(); g.fillStyle = '#05070a'; g.fillRect(486, 118, 120, 76); g.restore(); _cnT(g, 'FMS', 546, 156, 14, '#3cff6a');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { g.save(); g.fillStyle = '#3d4246'; g.fillRect(466 + c * 16.5, 204 + r * 17, 13, 13); g.restore(); }
  _cnHit(446, 90, 200, 190, () => { try { if (typeof toggleCduOverlay === 'function') toggleCduOverlay(); } catch (e) { _swallow(e); } });
  // EMER & PARK BR(왼쪽 빨간 손잡이)
  g.save(); g.fillStyle = '#121314'; g.fillRect(52, 280, 88, 288); g.fillStyle = '#000'; g.fillRect(90, 320, 12, 210); g.restore();
  const park = cnPark(), py = park ? 330 : 420;
  g.save(); g.fillStyle = '#c81c1c'; g.fillRect(58, py, 88, 36); g.restore(); _cnT(g, 'EMER & PARK BR', 102, py + 12, 9, '#fff');
  _cnHit(52, 280, 88, 288, () => cnParkToggle());
  // GUST LOCK
  g.save(); g.fillStyle = cn.gust ? '#c8c8c8' : '#555'; g.beginPath(); g.ellipse(166, cn.gust ? 372 : 352, 18, 20, 0, 0, 7); g.fill(); g.restore();
  _cnT(g, 'GUST LOCK', 168, 404, 9, '#fff'); _cnT(g, cn.gust ? 'LOCK' : '← REL', 168, 416, 8, cn.gust ? '#ffd21a' : '#ccc');
  _cnHit(146, 330, 44, 92, () => { cn.gust = !cn.gust; try { uiToast(cn.gust ? 'GUST LOCK — 조종면 묶임 · 파워 FLT IDLE 위로 못 올린다' : 'GUST LOCK REL', cn.gust ? 'warn' : ''); } catch (e) { _swallow(e); } });
  // 파워 레버 둘(끌기 — MAX POWER · FLT IDLE · GND IDLE · REV)
  g.save(); g.fillStyle = '#111'; g.fillRect(196, 286, 196, 254); g.restore();
  _cnT(g, 'MAX', 300, 296, 9, '#fff'); _cnT(g, 'POWER', 300, 306, 9, '#fff'); _cnT(g, 'FLT IDLE', 232, CN_PL_Y.fi - 8, 8, '#fff'); _cnT(g, 'GND IDLE', 232, CN_PL_Y.fi + 26, 8, '#fff'); _cnT(g, 'REV', 232, CN_PL_Y.rev - 6, 9, '#fff');
  g.save(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(250, CN_PL_Y.fi + 32 + i * 8); g.lineTo(284, CN_PL_Y.fi + 32 + i * 8); g.stroke(); } g.restore();
  _cnT(g, 'POWER', 300, 534, 9, '#fff');
  const plY = _cnPlY(cn.pl);
  [258, 334].forEach(cx => {
    g.save(); g.fillStyle = '#000'; g.fillRect(cx - 4, 296, 8, 230);
    const gr = g.createLinearGradient(cx - 30, 0, cx + 30, 0); gr.addColorStop(0, '#8c9196'); gr.addColorStop(0.5, '#eef0f2'); gr.addColorStop(1, '#7d8287');
    g.fillStyle = gr; g.fillRect(cx - 30, plY - 20, 60, 40); g.restore();
  });
  _cnHit(196, 286, 196, 254, null, (x, y) => { cn.pl = Math.max(cn.onGnd ? -0.3 : 0, Math.min(cn.gust ? 0.12 : 1, _cnYPl(y))); });
  _cnLamp(g, 302, 470, 22, 16, 'OFF', false, '#e8231c', 7); _cnT(g, 'FI SOL', 314, 492, 7, '#fff'); _cnT(g, 'PROP', 314, 516, 7, '#fff'); _cnT(g, 'SYNC', 314, 524, 7, '#fff');
  // 컨디션 레버 둘(끌기 — MAX RPM · MIN RPM · START · FUEL OFF/FEATHER)
  g.save(); g.fillStyle = '#111'; g.fillRect(394, 286, 140, 254); g.restore();
  [['MAX RPM', 'MAX'], ['MIN RPM', 'MIN'], ['START', 'START'], ['FUEL OFF', 'OFF']].forEach(([t, k]) => _cnT(g, t, 464, CN_CL_Y[k], 8, '#fff'));
  g.save(); g.fillStyle = '#d33'; g.fillRect(398, 296, 18, 18); g.fillRect(512, 296, 18, 18); g.restore(); _cnT(g, 'T/IN IN-OUT', 464, 310, 8, '#fff');
  [[416, 0], [512, 1]].forEach(([cx, i]) => {
    const yy = CN_CL_Y[cn.cond[i]] || CN_CL_Y.MAX;
    g.save(); g.fillStyle = '#000'; g.fillRect(cx - 3, 300, 6, 230);
    const gr = g.createLinearGradient(cx - 20, 0, cx + 20, 0); gr.addColorStop(0, '#6c7176'); gr.addColorStop(0.5, '#d6d9dc'); gr.addColorStop(1, '#5c6166');
    g.fillStyle = gr; g.fillRect(cx - 20, yy - 16, 40, 32); g.restore();
    _cnHit(cx - 28, 286, 56, 254, null, (x, y) => { let best = 'MAX', bd = 1e9; for (const [k, yy2] of Object.entries(CN_CL_Y)) { const dd = Math.abs(yy2 - y); if (dd < bd) { bd = dd; best = k; } } if (cn.cond[i] !== best) cnCondSet(i, best); });
  });
  _cnT(g, 'PROP RPM', 464, 534, 9, '#fff');
  // 플랩 레버(UP · T/OFF · APPR · LNDG)
  g.save(); g.fillStyle = '#111'; g.fillRect(536, 460, 66, 82); g.restore();
  const fn = CN_P.flapName, fl = [0, 10, 15, 23];
  fl.forEach((f, i) => { _cnT(g, fn[f], 588, 470 + i * 18, 8, cn.flapSel === f ? '#3cff6a' : '#fff'); _cnHit(570, 462 + i * 18, 34, 17, () => cnFlapSet(f)); });
  _cnT(g, 'FLAPS', 548, 500, 8, '#fff');
  g.save(); g.fillStyle = '#cfd3d6'; g.fillRect(552, 466 + fl.indexOf(cn.flapSel) * 18, 16, 14); g.restore();
  // 착륙장치 비상(빨간 손잡이 · 덮개)
  g.save(); g.fillStyle = '#202224'; g.fillRect(560, 290, 120, 160); g.fillStyle = '#b81b1b'; g.fillRect(572, 360, 96, 74); g.restore();
  _cnT(g, 'LANDING GEAR', 620, 376, 9, '#fff'); _cnT(g, 'EMERGENCY', 620, 388, 9, '#fff'); _cnT(g, 'DOWN', 620, 400, 9, '#fff'); _cnT(g, 'OPEN DOOR', 620, 418, 7, '#fff');
  _cnHit(560, 290, 120, 160, () => { cnGearSet(true); try { uiToast('LANDING GEAR EMERGENCY DOWN — 착륙장치 내림', 'warn'); } catch (e) { _swallow(e); } });
  // 아래 — 범위 · 속도 · 코스 노브(겉모양) · V/UHF · 기상 레이다
  _cnBlackPanel(g, 40, 548, 620, 120);
  ['RANGE', 'NAV-BRG', 'BARO SET', 'SPEED', 'ALT PRESEL', 'SPEED', 'RANGE', 'NAV-BRG', 'BARO SET'].forEach((t, i) => { const cx = 70 + i * 68; g.save(); g.fillStyle = '#555'; g.beginPath(); g.arc(cx, 600, 15, 0, 7); g.fill(); g.restore(); _cnT(g, t, cx, 576, 7, '#ddd', false); });
  ['CRS', 'HDG', 'CRS'].forEach((t, i) => { const cx = 270 + i * 70; g.save(); g.fillStyle = '#555'; g.beginPath(); g.arc(cx, 646, 13, 0, 7); g.fill(); g.restore(); _cnT(g, t, cx, 628, 7, '#ddd', false); });
  _cnHit(256, 632, 28, 28, () => applyDelta('crs', -1)); _cnHit(326, 632, 28, 28, () => applyDelta('hdg', 1)); _cnHit(396, 632, 28, 28, () => applyDelta('crs', 1));
  _cnBlackPanel(g, 40, 672, 186, 150, 'V/UHF'); _cnBlackPanel(g, 474, 672, 186, 150, 'WX RADAR');
  // RUDDER TRIM · MUTE WRN LDG GR · EMER TRIMS · FLT CONS DISC · ANTISKID
  _cnBlackPanel(g, 230, 672, 240, 312);
  _cnT(g, 'RUDDER TRIM', 300, 690, 10, '#fff'); _cnT(g, 'L', 270, 704, 9, '#fff'); _cnT(g, 'R', 330, 704, 9, '#fff');
  g.save(); g.translate(300, 730); g.rotate(cn.rudTrim * 0.8); g.fillStyle = '#a7acb0'; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.fillStyle = '#eee'; g.fillRect(-4, -24, 8, 22); g.restore();
  _cnHit(272, 704, 28, 56, () => cnRudTrim(-0.05)); _cnHit(300, 704, 28, 56, () => cnRudTrim(0.05));
  _cnT(g, 'MUTE  WRN', 410, 690, 10, '#fff'); _cnT(g, 'LDG GR', 410, 702, 10, '#fff');
  g.save(); g.fillStyle = cn.mute ? '#ffd21a' : '#000'; g.beginPath(); g.arc(410, 728, 10, 0, 7); g.fill(); g.strokeStyle = '#888'; g.stroke(); g.restore(); _cnHit(396, 714, 28, 28, () => { cn.mute = !cn.mute; });
  _cnT(g, 'EMER TRIMS', 290, 772, 9, '#fff'); _cnT(g, 'FLT CONS DISC', 404, 772, 9, '#fff');
  [['AILERON', 800, 'L', 'R', () => simTrimNudge('L', true), () => simTrimNudge('R', true)], ['ELEVATOR', 860, 'DN', 'UP', () => simTrimNudge('F', true), () => simTrimNudge('A', true)], ['RUDDER', 924, 'L', 'R', () => cnRudTrim(-0.05), () => cnRudTrim(0.05)]].forEach(([t, yy, a, b, fa, fb]) => {
    _cnT(g, t, 290, yy - 10, 8, '#fff'); g.save(); g.fillStyle = '#c42020'; g.beginPath(); g.ellipse(290, yy + 8, 26, 11, 0, 0, 7); g.fill(); g.restore();
    _cnT(g, a, 262, yy + 24, 8, '#fff'); _cnT(g, b, 318, yy + 24, 8, '#fff');
    _cnHit(262, yy, 28, 22, () => { try { if (simModeOn) fa(); else if (t === 'RUDDER') fa(); } catch (e) { _swallow(e); } });
    _cnHit(290, yy, 28, 22, () => { try { if (simModeOn) fb(); else if (t === 'RUDDER') fb(); } catch (e) { _swallow(e); } });
  });
  _cnT(g, 'ROLL', 404, 790, 8, '#fff'); g.save(); g.fillStyle = '#c42020'; g.fillRect(380, 798, 50, 18); g.fillRect(398, 836, 16, 40); g.restore(); _cnT(g, 'PITCH', 404, 828, 8, '#fff');
  _cnT(g, 'ANTISKID', 404, 900, 9, '#fff');
  g.save(); g.strokeStyle = '#ddd'; g.lineWidth = 4; g.beginPath(); g.moveTo(404, 932); g.lineTo(404 + (cn.antiskid ? 0 : -12), cn.antiskid ? 912 : 940); g.stroke(); g.restore();
  _cnT(g, cn.antiskid ? 'ON' : 'OFF', 436, 928, 9, cn.antiskid ? '#3cff6a' : '#ffd21a'); _cnT(g, 'TEST', 404, 962, 8, '#fff');
  _cnHit(384, 904, 40, 50, () => { cn.antiskid = !cn.antiskid; });
  // 지금 값(아래)
  _cnT(g, `PL ${Math.round(cn.pl * 100)}% · TQ ${Math.round(cnTqAvg())}% · ${cn.cond[0]}/${cn.cond[1]} · FLAP ${CN_P.flapName[cn.flapSel]} · GEAR ${cn.gearPos > 0.99 ? 'DN' : cn.gearPos < 0.01 ? 'UP' : 'TRANSIT'}`, 350, 1000 - 6, 11, '#e6e6e6', false);
}
setInterval(() => { try { if (CN_ON) cnPedSync(); } catch (e) { _swallow(e); } }, 250);
setInterval(() => { try { if (CN_ON && cn.apWarn > 0) cn.apWarn = Math.max(0, cn.apWarn - 0.25); } catch (e) { _swallow(e); } }, 250);

// ══ 키 · 조이스틱(조종간 단추 — 그림 1-1-14) ══
//   Z  AP(오토파일럿 끊기) · X  GA(복행) · C  SYN(누르는 동안 — FORCE TRIM 처럼 모드 기준을 지금 값으로) · V  PTT(누르는 동안)
//   G 착륙장치 · F / Shift+F 플랩 · PgUp / PgDn 파워 · , . 방향타 트림 · P 페데스탈 · 방향키 승강타(▲▼) · 도움날개(◀▶) 트림
if (CN_ON) {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    try { if (typeof kbdShortcuts !== 'undefined' && !kbdShortcuts) return; if (typeof joyKeyOwned === 'function' && joyKeyOwned(e)) return; } catch (er) { _swallow(er); }
    const k = e.key;
    if (k === 'g' || k === 'G') { if (!e.repeat) cnGearToggle(); }
    else if (k === 'f') cnFlapStep(1);
    else if (k === 'F') cnFlapStep(-1);
    else if (k === 'PageUp') cn.pl = Math.min(cn.gust ? 0.12 : 1, cn.pl + 0.05);
    else if (k === 'PageDown') cn.pl = Math.max(cn.onGnd ? -0.3 : 0, cn.pl - 0.05);
    else if (k === 'p' || k === 'P') { if (!e.repeat) cnPedToggle(); }
    else if (k === 'z' || k === 'Z') { if (!e.repeat) cnApDisc(); }
    else if (k === 'x' || k === 'X') { if (!e.repeat) cnGa(); }
    else if (k === 'c' || k === 'C') { if (!e.repeat) { try { forceTrim(); } catch (er) { _swallow(er); } } }
    else if (k === 'v' || k === 'V') { if (!e.repeat) { try { radioPtt(true); } catch (er) { _swallow(er); } } }
    else if (k === ',') cnRudTrim(-0.05);
    else if (k === '.') cnRudTrim(0.05);
    else return;
    e.preventDefault(); _cnRedraw();
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'c' || e.key === 'C') { try { forceTrimRelease(); } catch (er) { _swallow(er); } }
    if (e.key === 'v' || e.key === 'V') { try { radioPtt(false); } catch (er) { _swallow(er); } }
  });
  try {
    if (typeof JOY_ACTIONS !== 'undefined') {
      const A = [
        { id: 'cnAp', grp: 'CN-235 조종간', label: 'AP (오토파일럿 끊기)', kind: 'press', run: () => cnApDisc() },
        { id: 'cnApEng', grp: 'CN-235 조종간', label: 'AP ENG (오토파일럿 걸기 · 끊기)', kind: 'press', run: () => cnApEng() },
        { id: 'cnGa', grp: 'CN-235 조종간', label: 'GA (복행)', kind: 'press', run: () => cnGa() },
        { id: 'cnSyn', grp: 'CN-235 조종간', label: 'SYN (누르는 동안 — 모드 기준 맞춤)', kind: 'hold', on: () => forceTrim(), off: () => forceTrimRelease() },
        { id: 'cnGear', grp: 'CN-235 조종간', label: '착륙장치 올림 · 내림', kind: 'press', run: () => cnGearToggle() },
        { id: 'cnFlapDn', grp: 'CN-235 조종간', label: '플랩 내림(한 칸)', kind: 'press', run: () => cnFlapStep(1) },
        { id: 'cnFlapUp', grp: 'CN-235 조종간', label: '플랩 올림(한 칸)', kind: 'press', run: () => cnFlapStep(-1) },
        { id: 'cnPlUp', grp: 'CN-235 조종간', label: '파워 레버 +', kind: 'repeat', run: () => { cn.pl = Math.min(cn.gust ? 0.12 : 1, cn.pl + 0.02); } },
        { id: 'cnPlDn', grp: 'CN-235 조종간', label: '파워 레버 −', kind: 'repeat', run: () => { cn.pl = Math.max(cn.onGnd ? -0.3 : 0, cn.pl - 0.02); } },
        { id: 'cnRudL', grp: 'CN-235 조종간', label: '방향타 트림 ◀', kind: 'repeat', run: () => cnRudTrim(-0.05) },
        { id: 'cnRudR', grp: 'CN-235 조종간', label: '방향타 트림 ▶', kind: 'repeat', run: () => cnRudTrim(0.05) },
      ];
      A.forEach(a => { if (!JOY_ACT_BY_ID[a.id]) { JOY_ACTIONS.push(a); JOY_ACT_BY_ID[a.id] = a; } });
    }
  } catch (e) { _swallow(e); }
}

// ══ 조종간(요크 · 그림 1-1-14) — 창 탭 CYC·COLL 칸 · 3D 조종석 아래 ══
//   왼쪽 뿔 위: 승강타 트림(위아래 흔들 스위치) · 도움날개 트림(옆) · AP(빨강) · GA(빨강) · PTT · 오른쪽 뿔: SYN
function _cnYokeG(id) {
  const B = (k, cx, cy, r, col, t) => `<g data-cnk="${k}" style="cursor:pointer;pointer-events:auto"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="#222" stroke-width="1.5"/><text x="${cx}" y="${cy + 3.5}" font-size="9" font-weight="bold" text-anchor="middle" fill="#fff">${t}</text></g>`;
  const R = (k, x, y, w, h, t) => `<g data-cnk="${k}" style="cursor:pointer;pointer-events:auto"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#3a3d40" stroke="#111"/><text x="${x + w / 2}" y="${y + h / 2 + 3.5}" font-size="9" font-weight="bold" text-anchor="middle" fill="#fff">${t}</text></g>`;
  return `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d3d6d9"/><stop offset="1" stop-color="#8b9095"/></linearGradient></defs>
    <path d="M30 70 C18 26 54 8 74 30 L92 96 C110 120 190 120 208 96 L226 30 C246 8 282 26 270 70 C262 130 214 170 150 172 C86 170 38 130 30 70 Z" fill="url(#${id})" stroke="#5f6468" stroke-width="2.5"/>
    <path d="M108 106 H192 L198 210 H102 Z" fill="url(#${id})" stroke="#5f6468" stroke-width="2.5"/>
    <rect x="118" y="112" width="64" height="34" rx="6" fill="#9ea3a7" stroke="#666"/><circle cx="138" cy="129" r="9" fill="#e4e6e8" stroke="#777"/><circle cx="162" cy="129" r="9" fill="#e4e6e8" stroke="#777"/>
    <text x="150" y="182" font-size="20" font-weight="bold" font-style="italic" text-anchor="middle" fill="#fff">CN235</text>
    ${R('etU', 46, 2, 30, 14, '▲UP')}${R('etD', 46, 17, 30, 14, '▼DN')}${R('atL', 10, 36, 20, 16, '◀')}${R('atR', 82, 36, 20, 16, '▶')}
    ${B('ga', 56, 52, 9, '#c81c1c', 'GA')}${B('ap', 76, 60, 9, '#c81c1c', 'AP')}${R('ptt', 86, 78, 26, 14, 'PTT')}${R('syn', 238, 40, 30, 14, 'SYN')}`;
}
function cnYokeHtml() {
  const st = `AP ${cn.ap ? 'ENG' : 'DIS'} · ${cn.ga ? 'GA · ' : ''}ELEV TRIM ${(-(simTrim.pitch || 0)).toFixed(1)} · AIL TRIM ${(simTrim.roll || 0).toFixed(1)} · RUD TRIM ${(cn.rudTrim * 10).toFixed(1)}`;
  return `<div class="grip-row"><div class="grip-cell"><div class="grip-t">CONTROL WHEEL (LH)</div><div><svg viewBox="0 0 300 214" width="300" height="214" xmlns="http://www.w3.org/2000/svg">${_cnYokeG('cnyk-g')}</svg></div>
    <div class="grip-t" style="font-weight:normal">${st}</div></div>
    <div class="grip-cell"><div class="grip-t">키 · 조이스틱</div><div style="font-size:11px;line-height:1.6;text-align:left;color:#cfd8de">
    Z AP 끊기 · X GA 복행 · C SYN(누르는 동안)<br>V PTT(누르는 동안) · 방향키 ▲▼ 승강타 · ◀▶ 도움날개 트림<br>, . 방향타 트림 · PgUp/PgDn 파워 · F 플랩 · G 기어</div></div></div>`;
}
// 3D 조종석(15-heli3d.js _ckpitEl) — 계기판 앞 양쪽 요크(단추는 눌린다)
function cnYokeSvgCk() {
  return `<svg class="ck-yokes" viewBox="0 0 1600 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none">
    <g transform="translate(332 772) scale(0.78)">${_cnYokeG('cnyk-l')}</g><g transform="translate(1036 772) scale(0.78)">${_cnYokeG('cnyk-r')}</g></svg>`;
}
function cnYokePress(k, down) {
  const trim = { etU: 'A', etD: 'F', atL: 'L', atR: 'R' }[k];
  try {
    if (trim) { if (down) startTrimHold(trim); else stopTrimHold(); }
    else if (k === 'ap' && down) cnApDisc();
    else if (k === 'ga' && down) cnGa();
    else if (k === 'ptt') radioPtt(!!down);
    else if (k === 'syn') { if (down) forceTrim(); else forceTrimRelease(); }
  } catch (e) { _swallow(e); }
  _cnRedraw();
}
if (CN_ON) {
  document.addEventListener('pointerdown', e => {
    const t = e.target && e.target.closest && e.target.closest('[data-cnk]'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    const k = t.dataset.cnk; cnYokePress(k, true);
    const up = () => { cnYokePress(k, false); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true); };
    document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
    try { if (typeof gripPanelRender === 'function') setTimeout(() => gripPanelRender(true), 30); } catch (er) { _swallow(er); }
  }, true);
  document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('[data-cnk]')) { e.preventDefault(); e.stopPropagation(); } }, true);
}
