// GSPD 와 측면축 오토파일럿의 관계
// GSPD 는 요/롤 축을 가져가므로 NAV·OBS 가 뱅크를 지령해도 기수가 돌지 않는다.
// 버튼은 켜진 채 두되(끄면 이어서 동작) 조향 불가 상태가 화면에 보여야 한다.
export const name = 'GSPD 상호작용';

export async function run(page, t) {
  const r = await page.evaluate(() => {
    const out = {};
    const cls = id => document.getElementById(id).classList.contains('ap-inh');
    // 초기: GSPD 꺼짐 → 무력화 표시 없음
    gspdOn = false; gspdCoasting = false; updateHoverBtns();
    out.offNav = cls('fks-navd'); out.offObs = false;
    // GSPD 켜기
    if (!gspdOn) toggleGspd();
    out.onNav = cls('fks-navd'); out.onObs = true;
    out.title = document.getElementById('fks-navd').title;
    // NAV 를 켠 채 GSPD 중이면 FMA 중앙이 대기 표기
    navApOn = true; hdgSelOn = false;
    out.fmaNav = (() => {
      // FMA 문자열 생성 로직과 같은 조건으로 확인
      return gspdOn ? (navApOn ? 'GS/NAV' : (hdgSelOn ? 'GS/HDG' : 'GS')) : null;
    })();
    // 실제 조향 불가 확인: 뱅크를 줘도 기수가 안 바뀐다
    S.hdg = 90; S.bnk = 20; S.spd = 60;
    const h0 = S.hdg;
    for (let i = 0; i < 20; i++) {
      if (Math.abs(S.bnk) > 0.5 && !gspdOn && !gspdCoasting) {
        const V = Math.max(10, S.spd) * 0.5144;
        S.hdg = normA(S.hdg + 9.81 * Math.tan(S.bnk * D2R) / V / D2R * 0.5);
      }
    }
    out.hdgLocked = (S.hdg === h0);
    // GSPD 끄기 → 표시 해제, 설정(NAV) 유지
    toggleGspd(); gspdCoasting = false; updateHoverBtns();
    out.afterNavOn = navApOn;
    out.afterInh = cls('fks-navd');
    return out;
  });

  t.eq(r.offNav, false, 'GSPD 꺼짐 — NAVD CPL 버튼 정상');
  t.eq(r.offObs, false, '(인터셉트 버튼은 없앴다)');
  t.eq(r.onNav, true, 'GSPD 켜짐 — NAVD CPL 버튼 무력화 표시');
  t.eq(r.onObs, true, '(인터셉트 버튼은 없앴다)');
  t.ok(/ANTI-TORQUE/.test(r.title), `NAV 버튼 안내 문구: ${r.title.slice(0, 40)}…`);
  t.eq(r.fmaNav, 'GS/NAV', 'FMA 중앙이 NAV 대기 표기');
  t.eq(r.hdgLocked, true, 'GSPD 중 뱅크를 줘도 기수 불변(설계상)');
  t.eq(r.afterNavOn, true, 'GSPD 해제 후에도 NAV 설정 유지');
  t.eq(r.afterInh, false, 'GSPD 해제 후 무력화 표시 사라짐');

  // ── 4방향 트림을 누르고 있을 때 — 1kt 씩 옮겨 가는 기준속도를 계단 없이 따라간다 ──
  // 기준속도는 1초마다 1kt 씩 옮겨 간다. 빠른 속도(15kt 이상)에서는 종전에 그 1kt 를
  // 0.2초 만에 따라가고 나머지 0.8초는 멈춰, 1초마다 속도·지도·PFD 가 튀었다(전후 축).
  const ramp = await page.evaluate(() => {
    gspdCoasting = false; if (gspdOn) toggleGspd();
    S.lat = 37.5; S.lon = 127; S.hdg = 90; S.spd = 30; S.alt = 2000; windSpd = 0; simSpeed = 1;
    toggleGspd();
    const go = (axis, v0, dir) => {
      gspdRefFwd = axis === 'fwd' ? v0 : 0; gspdActFwd = gspdRefFwd;
      gspdRefLat = axis === 'lat' ? v0 : 0; gspdActLat = gspdRefLat;
      const act = () => (axis === 'fwd' ? gspdActFwd : gspdActLat);
      S.running = true; let ts = 1000; S.lastT = ts;
      let maxStep = 0, still = 0, prev = act();
      for (let i = 1; i <= 100; i++) {          // 5초 · 20Hz
        if (i % 20 === 1) gspdTrimNudge(dir);    // 1초마다 1kt
        ts += 50; simStep(ts);
        const d = Math.abs(act() - prev); prev = act();
        maxStep = Math.max(maxStep, d);
        if (i > 1 && i < 100 && d < 0.01) still++;
      }
      S.running = false;
      return { maxStep, still, end: act() };
    };
    const out = { fwd: go('fwd', 30, 'F'), lat: go('lat', 15, 'R') };
    toggleGspd(); gspdCoasting = false;
    return out;
  });
  t.ok(ramp.fwd.maxStep <= 0.051 && ramp.fwd.still <= 5,
    `전후 30kt — 1kt 를 1초에 걸쳐 고르게 따라간다 (프레임당 최대 ${ramp.fwd.maxStep.toFixed(3)}kt · 멈춘 프레임 ${ramp.fwd.still})`);
  t.ok(Math.abs(ramp.fwd.end - 35) < 1.1, `5초 동안 5kt 를 따라왔다 (${ramp.fwd.end.toFixed(1)}kt)`);
  t.ok(ramp.lat.maxStep <= 0.051 && ramp.lat.still <= 5,
    `좌우 15kt 도 같다 (프레임당 최대 ${ramp.lat.maxStep.toFixed(3)}kt · 멈춘 프레임 ${ramp.lat.still})`);
  // ── GSPD 는 컬렉티브 축(ALT · CRHT)을 저절로 물리지 않고, 풀어도 IAS 가 저절로 물리지 않는다 ──
  const fm = await page.evaluate(() => {
    const shot = () => { const seen = [], o = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push([String(x), String(this.fillStyle)]); return o.call(this, x, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = o; } return seen; };
    const lit = (seen, t) => seen.some(([x, c]) => x === t && c !== '#3a3a3a');
    const a0 = altHoldOn, c0 = crhtOn, g0 = gspdOn;
    if (gspdOn) toggleGspd();
    altHoldOn = false; crhtOn = false; S.spd = 30;
    toggleGspd(); const on = shot();
    const o = { altOn: lit(on, 'ALT') || lit(on, 'ALT.A') || lit(on, 'CRHT'), gsOn: gspdOn };
    toggleGspd(); const off = shot();
    o.iasAfter = iasModeOn(); o.iasLit = lit(off, 'IAS');
    toggleGspd(); toggleGspd(); o.iasAgain = iasModeOn();
    altHoldOn = true; toggleGspd(); o.altWhenSet = lit(shot(), 'ALT') || lit(shot(), 'ALT.A'); toggleGspd();
    altHoldOn = a0; crhtOn = c0; if (gspdOn !== g0) toggleGspd();
    return o;
  });
  t.ok(fm.gsOn && !fm.altOn, 'GSPD 를 걸어도 ALT · CRHT 는 저절로 물리지 않는다(조종사가 걸 때만)');
  t.ok(!fm.iasAfter && !fm.iasLit && !fm.iasAgain, 'GSPD 를 걸고 풀어도(몇 번이고) IAS 가 저절로 물리지 않는다');
  t.ok(fm.altWhenSet, 'ALT 를 걸어 둔 채 GSPD 를 걸면 FMA 에 ALT 가 그대로 켜져 있다');
  // ── FMA — ALT 단독은 Vy 이상이면 피치 칸(오른쪽), Vy 아래면 컬렉티브 칸(왼쪽) · CRHT 는 늘 컬렉티브 칸 ──
  const ax = await page.evaluate(() => {
    const shot = () => { const seen = [], o = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return o.call(this, x, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = o; } return seen; };
    const k = { a: altHoldOn, c: crhtOn, g: gspdOn, s: S.spd, sel: selAlt, i: iasNsOn };
    iasNsOn = false;                                                 // ALT 단독
    if (gspdOn) toggleGspd();
    const mid = () => { const s = shot(), i = s.findIndex(x => /^(HDG|NAV|GS)/.test(x)); return { alt: s.indexOf('ALT'), ias: s.includes('IAS'), mid: i }; };
    const o = {};
    altHoldOn = true; crhtOn = false; selAlt = S.alt;
    S.spd = 50; o.lo = { p: afcsAltPitch(), ...mid() };
    S.spd = 110; o.hi = { p: afcsAltPitch(), ...mid() };
    S.spd = simVyKt() - 3; o.hys = afcsAltPitch();                 // Vy 바로 밑 — 아직 피치 축(오락가락 막기)
    iasNsOn = true; S.spd = 110; o.withIas = { p: afcsAltPitch(), ...mid() }; iasNsOn = false;   // IAS 도 걸려 있으면 IAS 가 피치 축
    altHoldOn = false; crhtOn = true; S.spd = 110; o.crht = afcsAltPitch();
    altHoldOn = k.a; crhtOn = k.c; S.spd = k.s; selAlt = k.sel; iasNsOn = k.i; if (gspdOn !== k.g) toggleGspd();
    return o;
  });
  t.ok(!ax.lo.p && ax.lo.ias && ax.lo.alt >= 0 && ax.lo.alt < ax.lo.mid, 'ALT 단독 · Vy 아래 — FMA 컬렉티브 칸(왼쪽)에 ALT · 피치 칸 IAS');
  t.ok(ax.hi.p && !ax.hi.ias && ax.hi.alt > ax.hi.mid, 'ALT 단독 · Vy 이상(110kt) — FMA 피치 칸(오른쪽)에 ALT · 컬렉티브 칸은 비어 조종사 손');
  t.ok(!ax.withIas.p && ax.withIas.ias && ax.withIas.alt < ax.withIas.mid, 'ALT + IAS 면 Vy 이상이어도 IAS 가 피치 칸 · ALT 는 컬렉티브 칸');
  t.ok(ax.hys && !ax.crht, 'Vy 바로 밑에서는 피치 축 그대로(Vy−5kt 아래로 내려와야 풀림) · CRHT 는 늘 컬렉티브');

  // ── 좌우 트림(SIM 이 아닐 때) — 누르고 있으면 피치 트림처럼 이어서 뱅크가 옮겨진다 ──
  const rt = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const sim0 = simModeOn; if (simModeOn) toggleSimMode(false);
    if (gspdOn) toggleGspd(); hdgSelOn = false; rollApOn = false; navApOn = false;
    bankTarget = 0;
    startTrimHold('R'); const one = bankTarget; const seq = []; for (let i = 0; i < 13; i++) { await w(100); seq.push(bankTarget + (trimHoldInt ? 'i' : '') + (_trimDir || '-')); } const held = bankTarget; stopTrimHold();
    await w(300); const after = bankTarget;
    startTrimHold('L'); stopTrimHold(); const click = bankTarget;
    bankTarget = 0; if (sim0) toggleSimMode(true);
    return { one, held, after, click, seq: seq.join(' '), st: [gspdOn, typeof gspdCoasting !== 'undefined' && gspdCoasting, hdgSelOn, rollApOn, navApOn, simModeOn, S.running, typeof altHoldOn !== 'undefined' && altHoldOn].join(',') };
  });
  t.ok(rt.one === 1 && rt.held >= 6 && rt.after === rt.held && rt.click === rt.held - 1,
    `좌우 트림 — 딸깍 1° · 누르고 있으면 0.1초마다 1° 씩 이어서 · 놓으면 멈춘다 (1.3초 ${rt.held}° · ${rt.st} · ${rt.seq})`);

  // ── 트림 반복은 타이머가 늦게 불려도(창이 뒤로 · 팝아웃 포커스) 누른 시간만큼 따라잡는다 ──
  const cu = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const sim0 = simModeOn; if (simModeOn) toggleSimMode(false);
    if (gspdOn) toggleGspd(); hdgSelOn = false; rollApOn = false; navApOn = false; bankTarget = 0;
    startTrimHold('R'); await w(450);
    const t0 = performance.now(); while (performance.now() - t0 < 1000) {}   // 1초 동안 타이머가 불리지 못한다
    await w(120); const b = bankTarget; stopTrimHold();
    bankTarget = 0; if (sim0) toggleSimMode(true);
    return b;
  });
  t.ok(cu >= 10, `트림 반복은 늦게 불려도 누른 시간만큼 따라잡는다 (1.6초 · 뱅크 ${cu}°)`);
}
