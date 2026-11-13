// ── SYSTEM 창(MFD 계통 화면) ──
// 탭의 'SYSTEM' 으로 연다. CDU 의 Aircraft Systems 아홉 버튼이 이 창의 화면을 고른다(sysPageSet).
// 왼쪽은 엔진·계통 띠(TGT · NG · EOT · EOP · MGB · Fuel F · Fuel P · HYD P · Fuel QTY · Battery · ACCP),
// 위는 정보 줄(FOD · END · VSR · FLT · DNALT · CCG · TOD · MSA), 가운데 큰 칸이 고른 계통 화면이다.
// 지금 갖춘 화면은 Fuel — 나머지는 이름과 '준비 중'.
//
// 그림은 1000×630 의 설계 크기로 그려 창에 맞춰 줄이고 키운다(실기 MFD 사진의 비율).

const SYS_W = 1000, SYS_H = 630;
const SYS_PAGES = {
  asys_afcs: 'AFCS', asys_status: 'Aircraft Status', asys_elec: 'Electrical', asys_eng: 'Engines',
  asys_fuel: 'Fuel', map: 'Map', asys_ratest: 'RA Self Test', asys_hocas: 'HOCAS', asys_tests: 'System Tests', asys_light: 'Lighting Config', asys_video: 'Video', asys_maint: 'Maintenance',
};
let sysPage = 'asys_fuel';
function sysPageSet(id) {
  if (!SYS_PAGES[id]) return;
  const wasMap = sysPage === 'map';
  sysPage = id;
  // Map 화면 — 큰 칸에 2D 지도(#map-wrap)를 옮겨 넣는다(07-sim.js applyPanels 가 #sysp-map 을 그릇으로 쓴다)
  if (wasMap !== (id === 'map')) { try { applyPanels(); } catch (e) { _swallow(e); } }
  try { sysDraw(); } catch (e) { _swallow(e); }
}
// SYSTEM 창의 Map 화면이 지도를 담고 있나 — 지도가 다른 창에 보이지 않을 때만(07-sim.js applyPanels)
function sysMapSlot() {
  if (sysPage !== 'map') return null;
  const w = document.getElementById('sysp-wrap');
  if (!w) return null;
  let slot = document.getElementById('sysp-map');
  if (!slot) { slot = document.createElement('div'); slot.id = 'sysp-map'; w.appendChild(slot); }
  return slot;
}

// ── 연료(lbs) ──
// 왼쪽 무리 = FT1(집합) + AFT + F5 · 오른쪽 무리 = FT2(집합) + FWD   (Aircraft Status 의 'AFT (LH) · FWD (RH) Fuel High')
// 엔진은 제 쪽 집합 탱크에서 먹고(교차공급이면 건너편에서), 집합 탱크는 제 쪽 주 탱크(FT1 ← AFT · FT2 ← FWD)에서 저절로 채워진다.
// 하부 콘솔 FUEL 패널(19-lower.js)과 TQS 연료차단 레버(17-upper.js fuel1 · fuel2 = MSOV):
//   BP1 · BP2   — 집합 탱크 승압 펌프. 켜면 그 쪽 엔진 연료 라인 17 · 18 psi, 끄면 9 psi 아래 → 'n F/L PRES'(황)
//   X-FEED      — ENG1: 오른쪽 펌프(BP2) 압력을 1번 라인에 · ENG2: 왼쪽 펌프(BP1)를 2번 라인에(약 5초 뒤 압력이 선다)
//                 Fuel 화면에 교차공급 점선(---) · 'FUEL XFEED'(녹)
//   XFER        — 주 탱크 사이 이송 펌프 1000 lbs/h. LH: FWD → AFT(AFT 98% 에서 멈춤, TP ◀) · RH: AFT → FWD(FWD 98%, TP ▶)
//                 AUTO: 비행 중(바퀴가 떠 있고) 기내 400~2000 lbs 일 때 좌우 차 100 lbs 넘으면 돌고 ±11 안이면 멈춘다
//   F5 XFER     — F5 → AFT 840 lbs/h(14 lb/min). ON: 늘(AFT 98% 까지) · AUTO: 비행 중 AFT 가 170 lbs 아래로 내려가면
//   AUX1/2 XFER — EXT AUX 탱크 → 그쪽 주 탱크(아래)
//   MSOV CLOSE  — 그 라인 압력 0 · Fuel 화면 'MFSOV n CLOSE' 호박색
// FUEL IMBALANCE(황) — 좌우 차 300 lbs(기내 1800 아래면 150) 넘게 30초, 또는 AUTO 이송이 15분 돌아도 맞추지 못할 때
// FUEL n LOW(황) — 집합 탱크가 165 lbs 아래
const FUEL_FT_FULL = { 1: 266, 2: 305 };          // 집합 탱크 가득(사진의 값)
const FUEL_CAP = { fwd: 653, aft: 420, f5: 270 };  // 주 탱크 가득
const FUEL_MAIN0 = FUEL_CAP;                        // (옛 이름)
const FUEL_MAX = 2500;                              // 채울 수 있는 끝(lbs)
const FUEL_FEED_PPH = 1000;                         // 주 탱크 → 집합 탱크(저절로)
const FUEL_XFER_PPH = 1000, FUEL_F5_PPH = 840, FUEL_HI = 0.98;   // 이송 펌프 · F5 이송 · 고수준 감지(가득의 98%)
const FUEL_LOW_LBS = 165;                           // FUEL n LOW — 집합 탱크가 이 아래
const FUEL_BP_PSI = { 1: 19, 2: 19 }, FUEL_PRES_LOW = 9, FUEL_XFEED_SEC = 5, FUEL_SUCTION_PSI = 4;
// AUX 탱크(EXT AUX1 왼쪽 · EXT AUX2 오른쪽) — 처음 525 lbs 씩. 하부 콘솔 AUX1/AUX2 XFER 로 주 탱크에 보낸다:
//   AUTO — 그쪽 주 탱크가 100 lbs 넘게 비면 이송 펌프가 저절로 돌고 거의 차면 멈춘다
//   ON   — AUX 에 연료가 있는 한 주 탱크가 찰 때까지 늘 보낸다   · OFF — 보내지 않는다
const FUEL_AUX_FULL = 525, FUEL_AUX_PPH = 600;
const FUEL_MAIN_CAP = { L: 690, R: 653 };          // 주 탱크(제 쪽 몫)가 찬 양 — L = AFT + F5 · R = FWD
// 연료 상자 — mainL(AFT + F5) · mainR(FWD) 은 합으로 읽고 쓴다(늘리면 AFT 부터 채우고, 줄이면 AFT 부터 덜어 낸다)
function _fuelMk(o) {
  const f = { ft1: o.ft1, ft2: o.ft2, fwd: o.fwd, aft: o.aft, f5: o.f5, auxL: o.auxL, auxR: o.auxR };
  Object.defineProperty(f, 'mainL', { get() { return this.aft + this.f5; }, set(v) {
    let d = Math.max(0, v) - (this.aft + this.f5);
    if (d >= 0) { const a = Math.min(d, Math.max(0, FUEL_CAP.aft - this.aft)); this.aft += a; this.f5 += d - a; }
    else { d = -d; const a = Math.min(d, this.aft); this.aft -= a; this.f5 = Math.max(0, this.f5 - (d - a)); }
  } });
  Object.defineProperty(f, 'mainR', { get() { return this.fwd; }, set(v) { this.fwd = Math.max(0, v); } });
  return f;
}
const FUEL_FULL = { ft1: 266, ft2: 305, fwd: 653, aft: 420, f5: 270, auxL: FUEL_AUX_FULL, auxR: FUEL_AUX_FULL };
// CDU Fuel Configuration(실기 GTC 화면) — 연료 종류 · E-AUX 탱크 장착 · 귀환 연료(Return Fuel) — 이 기기에 남긴다
const FUEL_TYPES = ['JET A-1', 'JET A', 'JP-8', 'JP-5'];
let fuelCfg = { type: 'JET A-1', eaux: true, ret: 0 };
try { const v = JSON.parse(localStorage.getItem('fuelCfg') || 'null'); if (v) fuelCfg = Object.assign(fuelCfg, v); } catch (e) { _swallow(e); }
function _fuelCfgSave() { try { localStorage.setItem('fuelCfg', JSON.stringify(fuelCfg)); } catch (e) { _swallow(e); } }
const _auxFull = () => (fuelCfg.eaux ? FUEL_AUX_FULL : 0);
let fuel = _fuelMk(Object.assign({}, FUEL_FULL, { auxL: _auxFull(), auxR: _auxFull() }));   // L 956 · R 958 · AUX 1050(E-AUX 장착 시)
const auxPump = { 1: false, 2: false };             // 이송 펌프가 돌고 있나(Fuel 화면의 TP 심벌)
// 연료 계통 상태 — 라인 압력(psi) · 교차공급이 선 시간 · 이송 방향(−1 왼쪽으로 · +1 오른쪽으로) · F5 이송 · 불균형 시간
const fuelSys = { p: { 1: 0, 2: 0 }, xfT: { 1: 0, 2: 0 }, xsT: { 1: 0, 2: 0 }, xfer: 0, f5: false, imbT: 0, autoT: 0, imb: false, init: false };
let fuelDrawn = { tp: 0, tpTxt: '', tpOn: true, f5: false, f5Show: false, aux: [false, false] };             // Fuel 화면이 마지막으로 그린 이송 화살표(검사용)
let sysFltSec = 0;                                  // FLT — 비행 시간(시뮬 시간)
function fuelLeft()  { return fuel.ft1 + fuel.aft + fuel.f5; }
function fuelRight() { return fuel.ft2 + fuel.fwd; }
function fuelAux()   { return fuel.auxL + fuel.auxR; }
function fuelTotal() { return fuelLeft() + fuelRight() + fuelAux(); }
// 기내 연료(L + R)의 합을 정해 양쪽에 반씩 채운다 — 집합 탱크를 먼저, 왼쪽은 AFT 다음 F5, 오른쪽은 FWD(AUX 는 그대로)
function fuelSetTotal(lbs) {
  const tot = Math.max(0, Math.min(FUEL_MAX, Number(lbs) || 0)), half = tot / 2;
  const ft1 = Math.min(FUEL_FT_FULL[1], half), ft2 = Math.min(FUEL_FT_FULL[2], half);
  const restL = half - ft1, aft = Math.min(FUEL_CAP.aft, restL);
  fuel = _fuelMk({ ft1, ft2, aft, f5: restL - aft, fwd: half - ft2, auxL: fuel.auxL, auxR: fuel.auxR });
  _fuelCduRefresh();
}
function fuelAdjust(d) { fuelSetTotal(fuelLeft() + fuelRight() + Number(d || 0)); }
function fuelReset() {
  fuel = _fuelMk(Object.assign({}, FUEL_FULL, { auxL: _auxFull(), auxR: _auxFull() }));
  auxPump[1] = auxPump[2] = false; sysFltSec = 0;
  Object.assign(fuelSys, { xsT: { 1: 0, 2: 0 }, xfer: 0, f5: false, imbT: 0, autoT: 0, imb: false, init: false });
  _fuelCduRefresh();
}
// AUX 이송 펌프 — 스위치(하부 콘솔)와 주 탱크 양으로 돌지 정한다
function fuelAuxPumps() {
  [[1, 'auxL', 'mainL', 'L'], [2, 'auxR', 'mainR', 'R']].forEach(([n, ak, mk, side]) => {
    const mode = _ov(n === 1 ? 'aux1Xfer' : 'aux2Xfer', 'AUTO'), cap = FUEL_MAIN_CAP[side];
    let on;
    if (fuel[ak] <= 0 || mode === 'OFF' || !pwrDcNess()) on = false;   // 이송 펌프는 DC N-ESS
    else if (mode === 'ON') on = fuel[mk] < cap - 0.5;
    else on = auxPump[n] ? fuel[mk] < cap - 10 : fuel[mk] < cap - 100;   // AUTO — 100 비면 돌고 거의 차면 멈춘다
    auxPump[n] = on;
  });
}
// 주 탱크 셋
function fuelMainSplit() { return { fwd: fuel.fwd, aft: fuel.aft, f5: fuel.f5 }; }
// 바퀴가 땅에 닿아 있나(WOW)
function fuelWow() {
  try { return (typeof radarAltFt === 'function' ? radarAltFt() : S.alt) < 5; } catch (e) { return true; }
}
// 연료 라인 n 의 압력원 — MSOV(TQS 연료차단 레버) · 제 펌프(BPn) · 교차공급(X-FEED ENGn 이고 건너편 펌프가 돈다)
function fuelLine(n) {
  const o = n === 1 ? 2 : 1;
  const msov = _ov('fuel' + n, 'OPEN') === 'OPEN';
  const dc = pwrDc();                                   // 승압 펌프는 DC 버스 — 전원이 없으면 돌지 않는다
  const own = dc && _ov('bp' + n, 'BP' + n) !== 'OFF' && fuel['ft' + n] > 0;
  const xf = dc && _ov('xFeed', 'OFF') === 'ENG' + n && _ov('bp' + o, 'BP' + o) !== 'OFF' && fuel['ft' + o] > 0;
  return { msov, own, xf, xfOn: xf && fuelSys.xfT[n] >= FUEL_XFEED_SEC };
}
function fuelPress(n) { return Math.round(fuelSys.p[n]); }
function fuelPresLow(n) { return fuelSys.p[n] < FUEL_PRES_LOW; }
function fuelXfeedOn() { return _ov('xFeed', 'OFF') !== 'OFF'; }
// 엔진 n 이 먹는 집합 탱크 — 제 펌프가 쉬고 교차공급이 서 있으면 건너편
function fuelSrc(n) { const L = fuelLine(n); return L.xfOn ? (n === 1 ? 2 : 1) : n; }
// 승압 펌프 n 출구 압력이 낮은가(Fuel 화면 'PRESS n LOW' — 실기 사진) — 펌프가 꺼졌거나,
// X-FEED 를 ENG n 으로 돌린 지 5초가 지나 그 펌프가 끊기고 건너편 펌프가 ENG n 을 먹일 때
function fuelPumpLow(n) { return !fuelLine(n).own || fuelSys.xsT[n] >= FUEL_XFEED_SEC; }
// 엔진마다 연료 흐름(pph) — 토크를 따라 오른다. IDLE 은 130 · 멎은 엔진 · 먹는 쪽 연료가 다 떨어지면 0
function fuelFlow() {
  let P = null;
  try { P = engParams(); } catch (e) { P = null; }
  const one = (e, n) => {
    if (!e || !(e.ng > 0)) return 0;
    if ((fuelSrc(n) === 1 ? fuelLeft() : fuelRight()) <= 0) return 0;
    return e.tq > 0 ? 180 + 4.5 * e.tq : 130;
  };
  return P ? { f1: one(P.e1, 1), f2: one(P.e2, 2), P } : { f1: 0, f2: 0, P: null };
}
// 라인 압력 · 이송 펌프 · F5 이송 · 불균형 — dtReal(실제 초, 압력이 서는 데) · dt(시뮬 초, 연료가 옮겨 가는 데)
function fuelSysTick(dtReal, dt) {
  let P = null;
  try { P = engParams(); } catch (e) { P = null; }
  [1, 2].forEach(n => {
    const L = fuelLine(n), o = n === 1 ? 2 : 1;
    fuelSys.xfT[n] = L.xf ? fuelSys.xfT[n] + dtReal : 0;
    fuelSys.xsT[n] = _ov('xFeed', 'OFF') === 'ENG' + n ? fuelSys.xsT[n] + dtReal : 0;   // X-FEED 를 ENG n 으로 돌린 뒤 지난 시간
    const run = P ? (n === 1 ? P.e1 : P.e2).ng > 0 : false;
    // 교차공급이 서면(5초 뒤) 건너편 펌프가 이 라인을 먹인다 — 라인 압력은 그대로(19 psi)
    const xfOn = L.xf && fuelSys.xfT[n] >= FUEL_XFEED_SEC;
    const tgt = !L.msov ? 0 : xfOn ? FUEL_BP_PSI[o] : L.own ? FUEL_BP_PSI[n] : run ? FUEL_SUCTION_PSI : 0;
    fuelSys.p[n] = fuelSys.init ? fuelSys.p[n] + (tgt - fuelSys.p[n]) * Math.min(1, dtReal / 0.5) : tgt;
  });
  fuelSys.init = true;
  const wow = fuelWow(), Lq = fuelLeft(), Rq = fuelRight(), inner = Lq + Rq;
  // 이송 펌프(XFER)
  const sel = _ov('xferSel', 'AUTO');
  const hiAft = fuel.aft >= FUEL_CAP.aft * FUEL_HI, hiFwd = fuel.fwd >= FUEL_CAP.fwd * FUEL_HI;
  let dir = 0;
  if (sel === 'LH') dir = -1;
  else if (sel === 'RH') dir = 1;
  else if (sel === 'AUTO' && !wow && inner >= 400 && inner <= 2000) {
    const d = Lq - Rq;
    dir = fuelSys.xfer === 0 ? (Math.abs(d) >= 100 ? (d > 0 ? 1 : -1) : 0) : (Math.abs(d) <= 11 ? 0 : fuelSys.xfer);
  }
  if (!pwrDcNess()) dir = 0;                                     // 이송 펌프는 DC N-ESS
  if (dir === -1 && (hiAft || fuel.fwd <= 0)) dir = 0;          // 받는 쪽이 98% 면(넘침 방지) · 보낼 연료가 없으면 멈춘다
  if (dir === 1 && (hiFwd || fuel.aft <= 0)) dir = 0;
  fuelSys.xfer = dir;
  // F5 이송 — F5 → AFT
  const f5s = _ov('f5Xfer', 'AUTO');
  let f5 = false;
  if (fuel.f5 > 0 && fuel.aft < FUEL_CAP.aft * FUEL_HI && pwrDcNess()) {
    if (f5s === 'ON') f5 = true;
    else if (f5s === 'AUTO') f5 = !wow && (fuelSys.f5 || fuel.aft <= 170);
  }
  fuelSys.f5 = f5;
  if (dt > 0) {
    if (dir) {
      const from = dir < 0 ? 'fwd' : 'aft', to = dir < 0 ? 'aft' : 'fwd';
      const x = Math.min(fuel[from], FUEL_XFER_PPH * dt / 3600); fuel[from] -= x; fuel[to] += x;
    }
    if (f5) { const x = Math.min(fuel.f5, FUEL_F5_PPH * dt / 3600); fuel.f5 -= x; fuel.aft += x; }
    // FUEL IMBALANCE — 좌우 차가 오래 크거나, AUTO 이송이 15분 지나도 맞추지 못함
    const lim = inner < 1800 ? 150 : 300;
    fuelSys.imbT = Math.abs(Lq - Rq) > lim ? fuelSys.imbT + dt : 0;
    fuelSys.autoT = sel === 'AUTO' && dir ? fuelSys.autoT + dt : 0;
  }
  fuelSys.imb = fuelSys.imbT >= 30 || fuelSys.autoT >= 900;
}
// CAS(주의 · 조언) 연료 메시지 — PFD 메시지 시현창(03-pfd.js pfdMsgs)이 쓴다
function fuelCas() {
  const out = [];
  [1, 2].forEach(n => { if (fuelPresLow(n)) out.push({ t: `${n} F/L PRES`, amber: true }); });
  if (fuelSys.imb) out.push({ t: 'FUEL IMBALANCE', amber: true });
  [1, 2].forEach(n => { if (fuel['ft' + n] < FUEL_LOW_LBS) out.push({ t: `FUEL ${n} LOW`, amber: true }); });
  if (fuelXfeedOn()) out.push({ t: 'FUEL XFEED', amber: false });
  return out;
}
let _sysT = 0;
function sysTick() {
  const now = performance.now();
  const dtReal = _sysT ? Math.min(2, (now - _sysT) / 1000) : 0;
  _sysT = now;
  let k = 0;
  try { k = S.running ? (Number(simSpeed) || 1) : 0; } catch (e) { k = 0; }
  const dt = dtReal * k;                             // 시뮬 시간(배속 포함)
  if (dt > 0) {
    sysFltSec += dt;
    const { f1, f2 } = fuelFlow();
    const s1 = fuelSrc(1), s2 = fuelSrc(2);
    const burn = (n, pph) => { fuel['ft' + n] = Math.max(0, fuel['ft' + n] - pph * dt / 3600); };
    burn(s1, f1); burn(s2, f2);
    // 주 탱크 → 집합 탱크(FT1 ← AFT · FT2 ← FWD)
    [['ft1', 'aft', 1], ['ft2', 'fwd', 2]].forEach(([ft, mk, n]) => {
      const x = Math.min(FUEL_FT_FULL[n] - fuel[ft], fuel[mk], FUEL_FEED_PPH * dt / 3600);
      if (x > 0) { fuel[ft] += x; fuel[mk] -= x; }
    });
    // AUX → 주 탱크
    [[1, 'auxL', 'mainL', 'L'], [2, 'auxR', 'mainR', 'R']].forEach(([n, ak, mk, side]) => {
      if (!auxPump[n]) return;
      const x = Math.min(fuel[ak], FUEL_MAIN_CAP[side] - fuel[mk], FUEL_AUX_PPH * dt / 3600);
      if (x > 0) { fuel[ak] -= x; fuel[mk] += x; }
    });
  }
  fuelSysTick(dtReal, dt);
  fuelAuxPumps();
  const w = document.getElementById('sysp-wrap');
  if (w && !w.classList.contains('page-hidden')) sysDraw();
  _fuelCduRefresh();
  _elecCduRefresh();
  _hocasCduRefresh();
  const ac = document.getElementById('afcsc');
  if (ac) {
    const P = afcsPhase();
    const v = P ? (P.ap1 ? 'AP1 TEST OK · AP2 TEST OK' : P.ap2 ? 'AP1 TEST RUNNING · AP2 TEST OK' : 'AP1 · AP2 TEST RUNNING') : (afcsLast || '');
    if (ac.textContent !== v) ac.textContent = v;
    ac.style.color = P && !P.ap1 ? '#fff' : '#22e022';
  }
}
setInterval(sysTick, 250);

// ── 그리기 ──
const SYS_GREEN = '#3ad13a', SYS_LINE = '#22c822', SYS_CYAN = '#2fe0e0', SYS_AMBER = '#ffb000';
function sysEnsure() {
  const wrap = document.getElementById('sysp-wrap');
  if (!wrap) return null;
  let c = wrap.querySelector('canvas');
  if (!c) { c = document.createElement('canvas'); c.id = 'sysp-cvs'; wrap.appendChild(c); }
  const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
  if (!(W > 0 && H > 0)) return null;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + 'px'; c.style.height = H + 'px';
  }
  return { c, g: c.getContext('2d'), W, H, dpr };
}
function sysDraw() {
  const E = sysEnsure();
  if (!E) return;
  _sysPaint(E.g, E.c, E.W, E.H, E.dpr, true);
}
// 같은 계통 화면을 다른 캔버스에 그린다 — SIM 3D 조종석 패널의 MFD(15-heli3d.js) · 고른 화면(page)으로 잠깐 바꿔 그린다
function sysDrawTo(c, page) {
  const p0 = sysPage;
  if (page && SYS_PAGES[page]) sysPage = page;   // Map 은 큰 칸 테두리까지만 그린다(지도는 부른 쪽이 얹는다)
  try { _sysPaint(c.getContext('2d'), c, c.width, c.height, 1, false); } finally { sysPage = p0; }
}
function _sysPaint(g, c, W, H, dpr, own) {
  const E = { c };
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, E.c.width, E.c.height);
  const k = Math.min(W / SYS_W, H / SYS_H);
  g.setTransform(k * dpr, 0, 0, k * dpr, (W - SYS_W * k) / 2 * dpr, (H - SYS_H * k) / 2 * dpr);
  const F = fuelFlow();
  _sysLeftStrip(g, F);
  _sysTopBar(g, F);
  // 큰 칸 — 청록 테두리와 위 가운데 화면 이름
  const name = SYS_PAGES[sysPage] || '';
  g.strokeStyle = SYS_CYAN; g.lineWidth = 4;
  g.strokeRect(224, 32, 772, 594);
  g.font = 'bold 11px Helvetica Neue, Arial, sans-serif';
  const tw = g.measureText(name).width + 12;
  g.fillStyle = '#000'; g.fillRect(605 - tw / 2, 33, tw, 14);
  g.strokeStyle = '#ccc'; g.lineWidth = 1; g.strokeRect(605 - tw / 2 + 0.5, 33.5, tw - 1, 13);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(name, 605, 44);
  // Map 화면 — 큰 칸(청록 테두리 안)에 2D 지도를 얹는다
  const slot = own ? document.getElementById('sysp-map') : null;
  if (slot) {
    const on = sysPage === 'map';
    slot.style.display = on ? 'block' : 'none';
    if (on) {
      const ox = (W - SYS_W * k) / 2, oy = (H - SYS_H * k) / 2;
      const st = { left: ox + 227 * k, top: oy + 49 * k, width: 766 * k, height: 574 * k };
      const css = Object.entries(st).map(([a, v]) => `${a}:${v.toFixed(1)}px`).join(';');
      if (slot.dataset.css !== css) {
        slot.dataset.css = css; Object.entries(st).forEach(([a, v]) => { slot.style[a] = v.toFixed(1) + 'px'; });
        try { if (typeof leafMap !== 'undefined') setTimeout(() => leafMap.invalidateSize(), 30); } catch (e) { _swallow(e); }
      }
    }
  }
  if (sysPage === 'map') { /* 지도는 #sysp-map 이 그린다 */ }
  else if (sysPage === 'asys_fuel') _sysFuelPage(g, F);
  else if (sysPage === 'asys_elec') _sysElecPage(g, F);
  else if (sysPage === 'asys_afcs') _sysAfcsPage(g);
  else if (sysPage === 'asys_eng') _sysEnginePage(g, F);
  else if (sysPage === 'asys_status') _sysStatusPage(g, F);
  else if (sysPage === 'asys_video') {
    g.fillStyle = '#4a6a7a'; g.textAlign = 'center'; g.font = 'bold 26px Helvetica Neue, Arial, sans-serif';
    g.fillText(`VIDEO — ${videoCfg.ch}`, 610, 300);
    g.font = '14px Helvetica Neue, Arial, sans-serif'; g.fillStyle = '#789';
    g.fillText(`${videoCfg.src} · Brightness ${videoCfg.bri}% · Contrast ${videoCfg.con}% · Saturation ${videoCfg.sat}%`, 610, 330);
    g.fillText('영상 입력 없음 — 채널 · 설정은 CDU Aircraft Systems → Video', 610, 354);
  }
  else {
    g.fillStyle = '#4a6a7a'; g.font = 'bold 26px Helvetica Neue, Arial, sans-serif';
    g.fillText(name.toUpperCase(), 610, 310);
    g.font = '14px Helvetica Neue, Arial, sans-serif'; g.fillStyle = '#567';
    g.fillText(sysPage === 'asys_hocas' ? 'HOCAS 는 PFD(HSI 오른쪽 아래)에 보입니다 — 켜기 · CTR · DEFAULT 는 CDU 의 HOCAS 칸'
                                     : '준비 중 — 이 계통 화면은 차차 갖춥니다', 610, 340);
  }
}
const _f = (sz, b = true) => `${b ? 'bold ' : ''}${sz}px Helvetica Neue, Arial, sans-serif`;
// 둥근 테두리 칸 + 위 가운데 제목(테두리를 비우고)
function _sysBox(g, x, y, w, h, title, unit) {
  g.strokeStyle = '#5a6672'; g.lineWidth = 1.2;
  const r = 6;
  g.font = _f(12);
  const t = title + (unit ? ' ' : '');
  const tw = g.measureText(t).width + (unit ? (g.font = _f(8), g.measureText(unit).width) : 0) + 8;
  g.beginPath();
  g.moveTo(x + w / 2 + tw / 2, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.lineTo(x + w / 2 - tw / 2, y);
  g.stroke();
  g.fillStyle = '#e8edf2'; g.textAlign = 'left';
  g.font = _f(12); const t1 = g.measureText(t).width;
  const sx = x + w / 2 - (tw - 8) / 2;
  g.fillText(t, sx, y + 4);
  if (unit) { g.font = _f(8); g.fillText(unit, sx + t1, y + 4); }
}
// 막대 둘(위에 이름·값) — lo/hi 범위, 빨강·노랑 선(비율), 녹색 채움
function _sysBars(g, x, y, w, h, lbls, vals, frac, lines) {
  const n = vals.length, colW = w / n;
  vals.forEach((v, i) => {
    const cx = x + colW * (i + 0.5);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = _f(8); g.fillText(lbls[i], cx, y + 10);
    let fs = 15; g.font = _f(fs);
    while (fs > 9 && g.measureText(v).width > colW - 3) { fs -= 1; g.font = _f(fs); }   // 네 자리(HYD P)는 칸에 맞춰 줄인다
    g.fillText(v, cx, y + 26);
    const bw = Math.min(14, colW * 0.42), by = y + 34, bh = h - 40, bx = cx - bw / 2;
    g.strokeStyle = '#ddd'; g.lineWidth = 1.2; g.strokeRect(bx, by, bw, bh);
    const f = Math.max(0, Math.min(1, frac[i]));
    g.fillStyle = SYS_GREEN; g.fillRect(bx + 1.5, by + bh * (1 - f), bw - 3, bh * f - 1.5);
    (lines || []).forEach(([fr, col]) => {
      g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx - 2, by + bh * (1 - fr)); g.lineTo(bx + bw + 2, by + bh * (1 - fr)); g.stroke();
    });
  });
}
function _sysLeftStrip(g, F) {
  const P = F.P || { e1: { tgt: 0, ng: 0 }, e2: { tgt: 0, ng: 0 }, nr: 0 };
  const run1 = P.e1.ng > 50, run2 = P.e2.ng > 50, rot = (P.nr || 0) > 50;
  const r0 = v => String(Math.round(v));
  // TGT · NG
  _sysBox(g, 5, 20, 103, 152, 'TGT', '°C');
  _sysBars(g, 9, 24, 95, 145, ['TGT1', 'TGT2'], [r0(P.e1.tgt), r0(P.e2.tgt)], [P.e1.tgt / 1000, P.e2.tgt / 1000],
    [[0.78, '#ff3030'], [0.66, '#ffcc00']]);
  _sysBox(g, 114, 20, 104, 152, 'NG', '%');
  _sysBars(g, 118, 24, 96, 145, ['NG1', 'NG2'], [P.e1.ng.toFixed(1), P.e2.ng.toFixed(1)], [P.e1.ng / 110, P.e2.ng / 110],
    [[0.70, '#ff3030'], [0.66, '#ffcc00']]);
  // EOT · EOP · MGB
  const eot = [run1 ? 91 : 30, run2 ? 93 : 30], eop = [run1 ? 68 : 0, run2 ? 66 : 0];
  _sysBox(g, 5, 188, 68, 152, 'EOT', '°C');
  _sysBars(g, 7, 192, 64, 145, ['T1', 'T2'], eot.map(r0), eot.map(v => v / 160), [[0.66, '#ff3030'], [0.56, '#ffcc00'], [0.12, '#ff3030']]);
  _sysBox(g, 78, 188, 68, 152, 'EOP', 'PSID');
  _sysBars(g, 80, 192, 64, 145, ['P1', 'P2'], eop.map(r0), eop.map(v => v / 140), [[0.82, '#ff3030'], [0.60, '#ffcc00'], [0.22, '#ffcc00'], [0.10, '#ff3030']]);
  const mgb = [rot ? 91 : 30, rot ? 43 : 0];
  _sysBox(g, 151, 188, 67, 152, 'MGB', '');
  _sysBars(g, 153, 192, 63, 145, ['T', 'P'], mgb.map(r0), [mgb[0] / 140, mgb[1] / 80], [[0.80, '#ff3030'], [0.24, '#ffcc00']]);
  // Fuel F · Fuel P · HYD P
  const ff = [F.f1, F.f2], fp = [fuelPress(1), fuelPress(2)], hyd = [hydPsi()[1], hydPsi()[2]];
  _sysBox(g, 5, 356, 72, 152, 'Fuel F', 'PPH');
  _sysBars(g, 7, 360, 68, 145, ['F1', 'F2'], ff.map(r0), ff.map(v => v / 800), []);
  _sysBox(g, 81, 356, 70, 152, 'Fuel P', 'PSI');
  _sysBars(g, 83, 360, 66, 145, ['P1', 'P2'], fp.map(r0), fp.map(v => v / 40), [[0.86, '#ff3030'], [0.58, '#ffcc00'], [0.10, '#ff3030']]);
  _sysBox(g, 155, 356, 63, 152, 'HYD P', 'PSI');
  _sysBars(g, 156, 360, 61, 145, ['P1', 'P2'], hyd.map(r0), hyd.map(v => v / 4000), [[0.82, '#ff3030'], [0.73, '#ffcc00'], [0.25, '#ffcc00'], [0.12, '#ff3030']]);
  // Fuel QTY
  _sysBox(g, 8, 524, 102, 98, 'Fuel QTY', 'LBS');
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = _f(9); g.fillText('L', 33, 548); g.fillText('R', 90, 548);
  g.font = _f(14); g.fillText(r0(fuelLeft()), 33, 564); g.fillText(r0(fuelRight()), 90, 564);
  g.textAlign = 'left'; g.font = _f(11); g.fillText('Aux', 28, 594); g.fillText('Total', 28, 613);
  g.textAlign = 'right'; g.font = _f(13); g.fillText(r0(fuelAux()), 96, 594); g.fillText(r0(fuelTotal()), 96, 613);
  // Battery · ACCP
  // 배터리 — 전기 계통(elecState)과 같은 값(충전 + · 방전 −)
  let bat = { a: 0, v: 25 };
  try { bat = elecState().bat; } catch (e) { _swallow(e); }
  _sysBox(g, 118, 524, 100, 50, 'Battery', '');
  g.textAlign = 'left'; g.font = _f(11); g.fillStyle = '#fff'; g.fillText('Amps', 126, 545); g.fillText('Volts', 126, 563);
  g.textAlign = 'right'; g.font = _f(13); g.fillText(String(bat.a), 210, 545); g.fillText(String(bat.v), 210, 563);
  _sysBox(g, 118, 588, 100, 34, 'ACCP', '');
  g.textAlign = 'left'; g.font = _f(11); g.fillText('PSI', 126, 612);
  g.textAlign = 'right'; g.font = _f(13); g.fillText(rot ? '2837' : '0', 210, 612);
}
function _sysTopBar(g, F) {
  const ff = F.f1 + F.f2;
  const hm = h => `${Math.floor(h)}+${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  const end = ff > 0 ? hm(Math.max(0, fuelTotal() - (fuelCfg.ret || 0)) / ff) : '_+__';   // 귀환 연료(Return Fuel)는 빼고
  const s = Math.floor(sysFltSec), flt = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  let dn = S.alt;
  try { if (typeof simDensityAltFt === 'function') dn = simDensityAltFt(); } catch (e) { _swallow(e); }
  const item = (x, lbl, val, unit, col) => {
    g.textAlign = 'left'; g.font = _f(12); g.fillStyle = '#fff'; g.fillText(lbl, x, 22);
    let cx = x + g.measureText(lbl).width + 2;
    g.font = _f(15); g.fillStyle = col || '#fff'; g.fillText(val, cx, 22);
    cx += g.measureText(val).width + 1;
    if (unit) { g.font = _f(9); g.fillText(unit, cx, 22); }
  };
  item(226, 'FOD', '_+__', '', '#ff40ff');
  item(318, 'END', end, '');
  item(410, 'VSR', '____', 'FPM', '#ff40ff');
  item(505, 'FLT', flt, '');
  item(605, 'DNALT', String(Math.round(dn)), 'FT');
  item(715, 'CCG', '____', 'FT/NM', '#ff40ff');
  item(818, 'TOD', '__:__', '', '#ff40ff');
  item(892, 'MSA', '____', 'FT', '#ff40ff');
}
// 경고 칸 — 평소 흰 테두리, 걸리면 호박색으로 채운다
// (켜지면 실기 사진의 주의 노랑)
const SYS_CAUT = '#f2e64b';
function _sysAnn(g, x, y, w, h, l1, l2, on) {
  g.fillStyle = on ? SYS_CAUT : '#000'; g.fillRect(x, y, w, h);
  g.strokeStyle = on ? SYS_CAUT : '#cfcfcf'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  g.fillStyle = on ? '#000' : '#e8e8e8'; g.textAlign = 'center';
  g.font = _f(11);
  if (l2) { g.fillText(l1, x + w / 2, y + h / 2 - 2); g.fillText(l2, x + w / 2, y + h / 2 + 12); }
  else g.fillText(l1, x + w / 2, y + h / 2 + 4);
}
function _sysTank(g, x, y, w, h, frac) {
  g.fillStyle = '#000'; g.fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, frac));
  g.fillStyle = SYS_GREEN; g.fillRect(x + 2, y + h - (h - 4) * f - 2, w - 4, (h - 4) * f);
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 2.5; g.strokeRect(x, y, w, h);
}
function _sysEngine(g, cx, cy, n, pph) {
  // 엔진 그림(위가 좁은 통 + 배기) — 사진의 회색 외곽
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#2a2d30'; g.strokeStyle = '#d8d8d8'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-6, -64); g.lineTo(6, -64); g.lineTo(10, -52); g.lineTo(26, -42); g.lineTo(28, -10); g.lineTo(22, 6);
  g.lineTo(26, 30); g.lineTo(18, 50); g.lineTo(22, 64); g.lineTo(-22, 64); g.lineTo(-18, 50); g.lineTo(-26, 30);
  g.lineTo(-22, 6); g.lineTo(-28, -10); g.lineTo(-26, -42); g.lineTo(-10, -52); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = _f(12); g.fillText(`ENG ${n}`, 0, -30);
  g.font = _f(14); g.fillText(String(Math.round(pph)), 0, -10);
  g.font = _f(11); g.fillText('PPH', 0, 6);
  g.restore();
}
function _sysFuelPage(g, F) {
  const L = fuelLeft(), R = fuelRight(), T = fuelTotal(), M = fuelMainSplit();
  const r0 = v => String(Math.round(v));
  const ln = (pts, on = true, w = 3) => {
    g.strokeStyle = on ? SYS_LINE : '#555'; g.lineWidth = w; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke();
  };
  const big = (x, y, l1, l2) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(19); g.fillText(l1, x, y); g.fillText(l2, x, y + 22);
  };
  big(488, 92, 'Left', `${r0(L)} LBS`); big(592, 92, 'Total', `${r0(T)} LBS`);
  big(698, 92, 'Right', `${r0(R)} LBS`); big(815, 90, 'AUX', `${r0(fuelAux())} LBS`);
  const tankLbl = (x, y, a, b) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(13); g.fillText(a, x, y);
    g.font = _f(14); const w1 = g.measureText(b).width; g.fillText(b, x - 8, y + 20);
    g.font = _f(9); g.textAlign = 'left'; g.fillText('LBS', x - 8 + w1 / 2 + 1, y + 20);
  };
  const run1 = !fuelPresLow(1), run2 = !fuelPresLow(2);   // 라인에 압력이 서 있으면 녹색
  // 배관 — 엔진 1 · 2 와 APU
  ln([[312, 200], [312, 297], [361, 297]], run1); ln([[417, 297], [435, 297]], run1); ln([[491, 297], [528, 297]], run1);
  ln([[892, 200], [892, 297], [845, 297]], run2); ln([[787, 297], [770, 297]], run2); ln([[713, 297], [677, 297]], run2);
  ln([[870, 297], [870, 312], [905, 312], [905, 516]], run2);
  // AUX 이송 배관 — 실기 사진처럼 TP1 · TP2 두 펌프가 갈래로 모여 나간다(AUX1 → AFT · AUX2 → F5).
  // TP1 · TP2 는 이송할 때만 보인다 — AUTO 에서 주 탱크가 차 있으면 펌프가 쉬어 심벌도 없다.
  // (AUTO 가 이송을 시작했거나 스위치 ON 이면 녹색 펌프 · 녹색 배관)
  const auxAv = n => auxPump[n] || (_ov(n === 1 ? 'aux1Xfer' : 'aux2Xfer', 'AUTO') === 'ON' && pwrDcNess());
  if (fuelCfg.eaux) {                                                      // E-AUX 탱크를 달았을 때만(CDU Fuel Configuration)
    ln([[424, 356], [424, 343], [466, 343], [466, 356]], auxAv(1)); ln([[445, 343], [445, 322], [496, 322], [496, 415], [507, 415]], auxAv(1));
    ln([[739, 356], [739, 343], [782, 343], [782, 356]], auxAv(2)); ln([[760, 343], [760, 322], [705, 322], [705, 465], [648, 465]], auxAv(2));
  }
  ln([[466, 498], [556, 498]]);                                             // 급유구 → F5
  g.strokeStyle = SYS_LINE; g.lineWidth = 3;
  g.beginPath(); g.moveTo(312, 215); g.lineTo(320, 215); g.stroke();     // 압력 탭
  g.beginPath(); g.moveTo(892, 215); g.lineTo(884, 215); g.stroke();
  g.fillStyle = '#fff'; g.font = _f(14); g.textAlign = 'left';
  g.fillText(`${fuelPress(1)}`, 336, 222); g.font = _f(9); g.fillText('PSI', 354, 222);
  g.font = _f(14); g.fillText(`${fuelPress(2)}`, 915, 220); g.font = _f(9); g.fillText('PSI', 933, 220);
  // 탱크
  _sysTank(g, 507, 146, 191, 64, M.fwd / FUEL_MAIN0.fwd);
  _sysTank(g, 507, 218, 67, 162, fuel.ft1 / FUEL_FT_FULL[1]);
  _sysTank(g, 628, 212, 68, 163, fuel.ft2 / FUEL_FT_FULL[2]);
  _sysTank(g, 507, 383, 191, 65, M.aft / FUEL_MAIN0.aft);
  _sysTank(g, 556, 450, 92, 62, M.f5 / FUEL_MAIN0.f5);
  tankLbl(466, 172, 'FWD', r0(M.fwd)); tankLbl(462, 236, 'FT 1', r0(fuel.ft1));
  tankLbl(745, 236, 'FT 2', r0(fuel.ft2)); tankLbl(464, 416, 'AFT', r0(M.aft)); tankLbl(520, 468, 'F5', r0(M.f5));
  // 펌프·밸브
  const pump = (x, y, r, txt, txt2, on) => {
    g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = on ? SYS_LINE : '#888'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(txt2 ? 10 : 11);
    if (txt2) { g.fillText(txt, x, y - 1); g.fillText(txt2, x, y + 11); } else g.fillText(txt, x, y + 4);
  };
  // 하부 콘솔 FUEL 패널(19-lower.js)
  // X-FEED — 두 승압 펌프 출구를 잇는 교차공급 점선(---)
  // (실기 사진 — ENG 1 연료 라인부터 ENG 2 라인까지, PRESS · FLTR 칸 바로 위를 가로지르는 흰 점선)
  if (fuelXfeedOn()) {
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([9, 6]);
    g.beginPath(); g.moveTo(312, 272); g.lineTo(892, 272); g.stroke(); g.restore();
  }
  // BP1 · BP2 — 돌면 'BP'(녹 테), 서 있으면 'LOW'(호박색)
  const bp = (x, n) => {
    const on = fuelLine(n).own;
    g.fillStyle = '#000'; g.beginPath(); g.arc(x, 297, 14, 0, Math.PI * 2); g.fill();
    g.strokeStyle = on ? SYS_LINE : SYS_AMBER; g.lineWidth = 3; g.stroke();
    g.fillStyle = on ? '#fff' : SYS_AMBER; g.textAlign = 'center'; g.font = _f(on ? 11 : 9); g.fillText(on ? 'BP' : 'LOW', x, 301);
  };
  bp(542, 1); bp(663, 2);
  // 흰 테 화살표(속이 빈) — 실기 사진의 이송 방향 표시
  const arrow = pts => {
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.stroke(); g.restore();
  };
  // TP — 주 탱크 이송 펌프(XFER LH · RH · AUTO). 실기처럼 늘 녹 테 —
  // 이송 중이면 받는 쪽 BP 를 가리키는 화살표(BP1 ◁ TP · TP ▷ BP2), 쉬고 있으면 아래에 스위치 자리(AUTO · LH · RH).
  // XFER OFF · DC N-ESS 없음이면 회색 테 · OFF
  const dir = fuelSys.xfer, xsel = _ov('xferSel', 'AUTO'), tpOn = xsel !== 'OFF' && pwrDcNess();
  const tpTxt = dir ? '' : (tpOn ? xsel : 'OFF');
  pump(602, 300, 21, 'TP', tpTxt, tpOn);
  if (dir < 0) arrow([[558, 299], [571, 290], [571, 295], [581, 295], [581, 303], [571, 303], [571, 308]]);
  if (dir > 0) arrow([[646, 299], [633, 290], [633, 295], [623, 295], [623, 303], [633, 303], [633, 308]]);
  // F5 → AFT 이송 펌프 — F5 오른쪽 아래. 이송할 때만 보인다(AUTO 에서 AFT 가 차 있으면 없다 · ON 이면 녹 테)
  // 돌면 AFT 로 올라가는 화살표
  const f5Show = fuelSys.f5 || (_ov('f5Xfer', 'AUTO') === 'ON' && pwrDcNess());
  ln([[648, 497], [662, 497]], fuelSys.f5);
  if (f5Show) pump(676, 497, 14, 'TP', '', true);
  if (fuelSys.f5) arrow([[676, 436], [667, 448], [673, 448], [673, 483], [679, 483], [679, 448], [685, 448]]);
  fuelDrawn = { tp: dir, tpTxt, tpOn, f5: fuelSys.f5, f5Show, aux: [auxAv(1), auxAv(2)] };
  // EXT AUX1 · AUX2 — 채움 + 탱크마다 TP1 · TP2(실기 사진)
  if (fuelCfg.eaux) {
    _sysTank(g, 400, 330, 90, 63, fuel.auxL / FUEL_AUX_FULL);
    _sysTank(g, 714, 330, 92, 63, fuel.auxR / FUEL_AUX_FULL);
    if (auxAv(1)) { pump(424, 371, 15, 'TP1', '', true); pump(466, 371, 15, 'TP2', '', true); }
    if (auxAv(2)) { pump(739, 371, 15, 'TP1', '', true); pump(782, 371, 15, 'TP2', '', true); }
    tankLbl(355, 352, 'EXT AUX1', r0(fuel.auxL)); tankLbl(856, 352, 'EXT AUX2', r0(fuel.auxR));
  }
  // 경고 칸
  _sysAnn(g, 284, 231, 60, 37, 'MFSOV 1', 'CLOSE', !fuelLine(1).msov);     // TQS 연료차단 레버 CLOSE
  _sysAnn(g, 863, 230, 60, 37, 'MFSOV 2', 'CLOSE', !fuelLine(2).msov);
  _sysAnn(g, 361, 278, 56, 38, 'PRESS 1', 'LOW', fuelPumpLow(1));   // 승압 펌프 1 출구 압력(교차공급 ENG1 5초 뒤에도)
  _sysAnn(g, 435, 278, 56, 38, 'FLTR 1', 'CLOG', false);
  _sysAnn(g, 713, 277, 57, 38, 'FLTR 2', 'CLOG', false);
  _sysAnn(g, 787, 277, 58, 38, 'PRESS 2', 'LOW', fuelPumpLow(2));
  _sysAnn(g, 517, 330, 52, 33, 'FUEL 1', 'LOW', fuel.ft1 < FUEL_LOW_LBS);
  _sysAnn(g, 637, 330, 52, 33, 'FUEL 2', 'LOW', fuel.ft2 < FUEL_LOW_LBS);
  _sysAnn(g, 263, 562, 116, 19, 'FUEL IMBALANCE', '', fuelSys.imb);
  // 엔진 · APU · 급유구
  _sysEngine(g, 312, 132, 1, F.f1);
  _sysEngine(g, 892, 130, 2, F.f2);
  g.save(); g.translate(910, 536);
  g.fillStyle = '#2a2d30'; g.strokeStyle = '#d8d8d8'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-28, -20); g.lineTo(28, -20); g.lineTo(24, 4); g.lineTo(12, 14); g.lineTo(12, 34); g.lineTo(-12, 34);
  g.lineTo(-12, 14); g.lineTo(-24, 4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(13); g.fillText('APU', 0, 2); g.restore();
  g.fillStyle = '#000'; g.beginPath(); g.arc(451, 498, 15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'right'; g.font = _f(12); g.fillText('Refuel Port', 428, 503);
}

// ── CDU 의 Fuel 화면(Aircraft Systems → Fuel) — 연료를 넣고 빼고 정한다 ──
// 09-cdu.js renderAcSysPage 가 Fuel 일 때 이 칸을 그린다. 값은 SYSTEM 창과 같은 연료다.
// 실기 GTC 'Fuel Configuration' — Fuel Type · Fuel E-AUX Tank(장착 막대) · Return Fuel
// 아래 '시뮬 연료' 칸은 훈련용(연료 넣기 · 빼기 · 정하기 · RESET)이다.
const _gtcBtn = (title, val, act, arg, extra) =>
  `<div class="gtc-btn" data-act="${act}" data-arg='${JSON.stringify(arg || [])}' ${extra || ''}><div class="gtc-t">${title}</div>${val}</div>`;
function fuelCduHtml() {
  const btn = (txt, act, arg) => `<div class="nav-btn" data-act="${act}" data-arg='${JSON.stringify(arg)}' style="flex:1;min-width:0">${txt}</div>`;
  return `<div class="gtc-page"><div class="gtc-head">Fuel Configuration</div>` +
    `<div class="gtc-grid">` +
    _gtcBtn('Fuel Type', '<div class="gtc-v" id="fuelc-type"></div>', 'fuelTypeCycle', []) +
    _gtcBtn('Fuel E-AUX Tank', '<div class="gtc-bar" id="fuelc-eaux"></div>', 'fuelEauxToggle', [], 'style="justify-content:center"') +
    _gtcBtn('Return Fuel', '<div class="gtc-v" id="fuelc-ret"></div>', 'fuelReturnSet', []) +
    `</div>` +
    `<div class="gtc-sim">` +
    `<div style="color:#567;font-size:10px;margin-bottom:6px">시뮬 연료(훈련용) — 칸이 모자라면 위아래로 밀어 봅니다</div>` +
    `<div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:8px">` +
    `<div>Left<div id="fuelc-l" style="font-size:17px;font-weight:bold;color:#fff"></div></div>` +
    `<div>Total<div id="fuelc-t" style="font-size:17px;font-weight:bold;color:#3ad13a"></div></div>` +
    `<div>Right<div id="fuelc-r" style="font-size:17px;font-weight:bold;color:#fff"></div></div></div>` +
    `<div style="text-align:center;margin-bottom:8px">Fuel Flow <b id="fuelc-ff" style="color:#fff"></b> PPH · END <b id="fuelc-end" style="color:#fff"></b></div>` +
    `<div style="display:flex;gap:6px;margin-bottom:6px">${btn('−100', 'fuelAdjust', [-100])}${btn('+100', 'fuelAdjust', [100])}</div>` +
    `<div style="display:flex;gap:6px;margin-bottom:6px">${[1000, 1500, 2000, FUEL_MAX].map(v => btn(String(v), 'fuelSetTotal', [v])).join('')}</div>` +
    `<div style="text-align:center;margin:4px 0 6px">AUX L <b id="fuelc-al" style="color:#fff"></b> · R <b id="fuelc-ar" style="color:#fff"></b> LBS</div>` +
    `<div style="display:flex;gap:6px">${btn('RESET — 기내 1914 + AUX 1050', 'fuelReset', [])}</div></div></div>`;
}
function fuelTypeCycle() {
  fuelCfg.type = FUEL_TYPES[(FUEL_TYPES.indexOf(fuelCfg.type) + 1) % FUEL_TYPES.length];
  _fuelCfgSave(); _fuelCduRefresh();
}
// E-AUX 탱크 — 떼면 AUX 연료 0 · Fuel 화면에서 EXT AUX 가 사라진다. 다시 달면 가득(525 lbs 씩)
function fuelEauxToggle() {
  fuelCfg.eaux = !fuelCfg.eaux;
  fuel.auxL = fuel.auxR = _auxFull(); auxPump[1] = auxPump[2] = false;
  _fuelCfgSave(); _fuelCduRefresh();
  try { sysDraw(); } catch (e) { _swallow(e); }
}
// Return Fuel — 귀환에 남길 연료(LB). END(체공 가능 시간)는 이만큼 빼고 셈한다
async function fuelReturnSet() {
  let v = null;
  try { v = await uiPrompt('Return Fuel (LB)', String(fuelCfg.ret || 0), { inputmode: 'numeric' }); } catch (e) { _swallow(e); }
  if (v === null || v === undefined || v === '') return;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return;
  fuelCfg.ret = Math.max(0, Math.min(FUEL_MAX + 2 * FUEL_AUX_FULL, n));
  _fuelCfgSave(); _fuelCduRefresh();
}
function _fuelCduRefresh() {
  const el = document.getElementById('fuelc-t');
  if (!el) return;
  const F = fuelFlow(), ff = F.f1 + F.f2;
  const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
  set('fuelc-type', fuelCfg.type); set('fuelc-ret', `${fuelCfg.ret || 0}LB`);
  const bar = document.getElementById('fuelc-eaux'); if (bar) bar.classList.toggle('on', !!fuelCfg.eaux);
  set('fuelc-l', String(Math.round(fuelLeft()))); set('fuelc-r', String(Math.round(fuelRight())));
  set('fuelc-t', String(Math.round(fuelTotal())) + ' LBS');
  set('fuelc-ff', String(Math.round(ff)));
  set('fuelc-al', String(Math.round(fuel.auxL)) + (auxPump[1] ? ' ▸' : '')); set('fuelc-ar', String(Math.round(fuel.auxR)) + (auxPump[2] ? ' ▸' : ''));
  const usable = Math.max(0, fuelTotal() - (fuelCfg.ret || 0));
  set('fuelc-end', ff > 0 ? `${Math.floor(usable / ff)}+${String(Math.floor((usable / ff % 1) * 60)).padStart(2, '0')}` : '—');
}

// ── 전기 계통(Electrical) ──
// 상부 콘솔(17-upper.js)의 스위치를 따른다.
//   GEN n   — 그 엔진이 돌고(NG > 50) GEN n 스위치 ON 이면 온라인(AC 115V)
//   APU GEN — APU CONTR ON + APU GEN 스위치 'APU GEN'
//   AC 1·2 버스 — 발전기 하나라도 있으면 둘 다(한쪽이 멎으면 가운데 연결선으로 넘겨 준다)
//   TRU n   — 제 AC 버스가 살아 있고 TRU n ON 이면 28V DC
//   DC 1·2 버스 — TRU 하나라도 있으면 둘 다(DC 연결), 없으면 BATT ON 일 때 배터리가 맡는다(방전)
const ELEC_AC_LOAD = 230, ELEC_DC_LOAD = 120, ELEC_DC_NESS = 20;   // DC N-ESS 몫(A) — APU 로만 맡을 때 끊는다       // 버스 부하(A) — 살아 있는 발전기·TRU 가 나눠 진다
// ── APU ── 상부 콘솔 APU CONTR 를 ON 하면 약 17초 걸려 돈다(그동안은 APU GEN 이 전기를 내지 못한다).
// 돌고 나면 PFD 메시지 'APU ON'(녹), 그 상태에서 APU/GPU 스위치가 'APU GEN' 이면 'APU GEN'(녹) — 03-pfd.js pfdMsgs.
// CONTR 가 OFF 면 APU GEN 스위치가 켜져 있어도 발전하지 않고 메시지도 없다.
const APU_START_MS = 17000;
let _apuOnT = null;
function _apuSync() {
  let on = false;
  try { on = typeof ovhdGet === 'function' && ovhdGet('apuContr') === 'ON'; } catch (e) { _swallow(e); }
  if (on && _apuOnT === null) _apuOnT = performance.now();
  else if (!on) _apuOnT = null;
}
try { if (typeof ovhdOn === 'function') ovhdOn(id => { if (id === 'apuContr') _apuSync(); }); } catch (e) { _swallow(e); }
function apuRunning() { _apuSync(); return _apuOnT !== null && performance.now() - _apuOnT >= APU_START_MS; }
function apuGenOn() {
  let g = false;
  try { g = typeof ovhdGet === 'function' && ovhdGet('apuGen') === 'APU GEN'; } catch (e) { _swallow(e); }
  return g && apuRunning();
}
function elecState() {
  let P = null;
  try { P = engParams(); } catch (e) { P = null; }
  const sw = (id, on) => { try { return typeof ovhdGet === 'function' ? ovhdGet(id) === on : true; } catch (e) { return true; } };
  const ng = i => P ? (i === 1 ? P.e1.ng : P.e2.ng) : 0;
  const gen1 = ng(1) > 50 && sw('gen1', 'ON'), gen2 = ng(2) > 50 && sw('gen2', 'ON');
  const apu = apuGenOn();                                    // APU 가 다 돈 뒤에만(17초 · apuRunning)
  let onGnd = false;
  try { onGnd = (typeof radarAltFt === 'function' ? radarAltFt() : S.alt) < 5; } catch (e) { _swallow(e); }
  const gpu = sw('apuGen', 'GPU') && onGnd;                 // 지상 전원 — 땅 위에서만 꽂혀 있다
  // 주 발전기(GEN 1·2)가 하나라도 살아 있으면 APU GEN · AC GPU 는 버스에서 떨어진다(돌고 있어도 대기)
  const mainGen = gen1 || gen2;
  const apuConn = apu && !mainGen, gpuConn = gpu && !mainGen;
  const nGen = mainGen ? (gen1 ? 1 : 0) + (gen2 ? 1 : 0) : (apuConn ? 1 : 0) + (gpuConn ? 1 : 0);
  const ac = nGen > 0;
  // 가운데 연결선 — 주 발전기 하나가 두 버스를 맡을 때, 또는 주 발전기 없이 APU/GPU 가 맡을 때
  const tie = mainGen ? gen1 !== gen2 : (apuConn || gpuConn);
  // 연결선에서 각 AC 버스로 내려가는 몫 — 그 버스를 제 발전기가 맡지 않을 때만 전기가 온다
  const dropL = ac && !gen1, dropR = ac && !gen2;
  const tru1 = ac && sw('tru1', 'ON'), tru2 = ac && sw('tru2', 'ON');
  const nTru = (tru1 ? 1 : 0) + (tru2 ? 1 : 0);
  const batt = sw('batt', 'ON');
  const dc = nTru > 0 || batt;
  // 주 발전기 없이 APU GEN 이 맡으면 DC N-ESS(비필수)를 끊어 쓸데없는 전기를 줄인다
  const dcNess = dc && !apuConn;
  const dcLoad = ELEC_DC_LOAD - (dc && !dcNess ? ELEC_DC_NESS : 0);
  const genA = nGen ? ELEC_AC_LOAD / nGen : 0, truA = nTru ? dcLoad / nTru : 0;
  const bat = !batt ? { a: 0, v: 25 } : nTru ? { a: 5, v: 28 } : { a: -45, v: 24 };
  return { gen1, gen2, apu, gpu, apuConn, gpuConn, mainGen, ac, tru1, tru2, dc, dcNess, batt, battBus: batt || dc, nGen, genA, truA, bat,
           tie, dropL, dropR };
}
// 전원 — 하부 콘솔 장치 · 연료 펌프 · AFCS 가 쓰는 버스(상부 콘솔 스위치를 따른 elecState)
//   DC(필수) : 무전기(C-5000 · NPX138) · 승압 펌프 BP1/BP2 · AFCS(AP1 · AP2) · 하부 콘솔 표시등·버튼 글씨
//   DC N-ESS : 이송 펌프(XFER · F5 · AUX1/2 XFER) — APU 발전기로만 버틸 때는 끊긴다
function pwrDc() { try { return elecState().dc; } catch (e) { return true; } }
function pwrDcNess() { try { return elecState().dcNess; } catch (e) { return true; } }
// 둥근 계기(270° 호) — 값 → 바늘, 색 띠
function _sysGauge(g, cx, cy, r, frac, bands) {
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  g.strokeStyle = '#3a4a3a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  bands.forEach(([f0, f1, col]) => {
    g.strokeStyle = col; g.lineWidth = 9;
    g.beginPath(); g.arc(cx, cy, r - 6, a0 + span * f0, a0 + span * f1); g.stroke();
  });
  const a = a0 + span * Math.max(0, Math.min(1, frac));
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = '#444'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
}
function _sysElecPage(g) {
  const E = elecState();
  const ON = '#2ec82e', OFF = '#5a5a5a';
  // 사진(KUH MFD ELEC) 좌표로 그리고 큰 칸에 맞춰 줄인다
  g.save();
  const k = 0.535;
  g.translate(224 + 14 - 320 * k, 32 + 26 - 300 * k); g.scale(k, k);
  const ln = (pts, on) => {
    g.strokeStyle = on ? ON : OFF; g.lineWidth = 5; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke();
  };
  const box = (x0, y0, x1, y1, l1, l2, on) => {
    g.fillStyle = '#000'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = on ? ON : OFF; g.lineWidth = 5; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = on ? '#e8e8e8' : '#777'; g.textAlign = 'center'; g.font = _f(l2 ? 26 : 24, false);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (l2) { g.fillText(l1, cx, cy - 4); g.fillText(l2, cx, cy + 24); } else g.fillText(l1, cx, cy + 9);
  };
  const txt = (x, y, s, sz, col) => { g.fillStyle = col || '#fff'; g.textAlign = 'center'; g.font = _f(sz || 26, false); g.fillText(s, x, y); };
  // 배선
  ln([[496, 442], [536, 442], [536, 627]], E.gen1);
  // APU GEN · AC GPU — 원천에서 연결선까지는 버스에 붙었을 때만(주 발전기가 있으면 끊긴다)
  ln([[766, 442], [733, 442], [733, 577]], E.apuConn);
  ln([[1310, 442], [1345, 442], [1345, 577]], E.gpuConn);
  ln([[733, 577], [1345, 577]], E.tie);
  ln([[733, 577], [733, 627]], E.dropL);                   // 연결선 → AC 1
  ln([[1345, 577], [1345, 627]], E.dropR);                 // 연결선 → AC 2
  ln([[1580, 442], [1540, 442], [1540, 627]], E.gen2);
  [[438, 'DIC 1'], [634, 'ESS 1']].forEach(([x]) => ln([[x, 692], [x, 742]], E.ac));
  [[1248], [1443], [1638]].forEach(([x]) => ln([[x, 692], [x, 742]], E.ac));
  ln([[733, 692], [733, 890], [772, 890]], E.ac);
  ln([[772, 948], [733, 948], [733, 1104]], E.tru1);
  ln([[1345, 692], [1345, 890], [1306, 890]], E.ac);
  ln([[1306, 948], [1345, 948], [1345, 1104]], E.tru2);
  ln([[496, 920], [536, 920], [536, 1104]], E.batt);
  ln([[536, 1036], [573, 1036]], E.battBus);
  ln([[890, 1137], [1188, 1137]], E.dc);
  [438, 634, 1248, 1443].forEach(x => ln([[x, 1170], [x, 1220]], E.dc));
  ln([[1638, 1170], [1638, 1220]], E.dcNess);              // DC N-ESS — APU 로만 맡을 때는 끊는다
  // 버스
  box(378, 627, 890, 692, 'AC 1', 'Primary Bus', E.ac);
  box(1188, 627, 1698, 692, 'AC 2', 'Primary Bus', E.ac);
  box(378, 742, 498, 782, 'DIC 1', '', E.ac); box(573, 742, 694, 782, 'ESS 1', '', E.ac);
  box(1188, 742, 1308, 782, 'DIC 2', '', E.ac); box(1383, 742, 1503, 782, 'ESS 2', '', E.ac); box(1578, 742, 1698, 782, 'N-ESS', '', E.ac);
  box(573, 1015, 694, 1057, 'BATT BUS', '', E.battBus);
  box(378, 1104, 890, 1170, 'DC 1', 'Primary Bus', E.dc);
  box(1188, 1104, 1698, 1170, 'DC 2', 'Primary Bus', E.dc);
  box(378, 1220, 498, 1260, 'SEC 1', '', E.dc); box(573, 1220, 694, 1260, 'ESS 1', '', E.dc);
  box(1188, 1220, 1308, 1260, 'SEC 2', '', E.dc); box(1383, 1220, 1503, 1260, 'ESS 2', '', E.dc); box(1578, 1220, 1698, 1260, 'N-ESS', '', E.dcNess);
  // APU GEN · AC GPU
  const src = (x, y, s, on) => {
    g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, 62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = on ? ON : OFF; g.lineWidth = 4; g.stroke();
    txt(x, y + 9, s, 26, on ? '#e8e8e8' : '#888');
  };
  src(828, 442, 'APU GEN', E.apu); src(1248, 442, 'AC GPU', E.gpu);
  // 계기 — 발전기(0~300A: 녹 ~230 · 황 ~260 · 적) · TRU(0~400A: 녹 ~300 · 황 ~350 · 적) · 배터리(−100~+100A: 양 끝 적·황)
  const genB = [[0, 0.77, ON], [0.77, 0.87, '#e8d000'], [0.87, 1, '#e02020']];
  const truB = [[0, 0.75, ON], [0.75, 0.87, '#e8d000'], [0.87, 1, '#e02020']];
  const batB = [[0, 0.12, '#e02020'], [0.12, 0.25, '#e8d000'], [0.25, 0.75, ON], [0.75, 0.88, '#e8d000'], [0.88, 1, '#e02020']];
  const gauge = (x, y, title, frac, bands, lines) => {
    txt(x, y - 74, title, 26);
    _sysGauge(g, x, y, 60, frac, bands);
    lines.forEach((s, i) => txt(x - 6, y + 82 + i * 27, s, 30));
  };
  const genA = on => on ? E.genA : 0;
  gauge(438, 442, 'GEN 1', genA(E.gen1) / 300, genB, [`${Math.round(genA(E.gen1))}A`, `${E.gen1 ? 115 : 0}V`]);
  gauge(1638, 442, 'GEN 2', genA(E.gen2) / 300, genB, [`${Math.round(genA(E.gen2))}A`, `${E.gen2 ? 115 : 0}V`]);
  const tA = on => on ? E.truA : 0;
  gauge(828, 920, 'TRU 1', tA(E.tru1) / 400, truB, [`${Math.round(tA(E.tru1))}A`, `${E.tru1 ? 28 : 0}V`]);
  gauge(1248, 920, 'TRU 2', tA(E.tru2) / 400, truB, [`${Math.round(tA(E.tru2))}A`, `${E.tru2 ? 28 : 0}V`]);
  gauge(438, 920, 'BATT', (E.bat.a + 100) / 200, batB, [`${E.bat.a}A`, `${E.bat.v}V`, '25.0°C']);
  g.restore();
}

// ── 공용 — 상부 콘솔 값 · 로터 · 바깥 기온 ──
const _ov = (id, dflt) => { try { const v = typeof ovhdGet === 'function' ? ovhdGet(id) : undefined; return v === undefined ? dflt : v; } catch (e) { return dflt; } };
function _sysRotor() { try { return engParams().nr > 40; } catch (e) { return true; } }
// 유압 1 · 2(psi) — 주 기어박스(MGB)에 달린 펌프라 로터가 돌 때(NR 40% 넘게 — 한 엔진 IDLE 47% 에서도) 압력이 선다.
// 정상 범위 2600 ~ 3300(녹색 띠).
// EMERG PUMP(상부 콘솔 · 전기 펌프) ON + AC 전원(주 발전기 · APU GEN · GPU)이면 로터가 돌지 않아도 #1 유압에 3020psi —
// 엔진이 꺼져 있어도 APU 를 켜고 APU GEN 을 올리면 쓸 수 있다
const HYD_NORM = [2600, 3300], HYD_EMER_PSI = 3020;
function hydEmerPump() {
  if (_ov('emergPump', 'AUTO') !== 'ON') return false;
  try { return !!elecState().ac; } catch (e) { return false; }
}
function hydPsi() {
  const rot = _sysRotor(), emer = hydEmerPump();
  return { 1: emer ? Math.max(rot ? 2960 : 0, HYD_EMER_PSI) : (rot ? 2960 : 0), 2: rot ? 3060 : 0 };
}
function hydNormal() { const h = hydPsi(); return [1, 2].every(n => h[n] >= HYD_NORM[0] && h[n] <= HYD_NORM[1]); }
function _sysOatC() {
  let t0 = 15;
  try { if (Number.isFinite(window._oatSurfaceC)) t0 = window._oatSurfaceC; } catch (e) { _swallow(e); }
  return Math.round(t0 - 2 * (S.alt || 0) / 1000);
}
function _sysEngSt(n) { try { return simEngSt[n]; } catch (e) { return 'FLY'; } }
// 노란 X — 값을 읽을 수 없음(엔진이 멎어 신호가 없다)
function _sysX(g, x, y) {
  g.strokeStyle = '#e8d000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - 6, y - 12); g.lineTo(x + 6, y); g.moveTo(x + 6, y - 12); g.lineTo(x - 6, y); g.stroke();
  g.strokeRect(x - 7, y - 13, 14, 14);
}

// ── AFCS — AP1·AP2 레인 상태와 AFCS 시험(TEST) ──
// CDU 의 AFCS 칸에서 TEST 를 누르면: 두 AP 가 함께 시험을 시작해 AP2 가 먼저 끝나고(AP2 TEST OK),
// AP1 은 C · YR · P(사이클릭 · 요/롤 · 피치) 액추에이터를 차례로 돌린 뒤 AP1 TEST OK — 잠시 뒤 처음 화면으로.
const AFCS_AP2_SEC = 3, AFCS_AP1_SEC = 7, AFCS_HOLD_SEC = 3;
let afcsTest = null;          // { t0 } — 시험 중이면
let afcsLast = '';            // 마지막 시험 결과
// P FLT TST 는 땅 위(WOW) · 유압 1 · 2 가 정상 범위(2600 ~ 3300 psi) · DC 전원이 있을 때만(엔진이 돌든 멎었든 상관없다)
// — 아니면 시험하지 않고 버튼이 다시 나온다
function afcsPfltOk() {
  if (!pwrDc()) return false;
  let wow = true;
  try { wow = fuelWow(); } catch (e) { _swallow(e); }
  return wow && hydNormal();
}
function afcsTestStart() {
  if (!afcsPfltOk()) {
    afcsTest = null; afcsLast = 'P FLT TST INHIBITED';
    try { if (typeof ovhdGet === 'function' && ovhdGet('bFltTst') === 'IN') setTimeout(() => ovhdSet('bFltTst', 'OUT'), 300); } catch (e) { _swallow(e); }
    try { sysPageSet('asys_afcs'); } catch (e) { _swallow(e); }
    return;
  }
  afcsTest = { t0: performance.now() };
  afcsLast = '';
  try { sysPageSet('asys_afcs'); } catch (e) { _swallow(e); }
}
function afcsPhase() {
  if (!afcsTest) return null;
  const t = (performance.now() - afcsTest.t0) / 1000;
  if (t >= AFCS_AP1_SEC + AFCS_HOLD_SEC) {
    afcsTest = null; afcsLast = 'AFCS TEST OK';
    // 하부 콘솔 AFCAU 의 P FLT TST 버튼은 시험이 끝나면 다시 나온다
    try { if (typeof ovhdGet === 'function' && ovhdGet('bFltTst') === 'IN') ovhdSet('bFltTst', 'OUT'); } catch (e) { _swallow(e); }
    return null;
  }
  return { t, ap2: t >= AFCS_AP2_SEC, ap1: t >= AFCS_AP1_SEC, act: Math.floor(t / 1.2) % 3 };
}
function _sysAfcsPage(g) {
  const P = afcsPhase();
  let ase = false;
  try { ase = !!aseOn; } catch (e) { _swallow(e); }
  const lane = (n, y, numX) => {
    g.strokeStyle = '#e8d000'; g.lineWidth = 2; g.strokeRect(numX - 11, y - 14, 22, 24);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(13, false); g.fillText(String(n), numX, y + 4);
    const done = P && (n === 1 ? P.ap1 : P.ap2), running = P && !done;
    if (P) {
      g.font = _f(14, false); g.fillStyle = done ? '#22e022' : '#fff';
      g.fillText(`AP${n} TEST ${done ? 'OK' : 'RUNNING'}`, 610, y - 52);
    }
    const cols = [[490, 'SEMA1 OK', 'C'], [610, 'SEMA2 OK', 'YR'], [730, 'TRIM OK', 'P']];
    cols.forEach(([x, lbl, act], i) => {
      if (running) {                                   // 시험 중 — 액추에이터 칸이 붉게(차례로 밝게)
        const hot = P.act === i;
        g.fillStyle = hot ? '#ff2020' : '#c01010'; g.fillRect(x - 24, y - 26, 48, 26);
        g.fillStyle = '#fff'; g.font = _f(13, false); g.fillText(act, x, y - 8);
      } else if (!P) {
        let apOk = _ov('ap' + n, 'OUT') !== 'IN' && pwrDc();
        try { apOk = afcsAxes()['ap' + n]; } catch (e) { _swallow(e); }
        const on = ase && apOk;                          // 하부 콘솔 AFCAU 의 AP1/AP2 OFF · DC 전원이 없으면 그 레인 OFF
        g.fillStyle = on ? '#22e022' : '#e8d000'; g.font = _f(13, false); g.fillText(on ? 'ON' : 'OFF', x, y - 8);
      }
      g.fillStyle = '#fff'; g.font = _f(13, false); g.fillText(lbl, x, y + 20);
    });
    if (!P && !afcsLast) {                            // 시험을 마친 화면에서는 #1 · #2 모두 지운다
      g.fillStyle = '#e8d000'; g.textAlign = 'left'; g.font = _f(12, false);
      g.fillText('AFCS MAINTENANCE MODE', 444, y + 46);
      g.strokeStyle = '#e8d000'; g.lineWidth = 1; g.beginPath(); g.moveTo(444, y + 49); g.lineTo(612, y + 49); g.stroke();
      g.strokeRect(444, y + 54, 50, 14);
      g.strokeStyle = '#ff3030'; g.strokeRect(444, y + 70, 50, 16);
      g.fillStyle = '#fff'; g.font = _f(11, false); g.fillText('NOM DEF', 447, y + 82);
    }
  };
  lane(1, 170, 330);
  lane(2, 420, 900);
  if (!P && afcsLast) {
    const inh = /INHIBITED/.test(afcsLast);
    g.fillStyle = inh ? SYS_AMBER : '#22e022'; g.textAlign = 'center'; g.font = _f(14); g.fillText(afcsLast, 610, 590);
    if (inh) { g.font = _f(11, false); g.fillText('WOW · HYD PRESS NORMAL · DC POWER REQUIRED', 610, 608); }
  }
}

// ── Engine — 엔진 제어기(EHC) 자료 · 기어박스 온도 ──
function _sysEnginePage(g, F) {
  const P = F.P || engParams();
  const rot = _sysRotor(), oat = _sysOatC();
  g.save();
  const k = 0.7425;
  g.translate(224 + (772 - 960 * k) / 2, 32); g.scale(k, k);
  const panel = (x0, y0, x1, y1, title) => _sysBox(g, x0, y0, x1 - x0, y1 - y0, title, '');
  const row = (x0, x1, y, lbl, val, unit, isX) => {
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = _f(15, false); g.fillText(lbl, x0 + 8, y);
    if (isX) { _sysX(g, x1 - 30, y); }
    else { g.textAlign = 'right'; g.font = _f(17); g.fillText(val, x1 - (unit ? 26 : 22), y); }
    if (unit) { g.textAlign = 'left'; g.font = _f(10, false); g.fillText(unit, x1 - 22, y); }
  };
  const eng = (n, x0, x1) => {
    const st = _sysEngSt(n), run = st !== 'OFF', e = n === 1 ? P.e1 : P.e2;
    const pcd = _ov('pcd' + n, 'FLY');
    panel(x0, 140, x1, 684, `Engine ${n}`);
    const p0 = 14.7 * Math.pow(1 - 6.87535e-6 * Math.max(0, S.alt || 0), 5.2559);
    const rows = [
      ['Anti-Ice', _ov('engAi' + n, 'OFF') === 'ON' ? 'On' : 'Off'], ['In Control', 'B'],
      ['EHC LCF 1', '0'], ['EHC LCF 2', '0'], ['EHC TT1', '0'], ['EHC Hours', String(Math.floor(sysFltSec / 3600))],
      ['LCH Health', '0'], ['T45 Margin', run ? String(Math.max(0, Math.round(80 - 0.5 * e.tq))) : '0'],
      ['ETF', '1.00', '', !run], ['T2', String(oat), '°C'], ['PS3', String(Math.round(60 + 1.2 * e.tq)), 'PSI', !run],
      ['P0', p0.toFixed(1), '', !run], ['LDS', run && e.tq > 0 ? (Math.abs(P.e1.tq - P.e2.tq) / 2).toFixed(1) : '0.0', '%'],
      ['PCD Position', pcd === 'OFF' ? 'Stop' : pcd === 'IDLE' ? 'Idle' : 'Fly'],
    ];
    rows.forEach((r, i) => row(x0, x1, 166 + i * 25.7, r[0], r[1], r[2], r[3]));
    panel(x0 + 6, 520, x1 - 6, 680, 'Power Check');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(15, false); g.fillText('Incomplete', (x0 + x1) / 2, 546);
    [['OAT', 'ALT UNS'], ['TQ', 'T45 UNS'], ['NP', 'IAS UNS'], ['IAS', '']].forEach(([a, b], i) => {
      const yy = 556 + i * 31;
      [[a, x0 + 14], [b, x0 + 102]].forEach(([t, bx]) => {
        if (!t) return;
        g.strokeStyle = '#8a9096'; g.lineWidth = 1.2; g.strokeRect(bx, yy, 82, 22);
        g.fillStyle = '#fff'; g.font = _f(13, false); g.textAlign = 'center'; g.fillText(t, bx + 41, yy + 16);
      });
    });
  };
  eng(1, 168, 366); eng(2, 590, 789);
  const gb = (y, title, lbl, val, isX) => {
    panel(378, y, 577, y + 34, title);
    row(378, 577, y + 24, lbl, val, '°C', isX);
  };
  gb(140, 'MGB', 'RB Temp', '91', !rot);
  gb(194, 'IGB', 'Oil Temp', rot ? '68' : '0', false);
  gb(248, 'TGB', 'Oil Temp', rot ? '72' : '0', false);
  g.restore();
}

// ── Aircraft Status — 유압 · 연료(FQMS) · 화재 탐지/소화 · ADS 가열 · 기타 · 방빙 ──
function _sysDial(g, cx, cy, r, min, max, val, bands, ticks, fmt) {
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5, A = v => a0 + span * (Math.max(min, Math.min(max, v)) - min) / (max - min);
  bands.forEach(([v0, v1, col]) => { g.strokeStyle = col; g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, r, A(v0), A(v1)); g.stroke(); });
  g.strokeStyle = '#ddd'; g.lineWidth = 1.5;
  ticks.forEach(v => {
    const a = A(v);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); g.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(12, false);
    g.fillText(fmt ? fmt(v) : String(v), cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22) + 4);
  });
  if (Number.isFinite(val)) {
    const a = A(val);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); g.stroke(); g.lineCap = 'butt';
  }
  g.fillStyle = '#333'; g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill();
}
function _sysStatusPage(g, F) {
  const rot = _sysRotor(), oat = _sysOatC();
  const R = '#e02020', Y = '#e8d000', G = '#22c822';
  g.save();
  const k = 0.886;
  g.translate(224 + (772 - 802 * k) / 2, 32 + 4); g.scale(k, k);
  const panel = (x0, y0, x1, y1, title) => _sysBox(g, x0, y0, x1 - x0, y1 - y0, title, '');
  const kv = (x0, x1, y, l, v, col) => {
    g.textAlign = 'left'; g.font = _f(12, false); g.fillStyle = '#fff'; g.fillText(l, x0, y);
    g.textAlign = 'right'; g.font = _f(13); g.fillStyle = col || '#fff'; g.fillText(v, x1, y);
  };
  // 유압 1 · 2
  [[1, 0, hydPsi()[1], rot ? 91 : oat, 4.6], [2, 173, hydPsi()[2], rot ? 87 : oat, 4.4]].forEach(([n, x0, psi, tc, lit]) => {
    panel(x0 + 2, 30, x0 + 170, 668, `Hydraulic ${n}`);
    const cx = x0 + 86;
    _sysDial(g, cx, 128, 74, 0, 5000, psi, [[0, 1500, R], [1500, 2600, Y], [2600, 3300, G], [3300, 4000, Y], [4000, 5000, R]], [0, 1000, 2000, 3000, 4000]);
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.font = _f(15, false); g.fillText('PSI', x0 + 160, 178); g.font = _f(24); g.fillText(String(psi), x0 + 160, 208);
    _sysDial(g, cx, 330, 74, -70, 280, tc, [[-70, -20, R], [-20, 30, Y], [30, 180, G], [180, 230, Y], [230, 280, R]], [-70, -20, 30, 80, 130, 180, 230, 280]);
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.font = _f(15, false); g.fillText('°C', x0 + 160, 380); g.font = _f(24); g.fillText(String(tc), x0 + 160, 412);
    _sysDial(g, cx, 515, 74, 0, 6, lit, [[0, 1.5, R], [1.5, 3, Y], [3, 6, G]], [1, 2, 3, 4, 5, 6]);
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.font = _f(15, false); g.fillText('Liters', x0 + 160, 560); g.font = _f(24); g.fillText(lit.toFixed(1), x0 + 160, 592);
    kv(x0 + 8, x0 + 164, 628, 'MRA PRESS WARN', psi < 1500 ? 'On' : 'Off', psi < 1500 ? R : null);
    kv(x0 + 8, x0 + 164, 650, n === 1 ? 'EMER PUMP' : 'TRA PRESS WARN', n === 1 ? (hydEmerPump() ? 'On' : 'Off') : (psi < 1500 ? 'On' : 'Off'), n === 1 && hydEmerPump() ? G : (n === 2 && psi < 1500 ? R : null));
  });
  // 연료(FQMS 두 계통이 같은 값 → Delta 0)
  const M = fuelMainSplit();
  panel(347, 30, 610, 334, 'Fuel');
  g.textAlign = 'left'; g.font = _f(12, false); g.fillStyle = '#fff'; g.fillText('Signal Name', 357, 60);
  g.textAlign = 'center'; g.fillText('FQMS1', 496, 56); g.fillText('(lb)', 496, 70); g.fillText('FQMS2', 545, 56); g.fillText('(lb)', 545, 70); g.fillText('Delta', 592, 60);
  const lowFt = n => (n === 1 ? fuel.ft1 : fuel.ft2) < FUEL_LOW_LBS;
  const frow = (y, name, v, red) => {
    const s = String(Math.round(v));
    g.textAlign = 'left'; g.font = _f(12, false); g.fillStyle = '#fff'; g.fillText(name, 357, y);
    [496, 545].forEach(x => {
      g.font = _f(13); g.textAlign = 'center';
      if (red) { const w = g.measureText(s).width + 6; g.fillStyle = R; g.fillRect(x - w / 2, y - 12, w, 15); }
      g.fillStyle = '#fff'; g.fillText(s, x, y);
    });
    g.fillStyle = '#fff'; g.fillText('0', 592, y);
  };
  [['FWD Fuel', M.fwd], ['FT1 Fuel', fuel.ft1, lowFt(1)], ['FT2 Fuel', fuel.ft2, lowFt(2)], ['AFT Fuel', M.aft], ['FT5 Fuel', M.f5],
   ['I-AUX Fuel', 0], ['E-AUX1 Fuel', fuel.auxL], ['E-AUX2 Fuel', fuel.auxR]].forEach((r, i) => frow(92 + i * 15.2, r[0], r[1], r[2]));
  frow(248, 'R-Fuel', fuelRight(), lowFt(2)); frow(263, 'L-Fuel', fuelLeft(), lowFt(1)); frow(279, 'AUX Fuel', fuelAux());
  frow(316, 'Total Fuel', fuelTotal(), fuelTotal() < 2 * FUEL_LOW_LBS);
  panel(347, 341, 610, 465, '');
  g.textAlign = 'center'; g.font = _f(12, false); g.fillStyle = '#fff'; g.fillText('Left', 520, 356); g.fillText('Right', 585, 356);
  const lr = (y, name, a, b) => {
    g.textAlign = 'left'; g.font = _f(12, false); g.fillStyle = '#fff'; g.fillText(name, 357, y);
    [[a, 520], [b, 585]].forEach(([v, x]) => { g.textAlign = 'center'; g.font = _f(12); g.fillStyle = v[1] || '#fff'; g.fillText(v[0], x, y); });
  };
  const fp = [fuelPress(1), fuelPress(2)];
  const mfsov = n => fuelLine(n).msov ? ['Open'] : ['Closed', Y];
  lr(376, 'Feed PRESS', [`${fp[0]} PSI`], [`${fp[1]} PSI`]);
  lr(395, 'Filter Clog State', ['OK'], ['OK']);
  lr(414, 'Fuel PRESS Low', fuelPresLow(1) ? ['LOW', Y] : ['OK'], fuelPresLow(2) ? ['LOW', Y] : ['OK']);
  lr(433, 'FT Fuel State', lowFt(1) ? ['LOW', Y] : ['OK'], lowFt(2) ? ['LOW', Y] : ['OK']);
  lr(452, 'MFSOV State', mfsov(1), mfsov(2));
  panel(347, 472, 610, 514, '');
  const hi = (k) => fuel[k] >= FUEL_CAP[k] * FUEL_HI;      // 고수준 감지(98%) — 이송이 멈추는 자리
  kv(357, 600, 490, 'AFT (LH) Fuel High', hi('aft') ? 'High' : 'OK'); kv(357, 600, 507, 'FWD (RH) Fuel High', hi('fwd') ? 'High' : 'OK');
  panel(347, 532, 610, 668, '');

  // 하부 콘솔 FUEL 패널 — X-FEED · XFER · F5/AUX XFER
  const xf = fuelXfeedOn(), tp = fuelSys.xfer !== 0, f5 = fuelSys.f5;
  const auxv = id => { const a = _ov(id, 'AUTO'), on = auxPump[id === 'aux1Xfer' ? 1 : 2];
    return a === 'ON' || on ? ['On', '#fff'] : a === 'AUTO' ? ['Auto', '#fff'] : ['Off', Y]; };
  [['Crossfeed Valve Position', xf ? 'Open' : 'Closed', xf ? '#fff' : Y], ['Transfer Pump State', tp ? 'On' : 'Off', tp ? '#fff' : Y],
   ['F5 Transfer Pump Flow', f5 ? 'On' : 'Off', f5 ? '#fff' : Y], ['I-AUX Fuel Pump Control', 'Off', Y],
   ['E-AUX1 Fuel Pump Control', ...auxv('aux1Xfer')], ['E-AUX2 Fuel Pump Control', ...auxv('aux2Xfer')]].forEach((r, i) => kv(357, 600, 551 + i * 19, r[0], r[1], r[2]));
  // 화재 탐지 — FIRE DETECTOR 노브를 시험 자리로 돌리면 그 항목이 FIRE(붉게)
  const det = _ov('fireDet', 'OPER');
  panel(615, 30, 800, 136, 'Fire Detection');
  ['ENG1', 'ENG2', 'APU', 'MGB'].forEach((n, i) => kv(625, 790, 58 + i * 20, n, det === n ? 'FIRE' : 'OK', det === n ? R : '#fff'));
  // 화재 소화 — TQS T HANDLE(ARM) · APU T-핸들 · RESERVE 스위치
  const f1 = _ov('fire1', 'UNARMED'), f2 = _ov('fire2', 'UNARMED'), res = _ov('fireExtRes', 'OFF');
  const on = (b, c) => [b ? 'On' : 'Off', b ? (c || R) : '#fff'];
  const main = false, rsrv = res !== 'OFF';            // 주 소화기 방출 조작은 아직 없다(T HANDLE 은 ARM 까지)
  panel(615, 158, 800, 386, 'Fire Extinguishing');
  [[186, 'ENG1 CMD', on(f1 === 'ARM', Y)], [205, 'ENG2 CMD', on(f2 === 'ARM', Y)], [224, 'APU CMD', on(_ov('apuFire', 'IN') === 'PULLED', Y)],
   [279, 'MAIN DISCHRG', on(main)], [299, 'RSRV DISCHRG', on(rsrv)],
   [342, 'MAIN Switch Position', main ? ['Disch', R] : ['Off', '#fff']], [365, 'RSRV Switch Position', rsrv ? [res, R] : ['Off', '#fff']]]
    .forEach(([y, l, v]) => kv(625, 790, y, l, v[0], v[1]));
  // ADS 가열 — PITOT HEAT 스위치
  const ph = _ov('pitotHeat', 'AUTO');
  const phv = ph === 'OFF' ? ['Off', Y] : ph === 'ON' ? ['On', '#fff'] : ['Normal', '#fff'];
  panel(615, 412, 800, 470, 'ADS Heat Status');
  kv(625, 790, 437, 'Left Pitot', phv[0], phv[1]); kv(625, 790, 457, 'Right Pitot', phv[0], phv[1]);
  panel(615, 497, 800, 546, 'Misc');
  g.textAlign = 'left'; g.font = _f(12, false); g.fillStyle = '#fff'; g.fillText('ACC PRESS', 625, 531);
  const acc = rot ? '2837' : '62';
  g.font = _f(14); const aw = g.measureText(acc).width + 6;
  if (!rot) { g.fillStyle = R; g.fillRect(760 - aw, 518, aw, 17); }
  g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(acc, 758, 531); g.font = _f(9, false); g.textAlign = 'left'; g.fillText('PSI', 764, 531);
  panel(615, 566, 800, 668, 'Anti-Ice');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(12, false); g.fillText('CMD', 700, 588); g.fillText('State', 770, 588);
  [1, 2].forEach(n => {
    const y = 588 + n * 20, c = _ov('engAi' + n, 'OFF') === 'ON';
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = _f(12, false); g.fillText(`Inlet${n}`, 625, y);
    g.textAlign = 'center'; g.font = _f(12); g.fillStyle = c ? '#fff' : Y; g.fillText(c ? 'On' : 'Off', 700, y);
    g.fillStyle = '#fff'; g.fillText('OK', 770, y);
  });
  g.restore();
}

// ── CDU 의 계통 칸 — Fuel 은 연료 조정, Electrical 은 전원 상태(스위치는 UPPER 창) ──
// ── CDU Video Settings(실기 GTC 화면) — Channel(RADAR · DMM · EO/IR · HOIST) · Source · Default Settings ·
//    Brightness · Contrast · Saturation(−/+ 5%). 이 기기에 남긴다
const VIDEO_CH = ['RADAR', 'DMM', 'EO/IR', 'HOIST'], VIDEO_DEF = { ch: 'RADAR', src: 'Digital', bri: 50, con: 50, sat: 50 };
let videoCfg = Object.assign({}, VIDEO_DEF), _videoPick = false;
try { const v = JSON.parse(localStorage.getItem('videoCfg') || 'null'); if (v) videoCfg = Object.assign(videoCfg, v); } catch (e) { _swallow(e); }
function _videoSave() { try { localStorage.setItem('videoCfg', JSON.stringify(videoCfg)); } catch (e) { _swallow(e); } }
function videoCduHtml() { return `<div class="gtc-page" id="vidc"></div>`; }
function _videoCduRender() {
  const el = document.getElementById('vidc');
  if (!el) return;
  const row = (k, lbl) => `<div class="gtc-row"><div class="gtc-rl">${lbl}<b>${videoCfg[k]}%</b></div>` +
    `<div class="gtc-pm" data-act="videoAdj" data-arg='["${k}",-5]'>−</div>` +
    `<div class="gtc-slide"><i style="width:${videoCfg[k]}%"></i><u style="left:${videoCfg[k]}%"></u></div>` +
    `<div class="gtc-pm" data-act="videoAdj" data-arg='["${k}",5]'>+</div></div>`;
  el.innerHTML = `<div class="gtc-head">${_videoPick ? 'Channel Select' : 'Video Settings'}</div>` +
    `<div class="gtc-grid three">` +
    _gtcBtn('Channel', `<div class="gtc-v">${videoCfg.ch}</div>`, 'videoChanOpen', []) +
    _gtcBtn('Source', `<div class="gtc-v">${videoCfg.src}</div>`, 'videoSrcToggle', []) +
    _gtcBtn('', '<div style="font-size:14px;color:#fff;line-height:17px">Default<br>Settings</div>', 'videoDefault', []) + `</div>` +
    `<div class="gtc-rows">${row('bri', 'Brightness')}${row('con', 'Contrast')}${row('sat', 'Saturation')}</div>` +
    (_videoPick ? `<div class="gtc-pick">${VIDEO_CH.map(c => `<div class="gtc-opt${c === videoCfg.ch ? ' sel' : ''}" data-act="videoChanSet" data-arg='["${c}"]'>${c}</div>`).join('')}</div>` : '');
}
function videoChanOpen() { _videoPick = !_videoPick; _videoCduRender(); }
function videoChanSet(c) { if (VIDEO_CH.includes(c)) videoCfg.ch = c; _videoPick = false; _videoSave(); _videoCduRender(); _videoSysRedraw(); }
function videoSrcToggle() { videoCfg.src = videoCfg.src === 'Digital' ? 'Analog' : 'Digital'; _videoSave(); _videoCduRender(); _videoSysRedraw(); }
function videoDefault() { videoCfg = Object.assign({}, VIDEO_DEF); _videoPick = false; _videoSave(); _videoCduRender(); _videoSysRedraw(); }
function videoAdj(k, d) {
  if (!(k in VIDEO_DEF) || k === 'ch' || k === 'src') return;
  videoCfg[k] = Math.max(0, Math.min(100, videoCfg[k] + Number(d || 0)));
  _videoSave(); _videoCduRender(); _videoSysRedraw();
}
function _videoSysRedraw() { try { if (sysPage === 'asys_video') sysDraw(); } catch (e) { _swallow(e); } }
function sysCduHtml(id) {
  if (id === 'asys_fuel') return fuelCduHtml();
  if (id === 'asys_video') { setTimeout(_videoCduRender, 0); return videoCduHtml(); }
  if (id === 'asys_elec') return `<div id="elecc" style="padding:10px 8px;color:#cde;font-size:12px"></div>`;
  if (id === 'asys_afcs') return `<div style="padding:12px 8px;color:#cde;font-size:12px">` +
    `<div style="color:#567;font-size:10px;margin-bottom:8px">AFCS 시험 — AP1 · AP2 액추에이터(C · YR · P)를 차례로 시험합니다(약 10초). LOWER 창 AFCAU 의 <b style="color:#9ab">P FLT TST</b> 를 눌러도 됩니다.</div>` +
    `<div class="nav-btn" data-act="afcsTestStart" style="width:100%;margin-bottom:10px">AFCS TEST</div>` +
    `<div id="afcsc" style="text-align:center;font-size:15px;font-weight:bold;color:#fff;min-height:22px"></div>` +
    `<div style="color:#567;font-size:10px;margin-top:12px">SYSTEM 창(탭 'SYSTEM')에 AFCS 화면이 보입니다.</div></div>`;
  if (id === 'asys_hocas') {
    const b = (act, txt, extra) => `<div class="nav-btn" data-act="${act}" ${extra || ''} style="flex:1;min-width:0;max-width:none;width:auto;height:auto;min-height:54px;padding:8px 4px;font-size:13px;line-height:16px;text-align:center">${txt}</div>`;
    return `<div style="padding:12px 8px;color:#cde;font-size:12px">` +
      `<div style="color:#567;font-size:10px;margin-bottom:6px">HOCAS — 조종간(사이클릭)·페달·컬렉티브가 가운데인지 PFD(HSI 오른쪽 아래)에 보입니다.</div>` +
      `<div style="display:flex;gap:6px;margin-bottom:8px">${b('toggleHocas', 'PFD 표시 <b id="hocasc-on"></b>')}</div>` +
      `<div style="color:#567;font-size:10px;margin:8px 0 4px">가운데(중립) — 조종간·페달에서 손을 뗀 채 누릅니다</div>` +
      `<div style="display:flex;gap:6px;margin-bottom:10px">${b('hocasCenter', 'CTR<span style="font-size:10px;line-height:13px;height:auto;color:#9ab">가운데 맞춤 · 저장</span>')}` +
      `${b('hocasDefault', 'DEFAULT<span style="font-size:10px;line-height:13px;height:auto;color:#9ab">저장한 가운데 지우기</span>')}</div>` +
      `<div id="hocasc" style="font-size:12px"></div></div>`;
  }
  if (id === 'asys_eng' || id === 'asys_status') return `<div style="padding:12px 8px;color:#cde;font-size:12px">` +
    `<div style="margin-bottom:8px">${id === 'asys_eng' ? 'Engine — 엔진 제어기(EHC) 자료 · PCD 위치 · MGB/IGB/TGB 온도' : 'Aircraft Status — 유압 · 연료(FQMS) · 화재 탐지/소화 · ADS 가열 · 방빙'}</div>` +
    `<div style="color:#567;font-size:10px">SYSTEM 창(탭 'SYSTEM')에 이 화면이 보입니다. 엔진은 UPPER 창 아래 TQS(PCD · 연료차단 · 화재소화 레버)로 조작합니다.</div></div>`;
  return '';
}
function _elecCduRefresh() {
  const el = document.getElementById('elecc');
  if (!el) return;
  const E = elecState();
  const row = (k, on, v) => `<div style="display:flex;justify-content:space-between;padding:5px 4px;border-bottom:1px solid #1e2a33">` +
    `<span>${k}</span><b style="color:${on ? '#3ad13a' : '#888'}">${v}</b></div>`;
  const h = `<div style="color:#567;font-size:10px;margin-bottom:6px">전원 상태 — 스위치는 UPPER 창(GEN · APU · TRU · BATT)</div>` +
    row('GEN 1', E.gen1, E.gen1 ? `ON · ${Math.round(E.genA)}A` : 'OFF') +
    row('GEN 2', E.gen2, E.gen2 ? `ON · ${Math.round(E.genA)}A` : 'OFF') +
    row('APU GEN', E.apuConn, E.apuConn ? `ON · ${Math.round(E.genA)}A` : E.apu ? 'STBY(주 발전기 있음)' : 'OFF') +
    row('AC 1 · AC 2 BUS', E.ac, E.ac ? (E.tie ? 'ON (TIE)' : 'ON') : 'OFF') +
    row('TRU 1', E.tru1, E.tru1 ? `ON · ${Math.round(E.truA)}A` : 'OFF') +
    row('TRU 2', E.tru2, E.tru2 ? `ON · ${Math.round(E.truA)}A` : 'OFF') +
    row('DC 1 · DC 2 BUS', E.dc, E.dc ? (E.tru1 || E.tru2 ? 'ON' : 'ON (BATT)') : 'OFF') +
    row('DC N-ESS', E.dcNess, E.dcNess ? 'ON' : E.dc ? 'SHED(APU 전원)' : 'OFF') +
    row('BATT', E.batt, `${E.bat.a}A · ${E.bat.v}V`) +
    `<div style="color:#567;font-size:10px;margin-top:12px">SYSTEM 창(탭 'SYSTEM')에 Electrical 계통도가 보입니다.</div>`;
  if (el.innerHTML !== h) el.innerHTML = h;
}

// CDU HOCAS 칸 — 표시 켜짐 · 장치 · 저장한 가운데 · 지금 조종 장치 값
function _hocasCduRefresh() {
  const on = document.getElementById('hocasc-on');
  if (on) { const t = (typeof hocasOn !== 'undefined' && hocasOn) ? 'ON' : 'OFF'; if (on.textContent !== t) { on.textContent = t; on.style.color = t === 'ON' ? '#3ad13a' : '#888'; } }
  const el = document.getElementById('hocasc');
  if (!el) return;
  let p = null, saved = false, ax = null;
  try { const ps = joyPads(); p = ps.find(q => q.index === joyActiveIdx) || ps[0] || null; } catch (e) { p = null; }
  try { saved = !!(p && joyNeutralSaved(p)); } catch (e) { _swallow(e); }
  try { ax = hocasAxes(); } catch (e) { ax = null; }
  const pct = (v, a, b) => !ax ? '—' : Math.abs(v) <= HOCAS_DEAD ? '0' : (v > 0 ? a : b) + Math.round(Math.abs(v) * 100);
  const row = (k, v, col) => `<div style="display:flex;justify-content:space-between;padding:5px 4px;border-bottom:1px solid #1e2a33"><span>${k}</span><b style="color:${col || '#fff'}">${v}</b></div>`;
  const h = row('조종 장치', p ? (p.id || '').slice(0, 28) || `#${p.index}` : '없음', p ? '#fff' : '#888') +
    row('저장한 가운데', saved ? '있음(CTR)' : '없음(기본값)', saved ? '#3ad13a' : '#888') +
    row('CYC 전후 · 좌우', ax ? `${pct(ax.pitch, 'F', 'A')} · ${pct(ax.roll, 'R', 'L')}` : '—') +
    row('PEDAL', ax ? pct(ax.yaw, 'R', 'L') : '—') +
    row('COLLECTIVE', ax && ax.coll ? `${Math.round(ax.coll.tq != null ? ax.coll.tq : ax.coll.frac * 100)}%` : '—');
  if (el.innerHTML !== h) el.innerHTML = h;
}

// 창이 보일 때(applyPanels 가 부른다)
function sysShow() { sysDraw(); }
try { appRegister({ fuelAdjust, fuelSetTotal, fuelReset, sysPageSet, afcsTestStart, fuelTypeCycle, fuelEauxToggle, fuelReturnSet, videoChanOpen, videoChanSet, videoSrcToggle, videoDefault, videoAdj }); } catch (e) { _swallow(e); }
try { window.addEventListener('resize', () => { try { sysDraw(); } catch (e) { _swallow(e); } }); } catch (e) { _swallow(e); }
// 상부 콘솔 스위치가 바뀌면 곧바로 다시 그린다(발전기·TRU·배터리 → Electrical)
try { if (typeof ovhdOn === 'function') ovhdOn(() => { try { sysDraw(); } catch (e) { _swallow(e); } }); } catch (e) { _swallow(e); }
