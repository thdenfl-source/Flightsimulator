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
    return { R90: one('R', 90), R230: one('R', 230), R330: one('R', 330),
             L90: one('L', 90), L310: one('L', 310), L210: one('L', 210) };
  });

  // 판정 기준은 픽스에서 본 방위(기수의 반대편)다. 인바운드 90°·우선회면
  // 방위 20~90° 가 눈물방울 → 그 방향에서 오는 기수는 200~270°.
  const want = { R90: 'DIRECT', R230: 'TEARDROP', R330: 'PARALLEL',
                 L90: 'DIRECT', L310: 'TEARDROP', L210: 'PARALLEL' };
  for (const [k, v] of Object.entries(want)) {
    t.eq(fly[k].entry, v, `${k} 진입 = ${v}`);
    t.eq(fly[k].navOff, false, `${k} NAV 유지`);
    t.ok(fly[k].entryDist <= 0.36, `${k} 픽스 상공에서 진입 시작 (${fly[k].entryDist.toFixed(2)}NM)`);
    t.ok(fly[k].devMax < 0.35, `${k} 그려진 트랙 이탈 최대 ${fly[k].devMax.toFixed(3)}NM`);
  }

  // ③ MAP 의 HOLD 진입 판정 레이어
  // 그림이 판정 규칙을 따로 베끼면 둘이 어긋나는 날 그림이 거짓말을 한다.
  // 그래서 부채꼴은 _holdEntryType 에서 되읽어 만든다 — 여기서 그걸 확인한다.
  const sec = await page.evaluate(() => {
    const span = (crs, right) => {
      const w = {};
      holdEntrySectors(crs, right).forEach(s => { w[s.type] = (w[s.type] || 0) + (s.to - s.from); });
      return w;
    };
    // 부채꼴 각도 θ(픽스에서 본 방위)에 칠한 색이, 그 방향에서 픽스로 곧장
    // 들어올 때(기수 θ+180)의 판정과 같은가
    let mismatch = 0, n = 0;
    [[90, true], [90, false], [217, true], [4, false]].forEach(([crs, right]) => {
      holdEntrySectors(crs, right).forEach(s => {
        for (let θ = s.from + 0.25; θ < s.to; θ += 5) {
          n++;
          if (_holdEntryType(normA(θ + 180), crs, right) !== s.type) mismatch++;
        }
      });
    });
    // 인자로 넘긴 판정이 무장된 홀딩의 전역값을 건드리지 않는가
    holdCrs = 123; holdRight = true;
    _holdEntryType(0, 300, false);
    return { r: span(90, true), l: span(90, false), mismatch, n,
             keptCrs: holdCrs, keptRight: holdRight };
  });
  t.eq(sec.mismatch, 0, `부채꼴 색이 진입 판정과 일치 (${sec.n}점)`);
  t.ok(Math.abs(sec.r.DIRECT - 180) < 5 && Math.abs(sec.r.PARALLEL - 110) < 5 && Math.abs(sec.r.TEARDROP - 70) < 5,
    `우선회 부채꼴 폭 직진 ${sec.r.DIRECT}° · 평행 ${sec.r.PARALLEL}° · 눈물방울 ${sec.r.TEARDROP}°`);
  // 폭만 보면 세 구역의 자리가 바뀌어도 통과한다 — 경계 각도를 못박는다.
  // 인바운드 091°·좌선회: 픽스 기준 091~161 눈물방울 / 161~341 직진 / 341~091 평행
  const bnd = await page.evaluate(() => holdEntrySectors(toTrue(91), false)
    .map(s => `${s.type} ${Math.round(toMag(s.from))}~${Math.round(toMag(s.to))}`).join(' · '));
  t.eq(bnd, 'TEARDROP 91~161 · DIRECT 161~341 · PARALLEL 341~91',
    `구역 경계가 자리에 있다 (${bnd})`);

  // 경계 바로 양옆 — 여기가 어긋나면 그림과 판정이 따로 논다.
  // (종전에는 경계에 2° 여유를 둬서 090°M 접근이 눈물방울로 판정됐다)
  const edge = await page.evaluate(() => {
    const crsT = toTrue(91);   // 인바운드 091°M · 좌선회
    return [89, 90, 90.9, 91, 92, 160.9, 161, 340.9, 341].map(m =>
      m + ':' + _holdEntryType(normA(toTrue(m) + 180), crsT, false));
  });
  t.eq(edge.join(' '),
    '89:PARALLEL 90:PARALLEL 90.9:PARALLEL 91:TEARDROP 92:TEARDROP ' +
    '160.9:TEARDROP 161:DIRECT 340.9:DIRECT 341:PARALLEL',
    `경계가 자북 각도 그대로 갈린다 (${edge.join(' ')})`);
  const srt = w => JSON.stringify(Object.keys(w).sort().map(k => [k, w[k]]));
  t.eq(srt(sec.l), srt(sec.r), '좌선회도 같은 폭(거울상)');
  t.ok(sec.keptCrs === 123 && sec.keptRight === true, '인자로 판정해도 무장된 홀딩 값은 그대로');

  // 홀딩이 없으면 열리지 않는다(빈 원을 띄워 두면 없는 정보를 있는 척하게 된다)
  const none = await page.evaluate(() => {
    S.wps = []; holdExit();
    document.getElementById('map-wrap').classList.remove('hold-entry-on');
    toggleHoldEntry();
    return document.getElementById('map-wrap').classList.contains('hold-entry-on');
  });
  t.eq(none, false, '설정된 홀딩이 없으면 레이어가 열리지 않는다');

  // 비행계획에만 있고 아직 활성이 아닌 홀딩도 미리 볼 수 있어야 한다
  const shown = await page.evaluate(() => {
    const FIX = [37.0, 127.5];
    const A = destPoint(FIX[0], FIX[1], 45, 6);      // 픽스 북동 6NM
    S.lat = A[0]; S.lon = A[1]; S.hdg = 225; S.spd = 120;
    S.wps = [{ ident: 'ROKAN', lat: FIX[0], lon: FIX[1],
               hold: { dir: 'R', crs: 90, legType: 'TIME', legVal: 60 } }];
    S.awp = -1;                                       // 무장 전
    toggleHoldEntry();
    drawHoldEntry();
    const cv = document.getElementById('hold-entry-canvas');
    const g = cv.getContext('2d');
    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    let painted = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 8) painted++;
    return {
      on: document.getElementById('map-wrap').classList.contains('hold-entry-on'),
      btn: document.getElementById('map-hold-btn').classList.contains('active'),
      fix: document.getElementById('hold-entry-fix').textContent,
      info: document.getElementById('hold-entry-info').textContent,
      want: _holdEntryType(normA(bearing(FIX[0], FIX[1], S.lat, S.lon) + 180), 90, true),
      painted, total: cv.width * cv.height,
    };
  });
  t.eq(shown.on && shown.btn, true, '비행계획에만 있는 홀딩도 레이어가 열린다');
  t.ok(/ROKAN/.test(shown.fix) && /예정/.test(shown.fix),
    `픽스 이름과 아직 무장 전임을 함께 보여 준다 (${shown.fix})`);
  t.ok(shown.info.startsWith(shown.want),
    `판정이 시뮬과 같다 — ${shown.want} (${shown.info.split('\n')[0].slice(0, 24)})`);
  t.ok(shown.painted / shown.total > 0.3,
    `그림이 실제로 그려진다 (칠해진 화소 ${(100 * shown.painted / shown.total).toFixed(0)}%)`);
  t.eq(await page.evaluate(() => { toggleHoldEntry(); return document.getElementById('map-wrap').classList.contains('hold-entry-on'); }),
    false, '한 번 더 누르면 닫힌다');
}
