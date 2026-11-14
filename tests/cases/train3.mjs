// 훈련 보강 3 — 유압 · 무게중심 · 호버 성능(Bell) · 밤 불빛 · 구름 · 돌풍 · RA 콜아웃 · 체크리스트 자동 확인 · 관제 응답 ·
// 교관 화면(IOS) · 비행 저장 · 보고서 · 도움말
export const name = '훈련 보강 3';

export async function run(page, t) {
  // ── Bell — 유압 · 무게중심 · 호버 성능 ──
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const B = await page.evaluate(async () => {
    const o = {};
    o.hyd0 = b206HydOn();
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600; c.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:600px;z-index:99999';
    document.body.appendChild(c); b206Draw(c.getContext('2d'), 0, 0, 1000, 600);
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 930, clientY: 150 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    o.hydOff = !b206HydOn() && !b206Hyd.sw; o.lamp = b206Cautions(b206Vals(), b206Annun(b206Vals()))[0];
    o.k = simHydK();
    b206HydSet(true); b206HydFail(true); o.fail = !b206HydOn(); b206HydFail(false); o.back = b206HydOn();
    c.remove();
    // 무게중심 — 기본 · 뒤 화물을 많이 실으면 뒤로 넘는다
    const w0 = Object.assign({}, b206Wb); o.cg0 = b206Cg(); o.ok0 = b206CgOk();
    b206WbSet({ cargo: 250, copilot: 0 }); o.cg1 = b206Cg(); o.ok1 = b206CgOk(); o.pitch1 = simCgPitch();
    Object.assign(b206Wb, w0);
    // 호버 성능 — 지금 고도에서 HIGE/HOGE · 가용
    const a0 = S.alt; S.alt = 0; o.h0 = b206HoverCheck(); S.alt = 9000; o.h9 = b206HoverCheck(); S.alt = a0;
    // W&B 창 — 무게중심 · 호버 줄
    b206WbOpen(); const wb = document.getElementById('wb-wrap'); o.wbTxt = wb.querySelector('[data-wbv="sum"]').textContent; wb.style.display = 'none';
    return o;
  });
  t.ok(B.hyd0 && B.hydOff && B.lamp[0] === 'HYD PRESS' && B.lamp[1] && B.k < 0.5 && B.fail && B.back,
    `HYD SYS 스위치 — 끄면(또는 고장) 유압이 없다 · HYD PRESS 주의등 · 조종 반응 ${B.k}배`);
  t.ok(B.ok0 && B.cg0 > 106 && B.cg0 < 114.2 && !B.ok1 && B.cg1 > 114.2 && B.pitch1 > 0,
    `무게중심 — 기본 ${B.cg0.toFixed(1)}in(허용 안) · 뒤 화물 250lb 면 ${B.cg1.toFixed(1)}in(뒤로 넘음 · 기수 ${B.pitch1.toFixed(1)}° 듦)`);
  t.ok(B.h0.ogeOk && B.h0.ogeMargin > 5 && B.h9.oge > B.h0.oge && B.h9.mta < B.h0.mta,
    `호버 성능 — 해면 HOGE ${B.h0.oge.toFixed(0)}% / 가용 ${B.h0.mta.toFixed(0)}% · 9,000ft HOGE ${B.h9.oge.toFixed(0)}% / ${B.h9.mta.toFixed(0)}%`);
  t.ok(/무게중심/.test(B.wbTxt) && /HIGE/.test(B.wbTxt) && /HOGE/.test(B.wbTxt), 'W&B 창에 무게중심 막대와 호버 성능(HIGE/HOGE · 여유)이 나온다');

  // ── 관제 응답(Bell PTT) · 체크리스트 자동 확인 ──
  const A = await page.evaluate(async () => {
    const o = {}; speakLog.length = 0;
    const a0 = { lat: S.lat, lon: S.lon, alt: S.alt }, gnd0 = window.sndOnGround;
    const ap = AIRPORTS_KR.find(x => x.icao === 'RKSS'); S.lat = ap.lat + 0.05; S.lon = ap.lon; S.alt = 1500;
    window.sndOnGround = () => false;
    const info = AIRFIELD_INFO.find(x => x.code === 'SS'), twr = parseFloat(info.twr);
    o.fac = atcFacility(twr); o.none = atcFacility(129.95);
    o.txt = atcReply(o.fac);
    window.sndOnGround = () => true; o.txtGnd = atcReply(o.fac);
    // APP — 코드를 주고 · 맞추면 레이더 포착
    atcSquawk = null; const app = atcFacility(parseFloat((info.app.match(/1[1-3]\d\.\d+/) || [])[0]));
    o.app = !!app;
    if (app) { o.sq1 = atcReply(app); b206r.xpdr.code = atcSquawk; b206r.xpdr.mode = 'ALT'; o.sq2 = atcReply(app); }
    // PTT 를 놓으면 그 주파수로 답한다
    window.sndOnGround = () => false;
    b206r.aud.mic = '1'; b206r.gns.on = true; b206r.gns.com[0] = twr; speakLog.length = 0; atcExpect = null;
    b206Ptt(true); b206Ptt(false); await new Promise(r => setTimeout(r, 1800)); o.ptt = speakLog.slice();
    window.sndOnGround = gnd0; Object.assign(S, a0);
    // 체크리스트
    o.cl = [clAutoState('BATT 스위치 – ON'), clAutoState('PITOT HEAT – AUTO'), clAutoState('PCD – OFF'), clAutoState('헤드셋 및 조종 장갑 – 착용')];
    const p0 = ovhdGet('pitotHeat'); ovhdSet('pitotHeat', 'AUTO'); o.pitotAuto = clAutoState('PITOT HEAT – AUTO'); ovhdSet('pitotHeat', 'OFF'); o.pitotOff = clAutoState('PITOT HEAT – AUTO'); ovhdSet('pitotHeat', p0);
    return o;
  });
  t.ok(A.fac && A.fac.kind === 'TWR' && A.fac.icao === 'RKSS' && !A.none && /cleared to land/.test(A.txt) && /cleared for takeoff/.test(A.txtGnd),
    `관제 — 김포 TWR 주파수: 공중 10NM 안 "착륙 허가" · 땅 위 "이륙 허가" (${A.txt.slice(0, 60)}…)`);
  t.ok(!A.app || (/squawk/.test(A.sq1) && /radar contact/.test(A.sq2)), `APP — 코드를 주고, 맞추면 레이더 포착 (${A.app ? A.sq2.slice(0, 50) : '주파수 없음'})`);
  t.ok(A.ptt.length === 1 && /Tower/.test(A.ptt[0]), 'PTT 로 송신하고 놓으면 1.5초 뒤 관제가 답한다');
  t.ok(A.cl[3] === null && A.pitotAuto && A.pitotAuto.ok && A.pitotOff && !A.pitotOff.ok && A.pitotOff.now === 'OFF',
    '체크리스트 — 콘솔 스위치 항목은 지금 상태로 자동 확인(맞으면 ✓ · 다르면 지금 값) · 확인할 수 없는 항목은 그대로');

  // ── 흰수리로 — 밤 불빛 · 구름 · RA 콜아웃 · 교관 화면 · 비행 저장 · 보고서 · 도움말 ──
  u.searchParams.set('ac', 'aw189'); await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof leafMap === 'object' && typeof envSet === 'function', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const N = await page.evaluate(async () => {
    const o = {};
    // 함정 HAPI — 접근각으로 색
    shipLat = 37.0; shipLon = 126.0; shipHdg = 0; shipVisible = true;
    const td = (() => { const tdy = -SHIP3D_TD.fwd; return [shipLat - tdy / 110540, shipLon]; })();
    const at = (deg, dM) => { S.lat = td[0] - dM / 110540; S.lon = td[1]; S.alt = SHIP3D_DECK / 0.3048 + Math.tan(deg * Math.PI / 180) * dM / 0.3048; _envLightPts(0.25); return envHapi && envHapi.col; };
    o.hapi = [at(3.5, 1500), at(2, 1500), at(6, 1500), at(0.5, 1500)];
    // 착륙등 빛 무리 — 흰수리 ENV 착륙등
    envSet({ ldg: true, tod: 'NIGHT' }); S.alt = 200; o.beams = envBeams().length; envSet({ ldg: false }); o.beams0 = envBeams().length;
    // 요구조자 — 서치라이트(착륙등) 안이면 반사판
    envSet({ ldg: true }); const b = envBeams()[0]; sar.on = true; sar.state = 'wait'; sar.lat = b.lat; sar.lon = b.lon; _envLightPts(0.5); o.sarLit = envSarLit; sar.on = false; envSet({ ldg: false });
    // 구름 — 밑면 1,000ft · 1,500ft 두께
    envSet({ ceil: 1000 }); S.alt = 1600; envFxFrame(); const cl = document.querySelector('#map3d .env-cloud'); o.cloudIn = +cl.style.opacity;
    S.alt = 600; envFxFrame(); o.cloudOut = +cl.style.opacity; envSet({ ceil: 0, tod: 'DAY' });
    // 돌풍
    envSet({ gust: 15 }); const g = []; for (let i = 0; i < 40; i++) { _gustT += 0.5; g.push(envGustNow().dk); } o.gust = { min: Math.min(...g), max: Math.max(...g) }; envSet({ gust: 0 }); o.gust0 = envGustNow().dk;
    shipVisible = false; shipLat = null;
    return o;
  });
  t.ok(N.hapi[0] === '정상' && N.hapi[1] === '조금 낮음' && N.hapi[2] === '높음' && N.hapi[3] === '낮음',
    `함정 HAPI — 3.5° 정상(녹) · 2° 조금 낮음(빨) · 6° 높음(녹 깜빡) · 0.5° 낮음(빨 깜빡) (${N.hapi.join(' · ')})`);
  t.ok(N.beams === 1 && N.beams0 === 0 && N.sarLit, '착륙등 — 앞 땅에 빛 무리 · 그 안의 요구조자 반사판이 빛난다');
  t.ok(N.cloudIn > 0.9 && N.cloudOut === 0, `구름 밑면 1,000ft — 그 위(1,600ft)는 하얗게 가린다 (${N.cloudIn})`);
  t.ok(N.gust.max > 8 && N.gust.max <= 15 && N.gust.min >= 0 && N.gust0 === 0, `돌풍 +15kt — 바람이 0 ~ ${N.gust.max.toFixed(0)}kt 더 세게 흔들린다`);

  const C = await page.evaluate(async () => {
    const o = {}; speakLog.length = 0;
    // RA 콜아웃 — 내려가며 500 · 100 · 50
    envSet({ raCall: true }); const ra0 = window.radarAltFt; let ra = 700; window.radarAltFt = () => ra;
    const run0 = S.running; S.running = true; _raPrev = null;
    for (ra = 700; ra >= 40; ra -= 10) raCalloutStep();
    o.calls = speakLog.slice();
    envSet({ raCall: false }); speakLog.length = 0; for (ra = 700; ra >= 40; ra -= 10) raCalloutStep(); o.off = speakLog.length; envSet({ raCall: true });
    window.radarAltFt = ra0; S.running = run0;
    // 교관 명령 — 바람 · 메시지 · 환경
    iosHandle({ type: 'cmd', c: 'wind', dir: 200, spd: 18 }); o.wind = [windDir, windSpd];
    iosHandle({ type: 'cmd', c: 'env', o: { tod: 'DUSK' } }); o.tod = env.tod; envSet({ tod: 'DAY' }); windSpd = 0;
    iosHandle({ type: 'cmd', c: 'msg', text: '엔진 고장 대비' }); o.msg = [...document.querySelectorAll('.ui-toast')].some(e => /교관: 엔진 고장 대비/.test(e.textContent));
    o.state = iosState();
    // 비행 저장 · 불러오기 · 보고서
    const keep = localStorage.getItem('fdrSaved'); localStorage.removeItem('fdrSaved');
    fdrClear(); fdr.on = true; for (let i = 0; i < 12; i++) { S.alt = 1000 + i * 10; fdrStep(1); }
    o.saved = fdrSaveFlight('검사 비행'); fdrClear(); o.empty = fdr.rows.length;
    o.loaded = fdrLoadFlight(0) && fdr.rows.length === 12 && !fdr.on && Math.abs(fdr.rows[11].alt - 1110) < 0.5;
    const ox = uiOpenExternal; let opened = null; uiOpenExternal = u => { opened = u; };
    const html = fdrReport(); uiOpenExternal = ox; o.report = /^blob:/.test(opened || '') && /비행 강평 보고서/.test(html) && /사건/.test(html) && /<img/.test(html);
    dbfClose();
    if (keep === null) localStorage.removeItem('fdrSaved'); else localStorage.setItem('fdrSaved', keep);
    // 도움말
    document.getElementById('map-help-btn').click(); const hw = document.getElementById('help-wrap');
    o.help = getComputedStyle(hw).display !== 'none' && hw.querySelectorAll('.help-list > div').length >= 10; hw.style.display = 'none';
    return o;
  });
  t.ok(C.calls.join(',') === 'five hundred,one hundred,fifty' && C.off === 0, `RA 콜아웃(흰수리) — 내려가며 ${C.calls.join(' · ')} · ENV 에서 끄면 조용`);
  t.ok(C.wind[0] === 200 && C.wind[1] === 18 && C.tod === 'DUSK' && C.msg && C.state.type === 'state' && C.state.ac === 'aw189',
    '교관 화면(IOS) 명령 — 바람 · 환경 · 메시지가 교육생 창에 걸리고, 상태를 0.5초마다 보낸다');
  t.ok(C.saved && C.empty === 0 && C.loaded && C.report, '비행 저장 · 불러오기(기록은 멈춤) · 보고서(요약 · 항적 · 그래프 · 사건 — 인쇄/PDF)');
  t.ok(C.help, '❓ HELP — 새 단추와 기능 도움말');

  // ── 교관 창(?ios=1) — 다른 창에서 상태를 받고 명령을 보낸다 ──
  // 지도 창의 🧑‍✈️ IOS 단추 — 같은 브라우저에 교관 창을 연다
  const [ios] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => document.getElementById('map-ios-btn').click())]);
  await ios.waitForFunction(() => !!document.getElementById('ios-root'), null, { timeout: 20000 });
  await page.evaluate(() => iosSend());
  await ios.waitForFunction(() => /이어짐/.test(document.querySelector('[data-iosv="link"]').textContent), null, { timeout: 5000 }).catch(() => {});
  const I = await ios.evaluate(() => ({ link: document.querySelector('[data-iosv="link"]').textContent, st: document.querySelector('[data-iosv="state"]').textContent,
    hidden: document.getElementById('map').offsetParent === null }));
  await ios.click('[data-ios="env:tod:NIGHT"]');
  await page.waitForTimeout(400);
  const night = await page.evaluate(() => { const v = env.tod; envSet({ tod: 'DAY' }); return v; });
  await ios.close();
  t.ok(/이어짐/.test(I.link) && /KUH-1CG/.test(I.st) && I.hidden && night === 'NIGHT', `교관 창 — 교육생 상태를 보고(${I.st.slice(0, 30)}…) · 야간을 누르면 교육생 창이 밤이 된다`);

  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
