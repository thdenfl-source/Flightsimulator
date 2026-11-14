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
    // 자세계 오른쪽 칸(메시지 · HOCAS · 스톱워치) · 오른쪽 아래 MAP/TCAS 창
    selectPanel('right', 'map', true); await w(300);
    const c = document.getElementById('pfd'), L = lay();
    hocasOn = true; ovhdSet('parkBrake', 'SET'); skState.tfcMap = false;
    const t0 = seen(), RC = pfdRightCol(L, c.width);
    o.side = { on: L.sideOn, inset: L.insetOn, msgX: L.side.x, altR: L.alt.x + L.alt.w + L.vsi.w, hsiR: L.hsi.x + L.hsi.w, crX: L.crht.x,
               swIn: RC.left >= L.side.x && RC.swY + RC.swH <= L.side.y + L.side.h + 1, hocas: t0.includes('HOCAS'), park: t0.includes('PARKING BRAKE SET') };
    o.side.msgRight = _pfdMsgBottom >= L.side.y && _pfdMsgBottom < L.side.y + L.side.h;
    // 창을 누르면 MAP ⇄ TCAS
    // 창이 없는 좁은 PFD 에서도 그리기 · 누르기를 본다(넓은 PFD 의 자리를 빌려)
    const r = L.insetOn ? L.inset : { x: 10, y: 10, w: 150, h: 150 }, map0 = !pfdInsetTcas();
    if (!L.insetOn) { drawPfdInset(r); }
    const seenI = () => { if (L.insetOn) return seen(); const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, out = [];
      proto.fillText = function (x, ...a) { out.push(String(x)); return orig.call(this, x, ...a); }; try { drawPfdInset(r); } finally { proto.fillText = orig; } return out; };
    o.tap1 = pfdInsetHit(r.x + 5, r.y + 5) && pfdInsetTcas() && seenI().includes('TCAS: TA ONLY');
    if (!L.insetOn) drawPfdInset(r);
    o.tap2 = pfdInsetHit(r.x + 5, r.y + 5) && !pfdInsetTcas() && map0;
    hocasOn = false; ovhdSet('parkBrake', 'RELEASE'); drawPFD();
    // 자세계 · HSI 반반 · HSI 는 늘 다 보인다(창이 있으면 높이로 정한 크기 그대로)
    o.half = [560, 700, 1000, 1400].map(W => {
      const L2 = pfdLayout(W, 900, 300), G = hsiGeom(L2.hsi.x, L2.hsi.y, L2.hsi.w, L2.hsi.h, W / 2);
      const inside = G.cx - G.r >= L2.hsi.x && G.cx + G.r <= L2.hsi.x + L2.hsi.w && G.cy - G.r >= L2.hsi.y && G.cy + G.r <= L2.hsi.y + L2.hsi.h;
      return { W, half: Math.abs(L2.aiH - L2.hsiH) <= 1, inside, full: !L2.insetOn || G.r >= L2.hsiH * 0.46 * 0.94, inset: L2.insetOn };
    });
    return o;
  });
  const has = (txt, ks) => ks.every(k => txt.some(s => s.startsWith(k)));
  const KS = ['EOT', 'EOP', 'MGB', 'Fuel F', 'Fuel P', 'HYD P', 'Fuel QTY', 'Battery', 'ACCP'];
  t.ok(!R.off.shown && R.off.L.revOn && has(R.off.txt, KS),
    'SYSTEM 창이 없으면 PFD 왼쪽 위에 대체 모드 EIS(EOT · EOP · MGB · Fuel F · Fuel P · HYD P · Fuel QTY · Battery · ACCP)');
  const Lo = R.off.L, aiC = Lo.ai.x + Lo.ai.w / 2, W = Lo.ai.w;
  t.ok(Lo.ai.x === 0 && Math.abs(aiC - W / 2) < 0.5 && Lo.spd.x >= Lo.rev.w,
    `자세계는 전체 폭 — 가운데가 HSI 가운데(화면 가운데)와 한 줄 · 속도계는 EIS 칸 안쪽 (자세계 가운데 ${aiC} · W/2 ${W / 2} · 속도계 x ${Lo.spd.x} ≥ EIS ${Lo.rev.w})`);
  const sL = Lo.spd.x, sR = W - (Lo.alt.x + Lo.alt.w);
  t.ok(Math.abs(sL - sR) <= 1 && Lo.crht.x + Lo.crht.w <= W,
    `속도계 · 고도계가 가운데를 두고 좌우 대칭 (왼쪽 ${sL}px · 오른쪽 ${sR}px)`);
  t.ok(R.off.txt.includes(String(Math.round(R.D.qty.tot))) && R.off.txt.includes(String(R.D.accp)),
    `값은 SYSTEM 창 EIS 와 같다 (Fuel Total ${Math.round(R.D.qty.tot)} · ACCP ${R.D.accp})`);
  const Sd = R.side;
  t.ok(Sd.on && Sd.msgX > Sd.altR && Sd.park && Sd.msgRight && Sd.hocas && Sd.swIn,
    `메시지 · HOCAS · 스톱워치는 자세계 오른쪽 칸(고도계 바깥 x ${Math.round(Sd.msgX)} > ${Math.round(Sd.altR)})`);
  t.ok(Math.abs(Sd.hsiR - Sd.crX) < 0.5, 'CRHT · NAV 칸은 HSI 오른쪽에 붙는다');
  t.ok(R.half.every(h => h.half && h.inside && h.full) && R.half.some(h => h.inset),
    `자세계 · HSI 를 반반으로 · HSI 는 늘 다 보이고, 오른쪽 아래 MAP · TCAS 창은 자리가 있을 때만 (${R.half.map(h => h.W + (h.inset ? '·창' : '')).join(' ')})`);
  t.ok(R.tap1 && R.tap2, '오른쪽 아래 창을 누르면 MAP ⇄ TCAS(TA ONLY)');
  t.ok(R.on.shown && !R.on.L.revOn && R.on.L.ai.x === 0 && !has(R.on.txt, ['EOT', 'HYD P']),
    'SYSTEM 창을 고르면 대체 모드를 거두고 원래 배치로');
}
