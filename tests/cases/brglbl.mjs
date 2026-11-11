// 지도 BRG 시현 — 옛 FCP #1BDP · #2BDP 는 없앴고, PFD 소프트키 PFD Settings → Bearing1 · Bearing2 가 정한다.
//
// 지도에 BRG 선과 방위·거리 글자가 늘 붙어 있으면 지형·항로를 가린다 — 처음(고르기 전)은 지도에 없다.
// 소프트키로 국(NAV1 · NAV2 · FMS)을 고르면 선과 글자가 '함께' 나오고, OFF 면 '함께' 사라진다.
export const name = 'BRG 지도 시현';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    S.wps = [{ ident: 'TGT', lat: 37.6, lon: 127.4 }];
    S.awp = 0; S.fwp = -1;
    S.lat = 37.2; S.lon = 127.0; S.alt = 3000;
    setNavRadio('NAV1', '115.5', 'SEL'); navSrc = 'NAV1'; applyNavRadioToPfd();
    obsOn = false; holdExit();
    brg1Visible = true; brg2Visible = true; brg1Src = null; brg2Src = null;
    brg1LblOn = false; brg2LblOn = false;
    updateNav();
    const txt = ref => { const el = ref.mk && ref.mk.getElement(); return el && el.firstChild ? el.firstChild.textContent.trim() : null; };
    const read = () => ({ l1: txt(_brg1Ref), l2: txt(_brg2Ref), line1: brg1Line.getLatLngs().length, line2: brg2Line.getLatLngs().length,
                          layer1: !!_brg1Ref.mk, layer2: !!_brg2Ref.mk });
    const o = {};
    o.noBtns = !document.getElementById('brg1-tog') && !document.getElementById('brg1-bdp') && !document.getElementById('brg2-bdp');
    o.off = read();
    // Bearing1 → NAV1 (처음 OFF 가 아니므로 NAV1 이 될 때까지)
    while (brgSrcLabel(1) !== 'NAV1' || !brg1LblOn) brgSrcCycle(1);
    await wait(20); o.on1 = read();
    while (brgSrcLabel(2) !== 'FMS' || !brg2LblOn) brgSrcCycle(2);
    await wait(20); o.on2 = read();
    // OFF — 니들 · 선 · 글자 함께
    while (brgSrcLabel(1) !== 'OFF') brgSrcCycle(1);
    while (brgSrcLabel(2) !== 'OFF') brgSrcCycle(2);
    await wait(20); o.back = read(); o.needles = brg1Visible || brg2Visible;
    // 되돌림
    brg1Src = null; brg2Src = null; brg1LblOn = false; brg2LblOn = false;
    if (!brg1Visible) toggleBrg1(); if (!brg2Visible) toggleBrg2(); updateBrgLines();
    return o;
  });
  t.ok(r.noBtns, 'FCP 의 BRG1 · BRG2 · #1BDP · #2BDP 버튼은 없다(소프트키로 고른다)');
  t.ok(r.off.l1 === null && r.off.l2 === null && r.off.line1 === 0 && r.off.line2 === 0, '처음에는 지도에 BRG 선도 글자도 없다');
  t.ok(r.on1.l1 && /^BRG1 \d{3}° [\d.]+NM$/.test(r.on1.l1) && r.on1.line1 === 2, `Bearing1 을 NAV1 로 고르면 BRG1 선 · 글자 (${r.on1.l1})`);
  t.ok(r.on1.l2 === null && r.on1.line2 === 0, 'BRG2 는 따로 논다');
  t.ok(r.on2.l2 && /^BRG2 \d{3}° [\d.]+NM$/.test(r.on2.l2) && r.on2.line2 === 2 && r.on2.line1 === 2, `Bearing2 를 FMS 로 고르면 BRG2 도 (${r.on2.l2})`);
  t.ok(r.back.l1 === null && r.back.l2 === null && !r.back.layer1 && !r.back.layer2 && r.back.line1 === 0 && r.back.line2 === 0 && !r.needles,
    'OFF 면 니들 · 선 · 글자가 함께 사라진다(글자 레이어까지 걷어낸다)');
}
