// SYSTEM 창 — MFD 계통 화면(js/18-system.js). CDU 의 Aircraft Systems 버튼이 화면을 고르고,
// 지금 갖춘 Fuel 화면은 연료 모델(엔진마다 토크로 먹고 집합 탱크를 채워 둔다)을 그린다.
export const name = 'SYSTEM 창';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    fuelReset();
    selectPanel('right', 'sysp', true); await wait(200);
    const texts = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (s, ...a) { seen.push(String(s)); return orig.call(this, s, ...a); };
      try { sysDraw(); } finally { proto.fillText = orig; }
      return seen;
    };
    const w = document.getElementById('sysp-wrap'), c = w.querySelector('canvas');
    const o = { shown: !w.classList.contains('page-hidden') && !!c && c.width > 100 };
    const t0 = texts().map(s => s.trim());
    o.fuel = ['Fuel', 'Left', 'Total', 'Right', '956 LBS', '2964 LBS', '958 LBS', '1050 LBS', 'EXT AUX1', 'EXT AUX2', 'FWD', 'FT 1', 'FT 2', 'AFT', 'F5',
              'MFSOV 1', 'PRESS 1', 'FLTR 1', 'FUEL 1', 'FUEL IMBALANCE', 'APU', 'Refuel Port', 'TGT', 'NG', 'Fuel QTY', 'Battery', 'ACCP']
      .filter(s => !t0.includes(s));
    // CDU 의 계통 버튼이 SYSTEM 화면을 고른다
    selectPanel('mid', 'cdu', true); await wait(100);
    CDU_ACT.switchMode('ACSYS'); await wait(50);
    document.querySelector('#mainContentArea [data-act="acSysOpen"][data-arg=\'["asys_elec"]\']').click(); await wait(50);
    o.elecPage = sysPage; o.elecTxt = texts().includes('Electrical');
    CDU_ACT.switchMode('ACSYS'); await wait(50);
    document.querySelector('#mainContentArea [data-act="acSysOpen"][data-arg=\'["asys_fuel"]\']').click(); await wait(80);
    o.fuelPage = sysPage;
    // CDU Fuel 칸 — 넣고 빼고 정하기
    const click = (act, arg) => document.querySelector(`#mainContentArea [data-act="${act}"][data-arg='${arg}']`).click();
    o.cduT0 = document.getElementById('fuelc-t').textContent;
    click('fuelAdjust', '[100]'); await wait(30); o.plus = Math.round(fuelLeft() + fuelRight());
    click('fuelSetTotal', '[1000]'); await wait(30); o.set1000 = [Math.round(fuelLeft()), Math.round(fuelRight())];
    o.cduT1 = document.getElementById('fuelc-t').textContent;
    click('fuelReset', '[]'); await wait(30); o.reset = Math.round(fuelTotal());
    // 연료 소모 — 시뮬 시계가 돌 때만, 배속을 따라
    const keep = { run: S.running, sp: simSpeed };
    const f = fuelFlow(); o.ff = [Math.round(f.f1), Math.round(f.f2)];
    S.running = false; _sysT = 0; sysTick(); await wait(300); sysTick(); o.stopped = fuelTotal();
    S.running = true; simSpeed = 8; _sysT = 0; sysTick(); await wait(500); sysTick();
    o.burn = 2964 - fuelTotal(); o.expect = (f.f1 + f.f2) * 8 * 0.5 / 3600;
    o.ft1 = fuel.ft1;
    S.running = keep.run; simSpeed = keep.sp;
    // FUEL LOW — 집합 탱크가 낮으면 호박색 칸
    fuelSetTotal(200); const fills = [];
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillRect;
    proto.fillRect = function (x, y, w, h) { fills.push([this.fillStyle, Math.round(x), Math.round(y)]); return orig.call(this, x, y, w, h); };
    try { sysDraw(); } finally { proto.fillRect = orig; }
    o.lowAmber = fills.some(a => a[0] === '#f2e64b' && a[1] === 517 && a[2] === 330);
    fuelReset(); CDU_ACT.switchMode('HOME');
    selectPanel('right', 'map', true); selectPanel('mid', 'cdu', true);
    return o;
  });
  t.ok(r.shown, 'SYSTEM 탭으로 창이 열리고 캔버스에 그린다');
  t.eq(r.fuel.length, 0, `Fuel 화면의 글자가 다 있다${r.fuel.length ? ' (없음: ' + r.fuel.join(', ') + ')' : ''}`);
  t.ok(r.elecPage === 'asys_elec' && r.elecTxt && r.fuelPage === 'asys_fuel', 'CDU 의 계통 버튼이 SYSTEM 창의 화면을 고른다');
  t.ok(r.cduT0 === '2964 LBS' && r.plus === 2014 && r.set1000.join() === '500,500' && r.cduT1 === '2050 LBS' && r.reset === 2964,
    `CDU Fuel 칸 — +100 · 기내 1000 으로 정하기(양쪽 반씩 · AUX 1050 그대로) · RESET (${r.cduT0} → ${r.plus} → ${r.set1000.join('/')} → ${r.reset})`);
  t.ok(r.ff[0] > 200 && r.ff[1] > 200, `엔진마다 연료 흐름(pph): ${r.ff.join(' · ')}`);
  t.ok(r.stopped === 2964, '시뮬 시계가 멈춰 있으면 연료가 줄지 않는다(기내 1914 + AUX 1050)');
  t.ok(r.burn > r.expect * 0.6 && r.burn < r.expect * 1.6 && Math.abs(r.ft1 - 266) < 0.5,
    `돌면 흐름 × 배속만큼 준다(${r.burn.toFixed(2)} lbs · 예상 ${r.expect.toFixed(2)}) · 집합 탱크는 가득 유지(FT1 ${r.ft1.toFixed(1)})`);
  t.ok(r.lowAmber, '집합 탱크가 낮으면 FUEL 1 LOW 칸이 호박색');

  // ── Electrical — 상부 콘솔 스위치를 따른다 ──
  const e = await page.evaluate(async () => {
    localStorage.removeItem('ovhdState'); ovhdReset();
    selectPanel('right', 'sysp', true); await new Promise(res => setTimeout(res, 150));
    sysPageSet('asys_elec');
    const pick = st => ({ gen1: st.gen1, gen2: st.gen2, apu: st.apu, apuConn: st.apuConn, ac: st.ac, tru1: st.tru1, tru2: st.tru2, dc: st.dc,
                          dcNess: st.dcNess, tie: st.tie, dropL: st.dropL, dropR: st.dropR,
                          genA: Math.round(st.genA), truA: Math.round(st.truA), bat: st.bat.a + '/' + st.bat.v });
    const o = { norm: pick(elecState()) };
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
    proto.fillText = function (x, ...a) { seen.push(String(x)); return orig.call(this, x, ...a); };
    try { sysDraw(); } finally { proto.fillText = orig; }
    o.missing = ['Electrical', 'GEN 1', 'GEN 2', 'APU GEN', 'AC GPU', 'AC 1', 'AC 2', 'Primary Bus', 'DIC 1', 'ESS 1', 'N-ESS',
                 'BATT', 'BATT BUS', 'TRU 1', 'TRU 2', 'DC 1', 'DC 2', 'SEC 1', 'SEC 2', '115A', '60A', '28V', '25.0°C'].filter(x => !seen.includes(x));
    ovhdSet('gen2', 'OFF'); o.oneGen = pick(elecState());
    ovhdSet('tru1', 'OFF'); ovhdSet('tru2', 'OFF'); o.noTru = pick(elecState());
    ovhdSet('apuContr', 'ON'); ovhdSet('apuGen', 'APU GEN'); _apuOnT = performance.now() - APU_START_MS - 1; o.apu = pick(elecState());   // APU 가 다 돈 뒤(17초)          // GEN 1 이 살아 있다 → APU 는 대기
    ovhdSet('gen1', 'OFF'); ovhdSet('tru1', 'ON'); ovhdSet('tru2', 'ON'); o.apuOnly = pick(elecState());   // 주 발전기 없음 → APU 가 맡는다
    ovhdSet('tru1', 'OFF'); ovhdSet('tru2', 'OFF');
    ovhdSet('apuContr', 'OFF'); o.noGen = pick(elecState());
    ovhdSet('batt', 'OFF'); o.dead = pick(elecState());
    ovhdReset(); localStorage.removeItem('ovhdState'); sysPageSet('asys_fuel');
    selectPanel('right', 'map', true);
    return o;
  });
  t.eq(e.missing.length, 0, `Electrical 화면의 글자가 다 있다${e.missing.length ? ' (없음: ' + e.missing.join(', ') + ')' : ''}`);
  t.ok(e.norm.gen1 && e.norm.gen2 && e.norm.ac && e.norm.tru1 && e.norm.tru2 && e.norm.dc && !e.norm.tie &&
       e.norm.genA === 115 && e.norm.truA === 60 && e.norm.bat === '5/28',
    `정상(GEN·TRU·BATT ON) — 발전기 115A 씩 · TRU 60A 씩 · 배터리 충전 (${JSON.stringify(e.norm)})`);
  t.ok(!e.oneGen.gen2 && e.oneGen.ac && e.oneGen.tie && e.oneGen.genA === 230,
    `GEN 2 OFF — GEN 1 이 230A 로 두 버스를 맡고 가운데 연결선이 켜진다`);
  t.ok(e.noTru.dc && e.noTru.bat === '-45/24', 'TRU 둘 다 OFF — DC 는 배터리가 맡는다(방전 −45A · 24V)');
  t.ok(!e.norm.tie && !e.norm.dropL && !e.norm.dropR && e.norm.dcNess, '두 주 발전기면 연결선·내려가는 선이 회색, DC N-ESS 살아 있음');
  t.ok(e.apu.apu && !e.apu.apuConn && e.apu.genA === 230 && e.apu.tie && !e.apu.dropL && e.apu.dropR,
    `주 발전기(GEN 1)가 살아 있으면 APU GEN 이 돌아도 버스에서 끊긴다(대기) — GEN 1 이 230A, 연결선은 AC 2 로만 (${JSON.stringify(e.apu)})`);
  t.ok(e.apuOnly.apuConn && e.apuOnly.ac && e.apuOnly.tie && e.apuOnly.dropL && e.apuOnly.dropR && e.apuOnly.genA === 230,
    '주 발전기가 없으면 APU GEN 이 붙어 연결선으로 AC 1·2 를 맡는다');
  t.ok(e.apuOnly.dc && !e.apuOnly.dcNess && e.apuOnly.truA === 50,
    `APU 로만 맡을 때 DC N-ESS 는 끊는다(불필요 전기 줄임 — TRU 부하 ${e.apuOnly.truA}A)`);
  t.ok(!e.noGen.ac && !e.noGen.tru1 && e.noGen.dc, '발전기가 다 없으면 AC 가 죽고 DC 는 배터리로');
  t.ok(!e.dead.dc, 'BATT 까지 OFF 면 DC 도 죽는다');

  // ── AFCS · Engine · Aircraft Status ──
  const q = await page.evaluate(async () => {
    localStorage.removeItem('ovhdState'); ovhdReset();
    selectPanel('right', 'sysp', true); await new Promise(res => setTimeout(res, 150));
    const texts = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (x, ...a) { seen.push(String(x).trim()); return orig.call(this, x, ...a); };
      try { sysDraw(); } finally { proto.fillText = orig; }
      return seen;
    };
    const o = {};
    aseOn = false; sysPageSet('asys_afcs'); const a0 = texts();   // (AFCS 가 걸리지 않은 화면 — ASE 는 AFCAU 로 곧 다시 켜진다)
    o.afcsIdle = ['SEMA1 OK', 'SEMA2 OK', 'TRIM OK', 'AFCS MAINTENANCE MODE', 'NOM DEF'].every(x => a0.includes(x)) && a0.filter(x => x === 'OFF').length === 6;
    // 시험 — 하부 콘솔 AFCAU 의 P FLT TST 를 누르면 시작한다. 시간을 앞당겨 단계를 본다
    afcsPfltOk = () => true;                     // 땅 위 · 유압 정상 조건은 'AFCS 연동' 검사가 본다
    afcsLast = ''; ovhdSet('bFltTst', 'IN'); o.pflt = !!afcsTest;
    const at = sec => { afcsTest.t0 = performance.now() - sec * 1000; return texts(); };
    const t1 = at(1), t4 = at(4), t8 = at(8);
    o.run = t1.includes('AP1 TEST RUNNING') && t1.includes('AP2 TEST RUNNING') && t1.includes('C') && t1.includes('YR') && t1.includes('P');
    o.ap2 = t4.includes('AP1 TEST RUNNING') && t4.includes('AP2 TEST OK');
    o.both = t8.includes('AP1 TEST OK') && t8.includes('AP2 TEST OK');
    const t11 = at(11); o.after = afcsTest === null && afcsLast === 'AFCS TEST OK';
    const t12 = texts();
    o.pfltOut = ovhdGet('bFltTst') === 'OUT';
    o.noMaint = !t12.includes('AFCS MAINTENANCE MODE') && !t12.includes('NOM DEF') && t12.includes('AFCS TEST OK');
    sysPageSet('asys_eng'); const e0 = texts();
    o.eng = ['Engine 1', 'Engine 2', 'MGB', 'IGB', 'TGB', 'Anti-Ice', 'EHC LCF 1', 'T45 Margin', 'PCD Position', 'Power Check', 'Incomplete', 'ALT UNS'].filter(x => !e0.includes(x));
    o.pcdFly = e0.filter(x => x === 'Fly').length === 2;
    ovhdSet('pcd1', 'IDLE'); ovhdSet('engAi2', 'ON'); const e1 = texts();
    o.pcdIdle = e1.includes('Idle') && e1.includes('On');
    ovhdSet('pcd1', 'FLY'); ovhdSet('engAi2', 'OFF');
    sysPageSet('asys_status'); const s0 = texts();
    o.status = ['Hydraulic 1', 'Hydraulic 2', 'Fuel', 'Signal Name', 'FQMS1', 'Total Fuel', 'Feed PRESS', 'MFSOV State', 'Crossfeed Valve Position',
                'Fire Detection', 'Fire Extinguishing', 'ADS Heat Status', 'Misc', 'ACC PRESS', 'Anti-Ice', 'Inlet1'].filter(x => !s0.includes(x));
    o.fireOk = s0.filter(x => x === 'FIRE').length === 0;
    ovhdSet('fireDet', 'ENG2'); ovhdSet('fire1', 'ARM'); ovhdSet('pitotHeat', 'OFF'); const s1 = texts();
    o.fireTest = s1.includes('FIRE');
    o.disch = s1.filter(x => x === 'On').length > s0.filter(x => x === 'On').length;   // ENG1 CMD On(T HANDLE ARM)
    o.pitotOff = s0.filter(x => x === 'Normal').length === 2 && !s1.includes('Normal');   // PITOT HEAT AUTO → Normal · OFF → Off
    ovhdReset(); localStorage.removeItem('ovhdState'); sysPageSet('asys_fuel');
    selectPanel('right', 'map', true);
    return o;
  });
  t.ok(q.pflt && q.pfltOut, 'LOWER AFCAU 의 P FLT TST 를 누르면 AFCS 시험이 시작되고, 끝나면 버튼이 다시 나온다');
  t.ok(q.noMaint, '시험을 마친 화면에는 AFCS MAINTENANCE MODE · NOM DEF 가 #1 · #2 모두 없다');
  t.ok(q.afcsIdle, 'AFCS — 두 레인에 OFF · SEMA1/SEMA2/TRIM OK · AFCS MAINTENANCE MODE · NOM DEF');
  t.ok(q.run && q.ap2 && q.both && q.after,
    `AFCS TEST — 두 AP 시험 시작(C · YR · P) → AP2 TEST OK → AP1 TEST OK → 처음 화면(AFCS TEST OK) (${[q.run, q.ap2, q.both, q.after].join(' · ')})`);
  t.eq(q.eng.length, 0, `Engine 화면의 글자가 다 있다${q.eng.length ? ' (없음: ' + q.eng.join(', ') + ')' : ''}`);
  t.ok(q.pcdFly && q.pcdIdle, 'Engine — PCD Position 은 TQS 레버(Fly/Idle), Anti-Ice 는 ENG ANTI ICE 스위치를 따른다');
  t.eq(q.status.length, 0, `Aircraft Status 화면의 글자가 다 있다${q.status.length ? ' (없음: ' + q.status.join(', ') + ')' : ''}`);
  t.ok(q.fireOk && q.fireTest, 'Fire Detection — FIRE DETECTOR 노브를 시험 자리로 돌리면 그 항목이 FIRE');
  t.ok(q.disch && q.pitotOff, 'Fire Extinguishing 의 ENG CMD 는 TQS T HANDLE(ARM)을, ADS Heat 는 PITOT HEAT 스위치를 따른다');

  // ── AUX 탱크 — 525 lbs 씩 · XFER AUTO/ON/OFF 로 주 탱크에 보낸다 · MTA 블리드 감소 ──
  const x = await page.evaluate(async () => {
    localStorage.removeItem('ovhdState'); ovhdReset(); fuelReset();
    const o = { aux: [fuel.auxL, fuel.auxR] };
    const keep = { run: S.running, sp: simSpeed };
    const tick = async n => { S.running = true; simSpeed = 8; _sysT = 0; sysTick(); for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 120)); sysTick(); } S.running = keep.run; simSpeed = keep.sp; };
    // AUTO — 주 탱크가 가득이면 쉬고, 100 넘게 비면 돈다
    sysTick(); o.autoFull = [auxPump[1], auxPump[2]];
    fuel.mainL -= 150; sysTick(); o.autoLow = auxPump[1] && !auxPump[2];
    const a0 = fuel.auxL, m0 = fuel.mainL; await tick(4); o.moved = [a0 - fuel.auxL, fuel.mainL - m0];
    // ON — 주 탱크가 찰 때까지 늘 · OFF — 안 보낸다
    fuelReset(); fuel.mainR -= 30; sysTick(); o.autoSmall = auxPump[2];          // 30 비었을 때 AUTO 는 아직 쉰다
    ovhdSet('aux2Xfer', 'ON'); sysTick(); o.on = auxPump[2];
    fuel.mainR -= 200; ovhdSet('aux2Xfer', 'OFF'); sysTick(); o.off = auxPump[2];
    // 화면 — EXT AUX TP1 · TP2 는 이송할 때(AUTO 가 돌리거나 ON)만 보인다
    selectPanel('right', 'sysp', true); await new Promise(r => setTimeout(r, 150)); sysPageSet('asys_fuel');
    const ring = () => { const proto = CanvasRenderingContext2D.prototype, oT = proto.fillText, oS = proto.stroke, seen = [], strokes = [];
      proto.fillText = function (t, ...a) { seen.push(String(t)); return oT.call(this, t, ...a); };
      proto.stroke = function (...a) { strokes.push(this.strokeStyle); return oS.call(this, ...a); };
      try { sysDraw(); } finally { proto.fillText = oT; proto.stroke = oS; }
      return { n: seen.filter(x => x === 'TP1' || x === 'TP2').length, green: strokes.filter(c => c === SYS_LINE).length }; };
    const r0 = ring();
    ovhdSet('aux2Xfer', 'ON'); sysTick(); const r1 = ring();
    o.tpOff = r0.n === 0; o.tpOn = r1.n === 2 && r1.green > r0.green;
    // MTA — HEATER −4 · ENG ANTI ICE 하나 −7 · 둘 −14
    ovhdReset(); const m = mtaNow();
    ovhdSet('ecsMode', 'HEAT'); o.heat = +(m - mtaNow()).toFixed(1);
    ovhdSet('engAi1', 'ON'); o.ai1 = +(m - mtaNow()).toFixed(1);
    ovhdSet('engAi2', 'ON'); o.ai2 = +(m - mtaNow()).toFixed(1);
    ovhdReset(); fuelReset(); localStorage.removeItem('ovhdState'); selectPanel('right', 'map', true);
    return o;
  });
  t.ok(x.aux.join() === '525,525', `AUX 탱크 좌우 525 lbs 씩 (${x.aux.join(' · ')})`);
  t.ok(!x.autoFull[0] && !x.autoFull[1] && x.autoLow && x.moved[0] > 0.3,   // (주 탱크는 그동안 집합 탱크도 채우므로 AUX 쪽만 본다)
    `AUX XFER AUTO — 주 탱크가 차 있으면 쉬고 100 넘게 비면 이송(${x.moved[0].toFixed(1)} lbs AUX → 주 탱크)`);
  t.ok(x.on && !x.autoSmall && !x.off, 'AUX XFER ON 은 조금만 비어도 늘 보내고, AUTO 는 쉬며, OFF 는 안 보낸다');
  t.ok(x.tpOff && x.tpOn, 'Fuel 화면 — EXT AUX TP1 · TP2 는 AUTO 에서 쉬면 안 보이고, ON(이송)이면 녹색으로 보인다');
  t.ok(x.heat === 4 && x.ai1 === 11 && x.ai2 === 18, `MTA — HEATER −4% · ENG ANTI ICE 하나 −7% · 둘 −14% (${x.heat} · ${x.ai1} · ${x.ai2})`);

  // ── NR — 엔진 상태대로: FLY 하나라도 100 · 두 엔진 IDLE 53 · 한 엔진 IDLE(다른 쪽 OFF) 47 · 둘 다 OFF 0 ──
  // ── EMERG PUMP — 엔진이 꺼져 있어도 APU + APU GEN(AC 전원)이면 #1 유압 3020psi ──
  const nh = await page.evaluate(() => {
    const nr = () => { _nrNs = null; return Math.round(engParams().nr); };
    const o = {};
    const set = (a, b) => { ovhdSet('pcd1', a); ovhdSet('pcd2', b); return nr(); };
    o.fly = set('FLY', 'OFF'); o.idle2 = set('IDLE', 'IDLE'); o.idle1 = set('IDLE', 'OFF'); o.off = set('OFF', 'OFF');
    o.hydOff = hydPsi();
    ovhdSet('emergPump', 'ON'); o.noAc = hydPsi()[1];                                // 배터리만 — AC 가 없어 펌프가 돌지 않는다
    ovhdSet('apuContr', 'ON'); _apuOnT = performance.now() - APU_START_MS - 1; ovhdSet('apuGen', 'APU GEN');
    o.emer = hydPsi(); o.ac = elecState().ac;
    ovhdSet('emergPump', 'AUTO'); o.auto = hydPsi()[1];
    ovhdSet('apuContr', 'OFF'); ovhdSet('apuGen', 'OFF'); ovhdSet('emergPump', 'AUTO');
    o.back = set('FLY', 'FLY');
    return o;
  });
  t.ok(nh.fly === 100 && nh.idle2 === 53 && nh.idle1 === 47 && nh.off === 0,
    `NR — 한 엔진 FLY ${nh.fly}% · 두 엔진 IDLE ${nh.idle2}% · 한 엔진 IDLE ${nh.idle1}% · 둘 다 OFF ${nh.off}%`);
  t.ok(nh.hydOff[1] === 0 && nh.hydOff[2] === 0 && nh.noAc === 0, '엔진이 꺼져 로터가 서면 유압 1 · 2 가 0 — EMERG PUMP 만 켜도 AC 전원이 없으면 0');
  t.ok(nh.ac && nh.emer[1] === 3020 && nh.emer[2] === 0 && nh.auto === 0,
    `APU + APU GEN(AC 전원)에서 EMERG PUMP ON → #1 유압 ${nh.emer[1]}psi(#2 는 ${nh.emer[2]}) · AUTO 로 두면 0`);
  t.ok(nh.back === 100, '두 엔진 FLY 로 되돌리면 100%');
}
