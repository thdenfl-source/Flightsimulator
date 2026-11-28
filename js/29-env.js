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
const env = { tod: 'DAY', vis: 0, rain: 0, snow: 0, nvg: false, sea: 0, gust: 0, ceil: 0, ctop: 0, ldg: false, raCall: true, surface: 'normal', traffic: 0, tfcType: 'mix', tfcPat: 1, oat: 'auto', parked: true };
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
  // NVG 관 시야 · 알갱이(CSS html.env-nvg #map3d .env-nvg)
  if (host && !host.querySelector('.env-nvg')) { const r = document.createElement('div'); r.className = 'env-nvg'; host.appendChild(r); }
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
  for (const k of ['tod', 'vis', 'rain', 'snow', 'nvg', 'sea', 'gust', 'ceil', 'ctop', 'ldg', 'raCall', 'surface', 'traffic', 'tfcType', 'tfcPat', 'oat', 'parked']) if (o[k] !== undefined) env[k] = o[k];
  if (o.oat !== undefined && o.oat !== 'auto' && Number.isFinite(+o.oat)) window._oatSurfaceC = +o.oat;   // 지면 기온을 손으로(결빙 연습) — 'auto' 면 METAR 대로
  env.sea = Math.max(0, Math.min(6, env.sea | 0)); env.rain = Math.max(0, Math.min(2, env.rain | 0)); env.snow = Math.max(0, Math.min(2, env.snow | 0));
  if (o.sea !== undefined) env._seaApplied = -1;
  _envSave(); envApply(); envPanelRender();
}
// ── 결빙 — 외기온도 5°C 이하에서 습기(구름 속 · 비 · 1.6km 아래 안개)에 들면 결빙 조건(ICE DETECTED)
//   착빙(envIce.acc 0~1): 구름 속이면 3분에 가득 · 비 · 안개는 그보다 천천히 · 5°C 넘으면 1분에 녹고, 습기만 벗어나면 10분에 걷힌다
//     → SIM 필요 토크가 최대 8% 늘고(로터 착빙 · 14-simmode.js 가 iceTqK 를 곱한다)
//   엔진 착빙(envIce.eng[n]): 그 엔진 방빙(상부 콘솔 NO1 · NO2 ENG A/I)이 꺼져 있고 NG 87.5% 위에서 2분에 가득 · 방빙을 켜면 1분에 녹는다
//     → 낼 수 있는 토크가 엔진마다 최대 6% 줄고 'n ENG ICING'(황)
//   피토 히트 OFF 로 착빙 30% 를 넘기면 속도계가 그 값에 굳는다(PITOT HEAT 을 켜거나 녹으면 풀린다)
const envIce = { cond: false, acc: 0, eng: { 1: 0, 2: 0 }, pitot: false };
function oatNowC() { return (window._oatSurfaceC ?? 15) - 1.98 * (S.alt || 0) / 1000; }
// 습기 정도(0~1) — 구름 속 1 · 강한 비 0.8 · 약한 비 0.5 · 짙은 안개(시정 1.6km 아래) 0.35
// 구름층 윗면(ft) — '구름 윗면'을 밑면보다 높게 골랐으면 그 높이, 아니면(자동) 밑면 + 1,500ft · 구름이 없으면 0
function envCloudTop() { const b = +env.ceil || 0; if (!b) return 0; const t = +env.ctop || 0; return t > b ? t : b + 1500; }
function envMoisture() {
  const base = env.ceil || 0, alt = S.alt || 0;
  if (base > 0 && alt >= base && alt <= envCloudTop()) return 1;
  if (env.rain >= 2 || env.snow >= 2) return 0.8;
  if (env.rain >= 1 || env.snow >= 1) return 0.5;
  if (env.vis > 0 && env.vis < 1.6) return 0.35;
  return 0;
}
let _iceT = 0;
function envIceStep(dt) {
  if (env.oat !== 'auto' && Number.isFinite(+env.oat)) window._oatSurfaceC = +env.oat;   // METAR 가 덮어써도 손으로 고른 기온을 지킨다
  const oat = oatNowC(), m = envMoisture(), cond = oat <= 5 && m > 0;
  if (cond && !envIce.cond) { try { if (typeof fdrNote === 'function') fdrNote(`결빙 조건 — 외기 ${oat.toFixed(0)}°C`, 'warn'); } catch (e) { _swallow(e); } }
  envIce.cond = cond;
  if (!(dt > 0)) return;
  const cl = v => Math.max(0, Math.min(1, v));
  envIce.acc = cl(envIce.acc + (cond ? m * dt / 180 : -(oat > 5 ? dt / 60 : dt / 600)));
  let P = null; try { P = engParams(); } catch (e) { P = null; }
  [1, 2].forEach(n => {
    const ov = typeof ovhdGet === 'function' ? ovhdGet('engAi' + n) : 'OFF', e = P ? (n === 1 ? P.e1 : P.e2) : null;
    const prot = ov === 'ON' || (e && e.ng <= 87.5), run = e && e.ng > 50;
    envIce.eng[n] = cl(envIce.eng[n] + (cond && run && !prot ? m * dt / 120 : -dt / 60));
  });
  // 피토관 착빙 — 속도계가 굳는다(교관이 건 속도계 고장과 겹치지 않게 제가 굳힌 것만 푼다)
  const pitotOff = typeof ovhdGet === 'function' && ovhdGet('pitotHeat') === 'OFF';
  try {
    if (typeof instFail !== 'undefined') {
      if (!envIce.pitot && pitotOff && cond && envIce.acc > 0.3 && instFail.asi === null) { instFail.asi = Math.round(S.spd || 0); envIce.pitot = true; try { fdrNote('피토관 착빙 — 속도계 굳음', 'err'); } catch (e) { _swallow(e); } }
      else if (envIce.pitot && (!pitotOff || envIce.acc < 0.1)) { instFail.asi = null; envIce.pitot = false; }
    }
  } catch (e) { _swallow(e); }
}
// SIM 필요 토크 배율(로터 착빙) · 낼 수 있는 토크 배율(엔진 착빙)
function iceTqK() { return 1 + 0.08 * envIce.acc; }
function iceEngK() { return 1 - 0.03 * (envIce.eng[1] + envIce.eng[2]); }
// PFD 메시지(03-pfd.js pfdMsgs) — ICE DETECTED · n ENG ICING(황)
function iceCas() {
  const out = [];
  if (envIce.cond) out.push({ t: 'ICE DETECD', c: '#ffb000' });
  [1, 2].forEach(n => { if (envIce.eng[n] > 0.2) out.push({ t: `${n} ENG ICING`, c: '#ffb000' }); });
  if (envIce.pitot) out.push({ t: 'PITOT ICING', c: '#ffb000' });
  return out;
}
setInterval(() => {
  const now = performance.now(), dtR = _iceT ? Math.min(2, (now - _iceT) / 1000) : 0; _iceT = now;
  let k = 0; try { k = S.running ? (typeof simSpeed === 'number' ? simSpeed : 1) : 0; } catch (e) { k = 0; }
  try { envIceStep(dtR * k); } catch (e) { _swallow(e); }
}, 500);
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
    const cur = (k === 'nvg' || k === 'ldg' || k === 'raCall' || k === 'parked') ? String(!!env[k]) : String(env[k]);
    b.classList.toggle('on', cur === v);
  });
  const cn = w.querySelector('[data-envv="cloud"]');
  if (cn) { const b = +env.ceil || 0, t = envCloudTop(); cn.textContent = b ? `구름층 ${b.toLocaleString()} ~ ${t.toLocaleString()}ft — 그 사이는 구름 속(IMC)${env.ctop && +env.ctop <= b ? ' · 윗면이 밑면보다 낮아 자동(+1,500ft)으로' : ''}` : '구름 없음 — 밑면을 고르면 윗면까지 구름 속'; }
  const s = w.querySelector('[data-envv="sea"]');
  if (s) s.textContent = `${ENV_SEA_NAME[env.sea]} — 함정 롤 ${ENV_SEA_ROLL[env.sea]}° · 피칭 ${ENV_SEA_PITCH[env.sea]}° · 익수자 표류 ${ENV_SEA_DRIFT[env.sea]}kt(바람 쪽)`;
  const ic = w.querySelector('[data-envv="ice"]');
  if (ic) { const o = oatNowC(); ic.textContent = `외기 ${o.toFixed(0)}°C · ${envIce.cond ? '결빙 조건(습기 · 5°C 이하)' : '결빙 조건 아님'} · 착빙 ${Math.round(envIce.acc * 100)}% · 엔진 ${Math.round(envIce.eng[1] * 100)} / ${Math.round(envIce.eng[2] * 100)}%`; }
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
      grp('구름 윗면', 'ctop', [[0, '자동(+1,500)'], ...[1500, 2500, 4000, 6000, 9000, 12000].map(v => [v, v.toLocaleString() + 'ft'])]) +
      `<div class="env-note" data-envv="cloud"></div>` +
      grp('눈', 'snow', [[0, '없음'], [1, '약'], [2, '강']]) +
      grp('지면', 'surface', [['normal', '보통'], ['sand', '모래(브라운아웃)'], ['snow', '눈(화이트아웃)']]) +
      grp('교통량(TCAS)', 'traffic', [0, 1, 3, 5].map(v => [v, v ? v + '대' : '없음'])) +
      grp('교통 기종', 'tfcType', [['mix', '섞어서'], ['kuh', '흰수리'], ['b206', 'Bell 206']]) +
      grp('교통 장주비행', 'tfcPat', [[0, '없음'], [1, '셋에 하나'], [2, '반'], [3, '모두']]) +
      grp('지면 기온(결빙)', 'oat', [['auto', 'METAR'], [15, '15°C'], [5, '5°C'], [0, '0°C'], [-5, '−5°C'], [-15, '−15°C']]) +
      `<div class="env-note" data-envv="ice"></div>` +
      grp('공항 주기 헬기', 'parked', [['false', '없음'], ['true', '있음']]) +
      grp('착륙등(흰수리)', 'ldg', [['false', '끔'], ['true', '켬']]) +
      grp('RA 콜아웃', 'raCall', [['false', '끔'], ['true', '켬']]) +
      `<div class="env-note" data-envv="sea"></div><div class="env-row"><span>IIMC 연습</span><div><button class="sim-btn" data-envx="iimc">⚠ 지금 구름 속으로(IIMC) — 회복 판정</button></div></div><div class="env-row"><span>METAR</span><div><button class="sim-btn" data-envx="metar">가까운 공항 METAR 로 맞추기</button></div></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target.closest('[data-envx="metar"]')) { if (typeof envMetarNearest === 'function') envMetarNearest().then(() => envPanelRender()); return; }
      if (e.target.closest('[data-envx="iimc"]')) { w.style.display = 'none'; if (typeof iimcStart === 'function') iimcStart(); return; }
      if (e.target === w || e.target.closest('[data-envx]')) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-env]'); if (!b) return;
      const [k, v] = b.dataset.env.split(':');
      envSet({ [k]: (k === 'tod' || k === 'surface' || k === 'tfcType' || (k === 'oat' && v === 'auto')) ? v : (k === 'nvg' || k === 'ldg' || k === 'raCall' || k === 'parked') ? v === 'true' : +v });
      // 교통 기종 · 장주 몫을 바꾸면 지금 떠 있는 교통을 새로 띄운다
      if ((k === 'tfcType' || k === 'tfcPat') && typeof traffic !== 'undefined') { const n = env.traffic; traffic.length = 0; env.traffic = n; }
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
const NVG_HALO_K = 2.2;   // NVG — 불빛 번짐(할로) 배율
const _envD2R = Math.PI / 180;
function _envOff(lat, lon, n, e) { return [lat + n / 110540, lon + e / (111320 * Math.cos(lat * _envD2R))]; }
function _envDist(la1, lo1, la2, lo2) { const n = (la2 - la1) * 110540, e = (lo2 - lo1) * 111320 * Math.cos(la1 * _envD2R); return { n, e, d: Math.hypot(n, e) }; }
// 지금 켜진 빛 무리 — [{ lat, lon, r(m), k(세기 0~1) }]
function envBeams() {
  const out = []; let agl = 1000; try { agl = radarAltFt(); } catch (e) { _swallow(e); }
  const aglM = Math.max(1, agl * 0.3048), hd = S.hdg * _envD2R;
  // reach — 빛이 닿는 거리(m · 흰수리 서치라이트 1200 · 착륙등 2400) · wide — 빛 무리 너비(거리에 견준)
  // src — 등 자리(기체 원점에서 앞 f · 오른쪽 r m · 흰수리 외장 탐조등은 왼쪽 승무원 도어 밑)
  const beam = (downDeg, k, az = 0, reach = 600, wide = 0.18, src = null) => {
    const dn = Math.max(reach > 600 ? 1 : 4, downDeg + (S.pit || 0) * -1);
    const d = aglM / Math.tan(dn * _envD2R); if (!(d > 0) || d > reach) return;
    const h = hd + az * _envD2R;
    let la0 = S.lat, lo0 = S.lon, sl = null;
    if (src) { [la0, lo0] = _envOff(S.lat, S.lon, src.f * Math.cos(hd) - src.r * Math.sin(hd), src.f * Math.sin(hd) + src.r * Math.cos(hd)); sl = { lat: la0, lon: lo0 }; }
    const [la, lo] = _envOff(la0, lo0, d * Math.cos(h), d * Math.sin(h));
    out.push({ lat: la, lon: lo, r: Math.max(8, d * wide), k: k * Math.max(0, 1 - 0.75 * d / reach), src: sl });
  };
  try {
    if (typeof acB206 === 'function' && acB206() && typeof b206c !== 'undefined') {
      if (b206c.ldg) beam(14, 1);
      if (b206c.srch === 'ON') beam(b206c.srchExt ? 30 : 20, 0.9);
    } else if (typeof kgBeams === 'function') kgBeams().forEach(b => beam(b.down, b.k, b.az, b.reach, b.wide, b.src));   // 흰수리 — 착륙등(펼침) · 서치라이트(35-kuhgrip.js)
    else if (env.ldg) beam(14, 1);
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
        const H = TUNE.hapi, col = ang > H.high ? (blink ? '#3dff6a' : null) : ang >= H.ok ? '#3dff6a' : ang >= H.slight ? '#ff3030' : (blink ? '#ff3030' : null);
        const [la, lo] = at(0, y0 - 1); if (col) P.push([la, lo, col, 1.6, 'HAPI']);
        envHapi = { ang, col: ang > H.high ? '높음' : ang >= H.ok ? '정상' : ang >= H.slight ? '조금 낮음' : '낮음' };
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
// ── 함정 착함 신호(LSO · 착함 신호수) — 함정 0.5NM · 500ft 안에서 3D 화면 위에 신호를 띄운다 ──
//   착함 원에 대한 좌우 어긋남 · 접근각(HAPI 와 같은 3.5° 기준) · 강하율 · 뱅크를 보고
//   WAVE OFF(빨강) > 높이(▲ 올려 · ▼ 내려) > 좌우(◀ · ▶) > 정상(● 계속) > 갑판 위 저속 저고도면 '착함'(초록)
function shipLsoSignal() {
  if (typeof shipLat === 'undefined' || shipLat === null || !shipVisible) return null;
  const D = _envD2R, h = shipHdg * D, F = [Math.cos(h), Math.sin(h)];
  const td = _envOff(shipLat, shipLon, F[0] * SHIP3D_TD.fwd, F[1] * SHIP3D_TD.fwd);
  const v = _envDist(td[0], td[1], S.lat, S.lon);                          // 착함 원 → 내 기체(북 · 동 m)
  const along = v.n * F[0] + v.e * F[1], cross = -v.n * F[1] + v.e * F[0];  // 함수 쪽 + · 우현 쪽 +
  const hft = S.alt - SHIP3D_DECK / 0.3048, dist = v.d;
  if (dist > 926 || hft > 500) return null;
  let bank = Math.abs(S.bnk || 0), vs = S.vs || 0, gs = 0; try { gs = groundSpdKt(); } catch (e) { _swallow(e); }
  const shipKt = typeof shipSpd === 'number' ? shipSpd : 0;
  if (dist < SHIP3D_TD.r * 1.2 && hft < 15 && Math.abs(gs - shipKt) < 8) return { k: 'land', txt: '착함 — 그대로 내려앉으십시오', col: '#3dff6a' };
  if ((hft < 120 && vs < -500) || bank > 20) return { k: 'waveoff', txt: 'WAVE OFF — 상승 · 복행', col: '#ff3030' };
  const ang = Math.atan2(Math.max(0, hft) * 0.3048, Math.max(20, dist)) / D;
  const lat = dist < 60 ? cross : cross * 60 / dist;                       // 가까울수록 좌우를 엄하게
  if (dist > 40 && ang > 4.5) return { k: 'down', txt: '▼ 내려 — 높음', col: '#ffd23a' };
  if (dist > 40 && ang < 2.5) return { k: 'up', txt: '▲ 올려 — 낮음', col: '#ffd23a' };
  if (lat > 6) return { k: 'left', txt: '◀ 왼쪽으로', col: '#ffd23a' };
  if (lat < -6) return { k: 'right', txt: '오른쪽으로 ▶', col: '#ffd23a' };
  return { k: 'ok', txt: '● 좋음 — 계속', col: '#3dff6a' };
}
let shipLso = null;
setInterval(() => {
  try {
    shipLso = shipLsoSignal();
    const host = document.getElementById('map3d'); if (!host) return;
    let el = document.getElementById('lso-sig');
    if (!shipLso) { if (el) el.style.display = 'none'; return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'lso-sig';
      el.style.cssText = 'position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:6;pointer-events:none;padding:4px 12px;border-radius:6px;background:rgba(0,0,0,0.6);font:bold 15px Arial;border:2px solid';
      host.appendChild(el);
    }
    el.style.display = 'block';
    const t = `LSO  ${shipLso.txt}`; if (el.textContent !== t) el.textContent = t;
    el.style.color = shipLso.col; el.style.borderColor = shipLso.col;
  } catch (e) { _swallow(e); }
}, 200);
let envHapi = null, envSarLit = false, tfcTagN = 0;   // tfcTagN — 이번 장면에 그린 교통 꼬리표 수
// ── 지형 가림(3D) — 카메라에서 불까지 12곳의 지형 높이를 보고, 시선보다 높은 곳이 있으면 가린다 ──
//   지형 높이는 그려진 3D 지형(queryTerrainElevation · 과장 배율 그대로)이라 카메라 높이와 같은 잣대다.
//   불 하나마다 0.6초 기억하고, 한 장면에 새로 재는 것은 60개까지(나머지는 지난 값).
const ENV_OCC_N = 12, ENV_OCC_TTL = 600, ENV_OCC_MAX = 60;
const _envOcc = new Map(); let _envOccBudget = 0;
function envCamEye(m, cam) {
  try {
    const fc = m.getFreeCameraOptions && m.getFreeCameraOptions();
    if (fc && fc.position && fc.position.toAltitude) { const ll = fc.position.toLngLat(); return { lat: ll.lat, lng: ll.lng, h: fc.position.toAltitude() }; }
  } catch (e) { _swallow(e); }
  return cam ? { lat: cam.lat, lng: cam.lng, h: (S.alt || 0) * 0.3048 } : null;
}
// hM — 불 높이: 수(m)면 그 자리 땅 위 높이 · { air: 기압고도(m) } 면 공중의 불(교통) — 그려진 땅 + (고도 − 실제 땅)
function envLightVisible(m, eye, la, lo, hM) {
  if (!m.queryTerrainElevation) return true;
  const now = performance.now(), key = la.toFixed(5) + ',' + lo.toFixed(5);
  const c = _envOcc.get(key);
  if (c && now - c.t < ENV_OCC_TTL) return c.v;
  if (_envOccBudget <= 0) return c ? c.v : true;
  _envOccBudget--;
  let v = true;
  try {
    const q = ll => { const z = m.queryTerrainElevation(ll); return Number.isFinite(z) ? z : null; };
    const g0 = q([lo, la]), gd = g0 == null ? 0 : Math.max(0, g0);
    const ex = (typeof MAP3D_EXAG === 'number' && MAP3D_EXAG > 0) ? MAP3D_EXAG : 1;
    const lh = (hM && typeof hM === 'object') ? gd + Math.max(3, hM.air - gd / ex) : gd + (hM || 3);   // 불 높이 — 땅 불은 지면 + 3m
    // 먼 불일수록 촘촘히 짚는다(150m 마다 · 12~32곳) — 성긴 짚기로 능선 사이를 빠져나가 보이던 일
    const dKm = Math.hypot((la - eye.lat) * 110.54, (lo - eye.lng) * 111.32 * Math.cos(la * Math.PI / 180));
    const N = Math.max(ENV_OCC_N, Math.min(32, Math.round(dKm * 1000 / 150)));
    for (let i = 1; i < N; i++) {
      const k = i / N, sla = eye.lat + (la - eye.lat) * k, slo = eye.lng + (lo - eye.lng) * k;
      const z = q([slo, sla]); if (z == null) continue;
      if (z > eye.h + (lh - eye.h) * k + 2) { v = false; break; }
    }
  } catch (e) { _swallow(e); }
  _envOcc.set(key, { v, t: now });
  if (_envOcc.size > 4000) { for (const [k2, c2] of _envOcc) if (now - c2.t > ENV_OCC_TTL) _envOcc.delete(k2); }
  return v;
}
// 빛줄기 — 등(1인칭이면 화면 아래 가운데 · 밖에서 보면 헬기 자리 위)에서 빛 무리까지 엷은 원뿔
function envBeamCone(g, r, m, p, rp, b, first) {
  let s;
  const hs = b.src && typeof _h3HslScr !== 'undefined' && _h3HslScr && performance.now() - _h3HslScr.t < 500 ? _h3HslScr : null;
  if (hs && !first) s = { x: hs.x, y: hs.y };                       // 외장형 탐조등 — 3D 모형의 렌즈에서
  else if (first) s = { x: r.width / 2, y: r.height + 10 };
  else {                                                                // 헬기 자리 — 땅 위 점을 높이만큼(화면 축척) 위로
    // 축척(px/m)은 화면 가로(카메라 방위에 직각)로 잰다 — 앞뒤로 재면 원근에 눌려 빛줄기가 하늘에서 내려오는 것처럼 보였다
    const cb = ((m.getBearing ? m.getBearing() : 0) + 90) * Math.PI / 180;
    const o0 = b.src || { lat: S.lat, lon: S.lon }, a = m.project([o0.lon, o0.lat]), [la3, lo3] = _envOff(o0.lat, o0.lon, 100 * Math.cos(cb), 100 * Math.sin(cb)), a2 = m.project([lo3, la3]);
    const ppm = Math.hypot(a2.x - a.x, a2.y - a.y) / 100, agl = (typeof radarAltFt === 'function' ? radarAltFt() : S.alt || 0) * 0.3048;
    s = { x: a.x, y: a.y - Math.min(r.height * 0.6, Math.max(6, agl * ppm * Math.sin(((m.getPitch ? m.getPitch() : 60)) * Math.PI / 180))) };
  }
  const ang = Math.atan2(p.y - s.y, p.x - s.x), w = Math.max(4, rp * 0.9), nx = -Math.sin(ang), ny = Math.cos(ang);
  const gr = g.createLinearGradient(s.x, s.y, p.x, p.y);
  gr.addColorStop(0, `rgba(255,250,225,${0.30 * b.k})`); gr.addColorStop(1, `rgba(255,250,225,${0.06 * b.k})`);
  g.fillStyle = gr; g.beginPath(); g.moveTo(s.x - nx * 2, s.y - ny * 2); g.lineTo(s.x + nx * 2, s.y + ny * 2);
  g.lineTo(p.x + nx * w, p.y + ny * w); g.lineTo(p.x - nx * w, p.y - ny * w); g.closePath(); g.fill();
  if (!first) { const hg = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 10); hg.addColorStop(0, `rgba(255,255,240,${0.95 * b.k})`); hg.addColorStop(1, 'rgba(255,255,240,0)'); g.fillStyle = hg; g.beginPath(); g.arc(s.x, s.y, 10, 0, 7); g.fill(); }   // 밖에서 보면 등 자체도 빛난다
}
function envFxFrame() {
  const fx = _envFxEls(); if (!fx) return;
  // 구름 속
  const base = env.ceil || 0, top = envCloudTop(), alt = S.alt || 0;
  let co = 0; if (base > 0) co = Math.max(0, Math.min(1, (alt - base + 60) / 120)) * Math.max(0, Math.min(1, (top + 60 - alt) / 120));
  const shown = (typeof heli3dShown === 'function' && heli3dShown()) || (typeof _ckFirst === 'function' && _ckFirst());
  fx.cl.style.opacity = shown || co > 0 ? co.toFixed(2) : '0';
  try { fx.cl.style.setProperty('--cl-deep', base > 0 ? Math.max(0, Math.min(1, Math.min(alt - base, top - alt) / 600)).toFixed(2) : '0'); } catch (e) { _swallow(e); }   // 층 가운데일수록 짙게
  const inC = co > 0.6;
  if (inC !== _envCloudIn) { _envCloudIn = inC; if (inC) { try { if (typeof fdrNote === 'function') fdrNote(`구름 진입(IMC) — ${Math.round(alt)}ft`, 'warn'); } catch (e) { _swallow(e); } } }
  // 불빛 — 밤 · 황혼 · NVG 에만
  const dark = env.tod !== 'DAY' || env.nvg;
  const tfc = (typeof traffic !== 'undefined') ? traffic : [];
  const cv = fx.cv, m = (typeof _ml3d !== 'undefined') ? _ml3d : null;
  // 낮에도 켜진 착륙등 · 서치라이트는 엷게 보인다(빛줄기 · 빛 무리 35%)
  const dayBeams = !dark && (() => { try { return envBeams().length > 0; } catch (e) { return false; } })();
  if ((!dark && !tfc.length && !dayBeams) || !m || !m.project) { if (cv.width) { cv.width = 0; } return; }
  const r = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const t = performance.now() / 1000, camB = (m.getBearing() || 0) * _envD2R;
  const visM = env.vis > 0 ? env.vis * 1000 : 30000;
  // 카메라 자리(조종석이면 기체 · 지도식 3D 면 위쪽 어딘가)에서 앞쪽에 있는 불만 그린다
  let cam = { lat: S.lat, lng: S.lon }; try { const c = m.transform && m.transform.getCameraLngLat ? m.transform.getCameraLngLat() : null; if (c) cam = c; } catch (e) { _swallow(e); }
  const inFront0 = (la, lo) => { const v = _envDist(cam.lat, cam.lng, la, lo); if (v.d < 5) return { ok: true, d: v.d }; const a = Math.atan2(v.e, v.n) - camB; return { ok: Math.cos(a) > 0.05 || (m.getPitch && m.getPitch() < 50), d: v.d }; };
  // 산 뒤의 불은 가린다 — 카메라 눈높이에서 불까지 지형을 짚어 본다(envLightVisible · 0.6초 동안 기억)
  const eye = envCamEye(m, cam); _envOccBudget = ENV_OCC_MAX;
  const inFront = (la, lo, hM) => { const f = inFront0(la, lo); if (f.ok && eye && f.d > 150 && !envLightVisible(m, eye, la, lo, hM)) f.ok = false; return f; };
  // 다른 항공기 — 낮에는 작은 점 · 밤에는 충돌방지등(빨강 깜빡 · 흰 번쩍) · 꼬리표
  tfcTagN = 0;
  for (const tr of tfc) {
    const f = inFront(tr.lat, tr.lon, { air: (tr.alt || 0) * 0.3048 }); if (!f.ok || f.d > 20000) continue;
    const p = m.project([tr.lon, tr.lat]); const dy = ((tr.alt - S.alt) * 0.3048) / Math.max(50, f.d) * r.height * 0.9;
    const y = p.y - dy - 4; if (!(p.x > -20 && p.x < r.width + 20 && y > -20 && y < r.height + 20)) continue;
    // 낮 · 4km 안은 실제 모형(15-heli3d.js)이 보인다 — 점은 먼 데만
    if (dark || f.d >= 4000 || typeof TFC3D_LAYER === 'undefined') {
      const blink = Math.floor(t * 1.5 + tr.id) % 2 === 0;
      g.fillStyle = dark ? (blink ? '#ff2a2a' : '#ffffff') : '#20262c'; g.globalAlpha = dark ? 1 : 0.8;
      g.beginPath(); g.arc(p.x, y, Math.max(1.5, Math.min(5, 3000 / Math.max(300, f.d))) * (env.nvg ? NVG_HALO_K : 1), 0, 7); g.fill();
    }
    // 꼬리표 — 기종 · 상대고도(백 ft) · 거리(NM) · TCAS 색(멀어 모형이 작아도 알아보게)
    if (typeof tcasShow === 'function' && !tcasShow(tr)) continue;   // 꼬리표는 TCAS 가 그리는 교통만(CDU TCAS 모드 · 고도 범위)
    const col = tr.st === 'RA' ? '#ff3030' : tr.st === 'TA' ? '#ffb000' : dark ? '#e8f4ff' : '#0b2a44';
    const lbl = `${tr.ac === 'b206' ? 'B206' : tr.ac === 'r22' ? 'R22' : 'KUH'} ${typeof tcasAltTag === 'function' ? tcasAltTag(tr) : ''} ${(f.d / 1852).toFixed(1)}`;
    g.globalAlpha = 0.9; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.lineWidth = 3;
    g.strokeStyle = dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)'; g.strokeText(lbl, p.x, y - 10);
    g.fillStyle = col; g.fillText(lbl, p.x, y - 10);
    tfcTagN++;
  }
  g.globalAlpha = 1;
  if (!dark && !dayBeams) return;
  g.globalCompositeOperation = 'lighter';
  const beamK = dark ? 1 : 0.35;
  // 빛 무리 — 땅에 떨어진 빛 · 그 위로 헬기에서 내려오는 빛줄기(원뿔)
  const first = typeof _ckFirst === 'function' && _ckFirst();
  for (const b0 of envBeams()) {
    const b = { ...b0, k: b0.k * beamK };
    const f = inFront(b.lat, b.lon); if (!f.ok) continue;
    const p = m.project([b.lon, b.lat]), [la2, lo2] = _envOff(b.lat, b.lon, 0, b.r), p2 = m.project([lo2, la2]);
    const rp = Math.max(6, Math.min(400, Math.hypot(p2.x - p.x, p2.y - p.y)));
    try { envBeamCone(g, r, m, p, rp, b, first); } catch (e) { _swallow(e); }
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rp);
    gr.addColorStop(0, `rgba(255,248,220,${0.55 * b.k})`); gr.addColorStop(1, 'rgba(255,248,220,0)');
    g.save(); g.translate(p.x, p.y); g.scale(1, 0.55); g.translate(-p.x, -p.y); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, rp, 0, 7); g.fill(); g.restore();
    if (b.k > 1.2) {   // 착륙등보다 센 빛(흰수리 외장형 탐조등) — 가운데가 더 하얗게 빛난다
      const g2 = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rp * 0.55);
      g2.addColorStop(0, `rgba(255,255,245,${Math.min(0.9, (b.k - 1) * 0.45)})`); g2.addColorStop(1, 'rgba(255,255,245,0)');
      g.save(); g.translate(p.x, p.y); g.scale(1, 0.55); g.translate(-p.x, -p.y); g.fillStyle = g2; g.beginPath(); g.arc(p.x, p.y, rp * 0.55, 0, 7); g.fill(); g.restore();
    }
  }
  if (!dark) { g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; return; }   // 낮 — 활주로 · 함정 불빛은 그리지 않는다
  for (const [la, lo, col, k] of _envLightPts(t)) {
    if (!col) continue;
    const f = inFront(la, lo); if (!f.ok) continue;
    const p = m.project([lo, la]); if (!(p.x > -20 && p.x < r.width + 20 && p.y > -20 && p.y < r.height + 20)) continue;
    // NVG 는 빛을 키워 번지게 한다(할로) — 작은 불도 멀리서 크게 보인다
    const a = Math.exp(-f.d / (visM * (env.nvg ? 2.5 : 1.5))), sz = Math.max(1.2, Math.min(9, 900 / Math.max(60, f.d))) * k * (env.nvg ? NVG_HALO_K : 1);
    if (a < 0.03) continue;
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 3);
    gr.addColorStop(0, col); gr.addColorStop(0.35, col + '88'.slice(0, col.length === 7 ? 2 : 0)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, sz * 3, 0, 7); g.fill();
  }
  // 내 기체의 위치표시등 · 충돌방지등(15-heli3d.js _h3DrawLights 가 넘긴 화면 자리 · 멈춰 있으면 지도를 드물게 다시 그리므로 2초까지 쓴다) — 어두울 때 지도 그림은 CSS 로 깎이므로
  // 빛 무리는 이 겹에 그린다. 밤에는 낮보다 번져 크게 · 진하게(눈이 어둠에 익어 같은 등이 더 밝아 보인다)
  try {
    const L = (typeof _h3LtScr !== 'undefined') ? _h3LtScr : null;
    if (L && performance.now() - L.t < 2000 && (typeof heli3dShown !== 'function' || heli3dShown())) {
      const sx = r.width / Math.max(1, L.w), sy = r.height / Math.max(1, L.h), night = env.tod === 'NIGHT' || env.nvg;
      for (const p of L.pts) {
        const x = p.x * sx, y = p.y * sy; if (!(x > -50 && x < r.width + 50 && y > -50 && y < r.height + 50)) continue;
        const rad = Math.max(4, Math.min(60, p.r * (night ? 2.2 : 1.6))), a = Math.min(1, (0.35 + 0.65 * p.k) * (night ? 1.25 : 1));
        const c = p.col.map(v => Math.round(Math.min(1, v) * 255)).join(',');
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.18, `rgba(${c},${a})`); gr.addColorStop(0.5, `rgba(${c},${a * 0.35})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      }
    }
  } catch (e) { _swallow(e); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
(function envFxLoop() { try { envFxFrame(); } catch (e) { _swallow(e); } requestAnimationFrame(envFxLoop); })();

// ── 비 · 눈(3D 창 위 캔버스) — 입자마다 깊이(가까울수록 크고 빠르고 진하다) · 바람 기울기 · 앞으로 날면 화면 가운데에서 바깥으로 흐른다 ──
//   비: 길이 · 굵기 · 투명도가 다른 빗줄기 + 강하면 바닥 물보라 · 앞유리 물방울(흘러내린다)
//   눈: 크기가 다른 눈송이가 흔들리며 내린다(가까운 것은 흐릿하게 크게) · 앞으로 날면 바깥으로 흩어진다
const ENV_PRECIP_N = { rain: [0, 260, 720], snow: [0, 220, 600] };
const _envP = { cv: null, rain: [], snow: [], drops: [], last: 0, W: 0, H: 0 };
function _envPrecipEl() {
  const host = document.getElementById('map3d'); if (!host) return null;
  if (!_envP.cv || !_envP.cv.isConnected) { const cv = document.createElement('canvas'); cv.className = 'env-precip'; host.appendChild(cv); _envP.cv = cv; }
  return _envP.cv;
}
function _envRainP(W, H, top) { const z = 0.25 + Math.random() * 0.75; return { x: Math.random() * W, y: top ? -Math.random() * H * 0.3 : Math.random() * H, z, l: 8 + 26 * z * (0.6 + Math.random() * 0.8), v: 700 + 900 * z, a: 0.12 + 0.45 * z }; }
function _envSnowP(W, H, top) { const z = 0.2 + Math.random() * 0.8; return { x: Math.random() * W, y: top ? -Math.random() * H * 0.2 : Math.random() * H, z, r: 0.8 + 3.2 * z * (0.6 + Math.random() * 0.7), v: 30 + 110 * z, ph: Math.random() * 6.28, sw: 10 + 30 * Math.random(), a: 0.45 + 0.5 * z }; }
function envPrecipStep(nowMs) {
  const cv = _envPrecipEl(); if (!cv) return;
  const want = env.rain > 0 || env.snow > 0, host = cv.parentElement;
  const vis = want && host && host.clientWidth > 20 && host.offsetParent !== null && !document.hidden;
  if (!vis) { if (cv.width) { cv.width = 0; _envP.rain.length = 0; _envP.snow.length = 0; _envP.drops.length = 0; } _envP.last = 0; return; }
  const W = host.clientWidth, H = host.clientHeight;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const dt = _envP.last ? Math.min(0.06, (nowMs - _envP.last) / 1000) : 0.016; _envP.last = nowMs;
  const k = (typeof simSpeed === 'number' && simSpeed > 0 && S.running) ? 1 : 1;
  // 바람(화면에서 옆으로) · 앞으로 나는 빠르기(가운데에서 바깥으로)
  let ws = 0, rel = 0; try { ws = typeof windSpd === 'number' ? windSpd : 0; rel = ((typeof windDir === 'number' ? windDir : 0) - (S.hdg || 0)) * Math.PI / 180; } catch (e) { _swallow(e); }
  const side = -Math.sin(rel) * Math.min(1, ws / 40), fwd = Math.max(0, Math.min(1, (S.spd || 0) / 120));
  const cx = W / 2, cy = H * 0.45;
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
  // 비
  const nr = ENV_PRECIP_N.rain[env.rain] || 0, R = _envP.rain;
  while (R.length < nr) R.push(_envRainP(W, H, false)); R.length = Math.min(R.length, nr);
  if (nr) {
    g.lineCap = 'round';
    for (const p of R) {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      const vx = (side * 0.45 + fwd * 1.6 * dx / d) * p.v, vy = (1 - fwd * 0.55) * p.v + fwd * 1.6 * p.v * dy / d;
      p.x += vx * dt * k; p.y += vy * dt * k;
      const sp = Math.hypot(vx, vy) || 1, L = p.l * (1 + fwd * 1.5);
      g.strokeStyle = `rgba(200,215,230,${(p.a * (env.rain === 2 ? 1 : 0.75)).toFixed(3)})`; g.lineWidth = 0.6 + 1.2 * p.z;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - vx / sp * L, p.y - vy / sp * L); g.stroke();
      if (p.y > H + 30 || p.x < -40 || p.x > W + 40 || p.y < -H) {
        if (env.rain === 2 && fwd < 0.3 && p.y > H && Math.random() < 0.25) _envP.drops.push({ x: p.x, y: H - 4 - Math.random() * 30, r: 1 + Math.random() * 2, t: 0, splash: true });
        Object.assign(p, _envRainP(W, H, true)); if (fwd > 0.2) { p.x = cx + (Math.random() - 0.5) * W * 0.3; p.y = cy + (Math.random() - 0.5) * H * 0.3; }
      }
    }
    // 앞유리 물방울(강한 비) — 맺혔다가 흘러내린다 · 바닥 물보라
    if (env.rain === 2 && Math.random() < 0.25 && _envP.drops.length < 60) _envP.drops.push({ x: Math.random() * W, y: Math.random() * H * 0.9, r: 1.5 + Math.random() * 3.5, t: 0 });
    for (let i = _envP.drops.length - 1; i >= 0; i--) {
      const q = _envP.drops[i]; q.t += dt;
      if (q.splash) { const a = Math.max(0, 0.5 - q.t * 2); g.strokeStyle = `rgba(210,225,240,${a.toFixed(2)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(q.x, q.y, q.r * (1 + q.t * 10), q.r * (0.4 + q.t * 3), 0, 0, 6.28); g.stroke(); if (a <= 0) _envP.drops.splice(i, 1); continue; }
      if (q.t > 0.8) q.y += (40 + q.r * 20) * dt * (1 + fwd);                    // 무거워지면 흘러내린다
      if (fwd > 0.3) q.x += (q.x - cx) * fwd * dt * 0.8;                         // 앞으로 날면 옆으로 밀린다
      const gr = g.createRadialGradient(q.x - q.r * 0.3, q.y - q.r * 0.3, 0, q.x, q.y, q.r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(190,210,230,0.18)'); gr.addColorStop(1, 'rgba(120,140,160,0.35)');
      g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 6.28); g.fill();
      if (q.y > H + 10 || q.t > 6) _envP.drops.splice(i, 1);
    }
  } else _envP.drops.length = 0;
  // 눈
  const ns = ENV_PRECIP_N.snow[env.snow] || 0, F = _envP.snow;
  while (F.length < ns) F.push(_envSnowP(W, H, false)); F.length = Math.min(F.length, ns);
  const night = env.tod === 'NIGHT';
  for (const p of F) {
    p.ph += dt * (0.8 + p.z);
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
    const vx = Math.sin(p.ph) * p.sw * (1 - fwd) + side * 90 * p.z + fwd * 420 * p.z * dx / d, vy = p.v * (1 - fwd * 0.6) + fwd * 420 * p.z * dy / d;
    p.x += vx * dt * k; p.y += vy * dt * k;
    const a = p.a * (night ? 0.55 : 1) * (env.snow === 2 ? 1 : 0.8);
    if (p.z > 0.8) { const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6); gr.addColorStop(0, `rgba(255,255,255,${(a * 0.8).toFixed(2)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r * 1.6, 0, 6.28); g.fill(); }   // 가까운 송이는 흐릿하게 크게
    else { g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    if (fwd > 0.15) { g.strokeStyle = `rgba(255,255,255,${(a * 0.35).toFixed(2)})`; g.lineWidth = p.r; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - vx * 0.02, p.y - vy * 0.02); g.stroke(); }   // 빠르면 꼬리
    if (p.y > H + 10 || p.x < -20 || p.x > W + 20 || p.y < -H) { Object.assign(p, _envSnowP(W, H, true)); if (fwd > 0.2) { p.x = cx + (Math.random() - 0.5) * W * 0.4; p.y = cy + (Math.random() - 0.5) * H * 0.4; } }
  }
}
(function envPrecipLoop(t) { try { envPrecipStep(t || performance.now()); } catch (e) { _swallow(e); } requestAnimationFrame(envPrecipLoop); })();
