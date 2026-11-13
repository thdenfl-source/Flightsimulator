// 판(js/00-edition.js) — 같은 파일로 shinesong(full · SIM 있음)과 Flightsimulator(proc · SIM 없음)를 낸다
export const name = '판(edition)';

export async function run(page, t) {
  const cur = await page.evaluate(() => ({ ed: APP_EDITION, sim: SIM_ENABLED }));
  // 절차 훈련판으로 다시 띄운다(?edition=proc — 주소에 flightsimulator 가 들어 있을 때와 같다)
  const base = page.url().split('?')[0];
  await page.goto(base + '?edition=proc');
  await page.waitForFunction(() => typeof S === 'object' && typeof toggleSimMode === 'function', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const P = await page.evaluate(() => {
    const o = { ed: APP_EDITION, sim: SIM_ENABLED, cls: document.documentElement.classList.contains('ed-proc') };
    toggleSimMode(true); o.on1 = simModeOn; simModeBtnPress(); o.on2 = simModeOn;
    const hidden = id => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none'; };
    o.hidden = ['sim3d-btn', 'simmap-btn', 'rotor-3d', 'ase-3d', 'eng-3d', 'snd-btn', 'vstick-btn', 'gyro-btn'].filter(id => !hidden(id));
    o.sk = [...document.querySelectorAll('#pfd-sk .pfd-sk, #pfd-sk [data-sk]')].map(e => e.textContent.trim()).includes('SIM');
    o.pfd = typeof drawPFD === 'function' && (drawPFD(), true);
    try { selectPanel('right', 'lcon', true); selectPanel('right', 'sysp', true); sysDraw(); o.panels = true; } catch (e) { o.panels = String(e); }
    return o;
  });
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(cur.ed === 'full' && cur.sim, `shinesong 판은 full — SIM 있음 (${cur.ed})`);
  t.ok(P.ed === 'proc' && !P.sim && P.cls, `?edition=proc(또는 주소에 flightsimulator) — 절차 훈련판 (${P.ed})`);
  t.ok(!P.on1 && !P.on2, '절차 훈련판에서는 SIM 모드가 켜지지 않는다(toggleSimMode · SIM 버튼)');
  t.eq(P.hidden.length, 0, `SIM 조작 버튼이 감춰진다${P.hidden.length ? ' (보임: ' + P.hidden.join(', ') + ')' : ''}`);
  t.ok(!P.sk, 'PFD 소프트키 SIM 칸이 빈칸');
  t.ok(P.pfd && P.panels === true && errs.length === 0, `PFD · 하부 콘솔 · SYSTEM 창은 그대로 돈다${errs.length ? ' (오류: ' + errs.slice(0, 2).join(' | ') + ')' : ''}`);
}
