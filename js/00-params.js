'use strict';
// ══════════════════════════════════════════════════════
// 조정값 한곳(TUNE) — 성능 · 무게중심 · 위험 판정 기준을 여기 모은다.
//   교관이 값을 바꿔 보려면 이 파일만 고치면 된다(다른 파일은 TUNE.… 을 읽는다).
//   한 기기에서만 잠시 바꾸려면 localStorage 'shineTune' 에 JSON 으로 덮어쓸 값만 넣는다
//     예) localStorage.shineTune = '{"lowg":{"n":0.4}}'  → 다시 불러오면 적용 · tuneReset() 로 지운다
// 이 파일은 00-aircraft.js 바로 뒤(index.html <head>)에 읽힌다 — 01-state.js 보다 먼저.
// ══════════════════════════════════════════════════════
const TUNE_DEFAULT = {
  // Bell 206B-3 성능(01-state.js B206P · 09-cdu.js PERF) — 최대 3,200lb · 표준 무게 3,000lb
  b206Perf: { wt: 3000, hovIge: 72, hovOge: 82, vy: 52, vi0: 14, par: 3.51e-5, fpmUp: 24, fpmDn: 38,
              vne: 130, vneAlt: 3000, vnePerKft: 3.5, mtaMax: 100, mtaFlatDa: 6000, mtaPerKft: 3.5, tqCont: 85 },
  // Bell 무게 · 균형(25-b206panel.js) — 팔 길이(in) · 무게중심 한계(in)
  b206Arm: { empty: 116.5, pilot: 65, copilot: 65, rear: 104, cargo: 148, fuel: 110.3 },
  b206Cg:  { fwd: 106.0, aft: 114.2 },
  // 무게중심 → 기수 자세(14-simmode.js simCgPitch) — 기준(in)보다 1in 뒤마다 k° 들림 · 최대 max°
  cgPitch: { ref: 110, k: 0.6, max: 4 },
  // 유압 상실(HYD BOOST OFF) 때 조종 반응 배율
  hydOffK: 0.35,
  // 저중력 · 마스트 범핑(Bell) — G 가 n 아래 · 롤 roll° 넘게 · bumpS 초 이어지면 범핑
  lowg: { n: 0.5, roll: 30, bumpS: 0.8 },
  // LTE — 오른쪽으로 저절로 도는 최대 빠르기(°/s)
  lte: { yaw: 35 },
  // 꼬리로터 고장 — 꼬리날개가 vaneKt 부터 vaneKt+vaneSpan kt 사이에서 잡는다
  trFail: { vaneKt: 25, vaneSpan: 25, driveRate: 45, driveVane: 0.85, fixedK: 0.6, fixedVane: 0.6 },
  // VRS(소용돌이 고리) — 들어가는 · 나오는 기준
  vrs: { kt: 15, outKt: 20, fpm: -700, tq: 25, sink: 1500, tauIn: 2, tauOut: 1.5 },
  // 오토로테이션 착지 평가 — 좋음(강하 · 속도 · NR) · 거침(강하 · 속도) · 나머지는 손상
  autoTd: { goodFpm: 300, goodKt: 15, goodNr: 90, roughFpm: 600, roughKt: 25 },
  // 착수(물 위) — 플로트 ARMED 로 성공하는 강하 · 속도, 공항 몇 NM 안은 물로 보지 않는다
  ditch: { fpm: 300, kt: 20, aptNm: 2 },
  // 함정 HAPI — 접근각(°) 경계: 높음 > high · 정상 ≥ ok · 조금 낮음 ≥ slight · 그 아래 낮음
  hapi: { high: 4.5, ok: 2.5, slight: 1.5 },
  // TCAS — RA(거리 NM · 상대고도 ft · 남은 시간 s) · TA
  tcas: { raNm: 3, raFt: 600, raTau: 25, taNm: 6, taFt: 1200, taTau: 40, taNear: 2 },
};
function _tuneMerge(a, b) {
  for (const k of Object.keys(b || {})) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') _tuneMerge(a[k], b[k]);
    else if (k in a && typeof b[k] === typeof a[k]) a[k] = b[k];         // 아는 이름 · 같은 꼴만
  }
  return a;
}
const TUNE = (() => {
  const t = JSON.parse(JSON.stringify(TUNE_DEFAULT));
  try { const o = localStorage.getItem('shineTune'); if (o) _tuneMerge(t, JSON.parse(o)); } catch (e) { /* 저장소 · JSON 이 잘못되면 기본값 */ }
  return t;
})();
// 바뀐 값만(기본과 다른 것) — 진단 기록 · 설정 화면에서 보인다
function tuneDiff() {
  const out = {};
  const walk = (a, b, p) => { for (const k of Object.keys(a)) { if (a[k] && typeof a[k] === 'object') walk(a[k], b[k], p + k + '.'); else if (a[k] !== b[k]) out[p + k] = a[k]; } };
  walk(TUNE, TUNE_DEFAULT, '');
  return out;
}
function tuneReset() { try { localStorage.removeItem('shineTune'); } catch (e) { /* 무시 */ } }
