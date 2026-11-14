'use strict';
// ══════════════════════════════════════════════════════
// SAR — 요구조자(익수자 · 육상 요구조자) · 구조 호이스트 · HOIST CAM
//
// 지도 창 · 3D(Cockpit Mode) 창의 SHIP 다음 'SAR' 버튼 → SAR CONTROL 창(함정 설정창과 같은 꼴)
//   종류: 익수자(바다 위) · 육상 요구조자(땅 위)
//   움직임: 상 3kt · 중 1kt · 하(움직임 없음) — 익수자는 조류에 떠밀리듯 거의 한 방향으로, 육상은 이리저리 걷는다
// 호이스트(하부 콘솔 ⑬ 호이스트 제어패널) — HOIST ENABLE ON + DC 전원이면 돈다
//   케이블: PILOT OVERRIDE DOWN/UP(하부 콘솔) 또는 SAR CONTROL 의 ▼ DOWN · ▲ UP(누르고 있는 동안) — 250 ft/min, 최대 290 ft
//   CABLE CUT 을 CUT 으로 올리면 케이블이 끊긴다(매달린 사람은 그 자리에 떨어진다)
// 자동 결속 — 고리 높이(전파고도 + 호이스트 붐 높이 − 케이블 길이)가 요구조자 높이와 10ft 안,
//   고리가 요구조자에서 수평 10m 안에 20초 머무르면 요구조자가 고리에 붙는다. 케이블을 끝까지 감아 올리면 구조 완료.
// HOIST CAM — CDU Aircraft Systems → Video → Channel HOIST 를 고르면 SYSTEM 창 큰 칸에 호이스트 붐에서
//   바로 아래를 내려다보는 3D 지도(함정 · 요구조자 · 고리)가 나온다. 전파고도에 맞춰 화각이 바뀐다.
// 3D EXTERNAL(3인칭 · 3D 창)에는 호이스트 붐 · 케이블 · 고리 · 요구조자가 보인다.

const SAR_LVL_KT = { HI: 3, MID: 1, LO: 0 };          // 움직임 상 · 중 · 하
const HOIST_FPS = 250 / 60;                           // 케이블 감기 · 풀기(ft/s)
const HOIST_MAX_FT = 290;
const HOIST_PT = [0.9, 1.45, 2.7];                     // 호이스트 붐 끝(모형 축: 앞 · 오른쪽 · 위, m) — 오른쪽 객실 문 위
const HOIST_Z_FT = HOIST_PT[2] / 0.3048;
const SAR_SURV_FT = 2;                                 // 요구조자가 고리를 잡는 높이(수면 · 지면 위, ft)
const SAR_CAP_DH = 10, SAR_CAP_R = 10, SAR_CAP_T = 20; // 자동 결속: 높이 차 ft · 수평 반경 m · 유지 s

let sar = { on: false, type: 'water', lvl: 'MID', lat: null, lon: null, dir: 0, state: 'wait', hold: 0 };
let hoistFt = 0, _hoistBtn = 0;                        // 케이블 길이(ft) · SAR CONTROL ▲▼(누르는 동안 −1 UP · +1 DOWN)

function _sarOv(id, d) { try { const v = typeof ovhdGet === 'function' ? ovhdGet(id) : undefined; return v === undefined ? d : v; } catch (e) { return d; } }
function hoistPowered() {
  let dc = true;
  try { if (typeof pwrDc === 'function') dc = pwrDc(); } catch (e) { _swallow(e); }
  return dc && _sarOv('hoistEnable', 'OFF') === 'ON';
}
// 미터 ↔ 위경도(작은 거리)
function _sarOff(lat, lon, n, e) { return [lat + n / 111320, lon + e / (111320 * Math.cos(lat * Math.PI / 180))]; }
function _sarNE(lat0, lon0, lat, lon) { return [(lat - lat0) * 111320, (lon - lon0) * 111320 * Math.cos(lat0 * Math.PI / 180)]; }
// 고리의 수평 자리 — 기체 자리에서 호이스트 붐 끝(앞 0.9m · 오른쪽 1.45m)만큼
function sarHookLL() {
  const h = (S.hdg || 0) * Math.PI / 180, f = HOIST_PT[0], r = HOIST_PT[1];
  return _sarOff(S.lat, S.lon, f * Math.cos(h) - r * Math.sin(h), f * Math.sin(h) + r * Math.cos(h));
}
function _sarRa() { try { return radarAltFt(); } catch (e) { return 0; } }
// 지금 고리와 요구조자 — 높이 차(ft, + 면 고리가 위) · 수평 거리(m)
function sarGeom() {
  const hookAgl = _sarRa() + HOIST_Z_FT - hoistFt;
  const [hl, ho] = sarHookLL();
  let dist = null, brg = null;
  if (sar.on && sar.lat !== null) {
    const [n, e] = _sarNE(hl, ho, sar.lat, sar.lon);
    dist = Math.hypot(n, e); brg = (Math.atan2(e, n) * 180 / Math.PI + 360) % 360;
  }
  return { hookAgl, dh: hookAgl - SAR_SURV_FT, dist, brg };
}

// ── 요구조자 놓기 · 바꾸기 ──
function sarPlaceAt(lat, lon) {
  sar.lat = lat; sar.lon = lon; sar.on = true; sar.state = 'wait'; sar.hold = 0;
  sar.dir = Math.random() * 360;
  _sarMarker(); sarPanelRender(); _sarRepaint();
  sarWptSync();
}
// ── 계기 비행계획의 SAR01 — 운용자가 요구조자를 놓거나 옮긴 자리(최초 보고 좌표) ──
// 요구조자를 놓으면 비행계획 끝에 SAR01 로 넣고(이미 있으면 좌표만 고친다), 지도 표식을 끌어 옮기거나
// 위치 버튼으로 다시 놓으면 SAR01 좌표도 같이 고친다. 계획이 비어 있었으면 SAR01 을 활성(Direct)으로 삼아
// GPS 항법(HSI · 거리 · 방위)이 곧장 그리로 이끈다 — 출발지로 기체를 옮기지는 않는다.
// 표류(움직임 상 · 중)는 좌표를 바꾸지 않는다 — SAR01 은 보고된 자리(datum)다. 요구조자를 끄면 SAR01 을 지운다.
const SAR_WPT = 'SAR01';
function sarWptIndex() { try { return S.wps.findIndex(w => w && w.sar === true && w.ident === SAR_WPT); } catch (e) { return -1; } }
function sarWptSync() {
  if (typeof S === 'undefined' || !Array.isArray(S.wps)) return;
  const i = sarWptIndex();
  const refresh = () => { try { updateWpMarkers(); fpRender(); updateNav(); } catch (e) { _swallow(e); } };
  if (!sar.on || sar.lat === null) {
    if (i >= 0) { try { removeWP(i); } catch (e) { S.wps.splice(i, 1); refresh(); } }
    return;
  }
  const lat = +sar.lat.toFixed(6), lon = +sar.lon.toFixed(6);
  if (i >= 0) {
    S.wps[i].lat = lat; S.wps[i].lon = lon;
    if (S.awp === i) { try { selectWP(i); } catch (e) { refresh(); } }   // 활성 구간이면 그 자리로 다시 잡는다(CRS)
    else refresh();
    return;
  }
  S.wps.push({ ident: SAR_WPT, lat, lon, sar: true });
  if (S.awp < 0) { try { selectWP(S.wps.length - 1); } catch (e) { refresh(); } }
  else refresh();
}
function sarPlaceAhead() { const [lat, lon] = _sarOff(S.lat, S.lon, 100 * Math.cos(S.hdg * Math.PI / 180), 100 * Math.sin(S.hdg * Math.PI / 180)); sarPlaceAt(lat, lon); }
function sarPlaceCenter() {
  let c = null;
  try { if (typeof _view3dOn !== 'undefined' && _view3dOn && _ml3d) { const k = _ml3d.getCenter(); c = [k.lat, k.lng]; } } catch (e) { _swallow(e); }
  if (!c) try { const k = leafMap.getCenter(); c = [k.lat, k.lng]; } catch (e) { c = [S.lat, S.lon]; }
  sarPlaceAt(c[0], c[1]);
}
function sarToggleOn() { if (sar.on) { sar.on = false; _sarMarker(); sarPanelRender(); _sarRepaint(); sarWptSync(); } else sarPlaceAhead(); }
function sarSetType(t) { if (t === 'water' || t === 'land') { sar.type = t; sarPanelRender(); _sarRepaint(); } }
function sarSetLvl(l) { if (l in SAR_LVL_KT) { sar.lvl = l; sarPanelRender(); } }
function sarReset() { if (sar.on) { sar.state = 'wait'; sar.hold = 0; } hoistFt = 0; sarPanelRender(); _sarRepaint(); }

// ── 한 걸음(dt 초 — 시뮬 시간) ──
function sarTick(dt) {
  if (!(dt > 0)) return;
  // 케이블 — 전원 · ENABLE 이 있어야 감고 푼다. CUT 이면 끊긴다
  if (_sarOv('cableCut', 'NORM') === 'CUT') {
    if (hoistFt > 0 || sar.state === 'hooked') {
      if (sar.state === 'hooked') { const [l, o] = sarHookLL(); sar.lat = l; sar.lon = o; sar.state = 'wait'; sar.hold = 0; }
      hoistFt = 0;
    }
  } else if (hoistPowered()) {
    const ovr = _sarOv('hoistOvr', 'OFF'), cmd = _hoistBtn || (ovr === 'DOWN' ? 1 : ovr === 'UP' ? -1 : 0);
    if (cmd) hoistFt = Math.max(0, Math.min(HOIST_MAX_FT, hoistFt + cmd * HOIST_FPS * dt));
  }
  if (!sar.on || sar.lat === null) return;
  if (sar.state === 'hooked') {
    const [l, o] = sarHookLL(); sar.lat = l; sar.lon = o;
    if (hoistFt <= 0.5) { sar.state = 'aboard'; hoistFt = 0; try { uiToast('구조 완료 — 요구조자를 기내로 올렸습니다', 'ok'); } catch (e) { _swallow(e); } }
    return;
  }
  if (sar.state !== 'wait') return;
  // 움직임 — 익수자는 거의 한 방향으로 떠밀리고(±2°/s), 육상은 이리저리 걷는다(±25°/s)
  const kt = SAR_LVL_KT[sar.lvl] || 0;
  if (kt > 0) {
    sar.dir = (sar.dir + (Math.random() - 0.5) * (sar.type === 'water' ? 4 : 50) * dt + 360) % 360;
    const m = kt * 0.514444 * dt, d = sar.dir * Math.PI / 180;
    [sar.lat, sar.lon] = _sarOff(sar.lat, sar.lon, m * Math.cos(d), m * Math.sin(d));
  }
  // 바다 상태(29-env.js) — 익수자는 파도 · 바람에 바람 쪽으로 더 밀린다
  if (sar.type === 'water' && typeof envSeaDrift === 'function') {
    const sd = envSeaDrift();
    if (sd.kt > 0) { const m = sd.kt * 0.514444 * dt, d = sd.dir * Math.PI / 180; [sar.lat, sar.lon] = _sarOff(sar.lat, sar.lon, m * Math.cos(d), m * Math.sin(d)); }
  }
  // 자동 결속 — 높이 차 10ft · 반경 10m 안에 20초
  const g = sarGeom();
  if (hoistPowered() && hoistFt > 0 && Math.abs(g.dh) <= SAR_CAP_DH && g.dist !== null && g.dist <= SAR_CAP_R) {
    sar.hold += dt;
    if (sar.hold >= SAR_CAP_T) { sar.state = 'hooked'; sar.hold = SAR_CAP_T; try { uiToast('요구조자가 호이스트 고리에 붙었습니다 — 케이블을 감아 올리세요', 'ok'); } catch (e) { _swallow(e); } }
  } else sar.hold = 0;
}
let _sarT = 0, _sarUiT = 0;
setInterval(() => {
  const now = performance.now(), dt = _sarT ? Math.min(0.5, (now - _sarT) / 1000) : 0;
  _sarT = now;
  let k = 0;
  try { k = S.running ? (simSpeed || 1) : 0; } catch (e) { k = 0; }
  sarTick(dt * k);
  if (sar.on || hoistFt > 0) _sarRepaint();
  if (now - _sarUiT > 250) { _sarUiT = now; _sarMarker(); sarPanelRender(); }
}, 100);

// ── 2D 지도 표식 ──
let _sarMk = null, _sarDrag = false;
// ── SOS 비콘 — 모스 부호 ··· −−− ···(짧게 3 · 길게 3 · 짧게 3) 를 되풀이한다 ──
// 한 점 0.25s · 줄 3점 · 부호 사이 1점 · 글자 사이 3점 · 되풀이 사이 7점(국제 모스 부호 간격)
const SOS_UNIT = 0.25;
const SOS_SEQ = (() => {
  const out = [], letter = (on, n) => { for (let i = 0; i < n; i++) { out.push([1, on]); out.push([0, i < n - 1 ? 1 : 3]); } };
  letter(1, 3); letter(3, 3); letter(1, 3);
  out[out.length - 1] = [0, 7];
  return out;
})();
const SOS_LEN = SOS_SEQ.reduce((a, x) => a + x[1], 0);
function sarBeaconOn(tSec) {
  if (!sar.on || sar.lat === null || sar.state !== 'wait') return false;
  let t = ((tSec != null ? tSec : performance.now() / 1000) / SOS_UNIT) % SOS_LEN;
  for (const [on, d] of SOS_SEQ) { if (t < d) return !!on; t -= d; }
  return false;
}
function _sarMarker() {
  if (typeof leafMap === 'undefined' || typeof L === 'undefined') return;
  const show = sar.on && sar.lat !== null && sar.state !== 'aboard';
  if (!show) { if (_sarMk) { try { leafMap.removeLayer(_sarMk); } catch (e) { _swallow(e); } _sarMk = null; } return; }
  if (!_sarMk) {
    // 끌어 옮길 수 있다 — 놓으면 그 자리로 다시 놓고 SAR01 좌표도 고친다
    _sarMk = L.marker([sar.lat, sar.lon], { draggable: true, zIndexOffset: 500, icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      html: '<div class="sar-mk" style="width:22px;height:22px;border-radius:50%;background:#ff7a00;border:2px solid #fff;box-shadow:0 0 6px #ff7a00;color:#fff;font:bold 9px Arial;line-height:18px;text-align:center;cursor:move">SAR</div>' }) }).addTo(leafMap);
    _sarMk.on('dragstart', () => { _sarDrag = true; });
    _sarMk.on('dragend', () => { _sarDrag = false; const p = _sarMk.getLatLng(); sarPlaceAt(p.lat, p.lng); });
  } else if (!_sarDrag) _sarMk.setLatLng([sar.lat, sar.lon]);
  // SOS 비콘 — 표식 테두리도 같이 깜빡인다
  try { const d = _sarMk.getElement() && _sarMk.getElement().querySelector('.sar-mk'); if (d) d.style.boxShadow = sarBeaconOn() ? '0 0 14px 6px #fff' : '0 0 6px #ff7a00'; } catch (e) { _swallow(e); }
}

// ── SAR CONTROL 창 ──
function _sarPanel() {
  let p = document.getElementById('sar-panel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'sar-panel';
  p.innerHTML =
    `<div class="sar-hd">🛟 SAR CONTROL<button class="sar-x" data-sar="close">✕</button></div>` +
    `<button class="sar-on" data-sar="on">요구조자 <span></span></button>` +
    `<div class="sar-lbl">종류</div><div class="sar-row">` +
    `<button class="ship-tab sar-t" data-sar="t:water">🌊 익수자</button><button class="ship-tab sar-t" data-sar="t:land">⛰ 육상 요구조자</button></div>` +
    `<div class="sar-lbl">움직임</div><div class="sar-row">` +
    `<button class="ship-tab ship-lvl sar-l" data-lvl="HI" data-sar="l:HI">상<small>3 kt</small></button>` +
    `<button class="ship-tab ship-lvl sar-l" data-lvl="MID" data-sar="l:MID">중<small>1 kt</small></button>` +
    `<button class="ship-tab ship-lvl sar-l" data-lvl="LO" data-sar="l:LO">하<small>움직임 없음</small></button></div>` +
    `<div class="sar-lbl">위치</div><div class="sar-row">` +
    `<button class="ship-tab" data-sar="ahead">기수 앞 100m</button><button class="ship-tab" data-sar="center">지도 가운데</button></div>` +
    `<div class="sar-lbl">HOIST <b class="sar-pw"></b></div><div class="sar-row">` +
    `<button class="ship-tab sar-h" data-hoist="-1">▲ UP</button><button class="ship-tab sar-h" data-hoist="1">▼ DOWN</button></div>` +
    `<div class="sar-st"></div>` +
    `<div class="sar-row"><button class="ship-tab" data-sar="reset">다시(대기 · 케이블 0)</button></div>`;
  p.addEventListener('click', e => {
    const b = e.target.closest('[data-sar]'); if (!b) return;
    e.stopPropagation();
    const a = b.dataset.sar;
    if (a === 'close') sarPanelClose();
    else if (a === 'on') sarToggleOn();
    else if (a.startsWith('t:')) sarSetType(a.slice(2));
    else if (a.startsWith('l:')) sarSetLvl(a.slice(2));
    else if (a === 'ahead') sarPlaceAhead();
    else if (a === 'center') sarPlaceCenter();
    else if (a === 'reset') sarReset();
  });
  // ▲ UP · ▼ DOWN — 누르고 있는 동안
  p.querySelectorAll('[data-hoist]').forEach(b => {
    const go = e => { e.preventDefault(); e.stopPropagation(); _hoistBtn = Number(b.dataset.hoist); b.classList.add('ship-tab-active'); };
    const stop = () => { _hoistBtn = 0; b.classList.remove('ship-tab-active'); };
    b.addEventListener('pointerdown', go);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, stop));
  });
  // 머리 줄을 끌어 옮긴다
  const hd = p.querySelector('.sar-hd');
  hd.addEventListener('pointerdown', e => {
    if (e.target.closest('.sar-x')) return;
    const r = p.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { p.style.left = Math.max(0, ev.clientX - dx) + 'px'; p.style.top = Math.max(0, ev.clientY - dy) + 'px'; p.style.right = 'auto'; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  document.body.appendChild(p);
  return p;
}
function sarPanelOpen() { const p = _sarPanel(); p.style.display = 'block'; if (!sar.on) sarPlaceAhead(); sarPanelRender(); }
function sarPanelClose() { const p = document.getElementById('sar-panel'); if (p) p.style.display = 'none'; _hoistBtn = 0; sarPanelRender(); }
function toggleSarPanel() {
  const p = document.getElementById('sar-panel');
  if (p && p.style.display === 'block') sarPanelClose(); else sarPanelOpen();
}
function sarPanelRender() {
  const open = (() => { const p = document.getElementById('sar-panel'); return !!(p && p.style.display === 'block'); })();
  ['map-sar-btn', 'sar3d-btn'].forEach(id => { const b = document.getElementById(id); if (b) b.classList.toggle('ship-active', sar.on || open); });
  if (!open) return;
  const p = document.getElementById('sar-panel');
  const on = p.querySelector('.sar-on'); on.classList.toggle('on', sar.on); on.querySelector('span').textContent = sar.on ? 'ON' : 'OFF';
  p.querySelectorAll('.sar-t').forEach(b => b.classList.toggle('ship-tab-active', b.dataset.sar === 't:' + sar.type));
  p.querySelectorAll('.sar-l').forEach(b => b.classList.toggle('ship-tab-active', b.dataset.sar === 'l:' + sar.lvl));
  const pw = hoistPowered(), cut = _sarOv('cableCut', 'NORM') === 'CUT';
  const pwEl = p.querySelector('.sar-pw');
  pwEl.textContent = cut ? 'CABLE CUT' : pw ? 'ENABLE' : 'OFF — 하부 콘솔 HOIST ENABLE ON';
  pwEl.style.color = cut ? '#ff5050' : pw ? '#4ade80' : '#ffb000';
  const g = sarGeom();
  const st = { wait: '대기', hooked: '고리에 붙음 — 감아 올리세요', aboard: '구조 완료' }[sar.state] || '';
  const ok = g.dist !== null && Math.abs(g.dh) <= SAR_CAP_DH && g.dist <= SAR_CAP_R && hoistFt > 0 && pw;
  const html =
    `<div>CABLE <b>${Math.round(hoistFt)} ft</b> · RA <b>${Math.round(_sarRa())} ft</b></div>` +
    `<div>고리 높이 차 <b style="color:${Math.abs(g.dh) <= SAR_CAP_DH ? '#4ade80' : '#fff'}">${g.dh >= 0 ? '+' : ''}${Math.round(g.dh)} ft</b></div>` +
    `<div>요구조자까지 <b style="color:${g.dist !== null && g.dist <= SAR_CAP_R ? '#4ade80' : '#fff'}">${g.dist === null ? '—' : g.dist < 1000 ? Math.round(g.dist) + ' m' : (g.dist / 1852).toFixed(2) + ' NM'}</b></div>` +
    `<div class="sar-bar"><i style="width:${(sar.hold / SAR_CAP_T * 100).toFixed(0)}%;background:${ok || sar.state !== 'wait' ? '#4ade80' : '#555'}"></i></div>` +
    `<div>유지 <b>${sar.hold.toFixed(0)} / ${SAR_CAP_T} s</b> · <b style="color:#ffcc66">${sar.on ? st : '요구조자 없음'}</b></div>`;
  const el = p.querySelector('.sar-st');
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ── 3D 모형(요구조자 · 호이스트 붐 · 케이블 · 고리) ──
function _sarBox(m, c, sz, col) { _shipBox(m, c, sz, col, 0); }
const SKIN = [0.86, 0.68, 0.56], HAIR = [0.08, 0.07, 0.07];
// 익수자 — 머리 · 어깨만 물 위, 한 팔을 높이 든다(원점 = 수면)
function _sarMeshWater() {
  const m = [], SH = [0.42, 0.44, 0.47];
  _sarBox(m, [0, 0, -0.25], [0.24, 0.46, 0.5], SH);                 // 몸통(대부분 물속)
  _sarBox(m, [0, 0, 0.2], [0.21, 0.19, 0.25], SKIN);                 // 머리
  _sarBox(m, [-0.03, 0, 0.3], [0.2, 0.21, 0.1], HAIR);               // 머리카락
  _sarBox(m, [0, 0.26, 0.45], [0.09, 0.09, 0.75], SH);              // 든 팔
  _sarBox(m, [0, 0.26, 0.9], [0.06, 0.12, 0.16], SKIN);             // 손
  _sarBox(m, [0.15, -0.35, 0.0], [0.4, 0.09, 0.09], SH);            // 물을 젓는 팔
  for (let i = 0; i < 10; i++) {                                     // 물보라 고리
    const a = i / 10 * 2 * Math.PI;
    _sarBox(m, [0.55 * Math.cos(a), 0.55 * Math.sin(a), 0.03], [0.18, 0.18, 0.06], [0.95, 0.97, 1.0]);
  }
  return m;
}
// 육상 요구조자 — 무릎 꿇고 한 손을 입에 대고 부른다(원점 = 지면)
function _sarMeshLand() {
  const m = [], SH = [0.45, 0.42, 0.33], PT = [0.30, 0.31, 0.25];
  _sarBox(m, [-0.15, -0.1, 0.12], [0.5, 0.14, 0.2], PT); _sarBox(m, [-0.15, 0.1, 0.12], [0.5, 0.14, 0.2], PT);   // 꿇은 다리
  _sarBox(m, [0.05, 0, 0.62], [0.24, 0.42, 0.62], SH);              // 몸통
  _sarBox(m, [0.06, 0, 1.08], [0.21, 0.19, 0.26], SKIN);             // 머리
  _sarBox(m, [0.03, 0, 1.18], [0.2, 0.21, 0.1], HAIR);
  _sarBox(m, [0.12, 0.2, 0.95], [0.09, 0.09, 0.3], SKIN);            // 입에 댄 팔
  _sarBox(m, [0.15, -0.26, 0.45], [0.09, 0.09, 0.6], SKIN);          // 땅을 짚은 팔
  _sarBox(m, [-0.12, 0, 0.7], [0.14, 0.36, 0.42], [0.20, 0.22, 0.20]);   // 배낭
  return m;
}
// 고리에 매달린 사람 — 두 팔을 들어 고리를 잡는다(원점 = 고리)
function _sarMeshHang(water) {
  const m = [], SH = water ? [0.42, 0.44, 0.47] : [0.45, 0.42, 0.33], PT = water ? [0.25, 0.27, 0.30] : [0.30, 0.31, 0.25];
  _sarBox(m, [0, -0.1, -0.12], [0.08, 0.08, 0.3], SKIN); _sarBox(m, [0, 0.1, -0.12], [0.08, 0.08, 0.3], SKIN);   // 든 두 팔
  _sarBox(m, [0, 0, -0.42], [0.21, 0.19, 0.25], SKIN); _sarBox(m, [-0.03, 0, -0.33], [0.2, 0.21, 0.08], HAIR);
  _sarBox(m, [0, 0, -0.85], [0.24, 0.42, 0.6], SH);
  _sarBox(m, [0, -0.1, -1.5], [0.15, 0.15, 0.75], PT); _sarBox(m, [0, 0.1, -1.5], [0.15, 0.15, 0.75], PT);
  _sarBox(m, [-0.02, 0, -0.62], [0.26, 0.46, 0.14], [1.0, 0.45, 0.05]);   // 구조 슬링(주황)
  return m;
}
function _sarMeshHoist() {
  const m = [];
  _sarBox(m, [HOIST_PT[0], 1.15, HOIST_PT[2]], [0.18, 0.62, 0.16], [0.75, 0.76, 0.78]);   // 붐
  _sarBox(m, [HOIST_PT[0], HOIST_PT[1], HOIST_PT[2] - 0.08], [0.22, 0.22, 0.2], [0.3, 0.32, 0.34]);   // 도르래
  return m;
}
function _sarMeshCable() { const m = []; _sarBox(m, [0, 0, -0.5], [0.025, 0.025, 1], [0.15, 0.15, 0.16]); return m; }   // 길이 1m(늘려 쓴다)
function _sarMeshBeacon() { const m = []; _shipBox(m, [0, 0, 0], [1, 1, 1], [1.0, 1.0, 0.92], -1); return m; }   // 스스로 빛나는 1m 상자(크기는 그릴 때)
function _sarMeshHook() { const m = []; _sarBox(m, [0, 0, -0.1], [0.12, 0.08, 0.2], [1.0, 0.82, 0.1]); return m; }
const _sarGL = new WeakMap();
function _sarGLInit(gl) {
  let h = _sarGL.get(gl);
  if (h) return h;
  const prog = gl.createProgram();
  gl.attachShader(prog, _h3Shader(gl, gl.VERTEX_SHADER, H3_VS));
  gl.attachShader(prog, _h3Shader(gl, gl.FRAGMENT_SHADER, H3_FS));
  gl.linkProgram(prog);
  const loc = {
    pos: gl.getAttribLocation(prog, 'a_pos'), nrm: gl.getAttribLocation(prog, 'a_nrm'),
    col: gl.getAttribLocation(prog, 'a_col'), mat: gl.getAttribLocation(prog, 'a_mat'),
    mvp: gl.getUniformLocation(prog, 'u_mvp'), rot: gl.getUniformLocation(prog, 'u_rot'),
    light: gl.getUniformLocation(prog, 'u_light'), alpha: gl.getUniformLocation(prog, 'u_alpha'),
  };
  let vao = null;
  if (typeof gl.createVertexArray === 'function') vao = { create: () => gl.createVertexArray(), bind: v => gl.bindVertexArray(v) };
  else { const ext = gl.getExtension('OES_vertex_array_object'); if (ext) vao = { create: () => ext.createVertexArrayOES(), bind: v => ext.bindVertexArrayOES(v) }; }
  const up = arr => {
    const part = _h3Upload(gl, arr);
    if (vao) {
      part.vao = vao.create(); vao.bind(part.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.buf);
      [[loc.pos, 3, 0], [loc.nrm, 3, 12], [loc.col, 3, 24], [loc.mat, 1, 36]].forEach(([l, n, o]) => {
        if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 40, o);
      });
      vao.bind(null);
    }
    return part;
  };
  h = { gl, prog, loc, vao, water: up(_sarMeshWater()), land: up(_sarMeshLand()), hangW: up(_sarMeshHang(true)), hangL: up(_sarMeshHang(false)),
        hoist: up(_sarMeshHoist()), cable: up(_sarMeshCable()), hook: up(_sarMeshHook()), beacon: up(_sarMeshBeacon()) };
  _sarGL.set(gl, h);
  return h;
}
const _r3 = R => new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
function _sarLayer(cam) {
  return {
    id: 'sar-3d', type: 'custom', renderingMode: '3d',
    onAdd(map) { this.map = map; },
    render(gl, args) {
      const showSurv = sar.on && sar.lat !== null && sar.state !== 'aboard';
      if (!showSurv && !(hoistFt > 0) && !cam && !(typeof heli3dShown === 'function' && heli3dShown())) return;
      let h;
      try { h = _sarGLInit(gl); } catch (e) { _swallow(e); return; }
      const main = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || (args && args.modelViewProjectionMatrix) || args;
      if (!main || main.length !== 16) return;
      gl.useProgram(h.prog);
      gl.uniform3fv(h.loc.light, H3_LIGHT);
      const f32 = a => new Float32Array(a);
      // 호이스트 붐 끝의 세계 자리 — 3D 모형과 같은 자세(heli3dPose)
      let pose = null;
      try { pose = heli3dPose(this.map); } catch (e) { pose = null; }
      let hoistW = null;
      if (pose) {
        const mc = maplibregl.MercatorCoordinate.fromLngLat([pose.lon, pose.lat], pose.alt);
        const s = mc.meterInMercatorCoordinateUnits(), R = heli3dRot(pose.hdg, pose.pit, pose.bnk);
        const SR = _m3Mul([[s, 0, 0], [0, -s, 0], [0, 0, s]], R);
        if (!cam && typeof heli3dShown === 'function' && heli3dShown())
          _h3Draw(h, h.hoist, f32(_m4Mul(main, _m4From(SR, [mc.x, mc.y, mc.z]))), _r3(R), 1);
        const a = HOIST_PT;
        hoistW = { x: mc.x + SR[0][0] * a[0] + SR[0][1] * a[1] + SR[0][2] * a[2],
                   y: mc.y + SR[1][0] * a[0] + SR[1][1] * a[1] + SR[1][2] * a[2],
                   z: mc.z + SR[2][0] * a[0] + SR[2][1] * a[1] + SR[2][2] * a[2], s };
      }
      const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      // 케이블 · 고리 — 붐 끝에서 곧게 아래로
      if (hoistW && hoistFt > 0) {
        const L = hoistFt * 0.3048, s = hoistW.s;
        _h3Draw(h, h.cable, f32(_m4Mul(main, _m4From([[s, 0, 0], [0, -s, 0], [0, 0, s * L]], [hoistW.x, hoistW.y, hoistW.z]))), _r3(I), 1);
        _h3Draw(h, h.hook, f32(_m4Mul(main, _m4From([[s, 0, 0], [0, -s, 0], [0, 0, s]], [hoistW.x, hoistW.y, hoistW.z - L * s]))), _r3(I), 1);
      }
      if (!showSurv) return;
      // 요구조자 — 헬기 쪽을 본다
      const face = (Math.atan2((S.lon - sar.lon) * Math.cos(sar.lat * Math.PI / 180), S.lat - sar.lat) * 180 / Math.PI + 360) % 360;
      const R = heli3dRot(face, 0, 0);
      if (sar.state === 'hooked' && hoistW) {
        const L = hoistFt * 0.3048, s = hoistW.s;
        const SR = _m3Mul([[s, 0, 0], [0, -s, 0], [0, 0, s]], R);
        _h3Draw(h, sar.type === 'water' ? h.hangW : h.hangL, f32(_m4Mul(main, _m4From(SR, [hoistW.x, hoistW.y, hoistW.z - L * s - 0.15 * s]))), _r3(R), 1);
        return;
      }
      let z = 0;
      try { const t = this.map.queryTerrainElevation([sar.lon, sar.lat]); if (Number.isFinite(t)) z = t; } catch (e) { _swallow(e); }
      if (sar.type === 'water') z = Math.max(0, z);
      const mc = maplibregl.MercatorCoordinate.fromLngLat([sar.lon, sar.lat], z);
      const s = mc.meterInMercatorCoordinateUnits();
      // 익수자는 물결에 오르내리고 든 팔을 흔든다(작게)
      const bob = sar.type === 'water' ? 0.06 * Math.sin(performance.now() / 700) : 0;
      _h3Draw(h, sar.type === 'water' ? h.water : h.land,
        f32(_m4Mul(main, _m4From(_m3Mul([[s, 0, 0], [0, -s, 0], [0, 0, s]], R), [mc.x, mc.y, mc.z + bob * s]))), _r3(R), 1);
      // SOS 비콘 — 멀리서도 보이게 거리에 따라 키운다(1NM 에서 약 9m · 가까이 0.3m)
      if (sarBeaconOn()) {
        const dM = distance(S.lat, S.lon, sar.lat, sar.lon) * 1852;
        const b = cam ? 0.25 : Math.max(0.3, dM * 0.005), top = sar.type === 'water' ? 1.05 : 1.35;
        _h3Draw(h, h.beacon, f32(_m4Mul(main, _m4From([[s * b, 0, 0], [0, -s * b, 0], [0, 0, s * b]], [mc.x, mc.y, mc.z + (top + b / 2 + bob) * s]))), _r3(I), 1);
      }
    },
  };
}
function _sarRepaint() {
  try { if (typeof _ml3d !== 'undefined' && _ml3d && _ml3d.getLayer && _ml3d.getLayer('sar-3d')) _ml3d.triggerRepaint(); } catch (e) { _swallow(e); }
  try { if (_sarCam.map) _sarCam.map.triggerRepaint(); } catch (e) { _swallow(e); }
}
// 3D 본 화면에 한 번 얹는다(지도 꾸밈이 서면)
setInterval(() => {
  try {
    // 지도 꾸밈(style)만 서면 얹는다 — 타일을 기다리지 않는다(헬기 모형과 같다)
    if (typeof _ml3d === 'undefined' || !_ml3d || !_ml3d.style || !_ml3d.style._loaded || _ml3d.getLayer('sar-3d')) return;
    _ml3d.addLayer(_sarLayer(false));
  } catch (e) { _swallow(e); }
}, 500);

// ── HOIST CAM — SYSTEM 창 Video(Channel HOIST) 큰 칸에 붐에서 바로 아래를 보는 3D 지도 ──
const _sarCam = { map: null, el: null, hud: null, rect: null, timer: null, mode: null, offT: 0 };
const HOISTCAM_FOV = 60;                                // 가로 화각(°)
// 18-system.js _sysPaint 가 부른다 — show: 보일 때 · rect: 큰 칸(창 안 px)
function sarHoistCamSlot(show, rect) {
  const wrap = document.getElementById('sysp-wrap');
  // SYSTEM 창이 화면에 없으면(Cockpit Mode 등) 여기서는 손대지 않는다 — 조종석 MFD 가 쓰는 화면 밖 지도(sarHoistCamDrawTo)는 그대로
  const vis = !!(wrap && wrap.clientWidth > 40 && wrap.clientHeight > 40);
  if (!show || !wrap || typeof maplibregl === 'undefined') { if (_sarCam.mode === 'slot') _sarCamDestroy(); return; }
  if (!vis) { if (_sarCam.mode === 'slot') _sarCamDestroy(); return; }
  if (!_sarCam.el || _sarCam.mode !== 'slot' || _sarCam.el.parentElement !== wrap) {
    _sarCamDestroy();
    const el = document.createElement('div'); el.id = 'sysp-hoist';
    wrap.appendChild(el);
    _sarCamCreate(el, 'slot');
  }
  const css = ['left', 'top', 'width', 'height'].map(k => `${k}:${rect[k].toFixed(1)}px`).join(';');
  if (_sarCam.rect !== css) {
    _sarCam.rect = css;
    ['left', 'top', 'width', 'height'].forEach(k => { _sarCam.el.style[k] = rect[k].toFixed(1) + 'px'; });
    try { if (_sarCam.map) _sarCam.map.resize(); } catch (e) { _swallow(e); }
  }
}
// 지도 · HUD 를 그 그릇(el)에 만든다 — mode 'slot'(SYSTEM 창 큰 칸) · 'off'(화면 밖 — Cockpit Mode MFD 에 옮겨 그린다)
function _sarCamCreate(el, mode) {
  const mapEl = document.createElement('div'); mapEl.className = 'hcam-map';
  const hud = document.createElement('canvas'); hud.className = 'hcam-hud';
  el.appendChild(mapEl); el.appendChild(hud);
  _sarCam.el = el; _sarCam.hud = hud; _sarCam.mode = mode; _sarCam.offT = performance.now();
  try {
    const map = new maplibregl.Map({ container: mapEl, style: _map3dStyle(), center: [S.lon, S.lat], zoom: 19, pitch: 0, bearing: S.hdg,
      maxZoom: 24, interactive: false, attributionControl: false, pixelRatio: (typeof map3dPixelRatio === 'function') ? map3dPixelRatio(true) : 1,
      canvasContextAttributes: { preserveDrawingBuffer: true } });   // 조종석 MFD 캔버스로 옮겨 그릴 수 있게
    map.on('error', e => console.warn('[HOIST CAM]', e && e.error ? e.error.message : e));
    // 꾸밈이 서면 함정 · 요구조자 · 고리를 얹고(타일을 기다리지 않는다), 다 뜨면 지형을 건다
    map.on('style.load', () => {
      try { if (typeof _ship3dAddTo === 'function' && !map.getSource('ship-3d')) _ship3dAddTo(map); } catch (e) { _swallow(e); }
      try { if (!map.getLayer('sar-3d')) map.addLayer(_sarLayer(true)); } catch (e) { _swallow(e); }
    });
    map.on('load', () => { try { map.setTerrain({ source: 'terrain', exaggeration: MAP3D_EXAG }); } catch (e) { _swallow(e); } });
    _sarCam.map = map;
  } catch (e) { console.warn('[HOIST CAM] map failed:', e); }
  _sarCam.timer = setInterval(_sarCamUpdate, 50);
}
// Cockpit Mode SYSTEM MFD(15-heli3d.js ckpitDraw)가 부른다 — SYSTEM 창이 화면에 없으면 화면 밖에 지도를 두고
// 그 그림(지도 + HUD)을 MFD 의 큰 칸(x, y, w, h)에 옮겨 그린다. 1.5초 동안 부르지 않으면 거둔다.
function sarHoistCamDrawTo(g, x, y, w, h) {
  if (typeof maplibregl === 'undefined') return;
  if (!_sarCam.map) {
    const el = document.createElement('div'); el.id = 'hoist-off';
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;height:480px;pointer-events:none;overflow:hidden';
    document.body.appendChild(el);
    _sarCamCreate(el, 'off');
  }
  _sarCam.offT = performance.now();
  try { const mc = _sarCam.map.getCanvas(); if (mc && mc.width) g.drawImage(mc, x, y, w, h); } catch (e) { _swallow(e); }
  try { if (_sarCam.hud && _sarCam.hud.width) g.drawImage(_sarCam.hud, x, y, w, h); } catch (e) { _swallow(e); }
}
function _sarCamDestroy() {
  clearInterval(_sarCam.timer); _sarCam.timer = null;
  try { if (_sarCam.map) _sarCam.map.remove(); } catch (e) { _swallow(e); }
  try { if (_sarCam.el) _sarCam.el.remove(); } catch (e) { _swallow(e); }
  _sarCam.map = null; _sarCam.el = null; _sarCam.hud = null; _sarCam.rect = null; _sarCam.mode = null;
}
function sarHoistCamOn() { return !!_sarCam.map; }
// 붐 끝 높이(전파고도 + 붐 높이)에서 가로 화각 60° 로 보이는 넓이에 맞춰 확대 단계를 고른다
function sarHoistCamZoom(wPx) {
  const hM = Math.max(1.5, (_sarRa() + HOIST_Z_FT) * 0.3048);
  const widthM = 2 * hM * Math.tan(HOISTCAM_FOV / 2 * Math.PI / 180);
  const mpp = widthM / Math.max(50, wPx);
  const z = Math.log2(40075016.686 * Math.cos(S.lat * Math.PI / 180) / (512 * mpp));
  return Math.max(12, Math.min(23.5, z));
}
function _sarCamUpdate() {
  const map = _sarCam.map, el = _sarCam.el;
  if (!map || !el) return;
  const w = el.clientWidth, H = el.clientHeight;
  // SYSTEM 창이 화면에서 내려갔으면(다른 창을 골랐거나 숨겼으면) 지도를 거둔다 — 그래픽 부담
  if (!el.isConnected || !(w > 0 && H > 0) || (typeof sysPage !== 'undefined' && (sysPage !== 'asys_video' || videoCfg.ch !== 'HOIST'))) { _sarCamDestroy(); return; }
  if (_sarCam.mode === 'off' && performance.now() - _sarCam.offT > 1500) { _sarCamDestroy(); return; }   // 조종석 MFD 가 더는 그리지 않는다
  const [hl, ho] = sarHookLL();
  try { map.jumpTo({ center: [ho, hl], zoom: sarHoistCamZoom(w), bearing: S.hdg, pitch: 0 }); } catch (e) { _swallow(e); }
  // HUD — 가운데 십자(바로 아래 = 고리가 내려가는 자리) · 케이블 · 높이 차 · 거리 · 유지 시간
  const c = _sarCam.hud; if (!c || !(w > 0 && H > 0)) return;
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(H * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, H);
  const k = Math.max(0.6, Math.min(1.4, w / 760));
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5;
  const cx = w / 2, cy = H / 2, r = 18 * k;
  g.beginPath(); g.moveTo(cx - 3 * r, cy); g.lineTo(cx - r, cy); g.moveTo(cx + r, cy); g.lineTo(cx + 3 * r, cy);
  g.moveTo(cx, cy - 3 * r); g.lineTo(cx, cy - r); g.moveTo(cx, cy + r); g.lineTo(cx, cy + 3 * r); g.stroke();
  // 결속 반경 10m 원
  try {
    const mpp = 40075016.686 * Math.cos(S.lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
    const rr = SAR_CAP_R / mpp;
    if (rr < Math.max(w, H)) { g.setLineDash([6, 5]); g.strokeStyle = 'rgba(80,255,140,0.7)'; g.beginPath(); g.arc(cx, cy, rr, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); }
  } catch (e) { _swallow(e); }
  const G = sarGeom(), pw = hoistPowered();
  g.font = `bold ${Math.round(15 * k)}px Helvetica Neue, Arial, sans-serif`; g.textAlign = 'left';
  const txt = (s, x, y, col) => { g.fillStyle = 'rgba(0,0,0,0.55)'; const tw = g.measureText(s).width; g.fillRect(x - 3, y - 15 * k, tw + 6, 19 * k); g.fillStyle = col || '#fff'; g.fillText(s, x, y); };
  txt('HOIST CAM', 10, 22 * k, '#7ab8f5');
  txt(pw ? 'HOIST ENABLE' : 'HOIST OFF', 10, 46 * k, pw ? '#4ade80' : '#ffb000');
  txt(`CABLE ${Math.round(hoistFt)} FT`, 10, 70 * k);
  txt(`RA ${Math.round(_sarRa())} FT`, 10, 94 * k);
  if (sar.on && sar.state !== 'aboard') {
    txt(`HOOK ${G.dh >= 0 ? '+' : ''}${Math.round(G.dh)} FT`, 10, 118 * k, Math.abs(G.dh) <= SAR_CAP_DH ? '#4ade80' : '#fff');
    if (G.dist !== null) {
      const clock = Math.round(((G.brg - S.hdg + 360) % 360) / 30) || 12;
      txt(`SURV ${G.dist < 1000 ? Math.round(G.dist) + ' M' : (G.dist / 1852).toFixed(2) + ' NM'} · ${clock} O'CLOCK`, 10, 142 * k, G.dist <= SAR_CAP_R ? '#4ade80' : '#fff');
    }
  }
  const st = !sar.on ? '' : sar.state === 'hooked' ? 'HOOKED — HOIST UP' : sar.state === 'aboard' ? 'RESCUED' : sar.hold > 0 ? `HOLD ${sar.hold.toFixed(0)}/${SAR_CAP_T} S` : '';
  if (st) { g.textAlign = 'center'; g.font = `bold ${Math.round(20 * k)}px Helvetica Neue, Arial, sans-serif`; txt(st, cx - g.measureText(st).width / 2, H - 20 * k, '#ffcc66'); }
  if (sar.state === 'wait' && sar.hold > 0) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - 100 * k, H - 60 * k, 200 * k, 10 * k);
    g.fillStyle = '#4ade80'; g.fillRect(cx - 100 * k, H - 60 * k, 200 * k * sar.hold / SAR_CAP_T, 10 * k);
  }
}

try { appRegister({ toggleSarPanel, sarPanelOpen, sarPanelClose }); } catch (e) { _swallow(e); }
