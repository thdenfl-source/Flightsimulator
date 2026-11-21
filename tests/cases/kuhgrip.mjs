// (누르는 동안 이어지는 조작은 흐른 시간만큼 움직인다 — 머리 없는 3D 는 한 장면이 길어 타이머가 드물게 오므로 한 걸음씩 직접 부른다)
// 흰수리 컬렉티브 · 사이클릭(35-kuhgrip.js) — 조종석에 작게 · 누르면 크게 · LDG LT · SRCH LT · COLL TRIM · 사이클릭 단추
export const name = '흰수리 컬렉티브 · 사이클릭';

export async function run(page, t) {
  await page.evaluate(() => { S.spd = 0; S.alt = 300; cockpitStart(); });
  await page.waitForFunction(() => !!document.getElementById('kg-mini-coll') && document.getElementById('sim-ckpit').classList.contains('show'), null, { timeout: 15000 });
  const M = await page.evaluate(() => {
    const ids = ['kg-mini-coll', 'kg-mini-cycL', 'kg-mini-cycR'].map(i => document.getElementById(i));
    const cdu = document.getElementById('ck-mini-cdu').getBoundingClientRect(), c = ids[0].getBoundingClientRect();
    return { all: ids.every(e => e && e.querySelector('svg')), right: c.left >= cdu.right - 2, svgCyc: /DISENGAG/.test(ids[2].innerHTML) && /4-WAY BEEP/.test(ids[2].innerHTML) };
  });
  t.ok(M.all && M.right && M.svgCyc, '조종석 — 컬렉티브(CDU 오른쪽) · 좌우 사이클릭(실기 그립 모양)을 그린다');
  // 부조종사석(왼쪽) 컬렉티브 — 왼쪽 사이클릭 왼쪽에 · 누르면 같은 컬렉티브 큰 창
  const L = await page.evaluate(() => { const l = document.getElementById('kg-mini-collL'), c = document.getElementById('kg-mini-cycL');
    return { has: !!l && /SRCH/.test(l.innerHTML), left: !!l && !!c && l.getBoundingClientRect().right <= c.getBoundingClientRect().left + 2 }; });
  const ml = await page.locator('#kg-mini-collL').boundingBox();
  await page.mouse.click(ml.x + ml.width / 2, ml.y + 20); await page.waitForTimeout(250);
  const LP = await page.evaluate(() => { const p = document.getElementById('kg-pop'); const r = { shown: !!p && getComputedStyle(p).display === 'flex', t: p && p.querySelector('.kgp-t').textContent }; kgPop(null); return r; });
  t.ok(L.has && L.left && LP.shown && LP.t === 'COLLECTIVE', '부조종사석(왼쪽)에도 컬렉티브 — 누르면 같은 컬렉티브 큰 창');
  // 작은 컬렉티브를 누르면 큰 창
  const mc = await page.locator('#kg-mini-coll').boundingBox();
  await page.mouse.click(mc.x + mc.width / 2, mc.y + 20);
  await page.waitForTimeout(250);
  const pop = await page.evaluate(() => { const p = document.getElementById('kg-pop'); return { shown: !!p && getComputedStyle(p).display === 'flex', t: p && p.querySelector('.kgp-t').textContent, h: p && p.getBoundingClientRect().height }; });
  t.ok(pop.shown && pop.t === 'COLLECTIVE' && pop.h > 300, `작은 컬렉티브를 누르면 크게 뜬다 (높이 ${Math.round(pop.h)}px)`);
  // 큰 창의 SRCH LT 를 실제로 눌러 본다
  const sl = await page.locator('#kg-pop-body [data-kg="srchLt"]').boundingBox();
  await page.mouse.click(sl.x + sl.width / 2, sl.y + sl.height / 2); await page.waitForTimeout(150);
  const on1 = await page.evaluate(() => kgLt.srch);
  t.ok(on1 === true, 'SRCH LT 를 누르면 서치라이트가 켜진다');
  const C = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
    const ra = window.radarAltFt; window.radarAltFt = () => 300;
    // LDG LT — ON/OFF · EXT 누르는 동안 펼친다 · RET 로 접는다
    envSet({ ldg: false }); kgLt.ldgE = 0; kgLt.ldgTgt = null;
    const msg = () => pfdMsgs().filter(m => /^(LDG|SRCH) LT ON$/.test(m.t)).map(m => m.t + ':' + m.c).join(',');
    { const sr = kgLt.srch; kgSrchSet(false); o.msg0 = msg(); kgSrchSet(true); o.msgS = msg(); kgSrchSet(sr); }
    kgPress('ldgOn'); o.ldgOn = env.ldg === true;
    { const sr = kgLt.srch; kgSrchSet(false); o.msgL = msg(); kgSrchSet(sr); }
    // 접혀 있다가 켜면 저절로 전방 30°(아래로 30°)까지 펼친다
    for (let i = 0; i < 60 && kgLt.ldgTgt !== null; i++) await w(50);
    o.auto = kgLdgDown();
    // 착륙등은 서치라이트보다 밝고 더 멀리 닿는다
    { const L = kgBeams().find(b => b.az === 0 && b.k > 1); o.ldgBeam = L ? { k: L.k, reach: L.reach } : null; }
    kgPress('ldgExt'); _kgHold.tl -= 300; _kgHold.step(); _kgHoldStop(); o.ext = kgLdgDown();
    kgPress('ldgRet'); _kgHold.tl -= 100; _kgHold.step(); _kgHoldStop(); o.ret = kgLdgDown() > o.ext;
    // 켜고 끄기는 자리를 그대로 둔다
    const e0 = kgLt.ldgE; kgPress('ldgOn'); kgPress('ldgOn'); await w(150); o.keep = Math.abs(kgLt.ldgE - e0) < 1e-6 && env.ldg === true;
    // 높이 1500ft · 아래로 5° — 종전(600m)에는 닿지 않던 먼 앞도 비춘다
    { const p0 = S.pit; S.pit = 0; window.radarAltFt = () => 1500; kgLt.ldgE = 75; o.far = envBeams().some(b => _envDist(S.lat, S.lon, b.lat, b.lon).d > 1200); window.radarAltFt = () => 300; kgLt.ldgE = e0; S.pit = p0; }
    o.srchMin = KG_SRCH.elMin; o.grn = PFD_MSG_GREEN;
    // 상부 콘솔 STOW SEL — 3방향 스프링(가운데) · LDG 로 젖히면 착륙등 OFF · 접기 / SRCH 로 젖히면 서치라이트 OFF · 원위치
    { const d = _ovhdDefs.stowSel; o.stowDef = d.t + '|' + d.pos.join(',') + '|' + ovhdGet('stowSel'); }
    kgSrchSet(true); kgLt.az = 40; kgLt.el = 50;
    ovhdSet('stowSel', 'LDG'); ovhdSet('stowSel', 'CTR');
    for (let i = 0; i < 80 && kgLt.ldgTgt !== null; i++) await w(50);
    o.stowL = { off: env.ldg === false, e: kgLt.ldgE, srch: kgLt.srch };
    ovhdSet('stowSel', 'SRCH'); ovhdSet('stowSel', 'CTR');
    o.stowS = { off: !kgLt.srch, az: kgLt.az, el: kgLt.el, sw: ovhdGet('stowSel') };
    kgPress('ldgOn'); for (let i = 0; i < 60 && kgLt.ldgTgt !== null; i++) await w(50); o.reOn = kgLdgDown(); kgSrchSet(true);
    // SRCH CTR — 오른쪽으로 돌리고 아래로
    kgLt.az = 0; kgLt.el = 30; kgPress('srchR'); _kgHold.tl -= 300; _kgHold.step(); _kgHoldStop(); kgPress('srchD'); _kgHold.tl -= 300; _kgHold.step(); _kgHoldStop();
    o.az = kgLt.az; o.el = kgLt.el;
    o.beams = kgBeams().length; o.env = envBeams().length;
    // 서치라이트 빛은 기수 오른쪽에 떨어진다
    const b = envBeams().map(x => { const v = _envDist(S.lat, S.lon, x.lat, x.lon); return ((Math.atan2(v.e, v.n) * 180 / Math.PI - S.hdg) % 360 + 360) % 360; });
    o.right = b.some(a => a > 5 && a < 90);
    // COLL TRIM — 누르는 동안 VS ±100 씩
    const ad = applyDelta, calls = []; applyDelta = (f, d) => calls.push([f, d]);
    kgPress('collUp'); _kgHold.step(); _kgHold.step(); _kgHoldStop(); kgPress('collDn'); _kgHoldStop();
    applyDelta = ad; o.coll = { up: calls.filter(c => c[0] === 'vs' && c[1] === 100).length, dn: calls.filter(c => c[0] === 'vs' && c[1] === -100).length };
    // 사이클릭 — DISENGAG · FORCE TRIM · 4-WAY BEEP · PTT · G/SPEED
    const log = [], keep = { afcsReleaseAll, forceTrim, forceTrimRelease, startTrimHold, stopTrimHold, radioPtt, toggleGspd };
    afcsReleaseAll = () => log.push('dis'); forceTrim = () => log.push('ftr'); forceTrimRelease = () => log.push('ftr-'); startTrimHold = d => log.push('beep' + d);
    stopTrimHold = () => log.push('beep-'); radioPtt = on => log.push('ptt' + (on ? '+' : '-')); toggleGspd = () => log.push('gspd');
    for (const k of ['apDis', 'ftr', 'beepF', 'beepL', 'ptt', 'gspd']) { kgPress(k); await w(60); _kgHoldStop(); }
    Object.assign(window, keep); afcsReleaseAll = keep.afcsReleaseAll; forceTrim = keep.forceTrim; forceTrimRelease = keep.forceTrimRelease;
    startTrimHold = keep.startTrimHold; stopTrimHold = keep.stopTrimHold; radioPtt = keep.radioPtt; toggleGspd = keep.toggleGspd;
    o.cyc = log.join(',');
    kgPop('cyc'); await w(200); o.cycPop = document.querySelector('#kg-pop .kgp-t').textContent === 'CYCLIC' && !!document.querySelector('#kg-pop-body [data-kg="apDis"]');
    kgPop(null); await w(200); o.closed = getComputedStyle(document.getElementById('kg-pop')).display === 'none';
    // SRCH LT — 위아래로 광도 · 빛 무리 세기가 따른다
    kgLt.br = 1; kgPress('srchDim'); _kgHoldStop(); kgPress('srchDim'); _kgHoldStop(); o.br = kgLt.br; o.brK = kgBeams().find(b => b.az === kgLt.az).k;
    kgPress('srchBrt'); _kgHoldStop(); o.br2 = kgLt.br; kgLt.br = 1;
    // AP FAST CUT OFF(빨간 단추) — AP1 · AP2 를 끊는다
    const a1 = ovhdGet('ap1'), a2 = ovhdGet('ap2');
    kgPress('apCut'); o.cut = ovhdGet('ap1') === 'IN' && ovhdGet('ap2') === 'IN' && afcsAxes().apOff;
    ovhdSet('ap1', a1); ovhdSet('ap2', a2);
    // OEI 스위치 — 한 엔진일 때만 · 누를 때마다 HI ↔ LOW
    if (typeof simOeiToggle === 'function') {
      const e0 = simEng, m0 = simOeiMode; simEng = 2; kgPress('oei'); o.oei2 = simOeiMode;
      simEng = 1; simOeiMode = 'HI'; kgPress('oei'); o.oeiLo = simOeiMode; o.limLo = simOeiLim(); kgPress('oei'); o.oeiHi = simOeiMode; o.limHi = simOeiLim();
      simEng = e0; simOeiMode = m0;
    } else o.oeiSkip = true;
    // 사이클릭 — 왼쪽도 같은 방향 · 4-WAY BEEP 화살표는 왼쪽 30°
    const L = document.getElementById('kg-mini-cycL').innerHTML;
    o.cycL = !/scale\(-1 1\)/.test(L) && /rotate\(-30 82 88\)/.test(L) && /data-kg="apCut"/.test(L);
    kgSrchSet(false); envSet({ ldg: false }); window.radarAltFt = ra;
    return o;
  });
  t.ok(C.ldgOn && Math.abs(C.auto - 30) < 0.5, `LDG LT ON — 접혀 있던 착륙등이 저절로 전방 30° 로 펼쳐진다 (${C.auto.toFixed(1)}°↓)`);
  t.ok(C.ldgBeam && C.ldgBeam.k > 0.9 && C.ldgBeam.reach === 2400 && C.far, `착륙등은 서치라이트(0.9)보다 밝고(${C.ldgBeam && C.ldgBeam.k}) 두 배 멀리(${C.ldgBeam && C.ldgBeam.reach}m) 비춘다`);
  t.ok(C.ext < 30 && C.ret && C.keep, `EXT 로 더 앞(${C.ext.toFixed(0)}°↓) · RET 로 접는 쪽 · ON/OFF 는 자리를 그대로 둔다`);
  t.ok(C.stowDef === 'mom|LDG,CTR,SRCH|CTR', `STOW SEL — 3방향 스프링 스위치 · 평소 가운데 (${C.stowDef})`);
  t.ok(C.stowL.off && C.stowL.e === 0 && C.stowL.srch, 'STOW SEL → LDG — 착륙등이 꺼지고 접힌다(서치라이트는 그대로)');
  t.ok(C.stowS.off && C.stowS.az === 0 && C.stowS.el === 30 && C.stowS.sw === 'CTR', 'STOW SEL → SRCH — 서치라이트가 꺼지고 원위치(정면 · 아래 30°) · 스위치는 가운데로');
  t.ok(Math.abs(C.reOn - 30) < 0.5, '접은 뒤 컬렉티브 LDG LT 로 다시 켜면 다시 전방 30° 로 펼친다');
  t.ok(C.msg0 === '' && C.msgS === 'SRCH LT ON:' + C.grn && C.msgL === 'LDG LT ON:' + C.grn, `PFD 메시지 시현창 — 켜지면 녹색 조언 (${C.msgS} · ${C.msgL})`);
  t.ok(C.srchMin === 2.5, '서치라이트 — 아래로 2.5° 까지(종전의 두 배 앞)');
  t.ok(C.az > 10 && C.el > 30 && C.beams === 2 && C.env >= 2 && C.right, `SRCH CTR — 서치라이트를 오른쪽 ${Math.round(C.az)}° · 아래 ${Math.round(C.el)}° 로 돌린다 · 착륙등과 함께 빛 무리 ${C.env}개`);
  t.ok(C.coll.up === 3 && C.coll.dn === 1, `COLL TRIM — 누르는 동안 VS +100 씩 이어진다(UP ${C.coll.up}번 · DN ${C.coll.dn}번)`);
  t.eq(C.cyc, 'dis,ftr,ftr-,beepF,beep-,beepL,beep-,ptt+,ptt-,gspd', '사이클릭 — DISENGAG · FORCE TRIM RELEASE · 4-WAY BEEP · PTT(누르는 동안) · G/SPEED');
  t.ok(Math.abs(C.br - 0.8) < 1e-9 && Math.abs(C.brK - 0.72) < 1e-9 && Math.abs(C.br2 - 0.9) < 1e-9, `SRCH LT — 위아래로 광도(${Math.round(C.br * 100)}% → ${Math.round(C.br2 * 100)}%) · 누르면 ON/OFF`);
  t.ok(C.cut, 'AP FAST CUT OFF(사이클릭 빨간 단추) — AP1 · AP2 를 한 번에 끊는다');
  t.ok(C.oeiSkip || (C.oei2 === 'HI' && C.oeiLo === 'LOW' && C.limLo === 600 && C.oeiHi === 'HI' && C.limHi === 150), 'OEI 스위치 — 한 엔진일 때 누를 때마다 HI(2.5분) ↔ LOW(10분) · 두 엔진이면 바뀌지 않는다');
  t.ok(C.cycL, '사이클릭 — 왼쪽 좌석도 오른쪽과 같은 방향 · 4-WAY BEEP 화살표는 왼쪽으로 30° 틀어짐');
  t.ok(C.cycPop && C.closed, '사이클릭을 크게 띄우고 ✕ 로 닫는다');

  // ── 일반 화면(창 탭 CYC·COLL) — 교관 화면처럼 컬렉티브 · 사이클릭 · 누르면 그대로 조작 ──
  const G = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
    if (window._cockpitOn && typeof cockpitExit === 'function') cockpitExit();
    if (typeof _soloActive !== 'undefined' && _soloActive) exitSolo();
    await w(200);
    o.tabs = document.querySelectorAll('.page-tab[data-sel="grip"]').length;
    selectPanel('right', 'grip', true); await w(300);
    const g = document.getElementById('grip-wrap');
    o.shown = !!g && !g.classList.contains('page-hidden') && g.offsetWidth > 50;
    o.svgs = g ? g.querySelectorAll('svg').length : 0;
    o.titles = g ? g.textContent.replace(/\s+/g, ' ') : '';
    const press = k => { const el = g.querySelector(`[data-kg="${k}"]`); if (!el) return false; const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 }));
      g.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); return true; };
    const l0 = !!env.ldg; o.pressed = press('ldgOn'); await w(100); o.ldg = !!env.ldg !== l0;
    press('ldgOn'); await w(100); o.back = !!env.ldg === l0;
    selectPanel('right', 'map', true); await w(100);
    return o;
  });
  t.ok(G.tabs >= 3 && G.shown && G.svgs === 2 && /COLLECTIVE/.test(G.titles) && /CYCLIC/.test(G.titles), `창 탭 CYC·COLL — 컬렉티브 · 사이클릭 그림이 창에 (탭 ${G.tabs} · 그림 ${G.svgs})`);
  t.ok(G.pressed && G.ldg && G.back, 'CYC·COLL 창의 단추를 누르면 그대로 조작된다(LDG LT ON ↔ OFF)');
}
