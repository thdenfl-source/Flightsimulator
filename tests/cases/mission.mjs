// 흰수리 전탐석(37-mission.js) — 기종 고르기 · EO/IR 터릿(시선 · 줌 · AVT · LRF · SLEW) · SAR 레이더(표적 · 지정) · 서치라이트 연동 · HCU
export const name = '흰수리 전탐석 — EO/IR · 레이더 · 서치라이트';

export async function run(page, t) {
  t.ok(await page.evaluate(() => !!document.querySelector('.gate-ac-btn[data-ac="kuhm"]')), '시작 화면 기종 고르기에 "흰수리 전탐석" 이 있다');
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
    rdr.tx = true; rdr.rng = 5; rdr.paint = {};
    for (let i = 0; i < 60; i++) rdrStep(0.05);
    o.paint = !!rdr.paint[v.id];
    const pk = rdrPick(0, -1.5 / 5); o.pick = pk;
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
    // ── 서치라이트 EO/IR 연동 ──
    kgSrchSet(false); srchMode('EO'); for (let i = 0; i < 80; i++) srchStep(0.05);
    o.srch = { on: kgLt.srch, az: kgLt.az - eo.az, dn: kgLt.el + eo.el };
    srchMode('MAN'); kgSrchSet(false);
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
  t.ok(r.srch.on && Math.abs(r.srch.az) < 0.5 && Math.abs(r.srch.dn) < 0.5, `서치라이트 EO/IR 연동 — 켜지고 시선을 따라간다 (어긋남 ${r.srch.az.toFixed(2)} · ${r.srch.dn.toFixed(2)}°)`);
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
    srchMode('MAN'); if (kgLt.srch) kgSrchSet(false);
    slcPress('lamp', true); slcPress('lamp', false); o.lamp = kgLt.srch;
    slcPress('manauto', true); slcPress('manauto', false); o.auto = srch.mode;
    slcPress('manauto', true); slcPress('manauto', false);
    slc.joy.x = 1; const az0 = kgLt.az; slcStep(0.5); slc.joy.x = 0; o.slew = kgLt.az - az0;
    slcPress('init', true); slcPress('init', false); o.stow = [slc.stow, kgLt.srch];
    slcPress('init', true); slcPress('init', false); o.init = slc.stow;
    slcRender(); o.lm = [...document.querySelectorAll('#msn-root [data-sll].on')].map(e => e.dataset.sll).join(',');
    // ── 레이더 · 지도 조작기(EuroNav CLN) ──
    nv.nm = 5; clnPress('rot:1', true); o.zin = nv.nm; clnPress('rot:-1', true); clnPress('rot:-1', true); o.zout = nv.nm; nv.nm = 5;
    msnVslClear(); msnSpawn(1, { brg: 90, nm: 2, spd: 0, anywhere: true }); rdr.tgt = null; nv.cur = null;
    clnPress('push', true); clnPress('push', false); o.cur = !!nv.cur;
    for (let i = 0; i < 5; i++) clnPress('pan:e', true);
    clnPress('push', true); clnPress('push', false); o.tgt = rdr.tgt;
    clnPress('clr', true); o.clr = rdr.tgt === null && nv.cur === null;
    clnPress('wxr', true); o.wxr = nv.wxr; clnPress('wxr', true);
    clnPress('map', true); o.mapKey = vis(); clnPress('esc', true); o.esc = vis();
    return o;
  });
  t.eq(D.quad, 'map,hoist,rdr,eo', 'MULTI — 4분할(지도 · 호이스트 · 레이더 · EO/IR)');
  t.ok(D.quadPos, '4분할 자리 — 왼쪽 위 지도 · 오른쪽 위 호이스트 카메라 · 왼쪽 아래 레이더 · 오른쪽 아래 EO/IR');
  t.ok(D.split === 'map,eo' && D.split2 === 'rdr,eo', `SPLIT — 2분할 · CH 로 짝 바꾸기 (${D.split} → ${D.split2})`);
  t.ok(D.one === 'rdr' && D.one2 === 'hoist' && D.navi === 'map', `한 화면 — V-IN 2 레이더 · CH 다음 · NAVI 지도 (${D.one} · ${D.one2} · ${D.navi})`);
  t.ok(D.nvMap && D.mapOv > 30 && D.hoistWant && /CH1 \/ 30fps/.test(D.labels), `지도 칸(좌표 · 기체 · ${D.mapOv}점) · 호이스트 카메라 칸 · 채널 이름`);
  t.ok(D.lamp && D.auto === 'EO' && D.slew > 5, `탐색등 조작기 — LAMP 켬 · MAN/AUTO 로 EO/IR 연동 · 조이스틱으로 돌림(${D.slew.toFixed(1)}°)`);
  t.ok(D.stow[0] && !D.stow[1] && !D.init && /PWR/.test(D.lm), `INIT/STOW — STOW 면 끄고 거둔다 · INIT 로 푼다 · 표시등 (${D.lm})`);
  t.ok(D.zin === 2 && D.zout === 10, `레이더 조작기 손잡이 돌림 — 지도 확대 · 축소 (${D.zin} · ${D.zout}NM)`);
  t.ok(D.cur && /^V/.test(D.tgt || '') && D.clr && D.wxr, `손잡이 누름 — 커서 · 8방향으로 옮겨 누르면 표적 지정(${D.tgt}) · CLR · WXR`);
  t.ok(D.mapKey === 'map' && D.esc === 'map,hoist,rdr,eo', 'MAP — 지도 화면 · ESC — 4분할로');
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
  if (process.env.MSN_SHOT) { await page.evaluate(() => { msnSpawn(4); rdr.tx = true; }); await page.waitForTimeout(3500); await page.screenshot({ path: process.env.MSN_SHOT }); }
  // 다음 묶음이 전탐석을 물려받지 않게
  await page.evaluate(() => { msnShow(false); msnVslClear(); rdr.tx = false; });
}
