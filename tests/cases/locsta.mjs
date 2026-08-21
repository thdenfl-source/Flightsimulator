// 로컬라이저(ILS LOC) 표지소 — 자료·지도 표시·무선 튜닝
//
// 좌표를 옮겨 적는 일은 손이 미끄러지기 쉽다. 그래서 자료 스스로 앞뒤가 맞는지
// 기하로 확인한다 — LOC 안테나에서 GP 안테나를 본 방위는 '접근 코스의 반대' 여야
// 한다(GP 가 활주로 옆으로 100m 남짓 비켜 있어 몇 도 차이는 정상이다).
// 한 자리라도 잘못 찍으면 이 검사가 크게 어긋난다.
export const name = '로컬라이저 표지소';

// AIP AD 2.19 원문(도분초) — 코드와 무관한 기준값이다.
const AIP = {
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
};

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
                             lat: v.lat, lon: v.lon, crs: v.crs,
                             gp: v.gp ? { lat: v.gp.lat, lon: v.gp.lon } : null,
                             dme: v.dme ? { ch: v.dme.ch, elev: v.dme.elev } : null }))));
  t.ok(list && list.length === 14, `LOC ${list ? list.length : 0}개소가 실려 있다 (5개 공항)`);

  // ── AIP 원문 좌표와 한 자리씩 맞는가 ──
  let worst = 0, worstId = '';
  for (const v of list) {
    const a = AIP[v.id];
    if (!a) { t.ok(false, `${v.id} 는 원문에 없는 식별부호다`); continue; }
    const dLat = Math.abs(v.lat - dms(a[0])) * 3600;
    const dLon = Math.abs(v.lon - dms(a[1])) * 3600;
    const e = Math.max(dLat, dLon);
    if (e > worst) { worst = e; worstId = v.id; }
    if (v.crs !== a[2]) t.ok(false, `${v.id} 접근 코스 ${v.crs}° ≠ 원문 ${a[2]}°`);
  }
  t.ok(worst < 0.05, `모든 좌표가 AIP 원문과 같다 (최대 차이 ${worst.toFixed(3)}″ · ${worstId || '-'})`);
  t.ok(list.every(v => v.crs === AIP[v.id][2]), '접근 코스도 모두 원문과 같다');

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
  const byId = await page.evaluate(() => {
    setNavRadio('NAV2', null, 'IKPO');
    return { id: navRadios.NAV2.id, freq: navRadios.NAV2.freq, lat: navRadios.NAV2.lat };
  });
  t.ok(byId.id === 'IKPO' && byId.freq === '110.90' && Math.abs(byId.lat - 35.988083) < 1e-6,
    `식별부호로도 찾는다 (${byId.id} ${byId.freq})`);

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
