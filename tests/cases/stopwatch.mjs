// 스톱워치 — FCP 칸을 없애고 PFD 안(HSI 오른쪽 아래)에 그린다. PFD 를 눌러 동작(03-pfd.js drawStopwatch · swHitTest)
export const name = 'PFD 스톱워치';

export async function run(page, t) {
  const sw = await page.evaluate(() => {
    const o = { fcpGone: !document.getElementById('sw-display') };
    const shot = () => { const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (tx, ...a) { seen.push(String(tx)); return orig.call(this, tx, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; } return seen; };
    swSetMode('clock'); const s0 = shot();
    o.clock = s0.includes('TIME') && s0.some(x => /^\d\d:\d\d:\d\d$/.test(x)) && s0.includes('STOP WATCH');
    const W = cvs.width, H = cvs.height, ctrl = document.querySelector('.ctrl-bar');
    const L = pfdLayout(W, H, ctrl ? ctrl.offsetHeight : 80), RC = hsiRightCol(L.hsi.x, L.hsi.y, L.hsi.w, L.hsi.h, W / 2);
    const hit = _swHit[0];
    o.place = hit.x >= RC.G.cx + RC.G.r - 2 && hit.y + hit.h <= L.hsi.y + L.hsi.h;
    swHitTest(hit.x + 2, hit.y + 2); const s1 = shot();
    o.sw = _swMode === 'sw' && ['GO', 'RST', 'TIME'].every(x => s1.includes(x)) && s1.includes('00:00.0');
    const go = _swHit.find(h => h.act === 'swToggle'); swHitTest(go.x + 2, go.y + 2); o.run = SW.running && shot().includes('STP');
    swHitTest(go.x + 2, go.y + 2); const rst = _swHit.find(h => h.act === 'swReset'); SW.accMs = 5000; swHitTest(rst.x + 2, rst.y + 2); o.rst = SW.accMs === 0 && !SW.running;
    const tm = _swHit.find(h => h.act === 'swSetMode:clock'); swHitTest(tm.x + 2, tm.y + 2); o.back = _swMode === 'clock';
    return o;
  });
  t.ok(sw.fcpGone, 'FCP 의 STOP WATCH 는 없앴다');
  t.ok(sw.clock, 'PFD 에 현재 시각(TIME)과 STOP WATCH 칸');
  t.ok(sw.place, 'HSI 오른쪽 아래(나침반 오른쪽 · HSI 칸 안)');
  t.ok(sw.sw && sw.run && sw.rst && sw.back, 'STOP WATCH → GO/STP · RST · TIME 이 PFD 를 눌러 동작한다');
}
