// ─────────────────────────────────────────────────────────────
// 01-state.js — 앱 상태·공항/기본 DB·스톱워치
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────


// ── 무시되는 예외 집계 ───────────────────────────────────────────
// 종전에는 곳곳에서 `catch(e) {}` 로 예외를 통째로 삼켰다. 그 탓에 clBack 처럼
// 버튼이 조용히 죽어도 흔적이 남지 않아, 사용자가 화면을 보고 신고해야만 알 수 있었다.
// 이제 모든 무시 예외는 여기를 지난다. 평소 동작은 종전과 같고(아무것도 안 함),
// 디버그 모드에서만 콘솔에 남긴다. 최근 200건은 항상 메모리에 보관한다.
//   디버그 켜기: URL 에 ?debug=1 · localhost · localStorage.setItem('debug','1')
//   확인:        _swallowed()          최근 무시 예외 목록
//                _swallowSummary()     메시지별 발생 횟수(반복되는 것이 진짜 문제)
const _SWALLOW_LOG = [];
let _DEBUG = false;
function _swallow(e) {
  try {
    const at = (((e && e.stack) || '').split('\n')[1] || '').trim();
    _SWALLOW_LOG.push({ t: Date.now(), msg: (e && e.message) || String(e), at });
    if (_SWALLOW_LOG.length > 200) _SWALLOW_LOG.shift();
    if (_DEBUG) console.debug('[무시된 예외]', (e && e.message) || e, at);
  } catch (_) { /* 집계 자체가 실패해도 앱 동작에는 영향을 주지 않는다 */ }
}
function _swallowed() { return _SWALLOW_LOG.slice(); }
function _swallowSummary() {
  const c = {};
  _SWALLOW_LOG.forEach(r => { c[r.msg] = (c[r.msg] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
try {
  _DEBUG = /[?&]debug=1/.test(location.search)
        || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        || localStorage.getItem('debug') === '1';
} catch (e) { _swallow(e); }
// ══════════════════════════════════════════════════════
// DATABASE
// ══════════════════════════════════════════════════════
// 공항 목록은 AIRPORTS_KR 단일 소스에서 파생한다(정의는 AIRPORTS_KR 직후).

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════
const S = {
  lat: 37.3895, lon: 126.6550,
  hdg: 360,
  spd: 80,    // knots  (AFCS default 80 kt)
  alt: 500,   // feet   (AFCS default 500 ft)
  pit: 0,     // pitch  — auto-derived from speed: (120−spd)×3/20
  bnk: 0,     // bank   — driven by HDG button; returns to 0 on release
  tq: 60,     // torque(%) — SIM 모드의 컬렉티브 값. 남는 토크가 상승률이 된다
  crs: 360,
  brg: 0,     // BRG1: bearing to active (TO) WP
  xtk: 0,
  dtw: 0,     // dist to active WP
  wps: [], awp: -1, fwp: -1,
  // Direct To 로 잡은 구간인가 — 참이면 코스를 '현재 위치 → 활성 WP' 로
  // 매 프레임 다시 잡는다. 구간(leg)을 따라가거나 코스를 손으로 정하면 꺼진다.
  dtoLive: false,
  running: false, lastT: null, trail: [],
  vs: 0,   // vertical speed ft/min
};

// bankTarget: goal bank angle; smoothed each frame
let bankTarget = 0;
// 배속(1·2·4·8) — 시뮬 시간이 실시간의 몇 배로 흐르는가. 계산 자체는 그대로다.
let simSpeed = 1;
let _simLoopRunning = false;  // guard against double-starting the rAF loop

// ── AFCS Preselects ──
let selSpd  = 80;   // IAS preselect (kt)
let selAlt  = 500;  // ALT preselect (ft) — target for ALT hold mode
let selHht = 50;   // HHT — T/D to H 가 내려가 멈출 호버 높이(전파고도 ft · FCP HHT ▲▼)
let selCrht = 500;  // CRHT preselect (ft) — target for CRHT hold mode
let selHdg  = 360;  // HDG preselect (°, 1-360)
// ── HDG SEL: 선택 헤딩으로 표준선회(360°/2분 = 3°/s)로 선회 ──
// 뱅크각은 속도의 16% (표준선회 근사). 실제 선회율은 비행모델의 조정선회식
// turnRate = g·tan(bank)/V 로 산출되므로 속도에 따라 자동으로 3°/s 부근이 된다.
let hdgSelOn = false;              // HDG SEL(선회) 모드 인게이지
// HDG 선회 방향 래치 — 한 번 돌기 시작하면(+1 오른쪽 · −1 왼쪽) 반대쪽이 더 가까워져도 같은 쪽으로 계속 돈다.
// HDG 마킹(selHdg)을 도는 반대쪽으로 돌리면 풀려 다시 가까운 쪽을 고른다 · 맞추면(포착) 풀린다. 0 = 없음
let hdgTurnDir = 0;
// 조종사가 AFCS 를 손댄 때(ms) — 이 직후(0.6초 안)에 풀린 모드는 스스로 푼 것(경보 없음 · 03-pfd.js 모드 풀림 경보)
let _pilotInT = -1e9;
function afcsCmd() { _pilotInT = performance.now(); }
// AFCS가 뱅크를 지령할 때의 롤 프로파일 — 각가속도를 제한해 롤인/롤아웃이 부드럽게
// (즉시 뱅크가 서지 않고, 목표 뱅크에 오버슛 없이 사그라들며 들어간다)
let _rollRate = 0;                 // 현재 롤 각속도(°/s)
const ROLL_RATE_MAX = 6;           // AFCS 최대 롤율(°/s)
const ROLL_ACC_MAX  = 8;           // AFCS 롤 각가속도(°/s²)
const HDG_ROLLOUT_DEG = 6;         // 남은 각도가 이 이하면 뱅크를 비례 감소(롤아웃)
function stdRateBank(spd) {        // 표준선회 뱅크각(°) — 속도의 16%, 최대 30°
  return Math.max(2, Math.min(30, Math.abs(spd) * 0.16));
}
// ── 방향 기준(MAS): MG(Slaved) / DG ──
// MG — 방향 자이로를 지구 자기장(플럭스 밸브)에 늘 맞춘다: 계기 헤딩 = 실제 기수.
// DG — 자이로만으로 방향을 정한다: 지구 자전 등으로 1시간에 약 6° 씩 어긋나므로
//      조종사가 −/+ 로 1° 씩 맞춘다(자기 나침반과 견주어).
// HSI·HDG 표시·HDG 유지는 계기 헤딩(hdgInd)을 쓰고, 지도·3D·GPS 항법(NAV)은 실제 기수를 쓴다.
// 그래서 DG 오차가 있으면 HDG 로 나는 동안 실제 기수가 그만큼 비껴 간다.
const DG_DRIFT = 6;      // DG 편류(°/h) — 북반구 지구 자전처럼 계기 헤딩이 줄어드는 쪽
let hdgRef = 'MG';       // 'MG' | 'DG'
let dgErr  = 0;          // 계기 헤딩 − 실제 기수(°, MG 이면 0)
function hdgInd() { return normA(S.hdg + dgErr); }
// 리셋·GPS·나침반·FDR 리플레이처럼 기수를 외부에서 직접 바꾸는 경로에서 호출한다.
// 동기화하지 않으면 시뮬레이션으로 돌아오는 순간 AFCS가 옛 HDG bug로 선회해 버린다.
// HDG bug 는 HSI 카드 위에 있으므로 계기 헤딩에 맞춘다.
function syncHdgBug() { selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; }
let selVS   = 1000; // VS preselect (fpm, magnitude) — used by ALT hold mode
                    // CRHT hold mode ignores this and always converges at 500 fpm
let spdTrend = 0;   // 6-second speed trend (knots, smoothed)
let _spdPrev = 80;  // previous-frame IAS for trend computation
// 내활·외활 볼(slip/skid) — 기체가 느끼는 옆 방향 힘(g, 오른쪽 +). 07-sim.js slipUpdate
let slipBall = 0;
let _slipHdg = null;   // 직전 단계의 기수(요율을 재는 데 쓴다)
let _hdgJump = 0;      // 기체가 돈 것이 아닌 기수 맞춤(HDG 포착 순간 등) — 요율에서 뺀다

// ── AFCS Altitude Hold Modes ──
// altHoldOn : converges S.alt → selAlt  at selVS fpm (pilot-set rate)
// crhtOn    : converges RA(AGL) → selCrht at  500 fpm   (fixed, mutually exclusive with altHoldOn)
// Default: ALT hold engaged on startup, holding the initial 500 ft.
let altHoldOn = true;

// BRG needle visibility
let brg1Visible = true;
let brg2Visible = true;

// 지도에 BRG 를 그릴지(선 + 방위·거리 이름표) — 기본은 끔.
// BRG1·BRG2 버튼은 계기의 니들, 이 토글(#1BDP·#2BDP)은 지도 시현이다.
// 지도에 늘 선과 글자가 붙어 있으면 지형·항로를 가린다.
let brg1LblOn = false, brg2LblOn = false;
function toggleBrg1Lbl() {
  brg1LblOn = !brg1LblOn;
  const btn = document.getElementById('brg1-bdp');
  if (btn) btn.classList.toggle('brg1-on', brg1LblOn);
  if (typeof updateBrgLines === 'function') updateBrgLines();
}
function toggleBrg2Lbl() {
  brg2LblOn = !brg2LblOn;
  const btn = document.getElementById('brg2-bdp');
  if (btn) btn.classList.toggle('brg2-on', brg2LblOn);
  if (typeof updateBrgLines === 'function') updateBrgLines();
}
// ── G/S (글라이드 패스 추종) ──────────────────────────────────────
// 무장(armed)해 두면 강하선에 닿는 순간 스스로 붙잡아(captured) 고도를 맡는다.
// 실제 오토파일럿과 같은 순서다 — 아래에서 접근하다 강하선을 만나면 잡는다.
// 잡고 나면 ALT·CRHT 유지는 물러난다(고도를 두 곳에서 몰면 싸운다).
let gsArmed = false, gsOn = false;
function gsAvailable() { return !!gsDeviation(); }
function updateGsBtn() {
  const b = document.getElementById('gs-btn');
  if (!b) return;
  b.classList.toggle('on', gsOn);
  b.classList.toggle('armed', gsArmed && !gsOn);
  const want = gsOn ? 'G/S<span class="gs-sub">CAPT</span>'
             : gsArmed ? 'G/S<span class="gs-sub">ARM</span>' : 'G/S';
  if (b.innerHTML !== want) b.innerHTML = want;
}
// SIM 모드(조종간 직접 조종) — 법칙은 14-simmode.js. 선언만 여기 둔다:
// 시뮬 루프(07-sim.js)가 그 파일보다 먼저 실행될 수 있어 TDZ 를 피한다.
let simModeOn = false;
// NR 경고 — 자동회전 비행 RPM 수정표의 띠: 녹 88~110 · 황 84~88/110~114 · 적 84 미만/114 초과(PFD 엔진 계기 · 14-simmode.js)
const NR_HIGH = 110, NR_HIGH_RED = 114, NR_LOW_YEL = 88, NR_LOW_RED = 84;
// SIM 모드의 IAS 상위모드 — 걸면 기수 자세를 선택 속도(selSpd)를 내는 자세로 잡는다
// (14-simmode.js). 평소(SIM 밖)에는 속도가 늘 IAS 로 나므로 쓰지 않는다.
let simIasOn = false;
// SIM 모드의 옆방향 속도(kt · 오른쪽이 +). 저속에서 뱅크를 주면 선회 대신
// 옆으로 미끄러지는 헬기 특성을 담는다(14-simmode.js 가 채운다).
let simLat = 0;

// ── 토크(TQ) ──
// 헬기의 컬렉티브는 '상승률 레버' 가 아니라 '출력 레버' 다. 올린 만큼 토크가
// 오르고, 그 토크가 지금 필요한 만큼보다 남으면 그 차이가 상승률이 된다.
// 그래서 같은 레버 위치라도 뱅크를 주거나 속도가 바뀌면 오르내림이 달라진다.
const TQ_HOVER   = 60;         // 무풍·수평·제자리에서 필요한 토크(%)
const TQ_SPAN    = 45;         // 컬렉티브 끝까지 = ±45%
const TQ_MAX     = 140;        // 계기 최대 눈금 = 컬렉티브 맨 위
// 계기 구간 — 0~100% 녹색(연속 사용) · 100~113% 노랑(주의) · 113~140% 빨강(오버토크)
const TQ_LIMIT   = 100;        // 연속 사용 한계 — 여기까지 녹색
const TQ_RED     = 113;        // 이 위는 빨강 — 오버토크
const TQ_RATE    = 2000;        // 토크가 따라가는 최대 빠르기(%/s) — 종전 60 의 2배
const TQ_PER_FPM = 55;         // 남는 토크 1% 당 상승률(fpm)
// ── 필요 동력 곡선(U 자) ── 호버 동력 H 를 유도(induced) 몫과 그 밖(형상·꼬리로터·보기)으로 나눈다.
//   유도 몫  = H·PW_IND · (vi/vi0) · n²   — 운동량 이론: 앞으로 날수록 내리흐름이 줄어 덜 든다(ETL).
//                                            선회(하중배수 n = 1/cosφ)에는 추력² 로 는다.
//   그 밖    = H·(1−PW_IND) · n
//   유해 항력 = PW_PAR · V³               — 빨라질수록 세제곱으로 는다(최대 수평속도는 그날의 MTA 가 정한다)
// 기준(H 77%)에서 호버 77% → 70kt 최소 약 48%(호버의 0.62) → 150kt 약 95% → 160kt 약 108%.
const PW_IND  = 0.70;          // 호버 동력 가운데 유도 동력 몫
const PW_VI0  = 25;            // 호버 유도속도(kt, H 77% 기준 — 무게가 늘면 √ 로 는다)
const PW_PAR  = 1.874e-5;      // 유해 동력(% / kt³)
// ── Bell 206B-3 성능(단발 · 토크 눈금 100% = 변속기 이륙 한계 · 85% = 연속 한계) ──
// 총중량 3,000lb 표준대기 해면 기준. 호버 IGE 72% · OGE 82% · Vy 52kt · 85% 로 약 115kt · 130kt(VNE) 에 약 100%.
// 남는 토크 1% 당 상승률 24fpm(Vy 에서 100% 로 약 1,300fpm) · 오토로테이션 강하는 흰수리와 같은 셈(38fpm/%).
// 밀도고도 6,000ft 까지는 변속기 한계(100%)로 평평하고, 그 위는 엔진 출력이 1,000ft 마다 3.5% 준다.
// 09-cdu.js 의 PERF 접근자(perfHoverTq · perfMta · perfVy · perfTqForVs …)가 이 값을 쓴다 — 흰수리 성능표는 그대로.
const B206P = { wt: 3000, hovIge: 72, hovOge: 82, vy: 52, vi0: 14, par: 3.51e-5, fpmUp: 24, fpmDn: 38,
                vne: 130, vneAlt: 3000, vnePerKft: 3.5, mtaMax: 100, mtaFlatDa: 6000, mtaPerKft: 3.5, tqCont: 85 };
function acB206() { return typeof acIs === 'function' && acIs('b206'); }
// 밀도고도(ft) — 고도 · 그 고도의 기온(°C)
function densityAltFt(altFt, oatC) { return altFt + 120 * (oatC - (15 - 2 * altFt / 1000)); }
const PW_ETL0 = 12, PW_ETL1 = 24;   // 회전익 특성 '속도·TQ 효율' — 이 사이(전이양력 지대)에서 유도 동력이 한꺼번에 준다

// ── 제자리 호버에 필요한 토크 ──
// CDU 의 PERF 화면이 고도·온도·중량으로 뽑아 주는 바로 그 값을 쓴다.
// HOV(호버 파워) = PERF 의 IGE 호버 토크 — 바퀴 높이 10ft 에서 제자리에 서는 토크다.
// 땅에 가까울수록 지면효과로 덜 든다(바퀴 높이 기준):
//   3ft 이하 : HOV − 10%  — 이 토크면 바퀴가 떨어져 3ft 에 선다(그보다 적으면 바퀴가 땅에)
//   5ft      : HOV − 5%
//   10ft     : HOV
//   10→53ft  : HOV → OGE — 로터 지름 즈음(≈53ft) 위는 지면효과가 없다
// 그래서 레버를 HOV−10% 에 두면 3ft, HOV−5% 면 5ft, HOV 면 10ft 에서 호버링한다.
// HOV−20% ~ HOV−10% 는 바퀴가 떨어지기 직전(LIGHT ON WHEELS)이다(simLightOnWheels).
const IGE_FULL_FT = 10, IGE_NONE_FT = 53;
// [바퀴 높이 ft, HOV 와의 차 %] — 땅(0ft)은 HOV−10 보다 조금 낮게 두어, HOV−10% 면 확실히
// 바퀴가 떨어져 몇 초 안에 3ft 까지 오른다(같게 두면 땅에서 꼭 맞아 뜨지 않는다)
const IGE_CURVE = [[0, -12], [3, -10], [5, -5], [10, 0]];
const LOW_BAND  = [-20, -10];                      // LIGHT ON WHEELS 구간(HOV 와의 차 %)
// HOV(호버 파워, %) — 바퀴 높이 10ft 의 IGE 호버 토크
function hoverPowerTq() {
  let p = null;
  try { p = (typeof perfHoverTq === 'function') ? perfHoverTq() : null; } catch (e) { _swallow(e); }
  if (!p || !Number.isFinite(p.oge)) return TQ_HOVER;
  return Number.isFinite(p.ige) ? p.ige : p.oge;
}
function hoverTqRef() {
  let p = null;
  try { p = (typeof perfHoverTq === 'function') ? perfHoverTq() : null; } catch (e) { _swallow(e); }
  if (!p || !Number.isFinite(p.oge)) return TQ_HOVER;          // PERF 를 못 읽으면 종전 값
  const ige = Number.isFinite(p.ige) ? p.ige : p.oge;
  let agl = 1000;
  // 지면효과는 발밑 바닥에서 잰다(함정 위에서는 갑판 — simDeckFt)
  try {
    const g = (typeof simTerrainFt === 'function') ? simTerrainFt() : 0;
    const d = (typeof simDeckFt === 'function') ? simDeckFt() : null;
    agl = S.alt - (d == null ? g : Math.max(g, d));
  }
  catch (e) { agl = S.alt; }
  if (agl < IGE_FULL_FT) {                                     // 지면효과 — 낮을수록 덜 든다
    const c = IGE_CURVE;
    if (agl <= c[0][0]) return ige + c[0][1];
    for (let i = 1; i < c.length; i++) {
      if (agl <= c[i][0]) {
        const f = (agl - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
        return ige + c[i - 1][1] + (c[i][1] - c[i - 1][1]) * f;
      }
    }
  }
  const k = Math.max(0, Math.min(1, (agl - IGE_FULL_FT) / (IGE_NONE_FT - IGE_FULL_FT)));
  return ige + (p.oge - ige) * k;                              // IGE → OGE
}

// 지금 '수평 비행' 에 필요한 토크(%)
// (SIM 은 대기속도 — 옆걸음과 바람까지 담는다. simAirspeed · 14-simmode.js)
function tqRequired() { return tqRequiredAt((simModeOn && typeof simAirspeed === 'function') ? simAirspeed() : S.spd, S.bnk); }
// 운동량 이론의 유도속도 비(vi/vi0) — 전진 속도 V(kt), 호버 유도속도 vi0(kt)
function pwViRatio(V, vi0) { const v = V / vi0; return Math.sqrt(Math.sqrt(v ** 4 / 4 + 1) - v * v / 2); }
// 그 '대기속도'·뱅크로 수평 비행할 때 필요한 토크(%) — 계기의 Vy 선도 이것으로 긋는다
function tqRequiredAt(spd, bnk) {
  const H = hoverTqRef(), V = Math.abs(spd);
  const n = 1 / Math.cos(Math.min(60, Math.abs(bnk)) * D2R);
  const b2 = acB206();
  let r = b2 ? pwViRatio(V, B206P.vi0 * Math.sqrt(Math.max(0.3, H / B206P.hovOge)))
             : pwViRatio(V, PW_VI0 * Math.sqrt(Math.max(0.3, H / 77)));
  // 회전익 특성 '속도·TQ 효율' — 전이양력(ETL)은 12~24kt 에서 한꺼번에 나타난다(그 아래는 호버와 같다)
  if ((typeof rcOn === 'function') && simModeOn && rcOn('spdTq'))
    r = 1 + (r - 1) * Math.max(0, Math.min(1, (V - PW_ETL0) / (PW_ETL1 - PW_ETL0)));
  return H * (PW_IND * r * n * n + (1 - PW_IND) * n) + (b2 ? B206P.par : PW_PAR) * V * V * V;
}
// 그날의 MTA(최대 가용 토크, %) — CDU PERF 의 MTA(30)(09-cdu.js perfMta).
// PERF 의 고도·온도를 기준으로 지금 고도에서 셈한다. PERF 를 못 읽으면 계기 끝.
// 블리드 공기를 쓰는 장치가 켜지면 가용 토크(MTA)가 준다 — 상부 콘솔(17-upper.js)
//   ECS HEATER(모드 노브 HEAT) — #1 · #2 엔진 모두 4% 씩 → 계기 MTA −4%
//   ENG ANTI ICE NO1/NO2 — 켠 엔진마다 그 엔진에서 14% → 둘 다 켜면 −14%, 하나면 −7%(두 엔진 평균)
const MTA_HEAT_PCT = 4, MTA_ENG_AI_PCT = 14;
function mtaBleedPenalty() {
  let p = 0;
  try {
    if (typeof ovhdGet !== 'function') return 0;
    if (ovhdGet('ecsMode') === 'HEAT') p += MTA_HEAT_PCT;
    const ai = (ovhdGet('engAi1') === 'ON' ? 1 : 0) + (ovhdGet('engAi2') === 'ON' ? 1 : 0);
    p += MTA_ENG_AI_PCT * ai / 2;
  } catch (e) { _swallow(e); }
  return p;
}
function mtaNow(altFt = S.alt) {
  let v = null;
  try { v = (typeof perfMta === 'function') ? perfMta(altFt) : null; } catch (e) { _swallow(e); }
  const base = Number.isFinite(v) ? Math.min(TQ_MAX, v) : TQ_MAX;
  return Math.max(0, base - mtaBleedPenalty());
}
// Vy 로 수평 비행할 때 필요한 토크(%) — 이 선과 MTA 선 사이가 그날 오를 수 있는 여유다
function tqAtVy() {
  let vy = null;
  try { vy = (typeof perfVy === 'function') ? perfVy() : null; } catch (e) { _swallow(e); }
  return Number.isFinite(vy) ? tqRequiredAt(vy, 0) : null;
}
// 계기에 보일 토크. SIM 모드에서는 실제 레버 값, 평소에는 지금 비행 상태에서
// 들 법한 값을 거꾸로 셈해 보여 준다(계기가 비어 보이지 않게).
function tqShown() {
  if (simModeOn) return S.tq;
  let add = (S.vs || 0) / TQ_PER_FPM;
  try { if (typeof perfTqForVs === 'function') add = perfTqForVs(S.vs || 0); } catch (e) { _swallow(e); }
  return Math.max(0, Math.min(TQ_MAX, tqRequired() + add));
}
// 계기 한계 — 흰수리 100(연속) · 113(빨강), Bell 206 85(연속) · 100(빨강)
function tqLimitCont() { return acB206() ? B206P.tqCont : TQ_LIMIT; }
function tqLimitRed()  { return acB206() ? B206P.mtaMax : TQ_RED; }
function tqOver() { return tqShown() > tqLimitRed(); }
// 지금 토크가 든 구간 — 'green' · 'yellow' · 'red'
function tqBand(v = tqShown()) { return v > tqLimitRed() ? 'red' : v > tqLimitCont() ? 'yellow' : 'green'; }

function toggleGs() {
  if (gsArmed || gsOn) { gsArmed = false; gsOn = false; gsAutoLatch(); }
  else {
    gsArmed = true; _gsLatch = false;
    // 이미 강하선 위에 있으면 곧바로 잡는다
    const g = gsDeviation();
    if (g && Math.abs(g.dev) < 0.15) { gsOn = true; gsArmed = false; }
  }
  updateGsBtn();
}
// ── G/S 자동 ── G/S 버튼은 없다. ILS(강하선이 있는 LOC)를 지금 NAV 소스로 맞추면 스스로 무장하고,
// 강하각에 맞는 순간(편차 0.15° 안) 붙잡는다. 조종사가 ALT·CRHT·T/D to H·G/A 를 걸어 놓으면
// 그 강하선에서 벗어날 때(편차 0.3° 밖)까지 다시 잡지 않는다 — 놓자마자 도로 붙잡지 않게.
let _gsLatch = false;
function gsAutoLatch() { _gsLatch = true; }
// 매 프레임 — 무장 상태에서 강하선에 닿았는지 본다.
// 위에서 내려오다 만나는 경우가 대부분이므로 '편차가 0 에 가까워졌을 때' 잡는다.
function gsCaptureCheck() {
  const g = gsDeviation();
  if (gsOn) {
    // 신호를 잃으면(멀어짐·안테나 뒤로 지나감) 놓는다 · 조종사가 다른 고도 모드를 걸면 물러난다
    if (!g) { gsOn = false; updateGsBtn(); }
    else if (altHoldOn || crhtOn || (typeof tdOn !== 'undefined' && tdOn) || (typeof gaOn !== 'undefined' && gaOn)) {
      gsOn = false; gsAutoLatch(); updateGsBtn();
    }
    return;
  }
  // 자동 무장 — ILS 를 맞춰 강하선 신호가 들어오면
  if (!g) { if (gsArmed) { gsArmed = false; updateGsBtn(); } _gsLatch = false; return; }
  if (_gsLatch) { if (Math.abs(g.dev) > 0.3) _gsLatch = false; else return; }
  if (!gsArmed) { gsArmed = true; updateGsBtn(); }
  if (Math.abs(g.dev) < 0.15) {
    // 아래로 내려가는 G/A·T/D to H 중에는 잡지 않는다(조종사가 고른 길이 우선)
    if ((typeof gaOn !== 'undefined' && gaOn) || (typeof tdOn !== 'undefined' && tdOn)) return;
    gsOn = true; gsArmed = false;
    if (altHoldOn || crhtOn) { altHoldOn = false; crhtOn = false; try { updateHoverBtns(); } catch (e) { _swallow(e); } }
    try { if (typeof vsModeOn !== 'undefined') vsModeOn = false; } catch (e) { _swallow(e); }
    updateGsBtn();
  }
}

// ── SUSP (시퀀싱 보류) ────────────────────────────────────────────
// 켜져 있으면 활성 웨이포인트를 지나도 다음으로 넘어가지 않고, 그 구간의
// 코스를 계속 따라간다. 마지막 지점이어도 NAV 가 풀리지 않는다.
// 홀딩이 걸려 있으면 저절로 켜진 것으로 본다(홀딩 자체가 그 자리를 도는 일이다).
// 실제 FMS 의 SUSP 와 같은 뜻이다 — 홀딩·미스드어프로치에서 켜지고, 조종사가
// 눌러서 풀면 다음 절차로 넘어간다.
let suspOn = false;
function navSuspAuto() { return !!(typeof holdOn !== 'undefined' && holdOn); }
function navSuspended() { return suspOn || navSuspAuto(); }
// PFD 소프트키의 OBS 칸이 SUSP 로 바뀌는 때 — 다음 지점으로 넘어갈지 정해야 하는 자리(FCP 의 SUSP 버튼은 없앴다)
//   · 이미 보류 중(손으로 켬 · 홀딩으로 저절로)
//   · NAV(FMS)로 날며 활성 지점에 홀딩이 걸려 있다(홀딩 · 오비트처럼 그 자리를 돌 곳)
//   · NAV(FMS)로 날며 활성 지점이 비행계획의 마지막 — 계기접근 끝(MAPt)에서 미스드어프로치로 이어 갈지
function suspSoftkey() {
  if (navSuspended()) return true;
  if (!navApOn || navSrc !== 'FMS' || obsOn) return false;
  const wp = (S.awp >= 0 && S.awp < S.wps.length) ? S.wps[S.awp] : null;
  if (!wp) return false;
  return !!wp.hold || S.awp === S.wps.length - 1;
}
function updateSuspBtn() {
  try { if (typeof pfdSkRender === 'function') pfdSkRender(); } catch (e) { _swallow(e); }
  const b = document.getElementById('susp-btn');
  if (!b) return;
  const auto = navSuspAuto() && !suspOn;
  b.classList.toggle('auto', auto);
  b.classList.toggle('on', suspOn);
  // 글자는 늘 'On' — 켜졌는지는 AP 의 NAV 버튼처럼 색으로 보인다(녹색).
  // 저절로 걸린 경우에만 '자동' 을 덧붙인다.
  const want = auto ? 'On<span class="susp-auto">자동</span>' : 'On';
  if (b.innerHTML !== want) b.innerHTML = want;
}
function toggleSusp() {
  const wasHold = navSuspAuto();
  if (wasHold) {
    // 홀딩으로 저절로 걸린 상태에서 누르면 '그만하고 다음으로' 다.
    // 그 지점을 기억해 두지 않으면 매 프레임 다시 홀딩이 걸린다.
    if (S.awp >= 0 && S.awp < S.wps.length) _holdDoneWp = S.wps[S.awp];
    try { holdExit(); } catch(e) { _swallow(e); }
    suspOn = false;
  } else {
    suspOn = !suspOn;
  }
  // 풀고 나면 다음 지점으로 넘긴다.
  // 시퀀싱은 '지점에 다가갈 때' 일어나므로, 홀딩 패턴 안이나 지나친 자리에서는
  // 저절로 넘어가지 않는다 — 그대로 두면 옛 코스를 따라 하염없이 멀어진다.
  //   · 홀딩을 그만둔 경우: 그 픽스는 이미 볼일이 끝났으니 곧장 다음 지점으로.
  //   · 손으로 걸어 둔 경우: 아직 지점 앞이면 그대로 두고, 지나쳤을 때만 넘긴다.
  if (!navSuspended() && S.awp >= 0 && S.awp + 1 < S.wps.length) {
    let go = wasHold;
    if (!go) {
      const wp = S.wps[S.awp];
      go = Math.abs(normAS(bearing(S.lat, S.lon, wp.lat, wp.lon) - S.hdg)) > 90;
    }
    if (go) { try { selectWP(S.awp + 1); } catch(e) { _swallow(e); } }
  }
  updateSuspBtn();
  try { updateNav(); } catch(e) { _swallow(e); }
}

// ── BRG 바늘의 국(소프트키 PFD Settings → Bearing1 · Bearing2) ── OFF → NAV1 → NAV2 → FMS
// null 이면 처음 그대로(BRG1 은 튜닝된 VOR/ILS 를 스스로, BRG2 는 FMS 활성 지점)
let brg1Src = null, brg2Src = null;
function brgTarget(n) {
  if (!(n === 1 ? brg1Visible : brg2Visible)) return null;
  const src = (n === 1 ? brg1Src : brg2Src) || (n === 1 ? 'AUTO' : 'FMS');
  if (src === 'AUTO') return brg1Station();
  if (src === 'FMS') {
    const wp = (S.awp >= 0 && S.awp < S.wps.length) ? S.wps[S.awp] : null;
    return wp ? { lat: wp.lat, lon: wp.lon, id: wp.ident, src: 'FMS', elev: 0 } : null;
  }
  const r = navRadios[src];
  return (r && r.lat != null && r.lon != null) ? { lat: r.lat, lon: r.lon, id: r.id, src, elev: r.elev || 0 } : null;
}
function brgSrcLabel(n) {
  if (!(n === 1 ? brg1Visible : brg2Visible)) return 'OFF';
  const src = n === 1 ? brg1Src : brg2Src;
  if (src) return src;
  if (n === 2) return 'FMS';
  const st = brg1Station(); return st ? st.src : 'NAV1';
}
function brgSrcCycle(n) {
  const order = ['OFF', 'NAV1', 'NAV2', 'FMS'];
  const next = order[(order.indexOf(brgSrcLabel(n)) + 1) % order.length];
  const vis = next !== 'OFF';
  // 지도 BRG 선·방위·거리(옛 #1BDP · #2BDP)도 소프트키로 고른 국을 따른다 — 처음(고르기 전)은 지도에 없음, OFF 면 없음
  if (n === 1) { brg1Src = vis ? next : brg1Src; brg1LblOn = vis; if (brg1Visible !== vis) toggleBrg1(); }
  else { brg2Src = vis ? next : brg2Src; brg2LblOn = vis; if (brg2Visible !== vis) toggleBrg2(); }
  if (typeof updateBrgLines === 'function') updateBrgLines();
  try { drawPFD(); } catch (e) { _swallow(e); }
}
function toggleBrg1() {
  brg1Visible = !brg1Visible;
  const btn = document.getElementById('brg1-tog');   // FCP 버튼은 없앴다(소프트키 Bearing1) — 있으면만
  if (btn) btn.classList.toggle('brg1-on', brg1Visible);
  if (typeof updateBrgLines === 'function') updateBrgLines();   // 지도 BRG 라인 즉시 반영
}
function toggleBrg2() {
  brg2Visible = !brg2Visible;
  const btn = document.getElementById('brg2-tog');
  if (btn) btn.classList.toggle('brg2-on', brg2Visible);
  if (typeof updateBrgLines === 'function') updateBrgLines();
}

// ── Hover Page / GSPD mode ──
// Helicopter-style hover/low-speed mode. Hover Page restyles the HSI;
// GSPD enables a body-frame ground-speed controller that converges
// actual lateral/forward GPS speed toward the reference at 80/15 kt/s.
let hoverPageOn = false;
let gspdOn      = false;
let crhtOn      = false;   // Cruise Hold Trim — 4th axis engagement flag (shown on FMA)
// Coast state: body-frame motion is preserved after disengage when the
// velocity has components the base motion model can't represent (any
// lateral, or aft / negative forward). Convergence is off; body
// velocity stays constant until the next engagement.
let gspdCoasting = false;
// Body-frame ground speeds (kt). lat: + = right of nose, - = left.
// fwd: + = forward, - = aft.
let gspdActLat = 0, gspdActFwd = 0;
// References (null = "--" display before GSPD engaged)
let gspdRefLat = null, gspdRefFwd = null;
const GSPD_RATE = 80 / 15; // kt/sec — 80kt → 0 in 15s at high speed
// Speed-dependent slew rate so the last few kt arrive smoothly at ~1 kt/sec.
// |actual| ≤ 5 → 1 kt/s; |actual| ≥ 15 → GSPD_RATE; linear in between.
const GSPD_RATE_SLOW = 1.0;
const GSPD_BAND_SLOW = 5;
const GSPD_BAND_FAST = 15;
function gspdSlewRate(actual) {
  const a = Math.abs(actual);
  if (a <= GSPD_BAND_SLOW) return GSPD_RATE_SLOW;
  if (a >= GSPD_BAND_FAST) return GSPD_RATE;
  return GSPD_RATE_SLOW + (a - GSPD_BAND_SLOW) / (GSPD_BAND_FAST - GSPD_BAND_SLOW) * (GSPD_RATE - GSPD_RATE_SLOW);
}
// Reference speed limits (kt)
const REF_LAT_MAX =  20;   // ±20 lateral
const REF_FWD_MAX =  50;   // +50 forward
const REF_FWD_MIN = -10;   // -10 aft
const clampLat = v => Math.max(-REF_LAT_MAX, Math.min(REF_LAT_MAX, v));
const clampFwd = v => Math.max(REF_FWD_MIN, Math.min(REF_FWD_MAX, v));

function hoverEligible() { return S.spd < 80; }

// GSPD 가 켜지면 뱅크가 기수를 바꾸지 않으므로(요는 ANTI-TORQUE PEDAL 전용)
// NAV·OBS 오토파일럿은 지령을 내려도 기체를 돌리지 못한다. 버튼은 켜진 채
// 두되(GSPD 를 끄면 그대로 이어서 동작) 조향 불가 상태임을 눈에 보이게 한다.
function updateApInhibit() {
  const inh = !!(typeof gspdOn !== 'undefined' && (gspdOn || gspdCoasting));
  [['nav-ap-btn', 'NAV'], ['obs-btn', 'OBS'], ['fks-navd', 'NAVD CPL'], ['icpt-btn', '인터셉트 각도']].forEach(([id, nm]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('ap-inh', inh);
    el.title = inh ? `${nm} — GSPD 작동 중에는 조향되지 않습니다 (요 조작은 ANTI-TORQUE PEDAL)` : '';
  });
}

function updateHoverBtns() {
  const hb  = document.getElementById('hover-btn');
  const gb  = document.getElementById('gspd-btn');
  const cb  = document.getElementById('crht-btn');
  const ahb = document.getElementById('alt-hold-btn');
  // ALT hold button
  if (ahb) ahb.classList.toggle('on', altHoldOn);
  // HOVER PAGE: pressable when below 80kt OR already on (so user can turn off) — FCP 버튼은 없앴고 소프트키 Hover Display 가 따른다
  if (hb) { hb.disabled = !(hoverEligible() || hoverPageOn); hb.classList.toggle('on', hoverPageOn); }
  // GSPD: always enabled (mode-independent of HOVER PAGE)
  if (gb) { gb.disabled = false; gb.classList.toggle('on', gspdOn); }
  updateApInhibit();
  // CRHT: always enabled
  if (cb) cb.classList.toggle('on', crhtOn);
  // Trim cells: always active — F/A adjusts speed in normal flight, L/R applies bank roll
  ['trim-l','trim-r','trim-fwd','trim-aft'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.classList.remove('disabled');
  });
  const ft = document.getElementById('force-trim-btn');
  if (ft) {
    ft.classList.toggle('disabled', !gspdOn);
    ft.classList.toggle('active', gspdOn);
  }
  // GSPD(호버) 중에는 HDG 화살표를 기수와 분리 — 요 조작은 ANTI-TORQUE PEDAL 전용
  ['hdg-dn','hdg-up'].forEach(id => {
    const e = document.getElementById(id);
    if (e) { e.disabled = gspdOn; e.style.opacity = gspdOn ? '0.3' : '1'; }
  });
}

function toggleHoverPage() {
  if (!hoverPageOn && !hoverEligible()) return;
  hoverPageOn = !hoverPageOn;
  if (hoverPageOn) {
    // Seed actuals from controlled body-frame intent (S.spd along heading).
    // Wind drift is intentionally excluded from the Actual readout so that
    // LAT only reflects what GSPD is commanding, not transient wind.
    gspdActLat = 0;
    gspdActFwd = S.spd;
    // Refs default to null only if GSPD isn't currently driving them
    if (!gspdOn) {
      gspdRefLat = null;
      gspdRefFwd = null;
    }
  }
  // Off-branch: keep GSPD state intact (independent modes)
  updateHoverBtns();
}

function toggleGspd() {
  afcsCmd();
  gspdOn = !gspdOn;
  if (gspdOn) {
    // Engage. Seed actuals from controlled body-frame intent (no wind drift)
    // unless we are emerging from a coast — in that case the actuals are
    // already the truth-of-record for body-frame motion. ASE-on engagement
    // snaps the controlled state to (0, S.spd); the GSPD slew loop then
    // decelerates from there to refs=(0,0).
    if (!gspdCoasting) {
      // SIM 모드는 옆걸음도 이어 받는다. GSPD 는 땅에 대한 속도라, 대기속도에서 바람 몫을 뺀다
      const w = (simModeOn && typeof simWindRel === 'function') ? simWindRel(!_simOnGnd) : { fwd: 0, lat: 0 };
      gspdActLat = simModeOn ? simLat - w.lat : 0;
      gspdActFwd = S.spd - w.fwd;
    }
    simIasOn = false;   // SIM 의 IAS 도 기수 자세를 쓰는 모드다 — GSPD 가 넘겨 받는다
    // References default to 0,0; the slew loop will decelerate.
    gspdRefLat = 0;
    gspdRefFwd = 0;
    gspdCoasting = false;
  } else {
    // Disengage. The base model can only represent positive forward TAS.
    // - Pure forward (or zero): hand off cleanly via S.spd.
    // - Any lateral or any aft component: enter coasting. Body-frame
    //   integration keeps running at constant velocity until the next
    //   engagement, so the lateral/aft case decelerates gradually on
    //   re-engage exactly like the forward-only case (which survives a
    //   disengage via the base model).
    if (simModeOn) {
      // SIM 모드는 옆·뒤로 가는 것도 그대로 몬다 — 타력 비행 없이 바로 넘겨 받고,
      // 트림을 지금 속도에 맞춰 둬 조종간을 가운데 두면 그 속도로 계속 난다.
      const w = (typeof simWindRel === 'function') ? simWindRel(!_simOnGnd) : { fwd: 0, lat: 0 };   // 땅 → 대기속도
      S.spd = gspdActFwd + w.fwd; simLat = gspdActLat + w.lat; gspdCoasting = false;
      try { simTrimHoldSpeed(); } catch (e) { _swallow(e); }
    } else if (Math.abs(gspdActLat) > 0.5 || gspdActFwd < 0) {
      gspdCoasting = true;
    } else {
      S.spd = Math.max(0, gspdActFwd);
      gspdCoasting = false;
    }
    S.pit = pitchFromSpd(S.spd);   // 해제 시 속도 기준 자세 복원
    gspdRefLat = null;
    gspdRefFwd = null;
  }
  updateHoverBtns();
  try { updateApInhibit(); } catch(e) { _swallow(e); }
}

function toggleAltHold() {
  afcsCmd();
  altHoldOn = !altHoldOn;
  if (altHoldOn) {
    // ALT 버튼은 '지금 고도를 지킨다' — 누른 순간의 고도가 기준이다.
    // 다른 고도로 가려면(ALT.A) ALT ▲▼ 로 기준을 옮긴다(07-sim.js applyDelta 'alt').
    selAlt = Math.round(S.alt);
    crhtOn = false;  // mutually exclusive
    try { gaOn = false; vsModeOn = false; tdOn = false; updateGaBtn(); } catch (e) { /* 14-simmode 앞 */ }   // ALT 가 컬렉티브를 가져간다
  } else if (!simModeOn) {
    S.vs = 0;  // prevent unintended climb/descent after disengagement
    // (SIM 모드에서는 그 상승률에서 컬렉티브가 이어 받는다 — 계기가 튀지 않게)
  }
  updateHoverBtns();
}

function toggleCrht() {
  afcsCmd();
  crhtOn = !crhtOn;
  if (crhtOn) {
    // Engage CRHT mode and snap the target to the current RADAR altitude (AGL).
    // From here the pilot can trim selCrht in 10 ft steps via the
    // CRHT +/- buttons; convergence runs at the fixed 500 fpm rate.
    // CRHT 는 전파고도(지면 위 높이 — 05-gps.js radarAltFt)를 지킨다.
    selCrht   = Math.round(radarAltFt());
    altHoldOn = false;
    try { gaOn = false; vsModeOn = false; tdOn = false; updateGaBtn(); } catch (e) { /* 14-simmode 앞 */ }
  } else if (!simModeOn) {
    S.vs = 0;  // prevent unintended climb/descent after disengagement
  }
  updateHoverBtns();
}

function gspdTrim(dir) {
  if (!gspdOn) return;
  if (dir === 'L' || dir === 'R') {
    if (Math.abs(gspdActLat) > 0.5) {
      // Capture actual to ref (clamped to limit, e.g. actual=25 → ref=20)
      gspdRefLat = clampLat(Math.round(gspdActLat));
    } else {
      gspdRefLat = clampLat((gspdRefLat || 0) + (dir === 'R' ? 1 : -1));
    }
  } else if (dir === 'F' || dir === 'A') {
    if (Math.abs(gspdActFwd) > 0.5) {
      gspdRefFwd = clampFwd(Math.round(gspdActFwd));
    } else {
      gspdRefFwd = clampFwd((gspdRefFwd || 0) + (dir === 'F' ? 1 : -1));
    }
  }
}

// Pure nudge (no capture), used while a trim button is held — adds 1 kt/sec in dir.
function gspdTrimNudge(dir) {
  if (!gspdOn) return;
  if (dir === 'L' || dir === 'R') {
    gspdRefLat = clampLat((gspdRefLat || 0) + (dir === 'R' ? 1 : -1));
  } else if (dir === 'F' || dir === 'A') {
    gspdRefFwd = clampFwd((gspdRefFwd || 0) + (dir === 'F' ? 1 : -1));
  }
}

// Hold-to-repeat for trim: GSPD mode keeps existing behavior;
// normal flight (non-GSPD): F/A trims speed, L/R applies bank.
let trimHoldTimer = null, trimHoldInt = null;
let _trimNonGspdDir = null;
let _trimGuard = null;
// 지금 누르고 있는 트림 방향. 같은 방향이 이미 걸려 있으면 다시 걸지 않는다 —
// 햇 한 번이 두 길로 들어오는 일이 있다(장치 프로그램이 햇을 방향키로도
// 내보내는 경우 등). 그러면 1° 가 두 번 들어가 2° 가 되고, 뒤에 들어온 쪽이
// 앞쪽의 반복 타이머를 끊어 누르고 있어도 이어지지 않았다.
let _trimDir = null;
// SIM 모드 자세 트림의 리듬 — 딸깍 한 번이 한 칸(뱅크 1° · 피치 0.5°), 0.5초 넘게
// 누르고 있으면 그때부터 0.1초마다 한 칸씩 이어 간다. 홀드 문턱을 넉넉히 두어
// 조금 길게 누른 딸깍이 두 칸으로 넘어가지 않게 한다.
const SIM_TRIM_HOLD_MS = 500;
const SIM_TRIM_REP_MS  = 100;
// HDG 상위모드가 걸려 있으면 좌우 트림은 모드를 풀지 않고 HDG 기준(selHdg)을 1° 씩
// 옮긴다 — FCP HDG 노브를 돌린 것과 같다. NAV·GSPD 가 잡고 있을 때는 해당 없음.
function hdgTrimActive(dir) {
  return (dir === 'L' || dir === 'R') && hdgSelOn && !navApOn && !gspdOn;
}
function hdgTrimNudge(dir) {
  if (!hdgTrimActive(dir)) return;
  applyDelta('hdg', dir === 'R' ? 1 : -1);
}
function startTrimHold(dir) {
  if (_trimDir === dir) return;         // 같은 누름이 겹쳐 들어왔다 — 한 번으로 친다
  stopTrimHold();                       // 중복 시작 방지(이전 홀드가 남아 있으면 정리)
  _trimDir = dir;
  _trimGuard = setTimeout(stopTrimHold, 20000);   // 런어웨이 방지(최대 20초)
  // SIM 모드에서 '둘러보기' 버튼을 누르고 있으면 햇은 트림이 아니라 시선이다
  if (simModeOn && typeof simLookHeld !== 'undefined' && simLookHeld) {
    simLookDir = dir;
    return;
  }
  // HDG 상위모드 — 딸깍 한 번이 1°, 0.5초 넘게 누르면 0.1초마다 1° 씩(SIM·일반 모드 같음)
  if (hdgTrimActive(dir)) {
    hdgTrimNudge(dir);
    trimHoldTimer = setTimeout(() => {
      trimHoldInt = setInterval(() => hdgTrimNudge(dir), SIM_TRIM_REP_MS);
    }, SIM_TRIM_HOLD_MS - SIM_TRIM_REP_MS);
    return;
  }
  // SIM 모드에서는 사이클릭의 '비퍼 트림' 그대로다 — 좌우는 롤 1°, 전후는 피치
  // 0.5° 씩 옮겨 둔다(조종간을 가운데 두어도 그 자세로 날게 된다).
  // GSPD 가 걸려 있으면 SIM 모드라도 아래의 GSPD 기준속도 트림으로 간다.
  if (simModeOn && !gspdOn) {
    // NAV 가 뱅크를 잡고 있으면 버튼으로만 푼다 — 그동안 좌우 트림은 쌓아 두지 않는다.
    // (HDG 는 위에서 기준 헤딩을 옮기고 끝난다. 그 밖에 남은 횡축 모드가 있으면
    //  손으로 넘겨 받는다 — 지금 뱅크를 이어 잡는다.)
    if ((dir === 'L' || dir === 'R') && simAfcsLat()) {
      if (navApOn) return;
      simAfcsLatRelease();
    }
    simTrimNudge(dir);
    trimHoldTimer = setTimeout(() => {
      trimHoldInt = setInterval(() => simTrimNudge(dir, true), SIM_TRIM_REP_MS);
    }, SIM_TRIM_HOLD_MS - SIM_TRIM_REP_MS);
    return;
  }
  if (gspdOn) {
    gspdTrim(dir);
    trimHoldTimer = setTimeout(() => {
      trimHoldInt = setInterval(() => gspdTrimNudge(dir), 1000);
    }, 400);
  } else {
    _trimNonGspdDir = dir;
    if (dir === 'L' || dir === 'R') {
      bankTarget = Math.max(-60, Math.min(60, bankTarget + (dir === 'R' ? 1 : -1)));
      rollApOn = false; hdgSelOn = false;   // 수동 뱅크 → 횡축 모드 해제(HDG 는 위에서 기준만 옮긴다)
    } else {
      const d = dir === 'F' ? 1 : -1;
      applyDelta('spd', d);
      trimHoldTimer = setTimeout(() => {
        trimHoldInt = setInterval(() => applyDelta('spd', d), 80);
      }, 350);
    }
  }
}
function stopTrimHold() {
  try { if (typeof simLookDir !== 'undefined') simLookDir = null; } catch (e) { _swallow(e); }
  if (trimHoldTimer) { clearTimeout(trimHoldTimer); trimHoldTimer = null; }
  if (trimHoldInt)   { clearInterval(trimHoldInt);  trimHoldInt   = null; }
  if (_trimGuard)    { clearTimeout(_trimGuard);    _trimGuard    = null; }
  _trimNonGspdDir = null;
  _trimDir = null;
  try { if (typeof simTrimRelease === 'function') simTrimRelease(); } catch (e) { _swallow(e); }
}

// 화면의 FORCE TRIM 버튼 — 누르고 바로 놓은 것과 같다
function forceTrimBtn() { forceTrim(); forceTrimRelease(); }
function forceTrimRelease() {
  try { if (typeof simFtrRelease === 'function') simFtrRelease(); } catch (e) { _swallow(e); }
}
function forceTrim() {
  // SIM 모드 IAS — 조종간으로 옮겨 간 지금 속도를 새 기준으로 잡는다
  if (simModeOn && simIasOn && !gspdOn) { selSpd = simIasClamp(S.spd); return; }
  if (!gspdOn) return;
  gspdRefLat = clampLat(Math.round(gspdActLat));
  gspdRefFwd = clampFwd(Math.round(gspdActFwd));
}

// ── Hover Position marker ──
// Captures the aircraft's world position on press. On the hover page
// (which is aircraft-centered, body-frame, 50ft radius), this captured
// point is drawn as a square that drifts as the aircraft moves.
let hoverPosOn  = false;
let hoverPosLat = null, hoverPosLon = null;

function toggleHoverPosition() {
  if (hoverPosOn) {
    hoverPosOn  = false;
    hoverPosLat = null;
    hoverPosLon = null;
  } else {
    hoverPosOn  = true;
    hoverPosLat = S.lat;
    hoverPosLon = S.lon;
  }
  const btn = document.getElementById('hover-pos-btn');
  if (btn) btn.classList.toggle('on', hoverPosOn);
}

// ── OBS (Omni Bearing Selector) ──
let obsOn = false;
let vorObsCrs = 360; // VOR/LOC 전용 OBS 코스 — S.crs(FMS) 와 완전 분리

// ── NAV AP (Course Tracking Autopilot) ──
let navApOn = false;

// ── Wind ──
let windDir = 270; // direction FROM which wind blows (0-359°)
let windSpd = 0;   // knots

// Speed-dependent wind effect on motion. While GSPD (or coast) is engaged
// ASE compensates wind completely. Outside GSPD, the helicopter's basic
// stabilization holds it against wind in the hover/low-speed regime, so
// wind only begins to affect ground motion as IAS pushes forward into the
// cruise band. Linear blend between WIND_LO and WIND_HI, saturated outside.
const WIND_LO = 30;  // S.spd at or below this → no wind effect
const WIND_HI = 60;  // S.spd at or above this → full wind effect
function windEffectFactor() {
  if (gspdOn || gspdCoasting) return 0;
  // SIM 모드는 공중에 뜨면 늘 바람에 실린다(호버에서도) — 속도(S.spd·simLat)는 대기속도다.
  // 바퀴가 땅·갑판에 붙어 있으면 밀리지 않는다(14-simmode.js 가 뜨고 앉을 때 바람 몫을 넘겨 준다).
  if (simModeOn) return (typeof _simOnGnd !== 'undefined' && _simOnGnd) ? 0 : 1;
  if (S.spd <= WIND_LO) return 0;
  if (S.spd >= WIND_HI) return 1;
  return (S.spd - WIND_LO) / (WIND_HI - WIND_LO);
}
function effectiveWindSpd() { return windSpd * windEffectFactor(); }

// Ground track considering wind (returns degrees 0-359). Wind contribution
// is scaled by the speed-dependent effect factor — in hover/low-speed the
// helicopter's stabilization holds heading, in cruise the diamond drifts.
function computeTrack() {
  const wEff = effectiveWindSpd();
  if (wEff <= 0) return S.hdg;
  const wt = normA(windDir + 180) * D2R;
  const gsN = S.spd * Math.cos(S.hdg * D2R) + wEff * Math.cos(wt);
  const gsE = S.spd * Math.sin(S.hdg * D2R) + wEff * Math.sin(wt);
  if (Math.abs(gsN) < 0.001 && Math.abs(gsE) < 0.001) return S.hdg;
  return normA(Math.atan2(gsE, gsN) / D2R);
}

// 지상속도(kt) — 대기속도 벡터 + 유효 바람 벡터의 크기.
// 선회 선행거리·VNAV TOD 등 "지면 기준" 계산은 모두 이 값을 쓴다.
// ── 진대기속도(TAS) ── 계기속도(IAS)는 동압을 재므로, 공기가 옅은 높은 고도에서는 같은 IAS 로도
// 실제로 더 빨리 난다: TAS = IAS × √(ρ₀/ρ). SIM 모드는 이 TAS 로 움직이고 돈다(위치·선회율·지상속도).
// 밀도는 ISA 기압(고도)과 기온(METAR 지면온도 _oatSurfaceC 에서 2°C/1000ft 로 내려감)으로 셈한다.
// SIM 밖(절차 훈련)은 종전대로 속도 값을 그대로 쓴다.
function tasRatio(altFt = S.alt) {
  const a = Math.max(0, altFt || 0);
  const t0 = (typeof _oatSurfaceC === 'number' && Number.isFinite(_oatSurfaceC)) ? _oatSurfaceC : 15;
  const tK = t0 - 2 * a / 1000 + 273.15;
  const p = Math.pow(1 - 6.87535e-6 * a, 5.2558797);           // p / p₀
  const rho = p * 288.15 / tK;                                   // ρ / ρ₀
  return Math.sqrt(1 / Math.max(0.2, rho));
}
function tasKt(v = S.spd) { return simModeOn ? v * tasRatio() : v; }
function groundSpdKt() {
  const wEff = effectiveWindSpd();
  const vT = tasKt(S.spd);
  if (wEff <= 0) return vT;
  const wt = normA(windDir + 180) * D2R;
  const gN = vT * Math.cos(S.hdg * D2R) + wEff * Math.cos(wt);
  const gE = vT * Math.sin(S.hdg * D2R) + wEff * Math.sin(wt);
  return Math.sqrt(gN * gN + gE * gE);
}

// 편류수정각(WCA) 보정 — 요망 대지트랙(desiredTrack)을 유지하기 위한 기수방위.
//   V·sin(H−T) + W·sin(Tw−T) = 0,  Tw = windDir+180 (바람이 불어가는 방향)
//   → H = T + asin(W/V · sin(windDir − T))
// 바람이 대기속도보다 강해 해가 없으면(측풍 성분 초과) 최대 보정각으로 클램프한다.
// mult 는 편류수정각 배수 — 홀딩 아웃바운드 레그에서 3배(triple drift)를 써서
// 인바운드 선회를 마쳤을 때 코스 위에 놓이도록 바람 쪽으로 더 치우쳐 난다.
function windCorrectedHdg(desiredTrack, mult) {
  const wEff = effectiveWindSpd();
  const v = Math.max(20, tasKt(S.spd));
  if (wEff <= 0.1) return desiredTrack;
  const s = wEff * Math.sin((windDir - desiredTrack) * D2R) / v;
  let wca = Math.asin(Math.max(-1, Math.min(1, s))) / D2R;
  if (mult && mult !== 1) wca = Math.max(-45, Math.min(45, wca * mult));
  return normA(desiredTrack + wca);
}

// 현재 navSrc 에 맞는 활성 코스 반환
function activeCrs() {
  return (navSrc !== 'FMS') ? vorObsCrs : S.crs;
}

// CRS 버튼 활성/비활성: VOR/LOC 는 항상 활성, FMS 는 OBS ON 일 때만
function updateCrsButtons() {
  const enabled = obsOn || navSrc !== 'FMS';
  ['crs-dn', 'crs-up'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;   // FCP 1행의 CRS ▲▼ 는 없앴다(SIMPLE 패널 CRS 노브)
    el.disabled = !enabled;
    el.style.opacity = enabled ? '1' : '0.3';
  });
}

function toggleObs() {
  obsOn = !obsOn;
  { const b = document.getElementById('obs-btn'); if (b) b.classList.toggle('on', obsOn); }   // FCP OBS 는 없앴다(소프트키 OBS)
  updateCrsButtons();
  try { updateApInhibit(); } catch(e) { _swallow(e); }
}

function toggleNavAp() {
  afcsCmd();
  navApOn = !navApOn;
  _shipNavPhase = null;              // 함정 접근 차례는 걸 때마다 처음부터 고른다
  { const b = document.getElementById('nav-ap-btn'); if (b) b.classList.toggle('on', navApOn); }   // FCP NAV 는 없앴다(SIMPLE 패널 NAVD CPL)
  if (!navApOn) {
    if (holdOn) holdExit();          // NAV 해제 시 홀딩도 해제
    bankTarget = 0;
    selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1;   // 현재 헤딩 유지로 복귀
    hdgSelOn = true; rollApOn = true;
  }
  try { updateApInhibit(); } catch(e) { _swallow(e); }
}

// 선회 선행거리(NM) — 현재 레그 코스(curCrs)에서 다음 레그 코스(nextCrs)로
// 꺾을 때 코스를 매끄럽게 잇기 위해 웨이포인트 전에 선회를 시작할 거리.
//   d = R · tan(θ/2),  R = V²/(g·tanφ)
// V 는 대기속도가 아니라 지상속도(바람 포함)를 쓴다 — 선회 반경은 지면 기준이다.
// φ 는 AP 가 실제로 쓰는 뱅크(표준선회 뱅크, 최대 25°)를 쓴다.
function flyByAnticipationDist(nextCrs, curCrs) {
  const from = (curCrs === undefined || curCrs === null) ? activeCrs() : curCrs;
  const turnAngle = Math.abs(normAS(nextCrs - from));
  if (turnAngle < 5) return 0.15;
  const gs = Math.max(20, groundSpdKt());
  const V_ms = gs * 0.5144;
  const bank = Math.max(5, Math.min(25, stdRateBank(gs)));
  const turnRadius = V_ms * V_ms / (9.81 * Math.tan(bank * D2R)) / 1852; // NM
  // 180°에 가까운 반전에서 tan(θ/2)가 발산하므로 상한을 둔다
  const lead = turnRadius * Math.tan(Math.min(turnAngle, 160) / 2 * D2R);
  return Math.max(0.15, Math.min(lead, 8));
}

// Compute NAV AP bank target for course tracking.
// Returns the desired bankTarget value.
// NAV 오토파일럿 — 코스선을 선택 각도(30/45/60°)로 인터셉트하고, 붙으면 롤아웃해 추종한다.
// 그 각으로 잡기에 표적이 너무 가까우면(인터셉트 지점이 표적을 지나가면) 표적으로 직행한다.
// 최종 지령은 요망 "대지트랙"에 편류수정각을 더한 기수방위다.
const NAV_INTERCEPT_CHOICES = [30, 45, 60];
let navInterceptDeg = 45;          // 인터셉트 각도(조종사 선택: 30/45/60)
let _navDirectTo = false;          // 표적 직행 모드(FMA 표기에 사용)
const VOR_FSD_DEG = 10;            // VOR CDI 최대편위 = 10°
// ── 함정 TACAN(I-SHP) 접근 ── 함정은 움직이는 착륙장이다. 지상 VOR 처럼 '국 1.5NM 안은 혼동원추라 기수 유지'
// 로 두면 마지막 접근에서 손을 놓고, 함정 앞·옆에 있으면 코스선(함정 침로)을 따라 함정에서 멀어진다.
// 그래서 함정 뒤 코스선(침로의 반대쪽 · 접근로)으로 들어가 함정까지 따라가는 차례를 둔다:
//   ABEAM — 함정 앞이면 먼저 함정 옆(내 쪽 SHIP_ABEAM_NM)을 지나 함정 위를 넘지 않는다
//   GATE  — 함정 뒤 SHIP_GATE_NM 관문으로 곧장(닿을 때까지 — 도중에 꺾지 않는다)
//   TRACK — 코스선 편위를 NM 로 보고(FMS 와 같은 인터셉트 · 롤아웃) 함정까지 따라간다 — 가까워져도 놓지 않는다
//   OVER  — 함정 위(SHIP_OVER_NM)에 닿으면 함정 침로로 난다(1NM 넘게 벗어나면 다시 처음부터)
const SHIP_GATE_NM = 2, SHIP_ABEAM_NM = 1.2, SHIP_OVER_NM = 0.15;
let _shipNavPhase = null, _shipNavT = 0;
function shipNavPhase() { return _shipNavPhase; }
function _navShipTacan() {
  if (navSrc === 'FMS') return false;
  const r = (typeof navRadios === 'object' && navRadios) ? navRadios[navSrc] : null;
  return !!(r && r.ship && navLat !== null && navLon !== null);
}
function _navShipBank(L) {
  const crs = L.crs, d = distance(S.lat, S.lon, navLat, navLon);
  const brgFromShip = bearing(navLat, navLon, S.lat, S.lon);
  const along = d * Math.cos((brgFromShip - crs) * D2R);           // + = 함정 앞, − = 함정 뒤
  const xtk = courseXtk(L);                                         // + = 코스 오른쪽
  const IC = navInterceptDeg;
  // 오래 쉬었다 다시 걸면(2초 넘게 불리지 않음) 처음부터 고른다
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (now - _shipNavT > 2000) _shipNavPhase = null;
  _shipNavT = now;
  let ph = _shipNavPhase;
  const astern = along < -0.5 && Math.abs(xtk) < -along * 0.6;     // 접근로 안쪽(뒤쪽 · 코스선 가까이)
  if (!ph) ph = d < SHIP_OVER_NM ? 'OVER' : astern ? 'TRACK' : along > 0 ? 'ABEAM' : 'GATE';
  if (ph === 'OVER' && d > 1) ph = astern ? 'TRACK' : along > 0 ? 'ABEAM' : 'GATE';
  if (ph === 'TRACK' && d < SHIP_OVER_NM) ph = 'OVER';
  if (ph === 'TRACK' && along > 0.5) ph = 'ABEAM';                  // 함정을 앞질렀다
  if (ph === 'ABEAM' && along < 0) ph = 'GATE';                      // 함정 옆을 지났다
  const side = xtk >= 0 ? 1 : -1;                                   // 내가 있는 쪽(코스 오른쪽 +)
  const gate = destPoint(navLat, navLon, normA(crs + 180), SHIP_GATE_NM);
  if (ph === 'GATE' && distance(S.lat, S.lon, gate[0], gate[1]) < 0.3) ph = 'TRACK';
  _shipNavPhase = ph;
  let desiredTrk;
  _navDirectTo = ph === 'ABEAM' || ph === 'GATE';
  if (ph === 'OVER') desiredTrk = crs;
  else if (ph === 'ABEAM') {
    const a = destPoint(navLat, navLon, normA(crs + 90 * side), SHIP_ABEAM_NM);
    desiredTrk = bearing(S.lat, S.lon, a[0], a[1]);
  } else if (ph === 'GATE') desiredTrk = bearing(S.lat, S.lon, gate[0], gate[1]);
  else {
    const rollOut = Math.max(0.15, navTurnRadiusNM() * (1 - Math.cos(IC * D2R)));
    const ang = Math.min(IC, Math.abs(xtk) / rollOut * IC);
    desiredTrk = normA(crs - Math.sign(xtk) * ang);
  }
  const hdgErr = normAS(windCorrectedHdg(desiredTrk) - S.hdg);
  return Math.max(-25, Math.min(25, hdgErr * 2));
}
function navApBankTarget() {
  const L = activeCourseLine();
  if (!L) { _navDirectTo = false; return 0; }
  if (_navShipTacan()) return _navShipBank(L);
  const crs = courseCrsHere(L);    // 현재 위치에서 본 코스 방위(대권 보정)
  const xtk = courseXtk(L);        // + = 코스 오른쪽
  const aXtk = Math.abs(xtk);
  const IC = navInterceptDeg;

  // 인터셉트에 필요한 코스 방향 거리 = |xtk| / tan(IC)
  // 표적까지 남은 거리가 그보다 짧으면 그 각으로 잡을 수 없다 → 표적으로 직행
  const needRun = aXtk / Math.tan(IC * D2R);
  const tgtBrg  = bearing(S.lat, S.lon, L.to[0], L.to[1]);
  const tgtDist = distance(S.lat, S.lon, L.to[0], L.to[1]);
  _navDirectTo = aXtk > 0.1 && tgtDist < needRun + navTurnRadiusNM();

  // 요망 대지트랙(track). 기수가 아니라 트랙을 만든 뒤 바람 보정으로 기수를 뽑는다.
  let desiredTrk;
  if (_navDirectTo) {
    desiredTrk = tgtBrg;                                   // 표적으로 수렴
  } else if (navSrc !== 'FMS') {
    // VOR/LOC: 편위를 거리(NM)가 아니라 각도(°)로 본다 — 실제 VOR 수신기와 동일.
    // 국에서 멀수록 같은 NM 오차가 작은 각도가 되어 인터셉트가 완만해지고,
    // 가까울수록 예민해진다. 최대편위(10°)에서 선택 인터셉트 각을 전부 쓴다.
    if (tgtDist < 1.5) return 0;   // 혼동원추(cone of confusion) — 기수 유지
    const devDeg = Math.atan2(xtk, Math.max(0.1, tgtDist)) / D2R;   // + = 코스 오른쪽
    const ang = Math.min(IC, Math.abs(devDeg) / VOR_FSD_DEG * IC);
    desiredTrk = normA(crs - Math.sign(xtk) * ang);
  } else {
    // 롤아웃: 표준선회 반경으로 IC 에서 코스로 눕히는 데 필요한 횡거리
    const rollOut = Math.max(0.15, navTurnRadiusNM() * (1 - Math.cos(IC * D2R)));
    const ang = Math.min(IC, aXtk / rollOut * IC);
    desiredTrk = normA(crs - Math.sign(xtk) * ang);
  }
  // 편류수정: 측풍에서 기수를 바람 쪽으로 틀어야 대지트랙이 코스에 붙는다.
  const desiredHdg = windCorrectedHdg(desiredTrk);
  const hdgErr = normAS(desiredHdg - S.hdg);
  return Math.max(-25, Math.min(25, hdgErr * 2));
}

// 인터셉트 각도 순환(30 → 45 → 60 → 30)
function cycleIntercept() {
  const i = NAV_INTERCEPT_CHOICES.indexOf(navInterceptDeg);
  navInterceptDeg = NAV_INTERCEPT_CHOICES[(i + 1) % NAV_INTERCEPT_CHOICES.length];
  updateInterceptBtn();
}
function updateInterceptBtn() {
  const el = document.getElementById('icpt-btn');
  if (el) el.textContent = navInterceptDeg + '°';
}

// ── 홀딩 패턴 (표준: 우선회, 1분 레그) ───────────────────────────────
// 홀딩 픽스는 FMS 활성 웨이포인트(또는 NAV1/2 로 튜닝된 VOR),
// 인바운드 코스는 진입 시점의 활성 레그 코스를 쓴다.
let holdOn = false;
let holdFix = null;              // { lat, lon, ident }
let holdCrs = 0;                 // 인바운드 코스(진북)
let holdRight = true;            // true = 우선회(표준)
let holdLegType = 'TIME';        // 'TIME' | 'DIST'
let holdLegVal = 60;             // TIME 이면 초, DIST 이면 NM
let _holdPhase = 'TOFIX';        // TOFIX | OUTBOUND | INBOUND
let _holdEntry = '';             // DIRECT | PARALLEL | TEARDROP
let _holdT = 0;                  // 아웃바운드 경과(초)
let _holdPrevD = 1e9;            // 픽스 통과 판정용 이전 거리
let _holdForceDir = 0;           // +1 우선회 강제 / -1 좌선회 강제 / 0 최단
let _holdWpRef = null;           // 무장된 웨이포인트 객체(동일성 비교용)
let _holdClosing = false;        // 픽스로 접근 중(거리 감소) 여부 — 통과 판정 빗장
let _holdMinD = Infinity;        // 픽스로 접근하며 도달한 최근접거리(NM)
const HOLD_PASS_NEAR = 0.8;      // 이 거리 안까지 접근했어야 '통과' 로 인정

// 웨이포인트에 정의된 홀딩을 NAV 와 연동한다.
// FMS 소스이고 활성 웨이포인트에 hold 가 있으면 자동 무장되고,
// 비행계획에서 홀딩을 지우면 자동 해제된다.
// SUSP 로 홀딩을 그만둔 웨이포인트 — 이걸 기억하지 않으면 홀딩이 걸린 지점에
// 머무는 동안 holdSyncFromWp 가 매 프레임 다시 걸어 버려 빠져나올 수가 없다.
let _holdDoneWp = null;
function holdSyncFromWp() {
  const wp = (navSrc === 'FMS' && !obsOn && S.awp >= 0 && S.awp < S.wps.length)
    ? S.wps[S.awp] : null;
  const h = wp && wp.hold;
  if (wp && _holdDoneWp && _holdDoneWp !== wp) _holdDoneWp = null;   // 다른 지점이면 잊는다
  if (!h || wp === _holdDoneWp) { if (holdOn) holdExit(); return; }
  const fresh = !holdOn || _holdWpRef !== wp;
  _holdWpRef = wp;
  holdFix = { lat: wp.lat, lon: wp.lon, ident: wp.ident || 'WPT' };
  holdRight = h.dir !== 'L';
  holdCrs = h.crs;                       // 진북 기준으로 저장한다
  holdLegType = h.legType === 'DIST' ? 'DIST' : 'TIME';
  holdLegVal = h.legVal || (holdLegType === 'DIST' ? 5 : 60);
  if (fresh) {
    holdOn = true; _holdPhase = 'TOFIX'; _holdEntry = ''; _holdT = 0; _holdForceDir = 0;
    _holdClosing = false; _holdMinD = Infinity;
    _holdPrevD = distance(S.lat, S.lon, holdFix.lat, holdFix.lon);
    updateHoldLine();
  }
}
function holdExit() {
  holdOn = false; holdFix = null; _holdWpRef = null;
  _holdPhase = 'TOFIX'; _holdEntry = ''; _holdForceDir = 0; _holdClosing = false;
  _holdMinD = Infinity; _holdPrevD = 1e9;
  updateHoldLine();
}
// 홀딩 인바운드 코스 기본값(자북, 표시/입력용) — 직전 웨이포인트에서의 레그 코스
function holdDefaultCrsMag(i) {
  if (i > 0 && i < S.wps.length) {
    const p = S.wps[i - 1], w = S.wps[i];
    return Math.round(toMag(normA(bearing(w.lat, w.lon, p.lat, p.lon) + 180)));
  }
  if (i >= 0 && i < S.wps.length) {
    return Math.round(toMag(bearing(S.lat, S.lon, S.wps[i].lat, S.wps[i].lon)));
  }
  return 360;
}

// 헤딩 유지용 뱅크 지령. dir 이 0 이 아니면 그 방향으로 강제 선회한다.
// 단 목표가 반대쪽으로 90° 이내면 강제하지 않는다 — 강제하면 270° 를 넘는
// 선회를 명령하게 되어 픽스 옆에서 제자리로 한 바퀴 도는 현상이 생긴다.
// (평행 진입의 "180° 넘는 합류 선회" 는 이 시점 오차가 90° 를 크게 넘으므로
//  그대로 유지된다.)
const HOLD_FORCE_MIN = 90;
// 추종에 쓸 수 있는 최대 뱅크. 지령은 기수 오차에 비례(err×2)하므로 경로에
// 붙어 있는 동안은 표준선회 뱅크 근처에 머물고, 벗어났을 때만 여기까지 눕는다.
// 종전에는 상한이 표준선회 뱅크였다(81kt 면 13°). 그래서 한 번 벗어나면
// 되돌아오는 데 시간이 걸려 패턴을 크게 돌아 나갔다.
const HOLD_BANK_MAX = 23;
function _holdHdgBank(tgtHdg, dir) {
  let err = normAS(tgtHdg - S.hdg);
  if (dir && Math.abs(err) > HOLD_FORCE_MIN && Math.sign(err) !== dir) err = err - 360 * Math.sign(err);
  const bMax = Math.max(5, Math.min(HOLD_BANK_MAX, Math.max(stdRateBank(S.spd), HOLD_BANK_MAX)));
  return Math.max(-bMax, Math.min(bMax, err * 2));
}

// 홀딩 진입 방식 판정
//
// 기준은 기수가 아니라 **픽스에서 본 항공기 방위(어느 방향에서 들어오는가)** 다.
// 인바운드 코스 C 대비 그 방위의 상대각 q — 좌선회는 q = 방위 − C,
// 우선회는 거울상이라 q = C − 방위:
//   q   0 ~  70° : 눈물방울(TEARDROP,  70° 섹터)
//   q  70 ~ 250° : 직진(DIRECT,      180° 섹터)
//   q 250 ~ 360° : 평행(PARALLEL,    110° 섹터)
// 인바운드 091°·좌선회면 픽스 기준 091~161° 에서 들어오면 눈물방울,
// 161~341° 는 직진, 341~091° 는 평행이 된다.
//
// 호출부는 기수를 넘긴다(픽스 통과 시점의 S.hdg). 픽스로 곧장 들어오는
// 상황이므로 방위는 기수의 반대편이다 — 여기서 뒤집어 쓴다.
//
// 각도는 전부 자북(°M)으로 맞춰 비교한다. 화면에 보이는 숫자가 자북이므로
// 판정도 같은 기준이어야 한다 — 경계에 여유를 두거나 기준이 어긋나면
// "인바운드 091°, 방위 090° 인데 눈물방울" 같은 그림·판정 불일치가 생긴다.
// (편차는 회전이라 값 자체는 같지만, 기준을 하나로 못박아 둔다)
// crs·right 를 넘기면 무장되지 않은 홀딩(비행계획에만 있는 것)도 판정할 수 있다.
// 넘기지 않으면 지금 무장된 홀딩을 본다 — 시뮬 쪽 호출은 전부 이쪽이다.
function _holdEntryType(hdg, crs, right) {
  const H = (hdg === undefined || hdg === null) ? S.hdg : hdg;
  const C = (crs === undefined || crs === null) ? holdCrs : crs;
  const rgt = (right === undefined || right === null) ? holdRight : right;
  const brgM = toMag(normA(H + 180));               // 픽스에서 본 항공기 방위(자북)
  const crsM = toMag(C);                            // 인바운드 코스(자북)
  const q = normA(rgt ? crsM - brgM : brgM - crsM);
  if (q < 70)  return 'TEARDROP';
  if (q < 250) return 'DIRECT';
  return 'PARALLEL';
}

// ── 홀딩 경로 추종 ──────────────────────────────────────────────
// 지도에 그려지는 레이스트랙 자체를 목표 경로로 삼아 그대로 따라 난다.
// (기수·타이머로 짜맞추면 그림과 항적이 어긋나므로, 그림을 유일한 기준으로 둔다)

// 위경도 → 픽스 기준 평면 좌표(NM). 홀딩 패턴 크기에서는 평면 근사로 충분하다.
function _holdXY(lat, lon) {
  return [ (lon - holdFix.lon) * Math.cos(holdFix.lat * D2R) * 60,
           (lat - holdFix.lat) * 60 ];
}
// 패턴의 주요 지점 — 1선회(픽스) → 2선회 끝(A) → 3선회 시작(B) → 4선회 끝(Cp)
function holdKeyPoints() {
  const R = navTurnRadiusNM();
  const legNM = (holdLegType === 'DIST')
    ? Math.max(0.5, holdLegVal)
    : Math.max(20, S.spd) / 3600 * holdLegVal;
  const sgn = holdRight ? 1 : -1;
  const out = normA(holdCrs + 180);
  const F = [holdFix.lat, holdFix.lon];
  const A = destPoint(F[0], F[1], normA(holdCrs + sgn * 90), 2 * R);   // 2선회 끝
  const B = destPoint(A[0], A[1], out, legNM);                          // 3선회 시작
  const Cp = destPoint(F[0], F[1], out, legNM);                         // 4선회 끝
  return { R, legNM, sgn, out, F, A, B, Cp };
}

// 경로 추종(pure pursuit): 패턴 폴리라인에서 최근접점을 찾고, 그보다
// lookahead 만큼 앞선 점을 향하는 대지 트랙을 만든 뒤 편류수정해 기수를 뽑는다.
// 추종할 구간을 고를 때 허용하는 기수-구간 방향차(°).
// 이보다 크게 어긋난 구간은 "반대로 달리는 레그" 로 보고 후보에서 뺀다.
const HOLD_TRACK_MAX_REL = 100;
function holdTrackBank() {
  const pts = holdPatternLatLngs();
  if (!pts || pts.length < 4) return 0;
  const XY = pts.map(p => _holdXY(p[0], p[1]));
  const me = _holdXY(S.lat, S.lon);
  let bi = 0, bt = 0, bd = Infinity;
  let fi = 0, ft = 0, fd = Infinity;   // 진행 방향이 맞는 구간 중 최근접
  for (let i = 0; i < XY.length - 1; i++) {
    const ax = XY[i][0], ay = XY[i][1];
    const dx = XY[i+1][0] - ax, dy = XY[i+1][1] - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 > 1e-12 ? ((me[0]-ax)*dx + (me[1]-ay)*dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const ex = me[0] - (ax + t*dx), ey = me[1] - (ay + t*dy);
    const d2 = ex*ex + ey*ey;
    if (d2 < bd) { bd = d2; bi = i; bt = t; }
    // 지금 기수와 반대로 달리는 구간은 후보에서 뺀다.
    // 평행 진입을 마치면 항공기는 인바운드 기수인 채로 아웃바운드 레그
    // (반대 방향, 2R 밖에 안 떨어진 곳) 곁에 서게 된다. 방향을 보지 않고
    // 가장 가까운 점만 쫓으면 그 레그를 잡아 180° 를 돌아 거꾸로 붙는다 —
    // 항적에 큰 고리가 하나 생긴다(사용자가 본 그 고리다).
    // 길이가 0 에 가까운 이음매(원호의 시작점과 직전 점이 같은 자리)는 건너뛴다.
    // 그런 구간의 방향은 부동소수점 찌꺼기라, 하필 기수와 비슷하게 나오면
    // "여기가 맞다" 며 붙잡고는 곧바로 원호 안쪽으로 끌려 들어간다.
    if (L2 > 1e-4) {
      const segTrk = normA(Math.atan2(dx, dy) / D2R);
      if (Math.abs(normAS(segTrk - S.hdg)) <= HOLD_TRACK_MAX_REL && d2 < fd) {
        fd = d2; fi = i; ft = t;
      }
    }
  }
  // 방향이 맞는 후보가 하나라도 있으면 그중 가장 가까운 것을 쫓는다.
  // 하나도 없으면(패턴을 옆으로 가로지르는 중 등) 종전대로 최근접점을 쓴다.
  if (fd < Infinity) { bd = fd; bi = fi; bt = ft; }
  // lookahead — 선회반경에 비례. 짧으면 진동, 길면 모서리를 자른다.
  const look = Math.max(0.2, navTurnRadiusNM() * 0.9);
  let need = look, i = bi, t = bt, tx = XY[bi][0], ty = XY[bi][1], guard = 0;
  while (guard++ < 200) {
    const ax = XY[i][0] + t * (XY[i+1][0] - XY[i][0]);
    const ay = XY[i][1] + t * (XY[i+1][1] - XY[i][1]);
    const bx = XY[i+1][0], by = XY[i+1][1];
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg >= need) {
      const f = seg > 1e-9 ? need / seg : 0;
      tx = ax + f * (bx - ax); ty = ay + f * (by - ay);
      break;
    }
    need -= seg; t = 0; i++;
    if (i >= XY.length - 1) i = 0;            // 닫힌 경로 — 처음으로 순환
    tx = XY[i][0]; ty = XY[i][1];
  }
  const trk = normA(Math.atan2(tx - me[0], ty - me[1]) / D2R);
  return _holdHdgBank(windCorrectedHdg(trk), 0);
}

// 홀딩 AP. 뱅크 지령을 반환하고, 아직 픽스로 가는 중이면 null(일반 NAV 사용).
function holdBankTarget(dt) {
  if (!holdOn || !holdFix) return null;
  const d = distance(S.lat, S.lon, holdFix.lat, holdFix.lon);
  const sgn = holdRight ? 1 : -1;

  if (_holdPhase === 'TOFIX') {
    // 홀딩 로직은 "픽스를 실제로 지나간 뒤" 에만 시작한다.
    //   · 0.8NM 이내까지 접근했던 적이 있고(HOLD_PASS_NEAR — 최근접거리 _holdMinD),
    //   · 지금 픽스가 정횡이나 그 뒤(90° 초과)이며 멀어지는 중
    // 종전에는 "0.35NM 이내면 통과" 라는 지름길이 있었다. 그 탓에 픽스 0.35NM
    // 앞에서 선회가 시작돼, 항적이 픽스를 지나기 전에 꺾였다. 0.2NM 눈금 지도에서는
    // 한눈에 보이는 거리다. 지름길을 걷어내고 실제로 지나갔는지만 본다.
    // (완전 상공 통과 프레임을 위해 아주 가까운 거리 하나만 남겨 둔다)
    _holdMinD = Math.min(_holdMinD, d);
    const relFixDeg = Math.abs(normAS(bearing(S.lat, S.lon, holdFix.lat, holdFix.lon) - S.hdg));
    const passed = (d < 0.02) ||
      (_holdMinD < HOLD_PASS_NEAR && relFixDeg > 90 && d > _holdPrevD);
    _holdPrevD = d;
    if (!passed) return null;                     // 픽스까지는 일반 NAV 로 비행
    _holdClosing = false; _holdMinD = Infinity;
    _holdEntry = _holdEntryType(S.hdg);
    S.crs = normA(holdCrs);                       // Twist — CDI 를 인바운드 코스로
    _holdT = 0;
    if (_holdEntry === 'TEARDROP') {
      // 3선회지점(아웃바운드 레그 끝, B)으로 곧장 향한다
      _holdPhase = 'TEARDROP'; _holdForceDir = sgn;
    } else if (_holdEntry === 'PARALLEL') {
      // 아웃바운드 방향으로 1분(레그 시간) — 지상항적이 역방위각이 되게
      _holdPhase = 'PAR_OUT'; _holdForceDir = -sgn;
    } else {
      _holdPhase = 'TRACK'; _holdForceDir = sgn;  // 직진 — 곧바로 패턴 추종
    }
  }

  // 눈물방울: 3선회지점까지 직행 → 도달하면 패턴 추종
  if (_holdPhase === 'TEARDROP') {
    const K = holdKeyPoints();
    const dB = distance(S.lat, S.lon, K.B[0], K.B[1]);
    if (dB < Math.max(0.2, K.R * 0.6)) { _holdPhase = 'TRACK'; _holdForceDir = 0; }
    else {
      const trk = bearing(S.lat, S.lon, K.B[0], K.B[1]);
      const tgt = windCorrectedHdg(trk);
      if (_holdForceDir && Math.abs(normAS(tgt - S.hdg)) < 20) _holdForceDir = 0;
      return _holdHdgBank(tgt, _holdForceDir);
    }
  }

  // 평행: 아웃바운드 방향으로 레그 시간만큼(픽스 통과 시점부터) 비행
  if (_holdPhase === 'PAR_OUT') {
    _holdT += dt;
    const outTrk = normA(holdCrs + 180);
    const tgt = windCorrectedHdg(outTrk);          // 지상항적 = 역방위각
    if (_holdForceDir && Math.abs(normAS(tgt - S.hdg)) < 15) _holdForceDir = 0;
    const done = (holdLegType === 'DIST') ? (d >= holdLegVal) : (_holdT >= holdLegVal);
    if (done) { _holdPhase = 'PAR_TURN'; _holdForceDir = -sgn; }
    else return _holdHdgBank(tgt, _holdForceDir);
  }

  // 평행 합류 선회: 좌장주면 우선회, 우장주면 좌선회 → 인바운드 코스로.
  // 아웃바운드는 홀딩 반대쪽에서 날았으므로, 코스를 가로질러 홀딩측으로
  // 넘어가는 쪽으로 돌아야 한다(그 반대로 돌면 코스에서 멀어진다).
  if (_holdPhase === 'PAR_TURN') {
    const tgt = windCorrectedHdg(holdCrs);
    if (Math.abs(normAS(tgt - S.hdg)) > 15) return _holdHdgBank(tgt, _holdForceDir);
    _holdPhase = 'TRACK'; _holdForceDir = 0;
  }

  // 패턴 추종
  _holdPrevD = d;
  return holdTrackBank();
}

// 홀딩 패턴 궤적(지도 표시용) — 픽스 기준 레이스트랙.
// fix/cfg 를 주면 무장 여부와 무관하게 그린다(비행계획에 정의만 된 홀딩 미리보기).
function holdPatternLatLngs(fix, cfg) {
  const F0 = fix || holdFix;
  if (!F0) return [];
  const dir   = cfg ? (cfg.dir !== 'L') : holdRight;
  const crsT  = cfg ? cfg.crs : holdCrs;
  const lType = cfg ? (cfg.legType === 'DIST' ? 'DIST' : 'TIME') : holdLegType;
  const lVal  = cfg ? (cfg.legVal || (lType === 'DIST' ? 5 : 60)) : holdLegVal;
  const R = navTurnRadiusNM();
  // 레그 길이는 대기속도 기준으로 잡는다. 지상속도를 쓰면 바람 속에서 기수에 따라
  // 패턴 크기가 매 프레임 흔들려, 그 패턴을 추종하는 항적도 같이 요동친다.
  const legNM = (lType === 'DIST')
    ? Math.max(0.5, lVal)
    : Math.max(20, S.spd) / 3600 * lVal;
  const sgn = dir ? 1 : -1;
  // 주의: 지역명을 holdCrs 로 두면 위의 `cfg ? cfg.crs : holdCrs` 가 TDZ 에 걸린다
  const crsL = crsT;
  const out = normA(crsL + 180);
  const pts = [];
  const F = [F0.lat, F0.lon];
  // 픽스에서 홀딩측으로 2R 떨어진 아웃바운드 레그 시작/끝
  const A = destPoint(F[0], F[1], normA(crsL + sgn * 90), 2 * R);
  const B = destPoint(A[0], A[1], out, legNM);
  // 픽스 → 반원 → 아웃바운드 레그 → 반원 → 인바운드 레그
  const arc = (cen, from) => {
    for (let i = 0; i <= 16; i++) {
      pts.push(destPoint(cen[0], cen[1], normA(from + sgn * 180 * i / 16), R));
    }
  };
  const cen1 = destPoint(F[0], F[1], normA(crsL + sgn * 90), R);
  const cen2 = destPoint(B[0], B[1], normA(crsL - sgn * 90), R);
  pts.push(F);
  arc(cen1, normA(crsL - sgn * 90));   // F → A
  pts.push(B);
  arc(cen2, normA(crsL + sgn * 90));   // B → C
  pts.push(F);
  return pts;
}
// 표준선회(3°/s) 반경(NM) — 45° 인터셉트 판단과 롤아웃 시작점에 쓴다
function navTurnRadiusNM() {
  const v = Math.max(20, S.spd);
  return v / (2 * Math.PI * 30);   // 360°/120s 기준 원주 = v/30 NM
}

let rollApOn = true;   // false when manual bank trim overrides roll axis

// NAV source state
let navSrc  = 'FMS';   // 'FMS' | 'NAV1' | 'NAV2'
let navIcao = '';      // 현재 소스가 튜닝한 VOR ident
let navLat  = null, navLon = null;

// ── NAV1/NAV2 무선 ↔ VOR 연동 ──
// CDU Audio & Radios의 NAV 행에서 주파수 입력 또는 VOR 명칭 선택으로 튜닝
let navRadios = {
  NAV1: { freq: '115.50', id: 'SEL', lat: null, lon: null },   // 안양 VORTAC
  NAV2: { freq: '116.10', id: 'CJU', lat: null, lon: null }    // 제주 VORTAC
};
// 주파수 또는 ident 로 항행표지 찾기(freq 매칭 오차 허용).
// VOR 목록에서 먼저 찾고, 없으면 로컬라이저 목록에서 찾는다 — ILS 주파수를
// 넣었는데 국을 못 찾아 NAV 가 조용히 아무 일도 하지 않는 일이 없도록.
// LOC 는 방향을 가진 시설이라 접근 코스(crs)를 함께 돌려준다.
// ── 함정 TACAN(I-SHP · 110X) ──
// 움직이는 함정이 국이다 — 위치·거리 기준은 함정(shipLat/shipLon)을 따라 매 순간 옮겨 가고,
// 접근 코스는 함정 침로(함미에서 함수 쪽으로 다가가는 로컬라이저 꼴)다. 함정을 띄우지 않았으면 신호가 없다.
// 주파수 대신 고정 채널 '110X' 하나로 부른다(입력·버튼을 늘리지 않으려고).
const SHIP_TACAN = { id: 'I-SHP', freq: '110X', name: '함정 TACAN' };
function _shipTacan() {
  const on = (typeof shipVisible !== 'undefined') && shipVisible && shipLat !== null;
  return { id: SHIP_TACAN.id, name: SHIP_TACAN.name, freq: SHIP_TACAN.freq, ship: true, loc: true,
           lat: on ? shipLat : null, lon: on ? shipLon : null, elev: 0,
           crs: on ? toMag(shipHdg) : undefined };
}
function _isShipTacan(freq, id) {
  return id === SHIP_TACAN.id || String(freq || '').toUpperCase() === SHIP_TACAN.freq;
}
// 매 프레임 — 함정 TACAN 을 잡고 있는 무선은 함정을 따라 국 위치·코스를 옮긴다
function shipTacanSync() {
  ['NAV1', 'NAV2'].forEach(k => {
    const r = navRadios[k];
    if (!r || !r.ship) return;
    const t = _shipTacan();
    r.lat = t.lat; r.lon = t.lon; r.crs = t.crs;
    if (navSrc === k) {
      navLat = r.lat; navLon = r.lon;
      if (Number.isFinite(r.crs)) vorObsCrs = toTrue(r.crs);
    }
  });
}
function _resolveVor(freq, id) {
  if (_isShipTacan(freq, id)) return _shipTacan();
  const vors = () => { try { return ENR_VORS || []; } catch(e) { return []; } };   // 로드 중 TDZ 대비
  const locs = () => { try { return (typeof LOC_STATIONS !== 'undefined' && LOC_STATIONS) || []; }
                       catch(e) { return []; } };
  const asLoc = L => L && { id: L.id, name: `${L.name} RWY ${L.rwy} LOC`, freq: L.freq,
                            lat: L.lat, lon: L.lon, loc: true, crs: L.crs,
                            elev: L.dme && L.dme.elev };
  const sameF = (a, b) => a && b && Math.abs(parseFloat(a) - parseFloat(b)) < 0.001;
  // 식별부호를 먼저 본다 — 이름을 대고 부른 것이므로 주파수보다 앞선다.
  // 각 단계 안에서는 VOR 이 먼저다(같은 주파수대라도 VOR 을 밀어내지 않는다).
  if (id) {
    const v = vors().find(x => x.id === id && x.freq);
    if (v) return v;
    const L = asLoc(locs().find(x => x.id === id));
    if (L) return L;
  }
  if (freq) {
    const v = vors().find(x => sameF(x.freq, freq));
    if (v) return v;
    // 로컬라이저 주파수는 공항끼리 겹친다 — 108.70 하나만 해도 김포·대구 세 곳이
    // 쓴다. 출력이 약해 가까이서만 잡히는 시설이니, 여러 곳이 걸리면 지금 자리에서
    // 가장 가까운 국을 잡는다(목록 앞쪽을 무조건 잡으면 엉뚱한 공항이 걸린다).
    const cand = locs().filter(x => sameF(x.freq, freq));
    if (cand.length === 1) return asLoc(cand[0]);
    if (cand.length > 1) {
      let best = cand[0], bd = Infinity;
      cand.forEach(x => {
        const d = distance(S.lat, S.lon, x.lat, x.lon);
        if (d < bd) { bd = d; best = x; }
      });
      return asLoc(best);
    }
  }
  return null;
}
// CDU에서 NAV1/NAV2 튜닝 시 호출 — 무선 상태 갱신 + 현재 소스면 PFD 반영
function setNavRadio(navId, freq, id) {
  const r = navRadios[navId]; if (!r) return;
  if (freq != null) r.freq = freq;
  // id === null  : 호출측이 "이 주파수에 맞는 VOR 없음"을 명시 → 이전 ident를 반드시 버린다
  // id === undefined : 지정 안 함 → 기존 ident 유지
  if (id !== undefined) r.id = id || '';
  // 주파수를 새로 넣었는데 남아있는 ident가 그 주파수와 다르면 ident를 버린다.
  // (버리지 않으면 _resolveVor가 ident를 먼저 맞춰 이전 국으로 되돌아가고 입력 주파수까지 덮어쓴다)
  if (freq != null && r.id) {
    const byId = _resolveVor(null, r.id);
    if (!byId || (byId.ship ? !_isShipTacan(r.freq, null) : Math.abs(parseFloat(byId.freq) - parseFloat(r.freq)) >= 0.001)) r.id = '';
  }
  const v = _resolveVor(r.freq, r.id);
  if (v) { r.lat = v.lat; r.lon = v.lon; r.id = v.id; r.freq = v.freq; r.elev = v.elev || 0;
           r.loc = !!v.loc; r.crs = v.crs; r.ship = !!v.ship; }
  else   { r.lat = null; r.lon = null; r.elev = 0; r.loc = false; r.crs = undefined; r.ship = false; }
  if (navSrc === navId) applyNavRadioToPfd();
}
// 현재 navSrc(NAV1/NAV2)의 튜닝 VOR를 PFD 항법 상태로 반영
function applyNavRadioToPfd() {
  const r = navRadios[navSrc];
  if (!r) { navLat = navLon = null; navIcao = ''; return; }
  if (r.lat === null) { const v = _resolveVor(r.freq, r.id); if (v) { r.lat = v.lat; r.lon = v.lon; r.id = v.id; r.elev = v.elev || 0; } }
  navLat = r.lat; navLon = r.lon; navIcao = r.id || '';
  // 로컬라이저는 코스가 시설에 붙어 있다 — 조종사가 OBS 로 돌려 정하는 것이
  // 아니라 접근 코스가 정해져 있다. 튜닝하거나 그 소스로 바꾸는 순간 맞춰 준다.
  // (그 뒤 CRS 손잡이로 미세조정하는 것은 그대로 살아 있다 — 이 함수는 튜닝·
  //  소스 전환 때만 불린다)
  if (r.loc && Number.isFinite(r.crs)) {
    vorObsCrs = toTrue(r.crs);
    try { updateNav(); } catch(e) { _swallow(e); }
  }
  const lbl = document.getElementById('nav-icao-lbl');
  if (lbl) { lbl.style.visibility = 'visible'; lbl.textContent = (r.id || '----') + (r.freq ? ' ' + r.freq : ''); }
}
// BRG1(파란 방위 지시침)이 가리킬 항법시설.
//
// 방위 지시침은 CDI 소스와 따로 도는 계기다. 실제 RMI 도 그렇고, 이 앱도
// 우측 3줄에는 NAV1·NAV2 방위를 소스와 무관하게 늘 띄운다. 그런데 BRG1 은
// navLat/navLon — 즉 "지금 선택된 소스의 국" — 만 보고 있었다. NAV SOURCE 를
// FMS 로 두면 그 값이 비어서, BRG1 을 켜 뒀는데도 좌측 패널·나침반 니들·지도
// BRG1 선이 통째로 사라졌다. 소스를 FMS 로 바꿨다고 꺼질 이유가 없다.
//
// 규칙: 소스가 VOR(NAV1/NAV2)이면 그 국, FMS 면 튜닝돼 있는 NAV1(없으면 NAV2).
// 어느 무선을 가리키는지는 패널의 부제(NAV1/NAV2)에 그대로 나온다.
function brg1Station() {
  if (navSrc !== 'FMS' && navLat !== null && navLon !== null)
    return { lat: navLat, lon: navLon, id: navIcao, src: navSrc,
             elev: (navRadios[navSrc] || {}).elev || 0 };
  for (const k of ['NAV1', 'NAV2']) {
    const r = navRadios[k];
    if (r && r.lat !== null && r.lat !== undefined && r.lon !== null && r.lon !== undefined)
      return { lat: r.lat, lon: r.lon, id: r.id, src: k, elev: r.elev || 0 };
  }
  return null;
}

// ── ILS 글라이드 패스 ────────────────────────────────────────────────
// 튜닝한 로컬라이저에 GP(활공각 송신기)가 있으면, 그 활주로의 강하선을 따라
// 지금 있어야 할 고도를 낸다.
//
// 강하선은 'GP 안테나 자리에서 비행장 표고, 거기서부터 접근 방향으로 강하각
// 만큼 올라가는 면' 으로 본다. GP 안테나는 접지대 옆에 서 있으므로 이 기준이
// 실제 강하선과 거의 겹친다(문턱 통과 높이 50ft 안팎의 차이).
//
// 편차는 계기와 같이 '각도' 로 잰다. ILS 규격상 최대편위가 0.7° 이므로
// 한 점(dot)이 0.35° 다.
const GS_FULL_DEG = 0.7;        // 최대편위(°)
const GS_MAX_NM   = 25;         // 이보다 멀면 신호를 잡지 못한 것으로 본다
// 지금 튜닝된 국이 GP 를 가진 로컬라이저면 그 정보를 돌려준다.
function gsStation() {
  for (const k of ['NAV1', 'NAV2']) {
    if (navSrc !== k) continue;
    const r = navRadios[k];
    if (!r || !r.loc || !r.id) return null;
    try {
      const L = (typeof LOC_STATIONS !== 'undefined' ? LOC_STATIONS : []).find(x => x.id === r.id);
      if (L && L.gp) return L;
    } catch(e) { _swallow(e); }
    return null;
  }
  return null;
}
// 그 비행장의 표고(ft) — 강하선의 밑동이다.
function _gsFieldElev(L) {
  try {
    const code = (L.apt || '').slice(2);
    const a = AIRFIELD_INFO.find(x => x.code === code);
    if (a && Number.isFinite(a.elev)) return a.elev;
  } catch(e) { _swallow(e); }
  return 0;
}
// 글라이드 패스 편차. 잡히지 않으면 null.
//   dev  : 각도 편차(°). + = 강하선 위(높다)
//   dots : 계기 점(dot). + = 위. 최대편위 2점
//   path : 지금 자리에서의 강하선 고도(ft)
//   d    : GP 안테나까지 거리(NM)
function gsDeviation() {
  const L = gsStation();
  if (!L) return null;
  const g = L.gp;
  const d = distance(S.lat, S.lon, g.lat, g.lon);
  if (!(d > 0.15) || d > GS_MAX_NM) return null;          // 너무 가깝거나 멀다
  // 접근하는 쪽에 있어야 한다 — 안테나 뒤쪽(활주로 너머)에서는 잡히지 않는다.
  const brgToAc = bearing(g.lat, g.lon, S.lat, S.lon);
  if (Math.abs(normAS(brgToAc - toTrue(normA(L.crs + 180)))) > 90) return null;
  const ang = Number.isFinite(g.angle) ? g.angle : 3;
  const dFt = d * FT_PER_NM;
  const path = _gsFieldElev(L) + dFt * Math.tan(ang * D2R);
  const dev  = Math.atan2(S.alt - path, dFt) / D2R;
  return { dev, dots: dev / (GS_FULL_DEG / 2), path, d, angle: ang, id: L.id };
}

// ── DME 경사거리(slant range) ────────────────────────────────────────
// DME 는 항공기와 지상국 안테나 사이의 '직선거리' 를 잰다. 지도상의 수평거리가
// 아니다. 그래서 6,000ft 로 송신소 상공을 지나가면 0 이 아니라 약 1.0NM 에서
// 멈춘다(6,000ft ÷ 6,076.1ft = 0.99NM). 이 차이가 흔히 말하는 DME 경사거리
// 오차이고, 고도가 높고 국이 가까울수록 커진다 — 상공에서 최대, 멀어지면 0 에
// 수렴한다. GPS/FMS 가 주는 거리는 수평거리라 이 오차가 없다.
//
// 지상국 표고는 AIP 에 실린 값이 있으면 쓰고(vor.elev, ft), 없으면 0 으로 둔다.
// 국 표고를 빼먹어도 오차는 그 표고만큼(수백 ft = 0.1NM 미만)이다.
const FT_PER_NM = 6076.115;
function dmeDist(lat, lon, stnElevFt) {
  const d = distance(S.lat, S.lon, lat, lon);
  const dh = (S.alt - (stnElevFt || 0)) / FT_PER_NM;
  return Math.sqrt(d * d + dh * dh);
}

// PFD OAT용 지면 온도(°C) — METAR 조회 시 갱신, 기본은 ISA 해면온도 15°C.
// 09-cdu.js 에 있던 것을 여기로 옮겼다. 거기서 정의하면 첫 drawPFD 가 그보다
// 먼저 돌아 "_oatSurfaceC is not defined" 예외가 한 번 나고 OAT 가 빈 채로 그려졌다.
window._oatSurfaceC = window._oatSurfaceC ?? 15;

// ── 유효 코스선(단일 소스) ────────────────────────────────────────────
// CDI 편차·지도 코스선·NAV 오토파일럿이 서로 다른 기준선을 쓰면
// "ON COURSE인데 지도에서는 어긋나 보이는" 현상이 생긴다. 아래 한 곳에서만 정의한다.
//   returns { from:[lat,lon], to:[lat,lon], crs } — from→to 대권이 코스선
function activeCourseLine() {
  if (navSrc !== 'FMS') {
    if (navLat === null || navLon === null) return null;
    // VOR/LOC: 국(局)을 지나는 OBS 코스선
    const from = destPoint(navLat, navLon, normA(vorObsCrs + 180), 100);
    return { from, to: [navLat, navLon], crs: vorObsCrs };
  }
  if (S.awp < 0 || S.awp >= S.wps.length) return null;
  // 홀딩 진입·선회 중에는 대기 인바운드 코스가 활성 코스선이 된다(Twist).
  // 조종사가 픽스 통과와 함께 OBS 코스를 인바운드 코스로 돌리는 절차와 같다.
  if (holdOn && holdFix && _holdPhase !== 'TOFIX') {
    return { from: destPoint(holdFix.lat, holdFix.lon, normA(holdCrs + 180), 20),
             to: [holdFix.lat, holdFix.lon], crs: holdCrs };
  }
  const wp = S.wps[S.awp];
  // 지정 진입 코스(CDU 웨이포인트 카드) — 이 지점을 그 방위로 향해 들어간다.
  // OBS 와 같은 모양의 선이지만, 코스를 지점마다 따로 들고 있는 것이 다르다.
  if (!obsOn && Number.isFinite(wp.inCrs)) {
    const cT = toTrue(wp.inCrs);
    return { from: destPoint(wp.lat, wp.lon, normA(cT + 180), 100),
             to: [wp.lat, wp.lon], crs: cT };
  }
  // 이전 경유점이 있으면 그 구간(leg)이 코스선
  if (!obsOn && S.fwp >= 0 && S.fwp < S.wps.length) {
    const f = S.wps[S.fwp];
    // DME 아크 구간(Y 절차) — 이 구간의 코스는 직선이 아니라 기준국을 중심으로
    // 한 원호다. 조종사는 "기준국에서 10NM 을 유지하며 돈다". 종전에는 두 픽스를
    // 잇는 직선으로 날아 원호 안쪽을 가로질렀다(지도에는 원호가 그려져 있는데도).
    // 반지름은 양 끝점까지의 거리 평균 — 지도에 그리는 arcPoints 와 같은 기준이다.
    if (wp.arc && Number.isFinite(wp.arc.clat) && Number.isFinite(wp.arc.clon)) {
      const c = wp.arc;
      const r = (distance(c.clat, c.clon, f.lat, f.lon) +
                 distance(c.clat, c.clon, wp.lat, wp.lon)) / 2;
      if (r > 0.5) {
        return { from: [f.lat, f.lon], to: [wp.lat, wp.lon],
                 crs: bearing(f.lat, f.lon, wp.lat, wp.lon),
                 arc: { clat: c.clat, clon: c.clon, r, dir: c.dir === 'L' ? 'L' : 'R' } };
      }
    }
    return { from: [f.lat, f.lon], to: [wp.lat, wp.lon],
             crs: bearing(f.lat, f.lon, wp.lat, wp.lon) };
  }
  // 그 외(OBS·Direct-To)는 선택 코스(S.crs)가 활성 경유점을 지나는 선
  const from = destPoint(wp.lat, wp.lon, normA(S.crs + 180), 100);
  return { from, to: [wp.lat, wp.lon], crs: S.crs };
}
// 코스선 기준 횡편차(NM, + = 코스 오른쪽)
function courseXtk(L) {
  if (!L) return 0;
  if (L.arc) {
    // 아크에서는 "기준국에서 정해진 거리" 가 코스다 — 그 거리와의 차이가 편차.
    // 우선회(시계방향)면 기준국이 오른쪽에 있으므로, 바깥으로 벗어나는 것은
    // 코스의 왼쪽으로 벗어나는 것이다(+ = 코스 오른쪽).
    const d = distance(S.lat, S.lon, L.arc.clat, L.arc.clon);
    return L.arc.dir === 'R' ? (L.arc.r - d) : (d - L.arc.r);
  }
  return crossTrack(L.from[0], L.from[1], L.to[0], L.to[1], S.lat, S.lon);
}
// 현재 위치에서 본 코스선의 방향(대권은 위치마다 방위가 달라진다)
function courseCrsHere(L) {
  if (!L) return 0;
  if (L.arc) {
    // 지금 있는 자리에서의 접선 방향 — 기준국에서 본 방위의 ±90°.
    // 원호를 도는 동안 매 순간 바뀐다(그래서 직선 코스로는 흉내 낼 수 없다).
    const th = bearing(L.arc.clat, L.arc.clon, S.lat, S.lon);
    return normA(th + (L.arc.dir === 'R' ? 90 : -90));
  }
  const d = distance(L.from[0], L.from[1], L.to[0], L.to[1]);
  if (d < 0.05) return L.crs;
  // 항공기를 코스선에 정사영한 지점에서의 진행 방위
  const alongNM = Math.max(0, Math.min(d, d - distance(S.lat, S.lon, L.to[0], L.to[1])));
  const b0 = bearing(L.from[0], L.from[1], L.to[0], L.to[1]);
  const proj = destPoint(L.from[0], L.from[1], b0, alongNM);
  return bearing(proj[0], proj[1], L.to[0], L.to[1]);
}
let rnp     = 1.0;     // RNP value for FMS CDI scale

// ── 자세 ↔ 속도 ──
// 고도를 지키며(수평 비행 파워) 나는 헬기는 자세 하나가 곧 속도다:
//   기수 내림 −10° 140kt · 수평 0° 120kt · 기수 2° 100kt · 기수 6° 호버(0kt)
//   (숙일 때 1° 당 2kt — 빨라질수록 항력이 급히 늘어 덜 는다 · 0~2° 는 1° 당 10kt · 2~6° 는 1° 당 25kt)
//   6° 보다 더 들면 뒤로 간다(같은 기울기로 이어 −40kt 에서 멎는다).
// 감속 강하(수평 비행 파워보다 레버를 내린 채 기수를 든다 — 접근 절차) 때는 PITCH_SPD_DESC:
//   기수 7.5° 면 35kt 까지만 준다. 수평 파워로 받쳐야 그 아래로(호버까지) 준다(14-simmode.js).
// SIM 모드의 조종(14-simmode.js)과 AFCS 의 자동 자세가 같은 식을 쓴다.
const PITCH_SPD = [[-10, 140], [0, 120], [2, 100], [6, 0]];                 // 수평 비행 기준 · 호버 6°
const PITCH_SPD_DESC = [[-10, 140], [0, 120], [2, 100], [4, 50], [7.5, 35], [9, 0]];   // 감속 강하 — 4° 까지는 수평과 같고, 4~7.5° 는 50 → 35kt(접근 감속)
//   // [자세°(기수 올림 +), 속도 kt]
function _pitchSeg(i, T = PITCH_SPD) {
  const a = T[i], b = T[i + 1];
  return { p0: a[0], v0: a[1], k: (b[1] - a[1]) / (b[0] - a[0]) };   // kt / °
}
function spdFromPitch(pit, T = PITCH_SPD) {
  const n = T.length;
  let i = 0;
  while (i < n - 2 && pit > T[i + 1][0]) i++;      // 끝 구간 밖은 그 기울기로 잇는다
  const g = _pitchSeg(i, T);
  return g.v0 + (pit - g.p0) * g.k;
}
// 감속 강하에서 그 자세가 정하는 속도(7.5° 35kt)
function spdFromPitchDesc(pit) { return spdFromPitch(pit, PITCH_SPD_DESC); }
// 그 속도로 고도를 지키며 날 자세(위 식의 역)
function pitchFromSpd(spd) {
  const n = PITCH_SPD.length;
  let i = 0;
  while (i < n - 2 && spd < PITCH_SPD[i + 1][1]) i++;
  const g = _pitchSeg(i);
  return Math.max(-60, Math.min(60, g.p0 + (spd - g.v0) / g.k));
}

// ══════════════════════════════════════════════════════
// STOPWATCH
// ══════════════════════════════════════════════════════
// 스톱워치는 벽시계가 아니라 **시뮬 시간**으로 간다.
// 계기비행에서 이걸로 아웃바운드 1분·선회 시점을 재는데, 배속을 걸면 기체는
// 8배로 나는데 시계만 실시간으로 가서 눈금이 서로 어긋난다. 홀딩 레그 타이머
// (_holdT += dt)와 같은 시간축이어야 "1분 뒤 선회" 가 맞아떨어진다.
//   · 배속 ×N  → N 배로 흐른다
//   · 시뮬 정지 → 멈춘다(기체가 멈춰 있으니 시간도 멈춘다)
//   · GPS 모드 → 실제 비행이므로 실시간
// 그래서 경과시간을 Date.now() 차로 구하지 않고 매 프레임 더해 쌓는다(swAddMs).
const SW = { running: false, accMs: 0 };

function swElapsedMs() {
  return SW.accMs;
}
// 프레임마다 흘려 넣는 시간(ms). 흐름의 기준은 부르는 쪽(simStep)이 정한다.
function swAddMs(ms) {
  if (SW.running && ms > 0) SW.accMs += ms;
}
// 스톱워치는 PFD 안(HSI 오른쪽 아래 — 메시지 시현창 · HOCAS 아래)에 그린다(03-pfd.js drawStopwatch). FCP 칸은 없앴다.
function _swRedraw() { try { if (typeof drawPFD === 'function') drawPFD(); } catch (e) { _swallow(e); } }
function swToggle() { SW.running = !SW.running; _swRedraw(); }
function swReset() { SW.running = false; SW.accMs = 0; _swRedraw(); }

// ── NAV source / ICAO / RNP ──
function setNavSrc(src) {
  navSrc = src;
  document.querySelectorAll('.nav-src-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('nav-' + src.toLowerCase());
  if (btn) btn.classList.add('active');
  const lbl = document.getElementById('nav-icao-lbl');
  if (src === 'FMS') {
    navLat = navLon = null; navIcao = '';
    if (lbl) lbl.style.visibility = 'hidden';
  } else {
    applyNavRadioToPfd();   // NAV1/NAV2 튜닝 VOR를 CDI/BRG에 반영
  }
  // NAV 전환 시 vorObsCrs는 자동으로 덮어쓰지 않음(사용자 설정 래디얼 유지)
  updateCrsButtons();
  updateNav();
}
function setRnp(val) {
  rnp = val;
  document.querySelectorAll('.rnp-btn').forEach(b => b.classList.remove('active'));
  const idMap = { 4:'rnp-4', 2:'rnp-2', 1:'rnp-1', 0.3:'rnp-03' };
  const el = document.getElementById(idMap[val]);
  if (el) el.classList.add('active');
}
// 스톱워치 ↔ 현재 시각 통합 위젯 (TIME/STOP WATCH 버튼으로 전환)
let _swMode = 'clock';   // 'sw' | 'clock' — 기본은 현재 시각 표시
function swSetMode(m) { _swMode = m; _swRedraw(); }
// 지금 보일 글자 — 스톱워치 mm:ss.t · 시계 hh:mm:ss(로컬)
function swText() {
  if (_swMode === 'sw') {
    const ms = swElapsedMs(), m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), t = Math.floor((ms % 1000) / 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + t;
  }
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
function swRender() { /* 프레임마다 drawPFD 가 swText() 를 그린다 */ }
// 시계는 1초마다 — 시뮬이 멈춰 있어도 PFD 의 시각이 흐르게
function clockRender() { if (_swMode === 'clock' && !S.running) _swRedraw(); }
setInterval(clockRender, 1000);

