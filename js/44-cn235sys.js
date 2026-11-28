'use strict';
// ══════════════════════════════════════════════════════
// CN-235 계통 · 성능 한계 — 오버헤드 패널(AOM 그림 1-1-11) · 회로차단기(1-1-15) · 좌우 콘솔(1-1-12 · 13) · 무게 · 무게중심
//
// 성능 제원(CN235-110 AFM · AOM):
//   무게   MTOW 14,400kg · 램프 14,450 · MLW 14,200 · MZFW 13,600 · 최소 8,700 · 무게중심 16~30% MAC
//   속도   VMO 230/200/180(해면/20,000/25,000ft) · VA 160 · VFE 160 · VLE 150 · 타이어 139kt(지상속도) · 역추력 120KIAS 까지
//   엔진   CT7-9C 1,750SHP(APR — 한 엔진 불능 1,870SHP) · 이륙 토크 424 · ITT 921~950°C(5분)
//   연료   주 탱크 좌우 819kg · 보조 탱크 좌우 1,276kg · 쓸 수 있는 연료 4,190kg
//   착륙   측풍 20kt(넘으면 플랩 15) · 접지 강하율 600fpm
//
// 계통(오버헤드 · 콘솔 스위치가 실제로 듣는다):
//   전기   BAT · GEN 1/2(엔진이 돌아야) · 인버터 — 전원이 없으면 EFIS(PFD · MFD)가 꺼지고 AP 가 풀린다
//   연료   펌프 · SHUT-OFF VALVE(닫으면 그 엔진 멎음) · X-FEED · 보조 → 주 탱크 옮김(GRAVITY · PRESS XFR)
//   시동   ENGINE START MODE(BAT/GPU) · START — 컨디션 레버 START 이상 · 연료 밸브 열림이면 NG 가 올라 점화
//   유압   엔진 구동 펌프 1/2 — 없으면 플랩 · 착륙장치(비상 내림은 됨) · 앞바퀴 조향 · 화물문이 듣지 않는다
//   여압   HP VALVES · 팩 · AUTO/MAN · PRESS DUMP — 객실 고도(차압 3.6psi) · 10,000ft 넘으면 CABIN ALTITUDE
//   방빙   WING & TAIL · PROP DE-ICE · PITOT — 결빙 조건(29-env.js)에서 끄면 날개 착빙(최대 양력 ↓ · 항력 ↑) · 프로펠러 착빙 · 속도계 굳음
//   조명   NAV · A/COLLISION · LANDING · TAXI — 3D 모형 날개 끝 · 꼬리 · 충돌방지등(15-heli3d.js)
//   그 밖  CARGO DOOR(열면 항력 · DOOR UNLOCKED) · STALL TEST · ANN LT BRT/DIM · WIPER · 앞바퀴 조향 손잡이(WHL STEER)
// ══════════════════════════════════════════════════════
const CNS = { mtow: 14400, ramp: 14450, mlw: 14200, mzfw: 13600, minW: 8700, vTire: 139, vRev: 120, mainKg: 819, auxKg: 1276, xwMax: 20, tdMax: 600, cgFwd: 16, cgAft: 30, diffPsi: 3.6 };
// ── 연료 탱크(주 · 보조 좌우) — cn.fuelKg 는 넷의 합(넣으면 주 탱크부터 채운다) ──
cn.tank = { mL: 819, mR: 819, aL: 600, aR: 600 };
Object.defineProperty(cn, 'fuelKg', {
  configurable: true,
  get() { const t = cn.tank; return t.mL + t.mR + t.aL + t.aR; },
  set(v) {
    let r = Math.max(0, Math.min(2 * (CNS.mainKg + CNS.auxKg), +v || 0));
    const m = Math.min(CNS.mainKg, r / 2); r -= 2 * m; const a = Math.min(CNS.auxKg, r / 2);
    cn.tank = { mL: m, mR: m, aL: a, aR: a };
  },
});
// ── 스위치(오버헤드 · 콘솔) — 정상 비행 위치로 시작 ──
cn.ov = {
  bat: true, gen1: true, gen2: true, inv1: true, inv2: true, invS: false, gpu: false,
  fpL: true, fpR: true, sovL: true, sovR: true, xfeed: false, gxL: true, gxR: true, pxL: true, pxR: true,
  startMode: 'BAT', ignL: false, ignR: false, fireL: false, fireR: false,
  hyd1: true, hyd2: true, propBrake: false,
  bleedL: true, bleedR: true, packL: true, packR: true, apuX: false, pressMode: 'AUTO', dump: false, ldgAlt: 0,
  cargo: 'CLOSE', propDeice: 'OFF', wshL: true, wshR: true, aoaL: true, aoaR: true, pitotL: true, pitotAux: true, pitotR: true,
  wingTail: false, iceDet: true, inletL: false, inletR: false,
  land: false, taxi: false, nav: true, acol: true, logo: false, wingInsp: false, turnoff: false,
  emerLt: 'ARM', annLt: 'BRT', mkr: 'HIGH', wiper: 'OFF', cvr: true, whlSteer: true, radAlt: true, footHeat: false, taws: true, flapOvrd: false,
};
cn.cb = {};               // 뽑은 회로차단기(이름 → true)
cn.cabAlt = 0; cn.cabRate = 0; cn.ice = 0; cn.propIce = 0; cn.tiller = 0;
function cnCbOk(k) { return !cn.cb[k]; }
function cnElecOn() { const o = cn.ov; return !!(o.bat || o.gpu || (o.gen1 && cn.eng[0].run) || (o.gen2 && cn.eng[1].run)); }
function cnEfisOk(k) { return cnElecOn() && cnCbOk(k); }
function cnHydPsi() { const o = cn.ov; return (o.hyd1 && cn.eng[0].ng > 50 ? 3000 : 0) || (o.hyd2 && cn.eng[1].ng > 50 ? 3000 : 0); }
function cnHydOk() { return cnHydPsi() > 1500; }
// 연료가 끊겼나 — SHUT-OFF VALVE · FIRE 손잡이 · 그쪽(또는 X-FEED 로 양쪽) 주 탱크 바닥
function cnFuelCut(i) {
  const o = cn.ov, t = cn.tank, sov = i ? o.sovR : o.sovL, fire = i ? o.fireR : o.fireL;
  const main = o.xfeed ? t.mL + t.mR : (i ? t.mR : t.mL);
  return !sov || fire || main <= 0.5;
}
// 태우기 — 그쪽 주 탱크에서(X-FEED 면 양쪽 반씩) · 보조 탱크는 XFR(GRAVITY · PRESS)이 켜져 있으면 주 탱크로 옮겨 채운다
function cnBurn(i, kg) {
  const t = cn.tank, o = cn.ov;
  if (o.xfeed) { const h = kg / 2; t.mL = Math.max(0, t.mL - h); t.mR = Math.max(0, t.mR - h); }
  else if (i) t.mR = Math.max(0, t.mR - kg); else t.mL = Math.max(0, t.mL - kg);
}
function _cnXfrStep(dt) {
  const t = cn.tank, o = cn.ov, rate = 0.5 * dt;          // 보조 → 주(kg/s)
  [['aL', 'mL', o.gxL || (o.pxL && cnElecOn())], ['aR', 'mR', o.gxR || (o.pxR && cnElecOn())]].forEach(([a, m, on]) => {
    if (!on || t[a] <= 0 || t[m] >= CNS.mainKg - 1) return;
    const d = Math.min(t[a], rate, CNS.mainKg - t[m]); t[a] -= d; t[m] += d;
  });
}
// 시동 — 엔진이 멎어 있을 때(42-cn235.js cnEngStep 이 부른다). START 를 누르면 NG 가 오르고 12% 에서 점화 · 60% 에서 FLY
function cnStartStep(e, i, dt) {
  const o = cn.ov, okPwr = (o.startMode === 'BAT' && o.bat) || (o.startMode === 'GPU' && o.gpu);
  if (e.starting && !(okPwr && cnCbOk('START'))) e.starting = false;
  if (e.starting) {
    const lit = e.ng > 12 && cn.cond[i] !== 'OFF' && !cnFuelCut(i);
    e.ng = Math.min(70, e.ng + (lit ? 2.6 : 1.4) * dt);
    e.itt += ((lit ? 640 + 4 * Math.max(0, 40 - e.ng) : 60) - e.itt) * Math.min(1, dt / 2);
    e.np += ((lit ? e.ng * 0.9 : e.ng * 0.3) - e.np) * Math.min(1, dt / 2);
    e.ff = lit ? 90 : 0; e.tq = lit ? 5 : 0;
    if (lit && e.ng >= 60) { e.run = true; e.starting = false; try { uiToast(`#${i + 1} ENG START — 시동 완료`, 'ok'); } catch (er) { _swallow(er); } }
    if (!lit && e.ng >= 25 && cn.cond[i] === 'OFF') { /* 크랭킹만 */ }
  } else {
    e.ng = Math.max(0, e.ng - 6 * dt); e.np = Math.max(0, e.np - (o.propBrake && i === 1 ? 20 : 8) * dt); e.itt += (30 - e.itt) * Math.min(1, dt / 8); e.tq = 0; e.ff = 0;
  }
}
function cnStart(i) {
  const e = cn.eng[i], o = cn.ov;
  if (e.run) { try { uiToast(`#${i + 1} 엔진은 이미 돌고 있다`, ''); } catch (er) { _swallow(er); } return; }
  if (o.startMode === 'OFF') { try { uiToast('ENGINE START MODE SEL — BAT 또는 GPU', 'warn'); } catch (er) { _swallow(er); } return; }
  if (cn.cond[i] === 'OFF') { try { uiToast(`컨디션 레버 #${i + 1} 을 START 로(페데스탈)`, 'warn'); } catch (er) { _swallow(er); } }
  e.starting = true;
}

// ── 한 걸음(fwFly · fwKinStep 이 부른다) — 전기 · 여압 · 착빙 · 피토 · 타이어 · 조향 ──
let _cnTireWarn = false;
function cnSysStep(dt) {
  if (!(dt > 0)) return;
  const o = cn.ov;
  _cnXfrStep(dt);
  // 전원이 없으면 AP 가 풀린다
  if (!cnElecOn() || !cnCbOk('FD/AP')) { if (cn.ap) { try { cnApDisc(); } catch (e) { _swallow(e); } } }
  // 여압 — 엔진 추기(HP VALVE) · 팩 · AUTO · 덤프 아님 · 화물문 닫힘이면 차압 3.6psi 까지 · 아니면 바깥 고도로(분당 2,000ft)
  const psi = h => 14.696 * Math.pow(Math.max(0.01, 1 - 6.8756e-6 * h), 5.2559), altOf = p => (1 - Math.pow(p / 14.696, 1 / 5.2559)) / 6.8756e-6;
  const bleed = (o.bleedL && cn.eng[0].run) || (o.bleedR && cn.eng[1].run) || (o.apuX && cn.eng[1].run);
  const press = bleed && (o.packL || o.packR) && !o.dump && o.cargo === 'CLOSE';
  let tgt = S.alt || 0;
  if (press) tgt = o.pressMode === 'AUTO' ? Math.max(o.ldgAlt || 0, altOf(Math.min(psi(0), psi(S.alt || 0) + CNS.diffPsi))) : cn.cabAlt;
  if (!cn._cabInit) { cn._cabInit = true; cn.cabAlt = tgt; }   // 처음(SIM 에 들어올 때)은 그 고도의 객실 고도로
  const rmax = (o.dump ? 2500 : press ? 500 : 2000) / 60;
  const d = tgt - cn.cabAlt; cn.cabRate = Math.sign(d) * Math.min(Math.abs(d), rmax * dt) / dt * 60; cn.cabAlt += cn.cabRate / 60 * dt;
  // 착빙(29-env.js envIce) — 날개 · 꼬리(WING & TAIL) · 프로펠러(PROP DE-ICE)
  const cond = typeof envIce !== 'undefined' && envIce.cond, m = (typeof envMoisture === 'function' ? envMoisture() : 0.5) || 0.5;
  cn.ice = Math.max(0, Math.min(1, cn.ice + (cond && !o.wingTail ? m * dt / 90 : -(o.wingTail ? dt / 30 : dt / 400))));
  cn.propIce = Math.max(0, Math.min(1, cn.propIce + (cond && o.propDeice === 'OFF' ? m * dt / 120 : -dt / 40)));
  // 피토관 — 결빙 조건에서 기장 피토 히터를 끄면 속도계가 굳는다
  try {
    if (typeof instFail !== 'undefined') {
      if (!cn._pitotFrz && !o.pitotL && cond && instFail.asi === null && (cn._pitotT = (cn._pitotT || 0) + dt) > 40) { instFail.asi = Math.round(S.spd || 0); cn._pitotFrz = true; try { fdrNote('피토관 착빙 — 속도계 굳음(PITOT HEAT OFF)', 'err'); } catch (e) { _swallow(e); } }
      else if (cn._pitotFrz && (o.pitotL || !cond)) { instFail.asi = null; cn._pitotFrz = false; cn._pitotT = 0; }
    }
  } catch (e) { _swallow(e); }
  // 땅 — 타이어 한계(지상속도 139kt) · 앞바퀴 조향 손잡이(WHL STEER · 유압)
  if (cn.onGnd) {
    let gs = S.spd || 0; try { gs = groundSpdKt(); } catch (e) { _swallow(e); }
    if (gs > CNS.vTire && !_cnTireWarn) { _cnTireWarn = true; try { uiToast(`타이어 한계 ${CNS.vTire}kt(지상속도) 넘음`, 'err', 3500); } catch (e) { _swallow(e); } }
    if (gs < CNS.vTire - 10) _cnTireWarn = false;
    if (cn.tiller && o.whlSteer && cnHydOk() && S.spd < 60) { S.hdg = normA(S.hdg + cn.tiller * 30 * Math.min(1, (S.spd || 0) / 4) * dt); try { selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; } catch (e) { _swallow(e); } }
  }
}
// 뜰 때 · 내려앉을 때 — 무게 한계 · 측풍 · 접지 강하율(AOM)
function cnSysEvent(k, vs) {
  const m = cnMassKg(), say = (t, c) => { try { uiToast(t, c || 'warn', 4000); } catch (e) { _swallow(e); } try { if (typeof fdrNote === 'function') fdrNote(t, c === 'err' ? 'err' : 'warn'); } catch (e) { _swallow(e); } };
  if (k === 'liftoff') { if (m > CNS.mtow) say(`MTOW 초과 이륙 — ${Math.round(m)}kg(한계 ${CNS.mtow})`, 'err'); return; }
  if (k === 'touchdown') {
    if (m > CNS.mlw) say(`과중량 착륙 — ${Math.round(m)}kg(MLW ${CNS.mlw})`, 'err');
    if (vs > CNS.tdMax) say(`접지 강하율 ${Math.round(vs)}fpm — 한계 ${CNS.tdMax}fpm 초과(점검 필요)`, 'err');
    let xw = 0; try { xw = Math.abs(windSpd * Math.sin((windDir - S.hdg) * D2R)); } catch (e) { _swallow(e); }
    if (xw > CNS.xwMax) say(`측풍 ${Math.round(xw)}kt — 입증 한계 ${CNS.xwMax}kt 초과`);
    if (xw > CNS.xwMax && cn.flap > 16) say('측풍 20kt 초과 — 착륙 플랩은 15°(AOM)');
  }
}
// 무게중심(%MAC) — 빈 기체 22% · 승무원(앞) · 화물 · 주 탱크 · 보조 탱크의 팔 길이로
const CN_ARM = { empty: 22, crew: 4, payload: 26, main: 24, aux: 21 };
function cnCgPct() {
  const t = cn.tank, W = [[CN_P.emptyKg, CN_ARM.empty], [CN_P.crewKg, CN_ARM.crew], [cn.payloadKg, CN_ARM.payload], [t.mL + t.mR, CN_ARM.main], [t.aL + t.aR, CN_ARM.aux]];
  const m = W.reduce((a, [w]) => a + w, 0); return W.reduce((a, [w, x]) => a + w * x, 0) / m;
}

// ── 3D 외부 등화(15-heli3d.js extLightState 가 CN-235 면 이것을) — 날개 끝 빨강/초록 · 꼬리 흰색 · 충돌방지(등 · 배) ──
const CN_LT_POS = { L: [0.9, -12.88, 4.49], R: [0.9, 12.88, 4.49], T: [-10.75, 0, 3.71], U: [1.2, 0, 4.3], D: [2.0, 0, 0.76] };
function cnLightState(t) {
  const o = cn.ov, pwr = cnElecOn(), lit = pwr && o.nav, ac = pwr && o.acol && (t % 1.1) < 0.15;
  const pts = [];
  if (lit) pts.push({ id: 'posL', p: CN_LT_POS.L, col: [1, 0.12, 0.10], k: 0.5 }, { id: 'posR', p: CN_LT_POS.R, col: [0.15, 1, 0.35], k: 0.5 }, { id: 'posT', p: CN_LT_POS.T, col: [1, 1, 0.95], k: 0.5 });
  if (ac) pts.push({ id: 'acolU', p: CN_LT_POS.U, col: [1, 0.12, 0.10], k: 1 }, { id: 'acolD', p: CN_LT_POS.D, col: [1, 0.12, 0.10], k: 1 });
  return { disp: 'DAY', dispK: 1, pwr, nvg: false, pos: { on: lit, lit, k: lit ? 0.5 : 0 }, acol: { on: pwr && o.acol, lit: ac, k: 1 }, blink: o.acol, pts };
}

// ══ 그리기 도구(스위치) ══
function _cnTog(g, x, y, label, on, fn, up = 'ON', dn = 'OFF') {
  if (label) _cnT(g, label, x, y - 27, 9, '#fff');
  g.save(); g.fillStyle = '#9aa1a6'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.strokeStyle = '#333'; g.stroke();
  g.strokeStyle = '#e8eaec'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (on ? -17 : 17)); g.stroke(); g.restore();
  _cnT(g, up, x + 13, y - 13, 7, on ? '#3cff6a' : '#bbb', false, 'left'); _cnT(g, dn, x + 13, y + 13, 7, on ? '#bbb' : '#ffd21a', false, 'left');
  _cnHit(x - 16, y - 22, 32, 44, fn);
}
function _cnPB(g, x, y, w, h, top, bot, onTop, onBot, fn, colTop = '#28e04a', colBot = '#f39a1f') {
  g.save(); g.fillStyle = '#0d0e0f'; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.restore();
  if (top) _cnLamp(g, x, y, w, bot ? h / 2 - 1 : h, top, onTop, colTop, 9);
  if (bot) _cnLamp(g, x, y + h / 2 + 1, w, h / 2 - 1, bot, onBot, colBot, 9);
  _cnHit(x, y, w, h, fn);
}
function _cnRot(g, x, y, label, pos, list, fn) {
  if (label) _cnT(g, label, x, y - 30, 9, '#fff');
  const i = Math.max(0, list.indexOf(pos)), n = list.length, a0 = -60, a1 = 60;
  list.forEach((p, j) => { const a = (a0 + (a1 - a0) * (n > 1 ? j / (n - 1) : 0.5) - 90) * D2R; _cnT(g, p, x + Math.cos(a) * 26, y + Math.sin(a) * 22, 7, j === i ? '#3cff6a' : '#bbb', false); });
  g.save(); g.translate(x, y); g.fillStyle = '#7b8186'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill(); g.rotate((a0 + (a1 - a0) * (n > 1 ? i / (n - 1) : 0.5)) * D2R); g.fillStyle = '#eee'; g.fillRect(-2.5, -13, 5, 12); g.restore();
  _cnHit(x - 18, y - 18, 36, 36, () => fn(list[(i + 1) % n]));
}
function _cnMini(g, cx, cy, R, title, val, lo, hi, unit, bands) {
  _b206Case(g, cx, cy, R);
  const map = _lin(lo, hi, -135, 135);
  (bands || []).forEach(b => _b206Arc(g, cx, cy, R * 0.84, map(b[0]), map(b[1]), b[2], R * 0.1));
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; _b206Radial(g, cx, cy, R * 0.72, R * 0.9, map(v), '#fff', 1.5); const [tx, ty] = _pt(cx, cy, R * 0.55, map(v)); _cnT(g, String(Math.round(v)), tx, ty, R * 0.2, '#fff', false); }
  _cnT(g, title, cx, cy + R * 0.32, R * 0.17, '#fff'); if (unit) _cnT(g, unit, cx, cy + R * 0.55, R * 0.14, '#3cf', false);
  _b206Needle(g, cx, cy, R * 0.82, map(_cl(val, lo, hi)), 3); _b206Hub(g, cx, cy, 3);
}
const _cnTg = k => () => { cn.ov[k] = !cn.ov[k]; };

// ══ 오버헤드 패널(그림 1-1-11 · 1400×800) ══
function cnOvhdDraw(g) {
  const o = cn.ov, W = 1400;
  g.fillStyle = CNP_BG; g.fillRect(0, 0, W, 800);
  const P = (x, y, w, h, t) => _cnBlackPanel(g, x, y, w, h, t);
  // 1열 — ICE PROTECTION · SYSTEM TEST · EXTERNAL LTG
  P(10, 10, 262, 290, 'ICE PROTECTION');
  _cnRot(g, 60, 72, 'PROPELLER', o.propDeice, ['OFF', 'PRI', 'STBY'], v => { o.propDeice = v; });
  _cnMini(g, 150, 70, 30, 'DC AMPS', o.propDeice !== 'OFF' ? 25 : 0, 0, 40, 'X10');
  _cnPB(g, 214, 46, 40, 30, 'GND OPR', null, false, false, () => {}, '#e8231c');
  _cnTog(g, 60, 150, 'WINDSHIELD L', o.wshL, _cnTg('wshL')); _cnTog(g, 140, 150, 'R', o.wshR, _cnTg('wshR'));
  _cnT(g, 'AOA     PITOT', 150, 186, 9, '#fff');
  [['aoaL', 'L'], ['aoaR', 'R'], ['pitotL', 'L'], ['pitotAux', 'AUX'], ['pitotR', 'R']].forEach(([k, t], i) => _cnPB(g, 24 + i * 48, 196, 40, 24, t, null, !o[k], false, _cnTg(k), '#f39a1f'));
  _cnT(g, 'WING & TAIL', 74, 236, 9, '#fff'); _cnT(g, 'ICE DET', 214, 236, 9, '#fff');
  _cnPB(g, 24, 246, 100, 26, o.wingTail ? 'ON (OW·INR·TAIL)' : 'OFF', null, o.wingTail, false, _cnTg('wingTail'));
  _cnTog(g, 214, 268, '', o.iceDet, _cnTg('iceDet'));
  _cnT(g, `ICE ${Math.round(cn.ice * 100)}%  PROP ${Math.round(cn.propIce * 100)}%`, 140, 292, 9, cn.ice > 0.2 ? '#ffd21a' : '#9fd', false);
  P(10, 306, 262, 150, 'SYSTEM TEST');
  _cnT(g, 'ENGINE NP OVSP   L    R', 140, 338, 8, '#ccc', false);
  ['A', 'B', 'A', 'B'].forEach((t, i) => { g.save(); g.fillStyle = '#8a9095'; g.beginPath(); g.arc(46 + i * 64, 356, 12, 0, 7); g.fill(); g.restore(); _cnT(g, t, 46 + i * 64, 356, 9, '#111'); });
  _cnT(g, 'GOVERNOR OVSP · BETA BACK-UP · BATT TEMP', 140, 384, 8, '#ccc', false);
  _cnT(g, 'FIRE DETECT · ACFT OVSP WARN · CARGO/LAV', 140, 400, 8, '#ccc', false);
  _cnBtn(g, 90, 414, 100, 28, 'FIRE TEST', (cn.fireTest || 0) > performance.now(), 10); _cnHit(90, 414, 100, 28, () => { cn.fireTest = performance.now() + 3000; _cnAnnTest = performance.now() + 3000; });
  P(10, 462, 262, 132, 'EXTERNAL LTG');
  [['land', 'LDG'], ['taxi', 'TAXI'], ['turnoff', 'TURN OFF'], ['acol', 'A/COL'], ['logo', 'LOGO'], ['wingInsp', 'WG INSP'], ['nav', 'NAV']].forEach(([k, t], i) => _cnTog(g, 34 + (i % 4) * 62, 522 + (i / 4 | 0) * 46, t, o[k], _cnTg(k)));
  // 2열 — AIR INLET ANTI ICE · 연료량 · FUEL SYSTEM · ENGINE START
  P(278, 10, 262, 110, 'AIR INLET ANTI ICE');
  _cnTog(g, 330, 70, 'L ENG', o.inletL, _cnTg('inletL')); _cnTog(g, 480, 70, 'R ENG', o.inletR, _cnTg('inletR'));
  _cnPB(g, 380, 56, 56, 28, 'O/TEMP', 'TEST', false, false, () => {}, '#f39a1f');
  P(278, 124, 262, 116, null);
  _cnMini(g, 340, 182, 46, 'FUEL QTY L', (cn.tank.mL + cn.tank.aL) * 2.2046 / 100, 0, 40, 'LBS X100'); _cnMini(g, 478, 182, 46, 'FUEL QTY R', (cn.tank.mR + cn.tank.aR) * 2.2046 / 100, 0, 40, 'LBS X100');
  P(278, 246, 262, 220, 'FUEL SYSTEM');
  _cnT(g, `AUX ${Math.round(cn.tank.aL)}`, 316, 276, 9, '#9fd'); _cnT(g, `MAIN ${Math.round(cn.tank.mL)} | ${Math.round(cn.tank.mR)}`, 409, 276, 9, '#9fd'); _cnT(g, `AUX ${Math.round(cn.tank.aR)}`, 502, 276, 9, '#9fd');
  _cnT(g, 'GRAVITY XFR', 340, 292, 8, '#ccc'); _cnT(g, 'GRAVITY XFR', 478, 292, 8, '#ccc');
  _cnPB(g, 318, 298, 44, 22, o.gxL ? 'ON' : 'OFF', null, o.gxL, false, _cnTg('gxL')); _cnPB(g, 456, 298, 44, 22, o.gxR ? 'ON' : 'OFF', null, o.gxR, false, _cnTg('gxR'));
  _cnT(g, 'PRESS XFR', 340, 330, 8, '#ccc'); _cnT(g, 'PRESS XFR', 478, 330, 8, '#ccc');
  _cnPB(g, 318, 336, 44, 22, o.pxL ? 'ON' : 'OFF', null, o.pxL, false, _cnTg('pxL')); _cnPB(g, 456, 336, 44, 22, o.pxR ? 'ON' : 'OFF', null, o.pxR, false, _cnTg('pxR'));
  _cnT(g, 'PUMPS', 409, 330, 8, '#ccc'); _cnPB(g, 384, 336, 24, 22, 'L', null, o.fpL, false, _cnTg('fpL')); _cnPB(g, 412, 336, 24, 22, 'R', null, o.fpR, false, _cnTg('fpR'));
  _cnT(g, 'X-FEED', 409, 372, 8, '#ccc'); _cnPB(g, 384, 378, 50, 22, o.xfeed ? 'OPEN' : 'CLOSE', null, o.xfeed, false, _cnTg('xfeed'), '#f39a1f');
  _cnT(g, 'SHUT-OFF VALVE', 340, 410, 8, '#ccc'); _cnT(g, 'SHUT-OFF VALVE', 478, 410, 8, '#ccc');
  _cnTog(g, 340, 440, '', o.sovL, _cnTg('sovL'), 'OPEN', 'CLOSE'); _cnTog(g, 478, 440, '', o.sovR, _cnTg('sovR'), 'OPEN', 'CLOSE');
  P(278, 472, 262, 118, 'ENGINE START');
  _cnRot(g, 409, 526, 'MODE SEL', o.startMode, ['GPU', 'OFF', 'BAT'], v => { o.startMode = v; });
  [0, 1].forEach(i => {
    const x = i ? 470 : 300, e = cn.eng[i];
    _cnT(g, i ? 'RIGHT' : 'LEFT', x + 32, 508, 8, '#ccc');
    _cnPB(g, x, 516, 34, 30, 'START', null, !!e.starting, false, () => cnStart(i), '#28e04a');
    _cnPB(g, x + 36, 516, 30, 30, 'IGN', null, i ? o.ignR : o.ignL, false, _cnTg(i ? 'ignR' : 'ignL'), '#28e04a');
    _cnT(g, `NG ${e.ng.toFixed(0)}%`, x + 32, 564, 9, e.run ? '#3cff6a' : '#ffd21a', false);
  });
  // 3열 — AC INVERTER · DC POWER GENERATION
  P(546, 10, 262, 180, 'AC INVERTER');
  _cnPB(g, 566, 44, 50, 40, 'FAIL', 'OFF', !o.inv1 || !cnElecOn(), !o.inv1, _cnTg('inv1'), '#e8231c', '#f39a1f');
  _cnPB(g, 652, 44, 50, 40, 'ON', null, o.invS, false, _cnTg('invS'));
  _cnPB(g, 738, 44, 50, 40, 'FAIL', 'OFF', !o.inv2 || !cnElecOn(), !o.inv2, _cnTg('inv2'), '#e8231c', '#f39a1f');
  _cnMini(g, 600, 140, 34, 'AC VOLTS', o.inv1 && cnElecOn() ? 115 : 0, 0, 140, 'X10'); _cnMini(g, 756, 140, 34, 'AC VOLTS', o.inv2 && cnElecOn() ? 115 : 0, 0, 140, 'X10');
  P(546, 196, 262, 394, 'DC POWER GENERATION');
  _cnTog(g, 580, 250, 'BAT NO1', o.bat, _cnTg('bat')); _cnTog(g, 774, 250, 'BAT NO2', o.bat, _cnTg('bat'));
  _cnDig(g, 636, 228, 70, 22, '113°F', '#ffd21a'); _cnDig(g, 636, 254, 70, 22, '193°F', '#ffd21a');
  _cnPB(g, 650, 286, 44, 24, 'GPU', null, o.gpu, false, _cnTg('gpu'), '#28e04a');
  const v1 = o.gen1 && cn.eng[0].run ? 28 : o.bat ? 24 : 0, v2 = o.gen2 && cn.eng[1].run ? 28 : o.bat ? 24 : 0;
  _cnMini(g, 616, 360, 34, 'DC VOLTS', v1, 0, 35); _cnMini(g, 738, 360, 34, 'DC VOLTS', v2, 0, 35);
  _cnMini(g, 616, 460, 34, 'DC AMPS', o.gen1 && cn.eng[0].run ? 2.2 : 0, 0, 4, 'X100'); _cnMini(g, 738, 460, 34, 'DC AMPS', o.gen2 && cn.eng[1].run ? 2.2 : 0, 0, 4, 'X100');
  _cnT(g, 'GEN 1', 616, 524, 9, '#fff'); _cnT(g, 'GEN 2', 738, 524, 9, '#fff');
  _cnTog(g, 616, 560, '', o.gen1, _cnTg('gen1')); _cnTog(g, 738, 560, '', o.gen2, _cnTg('gen2'));
  // 4열 — HYDRAULIC SYS · FIRE · CVR-FDR · MISSION POWER
  P(814, 10, 262, 230, 'HYDRAULIC SYS');
  _cnMini(g, 862, 74, 30, 'HYD QTY', cnHydOk() ? 80 : 75, 0, 100);
  _cnT(g, '1 - PUMP - 2', 990, 40, 9, '#ccc');
  _cnPB(g, 950, 50, 40, 40, 'O/TEMP', o.hyd1 ? 'ON' : 'OFF', false, o.hyd1, _cnTg('hyd1'), '#f39a1f', '#28e04a'); _cnPB(g, 1000, 50, 40, 40, 'O/TEMP', o.hyd2 ? 'ON' : 'OFF', false, o.hyd2, _cnTg('hyd2'), '#f39a1f', '#28e04a');
  _cnMini(g, 945, 160, 42, 'HYD', cnHydPsi() / 1000, 0, 4, 'PSI X1000'); _cnMini(g, 860, 196, 30, 'BRAKE', cnHydOk() ? 3 : 0.4, 0, 4); _cnMini(g, 1036, 196, 30, 'EMER BRAKE', 3, 0, 4);
  P(814, 246, 262, 152, 'FIRE');
  [0, 1].forEach(i => {
    const x = i ? 950 : 830;
    _cnPB(g, x, 270, 50, 36, 'READY', 'DISCH', true, false, () => {}, '#28e04a', '#f39a1f'); _cnPB(g, x + 54, 270, 50, 36, 'READY', 'DISCH', true, false, () => {}, '#28e04a', '#f39a1f');
    g.save(); g.fillStyle = (i ? o.fireR : o.fireL) ? '#ffd21a' : '#111'; g.fillRect(x + 26, 314, 54, 76); g.restore();
    _cnT(g, 'DISCH', x + 53, 324, 9, (i ? o.fireR : o.fireL) ? '#000' : '#fff'); _cnT(g, i ? 'R FIRE' : 'L FIRE', x + 53, 356, 10, (i ? o.fireR : o.fireL) ? '#000' : '#e8231c');
    _cnT(g, (i ? o.fireR : o.fireL) ? 'PULLED' : 'PULL', x + 53, 378, 8, (i ? o.fireR : o.fireL) ? '#000' : '#ccc');
    _cnHit(x + 26, 314, 54, 76, _cnTg(i ? 'fireR' : 'fireL'));
  });
  P(814, 404, 262, 76, 'CVR-FDR');
  _cnTog(g, 860, 452, 'TEST', o.cvr, _cnTg('cvr')); _cnPB(g, 960, 440, 44, 30, 'FAIL', 'OFF', !o.cvr, !o.cvr, _cnTg('cvr'), '#e8231c', '#f39a1f'); _cnPB(g, 1012, 440, 44, 30, 'FAIL', 'OFF', !o.cvr, !o.cvr, _cnTg('cvr'), '#e8231c', '#f39a1f');
  P(814, 486, 262, 104, 'MISSION POWER');
  _cnPB(g, 840, 520, 44, 36, 'FAIL', 'OFF', false, false, () => {}, '#e8231c', '#f39a1f'); _cnPB(g, 890, 520, 44, 36, 'FAIL', 'OFF', false, false, () => {}, '#e8231c', '#f39a1f'); _cnPB(g, 1000, 520, 44, 36, 'FAIL', 'OFF', false, false, () => {}, '#e8231c', '#f39a1f');
  // 5열 — CARGO DOOR · HYDR UTILITY · AIR CONDITIONING · INTERNAL LTG
  P(1082, 10, 308, 140, 'CARGO DOOR CONTROL');
  _cnTog(g, 1120, 82, '', o.cargo === 'OPEN', () => { if (!cnHydOk()) { try { uiToast('화물문 — 유압이 없다', 'warn'); } catch (e) { _swallow(e); } return; } o.cargo = o.cargo === 'OPEN' ? 'CLOSE' : 'OPEN'; }, 'OPEN', 'CLOSE');
  _cnPB(g, 1200, 46, 46, 44, 'OPEN', 'UNLKD', o.cargo === 'OPEN', o.cargo === 'OPEN', () => {}, '#f39a1f', '#e8231c');
  _cnT(g, 'RAMP CYL', 1320, 60, 9, '#ccc'); _cnLamp(g, 1302, 70, 36, 22, 'ON', o.cargo === 'OPEN', '#f39a1f', 9);
  P(1082, 156, 308, 84, 'HYDR UTILITY');
  _cnT(g, 'RH PROPELLER BRAKE', 1160, 180, 8, '#ccc'); _cnPB(g, 1136, 190, 50, 36, 'BRAKE', o.propBrake ? 'ON' : 'OFF', o.propBrake, o.propBrake, () => { if (cn.eng[1].run && !cn.onGnd) return; o.propBrake = !o.propBrake; }, '#28e04a', '#28e04a');
  _cnT(g, 'LOW PRESS IND', 1310, 180, 8, '#ccc'); _cnLamp(g, 1290, 190, 40, 16, '# 1', !o.hyd1 || !cn.eng[0].run, '#f39a1f', 8); _cnLamp(g, 1290, 208, 40, 16, '# 2', !o.hyd2 || !cn.eng[1].run, '#f39a1f', 8);
  P(1082, 246, 308, 210, 'AIR CONDITIONING');
  _cnTog(g, 1120, 300, 'L ENGINE HP', o.bleedL, _cnTg('bleedL')); _cnTog(g, 1350, 300, 'R ENGINE HP', o.bleedR, _cnTg('bleedR'));
  _cnPB(g, 1206, 280, 60, 40, 'APU X', 'BLEED', o.apuX, o.apuX, () => { o.apuX = !o.apuX; }, '#28e04a', '#28e04a');
  _cnPB(g, 1100, 340, 44, 34, 'PCKG', 'BLEED', !o.packL, false, _cnTg('packL'), '#f39a1f', '#f39a1f'); _cnPB(g, 1330, 340, 44, 34, 'PCKG', 'BLEED', !o.packR, false, _cnTg('packR'), '#f39a1f', '#f39a1f');
  _cnRot(g, 1236, 380, 'PRESS MODE', o.pressMode, ['AUTO', 'MAN'], v => { o.pressMode = v; });
  _cnMini(g, 1236, 430, 22, 'CABIN', 22, 0, 40);
  P(1082, 462, 308, 128, 'INTERNAL LTG');
  _cnRot(g, 1250, 528, 'EMER LTG', o.emerLt, ['OFF', 'ARM', 'ON'], v => { o.emerLt = v; });
  _cnTog(g, 1130, 530, 'DOME', !!o.dome, _cnTg('dome')); _cnTog(g, 1340, 530, 'COCKPIT', !!o.ckptLt, _cnTg('ckptLt'));
  // 아래 — CABIN 계기(차압 · 고도 · 승강) · MSTR ELEC · PRESS DUMP · LDG ALT
  P(220, 600, 330, 120, 'CABIN');
  const diff = Math.max(0, (14.696 * Math.pow(Math.max(0.01, 1 - 6.8756e-6 * cn.cabAlt), 5.2559)) - (14.696 * Math.pow(Math.max(0.01, 1 - 6.8756e-6 * (S.alt || 0)), 5.2559)));
  _cnMini(g, 274, 668, 36, 'DIFF', diff, 0, 5, 'PSI', [[0, 3.6, '#18c23a'], [3.6, 4.2, '#f2c418']]);
  _cnMini(g, 384, 668, 36, 'ALT', cn.cabAlt / 1000, 0, 30, 'FT X1000', [[0, 10, '#18c23a'], [10, 30, '#e8231c']]);
  _cnMini(g, 494, 668, 36, 'RATE', cn.cabRate / 1000, -3, 3, 'FPM X1000');
  P(560, 600, 280, 120, 'MSTR ELEC');
  _cnTog(g, 610, 670, 'BAT', o.bat, _cnTg('bat')); _cnTog(g, 680, 670, 'GEN', o.gen1 && o.gen2, () => { const v = !(o.gen1 && o.gen2); o.gen1 = v; o.gen2 = v; });
  _cnT(g, 'PRESS DUMP', 790, 628, 9, '#fff');
  g.save(); g.fillStyle = o.dump ? '#ffd21a' : '#c81c1c'; g.fillRect(768, 640, 44, 70); g.restore(); _cnT(g, o.dump ? 'DUMP' : 'GUARD', 790, 675, 9, '#000');
  _cnHit(768, 640, 44, 70, _cnTg('dump'));
  P(850, 600, 330, 120, 'LDG ALT');
  _cnMini(g, 910, 664, 40, 'LDG ALT', (o.ldgAlt || 0) / 1000, 0, 14, 'FT X1000');
  _cnBtn(g, 980, 640, 60, 28, 'DECR', false, 10); _cnBtn(g, 1050, 640, 60, 28, 'INCR', false, 10);
  _cnHit(980, 640, 60, 28, () => { o.ldgAlt = Math.max(0, (o.ldgAlt || 0) - 500); }); _cnHit(1050, 640, 60, 28, () => { o.ldgAlt = Math.min(14000, (o.ldgAlt || 0) + 500); });
  _cnT(g, `CAB ALT ${Math.round(cn.cabAlt / 10) * 10} FT · ${Math.round(cn.cabRate / 10) * 10} FPM`, 1070, 692, 10, cn.cabAlt > 10000 ? '#ff4a3a' : '#3cff6a', false);
  // 자기 나침반
  g.save(); g.fillStyle = '#6f7a80'; g.fillRect(640, 730, 120, 64); g.fillStyle = '#111'; g.fillRect(654, 742, 92, 40); g.restore();
  _cnT(g, String(Math.round(typeof toMag === 'function' ? toMag(S.hdg) : S.hdg) % 360).padStart(3, '0'), 700, 762, 18, '#fff');
}

// ══ 회로차단기(그림 1-1-15 · 1400×560) — 눌러 뽑고 · 다시 누르면 넣는다. 이름이 맞는 것은 그 계통이 멎는다 ══
const CN_CB = [
  ['AVIONICS NO 1', ['AHS', 'FD/AP', 'RAD ALTM', 'RAD MS', 'V/UHF', 'VOR', 'ACU', 'PA', 'REU', 'CVR/FDR', 'FDAU', 'ELT', 'ADC', 'PFD', 'STBY ALT', 'ADS', 'SVO', 'RMI', 'TAWS', 'VHF', 'VHF C/U', 'DCU']],
  ['BATTERY BUS 1', ['ELEV', 'AIL', 'RUD', 'FLT CONT DISC', 'FLAPS SYS', 'LDG GR', 'L DET', 'R DET', 'L EXTIN', 'R EXTIN', 'TRQ', 'NP', 'NG', 'ITT', 'GEN', 'START', 'ENG OIL PRESS', 'ENG OIL TEMP', 'PROP OIL PRESS', 'PROP OIL TEMP', 'DC VM', 'HOT BUS 1', 'BETA', 'FTR', 'SYS', 'WARNING 1', 'WARNING 2', 'PUMP', 'SOV', 'SOV-XFEED', 'F/F', 'G-XFR', 'LL PUMP']],
  ['MISCELLANEOUS', ['L FUEL QTY', 'OAT', 'HYDR PRESS', 'BK IND', 'HYDR QTY', 'R FUEL QTY', 'L WSHLD', 'L PITOT', 'L PROP', 'R PROP', 'AUX PITOT', 'R WSHLD', 'INLET', 'ENG', 'R ENG', 'R INLET', 'R PITOT', 'WARN 1', 'AIR COND', 'WARN 2', 'HYDR PUMP 1', 'TRU 1 IND', 'TRU 2 IND', 'HYDR PUMP 2', 'VM', 'ICE DET', 'MISSION CTL', 'STBY ATT IND', 'MISSION INV']],
  ['BATTERY BUS 2', ['ELEV 2', 'AIL 2', 'RUD 2', 'IND', 'FLT CONT DISC 2', 'LDG GR IND', 'L DET 2', 'R DET 2', 'L EXTIN 2', 'R EXTIN 2', 'STBY INST', 'WHL STEER', 'TRQ 2', 'NP 2', 'NG 2', 'ITT 2', 'GEN 2', 'BATT TEMP', 'BETA 2', 'FTR 2', 'SYS 2', 'CAB PRESS', 'PUMP 2', 'SOV 2', 'G-XFR 2', 'LL PUMP 2']],
  ['AVIONICS NO 2', ['AHS 2', 'RAD MS 2', 'RSP/CHP', 'VHF 2', 'VHF C/U 2', 'VOR 2', 'ACU 2', 'PA 2', 'REU 2', 'DME', 'STBY ALT 2', 'STBY UNST', 'ADC 2', 'MFD/ND', 'VSN-1', 'DCU 2', 'DF HOMING', 'FMS', 'SSDTU', 'WXR', 'ATC/TCAS', 'TCAS', 'TDR', 'RMI 2']],
];
function cnCbDraw(g) {
  g.fillStyle = CNP_BG; g.fillRect(0, 0, 1400, 560);
  CN_CB.forEach(([title, list], p) => {
    const x0 = 10 + p * 278; _cnBlackPanel(g, x0, 10, 270, 520, title);
    list.forEach((nm, i) => {
      const cx = x0 + 30 + (i % 5) * 52, cy = 64 + (i / 5 | 0) * 72, out = !!cn.cb[nm];
      _cnT(g, nm, cx, cy - 22, 7, '#ddd', false);
      g.save(); g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill(); g.strokeStyle = out ? '#fff' : '#555'; g.lineWidth = out ? 4 : 2; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.stroke(); g.restore();
      _cnT(g, out ? 'OUT' : String([5, 2, 1, 10, 3][i % 5]), cx, cy, 8, out ? '#ffd21a' : '#ccc');
      _cnHit(cx - 16, cy - 16, 32, 32, () => { if (cn.cb[nm]) delete cn.cb[nm]; else cn.cb[nm] = true; try { if (typeof fdrNote === 'function') fdrNote(`C/B ${nm} ${cn.cb[nm] ? '뽑음' : '넣음'}`); } catch (e) { _swallow(e); } });
    });
  });
  const n = Object.keys(cn.cb).length;
  _cnT(g, n ? `뽑힌 차단기 ${n}개: ${Object.keys(cn.cb).slice(0, 8).join(' · ')}` : '모든 회로차단기 정상(IN)', 700, 546, 12, n ? '#ffd21a' : '#3cff6a', false);
}

// ══ 좌우 콘솔(그림 1-1-12 · 13 · 1400×720) ══
function cnConsDraw(g) {
  const o = cn.ov;
  g.fillStyle = '#1b1d1f'; g.fillRect(0, 0, 1400, 720);
  const P = (x, y, w, h, t) => _cnBlackPanel(g, x, y, w, h, t);
  _cnT(g, 'LH CONSOLE', 340, 14, 13, '#fff'); _cnT(g, 'RH CONSOLE', 1060, 14, 13, '#fff');
  // LH — FLIGHT DECK LT · 앞바퀴 조향 손잡이 · ELT · LH MISCELLANEOUS · 오디오 · FDR · WIPER · OXYGEN
  P(20, 30, 300, 150, 'FLIGHT DECK LT');
  ['INST', 'PANEL', 'LATL CSL'].forEach((t, i) => { g.save(); g.fillStyle = '#7f8c88'; g.beginPath(); g.arc(70 + i * 90, 100, 18, 0, 7); g.fill(); g.restore(); _cnT(g, t, 70 + i * 90, 68, 9, '#ddd'); });
  _cnTog(g, 100, 152, '', !!o.reading, _cnTg('reading'), 'READING', 'OFF'); _cnTog(g, 230, 152, '', !!o.flood, _cnTg('flood'), 'FLOOD', 'OFF');
  P(330, 30, 320, 150, 'NOSE WHEEL STEERING');
  g.save(); g.translate(490, 112); g.rotate(cn.tiller * 0.8); g.strokeStyle = '#c9cdd0'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 40, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.fillStyle = '#e5e7e9'; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore();
  _cnT(g, `TILLER ${cn.tiller < -0.05 ? '◀' : cn.tiller > 0.05 ? '▶' : '·'} ${Math.round(cn.tiller * 100)}%`, 490, 168, 10, '#3cff6a', false);
  _cnHit(400, 60, 90, 110, () => { cn.tiller = Math.max(-1, Math.round((cn.tiller - 0.25) * 4) / 4); });
  _cnHit(490, 60, 90, 110, () => { cn.tiller = Math.min(1, Math.round((cn.tiller + 0.25) * 4) / 4); });
  _cnLamp(g, 600, 70, 40, 28, 'WHL\nSTEER', !o.whlSteer, '#e8231c', 8); _cnHit(600, 70, 40, 28, _cnTg('whlSteer'));
  P(20, 190, 200, 120, 'ELT');
  g.save(); g.fillStyle = '#d33'; g.fillRect(90, 230, 50, 40); g.restore(); _cnT(g, o.elt === 'ON' ? 'ON' : 'ARM', 115, 250, 11, '#fff'); _cnHit(90, 230, 50, 40, () => { o.elt = o.elt === 'ON' ? 'ARM' : 'ON'; });
  P(230, 190, 420, 120, 'LH MISCELLANEOUS');
  _cnTog(g, 290, 262, 'MMT', !!o.mmt, _cnTg('mmt')); _cnTog(g, 400, 262, 'MKR SENS', o.mkr === 'HIGH', () => { o.mkr = o.mkr === 'HIGH' ? 'LOW' : 'HIGH'; }, 'HI', 'LOW');
  _cnBtn(g, 480, 244, 150, 32, 'STALL TEST', (cn.stallTest || 0) > performance.now(), 11); _cnHit(480, 244, 150, 32, () => { cn.stallTest = performance.now() + 3000; });
  P(20, 320, 630, 140, 'AUDIO');
  ['V/U1', 'V/U2', 'HF', 'VDL', 'ESM', 'PA1', 'PA2', 'NAV1', 'NAV2', 'MKR1', 'MKR2', 'ADF1', 'ADF2', 'DME1', 'DME2'].forEach((t, i) => {
    const cx = 50 + (i % 8) * 76, cy = 372 + (i / 8 | 0) * 52, on = !!(o.aud || {})[t];
    g.save(); g.fillStyle = on ? '#3cff6a' : '#555'; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fill(); g.restore(); _cnT(g, t, cx, cy - 18, 8, '#ddd', false);
    _cnHit(cx - 14, cy - 14, 28, 28, () => { o.aud = o.aud || {}; o.aud[t] = !o.aud[t]; });
  });
  P(20, 470, 400, 120, 'FLIGHT DATA');
  _cnT(g, 'GROSS WEIGHT', 120, 500, 9, '#ddd'); _cnDig(g, 60, 512, 120, 30, String(Math.round(cnMassKg())), '#fff');
  _cnT(g, 'DATE', 270, 500, 9, '#ddd'); { const d = new Date(); _cnDig(g, 220, 512, 100, 30, `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`, '#fff'); }
  _cnLamp(g, 340, 510, 60, 20, 'DFDR', !o.cvr, '#ffd21a', 9); _cnLamp(g, 340, 540, 60, 20, 'FDAU', !o.cvr, '#ffd21a', 9);
  P(430, 470, 220, 120, 'WIPER');
  _cnRot(g, 540, 540, '', o.wiper, ['PARK', 'OFF', 'LOW', 'HIGH'], v => { o.wiper = v; try { _ckWipeSync(); } catch (e) { _swallow(e); } });
  P(20, 600, 630, 100, 'CREW OXYGEN');
  g.save(); g.fillStyle = '#333'; g.beginPath(); g.arc(120, 650, 30, 0, 7); g.fill(); g.restore(); _cnT(g, 'MASK', 120, 650, 10, '#ccc');
  // RH — FOOT HEAT · FLIGHT DECK LT · TAWS ALERT INHIBIT · FLAP OVERRIDE · RH MISC · 오디오 · OXYGEN · WIPER
  P(750, 30, 200, 150, 'FOOT HEAT');
  _cnTog(g, 850, 110, '', o.footHeat, _cnTg('footHeat'), 'OPEN', 'CLOSE');
  P(960, 30, 420, 150, 'FLIGHT DECK LT');
  ['INST', 'PANEL', 'LATL CSL'].forEach((t, i) => { g.save(); g.fillStyle = '#7f8c88'; g.beginPath(); g.arc(1020 + i * 110, 100, 18, 0, 7); g.fill(); g.restore(); _cnT(g, t, 1020 + i * 110, 68, 9, '#ddd'); });
  P(750, 190, 300, 120, 'TAWS · FLAP OVERRIDE');
  _cnPB(g, 790, 230, 56, 40, 'ALERT', 'INHIBIT', false, !o.taws, () => { o.taws = !o.taws; }, '#f39a1f', '#f39a1f');
  _cnPB(g, 930, 230, 56, 40, 'FLAP', 'OVRD', o.flapOvrd, o.flapOvrd, _cnTg('flapOvrd'), '#f39a1f', '#f39a1f');
  P(1060, 190, 320, 120, 'RH MISCELLANEOUS');
  _cnTog(g, 1110, 262, 'ANN LT', o.annLt === 'BRT', () => { o.annLt = o.annLt === 'BRT' ? 'DIM' : 'BRT'; }, 'BRT', 'DIM');
  _cnTog(g, 1190, 262, 'MKR SENS', o.mkr === 'HIGH', () => { o.mkr = o.mkr === 'HIGH' ? 'LOW' : 'HIGH'; }, 'HI', 'LOW');
  _cnTog(g, 1270, 262, 'RADIO ALT', o.radAlt, _cnTg('radAlt'));
  _cnTog(g, 1345, 262, 'LAV FAN', !!o.lavFan, _cnTg('lavFan'));
  P(750, 320, 630, 140, 'AUDIO');
  ['NAV1', 'NAV2', 'MKR1', 'MKR2', 'ADF1', 'ADF2', 'DME1', 'DME2', 'V/U1', 'V/U2', 'HF', 'VDL', 'ESM', 'PA1', 'PA2'].forEach((t, i) => {
    const cx = 780 + (i % 8) * 76, cy = 372 + (i / 8 | 0) * 52; g.save(); g.fillStyle = '#555'; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fill(); g.restore(); _cnT(g, t, cx, cy - 18, 8, '#ddd', false);
  });
  P(750, 470, 400, 120, 'OXYGEN');
  _cnMini(g, 820, 530, 40, 'PSI', 1800, 0, 2000); _cnTog(g, 930, 540, '', o.oxy !== false, () => { o.oxy = o.oxy === false; });
  P(1160, 470, 220, 120, 'WIPER');
  _cnRot(g, 1270, 540, '', o.wiper, ['PARK', 'OFF', 'LOW', 'HIGH'], v => { o.wiper = v; try { _ckWipeSync(); } catch (e) { _swallow(e); } });
  P(750, 600, 630, 100, 'HAND-MIKE · PHONE');
}

// ══ 무게 · 무게중심 · 성능(1000×640) — AOM 한계 · 탑재 고르기 ══
function cnPerfDraw(g) {
  g.fillStyle = '#16191c'; g.fillRect(0, 0, 1000, 640);
  const t = cn.tank, m = cnMassKg(), zfw = m - cn.fuelKg, cg = cnCgPct();
  _cnT(g, 'CN235-110 WEIGHT & BALANCE · PERFORMANCE (AOM)', 500, 22, 16, '#fff');
  const row = (y, lab, val, lim, ok, fn) => {
    _cnT(g, lab, 40, y, 13, '#cfd8de', false, 'left'); _cnT(g, val, 360, y, 14, ok ? '#3cff6a' : '#ff4a3a', true, 'right'); _cnT(g, lim, 380, y, 11, '#8a96a0', false, 'left');
    if (fn) { _cnBtn(g, 520, y - 11, 30, 22, '−', false, 14); _cnBtn(g, 556, y - 11, 30, 22, '+', false, 14); _cnHit(520, y - 11, 30, 22, () => fn(-1)); _cnHit(556, y - 11, 30, 22, () => fn(1)); }
  };
  const tk = (k, cap) => d => { t[k] = Math.max(0, Math.min(cap, t[k] + d * 100)); };
  row(60, '빈 기체 + 승무원', `${CN_P.emptyKg + CN_P.crewKg} kg`, '', true);
  row(90, '화물 · 승객', `${cn.payloadKg} kg`, '바닥 700kg/m²', true, d => { cn.payloadKg = Math.max(0, Math.min(4000, cn.payloadKg + d * 100)); });
  row(120, '주 탱크 L', `${Math.round(t.mL)} kg`, `최대 ${CNS.mainKg}`, true, tk('mL', CNS.mainKg));
  row(150, '주 탱크 R', `${Math.round(t.mR)} kg`, `최대 ${CNS.mainKg}`, true, tk('mR', CNS.mainKg));
  row(180, '보조 탱크 L', `${Math.round(t.aL)} kg`, `최대 ${CNS.auxKg}`, true, tk('aL', CNS.auxKg));
  row(210, '보조 탱크 R', `${Math.round(t.aR)} kg`, `최대 ${CNS.auxKg}`, true, tk('aR', CNS.auxKg));
  row(240, '연료 계', `${Math.round(cn.fuelKg)} kg`, '쓸 수 있는 4,190', true);
  row(280, '무연료 무게(ZFW)', `${Math.round(zfw)} kg`, `MZFW ${CNS.mzfw}`, zfw <= CNS.mzfw);
  row(310, '총무게(GW)', `${Math.round(m)} kg`, `램프 ${CNS.ramp} · MTOW ${CNS.mtow} · MLW ${CNS.mlw}`, m <= CNS.mtow && m >= CNS.minW);
  row(340, '무게중심', `${cg.toFixed(1)} %MAC`, `${CNS.cgFwd} ~ ${CNS.cgAft} %MAC`, cg >= CNS.cgFwd && cg <= CNS.cgAft);
  // CG 그림(무게 · %MAC 봉투)
  { const x0 = 640, y0 = 60, w = 330, h = 260, X = c => x0 + (c - 12) / 22 * w, Y = kg => y0 + h - (kg - 8000) / 7000 * h;
    g.save(); g.strokeStyle = '#3cff6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(16), Y(CNS.minW)); g.lineTo(X(16), Y(CNS.mtow)); g.lineTo(X(30), Y(CNS.mtow)); g.lineTo(X(30), Y(CNS.minW)); g.closePath(); g.stroke();
    g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(x0, y0, w, h); g.fillStyle = '#ffd21a'; g.beginPath(); g.arc(X(cg), Y(m), 6, 0, 7); g.fill(); g.restore();
    _cnT(g, '%MAC 16 ~ 30', x0 + w / 2, y0 + h + 14, 10, '#9fd', false); _cnT(g, 'MTOW', X(30) + 22, Y(CNS.mtow), 9, '#9fd', false); }
  // 속도 · 성능(지금 무게)
  const vs = f => Math.round(cnVs(1, f)), vr = Math.max(CN_P.vr, Math.round(vs(10) * 1.05)), v2 = Math.round(vs(10) * 1.2), vref = Math.round(vs(23) * 1.3);
  _cnT(g, 'V-SPEEDS (KIAS · 지금 무게)', 40, 392, 14, '#fff', true, 'left');
  [[`VS  UP ${vs(0)} · T/OFF ${vs(10)} · APPR ${vs(15)} · LNDG ${vs(23)}`], [`VR ${vr} · V2 ${v2} · VREF(LNDG) ${vref}`], ['VMO 230(SL) · 200(20,000ft) · 180(25,000ft) · VA 160 · VFE 160 · VLE 150'],
   ['타이어 139kt(지상속도) · 역추력 120KIAS 까지 · 측풍 20kt(넘으면 플랩 15) · 접지 600fpm'], ['엔진 CT7-9C 1,750SHP · APR(한 엔진 불능) 1,870SHP · 이륙 토크 424 · ITT 921~950°C(5분)']]
    .forEach(([s], i) => _cnT(g, s, 40, 420 + i * 26, 12, '#cfd8de', false, 'left'));
  let roc = 0; try { const v = 140, need = cnTqLevel(v, 0, 0), avail = cnTqAvail(); roc = Math.round((avail - need) * 2 * CN_P.hp * 745.7 / 100 * CN_P.eta / cnWeightN() * FPM); } catch (e) { _swallow(e); }
  _cnT(g, `최대 상승률(140kt · 지금 고도) 약 ${roc} fpm · 한 엔진(APR) 약 ${Math.round(roc * 0.35)} fpm`, 40, 560, 12, '#ffd21a', false, 'left');
  _cnT(g, '− / + 로 탑재를 바꾼다(주 탱크 · 보조 탱크 100kg 씩)', 40, 600, 11, '#8a96a0', false, 'left');
}
