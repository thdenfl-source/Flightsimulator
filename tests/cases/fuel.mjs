// 연료 계통(18-system.js) — 하부 콘솔 FUEL 패널 · TQS 연료차단 레버 → Fuel 화면 · Aircraft Status · CAS(PFD 메시지).
export const name = '연료 계통';

export async function run(page, t) {
  const R = await page.evaluate(() => {
    localStorage.removeItem('ovhdState'); fuelReset();
    selectPanel('right', 'sysp', true); sysPageSet('asys_fuel');
    const o = {}, wow0 = fuelWow;
    const msgs = () => pfdMsgs().map(m => m.t);
    const tick = (real, sim = 0) => fuelSysTick(real, sim);
    const draw = () => {
      const proto = CanvasRenderingContext2D.prototype, oT = proto.fillText, oR = proto.fillRect, oD = proto.setLineDash, seen = [], fills = [];
      let dash = false;
      proto.fillText = function (x, ...a) { seen.push(String(x).trim()); return oT.call(this, x, ...a); };
      proto.fillRect = function (x, y, ...a) { fills.push(`${this.fillStyle}@${Math.round(x)},${Math.round(y)}`); return oR.call(this, x, y, ...a); };
      proto.setLineDash = function (d) { if (d && d.length) dash = true; return oD.call(this, d); };
      try { sysDraw(); } finally { proto.fillText = oT; proto.fillRect = oR; proto.setLineDash = oD; }
      return { seen, fills, dash };
    };
    tick(0.1); tick(1);
    // ⓪ 주 탱크가 가득 · AUX1/2 · F5 · XFER 모두 AUTO — 이송 펌프가 쉬어 AUX TP1/TP2 · F5 TP 가 안 보이고,
    //    가운데 TP 는 녹색 테에 'AUTO'
    draw(); o.idle = { aux: fuelDrawn.aux.slice(), f5: fuelDrawn.f5Show, tp: fuelDrawn.tpTxt, on: fuelDrawn.tpOn, seen: draw().seen };
    // ① BP 켜짐 — 라인 압력 17 · 18, F/L PRES 없음, BP 심벌
    o.p0 = [fuelPress(1), fuelPress(2)]; o.m0 = msgs().filter(m => /F\/L PRES/.test(m)).length;
    o.bp0 = draw().seen.filter(x => x === 'BP').length;
    // ② BP1 OFF — 9 psi 아래 · 1 F/L PRES · BP1 심벌 LOW · PRESS 1 LOW 호박색
    ovhdSet('bp1', 'OFF'); tick(1);
    const d1 = draw();
    o.p1 = fuelPress(1); o.m1 = msgs().includes('1 F/L PRES'); o.low1 = d1.seen.includes('LOW') && d1.fills.includes('#f2e64b@361,278');
    // ③ X-FEED ENG1 — 점선 · FUEL XFEED(녹) · 5초 뒤 BP2 압력이 1번 라인에(1 F/L PRES 꺼짐) · 엔진 1 은 FT2 에서 먹는다
    ovhdSet('xFeed', 'ENG1'); tick(1);
    o.xf1 = msgs().includes('FUEL XFEED') && msgs().includes('1 F/L PRES') && draw().dash;
    tick(4.2);
    o.xf5 = !msgs().includes('1 F/L PRES') && fuelPress(1) >= 15 && fuelSrc(1) === 2;
    o.xfCol = pfdMsgs().find(m => m.t === 'FUEL XFEED').c;
    sysPageSet('asys_status'); o.stXf = draw().seen.includes('Open'); sysPageSet('asys_fuel');
    ovhdSet('xFeed', 'OFF'); tick(0.5);
    o.xfOff = !msgs().includes('FUEL XFEED') && !draw().dash && msgs().includes('1 F/L PRES');
    ovhdSet('bp1', 'BP1'); tick(1);
    // ③-2 실기 사진 — 두 펌프가 돌 때 X-FEED ENG1: 곧바로는 흰 점선만(가로질러) · 5초 뒤 PRESS 1 LOW(노랑) ·
    //      라인 압력은 19 psi 그대로(BP2 가 ENG1 을 먹인다) · ENG2 로 돌리면 PRESS 2 LOW
    ovhdSet('xFeed', 'ENG1'); tick(1);
    { const d = draw(); o.x1a = d.dash && !d.fills.includes('#f2e64b@361,278') && fuelPress(1) === 19; }
    tick(4.5);
    { const d = draw(); o.x1b = d.fills.includes('#f2e64b@361,278') && !d.fills.includes('#f2e64b@787,277') && fuelPress(1) === 19 && fuelPress(2) === 19 && fuelSrc(1) === 2 && !msgs().includes('1 F/L PRES'); }
    ovhdSet('xFeed', 'ENG2'); tick(5.5);
    { const d = draw(); o.x2 = d.fills.includes('#f2e64b@787,277') && !d.fills.includes('#f2e64b@361,278') && fuelSrc(2) === 1 && fuelSrc(1) === 1; }
    ovhdSet('xFeed', 'OFF'); tick(1);
    o.xOff = !draw().fills.includes('#f2e64b@787,277');
    // ④ XFER LH — FWD → AFT, AFT 98% 에서 저절로 멈춘다(TP ◀ 사라짐)
    fuel.aft -= 100; ovhdSet('xferSel', 'LH'); tick(0.1);
    o.lh = fuelSys.xfer === -1 && (draw(), fuelDrawn.tp === -1);
    const fwd0 = fuel.fwd; for (let i = 0; i < 60; i++) tick(0.05, 10);
    o.lhStop = fuelSys.xfer === 0 && fuel.aft >= 420 * 0.98 && fuel.aft < 420 && fwd0 - fuel.fwd > 90 && (draw(), fuelDrawn.tp === 0);
    // ⑤ XFER RH — AFT → FWD (TP ▶)
    fuelReset(); fuel.fwd -= 100; ovhdSet('xferSel', 'RH'); tick(0.1);
    o.rh = fuelSys.xfer === 1 && (draw(), fuelDrawn.tp === 1);
    // ⑥ XFER AUTO — 땅에서는 쉬고, 비행 중 차 100 넘으면 돌아 ±11 안에서 멈춘다
    fuelReset(); fuelWow = () => true; fuel.aft -= 200; ovhdSet('xferSel', 'AUTO'); tick(0.1);
    o.autoGnd = fuelSys.xfer === 0;
    fuelWow = () => false; tick(0.1); o.autoDir = fuelSys.xfer;
    for (let i = 0; i < 200 && fuelSys.xfer; i++) tick(0.05, 5);
    o.autoBal = Math.abs(fuelLeft() - fuelRight()); o.autoOff = fuelSys.xfer;
    // ⑦ FUEL IMBALANCE — 차 150 넘게(기내 1800 아래) 30초
    fuelReset(); fuelWow = () => true; ovhdSet('xferSel', 'OFF'); fuel.fwd -= 350; tick(0.1, 20);
    o.imb20 = msgs().includes('FUEL IMBALANCE');
    tick(0.1, 11); o.imb31 = msgs().includes('FUEL IMBALANCE') && draw().fills.includes('#f2e64b@263,562');
    fuelWow = wow0;
    // ⑧ F5 XFER — ON: F5 → AFT(TP ▲) · AUTO: 비행 중 AFT 170 아래에서
    fuelReset(); fuel.aft -= 100; ovhdSet('f5Xfer', 'ON'); tick(0.1);
    const f50 = fuel.f5; tick(0.1, 60);
    o.f5Show = (draw(), fuelDrawn.f5Show); ovhdSet('aux1Xfer', 'ON'); o.auxOn = (draw(), fuelDrawn.aux[0]) && draw().seen.filter(x => x === 'TP1').length === 1; ovhdSet('aux1Xfer', 'AUTO');
    o.f5On = fuelSys.f5 && (draw(), fuelDrawn.f5) && Math.round(f50 - fuel.f5) === 14;
    fuelReset(); fuelWow = () => true; ovhdSet('f5Xfer', 'AUTO'); fuel.aft = 160; tick(0.1); o.f5Gnd = fuelSys.f5;
    fuelWow = () => false; tick(0.1); o.f5Auto = fuelSys.f5; fuelWow = wow0;
    // ⑨ MSOV(TQS 연료차단) CLOSE — 압력 0 · MFSOV 1 CLOSE 호박색 · Aircraft Status Closed
    fuelReset(); ovhdSet('fuel1', 'CLOSE'); tick(1);
    o.msov = fuelPress(1) === 0 && draw().fills.includes('#f2e64b@284,231');
    ovhdSet('fuel1', 'OPEN'); tick(1); o.msovOpen = fuelPress(1) >= 15 && !draw().fills.includes('#f2e64b@284,231');
    // ⑩ FUEL 1 LOW
    fuel.ft1 = 100; o.low = msgs().includes('FUEL 1 LOW');
    fuelReset(); ovhdReset('lcon'); localStorage.removeItem('ovhdState'); tick(1);
    selectPanel('right', 'map', true);
    return o;
  });
  t.ok(!R.idle.aux[0] && !R.idle.aux[1] && !R.idle.f5 && !R.idle.seen.includes('TP1') && R.idle.tp === 'AUTO' && R.idle.on && R.idle.seen.includes('AUTO'),
    `주 탱크 가득 · 모두 AUTO — AUX TP1/TP2 · F5 TP 안 보임, 가운데 TP 는 녹색 'AUTO' (${R.idle.tp})`);
  t.ok(R.auxOn && R.f5Show, 'AUX XFER · F5 XFER 를 ON 으로 두면(또는 AUTO 가 이송을 시작하면) TP 가 보인다');
  t.ok(R.p0.join() === '19,19' && R.m0 === 0 && R.bp0 === 2, `BP1 · BP2 켜짐 — 라인 압력 ${R.p0.join(' · ')} psi, F/L PRES 없음, BP 심벌 둘`);
  t.ok(R.p1 < 9 && R.m1 && R.low1, `BP1 OFF — ${R.p1} psi · 1 F/L PRES · BP1 LOW · PRESS 1 LOW 호박색`);
  t.ok(R.xf1, 'X-FEED ENG1 — 교차공급 점선 · FUEL XFEED, 압력은 아직(1 F/L PRES 그대로)');
  t.ok(R.xf5 && R.xfCol === '#22e022' && R.stXf, '약 5초 뒤 BP2 압력이 1번 라인에 — 1 F/L PRES 꺼짐 · 엔진 1 은 FT2 · FUEL XFEED 녹색 · Status Open');
  t.ok(R.x1a && R.x1b, 'X-FEED ENG1(두 펌프 켬) — 흰 점선, 5초 뒤 PRESS 1 LOW 노랑 · 라인 19 psi 그대로 · ENG1 은 FT2 에서(실기 사진)');
  t.ok(R.x2 && R.xOff, 'X-FEED ENG2 — 5초 뒤 PRESS 2 LOW(PRESS 1 은 꺼짐) · OFF 면 꺼진다');
  t.ok(R.xfOff, 'X-FEED OFF — 점선 · FUEL XFEED 사라지고 1 F/L PRES 다시');
  t.ok(R.lh && R.lhStop, 'XFER LH — FWD → AFT(TP ◀), AFT 98% 에서 저절로 멈춘다');
  t.ok(R.rh, 'XFER RH — AFT → FWD(TP ▶)');
  t.ok(R.autoGnd && R.autoDir === -1 && R.autoOff === 0 && R.autoBal <= 11,
    `XFER AUTO — 땅에서는 쉬고 비행 중 차 200 → 이송(${R.autoDir}) → ±11 안에서 멈춤(차 ${R.autoBal.toFixed(1)})`);
  t.ok(!R.imb20 && R.imb31, 'FUEL IMBALANCE — 차 350(기내 1800 아래 기준 150) 30초 넘으면 CAS · Fuel 화면 호박색');
  t.ok(R.f5On && !R.f5Gnd && R.f5Auto, 'F5 XFER — ON: 14 lb/min F5 → AFT(TP ▲) · AUTO: 비행 중 AFT 170 아래에서');
  t.ok(R.msov && R.msovOpen, 'TQS 연료차단 CLOSE — 라인 압력 0 · MFSOV 1 CLOSE 호박색, OPEN 이면 다시');
  t.ok(R.low, 'FUEL 1 LOW — 집합 탱크 165 아래');
}
