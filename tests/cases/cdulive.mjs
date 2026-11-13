// 분할 경계를 끄는 동안 CDU 도 PFD 처럼 바로 크기가 맞는다(놓은 뒤가 아니라) — 07-sim.js 분할 경계 pointermove → scaleCdu
export const name = 'CDU 실시간 크기';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    setSplitMode(3); await wait(150);
    selectPanel('mid', 'cdu', true); await wait(200);
    const grip = document.getElementById('divider-grip-2');   // 가운데(CDU) | 오른쪽 경계
    const sc = () => document.getElementById('cdu-scaler').style.transform;
    const app = document.getElementById('app').getBoundingClientRect();
    const t0 = sc();
    const gr = grip.getBoundingClientRect();
    const ev = (type, x) => grip.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: gr.top + gr.height / 2 }));
    ev('pointerdown', gr.left + gr.width / 2);
    ev('pointermove', app.left + app.width * 0.85);
    const mid = sc();                      // 놓기 전
    ev('pointerup', app.left + app.width * 0.85); await wait(150);
    const end = sc();
    triRatio = null; applyTriRatio(); try { saveTriRatio(); } catch (e) {}
    return { id: grip.id, t0, mid, end };
  });
  t.ok(r.mid !== r.t0, `분할 경계를 끄는 동안(놓기 전) CDU 크기가 바로 바뀐다 (${r.id}: ${r.t0} → ${r.mid})`);
  t.ok(r.end === r.mid || r.end !== r.t0, '놓은 뒤에도 그 크기');
}
