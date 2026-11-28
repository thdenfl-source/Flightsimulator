// 훈련 보강 5 — IIMC 연습 · 회복 판정 · 연료 계획 · BINGO · 무선 교신 연습(표준 문구 · MAYDAY 형식 점검)
export const name = '훈련 보강 5';

export async function run(page, t) {
  // ── IIMC — 구름 속으로 · 잘 회복하면 높은 점수 · 지면 근접이면 실패 ──
  const I = await page.evaluate(async () => {
    const o = {}, keep = { vis: env.vis, ceil: env.ceil, rain: env.rain };
    S.alt = 1200; S.bnk = 25; S.pit = 0; S.spd = 90; S.vs = 0;
    const ra0 = window.radarAltFt; window.radarAltFt = () => S.alt;
    o.start = iimcStart(); o.env = { vis: env.vis, ceil: env.ceil }; o.safe = iimc.safeAlt;
    // 2초에 수평 · 4초에 상승 · 안전고도까지
    for (let i = 0; i < 400 && iimc.on; i++) {
      if (iimc.t > 2) S.bnk = 3; if (iimc.t > 4) { S.vs = 1000; S.pit = 5; S.alt += 1000 / 60 * 0.5; }
      iimcStep(0.5);
    }
    o.good = iimc.res; o.wrap = getComputedStyle(document.getElementById('iimc-wrap')).display === 'flex';
    o.txt = document.getElementById('iimc-wrap').textContent;
    document.querySelector('#iimc-wrap [data-iimc="env"]').click(); o.restored = env.vis === keep.vis && env.ceil === keep.ceil;
    // 나쁜 회복 — 기울인 채 내려간다
    S.alt = 1200; S.bnk = 35; S.vs = -800; S.pit = -8; iimcStart();
    for (let i = 0; i < 400 && iimc.on; i++) { S.alt -= 800 / 60 * 0.5; iimcStep(0.5); }
    o.bad = iimc.res; iimcRestoreEnv(); document.getElementById('iimc-wrap').style.display = 'none';
    window.radarAltFt = ra0; S.bnk = 0; S.pit = 0; S.vs = 0;
    // ENV · IOS 단추
    toggleEnvPanel(); o.envBtn = !!document.querySelector('#env-wrap [data-envx="iimc"]'); toggleEnvPanel();
    return o;
  });
  t.ok(I.start && I.env.vis === 0.4 && I.env.ceil > 0 && I.env.ceil < 1200 && I.safe === I.env.ceil + 1600, `IIMC — 시정 400m · 구름 밑면 ${I.env.ceil}ft(발밑) · 안전고도 ${I.safe}ft(구름 위)`);
  t.ok(I.good && !I.good.fail && I.good.score >= 85 && I.good.grade === '우수' && I.wrap && /회복 판정/.test(I.txt),
    `잘 회복 — 2초 수평 · 4초 상승 · 안전고도 → ${I.good && I.good.score}점 ${I.good && I.good.grade} · 결과 창`);
  t.ok(I.restored, '결과 창 — 환경 되돌리기(시정 · 구름)');
  t.ok(I.bad && /지면 근접/.test(I.bad.fail) && I.bad.grade === '불만족' && I.bad.score === 0, `나쁜 회복(기운 채 강하) — ${I.bad && I.bad.fail} · ${I.bad && I.bad.grade}`);
  t.ok(I.envBtn, 'ENV 창에 ⚠ IIMC 단추');

  // ── BINGO ──
  const B = await page.evaluate(() => {
    const o = {}, keep = JSON.stringify(bingoCfg), lat0 = S.lat, lon0 = S.lon, ws0 = windSpd, wd0 = windDir;
    const ft = window.fuelTotal, ff = window.fuelFlow, sp = window.speak, toasts = [];
    const ut = window.uiToast; window.uiToast = (m, k) => toasts.push([m, k]);
    let spoke = ''; window.speak = x => { spoke = x; return true; };
    bingoCfg.home = 'pt'; bingoCfg.ptLat = 35.0; bingoCfg.ptLon = 129.0; bingoCfg.resMin = 20; bingoCfg.on = true;
    S.lat = 35.5; S.lon = 129.0; windSpd = 0;                // 30NM 북쪽
    window.fuelFlow = () => ({ f1: 495, f2: 495 });
    window.fuelTotal = () => 2000;
    const A = bingoCalc(); o.A = { dist: A.dist, ret: A.ret, res: A.res, bingo: A.bingo, margin: A.margin };
    windDir = 180; windSpd = 30; const H = bingoCalc(); o.head = H.head; o.retHead = H.ret;  // 기지는 남쪽 — 남풍(180°에서 불어옴)이 맞바람
    windSpd = 0;
    const run0 = S.running; S.running = true; bingoSt.lvl = 0;
    window.fuelTotal = () => A.bingo + 100; bingoStep(); o.lv1 = bingoSt.lvl;
    window.fuelTotal = () => A.bingo - 10; bingoStep(); o.lv2 = bingoSt.lvl; o.spoke = spoke; o.toasts = toasts.map(x => x[0]).join(' | ');
    S.running = run0;
    toggleBingo(); o.panel = /BINGO/.test(document.getElementById('bingo-wrap').textContent); toggleBingo();
    o.tool = TOOLS.some(([, f]) => f === 'toggleBingo') && TOOLS.some(([, f]) => f === 'toggleRadioPractice');
    window.fuelTotal = ft; window.fuelFlow = ff; window.speak = sp; window.uiToast = ut;
    Object.assign(bingoCfg, JSON.parse(keep)); bingoSt.lvl = 0; S.lat = lat0; S.lon = lon0; windSpd = ws0; windDir = wd0;
    return o;
  });
  t.ok(Math.abs(B.A.dist - 30) < 0.5 && Math.abs(B.A.ret - 30 / 120 * 990) < 5 && Math.abs(B.A.res - 330) < 1 && Math.abs(B.A.bingo - B.A.ret - B.A.res) < 1e-6,
    `BINGO — 30NM · 120kt · 990pph → 귀환 ${B.A.ret.toFixed(0)} + 예비 20분 ${B.A.res.toFixed(0)} = ${B.A.bingo.toFixed(0)}lb`);
  t.ok(B.head > 29 && B.retHead > B.A.ret, `맞바람 30kt 면 귀환 연료가 는다 (${B.A.ret.toFixed(0)} → ${B.retHead.toFixed(0)}lb)`);
  t.ok(B.lv1 === 1 && B.lv2 === 2 && /bingo/i.test(B.spoke) && /BINGO 가까움/.test(B.toasts) && /BINGO FUEL/.test(B.toasts), `여유 150lb 아래 — 가까움 · 0 아래 — BINGO FUEL(음성) (${B.lv1} → ${B.lv2})`);
  t.ok(B.panel && B.tool, '🧰 도구에 ⛽ 연료 · BINGO · 📻 교신 연습');

  // ── 무선 교신 연습 ──
  const R = await page.evaluate(() => {
    const o = {}, sp = window.speak; let said = ''; window.speak = x => { said = x; return true; };
    const full = radioCheckDistress('MAYDAY MAYDAY MAYDAY, coastguard zero one, 10 miles south of RKPC, 1500 feet, engine failure, intending to ditch, four persons on board, endurance 30 minutes');
    const part = radioCheckDistress('mayday coastguard zero one engine failure');
    o.full = { kind: full.kind, n: full.n, ok: full.ok }; o.part = { n: part.n, miss: part.items.filter(x => !x[1]).map(x => x[0]) };
    o.pan = radioCheckDistress('PAN PAN PAN PAN PAN PAN coastguard zero one').kind;
    toggleRadioPractice(); const w = document.getElementById('radio-wrap');
    w.querySelector('[data-rd="ph:2:0"]').click(); o.ex = w.querySelector('[data-rdv="ex"]').textContent; o.said = said;
    w.querySelector('[data-rd="copy"]').click(); o.chk = w.querySelector('[data-rdv="chk"]').textContent;
    o.rec = !!w.querySelector('[data-rd="rec"]');
    toggleRadioPractice(); window.speak = sp;
    return o;
  });
  t.ok(R.full.kind === 'MAYDAY' && R.full.ok && R.full.n === 8, `MAYDAY 형식 — 8가지 모두 (${R.full.n}/8)`);
  t.ok(R.part.n < 8 && R.part.miss.includes('머리말 3번') && R.part.miss.includes('위치') && R.part.miss.includes('탑승 인원') && R.pan === 'PAN-PAN',
    `빠진 것을 짚는다 — ${R.part.miss.join(' · ')} · PAN-PAN 도 가린다`);
  t.ok(/^MAYDAY MAYDAY MAYDAY/.test(R.ex) && R.said === R.ex && /8\/8/.test(R.chk) && R.rec, `📻 교신 연습 — 표준 문구(지금 자리 · 콜사인)를 읽어 주고, 본보기는 형식 점검 8/8 · 녹음 단추`);
  // ── 구름층(밑면 ~ 윗면) · 비 · 눈 ──
  await page.evaluate(() => selectPanel('right', 'm3d'));
  await page.waitForTimeout(600);
  const W = await page.evaluate(async () => {
    const o = {}, keep = { ceil: env.ceil, ctop: env.ctop, rain: env.rain, snow: env.snow, tod: env.tod }, alt0 = S.alt, w = ms => new Promise(r => setTimeout(r, ms));
    envSet({ ceil: 1000, ctop: 0, tod: 'DAY' }); o.auto = envCloudTop();
    envSet({ ctop: 6000 }); o.top = envCloudTop();
    envSet({ ctop: 800 }); o.bad = envCloudTop();
    envSet({ ctop: 6000 }); const cl = () => { envFxFrame(); return +document.querySelector('#map3d .env-cloud').style.opacity; };
    S.alt = 4000; o.mid = cl(); o.wet = envMoisture(); S.alt = 6500; o.above = cl(); S.alt = 700; o.below = cl();
    toggleEnvPanel(); o.note = (document.querySelector('#env-wrap [data-envv="cloud"]') || {}).textContent || ''; toggleEnvPanel();
    // 비 · 눈 — 캔버스 입자
    const cv = () => document.querySelector('#map3d .env-precip');
    const lit = () => { const c = cv(); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 40) if (d[i] > 20) n++; return n; };
    envSet({ rain: 2, snow: 0 }); await w(400); o.rainN = _envP.rain.length; o.rainLit = lit();
    envSet({ rain: 0, snow: 2 }); await w(400); o.snowN = _envP.snow.length; o.snowLit = lit(); o.rainGone = _envP.rain.length === 0;
    envSet({ rain: 0, snow: 0 }); await w(200); o.off = !cv().width;
    o.metar = envFromMetar('RKSS 010000Z 36010KT 2000 -SN BKN010 M02/M04 Q1013').env.snow === 1 && envFromMetar('RKSS 010000Z 36010KT 0800 +SN OVC005 M02/M04 Q1013').env.snow === 2;
    envSet(keep); S.alt = alt0;
    return o;
  });
  await page.evaluate(() => selectPanel('right', 'map'));
  t.ok(W.auto === 2500 && W.top === 6000 && W.bad === 2500, `구름 윗면 — 자동(밑면+1,500) ${W.auto} · 고르면 ${W.top} · 밑면보다 낮으면 자동 ${W.bad}`);
  t.ok(W.mid === 1 && W.wet === 1 && W.above === 0 && W.below === 0 && /1,000 ~ 6,000ft/.test(W.note), `밑면 ~ 윗면 사이는 구름 속(4,000ft ${W.mid}) · 위(${W.above}) · 아래(${W.below}) · ENV 안내 “${W.note}”`);
  t.ok(W.rainN === 720 && W.rainLit > 50 && W.snowN === 600 && W.snowLit > 50 && W.rainGone && W.off, `비(빗줄기 ${W.rainN}) · 눈(송이 ${W.snowN})을 캔버스에 그리고, 끄면 거둔다`);
  t.ok(W.metar, 'METAR -SN · +SN → 눈 약 · 강');
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
