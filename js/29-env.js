'use strict';
// ══════════════════════════════════════════════════════
// 29-env.js — 환경(ENV): 시간대 · 시정 · 비 · NVG · 바다 상태
//
// 3D 화면(본 화면 · CHIN 창 · 호이스트 카메라 — maplibre 캔버스 모두)에 건다:
//   시간대 — 주간 · 황혼(어둡고 붉게) · 야간(아주 어둡게). 하늘색도 바꾼다(04-map.js MAP3D_SKY 를 덮는다)
//   시정  — 무제한 · 10 · 5 · 3 · 1.5km · 800 · 400m. 안개가 그 거리에서 짙어진다(maplibre sky fog)
//   비    — 없음 · 약 · 강. 화면에 빗줄기가 흐른다
//   NVG   — 야간투시경 느낌(녹색 · 밝게 · 거칠게)
//   돌풍 — 바람 세기에 +0~20kt 가 흔들려 더해지고 방향도 흔들린다 · 자세가 조금씩 흔들린다(14-simmode.js simTurb)
//   구름 밑면 — 그 높이(ft, 기압고도)부터 1,500ft 두께 구름 속은 하얗게 가려진다(IIMC 연습)
//   착륙등(흰수리) · RA 콜아웃(흰수리 전파고도 음성 — 32-callout.js)
//   바다 상태 0~6(더글러스) — 함정 롤 · 피칭(09-cdu.js shipRollAmp · shipPitchAmp)과 익수자 표류(24-sar.js)를 정한다
//       0 잔잔 · 1 잔물결(0~0.1m) · 2 약(0.1~0.5) · 3 보통(0.5~1.25) · 4 약간 높음(1.25~2.5) · 5 높음(2.5~4) · 6 매우 높음(4~6m)
// 설정은 이 기기(localStorage 'envSet')에 남는다. 지도 창 · 3D 창의 🌙 ENV 단추로 연다.
// ══════════════════════════════════════════════════════
const ENV_KEY = 'envSet';
const ENV_VIS = [0, 10, 5, 3, 1.5, 0.8, 0.4];                 // km(0 = 무제한)
const ENV_SEA_ROLL = [0, 1, 2, 4, 6, 8, 10], ENV_SEA_PITCH = [0, 0.5, 1, 2, 3, 4, 5];
const ENV_SEA_DRIFT = [0, 0.1, 0.3, 0.6, 0.9, 1.3, 1.8];      // 익수자 바람 쪽 표류(kt) — 파도 · 바람에 밀린다
const ENV_SEA_NAME = ['0 잔잔', '1 잔물결', '2 약', '3 보통', '4 약간 높음', '5 높음', '6 매우 높음'];
const env = { tod: 'DAY', vis: 0, rain: 0, nvg: false, sea: 0, gust: 0, ceil: 0, ldg: false, raCall: true };
try { Object.assign(env, JSON.parse(localStorage.getItem(ENV_KEY) || '{}')); } catch (e) { _swallow(e); }
function _envSave() { try { localStorage.setItem(ENV_KEY, JSON.stringify(env)); } catch (e) { _swallow(e); } }
// 시정(km) → 안개가 짙어지는 자리(0 = 화면 가운데 · 1 = 지평선)
function envFogBlend(km) { if (!(km > 0)) return 0.9; return Math.max(0.02, Math.min(0.9, 0.06 * km)); }
function envSky() {
  const night = env.tod === 'NIGHT', dusk = env.tod === 'DUSK', lowVis = env.vis > 0;
  const fogCol = night ? '#0b0f16' : dusk ? '#6b5a5a' : lowVis ? '#b8c0c8' : '#aabbcc';
  return {
    'sky-color': night ? '#02040a' : dusk ? '#3a2a4a' : (lowVis ? '#8f99a3' : '#1a2a4a'),
    'sky-horizon-blend': 0.5,
    'horizon-color': night ? '#0a0f1a' : dusk ? '#d07a4a' : (lowVis ? '#b8c0c8' : '#6699bb'),
    'horizon-fog-blend': lowVis ? 0.9 : 0.3,
    'fog-color': fogCol,
    'fog-ground-blend': envFogBlend(env.vis),
  };
}
// 3D 지도(들)에 하늘 · 안개를 다시 건다
function envApply3d() {
  const maps = [];
  try { if (typeof _ml3d !== 'undefined' && _ml3d) maps.push(_ml3d); } catch (e) { _swallow(e); }
  try { if (typeof _chinMaps !== 'undefined' && Array.isArray(_chinMaps)) maps.push(..._chinMaps.map(c => c.map)); } catch (e) { _swallow(e); }
  const sky = envSky();
  maps.forEach(m => { try { if (m && m.setSky && m.style && m.style._loaded) m.setSky(sky); } catch (e) { _swallow(e); } });
}
function envApply() {
  const h = document.documentElement;
  h.classList.toggle('env-dusk', env.tod === 'DUSK'); h.classList.toggle('env-night', env.tod === 'NIGHT');
  h.classList.toggle('env-nvg', !!env.nvg);
  h.classList.toggle('env-rain1', env.rain === 1); h.classList.toggle('env-rain2', env.rain === 2);
  // 빗줄기 — 3D 창 위(누름은 아래로 지나간다)
  const host = document.getElementById('map3d');
  if (host && !host.querySelector('.env-rain')) { const r = document.createElement('div'); r.className = 'env-rain'; host.appendChild(r); }
  envApply3d();
  // 바다 상태 → 함정 롤 · 피칭
  try {
    if (typeof shipRollAmp !== 'undefined' && env._seaApplied !== env.sea) {
      shipRollAmp = ENV_SEA_ROLL[env.sea] || 0; shipPitchAmp = ENV_SEA_PITCH[env.sea] || 0;
      try { localStorage.setItem('shipMotion', JSON.stringify({ r: shipRollAmp, p: shipPitchAmp })); } catch (e) { _swallow(e); }
      env._seaApplied = env.sea;
    }
  } catch (e) { _swallow(e); }
}
function envSet(o) {
  for (const k of ['tod', 'vis', 'rain', 'nvg', 'sea', 'gust', 'ceil', 'ldg', 'raCall']) if (o[k] !== undefined) env[k] = o[k];
  env.sea = Math.max(0, Math.min(6, env.sea | 0)); env.rain = Math.max(0, Math.min(2, env.rain | 0));
  if (o.sea !== undefined) env._seaApplied = -1;
  _envSave(); envApply(); envPanelRender();
}
// 익수자 바람 쪽 표류(kt · 방향 = 바람이 불어 가는 쪽) — 24-sar.js 가 부른다
function envSeaDrift() {
  const kt = ENV_SEA_DRIFT[env.sea] || 0;
  let dir = 0; try { dir = ((typeof windDir === 'number' ? windDir : 0) + 180) % 360; } catch (e) { _swallow(e); }
  return { kt, dir };
}
// ── 패널 ──
function envPanelRender() {
  const w = document.getElementById('env-wrap'); if (!w) return;
  w.querySelectorAll('[data-env]').forEach(b => {
    const [k, v] = b.dataset.env.split(':');
    const cur = (k === 'nvg' || k === 'ldg' || k === 'raCall') ? String(!!env[k]) : String(env[k]);
    b.classList.toggle('on', cur === v);
  });
  const s = w.querySelector('[data-envv="sea"]');
  if (s) s.textContent = `${ENV_SEA_NAME[env.sea]} — 함정 롤 ${ENV_SEA_ROLL[env.sea]}° · 피칭 ${ENV_SEA_PITCH[env.sea]}° · 익수자 표류 ${ENV_SEA_DRIFT[env.sea]}kt(바람 쪽)`;
}
function toggleEnvPanel() {
  let w = document.getElementById('env-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'env-wrap';
    const grp = (t, k, opts) => `<div class="env-row"><span>${t}</span><div>${opts.map(([v, l]) => `<button class="sim-btn" data-env="${k}:${v}">${l}</button>`).join('')}</div></div>`;
    w.innerHTML = `<div class="env-box"><div class="env-bar"><b>🌙 환경 (ENV)</b><button class="sim-btn" data-envx="close">✕</button></div>` +
      grp('시간대', 'tod', [['DAY', '주간'], ['DUSK', '황혼'], ['NIGHT', '야간']]) +
      grp('시정', 'vis', ENV_VIS.map(v => [v, v === 0 ? '무제한' : v >= 1 ? v + 'km' : Math.round(v * 1000) + 'm'])) +
      grp('비', 'rain', [[0, '없음'], [1, '약'], [2, '강']]) +
      grp('NVG', 'nvg', [['false', '끔'], ['true', '켬']]) +
      grp('바다 상태', 'sea', [0, 1, 2, 3, 4, 5, 6].map(v => [v, String(v)])) +
      grp('돌풍', 'gust', [0, 5, 10, 15, 20].map(v => [v, v ? '+' + v + 'kt' : '없음'])) +
      grp('구름 밑면', 'ceil', [0, 500, 1000, 1500, 2500, 4000].map(v => [v, v ? v + 'ft' : '없음'])) +
      grp('착륙등(흰수리)', 'ldg', [['false', '끔'], ['true', '켬']]) +
      grp('RA 콜아웃', 'raCall', [['false', '끔'], ['true', '켬']]) +
      `<div class="env-note" data-envv="sea"></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w || e.target.closest('[data-envx]')) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-env]'); if (!b) return;
      const [k, v] = b.dataset.env.split(':');
      envSet({ [k]: k === 'tod' ? v : (k === 'nvg' || k === 'ldg' || k === 'raCall') ? v === 'true' : +v });
    });
  }
  w.style.display = 'flex'; envPanelRender();
}
// 3D 지도가 늦게 뜨거나 바탕을 다시 그리면(화질 바꾸기 등) 하늘이 04-map.js 기본으로 돌아간다 — 2초마다 맞춘다
setInterval(() => { if (env.tod !== 'DAY' || env.vis > 0) envApply3d(); }, 2000);
try { envApply(); } catch (e) { _swallow(e); }
try { appRegister({ toggleEnvPanel }); } catch (e) { _swallow(e); }

// ── 돌풍 ──
let _gustT = Math.random() * 100;
function envGustKt() { return env.gust || 0; }
// 지금의 돌풍 몫 — 세기(kt, 0 ~ +gust) · 방향(°, ±gust 의 1.2배)
function envGustNow() {
  const g = env.gust || 0; if (!g) return { dk: 0, dd: 0 };
  const t = _gustT;
  const n = 0.5 + 0.35 * Math.sin(t * 0.37) + 0.25 * Math.sin(t * 1.13 + 1.7) + 0.15 * Math.sin(t * 2.9 + 0.4);
  return { dk: g * Math.max(0, Math.min(1, n)), dd: g * 1.2 * (0.7 * Math.sin(t * 0.23 + 3) + 0.3 * Math.sin(t * 0.81)) };
}
setInterval(() => { try { if (S.running) _gustT += 0.1 * (typeof simSpeed === 'number' ? simSpeed : 1); } catch (e) { _swallow(e); } }, 100);

// ── 구름(실링) · 밤 불빛 — 3D 창 위 덧그림(누름은 아래로 지나간다) ──
// 불빛은 maplibre 캔버스(밤에는 어둡게 거른다) 밖의 캔버스에 그려 밤에도 밝다:
//   활주로 — 양옆 60m 마다 흰 등 · 양끝 녹색 등(15km 안의 활주로)
//   함정 — 비행갑판 둘레 흰 등 · 착함 원 녹색 등 · HAPI(함교 앞면 — 접근각: 4.5° 위 녹색 깜빡 · 2.5~4.5° 녹색 · 1.5~2.5° 빨강 · 그 밑 빨강 깜빡)
//   요구조자 — 스트로브(1초마다 번쩍) · 서치라이트 · 착륙등 빛 안에 들면 반사판이 밝게
//   착륙등 · 서치라이트 — 땅에 비치는 빛 무리(Bell: 컬렉티브 LDG LT · SRCH LT ON · 흰수리: ENV 착륙등)
let _envFx = null, _envCloudIn = false;
function _envFxEls() {
  const host = document.getElementById('map3d'); if (!host) return null;
  if (!_envFx || !_envFx.cv.isConnected) {
    const cv = document.createElement('canvas'); cv.className = 'env-fx';
    const cl = document.createElement('div'); cl.className = 'env-cloud';
    host.appendChild(cv); host.appendChild(cl);
    _envFx = { cv, cl };
  }
  return _envFx;
}
const _envD2R = Math.PI / 180;
function _envOff(lat, lon, n, e) { return [lat + n / 110540, lon + e / (111320 * Math.cos(lat * _envD2R))]; }
function _envDist(la1, lo1, la2, lo2) { const n = (la2 - la1) * 110540, e = (lo2 - lo1) * 111320 * Math.cos(la1 * _envD2R); return { n, e, d: Math.hypot(n, e) }; }
// 지금 켜진 빛 무리 — [{ lat, lon, r(m), k(세기 0~1) }]
function envBeams() {
  const out = []; let agl = 1000; try { agl = radarAltFt(); } catch (e) { _swallow(e); }
  const aglM = Math.max(1, agl * 0.3048), hd = S.hdg * _envD2R;
  const beam = (downDeg, k) => {
    const dn = Math.max(4, downDeg + (S.pit || 0) * -1);
    const d = aglM / Math.tan(dn * _envD2R); if (!(d > 0) || d > 600) return;
    const [la, lo] = _envOff(S.lat, S.lon, d * Math.cos(hd), d * Math.sin(hd));
    out.push({ lat: la, lon: lo, r: Math.max(8, d * 0.18), k: k * Math.max(0, 1 - d / 600) });
  };
  try {
    if (typeof acB206 === 'function' && acB206() && typeof b206c !== 'undefined') {
      if (b206c.ldg) beam(14, 1);
      if (b206c.srch === 'ON') beam(b206c.srchExt ? 30 : 20, 0.9);
    } else if (env.ldg) beam(14, 1);
  } catch (e) { _swallow(e); }
  return out;
}
function _envLightPts(t) {
  const P = [], la0 = S.lat, lo0 = S.lon;
  // 활주로
  try {
    for (const ap of (typeof RUNWAYS !== 'undefined' ? RUNWAYS : [])) for (const r of (ap.rwys || [])) {
      if (_envDist(la0, lo0, r.a[0], r.a[1]).d > 15000) continue;
      const v = _envDist(r.a[0], r.a[1], r.b[0], r.b[1]), L = v.d, ux = v.e / L, uy = v.n / L, px = uy, py = -ux, hw = r.w / 2 + 3;
      for (let s0 = 0; s0 <= L; s0 += 60) for (const sd of [-1, 1]) { const [la, lo] = _envOff(r.a[0], r.a[1], uy * s0 + py * hw * sd, ux * s0 + px * hw * sd); P.push([la, lo, '#fff6d8', 1]); }
      for (const [o, end] of [[0, r.a], [L, r.b]]) for (let k = -2; k <= 2; k++) { const [la, lo] = _envOff(r.a[0], r.a[1], uy * o + py * hw * k / 2, ux * o + px * hw * k / 2); P.push([la, lo, '#3dff6a', 1]); }
    }
  } catch (e) { _swallow(e); }
  // 함정
  try {
    if (typeof shipLat !== 'undefined' && shipLat !== null && shipVisible !== false) {
      const h = shipHdg * _envD2R, F = [Math.cos(h), Math.sin(h)], R = [-Math.sin(h), Math.cos(h)];   // [북, 동]
      const at = (x, y) => { const f = -y; return _envOff(shipLat, shipLon, F[0] * f + R[0] * x, F[1] * f + R[1] * x); };
      const B = SHIP3D_BEAM / 2, y0 = SHIP3D_BRIDGE_AFT, y1 = SHIP3D_LEN / 2;
      for (let y = y0; y <= y1; y += 5) for (const x of [-B, B]) { const [la, lo] = at(x, y); P.push([la, lo, '#ffffff', 0.9]); }
      for (let x = -B; x <= B; x += 5) { const [la, lo] = at(x, y1); P.push([la, lo, '#ffffff', 0.9]); }
      const tdy = -SHIP3D_TD.fwd;
      for (let a = 0; a < 360; a += 30) { const [la, lo] = at(SHIP3D_TD.r * Math.sin(a * _envD2R), tdy + SHIP3D_TD.r * Math.cos(a * _envD2R)); P.push([la, lo, '#3dff6a', 0.8]); }
      // HAPI — 착함 원 위로의 접근각
      const td = at(0, tdy), d = _envDist(la0, lo0, td[0], td[1]).d, hft = S.alt - SHIP3D_DECK / 0.3048;
      if (d < 5600 && d > 20) {
        const ang = Math.atan2(hft * 0.3048, d) / _envD2R, blink = Math.floor(t * 2) % 2 === 0;
        const col = ang > 4.5 ? (blink ? '#3dff6a' : null) : ang >= 2.5 ? '#3dff6a' : ang >= 1.5 ? '#ff3030' : (blink ? '#ff3030' : null);
        const [la, lo] = at(0, y0 - 1); if (col) P.push([la, lo, col, 1.6, 'HAPI']);
        envHapi = { ang, col: ang > 4.5 ? '높음' : ang >= 2.5 ? '정상' : ang >= 1.5 ? '조금 낮음' : '낮음' };
      } else envHapi = null;
    }
  } catch (e) { _swallow(e); }
  // 요구조자 — 스트로브 · 반사판
  try {
    if (typeof sar !== 'undefined' && sar.on && sar.lat !== null && sar.state !== 'aboard') {
      if ((t % 1) < 0.12) P.push([sar.lat, sar.lon, '#ffffff', 2.2]);
      const lit = envBeams().some(b => _envDist(b.lat, b.lon, sar.lat, sar.lon).d < b.r * 1.2);
      if (lit) P.push([sar.lat, sar.lon, '#d6ff3a', 1.8]);
      envSarLit = lit;
    } else envSarLit = false;
  } catch (e) { _swallow(e); }
  return P;
}
let envHapi = null, envSarLit = false;
function envFxFrame() {
  const fx = _envFxEls(); if (!fx) return;
  // 구름 속
  const base = env.ceil || 0, top = base + 1500, alt = S.alt || 0;
  let co = 0; if (base > 0) co = Math.max(0, Math.min(1, (alt - base + 60) / 120)) * Math.max(0, Math.min(1, (top + 60 - alt) / 120));
  const shown = (typeof heli3dShown === 'function' && heli3dShown()) || (typeof _ckFirst === 'function' && _ckFirst());
  fx.cl.style.opacity = shown || co > 0 ? co.toFixed(2) : '0';
  const inC = co > 0.6;
  if (inC !== _envCloudIn) { _envCloudIn = inC; if (inC) { try { if (typeof fdrNote === 'function') fdrNote(`구름 진입(IMC) — ${Math.round(alt)}ft`, 'warn'); } catch (e) { _swallow(e); } } }
  // 불빛 — 밤 · 황혼 · NVG 에만
  const dark = env.tod !== 'DAY' || env.nvg;
  const cv = fx.cv, m = (typeof _ml3d !== 'undefined') ? _ml3d : null;
  if (!dark || !m || !m.project) { if (cv.width) { cv.width = 0; } return; }
  const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const t = performance.now() / 1000, camB = (m.getBearing() || 0) * _envD2R;
  const visM = env.vis > 0 ? env.vis * 1000 : 30000;
  // 카메라 자리(조종석이면 기체 · 지도식 3D 면 위쪽 어딘가)에서 앞쪽에 있는 불만 그린다
  let cam = { lat: S.lat, lng: S.lon }; try { const c = m.transform && m.transform.getCameraLngLat ? m.transform.getCameraLngLat() : null; if (c) cam = c; } catch (e) { _swallow(e); }
  const inFront = (la, lo) => { const v = _envDist(cam.lat, cam.lng, la, lo); if (v.d < 5) return { ok: true, d: v.d }; const a = Math.atan2(v.e, v.n) - camB; return { ok: Math.cos(a) > 0.05 || (m.getPitch && m.getPitch() < 50), d: v.d }; };
  g.globalCompositeOperation = 'lighter';
  // 빛 무리
  for (const b of envBeams()) {
    const f = inFront(b.lat, b.lon); if (!f.ok) continue;
    const p = m.project([b.lon, b.lat]), [la2, lo2] = _envOff(b.lat, b.lon, 0, b.r), p2 = m.project([lo2, la2]);
    const rp = Math.max(6, Math.min(400, Math.hypot(p2.x - p.x, p2.y - p.y)));
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rp);
    gr.addColorStop(0, `rgba(255,248,220,${0.55 * b.k})`); gr.addColorStop(1, 'rgba(255,248,220,0)');
    g.save(); g.translate(p.x, p.y); g.scale(1, 0.55); g.translate(-p.x, -p.y); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, rp, 0, 7); g.fill(); g.restore();
  }
  for (const [la, lo, col, k] of _envLightPts(t)) {
    if (!col) continue;
    const f = inFront(la, lo); if (!f.ok) continue;
    const p = m.project([lo, la]); if (!(p.x > -20 && p.x < r.width + 20 && p.y > -20 && p.y < r.height + 20)) continue;
    const a = Math.exp(-f.d / (visM * 1.5)), sz = Math.max(1.2, Math.min(9, 900 / Math.max(60, f.d))) * k;
    if (a < 0.03) continue;
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 3);
    gr.addColorStop(0, col); gr.addColorStop(0.35, col + '88'.slice(0, col.length === 7 ? 2 : 0)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, sz * 3, 0, 7); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
(function envFxLoop() { try { envFxFrame(); } catch (e) { _swallow(e); } requestAnimationFrame(envFxLoop); })();
