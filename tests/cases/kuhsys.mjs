// 흰수리 계통 보강(36-kuhsys.js · 33-train4.js) — CDU RA Self Test · System Tests · Lighting Config · Maintenance(CMC Log) ·
// TCAS II(SL · RA 종류 · 음성 · 띠 · TRAFFIC 알림) · T700 시동(공압원 · NG 54% 분리 · HSP 963 · AISBV · 냉각 · FAIL FIX)
export const name = 'KUH 계통';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms)), o = {};
    selectPanel('mid', 'cdu', true);
    const open = id => { CDU_ACT.switchMode('ACSYS'); CDU_ACT.acSysOpen(id); };
    const box = () => document.getElementById('kuhsys');
    const click = (act, arg) => { const e = [...document.querySelectorAll(`#mainContentArea [data-act="${act}"]`)].find(x => arg === undefined || x.dataset.arg === JSON.stringify(arg)); if (e) e.click(); return !!e; };
    // ── RA Self Test ──
    open('asys_ratest'); await w(30);
    o.raPage = !!box() && /GRA1/.test(box().textContent);
    raSt.sling = true; raSt.mode = 'ALLOW'; _raBite(); o.slingAllow = pfdSysMsgs().includes('GRA1 SERVICE');
    click('raStSet', ['INHIBIT']); await w(150); o.inhibit = raSt.mode === 'INHIBIT' && !pfdSysMsgs().includes('GRA1 SERVICE');
    CDU_ACT.switchMode('ACSYS'); await w(20); o.sub = /Inhibit/.test(document.getElementById('mainContentArea').textContent);
    // BITE — Allow · 250ft 아래는 안 함 · 위에서 60초마다
    raStSet('ALLOW'); raSt.sling = false; const ra0 = window.radarAltFt; const n0 = raSt.n;
    window.radarAltFt = () => 200; raSt.t = 0; raStStep(70); o.bLow = raSt.n === n0;
    window.radarAltFt = () => 800; raStStep(30); raStStep(31); o.bHigh = raSt.n === n0 + 1;
    window.radarAltFt = () => 3000; raStStep(0.1); o.bNoComp = raSt.n === n0 + 2; window.radarAltFt = ra0;
    // ── System Tests ──
    open('asys_tests'); await w(30);
    o.tests = SYS_TEST_IDS.every(k => box().textContent.includes(k)) && /Ready To Execute/.test(box().textContent);
    click('sysTestRun', ['FQMS 1']); await w(150); o.busy = /Busy/.test(box().textContent) && sysTst.st['FQMS 1'] === 'In Progress';
    sysTestStep(3.1); o.fqms = sysTst.st['FQMS 1'];
    sysTestRun('Engine 1'); sysTestStep(20.1); o.epacGnd = sysTst.st['Engine 1'];
    sysTestRun('CVFDR'); sysTestStep(2.1); o.cvfdr = sysTst.st.CVFDR;
    click('sysTestRun', ['Lamp Test']); await w(150); drawPFD();
    const seen = []; { const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push([String(x), String(this.fillStyle)]); return f.call(this, x, ...a); }; try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = f; } }
    o.lamp = lampTestOn && document.documentElement.classList.contains('lamptest') && (seen.find(x => x[0] === 'CAUT') || [])[1] === '#000000' && seen.some(x => x[0] === 'MSG');
    sysTestRun('Lamp Test'); o.lampOff = !lampTestOn && !document.documentElement.classList.contains('lamptest');
    // ── Lighting Config ──
    open('asys_light'); await w(30);
    o.lit = /DISPLAY/.test(box().textContent);
    ovhdSet('display', 'NVG'); litApply(); o.nvg = litOut().mfdMode === 'NVIS' && /hue-rotate/.test(document.getElementById('pfd').style.filter);
    ovhdSet('display', 'DAY'); litSet('cdu', 'DAY'); litBrt(-30); o.cduDim = /brightness\(0\.5/.test(document.querySelector('#cdu-wrap #mainContentArea').style.filter);
    litCfg.cdu = 'AUTO'; litCfg.cduBrt = 80; litSave(); litApply(); o.litBack = document.getElementById('pfd').style.filter === '' && document.querySelector('#cdu-wrap #mainContentArea').style.filter === '';
    // ── Maintenance ──
    open('asys_maint'); await w(30);
    document.getElementById('maint-pw').value = 'WRONG'; click('maintPwEnter'); await w(30); o.pwErr = maint.err && maint.step === 'PASSWORD';
    document.getElementById('maint-pw').value = 'admin'; click('maintPwEnter'); await w(30); o.pwOk = maint.step === 'SYS_MAINT';
    click('maintGo', ['LOGGING_STATUS']); await w(30); click('maintGo', ['FAULTS_LIST']); await w(30);
    cduKeyStuck = true; mflStep(); cduKeyStuck = false; mflStep();
    click('maintGo', ['CMC_LOG_VIEWER', 'LOG_NOW']); await w(30);
    o.mfl = maint.step === 'CMC_LOG_VIEWER' && sysPage === 'asys_maint' && maint.mfl.slice(-2).map(m => m.t + ':' + m.st).join(',');
    const sv = []; { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { sv.push(String(x)); return f.call(this, x, ...a); }; try { sysDrawTo(cv); } finally { CanvasRenderingContext2D.prototype.fillText = f; } }
    o.viewer = sv.includes('CMC Log Viewer — Event Entries') && sv.includes('CDU KEY STUCK') && sv.includes('CLEARED');
    maintBack(); o.back = maint.step === 'FAULTS_LIST'; maintGo('PASSWORD');
    CDU_ACT.switchMode('HOME');
    // ── TCAS II ──
    envSet({ traffic: 0 }); trafficStep(0);
    S.lat = 37; S.lon = 126; S.alt = 3000; S.hdg = 0; S.spd = 100; S.vs = 0; tcasCfg.mode = 'Auto';
    const said = [], sp = window.speak; window.speak = x => { said.push(x); return true; };
    const ra1 = window.radarAltFt; window.radarAltFt = () => 3000;
    trafficAdd({ brg: 0, nm: 1.0, rel: -200, hdg: 180, ac: 'kuh', spd: 120 }); traffic[0].vs = 0;
    tcasEval(); o.sl = tcasSl().sl; o.climb = { st: tcasState, type: tcasRaType, sense: tcasRaSense, go: tcasRaCue && tcasRaCue.vsGo };
    // 아래 침입기인데 이미 2,000fpm 상승 중 — Increase climb
    S.vs = 2000; tcasEval(); o.incr = tcasRaVoice;
    // 위로 바뀌어 강하가 되면 — 뒤집힘(NOW)
    S.vs = 0; traffic[0].alt = S.alt + 200; tcasEval(); o.rev = tcasRaVoice;
    // 고도 차 500ft · 내 승강 0 — 예방 RA(Monitor vertical speed)
    traffic[0].alt = S.alt + 500; tcasEval(); o.mon = { type: tcasRaType, voice: tcasRaVoice };
    // PFD — TRAFFIC 알림(RA 적 · 5초 점멸) · 승강계 띠
    traffic[0].alt = S.alt - 200; tcasEval(); const ann = tcasAnn(); o.ann = ann && ann.txt + ':' + ann.col + ':' + ann.blink;
    const pv = []; { const f = CanvasRenderingContext2D.prototype.fillRect; CanvasRenderingContext2D.prototype.fillRect = function (...a) { pv.push(String(this.fillStyle)); return f.apply(this, a); }; try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillRect = f; } }
    o.bands = pv.some(c => /255, *40, *40|rgba\(255,40,40/.test(c)) && pv.some(c => /34, *224, *34|rgba\(34,224,34/.test(c));
    // 멀어지면 Clear of conflict · 1,000ft AGL 아래 Auto 는 RA 없음(TA)
    traffic[0].lat = 37 + 12 / 60; tcasEval(); o.clear = tcasState;
    traffic[0].lat = 37 + 1.0 / 60; window.radarAltFt = () => 600; tcasEval(); o.low = { st: tcasState, sl: tcasSl().sl };
    window.radarAltFt = ra1; window.speak = sp; o.said = said.slice();
    envSet({ traffic: 0 }); trafficStep(0); tcasEval();
    // ── T700 시동 ──
    const raG = window.radarAltFt; window.radarAltFt = () => 0;   // 지상
    fadecSync(); const _apuOnT0 = _apuOnT;
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); o.off = fadec.e[1].ph;
    // 공압원 없음 — 시동 실패
    _apuOnT = null; ovhdSet('apuContr', 'OFF'); ovhdSet('pcd1', 'IDLE'); fadecStep(0.1); o.noBleed = fadec.e[1].ph + ':' + /공압원/.test(fadec.e[1].why);
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); fadec.e[1].stCool = 0; fadec.e[1].consec = 0;
    // APU 로 — NG 12% 점화 · 54% 시동기 분리 · ENG STRT 조언
    ovhdSet('apuContr', 'ON'); _apuOnT = performance.now() - APU_START_MS - 1;
    ovhdSet('pcd1', 'IDLE'); fadecStep(0.1); o.crank = fadec.e[1].ph; o.strt = pfdMsgs().some(m => m.t === '1 ENG STRT');
    for (let i = 0; i < 70; i++) fadecStep(0.1); o.ign = fadec.e[1].ph + ':' + Math.round(fadec.e[1].ng) + ':' + (engParams().e1.ng > 12);
    for (let i = 0; i < 200; i++) fadecStep(0.1); o.run = fadec.e[1].ph + ':' + simEngSt[1] + ':' + (fadec.e[1].stCool > 0);
    o.strtOff = !pfdMsgs().some(m => m.t === '1 ENG STRT');
    // 고온 시동(지상) — TGT 963℃ 넘으면 HSP 자동 중지 · ENG1 H-START S-DOWN · 1 ENG FAULT
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); Object.assign(fadec.e[1], { stCool: 0, consec: 0, post5: 0, lock: 0, ng: 0, tgt: 20 });
    fadecFault(1, 'HOT', true); ovhdSet('pcd1', 'IDLE');
    for (let i = 0; i < 450 && fadec.e[1].ph !== 'ABORT'; i++) fadecStep(0.1);
    o.hsp = fadec.e[1].ph + ':' + /HSP/.test(fadec.e[1].why) + ':' + pfdSysMsgs().includes('ENG1 H-START S-DOWN') + ':' + pfdMsgs().some(m => m.t === '1 ENG FAULT');
    fadecFault(1, 'HOT', false);
    // 바로 다시 — 시동기 식히는 중
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); ovhdSet('pcd1', 'IDLE'); fadecStep(0.1); o.cool = fadec.e[1].ph + ':' + /식히는/.test(fadec.e[1].why);
    // AISBV 고착 — NG 40% 부근 실속
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); Object.assign(fadec.e[1], { stCool: 0, consec: 0, ng: 0 });
    fadecFault(1, 'AISBV', true); ovhdSet('pcd1', 'IDLE');
    for (let i = 0; i < 350 && fadec.e[1].ph !== 'ABORT'; i++) fadecStep(0.1); o.aisbv = fadec.e[1].ph + ':' + /실속/.test(fadec.e[1].why); fadecFault(1, 'AISBV', false);
    // 2분 식히지 않고 끄면 5분 → 4시간 시동 금지
    ovhdSet('pcd1', 'FLY'); fadecSync(); fadec.e[1].cool90 = 10; ovhdSet('pcd1', 'OFF'); fadecStep(0.1);
    o.post5 = fadec.e[1].post5 > 0; fadecStep(301); o.lock = fadec.e[1].lock > 3 * 3600;
    ovhdSet('pcd1', 'IDLE'); fadecStep(0.1); o.locked = fadec.e[1].ph + ':' + /4시간/.test(fadec.e[1].why);
    window.radarAltFt = raG;
    // FAIL FIX — 그 고도에서 4,000ft 내려오면 실속
    ovhdSet('pcd1', 'OFF'); fadecStep(0.1); Object.assign(fadec.e[1], { lock: 0, post5: 0 });
    ovhdSet('pcd1', 'FLY'); fadecSync(); S.alt = 6000; fadecFault(1, 'FAIL_FIX', true); fadecStep(0.1);
    o.fix = pfdMsgs().some(m => m.t === '1 FADEC') && pfdSysMsgs().includes('ENG1 FAIL FIX');
    S.alt = 1900; fadecStep(0.1); o.fixStall = fadec.e[1].ph + ':' + simEngSt[1];
    // OEI TGT 한계 — 건너편이 멎으면 974℃
    ovhdSet('pcd1', 'FLY'); fadecSync(); S.alt = 3000; o.lim = [fadecOeiExp(1)];
    fadec.e[2].ph = 'OFF'; o.lim.push(fadecOeiExp(1)); fadecSync();
    ovhdSet('apuContr', 'OFF'); _apuOnT = _apuOnT0;
    return o;
  });
  t.ok(r.raPage && r.slingAllow && r.inhibit && r.sub, 'RA Self Test — 슬링 + Allow 면 GRA SERVICE(PFL) · Inhibit 로 바꾸면 사라지고 단추 글씨도 Inhibit');
  t.ok(r.bLow && r.bHigh && r.bNoComp, 'RA BITE — 250ft 아래 안 함 · 위에서 60초마다 · 2,550ft 넘으면 곧바로');
  t.ok(r.tests && r.busy && r.fqms === 'Done' && r.epacGnd === 'Done' && r.cvfdr === 'Pass', `System Tests — 일곱 단추 · Busy · FQMS Done · 지상 EPAC Done · CVFDR Pass (${r.fqms} ${r.epacGnd} ${r.cvfdr})`);
  t.ok(r.lamp && r.lampOff, 'Lamp Test — MWP · MSG · 콘솔 램프가 모두 켜지고 다시 누르면 꺼진다');
  t.ok(r.lit && r.nvg && r.cduDim && r.litBack, 'Lighting Config — DISPLAY NVG 면 MFD NVIS · CDU 수동 밝기 · 낮 AUTO 는 필터 없음');
  t.ok(r.pwErr && r.pwOk, 'Maintenance — 비밀번호가 틀리면 막고 맞으면 System Maintenance');
  t.ok(r.mfl === 'CDU KEY STUCK:SET,CDU KEY STUCK:CLEARED' && r.viewer && r.back, `CMC Log Viewer — PFL 이 SET · CLEARED 로 쌓여 SYSTEM 창에 (${r.mfl})`);
  t.ok(r.sl === 4 && r.climb.st === 'RA' && r.climb.type === 'CLIMB' && r.climb.sense === 1 && r.climb.go, `TCAS II — 3,000ft AGL SL4 · 아래 침입기 1NM → 상승 RA (${r.climb.type})`);
  t.eq(r.incr, 'Increase climb', '이미 빠르게 오르고 있으면 Increase climb');
  t.eq(r.rev, 'Descend, descend NOW', '상승 RA 가 강하로 뒤집히면 Descend, descend NOW');
  t.ok(r.mon.type === 'MONITOR' && r.mon.voice === 'Monitor vertical speed', '고도 차 450ft 넘고 수평이면 예방 RA(Monitor vertical speed)');
  t.ok(/^TRAFFIC:#ff3030:true$/.test(r.ann) && r.bands, `PFD — TRAFFIC 알림(RA 적 · 처음 5초 점멸) · 승강계 붉은 · 초록 띠 (${r.ann})`);
  t.ok(r.clear === 'CLEAR' && r.said.includes('Clear of conflict'), 'RA 가 풀리면 Clear of conflict');
  t.ok(r.low.st === 'TA' && r.low.sl === 2, 'Auto — 1,000ft AGL 아래는 RA 없이 TA(SL2)');
  t.ok(r.off === 'OFF' && r.noBleed === 'ABORT:true', `T700 — 공압원(APU · 교차 블리드) 없으면 시동 실패 (${r.noBleed})`);
  t.ok(r.crank === 'CRANK' && r.strt && /^IGN:\d+:true$/.test(r.ign) && r.run === 'RUN:IDLE:true' && r.strtOff, `시동 — CRANK · 1 ENG STRT · NG 12% 점화 · 54% 시동기 분리 → IDLE (${r.ign} · ${r.run})`);
  t.eq(r.hsp, 'ABORT:true:true:true', '지상 고온 시동 — TGT 963℃ 넘으면 HSP 자동 중지 · PFL · 1 ENG FAULT');
  t.eq(r.cool, 'ABORT:true', '시동 뒤 60초는 시동기 식히는 중');
  t.eq(r.aisbv, 'ABORT:true', 'AISBV 고착 — NG 40% 부근 압축기 실속');
  t.ok(r.post5 && r.lock && r.locked === 'ABORT:true', '2분 식히지 않고 끄면 5분 · 넘기면 4시간 시동 금지');
  t.ok(r.fix && r.fixStall === 'OFF:OFF', `FAIL FIX — 1 FADEC · ENG1 FAIL FIX · 4,000ft 내려오면 실속 (${r.fixStall})`);
  t.ok(r.lim[0] === false && r.lim[1] === true, 'OEI TGT 한계 — 건너편이 멎으면 974℃ 로 넓어진다');
}
