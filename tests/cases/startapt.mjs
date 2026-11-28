// 시작 — GPS 는 꺼진 채 · 출발 공항 고르기 · 지도의 흰수리 심볼 · 3D 창의 FLY 버튼
//
// 다른 검사는 출발 공항 창을 이미 고른 것으로 두고 연다(lib/env.mjs). 여기서는 새 탭으로
// 처음 여는 것처럼 열어(비밀번호 잠금만 풀어 두고) 그 창을 본다.
export const name = '출발 공항·지도 심볼';

const ready = p => p.waitForFunction(
  () => typeof S === 'object' && S !== null && typeof leafMap === 'object', null, { timeout: 20000 });

export async function run(page, t) {
  const url = page.url();
  const browser = page.context().browser();

  // ── 처음 열면: GPS 는 꺼져 있고(기기 위치를 묻지 않는다) 출발 공항을 고르는 창이 뜬다 ──
  const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await tab.addInitScript(() => {
    try { sessionStorage.setItem('vfrUnlocked', '1'); } catch (e) { /* 없으면 그만 */ }
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
  const def = await tab.evaluate(() => startRunwayOf(START_APT_DEF));
  t.ok(Math.abs(first.lat - def.lat) < 1e-6 && Math.abs(first.lon - def.lon) < 1e-6, `고르기 전에는 김포 활주로 가운데(기본 위치)다`);

  // 이름으로 걸러 고른다(Enter = 맨 위)
  await tab.fill('.start-apt-q', '김포');
  const shown = await tab.evaluate(() =>
    [...document.querySelectorAll('.start-apt-btn')].filter(b => b.style.display !== 'none').map(b => b.dataset.icao));
  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(300);
  // 이어서 시작 자리 고르기 창 — 아홉 칸(땅 셋 · 5NM 공중 여섯) · Enter 면 활주로 가운데
  const pos = await tab.evaluate(() => ({ dlg: !!document.querySelector('.start-pos'), n: document.querySelectorAll('.start-pos-btn').length, air: document.querySelectorAll('.start-pos-btn.air').length }));
  t.ok(pos.dlg && pos.n === 9 && pos.air === 6, `공항을 고르면 시작 자리 고르기 — 활주로 위 셋 · 5NM 공중 여섯 (${pos.n} · ${pos.air})`);
  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(200);
  // 지형 고도가 늦게 들어와도 곧 지면에 올라선다(09a-start.js _startGroundSettle)
  await tab.waitForFunction(() => typeof simGroundFt === 'function' && Math.abs(S.alt - simGroundFt()) < 1, null, { timeout: 4000 }).catch(() => {});
  const picked = await tab.evaluate(() => {
    const a = startRunwayOf('RKSS');
    const on = id => ovhdGet(id);
    return { dlg: !!document.querySelector('.start-apt'), d: distance(S.lat, S.lon, a.lat, a.lon), rw: a.id,
             hdgErr: Math.abs(((S.hdg - a.hdg + 540) % 360) - 180), hdg: S.hdg,
             eng: ['pcd1', 'pcd2'].every(k => on(k) === 'FLY') && ['fuel1', 'fuel2'].every(k => on(k) === 'OPEN'),
             elec: ['gen1', 'gen2', 'tru1', 'tru2', 'batt'].every(k => on(k) === 'ON') && pwrDc(),
             avn: ['ap1', 'ap2', 'tfCol', 'tfCyc'].every(k => on(k) === 'OUT') && ['avcsPower', 'mpp0', 'mpp1', 'mpp2'].every(k => on(k) === 'IN') && c5.on,
             at: ['atYaw', 'atRoll', 'atPitch'].every(k => on(k) === 'IN'), deg: pfdMsgs().some(m => m.t === 'AFCS DEGRADED'),
             agl: S.alt - simGroundFt(), spd: S.spd, gps: gpsMode, flag: sessionStorage.getItem('vfrStartApt') };
  });
  t.eq(JSON.stringify(shown), '["RKSS"]', `ICAO · 이름으로 걸러 찾는다 (김포 → ${shown.join(',')})`);
  t.ok(!picked.dlg && picked.d < 0.01, `고르면 그 공항 활주로 가운데에서 시작한다 (RKSS RWY ${picked.rw} 가운데에서 ${picked.d.toFixed(3)}NM)`);
  t.ok(picked.hdgErr < 0.5, `활주로 방향으로 선다 (RWY ${picked.rw} · HDG ${picked.hdg.toFixed(1)}°)`);
  t.ok(picked.eng && picked.elec && picked.avn, '시동 · 전기 · 전자장비(AP · AVCS · RADAR/EGPWS/DMM · C-5000)가 모두 켜져 있다');
  t.ok(picked.at && !picked.deg, 'AFCAU 의 AUTO TRIM 만 꺼져 있다 — AFCS DEGRADED 는 뜨지 않는다');
  t.ok(Math.abs(picked.agl) < 1 && picked.spd === 0, `지면에 멈춰 선다 (AGL ${picked.agl.toFixed(1)}ft · ${picked.spd}kt)`);
  // 공중 자리 — 시단에서 5NM · 1500ft · 80kt · 그 시단을 향해(정대 · 좌우 30°) / 땅 자리 — 시단에서 출력 0
  const AIR = await tab.evaluate(() => {
    const R = startRunwayEnds('RKSS'), o = {};
    openStartPosPicker('RKSS'); document.querySelector('.start-pos-btn[data-pos="aS"]').click();
    o.aS = { d: distance(S.lat, S.lon, R.a.lat, R.a.lon), alt: S.alt, spd: S.spd, err: Math.abs(((S.hdg - R.hdg + 540) % 360) - 180), dlg: !!document.querySelector('.start-pos') };
    startPosSet('RKSS', 'bR'); const brgB = _startBrg(R.b, S), off = ((brgB - R.hdg + 540) % 360) - 180;
    o.bR = { d: distance(S.lat, S.lon, R.b.lat, R.b.lon), off, toB: Math.abs(((S.hdg - _startBrg(S, R.b) + 540) % 360) - 180) };
    startPosSet('RKSS', 'thrB'); o.thrB = { d: distance(S.lat, S.lon, R.b.lat, R.b.lon) * 1852, spd: S.spd, hdgErr: Math.abs(((S.hdg - (R.hdg + 180) + 540) % 360) - 180), park: ovhdGet('parkBrake') };
    startAirportSet('RKSS', { quiet: true });
    return o;
  });
  t.ok(!AIR.aS.dlg && Math.abs(AIR.aS.d - 5) < 0.1 && AIR.aS.alt === 1500 && AIR.aS.spd === 80 && AIR.aS.err < 1,
    `공중 정대 — 시단에서 ${AIR.aS.d.toFixed(2)}NM · ${AIR.aS.alt}ft · ${AIR.aS.spd}kt · 활주로 방향`);
  t.ok(Math.abs(AIR.bR.d - 5) < 0.1 && Math.abs(Math.abs(AIR.bR.off) - 30) < 1 && AIR.bR.toB < 1, `공중 30° — 활주로 연장선에서 ${Math.abs(AIR.bR.off).toFixed(1)}° · 그 시단을 향해`);
  t.ok(AIR.thrB.d < 100 && AIR.thrB.spd === 0 && AIR.thrB.hdgErr < 1 && AIR.thrB.park === 'SET', `땅 — 반대쪽 시단(${Math.round(AIR.thrB.d)}m 안)에 활주로 방향 · 출력 0 · 파킹 브레이크`);
  t.eq(picked.gps, false, '고른 뒤에도 GPS 는 꺼진 채다');

  // 같은 탭(세션)에서는 다시 묻지 않는다 — 고르면 sessionStorage 에 적어 두고, 새로고침(자동
  // 리로드 포함)은 그것을 보고 묻지 않는다. 검사 브라우저는 file:// 이라 새로고침하면
  // sessionStorage 를 비우므로(https 에서는 이어진다) 새로고침 대신 시작 셈을 다시 불러 본다.
  t.eq(picked.flag, '1', '고르면 이 탭(세션)에 적어 둔다');
  const again = await tab.evaluate(async () => {
    _startPosInit(true);                                  // 새로고침해 상태를 되살린 것처럼
    await new Promise(r => setTimeout(r, 600));
    return !!document.querySelector('.start-apt');
  });
  t.eq(again, false, '같은 탭에서 새로고침하면 다시 묻지 않는다');
  await tab.close();

  // 건너뛰면 송도 그대로
  const tab2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await tab2.addInitScript(() => { try { sessionStorage.setItem('vfrUnlocked', '1'); } catch (e) { /* 없으면 그만 */ } });
  await tab2.goto(url); await ready(tab2);
  await tab2.waitForSelector('.start-apt', { timeout: 5000 }).catch(() => {});
  await tab2.click('.start-apt-skip').catch(() => {});
  await tab2.waitForTimeout(200);
  const skip = await tab2.evaluate(() => { const r = startRunwayOf('RKSS'); return { dlg: !!document.querySelector('.start-apt'), d: distance(S.lat, S.lon, r.lat, r.lon), agl: S.alt - simGroundFt() }; });
  t.ok(!skip.dlg && skip.d < 0.01 && Math.abs(skip.agl) < 1, `건너뛰면 김포 활주로 가운데 지면에서 시작한다 (${skip.d.toFixed(3)}NM · AGL ${skip.agl.toFixed(1)}ft)`);
  // 지난번 상태(6시간 안의 스냅숏)를 적어 둔다 — 브라우저를 다시 열 때 되살릴 것
  const snap = await tab2.evaluate(() => {
    const a = AIRPORTS.find(x => x.ident === 'RKPC');
    S.lat = a.lat; S.lon = a.lon; saveSession();
    return { snap: localStorage.getItem('flightSession'), lat: a.lat, lon: a.lon };
  });
  await tab2.close();

  // 브라우저를 다시 열면(지난 상태가 남아 있어 되살려도) 다시 묻는다 — 종전에는 묻지 않았다
  const tab3 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await tab3.addInitScript(s => {
    try { sessionStorage.setItem('vfrUnlocked', '1'); if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('flightSession', s); sessionStorage.setItem('__seeded', '1'); } }
    catch (e) { /* 없으면 그만 */ }
  }, snap.snap);
  await tab3.goto(url); await ready(tab3);
  await tab3.waitForSelector('.start-apt', { timeout: 5000 }).catch(() => {});
  const re = await tab3.evaluate(() => ({ dlg: !!document.querySelector('.start-apt'), lat: S.lat, lon: S.lon,
    skip: (document.querySelector('.start-apt-skip') || {}).textContent || '' }));
  t.ok(re.dlg, '브라우저를 다시 열면 지난 상태가 남아 있어도 출발 공항을 다시 묻는다');
  await tab3.click('.start-apt-skip').catch(() => {});
  await tab3.waitForTimeout(200);
  const re2 = await tab3.evaluate(() => { const r = startRunwayOf(START_APT_DEF); return { dlg: !!document.querySelector('.start-apt'), d: distance(S.lat, S.lon, r.lat, r.lon), def: START_APT_DEF,
    ias: iasModeOn(), park: ovhdGet('parkBrake'), flt: ovhdGet('fltArmSw'), nose: ovhdGet('noseLock') }; });
  t.ok(!re2.dlg && re2.d < 0.01 && re2.def === 'RKSS',
    `그때 건너뛰면 지난 자리를 잇지 않고 지난번에 고른 공항(${re2.def}) 활주로 바닥에서 시작한다 (${re.skip})`);
  t.ok(!re2.ias && re2.park === 'SET' && re2.flt === 'ARMED' && re2.nose === 'LOCK',
    `상위모드는 모두 풀린 채(IAS 꺼짐) · 파킹 브레이크 SET · 비상 부주 ARMED · 앞바퀴 LOCK 으로 시작한다 (${re2.park} · ${re2.flt} · ${re2.nose})`);
  await tab3.close();

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

  // ── 3D 창의 FLY / PAUSE — 지도 창의 같은 버튼과 같다 ──
  const fly = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    if (!_view3dOn) toggle3dMap();
    await w(200);
    const b = document.getElementById('fly3d-btn'), m = document.getElementById('map-fly-btn');
    const out = { inside: !!(b && b.closest('#map3d')), shown: b ? getComputedStyle(b).display !== 'none' : false };
    const was = S.running;
    if (S.running) toggleSim();
    b.click(); out.on = { run: S.running, txt: b.textContent, map: m.textContent, cls: b.classList.contains('on') };
    b.click(); out.off = { run: S.running, txt: b.textContent, map: m.textContent };
    m.click(); out.sync = b.textContent; m.click();
    if (S.running !== was) toggleSim();
    if (_view3dOn) toggle3dMap();
    return out;
  });
  t.ok(fly.inside && fly.shown, '3D 창 안에 FLY 버튼이 있다(EXT 아래)');
  t.ok(fly.on.run && fly.on.cls && /PAUSE/.test(fly.on.txt) && fly.on.map === fly.on.txt,
    `누르면 날고 PAUSE 로 바뀐다 — 지도 창 버튼도 같이 (${fly.on.txt})`);
  t.ok(!fly.off.run && /FLY/.test(fly.off.txt) && fly.off.map === fly.off.txt, '다시 누르면 멈춘다');
  t.ok(/PAUSE/.test(fly.sync), '지도 창 버튼으로 바꿔도 3D 창 버튼이 따라간다');
}
