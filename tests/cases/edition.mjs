// 판(js/00-edition.js) — 같은 파일로 shinesong(full)과 Flightsimulator(proc)를 낸다 · 다른 것은 시작 비밀번호뿐(기능은 모두 같다)
export const name = '판(edition)';

export async function run(page, t) {
  const cur = await page.evaluate(() => ({ ed: APP_EDITION, sim: SIM_ENABLED, pwProc: window.lockCheck('thdenfl') }));
  // 절차 훈련판으로 다시 띄운다(?edition=proc — 주소에 flightsimulator 가 들어 있을 때와 같다)
  const base = page.url().split('?')[0];
  await page.goto(base + '?edition=proc&ac=aw189');
  await page.waitForFunction(() => typeof S === 'object' && typeof toggleSimMode === 'function', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const P = await page.evaluate(() => {
    const o = { ed: APP_EDITION, sim: SIM_ENABLED, lock: CYCLIC_LOCK, cls: document.documentElement.classList.contains('ed-proc'), pw: window.lockCheck('thdenfl') };
    toggleSimMode(true); o.on1 = simModeOn;
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    o.shown = ['sim3d-btn', 'simmap-btn', 'rotor-3d', 'vstick-btn'].filter(id => !vis(id));
    o.gyro = !vis('gyro-btn');
    o.snd = vis('snd-btn');
    o.sk = [...document.querySelectorAll('#pfd-sk .pfd-sk, #pfd-sk [data-sk]')].map(e => e.textContent.trim()).includes('SIM');
    // 사이클릭 피치 · 롤은 듣지 않고 컬렉티브 · 페달은 듣는다
    window._pad = { index: 0, id: 'P', mapping: '', buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [window._pad]; joyStop(); joyOn = true;
    for (const k in _joyNeutral) delete _joyNeutral[k];
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } }; joyPoll(1000);
    _pad.axes = [0.9, 0.9, 0.9, 0.9]; joyPoll(1016);
    const ax = simModeAxes(); o.ax = ax;
    _pad.axes = [0, 0, 0, 0]; joyPoll(1032);
    // 비퍼 트림은 그대로 — 전후 · 좌우가 트림 자세를 옮긴다
    simTrimReset(); const t0 = Object.assign({}, simTrim); startTrimHold('F'); stopTrimHold(); startTrimHold('R'); stopTrimHold();
    o.trim = simTrim.pitch !== t0.pitch && simTrim.roll !== t0.roll; simTrimReset();
    o.pfd = typeof drawPFD === 'function' && (drawPFD(), true);
    try { selectPanel('right', 'lcon', true); selectPanel('right', 'sysp', true); sysDraw(); o.panels = true; } catch (e) { o.panels = String(e); }
    toggleSimMode(false);
    return o;
  });
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(cur.sim, `지금 판(${cur.ed}) — SIM 있음`);
  t.ok(P.ed === 'proc' && P.sim && !P.lock && !P.cls, `?edition=proc(또는 주소에 flightsimulator) — 절차 훈련판 · SIM 있음 · 사이클릭 잠금 없음 (${P.ed})`);
  t.ok(P.pw && (cur.ed === 'proc' || !cur.pwProc), '시작 비밀번호 — 절차 훈련판은 thdenfl, shinesong 판은 그대로(thdenfl 로는 안 열림)');
  t.ok(P.on1, '절차 훈련판에서도 SIM 모드가 켜진다');
  t.ok(P.shown.length === 0 && !P.gyro && P.sk, `SIM 조작 버튼(GYRO 포함) · PFD 소프트키 SIM 은 종합판과 같다${P.shown.length ? ' (안 보임: ' + P.shown.join(', ') + ')' : ''}`);
  t.ok(Math.abs(P.ax.roll) > 0.5 && Math.abs(P.ax.pitch) > 0.5 && P.ax.coll > 0.5 && P.ax.yaw > 0.5, `사이클릭 피치 · 롤 · 컬렉티브 · 페달이 모두 듣는다 (${JSON.stringify(P.ax)})`);
  t.ok(P.trim, '비퍼 트림(4방향)은 종합판처럼 피치 · 롤 트림 자세를 옮긴다');
  t.ok(P.snd, '절차 훈련판에도 SOUND 버튼은 있다(로터 소리)');
  t.ok(P.pfd && P.panels === true && errs.length === 0, `PFD · 하부 콘솔 · SYSTEM 창은 그대로 돈다${errs.length ? ' (오류: ' + errs.slice(0, 2).join(' | ') + ')' : ''}`);
}
