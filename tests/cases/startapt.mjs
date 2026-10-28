// 시작 — GPS 는 꺼진 채 · 출발 공항 고르기 · 지도의 흰수리 심볼
//
// 다른 검사는 출발 공항 창을 이미 고른 것으로 두고 연다(lib/env.mjs). 여기서는 새 탭으로
// 처음 여는 것처럼 열어 그 창을 본다.
export const name = '출발 공항·지도 심볼';

const ready = p => p.waitForFunction(
  () => typeof S === 'object' && S !== null && typeof leafMap === 'object', null, { timeout: 20000 });

export async function run(page, t) {
  const url = page.url();
  const browser = page.context().browser();

  // ── 처음 열면: GPS 는 꺼져 있고(기기 위치를 묻지 않는다) 출발 공항을 고르는 창이 뜬다 ──
  const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await tab.addInitScript(() => {
    window.__geoCalls = 0;
    try {
      const g = navigator.geolocation;
      if (g) {
        const wrap = fn => function (...a) { window.__geoCalls++; return fn.apply(g, a); };
        g.getCurrentPosition = wrap(g.getCurrentPosition);
        g.watchPosition = wrap(g.watchPosition);
      }
    } catch (e) { /* 감싸지 못하면 그만 */ }
  });
  await tab.goto(url); await ready(tab);
  await tab.waitForSelector('.start-apt', { timeout: 5000 }).catch(() => {});
  const first = await tab.evaluate(() => ({
    gps: gpsMode, geo: window.__geoCalls, dlg: !!document.querySelector('.start-apt'),
    n: document.querySelectorAll('.start-apt-btn').length, all: AIRPORTS.length,
    icao: [...document.querySelectorAll('.start-apt-btn')].every(b => /^[A-Z]{4}$/.test(b.dataset.icao)),
    lat: S.lat, lon: S.lon }));
  t.eq(first.gps, false, '시작하면 GPS 는 꺼져 있다');
  t.eq(first.geo, 0, '시작할 때 기기 위치(GPS)를 묻지 않는다');
  t.ok(first.dlg && first.n === first.all && first.icao,
    `출발 공항 창이 뜬다 — 지도의 ICAO 공항 ${first.n}곳`);
  t.ok(Math.abs(first.lat - 37.3895) < 1e-6, '고르기 전에는 송도(기본 위치)다');

  // 이름으로 걸러 고른다(Enter = 맨 위). 지형 자료는 검사에서 내려받지 않는다 — 그 공항 땅을 100ft 로 둔다
  await tab.evaluate(() => { _tcElev = () => 100 * 0.3048; S.alt = 500; S.spd = 80; });
  await tab.fill('.start-apt-q', '김포');
  const shown = await tab.evaluate(() =>
    [...document.querySelectorAll('.start-apt-btn')].filter(b => b.style.display !== 'none').map(b => b.dataset.icao));
  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(300);
  const picked = await tab.evaluate(() => {
    const a = AIRPORTS.find(x => x.ident === 'RKSS');
    return { dlg: !!document.querySelector('.start-apt'), d: distance(S.lat, S.lon, a.lat, a.lon),
             alt: S.alt, sel: selAlt, spd: S.spd, gps: gpsMode, flag: sessionStorage.getItem('vfrStartApt') };
  });
  t.eq(JSON.stringify(shown), '["RKSS"]', `ICAO · 이름으로 걸러 찾는다 (김포 → ${shown.join(',')})`);
  t.ok(!picked.dlg && picked.d < 0.01, `고르면 그 공항에서 시작한다 (RKSS 에서 ${picked.d.toFixed(3)}NM)`);
  t.ok(picked.alt === 100 && picked.spd === 0, `지면에 멈춰 선다 (${picked.alt}ft · ${picked.spd}kt)`);
  t.eq(picked.sel, 100, '고도 유지 기준도 그 지면 높이다 — 날아오르려면 ALT ▲');
  t.eq(picked.gps, false, '고른 뒤에도 GPS 는 꺼진 채다');

  await tab.reload(); await ready(tab); await tab.waitForTimeout(800);
  const again = await tab.evaluate(() => !!document.querySelector('.start-apt'));
  t.eq(again, false, '같은 탭에서 새로고침하면 다시 묻지 않는다');
  await tab.close();

  // 건너뛰면 송도 그대로
  const tab2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await tab2.goto(url); await ready(tab2);
  await tab2.waitForSelector('.start-apt', { timeout: 5000 }).catch(() => {});
  await tab2.click('.start-apt-skip').catch(() => {});
  await tab2.waitForTimeout(200);
  const skip = await tab2.evaluate(() => ({ dlg: !!document.querySelector('.start-apt'), lat: S.lat, lon: S.lon }));
  t.ok(!skip.dlg && Math.abs(skip.lat - 37.3895) < 1e-6 && Math.abs(skip.lon - 126.6550) < 1e-6,
    '건너뛰면 송도에서 그대로 시작한다');
  await tab2.close();

  // ── 지도의 내 헬기 = 흰수리 평면도 ──
  const icon = await page.evaluate(() => {
    S.hdg = 75; updateAcOnMap();
    const el = acMarker.getElement(), div = el && el.querySelector('.ac-marker');
    const html = el ? el.innerHTML : '';
    return { has: ['#d9262c', '#f2c21b', '#233f94', '#f4f5f6'].every(c => html.includes(c)),
             rot: div ? div.style.transform : '', w: el ? el.getBoundingClientRect().width : 0 };
  });
  t.ok(icon.has, '지도 심볼이 흰수리 도색이다(흰 동체 · 붉은 덮개 · 노랑 · 파랑 꼬리)');
  t.ok(/rotate\(75deg\)/.test(icon.rot), `기수 방향으로 돌아 있다 (${icon.rot})`);
  t.ok(icon.w >= 36, `전장 20m 를 36px 로 그린다 (${icon.w}px 칸)`);
}
