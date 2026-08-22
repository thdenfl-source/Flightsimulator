// ─────────────────────────────────────────────────────────────
// 12-joystick.js — 조종 장치(조이스틱 · 게임패드) 연동
//
// 브라우저 Gamepad API 로 물리 버튼을 시뮬레이터 동작에 잇는다.
// 조이스틱마다 버튼 번호가 제각각이라 '기본 배치' 를 고집하지 않는다 —
// 설정 화면에서 동작을 고르고 원하는 버튼을 누르면 그 자리에서 잡힌다.
// (표준 배치[mapping='standard'] 로 올라오는 패드에 한해 첫 연결 때만
//  흔한 배치를 미리 넣어 준다. 사용자가 한 번이라도 바꾸면 그 값을 쓴다.)
//
// 햇(HAT) 스위치는 기종에 따라 버튼으로도, 축으로도 올라온다. 그래서
// 축도 ±방향을 따로 다뤄 버튼과 똑같이 배정할 수 있게 했다.
// 축 중립값은 기종마다 0 이 아닐 수 있어(정지 상태 -1 인 햇 등) 연결
// 시점의 값을 중립으로 잡고 거기서 벗어난 양으로 판정한다.
// ─────────────────────────────────────────────────────────────

// 눌림 판정 문턱 — 아날로그 트리거(버튼 value)와 축에 같이 쓴다
const JOY_ON = 0.6, JOY_OFF = 0.35;   // 히스테리시스(떨림 방지)
const JOY_REPEAT_DELAY = 350, JOY_REPEAT_INT = 80;   // 화면 버튼 홀드와 같은 값

// kind — press: 누를 때 한 번 · hold: 누르는 동안 · repeat: 누른 뒤 연속
const JOY_ACTIONS = [
  { id: 'sim',    grp: '운항',   label: 'FLY / PAUSE',   kind: 'press',
    run: () => toggleSim() },
  { id: 'ftr',    grp: '운항',   label: 'FORCE TRIM',    kind: 'press',
    run: () => forceTrim() },
  { id: 'gspd',   grp: '운항',   label: 'GSPD (호버)',    kind: 'press',
    run: () => toggleGspd() },
  { id: 'hovpos', grp: '운항',   label: 'HOVER POSITION', kind: 'press',
    run: () => toggleHoverPosition() },

  { id: 'trimF',  grp: '트림',   label: '트림 ▲ (전/증속)', kind: 'hold',
    on: () => startTrimHold('F'), off: () => stopTrimHold() },
  { id: 'trimA',  grp: '트림',   label: '트림 ▼ (후/감속)', kind: 'hold',
    on: () => startTrimHold('A'), off: () => stopTrimHold() },
  { id: 'trimL',  grp: '트림',   label: '트림 ◀ (좌)',     kind: 'hold',
    on: () => startTrimHold('L'), off: () => stopTrimHold() },
  { id: 'trimR',  grp: '트림',   label: '트림 ▶ (우)',     kind: 'hold',
    on: () => startTrimHold('R'), off: () => stopTrimHold() },
  { id: 'pedL',   grp: '트림',   label: '페달 ◀ (좌)',     kind: 'repeat',
    run: () => applyDelta('yaw', -1) },
  { id: 'pedR',   grp: '트림',   label: '페달 ▶ (우)',     kind: 'repeat',
    run: () => applyDelta('yaw', 1) },

  { id: 'hdgDn',  grp: 'FCP',    label: 'HDG −',  kind: 'repeat', run: () => applyDelta('hdg', -1) },
  { id: 'hdgUp',  grp: 'FCP',    label: 'HDG +',  kind: 'repeat', run: () => applyDelta('hdg', 1) },
  { id: 'spdDn',  grp: 'FCP',    label: 'IAS −',  kind: 'repeat', run: () => applyDelta('spd', -1) },
  { id: 'spdUp',  grp: 'FCP',    label: 'IAS +',  kind: 'repeat', run: () => applyDelta('spd', 1) },
  { id: 'altDn',  grp: 'FCP',    label: 'ALT −',  kind: 'repeat', run: () => applyDelta('alt', -100) },
  { id: 'altUp',  grp: 'FCP',    label: 'ALT +',  kind: 'repeat', run: () => applyDelta('alt', 100) },
  { id: 'crhtDn', grp: 'FCP',    label: 'CRHT −', kind: 'repeat', run: () => applyDelta('crht', -10) },
  { id: 'crhtUp', grp: 'FCP',    label: 'CRHT +', kind: 'repeat', run: () => applyDelta('crht', 10) },
  { id: 'vsDn',   grp: 'FCP',    label: 'VS −',   kind: 'repeat', run: () => applyDelta('vs', -100) },
  { id: 'vsUp',   grp: 'FCP',    label: 'VS +',   kind: 'repeat', run: () => applyDelta('vs', 100) },
  { id: 'crsDn',  grp: 'FCP',    label: 'CRS −',  kind: 'repeat', run: () => applyDelta('crs', -1) },
  { id: 'crsUp',  grp: 'FCP',    label: 'CRS +',  kind: 'repeat', run: () => applyDelta('crs', 1) },

  { id: 'altHold', grp: 'AFCS',  label: 'ALT 유지',  kind: 'press', run: () => toggleAltHold() },
  { id: 'crht',    grp: 'AFCS',  label: 'CRHT 유지', kind: 'press', run: () => toggleCrht() },
  { id: 'navap',   grp: 'AFCS',  label: 'NAV (AP)',  kind: 'press', run: () => toggleNavAp() },
  { id: 'gs',      grp: 'AFCS',  label: 'G/S',       kind: 'press', run: () => toggleGs() },
  { id: 'susp',    grp: 'AFCS',  label: 'SUSP',      kind: 'press', run: () => toggleSusp() },
  { id: 'obs',     grp: 'AFCS',  label: 'OBS',       kind: 'press', run: () => toggleObs() },

  { id: 'follow',  grp: '지도',  label: '지도 추종',   kind: 'press', run: () => toggleFollow() },
  { id: 'orient',  grp: '지도',  label: 'HDG↑ / N↑',  kind: 'press', run: () => toggleMapOrient() },
  { id: 'zoomIn',  grp: '지도',  label: '확대',       kind: 'repeat', run: () => joyZoom(1) },
  { id: 'zoomOut', grp: '지도',  label: '축소',       kind: 'repeat', run: () => joyZoom(-1) },
];
const JOY_ACT_BY_ID = {};
JOY_ACTIONS.forEach(a => { JOY_ACT_BY_ID[a.id] = a; });

function joyZoom(d) {
  try { if (typeof leafMap !== 'undefined' && leafMap) leafMap.setZoom(leafMap.getZoom() + d); }
  catch (e) { _swallow(e); }
}

// 표준 배치 패드용 첫 배정(사용자가 바꾸면 저장값이 이긴다)
const JOY_STD_BINDS = {
  b0: 'ftr',  b1: 'gspd', b2: 'altHold', b3: 'navap',
  b4: 'crsDn', b5: 'crsUp', b6: 'spdDn', b7: 'spdUp',
  b9: 'sim',
  b12: 'trimF', b13: 'trimA', b14: 'trimL', b15: 'trimR',
};

let joyOn = true;
try { joyOn = localStorage.getItem('joyOn') !== '0'; } catch (e) { _swallow(e); }
let joyBinds = {};
try { joyBinds = JSON.parse(localStorage.getItem('joyBinds') || 'null') || {}; } catch (e) { joyBinds = {}; }
let joyBindsSaved = false;
try { joyBindsSaved = localStorage.getItem('joyBinds') !== null; } catch (e) { _swallow(e); }

let joyPadName = '';          // 연결된 장치 이름(설정 화면 표시용)
let joyLastCode = '';         // 마지막으로 눌린 입력(설정 화면 표시용)
let joyCapture = null;        // 배정 대기 중인 동작 id
const _joyDown = {};          // code → { since, next }
const _joyNeutral = {};       // padIndex → 축 중립값 배열
let _joyRaf = null;

function joySave() {
  try { localStorage.setItem('joyBinds', JSON.stringify(joyBinds)); joyBindsSaved = true; }
  catch (e) { _swallow(e); }
}
function joyBindOf(actId) {
  for (const c in joyBinds) if (joyBinds[c] === actId) return c;
  return '';
}
function joyCodeLabel(code) {
  if (!code) return '';
  if (code[0] === 'b') return `버튼 ${code.slice(1)}`;
  return `축 ${code.slice(1, -1)} ${code.slice(-1)}`;
}
// 한 동작에는 입력 하나 — 같은 입력이 두 동작을 겸하지 않게 정리한다
function joySetBind(code, actId) {
  const old = joyBindOf(actId);
  if (old) delete joyBinds[old];
  if (code) joyBinds[code] = actId;
  joySave();
}
function joyClearBind(actId) {
  const c = joyBindOf(actId);
  if (c) { delete joyBinds[c]; joySave(); }
}
function joyBeginCapture(actId) { joyCapture = actId; joyLastCode = ''; }
function joyCancelCapture() { joyCapture = null; }
function toggleJoy() {
  joyOn = !joyOn;
  try { localStorage.setItem('joyOn', joyOn ? '1' : '0'); } catch (e) { _swallow(e); }
  if (!joyOn) joyReleaseAll();
}

// 연결이 끊기거나 기능을 끌 때 — 누르고 있던 동작을 반드시 놓는다
function joyReleaseAll() {
  Object.keys(_joyDown).forEach(code => {
    const a = JOY_ACT_BY_ID[joyBinds[code]];
    if (a && a.kind === 'hold' && a.off) { try { a.off(); } catch (e) { _swallow(e); } }
    delete _joyDown[code];
  });
}

function joyPads() {
  try {
    const g = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.prototype.slice.call(g || []).filter(Boolean);
  } catch (e) { return []; }
}

// 한 입력의 눌림/뗌을 처리한다. 배정 대기 중이면 동작 대신 배정으로 간다.
function _joyEdge(code, pressed, now) {
  const wasDown = !!_joyDown[code];
  if (pressed && !wasDown) {
    joyLastCode = code;
    if (joyCapture) { joySetBind(code, joyCapture); joyCapture = null; _joyDown[code] = { since: now, next: Infinity }; return; }
    const a = JOY_ACT_BY_ID[joyBinds[code]];
    _joyDown[code] = { since: now, next: now + JOY_REPEAT_DELAY };
    if (!a) return;
    try {
      if (a.kind === 'hold') a.on();
      else a.run();
    } catch (e) { _swallow(e); }
  } else if (!pressed && wasDown) {
    delete _joyDown[code];
    const a = JOY_ACT_BY_ID[joyBinds[code]];
    if (a && a.kind === 'hold' && a.off) { try { a.off(); } catch (e) { _swallow(e); } }
  } else if (pressed && wasDown) {
    const a = JOY_ACT_BY_ID[joyBinds[code]];
    if (!a || a.kind !== 'repeat') return;
    const st = _joyDown[code];
    if (now >= st.next) { st.next = now + JOY_REPEAT_INT; try { a.run(); } catch (e) { _swallow(e); } }
  }
}

// 한 프레임분 폴링. 테스트에서 직접 부를 수 있게 시각을 인자로 받는다.
function joyPoll(now) {
  const pads = joyPads();
  if (!pads.length) { joyPadName = ''; joyReleaseAll(); return; }
  joyPadName = pads[0].id || '조종 장치';
  if (!joyOn) return;
  const p = pads[0];
  // 첫 연결이면 축 중립을 잡는다(햇이 -1 에서 쉬는 기종 대응)
  if (!_joyNeutral[p.index]) _joyNeutral[p.index] = Array.prototype.slice.call(p.axes || []);
  const neu = _joyNeutral[p.index];

  (p.buttons || []).forEach((b, i) => {
    const v = (typeof b === 'object') ? (b.value != null ? b.value : (b.pressed ? 1 : 0)) : b;
    const code = 'b' + i;
    const on = _joyDown[code] ? (v > JOY_OFF) : (v >= JOY_ON);
    _joyEdge(code, on, now);
  });
  (p.axes || []).forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const d = v - (Number.isFinite(neu[i]) ? neu[i] : 0);
    ['+', '-'].forEach(sgn => {
      const code = 'a' + i + sgn;
      const m = sgn === '+' ? d : -d;
      const on = _joyDown[code] ? (m > JOY_OFF) : (m >= JOY_ON);
      _joyEdge(code, on, now);
    });
  });
}

function _joyLoop() {
  try { joyPoll(performance.now()); } catch (e) { _swallow(e); }
  _joyRaf = requestAnimationFrame(_joyLoop);
}
function joyStart() { if (_joyRaf == null) _joyLoop(); }
function joyStop() { if (_joyRaf != null) { cancelAnimationFrame(_joyRaf); _joyRaf = null; } joyReleaseAll(); }

window.addEventListener('gamepadconnected', e => {
  try {
    const p = e.gamepad;
    delete _joyNeutral[p.index];
    // 표준 배치 패드이고 사용자가 아직 손대지 않았으면 흔한 배치를 넣어 준다
    if (!joyBindsSaved && p.mapping === 'standard') { joyBinds = Object.assign({}, JOY_STD_BINDS); joySave(); }
  } catch (err) { _swallow(err); }
  joyStart();
});
window.addEventListener('gamepaddisconnected', () => { joyReleaseAll(); });
// 이미 붙어 있는 장치도 있으므로(연결 이벤트는 첫 입력 뒤에 오는 브라우저가 있다)
// 처음부터 폴링을 돌린다 — 장치가 없으면 아무 일도 하지 않는다.
joyStart();
window.addEventListener('blur', joyReleaseAll);
