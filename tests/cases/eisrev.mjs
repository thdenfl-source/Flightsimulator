// PFD 대체 모드 EIS(03-pfd.js drawEisRev) — SYSTEM 창이 화면에 없으면 PFD 왼쪽 위에 MFD EIS 숫자 칸을 띄운다
export const name = 'PFD 대체 모드 EIS';

export async function run(page, t) {
  const R = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const seen = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, out = [];
      proto.fillText = function (x, ...a) { out.push(String(x)); return orig.call(this, x, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return out;
    };
    const lay = () => { const c = document.getElementById('pfd'); return pfdLayout(c.width, c.height, document.querySelector('.ctrl-bar').offsetHeight); };
    const o = {};
    selectPanel('right', 'map', true); await w(400);
    o.off = { shown: sysScreenShown(), L: lay(), txt: seen() };
    selectPanel('right', 'sysp', true); await w(400);
    o.on = { shown: sysScreenShown(), L: lay(), txt: seen() };
    o.D = eisData();
    selectPanel('right', 'map', true); await w(300);
    return o;
  });
  const has = (txt, ks) => ks.every(k => txt.some(s => s.startsWith(k)));
  const KS = ['EOT', 'EOP', 'MGB', 'Fuel F', 'Fuel P', 'HYD P', 'Fuel QTY', 'Battery', 'ACCP'];
  t.ok(!R.off.shown && R.off.L.revOn && has(R.off.txt, KS),
    'SYSTEM 창이 없으면 PFD 왼쪽 위에 대체 모드 EIS(EOT · EOP · MGB · Fuel F · Fuel P · HYD P · Fuel QTY · Battery · ACCP)');
  t.ok(R.off.L.ai.x === R.off.L.eng.w && R.off.L.spd.x > R.off.L.eng.w && R.off.L.rev.w === R.off.L.eng.w,
    `자세계 · 속도계는 EIS 칸만큼 오른쪽으로 (EIS ${R.off.L.rev.w}px · 자세계 x ${R.off.L.ai.x})`);
  t.ok(R.off.txt.includes(String(Math.round(R.D.qty.tot))) && R.off.txt.includes(String(R.D.accp)),
    `값은 SYSTEM 창 EIS 와 같다 (Fuel Total ${Math.round(R.D.qty.tot)} · ACCP ${R.D.accp})`);
  t.ok(R.on.shown && !R.on.L.revOn && R.on.L.ai.x === 0 && !has(R.on.txt, ['EOT', 'HYD P']),
    'SYSTEM 창을 고르면 대체 모드를 거두고 원래 배치로');
}
