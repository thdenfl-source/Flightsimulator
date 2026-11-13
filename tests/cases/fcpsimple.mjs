// FCP SIMPLE — 실기 AFCS 조작 패널 모양 FCP(07-sim.js) + UPLIM 오른쪽 사용자 기능 영역. 옛 FCP 줄은 모두 없앴다(SIMPLE/FULL 구분 없음).
export const name = 'FCP SIMPLE';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const bar = document.querySelector('#pfd-wrap .ctrl-bar');
    const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
    const turn = (k, side) => { const el = document.querySelector(`#fcp-simple [data-k="${k}"] .fks-${side}`); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
    const o = {};
    // 옛 FCP 줄 · SIMPLE/FULL 탭은 없다 — FCP 는 이 패널 하나
    o.fullRows = !bar.querySelector('.ctrl-sub-row') && !document.getElementById('fcps-tog') && vis(document.getElementById('fcp-simple'))
      && !document.getElementById('spd-up') && !document.getElementById('sw-display') && !document.getElementById('obs-btn') && !document.getElementById('wdir-up');
    o.lbls = [...document.querySelectorAll('#fcp-simple .fks-main .fks-lbl')].map(e => e.textContent.trim()).filter(x => x && x !== ' ').join(',');
    // UPLIM 오른쪽 — 구분선 + 사용자 기능(바람 노브 · RNP · SIM SPD · 인터셉트 · 트림 · FORCE TRIM · G/A · GSPD · 페달)
    const x = document.querySelector('#fcp-simple .fks-x');
    o.xDiv = !!document.querySelector('#fcp-simple .fks-div2');
    o.x = ['[data-k="wdir"]', '[data-k="wspd"]', '#rnp-1', '#simspd-8', '#coll-up', '#trim-pad', '#force-trim-btn', '#ga-btn', '#gspd-btn', '#ped-l']
      .filter(sel => !x.querySelector(sel));
    o.noIcpt = !document.getElementById('icpt-btn');
    const r1 = x.querySelector('.fks-xr1'), r2 = x.querySelector('.fks-xr2');
    o.rows = { up: ['#force-trim-btn', '#ga-btn', '#gspd-btn', '#rnp-1', '#simspd-1'].every(q => r1.querySelector(q)),
               dn: ['#coll-up', '#trim-pad', '#ped-l'].every(q => r2.querySelector(q)) };
    const wd0 = windDir; turn('wdir', 'up'); o.wdir = (windDir - wd0 + 360) % 360; windDir = wd0;
    const ws0 = windSpd; turn('wspd', 'up'); o.wspd = windSpd - ws0; windSpd = ws0;
    // 노브 — 돌리면 지금 FCP 와 같은 값이 움직인다
    const hdg0 = selHdg; turn('hdg', 'up'); o.hdg = (selHdg - hdg0 + 360) % 360;
    const alt0 = selAlt; turn('alta', 'up'); o.alt = selAlt - alt0;
    const crht0 = selCrht; turn('crht', 'dn'); o.crht = selCrht - crht0;
    const hht0 = selHht; turn('hht', 'up'); o.hht = selHht - hht0;
    window._qnhHpa = 1013; turn('baro', 'up'); o.baro = window._qnhHpa;
    document.querySelector('#fcp-simple [data-k="baro"] .fks-push').click(); o.std = window._qnhHpa;
    // IN 으로 볼 때 — STD 는 29.92, 돌리면 0.01 inHg 씩
    pfdBaroUnit = 'IN'; fcpsSync(); o.stdIn = document.getElementById('fks-baro').textContent;
    const seen = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (tx, ...a) { seen.push(String(tx)); return orig.call(this, tx, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    o.pfdIn = seen.find(x => / IN$/.test(x)) || '';
    turn('baro', 'up'); fcpsSync(); o.inStep = document.getElementById('fks-baro').textContent;
    pfdBaroUnit = 'HPA'; window._qnhHpa = 1013.25;
    // 누름 · 버튼
    altHoldOn = false; document.getElementById('fks-alt').click(); o.altBtn = altHoldOn;
    fcpsSync(); o.altLit = document.getElementById('fks-alt').classList.contains('on');
    const nav0 = navApOn; document.getElementById('fks-navd').click(); o.navd = navApOn !== nav0; if (navApOn !== nav0) toggleNavAp();
    o.uplimOff = document.querySelector('#fcp-simple [data-k="uplim"]').classList.contains('fks-none');
    window._qnhHpa = 1013;
    return o;
  });
  t.ok(r.fullRows, '옛 FCP 줄 · SIMPLE/FULL 탭 · OBS/NAV · WDIR/WSPD ▲▼ · STOP WATCH 는 없다 — FCP 는 이 패널 하나');
  t.ok(r.xDiv && r.x.length === 0, `UPLIM 오른쪽 구분선 + 바람 노브 · RNP · SIM SPD · 트림 · FORCE TRIM · G/A · GSPD · 페달 (빠짐: ${r.x.join(',') || '없음'})`);
  t.ok(r.noIcpt && r.rows.up && r.rows.dn, '인터셉트 버튼은 없다 · 윗줄 RNP · SIM SPD · FORCE TRIM · G/A · GSPD / 아랫줄 COLLECTIVE TRIM · 4-WAY TRIM · 페달');
  t.ok(r.wdir === 5 && r.wspd === 1, `WIND DIR 노브 +5° · WIND SPD 노브 +1kt (${r.wdir} · ${r.wspd})`);
  t.eq(r.lbls, 'IAS,HDG,VS,ALT.A,ALT,CR.HT,NAVD CPL,T-DOWN,T.D.HOV,H.HT,BARO,UPLIM,CRS,DH', '사진의 배치(위 · 아래 · 오른쪽 BARO/UPLIM · CRS/DH)');
  t.ok(r.hdg === 1 && r.alt === 100 && r.crht === -10 && r.hht === 10, `노브를 돌리면 HDG +1 · ALT.A +100 · CR.HT −10 · H.HT +10 (${r.hdg} · ${r.alt} · ${r.crht} · ${r.hht})`);
  t.ok(r.baro === 1014 && r.std === 1013.25, `BARO — 돌리면 1 hPa, 누르면 STD 1013.25 hPa (${r.baro} → ${r.std})`);
  t.ok(r.stdIn === '29.92' && r.pfdIn === '29.92 IN' && r.inStep === '29.93', `IN 으로 보면 STD 29.92 · PFD 29.92 IN · 돌리면 0.01 (${r.stdIn} · ${r.pfdIn} · ${r.inStep})`);
  t.ok(r.altBtn && r.altLit, 'ALT 버튼 — ALT 유지가 걸리고 녹색으로 켜진다');
  t.ok(r.navd, 'NAVD CPL — NAV 결합(지금 FCP 의 NAV 와 같다)');
  t.ok(r.uplimOff, 'UPLIM · DH 는 아직 기능 없이 자리만');
}
