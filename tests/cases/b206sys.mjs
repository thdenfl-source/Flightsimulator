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
    const a0 = S.alt, tc = window._tcElev; window._tcElev = () => 0; S.alt = 1000;
    const o = { hov: perfHoverTq(), vy: perfVy(), mta0: perfMta(0), mta10: perfMta(10000), vne0: simVne(0), vne8: simVne(8000),
                r52: tqRequiredAt(52, 0), r115: tqRequiredAt(115, 0), r130: tqRequiredAt(130, 0), roc: simVsForTq(100 - tqRequiredAt(52, 0)),
                lim: [tqLimitCont(), tqLimitRed()], k: B206_TQ_K };
    S.alt = a0; window._tcElev = tc; return o;
  });
  t.ok(Math.abs(P.hov.ige - 72) < 2 && Math.abs(P.hov.oge - 82) < 2, `호버 토크 — IGE ${P.hov.ige.toFixed(0)}% · OGE ${P.hov.oge.toFixed(0)}% (1,000ft · 3,000lb)`);
  t.ok(P.vy === 52 && P.r52 < 50 && P.roc > 1150 && P.roc < 1400, `Vy 52kt — 수평 ${P.r52.toFixed(0)}% · 100% 로 ${P.roc.toFixed(0)} fpm 상승`);
  t.ok(P.r115 > 80 && P.r115 < 90 && P.r130 > 100, `순항 — 115kt 에 ${P.r115.toFixed(0)}%(연속 85% 근처) · 130kt 에 ${P.r130.toFixed(0)}%`);
  t.ok(P.mta0 === 100 && P.mta10 < 90 && P.vne0 === 130 && P.vne8 < 115, `MTA ${P.mta0}%(밀도고도 6,000ft 위로 준다 — 10,000ft ${P.mta10.toFixed(0)}%) · VNE 130kt(8,000ft ${P.vne8.toFixed(0)}kt)`);
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
    o.prompt = !!document.querySelector('.ui-dlg-in'); const cx = document.querySelector('.ui-dlg-btns button'); if (cx) cx.click();
    c.remove();
    return o;
  });
  t.ok(A.rpmLo && !A.rpmHi, 'RPM 경고등은 NR 90% 아래에서만(넘침은 회전계 빨간 선) — 실기와 같다');
  t.ok(A.m1 && !A.m2 && A.m3, 'MASTER CAUTION — 새 주의등(LOW FUEL)에 깜빡 · 누르면 꺼짐 · 다시 켜지면 다시');
  t.ok(!A.engOutBefore && A.testOn && A.engOutTest && A.horn && A.testOff, 'CAUTION LT TEST — 누르는 동안 경고 · 주의등이 다 켜지고 경고음 · 놓으면 꺼진다');
  t.ok(A.prompt, 'FUEL QTY 계기를 누르면 연료(갤런)를 넣는 창이 뜬다');
  await page.keyboard.press('Escape').catch(() => {});

  // ── 연료 — 토크에 따라 탄다 · 다 떨어지면 엔진이 멎는다 ──
  const F = await page.evaluate(() => {
    const g0 = b206FuelGal(), o = {};
    o.gph = b206FuelGph(); b206FuelSet(50); b206FuelStep(3600); o.after1h = b206FuelGal();
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

  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
