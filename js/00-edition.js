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
const SIM_ENABLED = APP_EDITION === 'full';
try { document.documentElement.classList.toggle('ed-proc', !SIM_ENABLED); } catch (e) { /* 그만 */ }
