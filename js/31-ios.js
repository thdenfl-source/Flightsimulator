'use strict';
// ══════════════════════════════════════════════════════
// 31-ios.js — 교관 화면(IOS · Instructor Operating Station) · 도움말(❓)
//
// 지도 창의 🧑‍✈️ IOS 단추가 같은 기기에 교관 창(?ios=1)을 따로 연다(다른 모니터 · 태블릿 화면 공유 등).
// 두 창은 브라우저의 BroadcastChannel('shinesong-ios')로 이야기한다 — 같은 브라우저 안에서만 닿는다
// (인터넷으로 다른 기기와 잇는 서버는 없다).
//   교육생 창 → 교관 창: 0.5초마다 상태(기종 · 고도 · 전파고도 · 속도 · 기수 · 승강률 · 토크 · NR · 자리 · 비행/멈춤 · 환경 · 바람 · 고장)
//   교관 창 → 교육생 창: 멈춤/비행 · 환경(시간대 · 시정 · 비 · NVG · 바다 · 돌풍 · 구름) · 바람 · 고장 · 메시지 · 시나리오 · SAR 요구조자 · 강평 열기
//     고장 — Bell: 엔진 고장 · 유압 고장 / 흰수리(SIM): 2번 엔진 고장(OEI) · 두 엔진 IDLE
// ══════════════════════════════════════════════════════
const IOS_CH = 'shinesong-ios';
const IOS_MODE = /[?&]ios=1\b/.test(location.search);
let _iosCh = null;
try { _iosCh = new BroadcastChannel(IOS_CH); } catch (e) { _iosCh = null; }
const _n = (f, d = 0) => { try { const v = f(); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
function iosState() {
  const b2 = typeof acB206 === 'function' && acB206();
  return {
    type: 'state', t: Date.now(), ac: (typeof AC_TYPE !== 'undefined') ? AC_TYPE : 'aw189', sim: typeof simModeOn !== 'undefined' && simModeOn,
    alt: _n(() => S.alt), ra: _n(() => radarAltFt()), spd: _n(() => S.spd), hdg: _n(() => (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg)),
    vs: _n(() => S.vs), tq: _n(() => tqShown()), nr: _n(() => engParams().nr, 100), lat: S.lat, lon: S.lon, running: !!S.running,
    env: (typeof env !== 'undefined') ? Object.assign({}, env) : null, wind: { dir: _n(() => windDir), spd: _n(() => windSpd) },
    fails: {
      bEng: b2 && typeof b206c !== 'undefined' && !!b206c.fail, bHyd: b2 && typeof b206Hyd !== 'undefined' && !!b206Hyd.fail,
      oei: !b2 && typeof _simEngBtn !== 'undefined' && _simEngBtn === 1, idle: !b2 && typeof _simEngBtn !== 'undefined' && _simEngBtn === 0,
      trDrive: typeof simTrFail !== 'undefined' && simTrFail === 'drive', trFixed: typeof simTrFail !== 'undefined' && simTrFail === 'fixed',
      govHi: b2 && typeof b206c !== 'undefined' && b206c.govFail === 'HI', govLo: b2 && typeof b206c !== 'undefined' && b206c.govFail === 'LO',
      chip: b2 && typeof b206c !== 'undefined' && !!b206c.chip, thStuck: b2 && typeof b206c !== 'undefined' && !!b206c.thStuck,
      asi: typeof instFail !== 'undefined' && instFail.asi !== null, alt: typeof instFail !== 'undefined' && instFail.alt !== null,
      vsi: typeof instFail !== 'undefined' && instFail.vsi !== null, ahrs: typeof instFail !== 'undefined' && !!instFail.ahrs, hdg: typeof instFail !== 'undefined' && !!instFail.hdg,
      hot1: typeof fadec !== 'undefined' && fadec.e[1].fault === 'HOT', aisbv1: typeof fadec !== 'undefined' && fadec.e[1].fault === 'AISBV',
      fix1: typeof fadec !== 'undefined' && fadec.e[1].fault === 'FAIL_FIX', plim1: typeof fadec !== 'undefined' && fadec.e[1].fault === 'PWR_LIMIT',
      mfdPfd: typeof mfdSys !== 'undefined' && mfdSys.fail.pfd, mfdSysF: typeof mfdSys !== 'undefined' && mfdSys.fail.sys,
      gen1ov: typeof elecFault !== 'undefined' && elecFault.gen1 === 'OV', tru1: typeof elecFault !== 'undefined' && !!elecFault.tru1,
      apm1: typeof afcsFault !== 'undefined' && afcsFault.apm1, apm2: typeof afcsFault !== 'undefined' && afcsFault.apm2,
      semaP2: typeof afcsFault !== 'undefined' && afcsFault.sema2.P, semaPB: typeof afcsFault !== 'undefined' && afcsFault.semaBoth.P, collLink: typeof afcsFault !== 'undefined' && afcsFault.collLink,
    },
    eng: (() => { try { return engStateLabel(); } catch (e) { return ''; } })(),
    scn: (typeof scnList === 'function') ? scnList().map(x => x.name) : [],
    sar: typeof sar !== 'undefined' && sar.on,
    // Bell — 연료 · 무게 · 무게중심(25-b206panel.js) · 교관이 바꾼다(cmd 'wb')
    wb: b2 && typeof b206Wb !== 'undefined' ? { gal: _n(() => b206FuelGal()), gw: _n(() => b206GrossWt()), cg: _n(() => b206Cg()), cgOk: (() => { try { return b206CgOk(); } catch (e) { return true; } })(),
      max: (typeof B206_WB !== 'undefined') ? B206_WB.max : 3200, cap: (typeof B206_LIM !== 'undefined') ? B206_LIM.fuelCap : 91, o: Object.assign({}, b206Wb) } : null,
  };
}
// 교육생 창 — 명령을 받는다
function iosHandle(m) {
  if (!m || m.type !== 'cmd') return;
  const c = m.c;
  try {
    if (c === 'run' && !S.running) toggleSim();
    else if (c === 'pause' && S.running) toggleSim();
    else if (c === 'env' && typeof envSet === 'function') envSet(m.o || {});
    else if (c === 'tfc' && typeof trafficAdd === 'function') { const t = trafficAdd(m.o || {}); try { if (typeof fdrNote === 'function') fdrNote(`교관 — 교통 띄움(${t.ac === 'b206' ? 'Bell' : '흰수리'} · ${t.mode === 'pat' ? '장주' : '항로'})`); } catch (e) { _swallow(e); } }
    else if (c === 'tfcClear' && typeof trafficClear === 'function') trafficClear();
    else if (c === 'wind') { windDir = ((+m.dir % 360) + 360) % 360; windSpd = Math.max(0, +m.spd || 0); try { if (typeof updateWindUi === 'function') updateWindUi(); } catch (e) { _swallow(e); } }
    else if (c === 'fail') {
      const on = !!m.on;
      if (m.what === 'bEng' && typeof b206cFail === 'function') { if (on) { if (b206c.run) b206cFail(true); } else b206cFail(false); }
      else if (m.what === 'bHyd' && typeof b206HydFail === 'function') b206HydFail(on);
      else if ((m.what === 'oei' || m.what === 'idle') && typeof simEngApply === 'function') { _simEngBtn = on ? (m.what === 'oei' ? 1 : 0) : 2; simEngApply(); }
      else if ((m.what === 'trDrive' || m.what === 'trFixed') && typeof simTrFailSet === 'function') simTrFailSet(on ? (m.what === 'trDrive' ? 'drive' : 'fixed') : null);
      else if ((m.what === 'govHi' || m.what === 'govLo') && typeof b206cEngFail === 'function') b206cEngFail('gov', on ? (m.what === 'govHi' ? 'HI' : 'LO') : null);
      else if ((m.what === 'chip' || m.what === 'thStuck') && typeof b206cEngFail === 'function') b206cEngFail(m.what, on);
      else if (['asi', 'alt', 'vsi', 'ahrs', 'hdg'].includes(m.what) && typeof instFailSet === 'function') instFailSet(m.what, on);
      else if ((m.what === 'mfdPfd' || m.what === 'mfdSysF') && typeof mfdFailSet === 'function') mfdFailSet(m.what === 'mfdPfd' ? 'pfd' : 'sys', on);
      else if (m.what === 'gen1ov' && typeof elecFaultSet === 'function') elecFaultSet('gen1', on ? 'OV' : null);
      else if (m.what === 'tru1' && typeof elecFaultSet === 'function') elecFaultSet('tru1', on);
      else if (['apm1', 'apm2', 'semaP2', 'semaPB', 'collLink'].includes(m.what) && typeof afcsFaultSet === 'function') afcsFaultSet(m.what, on);
      else if (typeof fadecFault === 'function' && ({ hot1: 'HOT', aisbv1: 'AISBV', fix1: 'FAIL_FIX', plim1: 'PWR_LIMIT' })[m.what]) fadecFault(1, ({ hot1: 'HOT', aisbv1: 'AISBV', fix1: 'FAIL_FIX', plim1: 'PWR_LIMIT' })[m.what], on);
      try { if (typeof fdrNote === 'function') fdrNote(`교관 — 고장 ${m.what} ${on ? '걸림' : '풀림'}`, on ? 'err' : ''); } catch (e) { _swallow(e); }
    }
    else if (c === 'msg') { try { uiToast(`🧑‍✈️ 교관: ${String(m.text || '').slice(0, 200)}`, 'warn', 6000); } catch (e) { _swallow(e); } }
    else if (c === 'scn' && typeof scnApply === 'function') scnApply(scnList()[+m.i]);
    else if (c === 'sar' && typeof sarPlaceAhead === 'function') { if (m.on) sarPlaceAhead(); else if (sar.on) sarToggleOn(); }
    else if (c === 'debrief' && typeof dbfOpen === 'function') dbfOpen();
    else if (c === 'ping') { _iosPeerT = Date.now(); return; }                 // 교관 창이 있다 — 미러를 보낸다
    else if (c === 'ovhd' && typeof ovhdSet === 'function') ovhdSet(m.id, m.v);  // 교관 창에서 바꾼 콘솔 스위치
    else if (c === 'kg' && typeof kgPress === 'function') { if (m.on) kgPress(m.k); else if (typeof _kgHoldStop === 'function') _kgHoldStop(); }
    else if (c === 'bc' && typeof b206c !== 'undefined') {                         // Bell 컬렉티브
      const k = m.k;
      if (k === 'up') { if (b206c.beep) b206cBeep(0); }
      else if (k === 'grip') b206cThrottle(m.dir > 0 ? 1 : -1);
      else if (k === 'idlerel') b206cIdleRel();
      else if (k === 'starter') b206cStarter(!b206c.start);
      else if (k === 'incr') b206cBeep(1); else if (k === 'decr') b206cBeep(-1);
      else b206cToggle(k);
    }
    else if (c === 'wb' && typeof b206WbSet === 'function' && typeof acB206 === 'function' && acB206()) {
      b206WbSet(m.o || {});
      try { if (typeof b206WbRender === 'function') b206WbRender(); } catch (e) { _swallow(e); }
      try { if (typeof fdrNote === 'function') fdrNote(`교관 — 연료 · 무게 바꿈(${Math.round(b206FuelGal())}gal · ${Math.round(b206GrossWt())}lb · CG ${b206Cg().toFixed(1)}in)`); } catch (e) { _swallow(e); }
    }
  } catch (e) { _swallow(e); }
  iosSend();
}
// 같은 브라우저(BroadcastChannel)와 다른 기기(WebRTC — 33-train4.js rtcSend) 둘 다로 보낸다
function iosSend() { if (IOS_MODE) return; const m = iosState(); try { if (_iosCh) _iosCh.postMessage(m); } catch (e) { _swallow(e); } try { if (typeof rtcSend === 'function') rtcSend(m); } catch (e) { _swallow(e); } }
function iosCmd(c, o = {}) { const m = Object.assign({ type: 'cmd', c }, o); try { if (_iosCh) _iosCh.postMessage(m); } catch (e) { _swallow(e); } try { if (typeof rtcSend === 'function') rtcSend(m); } catch (e) { _swallow(e); } }
if (_iosCh) _iosCh.onmessage = e => { if (IOS_MODE) { if (e.data && e.data.type === 'mirror') iosMirrorApply(e.data); else iosRender(e.data); } else iosHandle(e.data); };
if (!IOS_MODE) setInterval(iosSend, 500);
function openIos() {
  const q = new URLSearchParams(location.search); q.set('ios', '1');
  try { if (typeof AC_TYPE !== 'undefined') q.set('ac', AC_TYPE); } catch (e) { _swallow(e); }
  // 홈 화면 앱(PWA)에서 직접 새 창을 열면 앱 창이 덮인다 — 앵커로 바깥 탭에 연다(00-ui.js uiOpenExternal)
  uiOpenExternal(location.pathname + '?' + q.toString());
}

// ── 교관 창(?ios=1) ──
let _iosLast = null, _iosSeen = 0;
function iosBuild() {
  document.documentElement.classList.add('ios-mode');
  const R = document.createElement('div'); R.id = 'ios-root';
  const grp = (t, k, opts) => `<div class="ios-row"><span>${t}</span><div>${opts.map(([v, l]) => `<button data-ios="env:${k}:${v}">${l}</button>`).join('')}</div></div>`;
  R.innerHTML = `<h1>🧑‍✈️ Instructor View (IOS)</h1><div class="ios-link" data-iosv="link">교육생 창을 기다리는 중…</div>
    <div class="ios-btns"><button data-ios="rtc">📷 교육생 QR 찍어 잇기(다른 기기)</button></div>
    <div class="ios-state" data-iosv="state"></div>
    <div class="ios-btns"><button data-ios="run">▶ 비행</button><button data-ios="pause">❚❚ 멈춤</button><button data-ios="debrief">📋 강평 열기</button></div>
    <h2>고장</h2><div class="ios-btns" data-iosv="fails"></div>
    <div data-iosv="wbsec" style="display:none"><h2>연료 · 무게 (Bell)</h2><div class="ios-state" data-iosv="wbstate"></div>
      <div class="ios-row"><span>연료</span><div>${[91, 60, 40, 20, 8].map(g => `<button data-ios="gal:${g}">${g} gal</button>`).join('')}</div></div>
      <div class="ios-row"><span>뒷자리 · 화물(lb)</span><div><input type="number" data-iosv="wbrear" min="0" max="600" placeholder="뒷자리"><input type="number" data-iosv="wbcargo" min="0" max="250" placeholder="화물"><button data-ios="wbset">적용</button></div></div>
      <div class="ios-row"><span>보기</span><div><button data-ios="wbp:aft">뒤로 쏠림(화물 250)</button><button data-ios="wbp:heavy">최대 무게</button><button data-ios="wbp:std">표준</button></div></div></div>
    <h2>교통 배치</h2><div class="ios-row"><span>방위° · 거리NM · 상대ft · 침로° · 기종</span><div><input type="number" data-iosv="tb" min="0" max="359" placeholder="방위" value="0"><input type="number" data-iosv="tn" min="0.2" max="15" step="0.1" placeholder="NM" value="3"><input type="number" data-iosv="tr" min="-3000" max="3000" step="100" placeholder="±ft" value="0"><input type="number" data-iosv="th" min="0" max="359" placeholder="침로" value="180"><select data-iosv="ta"><option value="kuh">흰수리</option><option value="b206">Bell 206</option></select></div></div>
    <div class="ios-btns"><button data-ios="tfc:rte">항로로 띄우기</button><button data-ios="tfc:pat">가까운 공항 장주로</button><button data-ios="tfcClear">교통 모두 지우기</button></div>
    <h2>바람</h2><div class="ios-row"><span>방향 · 세기</span><div><input type="number" data-iosv="wd" min="0" max="359" placeholder="°"><input type="number" data-iosv="ws" min="0" max="60" placeholder="kt"><button data-ios="wind">적용</button></div></div>
    <h2>환경</h2>` +
    grp('시간대', 'tod', [['DAY', '주간'], ['DUSK', '황혼'], ['NIGHT', '야간']]) +
    grp('시정', 'vis', [[0, '무제한'], [5, '5km'], [3, '3km'], [1.5, '1.5km'], [0.8, '800m'], [0.4, '400m']]) +
    grp('비', 'rain', [[0, '없음'], [1, '약'], [2, '강']]) + grp('NVG', 'nvg', [['false', '끔'], ['true', '켬']]) +
    grp('바다', 'sea', [0, 1, 2, 3, 4, 5, 6].map(v => [v, String(v)])) + grp('돌풍', 'gust', [0, 5, 10, 15, 20].map(v => [v, v ? '+' + v : '없음'])) +
    grp('구름 밑면', 'ceil', [0, 500, 1000, 1500, 2500].map(v => [v, v ? v + 'ft' : '없음'])) +
    grp('지면', 'surface', [['normal', '보통'], ['sand', '모래'], ['snow', '눈']]) + grp('교통량', 'traffic', [0, 1, 3, 5].map(v => [v, v ? v + '대' : '없음'])) +
    `<h2>SAR · 시나리오</h2><div class="ios-btns"><button data-ios="sar:1">요구조자 앞에 놓기</button><button data-ios="sar:0">요구조자 치우기</button></div><div class="ios-btns" data-iosv="scn"></div>
    <h2>교범</h2><div class="ios-btns"><button data-ios="manual">📘 교관 교범 열기</button></div>
    <h2>메시지</h2><div class="ios-row"><div style="flex:1;display:flex;gap:6px"><input type="text" data-iosv="msg" placeholder="교육생 화면에 띄울 말" style="flex:1"><button data-ios="msg">보내기</button></div></div>`;
  document.body.appendChild(R);
  R.addEventListener('click', e => {
    const b = e.target.closest('[data-ios]'); if (!b) return;
    const p = b.dataset.ios.split(':');
    if (p[0] === 'env') iosCmd('env', { o: { [p[1]]: (p[1] === 'tod' || p[1] === 'surface') ? p[2] : (p[1] === 'nvg') ? p[2] === 'true' : +p[2] } });
    else if (p[0] === 'rtc') { if (typeof toggleRemoteIos === 'function') toggleRemoteIos(); }
    else if (p[0] === 'fail') iosCmd('fail', { what: p[1], on: p[2] === '1' });
    else if (p[0] === 'tfc') { const v = k => R.querySelector(`[data-iosv="${k}"]`).value; iosCmd('tfc', { o: { brg: +v('tb'), nm: +v('tn'), rel: +v('tr'), hdg: +v('th'), ac: v('ta'), pat: p[1] === 'pat' } }); }
    else if (p[0] === 'tfcClear') iosCmd('tfcClear');
    else if (p[0] === 'manual') { try { if (typeof openManual === 'function') openManual(); else uiOpenExternal('docs/instructor-manual.html'); } catch (e) { _swallow(e); } }
    else if (p[0] === 'wind') iosCmd('wind', { dir: +R.querySelector('[data-iosv="wd"]').value, spd: +R.querySelector('[data-iosv="ws"]').value });
    else if (p[0] === 'msg') { const i = R.querySelector('[data-iosv="msg"]'); if (i.value.trim()) { iosCmd('msg', { text: i.value.trim() }); i.value = ''; } }
    else if (p[0] === 'scn') iosCmd('scn', { i: +p[1] });
    else if (p[0] === 'sar') iosCmd('sar', { on: p[1] === '1' });
    else if (p[0] === 'gal') iosCmd('wb', { o: { gal: +p[1] } });
    else if (p[0] === 'wbset') { const o = {}; const r = R.querySelector('[data-iosv="wbrear"]').value, c = R.querySelector('[data-iosv="wbcargo"]').value; if (r !== '') o.rear = +r; if (c !== '') o.cargo = +c; iosCmd('wb', { o }); }
    else if (p[0] === 'wbp') iosCmd('wb', { o: p[1] === 'aft' ? { rear: 0, cargo: 250, copilot: 0 } : p[1] === 'heavy' ? { rear: 340, cargo: 100, copilot: 170, gal: 91 } : { rear: 0, cargo: 0, copilot: 170, pilot: 170 } });
    else iosCmd(p[0]);
  });
  setInterval(() => { const l = R.querySelector('[data-iosv="link"]'); const ok = Date.now() - _iosSeen < 2000; l.textContent = ok ? '● 교육생 창과 이어짐' : '○ 교육생 창을 기다리는 중… (교육생 창을 열어 두십시오)'; l.classList.toggle('ok', ok); }, 500);
}
function iosRender(m) {
  if (!m || m.type !== 'state') return;
  _iosSeen = Date.now(); _iosLast = m;
  const R = document.getElementById('ios-root'); if (!R) return;
  const kv = (k, v) => `<div><em>${k}</em><b>${v}</b></div>`;
  R.querySelector('[data-iosv="state"]').innerHTML = kv('기종', m.ac === 'b206' ? 'Bell 206' : m.ac === 'r22' ? 'R22' : 'KUH-1CG') + kv('상태', m.running ? '비행' : '멈춤') + kv('엔진', m.eng || '') +
    kv('고도', Math.round(m.alt) + ' ft') + kv('전파고도', Math.round(m.ra) + ' ft') + kv('속도', Math.round(m.spd) + ' kt') + kv('기수', String(Math.round(m.hdg) % 360).padStart(3, '0') + '°') +
    kv('승강률', Math.round(m.vs) + ' fpm') + kv('토크', Math.round(m.tq) + '%') + kv('NR', Math.round(m.nr) + '%') + kv('바람', `${Math.round(m.wind.dir)}° / ${Math.round(m.wind.spd)} kt`) +
    kv('자리', `${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}`);
  const F = (m.ac === 'b206' || m.ac === 'r22' ? [['bEng', '엔진 고장'], ['bHyd', '유압 고장'], ['govHi', '거버너 HI'], ['govLo', '거버너 LO'], ['chip', 'ENG CHIP'], ['thStuck', '스로틀 고착']]
                             : [['oei', '2번 엔진 고장(OEI · SIM)'], ['idle', '두 엔진 IDLE(SIM)'], ['hot1', '1번 고온 시동(HSP)'], ['aisbv1', '1번 AISBV 고착(시동 실속)'], ['fix1', '1번 FADEC FAIL FIX'], ['plim1', '1번 PWR LIMIT'],
                                ['mfdPfd', 'PFD(MFD1/2) 고장 — REV'], ['mfdSysF', 'SYSTEM(MFD3/4) 고장 — REV'], ['gen1ov', 'GEN1 과전압(GCU 4.5초 차단)'], ['tru1', 'TRU1 고장'], ['apm1', 'APM1 고장'], ['apm2', 'APM2 고장'], ['semaP2', '피치 SEMA2 고장'], ['semaPB', '피치 SEMA 둘 고장'], ['collLink', 'COLL LINK']])
    .concat([['trDrive', '꼬리로터 구동 상실(SIM)'], ['trFixed', '꼬리로터 피치 고정(SIM)'], ['asi', '속도계 고착'], ['alt', '고도계 고착'], ['vsi', '승강계 고착'], ['ahrs', 'AHRS(자세) 고장'], ['hdg', '나침반 오차 25°']]);
  const fh = F.map(([k, l]) => `<button data-ios="fail:${k}:${m.fails[k] ? 0 : 1}" class="${m.fails[k] ? 'on' : ''}">${m.fails[k] ? '✕ ' : ''}${l}</button>`).join('');
  const fe = R.querySelector('[data-iosv="fails"]'); if (fe.dataset.h !== fh) { fe.dataset.h = fh; fe.innerHTML = fh; }
  const sh = m.scn.length ? m.scn.map((n, i) => `<button data-ios="scn:${i}">🎬 ${n.replace(/</g, '&lt;')}</button>`).join('') : '<span class="ios-dim">저장한 시나리오 없음</span>';
  const se = R.querySelector('[data-iosv="scn"]'); if (se.dataset.h !== sh) { se.dataset.h = sh; se.innerHTML = sh; }
  const wbs = R.querySelector('[data-iosv="wbsec"]');
  if (wbs) {
    wbs.style.display = m.wb ? '' : 'none';
    if (m.wb) R.querySelector('[data-iosv="wbstate"]').innerHTML = kv('연료', `${Math.round(m.wb.gal)} / ${m.wb.cap} gal`) +
      kv('총중량', `<span style="color:${m.wb.gw > m.wb.max ? '#ff5050' : 'inherit'}">${Math.round(m.wb.gw)} / ${m.wb.max} lb</span>`) +
      kv('무게중심', `<span style="color:${m.wb.cgOk ? 'inherit' : '#ff5050'}">${m.wb.cg.toFixed(1)} in${m.wb.cgOk ? '' : ' 한계 밖'}</span>`) + kv('뒷자리 · 화물', `${Math.round(m.wb.o.rear)} · ${Math.round(m.wb.o.cargo)} lb`);
  }
  if (m.env) R.querySelectorAll('[data-ios^="env:"]').forEach(b => { const [, k, v] = b.dataset.ios.split(':'); b.classList.toggle('on', String(k === 'nvg' ? !!m.env[k] : m.env[k]) === v); });
}
if (IOS_MODE) {
  const go = () => iosBuild();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

// ── 도움말(❓) ──
const HELP_ITEMS = [
  ['🎬 SCN', '시나리오 — 자리 · 고도 · 바람 · 환경 · 연료 · 비행계획 · SAR 를 이름 붙여 저장하고 불러온다. 파일로 내보내 교관끼리 나눈다.'],
  ['🌙 ENV', '환경 — 시간대(주간 · 황혼 · 야간) · 시정 · 비 · NVG · 바다 상태 · 돌풍 · 구름 밑면 · 흰수리 착륙등 · RA 콜아웃.'],
  ['📋 DEBRIEF', '비행 기록 · 강평 — 항적 · 그래프 · 사건 · 다시 보기 · 3D 다시 보기 · A/B 구간 채점 · CSV · 비행 저장 · 보고서(인쇄).'],
  ['🧑‍✈️ IOS', '교관 화면 — 같은 기기에 교관 창을 따로 열거나, 교관 태블릿으로 메인 기기의 연결 요청 QR 을 찍어 잇는다(메인 기기에서 수락). 고장 · 환경 · 바람 · 메시지 · 시나리오를 건다.'],
  ['🛟 SAR', '요구조자(익수자 · 육상)와 호이스트 구조 훈련. 밤에는 스트로브가 번쩍이고 서치라이트에 반사판이 빛난다.'],
  ['W&B (Bell)', 'Bell 계기판 FUEL QTY 를 누르거나 컬렉티브 창 W&B — 무게 · 무게중심 · 연료 · 호버 성능(HIGE/HOGE).'],
  ['HORN MUTE (Bell)', '계기판 왼쪽 위 — 울리는 경고음(ENG OUT · 낮은 RPM)을 끈다. 경고가 풀리면 다시 산다.'],
  ['HYD SYS (Bell)', '계기판 오른쪽 위 — 유압 BOOST. 끄면(또는 고장) 조종이 무겁고 굼뜨며 HYD PRESS 주의등.'],
  ['CAUTION LT TEST · MASTER CAUTION', '누르는 동안 등 · 경고음 점검 / 새 주의등을 알았다고 끈다.'],
  ['ENG FAIL (Bell)', '컬렉티브 큰 창 — 교관 훈련용 엔진 고장. 스로틀을 OFF 로 닫았다가 다시 시동하면 풀린다.'],
  ['STARTER (Bell)', '한 번 누르면 ON · 다시 누르면 OFF. N1 12% 넘어 스로틀 IDLE → 58% 넘어 STARTER OFF. 60초 넘기지 않는다.'],
  ['컬렉티브 · 사이클릭(흰수리 조종석)', '조종석 그림의 컬렉티브(CDU 오른쪽) · 사이클릭을 누르면 크게 뜬다. 컬렉티브: LDG LT(EXT 펼침 · ON/OFF · RET 접음) · SRCH CTR(서치라이트 방향) · COLL TRIM(DN/UP) · SRCH LT(누르면 ON/OFF · 위아래 광도) · OEI(한 엔진일 때 HI 2.5분 ↔ LOW 10분 — 남은 시간은 SYSTEM 창 살아 있는 엔진의 NG 옆에 보이고, 연속 정격(MTA 30) 위의 출력을 쓰는 동안만 줄어든다(황색)). 사이클릭: DISENGAG(AP 해제) · 빨간 단추(AP FAST CUT OFF) · 4-WAY BEEP · 손잡이 앞 PTT · FORCE TRIM RELEASE · G/SPEED.'],
  ['Watchman(VHF 125.3 · UHF 278.4)', '관제권 밖에서 레이더 조력 요청 — "… radial … miles from RKxx, direct to … for sea patrol(MEDEVAC · SAR)" → "radar contact, maintain VFR". 공항 10NM 안으로 들어오며 다시 부르면 "landing assured to RKxx, request frequency change" → "radar frequency change approved". 임무는 ⚙ 설정에서.'],
  ['관제 교신(TWR)', 'TWR 주파수로 PTT 를 놓으면 자리에 맞춰 조종사 말(🎙 PILOT)을 보여 주고 타워가 답한다 — 활주로 밖 지상 활주 요청 · 활주로 위 이륙 · 5NM 관제권 떠남 · 접근(inbound) · 5마일 final 착륙 허가. 비행계획이 없으면 장주(pattern) 비행.'],
  ['PTT (Bell 오디오 패널)', '누르는 동안 MIC 로 고른 무전기로 송신. 가까운 공항 TWR · GND · APP 주파수면 관제가 답한다.'],
  ['절차 훈련판(Flightsimulator)', '종합판(shinesong)과 같고 SIM 도 쓸 수 있다 — 다만 사이클릭의 피치 · 롤은 듣지 않는다(조이스틱 · 화면 STICK 원형 사이클릭 · GYRO). 자세는 4방향 비퍼 트림(햇 · 4-WAY BEEP · 키보드)과 AFCS(ALT · HDG · IAS · GSPD 등)로 바꾸고, 컬렉티브 · 페달 · COLL TRIM 은 그대로. 시작 비밀번호가 없다.'],
  ['조종 장치 여러 대', '조이스틱 · 스로틀(컬렉티브) · 페달처럼 다른 장치를 여럿 꽂아 함께 쓴다. CDU 조종장치 › 버튼 · 축 배정 › 연결된 장치에서 장치마다 사용/꺼짐. 장치가 둘 이상이면 새로 잡는 버튼 · 축은 그 장치의 것으로 적힌다(같은 번호라도 다른 장치는 듣지 않는다). 장치 하나일 때 잡아 둔 배정은 어느 장치에서든 듣고, 축은 그때 쓰던 장치를 계속 본다. 조종간 중립 맞추기는 연결된 장치 모두.'],
  ['R22', '기종 R22 — 시작 화면(비밀번호 뒤) 기종 고르기에서 R22. 단발 터빈 · 아날로그 계기판(한서대 훈련기 사진의 배치: 왼쪽 위 ENGINE OUT · FIRE · ROTOR RPM 경고등, 비행 계기 3열, 엔진 계기 2열 TRQ · ENG OIL · TOT · XMSN OIL · N1 · FUEL QTY · FUEL SHUT OFF · VOLT/AMP, 오른쪽 주의등 · MASTER CAUTION · TEST · HYD SYS). 엔진 · 시동 · 연료 · 하부 콘솔 무전 · 컬렉티브 · SIM 은 Bell 206 과 같고, VNE 100kt · 최대 2,550lb · 연료 69gal 이 다르다(00-params.js r22Perf 에서 고친다). FUEL QTY 계기를 누르면 무게 · 연료(W&B).'],
  ['CYC·COLL 창', '일반 화면(PC)의 가운데 · 오른쪽 · 아래 창 탭 CYC·COLL — 교관 화면처럼 컬렉티브 · 사이클릭(흰수리) · 컬렉티브(Bell 206 · R22) 그림을 창에 띄우고, 누르면 그대로 조작한다(LDG LT · SRCH LT · COLL TRIM · 4-WAY BEEP · PTT · 스로틀 등).'],
  ['SOUND', '로터 소리 — SOUND 아래 − / + 로 크기(0~100%, 로터 · APU · 엔진 모두). 토크에 따라 크기가 바뀐다. 경고음이 울리면 반으로 줄어든다. 계통 소리도 함께 — APU CONTR ON 뒤 17초 시동 소리 → 작동 소리, PCD IDLE 엔진 시동(시동기 · 점화 딸깍 · 터빈, 약 25초) — 시동이 끝나면 8초에 걸쳐 잦아들며 로터 소리로 바뀐다. APU 는 OFF 하면 곧바로 꺼진다. 로터 소리는 NR 을 따라 — 엔진을 모두 끄면 낮아지며 멎는다. 앱을 열면 SOUND 는 늘 꺼진 채로 시작한다(버튼을 눌러 켠다).'],
  ['🧰 도구', '작은 화면에서는 시나리오 · 환경 · 강평 · 교관 화면 · 설정 · 도움말이 이 메뉴 하나로 모인다.'],
  ['⚙ 설정', '소리 · RA 콜아웃 · 관제 음성 · 리드백 확인 · 말 빠르기 · 콜사인 · 다른 기기 교관 연결 · 모든 설정 내보내기/들여오기/초기화.'],
  ['TCAS 교통', 'ENV 교통량 — 둘레에 다른 항공기. TA "Traffic" · RA(흰수리) "Climb/Descend". PFD TCAS 창 · 지도 · 3D 에 보인다.'],
  ['고장(교관)', '꼬리로터(구동 상실 · 피치 고정) · 계기(속도계 · 고도계 · 승강계 고착 · AHRS · 나침반) · Bell 거버너 · CHIP · 스로틀 고착 — 교관 화면에서.'],
  ['평가', '오토로테이션 착지 · VRS 회복(방법 · 시간 · 고도 손실) · 착수(흰수리 플로트) 를 판정해 강평에 남긴다.'],
];
function toggleHelp() {
  let w = document.getElementById('help-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'help-wrap';
    w.innerHTML = `<div class="help-box"><div class="help-bar"><b>❓ 도움말 — 단추와 기능</b><button class="sim-btn" data-help="x">✕</button></div>` +
      `<div class="help-list">${HELP_ITEMS.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-help="x"]')) w.style.display = 'none'; });
  }
  w.style.display = 'flex';
}
try { appRegister({ openIos, toggleHelp }); } catch (e) { _swallow(e); }

// ══════════════════════════════════════════════════════
// ⑧ 교관 화면 페이지 — 위 막대: 교관 · PFD · UPPER · LOWER · CYC · COLL · MAP · COCKPIT
//   교관 창도 같은 앱이라, 교육생 창의 상태를 0.2초마다 그대로 받아(미러) 제 화면(PFD · 콘솔 · 지도 · 3D 조종석)에 그린다.
//   교관 창은 스스로 계산하지 않는다(S.running 꺼 둠) — 보이는 값은 모두 교육생 창의 것.
//   교관이 콘솔 스위치 · 컬렉티브 · 사이클릭을 누르면 교육생 창으로 보내 그쪽에서 조작한다.
// ══════════════════════════════════════════════════════
// 그대로 옮겨 올 전역(계기 · 모드 · 콘솔 · 무전기 · Bell 계통 · 흰수리 컬렉티브)
const IOS_MIRROR_G = ['selSpd', 'selAlt', 'selHht', 'selCrht', 'selHdg', 'selVS', 'hdgSelOn', 'altHoldOn', 'gsArmed', 'gsOn', 'simModeOn', 'simIasOn',
  'gspdOn', 'crhtOn', 'navApOn', 'rollApOn', 'iasNsOn', 'vsModeOn', 'gaOn', 'windDir', 'windSpd', 'obsOn', 'vorObsCrs', 'hdgRef', 'dgErr', 'slipBall', 'spdTrend',
  'holdOn', 'hoverPageOn', 'hoverPosOn', 'simNr', 'simEng', 'simOeiT', 'simOeiMode', 'NR_GOV', 'simTq', 'env', 'kgLt',
  'b206c', 'b206r', 'b206Wb', '_b206Gal', 'b206Hyd', 'c5', 'npx', 'instFail', 'shipVisible', 'shipLat', 'shipLon', 'shipHdg'];
const _iosGet = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
// 다른 파일이 미러할 이름을 더한다 — iosMirrorAdd(['이름', …]) (있으면 부른다)
function iosMirrorAdd(names) { for (const n of [].concat(names || [])) if (!IOS_MIRROR_G.includes(n)) IOS_MIRROR_G.push(n); }
// 이름이 바뀌어 조용히 빠지는 것을 막는다 — 처음 한 번 읽어 보고 없는 이름은 진단 기록(🩺)에 남긴다
function iosMirrorCheck() {
  const missing = IOS_MIRROR_G.filter(n => _iosGet(n) === undefined);
  const b2 = typeof acB206 === 'function' && acB206();
  // 기종 · 판에 따라 없는 것이 맞는 이름(Bell 계통은 흰수리에도 있다 — 둘 다 읽힌다)
  const real = missing.filter(n => !/^ship(Lat|Lon|Hdg)$/.test(n) && !(n === 'simTq'));
  if (real.length) try { _swallow(new Error('교관 미러 — 없는 이름: ' + real.join(', ') + (b2 ? ' (Bell)' : ''))); } catch (e) { /* 무시 */ }
  return real;
}
// 보낼 것 — 지난번과 달라진 것만(가볍게) · full 이면 다 보낸다(2초마다 · 처음)
const _iosMirLast = { S: {}, g: {}, ov: {} };
function _iosDiff(cur, last, out) {
  let n = 0;
  for (const [k, v] of Object.entries(cur)) {
    if (typeof v === 'function') continue;
    let j; try { j = JSON.stringify(v); } catch (e) { continue; }
    if (j === undefined || last[k] === j) continue;
    last[k] = j; out[k] = JSON.parse(j); n++;
  }
  return n;
}
function iosMirror(full) {
  if (full) { _iosMirLast.S = {}; _iosMirLast.g = {}; _iosMirLast.ov = {}; }
  const g = {};
  for (const n of IOS_MIRROR_G) { const v = _iosGet(n); if (v !== undefined && typeof v !== 'function') g[n] = v; }
  const s = Object.assign({}, S); delete s.trail;
  const m = { type: 'mirror', full: !!full, S: {}, g: {} };
  let n = _iosDiff(s, _iosMirLast.S, m.S) + _iosDiff(g, _iosMirLast.g, m.g);
  if (typeof ovhdState !== 'undefined') { m.ov = {}; n += _iosDiff(ovhdState, _iosMirLast.ov, m.ov); }
  return (n || full) ? m : null;
}
// 교육생 창 — 교관 창이 있다고 알려 오면(ping) 0.2초마다 보낸다(콘솔은 1초마다)
let _iosPeerT = 0, _iosMirN = 0;
if (!IOS_MODE) setInterval(() => {
  if (Date.now() - _iosPeerT > 3000) return;
  if (_iosMirN === 0) iosMirrorCheck();
  const m = iosMirror(_iosMirN++ % 10 === 0); if (!m) return;          // 바뀐 것만 · 2초마다 전부
  try { if (_iosCh) _iosCh.postMessage(m); } catch (e) { _swallow(e); }
  try { if (typeof rtcSend === 'function') rtcSend(m); } catch (e) { _swallow(e); }
}, 200);
// 교관 창 — 받은 상태를 제 앱에 넣는다
let _iosApplying = false, iosMirrorN = 0;
function iosMirrorApply(m) {
  if (!m || m.type !== 'mirror') return;
  _iosApplying = true; iosMirrorN++;
  try {
    if (m.S) { Object.assign(S, m.S); S.running = false; }
    for (const [n, v] of Object.entries(m.g || {})) {
      try {
        const cur = _iosGet(n);
        if (cur && typeof cur === 'object' && !Array.isArray(cur) && v && typeof v === 'object' && !Array.isArray(v)) Object.assign(cur, v);
        else { window.__iosV = v; (0, eval)(n + ' = window.__iosV'); }
      } catch (e) { /* const 이거나 없는 이름 — 넘어간다 */ }
    }
    if (m.ov && typeof ovhdSet === 'function') for (const [id, v] of Object.entries(m.ov)) { try { if (ovhdState[id] !== v) ovhdSet(id, v); } catch (e) { _swallow(e); } }
  } finally { _iosApplying = false; }
  try { if (typeof updateAcOnMap === 'function') updateAcOnMap(); } catch (e) { _swallow(e); }
  try { if (typeof updateNav === 'function') updateNav(); } catch (e) { _swallow(e); }
  if (iosPage === 'grip') iosGripRender();
}
// 교관 창에서 콘솔 스위치를 바꾸면 교육생 창으로
if (IOS_MODE) try { ovhdOn((id, v) => { if (!_iosApplying) iosCmd('ovhd', { id, v }); }); } catch (e) { _swallow(e); }
if (IOS_MODE) setInterval(() => iosCmd('ping'), 1000);

// ── 페이지 ──
const IOS_PAGES = [['ios', '교관'], ['pfd', 'PFD'], ['ovhd', 'UPPER'], ['lcon', 'LOWER'], ['grip', 'CYC · COLL'], ['map', 'MAP'], ['cockpit', 'COCKPIT']]
  .filter(([k]) => !(k === 'ovhd' && typeof acScrOk === 'function' && !acScrOk('ovhd')));
let iosPage = 'ios';
function iosPagesBuild() {
  if (document.getElementById('ios-pages')) return;
  document.documentElement.classList.add('ios-win');
  const bar = document.createElement('div'); bar.id = 'ios-pages';
  bar.innerHTML = IOS_PAGES.map(([k, n]) => `<button type="button" data-iosp="${k}">${n}</button>`).join('');
  bar.addEventListener('click', e => { const b = e.target.closest('[data-iosp]'); if (b) iosPageSet(b.dataset.iosp); });
  document.body.appendChild(bar);
  iosPageSet('ios');
}
function iosPageSet(k) {
  if (!IOS_PAGES.some(p => p[0] === k)) return;
  const H = document.documentElement, prev = iosPage; iosPage = k;
  try { if (k !== 'cockpit' && window._cockpitOn && typeof cockpitExit === 'function') cockpitExit(); } catch (e) { _swallow(e); }
  if (k === 'ios' || k === 'grip') {
    H.classList.add('ios-mode');
    const R = document.getElementById('ios-root');
    if (R) { R.classList.toggle('ios-grip-on', k === 'grip'); }
    if (k === 'grip') iosGripRender(true);
  } else {
    H.classList.remove('ios-mode');
    try { if (k === 'cockpit') { if (typeof cockpitStart === 'function') cockpitStart(); } else if (typeof simpleSet === 'function') simpleSet(k); } catch (e) { _swallow(e); }
  }
  document.querySelectorAll('#ios-pages [data-iosp]').forEach(b => b.classList.toggle('on', b.dataset.iosp === k));
  if (prev !== k) setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) { _swallow(e); } }, 80);
}
// CYC · COLL 페이지 — 흰수리: 컬렉티브 · 사이클릭(35-kuhgrip.js) · Bell: 컬렉티브(27-b206coll.js)
function iosGripRender(force) {
  const R = document.getElementById('ios-root'); if (!R) return;
  let g = R.querySelector('[data-iosv="grip"]');
  if (!g) {
    g = document.createElement('div'); g.dataset.iosv = 'grip'; g.className = 'ios-grip'; R.appendChild(g);
    g.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-kg],[data-bc]'); if (!t) return;
      e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (er) { /* 그만 */ }
      if (t.dataset.kg) iosCmd('kg', { k: t.dataset.kg, on: true });
      else { const r = t.getBoundingClientRect(); iosCmd('bc', { k: t.dataset.bc, dir: e.clientX < r.left + r.width / 2 ? 1 : -1 }); }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => g.addEventListener(ev, () => { iosCmd('kg', { on: false }); iosCmd('bc', { k: 'up' }); }));
  }
  const b2 = typeof acB206 === 'function' && acB206();
  let h = '';
  try {
    h = b2 ? `<div class="ios-gcell"><div class="ios-gt">COLLECTIVE</div>${typeof _b206cSvg === 'function' ? _b206cSvg() : ''}</div>`
           : `<div class="ios-gcell"><div class="ios-gt">COLLECTIVE</div>${kgCollSvg('ic')}</div><div class="ios-gcell"><div class="ios-gt">CYCLIC</div>${kgCyclicSvg('iy')}</div>`;
  } catch (e) { _swallow(e); }
  if (force || g.dataset.h !== h) { g.dataset.h = h; g.innerHTML = h; }
}
if (IOS_MODE) {
  const go = () => { try { iosPagesBuild(); } catch (e) { _swallow(e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else setTimeout(go, 0);
}
try { appRegister({ iosPageSet }); } catch (e) { _swallow(e); }
