'use strict';
// ══════════════════════════════════════════════════════
// 33-train4.js — 훈련 보강 4
//   계기 고장(속도계 · 고도계 · 승강계 고착 · AHRS · 나침반 오차) · 브라운아웃/화이트아웃 · 교통(TCAS 연습) ·
//   METAR 로 환경 맞추기 · 설정 한곳(⚙) · 도구 메뉴(🧰) · 다른 기기 교관 연결(WebRTC)
// ══════════════════════════════════════════════════════

// ── ① 계기 고장(교관 · IOS) — 그리는 동안만 값을 바꿔 보인다(비행 모델은 그대로) ──
//   asi · alt · vsi — 고장 난 순간의 값에 굳는다(피토 · 정압 막힘) / ahrs — 자세가 그 자리에 굳고 ATT FAIL
//   hdg — 나침반(기수)이 n° 어긋난다
const instFail = { asi: null, alt: null, vsi: null, ahrs: null, hdg: 0 };
function instFailSet(kind, on, val) {
  if (kind === 'asi') instFail.asi = on ? S.spd : null;
  else if (kind === 'alt') instFail.alt = on ? S.alt : null;
  else if (kind === 'vsi') instFail.vsi = on ? S.vs : null;
  else if (kind === 'ahrs') instFail.ahrs = on ? { pit: S.pit, bnk: S.bnk } : null;
  else if (kind === 'hdg') instFail.hdg = on ? (Number.isFinite(+val) ? +val : 25) : 0;
  try { if (typeof fdrNote === 'function') fdrNote(`계기 고장 ${kind} ${on ? '걸림' : '풀림'}`, on ? 'err' : ''); } catch (e) { _swallow(e); }
}
function instFailAny() { return instFail.asi !== null || instFail.alt !== null || instFail.vsi !== null || !!instFail.ahrs || !!instFail.hdg; }
// 그리는 동안 S 를 바꿔 두고 되돌리는 함수를 돌려준다
function instFailApply() {
  if (!instFailAny()) return () => {};
  const keep = { spd: S.spd, alt: S.alt, vs: S.vs, pit: S.pit, bnk: S.bnk, hdg: S.hdg };
  if (instFail.asi !== null) S.spd = instFail.asi;
  if (instFail.alt !== null) S.alt = instFail.alt;
  if (instFail.vsi !== null) S.vs = instFail.vsi;
  if (instFail.ahrs) { S.pit = instFail.ahrs.pit; S.bnk = instFail.ahrs.bnk; }
  if (instFail.hdg) S.hdg = ((S.hdg + instFail.hdg) % 360 + 360) % 360;
  return () => Object.assign(S, keep);
}
(function wrapDraw() {
  const wrap = (name, after) => {
    const f = window[name]; if (typeof f !== 'function' || f._instWrapped) return;
    const g = function (...a) { const r = instFailApply(); try { return f.apply(this, a); } finally { r(); if (after) try { after.apply(this, a); } catch (e) { _swallow(e); } } };
    g._instWrapped = true; window[name] = g;
  };
  // PFD — AHRS 고장이면 ATT FAIL(빨강)
  wrap('drawPFD', () => {
    if (!instFail.ahrs || typeof ctx === 'undefined' || !cvs || (typeof acB206 === 'function' && acB206())) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `bold ${Math.max(14, cvs.width * 0.04)}px Arial`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff3030';
    ctx.fillText('ATT FAIL', cvs.width * 0.36, cvs.height * 0.18); ctx.restore();
  });
  wrap('b206Draw'); wrap('b206OverlayDraw');
})();

// ── 설정(⚙) — 이 기기 'appSet' ──
const appSet = { callsign: 'Coastguard zero one', atcVoice: true, readback: true, rate: 1.05 };
try { Object.assign(appSet, JSON.parse(localStorage.getItem('appSet') || '{}')); } catch (e) { _swallow(e); }
function appSetSave() { try { localStorage.setItem('appSet', JSON.stringify(appSet)); } catch (e) { _swallow(e); } }

// ── ② 브라운아웃 · 화이트아웃 — ENV 지면(모래 · 눈) 위 40ft 아래 저속 호버면 하강풍 먼지가 시야를 가린다 ──
let envDustOp = 0, _dustWarn = false;
function envDustStep() {
  const host = document.getElementById('map3d'); if (!host) return;
  let el = host.querySelector('.env-dust');
  if (!el) { el = document.createElement('div'); el.className = 'env-dust'; host.appendChild(el); }
  const sf = (typeof env !== 'undefined') ? env.surface : 'normal';
  let tgt = 0;
  if (sf === 'sand' || sf === 'snow') {
    let agl = 1000; try { agl = radarAltFt(); } catch (e) { _swallow(e); }
    let tq = 0; try { tq = tqShown(); } catch (e) { _swallow(e); }
    let gnd = false; try { gnd = typeof sndOnGround === 'function' && sndOnGround(); } catch (e) { _swallow(e); }
    const spd = Math.abs(S.spd || 0);
    if (agl < 40 && tq > 30 && spd < 20 && !(gnd && tq < 45)) tgt = Math.min(1, (40 - agl) / 25) * Math.min(1, (20 - spd) / 10) * (sf === 'snow' ? 0.95 : 0.9);
  }
  envDustOp += (tgt - envDustOp) * 0.12;
  el.className = 'env-dust ' + (sf === 'snow' ? 'snow' : 'sand');
  el.style.opacity = envDustOp.toFixed(2);
  if (envDustOp > 0.7 && !_dustWarn) { _dustWarn = true; try { if (typeof fdrNote === 'function') fdrNote(sf === 'snow' ? '화이트아웃' : '브라운아웃', 'warn'); } catch (e) { _swallow(e); } }
  if (envDustOp < 0.2) _dustWarn = false;
}
setInterval(() => { try { envDustStep(); } catch (e) { _swallow(e); } }, 100);

// ── ③ 교통(TCAS 연습) — ENV 교통량(0 · 1 · 3 · 5) 만큼 둘레에 다른 항공기를 띄운다 ──
//   셋에 하나는 내 기체 쪽으로 다가온다. TA(6NM · ±1,200ft 안에서 다가오면) "Traffic, traffic" ·
//   RA(흰수리 · 3NM · ±600ft · 25초 안) "Climb, climb" / "Descend, descend" · 풀리면 "Clear of conflict"
//   PFD 오른쪽 아래 TCAS 창 · 지도 · 3D 화면(밤에는 불빛)에 보인다
const traffic = [];
let _tfcT = 0, _tfcSeq = 0;
const _tNE = (la1, lo1, la2, lo2) => ({ n: (la2 - la1) * 60, e: (lo2 - lo1) * 60 * Math.cos(la1 * Math.PI / 180) });   // NM
function _tfcSpawn(toward) {
  const b = Math.random() * 2 * Math.PI, r = 6 + Math.random() * 6;
  const la = S.lat + r * Math.cos(b) / 60, lo = S.lon + r * Math.sin(b) / 60 / Math.cos(S.lat * Math.PI / 180);
  const hd = toward ? ((b * 180 / Math.PI + 180) % 360 + (Math.random() - 0.5) * 20) : Math.random() * 360;
  return { id: ++_tfcSeq, lat: la, lon: lo, alt: Math.max(500, S.alt + (toward ? (Math.random() - 0.5) * 600 : (Math.random() - 0.5) * 3000)), hdg: hd, spd: 90 + Math.random() * 60, vs: 0, st: 'OT' };
}
function trafficStep(dtSim) {
  const want = (typeof env !== 'undefined') ? (env.traffic || 0) : 0;
  while (traffic.length > want) traffic.pop();
  while (traffic.length < want) traffic.push(_tfcSpawn(traffic.length % 3 === 0));
  for (const t of traffic) {
    const d = t.spd * dtSim / 3600, h = t.hdg * Math.PI / 180;
    t.lat += d * Math.cos(h) / 60; t.lon += d * Math.sin(h) / 60 / Math.cos(t.lat * Math.PI / 180); t.alt += t.vs * dtSim / 60;
    const v = _tNE(S.lat, S.lon, t.lat, t.lon); if (Math.hypot(v.n, v.e) > 16) Object.assign(t, _tfcSpawn(Math.random() < 0.4), { id: t.id });
  }
  tcasEval();
}
// 하나하나 — 거리(NM) · 상대 고도(ft) · 다가오는 빠르기(kt) · 상태(OT 다른 · PT 가까운 · TA · RA)
let tcasState = 'CLEAR', _tcasPrev = 'CLEAR', tcasRaSense = 0;
function tcasEval() {
  let worst = 'CLEAR', sense = 0;
  for (const t of traffic) {
    const v = _tNE(S.lat, S.lon, t.lat, t.lon), r = Math.hypot(v.n, v.e), rel = t.alt - S.alt;
    const h = t.hdg * Math.PI / 180, oh = S.hdg * Math.PI / 180;
    const rv = { n: t.spd * Math.cos(h) - (S.spd || 0) * Math.cos(oh), e: t.spd * Math.sin(h) - (S.spd || 0) * Math.sin(oh) };
    const close = -(v.n * rv.n + v.e * rv.e) / Math.max(0.01, r);     // kt(+ 면 다가온다)
    const tau = close > 1 ? r / close * 3600 : 999;
    Object.assign(t, { r, rel, close, tau });
    t.st = (r < 3 && Math.abs(rel) < 600 && tau < 25) ? 'RA' : (r < 6 && Math.abs(rel) < 1200 && (tau < 40 || r < 2)) ? 'TA' : (r < 6 && Math.abs(rel) < 1200) ? 'PT' : 'OT';
    if (t.st === 'RA') { worst = 'RA'; sense = rel <= 0 ? 1 : -1; } else if (t.st === 'TA' && worst !== 'RA') worst = 'TA';
  }
  const b2 = typeof acB206 === 'function' && acB206();
  if (b2 && worst === 'RA') worst = 'TA';                           // Bell 은 RA 가 없다(TA 만)
  tcasState = worst; tcasRaSense = worst === 'RA' ? sense : 0;
  if (worst !== _tcasPrev) {
    const say = (typeof speak === 'function') ? speak : () => {};
    if (worst === 'TA' && _tcasPrev === 'CLEAR') say('Traffic, traffic');
    else if (worst === 'RA') say(sense > 0 ? 'Climb, climb' : 'Descend, descend');
    else if (_tcasPrev === 'RA') say('Clear of conflict');            // RA 가 풀리면(TA 로 내려와도)
    try { if (typeof fdrNote === 'function' && worst !== 'CLEAR') fdrNote(`TCAS ${worst}${worst === 'RA' ? (sense > 0 ? ' CLIMB' : ' DESCEND') : ''}`, worst === 'RA' ? 'err' : 'warn'); } catch (e) { _swallow(e); }
    _tcasPrev = worst;
  }
}
function tcasTargets() { return traffic; }
// PFD TCAS 창에 그린다(03-pfd.js drawPfdInset) — 기수 위 · 6NM 고리
function tcasDrawInset(g, cx, cy, r) {
  const hd = (S.hdg || 0) * Math.PI / 180;
  for (const t of traffic) {
    if (t.r > 6.5) continue;
    const v = _tNE(S.lat, S.lon, t.lat, t.lon), x = v.e * Math.cos(hd) - v.n * Math.sin(hd), y = v.e * Math.sin(hd) + v.n * Math.cos(hd);
    const px = cx + x / 6 * r, py = cy - y / 6 * r, s = 6;
    const col = t.st === 'RA' ? '#ff3030' : t.st === 'TA' ? '#ffb000' : '#ffffff';
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
    if (t.st === 'RA') g.rect(px - s, py - s, s * 2, s * 2);
    else if (t.st === 'TA') g.arc(px, py, s, 0, 7);
    else { g.moveTo(px, py - s); g.lineTo(px + s, py); g.lineTo(px, py + s); g.lineTo(px - s, py); g.closePath(); }
    if (t.st === 'OT') g.stroke(); else g.fill();
    const rel = Math.round(t.rel / 100);
    g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.fillText((rel >= 0 ? '+' : '−') + String(Math.abs(rel)).padStart(2, '0'), px, rel >= 0 ? py - s - 3 : py + s + 10);
  }
}
// 지도 표식
const _tfcMk = new Map();
function trafficMapSync() {
  if (typeof L === 'undefined' || typeof leafMap === 'undefined') return;
  const live = new Set(traffic.map(t => t.id));
  for (const [id, m] of _tfcMk) if (!live.has(id)) { leafMap.removeLayer(m); _tfcMk.delete(id); }
  for (const t of traffic) {
    const col = t.st === 'RA' ? '#ff3030' : t.st === 'TA' ? '#ffb000' : '#ffffff', rel = Math.round(t.rel / 100);
    const html = `<div style="color:${col};font:bold 11px Arial;transform:translate(-50%,-50%);white-space:nowrap;text-shadow:0 0 2px #000">◆ ${(rel >= 0 ? '+' : '−') + String(Math.abs(rel)).padStart(2, '0')}</div>`;
    let m = _tfcMk.get(t.id);
    if (!m) { m = L.marker([t.lat, t.lon], { icon: L.divIcon({ className: 'tfc-mk', html, iconSize: [0, 0] }), interactive: false }).addTo(leafMap); _tfcMk.set(t.id, m); m._h = html; }
    else { m.setLatLng([t.lat, t.lon]); if (m._h !== html) { m.setIcon(L.divIcon({ className: 'tfc-mk', html, iconSize: [0, 0] })); m._h = html; } }
  }
}
setInterval(() => {
  const now = performance.now(), dt = _tfcT ? Math.min(2, (now - _tfcT) / 1000) : 0; _tfcT = now;
  let k = 0; try { k = S.running ? (typeof simSpeed === 'number' ? simSpeed : 1) : 0; } catch (e) { k = 0; }
  try { trafficStep(dt * k); trafficMapSync(); } catch (e) { _swallow(e); }
}, 250);

// ── ④ METAR 로 환경 맞추기 — 바람 · 돌풍 · 시정 · 구름 밑면(가장 낮은 BKN/OVC) · 비 · 해(시간대) ──
function envFromMetar(raw, fieldElevFt = 0, when = new Date(), lat = S.lat, lon = S.lon) {
  const o = {}, w = {};
  const wm = raw.match(/\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/);
  if (wm) { const k = wm[4] === 'MPS' ? 1.944 : 1; w.dir = wm[1] === 'VRB' ? null : +wm[1]; w.spd = Math.round(+wm[2] * k); o.gust = wm[3] ? Math.min(20, Math.round((+wm[3] - +wm[2]) * k / 5) * 5) : 0; }
  if (/\bCAVOK\b/.test(raw)) { o.vis = 0; o.ceil = 0; o.rain = 0; }
  else {
    const vm = raw.match(/\s(\d{4})(?:\s|NDV)/); const sm = raw.match(/\b(\d+(?:\/\d+)?)SM\b/);
    let km = vm ? (+vm[1] >= 9999 ? 99 : +vm[1] / 1000) : sm ? (sm[1].includes('/') ? eval(sm[1]) : +sm[1]) * 1.609 : 99;
    const steps = [10, 5, 3, 1.5, 0.8, 0.4];
    o.vis = km >= 10 ? 0 : steps.reduce((b, s) => Math.abs(s - km) < Math.abs(b - km) ? s : b, 10);
    let ceil = 0; const re = /\b(BKN|OVC|VV)(\d{3})\b/g; let m;
    while ((m = re.exec(raw))) { const ft = +m[2] * 100 + fieldElevFt; if (!ceil || ft < ceil) ceil = ft; }
    o.ceil = ceil ? [500, 1000, 1500, 2500, 4000].reduce((b, s) => Math.abs(s - ceil) < Math.abs(b - ceil) ? s : b, 500) : 0;
    o.rain = /\+(?:SH|TS)?RA\b/.test(raw) ? 2 : /\b-?(?:SH|TS)?(?:RA|DZ)\b/.test(raw) ? 1 : 0;
  }
  // 해의 높이(°)로 시간대 — 6° 위 주간 · −6 ~ 6° 황혼 · 그 밑 야간
  const el = sunElevation(when, lat, lon);
  o.tod = el > 6 ? 'DAY' : el > -6 ? 'DUSK' : 'NIGHT';
  return { env: o, wind: w, sunEl: el };
}
function sunElevation(d, lat, lon) {
  const rad = Math.PI / 180, day = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const decl = -23.44 * Math.cos(rad * 360 / 365 * (day + 10));
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60, ha = (utcH + lon / 15 - 12) * 15;
  return Math.asin(Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(ha * rad)) / rad;
}
function envApplyMetar(raw, icao, elevFt) {
  const r = envFromMetar(raw, elevFt || 0);
  if (typeof envSet === 'function') envSet(r.env);
  if (r.wind.spd != null) { try { if (r.wind.dir != null) windDir = r.wind.dir; windSpd = r.wind.spd; } catch (e) { _swallow(e); } }
  try { uiToast(`METAR ${icao || ''} — 바람 ${r.wind.dir ?? 'VRB'}°/${r.wind.spd ?? 0}kt${r.env.gust ? ' G+' + r.env.gust : ''} · 시정 ${r.env.vis ? r.env.vis + 'km' : '10km+'} · 구름 ${r.env.ceil ? r.env.ceil + 'ft' : '없음'} · ${({ DAY: '주간', DUSK: '황혼', NIGHT: '야간' })[r.env.tod]}`); } catch (e) { _swallow(e); }
  return r;
}
async function envMetarNearest() {
  const near = (typeof _nearestAirport === 'function') ? _nearestAirport() : null;
  if (!near) { try { uiToast('가까운 공항이 없습니다'); } catch (e) { _swallow(e); } return null; }
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 7000);
  let raw = null;
  try { raw = await _ivaoMetar(near.a.icao, ctl.signal); } catch (e) { try { raw = await _vatsimMetar(near.a.icao, ctl.signal); } catch (e2) { _swallow(e2); } }
  if (!raw) { try { uiToast(`${near.a.icao} METAR 를 받지 못했습니다(인터넷 연결 확인)`, 'warn'); } catch (e) { _swallow(e); } return null; }
  const rw = (typeof RUNWAYS !== 'undefined') ? RUNWAYS.find(x => x.apt === near.a.icao) : null;
  return envApplyMetar(raw.split('\n')[0], near.a.icao, rw ? rw.elev : 0);
}

// ── ⑤ 설정 창(⚙) — 흩어진 설정을 한곳에 · 모든 설정 내보내기/들여오기/초기화 ──
function toggleSettings() {
  let w = document.getElementById('set-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'set-wrap';
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-set]'); if (!b) return;
      const [k, v] = b.dataset.set.split(':');
      if (k === 'x') { w.style.display = 'none'; return; }
      if (k === 'sound' && typeof toggleSound === 'function') toggleSound();
      else if (k === 'atcVoice' || k === 'readback') { appSet[k] = v === '1'; appSetSave(); }
      else if (k === 'rate') { appSet.rate = +v; appSetSave(); }
      else if (k === 'raCall' && typeof envSet === 'function') envSet({ raCall: v === '1' });
      else if (k === 'export') settingsExport();
      else if (k === 'reset') Promise.resolve(typeof uiConfirm === 'function' ? uiConfirm('모든 설정 · 시나리오 · 저장 비행을 지우고 처음으로 돌릴까요?') : false).then(ok => { if (ok) settingsReset(); });
      else if (k === 'ios') toggleRemoteIos();
      _setRender();
    });
    w.addEventListener('change', e => {
      if (e.target.dataset.setv === 'callsign') { appSet.callsign = e.target.value.trim() || 'Coastguard zero one'; appSetSave(); }
      if (e.target.dataset.setv === 'file') { const f = e.target.files && e.target.files[0]; if (f) f.text().then(settingsImport); e.target.value = ''; }
    });
  }
  w.style.display = 'flex'; _setRender();
}
function _setRender() {
  const w = document.getElementById('set-wrap'); if (!w) return;
  const on = (k, v, cur) => `<button class="sim-btn ${cur ? 'on' : ''}" data-set="${k}:${v}">${cur ? '켬' : '끔'}</button>`;
  const tg = (k, val) => `<button class="sim-btn ${val ? 'on' : ''}" data-set="${k}:1">켬</button><button class="sim-btn ${!val ? 'on' : ''}" data-set="${k}:0">끔</button>`;
  w.innerHTML = `<div class="set-box"><div class="set-bar"><b>⚙ 설정</b><button class="sim-btn" data-set="x">✕</button></div>
    <div class="set-row"><span>로터 소리</span><div>${on('sound', 1, typeof sndOn !== 'undefined' && sndOn)}</div></div>
    <div class="set-row"><span>RA 콜아웃(흰수리)</span><div>${tg('raCall', typeof env !== 'undefined' && env.raCall)}</div></div>
    <div class="set-row"><span>관제 음성</span><div>${tg('atcVoice', appSet.atcVoice)}</div></div>
    <div class="set-row"><span>리드백 확인(음성 인식)</span><div>${tg('readback', appSet.readback)}</div></div>
    <div class="set-row"><span>말 빠르기</span><div>${[0.85, 1.05, 1.3].map(r => `<button class="sim-btn ${appSet.rate === r ? 'on' : ''}" data-set="rate:${r}">${r === 0.85 ? '느리게' : r === 1.05 ? '보통' : '빠르게'}</button>`).join('')}</div></div>
    <div class="set-row"><span>콜사인(관제)</span><div><input type="text" data-setv="callsign" value="${appSet.callsign.replace(/"/g, '&quot;')}"></div></div>
    <div class="set-row"><span>교관 기기 연결</span><div><button class="sim-btn" data-set="ios">📱 교관 기기와 잇기(QR)</button></div></div>
    <div class="set-row"><span>모든 설정</span><div><button class="sim-btn" data-set="export">내보내기</button><label class="sim-btn">들여오기<input type="file" accept=".json" data-setv="file" hidden></label><button class="sim-btn" data-set="reset">초기화</button></div></div>
    <div class="set-note">환경(시간대 · 시정 · 바다 · 돌풍 · 구름 · 지면 · 교통량)은 🌙 ENV 에서 고릅니다.</div></div>`;
}
const SET_KEYS = ['appSet', 'envSet', 'scnList', 'fdrSaved', 'b206rad', 'shipMotion', 'simSound', 'autoMetarOn'];
function settingsExport() {
  const o = {}; SET_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) o[k] = v; } catch (e) { _swallow(e); } });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })); a.download = 'shinesong-settings.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return o;
}
function settingsImport(text) {
  let n = 0; try { const o = JSON.parse(text); for (const k of SET_KEYS) if (typeof o[k] === 'string') { localStorage.setItem(k, o[k]); n++; } } catch (e) { _swallow(e); }
  try { uiToast(n ? `설정 ${n}가지를 들여왔습니다 — 다시 열면 반영됩니다` : '설정 파일을 읽지 못했습니다', n ? '' : 'err'); } catch (e) { _swallow(e); }
  return n;
}
function settingsReset() { SET_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { _swallow(e); } }); try { uiToast('설정을 지웠습니다 — 다시 열면 처음 상태입니다'); } catch (e) { _swallow(e); } }

// ── ⑥ 도구 메뉴(🧰) — 작은 화면(폭 900 · 높이 700 아래)에서는 낱 단추 대신 이 메뉴 하나로 ──
const TOOLS = [['🎬 시나리오', 'toggleScenario'], ['🌙 환경', 'toggleEnvPanel'], ['📋 강평', 'toggleDebrief'], ['🧑‍✈️ 교관 화면', 'openIos'], ['📱 교관 기기와 잇기', 'toggleRemoteIos'], ['⚙ 설정', 'toggleSettings'], ['❓ 도움말', 'toggleHelp']];
function toggleTools(ev) {
  let m = document.getElementById('tools-menu');
  if (m && m.style.display === 'block') { m.style.display = 'none'; return; }
  if (!m) {
    m = document.createElement('div'); m.id = 'tools-menu';
    m.innerHTML = TOOLS.map(([t, f]) => `<button class="sim-btn" data-tool="${f}">${t}</button>`).join('');
    document.body.appendChild(m);
    m.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (!b) return; m.style.display = 'none'; try { const fn = window[b.dataset.tool]; if (typeof fn === 'function') fn(); } catch (er) { _swallow(er); } });
    document.addEventListener('pointerdown', e => { if (m.style.display === 'block' && !m.contains(e.target) && !e.target.closest('[data-act="toggleTools"]')) m.style.display = 'none'; }, true);
  }
  // 누른 단추 곁에 연다 — 이벤트가 없으면(단추 위임) 지금 보이는 🧰 단추를 찾는다
  const evT = (ev && ev.target) || (window.event && window.event.target);
  const src = (evT && evT.closest && evT.closest('[data-act="toggleTools"]')) || [...document.querySelectorAll('[data-act="toggleTools"]')].find(b => b.offsetParent);
  const r = src ? src.getBoundingClientRect() : { left: 20, top: 60, bottom: 60, right: 200 };
  m.style.display = 'block';
  const mw = m.offsetWidth || 180, mh = m.offsetHeight || 260;
  m.style.left = Math.max(6, Math.min(window.innerWidth - mw - 6, r.right - mw)) + 'px';
  // 아래 자리가 모자라면(지도 창 아래 단추 줄) 단추 위로 연다
  const below = r.bottom + 4, above = r.top - mh - 4;
  m.style.top = Math.max(6, below + mh <= window.innerHeight - 6 ? below : above) + 'px';
}

// ── ⑦ 다른 기기 교관 연결(WebRTC 데이터 통로) — 서버 없이 QR 두 번: '연결 요청' → '수락' ──
//   ① 교육생 기기(🧰 도구 → ⚙ 설정 → 교관 기기 연결): [① 연결 요청] → 화면에 QR
//   ② 교관 기기(교관 화면 📱): [② 수락 — 교육생 QR 찍기] → 카메라로 찍으면 교관 화면에 답 QR
//   ③ 교육생 기기: [③ 교관 QR 찍기] → 카메라로 찍으면 이어진다
//   카메라가 없으면 아래 '코드로 잇기'로 같은 내용을 글자로 주고받는다.
//   연결 정보(SDP)는 꼭 필요한 값(ICE 이름 · 암호 · 인증서 지문 · 주소)만 남겨 짧게 줄인다 — QR 한 장에 들어가게.
//   같은 와이파이면 바로 잇고, 다른 망이면 공개 STUN(구글) 서버로 길만 찾는다(비행 내용은 두 기기 사이로만 오간다)
const RTC_ICE = () => (Array.isArray(window._rtcIce) ? window._rtcIce : [{ urls: 'stun:stun.l.google.com:19302' }]);
const rtc = { pc: null, ch: null, open: false };
const _b64 = s => btoa(unescape(encodeURIComponent(s))), _unb64 = s => decodeURIComponent(escape(atob(s.trim())));
function _rtcWire(ch) {
  rtc.ch = ch;
  ch.onopen = () => { rtc.open = true; try { uiToast('다른 기기와 이어졌습니다(교관 연결)'); } catch (e) { _swallow(e); } qrScanStop(); _rtcRender(); };
  ch.onclose = () => { rtc.open = false; _rtcRender(); };
  ch.onmessage = e => { let m = null; try { m = JSON.parse(e.data); } catch (er) { return; } if (typeof IOS_MODE !== 'undefined' && IOS_MODE) { if (typeof iosRender === 'function') iosRender(m); } else if (typeof iosHandle === 'function') iosHandle(m); };
}
function _rtcGather(pc) { return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }
// ── 연결 정보 줄이기 — 'SS1|o(또는 a)|ufrag|pwd|지문(base64)|setup|주소:포트:종류,…' ──
function sdpPack(desc) {
  const sdp = desc.sdp, g = re => { const m = sdp.match(re); return m ? m[1] : ''; };
  const fp = g(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/), fpB = btoa(String.fromCharCode(...fp.split(':').map(h => parseInt(h, 16))));
  const cands = [...sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ (host|srflx|relay)/gi)].map(m => `${m[1]}:${m[2]}:${m[3][0]}`);
  return ['SS1', desc.type === 'offer' ? 'o' : 'a', g(/a=ice-ufrag:(\S+)/), g(/a=ice-pwd:(\S+)/), fpB, g(/a=setup:(\S+)/), [...new Set(cands)].join(',')].join('|');
}
function sdpUnpack(str) {
  const p = String(str).trim().split('|'); if (p[0] !== 'SS1' || p.length < 7) throw new Error('연결 코드가 아닙니다');
  const fp = [...atob(p[4])].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(':');
  const cands = (p[6] ? p[6].split(',') : []).map((c, i) => {
    const k = c.lastIndexOf(':'), j = c.lastIndexOf(':', k - 1), ip = c.slice(0, j), port = c.slice(j + 1, k), t = { h: 'host', s: 'srflx', r: 'relay' }[c.slice(k + 1)] || 'host';
    return `a=candidate:${i + 1} 1 udp ${2122260223 - i * 1000} ${ip} ${port} typ ${t}${t !== 'host' ? ' raddr 0.0.0.0 rport 0' : ''}`;
  });
  const sdp = ['v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', `a=ice-ufrag:${p[2]}`, `a=ice-pwd:${p[3]}`, 'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${fp}`, `a=setup:${p[5]}`, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', ...cands, ''].join('\r\n');
  return { type: p[1] === 'o' ? 'offer' : 'answer', sdp };
}
// 종전의 긴 코드(base64 JSON)도 받는다
const _descFrom = code => /^SS1\|/.test(String(code).trim()) ? sdpUnpack(code) : JSON.parse(_unb64(code));
async function rtcOffer() {
  try { if (rtc.pc) rtc.pc.close(); } catch (e) { _swallow(e); }
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE() }); rtc.pc = pc; rtc.open = false;
  _rtcWire(pc.createDataChannel('ios'));
  pc.addEventListener('connectionstatechange', _rtcRender);
  await pc.setLocalDescription(await pc.createOffer()); await _rtcGather(pc);
  return sdpPack(pc.localDescription);
}
async function rtcAnswer(code) {
  try { if (rtc.pc) rtc.pc.close(); } catch (e) { _swallow(e); }
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE() }); rtc.pc = pc; rtc.open = false;
  pc.ondatachannel = e => _rtcWire(e.channel);
  pc.addEventListener('connectionstatechange', _rtcRender);
  await pc.setRemoteDescription(_descFrom(code));
  await pc.setLocalDescription(await pc.createAnswer()); await _rtcGather(pc);
  return sdpPack(pc.localDescription);
}
async function rtcAccept(code) { await rtc.pc.setRemoteDescription(_descFrom(code)); }
function rtcSend(m) { try { if (rtc.open && rtc.ch && rtc.ch.readyState === 'open') rtc.ch.send(JSON.stringify(m)); } catch (e) { _swallow(e); } }

// ── QR — 만들기(vendor/qrcode.js) · 읽기(BarcodeDetector 가 있으면 그것, 없으면 vendor/jsQR.js) — 필요할 때만 읽어 온다 ──
const _jsLoaded = {};
function _loadJs(src) {
  if (_jsLoaded[src]) return _jsLoaded[src];
  return (_jsLoaded[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete _jsLoaded[src]; no(new Error('불러오지 못함: ' + src)); }; document.head.appendChild(s); }));
}
async function qrSvg(text) {
  if (typeof qrcode !== 'function') await _loadJs('vendor/qrcode.js');
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 3 });
}
async function qrDecode(imgData) {
  if (typeof jsQR !== 'function') await _loadJs('vendor/jsQR.js');
  const r = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
  return r ? r.data : null;
}
let _qrScan = null;
// 카메라로 'SS1|' 로 시작하는 QR 을 찾을 때까지 본다 — host 안에 화면을 띄운다
async function qrScan(host) {
  qrScanStop();
  const v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.className = 'rtc-cam';
  host.innerHTML = ''; host.appendChild(v);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  v.srcObject = stream; await v.play();
  const st = { stream, stop: false }; _qrScan = st;
  const det = ('BarcodeDetector' in window) ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  return new Promise((ok, no) => {
    st.reject = no;
    const tick = async () => {
      if (st.stop) return;
      try {
        let txt = null;
        if (det) { const r = await det.detect(v); txt = r && r[0] ? r[0].rawValue : null; }
        else if (v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; g.drawImage(v, 0, 0); txt = await qrDecode(g.getImageData(0, 0, cv.width, cv.height)); }
        if (txt && /^SS1\|/.test(txt)) { qrScanStop(); host.innerHTML = ''; ok(txt); return; }
      } catch (e) { _swallow(e); }
      setTimeout(tick, 200);
    };
    tick();
  });
}
function qrScanStop() { const st = _qrScan; _qrScan = null; if (!st) return; st.stop = true; try { st.stream.getTracks().forEach(t => t.stop()); } catch (e) { _swallow(e); } }

// ── 연결 창 ──
function toggleRemoteIos() {
  let w = document.getElementById('rtc-wrap');
  if (w && w.style.display === 'flex') { qrScanStop(); w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'rtc-wrap';
    const ios = typeof IOS_MODE !== 'undefined' && IOS_MODE;
    w.innerHTML = `<div class="set-box rtc-box"><div class="set-bar"><b>${ios ? '📱 교육생 기기와 잇기' : '📱 교관 기기와 잇기'}</b><button class="sim-btn" data-rtc="x">✕</button></div>
      <div class="rtc-steps">${ios
        ? '<div>교육생 기기에서 <b>🧰 도구 → 📱 교관 기기와 잇기 → [① 연결 요청]</b>을 누르면 QR 이 나옵니다.</div><div>아래 <b>[② 수락]</b>을 누르고 그 QR 을 찍으면 여기에 답 QR 이 나옵니다.</div><div>교육생 기기가 <b>[③ 교관 QR 찍기]</b>로 답 QR 을 찍으면 이어집니다.</div>'
        : '<div><b>[① 연결 요청]</b>을 누르면 QR 이 나옵니다 — 교관 기기가 <b>[② 수락]</b>으로 찍습니다.</div><div>교관 화면에 답 QR 이 나오면 <b>[③ 교관 QR 찍기]</b>를 누르고 그 QR 을 찍습니다.</div>'}</div>
      <div class="rtc-btns">${ios ? '<button class="sim-btn on rtc-big" data-rtc="accept">② 수락 — 교육생 QR 찍기 📷</button>'
        : '<button class="sim-btn on rtc-big" data-rtc="request">① 연결 요청</button><button class="sim-btn on rtc-big" data-rtc="scanAns">③ 교관 QR 찍기 📷</button>'}</div>
      <div class="rtc-view" data-rtcv="view"></div>
      <div class="set-note rtc-st" data-rtcv="st"></div>
      <details class="rtc-txt"><summary>카메라가 없을 때 — 코드로 잇기</summary>
        <div class="set-row"><textarea data-rtcv="out" readonly placeholder="${ios ? '여기 나온 답 코드를 교육생 기기로' : '여기 나온 요청 코드를 교관 기기로'}"></textarea></div>
        <div class="set-row"><button class="sim-btn" data-rtc="copy">복사</button><button class="sim-btn" data-rtc="share">공유</button></div>
        <div class="set-row"><textarea data-rtcv="in" placeholder="${ios ? '교육생 기기의 요청 코드를 붙여 넣기' : '교관 기기의 답 코드를 붙여 넣기'}"></textarea></div>
        <div class="set-row"><button class="sim-btn" data-rtc="${ios ? 'acceptTxt' : 'finishTxt'}">${ios ? '수락(답 코드 만들기)' : '연결'}</button></div>
      </details></div>`;
    document.body.appendChild(w);
    const view = w.querySelector('[data-rtcv="view"]'), out = w.querySelector('[data-rtcv="out"]'), inp = w.querySelector('[data-rtcv="in"]');
    const showQr = async (code, msg) => { out.value = code; view.innerHTML = `<div class="rtc-qr">${await qrSvg(code)}</div><div class="set-note">${msg}</div>`; };
    w.addEventListener('click', async e => {
      const b = e.target.closest('[data-rtc]'); if (!b) { if (e.target === w) { qrScanStop(); w.style.display = 'none'; } return; }
      const k = b.dataset.rtc;
      try {
        if (k === 'x') { qrScanStop(); w.style.display = 'none'; return; }
        if (k === 'request') { view.innerHTML = '<div class="set-note">요청 QR 을 만드는 중…</div>'; await showQr(await rtcOffer(), '교관 기기의 <b>[② 수락]</b>으로 이 QR 을 찍게 하세요. 찍고 나면 <b>[③ 교관 QR 찍기]</b>를 누릅니다.'); }
        else if (k === 'scanAns') { if (!rtc.pc) throw new Error('먼저 ① 연결 요청을 누르십시오'); const code = await qrScan(view); view.innerHTML = '<div class="set-note">교관 QR 을 읽었습니다 — 잇는 중…</div>'; await rtcAccept(code); }
        else if (k === 'accept') { const code = await qrScan(view); view.innerHTML = '<div class="set-note">교육생 QR 을 읽었습니다 — 답 QR 을 만드는 중…</div>'; await showQr(await rtcAnswer(code), '교육생 기기의 <b>[③ 교관 QR 찍기]</b>로 이 QR 을 찍게 하세요.'); }
        else if (k === 'acceptTxt') await showQr(await rtcAnswer(inp.value), '이 QR(또는 위 답 코드)을 교육생 기기로 보내세요.');
        else if (k === 'finishTxt') await rtcAccept(inp.value);
        else if (k === 'copy') { await navigator.clipboard.writeText(out.value); uiToast('복사했습니다'); }
        else if (k === 'share') { if (navigator.share) await navigator.share({ text: out.value }); else { await navigator.clipboard.writeText(out.value); uiToast('공유를 쓸 수 없어 복사했습니다'); } }
      } catch (er) {
        _swallow(er);
        const msg = /Permission|NotAllowed/i.test(String(er && er.name) + er) ? '카메라를 쓸 수 없습니다 — 브라우저의 카메라 허용을 켜거나 아래 "코드로 잇기"를 쓰십시오'
          : /NotFound|Devices/i.test(String(er && er.name) + er) ? '카메라가 없습니다 — 아래 "코드로 잇기"를 쓰십시오' : (er && er.message) || '연결 코드가 맞지 않습니다';
        try { uiToast(msg, 'err', 4000); } catch (e2) { _swallow(e2); }
      }
      _rtcRender();
    });
  }
  w.style.display = 'flex'; _rtcRender();
}
function _rtcRender() {
  const s = document.querySelector('#rtc-wrap [data-rtcv="st"]'); if (!s) return;
  const cs = rtc.pc ? rtc.pc.connectionState : '';
  s.textContent = rtc.open ? '● 이어졌습니다 — 이 창을 닫아도 됩니다' : cs === 'failed' ? '✕ 잇지 못했습니다 — 두 기기가 같은 와이파이인지 보고 처음부터 다시' : rtc.pc ? '○ 기다리는 중…' : '';
  s.classList.toggle('ok', rtc.open);
}
try { appRegister({ toggleSettings, toggleTools, toggleRemoteIos, envMetarNearest }); } catch (e) { _swallow(e); }
