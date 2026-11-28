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
  // 3D 외부 모형(15-heli3d.js) — R22 제 모형 · 실제 치수(전장 8.76m · 주로터 7.67m · 꼬리로터 1.07m 왼쪽 · 스키드 폭 1.93m)
  const M = await page.evaluate(() => {
    const b = _h3BuildBody(), SP = H3_SPECS[H3_OWN];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < b.length; i += 10) { x0 = Math.min(x0, b[i]); x1 = Math.max(x1, b[i]); y0 = Math.min(y0, b[i + 1]); y1 = Math.max(y1, b[i + 1]); z1 = Math.max(z1, b[i + 2]); }
    const front = Math.max(x1, SP.rotor.x + SP.rotor.r), rear = Math.min(x0, SP.tail.x - SP.tail.r);
    return { own: H3_OWN, len: front - rear, mid: (front + rear) / 2, rotorD: SP.rotor.r * 2, tailD: SP.tail.r * 2, tailL: SP.tail.y < 0, width: y1 - y0, top: z1,
             livery: b.some((v, i) => i % 10 === 9 && v === 3), acLen: SIM_AC_LEN, other: _h3BuildBody('b206').length !== b.length };
  });
  t.ok(M.own === 'r22' && M.other && M.livery, `3D 모형 — R22 제 모형(Bell 206 과 다르다 · 붉은 동체 도색) (${M.own})`);
  t.ok(Math.abs(M.len - 8.76) < 0.05 && Math.abs(M.mid) < 0.05 && Math.abs(M.rotorD - 7.67) < 0.02 && Math.abs(M.tailD - 1.07) < 0.02 && M.tailL,
       `모형 치수 — 전장 ${M.len.toFixed(2)}m · 주로터 ${M.rotorD.toFixed(2)}m · 꼬리로터 ${M.tailD.toFixed(2)}m(왼쪽)`);
  t.ok(Math.abs(M.width - 1.93) < 0.1 && M.top < 2.7 && M.acLen === 9, `스키드 폭 ${M.width.toFixed(2)}m · 착함 판정 길이 ${M.acLen}m`);
  const MK = await page.evaluate(() => ({ ac: acMarker.getElement().querySelector('.ac-marker').dataset.ac, r22: acIconSvg() === AC_ICON_R22 }));
  t.ok(MK.ac === 'r22' && MK.r22, `지도 심볼 — R22 평면도 (${JSON.stringify(MK)})`);
  t.ok(page.errors.length === 0, `오류 없음${page.errors.length ? ' — ' + page.errors.join(' / ') : ''}`);
}
