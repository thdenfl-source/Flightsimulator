// ── LOWER CONSOLE(하부 콘솔) ── 탭의 'LOWER' 로 연다. 상부 콘솔(17-upper.js)과 같은 엔진·같은 저장소를 쓴다
// (스위치 id 가 서로 달라 ovhdGet · ovhdSet · ovhdOn 으로 함께 읽고 쓴다).
// 실기 하부 콘솔 그림(⑥~⑰)대로 — 왼쪽 열: ⑰ AHRS · ⑯ AFCAU · ⑮ 비디오 컨버터 · ⑭ 비상부주 · ⑬ 호이스트 · ⑫ CPI · ⑪ PA
//                                    오른쪽 열: ⑥ FUEL · ⑦ C-5000 · ⑧ NPX138 VHF-FM · ⑨ AVCS · ⑩ MPP · NOSE WHEEL LOCK · PARKING BRAKE
// 조작 종류: lpb(눌러 두는 사각 버튼 — 들어가면 글씨가 켜진다) · key(누르는 동안만) · lamp(표시등) · disp(표시창) 와 상부 콘솔의 것들.

const LCON_W = 1000, LCON_H = 1400;
const _lit = id => () => { try { return ovhdGet(id) === 'ARMED' || ovhdGet(id) === 1 || ovhdGet(id) === 'IN'; } catch (e) { return false; } };
const LCON_PLATES = [
  // ── 왼쪽 열 ──
  // ⑰ AHRS 패널
  { x: 10, y: 10, w: 490, h: 260, items: [
    { t: 'lbl', x: 245, y: 24, text: 'AHRS' }, { t: 'lbl', x: 245, y: 46, text: '1   |   2' },
    { t: 'lpb', id: 'ahrs1Cut', x: 60, y: 62, title: 'ON/OFF', legend: 'CUT' },
    { t: 'lpb', id: 'ahrs1Comp', x: 135, y: 62, title: 'COMP', legend: 'COMP' },
    { t: 'lpb', id: 'ahrs2Cut', x: 355, y: 62, title: 'ON/OFF', legend: 'CUT' },
    { t: 'lpb', id: 'ahrs2Comp', x: 430, y: 62, title: 'COMP', legend: 'COMP' },
    { t: 'lpb', id: 'ahrs1Dg', x: 60, y: 128, title: 'TG/MG', legend: 'DG' },
    { t: 'dim', id: 'ahrs1Hiq', x: 135, y: 128, small: true, def: 5 }, { t: 'lbl', x: 135, y: 166, text: 'HIQ', small: true },
    { t: 'lpb', id: 'ahrsTrue', x: 245, y: 128, title: 'TRIM/TRUE', legend: 'TRUE' },
    { t: 'dim', id: 'ahrs2Hiq', x: 355, y: 128, small: true, def: 5 }, { t: 'lbl', x: 355, y: 166, text: 'HIQ', small: true },
    { t: 'lpb', id: 'ahrs2Dg', x: 430, y: 128, title: 'TG/MG', legend: 'DG' },
    // FCP — 1 · N(정 · 부조종사 FCP 둘 다) · 2(그 쪽 FCP 만)
    { t: 'rot', id: 'fcpSel', x: 70, y: 224, small: true, title: 'FCP', pos: ['1', 'N', '2'], ang: [-55, 0, 55], def: 'N' },
    { t: 'rot', id: 'ahrsSel', x: 190, y: 224, small: true, title: 'AHRS', pos: ['1', 'N', '2', 'BACKUP'], ang: [-60, 0, 60, 135], def: 'N' },
    { t: 'rot', id: 'adcSel', x: 310, y: 224, small: true, title: 'ADC', pos: ['1', 'N', '2', 'BACKUP'], ang: [-60, 0, 60, 135], def: 'N' },
    { t: 'dim', id: 'ahrsDim', x: 420, y: 224, small: true, title: 'DIM', lo: 'OFF', hi: 'BRT', def: 7 },
  ]},
  // ⑯ 자동비행 조종 보조장치(AFCAU)
  { x: 10, y: 280, w: 490, h: 190, items: [
    { t: 'br', x: 18, y: 20, w: 274, text: 'AUTO TRIM' }, { t: 'br', x: 304, y: 20, w: 170, text: 'TRIM FEEL' },
    { t: 'lpb', id: 'atYaw', x: 60, y: 80, w: 64, h: 40, title: 'YAW', legend: 'OFF' },
    { t: 'lpb', id: 'atRoll', x: 150, y: 80, w: 64, h: 40, title: 'ROLL', legend: 'OFF' },
    { t: 'lpb', id: 'atPitch', x: 240, y: 80, w: 64, h: 40, title: 'PITCH', legend: 'OFF' },
    { t: 'lpb', id: 'tfCol', x: 345, y: 80, w: 64, h: 40, title: 'COL', legend: 'REL' },
    { t: 'lpb', id: 'tfCyc', x: 432, y: 80, w: 64, h: 40, title: 'CYC', legend: 'REL' },
    { t: 'lpb', id: 'ap1', x: 60, y: 156, w: 64, h: 40, title: 'AP1', legend: 'OFF' },
    { t: 'lpb', id: 'ap2', x: 150, y: 156, w: 64, h: 40, title: 'AP2', legend: 'OFF' },
    { t: 'lpb', id: 'rotAp1', x: 240, y: 156, w: 64, h: 40, title: 'RST AP1', legend: 'RST' },
    { t: 'lpb', id: 'rotAp2', x: 345, y: 156, w: 64, h: 40, title: 'RST AP2', legend: 'RST' },
    { t: 'lpb', id: 'bFltTst', x: 432, y: 156, w: 64, h: 40, title: 'P FLT TST', legend: 'TEST' },
  ]},
  // ⑮ 비디오 컨버터 제어패널
  { x: 10, y: 480, w: 490, h: 140, items: [
    { t: 'key', id: 'vcMap', x: 60, y: 45, label: 'MAP' }, { t: 'key', id: 'vcEsc', x: 132, y: 45, label: 'ESC' },
    { t: 'key', id: 'vcCom', x: 60, y: 100, label: 'COM' }, { t: 'key', id: 'vcTfc', x: 132, y: 100, label: 'TFC' },
    { t: 'dim', id: 'vcKnob', x: 245, y: 72, def: 5 },
    { t: 'key', id: 'vcClr', x: 358, y: 45, label: 'CLR' }, { t: 'key', id: 'vcFnc', x: 430, y: 45, label: 'FNC' },
    { t: 'key', id: 'vcWxr', x: 358, y: 100, label: 'WXR' }, { t: 'key', id: 'vcTws', x: 430, y: 100, label: 'TWS' },
  ]},
  // ⑭ 비상부주(EMERG FLOATS) 제어패널
  { x: 10, y: 630, w: 490, h: 200, items: [
    { t: 'tg', id: 'fltArmSw', x: 62, y: 92, title: 'EMERG\nFLOATS', pos: ['ARMED', 'OFF'], def: 'OFF' },
    { t: 'br', x: 130, y: 26, w: 110, text: 'LH' }, { t: 'br', x: 262, y: 26, w: 110, text: 'RH' }, { t: 'lbl', x: 251, y: 28, text: 'BTL', small: true },
    { t: 'lamp', x: 160, y: 62, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 212, y: 62, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lamp', x: 292, y: 62, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 344, y: 62, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lamp', x: 160, y: 106, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 212, y: 106, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lamp', x: 292, y: 106, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 344, y: 106, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lbl', x: 252, y: 62, text: 'FWD', small: true }, { t: 'lbl', x: 252, y: 106, text: 'AFT', small: true },
    { t: 'lpb', id: 'floatArm', x: 186, y: 162, w: 60, h: 40, legend: 'FLOAT\nARM' },
    { t: 'key', id: 'fltTest', x: 300, y: 162, w: 60, h: 40, label: 'TEST' },
    { t: 'guard', id: 'floatDeploy', x: 432, y: 120, title: 'FLOAT', pos: ['NORM', 'DEPLOY'], def: 'NORM' },
  ]},
  // ⑬ 호이스트 제어패널
  { x: 10, y: 840, w: 490, h: 190, items: [
    { t: 'guard', id: 'cableCut', x: 110, y: 120, title: 'CABLE CUT', hazard: true, pos: ['NORM', 'CUT'], def: 'NORM' },
    { t: 'tg', id: 'hoistOvr', x: 265, y: 120, title: 'PILOT\nOVERRIDE', pos: ['UP', 'OFF', 'DOWN'], def: 'OFF' },
    { t: 'tg', id: 'hoistEnable', x: 395, y: 120, title: 'HOIST\nENABLE', pos: ['ON', 'OFF'], def: 'OFF' },
  ]},
  // ⑫ CPI CONTROLLER 패널
  { x: 10, y: 1040, w: 490, h: 110, items: [
    { t: 'guard', id: 'cpiTransmit', x: 58, y: 66, title: 'TRANSMIT', hazard: true, pos: ['NORM', 'XMIT'], def: 'NORM' },
    { t: 'key', id: 'cpiTxTest', x: 160, y: 58, w: 58, label: 'TX/TEST' },
    { t: 'lpb', id: 'cpiReset', x: 245, y: 58, w: 62, h: 38, legend: 'TEST/\nRESET' },
    { t: 'key', id: 'cpiBeacon', x: 330, y: 58, w: 58, label: 'BEACON\nARM' },
    { t: 'guard', id: 'cpiArmed', x: 432, y: 66, title: 'ARMED', hazard: true, pos: ['NORM', 'ARM'], def: 'NORM' },
    { t: 'lbl', x: 245, y: 96, text: 'CPI CONTROLLER', small: true },
  ]},
  { x: 10, y: 1160, w: 490, h: 80, items: [] },
  { x: 10, y: 1250, w: 490, h: 70, items: [] },
  // ⑪ 대지방송장비(PA)
  { x: 10, y: 1330, w: 490, h: 60, items: [
    { t: 'dim', id: 'paVol', x: 45, y: 30, small: true, def: 5 },
    { t: 'key', id: 'pa1', x: 120, y: 30, w: 46, h: 28 }, { t: 'key', id: 'pa2', x: 175, y: 30, w: 46, h: 28 }, { t: 'key', id: 'pa3', x: 230, y: 30, w: 46, h: 28 },
    { t: 'key', id: 'pa4', x: 305, y: 30, w: 46, h: 28 }, { t: 'key', id: 'pa5', x: 360, y: 30, w: 46, h: 28 },
    { t: 'dim', id: 'paVol2', x: 445, y: 30, small: true, def: 5 },
  ]},
  // ── 오른쪽 열 ──
  // ⑥ FUEL 패널
  { x: 510, y: 10, w: 480, h: 280, items: [
    { t: 'lbl', x: 24, y: 70, text: 'F', small: true }, { t: 'lbl', x: 24, y: 86, text: 'U', small: true }, { t: 'lbl', x: 24, y: 102, text: 'E', small: true }, { t: 'lbl', x: 24, y: 118, text: 'L', small: true },
    { t: 'rot', id: 'xFeed', x: 240, y: 62, small: true, title: 'X-FEED', pos: ['ENG1', 'OFF', 'ENG2'], ang: [-70, 0, 70], def: 'OFF' },
    { t: 'tg', id: 'bp1', x: 85, y: 128, title: 'FT1', pos: ['BP1', 'OFF'], def: 'BP1' },
    { t: 'rot', id: 'xferSel', x: 240, y: 150, small: true, title: 'XFER', pos: ['OFF', 'LH', 'AUTO', 'RH'], ang: [-115, -65, 0, 70], def: 'AUTO' },
    { t: 'tg', id: 'bp2', x: 395, y: 128, title: 'FT2', pos: ['BP2', 'OFF'], def: 'BP2' },
    { t: 'tg', id: 'aux1Xfer', x: 85, y: 238, title: 'AUX1 XFER', pos: ['ON', 'AUTO', 'OFF'], side: true, def: 'AUTO' },
    { t: 'tg', id: 'f5Xfer', x: 240, y: 238, title: 'F5 XFER', pos: ['ON', 'AUTO', 'OFF'], side: true, def: 'AUTO' },
    { t: 'tg', id: 'aux2Xfer', x: 395, y: 238, title: 'AUX2 XFER', pos: ['ON', 'AUTO', 'OFF'], side: true, def: 'AUTO' },
  ]},
  // ⑦ 무전기 제어기 — Wulfsberg C-5000 CMC(무전기 두 대 · 2×20 LCD · 소프트키 · VOL/SEL 노브 · 12키). 안은 21-c5000.js 가 꾸민다
  { x: 510, y: 300, w: 480, h: 250, items: [
    { t: 'html', hid: 'c5k', x: 0, y: 0, w: 480, h: 250 },
  ]},
  // ⑧ VHF-FM 무전기 — NAT NPX138 FM TRANSCEIVER(2줄 LCD · DISP/CHAN/BRIGHT/EDIT/SQ · MN/GD 노브 · SCAN/GD 스위치). 안은 22-npx138.js 가 꾸민다
  { x: 510, y: 560, w: 480, h: 120, items: [
    { t: 'html', hid: 'npx', x: 0, y: 0, w: 480, h: 120 },
  ]},
  // ⑨ AVCS 패널
  { x: 510, y: 690, w: 480, h: 120, items: [
    { t: 'lbl', x: 40, y: 62, text: 'AVCS' },
    { t: 'lpb', id: 'avcsStatus', x: 170, y: 72, w: 60, h: 46, title: 'STATUS', legend: '' },
    { t: 'lpb', id: 'avcsPower', x: 330, y: 72, w: 60, h: 46, title: 'POWER', legend: 'ON', grn: true },   // AVCS — 진동 저감(15-heli3d.js ckVib)
  ]},
  // ⑩ MPP 패널
  { x: 510, y: 820, w: 480, h: 290, items: [
    { t: 'lbl', x: 30, y: 140, text: 'MPP' },
    ...['RADAR', 'EGPWS', 'DMM', 'SPARE', 'SPARE'].map((n, i) =>
      ({ t: 'lpb', id: `mpp${i}`, x: 100 + i * 78, y: 70, w: 64, h: 46, title: n, legend: n === 'SPARE' ? '' : 'ON', grn: true })),   // ON 은 녹색(무전기 글씨와 같은 빛)
    { t: 'lpb', id: 'mpp5', x: 100, y: 150, w: 64, h: 46, title: 'SPARE', legend: '' },
    { t: 'lpb', id: 'mpp6', x: 178, y: 150, w: 64, h: 46, title: 'SPARE', legend: '' },
    { t: 'mom', id: 'xpdrIdent', x: 92, y: 248, title: 'ATC XPDR\nIDENT', pos: ['NORM', 'IDENT'], def: 'NORM', topLbl: '' },
    { t: 'lpb', id: 'com2', x: 205, y: 248, w: 64, h: 46, title: 'COM2', legend: '' },   // 누르면 CDU COM2 주 · 예비가 121.500(GUARD)
    { t: 'br', x: 278, y: 196, w: 180, text: 'RADAR' },
    { t: 'lpb', id: 'radarScnr', x: 322, y: 248, w: 64, h: 46, title: 'SCNR', legend: '' },
    { t: 'lpb', id: 'radarTx', x: 412, y: 248, w: 64, h: 46, title: 'TX', legend: '' },
  ]},
  // NOSE WHEEL LOCK · PARKING BRAKE
  { x: 510, y: 1120, w: 480, h: 270, items: [
    { t: 'lbl', x: 120, y: 30, text: 'NOSE WHEEL LOCK' },
    { t: 'lv', id: 'noseLock', x: 120, y: 92, ys: [0, 120], pos: ['UNLOCK', 'LOCK'], def: 'LOCK' },
    { t: 'lbl', x: 200, y: 92, text: 'UNLOCK', small: true }, { t: 'lbl', x: 200, y: 212, text: 'LOCK', small: true },
    { t: 'lbl', x: 360, y: 30, text: 'PARKING BRAKE' },
    // RELEASE · EMER(비상 — 스페이스 휠 브레이크와 SET 사이의 세기) · SET(파킹)
    { t: 'lv', id: 'parkBrake', x: 360, y: 92, ys: [0, 60, 120], pos: ['RELEASE', 'EMER', 'SET'], def: 'RELEASE' },
    { t: 'lbl', x: 280, y: 92, text: 'RELEASE', small: true }, { t: 'lbl', x: 280, y: 152, text: 'EMER', small: true },
    { t: 'lbl', x: 280, y: 212, text: 'SET', small: true },
  ]},
];

consoleRegister('lcon', { wrap: 'lcon-wrap', plates: LCON_PLATES, W: LCON_W, H: LCON_H });
// MPP COM2 — 누르면(IN) CDU 의 COM2 주 · 예비 채널을 둘 다 121.500 으로 맞춰 GUARD 교신을 바로 할 수 있게 한다(09-cdu.js cduCom2Guard)
window.addEventListener('ovhd', e => {
  try { if (e.detail && e.detail.id === 'com2' && e.detail.value === 'IN' && typeof cduCom2Guard === 'function') cduCom2Guard(); } catch (er) { _swallow(er); }
});
// AVCS(능동 진동 저감) — POWER 를 누르면 녹색 ON · DC 전원이 있으면 작동해 기체 진동을 감지하고 맞진동으로 줄인다(15-heli3d.js ckVib)
function avcsOn() {
  try { return typeof ovhdGet === 'function' && ovhdGet('avcsPower') === 'IN' && (typeof pwrDc !== 'function' || pwrDc()); } catch (e) { return false; }
}
function lconShow() { consoleBuild('lcon'); consoleFit('lcon'); if (typeof c5Build === 'function') c5Build(); if (typeof npxBuild === 'function') npxBuild(); }   // C-5000(21-c5000.js) · NPX138(22-npx138.js)
try {
  const w = document.getElementById('lcon-wrap');
  if (w && !w.classList.contains('page-hidden')) lconShow();
} catch (e) { _swallow(e); }

// ── 시뮬레이터 연동 ──
// PARKING BRAKE 레버 → SIM 브레이크(14-simmode.js) — SET 은 파킹(simParkBrake · 스페이스 두 번으로도), EMER 는 비상(simEmerBrake)
function lconSyncPark() {
  try {
    const v = ovhdGet('parkBrake');
    if (typeof simParkBrake !== 'undefined') simParkBrake = v === 'SET';
    if (typeof simEmerBrake !== 'undefined') simEmerBrake = v === 'EMER';
  } catch (e) { _swallow(e); }
}
ovhdOn((id, v) => {
  if (id === 'parkBrake') lconSyncPark();
  // AFCAU P FLT TST — 누르면 AFCS 시험(18-system.js afcsTestStart). 시험이 끝나면 버튼이 다시 나온다
  if (id === 'bFltTst' && v === 'IN' && !_lconQuiet) { try { afcsTestStart(); } catch (e) { _swallow(e); } }
  // FUEL 패널 · AFCAU AP1/AP2 → SYSTEM 창(Fuel · Aircraft Status · AFCS) 다시 그리기
  try { if (typeof sysDraw === 'function') sysDraw(); } catch (e) { _swallow(e); }
  // PFD 메시지 시현창(03-pfd.js pfdMsgs — PITOT · PARKING BRAKE · ENG A/I · NLG LOCK · EMER FLOATS)도 곧바로
  try { if (typeof drawPFD === 'function') drawPFD(); } catch (e) { _swallow(e); }
});
lconSyncPark();

// ── 전원 — 상부 콘솔 전기 계통(18-system.js pwrDc)이 DC 버스를 못 살리면 하부 콘솔이 죽는다 ──
// 버튼 글씨 · 표시등이 꺼지고(.lcon-nopwr) 무전기(C-5000 · NPX138) 화면도 꺼진다. 전원이 바뀔 때만 다시 그린다.
let _lconPwr = null;
function lconPowerSync() {
  let on = true;
  try { if (typeof pwrDc === 'function') on = pwrDc(); } catch (e) { _swallow(e); }
  if (on === _lconPwr) return;
  _lconPwr = on;
  const w = document.getElementById('lcon-wrap');
  if (w) w.classList.toggle('lcon-nopwr', !on);
  try { if (typeof c5Render === 'function') c5Render(); } catch (e) { _swallow(e); }
  try { if (typeof npxRender === 'function') npxRender(); } catch (e) { _swallow(e); }
  try { if (typeof drawPFD === 'function') drawPFD(); } catch (e) { _swallow(e); }
}
setInterval(lconPowerSync, 300);

// ── AHRS 패널 → PFD 방향 기준(MG Slaved / DG) ──
// AHRS 노브(1 · N · 2 · BACKUP)가 PFD 에 쓰는 AHRS 를 고른다 — 2 면 AHRS 2, 그 밖(1 · N · BACKUP)은 AHRS 1.
// 고른 AHRS 의 TG/MG DG 버튼이 들어가 있으면 DG, 나와 있으면 MG(Slaved).
// DG 일 때 고른 AHRS 의 HIQ 노브를 돌리면 HSI 를 그만큼(한 칸 1°) 맞춘다(노브는 다시 가운데로).
function lconAhrsActive() { return ovhdGet('ahrsSel') === '2' ? 2 : 1; }
let _lconQuiet = false;
function lconSyncHdgRef() {
  const want = ovhdGet(`ahrs${lconAhrsActive()}Dg`) === 'IN' ? 'DG' : 'MG';
  if (typeof hdgRef === 'undefined' || hdgRef === want) return;
  hdgRef = want;
  if (want === 'MG') dgErr = 0;
  try { updateHdgRefBtns(); } catch (e) { _swallow(e); }
}
// 3D 창 MG/DG 버튼으로 바꾸면 패널 버튼도 맞춘다
function lconAhrsDgFromRef() {
  const id = `ahrs${lconAhrsActive()}Dg`, v = hdgRef === 'DG' ? 'IN' : 'OUT';
  if (ovhdGet(id) !== v) { _lconQuiet = true; try { ovhdSet(id, v); } finally { _lconQuiet = false; } }
}
ovhdOn((id, v, prev) => {
  if (_lconQuiet) return;
  if (id === 'ahrsSel' || id === 'ahrs1Dg' || id === 'ahrs2Dg') lconSyncHdgRef();
  const m = /^ahrs([12])Hiq$/.exec(id);
  if (m && Number(m[1]) === lconAhrsActive() && v !== 5) {
    try { if (typeof dgAdjust === 'function') dgAdjust(v - prev); } catch (e) { _swallow(e); }
    _lconQuiet = true;                                   // 노브는 다시 가운데(5)로 — 끝에 걸리지 않게
    try { ovhdState[id] = 5; _ovhdPaint(id); _ovhdSave(); } finally { _lconQuiet = false; }
  }
});
lconSyncHdgRef();

// SIM Mode 창 배치판 버튼(07-sim.js · 00-popout.js) — appRegister 가 정의된 뒤(09-cdu.js)라 여기서 등록한다
try { appRegister({ popoutScreen: k => window.popoutScreen && window.popoutScreen(k), simLayoutShow, simLayoutHide, simLayoutAllBack,
                    simpleSet, simpleExit, cockpitStart, cockpitExit, cockpitToggle, simpleCockpit, simLayoutCockpit, pfdOvSize, fcpsBaroStd, pfdSkNavCycle, pfdSkPress }); } catch (e) { _swallow(e); }
