// 07b-fcp.js — 07-sim.js 에서 나눴다(차례 그대로): FCP SIMPLE(AFCS 조작 패널) · PFD 소프트키
// ══════════════════════════════════════════════════════
// FCP SIMPLE — 실기 AFCS 조작 패널 모양(사진)으로 간추린 FCP. 왼쪽 세로 탭 하나로 지금 FCP ⇄ SIMPLE.
//   위: IAS · HDG · VS · ALT.A · [ALT] · CR.HT  |  BARO · UPLIM
//   아래: [ ] · [NAVD CPL] · [ ] · [T-DOWN] · [T.D.HOV] · H.HT  |  CRS · DH
// 노브: 왼쪽(‹)/오른쪽(›)을 누르면 돌린다(누르고 있으면 계속) · 가운데를 누르면 노브 누름(PUSH).
// 기능은 지금 FCP 와 같은 함수(applyDelta · fcpSync · toggleAltHold …)를 부른다.
// UPLIM · DH 와 빈 버튼 둘은 아직 기능이 없다(자리만).
const FCPS_KNOBS = {
  ias:  { lbl: 'IAS',   rot: ['spd', 1],   push: ['fcpSync', 'ias'] },
  hdg:  { lbl: 'HDG',   rot: ['hdg', 1],   push: ['fcpSync', 'hdg'] },
  vs:   { lbl: 'VS',    rot: ['vs', 100],  push: ['vsPush'] },     // 돌려 고르고 누르면 건다(01-state.js)
  alta: { lbl: 'ALT.A', rot: ['alt', 100], push: ['altaPush'] },   // 돌려 목표 고도 · 누르면 VS + ALT 무장
  crht: { lbl: 'CR.HT', rot: ['crht', 10], push: ['crhtPush'] },   // 돌려 고르고 누르면 켜고 끈다
  hht:  { lbl: 'H.HT',  rot: ['hht', 10] },
  baro: { lbl: 'BARO',  rot: ['baro', 1],  push: ['fcpsBaroStd'] },
  uplim:{ lbl: 'UPLIM', rot: ['uplim', 1], push: ['altLimSrc', 'up'] },   // 고도 경고 상한 · 누르면 RA ⇄ BARO
  crs:  { lbl: 'CRS',   rot: ['crs', 1],   push: ['fcpSync', 'crs'] },
  dh:   { lbl: 'DH',    rot: ['dh', 1],    push: ['altLimSrc', 'dh'] },   // 고도 경고 하한 · 누르면 RA ⇄ BARO
  // 오른쪽 영역(사용자 기능) — 바람
  wdir: { lbl: 'WIND DIR', rot: ['wdir', 5] },
  wspd: { lbl: 'WIND SPD', rot: ['wspd', 1] },
};
function _fcpsKnob(k) {
  const d = FCPS_KNOBS[k];
  const push = d.push ? ` data-act="${d.push[0]}"${d.push[1] ? ` data-arg='["${d.push[1]}"]'` : ''}` : '';
  return `<div class="fks-cell${d.none ? ' fks-none' : ''}" data-k="${k}"><div class="fks-lbl">${d.lbl}</div>` +
    `<div class="fks-knob">${d.rot ? `<b class="fks-dn" data-rot="${d.rot[0]},${-d.rot[1]}">‹</b><b class="fks-up" data-rot="${d.rot[0]},${d.rot[1]}">›</b>` : ''}` +
    `<i class="fks-push"${push}></i></div><div class="fks-val" id="fks-${k}"></div></div>`;
}
function _fcpsBtn(id, lbl, act, framed) {
  return `<div class="fks-cell"><div class="fks-lbl">${lbl || '&nbsp;'}</div>` +
    `<div class="fks-sq${framed ? ' framed' : ''}${act ? '' : ' fks-none'}" id="fks-${id}"${act ? ` data-act="${act}"` : ''}></div><div class="fks-val"></div></div>`;
}
function _fcpsBuild() {
  const bar = document.querySelector('#pfd-wrap .ctrl-bar');
  if (!bar || document.getElementById('fcp-simple')) return;
  const p = document.createElement('div'); p.id = 'fcp-simple';
  p.innerHTML = `<div class="fks-main"><div class="fks-l">` +
      _fcpsKnob('ias') + _fcpsKnob('hdg') + _fcpsKnob('vs') + _fcpsKnob('alta') + _fcpsBtn('alt', 'ALT', 'toggleAltHold', true) + _fcpsKnob('crht') +
      _fcpsBtn('b1', '', '') + _fcpsBtn('navd', 'NAVD CPL', 'navCplPush', true) + _fcpsBtn('b2', '', '') +
      _fcpsBtn('tdown', 'T-DOWN', 'tdownSet') + _fcpsBtn('tdh', 'T.D.HOV', 'tdhEngage') + _fcpsKnob('hht') +
    `</div><div class="fks-div"></div><div class="fks-r">` +
      _fcpsKnob('baro') + _fcpsKnob('uplim') + _fcpsKnob('crs') + _fcpsKnob('dh') + `</div></div>` +
    // UPLIM · DH 오른쪽 — 구분선 + 사용자 기능 영역(바람 노브 · RNP · SIM SPD · FORCE TRIM · G/A · GSPD · 트림 · 페달)
    `<div class="fks-div fks-div2"></div><div class="fks-x"><div class="fks-xw">` + _fcpsKnob('wdir') + _fcpsKnob('wspd') + `</div>` +
    `<div class="fks-xr"><div class="fks-xr1"></div><div class="fks-xr2"></div></div></div>`;
  bar.appendChild(p);
  // 옛 FCP 의 나머지 버튼 무리를 그대로(누름 · 홀드가 붙은 채) 옮겨 온다 — 옛 FCP 줄은 모두 없앤다
  const r1 = p.querySelector('.fks-xr1'), r2 = p.querySelector('.fks-xr2');
  const mv = (sel, to) => { const e = bar.querySelector(sel); if (e) to.appendChild(e); };
  // 두 줄의 폭이 가장 좁게 — 윗줄: RNP · SIM SPD · FORCE TRIM/G/A · GSPD / 아랫줄: COLLECTIVE TRIM · 4-WAY TRIM · ANTI-TORQUE PEDAL
  mv('.nav-src-group', r1);            // RNP
  mv('.simspd-group', r1);             // SIM SPD
  mv('.ftr-col', r1);                  // FORCE TRIM · G/A
  mv('#gspd-btn', r1);                 // GSPD
  mv('#trim-group', r2);               // COLLECTIVE TRIM · 4-WAY TRIM · ANTI-TORQUE PEDAL
  bar.querySelectorAll(':scope > .ctrl-sub-row').forEach(r => r.remove());
  // 노브 돌리기 — 누르고 있으면 계속(지금 FCP ▲▼ 와 같은 빠르기)
  p.querySelectorAll('[data-rot]').forEach(el => {
    const [f, dStr] = el.dataset.rot.split(','), d = +dStr;
    let timer = null, interval = null, guard = null;
    const step = () => { if (f === 'baro') fcpsBaro(d); else applyDelta(f, d); fcpsSync(); };
    function stop() { clearTimeout(timer); clearInterval(interval); clearTimeout(guard); timer = interval = guard = null; _holdStops.delete(stop); }
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (timer || interval) return;
      step(); _holdStops.add(stop);
      guard = setTimeout(stop, HOLD_MAX_MS);
      timer = setTimeout(() => { interval = setInterval(step, 80); }, 350);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, stop));
  });
  fcpsSync();
  requestAnimationFrame(() => { try { resizePFD(); drawPFD(); } catch (e) { _swallow(e); } });
}
// BARO — QNH 를 1 hPa(IN 이면 0.01 inHg) 씩 · 누르면 STD(29.92 inHg = 1013.25 hPa)
// 표준 기압 — 29.92 inHg = 1013.25 hPa. IN 으로 볼 때는 0.01 inHg 씩, HPA 로 볼 때는 1 hPa 씩 돈다
const QNH_STD = 1013.25, HPA_PER_IN = 33.8639;
function fcpsBaro(d) {
  const q = (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa)) ? window._qnhHpa : QNH_STD;
  const inHg = typeof pfdBaroUnit !== 'undefined' && pfdBaroUnit === 'IN';
  const nq = inHg ? (Math.round(q / HPA_PER_IN * 100) + d) / 100 * HPA_PER_IN : Math.round(q) + d;
  window._qnhHpa = Math.max(940, Math.min(1060, nq));
  try { drawPFD(); } catch (e) { _swallow(e); }
}
// BARO 노브 누름 — STD(1013) ⇄ 앞서 쓰던 QNH
let _baroQnhPrev = null;
function fcpsBaroStd() {
  const q = Number.isFinite(window._qnhHpa) ? window._qnhHpa : QNH_STD;
  if (Math.abs(q - QNH_STD) < 0.01 && _baroQnhPrev !== null) { window._qnhHpa = _baroQnhPrev; _baroQnhPrev = null; }
  else { _baroQnhPrev = q; window._qnhHpa = QNH_STD; }
  try { drawPFD(); } catch (e) { _swallow(e); } fcpsSync();
}
// 노브 아래 작은 값 · 걸린 모드는 노브 테·버튼이 녹색
function fcpsSync() {
  const p = document.getElementById('fcp-simple');
  if (!p) return;
  const set = (id, txt) => { const e = document.getElementById('fks-' + id); if (e && e.textContent !== txt) e.textContent = txt; };
  const on = (k, v) => { const c = p.querySelector(`[data-k="${k}"]`) || document.getElementById('fks-' + k); if (c && c.classList.contains('on') !== !!v) c.classList.toggle('on', !!v); };
  const g = (f, d) => { try { return f(); } catch (e) { return d; } };
  // 노브가 실제로 옮기는 값을 보인다(applyDelta 와 같은 갈래)
  // Bell 206 은 AFCS 가 없는 기체 — IAS 가 걸려 있지 않으면 지금 속도(속도계와 같은 값)를 보인다
  const _b206 = typeof acIs === 'function' && acIs('b206');
  set('ias', String(Math.round(_b206 ? (simIasOn ? selSpd : S.spd) : (iasModeOn() || g(() => fcpPre.ias, false) ? selSpd : S.spd))));   // 걸렸거나 고르는 중이면 기준 · 아니면 지금 속도
  set('hdg', String(((Math.round(selHdg) + 359) % 360) + 1).padStart(3, '0') + '°');
  { const v = Math.round(selVS); set('vs', (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v)); }   // 고른 승강률(부호)
  set('alta', String(Math.round(g(() => altaSelGet(), selAlt))));                                   // 고른 목표 고도
  set('crht', String(Math.round(selCrht)));
  set('hht', String(Math.round(selHht)));
  { const L = g(() => altLim, null), f = x => (x && x.v > 0) ? `${x.v} ${x.src}` : `OFF ${x ? x.src : ''}`;   // UPLIM · DH — 경계 · 기준(RA/BARO)
    if (L) { set('uplim', f(L.up)); set('dh', f(L.dh)); on('uplim', L.up.v > 0); on('dh', L.dh.v > 0); } }
  { const q = g(() => (Number.isFinite(window._qnhHpa) ? window._qnhHpa : QNH_STD), QNH_STD);
    set('baro', (typeof pfdBaroUnit !== 'undefined' && pfdBaroUnit === 'IN') ? (q / HPA_PER_IN).toFixed(2) : String(Math.round(q))); }
  set('crs', fmtA(g(() => (navSrc !== 'FMS' ? vorObsCrs : S.crs), S.crs)) + '°');
  on('ias', g(() => iasModeOn(), false));
  on('hdg', g(() => hdgSelOn, false));
  on('crht', g(() => crhtOn, false));
  on('alt', g(() => altHoldOn, false));
  on('vs', g(() => vsModeOn, false));
  on('alta', g(() => altArmed, false));
  on('navd', g(() => navApOn, false));
  { const nv = document.getElementById('fks-navd'); if (nv) nv.classList.toggle('arm', g(() => navArmed && !navApOn, false)); }   // NAV 무장(흰 테)
  on('tdh', g(() => tdOn, false));
  set('wdir', fmtA(toMag(windDir)) + '°');
  set('wspd', Math.round(windSpd) + 'kt');
  // GSPD 중에는 NAV 가 조향하지 못한다(updateApInhibit) — NAVD CPL 도 흐린 테로
  const nv = document.getElementById('fks-navd');
  if (nv) nv.classList.toggle('ap-inh', g(() => gspdOn || gspdCoasting, false));
}
try { _fcpsBuild(); } catch (e) { _swallow(e); }
setInterval(() => { try { fcpsSync(); } catch (e) { _swallow(e); } }, 250);

// ══════════════════════════════════════════════════════
// PFD 소프트키(터치바) — KUH-1CG FLM 그림 5~8 의 트리. PFD 바로 아래(FCP 맨 위 한 줄) 12칸.
// 최상위: Map Range − · Map Range + · PFD Map Settings ▸ · Traffic Map · PFD Settings ▸ · OBS · Active NAV(VOR1→VOR2→FMS) ·
//         Sensors ▸ · Hover Display · Hover Position · CAS · SIM
// 하위 메뉴(▸)는 Back 으로 한 단계 위로, 45초 동안 누르지 않으면 최상위로 돌아간다.
// 켜진 기능은 칸 아래 녹색 바, 지금 쓸 수 없는 칸은 회색으로 흐려진다.
// 아직 시뮬레이터와 잇지 않은 칸(Traffic · Terrain · WX · Detail · Map Layout · Meters · RA1/2 · CAS)은 고른 상태만 기억한다.
const SK_IDLE_MS = 45000;
const skState = { tfcMap: false, traffic: false, detail: 'ALL', terrain: 'OFF', wx: false, ltg: false, layout: 'Inset Map',
                  meters: false, ra: 'RA1' };
let pfdBaroUnit = 'HPA';      // PFD 기압 칸 단위(UNITS 메뉴의 IN · HPA)
try { const v = JSON.parse(localStorage.getItem('pfdSk') || 'null'); if (v) { Object.assign(skState, v.s || {}); if (v.baro) pfdBaroUnit = v.baro; } } catch (e) { _swallow(e); }
function _skSave() { try { localStorage.setItem('pfdSk', JSON.stringify({ s: skState, baro: pfdBaroUnit })); } catch (e) { _swallow(e); } }
const _skCyc = (k, arr) => () => { skState[k] = arr[(arr.indexOf(skState[k]) + 1) % arr.length]; _skSave(); };
const _skTog = k => () => { skState[k] = !skState[k]; _skSave(); };
const _skRadio = (k, v) => ({ lbl: v, on: () => skState[k] === v, act: () => { skState[k] = v; _skSave(); } });
const _skBack = { lbl: 'Back', back: true };
const _skDis = id => { const b = document.getElementById(id); return !!(b && b.disabled); };
const SK_MENUS = {
  TOP: [
    { lbl: 'Map<br>Range −', act: () => { try { leafMap.setZoom(leafMap.getZoom() - 1); } catch (e) { _swallow(e); } } },
    { lbl: 'Map<br>Range +', act: () => { try { leafMap.setZoom(leafMap.getZoom() + 1); } catch (e) { _swallow(e); } } },
    { lbl: 'PFD Map<br>Settings', go: 'MAPSET' },
    { lbl: 'Traffic<br>Map', on: () => skState.tfcMap, act: _skTog('tfcMap') },
    { lbl: 'PFD<br>Settings', go: 'PFDSET' },
    // OBS — 홀딩 · 오비트 · 미스드어프로치처럼 다음 지점으로 넘어갈지 정할 자리면 SUSP 로 바뀐다(suspSoftkey)
    //   SUSP 는 옛 FCP 의 SUSP 와 같다(toggleSusp). 걸려 있으면(손으로 켬 · 홀딩으로 저절로) 녹색 바
    { lbl: () => suspSoftkey() ? 'SUSP' : 'OBS',
      on: () => suspSoftkey() ? navSuspended() : obsOn,   // 보류가 걸려 있으면(손으로 · 홀딩으로 저절로) 녹색 바
      dim: () => !suspSoftkey() && _skDis('obs-btn'),
      act: () => { if (suspSoftkey()) toggleSusp(); else toggleObs(); } },
    { lbl: 'Active NAV', sub: () => ({ FMS: 'FMS', NAV1: 'VOR1', NAV2: 'VOR2' })[navSrc] || navSrc, act: () => pfdSkNavCycle() },
    { lbl: 'Sensors', go: 'SENS' },
    // Hover Display — 80kt 아래(또는 켜져 있을 때)만 · FCP 의 HOVER PAGE · HOVER POS 버튼은 없앴다
    { lbl: 'Hover<br>Display', on: () => hoverPageOn, dim: () => !(hoverEligible() || hoverPageOn), act: () => { toggleHoverPage(); try { updateHoverBtns(); } catch (e) { _swallow(e); } } },
    { lbl: 'Hover<br>Position', on: () => hoverPosOn, act: () => toggleHoverPosition() },
    // CAS — 메시지가 넘쳐 숨겨지면 살아난다 · 누르면 CAS UP · CAS DN 으로 쪽을 넘긴다(03-pfd.js pfdCasStep)
    { lbl: 'CAS', dim: () => !(typeof pfdCasOverflow === 'function' && pfdCasOverflow()), on: () => typeof pfdCasOverflow === 'function' && pfdCasOverflow(), go: 'CAS' },
    // SIM — 조종간으로 직접 모는 모드(FCP 의 SIM 버튼을 옮겨 왔다 · simModeBtnPress)
    // (절차 훈련판 — 00-edition.js SIM_ENABLED 거짓 — 에서는 빈칸)
    // 12 — 승인하지 않은 경고 · 주의가 있으면 WARN ACK(적) · CAUT ACK(황) 점멸 · 누르면 승인(03-pfd.js casAckAll). 없으면 SIM
    { lbl: () => { const p = typeof casAckPending === 'function' ? casAckPending() : ''; if (p) return p === 'W' ? 'WARN<br>ACK' : 'CAUT<br>ACK';
                   return (typeof SIM_ENABLED === 'undefined' || SIM_ENABLED) ? 'SIM' : ''; },
      on: () => !(typeof casAckPending === 'function' && casAckPending()) && simModeOn,
      cls: () => { const p = typeof casAckPending === 'function' ? casAckPending() : ''; return p === 'W' ? 'ackw' : p === 'C' ? 'ackc' : ''; },
      dim: () => !(typeof casAckPending === 'function' && casAckPending()) && typeof SIM_ENABLED !== 'undefined' && !SIM_ENABLED,
      act: () => { if (typeof casAckPending === 'function' && casAckPending()) { casAckAll('PFD'); return; } if (typeof SIM_ENABLED === 'undefined' || SIM_ENABLED) simModeBtnPress(); } },
  ],
  // 그림 6 — PFD 지도 선택
  MAPSET: [
    { lbl: 'Map Layout', go: 'LAYOUT' },
    { lbl: 'Detail', sub: () => skState.detail, act: _skCyc('detail', ['ALL', 'DCLTR1', 'DCLTR2', 'Least']) },
    {}, { lbl: 'Traffic', on: () => skState.traffic, act: _skTog('traffic') }, {},
    { lbl: 'Terrain', sub: () => skState.terrain, act: _skCyc('terrain', ['OFF', 'absolute', 'relative']) },
    {}, { lbl: 'WX Overlay', sub: () => 'Connext', on: () => skState.wx, act: _skTog('wx') },
    { lbl: 'Lightning', on: () => skState.ltg, act: _skTog('ltg') }, {}, _skBack, {},
  ],
  LAYOUT: [
    _skRadio('layout', 'Map off'), _skRadio('layout', 'Inset Map'), _skRadio('layout', 'HSI Map'),
    _skRadio('layout', 'Inset<br>Traffic'), _skRadio('layout', 'HSI<br>Traffic'), {}, {}, {}, {}, {}, _skBack, {},
  ],
  // 그림 7 — PFD 조절
  PFDSET: [
    {}, {}, {}, {}, {},
    { lbl: 'Bearing1', sub: () => brgSrcLabel(1), act: () => brgSrcCycle(1) },
    { lbl: 'Bearing2', sub: () => brgSrcLabel(2), act: () => brgSrcCycle(2) },
    {}, { lbl: 'Other PFD<br>Settings', go: 'OTHER' }, {}, _skBack, {},
  ],
  OTHER: [{}, {}, { lbl: 'Altitude<br>Units', go: 'UNITS' }, {}, {}, {}, {}, {}, {}, {}, _skBack, {}],
  UNITS: [
    {}, {}, {}, {}, {},
    { lbl: 'Meters', on: () => skState.meters, act: _skTog('meters') }, {},
    { lbl: 'IN', on: () => pfdBaroUnit === 'IN', act: () => { pfdBaroUnit = 'IN'; _skSave(); pfdRefreshAll(); } },
    { lbl: 'HPA', on: () => pfdBaroUnit === 'HPA', act: () => { pfdBaroUnit = 'HPA'; _skSave(); pfdRefreshAll(); } },
    {}, _skBack, {},
  ],
  // 그림 8 — PFD 센서
  SENS: [{}, {}, { lbl: 'RA<br>Settings', go: 'RA' }, {}, {}, {}, {}, {}, {}, {}, _skBack, {}],
  RA: [{}, _skRadio('ra', 'RA1'), _skRadio('ra', 'RA2'), {}, {}, {}, {}, {}, {}, {}, _skBack, {}],
  CAS: [{}, {}, {}, {}, {}, {}, {}, {}, {},
    { lbl: 'CAS<br>UP', dim: () => !(typeof pfdCasCanUp === 'function' && pfdCasCanUp()), act: () => pfdCasStep(-1) },
    { lbl: 'CAS<br>DN', dim: () => !(typeof pfdCasCanDn === 'function' && pfdCasCanDn()), act: () => pfdCasStep(1) },
    _skBack],
};
let skMenu = 'TOP', _skStack = [], _skIdle = null;
function _pfdSkBuild() {
  const bar = document.querySelector('#pfd-wrap .ctrl-bar');
  if (!bar || document.getElementById('pfd-sk')) return;
  const sk = document.createElement('div'); sk.id = 'pfd-sk';
  sk.innerHTML = Array.from({ length: 12 }, (_, i) => `<div class="pfd-sk" id="sk-${i}" data-act="pfdSkPress" data-arg='[${i}]'><span></span><em></em><i></i></div>`).join('');
  bar.prepend(sk);   // FCP 맨 위 — 그 아래 FCP 패널
  pfdSkRender();
}
function pfdSkGo(m) {
  _skStack = m === 'TOP' ? [] : _skStack;
  skMenu = m; pfdSkRender(); _skArmIdle();
}
function _skArmIdle() {
  clearTimeout(_skIdle);
  if (skMenu !== 'TOP') _skIdle = setTimeout(() => { _skStack = []; skMenu = 'TOP'; pfdSkRender(); }, SK_IDLE_MS);
}
function pfdSkPress(i) {
  const it = (SK_MENUS[skMenu] || [])[i];
  if (!it || !it.lbl) { _skArmIdle(); return; }
  if (it.dim && it.dim()) return;
  if (it.back) { skMenu = _skStack.pop() || 'TOP'; }
  else if (it.go) { _skStack.push(skMenu); skMenu = it.go; }
  else if (it.act) { try { it.act(); } catch (e) { _swallow(e); } }
  pfdSkRender(); _skArmIdle();
}
// Active NAV — VOR1(NAV1) → VOR2(NAV2) → FMS → VOR1
function pfdSkNavCycle() {
  const order = ['NAV1', 'NAV2', 'FMS'];
  setNavSrc(order[(order.indexOf(navSrc) + 1) % order.length]);
}
function pfdSkRender() {
  const sk = document.getElementById('pfd-sk');
  if (!sk) return;
  const M = SK_MENUS[skMenu] || SK_MENUS.TOP;
  sk.dataset.menu = skMenu;
  [...sk.children].forEach((el, i) => {
    const it = M[i] || {};
    const lbl = (typeof it.lbl === 'function' ? it.lbl() : it.lbl) || '';
    const span = el.firstElementChild, em = span.nextElementSibling;
    if (span.innerHTML !== lbl) span.innerHTML = lbl;
    const sub = it.sub ? it.sub() : '';
    if (em.textContent !== sub) em.textContent = sub;
    const ck = it.cls ? it.cls() : '';
    const flags = { none: !it.lbl, on: !!(it.on && it.on()), auto: !!(it.auto && it.auto()), off: !!(it.dim && it.dim()), go: !!it.go, ackw: ck === 'ackw', ackc: ck === 'ackc' };
    Object.entries(flags).forEach(([c, v]) => { if (el.classList.contains(c) !== v) el.classList.toggle(c, v); });
  });
}
function pfdSkSync() { pfdSkRender(); }
try { _pfdSkBuild(); } catch (e) { _swallow(e); }
setInterval(() => { try { pfdSkRender(); } catch (e) { _swallow(e); } }, 250);
