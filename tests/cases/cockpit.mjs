// Cockpit mode(07-sim.js) — 조종석처럼 세로로 쌓은 화면 · 두 번 누르면 그 칸이 화면 가득 · 다시 두 번이면 복원
// + FCP IAS 를 누르면 AFCS 상태 띠의 IAS 가 꺼진다(SIM 이 꺼져 있어도)
export const name = 'Cockpit 모드';

export async function run(page, t) {
  await page.setViewportSize({ width: 820, height: 1180 });
  const btn = await page.evaluate(() => !!document.getElementById('gate-mode-cockpit'));
  await page.evaluate(() => cockpitStart());
  await page.waitForTimeout(900);
  const A = await page.evaluate(() => {
    const wraps = { ovhd: 'ovhd-wrap', m3d: 'map3d-wrap', pfd: 'pfd-wrap', sysp: 'sysp-wrap', cdu: 'cdu-wrap', lcon: 'lcon-wrap' };
    const cells = Object.entries(wraps).map(([k, id]) => {
      const c = document.getElementById('ck-' + k), r = c.getBoundingClientRect(), w = document.getElementById(id);
      return { k, inside: !!(w && c.contains(w) && !w.classList.contains('page-hidden')), x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const f = document.getElementById('fcp-simple');
    return { cells, app: getComputedStyle(document.getElementById('app')).display, fcpFit: f.scrollWidth <= f.clientWidth + 2 };
  });
  const C = Object.fromEntries(A.cells.map(c => [c.k, c]));
  t.ok(btn, '시작 화면 고르기에 Cockpit Mode 가 있다');
  t.ok(A.cells.every(c => c.inside && c.w > 50 && c.h > 50) && A.app === 'none', `여섯 칸에 UPPER · 3D · PFD · SYSTEM · CDU · LOWER 가 들어간다`);
  t.ok(C.ovhd.y < C.m3d.y && C.m3d.y < C.pfd.y && Math.abs(C.pfd.y - C.sysp.y) < 2 && C.pfd.x < C.sysp.x && C.pfd.y < C.cdu.y && C.cdu.y < C.lcon.y,
    '위에서 아래로 UPPER → 3D → PFD·FCP | SYSTEM → CDU → LOWER');
  t.ok(C.m3d.w > C.ovhd.w * 2 && C.m3d.w > C.cdu.w * 2, '3D 는 가로 가득 · UPPER · CDU 는 가운데 좁게');
  t.ok(A.fcpFit, 'PFD 칸의 FCP 가 칸 폭에 맞춰 줄어 다 보인다');
  // 두 번 누르기 — SYSTEM 칸 → 화면 가득 → 다시 두 번 → 복원
  const bb = await page.locator('#ck-sysp').boundingBox();
  await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(300);
  const M = await page.evaluate(() => { const r = document.getElementById('ck-sysp').getBoundingClientRect();
    return { w: r.width, h: r.height, others: [...document.querySelectorAll('#ck-view .ck-cell')].filter(c => c.id !== 'ck-sysp' && getComputedStyle(c).display !== 'none').length }; });
  await page.mouse.dblclick(400, 600); await page.waitForTimeout(300);
  const R = await page.evaluate(() => ({ max: document.getElementById('ck-view').classList.contains('has-max'), h: document.getElementById('ck-sysp').getBoundingClientRect().height }));
  t.ok(M.w > 780 && M.h > 1100 && M.others === 0, `두 번 누르면 그 칸이 화면 가득 (${Math.round(M.w)}×${Math.round(M.h)})`);
  t.ok(!R.max && Math.abs(R.h - C.sysp.h) < 3, '다시 두 번 누르면 처음 배치로');
  // CDU 버튼을 두 번 눌러도 화면 가득이 되지 않는다(조작으로 본다)
  const cb = await page.locator('#ck-cdu [data-act]').first().boundingBox();
  await page.mouse.dblclick(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.waitForTimeout(200);
  t.ok(!(await page.evaluate(() => document.getElementById('ck-view').classList.contains('has-max'))), '버튼 위에서 두 번 누른 것은 그 조작 — 화면 가득이 되지 않는다');
  await page.evaluate(() => { if (typeof CDU_ACT !== 'undefined') CDU_ACT.switchMode('HOME'); cockpitExit(); });
  await page.waitForTimeout(300);
  const E = await page.evaluate(() => ({ app: getComputedStyle(document.getElementById('app')).display, pfdIn: document.getElementById('pfd-wrap').closest('#app') !== null, zoom: document.getElementById('fcp-simple').style.zoom }));
  t.ok(E.app !== 'none' && E.pfdIn && !E.zoom, 'PC 모드 — 분할 화면으로 돌아온다(FCP 크기도 그대로)');
  // IAS — 누를 때마다 AFCS 상태 띠의 IAS 가 꺼지고 켜진다(SIM 꺼짐)
  const I = await page.evaluate(() => {
    const on = () => { const seen = []; const proto = CanvasRenderingContext2D.prototype, oT = proto.fillText; let col = null;
      proto.fillText = function (x, ...a) { if (String(x) === 'IAS') col = this.fillStyle; return oT.call(this, x, ...a); };
      try { drawPFD(); } finally { proto.fillText = oT; } return col; };
    const o = { sim: simModeOn, c0: on(), m0: iasModeOn() };
    fcpSync('ias'); o.c1 = on(); o.m1 = iasModeOn(); o.lamp1 = document.querySelector('#fcp-simple [data-fk="ias"]') ? null : null;
    fcpSync('ias'); o.c2 = on(); o.m2 = iasModeOn();
    fcpSync('ias'); applyDelta('spd', 5); o.m3 = iasModeOn(); applyDelta('spd', -5);
    return o;
  });
  t.ok(!I.sim && I.m0 && !I.m1 && I.m2 && I.m3 && I.c0 !== I.c1 && I.c2 === I.c0,
    `FCP IAS 를 누르면 AFCS 상태 띠의 IAS 가 꺼지고, 다시 누르면 켜진다 · 노브를 돌리면 다시 걸린다 (${I.c0} → ${I.c1} → ${I.c2})`);
}
