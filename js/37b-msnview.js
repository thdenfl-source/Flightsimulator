'use strict';
// ══════════════════════════════════════════════════════
// 37b-msnview.js — 흰수리 전탐석 조작기(탐색등 · VCCP) · EO/IR 영상 · NAVI 지도 칸 · 호이스트 칸 · Vendor 창 · 키보드 · 다른 기기 — 37-mission.js 에서 나눈 조각
//   차례: 37-mission.js → 37a-dvr.js → 37b-msnview.js(맨 끝 — 화면 박자 · 등록을 건다)
// ══════════════════════════════════════════════════════
// ══ 탐색등 조작기(HSL-1600 HCU) — LSR/OFF · IR/VIS · LAMP/OFF · INIT/STOW · OFFSET · MAN/AUTO · FOCUS · 조이스틱 · 표시등 ══
//   (자세한 기능은 교범을 받아 더한다 — 지금은 켜고 끄기 · 수동/연동 · 지향 · 표시등)
const slc = { lsr: false, ir: false, test: false, dim: 1, rdim: 1, joy: { x: 0, y: 0 }, down: {} };
function slcPress(k, down) {
  if (down) slc.down[k] = true; else delete slc.down[k];
  if (k === 'test') slc.test = down;
  if (!down) { slcRender(); return; }
  switch (k) {
    case 'lsr': slc.lsr = !slc.lsr; break;
    case 'ir': hsl.ir = !hsl.ir; slc.ir = hsl.ir; if (hsl.lamp && !hsl.ir && typeof env !== 'undefined' && env.nvg) _mToast('⚠ 주의 — NVG 를 쓴 조종사의 허락 없이 가시광(VIS)으로 바꾸지 마십시오'); _mNote(`탐조등 ${hsl.ir ? 'IR' : 'VIS'}`); break;
    case 'lamp': hslLampSet(!hsl.lamp); break;
    case 'init': if (hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW')) hslInit(); else hslStow(); break;
    case 'manauto': if (!hsl.pwr) { _mToast('SEARCH LT PWR 꺼짐'); break; } srchMode(srch.mode === 'MAN' ? 'EO' : 'MAN'); break;
    case 'offset': _mToast('탐조등 OFFSET — 기능은 교범을 받아 더합니다'); break;
    case 'hdim:up': slc.dim = Math.min(1, slc.dim + 0.25); break; case 'hdim:dn': slc.dim = Math.max(0.25, slc.dim - 0.25); break;
    case 'rdim:up': slc.rdim = Math.min(1, slc.rdim + 0.25); break; case 'rdim:dn': slc.rdim = Math.max(0.25, slc.rdim - 0.25); break;
  }
  slcRender(); msnRenderPanels();
}
function slcStep(dt) {
  const j = slc.joy; if (Math.hypot(j.x, j.y) < 0.05 || !hsl.pwr || hsl.stowed || hsl.mv) return;
  srch.mode = 'MAN';
  hsl.az = _mClamp(hsl.az + j.x * Math.abs(j.x) * HSL.azRate * dt, HSL.azMin, HSL.azMax);
  hsl.el = _mClamp(hsl.el + j.y * Math.abs(j.y) * HSL.elRate * dt, HSL.elMin, HSL.elMax);
}
function slcRender() {
  if (!_msnEl) return;
  const T = slc.test, blink = Math.floor(performance.now() / 400) % 2 === 0;
  const L = { FAULT: hsl.fault, LSR: slc.lsr, LAMP: hsl.lit || (hsl.lamp && blink), PWR: hsl.pwr, BLK: hsl.pwr && (hsl.stowed || !!hsl.mv), AUTO: srch.mode !== 'MAN', IR: hsl.ir, STW: hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW' && blink) };
  _msnEl.querySelectorAll('[data-sll]').forEach(e => { const n = e.dataset.sll; e.classList.toggle('on', !!(T || L[n])); e.classList.toggle('f', n === 'FAULT'); });
  const lm = _msnEl.querySelector('[data-m="slclm"]'); if (lm) { lm.classList.toggle('dim', slc.dim < 0.75); lm.style.opacity = String(0.4 + 0.6 * slc.dim); }
  const kpos = { lsr: slc.lsr, ir: hsl.ir, lamp: hsl.lamp, init: !(hsl.stowed || (hsl.mv && hsl.mv.to === 'STOW')) };
  _msnEl.querySelectorAll('.slc-sw .k').forEach(e => { const v = kpos[e.dataset.slc]; e.classList.toggle('up', !!v); e.classList.toggle('dn', !v); });
  _msnEl.querySelectorAll('.slc-pb b').forEach(e => e.classList.toggle('dn', !!slc.down[e.dataset.slc]));
  const pw = _msnEl.querySelector('[data-mact="slpwr"]'); if (pw) { pw.classList.toggle('on', hsl.pwr); pw.textContent = `SEARCH LT PWR ${hsl.pwr ? 'ON' : 'OFF'}`; }
}
// ══ 탐색레이더 조작기(VCCP — Video Converter Control Panel · FLM 5.20) ══
//   MAP 지도 메뉴 · ESC · CLR 뒤로(하위 메뉴 → 메뉴 닫기) · 메뉴 밖 CLR 은 추적 풀기 · FNC 메인 메뉴(화면 왼쪽 세로) · WXR 강수 겹 · TWS 지형 겹 · COM/TFC 쓰지 않음
//   손잡이: 돌림 — 메뉴가 없으면 거리(RNG), 메뉴가 있으면 칸 옮기기 / 누름 — 메뉴 칸 실행 · 없으면 커서 자리 표적 추적(TRK) / 4축(8방향) — 커서
const nv = { nm: 5, cur: null, ctr: null, pushT: 0 };
const NV_RNG = [1, 2, 5, 10, 20, 40];
// 조종실(하부 콘솔 ⑮ VCCP · CDU 노브)이 다룰 수 있는가 — CABIN 이면 전탐석만
function rdrCkptOk() { return rdr.cmd !== 'CABIN'; }
function rdrSideOk(side) { return side === 'CKPT' ? rdrCkptOk() : rdrCabinOk(); }
let _clnSide = 'CABIN';
function _rdrGuard(k) {
  if (rdrSideOk(_clnSide)) return true;
  // 권한이 없는 쪽 — 메뉴를 열어 RDR > CMD 만 바꿀 수 있다
  if (k === 'fnc' || k === 'esc' || (rdr.menu && (k.startsWith('rot:') || k === 'push' || k === 'clr' || /^n[1-9]$/.test(k)))) return true;
  _mToast(_clnSide === 'CKPT' ? 'RDR CMD CABIN — 전탐석이 레이더를 쥐고 있습니다(FNC → CMD ▷ 를 CKPT · INTRLV 로)'
                              : 'RDR CMD CKPT — 조종실이 레이더를 쥐고 있습니다(FNC → CMD ▷ 를 CABIN · INTRLV 로)');
  return false;
}
// 메뉴 — 누름(실행 · 하위 메뉴 열기) · 뒤로(하위 메뉴 닫기 → 메뉴 닫기)
function rdrMenuPush() {
  const M = RDR_MENU[rdr.menu]; if (!M) return;
  rdr.menuT = performance.now();
  const ok = it => rdrSideOk(_clnSide) || it.any;
  if (rdr.sub !== null) {
    const it = M[rdr.sub].sub[rdr.subI]; if (!it) return;
    if (!ok(it)) { _mToast(`RDR CMD ${RDR_CMD_NM[rdr.cmd]} — CMD 만 바꿀 수 있습니다`); return; }
    it.set(1); return;
  }
  const it = M[rdr.menuI]; if (!it) return;
  if (it.sub) { if (!ok(it)) { _mToast(`RDR CMD ${RDR_CMD_NM[rdr.cmd]} — CMD 만 바꿀 수 있습니다`); return; } rdr.sub = rdr.menuI; rdr.subI = 0; return; }
  if (!ok(it)) { _mToast(`RDR CMD ${RDR_CMD_NM[rdr.cmd]} — CMD 만 바꿀 수 있습니다`); return; }
  it.set(1);
}
function rdrMenuBack() { if (rdr.sub !== null) rdr.sub = null; else rdr.menu = null; }
// side: 'CABIN'(전탐석 VCCP · 처음) · 'CKPT'(조종석 하부 콘솔 ⑮ VCCP) — 두 VCCP 는 같은 레이더(rdr)를 다룬다
function clnPress(k, down, side) {
  _clnSide = side === 'CKPT' ? 'CKPT' : 'CABIN';
  if (k === 'push') {
    if (down) { nv.pushT = performance.now(); return; }
    if (!_rdrGuard('push')) return;
    if (rdr.menu) rdrMenuPush();
    else rdrCursorTrk();
    msnRenderPanels(); vccpRender(); return;
  }
  if (!down || !_rdrGuard(k)) return;
  if (rdr.menu) rdr.menuT = performance.now();
  if (k.startsWith('rot:')) {
    const d = +k.slice(4);
    if (rdr.menu && rdr.sub !== null) { const L = RDR_MENU[rdr.menu][rdr.sub].sub.length; rdr.subI = (rdr.subI + d + L) % L; }
    else if (rdr.menu) rdr.menuI = (rdr.menuI + d + RDR_MENU[rdr.menu].length) % RDR_MENU[rdr.menu].length; else rdrRngStep(d);
    return;
  }
  if (/^n[1-9]$/.test(k)) { if (rdr.menu && rdr.sub !== null) { const L = RDR_MENU[rdr.menu][rdr.sub].sub; const i = +k[1] - 1; if (i < L.length) { rdr.subI = i; rdrMenuPush(); } } msnRenderPanels(); vccpRender(); return; }   // 하위 메뉴 번호 바로 고르기
  if (k.startsWith('pan:')) {
    const d = k.slice(4), lim = rdr.sector / 2;
    if (d.includes('n')) rdr.cur.nm = Math.min(rdr.rng, rdr.cur.nm + rdr.rng * 0.04);
    if (d.includes('s')) rdr.cur.nm = Math.max(0, rdr.cur.nm - rdr.rng * 0.04);
    if (d.includes('e')) rdr.cur.az = Math.min(lim, rdr.cur.az + 2);
    if (d.includes('w')) rdr.cur.az = Math.max(-lim, rdr.cur.az - 2);
    return;
  }
  switch (k) {
    case 'map': rdr.menu = rdr.menu === 'MAP' ? null : 'MAP'; rdr.menuI = 0; rdr.sub = null; rdr.menuT = performance.now(); break;
    case 'fnc': rdr.menu = rdr.menu === 'FNC' ? null : 'FNC'; rdr.menuI = 0; rdr.sub = null; rdr.menuT = performance.now(); break;
    case 'esc': rdrMenuBack(); break;
    case 'clr': if (rdr.menu) rdrMenuBack(); else { if (rdr.tgt) rdrTrack(rdr.tgt, false); rdr.cur = { az: 0, nm: rdr.rng / 2 }; } break;
    case 'wxr': rdr.wxr = !rdr.wxr; rdrClearPicture(); break;
    case 'tws': rdr.tws = !rdr.tws; break;
    case 'com': case 'tfc': break;   // 쓰지 않는다
  }
  msnRenderPanels(); vccpRender();
}
function nvPickAt(lat, lon) {
  let best = null, bd = nv.nm * 0.12;
  for (const c of msnContacts()) { const d = distance(lat, lon, c.lat, c.lon); if (d < bd) { bd = d; best = c.id; } }
  return best;
}
let _slHold = null;
function eoFocusBy(d) { if (eo.geo) eo.geoTrim = _mClamp(eo.geoTrim + d, -99, 99); else eo.focus = _mClamp(eo.focus + d, 0, 100); }
function msnAct(a) {
  switch (a) {
    case 'fly': try { toggleSim(); } catch (e) { _swallow(e); } break;
    case 'ais': ais.map = !ais.map; aisMapSync(); _mToast(ais.map ? `AIS — 2D 지도에 겹침(${AIS_NM}NM 안 ${aisTargets().length}척)` : 'AIS — 2D 지도에서 거둠'); break;
    case 'spawn': { const n = msnSpawn(6); _mToast(n ? `선박 표적 ${n}척을 둘레 바다(2~12NM)에 띄웠습니다` : '둘레에 바다가 없어 띄우지 못했습니다(지형을 아직 모르면 잠시 뒤에)'); break; }
    case 'clear': msnVslClear(); break;
    case 'nv+': { const i = NV_RNG.indexOf(nv.nm); nv.nm = NV_RNG[_mClamp((i < 0 ? 2 : i) - 1, 0, NV_RNG.length - 1)]; break; }
    case 'nv-': { const i = NV_RNG.indexOf(nv.nm); nv.nm = NV_RNG[_mClamp((i < 0 ? 2 : i) + 1, 0, NV_RNG.length - 1)]; break; }
    case 'nvc': nv.ctr = null; nv.cur = null; break;
    case 'help': msnHelp(); break;
    case 'close': if (msnPopped()) { try { popoutElement('msn'); } catch (e) { _swallow(e); } } msnShow(false); setTimeout(() => { try { applyPanels(); } catch (e) { _swallow(e); } }, 0); break;   // Vendor 창이 고른 것이면 그 창으로 돌아간다
    case 'popout': msnPopout(); break;
    case 'rcmd': rdr.cmd = RDR_CMDS[(RDR_CMDS.indexOf(rdr.cmd) + 1) % 3]; _mNote(`RDR > CMD ${rdr.cmd}`); break;
    case 'rtx': case 'rmode': case 'rng-': case 'rng+': case 'tilt-': case 'tilt+': case 'gain-': case 'gain+': case 'rsec': case 'rfrz': case 'ronly':
      if (!_rdrGuard(a)) break;
      if (a === 'rtx') rdrTx(!rdr.tx);
      else if (a === 'rmode') { rdr.mode = RDR_MODES[(RDR_MODES.indexOf(rdr.mode) + 1) % RDR_MODES.length]; rdrClearPicture(); }
      else if (a === 'rng-') rdrRngStep(-1); else if (a === 'rng+') rdrRngStep(1);
      else if (a === 'tilt-') rdr.tilt = Math.max(-30, rdr.tilt - 1); else if (a === 'tilt+') rdr.tilt = Math.min(30, rdr.tilt + 1);
      else if (a === 'gain-') rdr.gain = Math.max(0, rdr.gain - 1); else if (a === 'gain+') rdr.gain = Math.min(30, rdr.gain + 1);
      else if (a === 'rsec') { rdr.sector = RDR_SECTORS[(RDR_SECTORS.indexOf(rdr.sector) + 1) % RDR_SECTORS.length]; rdrClearPicture(); }
      else if (a === 'rfrz') rdr.frz = !rdr.frz; else if (a === 'ronly') rdr.ronly = !rdr.ronly;
      break;
    case 'r2eo': rdrSlaveEo(); break;
    case 'r2sl': if (rdr.tgt) srchMode('RDR'); else _mToast('먼저 레이더 화면에서 표적을 누르십시오'); break;
    case 'rclr': rdr.tgt = null; break;
    case 'slon': hslLampSet(!hsl.lamp); break;
    case 'slpwr': hslPwrSet(!hsl.pwr); break;
    case 'slman': srchMode('MAN'); break;
    case 'sleo': srchMode('EO'); break;
    case 'slrdr': if (rdr.tgt) srchMode('RDR'); else _mToast('먼저 레이더 화면에서 표적을 누르십시오'); break;
    case 'slctr': hslInit(); break;
  }
  msnRenderPanels();
}
function msnHelp() {
  const t = ['흰수리 전탐석 — EO/IR · SAR 레이더 · 서치라이트',
    '· 표시기: MULTI 4분할(왼쪽 위 지도 · 오른쪽 위 호이스트 카메라 · 왼쪽 아래 레이더 · 오른쪽 아래 EO/IR) · SPLIT 2분할(CH 로 짝 바꾸기) · V-IN 1~4 / VIDEO / NAVI 한 화면 · ▲▼ 밝기 · M-PWR',
    '· 탐조등 HSL-1600 조작기(오른쪽 위 · FLM 5.22): 처음엔 STOW — INIT 로 풀고(−45°) LAMP 를 켜면 5초 뒤 점등 · IR/VIS(IR 은 NVG 로만 보인다)',
    '  MAN/AUTO(AUTO = EO/IR 연동 SLASS) · 조이스틱(고각 −20~−90° · 방위 −150~+30°) · FOCUS 빔폭 4~13° · STOW 25초 · 끄면 냉각팬 7분(그동안 SEARCH LT PWR 를 끄지 않는다)',
    '  ⚠ 10ft(3.04m) 안의 물체를 비추면 100~300℃ · NVG 를 쓴 조종사 허락 없이 가시광 금지 · 조종석 컬렉티브 SRCH LT 와는 다른 등',
    '· 탐색레이더(Seaspray 5000E · VCCP): RDR > CMD 가 CKPT(조종실)이면 전탐석은 다루지 못한다 — FNC 메뉴의 CMD ▷ 를 CABIN · INTRLV 로',
    '· 조종석에서도 같은 레이더: 하부 콘솔 ⑮ VCCP(같은 면판 · CKPT/SHARED 일 때) · SYSTEM 창 Video Channel RADAR 가 이 레이더 화면 그대로 · CDU 조이스틱 Push:Radar',
    '· 전원: 하부 콘솔 MPP 패널 DMM ON → 녹화기(가운데) POWER → 3초 뒤 표시기 화면 전체가 들어온다(DMM 을 끄면 함께 꺼진다)',
    '· 녹화기(DVR): POWER(빨강) → 3초 뒤 REC(초록 깜박) · CH1 EO/IR · CH2 레이더 · CH3 호이스트 · CH4 지도 · PLAYBACK(파랑) ▶▶/◀◀ 0.5~256배 · ◀▶ 10초 · MENU — 날짜/시간 검색 · QUAD/한 채널 · USB(AVI) · SSD INFO',
    '  손잡이 돌림 — 거리 10~200NM(메뉴가 열려 있으면 칸 옮기기) · 누름 — 메뉴 실행 · 커서 자리 표적 추적(TRK) · 4축 — 커서',
    '  레이더는 회전하지 않고 전방 180°(좌우 90°씩)로 동시에 전파를 낸다 — 그 안에 음영 구역 · 스캔선이 없다(처음 180° 반원 화면 · SCN/BLK 로 좁게 볼 수도 있다)',
    '  FNC — 화면 왼쪽 세로 메뉴(FLM 5.20 표 2 · 표 4): RDR RNG ± · MODE ▷(PT · LRS · WX · TURB · SART · STM · MTI · ISAR) · CMD ▷(CKPT · CABIN · INTRLV) · R SET ▷(TILT · GAIN · AUTO GAIN · STS · CONTACT TAILS · GREY-GREEN · LINK R) · TRACK ▷(MK TRK · IN/EX AREA · DEL ALL · FILTER) · SCN/BLK ▷(WIDE 180° · BLN 20° · BLN 60° · MAP OVERLAY · SEARCH · SCAN 120°) · SEARCH ▷(USER 1~6 · ALL · BY DISTANCE · STEER CAM) · MAINT ▷(FAULTS · BIT · RDR NAV) · RDR TX · R ONLY · FREEZE',
    '  손잡이 돌림 고르기 · 누름 실행(▷ 는 오른쪽에 하위 메뉴) · ESC/CLR 뒤로 · 10초 조작 없으면 닫힘 · 키보드(마우스를 Vendor 위에): M 메뉴 · ↑↓ · Enter · 1~9 · Esc · MAP(WXR · TWS · R ONLY · RANGE) · 다시 켜면 90초 예열',
    '· EO/IR: 조이스틱(화면 HCU 가운데 · 실제 조종 장치의 사이클릭 축)으로 터릿을 돌린다. ZOOM ▲확대 ▼축소 · VIC 센서(EOW → EON → IR) · 2X 전자 줌 · POL 백상/흑상',
    '· AVT: 한 번 누르면 게이트(ACQ) — 표적을 게이트에 넣고 한 번 더 누르면 잠금(LOCKED) · 1.5초 누르면 해제',
    '· AUTO: 지금 보는 자리를 좌표로 고정 · MANUAL: 수동 · AID: 지면 고정 보조 · ZMULTI: 화각에 맞춘 감도',
    '· SLEW: MAP 으로 고른 POI(레이더 표적 · 선박 · 함정 · 요구조자 · 비행계획 지점)로 · FWD: 전방(2초 누르면 지금 자리를 새 전방으로) · STOW',
    '· LRF: 한 번 측정 · 2초 누르면 연속 · LASER: MENU 에서 LASER ARM 일 때 누르는 동안 조사',
    '· MENU: ZOOM 으로 고르고 SENS 로 바꾼다(LASER ARM · 서치라이트 연동 · PIP · AVT MODE · 단위)',
    '· 레이더: TX 를 켜고 화면의 표적을 누르면 지정 → "EO/IR → 표적" 으로 터릿을, "서치라이트 → 표적" 으로 빛을 돌린다',
    '· 외장형 탐조등(HSL-1600 · 왼쪽 승무원 도어 밑 검정 램프): 착륙등의 2배 밝기 · 10배 거리 · 조종석 컬렉티브 SRCH LT(접혀 있으면 INIT 뒤 켜짐) · SRCH CTR(◀▶▲▼) · 배정한 조이스틱 단추로도',
    '· EO/IR 영상: 탐조등 · 착륙등이 비춘 자리는 밤에도 밝게 보인다(주간 · 저광 카메라 — 열상 IR 은 가시광을 보지 못한다 · IR 탐조등은 EON 저광에만)',
    '· 서치라이트: 수동(◀▲▼▶) · EO/IR 연동(시선이 닿는 자리를 비춘다 · HCU AUX) · 레이더 표적 연동',
    '· 조종석 SYSTEM 창 Video(CDU Aircraft Systems → Video → Channel EO/IR)에 같은 영상 · 오버레이가 나온다 — 전탐석이 터릿을 돌리면 조종사도 그대로 본다',
    '· 기체는 흰수리 그대로 난다 — "조종석 보기" 로 비행계획 · 자동비행을 다루고, 지도 왼쪽 아래 🎯 전탐석 으로 돌아온다'];
  try { uiAlert(t.join('\n')); } catch (e) { _swallow(e); }
}
// 실제 조종 장치 — 사이클릭(롤 · 피치)으로 배정한 축, 없으면 지금 쓰는 장치의 축 0 · 1
function _msnJoyAxes() {
  if (!msnOpen || typeof joyAxVal !== 'function' || typeof joyOn === 'undefined' || !joyOn) return null;
  try {
    if (!MSN_REMOTE && typeof simModeOn !== 'undefined' && simModeOn) return null;   // SIM 으로 몰고 있으면 사이클릭은 비행에 쓴다(다른 기기의 Vendor 는 제 장치)
    if (joyAxes.roll || joyAxes.pitch) return { x: joyAxVal('roll'), y: -joyAxVal('pitch') };
    const pads = joyPads(); const p = pads.find(q => q.index === joyActiveIdx) || pads[0];
    if (!p) return null;
    const neu = _joyNeutral[p.index] || [];
    const r = i => { const v = (p.axes || [])[i]; if (!Number.isFinite(v)) return 0; const d = v - (Number.isFinite(neu[i]) ? neu[i] : 0); return Math.abs(d) < 0.08 ? 0 : d; };
    return { x: r(0), y: -r(1) };
  } catch (e) { return null; }
}

// ── EO/IR 영상(3D 지도) ──
// 지도 하나를 그릇(_eoHost)에 담아 둔다 — 전탐석이 열려 있으면 그 화면 안에, 아니면 화면 밖에 두고
// 조종석 SYSTEM 창 Video(Channel EO/IR) · 3D 조종석 MFD 가 그 그림을 옮겨 그린다(eoirVideoDrawTo).
// 보는 곳이 없으면(5초) 거둔다 — 그래픽 부담.
let _eoHost = null, _eoWantT = -Infinity;   // 처음에는 아무도 보지 않는다(0 이면 페이지가 뜨자마자 5초 동안 3D 지도를 만들었다 — 페이지마다)
const EO_IDLE_MS = 5000;
// EO/IR 3D 지도가 필요한가 — 조종석 SYSTEM · MFD 가 막 그렸거나(5초), 전탐석 표시기에 EO/IR 칸이 보이거나, 녹화기가 CH1 을 녹화 중일 때만.
//   전탐석을 열어 두어도 레이더 · 지도 한 칸만 보고 있으면 EO/IR 지도(WebGL)를 거둬 그래픽 메모리를 아낀다(다시 보이면 새로 만든다 — 5초 여유).
let _eoNeedT = -Infinity;
function _eoNeed() {
  const now = performance.now();
  if (now - _eoWantT < EO_IDLE_MS) return true;
  if (!msnOpen) return false;
  let need = false;
  try {
    if (typeof dvrRecCh === 'function' && dvrRecCh(1)) need = true;
    else if (_msnEl && msnScreenOn()) { const ceo = _msnEl.querySelector('.c-eo'); need = !!ceo && _cellVis(ceo); }
  } catch (e) { need = true; }
  if (need) _eoNeedT = now;
  return now - _eoNeedT < EO_IDLE_MS;
}
function _eoHostPlace() {
  if (!_eoHost) { _eoHost = document.createElement('div'); _eoHost.className = 'eo-map'; }
  let vid = msnOpen && _msnEl ? _msnEl.querySelector('.eo-vid') : null;
  if (vid && !(vid.clientWidth > 20 && vid.clientHeight > 20)) vid = null;   // 표시기에 EO/IR 칸이 없으면 화면 밖에
  const want = vid || document.body;
  if (_eoHost.parentElement !== want) {
    if (vid) { _eoHost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; vid.insertBefore(_eoHost, vid.firstChild); }
    else { _eoHost.style.cssText = 'position:fixed;left:-10000px;top:0;width:768px;height:576px;pointer-events:none;overflow:hidden'; document.body.appendChild(_eoHost); }
    try { if (_eoMap) _eoMap.resize(); } catch (e) { _swallow(e); }
  }
  return _eoHost;
}
function _eoMapEnsure() {
  if (typeof maplibregl === 'undefined' || !document.body) return null;
  const el = _eoHostPlace();
  if (_eoMap) return _eoMap;
  if (!(el.clientWidth > 20 && el.clientHeight > 20)) return null;
  try {
    const map = new maplibregl.Map({ container: el, style: _map3dStyle(), center: [S.lon, S.lat], zoom: 14, pitch: 80, bearing: S.hdg, maxPitch: 180, maxZoom: 24,
      interactive: false, attributionControl: false, pixelRatio: (typeof map3dPixelRatio === 'function') ? map3dPixelRatio(true) : 1,
      canvasContextAttributes: { preserveDrawingBuffer: true } });   // 조종석 SYSTEM 창 · MFD 로 옮겨 그릴 수 있게
    map.on('error', e => console.warn('[EO/IR]', e && e.error ? e.error.message : e));
    try { if (typeof mapGlGuard === 'function') mapGlGuard(map, 'EO/IR', m => { if (_eoMap === m) _eoMapDrop(); }); } catch (e) { _swallow(e); }   // 그래픽 문맥을 잃고 안 돌아오면 거둔다(다음 그림에서 새로 만든다)
    map.on('style.load', () => {
      try { if (typeof _ship3dAddTo === 'function' && !map.getSource('ship-3d')) _ship3dAddTo(map); } catch (e) { _swallow(e); }
      try { if (typeof _sarLayer === 'function' && !map.getLayer('sar-3d')) map.addLayer(_sarLayer(true)); } catch (e) { _swallow(e); }
      try { if (typeof TFC3D_LAYER !== 'undefined' && !map.getLayer('traffic-3d')) map.addLayer(Object.assign({}, TFC3D_LAYER)); } catch (e) { _swallow(e); }
    });
    map.on('load', () => {
      try { map.setTerrain({ source: 'terrain', exaggeration: MAP3D_EXAG }); } catch (e) { _swallow(e); }
      try { map.setSky(MAP3D_SKY); } catch (e) { _swallow(e); }
    });
    try { map.setCenterClampedToGround(false); } catch (e) { _swallow(e); }
    _eoMap = map;
  } catch (e) { console.warn('[EO/IR] map failed:', e); _eoMap = null; }
  return _eoMap;
}
function _eoMapDrop() { try { if (_eoMap) _eoMap.remove(); } catch (e) { _swallow(e); } _eoMap = null; try { if (_eoHost) _eoHost.remove(); } catch (e) { _swallow(e); } _eoHost = null; }
function _eoCamera() {
  const map = _eoMapEnsure(); if (!map) return;
  const el = map.getContainer(), W = el.clientWidth, Hh = el.clientHeight;
  if (!(W > 0 && Hh > 0)) return;
  const hf = eoFov(), vf = _mClamp(2 * Math.atan(Math.tan(hf / 2 * _mD) * Hh / W) / _mD, 0.1, 150);
  try { if (Math.abs(map.getVerticalFieldOfView() - vf) > 1e-3) map.setVerticalFieldOfView(vf); } catch (e) { _swallow(e); }
  // 카메라 높이 — 지도가 그린 땅(과장비가 곱해져 있다) + 실제 지면 위 높이
  let drawn = null; try { drawn = map.queryTerrainElevation([S.lon, S.lat]); } catch (e) { drawn = null; }
  const phys = _mGndFt(S.lat, S.lon) * 0.3048, agl = Math.max(2, _mAltM() - phys);
  const camAlt = (Number.isFinite(drawn) ? drawn : phys) + agl - 1.2;
  const p = eoLosPoint(), dist = _mClamp(p ? p.gnd : 5000, 150, 30000);
  try { _mJump(map, _ml3dCamOptions(S.lon, S.lat, camAlt, normA(S.hdg + eo.az), _mClamp(90 + eo.el, 0, 180), 0, dist, map), _eoLiveKey(), _eoDyn()); } catch (e) { _swallow(e); }
}
// 조종석 SYSTEM 창 Video(Channel EO/IR) · 3D 조종석 MFD — 그 칸(x, y, w, h)에 EO/IR 영상 + 오버레이를 그린다(18-system.js 가 부른다)
//   전탐석에서 터릿을 움직이면 그대로 보인다. CDU Video 의 Brightness · Contrast · Saturation 도 먹는다.
function eoirVideoDrawTo(g, x, y, w, h) {
  _eoWantT = performance.now();
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#000'; g.fillRect(x, y, w, h);
  const map = _eoMapEnsure();
  if (map && eo.pwr && eo.mode !== 'STOW') {
    const mc = map.getCanvas(), el = map.getContainer(), cw = el.clientWidth, ch = el.clientHeight;
    if (mc && mc.width && cw > 0) {
      // 칸을 다 채우게(가운데를 기준으로 남는 쪽을 자른다)
      const s = Math.max(w / cw, h / ch), ox = x + (w - cw * s) / 2, oy = y + (h - ch * s) / 2;
      let f = eoVideoFilter();
      try { const V = typeof videoCfg !== 'undefined' ? videoCfg : null; if (V) f += ` brightness(${(V.bri / 50).toFixed(2)}) contrast(${(V.con / 50).toFixed(2)}) saturate(${(V.sat / 50).toFixed(2)})`; } catch (e) { _swallow(e); }
      try { g.filter = f; } catch (e) { _swallow(e); }
      try { g.drawImage(mc, ox, oy, cw * s, ch * s); } catch (e) { _swallow(e); }
      g.save(); g.translate(ox, oy); g.scale(s, s); try { _eoSpritesG(g, cw, ch); } catch (e) { _swallow(e); } g.restore();
      try { g.filter = 'none'; } catch (e) { _swallow(e); }
      g.save(); g.translate(ox, oy); g.scale(s, s); try { _eoBeamsG(g, cw, ch); } catch (e) { _swallow(e); } g.restore();   // 빛 무리(필터 밖)
    }
  }
  try { _eoHudG(g, x, y, w, h, false); } catch (e) { _swallow(e); }
  g.restore();
}
function eoirVideoShown() { return !!_eoMap; }
// 영상 필터 — 센서 · 밤낮 · 시정 · 비 · 극성 · 수동 감도 · 초점
function eoVideoFilter() {
  const E = typeof env !== 'undefined' ? env : {};
  const tod = E.tod || 'DAY', vis = +E.vis || 0, rain = +E.rain || 0;
  const f = [];
  let bri = 1, con = 1, blur = 0;
  if (eo.sensor === 'IR') {
    f.push('grayscale(1)'); con *= 1.5; bri *= tod === 'NIGHT' ? 0.85 : 0.95;
    if (vis && vis < 3) { blur += (3 - vis) * 0.4; con *= 0.85; }
    if (rain) { con *= 1 - rain * 0.12; blur += rain * 0.3; }
  } else {
    if (tod === 'NIGHT') { if (eo.sensor === 'EON' && eo.ll) { f.push('grayscale(1)'); bri *= 0.75; con *= 1.3; } else bri *= 0.16; }
    else if (tod === 'DUSK') bri *= eo.sensor === 'EON' && eo.ll ? 0.85 : 0.5;
    if (vis && vis < 5) { blur += (5 - vis) * 0.5; con *= 0.55 + vis * 0.09; bri *= 1.05; }
    if (rain) { con *= 1 - rain * 0.2; blur += rain * 0.5; }
    if (eo.filt === 'ND') bri *= 0.6; else if (eo.filt === 'XLP') con *= 1.15; else if (eo.filt === 'LP') con *= 1.07;
    // 서치라이트가 시선 자리를 비추면 밤에도 보인다
    if (tod !== 'DAY' && _srchLights()) bri = Math.max(bri, 0.6);
  }
  if (eo.scene === 'HAZE') { con *= 1.25; blur = Math.max(0, blur - 0.6); } else if (eo.scene === 'LOW CON') con *= 1.4; else if (eo.scene === 'HIGH CON') con *= 0.8;
  if (!eo.imgAuto) { con *= 0.3 + eo.sens / 50 * 0.7; bri *= 0.3 + eo.off / 50 * 0.7; }
  blur += eoFocusBlur();
  f.push(`brightness(${bri.toFixed(2)})`, `contrast(${con.toFixed(2)})`);
  if (blur > 0.05) f.push(`blur(${blur.toFixed(1)}px)`);
  if (eo.sensor === 'IR' && eo.pol === 'BLK') f.push('invert(1)');
  return f.join(' ');
}
// 초점 — GEO FOCUS 면 거리에 맞춰 저절로(트림만큼 흐림), 아니면 FOCUS 다이얼이 거리에 맞아야 선명
function eoIdealFocus() { const p = eoAimPoint(); const r = p ? eoAngTo(p.lat, p.lon, p.hM).rng : 20000; return 100 * (1 - Math.exp(-r / 2500)); }
function eoFocusBlur() {
  const k = _mClamp(30 / Math.max(1, eoFov()), 1, 6);   // 좁게 볼수록 초점에 민감
  if (eo.geo) return Math.abs(eo.geoTrim) * 0.012 * k;
  return Math.min(8, Math.abs(eo.focus - eoIdealFocus()) * 0.05 * k);
}
function _srchLights() {
  if (!hsl.lit || hsl.ir) return false;
  const p = eoLosPoint(); if (!p) return false;
  const a = eoAngTo(p.lat, p.lon, p.hM);
  const w = Math.max(3, hsl.focus / 2 + 1);
  const B = hslBeam(); return a.rng < (B ? B.reach : HSL.reach) * 1.3 && Math.abs(normAS(a.az - hsl.az)) < w && Math.abs(a.el - hsl.el) < w;
}
// 탐조등 · 착륙등 빛 무리 — EO/IR 영상 위(영상 필터 밖: 밤에 어둡게 깎인 영상 위로 빛난 자리가 밝게 보인다)
//   주간 · 저광 카메라(EOW · EON)에 보인다. 열상(IR)은 가시광을 보지 못한다(IR 탐조등은 EON 저광에만).
//   빛 무리 크기는 거리에 맞춰(초점거리 px ÷ 거리) · 내려다보는 각만큼 납작한 타원
function eoBeamSpots() {
  if (!_eoMap || !eo.pwr || eo.mode === 'STOW' || eo.sensor === 'IR') return [];
  const out = [], losB = normA(S.hdg + eo.az), fov = eoFov();
  let bs = []; try { bs = typeof envBeams === 'function' ? envBeams() : []; } catch (e) { _swallow(e); }
  // IR 탐조등(맨눈 · NVG 없으면 envBeams 에 없다) — 저광(EON LL)은 근적외선을 본다
  if (hsl.lit && hsl.ir && eo.sensor === 'EON' && eo.ll && typeof env !== 'undefined' && !env.nvg) {
    const sv = env.nvg; env.nvg = true;
    try { bs = bs.concat(envBeams().filter(b => b.src)); } catch (e) { _swallow(e); } finally { env.nvg = sv; }
  }
  for (const b of bs) {
    const hM = _mGndFt(b.lat, b.lon) * 0.3048, a = eoAngTo(b.lat, b.lon, hM);
    if (Math.abs(normAS(a.brg - losB)) > fov * 0.75 + 2 || Math.abs(a.el - eo.el) > fov * 0.75 + 2) continue;   // 화면 밖(뒤에 있으면 project 가 엉뚱한 자리를 준다)
    out.push({ lat: b.lat, lon: b.lon, r: b.r, k: b.k, rng: a.rng, dn: Math.max(0.05, Math.sin(Math.max(1, -a.el) * _mD)) });
  }
  return out;
}
let _eoLitCv = null;
function _eoBeamsG(g, W, H) {
  const spots = eoBeamSpots(); if (!spots.length) return;
  const tod = (typeof env !== 'undefined' && env.tod) || 'DAY', ll = eo.sensor === 'EON' && eo.ll;
  let a0 = tod === 'NIGHT' ? 0.9 : tod === 'DUSK' ? 0.6 : 0.18;
  if (eo.filt === 'ND') a0 *= 0.6;
  const fx = (W / 2) / Math.tan(eoFov() / 2 * _mD), col = ll ? '255,255,255' : '255,246,222';
  const mc = _eoMap.getCanvas();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const sp of spots) {
    let pt; try { pt = _eoMap.project([sp.lon, sp.lat]); } catch (e) { continue; }
    if (!pt || !Number.isFinite(pt.x) || pt.x < -W || pt.x > 2 * W || pt.y < -H || pt.y > 2 * H) continue;
    const rp = _mClamp(fx * sp.r / Math.max(1, sp.rng), 4, Math.max(W, H) * 1.5), al = Math.min(1, a0 * Math.min(1.6, sp.k / 1.4));
    // 비친 자리의 땅 · 바다가 낮처럼 보이게 — 영상(필터 전)을 그 타원에만 부드럽게 덧그린다
    if (mc && mc.width && tod !== 'DAY') {
      const bw = Math.ceil(rp * 2), bh = Math.max(2, Math.ceil(rp * 2 * sp.dn)), x0 = pt.x - rp, y0 = pt.y - rp * sp.dn;
      if (!_eoLitCv) _eoLitCv = document.createElement('canvas');
      const oc = _eoLitCv; if (oc.width < bw) oc.width = bw; if (oc.height < bh) oc.height = bh;
      const q = oc.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, oc.width, oc.height);
      try { q.filter = ll ? 'grayscale(1) brightness(1.15)' : 'brightness(1.05) sepia(0.15)'; } catch (e) { _swallow(e); }
      try { q.drawImage(mc, x0 * mc.width / W, y0 * mc.height / H, bw * mc.width / W, bh * mc.height / H, 0, 0, bw, bh); } catch (e) { _swallow(e); }
      try { q.filter = 'none'; } catch (e) { _swallow(e); }
      q.globalCompositeOperation = 'destination-in';
      q.save(); q.translate(bw / 2, bh / 2); q.scale(1, sp.dn);
      const m = q.createRadialGradient(0, 0, 0, 0, 0, rp); m.addColorStop(0, `rgba(0,0,0,${Math.min(1, al * 1.1).toFixed(3)})`); m.addColorStop(0.6, `rgba(0,0,0,${(al * 0.7).toFixed(3)})`); m.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = m; q.beginPath(); q.arc(0, 0, rp, 0, 2 * Math.PI); q.fill(); q.restore();
      g.save(); g.globalCompositeOperation = 'source-over'; g.drawImage(oc, 0, 0, bw, bh, x0, y0, bw, bh); g.restore();
    }
    g.save(); g.translate(pt.x, pt.y); g.scale(1, sp.dn);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rp);
    const ga = tod === 'DAY' ? al : al * 0.55; gr.addColorStop(0, `rgba(${col},${ga.toFixed(3)})`); gr.addColorStop(0.45, `rgba(${col},${(ga * 0.5).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rp, 0, 2 * Math.PI); g.fill(); g.restore();
  }
  g.restore();
}
// 선박 표적 — 지도 위에 실루엣(IR 에서는 뜨겁게). g 는 지도 그릇의 CSS px 좌표(W × H)
function _eoSprites(cv, W, H) {
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  if (!_eoMap) return;
  const el = _eoMap.getContainer(), cw = el.clientWidth || W, ch = el.clientHeight || H;
  g.setTransform(W / cw, 0, 0, H / ch, 0, 0);
  _eoSpritesG(g, cw, ch);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function _eoSpritesG(g, W, H) {
  if (!_eoMap || !eo.pwr) return;
  const fx = (W / 2) / Math.tan(eoFov() / 2 * _mD), ir = eo.sensor === 'IR', tod = (typeof env !== 'undefined' && env.tod) || 'DAY';
  const losB = normA(S.hdg + eo.az);
  for (const c of msnContacts()) {
    if (c.kind !== 'vsl' && !(ir && (c.kind === 'surv' || c.kind === 'ship'))) continue;
    const a = eoAngTo(c.lat, c.lon, c.hM);
    if (a.rng > 25000 || Math.abs(normAS(a.brg - losB)) > eoFov()) continue;
    let pt; try { pt = _eoMap.project([c.lon, c.lat]); } catch (e) { continue; }
    if (!pt || !Number.isFinite(pt.x)) continue;
    const s = fx / a.rng;                                  // m → px
    if (c.kind !== 'vsl') { if (ir) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(pt.x, pt.y - Math.max(1.5, 0.5 * s), Math.max(1.5, (c.kind === 'ship' ? 6 : 0.5) * s), 0, 2 * Math.PI); g.fill(); } continue; }
    const rel = (c.hdg - a.brg) * _mD, Lp = Math.max(2, (c.len * Math.abs(Math.sin(rel)) + c.len * 0.3 * Math.abs(Math.cos(rel))) * s);
    const hh = Math.max(1.5, c.len * 0.12 * s), cab = Math.max(1, c.len * 0.14 * s), dir = Math.sin(rel) >= 0 ? 1 : -1;
    if (!ir && tod === 'NIGHT') {   // 밤 — 항해등만
      g.fillStyle = dir > 0 ? '#3f3' : '#f33'; g.fillRect(pt.x - 1.5, pt.y - hh - cab - 2, 3, 3);
      g.fillStyle = '#fff'; g.fillRect(pt.x - 1, pt.y - hh - cab * 2 - 3, 2, 2); continue;
    }
    if (c.spd > 2 && !ir) { g.fillStyle = 'rgba(240,250,255,0.55)'; g.fillRect(pt.x - dir * Lp * 0.5 - dir * Lp * 0.9, pt.y - hh * 0.3, dir * Lp * 0.9, hh * 0.35); }   // 항적(흰 물결)
    g.fillStyle = ir ? 'rgb(225,225,225)' : '#3b4148';
    g.beginPath(); g.moveTo(pt.x - Lp / 2, pt.y - hh); g.lineTo(pt.x + Lp / 2, pt.y - hh); g.lineTo(pt.x + Lp / 2 - dir * Lp * 0.1, pt.y); g.lineTo(pt.x - Lp / 2 + dir * Lp * 0.05, pt.y); g.closePath(); g.fill();
    g.fillStyle = ir ? 'rgb(255,255,255)' : '#dfe3e6'; g.fillRect(pt.x - dir * Lp * 0.15 - Lp * 0.12, pt.y - hh - cab, Lp * 0.24, cab);
    if (ir) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(pt.x - dir * Lp * 0.38, pt.y - hh * 0.8, Math.max(1.5, Lp * 0.08), hh * 0.7); }   // 기관실 열
  }
  if (eo.laserFire && ir) { g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, H / 2, 3, 0, 2 * Math.PI); g.fill(); }   // 레이저 조사 점(IR 에서 보인다)
}
// 도 · 분 · 초(37:31:25N)
function eoDms(v, h) { const a = Math.abs(v); let d = Math.floor(a), m = Math.floor((a - d) * 60), sc = Math.round(((a - d) * 60 - m) * 60); if (sc === 60) { sc = 0; m++; } if (m === 60) { m = 0; d++; } const p2 = n => String(n).padStart(2, '0'); return `${d}:${p2(m)}:${p2(sc)}${v >= 0 ? h[0] : h[1]}`; }
function eoZoomStep() {
  if (eo.sensor === 'EOW') return Math.round(Math.log(EO_FOV.EOW[0] / eo.fovW) / Math.log(EO_FOV.EOW[0] / EO_FOV.EOW[1]) * 9) + 1;
  return eo.step[eo.sensor] + 1;
}
// EO/IR 영상 오버레이 — 흰수리 SYSTEM 창 Video(실기 사진) 배치 · 흰 글씨에 검은 테
//   왼쪽 위: 날짜 · 모드(AUTO 등은 반전) · VIC · 초점 MAN/GEO · 현지 시각 · UTC 차
//   가운데 위: 센서(EOW · EON · IR — 테두리) · 필터 표시
//   오른쪽 위: 줌 단계 · COL/WHT/BLK · AUTO/MAN · 장면(DFLT) · 감도 · 초점(∞)
//   왼쪽: 고각 띠(10° 눈금 — 01 · 00 · −01) · 가운데 작은 + · 북쪽 화살표
//   아래: ACFT 위경도 · 기수 · 고도 | 시선 방위 띠(34 35 00 01) | 표적 높이 · 거리 · LOS/LRF | 레이저 · 추적 · MAP TGT 좌표
//   full(전탐석 화면)일 때만 AVT 게이트 · MENU · PIP · CUE 를 더 그린다
function _eoHudG(g, x0, y0, W, H, full) {
  const k = _mClamp(Math.min(W / 760, H / 560), 0.45, 1.6), F = n => `${Math.round(n * k)}px Consolas, "Lucida Console", "Courier New", monospace`;
  const T = (s, x, y, al = 'left', n = 15, col = '#f4f6f4', inv = false) => {
    g.font = F(n); g.textAlign = al; g.lineJoin = 'round';
    if (inv) { const w = g.measureText(s).width, xl = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x; g.fillStyle = '#f4f6f4'; g.fillRect(xl - 3 * k, y - 13 * k, w + 6 * k, 17 * k); g.fillStyle = '#111'; g.fillText(s, x, y); return; }
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  };
  const L = x0 + 14 * k, R = x0 + W - 14 * k, cx = x0 + W / 2, cy = y0 + H / 2;
  if (!eo.pwr) { T('EO/IR OFF', cx, cy, 'center', 20, '#888'); return; }
  // ── 왼쪽 위 ──
  const now = new Date(), tzh = -now.getTimezoneOffset() / 60, loc = new Date(now.getTime() + tzh * 3600000), d2 = n => String(n).padStart(2, '0');
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mode = eo.mode === 'MAN' ? (eo.aid ? 'RAID' : 'MAN') : eo.mode === 'AVT' ? 'AVT' : eo.mode;
  T(`${d2(loc.getUTCDate())}${MON[loc.getUTCMonth()]}${loc.getUTCFullYear()}`, L, y0 + 28 * k);
  T(mode, L + 128 * k, y0 + 28 * k, 'left', 15, '#f4f6f4', mode !== 'FWD' && mode !== 'MAN');
  T('VIC', L + 196 * k, y0 + 28 * k);
  T(`${d2(loc.getUTCHours())}:${d2(loc.getUTCMinutes())}:${d2(loc.getUTCSeconds())}`, L, y0 + 46 * k);
  T(eo.geo ? 'GEO' : 'MAN', L + 196 * k, y0 + 46 * k);
  T(`UTC${tzh >= 0 ? '+' : ''}${tzh.toFixed(1)}`, L, y0 + 64 * k);
  // ── 가운데 위: 센서(테두리) ──
  const sn = eo.sensor === 'EON' ? (eo.ll ? 'EON LL' : 'EON') : eo.sensor;
  g.font = F(15); const sw = g.measureText(sn).width;
  g.strokeStyle = '#f4f6f4'; g.lineWidth = 1.5 * k; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - sw / 2 - 4 * k, y0 + 14 * k, sw + 8 * k, 19 * k); g.strokeRect(cx - sw / 2 - 4 * k, y0 + 14 * k, sw + 8 * k, 19 * k);
  T(sn, cx, y0 + 29 * k, 'center');
  if (eo.sensor !== 'IR' && eo.filt !== 'CLR') T('≋', cx, y0 + 50 * k, 'center', 13);
  if (eo.ez > 1) T(`${eo.ez}X`, cx + sw / 2 + 12 * k, y0 + 29 * k, 'left', 13);
  // ── 오른쪽 위 ──
  T(`${eoZoomStep()}  ${eo.sensor === 'IR' ? eo.pol : 'COL'}  ${eo.imgAuto ? 'AUTO' : 'MAN'}`, R - 30 * k, y0 + 28 * k, 'right');
  T(`${eo.scene === 'NORM' ? 'DFLT' : eo.scene}  ${Math.round(eo.sens)}`, R - 30 * k, y0 + 46 * k, 'right');
  const ideal = eoIdealFocus(), fc = eo.geo ? ideal + eo.geoTrim * 0.3 : eo.focus;
  T(fc >= 96 ? '∞' : String(Math.round(fc)), R, y0 + 30 * k, 'right', 17);
  // ── 북쪽 화살표 ──
  const losB = normA(S.hdg + eo.az), na = -losB * _mD, nx = L + 22 * k, ny = y0 + 0.2 * H;
  g.save(); g.translate(nx, ny); g.rotate(na);
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3.5 * k; g.beginPath(); g.moveTo(0, 14 * k); g.lineTo(0, -14 * k); g.moveTo(-4 * k, -8 * k); g.lineTo(0, -14 * k); g.lineTo(4 * k, -8 * k); g.stroke();
  g.strokeStyle = '#f4f6f4'; g.lineWidth = 1.5 * k; g.stroke();
  g.restore();
  T('N', nx + Math.sin(-na) * 0 + 9 * k, ny + 4 * k, 'left', 12);
  // ── 왼쪽 고각 띠(10° 마다 두 자리 · 사이 점) ──
  const tx = L + 4 * k, sp = 36 * k;
  for (let d = Math.floor((eo.el - 60) / 10) * 10; d <= eo.el + 60; d += 5) {
    const yy = cy - (d - eo.el) / 10 * sp;
    if (yy < y0 + 0.28 * H || yy > y0 + 0.74 * H) continue;
    if (d % 10 === 0) { const n = d / 10; T(`${n < 0 ? '-' : ''}${String(Math.abs(n)).padStart(2, '0')}-`, tx, yy + 5 * k, 'left', 14); }
    else { g.fillStyle = '#f4f6f4'; g.fillRect(tx + 28 * k, yy - 1, 2 * k, 2 * k); }
  }
  // ── 가운데 작은 + ──
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(cx - 6 * k, cy); g.lineTo(cx + 6 * k, cy); g.moveTo(cx, cy - 6 * k); g.lineTo(cx, cy + 6 * k); g.stroke();
  g.strokeStyle = '#f4f6f4'; g.lineWidth = 1.2 * k; g.stroke();
  // ── 아래 가운데 시선 방위 띠(10° 마다 두 자리) ──
  const by = y0 + H - 42 * k, bs = 34 * k;
  for (let d = Math.floor((losB - 40) / 5) * 5; d <= losB + 40; d += 5) {
    const xx = cx - (normAS(losB - d)) / 10 * bs;
    if (d % 10 === 0) { T(String(normA(d) / 10).padStart(2, '0'), xx, by, 'center', 15); g.fillStyle = '#f4f6f4'; g.fillRect(xx - 0.5, by - 22 * k, 1.5 * k, 5 * k); }
    else { g.fillStyle = '#f4f6f4'; g.fillRect(xx - 0.5, by - 20 * k, 1.5 * k, 3 * k); }
  }
  g.fillStyle = '#f4f6f4'; g.fillRect(cx - 0.75 * k, by - 28 * k, 1.5 * k, 12 * k);
  // ── 아래 왼쪽: ACFT ──
  T('ACFT', L - 4 * k, y0 + H - 62 * k);
  T(`${eoDms(S.lat, 'NS')} ${fmtA(S.hdg)}°`, L + 16 * k, y0 + H - 43 * k);
  T(`${eoDms(S.lon, 'EW')}  ${Math.round(S.alt)}FT`, L, y0 + H - 24 * k);
  // ── 표적 — 높이 · 거리 · 거리 출처 · 좌표 ──
  const p = eoAimPoint(), lrfOk = eo.lrf.st === 'VALID' && eo.lrf.rng;
  const tp = (lrfOk && eo.lrf.pt) || p;
  const rngM = lrfOk ? eo.lrf.rng : tp ? eoAngTo(tp.lat, tp.lon, tp.hM).rng : null;
  const rs = rngM == null ? '' : eo.units === 'KM' ? `${(rngM / 1000).toFixed(1)}KM` : `${(rngM / 1852).toFixed(1)}NM`;
  const mx = x0 + W * 0.69;
  T(tp ? `${Math.round((tp.hM || 0) / 0.3048)}FT` : '', mx - 70 * k, y0 + H - 16 * k, 'right');
  if (rs) T(`${rs} ${lrfOk ? 'LRF' : 'LOS'}`, mx + 50 * k, y0 + H - 16 * k, 'right');
  const lzr = eo.laserFire ? 'FIRE' : eo.laserArm ? 'ARM' : 'OFF', avt = eo.mode !== 'AVT' ? 'NONE' : eo.trk === 'LOCKED' ? 'LOCK' : eo.trk === 'ACQ' ? 'ACQ' : eo.trk;
  T(`${eo.lrf.cont ? 'CONT' : eo.lrf.st === 'RANGING' ? 'RNG' : lzr}  ${avt}`, R, y0 + H - 74 * k, 'right', 15, eo.laserFire ? '#ff6060' : '#f4f6f4');
  T('MAP TGT', R, y0 + H - 54 * k, 'right');
  if (tp) {
    T(`${fmtA(bearing(S.lat, S.lon, tp.lat, tp.lon))}°  ${eoDms(tp.lat, 'NS')}`, R, y0 + H - 36 * k, 'right');
    T(eoDms(tp.lon, 'EW'), R, y0 + H - 18 * k, 'right');
  } else {
    T(`${fmtA(losB)}°  NO TGT SOL`, R, y0 + H - 36 * k, 'right');
    T('ENABLE LRF', R, y0 + H - 18 * k, 'right');
  }
  if (eo.mode === 'STOW') { g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(x0, y0 + 80 * k, W, H - 170 * k); T('STOW', cx, cy, 'center', 22); }
  if (eo.cal > 0) { g.fillStyle = 'rgba(80,80,80,0.92)'; g.fillRect(x0, y0 + 80 * k, W, H - 170 * k); T('IR CAL', cx, cy, 'center', 20); }
  // ── AVT 게이트(조종석에도 보인다) ──
  if (eo.mode === 'AVT') {
    const gw = EO_GATE_K[eo.gate] * W / 2, b = 12 * k, col = eo.trk === 'LOCKED' ? '#ffd23a' : '#f4f6f4';
    g.strokeStyle = col; g.lineWidth = 2 * k;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { g.beginPath(); g.moveTo(cx + sx * gw, cy + sy * gw - sy * b); g.lineTo(cx + sx * gw, cy + sy * gw); g.lineTo(cx + sx * gw - sx * b, cy + sy * gw); g.stroke(); });
    if (full) T(`${eo.gate} ${eo.alg}`, cx, cy - gw - 6 * k, 'center', 12, col);
    if (eo.trk === 'LOCKED' && eo.lock && eo.lock.kind === 'obj') { T(`TRK ${eo.lock.id}`, cx, cy + gw + 16 * k, 'center', 12, col); const lc = msnContacts().find(x => x.id === eo.lock.id); if (lc && lc.kind !== 'air') T(aisLabel(lc), cx, cy + gw + 30 * k, 'center', 11, lc.ais ? '#6dff9a' : '#ffa040'); }
  }
  if (!full) return;
  // ── 전탐석 화면만 ──
  if (eo.mode === 'SLEW' && eo.slewTgt) T(`CUE ${eo.slewTgt.kind === 'obj' ? eo.slewTgt.id : 'POI'}`, cx, cy + 52 * k, 'center', 13, '#ffd23a');
  if (hsl.lit) T(`SRCH ${hsl.ir ? 'IR ' : ''} ${srch.mode === 'EO' ? 'SLAVE' : srch.mode}${srch.lim ? ' LIMIT' : ''}`, R, y0 + 92 * k, 'right', 12, srch.lim ? '#ffd23a' : '#f4f6f4');
  if (eo.pip === 'RDR') { const pc = _msnEl && _msnEl.querySelector('.msn-rdr canvas'); if (pc && pc.width) { const s2 = 150 * k; g.drawImage(pc, x0 + W - s2 - 14 * k, y0 + 100 * k, s2, s2); g.strokeStyle = '#f4f6f4'; g.lineWidth = 1; g.strokeRect(x0 + W - s2 - 14 * k, y0 + 100 * k, s2, s2); } }
  if (eo.menu) {
    const mw = 290 * k, mh = (MSN_MENU.length * 21 + 36) * k, mx2 = cx - mw / 2, my = cy - mh / 2;
    g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(mx2, my, mw, mh); g.strokeStyle = '#f4f6f4'; g.lineWidth = 1; g.strokeRect(mx2, my, mw, mh);
    T('MAIN MENU', cx, my + 20 * k, 'center', 14);
    MSN_MENU.forEach((m, i) => { const yy = my + (42 + i * 21) * k; T(m.n, mx2 + 12 * k, yy, 'left', 13, '#f4f6f4', i === eo.menuI); T(String(m.v()), mx2 + mw - 12 * k, yy, 'right', 13, i === eo.menuI ? '#ffd23a' : '#f4f6f4'); });
  }
}
function _eoHud(cv, W, H) {
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  if (_eoMap && eo.pwr) {   // 빛 무리(영상 필터 밖)
    const el = _eoMap.getContainer(), cw = el.clientWidth || W, ch = el.clientHeight || H;
    g.setTransform(W / cw, 0, 0, H / ch, 0, 0); try { _eoBeamsG(g, cw, ch); } catch (e) { _swallow(e); } g.setTransform(1, 0, 0, 1, 0, 0);
  }
  _eoHudG(g, 0, 0, W, H, true);
}
// 레이더 화면
// 탐색레이더 화면 — 부채꼴(Sector · B-scope) · 240°(E-scan)는 가운데가 안테나
function _rdrGeo(W, H) {
  const top = 64, bot = 46;   // 위 — 채널 이름(CH2) 한 줄 + 머리 글 두 줄
  if (rdr.sector <= 180) {   // 부채꼴 · 반원(180°) — 꼭짓점이 아래(자기 기체)
    const k = _mClamp(Math.min(W, H) / 420, 0.6, 2), t2 = Math.max(top, 62 * k), b2 = Math.max(bot, 40 * k);
    const half = rdr.sector / 2 * _mD, side = rdr.sector > 120 ? 34 * k : 12;   // 반원이면 좌우 끝 방위 숫자 자리
    const R = Math.max(40, Math.min(H - t2 - b2 - 18 * k, (W / 2 - side) / Math.max(0.5, Math.sin(Math.min(half, Math.PI / 2)))));
    return { ox: W / 2, oy: H - b2 - (rdr.sector > 120 ? 8 * k : 4), R };
  }
  // 전 방향(원) — 머리 글 · 아랫줄은 글자 크기(k)만큼 커지므로 그만큼 비우고, 둘레 방위 숫자 자리도 둔다
  const k = _mClamp(Math.min(W, H) / 420, 0.6, 2), t2 = Math.max(top, 62 * k), b2 = Math.max(bot, 36 * k), m = 16 * k;
  const R = Math.max(40, Math.min(W / 2 - m - 8, (H - t2 - b2) / 2 - m)); return { ox: W / 2, oy: t2 + (H - t2 - b2) / 2, R };
}
function _rdrDraw(cv) {
  const W = cv.width, H = cv.height; if (!(W > 0 && H > 0)) return;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
  _rdrPaint(g, W, H);
}
// 조종석 SYSTEM 창 Video(Channel RADAR) · 3D 조종석 MFD — 그 칸(x, y, w, h)에 전탐석과 같은 탐색레이더 화면(18-system.js 가 부른다)
function rdrDrawTo(g, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y);
  try { _rdrPaint(g, w, h); } finally { g.restore(); }
}
// 탐색레이더 화면 한 장 — (0,0)~(W,H) 에 그린다
function _rdrPaint(g, W, H) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const k = _mClamp(Math.min(W, H) / 420, 0.6, 2), C = '#3dff6a', A = '#ffc400', G = _rdrGeo(W, H), { ox, oy, R } = G;
  const half = rdr.sector / 2, P = (rel, nm) => [ox + Math.sin(rel * _mD) * R * nm / rdr.rng, oy - Math.cos(rel * _mD) * R * nm / rdr.rng];
  const sectorPath = () => { g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, (-90 - half) * _mD, (-90 + half) * _mD); g.closePath(); };
  // 바탕 · 지형(TWS) · 레이더 잔상
  g.save(); sectorPath(); g.clip();
  if (!rdr.ronly && rdr.tws) { g.fillStyle = '#0a1430'; g.fill(); _rdrTws(g, ox, oy, R); }
  if (rdr.tx && rdr.pcv) { const N = rdr.pcv.width, s2 = R / (N / 2 - 2); g.drawImage(rdr.pcv, ox - N / 2 * s2, oy - N / 2 * s2, N * s2, N * s2); }
  g.restore();
  // 거리 호 · 방위 살
  g.strokeStyle = 'rgba(61,255,106,0.5)'; g.lineWidth = 1; g.font = `bold ${Math.round(11 * k)}px monospace`; g.fillStyle = C; g.textAlign = 'left';
  for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(ox, oy, R * i / 3, (-90 - half) * _mD, (-90 + half) * _mD); g.stroke(); const [lx, ly] = P(Math.min(half, 45) - 6, rdr.rng * i / 3); g.fillText(`${+(rdr.rng * i / 3).toFixed(1)}`, lx + 3, ly); }
  for (let a = -Math.floor(half / 30) * 30; a <= half; a += 30) { const [x, y] = P(a, rdr.rng); g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); g.textAlign = 'center'; g.fillText(fmtA(S.hdg + a), ox + Math.sin(a * _mD) * (R + 11 * k), oy - Math.cos(a * _mD) * (R + 11 * k) + 4 * k); }
  // (스캔선 없음 — 전 방향 동시 송신)
  // EO/IR 시선 · 서치라이트
  if (eo.pwr && eo.mode !== 'STOW' && Math.abs(eo.az) <= half) { const [x, y] = P(eo.az, rdr.rng); g.strokeStyle = 'rgba(80,220,255,0.85)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); g.setLineDash([]); }
  if (hsl.lit && Math.abs(hsl.az) <= half) { const [x, y] = P(hsl.az, rdr.rng * 0.4); g.strokeStyle = 'rgba(255,220,80,0.8)'; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); }
  // SART 응답 — 바깥쪽으로 점 12개(0.64NM)
  const sr = rdrSartReply();
  if (sr) { const rel = normAS(sr.brg - S.hdg); if (Math.abs(rel) <= half) { g.strokeStyle = '#5ef'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { const nm = sr.nm + i * 0.64; if (nm > rdr.rng) break; const [x, y] = P(rel, nm); g.beginPath(); g.arc(x, y, 3.5 * k, 0, 2 * Math.PI); g.stroke(); } const [x, y] = P(rel, sr.nm); g.fillStyle = '#5ef'; g.textAlign = 'left'; g.fillText('SART', x + 8 * k, y - 6 * k); } }
  // 추적 표적(TRK) — 상자 · 번호 · 침로 막대
  const now = performance.now();
  const _cmap = {}; for (const x of msnContacts()) _cmap[x.id] = x;
  for (const [id, no] of Object.entries(rdr.trkNo)) {
    const p = rdr.paint[id]; if (!p || p.nm > rdr.rng) continue;
    const rel = normAS(p.brg - S.hdg); if (Math.abs(rel) > half) continue;
    const [x, y] = P(rel, p.nm), s2 = 8 * k, sel = id === rdr.tgt;
    g.strokeStyle = sel ? A : '#ff5050'; g.lineWidth = 2; g.strokeRect(x - s2, y - s2, 2 * s2, 2 * s2);
    const T = rdr.trk[id];
    if (T && T.spd > 1) { const [la, lo] = destPoint(...destPoint(S.lat, S.lon, p.brg, p.nm), T.cse, T.spd / 60 * 3); const [x2, y2] = P(normAS(bearing(S.lat, S.lon, la, lo) - S.hdg), distance(S.lat, S.lon, la, lo)); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); }
    if (rdr.tails && T && T.tail) { g.fillStyle = sel ? A : '#ff7070'; for (const q of T.tail) { const rq = normAS(bearing(S.lat, S.lon, q.lat, q.lon) - S.hdg), nq = distance(S.lat, S.lon, q.lat, q.lon); if (Math.abs(rq) > half || nq > rdr.rng) continue; const [tx, ty] = P(rq, nq); g.beginPath(); g.arc(tx, ty, 1.8 * k, 0, 2 * Math.PI); g.fill(); } }   // CONTACT TAILS
    if (rdr.lblAll || sel) { g.fillStyle = sel ? A : '#ff7070'; g.textAlign = 'left'; g.fillText(`TRK${String(no).padStart(2, '0')}`, x + s2 + 2, y - s2); const c = _cmap[id]; if (c && c.kind !== 'air') { g.fillStyle = c.ais ? '#6dff9a' : '#ffa040'; g.fillText(c.ais ? (c.ais.sart ? 'AIS-SART' : c.ais.name) : 'NO AIS', x + s2 + 2, y - s2 + 11 * Math.max(0.8, k)); } }   // AIS 이름 · 없으면 NO AIS(단속 의심)   // SEARCH > ALL 꺼지면 고른 표적만 번호
  }
  // 커서
  { const [x, y] = P(rdr.cur.az, rdr.cur.nm); g.strokeStyle = A; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 12 * k, y); g.lineTo(x + 12 * k, y); g.moveTo(x, y - 12 * k); g.lineTo(x, y + 12 * k); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 15 * k, 0, 2 * Math.PI); g.stroke(); }
  // ISAR — 추적 표적 영상
  if (rdr.mode === 'ISAR' && rdr.tx) _rdrIsar(g, W, k);
  // 위 · 아래 글자
  const T2 = (s3, x, y, col = C, al = 'left', n = 12) => { g.font = `bold ${Math.round(n * k)}px monospace`; g.textAlign = al; g.fillStyle = col; g.fillText(s3, x, y); };
  const trk = Number.isFinite(S.trk) ? S.trk : S.hdg;
  const h1 = `Hdg ${fmtA(S.hdg)}°  Trk ${fmtA(trk)}°  SRV RDR CMD `; T2(h1, 8 * k, 38 * k); T2(rdr.cmd, 8 * k + g.measureText(h1).width, 38 * k, rdr.cmd === 'CKPT' ? A : C);
  T2(`${rdr.mode}  RNG ${rdr.rng}NM  Tilt ${rdr.tilt > 0 ? '+' : ''}${rdr.tilt.toFixed(1)}°  Gain ${rdr.gain}  SCN ${rdr.sector}°`, 8 * k, 54 * k);
  const fl = []; if (rdr.frz) fl.push(['FREEZE', '#ff5050']); if (rdr.ronly) fl.push(['R ONLY', '#5ef']); if (rdr.wxr) fl.push(['WXR', C]); if (!rdr.tws) fl.push(['TWS OFF', '#888']);
  try { if (typeof instFail !== 'undefined') { if (instFail.alt !== null) fl.push(['NO ALT', A]); if (instFail.hdg) fl.push(['NO HDG', A]); } } catch (e) { _swallow(e); }
  T2(!rdr.pwr ? 'RDR OFF' : rdr.warm > 0 ? `RDR WARM ${Math.ceil(rdr.warm)}` : rdr.tx ? 'RDR TX' : 'RDR STBY', W - 8 * k, 18 * k, rdr.tx ? C : A, 'right', 13);
  T2(fl.map(f => f[0]).join('  '), W - 8 * k, 38 * k, fl.length ? fl[0][1] : C, 'right');
  let ra = 0; try { ra = radarAltFt(); } catch (e) { ra = 0; }
  const [cl, cn] = destPoint(S.lat, S.lon, normA(rdr.cur.az + S.hdg), rdr.cur.nm), dm = (v, h) => { const a = Math.abs(v), d = Math.floor(a); return `${h}${d}°${((a - d) * 60).toFixed(2).padStart(5, '0')}'`; };
  T2(`Alt ${Math.round(S.alt)}ft  RAlt ${Math.round(ra)}ft  GS ${Math.round(S.spd)}kt  ${dm(S.lat, S.lat >= 0 ? 'N' : 'S')} ${dm(S.lon, S.lon >= 0 ? 'E' : 'W')}`, 8 * k, H - 24 * k);
  T2(`CUR ${rdr.cur.nm.toFixed(1)}NM ${fmtA(rdr.cur.az + S.hdg)}°  ${dm(cl, cl >= 0 ? 'N' : 'S')} ${dm(cn, cn >= 0 ? 'E' : 'W')}`, 8 * k, H - 8 * k, A);
  if (!rdr.tx) T2(rdr.pwr ? (rdr.warm > 0 ? '예열 중 — 90초 뒤 TX' : 'STANDBY — TX 를 누르십시오') : '전원 꺼짐', W / 2, oy - R * 0.45, '#888', 'center', 13);
  // 메뉴(FNC · MAP)
  // 메뉴 — 화면 왼쪽 세로(x 10~155) · 하위 메뉴는 그 오른쪽 상자(FLM 5.20 표 2 · 표 4)
  if (rdr.menu) {
    const M = RDR_MENU[rdr.menu], row = 19 * k, mx = 10 * k, mw = 145 * k, my = 66 * k, mh = M.length * row + 26 * k;
    g.fillStyle = 'rgba(0,18,8,0.92)'; g.fillRect(mx, my, mw, mh); g.strokeStyle = C; g.lineWidth = 1; g.strokeRect(mx, my, mw, mh);
    T2(rdr.menu === 'FNC' ? 'RDR MENU' : 'MAP', mx + mw / 2, my + 15 * k, C, 'center', 12);
    M.forEach((m, i) => {
      const y = my + 22 * k + (i + 0.75) * row, sel = i === rdr.menuI;
      if (sel) { g.fillStyle = rdr.sub === i ? 'rgba(255,210,60,0.22)' : 'rgba(61,255,106,0.25)'; g.fillRect(mx + 3, y - 13 * k, mw - 6, row - 2); }
      T2(m.n + (m.sub ? ' ▷' : ''), mx + 7 * k, y, C, 'left', 11);
      const v = String(m.v()); if (v) T2(v, mx + mw - 6 * k, y, sel ? A : C, 'right', 11);
    });
    if (rdr.sub !== null && M[rdr.sub] && M[rdr.sub].sub) {
      const L = M[rdr.sub].sub, sx = mx + mw + 5 * k, sw = 160 * k, sh = L.length * row + 24 * k;
      let sy = my + 22 * k + rdr.sub * row - 4 * k; sy = Math.max(my, Math.min(sy, H - 40 * k - sh));
      g.fillStyle = 'rgba(0,18,8,0.95)'; g.fillRect(sx, sy, sw, sh); g.strokeStyle = A; g.strokeRect(sx, sy, sw, sh);
      T2(M[rdr.sub].n, sx + sw / 2, sy + 14 * k, A, 'center', 11);
      L.forEach((m, i) => {
        const y = sy + 20 * k + (i + 0.75) * row, sel = i === rdr.subI;
        if (sel) { g.fillStyle = 'rgba(61,255,106,0.25)'; g.fillRect(sx + 3, y - 13 * k, sw - 6, row - 2); }
        T2(`${i + 1} ${m.n}`, sx + 7 * k, y, C, 'left', 11);
        const v = String(m.v()); if (v) T2(v, sx + sw - 6 * k, y, sel ? A : C, 'right', 11);
      });
    }
  }
  if (rdr.info && performance.now() - rdr.infoT < 8000) T2(rdr.info, W / 2, H - 42 * k, A, 'center', 12);   // MAINT · TRACK 결과 한 줄(8초)
}
// TWS — 지형 겹(육지를 어두운 녹색으로) · 2초마다 다시 셈
function _rdrTws(g, ox, oy, R) {
  const key = `${rdr.rng}|${Math.round(S.hdg)}|${S.lat.toFixed(3)}|${S.lon.toFixed(3)}|${rdr.sector}`, now = performance.now();
  if (!rdr.twsC || (rdr.twsK !== key && now - rdr.twsT > 2000)) {
    const N = 200, cv = rdr.twsC || document.createElement('canvas'); cv.width = cv.height = N; const q = cv.getContext('2d'); q.clearRect(0, 0, N, N);
    q.fillStyle = 'rgba(70,95,55,0.75)'; const c = N / 2, Rr = N / 2 - 2, half = rdr.sector / 2;
    for (let a = -half; a <= half; a += 3) for (let b = 1; b <= 30; b++) { const nm = rdr.rng * b / 30, [la, lo] = destPoint(S.lat, S.lon, normA(a + S.hdg), nm); if (!_mWater(la, lo)) { const r = Rr * b / 30; q.fillRect(c + Math.sin(a * _mD) * r - 3, c - Math.cos(a * _mD) * r - 3, 6, 6); } }
    rdr.twsC = cv; rdr.twsK = key; rdr.twsT = now;
  }
  const N = rdr.twsC.width, s2 = R / (N / 2 - 2); g.drawImage(rdr.twsC, ox - N / 2 * s2, oy - N / 2 * s2, N * s2, N * s2);
}
// ISAR — 지정 표적의 옆모습(길이 · 도플러 줄)
function _rdrIsar(g, W, k) {
  const c = rdr.tgt && msnContacts().find(x => x.id === rdr.tgt);
  const w = 170 * k, h = 96 * k, x = W - w - 8 * k, y = 62 * k;
  g.fillStyle = 'rgba(0,10,0,0.9)'; g.fillRect(x, y, w, h); g.strokeStyle = '#3dff6a'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
  g.fillStyle = '#3dff6a'; g.font = `bold ${Math.round(11 * k)}px monospace`; g.textAlign = 'left';
  if (!c) { g.fillText('ISAR — 표적을 추적하십시오', x + 6 * k, y + 16 * k); return; }
  g.fillText(`ISAR TRK${String(rdr.trkNo[c.id] || 0).padStart(2, '0')}  ${Math.round(c.len)}M`, x + 6 * k, y + 15 * k);
  const L = Math.min(w - 20 * k, (w - 20 * k) * c.len / 130 + 20 * k), cx = x + w / 2, cy = y + h * 0.66, t = performance.now() / 300;
  for (let i = 0; i < 26; i++) { const px = cx - L / 2 + L * i / 25, hh = (c.kind === 'vsl' || c.kind === 'ship') ? (i > 8 && i < 16 ? 22 : 9) * k : 6 * k; g.fillStyle = `rgba(120,255,140,${(0.4 + 0.5 * Math.abs(Math.sin(t + i))).toFixed(2)})`; g.fillRect(px, cy - hh, Math.max(1.5, L / 30), hh); }
}
function msnRenderHcu() {
  if (!_msnEl) return;
  _msnEl.querySelectorAll('.hcu-key').forEach(b => b.classList.toggle('dn', !!eo.holdT[b.dataset.hcu]));
  _msnEl.querySelectorAll('.hcu-tg .sw').forEach(s => { const k = s.dataset.sw; s.classList.toggle('up', k === 'pwr' ? eo.pwr : !!eo.holdT[k + ':up']); s.classList.toggle('dn', k === 'pwr' ? !eo.pwr : !!eo.holdT[k + ':dn']); });
  const avt = _msnEl.querySelector('.hcu-avt'); if (avt) avt.classList.toggle('dn', !!eo.holdT.avt);
  const lamp = (n, c) => { const e = _msnEl.querySelector(`[data-lamp="${n}"]`); if (e) e.className = 'hcu-lamp' + (c ? ' ' + c : ''); };
  lamp('on', eo.pwr ? 'g' : ''); lamp('armed', eo.pwr && eo.laserArm ? 'a' : ''); lamp('active', eo.pwr && eo.laserFire ? 'r' : '');
}
function msnRenderPanels() {
  try { _msnScrPwr(); } catch (e) { _swallow(e); }
  if (!_msnEl) return;
  const set = (a, on) => { const b = _msnEl.querySelector(`[data-mact="${a}"]`); if (b) b.classList.toggle('on', !!on); };
  set('fly', S.running); const fb = _msnEl.querySelector('[data-mact="fly"]'); if (fb) fb.textContent = S.running ? '❚❚ 멈춤' : '▶ 비행';
  set('rtx', rdr.tx); set('rfrz', rdr.frz); set('ronly', rdr.ronly); set('rcmd', rdr.cmd !== 'CKPT');
  const lb = (a, t) => { const b = _msnEl.querySelector(`[data-mact="${a}"]`); if (b) b.textContent = t; };
  lb('rmode', `MODE ${rdr.mode}`); lb('rcmd', `CMD ${rdr.cmd}`); lb('rsec', `SCAN ${rdr.sector}°`); lb('rtx', rdr.tx ? 'TX' : rdr.warm > 0 ? `WARM ${Math.ceil(rdr.warm)}` : 'STBY');
  const sOn = hsl.lit;
  set('slon', sOn); set('slman', srch.mode === 'MAN'); set('sleo', srch.mode === 'EO'); set('slrdr', srch.mode === 'RDR');
  const ac = _msnEl.querySelector('[data-m="ac"]'); if (ac) ac.textContent = `HDG ${fmtA(S.hdg)}  ALT ${Math.round(S.alt)}FT  GS ${Math.round(S.spd)}KT`;
  // 다른 기기의 Vendor — 조종석 기기와의 연결(받은 지 얼마 · 왕복 시간). 끊기면 화면이 멈춘 채 보이므로 빨갛게 깜박인다
  const lk = _msnEl.querySelector('[data-m="link"]');
  if (lk && MSN_REMOTE && typeof iosLinkState === 'function') {
    const L = iosLinkState(), sec = L.age === null ? 0 : Math.round(L.age / 1000);
    const t = L.st === 'wait' ? '○ 조종석 기다림' : L.st === 'lost' ? `● 연결 끊김 ${sec}초` : L.st === 'slow' ? `● 응답 늦음 ${sec}초` : `● 조종석 연결 ${L.rtt === null ? '' : L.rtt + 'ms'}`;
    lk.style.display = 'inline-block'; lk.className = 'msn-link ' + L.st; if (lk.textContent !== t) lk.textContent = t;
    lk.title = '조종석 기기와의 연결 — 왕복 시간 · 마지막으로 상태를 받은 뒤 지난 시간(끊기면 화면은 마지막 상태로 멈춘다)';
  }
  const td = _msnEl.querySelector('[data-m="tdata"]');
  if (td) {
    const c = rdr.tgt && msnContacts().find(x => x.id === rdr.tgt), T = rdr.tgt && rdr.trk[rdr.tgt];
    td.textContent = c ? `TGT ${c.id} (${c.name})\nRNG ${distance(S.lat, S.lon, c.lat, c.lon).toFixed(2)}NM  BRG ${fmtA(bearing(S.lat, S.lon, c.lat, c.lon))}°` +
      (T && T.spd != null ? `\nCSE ${fmtA(T.cse || 0)}°  SPD ${T.spd.toFixed(1)}KT` : '\nCSE ---  SPD ---') +
      (c.kind === 'air' ? '' : c.ais ? `\n${aisLabel(c)}  MMSI ${c.ais.mmsi}` : '\nNO AIS — 신원 확인(EO/IR) · 단속 대상 여부') : (rdr.tx ? '표적을 누르면 지정합니다' : '');
  }
  slcRender(); dvrRender();
  _msnEl.querySelectorAll('[data-dk]').forEach(b => { const k = b.dataset.dk; b.classList.toggle('on', (k === 'multi' && disp.lay === 'quad') || (k === 'split' && disp.lay === 'split') || (k === 'pip' && eo.pip !== 'OFF') || (k === 'pwr' && disp.pwr) || (k === 'navi' && disp.lay === 'one' && disp.ch === 4) || (k === 'v' + disp.ch && disp.lay === 'one')); });
  _clnLeds(_msnEl);
  const sd = _msnEl.querySelector('[data-m="sdata"]');
  if (sd) {
    const lamp = !hsl.pwr ? 'PWR OFF' : hsl.lit ? `LAMP ${hsl.ir ? 'IR' : 'VIS'}` : hsl.lamp ? `IGN ${Math.ceil(hsl.ign)}s` : hsl.cool > 0 ? `FAN ${Math.floor(hsl.cool / 60)}:${String(Math.floor(hsl.cool % 60)).padStart(2, '0')}` : 'OFF';
    const pos = hsl.mv ? `${hsl.mv.to} ${Math.ceil(hsl.mv.t)}s` : hsl.stowed ? 'STOWED' : srch.mode === 'EO' ? 'AUTO(SLASS)' : srch.mode === 'RDR' ? 'RDR SLAVE' : 'MAN';
    sd.textContent = `${lamp}  ${pos}${srch.lim ? '  LIMIT' : ''}\nAZ ${hsl.az >= 0 ? '+' : ''}${hsl.az.toFixed(0)}°  EL ${hsl.el.toFixed(0)}°  BEAM ${hsl.focus.toFixed(1)}°${hsl.haz ? '\n⚠ 10ft THERMAL HAZARD' : ''}`;
    sd.style.color = hsl.haz ? '#ff6060' : '';
  }
}
function _msnFit(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(r.width * d), h = Math.round(r.height * d); if (w > 0 && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; } return { W: w, H: h }; }
// ── NAVI 지도 칸(왼쪽 위) — 위성 지도 · 기체(원 안의 헬기 · 기수) · 비행계획 · 항적선 · 레이더 표적 · EO/IR 시선 · 커서 ──
let _nvMap = null;
function _nvEnsure(el) {
  if (_nvMap || typeof maplibregl === 'undefined' || !(el.clientWidth > 20 && el.clientHeight > 20)) return _nvMap;
  try {
    _nvMap = new maplibregl.Map({ container: el, style: _map3dStyle(), center: [S.lon, S.lat], zoom: 11, pitch: 0, bearing: 0, interactive: false, attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },   // 녹화기 CH4 가 옮겨 담을 수 있게
      pixelRatio: (typeof map3dPixelRatio === 'function') ? map3dPixelRatio(true) : 1 });
    _nvMap.on('error', e => console.warn('[NAVI]', e && e.error ? e.error.message : e));
    try { if (typeof mapGlGuard === 'function') mapGlGuard(_nvMap, '전탐석 지도', m => { if (_nvMap === m) _nvDrop(); }); } catch (e) { _swallow(e); }
  } catch (e) { console.warn('[NAVI] map failed:', e); _nvMap = null; }
  return _nvMap;
}
function _nvDrop() { try { if (_nvMap) _nvMap.remove(); } catch (e) { _swallow(e); } _nvMap = null; }
function _nvRender(cell) {
  const el = cell.querySelector('.nv-map'), ov = cell.querySelector('.nv-ov');
  const map = _nvEnsure(el); if (!map) return;
  const W = el.clientWidth, H = el.clientHeight;
  // 기수가 위 · 기체는 아래쪽(앞을 넓게) — 커서로 가운데를 옮겼으면 그 자리 · 북쪽 위
  const hdgUp = !nv.ctr, mpp = nv.nm * 1852 * 2 / Math.max(50, W);
  const z = Math.log2(40075016.686 * Math.cos(S.lat * _mD) / (512 * mpp));
  let c = nv.ctr; if (!c) { const [la, lo] = destPoint(S.lat, S.lon, S.hdg, nv.nm * 0.45 * H / W); c = { lat: la, lon: lo }; }
  try { _mJump(map, { center: [c.lon, c.lat], zoom: z, bearing: hdgUp ? S.hdg : 0, pitch: 0 }); } catch (e) { _swallow(e); }
  const d = _msnFit(ov), k = d.W / Math.max(1, W), g = ov.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, d.W, d.H); g.setTransform(k, 0, 0, k, 0, 0);
  const P = (lat, lon) => { try { return map.project([lon, lat]); } catch (e) { return null; } };
  // 비행계획(빨강) · 항적선(초록)
  try {
    const wps = (S.wps || []).filter(w => w && Number.isFinite(w.lat));
    if (wps.length > 1) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 1.5; g.beginPath(); wps.forEach((w, i) => { const q = P(w.lat, w.lon); if (q) i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); g.stroke(); }
  } catch (e) { _swallow(e); }
  const a = P(S.lat, S.lon);
  if (a) {
    const [fl, fo] = destPoint(S.lat, S.lon, S.hdg, nv.nm * 3), f = P(fl, fo);
    if (f) { g.strokeStyle = '#3dff6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(f.x, f.y); g.stroke(); }
    // EO/IR 시선(하늘색 점선) · 서치라이트(노랑)
    if (eo.pwr && eo.mode !== 'STOW') { const [la, lo] = destPoint(S.lat, S.lon, normA(S.hdg + eo.az), nv.nm * 2), q = P(la, lo), pt = eoAimPoint(); if (q) { g.setLineDash([5, 4]); g.strokeStyle = 'rgba(120,230,255,0.9)'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke(); g.setLineDash([]); } if (pt) { const r = P(pt.lat, pt.lon); if (r) { g.strokeStyle = '#7df'; g.beginPath(); g.arc(r.x, r.y, 6, 0, 2 * Math.PI); g.stroke(); } } }
    if (hsl.lit) { const [la, lo] = destPoint(S.lat, S.lon, normA(S.hdg + hsl.az), nv.nm * 0.6), q = P(la, lo); if (q) { g.strokeStyle = 'rgba(255,220,80,0.85)'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke(); } }
    // 기체 — 원 안의 헬기 · 위에 기수
    const rot = (hdgUp ? 0 : S.hdg) * _mD;
    g.save(); g.translate(a.x, a.y);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 18, 0, 2 * Math.PI); g.stroke();
    g.rotate(rot); g.beginPath(); g.moveTo(-14, -9); g.lineTo(14, 9); g.moveTo(14, -9); g.lineTo(-14, 9); g.moveTo(0, -8); g.lineTo(0, 14); g.stroke();
    g.restore();
    g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
    g.strokeText(fmtA(S.hdg), a.x, a.y - 26); g.fillText(fmtA(S.hdg), a.x, a.y - 26);
  }
  // 레이더 표적(WXR 이 켜져 있으면 레이더가 그린 것 · 아니면 지정 표적만)
  const now = performance.now();
  for (const c2 of msnContacts()) {
    const pnt = rdr.paint[c2.id], painted = pnt && now - pnt.t < RDR_RPM_S * 1500;
    if (!(rdr.tx && painted) && c2.id !== rdr.tgt) continue;
    const q = P(c2.lat, c2.lon); if (!q) continue;
    g.fillStyle = c2.kind === 'air' ? '#9ff' : '#ffef6a'; g.beginPath(); g.moveTo(q.x, q.y - 6); g.lineTo(q.x + 6, q.y); g.lineTo(q.x, q.y + 6); g.lineTo(q.x - 6, q.y); g.fill();
    if (c2.id === rdr.tgt) { g.strokeStyle = '#ffc400'; g.lineWidth = 2; g.strokeRect(q.x - 10, q.y - 10, 20, 20); g.fillStyle = '#ffc400'; g.font = 'bold 11px Arial'; g.textAlign = 'left'; g.fillText(c2.id, q.x + 12, q.y - 8); }
    if (!c2.ais && c2.kind !== 'air') { g.fillStyle = '#ffa040'; g.font = '10px Arial'; g.textAlign = 'left'; g.fillText('NO AIS', q.x + 9, q.y + 4); }
  }
  // AIS — 받은 배는 침로로 돌린 초록 삼각형 · 이름 / AIS-SART 는 빨간 원 십자 (레이더가 꺼져 있어도 보인다)
  for (const c2 of aisTargets()) {
    const q = P(c2.lat, c2.lon); if (!q) continue;
    g.save(); g.translate(q.x, q.y); g.lineWidth = 1.5;
    if (c2.ais.sart) { g.strokeStyle = '#ff4040'; g.beginPath(); g.arc(0, 0, 7, 0, 2 * Math.PI); g.moveTo(-5, -5); g.lineTo(5, 5); g.moveTo(5, -5); g.lineTo(-5, 5); g.stroke(); }
    else { g.rotate(((c2.hdg || 0) - (hdgUp ? S.hdg : 0)) * _mD); g.strokeStyle = '#6dff9a'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.stroke(); }
    g.restore();
    g.font = '10px Arial'; g.textAlign = 'left'; g.fillStyle = c2.ais.sart ? '#ff6060' : '#6dff9a'; g.fillText(c2.ais.sart ? 'AIS-SART' : c2.ais.name, q.x + 9, q.y + 12);
  }
  // 커서
  if (nv.cur) { const q = P(nv.cur.lat, nv.cur.lon); if (q) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(q.x - 12, q.y); g.lineTo(q.x + 12, q.y); g.moveTo(q.x, q.y - 12); g.lineTo(q.x, q.y + 12); g.stroke(); } }
  // 위 — 좌표(초록) · 시각(노랑) · 아래 — 축척 · 레이어
  const dms = (v, h) => { const x = Math.abs(v), dd = Math.floor(x), mm = Math.floor((x - dd) * 60), ss = ((x - dd) * 60 - mm) * 60; return `${h}${dd}°${String(mm).padStart(2, '0')}'${ss.toFixed(3).padStart(6, '0')}"`; };
  const ref = nv.cur || { lat: S.lat, lon: S.lon }, t = new Date(), d2 = n => String(n).padStart(2, '0');
  g.textAlign = 'left'; g.font = 'bold 14px Arial'; g.lineWidth = 3; g.strokeStyle = '#000';
  const tx = (s2, x, y, col) => { g.strokeText(s2, x, y); g.fillStyle = col; g.fillText(s2, x, y); };
  tx('----- ----- -----', W * 0.22, 26, '#fff');
  tx(`${dms(ref.lat, ref.lat >= 0 ? 'N' : 'S')}, ${dms(ref.lon, ref.lon >= 0 ? 'E' : 'W')}`, W * 0.22, 46, '#3dff6a');
  g.textAlign = 'right'; tx(`${d2(t.getHours())}:${d2(t.getMinutes())}:${d2(t.getSeconds())}`, W - 10, 30, '#ffd23a');
  g.textAlign = 'left'; g.font = 'bold 11px Arial';
  tx(`${nv.nm * 2}NM  ${hdgUp ? 'HDG UP' : 'N UP'}`, 8, H - 8, '#cfe');
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// ── 호이스트 카메라 칸(오른쪽 위) — 24-sar.js HOIST CAM 을 옮겨 그린다 ──
let _hcWantT = -Infinity;
function msnHoistWant() { return performance.now() - _hcWantT < 3000; }
let _hcSeen = '', _hcCopyT = 0;
function _hcRender(cell) {
  const cv = cell.querySelector('.hc-cv'), d = _msnFit(cv); if (!(d.W > 0)) return;
  // 지도 · HUD 가 새로 그려졌을 때만 옮긴다 — 3D 지도 그림(WebGL)을 2D 캔버스로 옮기는 것이 무거워(초당 20번이면 CPU 를 크게 먹었다)
  const seq = typeof sarHoistCamSeq === 'function' && typeof sarHoistCamOn === 'function' && sarHoistCamOn() ? sarHoistCamSeq() : -1, key = `${seq}|${d.W}x${d.H}`;
  const now = performance.now();
  if (seq >= 0 && (key === _hcSeen || (key.split('|')[1] === _hcSeen.split('|')[1] && now - _hcCopyT < 100))) { _hcWantT = now; return; }   // 바뀌어도 초당 10번까지
  _hcSeen = key; _hcCopyT = now;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, d.W, d.H);
  if (typeof sarHoistCamDrawTo !== 'function') return;
  _hcWantT = performance.now();
  const s = Math.min(d.W / 640, d.H / 480);   // 다 보이게(글씨가 잘리지 않게)
  g.save(); g.beginPath(); g.rect(0, 0, d.W, d.H); g.clip();
  try { sarHoistCamDrawTo(g, (d.W - 640 * s) / 2, (d.H - 480 * s) / 2, 640 * s, 480 * s); } catch (e) { _swallow(e); }
  g.restore();
}
const _cellVis = c => c && c.style.display !== 'none' && c.clientWidth > 20 && c.clientHeight > 20;
function msnRender() {
  if (_eoNeed()) _eoCamera(); else if (_eoMap) _eoMapDrop();
  // 조종석 SYSTEM 창이 EO/IR 영상을 띄우고 있으면 자주 다시 그린다(평소 4번/초 → 10번/초)
  try {
    if (typeof sysPage !== 'undefined' && (sysPage === 'asys_video' || (typeof sysLayout !== 'undefined' && sysLayout === 'HALF' && (sysHalf.L === 'asys_video' || sysHalf.R === 'asys_video'))) && typeof videoCfg !== 'undefined' && videoCfg.ch === 'EO/IR' && (_msnFrame++ % 2 === 0)) {
      const w = document.getElementById('sysp-wrap'); if (w && !w.classList.contains('page-hidden') && w.clientWidth > 40) sysDraw();
    }
  } catch (e) { _swallow(e); }
  if (!msnOpen || !_msnEl) return;
  if (!msnScreenOn()) { if (performance.now() - _msnTickT > 300) { _msnTickT = performance.now(); msnRenderPanels(); } return; }   // 화면이 꺼져 있으면 그리지 않는다(DMM 전원 · 녹화기 POWER · M-PWR) — 조작기 · 표시등은 그린다
  const ceo = _msnEl.querySelector('.c-eo');
  if (_cellVis(ceo)) {
    if (_eoMap && _eoHost && !ceo.contains(_eoHost)) _eoHostPlace();
    const vid = ceo.querySelector('.eo-vid'), f = eo.pwr && eo.mode !== 'STOW' ? eoVideoFilter() : 'brightness(0)';
    if (vid.style.filter !== f) vid.style.filter = f;
    const spr = ceo.querySelector('.eo-spr'), s = _msnFit(spr); _eoSprites(spr, s.W, s.H);
    const hud = ceo.querySelector('.eo-hud'), h = _msnFit(hud); _eoHud(hud, h.W, h.H);
  } else if (_eoHost && ceo && ceo.contains(_eoHost)) _eoHostPlace();
  const crd = _msnEl.querySelector('.c-rdr'), rc = crd.querySelector('canvas'); _msnFit(rc);
  if (_cellVis(crd) || eo.pip === 'RDR') _rdrDraw(rc);
  const cmap = _msnEl.querySelector('.c-map'); if (_cellVis(cmap)) _nvRender(cmap); else if (_nvMap && !_cellVis(cmap)) _nvDrop();
  const chc = _msnEl.querySelector('.c-hoist'); if (_cellVis(chc)) _hcRender(chc);
  try { dvrPlayDraw(); } catch (e) { _swallow(e); }
  if (performance.now() - _msnTickT > 300) { _msnTickT = performance.now(); msnRenderPanels(); }
}
// 전탐석을 새 창으로(00-popout.js popoutElement) — 조종사는 이 창의 조종석, 전탐요원은 다른 모니터의 전탐석
function msnPopped() { return typeof popoutHas === 'function' && popoutHas('el-msn'); }
function msnPopout() {
  if (typeof popoutElement !== 'function') return false;
  if (msnPopped()) { popoutElement('msn'); return true; }   // 다시 누르면 이 창으로
  msnShow(true);
  const ok = popoutElement('msn', 'msn-root', '흰수리 전탐석', [1500, 900]);
  if (ok) { _mNote('전탐석 새 창'); setTimeout(() => { try { dispSet(); msnRenderPanels(); } catch (e) { _swallow(e); } }, 300); }
  return ok;
}
function msnShow(on) {
  if (!MSN_ON) return;
  const R = _msnBuild();
  msnOpen = on !== undefined ? !!on : !msnOpen;
  R.classList.toggle('on', msnOpen);
  if (!msnOpen) _nvDrop(); else dispSet();
  if (_eoMap) _eoHostPlace();                 // 지도를 전탐석 화면 ⇄ 화면 밖으로 옮긴다(조종석 SYSTEM 창이 계속 쓸 수 있게)
  msnRenderHcu(); msnRenderPanels();
}
// ── Vendor 창 — 창 위 탭 'Vendor'(07-sim.js applyPanels)가 고르면 전탐석(#msn-root)을 그 창(#msn-wrap)에 넣는다 ──
//   창이 보일 때만 연다(Cockpit Mode 처럼 분할 창이 숨으면 닫아 EO/IR 3D 지도를 쉬게) · 탭을 바꾸면 닫고 본 문서로 되돌린다
//   새 창(⧉)에 떠 있으면 그대로 둔다(새 창을 닫으면 이 창 자리로 돌아온다)
let _msnInPanel = false, _msnPanelWant = false;
function msnInPanel() { return _msnInPanel; }
function msnPanelSync(want) {
  if (!MSN_ON) return;
  if (want !== undefined) _msnPanelWant = !!want;
  const W = document.getElementById('msn-wrap'); if (!W) return;
  if (msnPopped()) return;
  const vis = _msnPanelWant && !W.classList.contains('page-hidden') && W.getClientRects().length > 0;
  const R = _msnEl || (vis ? _msnBuild() : null); if (!R) return;
  if (vis) {
    if (R.parentElement !== W) W.appendChild(R);
    R.classList.add('in-panel');
    if (!_msnInPanel || !msnOpen) { _msnInPanel = true; msnShow(true); }
    _msnPanelZoom();
  } else if (_msnInPanel) {
    _msnInPanel = false;
    R.classList.remove('in-panel');
    if (R.parentElement === W) { if (_msnPanelWant) R.classList.add('in-panel'); else document.body.appendChild(R); }   // 창은 그대로(숨었을 뿐)면 자리에 둔다
    msnShow(false);
  }
}
// 창이 숨거나 다시 보이는 것(Cockpit Mode · Simple 등)은 applyPanels 를 거치지 않을 수도 있어 가끔 다시 본다
if (MSN_ON) setInterval(() => { try { msnPanelSync(); _msnPanelZoom(); } catch (e) { _swallow(e); } }, 700);
// 좁은 창(1100px 아래)에서는 표시기를 위에 · 조작기를 아래에 쌓고, 조작기를 창 너비에 맞춰 줄인다(--msn-z)
function _msnPanelZoom() {
  const R = _msnEl; if (!R || !_msnInPanel) return;
  const w = R.clientWidth; if (!(w > 50)) return;
  const z = w < 1100 ? Math.max(0.4, Math.min(1, (w - 20) / MSN_CTL_W)).toFixed(3) : '1';
  if (R.style.getPropertyValue('--msn-z') !== z) R.style.setProperty('--msn-z', z);
}
const MSN_CTL_W = 820;   // 조작기 묶음(HCU · DVR · 탐조등 · 레이더)이 다 보이는 너비(px)
// 한 걸음(전탐석이 닫혀 있어도 — 선박 · 서치라이트 연동 · 터릿 · 레이더는 계속 돈다)
let _msnT = 0, _msnFrame = 0;
function msnStep() {
  const now = performance.now(), dt = _msnT ? Math.min(0.25, (now - _msnT) / 1000) : 0; _msnT = now;
  if (!dt) return;
  if (MSN_REMOTE) {   // 다른 기기의 Vendor — 계산은 조종석 기기가 하고(상태를 받는다) 여기서는 레이더 그림 · 화면만
    try { rdrStep(dt); } catch (e) { _swallow(e); }
    try { msnRender(); } catch (e) { _swallow(e); }
    return;
  }
  if (_msnRjT && now - _msnRjT > 1000) { eo.joy.x = eo.joy.y = 0; slc.joy.x = slc.joy.y = 0; _msnRjT = 0; }   // 다른 기기의 조이스틱 소식이 끊기면 가운데로
  const run = typeof S !== 'undefined' && S.running;
  try { if (run) _vslStep(dt * ((typeof simSpeed !== 'undefined' && Number(simSpeed)) || 1)); } catch (e) { _swallow(e); }
  try { eoStep(dt); } catch (e) { _swallow(e); }
  try { rdrStep(dt); } catch (e) { _swallow(e); }
  try { hslStep(dt); if (_slHold) srchMan(_slHold, dt); slcStep(dt); srchStep(dt); } catch (e) { _swallow(e); }
  try { if (typeof _kgHslSync === 'function') _kgHslSync(); } catch (e) { _swallow(e); }   // 컬렉티브 SRCH 표시
  try { if (MSN_ON) dvrStep(dt); } catch (e) { _swallow(e); }
  try { msnRender(); } catch (e) { _swallow(e); }
  try { vccpRender(); } catch (e) { _swallow(e); }
}
// ══ 레이더 메뉴 키보드(FLM 5.20) — Vendor 위에 마우스가 있을 때만: M 메뉴 · ↑↓ 고르기 · Enter 실행 · 1~9 하위 메뉴 · Esc 뒤로 ══
//   (마우스가 Vendor 밖이면 이 키들은 종전처럼 비행 조작에 쓰인다)
let _msnHover = false;
if (MSN_ON) {
  document.addEventListener('pointerover', e => { _msnHover = !!(_msnEl && e.target && _msnEl.contains(e.target)); }, true);
  document.addEventListener('keydown', e => {
    if (!_msnHover || !msnOpen || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    let k = null;
    if (e.key === 'm' || e.key === 'M') k = 'fnc';
    else if (rdr.menu) {
      if (e.key === 'ArrowUp') k = 'rot:-1'; else if (e.key === 'ArrowDown') k = 'rot:1';
      else if (e.key === 'Enter') k = 'push'; else if (e.key === 'Escape') k = 'esc';
      else if (/^[1-9]$/.test(e.key)) k = 'n' + e.key;
    }
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (k === 'push') { clnPress('push', true); clnPress('push', false); } else clnPress(k, true);
  }, true);
}
// ══ Vendor 를 다른 기기에서 — 교관 화면(?ios=1 · 같은 브라우저 · 다른 기기는 QR 연결)의 위 막대 Vendor ══
//   조종석 기기가 계산한다(EO/IR 터릿 · 레이더 · 탐조등 · 선박 · DVR) — 교관 화면은 그 상태를 받아(31-ios.js iosMirror → msnSyncApply) 그린다
//   교관 화면에서 누른 HCU · 탐조등 · 레이더 조작기 · 표시기 단추 · 조이스틱은 조종석 기기로 보내 그쪽에서 누른다(msnRemoteCmd)
//   그래서 조종사 SYSTEM 창 EO/IR 영상 · 3D 탐조등 빛과 다른 기기의 Vendor 가 늘 같다
const MSN_REMOTE = MSN_ON && typeof IOS_MODE !== 'undefined' && IOS_MODE;
const MSN_RCMD = ['hcuPress', 'slcPress', 'clnPress', 'dvrPress', 'dispKey', 'rdrPickRB', 'eoFocusBy', 'msnSpawn', 'msnVslClear', 'srchMode', 'rdrTrack', 'msnAct'];
const MSN_LOCAL_ACT = new Set(['help', 'close', 'popout', 'fly']);   // 이 기기에서만(화면 · 도움말) — 비행 시작/멈춤은 교관 화면의 단추로
let _msnRjT = 0;
// 보낼 상태 — 그림(캔버스) · 누르고 있는 단추 · 녹화 영상은 빼고 값만
function msnSyncState() {
  if (!MSN_ON) return null;
  const { pcv, ...r } = rdr, { down, ...sl } = slc;
  return { eo, rdr: r, hsl, srch, disp, slc: sl, nv, vsl: msnVsl,
    dvr: { pwr: dvr.pwr, boot: dvr.boot, rec: dvr.rec, play: dvr.play, ch: dvr.ch, menu: dvr.menu, menuI: dvr.menuI, view: dvr.view, pb: dvr.pb } };
}
// 받은 상태를 넣는다(교관 화면) — 조이스틱 객체(eo.joy · slc.joy)는 화면 스틱이 쥐고 있어 바꿔 끼우지 않는다
function msnSyncApply(o) {
  if (!MSN_ON || !o) return;
  const put = (t, v, keep = []) => { if (!v || typeof v !== 'object') return; const k0 = {}; keep.forEach(k => { k0[k] = t[k]; }); Object.assign(t, v); Object.assign(t, k0); };
  put(eo, o.eo, ['joy']); put(rdr, o.rdr, ['pcv']); put(hsl, o.hsl); put(srch, o.srch); put(slc, o.slc, ['joy', 'down']); put(nv, o.nv); put(dvr, o.dvr);
  if (o.disp) { const was = JSON.stringify(disp); Object.assign(disp, o.disp); if (JSON.stringify(disp) !== was) { try { dispSet(); } catch (e) { _swallow(e); } } }
  if (Array.isArray(o.vsl)) { msnVsl.length = 0; msnVsl.push(...o.vsl); }
}
// 조종석 기기 — 교관 화면이 보낸 조작(이름이 정해진 것만)
function msnRemoteCmd(m) {
  if (!MSN_ON || MSN_REMOTE || !m) return;
  if (m.f === '_joy') { const a = (m.a || []).map(v => _mClamp(+v || 0, -1, 1)); eo.joy.x = a[0]; eo.joy.y = a[1]; slc.joy.x = a[2]; slc.joy.y = a[3]; _msnRjT = performance.now(); return; }
  if (!MSN_RCMD.includes(m.f) || (m.f === 'msnAct' && MSN_LOCAL_ACT.has((m.a || [])[0]))) return;
  const fn = window[m.f]; if (typeof fn !== 'function') return;
  try { fn(...(Array.isArray(m.a) ? m.a.slice(0, 4) : [])); } catch (e) { _swallow(e); }
}
if (MSN_REMOTE) {
  // 조작은 조종석 기기로 — 이 기기의 같은 이름 함수를 '보내기'로 바꿔 낀다(화면 단추 · 조이스틱 배정이 모두 이 이름을 부른다)
  for (const f of MSN_RCMD) {
    const orig = window[f]; if (typeof orig !== 'function') continue;
    window[f] = function (...a) {
      if (f === 'msnAct' && MSN_LOCAL_ACT.has(a[0])) return orig.apply(this, a);
      try { iosCmd('msn', { f, a }); } catch (e) { _swallow(e); }
    };
  }
  // 조이스틱(화면 스틱 · 이 기기에 꽂은 장치) — 바뀌면 보낸다(움직이는 동안은 0.3초마다 다시)
  let _rjLast = '', _rjT = 0;
  setInterval(() => {
    const pj = _msnJoyAxes(), x = _mClamp(eo.joy.x + (pj ? pj.x : 0), -1, 1), y = _mClamp(eo.joy.y + (pj ? pj.y : 0), -1, 1);
    const a = [x, y, slc.joy.x, slc.joy.y].map(v => +v.toFixed(3)), k = a.join(','), moving = a.some(v => v !== 0), now = performance.now();
    if (k !== _rjLast || (moving && now - _rjT > 300)) { _rjLast = k; _rjT = now; try { iosCmd('msn', { f: '_joy', a }); } catch (e) { _swallow(e); } }
  }, 100);
}
// 흰수리(전탐석 · 조종석 모두)는 EO/IR 터릿이 돈다 — 조종석 SYSTEM 창 Video(EO/IR) 가 영상을 띄운다
if (EO_ON) setInterval(msnStep, 50);
if (MSN_ON) {
  // 🎯 Vendor — 3D 조종석 화면(Cockpit Mode · 분할 창이 숨는다)에서만 오른쪽 버튼 줄(#ctl3d) 맨 아래 — 전탐석을 화면 가득(조종석 보기 ⤴ 로 돌아온다)
  //   그 밖에서는 창 위 탭 'Vendor' 로 띄운다(분할 창 · Simple 위 막대)
  setInterval(() => {
    const b = document.getElementById('msn-open-btn'); if (!b) return;
    const ctl = document.getElementById('ctl3d'), inCtl = !!(ctl && ctl.offsetParent);
    if (inCtl) { if (ctl.lastElementChild !== b) ctl.appendChild(b); b.classList.add('sim-btn', 'in-ctl'); b.style.display = ''; }
    else { if (b.parentElement !== document.body) document.body.appendChild(b); b.classList.remove('sim-btn', 'in-ctl'); b.style.display = 'none'; }
    const t = msnPopped() ? '🎯 Vendor 창' : '🎯 Vendor'; if (b.textContent !== t) b.textContent = t;
  }, 500);
  try {
    const b = document.createElement('button'); b.id = 'msn-open-btn'; b.type = 'button'; b.textContent = '🎯 Vendor'; b.style.display = 'none';
    b.addEventListener('click', () => {
      if (msnPopped() && popoutFocus('el-msn')) return;
      const R = _msnBuild(); _msnInPanel = false; R.classList.remove('in-panel'); if (R.parentElement !== document.body) document.body.appendChild(R);   // 숨은 창 안이면 화면 가득으로 꺼낸다
      msnShow(true);
    });
    (document.body ? Promise.resolve() : new Promise(r => document.addEventListener('DOMContentLoaded', r))).then(() => { _msnCss(); document.body.appendChild(b); });
  } catch (e) { _swallow(e); }
  // 조이스틱 버튼에 HCU 동작을 배정할 수 있게(12-joystick.js 설정 화면 '전탐석 HCU' 묶음)
  try {
    const add = (id, label, key, kind = 'hold') => { const a = { id, grp: '전탐석 HCU', label, kind, on: () => hcuPress(key, true), off: () => hcuPress(key, false), run: () => { hcuPress(key, true); hcuPress(key, false); } }; JOY_ACTIONS.push(a); JOY_ACT_BY_ID[id] = a; };
    add('hcuAvt', 'AVT (누름 · 1.5초 해제)', 'avt'); add('hcuLrf', 'LRF (누름 · 2초 연속)', 'lrf'); add('hcuZin', 'ZOOM ▲ 확대', 'zoom:up'); add('hcuZout', 'ZOOM ▼ 축소', 'zoom:dn');
    add('hcuVic', 'VIC 센서 바꾸기', 'vic:up', 'press'); add('hcuEz', '2X 전자 줌', 'ez', 'press'); add('hcuPol', 'POL 백상/흑상', 'pol', 'press');
    add('hcuAuto', 'STEERING AUTO', 'steer:up', 'press'); add('hcuMan', 'STEERING MANUAL', 'steer:dn', 'press'); add('hcuSlew', 'SLEW (POI)', 'slew:up', 'press');
    add('hcuFwd', 'FWD (2초 — 새 전방)', 'slew:dn'); add('hcuStow', 'STOW', 'stow', 'press'); add('hcuMap', 'MAP (POI 고르기)', 'map', 'press');
    add('hcuLaser', 'LASER (누르는 동안)', 'laser'); add('hcuAux', 'AUX — 서치라이트 EO/IR 연동', 'aux', 'press');
    const s = { id: 'hcuSrch', grp: '전탐석 HCU', label: '서치라이트 ON/OFF', kind: 'press', run: () => msnAct('slon') }; JOY_ACTIONS.push(s); JOY_ACT_BY_ID[s.id] = s;
  } catch (e) { _swallow(e); }
  try { if (typeof HELP_ITEMS !== 'undefined') HELP_ITEMS.push(['🎯 Vendor · 흰수리 전탐석', '흰수리면 창 위 탭(CDU · MAP · UPPER … 옆)에 Vendor 가 있다 — 누르면 그 창에 전탐석(EO/IR · SAR 레이더 · 서치라이트 · HCU 조작기 · DVR)이 뜬다. 다른 창에는 PFD · 3D 를 두고 나란히 보며 조종사와 전탐요원이 함께 훈련한다. 창 위 ⧉ POP UP 이나 전탐석 위 막대 ⧉ 새 창 으로 다른 모니터에 띄운다. Simple Mode 는 위 막대의 Vendor, Cockpit Mode 는 오른쪽 버튼 줄 맨 아래 🎯 Vendor(화면 가득 · 조종석 보기 ⤴ 로 돌아온다). 전탐석이 움직이는 EO/IR 영상은 조종석 SYSTEM 창 Video(Channel EO/IR)에도 나온다. 전탐석 위 막대 ❓ 에 조작법.']); } catch (e) { _swallow(e); }
}
try { appRegister({ msnShow, msnAct, msnSpawn, hcuPress, msnPanelSync }); } catch (e) { _swallow(e); }
