// 3D 지도 그래픽(WebGL) 문맥을 잃었을 때(GPU 메모리 · 절전) — 돌아오면 그대로, 3초 안에 돌아오지 않으면 그 지도를 새로 만든다(04-map.js mapGlGuard)
export const name = '3D 지도 문맥 복구';

export async function run(page, t) {
  // 본 3D 지도 — 우측 창 3D
  await page.evaluate(() => selectPanel('right', 'm3d'));
  await page.waitForFunction(() => typeof _ml3d !== 'undefined' && _ml3d && _ml3d.getCanvas(), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const a = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const old = _ml3d, n0 = mapGlRebuiltN, ext = (() => { const c = old.getCanvas(); const g = c.getContext('webgl2') || c.getContext('webgl'); return g && g.getExtension('WEBGL_lose_context'); })();
    if (!ext) return { skip: true };
    // ① 잃었다가 곧 돌아오면 — 같은 지도
    ext.loseContext(); await w(300); const lost1 = !!old._glLost; ext.restoreContext(); await w(3500);
    const same = _ml3d === old && !old._glLost && mapGlRebuiltN === n0;
    // ② 돌아오지 않으면 — 3초 뒤 새 지도
    const ext2 = (() => { const c = _ml3d.getCanvas(); const g = c.getContext('webgl2') || c.getContext('webgl'); return g.getExtension('WEBGL_lose_context'); })();
    const before = _ml3d; ext2.loseContext(); await w(3800);
    return { lost1, same, rebuilt: _ml3d && _ml3d !== before && mapGlRebuiltN === n0 + 1, inDom: !!(_ml3d && _ml3d.getContainer().isConnected) };
  });
  if (a.skip) { t.ok(true, '(이 브라우저는 문맥 잃기를 흉내 낼 수 없다 — 건너뜀)'); }
  else {
    t.ok(a.lost1 && a.same, `본 3D — 문맥을 잃었다가 돌아오면 그 지도 그대로 (${JSON.stringify(a)})`);
    t.ok(a.rebuilt && a.inDom, '본 3D — 3초 안에 돌아오지 않으면 새로 만든다');
  }
  // EO/IR 지도(흰수리) — 돌아오지 않으면 거두고, 다음 그림에서 새로 만든다
  const b = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    if (typeof _eoMapEnsure !== 'function') return { skip: true };
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 150;
    eoirVideoDrawTo(cv.getContext('2d'), 0, 0, 200, 150); await w(800);
    const old = _eoMap; if (!old) return { skip: true };
    const g = old.getCanvas().getContext('webgl2') || old.getCanvas().getContext('webgl'), ext = g && g.getExtension('WEBGL_lose_context');
    if (!ext) return { skip: true };
    ext.loseContext(); await w(3800); const dropped = _eoMap === null || _eoMap !== old;
    let again = false, err = null;
    for (let i = 0; i < 10 && !again; i++) { try { eoirVideoDrawTo(cv.getContext('2d'), 0, 0, 200, 150); } catch (e) { err = String(e); } await w(200); again = !!_eoMap && _eoMap !== old; }
    // 다시 만든 지도는 3초가 지나도 거둬지지 않는다(옛 지도를 거둘 때 나는 신호에 속지 않는다)
    // 옛 지도(거둔 것)의 복구가 새 지도를 거두지 않는다 — 3초 넘게 지나도 복구 횟수가 늘지 않고 지도가 있다
    //   (느린 CI 에서는 다른 까닭으로 지도가 다시 만들어질 수 있어, 같은 지도인지가 아니라 '복구로 거두지 않았는지'를 본다)
    const n1 = mapGlRebuiltN; for (let i = 0; i < 17; i++) { eoirVideoDrawTo(cv.getContext('2d'), 0, 0, 200, 150); await w(200); }   // 계속 본다(안 보면 거두는 것은 따로다)
    const kept = again && !!_eoMap && mapGlRebuiltN === n1;
    return { dropped, again, kept, err, n: typeof mapGlRebuiltN !== 'undefined' ? mapGlRebuiltN : null };
  });
  if (b.skip) t.ok(true, '(EO/IR 지도 없음 — 건너뜀)');
  else t.ok(b.dropped && b.again && b.kept, `EO/IR — 문맥이 돌아오지 않으면 거두고 다음 그림에서 새로 만들고, 새 지도는 그대로 둔다 (${JSON.stringify(b)})`);
  // 숨은 지도 — 전탐석을 열어 두어도 EO/IR 칸이 안 보이고 CH1 녹화도 없으면 EO/IR 지도는 필요 없다(5초 여유) · 진단에 살아 있는 3D 지도 목록
  const h = await page.evaluate(() => {
    if (typeof _eoNeed !== 'function') return { skip: true };
    const o = {}, mo = msnOpen, wt = _eoWantT, rc = window.dvrRecCh, nt = _eoNeedT;
    _eoWantT = -Infinity; msnOpen = false; o.closed = _eoNeed() === false;
    msnOpen = true; window.dvrRecCh = n => n === 1; o.rec = _eoNeed() === true;
    window.dvrRecCh = () => false; o.grace = _eoNeed() === true;              // 방금 필요했으면 5초 동안은 둔다
    _eoNeedT = performance.now() - 6000; o.after = _eoNeed() === false || (!!_msnEl && msnScreenOn() && _cellVis(_msnEl.querySelector('.c-eo')));
    msnOpen = mo; _eoWantT = wt; window.dvrRecCh = rc; _eoNeedT = nt;
    const L = maps3dLive(); o.maps = L.map(x => x.name); o.main = L.some(x => x.name === '메인 3D');
    toggleDiag(); o.diag = /3D 지도\(WebGL\)/.test(document.getElementById('diag-wrap').textContent); toggleDiag();
    return o;
  });
  if (h.skip) t.ok(true, '(EO/IR 없음 — 건너뜀)');
  else t.ok(h.closed && h.rec && h.grace && h.after && h.main && h.diag, `숨은 EO/IR 지도는 거둔다(전탐석이 열려 있어도 · CH1 녹화 중이면 둔다 · 5초 여유) · 🩺 진단에 3D 지도 목록 (${h.maps.join(', ')})`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
  await page.evaluate(() => selectPanel('right', 'map'));
}
