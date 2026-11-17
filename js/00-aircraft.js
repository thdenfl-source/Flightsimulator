'use strict';
// ══════════════════════════════════════════════════════
// 기종(aircraft type) — 시작 화면(비밀번호를 넣은 뒤)에서 기종을 고른다.
//   aw189 : KUH-1CG(흰수리 · 내부 이름 aw189) — 기본. 유리 조종석(PFD · MFD 넷 · 쌍발)
//   b206  : Bell 206B-3 JetRanger — 단발 · 아날로그 원형 계기판(25-b206panel.js)
//   r22   : R22 — 단발 터빈 · 아날로그 계기판(한서대 훈련기 HL9169 · HL9175 사진의 배치 · 25-b206panel.js r22Draw).
//           Bell 206 과 같은 갈래(family) — 엔진 · 시동 · 연료 · 하부 콘솔 무전 · 컬렉티브 · SIM 을 함께 쓰고,
//           이름 · 성능(00-params.js r22Perf) · 한계 · 무게 · 계기판 배치만 다르다. acIs('b206') 는 R22 에서도 참.
// (SHINE 저장소에서 만들어 가져왔다 — SHINE 은 b206 이 기본)
// 고르는 길: 시작 화면(00-gate.js 기종 버튼) · 주소 ?ac=b206|aw189 · localStorage 'shineAc'.
// 이 파일은 00-edition.js 바로 뒤(index.html <head>)에 읽힌다 — 다른 파일은 acIs('b206') 로 가른다.
// 기종을 바꾸면 다시 불러온다(화면 틀이 기종마다 달라 한 번에 만드는 것이 간단하다).
// ══════════════════════════════════════════════════════
const AC_TYPES = {
  b206:  { name: 'Bell 206B-3', full: 'Bell 206B-3 JetRanger', engines: 1 },
  aw189: { name: 'KUH-1CG',     full: 'KUH-1CG (흰수리)',        engines: 2 },
  r22:   { name: 'R22',         full: 'R22 (단발 터빈 훈련기)',    engines: 1, family: 'b206' },
};
const AC_PREF = 'shineAc';
const AC_TYPE = (() => {
  try {
    const q = new URLSearchParams(location.search).get('ac');
    if (q && AC_TYPES[q]) return q;
    const s = localStorage.getItem(AC_PREF);
    if (s && AC_TYPES[s]) return s;
  } catch (e) { /* 저장소를 못 쓰면 기본 */ }
  return 'aw189';
})();
// 갈래까지 본다 — R22 는 Bell 206 갈래(acIs('b206') 도 참). 그 기종만 가리려면 acExact
function acIs(k) { return AC_TYPE === k || AC_TYPES[AC_TYPE].family === k; }
function acExact(k) { return AC_TYPE === k; }
function acR22() { return AC_TYPE === 'r22'; }
// 이 기종에 있는 화면인가 — Bell 206 은 CDU(· 비행계획 창) · UPPER CONSOLE · SYSTEM 이 없다(무전 · 항법은 LOWER CONSOLE 의 항공전자 스택)
function acScrOk(k) { return !(acIs('b206') && (k === 'cdu' || k === 'plan' || k === 'ovhd' || k === 'sysp')); }   // SYSTEM(MFD 계통 화면)도 없다
function acInfo() { return AC_TYPES[AC_TYPE]; }
// 기종을 바꾼다 — 적어 두고 다시 불러온다(주소의 ?ac= 는 걷어 낸다 · 그것이 저장값을 이기므로)
function setAircraftType(k, reload = true) {
  if (!AC_TYPES[k]) return false;
  try { localStorage.setItem(AC_PREF, k); } catch (e) { /* 이번만 */ }
  if (reload && k !== AC_TYPE) {
    try {
      const u = new URL(location.href); u.searchParams.delete('ac');
      location.replace(u.toString());
    } catch (e) { location.reload(); }
  }
  return true;
}
try { document.documentElement.classList.add('ac-' + AC_TYPE); if (AC_TYPES[AC_TYPE].family) document.documentElement.classList.add('ac-' + AC_TYPES[AC_TYPE].family); } catch (e) { /* 그만 */ }
