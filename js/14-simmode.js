// ─────────────────────────────────────────────────────────────
// 14-simmode.js — SIM 모드(조종간 직접 조종)
//
// 평소 이 시뮬레이터는 AFCS 목표값(선택 헤딩·고도·속도)으로 난다. SIM 모드는
// 그 위에 '손으로 모는' 길을 하나 더 얹는다 — 조이스틱 축을 그대로 받아
// 자세와 속도를 만들고, 그 결과가 PFD(자세·속도·고도)와 지도(위치·항적)에
// 같이 나타난다. 두 화면이 따로 노는 일이 없도록 상태(S)만 고치고,
// 그리기는 종전 경로를 그대로 쓴다.
//
// 조종 법칙은 '그럴듯하게 날리는' 수준으로 단순하게 둔다(공력 모델이 아니다).
//   · 사이클릭 좌우 → 뱅크, 뱅크가 선회를 만든다(조화선회는 기존 코드가 한다)
//   · 사이클릭 전후 → 피치, 피치가 가감속을 만든다(기수를 내리면 빨라진다)
//   · 페달         → 기수만 돌린다(저속에서 쓰는 요 조작)
//   · 컬렉티브     → 토크(TQ %). 남는 토크가 상승률이 된다
// SIM 모드로 들어갈 때 AFCS(NAV·HDG·ALT·CRHT·GSPD·IAS)는 놓는다. 들어온 뒤 조종사가
// 상위모드를 걸면 그 축은 AFCS 가 몰고 조종간의 그 축 값은 무시한다 — 두 곳에서
// 같은 축을 몰면 서로 싸운다(HDG·NAV → 좌우·페달, ALT·CRHT → 컬렉티브).
// IAS 만은 조종간 전후를 무시하지 않는다 — 밀고 당기는 만큼 기수가 벗어났다가
// 놓으면 IAS 자세로 돌아온다(fly-through · simAfcsPitch).
// ─────────────────────────────────────────────────────────────

const SIM_BANK_MAX  = 45;      // 사이클릭 최대 뱅크(°)
const SIM_ROLL_RATE = 24;      // 사이클릭에 뱅크가 따라가는 빠르기(°/s) — 12 에서 두 배(뱅크가 먼저 들어와야 선회가 시작되므로 피치보다 둔하게 느껴졌다)
// 기수 자세의 한계 — 위아래 60° 까지. 속도는 제 한계에서 멎는다
// (들면 16° 에 뒤로 40kt, 숙이면 −20° 에 160kt).
const SIM_PITCH_MAX = 48;      // 사이클릭 최대 피치(°) — 종전 60° 의 80%: 같은 조종간 움직임에 자세가 덜 변해 더 정밀하다
// ── 바퀴형 — 땅 위에서 ──
// 흰수리는 바퀴가 달려 있다. 땅에서 토크를 20% 넘게 쓰면 원판이 앞으로 끌어 천천히
// 굴러가기 시작하고(GND_CREEP — 토크가 클수록), 사이클릭을 민 만큼(기수를 숙인 각만큼)
// 더 빨리 붙는다. 당기면(기수를 들면) 그만큼 늦춘다. 토크를 20% 아래로 내리면 바퀴
// 브레이크·저항으로 선다. 땅 위의 자세는 위아래 10° 까지다. 뒤로는 구르지 않는다.
const GND_PITCH_MAX = 10;      // 땅 위의 최대 피치(°)
const GND_TQ_ROLL   = 20;      // 이 토크(%)를 넘기면 굴러가기 시작한다
const GND_CREEP     = 0.02;    // 20% 를 넘긴 토크 1% 당 가속(kt/s) — 40% 면 0.4kt/s
const GND_CYC_ACC   = 0.3;     // 기수를 1° 숙일 때마다 더하는 가속(kt/s) — 10° 면 3kt/s
const GND_DRAG      = 0.04;    // 구름·공기 저항(1/s) — 사이클릭 가운데 · 토크 40% 면 10kt 쯤에서 선다
const GND_BRAKE     = 2;       // 토크를 내렸을 때 서는 감속(kt/s)
const GND_AERO_K    = 2;       // 기수 10° 들고 레버를 내리면 원판이 받는 바람으로 자연 감속의 3배(1+2)
const GND_WHEEL_BRK = 6;       // 스페이스(휠 브레이크)를 누르고 있는 동안의 감속(kt/s)
const GND_PARK_BRK  = 12;      // 파킹 브레이크가 걸린 채 구를 때 끌리며 서는 감속(kt/s)
const GND_EMER_BRK  = 9;       // EMER 브레이크(하부 콘솔 PARKING BRAKE 레버 가운데) — 스페이스(6)와 파킹 SET(12) 사이
let simWheelBrake = false;     // 스페이스를 누르고 있다
let simParkBrake = false;      // PARKING BRAKE SET — 1초 안에 스페이스 두 번
let simParkWarn = 0;           // 파킹 브레이크를 건 채 굴러 내려앉았다 — PFD 경고 남은 시간(s)
let simEmerBrake = false;      // EMER 브레이크 — 하부 콘솔 PARKING BRAKE 레버 EMER(19-lower.js)
function simParkBrakeOn() { return simModeOn && simParkBrake; }
function simEmerBrakeOn() { return simModeOn && simEmerBrake && !simParkBrake; }
function simParkWarnOn() { return simModeOn && simParkWarn > 0; }
let _simSpaceAt = -1e9;
function simSpaceDown(now) {
  simWheelBrake = true;
  if (now - _simSpaceAt <= 1000) {
    simParkBrake = !simParkBrake; _simSpaceAt = -1e9;
    try { uiToast(simParkBrake ? 'PARKING BRAKE SET' : 'PARKING BRAKE RELEASE', simParkBrake ? 'warn' : '', 2000); } catch (e) { _swallow(e); }
    // 하부 콘솔 PARKING BRAKE 레버도 함께(SET · RELEASE)
    try { if (typeof ovhdSet === 'function') ovhdSet('parkBrake', simParkBrake ? 'SET' : 'RELEASE'); } catch (e) { _swallow(e); }
  } else _simSpaceAt = now;
}
function simSpaceUp() { simWheelBrake = false; }
// ── 회전익 특성(3D 창 '회전익 특성') ──
// 로터 회전 방향(위에서 볼 때): CW 시계 · CCW 반시계. 켜면 세 가지 커플링이 붙는다.
//  COLLECTIVE TO YAW  : 호버 토크에서 벗어난 만큼 계속 돈다 — 올리면 로터 반대, 내리면 로터 방향(공중) · 반대 페달로 잡는다(레버 끝까지 = 페달 50%)
//  COLLECTIVE TO PITCH: 레버와 비례해 기수가 최대 ±5° (올리면 들리고 내리면 숙여진다)
//  YAW TO PITCH       : 로터 반대 방향 페달 → 최대 2° 들림 · 로터 방향 페달 → 최대 2° 숙임
const RC_DRIFT_BANK = 3;        // 전이성향 — 호버 편류를 막는 데 드는 뱅크(°)
const RC_YAW_FRAC = 0.15, RC_COLL_PIT = 5, RC_YAW_PIT = 2;
let rotorChar = false, rotorDir = 'CW';
// 회전익 특성의 항목별 켜기/끄기(3D 창 회전익 특성 아래 버튼) — 회전익 특성이 켜져 있을 때만 뜻이 있다
const rcOpt = { etl: true, blowback: true, collPitch: true, collYaw: true, yawPitch: true, spdTq: true, transverse: true };
function rcOn(k) { return rotorChar && !!rcOpt[k]; }
function toggleRcOpt(k) { if (k in rcOpt) { rcOpt[k] = !rcOpt[k]; updateRotorBtns(); } }
function rotorSign() { return rotorDir === 'CW' ? 1 : -1; }   // 로터가 도는 쪽(요 + = 오른쪽)
// 컬렉티브 투 피치를 뺀 나머지(컬렉티브→요 · 요→피치 · 전이성향)는 저속 현상이다 —
// 15kt 부터 줄어 20kt 이상이면 없다
const RC_IGE_FT = 40;           // 전이양력 지대 침하는 지면효과(IGE) 안(이 높이 이내)에서만
const RC_BLOWBACK = 2.5;        // 블로우 백 기수 들림(°) — 전진 10~15kt 에서 다, 8·18kt 에서 0(후진에는 없다)
const RC_BB_KT = [8, 10, 15, 18];
// 블로우 백 크기(0…1) — 전진 대기속도로만
// ase: ASE(SAS) 가 켜져 있으면 SAS 가 잡아 줘 18kt 에서 사라지고, 꺼져 있으면 들린 채 남는다(조종사가 한 번 더 밀어 준다)
function rcBlowbackK(v, ase = true) {
  const [a, b, c, d] = RC_BB_KT;
  if (!ase) { if (!(v > a)) return 0; const x = Math.min(1, (v - a) / (b - a)); return x * x * (3 - 2 * x); }
  if (!(v > a) || v >= d) return 0;
  const sm = x => x * x * (3 - 2 * x);                 // 부드럽게 들고 놓는다(한 번의 들림)
  return v < b ? sm((v - a) / (b - a)) : v <= c ? 1 : sm((d - v) / (d - c));
}
let simBb = 0;                  // 지금 걸린 블로우 백(°)
// 횡류 효과(transverse flow) — 전진 10~20kt 에서 원판 앞쪽은 유도류를 많이, 뒤쪽은 적게 받아
// 앞쪽 양력이 준다. 자이로 세차(90° 늦음)로 옆으로 나타나 한쪽으로 구른다(CCW 로터 → 오른쪽,
// CW 로터 → 왼쪽 · 전이성향 편류와 같은 쪽). 전이양력 지대를 지나면 사라진다.
// ASE(SAS)가 켜져 있으면 대부분 잡아 준다(30% 만 남는다).
const RC_TF_BANK = 2, RC_TF_KT = [8, 12, 18, 24], RC_TF_ASE = 0.3;
function rcTransverseK(v) {
  const [a, b, c, d] = RC_TF_KT;
  if (!(v > a) || v >= d) return 0;
  const sm = x => x * x * (3 - 2 * x);
  return v < b ? sm((v - a) / (b - a)) : v <= c ? 1 : sm((d - v) / (d - c));
}
let simTf = 0;                  // 지금 걸린 횡류 효과 뱅크(°, 오른쪽 +)
const RC_LOW_KT0 = 15, RC_LOW_KT1 = 20;
function rcLowK() { return Math.max(0, Math.min(1, (RC_LOW_KT1 - Math.abs(S.spd)) / (RC_LOW_KT1 - RC_LOW_KT0))); }
function rcPitchOff(a) {
  if (!rotorChar) return 0;
  // 20kt 위(전진 비행)에서는 수평·수직 안정판이 잡아 주므로 셋 다 없다 — 호버 운용에서만
  return ((rcOpt.collPitch ? RC_COLL_PIT * a.coll : 0) - (rcOpt.yawPitch ? RC_YAW_PIT * rotorSign() * a.yaw : 0)) * rcLowK();
}
// COLLECTIVE TO YAW — 컬렉티브가 호버 토크에서 벗어난 만큼 토크 반작용이 남아 동체가 '계속' 돈다
// (올리면 로터 반대 방향, 내리면 로터 방향). 레버를 멈춰도 그치지 않고, 반대 페달로 잡아 줘야 멎는다.
// 레버 전 범위(맨 아래 ~ 맨 위)의 요는 페달 50% 안에서 잡힌다 — 끝까지 올렸을 때의 요율 = 페달 50% 의 요율.
// 조이스틱 페달은 중립 문턱(JOY_AX_DEAD)을 빼고 펴므로, 실제 페달 50% 자리가 내는 값으로 맞춘다(그 자리에서 정확히 잡힌다)
const RC_YAW_PED = (0.5 - JOY_AX_DEAD) / (1 - JOY_AX_DEAD);   // 레버 끝까지 = 페달 50%
let _rcLevPrev = null;
const RC_YAW_DELAY = 0.5;      // 컬렉티브 → 요가 나타나기까지(s)
let _rcYawBuf = [], _rcT = 0;
// 회전익 특성이 쓰는 컬렉티브 변위(−1…1) — 조종사 레버 축이 아니라 '실제로 걸린 컬렉티브'(레버가 요구하는
// 토크 · ALT·CRHT·G/A 등 AFCS 가 몰 때는 AFCS 가 낸 값)를 호버 토크 기준으로 잰다. 레버 축 값을 그대로 쓰면
// 절대값 레버는 켤 때의 자리가 중립이 되어(맨 아래에서 켜면 호버에서도 +1 언저리) 호버에서 기수가 5° 들린 채 남고,
// AFCS 가 컬렉티브를 몰아도 손에 쥔 레버 자리가 피치를 흔들었다(G/A 에서 뒤로 간 원인).
function rcCollDefl() {
  const hov = hoverTqRef(), d = (Number.isFinite(simTqCmd) ? simTqCmd : hov) - hov;   // 이 높이의 호버 토크가 기준(가운데로 돌아오는 레버의 중립과 같다)
  return Math.max(-1, Math.min(1, d > 0 ? d / (SIM_LEVER_TOP - hov) : d / TQ_SPAN));
}
function rcAxes(a) { return { coll: rcCollDefl(), yaw: a.yaw }; }
function rcLeverTq(a) {
  const hov = hoverPowerTq();
  return hov + a.coll * (a.coll > 0 ? SIM_LEVER_TOP - hov : TQ_SPAN);
}
// defl — 호버 토크에서 벗어난 컬렉티브(rcCollDefl, −1 맨 아래 … 0 호버 … +1 맨 위)
function rcYawRate(defl) {
  if (!rcOn('collYaw') || !rcLowK() || !defl) return 0;
  const d = Math.max(-1, Math.min(1, defl));
  return -rotorSign() * RC_YAW_PED * SIM_YAW_RATE * d * rcLowK();
}
function toggleRotorChar() { rotorChar = !rotorChar; updateRotorBtns(); }
function setRotorDir(d) { rotorDir = d === 'CCW' ? 'CCW' : 'CW'; updateRotorBtns(); }
function updateRotorBtns() {
  try {
    const box = document.getElementById('rotor-3d'); if (!box) return;
    box.classList.toggle('on', rotorChar);
    const m = box.querySelector('.rotor-main'); if (m) m.classList.toggle('on', rotorChar);
    box.querySelectorAll('[data-rdir]').forEach(b => {
      b.classList.toggle('on', b.dataset.rdir === rotorDir); b.disabled = !rotorChar;
    });
    box.querySelectorAll('[data-rc]').forEach(b => {
      b.classList.toggle('on', !!rcOpt[b.dataset.rc]); b.disabled = !rotorChar;
    });
  } catch (e) { _swallow(e); }
}
// ── ASE(수리온 계열 자동 안정 장치) ──
// 하부 콘솔 AFCAU 로 켜진다(23-afcs.js afcsGuard) — AP 가 살아 있고 AUTO TRIM(YAW · ROLL · PITCH) · TRIM FEEL(COL · CYC)이
// 모두 켜져 있으면(세 축 모두 SAS 가 아니면) 안정화 · HOVER FOLLOW 가 돈다(종전의 3D 창 ASE 버튼은 없앴다).
//  HOVER FOLLOW — 40kt 이내에서 조종간을 트림에 맞서 쥐고(against trim) 자세를 초당 2° 이내로
//                 천천히 움직이거나 붙잡고 있으면, 트림 기준이 그 자세를 따라온다(trim follow).
//                 그래서 조종간을 놓아도 그 자세가 남는다. 빠르게(2°/s 넘게) 움직이는 동안은 따라오지 않는다.
const ASE_HF_KT = 40, ASE_HF_RATE = 2;
let aseOn = false, aseFollowing = false;
function toggleAse() { aseOn = !aseOn; if (!aseOn) aseFollowing = false; updateAseBtns(); }
function updateAseBtns() {
  try {
    const box = document.getElementById('ase-3d'); if (!box) return;
    const m = box.querySelector('.ase-main'); if (m) m.classList.toggle('on', aseOn);
    const hf = box.querySelector('.ase-hf');
    if (hf) { hf.classList.toggle('avail', aseOn); hf.classList.toggle('on', aseOn && aseFollowing); }
  } catch (e) { _swallow(e); }
}
function aseHoverFollow(a, onGnd, rollRate, pitRate) {
  const was = aseFollowing;
  aseFollowing = false;
  if (aseOn && simModeOn && !onGnd && Math.abs(S.spd) < ASE_HF_KT) {
    const axes = [
      // 블로우 백·횡류 효과 몫은 트림에 넣지 않는다(넣으면 그 위에 또 얹힌다 — FORCE TRIM 과 같다)
      ['roll', a.roll, rollRate, !simAfcsLat(), S.bnk - (simTf || 0), SIM_TRIM_MAX_ROLL],
      ['pitch', a.pitch, pitRate, !simAfcsPitch(), -(S.pit - rcPitchOff(rcAxes(a)) - (simBb || 0)), SIM_TRIM_MAX_PITCH],
    ];
    for (const [k, stick, rate, free, att, max] of axes) {
      if (!free || Math.abs(stick) <= SIM_TRIM_HOLD_DEAD || simTrimHeld[k] === null) continue;
      if (Math.abs(rate) > ASE_HF_RATE) continue;
      // 쥐고 있는 동안은 종전 트림을 붙잡아 두므로(against trim) 자세는 그대로 — 기준만 지금 자세로 옮긴다
      simTrim[k] = Math.max(-max, Math.min(max, att));
      simTrimAct[k] = simTrim[k]; _simTrimSlewing[k] = false;
      aseFollowing = true;
    }
  }
  if (was !== aseFollowing) updateAseBtns();
}
let simLow = false;            // LIGHT ON WHEELS — 바퀴가 떨어지기 직전(HOV−20%…HOV−10%)
function simLightOnWheels() { return simModeOn && simLow; }
const SIM_PITCH_RATE = 12;     // 피치가 따라가는 빠르기(°/s) — 조종간(against trim) 피치 반응 2배(종전 6)
const SIM_YAW_RATE  = 25;      // 페달 최대 요율(°/s)
const SIM_YAW_TAU = 0.8;       // 페달에 요율이 따라붙는 시간(s) — 종전 1.0 에서 20% 빠르게
let simYawRate = 0;
let simSkidHalf = 0;           // 볼을 선회 바깥쪽으로 비키는 몫(1 = 반 볼) — 03-pfd.js drawSlipBall
// ── 저속의 옆미끄럼(측방 비행) ──
// 헬기는 속도가 낮을 때 뱅크를 주면 선회하지 않고 '옆으로 간다'. 속도가
// 붙을수록 그 성분은 사라지고 보통의 선회가 된다.
const SIDE_FADE_KT = 45;      // 이 속도부터는 옆으로 가지 않고 선회만 한다
const SIDE_MAX_KT  = 35;      // 최대 뱅크에서의 옆방향 속도(kt)
const SIDE_K       = 0.5;     // 옆방향 속도가 따라가는 빠르기(1/s)
// ── 상위모드가 잡은 축 ──
// SIM 모드에서도 상위모드를 걸면 그 축은 AFCS 가 몬다. 조종간의 그 축 값은 무시한다.
//   좌우(뱅크)·페달: HDG SEL · NAV (GSPD 가 걸려 있으면 GSPD 가 우선이다)
//   컬렉티브(고도): ALT(선택 고도로 가는 것 포함) · CRHT
//   전후(기수 자세): IAS — 조종간 몫은 그 위에 얹는다(fly-through)
function simAfcsLat() {
  return simModeOn && !gspdOn && !gspdCoasting && (navApOn || (hdgSelOn && rollApOn));
}
// 상위모드가 하나라도 걸려 있는가 — 그때는 AFCS 가 협조 선회로 잡아 볼이 가운데다(내활·외활 없음)
function simAfcsAny() {
  return simModeOn && !!(hdgSelOn || navApOn || altHoldOn || crhtOn || simIasOn || gspdOn || gsOn ||
    (typeof holdOn !== 'undefined' && holdOn));
}
function simAfcsVert() { return simModeOn && (altHoldOn || crhtOn || (gsOn && !!_simGs()) || gaOn || vsModeOn || tdOn); }
// ── G/A(복행) ── FCP 의 G/A 버튼. 누르면 컬렉티브·피치 축이 GA 가 되어 두 단계로 간다.
//   ① 가속(40kt 미만에서 눌렀을 때): 기수를 지금 자세에서 7.5° 숙여 증속하고, 컬렉티브는 고도가 떨어지지 않게 쓴다
//      (누른 고도 아래로 내려가지 않는다 · 아직 오르지는 않는다)
//   ② 상승(40kt 를 넘으면 · 40kt 넘어서 눌렀으면 곧바로): 선택 상승률(selVS, 기본 1,000fpm · VS ▲▼ 로 300fpm 까지)로
//      오르고(처음 GA_VS_RAMP 초에 걸쳐 · 속도가 붙을수록 몫을 늘린다), 속도는 Vy 로 수렴한다
//      목표 = Vy(지금이 Vy 보다 느리면) · 지금 속도(Vy~VNE) · VNE(VNE 를 넘으면) — IAS 기준
// 목표 속도에 닿고 상승률이 다 붙으면 컬렉티브는 VS(그 상승률로 계속 상승), 피치는 IAS(목표 속도)로 넘어간다.
// 롤 축은 붙이지 않는다 — 뱅크가 있었으면 그대로 간다(HDG 는 조종사가 건다).
const GA_DUR_FWD = 17, GA_P2_KT = 40, GA_PITCH_DN = 7.5, GA_VS_DEF = 1000, GA_VS_MIN = 300, GA_VS_RAMP = 8;
let gaOn = false, vsModeOn = false, _gaT = 0, _gaDur = GA_DUR_FWD, _gaSpd0 = 0, _gaSpdTgt = 0;
let _gaPhase = 2, _gaPitchTgt = 0, _gaAlt0 = 0, _gaRamp = true;
function gaTarget(spd = S.spd) {
  const vy = simVyKt(), vne = simVne();
  return spd < vy ? vy : spd <= vne ? spd : vne;
}
// 속도 우선 — 목표 속도에 얼마나 다가갔는가(0→1)에 따라 상승률 몫을 준다.
// 처음에는 출력을 가속에 먼저 쓰고(상승은 GA_VS_SHARE0 만큼), 속도가 붙을수록 상승을 늘린다.
const GA_VS_SHARE0 = 0.15;
function gaSpdShare() {
  const span = _gaSpdTgt - _gaSpd0;
  if (!(span > 5)) return 1;                       // 이미 목표 속도 언저리 — 상승을 다 준다
  const p = Math.max(0, Math.min(1, (S.spd - _gaSpd0) / span));
  return GA_VS_SHARE0 + (1 - GA_VS_SHARE0) * p * p * (3 - 2 * p);
}
// ② 상승 단계로 — fromAccel 이면 ① 에서 넘어온 것(기수가 이미 숙여져 있어 속도 기준을 목표로 곧바로 둔다)
function _gaClimb(fromAccel) {
  _gaPhase = 2; _gaT = 0;
  _gaSpd0 = Math.max(0, S.spd); _gaSpdTgt = gaTarget(_gaSpd0);
  _gaRamp = !fromAccel; _gaDur = GA_DUR_FWD;
  selSpd = fromAccel ? _gaSpdTgt : _gaSpd0;
}
function gaEngage() {
  if (!simModeOn) { try { uiToast('G/A 는 SIM 모드에서 씁니다', '', 2000); } catch (e) { _swallow(e); } return; }
  try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
  try { if (gsOn || gsArmed) toggleGs(); } catch (e) { _swallow(e); }
  altHoldOn = false; crhtOn = false;
  selVS = GA_VS_DEF;
  _gaAlt0 = S.alt; _gaT = 0;
  simIasOn = true;
  if (S.spd < GA_P2_KT) {
    // ① 기수를 7.5° 숙인 자세 — IAS 가 그 자세를 내는 속도를 기준으로 삼아 그 자세로 간다
    _gaPhase = 1; _gaPitchTgt = S.pit - GA_PITCH_DN;
    _gaSpd0 = Math.max(0, S.spd); _gaSpdTgt = gaTarget(GA_P2_KT);
    selSpd = Math.max(_gaSpd0, spdFromPitch(_gaPitchTgt));
  } else _gaClimb(false);
  gaOn = true; vsModeOn = false; tdOn = false;
  updateGaBtn();
  try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); }
}
function gaRelease() { gaOn = false; vsModeOn = false; try { tdownRelease(); } catch (e) { _swallow(e); } updateGaBtn(); }
function updateGaBtn() {
  const b = document.getElementById('ga-btn'); if (b) b.classList.toggle('on', gaOn);
  const t = document.getElementById('tdh-btn'); if (t) t.classList.toggle('on', typeof tdOn !== 'undefined' && tdOn);
}
// simFly 가 구간마다 부른다 — ① 가속 자세를 지키다 40kt 를 넘으면 ② 로, ② 는 속도 기준을 목표로 옮기고 다 되면 VS · IAS 로 넘긴다
function gaStep(dt) {
  if (!gaOn) return;
  if (!simIasOn || altHoldOn || crhtOn) { gaOn = false; if (!altHoldOn && !crhtOn) vsModeOn = true; updateGaBtn(); return; }  // 조종사가 축을 가져갔다
  if (_gaPhase === 1) {
    selSpd = Math.max(selSpd, spdFromPitch(_gaPitchTgt));
    if (S.spd >= GA_P2_KT) _gaClimb(true);
    return;
  }
  _gaT += dt;
  if (_gaRamp) {
    const x = Math.min(1, _gaT / _gaDur), k = x * x * (3 - 2 * x);   // 점점 붙고 점점 풀린다
    selSpd = _gaSpd0 + (_gaSpdTgt - _gaSpd0) * k;
  } else selSpd = _gaSpdTgt;
  const spdOk = _gaRamp ? _gaT >= _gaDur : Math.abs(S.spd - _gaSpdTgt) < 3;
  if (spdOk && _gaT >= GA_VS_RAMP) { gaOn = false; vsModeOn = true; selSpd = _gaSpdTgt; updateGaBtn(); }
}
// G/A 가 원하는 상승률(fpm) — ① 은 누른 고도 아래로 가지 않게만(오르지 않는다), ② 는 선택 상승률(점점 · 속도 우선).
// 어느 단계든 누른 고도 아래로는 내려가지 않는다
function gaVsCmd() {
  const ahead = S.alt + (S.vs || 0) / 60 * SIM_AFCS_LEAD;
  const floor = Math.max(0, Math.min(500, (_gaAlt0 - ahead) * SIM_AFCS_ALT_K));
  if (_gaPhase === 1) return floor;
  const r = Math.max(GA_VS_MIN, selVS);
  return Math.max(floor, r * Math.min(1, _gaT / GA_VS_RAMP) * gaSpdShare());
}
// ── TDOWN(제원 변경) ── FCP 의 TDOWN 버튼. 누르면 속도 80kt · 전파고도 200ft 로 기준만 바꾼다
//   (IAS 80 · CRHT 200 을 건다 — FMA 는 CRHT · IAS). SIM 밖에서도 같은 기준으로 간다.
const TDN_SPD = 80, TDN_AGL = 200;
function tdownSet() {
  try { if (tdOn) tdownRelease(); } catch (e) { _swallow(e); }
  try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
  gaOn = false; vsModeOn = false;
  selSpd = TDN_SPD;
  if (simModeOn) simIasOn = true;
  selCrht = TDN_AGL; crhtOn = true; altHoldOn = false;
  updateGaBtn();
  try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); }
  const b = document.getElementById('tdown-btn');
  if (b) { b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 600); }
}
// ── T/D to H(호버로 전환 강하) ── FCP 의 T/D to H 버튼(TDOWN 아래). 50kt 이상 · 전파고도 200ft 이상에서 건다.
//   · 지금 자리에서 3° 강하각으로 내려가 HHT(전파고도 기준 호버 높이)에 닿는다.
//   · 속도는 0 으로 모은다 — 남은 높이에 맞춰 v = v0·√(h/h0)(일정 감속)로 기준을 줄이고,
//     강하율은 지상속도 × tan3° 로 낸다. 그래서 속도와 높이가 같은 3° 선 위에서 함께 0·HHT 로 간다.
//   · 속도·3° 강하 모두 지상속도 기준(바람이 있어도 땅 위의 한 점으로 내려간다).
//   · 다 내려오면 GSPD 0kt + CRHT(HHT) 로 넘긴다 — 바람이 불어도 그 자리에서 호버한다(FMA CRHT · GS · GS).
//   · 롤 축은 HDG·NAV 그대로 몬다. 45kt 밑으로 줄면 FMA 가 황색(성능 감소 주의),
//     30kt 밑이면 롤 축을 놓는다(decouple) — 그 뒤 HDG·NAV 를 다시 거는 것은 조종사 몫.
const TD_MIN_KT = 50, TD_MIN_AGL = 200, TD_ANG = 3, TD_AMBER_KT = 45, TD_DECPL_KT = 30;
let tdOn = false, _tdV0 = 0, _tdH0 = 1, _tdDecpl = false, _tdDone = false;
function tdownAvail() { return simModeOn && S.spd >= TD_MIN_KT && radarAltFt() >= TD_MIN_AGL; }
function tdhEngage() {
  if (tdOn) { tdownRelease(); return; }
  if (!simModeOn) { try { uiToast('T/D to H 는 SIM 모드에서 씁니다', '', 2000); } catch (e) { _swallow(e); } return; }
  const ra = radarAltFt();
  if (S.spd < TD_MIN_KT || ra < TD_MIN_AGL || ra <= selHht + 10) {
    const why = S.spd < TD_MIN_KT ? `속도 ${TD_MIN_KT}kt 이상` : ra < TD_MIN_AGL ? `전파고도 ${TD_MIN_AGL}ft 이상` : 'HHT 보다 높은 곳';
    try { uiToast(`T/D to H 조건 — ${why}에서 걸 수 있습니다`, '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
  gsOn = false; gsArmed = false; try { gsAutoLatch(); updateGsBtn(); } catch (e) { _swallow(e); }
  altHoldOn = false; crhtOn = false; gaOn = false; vsModeOn = false;
  _tdV0 = Math.max(0, tdGsFwd()); _tdH0 = Math.max(1, ra - selHht); _tdDecpl = false; _tdDone = false;
  simIasOn = true; selSpd = S.spd;
  tdOn = true;
  updateGaBtn();
  try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); }
}
function tdownRelease() { tdOn = false; _tdDone = false; updateGaBtn(); }
// 기수 방향 지상속도(kt) — 진대기속도(TAS)에서 맞바람 몫을 뺀다. T/D to H 는 땅 위에 멈춰야 하므로
// 속도 프로파일과 3° 강하를 모두 이 지상속도로 잡는다(대기속도로 잡으면 맞바람에서는 땅 위로 0 이 되어도
// 대기속도가 남아 강하가 멎고, 끝나면 바람에 실려 흘러간다).
function tdGsFwd() { const w = simWindRel(); return tasKt(S.spd) - w.fwd; }
// 그 지상속도를 내는 계기속도(IAS) — 맞바람 몫을 더하고 TAS → IAS 로 되돌린다
function tdIasForGs(vg) { const w = simWindRel(); return (vg + w.fwd) / tasRatio(); }
// 지금 남은 높이(HHT 위 · ft)
function _tdH() { return radarAltFt() - selHht; }
function tdStep(dt) {
  if (!tdOn) return;
  if (!simModeOn || !simIasOn || altHoldOn || crhtOn || gspdOn || gaOn) { tdOn = false; updateGaBtn(); return; }   // 조종사가 축을 가져갔다
  const h = _tdH();
  // 남은 높이에 맞춰 지상속도 기준을 줄인다(일정 감속 · √) → 그 지상속도를 내는 IAS 를 기준으로
  const vg = _tdV0 * Math.sqrt(Math.max(0, Math.min(1, h / _tdH0)));
  selSpd = Math.max(0, tdIasForGs(vg));
  if (h < 3 || vg < 3) {
    // 다 내려왔다 — 땅 위 제자리 호버로 넘긴다: GSPD 0kt(바람이 있어도 제자리) + CRHT = HHT(전파고도)
    tdOn = false; _tdDone = false;
    selCrht = selHht; crhtOn = true; altHoldOn = false;
    try { if (!gspdOn) toggleGspd(); gspdRefFwd = 0; gspdRefLat = 0; } catch (e) { _swallow(e); }
    updateGaBtn();
    try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); }
    return;
  }
  // 30kt 밑 — 롤 축을 놓는다(한 번만 · 다시 거는 것은 조종사 몫)
  if (!_tdDecpl && S.spd < TD_DECPL_KT) {
    _tdDecpl = true;
    try {
      if (navApOn) { navApOn = false; try { if (holdOn) holdExit(); } catch (e) { _swallow(e); }
                     const b = document.getElementById('nav-ap-btn'); if (b) b.classList.remove('on'); }
      if (hdgSelOn || rollApOn) simAfcsLatRelease();
      updateApInhibit();
    } catch (e) { _swallow(e); }
  }
}
// T/DOWN 이 원하는 상승률(fpm, 내려가면 −)
function _tdVsCmd() {
  const h = _tdH();
  const base = Math.max(0, tdGsFwd()) * Math.tan(TD_ANG * D2R) * FT_PER_NM / 60;   // 3° 선의 강하율(지상속도 기준)
  return -Math.min(1500, Math.max(base, Math.min(150, h * 3)));
}
// FMA 롤 축 — 45kt 밑이면 황색(성능 감소)
function tdRollAmber() { return tdOn && !_tdDecpl && S.spd < TD_AMBER_KT; }
// G/S 를 잡고 있으면 강하선(gsDeviation)이 고도를 정한다 — ALT·CRHT 보다 앞선다
function _simGs() { try { return gsOn ? gsDeviation() : null; } catch (e) { return null; } }
// ALT·CRHT 가 원하는 상승률(fpm) — 목표 고도까지 남은 높이에 비례하고, ALT 는 선택
// 상승률(selVS) · CRHT 는 500fpm 을 넘지 않는다. 고도가 빠지면 그만큼 올리려 한다.
// 상승률은 출력을 따라 천천히 붙으므로, 지금 상승률로 조금 뒤(SIM_AFCS_LEAD) 닿을
// 고도를 보고 정한다 — 그래야 되찾을 때 넘치거나 출렁이지 않는다.
const SIM_AFCS_ALT_K = 10;     // 1ft 어긋날 때마다 원하는 상승률(fpm)
const SIM_AFCS_LEAD  = 2;      // 앞을 내다보는 시간(s)
function simAfcsVsCmd() {
  // G/A · VS — 선택 상승률로 오른다(G/A 처음 몇 초는 점점 붙인다 · 내려가지는 않는다)
  if (tdOn) return _tdVsCmd();
  if ((gaOn || vsModeOn) && !altHoldOn && !crhtOn && !(gsOn && _simGs())) {
    return gaOn ? gaVsCmd() : Math.max(GA_VS_MIN, selVS);
  }
  // CRHT 는 전파고도(AGL)를 지킨다 — 기압고도로 바꾸면 '발밑 땅 + 선택 높이'
  const g = _simGs();
  if (g) {
    // 강하각과 지상속도가 내는 기본 강하율(3°·120kt ≈ 640fpm)에, 강하선에서 벗어난 만큼을 얹는다
    const gsKt = Math.max(20, groundSpdKt());
    const base = gsKt * Math.tan(g.angle * D2R) * FT_PER_NM / 60;
    const ahead = S.alt + (S.vs || 0) / 60 * SIM_AFCS_LEAD;
    const corr = Math.max(-400, Math.min(400, (g.path - ahead) * 0.5));
    return Math.max(-2000, Math.min(500, -base + corr));
  }
  const tgt = altHoldOn ? selAlt : selCrht + radarGroundFt();
  const rate = altHoldOn ? Math.max(50, Math.abs(selVS)) : 500;
  const ahead = S.alt + (S.vs || 0) / 60 * SIM_AFCS_LEAD;
  return Math.max(-rate, Math.min(rate, (tgt - ahead) * SIM_AFCS_ALT_K));
}
// GSPD 가 걸려 있으면 GSPD 가 자세와 속도를 맡는다
function simAfcsPitch() { return simModeOn && simIasOn && !gspdOn; }
// HDG SEL 을 손으로 넘겨 받는다(좌우 트림을 누를 때) — 지금 뱅크를 트림으로 잡아
// 두어 놓는 순간 자세가 튀지 않게 한다(조종간이 가운데가 아니면 그 몫은 뺀다).
function simAfcsLatRelease() {
  hdgSelOn = false; rollApOn = false;
  const r = simModeAxes().roll * SIM_BANK_MAX;
  simTrim.roll = Math.max(-SIM_TRIM_MAX_ROLL, Math.min(SIM_TRIM_MAX_ROLL, Math.round(S.bnk - r)));
  bankTarget = S.bnk;
}

// 지금 속도에서 뱅크가 '선회' 로 쓰이는 몫(0=전부 옆미끄럼, 1=전부 선회)
// HDG·NAV 가 뱅크를 잡고 있으면 평소처럼 선회만 한다(옆으로 미끄러지면 기수를 못 돌린다).
function simTurnFrac() {
  if (!simModeOn || simAfcsLat()) return 1;
  return Math.max(0, Math.min(1, Math.abs(S.spd) / SIDE_FADE_KT));
}
const SIM_SPD_MAX   = 160;     // 최대 대기속도(kt)
const SIM_SPD_BACK  = -40;     // 후방 비행 한계(kt) — 헬기는 뒤로도 난다
// ── 공력적 지연 ──
// 자세나 출력을 바꿔도 속도·고도는 곧바로 따라오지 않는다. 로터 원판이 기울어
// 힘이 생기고, 그 힘이 기체 무게를 밀어 움직이기까지 시간이 걸린다.
//   속도: 가감속(simAcc)이 정해진 빠르기(SPD_JERK)로 점점 커진다 — 기수를 숙이거나
//         들면 처음엔 느리게, 갈수록 빠르게 속도가 바뀐다(가속이 오래 커지도록 한계를
//         넉넉히 두고 천천히 키운다 — 한계에 금방 닿아 '일정한 빠르기' 로 바뀌지 않게).
//         목표 속도가 가까워져서야 짧게 풀어 넘치지 않는다(푸는 쪽은 세 배 빠르다).
//         감속은 가속보다 빨리 붙고 세다(1초에 6kt/s 씩 · 최대 15kt/s).
//         가속은 속도가 붙을수록(전이양력으로 출력이 남을수록) 세진다.
//   고도: 상승률도 같은 식이다 — 레버를 움직이면 오르내림이 점점 빨라지며 붙는다.
const SPD_JERK = 6.0;   // 자세에 따른 증감속 — 종전보다 50% 빠르게
const SPD_ACC_UP0 = 3.75;   // 자세에 따른 증감속 — 종전보다 50% 빠르게
const SPD_ACC_UP = 7.5;   // 자세에 따른 증감속 — 종전보다 50% 빠르게
const SPD_ETL_KT   = 40;      // 가속이 다 세지는 속도(kt)
const SPD_DEC_JERK = 18.0;   // 자세에 따른 증감속 — 종전보다 50% 빠르게
const SPD_DEC_MAX = 11.25;   // 자세에 따른 증감속 — 종전보다 50% 빠르게
// 감속·강하율 감소에 걸리는 시간 배율 — 2 면 같은 변화에 두 배 걸린다(오토로테이션·접근 감속이 너무 빨랐다).
// 시간을 T 배로 늘리려면 최대 감속은 1/T, 그것이 붙는 빠르기(저크)는 1/T² 로 줄인다.
const SIM_DEC_TIME = 2.4;   // 2 → 2.4(그 120%)
// 상승·강하율이 바뀌는 빠르기 — 변화의 빠르기가 일정하게 커져(저크) 바뀐 양이 시간의 제곱으로 는다.
// 종전보다 저크 4배 · 한계 5배(레버에 상승률이 훨씬 빨리 붙는다). 차차 맞춰 간다
// 피치로 바뀌는 상승·강하(감속·가속이 돌려주는 운동에너지 몫)는 가감속 저크를 4배(가속 8 · 감속 24kt/s²)로 해 4배 빨리 붙는다
const VS_JERK      = 500;   // 속도·상승률 변화 빠르기를 종전의 반으로     // 상승률의 변화가 커지는 빠르기(fpm/s²)
// 조종(컬렉티브·사이클릭)에 따른 속도·고도 변화 빠르기 배율 — 종전보다 10% 느리게
const SIM_RATE_K   = 0.9;
const VS_ACC_MAX   = 1250;   // 속도·상승률 변화 빠르기를 종전의 반으로     // 상승률이 바뀌는 최대 빠르기(fpm/s)
const VS_IGE_TAU   = 0.3;     // 지면효과 안(땅 가까이)에서 상승률이 토크를 따라가는 시간(s)
const TQ_TAU       = 0.25;    // 토크가 레버를 따라가는 시간(s) — 엔진·거버너 지연(처음 0.5 의 반 = 2배 빠르게)
// 레버를 급히 올리면 엔진이 따라붙는 동안 모자란 몫을 로터 회전이 내줘 NR 이 잠깐 처지고,
// 급히 내리면 잠깐 넘친다 — 엔진 토크가 레버를 따라잡는 만큼 돌아온다.
const NR_GOV_DROOP = 0.2, NR_GOV_RISE = 0.1;   // 토크 지연 1% 당 NR(%)
// ── 남는 토크 → 상승률 ──
// 상승률 = 남는 동력 ÷ 무게 — 남는 토크(레버 토크 − 그 속도의 필요 토크, tqRequired)에 곧게 비례한다.
// 속도에 따른 차이는 필요 동력 곡선(U 자 · 01-state.js)이 이미 담는다: 100% 에서 제자리(77%)는 약
// 1,000fpm, Vy(약 48%)는 약 2,300fpm. 강하 쪽은 조금 덜 가파르다 — 레버를 다 내린 오토로테이션
// 강하율이 Vy 언저리에서 가장 작고(≈1,800fpm) 제자리·고속에서 커진다.
const CLIMB_REF_TQ    = 100;   // 상승 성능을 견주는 토크(%)
const CLIMB_FPM_UP = 44;       // 남는 토크 1% 당 상승률(fpm)
const CLIMB_FPM_DN = 38;       // 모자란 토크 1% 당 강하율(fpm)
// 상승·강하율의 한계(fpm). 기수를 숙인 채 레버를 끝까지 내리면 4,000fpm 까지 떨어지고,
// 토크를 100% 넘게(MTA 까지) 당기면 3,000fpm 까지 오른다(100% 에서는 위의 Vy 2,300fpm).
const SIM_VS_UP_MAX = 3000, SIM_VS_DN_MAX = 4000;
// ── 컬렉티브 레버와 그날의 MTA ──
// 레버 맨 위는 토크 140% 다. 하지만 엔진이 낼 수 있는 토크는 그날의 MTA(CDU PERF 의
// MTA(30) — 고도·온도로 정해진다 · mtaNow)까지다. 그보다 더 당기면 토크는 MTA 에
// 멈추고, 모자란 힘을 로터 회전(NR)이 내주며 처진다(RPM LOW). 양력은 NR² 로 줄어
// 오르던 힘이 빠지고 가라앉는다 — 더 당길수록 NR 이 더 처지고 더 빨리 가라앉는다.
// 레버를 MTA 아래로 내리면 NR 이 돌아온다.
const SIM_LEVER_TOP = 140;     // 레버 맨 위의 토크(%)
const SIM_NR_DROOP  = 0.6;     // MTA 를 1% 넘길 때마다 처지는 NR(%)
const SIM_NR_MIN    = 85;      // NR 이 처지는 바닥(%)
const SIM_NR_LOW    = 97;      // 이 아래면 RPM LOW
const NR_TAU_DN     = 1.0;     // NR 이 처지는 시간(s)
const NR_TAU_UP     = 1.5;     // NR 이 돌아오는 시간(s)
const SIM_NR_SINK   = 40000;   // 양력이 다(100%) 모자랄 때의 강하율(fpm) — 2% 모자라면 800fpm
let simNr = 100;               // 로터 회전(NR, %)
let _simNrGov = 0;             // 계기 NR 가운데 거버너 지연 몫(%)
let _simTrTqF = 0;             // 상승률 셈에 쓰는 꼬리로터 토크(엔진 토크처럼 TQ_TAU 로 따라간다)
let simTqCmd = 0;              // 레버가 요구하는 토크(%) — MTA 를 넘어도 그대로(계기의 레버 표식)
function simRpmLow() { return simModeOn && simNr < SIM_NR_LOW; }
// ── 엔진(쌍발) ── 2: 두 엔진(AEO) · 1: 한 엔진 고장(OEI) · 0: 두 엔진 IDLE(동력 없는 오토로테이션 연습)
// OEI 는 남은 엔진 하나가 2.5분 정격(AEO MTA 의 73%)을 내다가 그 뒤로는 연속 정격(64%)까지 낸다.
const OEI_25_FRAC = 0.73, OEI_CONT_FRAC = 0.64, OEI_25_SEC = 150;
let simEng = 2, simOeiT = 0;
// OEI 일 때 멎은(또는 훈련으로 줄인) 엔진 번호 · 상부 콘솔 TRAINING 스위치로 든 훈련인가
let simEngFail = 2, simEngTrng = false;
// ── 엔진마다의 상태 ── 'FLY'(출력을 낸다) · 'IDLE' · 'TRNG'(훈련으로 줄임 — IDLE 로 보인다) · 'OFF'(멎음)
// 상부 콘솔(17-upper.js)의 조작으로 정한다:
//   TQS PCD — OFF · IDLE · FLY        · FUEL CLOSE · T HANDLE ARM → 그 엔진 OFF
//   TRAINING NO1/NO2 ENG TRNG — 한쪽만 올리면 그 엔진을 줄인 OEI 훈련(둘 다면 걸리지 않는다)
//   3D 의 ENG 버튼 — AEO · OEI(2번 고장) · IDLE(두 엔진)
// 출력을 내는 엔진 수가 simEng(2 AEO · 1 OEI · 0 동력 없음)다 — 남은 엔진은 2.5분 → 연속 정격까지.
const simEngSt = { 1: 'FLY', 2: 'FLY' };
let _simEngBtn = 2;
function simEngApply(quiet) {
  const g = id => { try { return typeof ovhdGet === 'function' ? ovhdGet(id) : undefined; } catch (e) { return undefined; } };
  const prev = { eng: simEng, s1: simEngSt[1], s2: simEngSt[2], trng: simEngTrng ? simEngFail : 0 };
  const st = {};
  [1, 2].forEach(n => {
    const pcd = g('pcd' + n), fire = g('fire' + n);
    let v = pcd === 'OFF' ? 'OFF' : pcd === 'IDLE' ? 'IDLE' : 'FLY';
    if (g('fuel' + n) === 'CLOSE' || fire === 'ARM') v = 'OFF';            // FUEL CLOSE · T HANDLE ARM → 연료가 끊긴다
    st[n] = v;
  });
  if (_simEngBtn === 1) st[2] = 'OFF';                                   // ENG 버튼 OEI — 2번 고장
  if (_simEngBtn === 0) [1, 2].forEach(n => { if (st[n] === 'FLY') st[n] = 'IDLE'; });
  const t1 = g('trng1') === 'TRNG', t2 = g('trng2') === 'TRNG';
  const tn = (t1 && !t2) ? 1 : (t2 && !t1) ? 2 : 0;
  let trng = false;
  if (tn && st[1] === 'FLY' && st[2] === 'FLY') { st[tn] = 'TRNG'; trng = true; }   // 훈련은 두 엔진이 다 돌 때만
  simEngSt[1] = st[1]; simEngSt[2] = st[2];
  simEng = (st[1] === 'FLY' ? 1 : 0) + (st[2] === 'FLY' ? 1 : 0);
  simEngTrng = trng;
  simEngFail = simEng === 1 ? (st[1] === 'FLY' ? 2 : 1) : 2;
  if (simEng !== prev.eng || (trng ? simEngFail : 0) !== prev.trng) simOeiT = 0;
  updateEngBtn();
  if (quiet) return;
  const changed = simEng !== prev.eng || st[1] !== prev.s1 || st[2] !== prev.s2;
  let msg = null, kind = 'err';
  if (t1 && t2 && !changed) msg = 'TRNG 두 스위치가 다 올라가 있어 훈련이 걸리지 않습니다(AEO)';
  else if (changed) {
    if (trng) msg = `ENG ${simEngFail} TRNG — OEI 훈련(ENG ${simEngFail === 1 ? 2 : 1} 이 2.5분 정격)`;
    else if (simEng === 2) { msg = '두 엔진 정상(AEO)'; kind = ''; }
    else if (simEng === 1) msg = `ENG ${simEngFail} ${st[simEngFail]} — OEI(2.5분 정격)`;
    else msg = (st[1] === 'OFF' && st[2] === 'OFF') ? '두 엔진 OFF — 동력 없는 오토로테이션' : '두 엔진 IDLE — 동력 없는 오토로테이션';
  }
  if (msg) { try { uiToast(msg, kind, 2500); } catch (e) { _swallow(e); } }
}
// 종전 이름(TRAINING 연동) — 이제는 모든 엔진 조작을 한 번에 본다
function simTrngApply(quiet) { simEngApply(quiet); }
function simEngAvail() {
  const m = mtaNow();
  if (simEng >= 2) return m;
  if (simEng === 1) return m * (simOeiT < OEI_25_SEC ? OEI_25_FRAC : OEI_CONT_FRAC);
  return 0;
}
function cycleSimEng() {
  _simEngBtn = _simEngBtn === 2 ? 1 : _simEngBtn === 1 ? 0 : 2;
  simEngApply();
}
// 엔진 상태 이름 — AEO · OEI · ENGn TRNG · ENG OFF · ENG IDLE (3D 창의 ENG 버튼은 없앴다 — 상부 콘솔 TQS · 레버로 정한다)
function engStateLabel() {
  return simEng === 2 ? 'ENG AEO' : simEng === 1 ? (simEngTrng ? `ENG${simEngFail} TRNG` : 'ENG OEI')
       : (simEngSt[1] === 'OFF' && simEngSt[2] === 'OFF') ? 'ENG OFF' : 'ENG IDLE';
}
function updateEngBtn() {
  try {
    const b = document.getElementById('eng-3d'); if (!b) return;
    b.textContent = engStateLabel();
    b.classList.toggle('warn', simEng === 1); b.classList.toggle('fail', simEng === 0);
  } catch (e) { _swallow(e); }
}
// ── 로터 회전(NR) — 오토로테이션 ──
// 엔진이 레버가 요구하는 만큼(D)을 다 내면 거버너가 NR 100% 를 지킨다. 모자란 몫(U = D − 엔진)은
// 로터가 낸다 — 강하가 붙기 전(수평)에는 NR 이 U 만큼 처지고, 오토로테이션 강하가 자리 잡을수록
// (wA) 흘러드는 바람이 로터를 돌린다. 레버를 AUTO_LREF(12%) 에 두면 100%, 다 내리면 넘친다(ROTOR HIGH),
// 올리면 처진다. 플레어(감속)는 NR 을 올리고, 처지는 NR 의 운동에너지는 잠깐 양력으로 쓰인다(쿠션).
const NR_AUTO_K = 0.6, AUTO_LREF = 12, NR_FLARE_K = 1.0, NR_FLOOR = 60;
// NR 경고 띠(NR_HIGH 등)는 01-state.js — PFD 가 이 파일보다 먼저 그려질 수 있다
// ── 자동회전 비행 RPM 수정표(붙임 2) ── 컬렉티브 최하단 · 75KIAS 에서 자리 잡는 NR(%).
// 총중량(1,000lb) 12~20 · 밀도고도 −6,000~16,000ft. 표 그림에서 곡선을 읽은 값(−6~8,000ft · 2,000ft 마다),
// 그 위는 같은 그림에 맞춘 식 NR = e^3.6998 · GW^0.3311 · σ^−0.3384 (σ 밀도비 · 최대 오차 2%)를 표와 이어 쓴다.
const AUTO_NR_DA = [-6, -4, -2, 0, 2, 4, 6, 8];
const AUTO_NR_TBL = [            // 행: 밀도고도(1,000ft) · 열: GW 12,13,…,20
  [88.6, 90.3, 92.1, 93.8, 95.6, 97.3, 99.1, 100.9, 102.7],
  [89.7, 91.6, 93.4, 95.3, 97.1, 99.0, 100.8, 102.7, 104.6],
  [91.0, 93.0, 95.0, 97.0, 98.9, 100.9, 102.8, 104.8, 106.8],
  [92.5, 94.5, 96.6, 98.7, 100.8, 102.8, 104.9, 107.1, 109.1],
  [94.0, 96.2, 98.4, 100.6, 102.8, 105.0, 107.2, 109.5, 111.7],
  [95.6, 98.0, 100.3, 102.6, 105.0, 107.3, 109.7, 112.1, 114.4],
  [97.4, 99.8, 102.3, 104.8, 107.3, 109.8, 112.3, 114.8, null],
  [99.3, 101.9, 104.6, 107.2, 109.9, 112.5, 115.1, 117.9, null],
];
function _autoNrFit(gw, da) {          // gw: 1,000lb · da: 1,000ft
  const sig = Math.pow(Math.max(0.3, 1 - 6.8756e-3 * da), 4.2559);
  return Math.exp(3.6998) * Math.pow(gw, 0.3311) * Math.pow(sig, -0.3384);
}
function _autoNrTbl(gw, da) {
  const g = Math.max(12, Math.min(20, gw)), gi = Math.min(7, Math.floor(g - 12)), gf = g - 12 - gi;
  const di = Math.max(0, Math.min(AUTO_NR_DA.length - 2, Math.floor((da + 6) / 2))), df = Math.max(0, Math.min(1, (da - AUTO_NR_DA[di]) / 2));
  const v = (r, c) => { const x = AUTO_NR_TBL[r][c]; return x == null ? _autoNrFit(12 + c, AUTO_NR_DA[r]) : x; };
  const lo = v(di, gi) * (1 - gf) + v(di, gi + 1) * gf, hi = v(di + 1, gi) * (1 - gf) + v(di + 1, gi + 1) * gf;
  return lo * (1 - df) + hi * df;
}
// 지금의 밀도고도(ft) — TAS 와 같은 밀도(고도 · METAR 기온)에서 거꾸로 셈한다
function simDensityAltFt() {
  let r = 1;
  try { r = tasRatio(); } catch (e) { _swallow(e); }
  const sig = 1 / (r * r);
  return (1 - Math.pow(sig, 1 / 4.2559)) / 6.8756e-6;
}
// 표가 주는 자동회전 NR(%) — 컬렉티브 최하단. GW·밀도고도는 PERF 무게와 지금 공기에서
function autoNrChart(gwLb, daFt) {
  let w = gwLb, d = daFt;
  if (!Number.isFinite(w)) { w = 16000; try { if (typeof perfWeightLb === 'function') w = perfWeightLb(); } catch (e) { _swallow(e); } }
  if (!Number.isFinite(d)) d = simDensityAltFt();
  const gw = w / 1000, da = d / 1000;
  if (da <= 8) return _autoNrTbl(gw, Math.max(-6, da));
  // 8,000ft 위는 식으로 — 8,000ft 에서 표와 이어지게 비율을 맞춘다
  const k = _autoNrTbl(gw, 8) / _autoNrFit(Math.max(12, Math.min(20, gw)), 8);
  return _autoNrFit(Math.max(12, Math.min(20, gw)), Math.min(16, da)) * k;
}
const AUTO_ENG_TQ = 15, AUTO_NR_OK = 90, AUTO_NR_SINK = 8000, AUTO_NR_E = 1, AUTO_NR_TAU_DN = 2.5, AUTO_CUSH_TAU = 0.4;   // 오토로테이션에서 레버를 당기면 NR 이 처지는 시간(로터 관성)   // 오토로테이션: 엔진 가용 15% 미만 · NR 90% 부터 · 양력 손실 세기
const NR_E_K = 5;              // NR 이 1%/s 처질 때 내주는 동력(토크 %)
let simNrRel = 0;              // 지금 NR 이 내주는(+)·받아들이는(−) 동력(토크 %)
function simRotorHigh() { return simModeOn && simNr > NR_HIGH; }
// ── 꼬리로터 동력 ── 로터 반토크 쪽 페달(반토크를 더 거는 쪽)은 토크를 더 쓰고, 반대쪽은 덜 쓴다.
// 앞으로 날수록 수직안정판이 반토크를 맡아 줄어든다.
const TR_TQ_UP = 6, TR_TQ_DN = 3;
function simTrTq(a, V) {
  const anti = (a && a.yaw ? a.yaw : 0) * rotorSign();
  const fade = Math.max(0.3, 1 - Math.abs(V) / 60);
  return (anti > 0 ? TR_TQ_UP * anti : TR_TQ_DN * anti) * fade;
}
// ── VRS(정착 강하) ── 대기속도 15kt 아래에서 출력을 건 채(토크 25% 위) 700fpm 넘게 가라앉으면
// 자기 내리흐름 속으로 떨어진다 — 레버를 올려도 덜 오르고 더 가라앉는다. 앞으로 속도를 붙이거나(20kt)
// 레버를 내리면 빠져나온다.
const VRS_KT = 15, VRS_OUT_KT = 20, VRS_FPM = -700, VRS_TQ = 25, VRS_SINK = 1500, VRS_TAU_IN = 2, VRS_TAU_OUT = 1.5;
let simVrs = 0;
function simVrsOn() { return simModeOn && simVrs > 0.3; }
// ── VNE · 후퇴익 실속 ── VNE 는 해면 160kt, 고도 1,000ft 마다 2kt 준다. 넘기면 후퇴익 쪽(CW 로터 → 오른쪽)
// 으로 구르고 기수가 든다 — 넘긴 1kt 당 초당 0.8°·0.5° 씩 쌓여 조종간 자세에 더해진다(VNE 아래로 줄이면 풀린다).
const VNE_SL = 160, VNE_PER_KFT = 2, RBS_ROLL = 0.8, RBS_PITCH = 0.5, RBS_MAX_ROLL = 30, RBS_MAX_PITCH = 15;
let simRbs = { r: 0, p: 0 };
function simVne(altFt = S.alt) { return VNE_SL - VNE_PER_KFT * Math.max(0, altFt) / 1000; }
function simOverVne() { return simModeOn && !_simOnGnd && simAirspeed() > simVne(); }
// 남은 차이(d)를 향해 '바뀌는 빠르기(acc)' 를 한 구간 옮긴다. acc 는 jerk 의 빠르기로
// 커진다(그래서 점점 빨라진다). 목표가 가까워지면 풀 수 있는 만큼(√(jb·|d|) — jb 는
// 푸는 빠르기, 주지 않으면 jerk)으로 줄여 넘치지 않고, 아주 가까우면 곧게(d 에 비례해)
// 붙어 떨지 않는다. jb 를 크게 주면 끝까지 키우다가 목표 가까이에서 짧게 푼다.
// 푸는 쪽(줄이거나 반대로 돌리는 쪽)은 세 배 빠르다 — 가속하다 조종간을 당기면 가속이
// 금방 풀리고 감속이 다시 점점 커진다(원판은 조종간을 곧바로 따른다).
const JERK_RELEASE = 3;
function simJerkStep(d, acc, dt, aMax, jerk, d0, jb) {
  const j = (jb || jerk) / 2, ad = Math.abs(d);
  const brake = ad < d0 ? ad * Math.sqrt(2 * j / d0) : Math.sqrt(2 * j * ad);
  const want = Math.sign(d) * Math.min(aMax, brake);
  const rel = want * acc < 0 || Math.abs(want) < Math.abs(acc);
  const r = (rel ? jerk * JERK_RELEASE : jerk) * dt;
  return acc + Math.max(-r, Math.min(r, want - acc));
}
// 지금 속도에서 낼 수 있는 가감속(max, kt/s)과 그것이 붙는 빠르기(jerk, kt/s²) —
// 줄이는 쪽(감속)인가, 늘리는 쪽(가속)인가
// 자세에 따른 가감속 배율 — 원판을 많이 기울일수록 앞뒤로 미는 힘이 커진다(S.pit: 기수 올림 +)
//   증속: 기수 내림 0° ×1.0 → 5° ×1.2 → 10° ×1.4(그 아래도 1.4) · 기수 올림 0~3° ×0.8 · 3~5° ×0.6 · 5~7.5°(그 위도) ×0.5
//   감속: 기수 올림 0~3° ×1.2 · 3~5° ×1.3 · 5~10° ×1.5 · 10° 초과 ×2.0 (기수를 숙인 채 줄 때는 ×1.0)
function simAccPitchK(decel, pit = S.pit) {
  if (decel) {
    if (pit <= 0) return 1;
    if (pit <= 3) return 1.2;
    if (pit <= 5) return 1.3;
    if (pit <= 10) return 1.5;
    return 2;
  }
  if (pit <= 0) return 1 + 0.4 * Math.min(1, -pit / 10);
  if (pit <= 3) return 0.8;
  if (pit <= 5) return 0.6;
  return 0.5;
}
function simAccLimit(ds, pit = S.pit) {
  const v = S.spd;
  if (v && Math.sign(ds) !== Math.sign(v)) {
    const k = simAccPitchK(true, pit);
    return { max: SPD_DEC_MAX * k * SIM_RATE_K / SIM_DEC_TIME, jerk: SPD_DEC_JERK * k * SIM_RATE_K / (SIM_DEC_TIME * SIM_DEC_TIME) };
  }
  const k = simAccPitchK(false, pit);
  return { max: (SPD_ACC_UP0 + (SPD_ACC_UP - SPD_ACC_UP0) * Math.min(1, Math.abs(v) / SPD_ETL_KT)) * k * SIM_RATE_K,
           jerk: SPD_JERK * k * SIM_RATE_K };
}
let simAcc = 0;               // 지금의 가감속(kt/s)
let simVsAcc = 0;             // 지금 상승률이 바뀌는 빠르기(fpm/s)
// ── 위치에너지 ↔ 운동에너지 ──
// 속도는 자세가 정한다 — 오르내리는 동안에도 같은 자세면 같은 속도다(수평 120kt 는
// 1,000ft 로 오르는 중에도 수평 자세). 실제로는 피토관 오차 등으로 조금 어긋나지만
// 시뮬에서는 그 어긋남을 두지 않는다.
// 거꾸로 속도를 줄이면(기수를 들어 감속) 줄어든 운동에너지가 고도로 돌아온다 —
// 같은 컬렉티브로도 떠오른다(줌·플레어). 속도를 늘리면 그만큼 고도로 치른다.
// ½v² 가 줄어든 만큼이 g·h 이므로 상승률 = −v·a/g. 주고받는 몫이 같아야
// 감속·가속을 되풀이해도 고도가 저절로 쌓이지 않는다.
// (감속이 빨라진 만큼 줄여, 동고도 감속에서 떠오르는 높이가 지나치지 않게 한다)
const CLIMB_PIT_OFF = 1;   // 상승 중 같은 속도에 드는 기수 들림(°) — 상승 80kt = 5°
const DESC_DEC_K = 0.375;   // 강하 파워 감속: 남은 속도(kt)당 감속(kt/s) — 50% 빠르게
const DESC_KE_K = 0.5;
const HOV_TO_MARGIN = 7;    // 호버 토크보다 이만큼(%) 더 쓰면 이륙 가속 중 침하가 없다
const TQ_KT  = 1;           // 남는(모자란) 토크 1% 당 같은 자세의 속도 차(kt) — 5% = 5kt(종전의 반)
const TQ_KT_MAX = 10;
const TQ_KT_VS0 = 500, TQ_KT_VS1 = 700;   // 오르내림이 500fpm 을 넘어야 속도차가 생기기 시작해 700fpm 에서 다 붙는다
const DESC_TQ = 5;          // 수평 비행 토크보다 이만큼(%) 모자라야 강하 파워로 본다(고도 유지 중 미세한 차는 빼고)      // 강하 파워에서 감속이 돌려주는 상승률 몫(반)
// 운동에너지 중 고도와 주고받는 몫 — 감속·가속에 같은 값을 써야 줄였다 늘려도 고도가 쌓이거나 빠지지 않는다
const SIM_KE_ETA = 0.10;   // 100kt 에서 기수로 10kt 바꾸면 약 350~400fpm
const SIM_KE_EFF = SIM_KE_ETA, SIM_KE_EFF_ACC = SIM_KE_ETA;
const SIM_KE_FPM = 0.514444 * 0.514444 / 9.80665 * 196.8504;   // kt × kt/s → fpm (≈5.31)
// 지금의 속도·가감속이 만드는 상승률(fpm). 땅 위에서는 미끄럼이 멈춰 세울 뿐이다.
let _simKePowered = false;     // 지금 가감속이 남는 출력의 속도차 몫인가(simFly 가 채운다)
// ── 자세(피치) 변화 ↔ 고도 ── 기수를 들어 10kt 줄이면 약 350fpm 오르고, 숙여 10kt 늘리면 약 350fpm 내려간다
// (100kt 언저리 · 최대치). 운동에너지 법칙 그대로라 줄였다 늘리면 고도가 제자리로 돌아온다.
// 가속은 감속보다 천천히 붙으므로 같은 상승·강하율이 나오게 몫을 조금 크게 둔다(SIM_KE_EFF_ACC).
// 조종사가 직접 몰 때(GSPD 밖)는 '자세가 정한 속도' 와 지금 속도의 차이가 오르내림이 된다 —
// 기수를 들어 줄일 속도가 10kt 면 약 350fpm 오르고, 숙여 늘릴 속도가 10kt 면 약 350fpm 내려간다.
// 그래서 퀵스톱(기수를 10~15° 들어 크게 줄이기)에서는 떠오르려는 몫이 커서, 컬렉티브를 크게 내려야
// 같은 고도로 감속한다. 속도가 맞춰지면 그 몫은 사라진다. 낮은 속도에서는 운동에너지가 작으므로 줄인다.
const KE_PWR_FREE = 5;   // 남는 토크가 이만큼(%)이면 가속을 고도로 치르지 않는다
const KE_FPM_PER_KT = 45, KE_FPM_PER_KT_ACC = 40, KE_DEV_MAX = 40, KE_FULL_KT = 60, KE_TAU = 0.3;
let _simKeVsF = 0;             // 그 몫(fpm) — simFly 가 매 구간 채운다
function simKeVs(onGnd, spd = S.spd, acc = simAcc) {
  if (onGnd) return 0;
  if (!gspdOn) return _simKeVsF;
  // GSPD(상위모드)가 가감속을 몰 때는 가감속 그대로의 운동에너지 교환
  if (_simKePowered) return 0;
  // 호버에서 기수를 숙여(5°) 이륙 가속할 때 — 호버 토크 + 7% 넘게 쓰면 가라앉지 않는다
  // (호버 이륙 가속에만 — 전이양력을 다 받기 전(SPD_ETL_KT) 까지. 순항에서 가속할 때는 운동에너지 법칙 그대로)
  if (acc > 0 && Math.abs(spd) < SPD_ETL_KT && S.tq >= hoverPowerTq() + HOV_TO_MARGIN) return 0;
  // 강하 파워에서 기수를 들어 줄어드는 강하율은 반만(DESC_KE_K)
  const k = (acc < 0 && !simAfcsVert() && S.tq < tqRequired() - DESC_TQ) ? DESC_KE_K : 1;
  return -(acc < 0 ? SIM_KE_EFF : SIM_KE_EFF_ACC) * k * SIM_KE_FPM * spd * acc;
}
// ── 오토로테이션 플레어 ──
// 레버를 내리고(출력 없이) 내려오는 중에 기수를 들면 원판이 뒤로 젖혀져, 앞에서 오던 바람이
// 원판 아래에서 위로 지난다 — 로터 추력이 커져 강하가 빠르게 멎는다(플레어).
// 그 몫은 '지금 속도의 자세보다 더 든 각' 에 비례하고, 속도²(동압)를 따라 줄어든다.
// 감속이 돌려주는 운동에너지 몫(simKeVs)과 함께, 80kt · 레버 끝까지 내림(약 3,000fpm)에서
// 100ft 쯤에 20° 로 들면 30ft 언저리에서 강하가 거의 멎는다(−200fpm 안팎). 그때 기수를 고르고
// 레버를 올려 받쳐 내려앉는다. 더 들면 더 빨리(높이서) 멎지만, 너무 높이서 멎으면 속도가 빠진 뒤 다시 떨어진다
// (충격 착륙) — 그 시점을 익히는 연습이다.
// 출력을 걸고 나는 동안(레버를 올려 둔 비행)은 고도를 출력이 정하므로 붙지 않는다 — 수평 비행에
// 드는 토크보다 레버가 FLARE_DEF0 넘게 모자랄 때부터 붙어 FLARE_DEF1 이면 다 붙는다(오토로테이션).
// 감속하며 레버를 조금(25% 까지) 내려 고도를 지키는 퀵스톱은 그대로다.
const FLARE_K    = 15;   // 강하율 감소를 종전의 반으로    // 기준 속도에서 1° 더 들 때 줄어드는 강하율(fpm)
const FLARE_VREF = 80;    // 기준 속도(kt)
const FLARE_DEF0 = 25;    // 출력이 이만큼(%) 넘게 모자라면 플레어 몫이 붙기 시작한다
const FLARE_DEF1 = 50;    // 이만큼(%) 모자라면 오토로테이션으로 보고 다 붙는다
const FLARE_TAU  = 1.5 * SIM_DEC_TIME;   // 로터 추력이 따라오는 시간(s) — 강하율이 줄어드는 시간 두 배
let simFlareVs = 0;       // 지금 플레어가 만든 상승률 몫(fpm)
// ── Vy 플레어 ── 기수를 그 속도의 자세보다 FLARE_EX_ON 넘게 들어 감속하면, Vy 에서 20kt 로 줄어드는
// 만큼에 비례해 강하율이 점점 줄어 20kt 에서 FLARE_VY_GAIN(1,700fpm) 줄어든다(레버는 그대로).
// 원판이 뒤로 젖혀져 아래에서 위로 흘러드는 바람이 로터를 받쳐 주는 동안이라, 속도가 줄며 늘어나는
// 필요 동력(U 자 곡선 — Vy 아래로 갈수록 많이 든다)은 플레어 중에는 치르지 않는다(그 몫을 메운다).
// 기수를 고르면(그 속도 자세 가까이) 사라지고, 출력이 정한 오르내림으로 돌아간다. AFCS 가 컬렉티브를
// 몰 때(ALT·CRHT·G/A·T/D)는 AFCS 가 고도를 잡으므로 붙지 않는다.
const FLARE_VY_GAIN = 1700, FLARE_V_END = 20, FLARE_EX_ON = 2, FLARE_EX_OFF = 0.5;
let _flareV0 = null, _flarePreq0 = 0, _flareVyTgt = 0, simFlareVyVs = 0;
const FLARE_VY_TAU = 0.6;   // 속도를 따라 곧 붙는다(줄어든 속도에 비례)
const FLARE_VY_TAU_OFF = 1.5;   // 기수를 고르면 유입류가 바뀌는 동안(1~2초) 서서히 사라진다
function simFlareVy(onGnd, ex) {
  if (onGnd || simAfcsVert() || !(S.spd > -5)) { _flareV0 = null; return 0; }
  const vy = simVyKt();
  if (_flareV0 === null) {
    if (!(ex > FLARE_EX_ON) || S.spd > vy + 40) return 0;
    _flareV0 = Math.min(vy, S.spd); _flarePreq0 = tqRequired();
  } else if (!(ex > FLARE_EX_OFF)) { _flareV0 = null; return 0; }
  // 기준보다 빨라졌으면(새로 감속을 시작했다) 그 속도를 새 기준으로 — 지난 플레어의 낮은 기준을 이어 쓰지 않게
  if (S.spd > _flareV0 + 2) { _flareV0 = Math.min(vy, S.spd); _flarePreq0 = tqRequired(); }
  const L = Math.max(0, Math.min(1, (Math.min(vy, _flareV0) - S.spd) / Math.max(10, vy - FLARE_V_END)));
  if (S.spd > vy) _flarePreq0 = tqRequired();                    // Vy 위에서는 아직 시작하지 않았다
  const comp = Math.max(0, tqRequired() - _flarePreq0) * CLIMB_FPM_DN * simWtK();   // 늘어난 필요 동력 몫을 메운다
  return FLARE_VY_GAIN * L + comp;
}
function simFlareTgt(onGnd) {
  const ex = S.pit - pitchFromSpd(Math.max(0, S.spd));   // 그 속도의 자세보다 더 든 각(°)
  _flareVyTgt = simFlareVy(onGnd, ex);
  if (onGnd || !(S.spd > 0)) return 0;
  if (!(ex > 0)) return 0;
  const auto = Math.max(0, Math.min(1, (tqRequired() - S.tq - FLARE_DEF0) / (FLARE_DEF1 - FLARE_DEF0)));
  return FLARE_K * (S.spd / FLARE_VREF) ** 2 * ex * auto;
}

// 토크(TQ) 상수와 tqRequired()·tqShown() 는 01-state.js 에 있다 —
// PFD 가 이 파일보다 먼저 그려질 수 있어 TDZ 를 피한다.

// simModeOn 은 01-state.js 에 둔다 — 시뮬 루프(07)가 이 파일보다 먼저 돌 수 있어서다.

// ── 사이클릭 비퍼 트림(4방향 햇) ──
// 실제 헬기의 사이클릭 햇은 '트림' 이다 — 조금씩 중립을 옮겨 두면 손을 놓아도
// 그 자세로 난다. SIM 모드에서 좌우는 롤, 전후는 피치 트림으로 쓴다.
// 한 번 누르면 뱅크 1° · 피치 0.5°(피치는 1° 가 속도 10kt 라 더 잘게 둔다).
// 0.5초 넘게 누르고 있으면 그때부터 0.1초마다 한 칸씩 이어 간다(조이스틱·
// 화면 버튼·방향키 모두 같다). GSPD 가 걸려 있으면 트림은 GSPD 기준속도를
// 옮긴다(01-state.js startTrimHold).
// 값은 '자세 각도(°)' 로 들고 있다가 조종간 몫으로 바꿔 더한다.
const SIM_TRIM_STEP_ROLL  = 0.5;     // 한 번에 옮기는 뱅크(°)
const SIM_TRIM_STEP_PITCH = 0.5;
const SIM_TRIM_CLICK_PITCH = 0.25; // 피치 4WAY 트림 첫 딸깍(°) — 이어 누르면 SIM_TRIM_STEP_PITCH 씩
const SIM_TRIM_MAX_ROLL  = 30;     // 트림만으로 갈 수 있는 뱅크(°)
const SIM_TRIM_MAX_PITCH = 20;     // 트림만으로 갈 수 있는 기수 자세(°)
let simTrim = { roll: 0, pitch: 0 };   // roll: 오른쪽 + · pitch: 기수 내림 +
function simTrimNudge(dir, rep) {
  // IAS 가 걸려 있으면 전후 트림은 기준 속도를 1kt 씩 옮긴다(앞 = 빠르게)
  if ((dir === 'F' || dir === 'A') && simAfcsPitch()) { simIasStep(dir === 'F' ? 1 : -1); return; }
  if (dir === 'R') simTrim.roll += SIM_TRIM_STEP_ROLL;
  else if (dir === 'L') simTrim.roll -= SIM_TRIM_STEP_ROLL;
  // 피치 한 번 딸깍은 그 반(SIM_TRIM_CLICK_PITCH) — 누르고 있어 이어 가는 몫(rep)은 종전대로
  else if (dir === 'F') simTrim.pitch += rep ? SIM_TRIM_STEP_PITCH : SIM_TRIM_CLICK_PITCH;      // 앞으로 = 기수 내림
  else if (dir === 'A') simTrim.pitch -= rep ? SIM_TRIM_STEP_PITCH : SIM_TRIM_CLICK_PITCH;
  simTrim.roll = Math.max(-SIM_TRIM_MAX_ROLL, Math.min(SIM_TRIM_MAX_ROLL, simTrim.roll));
  simTrim.pitch = Math.max(-SIM_TRIM_MAX_PITCH, Math.min(SIM_TRIM_MAX_PITCH, simTrim.pitch));
  // 자세는 3초에 15° 로 따라간다(simTrimSlew)
  if (dir === 'R' || dir === 'L') { _simTrimSlewing.roll = true; _simTrimFast.roll = 0; } else { _simTrimSlewing.pitch = true; _simTrimFast.pitch = 0; }
}
function simTrimReset() { simTrim = { roll: 0, pitch: 0 }; simTrimHeld = { roll: null, pitch: null }; _simTrimSlewing = { roll: false, pitch: false }; _simTrimFast = { roll: 0, pitch: 0 }; simTrimAct = { roll: 0, pitch: 0 }; }
// 4방향 트림은 한 번에 튀지 않고 3초에 15°(5°/s)로 옮겨 간다 — simTrim 은 기준(누른 만큼 곧바로),
// 자세에 쓰는 몫(simTrimAct)이 그 기준을 따라간다. 트림 버튼이 아닌 곳(GSPD·IAS 풀기 등)이
// 기준을 바꾸면 곧바로 맞춘다(자세가 튀지 않게 이미 맞춰 넣는 값이다).
const SIM_TRIM_RATE = 5;
let simTrimAct = { roll: 0, pitch: 0 };
let _simTrimSlewing = { roll: false, pitch: false };
// 트림을 놓으면 남은 몫을 0.3초 안에 마저 옮긴다(놓은 뒤 질질 끌며 멈추지 않게)
const SIM_TRIM_FINISH = 0.3;
let _simTrimFast = { roll: 0, pitch: 0 };
function simTrimRelease() {
  for (const k of ['roll', 'pitch']) {
    if (!_simTrimSlewing[k]) continue;
    _simTrimFast[k] = Math.abs(simTrim[k] - simTrimAct[k]) / SIM_TRIM_FINISH;
  }
}
function simTrimSlew(dt) {
  for (const k of ['roll', 'pitch']) {
    const d = simTrim[k] - simTrimAct[k];
    if (!_simTrimSlewing[k] || !d) { simTrimAct[k] = simTrim[k]; _simTrimSlewing[k] = false; continue; }
    simTrimAct[k] += Math.sign(d) * Math.min(Math.abs(d), Math.max(SIM_TRIM_RATE, _simTrimFast[k]) * dt);
    if (simTrimAct[k] === simTrim[k]) { _simTrimSlewing[k] = false; _simTrimFast[k] = 0; }
  }
}
// Against trim — 조종간을 중립 밖으로 쥐고 있는 동안은 그 순간의 트림을 붙잡아 둔다.
// 쥔 채로 트림을 넣으면 기준(트림)만 옮겨 가고 자세는 조종간이 정한다 — 놓으면 넣은 트림 자세만 남는다.
const SIM_TRIM_HOLD_DEAD = 0.03;
let simTrimHeld = { roll: null, pitch: null };
function simTrimEff(k, stick) {
  if (Math.abs(stick) > SIM_TRIM_HOLD_DEAD) {
    if (simTrimHeld[k] === null) simTrimHeld[k] = simTrimAct[k];
    // 쥐고 있는 동안 넣은 트림은 다 따라간 것으로 둔다 — 놓으면 그 자세로 조종간 빠르기대로 간다
    simTrimAct[k] = simTrim[k]; _simTrimSlewing[k] = false;
    return simTrimHeld[k];
  }
  simTrimHeld[k] = null;
  return simTrimAct[k];
}

// ── IAS 상위모드 ──
// 걸면 기수 자세를 '선택 속도(selSpd)를 내는 자세' 로 잡는다 — 자세 하나가 곧 속도이므로
// (PITCH_SPD) 그 자세로 두면 속도가 그 값에 선다. 오르내리는 동안 어긋나는 몫까지 메운다.
// 조종간을 밀고 당기면 그만큼 기수가 벗어나고(조작대로 속도도 바뀐다), 놓으면 IAS 자세로
// 천천히(SIM_IAS_RATE) 돌아와 속도도 선택 속도로 돌아간다.
//   켜기·끄기: FCP 의 IAS 라벨(켜면 지금 속도가 기준) · IAS ▲▼ 는 기준을 1kt 씩 옮기며 켠다
//   전후 트림: 기준 1kt 씩 · FORCE TRIM: 지금 속도를 새 기준으로
// 끄면 그 자세를 트림으로 잡아 두어 자세가 튀지 않는다.
const SIM_IAS_RATE = 5;        // 조종간을 놓았을 때 IAS 자세로 돌아오는 빠르기(°/s)
function simIasClamp(v) { return Math.max(0, Math.min(SIM_SPD_MAX, Math.round(v))); }
function simIasEngage() {
  if (!simModeOn) return;
  // GSPD 도 기수 자세를 쓰는 모드다 — IAS 를 걸면 내려놓는다(풀면서 지금 속도를 이어 받는다)
  if (gspdOn) { try { toggleGspd(); } catch (e) { _swallow(e); } }
  simIasOn = true;
  selSpd = simIasClamp(S.spd);
}
function simIasRelease() {
  simIasOn = false;
  // 지금 자세를 트림으로 잡아 둔다(조종간이 가운데가 아니면 그 몫은 뺀다)
  const p = -S.pit - simModeAxes().pitch * SIM_PITCH_MAX;
  simTrim.pitch = Math.max(-SIM_TRIM_MAX_PITCH, Math.min(SIM_TRIM_MAX_PITCH, p));
}
function simIasToggle() { if (simIasOn) simIasRelease(); else simIasEngage(); }
// 기준 속도를 d(kt)만큼 옮긴다 — 꺼져 있으면 지금 속도에서 켜고 옮긴다
function simIasStep(d) {
  if (!simModeOn) return;
  if (!simAfcsPitch()) simIasEngage();
  selSpd = simIasClamp(selSpd + d);
}
// 선택 속도에 서는 자세 — 아래 simFly 의 '피치 → 속도' 식을 거꾸로 푼다
// (오르내리는 동안에도 같은 자세 — 상승·강하로 어긋나지 않는다).
function simIasPitch() {
  return pitchFromSpd(Math.max(0, Math.min(SIM_SPD_MAX, selSpd)));
}
// 지금 속도를 지키는 트림으로 맞춘다 — GSPD 를 풀었을 때 자세가 튀지 않게
// (조종간을 가운데 두면 그 속도로 계속 난다).
// FORCE TRIM 을 놓을 때 — 누르고 있는 동안 조종간으로 옮겨 놓은 지금 자세(피치·롤)를 새 트림으로 잡는다.
// 놓는 순간 조종간이 아직 밀려 있으면 그 축은 종전 트림을 붙잡아 두었다가(against trim 과 같다)
// 조종간이 가운데로 돌아오면 새 트림 — 곧 놓을 때의 자세 — 만 남는다.
function simFtrRelease() {
  if (!simModeOn || gspdOn || simAfcsPitch()) return;
  const a = simModeAxes();
  // 새 트림 = 놓는 순간의 자세 전체(조종간이 밀려 있는 동안은 종전 트림을 붙잡아 두므로 자세가 튀지 않는다)
  // 블로우 백으로 들린 몫(simBb)은 트림에 넣지 않는다 — 넣으면 놓은 뒤 블로우 백이 그 위에 또 얹혀 2.5° 더 든다
  const out = { roll: S.bnk - (simTf || 0), pitch: -(S.pit - rcPitchOff(rcAxes(a)) - (simBb || 0)) };
  for (const k of ['roll', 'pitch']) {
    const max = k === 'roll' ? SIM_TRIM_MAX_ROLL : SIM_TRIM_MAX_PITCH;
    const stick = k === 'roll' ? a.roll : a.pitch;
    if (k === 'roll' && simAfcsLat()) continue;
    const old = simTrimAct[k];
    simTrim[k] = Math.max(-max, Math.min(max, Math.round(out[k] * 10) / 10));
    simTrimAct[k] = simTrim[k]; _simTrimSlewing[k] = false;
    simTrimHeld[k] = Math.abs(stick) > SIM_TRIM_HOLD_DEAD ? old : null;
  }
}
function simTrimHoldSpeed() {
  const p = -pitchFromSpd(S.spd);
  simTrim = { roll: 0, pitch: Math.max(-SIM_TRIM_MAX_PITCH, Math.min(SIM_TRIM_MAX_PITCH, p)) };
  simTrimHeld = { roll: null, pitch: null };
}

// ── GSPD 중의 조종간(fly-through) ──
// GSPD 가 걸려 있으면 자세와 속도는 GSPD 가 맡는다. 조종간을 중립(데드존) 밖으로
// 밀고 있는 축만 조종사가 몬다 — 미는 쪽으로 지상속도가 붙고, 놓으면 GSPD 가
// 기준속도로 되돌린다. 새 속도를 지키려면 FORCE TRIM 을 누른다(그 순간의
// 지상속도가 새 기준이 된다 — forceTrim). 4방향 트림은 기준속도를 옮긴다.
const GSPD_FLY_ACC = 10.5;          // 조종간을 끝까지 밀었을 때의 가감속(kt/s) — 종전 3.5 의 세 배
let _simOnGnd = false;              // 마지막 적분 구간에 땅에 붙어 있었는가
// ── 접지 알림 ──
// 땅(갑판)에 닿는 순간의 강하율로 접지를 가른다 — 오토로테이션 플레어를 익히는 잣대.
// 360fpm(6ft/s) 까지 부드러운 접지 · 600fpm(10ft/s) 까지 단단한 접지 · 그 넘으면 충격 착륙.
const TD_SOFT = 360, TD_HARD = 600;
const TD_QUIET = 100;               // 이보다 살며시 내려앉으면(호버에서 내려놓기) 알리지 않는다
let simLastTouchdown = null;        // 마지막 접지 { vs(fpm, 양수), spd(kt), grade }
function simTouchdown(vs, spd) {
  const v = Math.max(0, -vs);
  const grade = v <= TD_SOFT ? '부드러운 접지' : v <= TD_HARD ? '단단한 접지' : '충격 착륙';
  simLastTouchdown = { vs: v, spd, grade };
  if (v < TD_QUIET) return;
  try {
    uiToast(`접지 ${Math.round(v)}fpm · ${Math.round(Math.max(0, spd))}kt — ${grade}`,
            v > TD_HARD ? 'err' : v > TD_SOFT ? 'warn' : '', 4000);
  } catch (e) { _swallow(e); }
}
// 조종간 몫 — { lat: 좌우, fwd: 전후 } (-1…1, 중립이면 0). GSPD 가 아니면 null.
function simGspdStick() {
  if (!simModeOn || !gspdOn) return null;
  if (_simOnGnd) return { lat: 0, fwd: 0 };   // 땅 위에서는 미끄러지지 않는다
  const a = simModeAxes();
  return { lat: a.roll, fwd: a.pitch };
}
// 한 축을 조종간 몫만큼 가감속한다(SIM 모드가 낼 수 있는 속도 안에서)
function simGspdFly(v, k, dt, lo, hi) {
  return Math.max(lo, Math.min(hi, v + k * GSPD_FLY_ACC * dt));
}
// GSPD 가 지상속도를 옮긴 뒤에 부른다(07-sim.js). 자세는 그 속도를 지키는
// 자세(SIM 자세-속도 식)에 가감속에 드는 기울기(atan a/g)를 얹은 것이다 —
// 앞으로 붙으면 기수가 숙고, 옆으로 붙으면 그쪽으로 기운다. 가감속은
// 운동에너지 ↔ 고도 교환(simKeVs)에도 그대로 쓰인다.
function simGspdAfter(dt, f0, l0, fly) {
  if (!simModeOn || !(dt > 0)) return;
  if (_simOnGnd) {
    // 땅 위에서는 스키드가 잡는다 — 금방 선다
    const k = Math.max(0, 1 - 1.2 * dt);
    gspdActFwd *= k; gspdActLat *= k;
  }
  // 자세를 기울이는 것은 조종사가 조종간으로 미는 몫(fly-through)뿐이다. 4방향 트림으로
  // 기준속도를 1kt 씩 옮길 때 GSPD 가 따라가는 가감속까지 자세에 실으면, 딸깍할
  // 때마다 PFD 와 3D 시점이 그 축으로 흔들린다(AFCS 가 알아서 하는 몫이다).
  const accF = (fly && fly.fwd) ? (gspdActFwd - f0) / dt : 0;
  const accL = (fly && fly.lat) ? (gspdActLat - l0) / dt : 0;
  // 속도가 바뀐 만큼 운동에너지 몫의 상승률도 바로 고친다. simFly 는 이 구간의
  // 속도가 바뀌기 전에 상승률을 써 두었으므로, 여기서 맞추지 않으면 다음 구간에
  // 그 차이가 출력 몫으로 섞여 1~2초 뒤 사라져 버린다.
  const ke0 = simKeVs(_simOnGnd);
  const spd = Math.hypot(gspdActFwd, gspdActLat);
  simAcc = (spd - Math.hypot(f0, l0)) / dt;
  S.spd = spd;                       // 07-sim.js 도 곧 같은 값을 넣는다
  S.vs = Math.max(-SIM_VS_DN_MAX, S.vs + simKeVs(_simOnGnd) - ke0);
  const tilt = a => Math.atan(a * 0.514444 / 9.80665) / D2R;   // kt/s → °
  const pTgt = Math.max(-SIM_PITCH_MAX, Math.min(SIM_PITCH_MAX, pitchFromSpd(gspdActFwd) - tilt(accF)));
  const bTgt = Math.max(-SIM_BANK_MAX, Math.min(SIM_BANK_MAX, tilt(accL)));
  const dP = pTgt - S.pit, dB = bTgt - S.bnk;
  S.pit += Math.sign(dP) * Math.min(Math.abs(dP), SIM_PITCH_RATE * dt);
  S.bnk += Math.sign(dB) * Math.min(Math.abs(dB), SIM_ROLL_RATE * dt);
  bankTarget = S.bnk;
  simLat = gspdActLat;               // 풀었을 때 옆걸음을 그대로 이어 받는다
}

// ── 시야 둘러보기(눈 돌리기) ──
// 정해 둔 버튼(기본 B0)을 누르고 있는 동안에는 4방향 햇이 트림 대신 '시선' 이
// 된다 — 좌우·위아래로 고개를 돌려 바깥을 훑어볼 수 있다. 버튼을 놓으면 시선이
// 정면으로 부드럽게 돌아온다. 시선은 기체 자세 위에 얹힌다(오른쪽 뱅크에서
// 오른쪽을 보면 땅 쪽을 보게 된다 — 05-gps.js 의 카메라가 그렇게 합친다).
const LOOK_YAW_RATE   = 90;     // 햇을 누르고 있을 때 좌우로 도는 빠르기(°/s)
const LOOK_PIT_RATE   = 60;     // 위아래로 도는 빠르기(°/s)
const LOOK_YAW_MAX    = 150;    // 어깨 너머까지(°)
const LOOK_PIT_UP     = 60;     // 올려다볼 수 있는 한계(°)
const LOOK_PIT_DN     = 70;     // 내려다볼 수 있는 한계(°)
const LOOK_RETURN_TAU = 0.35;   // 놓았을 때 정면으로 돌아오는 시간(s)
let simLook = { yaw: 0, pitch: 0 };   // yaw: 오른쪽 + · pitch: 위 +
let simLookHeld = false;              // 둘러보기 버튼을 누르고 있는가
let simLookDir = null;                // 지금 누르고 있는 햇 방향(F·A·L·R)
let _simLookT = 0;
function simLookReset() { simLook = { yaw: 0, pitch: 0 }; simLookDir = null; _simLookT = 0; }
function simLookHold(on) {
  simLookHeld = !!on;
  if (!simLookHeld) simLookDir = null;
}
// 카메라를 놓을 때마다 부른다(실시간 dt — 일시정지 중에도 둘러볼 수 있게).
// dt 를 주면 그만큼만 진행한다(검사에서 시간을 정확히 밀어 볼 때).
function simLookStep(dtGiven) {
  const now = performance.now();
  const dt = (dtGiven != null) ? dtGiven
           : (_simLookT ? Math.min(0.25, (now - _simLookT) / 1000) : 0);
  _simLookT = now;
  if (!(dt > 0)) return simLook;
  if (simLookHeld) {
    if (simLookDir === 'R') simLook.yaw += LOOK_YAW_RATE * dt;
    else if (simLookDir === 'L') simLook.yaw -= LOOK_YAW_RATE * dt;
    else if (simLookDir === 'F') simLook.pitch += LOOK_PIT_RATE * dt;   // 햇 ▲ = 올려다본다
    else if (simLookDir === 'A') simLook.pitch -= LOOK_PIT_RATE * dt;
    else if (simLookDir === 'B') simLook.yaw += (simLook.yaw < 0 ? -1 : 1) * LOOK_YAW_RATE * 1.5 * dt;   // 뒤 — 돌던 쪽 어깨 너머로(화면 시야 버튼)
    simLook.yaw = Math.max(-LOOK_YAW_MAX, Math.min(LOOK_YAW_MAX, simLook.yaw));
    simLook.pitch = Math.max(-LOOK_PIT_DN, Math.min(LOOK_PIT_UP, simLook.pitch));
  } else {
    const k = Math.min(1, dt / LOOK_RETURN_TAU);
    simLook.yaw -= simLook.yaw * k;
    simLook.pitch -= simLook.pitch * k;
    if (Math.abs(simLook.yaw) < 0.05) simLook.yaw = 0;
    if (Math.abs(simLook.pitch) < 0.05) simLook.pitch = 0;
  }
  return simLook;
}

function simModeAxes() {
  const ax = r => { try { return joyAxVal(r); } catch (e) { return 0; } };
  const o = { roll: ax('roll'), pitch: ax('pitch'), yaw: ax('yaw'), coll: ax('coll') };
  // 화면 조종간(3D 단독) — 쥐고 있는 동안은 그 값을 쓴다(실물 조종간과 함께 쓸 수 있다)
  const vsa = vStickActive(), ga = gyroActive();
  if (vsa && vStick.yaw) o.yaw = vStick.yaw;
  if ((vsa || ga) && (vStick.roll || vStick.pitch)) { const c = vStickCyclic(); o.roll = c.roll; o.pitch = c.pitch; }
  return o;
}

// ── 화면 조종간(3D 단독 · SIM) ──
// 조이스틱이 없어도 3D 단독 화면 오른쪽 아래(R CHIN 창 자리)에서 손으로 몬다.
//   왼쪽  : 위아래 — 컬렉티브(놓아도 그 자리 · 아래 0% … 위 140%)
//   가운데: 좌우 — 페달(놓으면 가운데로)
//   오른쪽: 원형 — 사이클릭, 16방향(22.5° 칸)으로 맞춰 민 거리만큼(놓으면 가운데로 — 트림이 자세를 지킨다)
// 'STICK' 버튼으로 켜고 끈다. 켜면 R CHIN 창은 닫힌다.
// 화면 사이클릭의 가동범위 — 끝까지 밀면 피치 ±10° · 롤 ±20°(트림 자세 위에 더해진다).
// 피치는 가운데 감도를 반으로(끝으로 갈수록 붙어 끝에서 10°) — 손가락으로 자세를 잘게 맞추게.
const VSTICK_PITCH_DEG = 10, VSTICK_ROLL_DEG = 20, VSTICK_PITCH_CENTER = 0.5;
function vStickCyclic() {
  const p = vStick.pitch, ap = Math.abs(p);
  const pc = Math.sign(p) * ap * (VSTICK_PITCH_CENTER + (1 - VSTICK_PITCH_CENTER) * ap);   // 기울기: 가운데 0.5 → 끝 1.5(끝값 1)
  return { roll: vStick.roll * VSTICK_ROLL_DEG / SIM_BANK_MAX, pitch: pc * VSTICK_PITCH_DEG / SIM_PITCH_MAX };
}
let vStickOn = false;
const vStick = { coll: 0, yaw: 0, roll: 0, pitch: 0 };
function vStickAvail() { return simModeOn && typeof fcp3dAvail === 'function' && fcp3dAvail(); }
function vStickActive() { return vStickOn && vStickAvail(); }
function _vStickBox() {
  const d3 = document.getElementById('map3d');
  if (!d3) return null;
  let box = document.getElementById('vstick');
  if (box) return box;
  box = document.createElement('div'); box.id = 'vstick';
  box.innerHTML =
    '<div class="vs-left"><div class="vs-track vs-ped" data-k="yaw"><div class="vs-knob"></div><span class="vs-lbl">PEDAL</span></div>' +
    // 시야 조이스틱 — 앞 · 위 · 뒤 / 왼쪽 · 아래 · 오른쪽(누르고 있는 동안 돌아보고, 놓으면 정면으로)
    '<div class="vs-look"><button type="button" data-look="C" title="정면">앞</button><button type="button" data-look="F" title="위를 본다">▲</button>' +
    '<button type="button" data-look="B" title="뒤(어깨 너머)를 본다">뒤</button><button type="button" data-look="L" title="왼쪽을 본다">◀</button>' +
    '<button type="button" data-look="A" title="아래를 본다">▼</button><button type="button" data-look="R" title="오른쪽을 본다">▶</button>' +
    '<span class="vs-look-lbl">VIEW</span></div></div>' +
    '<div class="vs-cyc" data-k="cyc"><div class="vs-ring"></div><div class="vs-knob"></div><span class="vs-lbl">CYCLIC</span></div>';
  d3.appendChild(box);
  // 컬렉티브는 왼손 — 화면 왼쪽 아래 끝(L CHIN 창의 왼쪽 가장자리)에 따로 둔다
  const cb = document.createElement('div'); cb.id = 'vstick-coll'; cb.className = 'vstick-pane';
  cb.innerHTML = '<div class="vs-track vs-coll" data-k="coll"><div class="vs-knob"></div><span class="vs-lbl">COLL</span></div>';
  // (CHIN 창 줄은 #map3d 바깥 형제라, 그 위에 보이도록 #map3d 의 부모에 붙인다)
  (d3.parentElement || d3).appendChild(cb);
  [...box.querySelectorAll('[data-k]'), ...cb.querySelectorAll('[data-k]')].forEach(el => {
    const k = el.dataset.k;
    const set = ev => {
      const r = el.getBoundingClientRect();
      if (k === 'coll') vStick.coll = Math.max(0, Math.min(1, (r.bottom - ev.clientY) / r.height));
      else if (k === 'yaw') vStick.yaw = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      else {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.min(r.width, r.height) / 2;
        const dx = ev.clientX - cx, dy = ev.clientY - cy;
        const m = Math.min(1, Math.hypot(dx, dy) / R);
        const step = Math.PI / 8;                                       // 16방향
        const ang = Math.round(Math.atan2(-dy, dx) / step) * step;      // 위 = 앞으로 밀기
        vStick.roll = m < 0.05 ? 0 : +(m * Math.cos(ang)).toFixed(4);
        vStick.pitch = m < 0.05 ? 0 : +(m * Math.sin(ang)).toFixed(4);
      }
      vStickRender();
    };
    el.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (e) { _swallow(e); } el.classList.add('held'); set(ev); });
    el.addEventListener('pointermove', ev => { if (el.classList.contains('held')) { ev.preventDefault(); set(ev); } });
    const end = () => {
      el.classList.remove('held');
      if (k === 'yaw') vStick.yaw = 0;                                  // 페달·사이클릭은 놓으면 가운데로
      if (k === 'cyc') { vStick.roll = 0; vStick.pitch = 0; }
      vStickRender();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  });
  // 시야 버튼 — 햇 둘러보기(simLook)와 같다. '앞' 은 바로 정면으로
  box.querySelectorAll('[data-look]').forEach(bt => {
    const d = bt.dataset.look;
    bt.addEventListener('pointerdown', ev => {
      ev.preventDefault(); ev.stopPropagation(); try { bt.setPointerCapture(ev.pointerId); } catch (e) { _swallow(e); }
      if (d === 'C') { simLookReset(); return; }
      bt.classList.add('held'); simLookHold(true); simLookDir = d;
    });
    const up = () => { if (!bt.classList.contains('held')) return; bt.classList.remove('held'); simLookHold(false); };
    bt.addEventListener('pointerup', up); bt.addEventListener('pointercancel', up);
  });
  return box;
}
function vStickRender() {
  const box = document.getElementById('vstick'); if (!box) return;
  const q = s => document.querySelector('#vstick ' + s + ', #vstick-coll ' + s);
  const kc = q('.vs-coll .vs-knob'), kp = q('.vs-ped .vs-knob'), ky = q('.vs-cyc .vs-knob');
  if (kc) kc.style.bottom = `calc(${(vStick.coll * 100).toFixed(1)}% - 9px)`;
  if (kp) kp.style.left = `calc(${((vStick.yaw + 1) * 50).toFixed(1)}% - 9px)`;
  if (ky) { ky.style.left = `calc(${(50 + vStick.roll * 50).toFixed(1)}% - 14px)`; ky.style.top = `calc(${(50 - vStick.pitch * 50).toFixed(1)}% - 14px)`; }
  const l = q('.vs-coll .vs-lbl'); if (l) l.textContent = `COLL ${Math.round(vStick.coll * SIM_LEVER_TOP)}%`;
}
function syncVStick() {
  const avail = vStickAvail(), want = vStickOn && avail;
  try { syncGyro(); } catch (e) { _swallow(e); }
  const b = document.getElementById('vstick-btn');
  if (b) { b.textContent = vStickOn ? 'STICK ON' : 'STICK OFF'; b.classList.toggle('on', want); b.classList.toggle('dim', !avail); }
  const box = want ? _vStickBox() : document.getElementById('vstick');
  if (box) box.classList.toggle('show', want);
  { const cb = document.getElementById('vstick-coll'), d3 = document.getElementById('map3d');
    if (cb && d3 && d3.parentElement && cb.parentElement !== d3.parentElement) d3.parentElement.appendChild(cb);   // 3D 창이 옮겨 가면 따라간다
    if (cb) cb.classList.toggle('show', want); }
  { const d3 = document.getElementById('map3d'); if (d3) d3.classList.toggle('vstick-on', want); }   // 3D 버튼 줄이 조종간 위에서 끝나게
  if (want) {
    vStickRender();
    if (typeof chinR !== 'undefined' && chinR) { chinR = false; chinViewOn = chinL || chinR; try { syncChinView(); } catch (e) { _swallow(e); } }
  }
}
// ── GYRO — 태블릿·휴대폰을 기울여 16방향 사이클릭을 몬다(3D 단독 · SIM) ──
// GYRO ON 으로 센서를 켜고(아이폰·아이패드는 이때 허락을 묻는다), GYRO ALIGN 을 누른 그때의 기울기를 가운데로
// 잡아 그때부터 몬다. 기기를 GYRO_FULL_DEG 기울이면 끝(화면 사이클릭과 같은 피치 ±10° · 롤 ±20°, 16방향 맞춤).
// 화면 사이클릭을 손으로 쥐고 있는 동안은 손이 앞선다. 화면 방향(가로·세로)이 바뀌면 다시 ALIGN 해야 한다.
const GYRO_FULL_DEG = 25, GYRO_DEAD_DEG = 1.5;
let gyroOn = false, gyroAligned = false, _gyroZero = null, _gyroLast = null, _gyroBound = false;
function gyroActive() { return gyroOn && gyroAligned && vStickAvail(); }
// 화면이 기기 본래 방향에서 돌아간 각(0 · 90 · 180 · 270). 아이패드·아이폰은 screen.orientation.angle 이 가로에서도
// 0 으로 나올 때가 있어(가로로 쥐고 숙이면 롤로, 기울이면 피치로 엇갈렸다) iOS 의 window.orientation 을 먼저 본다.
// (가로가 본래 방향인 안드로이드 태블릿·PC 는 가로에서 0 이 맞다 — 센서 축도 그 방향을 따른다)
function _gyroAngle() {
  try { if (typeof window.orientation === 'number' && Number.isFinite(window.orientation)) return (window.orientation + 360) % 360; } catch (e) { _swallow(e); }
  try { if (screen.orientation && Number.isFinite(screen.orientation.angle)) return screen.orientation.angle; } catch (e) { _swallow(e); }
  return 0;
}
// 기기 기울기 → 화면 기준(앞으로 숙임 + · 오른쪽 내림 +)
function _gyroTilt(ev, ang) {
  const b = ev.beta || 0, g = ev.gamma || 0;
  if (ang === 90) return { fwd: g, right: b };
  if (ang === 270) return { fwd: -g, right: -b };
  if (ang === 180) return { fwd: b, right: -g };
  return { fwd: -b, right: g };                       // 세로(0°): 위쪽을 앞으로 숙이면 beta 가 준다
}
function gyroFeed(ev) {
  if (!ev || ev.beta == null) return;
  const ang = _gyroAngle();
  _gyroLast = { tilt: _gyroTilt(ev, ang), ang };
  if (!gyroActive() || !_gyroZero) return;
  if (_gyroZero.ang !== ang) {                         // 화면을 돌렸다 — 가운데가 어긋난다
    gyroAligned = false; syncGyro();
    try { uiToast('화면 방향이 바뀌었습니다 — GYRO ALIGN 을 다시 누르십시오', 'err', 2500); } catch (e) { _swallow(e); }
    return;
  }
  const cyc = document.querySelector('#vstick .vs-cyc');
  if (cyc && cyc.classList.contains('held')) return;   // 손이 쥐고 있으면 손이 앞선다
  const d = v => Math.abs(v) < GYRO_DEAD_DEG ? 0 : (v - Math.sign(v) * GYRO_DEAD_DEG) / (GYRO_FULL_DEG - GYRO_DEAD_DEG);
  const x = d(_gyroLast.tilt.right - _gyroZero.tilt.right), y = d(_gyroLast.tilt.fwd - _gyroZero.tilt.fwd);
  const m = Math.min(1, Math.hypot(x, y));
  if (m < 0.02) { vStick.roll = 0; vStick.pitch = 0; }
  else {
    const step = Math.PI / 8, a = Math.round(Math.atan2(y, x) / step) * step;   // 16방향
    vStick.roll = +(m * Math.cos(a)).toFixed(4); vStick.pitch = +(m * Math.sin(a)).toFixed(4);
  }
  vStickRender();
}
function syncGyro() {
  const avail = vStickAvail();
  const b = document.getElementById('gyro-btn'), al = document.getElementById('gyro-align-btn');
  if (b) { b.textContent = gyroOn ? 'GYRO ON' : 'GYRO OFF'; b.classList.toggle('on', gyroOn && avail); b.classList.toggle('dim', !avail); }
  if (al) { al.style.display = gyroOn ? '' : 'none'; al.classList.toggle('on', gyroActive()); al.textContent = gyroAligned ? 'GYRO ALIGN ✓' : 'GYRO ALIGN'; }
}
async function toggleGyro() {
  if (!vStickAvail()) {
    try { uiToast('GYRO 는 SIM 모드의 Cockpit Mode 화면에서 씁니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  if (gyroOn) { gyroOn = false; gyroAligned = false; _gyroZero = null; vStick.roll = vStick.pitch = 0; vStickRender(); syncGyro(); return; }
  if (typeof DeviceOrientationEvent === 'undefined') {
    try { uiToast('이 기기에는 기울기(GYRO) 센서가 없습니다', 'err', 2500); } catch (e) { _swallow(e); }
    return;
  }
  // 아이폰·아이패드(Safari·Chrome)는 누른 그 순간에 허락을 받아야 한다
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      // ('prompt' 는 거절이 아니다 — 크롬은 묻지 않고 그대로 준다. 'denied' 만 막는다)
      if (r === 'denied') { try { uiToast('기울기 센서 사용을 허락하지 않았습니다 — 브라우저 설정에서 동작·방향 접근을 허용하십시오', 'err', 3000); } catch (e) { _swallow(e); } return; }
    }
  } catch (e) { _swallow(e); }
  if (!_gyroBound) { window.addEventListener('deviceorientation', gyroFeed); _gyroBound = true; }
  gyroOn = true; gyroAligned = false; _gyroZero = null;
  syncGyro();
  try { uiToast('기기를 편하게 잡은 자세에서 GYRO ALIGN 을 누르면 그때부터 기울기로 조종합니다', '', 3000); } catch (e) { _swallow(e); }
}
function gyroAlign() {
  if (!gyroOn) return;
  if (!_gyroLast) { try { uiToast('기울기 센서 값이 아직 없습니다 — 기기를 조금 움직인 뒤 다시 누르십시오', 'err', 2500); } catch (e) { _swallow(e); } return; }
  _gyroZero = { tilt: { ..._gyroLast.tilt }, ang: _gyroLast.ang };
  gyroAligned = true; vStick.roll = vStick.pitch = 0; vStickRender();
  syncGyro();
}
function toggleVStick() {
  if (!vStickAvail()) {
    try { uiToast('화면 조종간은 SIM 모드의 Cockpit Mode 화면에서 씁니다', '', 2500); } catch (e) { _swallow(e); }
    return;
  }
  vStickOn = !vStickOn;
  // 켤 때 컬렉티브는 지금 토크 자리에서 시작한다(튀지 않게)
  if (vStickOn) { vStick.coll = Math.max(0, Math.min(1, (S.tq || 0) / SIM_LEVER_TOP)); vStick.yaw = vStick.roll = vStick.pitch = 0; }
  syncVStick();
}

function updateSimModeBtn() {
  const b = document.getElementById('sim-mode-btn');   // FCP 버튼은 없앴다(PFD 소프트키 SIM) — 있으면만
  if (b) b.classList.toggle('on', simModeOn);
  try { if (typeof pfdSkRender === 'function') pfdSkRender(); } catch (e) { _swallow(e); }
  // 3D 창·지도 창 오른쪽 버튼 묶음 맨 아래의 SIM 버튼도 함께
  document.querySelectorAll('.sim-side-btn').forEach(x => {
    x.classList.toggle('on', simModeOn); x.textContent = simModeOn ? 'SIM ON' : 'SIM OFF';
  });
}

// SIM 버튼 — 묻지 않고 바로 켜고 끈다. 땅에서 시작할지 공중에서 이어 갈지는 지금 자리로
// 정한다(simNearGround): 지면 가까이(AGL 50ft 아래)면 땅에서, 아니면 날던 그대로.
// (비행계획의 출발지로 옮기면 지면에 세워 두므로 거기서 켜면 땅에서 시작한다)
const SIM_GND_START_FT = 50;
function simNearGround() { simTerrainFt(); return S.alt - simFloorFt() < SIM_GND_START_FT; }
function simModeBtnPress() {
  toggleSimMode(!simModeOn);
}

// ── 발밑의 땅 ──
// '0 ft 에서 시작' 은 해수면이 아니라 지면(AGL 0)이다. 지형 표고를 모르면
// 땅속에서 시작하거나 공중에 떠서 시작해 3D 그림이 깨진다.
// 지형 자료는 T-CUT(지형 단면)이 쓰는 것과 같은 DEM 타일이다. 타일이 아직
// 오지 않았으면 null 이 오므로, 마지막으로 안 값을 들고 있다가 쓴다.
let _simGndFt = 0, _simGndAt = null, _simGndFresh = false;
function simTerrainFt(lat, lon) {
  const la = (lat == null) ? S.lat : lat, lo = (lon == null) ? S.lon : lon;
  let m = null;
  try { m = _tcElev(la, lo); } catch (e) { _swallow(e); }
  if (m == null) { _simGndFresh = false; return _simGndFt; }   // 아직 모르면 마지막 값
  // 바다는 해수면이 바닥이다. 지형 자료에는 바다 밑 수심(음수)과 해안의 잔물결 같은
  // 값이 섞여 있어, 그대로 쓰면 바다 위에서 해수면 아래로 내려가거나 울퉁불퉁하다.
  // 3D 지형과 같은 규칙(seaFlatM — 5m 아래는 0m)으로 편다.
  m = (typeof seaFlatM === 'function') ? seaFlatM(m) : Math.max(0, m);
  // 활주로는 공항표고로 평평하다 — 3D 지형과 같은 규칙(04-map.js rwyFlatM)
  if (typeof rwyFlatM === 'function') m = rwyFlatM(la, lo, m);
  _simGndFt = m / 0.3048;
  _simGndAt = [la, lo];
  _simGndFresh = true;
  return _simGndFt;
}
// '지금 발밑' 의 높이를 아는가. 모르는 채로 묵은 값을 땅으로 믿으면,
// 공중에 있는데도 땅에 닿은 줄 알고 속도를 0 으로 눌러 버린다
// (기수를 숙여도 가속되지 않는 증상). 모를 때는 해수면만 바닥으로 본다.
function simGroundFt() { return _simGndFresh ? _simGndFt : 0; }

// ── 함정 갑판 ──
// 함정(09-cdu.js) 위에서는 그 자리 함정 부분의 윗면이 바닥이다 — 갑판 7m · 함수
// 구조물 10m · 함교 17m. 함정은 수면(지면) 위에 서 있으므로 그 높이를 지면에 더한다.
// 갑판에 앉아 있으면 함정과 함께 간다(07-sim.js 의 함정 이동 · 09-cdu.js 의 침로 변경).
// 기체는 앞뒤 20m(로터 포함)로 본다. 그 길이 아래 어디라도 함정이 있으면 가장 높은
// 윗면이 바닥이다 — 기수가 함교 위로 들어가 있으면 내려앉지 못하고 함교에 걸린다.
const SIM_AC_LEN = 20;               // m
function simShipTopM(lat, lon, hdg) {
  if (typeof shipDeckTopM !== 'function') return null;
  const h = hdg * D2R, cl = Math.cos(lat * D2R);
  let top = null;
  for (let d = -SIM_AC_LEN / 2; d <= SIM_AC_LEN / 2 + 1e-9; d += 1) {
    const m = shipDeckTopM(lat + d * Math.cos(h) / 111320, lon + d * Math.sin(h) / (111320 * cl));
    if (m != null && (top === null || m > top)) top = m;
  }
  return top;
}
function simDeckFt() {
  const m = simShipTopM(S.lat, S.lon, S.hdg);
  return (m == null) ? null : simGroundFt() + m / 0.3048;
}
// 함정에 옆으로 부딪히지 않는다 — 옮겨 간 자리에서 기체(20m) 아래에 지금 높이보다
// 높은 함정 부분(선체 옆면·함교·함수 구조물)이 있으면 옮겨 가기 전 자리로 되돌리고
// 그 자리에 세운다(07-sim.js 가 위치를 옮긴 뒤 부른다). 원래 겹쳐 있던 자리에서는
// 빠져나갈 수 있게 막지 않는다.
function simShipBlocked(lat, lon) {
  const m = simShipTopM(lat, lon, S.hdg);
  return m != null && S.alt < simGroundFt() + m / 0.3048 - 0.5;
}
function simShipCollide(lat0, lon0) {
  if (!simModeOn || !simShipBlocked(S.lat, S.lon) || simShipBlocked(lat0, lon0)) return false;
  S.lat = lat0; S.lon = lon0;
  S.spd = 0; simLat = 0; simAcc = 0;
  if (gspdOn) { gspdActFwd = 0; gspdActLat = 0; }
  return true;
}
// 내려앉을 수 있는 바닥(ft) — 지면, 함정 위에서는 갑판
function simFloorFt() {
  const d = simDeckFt(), g = simGroundFt();
  return (d == null) ? g : Math.max(g, d);
}
let _simOnDeck = false;              // 함정 갑판에 앉아 있는가
function simOnDeck() { return simModeOn && _simOnDeck && !!shipVisible; }
// 흔들리는 갑판에 바퀴로 앉아 있으면(레버를 LIGHT ON WHEELS 아래로) 헬기는 갑판과 한 몸이다 —
// 자세(ADI·3D 시야·외부 모형)를 갑판 자세 그대로 두고, 높이는 갑판 높이에 붙인다.
// AFCS·GSPD 가 자세를 만진 뒤(07-sim.js 한 걸음의 끝)에 부른다.
function simDeckLock() {
  if (!simOnDeck() || typeof shipMotionOn !== 'function' || !shipMotionOn()) return;
  const deck = simDeckFt();
  // 갑판이 내려가는 가속(최대 ~2.4m/s²)은 중력보다 작다 — 바퀴가 떨어지지 않고 따라 내려간다
  if (deck == null || S.alt - deck > 10) return;
  if (S.tq >= hoverPowerTq() + LOW_BAND[0]) return;      // 레버를 올려 가벼워졌다 — 조종사 몫이 섞인다
  const d = shipDeckAttitude(S.hdg);
  S.bnk = d.bank; S.pit = d.pitch; bankTarget = S.bnk;
  S.alt = deck; if (S.vs < 0) S.vs = 0;
}
// 갑판에 내려앉으면 속도를 '갑판에 대한 속도' 로, 뜨면 다시 '땅에 대한 속도' 로 바꾼다
// (함정 속도만큼 빼고 더한다). 그래야 움직이는 함정에 내려앉고 떠도 튀지 않는다 —
// 함정과 나란히 날다 내려앉으면 갑판 위에서는 거의 서 있고, 뜨면 함정 속도로 날고 있다.
function simDeckHandoff(toDeck) {
  if (typeof shipSpd !== 'number' || !shipSpd) return;
  const k = toDeck ? -1 : 1, rel = (shipHdg - S.hdg) * D2R;
  const sp = (typeof shipSpdNow === 'function') ? shipSpdNow() : shipSpd;
  const f = k * sp * Math.cos(rel), l = k * sp * Math.sin(rel);
  if (gspdOn) { gspdActFwd += f; gspdActLat += l; }
  else {
    S.spd = Math.max(SIM_SPD_BACK, Math.min(SIM_SPD_MAX, S.spd + f));
    simLat += l;
    // 뜨는 순간 함정 속도를 지키는 자세로 — 곧장 제자리 속도로 줄어들지 않게
    if (!toDeck) { S.pit = pitchFromSpd(S.spd); simTrimHoldSpeed(); simTrimHeld.pitch = null; }
  }
}

function simStartGround() {
  _simOnGnd = true;              // 바퀴가 붙은 채 시작한다 — 바람에 밀리지 않는다
  S.vs = 0; S.spd = 0; simLat = 0; simAcc = 0; simVsAcc = 0; simFlareVs = 0; simFlareVyVs = 0; _flareV0 = null; simNr = 100; simVrs = 0; simNrRel = 0;
  S.pit = 0; S.bnk = 0; bankTarget = 0;
  S.tq = 0;                      // 레버를 내려 둔 상태에서 올리며 뜬다
  simSetOnGround();              // 지면 높이 = AGL 0
}

// ── 그 자리 지면에 세운다(AGL 0) ──
// SIM 을 땅에서 켤 때와 비행계획의 출발지(ORIGIN)로 옮길 때. 지형 타일이 아직 안 왔으면
// 우선 아는 값(모르면 해수면)에 세우고, 타일이 오면 그 표고로 다시 맞춘다 — 그사이 떠올랐거나
// 다른 자리로 옮겨 갔으면 손대지 않는다.
let _simGndTimer = null;
function simSetOnGround() {
  const lat = S.lat, lon = S.lon;
  simTerrainFt(lat, lon);
  S.alt = simFloorFt();          // 함정 갑판 위면 갑판에
  if (_simGndTimer) { clearInterval(_simGndTimer); _simGndTimer = null; }
  try { updateAcOnMap(); } catch (e) { _swallow(e); }
  if (_simGndFresh) return;
  const placed = S.alt;
  let n = 0;
  _simGndTimer = setInterval(() => {
    if (++n > 40) { clearInterval(_simGndTimer); _simGndTimer = null; return; }   // 12초 기다리고 그만
    simTerrainFt(lat, lon);
    if (!_simGndFresh) return;
    clearInterval(_simGndTimer); _simGndTimer = null;
    if (Math.abs(S.alt - placed) < 2 && !(S.vs > 0) && distance(S.lat, S.lon, lat, lon) < 0.05) {
      S.alt = simFloorFt();
      try { updateAcOnMap(); } catch (e) { _swallow(e); }
    }
  }, 300);
}
// 항공기를 그 자리 지면에 멈춰 세운다 — 비행계획의 출발지로 옮길 때(06-nav.js)
function acPlaceOnGround() {
  if (simModeOn) { simStartGround(); return; }
  S.spd = 0; S.vs = 0; S.bnk = 0; bankTarget = 0;
  S.pit = pitchFromSpd(0);
  simSetOnGround();
}

function toggleSimMode(on, opt) {
  // 절차 훈련판(00-edition.js — Flightsimulator)에서는 SIM 모드를 켜지 않는다
  if (typeof SIM_ENABLED !== 'undefined' && !SIM_ENABLED && (on === undefined ? !simModeOn : !!on)) return;
  simModeOn = (on === undefined) ? !simModeOn : !!on;
  try { if (typeof simCamTx !== 'undefined') simCamTx = null; } catch (e) { _swallow(e); }   // 시점 전환 효과는 SIM 을 켜고 끌 때 거둔다
  gaOn = false; vsModeOn = false; tdOn = false; try { updateGaBtn(); } catch (e) { _swallow(e); }
  if (simModeOn) {
    // 사이클릭·페달의 가운데를 지금 자리로(처음 잡은 가운데가 밀린 자리였을 수 있다 — 12-joystick.js)
    try { if (typeof joyRecenterCyclic === 'function') joyRecenterCyclic(); } catch (e) { _swallow(e); }
    // 들어올 때는 AFCS 를 놓는다 — 상위모드는 들어온 뒤 조종사가 다시 건다
    // (걸면 그 축은 AFCS 가 몰고 조종간 값은 무시한다 — simAfcsLat·simAfcsVert)
    try { if (navApOn) toggleNavAp(); } catch (e) { _swallow(e); }
    try { if (gspdOn) toggleGspd(); } catch (e) { _swallow(e); }
    // GSPD 를 풀고 타력으로 옆·뒤로 가던 중이면 그 속도를 SIM 조종으로 넘겨 받는다
    // (타력 비행과 SIM 조종이 같은 속도를 함께 쓰지 않게)
    if (gspdCoasting) { S.spd = gspdActFwd; simLat = gspdActLat; gspdCoasting = false; }
    try { if (gsOn) toggleGs(); } catch (e) { _swallow(e); }
    hdgSelOn = false; rollApOn = false; altHoldOn = false; crhtOn = false; simIasOn = false; _rcLevPrev = null; simYawRate = 0; _simKePowered = false; _simKeVsF = 0; _rcYawBuf = []; _rcT = 0;
    _simOnDeck = false; _simOnGnd = false;
    _simEngBtn = 2; simOeiT = 0; simVrs = 0; simNrRel = 0; simNr = 100; simRbs = { r: 0, p: 0 };
    try { simEngApply(true); } catch (e) { _swallow(e); }    // 상부 콘솔(TQS · 레버 · TRAINING)대로 엔진 상태
    try { updateHoverBtns(); } catch (e) { _swallow(e); }
    // 손을 떼면 그 자리에서 날던 대로 — 지금 자세를 그대로 이어받는다
    bankTarget = S.bnk;
    simTrimReset();
    simAcc = 0; simVsAcc = 0; simFlareVs = 0; simFlareVyVs = 0; _flareV0 = null; simNr = 100; // 지금 날던 대로 이어 간다
    simLookReset();
    // 지금 날고 있는 상태를 유지할 만큼의 토크로 레버를 맞춰 둔다(진입 충격 방지)
    const add = simTqForVs(S.vs || 0);
    S.tq = Math.max(0, Math.min(mtaNow(), tqRequired() + add)); simTqCmd = S.tq;
    if (!S.running) toggleSim();        // 멈춰 있으면 바로 날기 시작한다
    // 땅에서 시작할지는 따로 주지 않으면 지금 자리로 정한다(지면 가까이면 땅에서)
    const ground = (opt && typeof opt.ground === 'boolean') ? opt.ground : simNearGround();
    if (ground) simStartGround();
    simEnterView();
  } else {
    simExitView();
    simIasOn = false;                    // 평소에는 속도가 늘 IAS 로 난다
    // 손을 뗀 자리에서 수평으로 돌려 놓는다(기울어진 채 남지 않게)
    bankTarget = 0; S.vs = 0; simLat = 0; simAcc = 0; simVsAcc = 0; simFlareVs = 0; simFlareVyVs = 0; _flareV0 = null; simNr = 100;
    simLookReset();
    selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1;
  }
  updateSimModeBtn();
  try { updateApInhibit(); } catch (e) { _swallow(e); }
  try { syncVStick(); } catch (e) { _swallow(e); }      // 화면 조종간은 SIM 에서만
}

// ── 바깥 그림도 조종석에서 보는 대로 ──
// SIM 모드에서는 지도 창을 3D 로 바꾸고 항공기를 따라가게 한다. 바꾸기 전
// 상태를 적어 두었다가 모드를 끄면 그대로 되돌린다.
let _simView = null;
function simEnterView() {
  if (_simView) return;
  const sides = panelSides();
  const get = panelGet;
  const v = { side: null, was: null, follow: followMode, overlay: false };
  if (!sides.some(k => get(k) === 'm3d')) {
    const mapSide = sides.find(k => get(k) === 'map');
    if (mapSide) { v.side = mapSide; v.was = 'map'; }
    else if (typeof _view3dOn !== 'undefined' && !_view3dOn) {
      // 지도 창이 아예 없으면 2D 위에 겹쳐 띄운다
      try { toggle3dMap(); v.overlay = true; } catch (e) { _swallow(e); }
    }
  }
  _simView = v;
  if (v.side) { try { selectPanel(v.side, 'm3d', true); } catch (e) { _swallow(e); } }
  // 조종석 시야이므로 항공기를 따라가야 한다
  try { if (!followMode) toggleFollow(); } catch (e) { _swallow(e); }
  try { syncChinView(); } catch (e) { _swallow(e); }   // 아래 좌·우 CHIN 창
}
function simExitView() {
  const v = _simView; _simView = null;
  try { if (typeof simExtView !== 'undefined') simExtView = false; } catch (e) { _swallow(e); }   // 다음에는 1인칭부터
  try { _apply3dRoll(); } catch (e) { _swallow(e); }
  try { syncChinView(); } catch (e) { _swallow(e); }       // CHIN 창을 닫는다
  try { _ml3dSimCameraOff(); } catch (e) { _swallow(e); }   // 1인칭 카메라(롤·90° 너머)를 되돌린다
  try { _update3dMarker(); } catch (e) { _swallow(e); }     // 제 마커를 다시 보인다
  if (!v) return;
  if (v.side) { try { selectPanel(v.side, v.was, true); } catch (e) { _swallow(e); } }
  if (v.overlay) { try { if (_view3dOn) toggle3dMap(); } catch (e) { _swallow(e); } }
  try { if (followMode !== v.follow) toggleFollow(); } catch (e) { _swallow(e); }
}

// ── 상승 효율(Vy) ──
// PERF 가 뽑는 최대상승속도(Vy)에서 상승률이 가장 크고, 그보다 빠르거나
// 느려질수록 같은 토크로도 덜 오른다. 제자리 호버나 고속 순항에서 같은
// 토크로 똑같이 오르던 것을 바로잡는다.
function simVyKt() {
  let vy = 70;
  try {
    const p = (typeof perfVy === 'function') ? perfVy() : null;
    if (Number.isFinite(p) && p > 20) vy = p;
  } catch (e) { _swallow(e); }
  return vy;
}
// 지금 속도에서 100% 토크로 낼 상승률(fpm)
function simClimbMax() { return simVsForTq(CLIMB_REF_TQ - tqRequired()); }
// 남는 토크(%) → 상승·강하율(fpm) — 곧게 비례
// 무게 보정 — 상승률은 '남는 동력 ÷ 무게' 다. 기준(PERF 16,000lb)보다 무거우면 같은 남는 토크로 덜 오르고,
// 오토로테이션 강하율(필요 동력 ÷ 무게)도 그만큼 바뀐다 — 필요 토크가 이미 무게·밀도고도를 담고 있어
// 결과는 √(무게/밀도) 꼴로 커진다(무겁고 덥고 높을수록 빨리 내려간다).
const CLIMB_WT_REF = 16000;
function simWtK() {
  let w = CLIMB_WT_REF;
  try { if (typeof perfWeightLb === 'function') w = perfWeightLb(); } catch (e) { _swallow(e); }
  return Math.max(0.7, Math.min(1.4, CLIMB_WT_REF / (w || CLIMB_WT_REF)));
}
function simVsForTq(dTq) {
  const k = simWtK();
  if (dTq > 0) return Math.min(SIM_VS_UP_MAX, CLIMB_FPM_UP * k * dTq);
  return Math.max(-SIM_VS_DN_MAX, CLIMB_FPM_DN * k * dTq);
}
// 위의 역 — 그 상승·강하율에 드는 남는 토크(%)
function simTqForVs(vs) {
  const k = simWtK();
  if (vs > 0) return Math.min(vs, SIM_VS_UP_MAX) / (CLIMB_FPM_UP * k);
  return vs / (CLIMB_FPM_DN * k);
}
// ── 바람 ── SIM 의 S.spd(앞) · simLat(오른쪽)은 대기속도다. 땅에 대한 속도 = 대기속도 + 바람.
// 땅에 대한 속도가 0(제자리)일 때의 대기속도 — 맞바람이면 앞(+), 오른쪽에서 불면 오른쪽(+).
// air 를 주면 공중(true)·바퀴가 붙음(false)으로 치고, 주지 않으면 지금 상태(windEffectFactor)로 셈한다.
function simWindRel(air) {
  const f = (air === undefined) ? windEffectFactor() : (air ? 1 : 0);
  if (!f || !(windSpd > 0)) return { fwd: 0, lat: 0 };
  const r = (windDir - S.hdg) * D2R;
  return { fwd: f * windSpd * Math.cos(r), lat: f * windSpd * Math.sin(r) };
}
// 대기속도(kt) — 필요 동력·VRS·VNE 가 쓴다. GSPD 중에는 S.spd 가 땅에 대한 속도라 바람을 더한다.
function simAirspeed() {
  if (gspdOn || gspdCoasting) {
    const w = _simOnGnd ? { fwd: 0, lat: 0 } : simWindRel(true);
    return Math.hypot(gspdActFwd + w.fwd, gspdActLat + w.lat);
  }
  return Math.hypot(S.spd, simLat);
}

// 한 적분 구간(dt초)의 조종 입력 적용. simStep 안에서 불린다.
function simFly(dt) {
  try { gaStep(dt); } catch (e) { _swallow(e); }
  try { tdStep(dt); } catch (e) { _swallow(e); }
  if (!simModeOn || !(dt > 0)) return;
  const a = simModeAxes();

  // 땅에 붙어 있는가 — 지면 위에서는 자세를 줘도 미끄러지지 않는다
  simTerrainFt();                       // 발밑 높이를 새로 읽어 둔다
  const deck = simDeckFt();             // 함정 위면 갑판(윗면) 높이
  const gnd = (deck == null) ? simGroundFt() : Math.max(simGroundFt(), deck);
  // 흔들리는 갑판에 앉아 있으면(바퀴가 떨어질 만큼 레버를 올리지 않았으면) 갑판을 따라 오르내린다
  if (_simOnDeck && deck != null && typeof shipMotionOn === 'function' && shipMotionOn() &&
      S.alt - gnd < 3 && S.tq < hoverPowerTq() + LOW_BAND[1]) { S.alt = gnd; if (S.vs < 0) S.vs = 0; }
  const onGnd = S.alt <= gnd + 0.5;
  // 갑판에 앉은 헬기가 느끼는 갑판 자세(롤·피칭)
  const deckAtt = (onGnd && _simOnDeck && typeof shipDeckAttitude === 'function') ? shipDeckAttitude(S.hdg) : { pitch: 0, bank: 0 };
  // 막 땅에 닿았다 — 그 순간의 강하율·속도를 알린다(오토로테이션 착지 연습)
  if (onGnd && !_simOnGnd && S.running) {
    simTouchdown(S.vs, S.spd);
    if (simParkBrake && S.spd > 5) {      // 활주 착륙 — 부서지지는 않지만 경고
      simParkWarn = 6;
      try { uiToast('PARKING BRAKE SET — 활주 착륙', 'err', 4000); } catch (e) { _swallow(e); }
    }
  }
  if (simParkWarn > 0) simParkWarn = Math.max(0, simParkWarn - dt);
  // 뜨는 순간 바람이 실리고(대기속도 = 땅에 대한 속도 − 바람), 앉는 순간 빠진다 — 속도가 튀지 않게 넘겨 준다
  if (onGnd !== _simOnGnd && !gspdOn && !gspdCoasting) {
    const w = simWindRel(true), k = onGnd ? -1 : 1;
    S.spd += k * w.fwd; simLat += k * w.lat;
  }
  _simOnGnd = onGnd;
  // 갑판에 내려앉거나 뜨는 순간 — 속도의 기준(함정 ↔ 땅)을 넘겨 준다
  const onDeck = onGnd && deck != null && deck >= simGroundFt();
  if (onDeck !== _simOnDeck) { simDeckHandoff(onDeck); _simOnDeck = onDeck; }

  // 상승률 가운데 감속이 돌려준 몫(운동에너지)은 빼고 본다 — 이미 속도로 치른
  // 것을 또 치르면 감속 → 상승 → 감속 이 되먹임으로 번진다.
  const vsKe0 = simKeVs(onGnd);
  const vsPow = S.vs - vsKe0 - Math.max(simFlareVs, simFlareVyVs);   // 출력(토크)이 만든 상승률(플레어 몫도 뺀다)

  // GSPD 가 걸려 있으면 자세·속도는 GSPD 가 맡는다 — 조종간 좌우·전후는
  // 07-sim.js 의 GSPD 수렴에서 fly-through 로 쓰인다(simGspdStick).
  // 페달·컬렉티브는 그대로 조종사 몫이다.
  if (gspdOn) { _simKePowered = false; _simKeVsF = 0; }
  if (!gspdOn) {
    // 조종간 값에 트림을 더한다 — 가운데 두어도 트림 자세를 지킨다
    const cl = v => Math.max(-1, Math.min(1, v));
    simTrimSlew(dt);
    const bnk0 = S.bnk, pit0 = S.pit;   // ASE Hover follow — 이 구간의 자세 변화 빠르기를 잰다
    const roll = cl(a.roll + simTrimEff('roll', a.roll) / SIM_BANK_MAX);
    const pitch = cl(a.pitch + simTrimEff('pitch', a.pitch) / SIM_PITCH_MAX);
    // 3점 접지 — 땅에서 토크가 LIGHT ON WHEELS 아래면 바퀴 셋이 받치고 있다. 트림·회전익 특성은
    // 자세를 바꾸지 못하고, 조종간으로 기수를 들거나 숙일 때만 움직인다(뱅크는 0).
    const gnd3 = onGnd && S.tq < hoverPowerTq() + LOW_BAND[0];
    // 후퇴익 실속 — VNE 를 넘긴 만큼 후퇴익 쪽으로 구르고 기수가 드는 몫이 쌓인다(넘지 않으면 풀린다)
    {
      const ov = onGnd ? -10 : Math.min(20, simAirspeed() - simVne());
      if (ov > 0) {
        simRbs.r = Math.min(RBS_MAX_ROLL, simRbs.r + RBS_ROLL * ov * dt);
        simRbs.p = Math.min(RBS_MAX_PITCH, simRbs.p + RBS_PITCH * ov * dt);
      } else { const k = Math.min(1, dt / 1.5); simRbs.r -= simRbs.r * k; simRbs.p -= simRbs.p * k; }
    }

    // ── 사이클릭 좌우 → 뱅크 ──
    // HDG·NAV 가 걸려 있으면 뱅크는 AFCS 가 잡는다(07-sim.js) — 조종간 좌우는 무시한다.
    if (!simAfcsLat()) {
      simTf = (rcOn('transverse') && !onGnd) ? -rotorSign() * RC_TF_BANK * rcTransverseK(simAirspeed()) * (aseOn ? RC_TF_ASE : 1) : 0;
      const bTgt = (gnd3 ? 0 : roll * SIM_BANK_MAX) + deckAtt.bank + rotorSign() * simRbs.r + simTf;
      const dB = bTgt - S.bnk;
      S.bnk += Math.sign(dB) * Math.min(Math.abs(dB), SIM_ROLL_RATE * dt);
      bankTarget = S.bnk;           // 모드를 빠져나가도 자세가 튀지 않게
    }

    // ── 사이클릭 전후 → 피치 ──
    // 조종간을 밀면(+) 기수가 내려간다. S.pit 은 기수 올림이 +.
    // IAS 가 걸려 있으면 기준은 IAS 자세다 — 조종간 몫만큼 벗어났다가(트림은 쓰지 않는다),
    // 놓으면 그 자세로 천천히 돌아온다.
    let pTgt = -pitch * SIM_PITCH_MAX, pRate = SIM_PITCH_RATE;
    if (simAfcsPitch()) {
      pTgt = Math.max(-SIM_PITCH_MAX, Math.min(SIM_PITCH_MAX, simIasPitch() - a.pitch * SIM_PITCH_MAX));
      if (!a.pitch) pRate = SIM_IAS_RATE;
    }
    // 회전익 특성 — 컬렉티브·페달이 피치로 옮겨 간다. IAS·G/A·T/D 처럼 AFCS 가 자세를 잡고 있으면 AFCS 가 메운다
    if (!simAfcsPitch()) pTgt += rcPitchOff(rcAxes(a));
    // 블로우 백(flapback) — 전진하며 8~10kt 를 지나면 원판이 뒤로 젖혀져 기수가 2.5° 들린다. 후진 비행에는 없다.
    //  · ASE 꺼짐: 들린 채 남는다 — 조종사가 조종간(또는 트림)으로 한 번 더 밀어 줘야 한다(들린 만큼 속도도 준다).
    //  · ASE 켜짐: SAS 가 잡아 준다 — 10~15kt 에서 한 번 들렸다가 18kt 에서 사라지고, 속도 기준은 그대로다.
    const pBase = pTgt;
    simBb = (rcOn('blowback') && !onGnd && !simAfcsPitch()) ? RC_BLOWBACK * rcBlowbackK(S.spd, aseOn) : 0;
    pTgt += simBb;
    if (gnd3) pTgt = -a.pitch * SIM_PITCH_MAX;
    pTgt += deckAtt.pitch;               // 흔들리는 갑판 위에서는 갑판 자세를 따른다
    pTgt += simRbs.p;                    // 후퇴익 실속 — 기수가 든다
    // 땅 위에서는 바퀴가 받치므로 위아래 10° 까지만 기운다
    if (onGnd) pTgt = Math.max(-GND_PITCH_MAX, Math.min(GND_PITCH_MAX, pTgt));
    const dP = pTgt - S.pit;
    S.pit += Math.sign(dP) * Math.min(Math.abs(dP), pRate * dt);
    aseHoverFollow(a, onGnd, (S.bnk - bnk0) / dt, (S.pit - pit0) / dt);

    // ── 피치 → 속도 ──
    // 고도를 지키며 나는 헬기는 '자세 하나가 곧 속도' 다 — 수평 120kt,
    // 기수 2° 100kt, 6° 호버(01-state.js PITCH_SPD). 그 속도로 천천히 수렴한다.
    // 기수를 더 들면 뒤로도 간다(7.6° ≈ −40kt). 감속 강하(레버를 내린 채)면 7.5° 35kt 에서 멎는다.
    // 오르내리는 동안에도 같은 자세면 같은 속도로 수렴한다(상승·강하로 어긋나지 않는다).
    // 상승 파워에서는 기수 5° 가 80kt(수평 비행에서는 4°) — 남는 토크만큼(10% 에서 다) 1° 를 덜 들어 본다
    // (상승률로 가르면 감속 → 상승 → 감속 으로 되먹임이 생긴다)
    const manual = !simAfcsPitch() && !simAfcsVert() && S.spd > 40;   // 조종사가 직접 몰 때(40kt 위)만
    // 상승 중 자세에 따른 속도 차 — 남는 토크만큼 같은 자세에서 빠르다. 오르내림이 500fpm 아래면 없다
    // (강하 쪽은 '자세가 곧 속도' 그대로 — 강하 파워에서 기수를 들면 남은 속도에 정비례해 준다)
    const vsK = Math.max(0, Math.min(1, ((S.vs || 0) - TQ_KT_VS0) / (TQ_KT_VS1 - TQ_KT_VS0)));   // 오를 때만(가라앉는 중의 남는 토크는 속도가 되지 않는다 — RPM LOW 등)
    const tqKt = manual ? vsK * Math.max(0, Math.min(TQ_KT_MAX, TQ_KT * (S.tq - tqRequired()))) : 0;
    // 남는 출력이 낸 속도차(자세가 정한 속도보다 빠른 몫)는 엔진이 치른다 — 고도와 맞바꾸지 않는다(simKeVs)
    // 속도 기준 자세 — 트림이 잡고 있으면 블로우 백 들림은 빼고 본다(트림 자세 그대로)
    const pitRef = (aseOn && simBb > 0 && S.pit > pBase) ? Math.max(pBase, S.pit - simBb) : S.pit;   // ASE 일 때만 속도 기준을 지킨다
    _simKePowered = tqKt > 0 && S.spd >= spdFromPitch(pitRef) - 0.5;
    // 감속 강하(접근) — 수평 비행 파워보다 레버를 내린 채(5% 모자라기 시작해 10% 에서 다) 기수를 들면
    // 감속 강하의 자세-속도(7.5° → 35kt)를 따른다. 수평 파워로 받치면 다시 수평 비행의 식(6° 호버)으로 더 준다
    const descK = (!simAfcsPitch() && !simAfcsVert() && !onGnd) ? Math.max(0, Math.min(1, (tqRequired() - S.tq - DESC_TQ) / DESC_TQ)) : 0;
    const vPit = spdFromPitch(pitRef), vDesc = Math.max(vPit, spdFromPitchDesc(pitRef));
    const sTgt = Math.max(SIM_SPD_BACK, Math.min(SIM_SPD_MAX, vPit + descK * (vDesc - vPit) + tqKt));
    if (onGnd) {
      // 바퀴로 구른다 — 토크 20% 를 넘기면 천천히 앞으로, 사이클릭을 민 만큼 더 빨리
      let acc;
      if (simParkBrake) {
        acc = -Math.min(GND_PARK_BRK, Math.abs(S.spd) / dt) * Math.sign(S.spd);
      } else if (simEmerBrake) {                            // EMER — 스페이스보다 세고 파킹 SET 보다 약하다
        acc = -Math.min(GND_EMER_BRK, Math.abs(S.spd) / dt) * Math.sign(S.spd);
      } else if (S.tq >= GND_TQ_ROLL && !simWheelBrake) {
        acc = GND_CREEP * (S.tq - GND_TQ_ROLL) + GND_CYC_ACC * (-S.pit) - GND_DRAG * S.spd;
      } else {
        // 기수를 들고(10° 에서 다) 레버를 내리면 에어로다이나믹 브레이크 — 자연 감속의 3배
        const aero = S.tq < GND_TQ_ROLL ? 1 + GND_AERO_K * Math.max(0, Math.min(1, S.pit / GND_PITCH_MAX)) : 1;
        const brk = Math.max(S.tq < GND_TQ_ROLL ? GND_BRAKE * aero : 0, simWheelBrake ? GND_WHEEL_BRK : 0);
        acc = -Math.sign(S.spd) * Math.min(brk, Math.abs(S.spd) / dt);
      }
      if (S.spd + acc * dt < 0) acc = -S.spd / dt;          // 뒤로는 구르지 않는다
      simAcc = acc;
    } else {
      // 가감속은 점점 커진다 — 기수를 들면 감속이, 숙이면 가속이 갈수록 세진다
      const ds = sTgt - S.spd;
      const lim = simAccLimit(ds, pitRef);
      if (manual && S.tq < tqRequired() - DESC_TQ && ds < 0) {
        // 강하 파워에서 기수를 들면 — 감속이 점점 세지지 않고 남은 속도에 정비례해 곧바로 준다
        simAcc = Math.max(-lim.max, ds * DESC_DEC_K * SIM_RATE_K / SIM_DEC_TIME);
      } else {
        simAcc = simJerkStep(ds, simAcc, dt, lim.max, lim.jerk, 1, lim.jerk * JERK_RELEASE);
      }
    }
    S.spd = Math.max(SIM_SPD_BACK, Math.min(SIM_SPD_MAX, S.spd + simAcc * dt));
    // 자세가 정한 속도와의 차이 → 오르내림(simKeVs)
    if (onGnd) _simKeVsF = 0;
    else {
      // 운동에너지 ↔ 위치에너지 — 상승률 = −η·V·a/g. 감속(줄어드는 ½V²)은 고도로 돌아오고 가속은 고도로 치른다.
      // 같은 η 를 양쪽에 쓰므로 줄였다 늘리면 고도가 제자리로 돌아온다(에너지 보존). 가감속의 빠르기(자세 배율·
      // 감속 시간 배율)는 이미 a 에 들어 있어 따로 곱하지 않는다 — 감속이 느리면 강하율 감소도 그만큼 느리고 오래 간다.
      const accUp = S.spd * simAcc > 0;                           // 속도 크기가 느는 쪽(가속)
      let ke = -SIM_KE_ETA * SIM_KE_FPM * S.spd * simAcc;
      if (_simKePowered && accUp) ke = 0;                        // 남는 출력이 낸 속도차(그 속도까지 붙는 가속)는 엔진 몫 — 감속은 그대로 고도로 돌아온다
      // 남는 출력(수평 비행 토크보다 많이)을 걸고 가속할 때는 엔진이 속도를 낸다 — 고도로 치르지 않는다
      // (남는 토크 0 → 5% 사이에서 서서히). 수평 비행 출력에서 기수를 숙여 가속하면 종전대로 고도로 치른다.
      // 그래서 같은 토크로 이륙 가속하면 Vy 까지 상승률이 점점 오르고(속도·TQ 효율), Vy 를 넘으면 상승 효율이 떨어져 준다.
      // (ALT·CRHT 가 출력을 몰 때는 빼고 — 그때는 AFCS 가 가속에 드는 출력을 더 써서 고도를 지킨다)
      if (accUp && !simAfcsVert()) ke *= 1 - Math.max(0, Math.min(1, (S.tq - tqRequired()) / KE_PWR_FREE));
      if (accUp && Math.abs(S.spd) < SPD_ETL_KT && S.tq >= hoverPowerTq() + HOV_TO_MARGIN) ke = 0;   // 호버 이륙 가속
      // 전이양력 지대(20kt 언저리)를 지나며 가속할 때의 침하는 회전익 특성 — 끄면 없다
      // (지면효과(IGE)를 받는 40ft 이내에서만 — 그 위에서는 침하가 없다)
      if (accUp && Math.abs(S.spd) < SPD_ETL_KT && (!rcOn('etl') || S.alt - simGroundFt() > RC_IGE_FT)) ke = 0;
      _simKeVsF += (ke - _simKeVsF) * Math.min(1, dt / KE_TAU);
    }

    // ── 저속에서는 뱅크가 옆걸음이 된다 ──
    // 제자리에서 오른쪽으로 기울이면 기수는 그대로 둔 채 오른쪽으로 간다.
    // 속도가 붙으면 그 몫이 선회로 넘어간다(선회 자체는 07-sim.js 가 한다).
    const side = (1 - simTurnFrac()) * Math.sin(S.bnk * D2R) / Math.sin(SIM_BANK_MAX * D2R);
    // 회전익 특성 — 전이성향(translating tendency): 호버에서 CW 로터는 왼쪽, CCW 는 오른쪽으로 흐른다.
    // 그 몫은 뱅크 3° 가 내는 옆걸음과 같다 — 로터 반대 쪽으로 3° 기울여야 제자리를 지킨다.
    const drift = rotorChar ? -rcLowK() * rotorSign() * (1 - simTurnFrac()) * Math.sin(RC_DRIFT_BANK * D2R) / Math.sin(SIM_BANK_MAX * D2R) : 0;
    const latTgt = onGnd ? 0 : Math.max(-SIDE_MAX_KT, Math.min(SIDE_MAX_KT, (side + drift) * SIDE_MAX_KT));
    simLat += (latTgt - simLat) * Math.min(1, (onGnd ? 1.2 : SIDE_K) * dt);
  }

  // ── 페달 → 기수 ──
  // HDG·NAV 가 기수를 잡고 있으면 페달은 무시한다(선택 헤딩으로 되돌리며 싸운다)
  // 페달 요율은 곧바로 붙지 않고 SIM_YAW_TAU 로 따라붙고, 놓으면 같은 빠르기로 멎는다
  if (!simAfcsLat()) {
    simYawRate += (a.yaw * SIM_YAW_RATE - simYawRate) * Math.min(1, dt / SIM_YAW_TAU);
    if (Math.abs(simYawRate) < 0.01 && !a.yaw) simYawRate = 0;
    if (simYawRate) {
      S.hdg = normA(S.hdg + simYawRate * dt);
      selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1;
    }
  } else simYawRate = 0;
  // 회전익 특성 — 선회 중 1/2 볼 외활(skid): 볼이 선회 바깥쪽으로 반 볼 비킨다(20kt 위 · 뱅크 10° 에서 다)
  simSkidHalf = (rotorChar && !onGnd && !simAfcsAny()) ? -Math.sign(S.bnk) * Math.min(1, Math.abs(S.bnk) / 10) * (1 - rcLowK()) : 0;
  // 회전익 특성 — 컬렉티브 토크의 반작용으로 동체가 돈다(공중에서만). 호버 토크에서 벗어난 만큼 계속 돌고
  // 반대 페달(simYawRate)로 잡아 줘야 멎는다 — 실제로 걸린 컬렉티브(AFCS 가 몰 때 포함)를 쓴다
  const defl = rcCollDefl();
  // 0.5초 늦게 나타난다(RC_YAW_DELAY) — 레버를 움직인 뒤 토크 반작용이 동체를 돌리기까지
  _rcT += dt;
  _rcYawBuf.push({ t: _rcT, r: (rotorChar && !onGnd) ? rcYawRate(defl) : 0 });
  while (_rcYawBuf.length > 1 && _rcYawBuf[1].t <= _rcT - RC_YAW_DELAY) _rcYawBuf.shift();
  const yrDelayed = (_rcYawBuf[0].t <= _rcT - RC_YAW_DELAY + 1e-9) ? _rcYawBuf[0].r : 0;
  if (rotorChar && !onGnd && !simAfcsLat()) {
    const yr = yrDelayed;
    if (yr) { S.hdg = normA(S.hdg + yr * dt); selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; }
  }

  // ── 컬렉티브 → 토크 ──
  // 레버 자리가 곧 토크다. 토크는 천천히 따라 오른다(엔진·로터 관성).
  // 컬렉티브 축을 배정하지 않았으면 레버가 없는 셈이다 — 지금 고도를 지킬
  // 만큼만 걸어 둔다(조이스틱 없이 켰다고 저절로 떠오르지 않게).
  // ALT·CRHT 가 걸려 있으면 레버는 무시하고 AFCS 가 출력(토크)으로 고도를 지킨다
  // (simAfcsVsCmd) — 고도를 곧바로 옮기지 않는다. 기수를 숙여 가속하면 운동에너지로
  // 바뀐 만큼 고도가 빠지려 하고, 뱅크를 주면 필요 토크가 늘어 가라앉으려 한다. 그만큼
  // 토크를 더 써서 고도를 되찾는다 — 출력이 따라붙는 동안 고도가 조금 빠졌다 돌아온다.
  const vert = simAfcsVert();
  // 화면 조종간을 쓰면 컬렉티브는 그 레버(세워 두는 레버)다
  const cfg = vStickActive() ? { abs: true, virt: true } : (typeof joyAxes === 'object' && joyAxes) ? joyAxes.coll : null;
  let tTgt;
  if (vert) {
    tTgt = tqRequired() + simTqForVs(simAfcsVsCmd() - simKeVs(onGnd));
  }
  // 레버가 없으면: 땅에서는 그대로 서 있고(출력 0), 공중에서는 수평 비행에 드는
  // 만큼 건다(속도를 바꾸면 그 운동에너지만큼은 오르내린다)
  else if (!cfg) tTgt = onGnd ? 0 : tqRequired();
  else if (cfg.abs) {
    // 스로틀·컬렉티브처럼 '세워 두는' 레버는 자리 자체가 출력이다.
    // 맨 아래 0% … 맨 위 140%(그날의 MTA 를 넘겨 당길 수 있게).
    tTgt = cfg.virt ? vStick.coll * SIM_LEVER_TOP : (joyAxRaw('coll') + 1) / 2 * SIM_LEVER_TOP;
  } else {
    // 가운데로 돌아오는 축은 호버 토크를 기준으로 오르내린다 — 끝까지 올리면 140%,
    // 끝까지 내리면 호버 −45%
    const hov = hoverTqRef();
    tTgt = hov + a.coll * (a.coll > 0 ? SIM_LEVER_TOP - hov : TQ_SPAN);
  }
  tTgt = Math.max(0, Math.min(TQ_MAX, tTgt));
  simTqCmd = tTgt;
  // ── 꼬리로터 ── 페달이 쓰는 토크도 엔진이 낸다(계기 토크에 더해진다)
  const trTq = onGnd && S.tq < 5 ? 0 : simTrTq(a, simAirspeed());
  // ── 엔진이 낼 수 있는 토크(그날의 MTA · OEI · IDLE) ── 그 이상은 내지 못하고, 모자란 몫은 로터 회전(NR)이 낸다
  // (AFCS·레버 없음일 때는 낼 수 있는 만큼만 건다 — 넘겨 당기는 손이 없다)
  if (simEng === 1) simOeiT += dt;
  const avail = simEngAvail();
  let demand = Math.max(0, tTgt + trTq);
  if (!cfg || vert) demand = Math.min(demand, avail);
  const U = Math.max(0, demand - avail);                       // 엔진이 못 내는 몫
  tTgt = Math.min(demand, avail);                               // 엔진 토크(계기)
  // NR — 오토로테이션 강하가 자리 잡은 정도(wA)만큼 바람이 로터를 돌린다
  const preq = tqRequired();
  const wA = Math.max(0, Math.min(1, -(S.vs || 0) / (CLIMB_FPM_DN * Math.max(10, preq))));
  const flareNr = (!onGnd && (U > 0 || wA > 0.3)) ? NR_FLARE_K * Math.max(0, -simAcc) : 0;
  // 자동회전으로 자리 잡은 정도(wA)만큼 NR 은 수정표의 값(컬렉티브 최하단)으로 가고, 레버를 올린 만큼(1% 당 NR_AUTO_K) 낮아진다.
  // 엔진이 돌면(거버너) NR 은 100% 아래로 내려가지 않고, 그 위로만 넘친다(바늘 갈라짐 — NP 는 100% 그대로)
  const nrAuto = autoNrChart() - NR_AUTO_K * demand;
  const lowLev = (U === 0 && !onGnd) ? Math.max(0, wA * (nrAuto - 100)) : 0;
  const govLag = onGnd ? 0 : (tTgt > S.tq ? -NR_GOV_DROOP * (tTgt - S.tq) : NR_GOV_RISE * (S.tq - tTgt));   // 거버너 지연
  const nrTgt = Math.max(NR_FLOOR, Math.min(118, (U > 0 ? 100 - NR_AUTO_K * U + wA * (autoNrChart() - 100) + flareNr : 100 + lowLev + flareNr) + govLag));
  // 거버너 지연 몫은 따로 들고 있는다 — 계기 NR 에는 보이되(잠깐 처짐·넘침), 양력 손실·로터 에너지 셈에는
  // 넣지 않는다(레버를 올려 추력이 느는 동안 엔진이 따라붙는 것이라 그만큼 가라앉지 않는다)
  const gov0 = _simNrGov;
  _simNrGov += (govLag - _simNrGov) * Math.min(1, dt / (govLag < _simNrGov ? NR_TAU_DN : NR_TAU_UP));
  const nr0 = simNr;
  simNr += (nrTgt - simNr) * Math.min(1, dt / (nrTgt < simNr ? (avail < AUTO_ENG_TQ && U > AUTO_LREF ? AUTO_NR_TAU_DN : NR_TAU_DN) : NR_TAU_UP));
  // 땅 위에서는 엔진 상태대로 — FLY 가 하나라도 있으면 100 · 두 엔진 IDLE 53 · 한 엔진 IDLE 47 · 둘 다 OFF 0(03-pfd.js engNrTarget)
  // (엔진이 FLY 가 아니면 레버 위치와 상관없다 — 땅 위의 로터는 바람으로 돌지 않는다)
  if (onGnd) {
    const g = engNrTarget(simEngSt);
    if (g >= 100) { if (U === 0 && simNr < 100) simNr = Math.min(100, simNr + 20 * dt); }
    else simNr = nr0 < g ? Math.min(g, nr0 + NR_SPOOL_UP * dt) : Math.max(g, nr0 - NR_SPOOL_DN * dt);   // 위 로터 운동은 버리고 엔진대로
  }
  // 처지는 NR 의 운동에너지는 레버가 요구하는 만큼(U)까지 잠깐 양력이 된다 — 오르는 NR 은 그만큼 받아들인다
  // 오토로테이션(엔진 가용 AUTO_ENG_TQ 미만)에서 로터에 담긴 에너지는 호버 동력 1초 남짓이다 — 레버를 당겨 쓰는 쿠션은
  // 강하를 멈출 만큼이지 떠오를 만큼은 아니다(AUTO_NR_E 배)
  simNrRel = Math.max(-20, Math.min(U, NR_E_K * (avail < AUTO_ENG_TQ ? AUTO_NR_E : 1) * ((nr0 - gov0) - (simNr - _simNrGov)) / dt));
  // 레버를 따라 천천히 붙되(TQ_TAU), 한 번에 TQ_RATE 보다 빨리 변하지는 않는다
  const dT = (tTgt - S.tq) * Math.min(1, dt / TQ_TAU);
  S.tq += Math.sign(dT) * Math.min(Math.abs(dT), TQ_RATE * dt);
  // LIGHT ON WHEELS — 땅에 붙은 채 토크가 HOV−20 … HOV−10% (조금 더 올리면 바퀴가 떨어진다)
  { const hov = hoverPowerTq(); simLow = onGnd && S.tq >= hov + LOW_BAND[0] && S.tq < hov + LOW_BAND[1]; }

  // ── 남는 토크 → 상승·강하 ──
  // 필요한 토크보다 남으면 오르고, 모자라면 내려간다. 그래서 같은 레버라도
  // 선회를 걸면 가라앉고(필요 토크 증가), 속도가 붙으면 저절로 떠오른다.
  // 오르는 쪽: 제자리 호버 → 100% 가 0 → 1,000fpm, Vy 에서는 100% 에 2,300fpm(simVsForTq).
  // 내리는 쪽: PERF 의 강하 토크표.
  // 꼬리로터 몫도 엔진 토크와 같은 지연으로 빠진다 — 페달을 차는 순간 출력만 먼저 빠져 가라앉지 않게
  _simTrTqF += (trTq - _simTrTqF) * Math.min(1, dt / TQ_TAU);
  const dTq = S.tq - _simTrTqF + simNrRel - preq;
  let vRaw = simVsForTq(dTq);
  // VRS — 저속에서 출력을 건 채 빠르게 가라앉으면 자기 내리흐름에 빠진다
  {
    const V = simAirspeed();
    const inV = !onGnd && V < VRS_KT && (S.vs || 0) < VRS_FPM && S.tq > VRS_TQ;
    const outV = onGnd || V > VRS_OUT_KT || (S.vs || 0) > -300 || S.tq < VRS_TQ - 5;
    const tgt = inV ? 1 : outV ? 0 : simVrs;
    simVrs += (tgt - simVrs) * Math.min(1, dt / (tgt > simVrs ? VRS_TAU_IN : VRS_TAU_OUT));
    if (simVrs > 0.01) { if (vRaw > 0) vRaw *= 1 - 0.8 * simVrs; vRaw -= VRS_SINK * simVrs * Math.max(0.5, S.tq / Math.max(30, preq)); }
  }
  // RPM LOW — 양력이 NR² 로 줄어 오르던 힘이 빠지고 그만큼 가라앉는다
  const nrL = Math.min(115, simNr - _simNrGov);   // 양력에 쓰는 NR(거버너 지연 몫은 뺀다)
  // 엔진이 출력을 거의 못 낼 때(두 엔진 IDLE·고장 — 오토로테이션)는 NR 이 내려가도 로터가 내주는 에너지(simNrRel)
  // 로 받치는 것이 중심이다 — 레버를 조금 올려 NR 과속을 견제하거나, 마지막에 레버를 당겨(쿠션) NR 을 강하율과
  // 맞바꾸는 조작이 먹혀야 한다. 양력 손실은 NR 이 AUTO_NR_OK(90%) 아래로 처질 때부터, 출력 비행의 RPM LOW 보다
  // 훨씬 부드럽게 붙는다. (출력 비행에서 MTA 를 넘겨 당긴 RPM LOW 는 종전대로)
  const autoRot = avail < AUTO_ENG_TQ;
  const nrDef = autoRot ? 1 - Math.pow(Math.min(100, nrL + (100 - AUTO_NR_OK)) / 100, 2) : 1 - (nrL / 100) * (nrL / 100);
  if (nrDef > 1e-4) vRaw = autoRot ? vRaw - AUTO_NR_SINK * nrDef : vRaw * Math.max(0, 1 - 5 * nrDef) - SIM_NR_SINK * nrDef;
  const vTgt = Math.max(-SIM_VS_DN_MAX, Math.min(SIM_VS_UP_MAX, vRaw));
  // 출력 몫은 점점 빨라지며 붙고(simVsAcc), 운동에너지 몫은 가감속과 함께 바로 붙는다.
  // 땅 가까이(지면효과 안)에서는 곧(0.3초) 따라간다 — 높이마다 드는 토크가 가파르게
  // 달라지므로(3·5·10ft), 늦게 따라가면 그 호버 높이를 지나쳐 위아래로 출렁인다.
  // 12ft 아래는 빠르게, 20ft 위는 평소대로, 그 사이는 섞는다.
  const aglG = S.alt - gnd;
  const wG = Math.max(0, Math.min(1, (aglG - 12) / 8));
  // 내려가던 중 강하율이 줄어드는 쪽(레버를 올려 강하를 멈출 때)은 두 배 느리게 붙는다
  // (오토로테이션에서 레버를 당기는 쿠션은 로터 에너지가 곧바로 추력이 되므로 늦추지 않는다)
  const vsSlow = vsPow < 0 && vTgt > vsPow && !(simEngAvail() < AUTO_ENG_TQ) ? SIM_DEC_TIME : 1;
  const accSlow = simJerkStep(vTgt - vsPow, simVsAcc, dt, VS_ACC_MAX * SIM_RATE_K / vsSlow, VS_JERK * SIM_RATE_K / (vsSlow * vsSlow), 50);
  // 오토로테이션 쿠션 — 레버를 당겨 로터 에너지(simNrRel)를 쓰는 동안은 추력이 곧바로 붙는다(엔진 출력처럼 점점 붙지 않는다)
  const cushion = simEngAvail() < AUTO_ENG_TQ && simNrRel > 2;
  const vsFast = vsPow + (vTgt - vsPow) * Math.min(1, dt / (cushion ? AUTO_CUSH_TAU : VS_IGE_TAU));
  const vsP = vsFast + (vsPow + accSlow * dt - vsFast) * (cushion ? 0 : wG);
  // 이어 받는 '변화 빠르기' 는 평소 한계(VS_ACC_MAX) 안에 둔다 — 땅 가까이의 빠른 몫까지
  // 그대로 넘기면, 20ft 위로 올라선 뒤 평소 셈이 그 큰 값을 몇십 초 동안 풀지 못해
  // 상승률이 수천 fpm 으로 치솟는다(플레어 뒤 레버를 올려 받칠 때 드러났다)
  simVsAcc = Math.max(-VS_ACC_MAX * SIM_RATE_K, Math.min(VS_ACC_MAX * SIM_RATE_K, (vsP - vsPow) / dt));
  // 오토로테이션 플레어 — 로터 추력이 곧(FLARE_TAU) 따라온다
  simFlareVs = onGnd ? 0 : simFlareVs + (simFlareTgt(onGnd) - simFlareVs) * Math.min(1, dt / FLARE_TAU);
  simFlareVyVs = onGnd ? 0 : simFlareVyVs + (_flareVyTgt - simFlareVyVs) * Math.min(1, dt / (_flareVyTgt < simFlareVyVs ? FLARE_VY_TAU_OFF : FLARE_VY_TAU));
  // 기수를 숙여 가속하며 레버를 내려도 강하는 4,000fpm 에서 멎는다(운동에너지 몫 포함)
  S.vs = Math.max(-SIM_VS_DN_MAX, vsP + simKeVs(onGnd) + Math.max(simFlareVs, simFlareVyVs));
  if (S.vs <= -SIM_VS_DN_MAX && simVsAcc < 0) simVsAcc = 0;   // 한계에 눌린 채 쌓이지 않게
  // 땅 아래로는 내려가지 않는다 — 바닥은 해수면이 아니라 '발밑의 지면' 이다
  if (S.alt <= gnd + 0.5 && S.vs < 0) { S.vs = 0; S.alt = gnd; if (simVsAcc < 0) simVsAcc = 0; }

}

// 화면 버튼(data-act) 연결 — 이 파일이 11-charts.js 보다 나중에 로드되므로
// 거기 목록에 넣으면 아직 정의되지 않은 이름이 된다. 여기서 직접 등록한다.
// ── 시작 화면 — 비밀번호 다음에 고른 화면으로 앱이 뜬 뒤 바로 들어간다(00-gate.js) ──
// (같은 탭에서 새로고침해도 그 화면으로 — sessionStorage 의 vfrStartMode)
(function startModeApply() {
  let mode = null;
  try { mode = window.vfrStartMode || sessionStorage.getItem('vfrStartMode'); } catch (e) { mode = window.vfrStartMode || null; }
  const t = setInterval(() => {
    if (window.gateLocked) return;                       // 아직 비밀번호·화면 고르기 중
    if (!mode) { try { mode = window.vfrStartMode || sessionStorage.getItem('vfrStartMode'); } catch (e) { _swallow(e); } }
    clearInterval(t);
    if (mode === 'sim') { setTimeout(() => { try { simLayoutStart(); } catch (e) { _swallow(e); } }, 400); return; }   // SIM Mode — 창 배치판
    if (mode === 'simple') { setTimeout(() => { try { simpleModeStart('pfd'); } catch (e) { _swallow(e); } }, 300); return; }   // Simple mode — 창 하나씩
    // Cockpit Mode — 3D 조종석(07-sim.js cockpitStart). 예전 '3D 단독 모드'(3d)로 적혀 있던 탭도 이리로
    if (mode === 'cockpit' || mode === '3d') { setTimeout(() => { try { cockpitStart(); } catch (e) { _swallow(e); } }, 300); return; }
  }, 200);
})();
// toggleFcp3d 는 04-map.js 에 있다(그 파일은 appRegister 보다 먼저 읽혀 여기서 연결한다)
try { appRegister({ toggleSimMode, simModeBtnPress, toggleRotorChar, setRotorDir, toggleAse, toggleRcOpt, cycleSimEng, toggleFcp3d, toggleVStick, toggleGyro, gyroAlign, gaEngage, tdownSet, tdhEngage, toggleHocas, hocasCenter, hocasDefault }); } catch (e) { _swallow(e); }
try { updateSimModeBtn(); } catch (e) { _swallow(e); }
