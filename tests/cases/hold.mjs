// 홀딩 — 진입 구역 판정(좌우 대칭), 경로 추종, NAV 유지
export const name = '홀딩 패턴';

export async function run(page, t) {
  // ① 진입 구역 판정이 좌·우선회에서 정확히 거울상인가
  const sym = await page.evaluate(() => {
    let n = 0, bad = 0;
    [0, 37, 90, 141, 200, 270, 315, 359].forEach(C => {
      for (let r = 0; r < 360; r += 0.5) {
        holdCrs = C; holdRight = true;  const R = _holdEntryType(normA(C + r));
        holdRight = false;              const L = _holdEntryType(normA(C - r));
        n++; if (R !== L) bad++;
      }
    });
    const w = {}; holdRight = true; holdCrs = 90;
    for (let r = 0; r < 360; r += 0.25) { const k = _holdEntryType(normA(90 + r)); w[k] = (w[k] || 0) + 0.25; }
    return { n, bad, w };
  });
  t.eq(sym.bad, 0, `좌우 거울상 판정 ${sym.n}건 불일치 없음`);
  t.ok(Math.abs(sym.w.PARALLEL - 108) < 4, `평행 섹터 폭 ${sym.w.PARALLEL}° (110° 근처)`);
  t.ok(Math.abs(sym.w.TEARDROP - 68) < 4, `눈물방울 섹터 폭 ${sym.w.TEARDROP}° (70° 근처)`);

  // ② 진입 3종 비행 — 그려진 트랙 추종, NAV 유지
  const fly = await page.evaluate(() => {
    const C = 90, FIX = [37.0, 127.5];
    const dev = (pts, la, lo) => {
      const X = p => [(p[1] - FIX[1]) * Math.cos(FIX[0] * D2R) * 60, (p[0] - FIX[0]) * 60];
      const me = X([la, lo]), XY = pts.map(X); let best = 1e9;
      for (let i = 0; i < XY.length - 1; i++) {
        const ax = XY[i][0], ay = XY[i][1], dx = XY[i + 1][0] - ax, dy = XY[i + 1][1] - ay;
        const L2 = dx * dx + dy * dy; let u = L2 > 1e-12 ? ((me[0] - ax) * dx + (me[1] - ay) * dy) / L2 : 0;
        u = Math.max(0, Math.min(1, u));
        best = Math.min(best, Math.hypot(me[0] - (ax + u * dx), me[1] - (ay + u * dy)));
      }
      return best;
    };
    const one = (dir, appr) => {
      const A = destPoint(FIX[0], FIX[1], normA(appr + 180), 25);
      S.wps = [{ ident: 'A', lat: A[0], lon: A[1] },
               { ident: 'FIX', lat: FIX[0], lon: FIX[1], hold: { dir, crs: C, legType: 'TIME', legVal: 60 } }];
      S.fwp = 0; S.awp = 1; obsOn = false; navSrc = 'FMS'; S.crs = C;
      const st = destPoint(FIX[0], FIX[1], normA(appr + 180), 14);
      S.lat = st[0]; S.lon = st[1]; S.spd = 120; S.hdg = appr; S.bnk = 0;
      windSpd = 0; windDir = 0; navApOn = true; hdgSelOn = false; rollApOn = true; holdExit();
      const dt = 0.5; let entry = '', tTrack = -1, devs = [], navOff = false, entryDist = -1;
      for (let i = 0; i < 3000 / dt; i++) {
        updateNav();
        if (S.awp >= 0 && !obsOn && !holdOn && S.dtw < 0.25 && S.awp + 1 >= S.wps.length) navApOn = false;
        if (!navApOn) { navOff = true; break; }
        const p0 = _holdPhase;
        holdSyncFromWp();
        const hb = holdBankTarget(dt); bankTarget = (hb === null) ? navApBankTarget() : hb;
        if (p0 === 'TOFIX' && _holdPhase !== 'TOFIX') { entry = _holdEntry; entryDist = distance(S.lat, S.lon, FIX[0], FIX[1]); }
        if (_holdPhase === 'TRACK' && tTrack < 0) tTrack = i;
        S.bnk += Math.max(-3, Math.min(3, bankTarget - S.bnk));
        const V = Math.max(10, S.spd) * 0.5144;
        S.hdg = normA(S.hdg + 9.81 * Math.tan(S.bnk * D2R) / V / D2R * dt);
        const sc = 1852 / 3600 * dt / 111320;
        S.lat += S.spd * Math.cos(S.hdg * D2R) * sc;
        S.lon += S.spd * Math.sin(S.hdg * D2R) * sc / Math.cos(S.lat * D2R);
        if (tTrack >= 0 && i > tTrack + 400) devs.push(dev(holdPatternLatLngs(), S.lat, S.lon));
      }
      return { entry, navOff, entryDist,
               devMax: devs.length ? Math.max(...devs) : NaN,
               devAvg: devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : NaN };
    };
    return { R90: one('R', 90), R50: one('R', 50), R330: one('R', 330),
             L90: one('L', 90), L130: one('L', 130), L210: one('L', 210) };
  });

  const want = { R90: 'DIRECT', R50: 'TEARDROP', R330: 'PARALLEL',
                 L90: 'DIRECT', L130: 'TEARDROP', L210: 'PARALLEL' };
  for (const [k, v] of Object.entries(want)) {
    t.eq(fly[k].entry, v, `${k} 진입 = ${v}`);
    t.eq(fly[k].navOff, false, `${k} NAV 유지`);
    t.ok(fly[k].entryDist <= 0.36, `${k} 픽스 상공에서 진입 시작 (${fly[k].entryDist.toFixed(2)}NM)`);
    t.ok(fly[k].devMax < 0.35, `${k} 그려진 트랙 이탈 최대 ${fly[k].devMax.toFixed(3)}NM`);
  }
}
