// 차트 뷰어 배치 — 차트는 CDU 패널 영역을 다 쓰되, 밖으로는 넘지 않아야 한다.
// 다른 CDU 화면은 354×567 계기 테두리 안에 그리지만 차트만 예외다(글씨가 작아
// 넓게 볼수록 쓸모가 있다). 다만 상단 탭 줄이나 옆 창까지 덮으면 "차트를
// 열었더니 앱이 사라졌다"가 되므로, 패널 경계는 반드시 지켜야 한다.
// 또 이 기기에 없는 차트는 말없이 새 탭으로 나가지 않는다 — 앱 UI 가 통째로
// 사라져 전체화면으로 바뀐 것처럼 보이던 원인이었다.
export const name = '차트 뷰어 배치';

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';

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
  await runRealPdf(page, t);
  await runChartRepo(page, t);
  await runConnCheck(page, t);
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

// 진짜 PDF 로 끝까지 — 가져오기 → 열기 → 페이지 넘김 → 위치 보정 저장.
// vendor/pdf.js 를 저장소에 들고 있게 되면서 테스트에서도 실제 뷰어를 돌릴 수
// 있게 됐다. 이 화면은 연달아 두 번(위임 누락·전체화면) 깨진 적이 있어
// 손으로 확인하는 대신 여기서 붙잡는다.
export async function runRealPdf(page, t) {
  t.eq(await page.evaluate(() => typeof pdfjsLib), 'object', 'pdf.js 가 오프라인에서 로드됨');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => { try { selectPanel('left', 'cdu'); } catch (e) { setPage(2); } });
  await page.waitForTimeout(300);
  await page.evaluate(() => switchMode('CHARTS'));
  await page.waitForTimeout(300);

  // 폴더 가져오기 — 실제 사용자 경로 그대로
  await page.evaluate(() => triggerFolderImport());
  await page.waitForTimeout(200);
  await page.locator('input[type=file]').last()
    .setInputFiles(path.join(ROOT, 'tests', 'fixtures', 'charts', 'AD'));
  await page.waitForSelector('.ui-dlg', { timeout: 15000 });
  const msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(/PDF 저장: 1개/.test(msg), `PDF 1개가 가져와짐 (${msg.split('\n')[0]})`);
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(300);

  // 열기 — 이번엔 로컬에 있으므로 앱 안 뷰어로 열려야 한다(새 탭 아님)
  await page.evaluate(async () => {
    const c = loadSavedCharts().find(x => x.icao === 'RKSI');
    await openChart(c.icao, c.chartNum, c.url);
  });
  await page.waitForSelector('#pdfViewerOverlay', { timeout: 15000 });
  await page.waitForFunction(() => !!document.querySelector('#pdfViewArea canvas'), null, { timeout: 15000 });
  t.eq(await page.evaluate(() => _pdfDoc && _pdfDoc.numPages), 3, '3페이지 PDF 가 열림');
  t.eq(await page.evaluate(() => _pdfCurPage), 1, '첫 페이지부터 표시');

  // ▶ 페이지 넘김 — 위임 경계 때문에 통째로 죽었던 자리
  await page.locator('[data-act="_pdfNext"]').click();
  await page.waitForFunction(() => _pdfCurPage === 2, null, { timeout: 8000 }).catch(() => {});
  t.eq(await page.evaluate(() => _pdfCurPage), 2, '▶ 로 다음 페이지');
  await page.locator('[data-act="_pdfPrev"]').click();
  await page.waitForFunction(() => _pdfCurPage === 1, null, { timeout: 8000 }).catch(() => {});
  t.eq(await page.evaluate(() => _pdfCurPage), 1, '◀ 로 이전 페이지');

  // 📍 위치 보정 — 세 점을 찍고 좌표를 직접 넣어 저장까지
  await page.locator('[data-act="_pdfToggleCalibration"]').click();
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => _pdfCalActive), '📍 로 보정 모드 진입');

  const area = await page.locator('#pdfViewArea').boundingBox();
  const pts = [[0.3, 0.3, '37.4631', '126.4407'], [0.7, 0.35, '37.4631', '126.6407'],
               [0.5, 0.72, '37.3131', '126.5407']];
  for (const [rx, ry, la, lo] of pts) {
    await page.mouse.click(area.x + area.width * rx, area.y + area.height * ry);
    await page.waitForSelector('#pdfFixManual', { timeout: 8000 });
    await page.locator('#pdfFixManual').click();
    for (const v of [la, lo]) {
      await page.waitForSelector('.ui-dlg-in', { timeout: 8000 });
      await page.fill('.ui-dlg-in', v);
      await page.locator('.ui-dlg-ok').click();
      await page.waitForTimeout(150);
    }
  }
  t.eq(await page.evaluate(() => _pdfCalPts.length), 3, '보정점 3개가 찍힘');

  await page.locator('#pdfCalDoneBtn').click();
  await page.waitForSelector('.ui-dlg', { timeout: 8000 });
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(400);
  t.eq(await page.evaluate(() => _pdfCalibration && _pdfCalibration.pts.length), 3, '보정이 저장됨');
  t.ok(await page.evaluate(() => !!document.getElementById('pdfAcMarker')), '차트에 현재 위치 표식이 뜸');

  // 닫으면 목록으로 — 앱은 그대로
  await page.locator('[data-act="closePdfViewer"]').click();
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !document.getElementById('pdfViewerOverlay') && !!document.querySelector('.page-tab')),
    '닫으면 목록으로 돌아오고 앱은 그대로');
}

// 저장소에서 가져오기 — charts/index.json 에 올려 둔 차트를 이 기기로 내려받는다.
// 차트는 IndexedDB 에 들어가고 그건 기기·브라우저마다 따로라, 기기를 바꿀 때마다
// 원본 ZIP 을 다시 넣어야 했다. 테스트는 file:// 에서 도니 fetch 가 막힌다 —
// charts/ 요청만 가로채 실제 파일 내용을 돌려주고 나머지 로직을 그대로 검사한다.
export async function runChartRepo(page, t) {
  const pdf = fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'charts', 'AD', 'RKSI', '(1) TEST CHART.pdf')).toString('base64');

  const install = async (index) => page.evaluate(({ idx, b64 }) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    window.__origFetch = window.__origFetch || window.fetch;
    window.fetch = (u, o) => {
      const s = String(u);
      if (s.includes('charts/index.json')) {
        return idx === null
          ? Promise.resolve(new Response('', { status: 404 }))
          : Promise.resolve(new Response(JSON.stringify(idx), { status: 200 }));
      }
      if (s.includes('charts/')) return Promise.resolve(new Response(bin, { status: 200 }));
      return window.__origFetch(u, o);
    };
  }, { idx: index, b64: pdf });

  await page.evaluate(() => { switchMode('CHARTS'); });
  await page.waitForTimeout(300);
  t.eq(await page.locator('[data-act="chartRepoImport"]').count(), 1, 'CHART 화면에 ☁ 저장소 버튼이 있다');

  // ── 목록이 없을 때: 무엇을 해야 하는지 알려준다 ──
  await install(null);
  page.evaluate(() => chartRepoImport());
  await page.waitForSelector('.ui-dlg', { timeout: 8000 });
  let msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('charts/index.json'), `목록을 못 읽으면 어디를 볼지 알려준다 (${msg.split('\n')[0]})`);
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  // ── 정상: PDF 낱장 한 건 ──
  await install([{ file: 'RKTU/(1) AD CHART.pdf', icao: 'RKTU', num: '1', name: 'AD CHART', cat: 'AD' }]);
  page.evaluate(() => chartRepoImport());
  await page.waitForSelector('.ui-dlg', { timeout: 8000 });
  msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('1건') && msg.includes('AD CHART'), '가져올 목록을 먼저 보여준다');
  await page.locator('.ui-dlg-ok').click();               // 가져오기

  await page.waitForFunction(() => [...localPdfKeys].includes('RKTU|1'), null, { timeout: 20000 });
  t.ok(true, '저장소의 차트가 이 기기(IndexedDB)에 저장됨');
  await page.locator('.ui-dlg-ok').click().catch(() => {});   // 결과 알림 닫기
  await page.waitForTimeout(300);

  // 목록에 로컬로 잡히고, 앱 안에서 열린다
  await page.evaluate(async () => {
    const c = loadSavedCharts().find(x => x.icao === 'RKTU');
    await openChart(c.icao, c.chartNum, c.url);
  });
  await page.waitForSelector('#pdfViewerOverlay', { timeout: 15000 });
  t.eq(await page.evaluate(() => _pdfDoc && _pdfDoc.numPages), 3,
    '받아온 차트가 새 탭이 아니라 앱 안에서 열린다');
  await page.locator('[data-act="closePdfViewer"]').click();
  await page.waitForTimeout(200);

  await page.evaluate(() => { if (window.__origFetch) window.fetch = window.__origFetch; });
}

// eAIP 직접 연결 점검 — 판정표가 맞는가.
// fetch 실패만으로는 "망이 안 됨"과 "CORS 차단"을 가릴 수 없어 두 번 물어본다.
// 실제 브라우저에서 확인한 전제: CORS 차단이면 mode:'no-cors' 는 opaque 로 성공하고
// mode:'cors' 만 던진다. 사이트가 아예 안 닿으면 둘 다 던진다.
// 여기서는 그 전제(브라우저 몫)가 아니라 우리 판정(앱 몫)을 검사한다.
export async function runConnCheck(page, t) {
  await page.evaluate(() => { switchMode('CHARTS'); });
  await page.waitForTimeout(250);
  t.eq(await page.locator('[data-act="chartConnCheck"]').count(), 1, 'CHART 화면에 연결 점검 줄이 있다');

  const cases = [
    ['허용',      { noCors: true,  cors: true  }, '✅ 직접 받아올 수 있습니다'],
    ['CORS 차단', { noCors: true,  cors: false }, '❌ 차단되어 있습니다'],
    ['사이트 불통', { noCors: false, cors: false }, '판정 불가'],
  ];
  for (const [label, sim, expect] of cases) {
    await page.evaluate((s) => {
      window.__origFetch = window.__origFetch || window.fetch;
      window.fetch = (u, o) => {
        if (!String(u).includes('aim.koca.go.kr')) return window.__origFetch(u, o);
        const noCors = o && o.mode === 'no-cors';
        const ok = noCors ? s.noCors : s.cors;
        // 실제 opaque 응답(status 0)은 만들 수 없어 200 으로 대신한다.
        // 판정이 보는 것은 성공/실패뿐이라 결과는 같다.
        return ok ? Promise.resolve(new Response('', { status: 200 }))
                  : Promise.reject(new TypeError('Failed to fetch'));
      };
    }, sim);

    page.evaluate(() => chartConnCheck()).catch(() => {});
    await page.waitForSelector('.ui-dlg', { timeout: 15000 });
    const msg = await page.locator('.ui-dlg-msg').textContent();
    t.ok(msg.includes(expect), `${label} → "${expect}" 로 판정 (${msg.split('\n')[2] || ''})`);
    await page.locator('.ui-dlg-ok').click();
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => { if (window.__origFetch) window.fetch = window.__origFetch; });
}
