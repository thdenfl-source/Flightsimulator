'use strict';
// ══════════════════════════════════════════════════════
// CN-235-220 (해양경찰 고정익 · 쌍발 터보프롭) — 기종이 cn235 일 때(00-aircraft.js)
//
// 회전익과 다른 점:
//   · 호버가 없다 — 날개가 양력을 낸다. 양력 L = q·S·CL(받음각) · 항력 D = q·S·(CD0 + K·CL²)
//     q = ½ρV²(동압). 속도가 줄면 같은 양력에 받음각을 더 써야 하고, 실속각(약 15°)을 넘으면 양력이 꺾인다(실속).
//   · 조종간 앞뒤는 받음각(=속도)을 고른다 — 가운데 두면 트림한 받음각을 지킨다(속도 안정).
//     조종간 좌우는 롤 속도 · 놓으면 그 뱅크를 지킨다. 페달은 방향타(땅에서는 앞바퀴 조향).
//   · 출력은 파워 레버(컬렉티브 축 · PgUp/PgDn · 페데스탈)가 낸 토크 → 프로펠러 추력 T = η·P/V.
//     남는 추력(T − D)이 가속이나 상승이 된다: V̇ = (T − D)/m − g·sinγ · γ̇ = (L·cosφ − W·cosγ)/(m·V)
//   · 땅에서는 바퀴로 굴러 이륙(VR 약 95kt 에서 기수를 들어) · 플랩 0/10/15/23 · 착륙장치 올림/내림(8초)
//
// 제원(근사 · 연습용): 날개 면적 59.1m² · 폭 25.81m · 길이 21.4m · 최대 이륙 16,500kg
//   엔진 GE CT7-9C 1,750shp ×2(APR — 한 엔진 불능 때 1,870shp) · 최대 이륙 토크 424 · ITT 921~950°C(5분) · 프로펠러 4날개 지름 3.35m · VMO 240KIAS · 실속(깨끗) 약 100kt · (플랩 23) 약 84kt
//   비행교범(AOM) 속도 한계: VMO 230KIAS(해면) · 200(20,000ft) · 180(25,000ft) · VA 160 · VFE(T/OFF 10 · APPR 15 · LNDG 23) 160 · VLE 150
//   계기판 · 페데스탈 · 글레어실드(경고등 · 오토파일럿)는 43-cn235panel.js
//
// SIM 이 아닐 때(절차 훈련 — 속도 · 고도를 노브로 고르는 비행)도 고정익의 한계를 지킨다:
//   공중에서는 최소 속도(실속 × 1.2) 아래로 내려가지 않고, 자세 · 토크 계기는 위 식의 평형값을 보인다.
// ══════════════════════════════════════════════════════
const CN_ON = typeof acIs === 'function' && acIs('cn235');
function acCn235() { return CN_ON; }
function acFixedWing() { return CN_ON; }

const CN_P = {
  S: 59.1, span: 25.81, AR: 11.27, e: 0.80,
  emptyKg: 9800, crewKg: 400, payloadKg: 1200, fuelKg: 2838, fuelMaxKg: 4190, mtowKg: 14400,   // AOM: MTOW 14,400 · MLW 14,200 · MZFW 13,600 · 램프 14,450 · 최소 8,700kg
  hp: 1750, eta: 0.82, tStatic: 24000,          // 엔진 한 대(축마력) · 프로펠러 효율 · 한 대의 정지 추력(N)
  CLa: 5.1,                                      // 1/rad
  CD0: 0.027, Kgear: 0.016, Kprop: 0.000,
  flaps: [0, 10, 15, 23],
  dCL0: { 0: 0.25, 10: 0.55, 15: 0.68, 23: 0.88 }, // 받음각 0 의 양력계수
  CLmax: { 0: 1.55, 10: 1.92, 15: 2.05, 23: 2.25 },
  dCD0: { 0: 0, 10: 0.010, 15: 0.020, 23: 0.045 },
  vfe: { 0: 230, 10: 160, 15: 160, 23: 160 },
  vmo: 230, vle: 150, va: 160, vr: 95, v2: 110,
  flapName: { 0: 'UP', 10: 'T/OFF', 15: 'APPR', 23: 'LNDG' },
  gearTime: 8, flapRate: 2.5,                    // 착륙장치 오르내림(s) · 플랩(°/s)
  rollRate: 32, bankMax: 67, yawRate: 3, steerRate: 22,
  aTau: 0.45,                                    // 받음각이 조종간을 따라가는 시간(s)
  stickA: 12,                                    // 조종간 끝까지의 받음각 몫(°)
  muRoll: 0.022, muBrake: 0.38, muPark: 0.55, muBelly: 0.45,
  npMax: 100, npMin: 87,                         // 컨디션 레버 MAX RPM · MIN RPM(%)
};
const G0 = 9.80665, KT = 0.514444, FPM = 196.8504;
const cn = {
  pl: 0, cond: ['MAX', 'MAX'], flapSel: 0, flap: 0, gearDn: true, gearPos: 1, park: false,
  fuelKg: CN_P.fuelKg, payloadKg: CN_P.payloadKg,
  eng: [{ tq: 0, np: 0, ng: 0, itt: 30, ff: 0, run: true }, { tq: 0, np: 0, ng: 0, itt: 30, ff: 0, run: true }],
  alpha: 3, gamma: 0, trimA: 3, stall: false, stallWarn: false, onGnd: true, belly: false,
  tqKin: 0, lastTd: null,
  ap: true, yd: true, ga: false, gust: false, antiskid: true, apr: true, ctq: 400, rudTrim: 0, mute: false, apWarn: 0, fd: { on: false, pitch: 0, roll: 0 },
};
// VMO — 해면 230 · 20,000ft 200 · 25,000ft 180KIAS(AOM 속도 한계표)
function cnVmo(altFt = S.alt) { const a = Math.max(0, altFt || 0); return a <= 20000 ? 230 - 30 * a / 20000 : Math.max(170, 200 - 20 * (a - 20000) / 5000); }
// 오토파일럿이 걸려 있는가(AP ENG) — 꺼져 있으면 모드는 비행지시기(FD)만 보인다
function cnApOn() { return CN_ON && !!cn.ap; }
function cnMassKg() { return CN_P.emptyKg + CN_P.crewKg + cn.payloadKg + cn.fuelKg; }
function cnWeightN() { return cnMassKg() * G0; }
function cnFlapKey(f = cn.flap) { let k = 0; for (const s of CN_P.flaps) if (f >= s - 0.01) k = s; return k; }
// 플랩이 움직이는 중이면 두 칸 사이를 곧게 잇는다
function _cnFlapLerp(tbl, f = cn.flap) {
  const F = CN_P.flaps;
  if (f <= 0) return tbl[0];
  for (let i = 1; i < F.length; i++) if (f <= F[i]) { const t = (f - F[i - 1]) / (F[i] - F[i - 1]); return tbl[F[i - 1]] + t * (tbl[F[i]] - tbl[F[i - 1]]); }
  return tbl[23];
}
function cnCL0() { return _cnFlapLerp(CN_P.dCL0); }
function cnCLmax() { return _cnFlapLerp(CN_P.CLmax) * (1 - 0.22 * (cn.ice || 0)); }   // 날개 착빙(WING & TAIL 제빙 꺼짐 — 44-cn235sys.js)이면 최대 양력이 준다
function cnAlphaStall() { return (cnCLmax() - cnCL0()) / CN_P.CLa / D2R; }   // 실속각(°)
function cnCL(aDeg) {
  const as = cnAlphaStall(), cl0 = cnCL0(), a = aDeg * D2R;
  if (aDeg <= as) return Math.max(-0.9, cl0 + CN_P.CLa * a);
  // 실속 뒤 — 양력이 꺾여 최대의 60% 까지 떨어진다
  return Math.max(0.6 * cnCLmax(), cnCLmax() - (aDeg - as) * D2R * CN_P.CLa * 0.9);
}
function cnCD(CL) {
  const K = 1 / (Math.PI * CN_P.e * CN_P.AR);
  return CN_P.CD0 + _cnFlapLerp(CN_P.dCD0) + CN_P.Kgear * cn.gearPos + K * CL * CL + 0.012 * (cn.ice || 0) + (cn.ov && cn.ov.cargo === 'OPEN' ? 0.025 : 0);
}
// 실속 속도(KIAS) — 하중배수 n(선회 1/cosφ)
function cnVs(n = 1, flap = cn.flap) {
  const f0 = cn.flap; cn.flap = flap;
  const v = Math.sqrt(2 * cnWeightN() * n / (1.225 * CN_P.S * cnCLmax())) / KT;
  cn.flap = f0; return v;
}
// 수평 비행에 드는 받음각(°) — IAS(kt) · 하중배수
function cnAlphaFor(iasKt, n = 1) {
  const q = 0.5 * 1.225 * Math.pow(Math.max(30, iasKt) * KT, 2);
  const CL = cnWeightN() * n / (q * CN_P.S);
  return (CL - cnCL0()) / CN_P.CLa / D2R;
}
// 공기 밀도비 σ
function cnSigma(altFt = S.alt) { const r = tasRatio(altFt); return 1 / (r * r); }
// 엔진 한 대가 낼 수 있는 토크(%) — 높이 올라가면 준다(평평한 정격 · 약 8,000ft 위부터)
function cnTqAvail(altFt = S.alt) { return Math.max(30, Math.min(100, 100 * Math.pow(cnSigma(altFt) / 0.78, 0.9))); }
// 프로펠러 추력(N, 한 대) — 토크(%) · 진대기속도(m/s)
function cnThrust1(tq, vT, np = 100) {
  const P = Math.max(0, tq) / 100 * CN_P.hp * 745.7 * Math.max(0.3, np / 100);
  return Math.min(CN_P.tStatic * Math.max(0, tq) / 100, CN_P.eta * P / Math.max(18, vT));
}
// 수평 비행 토크(%, 엔진마다) — 계기 · SIM 이 아닐 때의 토크
function cnTqLevel(iasKt = S.spd, vsFpm = 0, bnk = 0, altFt = S.alt) {
  const n = 1 / Math.max(0.3, Math.cos(bnk * D2R));
  const q = 0.5 * 1.225 * Math.pow(Math.max(40, iasKt) * KT, 2);
  const CL = cnWeightN() * n / (q * CN_P.S), D = q * CN_P.S * cnCD(CL);
  const vT = Math.max(40, iasKt) * KT * tasRatio(altFt);
  const need = (D + cnWeightN() * (vsFpm / FPM) / Math.max(20, vT)) * vT / CN_P.eta;   // W
  return Math.max(0, need / 2 / (CN_P.hp * 745.7) * 100);
}
// 공중에서의 최소 속도(SIM 밖) — 실속 × 1.2
function cnVmin() { return Math.ceil(cnVs(1) * 1.2); }

// ── 엔진(CT7-9C) — 토크가 레버를 따라가고, NG · ITT · 연료 흐름은 토크에서 ──
const CN_ENG_TAU = 1.6;
function _cnEngVals(e, tq) {
  if (!e.run) return { tq: 0, ng: Math.max(0, e.ng * 0.9), itt: Math.max(30, e.itt * 0.95), ff: 0 };
  return { tq, ng: 70 + 0.30 * tq, itt: 480 + 4.2 * tq, ff: 95 + 2.55 * tq };   // ff: kg/h · ITT 100% 약 900°C(한계 921~950 · 5분)
}
function cnEngStep(dt, tqCmd) {
  const av = cnTqAvail();
  // CONSTANT TORQUE(페데스탈) — 걸어 두면 두 엔진 토크를 고른 값(424 = 100%)에서 더 올리지 않는다
  if (cn.ctqOn) tqCmd = Math.min(tqCmd, cn.ctq / 4.24);
  cn.eng.forEach((e, i) => {
    // 연료 차단(컨디션 레버 FUEL OFF · 오버헤드 SHUT-OFF VALVE · FIRE 손잡이 · 그쪽 연료 바닥) — 44-cn235sys.js
    const off = cn.cond[i] === 'OFF' || (typeof cnFuelCut === 'function' && cnFuelCut(i));
    if (off) { e.run = false; e.starting = false; }
    if (!e.run && typeof cnStartStep === 'function') { cnStartStep(e, i, dt); return; }
    // APR — 한 엔진이 멎으면 남은 엔진이 1,870SHP(107%)까지(AOM 동력장치)
    const apr = cn.apr && !cn.eng[1 - i].run ? 1870 / 1750 : 1;
    const np = !e.run ? 0 : cn.cond[i] === 'MIN' ? CN_P.npMin : CN_P.npMax;
    const t = e.run ? Math.max(0, Math.min(av * apr, tqCmd * (apr > 1 && tqCmd > 95 ? apr : 1))) : 0;
    e.tq += (t - e.tq) * Math.min(1, dt / CN_ENG_TAU);
    e.np += (np - e.np) * Math.min(1, dt / 2.5);
    const v = _cnEngVals(e, e.tq);
    e.ng += (v.ng - e.ng) * Math.min(1, dt / 1.2); e.itt += (v.itt - e.itt) * Math.min(1, dt / 1.8); e.ff = v.ff;
    if (e.run && dt > 0) { if (typeof cnBurn === 'function') cnBurn(i, e.ff * dt / 3600); else cn.fuelKg = Math.max(0, cn.fuelKg - e.ff * dt / 3600); }
  });
  if (cn.fuelKg <= 0) cn.eng.forEach(e => { e.run = false; });
}
function cnTqAvg() { return (cn.eng[0].tq + cn.eng[1].tq) / 2; }

// ── 파워 레버 — 컬렉티브 축(세워 두는 레버면 자리가 곧 레버) · 가운데로 돌아오는 축이면 밀고 당기는 빠르기 ──
// 레버 −0.3(역추력 · 땅에서만) … 0(FLIGHT IDLE) … 1(MAX). 토크 = 8 + 92 × 레버
function cnLeverStep(a, dt) {
  const cfg = (typeof vStickActive === 'function' && vStickActive()) ? { abs: true, virt: true } : (typeof joyAxes === 'object' && joyAxes) ? joyAxes.coll : null;
  if (cfg && cfg.abs) cn.pl = cfg.virt ? vStick.coll : (joyAxRaw('coll') + 1) / 2;
  else if (cfg && a.coll) cn.pl += a.coll * 0.5 * dt;
  cn.pl = Math.max(cn.onGnd ? -0.3 : 0, Math.min(1, cn.pl));
}
function cnTqCmd() { return cn.pl >= 0 ? 8 + 92 * cn.pl : 8 + 100 * -cn.pl; }

// ── 플랩 · 착륙장치 ──
function cnFlapSet(f) { if (CN_P.flaps.includes(+f)) { cn.flapSel = +f; _cnRedraw(); } }
function cnFlapStep(d) { const F = CN_P.flaps, i = F.indexOf(cn.flapSel); cnFlapSet(F[Math.max(0, Math.min(F.length - 1, i + d))]); }
function cnGearSet(dn) {
  if (!dn && cn.onGnd) { try { uiToast('땅 위에서는 착륙장치를 올리지 않는다(WOW)', 'warn'); } catch (e) { _swallow(e); } return; }
  cn.gearDn = !!dn; _cnRedraw();
}
function cnGearToggle() { cnGearSet(!cn.gearDn); }
// 파킹 브레이크 — SIM 의 것(14-simmode.js simParkBrake · 스페이스 두 번)과 같은 것
function cnPark() { return typeof simParkBrake !== 'undefined' ? !!simParkBrake : cn.park; }
function cnParkToggle() { cn.park = !cnPark(); try { if (typeof simParkBrake !== 'undefined') simParkBrake = cn.park; } catch (e) { _swallow(e); } _cnRedraw(); }
function cnCondSet(i, c) { if (['MAX', 'MIN', 'START', 'OFF'].includes(c)) { if (i === 2) cn.cond = [c, c]; else cn.cond[i] = c; _cnRedraw(); } }
function cnMechStep(dt) {
  // 유압(엔진 구동 펌프)이 없으면 플랩 · 착륙장치가 움직이지 않는다 — 비상 내림(중력)은 된다(44-cn235sys.js)
  const hyd = typeof cnHydOk === 'function' ? cnHydOk() : true, cb = k => typeof cnCbOk === 'function' ? cnCbOk(k) : true;
  const d = cn.flapSel - cn.flap;
  if (hyd && cb('FLAPS SYS')) cn.flap += Math.sign(d) * Math.min(Math.abs(d), CN_P.flapRate * dt);
  const g = cn.gearDn ? 1 : 0;
  if ((hyd && cb('LDG GR')) || (cn.gearEmer && g === 1)) cn.gearPos += Math.sign(g - cn.gearPos) * Math.min(Math.abs(g - cn.gearPos), dt / CN_P.gearTime);
}
function _cnRedraw() { try { if (typeof drawPFD === 'function') drawPFD(); } catch (e) { _swallow(e); } try { cnPedSync(); } catch (e) { _swallow(e); } }

// ══ SIM — 고정익 운동식(14-simmode.js simFly 가 cn235 이면 여기로 넘긴다) ══
let _cnOnGndPrev = true;
function fwSimEnter(ground) {
  cn.onGnd = !!ground;
  const ias = Math.max(0, S.spd || 0);
  if (ground) { cn.gamma = 0; cn.alpha = 0; cn.pl = 0; cn.gearDn = true; cn.gearPos = 1; S.pit = 0; S.bnk = 0; }
  else {
    const v = Math.max(cnVmin() + 5, ias); S.spd = v;
    if (v > CN_P.vle) { cn.gearDn = false; cn.gearPos = 0; }   // 순항 속도로 날던 중이면 바퀴는 올린 채
    cn.alpha = cnAlphaFor(v); cn.gamma = Math.asin(Math.max(-0.3, Math.min(0.3, (S.vs || 0) / FPM / (v * KT * tasRatio()))));
    const tq = cnTqLevel(v, S.vs || 0, S.bnk || 0); cn.pl = Math.max(0, Math.min(1, (tq - 8) / 92));
    cn.eng.forEach(e => { e.tq = tq; e.np = CN_P.npMax; e.ng = 70 + 0.3 * tq; e.itt = 480 + 3.6 * tq; });
  }
  cn.trimA = cn.alpha; cn._cabInit = false;
  try { simTrimReset(); } catch (e) { _swallow(e); }
  _cnOnGndPrev = cn.onGnd;
}
// AFCS 가 기수(받음각)를 잡을 때 원하는 비행경로각(rad) — 없으면 null
function _cnApGamma(vT) {
  const asinV = vs => Math.asin(Math.max(-0.35, Math.min(0.35, vs / FPM / Math.max(25, vT))));
  if (cn.ga) return asinV(Math.min(1500, vT / KT * 9));                  // GO AROUND — 상승(약 7°)
  try {
    if (gsOn) {
      const g = gsDeviation();
      if (g) { const gsKt = Math.max(60, vT / KT); return asinV(-gsKt * Math.tan(g.angle * D2R) * FT_PER_NM / 60 + Math.max(-500, Math.min(500, (g.path - S.alt) * 0.6))); }
    }
    if (altHoldOn) { const d = selAlt - S.alt, r = Math.max(500, Math.abs(selVS) || 1000); return asinV(Math.max(-r, Math.min(r, d * 4))); }
    if (vsModeOn) return asinV(selVS);
    if (simIasOn) return asinV((S.vs || 0) + Math.max(-1500, Math.min(1500, (S.spd - selSpd) * 120)));
  } catch (e) { _swallow(e); }
  return null;
}
function fwFly(dt) {
  const a = simModeAxes();
  if (cn.gust) { a.pitch = 0; a.roll = 0; a.yaw = 0; }                    // GUST LOCK — 조종면이 묶여 있다(파워 레버도 FLT IDLE 조금 위까지)
  simTerrainFt();
  const gnd = simGroundFt();
  cn.onGnd = S.alt <= gnd + 0.5 && cn.gamma <= 1e-4;
  // 막 땅에 닿았다 — 접지 평가 · 바퀴를 올린 채면 동체 착륙
  if (cn.onGnd && !_cnOnGndPrev && S.running) {
    const v = Math.max(0, -Math.sin(cn.gamma) * Math.max(0, S.spd) * KT * tasRatio() * FPM, -(S.vs || 0));
    cn.belly = cn.gearPos < 0.95;
    const grade = cn.belly ? '동체 착륙(GEAR UP)' : v <= 360 ? '부드러운 접지' : v <= 600 ? '단단한 접지' : '충격 착륙';
    cn.lastTd = { vs: v, spd: S.spd, grade };
    try { if (typeof simLastTouchdown !== 'undefined') simLastTouchdown = { vs: v, spd: S.spd, grade }; } catch (e) { _swallow(e); }
    try { uiToast(`접지 ${Math.round(v)}fpm · ${Math.round(S.spd)}kt — ${grade}`, cn.belly || v > 600 ? 'err' : v > 360 ? 'warn' : '', 4000); } catch (e) { _swallow(e); }
    try { if (typeof cnSysEvent === 'function') cnSysEvent('touchdown', v); } catch (e) { _swallow(e); }
    cn.gamma = 0;
  }
  if (!cn.onGnd && _cnOnGndPrev && S.running && typeof cnSysEvent === 'function') cnSysEvent('liftoff');
  _cnOnGndPrev = cn.onGnd;
  try { _simOnGnd = cn.onGnd; } catch (e) { _swallow(e); }
  cnLeverStep(a, dt); cnMechStep(dt);
  if (cn.gust) cn.pl = Math.min(cn.pl, 0.12);
  if (cn.pl < 0 && S.spd > 120) { cn.pl = 0; if (!cn._revWarn) { cn._revWarn = true; try { uiToast('역추력 — 120KIAS 위에서는 쓰지 않는다(AOM)', 'warn'); } catch (e) { _swallow(e); } } } else if (S.spd < 110) cn._revWarn = false;
  try { if (typeof cnSysStep === 'function') cnSysStep(dt); } catch (e) { _swallow(e); }
  const sig = cnSigma(), tr = tasRatio();
  let vT = Math.max(0, S.spd) * KT * tr;                     // 진대기속도(m/s)
  const vI = Math.max(0, S.spd) * KT;
  const q = 0.5 * 1.225 * vI * vI;                           // 동압(IAS 로)
  const m = cnMassKg(), W = m * G0;
  // 엔진 · 추력(역추력은 땅에서만)
  cnEngStep(dt, cnTqCmd());
  let T = 0;
  cn.eng.forEach(e => { T += cn.pl < 0 && cn.onGnd ? -0.45 * CN_P.tStatic * e.tq / 100 : cnThrust1(e.tq, vT, e.np); });
  // 받음각 — 조종간(앞 = 받음각 줄임) + 트림. AFCS(ALT · VS · IAS · G/S)면 원하는 경로각으로
  const as = cnAlphaStall();
  let aCmd = cn.trimA - (simTrim.pitch || 0) * 0.5 - a.pitch * CN_P.stickA;
  const gDes = cn.onGnd ? null : _cnApGamma(vT);
  // 비행지시기(FD) — 원하는 경로각이면 그 자세 · 옆은 bankTarget(HDG · NAV) — AP 가 꺼져 있으면 조종사가 따라 몬다
  cn.fd.on = gDes != null || (typeof hdgSelOn !== 'undefined' && (hdgSelOn || navApOn));
  if (gDes != null) cn.fd.pitch = (gDes + cnAlphaFor(S.spd) * D2R) / D2R;
  cn.fd.roll = (typeof hdgSelOn !== 'undefined' && (hdgSelOn || navApOn)) ? bankTarget : 0;
  if (gDes != null && !a.pitch && cn.ap && !cn.ga) {
    const n = 1 / Math.max(0.3, Math.cos(S.bnk * D2R));
    aCmd = cnAlphaFor(S.spd, n * Math.cos(gDes)) + Math.max(-4, Math.min(4, (gDes - cn.gamma) / D2R * (cn.sr ? 0.8 : 1.6)));   // SR(Soft-Ride) — 이득을 반으로
    aCmd = Math.min(aCmd, as - 2);
  }
  aCmd = Math.max(-8, Math.min(as + 8, aCmd));
  if (cn.onGnd) {
    // 땅 — 앞바퀴가 받친다. VR 가까이(조종간을 당긴 만큼) 기수를 든다 · 꼬리가 닿기 전(12°)까지
    const rot = S.spd > CN_P.vr - 10 ? Math.max(0, Math.min(12, aCmd)) : 0;
    cn.alpha += (rot - cn.alpha) * Math.min(1, dt / 0.8);
    cn.gamma = 0;
  } else {
    cn.alpha += (aCmd - cn.alpha) * Math.min(1, dt / CN_P.aTau);
  }
  const CL = cnCL(cn.alpha), L = q * CN_P.S * CL, D = q * CN_P.S * cnCD(CL);
  cn.stall = !cn.onGnd && cn.alpha > as;
  cn.stallWarn = !cn.onGnd && cn.alpha > as - 2.5;
  const cphi = Math.cos(S.bnk * D2R);
  if (cn.onGnd) {
    const load = Math.max(0, W - L);
    const mu = cn.belly || cn.gearPos < 0.95 ? CN_P.muBelly : cnPark() ? CN_P.muPark : (typeof simWheelBrake !== 'undefined' && simWheelBrake) ? CN_P.muBrake : CN_P.muRoll;
    let acc = (T - D) / m - Math.sign(vT || T) * mu * load / m;
    if (vT <= 0.05 && Math.abs(T - D) < mu * load) acc = 0;
    vT = Math.max(0, vT + acc * dt);
    if (L > W) cn.gamma = 0.002;                            // 바퀴가 떨어진다
  } else {
    vT = Math.max(15, vT + ((T - D) / m - G0 * Math.sin(cn.gamma)) * dt);
    cn.gamma += (L * cphi - W * Math.cos(cn.gamma)) / (m * vT) * dt;
    cn.gamma = Math.max(-1.2, Math.min(1.2, cn.gamma));
  }
  S.spd = vT / KT / tr;
  S.vs = cn.onGnd ? (cn.gamma > 0 ? 50 : 0) : vT * Math.sin(cn.gamma) * FPM;
  // 실속 — 버핏으로 날개가 흔들리고 기수가 떨어진다
  let buf = 0;
  if (cn.stall) { buf = (Math.random() - 0.5) * 6; cn.alpha -= 2 * dt; }
  S.pit = cn.onGnd ? cn.alpha : (cn.gamma / D2R + cn.alpha);
  // 롤 — 조종간 좌우가 롤 속도 · 놓으면 그 뱅크(HDG · NAV 가 잡으면 07-sim.js 가)
  if (cn.onGnd) { S.bnk += (0 - S.bnk) * Math.min(1, dt / 0.3); bankTarget = 0; }
  else if (!(typeof simAfcsLat === 'function' && simAfcsLat())) {
    // 조종간 좌우 + 도움날개 트림(4방향 햇 ◀ ▶ — 한 번에 0.5 · 놓아 두면 그 빠르기로 구른다)
    S.bnk = Math.max(-CN_P.bankMax, Math.min(CN_P.bankMax, S.bnk + (a.roll * CN_P.rollRate + (simTrim.roll || 0) * 0.25 + buf) * dt));
    if (!(typeof hdgSelOn !== 'undefined' && (hdgSelOn || navApOn))) bankTarget = S.bnk;   // 모드가 있으면 FD 옆 지시로 남겨 둔다
  }
  // 한 엔진 — 추력이 어긋나 죽은 엔진 쪽으로 기수가 돈다 · 방향타 트림(페데스탈 RUDDER TRIM)으로 잡는다
  if (!cn.onGnd) {
    const tL = cnThrust1(cn.eng[0].tq, vT, cn.eng[0].np), tR = cnThrust1(cn.eng[1].tq, vT, cn.eng[1].np);
    const yr = (tL - tR) / 40000 * 4 + cn.rudTrim * 3;
    if (Math.abs(yr) > 0.01 && !(cn.yd && cn.ap && Math.abs(tL - tR) < 1000)) {
      S.hdg = normA(S.hdg + yr * dt);
      try { selHdg = (typeof hdgSelOn !== 'undefined' && hdgSelOn) ? selHdg : ((Math.round(hdgInd()) + 359) % 360) + 1; } catch (e) { _swallow(e); }
    }
    cn.slip = Math.max(-1, Math.min(1, yr / 4));
  } else cn.slip = 0;
  // 페달 — 공중은 방향타(옆미끄럼 조금) · 땅은 앞바퀴 조향(빠를수록 덜)
  if (a.yaw) {
    const r = cn.onGnd ? a.yaw * CN_P.steerRate * Math.max(0.1, Math.min(1, 40 / Math.max(5, S.spd))) * Math.min(1, S.spd / 3) : a.yaw * CN_P.yawRate;
    S.hdg = normA(S.hdg + r * dt);
    try { selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; } catch (e) { _swallow(e); }
  }
  try { simLat = 0; simYawRate = 0; } catch (e) { _swallow(e); }
  S.tq = cnTqAvg();
  try { simNr = (cn.eng[0].np + cn.eng[1].np) / 2; simTqCmd = cnTqCmd(); } catch (e) { _swallow(e); }
  try { cnHornStep(); } catch (e) { _swallow(e); }
}

// ── 조종간 단추(AOM 그림 1-1-14) — AP(오토파일럿 끊기) · GA(복행) · SYN(맞춤) · PTT ──
function cnApDisc() {
  const was = cn.ap; cn.ap = false; cn.ga = false;
  if (was) { cn.apWarn = 4; try { uiToast('AUTOPILOT DISCONNECT', 'warn', 2500); } catch (e) { _swallow(e); } try { if (typeof fdrNote === 'function') fdrNote('AP 끊김(조종간 AP)'); } catch (e) { _swallow(e); } }
  _cnRedraw();
}
function cnApEng() {
  if (cn.ap) { cnApDisc(); return; }
  cn.ap = true; cn.ga = false;
  // 모드가 하나도 없으면 지금 헤딩 · 승강률을 잡는다(기본 모드)
  try {
    if (!hdgSelOn && !navApOn) { selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; hdgSelOn = true; rollApOn = true; bankTarget = 0; }
    if (!altHoldOn && !vsModeOn && !gsOn && !(simModeOn ? simIasOn : false)) { selVS = Math.round((S.vs || 0) / 100) * 100; vsModeOn = true; }
  } catch (e) { _swallow(e); }
  _cnRedraw();
}
function cnGa() {
  cnApDisc(); cn.apWarn = 0;
  try { afcsReleaseAll(); } catch (e) { _swallow(e); }
  cn.ga = true;
  if (cn.flapSel === 23) cnFlapSet(15);
  const cfg = (typeof joyAxes === 'object' && joyAxes) ? joyAxes.coll : null;
  if (!(cfg && cfg.abs)) cn.pl = 1;
  try { uiToast('GO AROUND — FD 복행 자세 · 플랩 APPR · 최대 출력', '', 3000); } catch (e) { _swallow(e); }
  _cnRedraw();
}
function cnRudTrim(d) { cn.rudTrim = Math.max(-1, Math.min(1, Math.round((cn.rudTrim + d) * 20) / 20)); _cnRedraw(); }

// ══ SIM 밖 — 노브 비행에 고정익의 한계 · 평형 자세 · 토크를 입힌다(07-sim.js 가 매 구간 부른다) ══
function fwKinStep(dt) {
  if (simModeOn) return;
  let agl = 1000; try { agl = radarAltFt(); } catch (e) { _swallow(e); }
  cn.onGnd = agl < 1;
  try { if (typeof cnSysStep === 'function') cnSysStep(dt); } catch (e) { _swallow(e); }
  if (!cn._kinInit) { cn._kinInit = true; if (!cn.onGnd) { cn.gearDn = false; cn.gearPos = 0; } }   // 공중에서 시작하면 바퀴는 올린 채
  cnMechStep(dt);
  if (!cn.onGnd) {
    const vmin = cnVmin(), vmax = Math.min(CN_P.vmo, cn.gearPos > 0.05 ? Math.max(CN_P.vle, CN_P.vfe[cnFlapKey()]) : CN_P.vfe[cnFlapKey()]);
    if (S.spd < vmin) S.spd = vmin;
    if (S.spd > cnVmo()) S.spd = cnVmo();
    try { if (selSpd < vmin) selSpd = vmin; } catch (e) { _swallow(e); }
    cn._vmax = vmax;
  }
  const n = 1 / Math.max(0.3, Math.cos((S.bnk || 0) * D2R));
  const vT = Math.max(30, S.spd) * KT;
  cn.gamma = cn.onGnd ? 0 : Math.asin(Math.max(-0.35, Math.min(0.35, (S.vs || 0) / FPM / vT)));
  cn.alpha = cn.onGnd ? 0 : cnAlphaFor(S.spd, n);
  S.pit = cn.onGnd ? 0 : cn.gamma / D2R + cn.alpha;
  const tq = cn.onGnd ? (S.spd > 2 ? 20 : 8) : Math.min(cnTqAvail(), cnTqLevel(S.spd, S.vs || 0, S.bnk || 0));
  cnEngStep(dt, tq);
  S.tq = cnTqAvg();
  cn.pl = Math.max(0, Math.min(1, (tq - 8) / 92));
  cn.stall = false; cn.stallWarn = false;
}
// 01-state.js tqRequired 가 cn235 면 이 값(엔진마다 수평 비행 토크)을 쓴다
function cnTqRequired() { return cnTqLevel(S.spd, 0, S.bnk || 0); }

// ── 실속 경고음(스틱 셰이커 · 경고 혼) — 받음각이 실속각 2.5° 앞이면 ──
let _cnHorn = null;
function cnHornStep() {
  const want = !!(cn.stallWarn && S.running && (typeof simModeOn !== 'undefined' && simModeOn)) || (cn.stallTest || 0) > performance.now();   // STALL TEST(콘솔)
  if (!want) { if (_cnHorn) { try { _cnHorn.g.gain.value = 0; } catch (e) { _swallow(e); } } return; }
  try {
    if (!_cnHorn) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 420; g.gain.value = 0; o.connect(g); g.connect(ctx.destination); o.start();
      _cnHorn = { ctx, o, g };
    }
    _cnHorn.g.gain.value = 0.06 * ((performance.now() / 120 | 0) % 2);
  } catch (e) { _swallow(e); }
}

