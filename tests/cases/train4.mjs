// 훈련 보강 4 — 계기 고장 · Bell 엔진 계통 고장 · 브라운아웃 · 교통(TCAS) · METAR 환경 · 리드백 · 설정 · 도구 메뉴 · 다른 기기 교관 연결(WebRTC)
export const name = '훈련 보강 4';

export async function run(page, t) {
  // ── 계기 고장 — 그리는 동안만 바꿔 보이고 비행 값은 그대로 ──
  const I = await page.evaluate(() => {
    const o = {}; selectPanel('left', 'pfd', true);
    S.spd = 100; S.alt = 2000; S.vs = 0; S.pit = 0; S.bnk = 0; S.hdg = 90;
    instFailSet('asi', true); instFailSet('alt', true); instFailSet('ahrs', true); instFailSet('hdg', true, 20);
    S.spd = 140; S.alt = 3000; S.bnk = 25; S.hdg = 100;
    const seen = [], oT = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return oT.call(this, x, ...a); };
    let during = null; const f0 = drawAI; drawAI = function (...a) { during = { spd: S.spd, alt: S.alt, bnk: S.bnk, hdg: S.hdg }; return f0.apply(this, a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = oT; drawAI = f0; }
    o.during = during; o.after = { spd: S.spd, alt: S.alt, bnk: S.bnk, hdg: S.hdg }; o.attFail = seen.includes('ATT FAIL');
    ['asi', 'alt', 'ahrs', 'hdg'].forEach(k => instFailSet(k, false)); o.clear = !instFailAny();
    return o;
  });
  t.ok(I.during && I.during.spd === 100 && I.during.alt === 2000 && I.during.bnk === 0 && I.during.hdg === 120 && I.attFail,
    `계기 고장 — 속도계 100kt · 고도계 2,000ft 에 굳고 · AHRS 자세가 굳어 ATT FAIL · 나침반 +20° (그릴 때 ${I.during && I.during.spd}kt · ${I.during && I.during.hdg}°)`);
  t.ok(I.after.spd === 140 && I.after.alt === 3000 && I.after.bnk === 25 && I.after.hdg === 100 && I.clear, '비행 값은 그대로 · 풀면 정상');

  // ── 교통 · TCAS ──
  const T = await page.evaluate(() => {
    const o = {}; speakLog.length = 0; const sp0 = window.speak; const said = []; window.speak = x => { said.push(x); return true; };
    envSet({ traffic: 1 }); trafficStep(0.1);
    // 정면 2NM · 같은 고도 · 마주 옴 → RA(흰수리)
    S.lat = 37; S.lon = 126; S.alt = 2000; S.hdg = 0; S.spd = 100;
    Object.assign(traffic[0], { lat: 37 + 1.2 / 60, lon: 126, alt: 2200, hdg: 180, spd: 120 });
    tcasEval(); o.ra = { st: traffic[0].st, state: tcasState, sense: tcasRaSense };
    Object.assign(traffic[0], { lat: 37 + 2.2 / 60, alt: 2800 }); tcasEval(); o.ta = traffic[0].st;
    Object.assign(traffic[0], { lat: 37 + 12 / 60, alt: 6000 }); tcasEval(); o.clear = tcasState;
    o.said = said.slice(); window.speak = sp0;
    // PFD TCAS 창 — 'NO TRAFFIC' 대신 기호
    Object.assign(traffic[0], { lat: 37 + 2 / 60, alt: 2300 }); tcasEval();
    const seen = [], oT = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return oT.call(this, x, ...a); };
    try { if (typeof skState !== 'undefined') skState.tfcMap = true; drawPfdInset({ x: 0, y: 0, w: 220, h: 220 }); } finally { CanvasRenderingContext2D.prototype.fillText = oT; if (typeof skState !== 'undefined') skState.tfcMap = false; }
    o.inset = { noTraffic: seen.includes('NO TRAFFIC'), rel: seen.some(x => /^\+0[23]$/.test(x)) };
    o.msgs = pfdMsgs().map(m => m.t);
    envSet({ traffic: 0 }); trafficStep(0.1); o.gone = traffic.length;
    return o;
  });
  t.ok(T.ra.st === 'RA' && T.ra.sense === -1 && T.ta === 'TA' && T.clear === 'CLEAR', `TCAS — 정면 1.2NM · +200ft RA(DESCEND) · 2.2NM +800ft TA · 멀어지면 CLEAR`);
  t.ok(T.said.includes('Descend, descend') && T.said.includes('Clear of conflict'), `TCAS 음성 — ${T.said.join(' · ')}`);
  t.ok(!T.inset.noTraffic && T.inset.rel && T.msgs.some(m => /TRAFFIC|TCAS/.test(m)) && T.gone === 0, `PFD TCAS 창에 상대 고도(+03)와 기호 · PFD 메시지 TRAFFIC`);

  // ── METAR 환경 · 리드백 · 설정 · 도구 메뉴 ──
  const M = await page.evaluate(async () => {
    const o = {};
    const night = new Date(Date.UTC(2026, 0, 15, 15, 0));   // 한국 자정
    o.m1 = envFromMetar('RKSS 151500Z 32015G25KT 2000 -RA BR BKN008 OVC020 03/01 Q1012', 59, night, 37.56, 126.79);
    o.m2 = envFromMetar('RKSS 150300Z 27005KT CAVOK 10/M02 Q1020', 59, new Date(Date.UTC(2026, 0, 15, 3, 0)), 37.56, 126.79);
    // 리드백
    atcExpect = { t: Date.now(), items: [['cleared'], ['land'], ['14', 'one four'], ['right']] };
    o.rb1 = atcCheckReadback('cleared to land runway one four right, coastguard zero one');
    o.rb2 = atcCheckReadback('cleared to land runway one four');
    atcExpect = { t: Date.now(), items: [['squawk'], ['4'], ['5'], ['2'], ['1']] };
    o.rb3 = atcCheckReadback('squawk four five two one');
    atcExpect = null;
    // 설정 — 콜사인 · 내보내기 · 들여오기
    toggleSettings(); const sw = document.getElementById('set-wrap');
    const cs = sw.querySelector('[data-setv="callsign"]'); cs.value = 'Shine one'; cs.dispatchEvent(new Event('change', { bubbles: true }));
    o.cs = appSet.callsign; o.csUsed = atcCs();
    const ex = settingsExport(); o.exp = typeof ex.appSet === 'string' && /Shine one/.test(ex.appSet);
    appSet.callsign = 'Coastguard zero one'; appSetSave(); sw.style.display = 'none';
    // 도구 메뉴 — 누르면 메뉴 · 메뉴에서 설정
    toggleTools(); const tm = document.getElementById('tools-menu');
    o.tools = getComputedStyle(tm).display === 'block' && tm.querySelectorAll('[data-tool]').length === 6;
    tm.querySelector('[data-tool="toggleSettings"]').click(); o.toolSet = getComputedStyle(document.getElementById('set-wrap')).display === 'flex'; document.getElementById('set-wrap').style.display = 'none';
    // 브라운아웃 — 모래 · 15ft · 호버 토크
    envSet({ surface: 'sand' }); const ra0 = window.radarAltFt; window.radarAltFt = () => 15; const tq0 = window.tqShown; window.tqShown = () => 70; const s0 = S.spd; S.spd = 3;
    for (let i = 0; i < 40; i++) envDustStep(); o.dust = envDustOp;
    envSet({ surface: 'normal' }); for (let i = 0; i < 40; i++) envDustStep(); o.dust0 = envDustOp;
    window.radarAltFt = ra0; window.tqShown = tq0; S.spd = s0;
    return o;
  });
  t.ok(M.m1.wind.dir === 320 && M.m1.wind.spd === 15 && M.m1.env.gust === 10 && M.m1.env.vis === 1.5 && M.m1.env.ceil === 1000 && M.m1.env.rain === 1 && M.m1.env.tod === 'NIGHT',
    `METAR → 환경 — 320°/15kt G+10 · 시정 1.5km · 구름 ${M.m1.env.ceil}ft · 약한 비 · 야간(해 ${M.m1.sunEl.toFixed(0)}°)`);
  t.ok(M.m2.env.vis === 0 && M.m2.env.ceil === 0 && M.m2.env.tod === 'DAY', 'CAVOK 낮 — 무제한 · 구름 없음 · 주간');
  t.ok(M.rb1.ok && !M.rb2.ok && M.rb2.missing.includes('right') && M.rb3.ok, `리드백 확인 — 다 맞음 ✓ · 'right' 빠짐 ✗ · 코드 4521 ✓`);
  t.ok(M.cs === 'Shine one' && /Shine one/.test(M.csUsed) && M.exp, '⚙ 설정 — 콜사인을 바꾸면 관제가 그 이름으로 부른다 · 모든 설정 내보내기');
  t.ok(M.tools && M.toolSet, '🧰 도구 메뉴 — 시나리오 · 환경 · 강평 · 교관 화면 · 설정 · 도움말');
  t.ok(M.dust > 0.6 && M.dust0 < 0.1, `브라운아웃 — 모래 위 15ft 호버면 먼지가 가린다 (${M.dust.toFixed(2)})`);

  // ── 착수(흰수리 비상 플로트) ──
  const D = await page.evaluate(() => {
    const o = {}, w0 = simWaterBelow, run0 = S.running; simWaterBelow = () => true;
    ovhdSet('fltArmSw', 'ARMED'); simDitchCheck(-200, 10); o.ok = simDitchLast.grade;
    simDitchCheck(-900, 10); o.hard = simDitchLast.grade;
    ovhdSet('fltArmSw', 'OFF'); S.running = true; simDitchCheck(-200, 10); o.off = simDitchLast.grade; o.stopped = !S.running;
    simWaterBelow = w0; S.running = run0;
    return o;
  });
  t.ok(/성공/.test(D.ok) && /손상/.test(D.hard) && /미전개/.test(D.off) && D.stopped, `착수 — ARMED 200fpm ${D.ok} · 900fpm ${D.hard} · OFF ${D.off}(비행 멈춤)`);

  // ── 작은 화면(태블릿 세로 · 휴대폰) — 낱 단추 대신 🧰 도구 하나 ──
  const vp = page.viewportSize();
  await page.setViewportSize({ width: 800, height: 1000 }); await page.waitForTimeout(200);
  const small = await page.evaluate(() => ({ tools: getComputedStyle(document.getElementById('map-tools-btn')).display !== 'none', scn: getComputedStyle(document.getElementById('map-scn-btn')).display === 'none' }));
  await page.setViewportSize(vp); await page.waitForTimeout(200);
  const big = await page.evaluate(() => ({ tools: getComputedStyle(document.getElementById('map-tools-btn')).display === 'none', scn: getComputedStyle(document.getElementById('map-scn-btn')).display !== 'none' }));
  t.ok(small.tools && small.scn && big.tools && big.scn, '작은 화면에서는 🧰 도구 하나로 모이고, 큰 화면에서는 낱 단추');

  // ── Bell 엔진 계통 고장 ──
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const E = await page.evaluate(() => {
    const o = {}; _b206cRead(); b206c.run = true; b206c.th = 'FULL'; _b206cApply();
    const tq0 = window.tqShown; window.tqShown = () => 20;
    b206cEngFail('gov', 'HI'); for (let i = 0; i < 100; i++) b206cFailStep(0.1); o.hi = NR_GOV;
    b206cBeep(-1); NR_GOV = Math.max(90, NR_GOV - 5); b206cBeep(0); o.manual = NR_GOV;
    window.tqShown = () => 90; b206cEngFail('gov', 'LO'); NR_GOV = 100; for (let i = 0; i < 100; i++) b206cFailStep(0.1); o.lo = NR_GOV;
    b206cEngFail('gov', null); NR_GOV = 100;
    b206cEngFail('chip', true); o.chipLamp = b206Cautions(b206Vals(), b206Annun(b206Vals())).find(c => c[0] === 'ENG CHIP')[1];
    for (let i = 0; i < 6100; i++) b206cFailStep(0.1); o.chipOut = !b206c.run;
    b206cEngFail('chip', false); b206cFail(false); b206c.run = true; b206c.th = 'FULL'; _b206cApply();
    b206cEngFail('thStuck', true); b206cThrottle(-1); o.stuck = b206c.th; b206cEngFail('thStuck', false);
    window.tqShown = tq0;
    return o;
  });
  t.ok(E.hi > 104 && E.manual < E.hi && E.lo < 96, `거버너 고장 — HI 는 NR ${E.hi.toFixed(0)}% 로 넘치고 · LO 는 출력에서 ${E.lo.toFixed(0)}% 로 처진다 · GOV DECR 로 손으로 맞춘다`);
  t.ok(E.chipLamp && E.chipOut, 'ENG CHIP — 주의등 · 10분 넘게 출력을 쓰면 엔진이 멎는다');
  t.ok(E.stuck === 'FULL', '스로틀 고착 — 돌려도 움직이지 않는다');

  // ── 다른 기기 교관 연결(WebRTC — 여기선 같은 브라우저 두 창으로) ──
  const [ios] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => { window._rtcIce = []; document.getElementById('map-ios-btn').click(); })]);
  await ios.waitForFunction(() => !!document.getElementById('ios-root'), null, { timeout: 20000 });
  await page.evaluate(() => { try { _iosCh.close(); } catch (e) { /* 같은 브라우저 통로는 끊고 WebRTC 로만 */ } });
  const offer = await ios.evaluate(async () => { window._rtcIce = []; try { _iosCh.close(); } catch (e) { /* */ } return await rtcOffer(); });
  const answer = await page.evaluate(async c => await rtcAnswer(c), offer);
  await ios.evaluate(async c => await rtcAccept(c), answer);
  await page.waitForFunction(() => rtc.open, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => iosSend());
  await ios.waitForFunction(() => /Bell 206/.test(document.querySelector('[data-iosv="state"]').textContent), null, { timeout: 5000 }).catch(() => {});
  const R = await ios.evaluate(() => ({ open: rtc.open, st: document.querySelector('[data-iosv="state"]').textContent }));
  await ios.evaluate(() => iosCmd('env', { o: { tod: 'NIGHT' } }));
  await page.waitForTimeout(400);
  const nightR = await page.evaluate(() => { const v = env.tod; envSet({ tod: 'DAY' }); return v; });
  await ios.close();
  t.ok(R.open && /Bell 206/.test(R.st) && nightR === 'NIGHT', '다른 기기 교관 연결(WebRTC) — 연결 코드 두 번 주고받아 상태를 받고 · 야간 명령이 닿는다');

  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
