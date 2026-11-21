// 비행 모델 다듬기 — 지면효과 곡선(꺾임 없이) · 감속 플레어 운동에너지 예산 · 흰수리 LTE · 기종별 VRS
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = '비행 모델 · 지면효과 · LTE · VRS';

export async function run(page, t) {
  // ── 지면효과 — 0 · 3 · 5 · 10ft 기준점은 그대로, 위아래로 꺾임 없이 OGE 까지 ──
  const ige = await page.evaluate(() => {
    const f = h => igeTqAt(h, 70, 80), o = { pts: [0, 3, 5, 10].map(h => +f(h).toFixed(2)), top: igeNoneFt() };
    let mono = true;
    for (let h = 0; h <= 70; h += 0.25) if (f(h + 0.25) < f(h) - 1e-9) mono = false;
    // 이음매(3 · 5 · 10ft · 꼭대기)에서 왼쪽 · 오른쪽 기울기가 같다(꺾이지 않는다)
    const e = 0.01, kink = h => Math.abs((f(h + e) - f(h)) / e - (f(h) - f(h - e)) / e);
    o.mono = mono; o.maxJump = Math.max(kink(3), kink(5), kink(10), kink(o.top - 0.001));
    o.s10 = [(f(10) - f(9.5)) / 0.5, (f(10.5) - f(10)) / 0.5]; o.at53 = f(o.top); o.at20 = f(20);
    return o;
  });
  t.eq(ige.pts.join(','), '58,60,65,70', '지면효과 기준점(0 · 3 · 5 · 10ft = HOV −12 · −10 · −5 · 0)은 그대로');
  t.ok(ige.mono && Math.abs(ige.s10[0] - ige.s10[1]) < 0.15 && ige.maxJump < 0.1,
    `지면효과 곡선이 꺾임 없이 오른다 — 10ft 앞뒤 기울기 ${ige.s10.map(x => x.toFixed(2)).join(' · ')}%/ft · 이음매 꺾임 최대 ${ige.maxJump.toFixed(2)}`);
  t.ok(Math.abs(ige.at53 - 80) < 1e-6 && ige.at20 > 74 && ige.at20 < 77, `흰수리 — ${ige.top}ft 에서 OGE · 20ft ${ige.at20.toFixed(1)}%(Cheeseman–Bennett)`);

  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})(); const fly = ${SIM_FLY_SRC};
    joyAxes.coll = { i: 3, inv: false, abs: true };
    const lever = t => _ax(3, 2 * t / SIM_LEVER_TOP - 1);
    const run = (secs, pitchAx) => { const vs = []; S.running = true; let ts = 1000; S.lastT = ts; _ax(1, pitchAx);
      for (let i = 0; i < secs * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); vs.push(S.vs); }
      S.running = false; return vs; };
    const o = {};
    // ── 감속 플레어 — 80kt 에서 기수를 들어 세운다(레버 호버 −10% · −20%) ──
    const stop = d => { S.alt = 1000; S.spd = 80; S.vs = 0; S.pit = 0; S.bnk = 0; bankTarget = 0; simAcc = 0; simVsAcc = 0; _ax(0, 0); _ax(1, 0); _ax(2, 0);
      const tq = tqRequired(); S.tq = tq; lever(tq); run(3, 0); const a0 = S.alt; lever(tqRequiredAt(0, 0) + d); const v = run(20, -0.6);
      return { gain: S.alt - a0, peak: Math.max(...v), bud: _flareBudFt, used: _flareUsedFt }; };
    o.q10 = stop(-10); o.q20 = stop(-20);
    _ax(1, 0);
    // ── LTE — 흰수리(로터 CW · 기수는 왼쪽으로 돈다) · 상대풍 060° · 20kt ──
    (${SIM_SETUP_SRC})(); S.spd = 5; S.pit = pitchFromSpd(5); simTrimHoldSpeed(); S.alt = 500;
    windSpd = 20; windDir = normA(S.hdg + 60); fly(1);
    let h0 = S.hdg; fly(3); o.lte = { dh: normAS(S.hdg - h0), yaw: simLte.yaw, warned: simLte.warned, react: lteReact() };
    _ax(2, 1); fly(3); o.ped = simLte.yaw; _ax(2, 0);
    // 같은 바람을 Bell 쪽 방위(300°)로 받으면 흰수리는 거의 돌지 않는다
    (${SIM_SETUP_SRC})(); S.spd = 5; S.pit = pitchFromSpd(5); simTrimHoldSpeed(); S.alt = 500;
    windSpd = 20; windDir = normA(S.hdg + 300); fly(1); h0 = S.hdg; fly(3); o.lteMirror = normAS(S.hdg - h0);
    // 앞바람이면 없다
    windDir = normA(S.hdg); fly(3); o.head = simLte.yaw;
    windSpd = 0;
    o.vrsK = vrsK();
    return o;
  })()`);
  t.ok(r.q10.gain < 170 && r.q10.gain > 40 && r.q10.used <= r.q10.bud * 1.1 + 1,
    `감속 플레어 — 운동에너지 예산(${r.q10.bud.toFixed(0)}ft) 안에서 (레버 호버 −10%: ${Math.round(r.q10.gain)}ft · 종전 228ft · 최대 ${Math.round(r.q10.peak)}fpm · 플레어 몫 ${r.q10.used.toFixed(0)}ft)`);
  t.ok(r.q20.gain < 50, `레버를 호버 −20% 로 내리면 거의 떠오르지 않는다 (${Math.round(r.q20.gain)}ft · 종전 127ft)`);
  t.ok(r.lte.react === -1 && r.lte.dh < -15 && r.lte.warned, `흰수리 LTE — 상대풍 060° · 20kt 에서 기수가 왼쪽으로 저절로 돈다 (${r.lte.dh.toFixed(0)}° / 3초)`);
  t.ok(Math.abs(r.ped) < Math.abs(r.lte.yaw) * 0.5, `오른쪽 페달 끝까지 밟으면 맞선다 (${r.lte.yaw.toFixed(1)} → ${r.ped.toFixed(1)}°/s)`);
  t.ok(Math.abs(r.lteMirror) < 5 && Math.abs(r.head) < 1, `Bell 의 위험 방위(300°)는 흰수리에게 거울 쪽이라 거의 돌지 않는다 (${r.lteMirror.toFixed(1)}°) · 앞바람 없음`);
  t.ok(Math.abs(r.vrsK - 1) < 0.15, `흰수리 VRS 배율 ${r.vrsK.toFixed(2)}(기준 700fpm)`);

  // ── Bell 206 — VRS 는 원판 하중이 작아 더 얕은 강하에서 ──
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const b = await page.evaluate(`(() => { (${SIM_SETUP_SRC})(); const FLY = ${SIM_FLY_SRC};
    const o = { k: vrsK(), react: lteReact() };
    S.spd = 5; S.pit = pitchFromSpd(5); simTrimHoldSpeed(); S.alt = 500;
    windSpd = 20; windDir = normA(S.hdg + 300); FLY(1); const h0 = S.hdg; FLY(3); o.dh = normAS(S.hdg - h0); windSpd = 0;
    return o; })()`);
  t.ok(b.k > 0.45 && b.k < 0.65, `Bell 206 VRS 배율 ${b.k.toFixed(2)} — 약 ${Math.round(700 * b.k)}fpm 강하에서 든다`);
  t.ok(b.react === 1 && b.dh > 20, `Bell 206 LTE 는 그대로 오른쪽 (${b.dh.toFixed(0)}° / 3초)`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
