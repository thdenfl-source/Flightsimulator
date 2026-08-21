// 로컬라이저(ILS LOC) 표지소 — 자료·지도 표시·무선 튜닝
//
// 좌표를 옮겨 적는 일은 손이 미끄러지기 쉽다. 그래서 자료 스스로 앞뒤가 맞는지
// 기하로 확인한다 — LOC 안테나에서 GP 안테나를 본 방위는 '접근 코스의 반대' 여야
// 한다(GP 가 활주로 옆으로 100m 남짓 비켜 있어 몇 도 차이는 정상이다).
// 한 자리라도 잘못 찍으면 이 검사가 크게 어긋난다.
export const name = '로컬라이저 표지소';

// AIP AD 2.19 원문(도분초) — 코드와 무관한 기준값이다.
const AIP = {
  // ── 1차: 김포·청주·대구·울진·포항 ──
  IOFR: ['373245.5N', '1264812.9E', 143],
  ISEL: ['373244.6N', '1264834.7E', 143],
  ISKP: ['373421.7N', '1264632.8E', 323],
  IKMO: ['373413.4N', '1264622.6E', 323],
  ICHG: ['364230.0N', '1272902.6E', 240],
  ICHL: ['364222.1N', '1272904.9E', 240],
  ICHJ: ['364336.6N', '1273050.1E', 60],
  ICHR: ['364328.7N', '1273052.4E', 60],
  ITAG: ['355408.1N', '1283834.3E', 312],
  IDAG: ['355411.6N', '1283837.0E', 312],
  ITGL: ['355306.0N', '1284026.6E', 132],
  IUJS: ['364600.3N', '1292756.7E', 171],
  IUJN: ['364714.4N', '1292728.0E', 351],
  IKPO: ['355917.1N', '1292602.4E', 97],
  // ── 2차: 성남·인천·울산·사천·김해·정석·제주·양양·원주·여수·군산·광주·무안 ──
  // crs 가 null 인 것은 AIP 에 접근 코스가 실리지 않아 산출한 값이다(crsSrc 로 밝힌다).
  ISOL: ['372546.4N', '1270636.3E', null], ISUL: ['372552.6N', '1270653.5E', null],
  IRFS: ['372620.6N', '1262623.4E', null], IRFN: ['372815.5N', '1262441.1E', null],
  INRR: ['372910.0N', '1262617.6E', null], IRKS: ['372628.5N', '1262637.1E', null],
  IRKN: ['372829.9N', '1262449.1E', null], ISRR: ['372707.4N', '1262746.0E', null],
  INLL: ['372902.2N', '1262603.9E', null], ISLL: ['372715.1N', '1262759.7E', null],
  IULS: ['353616.3N', '1292102.9E', 4],
  ISAM: ['350550.6N', '1280502.0E', null], ISHA: ['350452.6N', '1280318.8E', null],
  IKMA: ['351147.6N', '1285605.2E', null], IKHE: ['351148.2N', '1285613.5E', null],
  IJDG: ['332422.7N', '1264241.2E', null],
  ICJU: ['333058.7N', '1263001.6E', 65],   ICHE: ['332954.4N', '1262756.4E', 245],
  IYAN: ['380419.6N', '1283929.0E', 330],
  IWNJ: ['372705.3N', '1275807.6E', null], IWON: ['372529.0N', '1275707.8E', null],
  IYSO: ['344952.0N', '1273721.9E', 165],  IYSU: ['345113.0N', '1273642.2E', 345],
  IKUZ: ['355507.5N', '1263644.4E', 356],  IVPR: ['355319.8N', '1263710.0E', 176],
  IMDG: ['350821.5N', '1264909.4E', 37],   IMDH: ['350644.3N', '1264801.3E', 217],
  IMUN: ['350023.1N', '1262257.8E', 7],    IMAN: ['345835.0N', '1262258.5E', 187],
};
// 같은 활주로 양끝의 LOC — 두 안테나 모두 중심선 연장선 위에 있다.
// 이 방위가 곧 접근 코스이므로, 게재값·산출값을 함께 검증하는 가장 좋은 잣대다.
const PAIRS = [['ISLL','INRR'], ['ISRR','INLL'], ['IRKS','IRKN'], ['IRFS','IRFN'],
               ['IYSO','IYSU'], ['IKUZ','IVPR'], ['IMUN','IMAN'], ['ICJU','ICHE'],
               ['ISAM','ISHA'], ['IWNJ','IWON'], ['IOFR','IKMO'], ['ISEL','ISKP'],
               ['ICHG','ICHJ'], ['ICHL','ICHR'], ['ITAG','ITGL'], ['IUJS','IUJN']];

function dms(s) {
  const hemi = s.slice(-1), body = s.slice(0, -1);
  const lat = hemi === 'N' || hemi === 'S';
  const d = +body.slice(0, lat ? 2 : 3);
  const m = +body.slice(lat ? 2 : 3, lat ? 4 : 5);
  const sec = +body.slice(lat ? 4 : 5);
  return d + m / 60 + sec / 3600;
}

export async function run(page, t) {
  const list = await page.evaluate(() => (typeof LOC_STATIONS === 'undefined' ? null :
    LOC_STATIONS.map(v => ({ apt: v.apt, rwy: v.rwy, id: v.id, freq: v.freq,
                             lat: v.lat, lon: v.lon, crs: v.crs, crsSrc: v.crsSrc || null,
                             gp: v.gp ? { lat: v.gp.lat, lon: v.gp.lon } : null,
                             dme: v.dme ? { ch: v.dme.ch, elev: v.dme.elev } : null }))));
  const apts = new Set(list.map(v => v.apt));
  t.ok(list && list.length === 43, `LOC ${list ? list.length : 0}개소가 실려 있다`);
  t.eq(apts.size, 18, `${apts.size}개 공항`);
  t.eq(list.filter(v => AIP[v.id] === undefined).map(v => v.id).join(','), '',
    '원문에 없는 식별부호가 없다');
  const ids = list.map(v => v.id);
  t.eq(ids.filter((x, i) => ids.indexOf(x) !== i).join(','), '', '식별부호가 겹치지 않는다');

  // ── AIP 원문 좌표와 한 자리씩 맞는가 ──
  let worst = 0, worstId = '';
  for (const v of list) {
    const a = AIP[v.id];
    if (!a) { t.ok(false, `${v.id} 는 원문에 없는 식별부호다`); continue; }
    const dLat = Math.abs(v.lat - dms(a[0])) * 3600;
    const dLon = Math.abs(v.lon - dms(a[1])) * 3600;
    const e = Math.max(dLat, dLon);
    if (e > worst) { worst = e; worstId = v.id; }
    if (a[2] !== null && v.crs !== a[2]) t.ok(false, `${v.id} 접근 코스 ${v.crs}° ≠ 원문 ${a[2]}°`);
  }
  t.ok(worst < 0.05, `모든 좌표가 AIP 원문과 같다 (최대 차이 ${worst.toFixed(3)}″ · ${worstId || '-'})`);
  const pub = list.filter(v => AIP[v.id][2] !== null);
  t.ok(pub.every(v => v.crs === AIP[v.id][2]),
    `게재 접근 코스 ${pub.length}건이 모두 원문과 같다`);
  t.ok(list.every(v => (AIP[v.id][2] === null) === !!v.crsSrc),
    '게재값이 없는 것만 crsSrc 로 산출임을 밝힌다');

  // ── 같은 활주로 양끝 LOC 로 접근 코스를 검증한다 ──
  // 두 안테나 모두 중심선 연장선 위에 있으므로 기준선이 수 km 다.
  // 게재값이든 산출값이든 이 방위와 맞아야 한다.
  const byId = Object.fromEntries(list.map(v => [v.id, v]));
  const pairChk = await page.evaluate((rows) => rows.map(([a, b]) => {
    const A = a, B = b;
    return { a: A.id, b: B.id,
             // B 안테나 → A 안테나 방위가 A 로 접근하는 코스
             seen: toMag(bearing(B.lat, B.lon, A.lat, A.lon)),
             crsA: A.crs, crsB: B.crs };
  }), PAIRS.map(([a, b]) => [byId[a], byId[b]]).filter(p => p[0] && p[1]));
  const pd = pairChk.map(p => ({
    nm: `${p.a}/${p.b}`,
    da: Math.abs(((p.seen - p.crsA + 540) % 360) - 180),
    db: Math.abs(((p.seen + 180 - p.crsB + 540) % 360) - 180) }));
  t.eq(pd.length, 16, `같은 활주로 양끝 LOC 짝 ${pd.length}쌍을 대조한다`);
  const wrong = pd.filter(p => p.da > 3 || p.db > 3);
  t.eq(wrong.length, 0,
    `짝지은 두 안테나를 잇는 방위가 양쪽 접근 코스와 맞는다 ` +
    `(최대 ${Math.max(...pd.flatMap(p => [p.da, p.db])).toFixed(1)}°` +
    (wrong.length ? ` — 어긋남: ${wrong.map(p => p.nm).join(',')}` : '') + ')');
  t.ok(pd.every(p => Math.abs(p.da - p.db) < 0.001),
    '한 쌍의 두 코스가 정확히 180° 마주 본다');

  // ── 자료 스스로 앞뒤가 맞는가 (LOC → GP 방위 = 접근 코스의 반대) ──
  const geo = await page.evaluate((rows) => rows.map(v => ({
    id: v.id,
    // LOC 안테나에서 GP 안테나를 본 자북 방위
    seen: toMag(bearing(v.lat, v.lon, v.gp.lat, v.gp.lon)),
    want: normA(v.crs + 180),
  })), list.filter(v => v.gp));
  const off = geo.map(g => ({ id: g.id, d: Math.abs(((g.seen - g.want + 540) % 360) - 180) }));
  const bad = off.filter(o => o.d > 6);
  t.eq(bad.length, 0,
    `LOC→GP 방위가 접근 코스의 반대와 맞는다 (최대 ${Math.max(...off.map(o => o.d)).toFixed(1)}° · ` +
    `GP 가 활주로 옆으로 비켜 있어 몇 도는 정상)`);

  // ── 같은 공항 안에서 짝이 맞는가 ──
  const rkss = list.filter(v => v.apt === 'RKSS');
  t.eq(rkss.length, 4, '김포는 LOC 4개(14R·14L·32R·32L)');
  const rksi = list.filter(v => v.apt === 'RKSI');
  t.eq(rksi.length, 8, '인천은 LOC 8개(평행 활주로 4본)');
  t.ok(new Set(rksi.map(v => v.crs)).size === 2,
    `인천 8개는 두 방향뿐이다 (${[...new Set(rksi.map(v => v.crs))].sort((x, y) => x - y).join('°/')}°M)`);
  t.ok(rkss.filter(v => v.crs === 143).length === 2 && rkss.filter(v => v.crs === 323).length === 2,
    '김포 접근 코스가 143°/323° 로 짝을 이룬다');
  const pair = list.filter(v => v.apt === 'RKTN' && v.freq === '108.70');
  t.eq(pair.length, 2, `대구 31L·13R 은 같은 주파수(108.70)를 쓴다 (${pair.map(v => v.id).join('·')})`);

  // ── 주파수를 넣으면 NAV 가 그 국을 잡는가 ──
  // 종전에는 VOR 목록에만 있어 ILS 주파수를 넣어도 국을 못 찾고 조용히 넘어갔다.
  const tune = await page.evaluate(() => {
    setNavRadio('NAV1', '109.90', null);       // 김포 14L ISEL
    setNavSrc('NAV1');
    const r = navRadios.NAV1;
    return { id: r.id, lat: r.lat, lon: r.lon, loc: r.loc, crs: r.crs,
             obsM: Math.round(toMag(vorObsCrs)),
             navLat, navIcao,
             lineM: Math.round(toMag(courseCrsHere(activeCourseLine()))) };
  });
  t.eq(tune.id, 'ISEL', `109.90 을 넣으면 ISEL 이 잡힌다 (${tune.id})`);
  t.ok(Math.abs(tune.lat - 37.545722) < 1e-6, '좌표도 그 국의 것이다');
  t.eq(tune.loc, true, '로컬라이저로 표시된다');
  t.eq(tune.obsM, 143, `튜닝하면 OBS 코스가 접근 코스로 맞춰진다 (${tune.obsM}°M)`);
  t.eq(tune.lineM, 143, `코스선도 143°M 로 잡힌다 (${tune.lineM}°M)`);

  // 식별부호로도 찾힌다
  const tuneById = await page.evaluate(() => {
    setNavRadio('NAV2', null, 'IKPO');
    return { id: navRadios.NAV2.id, freq: navRadios.NAV2.freq, lat: navRadios.NAV2.lat };
  });
  t.ok(tuneById.id === 'IKPO' && tuneById.freq === '110.90' && Math.abs(tuneById.lat - 35.988083) < 1e-6,
    `식별부호로도 찾는다 (${tuneById.id} ${tuneById.freq})`);

  // VOR 이 먼저다 — 같은 주파수대라도 VOR 을 밀어내면 안 된다
  const vorFirst = await page.evaluate(() => {
    setNavRadio('NAV1', '115.5', null);
    return navRadios.NAV1.id;
  });
  t.eq(vorFirst, 'SEL', `VOR 주파수는 종전대로 VOR 을 잡는다 (${vorFirst})`);

  // ── 지도에 그려지는가 ──
  const map = await page.evaluate(async () => {
    awyCat.loc = true; _drawAwyLayer();
    await new Promise(r => setTimeout(r, 80));
    const els = Array.from(document.querySelectorAll('.leaflet-marker-icon'))
      .map(e => (e.textContent || '').trim());
    const hit = ['ISEL 109.90', 'ICHG 111.70', 'IUJS 111.15'].filter(x => els.some(e => e.includes(x)));
    awyCat.loc = false; _drawAwyLayer();
    await new Promise(r => setTimeout(r, 80));
    // 튜닝한 국 표시(NAV1:ISEL)는 별개 레이어라 남는다 — 이 레이어의 이름표만 본다
    const after = Array.from(document.querySelectorAll('.leaflet-marker-icon'))
      .some(e => (e.textContent || '').includes('ISEL 109.90'));
    return { hit, gone: !after };
  });
  t.eq(map.hit.length, 3, `지도에 식별부호와 주파수가 함께 나온다 (${map.hit.join(' / ')})`);
  t.eq(map.gone, true, '레이어를 끄면 사라진다');

  // 뒷정리
  await page.evaluate(() => { setNavSrc('FMS'); });
}
