// 처음 켤 때의 화면 구성 — 좌 PFD · 중 MAP · 우 CDU (3분할)
//
// 기본값은 코드 여러 곳에 흩어져 있다. leftSel/midSel/rightSel 초기값,
// tripleMode 초기값, 그리고 CDU 초기화의 setPage(...) 까지 손발이 맞아야
// 화면에 그대로 나온다 — 실제로 어느 패널에 어느 창이 들어갔는지로 확인한다.
export const name = '시작 화면 구성';

export async function run(page, t) {
  // 다른 검사들이 배치를 바꿔 놓았을 수 있고 저장값도 남아 있으므로,
  // 아무것도 저장되지 않은 새 브라우저 문맥에서 처음부터 연다.
  const browser = page.context().browser();
  const url = page.url();
  const ctx1 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const fresh = await ctx1.newPage();
  await fresh.goto(url);
  await fresh.waitForTimeout(900);

  const v = await fresh.evaluate(() => {
    const host = id => {
      const e = document.getElementById(id);
      return e && e.parentElement ? e.parentElement.id : null;
    };
    const shown = id => {
      const e = document.getElementById(id);
      return !!e && !e.classList.contains('page-hidden');
    };
    const active = tabs => {
      const b = document.querySelector(`#${tabs} [data-sel].active`);
      return b ? b.dataset.sel : null;
    };
    return { triple: document.getElementById('app').classList.contains('triple'),
             pfd: host('pfd-wrap'), map: host('map-wrap'), cdu: host('cdu-wrap'),
             shownAll: shown('pfd-wrap') && shown('map-wrap') && shown('cdu-wrap'),
             tabs: [active('left-tabs'), active('mid-tabs'), active('page-tabs')],
             sel: [leftSel, midSel, rightSel], tripleVar: tripleMode,
             midW: Math.round(document.getElementById('mid-panel').getBoundingClientRect().width) };
  });

  t.eq(v.triple, true, '처음부터 3분할이다');
  t.eq(v.pfd, 'left-panel',  `좌측은 PFD (${v.pfd})`);
  t.eq(v.map, 'mid-panel',   `중앙은 MAP (${v.map})`);
  t.eq(v.cdu, 'right-panel', `우측은 CDU (${v.cdu})`);
  t.eq(v.shownAll, true, '세 창이 모두 보인다');
  t.eq(v.tabs.join('·'), 'pfd·map·cdu', `탭 표시도 그대로다 (${v.tabs.join('·')})`);
  t.eq(v.sel.join('·'), 'pfd·map·cdu', '상태값도 같다');
  t.ok(v.midW > 50, `중앙 패널이 실제로 자리를 차지한다 (${v.midW}px)`);

  // ── 2분할을 골라 두면 그 뜻을 따른다 ──
  const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const two = await ctx2.newPage();
  await two.addInitScript(() => { try { localStorage.setItem('tripleMode', '0'); } catch (e) {} });
  await two.goto(url);
  await two.waitForTimeout(900);
  const w = await two.evaluate(() => ({
    triple: document.getElementById('app').classList.contains('triple'),
    sel: [leftSel, rightSel],
    cduShown: !document.getElementById('cdu-wrap').classList.contains('page-hidden'),
  }));
  t.eq(w.triple, false, '2분할을 저장해 뒀으면 2분할로 뜬다');
  t.eq(w.sel.join('·'), 'pfd·map', `그때는 종전대로 좌 PFD · 우 MAP (${w.sel.join('·')})`);
  t.eq(w.cduShown, false, '그 배치에서는 CDU 가 접혀 있다');

  await ctx1.close();
  await ctx2.close();
}
