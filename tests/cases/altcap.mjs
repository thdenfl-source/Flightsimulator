// ALT 버튼은 누른 순간의 고도를 지킨다 · 다른 고도로 가는 동안은 FMA ALT.A
export const name = 'ALT 캡처';

export async function run(page, t) {
  const altCap = await page.evaluate(() => {
    S.alt = 1234; altHoldOn = false; crhtOn = false; selAlt = 3000;
    toggleAltHold();
    const fma = () => {
      const texts = [], o = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { texts.push(String(s)); return o.call(this, s, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = o; }
      return texts;
    };
    const out = { on: altHoldOn, sel: selAlt, f1: fma() };
    applyDelta('alt', 100); out.sel2 = selAlt; out.f2 = fma();
    // 날아서 새 고도에 닿으면 다시 ALT
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 600; i++) { ts += 50; simStep(ts); }   // 30초
    S.running = false;
    out.reach = S.alt; out.f3 = fma();
    toggleAltHold(); toggleAltHold(); out.recap = selAlt;      // 다시 누르면 다시 지금 고도
    return { on: out.on, sel: out.sel, sel2: out.sel2, recap: out.recap, reach: out.reach,
             hold: out.f1.includes('ALT') && !out.f1.includes('ALT.A'), acq: out.f2.includes('ALT.A'),
             held: out.f3.includes('ALT') && !out.f3.includes('ALT.A') };
  });
  t.ok(altCap.on && altCap.sel === 1234, `ALT 를 누르면 그 순간의 고도(1,234ft)가 기준이다 (${altCap.sel}ft · 종전 3,000ft 로 갔다)`);
  t.ok(altCap.hold, 'FMA 는 지금 고도를 지키는 동안 ALT');
  t.ok(altCap.sel2 === 1334 && altCap.acq, `ALT ▲ 로 기준을 옮기면 그 고도로 가는 동안 ALT.A (${altCap.sel2}ft)`);
  t.ok(Math.abs(altCap.reach - 1334) < 5 && altCap.held, `새 고도에 닿으면 다시 ALT (${altCap.reach.toFixed(0)}ft)`);
  t.eq(altCap.recap, Math.round(altCap.reach), '풀었다 다시 누르면 다시 그 순간의 고도');
}
