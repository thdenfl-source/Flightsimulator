// SAR(js/24-sar.js) — SAR 버튼 · SAR CONTROL(익수자 · 육상, 움직임 상/중/하) · 호이스트(자동 결속 · 구조) · HOIST CAM
export const name = 'SAR 호이스트';

export async function run(page, t) {
  // ── 버튼 — 지도 창 · 3D(Cockpit Mode) 창의 SHIP 다음 ──
  const btn = await page.evaluate(() => {
    const nx = id => { const b = document.getElementById(id); return b && b.nextElementSibling ? b.nextElementSibling.id : ''; };
    return { map: nx('map-ship-btn'), d3: nx('ship3d-btn') };
  });
  t.ok(btn.map === 'map-sar-btn' && btn.d3 === 'sar3d-btn', `SHIP 다음에 SAR 버튼 — 지도 창 · 3D 창 (${btn.map} · ${btn.d3})`);

  const P = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    const run0 = S.running; S.running = false;                      // 걸음은 sarTick 으로 직접 준다
    document.getElementById('map-sar-btn').click(); await w(300);
    const p = document.getElementById('sar-panel');
    o.open = !!p && getComputedStyle(p).display === 'block' && sar.on;
    // 종류 · 움직임
    p.querySelector('[data-sar="t:land"]').click(); o.land = sar.type === 'land';
    p.querySelector('[data-sar="t:water"]').click(); o.water = sar.type === 'water';
    const mv = lvl => {
      p.querySelector(`[data-sar="l:${lvl}"]`).click();
      sarPlaceAt(37.5, 126.5); const a = [sar.lat, sar.lon];
      sarTick(10);
      return distance(a[0], a[1], sar.lat, sar.lon) * 1852;
    };
    o.hi = mv('HI'); o.mid = mv('MID'); o.lo = mv('LO');
    // 호이스트 — ENABLE OFF 면 케이블이 움직이지 않는다
    hoistFt = 0; ovhdSet('hoistEnable', 'OFF'); ovhdSet('hoistOvr', 'DOWN'); sarTick(2); o.noPwr = hoistFt;
    ovhdSet('hoistEnable', 'ON'); sarTick(2); o.down2 = hoistFt; ovhdSet('hoistOvr', 'OFF');
    // 자동 결속 — 고리 바로 아래 · 높이 차 0 에 20초
    S.alt = radarGroundFt() + 60;
    const [hl, ho] = sarHookLL(); sarPlaceAt(hl, ho);
    hoistFt = radarAltFt() + HOIST_Z_FT - SAR_SURV_FT;
    for (let i = 0; i < 19; i++) sarTick(1);
    o.h19 = sar.state; o.hold = sar.hold;
    hoistFt += 15; sarTick(1); o.far = { st: sar.state, hold: sar.hold };           // 높이 차 15ft — 다시 처음부터
    hoistFt -= 15;
    for (let i = 0; i < 21; i++) sarTick(1);
    o.h21 = sar.state;
    // 감아 올리면 구조
    ovhdSet('hoistOvr', 'UP'); for (let i = 0; i < 30; i++) sarTick(1); ovhdSet('hoistOvr', 'OFF');
    o.aboard = { st: sar.state, cable: hoistFt };
    // ▲▼ 버튼(누르는 동안)
    sarReset();
    const dn = p.querySelector('[data-hoist="1"]');
    dn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); sarTick(3);
    dn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); sarTick(3);
    o.btn = hoistFt;
    // CABLE CUT
    ovhdSet('cableCut', 'CUT'); sarTick(0.5); o.cut = hoistFt; ovhdSet('cableCut', 'NORM');
    o.panelTxt = p.querySelector('.sar-st').textContent;
    sarReset(); ovhdSet('hoistEnable', 'OFF');
    S.running = run0;
    return o;
  });
  t.ok(P.open, 'SAR 를 누르면 SAR CONTROL 창이 열리고 요구조자가 놓인다');
  t.ok(P.land && P.water, '종류 — 익수자 · 육상 요구조자를 고른다');
  t.ok(Math.abs(P.hi - 15.4) < 1 && Math.abs(P.mid - 5.1) < 0.5 && P.lo === 0,
    `움직임 — 상 3kt · 중 1kt · 하 없음 (10초에 ${P.hi.toFixed(1)} · ${P.mid.toFixed(1)} · ${P.lo.toFixed(1)} m)`);
  t.ok(P.noPwr === 0 && Math.abs(P.down2 - 250 / 60 * 2) < 0.01, `호이스트 — HOIST ENABLE ON 이어야 케이블이 내려간다(250 ft/min) (${P.noPwr} → ${P.down2.toFixed(1)} ft)`);
  t.ok(P.h19 === 'wait' && P.hold >= 18.9 && P.far.st === 'wait' && P.far.hold === 0,
    `높이 차 10ft · 반경 10m 안에서 19초는 아직 · 벗어나면 처음부터 (${P.hold.toFixed(0)}s → ${P.far.hold}s)`);
  t.ok(P.h21 === 'hooked', `20초 머무르면 요구조자가 고리에 붙는다 (${P.h21})`);
  t.ok(P.aboard.st === 'aboard' && P.aboard.cable === 0, `케이블을 끝까지 감으면 구조 완료 (${P.aboard.st})`);
  t.ok(Math.abs(P.btn - 250 / 60 * 3) < 0.01, `SAR CONTROL ▼ DOWN 은 누르는 동안만 (${P.btn.toFixed(1)} ft)`);
  t.ok(P.cut === 0, 'CABLE CUT 이면 케이블이 끊긴다');
  t.ok(/CABLE/.test(P.panelTxt) && /유지/.test(P.panelTxt), `SAR CONTROL 에 케이블 · 높이 차 · 거리 · 유지 시간 (${P.panelTxt.slice(0, 40)}…)`);

  // ── SOS 비콘 — ··· −−− ··· (점 0.25s) ──
  const B = await page.evaluate(() => {
    sarPlaceAt(37.5, 126.5);
    let str = ''; for (let k = 0; k < SOS_LEN; k++) str += sarBeaconOn((k + 0.5) * SOS_UNIT) ? '1' : '0';
    return { str, len: SOS_LEN };
  });
  t.eq(B.str, '10101000' + '11101110111000' + '101010000000', `SOS 비콘이 모스 부호 ··· −−− ··· 로 깜빡인다 (${B.str})`);

  // ── 계기 비행계획 SAR01 — 놓으면 넣고, 옮기면 좌표를 고치고, 끄면 지운다 ──
  const W = await page.evaluate(async () => {
    clearFP();
    const o = {};
    const w = () => S.wps.find(x => x.ident === 'SAR01');
    sarPlaceAt(37.45, 126.35);
    o.add = { n: S.wps.filter(x => x.ident === 'SAR01').length, lat: w() && w().lat, act: S.awp === S.wps.indexOf(w()), dis: Math.abs(S.lat - 37.45) > 1e-3 || Math.abs(S.lon - 126.35) > 1e-3 };
    // 지도 표식을 끌어 옮긴다
    _sarMk.setLatLng([37.46, 126.36]); _sarMk.fire('dragend');
    o.drag = { n: S.wps.filter(x => x.ident === 'SAR01').length, lat: w().lat, lon: w().lon, s: [sar.lat, sar.lon] };
    // 표류는 SAR01 을 바꾸지 않는다(보고된 자리)
    sar.lvl = 'HI'; sarTick(10); o.drift = { wp: w().lat, sar: sar.lat }; sar.lvl = 'MID';
    // 경로 계산(GPS) — 활성 구간이 SAR01
    updateNav(); o.dist = distance(S.lat, S.lon, w().lat, w().lon);
    // 다른 계획이 있으면 끝에 붙고 활성은 그대로
    sarToggleOn(); o.off = !w();
    pushWP({ ident: 'AAA', lat: 37.3, lon: 126.3 });
    sarPlaceAt(37.47, 126.37);
    o.app = { last: S.wps[S.wps.length - 1].ident, awp: S.wps[S.awp].ident };
    sarToggleOn(); clearFP();
    return o;
  });
  t.ok(W.add.n === 1 && W.add.lat === 37.45 && W.add.act && W.add.dis, '요구조자를 놓으면 비행계획에 SAR01 이 들어가 활성 구간이 된다(기체는 그대로)');
  t.ok(W.drag.n === 1 && W.drag.lat === 37.46 && W.drag.lon === 126.36 && W.drag.s[0] === 37.46, `지도에서 끌어 옮기면 SAR01 좌표도 같이 바뀐다 (${W.drag.lat}, ${W.drag.lon})`);
  t.ok(W.drift.wp === 37.46 && W.drift.sar !== 37.46, 'SAR01 은 보고된 자리 — 표류해도 그대로');
  t.ok(W.off, '요구조자를 끄면 SAR01 을 지운다');
  t.ok(W.app.last === 'SAR01' && W.app.awp === 'AAA', `비행계획이 있으면 끝에 SAR01 을 붙이고 활성 구간은 그대로 (${W.app.last} · ${W.app.awp})`);

  // ── HOIST CAM — CDU Video Channel HOIST → SYSTEM 창 큰 칸에 바로 아래를 보는 3D 지도 ──
  const C = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'sysp', true); await w(300);
    sysPageSet('asys_video'); videoChanSet('HOIST'); sysDraw(); await w(1500);
    const el = document.getElementById('sysp-hoist');
    const o = { el: !!el, on: sarHoistCamOn(), w: el ? el.clientWidth : 0 };
    if (sarHoistCamOn()) { const m = _sarCam.map; o.pitch = m.getPitch(); o.bearing = Math.round((m.getBearing() + 360) % 360); o.hdg = Math.round(S.hdg % 360); o.layer = !!m.getLayer('sar-3d') || !m.isStyleLoaded(); }
    S.alt = radarGroundFt() + 30; const z30 = sarHoistCamZoom(700); S.alt = radarGroundFt() + 200; const z200 = sarHoistCamZoom(700);
    o.z = [z30, z200];
    videoChanSet('RADAR'); await w(200);
    o.off = !document.getElementById('sysp-hoist') && !sarHoistCamOn();
    sysPageSet('map'); selectPanel('right', 'map', true);
    return o;
  });
  t.ok(C.el && C.on && C.w > 100, `Video Channel HOIST — SYSTEM 창에 HOIST CAM 3D 지도 (${C.w}px)`);
  t.ok(C.pitch === 0 && Math.abs(C.bearing - C.hdg) <= 1 && C.layer, `바로 아래를 보고(기울기 ${C.pitch}°) 기수가 위 (${C.bearing}° · HDG ${C.hdg}°)`);
  t.ok(C.z[0] > C.z[1] + 2, `낮을수록 크게 보인다 (RA 30ft z${C.z[0].toFixed(1)} · 200ft z${C.z[1].toFixed(1)})`);
  t.ok(C.off, '다른 채널을 고르면 HOIST CAM 을 거둔다');

  // ── Cockpit Mode — 왼쪽에서 두 번째 MFD(SYSTEM)에도 HOIST CAM 이 나온다(화면 밖 지도를 옮겨 그린다) ──
  const K = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    sysPageSet('asys_video'); videoChanSet('HOIST');
    cockpitStart(); await w(2500);
    const o = { mode: _sarCam.mode, on: sarHoistCamOn(), white: 0 };
    const c = [...document.querySelectorAll('#sim-ckpit canvas.ck-scr')].find(x => CKPIT_SCR[+x.dataset.i].k === 'sys');
    for (let k = 0; k < 20 && c && !(o.white > 0); k++, await w(250)) {   // 바쁠 때는 한 박자 늦게 그려진다   // 큰 칸 가운데의 십자(흰색) — HUD 가 옮겨 그려졌는지
      const g = c.getContext('2d'), kk = Math.min(c.width / SYS_W, c.height / SYS_H);
      const ox = (c.width - SYS_W * kk) / 2, oy = (c.height - SYS_H * kk) / 2;
      const cx = Math.round(ox + (227 + 383) * kk), cy = Math.round(oy + (49 + 287) * kk);
      const d = g.getImageData(cx - 40, cy - 3, 80, 7).data; let white = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 110 && d[i + 1] > 110 && d[i + 2] > 110) white++;
      o.white = white;
    }
    cockpitExit(); videoChanSet('RADAR'); await w(2200);
    o.after = sarHoistCamOn();
    sysPageSet('map');
    return o;
  });
  t.ok(K.on && K.mode === 'off' && K.white > 0, `Cockpit Mode SYSTEM MFD 에도 HOIST CAM — 화면 밖 지도를 옮겨 그린다 (${K.mode} · 십자 ${K.white}px)`);
  t.ok(!K.after, 'Cockpit Mode 를 나가거나 채널을 바꾸면 거둔다');
}
