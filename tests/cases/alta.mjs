// VS · ALT.A(01-state.js) — 노브는 고르기만 · 누르면 건다 · ALT.A 는 VS(녹색) + ALT 무장(흰색) → 1,000ft 전 '삐' → 300ft 전 ALT 포착
export const name = 'VS · ALT.A';

export async function run(page, t) {
  const r = await page.evaluate(() => {
    const o = {};
    try { if (typeof simModeOn !== 'undefined' && simModeOn) toggleSimMode(false); } catch (e) { /* 절차 훈련판 */ }
    const fma = () => {
      const seen = [], f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return f.call(this, x, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = f; }
      return seen;
    };
    S.alt = 1000; altHoldOn = false; crhtOn = false; vsModeOn = false; altArmed = false; altaSel = null; selVS = 1000;
    // ① ALT.A 노브 — 고르는 동안은 아무 모드도 걸리지 않는다
    for (let i = 0; i < 20; i++) applyDelta('alt', 100);
    o.pre = { alta: altaSel, alt: altHoldOn, vs: vsModeOn, armed: altArmed };
    // ② 누르면 VS +1000(녹색) · ALT 무장(흰색)
    document.querySelector('#fcp-simple [data-k="alta"] .fks-push').click();
    o.push = { vs: vsModeOn, armed: altArmed, sel: selVS, alt: altHoldOn };
    { const f = fma(); o.fmaVs = f.includes('VS +1000') && f.includes('ALT'); }
    // ③ 1,000ft 전 — 한 번 '삐'
    const n0 = altAlertCount; S.alt = 1990; altaStep(); altaStep();   // 2,000ft 를 지나면(1,000ft 안) — 1,990 은 아직 아니다
    o.early = altAlertCount - n0; S.alt = 2010; altaStep(); altaStep(); o.alert = altAlertCount - n0;
    // 가는 동안 VS 노브 · COLL TRIM 으로 승강률을 고친다
    applyDelta('vs', 500); o.vsKnob = selVS; collTrimStep(-1); o.vsTrim = selVS;
    S.alt = 2690; altaStep(); o.still = vsModeOn && altArmed;
    // ④ 300ft 전 — VS 가 사라지고 ALT 가 걸려 3,000ft 로
    S.alt = 2710; altaStep();
    o.cap = { vs: vsModeOn, armed: altArmed, alt: altHoldOn, sel: selAlt };
    { const f = fma(); o.fmaAlt = f.includes('ALT') && !f.some(x => /^VS /.test(x)); }
    // ⑤ ALT 가 걸린 뒤 COLL TRIM 은 ALT 기준을 옮긴다
    collTrimStep(1); collTrimStep(1); o.trimAlt = selAlt;
    // ⑥ VS — 반시계로 − 강하율을 고르고 누르면 계속 내려간다 · 다시 누르면 푼다
    altHoldOn = false; selVS = 0; for (let i = 0; i < 5; i++) applyDelta('vs', -100);
    o.vsPre = { sel: selVS, on: vsModeOn };
    document.querySelector('#fcp-simple [data-k="vs"] .fks-push').click();
    o.vsOn = vsModeOn && !altArmed; { const f = fma(); o.fmaDn = f.includes('VS −500'); }
    const a0 = S.alt, run0 = S.running; S.running = true;
    return new Promise(res => setTimeout(() => {
      o.desc = S.alt < a0 - 1; S.running = run0;
      vsPush(); o.vsOff = !vsModeOn;
      res(o);
    }, 1500));
  });
  t.ok(r.pre.alta === 3000 && !r.pre.alt && !r.pre.vs && !r.pre.armed, `ALT.A 노브로 3,000ft 를 고르는 동안은 아무 모드도 걸리지 않는다 (${JSON.stringify(r.pre)})`);
  t.ok(r.push.vs && r.push.armed && r.push.sel === 1000 && !r.push.alt && r.fmaVs, `ALT.A 를 누르면 VS +1000(녹색) · ALT 무장(흰색) (${JSON.stringify(r.push)})`);
  t.ok(r.early === 0 && r.alert === 1, `목표 1,000ft 전(2,000ft)을 지나면 한 번 알림음 (${r.early} → ${r.alert})`);
  t.ok(r.vsKnob === 1500 && r.vsTrim === 1400 && r.still, `가는 동안 VS 노브 · COLL TRIM 으로 승강률을 고친다 (${r.vsKnob} → ${r.vsTrim})`);
  t.ok(!r.cap.vs && !r.cap.armed && r.cap.alt && r.cap.sel === 3000 && r.fmaAlt, `300ft 전(2,700ft) — VS 가 사라지고 ALT 가 걸려 3,000ft 로 (${JSON.stringify(r.cap)})`);
  t.eq(r.trimAlt, 3020, 'ALT 가 걸린 뒤 COLL TRIM 은 ALT 기준 고도를 옮긴다(10ft 씩)');
  t.ok(r.vsPre.sel === -500 && !r.vsPre.on && r.vsOn && r.fmaDn && r.desc && r.vsOff, `VS — 반시계로 −500 을 고르고(아직 안 걸림) 누르면 계속 강하 · 다시 누르면 푼다 (${JSON.stringify(r.vsPre)})`);
}
