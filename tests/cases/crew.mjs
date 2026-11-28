// 함께 나는 사람들(40-crew.js) — 가상 부조종사(콜아웃 · 편차 · 체크리스트) · 협동 구조 자산(경비함 · 고속단정) · 두 대 협동 비행
export const name = '부조종사 · 협동 자산 · 협동 비행';

export async function run(page, t) {
  // ── 가상 부조종사 ──
  const P = await page.evaluate(() => {
    const o = {}, said = [], sp = window.speak, og = window.sndOnGround, ra = window.radarAltFt, keep = { ...S, wps: S.wps };
    window.speak = x => { said.push(x); return true; };
    let gnd = true; window.sndOnGround = () => gnd; let raV = 0; window.radarAltFt = () => raV;
    pm.on = true; pm.air = null; pm.once = {}; pm.dev = {}; pm.devT = {}; S.running = true;
    S.vs = 0; S.spd = 0; S.bnk = 0; pmStep(0.5);
    gnd = false; raV = 30; S.vs = 500; S.spd = 35; pmStep(0.5);
    S.spd = _pmVy() + 2; raV = 600; pmStep(0.5);
    o.to = said.slice();
    said.length = 0; S.bnk = 40; pmStep(0.5); o.bank = said.slice();
    pm.dev.bank.t -= 6000; pmStep(0.5); o.again = said.slice(); o.note = fdr.ev.some(e => /반응 없음/.test(e.txt));
    S.bnk = 0; pmStep(0.5); o.cleared = !pm.dev.bank;
    said.length = 0; raV = 400; S.vs = -1500; pmStep(0.5); o.sink = said.includes('Sink rate'); S.vs = 0;
    // 체크리스트 — 읽고 답한다(콘솔로 확인되는 항목이 다르면 한 번 막는다)
    const L = pmChecklists(); o.nCl = L.length;
    const sk = window._cSayKo; const ko = []; window._cSayKo = x => { ko.push(x); return true; };
    pmClStart(0); o.first = ko[0]; let n = 0; while (pm.cl && n < 300) { pmClAnswer(); n++; }
    o.done = !pm.cl && pm.lastCl && pm.lastCl.done && pm.lastCl.name === L[0].name; o.koEnd = ko.some(x => /체크리스트 완료/.test(x));
    window._cSayKo = sk;
    toggleCrewPm(); o.panel = /가상 부조종사/.test(document.getElementById('pm-wrap').textContent); toggleCrewPm();
    pm.on = false; window.speak = sp; window.sndOnGround = og; window.radarAltFt = ra; Object.assign(S, keep);
    return o;
  });
  t.ok(P.to.join(',') === 'Positive climb,Airspeed alive,V Y', `PM 이륙 콜아웃 — ${P.to.join(' · ')}`);
  t.ok(P.bank.join() === 'Bank angle' && /Bank angle, Bank angle/.test(P.again.join()) && P.note && P.cleared && P.sink,
    'PM 편차 경고 — Bank angle · 5초 뒤 다시 부르고 강평에 반응 없음 · 고치면 풀림 · Sink rate');
  t.ok(P.nCl >= 5 && P.first && P.done && P.koEnd, `PM 체크리스트 — ${P.nCl}개 가운데 첫 것을 읽고(“${P.first}”) 답하면 끝까지 · 완료를 알린다`);
  t.ok(P.panel, '🧰 도구 → 👨‍✈️ 부조종사(PM) 창');

  // ── 협동 구조 자산 ──
  const A = await page.evaluate(() => {
    const o = {}, sp = window.speak, said = []; window.speak = x => { said.push(x); return true; };
    assetClear(); sarPlaceAt(...destPoint(S.lat, S.lon, 90, 0.5)); sar.state = 'wait';
    const r = assetDispatch('rib', { anywhere: true, brg: 0, nm: 1, rescue: true }); o.made = !!r;
    o.contact = msnContacts().some(c => c.id === r.id && c.ais && c.ais.name === 'RESCUE 1');
    for (let i = 0; i < 60 && r.st === 'enroute'; i++) assetStep(5);
    o.onscene = r.st; o.calls = said.filter(x => /mile|on scene/.test(x)).length;
    for (let i = 0; i < 14; i++) assetStep(5);
    o.rescued = sar.state === 'aboard' && r.st === 'done';
    // 경비함 인계 — 헬기가 구조한 뒤 0.3NM · 20kt 안
    const sh = assetDispatch('ship', { anywhere: true, brg: 180, nm: 2 });
    const lat0 = S.lat, lon0 = S.lon, spd0 = S.spd;
    o.far = assetHandover() === false;
    S.lat = sh.lat; S.lon = sh.lon; S.spd = 10; o.hand = assetHandover() === true && sh.handed;
    S.lat = lat0; S.lon = lon0; S.spd = spd0;
    o.map = !!_assetLayer && _assetLayer.getLayers().length === 2;
    toggleAssets(); o.panel = /협동 구조 자산/.test(document.getElementById('asset-wrap').textContent); toggleAssets();
    assetClear(); if (sar.on) sarToggleOn(); window.speak = sp;
    return o;
  });
  t.ok(A.made && A.contact, '고속단정 출동 — 레이더 · AIS(RESCUE 1)에 표적으로');
  t.ok(A.onscene === 'onscene' && A.calls >= 2 && A.rescued, `요구조자 쪽으로 가며 무전(${A.calls}번) · 현장 도착 · '단정이 구조' 60초 뒤 구조`);
  t.ok(A.far && A.hand && A.map && A.panel, `경비함 — 멀면 인계 거절 · 0.3NM · 20kt 안에서 인계 · 2D 지도 표시 · 창 (${A.far} ${A.hand} ${A.map} ${A.panel})`);

  // ── 두 대 협동 비행 — 같은 브라우저의 다른 창(BroadcastChannel) ──
  const noNet = () => { window._rtcLinkFactory = () => ({ ready: false, pub() {}, close() {} }); };
  await page.evaluate(noNet);
  const code = await page.evaluate(() => { appSet.callsign = 'Shine one'; return wingCreate(); });
  const [p2] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => { window.open(location.href, '_blank'); })]);
  await p2.waitForFunction(() => typeof wingJoin === 'function' && typeof S === 'object', null, { timeout: 30000 });
  await p2.evaluate(noNet);
  await p2.evaluate(c => { appSet.callsign = 'Shine two'; S.lat += 0.02; S.alt = 1500; S.wps = [{ lat: S.lat, lon: S.lon }, { lat: S.lat + 0.1, lon: S.lon + 0.1 }]; wingJoin(c); wingSend(true); }, code);
  await page.waitForFunction(() => Object.values(wing.peers).some(p => p.cs === 'Shine two'), null, { timeout: 10000 }).catch(() => {});
  await p2.waitForFunction(() => Object.values(wing.peers).some(p => p.cs === 'Shine one'), null, { timeout: 10000 }).catch(() => {});
  const W = await page.evaluate(() => {
    const o = {}, p = Object.values(wing.peers).find(x => x.cs === 'Shine two');
    o.peer = !!p; o.wps = !!(p && p.wps && p.wps.length === 2);
    const tr = traffic.find(x => x.remote && x.cs === 'Shine two'); o.tfc = !!tr;
    const e0 = env.traffic; env.traffic = 0; trafficStep(1); o.kept = traffic.some(x => x.remote); env.traffic = e0;
    o.tcas = tr && Number.isFinite(tr.r);
    o.radar = msnContacts().some(c => c.kind === 'air' && c.name === 'Shine two');
    o.map = !!wing.layer && wing.layer.getLayers().length >= 2;
    return o;
  });
  await p2.evaluate(() => wingMsg('구역 북쪽 맡음'));
  await page.waitForFunction(() => wing.msgs.some(m => m.text === '구역 북쪽 맡음'), null, { timeout: 8000 }).catch(() => {});
  const M = await page.evaluate(() => wing.msgs.some(m => m.cs === 'Shine two' && m.text === '구역 북쪽 맡음'));
  await p2.evaluate(() => wingLeave());
  await page.waitForFunction(() => !Object.keys(wing.peers).length, null, { timeout: 8000 }).catch(() => {});
  const gone = await page.evaluate(() => ({ peers: Object.keys(wing.peers).length, tfc: traffic.some(x => x.remote) }));
  await p2.close();
  await page.evaluate(() => { toggleWing(); const ok = /두 대 협동 비행/.test(document.getElementById('wing-wrap').textContent); toggleWing(); wingLeave(); delete window._rtcLinkFactory; appSet.callsign = 'Coastguard zero one'; return ok; }).then(ok => { W.panel = ok; });
  t.ok(W.peer && W.wps && W.tfc && W.kept && W.tcas && W.radar && W.map, `협동 비행 — 다른 창의 기체가 교통(TCAS · 레이더)으로 · 교통량 0 에도 남고 · 2D 지도에 콜사인 · 항로 (${JSON.stringify(W)})`);
  t.ok(M && gone.peers === 0 && !gone.tfc && W.panel, `메시지가 오고 · 나가면 교통에서도 지운다 · 창 (${M} ${JSON.stringify(gone)} ${W.panel})`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
