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
  // 파일이 다 읽힐 때까지(검사를 여럿 함께 돌리거나 파일이 늘면 0.9초로 모자라다)
  await fresh.waitForFunction(() => typeof leftSel !== 'undefined' && typeof appRegister === 'function', null, { timeout: 20000 });
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
  t.eq(v.cdu, 'mid-panel',   `중앙은 CDU (${v.cdu})`);
  t.eq(v.map, 'right-panel', `우측은 MAP (${v.map})`);
  t.eq(v.shownAll, true, '세 창이 모두 보인다');
  t.eq(v.tabs.join('·'), 'pfd·cdu·map', `탭 표시도 그대로다 (${v.tabs.join('·')})`);
  t.eq(v.sel.join('·'), 'pfd·cdu·map', '상태값도 같다');
  t.ok(v.midW > 50, `중앙 패널이 실제로 자리를 차지한다 (${v.midW}px)`);

  // ── 2분할을 골라 두면 그 뜻을 따른다 ──
  const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const two = await ctx2.newPage();
  await two.addInitScript(() => { try { localStorage.setItem('tripleMode2', '0'); } catch (e) {} });
  await two.goto(url);
  // 파일이 다 읽힐 때까지(검사를 여럿 함께 돌리거나 파일이 늘면 0.9초로 모자라다)
  await two.waitForFunction(() => typeof leftSel !== 'undefined' && typeof appRegister === 'function', null, { timeout: 20000 });
  await two.waitForTimeout(900);
  const w = await two.evaluate(() => ({
    triple: document.getElementById('app').classList.contains('triple'),
    sel: [leftSel, rightSel],
    cduShown: !document.getElementById('cdu-wrap').classList.contains('page-hidden'),
  }));
  t.eq(w.triple, false, '2분할을 저장해 뒀으면 2분할로 뜬다');
  t.eq(w.sel.join('·'), 'pfd·map', `그때는 종전대로 좌 PFD · 우 MAP (${w.sel.join('·')})`);
  t.eq(w.cduShown, false, '그 배치에서는 CDU 가 접혀 있다');

  // ── PFD 단독 ──
  // 좌측 상단 버튼 하나로 PFD 만 화면 가득. 한 번 더 누르면 원래 배치로 돌아온다.
  // 화면에 실제로 무엇이 남아 있는지(패널 폭)로 확인한다 — 3분할이 기본이 된 뒤로는
  // 가운데 창을 접지 않으면 '단독' 인데도 지도가 옆에 남는다.
  const solo = await fresh.evaluate(() => {
    const W = id => Math.round(document.getElementById(id).getBoundingClientRect().width);
    const btn = document.getElementById('pfd-solo-btn');
    const before = { l: W('left-panel'), m: W('mid-panel'), r: W('right-panel'), txt: btn.textContent };
    btn.click();
    const on = { l: W('left-panel'), m: W('mid-panel'), r: W('right-panel'),
                 txt: btn.textContent, solo: _soloActive, cur: _soloCurrent,
                 pfd: document.getElementById('pfd-wrap').parentElement.id,
                 body: document.body.classList.contains('solo-mode') };
    btn.click();                                  // 다시 누르면 복귀
    const off = { l: W('left-panel'), m: W('mid-panel'), r: W('right-panel'),
                  txt: btn.textContent, solo: _soloActive,
                  sel: [leftSel, midSel, rightSel].join('·'),
                  triple: document.getElementById('app').classList.contains('triple') };
    return { before, on, off, full: Math.round(window.innerWidth) };
  });
  t.ok(solo.before.txt.includes('PFD 단독'), `좌측 상단에 PFD 단독 버튼이 있다 (${solo.before.txt})`);
  t.eq(solo.on.solo, true, '누르면 단독 화면으로 들어간다');
  t.eq(solo.on.cur, 'pfd', '보이는 것은 PFD 다');
  t.eq(solo.on.pfd, 'left-panel', 'PFD 가 그 창에 들어 있다');
  t.eq(solo.on.m, 0, `가운데 지도 창이 접힌다 (${solo.on.m}px — 접지 않으면 옆에 남는다)`);
  t.eq(solo.on.r, 0, `우측 CDU 창도 접힌다 (${solo.on.r}px)`);
  t.ok(solo.on.l > solo.full * 0.95,
    `PFD 가 화면을 가득 채운다 (${solo.on.l}px / ${solo.full}px)`);
  t.ok(solo.on.txt.includes('분할') && !solo.on.txt.includes('단독'),
    `그때 버튼은 되돌아가는 버튼이 된다 (${solo.on.txt})`);
  t.eq(solo.off.solo, false, '한 번 더 누르면 나온다');
  t.eq(solo.off.triple, true, '나오면 3분할 배치가 그대로 돌아온다');
  t.eq(solo.off.sel, 'pfd·cdu·map', `창 배치도 들어가기 전 그대로다 (${solo.off.sel})`);
  t.ok(solo.off.m > 50 && solo.off.r > 50,
    `가운데·우측 창이 다시 자리를 잡는다 (${solo.off.m}px · ${solo.off.r}px)`);

  // ── MAP 단독 · CDU 단독 ──
  // 같은 방식이 다른 창에도 그대로 되는가. 어느 창이 화면을 차지하는지로 본다.
  for (const [screen, btnId, wrap] of [['map', 'map-solo-btn', 'map-wrap'],
                                       ['cdu', 'cdu-solo-btn', 'cdu-wrap']]) {
    const r = await fresh.evaluate(([sc, id, wr]) => {
      const W = e => Math.round(e.getBoundingClientRect().width);
      const btn = document.getElementById(id);
      const label = btn.textContent;
      btn.click();
      const host = document.getElementById(wr).parentElement;
      const others = ['left-panel', 'mid-panel', 'right-panel']
        .filter(x => x !== host.id).map(x => W(document.getElementById(x)));
      const on = { solo: _soloActive, cur: _soloCurrent, host: host.id,
                   w: W(host), others, shown: !document.getElementById(wr).classList.contains('page-hidden') };
      exitSolo();
      return { label, on, sel: [leftSel, midSel, rightSel].join('·'),
               solo: _soloActive, full: Math.round(window.innerWidth) };
    }, [screen, btnId, wrap]);
    t.ok(r.label.includes(screen.toUpperCase() + ' 단독'),
      `${screen.toUpperCase()} 단독 버튼이 그 창 탭 줄에 있다 (${r.label})`);
    t.eq(r.on.cur, screen, `누르면 ${screen.toUpperCase()} 단독으로 들어간다`);
    t.eq(r.on.shown, true, '그 창이 화면에 남는다');
    t.eq(r.on.others.join('·'), '0·0', `나머지 두 창은 접힌다 (${r.on.others.join('·')}px)`);
    t.ok(r.on.w > r.full * 0.95, `화면을 가득 채운다 (${r.on.w}px / ${r.full}px)`);
    t.eq(r.solo, false, '나오면 단독이 풀린다');
    t.eq(r.sel, 'pfd·cdu·map', `배치도 들어가기 전 그대로다 (${r.sel})`);
  }

  // ── Flight Plan 은 CDU 가 있는 창에서 열린다 ──
  // 종전에는 늘 우측 창에서 열려, CDU 를 좌측에 둔 3분할에서 FPL 을 누르면
  // 엉뚱하게 우측(PFD) 창이 Flight Plan 으로 바뀌었다.
  const plan = await fresh.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleTriple(true);
    selectPanel('mid', 'cdu', true);      // 기본 배치 — 좌 PFD · 중 CDU · 우 MAP
    selectPanel('right', 'map', true);
    await wait(150);
    const host = id => {
      const e = document.getElementById(id);
      return e && e.parentElement && !e.classList.contains('page-hidden') ? e.parentElement.id : null;
    };
    openFlightPlan();
    await wait(150);
    const on = { plan: host('fp-wrap'), pfd: host('pfd-wrap'), map: host('map-wrap'),
                 cdu: host('cdu-wrap'), sel: [leftSel, midSel, rightSel].join('·'),
                 // 탭 표시는 CDU 가 켜진 것으로 본다(PLAN 은 CDU 의 한 화면이다)
                 tab: (document.querySelector('#mid-tabs [data-sel].active') || {}).dataset?.sel };
    fpBackToCdu();                       // BACK 으로 돌아오면 그 자리가 다시 CDU
    await wait(150);
    const back = { cdu: host('cdu-wrap'), plan: host('fp-wrap'), pfd: host('pfd-wrap') };
    // 우측에 CDU 를 둔 평소 배치에서는 종전과 같다
    selectPanel('left', 'pfd', true);
    selectPanel('right', 'cdu', true);
    await wait(150);
    openFlightPlan();
    await wait(150);
    const usual = { plan: host('fp-wrap'), pfd: host('pfd-wrap') };
    fpBackToCdu();
    await wait(150);
    return { on, back, usual };
  });
  t.eq(plan.on.plan, 'mid-panel', `CDU 가 가운데면 Flight Plan 도 가운데에서 열린다 (${plan.on.plan})`);
  t.eq(plan.on.pfd, 'left-panel', 'PFD 는 제자리에 그대로 있다');
  t.eq(plan.on.map, 'right-panel', '우측 지도도 그대로다');
  t.eq(plan.on.cdu, null, 'CDU 화면은 그 자리에서 Flight Plan 으로 바뀐 것이다');
  t.eq(plan.on.sel, 'pfd·plan·map', `창 상태도 그렇다 (${plan.on.sel})`);
  t.eq(plan.on.tab, 'cdu', 'CDU 탭이 켜진 채로 보인다');
  t.eq(plan.back.cdu, 'mid-panel', 'BACK 을 누르면 그 자리가 다시 CDU 가 된다');
  t.eq(plan.back.plan, null, 'Flight Plan 은 접힌다');
  t.eq(plan.back.pfd, 'left-panel', 'PFD 는 끝까지 제자리다');
  t.eq(plan.usual.plan, 'right-panel', `CDU 가 우측이면 종전대로 우측에서 열린다 (${plan.usual.plan})`);
  t.eq(plan.usual.pfd, 'left-panel', '그때는 좌측 PFD 가 그대로다');

  // ── 같은 창이 두 패널에 겹쳐 뜨지 않는다 ──
  // CDU 와 PLAN 은 한 창의 두 화면이다. 따로 치면 두 패널에 CDU 가 겹쳐 뜨고,
  // 한쪽에서 FPL 을 눌러도 다른 쪽이 바뀐다 — 실제로 났던 증상이다.
  // 2D 지도와 3D 지도만 서로 다른 창이라 나란히 둘 수 있다.
  const dup = await fresh.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const sel = () => [leftSel, midSel, rightSel].join('·');
    toggleTriple(true);
    selectPanel('mid', 'cdu', true); selectPanel('right', 'map', true);   // 좌 PFD · 중 CDU · 우 MAP
    await wait(120);
    openFlightPlan();                       // 가운데가 PLAN 이 된다
    await wait(120);
    const a = sel();
    // 그 상태에서 우측에 CDU 를 부르면 가운데 PLAN 과 겹쳐서는 안 된다
    selectPanel('right', 'cdu', true);
    await wait(120);
    const b = sel();
    const frames = document.querySelectorAll('.page-content:not(.page-hidden) .cdu-frame').length;
    // 저장된 배치를 되살리듯 상태를 직접 겹쳐 놓아도 그릴 때 바로잡는다
    leftSel = 'pfd'; midSel = 'cdu'; rightSel = 'plan';
    applyPanels(); await wait(120);
    const c = sel();
    // 2D·3D 지도는 나란히 둘 수 있다
    selectPanel('left', 'pfd', true);
    selectPanel('mid', 'map', true); selectPanel('right', 'm3d', true);
    await wait(120);
    const d = sel();
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    await wait(120);
    return { a, b, c, d, frames };
  });
  t.eq(dup.a, 'pfd·plan·map', `CDU 자리에서 Flight Plan 이 열린다 (${dup.a})`);
  t.ok(!/plan/.test(dup.b) || !/cdu/.test(dup.b),
    `CDU 를 다른 창으로 부르면 PLAN 과 겹치지 않는다 (${dup.b})`);
  t.eq(dup.frames, 1, `CDU 화면은 한 번만 뜬다 (${dup.frames}개)`);
  t.ok(!(/cdu/.test(dup.c) && /plan/.test(dup.c)),
    `겹친 배치를 되살려도 그릴 때 바로잡는다 (${dup.c})`);
  t.eq(dup.d, 'pfd·map·m3d', `2D 와 3D 지도는 나란히 둘 수 있다 (${dup.d})`);

  // ── 2분할에서도 오른쪽 창 탭에 Cockpit Mode 가 보이고, 눌러서 3D 조종석으로 간다 ──
  const only = await two.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const app = document.getElementById('app');
    for (let i = 0; i < 4 && (app.classList.contains('triple') || app.classList.contains('quad')); i++) { cycleSplit(); await wait(150); }
    const b = document.getElementById('m3d-only-btn');
    const shown = !app.classList.contains('triple') && b.getBoundingClientRect().width > 0;
    b.click(); await wait(300);
    const solo = _soloActive && _soloCurrent === 'm3d';
    const label = b.textContent;
    exitSolo(); await wait(200);
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 절차 훈련판 */ }
    return { shown, solo, back: !_soloActive, label, label2: b.textContent };
  });
  t.ok(only.shown && only.label2 === '⛶ Cockpit Mode', `2분할에서도 오른쪽 창 탭에 Cockpit Mode 가 보인다 (${only.label2})`);
  t.ok(only.solo && only.back, `2분할에서 Cockpit Mode 를 누르면 3D 조종석으로 갔다가 돌아온다 (단독 ${only.solo} · 복귀 ${only.back})`);

  // ── PFD 배치: CRHT·NAV 칸은 고도계+승강계와 같은 폭으로 오른쪽 끝 · HSI 오른쪽 끝에 맞닿는다 ──
  //    (속도계 · 고도계는 가운데로 모아 좌우 대칭 — 자세계 · HSI 가운데가 한 줄. 넓이 420 미만은 종전대로 양끝)
  const al = await two.evaluate(() => [1400, 1000, 700, 560, 400].map(W => {
    const L = pfdLayout(W, 900, 300);
    const sym = W < 420 || Math.abs(L.spd.x - (W - L.alt.x - L.alt.w)) < 0.5;
    const rightEnd = L.insetOn ? L.inset.x + L.inset.w : L.crht.x + L.crht.w;   // MAP · TCAS 창이 있으면 그 창이 오른쪽 끝
    return Math.abs(L.crht.w - (L.alt.w + L.vsi.w)) < 0.5 && Math.abs(rightEnd - (W - L.pad)) < 0.5 &&
           (!L.insetOn || L.inset.x > L.crht.x + L.crht.w) &&
           Math.abs(L.navs.x - L.crht.x) < 0.5 && Math.abs(L.hsi.x + L.hsi.w - L.crht.x) < 0.5 &&
           L.ai.x === 0 && L.ai.w === W && sym;
  }));
  t.ok(al.every(Boolean), `CRHT·NAV 칸은 HSI 옆(오른쪽 끝은 MAP·TCAS 창) · 자세계 전체 폭 · 속도계/고도계 좌우 대칭 (${al.join(' ')})`);

  await ctx1.close();
  await ctx2.close();
}
