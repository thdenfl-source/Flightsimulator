// 배속 — 시뮬 시간만 빨리 흐르고, 계산 결과는 실시간과 같아야 한다.
//
// 배속은 "프레임을 건너뛰는" 방식이 아니라 "한 프레임에 흐를 시간을 늘리는"
// 방식이다. 그래서 잘못 만들면 두 가지가 깨진다.
//   ① 흐른 시간이 배수와 안 맞는다(×8 인데 6배만 간다든지)
//   ② 큰 dt 로 한 번에 적분해 선회 중 항적이 실시간과 어긋난다
// 둘 다 화면만 봐서는 "좀 이상한데" 로 끝나므로 숫자로 잡는다.
export const name = '시뮬 배속';

export async function run(page, t) {
  // ── 흐른 시간이 배수만큼인가 ──
  // 같은 실제 시간(1초) 동안 직선비행 이동거리를 잰다.
  const dist = await page.evaluate(() => {
    const run = (mult, frames, spanMs) => {
      S.lat = 37; S.lon = 127; S.hdg = 90; S.spd = 120; S.bnk = 0; S.alt = 500;
      S.wps = []; S.awp = -1; navApOn = false; hdgSelOn = false;
      gspdOn = false; gspdCoasting = false; windSpd = 0;
      S.running = true; setSimSpeed(mult);
      let ts = 1000; S.lastT = ts;
      for (let i = 0; i < frames; i++) { ts += spanMs / frames; simStep(ts); }
      S.running = false; setSimSpeed(1);
      return distance(37, 127, S.lat, S.lon);
    };
    const d1 = run(1, 60, 1000);
    return { d1, r2: run(2, 60, 1000) / d1, r4: run(4, 60, 1000) / d1,
             r8: run(8, 60, 1000) / d1,
             // 프레임이 튀어도(0.4초짜리 한 프레임 = ×8 이면 시뮬 3.2초) 배수는 같아야 한다.
             // 이때 dt 가 0.2초를 넘지 않게 16번으로 쪼개 돈다.
             // (0.5초를 넘는 프레임은 종전부터 통째로 버린다 — 탭 전환 뒤 순간이동 방지)
             rSlow: run(8, 1, 400) / run(1, 1, 400) };
  });
  t.ok(Math.abs(dist.d1 - 120 / 3600) < 1e-3,
    `실시간 1초에 120kt 로 ${(dist.d1 * 3600).toFixed(1)}kt 만큼 간다`);
  [['r2', 2], ['r4', 4], ['r8', 8]].forEach(([k, n]) => {
    t.ok(Math.abs(dist[k] - n) < 0.02, `×${n} 는 실시간의 ${dist[k].toFixed(3)}배를 간다`);
  });
  t.ok(Math.abs(dist.rSlow - 8) < 0.02,
    `프레임이 0.4초로 튀어도 ×8 만큼 흐른다 (${dist.rSlow.toFixed(3)}배)`);

  // ── 선회 중에도 실시간과 같은 항적인가 ──
  // 큰 dt 로 한 번에 적분하면 선회에서 어긋난다. 쪼개 도는지 여기서 본다.
  const turn = await page.evaluate(() => {
    const fly = (mult, frames, spanMs) => {
      S.lat = 37; S.lon = 127; S.hdg = 360; S.spd = 120; S.bnk = 0; S.alt = 500;
      S.wps = []; S.awp = -1; navApOn = false; gspdOn = false; gspdCoasting = false;
      windSpd = 0; hdgSelOn = true; selHdg = 90; _rollRate = 0; bankTarget = 0;
      S.running = true; setSimSpeed(mult);
      let ts = 1000; S.lastT = ts;
      for (let i = 0; i < frames; i++) { ts += spanMs / frames; simStep(ts); }
      S.running = false; setSimSpeed(1);
      return { hdg: S.hdg, lat: S.lat, lon: S.lon };
    };
    // 시뮬 시간 40초를 실시간 40초(×1)로 / 실시간 5초(×8)로 각각 난다
    const a = fly(1, 2400, 40000);
    const b = fly(8, 300, 5000);
    return { dHdg: Math.abs(normAS(a.hdg - b.hdg)),
             dPos: distance(a.lat, a.lon, b.lat, b.lon), hdg: a.hdg };
  });
  t.ok(turn.dHdg < 1.5,
    `90° 선회 뒤 기수가 실시간과 같다 (차이 ${turn.dHdg.toFixed(2)}°)`);
  t.ok(turn.dPos < 0.05,
    `40초 선회 뒤 위치가 실시간과 같다 (차이 ${(turn.dPos * 1852).toFixed(0)}m)`);

  // ── 버튼 ──
  const ui = await page.evaluate(() => {
    setSimSpeed(4);
    const on = v => document.getElementById('simspd-' + v).classList.contains('active');
    const r = { speed: simSpeed, act4: on(4), act1: on(1) };
    resetSim();                       // 리셋하면 실시간으로 돌아온다
    r.afterReset = simSpeed; r.resetAct1 = on(1);
    setSimSpeed(99);                  // 없는 배속은 실시간으로 떨어진다
    r.bogus = simSpeed;
    // RNP 는 NAV SRC 아래로 옮겼다 — 옮기다 끊어지면 조용히 죽는다
    r.rnpUnderNavSrc = !!document.querySelector('.nav-src-group .rnp-btns');
    setRnp(0.3);
    r.rnp = rnp;
    r.rnpActive = document.getElementById('rnp-03').classList.contains('active');
    setRnp(1);
    return r;
  });
  t.ok(ui.speed === 4 && ui.act4 && !ui.act1, '×4 를 누르면 그 버튼만 켜진다');
  t.ok(ui.afterReset === 1 && ui.resetAct1, 'RESET 하면 실시간(×1)으로 돌아온다');
  t.eq(ui.bogus, 1, '없는 배속 값은 실시간으로 떨어진다');
  t.eq(ui.rnpUnderNavSrc, true, 'RNP 버튼이 NAV SRC 아래에 있다');
  t.ok(ui.rnp === 0.3 && ui.rnpActive, `RNP 는 자리를 옮겨도 그대로 동작한다 (${ui.rnp})`);
}
