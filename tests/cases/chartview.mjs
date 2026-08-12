// 차트 뷰어 배치 — 차트를 열어도 앱 화면을 빼앗지 않아야 한다.
// (1) 앱 안 뷰어는 CDU 화면(354×567 규격) 안에 머문다.
// (2) 이 기기에 없는 차트는 말없이 새 탭으로 나가지 않는다 — 앱 UI 가 통째로
//     사라져 "차트를 열었더니 전체화면이 됐다"로 보이던 원인이다.
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

  await runExternal(page, t);
}

export async function runExternal(page, t) {
  // 로컬 PDF 가 없는 차트를 연다 — 종전에는 곧장 window.open 이었다.
  // openChart 는 사용자가 고를 때까지 끝나지 않는다 — 기다리지 말고 띄워만 둔다.
  await page.evaluate(() => {
    window.__opened = [];
    window.__origOpen = window.open;
    window.open = (u) => { window.__opened.push(u); return null; };
    openChart('RKSI', '2-1', 'https://aim.koca.go.kr/eaipPub/x/chart.pdf');
  });
  await page.waitForSelector('.ui-dlg', { timeout: 15000 });
  const opened = await page.evaluate(() => { window.open = window.__origOpen; return window.__opened; });
  t.eq(opened.length, 0, `저장 안 된 차트가 말없이 새 탭을 열지 않음${opened.length ? ' (' + opened + ')' : ''}`);
  const dlg = await page.evaluate(() => {
    const ok = document.querySelector('.ui-dlg-ok');
    return {
      msg: document.querySelector('.ui-dlg-msg').textContent,
      tag: ok.tagName, target: ok.getAttribute('target'), href: ok.getAttribute('href'),
      overlay: !!document.getElementById('pdfViewerOverlay'),
      tabsVisible: !!document.querySelector('.page-tab'),
    };
  });
  t.ok(dlg.msg.includes('저장돼 있지 않습니다'), '무슨 일이 벌어지는지 먼저 알린다');
  // await 뒤의 window.open 은 팝업 차단에 걸린다 — 사용자가 직접 누르는 링크여야 한다
  t.eq(dlg.tag, 'A', '확인 버튼이 실제 링크(<a>)라 팝업 차단에 걸리지 않음');
  t.eq(dlg.target, '_blank', '새 탭으로 열림');
  t.ok(dlg.href && dlg.href.startsWith('https://'), `링크 주소가 그대로 실림 (${dlg.href})`);
  t.ok(dlg.tabsVisible && !dlg.overlay, '고를 때까지 앱 화면은 그대로');

  await page.locator('.ui-dlg-btns button').click();   // 취소
  await page.waitForTimeout(200);
  t.ok(await page.evaluate(() => !document.querySelector('.ui-dlg') && !!document.querySelector('.page-tab')),
    '취소하면 앱에 그대로 머문다');

  // CDU 창을 못 찾아도 document.body 에 뷰포트 전체 오버레이를 얹지 않는다
  // (그 경로가 화면을 통째로 가리던 원인 중 하나였다)
  const noHost = await page.evaluate(async () => {
    const wrap = document.getElementById('cdu-wrap');
    wrap.id = 'cdu-wrap-hidden';
    try {
      await openChart('RKSI', '2-1', '');   // url 없음 → 외부 경로도 안 탄다
      return { overlay: !!document.getElementById('pdfViewerOverlay'),
               bodyChild: [...document.body.children].some(el =>
                 getComputedStyle(el).position === 'fixed' &&
                 el.getBoundingClientRect().width >= innerWidth) };
    } finally { wrap.id = 'cdu-wrap'; }
  });
  t.ok(!noHost.overlay && !noHost.bodyChild,
    'CDU 창이 없으면 화면을 덮는 대신 조용히 물러난다');
}
