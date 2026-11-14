// 기종 Bell 206B-3(js/00-aircraft.js · js/25-b206panel.js) — 아날로그 계기판이 PFD 창과 Cockpit 모드 계기판 자리에 그려진다
export const name = 'Bell 206';

export async function run(page, t) {
  // 기본 검사는 ?ac=aw189 로 뜬다(tests/lib/env.mjs) — Bell 206 으로 다시 띄운다(판 · 다른 꼬리는 그대로)
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);

  const A = await page.evaluate(() => {
    const o = { ac: AC_TYPE, cls: document.documentElement.classList.contains('ac-b206'), info: acInfo().engines,
                gate: document.querySelectorAll('.gate-ac-btn').length };
    // PFD 창 — drawPFD 가 유리 PFD 대신 b206Draw 를 부른다(유리 PFD 의 자세계 drawAI 는 부르지 않는다)
    let nB = 0, nAI = 0; const oB = b206Draw, oAI = drawAI;
    b206Draw = function (...a) { nB++; return oB.apply(this, a); };
    drawAI = function (...a) { nAI++; return oAI.apply(this, a); };
    try { drawPFD(); } finally { b206Draw = oB; drawAI = oAI; }
    o.nB = nB; o.nAI = nAI;
    // 값 — 엔진이 돌면 NR · N2 는 100 근처, 토크는 206 눈금(연속 85 · 한계 100) 안
    S.spd = 90; S.alt = 1200;
    const v = b206Vals(); o.v = { nr: v.nr, n2: v.n2, tq: v.tq, n1: v.n1, tot: v.tot, gal: v.gal };
    o.an = b206Annun(v);
    o.lowFuel = b206Annun(Object.assign({}, v, { gal: 10 })).lowFuel;
    o.rpmLow = b206Annun(Object.assign({}, v, { nr: 80 })).rpm;
    o.cdi = (() => { const c = b206Cdi(); return Number.isFinite(c.dev) && Math.abs(c.dev) <= 1; })();
    return o;
  });
  t.ok(A.ac === 'b206' && A.cls && A.info === 1, `?ac=b206 — 기종 Bell 206B-3(단발) (${A.ac})`);
  t.ok(A.gate === 2, '시작 화면에 기종 고르기 버튼 둘(Bell 206B-3 · AW189)');
  t.ok(A.nB === 1 && A.nAI === 0, `PFD 창에는 유리 PFD 대신 Bell 206 아날로그 계기판 (b206Draw ${A.nB} · drawAI ${A.nAI})`);
  t.ok(A.v.nr > 95 && A.v.nr < 105 && A.v.n2 > 95 && A.v.n2 <= 100, `회전계 — NR ${A.v.nr.toFixed(0)}% · N2 ${A.v.n2.toFixed(0)}%`);
  t.ok(A.v.tq > 0 && A.v.tq < 100 && A.v.n1 > 60 && A.v.n1 < 106 && A.v.tot > 400 && A.v.tot < 810 && A.v.gal > 0 && A.v.gal <= 91,
    `엔진 계기 값이 206 한계 안 (TQ ${A.v.tq.toFixed(0)}% · N1 ${A.v.n1.toFixed(0)}% · TOT ${A.v.tot.toFixed(0)}°C · 연료 ${A.v.gal.toFixed(0)} gal)`);
  t.ok(!A.an.engOut && !A.an.rpm && A.lowFuel && A.rpmLow, '경고등 — 정상 비행에는 꺼지고, 연료 20 gal 아래 LOW FUEL · NR 90% 아래 RPM 이 켜진다');
  t.ok(A.cdi, 'CDI 편차는 −1…1');

  // Cockpit 모드 — 화면 넷 대신 아날로그 계기판 하나 · 누르면 크게(PFD 팝아웃)
  const C = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    S.alt = 1500; S.spd = 100;
    cockpitStart(); await w(1500);
    const cs = [...document.querySelectorAll('#sim-ckpit canvas.ck-scr')];
    const o = { n: cs.length, w: cs[0] ? cs[0].width : 0 };
    // 계기판이 실제로 그려졌나 — 판 색(회청색) 픽셀이 있다
    try {
      const c = cs[0], g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
      let panel = 0; for (let i = 0; i < d.length; i += 4 * 97) if (Math.abs(d[i] - 0x7f) < 12 && Math.abs(d[i + 1] - 0x8a) < 12 && Math.abs(d[i + 2] - 0x93) < 12) panel++;
      o.panel = panel;
    } catch (e) { o.panel = String(e); }
    cs[0] && cs[0].click(); await w(300);
    o.pop = ckConPop; toggleConsolePop(null); await w(200);
    exitSolo(); await w(400);
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 그만 */ }
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(C.n === 1 && C.w >= 1000 && C.panel > 50, `Cockpit 모드 — 가운데 아날로그 계기판 하나 (캔버스 ${C.n}개 · 너비 ${C.w} · 판 픽셀 ${C.panel})`);
  t.ok(C.pop === 'pfd', '계기판을 누르면 가운데에 크게 뜬다');

  // PFD 창 — 판이 소프트키 줄 · FCP 위에서 끝난다(가려지지 않는다)
  const R = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    exitSolo(); await w(300); selectPanel('left', 'pfd'); await w(400);
    const cr = cvs.getBoundingClientRect(), k = cvs.height / cr.height;
    const sk = document.getElementById('pfd-sk').getBoundingClientRect();
    return { room: b206RoomH(cvs, cvs.height, 0), want: (sk.top - cr.top) * k };
  });
  t.ok(Math.abs(R.room - R.want) < 2, `PFD 창 — 판이 소프트키 · FCP 위까지만 (판 높이 ${Math.round(R.room)} · 소프트키 위 ${Math.round(R.want)})`);

  // 오른쪽 창에 LOWER(무전 스택)를 띄운 채 Cockpit 모드로 — 하부 콘솔이 조종석 칸으로 옮겨진다(숨은 창에 남아 검게 비던 것 · Bell 206 은 UPPER 가 없다)
  const U = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'map'); selectPanel('right', 'lcon'); await w(400);
    cockpitStart(); await w(1500);
    const o = { ovhd: document.getElementById('lcon-wrap').parentElement.id, h: document.getElementById('lcon-wrap').getBoundingClientRect().height };
    exitSolo(); await w(500);
    o.back = document.getElementById('lcon-wrap').parentElement.id;
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 그만 */ }
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(U.ovhd === 'ck-mini-lcon' && U.h > 20, `LOWER 를 띄운 채 Cockpit 모드 — 하부 콘솔(무전 스택)이 조종석에 보인다 (${U.ovhd} · 높이 ${Math.round(U.h)})`);
  t.ok(U.back === 'right-panel', `분할 화면으로 돌아오면 오른쪽 창으로 돌아간다 (${U.back})`);

  // 기종 바꾸기 — 적어 두기만(다시 불러오지 않고)
  const P = await page.evaluate(() => { setAircraftType('aw189', false); const a = localStorage.getItem('shineAc'); setAircraftType('b206', false); return { a, b: localStorage.getItem('shineAc'), bad: setAircraftType('xx', false) }; });
  t.ok(P.a === 'aw189' && P.b === 'b206' && P.bad === false, '기종 고르기는 localStorage(shineAc)에 적힌다 · 없는 기종은 거절');
  // ── 3D 화면에 겹친 계기(계기 ON) — 자세계/볼 · 고도계 · 승강계 · 토크 · 방향지시계 다섯만 ──
  const OV = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.id = 'pfd-ov-cvs'; c.width = 600; c.height = 420; c.dataset.noFcp = '1';
    const names = ['b206Attitude', 'b206Altimeter', 'b206Vsi', 'b206Dg', 'b206RoundGauge', 'b206Airspeed', 'b206Tach', 'b206Rmi', 'b206Turn', 'b206CdiGauge', 'b206DualGauge', 'b206N1', 'b206Clock'];
    const n = {}, orig = {};
    names.forEach(k => { n[k] = 0; orig[k] = window[k]; });
    // 최상위 function 은 window 의 것 — 바꿔 끼워 몇 번 불리는지 센다
    names.forEach(k => { window[k] = function (...a) { n[k]++; return orig[k].apply(this, a); }; });
    const titles = []; const oT = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { titles.push(String(x)); return oT.call(this, x, ...a); };
    try { drawPfdTo(c); } finally { names.forEach(k => { window[k] = orig[k]; }); CanvasRenderingContext2D.prototype.fillText = oT; }
    return { n, torque: titles.includes('TORQUE') };
  });
  const N = OV.n;
  t.ok(N.b206Attitude === 1 && N.b206Altimeter === 1 && N.b206Vsi === 1 && N.b206Dg === 1 && N.b206RoundGauge === 1 && OV.torque,
    '계기 ON — 3D 화면에 자세계(+볼) · 고도계 · 승강계 · 토크 · 방향지시계 다섯이 뜬다');
  t.ok(['b206Airspeed', 'b206Tach', 'b206Rmi', 'b206Turn', 'b206CdiGauge', 'b206DualGauge', 'b206N1', 'b206Clock'].every(k => N[k] === 0),
    `그 밖의 계기(속도계 · 회전계 · RMI · 선회계 · CDI · 엔진 계기 · 시계)는 겹친 계기에 그리지 않는다 (${JSON.stringify(N)})`);
  // ── LOWER CONSOLE — 항공전자 스택(오디오 · GNS 430 · COMM · NAV · ADF · 트랜스폰더 — 26-b206radio.js) ──
  const RD = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    localStorage.removeItem('b206rad');
    selectPanel('right', 'lcon', true); await w(600);
    const host = document.getElementById('b206rad'), o = {};
    o.units = host ? host.querySelectorAll('.b2r-unit').length : 0;
    o.noAw = !document.querySelector('#lcon-wrap [data-ov="ap1"]') && !document.getElementById('c5k');
    o.boot = /PACIFIC/.test(host.textContent) && /Cycle 2311/.test(host.textContent);
    host.querySelector('[data-act2="gns:ent"]').click(); o.nav = /DIS/.test(host.textContent) && /VLOC/.test(host.textContent);
    // 오디오 버튼 — 눌러 켜고 끈다
    const ab = host.querySelector('[data-act2="aud:spk:nav1"]'); const a0 = ab.classList.contains('on'); ab.click(); o.aud = ab.classList.contains('on') !== a0;
    // COMM — 안 노브 + 한 칸(25 kHz) · ⇄ 로 USE 와 바꾼다
    const s0 = b206r.com.f[1]; b206rKnob('com', 'inner', 1); o.comTune = Math.round((b206r.com.f[1] - s0) * 1000);
    const st = b206r.com.f[1]; host.querySelector('[data-act2="com:flip"]').click(); o.comFlip = b206r.com.f[0] === st;
    // NAV — 바꾼 USE 주파수가 시뮬레이터 NAV2 로
    b206rKnob('nav', 'outer', 1); const nf = b206r.nav.f[1]; host.querySelector('[data-act2="nav:flip"]').click();
    o.nav2 = Math.abs(parseFloat(navRadios.NAV2.freq) - nf) < 0.001;
    // GNS VLOC ⇄ → 시뮬레이터 NAV1
    const vf = b206r.gns.vloc[1]; host.querySelector('[data-act2="gns:vflip"]').click(); o.nav1 = Math.abs(parseFloat(navRadios.NAV1.freq) - vf) < 0.001;
    // ADF — FRQ 로 바꾼다
    const af = b206r.adf.f.slice(); host.querySelector('[data-act2="adf:frq"]').click(); o.adf = b206r.adf.f[0] === af[1] && b206r.adf.f[1] === af[0];
    // 트랜스폰더 — VFR 1200 · 노브로 자리 숫자 · CDU 코드와 같다
    host.querySelector('[data-act2="xp:vfr"]').click(); o.vfr = b206r.xpdr.code === '1200' && window.cduXpdrCode() === '1200';
    b206rKnob('xd3', 'outer', 1); o.xd = b206r.xpdr.code === '1201' && window.cduXpdrCode() === '1201';
    b206rKnob('xd3', 'outer', -1);
    // 모드 노브 — ALT 에서 FL(기압고도/100)
    S.alt = 1500; b206r.xpdr.mode = 'ALT'; b206rRender(); o.fl = /015/.test(host.querySelector('[data-b2r="xpdr"]').textContent);
    selectPanel('right', 'map', true);
    return o;
  });
  t.ok(RD.units === 6 && RD.noAw, `LOWER CONSOLE 은 Bell 항공전자 스택 — 여섯 장비(오디오 · GNS 430 · COMM · NAV · ADF · XPDR) · AW189 콘솔은 없다 (${RD.units})`);
  t.ok(RD.boot && RD.nav, 'GNS 430 — 데이터베이스 화면(PACIFIC · Cycle 2311) → ENT 로 항법 화면(COM · VLOC · DIS)');
  t.ok(RD.aud && RD.comTune === 25 && RD.comFlip, `오디오 버튼 켜고 끄기 · COMM 노브 25 kHz · ↔ 로 USE ⇄ STBY (${RD.comTune} kHz)`);
  t.ok(RD.nav2 && RD.nav1, 'NAV 수신기 USE → 시뮬레이터 NAV2 · GNS 430 VLOC → NAV1');
  t.ok(RD.adf && RD.vfr && RD.xd && RD.fl, 'ADF FRQ 바꾸기 · 트랜스폰더 VFR 1200 · 코드 노브 · CDU XPDR 코드와 같다 · ALT 모드 FL');
  // ── Bell 206 — CDU · UPPER CONSOLE 이 없다 · 무전 스택 튜닝이 시뮬레이터 COM · NAV 로 ──
  const NO = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const vis = e => !!e && getComputedStyle(e).display !== 'none';
    const o = {};
    o.tabs = [...document.querySelectorAll('.page-tab[data-sel="cdu"], .page-tab[data-sel="ovhd"], #cdu-solo-btn')].some(vis);
    o.ok = [acScrOk('cdu'), acScrOk('ovhd'), acScrOk('lcon'), acScrOk('map')].join(',');
    selectPanel('right', 'cdu', true); await w(200); o.selCdu = rightSel;          // 골라도 들어가지 않는다
    selectPanel('right', 'ovhd', true); await w(200); o.selOvhd = rightSel;
    o.simple = SIMPLE_SCREENS.map(x => x[0]).join(','); o.lay = SIM_LAYOUT_ORDER.join(',');
    cockpitStart(); await w(1500);
    o.ck = { upMini: !!document.getElementById('ck-mini-ovhd'), cduMini: !!document.getElementById('ck-mini-cdu'),
             upBtn: vis(document.getElementById('upperc-btn')), cduBtn: vis(document.getElementById('cduov-btn')),
             lcon: document.getElementById('lcon-wrap').parentElement.id };
    cockpitExit(); try { if (_soloActive) exitSolo(); } catch (e) { /* 그만 */ }
    selectPanel('right', 'map', true);
    // 튜닝 — GNS COM = COM1 · COMM = COM2 · GNS VLOC = NAV1 · NAV = NAV2(CDU 무전 주파수)
    b206rKnob('gns', 'inner', 1); b206rAct('gns:cflip');
    b206rKnob('com', 'outer', 1); b206rAct('com:flip');
    b206rKnob('nav', 'inner', 2); b206rAct('nav:flip');
    const f = k => window.cduRadio(k);
    o.r = { com1: f('com1').act === b206r.gns.com[0].toFixed(3), com2: f('com2').act === b206r.com.f[0].toFixed(3),
            nav1: f('nav1').act === b206r.gns.vloc[0].toFixed(2) && f('nav1').stb === b206r.gns.vloc[1].toFixed(2),
            nav2: f('nav2').act === b206r.nav.f[0].toFixed(2) && Math.abs(parseFloat(navRadios.NAV2.freq) - b206r.nav.f[0]) < 0.001 };
    // GNS CDI — GPS ⇄ VLOC(항법 소스)
    setNavSrc('FMS'); b206rAct('gns:cdi'); o.cdi1 = navSrc; b206rAct('gns:cdi'); o.cdi2 = navSrc;
    return o;
  });
  t.ok(!NO.tabs && NO.ok === 'false,false,true,true' && NO.selCdu !== 'cdu' && NO.selOvhd !== 'ovhd',
    `Bell 206 — CDU · UPPER 탭이 없고 골라도 들어가지 않는다 (${NO.selCdu} · ${NO.selOvhd})`);
  t.ok(!/cdu|ovhd/.test(NO.simple) && !/cdu|ovhd/.test(NO.lay), `Simple · 창 배치에도 CDU · UPPER 가 없다 (${NO.simple})`);
  t.ok(!NO.ck.upMini && !NO.ck.cduMini && !NO.ck.upBtn && !NO.ck.cduBtn && NO.ck.lcon === 'ck-mini-lcon',
    `Cockpit Mode — 상부 콘솔 · CDU 칸과 UpperC · CDU 버튼이 없고 하부 콘솔(무전 스택)만 (${JSON.stringify(NO.ck)})`);
  t.ok(Object.values(NO.r).every(Boolean), `무전 스택 튜닝 → 시뮬레이터 COM1 · COM2 · NAV1 · NAV2 (${JSON.stringify(NO.r)})`);
  t.ok(NO.cdi1 === 'NAV1' && NO.cdi2 === 'FMS', `GNS 430 CDI — GPS ⇄ VLOC 로 항법 소스를 바꾼다 (${NO.cdi1} → ${NO.cdi2})`);
  // ── RMI — ADF 바늘 = 하부 콘솔 ADF 의 USE 주파수 NDB · NAV2 바늘 = NAV 수신기의 VOR ──
  const RM = await page.evaluate(() => {
    const o = {};
    const ap = AIRPORTS.find(a => a.ident === 'RKSS'); S.lat = ap.lat; S.lon = ap.lon; S.hdg = 90;
    Object.assign(b206r.adf, { on: true, mode: 'ADF', f: [1188, 266] });
    const st = b206AdfStation(), r = b206RmiRel();
    o.st = st && st.id; o.adf = r.adf; o.want = normAS(bearing(S.lat, S.lon, st.lat, st.lon) - S.hdg); o.id = r.adfId;
    b206r.adf.mode = 'ANT'; o.ant = b206RmiRel().adf; b206r.adf.mode = 'ADF';
    b206r.adf.on = false; o.off = b206RmiRel().adf; b206r.adf.on = true;
    b206r.adf.f[0] = 199; o.none = b206RmiRel().adf; b206r.adf.f[0] = 1188;
    // NAV2 — VOR 를 NAV 수신기로 잡으면 굵은 바늘이 그쪽
    const v = (typeof ENR_VORS !== 'undefined' ? ENR_VORS : []).find(x => x.freq && Math.abs(distance(S.lat, S.lon, x.lat, x.lon)) < 80);
    if (v) { b206r.nav.f = [+parseFloat(v.freq).toFixed(2), b206r.nav.f[1]]; b206rAct('nav:flip'); b206rAct('nav:flip'); }
    const r2 = b206RmiRel(); o.nav = r2.nav; o.navId = r2.navId; o.vor = v && v.id;
    o.navWant = v ? normAS(bearing(S.lat, S.lon, navRadios.NAV2.lat, navRadios.NAV2.lon) - S.hdg) : null;
    return o;
  });
  t.ok(RM.st === 'BANGSAN' && Math.abs(RM.adf - RM.want) < 0.01 && RM.id === 'BANGSAN',
    `RMI ADF 바늘 — ADF 1188 kHz 를 맞추면 BANGSAN NDB 쪽을 가리킨다 (상대 방위 ${RM.adf.toFixed(1)}°)`);
  t.ok(RM.ant === null && RM.off === null && RM.none === null, 'ANT 모드 · ADF 꺼짐 · NDB 없는 주파수면 ADF 바늘은 3시에 눕는다(방위 없음)');
  t.ok(RM.vor ? (RM.nav !== null && Math.abs(RM.nav - RM.navWant) < 0.01) : true,
    `RMI NAV2 바늘 — NAV 수신기로 잡은 VOR 쪽 (${RM.vor || '근처 VOR 없음'} ${RM.nav != null ? RM.nav.toFixed(1) + '°' : ''})`);
  // ── ADF 식별음(모스 부호) — 오디오 패널 ADF 1 이 켜져 있고 NDB 를 잡으면 · SYSTEM 창은 없다 ──
  const AU = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    const sch = morseSchedule('BAN', 1);   // B -... A .- N -.
    o.sch = sch.map(([on, off]) => `${on}/${off}`).join(' ');
    const ap = AIRPORTS.find(a => a.ident === 'RKSS'); S.lat = ap.lat; S.lon = ap.lon;
    Object.assign(b206r.adf, { on: true, mode: 'ADF', f: [1188, 266] }); b206r.aud.ivol = 6;
    b206r.aud.spk.adf1 = false; b206r.aud.phn.adf1 = false; o.offBtn = !!b206AdfAudible();
    b206r.aud.spk.adf1 = true; const st = b206AdfAudible(); o.on = st && st.id; o.ident = b206AdfIdent(st);
    b206r.adf.mode = 'ANT'; o.ant = !!b206AdfAudible(); b206r.adf.mode = 'ADF';      // ANT 도 소리는 들린다
    b206r.adf.on = false; o.adfOff = !!b206AdfAudible(); b206r.adf.on = true;
    // 실제로 울리는지 — 소리 내는 함수가 그 식별 부호로 불린다
    const calls = []; const orig = window._adfPlay; window._adfPlay = id => { calls.push(id); return 1; };
    _adfNext = 0; await w(700); window._adfPlay = orig;
    o.calls = calls;
    b206r.aud.spk.adf1 = false;
    // SYSTEM — 탭이 없고 골라도 들어가지 않는다
    o.sysTab = [...document.querySelectorAll('.page-tab[data-sel="sysp"]')].some(e => getComputedStyle(e).display !== 'none');
    selectPanel('left', 'sysp', true); await w(200); o.left = leftSel;
    selectPanel('right', 'sysp', true); await w(200); o.right = rightSel; selectPanel('right', 'map', true);
    o.simple = SIMPLE_SCREENS.map(x => x[0]).includes('sysp');
    return o;
  });
  t.eq(AU.sch, '3/1 1/1 1/1 1/3 1/1 3/3 3/1 1/0', `모스 부호 일정 — B(-...) A(.-) N(-.) · 점 1 · 선 3 · 글자 사이 3 (${AU.sch})`);
  t.ok(!AU.offBtn && AU.on === 'BANGSAN' && AU.ident === 'BAN' && AU.ant && !AU.adfOff,
    `ADF 식별음 — 오디오 패널 ADF 1 을 켜야 들린다 · BANGSAN → 'BAN' · ANT 도 들리고 ADF 를 끄면 없다 (${AU.ident})`);
  t.ok(AU.calls.length >= 1 && AU.calls[0] === 'BAN', `켜 두면 식별 부호를 되풀이해 울린다 (${AU.calls.join(',')})`);
  t.ok(!AU.sysTab && AU.left === 'pfd' && AU.right !== 'sysp' && !AU.simple, `Bell 206 — SYSTEM 창이 없다 (왼쪽 ${AU.left} · 오른쪽 ${AU.right})`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, `오류 없음${errs.length ? ' (' + errs.slice(0, 2).join(' | ') + ')' : ''}`);
}
