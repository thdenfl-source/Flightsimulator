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
const FADEC = { ngIgn: 12, ngSep: 54, hsp: 963, tgtWarn: 927, tgtNoRise: 18, eopNoRise: 30, consecHot: 2, consecCold: 4,
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
      e.ng = Math.min(68, e.ng + 4 * dt);
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
    const busy = Object.keys(sysTst.run).length > 0;
    const col = s => s === 'Pass' || s === 'Done' || s === 'Completed' ? '#3ad13a' : s === 'Abort' || s === 'Fail' ? '#ffb000' : s === 'In Progress' ? '#2fe0e0' : s === 'ON' ? '#fff' : '#678';
    return `<div style="text-align:center;font-weight:bold;color:${busy ? '#2fe0e0' : '#3ad13a'};margin:2px 0 8px">${busy ? 'Busy' : 'Ready To Execute'}</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">` +
      SYS_TEST_IDS.map(k => `<div class="item-btn" data-act="sysTestRun" data-arg='${JSON.stringify([k])}' style="height:auto;min-height:44px;padding:5px 3px">` +
        `<span style="font-size:11px">${k}</span><span style="font-size:10px;color:${col(sysTst.st[k])}">${sysTst.st[k]}${k.startsWith('Engine') && sysTst.abortY[k === 'Engine 1' ? 0 : 1] ? ' ⚠' : ''}</span></div>`).join('') + `</div>` +
      (sysTst.msg.length ? `<div style="color:#ffb000;font-size:11px;margin-top:8px">${sysTst.msg.join(' · ')}</div>` : '') +
      _kHd(`Engine(EPAC) — 지상 20초 Done · 공중은 대기속도 ${EPAC_COND.ias}kt 위 · 승강 ±${EPAC_COND.vs}fpm · 경사 ${EPAC_COND.bank}° 안이어야 Completed(아니면 Abort)`);
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
    if (maint.step === 'SYS_MAINT') return back + _kHd('System Maintenance') + `<div style="display:flex;gap:6px">${_kBtn('maintGo', ['LOGGING_STATUS'], 'CMC Logs')}${_kBtn('maintGo', ['PASSWORD'], 'Log Out')}</div>`;
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
