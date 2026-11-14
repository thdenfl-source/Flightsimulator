// 비행 기록 · 강평(28-debrief.js) · PFD HDG 선회 방향 화살표 · AFCS 모드 풀림 경보(03-pfd.js)
export const name = '비행 기록 · 강평';

export async function run(page, t) {
  // ── 기록 — 1초마다 표본 · 사건(이륙 · 착륙 · 모드 · 한계) ──
  const R = await page.evaluate(() => {
    fdrClear(); fdr.on = true;
    const gnd0 = window.sndOnGround;
    let onGnd = true; window.sndOnGround = () => onGnd;
    S.lat = 37.5; S.lon = 127; S.alt = 0; S.spd = 0; S.vs = 0;
    fdrStep(1);                                     // 땅
    onGnd = false; S.alt = 300; S.spd = 60; S.vs = 800; fdrStep(1);   // 이륙
    hdgSelOn = true; rollApOn = true; selHdg = 90; fdrStep(1);
    hdgSelOn = false; rollApOn = false; S.spd = 200; fdrStep(1);       // HDG 풀림 · VNE 넘음
    S.spd = 60; S.vs = -500; onGnd = false; fdrStep(1);
    onGnd = true; S.alt = 0; S.vs = 0; fdrStep(1);                     // 착륙(앞 표본 −500fpm → 거친 착륙)
    fdrStep(0.4); const n06 = fdr.rows.length; fdrStep(0.7);           // 1초가 차야 하나 더
    window.sndOnGround = gnd0;
    const s = fdrSummary(), csv = fdrCsv();
    return { n: fdr.rows.length, n06, ev: fdr.ev.map(e => e.txt), s, csvHead: csv.split('\n')[0], csvRows: csv.split('\n').length };
  });
  t.ok(R.n === 7 && R.n06 === 6, `시뮬레이터 1초마다 한 표본 (${R.n})`);
  const has = re => R.ev.some(e => re.test(e));
  t.ok(has(/이륙/) && has(/착륙/) && has(/AFCS 걸림 — HDG/) && has(/AFCS 풀림 — HDG/) && has(/VNE 넘음/),
    `사건 — ${R.ev.join(' / ')}`);
  t.ok(R.s.landings === 1 && R.s.hardLdg === 1 && R.s.vneS >= 1 && R.s.drops === 1 && R.s.maxIas >= 200,
    `요약 — 착륙 ${R.s.landings}(거친 ${R.s.hardLdg}) · VNE 넘은 ${R.s.vneS}초 · 모드 풀림 ${R.s.drops} · 최고 ${R.s.maxIas.toFixed(0)}kt`);
  t.ok(/^t_s,lat,lon,alt_ft,ias_kt/.test(R.csvHead) && R.csvRows > R.n + 2, 'CSV — 표본과 사건을 함께 적는다');

  // ── 강평 창 — 지도 창 📋 DEBRIEF 단추 ──
  const W = await page.evaluate(async () => {
    const b = document.getElementById('map-dbf-btn'); b.click();
    await new Promise(r => setTimeout(r, 200));
    const w = document.getElementById('dbf-wrap'), o = { open: !!w && getComputedStyle(w).display !== 'none' };
    o.sum = w.querySelector('[data-dbf-v="sum"]').textContent;
    o.ev = w.querySelectorAll('[data-ev]').length;
    // 사건을 누르면 그 순간으로
    const e = w.querySelector('[data-ev]'); e.click(); o.cur = _dbf.cur; o.live = _dbf.live;
    o.read = w.querySelector('[data-dbf-v="read"]').textContent;
    w.querySelector('[data-dbf="map"]').click(); o.track = !!_dbf.track; w.querySelector('[data-dbf="map"]').click(); o.trackOff = !_dbf.track;
    w.querySelector('[data-dbf="play"]').click(); o.playing = !!_dbf.playT;
    await new Promise(r => setTimeout(r, 900)); o.played = _dbf.cur;
    w.querySelector('[data-dbf="close"]').click(); o.closed = getComputedStyle(w).display === 'none' && !_dbf.playT;
    return o;
  });
  t.ok(W.open && /착륙/.test(W.sum) && W.ev >= 5, `📋 DEBRIEF — 강평 창이 열리고 요약 · 사건 ${W.ev}개`);
  t.ok(W.cur >= 0 && !W.live && /ALT/.test(W.read), `사건을 누르면 그 순간의 값 (${W.read.slice(0, 40)}…)`);
  t.ok(W.track && W.trackOff && W.playing && W.played > 0 && W.closed, '지도에 항적 겹치기 · ▶ 다시 보기 · ✕ 닫기');

  // ── PFD — HDG 선회 방향 화살표 · AFCS 모드 풀림 경보 ──
  const P = await page.evaluate(async () => {
    const o = {};
    selectPanel('left', 'pfd', true);
    S.hdg = 100; selHdg = 300; hdgSelOn = true; rollApOn = true; navApOn = false; hdgTurnDir = 1;
    const seen = [], oT = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return oT.call(this, x, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = oT; }
    o.arrowR = seen.includes(' ▶'); o.dir1 = pfdHdgTurnDir();
    hdgTurnDir = -1; seen.length = 0;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push(String(x)); return oT.call(this, x, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = oT; }
    o.arrowL = seen.includes(' ◀'); o.dir = pfdHdgTurnDir();
    // 모드 풀림 — 조종사 손이 닿지 않은 채 HDG 가 꺼진다 → 황색 깜빡임 + 소리(횟수)
    drawPFD(); const c0 = afcsDropCount, a0 = afcsAlertCount;
    _pilotInT = -1e9; hdgSelOn = false; rollApOn = false; hdgTurnDir = 0; drawPFD();
    o.drop = afcsDropCount - c0; o.alert = afcsAlertCount - a0; o.flash = !!_fmaDrop[1];
    // 조종사가 막 누른 뒤 풀린 것은 스스로 푼 것
    hdgSelOn = true; rollApOn = true; drawPFD(); _pilotInT = performance.now(); hdgSelOn = false; rollApOn = false; drawPFD();
    o.drop2 = afcsDropCount - c0; o.alert2 = afcsAlertCount - a0;
    return o;
  });
  t.ok(P.arrowR && P.arrowL && P.dir1 === 1 && P.dir === -1, 'HSI 선택 헤딩 옆 화살표 — 오른쪽 선회 ▶ · 왼쪽 선회 ◀(+ 컴퍼스 안 호)');
  t.ok(P.drop === 1 && P.alert === 1 && P.flash && P.drop2 === 2 && P.alert2 === 1,
    'AFCS 모드 풀림 — 칸이 5초 동안 황색으로 깜빡이고 딩동(조종사가 막 눌러 푼 것은 경보 없음)');

  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
