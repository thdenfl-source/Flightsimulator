// PWR — 동력-속도 곡선(js/46-pwrcurve.js) · 흰수리 FLM 성능: 요구 토크 U 곡선 · MTA − 블리드 · ΔTQ → 상승/강하율
export const name = 'PWR 동력-속도 곡선';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const o = {};
    const tabs = [...document.querySelectorAll('#page-tabs .page-tab')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.sel);
    o.tab = tabs.includes('pwr');
    const sel0 = panelGet('right'); selectPanel('right', 'pwr'); await new Promise(res => setTimeout(res, 450));
    const w = document.getElementById('pwr-wrap'), c = w && w.querySelector('canvas');
    o.shown = !!w && !w.classList.contains('page-hidden') && c.width > 100;
    if (o.shown) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++; o.lit = lit; }
    // U 곡선 — 호버 > Vy 최소 < 150kt · Vy 가 가장 낮다
    const st = pwrState(), cv = st.curve;
    o.u = { h: cv(0), vy: cv(st.vy), v150: cv(150), vyKt: st.vy };
    o.uOk = cv(0) > cv(st.vy) + 10 && cv(150) > cv(st.vy) + 10 && [st.vy - 25, st.vy + 25].every(v => cv(v) >= cv(st.vy) - 0.3);
    // 블리드 — ENG ANTI ICE 둘 −14 · HEATER −4 · 모두 −18
    const m0 = pwrState().mta;
    ovhdSet('engAi1', 'ON'); ovhdSet('engAi2', 'ON'); const mAi = pwrState().mta;
    ovhdSet('ecsMode', 'HEAT'); const mBoth = pwrState().mta;
    ovhdSet('engAi1', 'OFF'); ovhdSet('engAi2', 'OFF'); const mHeat = pwrState().mta; ovhdSet('ecsMode', 'OFF');
    o.bleed = [m0 - mAi, m0 - mBoth, m0 - mHeat].map(v => +v.toFixed(1));
    // ΔTQ → 상승 · 강하율(FLM 표) — SIM 에서 인가 토크를 요구보다 높이고 낮춘다
    S.alt = 3000; S.spd = 70; toggleSimMode(true, { ground: false });
    const req = pwrState().req, up = perfTqForVs(1000), dn = perfTqForVs(-1000);
    S.tq = req + up; const a = pwrState(); S.tq = req + dn; const b = pwrState();
    o.vs = { up: Math.round(a.predVs), dn: Math.round(b.predVs), tqUp: +up.toFixed(1), tqDn: +dn.toFixed(1), dUp: +a.dTq.toFixed(1) };
    o.vsOk = Math.abs(a.predVs - 1000) < 30 && Math.abs(b.predVs + 1000) < 30;
    o.rocMax = st.rocMax > 0;
    toggleSimMode(false); selectPanel('right', sel0);
    return o;
  });
  t.ok(r.tab && r.shown && r.lit > 10, `위 창 탭 PWR — 동력-속도 곡선 화면이 뜬다 (${r.lit})`);
  t.ok(r.uOk, `요구 토크 U 곡선 — 호버 ${r.u.h.toFixed(0)}% > Vy ${r.u.vyKt.toFixed(0)}kt 최소 ${r.u.vy.toFixed(0)}% < 150kt ${r.u.v150.toFixed(0)}%`);
  t.ok(r.bleed[0] === 14 && r.bleed[1] === 18 && r.bleed[2] === 4, `블리드 에어 — ENG ANTI ICE −14% · 모두 −18% · HEATER −4% (${r.bleed.join(' · ')})`);
  t.ok(r.vsOk && r.rocMax, `ΔTQ → 상승률/강하율(FLM 표 · +${r.vs.tqUp}% → ${r.vs.up}fpm · ${r.vs.tqDn}% → ${r.vs.dn}fpm)`);
  t.ok(page.errors.length === 0, `오류 없음${page.errors.length ? ' — ' + page.errors.join(' / ') : ''}`);
}
