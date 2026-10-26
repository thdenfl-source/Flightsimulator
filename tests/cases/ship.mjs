// SHIP 난이도 — 배 속도가 설정값 둘레로 흔들리는 폭(상 ±2kt · 중 ±1kt · 하 없음).
//
// GSPD 로 배 위에 따라붙는 훈련에서는 배가 설정 속도를 그대로 지키지 않는 것이
// 곧 난이도다. 흔들림은 무작위라 눈으로는 "좀 흔들리네" 로 끝나므로, 난수를 고정해
// 폭·빠르기·방향을 숫자로 잡고, 실제로 배가 그 속도로 움직이는지도 본다.
export const name = 'SHIP 난이도';

export async function run(page, t) {
  // ── 설정창에 상·중·하가 있고, 고르면 표시·저장이 바뀐다 ──
  const ui = await page.evaluate(() => {
    try { localStorage.removeItem('shipLvl'); } catch (e) { /* 없어도 된다 */ }
    shipSetLvl('LO');
    if (!shipVisible) shipToggleOn();
    openShipPanel();
    shipSetMode('SPD'); shipKey('1'); shipKey('2'); shipKey('ENT');
    const btns = [...document.querySelectorAll('#ship-panel .ship-lvl')].map(b => b.textContent.trim());
    const act = () => [...document.querySelectorAll('#ship-panel .ship-lvl.ship-tab-active')].map(b => b.id);
    const spd = () => document.getElementById('ship-stat-spd').textContent;
    const r = { btns, lo: { act: act(), spd: spd() } };
    document.getElementById('ship-lvl-hi').click();            // 실제 버튼(data-act) 으로 고른다
    r.hi = { lvl: shipLvl, act: act(), spd: spd(), saved: localStorage.getItem('shipLvl') };
    document.getElementById('ship-lvl-mid').click();
    r.mid = { lvl: shipLvl, act: act(), spd: spd() };
    return r;
  });
  t.eq(ui.btns.length, 3, `설정창에 난이도 버튼이 셋 있다 (${ui.btns.join(' / ')})`);
  t.ok(ui.btns[0].startsWith('상') && ui.btns[1].startsWith('중') && ui.btns[2].startsWith('하'),
    '상 · 중 · 하 차례로 놓인다');
  t.eq(ui.lo.act.join(), 'ship-lvl-lo', '처음에는 하(변화 없음)다 — 종전 동작 그대로');
  t.eq(ui.lo.spd, '12kt', `하에서는 설정 속도만 보인다 (${ui.lo.spd})`);
  t.eq(ui.hi.lvl, 'HI', '상을 누르면 상이 된다');
  t.eq(ui.hi.act.join(), 'ship-lvl-hi', '누른 버튼만 켜진다');
  t.eq(ui.hi.spd, '12kt ±2', `설정 속도와 흔들림 폭을 함께 보인다 (${ui.hi.spd})`);
  t.eq(ui.hi.saved, 'HI', '고른 난이도를 기억해 둔다');
  t.eq(ui.mid.spd, '12kt ±1', `중은 ±1kt (${ui.mid.spd})`);

  // ── 흔들림의 폭·빠르기 ── 난수를 고정해 20분을 0.1초 간격으로 돌린다
  const sweep = await page.evaluate(() => {
    const run = (lvl) => {
      let seed = 12345;
      const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      shipSetLvl(lvl);
      let max = -Infinity, min = Infinity, step = 0, prev = shipVar, flips = 0, lastSign = 0;
      for (let i = 0; i < 12000; i++) {
        shipVarStep(0.1, rnd);
        max = Math.max(max, shipVar); min = Math.min(min, shipVar);
        step = Math.max(step, Math.abs(shipVar - prev)); prev = shipVar;
        const s = Math.sign(shipVar);
        if (s && s !== lastSign) { if (lastSign) flips++; lastSign = s; }
      }
      return { max, min, step, flips };
    };
    const r = { hi: run('HI'), mid: run('MID'), lo: run('LO') };
    shipSetLvl('LO');
    return r;
  });
  const { hi, mid, lo } = sweep;
  t.ok(hi.max <= 2 + 1e-9 && hi.min >= -2 - 1e-9,
    `상: ±2kt 를 넘지 않는다 (${hi.min.toFixed(2)} … +${hi.max.toFixed(2)})`);
  t.ok(hi.max >= 1.5 && hi.min <= -1.5, '상: 실제로 ±2kt 가까이까지 흔들린다(중처럼 느껴지지 않게)');
  t.ok(mid.max <= 1 + 1e-9 && mid.min >= -1 - 1e-9,
    `중: ±1kt 를 넘지 않는다 (${mid.min.toFixed(2)} … +${mid.max.toFixed(2)})`);
  t.ok(mid.max >= 0.75 && mid.min <= -0.75, '중: 실제로 ±1kt 가까이까지 흔들린다');
  t.ok(lo.max === 0 && lo.min === 0, '하: 흔들림이 전혀 없다');
  t.ok(hi.step <= 0.01 + 1e-9,
    `갑자기 튀지 않는다 — 0.1초에 ${hi.step.toFixed(3)}kt (초당 0.1kt 한도)`);
  t.ok(hi.flips >= 5, `빨라졌다 느려졌다를 되풀이한다 (20분에 ${hi.flips}번 뒤집힘)`);

  // ── 배가 실제로 그 속도로 간다 ──
  // 설정 10kt 에 +2kt 가 얹혀 있으면 10초에 12kt 만큼 가야 한다. 하로 바꾸면 10kt.
  const move = await page.evaluate(() => {
    const go = (lvl, v) => {
      shipSetLvl(lvl);
      shipVar = v; shipVarTgt = v; shipVarNext = 1e9;          // 흔들림을 그 값에 붙잡아 둔다
      shipSpd = 10; shipHdg = 90; shipLat = 37; shipLon = 127;
      S.running = false; setSimSpeed(1);
      let ts = 1000; S.lastT = ts;
      for (let i = 0; i < 600; i++) { ts += 1000 / 60; simStep(ts); }
      return distance(37, 127, shipLat, shipLon) * 3600 / 10;  // NM / 10초 → kt
    };
    const r = { hi: go('HI', 2), lo: go('LO', 2) };
    // 서 있는 배는 흔들지 않는다
    shipSetLvl('HI'); shipVar = 2; shipSpd = 0;
    r.still = shipSpdNow();
    shipSetLvl('LO');
    return r;
  });
  t.ok(Math.abs(move.hi - 12) < 0.1, `상에서 +2kt 가 얹히면 12kt 로 간다 (${move.hi.toFixed(2)}kt)`);
  t.ok(Math.abs(move.lo - 10) < 0.1, `하로 바꾸면 곧바로 설정 속도 10kt 로 간다 (${move.lo.toFixed(2)}kt)`);
  t.eq(move.still, 0, '서 있는 배(0kt)는 흔들리지 않는다');
  t.eq(page.errors.length, 0, `페이지 오류 없음 ${page.errors.join(' | ')}`);
}
