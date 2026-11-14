// Bell 206 SIM — 저중력(Low-G) · 마스트 범핑 · LTE(14-simmode.js simB206Hazards)
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = 'Bell 206 SIM';

export async function run(page, t) {
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const R = await page.evaluate(`(async () => { (${SIM_SETUP_SRC})(); const FLY = ${SIM_FLY_SRC};
    window.uiAlert = m => { window._al = m; return Promise.resolve(); };
    const o = {};
    S.spd = 90; S.pit = pitchFromSpd(90); simTrimHoldSpeed(); FLY(3);
    // 기수를 조금 숙이는 보통 조작 — 저중력 아님
    _ax(1, 0.15); FLY(2); o.small = { warned: simLowG.warned, r: simLowG.r }; _ax(1, 0); FLY(3);
    // 급히 밀기 — 저중력 · 오른쪽 롤
    _ax(1, 1); FLY(1.2); o.push = { n: simLowG.n, r: simLowG.r, bnk: S.bnk, warned: simLowG.warned };
    _ax(1, 0); FLY(3); o.rec = { n: simLowG.n, r: simLowG.r };
    // 저중력에서 왼쪽 사이클릭 — 마스트 범핑(비행이 멈춘다)
    const b0 = simMastBumpN; _ax(1, 1); FLY(0.8); _ax(0, -1); FLY(1.5); o.bump = { n: simMastBumpN - b0, run: S.running, al: !!window._al };
    _ax(0, 0); _ax(1, 0);
    // LTE — 저속 · 바람 20kt · 상대풍 300°
    (${SIM_SETUP_SRC})(); S.spd = 5; S.pit = pitchFromSpd(5); simTrimHoldSpeed(); S.alt = 500;
    windSpd = 20; windDir = normA(S.hdg + 300); FLY(1);
    const h0 = S.hdg; FLY(3); o.lte = { dh: normAS(S.hdg - h0), yaw: simLte.yaw, warned: simLte.warned };
    const yNo = simLte.yaw; _ax(2, -1); FLY(3); o.left = simLte.yaw; _ax(2, 0);
    windDir = normA(S.hdg); FLY(3); o.head = simLte.yaw;
    windSpd = 0;
    // 유압이 없으면 사이클릭에 뱅크가 굼뜨게 따라온다
    (${SIM_SETUP_SRC})(); S.spd = 90; S.pit = pitchFromSpd(90); simTrimHoldSpeed(); FLY(2);
    _ax(0, 0.5); FLY(0.5); o.bnkHyd = S.bnk; _ax(0, 0); FLY(3);
    b206HydFail(true); _ax(0, 0.5); FLY(0.5); o.bnkNoHyd = S.bnk; _ax(0, 0); FLY(3); b206HydFail(false);
    // 돌풍 — 자세가 조금씩 흔들린다
    envSet({ gust: 20 }); const bs = []; for (let i = 0; i < 20; i++) { FLY(0.5); bs.push(simTurb.r); } envSet({ gust: 0 });
    o.turb = Math.max(...bs) - Math.min(...bs);
    // 오토로테이션 착지 평가 — 엔진 고장 · 낮게 · 천천히 내려앉기
    (${SIM_SETUP_SRC})(); S.spd = 10; S.pit = pitchFromSpd(10); simTrimHoldSpeed(); window._tcElev = () => 30; S.alt = 30 / 0.3048 + 30;
    b206cFail(true); simAuto.flareAgl = 40; S.vs = -200; simNr = 95;
    simTouchdown(-200, 8); o.td1 = simAuto.last; simTouchdown(-900, 30); o.td2 = simAuto.last;
    b206cFail(false); b206c.run = true; b206c.th = 'FULL'; _b206cApply();
    // 꼬리로터 구동 상실 — 페달이 듣지 않고 기수가 돈다 · 40kt 넘으면 꼬리날개가 잡는다
    (${SIM_SETUP_SRC})(); S.spd = 5; S.pit = pitchFromSpd(5); simTrimHoldSpeed(); S.alt = 1500; FLY(1);
    simTrFailSet('drive'); let h1 = S.hdg; _ax(2, 1); FLY(3); o.trSlow = Math.abs(normAS(S.hdg - h1)); _ax(2, 0);
    S.spd = 80; S.pit = pitchFromSpd(80); simTrimHoldSpeed(); FLY(4); h1 = S.hdg; FLY(3); o.trFast = Math.abs(normAS(S.hdg - h1));
    simTrFailSet(null);
    // VRS 회복 평가 — 빠뜨린 뒤 앞으로 나가 회복
    (${SIM_SETUP_SRC})(); window._tcElev = () => null; S.spd = 3; S.pit = pitchFromSpd(3); simTrimHoldSpeed(); S.alt = 2000; FLY(1);
    simVrs = 1; S.vs = -1500; simVrsEval(false); simVrsRec.alt0 = 2200;
    S.spd = 40; S.pit = pitchFromSpd(40); simVrs = 0; S.vs = -200; S.alt = 2100; simVrsEval(false); o.vrs = simVrsRec.last;
    return o; })()`);
  t.ok(!R.small.warned && R.small.r < 1, '기수를 조금 숙이는 보통 조작은 저중력이 아니다');
  t.ok(R.push.n < 0.5 && R.push.r > 5 && R.push.bnk > 5 && R.push.warned,
    `급히 밀면 저중력(n ${R.push.n.toFixed(2)}) — 오른쪽으로 구른다(롤 ${R.push.bnk.toFixed(0)}°) · LOW G 경고`);
  t.ok(R.rec.n > 0.8 && R.rec.r < 2, '사이클릭을 되돌리면 G 가 돌아오고 구름이 멎는다');
  t.ok(R.bump.n === 1 && !R.bump.run && R.bump.al, '저중력에서 왼쪽 사이클릭으로 롤을 바로잡으려 하면 MAST BUMPING — 비행이 멈춘다');
  t.ok(R.lte.dh > 20 && R.lte.warned, `LTE — 저속 · 상대풍 300° · 20kt 에서 기수가 오른쪽으로 저절로 돈다 (${R.lte.dh.toFixed(0)}° / 3초)`);
  t.ok(R.left < R.lte.yaw && Math.abs(R.head) < 2, `왼쪽 페달로 맞서면 줄고(${R.left.toFixed(1)}°/s) · 맞바람이면 없다`);
  t.ok(R.bnkNoHyd < R.bnkHyd * 0.6, `유압이 없으면 같은 사이클릭에 뱅크가 굼뜨다 (${R.bnkHyd.toFixed(1)}° → ${R.bnkNoHyd.toFixed(1)}° / 0.5초)`);
  t.ok(R.turb > 2, `돌풍 +20kt — 자세가 흔들린다 (롤 흔들림 ${R.turb.toFixed(1)}°)`);
  t.ok(R.td1.grade === '좋음' && R.td2.grade === '손상' && R.td1.flare === 40, `오토로테이션 착지 평가 — 200fpm · 8kt · NR 95 좋음 / 900fpm · 30kt 손상 (플레어 ${R.td1.flare}ft)`);
  t.ok(R.trSlow > 40 && R.trFast < R.trSlow / 3, `꼬리로터 구동 상실 — 저속에서 페달을 차도 기수가 돈다(${R.trSlow.toFixed(0)}°/3초) · 80kt 에선 꼬리날개가 잡는다(${R.trFast.toFixed(0)}°)`);
  t.ok(R.vrs && R.vrs.how === '전진 비행' && Math.round(R.vrs.loss) === 100 && R.vrs.grade === '좋음', `VRS 회복 평가 — ${R.vrs && R.vrs.how} · 고도 손실 ${R.vrs && Math.round(R.vrs.loss)}ft · ${R.vrs && R.vrs.grade}`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
