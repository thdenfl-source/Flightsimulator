// 블로우 백 + FORCE TRIM — 회전익 특성(ASE 꺼짐)에서 블로우 백으로 기수가 든 채 FORCE TRIM 으로
// 기준을 다시 잡으면, 놓은 뒤 그 자세 그대로여야 한다(블로우 백 2.5° 가 또 얹히면 안 된다).
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = '블로우 백 트림';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const o = {};
    rotorChar = true; rcOpt.blowback = true; aseOn = false;
    S.alt = 1000; S.vs = 0; simVsAcc = 0;
    const one = (v) => {
      S.spd = v; simAcc = 0; simTrimReset();
      simTrim.pitch = -pitchFromSpd(v); simTrimAct.pitch = simTrim.pitch;
      S.pit = pitchFromSpd(v); fly(2);
      S.spd = v; simAcc = 0;                         // 기수가 든 만큼 줄어든 속도는 되돌려 둔다(블로우 백 구간 안에서 본다)
      const before = S.pit, bb = simBb;
      // 놓은 뒤 0.5초(피치는 12°/s 로 따라가므로 2.5° 가 더 얹히면 이 안에 드러난다)
      simFtrRelease(); fly(0.5);
      const after1 = S.pit, mid = S.pit;
      S.spd = v; simAcc = 0;
      simFtrRelease(); fly(0.5);                     // 한 번 더 눌러도 쌓이지 않는다
      return { before, bb, after1, after2: S.pit, ref: mid, spd: S.spd, bb2: simBb };
    };
    o.v30 = one(30); o.v60 = one(60);
    rotorChar = false; aseOn = false; simTrimReset(); toggleSimMode(false);
    return o;
  })()`);
  for (const k of ['v30', 'v60']) {
    const x = r[k];
    t.ok(x.bb > 2.3, `${k.slice(1)}kt — 블로우 백이 걸려 있다 (+${x.bb.toFixed(1)}°)`);
    t.ok(Math.abs(x.after1 - x.before) < 0.2,
      `${k.slice(1)}kt — FORCE TRIM 뒤에도 자세 그대로(2.5° 더 들지 않는다) (${x.before.toFixed(1)} → ${x.after1.toFixed(1)}°)`);
    t.ok(Math.abs(x.after2 - x.ref) < 0.2, `${k.slice(1)}kt — 다시 눌러도 쌓이지 않는다 (${x.after2.toFixed(1)}° · ${x.spd.toFixed(1)}kt · bb ${x.bb2.toFixed(2)})`);
  }
}
