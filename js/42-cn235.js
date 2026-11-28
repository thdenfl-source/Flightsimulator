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
//   엔진 GE CT7-9C 1,750shp ×2 · 프로펠러 4날개 지름 3.35m · VMO 240KIAS · 실속(깨끗) 약 100kt · (플랩 23) 약 84kt
//   착륙장치 VLO/VLE 160KIAS · 플랩 10° 200 · 15° 170 · 23° 150KIAS
//
// SIM 이 아닐 때(절차 훈련 — 속도 · 고도를 노브로 고르는 비행)도 고정익의 한계를 지킨다:
//   공중에서는 최소 속도(실속 × 1.2) 아래로 내려가지 않고, 자세 · 토크 계기는 위 식의 평형값을 보인다.
// ══════════════════════════════════════════════════════
const CN_ON = typeof acIs === 'function' && acIs('cn235');
function acCn235() { return CN_ON; }
function acFixedWing() { return CN_ON; }

const CN_P = {
  S: 59.1, span: 25.81, AR: 11.27, e: 0.80,
  emptyKg: 9800, crewKg: 400, payloadKg: 1200, fuelKg: 3000, fuelMaxKg: 4230, mtowKg: 16500,
  hp: 1750, eta: 0.82, tStatic: 24000,          // 엔진 한 대(축마력) · 프로펠러 효율 · 한 대의 정지 추력(N)
  CLa: 5.1,                                      // 1/rad
  CD0: 0.027, Kgear: 0.016, Kprop: 0.000,
  flaps: [0, 10, 15, 23],
  dCL0: { 0: 0.25, 10: 0.55, 15: 0.68, 23: 0.88 }, // 받음각 0 의 양력계수
  CLmax: { 0: 1.55, 10: 1.92, 15: 2.05, 23: 2.25 },
  dCD0: { 0: 0, 10: 0.010, 15: 0.020, 23: 0.045 },
  vfe: { 0: 240, 10: 200, 15: 170, 23: 150 },
  vmo: 240, vle: 160, vr: 95, v2: 110,
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
};
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
function cnCLmax() { return _cnFlapLerp(CN_P.CLmax); }
function cnAlphaStall() { return (cnCLmax() - cnCL0()) / CN_P.CLa / D2R; }   // 실속각(°)
function cnCL(aDeg) {
  const as = cnAlphaStall(), cl0 = cnCL0(), a = aDeg * D2R;
  if (aDeg <= as) return Math.max(-0.9, cl0 + CN_P.CLa * a);
  // 실속 뒤 — 양력이 꺾여 최대의 60% 까지 떨어진다
  return Math.max(0.6 * cnCLmax(), cnCLmax() - (aDeg - as) * D2R * CN_P.CLa * 0.9);
}
function cnCD(CL) {
  const K = 1 / (Math.PI * CN_P.e * CN_P.AR);
  return CN_P.CD0 + _cnFlapLerp(CN_P.dCD0) + CN_P.Kgear * cn.gearPos + K * CL * CL;
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
  return { tq, ng: 70 + 0.30 * tq, itt: 480 + 3.6 * tq, ff: 95 + 2.55 * tq };   // ff: kg/h
}
function cnEngStep(dt, tqCmd) {
  const av = cnTqAvail();
  cn.eng.forEach((e, i) => {
    const off = cn.cond[i] === 'OFF';
    e.run = !off;
    const np = !e.run ? 0 : cn.cond[i] === 'MIN' ? CN_P.npMin : CN_P.npMax;
    const t = e.run ? Math.max(0, Math.min(av, tqCmd)) : 0;
    e.tq += (t - e.tq) * Math.min(1, dt / CN_ENG_TAU);
    e.np += (np - e.np) * Math.min(1, dt / 2.5);
    const v = _cnEngVals(e, e.tq);
    e.ng += (v.ng - e.ng) * Math.min(1, dt / 1.2); e.itt += (v.itt - e.itt) * Math.min(1, dt / 1.8); e.ff = v.ff;
    if (e.run && dt > 0) cn.fuelKg = Math.max(0, cn.fuelKg - e.ff * dt / 3600);
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
  const d = cn.flapSel - cn.flap;
  cn.flap += Math.sign(d) * Math.min(Math.abs(d), CN_P.flapRate * dt);
  const g = cn.gearDn ? 1 : 0;
  cn.gearPos += Math.sign(g - cn.gearPos) * Math.min(Math.abs(g - cn.gearPos), dt / CN_P.gearTime);
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
  cn.trimA = cn.alpha;
  try { simTrimReset(); } catch (e) { _swallow(e); }
  _cnOnGndPrev = cn.onGnd;
}
// AFCS 가 기수(받음각)를 잡을 때 원하는 비행경로각(rad) — 없으면 null
function _cnApGamma(vT) {
  const asinV = vs => Math.asin(Math.max(-0.35, Math.min(0.35, vs / FPM / Math.max(25, vT))));
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
    cn.gamma = 0;
  }
  _cnOnGndPrev = cn.onGnd;
  try { _simOnGnd = cn.onGnd; } catch (e) { _swallow(e); }
  cnLeverStep(a, dt); cnMechStep(dt);
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
  if (gDes != null && !a.pitch) {
    const n = 1 / Math.max(0.3, Math.cos(S.bnk * D2R));
    aCmd = cnAlphaFor(S.spd, n * Math.cos(gDes)) + Math.max(-4, Math.min(4, (gDes - cn.gamma) / D2R * 1.6));
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
    S.bnk = Math.max(-CN_P.bankMax, Math.min(CN_P.bankMax, S.bnk + (a.roll * CN_P.rollRate + buf) * dt));
    bankTarget = S.bnk;
  }
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

// ══ SIM 밖 — 노브 비행에 고정익의 한계 · 평형 자세 · 토크를 입힌다(07-sim.js 가 매 구간 부른다) ══
function fwKinStep(dt) {
  if (simModeOn) return;
  let agl = 1000; try { agl = radarAltFt(); } catch (e) { _swallow(e); }
  cn.onGnd = agl < 1;
  if (!cn._kinInit) { cn._kinInit = true; if (!cn.onGnd) { cn.gearDn = false; cn.gearPos = 0; } }   // 공중에서 시작하면 바퀴는 올린 채
  cnMechStep(dt);
  if (!cn.onGnd) {
    const vmin = cnVmin(), vmax = Math.min(CN_P.vmo, cn.gearPos > 0.05 ? Math.max(CN_P.vle, CN_P.vfe[cnFlapKey()]) : CN_P.vfe[cnFlapKey()]);
    if (S.spd < vmin) S.spd = vmin;
    if (S.spd > CN_P.vmo) S.spd = CN_P.vmo;
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
  const want = !!(cn.stallWarn && S.running && (typeof simModeOn !== 'undefined' && simModeOn));
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

// ══ 계기판 — 해양경찰 CN-235 조종석 사진의 배치(조종사 쪽) ══
//   왼쪽: Collins EFIS — EADI(위) · EHSI(아래) CRT
//   가운데: 엔진 계기 두 줄(왼쪽 엔진 · 오른쪽 엔진) — TORQUE · ITT · NP · NG · FF · 오른쪽에 OIL · 플랩 지시 · 착륙장치 레버와 세 초록등
//   오른쪽: 대기 속도계 · 고도계 · 승강계 · 위 경고등 줄(MASTER WARN · STALL · GEAR · FLAPS …)
//   그림 좌표 1000×600(CN_W×CN_H)
const CN_W = 1000, CN_H = 600;
const CN_HIT = { ped: [834, 548, 150, 40], gear: [612, 438, 72, 130], flap: [604, 300, 88, 110] };
function cnVals() {
  const e = cn.eng;
  return {
    ias: Math.max(0, S.spd || 0), alt: S.alt || 0, vs: S.vs || 0, pit: S.pit || 0, bnk: S.bnk || 0,
    hdg: (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg), bug: (typeof selHdg !== 'undefined' ? selHdg : 0),
    tq: [e[0].tq, e[1].tq], itt: [e[0].itt, e[1].itt], np: [e[0].np, e[1].np], ng: [e[0].ng, e[1].ng], ff: [e[0].ff, e[1].ff],
    oilP: e.map(x => x.ng > 50 ? 60 + x.tq * 0.2 : x.ng), oilT: e.map(x => x.ng > 50 ? 55 + x.tq * 0.25 : 20),
    alpha: cn.alpha, as: cnAlphaStall(), flap: cn.flap, flapSel: cn.flapSel, gear: cn.gearPos, gearDn: cn.gearDn,
    fuel: cn.fuelKg, baro: (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa) ? window._qnhHpa : 1013.25),
  };
}
function cnAnnun(v) {
  const agl = (() => { try { return radarAltFt(); } catch (e) { return 1000; } })();
  const air = !cn.onGnd;
  return {
    stall: cn.stallWarn,
    gear: air && v.gear < 0.99 && agl < 1000 && cn.pl < 0.25,
    flapOv: v.ias > CN_P.vfe[cnFlapKey()] + 2,
    gearOv: v.gear > 0.01 && v.ias > CN_P.vle + 2,
    vmo: v.ias > CN_P.vmo + 1,
    lowFuel: v.fuel < 400,
    eng1: !cn.eng[0].run, eng2: !cn.eng[1].run,
    park: cnPark(),
  };
}
function _cnCrt(g, x, y, w, h) {
  g.save(); g.fillStyle = '#2b2f33'; g.fillRect(x - 6, y - 6, w + 12, h + 12);
  g.fillStyle = '#06080a'; g.fillRect(x, y, w, h); g.restore();
}
// EADI — 하늘(파랑) · 땅(갈색) · 피치 사다리 · 뱅크 눈금 · 노랑 비행기 표지 · 왼쪽 IAS · 오른쪽 ALT 상자 · 받음각
function cnEadi(g, x, y, w, h, v) {
  _cnCrt(g, x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2, ppd = h / 50;          // 1° 당 픽셀
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(cx, cy); g.rotate(-v.bnk * D2R); g.translate(0, v.pit * ppd);
  g.fillStyle = '#1e7fd6'; g.fillRect(-w * 1.5, -h * 3, w * 3, h * 3);
  g.fillStyle = '#7a4a1e'; g.fillRect(-w * 1.5, 0, w * 3, h * 3);
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w * 1.5, 0); g.lineTo(w * 1.5, 0); g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 12px ' + B206_FONT; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let p = -30; p <= 30; p += 5) {
    if (!p) continue;
    const yy = -p * ppd, half = p % 10 === 0 ? w * 0.16 : w * 0.08;
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(-half, yy); g.lineTo(half, yy); g.stroke();
    if (p % 10 === 0) { g.fillText(String(Math.abs(p)), -half - 4, yy); g.textAlign = 'left'; g.fillText(String(Math.abs(p)), half + 4, yy); g.textAlign = 'right'; }
  }
  g.restore();
  // 뱅크 눈금 · 지시
  g.save(); g.translate(cx, cy); g.strokeStyle = '#fff'; g.lineWidth = 2;
  const r = h * 0.40;
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { const a = (b - 90) * D2R, l = b % 30 === 0 ? 14 : 8; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + l), Math.sin(a) * (r + l)); g.stroke(); }
  g.rotate(-v.bnk * D2R); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -r); g.lineTo(-7, -r + 12); g.lineTo(7, -r + 12); g.closePath(); g.fill();
  g.restore();
  // 비행기 표지
  g.save(); g.strokeStyle = '#000'; g.fillStyle = '#ffd21a'; g.lineWidth = 1.5;
  g.fillRect(cx - w * 0.30, cy - 3, w * 0.16, 6); g.strokeRect(cx - w * 0.30, cy - 3, w * 0.16, 6);
  g.fillRect(cx + w * 0.14, cy - 3, w * 0.16, 6); g.strokeRect(cx + w * 0.14, cy - 3, w * 0.16, 6);
  g.fillRect(cx - 4, cy - 4, 8, 8); g.strokeRect(cx - 4, cy - 4, 8, 8); g.restore();
  // IAS · ALT 상자 · 받음각 줄(오른쪽 아래)
  const box = (bx, txt, col) => { g.save(); g.fillStyle = '#000'; g.strokeStyle = '#ddd'; g.lineWidth = 1.2; g.fillRect(bx, cy - 15, 70, 30); g.strokeRect(bx, cy - 15, 70, 30); _b206Text(g, txt, bx + 35, cy, 18, col || '#fff'); g.restore(); };
  box(x + 6, String(Math.round(v.ias)), v.ias > CN_P.vmo ? '#ff4040' : '#fff');
  box(x + w - 76, String(Math.round(v.alt / 10) * 10), '#fff');
  _b206Text(g, 'IAS', x + 41, cy - 24, 11, '#9fd'); _b206Text(g, 'ALT', x + w - 41, cy - 24, 11, '#9fd');
  _b206Text(g, `VS ${Math.round(v.vs / 10) * 10}`, x + w - 41, cy + 26, 11, '#9fd');
  // 받음각(실속 여유) 막대
  const k = Math.max(0, Math.min(1, v.alpha / Math.max(1, v.as)));
  g.save(); g.fillStyle = '#222'; g.fillRect(x + 8, y + h - 22, w * 0.34, 12);
  g.fillStyle = k > 0.85 ? '#ff3a2a' : k > 0.7 ? '#f2c418' : '#18c23a'; g.fillRect(x + 8, y + h - 22, w * 0.34 * k, 12); g.restore();
  _b206Text(g, `AOA ${v.alpha.toFixed(1)}°`, x + 8 + w * 0.17, y + h - 34, 11, '#9fd');
  if (cn.stallWarn) _b206Text(g, 'STALL', cx, y + 22, 22, (performance.now() / 250 | 0) % 2 ? '#ff3a2a' : '#fff');
  // AFCS 모드(위)
  let modes = []; try { if (hdgSelOn) modes.push('HDG'); if (navApOn) modes.push('NAV'); if (altHoldOn) modes.push('ALT'); if (vsModeOn) modes.push('VS'); if (simIasOn || (!simModeOn && iasNsOn)) modes.push('IAS'); if (gsOn) modes.push('GS'); } catch (e) { _swallow(e); }
  _b206Text(g, modes.join('  '), cx, y + h - 14, 13, '#3cff6a');
}
// EHSI — 기수 위가 지금 자기 방위 · 노란 헤딩 버그 · 초록 코스 바늘(CDI)
function cnEhsi(g, x, y, w, h, v) {
  _cnCrt(g, x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2 + 8, R = Math.min(w, h) * 0.42;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(cx, cy);
  g.save(); g.rotate(-v.hdg * D2R);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.font = 'bold 13px ' + B206_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 5) {
    const a = (d - 90) * D2R, l = d % 10 === 0 ? 12 : 6;
    g.lineWidth = d % 10 === 0 ? 2 : 1; g.beginPath(); g.moveTo(Math.cos(a) * R, Math.sin(a) * R); g.lineTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l)); g.stroke();
    if (d % 30 === 0) { g.save(); g.rotate(d * D2R); g.fillText(d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d / 10), 0, -R + 24); g.restore(); }
  }
  // 헤딩 버그
  g.save(); g.rotate(v.bug * D2R); g.fillStyle = '#ffd21a'; g.fillRect(-9, -R - 2, 18, 8); g.restore();
  // 코스 바늘 · CDI
  let c = { ok: false, dev: 0, crs: 0 }; try { if (typeof b206Cdi === 'function') c = b206Cdi(); } catch (e) { _swallow(e); }
  const crs = typeof toMag === 'function' ? toMag(c.crs) : c.crs;
  g.save(); g.rotate(crs * D2R); g.strokeStyle = '#3cff6a'; g.fillStyle = '#3cff6a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, -R + 30); g.lineTo(0, -R * 0.42); g.moveTo(0, R * 0.42); g.lineTo(0, R - 30); g.stroke();
  g.beginPath(); g.moveTo(0, -R + 22); g.lineTo(-7, -R + 34); g.lineTo(7, -R + 34); g.closePath(); g.fill();
  for (const d of [-2, -1, 1, 2]) { g.beginPath(); g.arc(d * R * 0.18, 0, 3, 0, 7); g.stroke(); }
  if (c.ok) { g.beginPath(); g.moveTo(c.dev * R * 0.36, -R * 0.40); g.lineTo(c.dev * R * 0.36, R * 0.40); g.stroke(); }
  g.restore();
  g.restore();
  // 기체 표지 · 위 기준선
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 4); g.lineTo(12, 4); g.moveTo(0, -12); g.lineTo(0, 14); g.moveTo(-5, 12); g.lineTo(5, 12); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -R - 4); g.lineTo(-6, -R - 14); g.lineTo(6, -R - 14); g.closePath(); g.fill();
  g.restore();
  _b206Text(g, String(Math.round(v.hdg) % 360).padStart(3, '0'), cx, y + 14, 15, '#fff');
  _b206Text(g, `CRS ${String(Math.round(typeof toMag === 'function' ? toMag(c.crs) : c.crs) % 360).padStart(3, '0')}`, x + 44, y + 14, 12, '#3cff6a');
  _b206Text(g, `HDG ${String(Math.round(v.bug) % 360).padStart(3, '0')}`, x + w - 44, y + 14, 12, '#ffd21a');
  let gs = 0; try { gs = groundSpdKt(); } catch (e) { _swallow(e); }
  _b206Text(g, `GS ${Math.round(gs)}`, x + 36, y + h - 14, 12, '#9fd');
  try { if (S.awp >= 0 && S.wps[S.awp]) _b206Text(g, `${S.wps[S.awp].name || ''} ${(S.dtw || 0).toFixed(1)}NM`, x + w - 70, y + h - 14, 12, '#d86cff'); } catch (e) { _swallow(e); }
}
function _cnGaugePair(g, cx, cy, R, title, v, o) {
  const opt = Object.assign({ lab: q => String(q), fs: R * 0.2 }, o);
  ['L', 'R'].forEach((s, i) => b206RoundGauge(g, cx + (i ? R * 2.25 : 0), cy, R, Object.assign({}, opt, { val: _cl(v[i], opt.lo, opt.hi + (opt.hi - opt.lo) * 0.05), title: [title, s] })));
}
function cnDraw(g, x, y, w, h) {
  if (!(w > 40 && h > 40)) return;
  const v = cnVals(), an = cnAnnun(v);
  g.save();
  g.fillStyle = '#8e979e'; g.fillRect(x, y, w, h);
  const k = Math.min(w / CN_W, h / CN_H);
  g.translate(x + (w - CN_W * k) / 2, y + (h - CN_H * k) / 2); g.scale(k, k);
  // 판 · 나사
  g.save(); g.fillStyle = '#9aa3aa'; g.fillRect(0, 0, CN_W, CN_H); g.strokeStyle = '#6b747b'; g.lineWidth = 3; g.strokeRect(4, 4, CN_W - 8, CN_H - 8);
  g.fillStyle = '#5c646b'; for (const [sx, sy] of [[14, 14], [CN_W - 14, 14], [14, CN_H - 14], [CN_W - 14, CN_H - 14], [370, 14], [700, 14]]) { g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill(); } g.restore();
  // EFIS — EADI · EHSI
  cnEadi(g, 22, 30, 330, 262, v);
  cnEhsi(g, 22, 312, 330, 262, v);
  // 엔진 계기 — 두 줄(L · R)
  const R = 40, X0 = 418;
  _cnGaugePair(g, X0, 64, R, 'TORQUE', v.tq, { lo: 0, hi: 120, maj: 20, min: 10, bands: [[0, 100, B206_COL.green], [100, 106, B206_COL.yellow]], redline: [106], lab: q => q % 40 === 0 ? String(q / 10) : null });
  _cnGaugePair(g, X0, 164, R, 'ITT', v.itt, { lo: 0, hi: 1000, maj: 200, min: 100, bands: [[400, 860, B206_COL.green], [860, 920, B206_COL.yellow]], redline: [920], lab: q => q % 200 === 0 ? String(q / 100) : null });
  _cnGaugePair(g, X0, 264, R, 'NP %', v.np, { lo: 0, hi: 110, maj: 20, min: 10, bands: [[84, 102, B206_COL.green]], redline: [102], lab: q => q % 20 === 0 ? String(q) : null });
  _cnGaugePair(g, X0, 364, R, 'NG %', v.ng, { lo: 0, hi: 110, maj: 20, min: 10, bands: [[60, 101, B206_COL.green]], redline: [101], lab: q => q % 20 === 0 ? String(q) : null });
  _cnGaugePair(g, X0, 464, R, 'FF', v.ff.map(f => f * 2.2046 / 100), { lo: 0, hi: 10, maj: 2, min: 1, bands: [[1, 8, B206_COL.green]], lab: q => String(q) });
  _b206Text(g, 'PPH ×100', X0 + R * 1.12, 512, 10, '#111');
  // 오일 압력 · 온도(겹 계기)
  [0, 1].forEach(i => b206DualGauge(g, 648, 64 + i * 100, R, { lo: 0, hi: 120, maj: 40, min: 20, val: v.oilP[i], bands: [[40, 100, B206_COL.green]], unit: 'PSI', lab: q => String(q) }, { lo: 0, hi: 140, maj: 40, min: 20, val: v.oilT[i], bands: [[10, 110, B206_COL.green]], unit: '°C', lab: q => String(q) }, ['ENG OIL', i ? 'R' : 'L']));
  // 플랩 지시(0 · 10 · 15 · 23) — 누르면 다음 칸(아래로) · 길게 누르면 페데스탈
  {
    const cx = 648, cy = 356, RR = 46;
    _b206Case(g, cx, cy, RR);
    const map = f => -60 + f / 23 * 150;
    CN_P.flaps.forEach(f => { _b206Radial(g, cx, cy, RR * 0.70, RR * 0.88, map(f), B206_COL.mark, 2); const [tx, ty] = _pt(cx, cy, RR * 0.52, map(f)); _b206Text(g, String(f), tx, ty, 11); });
    _b206Text(g, 'FLAPS', cx, cy + RR * 0.45, 10);
    _b206Needle(g, cx, cy, RR * 0.82, map(v.flap), 4, '#fff', 0.1); _b206Hub(g, cx, cy, 4);
    g.save(); g.strokeStyle = '#ffd21a'; g.lineWidth = 2; const [bx, by] = _pt(cx, cy, RR * 0.95, map(v.flapSel)); g.beginPath(); g.arc(bx, by, 4, 0, 7); g.stroke(); g.restore();
  }
  // 착륙장치 — 레버(바퀴 손잡이) · 세 초록등(내려 잠김) · 빨강(움직이는 중)
  {
    g.save(); g.fillStyle = '#1a1c1e'; g.fillRect(612, 438, 72, 130); g.restore();
    const trans = v.gear > 0.01 && v.gear < 0.99;
    [[648, 452], [630, 474], [666, 474]].forEach(([lx, ly]) => { g.save(); g.fillStyle = v.gear > 0.99 ? '#28e04a' : trans ? '#ff3a2a' : '#2a2a2a'; g.beginPath(); g.arc(lx, ly, 7, 0, 7); g.fill(); g.restore(); });
    const ly = v.gearDn ? 540 : 500;
    g.save(); g.strokeStyle = '#ccc'; g.lineWidth = 5; g.beginPath(); g.moveTo(648, 500); g.lineTo(648, ly); g.stroke();
    g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(648, ly, 11, 0, 7); g.fill(); g.restore();
    _b206Text(g, 'UP', 676, 500, 10, '#ddd'); _b206Text(g, 'DN', 676, 540, 10, '#ddd'); _b206Text(g, 'GEAR', 648, 560, 10, '#ddd');
  }
  // 경고등 줄(오른쪽 위)
  const lamps = [['STALL', an.stall, '#ff3a2a'], ['GEAR', an.gear, '#ff3a2a'], ['OVSPD', an.vmo || an.flapOv || an.gearOv, '#ff3a2a'], ['FUEL LOW', an.lowFuel, '#f2c418'],
                 ['L ENG OUT', an.eng1, '#ff3a2a'], ['R ENG OUT', an.eng2, '#ff3a2a'], ['PARK BRK', an.park, '#f2c418'], ['REV', cn.pl < 0, '#3cf']];
  lamps.forEach(([t, on, col], i) => _b206Lamp(g, 714 + (i % 4) * 68, 22 + (i / 4 | 0) * 30, 64, 24, t, on, col));
  // 대기 계기 — 속도계(40~300) · 고도계 · 승강계
  {
    const cx = 790, cy = 168, RR = 66;
    _b206Case(g, cx, cy, RR);
    const map = s => s <= 40 ? -150 + s / 40 * 10 : -140 + (Math.min(300, s) - 40) / 260 * 290;
    _b206Arc(g, cx, cy, RR * 0.86, map(84), map(150), '#f2f2f2', RR * 0.07);
    _b206Arc(g, cx, cy, RR * 0.80, map(100), map(CN_P.vmo), B206_COL.green, RR * 0.07);
    _b206Radial(g, cx, cy, RR * 0.66, RR * 0.93, map(CN_P.vmo), B206_COL.red, RR * 0.07);
    for (let s = 40; s <= 300; s += 10) { const big = s % 50 === 0; _b206Radial(g, cx, cy, RR * (big ? 0.70 : 0.80), RR * 0.90, map(s), B206_COL.mark, big ? 2.2 : 1); if (big) { const [tx, ty] = _pt(cx, cy, RR * 0.54, map(s)); _b206Text(g, String(s), tx, ty, 12); } }
    _b206Text(g, 'KNOTS', cx, cy + RR * 0.3, 10);
    _b206Needle(g, cx, cy, RR * 0.86, map(v.ias), 4); _b206Hub(g, cx, cy, 5);
  }
  try { b206Altimeter(g, 920, 168, 62, v.alt, v.baro / 33.8639); } catch (e) { _swallow(e); }
  try { b206Vsi(g, 790, 330, 62, v.vs); } catch (e) { _swallow(e); }
  try { b206Attitude(g, 920, 330, 62, v.pit, v.bnk); } catch (e) { _swallow(e); }
  // 연료 · 무게 · 접지
  g.save(); g.fillStyle = '#16181a'; g.fillRect(720, 420, 264, 112); g.restore();
  _b206Text(g, `FUEL ${Math.round(v.fuel)} kg`, 852, 438, 15, an.lowFuel ? '#f2c418' : '#3cff6a');
  _b206Text(g, `GW ${Math.round(cnMassKg())} kg · VS1 ${Math.round(cnVs(1))} kt`, 852, 462, 13, '#cfd');
  _b206Text(g, `PL ${Math.round(cn.pl * 100)}% · ${cn.cond[0]}/${cn.cond[1]} RPM`, 852, 486, 13, '#cfd');
  if (cn.lastTd) _b206Text(g, `TD ${Math.round(cn.lastTd.vs)}fpm · ${cn.lastTd.grade}`, 852, 512, 12, '#ffd');
  // 페데스탈 버튼
  g.save(); g.fillStyle = '#2b2f33'; g.fillRect(...CN_HIT.ped); g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.strokeRect(...CN_HIT.ped); g.restore();
  _b206Text(g, 'PEDESTAL ▸', CN_HIT.ped[0] + CN_HIT.ped[2] / 2, CN_HIT.ped[1] + 20, 15, '#fff');
  g.restore();
  try { g.canvas._cn = g.getTransform(); } catch (e) { _swallow(e); }
}
function cnDrawTo(canvas) { const g = canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); cnDraw(g, 0, 0, canvas.width, canvas.height); }
// 3D 화면에 겹친 계기(계기 ON) — EADI · EHSI · 토크 둘
function cnOverlayDraw(g, x, y, w, h) {
  if (!(w > 40 && h > 40)) return;
  const v = cnVals();
  g.save(); g.clearRect(x, y, w, h);
  const W0 = 700, H0 = 280, k = Math.min(w / W0, h / H0);
  g.translate(x + (w - W0 * k) / 2, y + (h - H0 * k) / 2); g.scale(k, k);
  g.fillStyle = 'rgba(142,151,158,0.82)'; g.fillRect(0, 0, W0, H0);
  cnEadi(g, 14, 14, 250, 252, v); cnEhsi(g, 280, 14, 250, 252, v);
  _cnGaugePair(g, 590, 74, 40, 'TORQUE', v.tq, { lo: 0, hi: 120, maj: 20, min: 10, bands: [[0, 100, B206_COL.green], [100, 106, B206_COL.yellow]], redline: [106], lab: q => q % 40 === 0 ? String(q / 10) : null });
  _cnGaugePair(g, 590, 200, 40, 'ITT', v.itt, { lo: 0, hi: 1000, maj: 200, min: 100, bands: [[400, 860, B206_COL.green]], redline: [920], lab: q => q % 200 === 0 ? String(q / 100) : null });
  g.restore();
}
// 판을 누르면 — PEDESTAL(페데스탈 창) · GEAR(레버) · FLAPS(다음 칸)
function cnPanelHit(ev) {
  const c = ev.target; if (!CN_ON || !c || c.tagName !== 'CANVAS' || !c._cn) return null;
  const r = c.getBoundingClientRect(); if (!(r.width > 0)) return null;
  const px = (ev.clientX - r.left) * c.width / r.width, py = (ev.clientY - r.top) * c.height / r.height;
  const k = c._cn.a, x = (px - c._cn.e) / k, y = (py - c._cn.f) / k;
  for (const [n, [bx, by, bw, bh]] of Object.entries(CN_HIT)) if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return n;
  return null;
}
if (CN_ON) {
  document.addEventListener('pointerdown', ev => {
    const h = cnPanelHit(ev); if (!h) return;
    ev.stopPropagation(); ev.preventDefault();
    if (h === 'ped') cnPedToggle();
    else if (h === 'gear') cnGearToggle();
    else if (h === 'flap') { const F = CN_P.flaps, i = F.indexOf(cn.flapSel); cnFlapSet(F[(i + 1) % F.length]); }
  }, true);
  document.addEventListener('click', ev => { if (cnPanelHit(ev)) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  // 키 — G 착륙장치 · F/Shift+F 플랩 내림/올림 · PgUp/PgDn 파워 레버 · P 페데스탈
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    try { if (typeof kbdShortcuts !== 'undefined' && !kbdShortcuts) return; if (typeof joyKeyOwned === 'function' && joyKeyOwned(e)) return; } catch (er) { _swallow(er); }
    const k = e.key;
    if (k === 'g' || k === 'G') { if (!e.repeat) cnGearToggle(); }
    else if (k === 'f') cnFlapStep(1);
    else if (k === 'F') cnFlapStep(-1);
    else if (k === 'PageUp') cn.pl = Math.min(1, cn.pl + 0.05);
    else if (k === 'PageDown') cn.pl = Math.max(cn.onGnd ? -0.3 : 0, cn.pl - 0.05);
    else if (k === 'p' || k === 'P') { if (!e.repeat) cnPedToggle(); }
    else return;
    e.preventDefault(); _cnRedraw();
  });
}

// ══ 페데스탈(가운데 받침) — 사진의 배치: 파워 레버 둘 · 컨디션 레버 둘 · 플랩 레버 · 착륙장치 · 파킹 브레이크 ══
let _cnPed = null;
function cnPedToggle(on) {
  if (!_cnPed) _cnPedBuild();
  const show = on === undefined ? _cnPed.style.display !== 'flex' : !!on;
  _cnPed.style.display = show ? 'flex' : 'none';
  if (show) cnPedSync();
}
function _cnPedBuild() {
  const d = document.createElement('div');
  d.id = 'cn-ped';
  const cond = i => ['MAX', 'MIN', 'START', 'OFF'].map(c => `<button data-cnp="cond" data-i="${i}" data-v="${c}">${c === 'MAX' ? 'MAX RPM' : c === 'MIN' ? 'MIN RPM' : c === 'OFF' ? 'FUEL OFF' : 'START'}</button>`).join('');
  d.innerHTML = `<div class="cnp-bar"><b>CN-235 PEDESTAL</b><button data-cnp="close" class="cnp-x">✕</button></div>
  <div class="cnp-body">
    <div class="cnp-col"><div class="cnp-t">POWER</div>
      <div class="cnp-pl"><div class="cnp-track"><div class="cnp-mark" style="top:22%">FLT IDLE</div><div class="cnp-mark" style="top:2%">MAX</div><div class="cnp-mark" style="top:88%">REV</div><div class="cnp-knob"></div></div></div>
      <div class="cnp-val" data-cnv="pl"></div></div>
    <div class="cnp-col"><div class="cnp-t">CONDITION L</div><div class="cnp-btns">${cond(0)}</div><div class="cnp-t">CONDITION R</div><div class="cnp-btns">${cond(1)}</div></div>
    <div class="cnp-col"><div class="cnp-t">FLAPS</div><div class="cnp-btns">${CN_P.flaps.map(f => `<button data-cnp="flap" data-v="${f}">${f}°</button>`).join('')}</div>
      <div class="cnp-t">GEAR</div><div class="cnp-btns"><button data-cnp="gear" data-v="up">UP</button><button data-cnp="gear" data-v="dn">DOWN</button></div><div class="cnp-val" data-cnv="gear"></div></div>
    <div class="cnp-col"><div class="cnp-t">BRAKE</div><div class="cnp-btns"><button data-cnp="park">EMERG &amp; PARK BR.</button></div>
      <div class="cnp-t">ELEV TRIM</div><div class="cnp-btns"><button data-cnp="trim" data-v="F">NOSE DN</button><button data-cnp="trim" data-v="A">NOSE UP</button></div><div class="cnp-val" data-cnv="trim"></div>
      <div class="cnp-note">키: PgUp/PgDn 파워 · F/Shift+F 플랩 · G 착륙장치 · 스페이스 브레이크</div></div>
  </div>`;
  document.body.appendChild(d);
  _cnPed = d;
  d.addEventListener('click', ev => {
    const b = ev.target.closest('[data-cnp]'); if (!b) return;
    const k = b.dataset.cnp, v = b.dataset.v;
    if (k === 'close') cnPedToggle(false);
    else if (k === 'cond') cnCondSet(+b.dataset.i, v);
    else if (k === 'flap') cnFlapSet(+v);
    else if (k === 'gear') cnGearSet(v === 'dn');
    else if (k === 'park') cnParkToggle();
    else if (k === 'trim') { try { if (typeof simTrimNudge === 'function' && simModeOn) simTrimNudge(v, true); } catch (e) { _swallow(e); } }
    cnPedSync();
  });
  // 파워 레버 끌기 — 위 MAX(1) · 22% FLIGHT IDLE(0) · 아래 REV(−0.3)
  const tr = d.querySelector('.cnp-track');
  const set = ev => {
    const r = tr.getBoundingClientRect(), f = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
    cn.pl = f <= 0.78 ? 1 - f / 0.78 : -(f - 0.78) / 0.22 * 0.3;
    cn.pl = Math.max(cn.onGnd ? -0.3 : 0, Math.min(1, cn.pl));
    cnPedSync();
  };
  tr.addEventListener('pointerdown', ev => { ev.preventDefault(); tr.setPointerCapture(ev.pointerId); set(ev); tr._drag = true; });
  tr.addEventListener('pointermove', ev => { if (tr._drag) set(ev); });
  ['pointerup', 'pointercancel'].forEach(t => tr.addEventListener(t, () => { tr._drag = false; }));
}
function cnPedSync() {
  if (!_cnPed || _cnPed.style.display === 'none') return;
  const kn = _cnPed.querySelector('.cnp-knob');
  const f = cn.pl >= 0 ? (1 - cn.pl) * 0.78 : 0.78 + (-cn.pl / 0.3) * 0.22;
  if (kn) kn.style.top = `calc(${(f * 100).toFixed(1)}% - 14px)`;
  const set = (k, t) => { const e = _cnPed.querySelector(`[data-cnv="${k}"]`); if (e) e.textContent = t; };
  set('pl', `PL ${Math.round(cn.pl * 100)}% · TQ ${Math.round(cnTqAvg())}%`);
  set('gear', cn.gearPos > 0.99 ? 'DOWN & LOCKED' : cn.gearPos < 0.01 ? 'UP' : 'IN TRANSIT');
  set('trim', `TRIM ${(-(typeof simTrim !== 'undefined' ? simTrim.pitch : 0)).toFixed(1)}`);
  _cnPed.querySelectorAll('[data-cnp="cond"]').forEach(b => b.classList.toggle('on', cn.cond[+b.dataset.i] === b.dataset.v));
  _cnPed.querySelectorAll('[data-cnp="flap"]').forEach(b => b.classList.toggle('on', +b.dataset.v === cn.flapSel));
  _cnPed.querySelectorAll('[data-cnp="gear"]').forEach(b => b.classList.toggle('on', (b.dataset.v === 'dn') === cn.gearDn));
  _cnPed.querySelectorAll('[data-cnp="park"]').forEach(b => b.classList.toggle('on', !!cnPark()));
}
setInterval(() => { try { if (CN_ON) cnPedSync(); } catch (e) { _swallow(e); } }, 250);
