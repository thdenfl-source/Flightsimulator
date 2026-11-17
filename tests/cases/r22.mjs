// 기종 R22(js/00-aircraft.js · js/25-b206panel.js r22Draw) — Bell 206 갈래(엔진 · 시동 · 연료 · 무전 · SIM 을 함께) ·
// 이름 · 성능(00-params.js r22Perf) · 한계 · 무게 · 계기판 배치(한서대 훈련기 사진)만 다르다
export const name = 'R22';

export async function run(page, t) {
  const u = new URL(page.url()); u.searchParams.set('ac', 'r22');
  await page.goto(u.toString());
  await page.waitForFunction(() => typeof S === 'object' && typeof b206Draw === 'function' && typeof leafMap === 'object', null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(300);
  const A = await page.evaluate(() => {
    const o = { ac: AC_TYPE, fam: acIs('b206'), exact: acExact('b206'), r22: acR22(), name: acInfo().name, eng: acInfo().engines,
      cls: document.documentElement.classList.contains('ac-r22') && document.documentElement.classList.contains('ac-b206'),
      gate: [...document.querySelectorAll('.gate-ac-btn')].map(b => b.dataset.ac).join(','),
      noCdu: !acScrOk('cdu') && !acScrOk('ovhd'), vne: B206P.vne, wt: B206P.wt, lim: B206_LIM.vne, cap: B206_LIM.fuelCap, max: B206_WB.max };
    // PFD 창 — R22 판(r22Draw)이 그려진다
    let n = 0; const o0 = r22Draw; r22Draw = function (...a) { n++; return o0.apply(this, a); };
    try { drawPFD(); } finally { r22Draw = o0; }
    o.nR22 = n;
    // 판 — 검은 판 · R22 등록 표가 그려진다(빈 판이 아니다)
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600; b206DrawTo(c);
    const d = c.getContext('2d').getImageData(0, 0, 1000, 600).data;
    let dark = 0, plate = 0;
    for (let i = 0; i < d.length; i += 4 * 53) { if (d[i] < 50 && d[i + 1] < 50 && d[i + 2] < 50) dark++; }
    { const p = c.getContext('2d').getImageData(300, 108, 4, 4).data; plate = p[0] > 200 && p[1] > 200; }
    o.dark = dark; o.plate = plate;
    // 누를 자리 — FUEL QTY 계기는 무게 · 연료 창
    o.hitFuel = (() => { const [x, y, w, h] = R22_HIT.fuel; return x < 640 && x + w > 640 && y < 390 && y + h > 390; })();
    // FCP 속도는 VNE 100 까지
    o.iasMax = simIasClamp(200);
    // 무게 · 연료
    b206WbOpen(); const wb = document.getElementById('wb-wrap'); o.wbTitle = /R22/.test(wb.textContent); o.wbMax = /2550/.test(wb.textContent);
    wb.style.display = 'none';
    // 경고등 — 정상 비행에는 꺼짐 · NR 처지면 ROTOR RPM
    const v = b206Vals(); o.an = b206Annun(v); o.rpmLow = b206Annun(Object.assign({}, v, { nr: 80 })).rpm;
    o.lowFuel = b206Annun(Object.assign({}, v, { gal: 10 })).lowFuel;
    return o;
  });
  t.ok(A.ac === 'r22' && A.fam && !A.exact && A.r22 && A.name === 'R22' && A.eng === 1 && A.cls, `?ac=r22 — 기종 R22(단발 · Bell 206 갈래) (${A.ac} · ${A.name})`);
  t.ok(/r22/.test(A.gate), `시작 화면 기종 고르기에 R22 (${A.gate})`);
  t.ok(A.noCdu, 'Bell 206 처럼 CDU · 상부 콘솔이 없다(하부 콘솔 항공전자 스택)');
  t.ok(A.vne === 100 && A.lim === 100 && A.iasMax === 100, `VNE 100kt — 성능 · 속도계 · FCP 속도 (${A.vne} · ${A.iasMax})`);
  t.ok(A.cap === 69 && A.max === 2550 && A.wbTitle && A.wbMax, `연료 69gal · 최대 2,550lb · W&B 창 이름 R22`);
  t.ok(A.nR22 === 1 && A.dark > 500 && A.plate && A.hitFuel, `PFD 창에 R22 계기판(검은 판 · 등록 표 · FUEL QTY 누름) (어두운 점 ${A.dark})`);
  t.ok(!A.an.engOut && !A.an.rpm && A.rpmLow && A.lowFuel, '경고등 — 정상 비행에는 꺼지고 NR 처지면 ROTOR RPM · 12gal 아래 LOW FUEL');
  t.ok(page.errors.length === 0, `오류 없음${page.errors.length ? ' — ' + page.errors.join(' / ') : ''}`);
}
