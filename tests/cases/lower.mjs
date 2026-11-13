// LOWER CONSOLE(하부 콘솔) — 탭 'LOWER' 로 여는 하부 콘솔(js/19-lower.js). 상부 콘솔과 같은 엔진·저장소.
// 눌러 두는 버튼(lpb) · 키(key) · 표시등(lamp) 과 연동(PARKING BRAKE · FUEL 패널 · AFCAU AP1/AP2)을 본다.
import { SIM_SETUP_SRC } from './simmode.mjs';
export const name = '하부 콘솔';

export async function run(page, t) {
  await page.evaluate(() => { localStorage.removeItem('ovhdState'); selectPanel('right', 'lcon', true); });
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const w = document.getElementById('lcon-wrap');
    const ids = LCON_PLATES.flatMap(p => p.items.filter(i => i.id).map(i => i.id));
    return { shown: !w.classList.contains('page-hidden') && w.getBoundingClientRect().width > 100,
             tab: !!document.querySelector('#page-tabs [data-sel="lcon"].active'),
             plates: w.querySelectorAll('.ov-plate').length, ctrls: w.querySelectorAll('[data-ov]').length, defs: ids.length,
             lamps: w.querySelectorAll('.ov-lamp').length,
             panels: ['AHRS', 'AUTO TRIM', 'TRIM FEEL', 'MAP', 'EMERG', 'CABLE CUT', 'CPI CONTROLLER', 'X-FEED', 'XFER', 'PUSH ON', 'AVCS', 'MPP', 'RADAR',
                      'NOSE WHEEL LOCK', 'PARKING BRAKE'].filter(s => !w.textContent.includes(s)) };
  });
  t.ok(info.shown && info.tab, 'LOWER 탭으로 하부 콘솔이 열린다');
  t.eq(info.plates, 15, '판 열다섯 장(왼쪽 ⑰ ~ ⑪ · 빈 판 둘 · 오른쪽 ⑥ ~ ⑩ · NOSE WHEEL LOCK/PARKING BRAKE)');
  t.ok(info.ctrls === info.defs && info.ctrls >= 70 && info.lamps === 8, `스위치·버튼이 다 그려진다 (${info.ctrls}/${info.defs}개 · 표시등 ${info.lamps})`);
  t.eq(info.panels.length, 0, `그림의 패널 글자가 다 있다${info.panels.length ? ' (없음: ' + info.panels.join(', ') + ')' : ''}`);

  const press = async (sel, hold = 0) => {
    const b = await page.locator(sel).first().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    if (hold) await page.waitForTimeout(hold);
    await page.mouse.up(); await page.waitForTimeout(30);
  };
  const get = id => page.evaluate(i => ovhdGet(i), id);
  // 눌러 두는 버튼 — 누르면 IN(글씨가 켜진다), 한 번 더 누르면 OUT
  await press('[data-ov="ap1"] .ov-hit');
  const a1 = await get('ap1'), lit = await page.evaluate(() => document.querySelector('[data-ov="ap1"]').classList.contains('in'));
  await press('[data-ov="ap1"] .ov-hit');
  t.ok(a1 === 'IN' && lit && await get('ap1') === 'OUT', `AFCAU AP1 OFF — 누르면 들어가 글씨가 켜지고 다시 누르면 나온다 (${a1})`);
  // 키 — 누르는 동안만 · 표시등(FLOATS TEST 를 누르는 동안 켜진다)
  const b0 = await page.locator('[data-ov="fltTest"] .ov-hit').boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await page.mouse.down(); await page.waitForTimeout(40);
  const during = await page.evaluate(() => [ovhdGet('fltTest'), document.querySelectorAll('#lcon-wrap .ov-lamp.on').length]);
  await page.mouse.up(); await page.waitForTimeout(40);
  const after = await page.evaluate(() => [ovhdGet('fltTest'), document.querySelectorAll('#lcon-wrap .ov-lamp.on').length]);
  t.ok(during[0] === 1 && during[1] === 8 && after[0] === 0 && after[1] === 0,
    `FLOATS TEST 키 — 누르는 동안만 BTL 표시등 8개가 켜진다 (${during.join('/')} → ${after.join('/')})`);
  // 레버 — PARKING BRAKE RELEASE · EMER · SET(누름쇠 없이 바로 오간다)
  await press('[data-ov="parkBrake"] [data-hz="p2"]'); const pk2 = await get('parkBrake');
  await press('[data-ov="parkBrake"] [data-hz="p0"]'); const pk0 = await get('parkBrake');
  await press('[data-ov="parkBrake"] [data-hz="p1"]'); const pk1 = await get('parkBrake');
  await press('[data-ov="parkBrake"] [data-hz="p0"]');
  t.ok(pk2 === 'SET' && pk0 === 'RELEASE' && pk1 === 'EMER', `PARKING BRAKE 레버 SET · RELEASE · EMER 를 고를 수 있다 (${pk2} · ${pk0} · ${pk1})`);
  // 연동
  const L = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const o = {};
    ovhdSet('parkBrake', 'SET'); o.parkOn = simParkBrake === true && simParkBrakeOn() && !simEmerBrake;
    ovhdSet('parkBrake', 'EMER'); o.emer = simEmerBrakeOn() && !simParkBrake;
    const seen = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return orig.call(this, x, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    o.emerPfd = seen.includes('EMER BRAKE');
    o.order = GND_WHEEL_BRK < GND_EMER_BRK && GND_EMER_BRK < GND_PARK_BRK;
    ovhdSet('parkBrake', 'RELEASE'); o.parkOff = simParkBrake === false && simEmerBrake === false;
    simSpaceDown(1000); simSpaceUp(); simSpaceDown(1400); simSpaceUp();      // 스페이스 두 번 — 파킹 SET
    o.spaceSet = ovhdGet('parkBrake') === 'SET' && simParkBrake;
    simSpaceDown(5000); simSpaceUp(); simSpaceDown(5400); simSpaceUp();
    o.spaceRel = ovhdGet('parkBrake') === 'RELEASE' && !simParkBrake;
    selectPanel('right', 'sysp', true);
    const texts = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (x, ...a) { seen.push(String(x).trim()); return orig.call(this, x, ...a); };
      try { sysDraw(); } finally { proto.fillText = orig; }
      return seen;
    };
    return new Promise(res => setTimeout(() => {
      sysPageSet('asys_status'); const s0 = texts();
      ovhdSet('xFeed', 'ENG1'); ovhdSet('aux1Xfer', 'ON'); const s1 = texts();
      o.xfeed = s1.filter(x => x === 'Open').length === s0.filter(x => x === 'Open').length + 1;   // MFSOV 의 Open 둘에 Crossfeed 가 더해진다
      o.aux = s1.includes('On');
      sysPageSet('asys_fuel'); fuel.aft -= 100; ovhdSet('xferSel', 'LH'); sysTick(); texts(); o.tp = fuelDrawn.tp === -1; fuelReset();
      sysPageSet('asys_afcs'); aseOn = true; const f0 = texts().filter(x => x === 'ON').length;
      ovhdSet('ap1', 'IN'); const f1 = texts().filter(x => x === 'ON').length;
      o.afcs = [f0, f1];
      ovhdReset('lcon'); aseOn = false; sysPageSet('asys_fuel');
      toggleSimMode(false); selectPanel('right', 'map', true); localStorage.removeItem('ovhdState');
      res(o);
    }, 150));
  })()`);
  t.ok(L.parkOn && L.parkOff, 'PARKING BRAKE 레버 SET · RELEASE 가 SIM 파킹 브레이크를 걸고 푼다');
  t.ok(L.emer && L.emerPfd && L.order, 'EMER — 비상 브레이크(세기는 스페이스 6 < EMER 9 < SET 12 kt/s) · PFD 에 EMER BRAKE');
  t.ok(L.spaceSet && L.spaceRel, '스페이스 두 번으로 파킹을 걸고 풀면 레버도 SET · RELEASE 로 따라간다');
  t.ok(L.xfeed && L.aux, 'FUEL 패널 X-FEED · AUX1 XFER 가 Aircraft Status(Crossfeed Valve Open · E-AUX1 On)에 보인다');
  t.ok(L.tp, 'FUEL 패널 XFER LH — Fuel 화면 TP 에 왼쪽 이송 화살표(◀)');
  t.ok(L.afcs[0] === 6 && L.afcs[1] === 3, `AFCAU AP1 OFF 를 누르면 AFCS 화면 레인 1 이 OFF (ON ${L.afcs[0]} → ${L.afcs[1]})`);
}
