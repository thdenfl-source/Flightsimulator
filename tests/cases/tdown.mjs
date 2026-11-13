// T/DOWN(전환 강하) — FCP HHT 오른쪽 버튼(SIM).
// 50kt·전파고도 200ft 이상에서 누르면 FMA 컬렉티브·피치 축이 TDOWN, 3° 로 내려가며 속도를 0 으로 모아
// HHT 높이에서 멈춘다. 롤 축은 HDG·NAV 그대로 — 45kt 밑 황색, 30kt 밑 decouple.
// 함께: ALT·CRHT 는 글자 버튼, HHT ▲▼.
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = 'T/DOWN';   // TDOWN(제원 변경) · T/D to H

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const fma = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      const half = document.getElementById('pfd').width;   // 세 칸 모두(위쪽 줄)
      proto.fillText = function (tx, px, py, ...a) {
        if (px < half && py < 40) seen.push([String(tx).trim(), String(this.fillStyle)]);
        return orig.call(this, tx, px, py, ...a);
      };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen;
    };
    const o = {};
    // FCP — 옛 1행은 없앴고 SIMPLE 패널(늘 보임)의 ALT 버튼 · CR.HT 노브 PUSH · G/S 버튼 없음 · H.HT
    const altB = document.getElementById('fks-alt'), crB = document.querySelector('#fcp-simple [data-k="crht"] .fks-push');
    const lblOf = e => e.closest('.fks-cell').querySelector('.fks-lbl').textContent.trim();
    o.lbl = { alt: lblOf(altB), crht: lblOf(crB), altIsLbl: true,
              gs: !!document.getElementById('gs-btn'), td: !!document.getElementById('fks-tdh') };
    altB.click(); fcpsSync(); o.altOn = [altHoldOn, altB.classList.contains('on')]; altB.click(); o.altOff = altHoldOn;
    crB.click(); o.crOn = crhtOn; crB.click();
    selHht = 50; applyDelta('hht', 10); o.hhtUp = selHht; applyDelta('hht', -10);
    // TDOWN — 80kt · 전파고도 200ft 로 기준만 바꾼다(IAS 80 · CRHT 200)
    { const tb = document.getElementById('fks-tdown'), hb = document.getElementById('fks-tdh');
      o.order = tb.getBoundingClientRect().right <= hb.getBoundingClientRect().left + 1;
      o.tdTxt = [lblOf(tb), lblOf(hb)];
      S.alt = 1000; S.spd = 120; S.vs = 0; S.tq = tqRequired(); hdgSelOn = false;
      tb.click();
      o.set = { spd: selSpd, crht: selCrht, crhtOn, ias: simIasOn, td: tdOn, f: fma().map(x => x[0]) };
      fly(150);
      o.setFly = { ra: radarAltFt(), spd: S.spd };
      if (crhtOn) toggleCrht(); if (simIasOn) simIasRelease(); }
    // 조건 — 느리거나 낮으면 걸리지 않는다
    S.alt = 1000; S.spd = 40; tdhEngage(); o.slow = tdOn;
    S.spd = 100; S.alt = 150; tdhEngage(); o.low = tdOn;
    // 1000ft · 100kt · HDG 090 유지에서 누른다
    S.alt = 1000; S.spd = 100; S.hdg = 90; S.vs = 0; S.tq = tqRequired(); S.bnk = 0;
    selHdg = 90; hdgSelOn = true; rollApOn = true;
    const lat0 = S.lat, lon0 = S.lon;
    document.getElementById('fks-tdh').click(); document.getElementById('fks-tdh').click();
    o.off = tdOn;                                  // 한 번 더 누르면 풀린다
    S.spd = 100; S.alt = 1000; S.vs = 0;
    document.getElementById('fks-tdh').click();
    fcpsSync(); o.on = tdOn; o.btnOn = document.getElementById('fks-tdh').classList.contains('on');
    o.fma0 = fma().map(x => x[0]);
    let amber = null, decpl = null, hdgAt50 = null, maxVs = 0, path = [];
    for (let i = 0; i < 400; i++) {
      fly(1);
      maxVs = Math.max(maxVs, S.vs);
      if (hdgAt50 === null && S.spd < 50 && S.spd > 46) hdgAt50 = fma().find(x => x[0] === 'HDG');
      if (amber === null && S.spd < 44 && S.spd > 32) { amber = { f: fma().find(x => x[0] === 'HDG'), hdg: hdgSelOn, spd: S.spd }; }
      if (decpl === null && S.spd < 28) decpl = { hdg: hdgSelOn, roll: rollApOn, spd: S.spd };
      if (i === 60) path.push({ h: radarAltFt(), d: distance(lat0, lon0, S.lat, S.lon) });
      if (i === 120) path.push({ h: radarAltFt(), d: distance(lat0, lon0, S.lat, S.lon) });
      if (!tdOn) { o.doneAt = i; break; }
    }
    fly(30);
    o.end = { ra: radarAltFt(), gs: Math.hypot(gspdActFwd, gspdActLat), td: tdOn, gspd: gspdOn, crht: crhtOn, selCrht };
    o.fma1 = fma().map(x => x[0]);
    o.amber = amber; o.decpl = decpl; o.hdgAt50 = hdgAt50; o.maxVs = maxVs; o.path = path;
    // 맞바람 20kt — 땅 위 3° 로 내려가 그 자리에 멈춘다(바람에 흘러가지 않는다)
    if (gspdOn) toggleGspd(); if (crhtOn) toggleCrht();
    S.alt = 1000; S.spd = 100; S.hdg = 90; S.vs = 0; S.tq = tqRequired(); S.bnk = 0; simLat = 0;
    windDir = 90; windSpd = 20; hdgSelOn = true; rollApOn = true; selHdg = 90;
    const la = S.lat, lo = S.lon; let wp = [];
    tdhEngage(); o.wOn = tdOn;
    for (let i = 0; i < 500; i++) {
      fly(1);
      if (i === 40 || i === 90) wp.push({ h: radarAltFt(), d: distance(la, lo, S.lat, S.lon) });
      if (!tdOn) { o.wDone = i; break; }
    }
    fly(30);
    const l1 = S.lat, n1 = S.lon; fly(30);
    o.wind = { ra: radarAltFt(), drift: distance(l1, n1, S.lat, S.lon) * 6076.1, gspd: gspdOn, crht: crhtOn, wp };
    windSpd = 0; if (gspdOn) toggleGspd(); if (crhtOn) toggleCrht();
    toggleSimMode(false);
    return o;
  })()`);
  t.ok(r.lbl.alt === 'ALT' && r.lbl.crht === 'CR.HT', 'SIMPLE 패널의 ALT 버튼 · CR.HT 노브');
  t.ok(r.altOn[0] && r.altOn[1] && !r.altOff, 'ALT 를 누르면 걸리고(켜진 모양) 한 번 더 누르면 풀린다');
  t.eq(r.crOn, true, 'CR.HT 노브를 누르면 CRHT 가 걸린다');
  t.eq(r.lbl.gs, false, 'G/S 버튼은 없다(ILS 에서 스스로 잡는다)');
  t.eq(r.lbl.td, true, 'T/D to H 버튼이 있다');
  t.eq(r.hhtUp, 60, `HHT ▲ 는 10ft 씩 올린다 (${r.hhtUp})`);
  t.ok(r.order, 'T-DOWN 오른쪽에 T.D.HOV 버튼이 있다');
  t.eq(r.tdTxt.join('|'), 'T-DOWN|T.D.HOV', '버튼 이름(실기 AFCS 패널)');
  t.ok(r.set.spd === 80 && r.set.crht === 200 && r.set.crhtOn && r.set.ias && !r.set.td,
    `TDOWN 은 기준만 바꾼다 — IAS ${r.set.spd} · CRHT ${r.set.crht}`);
  t.ok(r.set.f.includes('CRHT') && r.set.f.includes('IAS') && !r.set.f.includes('TDH'), `FMA 는 CRHT · IAS (${r.set.f.join(' ')})`);
  t.ok(Math.abs(r.setFly.ra - 200) < 20 && Math.abs(r.setFly.spd - 80) < 6,
    `150초 뒤(CRHT 500fpm) 전파고도 200ft · 80kt 언저리 (${r.setFly.ra.toFixed(0)}ft · ${r.setFly.spd.toFixed(0)}kt)`);
  t.eq(r.slow, false, '50kt 미만이면 걸리지 않는다');
  t.eq(r.low, false, '전파고도 200ft 미만이면 걸리지 않는다');
  t.ok(r.on && r.btnOn, 'T/DOWN 을 누르면 걸리고 버튼이 켜진다');
  t.ok(r.fma0.filter(s => s === 'TDH').length >= 2, `FMA 컬렉티브·피치 축이 TDH (${r.fma0.join(' ')})`);
  t.ok(r.fma0.includes('HDG'), '롤 축은 HDG 가 그대로 몬다');
  t.ok(r.maxVs < 100, `오르지 않는다 (최대 ${r.maxVs.toFixed(0)}fpm)`);
  const p = r.path;
  const ang = Math.atan2(p[0].h - p[1].h, (p[1].d - p[0].d) * 6076.1) * 180 / Math.PI;
  t.ok(ang > 2 && ang < 4.5, `약 3° 로 내려간다 (${ang.toFixed(2)}°)`);
  t.ok(r.hdgAt50 && r.hdgAt50[1] === '#00ff88', `45kt 위에서는 HDG 가 녹색 (${r.hdgAt50 && r.hdgAt50[1]})`);
  t.ok(r.amber && r.amber.hdg && r.amber.f && r.amber.f[1] === '#ffcc00',
    `45kt 밑이면 HDG 가 황색(성능 감소) (${r.amber && r.amber.spd.toFixed(0)}kt ${r.amber && r.amber.f && r.amber.f[1]})`);
  t.ok(r.decpl && !r.decpl.hdg && !r.decpl.roll, `30kt 밑이면 롤 축이 풀린다 (${r.decpl && r.decpl.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(r.end.ra - 50) < 8, `HHT(50ft)에서 멈춘다 (RA ${r.end.ra.toFixed(0)}ft)`);
  t.ok(r.end.gs < 1.5, `지상속도가 0 에 모인다 (${r.end.gs.toFixed(1)}kt · ${r.doneAt}s)`);
  t.ok(!r.end.td && r.end.gspd && r.end.crht && r.end.selCrht === 50 && r.fma1.includes('CRHT') && r.fma1.includes('GS'),
    `다 내려오면 GSPD 0 + CRHT(HHT) 호버로 넘긴다 (${r.fma1.filter(x => /^(CRHT|GS|TDH)/.test(x)).join(' ')})`);
  t.ok(r.wOn && r.wind.gspd && r.wind.crht && Math.abs(r.wind.ra - 50) < 8,
    `맞바람 20kt 에서도 HHT 호버로 끝난다 (RA ${r.wind.ra.toFixed(0)}ft · ${r.wDone}s)`);
  t.ok(r.wind.drift < 15, `바람에 흘러가지 않는다 — 30초 동안 ${r.wind.drift.toFixed(1)}ft`);
  { const q = r.wind.wp; const a2 = Math.atan2(q[0].h - q[1].h, (q[1].d - q[0].d) * 6076.1) * 180 / Math.PI;
    t.ok(a2 > 2 && a2 < 4.5, `맞바람에서도 땅 기준 약 3° (${a2.toFixed(2)}°)`); }
  t.eq(r.off, false, '한 번 더 누르면 풀린다');

  await page.evaluate(() => {
    try { tdownRelease(); gaRelease(); } catch (e) {}
    if (simModeOn) toggleSimMode(false);
    navigator.getGamepads = () => [];
    joyAxes = {}; joyAxCancelCapture(); joyBinds = {}; joyReleaseAll();
    S.running = false; S.bnk = 0; S.pit = 0; S.vs = 0; hdgSelOn = false; rollApOn = false;
  });
}
