// ═══ 36-kuhsys.js — 흰수리(KUH-1CG) 계통 보강 ═══
// ① CDU Home > Aircraft Systems 의 빈 화면 넷 — RA Self Test · System Tests · Lighting Config · Maintenance(CMC Log Viewer)
// ② T700-701K 엔진 시동 · FADEC(EECU) — 시동 단계 · 시동 중지 조건 · 지상 HSP(TGT 963℃) · 시동기 · 점화기 · 냉각 제한 · FAIL FIX · OEI TGT
//
// 교범에서 수치가 확인된 것(RA BITE 250ft · 60초 · 2,550ft · 30°/45° · System Tests 일곱 단추 · EPAC 20초 · CVFDR · Lamp Test ·
// Maintenance 단계 · NG 51~56% 시동기 분리 · 963℃ HSP · 927℃ · 18초 TGT · 30초 EOP/NP · 시동기 2/4회 · 모터링 2분 · 점화 2분/3분/23분 ·
// 2분 냉각 · 5분 · 4시간 · OEI TGT 951→974℃ · TQ 차 34% · FAIL FIX 4,000ft)는 그대로 썼다.
// 교범에 없는 것(Lighting Config 의 칸 구성 · Maintenance 비밀번호 · EPAC 비행 조건)은 바꾸기 쉬운 값으로 따로 두었다.

const _ks = (f, d) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
const _ksOv = (id, d) => _ks(() => (typeof ovhdGet === 'function' ? ovhdGet(id) : undefined), d);
const _ksB206 = () => _ks(() => typeof acB206 === 'function' && acB206(), false);
function _ksOnGnd() {
  if (_ks(() => simModeOn, false)) return _ks(() => _simOnGnd, true);
  return _ks(() => radarAltFt(), 0) < 5;
}
function _ksOat() { return _ks(() => oatNowC(), 15); }
function _ksTime() { const d = new Date(); return d.toTimeString().slice(0, 8); }

// ══════════ ① RA Self Test ══════════
//   Allow(처음) · Inhibit — 전원을 넣으면 한 번 BITE. Allow 면 250ft AGL 위에서 60초마다(또는 2,550ft 넘음 · 피치 30° · 롤 45° 넘음 —
//   계산 자료 없음 — 이면 곧바로) BITE. 외부 장착물(슬링)이 있는데 Allow 로 두면 BITE 가 GRA1 · GRA2 SERVICE(PFL)를 낸다 —
//   슬링 운용 때는 Inhibit 로 둔다
const raSt = { mode: 'ALLOW', sling: false, boot: false, t: 0, pfl: [], n: 0, last: '' };
try { if (localStorage.getItem('raStMode') === 'INHIBIT') raSt.mode = 'INHIBIT'; } catch (e) { _swallow(e); }
function raStSet(m) {
  raSt.mode = m === 'INHIBIT' ? 'INHIBIT' : 'ALLOW';
  try { localStorage.setItem('raStMode', raSt.mode); } catch (e) { _swallow(e); }
  if (raSt.mode === 'INHIBIT') raSt.pfl = [];
  _ksRefresh();
}
function raStSling() { raSt.sling = !raSt.sling; _ksRefresh(); }
function _raBite() {
  raSt.n++; raSt.last = _ksTime();
  raSt.pfl = raSt.sling && raSt.mode === 'ALLOW' ? ['GRA1 SERVICE', 'GRA2 SERVICE'] : [];
}
function raStStep(dt) {
  if (_ksB206()) return;
  if (!raSt.boot) { raSt.boot = true; _raBite(); return; }
  if (raSt.mode === 'INHIBIT') return;
  const agl = _ks(() => radarAltFt(), 0), noComp = agl > 2550 || Math.abs(_ks(() => S.pit, 0)) > 30 || Math.abs(_ks(() => S.bnk, 0)) > 45;
  if (agl <= 250 && !noComp) return;
  raSt.t += dt;
  if (noComp || raSt.t >= 60) { raSt.t = 0; _raBite(); }
}

// ══════════ ① System Tests ══════════
//   FQMS 1 · FQMS 2 · Engine 1 · Engine 2(EPAC) · CVFDR · Lamp Test · TCAS — 머리줄 Ready To Execute · Busy
const SYS_TEST_IDS = ['FQMS 1', 'FQMS 2', 'Engine 1', 'Engine 2', 'CVFDR', 'Lamp Test', 'TCAS'];
const sysTst = { st: {}, run: {}, msg: [], abortY: [false, false] };
SYS_TEST_IDS.forEach(k => { sysTst.st[k] = '----'; });
let lampTestOn = false;
// EPAC(엔진 출력 점검)을 공중에서 끝까지 하려면 — 교범에 수치가 없어 바꾸기 쉬운 값으로 둔다(대기속도 60kt 위 · 승강 ±500fpm · 경사 10° 안)
const EPAC_COND = { ias: 60, vs: 500, bank: 10 };
function _epacOk() { return !_ksOnGnd() && _ks(() => S.spd, 0) >= EPAC_COND.ias && Math.abs(_ks(() => S.vs, 0)) <= EPAC_COND.vs && Math.abs(_ks(() => S.bnk, 0)) <= EPAC_COND.bank; }
function sysTestRun(id) {
  if (!SYS_TEST_IDS.includes(id)) return;
  if (id === 'Lamp Test') {
    lampTestOn = !lampTestOn; sysTst.st[id] = lampTestOn ? 'ON' : '----';
    try { document.documentElement.classList.toggle('lamptest', lampTestOn); } catch (e) { _swallow(e); }
    try { drawPFD(); } catch (e) { _swallow(e); }
    _ksRefresh(); return;
  }
  if (sysTst.run[id]) return;
  sysTst.st[id] = 'In Progress';
  sysTst.run[id] = id.startsWith('Engine') ? 20 : id === 'CVFDR' ? 2 : id === 'TCAS' ? 8 : 3;
  if (id === 'TCAS') { try { if (typeof tcasTestStart === 'function') tcasTestStart(); } catch (e) { _swallow(e); } }
  _ksRefresh();
}
function sysTestStep(dt) {
  Object.keys(sysTst.run).forEach(id => {
    sysTst.run[id] -= dt;
    if (sysTst.run[id] > 0) return;
    delete sysTst.run[id];
    if (id.startsWith('FQMS')) sysTst.st[id] = 'Done';
    else if (id.startsWith('Engine')) {
      const i = id === 'Engine 1' ? 0 : 1;
      if (_ksOnGnd()) sysTst.st[id] = 'Done';
      else if (_epacOk()) { sysTst.st[id] = 'Completed'; sysTst.abortY[i] = false; }
      else { sysTst.st[id] = 'Abort'; sysTst.abortY[i] = true; }
    } else if (id === 'CVFDR') {
      sysTst.st[id] = 'Pass'; sysTst.msg = [];
      if (_ksOv('pcd1', 'FLY') === 'OFF' && _ksOv('pcd2', 'FLY') === 'OFF') sysTst.msg.push('CVFDR FDR Maintenance');   // AMM 31-30-00-722 — 두 PCD OFF 일 때만
    } else if (id === 'TCAS') sysTst.st[id] = _ks(() => elecState().ess1 !== false, true) ? 'Done' : 'Fail';
    _ksRefresh();
  });
}

// ══════════ ① Lighting Config ══════════
//   CDU 밝기: DAY · NVIS · AUTO(광센서) · RMT(DISPLAY 스위치 · 하부 콘솔 조명 노브) — MFD(SYSTEM · PFD): DAY · NVIS · REMOTE(DISPLAY 스위치)
//   DISPLAY 스위치(상부 콘솔 DAY · NIGHT · NVG) · MFD IR 센서 · CDU 광센서는 시간대(ENV 주간 · 황혼 · 야간)로 본다
const litCfg = { cdu: 'AUTO', mfd: 'REMOTE', cduBrt: 80 };
try { Object.assign(litCfg, JSON.parse(localStorage.getItem('litCfg') || '{}')); } catch (e) { _swallow(e); }
function litSave() { try { localStorage.setItem('litCfg', JSON.stringify(litCfg)); } catch (e) { _swallow(e); } }
function litSet(k, v) { if (k === 'cdu' || k === 'mfd') litCfg[k] = v; litSave(); litApply(); _ksRefresh(); }
function litBrt(d) { litCfg.cduBrt = Math.max(10, Math.min(100, litCfg.cduBrt + d)); litSave(); litApply(); _ksRefresh(); }
function _litAmb() { const t = _ks(() => env.tod, 'DAY'); return t === 'NIGHT' ? 0.55 : t === 'DUSK' ? 0.75 : 1; }
function litOut() {
  const sw = _ksOv('display', 'DAY'), amb = _litAmb();
  const swMode = sw === 'NVG' ? 'NVIS' : sw === 'NIGHT' ? 'NIGHT' : 'DAY';
  const cduMode = litCfg.cdu === 'DAY' ? 'DAY' : litCfg.cdu === 'NVIS' ? 'NVIS' : swMode;
  const mfdMode = litCfg.mfd === 'DAY' ? 'DAY' : litCfg.mfd === 'NVIS' ? 'NVIS' : swMode;
  const cduB = litCfg.cdu === 'AUTO' ? amb : litCfg.cduBrt / 100;
  const mfdB = mfdMode === 'DAY' ? amb : Math.min(0.45, amb);
  const cons = +_ksOv('consLower', 0) || 0;
  return { sw, cduMode, mfdMode, cduB, mfdB, consV: 8 + 20 * Math.max(0, Math.min(1, cons / 10)) };
}
function _litFilter(b, mode) {
  if (b >= 0.99 && mode === 'DAY') return '';
  return `brightness(${b.toFixed(2)})` + (mode === 'NVIS' ? ' sepia(.5) hue-rotate(55deg) saturate(1.4)' : '');
}
function litApply() {
  if (_ksB206()) return;
  const o = litOut();
  const set = (sel, f) => document.querySelectorAll(sel).forEach(el => { if (el.style.filter !== f) el.style.filter = f; });
  set('#cdu-wrap #mainContentArea, #cdu-wrap .footer-nav', _litFilter(o.cduB, o.cduMode));
  set('#pfd, #sysp-wrap canvas', _litFilter(o.mfdB, o.mfdMode));
}

// ══════════ ① Maintenance — 비밀번호 → System Maintenance → CMC Logs(Logging Status) → Faults List → CMC Log Viewer ══════════
//   비밀번호는 교범에 없어 설정값(localStorage 'maintPw', 처음 ADMIN)
//   CMC 결함 목록(MFL) — PFL(시스템 메시지)이 생기고 풀릴 때마다 SET · CLEARED 로 쌓인다(맨 아래가 최근)
const maint = { step: 'PASSWORD', err: false, folder: null, mfl: [], seen: new Set(), t0: new Date() };
function _maintPw() { try { return localStorage.getItem('maintPw') || 'ADMIN'; } catch (e) { return 'ADMIN'; } }
function maintPwEnter() {
  const el = document.getElementById('maint-pw'), v = el ? el.value : '';
  if (String(v).trim().toUpperCase() === _maintPw().toUpperCase()) { maint.err = false; maint.step = 'SYS_MAINT'; }
  else maint.err = true;
  _ksRefresh(true);
}
function maintGo(step, arg) {
  const order = ['PASSWORD', 'SYS_MAINT', 'LOGGING_STATUS', 'FAULTS_LIST', 'CMC_LOG_VIEWER'];
  if (!order.includes(step)) return;
  if (step === 'CMC_LOG_VIEWER') { maint.folder = arg || 'LOG_NOW'; try { if (typeof sysPageSet === 'function') sysPageSet('asys_maint'); } catch (e) { _swallow(e); } }
  maint.step = step; maint.err = false;
  _ksRefresh(true);
}
function maintBack() {
  if (maint.step === 'CONFIG') { cfgExit(); return; }
  const back = { SYS_MAINT: 'PASSWORD', LOGGING_STATUS: 'SYS_MAINT', FAULTS_LIST: 'LOGGING_STATUS', CMC_LOG_VIEWER: 'FAULTS_LIST' }[maint.step];
  if (back) maintGo(back);
}
function _mflSub(t) { return /^ENG1/.test(t) ? 'EECU 1' : /^ENG2/.test(t) ? 'EECU 2' : /^GRA/.test(t) ? 'GRA' : /^CDU/.test(t) ? 'CDU' : 'MC'; }
function mflStep() {
  let now = [];
  try { now = typeof pfdSysMsgs === 'function' ? pfdSysMsgs() : []; } catch (e) { _swallow(e); }
  const cur = new Set(now);
  cur.forEach(t => { if (!maint.seen.has(t)) maint.mfl.push({ sub: _mflSub(t), no: String(100 + maint.mfl.length).padStart(3, '0'), t, time: _ksTime(), st: 'SET' }); });
  maint.seen.forEach(t => { if (!cur.has(t)) maint.mfl.push({ sub: _mflSub(t), no: String(100 + maint.mfl.length).padStart(3, '0'), t, time: _ksTime(), st: 'CLEARED' }); });
  maint.seen = cur;
  if (maint.mfl.length > 300) maint.mfl.splice(0, maint.mfl.length - 300);
}

// ══════════ ② T700-701K 엔진 시동 · FADEC ══════════
//   단계: RUN(돈다) · OFF · CRANK(시동기만) · IGN(점화 · 연료) · ABORT(시동 실패 — PCD 를 OFF 로 내려야 풀린다) · MOTOR(모터링)
//   시동: PCD OFF → IDLE/FLY — 공압원(APU · 또는 건너편 엔진 FLY · TQ 60% 이상 · NR 99.5% 이상)이 있어야 돈다
//     NG 12% 에서 점화 · 연료 → TGT · EOP · NP 오름 → NG 51~56%(여기서는 54) 에서 시동기 분리 · #n ENG STRT 꺼짐 → IDLE/FLY
//   자동 중지: 지상에서 TGT 963℃ 넘으면 HSP(ENGn H-START S-DOWN · n ENG FAULT) · AISBV 미개방이면 NG 40% 부근 실속
//   조종사 판단(PFL 로 알린다): TGT 927℃ 넘을 듯 · NG 오른 뒤 18초 안에 TGT 안 오름 · 30초 안에 EOP · NP 안 오름
//   시동기: 연속 2회(외기 15℃ 넘음) · 4회(15℃ 이하) · 한 번마다 60초 냉각 / 모터링 2분 → 5분 · 다음은 30분 / 점화 2분 → 3분 · 23분
//   정지: NG 90% 이하로 2분 식히지 않고 끄면 5분 안에 다시 시동해야 하고, 넘기면 4시간 시동 금지
//   고장(교관 창): 고온 시동 · AISBV 고착 · FAIL FIX(4,000ft 내려가면 실속) · PWR LIMIT(TQ 85%)
const FADEC = { ngRate: 2.2, ngIgn: 12, ngSep: 54, hsp: 963, tgtWarn: 927, tgtNoRise: 18, eopNoRise: 30, consecHot: 2, consecCold: 4,
                starterCool: 60, motorMax: 120, ignMax: 120, cool90: 120, post5: 300, lock4h: 4 * 3600, tgtLim: 951, tgtLimOei: 974, split: 34, fixDrop: 4000 };
const _fe = n => ({ n, ph: null, ng: 0, tgt: 15, np: 0, eop: 0, t: 0, tgtUp: false, eopUp: false, npUp: false,
                    stCool: 0, consec: 0, lastTry: 0, motor: 0, motorN: 0, motorCool: 0, ign: 0, ignN: 0, ignCool: 0,
                    cool90: 0, post5: 0, lock: 0, idle1: 0, fault: null, faultAlt: 0, why: '', pfl: [], adv: '' });
const fadec = { e: { 1: _fe(1), 2: _fe(2) }, on: true };
function _fLever(n) {
  const p = _ksOv('pcd' + n, 'FLY');
  if (_ksOv('fuel' + n, 'OPEN') === 'CLOSE' || _ksOv('fire' + n, 'UNARMED') === 'ARM') return 'OFF';
  return p === 'OFF' ? 'OFF' : p;
}
// 시뮬레이터가 이 엔진을 돌릴까(14-simmode.js simEngApply) — RUN 일 때만. Bell 206 은 제 엔진 모형(27-b206coll.js)
function fadecRun(n) { if (_ksB206() || !fadec.on) return true; const e = fadec.e[n]; return e.ph === null || e.ph === 'RUN'; }
// 레버대로 곧바로(시작 상태 · 시나리오 · 검사)
function fadecSync() {
  [1, 2].forEach(n => { const e = fadec.e[n]; e.ph = _fLever(n) === 'OFF' ? 'OFF' : 'RUN'; e.why = ''; e.t = 0; if (e.ph === 'OFF') { e.ng = 0; e.np = 0; e.eop = 0; } });
  try { if (typeof simEngApply === 'function') simEngApply(true); } catch (e) { _swallow(e); }
}
function fadecFault(n, f, on) {
  const e = fadec.e[n]; if (!e) return;
  e.fault = on ? f : null; e.faultAlt = _ks(() => S.alt, 0);
  try { if (typeof fdrNote === 'function') fdrNote(`ENG${n} ${f} ${on ? '고장' : '풀림'}`, on ? 'err' : ''); } catch (er) { _swallow(er); }
}
function _fBleed(n) {
  if (_ks(() => apuRunning(), false)) return true;
  const o = 3 - n, P = _ks(() => engParams(), null), tq = P ? (o === 1 ? P.e1 : P.e2).tq : 0;
  return fadec.e[o].ph === 'RUN' && _fLever(o) === 'FLY' && tq >= 60 && _ks(() => engParams().nr, 0) >= 99.5;
}
function _fSay(msg, kind) { try { uiToast(msg, kind || 'warn', 3500); } catch (e) { _swallow(e); } try { if (typeof fdrNote === 'function') fdrNote(msg, kind === 'err' ? 'err' : 'warn'); } catch (e) { _swallow(e); } }
function _fAbort(e, why, cool) { e.ph = 'ABORT'; e.why = why; if (cool) e.stCool = FADEC.starterCool; _fSay(`ENG${e.n} 시동 중지 — ${why}`, 'err'); }
function fadecStep(dt) {
  if (_ksB206() || !fadec.on) return;
  const oat = _ksOat(), gnd = _ksOnGnd();
  let changed = false;
  [1, 2].forEach(n => {
    const e = fadec.e[n], lv = _fLever(n), ph0 = e.ph;
    if (e.ph === null) e.ph = lv === 'OFF' ? 'OFF' : 'RUN';       // 처음 — 레버대로
    ['stCool', 'motorCool', 'ignCool', 'lock'].forEach(k => { if (e[k] > 0) e[k] = Math.max(0, e[k] - dt); });
    if (e.post5 > 0) { e.post5 = Math.max(0, e.post5 - dt); if (e.post5 === 0 && e.ph === 'OFF') { e.lock = FADEC.lock4h; _fSay(`ENG${n} — 2분 냉각 없이 껐고 5분이 지나 4시간 시동 금지`, 'err'); } }
    if (e.consec && performance.now() - e.lastTry > 30 * 60 * 1000) e.consec = 0;
    e.pfl = []; e.adv = '';
    // 모터링 — PCD OFF 에서 MTRING 누르는 동안
    const mtr = _ksOv('mtr' + n, 'OFF');
    if (lv === 'OFF' && (mtr === 'ON' || mtr === true || mtr === 'IN') && e.ph !== 'RUN') {
      if (e.motorCool <= 0) {
        e.ph = 'MOTOR'; e.ng = Math.min(26, e.ng + 12 * dt); e.tgt = Math.max(oat, e.tgt - 35 * dt); e.motor += dt;
        if (e.motor >= FADEC.motorMax) { e.motor = 0; e.motorN++; e.motorCool = e.motorN === 1 ? 300 : 1800; _fSay(`ENG${n} 모터링 2분 — ${e.motorN === 1 ? '5분' : '30분'} 식힘`); }
      }
    } else if (e.ph === 'MOTOR') { e.ph = 'OFF'; e.motor = 0; }
    if (e.ph === 'MOTOR') { if (e.ph !== ph0) changed = true; return; }
    // 끄기
    if (lv === 'OFF') {
      if (e.ph === 'RUN') {
        const P = _ks(() => engParams(), null), p = P ? (n === 1 ? P.e1 : P.e2) : null;
        if (p) { e.ng = p.ng; e.tgt = p.tgt; e.np = p.np; }
        if (e.cool90 < FADEC.cool90 && gnd) { e.post5 = FADEC.post5; _fSay(`ENG${n} — NG 90% 이하 2분 식히지 않고 껐다 · 5분 안에 다시 시동하거나 4시간 기다린다`); }
        e.cool90 = 0;
      }
      if (e.ph !== 'OFF') e.ph = 'OFF';
      e.ng = Math.max(0, e.ng - 18 * dt); e.np = Math.max(0, e.np - 15 * dt); e.eop = 0; e.tgt = Math.max(oat, e.tgt - 10 * dt);
      if (e.tgt >= 540) e.adv = 'TGT 540℃ 넘음 — 150℃ 아래까지 모터링';
      if (e.ph !== ph0) changed = true;
      return;
    }
    if (e.ph === 'ABORT') return;                                  // PCD 를 OFF 로 내려야 다시
    // 시동 시작
    if (e.ph === 'OFF') {
      const max = oat <= 15 ? FADEC.consecCold : FADEC.consecHot;
      if (e.lock > 0) { _fAbort(e, `4시간 시동 금지 중(${Math.ceil(e.lock / 60)}분 남음)`); changed = true; return; }
      if (e.stCool > 0) { _fAbort(e, `시동기 식히는 중(${Math.ceil(e.stCool)}초 남음)`); changed = true; return; }
      if (e.consec >= max) { _fAbort(e, `시동기 연속 ${max}회 — 30분 식힌다`); changed = true; return; }
      if (!_fBleed(n)) { _fAbort(e, '시동 공압원 없음 — APU 를 돌리거나 건너편 엔진 FLY · TQ 60% · NR 99.5%'); changed = true; return; }
      Object.assign(e, { ph: 'CRANK', t: 0, tgtUp: false, eopUp: false, npUp: false, why: '', post5: 0 });
      e.consec++; e.lastTry = performance.now(); e.tgt = Math.max(e.tgt, oat);
      _fSay(`ENG${n} 시동 — 시동기 물림(#${n} ENG STRT)`, '');
      changed = true;
    }
    if (e.ph === 'CRANK' || e.ph === 'IGN') {
      e.t += dt;
      const aisbvStuck = e.fault === 'AISBV';
      e.ng = Math.min(68, e.ng + FADEC.ngRate * dt);   // 시동 약 25초(NG 54% 시동기 분리까지)
      if (e.ng >= FADEC.ngIgn && e.ignCool <= 0) {
        e.ph = 'IGN'; e.ign += dt;
        if (e.ign >= FADEC.ignMax) { e.ign = 0; e.ignN++; e.ignCool = e.ignN < 2 ? 180 : 1380; }
      }
      if (e.ph === 'IGN') {
        const up = e.fault === 'HOT' ? 90 : 45;
        e.tgt = Math.min(e.fault === 'HOT' ? 1050 : 720, e.tgt + up * dt);
        e.eop = Math.min(45, e.eop + 3 * dt); e.np = Math.min(55, e.np + 2.5 * dt);
      } else e.eop = Math.min(15, e.eop + 1 * dt);
      if (aisbvStuck && e.ng >= 38) { e.ng = 40; _fAbort(e, 'NG 40% 부근 압축기 실속(AISBV 열리지 않음)', true); changed = true; return; }
      if (e.tgt > oat + 30) e.tgtUp = true;
      if (e.eop >= 20) e.eopUp = true;
      if (e.np >= 10) e.npUp = true;
      if (gnd && e.tgt > FADEC.hsp) { e.pfl.push(`ENG${n} H-START S-DOWN`); e.hsp = true; _fAbort(e, `HSP 작동 — 지상 시동 TGT ${FADEC.hsp}℃ 넘음`, true); changed = true; return; }
      if (e.tgt > FADEC.tgtWarn) e.adv = `TGT ${FADEC.tgtWarn}℃ 넘음 — 시동 중지`;
      else if (e.t > FADEC.tgtNoRise && !e.tgtUp) e.adv = `${FADEC.tgtNoRise}초 안에 TGT 오르지 않음 — 시동 중지`;
      else if (e.t > FADEC.eopNoRise && !e.eopUp) e.adv = `${FADEC.eopNoRise}초 안에 EOP 오르지 않음 — 시동 중지`;
      else if (e.t > FADEC.eopNoRise && !e.npUp) e.adv = `${FADEC.eopNoRise}초 안에 NP/NR 오르지 않음 — 시동 중지`;
      if (e.ng >= FADEC.ngSep) {
        e.ph = 'RUN'; e.stCool = FADEC.starterCool; e.consec = 0; e.ign = 0; e.cool90 = 0; e.hsp = false;
        _fSay(`ENG${n} 시동 완료 — NG ${FADEC.ngSep}% 시동기 분리 · ${lv}`, '');
        changed = true;
      }
      return;
    }
    // 돈다(RUN)
    if (e.ph === 'RUN') {
      e.hsp = false;
      const P = _ks(() => engParams(), null), p = P ? (n === 1 ? P.e1 : P.e2) : null;
      if (p && p.ng <= 90) e.cool90 += dt; else e.cool90 = 0;
      const other = fadec.e[3 - n];
      if (gnd && lv === 'IDLE' && other.ph === 'OFF') { e.idle1 += dt; if (e.idle1 > 180) e.adv = '한 엔진 지상 IDLE 3분 넘음'; } else e.idle1 = 0;
      if (e.fault === 'FAIL_FIX') {
        e.pfl.push(`ENG${n} FAIL FIX`);
        if (e.faultAlt - _ks(() => S.alt, 0) >= FADEC.fixDrop) { e.ph = 'OFF'; e.fault = null; _fSay(`ENG${n} 실속 — FAIL FIX 고도에서 ${FADEC.fixDrop}ft 내려왔다`, 'err'); changed = true; }
      } else if (e.fault === 'PWR_LIMIT') e.pfl.push(`ENG${n} PWR LIMIT`);
    }
    if (e.ph !== ph0) changed = true;
  });
  if (changed) { try { if (typeof simEngApply === 'function') simEngApply(true); } catch (e) { _swallow(e); } }
}
// OEI TGT 한계 확장 — 건너편이 멎었거나 FAIL FIX 이거나 TQ 차 34% 이상(TRAINING 이면 아님)
function fadecOeiExp(n) {
  if (_ks(() => simEngTrng, false)) return false;
  const o = fadec.e[3 - n];
  if (o.ph !== 'RUN' || o.fault === 'FAIL_FIX') return true;
  const P = _ks(() => engParams(), null); if (!P) return false;
  const a = n === 1 ? P.e1.tq : P.e2.tq, b = n === 1 ? P.e2.tq : P.e1.tq;
  return a - b >= FADEC.split;
}
let _fOvBusy = false;
// 03-pfd.js engParams — 시동 · 멈춤 · 실패 중에는 이 엔진의 NG · TGT · NP 를 여기 값으로, 도는 동안은 TGT 한계 · PWR LIMIT
function fadecOverride(n, p) {
  if (_ksB206() || !fadec.on) return p;
  const e = fadec.e[n];
  if (!e || e.ph === null) return p;
  if (e.ph !== 'RUN') return { tq: 0, ng: e.ng, tgt: Math.round(e.tgt), np: e.np, eop: e.eop };
  if (_fOvBusy) return p;
  _fOvBusy = true;
  try {
    const lim = fadecOeiExp(n) ? FADEC.tgtLimOei : FADEC.tgtLim;
    const q = Object.assign({}, p);
    if (q.tgt > lim) q.tgt = lim;
    if (e.fault === 'PWR_LIMIT' && q.tq > 85) q.tq = 85;
    return q;
  } finally { _fOvBusy = false; }
}
// CAS(03-pfd.js pfdMsgs) — n ENG STRT(조언) · n ENG FAULT · n FADEC(주의)
function fadecCas() {
  if (_ksB206() || !fadec.on) return [];
  const out = [], A = '#ffb000';
  [1, 2].forEach(n => {
    const e = fadec.e[n];
    if (e.ph === 'CRANK' || e.ph === 'IGN') out.push({ t: `${n} ENG STRT`, c: '#22e022' });
    if (e.hsp || e.fault === 'PWR_LIMIT') out.push({ t: `${n} ENG FAULT`, c: A });
    if (e.fault === 'FAIL_FIX') out.push({ t: `${n} FADEC`, c: A });
  });
  return out;
}
// PFL(시스템 메시지 — 03-pfd.js pfdSysMsgs) — GRA SERVICE · 엔진 PFL · CVFDR
function kuhSysMsgs() {
  if (_ksB206()) return [];
  const out = [...raSt.pfl];
  [1, 2].forEach(n => { const e = fadec.e[n]; out.push(...e.pfl); if (e.hsp && !e.pfl.length) out.push(`ENG${n} H-START S-DOWN`); });
  out.push(...sysTst.msg);
  return out;
}
function fadecState() { return { 1: Object.assign({}, fadec.e[1]), 2: Object.assign({}, fadec.e[2]) }; }

// ══════════ CDU 화면 · SYSTEM 화면 ══════════
const _kBtn = (act, arg, txt, on, extra) => `<div class="item-btn${on ? ' on' : ''}" data-act="${act}"${arg !== undefined ? ` data-arg='${JSON.stringify(arg)}'` : ''} style="flex:1;min-width:0;height:auto;min-height:40px;padding:6px 4px;font-size:11px;${extra || ''}">${txt}${on ? '<div class="status-line"></div>' : ''}</div>`;
const _kRow = (k, v, c) => `<div style="display:flex;justify-content:space-between;padding:5px 2px;border-bottom:1px solid #1d252c;font-size:12px"><span style="color:#9ab">${k}</span><b style="color:${c || '#fff'}">${v}</b></div>`;
const _kHd = t => `<div style="color:#567;font-size:10px;margin:10px 0 4px">${t}</div>`;
function kuhSysInner(id) {
  if (id === 'asys_ratest') {
    const ok = k => !raSt.pfl.includes(k);
    return _kHd('RA Self Test — 전원을 넣으면 한 번 · Allow 면 250ft AGL 위에서 60초마다 BITE') +
      `<div style="display:flex;gap:6px">${_kBtn('raStSet', ['ALLOW'], 'Allow', raSt.mode === 'ALLOW')}${_kBtn('raStSet', ['INHIBIT'], 'Inhibit', raSt.mode === 'INHIBIT')}</div>` +
      _kRow('GRA1', ok('GRA1 SERVICE') ? '✓' : 'SERVICE', ok('GRA1 SERVICE') ? '#3ad13a' : '#ffb000') +
      _kRow('GRA2', ok('GRA2 SERVICE') ? '✓' : 'SERVICE', ok('GRA2 SERVICE') ? '#3ad13a' : '#ffb000') +
      _kRow('BITE', `${raSt.n}회 · 마지막 ${raSt.last || '—'}`) +
      _kHd('외부 장착물(슬링) — 슬링을 달고 Allow 면 BITE 가 GRA SERVICE 를 낸다(Inhibit 로 둔다)') +
      `<div style="display:flex;gap:6px">${_kBtn('raStSling', undefined, `슬링 ${raSt.sling ? 'ON' : 'OFF'}`, raSt.sling)}</div>`;
  }
  if (id === 'asys_tests') {
    // 실기 화면 — 가운데 Status 상자 · 3열(FQMS1 _ FQMS2 / Engine 1 _ Engine 2 / CVFDR · Lamp Test · TCAS) · 단추 아래 상태
    const busy = Object.keys(sysTst.run).length > 0;
    const col = s => s === 'Abort' || s === 'Fail' ? '#ffb000' : s === 'ON' ? '#fff' : s === '----' ? '#9ab' : '#5fd8ff';
    const tip = `Engine(EPAC) — 지상 20초 Done · 공중은 대기속도 ${EPAC_COND.ias}kt 위 · 승강 ±${EPAC_COND.vs}fpm · 경사 ${EPAC_COND.bank}° 안이어야 Completed(아니면 Abort)`;
    const btn = k => `<div class="item-btn st-btn" data-act="sysTestRun" data-arg='${JSON.stringify([k])}' title="${k.startsWith('Engine') ? tip : k}" style="height:auto;min-height:50px;padding:4px 3px;justify-content:center">` +
      `<span style="font-size:12px;color:#e8f4ff">${k.replace(/^FQMS (\d)$/, 'FQMS$1')}</span>` +
      `<span style="font-size:${sysTst.st[k] === '----' ? 12 : 14}px;font-weight:bold;color:${col(sysTst.st[k])}">${sysTst.st[k]}${k.startsWith('Engine') && sysTst.abortY[k === 'Engine 1' ? 0 : 1] ? ' ⚠' : ''}</span></div>`;
    const gap = '<div></div>';
    return `<div style="display:flex;justify-content:center;margin:2px 0 14px"><div class="st-status" style="background:#000;border:2px solid #556;border-radius:3px;padding:4px 22px;text-align:center;min-width:140px">` +
      `<div style="color:#fff;font-size:13px">Status</div><div style="color:#fff;font-size:13px">${busy ? 'Busy' : 'Ready To Execute'}</div></div></div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 5px">` +
      btn('FQMS 1') + gap + btn('FQMS 2') + btn('Engine 1') + gap + btn('Engine 2') + btn('CVFDR') + btn('Lamp Test') + btn('TCAS') + `</div>` +
      (sysTst.msg.length ? `<div style="color:#ffb000;font-size:11px;margin-top:8px">${sysTst.msg.join(' · ')}</div>` : '');
  }
  if (id === 'asys_light') {
    const o = litOut();
    return _kHd('CDU 밝기') + `<div style="display:flex;gap:5px">${['DAY', 'NVIS', 'AUTO', 'RMT'].map(m => _kBtn('litSet', ['cdu', m], m, litCfg.cdu === m)).join('')}</div>` +
      `<div style="display:flex;gap:6px;margin-top:6px;align-items:center">${_kBtn('litBrt', [-10], '−', false, 'flex:0 0 44px')}<div style="flex:1;text-align:center;font-size:13px">수동 ${litCfg.cduBrt}%</div>${_kBtn('litBrt', [10], '+', false, 'flex:0 0 44px')}</div>` +
      _kHd('MFD 밝기(PFD · SYSTEM)') + `<div style="display:flex;gap:5px">${['DAY', 'NVIS', 'REMOTE'].map(m => _kBtn('litSet', ['mfd', m], m, litCfg.mfd === m)).join('')}</div>` +
      _kRow('DISPLAY 스위치', o.sw) + _kRow('CDU', `${o.cduMode} · ${Math.round(o.cduB * 100)}%`) + _kRow('MFD', `${o.mfdMode} · ${Math.round(o.mfdB * 100)}%`) +
      _kRow('콘솔 조명(LOWER)', `${o.consV.toFixed(1)} V DC`);
  }
  if (id === 'asys_maint') {
    const back = maint.step === 'PASSWORD' ? '' : `<div style="margin-bottom:6px">${_kBtn('maintBack', undefined, '◀ 위로', false, 'flex:none;width:90px;min-height:30px')}</div>`;
    if (maint.step === 'PASSWORD') return _kHd('Maintenance — 비밀번호') +
      `<div style="display:flex;gap:6px"><input id="maint-pw" type="password" autocomplete="off" style="flex:1;min-width:0;background:#000;color:#fff;border:1px solid #2fe0e0;font-size:16px;padding:6px">` +
      `${_kBtn('maintPwEnter', undefined, 'Enter', false, 'flex:0 0 70px')}</div>` +
      (maint.err ? `<div style="color:#ff5050;font-size:12px;margin-top:6px">비밀번호가 맞지 않습니다</div>` : '');
    if (maint.step === 'SYS_MAINT') return back + _kHd('System Maintenance') + `<div style="display:flex;gap:6px">${_kBtn('maintGo', ['LOGGING_STATUS'], 'CMC Logs')}${_kBtn('maintGo', ['PASSWORD'], 'Log Out')}</div>` +
      _kHd('Restart Options') + `<div style="display:flex;gap:6px">${_kBtn('cfgEnter', undefined, 'System to Config Mode')}</div>`;
    if (maint.step === 'CONFIG') {
      const pg = CFG_PAGES[cfgMode.page];
      const body = !cfgMode.in
        ? CFG_PAGES.map((p, i) => `<div style="padding:5px 8px;margin-bottom:2px;border-radius:3px;${i === cfgMode.page ? 'background:#2fe0e0;color:#000;font-weight:bold' : 'color:#cde'}">${p}</div>`).join('')
        : `<div style="color:#2fe0e0;font-weight:bold;margin-bottom:6px">${pg}</div>` +
          (pg === 'Knobs' ? _kRow('마지막 노브 입력', cfgMode.last || '—') : '') +
          [...Array(6).keys()].map(i => `<div style="padding:4px 8px;border-radius:3px;${i === cfgMode.item ? 'background:#16353b;color:#2fe0e0' : 'color:#9ab'}">${pg} · Item ${i + 1}</div>`).join('');
      return _kHd('Home (Config Mode) — 오른쪽 큰 노브 장 · 작은 노브 항목 · 누름 들어감/나옴') + body +
        `<div style="display:flex;gap:6px;margin-top:8px">${_kBtn('cfgExit', undefined, 'Exit Config Mode')}</div>`;
    }
    if (maint.step === 'LOGGING_STATUS') return back + _kHd('CMC Logs — Logging Status') + _kRow('Logging', 'Active', '#3ad13a') + _kRow('MFL 기록', `${maint.mfl.length}건`) +
      `<div style="display:flex;gap:6px;margin-top:8px">${_kBtn('maintGo', ['FAULTS_LIST'], 'Faults List')}</div>`;
    if (maint.step === 'FAULTS_LIST') {
      const d = maint.t0, dt = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} ${d.toTimeString().slice(0, 8)}`;
      return back + _kHd('Faults List — 폴더를 누르면 SYSTEM 창에 CMC Log Viewer') +
        `<div class="item-btn" data-act="maintGo" data-arg='["CMC_LOG_VIEWER","LOG_NOW"]' style="height:auto;padding:7px;align-items:stretch">` +
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>${dt}</span><span>${_ks(() => (S.wps && S.wps[0] && S.wps[0].ident) || '', '') || '—'}</span></div>` +
        `<div style="display:flex;justify-content:space-between;font-size:10px;color:#9ab"><span>Unexported</span><span>${(maint.mfl.length * 0.12 + 0.4).toFixed(1)} KB</span></div></div>`;
    }
    return back + _kHd('CMC Log Viewer') + `<div style="font-size:12px;color:#cde">SYSTEM 창에 이번 비행의 결함 목록(MFL)이 보입니다 — ${maint.mfl.length}건 · 맨 아래가 최근</div>`;
  }
  return '';
}
// 18-system.js sysCduHtml — 이 네 화면은 여기서
function kuhSysCdu(id) {
  if (!['asys_ratest', 'asys_tests', 'asys_light', 'asys_maint'].includes(id)) return '';
  return `<div id="kuhsys" data-page="${id}" style="padding:8px 8px;color:#cde;font-size:12px">${kuhSysInner(id)}</div>`;
}
let _ksSig = '';
function _ksRefresh(force) {
  const el = document.getElementById('kuhsys'); if (!el) return;
  if (!force && el.dataset.page === 'asys_maint' && maint.step === 'PASSWORD') return;   // 입력 중에는 다시 그리지 않는다
  const h = kuhSysInner(el.dataset.page);
  if (force || h !== _ksSig) { _ksSig = h; el.innerHTML = h; }
  try { if (typeof sysPage !== 'undefined' && ['asys_ratest', 'asys_tests', 'asys_light', 'asys_maint'].includes(sysPage)) sysDraw(); } catch (e) { _swallow(e); }
}
// SYSTEM 창(18-system.js _sysPaint) — 큰 칸(x, y, w, h)에 그린다. 그렸으면 true
function kuhSysDraw(g, id, x, y, w, h) {
  const rows = [];
  if (id === 'asys_ratest') {
    rows.push(['Mode', raSt.mode === 'ALLOW' ? 'Allow' : 'Inhibit', '#fff'], ['GRA1', raSt.pfl.includes('GRA1 SERVICE') ? 'SERVICE' : '✓', raSt.pfl.includes('GRA1 SERVICE') ? '#ffb000' : '#3ad13a'],
      ['GRA2', raSt.pfl.includes('GRA2 SERVICE') ? 'SERVICE' : '✓', raSt.pfl.includes('GRA2 SERVICE') ? '#ffb000' : '#3ad13a'], ['BITE', `${raSt.n} · ${raSt.last || '—'}`, '#fff'],
      ['External Load', raSt.sling ? 'ON' : 'OFF', '#fff']);
  } else if (id === 'asys_tests') {
    rows.push(['Status', Object.keys(sysTst.run).length ? 'Busy' : 'Ready To Execute', '#2fe0e0']);
    SYS_TEST_IDS.forEach(k => rows.push([k, sysTst.st[k], sysTst.st[k] === 'Abort' || sysTst.st[k] === 'Fail' ? '#ffb000' : /Pass|Done|Completed/.test(sysTst.st[k]) ? '#3ad13a' : '#fff']));
  } else if (id === 'asys_light') {
    const o = litOut();
    rows.push(['DISPLAY', o.sw, '#fff'], ['CDU', `${litCfg.cdu} → ${o.cduMode} ${Math.round(o.cduB * 100)}%`, '#fff'], ['MFD', `${litCfg.mfd} → ${o.mfdMode} ${Math.round(o.mfdB * 100)}%`, '#fff'], ['Console', `${o.consV.toFixed(1)} V DC`, '#fff']);
  } else if (id === 'perf') { perfMfdDraw(g, x, y, w, h); return true;
  } else if (id === 'asys_maint') {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 16px Helvetica Neue, Arial, sans-serif';
    if (maint.step !== 'CMC_LOG_VIEWER') { g.fillStyle = '#4a6a7a'; g.fillText('MAINTENANCE — CDU 에서 비밀번호 · CMC Logs', x + w / 2, y + h / 2); return true; }
    g.fillText('CMC Log Viewer — Event Entries', x + w / 2, y + 30);
    const cols = [x + 16, x + w * 0.2, x + w * 0.31, x + w * 0.72, x + w - 16];
    g.font = 'bold 12px Helvetica Neue, Arial, sans-serif'; g.fillStyle = '#9ab'; g.textAlign = 'left';
    ['Subsystem', 'Test No', 'Fault Name', 'Time'].forEach((t, i) => g.fillText(t, cols[i], y + 56)); g.textAlign = 'right'; g.fillText('State', cols[4], y + 56);
    const L = maint.mfl.slice(-Math.floor((h - 80) / 20));
    g.font = '12px Helvetica Neue, Arial, sans-serif';
    L.forEach((m, i) => {
      const yy = y + 78 + i * 20; g.textAlign = 'left'; g.fillStyle = '#fff';
      [m.sub, m.no, m.t, m.time].forEach((t, j) => g.fillText(t, cols[j], yy));
      g.textAlign = 'right'; g.fillStyle = m.st === 'SET' ? '#ffb000' : '#3ad13a'; g.fillText(m.st, cols[4], yy);
    });
    if (!L.length) { g.textAlign = 'center'; g.fillStyle = '#678'; g.fillText('결함 기록 없음', x + w / 2, y + 100); }
    return true;
  } else return false;
  g.font = 'bold 18px Helvetica Neue, Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
  g.fillText(SYS_PAGES[id] || '', x + w / 2, y + 40);
  rows.forEach(([k, v, c], i) => {
    const yy = y + 84 + i * 34;
    g.font = '16px Helvetica Neue, Arial, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#9ab'; g.fillText(k, x + w * 0.18, yy);
    g.textAlign = 'right'; g.fillStyle = c; g.font = 'bold 16px Helvetica Neue, Arial, sans-serif'; g.fillText(v, x + w * 0.82, yy);
    g.strokeStyle = '#1d252c'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + w * 0.16, yy + 10); g.lineTo(x + w * 0.84, yy + 10); g.stroke();
  });
  return true;
}

// ── 한 걸음(0.1초) ──
let _ksT = performance.now();
setInterval(() => {
  const now = performance.now(), dt = Math.min(1, (now - _ksT) / 1000); _ksT = now;
  try { raStStep(dt); } catch (e) { _swallow(e); }
  try { sysTestStep(dt); } catch (e) { _swallow(e); }
  try { fadecStep(dt); } catch (e) { _swallow(e); }
  try { mflStep(); } catch (e) { _swallow(e); }
  try { litApply(); } catch (e) { _swallow(e); }
  try { _ksRefresh(); } catch (e) { _swallow(e); }
}, 100);
try { appRegister({ raStSet, raStSling, sysTestRun, litSet, litBrt, maintPwEnter, maintGo, maintBack }); } catch (e) { _swallow(e); }

// ══════════ ⑥ CDU 노브 — 레이더 제어(Push:Radar) · 정비 Config Mode ══════════
//   레이더: SYSTEM 창 Video 채널 RADAR 가 보일 때 CDU 조이스틱을 누르면 레이더 제어가 열리고 다시 누르면 닫힌다(FLM 7.15 · 5.20)
//     열려 있으면 조이스틱 회전 = 거리(RNG) · 오른쪽 큰 노브 = TILT(−15~+15°) · 작은 노브 = GAIN(0~32) · 누름 = RDR TX · 1.5초 누름 = FREEZE
//   Config Mode(AMM 31-60-02-727): Maintenance → Restart Options → System to Config Mode — 큰 노브 장 이동 · 작은 노브 항목 · 누름 들어감/나옴
//     (실기는 CDU1 C/B 를 넣을 때 오른쪽 작은 노브를 누르고 있으면 들어간다 — 이 앱에는 회로차단기가 없다)
const RADAR_RNG = [2.5, 5, 10, 20, 40, 80, 160];
const radarCtl = { open: false, tx: false, rOnly: false, freeze: false, mode: 'SEARCH', range: 20, tilt: 0, gain: 16 };
function radarShown() {
  try {
    if (videoCfg.ch !== 'RADAR') return false;
    return sysPage === 'asys_video' || (sysLayout === 'HALF' && (sysHalf.L === 'asys_video' || sysHalf.R === 'asys_video'));
  } catch (e) { return false; }
}
const CFG_PAGES = ['Status', 'Knobs', 'GDU Controls', 'Diagnostics Terminal', 'Database Status', 'File Manager', 'Systems', 'Fan Control', 'Restart Options'];
const cfgMode = { on: false, page: 0, in: false, item: 0, last: '' };
function cfgEnter() { cfgMode.on = true; cfgMode.page = 0; cfgMode.in = false; cfgMode.item = 0; maint.step = 'CONFIG'; _fSay('Restart — System to Config Mode(CDU · MFD · ACP 다시 시작)', ''); _ksRefresh(true); }
function cfgExit() { cfgMode.on = false; maint.step = 'SYS_MAINT'; _ksRefresh(true); }
// 18-system.js cduKnobOp 가 먼저 묻는다 — 여기서 처리했으면 true
function kuhKnob(k, op, a) {
  if (cfgMode.on && k === 'R') {
    cfgMode.last = `R ${op}${a ? (a > 0 ? ' +' : ' −') : ''}`;
    if (op === 'rot' && !cfgMode.in) cfgMode.page = (cfgMode.page + a + CFG_PAGES.length) % CFG_PAGES.length;
    else if (op === 'rotIn' || (op === 'rot' && cfgMode.in)) cfgMode.item = Math.max(0, Math.min(5, cfgMode.item + a));
    else if (op === 'push') { cfgMode.in = !cfgMode.in; cfgMode.item = 0; }
    _ksRefresh(true); return true;
  }
  if (cfgMode.on) cfgMode.last = `${k} ${op}`;
  if (k === 'L' && op === 'push' && radarShown()) { radarCtl.open = !radarCtl.open; try { sysDraw(); } catch (e) { _swallow(e); } return true; }
  if (radarCtl.open && radarShown()) {
    if (k === 'L' && op === 'rot') { const i = RADAR_RNG.indexOf(radarCtl.range); radarCtl.range = RADAR_RNG[Math.max(0, Math.min(RADAR_RNG.length - 1, (i < 0 ? 3 : i) + a))]; }
    else if (k === 'R' && op === 'rot') radarCtl.tilt = Math.max(-15, Math.min(15, radarCtl.tilt + a));
    else if (k === 'R' && op === 'rotIn') radarCtl.gain = Math.max(0, Math.min(32, radarCtl.gain + a));
    else if (k === 'R' && op === 'push') radarCtl.tx = !radarCtl.tx;
    else if (k === 'R' && op === 'hold') radarCtl.freeze = !radarCtl.freeze;
    else return false;
    try { sysDraw(); } catch (e) { _swallow(e); } return true;
  }
  return false;
}
// 라벨 바 덮어쓰기 — { L, R } (없으면 18-system.js 기본)
function kuhKnobLabels() {
  const o = {};
  if (radarShown()) o.L = ['− Range +', `Push:Radar ${radarCtl.open ? '<b>ON</b>' : ''}`];
  if (radarCtl.open && radarShown()) o.R = ['Tilt · Gain', `<b>${radarCtl.tilt > 0 ? '+' : ''}${radarCtl.tilt}° · G${radarCtl.gain}</b>`, 'Push:TX Hold:FRZ'];
  if (cfgMode.on) o.R = ['Config Mode', `<b>${CFG_PAGES[cfgMode.page]}</b>`, 'Push:Menu'];
  return o;
}
// SYSTEM 창 Video RADAR — 레이더 제어 차림(메인: RNG · RDR TX · R ONLY · FREEZE · SEARCH · MAINT / 기상: TILT · GAIN)
function radarDraw(g, x, y, w, h) {
  if (!radarCtl.open) return;
  const bx = x + w - 230, by = y + 60;
  g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(bx, by, 210, 250); g.strokeStyle = '#2fe0e0'; g.lineWidth = 2; g.strokeRect(bx, by, 210, 250);
  g.font = 'bold 15px Helvetica Neue, Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#2fe0e0'; g.fillText('RADAR CONTROL', bx + 105, by + 24);
  const rows = [['RNG', `${radarCtl.range} NM`], ['RDR TX', radarCtl.tx ? 'ON' : 'STBY'], ['R ONLY', radarCtl.rOnly ? 'ON' : 'OFF'], ['FREEZE', radarCtl.freeze ? 'ON' : 'OFF'],
                ['MODE', radarCtl.mode], ['TILT', `${radarCtl.tilt > 0 ? '+' : ''}${radarCtl.tilt}°`], ['GAIN', String(radarCtl.gain)]];
  rows.forEach(([k, v], i) => {
    const yy = by + 54 + i * 27;
    g.textAlign = 'left'; g.fillStyle = '#9ab'; g.font = '14px Helvetica Neue, Arial, sans-serif'; g.fillText(k, bx + 14, yy);
    g.textAlign = 'right'; g.fillStyle = (k === 'RDR TX' && radarCtl.tx) || (k === 'FREEZE' && radarCtl.freeze) ? '#22e022' : '#fff'; g.font = 'bold 14px Helvetica Neue, Arial, sans-serif'; g.fillText(v, bx + 196, yy);
  });
}

// ══════════ ⑦ NAV 예비 주파수 · 교환 · DME HOLD · ILS 자동 ══════════
//   NAV1 · NAV2 마다 활성(navRadios — 지금 튜닝) · 예비(navStby). 활성에 새 주파수가 들어가면(CDU 입력 · 접근 자동 튜닝) 앞 활성은 예비로 내려간다
//   ↕(교환) · CDU 오른쪽 노브(NAV 탭 — 예비를 1 MHz · 50 kHz · 1.5초 누름 교환) · DME HOLD(켜 둔 국의 거리를 계속 — 'H')
//   ILS/LOC 접근: CDI 가 FMS 인 채로 FAF 15NM 안에서 최종 접근 진로(LOC)에 들면 그 LOC 를 맞춘 NAV 로 바뀐다(FLM 7.15.3.8)
const navStby = { NAV1: '113.00', NAV2: '113.25' };
try { Object.assign(navStby, JSON.parse(localStorage.getItem('navStby') || '{}')); } catch (e) { _swallow(e); }
const navDmeHold = { NAV1: null, NAV2: null };
let _navSwapping = false;
function _navStbySave() { try { localStorage.setItem('navStby', JSON.stringify(navStby)); } catch (e) { _swallow(e); } }
try {
  if (typeof setNavRadio === 'function') {
    const _snr = setNavRadio;
    setNavRadio = function (navId, freq, id) {
      const r = (typeof navRadios !== 'undefined' && navRadios[navId]) || {}, old = r.freq;
      _snr(navId, freq, id);
      if (!_navSwapping && freq != null && old != null && Math.abs(parseFloat(old) - parseFloat(r.freq)) >= 0.001) { navStby[navId] = Number(old).toFixed(2); _navStbySave(); }
    };
  }
} catch (e) { _swallow(e); }
function navSwap(navId) {
  const r = navRadios[navId]; if (!r) return;
  const old = r.freq, nw = navStby[navId];
  _navSwapping = true;
  try { const v = typeof _resolveVor === 'function' ? _resolveVor(nw, null) : null; setNavRadio(navId, nw, v ? v.id : null); } finally { _navSwapping = false; }
  navStby[navId] = Number(old).toFixed(2); _navStbySave();
  try { if (typeof cduRerender === 'function') cduRerender(); } catch (e) { _swallow(e); }
}
function navStbyStep(navId, big, d) {
  let [mhz, khz] = String(navStby[navId]).split('.');
  mhz = +mhz; khz = Math.round(+('0.' + (khz || '0')) * 1000);
  if (big) mhz = 108 + ((mhz - 108 + d) % 10 + 10) % 10; else khz = ((khz + 50 * d) % 1000 + 1000) % 1000;
  navStby[navId] = mhz + '.' + String(Math.round(khz / 10)).padStart(2, '0'); _navStbySave();
}
function navDmeHoldToggle(navId) {
  const r = navRadios[navId]; if (!r) return;
  navDmeHold[navId] = navDmeHold[navId] ? null : (r.lat != null ? { lat: r.lat, lon: r.lon, elev: r.elev || 0, id: r.id, freq: r.freq } : null);
  try { if (typeof cduRerender === 'function') cduRerender(); } catch (e) { _swallow(e); }
}
// ILS/LOC 자동 — FMS 인 채로 FAF 15NM 안 · LOC 진로 ±2.5° 안 · 다가가는 쪽이면 LOC 를 맞춘 NAV 로
let _ilsAutoDone = '';
function navIlsAutoStep() {
  if (typeof navSrc === 'undefined' || navSrc !== 'FMS') return;
  const id = ['NAV1', 'NAV2'].find(n => navRadios[n] && navRadios[n].loc && navRadios[n].lat != null);
  if (!id) return;
  const r = navRadios[id], key = id + r.id;
  if (_ilsAutoDone === key) return;
  const wps = _ks(() => S.wps, []), faf = wps.find(w => /FAF|^FF/i.test(String(w.role || w.ident || ''))) || wps[wps.length - 1];
  const dFaf = faf ? distance(S.lat, S.lon, faf.lat, faf.lon) : distance(S.lat, S.lon, r.lat, r.lon);
  if (dFaf > 15) return;
  const brgTo = bearing(S.lat, S.lon, r.lat, r.lon), crs = Number.isFinite(r.crs) ? r.crs : null;
  if (crs == null) return;
  const off = Math.abs(((brgTo - crs + 540) % 360) - 180);
  if (off > 2.5) return;
  _ilsAutoDone = key;
  try { setNavSrc(id); } catch (e) { _swallow(e); }
  _fSay(`ILS/LOC 최종 접근 진로 — CDI FMS → ${id}(${r.id}) 자동 전환`, '');
}

// ══════════ ⑧ HOCAS — MEP CTL(DOI) · DMS · CURSOR(조이스틱 배정 · 12-joystick.js) ══════════
//   MEP CTL(사이클릭 4방향): 처음 누르면 DOI(제어 대상 지시 — 청록 테두리)를 만들고, 다음부터 PFD → SYSTEM(MFD) → 지도(DMM) 를 차례로
//   DMS(사이클릭 4방향 + 누름): DOI 화면의 메뉴 — 지도: 위/아래 메뉴(DIR · VIEW · QUICK · SETUP) · 오른쪽 펼침 · 누름(VIEW 면 2D ⇄ 3D)
//     SYSTEM: 위/아래 계통 화면 · 왼/오른쪽 HALF 판 / PFD: 위/아래 CAS 넘기기
//   CURSOR(컬렉티브 X/Y + 누름 + ENABLE): DOI 가 지도면 지도 포인터(CDU 조이스틱과 같은 것)를 켜고(ENABLE · 위로 길게 FREEZE) 움직인다 · 누름은 기체 자리로
const HOCAS_DOI = ['pfd', 'sysp', 'map'], HOCAS_DOI_NM = { pfd: 'MFD2 PFD', sysp: 'MFD4 SYSTEM', map: 'DMM MAP' }, DMM_MENU = ['DIR', 'VIEW', 'QUICK', 'SETUP'];
const hocasSw = { doi: null, dms: 'DIR', exp: false, view: '2D', curEn: false, cx: 0, cy: 0, last: '' };
function _doiPaint() {
  ['pfd-wrap', 'sysp-wrap', 'map-wrap'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.classList.toggle('hocas-doi', hocasSw.doi === HOCAS_DOI[i]); });
}
function hocasMep(dir) {
  hocasSw.last = 'MEP ' + dir;
  if (!hocasSw.doi) hocasSw.doi = 'pfd';
  else { const i = HOCAS_DOI.indexOf(hocasSw.doi), d = dir === 'R' || dir === 'A' ? 1 : -1; hocasSw.doi = HOCAS_DOI[(i + d + HOCAS_DOI.length) % HOCAS_DOI.length]; }
  _doiPaint();
}
function hocasDms(dir, long) {
  hocasSw.last = 'DMS ' + dir + (long ? ' (길게)' : '');
  const doi = hocasSw.doi; if (!doi) return;
  if (doi === 'map') {
    if (dir === 'U' || dir === 'D') {
      if (long) hocasSw.dms = dir === 'U' ? DMM_MENU[0] : DMM_MENU[DMM_MENU.length - 1];
      else { const i = DMM_MENU.indexOf(hocasSw.dms); hocasSw.dms = DMM_MENU[(i + (dir === 'U' ? -1 : 1) + DMM_MENU.length) % DMM_MENU.length]; }
    } else if (dir === 'R') hocasSw.exp = true;
    else if (dir === 'L') hocasSw.exp = false;
    else if (dir === 'P') {
      if (long) hocasSw.exp = false;
      else if (hocasSw.dms === 'VIEW') { hocasSw.view = hocasSw.view === '2D' ? '3D' : '2D'; try { if (typeof toggle3dMap === 'function') toggle3dMap(); } catch (e) { _swallow(e); } }
    }
  } else if (doi === 'sysp') {
    const ids = Object.keys(SYS_PAGES).filter(k => k !== 'map'), i = ids.indexOf(sysPage);
    if (dir === 'U' || dir === 'D') sysPageSet(ids[(i + (dir === 'U' ? -1 : 1) + ids.length) % ids.length]);
    else if ((dir === 'L' || dir === 'R') && sysLayout === 'HALF') { sysSel = dir; sysPage = sysHalf[sysSel]; try { sysDraw(); } catch (e) { _swallow(e); } }
  } else if (doi === 'pfd') { if (dir === 'U' || dir === 'D') { try { pfdCasStep(dir === 'U' ? -1 : 1); } catch (e) { _swallow(e); } } }
}
function hocasCursor(op, dx, dy) {
  hocasSw.last = 'CURSOR ' + op;
  if (op === 'en') { hocasSw.curEn = !hocasSw.curEn; if (hocasSw.curEn && hocasSw.doi === 'map' && !knobPtr.on) knobPtrToggle(); if (!hocasSw.curEn && knobPtr.on) knobPtrToggle(); return; }
  if (hocasSw.doi !== 'map') return;
  if (op === 'freeze' && !knobPtr.on) { hocasSw.curEn = true; knobPtrToggle(); return; }
  if (!knobPtr.on) return;
  if (op === 'push') { knobPtr.x = 0; knobPtr.y = 0; try { leafMap.panTo([S.lat, S.lon], { animate: false }); } catch (e) { _swallow(e); } knobPtrDraw(); return; }
  if (op === 'slew') { knobPtrMove(dx, dy); hocasSw.cx = Math.max(-1, Math.min(1, knobPtr.x / 200)); hocasSw.cy = Math.max(-1, Math.min(1, -knobPtr.y / 200)); }
}

let _hcSlew = null;
function hocasSlewStart(dx, dy) { hocasSlewStop(); hocasCursor('slew', dx, dy); _hcSlew = setInterval(() => hocasCursor('slew', dx, dy), 120); }
function hocasSlewStop() { if (_hcSlew) { clearInterval(_hcSlew); _hcSlew = null; } }

// ══════════ ⑨ 전기 — GCU 보호 · 버스 타이 · 부하 차단 · 배터리 단독 ══════════
//   GCU: 저전압 100V · 과전압 125V 4.5초 · 저주파 336Hz 4초 · 고주파 475Hz 2초 넘게 이어지면 그 발전기를 떼어 낸다(GEN 스위치를 OFF 했다 ON 해야 다시)
//   AC-BTC: 발전기 하나면 정상 쪽이 반대 버스까지 · 둘 다 없고 APU GEN 만이면 AC · DC NON-ESSENTIAL 차단(로터 제빙 TEST 만)
//   APU GEN 단독 + 비상 유압 펌프 + 윈드실드 방빙 + 엔진 흡입구 방빙을 함께 2분 넘게 쓰면 경고
//   TRU 하나가 멎으면 DC BTC 로 정상 쪽이 반대 버스까지 · 둘 다 멎으면(또는 AC 가 없으면) 배터리 단독 — 80% 에서 약 50분
const elecFault = { gen1: null, gen2: null, tru1: false, tru2: false };
const GCU_LIM = { UV: 4.5, OV: 4.5, UF: 4, OF: 2 };
const elecGcu = { t: { 1: 0, 2: 0 }, trip: { 1: false, 2: false } };
const elecBatt = { soc: 100, aiT: 0, aiWarned: false };
function elecFaultSet(k, v) { elecFault[k] = v; if (k === 'gen1' || k === 'gen2') { const n = k === 'gen1' ? 1 : 2; if (!v) elecGcu.t[n] = 0; } }
function gcuTripped(n) { return !!elecGcu.trip[n]; }
try { if (typeof ovhdOn === 'function') ovhdOn((id, v) => { if ((id === 'gen1' || id === 'gen2') && v === 'OFF') { const n = id === 'gen1' ? 1 : 2; elecGcu.trip[n] = false; elecGcu.t[n] = 0; } }); } catch (e) { _swallow(e); }
function elecStep(dt) {
  if (_ksB206()) return;
  [1, 2].forEach(n => {
    const f = elecFault['gen' + n];
    if (f && !elecGcu.trip[n] && _ksOv('gen' + n, 'ON') === 'ON') {
      elecGcu.t[n] += dt;
      if (elecGcu.t[n] >= GCU_LIM[f]) { elecGcu.trip[n] = true; _fSay(`GCU ${n} — ${{ UV: '저전압 100V', OV: '과전압 125V', UF: '저주파 336Hz', OF: '고주파 475Hz' }[f]} · ${n}번 발전기를 떼어 냈다`, 'err'); }
    }
  });
  let E = null; try { E = elecState(); } catch (e) { _swallow(e); }
  if (!E) return;
  if (E.battOnly) elecBatt.soc = Math.max(0, elecBatt.soc - 80 / (50 * 60) * dt);
  else if (E.tru1 || E.tru2) elecBatt.soc = Math.min(100, elecBatt.soc + 0.05 * dt);
  const aiAll = E.apuConn && !E.gen1 && !E.gen2 && _ksOv('emergPump', 'AUTO') === 'ON' && (_ksOv('wsPlt', 'OFF') === 'ON' || _ksOv('wsCplt', 'OFF') === 'ON') && (_ksOv('engAi1', 'OFF') === 'ON' || _ksOv('engAi2', 'OFF') === 'ON');
  elecBatt.aiT = aiAll ? elecBatt.aiT + dt : 0;
  if (elecBatt.aiT > 120 && !elecBatt.aiWarned) { elecBatt.aiWarned = true; _fSay('APU GEN 단독 — 비상 유압 펌프 · 윈드실드 · 흡입구 방빙 동시 2분 넘음(하나를 끈다)', 'err'); }
  if (!aiAll) elecBatt.aiWarned = false;
}
function elecBattMin() { return elecBatt.soc / 80 * 50; }
function elecCas() {
  if (_ksB206()) return [];
  let E = null; try { E = elecState(); } catch (e) { return []; }
  const out = [], A = '#ffb000';
  [1, 2].forEach(n => { if (_ksOv('tru' + n, 'ON') === 'ON' && E.ac && !E['tru' + n]) out.push({ t: `${n} TRU`, c: A }); });
  if (E.battOnly && elecBatt.soc < 25) out.push({ t: 'BATT LOW', c: A });
  return out;
}
function elecSysNote(g) {
  let E = null; try { E = elecState(); } catch (e) { return; }
  const lines = [[`AC NON-ESS ${E.acNess ? 'ON' : 'SHED'}`, E.acNess ? '#3ad13a' : '#ffb000'], [`DC NON-ESS ${E.dcNess ? 'ON' : 'SHED'}`, E.dcNess ? '#3ad13a' : '#ffb000'],
                 [`AC-BTC ${E.tie ? 'CLOSED' : 'OPEN'} · DC BTC ${E.dcTie ? 'CLOSED' : 'OPEN'}`, '#fff'],
                 [E.battOnly ? `BATTERY ONLY ${Math.round(elecBatt.soc)}% · ${Math.round(elecBattMin())} min` : `BATT ${Math.round(elecBatt.soc)}%`, E.battOnly ? '#ffb000' : '#fff']];
  g.save(); g.font = 'bold 13px Helvetica Neue, Arial, sans-serif'; g.textAlign = 'left';
  lines.forEach(([t, c], i) => { g.fillStyle = c; g.fillText(t, 240, 548 + i * 18); });
  g.restore();
}

// ══════════ ⑩ AFCS — P FLT TEST 조건 · 결과 셋 · 5회 실패 잠김 · 고장 등급별 남는 모드 ══════════
//   시험 조건(FLM 2.3.4): 땅 위 · 유압 정상 · DC · AP1 · AP2 OFF(AFCAU OFF 글씨) · (조이스틱이 있으면) 사이클릭 · 페달 가운데
//   시험 중 다시 누르면 중단. 결과: AP1/AP2 TEST OK · 사소한 결함(한쪽 APM · SEMA2 — 기능 저하 운용) · 중요 결함(두 APM · 한 축 SEMA 둘 — 운용 불가)
//   결함이 5회 쌓이면 AFCS 사용 불가(AFCS FAIL)
//   고장(교관 창): APM1 · APM2(둘 다면 AFCS FAIL · 130 KIAS) · 피치 SEMA2(그 축 황색 저하) · 피치 SEMA 둘(그 축만 SAS) · COLL LINK(컬렉티브 축만 — CAS)
const afcsFault = { apm1: false, apm2: false, sema2: { C: false, YR: false, P: false }, semaBoth: { C: false, YR: false, P: false }, collLink: false };
const afcsPft = { fails: 0, lock: false, result: '' };
function afcsPftPre() {
  if (_ksOv('ap1', 'OUT') !== 'IN' || _ksOv('ap2', 'OUT') !== 'IN') return 'AP1 · AP2 를 OFF 로';
  try {
    if (typeof joyOn !== 'undefined' && joyOn && typeof hocasAxes === 'function') {
      const ax = hocasAxes();
      if (Math.abs(ax.roll || 0) > 0.15 || Math.abs(ax.pitch || 0) > 0.15) return '사이클릭을 가운데로';
      if (Math.abs(ax.yaw || 0) > 0.15) return '페달을 가운데로';
    }
  } catch (e) { _swallow(e); }
  return '';
}
function afcsPftResult() {
  const F = afcsFault, anyBoth = Object.values(F.semaBoth).some(Boolean), anySema2 = Object.values(F.sema2).some(Boolean);
  if ((F.apm1 && F.apm2) || anyBoth) return 'MAJOR';
  if (F.apm1 || F.apm2 || anySema2) return 'MINOR';
  return 'OK';
}
function afcsPftDone(res) {
  afcsPft.result = res;
  if (res !== 'OK') { afcsPft.fails++; if (afcsPft.fails >= 5 && !afcsPft.lock) { afcsPft.lock = true; _fSay('P FLT TEST 5회 실패 — AFCS 사용 불가', 'err'); } }
  else afcsPft.fails = 0;
}
function afcsFaultSet(k, on) {
  if (k === 'apm1' || k === 'apm2' || k === 'collLink') afcsFault[k] = on;
  else if (k === 'semaP2') afcsFault.sema2.P = on;
  else if (k === 'semaPB') afcsFault.semaBoth.P = on;
}

// ── ⑥~⑩ 한 걸음 ──
setInterval(() => {
  try { elecStep(0.25); } catch (e) { _swallow(e); }
  try { navIlsAutoStep(); } catch (e) { _swallow(e); }
}, 250);
try { appRegister({ cfgEnter, cfgExit, navSwap, navDmeHoldToggle }); } catch (e) { _swallow(e); }

// ══════════ ⑪ 성능 — MFD 'Helicopter Performance' · 높이-속도(H-V) 선도 ══════════
//   H-V 회피영역(FLM 1.3 그림 2 — 한 엔진 고장 · OEI 2.5분 · 단단한 활주로 · 무풍, 19,200 lb):
//     해면 ISA 0kt 25~210ft → 22kt 25~45ft / 4,000ft ISA+20 0kt 25~465ft → 37.5kt 25~80ft
//   두 선도 사이는 밀도고도(해면 ISA 0 ft ~ 4,000ft ISA+20 ≈ 6,400 ft)로 잇는다(교범 그림의 대표점만 — 바꾸기 쉬운 표)
const HV_CURVES = [{ da: 0, top: 210, knee: 22, kneeHi: 45, low: 25 }, { da: 6400, top: 465, knee: 37.5, kneeHi: 80, low: 25 }];
function hvPoly(daFt) {
  const f = Math.max(0, Math.min(1, daFt / HV_CURVES[1].da)), L = (k) => HV_CURVES[0][k] + (HV_CURVES[1][k] - HV_CURVES[0][k]) * f;
  return [[0, L('low')], [0, L('top')], [L('knee'), L('kneeHi')], [L('knee'), L('low')]];
}
function _pip(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) ins = !ins;
  }
  return ins;
}
function hvState() {
  const pa = _ks(() => S.alt, 0), oat = _ksOat(), isa = 15 - 1.98 * pa / 1000, da = pa + 120 * (oat - isa);
  const ias = Math.max(0, _ks(() => (typeof simAirspeed === 'function' && simModeOn ? simAirspeed() : S.spd), 0)), h = _ks(() => radarAltFt(), 0);
  const poly = hvPoly(da);
  return { da, ias, h, poly, avoid: h > 5 && _pip(ias, h, poly) };
}
function perfMfdDraw(g, x, y, w, h) {
  let P = null; try { P = typeof perfSnap === 'function' ? perfSnap() : null; } catch (e) { _swallow(e); }
  g.save();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 17px Helvetica Neue, Arial, sans-serif';
  g.fillText('Active Helicopter Performance', x + w / 2, y + 30);
  if (P) {
    const col1 = x + 20, col2 = x + w * 0.5 - 10;
    const rows = [['Gross WT', `${Math.round(P.wt)} lb`, P.gwWarn ? '#ffb000' : '#fff'], ['PRESS ALT · OAT', `${Math.round(P.alt)} ft · ${P.temp}°C`, '#fff'],
      [`MTA (${P.cfg.tql})`, `${P.mta.toFixed(1)}%`, '#2fe0e0'], ['Hover TQ IGE / OGE', `${P.ige.toFixed(1)} / ${P.oge.toFixed(1)}%`, P.ogeRed || P.igeRed ? '#ff3030' : '#3ad13a'],
      ['MAX GW AEO IGE/OGE', `${P.aeoIge} / ${P.aeoOge}`, P.aeoOge <= P.wt ? '#ffb000' : '#fff'], ['MAX GW OEI IGE/OGE', `${P.oeiIge} / ${P.oeiOge}`, P.oeiOge <= P.wt ? '#ffb000' : '#fff'],
      ['VNE', `${Math.round(P.vne)} kt`, '#fff'], ['MAX END', `${P.endHr.toFixed(1)} h / ${P.endSpd} kt`, '#fff'], ['MAX Range', `${Math.round(P.rngNm)} NM / ${P.rngSpd} kt`, '#fff'],
      ['OEI MAX / MIN SPD', `${Math.round(P.oeiMax)} / ${P.oeiMin} kt`, '#fff'], ['MAX ROC', `${P.roc} fpm`, '#fff']];
    rows.forEach(([k, v, c], i) => {
      const yy = y + 62 + i * 25;
      g.textAlign = 'left'; g.font = '13px Helvetica Neue, Arial, sans-serif'; g.fillStyle = '#9ab'; g.fillText(k, col1, yy);
      g.textAlign = 'right'; g.font = 'bold 13px Helvetica Neue, Arial, sans-serif'; g.fillStyle = c; g.fillText(v, col2, yy);
    });
  }
  // H-V 선도 — 오른쪽 절반(가로 IAS 0~60kt · 세로 바퀴 높이 0~500ft)
  const S0 = hvState(), gx = x + w * 0.55, gy = y + 60, gw = w * 0.41, gh = h - 110;
  const X = v => gx + v / 60 * gw, Y = v => gy + gh - v / 500 * gh;
  g.strokeStyle = '#3a4a56'; g.lineWidth = 1; g.strokeRect(gx, gy, gw, gh);
  g.font = '10px Helvetica Neue, Arial, sans-serif'; g.fillStyle = '#789'; g.textAlign = 'center';
  [0, 20, 40, 60].forEach(v => g.fillText(String(v), X(v), gy + gh + 13)); g.fillText('IAS (kt)', gx + gw / 2, gy + gh + 26);
  g.textAlign = 'right'; [0, 100, 200, 300, 400, 500].forEach(v => g.fillText(String(v), gx - 4, Y(v) + 3));
  g.fillStyle = 'rgba(255,48,48,0.28)'; g.strokeStyle = '#ff3030'; g.lineWidth = 2; g.beginPath();
  S0.poly.forEach(([a, b], i) => (i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b)))); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ff8080'; g.textAlign = 'left'; g.font = 'bold 11px Helvetica Neue, Arial, sans-serif'; g.fillText('AVOID', X(1.5), Y(S0.poly[1][1] * 0.6));
  const px = X(Math.min(60, S0.ias)), py = Y(Math.min(500, S0.h));
  g.fillStyle = S0.avoid ? '#ff3030' : '#3ad13a'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 12px Helvetica Neue, Arial, sans-serif';
  g.fillText(`H-V (OEI 2.5MIN) · DA ${Math.round(S0.da)} ft`, gx + gw / 2, gy - 8);
  if (S0.avoid) { g.fillStyle = '#ff3030'; g.fillText('H-V AVOID ZONE', gx + gw / 2, gy + 18); }
  g.restore();
}

// ══════════ ⑫ CDU1 · CDU2 · MFD1~4 — 자리 · 백업(REV) · 배터리 단독 ══════════
//   자리: 기장(CDU2 → MFD2(PFD2) · MFD4) · 부기장(CDU1 → MFD1(PFD1) · MFD3) — 이 앱의 PFD 창 · SYSTEM 창 · CDU 가 그 자리의 것
//   MFD 고장(교관 창): MWP REV 램프 → REV 를 누르면 2초 · 안 누르면 8초 뒤 대체 모드
//     SYSTEM(MFD3/4) 고장 → 같은 쪽 PFD 가 PFD/EIS(대체 모드 EIS) · PFD(MFD1/2) 고장 → SYSTEM 창이 PFD 백업
//     고장이 풀리면 약 17.5초 뒤 정상으로 돌아온다
//   배터리 단독: MFD3 · CDU2 꺼짐(MFD1 · MFD2 · MFD4 · CDU1 은 돈다) — 기장 자리면 CDU 가, 부기장 자리면 SYSTEM 창이 꺼진다
const mfdSys = { seat: 'PLT', fail: { pfd: false, sys: false }, rev: false, revT: 0, revDue: 0, recT: 0 };
try { if (localStorage.getItem('kuhSeat') === 'CPLT') mfdSys.seat = 'CPLT'; } catch (e) { _swallow(e); }
function mfdIds() { return mfdSys.seat === 'PLT' ? { pfd: 'MFD2', sys: 'MFD4', cdu: 'CDU2' } : { pfd: 'MFD1', sys: 'MFD3', cdu: 'CDU1' }; }
function mfdSeatSet(s) { mfdSys.seat = s === 'CPLT' ? 'CPLT' : 'PLT'; try { localStorage.setItem('kuhSeat', mfdSys.seat); } catch (e) { _swallow(e); } try { if (typeof cduRerender === 'function') cduRerender(); } catch (e) { _swallow(e); } }
function mfdFailSet(k, on) { mfdSys.fail[k] = !!on; if (on) { mfdSys.revDue = 8; mfdSys.revT = 0; } else mfdSys.recT = 17.5; }
function _battOnly() { try { return !_ksB206() && elecState().battOnly; } catch (e) { return false; } }
function mfdSysDead() { return mfdSys.fail.sys || (_battOnly() && mfdIds().sys === 'MFD3'); }
function mfdPfdDead() { return mfdSys.fail.pfd; }
function cduDead() { return _battOnly() && mfdIds().cdu === 'CDU2'; }
function mfdRevPending() { return (mfdSys.fail.pfd || mfdSys.fail.sys) && !mfdSys.rev; }
function mfdRevPress() { if (mfdRevPending()) mfdSys.revDue = Math.min(mfdSys.revDue, mfdSys.revT + 2); }
function mfdStep(dt) {
  if (mfdSys.fail.pfd || mfdSys.fail.sys) {
    mfdSys.recT = 0;
    if (!mfdSys.rev) { mfdSys.revT += dt; if (mfdSys.revT >= mfdSys.revDue) { mfdSys.rev = true; _fSay(`REV — ${mfdSys.fail.pfd ? mfdIds().sys + ' 가 PFD 백업' : mfdIds().pfd + ' 가 PFD/EIS 대체 모드'}`, ''); } }
  } else if (mfdSys.rev) { mfdSys.recT -= dt; if (mfdSys.recT <= 0) { mfdSys.rev = false; _fSay('MFD 정상 화면으로 돌아왔다', ''); } }
  const ov = document.getElementById('cdu-nopwr'), dead = cduDead();
  const wrap = document.getElementById('cdu-scaler');   // CDU 화면(키 위까지) — 그 위를 덮는다
  if (wrap) {
    let o = ov;
    if (!o && dead) { o = document.createElement('div'); o.id = 'cdu-nopwr'; o.innerHTML = `<b>${mfdIds().cdu}</b><span>전원 없음 — 배터리 단독(교범 3.6.1)</span>`; wrap.appendChild(o); }
    if (o) o.style.display = dead ? 'flex' : 'none';
  }
}
// SYSTEM 창을 대신 그린다(18-system.js sysDraw) — 꺼짐 · PFD 백업이면 true
function mfdSysOverride(E) {
  const g = E.g, c = E.c;
  if (mfdSysDead()) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#334'; g.font = `bold ${Math.round(16 * E.dpr)}px Helvetica Neue, Arial, sans-serif`; g.textAlign = 'center';
    g.fillText(mfdSys.fail.sys ? `${mfdIds().sys} FAIL` : `${mfdIds().sys} — 전원 없음(배터리 단독)`, c.width / 2, c.height / 2);
    return true;
  }
  if (mfdPfdDead() && mfdSys.rev && typeof drawPfdTo === 'function') {
    c.dataset.noFcp = '1'; try { drawPfdTo(c); } finally { delete c.dataset.noFcp; }
    return true;
  }
  return false;
}
// PFD 대체 모드 EIS — SYSTEM(MFD3/4)이 꺼져 REV 로 넘어갔을 때(03-pfd.js pfdRevMode)
function mfdPfdRev() { return mfdSysDead() && (mfdSys.rev || (_battOnly() && !mfdSys.fail.sys)); }
setInterval(() => { try { mfdStep(0.25); } catch (e) { _swallow(e); } }, 250);
try { appRegister({ mfdSeatSet }); } catch (e) { _swallow(e); }
