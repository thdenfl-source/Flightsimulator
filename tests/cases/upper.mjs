// UPPER CONSOLE(상부 콘솔) — 탭 'UPPER' 로 여는 오버헤드 패널(js/17-upper.js).
// 스위치를 실제 마우스로 눌러 위치가 바뀌는지, 덮개·스프링·T-핸들, 저장과 알림(연동 고리)을 본다.
import { SIM_SETUP_SRC } from './simmode.mjs';
export const name = '상부 콘솔';

export async function run(page, t) {
  await page.evaluate(() => { localStorage.removeItem('ovhdState'); selectPanel('right', 'ovhd', true); });
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const w = document.getElementById('ovhd-wrap'), r = w.getBoundingClientRect();
    window._ovhdLog = [];
    ovhdOn((id, v, prev) => window._ovhdLog.push([id, v, prev]));
    return { shown: !w.classList.contains('page-hidden') && r.width > 100,
             plates: w.querySelectorAll('.ov-plate').length,
             ctrls: w.querySelectorAll('[data-ov]').length, defs: OVHD_PLATES.flatMap(p => p.items.filter(i => i.id)).length,
             tab: !!document.querySelector('#page-tabs [data-sel="ovhd"].active') };
  });
  t.ok(info.shown && info.tab, `UPPER 탭으로 상부 콘솔이 열린다`);
  t.eq(info.plates, 7, '판(plate) 일곱 장 — WIPER · VENT/TRNG · ECS · LIGHTS · APU · CONSOLE/ANTI ICE · TQS');
  t.ok(info.ctrls === info.defs && info.ctrls >= 45, `스위치·노브가 다 그려진다 (${info.ctrls}/${info.defs}개)`);

  // 요소의 위·아래·왼쪽·오른쪽을 마우스로 누른다
  const press = async (sel, where = 'c', hold = 0) => {
    const b = await page.locator(sel).first().boundingBox();
    const x = where === 'l' ? b.x + b.width * 0.2 : where === 'r' ? b.x + b.width * 0.8 : b.x + b.width / 2;
    const y = where === 'u' ? b.y + b.height * 0.2 : where === 'd' ? b.y + b.height * 0.8 : b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    if (hold) { await page.waitForTimeout(hold); }
    const mid = await page.evaluate(() => JSON.stringify(window._ovhdLog.slice(-1)[0] || null));
    await page.mouse.up(); await page.waitForTimeout(30);
    return mid;
  };
  const get = id => page.evaluate(i => ovhdGet(i), id);

  // 터치 영역 — 글자 쪽을 누르면 그 위치로(2단: 윗글자 OFF · 아랫글자 ON)
  await press('[data-ov="batt"] .ov-pl.bot');
  const b1 = await get('batt');
  await press('[data-ov="batt"] .ov-pl.top');
  t.ok(b1 === 'ON' && await get('batt') === 'OFF', `BATT — 'ON' 글자를 누르면 ON, 'OFF' 글자를 누르면 OFF (${b1})`);
  // 3단 — 아랫글자 · 옆 글자(가운데) · 윗글자
  await press('[data-ov="airSour"] .ov-pl.bot'); const a1 = await get('airSour');
  await press('[data-ov="airSour"] .ov-pl.side'); const a2 = await get('airSour');
  await press('[data-ov="airSour"] .ov-pl.top'); const a3 = await get('airSour');
  t.ok(a1 === 'APU' && a2 === 'OFF' && a3 === 'ENG', `AIR SOUR 3단 — APU · OFF(옆 글자) · ENG 글자를 누르면 그 위치로 (${a1} · ${a2} · ${a3})`);
  await press('[data-ov="airSour"] .ov-pl.bot');
  // 영역이 모든 토글·덮개 스위치에 있다
  const zones = await page.evaluate(() => [...document.querySelectorAll('#ovhd-wrap .ov-tg, #ovhd-wrap .ov-guard')]
    .every(el => el.querySelectorAll('.ov-hit[data-hz]').length === 3));
  t.ok(zones, '모든 토글·덮개 스위치에 위·가운데·아래 터치 영역이 있다');
  // 노브 — 위치 글자를 누르면 그 위치로 바로
  await press('[data-ov="ecsMode"] [data-ov-pos="HEAT"]'); const e1 = await get('ecsMode');
  await press('[data-ov="consUpper"] [data-ov-pos="10"]'); const c1 = await get('consUpper');
  await press('[data-ov="ecsMode"] [data-ov-pos="OFF"]'); await press('[data-ov="consUpper"] [data-ov-pos="0"]');
  t.ok(e1 === 'HEAT' && c1 === 10, `노브 글자를 누르면 그 위치로 — ECS 'HEAT' · CONSOLE UPPER 'BRT'(10) (${e1} · ${c1})`);
  // ZONES — 터치 영역 테두리 보기
  await page.click('#ovhd-zones');
  const zv = await page.evaluate(() => document.getElementById('ovhd-wrap').classList.contains('ov-zones'));
  await page.click('#ovhd-zones');
  t.ok(zv, 'ZONES 로 터치 영역을 테두리로 볼 수 있다');
  // 노브 — 오른쪽 절반은 시계 방향, 왼쪽은 반시계
  await press('[data-ov="fireDet"] .ov-knob', 'r'); await press('[data-ov="fireDet"] .ov-knob', 'r');
  const f2 = await get('fireDet');
  await press('[data-ov="fireDet"] .ov-knob', 'l');
  t.ok(f2 === 'MGB' && await get('fireDet') === 'ENG1', `FIRE DETECTOR 노브 — OPER → ENG1 → MGB, 되돌리면 ENG1 (${f2})`);
  const ang = await page.evaluate(() => document.querySelector('[data-ov="fireDet"] .ov-knob').style.transform);
  t.ok(/rotate\(-50deg\)/.test(ang), `노브 그림이 그 위치로 돈다 (${ang})`);
  // 연속 노브(밝기)
  for (let i = 0; i < 3; i++) await press('[data-ov="instPlt"] .ov-knob', 'r');
  t.eq(await get('instPlt'), 3, '밝기 노브는 0~10 으로 한 칸씩 오른다');
  // 덮개 스위치 — 닫혀 있으면 스위치 자리를 눌러도 덮개만 열리고, 열고 나서 움직이고, 닫으면 제자리로
  await press('[data-ov="trng1"] .ov-bez', 'd');
  const g0 = await get('trng1');
  const open = await page.evaluate(() => document.querySelector('[data-ov="trng1"]').classList.contains('open'));
  await page.waitForTimeout(250);          // 덮개가 다 젖혀질 때까지(0.15초 움직임)
  await press('[data-ov="trng1"] .ov-bez', 'd');
  const g1 = await get('trng1');
  await press('[data-ov-cover="trng1"]', 'c');
  const g2 = await get('trng1');
  t.ok(g0 === 'NORM' && open && g1 === 'TRNG' && g2 === 'NORM',
    `TRAINING 덮개 — 닫힘이면 그대로 · 열고 TRNG · 닫으면 OFF 로 (${g0} · ${open} · ${g1} · ${g2})`);
  // 스프링 복귀 — 누르는 동안만 TEST
  const during = await press('[data-ov="chipTest"] .ov-bez', 'd', 60);
  t.ok(/"TEST"/.test(during) && await get('chipTest') === 'NORM', `CHIP DETECTOR TEST 는 누르는 동안만 (${during} → ${await get('chipTest')})`);
  // 누름 버튼 · T-핸들
  const pb = await press('[data-ov="embRst1"] .ov-btn', 'c', 40);
  t.ok(/"embRst1",1/.test(pb) && await get('embRst1') === 0, `EMB RST1 — 누르면 1, 떼면 0 (${pb})`);
  await press('[data-ov="apuFire"] .ov-thbar', 'c');
  const pulled = await page.evaluate(() => [ovhdGet('apuFire'), document.querySelector('[data-ov="apuFire"]').classList.contains('pulled')]);
  t.ok(pulled[0] === 'PULLED' && pulled[1], 'APU FIRE EXTGH T-핸들을 당긴다');

  // 저장·알림(연동 고리)
  const st = await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem('ovhdState') || '{}'), log: window._ovhdLog.length }));
  t.ok(st.saved.airSour === 'APU' && st.saved.fireDet === 'ENG1' && st.saved.instPlt === 3 && !('chipTest' in st.saved),
    '스위치 위치를 저장한다(스프링 스위치·누름 버튼은 빼고)');
  t.ok(st.log >= 10, `바뀔 때마다 ovhdOn 으로 알린다 (${st.log}번)`);
  // RESET
  await page.evaluate(() => ovhdReset());
  const rs = await page.evaluate(() => [ovhdGet('airSour'), ovhdGet('apuFire'), ovhdGet('fireDet'), ovhdGet('instPlt')]);
  t.ok(rs.join() === 'ENG,IN,OPER,0', `RESET 은 모두 처음 위치로 (${rs.join(' · ')})`);

  // ── 연동: TRAINING NO1/NO2 ENG TRNG → SIM OEI 훈련 ──
  const tr = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const st = () => { const p = engParams(); return { eng: simEng, fail: simEngFail, trng: simEngTrng,
      e1: Math.round(p.e1.ng), e2: Math.round(p.e2.ng), t1: Math.round(p.e1.tq), avail: simEngAvail() / mtaNow(),
      btn: engStateLabel() }; };
    const o = { aeo: st() };
    ovhdSet('trng1', 'TRNG'); o.t1 = st();
    ovhdSet('trng2', 'TRNG'); o.both = st();
    ovhdSet('trng1', 'NORM'); o.t2 = st();
    toggleSimMode(false); toggleSimMode(true); o.reset = st();      // SIM 을 다시 켜도 스위치대로 훈련
    ovhdSet('trng2', 'NORM'); o.off = st();
    cycleSimEng(); o.btnOei = st(); cycleSimEng(); cycleSimEng();   // ENG 버튼의 OEI 는 그대로 2번 고장
    toggleSimMode(false);
    return o;
  })()`);
  t.ok(tr.aeo.eng === 2 && !tr.aeo.trng, `처음은 두 엔진 정상(AEO)`);
  t.ok(tr.t1.eng === 1 && tr.t1.fail === 1 && tr.t1.trng && Math.abs(tr.t1.avail - 0.73) < 0.01,
    `TRNG 1 을 올리면 ENG 1 OEI 훈련 — 남은 엔진 2.5분 정격(MTA 의 ${(tr.t1.avail * 100).toFixed(0)}%)`);
  t.ok(tr.t1.e1 === 62 && tr.t1.t1 === 0 && tr.t1.e2 > 62 && tr.t1.btn === 'ENG1 TRNG',
    `엔진 계기: 1번은 IDLE(NG ${tr.t1.e1} · TQ ${tr.t1.t1}), 2번이 다 낸다(NG ${tr.t1.e2}) · 버튼 ${tr.t1.btn}`);
  t.ok(tr.both.eng === 2 && !tr.both.trng, '두 스위치가 다 올라가면 훈련이 걸리지 않는다(AEO)');
  t.ok(tr.t2.eng === 1 && tr.t2.fail === 2 && tr.t2.e2 === 62 && tr.t2.e1 > 62, 'TRNG 2 만 남으면 ENG 2 OEI 훈련');
  t.ok(tr.reset.eng === 1 && tr.reset.fail === 2 && tr.reset.trng, 'SIM 을 다시 켜도 스위치가 올라가 있으면 훈련 그대로');
  t.ok(tr.off.eng === 2 && !tr.off.trng, '스위치를 다 내리면 AEO 로 돌아온다');
  t.ok(tr.btnOei.eng === 1 && tr.btnOei.fail === 2 && !tr.btnOei.trng && tr.btnOei.e1 > 62 && tr.btnOei.e2 === 0,
    'ENG 버튼의 OEI 는 종전대로 2번 고장(훈련과 따로)');

  // ── TQS — PCD 레버(누름쇠) · 연료차단 · 화재소화 레버 → 엔진 상태 ──
  await page.evaluate(() => { localStorage.removeItem('ovhdState'); ovhdReset(); selectPanel('right', 'ovhd', true); });
  await page.waitForTimeout(150);
  const lvTop = () => page.evaluate(() => document.querySelector('[data-ov="pcd1"] .ov-lvh').style.top);
  const top0 = await lvTop();
  await press('[data-ov="pcd1"] [data-hz="p0"]');          // FLY 에서 OFF 를 누르면 IDLE 에서 멈춘다
  const l1 = await get('pcd1'), top1 = await lvTop();
  await press('[data-ov="pcd1"] [data-hz="p0"]');          // 한 번 더 → OFF
  const l2 = await get('pcd1');
  await press('[data-ov="pcd1"] [data-hz="p2"]');          // OFF → FLY 는 한 번에
  const l3 = await get('pcd1');
  t.ok(l1 === 'IDLE' && l2 === 'OFF' && l3 === 'FLY' && top0 !== top1,
    `PCD 레버 — FLY 에서 OFF 를 누르면 IDLE 에서 멈추고(누름쇠) 한 번 더 눌러야 OFF · 손잡이가 움직인다 (${l1} · ${l2} · ${l3})`);
  const tq = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const st = () => { const p = engParams(); return { eng: simEng, s: simEngSt[1] + '/' + simEngSt[2], ng1: Math.round(p.e1.ng), ng2: Math.round(p.e2.ng),
      btn: engStateLabel() }; };
    const o = { aeo: st() };
    ovhdSet('pcd1', 'IDLE'); o.idle1 = st();
    ovhdSet('pcd1', 'OFF');  o.off1 = st();
    ovhdSet('pcd2', 'OFF');  o.offBoth = st();
    ovhdSet('pcd1', 'FLY'); ovhdSet('pcd2', 'FLY'); o.back = st();
    ovhdSet('fuel2', 'CLOSE'); o.fuel = st(); ovhdSet('fuel2', 'OPEN');
    ovhdSet('fire1', 'ARM'); o.fire = st(); ovhdSet('fire1', 'UNARMED');
    ovhdSet('pcd2', 'IDLE'); ovhdSet('trng1', 'TRNG'); o.trngBlocked = st(); ovhdSet('trng1', 'NORM'); ovhdSet('pcd2', 'FLY');
    o.end = st();
    toggleSimMode(false);
    return o;
  })()`);
  t.ok(tq.aeo.eng === 2 && tq.aeo.s === 'FLY/FLY', 'TQS 처음은 두 PCD FLY — AEO');
  t.ok(tq.idle1.eng === 1 && tq.idle1.s === 'IDLE/FLY' && tq.idle1.ng1 === 62, `PCD1 IDLE — 1번 IDLE(NG ${tq.idle1.ng1}) · OEI`);
  t.ok(tq.off1.eng === 1 && tq.off1.ng1 === 0, 'PCD1 OFF — 1번 멎음(NG 0)');
  t.ok(tq.offBoth.eng === 0 && tq.offBoth.btn === 'ENG OFF', `두 PCD OFF — 동력 없음(${tq.offBoth.btn})`);
  t.ok(tq.back.eng === 2, 'PCD 를 FLY 로 올리면 AEO 로 돌아온다');
  t.ok(tq.fuel.eng === 1 && tq.fuel.s === 'FLY/OFF', 'ENG2 FUEL CLOSE — 2번 멎음');
  t.ok(tq.fire.eng === 1 && tq.fire.s === 'OFF/FLY', 'ENG1 T HANDLE ARM — 연료가 끊겨 1번 멎음');
  t.ok(tq.trngBlocked.eng === 1 && tq.trngBlocked.s === 'FLY/IDLE', '한쪽이 이미 IDLE 이면 TRAINING 은 걸리지 않는다');
  t.ok(tq.end.eng === 2, '모두 되돌리면 AEO');
  await page.evaluate(() => { selectPanel('right', 'map', true); localStorage.removeItem('ovhdState'); });

  // ── 자가 맞춤 — 콘솔 무대가 어긋나거나(검게 비어 누를 수 없음) 사라져도 1초 안에 되살린다 ──
  const heal = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'ovhd'); await w(400);
    const st = () => document.getElementById('ovhd-stage');
    const ok = () => { const s = st(), wr = document.getElementById('ovhd-wrap').getBoundingClientRect(); if (!s) return false; const r = s.getBoundingClientRect(); return r.width > wr.width * 0.9 || r.height > wr.height * 0.9; };
    const o = { start: ok() };
    st().style.transform = 'translate(0px, 0px) scale(0.001)'; o.broken = ok(); await w(1300); o.fit = ok();
    st().remove(); await w(1300); o.rebuilt = ok() && !!document.querySelector('#ovhd-stage [data-ov]');
    // 다시 만든 뒤에도 한 번 누르면 한 번만 바뀐다(손 입력이 두 번 걸리지 않는다)
    const el = document.querySelector('#ovhd-stage [data-ov="pitotHeat"]') || document.querySelector('#ovhd-stage [data-ov]');
    const id = el.dataset.ov, v0 = ovhdGet(id), r = el.getBoundingClientRect(), ev = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.25, pointerId: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', ev)); el.dispatchEvent(new PointerEvent('pointerup', ev)); await w(50);
    o.once = ovhdGet(id) !== v0; ovhdSet(id, v0);
    selectPanel('right', 'map'); await w(200);
    return o;
  });
  t.ok(heal.start && !heal.broken && heal.fit && heal.rebuilt && heal.once, `상부 콘솔이 어긋나거나 비면 1초 안에 다시 맞추고 다시 만든다 (${JSON.stringify(heal)})`);

  // ── NR(SIM · 땅 위) — 엔진 상태대로: 둘 다 OFF 면 로터가 선다 · 두 엔진 IDLE 53% · 한 엔진 IDLE 47% · FLY 100% ──
  const gnr = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = (sec) => { S.running = true; let ts = 1000; S.lastT = ts; for (let i = 0; i < sec * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); } S.running = false; };
    S.alt = 0; S.spd = 0; S.vs = 0; _ax(3, -1);                 // 바다 높이(땅) · 레버 맨 아래
    const o = {};
    const run = (a, b, sec) => { ovhdSet('pcd1', a); ovhdSet('pcd2', b); fly(sec); return Math.round(simNr); };
    o.off = run('OFF', 'OFF', 20);
    o.idle2 = run('IDLE', 'IDLE', 10);
    o.idle1 = run('IDLE', 'OFF', 5);
    o.fly = run('FLY', 'OFF', 8);
    ovhdSet('pcd2', 'FLY'); toggleSimMode(false);
    return o;
  })()`);
  t.ok(gnr.off === 0 && gnr.idle2 === 53 && gnr.idle1 === 47 && gnr.fly === 100,
    `SIM 땅 위 NR — 둘 다 OFF ${gnr.off}% · 두 엔진 IDLE ${gnr.idle2}% · 한 엔진 IDLE ${gnr.idle1}% · 한 엔진 FLY ${gnr.fly}%`);
}
