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

  // 계기판 — PFD 창에 CN-235 판(EADI · EHSI · 엔진 계기) · 페데스탈
  const P = await page.evaluate(() => {
    let n = 0; const o0 = cnDraw; cnDraw = function (...a) { n++; return o0.apply(this, a); };
    try { drawPFD(); } finally { cnDraw = o0; }
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600; cnDrawTo(c);
    const g = c.getContext('2d'), sky = g.getImageData(180, 60, 1, 1).data, ped = g.getImageData(900, 568, 1, 1).data;
    cnPedToggle(true); const pd = document.getElementById('cn-ped'); const shown = getComputedStyle(pd).display === 'flex';
    pd.querySelector('[data-cnp="flap"][data-v="15"]').click(); const flap = cn.flapSel;
    pd.querySelector('[data-cnp="cond"][data-i="0"][data-v="MIN"]').click(); const cond = cn.cond[0];
    cnPedToggle(false); cnFlapSet(0); cnCondSet(2, 'MAX');
    return { n, sky: Array.from(sky), ped: Array.from(ped), shown, flap, cond };
  });
  t.ok(P.n >= 1 && P.sky[2] > 150 && P.sky[0] < 120, `PFD 창에 CN-235 계기판 — EADI 하늘(파랑) (${P.sky.slice(0, 3)})`);
  t.ok(P.shown && P.flap === 15 && P.cond === 'MIN', '페데스탈 — 플랩 레버 · 컨디션 레버가 듣는다');

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
  t.ok(page.errors.length === 0, `오류 없음${page.errors.length ? ' — ' + page.errors.join(' / ') : ''}`);
}
