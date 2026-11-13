// 3D 화면 — 수평 자세의 화질 · 3D 화면에 겹쳐 띄우는 계기(PFD 일부) · 3D 단독
export const name = '3D 화질·3D 계기';

export async function run(page, t) {
  await page.evaluate(() => { if (!_view3dOn) toggle3dMap(); });
  await page.waitForTimeout(2500);

  // ── 꼭 수평 자세(카메라 피치 90°)에서도 화질이 떨어지지 않는다 ──
  // 120kt 수평 자세 그대로이면 화질이 낮게 나오고 1° 만 들거나 숙여도 되돌아왔다.
  // maplibre 가 그 자리에서 고를 타일(화질)을 직접 셈해 견준다.
  const lod = await page.evaluate(() => {
    if (!simModeOn) toggleSimMode(true);
    if (S.running) toggleSim();
    window._tcElev = () => null;
    const tiles = pit => {
      S.alt = 1000; S.spd = 120; S.pit = pit; S.bnk = 0; S.hdg = 90;
      _ml3dSimCamera();
      const src = _ml3d.style.tileManagers['satellite'].getSource();
      const ids = _ml3d.coveringTiles({ tileSize: src.tileSize, minzoom: src.minzoom, maxzoom: src.maxzoom,
                                        terrain: _ml3d.terrain, roundZoom: src.roundZoom,
                                        calculateTileZoom: src.calculateTileZoom });
      return { pitch: _ml3d.getPitch(), n: ids.length, z17: ids.filter(i => i.overscaledZ >= 17).length,
               top: Math.max(...ids.map(i => i.overscaledZ)) };
    };
    // 기본 시선이 자세보다 simViewDown()(저속 5° → 120kt 0°) 아래라, 카메라가 꼭 수평(90°)인 것은 기수를 그만큼 들었을 때다
    S.spd = 120; const vd = simViewDown();
    const o = { level: tiles(vd), up: tiles(vd + 1), down: tiles(vd - 1), guard: !!_ml3d.style.tileManagers['satellite'].getSource().calculateTileZoom._lodGuard };
    // 시선 숙임은 속도에 따라 — 120kt 수평 자세면 지평선이 한가운데(외부 시점 자세와 같은 목측), 저속은 5° 아래
    const camAt = kt => { S.spd = kt; S.pit = 0; S.bnk = 0; _ml3dSimCamera(); return _ml3d.getPitch(); };
    o.cruise = camAt(120); o.mid = camAt(80); o.slow = camAt(30);
    toggleSimMode(false);
    return o;
  });
  t.ok(Math.abs(lod.cruise - 90) < 0.2 && Math.abs(lod.mid - 87.5) < 0.3 && Math.abs(lod.slow - 85) < 0.2,
    `1인칭 시선: 120kt 수평이면 지평선이 한가운데, 저속은 5° 숙여 본다 (120kt ${lod.cruise.toFixed(1)}° · 80kt ${lod.mid.toFixed(1)}° · 30kt ${lod.slow.toFixed(1)}°)`);
  t.ok(lod.guard, '3D 지도에 수평 시선 화질 보정이 걸려 있다');
  t.ok(Math.abs(lod.level.pitch - 90) < 1e-6 && lod.level.n >= lod.up.n && lod.level.z17 >= lod.up.z17 && lod.level.top === lod.up.top,
    `수평 자세(카메라 90°)에서도 1° 들었을 때만큼 고운 타일을 고른다 ` +
    `(수평 ${lod.level.n}장 · 고화질 ${lod.level.z17} / 1° 들면 ${lod.up.n}장 · ${lod.up.z17} / 1° 숙이면 ${lod.down.n}장 · ${lod.down.z17})`);

  // 겹친 계기 칸의 자리·크기와, 그 칸의 캔버스에 실제로 무엇이 그려졌는가
  const OVINFO = `(() => {
    const ov = document.getElementById('pfd-ov'), c = document.getElementById('pfd-ov-cvs'), b = ov.getBoundingClientRect();
    const texts = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (this.canvas === c) texts.push(String(s)); return orig.call(this, s, ...a); };
    try { pfdOverlayDraw(true); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    const host = ov.parentElement.getBoundingClientRect();
    return { show: ov.classList.contains('show'), host: ov.parentElement.id, x: b.x - host.x, y: b.y - host.y, w: b.width, h: b.height,
             hw: host.width, hh: host.height, hsi: texts.includes('HDG') && texts.includes('CRS'), cw: c.width, ch: c.height,
             main: cvs.parentElement.id, vw: innerWidth, vh: innerHeight };
  })()`;

  // ── MAP 단독 + 3D — 계기(PFD 일부 · FCP 없이)를 3D 화면 왼쪽 위에 겹쳐 띄운다(가로 1/4 · 세로 3/5) ──
  await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    if (_view3dOn) toggle3dMap();
    panelSolo('map'); await w(100);
  });
  const flat = await page.evaluate(OVINFO);
  await page.evaluate(async () => { toggle3dMap(); await new Promise(r => setTimeout(r, 300)); });
  const msolo = await page.evaluate(OVINFO);
  const top = await page.evaluate(() => document.getElementById('map-top-bar').getBoundingClientRect().bottom
                                       - document.getElementById('map-wrap').getBoundingClientRect().y);
  t.ok(!flat.show, 'MAP 단독이라도 2D 지도면 계기를 겹치지 않는다');
  t.ok(msolo.show && msolo.host === 'map-wrap' && msolo.hsi && msolo.main === 'pfd-wrap',
    'MAP 단독에서 3D 를 켜면 계기를 3D 화면에 겹쳐 그린다(PFD 창의 캔버스는 제자리 · 칸에 제 캔버스)');
  t.ok(Math.abs(msolo.w - msolo.vw / 4) < 2 && Math.abs(msolo.h - msolo.vh * 0.6) < 2 && msolo.x < 12 && msolo.y >= top,
    `왼쪽 위 — 가로는 화면의 1/4, 높이는 3/5 (${Math.round(msolo.w)}×${Math.round(msolo.h)} / 화면 ${msolo.vw}×${msolo.vh}, 지도 툴바 아래)`);
  t.ok(Math.abs(msolo.cw / msolo.ch - msolo.w / msolo.h) < 0.02,
    `계기는 FCP 없이 칸을 다 쓴다 — 칸과 같은 비율로 그린다 (${msolo.cw}×${msolo.ch})`);
  await page.evaluate(async () => { exitSolo(); await new Promise(r => setTimeout(r, 200)); if (_view3dOn) toggle3dMap(); });

  // ── 3D 창(탭의 3D)에도 같은 계기 — PFD 창이 함께 보여도 따로 그린다 ──
  await page.evaluate(async () => { selectPanel('right', 'm3d', true); await new Promise(r => setTimeout(r, 1200)); });
  const win = await page.evaluate(OVINFO);
  const winMore = await page.evaluate(() => {
    const ov = document.getElementById('pfd-ov').getBoundingClientRect(), fly = document.getElementById('fly3d-btn').getBoundingClientRect();
    const texts = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (this.canvas === cvs) texts.push(String(s)); return orig.call(this, s, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    return { mainHsi: texts.includes('HDG'), mainW: cvs.width, clear: ov.right < fly.left };
  });
  t.ok(win.show && win.host === 'map3d-wrap' && win.hsi && win.x < 12 && win.y < 12,
    `3D 창에도 계기가 왼쪽 위에 겹쳐 뜬다 (${Math.round(win.w)}×${Math.round(win.h)} / 3D 창 ${Math.round(win.hw)}×${Math.round(win.hh)})`);
  t.ok(winMore.mainHsi && winMore.mainW > 0 && win.main === 'pfd-wrap',
    'PFD 창이 함께 보여도 그대로 그려진다(겹친 계기는 제 캔버스에 따로 그린다)');
  t.ok(winMore.clear && win.w >= Math.min(300, win.hw - 120) - 1 && win.cw >= 340,
    `좁은 3D 창에서는 읽을 만큼 키우되(340px 로 그려 줄임) 오른쪽 3D 버튼 줄은 가리지 않는다 (${Math.round(win.w)}px · 그림 ${win.cw}px)`);

  // ── 계기 ON/OFF — 3D 창의 버튼으로 보이고 감춘다(이 기기에 적어 둔다) ──
  const btn = await page.evaluate(() => {
    const b = document.getElementById('pfdov-btn');
    const o = { inside: !!(b && b.closest('#map3d')), txt0: b.textContent, on0: b.classList.contains('on') };
    b.click(); pfdOverlaySync();
    o.off = { txt: b.textContent, show: document.getElementById('pfd-ov').classList.contains('show'), pref: localStorage.getItem('pfdOverlay') };
    b.click(); pfdOverlaySync();
    o.on = { txt: b.textContent, show: document.getElementById('pfd-ov').classList.contains('show'), pref: localStorage.getItem('pfdOverlay') };
    return o;
  });
  t.ok(btn.inside && btn.txt0 === '계기 ON' && btn.on0, `3D 창에 계기 ON/OFF 버튼이 있다 (${btn.txt0})`);
  t.ok(btn.off.txt === '계기 OFF' && !btn.off.show && btn.off.pref === '0', '누르면 계기를 감춘다(계기 OFF)');
  t.ok(btn.on.txt === '계기 ON' && btn.on.show && btn.on.pref === '1', '다시 누르면 다시 보인다(계기 ON)');
  await page.evaluate(async () => { selectPanel('right', 'map', true); await new Promise(r => setTimeout(r, 300)); });
  const gone = await page.evaluate(OVINFO);
  t.ok(!gone.show, '3D 지도가 화면에 없으면 계기도 겹치지 않는다');

  // ── 창 선택 줄의 '⛶ 3D 단독' — 3D 지도를 창 가득, 계기를 왼쪽 위에 ──
  const before = await page.evaluate(() => ({ l: leftSel, m: midSel, r: rightSel, tri: tripleMode,
    inRow: !!document.querySelector('#left-tabs #m3d-solo-btn'), txt: document.getElementById('m3d-solo-btn').textContent }));
  await page.evaluate(() => document.getElementById('m3d-solo-btn').click());   // (탭에서는 감췄다 — 기능은 그대로)
  await page.waitForTimeout(1500);
  const solo = await page.evaluate(() => {
    const d3 = document.getElementById('map3d').getBoundingClientRect();
    const half = document.getElementById('solo-half-btn'), hb = half.getBoundingClientRect();
    return { cur: _soloCurrent, left: leftSel, host: document.getElementById('map3d').parentElement.id,
             d3: { w: d3.width, h: d3.height }, vw: innerWidth, vh: innerHeight,
             half: { shown: getComputedStyle(half).display !== 'none', inCtl: !!half.closest('#ctl3d'), txt: half.textContent,
                     sim: !!document.querySelector('#ctl3d #sim3d-btn') } };
  });
  const sov = await page.evaluate(OVINFO);
  t.ok(before.inRow && /3D 단독/.test(before.txt), `창 선택 줄(PFD·MAP·CDU·3D 탭 옆)에 '${before.txt}' 버튼이 있다`);
  t.ok(solo.cur === 'm3d' && solo.left === 'm3d' && solo.host === 'map3d-wrap' && solo.d3.w >= solo.vw - 2 && solo.d3.h >= solo.vh * 0.9,
    `누르면 3D 지도가 화면을 가득 채운다 (${Math.round(solo.d3.w)}×${Math.round(solo.d3.h)})`);
  t.ok(sov.show && sov.host === 'map3d-wrap' && sov.hsi &&
       Math.abs(sov.w - sov.vw / 4) < 2 && Math.abs(sov.h - sov.vh * 0.6) < 2 && sov.x < 12 && sov.y < 12,
    `계기가 왼쪽 위에 겹쳐 뜬다 — 가로 1/4 · 높이 3/5 (${Math.round(sov.w)}×${Math.round(sov.h)})`);
  t.ok(solo.half.shown && solo.half.inCtl && solo.half.txt === 'Split screen',
    `빠져나가는 'Split screen' 버튼이 오른쪽 3D 버튼 묶음 아래에 뜬다 (${solo.half.txt})`);
  t.ok(solo.half.sim, '3D 버튼 묶음 맨 아래에 SIM 버튼이 있다');
  await page.click('#solo-half-btn');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ solo: _soloActive, l: leftSel, m: midSel, r: rightSel, tri: tripleMode,
    host: document.getElementById('map3d').parentElement.id }));
  const bov = await page.evaluate(OVINFO);
  t.ok(!back.solo && back.l === before.l && back.m === before.m && back.r === before.r && back.tri === before.tri &&
       !bov.show && back.host === 'map-wrap' && bov.main === 'pfd-wrap',
    `HALF 를 누르면 들어가기 전 배치(${before.l} · ${before.tri ? before.m + ' · ' : ''}${before.r})로 돌아온다`);

  // ── 3D 화면의 FCP L · R — 3D 단독에서만, 연 쪽 CHIN 창은 닫힌다 ──
  const fcp = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const total = document.querySelectorAll('#pfd-wrap .ctrl-bar > .ctrl-sub-row > :not(.ctrl-div)').length + 2;   // + 소프트키 · FCP 패널
    if (!simModeOn) toggleSimMode(true);
    chinL = chinR = true; chinViewOn = true;
    const o = { split: fcp3dAvail() };
    toggleFcp3d(); o.splitRefused = !document.getElementById('fcp3d-l') || !document.getElementById('fcp3d-l').classList.contains('show');
    fcpL = false;
    panelSolo('m3d'); await wait(600);
    o.avail = fcp3dAvail();
    o.oneBtn = !document.getElementById('fcp-r-btn');
    document.getElementById('fcp-l-btn').click(); await wait(150);   // 화면 버튼 그대로 눌러 본다
    const box = document.getElementById('fcp3d-l'), rc = box.getBoundingClientRect(), r3 = document.getElementById('map3d').getBoundingClientRect();
    o.on = { show: box.classList.contains('show'), chinL, chinR, btn: document.getElementById('fcp-l-btn').textContent,
             all: box.querySelectorAll('.ctrl-sub-row > :not(.ctrl-div)').length, total,   // SIMPLE 패널도 첫 줄의 한 칸
             ias: !!box.querySelector('#fcp-simple [data-k="ias"]'), sim: !!box.querySelector('#fcp-simple [data-k="hdg"]'),
             sk: (() => { const k = box.querySelector('#pfd-sk'), f = box.querySelector('#fcp-simple'); return !!(k && f && k.getBoundingClientRect().bottom <= f.getBoundingClientRect().top + 2); })(),
             left: Math.round(rc.left - r3.left), bottom: Math.round(r3.bottom - rc.bottom),
             w: rc.width / r3.width, h: rc.height / r3.height,
             fit: [...box.querySelectorAll('.ctrl-sub-row > *')].every(e => { const q = e.getBoundingClientRect(); return q.right <= rc.right + 1 && q.bottom <= rc.bottom + 1; }) };
    toggleChinView('L'); o.chinRefused = !chinL;
    document.getElementById('fcp-l-btn').click(); await wait(100);
    toggleChinView('L'); o.chinBack = chinL;
    o.offHome = document.querySelectorAll('#pfd-wrap .ctrl-bar > .ctrl-sub-row > :not(.ctrl-div)').length + (document.querySelector('#pfd-wrap .ctrl-bar > #fcp-simple') ? 1 : 0) + (document.querySelector('#pfd-wrap .ctrl-bar > #pfd-sk') ? 1 : 0);
    document.getElementById('fcp-l-btn').click(); await wait(100);
    exitSolo(); await wait(400);
    o.back = { home: document.querySelectorAll('#pfd-wrap .ctrl-bar > .ctrl-sub-row > :not(.ctrl-div)').length + (document.querySelector('#pfd-wrap .ctrl-bar > #fcp-simple') ? 1 : 0) + (document.querySelector('#pfd-wrap .ctrl-bar > #pfd-sk') ? 1 : 0), total, show: box.classList.contains('show') };
    toggleSimMode(false);
    return o;
  });
  t.ok(!fcp.split && fcp.splitRefused, '분할 화면에서는 FCP 를 열지 않는다(PFD 아래에 FCP 가 있다)');
  t.ok(fcp.oneBtn && fcp.on.btn === 'FCP ON', 'FCP 버튼은 하나(FCP ON/OFF)다');
  t.ok(fcp.on.sk, '3D 단독 FCP 창 — PFD 소프트키가 FCP 패널 바로 위에 붙는다(비행 조작에 쓰는 줄)');
  t.ok(fcp.avail && fcp.on.show && fcp.on.all === fcp.on.total && fcp.on.ias && fcp.on.sim && fcp.on.left <= 2 && fcp.on.bottom <= 2 &&
       fcp.on.w <= 0.51 && fcp.on.h <= 0.46 && fcp.on.fit,
    `3D 단독에서 FCP 를 켜면 FCP 전체(${fcp.on.all}칸)가 왼쪽 아래 한 창(너비 ${(fcp.on.w * 100).toFixed(0)}% · 높이 ${(fcp.on.h * 100).toFixed(0)}%)으로 뜬다`);
  t.ok(!fcp.on.chinL && fcp.on.chinR, 'FCP 를 켜면 L CHIN 창이 닫히고 R CHIN 은 그대로다');
  t.ok(fcp.chinRefused, 'FCP 가 켜져 있으면 L CHIN 을 열 수 없다');
  t.ok(fcp.chinBack && fcp.offHome === fcp.on.total, 'FCP 를 끄면 FCP 가 제자리로 돌아가고 L CHIN 을 다시 켤 수 있다');
  t.ok(fcp.back.home === fcp.back.total && !fcp.back.show, `3D 단독을 빠져나가면 FCP 가 PFD 아래 제자리로 돌아간다 (${fcp.back.home}/${fcp.back.total})`);

  // ── 3D 단독 화면의 CDU 겹치기 — 3D 버튼 줄 바로 왼쪽, 계기 칸 크기 ──
  const cduov = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = { split: cduOvAvail(), home0: document.getElementById('cdu-wrap').parentElement.id };
    cduOvOn = false;
    panelSolo('m3d'); await wait(600);
    document.getElementById('cduov-btn').click(); await wait(300);
    const box = document.getElementById('cdu-ov'), rc = box.getBoundingClientRect();
    const ctl = document.getElementById('ctl3d').getBoundingClientRect(), host = box.parentElement.getBoundingClientRect();
    const sc = document.getElementById('cdu-scaler').getBoundingClientRect();
    o.on = { show: box.classList.contains('show'), inBox: document.getElementById('cdu-wrap').parentElement === box,
             gap: ctl.left - rc.right, w: rc.width / host.width, h: rc.height / host.height,
             side: Math.max(sc.left - rc.left, rc.right - sc.right),   // 좌우 빈 여백(px)
             fit: sc.left >= rc.left - 1 && sc.right <= rc.right + 1 && sc.top >= rc.top - 1 && sc.bottom <= rc.bottom + 1 && sc.width > 100,
             btn: document.getElementById('cduov-btn').textContent };
    // 겹친 CDU 의 키가 그대로 듣는다
    switchMode('HOME');
    box.querySelector('[data-act="switchMode"][data-arg*="INTERCOM"]').click(); await wait(100);
    o.key = currentMode; switchMode('HOME');
    // 단독 화면을 바꾸던 버튼들 — Flight Plan(PLAN) · 그 안의 Home · FULL — 3D 단독은 그대로, 칸 안에서 바뀐다
    openFlightPlan(); await wait(150);
    o.plan = { solo: _soloCurrent, inBox: document.getElementById('fp-wrap').parentElement === box,
               cduHome: document.getElementById('cdu-wrap').parentElement !== box };
    fpGoCduHome(); await wait(150);
    o.home = { solo: _soloCurrent, inBox: document.getElementById('cdu-wrap').parentElement === box,
               fpHome: document.getElementById('fp-wrap').parentElement !== box };
    cduFullScreen(); await wait(150); o.full = _soloCurrent;
    o.noHalf = !box.querySelector('[data-act="exitSolo"]');
    document.getElementById('cduov-btn').click(); await wait(100);
    o.off = { show: box.classList.contains('show'), home: document.getElementById('cdu-wrap').parentElement.id };
    document.getElementById('cduov-btn').click(); await wait(100);
    exitSolo(); await wait(400);
    o.back = { show: box.classList.contains('show'), home: document.getElementById('cdu-wrap').parentElement.id };
    cduOvOn = false; try { localStorage.removeItem('cduOverlay'); } catch (e) {}
    return o;
  });
  t.ok(!cduov.split, '분할 화면에서는 CDU 겹치기를 쓰지 않는다(CDU 창이 따로 있다)');
  t.ok(cduov.on.show && cduov.on.inBox && cduov.on.btn === 'CDU ON' && Math.abs(cduov.on.gap - 8) < 2 &&
       Math.abs(cduov.on.h - 0.6) < 0.06 && cduov.on.fit && cduov.on.side < 4,
    `3D 단독에서 CDU ON — 3D 버튼 줄 바로 왼쪽에 계기 칸 높이(${(cduov.on.h * 100).toFixed(0)}%)로, 좌우 빈 여백 없이(${cduov.on.side.toFixed(1)}px) CDU 가 뜬다`);
  t.eq(cduov.key, 'INTERCOM', '겹친 CDU 의 키가 그대로 듣는다');
  t.ok(cduov.plan.solo === 'm3d' && cduov.plan.inBox && cduov.plan.cduHome,
    '겹친 CDU 에서 Flight Plan 을 열어도 3D 단독 그대로 — 칸 안에서 Flight Plan 이 뜬다');
  t.ok(cduov.home.solo === 'm3d' && cduov.home.inBox && cduov.home.fpHome, 'Flight Plan 의 Home 도 칸 안에서 CDU 로 돌아온다');
  t.ok(cduov.full === 'm3d' && cduov.noHalf, 'FULL/HALF 처럼 단독 화면을 바꾸는 버튼은 3D 단독을 깨지 않는다(겹친 CDU 에는 HALF 를 두지 않는다)');
  t.ok(!cduov.off.show && cduov.off.home === cduov.home0, 'CDU OFF 면 감추고 CDU 창을 제자리로 돌려놓는다');
  t.ok(!cduov.back.show && cduov.back.home === cduov.home0, '3D 단독을 나오면 CDU 가 제자리로 돌아간다');

  // ── 3D 단독 화면의 MAP 겹치기 · MAP 단독에서 3D 버튼으로 3D 단독 복귀 ──
  const mapov = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const home0 = document.getElementById('map-wrap').parentElement.id;
    const o = { split: mapOvActive() };
    cduOvOn = false; mapOvOn = false;
    panelSolo('m3d'); await wait(600);
    document.getElementById('cduov-btn').click(); await wait(200);
    document.querySelector('#cdu-ov [data-act="cduOpenMap"]').click(); await wait(300);   // 겹친 CDU 의 MAP
    const box = document.getElementById('map-ov'), rc = box.getBoundingClientRect();
    const cdu = document.getElementById('cdu-ov').getBoundingClientRect(), pfd = document.getElementById('pfd-ov').getBoundingClientRect();
    o.on = { solo: _soloCurrent, show: box.classList.contains('show'), inBox: document.getElementById('map-wrap').parentElement === box,
             gap: cdu.left - rc.right, dw: Math.abs(rc.width - pfd.width), dh: Math.abs(rc.height - pfd.height),
             btn: document.getElementById('mapov-btn').textContent };
    document.getElementById('mapov-btn').click(); await wait(100);
    o.off = { show: box.classList.contains('show'), home: document.getElementById('map-wrap').parentElement.id === home0 };
    // MAP 단독으로 넘어간 뒤 지도 아래 3D 버튼 → 3D 단독
    setSolo('map'); await wait(300);
    o.mapSolo = _soloCurrent;
    document.getElementById('layer-btn-3d').click(); await wait(400);
    o.back3d = _soloCurrent;
    document.getElementById('cduov-btn').click();
    exitSolo(); await wait(300);
    o.exit = document.getElementById('map-wrap').parentElement.id === home0;
    cduOvOn = mapOvOn = false; try { localStorage.removeItem('cduOverlay'); localStorage.removeItem('mapOverlay'); } catch (e) {}
    return o;
  });
  t.ok(!mapov.split, '분할 화면에서는 MAP 겹치기를 쓰지 않는다');
  t.ok(mapov.on.solo === 'm3d' && mapov.on.show && mapov.on.inBox && mapov.on.btn === 'MAP ON' &&
       Math.abs(mapov.on.gap - 8) < 2 && mapov.on.dw < 2 && mapov.on.dh < 2,
    `겹친 CDU 의 MAP — 3D 단독 그대로, 계기 칸과 같은 크기의 지도가 CDU 칸 왼쪽에 뜬다 (간격 ${mapov.on.gap.toFixed(0)}px)`);
  t.ok(!mapov.off.show && mapov.off.home, 'MAP OFF 면 감추고 지도를 제자리로 돌려놓는다');
  t.ok(mapov.mapSolo === 'map' && mapov.back3d === 'm3d', 'MAP 단독 화면에서 지도 아래 3D 버튼을 누르면 3D 단독으로 돌아간다');
  t.ok(mapov.exit, '3D 단독을 나오면 지도가 제자리로 돌아간다');

  // ── 화면 조종간(3D 단독 · SIM) — 컬렉티브 · 페달 · 16방향 사이클릭 ──
  const vs0 = await page.evaluate(async () => {
    const o = { split: vStickAvail() };
    toggleSimMode(true); fcpL = false; chinL = chinR = true; chinViewOn = true; vStickOn = false;
    panelSolo('m3d'); await new Promise(r => setTimeout(r, 600));
    document.getElementById('vstick-btn').click(); await new Promise(r => setTimeout(r, 100));
    const R = q => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
    const d3 = R('#map3d');
    o.box = R('#vstick'); o.d3 = d3; o.cyc = R('#vstick .vs-cyc'); o.ped = R('#vstick .vs-ped'); o.coll = R('#vstick-coll .vs-coll');
    o.chinR = chinR; o.chinL = chinL; o.btn = document.getElementById('vstick-btn').textContent;
    const ctl = R('#ctl3d'); o.ctlClear = ctl.b <= o.box.y + 1;
    { const c = o.coll, top = document.elementFromPoint(c.x + c.w / 2, c.y + c.h / 2); o.collTop = !!(top && top.closest('#vstick-coll')); }
    // FCP 를 켜면 컬렉티브 오른쪽으로 비킨다
    toggleFcp3d(); await new Promise(r => setTimeout(r, 150)); o.fcpL = R('#fcp3d-l').x; o.collR = R('#vstick-coll').r; toggleFcp3d();
    chinL = true; chinViewOn = true;
    return o;
  });
  const vsm = async (x0, y0, x1, y1, probe) => {
    await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 5 });
    const held = await page.evaluate(probe); await page.mouse.up();
    return { held, rel: await page.evaluate(() => ({ ...vStick })) };
  };
  const cx = vs0.cyc.x + vs0.cyc.w / 2, cy = vs0.cyc.y + vs0.cyc.h / 2, rr = vs0.cyc.w * 0.4, a40 = 40 * Math.PI / 180;
  const cyc = await vsm(cx, cy, cx + Math.cos(a40) * rr, cy - Math.sin(a40) * rr, () => ({ ...vStick, ax: simModeAxes() }));
  // 가동범위 — 끝까지 밀면 피치 10° · 롤 20°, 피치는 가운데 감도가 반
  const lim = await page.evaluate(() => {
    const deg = (r, p) => { vStick.roll = r; vStick.pitch = p; const a = simModeAxes(); return { roll: a.roll * SIM_BANK_MAX, pitch: a.pitch * SIM_PITCH_MAX }; };
    const o = { full: deg(1, 1), right: deg(1, 0), half: deg(0, 0.5), small: deg(0, 0.1) };
    vStick.roll = vStick.pitch = 0; return o;
  });
  const ped = await vsm(vs0.ped.x + vs0.ped.w / 2, vs0.ped.y + vs0.ped.h / 2, vs0.ped.x + 2, vs0.ped.y + vs0.ped.h / 2, () => simModeAxes().yaw);
  await vsm(vs0.coll.x + vs0.coll.w / 2, vs0.coll.b - 2, vs0.coll.x + vs0.coll.w / 2, vs0.coll.y + 2, () => 0);
  const coll = await page.evaluate(() => {
    S.running = true; let ts = 1000; S.lastT = ts; for (let i = 0; i < 40; i++) { ts += 50; simStep(ts); } S.running = false;
    const o = { coll: vStick.coll, cmd: simTqCmd };
    toggleChinView('R'); o.chinRefused = !chinR;
    document.getElementById('vstick-btn').click(); toggleChinView('R'); o.chinBack = chinR;
    exitSolo(); toggleSimMode(false);
    return o;
  });
  t.ok(!vs0.split, 'SIM 3D 단독이 아니면 화면 조종간을 쓰지 않는다');
  t.ok(vs0.btn === 'STICK ON' && Math.abs(vs0.box.r - (vs0.d3.x + vs0.d3.w)) < 3 && Math.abs(vs0.box.b - (vs0.d3.y + vs0.d3.h)) < 3 &&
       Math.abs(vs0.box.w / vs0.d3.w - 1 / 3) < 0.03 && !vs0.chinR && vs0.chinL && vs0.ctlClear,
    'STICK ON — R CHIN 자리(오른쪽 아래 · 너비 1/3)에 조종간 셋이 뜨고 R CHIN 이 닫힌다(3D 버튼 줄은 그 위에서 끝난다)');
  t.ok(vs0.coll.x - vs0.d3.x < 16 && vs0.d3.y + vs0.d3.h - vs0.coll.b < 16 && vs0.coll.h > vs0.coll.w && vs0.collTop,
    `컬렉티브(위아래)는 화면 왼쪽 아래 끝(왼손)에 있고 L CHIN 창 위에 보인다 (왼쪽 ${Math.round(vs0.coll.x - vs0.d3.x)}px)`);
  t.ok(vs0.ped.x < vs0.cyc.x && vs0.ped.w > vs0.ped.h && Math.abs(vs0.cyc.w - vs0.cyc.h) < 1,
    '오른쪽 아래에는 좌우(페달)와 원형(사이클릭)이 있다');
  t.ok(vs0.fcpL >= vs0.collR - 1, 'FCP 를 켜면 FCP 창이 컬렉티브 오른쪽으로 비켜 뜬다');
  t.ok(Math.abs(cyc.held.roll - cyc.held.pitch) < 1e-3 && cyc.held.roll > 0.5 && cyc.rel.roll === 0 && cyc.rel.pitch === 0,
    `사이클릭 — 40° 쪽으로 밀면 16방향(45°)으로 맞춰 들어가고(롤 ${cyc.held.roll} · 피치 ${cyc.held.pitch}), 놓으면 가운데로`);
  t.ok(Math.abs(lim.right.roll - 20) < 1e-6 && Math.abs(lim.full.pitch - 10) < 1e-6,
    `사이클릭 가동범위 — 끝까지 밀면 롤 ${lim.right.roll.toFixed(0)}° · 피치 ${lim.full.pitch.toFixed(0)}°`);
  t.ok(Math.abs(lim.small.pitch - 10 * 0.1 * 0.55) < 1e-6 && lim.half.pitch < 10 * 0.5,
    `피치 감도는 가운데에서 반 — 10% 밀면 ${lim.small.pitch.toFixed(2)}°(곧게면 1°) · 반 밀면 ${lim.half.pitch.toFixed(2)}°`);
  t.ok(ped.held < -0.9 && ped.rel.yaw === 0, `페달 — 왼쪽 끝은 −1 언저리(${ped.held.toFixed(2)}), 놓으면 가운데로`);
  t.ok(coll.coll > 0.97 && coll.cmd > 135, `컬렉티브 — 위 끝으로 올리면 레버 ${coll.cmd.toFixed(0)}%(놓아도 그 자리)`);
  t.ok(coll.chinRefused && coll.chinBack, '조종간이 켜져 있으면 R CHIN 을 열 수 없고, 끄면 다시 열 수 있다');

  // ── GYRO — 기기 기울기로 16방향 사이클릭(ALIGN 한 때부터) ──
  const gy = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const ori = (beta, gamma) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma }));
    const deg = () => { const a = simModeAxes(); return { roll: +(a.roll * SIM_BANK_MAX).toFixed(3), pitch: +(a.pitch * SIM_PITCH_MAX).toFixed(3) }; };
    toggleSimMode(true); vStickOn = false; gyroOn = false;
    panelSolo('m3d'); await wait(500);
    const o = { alignHidden: getComputedStyle(document.getElementById('gyro-align-btn')).display === 'none' };
    document.getElementById('gyro-btn').click(); await wait(100);
    o.on = { btn: document.getElementById('gyro-btn').textContent, alignShown: getComputedStyle(document.getElementById('gyro-align-btn')).display !== 'none' };
    ori(40, 0); ori(40, 15); o.before = deg();                       // ALIGN 전에는 기울여도 듣지 않는다
    ori(40, 5); document.getElementById('gyro-align-btn').click();     // 이 자세가 가운데
    ori(40, 5); o.zero = deg();
    ori(40, 30); o.right = deg();                                      // 오른쪽으로 25° → 롤 끝(20°)
    ori(40, 60); o.over = deg();                                       // 더 기울여도 20°
    ori(15, 5); o.fwd = deg();                                         // 앞으로 25° 숙임 → 피치 끝(10°, 기수 내림)
    ori(40 - 9, 5 + 10); o.diag = { ...vStick };                       // 비스듬히 — 16방향으로 맞춘다
    ori(40, 5); o.back = deg();
    // 화면을 가로로 돌리면 다시 ALIGN 해야 한다
    const angOrig = _gyroAngle; _gyroAngle = () => 90; ori(40, 5); o.rotated = gyroAligned; _gyroAngle = angOrig;
    // 가로(아이패드 · window.orientation 90) — 앞으로 숙이면 피치, 오른쪽으로 내리면 롤(엇갈리지 않는다)
    Object.defineProperty(window, 'orientation', { value: 90, configurable: true });
    o.ang90 = _gyroAngle();
    ori(20, 10); document.getElementById('gyro-align-btn').click();
    ori(20, 10 + 25); o.l90fwd = deg();                  // 가로 90 에서 앞으로 숙임 = gamma 증가
    ori(20 + 25, 10); o.l90right = deg();                // 오른쪽 내림 = beta 증가
    Object.defineProperty(window, 'orientation', { value: -90, configurable: true });
    o.ang270 = _gyroAngle();
    ori(20, 10); document.getElementById('gyro-align-btn').click();
    ori(20, 10 - 25); o.l270fwd = deg();
    delete window.orientation;
    o.noWo = _gyroAngle();                               // window.orientation 이 없으면 screen.orientation.angle
    document.getElementById('gyro-btn').click(); await wait(50);
    o.off = { btn: document.getElementById('gyro-btn').textContent, act: gyroActive() };
    exitSolo(); toggleSimMode(false);
    return o;
  });
  t.ok(gy.alignHidden && gy.on.btn === 'GYRO ON' && gy.on.alignShown, 'GYRO 를 켜면 GYRO ALIGN 버튼이 나타난다');
  t.ok(gy.before.roll === 0 && gy.before.pitch === 0, 'GYRO ALIGN 을 누르기 전에는 기울여도 조종하지 않는다');
  t.ok(gy.zero.roll === 0 && gy.zero.pitch === 0, 'ALIGN 한 그때의 기울기가 가운데다');
  t.ok(Math.abs(gy.right.roll - 20) < 1e-6 && Math.abs(gy.over.roll - 20) < 1e-6 && gy.right.pitch === 0,
    `기기를 오른쪽으로 기울이면 롤 — 끝은 20° (${gy.right.roll}° · 더 기울여도 ${gy.over.roll}°)`);
  t.ok(Math.abs(gy.fwd.pitch - 10) < 1e-6 && gy.fwd.roll === 0, `앞으로 숙이면 피치(기수 내림) — 끝은 10° (${gy.fwd.pitch}°)`);
  t.ok(Math.abs(gy.diag.roll - gy.diag.pitch) < 1e-3 && gy.diag.roll > 0, `비스듬히 기울이면 16방향(45°)으로 맞춘다 (${gy.diag.roll} · ${gy.diag.pitch})`);
  t.ok(gy.back.roll === 0 && gy.back.pitch === 0, '가운데 자세로 돌아오면 가운데');
  t.ok(gy.rotated === false, '화면 방향이 바뀌면 다시 ALIGN 해야 한다');
  t.ok(gy.ang90 === 90 && gy.ang270 === 270 && gy.noWo === 0, `가로 화면 각을 읽는다 — iOS window.orientation 우선(${gy.ang90} · ${gy.ang270}), 없으면 screen.orientation(${gy.noWo})`);
  t.ok(Math.abs(gy.l90fwd.pitch - 10) < 1e-6 && gy.l90fwd.roll === 0 && Math.abs(gy.l90right.roll - 20) < 1e-6 && gy.l90right.pitch === 0,
    `가로로 쥐어도 숙이면 피치 · 오른쪽으로 내리면 롤이다 (숙임 피치 ${gy.l90fwd.pitch}° · 롤 ${gy.l90right.roll}°)`);
  t.ok(Math.abs(gy.l270fwd.pitch - 10) < 1e-6 && gy.l270fwd.roll === 0, '반대쪽 가로(−90)에서도 숙이면 피치다');
  t.ok(gy.off.btn === 'GYRO OFF' && !gy.off.act, 'GYRO OFF 면 기울기로 조종하지 않는다');

  // ── 3D 지도 조작 버튼(확대·나침반 · 기울기) — 왼쪽 아래 축척 바로 위 ──
  const ctl = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (simModeOn) toggleSimMode(false);
    panelSolo('m3d'); await wait(600);
    const r = q => { const e = document.querySelector(q); if (!e || !e.offsetParent) return null; const x = e.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom }; };
    const d3 = r('#map3d'), nav = r('#map3d .maplibregl-ctrl-bottom-left .maplibregl-ctrl-group'), tilt = r('#tilt-ctrl'), sc = r('#map3d .vfr-scale');
    const o = { d3, nav, tilt, sc, right: !!document.querySelector('#map3d .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group') };
    exitSolo(); await wait(300);
    return o;
  });
  t.ok(ctl.nav && ctl.sc && ctl.nav.l - ctl.d3.l < 20 && ctl.nav.b <= ctl.sc.t && ctl.tilt && ctl.tilt.l < ctl.d3.l + 100 && ctl.tilt.b <= ctl.sc.t && !ctl.right,
    `3D 확대·나침반·기울기 버튼은 왼쪽 아래 축척 바로 위에 있다 (버튼 아래 ${Math.round(ctl.nav.b)} ≤ 축척 위 ${Math.round(ctl.sc.t)})`);
}
