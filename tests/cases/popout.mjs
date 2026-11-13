// 패널 새 창(다중 모니터) — 00-popout.js
//
// ⧉ 로 패널을 새 창에 옮겨 띄우면, 앱은 하나 그대로 돌고(상태가 갈라지지 않는다)
// 새 창 안의 탭·키보드가 본 창의 앱을 움직이며, 닫으면 제자리로 돌아오는지 본다.
export const name = '패널 새 창';

export async function run(page, t) {
  // 화면 배치 — 기본 3분할 PFD · CDU · MAP, 탭은 창마다 정해진 것만
  const tabs = await page.evaluate(() => {
    const txt = id => Array.from(document.getElementById(id).querySelectorAll('button'))
      .filter(b => getComputedStyle(b).display !== 'none' && !b.classList.contains('po-top-btn')).map(b => b.textContent.trim()).join('|');
    return { sel: [leftSel, midSel, rightSel].join('·'), tri: tripleMode,
             L: txt('left-tabs'), M: txt('mid-tabs'), R: txt('page-tabs') };
  });
  t.ok(tabs.tri && tabs.sel === 'pfd·cdu·map', `처음에는 3분할 PFD · CDU · MAP (${tabs.sel})`);
  t.ok(/^PFD\|SYSTEM\|▦ 4분할\|⧉ 창 배치\|⧉ POP UP$/.test(tabs.L), `PFD 창 탭: PFD · SYSTEM · 분할(→4분할) · 창 배치 · POP UP (+ 📌 Top) (${tabs.L})`);
  // 제일 왼쪽 창의 SYSTEM 탭 — PFD 자리에 SYSTEM 창, PFD 탭으로 돌아온다(다른 창이 SYSTEM 이면 맞바꾼다)
  const lsys = await page.evaluate(() => {
    const where = () => [leftSel, document.getElementById('sysp-wrap').parentElement.id, document.getElementById('pfd-wrap').classList.contains('page-hidden')];
    selectPanel('right', 'sysp');
    document.querySelector('#left-tabs [data-sel="sysp"]').click(); const a = where(), r = rightSel;
    document.querySelector('#left-tabs [data-sel="pfd"]').click(); const b = where();
    selectPanel('right', 'map');
    return { a, r, b };
  });
  t.ok(lsys.a.join() === 'sysp,left-panel,true' && lsys.r !== 'sysp' && lsys.b[0] === 'pfd' && lsys.b[2] === false,
    `왼쪽 창 SYSTEM 탭 — PFD 자리에 SYSTEM, PFD 탭으로 돌아온다 (${lsys.a.join(' ')} · 우측 ${lsys.r} · ${lsys.b.join(' ')})`);
  t.ok(tabs.M === 'CDU|MAP|⛶ Cockpit Mode|UPPER|LOWER|SYSTEM|⧉ POP UP|⟳', `CDU 창 탭: CDU · MAP · Cockpit Mode(3D 자리) · UPPER · LOWER · SYSTEM · POP UP · 새로고침 (+ 📌 Top) (${tabs.M})`);
  t.ok(tabs.R === 'CDU|MAP|UPPER|LOWER|SYSTEM|⛶ Cockpit Mode|⧉ POP UP', `MAP 창 탭: CDU · MAP · UPPER · LOWER · SYSTEM · Cockpit Mode · POP UP (+ 📌 Top) (${tabs.R})`);
  const two = await page.evaluate(() => { toggleTriple(false); const o = [leftSel, rightSel].join('·'); toggleTriple(true); return o; });
  t.eq(two, 'pfd·map', '2분할은 PFD · MAP');
  // 4분할 — 위에 PFD · 3D · MAP, 아래에 CDU
  const quad = await page.evaluate(async () => {
    setSplitMode(4); await new Promise(r => setTimeout(r, 400));
    const box = id => document.getElementById(id).getBoundingClientRect();
    const host = id => document.getElementById(id).parentElement.id;
    const o = { sel: [leftSel, midSel, rightSel, botSel].join('·'), pfd: host('pfd-wrap'), m3d: host('map3d-wrap'), map: host('map-wrap'), cdu: host('cdu-wrap'),
                L: box('left-panel'), M: box('mid-panel'), R: box('right-panel'), B: box('bot-panel'), btn: document.getElementById('split-toggle').textContent };
    o.btn = document.getElementById('split-toggle').textContent;
    o.gripVis = getComputedStyle(document.getElementById('qgrip-1')).display;
    cycleSplit(); o.after = { tri: tripleMode, quad: quadMode }; setSplitMode(4); await new Promise(r => setTimeout(r, 300));
    return o;
  });
  t.ok(quad.sel === 'pfd·m3d·map·cdu' && quad.pfd === 'left-panel' && quad.m3d === 'mid-panel' && quad.map === 'right-panel' && quad.cdu === 'bot-panel',
    `4분할 — 위 PFD · 3D · MAP, 아래 CDU (${quad.sel})`);
  t.ok(quad.L.y === quad.M.y && quad.M.y === quad.R.y && Math.abs(quad.L.height - quad.M.height) < 2 &&
       quad.R.height < quad.L.height * 0.7 && quad.B.y > quad.R.y + quad.R.height - 5 && Math.abs(quad.B.x - quad.R.x) < 2,
    '왼쪽 두 창(PFD · 3D)은 높이를 다 쓰고, 오른쪽 열을 위 MAP · 아래 CDU 로 나눈다');
  t.ok(quad.btn === '⿰ 2분할' && !quad.after.tri && !quad.after.quad, '분할 버튼은 2 → 3 → 4 → 2 로 돈다');
  // 4분할 비율 — 1|2 열 그립을 끌면 PFD 폭이, 3열 위|아래 그립을 끌면 MAP 높이가 바뀐다
  const drag = async (id, fx, fy) => {
    const g = await page.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); const a = document.getElementById('app').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, ax: a.x, ay: a.y, aw: a.width, ah: a.height }; }, id);
    await page.mouse.move(g.x, g.y); await page.mouse.down();
    await page.mouse.move(fx === null ? g.x : g.ax + g.aw * fx, fy === null ? g.y : g.ay + g.ah * fy, { steps: 6 });
    await page.mouse.up(); await page.waitForTimeout(250);
  };
  await drag('qgrip-1', 0.25, null);
  await drag('qgrip-3', null, 0.4);
  const qr = await page.evaluate(() => { const a = document.getElementById('app').getBoundingClientRect(), L = document.getElementById('left-panel').getBoundingClientRect(),
    R = document.getElementById('right-panel').getBoundingClientRect(); return { l: L.width / a.width, r: R.height / a.height, vis: getComputedStyle(document.getElementById('qgrip-1')).display }; });
  t.ok(quad.gripVis !== 'none' && Math.abs(qr.l - 0.25) < 0.03 && Math.abs(qr.r - 0.4) < 0.03,
    `4분할 경계를 끌어 비율을 바꾼다 (PFD 폭 ${(qr.l * 100).toFixed(0)}% · MAP 높이 ${(qr.r * 100).toFixed(0)}%)`);
  await page.evaluate(async () => { setSplitMode(3); await new Promise(r => setTimeout(r, 300)); });
  const ctx = page.context();
  const pp = ctx.waitForEvent('page');
  await page.click('#mid-panel .po-btn');
  const pop = await pp;
  await page.waitForTimeout(1200);
  const a = await page.evaluate(() => {
    const L = document.getElementById('mid-panel');
    return { sides: popoutSides(), moved: L.ownerDocument !== document, pfdW: document.getElementById('cdu-wrap').getBoundingClientRect().width,
             cls: document.getElementById('app').className, divider: getComputedStyle(document.getElementById('divider-2')).display };
  });
  t.ok(a.sides.join() === 'mid' && a.moved, 'POP UP 을 누르면 가운데(CDU) 패널이 새 창으로 옮겨 간다');
  t.ok(a.pfdW > 100, `새 창에서도 CDU 가 그 창 크기로 그려진다 (${a.pfdW}px)`);
  t.ok(/po-mid/.test(a.cls) && a.divider === 'none', '본 창에서는 그 자리의 구분선이 사라지고 남은 패널이 나눠 갖는다');

  // 둘만 남은 본 창 — 남은 경계(좌|우)를 끌면 비율이 바뀐다
  const g = await page.evaluate(() => { const r = document.getElementById('divider-grip').getBoundingClientRect();
    const a = document.getElementById('app').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, ax: a.x, aw: a.width }; });
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  await page.mouse.move(g.ax + g.aw * 0.3, g.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const lw = await page.evaluate(() => document.getElementById('left-panel').getBoundingClientRect().width / document.getElementById('app').getBoundingClientRect().width);
  t.ok(Math.abs(lw - 0.3) < 0.05, `창 하나를 띄운 뒤 남은 두 창의 비율을 끌어 바꾼다 (좌 ${(lw * 100).toFixed(0)}%)`);

  const topVis = await pop.evaluate(() => getComputedStyle(document.querySelector('#mid-tabs .po-top-btn')).display);
  const topMain = await page.evaluate(() => getComputedStyle(document.querySelector('#page-tabs .po-top-btn')).display);
  t.ok(topVis !== 'none' && topMain !== 'none', `새 창과 본 창 탭에 📌 Top 버튼이 있다 (${topVis} · ${topMain})`);

  await pop.click('#mid-tabs [data-sel="map"]');
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => ({ sel: midSel, inPop: document.getElementById('map-wrap').ownerDocument !== document }));
  t.ok(b.sel === 'map' && b.inPop, '새 창의 탭을 누르면 본 창의 앱이 그 패널을 바꾼다(MAP 이 새 창으로)');
  await pop.click('#mid-tabs [data-sel="cdu"]');
  await page.waitForTimeout(300);

  const r0 = await page.evaluate(() => S.running);
  await pop.keyboard.press('Space');
  await page.waitForTimeout(200);
  const r1 = await page.evaluate(() => S.running);
  t.ok(r0 !== r1, '새 창에서 누른 키(스페이스 FLY/PAUSE)도 앱에 닿는다');
  if (r1) await page.evaluate(() => toggleSim());

  // 본 창의 그리기 주기가 멈춰도(새 창 전체화면으로 가려짐) 새 창이 시뮬을 대신 돌린다
  const pumped = await page.evaluate(async () => {
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;           // 본 창 rAF 를 멈춘 셈
    await new Promise(r => setTimeout(r, 400));
    const t0 = _simLastTick;
    await new Promise(r => setTimeout(r, 800));
    const t1 = _simLastTick;
    window.requestAnimationFrame = raf; requestAnimationFrame(simStep);
    return t1 - t0;
  });
  t.ok(pumped > 300, `본 창이 멈춰도 새 창이 시뮬을 이어 돌린다 (${pumped.toFixed(0)}ms 진행)`);

  // 📌 Top — 늘 위에 뜨는 창(문서 PIP)으로 옮긴다. 닫으면 본 창으로 돌아온다
  if (await pop.evaluate(() => typeof documentPictureInPicture !== 'undefined')) {
    const pp3 = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await pop.click('#mid-tabs .po-top-btn');
    const pip = await pp3;
    await page.waitForTimeout(1200);
    const tp = await page.evaluate(() => ({ sides: popoutSides(), inMain: document.getElementById('mid-panel').ownerDocument === document }));
    t.ok(pip && tp.sides.join() === 'mid' && !tp.inMain, 'Top 을 누르면 패널이 늘 위에 뜨는 창으로 옮겨 간다');
    if (pip) await pip.close();
    await page.waitForTimeout(1200);
    const tb = await page.evaluate(() => ({ sides: popoutSides(), back: document.getElementById('mid-panel').ownerDocument === document }));
    t.ok(tb.sides.length === 0 && tb.back, 'Top 창을 닫으면 본 창으로 돌아온다');
  } else {
    await pop.close();
  }
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => popoutSides().length === 0))) await pop.close().catch(() => {});
  await page.waitForTimeout(1200);
  const c = await page.evaluate(() => ({ sides: popoutSides(), back: document.getElementById('mid-panel').ownerDocument === document,
    order: Array.from(document.getElementById('app').children).map(x => x.id).filter(Boolean).join(','),
    btn: document.querySelector('#mid-panel .po-btn').textContent }));
  t.ok(c.sides.length === 0 && c.back, '새 창을 닫으면 패널이 본 창으로 돌아온다');
  t.ok(c.order.startsWith('left-panel,panel-divider,mid-panel'), `제자리(가운데)로 돌아온다 (${c.order})`);
  t.eq(c.btn, '⧉ POP UP', '버튼도 원래대로');

  // 본 창의 📌 Top — 그 패널을 곧바로 늘 위 창으로(새 창을 거치지 않는다)
  if (await page.evaluate(() => typeof documentPictureInPicture !== 'undefined')) {
    const pp4 = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await page.click('#page-tabs .po-top-btn');
    const pip2 = await pp4;
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => ({ sides: popoutSides(), moved: document.getElementById('right-panel').ownerDocument !== document }));
    t.ok(pip2 && m.sides.join() === 'right' && m.moved, '본 창의 Top 을 누르면 그 패널이 곧바로 늘 위 창으로 간다');
    if (pip2) await pip2.close();
    await page.waitForTimeout(1200);
    t.ok(await page.evaluate(() => popoutSides().length === 0 && document.getElementById('right-panel').ownerDocument === document), '닫으면 본 창으로 돌아온다');
  }

  // ── SIM Mode 창 배치판 — 화면마다 새 창으로 ──
  await page.evaluate(() => { try { popoutCloseAll(); } catch (e) {} simLayoutShow(); });
  await page.waitForTimeout(300);
  const shots = {};
  for (const k of ['ovhd', 'pfd']) {
    const pw = ctx.waitForEvent('page');
    await page.click(`#simlay .simlay-btn[data-scr="${k}"]`);
    const w = await pw; await page.waitForTimeout(900);
    shots[k] = await w.evaluate(id => { const el = document.getElementById(id); const r = el && el.getBoundingClientRect();
      return { here: !!el, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, title: document.title }; }, k === 'ovhd' ? 'ovhd-wrap' : 'pfd-wrap');
  }
  const lay = await page.evaluate(() => ({ open: popoutScreens().join(','), on: [...document.querySelectorAll('#simlay .simlay-btn.on')].map(b => b.dataset.scr).join(','),
    ovhdHere: !!document.getElementById('ovhd-wrap') && document.getElementById('ovhd-wrap').ownerDocument === document }));
  t.ok(shots.ovhd.here && shots.ovhd.w > 300 && shots.ovhd.h > 300 && /UPPER/.test(shots.ovhd.title),
    `창 배치판에서 UPPER 를 누르면 UPPER 콘솔만 새 창에 가득 뜬다 (${shots.ovhd.w}×${shots.ovhd.h} · ${shots.ovhd.title})`);
  t.ok(shots.pfd.here && shots.pfd.w > 300, `PFD(FCP 포함)도 따로 새 창으로 (${shots.pfd.w}×${shots.pfd.h})`);
  t.ok(lay.open === 'ovhd,pfd' && lay.on === 'pfd,ovhd' && !lay.ovhdHere, `배치판은 떠 있는 화면을 표시한다 (${lay.open} · 표시 ${lay.on})`);
  await page.click('#simlay .simlay-btn[data-scr="ovhd"]');       // 한 번 더 — 본 창으로
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({ open: popoutScreens().join(','), ovhdHere: document.getElementById('ovhd-wrap').ownerDocument === document }));
  await page.evaluate(() => { simLayoutAllBack(); simLayoutHide(); });
  await page.waitForTimeout(600);
  const all = await page.evaluate(() => ({ open: popoutScreens().length, pfdHome: document.getElementById('pfd-wrap').parentElement.id }));
  t.ok(back.open === 'pfd' && back.ovhdHere, '한 번 더 누르면 그 화면만 본 창으로 돌아온다');
  t.ok(all.open === 0 && all.pfdHome === 'left-panel', `'모두 본 창으로' 는 모든 화면을 분할 패널로 되돌린다 (PFD → ${all.pfdHome})`);

  // ── Simple mode — 창 하나씩 화면 가득 ──
  const simp = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const host = id => document.getElementById(id).parentElement.id;
    const o = {};
    simpleModeStart('pfd'); await wait(200);
    o.pfd = host('pfd-wrap'); o.appHidden = getComputedStyle(document.getElementById('app')).display === 'none';
    document.querySelector('#simple-bar [data-scr="lcon"]').click(); await wait(200);
    const lw = document.getElementById('lcon-wrap'); o.lcon = host('lcon-wrap'); o.lconW = lw.getBoundingClientRect().width;
    o.pfdBack = host('pfd-wrap'); o.on = [...document.querySelectorAll('#simple-bar .on')].map(b => b.dataset.scr).join();
    // 지도(MAP)를 골라도 위 막대 버튼이 맨 위에 있어 눌린다 · 상태바(safe-area) 만큼 내려 둔다(iPad 홈 화면 앱)
    document.querySelector('#simple-bar [data-scr="map"]').click(); await wait(300);
    o.tap = [...document.querySelectorAll('#simple-bar button')].every(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); });
    o.safe = [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /#simple-bar/.test(r.selectorText || '') && /safe-area-inset-top/.test(r.cssText)); } catch (e) { return false; } });
    document.querySelector('#simple-bar [data-scr="sysp"]').click(); await wait(200); o.sysp = host('sysp-wrap'); o.lconBack = document.getElementById('lcon-wrap').classList.contains('page-hidden');   // 고르지 않은 창은 숨는다
    document.querySelector('#simple-bar .simple-exit').click(); await wait(300);
    o.exit = { simple: document.body.classList.contains('simple-mode'), pfd: host('pfd-wrap'), app: getComputedStyle(document.getElementById('app')).display !== 'none' };
    // 3D 단독 계기 크기
    const k0 = pfdOvScale; pfdOvSize(2); const ov = document.getElementById('pfd-ov');
    o.ov = [pfdOvScale, parseFloat(ov.style.width), parseFloat(ov.style.height)]; pfdOvSize(-9); o.min = pfdOvScale; pfdOvSize(20); o.max = pfdOvScale;
    pfdOvScale = k0; pfdOvSize(0); localStorage.removeItem('pfdOvScale');
    return o;
  });
  t.ok(simp.pfd === 'simple-host' && simp.appHidden, `Simple mode — 분할 화면을 감추고 고른 창(PFD) 하나만 화면 가득`);
  t.ok(simp.lcon === 'simple-host' && simp.lconW > 500 && simp.pfdBack !== 'simple-host' && simp.on === 'lcon' && simp.sysp === 'simple-host' && simp.lconBack,
    `위 막대에서 다른 창(LOWER · SYSTEM)을 누르면 그 창 하나로 바뀐다 (LOWER 폭 ${Math.round(simp.lconW)}px)`);
  t.ok(simp.tap && simp.safe, `MAP 을 골라도 위 막대 버튼이 가려지지 않고 눌린다 · 상태바(safe-area) 아래로 (tap ${simp.tap} · safe ${simp.safe})`);
  t.ok(!simp.exit.simple && simp.exit.pfd === 'left-panel' && simp.exit.app, "'PC 모드' 를 누르면 분할 화면으로 돌아온다");
  t.ok(simp.ov[0] === 1.2 && simp.ov[1] === 30 && simp.ov[2] === 72 && simp.min === 0.6 && simp.max === 1.6,
    `3D 화면 계기 크기 −/+ — 60~160% (120% → 폭 ${simp.ov[1]}% · 높이 ${simp.ov[2]}%)`);
}
