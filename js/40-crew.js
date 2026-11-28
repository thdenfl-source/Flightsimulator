'use strict';
// ══════════════════════════════════════════════════════
// 40-crew.js — 함께 나는 사람들
//   ① 가상 부조종사(PM · Pilot Monitoring) — 표준 콜아웃 · 편차 경고 · 체크리스트 읽기와 응답(CRM)
//   ② 협동 구조 자산 — 해경 함정 · 고속단정(AI)이 현장으로 오고, 교신하고, 구조 · 인계를 돕는다
//   ③ 두 대 협동 비행 — 다른 기기의 시뮬과 같은 하늘(인터넷 중계 · 같은 브라우저) · 서로 보기 · 항로 · 메시지
// ══════════════════════════════════════════════════════
const _cN = (f, d = 0) => { try { const v = f(); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
const _cEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function _cNote(txt, kind = '') { try { if (typeof fdrNote === 'function') fdrNote(txt, kind); } catch (e) { _swallow(e); } }
function _cToast(txt, kind = '', ms = 3500) { try { uiToast(txt, kind, ms); } catch (e) { _swallow(e); } }
function _cSay(txt) { try { if (typeof speak === 'function') speak(txt); } catch (e) { _swallow(e); } }
// 한국어로 읽기(체크리스트 항목) — 한국어 목소리가 있으면 그것으로
function _cSayKo(txt) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(String(txt)); u.lang = 'ko-KR'; u.rate = 1.05;
    const v = (speechSynthesis.getVoices() || []).find(x => /^ko/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u); return true;
  } catch (e) { return false; }
}

// ── ① 가상 부조종사(PM) ──
//   콜아웃(한 번씩): 이륙 뒤 'Positive climb'(승강 +300fpm · 전파고도 20ft 위) · 'Airspeed alive'(30kt) · 'V Y'(기종 Vy)
//   편차(비행 중 · 10초에 한 번): 'Bank angle'(30° 넘음) · 'Sink rate'(전파고도 1,000ft 아래에서 −1,000fpm 보다 빠름)
//     'Torque'(연속 한계 넘음) · 'Rotor low / high'(NR 95% 아래 · 105% 위) · 'Speed'(VNE −5kt 넘음)
//   경고 뒤 5초가 지나도 그대로면 한 번 더 부르고 강평에 '반응 없음'으로 남긴다(CRM 평가)
//   체크리스트: CDU 체크리스트(정상 · 특수 · 비상)를 PM 이 한 항목씩 읽고(한국어) 조종사가 '확인'(단추 · 음성)으로 답한다.
//     콘솔로 확인할 수 있는 항목(32-callout.js clAutoState)이 아직 맞지 않으면 PM 이 "확인 필요 — 지금 …" 하고 한 번 막는다
const pm = Object.assign({ on: false, voice: true }, (() => { try { return JSON.parse(localStorage.getItem('pmCfg') || 'null') || {}; } catch (e) { return {}; } })(),
  { air: null, phase: '', once: {}, devT: {}, dev: {}, log: [], cl: null, rec: null });
function _pmSave() { try { localStorage.setItem('pmCfg', JSON.stringify({ on: pm.on, voice: pm.voice })); } catch (e) { _swallow(e); } }
function _pmAir() { try { return typeof sndOnGround === 'function' ? !sndOnGround() : S.alt > 5; } catch (e) { return true; } }
function _pmRa() { return _cN(() => radarAltFt(), S.alt || 0); }
function _pmVy() { try { if (typeof perfVy === 'function') { const v = perfVy(); if (v > 30) return v; } } catch (e) { _swallow(e); } try { return acB206() ? 60 : 80; } catch (e) { return 70; } }
function _pmVne() { return _cN(() => simVne(), 160); }
function _pmNr() { return _cN(() => engParams().nr, 100); }
function pmCall(key, txt, kind = '') {
  pm.log.unshift({ t: Date.now(), txt, kind }); if (pm.log.length > 30) pm.log.pop();
  _cSay(txt); _cNote(`PM — ${txt}`, kind);
  try { const el = document.getElementById('pm-last'); if (el) el.textContent = txt; } catch (e) { _swallow(e); }
  _pmRender();
}
function pmStep(dt) {
  if (!pm.on || !S.running) return;
  const air = _pmAir(), ra = _pmRa(), vs = S.vs || 0, spd = S.spd || 0, now = performance.now();
  if (pm.air === null) pm.air = air;
  if (air && !pm.air) { pm.phase = 'TO'; pm.once = {}; }                  // 떴다
  if (!air && pm.air) { pm.phase = ''; pm.dev = {}; }                     // 내려앉았다
  pm.air = air;
  const once = (k, cond, txt) => { if (cond && !pm.once[k]) { pm.once[k] = true; pmCall(k, txt); } };
  if (pm.phase === 'TO') {
    once('pos', vs > 300 && ra > 20, 'Positive climb');
    once('alive', spd >= 30, 'Airspeed alive');
    once('vy', spd >= _pmVy() - 1, 'V Y');
    if (pm.once.vy && ra > 500) pm.phase = 'CRZ';
  }
  if (!air) return;
  let tq = 0; try { tq = tqShown(); } catch (e) { tq = 0; }
  const nr = _pmNr();
  const dev = {
    bank: [Math.abs(S.bnk || 0) > 30, 'Bank angle'],
    sink: [ra < 1000 && vs < -1000, 'Sink rate'],
    tq: [tq > _cN(() => tqLimitCont(), 100) + 0.5, 'Torque'],
    nrLo: [nr < 95 && nr > 10, 'Rotor low'],
    nrHi: [nr > 105, 'Rotor high'],
    vne: [spd > _pmVne() - 5, 'Speed'],
  };
  for (const [k, [bad, txt]] of Object.entries(dev)) {
    const d = pm.dev[k];
    if (!bad) { if (d) delete pm.dev[k]; continue; }
    if (!d) { if (now - (pm.devT[k] || -1e9) > 10000) { pm.devT[k] = now; pm.dev[k] = { t: now, again: false }; pmCall(k, txt, 'warn'); } continue; }
    if (!d.again && now - d.t > 5000) { d.again = true; pmCall(k, `${txt}, ${txt}`, 'err'); _cNote(`PM 경고에 반응 없음(5초) — ${txt}`, 'err'); }
  }
}
// 체크리스트 — 항목이 있는 것을 모두 모은다(정상 · 특수 · 비상)
function pmChecklists() {
  const out = [];
  try {
    const walk = (n, path) => { if (!n) return; if (Array.isArray(n.items) && n.items.length) out.push({ name: path.concat(n.name).join(' › '), items: n.items.slice() }); (n.children || []).forEach(c => walk(c, n.name && n.name !== 'CHECK LIST' ? path.concat(n.name) : path)); };
    if (typeof cduChecklistRoot === 'function') walk(cduChecklistRoot(), []);
  } catch (e) { _swallow(e); }
  return out;
}
function _pmChallenge(item) { const m = String(item).match(/^(.+?)\s*[–-]\s*(.+)$/); return m ? { ch: m[1].trim(), resp: m[2].trim() } : { ch: String(item), resp: '' }; }
function pmClStart(i) {
  const L = pmChecklists(), c = L[i]; if (!c) return false;
  pm.cl = { name: c.name, items: c.items, i: 0, t0: Date.now(), blocked: -1, miss: [] };
  _cNote(`PM 체크리스트 시작 — ${c.name}`);
  _pmClRead(); _pmRender(); return true;
}
function _pmClRead() {
  const c = pm.cl; if (!c) return;
  const it = c.items[c.i]; if (it === undefined) return pmClEnd();
  if (/^›/.test(it)) { c.i++; return _pmClRead(); }                       // '› 계속 시현 시' 같은 조건 줄은 읽기만 건너뛴다
  const { ch } = _pmChallenge(it);
  _cSayKo(ch);
  _pmListen();
}
// 조종사의 답 — ok(확인) · 콘솔로 볼 수 있는 항목이 아직 다르면 한 번 막는다
function pmClAnswer() {
  const c = pm.cl; if (!c) return false;
  const it = c.items[c.i];
  let st = null; try { st = typeof clAutoState === 'function' ? clAutoState(it) : null; } catch (e) { st = null; }
  if (st && !st.ok && c.blocked !== c.i) { c.blocked = c.i; _cSayKo(`확인 필요, 지금 ${st.now}`); _cToast(`PM — 확인 필요: ${it} (지금 ${st.now})`, 'warn'); c.miss.push(it); _pmRender(); _pmListen(); return false; }
  c.i++; _pmRender();
  if (c.i >= c.items.length) { pmClEnd(); return true; }
  setTimeout(_pmClRead, 300); return true;
}
function pmClEnd(stop) {
  const c = pm.cl; if (!c) return;
  _pmListenStop(); pm.cl = null;
  const sec = Math.round((Date.now() - c.t0) / 1000);
  if (stop) { _cNote(`PM 체크리스트 멈춤 — ${c.name}`); }
  else { _cSayKo(`${c.name.split(' › ').pop()} 체크리스트 완료`); _cNote(`PM 체크리스트 완료 — ${c.name} · ${sec}초${c.miss.length ? ` · 다시 확인 ${c.miss.length}` : ''}`, c.miss.length ? 'warn' : ''); }
  pm.lastCl = { name: c.name, sec, miss: c.miss.slice(), done: !stop };
  _pmRender();
}
// 음성으로 답하기(되는 브라우저) — '확인 · 체크 · 완료 · 셋 · 온 · 오프' 또는 그 항목의 값
function _pmListen() {
  _pmListenStop();
  const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R || !pm.voice || !pm.cl) return;
  try {
    const r = new R(); r.lang = 'ko-KR'; r.interimResults = false; r.continuous = false;
    const want = (_pmChallenge(pm.cl.items[pm.cl.i] || '').resp || '').toLowerCase().split(/[\s/,()]+/).filter(w => w.length > 1);
    r.onresult = e => { const heard = Array.from(e.results).map(x => x[0].transcript).join(' ').toLowerCase(); if (/확인|체크|완료|셋|세트|온|오프|check|set|on|off|confirmed/.test(heard) || want.some(w => heard.includes(w))) pmClAnswer(); };
    r.onerror = () => { /* 못 들음 — 단추로 */ };
    setTimeout(() => { try { r.start(); pm.rec = r; } catch (e) { _swallow(e); } }, 1200);   // PM 이 읽는 동안은 듣지 않는다
  } catch (e) { _swallow(e); }
}
function _pmListenStop() { try { if (pm.rec) pm.rec.abort(); } catch (e) { _swallow(e); } pm.rec = null; }
let _pmLast = 0;
setInterval(() => { const now = performance.now(), dt = Math.min(1, (now - (_pmLast || now)) / 1000); _pmLast = now; try { pmStep(dt); } catch (e) { _swallow(e); } }, 500);
function toggleCrewPm() {
  let w = document.getElementById('pm-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'pm-wrap'; w.className = 'diag-like crew-wrap'; document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-pm]'); if (!b) return;
      const [k, v] = b.dataset.pm.split(':');
      if (k === 'x') { w.style.display = 'none'; return; }
      if (k === 'on') { pm.on = v === '1'; pm.air = null; pm.once = {}; pm.dev = {}; _pmSave(); _cToast(pm.on ? '👨‍✈️ 가상 부조종사가 함께 탑니다 — 콜아웃 · 편차 경고' : '가상 부조종사 내림'); }
      else if (k === 'voice') { pm.voice = v === '1'; _pmSave(); }
      else if (k === 'cl') pmClStart(+v);
      else if (k === 'ok') pmClAnswer();
      else if (k === 'stop') pmClEnd(true);
      else if (k === 'again' && pm.cl) _pmClRead();
      _pmRender();
    });
  }
  w.style.display = 'flex'; _pmRender();
}
function _pmRender() {
  const w = document.getElementById('pm-wrap'); if (!w || w.style.display !== 'flex') return;
  const row = (a, b) => `<div class="set-row"><span>${a}</span><div>${b}</div></div>`;
  const tg = (k, val) => `<button class="sim-btn ${val ? 'on' : ''}" data-pm="${k}:1">켬</button><button class="sim-btn ${!val ? 'on' : ''}" data-pm="${k}:0">끔</button>`;
  const c = pm.cl;
  let clHtml;
  if (c) {
    const it = c.items[c.i] || '', p = _pmChallenge(it);
    clHtml = `<div class="pm-cl"><div class="pm-cl-h">${_cEsc(c.name)} — ${c.i + 1}/${c.items.length}</div>
      <div class="pm-cl-it"><b>${_cEsc(p.ch)}</b>${p.resp ? ` — <i>${_cEsc(p.resp)}</i>` : ''}</div>
      <div><button class="sim-btn on pm-big" data-pm="ok">✓ 확인</button><button class="sim-btn" data-pm="again">↻ 다시 읽기</button><button class="sim-btn" data-pm="stop">멈춤</button></div>
      <div class="pm-cl-n">${c.items.map((x, i) => `<span class="${i < c.i ? 'ok' : i === c.i ? 'cur' : ''}">${i < c.i ? '✓' : '·'} ${_cEsc(_pmChallenge(x).ch)}</span>`).join('')}</div></div>`;
  } else {
    const L = pmChecklists();
    clHtml = (L.length ? L.map((x, i) => `<button class="sim-btn" data-pm="cl:${i}">${_cEsc(x.name)}</button>`).join('') : '<span class="tp-none">체크리스트를 찾지 못했습니다</span>') +
      (pm.lastCl ? `<div class="pm-cl-n">마지막: ${_cEsc(pm.lastCl.name)} · ${pm.lastCl.done ? '완료' : '멈춤'} · ${pm.lastCl.sec}초${pm.lastCl.miss.length ? ` · 다시 확인 ${pm.lastCl.miss.length}` : ''}</div>` : '');
  }
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>👨‍✈️ 가상 부조종사(PM)</b><button class="sim-btn" data-pm="x">✕</button></div>
    ${row('함께 타기', tg('on', pm.on))}
    ${row('음성으로 답하기', tg('voice', pm.voice) + ((window.SpeechRecognition || window.webkitSpeechRecognition) ? '' : ' <span class="tp-none">(이 브라우저는 받아쓰기가 없어 단추로)</span>'))}
    ${row('최근 콜아웃', pm.log.length ? pm.log.slice(0, 6).map(x => `<span class="${x.kind}">${_cEsc(x.txt)}</span>`).join(' · ') : '<span class="tp-none">아직 없음</span>')}
    <div class="set-row"><span>체크리스트</span><div class="pm-cls">${clHtml}</div></div>
    <div class="set-note">콜아웃: Positive climb · Airspeed alive · V Y / 편차: Bank angle(30°) · Sink rate(1,000ft 아래 −1,000fpm) · Torque · Rotor low/high · Speed(VNE). 5초 안에 고치지 않으면 다시 부르고 강평에 '반응 없음'으로 남습니다.</div></div>`;
}

// ── ② 협동 구조 자산 — 해경 함정 · 고속단정 ──
//   교관(또는 조종사)이 '출동'시키면 요구조자(없으면 기체) 쪽 바다 먼 곳에서 나타나 그리로 간다 — 함정 18kt · 고속단정 30kt
//   레이더 · AIS(이름) · CH4 항법지도 · 2D 지도에 같은 표적으로 보이고(37-mission.js msnContacts), 거리마다 무전으로 알린다
//   현장 도착 뒤: 고속단정 — '단정이 구조'를 고르면 60초 뒤 요구조자를 건져 올린다 / 함정 — 헬기가 구조했으면 함정 둘레 0.3NM ·
//   20kt 아래로 오면 '인계'(요구조자를 함정으로 내림)를 할 수 있다
const ASSET_T = {
  ship: { name: '경비함', cs: 'KCG 3015', say: 'Coast guard three zero one five', v: 18, len: 90, rcs: 30, nm: [8, 12], mmsi: '440301500' },
  rib: { name: '고속단정', cs: 'RESCUE 1', say: 'Rescue boat one', v: 30, len: 9, rcs: 5, nm: [3, 5], mmsi: '440301501' },
};
const crewAssets = [];
let _assetSeq = 0, _assetLayer = null;
function _assetGoal() { try { if (typeof sar !== 'undefined' && sar.on && sar.lat !== null && sar.state !== 'aboard') return { lat: sar.lat, lon: sar.lon, surv: true }; } catch (e) { _swallow(e); } return { lat: S.lat, lon: S.lon, surv: false }; }
function assetDispatch(kind, opt = {}) {
  const T = ASSET_T[kind]; if (!T) return null;
  const g = _assetGoal(); let la = null, lo = null;
  for (let i = 0; i < 40 && la === null; i++) {
    const brg = opt.brg != null ? opt.brg : Math.random() * 360, nm = opt.nm != null ? opt.nm : T.nm[0] + Math.random() * (T.nm[1] - T.nm[0]);
    const [a, b] = destPoint(g.lat, g.lon, brg, nm);
    if (opt.anywhere || typeof _mWater !== 'function' || _mWater(a, b)) { la = a; lo = b; }
  }
  if (la === null) return null;
  const a = { id: 'K' + (++_assetSeq), kind, name: T.name, cs: T.cs, say: T.say, mmsi: T.mmsi, len: T.len, rcs: T.rcs, vMax: T.v, v: 0, lat: la, lon: lo, hdg: bearing(la, lo, g.lat, g.lon),
    st: 'enroute', said: {}, recT: 0, rescue: !!opt.rescue, handed: false };
  crewAssets.push(a);
  const nm = distance(la, lo, g.lat, g.lon), eta = Math.round(nm / T.v * 60);
  _cSay(`${a.say}, proceeding to ${g.surv ? 'the survivor' : 'your position'}, ${Math.round(nm)} miles, E T A ${eta} minutes.`);
  _cToast(`🚤 ${a.name}(${a.cs}) 출동 — ${nm.toFixed(1)}NM · 도착 약 ${eta}분`);
  _cNote(`협동 자산 출동 — ${a.name} ${a.cs} · ${nm.toFixed(1)}NM`);
  _assetMap(); _assetRender(); return a;
}
function assetClear() { crewAssets.length = 0; _assetMap(); _assetRender(); }
function assetStep(dt) {
  if (!(dt > 0) || !crewAssets.length) return;
  for (const a of crewAssets) {
    const g = _assetGoal(), nm = distance(a.lat, a.lon, g.lat, g.lon);
    if (a.st === 'enroute') {
      const want = nm < 0.3 ? Math.max(3, a.vMax * nm / 0.3) : a.vMax;
      a.v += Math.max(-2 * dt, Math.min(1 * dt, want - a.v));
      a.hdg = bearing(a.lat, a.lon, g.lat, g.lon);
      const step = Math.min(nm, a.v * dt / 3600);
      [a.lat, a.lon] = destPoint(a.lat, a.lon, a.hdg, step);
      for (const m of [5, 2, 1]) if (nm < m && !a.said[m]) { a.said[m] = true; _cSay(`${a.say}, ${m} mile${m > 1 ? 's' : ''} to ${g.surv ? 'the survivor' : 'you'}.`); _cNote(`${a.name} — ${m}NM 남음`); }
      if (nm < 0.05) { a.st = 'onscene'; a.v = 0; _cSay(`${a.say}, on scene.`); _cToast(`🚤 ${a.name} 현장 도착`, 'ok'); _cNote(`${a.name} 현장 도착`); }
    } else if (a.st === 'onscene') {
      a.v = 0;
      if (g.surv && nm > 0.1) { a.st = 'enroute'; continue; }             // 요구조자가 떠밀려 갔다 — 다시 따라간다
      if (a.kind === 'rib' && a.rescue && g.surv && typeof sar !== 'undefined' && sar.state === 'wait') {
        a.recT += dt;
        if (a.recT >= 60) { sar.state = 'aboard'; a.st = 'done'; try { if (typeof _sarMarker === 'function') _sarMarker(); if (typeof sarPanelRender === 'function') sarPanelRender(); } catch (e) { _swallow(e); }
          _cSay(`${a.say}, survivor recovered, returning.`); _cToast(`🚤 ${a.name}이 요구조자를 구조했습니다`, 'ok', 5000); _cNote(`요구조자 구조 — ${a.name}`, 'ok'); }
      }
    }
  }
  _assetMap();
}
// 함정에 인계 — 헬기가 구조한 뒤 함정 0.3NM · 20kt 안
function assetHandover() {
  const sh = crewAssets.find(a => a.kind === 'ship' && !a.handed);
  if (!sh) { _cToast('인계할 함정이 없습니다 — 먼저 경비함을 출동시키십시오', 'warn'); return false; }
  if (typeof sar === 'undefined' || sar.state !== 'aboard') { _cToast('헬기가 요구조자를 구조한 뒤 인계합니다', 'warn'); return false; }
  const nm = distance(S.lat, S.lon, sh.lat, sh.lon);
  if (nm > 0.3 || (S.spd || 0) > 20) { _cToast(`함정 가까이(0.3NM · 20kt 안)로 — 지금 ${nm.toFixed(2)}NM · ${Math.round(S.spd || 0)}kt`, 'warn'); return false; }
  sh.handed = true; _cSay(`${sh.say}, survivor received, thank you.`); _cToast(`🚢 ${sh.name}(${sh.cs})에 요구조자 인계`, 'ok', 5000); _cNote(`요구조자 함정 인계 — ${sh.cs}`, 'ok');
  _assetRender(); return true;
}
function _assetMap() {
  try {
    if (typeof L === 'undefined' || typeof leafMap === 'undefined') return;
    if (!crewAssets.length) { if (_assetLayer) { leafMap.removeLayer(_assetLayer); _assetLayer = null; } return; }
    if (!_assetLayer) _assetLayer = L.layerGroup().addTo(leafMap);
    _assetLayer.clearLayers();
    for (const a of crewAssets) {
      const col = a.kind === 'ship' ? '#4fc3f7' : '#ffd54f';
      L.circleMarker([a.lat, a.lon], { radius: a.kind === 'ship' ? 8 : 5, color: col, weight: 2, fillColor: col, fillOpacity: 0.5 })
        .bindTooltip(`${a.kind === 'ship' ? '🚢' : '🚤'} ${a.cs}<br>${a.st === 'enroute' ? `${Math.round(a.v)}kt` : a.st === 'onscene' ? '현장' : '완료'}`, { permanent: true, direction: 'right', className: 'asset-tip' }).addTo(_assetLayer);
    }
  } catch (e) { _swallow(e); }
}
let _assetLastT = 0;
setInterval(() => { const now = performance.now(), dt = Math.min(2, (now - (_assetLastT || now)) / 1000); _assetLastT = now; if (S.running) try { assetStep(dt * (typeof simSpeed === 'number' && simSpeed > 0 ? simSpeed : 1)); } catch (e) { _swallow(e); } }, 1000);
function toggleAssets() {
  let w = document.getElementById('asset-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'asset-wrap'; w.className = 'diag-like crew-wrap'; document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-as]'); if (!b) return;
      const [k, v] = b.dataset.as.split(':');
      if (k === 'x') { w.style.display = 'none'; return; }
      if (k === 'go') { if (!assetDispatch(v, { rescue: v === 'rib' && !!w.querySelector('[data-asv="rescue"]:checked') })) _cToast('둘레에 바다가 없어 띄우지 못했습니다(지형을 아직 모르면 잠시 뒤에)', 'warn'); }
      else if (k === 'hand') assetHandover();
      else if (k === 'clear') assetClear();
      _assetRender();
    });
  }
  w.style.display = 'flex'; _assetRender();
}
function _assetRender() {
  const w = document.getElementById('asset-wrap'); if (!w || w.style.display !== 'flex') return;
  const g = _assetGoal();
  const list = crewAssets.length ? crewAssets.map(a => { const nm = distance(a.lat, a.lon, g.lat, g.lon); return `<div class="as-row">${a.kind === 'ship' ? '🚢' : '🚤'} <b>${_cEsc(a.cs)}</b> ${_cEsc(a.name)} · ${a.st === 'enroute' ? `이동 ${Math.round(a.v)}kt · ${nm.toFixed(1)}NM · 약 ${Math.max(1, Math.round(nm / Math.max(3, a.v || a.vMax) * 60))}분` : a.st === 'onscene' ? (a.rescue && a.kind === 'rib' ? `현장 — 구조 중 ${Math.round(a.recT)}/60초` : '현장 대기') : '임무 완료'}${a.handed ? ' · 인계 받음' : ''}</div>`; }).join('') : '<span class="tp-none">출동한 자산 없음</span>';
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>🚤 협동 구조 자산</b><button class="sim-btn" data-as="x">✕</button></div>
    <div class="set-row"><span>출동</span><div><button class="sim-btn" data-as="go:ship">🚢 경비함(18kt)</button><button class="sim-btn" data-as="go:rib">🚤 고속단정(30kt)</button><label class="as-chk"><input type="checkbox" data-asv="rescue"> 단정이 구조</label></div></div>
    <div class="set-row"><span>가는 곳</span><div>${g.surv ? '요구조자 자리' : '헬기 자리(요구조자가 없으면)'}</div></div>
    <div class="set-row"><span>지금</span><div class="as-list">${list}</div></div>
    <div class="set-row"><span></span><div><button class="sim-btn" data-as="hand">요구조자 함정에 인계</button><button class="sim-btn" data-as="clear">모두 철수</button></div></div>
    <div class="set-note">레이더 · AIS(이름) · CH4 항법지도 · 2D 지도에 보입니다. 5 · 2 · 1NM 과 현장 도착을 무전으로 알립니다. 인계는 헬기가 구조한 뒤 함정 0.3NM · 20kt 안에서.</div></div>`;
}

// ── ③ 두 대 협동 비행 — 편대 방(SS4|방|열쇠) ──
//   방을 만든 기기가 코드(QR)를 띄우고 다른 기기가 찍거나 붙여 넣으면 같은 방이 된다(몇 대든). 내용은 열쇠로 암호화(AES-GCM).
//   1초마다 내 자리 · 고도 · 침로 · 속도 · 콜사인(⚙ 설정) · 기종을, 10초마다 비행계획(수색 항로)을 보낸다.
//   받은 기체는 교통(33-train4.js traffic · remote)으로 넣어 TCAS · PFD TCAS 창 · 3D 화면 · 레이더(전탐석)에 보이고, 2D 지도에는 콜사인 · 항로(점선)를 그린다.
//   짧은 메시지(구역 · 발견 · 귀환 …)를 주고받는다. 같은 브라우저의 다른 창은 BroadcastChannel 로, 다른 기기는 인터넷 중계(33-train4.js rtcLinkOpen)로
const wing = { room: null, key: null, id: Math.random().toString(36).slice(2, 10), link: null, bc: null, peers: {}, msgs: [], layer: null, sendT: 0, wpsT: 0 };
const WING_TIMEOUT = 10000, WING_COLORS = ['#ff9f43', '#e056fd', '#7bed9f', '#70a1ff'];
function _wingCs() { try { return (appSet && appSet.callsign) || 'Coastguard zero one'; } catch (e) { return 'Coastguard zero one'; } }
function wingCreate() {
  const room = 'w' + Math.random().toString(36).slice(2, 12), key = (typeof _u8b64 === 'function') ? _u8b64(crypto.getRandomValues(new Uint8Array(16))) : btoa(String(Math.random()));
  wingJoin(`SS4|${room}|${key}`); return `SS4|${room}|${key}`;
}
function wingJoin(code) {
  const p = String(code || '').trim().split('|'); if (p[0] !== 'SS4' || p.length < 3) throw new Error('협동 비행 코드가 아닙니다');
  wingLeave(true);
  wing.room = p[1]; wing.key = p[2]; wing.peers = {}; wing.msgs = [];
  const onText = async text => {
    let m = null; try { m = JSON.parse(typeof rtcDec === 'function' ? await rtcDec(wing.key, text) : text); } catch (e) { return; }
    _wingIn(m);
  };
  try { wing.bc = new BroadcastChannel('shinesong-wing-' + wing.room); wing.bc.onmessage = e => onText(e.data); } catch (e) { wing.bc = null; }
  try { if (typeof rtcLinkOpen === 'function') { const t = 'shinesong/wing/' + wing.room; wing.link = rtcLinkOpen(t, t, onText); } } catch (e) { _swallow(e); }
  try { localStorage.setItem('wingRoom', JSON.stringify({ code: `SS4|${wing.room}|${wing.key}`, t: Date.now() })); } catch (e) { _swallow(e); }
  _cNote('협동 비행 방에 들어감');
  wingSend(true); _wingRender(true);
  return true;
}
function wingLeave(quiet) {
  const bc = wing.bc, link = wing.link, key = wing.key;
  const close = () => { try { if (link) link.close(); } catch (e) { _swallow(e); } try { if (bc) bc.close(); } catch (e) { _swallow(e); } };
  if (wing.room && !quiet) { _wingPub({ type: 'bye', id: wing.id }, bc, link, key).finally(close); _cNote('협동 비행 방에서 나감'); }   // 다 보낸 뒤에 닫는다(암호화를 기다리는 사이 닫히면 'bye' 가 안 간다)
  else close();
  wing.link = null; wing.bc = null; wing.room = null; wing.key = null;
  Object.keys(wing.peers).forEach(_wingDrop); wing.peers = {};
  if (!quiet) try { localStorage.removeItem('wingRoom'); } catch (e) { _swallow(e); }
  _wingMap(); _wingRender(true);
}
async function _wingPub(m, bc = wing.bc, link = wing.link, key = wing.key) {
  if (!key) return;
  let t = JSON.stringify(m); try { if (typeof rtcEnc === 'function') t = await rtcEnc(key, t); } catch (e) { _swallow(e); }
  try { if (bc) bc.postMessage(t); } catch (e) { _swallow(e); }
  try { if (link && link.ready) link.pub(t); } catch (e) { _swallow(e); }
}
function wingSend(withWps) {
  if (!wing.room) return;
  const ac = (() => { try { return acB206() || acIs('r22') ? 'b206' : 'kuh'; } catch (e) { return 'kuh'; } })();
  const m = { type: 'pos', id: wing.id, cs: _wingCs(), ac, lat: S.lat, lon: S.lon, alt: S.alt, hdg: S.hdg, spd: S.spd || 0, vs: S.vs || 0, bnk: S.bnk || 0, pit: S.pit || 0, t: Date.now() };
  if (withWps) m.wps = (S.wps || []).filter(w => w && Number.isFinite(w.lat)).slice(0, 40).map(w => [+w.lat.toFixed(5), +w.lon.toFixed(5)]);
  _wingPub(m);
}
function wingMsg(text) { text = String(text || '').trim().slice(0, 80); if (!text || !wing.room) return false; _wingPub({ type: 'msg', id: wing.id, cs: _wingCs(), text }); wing.msgs.unshift({ t: Date.now(), cs: '나', text }); _wingRender(); return true; }
function _wingIn(m) {
  if (!m || m.id === wing.id) return;
  if (m.type === 'bye') { _wingDrop(m.id); _wingRender(true); return; }
  if (m.type === 'msg') { wing.msgs.unshift({ t: Date.now(), cs: m.cs, text: m.text }); if (wing.msgs.length > 20) wing.msgs.pop(); _cToast(`✈ ${m.cs}: ${m.text}`, '', 5000); _cNote(`협동 비행 — ${m.cs}: ${m.text}`); _wingRender(); return; }
  if (m.type !== 'pos') return;
  const fresh = !wing.peers[m.id];
  const P = wing.peers[m.id] = Object.assign(wing.peers[m.id] || { col: WING_COLORS[Object.keys(wing.peers).length % WING_COLORS.length] }, m, { rx: Date.now() });
  if (m.wps) P.wps = m.wps;
  let t = (typeof traffic !== 'undefined') ? traffic.find(x => x.remote === m.id) : null;
  if (!t && typeof traffic !== 'undefined') { t = { id: 'W' + m.id.slice(0, 4), remote: m.id, mode: 'wing', st: 'OT' }; traffic.push(t); }
  if (t) Object.assign(t, { cs: m.cs, ac: m.ac === 'b206' ? 'b206' : 'kuh', lat: m.lat, lon: m.lon, alt: m.alt, hdg: m.hdg, spd: m.spd, vs: m.vs, bnk: m.bnk, pit: m.pit });
  if (fresh) { _cToast(`✈ ${m.cs} 이(가) 함께 납니다`, 'ok'); _cNote(`협동 비행 — ${m.cs} 들어옴`); _wingRender(true); }
}
function _wingDrop(id) {
  delete wing.peers[id];
  try { if (typeof traffic !== 'undefined') for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].remote === id) traffic.splice(i, 1); } catch (e) { _swallow(e); }
}
function _wingMap() {
  try {
    if (typeof L === 'undefined' || typeof leafMap === 'undefined') return;
    const ids = Object.keys(wing.peers);
    if (!ids.length) { if (wing.layer) { leafMap.removeLayer(wing.layer); wing.layer = null; } return; }
    if (!wing.layer) wing.layer = L.layerGroup().addTo(leafMap);
    wing.layer.clearLayers();
    for (const id of ids) {
      const P = wing.peers[id];
      if (P.wps && P.wps.length > 1) L.polyline(P.wps, { color: P.col, weight: 2, dashArray: '6 5', opacity: 0.85 }).addTo(wing.layer);
      L.circleMarker([P.lat, P.lon], { radius: 6, color: P.col, weight: 2, fillColor: P.col, fillOpacity: 0.6 })
        .bindTooltip(`✈ ${_cEsc(P.cs)}<br>${Math.round(P.alt)}ft · ${Math.round(P.spd)}kt`, { permanent: true, direction: 'right', className: 'asset-tip' }).addTo(wing.layer);
    }
  } catch (e) { _swallow(e); }
}
setInterval(() => {
  if (!wing.room) return;
  const now = Date.now();
  wing.wpsT = (wing.wpsT || 0) + 1; wingSend(wing.wpsT % 10 === 0);
  for (const id of Object.keys(wing.peers)) if (now - wing.peers[id].rx > WING_TIMEOUT) { const cs = wing.peers[id].cs; _wingDrop(id); _cToast(`✈ ${cs} — 연결이 끊겼습니다`, 'warn'); _cNote(`협동 비행 — ${cs} 끊김`, 'warn'); _wingRender(true); }
  _wingMap(); _wingRender();
}, 1000);
// 앱을 다시 열면 들어가 있던 방으로(12시간 안)
setTimeout(() => { try { const r = JSON.parse(localStorage.getItem('wingRoom') || 'null'); if (r && r.code && Date.now() - (r.t || 0) < 12 * 3600e3 && !wing.room) wingJoin(r.code); } catch (e) { _swallow(e); } }, 2000);
const WING_QUICK = ['구역 북쪽 맡음', '구역 남쪽 맡음', '요구조자 발견', '현장으로 갑니다', '연료 BINGO — 귀환', '고도 바꿈 — 500ft 차이 유지'];
function toggleWing() {
  let w = document.getElementById('wing-wrap');
  if (w && w.style.display === 'flex') { try { if (typeof qrScanStop === 'function') qrScanStop(); } catch (e) { _swallow(e); } w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'wing-wrap'; w.className = 'diag-like crew-wrap'; document.body.appendChild(w);
    w.addEventListener('click', async e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-wg]'); if (!b) return;
      const k = b.dataset.wg;
      try {
        if (k === 'x') { try { qrScanStop(); } catch (er) { _swallow(er); } w.style.display = 'none'; return; }
        if (k === 'new') { wingCreate(); }
        else if (k === 'join') { const v = w.querySelector('[data-wgv="code"]').value; wingJoin(v); }
        else if (k === 'scan') { const view = w.querySelector('[data-wgv="view"]'); const code = await qrScan(view); view.innerHTML = ''; wingJoin(code); }
        else if (k === 'leave') wingLeave();
        else if (k === 'copy') { await navigator.clipboard.writeText(`SS4|${wing.room}|${wing.key}`); _cToast('코드를 복사했습니다'); }
        else if (k.startsWith('q:')) wingMsg(WING_QUICK[+k.slice(2)]);
        else if (k === 'send') { const i = w.querySelector('[data-wgv="msg"]'); if (wingMsg(i.value)) i.value = ''; }
      } catch (er) { _swallow(er); _cToast((er && er.message) || '코드가 맞지 않습니다', 'err'); }
      _wingRender(true);
    });
  }
  w.style.display = 'flex'; _wingRender(true);
}
function _wingRender(full) {
  const w = document.getElementById('wing-wrap'); if (!w || w.style.display !== 'flex') return;
  const peers = Object.values(wing.peers);
  const pl = peers.length ? peers.map(P => { const nm = distance(S.lat, S.lon, P.lat, P.lon), br = bearing(S.lat, S.lon, P.lat, P.lon); return `<div class="as-row"><i style="color:${P.col}">●</i> <b>${_cEsc(P.cs)}</b> · ${fmtA(br)}° ${nm.toFixed(1)}NM · ${Math.round(P.alt)}ft(${P.alt - S.alt >= 0 ? '+' : ''}${Math.round(P.alt - S.alt)}) · ${Math.round(P.spd)}kt</div>`; }).join('') : `<span class="tp-none">${wing.room ? '다른 기체를 기다리는 중…' : '방에 들어가 있지 않음'}</span>`;
  const ml = wing.msgs.slice(0, 6).map(m => `<div class="as-row"><b>${_cEsc(m.cs)}</b>: ${_cEsc(m.text)}</div>`).join('') || '<span class="tp-none">없음</span>';
  if (!full) { const a = w.querySelector('[data-wgv="peers"]'), b = w.querySelector('[data-wgv="msgs"]'); if (a) a.innerHTML = pl; if (b) b.innerHTML = ml; if (a) return; }
  const code = wing.room ? `SS4|${wing.room}|${wing.key}` : '';
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>✈ 두 대 협동 비행</b><button class="sim-btn" data-wg="x">✕</button></div>
    ${wing.room ? `<div class="set-row"><span>방</span><div><span class="wg-qr" data-wgv="qr"></span><div class="wg-code"><code>${_cEsc(code)}</code><button class="sim-btn" data-wg="copy">복사</button><button class="sim-btn" data-wg="leave">나가기</button></div></div></div>`
      : `<div class="set-row"><span>시작</span><div><button class="sim-btn on" data-wg="new">방 만들기</button><button class="sim-btn" data-wg="scan">📷 QR 찍어 들어가기</button></div></div>
         <div class="set-row"><span>코드로</span><div><input type="text" data-wgv="code" placeholder="SS4|…"><button class="sim-btn" data-wg="join">들어가기</button></div></div>`}
    <div class="set-row"><span></span><div data-wgv="view"></div></div>
    <div class="set-row"><span>내 콜사인</span><div>${_cEsc(_wingCs())} <span class="tp-none">(⚙ 설정에서 바꿈)</span></div></div>
    <div class="set-row"><span>함께 나는 기체</span><div data-wgv="peers" class="as-list">${pl}</div></div>
    ${wing.room ? `<div class="set-row"><span>메시지</span><div>${WING_QUICK.map((q, i) => `<button class="sim-btn" data-wg="q:${i}">${q}</button>`).join('')}</div></div>
    <div class="set-row"><span></span><div><input type="text" data-wgv="msg" maxlength="80" placeholder="직접 적기"><button class="sim-btn" data-wg="send">보내기</button></div></div>
    <div class="set-row"><span>받은 것</span><div data-wgv="msgs" class="as-list">${ml}</div></div>` : ''}
    <div class="set-note">상대 기체는 TCAS · PFD TCAS 창 · 3D 화면 · 전탐석 레이더에 교통으로, 2D 지도에 콜사인과 비행계획(수색 항로, 점선)으로 보입니다. 같은 와이파이가 아니어도 인터넷 중계로 이어집니다(암호화).</div></div>`;
  if (wing.room && typeof qrSvg === 'function') { qrSvg(code).then(svg => { const q = w.querySelector('[data-wgv="qr"]'); if (q) q.innerHTML = svg; }).catch(_swallow); }
}

try { appRegister({ toggleCrewPm, toggleAssets, toggleWing }); } catch (e) { _swallow(e); }
