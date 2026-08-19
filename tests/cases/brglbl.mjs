// 지도 BRG 이름표 시현 토글 — #1BDP · #2BDP
//
// 니들(선)은 보고 싶은데 방위·거리 이름표까지 늘 붙어 있으면 지도를 가린다.
// BRG1/BRG2 버튼 아래에 이름표 전용 토글을 두고, 기본은 끔.
// '선은 그대로, 이름표만 사라진다' 가 핵심이다 — 선까지 사라지면 다른 기능이다.
export const name = 'BRG 이름표 시현';

export async function run(page, t) {
  const setup = () => page.evaluate(() => {
    S.wps = [{ ident: 'TGT', lat: 37.6, lon: 127.4 }];
    S.awp = 0; S.fwp = -1; S.brg2wp = 0;
    S.lat = 37.2; S.lon = 127.0; S.alt = 3000;
    setNavRadio('NAV1', '115.5', 'SEL'); navSrc = 'NAV1'; applyNavRadioToPfd();
    obsOn = false; holdExit();
    brg1Visible = true; brg2Visible = true;
    brg1LblOn = false; brg2LblOn = false;
    const b1 = document.getElementById('brg1-bdp'), b2 = document.getElementById('brg2-bdp');
    if (b1) b1.classList.remove('brg1-on');
    if (b2) b2.classList.remove('brg2-on');
    updateNav();
  });

  const read = () => page.evaluate(() => {
    const txt = ref => {
      const el = ref.mk && ref.mk.getElement();
      return el && el.firstChild ? el.firstChild.textContent.trim() : null;
    };
    return { l1: txt(_brg1Ref), l2: txt(_brg2Ref),
             line1: brg1Line.getLatLngs().length, line2: brg2Line.getLatLngs().length,
             on1: document.getElementById('brg1-bdp').classList.contains('brg1-on'),
             on2: document.getElementById('brg2-bdp').classList.contains('brg2-on') };
  });

  // ── 버튼이 BRG1/BRG2 아래에 있는가 ──
  const ui = await page.evaluate(() => {
    const box = id => {
      const e = document.getElementById(id);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top, left: r.left, txt: e.textContent.trim() };
    };
    return { b1: box('brg1-tog'), b2: box('brg2-tog'),
             d1: box('brg1-bdp'), d2: box('brg2-bdp') };
  });
  t.ok(ui.d1 && ui.d2, '#1BDP · #2BDP 버튼이 있다');
  t.eq(ui.d1.txt + ' ' + ui.d2.txt, '#1BDP #2BDP', `이름이 그대로다 (${ui.d1.txt} ${ui.d2.txt})`);
  t.ok(ui.d1.top > ui.b1.top && ui.d2.top > ui.b2.top,
    'BRG1·BRG2 버튼 아래 줄에 있다');
  t.ok(Math.abs(ui.d1.left - ui.b1.left) < 6 && Math.abs(ui.d2.left - ui.b2.left) < 6,
    '각각 위 버튼과 같은 열에 선다');

  // ── 기본은 미시현 ──
  await setup();
  const off = await read();
  t.eq(off.l1, null, '처음에는 BRG1 이름표가 없다 (기본 미시현)');
  t.eq(off.l2, null, '처음에는 BRG2 이름표도 없다');
  t.ok(off.line1 === 2 && off.line2 === 2, '이름표가 없어도 니들 선은 그대로 그려진다');
  t.ok(!off.on1 && !off.on2, '버튼도 꺼진 모양이다');

  // ── 켜면 그때만 나타난다 ──
  await page.evaluate(() => { document.getElementById('brg1-bdp').click(); });
  const on1 = await read();
  t.ok(on1.l1 && /^BRG1 \d{3}° [\d.]+NM$/.test(on1.l1),
    `#1BDP 를 켜면 BRG1 이름표가 나온다 (${on1.l1})`);
  t.eq(on1.l2, null, 'BRG2 는 따로 논다 — 아직 없다');
  t.ok(on1.on1 && !on1.on2, '버튼 상태도 따로 표시된다');

  await page.evaluate(() => { document.getElementById('brg2-bdp').click(); });
  const on2 = await read();
  t.ok(on2.l2 && /^BRG2 \d{3}° [\d.]+NM$/.test(on2.l2),
    `#2BDP 를 켜면 BRG2 이름표가 나온다 (${on2.l2})`);
  t.ok(on2.l1, 'BRG1 이름표는 그대로 남아 있다');

  // ── 다시 끄면 사라진다(선은 남는다) ──
  const back = await page.evaluate(async () => {
    document.getElementById('brg1-bdp').click();
    document.getElementById('brg2-bdp').click();
    await new Promise(r => setTimeout(r, 20));
    const el = r => (r.mk && r.mk.getElement()) ? r.mk.getElement().firstChild.textContent.trim() : null;
    return { l1: el(_brg1Ref), l2: el(_brg2Ref),
             line1: brg1Line.getLatLngs().length, line2: brg2Line.getLatLngs().length,
             layer1: !!(_brg1Ref.mk), layer2: !!(_brg2Ref.mk) };
  });
  t.ok(back.l1 === null && back.l2 === null, '한 번 더 누르면 이름표가 사라진다');
  t.ok(!back.layer1 && !back.layer2, '지도에서 이름표 레이어까지 걷어낸다(빈 글자만 남기지 않는다)');
  t.ok(back.line1 === 2 && back.line2 === 2, '선은 여전히 남아 있다');

  // ── 니들 자체를 끄면 이름표도 함께 사라진다 ──
  const needleOff = await page.evaluate(async () => {
    document.getElementById('brg1-bdp').click();          // 이름표 켬
    brg1Visible = false; updateBrgLines();
    await new Promise(r => setTimeout(r, 20));
    const r = { lbl: !!_brg1Ref.mk, line: brg1Line.getLatLngs().length };
    brg1Visible = true; document.getElementById('brg1-bdp').click();
    updateBrgLines();
    return r;
  });
  t.ok(!needleOff.lbl && needleOff.line === 0,
    'BRG1 니들을 끄면 선도 이름표도 없다');
}
