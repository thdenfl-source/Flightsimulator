// 흰수리 계통 보강 3 — PERF(Config · Hover · Cruise · MAX GW · 색) · MFD 'Helicopter Performance' · H-V 회피영역 ·
// 자리(CDU1/CDU2 · MFD1~4) · MFD 고장 REV(2초 · 8초 · 복귀 17.5초) · 배터리 단독(CDU2 · MFD3 꺼짐) · 처음 HALF
export const name = 'KUH 계통 3';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms)), o = {};
    const texts = fn => { const seen = [], f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return f.call(this, x, ...a); }; try { fn(); } finally { CanvasRenderingContext2D.prototype.fillText = f; } return seen; };
    o.half0 = sysLayout === 'HALF';
    selectPanel('mid', 'cdu', true);
    // ── PERF ──
    CDU_ACT.switchMode('PERF'); await w(20);
    o.tabs = ['Config', 'Hover', 'Cruise'].every(x => document.getElementById('mainContentArea').textContent.includes(x));
    const P0 = perfSnap();
    CDU_ACT.perfSetTab('Config'); await w(20);
    CDU_ACT.perfCfgSet('ai'); CDU_ACT.perfCfgSet('ecs'); await w(20);
    const P1 = perfSnap(); o.pen = Math.round((P0.mta - P1.mta) * 10) / 10;
    CDU_ACT.perfCfgSet('ai'); CDU_ACT.perfCfgSet('ecs');
    CDU_ACT.perfCfgSet('tql', 'S2.5M'); o.tql = perfSnap().mta > P0.mta; CDU_ACT.perfCfgSet('tql', 'D30M');
    // 무거운 · 높은 · 더운 날 — OGE 가 MTA 를 넘으면 적 · MAX GW 가 지금 무게 이하면 황
    const pd = { alt: CDU_ACT.perfData ? null : null };
    const keep = JSON.stringify([perfSnap().alt, perfSnap().temp, perfSnap().wt]);
    window._pd = () => { const r2 = cduKnobRadio; return r2; };
    // perfData 는 CDU 안 — PERF_INPUT 화면 없이 값을 넣는 길: Use Defaults 로 고도 · 외기를 지금 값으로
    S.alt = 9000; window.oatNowC = () => 35; CDU_ACT.perfUseDefaults(); await w(20);
    const P2 = perfSnap(); o.hot = { alt: P2.alt, temp: P2.temp, ogeRed: P2.ogeRed, mta: P2.mta, oge: P2.oge };
    CDU_ACT.perfSetTab('Hover'); await w(20);
    o.redShown = [...document.querySelectorAll('#mainContentArea .perf-result-box')].some(e => /rgb\(255, 48, 48\)/.test(e.getAttribute('style') || '') || /#ff3030/.test(e.getAttribute('style') || ''));
    o.maxGwYel = P2.aeoOge <= P2.wt;
    CDU_ACT.perfSetTab('Cruise'); await w(20);
    o.cruise = /VNE/.test(document.getElementById('mainContentArea').textContent) && /예비 340 lb/.test(document.getElementById('mainContentArea').textContent);
    S.alt = 0; window.oatNowC = () => 15; CDU_ACT.perfUseDefaults(); CDU_ACT.perfSetTab('Hover');
    // MFD 성능 화면
    const mv = texts(() => { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; sysLayout = 'FULL'; sysPage = 'perf'; sysDrawTo(cv); });
    o.mfdPerf = mv.includes('Active Helicopter Performance') && mv.some(x => /^H-V/.test(x));
    // ── H-V ──
    const ra0 = window.radarAltFt, sp0 = S.spd, so = simModeOn; simModeOn = false;
    S.alt = 0; window.oatNowC = () => 15;
    window.radarAltFt = () => 100; S.spd = 10; o.hvIn = hvState().avoid;
    window.radarAltFt = () => 300; o.hvHigh = hvState().avoid;
    window.radarAltFt = () => 30; S.spd = 30; o.hvFast = hvState().avoid;
    S.alt = 4000; window.oatNowC = () => 27; window.radarAltFt = () => 300; S.spd = 10; o.hvHot = hvState().avoid;   // 4,000ft ISA+20 이면 465ft 까지
    window.radarAltFt = ra0; S.spd = sp0; S.alt = 0; simModeOn = so; delete window.oatNowC;
    // ── 자리 ──
    CDU_ACT.switchMode('SETTINGS'); await w(20);
    o.seatRow = /자리\(CDU · MFD\)/.test(document.getElementById('mainContentArea').textContent);
    o.plt = JSON.stringify(mfdIds()); mfdSeatSet('CPLT'); o.cplt = JSON.stringify(mfdIds()); mfdSeatSet('PLT');
    CDU_ACT.switchMode('HOME');
    // ── SYSTEM(MFD4) 고장 — REV 램프 → 누르면 2초 · PFD 대체 모드 EIS ──
    sysLayout = 'FULL'; sysPageSet('asys_fuel');
    mfdFailSet('sys', true); mfdStep(0.1);
    const lamp = texts(() => drawPFD()); o.revLamp = mfdRevPending();
    mfdRevPress(); mfdStep(1); o.rev1 = mfdSys.rev; mfdStep(1.2); o.rev2 = mfdSys.rev && pfdRevMode();
    const fakeE = () => { const c = document.createElement('canvas'); c.width = 1000; c.height = 630; return { c, g: c.getContext('2d'), dpr: 1 }; };
    const sd = texts(() => mfdSysOverride(fakeE())); o.sysBlack = sd.includes('MFD4 FAIL');
    mfdFailSet('sys', false); mfdStep(10); o.recWait = mfdSys.rev; mfdStep(8); o.rec = !mfdSys.rev && !mfdPfdRev();
    // 안 누르면 8초
    mfdFailSet('pfd', true); mfdStep(7); o.auto7 = mfdSys.rev; mfdStep(1.2); o.auto8 = mfdSys.rev;
    o.pfdBlack = texts(() => drawPFD()).includes('MFD2 FAIL');
    o.sysPfd = texts(() => mfdSysOverride(fakeE())).some(x => /ALT|HDG|IAS/.test(x));
    mfdFailSet('pfd', false); mfdStep(18);
    // ── 배터리 단독 — 기장 자리: CDU2 꺼짐 · 부기장 자리: MFD3 꺼짐 → PFD 대체 EIS ──
    ovhdSet('gen1', 'OFF'); ovhdSet('gen2', 'OFF');
    o.battOnly = elecState().battOnly;
    mfdStep(0.25); const ov = document.getElementById('cdu-nopwr');
    o.cduDead = cduDead() && !!ov && ov.style.display === 'flex' && /CDU2/.test(ov.textContent);
    mfdSeatSet('CPLT'); mfdStep(0.25);
    o.mfd3 = !cduDead() && mfdSysDead() && pfdRevMode() && document.getElementById('cdu-nopwr').style.display === 'none';
    mfdSeatSet('PLT'); ovhdSet('gen1', 'ON'); ovhdSet('gen2', 'ON'); mfdStep(0.25);
    o.back = !cduDead() && document.getElementById('cdu-nopwr').style.display === 'none';
    return o;
  });
  t.ok(r.half0, 'MFD(SYSTEM 창)는 처음 HALF 로 시작한다(지상 전원 인가)');
  t.ok(r.tabs && r.pen === 18 && r.tql, `PERF — Config · Hover · Cruise · 방빙+ECS-H 면 가용 토크 −18% (${r.pen}) · TQ-L S2.5M 이면 더 크다`);
  t.ok(r.hot.alt === 9000 && r.hot.temp === 35 && r.hot.ogeRed && r.redShown, `Use Defaults(지금 고도 · 외기) · 높고 더우면 OGE 요구 토크가 MTA 를 넘어 적색 (${JSON.stringify(r.hot)})`);
  t.ok(r.maxGwYel, 'MAX Gross WT 가 지금 무게 이하면 황색');
  t.ok(r.cruise, 'Cruise — VNE · MAX END · Range(예비 340 lb 제외) · OEI · ROC');
  t.ok(r.mfdPerf, 'MFD(SYSTEM) Helicopter Performance — 값과 H-V 선도');
  t.ok(r.hvIn && !r.hvHigh && !r.hvFast && r.hvHot, 'H-V — 해면 0~22kt · 25~210ft 안은 회피영역 · 4,000ft ISA+20 이면 465ft 까지');
  t.ok(r.seatRow && r.plt === '{"pfd":"MFD2","sys":"MFD4","cdu":"CDU2"}' && r.cplt === '{"pfd":"MFD1","sys":"MFD3","cdu":"CDU1"}', '자리 — 기장 CDU2 · MFD2/4 · 부기장 CDU1 · MFD1/3');
  t.ok(r.revLamp && !r.rev1 && r.rev2 && r.sysBlack, 'SYSTEM(MFD4) 고장 — REV 램프 · 누르면 2초 뒤 PFD 대체 모드 EIS · SYSTEM 창은 꺼짐');
  t.ok(r.recWait && r.rec, '고장이 풀리면 약 17.5초 뒤 정상 화면');
  t.ok(!r.auto7 && r.auto8 && r.pfdBlack && r.sysPfd, 'PFD(MFD2) 고장 — REV 를 누르지 않으면 8초 뒤 SYSTEM 창이 PFD 백업');
  // ── GEN 은 MGB(NR 84% 이상) · 다른 캔버스의 PFD 는 CAS 줄 수를 건드리지 않는다 ──
  const g = await page.evaluate(() => {
    const o = {}, nr0 = window._nrNoSim;
    fadecSync(); ovhdSet('pcd1', 'OFF'); fadecSync();
    const E1 = elecState(); o.oneEng = E1.gen1 && E1.gen2 && engParams().nr >= 84 && !pfdMsgs().some(m => m.t === '1 GEN');
    window._nrNoSim = () => 80; const E2 = elecState(); o.lowNr = !E2.gen1 && !E2.gen2; window._nrNoSim = nr0;
    ovhdSet('pcd1', 'FLY'); fadecSync();
    // CAS — 본 PFD 의 줄 수가 다른 크기 캔버스를 그려도 그대로
    const keep = window.pfdMsgs; window.pfdMsgs = () => Array.from({ length: 30 }, (_, i) => ({ t: 'M' + i, c: '#22e022' }));
    drawPFD(); const l0 = pfdCasLines, ov0 = pfdCasOverflow();
    const c = document.createElement('canvas'); c.width = 300; c.height = 240; c.dataset.noFcp = '1'; drawPfdTo(c);
    o.cas = pfdCasLines === l0 && pfdCasOverflow() === ov0;
    window.pfdMsgs = keep; casAct.clear();
    return o;
  });
  t.ok(g.oneEng, 'NO1 엔진을 꺼도 NR 이 84% 이상이면 GEN 1 · 2 모두 정상(GEN 은 MGB 에 물려 있다)');
  t.ok(g.lowNr, 'NR 이 84% 아래면 두 GEN 모두 떨어진다');
  t.ok(g.cas, '3D 위 PFD · 팝아웃처럼 다른 캔버스에 그려도 본 PFD 의 CAS 줄 수 · 소프트키 CAS 가 흔들리지 않는다');
  // ── 계통 소리 — APU 17초 시동 · 엔진 약 25초 시동 · 스위치를 끄면 소리도 꺼진다 ──
  const sd = await page.evaluate(() => {
    const o = {}, now = performance.now();
    ovhdSet('apuContr', 'ON'); _apuOnT = now - 2000; const a1 = sysSndState().apu;
    _apuOnT = now - 10000; const a2 = sysSndState().apu;
    _apuOnT = now - 18000; const a3 = sysSndState().apu;
    o.apu = a1.phase === 'START' && a1.spool < 0.3 && a2.phase === 'START' && a2.spool > a1.spool && a2.spool < 1 && a3.phase === 'RUN' && a3.spool === 1;
    ovhdSet('apuContr', 'OFF'); _apuOnT = null; const a4 = sysSndState().apu; o.apuOff = a4.phase === 'OFF' && a4.spool === 0;
    ovhdSet('apuContr', 'ON'); _apuOnT = now - 20000;   // 시동 공압원
    const ra0 = window.radarAltFt; window.radarAltFt = () => 0;
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); Object.assign(fadec.e[1], { stCool: 0, consec: 0, post5: 0, lock: 0, ng: 0, tgt: 20 });
    ovhdSet('pcd1', 'IDLE'); fadecStep(0.1); o.crank = sysSndState().eng[1].starter && !sysSndState().eng[1].ign;
    let n = 0, ign = false; for (; n < 400 && fadec.e[1].ph !== 'RUN'; n++) { fadecStep(0.1); if (sysSndState().eng[1].ign) ign = true; }
    o.secs = n / 10; o.ign = ign; o.run = !sysSndState().eng[1].starting;
    // EOP — 시동 5초 뒤부터 20초 동안 서서히(시동이 끝나 갈 때 정상값)
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); Object.assign(fadec.e[1], { stCool: 0, consec: 0, post5: 0, lock: 0, ng: 0, tgt: 20 });
    ovhdSet('pcd1', 'IDLE'); fadecStep(0.1);
    const eopAt = s => { while (fadec.e[1].eopT < s - 1e-6) fadecStep(0.1); return eisData().eop[0]; };
    o.eop = [eopAt(3), eopAt(5), eopAt(10), eopAt(15), eopAt(22), eopAt(27)];
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); o.engOff = sysSndState().eng[1].ph === 'OFF' && !sysSndState().eng[1].starting;
    try { sysSndTick(0.1); o.tick = true; } catch (e) { o.tick = false; }
    ovhdSet('pcd1', 'FLY'); fadecSync(); ovhdSet('apuContr', 'OFF'); _apuOnT = null; window.radarAltFt = ra0;
    return o;
  });
  t.ok(sd.apu && sd.apuOff, `APU 소리 — CONTR ON 뒤 17초 동안 시동 소리가 차오르고 작동 소리로 · OFF 면 꺼진다 (${JSON.stringify(sd)})`);
  t.ok(sd.crank && sd.ign && sd.run && sd.secs >= 22 && sd.secs <= 28, `엔진 시동 소리 — 시동기 → 점화 → 분리까지 약 25초 (${sd.secs}초)`);
  t.ok(sd.eop[0] === 0 && sd.eop[1] === 0 && sd.eop[2] > 15 && sd.eop[2] < 19 && sd.eop[3] > sd.eop[2] && sd.eop[4] > sd.eop[3] && sd.eop[4] < 68 && sd.eop[5] === 68,
    `SYSTEM 창 EOP — 시동 5초 뒤부터 20초 동안 서서히 오른다 (3·5·10·15·22·27초: ${sd.eop.map(v => Math.round(v)).join(' · ')})`);
  t.ok(sd.engOff && sd.tick, 'PCD OFF 면 엔진 시동 소리도 꺼진다 · 소리 장치가 없어도 오류 없음');
  t.ok(r.battOnly && r.cduDead && r.mfd3 && r.back, '배터리 단독 — 기장 자리면 CDU2 꺼짐 · 부기장 자리면 MFD3 꺼짐(PFD 대체 EIS) · 전원이 돌아오면 되살아난다');
}
