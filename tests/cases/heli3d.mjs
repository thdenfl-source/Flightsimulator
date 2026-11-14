// 흰수리 3D 모형 — 실제 크기(전장 20m)로 3D 지도에 그린다 · SIM 외부 시점
//
// 치수는 모형 자료로 직접 잰다. 도색은 위에서 내려다본 화면을 찍어 그 자리의 색으로
// 본다(엔진 덮개 빨강 · 노랑 띠 · 파란 꼬리 붐 · 흰 연료탱크).
export const name = '흰수리 3D 모형';

const HELI_MARK = 14;   // 이보다 작게 보이면 삼각형 표식도 띄운다(HELI3D_MARKER_PX)

// 화면을 찍어 주어진 화면 좌표들의 색을 읽는다(PNG 는 페이지 안에서 풀어 읽는다)
async function pixels(page, box, pts) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async ({ png, pts }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + png;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return pts.map(([x, y]) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)));
  }, { png, pts });
}

export async function run(page, t) {
  // ── 치수 — 주로터 앞 끝에서 꼬리로터 뒤 끝까지 20m, 원점이 그 한가운데 ──
  const dim = await page.evaluate(() => {
    const b = _h3BuildBody();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < b.length; i += 10) {
      x0 = Math.min(x0, b[i]); x1 = Math.max(x1, b[i]);
      y0 = Math.min(y0, b[i + 1]); y1 = Math.max(y1, b[i + 1]);
      z0 = Math.min(z0, b[i + 2]); z1 = Math.max(z1, b[i + 2]);
    }
    const front = Math.max(x1, HELI3D_ROTOR.x + HELI3D_ROTOR.r);
    const rear = Math.min(x0, HELI3D_TAIL.x - HELI3D_TAIL.r);
    return { front, rear, len: front - rear, fuse: x1 - x0, width: y1 - y0, z0, z1,
             rotorD: HELI3D_ROTOR.r * 2, tailD: HELI3D_TAIL.r * 2, rotorZ: HELI3D_ROTOR.z,
             acLen: SIM_AC_LEN, tris: b.length / 30 };
  });
  t.ok(Math.abs(dim.len - 20) < 0.05, `전장(주로터 앞 끝 ~ 꼬리로터 뒤 끝)이 20m 다 (${dim.len.toFixed(2)}m)`);
  t.ok(Math.abs(dim.front - 10) < 0.05 && Math.abs(dim.rear + 10) < 0.05,
    `원점이 전장의 한가운데다 — 착함 판정(${dim.acLen}m)과 같은 자리 (앞 ${dim.front.toFixed(2)} · 뒤 ${dim.rear.toFixed(2)}m)`);
  t.ok(dim.fuse > 18 && dim.fuse < 19.5, `동체 길이는 그림의 비율대로 (${dim.fuse.toFixed(2)}m)`);
  t.ok(dim.rotorD > 13.5 && dim.rotorD < 15 && dim.tailD > 2.6 && dim.tailD < 3.3,
    `주로터 지름 ${dim.rotorD.toFixed(1)}m · 꼬리로터 ${dim.tailD.toFixed(1)}m`);
  t.ok(Math.abs(dim.z0) < 0.02, `바퀴 바닥이 지면(0m)이다 (${dim.z0.toFixed(2)}m)`);
  t.ok(dim.rotorZ > dim.z1 - 0.5 && dim.rotorZ < 6, `주로터는 엔진 덮개 위에 있다 (로터 ${dim.rotorZ}m · 동체 꼭대기 ${dim.z1.toFixed(2)}m)`);
  t.ok(dim.width > 4 && dim.width < 5, `좌우 폭(연료탱크 포함)이 그림과 맞다 (${dim.width.toFixed(2)}m)`);
  // 꼬리로터는 오른쪽, 수평안정판은 왼쪽에만
  const tail = await page.evaluate(() => {
    const b = _h3BuildBody();
    let l = 0, r = 0;
    for (let i = 0; i < b.length; i += 10) {
      const x = b[i], y = b[i + 1], z = b[i + 2];
      if (x < -7 && x > -8 && Math.abs(z - 3.05) < 0.1) { if (y < -1.5) l++; if (y > 1.5) r++; }
    }
    return { ty: HELI3D_TAIL.y, l, r };
  });
  t.ok(tail.ty > 0.3, `꼬리로터는 오른쪽에 있다 (y ${tail.ty}m)`);
  t.ok(tail.l > 0 && tail.r === 0, `수평안정판은 왼쪽에만 있다 (왼쪽 꼭짓점 ${tail.l} · 오른쪽 ${tail.r})`);

  // ── 3D 지도에 얹힌다 ──
  const open = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    // 3D 화면 왼쪽 위에 겹치는 계기(07-sim.js)가 모형의 빛깔을 잴 자리를 가리지 않게 감춰 둔다
    window.__pfdOvWas = pfdOvOn; pfdOvOn = false; pfdOverlaySync();
    if (typeof simModeOn !== 'undefined' && simModeOn) toggleSimMode(false);
    if (mapHdgUp) toggleMapOrient();
    if (followMode) toggleFollow();
    S.lat = 37.0; S.lon = 126.0; S.hdg = 0; S.alt = 0; S.spd = 0; S.pit = 0; S.bnk = 0; bankTarget = 0;
    S.running = false;
    if (!_view3dOn) toggle3dMap();
    let n = 0;
    while (!(_ml3d && _ml3d.getLayer('heli-3d')) && n < 200) { await w(50); n++; }
    // 삼각형 표식은 지도가 다 뜬 뒤(load)에 생긴다 — 조금 더 기다려 본다
    n = 0; while (!_ml3dMarker && n < 100) { await w(50); n++; }
    return { layer: !!(_ml3d && _ml3d.getLayer('heli-3d')), shown: heli3dShown() };
  });
  t.ok(open.layer, '3D 지도에 흰수리 모형 레이어가 얹힌다');
  if (!open.layer) return;
  t.eq(open.shown, true, 'SIM 이 아닐 때는 모형을 그린다');

  // 위에서 내려다본 화면 — 기수가 화면 위(북)를 향한다
  const top = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    _ml3d.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    _ml3d.jumpTo({ center: [S.lon, S.lat], zoom: 20, pitch: 0, bearing: 0 });
    _update3dMarker(); _ml3d.triggerRepaint();
    await w(700);
    const b = document.getElementById('map3d').getBoundingClientRect();
    // 모형 좌표(앞 X · 오른쪽 Y, m) → 화면 좌표
    const at = (x, y) => {
      const p = _ml3d.project([S.lon + y / (111320 * Math.cos(S.lat * Math.PI / 180)), S.lat + x / 111320]);
      return [p.x, p.y];
    };
    return { box: { x: b.left, y: b.top, width: b.width, height: b.height },
             pts: { cowl: at(5.0, 0.55), yellow: at(-2.5, 0.5), blue: at(-5.5, 0), tank: at(0.3, 1.8), sea: at(0, 6.5) },
             len: heli3dScreenLen(), mk: _ml3dMarker ? _ml3dMarker.getElement().style.visibility : null };
  });
  const names = Object.keys(top.pts);
  const col = await pixels(page, top.box, names.map(k => top.pts[k]));
  const c = Object.fromEntries(names.map((k, i) => [k, col[i]]));
  const s = v => `rgb(${v.join(',')})`;
  t.ok(c.cowl[0] > 150 && c.cowl[1] < 100 && c.cowl[2] < 100, `엔진 덮개는 빨강이다 (${s(c.cowl)})`);
  t.ok(c.yellow[0] > 150 && c.yellow[1] > 110 && c.yellow[2] < 90, `동체 뒤쪽은 노랑 띠다 (${s(c.yellow)})`);
  t.ok(c.blue[2] > 90 && c.blue[2] > c.blue[0] + 40, `꼬리 붐은 파랑이다 (${s(c.blue)})`);
  t.ok(c.tank.every(v => v > 170), `연료탱크는 흰색이다 (${s(c.tank)})`);
  t.ok(!(c.sea[0] > 150 && c.sea[1] < 100), `모형 밖은 바탕 그대로다 (${s(c.sea)})`);
  t.ok(top.len > 100, `가까이 보면 실제 크기로 크게 보인다 (화면 ${top.len.toFixed(0)}px)`);
  // (타일을 못 받는 곳에서는 지도가 다 뜨지 않아 표식이 아직 없을 수 있다 — 그때는 거리만 본다)
  if (top.mk !== null) t.eq(top.mk, 'hidden', '모형이 충분히 크면 초록 삼각형 표식은 숨긴다');

  // 멀리서 보면 모형이 점만 해지므로 표식을 같이 띄운다
  const far = await page.evaluate(async () => {
    _ml3d.jumpTo({ center: [S.lon, S.lat], zoom: 12, pitch: 50, bearing: 0 });
    _update3dMarker();
    await new Promise(r => setTimeout(r, 200));
    return { len: heli3dScreenLen(), mk: _ml3dMarker ? _ml3dMarker.getElement().style.visibility : null };
  });
  t.ok(far.len < HELI_MARK && far.mk !== 'hidden', `멀면 삼각형 표식이 보인다 (모형 ${far.len.toFixed(1)}px · ${far.mk})`);

  // ── 자리·높이 — 지면 위 높이(AGL)만큼 떠서 그린다 ──
  const pose = await page.evaluate(() => {
    S.alt = 0; const g = heli3dPose();
    S.alt = 1000; const a = heli3dPose();
    S.alt = 0;
    return { g: g.agl, a: a.agl, da: a.alt - g.alt };
  });
  t.ok(pose.g === 0 && Math.abs(pose.a - 304.8) < 0.5 && Math.abs(pose.da - 304.8) < 0.5,
    `땅에 있으면 지면에, 1,000ft 면 304.8m 위에 그린다 (${pose.a.toFixed(1)}m)`);

  // ── 지형의 기복이 기체 높이를 흔들지 않는다 ──
  // 화면 속 높이 = 고도 + (그려진 땅 − 실제 땅). 괄호 안(지형 과장 몫·타일 바뀜)은
  // 천천히 따라가므로 능선을 넘거나 타일이 바뀌는 순간 기체(카메라)가 튀지 않는다.
  // 땅에 앉아 있을 때는 그려진 땅에 그대로 앉는다.
  const vis = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const q = _ml3d.queryTerrainElevation;
    let terr = 300;
    _ml3d.queryTerrainElevation = () => terr;
    const out = {};
    try {
      S.lat = 37.0; S.lon = 126.0; S.alt = 3000;
      _visOff = null;
      out.a0 = simVisAlt().alt;              // 그려진 땅 300m (실제 200m)
      terr = 600;                            // 능선 — 그려진 땅이 한순간에 600m
      out.a1 = simVisAlt().alt;
      await w(1000);
      out.a15 = simVisAlt().alt;             // 1초 뒤 — 따라가는 중
      await w(3500);
      out.a2 = simVisAlt().alt;              // 천천히 따라가 다 맞춘다
      terr = 900;                            // 같은 프레임에 두 번 재도(카메라 · 모형) 같은 값
      out.b1 = simVisAlt().alt; out.b2 = simVisAlt().alt;
      terr = 600; S.alt = 600 / MAP3D_EXAG / 0.3048;   // 땅 위(실제 땅 400m)
      out.gnd = simVisAlt();
    } finally { _ml3d.queryTerrainElevation = q; S.alt = 0; }
    return out;
  });
  t.ok(Math.abs(vis.a0 - 1014.4) < 1, `높이 = 고도(914m) + 그려진 땅 − 실제 땅 (${vis.a0.toFixed(1)}m)`);
  t.ok(Math.abs(vis.a1 - vis.a0) < 3, `능선을 넘는 순간 튀지 않는다 (${vis.a0.toFixed(1)} → ${vis.a1.toFixed(1)}m · 종전 +100m)`);
  t.ok(vis.a15 > vis.a1 + 20 && vis.a15 < 1110 && Math.abs(vis.a2 - 1114.4) < 6,
    `천천히 따라가 새 땅에 맞춘다 (1초 ${vis.a15.toFixed(1)} · 4.5초 ${vis.a2.toFixed(1)}m)`);
  t.ok(Math.abs(vis.b2 - vis.b1) < 0.5, '같은 프레임의 카메라와 모형은 같은 높이를 쓴다');
  t.ok(vis.gnd.agl < 0.01 && Math.abs(vis.gnd.alt - 600) < 0.01, `땅에 앉아 있으면 그려진 땅에 그대로 (${vis.gnd.alt.toFixed(1)}m)`);

  // ── SIM 1인칭 — 화면 아래 가운데로 기수가 보인다 ──
  const nose = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const el = document.getElementById('sim-nose');
    const out = { off: getComputedStyle(el).display };
    S.alt = 1000; S.spd = 80; S.hdg = 40;
    chinL = true; chinR = true; chinViewOn = true;     // CHIN 창은 처음에 꺼져 있다 — 조종사가 켜 둔 상태로 본다
    toggleSimMode(true); S.alt = 1000;
    await w(300);
    const box = () => {
      const m = document.getElementById('map3d').getBoundingClientRect(), b = el.getBoundingClientRect();
      return { shown: getComputedStyle(el).display !== 'none', h: b.height / m.height,
               cx: (b.left + b.width / 2 - m.left) / m.width, bottom: m.bottom - b.bottom };
    };
    out.fp = box();
    simLookHold(true); simLookDir = null; simLook.yaw = 40; simLook.pitch = 0;
    _ml3dSimCamera(); out.look = box();
    simLookHold(false); simLookReset(); _ml3dSimCamera();
    toggleExtView(true); await w(100); out.ext = box();
    toggleExtView(false); toggleSimMode(false); await w(100);
    out.exit = getComputedStyle(el).display;
    S.alt = 0; S.spd = 0; S.running = false;
    return out;
  });
  t.eq(nose.off, 'none', 'SIM 이 아니면 기수를 그리지 않는다');
  t.ok(nose.fp.shown && Math.abs(nose.fp.h - 0.1) < 0.01 && Math.abs(nose.fp.cx - 0.5) < 0.01 && Math.abs(nose.fp.bottom) < 1,
    `1인칭에서는 화면 아래 가운데에 높이 1/10 로 보인다 (높이 ${(nose.fp.h * 100).toFixed(1)}% · 가운데 ${(nose.fp.cx * 100).toFixed(0)}%)`);
  t.ok(nose.look.cx < 0.2, `오른쪽을 둘러보면 기수는 왼쪽으로 비켜 간다 (${(nose.look.cx * 100).toFixed(0)}%)`);
  t.ok(!nose.ext.shown && nose.exit === 'none', '외부 시점과 SIM 해제에서는 숨긴다');

  // ── SIM — 1인칭에서는 그리지 않고, EXT 를 누르면 뒤에서 따라가며 본다 ──
  const ext = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const btn = document.getElementById('ext-btn');
    const out = { off: { shown: getComputedStyle(btn).display } };
    S.alt = 1000; S.spd = 80; S.hdg = 40;
    toggleSimMode(true);
    S.alt = 1000; S.hdg = 40;
    await w(300);
    out.fp = { model: heli3dShown(), btn: getComputedStyle(btn).display, ext: simExtView };
    if (!pfdOvOn) togglePfdOverlay();
    btn.click();
    await w(300);
    out.ov = getComputedStyle(document.getElementById('pfd-ov')).display;
    out.on = { ext: simExtView, cls: btn.classList.contains('on'), model: heli3dShown(), chin: _chinMaps.length,
               chinOn: document.getElementById('map3d').classList.contains('chin-on') };
    // 카메라 자리 — 헬기 뒤(기수 방향의 반대)에서 내려다본다
    heli3dExtCamera();
    const cam = _ml3d.transform.getCameraLngLat(), camAlt = _ml3d.transform.getCameraAltitude();
    const pose = heli3dPose();
    const dn = (pose.lat - cam.lat) * 111320, de = (pose.lon - cam.lng) * 111320 * Math.cos(pose.lat * Math.PI / 180);
    out.cam = { horiz: Math.hypot(dn, de), brg: (Math.atan2(de, dn) * 180 / Math.PI + 360) % 360,
                above: camAlt - pose.alt, pitch: _ml3d.getPitch(), bearing: (_ml3d.getBearing() + 360) % 360 };
    // 외부 시점 카메라 버튼 — 1° 씩 돌고, 멀리 · 위아래, DEFAULT
    out.ecShow = getComputedStyle(document.getElementById('extcam-3d')).display;
    const camDist = () => { const c = _ml3d.transform.getCameraLngLat(), p = heli3dPose();
      return Math.hypot((p.lat - c.lat) * 111320, (p.lon - c.lng) * 111320 * Math.cos(p.lat * Math.PI / 180)); };
    heli3dExtCamera(); const b0 = (_ml3d.getBearing() + 360) % 360, d0 = camDist(), p0 = _ml3d.getPitch();
    for (let i = 0; i < 10; i++) extCamStep('R');
    extCamStep('OUT'); extCamStep('OUT'); extCamStep('U'); extCamStep('U');
    heli3dExtCamera();
    out.ec = { db: ((_ml3d.getBearing() - b0) + 540) % 360 - 180, farther: camDist() / d0, dp: _ml3d.getPitch() - p0 };
    extCamDefault(); heli3dExtCamera();
    out.ec.back = Math.abs((((_ml3d.getBearing() - b0) + 540) % 360) - 180);
    // 둘러보기 — 햇 ▶ 로 오른쪽 둘레로 돈다
    simLookHold(true); simLookDir = null;            // 누르고 있는 동안은 그 자리에 머문다
    simLook.yaw = 90; simLook.pitch = 0;
    heli3dExtCamera();
    out.look = (_ml3d.getBearing() + 360) % 360;
    simLookHold(false); simLookReset();
    // 한 번 더 누르면 1인칭으로 — CHIN 창이 돌아온다
    btn.click();
    await w(300 + SIM_CAM_TX_MS);                       // 조종석으로 들어가는 전환이 끝난 뒤
    out.back = { ext: simExtView, model: heli3dShown(), chin: _chinMaps.length };
    // 외부 시점에서 SIM 을 나가면 다음에는 1인칭부터
    toggleExtView(true);
    toggleSimMode(false);
    await w(100);
    out.exit = { ext: simExtView, model: heli3dShown(), btn: getComputedStyle(btn).display };
    out.joy = JOY_ACTIONS.some(a => a.id === 'extView');
    S.alt = 0; S.spd = 0; S.running = false;
    return out;
  });
  t.eq(ext.off.shown, 'none', 'SIM 이 아닐 때는 EXT 버튼이 없다');
  t.ok(ext.fp.btn !== 'none' && !ext.fp.ext && !ext.fp.model, 'SIM 1인칭 — EXT 버튼이 보이고, 눈이 기체 안이라 모형은 그리지 않는다');
  t.ok(ext.on.ext && ext.on.cls && ext.on.model, 'EXT 를 누르면 외부 시점 — 모형을 그린다');
  t.ok(ext.ov !== 'none', '외부 시점에서도 계기 ON 이면 계기(PFD 겹침)가 보인다');
  t.ok(ext.ecShow !== 'none', 'EXT 에서는 카메라 조작 버튼이 보인다');
  t.ok(Math.abs(ext.ec.db - 10) < 0.6 && ext.ec.farther > 1.1 && ext.ec.dp < 0 && ext.ec.back < 0.6,
    `◀▶ 1° 씩 돌고(10번 ${ext.ec.db.toFixed(1)}°) · 거리 + 로 멀어지고(×${ext.ec.farther.toFixed(2)}) · ▲ 로 더 내려다보고 · DEFAULT 로 돌아온다`);
  t.ok(ext.on.chin === 0 && !ext.on.chinOn, '외부 시점에서는 CHIN 창을 닫는다');
  t.ok(ext.cam.horiz > 25 && ext.cam.horiz < 200 && Math.abs(((ext.cam.brg - 40 + 540) % 360) - 180) < 3,
    `카메라는 헬기 뒤에 있다 (${ext.cam.horiz.toFixed(0)}m · 헬기 쪽 방위 ${ext.cam.brg.toFixed(0)}°)`);
  t.ok(ext.cam.above > 3 && ext.cam.pitch < 90 && Math.abs(ext.cam.bearing - 40) < 1,
    `조금 위에서 기수 방향으로 내려다본다 (위 ${ext.cam.above.toFixed(0)}m · 기울기 ${ext.cam.pitch.toFixed(0)}°)`);
  t.ok(Math.abs(((ext.look - 130 + 540) % 360) - 180) < 1, `둘러보기(◀▶)로 헬기 둘레를 돈다 (카메라 방위 ${ext.look.toFixed(0)}°)`);
  t.ok(!ext.back.ext && !ext.back.model && ext.back.chin === 2, '다시 누르면 1인칭 — CHIN 창이 돌아온다');
  t.ok(!ext.exit.ext && ext.exit.model && ext.exit.btn === 'none', 'SIM 을 나가면 외부 시점도 풀리고 3D 지도에 모형이 보인다');
  t.ok(ext.joy, '조이스틱 버튼에 「외부 시점」을 배정할 수 있다');
  await page.evaluate(() => { pfdOvOn = window.__pfdOvWas !== false; pfdOverlaySync(); });

  // ── 1인칭 ⇄ 외부 시점 전환 효과 — 뒤로 물러나며 헬기가 나오고, 조종석으로 빨려 들어간다 ──
  const tx = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (!simModeOn) toggleSimMode(true);
    if (!chinViewOn) { chinL = true; chinR = true; chinViewOn = true; try { syncChinView(); } catch (e) {} }   // 켜 둔 CHIN 창이 돌아오는지 본다
    if (simExtView) { toggleExtView(false); await wait(1300); }
    const camD = () => { const ll = _ml3d.transform.getCameraLngLat(); return distance(ll.lat, ll.lng, S.lat, S.lon) * 1852; };
    const run = async (to) => {
      _applyFollow(); await new Promise(r => requestAnimationFrame(r)); _applyFollow();
      const d0 = camD(); toggleExtView(to);
      const rec = [], t0 = performance.now();
      let state = { ext: simExtView, tx: !!simCamTx, model: heli3dShown(), nose: document.getElementById('sim-nose').classList.contains('show'), chin: _chinMaps.length };
      while (simCamTx && performance.now() - t0 < 3000) { await new Promise(r => requestAnimationFrame(r)); if (simCamTx) rec.push(camD()); }
      await wait(100);
      return { d0, rec, d1: camD(), state, end: { model: heli3dShown(), nose: document.getElementById('sim-nose').classList.contains('show'), chin: _chinMaps.length } };
    };
    const out = await run(true), back = await run(false);
    toggleSimMode(false);
    return { out, back, ms: SIM_CAM_TX_MS };
  });
  const mid = a => a.rec.filter(d => d > Math.min(a.d0, a.d1) + 1 && d < Math.max(a.d0, a.d1) - 1).length;
  t.ok(tx.out.state.ext && tx.out.state.tx && tx.out.state.model && !tx.out.state.nose && tx.out.d0 < 2 && tx.out.d1 > 20,
    `→ EXT: 시점은 곧바로 바뀌고 카메라가 조종석(${tx.out.d0.toFixed(0)}m)에서 헬기 뒤(${tx.out.d1.toFixed(0)}m)로 물러난다`);
  t.ok(mid(tx.out) >= 1 || tx.out.rec.length === 0, `그 사이를 부드럽게 지난다(중간 자리 ${mid(tx.out)}번)`);
  t.ok(!tx.back.state.ext && tx.back.state.tx && tx.back.state.model && !tx.back.state.nose && tx.back.state.chin === 0,
    '→ 1인칭: 조종석으로 들어가는 동안은 헬기 모형이 보이고, 기수·CHIN 창은 아직 없다');
  t.ok(tx.back.d0 > 20 && tx.back.d1 < 2 && !tx.back.end.model && tx.back.end.nose && tx.back.end.chin > 0,
    `조종석에 들어서면(${tx.back.d1.toFixed(0)}m) 모형이 사라지고 기수·CHIN 창이 열린다 (전환 ${tx.ms}ms)`);

  // ── 조종석 패널 — 1인칭에서 '조종석' 버튼으로 차양 · MFD 넷 · 콘솔을 겹친다(기수는 감춘다) ──
  const ck = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const btn = document.getElementById('ckpit-btn');
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const out = { offBtn: vis('ckpit-btn') };
    if (ckpitOn) toggleCockpitView();
    S.alt = 1000; S.spd = 80; chinL = true; chinR = true; chinViewOn = true;
    toggleSimMode(true); S.alt = 1000; await w(300);
    out.simBtn = vis('ckpit-btn'); out.offPanel = vis('sim-ckpit');
    btn.click(); await w(400);
    const d3 = document.getElementById('map3d');
    const row = document.getElementById('chin-row').getBoundingClientRect(), m = d3.getBoundingClientRect();
    const lit = [...document.querySelectorAll('#sim-ckpit canvas.ck-scr')].map(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
      return n;
    });
    const pg0 = sysPage; sysPageSet('map'); ckpitDraw(); out.pgKeep = sysPage === 'map'; sysPageSet(pg0);
    out.kinds = CKPIT_SCR.map(x => x.k).join(',');
    out.op = +getComputedStyle(document.querySelector('#sim-ckpit svg')).opacity;
    out.on = { panel: vis('sim-ckpit'), nose: vis('sim-nose'), label: btn.textContent, lit, chinTop: (row.top - m.top) / m.height };
    toggleExtView(true); await w(100); out.ext = vis('sim-ckpit');
    toggleExtView(false); await w(SIM_CAM_TX_MS + 300); out.back = vis('sim-ckpit');
    btn.click(); await w(100);
    out.off = { panel: vis('sim-ckpit'), nose: vis('sim-nose'), label: btn.textContent };
    toggleSimMode(false); await w(100); out.exit = vis('ckpit-btn');
    S.alt = 0; S.spd = 0; S.running = false;
    return out;
  });
  t.ok(!ck.offBtn && ck.simBtn && !ck.offPanel, '조종석 버튼은 SIM 에서만 보이고, 처음에는 꺼져 있다');
  t.ok(ck.on.panel && !ck.on.nose && ck.on.label === '조종석 ON' && ck.on.lit.length === 4 && ck.on.lit.every(n => n > 20),
    `켜면 패널이 겹치고 기수는 감춘다 — MFD 넷이 그려진다 (${ck.on.lit.join('/')})`);
  t.ok(ck.kinds === 'pfd,sys,map,pfd' && ck.pgKeep, `MFD(왼쪽부터) — PFD · CDU 가 고른 SYSTEM 화면 · 지도 · PFD (${ck.kinds})`);
  t.ok(ck.op > 0.2 && ck.op < 0.7, `스크린을 뺀 틀·구조는 반투명이다 (불투명도 ${ck.op})`);
  t.ok(Math.abs(ck.on.chinTop - 0.89) < 0.02, `CHIN 창은 패널 아래(발밑)로 내려간다 (${(ck.on.chinTop * 100).toFixed(0)}%)`);
  t.ok(!ck.ext && ck.back, '외부 시점에서는 숨기고, 조종석으로 돌아오면 다시 보인다');
  t.ok(!ck.off.panel && ck.off.nose && ck.off.label === '조종석 OFF' && !ck.exit, '끄면 패널이 사라지고 기수가 돌아온다 · SIM 을 끄면 버튼도 숨는다');

  // ── 조종석 안 작은 콘솔 · LowerC / UpperC 팝아웃 ──
  const con = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const par = id => (document.getElementById(id).parentElement || {}).id;
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const out = {};
    S.alt = 1000; S.spd = 80; toggleSimMode(true); S.alt = 1000; await w(300);
    if (!ckpitOn) toggleCockpitView();
    await w(300);
    out.btns = vis('lconc-btn') && vis('upperc-btn');
    out.mini = { l: par('lcon-wrap'), u: par('ovhd-wrap') };
    document.getElementById('lconc-btn').click(); await w(300);
    out.pop = { show: vis('ck-pop'), l: par('lcon-wrap'), u: par('ovhd-wrap'), title: document.getElementById('ck-pop-title').textContent };
    const ap = document.querySelector('#ck-pop [data-ov="ap1"]'), v0 = ovhdGet('ap1');
    const r = ap.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 };
    ap.dispatchEvent(new PointerEvent('pointerdown', o)); ap.dispatchEvent(new PointerEvent('pointerup', o)); await w(100);
    out.ap = { v0, v1: ovhdGet('ap1') };
    if (ovhdGet('ap1') !== v0) ovhdSet('ap1', v0);
    document.getElementById('upperc-btn').click(); await w(300);
    out.swap = { l: par('lcon-wrap'), u: par('ovhd-wrap'), title: document.getElementById('ck-pop-title').textContent };
    document.getElementById('upperc-btn').click(); await w(300);
    out.close = { show: vis('ck-pop'), u: par('ovhd-wrap') };
    toggleCockpitView(); await w(200);
    out.offMini = { l: par('lcon-wrap'), u: par('ovhd-wrap'), lHidden: document.getElementById('lcon-wrap').classList.contains('page-hidden') };
    toggleSimMode(false); await w(100);
    out.exit = vis('lconc-btn');
    S.alt = 0; S.spd = 0; S.running = false;
    return out;
  });
  t.ok(con.btns && con.mini.l === 'ck-mini-lcon' && con.mini.u === 'ck-mini-ovhd',
    `조종석 안 위 가운데에 상부 콘솔 · 아래 가운데에 하부 콘솔을 작게 얹는다 (${con.mini.u} · ${con.mini.l})`);
  t.ok(con.pop.show && con.pop.l === 'ck-pop-host' && con.pop.u === 'ck-mini-ovhd' && con.pop.title === 'LOWER CONSOLE',
    'LowerC — 하부 콘솔을 가운데에 크게 띄운다');
  t.ok(con.ap.v1 !== con.ap.v0, `팝아웃에서 스위치를 조작할 수 있다 (AP1 ${con.ap.v0} → ${con.ap.v1})`);
  t.ok(con.swap.u === 'ck-pop-host' && con.swap.l === 'ck-mini-lcon' && con.swap.title === 'UPPER CONSOLE',
    'UpperC — 상부 콘솔로 바꿔 띄우고, 하부 콘솔은 조종석 자리로 돌아간다');
  t.ok(!con.close.show && con.close.u === 'ck-mini-ovhd', '다시 누르면 닫히고 콘솔은 조종석 자리로');
  t.ok(con.offMini.lHidden && !con.exit, '조종석을 끄면 작은 콘솔도 감추고, SIM 을 끄면 버튼도 숨는다');

  // ── MFD 화면(PFD · SYSTEM · 지도)도 누르면 크게 띄운다 ──
  const mfd = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const par = id => (document.getElementById(id).parentElement || {}).id;
    const out = {};
    const solo0 = _soloActive && _soloCurrent === 'm3d';
    if (!solo0) setSolo('m3d');
    S.alt = 1000; S.spd = 80; toggleSimMode(true); S.alt = 1000; await w(300);
    if (!ckpitOn) toggleCockpitView();
    await w(300);
    for (const [i, k, id] of [[0, 'pfd', 'pfd-wrap'], [1, 'sysp', 'sysp-wrap'], [2, 'map', 'map-wrap']]) {
      document.querySelector(`#sim-ckpit canvas.ck-scr[data-i="${i}"]`).click(); await w(400);
      const el = document.getElementById(id);
      out[k] = { pop: ckConPop, par: par(id), h: el.clientHeight, title: document.getElementById('ck-pop-title').textContent };
    }
    out.pfdH = document.getElementById('pfd-wrap').clientHeight;
    toggleConsolePop(null); await w(300);
    out.close = { pop: ckConPop, show: document.getElementById('ck-pop').classList.contains('show') };
    toggleCockpitView(); toggleSimMode(false); await w(100);
    if (!solo0) exitSolo();
    S.alt = 0; S.spd = 0; S.running = false;
    await w(200);
    return out;
  });
  for (const [k, title] of [['pfd', 'PFD'], ['sysp', 'SYSTEM'], ['map', 'MAP']])
    t.ok(mfd[k].pop === k && mfd[k].par === 'ck-pop-host' && mfd[k].h > 200 && mfd[k].title === title,
      `MFD 를 누르면 ${title} 창을 크게 띄운다 (높이 ${mfd[k].h}px)`);
  t.ok(mfd.pfdH === 0 && !mfd.close.show && mfd.close.pop === null, '다른 화면으로 바꾸면 앞 화면은 감추고, ✕ 로 닫는다');

  // ── CDU — 3D 단독 화면에서 하부 콘솔 오른쪽에 작게 두고, 누르면 다른 화면처럼 가운데에 크게 띄워 조작한다 ──
  const cdu0 = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    enterSolo('m3d'); await w(400);
    S.alt = 1000; S.spd = 80; toggleSimMode(true); S.alt = 1000; await w(300);
    if (!ckpitOn) toggleCockpitView();
    await w(500);
    try { switchMode('HOME'); } catch (e) { /* 없으면 그만 */ }
    await w(200);
    const ov = document.getElementById('cdu-ov');
    const slot = document.getElementById('ck-mini-cdu').getBoundingClientRect(), lc = document.getElementById('ck-mini-lcon').getBoundingClientRect();
    return { par: ov && ov.parentElement.id, wrap: document.getElementById('cdu-wrap').parentElement.id, btn: document.getElementById('cduov-btn').classList.contains('on'),
             right: slot.left > lc.left + lc.width / 2 && slot.left < lc.right + 30 };
  });
  // 작은 CDU 의 아이콘은 제 칸 안에 작게(조종석 틀 그림의 반투명 · 가득 채우기가 CDU 아이콘에 번지지 않는다)
  const ico = await page.evaluate(() => {
    const slot = document.getElementById('ck-mini-cdu').getBoundingClientRect();
    const svgs = [...document.querySelectorAll('#ck-mini-cdu .home-icon-wrapper svg')];
    return { n: svgs.length, maxW: Math.max(0, ...svgs.map(e => e.getBoundingClientRect().width)) / slot.width,
             op: svgs.length ? +getComputedStyle(svgs[0]).opacity : 1 };
  });
  t.ok(ico.n > 4 && ico.maxW < 0.25 && ico.op === 1, `작은 CDU 아이콘이 엉키지 않는다 (가장 큰 아이콘 너비 ${(ico.maxW * 100).toFixed(0)}% · 불투명도 ${ico.op})`);
  t.ok(cdu0.par === 'ck-mini-cdu' && cdu0.wrap === 'cdu-ov' && !cdu0.btn && cdu0.right,
    `CDU 가 하부 콘솔 바로 오른쪽 칸에 들어간다 (${cdu0.par})`);
  // 작은 CDU 를 실제로 누르면 팝아웃 — 그 안의 PERF 를 실제로 누르면 CDU 화면이 바뀐다
  const mb = await page.locator('#ck-mini-cdu').boundingBox();
  await page.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2); await page.waitForTimeout(400);
  const popc = await page.evaluate(() => ({ pop: ckConPop, par: document.getElementById('cdu-ov').parentElement.id, title: document.getElementById('ck-pop-title').textContent }));
  t.ok(popc.pop === 'cdu' && popc.par === 'ck-pop-host' && popc.title === 'CDU', `작은 CDU 를 누르면 가운데에 크게 띄운다 (${popc.par})`);
  const perf = page.locator('#ck-pop [data-act="switchMode"][data-arg=\'["PERF"]\']').first();
  const html0 = await page.evaluate(() => document.getElementById('cdu-wrap').innerHTML.length);
  const pb = await perf.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.waitForTimeout(300);
  const html1 = await page.evaluate(() => document.getElementById('cdu-wrap').innerHTML.length);
  t.ok(html1 !== html0, `팝아웃 CDU 의 PERF 를 누르면 CDU 화면이 바뀐다 (${html0} → ${html1})`);
  // 팝아웃은 3D 화면 안에 다 들어온다(아래가 잘리지 않는다) — SYSTEM · PFD 도
  const fit = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const L = document.getElementById('ck-layer').getBoundingClientRect();
    for (const k of ['sysp', 'pfd', 'cdu']) {
      if (ckConPop !== k) toggleConsolePop(k);
      await w(300);
      const r = document.getElementById('ck-pop').getBoundingClientRect();
      out[k] = { inside: r.top >= L.top - 1 && r.bottom <= L.bottom + 1 && r.left >= L.left - 1, ar: +(r.width / r.height).toFixed(2) };
      if (k === 'pfd') {   // PFD 창 그대로 — 계기 위 · 소프트키 · FCP 아래(옆으로 펴지 않는다 · 지도 칸 없음) · HSI 는 FCP 위까지 다 그린다
        await w(300);
        const pw = document.getElementById('pfd-wrap'), bar = pw.querySelector('.ctrl-bar');
        const L2 = pfdLayout(cvs.width, cvs.height, bar.offsetHeight), G = hsiGeom(L2.hsi.x, L2.hsi.y, L2.hsi.w, L2.hsi.h, cvs.width / 2);
        out.side = { cls: pw.classList.contains('fcp-side'), barBelow: Math.abs(L2.usableH + bar.offsetHeight - cvs.height) < 2,
                     hsiIn: G.cy + G.r <= L2.usableH + 1, map: document.getElementById('ck-pop-mapslot').classList.contains('show') };
      }
    }
    out.sideOff = document.getElementById('pfd-wrap').classList.contains('fcp-side');
    toggleConsolePop(null); await w(200);
    out.back = document.getElementById('cdu-ov').parentElement.id;
    return out;
  });
  t.ok(fit.sysp.inside && fit.pfd.inside && fit.cdu.inside && fit.pfd.ar > 0.9,
    `팝아웃은 3D 화면 안에 다 들어오고 PFD 는 옆으로 넓다 (SYSTEM ${fit.sysp.inside} · PFD 비율 ${fit.pfd.ar})`);
  t.ok(fit.back === 'ck-mini-cdu', '닫으면 CDU 는 하부 콘솔 오른쪽 칸으로 돌아간다');
  t.ok(!fit.side.cls && fit.side.barBelow && fit.side.hsiIn && !fit.side.map && !fit.sideOff,
    `PFD 팝아웃은 PFD 화면만 — FCP 는 아래, HSI 는 그 위에 다 보인다 · 지도 칸 없음 (${JSON.stringify(fit.side)})`);
  const cdu1 = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    openFlightPlan(); await w(300);
    const out = { solo: _soloActive && _soloCurrent, fp: document.getElementById('fp-wrap').parentElement.id };
    fpBackToCdu(); await w(200);
    toggleCockpitView(); await w(300);
    out.off = { par: (document.getElementById('cdu-ov') || {}).parentElement && document.getElementById('cdu-ov').classList.contains('show'), wrap: document.getElementById('cdu-wrap').parentElement.id };
    toggleSimMode(false); exitSolo(); await w(200);
    S.alt = 0; S.spd = 0; S.running = false;
    return out;
  });
  t.ok(cdu1.solo === 'm3d' && cdu1.fp === 'cdu-ov', `Flight Plan 도 그 칸 안에서 열리고 3D 화면은 그대로다 (${cdu1.solo} · ${cdu1.fp})`);
  t.ok(!cdu1.off.par && cdu1.off.wrap !== 'cdu-ov', '조종석을 끄면 CDU 는 제자리로 돌아간다');

  // ── 와이퍼 — 상부 콘솔 WINDSLD WIPER 를 따라 움직이고, WASH 는 와이퍼 전체에서 물이 나온다 ──
  const wip = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    enterSolo('m3d'); await w(300);
    S.alt = 1000; S.spd = 80; toggleSimMode(true); S.alt = 1000; await w(300);
    if (!ckpitOn) toggleCockpitView();
    await w(300);
    const st = () => { const l = document.getElementById('ck-wipe-l'); return { anim: getComputedStyle(l).animationName, dur: getComputedStyle(l).animationDuration, water: getComputedStyle(document.querySelector('#ck-wipe-l .ck-water')).display }; };
    const o = {};
    for (const v of ['OFF', 'LOW', 'HI', 'WASH']) { ovhdSet('wiper', v); await w(150); o[v] = st(); }
    ovhdSet('wiper', 'LOW'); await w(150);
    const a = getComputedStyle(document.getElementById('ck-wipe-l')).transform; await w(400);
    o.moves = getComputedStyle(document.getElementById('ck-wipe-l')).transform !== a;
    ovhdSet('wiper', 'OFF'); toggleCockpitView(); toggleSimMode(false); exitSolo(); await w(200);
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(wip.OFF.anim === 'none' && wip.LOW.anim === 'ckWipeL' && wip.HI.anim === 'ckWipeL' && parseFloat(wip.HI.dur) < parseFloat(wip.LOW.dur) && wip.moves,
    `와이퍼 — OFF 멈춤 · LOW ${wip.LOW.dur} · HI ${wip.HI.dur} 로 쓸어 움직인다`);
  t.ok(wip.WASH.anim === 'ckWipeL' && wip.WASH.water !== 'none' && wip.LOW.water === 'none', `WASH — 와이퍼 전체에서 물이 나오며 쓸린다(다른 자리에서는 물이 없다)`);

  // ── 조종석 투명도 −/+(10% 씩) · 화면 조종간 PEDAL 아래 시야 버튼 ──
  const tv = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    enterSolo('m3d'); await w(300);
    S.alt = 1000; S.spd = 80; toggleSimMode(true); S.alt = 1000; await w(300);
    if (!ckpitOn) toggleCockpitView();
    await w(300);
    const op = () => +getComputedStyle(document.querySelector('#sim-ckpit > svg')).opacity;
    const t0 = ckTransp, o = { btn: getComputedStyle(document.getElementById('ckpit-op')).display !== 'none' };
    ckTransp = 50; ckpitOpacity(0); o.a = op();
    document.querySelector('#ckpit-op [data-arg="[1]"]').click(); o.b = op(); o.lbl = document.getElementById('ckpit-op-pct').textContent;
    for (let i = 0; i < 9; i++) ckpitOpacity(-1); o.min = op();
    ckTransp = t0; ckpitOpacity(0); localStorage.removeItem('ckTransp');
    // 시야 버튼
    if (!vStickOn) toggleVStick(); await w(300);
    const vs = document.getElementById('vstick'), ped = vs.querySelector('.vs-ped').getBoundingClientRect(), lk = vs.querySelector('.vs-look').getBoundingClientRect();
    o.below = lk.top >= ped.bottom - 1;
    // 둥근 시야 판 — 끌어 간 자리로 시선(오른쪽 끝 = 150° · 위 끝 = 60° 올려다보기) · 놓으면 정면으로
    const pad = vs.querySelector('.vs-look'), pr = pad.getBoundingClientRect(), cx = pr.left + pr.width / 2, cy = pr.top + pr.height / 2, R = pr.width / 2;
    o.round = Math.abs(pr.width - pr.height) < 2 && getComputedStyle(pad).borderRadius === '50%';
    const at = (fx, fy) => { const e = { bubbles: true, clientX: cx + fx * R, clientY: cy - fy * R, pointerId: 7 }; pad.dispatchEvent(new PointerEvent('pointerdown', e)); return { yaw: simLook.yaw, pitch: simLook.pitch }; };
    const rel = () => pad.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    o.R = at(1, 0).yaw; rel(); simLookReset();
    o.L = at(-0.5, 0).yaw; rel(); simLookReset();
    o.F = at(0, 1).pitch; rel(); simLookReset();
    o.A = at(0, -1).pitch;
    rel(); simLookStep(1); o.ret = Math.abs(simLook.pitch) < Math.abs(o.A);
    simLookReset(); o.C = at(0, 0).yaw === 0; rel();
    toggleVStick(); toggleCockpitView(); toggleSimMode(false); exitSolo(); await w(200);
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(tv.btn && Math.abs(tv.a - 0.5) < 0.01 && Math.abs(tv.b - 0.4) < 0.01 && tv.lbl === '60%' && tv.min === 1,
    `조종석 투명도 — 조종석 ON 밑 −/+ 로 10% 씩(50% → 60% 는 불투명도 ${tv.a} → ${tv.b} · 0% 는 불투명)`);
  t.ok(tv.below && tv.round && Math.round(tv.R) === 150 && Math.round(tv.L) === -75 && Math.round(tv.F) === 60 && Math.round(tv.A) === -70 && tv.ret && tv.C,
    `화면 조종간 PEDAL 아래 둥근 시야 판 — 오른쪽 끝 ${Math.round(tv.R)}° · 왼쪽 반 ${Math.round(tv.L)}° · 위 ${Math.round(tv.F)}° · 아래 ${Math.round(tv.A)}° · 놓으면 정면 · 가운데 = 정면`);
}
