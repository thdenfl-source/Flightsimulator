// 보강 4차 — 조정값 한곳(TUNE) · 타이머 하나로 · 계기 고장 표시 안전 · 지도 단추줄 접기 · 진단 기록 · 저장 공간 ·
//           새 버전 알림 · 흰수리 PTT · 산 뒤 불빛 가림 · 물 판정 · Bell 3D 모형 · 교관 화면 Bell 연료/무게
export const name = '보강 4차';

export async function run(page, t) {
  const A = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    // ① 조정값 — 다른 파일이 TUNE 을 읽는다
    o.tune = B206P === TUNE.b206Perf && B206_ARM === TUNE.b206Arm && LOWG_N === TUNE.lowg.n && VRS_KT === TUNE.vrs.kt && Object.keys(tuneDiff()).length === 0;
    // ② 타이머 하나로 — 200ms 이상은 한 박자에서 · 한 작업의 예외가 다른 작업을 막지 않는다
    let a = 0, b = 0; const oe = window.onerror; window.onerror = () => true;
    const ia = setInterval(() => { a++; }, 250), ib = setInterval(() => { b++; throw new Error('검사용 예외'); }, 250);
    await w(1100); clearInterval(ia); clearInterval(ib); const a1 = a, b1 = b; await w(400); window.onerror = oe;
    const st = schedStats();
    o.sched = { a1, b1, stopped: a === a1 && b === b1, tasks: st.tasks, ids: ia > 1e8, hasErr: _swallowed().some(r => r.msg === '검사용 예외') };
    // ③ 계기 고장 — 그림 안에서 다시 불려도 나침반 오차는 한 번만 · 다 그리면 진짜 값
    S.hdg = 100; instFailSet('hdg', true, 20);
    const r1 = instFailApply(); const h1 = S.hdg; const r2 = instFailApply(); const h2 = S.hdg; r2(); const h3 = S.hdg; r1();
    o.inst = { h1, h2, h3, after: S.hdg, view: instView().hdg }; instFailSet('hdg', false);
    // ④ 지도 단추줄 — 좁으면 접고 ⋯ 로 둘째 줄
    const bar = document.getElementById('map-sim-bar'), w0 = bar.style.width, r0 = bar.style.right;
    bar.style.right = 'auto'; bar.style.width = '380px'; mapBarFit();
    const tc = document.getElementById('map-tcut-btn');
    o.bar = { compact: bar.classList.contains('compact'), hid: getComputedStyle(tc).display === 'none', more: getComputedStyle(document.getElementById('msb-more')).display !== 'none' };
    toggleMapBarMore(); o.bar.open = getComputedStyle(tc).display !== 'none' && tc.getBoundingClientRect().top > document.getElementById('map-fly-btn').getBoundingClientRect().top + 5;
    toggleMapBarMore(); bar.style.width = '1600px'; mapBarFit(); o.bar.wide = !bar.classList.contains('compact') && getComputedStyle(tc).display !== 'none';
    bar.style.width = w0; bar.style.right = r0; mapBarFit();
    // ⑤ 진단 기록 · 저장 공간 · 새 버전 알림
    toggleDiag(); const dw = document.getElementById('diag-wrap');
    o.diag = { open: getComputedStyle(dw).display === 'flex', text: /\[타이머 \d+개/.test(diagText()) && /\[localStorage\]/.test(diagText()) };
    await w(300); o.diag.quota = /localStorage/.test((document.getElementById('diag-quota') || {}).textContent || '');
    toggleDiag(); o.diag.closed = getComputedStyle(dw).display === 'none';
    o.tools = !!TOOLS.find(x => x[1] === 'toggleDiag') && !!TOOLS.find(x => x[1] === 'openManual');
    swUpdateBanner(); const sb = document.getElementById('sw-update'); o.banner = !!sb && /새 버전/.test(sb.textContent);
    sb.querySelector('[data-sw="x"]').click(); o.banner = o.banner && !document.getElementById('sw-update');
    // ⑥ 흰수리 PTT — MIC COM1 이면 그 주파수로 관제(atcOnTx) · MIC OFF 면 송신 안 됨
    const ot = atcOnTx; let got = null; atcOnTx = f => { got = f; return null; };
    const tg = kuhTxTarget(); kuhPtt(true); const on = kuhTxOn(); kuhPtt(false);
    o.ptt = { name: tg.name, f: tg.f, on, got, off: !kuhTxOn(), joy: JOY_ACTIONS.some(x => x.id === 'ptt' && x.kind === 'hold') };
    atcOnTx = ot;
    // ⑦ 산 뒤 불빛 — 가운데 지형이 시선보다 높으면 가린다
    const fake = h => ({ queryTerrainElevation: ([lo, la]) => (Math.abs(la - 37.05) < 0.02 ? h : 0) });
    const eye = { lat: 37.0, lng: 127.0, h: 300 }; _envOccBudget = 10;
    o.occ = { hidden: envLightVisible(fake(800), eye, 37.1, 127.0, 3) === false, seen: envLightVisible(fake(50), eye, 37.1001, 127.0, 3) === true };
    // ⑧ 물 판정 — 바다 밑이 보이면 물 · 해수면 근처라도 들쭉날쭉한 낮은 땅은 땅
    const te = _tcElev;
    _tcElev = () => -6; o.water = { sea: simWaterRaw(37, 127) === true };
    let k = 0; _tcElev = () => [0.1, 0.9, 0.2, 0.7, 0.4][k++ % 5]; o.water.lowland = simWaterRaw(37, 127) === false;
    _tcElev = () => 3; o.water.land = simWaterRaw(37, 127) === false;
    _tcElev = () => null; o.water.unknown = simWaterRaw(37, 127) === null;
    _tcElev = te;
    return o;
  });
  t.ok(A.tune, '조정값 — 성능 · W&B · 저중력 · VRS 가 00-params.js(TUNE) 한곳에서 온다');
  t.ok(A.sched.a1 >= 3 && A.sched.a1 <= 5 && A.sched.b1 >= 3 && A.sched.stopped && A.sched.ids && A.sched.hasErr,
    `타이머 하나로 — 250ms 작업 1.1초에 ${A.sched.a1}번 · 예외 내는 작업(${A.sched.b1}번)이 있어도 다른 작업은 돈다 · clearInterval 로 멈춘다 · 예외는 진단 기록에`);
  t.ok(A.sched.tasks >= 10, `앱의 주기 작업이 스케줄러에 모였다 (${A.sched.tasks}개)`);
  t.ok(A.inst.h1 === 120 && A.inst.h2 === 120 && A.inst.h3 === 120 && A.inst.after === 100 && A.inst.view === 120,
    `계기 고장 표시 — 겹쳐 불려도 오차는 한 번(${A.inst.h2}°) · 끝나면 진짜 값(${A.inst.after}°) · instView 는 S 를 건드리지 않는다`);
  t.ok(A.bar.compact && A.bar.hid && A.bar.more && A.bar.open && A.bar.wide,
    '지도 단추줄 — 좁으면 덜 쓰는 단추를 ⋯ 뒤로 접고, ⋯ 를 누르면 둘째 줄에 · 넓으면 다 보인다');
  t.ok(A.diag.open && A.diag.text && A.diag.quota && A.diag.closed && A.tools, '진단 기록(🩺) — 타이머 · 오류 · 저장 공간 · 도구 메뉴(진단 · 교관 교범)');
  t.ok(A.banner, "새 버전 알림 — '새 버전이 있습니다 [새로고침] [나중에]'");
  t.ok(A.ptt.name === 'COM1' && A.ptt.f > 118 && A.ptt.on && Math.abs(A.ptt.got - A.ptt.f) < 1e-6 && A.ptt.off && A.ptt.joy,
    `흰수리 PTT — MIC ${A.ptt.name} ${A.ptt.f} 로 송신 · 놓으면 관제(atcOnTx) · 조이스틱 PTT(누르는 동안)`);
  t.ok(A.occ.hidden && A.occ.seen, '야간 불빛 — 산(시선보다 높은 지형) 뒤는 가리고, 낮으면 보인다');
  t.ok(A.water.sea && A.water.lowland && A.water.land && A.water.unknown, '물 판정 — 바다(수심)는 물 · 들쭉날쭉한 해수면 근처 낮은 땅 · 높은 땅 · 모르는 곳은 물이 아니다');

  // ── Bell — 3D 모형 · 교관 화면 연료/무게 ──
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof _h3BuildBody === 'function' && typeof b206Draw === 'function', null, { timeout: 20000 });
  const B = await page.evaluate(() => {
    const b = _h3BuildBody(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9;
    for (let i = 0; i < b.length; i += 10) { x0 = Math.min(x0, b[i]); x1 = Math.max(x1, b[i]); y0 = Math.min(y0, b[i + 1]); y1 = Math.max(y1, b[i + 1]); z0 = Math.min(z0, b[i + 2]); }
    const front = Math.max(x1, HELI3D_ROTOR.x + HELI3D_ROTOR.r), rear = Math.min(x0, HELI3D_TAIL.x - HELI3D_TAIL.r);
    const o = { len: front - rear, rotorD: HELI3D_ROTOR.r * 2, blades: HELI3D_ROTOR.blades, tailY: HELI3D_TAIL.y, width: y1 - y0, z0, acLen: SIM_AC_LEN };
    // 교관 명령 — 연료 · 화물
    const g0 = b206FuelGal(), w0 = Object.assign({}, b206Wb);
    iosHandle({ type: 'cmd', c: 'wb', o: { gal: 20, cargo: 250, rear: 0 } });
    const st = iosState();
    o.wb = { gal: Math.round(b206FuelGal()), cargo: b206Wb.cargo, st: !!st.wb && Math.round(st.wb.gal) === 20 && st.wb.cg > 0 };
    b206FuelSet(g0); Object.assign(b206Wb, w0);
    return o;
  });
  t.ok(Math.abs(B.len - 11.8) < 0.3 && Math.abs(B.rotorD - 10.16) < 0.1 && B.blades === 2 && B.tailY < 0 && B.width < 2.2 && Math.abs(B.z0) < 0.05 && B.acLen === 12,
    `Bell 3D 모형 — 전장 ${B.len.toFixed(2)}m · 주로터 ${B.rotorD.toFixed(2)}m 2날개 · 꼬리로터 왼쪽 · 스키드 폭 ${B.width.toFixed(2)}m · 바닥 0m`);
  t.ok(B.wb.gal === 20 && B.wb.cargo === 250 && B.wb.st, '교관 화면 — Bell 연료 · 무게를 바꾸고 상태(연료 · 총중량 · 무게중심)를 받는다');
}
