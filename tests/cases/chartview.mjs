// 차트 뷰어 배치 — 차트는 CDU 패널 영역을 다 쓰되, 밖으로는 넘지 않아야 한다.
// 다른 CDU 화면은 354×567 계기 테두리 안에 그리지만 차트만 예외다(글씨가 작아
// 넓게 볼수록 쓸모가 있다). 다만 상단 탭 줄이나 옆 창까지 덮으면 "차트를
// 열었더니 앱이 사라졌다"가 되므로, 패널 경계는 반드시 지켜야 한다.
// 또 이 기기에 없는 차트는 말없이 새 탭으로 나가지 않는다 — 앱 UI 가 통째로
// 사라져 전체화면으로 바뀐 것처럼 보이던 원인이었다.
export const name = '차트 뷰어 배치';

// pdf.js 없이 배치만 검증한다 — 실제 오버레이와 같은 스타일로 얹는다.
const mkOverlay = () => {
  const ov = document.createElement('div');
  ov.id = 'pdfViewerOverlay';
  ov.dataset.host = 'cdu';
  ov.style.cssText = 'position:absolute;inset:0;z-index:60;background:#1a1a1a;';
  document.getElementById('cdu-wrap').appendChild(ov);
  const o = ov.getBoundingClientRect();
  const w = document.getElementById('cdu-wrap').getBoundingClientRect();
  const app = document.getElementById('app').getBoundingClientRect();
  const tabs = document.querySelector('.page-tab').getBoundingClientRect();
  ov.remove();
  const box = r => [r.x, r.y, r.width, r.height].map(Math.round);
  return { ov: box(o), wrap: box(w), app: box(app), tabs: box(tabs) };
};

export async function run(page, t) {
  // CDU 를 좌측 패널에 띄운다
  await page.evaluate(() => { try { selectPanel('left', 'cdu'); } catch (e) { setPage(2); } });
  await page.waitForTimeout(300);

  // 넓은 창(태블릿·덱스) · 좁은 창(폰) 양쪽에서 확인
  for (const [W, H, label] of [[1920, 1080, '넓은 창(태블릿)'], [820, 1180, '좁은 창(폰)']]) {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(350);
    const r = await page.evaluate(mkOverlay);
    const near = (a, b) => Math.abs(a - b) <= 2;

    // 차트는 패널을 꽉 쓴다(계기 테두리에 갇히지 않는다)
    t.ok(r.ov.every((v, i) => near(v, r.wrap[i])),
      `${label} — 차트가 CDU 패널을 꽉 씀 (${r.ov.join(',')} = 패널 ${r.wrap.join(',')})`);

    // 그러나 패널 밖으로는 못 나간다 — 상단 탭 줄과 겹치지 않아야 한다
    t.ok(r.ov[1] >= r.tabs[1] + r.tabs[3] - 2,
      `${label} — 상단 탭 줄을 덮지 않음 (차트 위끝 ${r.ov[1]} ≥ 탭 아래끝 ${r.tabs[1] + r.tabs[3]})`);
    // 좁은 창에서는 패널이 곧 화면 폭이라 폭은 같을 수 있다. 지켜야 할 것은
    // "패널 밖으로 안 나간다" — 세로로 앱 전체를 덮지 않는지 본다.
    t.ok(r.ov[3] < r.app[3] - 2,
      `${label} — 앱 세로 전체를 덮지 않음 (차트 ${r.ov[3]}px < 앱 ${r.app[3]}px)`);
  }

  // 창이 바뀌면 따라 움직이는가(분할선 드래그·전체화면 전환·창 크기 변경)
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(350);
  const moved = await page.evaluate(mkOverlay);
  t.ok(moved.ov.every((v, i) => Math.abs(v - moved.wrap[i]) <= 2),
    `창 크기가 바뀌어도 패널에 딱 맞음 (${moved.ov.join(',')})`);

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
