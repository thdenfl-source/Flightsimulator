// Cockpit Mode(07-sim.js cockpitStart) — 3D 단독 화면 · 1인칭 조종석 시야 · 조종석 패널(MFD · 위아래 콘솔 · CDU)
// SIM 이 꺼져 있어도(절차 훈련판 · AFCS 로 나는 비행) 조종석에 앉는다 · 'Split screen' 으로 끝낸다
// + FCP IAS 를 누르면 AFCS 상태 띠의 IAS 가 꺼진다(SIM 이 꺼져 있어도)
export const name = 'Cockpit 모드';

export async function run(page, t) {
  const gate = await page.evaluate(() => ({ ck: !!document.getElementById('gate-mode-cockpit'), d3: !!document.getElementById('gate-mode-3d') }));
  t.ok(gate.ck && !gate.d3, '시작 화면 고르기에 Cockpit Mode 가 있고 3D 단독 모드는 없다');
  const A = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    S.alt = 1500; S.spd = 100;
    cockpitStart(); await w(1500);
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const o = { sim: simModeOn, solo: _soloActive && _soloCurrent, cam: _ckFirst(), ckcam: ckCamOn(), pitch: _ml3d ? _ml3d.getPitch() : 0, model: heli3dShown(),
                panel: vis('sim-ckpit'), mfd: document.querySelectorAll('#sim-ckpit canvas.ck-scr').length,
                ovhd: (document.getElementById('ovhd-wrap').parentElement || {}).id, lcon: (document.getElementById('lcon-wrap').parentElement || {}).id,
                cdu: ((document.getElementById('cdu-ov') || {}).parentElement || {}).id, scale: document.getElementById('map3d').classList.contains('sim3d'),
                btns: ['ckpit-btn', 'lconc-btn', 'upperc-btn'].every(vis),
                fly: ['vstick-btn', 'gyro-btn', 'rotor-3d', 'sim3d-btn'].map(id => vis(id)) };
    // 화면을 누르면 크게(팝아웃)
    document.querySelector('#sim-ckpit canvas.ck-scr[data-i="0"]').click(); await w(300);
    o.pop = ckConPop; toggleConsolePop(null); await w(200);
    // Split screen — 분할 화면으로 끝낸다
    exitSolo(); await w(500);
    o.exit = { ck: window._cockpitOn, cam: ckCamOn(), panel: vis('sim-ckpit'), mode: sessionStorage.getItem('vfrStartMode'), app: getComputedStyle(document.getElementById('app')).display };
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 절차 훈련판 */ }
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  const procEd = await page.evaluate(() => typeof SIM_ENABLED !== 'undefined' && !SIM_ENABLED);
  t.ok(A.solo === 'm3d' && A.cam && A.pitch > 80 && !A.model && A.scale,
    `Cockpit Mode — 3D 를 화면 가득 · 1인칭 조종석 시야(카메라 피치 ${Math.round(A.pitch)}°) · 제 헬기 모형 · 축척은 감춘다`);
  if (procEd) t.ok(!A.sim && A.ckcam, '절차 훈련판 — SIM 없이(AFCS 로 나는 비행) 조종석 시야');
  else t.ok(A.sim, '종합판 — SIM 을 켠 채로 시작한다');
  t.ok(A.panel && A.mfd === 4 && A.ovhd === 'ck-mini-ovhd' && A.lcon === 'ck-mini-lcon' && A.cdu === 'ck-mini-cdu' && A.btns,
    `조종석 패널 — MFD 넷 · 위아래 콘솔 · CDU 가 제자리에, 조종석 · LowerC · UpperC 버튼 (${A.ovhd} · ${A.lcon} · ${A.cdu})`);
  if (procEd) t.ok(A.fly.every(v => !v), '절차 훈련판 — 스틱 · 자이로 · 회전익 특성 · SIM 처럼 비행하는 버튼은 없다');
  else t.ok(A.fly.every(v => v), '종합판 — 스틱 · 자이로 · 회전익 특성 · SIM 버튼을 모두 쓸 수 있다');
  t.ok(A.pop === 'pfd', '화면(MFD)을 누르면 가운데에 크게 뜬다');
  // (종합판은 SIM 이 켜진 채로 나온다 — 분할 화면의 3D 창에서 SIM 1인칭이면 조종석 패널이 계속 보일 수 있다)
  t.ok(!A.exit.ck && !A.exit.cam && (A.sim || !A.exit.panel) && A.exit.mode === 'pc' && A.exit.app !== 'none', 'Split screen — 분할 화면(PC 모드)으로 끝낸다');
  // IAS — 누를 때마다 AFCS 상태 띠의 IAS 가 꺼지고 켜진다(SIM 꺼짐)
  const I = await page.evaluate(() => {
    const on = () => { const seen = []; const proto = CanvasRenderingContext2D.prototype, oT = proto.fillText; let col = null;
      proto.fillText = function (x, ...a) { if (String(x) === 'IAS') col = this.fillStyle; return oT.call(this, x, ...a); };
      try { drawPFD(); } finally { proto.fillText = oT; } return col; };
    const o = { sim: simModeOn, c0: on(), m0: iasModeOn() };
    fcpSync('ias'); o.c1 = on(); o.m1 = iasModeOn(); o.lamp1 = document.querySelector('#fcp-simple [data-fk="ias"]') ? null : null;
    fcpSync('ias'); o.c2 = on(); o.m2 = iasModeOn();
    fcpSync('ias'); applyDelta('spd', 5); o.m3 = iasModeOn(); applyDelta('spd', -5);
    return o;
  });
  t.ok(!I.sim && I.m0 && !I.m1 && I.m2 && I.m3 && I.c0 !== I.c1 && I.c2 === I.c0,
    `FCP IAS 를 누르면 AFCS 상태 띠의 IAS 가 꺼지고, 다시 누르면 켜진다 · 노브를 돌리면 다시 걸린다 (${I.c0} → ${I.c1} → ${I.c2})`);

  // ── PFD 팝아웃 — FCP 아래 남는 칸에 움직이는 지도 ──
  const pm = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    S.alt = 1500; S.spd = 100; cockpitStart(); await w(1000);
    toggleConsolePop('pfd'); await w(600);
    const m = document.getElementById('ck-pop-mapslot'), bar = document.querySelector('#pfd-wrap .ctrl-bar');
    const mr = m.getBoundingClientRect(), br = bar.getBoundingClientRect();
    const mw = document.getElementById('map-wrap'), lm = leafMap.getSize();
    const o = { show: m.classList.contains('show'), below: mr.top >= br.bottom - 1 && Math.abs(mr.left - br.left) < 2 && mr.height > 80,
                inSlot: mw.parentElement === m && !mw.classList.contains('page-hidden'), size: Math.abs(lm.x - mr.width) < 4 && Math.abs(lm.y - mr.height) < 4,
                bars: getComputedStyle(document.getElementById('map-top-bar')).display === 'none' };
    toggleConsolePop('sysp'); await w(300); o.hide = !m.classList.contains('show') && mw.parentElement !== m;
    toggleConsolePop(null); exitSolo(); await w(300);
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 절차 훈련판 */ }
    S.alt = 0; S.spd = 0; S.running = false;
    return o;
  });
  t.ok(pm.show && pm.below && pm.inSlot && pm.size && pm.bars && pm.hide, `PFD 팝아웃 — FCP 아래 칸에 2D 지도(지도만 · 크기 맞춤 · 다른 화면으로 바꾸면 빠진다) (${JSON.stringify(pm)})`);
  // ── Simple 모드 위 막대의 COCKPIT — Cockpit Mode 로 들어가고, 끝내면 그 Simple 화면으로 돌아온다 ──
  const sc = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    simpleModeStart('map'); await w(300);
    const names = [...document.querySelectorAll('#simple-bar [data-scr]')].map(b => b.textContent).join(',');
    document.querySelector('#simple-bar [data-scr="cockpit"]').click(); await w(800);
    const o = { names, ck: window._cockpitOn && _soloActive && _soloCurrent === 'm3d', simpleIn: simpleOn };
    exitSolo(); await w(500);
    o.back = { simple: simpleOn, scr: window._simpleScr, ck: window._cockpitOn };
    simpleExit(); await w(200);
    try { if (simModeOn) toggleSimMode(false); } catch (e) { /* 절차 훈련판 */ }
    return o;
  });
  t.ok(sc.names === 'PFD,COCKPIT,MAP,CDU,UPPER,LOWER,SYSTEM' && sc.ck && !sc.simpleIn, `Simple 위 막대 — 3D 자리에 COCKPIT · 누르면 Cockpit Mode (${sc.names})`);
  t.ok(sc.back.simple && sc.back.scr === 'map' && !sc.back.ck, 'Cockpit Mode 를 끝내면 들어오기 전 Simple 화면(MAP)으로 돌아온다');
}
