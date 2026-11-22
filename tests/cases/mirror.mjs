// 거울 창(38-mirror.js) — 같은 화면을 두 창에 · 조종석 작은 칸에도(진짜 화면이 다른 곳에 있을 때) · 누르면 진짜 화면이 듣는다
export const name = '거울 창';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms)), o = {};
    const keep = { tri: tripleMode, quad: quadMode, l: leftSel, m: midSel, r: rightSel };
    if (!tripleMode) toggleTriple();
    selectPanel('mid', 'cdu'); selectPanel('right', 'cdu'); await w(600);
    const mid = document.getElementById('mid-panel'), right = document.getElementById('right-panel');
    o.sel = [midSel, rightSel].join(',');
    o.real = mid.contains(document.getElementById('cdu-wrap'));
    const box = right.querySelector('.mirror-box'), ifr = box && box.querySelector('iframe');
    o.box = !!ifr;
    const md = ifr && ifr.contentDocument, mc = md && md.getElementById('cdu-wrap');
    o.copy = !!mc && mc.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) === document.getElementById('cdu-wrap').textContent.replace(/\s+/g, ' ').trim().slice(0, 200);
    o.size = !!box && box.clientWidth > 50 && box.clientHeight > 50;
    // 거울의 버튼을 누르면 진짜 CDU 의 같은 버튼이 눌린다
    const real = document.querySelector('#cdu-wrap [data-act]'); let hit = 0;
    if (real && mc) {
      const path = []; let n = real; while (n && n.id !== 'cdu-wrap') { path.push([...n.parentElement.children].indexOf(n)); n = n.parentElement; }
      let c = mc; for (let i = path.length - 1; i >= 0; i--) c = c.children[path[i]];
      const f = () => { hit++; }; real.addEventListener('click', f, true);
      c.dispatchEvent(new (ifr.contentWindow.MouseEvent)('click', { bubbles: true, cancelable: true }));
      real.removeEventListener('click', f, true);
    }
    o.fwd = hit === 1;
    // 맞바꿈이 아니라 둘 다(지도 · 3D 는 예전처럼 맞바꾼다)
    selectPanel('mid', 'map'); await w(200); selectPanel('right', 'map'); await w(300); o.mapSwap = [midSel, rightSel].join(',');
    o.dropped = !right.querySelector('.mirror-box');
    // 3D 조종석(Cockpit Mode) — UPPER CONSOLE 을 새 창(SIM Mode 창 배치)에 띄워 두어도 조종석 UPPER 칸에 거울로(보이기만 · 누르면 크게)
    o.popUp = popoutScreen('ovhd'); await w(600);
    cockpitStart(); await w(1500);
    const ck = document.getElementById('ck-mini-ovhd'), mb = ck && ck.querySelector('.mirror-box');
    o.ckUp = !!mb && mb.classList.contains('passive') && !ck.contains(document.getElementById('ovhd-wrap'));
    o.list = mirrorList().map(x => x.k).join(',');
    popoutScreen('ovhd'); await w(600);
    o.ckBack = !!ck && ck.contains(document.getElementById('ovhd-wrap')) && !ck.querySelector('.mirror-box');   // 새 창을 닫으면 진짜가 조종석 칸으로
    try { exitSolo(); } catch (e) { /* */ } await w(400);
    selectPanel('left', keep.l); selectPanel('mid', keep.m); selectPanel('right', keep.r); await w(300);
    return o;
  });
  t.ok(r.sel === 'cdu,cdu' && r.real && r.box && r.size, `같은 화면(CDU)을 두 창에 — 하나는 진짜 · 하나는 거울 (${r.sel})`);
  t.ok(r.copy, '거울은 진짜 화면의 글자를 그대로 보인다');
  t.ok(r.fwd, '거울의 버튼을 누르면 진짜 화면의 같은 버튼이 눌린다');
  t.ok(r.mapSwap === 'cdu,map' && r.dropped, `지도는 예전처럼 맞바꾼다 · 거울은 거둔다 (${r.mapSwap})`);
  t.ok(r.popUp && r.ckUp && r.ckBack, `조종석의 UPPER 칸 — UPPER 가 새 창에 있어도 거울로(보이기만) · 새 창을 닫으면 진짜가 돌아온다 (${r.list})`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
