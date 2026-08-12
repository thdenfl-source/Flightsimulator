// 차트 뷰어 배치 — PDF 오버레이는 CDU 화면(354×567 규격) 안에 머물러야 한다.
// 종전에는 #cdu-wrap 에 inset:0 으로 얹어 패널 전체를 덮었다. 폰에서는 CDU 가
// 패널을 거의 채워 티가 안 났지만, 삼성 덱스처럼 창이 넓으면 좌우 레터박스가
// 커서 차트를 열자마자 화면을 통째로 차지한 것처럼 보였다.
export const name = '차트 뷰어 배치';

// pdf.js 없이 배치만 검증한다 — 실제 오버레이와 같은 표식(data-host="cdu")을 단다.
const mkOverlay = () => {
  const ov = document.createElement('div');
  ov.id = 'pdfViewerOverlay';
  ov.dataset.host = 'cdu';
  ov.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:60;background:#1a1a1a;';
  document.getElementById('cdu-wrap').appendChild(ov);
  fitPdfOverlayToCdu();
  const o = ov.getBoundingClientRect();
  const s = document.getElementById('cdu-scaler').getBoundingClientRect();
  const w = document.getElementById('cdu-wrap').getBoundingClientRect();
  ov.remove();
  return {
    ov: [o.x, o.y, o.width, o.height].map(Math.round),
    scaler: [s.x, s.y, s.width, s.height].map(Math.round),
    wrap: [w.x, w.y, w.width, w.height].map(Math.round),
  };
};

export async function run(page, t) {
  // CDU 를 좌측 패널에 띄운다
  await page.evaluate(() => { try { selectPanel('left', 'cdu'); } catch (e) { setPage(2); } });
  await page.waitForTimeout(300);

  // 넓은 창(덱스) · 좁은 창(폰) 양쪽에서 확인
  for (const [W, H, label] of [[1920, 1080, '넓은 창(덱스)'], [820, 1180, '좁은 창(폰)']]) {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(350);
    const r = await page.evaluate(mkOverlay);
    const near = (a, b) => Math.abs(a - b) <= 2;

    t.ok(r.ov.every((v, i) => near(v, r.scaler[i])),
      `${label} — 오버레이가 CDU 화면과 같은 자리 (${r.ov.join(',')} vs ${r.scaler.join(',')})`);
    t.ok(r.ov[2] <= r.wrap[2] + 2 && r.ov[3] <= r.wrap[3] + 2,
      `${label} — 패널을 넘지 않음 (오버레이 ${r.ov[2]}×${r.ov[3]} ≤ 패널 ${r.wrap[2]}×${r.wrap[3]})`);
    // 354:567 비율 유지 — 넓은 창에서 가로로 늘어나면 안 된다
    const ratio = r.ov[2] / r.ov[3];
    t.ok(Math.abs(ratio - 354 / 567) < 0.02,
      `${label} — CDU 규격 비율 유지 (${ratio.toFixed(3)} ≈ ${(354 / 567).toFixed(3)})`);
  }

  // 창이 바뀌면 따라 움직이는가(분할선 드래그·전체화면 전환·덱스 창 크기 변경)
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(350);
  const moved = await page.evaluate(mkOverlay);
  t.ok(moved.ov.every((v, i) => Math.abs(v - moved.scaler[i]) <= 2),
    `창 크기가 바뀌어도 CDU 화면을 따라감 (${moved.ov.join(',')})`);
}
