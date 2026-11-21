'use strict';
// ══════════════════════════════════════════════════════
// 판(edition) — 두 저장소가 같은 파일을 함께 쓴다(shinesong 에서 고치고 Flightsimulator 로 그대로 복사).
//   full : 종합 시뮬레이터(shinesong) — SIM 모드(조이스틱·화면 조종간으로 직접 조종) · 3D 조종 버튼 · 로터 소리
//   proc : 절차 훈련(Flightsimulator) — SIM 모드를 켤 수 없고 그 버튼들을 감춘다. 나머지는 모두 같다
// 주소에 'flightsimulator'(대소문자 무관)가 들어 있으면 proc. ?edition=proc|full 로 바꿔 볼 수 있다(검사도 이 길을 쓴다).
// 이 파일은 맨 먼저 읽힌다(index.html <head>) — 다른 파일은 SIM_ENABLED 로 판을 가린다.
const APP_EDITION = (() => {
  try {
    const q = new URLSearchParams(location.search).get('edition');
    if (q === 'proc' || q === 'full') return q;
    return /flightsimulator/i.test(location.href) ? 'proc' : 'full';
  } catch (e) { return 'full'; }
})();
// 절차 훈련판도 SIM(조종 비행 모델 · 3D 조작 버튼)은 종합판과 같다 — 다만 사이클릭의 피치 · 롤은 듣지 않는다(CYCLIC_LOCK).
//   자세는 4방향 비퍼 트림(햇 · 컬렉티브/사이클릭 창의 4-WAY BEEP · 키보드)과 AFCS 로 바꾼다. 컬렉티브 · 페달 · COLL TRIM 은 그대로.
const SIM_ENABLED = true;
const CYCLIC_LOCK = APP_EDITION === 'proc';
try { document.documentElement.classList.toggle('ed-proc', APP_EDITION === 'proc'); } catch (e) { /* 그만 */ }
