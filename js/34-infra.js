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
// 파일 → 기능 이름(진단 기록에서 '어느 기능에서 몇 번' 으로 읽히게)
const DIAG_FILE_LABEL = {
  '00-aircraft': '기종', '00-edition': '판', '00-gate': '시작 잠금', '00-params': '조정값', '00-popout': '창 띄우기', '00-sched': '타이머', '00-ui': '대화상자',
  '01-state': '상태 · 저장', '02-math': '계산', '03-pfd': 'PFD', '04-map': '지도', '05-gps': 'GPS · 3D 카메라', '06-nav': '항법', '07-sim': '화면 배치',
  '08-ifrdb': '계기 절차 자료', '09-cdu': 'CDU', '09a-start': '출발 공항', '09b-cdu-screens': 'CDU 화면', '10-tools': '도구', '11-charts': '차트',
  '12-joystick': '조이스틱', '13-joyhid': '조이스틱(HID)', '14-simmode': 'SIM 비행 모델', '15-heli3d': '3D 모형 · 조종석', '16-sound': '소리',
  '17-upper': '상부 콘솔', '18-system': 'SYSTEM · 전기', '19-lower': '하부 콘솔', '20-navaids': '항행시설', '21-c5000': 'C-5000 무전', '22-npx138': 'NPX138',
  '23-afcs': 'AFCS', '24-sar': 'SAR', '25-b206panel': 'Bell 계기판', '26-b206radio': 'Bell 무전', '27-b206coll': 'Bell 컬렉티브', '28-debrief': '강평 · FDR',
  '29-env': '환경 · 불빛', '30-scenario': '시나리오', '31-ios': '교관 화면', '32-callout': '음성 호출', '33-train4': '교통 · 훈련', '34-infra': '진단 · 저장',
  '35-kuhgrip': '컬렉티브 · 사이클릭 그림', '36-kuhsys': 'KUH 계통', '37-mission': '전탐석 · 레이더', '37a-dvr': '전탐석 녹화기', '37b-msnview': '전탐석 화면 · Vendor',
  '38-mirror': '교관 미러', '39-train5': 'IIMC · BINGO · 교신', '40-crew': '부조종사 · 협동 자산 · 협동 비행', '41-atc': 'ATC 관제석',
};
function diagFileLabel(f) { const k = String(f).replace(/^js\//, '').replace(/\.js$/, ''); return DIAG_FILE_LABEL[k] || k; }
// 반복 고장 의심 — 10초 동안 한 파일에서 100번 넘게 삼키면(매 프레임 터지는 숨은 고장) 화면 오류 목록에 한 번 남긴다(5분에 한 번)
const DIAG_SPIKE_N = 100, DIAG_SPIKE_MS = 10000, DIAG_SPIKE_QUIET = 300000;
const _diagSpikePrev = {}, _diagSpikeAt = {};
function diagSpikeCheck(now = Date.now()) {
  if (typeof _swallowByFile !== 'function') return [];
  const hit = [];
  for (const r of _swallowByFile()) {
    const d = r.n - (_diagSpikePrev[r.file] || 0); _diagSpikePrev[r.file] = r.n;
    if (d > DIAG_SPIKE_N && !(now - (_diagSpikeAt[r.file] || -Infinity) < DIAG_SPIKE_QUIET)) {
      _diagSpikeAt[r.file] = now; hit.push(r.file);
      const top = r.top[0];
      _DIAG_ERR.push({ t: now, msg: `반복 고장 의심 — ${diagFileLabel(r.file)}: 10초에 ${d}번${top ? ` (${top.msg})` : ''}`, at: top ? `${r.file.replace(/^js\//, '')}:${top.line}` : r.file });
      if (_DIAG_ERR.length > 100) _DIAG_ERR.shift();
    }
  }
  return hit;
}
setInterval(() => { try { diagSpikeCheck(); } catch (e) { /* 진단이 진단을 부르지 않게 */ } }, DIAG_SPIKE_MS);
// 지금 살아 있는 3D 지도(WebGL 문맥) — 이름 · 화면에 보이는가. 기기마다 문맥 수에 한계(보통 8~16)가 있어 넘으면 오래된 것부터 끊긴다
function maps3dLive() {
  const L = [];
  const add = (name, f, shown) => { try { const m = f(); if (m && m.getCanvas) { const c = m.getCanvas(); L.push({ name, shown: !!shown(m), w: c.width, h: c.height }); } } catch (e) { /* 없다 */ } };
  const vis = m => { const el = m.getContainer(); return !!el && el.offsetParent !== null && el.clientWidth > 20 && el.getBoundingClientRect().left > -500; };
  add('메인 3D', () => _ml3d, m => typeof _map3dShown === 'function' ? _map3dShown() : vis(m));
  add('EO/IR', () => _eoMap, vis);
  add('전탐석 항법지도', () => _nvMap, vis);
  add('호이스트 카메라', () => _sarCam.map, () => typeof _sarCam !== 'undefined' && _sarCam.mode === 'on');
  return L;
}
function diagReport() {
  const ver = (() => { const s = [...document.scripts].map(x => x.src).find(u => /\?v=\d+/.test(u)); return s ? 'v' + s.match(/\?v=(\d+)/)[1] : '?'; })();
  return {
    ver, ac: typeof AC_TYPE !== 'undefined' ? AC_TYPE : '', edition: typeof EDITION !== 'undefined' ? EDITION : '',
    ua: navigator.userAgent, at: new Date().toISOString(),
    swallowed: typeof _swallowSummary === 'function' ? _swallowSummary().slice(0, 30) : [],
    byFile: typeof _swallowByFile === 'function' ? _swallowByFile() : [], swallowN: typeof _SWALLOW_N !== 'undefined' ? _SWALLOW_N : 0,
    recent: typeof _swallowed === 'function' ? _swallowed().slice(-20) : [],
    errors: _DIAG_ERR.slice(-20),
    timers: typeof schedStats === 'function' ? schedStats() : null,
    tune: typeof tuneDiff === 'function' ? tuneDiff() : {},
    storage: storageLocalSizes(),
    maps: maps3dLive(),
  };
}
function diagText(r) {
  r = r || diagReport();
  const L = [`shinesong 진단 기록 · ${r.at} · ${r.ver} · ${r.ac} · ${r.edition}`, r.ua, ''];
  L.push(`[화면 오류 ${r.errors.length}]`); r.errors.forEach(e => L.push(`  ${new Date(e.t).toLocaleTimeString()} ${e.msg} ${e.at}`));
  L.push(`[삼킨 예외 — 기능별 누적 ${r.swallowN}회]`); r.byFile.forEach(f => L.push(`  ${f.n}× ${diagFileLabel(f.file)}(${f.file}) — ${f.top.map(x => `${x.line}줄 ${x.n}× ${x.msg}`).join(' · ')}`));
  L.push(`[삼킨 예외 — 종류별 ${r.swallowed.length}]`); r.swallowed.forEach(([m, n]) => L.push(`  ${n}× ${m}`));
  L.push(`[최근 삼킨 예외 ${r.recent.length}]`); r.recent.forEach(e => L.push(`  ${new Date(e.t).toLocaleTimeString()} ${e.msg} ${e.at}`));
  if (r.timers) { L.push(`[타이머 ${r.timers.tasks}개 · 박자 ${r.timers.ticks}]`); r.timers.list.forEach(t => L.push(`  ${t.ms}ms ${t.name} · ${t.n}회 · 평균 ${t.avgMs}ms${t.err ? ' · 오류 ' + t.err : ''}`)); }
  L.push(`[3D 지도 ${r.maps.length}]`); r.maps.forEach(m => L.push(`  ${m.name} ${m.shown ? '보임' : '숨김'} ${m.w}×${m.h}`));
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
      else if (k === 'clear') { if (typeof _SWALLOW_LOG !== 'undefined') _SWALLOW_LOG.length = 0; if (typeof _SWALLOW_BY !== 'undefined') { Object.keys(_SWALLOW_BY).forEach(k2 => delete _SWALLOW_BY[k2]); _SWALLOW_N = 0; Object.keys(_diagSpikePrev).forEach(k2 => delete _diagSpikePrev[k2]); } _DIAG_ERR.length = 0; _diagRender(); }
      else if (k === 'tune') { tuneReset(); uiToast('조정값을 기본으로 돌렸습니다 — 다시 열면 반영됩니다'); }
      else if (k === 'refresh') _diagRender();
      else if (k === 'offline') { b.disabled = true; b.textContent = '받는 중…'; offlinePrepare().then(r => { uiToast(r.missing.length ? `${r.missing.length}개를 받지 못했습니다(인터넷 확인)` : '오프라인 준비 완료 — 인터넷 없이도 앱이 열립니다'); _diagRender(); }); }
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
    ${row('오프라인 준비', '<span id="diag-offline">확인 중…</span> <button class="sim-btn" data-diag="offline">지금 모두 받아 두기</button>')}
    ${row('저장 비행', `${typeof fdrSavedList === 'function' ? fdrSavedList().length : 0}개 · ${typeof _fdrIdb !== 'undefined' && _fdrIdb ? 'IndexedDB' : 'localStorage'}`)}
    ${row('3D 지도(WebGL)', r.maps.length ? r.maps.map(m => `${m.name} <i>${m.shown ? '보임' : '숨김'} · ${m.w}×${m.h}</i>`).join(' · ') + ' — 숨은 EO/IR · 전탐석 지도 · 호이스트 카메라는 몇 초 뒤 저절로 거둡니다' : '없음')}
    ${row('타이머', r.timers ? `${r.timers.tasks}개를 한 박자로 · 오류 ${r.timers.list.reduce((a, t) => a + t.err, 0)}` : '—')}
    ${row('바꾼 조정값', td.length ? td.map(([k, v]) => `${_dgEsc(k)}=${_dgEsc(v)}`).join(' · ') + ' <button class="sim-btn" data-diag="tune">기본으로</button>' : '없음(00-params.js 기본)')}
    <div class="diag-h">화면 오류 ${r.errors.length}</div>
    <div class="diag-list">${r.errors.slice().reverse().map(e => `<div>${new Date(e.t).toLocaleTimeString()} · ${_dgEsc(e.msg)} <i>${_dgEsc(e.at)}</i></div>`).join('') || '<div class="diag-ok">없음</div>'}</div>
    <div class="diag-h">삼킨 예외 — 기능별 누적 ${r.swallowN}회(많은 것이 숨은 고장)</div>
    <div class="diag-list">${r.byFile.slice(0, 15).map(f => `<div><b>${f.n}×</b> ${_dgEsc(diagFileLabel(f.file))} <i>${_dgEsc(f.file.replace(/^js\//, ''))}</i>${f.top.length ? ` — ${f.top.map(x => `${_dgEsc(x.line)}줄 ${x.n}× ${_dgEsc(x.msg)}`).join(' · ')}` : ''}</div>`).join('') || '<div class="diag-ok">없음</div>'}</div>
    <div class="diag-h">삼킨 예외(앱은 계속 돈다) — 종류별(최근 200건)</div>
    <div class="diag-list">${r.swallowed.map(([m, n]) => `<div><b>${n}×</b> ${_dgEsc(m)}</div>`).join('') || '<div class="diag-ok">없음</div>'}</div>
    <div class="set-row"><span></span><div><button class="sim-btn" data-diag="refresh">새로</button><button class="sim-btn" data-diag="copy">📋 복사</button><button class="sim-btn" data-diag="clear">지우기</button></div></div>
    <textarea readonly style="display:none"></textarea></div>`;
  storageEstimate().then(q => { const el = document.getElementById('diag-quota'); if (el) el.textContent = storageText(q); });
  offlineCheck().then(r => { const el = document.getElementById('diag-offline'); if (el) el.textContent = r.cache ? (r.missing.length ? `${r.total - r.missing.length}/${r.total} — ${r.missing.length}개 아직 없음` : `준비됨(${r.total}개)`) : '서비스 워커 캐시 없음(처음 열었거나 지원 안 함)'; });
}

// ── 계기 보호 — 비행 값(S.*)이 계산 오류로 숫자가 아니게(NaN · 무한) 되면 계기 · 3D 가 통째로 멎는다.
//   0.1초마다 보고 깨진 값은 마지막 정상 값으로 되돌리고 진단 기록에 남긴다(한 번만 알림) ──
const INST_GUARD_KEYS = ['lat', 'lon', 'alt', 'spd', 'hdg', 'vs', 'pit', 'bnk', 'tq'];
let _instGood = null, instGuardHits = 0, _instGuardToast = 0;
function instGuardCheck() {
  if (typeof S === 'undefined') return 0;
  const bad = INST_GUARD_KEYS.filter(k => k in S && !Number.isFinite(S[k]));
  if (!bad.length) { _instGood = {}; INST_GUARD_KEYS.forEach(k => { if (k in S) _instGood[k] = S[k]; }); return 0; }
  bad.forEach(k => { S[k] = _instGood && Number.isFinite(_instGood[k]) ? _instGood[k] : 0; });
  instGuardHits++;
  _DIAG_ERR.push({ t: Date.now(), msg: `계기 보호 — 숫자가 아닌 값을 되돌림(${bad.join(' · ')})`, at: 'instGuard' }); if (_DIAG_ERR.length > 100) _DIAG_ERR.shift();
  if (Date.now() - _instGuardToast > 30000) { _instGuardToast = Date.now(); try { uiToast(`계기 보호 — 잘못된 비행 값(${bad.join(' · ')})을 직전 값으로 되돌렸습니다(🩺 진단 기록)`, 'warn', 4000); } catch (e) { _swallow(e); } }
  return bad.length;
}
setInterval(() => { try { instGuardCheck(); } catch (e) { _swallow(e); } }, 100);

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

// ── 오프라인 준비 — 서비스 워커의 앱 파일 목록(sw.js CORE)이 모두 캐시에 있는지 · 없으면 지금 받아 둔다 ──
//   (QR 읽기 jsQR · QR 만들기 · 교관 교범까지. 관제 음성은 기기에 깔린 목소리라 인터넷이 없어도 된다)
async function _swCore() {
  const t = await (await fetch('sw.js', { cache: 'no-store' })).text();
  const name = (t.match(/const CACHE\s*=\s*'([^']+)'/) || [])[1];
  const core = (t.match(/const CORE\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1].match(/'\.\/[^']*'/g) || [];
  return { name, core: core.map(x => x.slice(1, -1)) };
}
async function offlineCheck() {
  try {
    if (!('caches' in window)) return { cache: false, total: 0, missing: [] };
    const { name, core } = await _swCore();
    if (!name || !(await caches.has(name))) return { cache: false, total: core.length, missing: core };
    const c = await caches.open(name), missing = [];
    for (const u of core) if (!(await c.match(u))) missing.push(u);
    return { cache: true, name, total: core.length, missing };
  } catch (e) { _swallow(e); return { cache: false, total: 0, missing: [] }; }
}
async function offlinePrepare() {
  try {
    const { name, core } = await _swCore(); const c = await caches.open(name), missing = [];
    for (const u of core) { try { const r = await fetch(u, { cache: 'reload' }); if (r && r.ok) await c.put(u, r); else missing.push(u); } catch (e) { missing.push(u); } }
    return { missing };
  } catch (e) { _swallow(e); return { missing: ['(캐시를 쓸 수 없음)'] }; }
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
  const ask = () => { try { navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}); } catch (e) { _swallow(e); } };
  setInterval(ask, 30 * 60 * 1000);
  // 다시 이 앱으로 돌아올 때(태블릿을 다시 켜거나 탭을 고를 때)도 물어본다 — 10분에 한 번까지
  let lastAsk = 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastAsk > 10 * 60 * 1000) { lastAsk = Date.now(); ask(); } });
  // 이미 받아 둔 새 판이 기다리고 있으면(다른 탭이 잡고 있어 아직 바뀌지 않음) 곧바로 알린다
  try { navigator.serviceWorker.getRegistration().then(r => { if (r && r.waiting && had) swUpdateBanner(); }).catch(() => {}); } catch (e) { _swallow(e); }
})();

// ── ⑤ 교관 교범(docs/instructor-manual.html · 인쇄하면 PDF) ──
function openManual() { try { uiOpenExternal('docs/instructor-manual.html'); } catch (e) { _swallow(e); } }
try { appRegister({ toggleMapBarMore, toggleDiag, openManual }); } catch (e) { _swallow(e); }

// ── 작전 구역 지도 미리 받기(오프라인) ──
//   지금 자리(또는 고른 곳) 둘레 반경 R NM 의 위성 사진(8~14 단계)과 3D 지형(8~12 단계)을 받아 서비스 워커의
//   타일 캐시에 넣는다 — 바다 위 · 섬 · 산간처럼 인터넷이 끊겨도 2D · 3D 지도와 조종석 MFD 지도가 뜬다.
//   더 자세한 단계(15~19)는 받지 않는다 — 없으면 3D 가 위 단계 사진을 늘려 메운다(04-map.js).
//   타일 서버 부담을 생각해 한 번에 TILE_PREP_MAX 장까지 · 6장씩 나눠 받는다. OSM(지도) 타일은 그 쪽 이용 정책상 받지 않는다.
const TILE_PREP_MAX = 4000, TILE_PREP_CONC = 6, TILE_PREP_KB = 22;   // 한 장 평균 크기(어림 · 진행 표시용)
const TILE_SAT_CACHE = 'vfr-sat-tiles', TILE_DEM_CACHE = 'vfr-dem-tiles';
const TILE_SAT_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const TILE_DEM_BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
function _tpXY(lat, lon, z) {
  const n = 2 ** z, la = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180;
  return { x: Math.floor((lon + 180) / 360 * n), y: Math.floor((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n) };
}
// 받을 목록 — 가까운 것부터(넓은 단계 먼저)
function tilesAreaList(lat, lon, nm, { satMin = 8, satMax = 14, demMin = 8, demMax = 12 } = {}) {
  const dLat = nm / 60, dLon = nm / 60 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const out = [];
  const add = (kind, z0, z1) => {
    for (let z = z0; z <= z1; z++) {
      const a = _tpXY(lat + dLat, lon - dLon, z), b = _tpXY(lat - dLat, lon + dLon, z), c = _tpXY(lat, lon, z);
      for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (kind === 'sat') out.push({ kind, z, x, y, d, url: `${TILE_SAT_BASE}/${z}/${y}/${x}?blankTile=false`, alt: `${TILE_SAT_BASE}/${z}/${y}/${x}` });
        else out.push({ kind, z, x, y, d, url: `${TILE_DEM_BASE}/${z}/${x}/${y}.png` });
      }
    }
  };
  add('sat', satMin, satMax); add('dem', demMin, demMax);
  return out.sort((p, q) => p.z - q.z || p.d - q.d);
}
// 항로 따라 — 비행계획 지점을 잇는 선 둘레(반경 nm) 타일. 선 위로 nm 마다 둥근 구역을 겹쳐 놓고 겹치는 타일은 한 번만
function tilesRouteList(pts, nm, opt) {
  const seen = new Set(), out = [];
  const push = L => L.forEach(t => { const k = t.kind + t.z + '/' + t.x + '/' + t.y; if (!seen.has(k)) { seen.add(k); out.push(t); } });
  const P = (pts || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (P.length === 1) push(tilesAreaList(P[0].lat, P[0].lon, nm, opt));
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1];
    const d = Math.hypot((b.lat - a.lat) * 60, (b.lon - a.lon) * 60 * Math.cos(a.lat * Math.PI / 180));
    const n = Math.max(1, Math.ceil(d / Math.max(1, nm)));
    for (let j = 0; j <= n; j++) { const f = j / n; push(tilesAreaList(a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f, nm, opt)); }
  }
  return out.sort((p, q) => p.z - q.z || p.d - q.d);
}
// 자주 쓰는 지역 — 이름 · 가운데 · 반경을 이 기기(localStorage 'tileAreas')에 남겨 두고 다시 받는다(받은 날도 적는다)
function tileAreas() { try { const a = JSON.parse(localStorage.getItem('tileAreas') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function tileAreasSave(a) { try { localStorage.setItem('tileAreas', JSON.stringify(a.slice(0, 20))); } catch (e) { _swallow(e); } }
function tileAreaAdd(name, lat, lon, nm) {
  const a = tileAreas().filter(x => x.name !== name);
  a.unshift({ name: String(name).slice(0, 30), lat: +lat.toFixed(4), lon: +lon.toFixed(4), nm, at: null });
  tileAreasSave(a); return a;
}
function _fplPts() { try { return (S.wps || []).map(w => ({ lat: +w.lat, lon: +w.lon })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)); } catch (e) { return []; } }
// 인터넷이 끊기면 알린다 — 받아 둔 지도로 계속 돈다
try {
  window.addEventListener('offline', () => { try { uiToast('인터넷 끊김 — 받아 둔 지도(🧰 → 🗺 지도 미리 받기)로 계속합니다', 'warn', 5000); } catch (e) { _swallow(e); } });
  window.addEventListener('online', () => { try { uiToast('인터넷 다시 연결됨'); } catch (e) { _swallow(e); } });
} catch (e) { _swallow(e); }
// 받기 — 이미 캐시에 있으면 건너뛴다. 위성 사진은 3D(?blankTile=false)와 2D · MFD(꼬리표 없음) 두 이름으로 넣는다
const tilePrep = { busy: false, stop: false, done: 0, have: 0, fail: 0, total: 0 };
async function tilesPrefetch(list, onProgress) {
  if (!('caches' in window)) return { ok: false, why: '이 브라우저는 캐시를 쓸 수 없습니다' };
  if (list.length > TILE_PREP_MAX) return { ok: false, why: `${list.length}장 — 한 번에 ${TILE_PREP_MAX}장까지입니다(반경을 줄이십시오)` };
  const P = tilePrep; Object.assign(P, { busy: true, stop: false, done: 0, have: 0, fail: 0, total: list.length });
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { _swallow(e); }   // 저장 공간이 모자라도 지워지지 않게 청한다
  const sat = await caches.open(TILE_SAT_CACHE), dem = await caches.open(TILE_DEM_CACHE);
  let i = 0;
  const one = async t => {
    const c = t.kind === 'sat' ? sat : dem;
    try {
      if (await c.match(t.url)) { P.have++; if (t.alt && !(await c.match(t.alt))) { const r0 = await c.match(t.url); if (r0) await c.put(t.alt, r0); } return; }
      const r = await fetch(t.url, { mode: 'cors' });
      if (r.ok) { if (t.alt) await c.put(t.alt, r.clone()); await c.put(t.url, r); }
      else if (r.status !== 404) P.fail++;          // 404 = 그 단계에 사진이 없다(바다 등) — 실패가 아니다
    } catch (e) { P.fail++; }
  };
  await Promise.all(Array.from({ length: TILE_PREP_CONC }, async () => {
    while (i < list.length && !P.stop) { await one(list[i++]); P.done++; if (onProgress) try { onProgress(P); } catch (e) { _swallow(e); } }
  }));
  P.busy = false;
  return { ok: !P.stop, stopped: P.stop, done: P.done, have: P.have, fail: P.fail, total: P.total };
}
async function tileCacheStats() {
  const o = { sat: 0, dem: 0, osm: 0 };
  try {
    if (!('caches' in window)) return o;
    for (const [k, n] of [['sat', TILE_SAT_CACHE], ['dem', TILE_DEM_CACHE], ['osm', 'vfr-tiles']]) if (await caches.has(n)) o[k] = (await (await caches.open(n)).keys()).length;
  } catch (e) { _swallow(e); }
  return o;
}
// 캐시째 지우면(caches.delete) 서비스 워커가 그 캐시를 쓰는 동안(3D 지도가 타일을 받는 중) 끝나지 않고 기다릴 수 있다 —
// 그래서 안의 것을 하나씩 지운다
async function tileCacheClear() {
  try {
    for (const n of [TILE_SAT_CACHE, TILE_DEM_CACHE, 'vfr-tiles']) {
      if (!(await caches.has(n))) continue;
      const c = await caches.open(n), keys = await c.keys();
      for (let i = 0; i < keys.length; i += 50) await Promise.all(keys.slice(i, i + 50).map(k => c.delete(k)));
    }
  } catch (e) { _swallow(e); }
}
let _tpSrc = 'here';   // here · fpl · area:<i>
function _tpEst(nm) {
  let L;
  if (_tpSrc === 'fpl') L = tilesRouteList(_fplPts(), Math.min(nm, 10));        // 항로는 양옆 10NM 까지
  else if (_tpSrc.startsWith('area:')) { const A = tileAreas()[+_tpSrc.slice(5)]; L = A ? tilesAreaList(A.lat, A.lon, A.nm) : []; }
  else L = tilesAreaList(S.lat, S.lon, nm);
  return { n: L.length, mb: L.length * TILE_PREP_KB / 1024, list: L };
}
function toggleTilePrep() {
  let w = document.getElementById('tileprep-wrap');
  if (w && w.style.display === 'flex') { if (!tilePrep.busy) w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'tileprep-wrap'; w.className = 'diag-like'; document.body.appendChild(w);
    w.addEventListener('click', async e => {
      if (e.target === w && !tilePrep.busy) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-tp]'); if (!b) return;
      const k = b.dataset.tp;
      if (k === 'x') { if (!tilePrep.busy) w.style.display = 'none'; }
      else if (k === 'stop') tilePrep.stop = true;
      else if (k === 'clear') { if (await uiConfirm('받아 둔 지도 타일(위성 · 지형 · 지도)을 모두 지울까요?')) { await tileCacheClear(); _tpRender(); } }
      else if (k.startsWith('nm')) { _tpNm = +k.slice(2); _tpRender(); }
      else if (k.startsWith('src:')) { _tpSrc = k.slice(4); _tpRender(); }
      else if (k === 'save') {
        const nm = await uiPrompt('이 지역 이름(예: 제주 기지 · 서귀포 해역)', '');
        if (nm && nm.trim()) { tileAreaAdd(nm.trim(), S.lat, S.lon, _tpNm); _tpSrc = 'area:0'; _tpRender(); }
      }
      else if (k.startsWith('adel:')) { const a = tileAreas(); a.splice(+k.slice(5), 1); tileAreasSave(a); _tpSrc = 'here'; _tpRender(); }
      else if (k === 'go') {
        const est = _tpEst(_tpNm);
        if (est.n > TILE_PREP_MAX) { uiAlert(`${est.n}장 — 한 번에 ${TILE_PREP_MAX}장까지입니다. 반경을 줄이십시오.`); return; }
        _tpRender();
        const r = await tilesPrefetch(est.list, () => _tpProg());
        uiToast(r.stopped ? `멈춤 — ${r.done}/${r.total}장` : r.ok ? `작전 구역 지도 준비 — ${r.total}장(이미 있던 ${r.have} · 못 받은 ${r.fail})` : r.why, r.fail ? 'warn' : '', 4000);
        if (r.ok && _tpSrc.startsWith('area:')) { const a = tileAreas(), A = a[+_tpSrc.slice(5)]; if (A) { A.at = new Date().toISOString().slice(0, 10); tileAreasSave(a); } }
        _tpRender();
      }
    });
  }
  w.style.display = 'flex'; _tpRender();
}
let _tpNm = 20;
function _tpProg() {
  const el = document.getElementById('tp-prog'), P = tilePrep; if (!el) return;
  const f = P.total ? P.done / P.total : 0;
  el.innerHTML = `<div class="tp-bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div>${P.done} / ${P.total}장 · 이미 있음 ${P.have} · 실패 ${P.fail}`;
}
function _tpRender() {
  const w = document.getElementById('tileprep-wrap'); if (!w) return;
  const est = _tpEst(_tpNm), P = tilePrep;
  const row = (a, b) => `<div class="set-row"><span>${a}</span><div>${b}</div></div>`;
  const nmBtn = n => `<button class="sim-btn${_tpNm === n ? ' on' : ''}" data-tp="nm${n}" ${P.busy ? 'disabled' : ''}>${n}NM</button>`;
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>🗺 작전 구역 지도 미리 받기</b><button class="sim-btn" data-tp="x">✕</button></div>
    ${row('어디를', (() => {
      const dis = P.busy ? 'disabled' : '', b = (v, l) => `<button class="sim-btn${_tpSrc === v ? ' on' : ''}" data-tp="src:${v}" ${dis}>${l}</button>`;
      const fp = _fplPts().length;
      return b('here', `지금 자리 ${S.lat.toFixed(2)}°N ${S.lon.toFixed(2)}°E`) + (fp >= 2 ? b('fpl', `비행계획 항로(${fp}지점 · 양옆 ${Math.min(_tpNm, 10)}NM)`) : '');
    })())}
    ${row('저장한 지역', (() => {
      const A = tileAreas(), dis = P.busy ? 'disabled' : '';
      const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return (A.length ? A.map((a, i) => `<span class="tp-area"><button class="sim-btn${_tpSrc === 'area:' + i ? ' on' : ''}" data-tp="src:area:${i}" ${dis}>📍 ${esc(a.name)} · ${a.nm}NM${a.at ? ' · ' + a.at : ' · 아직 안 받음'}</button><button class="sim-btn" data-tp="adel:${i}" title="목록에서 지우기" ${dis}>✕</button></span>`).join('') : '<span class="tp-none">없음</span>') +
        `<button class="sim-btn" data-tp="save" ${dis}>＋ 지금 자리 · 반경을 저장</button>`;
    })())}
    ${row('반경', [10, 20, 30, 40].map(nmBtn).join(''))}
    ${row('받을 것', `위성 사진 8~14 단계 · 3D 지형 8~12 단계 — ${est.n}장 · 약 ${est.mb.toFixed(0)}MB${est.n > TILE_PREP_MAX ? ` <b style="color:#ff6b6b">(한 번에 ${TILE_PREP_MAX}장까지)</b>` : ''}`)}
    ${row('받아 둔 타일', '<span id="tp-have">세는 중…</span>')}
    <div class="set-row"><span></span><div id="tp-prog">${P.busy ? '' : '인터넷이 될 때(와이파이) 받아 두면, 끊겨도 2D · 3D · MFD 지도가 뜹니다.' + (navigator.onLine === false ? ' <b style="color:#ffb74d">지금 오프라인</b>' : '')}</div></div>
    <div class="set-row"><span></span><div>${P.busy ? '<button class="sim-btn" data-tp="stop">멈춤</button>' : `<button class="sim-btn" data-tp="go" ${est.n > TILE_PREP_MAX ? 'disabled' : ''}>⬇ 받기</button><button class="sim-btn" data-tp="clear">지우기</button>`}</div></div></div>`;
  if (P.busy) _tpProg();
  tileCacheStats().then(o => { const el = document.getElementById('tp-have'); if (el) el.textContent = `위성 ${o.sat} · 지형 ${o.dem} · 지도(OSM) ${o.osm}장 — 판이 바뀌어도 남습니다`; });
}
