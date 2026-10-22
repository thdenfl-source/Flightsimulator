// ─────────────────────────────────────────────────────────────
// 14-simmode.js — SIM 모드(조종간 직접 조종)
//
// 평소 이 시뮬레이터는 AFCS 목표값(선택 헤딩·고도·속도)으로 난다. SIM 모드는
// 그 위에 '손으로 모는' 길을 하나 더 얹는다 — 조이스틱 축을 그대로 받아
// 자세와 속도를 만들고, 그 결과가 PFD(자세·속도·고도)와 지도(위치·항적)에
// 같이 나타난다. 두 화면이 따로 노는 일이 없도록 상태(S)만 고치고,
// 그리기는 종전 경로를 그대로 쓴다.
//
// 조종 법칙은 '그럴듯하게 날리는' 수준으로 단순하게 둔다(공력 모델이 아니다).
//   · 사이클릭 좌우 → 뱅크, 뱅크가 선회를 만든다(조화선회는 기존 코드가 한다)
//   · 사이클릭 전후 → 피치, 피치가 가감속을 만든다(기수를 내리면 빨라진다)
//   · 페달         → 기수만 돌린다(저속에서 쓰는 요 조작)
//   · 컬렉티브     → 토크(TQ %). 남는 토크가 상승률이 된다
// SIM 모드에서는 AFCS(NAV·HDG·ALT·CRHT·GSPD)를 잡아 두지 않는다 — 두 곳에서
// 같은 축을 몰면 서로 싸운다.
// ─────────────────────────────────────────────────────────────

const SIM_BANK_MAX  = 45;      // 사이클릭 최대 뱅크(°)
const SIM_ROLL_RATE = 60;      // 뱅크가 따라가는 속도(°/s)
const SIM_PITCH_MAX = 12;      // 사이클릭 최대 피치(°)
const SIM_PITCH_RATE = 30;     // 피치가 따라가는 속도(°/s)
const SIM_YAW_RATE  = 25;      // 페달 최대 요율(°/s)
const SIM_SPD_MAX   = 160;     // 최대 대기속도(kt)
const SIM_ACC       = 0.9;     // 피치 1° 당 가속(kt/s)
const SIM_DRAG      = 0.015;   // 속도에 비례하는 감속(1/s)
const SIM_VS_RATE   = 900;     // 상승률이 따라가는 속도(fpm/s)

// 토크(TQ) 상수와 tqRequired()·tqShown() 는 01-state.js 에 있다 —
// PFD 가 이 파일보다 먼저 그려질 수 있어 TDZ 를 피한다.

// simModeOn 은 01-state.js 에 둔다 — 시뮬 루프(07)가 이 파일보다 먼저 돌 수 있어서다.

function simModeAxes() {
  const ax = r => { try { return joyAxVal(r); } catch (e) { return 0; } };
  return { roll: ax('roll'), pitch: ax('pitch'), yaw: ax('yaw'), coll: ax('coll') };
}

function updateSimModeBtn() {
  const b = document.getElementById('sim-mode-btn');
  if (!b) return;
  b.classList.toggle('on', simModeOn);
}

function toggleSimMode(on) {
  simModeOn = (on === undefined) ? !simModeOn : !!on;
  if (simModeOn) {
    // 손으로 모는 동안에는 AFCS 를 놓는다 — 같은 축을 둘이 몰면 싸운다
    try { if (navApOn) toggleNavAp(); } catch (e) { _swallow(e); }
    try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
    try { if (gsOn) toggleGs(); } catch (e) { _swallow(e); }
    hdgSelOn = false; rollApOn = false; altHoldOn = false; crhtOn = false;
    try { updateHoverBtns(); } catch (e) { _swallow(e); }
    // 손을 떼면 그 자리에서 날던 대로 — 지금 자세를 그대로 이어받는다
    bankTarget = S.bnk;
    // 지금 날고 있는 상태를 유지할 만큼의 토크로 레버를 맞춰 둔다(진입 충격 방지)
    S.tq = Math.max(0, Math.min(TQ_MAX, tqRequired() + (S.vs || 0) / TQ_PER_FPM));
    if (!S.running) toggleSim();        // 멈춰 있으면 바로 날기 시작한다
    simEnterView();
  } else {
    simExitView();
    // 손을 뗀 자리에서 수평으로 돌려 놓는다(기울어진 채 남지 않게)
    bankTarget = 0; S.vs = 0;
    selHdg = ((Math.round(S.hdg) + 359) % 360) + 1;
  }
  updateSimModeBtn();
  try { updateApInhibit(); } catch (e) { _swallow(e); }
}

// ── 바깥 그림도 조종석에서 보는 대로 ──
// SIM 모드에서는 지도 창을 3D 로 바꾸고 항공기를 따라가게 한다. 바꾸기 전
// 상태를 적어 두었다가 모드를 끄면 그대로 되돌린다.
let _simView = null;
function simEnterView() {
  if (_simView) return;
  const sides = tripleMode ? ['left', 'mid', 'right'] : ['left', 'right'];
  const get = k => (k === 'left' ? leftSel : k === 'mid' ? midSel : rightSel);
  const v = { side: null, was: null, follow: followMode, overlay: false };
  if (!sides.some(k => get(k) === 'm3d')) {
    const mapSide = sides.find(k => get(k) === 'map');
    if (mapSide) { v.side = mapSide; v.was = 'map'; }
    else if (typeof _view3dOn !== 'undefined' && !_view3dOn) {
      // 지도 창이 아예 없으면 2D 위에 겹쳐 띄운다
      try { toggle3dMap(); v.overlay = true; } catch (e) { _swallow(e); }
    }
  }
  _simView = v;
  if (v.side) { try { selectPanel(v.side, 'm3d', true); } catch (e) { _swallow(e); } }
  // 조종석 시야이므로 항공기를 따라가야 한다
  try { if (!followMode) toggleFollow(); } catch (e) { _swallow(e); }
}
function simExitView() {
  const v = _simView; _simView = null;
  try { _apply3dRoll(); } catch (e) { _swallow(e); }    // 기울여 둔 화면을 되돌린다
  if (!v) return;
  if (v.side) { try { selectPanel(v.side, v.was, true); } catch (e) { _swallow(e); } }
  if (v.overlay) { try { if (_view3dOn) toggle3dMap(); } catch (e) { _swallow(e); } }
  try { if (followMode !== v.follow) toggleFollow(); } catch (e) { _swallow(e); }
}

// 한 적분 구간(dt초)의 조종 입력 적용. simStep 안에서 불린다.
function simFly(dt) {
  if (!simModeOn || !(dt > 0)) return;
  const a = simModeAxes();

  // ── 사이클릭 좌우 → 뱅크 ──
  const bTgt = a.roll * SIM_BANK_MAX;
  const dB = bTgt - S.bnk;
  S.bnk += Math.sign(dB) * Math.min(Math.abs(dB), SIM_ROLL_RATE * dt);
  bankTarget = S.bnk;             // 모드를 빠져나가도 자세가 튀지 않게

  // ── 사이클릭 전후 → 피치 ──
  // 조종간을 밀면(+) 기수가 내려간다. S.pit 은 기수 올림이 +.
  const pTgt = -a.pitch * SIM_PITCH_MAX;
  const dP = pTgt - S.pit;
  S.pit += Math.sign(dP) * Math.min(Math.abs(dP), SIM_PITCH_RATE * dt);

  // ── 피치 → 가감속 ──
  // 기수를 내리면 빨라지고, 올리면 느려진다. 항력은 속도에 비례해 걸어
  // 중립에서는 저절로 느려진다(헬기의 감속 느낌).
  S.spd = Math.max(0, Math.min(SIM_SPD_MAX,
    S.spd + (-S.pit * SIM_ACC - S.spd * SIM_DRAG) * dt));

  // ── 페달 → 기수 ──
  if (a.yaw) {
    S.hdg = normA(S.hdg + a.yaw * SIM_YAW_RATE * dt);
    selHdg = ((Math.round(S.hdg) + 359) % 360) + 1;
  }

  // ── 컬렉티브 → 토크 ──
  // 레버 자리가 곧 토크다. 토크는 천천히 따라 오른다(엔진·로터 관성).
  // 컬렉티브 축을 배정하지 않았으면 레버가 없는 셈이다 — 지금 고도를 지킬
  // 만큼만 걸어 둔다(조이스틱 없이 켰다고 저절로 떠오르지 않게).
  const hasColl = !!(typeof joyAxes === 'object' && joyAxes && joyAxes.coll);
  const tTgt = hasColl
    ? Math.max(0, Math.min(TQ_MAX, TQ_HOVER + a.coll * TQ_SPAN))
    : tqRequired();
  const dT = tTgt - S.tq;
  S.tq += Math.sign(dT) * Math.min(Math.abs(dT), TQ_RATE * dt);

  // ── 남는 토크 → 상승·강하 ──
  // 필요한 토크보다 남으면 오르고, 모자라면 내려간다. 그래서 같은 레버라도
  // 선회를 걸면 가라앉고(필요 토크 증가), 속도가 붙으면 저절로 떠오른다.
  const vTgt = Math.max(-2000, Math.min(2000, (S.tq - tqRequired()) * TQ_PER_FPM));
  const dV = vTgt - S.vs;
  S.vs += Math.sign(dV) * Math.min(Math.abs(dV), SIM_VS_RATE * dt);
  if (S.alt <= 0 && S.vs < 0) S.vs = 0;      // 땅 아래로는 내려가지 않는다

  // ── 에너지 교환 ──
  // 오르면 그만큼 속도를 내주고, 내려가면 속도를 얻는다(출력이 정해져 있으므로).
  S.spd = Math.max(0, Math.min(SIM_SPD_MAX, S.spd - (S.vs / 1000) * 1.2 * dt));
}

// 화면 버튼(data-act) 연결 — 이 파일이 11-charts.js 보다 나중에 로드되므로
// 거기 목록에 넣으면 아직 정의되지 않은 이름이 된다. 여기서 직접 등록한다.
try { appRegister({ toggleSimMode }); } catch (e) { _swallow(e); }
try { updateSimModeBtn(); } catch (e) { _swallow(e); }
