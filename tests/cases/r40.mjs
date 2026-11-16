// 보완 40 — AFCS 축 · 교통(기종 · 장주 · 꼬리표 · 위치 보고 · 교관 배치) · CAS 쪽넘김 · STICK 감도 · EXT 기억 · 팝아웃 크기 ·
//            강평 AFCS 축 띠 · 리드백 집계 · Instructor Sync 다시 잇기 · 계기 보호 · 시나리오 IndexedDB · 함정 착함 신호(LSO)
// (SIM 을 켜지 않는다 — 절차 훈련판에서도 돈다)
export const name = '보완 40';

export async function run(page, t) {
  // ── AFCS — 시작 ALT 꺼짐 · ALT 가 축을 옮겨도 '풀림' 경보가 울리지 않는다 ──
  const A = await page.evaluate(() => {
    const o = { start: altHoldOn };
    const k = { a: altHoldOn, c: crhtOn, i: iasNsOn, s: S.spd, g: gspdOn };
    if (gspdOn) toggleGspd();
    altHoldOn = true; crhtOn = false; iasNsOn = false; selAlt = S.alt;
    S.spd = 50; afcsAltPitch(); drawPFD(); drawPFD();
    const d0 = afcsDropCount;
    S.spd = 120; drawPFD(); o.toPitch = afcsAltPitch(); drawPFD();
    S.spd = 50; drawPFD(); o.toColl = !afcsAltPitch(); drawPFD();
    o.drops = afcsDropCount - d0;
    altHoldOn = k.a; crhtOn = k.c; iasNsOn = k.i; S.spd = k.s; if (gspdOn !== k.g) toggleGspd();
    o.tune = typeof TUNE.afcs === 'object' && typeof TUNE.tfc === 'object' && typeof TUNE.vstick === 'object';
    return o;
  });
  t.ok(A.start === false, '시작할 때 ALT 는 꺼져 있다(조종사가 걸 때만 물린다)');
  t.ok(A.toPitch && A.toColl && A.drops === 0, `ALT 가 컬렉티브 ↔ 피치 칸으로 옮겨 가도 '풀림' 경보는 없다 (풀림 ${A.drops})`);
  t.ok(A.tune, '새 조정값(afcs · tfc · vstick)은 00-params.js(TUNE)에 모였다');

  // ── CAS 쪽넘김 — 5줄이 넘으면 소프트키 CAS 가 살고 CAS UP · DN 으로 넘긴다 ──
  const C = await page.evaluate(() => {
    const keep = window.pfdMsgs, o = {};
    window.pfdMsgs = () => Array.from({ length: 12 }, (_, i) => ({ t: 'MSG ' + (i + 1), c: '#22e022' }));
    const shot = () => { const seen = [], f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return f.call(this, x, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = f; } return seen; };
    pfdCasPage = 0; o.over = pfdCasOverflow();
    const s1 = shot(); o.p1 = { first: s1.includes('MSG 1'), hid: !s1.includes('MSG 6'), tag: s1.some(x => /CAS 1\/3/.test(x)) };
    pfdSkGo('TOP'); const casI = SK_MENUS.TOP.findIndex(x => x.lbl === 'CAS'); o.casOn = !SK_MENUS.TOP[casI].dim();
    pfdSkPress(casI); o.menu = skMenu;
    const dn = SK_MENUS.CAS.findIndex(x => /DN/.test(x.lbl || '')), up = SK_MENUS.CAS.findIndex(x => /UP/.test(x.lbl || ''));
    pfdSkPress(dn); const s2 = shot(); o.p2 = { page: pfdCasPage, has6: s2.includes('MSG 6'), no1: !s2.includes('MSG 1') };
    pfdSkPress(dn); pfdSkPress(dn); o.max = pfdCasPage;
    pfdSkPress(up); o.back = pfdCasPage;
    window.pfdMsgs = () => [{ t: 'ONE', c: '#22e022' }]; o.few = !pfdCasOverflow() && SK_MENUS.TOP[casI].dim();
    window.pfdMsgs = keep; pfdCasPage = 0; pfdSkGo('TOP');
    return o;
  });
  t.ok(C.over && C.p1.first && C.p1.hid && C.p1.tag, 'PFD 메시지가 5줄을 넘으면 넘치는 것은 숨기고 끝에 ▲▼ CAS 1/3');
  t.ok(C.casOn && C.menu === 'CAS', '소프트키 CAS 가 살아나고, 누르면 CAS UP · CAS DN 이 뜬다');
  t.ok(C.p2.page === 1 && C.p2.has6 && C.p2.no1 && C.max === 2 && C.back === 1, `CAS DN 으로 다음 쪽 · 마지막 쪽에서 멈춤 · CAS UP 으로 앞 쪽 (${C.max + 1}쪽)`);
  t.ok(C.few, '메시지가 적으면 CAS 는 꺼져(흐리게) 있다');

  // ── 교통 — 기종 · 장주 몫 · 교관 배치 · 위치 보고 ──
  const T = await page.evaluate(() => {
    const o = {}, keep = { ty: env.tfcType, pat: env.tfcPat, n: env.traffic };
    const ap = RUNWAYS.find(a => a.rwys && a.rwys.length), r = ap.rwys[0];
    S.lat = r.a[0] + 1 / 60; S.lon = r.a[1]; S.alt = 1500;
    envSet({ traffic: 0 }); trafficStep(0);
    envSet({ traffic: 3, tfcType: 'b206', tfcPat: 3 }); trafficStep(0);
    o.allBell = traffic.every(x => x.ac === 'b206'); o.allPat = traffic.every(x => x.mode === 'pat');
    envSet({ traffic: 0 }); trafficStep(0);
    // 교관 화면 명령 — 내 기체 090° 2NM · +500ft · 침로 270 · 흰수리
    iosHandle({ type: 'cmd', c: 'tfc', o: { brg: 90, nm: 2, rel: 500, hdg: 270, ac: 'kuh' } });
    const t0 = traffic[0]; const v = _tNE(S.lat, S.lon, t0.lat, t0.lon);
    o.ios = { n: traffic.length, ac: t0.ac, nm: Math.hypot(v.n, v.e), brg: (Math.atan2(v.e, v.n) * 180 / Math.PI + 360) % 360, rel: t0.alt - S.alt, keep: env.traffic >= 1 };
    trafficStep(1); o.iosStay = traffic.length === 1;
    // 위치 보고 — 장주 교통이 다리를 넘으면 무전
    const said = [], sp = window.speak; window.speak = x => { said.push(x); return true; };
    _tfcSayT = 0; const p = trafficAdd({ ac: 'b206', pat: true });
    const w = p.wp[p.wi]; p.lat = w.lat; p.lon = w.lon; trafficStep(0.5);
    window.speak = sp; o.say = said.join(' | ');
    iosHandle({ type: 'cmd', c: 'tfcClear' }); o.cleared = traffic.length === 0;
    env.tfcType = keep.ty; env.tfcPat = keep.pat; env.traffic = keep.n;
    return o;
  });
  t.ok(T.allBell && T.allPat, 'ENV 교통 기종(Bell 206) · 장주비행(모두) 대로 뜬다');
  t.ok(T.ios.n === 1 && T.ios.ac === 'kuh' && Math.abs(T.ios.nm - 2) < 0.05 && Math.abs(T.ios.brg - 90) < 1.5 && Math.abs(T.ios.rel - 500) < 1 && T.iosStay,
    `교관 화면 교통 배치 — 방위 ${T.ios.brg.toFixed(0)}° · ${T.ios.nm.toFixed(2)}NM · +${T.ios.rel.toFixed(0)}ft 흰수리(ENV 교통량이 지우지 않는다)`);
  t.ok(/traffic, Bell .*(upwind|crosswind|downwind|base|final|touch and go)/.test(T.say), `장주 교통 위치 보고(무전) — "${T.say}"`);
  t.ok(T.cleared, '교관 화면 — 교통 모두 지우기');

  // ── STICK 감도 · 데드존 · EXT 기억 · 팝아웃 크기 ──
  const U = await page.evaluate(() => {
    const o = {}, k = { k: appSet.stickK, d: appSet.stickDead, r: vStick.roll, p: vStick.pitch };
    vStick.pitch = 0; vStick.roll = 0.5; appSet.stickK = 1; appSet.stickDead = 0; const r1 = vStickCyclic().roll;
    appSet.stickK = 0.5; const r05 = vStickCyclic().roll;
    appSet.stickDead = 0.1; vStick.roll = 0.08; const rDead = vStickCyclic().roll;
    o.stick = { half: Math.abs(r05 - r1 / 2) < 1e-9, dead: rDead === 0 };
    appSet.stickK = k.k; appSet.stickDead = k.d; vStick.roll = k.r; vStick.pitch = k.p;
    const e0 = { ...extCam }; extCamStep('R'); extCamStep('OUT');
    const saved = JSON.parse(localStorage.getItem('extCam') || '{}'); o.ext = Math.abs(saved.yaw - extCam.yaw) < 1e-9 && Math.abs(saved.zoom - extCam.zoom) < 1e-9 && extCam.yaw !== e0.yaw;
    extCamDefault(); o.extDef = JSON.parse(localStorage.getItem('extCam')).zoom === 1;
    const p0 = ckPopK; ckPopScale(-1); o.pop = { k: ckPopK, saved: localStorage.getItem('ckPopK') }; ckPopScale(1); ckPopScale(1); o.popMax = ckPopK; ckPopK = p0;
    return o;
  });
  t.ok(U.stick.half && U.stick.dead, 'STICK 감도 ×0.5 면 사이클릭이 반 · 데드존 안은 0(⚙ 설정)');
  t.ok(U.ext && U.extDef, 'EXT 카메라(둘레 · 거리)를 기억하고 DEFAULT 로 지운다');
  t.ok(U.pop.k === 0.9 && U.pop.saved === '0.9' && U.popMax === 1, `Cockpit 팝아웃 크기 − · + (10% 씩 · 최대 100%) (${U.pop.k})`);

  // ── 강평 — ALT(P) · 축 바뀜 · 리드백 집계 ──
  const D = await page.evaluate(() => {
    const k = { a: altHoldOn, c: crhtOn, i: iasNsOn, s: S.spd, g: gspdOn };
    if (gspdOn) toggleGspd();
    fdrClear(); fdr.on = true;
    altHoldOn = true; crhtOn = false; iasNsOn = false; S.spd = 50; fdrRecord();
    S.spd = 120; fdrRecord();
    fdrNote('리드백 정확'); fdrNote('리드백 틀림(runway)', 'warn');
    const o = { modes: fdr.rows.map(r => r.modes).join(' / '), ev: fdr.ev.map(e => e.txt).join(' / '), sum: fdrSummary() };
    altHoldOn = k.a; crhtOn = k.c; iasNsOn = k.i; S.spd = k.s; if (gspdOn !== k.g) toggleGspd();
    fdrClear();
    return o;
  });
  t.ok(/ALT\b/.test(D.modes) && /ALT\(P\)/.test(D.modes) && /ALT 축 — 피치/.test(D.ev) && !/AFCS 풀림/.test(D.ev) && D.sum.drops === 0,
    `강평 — ALT 가 피치 축이면 ALT(P), 옮겨 간 순간은 '축 바뀜'(풀림 아님) (${D.modes})`);
  t.ok(D.sum.rbOk === 1 && D.sum.rbBad === 1, '강평 요약 — 리드백 정확 · 틀림 수');

  // ── 계기 보호 · Instructor Sync 다시 잇기 · 시나리오 IndexedDB ──
  const I = await page.evaluate(async () => {
    const o = {};
    instGuardCheck(); const a0 = S.alt; S.alt = NaN; S.spd = Infinity;
    o.fixed = instGuardCheck() === 2 && S.alt === a0 && Number.isFinite(S.spd);
    // 다시 잇기 — 기억한 짝(12시간 안)이 있으면 중계로 곧바로 붙는다(검사는 링크를 바꿔 낀다)
    const opened = []; window._rtcLinkFactory = (rx, tx) => { opened.push([rx, tx]); return { ready: false, pub() {}, close() {} }; };
    try { if (rtc.link) rtc.link.close(); } catch (e) { /* 그만 */ } rtc.link = null;
    localStorage.setItem('rtcPair', JSON.stringify({ room: 'shinesong-test', key: 'AAAAAAAAAAAAAAAAAAAAAA==', t: Date.now() }));
    o.resume = rtcResume() && opened.length === 1 && /shinesong\/shinesong-test\//.test(opened[0][0]);
    rtcPairForget(); o.forgot = localStorage.getItem('rtcPair') === null && !rtc.link;
    localStorage.setItem('rtcPair', JSON.stringify({ room: 'x', key: 'y', t: Date.now() - 13 * 3600e3 })); o.stale = rtcResume() === false;
    localStorage.removeItem('rtcPair'); delete window._rtcLinkFactory;
    await scnStoreReady; o.scnIdb = !!_fdrIdb && Array.isArray(_scnMem);
    return o;
  });
  t.ok(I.fixed, '계기 보호 — 숫자가 아닌 비행 값(NaN · 무한)을 직전 정상 값으로 되돌린다');
  t.ok(I.resume && I.forgot && I.stale, 'Instructor Sync — 기억한 짝으로 다시 잇고(12시간 안) · 연결 끊기로 지운다');
  t.ok(I.scnIdb, '시나리오 목록은 IndexedDB(비행 저장과 같은 곳)에 둔다');

  // ── 함정 착함 신호(LSO) ──
  const L = await page.evaluate(() => {
    const k = { la: shipLat, lo: shipLon, h: shipHdg, v: shipVisible, s: S.lat, o: S.lon, a: S.alt, vs: S.vs, b: S.bnk };
    shipLat = 35.0; shipLon = 126.0; shipHdg = 0; shipVisible = true;
    const at = (aftM, rightM, hft, vs = -300, bnk = 0) => {
      const tdN = SHIP3D_TD.fwd - aftM;
      S.lat = shipLat + tdN / 110540; S.lon = shipLon + rightM / (111320 * Math.cos(shipLat * Math.PI / 180));
      S.alt = SHIP3D_DECK / 0.3048 + hft; S.vs = vs; S.bnk = bnk; const r = shipLsoSignal(); return r ? r.k : null;
    };
    const ang = d => Math.tan(3.5 * Math.PI / 180) * d / 0.3048;      // 3.5° 선 위 높이(ft)
    const o = { ok: at(300, 0, ang(300)), high: at(300, 0, ang(300) * 2), low: at(300, 0, ang(300) * 0.4), left: at(300, 40, ang(300)),
                right: at(300, -40, ang(300)), wave: at(200, 0, 80, -900), far: at(3000, 0, 300) };
    shipLat = k.la; shipLon = k.lo; shipHdg = k.h; shipVisible = k.v; S.lat = k.s; S.lon = k.o; S.alt = k.a; S.vs = k.vs; S.bnk = k.b;
    return o;
  });
  t.ok(L.ok === 'ok' && L.high === 'down' && L.low === 'up', `LSO — 3.5° 선 위 '좋음' · 높으면 ▼ 내려 · 낮으면 ▲ 올려 (${L.ok} · ${L.high} · ${L.low})`);
  t.ok(L.left === 'left' && L.right === 'right' && L.wave === 'waveoff' && L.far === null, `LSO — 우현으로 치우치면 ◀ · 좌현이면 ▶ · 빠른 강하면 WAVE OFF · 0.5NM 밖은 없음`);
}
