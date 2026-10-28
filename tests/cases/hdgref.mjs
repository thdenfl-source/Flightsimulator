// 방향 기준(MAS) — MG(Slaved) / DG
// 3D 창·지도 창의 같은 버튼으로 바꾼다. MG 는 자이로를 지구 자기장에 맞춰 HSI = 실제 기수,
// DG 는 방향 자이로만 — 1시간에 약 6° 어긋나고 −/+ 로 1° 씩 맞춘다.
// HSI·HDG 표시·HDG 유지는 계기 헤딩을, 지도·3D·GPS 항법은 실제 기수를 쓴다.
export const name = 'MG/DG 방향 기준';

// -180 … +180 (검사 쪽 계산용 — 페이지의 normAS 와 같다)
const normAS = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };

export async function run(page, t) {
  // ── 처음에는 MG(Slaved) — −/+ 는 죽어 있다 ──
  const start = await page.evaluate(() => {
    const boxes = ['hdgref-3d', 'hdgref-map'].map(id => document.getElementById(id));
    return {
      has: boxes.every(Boolean),
      in3d: !!(boxes[0] && boxes[0].closest('#map3d')),
      ref: hdgRef, err: dgErr,
      txt: boxes.map(b => b && b.querySelector('.hdgref-btn').textContent),
      dis: boxes.every(b => b && [...b.querySelectorAll('.hdgref-adj button')].every(x => x.disabled)),
      ind: Math.abs(normAS(hdgInd() - S.hdg)),
    };
  });
  t.ok(start.has && start.in3d, '3D 창과 지도 창에 MG/DG 버튼이 있다');
  t.ok(start.ref === 'MG' && start.txt.every(s => s === 'MG (Slaved)'), `처음에는 MG (Slaved) 다 (${start.txt.join(' · ')})`);
  t.ok(start.dis, 'MG 에서는 −/+ 가 죽어 있다');
  t.ok(start.err === 0 && start.ind < 1e-9, 'MG — HSI 헤딩이 실제 기수와 같다');

  // ── 누르면 DG — 두 창이 함께 바뀌고 −/+ 와 자기 나침반이 살아난다 ──
  const dg = await page.evaluate(() => {
    S.hdg = 90; syncHdgBug(); S.spd = 100; S.alt = 2000;
    document.querySelector('#hdgref-map .hdgref-btn').click();
    updateDgCompass();
    const b3 = document.getElementById('hdgref-3d'), bm = document.getElementById('hdgref-map');
    return {
      ref: hdgRef,
      txt: [b3, bm].map(b => b.querySelector('.hdgref-btn').textContent),
      live: [b3, bm].every(b => [...b.querySelectorAll('.hdgref-adj button')].every(x => !x.disabled)),
      comp: bm.querySelector('.hdgref-comp').textContent,
      compShown: getComputedStyle(bm.querySelector('.hdgref-comp')).display !== 'none',
      want: 'COMP ' + fmtA(toMag(S.hdg)) + '°',
    };
  });
  t.ok(dg.ref === 'DG' && dg.txt.every(s => s === 'DG'), `누르면 DG — 3D 창 버튼도 같이 바뀐다 (${dg.txt.join(' · ')})`);
  t.ok(dg.live, 'DG 에서는 −/+ 가 살아난다');
  t.ok(dg.compShown && dg.comp === dg.want, `맞출 때 견줄 자기 나침반을 보인다 (${dg.comp})`);

  // ── −/+ — HSI 를 1° 씩 ──
  const adj = await page.evaluate(() => {
    const h0 = hdgInd();
    const [mm, mp] = document.querySelectorAll('#hdgref-map .hdgref-adj button');
    const [dm] = document.querySelectorAll('#hdgref-3d .hdgref-adj button');
    mp.click(); const plus = normAS(hdgInd() - h0);
    mm.click(); dm.click(); const minus = normAS(hdgInd() - h0);
    const tru = S.hdg;
    mp.click();                                  // 제자리로
    return { plus, minus, tru };
  });
  t.ok(Math.abs(adj.plus - 1) < 1e-9, `+ 를 누르면 HSI 가 오른쪽으로 1° (${adj.plus.toFixed(1)}°)`);
  t.ok(Math.abs(adj.minus + 1) < 1e-9, `− 를 누르면 왼쪽으로 1° (${adj.minus.toFixed(1)}°)`);
  t.ok(adj.tru === 90, '−/+ 는 HSI 만 옮기고 실제 기수는 그대로다');

  // ── DG 는 1시간에 약 6° 어긋난다(나는 동안만) ──
  const drift = await page.evaluate(() => {
    dgErr = 0; hdgSelOn = false; navApOn = false; bankTarget = 0; S.bnk = 0;
    setSimSpeed(8);
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 2250; i++) { ts += 100; simStep(ts); }   // 0.1초 × 8배속 × 2250 = 30분
    S.running = false;
    const half = dgErr;
    // 멈춰 있는 동안은 어긋나지 않는다
    let ts2 = ts; for (let i = 0; i < 50; i++) { ts2 += 100; simStep(ts2); }
    const paused = dgErr - half;
    setSimSpeed(1);
    return { half, paused };
  });
  t.ok(Math.abs(drift.half + 3) < 0.02, `30분 날면 HSI 가 약 3° 어긋난다 — 1시간에 6° (${drift.half.toFixed(2)}°)`);
  t.ok(drift.paused === 0, '멈춰 있는 동안은 어긋나지 않는다');

  // ── HDG 유지는 HSI(계기 헤딩)를 지킨다 — 오차만큼 실제 기수가 비껴 간다 ──
  const hold = await page.evaluate(() => {
    dgErr = -6; S.hdg = 90; S.bnk = 0; bankTarget = 0;
    selHdg = 90; hdgSelOn = true; rollApOn = true; navApOn = false;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 600; i++) { ts += 50; simStep(ts); }      // 30초
    S.running = false;
    const r = { ind: hdgInd(), tru: S.hdg };
    // 지도 심볼은 실제 기수
    updateAcOnMap();
    const div = acMarker.getElement() && acMarker.getElement().querySelector('.ac-marker');
    r.icon = div ? div.style.transform : '';
    hdgSelOn = false;
    return r;
  });
  t.ok(Math.abs(normAS(hold.ind - 90)) < 0.6, `HDG 090 — HSI 는 090 을 지킨다 (${hold.ind.toFixed(1)}°)`);
  t.ok(Math.abs(normAS(hold.tru - 96)) < 0.6, `실제 기수는 오차(−6°)만큼 비껴 096 으로 난다 (${hold.tru.toFixed(1)}°)`);
  t.ok(new RegExp('rotate\\(' + hold.tru.toFixed(0)).test(hold.icon) || hold.icon.includes('rotate(' + hold.tru),
    `지도 심볼은 실제 기수를 가리킨다 (${hold.icon})`);

  // ── PFD — HSI 카드·HDG 칸은 계기 헤딩, 곁에 호박색 DG ──
  const pfd = await page.evaluate(() => {
    S.hdg = 100; dgErr = -7;
    const seen = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (txt, ...a) { seen.push(String(txt)); return orig.call(this, txt, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    return { seen, want: fmtA(toMag(hdgInd())) + '°', tru: fmtA(toMag(S.hdg)) + '°' };
  });
  t.ok(pfd.seen.includes(pfd.want), `HDG 칸은 HSI(계기 헤딩)를 보인다 (${pfd.want} · 실제 ${pfd.tru})`);
  t.ok(pfd.seen.includes('DG'), 'PFD 에 DG 를 표시한다');

  // ── MG 로 돌아오면 다시 자기장에 맞는다 ──
  const mg = await page.evaluate(() => {
    document.querySelector('#hdgref-3d .hdgref-btn').click();
    const seen = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (txt, ...a) { seen.push(String(txt)); return orig.call(this, txt, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    const bm = document.getElementById('hdgref-map');
    return { ref: hdgRef, err: dgErr, txt: bm.querySelector('.hdgref-btn').textContent,
             dis: [...bm.querySelectorAll('.hdgref-adj button')].every(x => x.disabled),
             comp: getComputedStyle(bm.querySelector('.hdgref-comp')).display, dg: seen.includes('DG') };
  });
  t.ok(mg.ref === 'MG' && mg.err === 0 && mg.txt === 'MG (Slaved)', 'MG 로 돌아오면 HSI 가 곧 실제 기수(자기 헤딩)에 다시 맞는다');
  t.ok(mg.dis && mg.comp === 'none' && !mg.dg, 'MG 에서는 −/+ · 나침반 · PFD 의 DG 가 사라진다');
}
