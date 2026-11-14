// 기종 Bell 206B-3(js/00-aircraft.js · js/25-b206panel.js) — 아날로그 계기판이 PFD 창과 Cockpit 모드 계기판 자리에 그려진다
export const name = 'Bell 206';

export async function run(page, t) {
  // 기본 검사는 ?ac=aw189 로 뜬다(tests/lib/env.mjs) — Bell 206 으로 다시 띄운다(판 · 다른 꼬리는 그대로)
  const u = new URL(page.url()); u.searchParams.set('ac', 'b206');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);

  const A = await page.evaluate(() => {
    const o = { ac: AC_TYPE, cls: document.documentElement.classList.contains('ac-b206'), info: acInfo().engines,
                gate: document.querySelectorAll('.gate-ac-btn').length };
    // PFD 창 — drawPFD 가 유리 PFD 대신 b206Draw 를 부른다(유리 PFD 의 자세계 drawAI 는 부르지 않는다)
    let nB = 0, nAI = 0; const oB = b206Draw, oAI = drawAI;
    b206Draw = function (...a) { nB++; return oB.apply(this, a); };
    drawAI = function (...a) { nAI++; return oAI.apply(this, a); };
    try { drawPFD(); } finally { b206Draw = oB; drawAI = oAI; }
    o.nB = nB; o.nAI = nAI;
    // 값 — 엔진이 돌면 NR · N2 는 100 근처, 토크는 206 눈금(연속 85 · 한계 100) 안
    S.spd = 90; S.alt = 1200;
    const v = b206Vals(); o.v = { nr: v.nr, n2: v.n2, tq: v.tq, n1: v.n1, tot: v.tot, gal: v.gal };
    o.an = b206Annun(v);
    o.lowFuel = b206Annun(Object.assign({}, v, { gal: 10 })).lowFuel;
    o.rpmLow = b206Annun(Object.assign({}, v, { nr: 80 })).rpm;
    o.cdi = (() => { const c = b206Cdi(); return Number.isFinite(c.dev) && Math.abs(c.dev) <= 1; })();
    return o;
  });
  t.ok(A.ac === 'b206' && A.cls && A.info === 1, `?ac=b206 — 기종 Bell 206B-3(단발) (${A.ac})`);
  t.ok(A.gate === 2, '시작 화면에 기종 고르기 버튼 둘(Bell 206B-3 · AW189)');
  t.ok(A.nB === 1 && A.nAI === 0, `PFD 창에는 유리 PFD 대신 Bell 206 아날로그 계기판 (b206Draw ${A.nB} · drawAI ${A.nAI})`);
  t.ok(A.v.nr > 95 && A.v.nr < 105 && A.v.n2 > 95 && A.v.n2 <= 100, `회전계 — NR ${A.v.nr.toFixed(0)}% · N2 ${A.v.n2.toFixed(0)}%`);
  t.ok(A.v.tq > 0 && A.v.tq < 100 && A.v.n1 > 60 && A.v.n1 < 106 && A.v.tot > 400 && A.v.tot < 810 && A.v.gal > 0 && A.v.gal <= 91,
    `엔진 계기 값이 206 한계 안 (TQ ${A.v.tq.toFixed(0)}% · N1 ${A.v.n1.toFixed(0)}% · TOT ${A.v.tot.toFixed(0)}°C · 연료 ${A.v.gal.toFixed(0)} gal)`);
  t.ok(!A.an.engOut && !A.an.rpm && A.lowFuel && A.rpmLow, '경고등 — 정상 비행에는 꺼지고, 연료 20 gal 아래 LOW FUEL · NR 90% 아래 RPM 이 켜진다');
  t.ok(A.cdi, 'CDI 편차는 −1…1');

  // Cockpit 모드 — 화면 넷 대신 아날로그 계기판 하나 · 누르면 크게(PFD 팝아웃)
  const C = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    S.alt = 1500; S.spd = 100;
    cockpitStart(); await w(1500);
    const cs = [...document.querySelectorAll('#sim-ckpit canvas.ck-scr')];
    const o = { n: cs.length, w: cs[0] ? cs[0].width : 0 };
    // 계기판이 실제로 그려졌나 — 판 색(회청색) 픽셀이 있다
    try {
      const c = cs[0], g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
      let panel = 0; for (let i = 0; i < d.length; i += 4 * 97) if (Math.abs(d[i] - 0x7f) < 12 && Math.abs(d[i + 1] - 0x8a) < 12 && Math.abs(d[i + 2] - 0x93) < 12) panel++;
      o.panel = panel;
    } catch (e) { o.panel = String(e); }
    cs[0] && cs[0].click(); await w(300);
    o.pop = ckConPop; toggleConsolePop(null); await w(200);
    exitSolo(); await w(400);
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 그만 */ }
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(C.n === 1 && C.w >= 1000 && C.panel > 50, `Cockpit 모드 — 가운데 아날로그 계기판 하나 (캔버스 ${C.n}개 · 너비 ${C.w} · 판 픽셀 ${C.panel})`);
  t.ok(C.pop === 'pfd', '계기판을 누르면 가운데에 크게 뜬다');

  // PFD 창 — 판이 소프트키 줄 · FCP 위에서 끝난다(가려지지 않는다)
  const R = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    exitSolo(); await w(300); selectPanel('left', 'pfd'); await w(400);
    const cr = cvs.getBoundingClientRect(), k = cvs.height / cr.height;
    const sk = document.getElementById('pfd-sk').getBoundingClientRect();
    return { room: b206RoomH(cvs, cvs.height, 0), want: (sk.top - cr.top) * k };
  });
  t.ok(Math.abs(R.room - R.want) < 2, `PFD 창 — 판이 소프트키 · FCP 위까지만 (판 높이 ${Math.round(R.room)} · 소프트키 위 ${Math.round(R.want)})`);

  // 오른쪽 창에 UPPER(상부 콘솔)를 띄운 채 Cockpit 모드로 — 상부 콘솔이 조종석 칸으로 옮겨진다(숨은 창에 남아 검게 비던 것)
  const U = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'ovhd'); selectPanel('right', 'lcon'); selectPanel('right', 'ovhd'); await w(400);
    cockpitStart(); await w(1500);
    const o = { ovhd: document.getElementById('ovhd-wrap').parentElement.id, h: document.getElementById('ovhd-wrap').getBoundingClientRect().height };
    exitSolo(); await w(500);
    o.back = document.getElementById('ovhd-wrap').parentElement.id;
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 그만 */ }
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(U.ovhd === 'ck-mini-ovhd' && U.h > 20, `UPPER 를 띄운 채 Cockpit 모드 — 상부 콘솔이 조종석에 보인다 (${U.ovhd} · 높이 ${Math.round(U.h)})`);
  t.ok(U.back === 'right-panel', `분할 화면으로 돌아오면 오른쪽 창으로 돌아간다 (${U.back})`);

  // 기종 바꾸기 — 적어 두기만(다시 불러오지 않고)
  const P = await page.evaluate(() => { setAircraftType('aw189', false); const a = localStorage.getItem('shineAc'); setAircraftType('b206', false); return { a, b: localStorage.getItem('shineAc'), bad: setAircraftType('xx', false) }; });
  t.ok(P.a === 'aw189' && P.b === 'b206' && P.bad === false, '기종 고르기는 localStorage(shineAc)에 적힌다 · 없는 기종은 거절');
  // ── 3D 화면에 겹친 계기(계기 ON) — 자세계/볼 · 고도계 · 승강계 · 토크 · 방향지시계 다섯만 ──
  const OV = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.id = 'pfd-ov-cvs'; c.width = 600; c.height = 420; c.dataset.noFcp = '1';
    const names = ['b206Attitude', 'b206Altimeter', 'b206Vsi', 'b206Dg', 'b206RoundGauge', 'b206Airspeed', 'b206Tach', 'b206Rmi', 'b206Turn', 'b206CdiGauge', 'b206DualGauge', 'b206N1', 'b206Clock'];
    const n = {}, orig = {};
    names.forEach(k => { n[k] = 0; orig[k] = window[k]; });
    // 최상위 function 은 window 의 것 — 바꿔 끼워 몇 번 불리는지 센다
    names.forEach(k => { window[k] = function (...a) { n[k]++; return orig[k].apply(this, a); }; });
    const titles = []; const oT = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { titles.push(String(x)); return oT.call(this, x, ...a); };
    try { drawPfdTo(c); } finally { names.forEach(k => { window[k] = orig[k]; }); CanvasRenderingContext2D.prototype.fillText = oT; }
    return { n, torque: titles.includes('TORQUE') };
  });
  const N = OV.n;
  t.ok(N.b206Attitude === 1 && N.b206Altimeter === 1 && N.b206Vsi === 1 && N.b206Dg === 1 && N.b206RoundGauge === 1 && OV.torque,
    '계기 ON — 3D 화면에 자세계(+볼) · 고도계 · 승강계 · 토크 · 방향지시계 다섯이 뜬다');
  t.ok(['b206Airspeed', 'b206Tach', 'b206Rmi', 'b206Turn', 'b206CdiGauge', 'b206DualGauge', 'b206N1', 'b206Clock'].every(k => N[k] === 0),
    `그 밖의 계기(속도계 · 회전계 · RMI · 선회계 · CDI · 엔진 계기 · 시계)는 겹친 계기에 그리지 않는다 (${JSON.stringify(N)})`);
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, `오류 없음${errs.length ? ' (' + errs.slice(0, 2).join(' | ') + ')' : ''}`);
}
