// 3D 지도에서의 1인칭(추종)과 N↑/HDG↑.
//
// 세 가지가 어긋나 있었다.
//   ① 카메라 조작을 _ml3d.loaded() 뒤로 미뤘다. 그건 "타일까지 전부 준비됨"
//      이라 비행 중 새 타일을 받는 동안 계속 false 가 된다 — 그 사이 추종이
//      멈춘다. 네트워크가 느릴수록 "3D 에서 1인칭이 안 된다" 가 된다.
//   ② N↑/HDG↑ 버튼이 3D 카메라에 닿지 않았다. 추종 중에는 N↑ 를 골라 놔도
//      늘 기수 위로 돌았고, 추종을 끄면 기수가 바뀌어도 아무 일도 없었다.
// 카메라 상태는 눈으로 보기 어려우니 각도·중심 숫자로 잡는다.
export const name = '3D 지도 카메라';
import zlib from 'node:zlib';

// 작은 PNG — 위성·지형 타일 흉내. fn(x, y) → [r, g, b]
export function pngOf(w, h, fn) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(fn(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
                        chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const solidPng = rgb => pngOf(4, 4, () => rgb);

const T = 37.4602, G = 126.4407;

export async function run(page, t) {
  // 3D 를 켜고, 카메라를 만질 수 있게 되기까지 기다린다
  const open = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    S.lat = 37.4602; S.lon = 126.4407; S.hdg = 40; S.alt = 2000;
    if (mapHdgUp) toggleMapOrient();
    if (followMode) toggleFollow();
    if (!_view3dOn) toggle3dMap();
    let n = 0;
    while (!_ml3dReady && n < 40) { await wait(50); n++; }
    return { on: _view3dOn, ready: _ml3dReady, waitedMs: n * 50,
             tilesDone: _ml3d ? _ml3d.loaded() : null,
             bearing: _ml3d ? Math.round(_ml3d.getBearing()) : null };
  });
  if (!open.on || !open.ready) { t.ok(false, `3D 지도를 열지 못했다 (${JSON.stringify(open)})`); return; }
  t.ok(open.waitedMs === 0,
    `타일을 기다리지 않고 곧바로 카메라를 잡는다 (대기 ${open.waitedMs}ms · 타일완료 ${open.tilesDone})`);

  const cam = () => page.evaluate(() => ({
    b: Math.round(normA(_ml3d.getBearing())),
    lat: +_ml3d.getCenter().lat.toFixed(3), lon: +_ml3d.getCenter().lng.toFixed(3),
    zoom: +_ml3d.getZoom().toFixed(2), pitch: Math.round(_ml3d.getPitch()),
  }));
  const step = fn => page.evaluate(async f => {
    // eslint-disable-next-line no-new-func
    new Function(f)();
    updateAcOnMap();
    await new Promise(r => setTimeout(r, 150));
  }, fn);

  // ── N↑ + 1인칭 ── 항공기를 따라가되 북쪽 위를 지킨다
  await step('if (!followMode) toggleFollow();');
  const fN = await cam();
  t.eq(fN.b, 0, `N↑ 에서는 추종 중에도 북쪽 위다 (방위 ${fN.b}°)`);
  t.ok(Math.abs(fN.lon - G) < 0.01 && fN.lat > T,
    `항공기를 중심에 놓고 진행 방향(북)을 더 보여 준다 (${fN.lat}, ${fN.lon})`);
  t.ok(fN.pitch > 0 && fN.zoom > 0, `고도에 맞춘 줌·틸트가 걸린다 (zoom ${fN.zoom} · pitch ${fN.pitch}°)`);

  // ── HDG↑ + 1인칭 ── 기수 위로 돈다
  await step('if (!mapHdgUp) toggleMapOrient();');
  const fH = await cam();
  t.eq(fH.b, 40, `HDG↑ 를 누르면 3D 도 기수 위로 돈다 (방위 ${fH.b}° · 기수 40°)`);
  t.ok(fH.lat !== fN.lat || fH.lon !== fN.lon,
    '시야도 기수 방향으로 옮겨간다');

  // ── 1인칭을 꺼도 HDG↑ 는 살아 있다 ──
  // 2D 는 그렇게 동작한다. 3D 만 아무 반응이 없었다.
  const off = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (followMode) toggleFollow();
    await wait(100);
    const before = { lat: _ml3d.getCenter().lat, lon: _ml3d.getCenter().lng };
    S.hdg = 200; updateAcOnMap();
    await wait(150);
    return { b: Math.round(normA(_ml3d.getBearing())),
             moved: Math.hypot(_ml3d.getCenter().lat - before.lat,
                               _ml3d.getCenter().lng - before.lon) };
  });
  t.eq(off.b, 200, `1인칭을 꺼도 기수를 따라 돈다 (방위 ${off.b}° · 기수 200°)`);
  t.ok(off.moved < 1e-6,
    '중심은 건드리지 않는다 — 손으로 옮겨 둔 자리를 지킨다');

  // ── N↑ 로 되돌리면 북쪽으로 ── (그 순간 한 번만, 이후 손 조작은 그대로)
  const back = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleMapOrient();                       // N↑
    for (let i = 0; i < 40 && Math.abs(normAS(_ml3d.getBearing())) > 0.5; i++) await wait(50);
    // normA 는 0 을 360 으로 돌려준다. 북쪽에 '거의' 닿으면(-0.3° 등) 359.7 → 360 이
    // 되어 0 과 어긋난다 — 북쪽인지만 보면 되므로 360 으로 나눈 나머지로 읽는다.
    const north = Math.round(normA(_ml3d.getBearing())) % 360;
    _ml3d.jumpTo({ bearing: 75 });           // 손으로 돌려 본다
    S.hdg = 10; updateAcOnMap();
    await wait(200);
    return { north, kept: Math.round(normA(_ml3d.getBearing())) };
  });
  t.eq(back.north, 0, `N↑ 로 되돌리면 북쪽으로 맞춘다 (방위 ${back.north}°)`);
  t.eq(back.kept, 75,
    `N↑ 에서는 손으로 돌려 둔 각도를 매 프레임 되돌리지 않는다 (${back.kept}° 유지)`);

  // ── 타일이 아직 안 왔어도 카메라는 움직인다 ──
  // ①의 핵심. loaded() 가 false 인 상황을 만들어 추종이 계속되는지 본다.
  const slow = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const real = _ml3d.loaded.bind(_ml3d);
    _ml3d.loaded = () => false;              // 타일 로딩 중인 척
    if (!mapHdgUp) toggleMapOrient();
    if (!followMode) toggleFollow();
    S.lat = 37.60; S.lon = 126.60; S.hdg = 300;
    updateAcOnMap(); await wait(200);
    const c = { b: Math.round(normA(_ml3d.getBearing())),
                lat: _ml3d.getCenter().lat, lon: _ml3d.getCenter().lng };
    _ml3d.loaded = real;
    if (followMode) toggleFollow();
    if (mapHdgUp) toggleMapOrient();
    return c;
  });
  t.eq(slow.b, 300, `타일을 받는 중에도 방위가 따라온다 (${slow.b}°)`);
  t.ok(Math.abs(slow.lat - 37.60) < 0.2 && Math.abs(slow.lon - 126.60) < 0.2,
    `타일을 받는 중에도 추종이 계속된다 (${slow.lat.toFixed(3)}, ${slow.lon.toFixed(3)})`);

  await page.evaluate(async () => {
    if (_view3dOn) toggle3dMap();
    await new Promise(r => setTimeout(r, 100));
  });

  // ── 2D 와 3D 를 나란히 ──
  // 3분할에서 한 창은 2D 지도, 다른 창은 3D 지도. 3D 지도(#map3d)는 한 벌뿐이라
  // 고른 창으로 '옮겨' 간다 — 두 벌을 띄우면 타일을 두 배로 받게 된다.
  const side = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleTriple(true);
    selectPanel('mid', 'map', true);
    selectPanel('right', 'm3d', true);
    await wait(250);
    const d3 = document.getElementById('map3d');
    const W = id => Math.round(document.getElementById(id).getBoundingClientRect().width);
    const on = {
      sel: [leftSel, midSel, rightSel].join('·'),
      host: d3.parentElement.id,
      inPanel: d3.classList.contains('panel-3d'),
      active: d3.classList.contains('active'),
      overlay: document.getElementById('map-wrap').classList.contains('map3d-on'),
      mapShown: !document.getElementById('map-wrap').classList.contains('page-hidden'),
      wrapShown: !document.getElementById('map3d-wrap').classList.contains('page-hidden'),
      twoD: W('mid-panel'), threeD: W('right-panel'),
      shown: _map3dShown(), one: document.querySelectorAll('#map3d').length,
    };
    // 2D 지도 위에 또 겹치려 해도 바뀌지 않는다(겹치면 2D 창이 빈 화면이 된다)
    toggle3dMap();
    const guard = { view: _view3dOn, overlay: document.getElementById('map-wrap').classList.contains('map3d-on') };
    // 3D 창을 접으면 지도가 제자리로 돌아간다
    selectPanel('right', 'cdu', true);
    await wait(150);
    const off = { host: d3.parentElement.id, inPanel: d3.classList.contains('panel-3d'),
                  active: d3.classList.contains('active'), shown: _map3dShown(),
                  wrapShown: !document.getElementById('map3d-wrap').classList.contains('page-hidden') };
    selectPanel('mid', 'map', true);
    return { on, guard, off };
  });
  t.eq(side.on.sel, 'pfd·map·m3d', `한 창은 2D, 다른 창은 3D 로 둘 수 있다 (${side.on.sel})`);
  t.eq(side.on.host, 'map3d-wrap', '3D 지도가 그 창으로 옮겨 간다');
  t.eq(side.on.one, 1, '3D 지도는 한 벌뿐이다(두 벌로 늘리지 않는다)');
  t.eq(side.on.inPanel, true, '창을 가득 쓰는 모양이 된다');
  t.eq(side.on.active, true, '3D 가 그려진다');
  t.eq(side.on.overlay, false, '2D 지도를 덮지 않는다');
  t.eq(side.on.mapShown, true, '2D 지도 창은 그대로 보인다');
  t.ok(side.on.twoD > 50 && side.on.threeD > 50,
    `두 창이 나란히 자리를 차지한다 (2D ${side.on.twoD}px · 3D ${side.on.threeD}px)`);
  t.eq(side.on.shown, true, '카메라 추종도 켜진 것으로 본다(제 창에 떠 있으므로)');
  t.eq(side.guard.view, false, '그 상태에서 지도 툴바 3D 를 눌러도 겹치기로 바뀌지 않는다');
  t.eq(side.guard.overlay, false, '2D 창이 빈 화면이 되지 않는다');
  t.eq(side.off.host, 'map-wrap', '3D 창을 접으면 지도가 제자리로 돌아간다');
  t.eq(side.off.inPanel, false, '창을 쓰던 모양도 풀린다');
  t.eq(side.off.active, false, '겹치기를 켜 두지 않았으면 그려지지 않는다');
  t.eq(side.off.shown, false, '그때는 추종 대상도 아니다');
  t.eq(side.off.wrapShown, false, '빈 3D 창이 남지 않는다');

  // ── 나란히 놓아도 2D 지도가 항공기를 따라간다 ──
  // 종전에는 추종이 둘 중 하나만 돌아서, 3D 창을 열어 두면 2D 지도가 제자리에
  // 멈춰 있었다(회전만 되고 따라가지 않는 증상). 두 지도 중심을 함께 본다.
  const both = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleTriple(true);
    selectPanel('mid', 'map', true);
    selectPanel('right', 'm3d', true);
    await wait(250);
    if (!followMode) toggleFollow();
    S.lat = 37.20; S.lon = 126.20; S.hdg = 90; S.alt = 3000;
    updateAcOnMap(); await wait(150);
    const a = { two: leafMap.getCenter(), three: _ml3d.getCenter() };
    S.lat = 37.60; S.lon = 126.90;            // 400/700 분 이동
    updateAcOnMap(); await wait(150);
    const b = { two: leafMap.getCenter(), three: _ml3d.getCenter() };
    const d = (p, q) => Math.hypot(p.lat - q.lat, (p.lng - q.lng));
    const near = (c) => Math.hypot(c.lat - S.lat, c.lng - S.lon);
    const r = { moved2d: d(a.two, b.two), moved3d: d(a.three, b.three),
                near2d: near(b.two), near3d: near(b.three) };
    if (followMode) toggleFollow();
    selectPanel('right', 'cdu', true);
    selectPanel('mid', 'map', true);
    await wait(150);
    return r;
  });
  t.ok(both.moved2d > 0.2,
    `3D 창을 열어 둬도 2D 지도가 따라 움직인다 (${both.moved2d.toFixed(3)}° — 종전 0)`);
  t.ok(both.moved3d > 0.2, `3D 지도도 함께 따라간다 (${both.moved3d.toFixed(3)}°)`);
  t.ok(both.near2d < 0.25,
    `2D 중심이 항공기 근처에 머문다 (${both.near2d.toFixed(3)}° — 앞을 더 보려고 조금 앞선다)`);
  t.ok(both.near3d < 0.25, `3D 중심도 항공기 근처다 (${both.near3d.toFixed(3)}°)`);

  // ── 위성 사진의 빈 칸 메우기 ──
  // Esri 는 자세한 사진이 없는 곳(넓은 바다 등)의 높은 확대 단계에서 회색 '자료 없음'
  // 그림을 보낸다. 3D 는 그런 타일을 404 로 받아(blankTile=false) 위 단계 사진을 잘라
  // 늘려 채운다. 여기서는 15 단계까지만 사진이 있는 바다를 흉내 낸다. 한 번 없다고
  // 확인된 자리는 그 아래 단계를 다시 묻지 않는다.
  const COLORS = { 13: [10, 80, 30], 14: [20, 90, 40], 15: [30, 100, 160] };
  let seen = [];
  await page.route('**/server.arcgisonline.com/**', route => {
    const m = /\/tile\/(\d+)\/(\d+)\/(\d+)(\?.*)?$/.exec(route.request().url());
    const z = m ? +m[1] : -1;
    seen.push({ z, blank: !!(m && m[4] && m[4].includes('blankTile=false')) });
    // Esri 처럼 덜 자세한 단계는 다 있고(사진은 피라미드다) 16 단계부터 없다
    if (z >= 0 && z <= 15) return route.fulfill({ status: 200, contentType: 'image/png', body: solidPng(COLORS[z] || [5, 5, 5]) });
    return route.fulfill({ status: 404, body: '' });
  });
  const sat = await page.evaluate(async () => {
    _satMissing.clear(); _satBmp.clear(); tileStoreClear();
    const px = async buf => {
      const bmp = await createImageBitmap(new Blob([buf]));
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      return { w: bmp.width, rgb: Array.from(ctx.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data.slice(0, 3)) };
    };
    const own = await px(await _satTile(14, 13950, 6327));       // 사진이 있는 단계
    const up3 = await px(await _satTile(18, 223200, 101232));    // 18 단계 → 15 단계에서 잘라 늘린다
    // 이웃한 19 단계 타일 — 18 단계가 없다는 것을 이미 알므로 그 자리는 묻지 않는다
    const before = window._satAsked = 0;
    const origFetch = window.fetch;
    window.fetch = (u, o) => { if (String(u).includes('/tile/19/')) window._satAsked++; return origFetch(u, o); };
    const up4 = await px(await _satTile(19, 446400, 202464));
    window.fetch = origFetch;
    return { own, up3, up4, asked19: window._satAsked, src: _ml3d.getStyle().sources.satellite.tiles[0] };
  });
  t.eq(sat.src, 'sat://{z}/{x}/{y}', '3D 위성 사진은 빈 칸을 메우는 길(sat://)로 받는다');
  t.ok(seen.length > 0 && seen.every(q => q.blank), '없는 타일은 회색 그림 대신 404 로 받는다(blankTile=false)');
  t.eq(sat.own.rgb.join(','), COLORS[14].join(','), '사진이 있는 단계는 그대로 쓴다');
  t.ok(sat.up3.w === 256 && sat.up3.rgb.every((v, i) => Math.abs(v - COLORS[15][i]) <= 2),
    `사진이 없는 18 단계는 15 단계 사진으로 메운다 (rgb ${sat.up3.rgb.join(',')})`);
  t.ok(sat.asked19 === 0 && sat.up4.rgb.every((v, i) => Math.abs(v - COLORS[15][i]) <= 2),
    `없다고 확인된 자리의 더 자세한 단계는 묻지 않고 바로 메운다 (19 단계 요청 ${sat.asked19}번)`);
  await page.unroute('**/server.arcgisonline.com/**');
  await page.route('**/server.arcgisonline.com/**', route => route.fulfill({ status: 404, body: '' }));
  const none = await page.evaluate(async () => {
    _satMissing.clear(); _satBmp.clear(); tileStoreClear();          // 앞 검사에서 알아 둔 것을 비운다
    const bmp = await createImageBitmap(new Blob([await _satTile(18, 223200, 101232)]));
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    return Array.from(ctx.getImageData(128, 128, 1, 1).data.slice(0, 3));
  });
  t.eq(none.join(','), '11,38,56', '어느 단계에도 사진이 없으면 바다 빛으로 채운다');
  await page.unroute('**/server.arcgisonline.com/**');

  // ── 바다는 무조건 평평하게 ──
  // 네 칸: 바다 밑 −20m · 해안 잔물결 +3m · 낮은 땅 +10m · 땅 +100m (terrarium: R×256+G+B/256−32768)
  const col = m => { const v = m + 32768; return [v >> 8, v & 255, 0]; };
  const BANDS = [-20, 3, 10, 100];
  await page.route('**/elevation-tiles-prod/terrarium/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: pngOf(256, 256, x => col(BANDS[x >> 6])) }));
  const dem = await page.evaluate(async () => {
    tileStoreClear();                              // 미리 받아 둔 진짜 타일이 섞이지 않게
    const buf = await _demTile(12, 3480, 1588);
    const bmp = await createImageBitmap(new Blob([buf]), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    const at = x => { const d = ctx.getImageData(x, 100, 1, 1).data; return d[0] * 256 + d[1] + d[2] / 256 - 32768; };
    return { sea: at(30), ripple: at(90), low: at(160), land: at(220), src: _ml3d.getStyle().sources.terrain.tiles[0],
             fn: [seaFlatM(-3000), seaFlatM(4.9), seaFlatM(5), seaFlatM(10), seaFlatM(15), seaFlatM(800)] };
  });
  await page.unroute('**/elevation-tiles-prod/terrarium/**');
  t.eq(dem.src, 'dem://{z}/{x}/{y}', '3D 지형은 바다를 펴는 길(dem://)로 받는다');
  t.eq(dem.sea, 0, '바다 밑(−20m)은 수면 0m 로 편다 — 확대 단계마다 수심이 달라 그려진 바다가 오르내리지 않게');
  t.eq(dem.ripple, 0, '해안의 잔물결 같은 값(+3m)도 0m — 바다는 무조건 평평하다');
  t.eq(dem.low, 7.5, '5~15m 는 0~15m 로 부드럽게 잇는다(턱이 지지 않게) — +10m → 7.5m');
  t.eq(dem.land, 100, '15m 위의 땅은 그대로다 (+100m)');
  t.eq(dem.fn.join(','), '0,0,0,7.5,15,800', `바다 펴기 규칙 (−3000 · 4.9 · 5 · 10 · 15 · 800m → ${dem.fn.join(' · ')})`);

  // ── 타일 저장소 — 지도 세 장(3D · CHIN 둘)이 함께 쓰고, 20NM 밖은 지운다 ──
  // 같은 타일을 세 지도가 저마다 받고 저마다 바다를 펴면 같은 일을 세 번 한다(저고도 버벅임).
  let asked = 0;
  await page.route('**/elevation-tiles-prod/terrarium/**', route => {
    asked++;
    return route.fulfill({ status: 200, contentType: 'image/png', body: pngOf(256, 256, x => col(BANDS[x >> 6])) });
  });
  const store = await page.evaluate(async () => {
    tileStoreClear();
    const bufs = await Promise.all([_demTile(13, 6993, 3180), _demTile(13, 6993, 3180), _demTile(13, 6993, 3180)]);
    const again = await _demTile(13, 6993, 3180);
    const sameBytes = (a, b) => { const x = new Uint8Array(a), y = new Uint8Array(b);
      return x.length === y.length && x.every((v, i) => v === y[i]); };
    const out = { n: bufs.length, same: bufs.every(b => sameBytes(b, bufs[0])) && sameBytes(again, bufs[0]),
                  copies: bufs[0] !== bufs[1] };
    // 20NM 밖은 지운다 — 가까운 타일 · 46NM 동쪽 타일 · 아주 넓은 단계(6)
    tileStoreClear();
    const fake = () => Promise.resolve(new Blob([new Uint8Array(4)]));
    const near = _tileXY(12, 37.46, 126.44), far = _tileXY(12, 37.46, 127.4);
    _tileGet('dem', 12, near.x, near.y, fake); _tileGet('sat', 12, far.x, far.y, fake);
    _tileGet('sat', 6, 54, 24, fake);
    out.removed = tileStoreTrim(37.46, 126.44);
    out.keepNear = _tileStore.dem.has(`12/${near.x}/${near.y}`);
    out.keepFar = _tileStore.sat.has(`12/${far.x}/${far.y}`);
    out.keepWide = _tileStore.sat.has('6/54/24');
    tileStoreClear();
    // 미리 받아 둘 목록 — 20NM 안의 11·12 단계(지형·사진)와 발밑 4NM 의 14 단계 지형
    setMap3dQuality('mid');
    const list = _tilePrefetchList(37.46, 126.44);
    const of = (k, z) => list.filter(q => q.kind === k && q.z === z);
    const north19 = _tileXY(12, 37.46 + 19 / 60, 126.44);
    out.pf = {
      n: list.length, sorted: list.every((q, i) => !i || list[i - 1].d <= q.d),
      dem12: of('dem', 12).length, sat12: of('sat', 12).length, dem14: of('dem', 14).length,
      reach19: of('dem', 12).some(q => q.x === north19.x && q.y === north19.y),
      within: list.every(q => q.d - _tileCenter(q.z, q.x, q.y).half <= (q.z === 14 ? 4 : 20) + 1e-6),
    };
    setMap3dQuality('low');
    out.pfLow14 = _tilePrefetchList(37.46, 126.44).filter(q => q.z > 12).length;
    setMap3dQuality('mid');
    return out;
  });
  await page.unroute('**/elevation-tiles-prod/terrarium/**');
  t.ok(store.same && store.copies && asked === 1,
    `세 지도가 한꺼번에 달라고 해도 지형 타일은 한 번만 받고 한 번만 편다 (받은 횟수 ${asked})`);
  t.ok(store.removed === 1 && store.keepNear && !store.keepFar && store.keepWide,
    `20NM 밖으로 벗어난 타일은 지운다 (46NM 동쪽 지움 · 가까운 것과 넓은 단계는 그대로)`);
  t.ok(store.pf.sorted && store.pf.within && store.pf.reach19,
    `20NM 안을 가까운 곳부터 미리 받는다 (${store.pf.n}장 · 북쪽 19NM 까지)`);
  t.ok(store.pf.dem12 > 40 && store.pf.sat12 === store.pf.dem12 && store.pf.dem14 > 10,
    `12 단계 지형·사진 ${store.pf.dem12}장씩 · 발밑 4NM 지형(14 단계) ${store.pf.dem14}장`);
  t.eq(store.pfLow14, 0, "화질 '하' 에서는 그 화질이 쓰지 않는 자세한 단계를 미리 받지 않는다");

  // ── 화질 상·중·하 ──
  // 낮출수록 그리는 픽셀(해상도 배율)과 받는 타일(자세한 단계)이 줄어 저고도에서도 부드럽다.
  const q = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let n = 0;
    while (!(_map3dQ.get(_ml3d) || {}).loaded && n < 200) { await wait(50); n++; }
    const look = () => {
      const st = _ml3d.getStyle();
      return { sat: st.sources.satellite.maxzoom, dem: st.sources.terrain.maxzoom,
               ratio: _ml3d.getPixelRatio(), first: st.layers[0].id, terrain: !!_ml3d.getTerrain(),
               fade: (st.layers.find(l => l.id === 'satellite').paint || {})['raster-fade-duration'],
               btn: document.getElementById('q3d-btn').textContent,
               saved: (() => { try { return localStorage.getItem('map3dQuality'); } catch (e) { return null; } })() };
    };
    setMap3dQuality('low'); const low = look();
    cycleMap3dQuality(); const high = look();
    cycleMap3dQuality(); const mid = look();
    return { low, high, mid, dpr: window.devicePixelRatio || 1 };
  });
  t.ok(q.low.sat === 15 && q.low.dem === 12 && q.low.ratio <= 0.8 + 1e-9,
    `화질 '하' — 사진 15 · 지형 12 단계까지, 해상도 ${q.low.ratio}배`);
  t.ok(q.high.sat === 19 && q.high.dem === 15 && q.high.ratio === q.dpr,
    `화질 '상' — 사진 19 · 지형 15 단계까지, 기기 해상도 그대로(${q.high.ratio}배)`);
  t.ok(q.mid.sat === 17 && q.mid.dem === 14, `화질 '중' — 사진 17 · 지형 14 단계까지`);
  t.ok([q.low, q.high, q.mid].every(v => v.first === 'satellite' && v.terrain && v.fade === 0),
    '바꿔 얹어도 위성 사진은 맨 아래 · 지형도 그대로 · 새 타일은 서서히 나타나지 않는다(다시 그리기 줄임)');
  t.ok(q.low.btn === '화질 하' && q.high.btn === '화질 상' && q.mid.btn === '화질 중',
    `버튼이 상 → 중 → 하 를 돌며 지금 화질을 적는다 (${q.low.btn} → ${q.high.btn} → ${q.mid.btn})`);
  t.eq(q.mid.saved, 'mid', '고른 화질은 이 기기에 적어 둔다');
}
