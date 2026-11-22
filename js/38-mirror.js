'use strict';
// ══════════════════════════════════════════════════════
// 38-mirror.js — 같은 화면을 여러 곳에(거울 창)
//   화면(PFD · CDU · UPPER · LOWER · SYSTEM …)은 DOM 하나라 한 자리에만 있을 수 있었다 — 그래서
//   · 두 창(패널)에 같은 화면을 고르면 서로 맞바꿨고
//   · 3D 조종석의 작은 콘솔 · CDU 칸은 그 화면이 다른 창(분할 창 · SIM Mode 새 창)에 있으면 비었다(조종석만 띄운 Cockpit Mode 에서만 다 보였다).
//   이제 진짜 화면은 한 자리(07-sim.js applyPanels 가 고른 곳)에 두고, 나머지 자리에는 '거울'을 띄운다:
//   · 그 자리의 iframe 에 화면을 그대로 복제(스타일 · 글자 · 캔버스 그림)해 보이고, 바뀌면 곧바로 다시 복제한다
//   · 거울을 누르면(포인터 · 클릭 · 휠 · 키) 진짜 화면의 같은 요소 · 같은 자리에 그대로 전한다 — 버튼 · 노브 · 키보드가 듣는다
//   · 크기는 진짜 화면 모양 그대로 그 자리에 맞춰 줄이거나 키운다
// ══════════════════════════════════════════════════════
const MIRROR_OK = new Set(['pfd', 'cdu', 'plan', 'ovhd', 'lcon', 'sysp', 'grip']);   // 거울로 띄울 수 있는 화면(지도 · 3D 는 제 창마다 따로 그린다)
const _mirrors = new Map();      // 그릇(host) → { k, src, box, ifr, doc, stage, clone, dirty, mo, srcCv, cv }
const MIRROR_EV = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'];

// 원하는 거울 목록 — [{ host, k, src, passive }](passive — 보이기만 · 누름은 그릇이 받는다) · 목록에 없는 거울은 거둔다(07-sim.js applyPanels 가 부른다)
function mirrorSync(list) {
  const keep = new Set();
  for (const w of list || []) {
    if (!w || !w.host || !w.src || w.host.contains(w.src)) continue;
    keep.add(w.host);
    const r = _mirrors.get(w.host);
    if (r && r.src === w.src) { r.box.classList.toggle('passive', !!w.passive); continue; }
    if (r) _mirrorDrop(w.host);
    _mirrorMake(w.host, w.k, w.src);
    _mirrors.get(w.host).box.classList.toggle('passive', !!w.passive);
  }
  for (const h of [..._mirrors.keys()]) if (!keep.has(h)) _mirrorDrop(h);
}
function mirrorList() { return [..._mirrors.values()].map(r => ({ k: r.k, host: r.host.id || r.host.className, src: r.src.id })); }
function _mirrorDrop(host) {
  const r = _mirrors.get(host); if (!r) return;
  _mirrors.delete(host);
  try { r.mo.disconnect(); } catch (e) { _swallow(e); }
  try { r.box.remove(); } catch (e) { _swallow(e); }
}
function _mirrorMake(host, k, src) {
  const box = document.createElement('div'); box.className = 'mirror-box'; box.dataset.k = k;
  box.title = '거울 창 — 같은 화면을 이 자리에도 보인다(누르면 그대로 듣는다)';
  const ifr = document.createElement('iframe'); ifr.className = 'mirror-ifr'; ifr.setAttribute('aria-label', k + ' 거울');
  box.appendChild(ifr); host.appendChild(box);
  const doc = ifr.contentDocument;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><base href="' + String(location.href).replace(/"/g, '&quot;') + '"></head>' +
            '<body><div id="mir-stage"></div></body></html>');
  doc.close();
  Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach(n => doc.head.appendChild(doc.importNode(n, true)));
  const st = doc.createElement('style');
  st.textContent = 'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}' +
    '#mir-stage{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}' +
    '#mir-stage>*{position:relative !important;left:0 !important;top:0 !important;width:100% !important;height:100% !important;display:block !important;margin:0 !important;transform:none !important}';
  doc.head.appendChild(st);
  const r = { k, src, host, box, ifr, doc, stage: doc.getElementById('mir-stage'), clone: null, dirty: true, srcCv: [], cv: [], w: 0, h: 0, f: 1, ox: 0, oy: 0 };
  r.mo = new MutationObserver(() => { r.dirty = true; });
  r.mo.observe(src, { subtree: true, childList: true, attributes: true, characterData: true });
  // 누름 · 키를 진짜 화면으로
  MIRROR_EV.forEach(t => doc.addEventListener(t, e => _mirrorFwd(r, e), { capture: true, passive: false }));
  ['keydown', 'keyup'].forEach(t => doc.addEventListener(t, e => {
    try { document.dispatchEvent(new KeyboardEvent(t, { key: e.key, code: e.code, keyCode: e.keyCode, which: e.which, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat, bubbles: true, cancelable: true })); } catch (er) { _swallow(er); }
    e.preventDefault();
  }, true));
  _mirrors.set(host, r);
  _mirrorRender(r);
}
// 진짜 화면을 다시 복제(글자 · 속성이 바뀌었을 때) — id 는 그대로 둔다(거울은 제 문서라 본 문서의 id 와 겹치지 않는다)
function _mirrorClone(r) {
  const c = r.src.cloneNode(true);
  c.classList.remove('page-hidden');
  r.stage.replaceChildren(r.doc.importNode(c, true));
  r.clone = r.stage.firstElementChild;
  r.srcCv = Array.from(r.src.querySelectorAll('canvas')); r.cv = Array.from(r.clone.querySelectorAll('canvas'));
  // 입력칸의 지금 값(속성이 아닌 값)
  const si = r.src.querySelectorAll('input, select, textarea'), ci = r.clone.querySelectorAll('input, select, textarea');
  si.forEach((e, i) => { try { if (ci[i]) { ci[i].value = e.value; if ('checked' in e) ci[i].checked = e.checked; } } catch (er) { _swallow(er); } });
  r.dirty = false;
}
function _mirrorRender(r) {
  if (!r.box.isConnected) return;
  const hw = r.box.clientWidth, hh = r.box.clientHeight;
  if (!(hw > 4 && hh > 4)) return;                                   // 그릇이 보이지 않으면 쉰다
  const sr = r.src.getBoundingClientRect();
  // 진짜 화면 크기(보이지 않으면 마지막에 잰 크기 · 그것도 없으면 그릇 크기)
  let w = sr.width, h = sr.height;
  if (!(w > 4 && h > 4)) { w = r.w || hw; h = r.h || hh; } else { r.w = w; r.h = h; }
  if (r.dirty || !r.clone) _mirrorClone(r);
  const f = Math.min(hw / w, hh / h), ox = (hw - w * f) / 2, oy = (hh - h * f) / 2;
  if (f !== r.f || ox !== r.ox || oy !== r.oy || r.stage.style.width !== w + 'px' || r.stage.style.height !== h + 'px') {
    r.f = f; r.ox = ox; r.oy = oy;
    Object.assign(r.stage.style, { width: w + 'px', height: h + 'px', transform: `translate(${ox}px,${oy}px) scale(${f})` });
  }
  // 캔버스 그림(PFD · SYSTEM · 콘솔 계기 …)
  for (let i = 0; i < r.srcCv.length && i < r.cv.length; i++) {
    const a = r.srcCv[i], b = r.cv[i];
    if (!(a.width > 0 && a.height > 0)) continue;
    if (b.width !== a.width) b.width = a.width;
    if (b.height !== a.height) b.height = a.height;
    try { const g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, b.width, b.height); g.drawImage(a, 0, 0); } catch (e) { _swallow(e); }
  }
}
// 거울의 요소 → 진짜 화면의 같은 자리 요소(자식 차례를 따라간다)
function _mirrorTarget(r, el) {
  const path = [];
  let n = el;
  while (n && n !== r.clone) { const p = n.parentElement; if (!p) return null; path.push(Array.prototype.indexOf.call(p.children, n)); n = p; }
  if (n !== r.clone) return null;
  let t = r.src;
  for (let i = path.length - 1; i >= 0; i--) { t = t.children[path[i]]; if (!t) return null; }
  return t;
}
function _mirrorFwd(r, e) {
  if (e.type === 'pointermove' && !e.buttons) return;
  const t = _mirrorTarget(r, e.target); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  // 거울 속 자리(배율 · 여백을 걷어 낸 화면 비율) → 진짜 화면의 같은 비율 자리
  const sr = r.src.getBoundingClientRect(), fx = (e.clientX - r.ox) / Math.max(1e-6, r.f) / Math.max(1, r.w), fy = (e.clientY - r.oy) / Math.max(1e-6, r.f) / Math.max(1, r.h);
  const x = sr.left + fx * sr.width, y = sr.top + fy * sr.height;
  const V = (t.ownerDocument && t.ownerDocument.defaultView) || window;
  const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: e.button, buttons: e.buttons,
                 shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, detail: e.detail };
  let ev;
  try {
    if (e.type.startsWith('pointer')) ev = new V.PointerEvent(e.type, { ...base, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, width: e.width, height: e.height, pressure: e.pressure });
    else if (e.type === 'wheel') ev = new V.WheelEvent('wheel', { ...base, deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode });
    else ev = new V.MouseEvent(e.type, base);
  } catch (er) { _swallow(er); return; }
  try { t.dispatchEvent(ev); } catch (er) { _swallow(er); }
  r.dirty = true;
}
// 거울을 그린다 — 10번/초(진짜 화면이 바뀌었으면 다시 복제 · 캔버스는 늘 옮긴다)
setInterval(() => {
  for (const [h, r] of _mirrors) {
    if (!h.isConnected || !r.src.isConnected) { _mirrorDrop(h); continue; }
    try { _mirrorRender(r); } catch (e) { _swallow(e); }
  }
}, 100);
// (글꼴 · 스타일이 늦게 붙는 화면 — 처음 몇 초는 1초마다 다시 복제)
setInterval(() => { for (const r of _mirrors.values()) if (!r.clone || performance.now() - (r._t0 || (r._t0 = performance.now())) < 5000) r.dirty = true; }, 1000);
(function _mirrorCss() {
  const st = document.createElement('style');
  st.textContent = '.mirror-box{position:relative;flex:1 1 auto;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden;background:#000}' +
                   '.mirror-ifr{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#000}' +
                   '.mirror-box.passive .mirror-ifr{pointer-events:none}';   // 조종석 작은 칸 — 보이기만(누르면 그 칸이 크게 뜬다 · 15-heli3d.js toggleConsolePop)
  (document.head || document.documentElement).appendChild(st);
})();
