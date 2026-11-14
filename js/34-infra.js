'use strict';
// ══════════════════════════════════════════════════════
// 34-infra.js — 앱 살림
//   ① 지도 아래 단추줄 — 좁으면 덜 쓰는 단추(CLR · T-CUT · HOLD · INHIB · N↑ · 🔒)를 ⋯ 뒤로 접는다
//   ② 진단 기록(🩺) — 삼킨 예외 · 화면 오류 · 타이머 · 저장 공간 · 바꾼 조정값을 한 화면에 · 복사
//   ③ 저장 공간 — 이 기기에서 쓰는 양(브라우저 할당 대비) · localStorage 항목별 크기
//   ④ 새 버전 알림 — 서비스 워커가 새 판을 받으면 '새 버전 — 새로고침' 띠를 띄운다
// ══════════════════════════════════════════════════════

// ── ① 지도 단추줄 ──
const MSB_SECOND = ['map-clr-btn', 'map-tcut-btn', 'map-hold-btn', 'inhib-btn', 'orient-btn', 'lock-btn'];
const MSB_MIN_W = 58;                        // 단추 하나가 이보다 좁아지면 접는다(px)
function _msbSecondary(bar) {
  return MSB_SECOND.map(id => document.getElementById(id)).filter(b => b && bar.contains(b));
}
function mapBarFit() {
  const bar = document.getElementById('map-sim-bar'); if (!bar) return;
  let more = document.getElementById('msb-more');
  if (!more) {
    more = document.createElement('button'); more.id = 'msb-more'; more.className = 'sim-btn'; more.textContent = '⋯';
    more.title = '나머지 단추(CLR · T-CUT · HOLD · INHIB · 방위 · 잠금)'; more.dataset.act = 'toggleMapBarMore';
    bar.appendChild(more);
    const br = document.createElement('span'); br.className = 'msb-br'; bar.appendChild(br);   // 펼치면 여기서 줄을 바꾼다
    _msbSecondary(bar).forEach(b => b.classList.add('msb-2'));
  }
  const w = bar.clientWidth; if (!w) return;
  bar.classList.remove('compact');
  const shown = [...bar.querySelectorAll('.sim-btn')].filter(b => b.id !== 'msb-more' && getComputedStyle(b).display !== 'none').length;
  const compact = shown > 0 && w / shown < MSB_MIN_W;
  bar.classList.toggle('compact', compact);
  if (!compact) bar.classList.remove('more');
}
function toggleMapBarMore() {
  const bar = document.getElementById('map-sim-bar'); if (!bar) return;
  bar.classList.toggle('more');
  const m = document.getElementById('msb-more'); if (m) m.classList.toggle('on', bar.classList.contains('more'));
}
(function mapBarWatch() {
  const go = () => { try { mapBarFit(); } catch (e) { _swallow(e); } };
  const bar = document.getElementById('map-sim-bar');
  if (bar && typeof ResizeObserver === 'function') new ResizeObserver(go).observe(bar);
  window.addEventListener('resize', go);
  setTimeout(go, 0);
})();

// ── ② 진단 기록 ──
const _DIAG_ERR = [];                        // 잡히지 않은 오류(화면 오류 · 약속 거절)
window.addEventListener('error', e => { _DIAG_ERR.push({ t: Date.now(), msg: (e && e.message) || String(e), at: e && e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : '' }); if (_DIAG_ERR.length > 100) _DIAG_ERR.shift(); });
window.addEventListener('unhandledrejection', e => { const r = e && e.reason; _DIAG_ERR.push({ t: Date.now(), msg: '약속 거절: ' + ((r && r.message) || String(r)), at: '' }); if (_DIAG_ERR.length > 100) _DIAG_ERR.shift(); });
function diagReport() {
  const ver = (() => { const s = [...document.scripts].map(x => x.src).find(u => /\?v=\d+/.test(u)); return s ? 'v' + s.match(/\?v=(\d+)/)[1] : '?'; })();
  return {
    ver, ac: typeof AC_TYPE !== 'undefined' ? AC_TYPE : '', edition: typeof EDITION !== 'undefined' ? EDITION : '',
    ua: navigator.userAgent, at: new Date().toISOString(),
    swallowed: typeof _swallowSummary === 'function' ? _swallowSummary().slice(0, 30) : [],
    recent: typeof _swallowed === 'function' ? _swallowed().slice(-20) : [],
    errors: _DIAG_ERR.slice(-20),
    timers: typeof schedStats === 'function' ? schedStats() : null,
    tune: typeof tuneDiff === 'function' ? tuneDiff() : {},
    storage: storageLocalSizes(),
  };
}
function diagText(r) {
  r = r || diagReport();
  const L = [`shinesong 진단 기록 · ${r.at} · ${r.ver} · ${r.ac} · ${r.edition}`, r.ua, ''];
  L.push(`[화면 오류 ${r.errors.length}]`); r.errors.forEach(e => L.push(`  ${new Date(e.t).toLocaleTimeString()} ${e.msg} ${e.at}`));
  L.push(`[삼킨 예외 — 종류별 ${r.swallowed.length}]`); r.swallowed.forEach(([m, n]) => L.push(`  ${n}× ${m}`));
  L.push(`[최근 삼킨 예외 ${r.recent.length}]`); r.recent.forEach(e => L.push(`  ${new Date(e.t).toLocaleTimeString()} ${e.msg} ${e.at}`));
  if (r.timers) { L.push(`[타이머 ${r.timers.tasks}개 · 박자 ${r.timers.ticks}]`); r.timers.list.forEach(t => L.push(`  ${t.ms}ms ${t.name} · ${t.n}회 · 평균 ${t.avgMs}ms${t.err ? ' · 오류 ' + t.err : ''}`)); }
  const td = Object.entries(r.tune); L.push(`[바꾼 조정값 ${td.length}]`); td.forEach(([k, v]) => L.push(`  ${k} = ${v}`));
  L.push('[localStorage]'); r.storage.forEach(([k, n]) => L.push(`  ${k} ${_kb(n)}`));
  return L.join('\n');
}
function _kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : (n / 1024).toFixed(1) + 'KB'; }
function _dgEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function toggleDiag() {
  let w = document.getElementById('diag-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'diag-wrap'; document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-diag]'); if (!b) return;
      const k = b.dataset.diag;
      if (k === 'x') w.style.display = 'none';
      else if (k === 'copy') { const t = diagText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => uiToast('진단 기록을 복사했습니다 — 개발자에게 붙여 보내십시오'), () => { const ta = w.querySelector('textarea'); if (ta) { ta.style.display = 'block'; ta.value = t; ta.select(); } }); }
      else if (k === 'clear') { if (typeof _SWALLOW_LOG !== 'undefined') _SWALLOW_LOG.length = 0; _DIAG_ERR.length = 0; _diagRender(); }
      else if (k === 'tune') { tuneReset(); uiToast('조정값을 기본으로 돌렸습니다 — 다시 열면 반영됩니다'); }
      else if (k === 'refresh') _diagRender();
    });
  }
  w.style.display = 'flex'; _diagRender();
}
function _diagRender() {
  const w = document.getElementById('diag-wrap'); if (!w) return;
  const r = diagReport(), td = Object.entries(r.tune);
  const row = (a, b) => `<div class="set-row"><span>${a}</span><div>${b}</div></div>`;
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>🩺 진단 기록</b><button class="sim-btn" data-diag="x">✕</button></div>
    ${row('판 · 기종', `${_dgEsc(r.ver)} · ${_dgEsc(r.ac)} · ${_dgEsc(r.edition)}`)}
    ${row('저장 공간', '<span id="diag-quota">재는 중…</span>')}
    ${row('저장 비행', `${typeof fdrSavedList === 'function' ? fdrSavedList().length : 0}개 · ${typeof _fdrIdb !== 'undefined' && _fdrIdb ? 'IndexedDB' : 'localStorage'}`)}
    ${row('타이머', r.timers ? `${r.timers.tasks}개를 한 박자로 · 오류 ${r.timers.list.reduce((a, t) => a + t.err, 0)}` : '—')}
    ${row('바꾼 조정값', td.length ? td.map(([k, v]) => `${_dgEsc(k)}=${_dgEsc(v)}`).join(' · ') + ' <button class="sim-btn" data-diag="tune">기본으로</button>' : '없음(00-params.js 기본)')}
    <div class="diag-h">화면 오류 ${r.errors.length}</div>
    <div class="diag-list">${r.errors.slice().reverse().map(e => `<div>${new Date(e.t).toLocaleTimeString()} · ${_dgEsc(e.msg)} <i>${_dgEsc(e.at)}</i></div>`).join('') || '<div class="diag-ok">없음</div>'}</div>
    <div class="diag-h">삼킨 예외(앱은 계속 돈다) — 종류별</div>
    <div class="diag-list">${r.swallowed.map(([m, n]) => `<div><b>${n}×</b> ${_dgEsc(m)}</div>`).join('') || '<div class="diag-ok">없음</div>'}</div>
    <div class="set-row"><span></span><div><button class="sim-btn" data-diag="refresh">새로</button><button class="sim-btn" data-diag="copy">📋 복사</button><button class="sim-btn" data-diag="clear">지우기</button></div></div>
    <textarea readonly style="display:none"></textarea></div>`;
  storageEstimate().then(q => { const el = document.getElementById('diag-quota'); if (el) el.textContent = storageText(q); });
}

// ── ③ 저장 공간 ──
function storageLocalSizes() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.push([k, (k.length + (localStorage.getItem(k) || '').length) * 2]); } } catch (e) { _swallow(e); }
  return out.sort((a, b) => b[1] - a[1]);
}
async function storageEstimate() {
  const ls = storageLocalSizes().reduce((a, [, n]) => a + n, 0);
  let usage = null, quota = null;
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); usage = e.usage; quota = e.quota; } } catch (e) { _swallow(e); }
  return { ls, usage, quota };
}
function storageText(q) {
  const a = [`설정 등(localStorage) ${_kb(q.ls)} / 약 5MB`];
  if (q.usage != null && q.quota) a.push(`전체 ${_kb(q.usage)} / ${_kb(q.quota)} (${(q.usage / q.quota * 100).toFixed(1)}%)`);
  return a.join(' · ');
}

// ── ④ 새 버전 알림 ──
function swUpdateBanner() {
  if (document.getElementById('sw-update')) return;
  const b = document.createElement('div'); b.id = 'sw-update';
  b.innerHTML = '새 버전이 있습니다 <button class="sim-btn" data-sw="reload">새로고침</button><button class="sim-btn" data-sw="x">나중에</button>';
  b.addEventListener('click', e => {
    const k = e.target.closest('[data-sw]'); if (!k) return;
    if (k.dataset.sw === 'reload') location.reload(); else b.remove();
  });
  document.body.appendChild(b);
}
(function swWatch() {
  if (!('serviceWorker' in navigator)) return;
  const had = !!navigator.serviceWorker.controller;           // 처음 여는 것이면(조종하는 워커가 없으면) 알리지 않는다
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) swUpdateBanner(); });
  // 오래 켜 두는 기기 — 30분마다 새 판이 있는지 물어본다
  setInterval(() => { try { navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}); } catch (e) { _swallow(e); } }, 30 * 60 * 1000);
})();

// ── ⑤ 교관 교범(docs/instructor-manual.html · 인쇄하면 PDF) ──
function openManual() { try { uiOpenExternal('docs/instructor-manual.html'); } catch (e) { _swallow(e); } }
try { appRegister({ toggleMapBarMore, toggleDiag, openManual }); } catch (e) { _swallow(e); }
