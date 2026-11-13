// AFCS 연동(23-afcs.js) — AFCAU · RCU · 전원 → PFD FMA(SAS · 깜빡이는 상자) · CAS(PFD 메시지) · 상위모드 풀림 · 하부 콘솔 전원
export const name = 'AFCS 연동';

export async function run(page, t) {
  await page.evaluate(() => { localStorage.removeItem('ovhdState'); localStorage.removeItem('c5000'); c5 = _c5Fresh(); selectPanel('right', 'lcon', true); });
  await page.waitForTimeout(300);
  const R = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    const msgs = () => pfdMsgs().map(m => m.t);
    const fma = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (x, ...a) { seen.push(String(x)); return orig.call(this, x, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen.filter(x => x === 'SAS').length;
    };
    const afcsMsgs = () => msgs().filter(m => /APM|AFCS|BOTH ON|BACKUP/.test(m));
    o.m0 = afcsMsgs(); o.s0 = fma();
    // AP1 OFF — 1 APM OFF 만(SAS 아님)
    ovhdSet('ap1', 'IN'); o.ap1 = msgs().includes('1 APM OFF') && !msgs().includes('2 APM OFF') && fma() === 0;
    // AP2 도 OFF — 세 축 SAS · 상위모드 · ASE 풀림
    if (!altHoldOn) toggleAltHold(); fcpSync('hdg'); aseOn = true;
    ovhdSet('ap2', 'IN'); afcsGuard();
    o.both = msgs().includes('2 APM OFF') && fma() === 3 && !altHoldOn && !hdgSelOn && !aseOn;
    ovhdSet('ap1', 'OUT'); ovhdSet('ap2', 'OUT'); await wait(20);
    o.back = afcsMsgs().length === 0 && fma() === 0;
    // TRIM FEEL COL REL — 컬렉티브 축만 SAS · CR.HT 풀림 · AFCS DEGRADED
    if (!crhtOn) toggleCrht();
    ovhdSet('tfCol', 'IN'); afcsGuard();
    o.col = fma() === 1 && !crhtOn && msgs().includes('AFCS DEGRADED');
    ovhdSet('tfCol', 'OUT');
    // TRIM FEEL CYC REL — 롤/요 · 피치 SAS · HDG 풀림
    fcpSync('hdg'); const hdg1 = hdgSelOn;
    ovhdSet('tfCyc', 'IN'); afcsGuard();
    o.cyc = hdg1 && fma() === 2 && !hdgSelOn;
    ovhdSet('tfCyc', 'OUT');
    // AUTO TRIM PITCH OFF — 피치 축만
    ovhdSet('atPitch', 'IN'); o.pit = fma() === 1 && msgs().includes('AFCS DEGRADED'); ovhdSet('atPitch', 'OUT');
    // RCU AHRS 1 · BACKUP
    ovhdSet('ahrsSel', '1'); o.ahrs1 = msgs().includes('BOTH ON AHRS1') && fma() === 0;
    ovhdSet('ahrsSel', 'BACKUP'); o.ahrsBk = msgs().includes('AHRS BACKUP') && fma() === 3;
    ovhdSet('ahrsSel', 'N');
    // RCU ADC 2 · BACKUP — ALT 풀림
    ovhdSet('adcSel', '2'); o.adc2 = msgs().includes('BOTH ON ADC2');
    if (!altHoldOn) toggleAltHold();
    ovhdSet('adcSel', 'BACKUP'); afcsGuard(); o.adcBk = msgs().includes('ADC BACKUP') && !altHoldOn && msgs().includes('AFCS DEGRADED');
    ovhdSet('adcSel', 'N');
    // FMA 깜빡이는 상자 — HDG 를 걸면 가운데 칸에 녹색, SAS 로 내려가면 황색
    drawPFD(); fcpSync('hdg'); drawPFD(); o.flashG = _fmaFlash[1] && _fmaFlash[1].col === '#00ff88';
    ovhdSet('atRoll', 'IN'); drawPFD(); o.flashA = _fmaFlash[1] && _fmaFlash[1].col === '#ffb000';
    ovhdSet('atRoll', 'OUT'); afcsGuard();
    // P FLT TST — 공중 · 엔진이 돌면 시험하지 않는다
    // P FLT TST — 땅 위 · 유압 정상이면 엔진이 돌든 멎었든 시험한다
    const wow0 = fuelWow, hyd0 = hydPsi;
    afcsLast = ''; fuelWow = () => false; afcsTestStart(); o.inhAir = afcsTest === null && afcsLast === 'P FLT TST INHIBITED';
    fuelWow = () => true; afcsLast = ''; afcsTestStart(); o.okRun = !!afcsTest && engParams().e1.ng > 50; afcsTest = null;
    hydPsi = () => ({ 1: 0, 2: 0 }); afcsLast = ''; afcsTestStart(); o.inhHyd = afcsTest === null && afcsLast === 'P FLT TST INHIBITED';
    hydPsi = () => ({ 1: 2960, 2: 1200 }); afcsLast = ''; afcsTestStart(); o.inhHyd2 = afcsTest === null;
    hydPsi = hyd0; fuelWow = wow0; afcsLast = '';
    // 전원 없음 — BATT · GEN 1 · 2 · APU 끔 → AFCS FAIL · FMA 꺼짐 · 무전기 · 하부 콘솔 · 승압 펌프
    ['batt', 'gen1', 'gen2', 'apuContr'].forEach(id => ovhdSet(id, 'OFF'));
    o.dc = pwrDc(); await wait(450); fuelSysTick(1, 0);
    const lcd = document.getElementById('c5-lcd');
    c5Key('4');
    o.fail = msgs()[0] === 'AFCS FAIL' && pfdMsgs()[0].c === '#ff3030' && fma() === 0;
    o.dead = lcd.classList.contains('off') && c5.page !== 'DIM' && document.getElementById('npx-lcd').classList.contains('off')
      && document.getElementById('lcon-wrap').classList.contains('lcon-nopwr') && msgs().includes('1 F/L PRES');
    ['batt', 'gen1', 'gen2'].forEach(id => ovhdSet(id, 'ON')); ovhdSet('apuContr', 'OFF');
    await wait(450); fuelSysTick(1, 0);
    o.alive = pwrDc() && !lcd.classList.contains('off') && !document.getElementById('lcon-wrap').classList.contains('lcon-nopwr') && !msgs().includes('AFCS FAIL');
    ovhdReset('lcon'); localStorage.removeItem('ovhdState');
    try { if (hdgSelOn) hdgRelease(); } catch (e) { /* */ }
    return o;
  });
  t.ok(R.m0.length === 0 && R.s0 === 0, `평소 — AFCS 메시지 없음 · SAS 없음 (${R.m0.join(',')})`);
  t.ok(R.ap1, 'AFCAU AP1 OFF — 1 APM OFF(황), 축은 그대로');
  t.ok(R.both, 'AP1 · AP2 모두 OFF — 2 APM OFF · FMA 세 칸 황색 SAS · ALT · HDG · ASE 풀림');
  t.ok(R.back, 'AP 다시 켜면 메시지 · SAS 사라짐');
  t.ok(R.col, 'TRIM FEEL COL REL — 컬렉티브 칸 SAS · CR.HT 풀림 · AFCS DEGRADED');
  t.ok(R.cyc, 'TRIM FEEL CYC REL — 롤/요 · 피치 칸 SAS · HDG 풀림');
  t.ok(R.pit, 'AUTO TRIM PITCH OFF — 피치 칸 SAS');
  t.ok(R.ahrs1 && R.ahrsBk, 'RCU AHRS 1 → BOTH ON AHRS1 · BACKUP → 세 칸 SAS · AHRS BACKUP');
  t.ok(R.adc2 && R.adcBk, 'RCU ADC 2 → BOTH ON ADC2 · BACKUP → ALT 풀림 · ADC BACKUP · AFCS DEGRADED');
  t.ok(R.flashG && R.flashA, 'FMA — 모드가 걸리면 녹색, SAS 로 내려가면 황색 귀퉁이 상자(10초)');
  t.ok(R.inhAir, 'P FLT TST — 공중이면 INHIBITED');
  t.ok(R.okRun, 'P FLT TST — 땅 위 · 유압 정상이면 엔진이 돌고 있어도 시험한다');
  t.ok(R.inhHyd && R.inhHyd2, 'P FLT TST — 유압이 0 이거나 한쪽이 정상 범위 밖이면 INHIBITED');
  t.ok(R.dc === false && R.fail && R.dead, 'DC 전원 없음 — AFCS FAIL(적) · FMA 꺼짐 · 무전기 화면 · 하부 콘솔 글씨 꺼짐 · 승압 펌프 멈춤(1 F/L PRES)');
  t.ok(R.alive, '전원이 돌아오면 다시 산다');
}
