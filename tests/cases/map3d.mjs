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
    const north = Math.round(normA(_ml3d.getBearing()));
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
}
