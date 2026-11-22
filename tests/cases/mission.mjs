// 흰수리 전탐석(37-mission.js) — 기종 고르기 · EO/IR 터릿(시선 · 줌 · AVT · LRF · SLEW) · SAR 레이더(표적 · 지정) · 서치라이트 연동 · HCU
export const name = '흰수리 전탐석 — EO/IR · 레이더 · 서치라이트';

export async function run(page, t) {
  t.ok(await page.evaluate(() => !document.querySelector('.gate-ac-btn[data-ac="kuhm"]') && /LOFT/.test((document.getElementById('gate-mode-loft') || {}).textContent || '')),
    '시작 화면 — 기종 고르기에서 전탐석을 빼고, 화면 고르기에 LOFT(조종석 + 전탐석) 모드');
  // 흰수리 조종석(전탐석이 아닌 페이지) — 아무도 EO/IR 영상을 보지 않으면 3D 지도를 만들지 않는다(페이지가 뜨자마자 만들어 CI 가 느려졌다)
  const idle = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 400)); return { map: _eoMap, need: _eoNeed(), hw: msnHoistWant(), t: Math.round(performance.now()) }; });
  t.ok(idle.map === null && !idle.need && !idle.hw, `흰수리 조종석 — 보는 곳이 없으면 EO/IR · 호이스트 지도를 만들지 않는다(${idle.t}ms)`);
  const u = new URL(page.url()); u.searchParams.set('ac', 'kuhm');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof msnShow === 'function', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForFunction(() => { const r = document.getElementById('msn-root'); return r && r.classList.contains('on'); }, null, { timeout: 10000 });
  const a0 = await page.evaluate(() => ({ kuhm: acExact('kuhm'), fam: acIs('aw189'), sys: acScrOk('sysp'), hcu: document.querySelectorAll('#msn-root [data-hcu]').length,
    top: [...document.querySelectorAll('#msn-root .hcu-key')].map(b => b.textContent).join(','), joy: !!JOY_ACT_BY_ID.hcuAvt && !!JOY_ACT_BY_ID.hcuLrf }));
  t.ok(a0.kuhm && a0.fam && a0.sys, '전탐석은 흰수리 갈래 — 흰수리 계통(SYSTEM 등)을 그대로 쓴다');
  t.eq(a0.top, 'MENU,LASER,GEOFOCUS,MAP,2X,IRGATE,STOW,AUX,LRF,TX,CTRLAUTH,POL,IRCAL,SCENE', 'HCU 상부 버튼 14개(교범 그림 차례)');
  t.ok(a0.hcu >= 14 + 8 * 2 + 4 + 2 + 1, `HCU 면판 스위치 · 버튼 (${a0.hcu}개) · 조이스틱 배정 동작(AVT · LRF …)`);

  const r = await page.evaluate(() => {
    const o = {};
    if (S.running) toggleSim();
    S.lat = 34.60; S.lon = 128.90; S.hdg = 0; S.alt = 1500; S.spd = 0;
    // ── 시선 — 1500ft 에서 −10° 로 보면 약 2.6km 앞 바다 ──
    eo.pwr = true; eo.mode = 'MAN'; eo.az = 0; eo.el = -10; eo.aid = false;
    const p = eoLosPoint(); o.los = p && p.rng; o.losN = p && distance(S.lat, S.lon, p.lat, p.lon) * 1852;
    o.sky = eoLosPoint(0, 5) === null;
    // ── 센서 · 줌 ──
    hcuPress('vic:up', true); hcuPress('vic:up', false); o.s1 = eo.sensor;
    hcuPress('vic:up', true); hcuPress('vic:up', false); o.s2 = eo.sensor;
    hcuPress('pol', true); hcuPress('pol', false); o.pol = eo.pol;
    hcuPress('vic:up', true); hcuPress('vic:up', false); o.s3 = eo.sensor;
    const f0 = eoFov(); hcuPress('zoom:up', true); eo.holdT['zoom:up'] = performance.now() - 50; eoStep(1); hcuPress('zoom:up', false); o.zoom = [f0, eoFov()];
    hcuPress('ez', true); hcuPress('ez', false); o.ez = eo.ez; eo.ez = 1; eo.fovW = 30;
    // ── 선박 표적을 북쪽 1.5NM 에 놓고 레이더 → EO/IR SLEW → AVT 잠금 → LRF ──
    msnVslClear(); msnSpawn(1, { brg: 0, nm: 1.5, spd: 0, hdg: 90, type: '어선', anywhere: true });
    const v = msnVsl[0];
    rdr.cmd = 'CABIN'; rdr.warm = 0; rdr.tx = true; rdr.rng = 10; rdr.paint = {}; rdr.trkNo = {}; rdr.az = -5; rdr.dir = 1;
    for (let i = 0; i < 60; i++) rdrStep(0.05);
    o.paint = !!rdr.paint[v.id];
    const pk = rdrPickRB(0, 1.5); o.pick = pk;
    o.slave = rdrSlaveEo() && eo.mode === 'SLEW';
    for (let i = 0; i < 60; i++) eoStep(0.05);
    const ang = eoAngTo(v.lat, v.lon, 0); o.aim = [eo.az - ang.az, eo.el - ang.el].map(x => Math.abs(x));
    hcuPress('avt', true); hcuPress('avt', false); o.acq = eo.mode + ' ' + eo.trk;
    hcuPress('avt', true); hcuPress('avt', false); o.lock = eo.trk + ' ' + (eo.lock && eo.lock.id);
    // 기체가 동쪽으로 옮겨도 시선은 그 배를 따라간다
    S.lon += 0.01; for (let i = 0; i < 40; i++) eoStep(0.05);
    const a2 = eoAngTo(v.lat, v.lon, 0); o.follow = Math.abs(normAS(eo.az - a2.az)) < 0.3 && Math.abs(eo.el - a2.el) < 0.3; o.azNow = eo.az;
    hcuPress('lrf', true); hcuPress('lrf', false); for (let i = 0; i < 10; i++) eoStep(0.05);
    o.lrf = [eo.lrf.st, eo.lrf.rng, a2.rng];
    // ── 탐조등 AUTO(EO/IR 연동 SLASS) — 한계 안의 시선(방위 −40° · 고각 −30°)을 따라간다 ──
    Object.assign(hsl, { pwr: true, stowed: false, mv: null, az: 0, el: -45, lamp: false, lit: false });
    eo.mode = 'MAN'; eo.lock = null; eo.trk = 'IDLE'; eo.aid = false; eo.az = -40; eo.el = -30; srchMode('EO'); for (let i = 0; i < 120; i++) srchStep(0.05);
    o.srch = { az: hsl.az - eo.az, el: hsl.el - eo.el, lim: srch.lim };
    eo.az = 0; eo.el = -5; for (let i = 0; i < 40; i++) srchStep(0.05); o.srchLim = srch.lim && hsl.el === -20;   // 시선이 한계 밖(−5°) — −20° 에 멈추고 LIMIT
    srchMode('MAN');
    // ── FWD · STOW · 메뉴(LASER ARM) ──
    hcuPress('slew:dn', true); hcuPress('slew:dn', false); for (let i = 0; i < 80; i++) eoStep(0.05); o.fwd = [eo.mode, +eo.az.toFixed(1), +eo.el.toFixed(1)];
    hcuPress('menu', true); hcuPress('menu', false); hcuPress('sens:up', true); hcuPress('sens:up', false); o.arm = eo.laserArm;
    hcuPress('laser', true); o.fire = eo.laserFire; hcuPress('laser', false); hcuPress('menu', true); hcuPress('menu', false);
    o.lamps = ['on', 'armed'].map(n => document.querySelector(`[data-lamp="${n}"]`).className).join('|');
    return o;
  });
  t.ok(Math.abs(r.los - 457.2 / Math.sin(10 * Math.PI / 180)) < 60 && r.sky, `시선 — 1500ft · −10° 면 ${Math.round(r.los)}m 앞 바다(계산 2633m) · 수평선 위는 없음`);
  t.eq([r.s1, r.s2, r.pol, r.s3].join(','), 'EON,IR,BLK,EOW', 'VIC — EOW → EON → IR → EOW · POL 백상 → 흑상');
  t.ok(r.zoom[1] < r.zoom[0] * 0.7 && r.ez === 1.5, `ZOOM ▲ 누르는 동안 좁아진다 (${r.zoom[0]}° → ${r.zoom[1].toFixed(1)}°) · 2X 전자 줌 1.5X`);
  t.ok(r.paint && /^V/.test(r.pick || ''), `레이더 — 선박을 그리고 누르면 지정 (${r.pick})`);
  t.ok(r.slave && r.aim[0] < 0.5 && r.aim[1] < 0.5, `레이더 표적 → EO/IR SLEW (어긋남 ${r.aim.map(x => x.toFixed(2)).join(' · ')}°)`);
  t.eq(r.acq, 'AVT ACQ', 'AVT 한 번 — 게이트(INIT ACQN)');
  t.ok(/^LOCKED V/.test(r.lock), `AVT 두 번 — 게이트 안의 배에 잠금 (${r.lock})`);
  t.ok(r.follow && r.azNow < -1, `기체가 옮겨도 잠근 배를 따라간다 (방위 ${r.azNow.toFixed(1)}°)`);
  t.ok(r.lrf[0] === 'VALID' && Math.abs(r.lrf[1] - r.lrf[2]) < 30, `LRF — ${r.lrf[0]} ${Math.round(r.lrf[1])}m (실제 ${Math.round(r.lrf[2])}m)`);
  t.ok(Math.abs(r.srch.az) < 0.5 && Math.abs(r.srch.el) < 0.5 && !r.srch.lim && r.srchLim, `탐조등 AUTO(SLASS) — EO/IR 시선을 따라가고(어긋남 ${r.srch.az.toFixed(2)} · ${r.srch.el.toFixed(2)}°) 구동 한계(−20°) 밖이면 LIMIT`);
  t.ok(r.fwd[0] === 'FWD' && r.fwd[1] === 0 && r.fwd[2] === -5, `FWD — 전방 (${r.fwd.join(' ')})`);
  t.ok(r.arm && r.fire && /hcu-lamp g/.test(r.lamps) && /hcu-lamp a/.test(r.lamps), `MENU → LASER ARM · LASER 조사 · 표시등 ON(녹) · ARMED(황) (${r.lamps})`);

  // ── 화면 — EO/IR 영상(3D 지도) · 오버레이 · 레이더 ──
  const v = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    eo.mode = 'MAN'; eo.az = 0; eo.el = -8; rdr.tx = true;
    await w(1500);
    const lit = (sel, wht) => { const c = document.querySelector(sel); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += (wht ? 4 : 64)) if (wht ? (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) : (d[i + 1] > 150 && d[i] < 120)) n++; return n; };
    const o = { map: !!_eoMap && !!document.querySelector('#msn-root .eo-vid .eo-map'), hud: lit('#msn-root .eo-hud', true), rdr: lit('#msn-root .msn-rdr canvas'), filt: document.querySelector('#msn-root .eo-vid').style.filter };
    eo.sensor = 'IR'; eo.pol = 'BLK'; await w(150); o.ir = document.querySelector('#msn-root .eo-vid').style.filter;
    eo.sensor = 'EOW'; eo.pol = 'WHT';
    // ── 조종석 SYSTEM 창 Video(EO/IR) — 전탐석 영상 · 오버레이가 그대로 ──
    const keep = { ch: videoCfg.ch, lay: sysLayout, pg: sysPage };
    videoCfg.ch = 'EO/IR'; sysLayout = 'FULL';
    let calls = 0; const real = window.eoirVideoDrawTo; window.eoirVideoDrawTo = (...a) => { calls++; return real(...a); };
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 548;
    eo.mode = 'MAN'; eo.az = 30; eo.el = -6; eoStep(0.05);
    sysDrawTo(cv, 'asys_video');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let wht = 0; for (let i = 0; i < d.length; i += 32) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) wht++;
    o.ck = { calls, wht };
    sysLayout = 'HALF'; sysHalf.L = 'asys_video'; calls = 0; sysDrawTo(cv, 'asys_video'); o.ck.half = calls;
    window.eoirVideoDrawTo = real; videoCfg.ch = keep.ch; sysLayout = keep.lay; sysPage = keep.pg; sysHalf.L = 'asys_hocas';
    o.dms = eoDms(37.52361, 'NS'); o.zs = eoZoomStep();
    msnShow(false); o.closed = !document.getElementById('msn-root').classList.contains('on') && !(document.querySelector('#msn-root .eo-map'));
    msnShow(true);
    return o;
  });
  t.ok(v.ck.calls === 1 && v.ck.wht > 100 && v.ck.half === 1, `조종석 SYSTEM 창 Video(EO/IR) — 전탐석 영상 · 오버레이를 그린다(흰 글씨 ${v.ck.wht}점 · FULL · HALF 모두)`);
  t.eq(v.dms + ' ' + v.zs, '37:31:25N 1', '오버레이 위경도는 도:분:초(37:31:25N) · 넓은 화각은 줌 단계 1');
  t.ok(v.map && v.hud > 50 && v.rdr > 20, `EO/IR 영상(3D 지도) · 오버레이(${v.hud}) · 레이더 화면(${v.rdr})을 그린다`);
  t.ok(/grayscale/.test(v.ir) && /invert/.test(v.ir) && !/invert/.test(v.filt), 'IR 흑상(BLK) — 회색조 · 반전');
  t.ok(v.closed, '"조종석 보기" — 전탐석을 닫으면 EO/IR 지도는 화면 밖으로(조종석 SYSTEM 창이 계속 쓴다)');
  // ── 전탐석 표시기 — 4분할 · 2분할 · 한 화면 · 칸 차례 ──
  const D = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    const vis = () => ['map', 'hoist', 'rdr', 'eo'].filter(k => getComputedStyle(document.querySelector('#msn-root .c-' + k)).display !== 'none').join(',');
    const pos = k => { const r = document.querySelector('#msn-root .c-' + k).getBoundingClientRect(); return [r.left, r.top]; };
    const o = {};
    dispKey('multi'); await w(50); o.quad = vis();
    const pm = pos('map'), ph = pos('hoist'), pr = pos('rdr'), pe = pos('eo');
    o.quadPos = pm[0] < ph[0] && pm[1] < pr[1] && pe[0] > pr[0] && pe[1] > ph[1];   // 왼쪽 위 지도 · 오른쪽 위 호이스트 · 왼쪽 아래 레이더 · 오른쪽 아래 EO/IR
    dispKey('split'); await w(50); o.split = vis(); dispKey('ch'); await w(50); o.split2 = vis();
    dispKey('v2'); await w(50); o.one = vis(); dispKey('ch'); await w(50); o.one2 = vis(); dispKey('navi'); await w(50); o.navi = vis();
    dispKey('multi'); rdr.tx = true; await w(1200);
    const px = sel => { const c = document.querySelector(sel); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 64) if (d[i + 3] > 0 && (d[i] > 150 || d[i + 1] > 150)) n++; return n; };
    o.mapOv = px('#msn-root .nv-ov'); o.nvMap = !!_nvMap; o.hoistWant = msnHoistWant();
    o.labels = [...document.querySelectorAll('#msn-root .msn-chl')].map(e => e.textContent).join('|');
    // ── 탐색등 조작기(HSL-1600) ──
    srchMode('MAN'); Object.assign(hsl, { pwr: true, stowed: true, mv: null, az: 0, el: -90, lamp: false, lit: false, cool: 0, fault: false, ir: false, focus: 8 });
    slcPress('lamp', true); slcPress('lamp', false); o.lampStowed = hsl.lamp;                         // STOW 면 켜지지 않는다
    slcPress('init', true); slcPress('init', false); hslStep(HSL.initS + 0.1); o.init = [hsl.stowed, hsl.el];
    slcPress('lamp', true); slcPress('lamp', false); hslStep(2); o.ign = hsl.lit; hslStep(3.5); o.lit = hsl.lit;
    o.beam = hslBeam(); hsl.ir = true; o.irBare = hslBeam(); hsl.ir = false;
    slcPress('manauto', true); slcPress('manauto', false); o.auto = srch.mode;
    slcPress('manauto', true); slcPress('manauto', false);
    slc.joy.x = -1; slc.joy.y = 1; const az0 = hsl.az, el0 = hsl.el; slcStep(1); slc.joy.x = 0; slc.joy.y = 0; o.slew = [hsl.az - az0, hsl.el - el0];
    slc.joy.x = 1; for (let i = 0; i < 20; i++) slcStep(1); slc.joy.x = 0; o.azMax = hsl.az;
    hsl.focus = 4; const nb = hslBeam(); hsl.focus = 13; const wb = hslBeam(); o.focus = [nb.wide < wb.wide, nb.k > wb.k]; hsl.focus = 8;
    // EO/IR 영상에 탐조등 빛 무리가 보인다(밤 · 주간 카메라) — 열상(IR)에는 안 보인다
    { const alt0 = S.alt, tod0 = env.tod, sen0 = eo.sensor, az0 = eo.az, el0 = eo.el, mode0 = eo.mode;
      S.alt = _mGndFt(S.lat, S.lon) + 800; envSet({ tod: 'NIGHT' }); Object.assign(eo, { pwr: true, mode: 'MAN', sensor: 'EOW', az: -30, el: -35 }); hsl.az = -30; hsl.el = -35;
      _eoCamera(); await w(400); _eoCamera();
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
      const lum = () => { const g = cv.getContext('2d'); g.clearRect(0, 0, 400, 300); eoirVideoDrawTo(g, 0, 0, 400, 300); const d = g.getImageData(0, 0, 400, 300).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i] + d[i + 1] + d[i + 2]; return t / (d.length / 4) / 3; };
      o.eoSpot = eoBeamSpots().length; const on = lum(); hsl.lit = false; const off = lum(); hsl.lit = true; o.eoLum = [+on.toFixed(1), +off.toFixed(1)];
      eo.sensor = 'IR'; o.eoSpotIr = eoBeamSpots().length;
      Object.assign(eo, { sensor: sen0, az: az0, el: el0, mode: mode0 }); envSet({ tod: tod0 }); S.alt = alt0; }
    slcRender(); o.lm = [...document.querySelectorAll('#msn-root [data-sll].on')].map(e => e.dataset.sll).join(',');
    slcPress('lamp', true); slcPress('lamp', false); o.cool = [hsl.lit, Math.round(hsl.cool)];
    hslPwrSet(false); o.fault = hsl.fault; hslPwrSet(true); hsl.fault = false; hsl.cool = 0;
    slcPress('init', true); slcPress('init', false); o.stowMv = hsl.mv && hsl.mv.to; hslStep(25.1); o.stow = [hsl.stowed, hsl.az, hsl.el];
    // ── 녹화기(DVR) — 자리 · POWER · REC 표시등 ──
    const box = sel => document.querySelector('#msn-root ' + sel).getBoundingClientRect();
    const bE = box('.msn-eohcu'), bD = box('.dvr'), bC = box('.cln'), bS = box('.slc');
    o.dvrPos = bE.bottom <= bD.top + 2 && bD.bottom <= bC.top + 2 && bS.left >= bE.right - 2;
    o.slcH = Math.round(bS.height); o.colAH = Math.round(bC.bottom - bE.top);
    dvrPress('rec'); o.dvrOff = dvr.rec; dvrPress('power'); dvrPress('rec'); o.dvrBoot = !dvr.rec && dvr.boot > 0; dvr.boot = 0; dvrPress('rec'); dvrRender(); o.dvr = [dvr.pwr, dvr.rec, document.querySelector('[data-dvl="pwr"]').className]; dvrPress('rec'); dvrPress('power');
    // ── 탐색레이더 조작기(VCCP · Seaspray 5000E) ──
    S.hdg = 0; rdr.menu = null; rdr.rng = 20;
    rdr.cmd = 'CKPT'; clnPress('rot:1', true); o.ckpt = rdr.rng === 20;                     // 조종실이 쥐고 있으면 듣지 않는다
    clnPress('fnc', true); rdr.menuI = 2; clnPress('push', true); clnPress('push', false); o.cmd = rdr.cmd; clnPress('esc', true); o.esc = rdr.menu === null;
    clnPress('rot:1', true); o.rUp = rdr.rng; clnPress('rot:-1', true); clnPress('rot:-1', true); o.rDn = rdr.rng;
    msnVslClear(); msnSpawn(1, { brg: 20, nm: 3, spd: 0, anywhere: true }); rdr.trkNo = {}; rdr.tgt = null; rdr.paint = {}; rdr.tx = true; rdr.frz = false; rdr.az = 0; rdr.dir = 1;
    for (let i = 0; i < 80; i++) rdrStep(0.05);
    rdr.cur = { az: 0, nm: 3 }; for (let i = 0; i < 10; i++) clnPress('pan:e', true);
    clnPress('push', true); clnPress('push', false); o.tgt = rdr.tgt; o.trk = rdr.trkNo[rdr.tgt];
    clnPress('clr', true); o.clr = rdr.tgt === null;
    clnPress('wxr', true); o.wxr = rdr.wxr; clnPress('wxr', true);
    clnPress('map', true); o.mapMenu = rdr.menu; const tws0 = rdr.tws; clnPress('rot:1', true); clnPress('push', true); clnPress('push', false); o.tws = rdr.tws !== tws0; clnPress('esc', true); rdr.tws = tws0;
    const m0 = rdr.mode; msnAct('rmode'); o.mode = [m0, rdr.mode];
    rdr.mode = 'SART'; sarPlaceAt(...destPoint(S.lat, S.lon, 10, 2)); o.sart = !!rdrSartReply(); rdr.mode = 'LRS';
    rdr.frz = true; const az1 = rdr.az; rdrStep(0.5); o.frz = rdr.az === az1; rdr.frz = false;
    rdrPower(false); rdrPower(true); o.warm = rdr.warm > 80 && !rdrTx(true); rdr.warm = 0; rdrTx(true);
    const rc = document.querySelector('#msn-root .msn-rdr canvas'); _rdrDraw(rc); const dd = rc.getContext('2d').getImageData(0, 24, rc.width, 40).data; let gn = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i + 1] > 150) gn++; o.hdr = gn;
    // ── 조종석 하부 콘솔 ⑮ VCCP — 같은 면판 · 같은 레이더 · 권한 CKPT/SHARED ──
    try { lconShow(); } catch (e) { o.lconErr = String(e); }
    const vh = document.getElementById('vccpL'); o.vccp = !!(vh && vh.querySelector('.cln [data-cln="push"]') && vh.querySelectorAll('[data-cln]').length === document.querySelectorAll('#msn-root [data-cln]').length);
    const vp = k => { const b = vh.querySelector(`[data-cln="${k}"]`); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 })); };
    rdr.menu = null; rdr.rng = 20; rdr.cmd = 'CABIN'; vp('rot:1'); o.vcCabin = rdr.rng === 20;
    rdr.cmd = 'SHARED'; vp('rot:1'); o.vcShared = rdr.rng === 50; vp('wxr'); vccpRender(); o.vcLed = vh.querySelector('[data-cln="wxr"]').classList.contains('on') && rdr.wxr; vp('wxr');
    rdr.cmd = 'CKPT'; clnPress('rot:1', true); o.cabCkpt = rdr.rng === 50; vp('rot:-1'); o.vcCkpt = rdr.rng === 20;
    // ── 조종석 SYSTEM 창 Video(Channel RADAR) — 전탐석 레이더 화면 그대로 ──
    { const seen = [], f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return f.call(this, x, ...a); };
      const ch0 = videoCfg.ch, pg0 = sysPage, lay0 = sysLayout;
      try { videoCfg.ch = 'RADAR'; sysLayout = 'FULL'; sysPageSet('asys_video'); const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; sysDrawTo(cv);
        const px = cv.getContext('2d').getImageData(227, 49, 766, 574).data; let gn = 0; for (let i = 0; i < px.length; i += 16) if (px[i + 1] > 150 && px[i] < 120) gn++; o.sysGreen = gn;
      } finally { CanvasRenderingContext2D.prototype.fillText = f; videoCfg.ch = ch0; sysLayout = lay0; try { sysPageSet(pg0); } catch (e) { /* */ } }
      o.sysRdr = seen.some(x => /SRV RDR CMD/.test(x)) && seen.some(x => /RDR (TX|STBY)/.test(x)); }
    // ── 녹화기(DVR · FLM 5.19) — 녹화 · 재생 · 메뉴 · 검색 · USB(AVI) ──
    { msnShow(true); dispSet({ lay: 'quad' }); dvr.fr = []; dvr.seg = []; dvr.pwr = false; dvrPress('power'); dvr.boot = 0; dvrPress('rec');
      const t0 = Date.now() - 60000; for (let i = 0; i < 6; i++) dvrCapture(t0 + i * 2000); for (let i = 0; i < 3; i++) dvrCapture(t0 + 40000 + i * 2000);
      o.dvRec = [dvr.fr.length, dvr.seg.length, !!dvr.fr[0].c[2], !!dvr.fr[0].c[3], !!dvr.fr[0].c[1] === dvrConn(1)].join();
      dvrRender(); o.dvLed = [document.querySelector('[data-dvl="ch1"]').className.includes('on') ? 1 : 0, dvrConn(1) ? 1 : 0];
      dvrPress('rec'); dvrRender(); o.dvStop = !dvr.rec && /on/.test(document.querySelector('[data-dvl="rec"]').className) && /on/.test(document.querySelector('[data-dvl="ch2"]').className);
      dvrPress('playback'); o.dvPlay = dvr.play && dvr.pb.t === dvr.seg[1].t0 && /blue/.test(document.querySelector('[data-dvl="play"]').className);
      dvrPress('ff'); dvrPress('ff'); o.dvFf = dvrSpeed() === 4 && dvr.pb.dir === 1; for (let i = 0; i < 12; i++) dvrPress('ff'); o.dvMax = dvrSpeed();
      dvrPress('rew'); o.dvRew = dvr.pb.dir === -1 && dvrSpeed() === 2; dvrPress('play'); o.dvPlay1 = dvrSpeed() === 1 && dvr.pb.dir === 1;
      dvrPress('down'); o.dvHalf = dvrSpeed();
      dvrSeek(dvr.seg[0].t0); dvrPress('right'); o.dvGap = dvr.pb.t === dvr.seg[0].t1;    // +10초가 끝을 넘으면 그 녹화 끝(틈 앞)
      dvrSeek(dvr.seg[0].t0 + 1000); dvr.pb.dir = 1; dvr.pb.si = 1; dvr.pb.pause = false; const pt = dvr.pb.t; dvrStep(2); o.dvStep = dvr.pb.t - pt;
      dvrPlayDraw(); const pc = document.querySelector('#msn-root .c-rdr canvas.dvr-pb'); o.dvDraw = !!pc && pc.style.display !== 'none';
      dvrPress('menu'); o.dvMenu = dvr.menu === 'MAIN' && /DVR MENU/.test(document.querySelector('#msn-root .dvr-osd').textContent);
      dvrPress('down'); dvrPress('enter'); o.dvView = DVR_VIEWS[dvr.view] === 'CH1' && disp.lay === 'one' && DISP_CH[disp.ch] === 'hoist';
      dvrPress('up'); dvrPress('enter'); o.dvSrch = dvr.menu === 'SEARCH' && /SEARCH/.test(document.querySelector('#msn-root .dvr-osd').textContent) && !!document.querySelector('#msn-root .dvr-cal i.rec');
      dvr.srch.t = dvr.seg[0].t0; dvr.srch.f = 5; dvrPress('up'); dvrPress('up'); dvrPress('enter'); o.dvGo = dvr.menu === null && dvr.play && dvr.pb.t >= dvr.seg[0].t0 + 2000 && dvr.pb.t < dvr.seg[0].t0 + 3000;
      window.__dvrNoDl = true; const files = await dvrExport(); const names = Object.keys(files || {});
      const av = files && files[names.find(n => /CH2/.test(n))], hd = av ? String.fromCharCode(...new Uint8Array(av).slice(0, 12)) : '';
      o.dvExp = names.length >= 2 && /^RIFF....AVI $/s.test(hd) && new TextDecoder().decode(new Uint8Array(av)).includes('MJPG') && dvr.exp.frames === 6;
      dvrPress('menu'); dvr.menuI = 3; dvrPress('enter'); o.dvInfo = /SSD INFO/.test(document.querySelector('#msn-root .dvr-osd').textContent) && dvrSsd().sec === 18;
      dvrPress('back'); dvrPress('back'); dvrPress('back'); o.dvEnd = !dvr.menu && !dvr.play;
      dvrPress('power'); o.dvOff = !dvr.pwr && !dvr.rec; dvr.fr = []; dvr.seg = []; dvr.view = 0; dispSet({ lay: 'quad' }); }
    return o;
  });
  t.eq(D.quad, 'map,hoist,rdr,eo', 'MULTI — 4분할(지도 · 호이스트 · 레이더 · EO/IR)');
  t.ok(D.quadPos, '4분할 자리 — 왼쪽 위 지도 · 오른쪽 위 호이스트 카메라 · 왼쪽 아래 레이더 · 오른쪽 아래 EO/IR');
  t.ok(D.split === 'map,eo' && D.split2 === 'rdr,eo', `SPLIT — 2분할 · CH 로 짝 바꾸기 (${D.split} → ${D.split2})`);
  t.ok(D.one === 'rdr' && D.one2 === 'hoist' && D.navi === 'map', `한 화면 — V-IN 2 레이더 · CH 다음 · NAVI 지도 (${D.one} · ${D.one2} · ${D.navi})`);
  t.ok(D.nvMap && D.mapOv > 30 && D.hoistWant && /CH1 \/ 30fps/.test(D.labels), `지도 칸(좌표 · 기체 · ${D.mapOv}점) · 호이스트 카메라 칸 · 채널 이름`);
  t.ok(!D.lampStowed && D.init[0] === false && D.init[1] === -45, `HSL-1600 — STOW 면 램프가 켜지지 않고 · INIT 로 풀면 −45° (${D.init})`);
  t.ok(!D.ign && D.lit && D.beam && D.beam.down === 45 && D.irBare === null, 'LAMP — 5초 안에 켜진다 · 3D 빛 무리 · IR 은 NVG 없이는 보이지 않는다');
  t.ok(D.auto === 'EO' && D.slew[0] < -20 && D.slew[1] > 15 && D.azMax === 30, `MAN/AUTO · 조이스틱 — 방위 ${D.slew[0].toFixed(0)}° · 고각 +${D.slew[1].toFixed(0)}°/s · 오른쪽 한계 +30°`);
  t.ok(D.eoSpot >= 1 && D.eoLum[0] > D.eoLum[1] + 4 && D.eoSpotIr === 0, `EO/IR 영상에 탐조등 빛 무리 — 밤 주간 카메라(밝기 ${D.eoLum[1]} → ${D.eoLum[0]}) · 열상(IR)에는 없음`);
  t.ok(D.focus[0] && D.focus[1], 'FOCUS — 4°(Spot)는 좁고 밝게 · 13°(Flood)는 넓게');
  t.ok(/PWR/.test(D.lm) && /LAMP/.test(D.lm) && D.cool[0] === false && D.cool[1] === 420 && D.fault, `표시등(${D.lm}) · 끄면 냉각팬 7분(${D.cool[1]}s) · 그동안 전원을 끊으면 FAULT`);
  t.ok(D.stowMv === 'STOW' && D.stow[0] && D.stow[1] === 0 && D.stow[2] === -90, `INIT/STOW — STOW 25초 뒤 0° · −90° (${D.stow})`);
  t.ok(D.dvrPos && D.slcH > D.colAH * 0.6, `오른쪽 — EO/IR 조작기 밑에 녹화기, 그 밑에 레이더 조작기 · 옆에 키운 탐조등 조작기(높이 ${D.slcH} / ${D.colAH}px)`);
  t.ok(!D.dvrOff && D.dvrBoot && D.dvr[0] && D.dvr[1] && /red/.test(D.dvr[2]), '녹화기 — POWER 가 꺼져 있으면 REC 안 됨 · 켜면 빨강 POWER 표시등 · 시동 3초 뒤 REC');
  t.ok(D.ckpt && D.cmd === 'CABIN' && D.esc, `RDR > CMD — CKPT 면 전탐석 조작을 듣지 않고 · FNC 메뉴로 ${D.cmd} 로 바꾼다 · ESC 로 닫는다`);
  t.ok(D.rUp === 50 && D.rDn === 10, `VCCP 손잡이 돌림 — 거리 20 → ${D.rUp} → ${D.rDn}NM`);
  t.ok(/^V/.test(D.tgt || '') && D.trk >= 1 && D.clr && D.wxr, `4축 커서로 옮겨 누르면 표적 추적(${D.tgt} · TRK${D.trk}) · CLR 로 풀기 · WXR 겹`);
  t.ok(D.mapMenu === 'MAP' && D.tws, 'MAP 메뉴 — 손잡이로 고르고 눌러 TWS 지형 겹을 바꾼다');
  t.ok(D.mode[0] === 'LRS' && D.mode[1] === 'WX' && D.sart, `모드 LRS → WX · SART 모드에서 요구조자 트랜스폰더 응답`);
  t.ok(D.frz && D.warm, 'FREEZE — 화면 고정 · 전원을 다시 넣으면 90초 예열 동안 TX 안 됨');
  t.ok(D.hdr > 40, `레이더 화면 위 — Hdg · Trk · SRV RDR CMD · RNG · Tilt · Gain (${D.hdr}점)`);
  t.ok(D.vccp && D.vcCabin && D.vcShared && D.vcLed && D.cabCkpt && D.vcCkpt, `조종석 하부 콘솔 ⑮ VCCP — 전탐석과 같은 면판 · 같은 레이더 · CABIN 이면 듣지 않고 SHARED · CKPT 에서 다룬다 (${[D.vccp, D.vcCabin, D.vcShared, D.vcLed, D.cabCkpt, D.vcCkpt]}${D.lconErr ? ' ' + D.lconErr : ''})`);
  t.ok(D.sysRdr && D.sysGreen > 50, `조종석 SYSTEM 창 Video RADAR — 전탐석 레이더 화면(머리 글자 · 녹색 ${D.sysGreen}점)`);
  t.ok(D.dvRec === '9,2,true,true,true' && D.dvLed[0] === D.dvLed[1] && D.dvStop, `녹화기 REC — 채널마다 한 장씩(${D.dvRec}) · 녹화 두 토막 · CH1 은 호이스트 전원 · 멈추면 초록 표시등`);
  t.ok(D.dvPlay && D.dvFf && D.dvMax === 256 && D.dvRew && D.dvPlay1 && D.dvHalf === 0.5, `PLAYBACK(파랑) — ▶▶ 2 · 4 … ${D.dvMax}배 · ◀◀ 뒤로 · ❙❙▶ 1배 · ▼ ${D.dvHalf}배`);
  t.ok(D.dvGap && D.dvStep === 2000 && D.dvDraw, `재생 — ◀▶ 10초 · 2초 지나면 2초 앞 (${D.dvStep}ms) · 칸마다 녹화 장`);
  t.ok(D.dvMenu && D.dvView && D.dvSrch && D.dvGo && D.dvInfo && D.dvEnd, `MENU — PLAYBACK VIEW(QUAD · CH1 전체) · 날짜/시간 검색(달력) · ENTER 그 시각부터 재생 · SSD INFO · ↩ (${[D.dvMenu, D.dvView, D.dvSrch, D.dvGo, D.dvInfo, D.dvEnd]})`);
  t.ok(D.dvExp && D.dvOff, 'USB 내보내기 — 채널마다 MJPEG AVI(RIFF · MJPG) · POWER OFF 면 녹화 멈춤');
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
  // ── LOFT — 조종석 오른쪽 버튼 줄 맨 아래 🎯 전탐석 · 전탐석 ⧉ 새 창 ──
  const L = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
    msnShow(false); cockpitStart(); await w(1500);
    const b = document.getElementById('msn-open-btn'), ctl = document.getElementById('ctl3d');
    o.ctl = !!ctl && b.parentElement === ctl && ctl.lastElementChild === b;
    o.split = [...ctl.children].some(c => /Split screen/.test(c.textContent));
    b.click(); await w(200); o.open = msnOpen;
    o.pop = msnPopout(); await w(800); o.popped = msnPopped() && document.getElementById('msn-root').ownerDocument !== window.document;
    msnPopout(); await w(400); o.back = !msnPopped() && document.getElementById('msn-root').ownerDocument === window.document;
    msnShow(false); try { exitSolo(); } catch (e) { /* */ } await w(300);
    return o;
  });
  t.ok(L.ctl && L.split && L.open, `조종석(3D) 화면 — 🎯 전탐석 이 오른쪽 버튼 줄 맨 아래(Split screen 밑) · 누르면 전탐석 (${JSON.stringify(L)})`);
  t.ok(L.pop && L.popped && L.back, 'LOFT — 전탐석 ⧉ 새 창(다른 모니터) · 다시 누르면 이 창으로');
  if (process.env.MSN_SHOT) { await page.evaluate(() => { msnSpawn(4); rdr.tx = true; }); await page.waitForTimeout(3500); await page.screenshot({ path: process.env.MSN_SHOT }); }
  // 다음 묶음이 전탐석을 물려받지 않게
  await page.evaluate(() => { msnShow(false); msnVslClear(); rdr.tx = false; });
}
