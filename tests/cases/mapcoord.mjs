// 지도 좌하단 좌표칸 — ✈ 항공기 / ＋ 십자마크, 그리고 겹침 사다리의 간격.
//
// 종전에는 좌표칸이 하나뿐이라 1인칭 여부에 따라 둘 중 하나로 바뀌었다.
// 지도를 옮겨 어떤 지점의 좌표를 읽는 동안에는 항공기가 어디 있는지 알 수 없었고,
// 1인칭에서는 그 반대였다. 이제 둘 다 늘 자기 것만 보여 준다.
export const name = '지도 좌표칸';

export async function run(page, t) {
  const read = () => page.evaluate(() => {
    const w = document.getElementById('map-wrap').getBoundingClientRect();
    const box = sel => {
      const e = document.querySelector(sel);
      if (!e) return null;
      if (getComputedStyle(e).display === 'none') return 'hidden';
      const r = e.getBoundingClientRect();
      return { bot: Math.round(w.bottom - r.bottom), top: Math.round(w.bottom - r.top),
               txt: (e.textContent || '').trim() };
    };
    return { cross: box('#crosshair-coord'), ac: box('#center-coord'),
             scale: box('.vfr-scale'), visit: box('#counter-wrap') };
  });

  await page.evaluate(async () => {
    if (followMode) toggleFollow();
    if (mapHdgUp) toggleMapOrient();
    S.lat = 37.4602; S.lon = 126.4407;
    leafMap.setView([37.5, 126.5], 12, { animate: false });
    updateAcOnMap(); updateCenterCoord();
    await new Promise(r => setTimeout(r, 120));
  });
  const a = await read();

  // ── 두 칸이 각자 자기 것을 보여 준다 ──
  t.ok(/^✈/.test(a.ac.txt) && /37°27′37″N/.test(a.ac.txt),
    `✈ 칸은 항공기 좌표다 (${a.ac.txt})`);
  t.ok(/^＋/.test(a.cross.txt) && /37°29′59″N/.test(a.cross.txt),
    `＋ 칸은 십자마크(지도 중심) 좌표다 (${a.cross.txt})`);
  t.ok(a.cross.txt !== a.ac.txt, '둘이 서로 다른 지점을 가리킨다');

  // ── 사다리 간격이 고르다 ──
  // 아래에서 위로 ＋좌표 → ✈좌표 → 축척 → Visit.
  const gaps = [a.ac.bot - a.cross.top, a.scale.bot - a.ac.top, a.visit.bot - a.scale.top];
  t.ok(gaps.every(g => g === gaps[0]),
    `칸 사이 간격이 모두 같다 (${gaps.join(' · ')}px — 종전 5·6·11px)`);
  t.ok(a.cross.bot < a.ac.bot && a.ac.bot < a.scale.bot && a.scale.bot < a.visit.bot,
    `아래에서 위로 ＋ → ✈ → 축척 → Visit 순서다 ` +
    `(${a.cross.bot} · ${a.ac.bot} · ${a.scale.bot} · ${a.visit.bot}px)`);
  t.ok(a.visit.top < 200, `사다리가 지도 아래쪽에만 머문다 (맨 위 ${a.visit.top}px)`);

  // ── 1인칭에서는 ＋칸을 감춘다 ──
  // 십자마크를 감추는데 그 좌표만 남으면 무엇을 가리키는지 알 수 없다.
  const foll = await page.evaluate(async () => {
    toggleFollow();
    updateAcOnMap(); updateCenterCoord();
    await new Promise(r => setTimeout(r, 120));
    const ch = document.getElementById('map-crosshair');
    const cc = document.getElementById('crosshair-coord');
    const ac = document.getElementById('center-coord');
    const r = { markerHidden: getComputedStyle(ch).display === 'none',
                coordHidden: getComputedStyle(cc).display === 'none',
                acShown: getComputedStyle(ac).display !== 'none',
                acTxt: ac.textContent.trim() };
    toggleFollow();
    updateAcOnMap(); updateCenterCoord();
    await new Promise(r2 => setTimeout(r2, 120));
    r.backAgain = getComputedStyle(cc).display !== 'none';
    return r;
  });
  t.ok(foll.markerHidden && foll.coordHidden,
    '1인칭에서는 십자마크와 ＋좌표칸이 함께 사라진다');
  t.ok(foll.acShown && /^✈/.test(foll.acTxt),
    `1인칭에서도 ✈ 좌표는 그대로 보인다 (${foll.acTxt})`);
  t.eq(foll.backAgain, true, '1인칭을 끄면 ＋칸이 돌아온다');

  // ── ✈ 칸이 항공기를 따라 움직이는가 ──
  const moved = await page.evaluate(async () => {
    const before = document.getElementById('center-coord').textContent;
    S.lat = 36.0; S.lon = 128.0;
    updateAcOnMap(); updateCenterCoord();
    await new Promise(r => setTimeout(r, 80));
    return { before, after: document.getElementById('center-coord').textContent };
  });
  t.ok(moved.before !== moved.after && /36°00′00″N/.test(moved.after),
    `항공기가 움직이면 ✈ 칸도 따라간다 (${moved.after.trim()})`);
}
