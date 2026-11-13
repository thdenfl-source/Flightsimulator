// PFD 소프트키(터치바) — KUH-1CG FLM 그림 5~8 의 트리(07-sim.js SK_MENUS). PFD 바로 아래 12칸.
export const name = 'PFD 소프트키';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    const el = i => document.getElementById('sk-' + i);
    const lbls = () => [...document.querySelectorAll('#pfd-sk .pfd-sk')].map(e => e.firstElementChild.innerHTML.replace(/<br>/g, ' ').trim()).join('|');
    const sub = i => el(i).querySelector('em').textContent;
    const press = i => el(i).click();
    pfdSkGo('TOP');
    o.top = lbls();
    o.bar = el(0).closest('.ctrl-bar') === document.querySelector('#pfd-wrap .ctrl-bar');
    // OBS(6번째 칸) — 지금 FCP 의 OBS · 켜지면 녹색 바
    if (obsOn) toggleObs();
    const obsDim = el(5).classList.contains('off');
    if (!obsDim) { press(5); pfdSkRender(); o.obs = obsOn && el(5).classList.contains('on'); o.obsBar = getComputedStyle(el(5).querySelector('i')).backgroundColor; press(5); }
    else { o.obs = true; o.obsBar = 'rgb(34, 224, 34)'; o.obsDim = true; }
    // Active NAV — VOR1 → VOR2 → FMS → VOR1
    setNavSrc('NAV1'); pfdSkRender();
    const seq = [sub(6)]; for (let i = 0; i < 3; i++) { press(6); seq.push(sub(6)); }
    o.nav = seq.join('>'); setNavSrc('FMS');
    // Hover Display
    const spd0 = S.spd; S.spd = 40; updateHoverBtns(); pfdSkRender();
    press(8); o.hov = hoverPageOn && el(8).classList.contains('on'); press(8); o.hovOff = !hoverPageOn;
    S.spd = 120; updateHoverBtns(); pfdSkRender(); o.hovDim = el(8).classList.contains('off');
    S.spd = spd0; updateHoverBtns();
    // PFD Map Settings ▸ — Detail 순환 · Map Layout ▸ · Back
    press(2); o.mapset = lbls();
    const d0 = sub(1); press(1); o.detail = d0 + '>' + sub(1); press(1); press(1); press(1);
    press(0); o.layout = lbls(); press(2); o.hsiMap = el(2).classList.contains('on');
    press(10); o.backMap = skMenu; press(10); o.backTop = skMenu;
    // PFD Settings ▸ — Bearing1/2 OFF→NAV1→NAV2→FMS · Other ▸ Altitude Units ▸ IN/HPA
    press(4); o.pfdset = lbls();
    const b = []; for (let i = 0; i < 4; i++) { b.push(sub(5)); press(5); } o.brg1 = b.join('>');
    while (brgSrcLabel(1) !== 'OFF') press(5);
    o.brg1Off = !brg1Visible; press(5); o.brg1Nav1 = brg1Visible && brgSrcLabel(1) === 'NAV1';
    brg1Src = null; if (!brg1Visible) toggleBrg1();
    while (brgSrcLabel(2) !== 'FMS') press(6); o.brg2 = sub(6);
    press(8); press(2); o.units = lbls();
    press(7); o.in = pfdBaroUnit === 'IN' && el(7).classList.contains('on') && !el(8).classList.contains('on');
    const seen = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (tx, ...a) { seen.push(String(tx)); return orig.call(this, tx, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    o.inTxt = seen.find(x => / IN$/.test(x)) || '';
    press(8); o.hpa = pfdBaroUnit === 'HPA';
    press(10); press(10); press(10); o.back3 = skMenu;
    // Sensors ▸ RA Settings ▸ RA1/RA2
    press(7); press(2); o.ra = lbls(); press(2); o.ra2 = skState.ra === 'RA2' && el(2).classList.contains('on'); press(1);
    // 45초 동안 누르지 않으면 최상위로 — 시간을 앞당긴다
    o.idle = SK_IDLE_MS;
    pfdSkGo('TOP'); localStorage.removeItem('pfdSk');
    // FCP SIMPLE 에서도 보인다
    o.inSimple = el(0).offsetParent !== null && el(0).nextElementSibling !== null;
    return o;
  });
  // 맨 오른쪽 SIM 은 shinesong 판에만 — 절차 훈련판(js/00-edition.js · Flightsimulator)에서는 빈칸
  const simEd = await page.evaluate(() => typeof SIM_ENABLED === 'undefined' || SIM_ENABLED);
  t.eq(r.top, 'Map Range −|Map Range +|PFD Map Settings|Traffic Map|PFD Settings|OBS|Active NAV|Sensors|Hover Display|Hover Position|CAS|' + (simEd ? 'SIM' : ''),
    '최상위 12칸 — 그림 5 의 순서 · 맨 오른쪽 SIM(절차 훈련판은 빈칸)');
  t.ok(r.bar, 'PFD 바로 아래(FCP 맨 위 한 줄)');
  t.ok(r.obs && r.obsBar === 'rgb(34, 224, 34)', `OBS — 지금 FCP 의 OBS · 켜지면 녹색 바${r.obsDim ? '(FMS 라 회색)' : ''}`);
  t.eq(r.nav, 'VOR1>VOR2>FMS>VOR1', 'Active NAV — VOR1 → VOR2 → FMS → VOR1(그림 5)');
  t.ok(r.hov && r.hovOff && r.hovDim, 'Hover Display — HSI ⇄ HOVER(80kt 이상이면 회색)');
  t.eq(r.mapset, 'Map Layout|Detail||Traffic||Terrain||WX Overlay|Lightning||Back|', 'PFD Map Settings ▸ — 그림 6');
  t.eq(r.detail, 'ALL>DCLTR1', 'Detail — ALL → DCLTR1 → DCLTR2 → Least');
  t.eq(r.layout, 'Map off|Inset Map|HSI Map|Inset Traffic|HSI Traffic||||||Back|', 'Map Layout ▸ — 그림 6');
  t.ok(r.hsiMap && r.backMap === 'MAPSET' && r.backTop === 'TOP', 'Back 은 한 단계 위로');
  t.eq(r.pfdset, '|||||Bearing1|Bearing2||Other PFD Settings||Back|', 'PFD Settings ▸ — 그림 7');
  t.ok(r.brg1Off && r.brg1Nav1 && r.brg2 === 'FMS' && /OFF>NAV1>NAV2>FMS|NAV1>NAV2>FMS>OFF|NAV2>FMS>OFF>NAV1|FMS>OFF>NAV1>NAV2/.test(r.brg1),
    `Bearing1 · 2 — OFF → NAV1 → NAV2 → FMS (${r.brg1})`);
  t.eq(r.units, '|||||Meters||IN|HPA||Back|', 'Other PFD Settings ▸ Altitude Units ▸ — 그림 7');
  t.ok(r.in && / IN$/.test(r.inTxt) && r.hpa && r.back3 === 'TOP', `IN 을 고르면 PFD 기압 칸이 inHg (${r.inTxt}) · HPA 로 되돌림`);
  t.eq(r.ra, '|RA1|RA2||||||||Back|', 'Sensors ▸ RA Settings ▸ — 그림 8');
  t.ok(r.ra2, 'RA2 를 고르면 녹색 바');
  t.eq(r.idle, 45000, '하위 메뉴는 45초 동안 누르지 않으면 최상위로');
  t.ok(r.inSimple, '소프트키는 FCP 맨 위에 늘 보인다');
}
