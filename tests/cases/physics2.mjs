// 비행 물리 보정 — TAS 로 움직이고 돌기 · 토크 지연과 NR 처짐 · 운동에너지 ↔ 고도(같은 η) ·
// 무게에 따른 상승률 · 횡류 효과. 기준값은 물리식으로 이 파일에서 따로 낸다.
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = '비행 물리 보정';

// ISA 밀도비(지면 15°C · 2°C/1000ft) — 앱 코드를 베끼지 않은 독립 구현
const tasR = (ft) => { const p = Math.pow(1 - 6.87535e-6 * ft, 5.2558797); const T = 288.15 - 2 * ft / 1000; return Math.sqrt(T / (p * 288.15)); };

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const o = {};
    _oatSurfaceC = 15;
    // ── TAS: 10,000ft · IAS 100kt 로 수평 30초 — 실제 간 거리 ──
    const leg = (alt) => {
      S.alt = alt; S.spd = 100; S.hdg = 90; S.bnk = 0; S.vs = 0; S.pit = pitchFromSpd(100);
      simTrimReset(); simTrim.pitch = -pitchFromSpd(100); simTrimAct.pitch = simTrim.pitch; simAcc = 0;
      if (!simIasOn) simIasEngage(); selSpd = 100; if (!altHoldOn) toggleAltHold();
      const la = S.lat, lo = S.lon; fly(30);
      const nm = distance(la, lo, S.lat, S.lon);
      if (altHoldOn) toggleAltHold(); if (simIasOn) simIasRelease();
      return { gs: nm / 30 * 3600, spd: S.spd };
    };
    o.sl = leg(1000); o.hi = leg(11000);
    o.ratio = tasRatio(10000); o.rLo = tasRatio(1000); o.rHi = tasRatio(11000);
    // 선회율 — 같은 뱅크 20° 면 높은 곳(TAS 큼)이 덜 돈다
    const turn = (alt) => { S.alt = alt; S.spd = 100; S.bnk = 20; const h0 = S.hdg; S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 0; i < 20; i++) { ts += 50; simStep(ts); } S.running = false; return normAS(S.hdg - h0); };
    // ── 토크 지연 · NR 처짐 ── 레버를 60 → 100% 로 한 번에
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    S.alt = 2000; S.spd = 80; S.bnk = 0; S.vs = 0;
    const lev = (tq) => _ax(3, tq / SIM_LEVER_TOP * 2 - 1);
    lev(60); fly(3); simNr = 100;
    const tq0 = S.tq; lev(100); fly(0.25);
    o.tq = { t0: tq0, t025: S.tq }; let nrMin = simNr;
    for (let i = 0; i < 20; i++) { fly(0.05); nrMin = Math.min(nrMin, simNr); }
    fly(3); o.tq.t3 = S.tq; o.nr = { min: nrMin, after: simNr };
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } };
    _ax(3, 0);
    // ── 운동에너지 ↔ 고도: 감속·가속에 같은 η ──
    o.eta = [SIM_KE_EFF, SIM_KE_EFF_ACC];
    // ── 무게 ── 남는 토크 10% 의 상승률: 16,000lb 대 20,000lb
    const keepW = window.perfWeightLb;
    o.vs16 = simVsForTq(10);
    window.perfWeightLb = () => 20000; o.vs20 = simVsForTq(10); o.dn20 = simVsForTq(-30);
    window.perfWeightLb = keepW; o.dn16 = simVsForTq(-30);
    // ── 횡류 효과 ──
    rotorChar = true; rcOpt.transverse = true; rotorDir = 'CW';
    rcOpt.blowback = false;
    const tf = (spd, ase) => { aseOn = ase; S.alt = 500; S.spd = spd; S.bnk = 0; simLat = 0; simAcc = 0; simTrimReset();
      simTrim.pitch = -pitchFromSpd(spd); simTrimAct.pitch = simTrim.pitch; S.pit = pitchFromSpd(spd); fly(3); return { tf: simTf, spd: S.spd }; };
    o.tf15 = tf(15, false); o.tf15ase = tf(15, true); o.tf40 = tf(40, false); o.tf5 = tf(5, false);
    rotorDir = 'CCW'; o.tfCcw = tf(15, false); rotorDir = 'CW';
    rcOpt.blowback = true; rotorChar = false; aseOn = false;
    o.turnSl = turn(0); o.turnHi = turn(10000);
    o.chart = { a: autoNrChart(15000, 0), b: autoNrChart(17000, 4000), c: autoNrChart(17000, 12000) };
    { joyAxes = { coll: { i: 3, inv: false, abs: true } }; simEng = 2;
      S.alt = 3000; S.spd = 75; S.pit = pitchFromSpd(75); simTrimReset(); simTrim.pitch = -pitchFromSpd(75); simTrimAct.pitch = simTrim.pitch;
      S.vs = 0; simVsAcc = 0; simNr = 100; _ax(3, -1); fly(15);
      o.np = { nr: simNr, pw: engParams().e1.np };
      joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } }; _ax(3, 0); simTrimReset(); }
    // ── 오토로테이션(두 엔진 IDLE · 80kt) — 레버는 NR 을 다루고(강하율은 크게 안 바뀜), 플레어는 강하를 줄이고, 쿠션은 NR 을 강하와 맞바꾼다
    { joyAxes = { coll: { i: 3, inv: false, abs: true } };
      const lev = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
      S.alt = 8000; S.spd = 80; S.bnk = 0; S.pit = pitchFromSpd(80); simTrimReset(); simTrim.pitch = -pitchFromSpd(80); simTrimAct.pitch = simTrim.pitch;
      simAcc = 0; S.vs = 0; simVsAcc = 0; simNr = 100; lev(tqRequired()); fly(3);
      simEng = 0; const A = {};
      lev(12); fly(14); A.l12 = { vs: S.vs, nr: simNr };
      lev(0); fly(12); A.l0 = { vs: S.vs, nr: simNr, chart: autoNrChart(), np: engParams().e1.np };
      lev(25); fly(10); A.l25 = { vs: S.vs, nr: simNr };
      lev(12); fly(10);
      // 플레어 20° — 강하율이 얼마나 줄어드나
      const v0 = S.vs; let best = v0; simTrim.pitch = -20; simTrimAct.pitch = -20;
      S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 0; i < 8 * 20 && S.spd > 20; i++) { ts += 50; joyPoll(ts); simStep(ts); best = Math.max(best, S.vs); }
      S.running = false; A.flare = { v0, best };
      // 쿠션 — 낮은 속도로 가라앉는 중에 레버를 크게 당기면 1초 안에 강하가 크게 준다(그러나 떠오르지는 않는다)
      simTrim.pitch = -pitchFromSpd(10); simTrimAct.pitch = simTrim.pitch; lev(12); fly(2.5);
      const c0 = S.vs, nr0 = simNr; lev(80); let cMax = c0; fly(0.5); cMax = Math.max(cMax, S.vs); fly(0.5); cMax = Math.max(cMax, S.vs);
      A.cush = { c0, cMax, nr0, nr1: simNr };
      simEng = 2; lev(tqRequired()); fly(2);
      o.auto = A; joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } }; _ax(3, 0); simTrimReset(); }
    // Vy 플레어 — Vy 에서 −500fpm 으로 내려가다 기수를 20° 들면(레버 그대로) 20kt 까지 줄며 강하율이 1,700fpm 남짓 준다
    { joyAxes = { coll: { i: 3, inv: false, abs: true } };
      const vy = simVyKt();
      S.alt = 3000; S.spd = vy; S.bnk = 0; S.pit = pitchFromSpd(vy); simTrimReset(); simTrim.pitch = -pitchFromSpd(vy); simTrimAct.pitch = simTrim.pitch; simAcc = 0;
      simEng = 2; S.vs = -500; simVsAcc = 0; simNr = 100; simFlareVs = 0; simFlareVyVs = 0; _flareV0 = null;
      const tq = tqRequired() + simTqForVs(-500); S.tq = tq; _ax(3, tq / SIM_LEVER_TOP * 2 - 1); fly(10);
      const vs0 = S.vs, pts = []; simTrim.pitch = -20; simTrimAct.pitch = -20;
      let t20 = null; S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 1; i <= 12 * 20 && S.spd > 18; i++) { ts += 50; joyPoll(ts); simStep(ts);
        if (pts.length < 3 && S.spd < [55, 45, 25][pts.length]) pts.push({ spd: S.spd, dvs: S.vs - vs0 });
        if (t20 === null && S.spd < 21) t20 = i / 20; }
      S.running = false;
      o.flare = { vy, vs0, pts, t20, dec: SIM_DEC_TIME };
      simTrimReset(); joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } }; _ax(3, 0); }
    // 롤 반응 — 조종간을 오른쪽 끝까지 밀면 1초에 24° · 피치는 12°/s
    S.alt = 2000; S.spd = 100; S.bnk = 0; S.pit = pitchFromSpd(100); simTrimReset(); simTrim.pitch = -pitchFromSpd(100); simTrimAct.pitch = simTrim.pitch;
    _ax(0, 1); fly(0.5); o.roll05 = S.bnk; fly(0.5); o.roll1 = S.bnk; _ax(0, 0); fly(3);
    toggleSimMode(false);
    return o;
  })()`);
  const want = tasR(10000);
  t.ok(Math.abs(r.ratio - want) < 0.01, `10,000ft TAS/IAS 비 ${r.ratio.toFixed(3)} (ISA ${want.toFixed(3)})`);
  t.ok(Math.abs(r.sl.gs - 100 * tasR(1000)) < 3, `1,000ft 에서는 IAS 100kt 로 TAS ${(100 * tasR(1000)).toFixed(0)}kt 만큼 간다 (${r.sl.gs.toFixed(1)}kt)`);
  t.ok(Math.abs(r.hi.gs - 100 * tasR(11000)) < 4, `11,000ft 에서는 TAS(${(100 * tasR(11000)).toFixed(0)}kt)만큼 간다 (${r.hi.gs.toFixed(1)}kt)`);
  t.ok(r.turnHi < r.turnSl * 0.92, `같은 뱅크면 높은 곳에서 덜 돈다(선회율 = g·tanφ/TAS) (1초 ${r.turnSl.toFixed(2)}° → ${r.turnHi.toFixed(2)}°)`);
  t.ok(r.tq.t025 > r.tq.t0 + 15 && r.tq.t025 < 95, `토크는 레버를 약 0.25초 늦게 따라간다 (${r.tq.t0.toFixed(0)} → 0.25초 ${r.tq.t025.toFixed(0)}%)`);
  t.ok(r.tq.t3 > 97, `곧 다 따라온다 (3초 ${r.tq.t3.toFixed(0)}%)`);
  t.ok(r.nr.min < 99.5 && r.nr.min > 93 && r.nr.after > 99.5, `레버를 급히 올리면 NR 이 잠깐 처졌다 돌아온다 (최저 ${r.nr.min.toFixed(1)}% → ${r.nr.after.toFixed(1)}%)`);
  t.ok(r.eta[0] === r.eta[1], `감속·가속이 같은 η 로 고도와 주고받는다 (${r.eta.join(' · ')})`);
  t.ok(Math.abs(r.vs20 / r.vs16 - 0.8) < 0.01, `무게 20,000lb 면 같은 남는 토크로 16,000lb 의 80% 만 오른다 (${r.vs16.toFixed(0)} → ${r.vs20.toFixed(0)}fpm)`);
  t.ok(Math.abs(r.dn20 / r.dn16 - 0.8) < 0.01, '같은 모자란 토크면 강하율도 무게에 반비례(필요 토크가 무게만큼 커져 결과는 √무게 꼴)');
  t.ok(r.tf15.tf < -1.8 && r.tf15.tf > -2.1, `횡류 효과 — CW 로터 15kt 에서 왼쪽으로 약 2° (${r.tf15.tf.toFixed(2)}° · ${r.tf15.spd.toFixed(0)}kt)`);
  t.ok(r.tfCcw.tf > 1.8, `CCW 로터는 오른쪽 (${r.tfCcw.tf.toFixed(2)}°)`);
  t.ok(Math.abs(r.tf15ase.tf) < 0.7 && Math.abs(r.tf15ase.tf) > 0.4, `ASE 면 SAS 가 대부분 잡는다 (${r.tf15ase.tf.toFixed(2)}°)`);
  t.ok(Math.abs(r.roll05 - 12) < 1 && Math.abs(r.roll1 - 24) < 1, `롤은 24°/s 로 들어간다 — 피치(12°/s)보다 빠르게 (0.5초 ${r.roll05.toFixed(1)}° · 1초 ${r.roll1.toFixed(1)}°)`);
  { const f = r.flare, [p55, p45, p25] = f.pts;
    t.ok(Math.abs(f.vs0 + 500) < 60, `Vy(${f.vy.toFixed(0)}kt) 에서 −500fpm 으로 내려간다 (${f.vs0.toFixed(0)})`);
    t.ok(p55.dvs > 150 && p45.dvs > p55.dvs && p25.dvs > p45.dvs, `기수 20° — 속도가 줄수록 강하율이 점점 준다 (55kt +${p55.dvs.toFixed(0)} · 45kt +${p45.dvs.toFixed(0)} · 25kt +${p25.dvs.toFixed(0)}fpm)`);
    t.ok(p25.dvs > 1200 && p25.dvs < 2100, `20kt 언저리면 약 1,700fpm 줄어 강하가 멎고 오른다 (+${p25.dvs.toFixed(0)}fpm)`);
    t.ok(f.dec === 2.4 && f.t20 > 5.5, `감속 시간은 종전의 120% (Vy → 20kt ${f.t20}초)`); }
  { const A = r.auto;
    t.ok(A.l12.vs < -1600 && A.l12.vs > -2200, `오토로테이션 80kt — 약 1,900fpm (${A.l12.vs.toFixed(0)}fpm)`);
    t.ok(Math.abs(A.l0.nr - A.l0.chart) < 1.5, `컬렉티브 최하단이면 NR 이 자동회전 RPM 수정표 값으로 간다 (${A.l0.nr.toFixed(1)} · 표 ${A.l0.chart.toFixed(1)}%)`);
    t.ok(A.l12.nr < A.l0.nr - 5 && A.l25.nr < A.l12.nr - 5, `레버를 올리면 NR 이 내려간다 — 과속 견제 (0% ${A.l0.nr.toFixed(1)} · 12% ${A.l12.nr.toFixed(1)} · 25% ${A.l25.nr.toFixed(1)}%)`);
    t.ok(Math.abs(A.l25.vs - A.l12.vs) < 250 && A.l0.vs > -2300, `NR 이 90% 위면 레버를 조금 써도 강하율이 크게 늘지 않는다 (12% ${A.l12.vs.toFixed(0)} · 0% ${A.l0.vs.toFixed(0)} · 25% ${A.l25.vs.toFixed(0)}fpm — 종전 −4,000)`);
    t.ok(A.flare.best - A.flare.v0 > 1500, `플레어 20° — 강하율을 1,500fpm 넘게 줄인다 (${A.flare.v0.toFixed(0)} → ${A.flare.best.toFixed(0)}fpm)`);
    t.ok(A.cush.cMax - A.cush.c0 > 800 && A.cush.cMax < 600 && A.cush.nr1 < A.cush.nr0 - 5,
      `쿠션 — 레버를 당기면 NR 을 강하와 맞바꿔 1초 안에 크게 준다(떠오르지는 않는다) (${A.cush.c0.toFixed(0)} → ${A.cush.cMax.toFixed(0)}fpm · NR ${A.cush.nr0.toFixed(0)} → ${A.cush.nr1.toFixed(0)}%)`); }
  t.ok(Math.abs(r.chart.a - 98.7) < 0.2 && Math.abs(r.chart.b - 107.3) < 0.2 && r.chart.c > r.chart.b,
    `자동회전 RPM 수정표 — GW 15,000lb · DA 0 = ${r.chart.a.toFixed(1)}% · GW 17,000lb · DA 4,000ft = ${r.chart.b.toFixed(1)}% · 높을수록 크다`);
  t.ok(r.np.pw === 100 && r.np.nr > 100, `엔진이 돌면 레버를 내려 NR 이 넘쳐도 NP 는 100% (NR ${r.np.nr.toFixed(1)} · NP ${r.np.pw})`);
  t.ok(r.tf40.tf === 0 && r.tf5.tf === 0, `전이양력 지대 밖(5kt · 40kt)에서는 없다 (${r.tf5.tf.toFixed(2)}@${r.tf5.spd.toFixed(0)}kt · ${r.tf40.tf.toFixed(2)}@${r.tf40.spd.toFixed(0)}kt)`);
}
