// 지도에서 항공기 끌기(북쪽 위 · 기수 위 모두 끈 쪽으로) · 교관 화면 페이지(교관 · PFD · UPPER · LOWER · CYC · COLL · MAP · COCKPIT)와 미러
export const name = '교관 화면 페이지 · 지도 끌기';

async function dragAc(page, dx, dy) {
  const b = await page.evaluate(() => { const r = acMarker.getElement().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(b.x, b.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + dx * i / 8, b.y + dy * i / 8);
  await page.mouse.up(); await page.waitForTimeout(150);
}

export async function run(page, t) {
  // ── 지도 끌기 ──
  await page.evaluate(() => { selectPanel('right', 'map', true); if (S.running) toggleSim(); if (followMode) toggleFollow(); if (mapHdgUp) toggleMapOrient(); S.hdg = 90; S.lat = 37.3; S.lon = 126.6; leafMap.setView([S.lat, S.lon], 12, { animate: false }); updateAcOnMap(); });
  await page.waitForTimeout(300);
  const p0 = await page.evaluate(() => ({ lat: S.lat, lon: S.lon }));
  await dragAc(page, 80, 0);
  const pN = await page.evaluate(() => ({ lat: S.lat, lon: S.lon }));
  t.ok(pN.lon - p0.lon > 0.001 && Math.abs(pN.lat - p0.lat) < (pN.lon - p0.lon) * 0.2, `북쪽 위 — 오른쪽으로 끌면 동쪽으로 (경도 +${(pN.lon - p0.lon).toFixed(4)})`);
  await page.evaluate(() => { toggleMapOrient(); S.hdg = 90; updateAcOnMap(); });
  await page.waitForTimeout(400);
  const p1 = await page.evaluate(() => ({ lat: S.lat, lon: S.lon }));
  await dragAc(page, 80, 0);                                  // 기수(동쪽)가 위 — 화면 오른쪽은 남쪽
  const pH = await page.evaluate(() => ({ lat: S.lat, lon: S.lon, up: mapHdgUp }));
  t.ok(pH.up && p1.lat - pH.lat > 0.0008 && Math.abs(pH.lon - p1.lon) < (p1.lat - pH.lat) * 0.35,
    `기수 위(HDG 090) — 오른쪽으로 끌면 화면 오른쪽(남쪽)으로 (위도 −${(p1.lat - pH.lat).toFixed(4)} · 경도 ${(pH.lon - p1.lon).toFixed(4)})`);
  await page.evaluate(() => { if (mapHdgUp) toggleMapOrient(); });

  // ── 교관 화면 페이지 ──
  const [ios] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => document.getElementById('map-ios-btn').click())]);
  await ios.waitForFunction(() => !!document.getElementById('ios-pages') && !!document.getElementById('ios-root'), null, { timeout: 20000 });
  const P = await ios.evaluate(() => [...document.querySelectorAll('#ios-pages [data-iosp]')].map(b => b.textContent));
  t.eq(P.join('|'), '교관|PFD|UPPER|LOWER|CYC · COLL|MAP|COCKPIT', '교관 화면 위 막대 — 교관 · PFD · UPPER · LOWER · CYC · COLL · MAP · COCKPIT');
  // 미러 — 교육생 창의 값이 교관 창에 그대로
  await page.evaluate(() => { S.alt = 2345; S.hdg = 123; S.spd = 88; ovhdSet('pitotHeat', 'AUTO'); });
  await ios.waitForFunction(() => S.alt === 2345 && S.hdg === 123 && ovhdGet('pitotHeat') === 'AUTO', null, { timeout: 8000 }).catch(() => {});
  const M = await ios.evaluate(() => ({ alt: S.alt, hdg: S.hdg, run: S.running, ov: ovhdGet('pitotHeat'), n: iosMirrorN }));
  t.ok(M.alt === 2345 && M.hdg === 123 && M.run === false && M.ov === 'AUTO' && M.n > 0, `미러 — 고도 ${M.alt} · 기수 ${M.hdg} · 콘솔 PITOT HEAT ${M.ov} · 교관 창은 스스로 계산하지 않는다`);
  // 페이지마다 그 화면
  const pg = async k => { await ios.evaluate(k => { document.querySelector(`#ios-pages [data-iosp="${k}"]`).click(); }, k); await ios.waitForTimeout(500);
    return ios.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return !!e && e.offsetParent !== null && e.getBoundingClientRect().height > 50; };
      return { ios: document.documentElement.classList.contains('ios-mode'), pfd: vis('pfd-wrap'), ovhd: vis('ovhd-wrap'), lcon: vis('lcon-wrap'), map: vis('map-wrap'),
        grip: !!document.querySelector('#ios-root .ios-grip svg') && getComputedStyle(document.querySelector('#ios-root .ios-grip')).display !== 'none', ck: !!window._cockpitOn };
    }); };
  const V = { pfd: await pg('pfd'), ovhd: await pg('ovhd'), lcon: await pg('lcon'), grip: await pg('grip'), map: await pg('map'), ck: await pg('cockpit') };
  t.ok(!V.pfd.ios && V.pfd.pfd, 'PFD 페이지 — PFD 화면 가득');
  t.ok(V.ovhd.ovhd && V.lcon.lcon, 'UPPER · LOWER 페이지 — 상부 · 하부 콘솔');
  t.ok(V.grip.ios && V.grip.grip, 'CYC · COLL 페이지 — 컬렉티브 · 사이클릭');
  t.ok(V.map.map && V.ck.ck, 'MAP · COCKPIT 페이지 — 지도 · 3D 조종석');
  // 교관 창에서 누른 조작이 교육생 창에 걸린다 — 콘솔 스위치 · 서치라이트
  await pg('ovhd');
  await ios.evaluate(() => ovhdSet('pitotHeat', 'OFF'));
  await pg('grip');
  await ios.evaluate(() => { const el = document.querySelector('#ios-root .ios-grip [data-kg="srchLt"]'); const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); });
  await page.waitForFunction(() => ovhdGet('pitotHeat') === 'OFF' && kgLt.srch === true, null, { timeout: 5000 }).catch(() => {});
  const C = await page.evaluate(() => ({ ov: ovhdGet('pitotHeat'), srch: kgLt.srch }));
  t.ok(C.ov === 'OFF' && C.srch === true, `교관 창에서 조작 — 콘솔 PITOT HEAT ${C.ov} · 서치라이트 ${C.srch ? 'ON' : 'OFF'} 가 교육생 창에 걸린다`);
  const back = await pg('ios');
  t.ok(back.ios && !back.ck, '교관 페이지로 돌아오면 원래 교관 화면');
  await page.evaluate(() => { kgSrchSet(false); });
  await ios.close();
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.ok(errs.length === 0, '오류 없음' + (errs.length ? ' — ' + errs.slice(0, 2).join(' / ') : ''));
}
