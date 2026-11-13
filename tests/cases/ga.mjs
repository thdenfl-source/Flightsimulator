// G/A(복행) — FCP FORCE TRIM 아래 버튼. 누르면 컬렉티브·피치 축이 GA 가 된다.
//   ① 40kt 미만: 기수를 지금 자세에서 7.5° 숙여 증속 · 컬렉티브는 고도가 떨어지지 않게만
//   ② 40kt 넘으면: 선택 상승률(기본 1000fpm · 최저 300)로 오르며 속도는 Vy(Vy~VNE 면 지금 속도 · VNE 넘으면 VNE)로
// 목표 속도에 닿고 상승률이 다 붙으면 컬렉티브 VS · 피치 IAS 로 넘어간다. 롤 축은 손대지 않는다.
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = 'G/A';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const fma = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (txt, ...a) { seen.push(String(txt).trim()); return orig.call(this, txt, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen;
    };
    const o = {};
    // 제자리(0kt) 1000ft · 오른쪽으로 10° 기운 채 누른다
    S.spd = 0; S.alt = 1000; S.vs = 0; S.bnk = 10; simTrim.roll = 10; S.tq = tqRequired();   // 트림으로 10° 기울여 둔 상태
    hdgSelOn = false;
    const pit0 = S.pit;
    document.getElementById('ga-btn').click();
    o.on = gaOn; o.btnOn = document.getElementById('ga-btn').classList.contains('on');
    o.phase0 = _gaPhase; o.vy = simVyKt();
    o.fma0 = fma();
    // ① 가속 — 기수를 7.5° 숙이고 고도를 지킨다 · 40kt 를 넘으면 ② 로
    let minAlt = S.alt, maxVs = 0, p1 = null, p2 = null, t2 = null;
    for (let i = 0; i < 40 && gaOn; i++) {
      fly(1); minAlt = Math.min(minAlt, S.alt); if (_gaPhase === 1) maxVs = Math.max(maxVs, S.vs);
      if (i === 3) p1 = { pit: S.pit, dp: pit0 - S.pit, vs: S.vs, cmd: simAfcsVsCmd(), spd: S.spd, ph: _gaPhase };
      if (_gaPhase === 2 && t2 === null) { t2 = i + 1; p2 = { spd: S.spd }; }
      if (t2 !== null && i === t2 + 3) o.c4 = { cmd: simAfcsVsCmd(), spd: S.spd };
    }
    o.p1 = p1; o.p2 = p2; o.p1MaxVs = maxVs;
    o.end = { ga: gaOn, vsm: vsModeOn, sel: selSpd, spd: S.spd, iasOn: simIasOn, hdg: hdgSelOn, bnk: S.bnk };
    o.fma1 = fma();
    fly(15);
    o.vsSteady = S.vs; o.minAlt = minAlt - 1000; o.maxVs = maxVs;
    // VS ▼ 로 내려도 300fpm 아래로는 가지 않는다
    for (let i = 0; i < 20; i++) applyDelta('vs', -100);
    o.vsMin = selVS;
    // 전진 중(60kt · 40kt 넘음)이면 곧바로 ② 상승 · 목표 Vy
    gaRelease(); S.spd = 60; S.bnk = 0; simTrim.roll = 0; gaEngage(); o.fwd = { ph: _gaPhase, tgt: _gaSpdTgt };
    // Vy~VNE 사이(100kt) 면 지금 속도 그대로
    gaRelease(); S.spd = 100; gaEngage(); o.keep = _gaSpdTgt;
    // VNE 넘으면 VNE
    gaRelease(); S.spd = simVne() + 10; gaEngage(); o.over = { tgt: _gaSpdTgt, vne: simVne() };
    // ALT 를 걸면 GA·VS 가 풀린다
    toggleAltHold(); o.altTake = { ga: gaOn, vsm: vsModeOn };
    if (altHoldOn) toggleAltHold();
    gaRelease();
    // SIM 모드가 아니면 걸리지 않는다
    toggleSimMode(false); gaEngage(); o.offSim = gaOn;
    o.joy = { gs: !!JOY_ACT_BY_ID.gs, gspdLbl: JOY_ACT_BY_ID.gspd.label };
    return o;
  })()`);
  t.eq(r.on, true, 'G/A 버튼을 누르면 GA 가 걸린다');
  t.eq(r.btnOn, true, '버튼이 켜진 모양이 된다');
  t.eq(r.phase0, 1, '40kt 미만에서 누르면 ① 가속 단계다');
  const n0 = r.fma0.filter(s => s === 'GA').length;
  t.ok(n0 >= 2, `FMA 컬렉티브·피치 축이 GA 로 보인다 (GA ${n0}개)`);
  t.ok(r.p1.ph === 1 && Math.abs(r.p1.dp - 7.5) < 0.5, `기수를 7.5° 숙여 증속한다 (${r.p1.dp.toFixed(1)}° · 4초 ${r.p1.spd.toFixed(0)}kt)`);
  t.ok(r.p1.cmd < 120 && r.p1MaxVs < 300, `가속 중에는 고도만 지키고 오르지 않는다 (명령 ${r.p1.cmd.toFixed(0)}fpm · 최대 ${r.p1MaxVs.toFixed(0)}fpm)`);
  t.ok(r.p2 && r.p2.spd >= 40 && r.p2.spd < 48, `40kt 를 넘으면 ② 상승으로 (${r.p2 && r.p2.spd.toFixed(0)}kt)`);
  t.ok(r.c4 && r.c4.cmd > 200, `② 에서는 상승률이 붙는다 (4초 뒤 ${r.c4 && r.c4.cmd.toFixed(0)}fpm · ${r.c4 && r.c4.spd.toFixed(0)}kt)`);
  t.eq(r.joy.gs, false, '조이스틱 배정 목록에 ILS 강하선 G/S 는 없다(자동)');
  t.ok(/G\/S/.test(r.joy.gspdLbl) && /GSPD/.test(r.joy.gspdLbl), `조이스틱 G/S 는 지상속도(GSPD) 동작이다 (${r.joy.gspdLbl})`);
  t.eq(r.end.ga, false, `Vy 에 닿고 상승률이 다 붙으면 GA 가 끝난다 (${r.end.spd.toFixed(0)}kt)`);
  t.eq(r.end.vsm, true, '컬렉티브는 VS 모드로 넘어간다');
  t.eq(r.end.sel, r.vy, `피치는 IAS(Vy) 로 넘어간다 (${r.end.sel})`);
  t.eq(r.end.iasOn, true, 'IAS 가 걸려 있다');
  t.ok(r.fma1.includes('VS 1000') && r.fma1.includes('IAS') && !r.fma1.includes('GA'),
    `FMA 가 VS 1000 · IAS 로 바뀐다 (${r.fma1.filter(s => /^(VS|IAS|GA)/.test(s)).join(' / ')})`);
  t.eq(r.end.hdg, false, '롤 축은 커플되지 않는다(HDG 는 조종사 몫)');
  t.ok(r.end.bnk > 5, `기울어 있던 뱅크가 그대로다 (${r.end.bnk.toFixed(1)}°)`);
  t.ok(r.minAlt > -30, `고도가 시작 고도 아래로 빠지지 않는다 (최저 ${r.minAlt.toFixed(0)}ft)`);
  t.ok(r.vsSteady > 700 && r.vsSteady < 1300, `VS 모드에서 약 1000fpm 으로 계속 오른다 (${r.vsSteady.toFixed(0)}fpm)`);
  t.eq(r.vsMin, 300, `VS 는 최저 300fpm 까지만 내려간다 (${r.vsMin})`);
  t.eq(r.fwd.ph, 2, `40kt 넘어서 누르면 곧바로 ② 상승 (${r.fwd.ph})`);
  t.eq(r.fwd.tgt, r.vy, '60kt 면 목표는 Vy');
  t.eq(r.keep, 100, `Vy~VNE 사이면 지금 속도를 지킨다 (${r.keep})`);
  t.eq(r.over.tgt, r.over.vne, `VNE 를 넘으면 VNE 가 기준 (${r.over.tgt})`);
  t.ok(!r.altTake.ga && !r.altTake.vsm, 'ALT 를 걸면 GA·VS 가 풀린다');
  t.eq(r.offSim, false, 'SIM 모드가 아니면 걸리지 않는다');

  // 회전익 특성 + 실제 레버(절대값 축)를 맨 아래에서 켠 뒤 호버에서 G/A — 뒤로 가지 않고 앞으로 가속한다
  // (종전: 레버 자리가 컬렉티브→피치로 기수를 5° 더 들어 −19kt 로 뒤로 갔다)
  const lv = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false, abs: true } };
    rotorChar = true;
    _ax(3, -1); for (const k in _joyNeutral) delete _joyNeutral[k]; joyPoll(600);   // 레버 맨 아래에서 시작
    S.alt = 10; S.spd = 0; S.pit = pitchFromSpd(0); S.vs = 0; simAcc = 0;
    _ax(3, hoverTqRef() / SIM_LEVER_TOP * 2 - 1);
    simTrimReset(); simTrim.pitch = -pitchFromSpd(0); simTrimAct.pitch = simTrim.pitch;
    fly(5);
    const hovPit = S.pit;
    document.getElementById('ga-btn').click();
    let minSpd = 99; for (let i = 0; i < 25; i++) { fly(1); minSpd = Math.min(minSpd, S.spd); }
    const o = { hovPit, minSpd, spd: S.spd, vs: S.vs };
    rotorChar = false; gaRelease(); toggleSimMode(false);
    return o;
  })()`);
  t.ok(Math.abs(lv.hovPit - 8.5) < 0.5, `레버를 맨 아래에서 켜도 호버 자세가 기수 들림 없이 그대로다 (${lv.hovPit.toFixed(1)}°)`);
  t.ok(lv.minSpd > -1 && lv.spd > 55, `회전익 특성·실제 레버로도 G/A 는 뒤로 가지 않고 가속한다 (최저 ${lv.minSpd.toFixed(1)} → 25초 ${lv.spd.toFixed(0)}kt)`);

  await page.evaluate(() => {
    try { gaRelease(); } catch (e) {}
    if (simModeOn) toggleSimMode(false);
    navigator.getGamepads = () => [];
    joyAxes = {}; joyAxCancelCapture(); joyBinds = {}; joyReleaseAll();
    S.running = false; S.bnk = 0; S.pit = 0; S.vs = 0;
  });
}
