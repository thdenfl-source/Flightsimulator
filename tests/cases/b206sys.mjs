// Bell 206B-3 계통 — 성능(01-state.js B206P · 09-cdu.js PERF 접근자) · 경고/주의등 · MASTER CAUTION · CAUTION LT TEST ·
// 연료(91 갤런) · 경고음 · 오디오 패널 송신(PTT) — 25-b206panel.js · 26-b206radio.js
export const name = 'Bell 206 계통';

export async function run(page, t) {
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);

  // ── 성능 — 206 눈금(100% = 변속기 이륙 한계 · 85% 연속) ──
  const P = await page.evaluate(() => {
    let o0;
    const a0 = S.alt, tc = window._tcElev; window._tcElev = () => 0; S.alt = 1000;
    const wb0 = Object.assign({}, b206Wb), g0 = b206FuelGal(); b206WbSet({ empty: 1950, pilot: 170, copilot: 170, rear: 0, cargo: 3000 - 2290 - 60 * 6.7, gal: 60 });
    o0 = { gw: b206GrossWt() };
    const o = { hov: perfHoverTq(), vy: perfVy(), mta0: perfMta(0), mta10: perfMta(10000), vne0: simVne(0), vne8: simVne(8000),
                r52: tqRequiredAt(52, 0), r115: tqRequiredAt(115, 0), r130: tqRequiredAt(130, 0), roc: simVsForTq(100 - tqRequiredAt(52, 0)),
                lim: [tqLimitCont(), tqLimitRed()], k: B206_TQ_K };
    // 무게를 늘리면(최대 3,200lb) 호버 토크가 는다
    b206WbSet({ cargo: 3200 - 2290 - 60 * 6.7 }); o.hov3200 = perfHoverTq().oge; o.gw3200 = b206GrossWt();
    Object.assign(b206Wb, wb0); b206FuelSet(g0);
    o.gw = o0.gw; S.alt = a0; window._tcElev = tc; return o;
  });
  t.ok(Math.abs(P.hov.ige - 72) < 2 && Math.abs(P.hov.oge - 82) < 2, `호버 토크 — IGE ${P.hov.ige.toFixed(0)}% · OGE ${P.hov.oge.toFixed(0)}% (1,000ft · W&B 3,000lb)`);
  t.ok(P.vy === 52 && P.r52 < 50 && P.roc > 1150 && P.roc < 1400, `Vy 52kt — 수평 ${P.r52.toFixed(0)}% · 100% 로 ${P.roc.toFixed(0)} fpm 상승`);
  t.ok(P.r115 > 80 && P.r115 < 90 && P.r130 > 100, `순항 — 115kt 에 ${P.r115.toFixed(0)}%(연속 85% 근처) · 130kt 에 ${P.r130.toFixed(0)}%`);
  t.ok(P.mta0 === 100 && P.mta10 < 90 && P.vne0 === 130 && P.vne8 < 115, `MTA ${P.mta0}%(밀도고도 6,000ft 위로 준다 — 10,000ft ${P.mta10.toFixed(0)}%) · VNE 130kt(8,000ft ${P.vne8.toFixed(0)}kt)`);
  t.ok(Math.abs(P.gw - 3000) < 1 && Math.abs(P.gw3200 - 3200) < 1 && P.hov3200 > P.hov.oge * 1.08,
    `W&B — 총중량이 성능에 든다(3,000lb OGE ${P.hov.oge.toFixed(0)}% → 3,200lb ${P.hov3200.toFixed(0)}%)`);
  t.ok(P.lim[0] === 85 && P.lim[1] === 100 && P.k === 1, '토크 한계 85(연속) · 100(최대) — 계기는 비행 모델 토크를 그대로');

  // ── 경고 · 주의등 · MASTER CAUTION · TEST ──
  const A = await page.evaluate(async () => {
    const v = b206Vals(), o = {};
    o.rpmHi = b206Annun(Object.assign({}, v, { nr: 110 })).rpm; o.rpmLo = b206Annun(Object.assign({}, v, { nr: 85 })).rpm;
    // LOW FUEL 이 새로 켜지면 MASTER CAUTION · 누르면 꺼지고 · 꺼졌다 다시 켜지면 다시
    const g0 = b206FuelGal(); _b206Ack.clear();
    b206FuelSet(15); let vv = b206Vals(); o.m1 = b206MasterCaution(vv, b206Annun(vv));
    b206MasterAck(); vv = b206Vals(); o.m2 = b206MasterCaution(vv, b206Annun(vv));
    b206FuelSet(50); vv = b206Vals(); b206MasterCaution(vv, b206Annun(vv)); b206FuelSet(15); vv = b206Vals(); o.m3 = b206MasterCaution(vv, b206Annun(vv));
    b206FuelSet(g0); _b206Ack.clear();
    // 계기판 캔버스에서 CAUTION LT TEST 자리를 누른다
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600; c.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:600px;z-index:99999';
    document.body.appendChild(c); b206Draw(c.getContext('2d'), 0, 0, 1000, 600);
    const lit = () => { const d = c.getContext('2d').getImageData(66 + 30, 30 + 4, 1, 1).data; return d[0] > 200 && d[1] < 120; };   // ENG OUT 등(빨강)
    S.alt = 1500; S.spd = 80;
    b206Draw(c.getContext('2d'), 0, 0, 1000, 600); o.engOutBefore = lit();
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 914, clientY: 46 }));
    o.testOn = b206TestOn; b206Draw(c.getContext('2d'), 0, 0, 1000, 600); o.engOutTest = lit(); o.horn = b206HornWant();
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    o.testOff = !b206TestOn;
    // FUEL QTY 자리 — 재급유 창
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 150, clientY: 396 }));
    await new Promise(r => setTimeout(r, 200));
    const wb = document.getElementById('wb-wrap'); o.prompt = !!wb && getComputedStyle(wb).display !== 'none' && wb.querySelectorAll('[data-wb]').length === 6;
    if (wb) { wb.querySelector('[data-wb="cargo"]').value = 100; wb.querySelector('[data-wb="gal"]').value = 40; const c0 = b206Wb.cargo, f0 = b206FuelGal();
      wb.querySelector('[data-wbx="ok"]').click(); o.wbApplied = b206Wb.cargo === 100 && Math.abs(b206FuelGal() - 40) < 0.01 && getComputedStyle(wb).display === 'none'; b206Wb.cargo = c0; b206FuelSet(f0); }
    c.remove();
    return o;
  });
  t.ok(A.rpmLo && !A.rpmHi, 'RPM 경고등은 NR 90% 아래에서만(넘침은 회전계 빨간 선) — 실기와 같다');
  t.ok(A.m1 && !A.m2 && A.m3, 'MASTER CAUTION — 새 주의등(LOW FUEL)에 깜빡 · 누르면 꺼짐 · 다시 켜지면 다시');
  t.ok(!A.engOutBefore && A.testOn && A.engOutTest && A.horn && A.testOff, 'CAUTION LT TEST — 누르는 동안 경고 · 주의등이 다 켜지고 경고음 · 놓으면 꺼진다');
  t.ok(A.prompt && A.wbApplied, 'FUEL QTY 계기를 누르면 무게 · 연료(W&B) 창 — 자중 · 사람 · 화물 · 연료를 넣고 적용');
  await page.keyboard.press('Escape').catch(() => {});

  // ── 연료 — 토크에 따라 탄다 · 다 떨어지면 엔진이 멎는다 ──
  const F = await page.evaluate(() => {
    const g0 = b206FuelGal(), o = {};
    b206FuelSet(50); o.gph = b206FuelGph(); b206FuelStep(3600); o.after1h = b206FuelGal();
    o.low = b206Annun(Object.assign({}, b206Vals(), { gal: 19 })).lowFuel;
    b206FuelSet(g0);
    return o;
  });
  t.ok(F.gph > 9 && F.gph < 35 && Math.abs(50 - F.after1h - F.gph) < 0.5 && F.low,
    `연료 흐름 ${F.gph.toFixed(1)} gph(IDLE 9 + 토크 1% 당 0.21) · 1시간에 그만큼 준다 · 20 갤런 아래 LOW FUEL`);

  // ── 오디오 패널 — MIC 선택 노브로 고른 무전기로 송신(PTT) · TX 표시 ──
  const R = await page.evaluate(async () => {
    const o = {};
    try { if (typeof selectPanel === 'function') selectPanel('right', 'lcon', true); } catch (e) { /* 그만 */ }
    if (typeof b206rBuild === 'function') b206rBuild();
    const host = document.getElementById('b206rad');
    b206r.aud.mic = '1'; o.t1 = b206TxTarget();
    b206r.aud.mic = '2'; o.t2 = b206TxTarget();
    b206r.aud.mic = '3'; o.t3 = b206TxTarget(); b206Ptt(true); o.tx3 = b206TxOn(); b206Ptt(false);
    b206r.aud.mic = '2';
    const btn = host && host.querySelector('[data-ptt]');
    o.btn = !!btn;
    if (btn) btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    o.txOn = b206TxOn(); b206rRender();
    o.lbl = host ? (host.querySelector('[data-b2r="tx"]') || {}).textContent : '';
    o.unitTx = host ? !!host.querySelector('.b2r-rad.tx') : false;
    if (btn) btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    o.txOff = !b206TxOn();
    b206r.aud.mic = '1';
    return o;
  });
  t.ok(R.t1.ok && R.t1.name === 'COM1' && R.t2.ok && R.t2.name === 'COM2' && !R.t3.ok && !R.tx3,
    `MIC 1 = COM1(GNS 430) · 2 = COM2(COMM) · 3 = 없는 무전기(송신 안 됨) (${R.t1.f} · ${R.t2.f})`);
  t.ok(R.btn && R.txOn && /TX COM2/.test(R.lbl) && R.unitTx && R.txOff, `PTT 를 누르는 동안 송신 — 오디오 패널 "${R.lbl}" · COMM 창 TX · 놓으면 끝`);

  // ── HORN MUTE · 소리 우선순위 · 스타터 한계 · 한계 넘음 기록 · 알림 정리 · GNS CDI 감도 ──
  const X = await page.evaluate(async () => {
    const o = {}, gnd0 = window.sndOnGround;
    // 경고음 — 공중 · NR 90% 아래(RPM) 가정
    window.sndOnGround = () => false;
    const an0 = b206Annun; b206Annun = v => Object.assign(an0(v), { rpm: true });
    _b206HornMuted = false; o.want1 = b206HornWant();
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600; c.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:600px;z-index:99999';
    document.body.appendChild(c); b206Draw(c.getContext('2d'), 0, 0, 1000, 600);
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 34, clientY: 44 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    o.muted = _b206HornMuted; o.want2 = b206HornWant();
    b206Annun = an0; o.want3 = b206HornWant(); o.unmuted = !_b206HornMuted;   // 경고가 풀리면 다시 산다
    window.sndOnGround = gnd0; c.remove();
    // 스타터 — 60초 알림 · 90초 과열 · 식힘
    const run0 = b206c.run, th0 = b206c.th;
    b206c.run = false; b206c.th = 'OFF'; b206c.cool = 0; b206cStarter(true);
    for (let i = 0; i < 650; i++) b206cStep(0.1); o.warn = b206c.stWarn && !!b206c.start;
    for (let i = 0; i < 300; i++) b206cStep(0.1); o.cut = !b206c.start && b206c.cool > 50;
    b206cStarter(true); o.blocked = !b206c.start;
    for (let i = 0; i < 650; i++) b206cStep(0.1); b206cStarter(true); o.again = !!b206c.start; b206cStarter(false);
    for (let i = 0; i < 300; i++) b206cStep(0.1);
    b206c.run = run0; b206c.th = th0; b206c.n1 = 0; b206c.tot = 30; b206c.lit = false; _b206cApply();
    // 한계 넘음 — TQ 100% 넘으면 한 번 적는다(점검 필요)
    const v0 = b206Vals, n0 = b206Exceed.length; b206Vals = () => Object.assign(v0(), { tq: 108, run: true });
    b206ExceedStep(0.5); b206ExceedStep(0.5); o.exc = b206Exceed.length - n0; o.excTxt = (b206Exceed[b206Exceed.length - 1] || {}).txt;
    b206Vals = v0; b206ExceedStep(0.5);
    // 알림 — 같은 문구는 하나로 · 셋까지
    document.querySelectorAll('.ui-toast').forEach(e => e.remove());
    uiToast('같은 알림'); uiToast('같은 알림'); o.dup = [...document.querySelectorAll('.ui-toast')].filter(e => e.textContent === '같은 알림').length;
    ['가', '나', '다', '라'].forEach(m => uiToast(m)); await new Promise(r => setTimeout(r, 50));
    o.live = [...document.querySelectorAll('.ui-toast')].filter(e => !e._gone).length;
    // GNS 430 CDI 감도 — ENR 2 · TERM 1 · APR 0.3
    const W0 = S.wps, A0 = S.awp, la = S.lat, lo = S.lon;
    S.lat = 37.0; S.lon = 127.0;
    S.wps = [{ ident: 'A', lat: 37.6, lon: 127.0 }, { ident: 'IAF', lat: 37.7, lon: 127.0, phase: 'APP' }, { ident: 'FAF', lat: 37.75, lon: 127.0, phase: 'APP' }, { ident: 'RW', lat: 37.8, lon: 127.0, phase: 'APP' }];
    S.awp = 0; o.enr = gnsCdiScale();
    S.lat = 37.65; S.awp = 1; o.term = gnsCdiScale();
    S.lat = 37.74; S.awp = 2; o.apr1 = gnsCdiScale();
    S.lat = 37.76; S.awp = 3; o.apr = gnsCdiScale();
    S.wps = W0; S.awp = A0; S.lat = la; S.lon = lo;
    return o;
  });
  t.ok(X.want1 && X.muted && !X.want2 && !X.want3 && X.unmuted, 'HORN MUTE — 울리는 경고음을 끈다 · 경고가 풀리면 다시 산다');
  t.ok(X.warn && X.cut && X.blocked && X.again, '스타터 한계 — 60초 알림 · 90초면 과열로 떨어지고 60초 식혀야 다시 걸린다');
  t.ok(X.exc === 1 && /TORQUE 100%/.test(X.excTxt), `한계 넘음 기록 — ${X.excTxt} (한 번만 · 점검 필요)`);
  t.ok(X.dup === 1 && X.live <= 3, `알림 정리 — 같은 문구는 하나로 · 한꺼번에 셋까지 (${X.live})`);
  t.ok(X.enr.mode === 'ENR' && X.enr.fs === 2 && X.term.mode === 'TERM' && X.term.fs === 1 && X.apr1.mode === 'APR' && X.apr1.fs < 1 && X.apr1.fs > 0.3 && X.apr.fs === 0.3,
    `GNS 430 CDI 감도 — ENR ${X.enr.fs} · TERM ${X.term.fs} · FAF 2NM 안 ${X.apr1.fs.toFixed(2)} · FAF 지나 APR ${X.apr.fs}NM`);

  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
