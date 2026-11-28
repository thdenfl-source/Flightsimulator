// 07a-panels.js — 07-sim.js 에서 나눴다(차례 그대로): 시작(INIT) · 창(패널) 배치 · 탭 · 분할 · 화면 잠금 · 자(RULER) · 단독 화면 · Cockpit/Simple/SIM Mode 창
// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
let currentPage = 0;
let leftPage = 0;
// 354×567 규격의 화면(CDU · Flight Plan)을 패널 크기에 맞춰 축소·중앙정렬
// CDU 화면(354×567 규격)이 패널 안에서 실제로 차지하는 사각형.
// 패널이 넓으면 좌우가, 높으면 위아래가 남는다(레터박스).
// CDU 화면들은 이 사각형 안에 그린다 — 차트 뷰어만 예외로 패널 전체를 쓴다.
function cduFrameRect(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return null;
  void wrap.offsetWidth;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return null;
  const s = Math.min(w / 354, h / 567);
  return { left: (w - 354*s)/2, top: (h - 567*s)/2, w: 354*s, h: 567*s, scale: s };
}
function _scaleFrame(wrapId, scalerId) {
  const scaler = document.getElementById(scalerId);
  const r = cduFrameRect(wrapId);
  if (!scaler || !r) return;
  scaler.style.transform = `translate(${r.left}px,${r.top}px) scale(${r.scale})`;
}
function scaleCdu() {
  _scaleFrame('cdu-wrap', 'cdu-scaler');
  _scaleFrame('fp-wrap',  'fp-scaler');   // Flight Plan도 같은 규격
}

// ── 패널 선택 시스템: 좌/우 각각 PFD·MAP·CDU 중 하나를 표시 ──
// pfd-wrap/map-wrap/cdu-wrap 은 각 1개뿐 → 선택된 패널로 DOM 이동.
// 양쪽에 같은 창은 불가(사용자 클릭은 거부 피드백, 프로그램 호출은 스왑).
let leftSel = 'pfd', rightSel = 'map';   // 'pfd' | 'map' | 'cdu' | (우측 한정 'plan')
let midSel  = 'map';                    // 3분할일 때만 사용하는 중앙 패널
// 처음 켜면 3분할 — 좌 PFD · 중 CDU · 우 MAP 이 기본 구성이다(2분할이면 PFD · MAP).
// 사용자가 2분할을 골라 뒀으면(저장값 '0') 그 뜻을 따른다(배치를 바꾼 뒤로는 새 키로 본다).
let tripleMode = true;                  // 3분할(PFD·CDU·MAP) 여부 — 4분할도 가운데 창을 쓰므로 함께 참
// 4분할 — 위에 PFD · 3D · MAP, 아래에 CDU(아래 창 botSel)
let quadMode = false, botSel = 'cdu';
try {
  const v = localStorage.getItem('tripleMode2');
  if (v !== null) tripleMode = (v === '1');
  const m = localStorage.getItem('splitMode');
  if (m === '4') { quadMode = true; tripleMode = true; }
  else if (m === '3') tripleMode = true;
  else if (m === '2') tripleMode = false;
} catch(e) { _swallow(e); }
if (quadMode) { leftSel = 'pfd'; midSel = 'm3d'; rightSel = 'map'; botSel = 'cdu'; }
else if (tripleMode) { leftSel = 'pfd'; midSel = 'cdu'; rightSel = 'map'; }
// 지금 쓰는 패널들(4분할이면 아래 창까지)
function panelSides() { return quadMode ? ['left', 'mid', 'right', 'bot'] : tripleMode ? ['left', 'mid', 'right'] : ['left', 'right']; }

// 3분할 분할 비율 [좌%, 중%] — null 이면 기본 배분(PFD 호스트 1.4배)
const TRI_MIN = 12;                     // 한 창의 최소 비율(%)
let triRatio = null;
try {
  const s = JSON.parse(localStorage.getItem('triSplit') || 'null');
  if (Array.isArray(s) && s.length === 2 && s.every(v => typeof v === 'number')) triRatio = s;
} catch(e) { _swallow(e); }

// 기본 3분할 배분 — PFD 가 있는 창만 FCP 조작부가 다 보이도록 1.4배
function triDefaultRatio() {
  const w = [leftSel, midSel, rightSel].map(s => s === 'pfd' ? 1.4 : 1);
  const t = w[0] + w[1] + w[2];
  return [w[0] / t * 100, w[1] / t * 100];
}
function applyTriRatio() {
  const app = document.getElementById('app');
  if (!app) return;
  const [l, m] = triRatio || triDefaultRatio();
  app.style.setProperty('--tri-l', l.toFixed(3) + '%');
  app.style.setProperty('--tri-m', m.toFixed(3) + '%');
}
function saveTriRatio() {
  try { localStorage.setItem('triSplit', JSON.stringify(triRatio)); } catch(e) { _swallow(e); }
}

// 3분할 ⇄ 2분할 전환. 3분할 진입 시 PFD·MAP·CDU를 좌·중·우로 배치한다.
function toggleTriple(on) {
  setSplitMode(((on === undefined) ? !tripleMode : !!on) ? 3 : 2);
}
// 2 · 3 · 4 분할. 기본 배치 — 2분할 PFD · MAP / 3분할 PFD · CDU · MAP / 4분할 위 PFD · 3D · MAP · 아래 CDU
function setSplitMode(n) {
  quadMode = n === 4; tripleMode = n >= 3;
  try { localStorage.setItem('splitMode', String(n)); localStorage.setItem('tripleMode2', tripleMode ? '1' : '0'); } catch(e) { _swallow(e); }
  if (quadMode) { leftSel = 'pfd'; midSel = 'm3d'; rightSel = 'map'; botSel = 'cdu'; }
  else if (tripleMode) { leftSel = 'pfd'; midSel = 'cdu'; rightSel = 'map'; }
  else { leftSel = 'pfd'; rightSel = 'map'; }
  applyPanels();
}
// ── 4분할 비율 — [1열 폭 %, 2열 폭 %, 3열 위 창 높이 %] · 경계 그립을 끌어 바꾼다 ──
const QUAD_DEF = [36, 32, 55], QUAD_MIN = 12;
let quadRatio = QUAD_DEF.slice();
try { const q = JSON.parse(localStorage.getItem('quadSplit') || 'null'); if (Array.isArray(q) && q.length === 3 && q.every(Number.isFinite)) quadRatio = q; } catch (e) { _swallow(e); }
function applyQuadRatio() {
  const app = document.getElementById('app'); if (!app) return;
  app.style.setProperty('--q1', quadRatio[0].toFixed(2) + '%');
  app.style.setProperty('--q2', quadRatio[1].toFixed(2) + '%');
  app.style.setProperty('--q3', quadRatio[2].toFixed(2) + '%');
}
(function initQuadGrips() {
  const app = document.getElementById('app');
  if (!app) return;
  const after = () => {
    requestAnimationFrame(() => { try { resizePFD(); drawPFD(); } catch (e) { _swallow(e); } });
    setTimeout(() => {
      try { leafMap.invalidateSize(); } catch (e) { _swallow(e); }
      try { if (_ml3d) _ml3d.resize(); } catch (e) { _swallow(e); }
      try { scaleCdu(); } catch (e) { _swallow(e); }
    }, 60);
  };
  const bind = (id, which) => {
    const el = document.getElementById(id); if (!el) return;
    let drag = false;
    el.addEventListener('pointerdown', e => { if (!quadMode) return; e.preventDefault(); drag = true; try { el.setPointerCapture(e.pointerId); } catch (err) { _swallow(err); } });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = app.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
      let [a, b, c] = quadRatio;
      if (which === 1) { const edge = a + b; a = Math.max(QUAD_MIN, Math.min(edge - QUAD_MIN, px)); b = edge - a; }
      else if (which === 2) { b = Math.max(QUAD_MIN, Math.min(100 - QUAD_MIN - a, px - a)); }
      else { c = Math.max(15, Math.min(85, py)); }
      quadRatio = [a, b, c]; applyQuadRatio();
      try { resizePFD(); } catch (err) { _swallow(err); }
      try { scaleCdu(); } catch (err) { _swallow(err); }   // CDU 도 PFD 처럼 끄는 동안 바로 맞춘다
    });
    const end = () => { if (!drag) return; drag = false; try { localStorage.setItem('quadSplit', JSON.stringify(quadRatio)); } catch (err) { _swallow(err); } after(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => {
      const d = QUAD_DEF;
      if (which === 1) { quadRatio[0] = d[0]; quadRatio[1] = d[1]; } else if (which === 2) quadRatio[1] = d[1]; else quadRatio[2] = d[2];
      applyQuadRatio(); try { localStorage.setItem('quadSplit', JSON.stringify(quadRatio)); } catch (err) { _swallow(err); } after();
    });
  };
  bind('qgrip-1', 1); bind('qgrip-2', 2); bind('qgrip-3', 3);
  applyQuadRatio();
})();
// 분할 버튼 — 2 → 3 → 4 → 2 분할로 돌아간다
function cycleSplit() { setSplitMode(quadMode ? 2 : tripleMode ? 4 : 3); }

// ── 3D 지도의 자리 옮기기 ──
// 3D 지도(#map3d)는 한 벌뿐이다. 평소에는 2D 지도 위에 겹쳐 쓰고(지도 툴바의 3D 버튼),
// 탭에서 '3D' 를 고르면 그 창으로 통째로 옮겨 간다. 그러면 2D 와 3D 를 나란히 볼 수 있다.
function map3dPanelOn() {
  return leftSel === 'm3d' || (tripleMode && midSel === 'm3d') || rightSel === 'm3d' || (quadMode && botSel === 'm3d');
}
// 3D 지도가 지금 화면에 떠 있는가(겹쳐 쓰든, 제 창을 쓰든) — 카메라 추종 판단에 쓴다
function syncMap3dHost(toPanel) {
  const d3 = document.getElementById('map3d');
  const w3 = document.getElementById('map3d-wrap');
  const mw = document.getElementById('map-wrap');
  const tilt = document.getElementById('tilt-ctrl');
  if (!d3 || !w3 || !mw) return;
  if (toPanel) {
    if (d3.parentElement !== w3) w3.appendChild(d3);
    d3.classList.add('panel-3d', 'active');
    mw.classList.remove('map3d-on');          // 2D 는 제 창에서 그대로 보인다
    if (tilt) tilt.classList.add('active');
    try { _init3dMap(); } catch (e) { _swallow(e); }
    requestAnimationFrame(() => {
      try { if (_ml3d) { _ml3d.resize(); _applyFollow(); } } catch (e) { _swallow(e); }
    });
  } else {
    if (d3.parentElement !== mw) mw.insertBefore(d3, mw.firstElementChild.nextSibling);
    d3.classList.remove('panel-3d');
    // 3D 창 안에서 열었던 함정 메뉴·설정창은 2D 지도 창으로 돌려보낸다
    try { if (typeof shipUiHome === 'function') shipUiHome(false); } catch (e) { _swallow(e); }
    // 제 창에서 빠져나오면 겹치기 모드의 상태(3D 버튼)를 그대로 따른다
    d3.classList.toggle('active', _view3dOn);
    mw.classList.toggle('map3d-on', _view3dOn);
    if (tilt) tilt.classList.toggle('active', _view3dOn);
    setTimeout(() => { try { leafMap.invalidateSize(); } catch (e) { _swallow(e); } }, 50);
  }
}

// 같은 창으로 치는 묶음 — PLAN 은 CDU 창의 한 화면이다.
// 2D 지도(map)와 3D 지도(m3d)는 서로 다른 창이라 나란히 둘 수 있다.
function panelFam(sel) { return sel === 'plan' ? 'cdu' : sel; }
function panelGet(k) { return k === 'left' ? leftSel : k === 'mid' ? midSel : k === 'bot' ? botSel : rightSel; }
function panelSet(k, v) { if (k === 'left') leftSel = v; else if (k === 'mid') midSel = v; else if (k === 'bot') botSel = v; else rightSel = v; }
// 두 창이 같은 것을 가리키고 있으면 바로잡는다. 저장된 배치를 되살릴 때처럼
// selectPanel 을 거치지 않는 길도 있어서, 그릴 때 한 번 더 본다.
// (지도는 2D·3D 가 서로 다른 창이라 나란히 둘 수 있다)
function fixPanelDupes() {
  const sides = panelSides();
  // 화면 배치 — 좌측은 PFD 창(탭으로 SYSTEM 창으로도 바꿀 수 있다)이고, 가운데·우측은 CDU·MAP·3D 중에서 고른다(단독 화면 중은 빼고)
  const solo = document.body.classList.contains('solo-mode');
  if (!solo) {
    if (leftSel !== 'sysp') leftSel = 'pfd';
    if (midSel === 'pfd') midSel = 'cdu';
    if (rightSel === 'pfd') rightSel = 'map';
    if (botSel === 'pfd') botSel = 'cdu';
  }
  // Bell 206 — CDU · UPPER 자리는 LOWER(항공전자 스택)로(00-aircraft.js acScrOk)
  if (typeof acScrOk === 'function') sides.forEach(k => { if (!acScrOk(panelGet(k))) panelSet(k, k === 'left' ? 'pfd' : k === 'right' ? 'map' : 'lcon'); });
  const seen = new Set(), seenV = new Set();
  const mirOk = v => typeof MIRROR_OK !== 'undefined' && MIRROR_OK.has(v);   // 같은 화면을 두 창에 — 거울 창(38-mirror.js)
  sides.forEach(k => {
    let v = panelGet(k);
    const ok = x => typeof acScrOk !== 'function' || acScrOk(x);   // 기종에 없는 화면(Bell 206 — CDU · UPPER)은 고르지 않는다
    if ((seen.has(panelFam(v)) && !(seenV.has(v) && mirOk(v))) || !ok(v)) {
      v = (solo ? ['pfd', 'map', 'cdu', 'm3d', 'lcon', 'sysp'] : ['map', 'cdu', 'lcon', 'm3d', 'sysp']).find(x => ok(x) && !seen.has(panelFam(x))) || 'map';   // Bell 206 은 CDU 자리에 LOWER(무전 · 항법 스택)
      panelSet(k, v);
    }
    seen.add(panelFam(v)); seenV.add(v);
  });
}

function selectPanel(side, sel, force) {
  const get = panelGet, set = panelSet;
  const sides = panelSides();
  if (!sides.includes(side)) side = 'right';
  // 같은 창을 이미 다른 패널이 갖고 있으면 서로 맞바꾼다(창이 사라지지 않게).
  // CDU 와 PLAN 은 '한 창의 두 화면' 이므로 같은 것으로 친다 — 따로 보면
  // 두 패널에 CDU 가 겹쳐 뜨고, 한쪽에서 FPL 을 눌러도 다른 쪽이 바뀐다.
  // 다만 같은 화면(PFD · CDU · UPPER · LOWER · SYSTEM …)을 고르면 맞바꾸지 않고 둘 다 띄운다 — 한쪽은 거울 창(38-mirror.js)
  const holder = sides.find(k => k !== side && panelFam(get(k)) === panelFam(sel));
  //   (탭을 눌러 고를 때만 — 프로그램이 부르는 것(force)은 종전처럼 맞바꾼다: 단독 화면 · Flight Plan · SIM 창 배치 등)
  const dup = !force && holder && get(holder) === sel && typeof MIRROR_OK !== 'undefined' && MIRROR_OK.has(sel);
  if (holder && !dup) set(holder, get(side));
  set(side, sel);
  applyPanels();
}

// ── 창 위 탭 줄 — 이름이 다 들어가는지 줄마다 재어 줄임말로 바꾼다(index.html .tabs-compact · .tabs-tight) ──
//   다 펴서(.tabs-measure — 늘리지도 줄이지도 않게) 필요한 폭을 재고, 그 줄 폭보다 넓으면 줄임말(UPR · LWR · SYS · CTRL · 기호),
//   줄임말로도 넘치면 더 촘촘하게 · 그래도 넘치면(아주 좁은 창) 옆으로 밀어 보게. 줄 폭이 바뀔 때마다(분할 · 창 끌기 · 창 크기) 다시 잰다.
const TAB_ROWS = ['left-tabs', 'mid-tabs', 'page-tabs', 'bot-tabs'];
function tabsFitRow(row) {
  if (!row || !row.offsetParent) return null;
  const avail = row.clientWidth;
  row.classList.remove('tabs-compact', 'tabs-tight', 'tabs-scroll');
  const need = k => { row.classList.add('tabs-measure'); const w = row.scrollWidth; row.classList.remove('tabs-measure'); return w; };
  let mode = 'full';
  if (need() > avail + 1) {
    row.classList.add('tabs-compact'); mode = 'compact';
    if (need() > avail + 1) {
      row.classList.add('tabs-tight'); mode = 'tight';
      if (need() > avail + 1) { row.classList.add('tabs-scroll'); mode = 'scroll'; }   // 그래도 넘치면 옆으로 밀어 본다(자르지 않는다)
    }
  }
  return mode;
}
function tabsFit() { const o = {}; TAB_ROWS.forEach(id => { o[id] = tabsFitRow(document.getElementById(id)); }); return o; }
try {
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(ents => ents.forEach(e => { try { tabsFitRow(e.target); } catch (er) { _swallow(er); } }));
    const go = () => TAB_ROWS.forEach(id => { const el = document.getElementById(id); if (el) ro.observe(el); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
} catch (e) { _swallow(e); }
function applyPanels() {
  fixPanelDupes();
  const L = document.getElementById('left-panel');
  const M = document.getElementById('mid-panel');
  const R = document.getElementById('right-panel');
  const B = document.getElementById('bot-panel');
  const app = document.getElementById('app');
  app.classList.toggle('triple', tripleMode);
  app.classList.toggle('quad', quadMode);
  try { applyPoRatio(); } catch (e) { _swallow(e); }
  // 새로고침은 CDU 창(3분할의 가운데) 탭에 — 2분할에는 가운데가 없으니 우측 탭 끝에
  try {
    const hb = document.getElementById('home-btn');
    const rb = document.getElementById('reload-btn');
    const tabs = document.getElementById(quadMode ? 'bot-tabs' : tripleMode ? 'mid-tabs' : 'page-tabs');
    if (hb && tabs && (hb.parentElement !== tabs || hb.nextElementSibling !== rb)) tabs.appendChild(hb);   // ⌂ 처음 화면 — 새로고침 바로 앞
    if (rb && tabs && (rb.parentElement !== tabs || rb.previousElementSibling !== hb)) tabs.appendChild(rb);
  } catch (e) { _swallow(e); }
  const btn = document.getElementById('split-toggle');
  if (btn) { btn.textContent = quadMode ? '⿰ 2분할' : tripleMode ? '▦ 4분할' : '⿲ 3분할'; btn.dataset.short = btn.textContent.split(' ')[0]; }   // 좁은 탭 줄에서는 기호만(tabsFit)
  requestAnimationFrame(() => { try { tabsFit(); } catch (e) { _swallow(e); } });   // ⌂ ⟳ 를 옮기거나 줄이 바뀌면 다시 잰다

  const wrapIds = { pfd: 'pfd-wrap', map: 'map-wrap', cdu: 'cdu-wrap', m3d: 'map3d-wrap', grip: 'grip-wrap',
                    plan: 'fp-wrap', ovhd: 'ovhd-wrap', sysp: 'sysp-wrap', lcon: 'lcon-wrap', msn: 'msn-wrap', atc: 'atc-wrap' };   // atc — ATC 관제석(41-atc.js)   // msn — Vendor(흰수리 전탐석 · 37-mission.js)
  if (window.CN_WRAPS) Object.assign(wrapIds, window.CN_WRAPS);   // CN-235 화면들(43-cn235panel.js — CENTER · GLARE · OVHD · C/B · CONSOLE · W&B · FMS · RTU · PED)
  // 화면 하나만 새 창에 띄운 것(SIM Mode 창 배치판 · 00-popout.js popoutScreen)은 그 그릇이 먼저다
  const scrHost = k => (window._scrHost && window._scrHost[k]) ? document.getElementById('po-host-' + k) : null;
  // Simple mode — 고른 화면 하나가 전체 화면 그릇(#simple-host)을 차지한다
  const simpleHost = k => (window._simpleScr === k) ? document.getElementById('simple-host') : null;
  const hostOf0 = k => simpleHost(k) || scrHost(k) || (leftSel === k ? L : (tripleMode && midSel === k ? M : (rightSel === k ? R : (quadMode && botSel === k ? B : null))));
  // SYSTEM 창의 Map 화면(18-system.js) — 지도가 다른 창에 없고 SYSTEM 창이 보이면 그 큰 칸이 지도 그릇
  const sysMapHost = () => { try { return (typeof sysMapSlot === 'function' && (ckC('sysp', 'pop') || hostOf0('sysp'))) ? sysMapSlot() : null; } catch (e) { return null; } };
  // SIM 3D 조종석(15-heli3d.js) — 콘솔 팝아웃(LowerC · UpperC)은 무엇보다 먼저, 조종석 안의 작은 콘솔은 다른 창에 없을 때만
  const ckC = (k, ph) => { try { return typeof ckpitConsoleHost === 'function' ? ckpitConsoleHost(k, ph) : null; } catch (e) { return null; } };
  // 콘솔(UPPER · LOWER)은 단독 화면(Cockpit Mode 등)에서 보이지 않는 창을 그릇으로 삼지 않는다 — 그 창 탭이 UPPER · LOWER 였으면
  // 콘솔이 보이지 않는 창에 남아 조종석 안의 작은 콘솔 칸이 검게 비었다. 창이 접혔거나(display:none) #app 째 숨었으면(화면에 자리가 없다) 조종석 칸이 먼저
  const _vis = el => !!el && el.style.display !== 'none' && el.getClientRects().length > 0;
  const hostOf = k => {
    if (typeof acScrOk === 'function' && !acScrOk(k)) return null;   // 기종에 없는 화면(Bell 206 — CDU · UPPER)은 어디에도 띄우지 않는다
    const pop = ckC(k, 'pop'); if (pop) return pop;
    let h = hostOf0(k);
    if ((k === 'ovhd' || k === 'lcon') && h && [L, M, R, B].includes(h) && !_vis(h)) h = null;
    // CDU — 조종석만 띄운 Cockpit Mode 가 아니어도(분할 창 · SIM Mode 새 창의 3D 조종석) 다른 곳에 없으면 조종석 CDU 칸에
    if (!h && k === 'cdu') { try { if (!cduOvActive()) return _ckCduSlot(); } catch (e) { _swallow(e); } }
    return h || (k === 'map' ? sysMapHost() : null) || ckC(k, 'mini');
  };
  ['pfd', 'map', 'cdu', 'm3d', 'plan', 'ovhd', 'sysp', 'lcon', 'grip', 'msn', 'atc'].concat(Object.keys(window.CN_WRAPS || {})).forEach(k => {
    const el = document.getElementById(wrapIds[k]);
    if (!el) return;
    // 3D 단독(Cockpit Mode)에 겹친 CDU · Flight Plan(#cdu-ov — syncCduOverlay)은 그대로 둔다 — 종전에는 SYSTEM FULL/HALF 처럼
    // applyPanels 를 부르는 단추를 누르면 숨은 창으로 끌려가 팝업 CDU 가 검게 비었다
    if ((k === 'cdu' || k === 'plan') && el.closest('#cdu-ov')) { try { if (cduOvActive()) return; } catch (e) { _swallow(e); } }
    const host = hostOf(k);
    if (host && el.parentElement !== host) host.appendChild(el);
    el.classList.toggle('page-hidden', !host);
  });
  // 3D 지도를 어느 창이 쓰는지 — 지도 위에 겹칠지, 제 창을 통째로 쓸지
  syncMap3dHost(!!hostOf('m3d'));
  // 상부 콘솔은 처음 보일 때 만들고, 창 크기에 맞춘다(17-upper.js)
  if (hostOf('ovhd')) { try { if (typeof ovhdShow === 'function') ovhdShow(); } catch (e) { _swallow(e); } }
  if (hostOf('lcon')) { try { if (typeof lconShow === 'function') lconShow(); } catch (e) { _swallow(e); } }
  if (hostOf('sysp')) { try { if (typeof sysShow === 'function') requestAnimationFrame(sysShow); } catch (e) { _swallow(e); } }
  if (hostOf('grip')) { try { if (typeof gripPanelRender === 'function') gripPanelRender(true); } catch (e) { _swallow(e); } }
  try { if (typeof msnPanelSync === 'function') msnPanelSync(!!hostOf('msn')); } catch (e) { _swallow(e); }   // Vendor — 전탐석을 그 창에(37-mission.js)
  try { if (typeof atcPanelSync === 'function') atcPanelSync(!!hostOf('atc')); } catch (e) { _swallow(e); }   // ATC — 관제석(41-atc.js)
  try { syncChinView(); } catch (e) { _swallow(e); }
  // 거울 창(38-mirror.js) — 진짜 화면이 다른 곳에 있는 자리: ① 같은 화면을 고른 다른 창(패널) ② 3D 조종석의 작은 콘솔 · CDU 칸
  try {
    if (typeof mirrorSync === 'function') {
      const want = [], srcOf = k => document.getElementById(wrapIds[k]);
      const sideEl = { left: L, mid: M, right: R, bot: B };
      panelSides().forEach(sd => {
        const k = panelGet(sd), P = sideEl[sd];
        if (!P || !MIRROR_OK.has(k) || (typeof acScrOk === 'function' && !acScrOk(k))) return;
        const src = srcOf(k); if (!src || P.contains(src) || (k === 'cdu' && P.contains(document.getElementById('cdu-ov')))) return;
        want.push({ host: P, k, src });
      });
      if (typeof ckpitWanted === 'function' && ckpitWanted()) ['ovhd', 'lcon', 'sysp', 'cdu'].forEach(k => {
        const slot = document.getElementById('ck-mini-' + k), src = srcOf(k);
        if (!slot || !src || slot.contains(src) || (typeof acScrOk === 'function' && !acScrOk(k))) return;
        if (k === 'cdu' && slot.querySelector('#cdu-ov')) return;
        want.push({ host: slot, k, src, passive: true });   // 누르면 그 칸이 크게(팝아웃 — 진짜 화면이 그리 온다)
      });
      mirrorSync(want);
    }
  } catch (e) { _swallow(e); }

  // PFD 호스트 패널은 FCP 조작부가 다 보이도록 넓게(2분할 55% / 3분할 1.4배)
  L.classList.toggle('pfd-host', leftSel === 'pfd');
  M.classList.toggle('pfd-host', tripleMode && midSel === 'pfd');
  R.classList.toggle('pfd-host', rightSel === 'pfd');

  // 탭 활성 표시
  // PLAN 은 CDU 자리에서 열리는 화면이라 탭은 CDU 가 켜진 것으로 본다
  const tabSel = v => (v === 'plan' ? 'cdu' : v);
  document.querySelectorAll('#left-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(leftSel)));
  document.querySelectorAll('#mid-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(midSel)));
  document.querySelectorAll('#page-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(rightSel)));
  document.querySelectorAll('#bot-tabs [data-sel]').forEach(b =>
    b.classList.toggle('active', b.dataset.sel === tabSel(botSel)));

  // 레거시 상태 동기화(솔로 모드 진입 판단 등에서 사용)
  leftPage = (leftSel === 'map' || leftSel === 'm3d') ? 1 : 0;
  currentPage = rightSel === 'map' ? 0 : rightSel === 'plan' ? 1 : rightSel === 'cdu' ? 2 : 0;

  // 3분할은 --tri-l/--tri-m 로 배분한다(2분할의 인라인 flex 는 무효화)
  if (tripleMode) { L.style.flex = ''; applyTriRatio(); }
  // 크기 재계산
  requestAnimationFrame(() => { resizePFD(); drawPFD(); scaleCdu(); });
  setTimeout(() => {
    try { leafMap.invalidateSize(); } catch(e) { _swallow(e); }
    try { if (_ml3d) _ml3d.resize(); } catch(e) { _swallow(e); }
    scaleCdu();
  }, 60);
}

// 처음 켤 때 한 번 맞춘다. 마크업의 초기 배치는 2분할(PFD|MAP)이라,
// 위에서 정한 기본값(3분할 · 좌 PFD · 중 MAP · 우 CDU)을 여기서 화면에 반영한다.
// 저장된 세션을 복원하면 그쪽에서 다시 applyPanels 를 부르므로 그 뜻이 이긴다.
try { applyPanels(); } catch(e) { _swallow(e); }

// 레거시 래퍼 — 기존 호출부(CDU 버튼·솔로 모드 등) 호환
function setLeftPage(n) { selectPanel('left', n === 0 ? 'pfd' : 'map', true); }
function setPage(n) { selectPanel('right', ['map', 'plan', 'cdu'][n] || 'map', true); }

// ── 분할 비율 조절: 경계선 그립을 드래그(좌우/위아래) ──
// 2분할: 좌측 패널에 인라인 flex-basis를 지정(pfd-host 55% 규칙보다 우선)
// 3분할: 두 경계선을 각각 드래그. 인접한 두 창만 서로 크기를 주고받는다.
// ── 패널을 새 창으로 띄운 뒤 본 창에 남은 패널(00-popout.js) ──
// 둘이 남으면 그 사이 경계를 끌어 비율을 고른다 — 앞쪽 패널이 poRatio(%)를 갖고 뒤쪽이 나머지를 채운다
let poRatio = 50;
function poRemaining() {
  const sides = (typeof popoutSides === 'function') ? popoutSides() : [];
  if (!sides.length) return [];
  if (quadMode) return [];   // 4분할은 경계 끌기를 쓰지 않는다
  return ['left', 'mid', 'right'].filter(k => !sides.includes(k) && (k !== 'mid' || tripleMode))
    .map(k => document.getElementById(k + '-panel')).filter(el => el && el.ownerDocument === document);
}
function applyPoRatio() {
  const app = document.getElementById('app');
  if (!app) return;
  const rem = poRemaining();
  ['left', 'mid', 'right'].forEach(k => { const el = document.getElementById(k + '-panel'); if (el) el.classList.remove('po-a'); });
  if (rem.length === 2) rem[0].classList.add('po-a');
  app.style.setProperty('--po-a', poRatio.toFixed(2) + '%');
  try { resizePFD(); } catch (e) { _swallow(e); }
}
(function initDividerDrag() {
  const grip  = document.getElementById('divider-grip');
  const grip2 = document.getElementById('divider-grip-2');
  const app   = document.getElementById('app');
  const L     = document.getElementById('left-panel');
  if (!grip || !app || !L) return;

  // 좌측을 고정폭으로 두고, 우측은 남은 공간을 채우도록(split-custom) 전환
  const applyRatio = pct => { L.style.flex = `0 0 ${pct}%`; app.classList.add('split-custom'); };
  const afterResize = () => {
    requestAnimationFrame(() => { try { resizePFD(); drawPFD(); } catch(e) { _swallow(e); } });
    setTimeout(() => {
      try { leafMap.invalidateSize(); } catch(e) { _swallow(e); }
      try { if (_ml3d) _ml3d.resize(); } catch(e) { _swallow(e); }
      try { scaleCdu(); } catch(e) { _swallow(e); }
    }, 60);
  };

  // 저장된 비율 복원
  const saved = parseFloat(localStorage.getItem('splitRatio'));
  if (!isNaN(saved) && saved >= 25 && saved <= 75) applyRatio(saved);
  if (tripleMode) applyTriRatio();
  afterResize();

  // 포인터 위치를 앱 기준 0~100% 로
  const pctOf = e => {
    const r = app.getBoundingClientRect();
    return (r.width >= r.height)
      ? (e.clientX - r.left) / r.width * 100
      : (e.clientY - r.top) / r.height * 100;
  };

  // which: 1 = 좌|중 경계, 2 = 중|우 경계(3분할 전용)
  function bind(el, which) {
    if (!el) return;
    let dragging = false;
    el.addEventListener('pointerdown', e => {
      if (which === 2 && !tripleMode && !poRemaining().length) return;
      e.preventDefault(); dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch(err) { _swallow(err); }
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      const pct = pctOf(e);
      // 패널 하나를 새 창으로 띄워 둘만 남았으면 — 남은 경계로 그 둘의 비율을 고른다(00-popout.js)
      if (poRemaining().length === 2) {
        poRatio = Math.max(15, Math.min(85, pct));
        applyPoRatio();
      } else if (!tripleMode) {
        applyRatio(Math.max(25, Math.min(75, pct)));
      } else {
        const cur = triRatio || triDefaultRatio();
        let [l, m] = cur;
        if (which === 1) {
          // 좌|중 경계 — 좌·중이 서로 주고받고 우측 폭은 유지
          const edge = l + m;
          l = Math.max(TRI_MIN, Math.min(edge - TRI_MIN, pct));
          m = edge - l;
        } else {
          // 중|우 경계 — 중·우가 서로 주고받고 좌측 폭은 유지
          const edge = Math.max(l + TRI_MIN, Math.min(100 - TRI_MIN, pct));
          m = edge - l;
        }
        triRatio = [l, m];
        applyTriRatio();
      }
      try { resizePFD(); } catch(err) { _swallow(err); }
      try { scaleCdu(); } catch(err) { _swallow(err); }   // CDU 도 PFD HSI 처럼 끄는 동안 바로 맞춘다(놓은 뒤가 아니라)
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (poRemaining().length === 2) { /* 새 창 배치의 비율은 그 동안만 쓴다 */ }
      else if (tripleMode) saveTriRatio();
      else {
        const mm = /0 0 ([\d.]+)%/.exec(L.style.flex || '');
        if (mm) try { localStorage.setItem('splitRatio', mm[1]); } catch(err) { _swallow(err); }
      }
      afterResize();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 더블탭/더블클릭 → 기본 배분으로 되돌리기
    el.addEventListener('dblclick', () => {
      if (poRemaining().length === 2) { poRatio = 50; applyPoRatio(); }
      else if (tripleMode) { triRatio = null; applyTriRatio(); saveTriRatio(); }
      else { L.style.flex = ''; app.classList.remove('split-custom');
             try { localStorage.removeItem('splitRatio'); } catch(err) { _swallow(err); } }
      afterResize();
    });
  }
  bind(grip, 1);
  bind(grip2, 2);
})();

// CDU 홈의 MAP 버튼 — 분할/전체화면 모두에서 MAP 창을 연다.
// 전체화면(solo)에서는 map-wrap이 숨겨진 좌측 패널에 있을 수 있어 setPage(0)로는
// 검은 화면이 되므로, solo 모드일 때는 solo MAP 화면으로 전환한다.
function cduOpenMap() {
  // 지도가 어느 창에도 안 보이고 SYSTEM 창이 보이면(예: Cockpit Mode) — SYSTEM 창의 큰 칸에 지도(Map 화면)
  try {
    const mw = document.getElementById('map-wrap'), sw = document.getElementById('sysp-wrap');
    const shown = el => el && !el.classList.contains('page-hidden') && el.getBoundingClientRect().width > 0;
    if (typeof sysPageSet === 'function' && shown(sw) && (!shown(mw) || (typeof sysPage !== 'undefined' && sysPage === 'map'))) { sysPageSet('map'); return; }
  } catch (e) { _swallow(e); }
  // 3D 단독에서는 단독 화면을 바꾸지 않고 MAP 을 계기 칸 크기로 겹쳐 띄운다(MAP ON/OFF 와 같다)
  if (_soloActive && _soloCurrent === 'm3d') {
    if (!mapOvOn) { mapOvOn = true; try { localStorage.setItem(MAP_OV_PREF, '1'); } catch (e) { _swallow(e); } }
    syncMapOverlay(); return;
  }
  if (_soloActive) setSolo('map');
  else setPage(0);
}

// ══════════════════════════════════════════════════════
// 화면 터치 잠금 — 비행 중 오조작 방지 (길게 눌러 해제)
// ══════════════════════════════════════════════════════
const LOCK_HOLD_MS = 1200;
let _screenLocked = false;
function lockScreen() {
  _screenLocked = true;
  document.getElementById('lock-overlay').classList.add('on');
  const b = document.getElementById('lock-btn'); if (b) b.classList.add('locked');
  try { navigator.vibrate && navigator.vibrate(40); } catch(e) { _swallow(e); }
}
function unlockScreen() {
  _screenLocked = false;
  document.getElementById('lock-overlay').classList.remove('on');
  const b = document.getElementById('lock-btn'); if (b) b.classList.remove('locked');
  const f = document.getElementById('lock-unlock-fill'); if (f) f.style.width = '0%';
  const t = document.getElementById('lock-unlock-txt'); if (t) t.textContent = '길게 눌러 해제';
  try { navigator.vibrate && navigator.vibrate([40, 60, 40]); } catch(e) { _swallow(e); }
}
(function initScreenLock() {
  const btn  = document.getElementById('lock-unlock');
  const fill = document.getElementById('lock-unlock-fill');
  const txt  = document.getElementById('lock-unlock-txt');
  const ov   = document.getElementById('lock-overlay');
  if (!btn || !ov) return;
  let t0 = 0, raf = null;
  const stop = () => {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    t0 = 0; fill.style.width = '0%'; txt.textContent = '길게 눌러 해제';
  };
  const tick = () => {
    if (!t0) return;
    const el = performance.now() - t0;
    const p = Math.min(1, el / LOCK_HOLD_MS);
    fill.style.width = (p * 100) + '%';
    txt.textContent = p < 1 ? '해제 중…' : '해제';
    if (p >= 1) { stop(); unlockScreen(); return; }
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    try { btn.setPointerCapture(e.pointerId); } catch(err) { _swallow(err); }
    t0 = performance.now(); tick();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(ev =>
    btn.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); stop(); }));
  // 오버레이 자체는 모든 입력을 흡수(잠금 유지)
  ['pointerdown','pointerup','click','touchstart','touchmove','wheel'].forEach(ev =>
    ov.addEventListener(ev, e => { if (e.target === ov || e.target.id === 'lock-badge') { e.preventDefault(); e.stopPropagation(); } },
      { passive: false }));
})();

// ══════════════════════════════════════════════════════
// RULER — 지도에서 두 점 이상을 찍어 거리·방위 측정
// ══════════════════════════════════════════════════════
let _rulerOn = false, _rulerPts = [], _rulerLayer = null;
// RULER_VAR(자기편차)는 HOVER PAGE 판독에서도 쓰이므로 D2R 옆(상단)에 선언한다.

function toggleRuler() {
  _rulerOn = !_rulerOn;
  const b = document.getElementById('map-ruler-btn');
  if (b) b.classList.toggle('ruler-active', _rulerOn);
  if (_rulerOn) {
    leafMap.on('click', _rulerClick);
    try { leafMap.getContainer().style.cursor = 'crosshair'; } catch(e) { _swallow(e); }
    _rulerRender();
  } else {
    leafMap.off('click', _rulerClick);
    try { leafMap.getContainer().style.cursor = ''; } catch(e) { _swallow(e); }
    _rulerClearAll();
  }
}
function _rulerClick(e) { _rulerPts.push([e.latlng.lat, e.latlng.lng]); _rulerRender(); }
function _rulerUndo() { _rulerPts.pop(); _rulerRender(); }
function _rulerReset() { _rulerPts = []; _rulerRender(); }
function _rulerClearAll() {
  _rulerPts = [];
  if (_rulerLayer) { try { leafMap.removeLayer(_rulerLayer); } catch(e) { _swallow(e); } _rulerLayer = null; }
  const el = document.getElementById('ruler-readout');
  if (el) el.style.display = 'none';
}
function _rulerRender() {
  if (_rulerLayer) { try { leafMap.removeLayer(_rulerLayer); } catch(e) { _swallow(e); } _rulerLayer = null; }
  const g = L.layerGroup();
  const P = _rulerPts;
  // 점 표시
  P.forEach((p, i) => {
    L.circleMarker(p, { radius: 4, color: '#ffd54f', weight: 2, fillColor: '#000', fillOpacity: 1, interactive: false }).addTo(g);
    if (i === 0) L.marker(p, { interactive: false, icon: L.divIcon({ className:'', iconSize:[0,0],
      html:`<div style="transform:translate(6px,-16px);color:#ffd54f;font-size:9px;font-weight:bold;text-shadow:1px 1px 2px #000;">START</div>` }) }).addTo(g);
  });
  let total = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i-1], b = P[i];
    const d = distance(a[0], a[1], b[0], b[1]);
    const brg = bearing(a[0], a[1], b[0], b[1]);
    total += d;
    L.polyline([a, b], { color: '#ffd54f', weight: 2, opacity: 0.95, dashArray: '6 4', interactive: false }).addTo(g);
    // 구간 라벨(중점)
    const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
    L.marker(mid, { interactive: false, icon: L.divIcon({ className:'', iconSize:[0,0],
      html:`<div style="transform:translate(-50%,-50%);background:rgba(8,10,14,0.85);border:1px solid #ffd54f88;border-radius:3px;` +
           `padding:1px 4px;color:#ffd54f;font-size:9px;font-weight:bold;white-space:nowrap;">` +
           `${fmtA(toMag(brg))}° · ${d.toFixed(1)}NM</div>` }) }).addTo(g);
  }
  _rulerLayer = g.addTo(leafMap);

  // 판독창
  const el = document.getElementById('ruler-readout');
  if (!el) return;
  if (!_rulerOn) { el.style.display = 'none'; return; }
  const R = (l, v) => `<div class="rr-row"><span class="rr-lbl">${l}</span><span class="rr-val">${v}</span></div>`;
  let html = '';
  if (P.length < 2) {
    html = `<div style="color:#8a9aa8;font-size:10px;line-height:1.5;">지도를 탭해 점을 찍으세요.<br>두 점 이상이면 거리·방위가 표시됩니다.</div>`;
  } else {
    const a = P[P.length-2], b = P[P.length-1];
    const legD = distance(a[0], a[1], b[0], b[1]);
    const legB = bearing(a[0], a[1], b[0], b[1]);
    const magB = ((Math.round(legB - RULER_VAR) % 360) + 360) % 360;
    html = R('구간 방위', `${String(Math.round(legB)).padStart(3,'0')}°T / ${String(magB).padStart(3,'0')}°M`)
         + R('구간 거리', `${legD.toFixed(2)} NM`)
         + R('합계', `${total.toFixed(2)} NM · ${(total*1.852).toFixed(2)} km`);
    if (P.length > 2) {
      const dd = distance(P[0][0], P[0][1], b[0], b[1]);
      html += R('직선(시작→끝)', `${dd.toFixed(2)} NM`);
    }
  }
  html += `<div class="rr-btns"><button data-act="_rulerUndo">⟲ 취소</button>` +
          `<button data-act="_rulerReset">↺ 초기화</button>` +
          `<button data-act="toggleRuler">✕ 닫기</button></div>`;
  el.innerHTML = html;
  el.style.display = 'block';
}

// ── 단독(전체화면) 진입 ──
// 들어가기 전 창 배치를 적어 둔다. 나올 때 그대로 되돌리기 위해서다
// (종전에는 나오면 무조건 2분할 PFD|MAP 이 되어 3분할 배치가 흐트러졌다).
function enterSolo(screen) {
  if (!_soloActive) _soloSaved = { l: leftSel, m: midSel, r: rightSel, tri: tripleMode, q: quadMode, b: botSel };
  if (quadMode) { quadMode = false; try { document.getElementById('app').classList.remove('quad'); } catch (e) { _swallow(e); } }   // 단독 화면은 4분할 격자를 접고 본다
  _soloActive = true;
  document.getElementById('solo-bar').style.display = 'flex';
  setSolo(screen);
}

// 단독 버튼 — 각 창 탭 줄의 오른쪽 끝. 한 번 더 누르면 원래 배치로 돌아온다.
function panelSolo(screen) {
  if (_soloActive && _soloCurrent === screen) { exitSolo(); return; }
  enterSolo(screen);
}
function pfdSolo() { panelSolo('pfd'); }        // 종전 이름(좌측 상단 버튼)

// 단독 버튼 라벨(단독 ⇄ 분할) — 지금 단독으로 떠 있는 창의 버튼만 되돌리기가 된다
const SOLO_BTNS = { pfd: 'pfd-solo-btn', map: 'map-solo-btn', cdu: 'cdu-solo-btn', m3d: 'm3d-solo-btn' };
const SOLO_NAMES = { pfd: 'PFD', map: 'MAP', cdu: 'CDU', m3d: '3D' };
function updateSoloBtn() {
  Object.keys(SOLO_BTNS).forEach(k => {
    const b = document.getElementById(SOLO_BTNS[k]);
    if (!b) return;
    const on = (_soloActive && _soloCurrent === k);
    b.textContent = on ? '✥ 분할' : `⛶ ${SOLO_NAMES[k]} 단독`; b.dataset.short = on ? '✥' : '⛶';
    b.classList.toggle('active', on);
  });  const ob = document.getElementById('m3d-only-btn');
  // Cockpit Mode 탭(오른쪽 창 · 가운데 · 아래 창 — 3D 탭 자리)
  { const on = _soloActive && _soloCurrent === 'm3d';
    document.querySelectorAll('.ck-mode-tab').forEach(b => { const t = on ? '✥ 분할' : '⛶ Cockpit'; if (b.textContent !== t) { b.textContent = t; b.dataset.short = on ? '✥' : '⛶'; } b.classList.toggle('active', on); }); }
  try { if (typeof syncFcp3d === 'function') syncFcp3d(); } catch (e) { _swallow(e); }   // 3D 단독에서만 FCP L·R
  try { syncCduOverlay(); } catch (e) { _swallow(e); }   // 3D 단독에서만 CDU 겹치기
  try { syncMapOverlay(); } catch (e) { _swallow(e); }   // 3D 단독에서만 MAP 겹치기
  try { if (typeof syncVStick === 'function') syncVStick(); } catch (e) { _swallow(e); }   // 3D 단독 · SIM 에서만 화면 조종간
}

// MAP 상단 툴바의 FULL/HALF 토글 — 상황에 맞게 전체화면 진입/분할 복귀
function toggleMapFull() {
  if (_soloActive) { exitSolo(); return; }
  enterSolo('map');
}

// ── CDU · PLAN 이 있는 자리 ──
// Flight Plan 은 CDU 의 한 화면이므로 'CDU 가 있는 창' 에서 열려야 한다.
// 종전에는 늘 우측이어서, CDU 를 좌측에 둔 3분할에서 FPL 을 누르면
// 엉뚱하게 우측(PFD) 창이 Flight Plan 으로 바뀌었다.
function cduSide(want) {
  const sides = panelSides();
  const get = panelGet;
  return sides.find(k => get(k) === want)
      || sides.find(k => get(k) === 'cdu' || get(k) === 'plan')
      || 'right';
}
function goCduPage(sel) { selectPanel(cduSide(sel), sel, true); }

// Flight Plan 하단 Home 버튼 — CDU 홈 화면으로 전환
function fpGoCduHome() {
  if (_soloActive) setSolo('cdu');
  else goCduPage('cdu');
  try { switchMode('HOME'); } catch(e) { _swallow(e); }
}

// CDU 하단 Full 버튼 — 상단 Full Screen 탭과 동일하게 CDU 전체화면 진입(지금은 푸터에서 부르지 않는다 · 남은 호출용)
function cduFullScreen() { enterSolo('cdu'); }

// ── CDU 하단 푸터 표준화 ──
// 가운데 단추는 SYSTEM 창의 큰 칸 나누기 하나만 한다 — FULL(한 화면) ↔ HALF(반쪽 둘) · 18-system.js sysLayout
//   (예전에는 PC 모드에서 CDU 단독 FULL ↔ HALF · 3D 단독에서는 '3D'(쓸 수 없음)였다 — 화면 모드와 상관없이 같게)
function cduFullNavBtn() {
  try {
    if (typeof sysLayout !== 'undefined') {
      const f = sysLayout === 'FULL';
      return `<div class="nav-btn" id="sys-layout-btn" data-act="sysLayoutToggle" title="SYSTEM 창 — 한 화면(FULL) · 반쪽 둘(HALF)"><span>▥</span>`
           + `<div style="white-space:nowrap"><b style="color:${f ? '#2fe0e0' : '#777'}">FULL</b>/<b style="color:${f ? '#777' : '#2fe0e0'}">HALF</b></div></div>`;
    }
  } catch (e) { _swallow(e); }
  return `<div class="nav-btn" style="opacity:.35;pointer-events:none"><span>▥</span>FULL/HALF</div>`;
}
// PLAN 버튼 — Flight Plan 화면 열기(분할/전체화면 모두 대응)
function openFlightPlan() {
  // 직전에 PROC(IFR) 등을 열어 fpMode가 남아있으면 플랜 목록으로 되돌림
  try { fpMode = 'LIST'; fpRender(); } catch(e) { _swallow(e); }
  if (_soloActive) setSolo('plan'); else goCduPage('plan');
}
// Flight Plan 화면의 FULL — 플랜을 전체화면으로
function planFullScreen() { enterSolo('plan'); }
// Flight Plan 푸터용 FULL/HALF 버튼(solo 상태 반영)
function fpFullBtn() {
  try { if (cduOvActive()) return `<div class="fp-nav-btn" style="opacity:.35;pointer-events:none"><span>✥</span>3D</div>`; } catch (e) { _swallow(e); }
  return _soloActive
    ? `<div class="fp-nav-btn" data-act="exitSolo"><span>✥</span>Half</div>`
    : `<div class="fp-nav-btn" data-act="planFullScreen"><span>✥</span>Full</div>`;
}
// Flight Plan 화면의 BACK — CDU(직전 화면)로 복귀
function fpBackToCdu() {
  if (_soloActive) setSolo('cdu'); else goCduPage('cdu');
}
// 표준 CDU 푸터: HOME · FULL/HALF · PLAN · BACK (+ 필요 시 Enter 등 extra)
// backOnclick이 비어있으면 BACK 버튼은 생략(예: HOME 화면)
// back 인자는 두 가지를 받는다.
//   · 문자열 : 인라인 onclick 으로 그대로 넣는다(전역 함수만 가능).
//   · 함수   : data-act 위임으로 실행한다. CDU 캡슐화 IIFE 안의 함수(clBack 등)는
//             전역에 없어 인라인 onclick 으로는 "not defined" 가 나므로 이쪽을 써야 한다.
let _cduBackFn = null;
function cduFooter(back, extra) {
  let h = `<div class="nav-btn" data-act="switchMode" data-arg='["HOME"]'><span>🏠</span>Home</div>`
        + cduFullNavBtn()
        + `<div class="nav-btn" data-act="switchMode" data-arg='["SETTINGS"]'><span>⚙</span>Setting</div>`;
  if (extra) h += extra;
  // BACK은 항상 제일 우측
  if (typeof back === 'function') {
    _cduBackFn = back;
    h += `<div class="nav-btn" data-act="cduBack"><span>↩</span>Back</div>`;
  } else if (back) {
    h += `<div class="nav-btn" onclick="${back}"><span>↩</span>Back</div>`;
  }
  return h;
}

// ══════════════════════════════════════════════════════
// SOLO (단일화면) 모드
// ══════════════════════════════════════════════════════
let _soloActive = false;
let _soloSaved = null;          // 단독 진입 전 창 배치
let _soloCurrent = null;

function setSolo(screen) {
  // 3D 단독에 CDU 를 겹쳐 쓰는 중이면 CDU·Flight Plan 화면 바꾸기는 그 칸 안에서 — 3D 단독은 그대로
  try { if (_soloActive && _soloCurrent === 'm3d' && cduOvRoute(screen)) return; } catch (e) { _swallow(e); }
  _soloCurrent = screen;
  const leftPanel  = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const divider    = document.getElementById('panel-divider');
  const midPanel   = document.getElementById('mid-panel');

  // 모든 패널 숨기기 — 3분할이면 가운데 창도 함께 접는다
  leftPanel.classList.remove('solo-panel-visible');
  rightPanel.classList.remove('solo-panel-visible');
  leftPanel.style.display  = 'none';
  rightPanel.style.display = 'none';
  divider.style.display = 'none';
  if (midPanel) { midPanel.classList.remove('solo-panel-visible'); midPanel.style.display = 'none'; }
  document.body.classList.add('solo-mode');

  // solo-bar 버튼 강조
  document.querySelectorAll('#solo-bar button:not(.solo-exit)').forEach(b => {
    b.classList.toggle('solo-active', b.textContent.trim().toLowerCase() === screen);
  });

  if (screen === 'pfd') {
    // PFD = left-panel, leftPage=0
    leftPanel.style.display = '';
    leftPanel.classList.add('solo-panel-visible');
    setLeftPage(0);
    void leftPanel.offsetHeight;
    resizePFD();
  } else if (screen === 'm3d') {
    // 3D 단독 — 3D 지도를 창 가득(제 창으로) 띄운다. 계기는 왼쪽 위에 겹쳐 뜬다(pfdOverlayDraw).
    // 다른 패널이 3D 를 갖고 있었으면 서로 맞바꾼다 — 풀면 들어가기 전 배치로 돌아온다.
    leftPanel.style.display = '';
    leftPanel.classList.add('solo-panel-visible');
    selectPanel('left', 'm3d', true);
  } else if (screen === 'map') {
    // MAP: left-panel에 배치 (setLeftPage(1) 방식)
    leftPanel.style.display = '';
    leftPanel.classList.add('solo-panel-visible');
    setLeftPage(1);
    setTimeout(() => leafMap.invalidateSize(), 80);
  } else if (screen === 'plan') {
    rightPanel.style.display = '';
    rightPanel.classList.add('solo-panel-visible');
    setPage(1);
    setTimeout(() => scaleCdu(), 80);   // Flight Plan도 354×567 규격이라 재스케일 필요
  } else if (screen === 'cdu') {
    rightPanel.style.display = '';
    rightPanel.classList.add('solo-panel-visible');
    setPage(2);
    setTimeout(() => scaleCdu(), 80);
  }
  // PFD 전체화면은 하단 푸터가 없으므로 떠 있는 HALF 버튼 표시
  // (MAP은 상단 툴바의 FULL/HALF 버튼 사용)
  const halfBtn = document.getElementById('solo-half-btn');
  // (3D 단독도 툴바가 없다 — 위 가운데에 띄운다)
  if (halfBtn) { halfBtn.classList.toggle('show', screen === 'pfd' || screen === 'm3d'); halfBtn.classList.toggle('m3d', screen === 'm3d'); }
  // 3D Only — 'Split screen' 으로 이름을 바꿔 오른쪽 3D 버튼 묶음 맨 아래에 둔다
  try {
    const ctl = document.getElementById('ctl3d');
    if (halfBtn && screen === 'm3d' && ctl) { ctl.appendChild(halfBtn); halfBtn.textContent = 'Split screen'; halfBtn.classList.add('sim-btn'); }
  } catch (e) { _swallow(e); }
  // MAP 상단 툴바 버튼 라벨: 전체화면(map)일 때 HALF, 그 외 FULL
  const mapFullBtn = document.getElementById('map-full-btn');
  if (mapFullBtn) mapFullBtn.textContent = (screen === 'map') ? 'HALF' : 'FULL';
  updateSoloBtn();
  _refreshCduFooters();   // FULL⇄HALF 라벨 갱신
  try { pfdOverlaySync(); } catch (e) { _swallow(e); }   // 3D 가 켜져 있으면 PFD 를 겹쳐 띄운다
}

// ── 3D 화면에 겹쳐 띄우는 계기(PFD 일부) ──
// 3D 지도가 화면에 떠 있으면(3D 창 · 2D 위 3D 겹치기 · 3D 단독) 그 왼쪽 위에 PFD 의 계기
// (FCP 없이 · 칸은 3D 화면의 가로 1/4 · 높이 3/5)를 겹쳐 띄운다 — 조작부 없이 비행에 몰입하도록.
// 3D 창의 '계기' 버튼으로 켜고 끈다(이 기기에 적어 둔다). 칸은 3D 가 떠 있는 창에 붙인다
// (3D 창·3D 단독 = #map3d-wrap · 2D 위 겹치기 = #map-wrap, 지도 툴바 아래).
// PFD 창이 함께 보여도 되도록 칸에는 제 캔버스(#pfd-ov-cvs)를 두고 매 프레임 따로 그린다.
const PFD_OV_PREF = 'pfdOverlay';
let pfdOvOn = true;
try { pfdOvOn = localStorage.getItem(PFD_OV_PREF) !== '0'; } catch (e) { pfdOvOn = true; }
// 3D 지도가 지금 화면에 떠 있으면 그 창(겹친 계기를 붙일 자리)
function pfdOvHost() {
  const d3 = document.getElementById('map3d');
  if (!d3 || !d3.classList.contains('active') || !(d3.offsetWidth > 40) || !(d3.offsetHeight > 40)) return null;
  return d3.parentElement;
}
// 겹친 계기 크기(3D 단독 등) — 3D 창의 계기 −/+ 로 60~160%(이 기기에 적어 둔다)
const PFD_OV_SCALE_KEY = 'pfdOvScale';
let pfdOvScale = 1;
try { const v = parseFloat(localStorage.getItem(PFD_OV_SCALE_KEY)); if (v >= 0.6 && v <= 1.6) pfdOvScale = v; } catch (e) { _swallow(e); }
function pfdOvSize(d) {
  pfdOvScale = Math.round(Math.max(0.6, Math.min(1.6, pfdOvScale + 0.1 * (Number(d) || 0))) * 10) / 10;
  try { localStorage.setItem(PFD_OV_SCALE_KEY, String(pfdOvScale)); } catch (e) { _swallow(e); }
  pfdOverlaySync(); pfdOverlayDraw(true);
}
function pfdOverlaySync() {
  const ov = document.getElementById('pfd-ov');
  if (!ov) return false;
  // Bell 206 — 여섯 계기 판(600×420 · 25-b206panel.js b206OverlayDraw)에 맞춰 가로로 넓게, 높이는 그 비율로
  const b206 = typeof acIs === 'function' && acIs('b206'), cn = typeof acIs === 'function' && acIs('cn235');   // CN-235 — PFD · 토크 · ITT 판(600×360 · 43-cn235panel.js cnOverlayDraw)
  const w = (b206 || cn) ? `${(34 * pfdOvScale).toFixed(1)}%` : `${(25 * pfdOvScale).toFixed(1)}%`;
  let h = `${Math.min(92, 60 * pfdOvScale).toFixed(1)}%`;
  if (b206 || cn) { const pw = ov.parentElement ? ov.parentElement.clientWidth : 0; if (pw > 0) h = `${Math.round(pw * parseFloat(w) / 100 * (cn ? 360 : 420) / 600)}px`; }
  if (ov.style.width !== w || ov.style.height !== h) { ov.style.width = w; ov.style.height = h; }
  const lb = document.getElementById('pfdov-pct');
  if (lb) { const t = `${Math.round(pfdOvScale * 100)}%`; if (lb.textContent !== t) lb.textContent = t; }
  // 외부 시점(EXT)에서도 계기 ON 이면 띄운다(모형이 가리면 계기 OFF 나 EXT 카메라 버튼으로 비켜 본다)
  const host = pfdOvOn ? pfdOvHost() : null;
  if (host && ov.parentElement !== host) host.appendChild(ov);
  ov.classList.toggle('show', !!host);
  return !!host;
}
// 칸이 좁으면(PFD_OV_MINW 보다) 그 너비로 그려 줄여 보인다 — 계기 배치가 비좁게 겹치지 않고
// 보통 PFD 를 작게 본 것처럼 보이게(가로·세로를 같은 비율로 줄인다)
const PFD_OV_MINW = 340;
// 화면이 바뀌는 주기(약 60fps)보다 자주 그릴 까닭이 없다 — 시뮬을 몰아서 돌릴 때(배속에서 프레임이
// 튀거나 검사가 수천 번 연달아 부를 때)는 건너뛴다. 매번 그리면 PFD 를 두 번 그리는 셈이라 그만큼 느려진다.
const PFD_OV_MIN_MS = 15;
let _pfdOvT = -Infinity;
function pfdOverlayDraw(force) {
  const now = performance.now();
  if (!force && now - _pfdOvT < PFD_OV_MIN_MS) return;
  _pfdOvT = now;
  if (!pfdOverlaySync()) return;
  const ov = document.getElementById('pfd-ov'), c = document.getElementById('pfd-ov-cvs');
  if (!c) return;
  const w = ov.clientWidth, h = ov.clientHeight;
  if (!(w > 0) || !(h > 0)) return;
  const k = Math.min(1, w / PFD_OV_MINW);
  const cw = Math.round(w / k), ch = Math.round(h / k);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  drawPfdTo(c);
}
// ADI 의 예상 항적(FPV · 초록 원) 켜기/끄기 — 3D 창의 FPV 버튼
let fpvOn = true;
try { fpvOn = localStorage.getItem('fpvOn') !== '0'; } catch (e) { _swallow(e); }
// PFD 를 그리는 모든 곳(본 PFD · 3D 에 겹친 계기 · SIM 조종석 MFD)과 FCP 값을 지금 다시 그린다 — 단위 · FPV 처럼
// 표시만 바뀌는 설정을 바꾼 즉시 보이게(다음 프레임을 기다리지 않는다)
function pfdRefreshAll() {
  try { drawPFD(); } catch (e) { _swallow(e); }
  try { pfdOverlayDraw(true); } catch (e) { _swallow(e); }
  try { if (typeof ckpitDraw === 'function') ckpitDraw(); } catch (e) { _swallow(e); }
  try { fcpsSync(); } catch (e) { _swallow(e); }
}
function toggleFpv() {
  fpvOn = !fpvOn;
  try { localStorage.setItem('fpvOn', fpvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  pfdRefreshAll();
  updateFpvBtn();
}
function updateFpvBtn() {
  const b = document.getElementById('fpv-btn'); if (!b) return;
  b.classList.toggle('on', fpvOn); b.textContent = fpvOn ? 'FPV ON' : 'FPV OFF';
}
try { document.addEventListener('DOMContentLoaded', updateFpvBtn); updateFpvBtn(); } catch (e) { _swallow(e); }
function togglePfdOverlay() {
  pfdOvOn = !pfdOvOn;
  try { localStorage.setItem(PFD_OV_PREF, pfdOvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  updatePfdOvBtn();
  pfdOverlaySync();
}
// ── Cockpit Mode 화면의 CDU ── 3D 버튼 줄 바로 왼쪽에 계기 칸과 같은 크기(가로 1/4 · 높이 3/5)로
// CDU 를 겹쳐 띄운다. CDU 창(#cdu-wrap) 그대로를 옮겨 오므로 버튼·화면이 같다(끄거나 단독을 나오면 제자리로).
// 3D 창의 'CDU' 버튼으로 켜고 끈다(이 기기에 적어 둔다). 분할 화면에는 CDU 창이 따로 있다.
const CDU_OV_PREF = 'cduOverlay';
let cduOvOn = false;
try { cduOvOn = localStorage.getItem(CDU_OV_PREF) === '1'; } catch (e) { cduOvOn = false; }
const _cduOvHome = { cdu: null, plan: null };   // 제자리 표시
const CDU_OV_WRAP = { cdu: 'cdu-wrap', plan: 'fp-wrap' };
// 겹친 CDU 가 보여 줄 화면 — CDU 또는 그 안에서 연 Flight Plan(PROC 포함). CDU 의 버튼이 단독 화면을 바꾸려 하면
// (Flight Plan · Home · BACK 등 setSolo) 3D 단독은 그대로 두고 이 칸 안에서 바꾼다.
let cduOvPage = 'cdu';
function cduOvAvail() { return _soloActive && _soloCurrent === 'm3d' && !!pfdOvHost(); }
// SIM 3D 조종석(15-heli3d.js)이 켜져 있으면 CDU 를 하부 콘솔 오른쪽 칸에 작게 둔다(CDU ON 이면 원래 겹친 칸이 먼저).
// 작아도 같은 CDU 라 누르면 그 버튼이 그대로 듣는다.
function _ckCduSlot() { try { return typeof ckpitCduSlot === 'function' ? ckpitCduSlot() : null; } catch (e) { return null; } }
function cduOvActive() { return cduOvAvail() && (typeof acScrOk !== 'function' || acScrOk('cdu')) && (cduOvOn || !!_ckCduSlot()); }   // Bell 206 — CDU 가 없다
function syncCduOverlay() {
  const want = cduOvActive();
  const inCk = want && !cduOvOn;
  if (!want) cduOvPage = 'cdu';
  const b = document.getElementById('cduov-btn');
  if (b) {
    b.textContent = cduOvOn ? 'CDU ON' : 'CDU OFF';
    b.classList.toggle('on', want && !inCk);
    b.classList.toggle('dim', !cduOvAvail());
  }
  let box = document.getElementById('cdu-ov');
  if (want) {
    const host = inCk ? _ckCduSlot() : pfdOvHost();
    if (!box) { box = document.createElement('div'); box.id = 'cdu-ov'; }
    if (box.parentElement !== host) host.appendChild(box);
    box.classList.add('show');
    box.classList.toggle('ck-in', inCk);
  } else if (box) box.classList.remove('show');
  // 보여 줄 화면만 칸 안에, 나머지는 제자리로
  Object.keys(CDU_OV_WRAP).forEach(k => {
    const wrap = document.getElementById(CDU_OV_WRAP[k]);
    if (!wrap) return;
    const inBox = want && cduOvPage === k;
    if (inBox && wrap.parentElement !== box) {
      _cduOvHome[k] = document.createComment('cdu-ov'); wrap.before(_cduOvHome[k]);
      box.appendChild(wrap);
    } else if (!inBox && _cduOvHome[k]) { _cduOvHome[k].replaceWith(wrap); _cduOvHome[k] = null; }
  });
  requestAnimationFrame(() => { try { scaleCdu(); } catch (e) { _swallow(e); } });
  if (want !== _cduOvWas) { _cduOvWas = want; _refreshCduFooters(); }   // FULL/HALF 자리
  requestAnimationFrame(() => { const m = document.getElementById('map-ov'); if (m && m.classList.contains('show')) _mapOvPlace(m); });
}
let _cduOvWas = false;
// ── Cockpit Mode 화면의 MAP ── 계기 칸과 같은 크기(가로 1/4 · 높이 3/5)로 2D 지도(#map-wrap)를 겹쳐 띄운다.
// 자리는 CDU 칸(켜져 있으면) 또는 3D 버튼 줄 바로 왼쪽. 'MAP' 버튼(CDU 아래)이나 겹친 CDU 의 MAP 으로 켠다.
const MAP_OV_PREF = 'mapOverlay';
let mapOvOn = false;
try { mapOvOn = localStorage.getItem(MAP_OV_PREF) === '1'; } catch (e) { mapOvOn = false; }
let _mapOvHome = null;
function mapOvActive() { return mapOvOn && cduOvAvail(); }
function _mapOvPlace(box) {
  const host = box.parentElement; if (!host) return;
  const hr = host.getBoundingClientRect();
  const cdu = document.getElementById('cdu-ov');
  const ctl = document.getElementById('ctl3d');
  let edge = ctl ? ctl.getBoundingClientRect().left : hr.right - 104;
  if (cdu && cdu.classList.contains('show') && !cdu.classList.contains('ck-in')) edge = Math.min(edge, cdu.getBoundingClientRect().left);
  box.style.right = Math.max(8, Math.round(hr.right - edge + 8)) + 'px';
}
function syncMapOverlay() {
  const want = mapOvActive();
  const b = document.getElementById('mapov-btn');
  if (b) {
    b.textContent = mapOvOn ? 'MAP ON' : 'MAP OFF';
    b.classList.toggle('on', want);
    b.classList.toggle('dim', !cduOvAvail());
  }
  const wrap = document.getElementById('map-wrap');
  if (!wrap) return;
  let box = document.getElementById('map-ov');
  if (want) {
    const host = pfdOvHost();
    if (!box) {
      box = document.createElement('div'); box.id = 'map-ov';
      try { new ResizeObserver(() => { try { leafMap.invalidateSize(); } catch (e) { _swallow(e); } }).observe(box); } catch (e) { _swallow(e); }
    }
    if (box.parentElement !== host) host.appendChild(box);
    if (wrap.parentElement !== box) {
      _mapOvHome = document.createComment('map-ov'); wrap.before(_mapOvHome);
      box.appendChild(wrap);
    }
    box.classList.add('show');
    _mapOvPlace(box);
  } else {
    if (_mapOvHome) { _mapOvHome.replaceWith(wrap); _mapOvHome = null; }
    if (box) box.classList.remove('show');
  }
  requestAnimationFrame(() => { try { leafMap.invalidateSize(); } catch (e) { _swallow(e); } if (box && want) _mapOvPlace(box); });
}
function toggleMapOverlay() {
  if (!cduOvAvail()) {
    try { uiToast('MAP 겹치기는 Cockpit Mode 화면에서 씁니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  mapOvOn = !mapOvOn;
  try { localStorage.setItem(MAP_OV_PREF, mapOvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  syncMapOverlay();
}
window.addEventListener('resize', () => { const b = document.getElementById('map-ov'); if (b && b.classList.contains('show')) _mapOvPlace(b); });
// 겹친 CDU 안에서 화면 바꾸기(setSolo 가 부른다) — 바꿨으면 true
function cduOvRoute(screen) {
  if (!cduOvActive() || (screen !== 'cdu' && screen !== 'plan')) return false;
  cduOvPage = screen;
  syncCduOverlay();
  _refreshCduFooters();
  return true;
}
function toggleCduOverlay() {
  if (!cduOvAvail()) {
    try { uiToast('CDU 겹치기는 Cockpit Mode 화면에서 씁니다 — 분할 화면에는 CDU 창이 따로 있습니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  cduOvOn = !cduOvOn;
  try { localStorage.setItem(CDU_OV_PREF, cduOvOn ? '1' : '0'); } catch (e) { _swallow(e); }
  syncCduOverlay();
}
function updatePfdOvBtn() {
  const b = document.getElementById('pfdov-btn');
  if (!b) return;
  b.textContent = pfdOvOn ? '계기 ON' : '계기 OFF';
  b.classList.toggle('on', pfdOvOn);
}

// solo 상태 변화 시 CDU/Flight Plan 푸터를 다시 그려 FULL⇄HALF 반영
function _refreshCduFooters() {
  try { renderCduContent(); } catch (e) { _swallow(e); }
  try { if (typeof fpRender === 'function') fpRender(); } catch (e) { _swallow(e); }
}

function exitSolo() {
  try { if (window._cockpitOn) cockpitExit(); } catch (e) { _swallow(e); }   // Cockpit Mode 도 함께 끝난다
  _soloActive = false;
  _soloCurrent = null;
  document.getElementById('solo-bar').style.display = 'none';
  const halfBtn = document.getElementById('solo-half-btn');
  if (halfBtn) {
    halfBtn.classList.remove('show', 'm3d', 'sim-btn');
    if (halfBtn.parentElement !== document.body) document.body.appendChild(halfBtn);   // 3D Only 에서 옮겨 둔 것을 제자리로
    halfBtn.textContent = '✥ HALF';
  }
  const mapFullBtn = document.getElementById('map-full-btn');
  if (mapFullBtn) mapFullBtn.textContent = 'FULL';
  document.body.classList.remove('solo-mode');
  try { pfdOverlaySync(); } catch (e) { _swallow(e); }   // 겹친 계기도 다시 본다(3D 가 아직 떠 있는가)

  const leftPanel  = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const divider    = document.getElementById('panel-divider');

  leftPanel.classList.remove('solo-panel-visible');
  rightPanel.classList.remove('solo-panel-visible');
  leftPanel.style.display  = '';
  rightPanel.style.display = '';
  divider.style.display = '';
  const midPanel = document.getElementById('mid-panel');
  if (midPanel) { midPanel.classList.remove('solo-panel-visible'); midPanel.style.display = ''; }

  // 들어가기 전 배치로 되돌린다(없으면 종전대로 좌 PFD · 우 MAP)
  if (_soloSaved) {
    tripleMode = _soloSaved.tri; leftSel = _soloSaved.l;
    quadMode = !!_soloSaved.q; botSel = _soloSaved.b || botSel;
    midSel = _soloSaved.m; rightSel = _soloSaved.r;
    _soloSaved = null;
    applyPanels();
  } else { setLeftPage(0); setPage(0); }
  updateSoloBtn();
  _refreshCduFooters();   // FULL⇄HALF 라벨 갱신
  setTimeout(() => {
    leafMap.invalidateSize();
    resizePFD();
    scaleCdu();
  }, 80);
}

// ── SIM Mode 창 배치판 ── 시작 화면에서 'SIM Mode' 를 고르면 SIM 조종을 켜고 이 판을 띄운다.
// 화면마다 버튼을 누르면 그 화면만 새 창으로 떠서(00-popout.js popoutScreen) 모니터마다 따로 배치한다.
// 브라우저는 한 번 누를 때 새 창을 하나만 열어 주므로 하나씩 누른다. 본 창은 시뮬을 돌리는 바탕으로 남는다
// (최소화하면 브라우저가 멈춰 세우니 다른 모니터 구석에 두거나 작게 둔다). 탭 줄의 '⧉ 창 배치' 로 다시 연다.
const SIM_LAYOUT_ORDER = ['pfd', 'm3d', 'map', 'cdu', 'ovhd', 'lcon', 'sysp'].filter(k => typeof acScrOk !== 'function' || acScrOk(k));
function simLayoutShow() {
  let el = document.getElementById('simlay');
  if (!el) {
    el = document.createElement('div'); el.id = 'simlay';
    const names = window.POPOUT_SCREENS || {};
    el.innerHTML = `<div class="simlay-box"><div class="simlay-title">SIM Mode — 창 배치</div>` +
      `<div class="simlay-note">화면마다 눌러 새 창으로 띄운 뒤, 창을 모니터마다 끌어다 놓으십시오(한 번에 한 창).<br>` +
      `본 창은 시뮬을 돌리는 바탕입니다 — 닫거나 최소화하지 마십시오.</div>` +
      `<div class="simlay-grid">` + SIM_LAYOUT_ORDER.map(k => k === 'm3d'
        // 3D 자리는 COCKPIT MODE — 3D 를 새 창에 띄우고 조종석 패널(MFD · 콘솔 · CDU)을 켠다(15-heli3d.js)
        ? `<button type="button" class="simlay-btn" data-act="simLayoutCockpit" data-scr="m3d"><b>COCKPIT MODE</b><span></span></button>`
        : `<button type="button" class="simlay-btn" data-act="popoutScreen" data-arg='["${k}"]' data-scr="${k}"><b>${names[k] || k}</b><span></span></button>`).join('') +
      `</div><div class="simlay-foot"><button type="button" class="simlay-sm" data-act="simLayoutAllBack">모두 본 창으로</button>` +
      `<button type="button" class="simlay-sm" data-act="simLayoutHide">닫기</button></div></div>`;
    document.body.appendChild(el);
  }
  el.classList.add('show');
  simLayoutSync();
}
function simLayoutCockpit() {
  const open = (typeof popoutScreens === 'function') ? popoutScreens() : [];
  if (!open.includes('m3d')) { try { if (typeof ckpitSet === 'function') ckpitSet(true); } catch (e) { _swallow(e); } }
  try { popoutScreen('m3d'); } catch (e) { _swallow(e); }
}
function simLayoutHide() { const el = document.getElementById('simlay'); if (el) el.classList.remove('show'); }
function simLayoutAllBack() { try { if (typeof popoutCloseAll === 'function') popoutCloseAll(); } catch (e) { _swallow(e); } simLayoutSync(); }
function simLayoutSync() {
  const open = (typeof popoutScreens === 'function') ? popoutScreens() : [];
  document.querySelectorAll('#simlay .simlay-btn').forEach(b => {
    const on = open.includes(b.dataset.scr);
    b.classList.toggle('on', on);
    const sp = b.querySelector('span'); const t = on ? '새 창에 떠 있음 · 누르면 복귀' : '누르면 새 창으로';
    if (sp && sp.textContent !== t) sp.textContent = t;
  });
}
function simLayoutStart() {
  try { if (typeof simModeOn !== 'undefined' && !simModeOn && typeof toggleSimMode === 'function') toggleSimMode(true); } catch (e) { _swallow(e); }
  simLayoutShow();
}
// (화면 버튼 등록은 19-lower.js — appRegister 는 09-cdu.js 에서 정의되어 이 파일보다 늦다)

// ── Simple mode ── 시작 화면에서 'Simple Mode' 를 고르면 창 하나만 화면 가득 본다.
// 위 막대에 쓸 수 있는 창(PFD · COCKPIT · MAP · CDU · UPPER · LOWER · SYSTEM · CONTROL)이 다 있고, 누른 창 하나만 보인다.
// 분할 패널(#app)은 감추고, 고른 화면 묶음을 그릇(#simple-host)에 옮긴다(applyPanels 의 hostOf).
const SIMPLE_SCREENS = [['pfd', 'PFD'], ['map', 'MAP'], ['cdu', 'CDU'], ['ovhd', 'UPPER'], ['lcon', 'LOWER'], ['sysp', 'SYSTEM'], ['grip', 'CONTROL'], ['msn', 'Vendor'], ['atc', 'ATC']]   // CONTROL — 컬렉티브 · 사이클릭(35-kuhgrip.js) · Vendor — 흰수리 전탐석(37-mission.js)
  .filter(([k]) => typeof acScrOk !== 'function' || acScrOk(k));   // Bell 206 — CDU · UPPER 없음
// 위 막대의 두 번째 칸은 COCKPIT — Cockpit Mode(3D 조종석)로 들어가고, 끝내면(Split screen) 이 Simple 화면으로 돌아온다.
// (3D 지도 자체는 MAP 의 '3D' 버튼으로 본다)
let _ckFromSimple = null;
function simpleCockpit() {
  _ckFromSimple = window._simpleScr || 'pfd';
  cockpitStart();
}
let simpleOn = false;
function _simpleEnsure() {
  if (document.getElementById('simple-bar')) return;
  const bar = document.createElement('div'); bar.id = 'simple-bar';
  bar.innerHTML = SIMPLE_SCREENS.map(([k, n]) => `<button type="button" data-act="simpleSet" data-arg='["${k}"]' data-scr="${k}">${n}</button>`)
      .map((h, i) => i === 1 ? `<button type="button" data-act="simpleCockpit" data-scr="cockpit" title="Cockpit Mode — 3D 조종석(끝내면 이 화면으로 돌아온다)">COCKPIT</button>` + h : h).join('') +
    `<button type="button" class="simple-exit" data-act="simpleExit" title="Simple mode 끝내기 — 분할 화면(PC 모드)으로">PC 모드</button>`;
  const view = document.createElement('div'); view.id = 'simple-view';
  view.innerHTML = '<div id="simple-host"></div>';
  document.body.appendChild(bar); document.body.appendChild(view);
}
function simpleModeStart(k) {
  try { if (typeof _soloActive !== 'undefined' && _soloActive) exitSolo(); } catch (e) { _swallow(e); }
  _simpleEnsure();
  simpleOn = true;
  document.body.classList.add('simple-mode');
  simpleSet(k || window._simpleScr || 'pfd');
}
function simpleSet(k) {
  if (!SIMPLE_SCREENS.some(s => s[0] === k)) return;
  if (!simpleOn) { simpleModeStart(k); return; }
  window._simpleScr = k;
  try { applyPanels(); } catch (e) { _swallow(e); }
  document.querySelectorAll('#simple-bar [data-scr]').forEach(b => b.classList.toggle('on', b.dataset.scr === k));
  const kick = () => {
    try { window.dispatchEvent(new Event('resize')); } catch (e) { _swallow(e); }
    try { if (k === 'pfd' && typeof resizePFD === 'function') { resizePFD(); drawPFD(); } } catch (e) { _swallow(e); }
    try { if (k === 'cdu' && typeof scaleCdu === 'function') scaleCdu(); } catch (e) { _swallow(e); }
    try { if (k === 'map' && typeof leafMap !== 'undefined') leafMap.invalidateSize(); } catch (e) { _swallow(e); }
    try { if (k === 'sysp' && typeof sysDraw === 'function') sysDraw(); } catch (e) { _swallow(e); }
    try { if (k === 'grip' && typeof gripPanelRender === 'function') gripPanelRender(true); } catch (e) { _swallow(e); }
  };
  kick(); setTimeout(kick, 80); setTimeout(kick, 300);
}
function simpleExit() {
  simpleOn = false;
  window._simpleScr = null;
  document.body.classList.remove('simple-mode');
  try { applyPanels(); } catch (e) { _swallow(e); }
  try { sessionStorage.setItem('vfrStartMode', 'pc'); } catch (e) { _swallow(e); }
  setTimeout(() => { try { window.dispatchEvent(new Event('resize')); resizePFD(); } catch (e) { _swallow(e); } }, 60);
}


// ── Cockpit Mode ── 시작 화면에서 'Cockpit Mode' 를 고르면 3D 조종석으로 바로 들어간다:
//   3D 를 화면 가득(3D 단독) · 1인칭 조종석 시야 · 조종석 패널(MFD 넷 · 위아래 콘솔 · CDU — 15-heli3d.js)을 켠다.
//   종합판은 SIM 을 켠 채로 시작하고, 절차 훈련판은 SIM 없이(AFCS 로 나는 비행) 카메라가 조종석에 앉는다(05-gps.js _follow3d · ckCamOn).
//   화면을 누르면 그 화면이 가운데에 크게 뜬다. 오른쪽 위 'Split screen' 으로 끝낸다(분할 화면).
// (예전의 세로 칸 배치 Cockpit mode 와 '3D 단독 모드' 는 이것으로 합쳤다)
window._cockpitOn = false;
function cockpitStart() {
  try { if (typeof simpleOn !== 'undefined' && simpleOn) simpleExit(); } catch (e) { _swallow(e); }
  window._cockpitOn = true;
  try { if (!followMode) toggleFollow(); } catch (e) { _swallow(e); }          // 카메라가 헬기를 따라간다(지도도 1인칭)
  try { if (!mapHdgUp) toggleMapOrient(); } catch (e) { _swallow(e); }         // 지도는 기수 위(HDG↑)
  try { if (!(_soloActive && _soloCurrent === 'm3d')) panelSolo('m3d'); } catch (e) { _swallow(e); }
  try { if (typeof ckpitSet === 'function') ckpitSet(true); } catch (e) { _swallow(e); }
  // 종합판(shinesong)은 SIM 을 켠 채로 시작한다 — 절차 훈련판(SIM_ENABLED 거짓)은 SIM 없이 AFCS 로 나는 조종석 시야
  try { if ((typeof SIM_ENABLED === 'undefined' || SIM_ENABLED) && !simModeOn) toggleSimMode(true); } catch (e) { _swallow(e); }
  // (Cockpit Mode 를 시작해도 SOUND 는 켜지 않는다 — 처음엔 늘 꺼짐 · 16-sound.js)
  // 3D 캔버스 크기를 다시 잰다 — 조종석 틀 · 계기 칸이 늦게 자리 잡으면 캔버스 일부가 검은 상자로 남던 일(크기가 바뀌면 사라졌다)
  const kick = () => { try { if (_ml3d) { _ml3d.resize(); _follow3d(); _ml3d.triggerRepaint(); } } catch (e) { _swallow(e); } };
  kick(); setTimeout(kick, 200); setTimeout(kick, 800); setTimeout(kick, 2000);
}
// 오른쪽 창 탭의 '⛶ Cockpit Mode' — 들어가고(3D 조종석) · 나온다(분할)
function cockpitToggle() {
  if (_soloActive && _soloCurrent === 'm3d') { exitSolo(); return; }
  cockpitStart();
}
function cockpitExit() {
  if (!window._cockpitOn) return;
  window._cockpitOn = false;
  // SIM 이 아니면 1인칭 카메라를 풀어 지도처럼 내려다보게 되돌린다
  try { if (!simModeOn && typeof _ml3dSimCameraOff === 'function') _ml3dSimCameraOff(); } catch (e) { _swallow(e); }
  try { if (typeof heli3dNoseSync === 'function') heli3dNoseSync(null); } catch (e) { _swallow(e); }
  try { syncChinView(); } catch (e) { _swallow(e); }      // 축척 · 확대 버튼을 되살린다(#map3d.sim3d)
  // Simple 화면의 COCKPIT 으로 들어왔으면 그 Simple 화면으로 돌아간다
  if (_ckFromSimple) {
    const k = _ckFromSimple; _ckFromSimple = null;
    setTimeout(() => { try { simpleModeStart(k); sessionStorage.setItem('vfrStartMode', 'simple'); } catch (e) { _swallow(e); } }, 50);
    return;
  }
  try { sessionStorage.setItem('vfrStartMode', 'pc'); } catch (e) { _swallow(e); }
}
