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

  // ── 채점(A ~ B) · 3D 다시 보기 ──
  const G = await page.evaluate(async () => {
    fdrClear(); fdr.on = true; const o = {};
    S.alt = 1000; S.spd = 100; S.hdg = 90;
    for (let i = 0; i < 20; i++) { S.alt = 1000 + (i < 15 ? 20 : 300); fdrStep(1); }     // 15초는 ±100 안 · 5초는 밖
    dbfOpen(); const w = document.getElementById('dbf-wrap');
    _dbfSeek(0); w.querySelector('[data-dbf="ga"]').click(); _dbfSeek(19); w.querySelector('[data-dbf="gb"]').click();
    const R = fdrGrade(); o.alt = R.items.find(x => x.k === 'alt'); o.score = R.score; o.grade = R.grade;
    o.html = w.querySelector('[data-dbf-v="gr"]').textContent;
    // 3D 다시 보기 — 기록 자리로 옮겨 그리고, 끝내면 돌아온다
    const lat0 = S.lat; S.lat = 33; fdr.rows[5].lat = 35.5;
    _dbfSeek(5); w.querySelector('[data-dbf="r3d"]').click(); _dbfPlay(false); _dbf.cur = 5; _rpApply();
    o.rp = { on: _rp.on, lat: S.lat, mini: getComputedStyle(document.getElementById('dbf-mini')).display !== 'none', run: S.running };
    document.querySelector('#dbf-mini [data-rp="end"]').click();
    o.back = { on: _rp.on, lat: S.lat, open: _dbf.open };
    dbfClose(); S.lat = lat0;
    return o;
  });
  t.ok(Math.round(G.alt.inPct) === 75 && G.alt.maxDev > 250 && /점수/.test(G.html),
    `채점 — 고도 ±100ft 안 ${G.alt.inPct.toFixed(0)}% · 최대 ${G.alt.maxDev.toFixed(0)}ft · 점수 ${G.score.toFixed(0)} ${G.grade}`);
  t.ok(G.rp.on && G.rp.lat === 35.5 && G.rp.mini && !G.rp.run && !G.back.on && G.back.lat === 33 && G.back.open,
    '3D 다시 보기 — 기록한 자리로 기체를 옮겨 그리고(비행 멈춤 · 아래 작은 막대) · 끝내면 원래 상태로');

  // ── 시나리오 · 환경 ──
  const SC = await page.evaluate(async () => {
    const o = {}, keep = localStorage.getItem('scnList');
    localStorage.removeItem('scnList');
    S.lat = 36.1; S.lon = 126.2; S.alt = 1500; S.hdg = 45; S.spd = 80; windDir = 120; windSpd = 15;
    envSet({ tod: 'NIGHT', vis: 3, rain: 1, nvg: false, sea: 4 });
    o.env = { night: document.documentElement.classList.contains('env-night'), rain: document.documentElement.classList.contains('env-rain1'), roll: shipRollAmp, pitch: shipPitchAmp, fog: envSky()['fog-ground-blend'], drift: envSeaDrift() };
    toggleScenario(); const w = document.getElementById('scn-wrap');
    w.querySelector('[data-scnv="name"]').value = '검사 시나리오'; w.querySelector('[data-scn="save"]').click();
    o.saved = scnList().length;
    S.lat = 30; S.alt = 9000; windSpd = 0; envSet({ tod: 'DAY', vis: 0, rain: 0, sea: 0 });
    w.querySelector('[data-scn="load:0"]').click();
    o.loaded = { lat: S.lat, alt: S.alt, wind: windSpd, tod: env.tod, sea: env.sea, run: S.running };
    o.imp = scnImport(JSON.stringify([Object.assign(scnCapture('들여온 것'), {})]));
    envSet({ tod: 'DAY', vis: 0, rain: 0, sea: 0 }); windSpd = 0;
    if (keep === null) localStorage.removeItem('scnList'); else localStorage.setItem('scnList', keep);
    if (w) w.style.display = 'none';
    return o;
  });
  t.ok(SC.env.night && SC.env.rain && SC.env.roll === 6 && SC.env.pitch === 3 && SC.env.fog < 0.3 && SC.env.drift.kt === 0.9 && SC.env.drift.dir === 300,
    `환경 — 야간 · 비 · 시정 3km(안개 ${SC.env.fog.toFixed(2)}) · 바다 상태 4(함정 롤 ${SC.env.roll}° · 피칭 ${SC.env.pitch}° · 익수자 ${SC.env.drift.kt}kt 바람 쪽)`);
  t.ok(SC.saved === 1 && Math.abs(SC.loaded.lat - 36.1) < 1e-9 && SC.loaded.alt === 1500 && SC.loaded.wind === 15 && SC.loaded.tod === 'NIGHT' && SC.loaded.sea === 4 && !SC.loaded.run && SC.imp === 1,
    '시나리오 — 지금 상태 저장 · 불러오기(자리 · 고도 · 바람 · 환경, 멈춘 채) · 파일 들여오기');

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
