// 기종 CN-235(js/42-cn235.js) — 고정익(쌍발 터보프롭): 호버 없음 · 날개 양력 · 프로펠러 추력 · 실속 · 이륙 활주 ·
// 플랩 · 착륙장치 · Collins EFIS 계기판 · 페데스탈 · 3D 모형(해양경찰 도색)
export const name = 'CN-235';

export async function run(page, t) {
  const u = new URL(page.url()); u.searchParams.set('ac', 'cn235');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof fwFly === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const A = await page.evaluate(() => ({
    ac: AC_TYPE, fixed: acFixedWing(), name: acInfo().name, eng: acInfo().engines, cls: document.documentElement.classList.contains('ac-cn235'),
    gate: [...document.querySelectorAll('.gate-ac-btn')].map(b => b.dataset.ac).join(','), noOvhd: !acScrOk('ovhd') && !acScrOk('sysp') && acScrOk('cdu'),
    vs0: cnVs(1, 0), vs23: cnVs(1, 23), as: cnAlphaStall(),
  }));
  t.ok(A.ac === 'cn235' && A.fixed && A.name === 'CN-235' && A.eng === 2 && A.cls, `?ac=cn235 — 고정익 CN-235(쌍발) (${A.ac})`);
  t.ok(/cn235/.test(A.gate) && A.noOvhd, `시작 화면에 CN-235 · 흰수리 상부 콘솔 · SYSTEM 은 없고 CDU 는 있다 (${A.gate})`);
  t.ok(A.vs0 > 90 && A.vs0 < 105 && A.vs23 > 75 && A.vs23 < 88 && A.as > 12 && A.as < 17, `실속 속도 — 깨끗 ${A.vs0.toFixed(0)}kt · 플랩 23 ${A.vs23.toFixed(0)}kt · 실속각 ${A.as.toFixed(1)}°`);

  // 호버 화면 · GSPD 는 없다 · SIM 밖 — 공중에서는 최소 속도 아래로 가지 않는다
  const K = await page.evaluate(() => {
    toggleGspd(); const g = gspdOn; toggleHoverPage(); const hp = typeof hoverPageOn !== 'undefined' && hoverPageOn;
    S.alt = 3000; S.spd = 40; S.vs = 0; S.bnk = 0;
    let T = performance.now(); S.lastT = T; if (!S.running) toggleSim(); S.lastT = T;
    for (let i = 0; i < 40; i++) { T += 50; simStep(T, true); }
    return { g, hp, spd: S.spd, vmin: cnVmin(), pit: S.pit, tq: S.tq };
  });
  t.ok(!K.g && !K.hp, '고정익에는 GSPD · HOVER 화면이 없다(눌러도 켜지지 않는다)');
  t.ok(K.spd >= K.vmin && K.vmin > 105 && K.pit > 3 && K.tq > 10, `SIM 밖 — 공중 최소 속도 ${K.vmin}kt(실속 × 1.2) · 자세 ${K.pit.toFixed(1)}° · 토크 ${Math.round(K.tq)}%`);

  // SIM — 수평 비행 · 최대 출력 상승 · 실속
  const F = await page.evaluate(() => {
    const step = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); fwFly(0.05); S.alt = Math.max(0, S.alt + S.vs / 60 * 0.05); } };
    S.alt = 4000; S.spd = 170; S.vs = 0; S.bnk = 0; cn.gearDn = false; cn.gearPos = 0; cn.flapSel = 0; cn.flap = 0;
    toggleSimMode(true, { ground: false });
    step(600);
    const lvl = { spd: S.spd, vs: S.vs, tq: S.tq };
    step(1200, () => { cn.pl = 1; });
    const clb = { spd: S.spd, vs: S.vs, tq: S.tq };
    // 아이들 · 고도를 지키려 조금씩 당긴다 — 속도가 줄며 받음각이 커져 실속 경고 · 실속
    let warnSpd = null, stallSpd = null;
    step(2400, () => { cn.pl = 0; simTrim.pitch = -(cnAlphaFor(S.spd) + 1.5 - cn.trimA) / 0.5; if (cn.stallWarn && warnSpd === null) warnSpd = S.spd; if (cn.stall && stallSpd === null) stallSpd = S.spd; });
    simTrim.pitch = 0;
    toggleSimMode(false);
    return { lvl, clb, warnSpd, stallSpd };
  });
  t.ok(Math.abs(F.lvl.spd - 170) < 4 && Math.abs(F.lvl.vs) < 150 && F.lvl.tq > 25 && F.lvl.tq < 75, `SIM 수평 비행 — ${F.lvl.spd.toFixed(0)}kt · ${Math.round(F.lvl.vs)}fpm · 토크 ${Math.round(F.lvl.tq)}%`);
  t.ok(F.clb.vs > 1300 && F.clb.tq > 90, `최대 출력 — 상승 ${Math.round(F.clb.vs)}fpm(${F.clb.spd.toFixed(0)}kt · 토크 ${Math.round(F.clb.tq)}%)`);
  t.ok(F.warnSpd !== null && F.stallSpd !== null && F.warnSpd >= F.stallSpd && F.stallSpd < 125, `실속 — 경고 ${F.warnSpd && F.warnSpd.toFixed(0)}kt → 실속 ${F.stallSpd && F.stallSpd.toFixed(0)}kt`);

  // 땅 — 파킹 브레이크면 서 있다 · 풀고 최대 출력 · VR 에서 당기면 뜬다(플랩 10)
  const TO = await page.evaluate(() => {
    S.alt = 0; S.spd = 0; S.vs = 0;
    toggleSimMode(true, { ground: true });
    const up0 = cn.gearDn; cnGearSet(false); const wow = cn.gearDn === true && up0;
    cnFlapSet(10); cn.flap = 10; simParkBrake = true;
    for (let i = 0; i < 100; i++) { cn.pl = 1; fwFly(0.05); }
    const parked = S.spd;
    simParkBrake = false;
    let t = 0, d = 0, lift = null;
    for (let i = 0; i < 1600 && !lift; i++) {
      cn.pl = 1; if (S.spd > 92) simTrim.pitch = -24;
      fwFly(0.05); S.alt = Math.max(0, S.alt + S.vs / 60 * 0.05); t += 0.05; d += S.spd * 0.5144 * 0.05;
      if (!cn.onGnd && S.alt > 1) lift = { t, d, spd: S.spd };
    }
    // 착륙장치 — 올리면 8초에 걸쳐 올라간다
    cnGearSet(false); for (let i = 0; i < 80; i++) fwFly(0.05); const mid = cn.gearPos;
    for (let i = 0; i < 120; i++) fwFly(0.05); const up = cn.gearPos;
    simTrim.pitch = 0; toggleSimMode(false);
    return { wow, parked, lift, mid, up };
  });
  t.ok(TO.wow && TO.parked < 0.5, `땅 위 — 착륙장치는 올라가지 않고(WOW) · 파킹 브레이크면 최대 출력에도 서 있다 (${TO.parked.toFixed(1)}kt)`);
  t.ok(TO.lift && TO.lift.spd > 92 && TO.lift.spd < 112 && TO.lift.d < 900, `이륙 — ${TO.lift && TO.lift.spd.toFixed(0)}kt 에서 뜬다(활주 ${TO.lift && Math.round(TO.lift.d)}m · ${TO.lift && TO.lift.t.toFixed(0)}초)`);
  t.ok(TO.mid > 0.3 && TO.mid < 0.8 && TO.up < 0.01, `착륙장치 — 8초에 걸쳐 올라간다(4초 ${TO.mid.toFixed(2)} → ${TO.up.toFixed(2)})`);

  // 계기판(AOM 그림 1-1-8 · 1-1-9) — PFD 창에 판 · 쪽(LH · CTR · GLARE · ALL) · 페데스탈(그림 1-1-10)
  const P = await page.evaluate(() => {
    let n = 0; const o0 = cnDraw; cnDraw = function (...a) { n++; return o0.apply(this, a); };
    try { drawPFD(); } finally { cnDraw = o0; }
    const px = (pg, w, h, x, y) => { const c = document.createElement('canvas'); c.width = w; c.height = h; cnDrawTo(c, pg); return { d: Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3)), hits: c._cnHit.hits.length }; };
    const lh = px('LH', 1000, 640, 488, 200), ctr = px('CTR', 1000, 660, 146, 80), glr = px('GLR', 2000, 260, 140, 40), all = px('ALL', 2000, 920, 10, 10);
    cnPedToggle(true); const cv = document.querySelector('#cn-ped canvas'); const shown = getComputedStyle(document.getElementById('cn-ped')).display === 'flex';
    const H = cv._cnPedHits || [];
    const flapHit = H.find(h => h.fn && h.y > 490 && h.y < 500 && h.x > 560); if (flapHit) flapHit.fn(0, 0);       // APPR(15)
    const pl = H.find(h => h.drag && h.x < 200 && h.w > 150); if (pl) pl.drag(250, 300);                          // 파워 MAX
    const cond = H.find(h => h.drag && h.x > 380 && h.x < 400); if (cond) cond.drag(416, 428);                     // 왼쪽 MIN RPM
    const r = { n, lh, ctr, glr, all, shown, peds: H.length, flap: cn.flapSel, pl: cn.pl, cond: cn.cond[0] };
    cnPedToggle(false); cnFlapSet(0); cnCondSet(2, 'MAX'); cn.pl = 0.4;
    return r;
  });
  t.ok(P.n >= 1 && P.lh.d[2] > 150 && P.lh.d[0] < 120 && P.lh.hits >= 5 && P.ctr.hits >= 2 && P.glr.hits >= 14, `계기판 — PFD 창에 CN-235 판 · LH(Universal PFD 하늘 ${P.lh.d}) · 가운데 · 글레어실드(누를 자리 LH ${P.lh.hits} · CTR ${P.ctr.hits} · GLR ${P.glr.hits} · 그림 ${P.n})`);
  t.ok(P.shown && P.peds >= 20 && P.flap === 15 && P.pl > 0.95 && P.cond === 'MIN', `페데스탈 — 플랩 레버 APPR · 파워 레버 MAX · 컨디션 레버 MIN RPM(누를 자리 ${P.peds})`);

  // 오토파일럿(글레어실드 C · D) · 조종간 AP · GA · 한 엔진 — 방향타 트림 · GUST LOCK · 속도 한계(AOM)
  const AP = await page.evaluate(() => {
    const step = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); fwFly(0.05); S.alt = Math.max(0, S.alt + S.vs / 60 * 0.05); } };
    S.alt = 5000; S.spd = 180; S.vs = 0; S.bnk = 0; toggleSimMode(true, { ground: false });
    cn.ap = true; cnApMode('ALT'); const alt = altHoldOn; step(200); const altKeep = Math.abs(S.alt - selAlt);
    cnApMode('VS'); const vs = vsModeOn && !altHoldOn;
    cnYokePress('ap', true); cnYokePress('ap', false); const disc = !cn.ap && cn.apWarn > 0 && !simAfcsLat();
    cnFlapSet(23); cn.flap = 23; cnGa(); const ga = cn.ga && cn.flapSel === 15 && !cn.ap;
    cn.ga = false; cnApEng(); const eng = cn.ap;
    // 오른쪽 엔진 끔 — 기수가 오른쪽(죽은 엔진 쪽)으로 돈다 · 방향타 트림으로 잡는다
    afcsReleaseAll(); cn.ap = false; cn.pl = 1; cnCondSet(1, 'OFF');
    const h0 = S.hdg; step(100, () => { cn.pl = 1; }); const yaw = normAS(S.hdg - h0);
    cn.rudTrim = Math.max(-1, Math.min(1, -yaw / 5 / 3)); const h1 = S.hdg; step(100, () => { cn.pl = 1; }); const yaw2 = normAS(S.hdg - h1);
    cnCondSet(2, 'MAX'); cn.rudTrim = 0; cn.eng.forEach(e => { e.run = true; e.ng = 87; e.np = 100; });   // 연료를 끊었던 엔진은 시동해야 돈다 — 검사라 바로 돌려 둔다
    toggleSimMode(false);
    // GUST LOCK — 땅에서 파워가 FLT IDLE 조금 위까지만
    S.alt = 0; S.spd = 0; toggleSimMode(true, { ground: true }); cn.gust = true; cn.pl = 1; step(10, () => { cn.pl = 1; }); const gust = cn.pl <= 0.12; cn.gust = false; toggleSimMode(false);
    return { alt, altKeep, vs, disc, ga, eng, yaw, yaw2, gust, vmo: [cnVmo(0), cnVmo(20000), cnVmo(25000)], vle: CN_P.vle, vfe: CN_P.vfe[23] };
  });
  t.ok(AP.alt && AP.altKeep < 60 && AP.vs, `글레어실드 AP 모드 — ALT 가 고도를 지킨다(${Math.round(AP.altKeep)}ft) · VS 로 바뀐다`);
  t.ok(AP.disc && AP.ga && AP.eng, '조종간 — AP 단추로 끊기(AUTO PILOT 경고) · GA(플랩 LNDG → APPR · AP 끊김) · AP ENG 다시 걸기');
  t.ok(AP.yaw > 3 && Math.abs(AP.yaw2) < AP.yaw * 0.5, `한 엔진 — 죽은 쪽으로 ${AP.yaw.toFixed(1)}° 돈다 · 방향타 트림으로 ${AP.yaw2.toFixed(1)}°`);
  t.ok(AP.gust && AP.vmo[0] === 230 && AP.vmo[1] === 200 && AP.vmo[2] === 180 && AP.vle === 150 && AP.vfe === 160, `GUST LOCK · AOM 속도 한계 VMO ${AP.vmo.join('/')} · VLE ${AP.vle} · VFE ${AP.vfe}`);

  // 3D 모형 — 길이 21.4m · 날개폭 25.8m · 높이 8.18m · 프로펠러 둘
  const M = await page.evaluate(() => {
    const b = _h3BuildBody('cn235');
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < b.length; i += 10) { x0 = Math.min(x0, b[i]); x1 = Math.max(x1, b[i]); y0 = Math.min(y0, b[i + 1]); y1 = Math.max(y1, b[i + 1]); z1 = Math.max(z1, b[i + 2]); }
    const g = _h3BuildGearCN235(), p = _h3BuildProp(H3_SPECS.cn235);
    return { own: H3_OWN, len: x1 - x0, span: y1 - y0, top: z1, gear: g.length > 0, prop: p.length > 0, props: H3_SPECS.cn235.props.length, liv: b.some((v, i) => i % 10 === 9 && v === 4), acLen: SIM_AC_LEN };
  });
  t.ok(M.own === 'cn235' && Math.abs(M.len - 21.4) < 0.1 && Math.abs(M.span - 25.8) < 0.3 && Math.abs(M.top - 8.18) < 0.05,
       `3D 모형 — 길이 ${M.len.toFixed(2)}m · 날개폭 ${M.span.toFixed(2)}m · 높이 ${M.top.toFixed(2)}m`);
  t.ok(M.gear && M.prop && M.props === 2 && M.liv && M.acLen === 22, '프로펠러 둘 · 착륙장치(따로) · 해양경찰 도색 · 착함 판정 길이 22m');
  // 계통(오버헤드 · 회로차단기 · 콘솔) · AOM 성능 한계
  const SY = await page.evaluate(() => {
    const step = (n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); fwFly(0.05); S.alt = Math.max(0, S.alt + S.vs / 60 * 0.05); } };
    const r = {};
    S.alt = 20000; S.spd = 170; S.vs = 0; cn.ap = false; toggleSimMode(true, { ground: false });
    step(1600);                                                    // 80초 — 객실 고도가 자리 잡는다(분당 500ft)
    r.cab = cn.cabAlt; cn.ov.dump = true; step(200); r.cabDump = cn.cabAlt; cn.ov.dump = false;
    // 연료 SHUT-OFF VALVE — 닫으면 그 엔진이 멎고, 열고 START 면 다시 돈다
    cn.ov.sovL = false; step(40); r.sovStop = !cn.eng[0].run;
    { const a0 = S.alt; S.alt = 2000; step(200, () => { cn.pl = 1; S.alt = 2000; }); r.aprAvail = cn.eng[1].tq; S.alt = a0; cn.pl = 0.5; }   // APR — 남은 엔진이 107% 까지
    cn.ov.sovL = true; cnStart(0); step(900); r.restart = cn.eng[0].run && cn.eng[0].ng > 60;
    // 유압 펌프 둘을 끄면 플랩이 움직이지 않는다 · 비상 내림은 된다
    cn.ov.hyd1 = false; cn.ov.hyd2 = false; cn.gearDn = false; cn.gearPos = 0; cn.flapSel = 15; cn.flap = 0; step(60); r.flapStuck = cn.flap < 0.1;
    cn.gearDn = true; cn.gearEmer = true; step(200); r.emerGear = cn.gearPos > 0.99; cn.ov.hyd1 = true; cn.ov.hyd2 = true; cn.gearEmer = false; cnFlapSet(0); step(200);
    // 회로차단기 PFD · 전원 — EFIS 가 꺼지고 AP 가 풀린다
    cn.cb.PFD = true; r.pfdDark = !cnEfisOk('PFD'); delete cn.cb.PFD;
    cn.ap = true; cn.ov.bat = false; cn.ov.gen1 = false; cn.ov.gen2 = false; step(2); r.elecOff = !cnElecOn() && !cn.ap && !cnEfisOk('MFD/ND');
    cn.ov.bat = true; cn.ov.gen1 = true; cn.ov.gen2 = true;
    // 결빙 — WING & TAIL 을 끄면 날개 착빙 · 실속 속도가 오른다
    const vs0 = cnVs(1); envIce.cond = true; cn.ov.wingTail = false; step(1200); r.ice = cn.ice; r.vsIce = cnVs(1) - vs0;
    cn.ov.wingTail = true; step(1200); r.iceOff = cn.ice; envIce.cond = false;
    toggleSimMode(false);
    // 역추력 — 120KIAS 위에서는 들지 않는다 · 땅
    S.alt = 0; S.spd = 130; toggleSimMode(true, { ground: true }); S.spd = 130; cn.pl = -0.3; fwFly(0.05); r.revInhibit = cn.pl >= 0; toggleSimMode(false);
    // 무게 · 무게중심 · 3D 등
    r.lim = [CNS.mtow, CNS.mlw, CNS.mzfw, CNS.ramp, CNS.mainKg, CNS.auxKg, CNS.vTire, CNS.vRev];
    r.cg = cnCgPct(); r.fuel = cn.fuelKg; cn.fuelKg = 9999; r.fuelMax = Math.round(cn.fuelKg); cn.fuelKg = 2838;
    cn.ov.nav = true; r.lights = cnLightState(0.05).pts.length;
    const hits = p => { const c = document.createElement('canvas'); c.width = 1400; c.height = 800; cnDrawTo(c, p); return c._cnHit.hits.length; };
    r.hits = { OVHD: hits('OVHD'), CB: hits('CB'), CONS: hits('CONS'), PERF: hits('PERF') };
    return r;
  });
  t.ok(SY.cab > 6000 && SY.cab < 10000 && SY.cabDump > SY.cab + 300, `여압 — 20,000ft 에서 객실 ${Math.round(SY.cab)}ft(차압 3.6psi) · PRESS DUMP 면 ${Math.round(SY.cabDump)}ft 로 오른다`);
  t.ok(SY.sovStop && SY.aprAvail > 100 && SY.restart, `연료 SHUT-OFF VALVE 닫으면 엔진 멎음 · APR 남은 엔진 ${Math.round(SY.aprAvail)}% · 열고 START 하면 다시 돈다`);
  t.ok(SY.flapStuck && SY.emerGear, '유압 펌프 둘 꺼짐 — 플랩이 움직이지 않고 · 착륙장치 비상 내림은 된다');
  t.ok(SY.pfdDark && SY.elecOff, '회로차단기 PFD 뽑으면 PFD 꺼짐 · 전원(BAT · GEN) 없으면 EFIS 꺼지고 AP 풀림');
  t.ok(SY.ice > 0.3 && SY.vsIce > 2 && SY.iceOff < SY.ice, `결빙 — WING & TAIL 꺼짐이면 날개 착빙 ${Math.round(SY.ice * 100)}% · 실속 속도 +${SY.vsIce.toFixed(1)}kt · 켜면 떨어진다`);
  t.ok(SY.revInhibit && SY.lim.join() === '14400,14200,13600,14450,819,1276,139,120' && SY.fuelMax === 4190 && SY.cg > 16 && SY.cg < 30 && SY.lights >= 3,
       `AOM 한계 — MTOW 14,400 · MLW 14,200 · MZFW 13,600 · 램프 14,450 · 연료 4,190kg · CG ${SY.cg.toFixed(1)}%MAC · 역추력 120KIAS · NAV 등`);
  t.ok(SY.hits.OVHD >= 60 && SY.hits.CB >= 100 && SY.hits.CONS >= 20 && SY.hits.PERF >= 10, `오버헤드 · 회로차단기 · 콘솔 · W&B 화면(누를 자리 ${JSON.stringify(SY.hits)})`);
  t.ok(page.errors.length === 0, `오류 없음${page.errors.length ? ' — ' + page.errors.join(' / ') : ''}`);
}
