// 절차 훈련판(Flightsimulator) SIM 비행 — 사이클릭 피치 · 롤이 잠긴 채(00-edition.js CYCLIC_LOCK)
// 비퍼 트림 · 컬렉티브 · 페달 · AFCS 만으로 난다. 종합판에서도 잠금을 걸어 똑같이 본다(두 판 모두 돈다 —
// run.mjs 가 절차 훈련판에서 SIM 검사 파일을 건너뛰어도 이 파일은 남긴다).
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = 'SIM 절차 훈련판(사이클릭 잠금)';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const lock0 = CYCLIC_LOCK; CYCLIC_LOCK = true;
    joyAxes.coll = { i: 3, inv: false, abs: true };
    const lever = tq => _ax(3, 2 * tq / SIM_LEVER_TOP - 1);
    const o = {};
    // 2,000ft · 100kt 수평 — 레버는 수평 비행 토크
    S.alt = 2000; S.spd = 100; S.vs = 0; S.bnk = 0; S.pit = pitchFromSpd(100); bankTarget = 0;
    simTrimReset(); simTrim.pitch = -pitchFromSpd(100); simTrimAct.pitch = simTrim.pitch;
    const tq0 = tqRequired(); S.tq = tq0; lever(tq0); fly(4);
    // ① 사이클릭을 끝까지 밀고 당겨도 자세가 그대로다
    const p0 = S.pit, b0 = S.bnk;
    _ax(0, 1); _ax(1, 1); fly(2); o.cycFull = { dp: Math.abs(S.pit - p0), db: Math.abs(S.bnk - b0) };
    _ax(0, -1); _ax(1, -1); fly(2); o.cycFull2 = { dp: Math.abs(S.pit - p0), db: Math.abs(S.bnk - b0) };
    _ax(0, 0); _ax(1, 0); fly(2);
    // ② 비퍼 트림 좌우 — 뱅크가 들어가 선회한다 · 되돌리면 수평
    const h0 = S.hdg;
    for (let i = 0; i < 30; i++) simTrimNudge('R'); fly(6);
    o.turn = { bnk: S.bnk, dh: normAS(S.hdg - h0) };
    for (let i = 0; i < 30; i++) simTrimNudge('L'); fly(6); o.level = S.bnk;
    // ③ 비퍼 트림 전후 — 기수를 들면 느려지고 숙이면 빨라진다
    const v0 = S.spd;
    for (let i = 0; i < 12; i++) simTrimNudge('A'); fly(10); o.slow = S.spd - v0;
    for (let i = 0; i < 24; i++) simTrimNudge('F'); fly(12); o.fast = S.spd - v0;
    // ④ 컬렉티브 — 올리면 오르고 · ALT 를 걸면 그 고도를 지킨다
    lever(tqRequired()); fly(6); lever(tqRequired()); fly(4);   // 지금 속도의 수평 비행 토크로 자리 잡고
    const a0 = S.alt; lever(tqRequired() + 15); fly(10); o.climb = S.alt - a0;
    lever(tqRequired()); if (!altHoldOn) toggleAltHold(); fly(10); const a1 = S.alt; fly(10); o.alt = { on: altHoldOn, drift: Math.abs(S.alt - a1) };
    if (altHoldOn) toggleAltHold();
    // ⑤ 페달은 듣는다
    const h1 = S.hdg; _ax(2, 0.6); fly(2); o.yaw = Math.abs(normAS(S.hdg - h1)); _ax(2, 0); fly(2);
    CYCLIC_LOCK = lock0; simTrimReset();
    return o;
  })()`);
  t.ok(r.cycFull.dp < 0.5 && r.cycFull.db < 0.5 && r.cycFull2.dp < 0.5 && r.cycFull2.db < 0.5,
    `사이클릭을 끝까지 밀고 당겨도 자세 그대로 (피치 ${r.cycFull.dp.toFixed(2)}° · 롤 ${r.cycFull.db.toFixed(2)}°)`);
  t.ok(r.turn.bnk > 8 && r.turn.dh > 5 && Math.abs(r.level) < 2, `비퍼 트림 좌우 — 뱅크 ${r.turn.bnk.toFixed(1)}° 로 선회(${r.turn.dh.toFixed(0)}°) · 되돌리면 수평(${r.level.toFixed(1)}°)`);
  t.ok(r.slow < -5 && r.fast > r.slow + 10, `비퍼 트림 전후 — 기수를 들면 느려지고(${r.slow.toFixed(0)}kt) 숙이면 빨라진다(${r.fast.toFixed(0)}kt)`);
  t.ok(r.climb > 50 && r.alt.on && r.alt.drift < 30, `컬렉티브로 오르고(+${r.climb.toFixed(0)}ft) ALT 를 걸면 고도를 지킨다(10초 ${r.alt.drift.toFixed(0)}ft)`);
  t.ok(r.yaw > 3, `페달은 듣는다(${r.yaw.toFixed(1)}°)`);
}
