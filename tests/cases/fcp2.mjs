// FCP 노브 · 버튼(01-state.js · 07-sim.js) — IAS · HDG · CR.HT 는 돌리면 기준만 · 누르면 켜고 끔 · UPLIM · DH 고도 경고(RA/BARO) ·
// NAVD CPL(±50° · RNP 안 결합 / 밖 무장) · BARO STD ⇄ QNH · CRS(FMS 는 OBS 때만) · ALT.A 중 VS 누르면 VS 로
export const name = 'FCP 노브 · 경고';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms)), o = {};
    try { if (typeof simModeOn !== 'undefined' && simModeOn) toggleSimMode(false); } catch (e) { /* 절차 훈련판 */ }
    const push = k => document.querySelector(`#fcp-simple [data-k="${k}"] .fks-push`).click();
    const fma = () => { const seen = [], f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return f.call(this, x, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = f; } return seen; };
    // ① HDG — 돌리면 버그만 · 누르면 그 버그로 걸고 · 다시 누르면 푼다
    if (navApOn) toggleNavAp(); if (hdgSelOn) hdgRelease(); fcpPre.hdg = false;
    S.hdg = 90; selHdg = 90; for (let i = 0; i < 30; i++) applyDelta('hdg', 1);
    o.hdg = { sel: selHdg, on: hdgSelOn }; push('hdg'); o.hdg2 = { sel: selHdg, on: hdgSelOn }; push('hdg'); o.hdgOff = !hdgSelOn;
    // ② IAS — 돌리면 기준만 · 누르면 건다(절차 훈련: 그 속도로)
    if (iasModeOn()) fcpSync('ias'); fcpPre.ias = false; S.spd = 100;
    for (let i = 0; i < 20; i++) applyDelta('spd', 1);
    o.ias = { sel: selSpd, spd: S.spd, on: iasModeOn() }; push('ias'); o.ias2 = { spd: S.spd, on: iasModeOn() }; push('ias'); o.iasOff = !iasModeOn();
    // ③ CR.HT — 돌리면 기준만 · 누르면 그 높이로 걸고 · 다시 누르면 푼다
    if (crhtOn) toggleCrht(); fcpPre.crht = false;
    for (let i = 0; i < 5; i++) applyDelta('crht', 10);
    o.crht = { on: crhtOn, sel: selCrht }; push('crht'); o.crht2 = { on: crhtOn, sel: selCrht }; push('crht'); o.crhtOff = !crhtOn;
    // ④ UPLIM · DH — 경계 고도 · 누르면 RA ⇄ BARO · 넘으면 경고(UPLIM · MINIMUMS)
    altLim.up.v = 0; altLim.dh.v = 0; altLim.up.src = 'BARO'; altLim.dh.src = 'RA';
    S.alt = 1000; applyDelta('uplim', 1); o.up0 = altLim.up.v; for (let i = 0; i < 4; i++) applyDelta('uplim', 1); o.up1 = altLim.up.v;
    push('uplim'); o.upSrc = altLim.up.src; push('uplim'); o.upSrc2 = altLim.up.src;
    const n0 = altLimAlertCount; S.alt = altLim.up.v + 50; altLimTick(); altLimTick(); o.upAlert = altLimAlertCount - n0; o.upMsg = pfdMsgs().some(m => m.t === 'UPLIM');
    S.alt = altLim.up.v - 100; altLimTick(); o.upClr = !altLim.up.over;
    altLim.dh.v = 0; altLim.dh.src = 'BARO'; altLim.dh.v = 500; S.alt = 400; altLimTick(); o.dhMsg = pfdMsgs().some(m => m.t === 'MINIMUMS'); S.alt = 1000; altLimTick();
    altLim.up.v = 0; altLim.dh.v = 0; fcpsSync(); o.offTxt = document.getElementById('fks-uplim').textContent;
    // ⑤ BARO — 누르면 STD, 다시 누르면 앞의 QNH
    window._qnhHpa = 1005; fcpsBaroStd(); o.baro1 = window._qnhHpa; fcpsBaroStd(); o.baro2 = window._qnhHpa;
    // ⑥ ALT.A 가는 중 VS 누르면 — ALT 무장만 거두고 VS 로
    S.alt = 1000; altHoldOn = false; vsModeOn = false; altaSel = 3000; selVS = 800; altaPush();
    o.arm = altArmed && vsModeOn; vsPush(); o.vsOnly = vsModeOn && !altArmed && selVS === 800; vsPush();
    // ⑦ NAVD CPL — 코스에서 50° 넘게 벗어나 다가가면 무장(흰) · 들어오면 결합
    if (navApOn) toggleNavAp(); navArmed = false;
    try { clearFP(); } catch (e) { /* */ }
    navSrc = 'FMS'; obsOn = false; rnp = 1.0;
    pushWP({ ident: 'NAVT', lat: S.lat + 0.3, lon: S.lon }); selectWP(S.wps.length - 1); updateNav();
    const crs = activeCrs();
    S.hdg = normA(crs + 90); document.getElementById('fks-navd').click();
    o.nav1 = { armed: navArmed, on: navApOn, fmaArm: fma().includes('NAV') };
    S.hdg = normA(crs + 20); navArmStep();
    o.nav2 = { armed: navArmed, on: navApOn };
    document.getElementById('fks-navd').click(); o.navOff = !navApOn;
    // 코스선에서 RNP 보다 멀면(기수는 맞아도) 무장
    rnp = 0.1; const [la, lo] = destPoint(S.lat, S.lon, normA(crs + 90), 2); const sl = S.lat, so = S.lon; S.lat = la; S.lon = lo; updateNav();
    S.hdg = crs; document.getElementById('fks-navd').click(); o.navFar = navArmed && !navApOn; navArmed = false; S.lat = sl; S.lon = so; rnp = 1.0;
    // CRS 누름 — FMS 에서 OBS 가 꺼져 있으면 코스 그대로
    const c0 = S.crs; S.lat += 0.05; fcpSync('crs'); o.crsKeep = S.crs === c0; S.lat -= 0.05;
    try { clearFP(); } catch (e) { /* */ }
    return o;
  });
  t.ok(r.hdg.sel === 120 && !r.hdg.on && r.hdg2.on && r.hdg2.sel === 120 && r.hdgOff, `HDG — 돌리면 버그만(120°, 꺼진 채) · 누르면 그 버그로 걸고 · 다시 누르면 푼다`);
  t.ok(r.ias.sel === 120 && r.ias.spd === 100 && !r.ias.on && r.ias2.on && r.ias2.spd === 120 && r.iasOff, `IAS — 돌리면 기준만(120kt, 속도 그대로) · 누르면 건다 · 다시 누르면 푼다 (${JSON.stringify(r.ias)})`);
  t.ok(!r.crht.on && r.crht2.on && r.crht2.sel === r.crht.sel && r.crhtOff, `CR.HT — 돌리면 기준만(${r.crht.sel}ft) · 누르면 그 높이로 걸고 · 다시 누르면 푼다`);
  t.ok(r.up0 === 1000 && r.up1 === 1400 && r.upSrc === 'RA' && r.upSrc2 === 'BARO', `UPLIM — 처음 돌리면 지금 고도 언저리(${r.up0}) · 100ft 씩(${r.up1}) · 누르면 RA ⇄ BARO`);
  t.ok(r.upAlert === 1 && r.upMsg && r.upClr && r.dhMsg, 'UPLIM 위로 올라서면 한 번 경고 + PFD UPLIM · 돌아오면 풀림 · DH 아래면 MINIMUMS');
  t.ok(/^OFF/.test(r.offTxt), `0 까지 돌리면 OFF (${r.offTxt})`);
  t.ok(r.baro1 === 1013.25 && r.baro2 === 1005, `BARO 누름 — STD(${r.baro1}) ⇄ 앞의 QNH(${r.baro2})`);
  t.ok(r.arm && r.vsOnly, 'ALT.A 가는 중 VS 를 누르면 ALT 무장만 거두고 VS 로(승강률 그대로)');
  t.ok(r.nav1.armed && !r.nav1.on && r.nav1.fmaArm && !r.nav2.armed && r.nav2.on && r.navOff, `NAVD CPL — 코스에서 90° 면 무장(흰 NAV) · 20° 로 들어오면 결합 · 누르면 해제 (${JSON.stringify(r.nav1)} → ${JSON.stringify(r.nav2)})`);
  t.ok(r.navFar, 'NAVD CPL — 기수는 맞아도 코스선에서 RNP 밖이면 무장만');
  t.ok(r.crsKeep, 'CRS 누름 — FMS 에서 OBS 가 꺼져 있으면 비행계획 코스 그대로');
}
