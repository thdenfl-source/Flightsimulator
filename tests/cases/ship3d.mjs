// 3D 지도의 함정.
//
// 지도의 SHIP 모형(shipIcon 의 SVG)을 실제 크기 — 길이 100m · 폭 25m — 로 3D 에
// 세운다. 2D 와 같은 값(위치·침로·속도)을 쓰고, 3D 에서도 끌어 옮기고 두 번 눌러
// 설정창을 연다. 3D 가 제 창을 쓸 때는 SHIP 메뉴·설정창이 그 창 안에서 열린다.
export const name = '3D 함정';

import { pngOf } from './map3d.mjs';

export async function run(page, t) {
  // 지형 타일 흉내 — 덜 자세한 단계(≤12)는 바다가 0m, 자세한 단계(≥13)는 수심 −20m.
  // 실제 지형 자료가 그렇다. 낮게 날면 자세한 타일이 깔린다.
  const SEA0 = pngOf(256, 256, () => [128, 0, 0]), SEA20 = pngOf(256, 256, () => [127, 236, 0]);
  await page.route('**/elevation-tiles-prod/terrarium/**', route => {
    const m = /terrarium\/(\d+)\//.exec(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: m && +m[1] >= 13 ? SEA20 : SEA0 });
  });
  // 3D 를 겹쳐 켜고 함정 레이어가 얹힐 때까지 기다린다(지도 load 이벤트)
  const open = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    S.lat = 37.0; S.lon = 126.0; S.hdg = 0; S.alt = 1000;     // 서해 바다 위
    if (followMode) toggleFollow();
    if (!_view3dOn) toggle3dMap();
    let n = 0;
    while (!_ship3dReady && n < 300) { await wait(50); n++; }
    return { ready: _ship3dReady, waited: n * 50,
             type: _ml3d && _ml3d.getLayer('ship-3d') ? _ml3d.getLayer('ship-3d').type : null };
  });
  if (!open.ready) { t.ok(false, `3D 지도에 함정 레이어가 얹히지 않았다 (${JSON.stringify(open)})`); return; }
  t.eq(open.type, 'fill-extrusion', '함정은 3D 로 세워 그린다(fill-extrusion)');

  // ── 모양과 크기 ──
  const geo = await page.evaluate(async () => {
    const feats = async () => ((await _ml3d.getSource('ship-3d').getData()).features || []);
    const offBefore = (await feats()).length;
    _ml3d.jumpTo({ center: [126.0, 37.0], zoom: 16, pitch: 0, bearing: 0 });
    if (shipVisible) shipToggleOn();
    shipToggleOn();                                // 배 표시 ON — 3D 가 보이면 3D 가운데에 놓는다
    const c3 = _ml3d.getCenter();
    const spawnOff = distance(shipLat, shipLon, c3.lat, c3.lng) * 1852;
    shipHdg = 0; updateShipMarker();
    // 함정 중심 기준의 앞(+)·오른쪽(+) m 로 되돌려 잰다
    const local = ([lon, lat]) => {
      const n = (lat - shipLat) * 111320, e = (lon - shipLon) * 111320 * Math.cos(shipLat * D2R);
      const h = shipHdg * D2R;
      return [n * Math.cos(h) + e * Math.sin(h), e * Math.cos(h) - n * Math.sin(h)];
    };
    const span = f => {
      const p = f.geometry.coordinates[0].map(local);
      const fw = p.map(q => q[0]), rt = p.map(q => q[1]);
      return { len: Math.max(...fw) - Math.min(...fw), beam: Math.max(...rt) - Math.min(...rt),
               fwdMax: Math.max(...fw), fwdMin: Math.min(...fw), h: f.properties.h, b: f.properties.b, c: f.properties.c };
    };
    const fs = await feats();
    const of = k => fs.filter(f => f.properties.k === k);
    const hull = span(of('hull')[0]), bridge = span(of('bridge')[0]), bow = span(of('bow')[0]);
    const dashes = of('dash').map(span);
    // 비행갑판 표시
    const lineup = span(of('lineup')[0]), wall = span(of('lineup-wall')[0]);
    const tdF = of('td')[0], td = span(tdF);
    const holeR = (() => {
      const h = tdF.geometry.coordinates[1].map(local);
      const cf = (Math.max(...h.map(q => q[0])) + Math.min(...h.map(q => q[0]))) / 2;
      return Math.max(...h.map(q => Math.hypot(q[0] - cf, q[1])));
    })();
    const xs = of('x').map(span), shoulder = span(of('shoulder')[0]), limit = span(of('limit')[0]);
    const marks = { lineup, wall, td, holeR, tdRings: tdF.geometry.coordinates.length, xs, shoulder, limit };
    // 침로 090 — 함수가 동쪽을 향한다
    shipHdg = 90; updateShipMarker();
    const ring = (await feats())[0].geometry.coordinates[0];
    const east = Math.max(...ring.map(q => (q[0] - shipLon) * 111320 * Math.cos(shipLat * D2R)));
    const northAtBow = (() => {
      const q = ring.reduce((a, b) => (b[0] > a[0] ? b : a));
      return (q[1] - shipLat) * 111320;
    })();
    shipHdg = 0; updateShipMarker();
    return { offBefore, spawnOff, hull, bridge, bow, dashes, marks, east, northAtBow, n: fs.length,
             cnt: { deck: of('deck').length, stripe: of('stripe').length, mast: of('mast').length } };
  });
  t.eq(geo.offBefore, 0, '배를 켜기 전에는 3D 에 아무것도 없다');
  t.ok(geo.spawnOff < 5, `3D 를 보고 있으면 3D 화면 가운데에 놓인다 (${geo.spawnOff.toFixed(1)}m)`);
  t.ok(Math.abs(geo.hull.len - 100) < 0.5 && Math.abs(geo.hull.beam - 25) < 0.5,
    `선체는 실제 크기다 (길이 ${geo.hull.len.toFixed(1)}m · 폭 ${geo.hull.beam.toFixed(1)}m)`);
  t.ok(Math.abs(geo.hull.fwdMax - 50) < 0.5 && Math.abs(geo.hull.fwdMin + 50) < 0.5,
    `함정 위치가 선체 한가운데다 (앞 ${geo.hull.fwdMax.toFixed(1)} · 뒤 ${geo.hull.fwdMin.toFixed(1)}m)`);
  t.ok(geo.hull.h === 7 && geo.bridge.h === 17 && geo.bow.h === 10,
    `갑판 7m · 함교 17m · 함수 구조물 10m (${geo.hull.h} · ${geo.bridge.h} · ${geo.bow.h})`);
  t.ok(Math.abs(geo.bridge.len - 26.3) < 0.5 && Math.abs(geo.bridge.beam - 11.1) < 0.5,
    `함교는 지도 모형 크기 그대로다 (${geo.bridge.len.toFixed(1)} × ${geo.bridge.beam.toFixed(1)}m)`);
  t.ok(Math.abs((geo.bridge.fwdMin - geo.hull.fwdMin) - 40) < 0.1,
    `함교 뒤 비행갑판은 40m 다 (${(geo.bridge.fwdMin - geo.hull.fwdMin).toFixed(1)}m · 함정 ${geo.hull.len.toFixed(0)}m)`);
  t.ok(geo.bow.fwdMax > 40 && geo.bow.fwdMin > 30, `함수 구조물은 앞쪽에 있다 (${geo.bow.fwdMin.toFixed(0)}…${geo.bow.fwdMax.toFixed(0)}m)`);
  t.ok(geo.dashes.length === 3 && geo.dashes.every(d => d.h > 7 && d.h < 7.2 && d.beam < 1 && d.fwdMin > 10),
    `함교 앞 갑판에는 지도 모형의 점선 중심선 (${geo.dashes.length}토막)`);
  // ── 비행갑판 표시 ──
  const m = geo.marks;
  t.ok(m.lineup.c === '#ffd200' && m.lineup.beam < 0.5 && Math.abs(m.lineup.fwdMax + 10) < 0.1
       && m.lineup.fwdMin < -48 && m.lineup.h > 7 && m.lineup.h < 7.1,
    `노란 정렬선이 함교 뒷면에서 함미까지 갑판 중심선을 따라간다 (${m.lineup.fwdMax.toFixed(1)} → ${m.lineup.fwdMin.toFixed(1)}m)`);
  t.ok(m.wall.c === '#ffd200' && m.wall.h === 17 && Math.abs(m.wall.fwdMax + 10) < 0.1 && m.wall.len < 0.25 && m.wall.b === 7,
    `함교 뒷면 한가운데를 위에서 갑판까지 노란 세로선이 내려온다 (높이 ${m.wall.h}m)`);
  t.ok(m.td.c === '#ffffff' && m.tdRings === 2 && Math.abs(m.td.len - 10) < 0.1 && Math.abs(m.td.beam - 10) < 0.1
       && Math.abs(m.holeR - 4.4) < 0.05,
    `흰 착함 원 (지름 ${m.td.len.toFixed(1)}m · 선 굵기 ${(5 - m.holeR).toFixed(1)}m)`);
  t.ok(m.xs.length === 2 && m.xs.every(x => x.c === '#ffffff' && Math.abs((x.fwdMax + x.fwdMin) / 2 + 30) < 0.1),
    '원 한가운데에 흰 X');
  t.ok(Math.abs((m.td.fwdMax + m.td.fwdMin) / 2 + 30) < 0.1, '착함 원은 40m 비행갑판의 한가운데(30m 뒤)에 있다');
  t.ok(m.shoulder.c === '#ffffff' && Math.abs(m.shoulder.fwdMin - m.td.fwdMax) < 0.01 && m.shoulder.beam >= 9.9,
    `어깨선은 원 앞쪽에 맞닿은 흰 가로선이다 (원 앞 ${m.td.fwdMax.toFixed(1)} · 어깨선 ${m.shoulder.fwdMin.toFixed(1)}m)`);
  {
    const sc = (m.shoulder.fwdMax + m.shoulder.fwdMin) / 2, lc = (m.limit.fwdMax + m.limit.fwdMin) / 2;
    t.ok(m.limit.c === '#ffffff' && Math.abs(lc - sc - 2) < 0.01 && m.limit.beam > m.shoulder.beam,
      `전방한계선은 어깨선 2m 앞의 흰 가로선이다 (${(lc - sc).toFixed(1)}m 앞 · 길이 ${m.limit.beam.toFixed(0)}m)`);
  }
  t.ok([m.lineup, m.td, m.shoulder, m.limit].every(q => q.h > 7 && q.h < 7.1),
    '표시는 갑판에 칠한 것이라 5cm 만 나온다');
  t.ok(geo.hull.c === '#f2f3f4' && geo.bridge.c === '#fafafa' && geo.cnt.deck === 1 && geo.cnt.stripe === 6 && geo.cnt.mast >= 1,
    `해경 3016함 도면처럼 흰 선체 · 초록 갑판 · 빨강·노랑·파랑 띠 · 마스트 (띠 ${geo.cnt.stripe}개)`);
  t.ok(Math.abs(geo.east - 50) < 0.5 && Math.abs(geo.northAtBow) < 0.5,
    `침로 090 이면 함수가 동쪽을 향한다 (동쪽 ${geo.east.toFixed(1)}m)`);

  // ── 실제로 그려지는가 ──
  const drawn = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // 지도를 가운데 창에 두고 본다(기본 배치는 우측 MAP — 설정창이 끄는 자리를 덮는다)
    selectPanel('mid', 'map', true); selectPanel('right', 'cdu', true); await wait(600);
    try { _ml3d.resize(); } catch (e) {}
    _ml3d.jumpTo({ center: [shipLon, shipLat], zoom: 18, pitch: 0, bearing: 0 });
    await wait(1500);
    const p = _ml3d.project([shipLon, shipLat]);
    const hit = _ml3d.queryRenderedFeatures([p.x, p.y], { layers: ['ship-3d'] });
    const r = _ml3d.getCanvas().getBoundingClientRect();
    return { n: hit.length, x: r.left + p.x, y: r.top + p.y + 30 };   // 함교보다 조금 뒤(함미 쪽)
  });
  t.ok(drawn.n > 0, `3D 지도에 그려져 집힌다 (${drawn.n}개)`);

  // ── 3D 에서 두 번 누르면 설정창, 끌면 옮긴다 ──
  await page.evaluate(() => { document.getElementById('ship-panel').style.display = 'none'; });
  await page.mouse.dblclick(drawn.x, drawn.y);
  await page.waitForTimeout(300);
  const dbl = await page.evaluate(() => ({
    panel: document.getElementById('ship-panel').style.display,
    host: document.getElementById('ship-panel').parentElement.id }));
  t.ok(dbl.panel === 'block' && dbl.host === 'map-wrap',
    `3D 의 함정을 두 번 누르면 설정창이 열린다 (${dbl.panel} · ${dbl.host})`);
  const before = await page.evaluate(() => ({ lat: shipLat, lon: shipLon, z: _ml3d.getCenter() }));
  await page.mouse.move(drawn.x, drawn.y);
  await page.mouse.down();
  await page.mouse.move(drawn.x + 60, drawn.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const drag = await page.evaluate(b => ({
    moved: distance(b.lat, b.lon, shipLat, shipLon) * 1852,
    east: (shipLon - b.lon) * 111320 * Math.cos(shipLat * D2R),
    mapMoved: distance(b.z.lat, b.z.lng, _ml3d.getCenter().lat, _ml3d.getCenter().lng) * 1852,
    dragging: shipDragging,
    mk: shipMarker ? distance(shipMarker.getLatLng().lat, shipMarker.getLatLng().lng, shipLat, shipLon) * 1852 : -1,
  }), before);
  t.ok(drag.moved > 10 && drag.east > 10,
    `3D 에서 끌면 함정이 옮겨 간다 — 열린 설정창 위를 지나가도 (동쪽 ${drag.east.toFixed(0)}m)`);
  t.ok(drag.mapMoved < 2, `끄는 동안 지도는 밀리지 않는다 (${drag.mapMoved.toFixed(1)}m)`);
  t.ok(!drag.dragging && drag.mk < 1, '2D 마커도 같은 자리로 따라간다');

  // ── 움직이면 3D 모형도 함께 간다 ──
  const mv = await page.evaluate(async () => {
    shipSpd = 20; shipHdg = 0; updateShipMarker();
    const lat0 = shipLat;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 60; i++) { ts += 50; simStep(ts); }   // 3초
    S.running = false;
    const ring = (await _ml3d.getSource('ship-3d').getData()).features[0].geometry.coordinates[0];
    const lats = ring.map(q => q[1]);
    const cLat = (Math.max(...lats) + Math.min(...lats)) / 2;      // 선체 앞뒤 끝의 한가운데
    shipSpd = 0; updateShipMarker();
    return { moved: (shipLat - lat0) * 111320, follow: Math.abs(cLat - shipLat) * 111320 };
  });
  t.ok(mv.moved > 25 && mv.moved < 35, `20kt 로 3초면 30m 북쪽으로 간다 (${mv.moved.toFixed(1)}m)`);
  t.ok(mv.follow < 0.5, `3D 모형도 그 자리로 함께 간다 (${mv.follow.toFixed(2)}m)`);

  // ── 3D 가 제 창을 쓸 때 — SHIP 버튼·메뉴·설정창이 그 창 안에서 열린다 ──
  const panel = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const vis = id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const host = id => document.getElementById(id).parentElement.id;
    document.getElementById('ship-panel').style.display = 'none';
    document.getElementById('ship-menu').classList.remove('open');
    if (_view3dOn) toggle3dMap();
    const btnOverlay = vis('ship3d-btn');
    // 3D 는 오른쪽 창 하나만 쓴다(3분할이면 가운데는 2D 지도)
    selectPanel('left', 'pfd', true);
    if (tripleMode) selectPanel('mid', 'map', true);
    selectPanel('right', 'm3d', true);
    await wait(100);
    const btn = vis('ship3d-btn');
    toggleShip3d();
    const menu = { host: host('ship-menu'), vis: vis('ship-menu') };
    shipTogglePanel();                             // 메뉴의 '설정창'
    const pnl = { host: host('ship-panel'), vis: vis('ship-panel') };
    shipTogglePanel();
    toggleShip3d();                                // 메뉴 닫기
    // 3D 창을 닫으면(오른쪽을 CDU 로) 메뉴·설정창이 2D 지도 창으로 돌아온다
    selectPanel('right', 'cdu', true);
    await wait(50);
    const back = { menu: host('ship-menu'), panel: host('ship-panel') };
    return { btnOverlay, btn, menu, pnl, back };
  });
  t.eq(panel.btnOverlay, false, '2D 위에 겹쳐 쓸 때는 3D 창의 SHIP 버튼을 따로 두지 않는다(아래 막대의 SHIP)');
  t.eq(panel.btn, true, '3D 가 제 창을 쓰면 그 창에 SHIP 버튼이 있다');
  t.ok(panel.menu.host === 'map3d' && panel.menu.vis, `SHIP 메뉴가 3D 창 안에서 열린다 (${panel.menu.host})`);
  t.ok(panel.pnl.host === 'map3d' && panel.pnl.vis, `설정창도 3D 창 안에서 열린다 (${panel.pnl.host})`);
  t.ok(panel.back.menu === 'map-wrap' && panel.back.panel === 'map-wrap', '3D 창을 닫으면 2D 지도 창으로 돌아온다');

  // ── SIM 1인칭에서 켜면 기수 앞에 놓는다 · 바다는 해수면이 바닥이다 ──
  const sim = await page.evaluate(() => {
    const was = simModeOn;
    simModeOn = true; S.lat = 37.0; S.lon = 126.0; S.hdg = 120;
    const p = _shipSpawn();
    simModeOn = was;
    const realElev = _tcElev;
    _tcElev = () => -50;                          // 수심 50m 바다
    const g = simTerrainFt();
    _tcElev = () => 3;                            // 해안의 잔물결 같은 값
    const ripple = simTerrainFt();
    _tcElev = () => 100;                          // 땅
    const land = simTerrainFt();
    _tcElev = realElev;
    return { dist: distance(S.lat, S.lon, p[0], p[1]), brg: bearing(S.lat, S.lon, p[0], p[1]), g, ripple, land };
  });
  t.ok(Math.abs(sim.dist - 0.3) < 0.01 && Math.abs(sim.brg - 120) < 1,
    `SIM 에서는 기수 앞 0.3NM 에 놓는다 (${sim.dist.toFixed(2)}NM · ${sim.brg.toFixed(0)}°)`);
  t.eq(sim.g, 0, '바다 위에서는 해수면(0ft)이 바닥이다 — 수심만큼 내려가지 않는다');
  t.ok(sim.ripple === 0 && Math.abs(sim.land - 100 / 0.3048) < 0.01,
    `SIM 의 땅도 3D 와 같은 규칙이다 (잔물결 3m → ${sim.ripple}ft · 땅 100m → ${sim.land.toFixed(0)}ft)`);

  // ── 착함 — 함정 위에서는 갑판이 바닥이고, 앉으면 함정과 함께 간다 ──
  const land = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window._pad = { index: 0, id: 'T', mapping: '', buttons: [], axes: [0, 0, 0, -1] };
    navigator.getGamepads = () => [window._pad];
    joyStop(); joyOn = true; joyAxSaved = true; joyCancelCapture(); joyAxCancelCapture();
    for (const k in _joyNeutral) delete _joyNeutral[k];
    joyAxes = { coll: { i: 3, inv: false, abs: true } };      // 레버식 컬렉티브(축 3) — 맨 아래
    joyPoll(1000);
    const realElev = _tcElev;
    _tcElev = () => -50;                                     // 수심 50m 바다
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 0; shipSpd = 0; updateShipMarker();
    // 함정 기준 앞(+)·오른쪽(+) m
    const at = (fwd, right) => [shipLat + fwd / 111320, shipLon + right / (111320 * Math.cos(shipLat * D2R))];
    const rel = () => {
      const n = (S.lat - shipLat) * 111320, e = (S.lon - shipLon) * 111320 * Math.cos(shipLat * D2R);
      const h = shipHdg * D2R;
      return { fwd: n * Math.cos(h) + e * Math.sin(h), right: e * Math.cos(h) - n * Math.sin(h) };
    };
    const floorAt = (fwd, right) => { [S.lat, S.lon] = at(fwd, right); simTerrainFt(); return simFloorFt(); };
    const DECK = 7 / 0.3048;
    S.hdg = 0;
    const floors = { stern: floorAt(-35, 0), bridge: floorAt(-3, 0), bow: floorAt(40, 0),
                     side: floorAt(-35, 20), far: floorAt(-80, 0),
                     tdX: floorAt(-30, 0), lineup: floorAt(-40, 0), shoulder: floorAt(-24.8, 0),
                     overBridge: floorAt(-15, 0) };   // 기체 앞쪽 5m 가 함교 위
    let ts = 1000;
    const fly = sec => {
      S.running = true; S.lastT = ts;
      for (let i = 0; i < sec * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); }
      S.running = false;
    };
    // 함미 갑판 위 100ft 에서 레버를 내려 내려앉는다
    if (!simModeOn) toggleSimMode(true);
    [S.lat, S.lon] = at(-35, 0); S.hdg = 0; S.alt = 100; S.spd = 0; S.vs = 0;
    simAcc = 0; simVsAcc = 0; simLat = 0; S.pit = pitchFromSpd(0); simTrimHoldSpeed();
    fly(10);
    const landed = { alt: S.alt, vs: S.vs, deck: simOnDeck(), ...rel() };
    // 1인칭 시점 — 눈은 갑판 위 8m, 가까운 클립면이 몇 m 라 갑판·함교가 잘리지 않는다.
    // 눈높이 바닥은 실제 시간(0.4초)에 걸쳐 갑판으로 옮겨 가므로 잠깐 화면을 돌린다.
    for (let i = 0; i < 20; i++) { _applyFollow(); await wait(60); }
    const tr = _ml3d.transform, cl = tr.getCameraLngLat();
    const view = { sim: simModeOn, alt: tr.getCameraAltitude(), near: tr._helper._nearZ / tr._helper._pixelPerMeter,
                   off: distance(cl.lat, cl.lng, S.lat, S.lon) * 1852,
                   rend: _ml3d.queryTerrainElevation([S.lon, S.lat]) };
    // 함정이 15kt 로 가도 갑판 위 그 자리에 앉아 있다
    shipSpd = 15;
    const lat0 = shipLat;
    fly(10);
    const ride = { ...rel(), shipMoved: (shipLat - lat0) * 111320, alt: S.alt };
    // 일시정지 중에도 함정은 가고, 앉아 있는 헬기도 함께 간다
    S.running = false; S.lastT = ts;
    for (let i = 0; i < 40; i++) { ts += 50; simStep(ts); }
    const paused = rel();
    // 함정이 침로를 바꾸면 헬기도 함정 중심을 축으로 함께 돈다
    shipSetMode('CRS');
    const hdg0 = S.hdg, shdg0 = shipHdg;
    ['0', '9', '0', 'ENT'].forEach(shipKey);
    const turned = { ...rel(), dHdg: normAS(S.hdg - hdg0), dShip: normAS(shipHdg - shdg0) };
    // 레버를 올려 뜬다 — 뜨는 순간 함정 속도로 날고 있다(튀지 않는다)
    _pad.axes[3] = 0.6;
    S.running = true; S.lastT = ts;
    let n = 0;
    while (simOnDeck() && n < 400) { ts += 50; joyPoll(ts); simStep(ts); n++; }
    const p0 = [S.lat, S.lon], s0 = [shipLat, shipLon];
    for (let i = 0; i < 20; i++) { ts += 50; joyPoll(ts); simStep(ts); }   // 뜬 뒤 1초
    S.running = false;
    const lift = { frames: n, heli: distance(p0[0], p0[1], S.lat, S.lon) * 1852,
                   ship: distance(s0[0], s0[1], shipLat, shipLon) * 1852, alt: S.alt };
    // 함정과 같은 속도로 날다 갑판에 닿으면 갑판 위에서는 거의 서 있다
    shipHdg = 0; shipSpd = 10; updateShipMarker();
    [S.lat, S.lon] = at(-35, 0); S.hdg = 0; S.spd = 10; simLat = 0;
    S.alt = simFloorFt() + 0.3; S.vs = -200; simVsAcc = 0; simAcc = 0;
    _pad.axes[3] = -1;
    S.running = true; S.lastT = ts; ts += 50; joyPoll(ts); simStep(ts); S.running = false;
    const touch = { deck: simOnDeck(), spd: S.spd };
    // 기체(앞뒤 20m)는 함교·선체 옆면에 부딪히면 그 앞에서 선다
    shipHdg = 0; shipSpd = 0; updateShipMarker();
    _pad.axes[3] = (tqRequired() / SIM_LEVER_TOP) * 2 - 1;            // 레버는 높이 유지
    const push = (fwd, right, hdg, alt, sec) => {
      [S.lat, S.lon] = at(fwd, right); S.hdg = hdg; S.alt = alt; S.vs = 0; simVsAcc = 0;
      S.spd = 8; simLat = 0; simAcc = 0; S.pit = pitchFromSpd(8); simTrimHoldSpeed();
      S.running = true; S.lastT = ts;
      for (let i = 0; i < sec * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); }
      S.running = false;
      return { ...rel(), spd: S.spd, alt: S.alt };
    };
    const intoBridge = push(-28, 0, 0, DECK + 5, 8);          // 갑판 위 5ft 로 함교 쪽으로
    const intoSide = push(-30, 30, 270, 10, 8);               // 수면 위 10ft 로 우현 옆면 쪽으로
    // 정리
    _tcElev = realElev; shipSpd = 0; updateShipMarker();
    toggleSimMode(false);
    return { floors, landed, view, ride, paused, turned, lift, touch, intoBridge, intoSide };
  });
  const DECK_FT = 7 / 0.3048;
  t.ok(Math.abs(land.floors.stern - DECK_FT) < 0.01 && Math.abs(land.floors.bridge - 17 / 0.3048) < 0.01
       && Math.abs(land.floors.bow - 10 / 0.3048) < 0.01,
    `함정 위에서는 그 부분의 윗면이 바닥이다 (갑판 ${land.floors.stern.toFixed(1)} · 함교 ${land.floors.bridge.toFixed(1)} · 함수 ${land.floors.bow.toFixed(1)}ft)`);
  t.ok(land.floors.side === 0 && land.floors.far === 0, '함정 옆·뒤 바다는 해수면(0ft)이 바닥이다');
  t.ok(Math.abs(land.floors.overBridge - 17 / 0.3048) < 0.01,
    `기체(앞뒤 20m) 앞쪽이 함교 위에 있으면 함교에 걸린다 (${land.floors.overBridge.toFixed(1)}ft)`);
  t.ok(land.intoBridge.fwd < -19.4 && land.intoBridge.fwd > -21 && Math.abs(land.intoBridge.spd) < 0.5,
    `갑판 위를 앞으로 나가면 기수(10m 앞)가 함교에 닿는 자리에서 선다 (함정 가운데에서 ${land.intoBridge.fwd.toFixed(1)}m · 함교 뒷면 -10m)`);
  t.ok(land.intoSide.right > 22 && land.intoSide.right < 23.6,
    `갑판보다 낮게 옆에서 다가가면 선체 옆면 앞에서 선다 (중심선에서 ${land.intoSide.right.toFixed(1)}m · 옆면 12.5m)`);
  t.ok([land.floors.tdX, land.floors.lineup, land.floors.shoulder].every(f => Math.abs(f - 7 / 0.3048) < 0.01),
    '착함 원·X·정렬선·어깨선 위도 갑판 높이 그대로다(칠한 선이다)');
  t.ok(Math.abs(land.landed.alt - DECK_FT) < 0.6 && land.landed.vs === 0 && land.landed.deck,
    `레버를 내리면 함미 갑판에 내려앉는다 (${land.landed.alt.toFixed(1)}ft · 갑판 ${DECK_FT.toFixed(1)}ft)`);
  {
    const drawn = Number.isFinite(land.view.rend) ? land.view.rend : 0;   // 그려진 수면
    t.ok(land.view.sim && Math.abs(land.view.alt - drawn - 10) < 0.5 && land.view.off < 0.5,
      `갑판에서는 눈이 갑판(7m) 위 3m 다 (수면 위 ${(land.view.alt - drawn).toFixed(1)}m · 헬기 자리에서 ${land.view.off.toFixed(2)}m)`);
    t.ok(land.view.near < 6,
      `가까운 클립면이 ${land.view.near.toFixed(1)}m 라 발밑 갑판과 함교가 잘리지 않는다 (종전 133m)`);
  }
  t.ok(Math.abs(land.ride.fwd - land.landed.fwd) < 1 && Math.abs(land.ride.right) < 1
       && land.ride.shipMoved > 70 && Math.abs(land.ride.alt - DECK_FT) < 0.6,
    `함정이 15kt 로 가도 갑판 그 자리에 앉아 있다 (함정 ${land.ride.shipMoved.toFixed(0)}m 이동 · 갑판 위 ${land.ride.fwd.toFixed(1)}m)`);
  t.ok(Math.abs(land.paused.fwd - land.landed.fwd) < 1,
    `일시정지 중에도 함께 간다 (갑판 위 ${land.paused.fwd.toFixed(1)}m)`);
  t.ok(Math.abs(land.turned.fwd - land.landed.fwd) < 1 && Math.abs(land.turned.right) < 1
       && Math.abs(land.turned.dHdg - land.turned.dShip) < 0.01 && Math.abs(land.turned.dShip) > 30,
    `함정이 침로를 바꾸면 함께 돈다 (함정 ${land.turned.dShip.toFixed(0)}° · 헬기 ${land.turned.dHdg.toFixed(0)}°)`);
  t.ok(land.lift.frames < 400 && land.lift.alt > DECK_FT + 1,
    `레버를 올리면 갑판에서 뜬다 (${(land.lift.frames * 0.05).toFixed(1)}초 · ${land.lift.alt.toFixed(0)}ft)`);
  t.ok(Math.abs(land.lift.heli - land.lift.ship) < land.lift.ship * 0.3,
    `뜬 직후에는 함정 속도로 날고 있다 (1초에 헬기 ${land.lift.heli.toFixed(1)}m · 함정 ${land.lift.ship.toFixed(1)}m)`);
  t.ok(land.touch.deck && Math.abs(land.touch.spd) < 1,
    `함정과 나란히 날다 닿으면 갑판 위에서는 서 있다 (갑판 기준 ${land.touch.spd.toFixed(1)}kt)`);

  // ── 낮게 날아도 1인칭 화면이 뛰지 않는다 ──
  // 확대 단계마다 수심이 다른 지형 타일이 섞여 깔리는 동안에도 그려진 바다는 0m 이고
  // 카메라 높이가 그대로다(종전에는 0m 와 −30m 사이를 오가며 화면이 점멸했다).
  const steady = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window._pad = { index: 0, id: 'T', mapping: '', buttons: [], axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [window._pad];
    joyStop(); joyOn = true; joyAxSaved = true; joyAxes = {}; joyPoll(1000);
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 0; shipSpd = 0; updateShipMarker();
    if (!simModeOn) toggleSimMode(true);
    if (S.running) toggleSim();
    S.lat = 37.0 - 300 / 111320; S.lon = 126.0; S.hdg = 0; S.alt = 20; S.spd = 0; S.vs = 0; S.pit = 0; S.bnk = 0;
    const cam = [], terr = [];
    for (let i = 0; i < 40; i++) {
      _applyFollow(); await wait(100);
      cam.push(_ml3d.transform.getCameraAltitude());
      terr.push(_ml3d.queryTerrainElevation([S.lon, S.lat]));
    }
    const p = _ml3d.project([shipLon, shipLat]), H = _ml3d.getCanvas().clientHeight;
    toggleSimMode(false);
    return { camMin: Math.min(...cam), camMax: Math.max(...cam), terrMin: Math.min(...terr), terrMax: Math.max(...terr),
             shipY: p.y, H };
  });
  t.ok(steady.terrMin === 0 && steady.terrMax === 0,
    `그려진 바다는 늘 0m 다 (${steady.terrMin.toFixed(1)} … ${steady.terrMax.toFixed(1)}m)`);
  t.ok(steady.camMax - steady.camMin < 0.5 && Math.abs(steady.camMin - (20 * 0.3048 + 3)) < 0.5,
    `20ft 로 떠 있는 동안 카메라 높이(기체 + 3m)가 뛰지 않는다 (${steady.camMin.toFixed(1)} … ${steady.camMax.toFixed(1)}m)`);
  t.ok(steady.shipY > 0 && steady.shipY < steady.H,
    `300m 앞 수면의 함정이 화면 안에 있다 (y ${steady.shipY.toFixed(0)} / ${steady.H})`);

  // ── CHIN BUBBLE — SIM 1인칭에서 3D 창 아래 좌·우 모서리에 발밑 창을 겹쳐 띄운다 ──
  // 정면 시야는 창 가득 그대로 두고(전방을 넓게), 두 창은 좌·우 가장자리에 붙어 그 위에
  // 겹친다 — 크기는 종전(아래 1/3 을 반씩)의 2/3. 헬기 발밑의 둥근 창처럼 정면보다 더
  // 아래를 보고, 같은 바탕(위성·지형)과 함정을 그리며, 기체 자세를 따라 돈다.
  const chin = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = id => { const r = document.getElementById(id).getBoundingClientRect();
                        return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 0; shipSpd = 0; updateShipMarker();
    if (!simModeOn) toggleSimMode(true);
    if (!chinViewOn) { chinL = true; chinR = true; chinViewOn = true; try { syncChinView(); } catch (e) {} }   // CHIN 창은 처음에 꺼져 있다 — 켜고 본다
    if (S.running) toggleSim();
    S.lat = 37.0 - 60 / 111320; S.lon = 126.0; S.hdg = 0; S.alt = 150; S.spd = 0; S.vs = 0; S.pit = 0; S.bnk = 0;
    _applyFollow();
    let n = 0;
    while ((_chinMaps.length < 2 || !_chinMaps.every(c => c.ship)) && n < 200) { await wait(50); n++; _applyFollow(); }
    await wait(100); _applyFollow();
    const out = { n: _chinMaps.length, ship: _chinMaps.map(c => !!c.map.getLayer('ship-3d')),
                  main: box('map3d'), row: box('chin-row'), l: box('chin-l'), r: box('chin-r'),
                  rowShown: getComputedStyle(document.getElementById('chin-row')).display,
                  rowPe: getComputedStyle(document.getElementById('chin-row')).pointerEvents,
                  btn: getComputedStyle(document.getElementById('chin-btn')).display,
                  ctrl: (() => { const e = document.querySelector('#map3d .maplibregl-ctrl-bottom-left'); if (!e) return null;
                                 const r = e.getBoundingClientRect(); return { b: r.bottom, h: r.height }; })(),
                  tilt: (() => { const r = document.getElementById('tilt-ctrl').getBoundingClientRect(); return { b: r.bottom, h: r.height }; })(),
                  mainPitch: _ml3d.getPitch(), mainH: _ml3d.transform.height,
                  cam: _chinMaps.map(c => ({ side: c.side, pitch: c.map.getPitch(), bearing: c.map.getBearing() })) };
    // 함정이 발밑 창에도 보인다(앞 60m 의 함정 — 갑판 높이)
    out.shipIn = _chinMaps.map(c => {
      const p = c.map.project([shipLon, 37.0 - 40 / 111320]), cv = c.map.getCanvas();
      return p.x > 0 && p.x < cv.clientWidth && p.y > 0 && p.y < cv.clientHeight;
    });
    // 오른쪽으로 20° 기울이면 오른쪽 창은 더 아래를, 왼쪽 창은 덜 아래를 본다
    // (CHIN 창은 화질에 따라 덜 자주 그리므로 여기서는 바로 그리게 한다)
    S.bnk = 20; _applyFollow(); _ml3dChinCamera(true);
    out.bank = _chinMaps.map(c => ({ side: c.side, pitch: c.map.getPitch() }));
    S.bnk = 0; _applyFollow(); _ml3dChinCamera(true);
    // 화질에 따라 CHIN 창을 덜 자주 그린다 — '하' 는 1초에 15번, '상' 은 매 프레임
    const moves = c => { let k = 0; const f = () => k++; c.map.on('move', f); return () => { c.map.off('move', f); return k; }; };
    const burst = () => {
      _ml3dChinCamera(true);
      const done = moves(_chinMaps[0]);
      for (let i = 0; i < 5; i++) { S.hdg = (S.hdg + 1) % 360; _ml3dChinCamera(); }
      return done();
    };
    setMap3dQuality('low'); await wait(400); _applyFollow();
    out.throttle = { low: burst() };
    setMap3dQuality('high'); await wait(400); _applyFollow();
    out.throttle.high = burst();
    setMap3dQuality('mid'); await wait(400); S.hdg = 0; _applyFollow();
    out.chinRatio = _chinMaps.map(c => c.map.getPixelRatio());
    // CHIN 버튼으로 끄고 켠다
    toggleChinView(); await wait(50);
    out.off = { n: _chinMaps.length, main: box('map3d'), rowShown: getComputedStyle(document.getElementById('chin-row')).display };
    toggleChinView(); await wait(50); _applyFollow();
    out.on = _chinMaps.length;
    // L CHIN 만 끄면 오른쪽만 남는다 · 둘 다 끄면 닫힌다
    const vis = id => getComputedStyle(document.getElementById(id)).visibility;
    toggleChinView('L'); await wait(50);
    out.lr = { l: vis('chin-l'), r: vis('chin-r'), n: _chinMaps.length,
               lBtn: document.getElementById('chin-l-btn').classList.contains('on') };
    toggleChinView('R'); await wait(50); out.lr.none = _chinMaps.length;
    toggleChinView('L'); toggleChinView('R'); await wait(50); _applyFollow();
    // SIM 이면 축척·3D 확대 버튼이 감춰지고, 버튼 묶음은 접었다 편다
    const sc = document.querySelector('#map3d .vfr-scale');
    out.ui = { scale: sc ? getComputedStyle(sc).display : 'none',
               tilt: getComputedStyle(document.getElementById('tilt-ctrl')).display };
    toggleCtl3d(); out.ui.fold = getComputedStyle(document.getElementById('ctl3d-body')).display;
    toggleCtl3d(); out.ui.unfold = getComputedStyle(document.getElementById('ctl3d-body')).display;
    // 창이 낮으면 묶음 안에서 스크롤해 아래 버튼까지 누른다
    { const box = document.getElementById('ctl3d'), body = document.getElementById('ctl3d-body');
      const h0 = box.style.maxHeight; box.style.maxHeight = '200px';
      body.scrollTop = 0; body.scrollTop = 9999;
      const last = [...body.children].reverse().find(e => e.offsetParent), r = last.getBoundingClientRect(), br = box.getBoundingClientRect();
      out.ui.scroll = { ov: getComputedStyle(body).overflowY, over: body.scrollHeight > body.clientHeight, top: body.scrollTop,
                        inBox: r.bottom <= br.bottom + 1 && r.top >= br.top };
      body.scrollTop = 0; box.style.maxHeight = h0; }
    // SIM 을 끄면 닫힌다
    toggleSimMode(false); await wait(50);
    out.exit = { n: _chinMaps.length, cls: document.getElementById('map3d').classList.contains('chin-on'),
                 rowShown: getComputedStyle(document.getElementById('chin-row')).display,
                 btn: getComputedStyle(document.getElementById('chin-btn')).display };
    return out;
  });
  t.eq(chin.n, 2, 'SIM 1인칭에서 3D 창 아래에 CHIN 창 두 개가 열린다');
  t.ok(chin.rowShown === 'flex' && chin.btn !== 'none', `CHIN 창과 CHIN 버튼이 보인다 (${chin.rowShown} · ${chin.btn})`);
  t.ok(chin.lr.l === 'hidden' && chin.lr.r === 'visible' && chin.lr.n === 2 && !chin.lr.lBtn,
    `L CHIN 을 끄면 오른쪽 창만 보인다 (${chin.lr.l} · ${chin.lr.r})`);
  t.eq(chin.lr.none, 0, 'L·R CHIN 을 모두 끄면 CHIN 창이 닫힌다');
  t.ok(chin.ui.scale === 'none' && chin.ui.tilt === 'none', `SIM 에서는 축척·3D 확대/기울기 버튼이 없다 (${chin.ui.scale} · ${chin.ui.tilt})`);
  t.ok(chin.ui.fold === 'none' && chin.ui.unfold === 'flex', '3D 버튼 묶음을 접고 편다');
  t.ok(chin.ui.scroll.ov === 'auto' && chin.ui.scroll.over && chin.ui.scroll.top > 0 && chin.ui.scroll.inBox,
    `창이 낮아 버튼이 넘치면 묶음 안에서 스크롤해 맨 아래 버튼까지 보인다 (${JSON.stringify(chin.ui.scroll)})`);
  const M = chin.main, mBot = M.y + M.h;
  t.ok(Math.abs(chin.mainH - M.h) < 2 && Math.abs(chin.off.main.h - M.h) < 1,
    `정면 시야는 창 가득 그대로다 — CHIN 을 켜도 줄지 않는다 (${M.h.toFixed(0)}px · 끄면 ${chin.off.main.h.toFixed(0)}px)`);
  t.ok(Math.abs(chin.l.x - M.x) < 1 && Math.abs(chin.r.x + chin.r.w - (M.x + M.w)) < 1,
    `좌·우 가장자리에 붙는다 (왼쪽 ${(chin.l.x - M.x).toFixed(1)} · 오른쪽 ${(M.x + M.w - chin.r.x - chin.r.w).toFixed(1)}px)`);
  t.ok(Math.abs(chin.l.y + chin.l.h - mBot) < 1 && Math.abs(chin.r.y + chin.r.h - mBot) < 1 && chin.l.y > M.y + M.h / 2,
    '정면 시야의 아래 모서리 위에 겹친다');
  // 종전 한 창 = 너비 (W − 18)/2 · 높이 H/3 − 10 → 그 2/3
  const oldW = (M.w - 18) / 2, oldH = M.h / 3 - 10;
  t.ok(Math.abs(chin.l.w / oldW - 2 / 3) < 0.02 && Math.abs(chin.r.w - chin.l.w) < 1 && Math.abs(chin.l.h / oldH - 2 / 3) < 0.05,
    `크기는 종전의 2/3 (${chin.l.w.toFixed(0)}×${chin.l.h.toFixed(0)}px · 종전 ${oldW.toFixed(0)}×${oldH.toFixed(0)}px)`);
  t.ok(chin.r.x - (chin.l.x + chin.l.w) > M.w * 0.25,
    `가운데 앞쪽 아래는 가리지 않는다 (사이 ${(chin.r.x - chin.l.x - chin.l.w).toFixed(0)}px)`);
  t.eq(chin.rowPe, 'none', '겹친 줄이 정면 지도의 손 입력을 막지 않는다');
  t.ok(chin.ctrl && chin.ctrl.b <= chin.r.y + 1 && chin.tilt.b <= chin.r.y + 1,
    `3D 확대·기울기 버튼은 CHIN 창 위로 올라간다 (버튼 아래 ${chin.ctrl && chin.ctrl.b.toFixed(0)} · ${chin.tilt.b.toFixed(0)} ≤ 창 위 ${chin.r.y.toFixed(0)})`);
  const cl = chin.cam.find(c => c.side < 0), cr = chin.cam.find(c => c.side > 0);
  const nA = d => ((d % 360) + 540) % 360 - 180;
  t.ok(chin.mainPitch - cl.pitch > 40 && chin.mainPitch - cr.pitch > 40,
    `정면보다 50° 아래를 본다 (정면 ${chin.mainPitch.toFixed(0)}° · CHIN ${cl.pitch.toFixed(0)}° / ${cr.pitch.toFixed(0)}°)`);
  t.ok(nA(cl.bearing) < -5 && nA(cr.bearing) > 5,
    `왼쪽 창은 왼쪽 앞, 오른쪽 창은 오른쪽 앞을 본다 (${nA(cl.bearing).toFixed(0)}° · ${nA(cr.bearing).toFixed(0)}°)`);
  t.ok(chin.ship.every(Boolean) && chin.shipIn.some(Boolean),
    `함정도 CHIN 창에 그린다 (레이어 ${chin.ship} · 화면 안 ${chin.shipIn})`);
  const bl = chin.bank.find(c => c.side < 0), br = chin.bank.find(c => c.side > 0);
  // (오른쪽 창은 이미 거의 아래를 보고 있어 조금만 더 내려가고, 왼쪽 창은 눈에 띄게 들린다)
  t.ok(br.pitch < cr.pitch - 0.5 && bl.pitch > cl.pitch + 5,
    `기체를 따라 돈다 — 오른쪽 뱅크면 오른쪽 창은 더 아래, 왼쪽 창은 덜 아래를 본다 ` +
    `(오른쪽 ${cr.pitch.toFixed(0)}→${br.pitch.toFixed(0)}° · 왼쪽 ${cl.pitch.toFixed(0)}→${bl.pitch.toFixed(0)}°)`);
  t.ok(chin.throttle.low === 0 && chin.throttle.high === 5,
    `화질 '하' 는 CHIN 창을 덜 자주 그리고 '상' 은 매번 그린다 (곧바로 5번 → 하 ${chin.throttle.low} · 상 ${chin.throttle.high})`);
  t.ok(chin.chinRatio.length === 2 && chin.chinRatio.every(r => r <= 1),
    `화질 '중' 의 CHIN 창은 1배 해상도까지만 그린다 (${chin.chinRatio.join(' · ')})`);
  t.ok(chin.off.n === 0 && chin.off.rowShown === 'none',
    'CHIN 버튼으로 끄면 발밑 창이 사라진다');
  t.eq(chin.on, 2, '다시 누르면 CHIN 창이 열린다');
  t.ok(chin.exit.n === 0 && !chin.exit.cls && chin.exit.rowShown === 'none' && chin.exit.btn === 'none',
    'SIM 을 끄면 CHIN 창과 버튼이 사라진다');

  // ── 끄면 3D 에서도 사라진다 ──
  const off = await page.evaluate(async () => {
    if (shipVisible) shipToggleOn();
    return { n: (await _ml3d.getSource('ship-3d').getData()).features.length,
             trail: (await _ml3d.getSource('ship-trail-3d').getData()).geometry.coordinates.length };
  });
  t.ok(off.n === 0 && off.trail === 0, '배 표시를 끄면 3D 모형과 항적도 사라진다');
  t.eq(page.errors.length, 0, `페이지 오류 없음${page.errors.length ? ' — ' + page.errors[0] : ''}`);

  // SHIP 메뉴 '항공기 위치' — 헬기를 갑판 착함 원에 앉힌 채로 SIM 시작
  const ph = await page.evaluate(async () => {
    if (simModeOn) toggleSimMode(false);
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 90; shipSpd = 0; updateShipMarker();
    // 날던 중(SIM · GSPD · CRHT 가 걸린 채)에 눌러도 갑판에 앉아 그대로 있어야 한다
    toggleSimMode(true); S.alt = 1500; S.spd = 100;
    try { toggleCrht(); } catch (e) {} try { if (!gspdOn) toggleGspd(); } catch (e) {}
    document.getElementById('ship-menu-heli').click();
    await new Promise(r => setTimeout(r, 200));
    const modes = { crht: crhtOn, gspd: gspdOn, alt: altHoldOn };
    S.running = true; S.lastT = null;
    let ts = performance.now(); S.lastT = ts;
    for (let i = 0; i < 60; i++) { ts += 50; simStep(ts); }
    S.running = false;
    const n = (S.lat - shipLat) * 111320, e = (S.lon - shipLon) * 111320 * Math.cos(shipLat * Math.PI / 180);
    const o = { sim: simModeOn, deck: simOnDeck(), alt: S.alt, floor: simFloorFt(), hdg: S.hdg, e, n, tq: S.tq, modes };
    toggleSimMode(false);
    return o;
  });
  t.ok(ph.sim && Math.abs(ph.alt - 7 / 0.3048) < 0.6 && Math.abs(ph.e + 30) < 1 && Math.abs(ph.n) < 1 && ph.hdg === 90 && ph.deck && !ph.modes.crht && !ph.modes.gspd && !ph.modes.alt,
    `'항공기 위치' — 날던 중에 눌러도 상위모드를 풀고 착함 원(30m 뒤)에 함정 기수방향으로 앉은 채 있다 (갑판 ${ph.alt.toFixed(1)}ft · 함미 쪽 ${(-ph.e).toFixed(1)}m)`);

  // SHIP 버튼으로 메뉴를 닫으면 배 설정창도 함께 닫힌다
  const sc = await page.evaluate(() => {
    const m = document.getElementById('ship-menu'), p = document.getElementById('ship-panel');
    m.classList.remove('open'); toggleShip3d(); openShipPanel();
    const o = { open: m.classList.contains('open'), panel: p.style.display };
    toggleShip3d();
    o.after = { open: m.classList.contains('open'), panel: p.style.display };
    return o;
  });
  t.ok(sc.open && sc.panel === 'block' && !sc.after.open && sc.after.panel === 'none', 'SHIP 버튼으로 메뉴를 닫으면 배 설정창도 함께 닫힌다');

  // 함정 TACAN(I-SHP · 110X) — 국이 함정을 따라 움직이고, 코스는 함정 침로
  const tac = await page.evaluate(async () => {
    if (simModeOn) toggleSimMode(false);
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 90; shipSpd = 0; updateShipMarker();
    setNavRadio('NAV1', '110X', null); setNavSrc('NAV1');
    const o = { id: navRadios.NAV1.id, ship: navRadios.NAV1.ship, lat0: navLat - shipLat };
    shipLat += 0.01; shipHdg = 120; shipTacanSync();
    o.follow = Math.abs(navLat - shipLat) < 1e-9 && Math.abs(normAS(vorObsCrs - 120)) < 0.01;
    // 붉은 판독이 I-SHP 를 가리킨다
    const texts = [], orig = ctx.fillText;
    ctx.fillText = function (t, ...a) { texts.push(String(t)); return orig.call(this, t, ...a); };
    const hp0 = hoverPageOn; hoverPageOn = true;                       // 붉은 지시는 HOVER PAGE 에 있다
    try { drawPFD(); } finally { ctx.fillText = orig; hoverPageOn = hp0; }
    o.red = texts.some(t => /^I-SHP\s+R\d{3}/.test(t)); o.noShip = !texts.some(t => /^SHIP\s+R/.test(t));
    setNavSrc('FMS'); setNavRadio('NAV1', '115.50', 'SEL');
    return o;
  });
  t.ok(tac.id === 'I-SHP' && tac.ship && Math.abs(tac.lat0) < 1e-9, `110X 로 함정 TACAN(I-SHP)이 잡힌다 (${tac.id})`);
  t.ok(tac.follow, '함정이 움직이고 돌면 국 위치와 코스(함정 침로)가 따라간다');
  t.ok(tac.red && tac.noShip, 'HSI 의 따로 그리던 함정 표시는 없고, 붉은 판독이 I-SHP 를 가리킨다');

  // 함정 TACAN 으로 NAV 를 걸면 함정 뒤 접근로로 들어가 함정까지 따라간다(앞·옆에서 시작해도)
  const tnav = await page.evaluate(() => {
    const run = (distNM, offNM, spd, sec) => {
      if (simModeOn) toggleSimMode(false);
      if (!shipVisible) shipToggleOn();
      shipLat = 37.0; shipLon = 126.0; shipHdg = 90; shipSpd = spd; updateShipMarker();
      const p = destPoint(37.0, 126.0, 270, distNM), q = destPoint(p[0], p[1], 0, offNM);
      S.lat = q[0]; S.lon = q[1]; S.hdg = 90; S.alt = 1500; S.spd = 100; S.bnk = 0; windSpd = 0;
      setNavRadio('NAV1', '110X', null); setNavSrc('NAV1'); shipTacanSync();
      if (navApOn) toggleNavAp(); toggleNavAp();
      let reach = null, minEarly = 99; const phases = new Set();
      S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 0; i < sec * 20 && reach === null; i++) {
        ts += 50; simStep(ts);
        const d = distance(S.lat, S.lon, shipLat, shipLon), ph = shipNavPhase(); phases.add(ph);
        if (ph === 'ABEAM' || ph === 'GATE') minEarly = Math.min(minEarly, d);
        if (d < 0.2) reach = { t: Math.round(i / 20), xtk: Math.abs(courseXtk(activeCourseLine())), hdg: Math.round(S.hdg) };
      }
      S.running = false;
      if (navApOn) toggleNavAp();
      return { reach, minEarly, phases: [...phases] };
    };
    const o = { astern: run(6, 1, 15, 300), ahead: run(-4, 0.5, 15, 420), abeam: run(0, 3, 10, 420) };
    setNavSrc('FMS'); setNavRadio('NAV1', '115.50', 'SEL'); shipSpd = 0;
    return o;
  });
  t.ok(tnav.astern.reach && tnav.astern.reach.xtk < 0.05 && Math.abs(tnav.astern.reach.hdg - 90) < 5,
    `함정 TACAN NAV — 함정 뒤에서 코스선(함정 침로)에 붙어 함정까지 따라간다(1.5NM 안에서도 놓지 않는다) (${tnav.astern.reach && tnav.astern.reach.t}초)`);
  t.ok(tnav.ahead.reach && tnav.ahead.minEarly > 0.8 && tnav.ahead.phases.includes('ABEAM') && tnav.ahead.phases.includes('GATE'),
    `함정 앞에서 걸면 함정 위를 넘지 않고 옆(1.2NM)을 지나 뒤 관문(2NM)으로 돌아 들어간다 (가장 가까이 ${tnav.ahead.minEarly.toFixed(2)}NM · ${tnav.ahead.reach && tnav.ahead.reach.t}초)`);
  t.ok(tnav.abeam.reach, `함정 옆(3NM)에서 걸어도 뒤로 돌아 함정까지 온다 (${tnav.abeam.reach && tnav.abeam.reach.t}초)`);

  // 롤·피칭 · 난이도
  const mot = await page.evaluate(() => {
    shipLat = 37.0; shipLon = 126.0; shipHdg = 0; shipSpd = 10; updateShipMarker();
    const n0 = SHIP3D_PARTS.length;
    shipRollAmp = 10; shipPitchAmp = 5; shipMotT = SHIP_ROLL_T / 4;      // 롤이 우현으로 다 기운 때
    const m = shipMotion();
    const at = (x, f) => shipDeckTopM(shipLat + f / 111320, shipLon + x / (111320 * Math.cos(shipLat * Math.PI / 180)));
    const o = { roll: m.roll, right: at(8, -30), left: at(-8, -30), n: _ship3dGeo().features.length, n0,
                layer: !!(_ml3d && _ml3d.getLayer('ship-3d-model')), tri: _ship3dBuildMesh().length / 30 };
    shipRollAmp = 0; shipPitchAmp = 0; shipMotT = 0;
    shipSetLvl('HI'); let k = 0; const rnd = () => (k++ % 2 ? 0.9 : 0.1);
    for (let i = 0; i < 400; i++) shipVarStep(0.5, rnd);
    o.var = shipSpdNow(); shipSetLvl('LO'); o.lo = shipSpdNow(); shipSpd = 0;
    return o;
  });
  t.ok(Math.abs(mot.roll - 10) < 0.01 && mot.left - mot.right > 2.5,
    `롤 10° 면 우현 갑판이 내려간다 (좌 ${mot.left.toFixed(1)} · 우 ${mot.right.toFixed(1)}m)`);
  t.ok(mot.layer && mot.tri > 100 && mot.n === mot.n0,
    `흔들려도 칸으로 자르지 않고 한 덩어리 3D 모형(${mot.tri}삼각형)을 통째로 기울여 그린다 (면 ${mot.n0} 그대로)`);
  // 갑판에 앉은 헬기 — 자세(계기)·높이가 갑판과 한 몸으로 흔들린다 · 수평 지시등
  const dk = await page.evaluate(async () => {
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 90; shipSpd = 0; updateShipMarker();
    shipRollAmp = 10; shipPitchAmp = 5; shipMotT = 0;               // 흔들리는 함정에 앉힌다
    toggleSimMode(true);
    document.getElementById('ship-menu-heli').click();
    await new Promise(r => setTimeout(r, 200));
    S.running = true; let ts = performance.now(); S.lastT = ts;
    let worst = { bank: 0, pitch: 0, alt: 0 }, minB = 0, maxB = 0;
    for (let i = 0; i < 300; i++) {
      ts += 50; simStep(ts);
      const d = shipDeckAttitude(S.hdg);
      worst.bank = Math.max(worst.bank, Math.abs(S.bnk - d.bank));
      worst.pitch = Math.max(worst.pitch, Math.abs(S.pit - d.pitch));
      worst.alt = Math.max(worst.alt, Math.abs(S.alt - simDeckFt()) * 0.3048);
      minB = Math.min(minB, S.bnk); maxB = Math.max(maxB, S.bnk);
    }
    S.running = false;
    const o = { worst, minB, maxB, deck: simOnDeck(), hrs: _shipHrsMesh().length / 360, n: SHIP_HRS_N };
    shipRollAmp = 0; shipPitchAmp = 0; shipMotT = 0;
    toggleSimMode(false);
    return o;
  });
  t.ok(dk.deck && dk.worst.bank < 0.01 && dk.worst.pitch < 0.01 && dk.minB < -9 && dk.maxB > 9,
    `갑판에 앉아 있으면 자세(ADI)가 갑판 롤·피칭 그대로 흔들린다 (뱅크 ${dk.minB.toFixed(1)}~${dk.maxB.toFixed(1)}° · 어긋남 ${dk.worst.bank.toFixed(3)}°)`);
  t.ok(dk.worst.alt < 0.01, `갑판이 오르내려도 헬기 높이가 갑판에 붙어 있다 (최대 어긋남 ${dk.worst.alt.toFixed(3)}m)`);
  t.ok(dk.n === 20 && dk.hrs === 21, `함교 뒷면 수평 지시등 — 전구 ${dk.n}개 + 받침 (${dk.hrs}상자)`);
  t.ok(Math.abs(mot.var - 10) > 0.5 && Math.abs(mot.var - 10) <= 2 && mot.lo === 10, `난이도 상은 ±2kt 안에서 속도가 흔들리고 하는 그대로 (${mot.var.toFixed(1)} · ${mot.lo}kt)`);
}
