'use strict';
// ══════════════════════════════════════════════════════
// 판(edition) — 두 저장소가 같은 파일을 함께 쓴다(shinesong 에서 고치고 Flightsimulator 로 그대로 복사).
//   full : 종합 시뮬레이터(shinesong)
//   proc : 절차 훈련(Flightsimulator) — 이제 기능은 모두 종합판과 같다. 다른 것은 시작 비밀번호(00-gate.js)뿐
// 주소에 'flightsimulator'(대소문자 무관)가 들어 있으면 proc. ?edition=proc|full 로 바꿔 볼 수 있다(검사도 이 길을 쓴다).
// 이 파일은 맨 먼저 읽힌다(index.html <head>) — 다른 파일은 SIM_ENABLED 로 판을 가린다.
const APP_EDITION = (() => {
  try {
    const q = new URLSearchParams(location.search).get('edition');
    if (q === 'proc' || q === 'full') return q;
    return /flightsimulator/i.test(location.href) ? 'proc' : 'full';
  } catch (e) { return 'full'; }
})();
const SIM_ENABLED = true;
// 사이클릭 피치 · 롤 잠금 — 두 판 모두 쓰지 않는다(예전 절차 훈련판 전용). 잠그면 자세는 4방향 비퍼 트림 · AFCS 로만.
//   (let — 검사가 잠가 본다 · tests/cases/proccyc.mjs · 잠그면 html.ed-proc 로 GYRO 등을 감춘다)
let CYCLIC_LOCK = false;
try { document.documentElement.classList.toggle('ed-proc', CYCLIC_LOCK); } catch (e) { /* 그만 */ }
