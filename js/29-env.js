'use strict';
// ══════════════════════════════════════════════════════
// 29-env.js — 환경(ENV): 시간대 · 시정 · 비 · NVG · 바다 상태
//
// 3D 화면(본 화면 · CHIN 창 · 호이스트 카메라 — maplibre 캔버스 모두)에 건다:
//   시간대 — 주간 · 황혼(어둡고 붉게) · 야간(아주 어둡게). 하늘색도 바꾼다(04-map.js MAP3D_SKY 를 덮는다)
//   시정  — 무제한 · 10 · 5 · 3 · 1.5km · 800 · 400m. 안개가 그 거리에서 짙어진다(maplibre sky fog)
//   비    — 없음 · 약 · 강. 화면에 빗줄기가 흐른다
//   NVG   — 야간투시경 느낌(녹색 · 밝게 · 거칠게)
//   바다 상태 0~6(더글러스) — 함정 롤 · 피칭(09-cdu.js shipRollAmp · shipPitchAmp)과 익수자 표류(24-sar.js)를 정한다
//       0 잔잔 · 1 잔물결(0~0.1m) · 2 약(0.1~0.5) · 3 보통(0.5~1.25) · 4 약간 높음(1.25~2.5) · 5 높음(2.5~4) · 6 매우 높음(4~6m)
// 설정은 이 기기(localStorage 'envSet')에 남는다. 지도 창 · 3D 창의 🌙 ENV 단추로 연다.
// ══════════════════════════════════════════════════════
const ENV_KEY = 'envSet';
const ENV_VIS = [0, 10, 5, 3, 1.5, 0.8, 0.4];                 // km(0 = 무제한)
const ENV_SEA_ROLL = [0, 1, 2, 4, 6, 8, 10], ENV_SEA_PITCH = [0, 0.5, 1, 2, 3, 4, 5];
const ENV_SEA_DRIFT = [0, 0.1, 0.3, 0.6, 0.9, 1.3, 1.8];      // 익수자 바람 쪽 표류(kt) — 파도 · 바람에 밀린다
const ENV_SEA_NAME = ['0 잔잔', '1 잔물결', '2 약', '3 보통', '4 약간 높음', '5 높음', '6 매우 높음'];
const env = { tod: 'DAY', vis: 0, rain: 0, nvg: false, sea: 0 };
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
  for (const k of ['tod', 'vis', 'rain', 'nvg', 'sea']) if (o[k] !== undefined) env[k] = o[k];
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
    const cur = k === 'nvg' ? String(!!env.nvg) : String(env[k]);
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
      `<div class="env-note" data-envv="sea"></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w || e.target.closest('[data-envx]')) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-env]'); if (!b) return;
      const [k, v] = b.dataset.env.split(':');
      envSet({ [k]: k === 'tod' ? v : k === 'nvg' ? v === 'true' : +v });
    });
  }
  w.style.display = 'flex'; envPanelRender();
}
// 3D 지도가 늦게 뜨거나 바탕을 다시 그리면(화질 바꾸기 등) 하늘이 04-map.js 기본으로 돌아간다 — 2초마다 맞춘다
setInterval(() => { if (env.tod !== 'DAY' || env.vis > 0) envApply3d(); }, 2000);
try { envApply(); } catch (e) { _swallow(e); }
try { appRegister({ toggleEnvPanel }); } catch (e) { _swallow(e); }
