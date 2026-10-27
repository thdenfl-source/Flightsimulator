// 전파고도(RA) · CRHT · 승강계 범위
//
// PFD 오른쪽 아래 CRHT 창은 전파고도다 — 기압고도가 아니라 지형 자료로 잰 지면 위
// 높이(AGL)를 보이고, CRHT 는 그 높이를 지킨다. 승강계는 위로 3,000 · 아래로
// 4,000fpm 까지 읽는다.
//
// 지형 자료(타일)는 검사에서 받지 못하므로 그 자리 땅 높이(terrainFtAt)를 바꿔 끼워 본다.
export const name = '전파고도·승강계';

export async function run(page, t) {
  // ── 전파고도 = 기압고도 − 발밑 땅 ──
  const ra = await page.evaluate(() => {
    const keep = terrainFtAt;
    const out = {};
    try {
      S.lat = 37.0; S.lon = 126.0; S.alt = 3000; S.vs = 0; S.running = false;
      terrainFtAt = () => 1200;
      out.land = radarAltFt();
      terrainFtAt = () => 0;
      out.sea = radarAltFt();
      terrainFtAt = () => null;
      out.unknown = radarAltFt();
      terrainFtAt = () => 3500;
      out.below = radarAltFt();
      // PFD 의 CRHT 창이 전파고도를 적는다
      terrainFtAt = () => 1200;
      const texts = [], orig = ctx.fillText;
      ctx.fillText = function (s, ...a) { texts.push(String(s)); return orig.call(this, s, ...a); };
      try { drawPFD(); } finally { ctx.fillText = orig; }
      out.pfd = { ra: texts.includes('1800'), baro: texts.includes('3000'), lbl: texts.includes('RA') };
    } finally { terrainFtAt = keep; }
    return out;
  });
  t.eq(Math.round(ra.land), 1800, `땅 위에서는 지면에서 잰 높이다 (3,000ft · 땅 1,200ft → RA ${ra.land.toFixed(0)}ft)`);
  t.eq(Math.round(ra.sea), 3000, '바다 위에서는 기압고도와 같다');
  t.eq(Math.round(ra.unknown), 3000, '지형 자료가 아직 없으면 해수면에서 잰다');
  t.eq(ra.below, 0, '땅 아래로는 0 이다');
  t.ok(ra.pfd.ra && ra.pfd.baro && ra.pfd.lbl,
    `PFD 에는 기압고도(ALT 3000)와 전파고도(CRHT 창 RA 1800)가 따로 나온다 (${JSON.stringify(ra.pfd)})`);

  // ── CRHT 는 전파고도를 지킨다 — 땅이 오르면 따라 오른다 ──
  const crht = await page.evaluate(() => {
    const keep = terrainFtAt;
    const out = {};
    try {
      S.lat = 37.0; S.lon = 126.0; S.alt = 3000; S.vs = 0; S.spd = 0; S.bnk = 0; bankTarget = 0;
      altHoldOn = false; crhtOn = false; gspdOn = false; navApOn = false; hdgSelOn = false;
      terrainFtAt = () => 1200;
      toggleCrht();
      out.sel = selCrht;
      terrainFtAt = () => 1500;                        // 땅이 300ft 오른다
      S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 0; i < 50 * 20; i++) { ts += 50; simStep(ts); }
      S.running = false;
      out.alt = S.alt; out.ra = radarAltFt();
      // ▲ 는 전파고도 기준을 10ft 올린다
      applyDelta('crht', 10); out.up = selCrht;
      crhtOn = false;
    } finally { terrainFtAt = keep; }
    return out;
  });
  t.eq(crht.sel, 1800, `CRHT 를 걸면 지금 전파고도가 기준이다 (${crht.sel}ft)`);
  t.ok(Math.abs(crht.ra - 1800) < 1 && Math.abs(crht.alt - 3300) < 1,
    `땅이 300ft 오르면 따라 올라 전파고도 1,800ft 를 지킨다 (기압 ${crht.alt.toFixed(0)} · RA ${crht.ra.toFixed(0)}ft)`);
  t.eq(crht.up, 1810, 'CRHT ▲ 는 전파고도 기준을 10ft 올린다');

  // ── 승강계는 위로 3,000 · 아래로 4,000fpm 까지 ──
  const vsi = await page.evaluate(() => {
    const f = v => +vsiFrac(v).toFixed(3);
    const keep = S.vs, texts = [], orig = ctx.fillText;
    S.vs = -4000;
    ctx.fillText = function (s, ...a) { texts.push(String(s)); return orig.call(this, s, ...a); };
    try { drawPFD(); } finally { ctx.fillText = orig; S.vs = keep; }
    return { up: f(3000), dn: f(-4000), k1: f(1000), k2: f(-1000), over: f(-6000), half: f(2000),
             box: texts.includes('-4000'), labels: ['3', '4'].every(x => texts.includes(x)) };
  });
  t.ok(vsi.up === 1 && vsi.dn === -1, `눈금 끝이 +3,000 · −4,000fpm 이다 (${vsi.up} · ${vsi.dn})`);
  t.ok(vsi.k1 === 0.5 && vsi.k2 === -0.5, '±1,000fpm 까지는 반 칸에 넓게 본다');
  t.eq(vsi.half, 0.75, '+2,000fpm 은 위 칸의 3/4 자리다');
  t.eq(vsi.over, -1, '끝을 넘으면 끝에 붙는다');
  t.ok(vsi.box && vsi.labels, '값 칸에 −4000 이 그대로 나오고 눈금에 3·4 가 적힌다');
}
