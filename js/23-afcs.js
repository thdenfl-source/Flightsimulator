'use strict';
// ══════════════════════════════════════════════════════
// AFCS 가용성 — 하부 콘솔 AFCAU(⑯) · RCU(⑰ AHRS 패널의 FCP · AHRS · ADC 노브) · 전원(상부 콘솔 전기 계통 18-system.js elecState)
//   AP1 · AP2 OFF(AFCAU 버튼을 눌러 OFF 글씨가 켜짐)  → 그 APM 꺼짐 · CAS '1 APM OFF' · '2 APM OFF'(황)
//   둘 다 OFF                                        → 상위모드 · 자세유지(ASE) 모두 풀리고 세 축 모두 황색 SAS
//   TRIM FEEL COL REL                                → 컬렉티브 축 SAS(ALT · CR.HT · VS · GA · G/S 풀림)
//   TRIM FEEL CYC REL                                → 롤/요 · 피치 축 SAS(HDG · NAV · IAS · GSPD 풀림)
//   AUTO TRIM YAW · ROLL OFF → 롤/요 축 SAS  ·  PITCH OFF → 피치 축 SAS
//   RCU AHRS 1 · 2 → 'BOTH ON AHRS1 · 2'(황) · BACKUP(또는 AHRS 둘 다 CUT) → 세 축 SAS · 'AHRS BACKUP'
//   RCU ADC  1 · 2 → 'BOTH ON ADC1 · 2'(황)  · BACKUP → 대기 자료를 쓰는 ALT · IAS · VS · GA 풀림 · 'ADC BACKUP'
//   위 가운데 하나라도 걸리면(AP 하나는 살아 있고) 'AFCS DEGRADED'(황)
//   DC 전원 없음 → 'AFCS FAIL'(적) · FMA 세 칸 모두 꺼짐
// FMA(03-pfd.js drawFMA)는 afcsAxes() 로 SAS 칸을 그리고, 모드가 바뀌면 10초 동안 귀퉁이 상자를 깜빡인다.

function _afOv(id, d) { try { const v = typeof ovhdGet === 'function' ? ovhdGet(id) : undefined; return v === undefined ? d : v; } catch (e) { return d; } }
function afcsAxes() {
  const dc = typeof pwrDc === 'function' ? pwrDc() : true;
  const off = id => _afOv(id, 'OUT') === 'IN';               // AFCAU 의 눌러 두는 버튼 — 들어가면 OFF · REL 글씨가 켜진다
  const ap1 = dc && !off('ap1'), ap2 = dc && !off('ap2');
  const fail = !dc, apOff = !ap1 && !ap2;
  const ahrsBk = _afOv('ahrsSel', 'N') === 'BACKUP' || (off('ahrs1Cut') && off('ahrs2Cut'));
  const adcBk = _afOv('adcSel', 'N') === 'BACKUP';
  const colRel = off('tfCol'), cycRel = off('tfCyc'), yawT = off('atYaw'), rollT = off('atRoll'), pitT = off('atPitch');
  const all = apOff || ahrsBk;
  const sas = [all || colRel, all || cycRel || rollT || yawT, all || cycRel || pitT];   // 컬렉티브 · 롤/요 · 피치
  const degraded = !fail && !apOff && (ahrsBk || adcBk || colRel || cycRel || yawT || rollT || pitT);
  return { dc, fail, ap1, ap2, apOff, ahrsBk, adcBk, sas, degraded };
}
// CAS 메시지(PFD 메시지 시현창 — 03-pfd.js pfdMsgs 가 맨 위에 넣는다)
function afcsCas() {
  const A = afcsAxes(), out = [], AMB = '#ffb000';
  if (A.fail) out.push({ t: 'AFCS FAIL', c: '#ff3030' });
  else {
    if (!A.ap1) out.push({ t: '1 APM OFF', c: AMB });
    if (!A.ap2) out.push({ t: '2 APM OFF', c: AMB });
    if (A.degraded) out.push({ t: 'AFCS DEGRADED', c: AMB });
  }
  const ah = _afOv('ahrsSel', 'N'), ad = _afOv('adcSel', 'N');
  if (ah === '1' || ah === '2') out.push({ t: `BOTH ON AHRS${ah}`, c: AMB });
  if (A.ahrsBk) out.push({ t: 'AHRS BACKUP', c: AMB });
  if (ad === '1' || ad === '2') out.push({ t: `BOTH ON ADC${ad}`, c: AMB });
  if (A.adcBk) out.push({ t: 'ADC BACKUP', c: AMB });
  return out;
}
// 쓸 수 없는 축의 상위모드를 푼다(누르자마자 걸려도 곧 풀린다 — 축이 SAS 인 동안은 걸리지 않는다)
function afcsGuard() {
  let A;
  try { A = afcsAxes(); } catch (e) { return; }
  const col = A.fail || A.sas[0], mid = A.fail || A.sas[1], pit = A.fail || A.sas[2];
  let did = false;
  // 아직 없는 이름(다른 파일 순서)은 cond 안에서 던져 그냥 넘어간다
  const rel = (cond, fn) => { try { if (cond()) { fn(); did = true; } } catch (e) { _swallow(e); } };
  if (col || A.adcBk) {
    rel(() => altHoldOn, toggleAltHold);
    rel(() => (gsOn || gsArmed), toggleGs);
    rel(() => (gaOn || vsModeOn), gaRelease);
  }
  if (col) {
    rel(() => crhtOn, toggleCrht);
    rel(() => tdOn, tdownRelease);
  }
  if (mid) {
    rel(() => navApOn, toggleNavAp);
    rel(() => hdgSelOn || rollApOn, hdgRelease);
  }
  if (pit || A.adcBk) rel(() => simIasOn, simIasRelease);
  if (mid || pit) rel(() => gspdOn, toggleGspd);
  if (A.fail || A.apOff || A.ahrsBk) rel(() => aseOn, toggleAse);
  if (did) { try { updateHoverBtns(); updateApInhibit(); } catch (e) { _swallow(e); } }
}
setInterval(afcsGuard, 250);
