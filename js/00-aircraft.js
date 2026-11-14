'use strict';
// ══════════════════════════════════════════════════════
// 기종(aircraft type) — 시작 화면(비밀번호를 넣은 뒤)에서 기종을 고른다.
//   aw189 : AW189(흰수리) — 기본. 유리 조종석(PFD · MFD 넷 · 쌍발)
//   b206  : Bell 206B-3 JetRanger — 단발 · 아날로그 원형 계기판(25-b206panel.js)
// (SHINE 저장소에서 만들어 가져왔다 — SHINE 은 b206 이 기본)
// 고르는 길: 시작 화면(00-gate.js 기종 버튼) · 주소 ?ac=b206|aw189 · localStorage 'shineAc'.
// 이 파일은 00-edition.js 바로 뒤(index.html <head>)에 읽힌다 — 다른 파일은 acIs('b206') 로 가른다.
// 기종을 바꾸면 다시 불러온다(화면 틀이 기종마다 달라 한 번에 만드는 것이 간단하다).
// ══════════════════════════════════════════════════════
const AC_TYPES = {
  b206:  { name: 'Bell 206B-3', full: 'Bell 206B-3 JetRanger', engines: 1 },
  aw189: { name: 'AW189',       full: 'AW189 (흰수리)',          engines: 2 },
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
function acIs(k) { return AC_TYPE === k; }
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
try { document.documentElement.classList.add('ac-' + AC_TYPE); } catch (e) { /* 그만 */ }
