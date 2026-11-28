'use strict';
// ══════════════════════════════════════════════════════
// 41-atc.js — ATC 창(관제석): ASR(공항 감시 레이더) · PAR(정밀 접근 레이더 — 방위 · 고도) · 관제 지시 · 멀티 관제
//
// 창 위 탭 'ATC' 로 어느 창에나 띄운다(07a-panels.js applyPanels → atcPanelSync).
//   ① 공항(ICAO) · 착륙 활주로를 고르면 그 공항 기준점(ARP)에 ASR, 고른 활주로 접지점에 PAR 을 둔다
//   ② ASR — 북쪽 위 · 거리 고리 · 활주로 · 연장선(1NM 눈금) · 표적(내 기체 · 협동 비행 기체 · 교통)과 자료 꼬리표
//      (콜사인 / 고도 百ft · 승강 화살표 / 지상속도 · 기수) · 지난 자리 점 · 누르면 고른다
//   ③ PAR — 위: 고도(활공각 3° · 결심고도 200ft) · 아래: 방위(활주로 중심선 · 커버리지 ±20°) · 10NM 까지
//      고른 표적의 활공로 · 중심선 벗어남을 재어 표준 GCA 문구(…miles from touchdown, slightly left of course, turn right heading …, on glidepath)를 만든다
//      '자동 유도'를 켜면 5초마다 그 문구를 불러 준다(혼자 연습 — 관제사 없이 PAR 접근)
//   ④ 관제 지시 — 레이더 포착 · 선회(기수) · 고도 · 속도 · PAR 접근 허가 · 착륙 허가 · 복행 · 관제탑 연락 · 직접 적기
//      고른 표적이 내 기체면 이 기기에서 읽어 주고(음성 · 알림 · 강평), 협동 비행 기체면 그 기기로 보낸다
//   ⑤ 멀티 관제 — 협동 비행 방(40-crew.js · SS4)에 '관제사로 참가'하면 이 기기는 제 기체를 보내지 않고
//      관제 시설(예: RKPK APP)을 3초마다 알린다. 조종사 기기는 지시를 받으면 읽어 주고 WILCO · UNABLE · SAY AGAIN 으로 답한다
// ══════════════════════════════════════════════════════
const ATC_GP = 3, ATC_DH = 200, ATC_PAR_NM = 10, ATC_TD_NM = 0.165;   // 활공각(°) · 결심고도(ft, 접지점 위) · PAR 거리 · 접지점(시단에서 약 1,000ft)
const ATC_UNITS = { APP: 'approach', TWR: 'tower', GCA: 'precision' };
const atc = Object.assign({ apt: 'RKPK', rwy: '', view: 'both', rng: 20, own: true, auto: false, unit: 'APP' },
  (() => { try { return JSON.parse(localStorage.getItem('atcCfg') || 'null') || {}; } catch (e) { return {}; } })(),
  { sel: null, hist: {}, histT: 0, log: [], shown: false, el: null, autoT: 0, sweep: 0, reply: null });
function _atcSave() { try { localStorage.setItem('atcCfg', JSON.stringify({ apt: atc.apt, rwy: atc.rwy, view: atc.view, rng: atc.rng, own: atc.own, auto: atc.auto, unit: atc.unit })); } catch (e) { _swallow(e); } }
const _aEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const _aNE = (la0, lo0, la, lo) => ({ n: (la - la0) * 60, e: (lo - lo0) * 60 * Math.cos(la0 * Math.PI / 180) });   // NM
const _aMag = h => { try { return typeof toMag === 'function' ? toMag(h) : h; } catch (e) { return h; } };
const _a3 = h => String(Math.round(((h % 360) + 360) % 360) || 360).padStart(3, '0');
const _aSay3 = h => _a3(h).split('').join(' ');
function _aRwySay(id) { return String(id || '').replace(/^0/, '').split('').map(c => ({ L: 'left', R: 'right', C: 'center' })[c] || c).join(' '); }

// ── 공항 · 활주로 ──
function atcAirports() { try { return (typeof AIRPORTS !== 'undefined' ? AIRPORTS : []).filter(a => (typeof RUNWAYS !== 'undefined' ? RUNWAYS : []).some(r => r.apt === a.ident && (r.rwys || []).length)); } catch (e) { return []; } }
function atcApt() { try { return AIRPORTS.find(a => a.ident === atc.apt) || null; } catch (e) { return null; } }
// 활주로 끝(착륙 방향)마다 — { id, thr: {lat, lon}, hdg(진방위 · 접근 방향), td: 접지점, elev(ft) }
function atcRwyEnds(apt = atc.apt) {
  const R = (typeof RUNWAYS !== 'undefined' ? RUNWAYS : []).find(r => r.apt === apt); if (!R) return [];
  const out = [];
  for (const r of R.rwys || []) {
    const [i1, i2] = String(r.id).split('/');
    const mk = (id, a, b) => {
      const v = _aNE(a[0], a[1], b[0], b[1]), hdg = (Math.atan2(v.e, v.n) * 180 / Math.PI + 360) % 360, L = Math.hypot(v.n, v.e);
      const f = Math.min(ATC_TD_NM, L / 3) / Math.max(1e-6, L);
      return { id, thr: { lat: a[0], lon: a[1] }, end: { lat: b[0], lon: b[1] }, hdg, len: L, td: { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f }, elev: R.elev || 0 };
    };
    if (i1) out.push(mk(i1, r.a, r.b)); if (i2) out.push(mk(i2, r.b, r.a));
  }
  return out;
}
function atcRwy() { const E = atcRwyEnds(); return E.find(e => e.id === atc.rwy) || E[0] || null; }
function atcFac() { return `${atc.apt} ${atc.unit}`; }
function atcFacSay() { return `${atc.apt} ${ATC_UNITS[atc.unit] || 'approach'}`; }

// ── 표적 — 내 기체 · 협동 비행 기체(교통 remote) · 교통 ──
function atcTargets() {
  const out = [];
  try {
    if (atc.own && !(typeof wing !== 'undefined' && wing.role === 'atc'))
      out.push({ id: 'OWN', kind: 'own', cs: (typeof appSet !== 'undefined' && appSet.callsign) || 'OWN', lat: S.lat, lon: S.lon, alt: S.alt || 0, hdg: S.hdg || 0, spd: S.spd || 0, vs: S.vs || 0 });
  } catch (e) { _swallow(e); }
  try {
    for (const t of (typeof traffic !== 'undefined' ? traffic : [])) {
      const remote = !!t.remote;
      out.push({ id: remote ? 'W:' + t.remote : 'T' + t.id, kind: remote ? 'wing' : 'ai', peer: remote ? t.remote : null,
        cs: t.cs || (t.ac === 'b206' ? `HL${9200 + (+t.id || 0)}` : `KCG5${String(+t.id || 0).padStart(2, '0')}`), lat: t.lat, lon: t.lon, alt: t.alt || 0, hdg: t.hdg || 0, spd: t.spd || 0, vs: t.vs || 0 });
    }
  } catch (e) { _swallow(e); }
  return out;
}
function atcTarget(id) { return atcTargets().find(t => t.id === (id || atc.sel)) || null; }
// ── PAR 풀이 — 접지점 기준 거리 · 옆 · 높이 · 벗어남 · 문구 ──
function atcPar(t, E = atcRwy()) {
  if (!t || !E) return null;
  const u = { n: Math.cos(E.hdg * Math.PI / 180), e: Math.sin(E.hdg * Math.PI / 180) }, r = { n: -u.e, e: u.n };   // 접근 방향 · 그 오른쪽
  const d = _aNE(E.td.lat, E.td.lon, t.lat, t.lon);
  const R = -(d.n * u.n + d.e * u.e), cross = d.n * r.n + d.e * r.e;                // R: 접지점 앞(접근 쪽)으로 NM · cross: 중심선 오른쪽(+) NM
  const h = (t.alt || 0) - E.elev, gpFt = Math.max(0, R) * 6076 * Math.tan(ATC_GP * Math.PI / 180);
  const elevDeg = R > 0.02 ? Math.atan2(h, R * 6076) * 180 / Math.PI : 0, azDeg = R > 0.02 ? Math.atan2(cross, R) * 180 / Math.PI : 0;
  const dE = elevDeg - ATC_GP, aA = Math.abs(azDeg), aE = Math.abs(dE);
  const inCov = R > 0 && R <= ATC_PAR_NM && aA <= 20 && elevDeg > -1 && elevDeg < 8;
  const elevTxt = aE < 0.15 ? 'on glidepath' : `${aE < 0.35 ? 'slightly ' : aE < 0.7 ? '' : 'well '}${dE > 0 ? 'above' : 'below'} glidepath`;
  const azTxt = aA < 0.25 ? 'on course' : `${aA < 0.6 ? 'slightly ' : aA < 1.5 ? '' : 'well '}${cross > 0 ? 'right' : 'left'} of course`;
  const corr = aA < 0.25 ? 0 : -Math.sign(cross) * Math.min(15, Math.max(2, Math.round(aA * 3)));   // 왼쪽이면 오른쪽으로 · 많이 벗어날수록 크게
  const want = (E.hdg + corr + 360) % 360;
  return { R, cross, h, gpFt, elevDeg, azDeg, dE, devFt: h - gpFt, devAzFt: cross * 6076, inCov, elevTxt, azTxt, corr, want, dh: h <= ATC_DH + 20 };
}
// GCA 유도 문구 한 줄
function atcTalk(t, E = atcRwy()) {
  const P = atcPar(t, E); if (!P || !P.inCov) return null;
  const cs = t.cs, parts = [];
  const rr = Math.max(0.5, Math.round(P.R * 2) / 2);
  if (P.R < 0.35) return `${cs}, over landing threshold.`;
  parts.push(P.dh ? 'at decision height' : P.R < 1.2 ? 'approaching decision height' : `${rr} mile${rr === 1 ? '' : 's'} from touchdown`);
  parts.push(P.azTxt + (P.corr ? `, turn ${P.corr > 0 ? 'right' : 'left'} heading ${_aSay3(_aMag(P.want))}` : ''));
  parts.push(P.elevTxt);
  if (P.dE < -0.7 && P.R < 2) parts.push('too low for safe approach, if runway not in sight, execute missed approach');
  return `${cs}, ${parts.join(', ')}.`;
}

// ── 지시 보내기 ──
function atcLog(dir, txt) { atc.log.unshift({ t: Date.now(), dir, txt }); if (atc.log.length > 40) atc.log.pop(); _atcRenderSide(); }
function atcSend(t, text, opt = {}) {
  if (!t || !text) return false;
  atcLog('▶', text);
  try { if (typeof fdrNote === 'function') fdrNote(`ATC ${atcFac()} → ${t.cs}: ${text}`); } catch (e) { _swallow(e); }
  if (t.kind === 'own') { _atcHear({ from: atcFac(), text, id: 'local' }); return true; }
  if (t.kind === 'wing' && typeof _wingPub === 'function' && wing.room) { _wingPub({ type: 'atc', id: wing.id, to: t.peer, from: atcFac(), text, q: opt.q || '' }); return true; }
  try { if (!opt.quiet) uiToast(`📡 ${t.cs} — 교통(AI)은 지시를 따르지 않습니다(연습 기록만)`, 'warn', 3000); } catch (e) { _swallow(e); }
  return true;
}
// 문구 만들기 — 고른 표적 · 입력값으로
function atcPhrase(k, t, v = {}) {
  if (!t) return null;
  const cs = t.cs, fac = atcFacSay(), apt = atcApt(), E = atcRwy(), rw = E ? _aRwySay(E.id) : '';
  if (k === 'contact') { const d = apt ? _aNE(apt.lat, apt.lon, t.lat, t.lon) : { n: 0, e: 0 }, nm = Math.hypot(d.n, d.e), b = (Math.atan2(d.e, d.n) * 180 / Math.PI + 360) % 360;
    return `${cs}, ${fac}, radar contact, ${Math.round(nm)} miles ${['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(b / 45) % 8]} of ${atc.apt}.`; }
  if (k === 'hdg') { const h = Number.isFinite(+v.hdg) ? +v.hdg : _aMag(t.hdg); const cur = _aMag(t.hdg), dl = ((h - cur + 540) % 360) - 180;
    return `${cs}, turn ${dl >= 0 ? 'right' : 'left'} heading ${_aSay3(h)}.`; }
  if (k === 'alt') { const a = Math.max(0, +v.alt || 0); return `${cs}, ${a > (t.alt || 0) + 50 ? 'climb' : a < (t.alt || 0) - 50 ? 'descend' : 'maintain'} and maintain ${a} feet.`; }
  if (k === 'spd') { const s = Math.max(0, +v.spd || 0); return `${cs}, ${s < (t.spd || 0) ? 'reduce' : 'increase'} speed to ${s} knots.`; }
  if (k === 'par') return `${cs}, this will be a precision approach, runway ${rw}. Do not acknowledge further transmissions.`;
  if (k === 'land') { const wd = typeof windDir === 'number' ? Math.round(windDir / 10) * 10 : 0, ws = typeof windSpd === 'number' ? Math.round(windSpd) : 0; return `${cs}, runway ${rw}, wind ${_aSay3(wd || 360)} at ${ws}, cleared to land.`; }
  if (k === 'ga') return `${cs}, go around, climb and maintain 2000 feet, report runway in sight.`;
  if (k === 'twr') return `${cs}, contact ${atc.apt} tower.`;
  if (k === 'talk') return atcTalk(t);
  return null;
}
// 조종사 쪽 — 지시를 듣는다(내 기체 · 다른 기기에서 온 것)
function _atcHear(m) {
  try { if (typeof speak === 'function') speak(m.text); } catch (e) { _swallow(e); }
  try { uiToast(`📡 ${m.from}: ${m.text}`, '', 7000); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function' && m.id !== 'local') fdrNote(`ATC ${m.from}: ${m.text}`); } catch (e) { _swallow(e); }
  atc.reply = m.id === 'local' ? null : { to: m.id, from: m.from, text: m.text, t: Date.now() };
  _atcReplyCard();
}
function _atcReplyCard() {
  let c = document.getElementById('atc-reply');
  const r = atc.reply;
  if (!r) { if (c) c.style.display = 'none'; return; }
  if (!c) {
    c = document.createElement('div'); c.id = 'atc-reply'; document.body.appendChild(c);
    c.addEventListener('click', e => { const b = e.target.closest('[data-atr]'); if (!b) return; atcPilotReply(b.dataset.atr); });
  }
  c.innerHTML = `<b>📡 ${_aEsc(r.from)}</b><span>${_aEsc(r.text)}</span><div><button class="sim-btn" data-atr="WILCO">WILCO</button><button class="sim-btn" data-atr="UNABLE">UNABLE</button><button class="sim-btn" data-atr="SAY AGAIN">SAY AGAIN</button><button class="sim-btn" data-atr="x">✕</button></div>`;
  c.style.display = 'flex';
}
function atcPilotReply(word) {
  const r = atc.reply; atc.reply = null; _atcReplyCard();
  if (!r || word === 'x') return false;
  const cs = (typeof appSet !== 'undefined' && appSet.callsign) || 'OWN';
  try { if (typeof _wingPub === 'function') _wingPub({ type: 'atcr', id: wing.id, to: r.to, cs, text: word }); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function') fdrNote(`→ ATC: ${word}`); } catch (e) { _swallow(e); }
  return true;
}
// 협동 비행 방의 관제 소식(40-crew.js _wingIn 이 먼저 묻는다) — 다룬 것이면 true
function atcOnWing(m) {
  if (!m || !m.type) return false;
  if (m.type === 'ctl') {
    const fresh = !wing.ctl[m.id];
    wing.ctl[m.id] = { name: m.name, apt: m.apt, rwy: m.rwy, t: Date.now() };
    if (fresh) { try { uiToast(`📡 관제 ${m.name} 이(가) 방에 들어왔습니다 — 지시를 따르십시오`, 'ok', 5000); } catch (e) { _swallow(e); } try { if (typeof _wingRender === 'function') _wingRender(true); } catch (e) { _swallow(e); } }
    return true;
  }
  if (m.type === 'atc') { if (m.to === wing.id || m.to === '*') _atcHear({ from: m.from, text: m.text, id: m.id }); return true; }
  if (m.type === 'atcr') {
    if (m.to === wing.id) { atcLog('◀', `${m.cs}: ${m.text}`); try { uiToast(`📡 ${m.cs}: ${m.text}`, m.text === 'WILCO' ? 'ok' : 'warn', 3500); } catch (e) { _swallow(e); } }
    return true;
  }
  return false;
}
// 관제사 기기 — 3초마다(협동 비행 1초 박자 중 셋에 하나) 관제 시설을 알린다
let _atcBeatN = 0;
function atcWingBeat() { if ((_atcBeatN++ % 3) !== 0) return; try { const E = atcRwy(); _wingPub({ type: 'ctl', id: wing.id, name: atcFac(), apt: atc.apt, rwy: E ? E.id : '' }); } catch (e) { _swallow(e); } }
// 관제 시설 알림이 10초 넘게 없으면 지운다(조종사 쪽)
setInterval(() => { try { if (typeof wing === 'undefined' || !wing.ctl) return; const now = Date.now(); let ch = false; for (const k of Object.keys(wing.ctl)) if (now - wing.ctl[k].t > 10000) { delete wing.ctl[k]; ch = true; } if (ch && typeof _wingRender === 'function') _wingRender(true); } catch (e) { _swallow(e); } }, 2000);

// ── 지난 자리 · 자동 유도 ──
setInterval(() => {
  const now = Date.now();
  if (now - atc.histT >= 4000) {
    atc.histT = now; const seen = new Set();
    for (const t of atcTargets()) { seen.add(t.id); const H = atc.hist[t.id] || (atc.hist[t.id] = []); H.push([t.lat, t.lon, t.alt]); if (H.length > 8) H.shift(); }
    for (const k of Object.keys(atc.hist)) if (!seen.has(k)) delete atc.hist[k];
  }
  if (atc.auto && now - atc.autoT >= 5000) {
    const t = atcTarget(); if (t) { const txt = atcTalk(t); if (txt) { atc.autoT = now; atcSend(t, txt, { quiet: true }); } }
  }
}, 500);

// ── 창 ──
function atcPanelSync(want) {
  const wrap = document.getElementById('atc-wrap'); if (!wrap) return;
  atc.shown = !!want;
  if (!want) return;
  if (!atc.el || !wrap.contains(atc.el)) { atc.el = _atcBuild(); wrap.innerHTML = ''; wrap.appendChild(atc.el); }
  _atcRenderTop(); _atcRenderSide(); _atcDraw();
}
function _atcBuild() {
  const R = document.createElement('div'); R.id = 'atc-root';
  R.innerHTML = `<div class="atc-top" data-av="top"></div>
    <div class="atc-body"><div class="atc-scopes"><canvas class="atc-asr"></canvas><canvas class="atc-par"></canvas></div><div class="atc-side" data-av="side"></div></div>`;
  R.addEventListener('change', e => {
    const k = e.target.dataset.atcv; if (!k) return;
    if (k === 'apt') { atc.apt = e.target.value; atc.rwy = ''; atc.hist = {}; }
    else if (k === 'rwy') atc.rwy = e.target.value;
    else if (k === 'unit') atc.unit = e.target.value;
    _atcSave(); _atcRenderTop(); _atcRenderSide(); _atcDraw();
  });
  R.addEventListener('click', e => {
    const b = e.target.closest('[data-at]');
    if (!b) {
      const cv = e.target.closest('canvas.atc-asr'); if (cv) _atcPick(cv, e);
      return;
    }
    const [k, v] = b.dataset.at.split(':'), t = atcTarget();
    if (k === 'view') atc.view = v;
    else if (k === 'rng') atc.rng = +v;
    else if (k === 'own') atc.own = !atc.own;
    else if (k === 'auto') { atc.auto = !atc.auto; atc.autoT = 0; }
    else if (k === 'sel') atc.sel = v + (b.dataset.at.split(':').slice(2).length ? ':' + b.dataset.at.split(':').slice(2).join(':') : '');
    else if (k === 'say' && t) { const val = { hdg: R.querySelector('[data-atcv="ihdg"]').value, alt: R.querySelector('[data-atcv="ialt"]').value, spd: R.querySelector('[data-atcv="ispd"]').value };
      if ((v === 'hdg' && val.hdg === '') || (v === 'alt' && val.alt === '') || (v === 'spd' && val.spd === '')) { try { uiToast('값을 먼저 넣으십시오', 'warn'); } catch (er) { _swallow(er); } return; }
      const txt = atcPhrase(v, t, val); if (txt) atcSend(t, txt); else try { uiToast('PAR 범위 밖입니다(10NM · ±20° 안의 접근 쪽)', 'warn'); } catch (er) { _swallow(er); } }
    else if (k === 'free' && t) { const i = R.querySelector('[data-atcv="ifree"]'); const txt = i.value.trim(); if (txt) { atcSend(t, `${t.cs}, ${txt}`); i.value = ''; } }
    else if (k === 'wing') { if (typeof toggleWing === 'function') toggleWing(); return; }
    _atcSave(); _atcRenderTop(); _atcRenderSide(); _atcDraw();
  });
  R.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
  return R;
}
function _atcRenderTop() {
  const el = atc.el && atc.el.querySelector('[data-av="top"]'); if (!el) return;
  const A = atcAirports(), E = atcRwyEnds(), cur = atcRwy();
  const btn = (k, v, l, on) => `<button class="atc-b${on ? ' on' : ''}" data-at="${k}:${v}">${l}</button>`;
  el.innerHTML = `<b>📡 ATC</b>
    <select data-atcv="apt">${A.map(a => `<option value="${a.ident}" ${a.ident === atc.apt ? 'selected' : ''}>${a.ident} ${_aEsc(a.name)}</option>`).join('')}</select>
    <select data-atcv="rwy" title="착륙 활주로 — PAR 을 이 활주로 접지점에">${E.map(e => `<option value="${e.id}" ${cur && e.id === cur.id ? 'selected' : ''}>RWY ${e.id}</option>`).join('')}</select>
    <select data-atcv="unit">${Object.keys(ATC_UNITS).map(u => `<option value="${u}" ${u === atc.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
    ${btn('view', 'asr', 'ASR', atc.view === 'asr')}${btn('view', 'par', 'PAR', atc.view === 'par')}${btn('view', 'both', 'ASR+PAR', atc.view === 'both')}
    <span class="atc-sp"></span>${[5, 10, 20, 40, 60].map(r => btn('rng', r, r + 'NM', atc.rng === r)).join('')}
    ${btn('own', 1, '내 기체', atc.own)}${btn('auto', 1, '자동 PAR 유도', atc.auto)}
    <button class="atc-b" data-at="wing:1" title="협동 비행 방 — 관제사로 참가하면 다른 기기의 기체를 관제합니다">${typeof wing !== 'undefined' && wing.room ? (wing.role === 'atc' ? '🎧 관제 중(방)' : '✈ 방') : '✈ 방 · 관제사 참가'}</button>`;
}
function _atcRenderSide() {
  const el = atc.el && atc.el.querySelector('[data-av="side"]'); if (!el || !atc.shown) return;
  const T = atcTargets(); if (atc.sel && !T.some(t => t.id === atc.sel)) atc.sel = null;
  if (!atc.sel && T.length) atc.sel = T[0].id;
  const t = atcTarget(), P = t ? atcPar(t) : null, apt = atcApt();
  const list = T.length ? T.map(x => { const d = apt ? _aNE(apt.lat, apt.lon, x.lat, x.lon) : { n: 0, e: 0 };
    return `<button class="atc-t${x.id === atc.sel ? ' on' : ''}" data-at="sel:${x.id}"><b>${_aEsc(x.cs)}</b> ${x.kind === 'own' ? '내 기체' : x.kind === 'wing' ? '방' : 'AI'} · ${Math.hypot(d.n, d.e).toFixed(1)}NM · ${Math.round(x.alt)}ft</button>`; }).join('') : '<i>표적 없음</i>';
  const par = P ? `<div class="atc-par-rd">${P.inCov ? `R ${P.R.toFixed(2)}NM · 활공로 ${P.devFt >= 0 ? '+' : ''}${Math.round(P.devFt)}ft(${P.dE >= 0 ? '+' : ''}${P.dE.toFixed(2)}°) · 중심선 ${P.devAzFt >= 0 ? 'R' : 'L'} ${Math.abs(Math.round(P.devAzFt))}ft(${P.azDeg.toFixed(2)}°)<br><b>${_aEsc(P.azTxt)} · ${_aEsc(P.elevTxt)}</b>` : 'PAR 범위 밖 — 활주로 10NM · ±20° 안 접근 쪽'}</div>` : '';
  const who = typeof wing !== 'undefined' && wing.room ? (wing.role === 'atc' ? `🎧 관제사로 방에 · 조종사 ${Object.keys(wing.peers || {}).length}명` : '✈ 조종사로 방에') : '방 없음 — 이 기기의 기체만(혼자 연습)';
  el.innerHTML = `<div class="atc-h">${_aEsc(atcFac())} · ${who}</div>
    <div class="atc-list">${list}</div>${par}
    <div class="atc-h">지시 — ${t ? _aEsc(t.cs) : '표적을 고르십시오'}</div>
    <div class="atc-cmd">
      <button class="atc-b" data-at="say:contact">레이더 포착</button><button class="atc-b" data-at="say:talk">PAR 유도 한 번</button>
      <button class="atc-b" data-at="say:par">PAR 접근 허가</button><button class="atc-b" data-at="say:land">착륙 허가</button>
      <button class="atc-b" data-at="say:ga">복행</button><button class="atc-b" data-at="say:twr">관제탑 연락</button>
      <div class="atc-in"><input type="number" data-atcv="ihdg" placeholder="기수°" min="1" max="360"><button class="atc-b" data-at="say:hdg">선회</button>
      <input type="number" data-atcv="ialt" placeholder="고도ft" min="0" step="100"><button class="atc-b" data-at="say:alt">고도</button>
      <input type="number" data-atcv="ispd" placeholder="kt" min="0"><button class="atc-b" data-at="say:spd">속도</button></div>
      <div class="atc-in"><input type="text" data-atcv="ifree" placeholder="직접 적기(영어) — 콜사인은 앞에 붙습니다"><button class="atc-b" data-at="free:1">보내기</button></div>
    </div>
    <div class="atc-h">교신 기록</div><div class="atc-log">${atc.log.slice(0, 12).map(l => `<div class="${l.dir === '◀' ? 'in' : ''}">${l.dir} ${_aEsc(l.txt)}</div>`).join('') || '<i>없음</i>'}</div>`;
  el.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
}
function _atcFit(cv) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (W > 0 && H > 0 && (cv.width !== W || cv.height !== H)) { cv.width = W; cv.height = H; }
  return { W: cv.width, H: cv.height, k: dpr };
}
function _atcPick(cv, e) {
  const apt = atcApt(); if (!apt) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, cx = r.width / 2, cy = r.height / 2, sc = Math.min(r.width, r.height) / 2 / atc.rng;
  let best = null, bd = 22;
  for (const t of atcTargets()) { const d = _aNE(apt.lat, apt.lon, t.lat, t.lon), px = cx + d.e * sc, py = cy - d.n * sc, dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = t; } }
  if (best) { atc.sel = best.id; _atcRenderSide(); _atcDraw(); }
}
function _atcDraw() {
  if (!atc.shown || !atc.el) return;
  const a = atc.el.querySelector('.atc-asr'), p = atc.el.querySelector('.atc-par');
  a.style.display = atc.view === 'par' ? 'none' : ''; p.style.display = atc.view === 'asr' ? 'none' : '';
  atc.el.querySelector('.atc-scopes').className = 'atc-scopes v-' + atc.view;
  try { if (atc.view !== 'par') atcDrawAsr(a); } catch (e) { _swallow(e); }
  try { if (atc.view !== 'asr') atcDrawPar(p); } catch (e) { _swallow(e); }
}
// ASR 화면
function atcDrawAsr(cv) {
  const { W, H, k } = _atcFit(cv); if (!(W > 0)) return;
  const g = cv.getContext('2d'), apt = atcApt(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#020a06'; g.fillRect(0, 0, W, H); if (!apt) return;
  const cx = W / 2, cy = H / 2, sc = Math.min(W, H) / 2 / atc.rng, P = (la, lo) => { const d = _aNE(apt.lat, apt.lon, la, lo); return [cx + d.e * sc, cy - d.n * sc]; };
  const G = '#2fdc6a';
  // 쓸고 가는 빔(4.8초에 한 바퀴)
  atc.sweep = (performance.now() / 4800 * 2 * Math.PI) % (2 * Math.PI);
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) / 2); gr.addColorStop(0, 'rgba(47,220,106,0.10)'); gr.addColorStop(1, 'rgba(47,220,106,0.02)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, Math.min(W, H) / 2, atc.sweep - Math.PI / 2 - 0.35, atc.sweep - Math.PI / 2); g.closePath(); g.fill();
  // 거리 고리 · 방위
  g.strokeStyle = 'rgba(47,220,106,0.35)'; g.lineWidth = 1 * k; g.font = `${11 * k}px monospace`; g.fillStyle = 'rgba(47,220,106,0.7)';
  for (let i = 1; i <= 4; i++) { const rr = atc.rng * i / 4 * sc; g.beginPath(); g.arc(cx, cy, rr, 0, 2 * Math.PI); g.stroke(); g.fillText(`${+(atc.rng * i / 4).toFixed(1)}`, cx + 3 * k, cy - rr + 12 * k); }
  for (let b = 0; b < 360; b += 30) { const t = b * Math.PI / 180; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(t) * atc.rng * sc, cy - Math.cos(t) * atc.rng * sc); g.stroke(); }
  // 활주로 · 연장선(1NM 눈금 · 10NM)
  const E = atcRwy();
  for (const e of atcRwyEnds()) { const [x1, y1] = P(e.thr.lat, e.thr.lon), [x2, y2] = P(e.end.lat, e.end.lon); g.strokeStyle = '#d8e8e0'; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  if (E) {
    const back = (E.hdg + 180) * Math.PI / 180, [tx, ty] = P(E.thr.lat, E.thr.lon);
    g.strokeStyle = 'rgba(255,210,80,0.7)'; g.lineWidth = 1 * k; g.setLineDash([6 * k, 5 * k]); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.sin(back) * 10 * sc, ty - Math.cos(back) * 10 * sc); g.stroke(); g.setLineDash([]);
    for (let i = 1; i <= 10; i++) { const px = tx + Math.sin(back) * i * sc, py = ty - Math.cos(back) * i * sc, nx = Math.cos(back) * 4 * k, ny = Math.sin(back) * 4 * k; g.beginPath(); g.moveTo(px - nx, py - ny); g.lineTo(px + nx, py + ny); g.stroke(); }
    g.fillStyle = '#ffd250'; g.fillText(`RWY ${E.id}`, tx + 6 * k, ty - 6 * k);
  }
  // 표적
  for (const t of atcTargets()) {
    const [x, y] = P(t.lat, t.lon), sel = t.id === atc.sel, col = sel ? '#ffd23a' : t.kind === 'own' ? '#7ff' : t.kind === 'wing' ? '#ff9f43' : G;
    g.fillStyle = 'rgba(47,220,106,0.45)';
    for (const [la, lo] of (atc.hist[t.id] || [])) { const [hx, hy] = P(la, lo); g.beginPath(); g.arc(hx, hy, 1.8 * k, 0, 2 * Math.PI); g.fill(); }
    g.strokeStyle = col; g.lineWidth = 1.5 * k; g.strokeRect(x - 4 * k, y - 4 * k, 8 * k, 8 * k);
    const v = (t.spd || 0) / 60 * 1, th = t.hdg * Math.PI / 180; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(th) * v * sc, y - Math.cos(th) * v * sc); g.stroke();   // 1분 예상선
    g.beginPath(); g.moveTo(x + 4 * k, y - 4 * k); g.lineTo(x + 14 * k, y - 14 * k); g.stroke();
    g.fillStyle = col; g.font = `bold ${11 * k}px monospace`; g.textAlign = 'left';
    const vsA = t.vs > 300 ? '↑' : t.vs < -300 ? '↓' : ' ';
    g.fillText(t.cs, x + 16 * k, y - 26 * k); g.font = `${11 * k}px monospace`;
    g.fillText(`A${String(Math.max(0, Math.round(t.alt / 100))).padStart(3, '0')}${vsA} ${String(Math.round(t.spd)).padStart(3, '0')}`, x + 16 * k, y - 14 * k);
    g.fillText(`H${_a3(_aMag(t.hdg))}`, x + 16 * k, y - 2 * k);
  }
  g.fillStyle = G; g.font = `bold ${12 * k}px monospace`; g.textAlign = 'left';
  g.fillText(`ASR ${atc.apt}  ${atc.rng}NM  N↑`, 8 * k, 16 * k);
  g.textAlign = 'right'; const d = new Date(); g.fillText(`${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`, W - 8 * k, 16 * k);
}
// PAR 화면 — 위 고도 · 아래 방위
function atcDrawPar(cv) {
  const { W, H, k } = _atcFit(cv); if (!(W > 0)) return;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#020a06'; g.fillRect(0, 0, W, H);
  const E = atcRwy(), G = '#2fdc6a'; if (!E) { g.fillStyle = '#888'; g.font = `${13 * k}px sans-serif`; g.fillText('이 공항에는 활주로 자료가 없습니다', 12 * k, 24 * k); return; }
  const L = 50 * k, Rm = W - 12 * k, X = R => Rm - (Rm - L) * R / ATC_PAR_NM;
  const hTop = 18 * k, hBot = H / 2 - 12 * k, aTop = H / 2 + 14 * k, aBot = H - 16 * k;
  const maxFt = ATC_PAR_NM * 6076 * Math.tan(7 * Math.PI / 180), Yh = ft => hBot - (hBot - hTop) * Math.max(0, Math.min(1, ft / maxFt));
  const maxLat = ATC_PAR_NM * Math.tan(10 * Math.PI / 180), aMid = (aTop + aBot) / 2, Ya = nm => aMid - (aBot - aTop) / 2 * Math.max(-1, Math.min(1, nm / maxLat));
  g.strokeStyle = 'rgba(47,220,106,0.3)'; g.lineWidth = 1 * k; g.font = `${10 * k}px monospace`; g.fillStyle = 'rgba(47,220,106,0.7)'; g.textAlign = 'center';
  for (let r = 0; r <= ATC_PAR_NM; r++) { g.beginPath(); g.moveTo(X(r), hTop); g.lineTo(X(r), hBot); g.moveTo(X(r), aTop); g.lineTo(X(r), aBot); g.stroke(); g.fillText(String(r), X(r), hBot + 10 * k); }
  // 활공로 · 안전 하한(활공각 −0.5°) · 결심고도
  const gp = R => R * 6076 * Math.tan(ATC_GP * Math.PI / 180);
  g.strokeStyle = '#ffd250'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(X(0), Yh(0)); g.lineTo(X(ATC_PAR_NM), Yh(gp(ATC_PAR_NM))); g.stroke();
  g.strokeStyle = 'rgba(255,80,80,0.6)'; g.lineWidth = 1 * k; g.setLineDash([5 * k, 4 * k]); g.beginPath(); g.moveTo(X(0), Yh(0)); g.lineTo(X(ATC_PAR_NM), Yh(ATC_PAR_NM * 6076 * Math.tan((ATC_GP - 0.5) * Math.PI / 180))); g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(L, Yh(ATC_DH)); g.lineTo(Rm, Yh(ATC_DH)); g.stroke();
  // 중심선 · 커버리지
  g.strokeStyle = '#ffd250'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(X(0), aMid); g.lineTo(X(ATC_PAR_NM), aMid); g.stroke();
  g.strokeStyle = 'rgba(47,220,106,0.5)'; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(X(0), aMid); g.lineTo(X(ATC_PAR_NM), Ya(maxLat)); g.moveTo(X(0), aMid); g.lineTo(X(ATC_PAR_NM), Ya(-maxLat)); g.stroke();
  g.textAlign = 'left'; g.fillStyle = G; g.font = `bold ${11 * k}px monospace`;
  g.fillText(`PAR RWY ${E.id}  GP ${ATC_GP.toFixed(1)}°  DH ${ATC_DH}`, 8 * k, 12 * k); g.fillText('ELEVATION', 4 * k, (hTop + hBot) / 2); g.fillText('AZIMUTH', 4 * k, aMid);
  g.fillText('L', 6 * k, aTop + 8 * k); g.fillText('R', 6 * k, aBot - 2 * k);
  // 표적(커버리지 안) — 고른 것은 노랑 · 지난 자리
  for (const t of atcTargets()) {
    const p = atcPar(t, E); if (!p || !p.inCov) continue;
    const sel = t.id === atc.sel, col = sel ? '#ffd23a' : t.kind === 'own' ? '#7ff' : G;
    g.fillStyle = 'rgba(47,220,106,0.45)';
    for (const [la, lo, al] of (atc.hist[t.id] || [])) { const q = atcPar({ lat: la, lon: lo, alt: al }, E); if (q && q.R > 0 && q.R <= ATC_PAR_NM) { g.beginPath(); g.arc(X(q.R), Yh(q.h), 1.8 * k, 0, 7); g.fill(); g.beginPath(); g.arc(X(q.R), Ya(q.cross), 1.8 * k, 0, 7); g.fill(); } }
    g.fillStyle = col; g.beginPath(); g.arc(X(p.R), Yh(p.h), 4 * k, 0, 7); g.fill(); g.beginPath(); g.arc(X(p.R), Ya(p.cross), 4 * k, 0, 7); g.fill();
    g.font = `${10 * k}px monospace`; g.fillText(t.cs, X(p.R) + 6 * k, Yh(p.h) - 6 * k);
    if (sel) {
      g.font = `bold ${12 * k}px monospace`; g.textAlign = 'right';
      g.fillText(`${p.devFt >= 0 ? '+' : ''}${Math.round(p.devFt)}ft  ${p.elevTxt.toUpperCase()}`, Rm, hTop + 14 * k);
      g.fillText(`${p.devAzFt >= 0 ? 'R' : 'L'}${Math.abs(Math.round(p.devAzFt))}ft  ${p.azTxt.toUpperCase()}`, Rm, aTop + 2 * k);
      g.fillText(`RANGE ${p.R.toFixed(2)}NM`, Rm, H - 3 * k); g.textAlign = 'left';
    }
  }
}
setInterval(() => { if (atc.shown) { _atcDraw(); if ((atc._sideN = (atc._sideN || 0) + 1) % 4 === 0) { const a = document.activeElement; if (!(a && atc.el && atc.el.contains(a) && a.tagName === 'INPUT')) _atcRenderSide(); } } }, 250);
function openAtc() { try { selectPanel('right', 'atc'); } catch (e) { _swallow(e); } }
try { appRegister({ openAtc, atcPanelSync }); } catch (e) { _swallow(e); }
