// ATC 관제석(41-atc.js) — ASR · PAR(활공로 · 중심선 · GCA 문구) · 관제 지시 · 협동 비행 방에서 관제사로
export const name = 'ATC 관제석';

export async function run(page, t) {
  const A = await page.evaluate(async () => {
    const o = {}, keep = { lat: S.lat, lon: S.lon, alt: S.alt, hdg: S.hdg, spd: S.spd, vs: S.vs }, w = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'atc'); await w(300);
    const wrap = document.getElementById('atc-wrap');
    o.shown = !wrap.classList.contains('page-hidden') && !!wrap.querySelector('#atc-root') && atc.shown;
    o.apts = atcAirports().length; atc.apt = 'RKPK'; atc.rwy = '36L'; atc.own = true; atcPanelSync(true);
    const E = atcRwy(); o.rwy = E && E.id; o.hdg = E && Math.round(E.hdg);
    // 접지점 뒤 5NM · 3° 활공로 · 중심선 위
    const back = (E.hdg + 180) % 360; const [la, lo] = destPoint(E.td.lat, E.td.lon, back, 5);
    S.lat = la; S.lon = lo; S.alt = E.elev + 5 * 6076 * Math.tan(3 * Math.PI / 180); S.hdg = E.hdg; S.spd = 90; S.vs = -480;
    const own = atcTarget('OWN'); let P = atcPar(own);
    o.on = { R: P.R, inCov: P.inCov, el: P.elevTxt, az: P.azTxt, corr: P.corr };
    o.talkOn = atcTalk(own);
    // 왼쪽으로 0.1NM · 높이 +150ft → slightly 가 아니라 left · above, 오른쪽으로 돌라고
    const [l2, o2] = destPoint(S.lat, S.lon, (E.hdg + 270) % 360, 0.1); S.lat = l2; S.lon = o2; S.alt += 150;
    P = atcPar(atcTarget('OWN')); o.off = { el: P.elevTxt, az: P.azTxt, corr: P.corr }; o.talkOff = atcTalk(atcTarget('OWN'));
    // 너무 낮게 · 가까이
    const [l3, o3] = destPoint(E.td.lat, E.td.lon, back, 1.5); S.lat = l3; S.lon = o3; S.alt = E.elev + 100;
    o.low = atcTalk(atcTarget('OWN'));
    // 범위 밖(활주로 반대쪽)
    const [l4, o4] = destPoint(E.td.lat, E.td.lon, E.hdg, 4); S.lat = l4; S.lon = o4; S.alt = 2000; o.out = atcPar(atcTarget('OWN')).inCov === false && atcTalk(atcTarget('OWN')) === null;
    // 지시 — 내 기체면 이 기기에서 읽는다
    const said = [], sp = window.speak; window.speak = x => { said.push(x); return true; };
    atc.sel = 'OWN'; atcPanelSync(true);
    const R = document.getElementById('atc-root');
    R.querySelector('[data-atcv="ihdg"]').value = '270'; R.querySelector('[data-at="say:hdg"]').click();
    R.querySelector('[data-atcv="ialt"]').value = '3000'; R.querySelector('[data-at="say:alt"]').click();
    R.querySelector('[data-at="say:contact"]').click();
    o.said = said.slice(); o.log = atc.log.length >= 3;
    window.speak = sp;
    // 그리기 — ASR · PAR 둘 다
    atc.view = 'both'; _atcDraw(); const cv = R.querySelector('.atc-asr'), cp = R.querySelector('.atc-par');
    const lit = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 1; i < d.length; i += 16) if (d[i] > 120) n++; return n; };
    o.asr = cv.width > 50 && lit(cv) > 20; o.par = cp.width > 50 && lit(cp) > 20;
    o.tabs = document.querySelectorAll('.page-tab.atc-tab').length >= 3 && TOOLS.some(([, f]) => f === 'openAtc');
    Object.assign(S, keep); selectPanel('right', 'map');
    return o;
  });
  t.ok(A.shown && A.apts >= 5, `창 위 ATC 탭 — 관제석이 뜬다(활주로 자료가 있는 공항 ${A.apts}곳)`);
  t.ok(A.rwy === '36L' && Math.abs(((A.hdg - 360 + 540) % 360) - 180) < 10, `RKPK RWY 36L — 접근 방향 ${A.hdg}°(진방위)`);
  t.ok(Math.abs(A.on.R - 5) < 0.05 && A.on.inCov && A.on.el === 'on glidepath' && A.on.az === 'on course' && A.on.corr === 0 && /5 miles from touchdown, on course, on glidepath/.test(A.talkOn),
    `PAR — 5NM 활공로 · 중심선 위: “${A.talkOn}”`);
  t.ok(/left of course/.test(A.off.az) && /above glidepath/.test(A.off.el) && A.off.corr > 0 && /turn right heading/.test(A.talkOff), `벗어나면 — “${A.talkOff}”`);
  t.ok(/below glidepath/.test(A.low) && /missed approach/.test(A.low) && A.out, `너무 낮으면 복행 권고 · 범위 밖은 문구 없음 (“${A.low}”)`);
  t.ok(A.said.some(x => /turn left heading 2 7 0|turn right heading 2 7 0/.test(x)) && A.said.some(x => /and maintain 3000 feet/.test(x)) && A.said.some(x => /radar contact/.test(x)) && A.log,
    `관제 지시 — 내 기체면 읽어 준다(${A.said.length}개) · 교신 기록`);
  t.ok(A.asr && A.par && A.tabs, 'ASR · PAR 화면을 그린다 · 탭 · 🧰 도구');

  // ── 멀티 관제 — 관제사 창 + 조종사 창(같은 브라우저 · BroadcastChannel) ──
  const noNet = () => { window._rtcLinkFactory = () => ({ ready: false, pub() {}, close() {} }); };
  await page.evaluate(noNet);
  const code = await page.evaluate(() => { const c = wingCreate(); wingLeave(true); wingJoin(c, { role: 'atc' }); atc.apt = 'RKPK'; atc.rwy = '36L'; atc.own = true; return c; });
  const [p2] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => { window.open(location.href, '_blank'); })]);
  await p2.waitForFunction(() => typeof wingJoin === 'function' && typeof atcOnWing === 'function', null, { timeout: 30000 });
  await p2.evaluate(noNet);
  await p2.evaluate(c => { appSet.callsign = 'Shine two'; S.alt = 2500; wingJoin(c); wingSend(true); }, code);
  await page.waitForFunction(() => traffic.some(x => x.remote && x.cs === 'Shine two'), null, { timeout: 10000 }).catch(() => {});
  await p2.waitForFunction(() => Object.values(wing.ctl || {}).some(c => /RKPK APP/.test(c.name)), null, { timeout: 10000 }).catch(() => {});
  const M = await page.evaluate(() => {
    const o = {}; o.noOwn = !atcTargets().some(x => x.kind === 'own');   // 관제사 기기는 제 기체를 보이지 않는다
    const t = atcTargets().find(x => x.cs === 'Shine two'); o.tgt = !!t;
    if (t) { atc.sel = t.id; atcSend(t, atcPhrase('alt', t, { alt: 3000 })); }
    return o;
  });
  const said2 = await p2.evaluate(() => { window.__said = []; const sp = window.speak; window.speak = x => { window.__said.push(x); return sp(x); }; return true; });
  await page.evaluate(() => { const t = atcTargets().find(x => x.cs === 'Shine two'); if (t) atcSend(t, atcPhrase('hdg', t, { hdg: 90 })); });
  await p2.waitForFunction(() => document.getElementById('atc-reply') && getComputedStyle(document.getElementById('atc-reply')).display === 'flex', null, { timeout: 8000 }).catch(() => {});
  const P2 = await p2.evaluate(() => ({ ctl: Object.values(wing.ctl || {}).map(c => c.name).join(), card: !!document.getElementById('atc-reply') && /heading 0 9 0/.test(document.getElementById('atc-reply').textContent), said: (window.__said || []).some(x => /heading 0 9 0/.test(x)) }));
  await p2.evaluate(() => document.querySelector('#atc-reply [data-atr="WILCO"]').click());
  await page.waitForFunction(() => atc.log.some(l => l.dir === '◀' && /Shine two: WILCO/.test(l.txt)), null, { timeout: 8000 }).catch(() => {});
  const back = await page.evaluate(() => atc.log.some(l => l.dir === '◀' && /Shine two: WILCO/.test(l.txt)));
  await p2.evaluate(() => wingLeave()); await p2.close();
  await page.evaluate(() => { wingLeave(); delete window._rtcLinkFactory; appSet.callsign = 'Coastguard zero one'; });
  t.ok(M.noOwn && M.tgt && /RKPK APP/.test(P2.ctl), `관제사로 참가 — 제 기체는 빼고 조종사 기체를 표적으로 · 조종사 기기에 관제 시설(${P2.ctl})`);
  t.ok(P2.card && P2.said && back, '지시가 조종사 기기에 가서 읽히고(답 카드) · WILCO 가 관제사 교신 기록에 돌아온다');
  const errs = (page.errors || []).filter(e => !/Failed to fetch|NetworkError|tile/i.test(e));
  t.eq(errs.length, 0, `페이지 오류 없음${errs.length ? ' — ' + errs[0] : ''}`);
}
