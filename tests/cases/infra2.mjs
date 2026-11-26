// 보완 묶음 — 공항 접근코드 해시 · 삼킨 예외 기능별 집계 · NVG 관 시야 · 지도 미리 받기(오프라인) · 타일 캐시 보존
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';
export const name = '보완 — 접근코드 · 진단 · NVG · 지도 미리 받기';

const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export async function run(page, t) {
  // ── ① 공항 ALL 접근코드 — 소스에 평문이 없고, 해시로 견준다 ──
  const src = fs.readFileSync(path.join(ROOT, 'js/09b-cdu-screens.js'), 'utf8');
  t.ok(!/['"]thdenfl['"]/.test(src), '공항 ALL 접근코드가 소스에 평문으로 없다');
  const ac = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'cdu'); await w(200);
    switchMode('AIRFIELD'); await w(150);
    const keepP = window.uiPrompt, keepA = window.uiAlert;
    const btn = () => document.querySelector('[data-act="afldToggleAll"]');
    const o = { hasBtn: !!btn() };
    window.uiAlert = () => Promise.resolve();
    window.uiPrompt = () => Promise.resolve('wrong'); btn().click(); await w(200); o.bad = btn().textContent.trim();
    window.uiPrompt = () => Promise.resolve('thdenfl'); btn().click(); await w(200); o.good = btn().textContent.trim();
    btn().click(); await w(150); o.off = btn().textContent.trim();
    window.uiPrompt = keepP; window.uiAlert = keepA;
    o.hash = window.vfrSha256('abc');
    return o;
  });
  t.ok(ac.hasBtn && ac.bad === 'ALL' && ac.good === 'ALL ✓' && ac.off === 'ALL', `틀린 코드는 열리지 않고 맞는 코드는 열린다 (${ac.bad} → ${ac.good} → ${ac.off})`);
  t.eq(ac.hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 셈이 맞다(abc)');

  // ── ② 삼킨 예외 — 파일(기능)별 누적 · 반복 고장 의심 ──
  const dg = await page.evaluate(() => {
    const n0 = _SWALLOW_N;
    for (let i = 0; i < 150; i++) { try { null.x; } catch (e) { _swallow(e); } }
    const by = _swallowByFile();
    const mine = by.find(r => r.top.some(x => /null|reading/.test(x.msg)));
    const hit = diagSpikeCheck(Date.now()), hit2 = diagSpikeCheck(Date.now());
    toggleDiag();
    const html = document.getElementById('diag-wrap').innerHTML, txt = diagText();
    document.getElementById('diag-wrap').style.display = 'none';
    return { add: _SWALLOW_N - n0, file: mine && mine.file, n: mine && mine.n, label: mine ? diagFileLabel(mine.file) : '', spike: hit.length > 0, again: hit2.length,
             html: /기능별 누적/.test(html), txt: /기능별 누적/.test(txt), err: _DIAG_ERR.some(e => /반복 고장 의심/.test(e.msg)) };
  });
  t.ok(dg.add === 150 && dg.n >= 150 && dg.file, `삼킨 예외를 파일(기능)별로 센다 — ${dg.label}(${dg.file}) ${dg.n}회`);
  t.ok(dg.spike && dg.again === 0 && dg.err, '10초에 100번 넘게 삼키면 "반복 고장 의심" 을 한 번만 남긴다');
  t.ok(dg.html && dg.txt, '진단 기록 화면 · 복사 글에 기능별 누적이 나온다');

  // ── ⑬ NVG — 관 시야 · 알갱이 · 불빛 번짐 ──
  const nv = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    if (!_view3dOn) toggle3dMap();
    let n = 0; while (!(_ml3d && _ml3d.getLayer('heli-3d')) && n < 200) { await w(50); n++; }
    const nvg0 = env.nvg;
    envSet({ nvg: true }); await w(100);
    const el = document.querySelector('#map3d .env-nvg'), cs = el && getComputedStyle(el), after = el && getComputedStyle(el, '::after');
    const fx = document.querySelector('#map3d .env-fx');
    const o = { el: !!el, shown: cs && cs.display !== 'none', grad: cs && /radial-gradient/.test(cs.backgroundImage), grain: after && /svg/.test(after.backgroundImage),
                anim: after && after.animationName, fxF: fx ? getComputedStyle(fx).filter : '', halo: NVG_HALO_K, own: extLightState(0.05).nvg };
    envSet({ nvg: false }); await w(100);
    o.off = el && getComputedStyle(el).display === 'none';
    envSet({ nvg: nvg0 });
    return o;
  });
  t.ok(nv.el && nv.shown && nv.grad && nv.off, 'NVG 를 켜면 둥근 관 시야(40°)가 3D 위에 깔리고 끄면 사라진다');
  t.ok(nv.grain && nv.anim === 'env-nvg-grain', 'NVG 알갱이(scintillation)가 움직인다');
  t.ok(/hue-rotate/.test(nv.fxF) && nv.halo > 1.5 && nv.own === true, `불빛 겹(env-fx)도 녹색 · 불빛 번짐 ${nv.halo}배`);

  // ── ⑱ 작전 구역 지도 미리 받기 ──
  // 타일 서버는 페이지 안에서 흉내 낸다(서비스 워커를 거치는 요청은 playwright 의 route 로 잡히지 않는다)
  const tp = await page.evaluate(async (b64) => {
    const png = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const realFetch = window.fetch;
    window.fetch = (u, o2) => /arcgisonline\.com|elevation-tiles-prod/.test(String(u)) ? Promise.resolve(new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })) : realFetch(u, o2);
    const o = {};
    const L = tilesAreaList(35.0, 129.0, 10);
    o.n = L.length; o.kinds = [...new Set(L.map(x => x.kind))].join(',');
    o.zs = [Math.min(...L.map(x => x.z)), Math.max(...L.filter(x => x.kind === 'sat').map(x => x.z)), Math.max(...L.filter(x => x.kind === 'dem').map(x => x.z))];
    o.sorted = L.every((x, i) => i === 0 || L[i - 1].z <= x.z);
    o.big = tilesAreaList(35.0, 129.0, 120).length > TILE_PREP_MAX;
    o.refuse = (await tilesPrefetch(tilesAreaList(35.0, 129.0, 120))).ok === false;
    await tileCacheClear();
    const small = tilesAreaList(35.0, 129.0, 3, { satMin: 10, satMax: 11, demMin: 10, demMax: 10 });
    o.small = small.length;
    const r1 = await tilesPrefetch(small);
    const c = await caches.open('vfr-sat-tiles'), s0 = small.find(x => x.kind === 'sat');
    o.both = !!(await c.match(s0.url)) && !!(await c.match(s0.alt));
    const r2 = await tilesPrefetch(small);
    o.r1 = r1; o.r2 = r2; o.stats = await tileCacheStats();
    toggleTilePrep(); o.panel = /작전 구역 지도/.test(document.getElementById('tileprep-wrap').textContent); toggleTilePrep();
    o.tool = TOOLS.some(([, f]) => f === 'toggleTilePrep') && typeof window.toggleTilePrep === 'function';
    // 항로 따라 · 저장한 지역
    const R = tilesRouteList([{ lat: 35.0, lon: 129.0 }, { lat: 35.3, lon: 129.0 }], 3, { satMin: 10, satMax: 11, demMin: 10, demMax: 10 });
    const one = tilesAreaList(35.0, 129.0, 3, { satMin: 10, satMax: 11, demMin: 10, demMax: 10 });
    o.route = R.length > one.length && new Set(R.map(t => t.kind + t.z + '/' + t.x + '/' + t.y)).size === R.length;
    localStorage.removeItem('tileAreas'); tileAreaAdd('제주 기지', 33.5, 126.5, 20); tileAreaAdd('부산', 35.1, 129.0, 10); tileAreaAdd('제주 기지', 33.51, 126.5, 30);
    const A = tileAreas(); o.areas = A.length === 2 && A[0].name === '제주 기지' && A[0].nm === 30;
    toggleTilePrep(); const tw = document.getElementById('tileprep-wrap');
    o.areaBtn = tw.querySelectorAll('[data-tp^="src:area:"]').length === 2 && !!tw.querySelector('[data-tp="save"]');
    tw.querySelector('[data-tp="src:area:1"]').click(); await new Promise(r => setTimeout(r, 50));
    o.areaEst = _tpEst(20).n === tilesAreaList(35.1, 129.0, 10).length;
    _tpSrc = 'here'; toggleTilePrep(); localStorage.removeItem('tileAreas');
    await tileCacheClear();
    window.fetch = realFetch;
    return o;
  }, PNG1.toString('base64'));
  t.ok(tp.kinds === 'sat,dem' && tp.zs.join(',') === '8,14,12' && tp.sorted, `반경 10NM — 위성 8~14 · 지형 8~12 단계 ${tp.n}장, 넓은 단계부터`);
  t.ok(tp.big && tp.refuse, `한 번에 받는 양을 묶는다(120NM 은 거절)`);
  t.ok(tp.r1.ok && tp.r1.done === tp.small && tp.r1.fail === 0 && tp.both, `받은 위성 사진은 3D · 2D 두 이름으로 넣는다 (${tp.r1.done}장)`);
  t.ok(tp.r2.have === tp.small && tp.stats.sat > 0 && tp.stats.dem > 0, `이미 받은 것은 다시 받지 않는다 (있음 ${tp.r2.have}/${tp.small} · 위성 ${tp.stats.sat} · 지형 ${tp.stats.dem})`);
  t.ok(tp.route && tp.areas && tp.areaBtn && tp.areaEst, `항로 따라 받기(겹침 없이) · 자주 쓰는 지역 저장 · 고르면 그 지역 기준 (${tp.route} ${tp.areas} ${tp.areaBtn} ${tp.areaEst})`);
  t.ok(tp.panel && tp.tool, '🧰 도구 메뉴에 "지도 미리 받기" 창이 있다');

  // 서비스 워커는 판이 바뀌어도 타일 캐시를 지우지 않는다
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  t.ok(/TILE_CACHES\s*=\s*\['vfr-sat-tiles', 'vfr-dem-tiles', 'vfr-tiles'\]/.test(sw) && /!TILE_CACHES\.includes\(k\)/.test(sw),
    '서비스 워커가 새 판으로 바뀌어도 지도 타일 캐시는 남긴다');
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
