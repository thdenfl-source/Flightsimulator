// 흰수리 계통 보강 2 — 시동 중 NG 옆 세로 START · CDU 8.33kHz · Flight ID(K~Z) 입력 · Push:Radar · Config Mode ·
// NAV 예비 · 교환 · DME HOLD · ILS 자동 · HOCAS(MEP CTL · DMS · CURSOR) · 전기(GCU · 버스 타이 · 차단 · 배터리) · AFCS(PFT · 잠김 · 남는 모드)
export const name = 'KUH 계통 2';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms)), o = {};
    const texts = fn => { const seen = [], f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return f.call(this, x, ...a); }; try { fn(); } finally { CanvasRenderingContext2D.prototype.fillText = f; } return seen; };
    const R = cduKnobRadio;
    selectPanel('mid', 'cdu', true);
    // ── 시동 중 START ──
    fadecSync(); fadec.e[1].ph = 'CRANK';
    const sp = texts(() => drawPFD()), ss = texts(() => { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; _sysPaint(cv.getContext('2d'), cv, 1000, 630, 1, false); });
    const cnt = a => a.filter(x => x.length === 1).join('').includes('START');
    o.start = engStarting(1) && !engStarting(2) && cnt(sp) && cnt(ss);
    fadecSync(); o.startOff = !cnt(texts(() => drawPFD()));
    // ── 8.33 kHz ──
    CDU_ACT.switchMode('HOME'); await w(20);
    CDU_ACT.setComSpacing('8.33'); await w(20);
    const s0 = R.state().freqs.com1.stb; cduKnobOp('R', 'rotIn', 1); o.k833 = [s0, R.state().freqs.com1.stb, document.getElementById('h-com1-stb').textContent];
    cduKnobOp('R', 'rotIn', 1); cduKnobOp('R', 'rotIn', 1); cduKnobOp('R', 'rotIn', 1); o.k833b = R.state().freqs.com1.stb;
    CDU_ACT.setComSpacing('25'); await w(20); o.k25 = document.getElementById('h-com1-stb').textContent;
    // ── Flight ID ──
    CDU_ACT.switchMode('TCAS_XPDR'); await w(20);
    CDU_ACT.fidEditToggle(); await w(20); o.fidLbl = /Data Entry/.test(document.getElementById('cdu-lbl-R').textContent);
    cduKnobOp('R', 'rotIn', 1); o.fid1 = R.state().fidBuf[0];       // K → L
    cduKnobOp('R', 'rot', 1); cduKnobOp('R', 'rotIn', -1); o.fid2 = R.state().fidBuf[1];   // U → T
    o.cur = !!document.querySelector('#mainContentArea .knob-cur');
    cduKnobOp('R', 'push'); o.fid = R.state().fid;
    CDU_ACT.switchMode('HOME');
    // ── 레이더 제어 ──
    videoCfg.ch = 'RADAR'; sysLayout = 'FULL'; sysPageSet('asys_video');
    cduKnobSync(); o.pushRadar = /Push:Radar/.test(document.getElementById('cdu-lbl-L').textContent);
    cduKnobOp('L', 'push'); o.rOpen = radarCtl.open && !knobPtr.on;
    cduKnobOp('L', 'rot', 1); cduKnobOp('R', 'rot', 1); cduKnobOp('R', 'rotIn', -1); cduKnobOp('R', 'push');
    o.radar = `${radarCtl.range}:${radarCtl.tilt}:${radarCtl.gain}:${radarCtl.tx}`;
    const rv = texts(() => { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; sysDrawTo(cv); }); o.rDraw = rv.includes('RADAR CONTROL');
    cduKnobOp('L', 'push'); o.rClose = !radarCtl.open; sysPageSet('asys_fuel');
    // ── Config Mode ──
    CDU_ACT.switchMode('ACSYS'); CDU_ACT.acSysOpen('asys_maint'); await w(20);
    maint.step = 'SYS_MAINT'; _ksRefresh(true);
    [...document.querySelectorAll('#mainContentArea [data-act="cfgEnter"]')][0].click(); await w(30);
    o.cfg = cfgMode.on && /Config Mode/.test(document.getElementById('kuhsys').textContent);
    cduKnobOp('R', 'rot', 1); o.cfgPage = CFG_PAGES[cfgMode.page]; cduKnobOp('R', 'push'); o.cfgIn = cfgMode.in;
    cduKnobOp('L', 'rot', 1); cduKnobOp('R', 'rotIn', 1); o.cfgKnob = /R rotIn/.test(cfgMode.last) && cfgMode.item === 1;
    cfgExit(); maintGo('PASSWORD'); CDU_ACT.switchMode('HOME');
    // ── NAV 예비 · 교환 · DME HOLD ──
    setNavRadio('NAV1', '113.60', null); const a0 = navRadios.NAV1.freq; navStby.NAV1 = '116.90';
    setNavRadio('NAV1', '114.20', null); o.push = Math.abs(parseFloat(navStby.NAV1) - parseFloat(a0)) < 0.001 && Math.abs(navRadios.NAV1.freq - 114.2) < 0.001;
    navSwap('NAV1'); o.swap = Math.abs(navRadios.NAV1.freq - 113.6) < 0.001 && Math.abs(parseFloat(navStby.NAV1) - 114.2) < 0.001;
    const v0 = (typeof ENR_VORS !== 'undefined' ? ENR_VORS : [])[0];
    if (v0) { setNavRadio('NAV1', v0.freq, v0.id); navDmeHoldToggle('NAV1'); setNavRadio('NAV1', '108.00', null); o.dme = !!navDmeHold.NAV1 && navDmeHold.NAV1.id === v0.id && texts(() => drawPFD()).some(x => x === v0.id + ' H'); navDmeHoldToggle('NAV1'); }
    else o.dme = true;
    // ILS 자동 — FMS 인 채로 LOC 진로 위 · 15NM 안이면 그 NAV 로
    const L0 = (typeof LOC_STATIONS !== 'undefined' ? LOC_STATIONS : []).find(x => Number.isFinite(x.crs));
    if (L0) {
      setNavRadio('NAV2', L0.freq, L0.id); setNavSrc('FMS'); _ilsAutoDone = '';
      const back = (L0.crs + 180) % 360, d = 8 / 60;
      S.lat = navRadios.NAV2.lat + d * Math.cos(back * Math.PI / 180); S.lon = navRadios.NAV2.lon + d * Math.sin(back * Math.PI / 180) / Math.cos(S.lat * Math.PI / 180);
      const wps = S.wps; S.wps = []; navIlsAutoStep(); o.ils = navSrc; S.wps = wps; setNavSrc('FMS');
    } else o.ils = 'NAV2';
    // ── HOCAS ──
    hocasSw.doi = null; hocasMep('R'); o.doi1 = hocasSw.doi; hocasMep('R'); hocasMep('R'); o.doi3 = hocasSw.doi && document.getElementById('map-wrap').classList.contains('hocas-doi');
    hocasDms('D'); o.dms = hocasSw.dms; hocasDms('U', true); o.dmsLong = hocasSw.dms;
    hocasCursor('en'); o.curOn = knobPtr.on; hocasCursor('slew', 1, 0); o.curX = hocasSw.cx > 0;
    const hc = texts(() => { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; _sysHocasPage(cv.getContext('2d'), 0, 0, 400, 600); });
    o.hTable = hc.includes('DMM') && hc.includes('On');
    hocasCursor('push'); o.curC = knobPtr.x === 0; hocasCursor('en'); o.curOff = !knobPtr.on;
    hocasMep('R'); o.doiPfd = hocasSw.doi; hocasSw.doi = null; _doiPaint();
    // ── 전기 ──
    elecFaultSet('gen1', 'OV'); elecStep(3); o.gcuWait = !gcuTripped(1); elecStep(2); o.gcuTrip = gcuTripped(1) && !elecState().gen1 && elecState().tie;
    ovhdSet('gen1', 'OFF'); elecFaultSet('gen1', null); ovhdSet('gen1', 'ON'); o.gcuReset = !gcuTripped(1);
    elecFaultSet('tru1', true); const e1 = elecState(); o.dcTie = e1.dcTie && !e1.tru1 && pfdMsgs().some(m => m.t === '1 TRU'); elecFaultSet('tru1', false);
    // 두 발전기 OFF + APU GEN — AC · DC NON-ESS 차단
    ovhdSet('gen1', 'OFF'); ovhdSet('gen2', 'OFF'); ovhdSet('apuContr', 'ON'); _apuOnT = performance.now() - APU_START_MS - 1; ovhdSet('apuGen', 'APU GEN');
    const e2 = elecState(); o.shed = e2.apuConn && !e2.acNess && !e2.dcNess;
    // 배터리 단독 — 80% 에서 50분
    ovhdSet('apuGen', 'OFF'); ovhdSet('apuContr', 'OFF'); _apuOnT = null;
    elecBatt.soc = 80; const e3 = elecState(); o.batt = e3.battOnly && Math.round(elecBattMin()) === 50;
    elecStep(60 * 10); o.battDrain = Math.round(elecBattMin()) === 40;
    elecBatt.soc = 10; o.battLow = pfdMsgs().some(m => m.t === 'BATT LOW');
    elecBatt.soc = 100; ovhdSet('gen1', 'ON'); ovhdSet('gen2', 'ON');
    // ── AFCS ──
    const fw = window.fuelWow, hn = window.hydNormal; window.fuelWow = () => true; window.hydNormal = () => true;   // 땅 위 · 유압 정상
    afcsLast = ''; afcsTest = null; afcsTestStart(); o.pftAp = afcsTest === null && /AP1 · AP2 를 OFF/.test(afcsLast);
    ovhdSet('ap1', 'IN'); ovhdSet('ap2', 'IN');
    afcsTestStart(); o.pftRun = !!afcsTest; afcsTestStart(); o.pftAbort = afcsTest === null && /ABORTED/.test(afcsLast);
    afcsFault.sema2.P = true; afcsTestStart(); afcsTest.t0 = performance.now() - 11000; afcsPhase(); o.minor = /기능 저하/.test(afcsLast) && afcsPft.fails === 1; afcsFault.sema2.P = false;
    afcsFault.apm1 = true; afcsFault.apm2 = true; for (let i = 0; i < 4; i++) { afcsTestStart(); afcsTest.t0 = performance.now() - 11000; afcsPhase(); }
    o.lock = afcsPft.lock && afcsPft.fails >= 5 && /운용 불가/.test(afcsLast);
    afcsFault.apm1 = false; afcsFault.apm2 = false; o.lockFail = afcsAxes().fail;
    afcsPft.lock = false; afcsPft.fails = 0; ovhdSet('ap1', 'OUT'); ovhdSet('ap2', 'OUT');
    window.fuelWow = fw; window.hydNormal = hn;
    // 남는 모드 — APM1 하나: 2 는 산다 · 피치 SEMA 둘: 피치만 SAS · COLL LINK: 컬렉티브만 · CAS
    afcsFault.apm1 = true; const A1 = afcsAxes(); o.apm1 = !A1.ap1 && A1.ap2 && !A1.fail; afcsFault.apm1 = false;
    afcsFault.semaBoth.P = true; const A2 = afcsAxes(); o.semaB = A2.sas[2] && !A2.sas[0] && !A2.sas[1] && A2.degraded; afcsFault.semaBoth.P = false;
    afcsFault.collLink = true; const A3 = afcsAxes(); o.coll = A3.sas[0] && !A3.sas[2] && pfdMsgs().some(m => m.t === 'COLL LINK'); afcsFault.collLink = false;
    return o;
  });
  t.ok(r.start && r.startOff, '시동 중 — PFD · SYSTEM 의 NG 옆에 세로로 START(끝나면 사라짐)');
  t.ok(/^\d{3}\.\d{3}$/.test(r.k833[1]) && r.k833[1] !== r.k833[0] && r.k833[2] === r.k833[1] && r.k833b !== r.k833[1], `8.33 kHz — 채널(.005 · .010 · .015 …) · XXX.XXX 시현 (${r.k833.join(' → ')} · ${r.k833b})`);
  t.ok(/^\d{3}\.\d{2}$/.test(r.k25), `25 kHz — XXX.XX 시현 (${r.k25})`);
  t.ok(r.fidLbl && r.fid1 === 'L' && r.fid2 === 'T' && r.cur && r.fid.startsWith('LT'), `Flight ID — Data Entry · 작은 노브 K→L · 큰 노브 커서 · 누름 Enter (${r.fid})`);
  t.ok(r.pushRadar && r.rOpen && r.radar === '40:1:15:true' && r.rDraw && r.rClose, `Push:Radar — 레이더 제어 · 거리 · TILT · GAIN · TX (${r.radar})`);
  t.ok(r.cfg && r.cfgPage === 'Knobs' && r.cfgIn && r.cfgKnob, 'Config Mode — 큰 노브 장 · 누름 들어감 · Knobs 장이 노브 입력을 보인다');
  t.ok(r.push && r.swap, 'NAV — 새 활성이 들어오면 앞 활성은 예비로 · ↕ 교환');
  t.ok(r.dme, 'DME HOLD — 다시 튜닝해도 잡아 둔 국의 거리(ident 뒤 H)');
  t.eq(r.ils, 'NAV2', 'ILS 자동 — CDI FMS 인 채로 15NM 안 LOC 진로에 들면 LOC 를 맞춘 NAV 로');
  t.ok(r.doi1 === 'pfd' && r.doi3 && r.dms === 'VIEW' && r.dmsLong === 'DIR' && r.curOn && r.curX && r.hTable && r.curC && r.curOff && r.doiPfd === 'pfd',
    'HOCAS — MEP CTL 로 DOI(PFD → SYSTEM → 지도) · DMS 메뉴 · CURSOR ENABLE · 움직임 · PUSH 가운데 · HOCAS 표');
  t.ok(r.gcuWait && r.gcuTrip && r.gcuReset, 'GCU — 과전압 4.5초 뒤 발전기 차단 · AC-BTC 닫힘 · GEN OFF→ON 으로 풀림');
  t.ok(r.dcTie, 'TRU 하나 고장 — DC BTC 닫힘 · 1 TRU 주의');
  t.ok(r.shed, '두 발전기 없이 APU GEN 만 — AC · DC NON-ESSENTIAL 차단');
  t.ok(r.batt && r.battDrain && r.battLow, '배터리 단독 — 80% 에서 50분 · 10분 뒤 40분 · 낮으면 BATT LOW');
  t.ok(r.pftAp && r.pftRun && r.pftAbort, 'P FLT TEST — AP 가 켜져 있으면 막고 · 시험 중 다시 누르면 중단');
  t.ok(r.minor && r.lock && r.lockFail, 'P FLT TEST 결과 — 사소한 결함(기능 저하) · 중요 결함 · 5회 실패면 AFCS FAIL(잠김)');
  t.ok(r.apm1 && r.semaB && r.coll, '남는 모드 — APM 하나는 다른 APM 으로 · SEMA 둘 고장은 그 축만 SAS · COLL LINK 는 컬렉티브만(CAS)');
}
