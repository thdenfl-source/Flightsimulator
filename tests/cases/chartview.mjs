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
  await runSwScope(page, t);
  await runDiscover(page, t);
  await runRelay(page, t);
  await runFetchFromEaip(page, t);
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
  page.evaluate(() => chartRepoImport()).catch(() => {});   // 기다리지 않는다 — 페이지가 닫힐 때 거부되지 않게 잡아 둔다
  await page.waitForSelector('.ui-dlg', { timeout: 8000 });
  let msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('charts/index.json'), `목록을 못 읽으면 어디를 볼지 알려준다 (${msg.split('\n')[0]})`);
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  // ── 정상: PDF 낱장 한 건 ──
  await install([{ file: 'RKTU/(1) AD CHART.pdf', icao: 'RKTU', num: '1', name: 'AD CHART', cat: 'AD' }]);
  page.evaluate(() => chartRepoImport()).catch(() => {});   // 기다리지 않는다 — 페이지가 닫힐 때 거부되지 않게 잡아 둔다
  await page.waitForSelector('.ui-dlg', { timeout: 8000 });
  msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('1건') && msg.includes('AD CHART'), '가져올 목록을 먼저 보여준다');
  await page.locator('.ui-dlg-ok').click();               // 가져오기

  // 결과 알림이 닫혀야 저장 절차가 끝난다(알림을 기다리도록 바뀌었다) —
  // 먼저 닫고 나서 확인해야 서로 기다리다 멈추지 않는다.
  await page.waitForSelector('.ui-dlg', { timeout: 30000 });
  await page.locator('.ui-dlg-ok').click();
  await page.waitForFunction(() => [...localPdfKeys].includes('RKTU|1'), null, { timeout: 20000 });
  t.ok(true, '저장소의 차트가 이 기기(IndexedDB)에 저장됨');
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

  const PDF = '%PDF-1.4 x';
  const HTML = '<!doctype html><html>앱 페이지</html>';
  const cases = [
    ['허용',          { noCors: true,  cors: true, body: PDF,  type: 'application/pdf' }, '✅ 직접 받아올 수 있습니다'],
    ['CORS 차단',     { noCors: true,  cors: false, body: '',  type: '' },                '❌ 받아올 수 없습니다'],
    ['사이트 불통',    { noCors: false, cors: false, body: '', type: '' },                 '판정 불가'],
    // 종전 서비스워커가 만들던 가짜 성공 — HTTP 200 인데 내용은 우리 index.html
    ['가짜 성공(HTML)', { noCors: true, cors: true, body: HTML, type: 'text/html' },       '❌ 받아올 수 없습니다'],
  ];
  for (const [label, sim, expect] of cases) {
    await page.evaluate((s) => {
      window.__origFetch = window.__origFetch || window.fetch;
      window.fetch = (u, o) => {
        if (!String(u).includes('aim.koca.go.kr')) return window.__origFetch(u, o);
        const noCors = o && o.mode === 'no-cors';
        const ok = noCors ? s.noCors : s.cors;
        // 실제 opaque 응답(status 0)은 만들 수 없어 200 으로 대신한다.
        return ok ? Promise.resolve(new Response(s.body, { status: 200, headers: s.type ? { 'content-type': s.type } : {} }))
                  : Promise.reject(new TypeError('Failed to fetch'));
      };
    }, sim);

    page.evaluate(() => chartConnCheck()).catch(() => {});
    await page.waitForSelector('.ui-dlg', { timeout: 15000 });
    const msg = await page.locator('.ui-dlg-msg').textContent();
    t.ok(msg.includes(expect), `${label} → "${expect}" 로 판정`);
    if (label.startsWith('가짜')) {
      t.ok(msg.includes('HTML 이 왔습니다'),
        `가짜 성공의 이유를 짚어 준다 (${(msg.match(/PDF 가 아니라[^\n]*/) || [''])[0]})`);
    }
    await page.locator('.ui-dlg-ok').click();
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => { if (window.__origFetch) window.fetch = window.__origFetch; });
}

// 서비스워커는 남의 출처를 건드리면 안 된다.
// 종전에는 모든 GET 을 가로챘고, 그 탓에 eAIP 차트 요청이 두 가지로 망가졌다.
//   · 교차 출처 응답이 앱 캐시에 들어가, no-cors 로 받은 opaque 응답이 뒤이은
//     cors 요청에 그대로 나갔다 ("Response served by service worker is opaque")
//   · 실패하면 index.html 을 돌려줘, 차트 PDF 자리에 앱 HTML 이 들어갔다
// 테스트는 file:// 에서 돌아 서비스워커가 없다. 실제 검증은 출처 두 곳(앱 :8801,
// CORS 를 허용하는 eAIP 대역 :8802)을 띄워 따로 했고 — 가드가 없으면 앱 캐시에
// 남의 URL 이 쌓이는 것을 확인했다 — 여기서는 그 가드가 사라지지 않게 지킨다.
export async function runSwScope(page, t) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  const guard = /new URL\(url\)\.origin\s*!==\s*self\.location\.origin\)\s*return/.test(sw);
  t.ok(guard, '서비스워커가 교차 출처 요청에서 손을 뗀다');

  // 가드는 앱 파일 처리(respondWith)보다 먼저 와야 의미가 있다
  const iGuard = sw.search(/new URL\(url\)\.origin/);
  const iResp = sw.indexOf('e.respondWith(\n    fetch(e.request)');
  const iApp = iResp >= 0 ? iResp : sw.lastIndexOf('e.respondWith(');
  t.ok(iGuard > 0 && iGuard < iApp, `가드가 앱 파일 처리보다 앞에 있다 (${iGuard} < ${iApp})`);

  // 타일·위성처럼 일부러 캐시하는 교차 출처는 가드보다 위에 있어야 계속 동작한다
  const iTile = sw.indexOf('tile.openstreetmap.org');
  t.ok(iTile > 0 && iTile < iGuard, `지도 타일 캐시는 가드보다 위라 그대로 동작 (${iTile} < ${iGuard})`);
}

// 차트 목록 탐색 — eAIP 어디에 공항별 전체 차트 목록이 있는지 찾아낸다.
// CORS 는 뚫렸지만(연결 점검 결과 HTTP 200) 앱 내장 목록은 22개 공항에 28장뿐이라
// "무엇을 받을지" 를 모른다. 후보 주소를 두드려 PDF 링크를 담은 곳을 골라낸다.
export async function runDiscover(page, t) {
  await page.evaluate(() => { switchMode('CHARTS'); });
  await page.waitForTimeout(250);
  t.eq(await page.locator('[data-act="chartDiscover"]').count(), 1, 'CHART 화면에 목록 탐색 줄이 있다');

  const AD2 = '<html><a href="../../pdf/AD/RKSI/(2-1)%20AD%20CHART.pdf">a</a>'
            + '<a href="../../pdf/AD/RKSI/(2-18)%20OBSTACLE.pdf">b</a>'
            + '<a href="../../pdf/AD/RKSI/(2-51)%20INSTR%20APCH.pdf">c</a></html>';

  const stub = (hitUrlPart) => page.evaluate(({ part, body }) => {
    window.__origFetch = window.__origFetch || window.fetch;
    window.fetch = (u, o) => {
      const s = String(u);
      if (!s.includes('aim.koca.go.kr')) return window.__origFetch(u, o);
      return Promise.resolve(part && s.includes(part)
        ? new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
        : new Response('not found', { status: 404 }));
    };
  }, { part: hitUrlPart, body: AD2 });

  // ── 목록을 찾은 경우 ──
  await stub('KR-AD-2.RKSI-en-GB.html');
  page.evaluate(() => chartDiscover()).catch(() => {});
  await page.waitForSelector('.ui-dlg', { timeout: 25000 });
  let msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('✅ 차트 목록을 찾았습니다'), '차트 PDF 링크를 담은 곳을 찾아낸다');
  t.ok(msg.includes('PDF 3개가 실려 있습니다'), `찾은 PDF 수를 센다 (${(msg.match(/PDF \d+개가/) || [''])[0]})`);
  t.ok(msg.includes('AD CHART.pdf'), '파일명을 예시로 보여준다(주소 디코딩 포함)');
  t.ok(msg.includes('HTTP 404'), '응답 없는 후보도 함께 적어 다음 후보를 잡게 한다');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  // ── 아무 데서도 못 찾은 경우 ──
  await stub(null);
  page.evaluate(() => chartDiscover()).catch(() => {});
  await page.waitForSelector('.ui-dlg', { timeout: 25000 });
  msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('❌ 차트 목록을 담은 곳을 찾지 못했습니다'), '못 찾으면 못 찾았다고 한다');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  await page.evaluate(() => { if (window.__origFetch) window.fetch = window.__origFetch; });
}

// 차트 중계 — eAIP 가 CORS 를 막으므로(연결 점검으로 확인) 사이에 중계를 둘 수 있다.
// 비워 두면 아무 일도 하지 않고, 넣으면 모든 차트 요청이 그리로 돈다.
export async function runRelay(page, t) {
  await page.evaluate(() => { localStorage.removeItem('chartRelayUrl'); switchMode('CHARTS'); });
  await page.waitForTimeout(250);
  t.eq(await page.locator('[data-act="chartRelaySet"]').count(), 1, 'CHART 화면에 중계 설정이 있다');
  t.ok((await page.locator('[data-act="chartRelaySet"]').textContent()).includes('끔'),
    '기본은 중계를 쓰지 않는다');

  // 비어 있으면 주소를 건드리지 않는다
  t.eq(await page.evaluate(() => _viaRelay('https://aim.koca.go.kr/a.pdf')),
    'https://aim.koca.go.kr/a.pdf', '중계가 없으면 원래 주소 그대로');

  // https 가 아니면 거부한다(중계는 앱과 같은 https 여야 브라우저가 허용한다)
  page.evaluate(() => chartRelaySet()).catch(() => {});
  await page.waitForSelector('.ui-dlg-in', { timeout: 8000 });
  await page.fill('.ui-dlg-in', 'http://relay.example/');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(300);
  t.ok((await page.locator('.ui-dlg-msg').textContent()).includes('https:// 로 시작'),
    'http:// 중계는 거부한다');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);
  t.eq(await page.evaluate(() => chartRelayUrl()), '', '거부된 값은 저장되지 않는다');

  // 넣으면 모든 차트 요청이 중계를 거친다
  await page.evaluate(() => { localStorage.setItem('chartRelayUrl', 'https://relay.example/'); renderCduContent(); });
  await page.waitForTimeout(250);
  t.eq(await page.evaluate(() => _viaRelay('https://aim.koca.go.kr/a b.pdf')),
    'https://relay.example/?u=https%3A%2F%2Faim.koca.go.kr%2Fa%20b.pdf',
    '중계 주소로 감싸고 원본 주소를 인코딩한다');
  t.ok((await page.locator('[data-act="chartRelaySet"]').textContent()).includes('켬'),
    '중계를 쓰는 중임을 화면에 표시한다');

  // opaque 응답(no-cors 성공)을 실패로 읽지 않는가 — 이걸 뒤집으면
  // "차단"과 "사이트 불통"이 거꾸로 판정된다
  await page.evaluate(() => {
    window.__origFetch = window.__origFetch || window.fetch;
    window.fetch = (u, o) => {
      if (!String(u).includes('relay.example')) return window.__origFetch(u, o);
      // 실제 opaque 는 만들 수 없다. no-cors 는 ok=false·status=0 로 오는데
      // 그것을 성공으로 읽어야 한다 — Response.error() 대신 거부로 흉내낼 수 없으므로
      // cors 만 실패시켜 "닿기는 하는데 못 받는" 상황을 만든다.
      return (o && o.mode === 'no-cors')
        ? Promise.resolve(new Response('', { status: 200 }))
        : Promise.reject(new TypeError('Failed to fetch'));
    };
  });
  page.evaluate(() => chartConnCheck()).catch(() => {});
  await page.waitForSelector('.ui-dlg', { timeout: 15000 });
  const msg = await page.locator('.ui-dlg-msg').textContent();
  t.ok(msg.includes('❌ 받아올 수 없습니다'), '중계를 거쳐도 막히면 차단으로 판정');
  t.ok(msg.includes('중계를 거쳤는데도'), '중계를 쓰는 중이면 중계를 의심하라고 안내');
  t.ok(msg.includes('중계: https://relay.example/'), '어떤 중계를 썼는지 결과에 남긴다');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    if (window.__origFetch) window.fetch = window.__origFetch;
    localStorage.removeItem('chartRelayUrl');
  });
}

// 공식 사이트에서 받기 — 목록 탐색으로 알아낸 구조를 실제로 쓴다.
// 디렉터리 목록(/pdf/AD/RKSI/)은 403 이고, 공항별 AD 2 문서에 차트 PDF 링크가
// 다 들어 있다. 그 문서가 곧 목록이므로 앱 내장 목록(22개 공항 28장)의 한계가
// 사라진다 — AIRAC 이 바뀌면 그때의 목록을 그대로 따라간다.
export async function runFetchFromEaip(page, t) {
  const AD2 = (icao, names) => '<html>' + names.map(n =>
    `<a href="../../pdf/AD/${icao}/${encodeURIComponent(n)}.pdf">${n}</a>`).join('')
    + '<a href="../../pdf/GEN/notes.pdf">GEN</a></html>';   // 차트 아닌 첨부 — 걸러져야 한다

  await page.evaluate((pdfB64) => {
    const bin = Uint8Array.from(atob(pdfB64), c => c.charCodeAt(0));
    window.__origFetch = window.__origFetch || window.fetch;
    window.__reqs = [];
    window.fetch = (u, o) => {
      const s = String(u);
      if (!s.includes('aim.koca.go.kr')) return window.__origFetch(u, o);
      window.__reqs.push(s);
      // 중계를 거치면 실제 주소가 ?u= 안에 들어간다 — 그걸 풀어서 봐야 한다
      let real = s;
      try { const q = new URL(s).searchParams.get('u'); if (q) real = q; } catch (e) {}
      const doc = real.match(/KR-AD-2\.([A-Z]{4})-en-GB\.html/);
      if (doc) {
        const map = { RKSI: ['(2-1) AD CHART', '(2-51) INSTR APCH CHART'], RKSS: ['(2-5) AD CHART'] };
        const names = map[doc[1]];
        return Promise.resolve(names
          ? new Response(window.__AD2(doc[1], names), { status: 200, headers: { 'content-type': 'text/html' } })
          : new Response('', { status: 404 }));
      }
      if (/\.pdf$/i.test(real.split('?')[0])) {
        return Promise.resolve(new Response(bin, { status: 200, headers: { 'content-type': 'application/pdf' } }));
      }
      return Promise.resolve(new Response('', { status: 403 }));
    };
  }, fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'charts', 'AD', 'RKSI', '(1) TEST CHART.pdf')).toString('base64'));
  await page.evaluate(`window.__AD2 = ${AD2.toString()}`);

  // ① AD 2 문서에서 링크를 뽑는다 — 차트만, 중복 없이
  const links = await page.evaluate(() => _eaipChartLinks('RKSI', '2026-08-05')
    .then(l => l.map(x => x.num + '|' + x.chartName)));
  t.eq(JSON.stringify(links), JSON.stringify(['2-1|AD CHART', '2-51|INSTR APCH CHART']),
    `AD 2 문서에서 차트 링크를 뽑는다 (${links.join(', ')})`);

  // ② 실제로 받아 저장한다
  await page.evaluate(() => {
    localStorage.setItem('savedCharts', '[]');
    localStorage.setItem('chartRelayUrl', 'https://relay.example/');
    window.__reqs = [];   // 중계를 켠 뒤의 요청만 센다
    // 공식 사이트를 배려한 요청 간격·재시도 대기는 검사에서는 뺀다
    EAIP_MIN_GAP_MS = 0; EAIP_RETRY_WAIT_MS = 0;
  });
  page.evaluate(() => chartFetchFromEaip(['RKSI', 'RKSS', 'RKPC'])).catch(() => {});
  await page.waitForSelector('.ui-dlg', { timeout: 15000 });
  const ask = await page.locator('.ui-dlg-msg').textContent();
  t.ok(ask.includes('공항 3곳'), '받기 전에 몇 곳을 받을지 알린다');
  await page.locator('.ui-dlg-ok').click();

  // 결과 알림을 먼저 닫아야 저장 절차가 끝난다
  await page.waitForSelector('.ui-dlg', { timeout: 40000 });
  const done = await page.locator('.ui-dlg-msg').textContent();
  await page.locator('.ui-dlg-ok').click();
  await page.waitForFunction(() => [...localPdfKeys].length >= 3, null, { timeout: 20000 })
    .catch(() => {});
  // 앞선 검사들이 넣어 둔 것이 있으므로 "새로 들어왔는가" 로 본다
  const keys = await page.evaluate(() => [...localPdfKeys].sort());
  const want = ['RKSI|2-1', 'RKSI|2-51', 'RKSS|2-5'];
  const missing = want.filter(k => !keys.includes(k));
  t.eq(missing.length, 0,
    `공항별로 받아 이 기기에 저장한다${missing.length ? ' (빠짐: ' + missing.join(',') + ')' : ' (' + want.join(', ') + ')'}`);
  t.ok(!keys.some(k => k.startsWith('GEN')), '차트가 아닌 첨부(GEN)는 걸러진다');
  // 목록이 없는 공항(RKPC → 404)이 섞여도 나머지는 받는다
  t.ok(!keys.some(k => k.startsWith('RKPC')), '목록이 없는 공항은 건너뛰고 나머지는 받는다');

  // 모든 요청이 중계를 거쳤는가
  const viaRelay = await page.evaluate(() => window.__reqs.every(u => u.startsWith('https://relay.example/')));
  t.ok(viaRelay, '모든 요청이 중계를 거친다');

  // ③ 실패하면 왜 실패했는지 화면에 남는가 — 숫자만 알려 주면 손쓸 방법이 없다.
  //    실제 기기에서 "1개 저장 · 170개 건너뜀" 만 뜨고 이유를 알 수 없었다.
  t.ok(/받지 못해 건너뜀|PDF 저장/.test(done), `받은 결과를 알린다 (${done.split('\n')[0]})`);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    // 이번엔 전부 429 로 밀어낸다 — 사유가 화면에 나오는지 본다
    window.fetch = (u, o) => {
      const s = String(u);
      if (!s.includes('aim.koca.go.kr')) return window.__origFetch(u, o);
      let real = s;
      try { const q = new URL(s).searchParams.get('u'); if (q) real = q; } catch (e) {}
      if (/KR-AD-2\.RKSI-en-GB\.html/.test(real)) {
        return Promise.resolve(new Response(window.__AD2('RKSI', ['(2-1) AD CHART']),
          { status: 200, headers: { 'content-type': 'text/html' } }));
      }
      return Promise.resolve(new Response('', { status: 429 }));
    };
    localStorage.setItem('chartRelayUrl', 'https://relay.example/');
  });
  page.evaluate(() => chartFetchFromEaip(['RKSI'])).catch(() => {});
  await page.waitForSelector('.ui-dlg', { timeout: 15000 });
  await page.locator('.ui-dlg-ok').click();                       // 받기 확인
  await page.waitForSelector('.ui-dlg', { timeout: 30000 });
  const fail = await page.locator('.ui-dlg-msg').textContent();
  t.ok(fail.includes('왜 실패했나'), '실패하면 사유를 함께 보여준다');
  t.ok(fail.includes('HTTP 429'), `사유에 응답 코드가 담긴다 (${(fail.match(/HTTP \d+ — \d+개/) || [''])[0]})`);
  t.ok(fail.includes('요청 속도를 제한'), '429 면 무엇을 해야 하는지 짚어 준다');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  // 중계↔사이트 구간이 끊기는 경우(522) — 실제 기기에서 이걸로 전부 실패했다.
  // 한꺼번에 많이 받아 사이트가 막은 상황이라, 429 와는 할 일이 다르다.
  await page.evaluate(() => {
    const orig = window.fetch;
    window.fetch = (u, o) => {
      const s = String(u);
      if (!s.includes('aim.koca.go.kr')) return window.__origFetch(u, o);
      let real = s;
      try { const q = new URL(s).searchParams.get('u'); if (q) real = q; } catch (e) {}
      if (/KR-AD-2\.RKSI-en-GB\.html/.test(real)) {
        return Promise.resolve(new Response(window.__AD2('RKSI', ['(2-1) AD CHART']),
          { status: 200, headers: { 'content-type': 'text/html' } }));
      }
      return Promise.resolve(new Response('', { status: 522 }));
    };
  });
  page.evaluate(() => chartFetchFromEaip(['RKSI'])).catch(() => {});
  await page.waitForSelector('.ui-dlg', { timeout: 15000 });
  await page.locator('.ui-dlg-ok').click();
  await page.waitForSelector('.ui-dlg', { timeout: 30000 });
  const gw = await page.locator('.ui-dlg-msg').textContent();
  t.ok(gw.includes('HTTP 522'), `522 도 사유에 담긴다 (${(gw.match(/HTTP \d+ — \d+개/) || [''])[0]})`);
  t.ok(gw.includes('중계와 사이트 사이가 끊깁니다'), '522 면 429 와 다른 할 일을 짚어 준다');
  t.ok(gw.includes('[⤓ 받기] 로 받아'), '공항 하나씩 받으라고 안내한다');
  await page.locator('.ui-dlg-ok').click();
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    if (window.__origFetch) window.fetch = window.__origFetch;
    localStorage.removeItem('chartRelayUrl');
  });
}
