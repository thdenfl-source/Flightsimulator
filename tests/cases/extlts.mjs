// 외부 등화(15-heli3d.js extLightState) — 상부 콘솔 POSITION LTS · ANTI COLLISION LTS 와 연동
//   위치표시등: 노브 1~5 · STEADY/OFF/FLASH · 충돌방지등: UPPER/BOTH/LOWER · DIM/OFF/BRT
//   밝기: DISPLAY DAY 100% · NIGHT 50% · NVG 30% · 충돌방지등(BRT)은 위치표시등의 2배
export const name = '외부 등화(위치 · 충돌방지등)';

async function pixel(page, x, y) {
  const png = (await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } })).toString('base64');
  return page.evaluate(async (png) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data.slice(0, 3));
  }, png);
}

export async function run(page, t) {
  const kuh = await page.evaluate(() => !H3_B206);
  if (!kuh) { t.ok(true, 'Bell 206 · R22 — 상부 콘솔이 없어 건너뜀'); return; }
  const r = await page.evaluate(() => {
    const set = o => Object.entries(o).forEach(([k, v]) => ovhdSet(k, v));
    const keep = ['display', 'posLts', 'posMode', 'acolSel', 'acolMode', 'navLts', 'acolNorm'].reduce((a, k) => (a[k] = ovhdGet(k), a), {});
    const nvg0 = env.nvg; env.nvg = false;
    const o = {};
    // 처음 — 위치표시등 STEADY · 충돌방지등 OFF
    set({ display: 'DAY', posLts: '5', posMode: 'STEADY', acolSel: 'BOTH', acolMode: 'OFF', navLts: 'NORM', acolNorm: 'NORM' });
    let s = extLightState(0.05); o.def = { pos: s.pos.k, lit: s.pos.lit, acol: s.acol.on, n: s.pts.length };
    // 충돌방지등 BRT — 위치표시등의 2배
    set({ acolMode: 'BRT' }); s = extLightState(0.05); o.brt = { pos: s.pos.k, acol: s.acol.k, n: s.pts.length, ids: s.pts.map(p => p.id).join(',') };
    o.brtOff = extLightState(0.6).acol.lit;          // 번쩍 사이에는 꺼져 있다
    set({ acolMode: 'DIM' }); o.dim = extLightState(0.05).acol.k;
    set({ acolMode: 'BRT', acolSel: 'UPPER' }); o.upper = extLightState(0.05).pts.filter(p => p.id.startsWith('acol')).map(p => p.id).join(',');
    set({ acolSel: 'LOWER' }); o.lower = extLightState(0.05).pts.filter(p => p.id.startsWith('acol')).map(p => p.id).join(',');
    set({ acolSel: 'BOTH' });
    // DISPLAY — DAY 100 · NIGHT 50 · NVG 30 %
    o.disp = {};
    for (const d of ['DAY', 'NIGHT', 'NVG']) { set({ display: d }); const q = extLightState(0.05); o.disp[d] = { pos: q.pos.k, acol: q.acol.k }; }
    set({ display: 'DAY' });
    // 노브 — 5칸 중 몇 칸 · 충돌방지등은 늘 그 2배
    set({ posLts: '1' }); s = extLightState(0.05); o.knob1 = { pos: s.pos.k, acol: s.acol.k };
    set({ posLts: '5' });
    // FLASH — 반은 켜지고 반은 꺼진다 · OFF
    set({ posMode: 'FLASH' }); o.flash = [extLightState(0.2).pos.lit, extLightState(1.0).pos.lit];
    set({ posMode: 'OFF' }); s = extLightState(0.05); o.off = { on: s.pos.on, acolStill: s.acol.on };
    set({ posMode: 'STEADY' });
    // IR — 맨눈에는 안 보이고 NVG 일 때만
    set({ navLts: 'IR', acolNorm: 'IR' }); o.irBare = extLightState(0.05).pts.length;
    env.nvg = true; o.irNvg = extLightState(0.05).pts.length; env.nvg = false;
    set({ navLts: 'NORM', acolNorm: 'NORM' });
    // DC 전원이 없으면 꺼진다
    const pd = pwrDc; pwrDc = () => false; o.noPwr = extLightState(0.05).pts.length; pwrDc = pd;
    set(keep); env.nvg = nvg0;
    return o;
  });
  const n2 = v => +v.toFixed(3);
  t.ok(r.def.lit && r.def.pos > 0 && !r.def.acol && r.def.n === 3, `처음 — 위치표시등 셋(빨강 · 초록 · 흰) 켜짐 · 충돌방지등 꺼짐 (${r.def.n}개)`);
  t.ok(n2(r.brt.acol) === n2(2 * r.brt.pos) && r.brt.n === 5, `충돌방지등 BRT 는 위치표시등의 2배 (${r.brt.acol} = 2 × ${r.brt.pos}) · 위아래 둘 (${r.brt.ids})`);
  t.ok(!r.brtOff, '충돌방지등은 번쩍인다(사이에는 꺼짐)');
  t.ok(n2(r.dim) === n2(r.brt.acol / 2), `DIM 은 BRT 의 반 (${r.dim})`);
  t.eq([r.upper, r.lower].join('|'), 'acolU|acolD', 'UPPER · LOWER 선택');
  t.ok(n2(r.disp.NIGHT.pos) === n2(r.disp.DAY.pos * 0.5) && n2(r.disp.NVG.pos) === n2(r.disp.DAY.pos * 0.3)
    && n2(r.disp.NIGHT.acol) === n2(r.disp.DAY.acol * 0.5) && n2(r.disp.NVG.acol) === n2(r.disp.DAY.acol * 0.3),
    `DISPLAY — DAY ${r.disp.DAY.pos}/${r.disp.DAY.acol} · NIGHT ${r.disp.NIGHT.pos}/${r.disp.NIGHT.acol} · NVG ${r.disp.NVG.pos}/${r.disp.NVG.acol} (100 · 50 · 30 %)`);
  t.ok(n2(r.knob1.pos) === n2(r.disp.DAY.pos / 5) && n2(r.knob1.acol) === n2(2 * r.knob1.pos), `노브 1 — 위치표시등 ${r.knob1.pos} · 충돌방지등 ${r.knob1.acol}`);
  t.eq(r.flash.join(','), 'true,false', 'FLASH — 켜졌다 꺼졌다');
  t.ok(!r.off.on && r.off.acolStill, 'POSITION OFF — 위치표시등만 꺼진다');
  t.ok(r.irBare === 0 && r.irNvg === 5, `IR — 맨눈 ${r.irBare}개 · NVG ${r.irNvg}개`);
  t.eq(r.noPwr, 0, 'DC 전원이 없으면 모두 꺼진다');

  // ── 3D 모형에 실제로 빛난다 — 위에서 내려다보고 왼쪽 위치표시등 바깥 자리의 빨강을 OFF 와 견준다 ──
  const geo = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    window.__pfdOvWas = pfdOvOn; pfdOvOn = false; pfdOverlaySync();
    if (typeof simModeOn !== 'undefined' && simModeOn) toggleSimMode(false);
    if (mapHdgUp) toggleMapOrient();
    if (followMode) toggleFollow();
    S.lat = 37.0; S.lon = 126.0; S.hdg = 0; S.alt = 0; S.spd = 0; S.pit = 0; S.bnk = 0; bankTarget = 0; S.running = false;
    if (!_view3dOn) toggle3dMap();
    let n = 0; while (!(_ml3d && _ml3d.getLayer('heli-3d')) && n < 200) { await w(50); n++; }
    if (!_ml3d) return null;
    _ml3d.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    _ml3d.jumpTo({ center: [S.lon, S.lat], zoom: 20, pitch: 0, bearing: 0 });
    ovhdSet('display', 'DAY'); ovhdSet('posLts', '5'); ovhdSet('acolMode', 'OFF'); ovhdSet('posMode', 'OFF');
    _ml3d.triggerRepaint(); await w(600);
    const p = _ml3d.project([S.lon + -2.75 / (111320 * Math.cos(S.lat * Math.PI / 180)), S.lat + 0.4 / 111320]);
    const b = document.getElementById('map3d').getBoundingClientRect();
    return { x: b.left + p.x, y: b.top + p.y };
  });
  if (!geo) { t.ok(false, '3D 지도가 뜨지 않았다'); return; }
  const off = await pixel(page, geo.x, geo.y);
  await page.evaluate(async () => { ovhdSet('posMode', 'STEADY'); _ml3d.triggerRepaint(); await new Promise(r => setTimeout(r, 600)); });
  const on = await pixel(page, geo.x, geo.y);
  await page.evaluate(() => { pfdOvOn = window.__pfdOvWas; pfdOverlaySync(); });
  t.ok(on[0] - off[0] > 25 && on[0] > on[1] + 20, `3D 모형 왼쪽 위치표시등이 빨갛게 빛난다 (OFF ${off} → ON ${on})`);
  // ── 밤 · 황혼 — 3D 지도 그림은 CSS 로 어둡게 깎이므로(brightness 0.22) 빛 무리는 그 위 겹(env-fx)에 그린다 ──
  const nt = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const lit = () => { const cv = document.querySelector('#map3d .env-fx'); if (!cv || !cv.width) return 0;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; };
    const tod0 = env.tod, o = {};
    ovhdSet('display', 'DAY'); ovhdSet('posLts', '5'); ovhdSet('acolMode', 'OFF');
    for (const tod of ['NIGHT', 'DUSK']) {
      envSet({ tod }); ovhdSet('posMode', 'STEADY'); _ml3d.triggerRepaint(); await w(600);
      o[tod] = { lit: lit(), n: _h3LtScr ? _h3LtScr.pts.length : 0 };
    }
    envSet({ tod: 'NIGHT' }); ovhdSet('posMode', 'OFF'); _ml3d.triggerRepaint(); await w(600); o.off = lit();
    ovhdSet('posMode', 'STEADY'); envSet({ tod: 'DAY' }); _ml3d.triggerRepaint(); await w(400); o.day = _h3LtScr;
    envSet({ tod: tod0 });
    return o;
  });
  t.ok(nt.NIGHT.n === 3 && nt.NIGHT.lit > 50 && nt.DUSK.n === 3 && nt.DUSK.lit > 30,
    `밤 · 황혼에도 위치표시등이 빛난다 — 어둡게 깎이지 않는 겹에 빛 무리 (밤 ${nt.NIGHT.lit} · 황혼 ${nt.DUSK.lit}점)`);
  t.ok(nt.off < 5 && nt.day === null, `OFF 면 밤에도 빛 무리가 없다(${nt.off}) · 낮에는 종전처럼 모형 위에 그린다`);

  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
