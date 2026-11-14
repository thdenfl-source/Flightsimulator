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
      try { if (typeof fdrNote === 'function') fdrNote(`교관 — 고장 ${m.what} ${on ? '걸림' : '풀림'}`, on ? 'err' : ''); } catch (e) { _swallow(e); }
    }
    else if (c === 'msg') { try { uiToast(`🧑‍✈️ 교관: ${String(m.text || '').slice(0, 200)}`, 'warn', 6000); } catch (e) { _swallow(e); } }
    else if (c === 'scn' && typeof scnApply === 'function') scnApply(scnList()[+m.i]);
    else if (c === 'sar' && typeof sarPlaceAhead === 'function') { if (m.on) sarPlaceAhead(); else if (sar.on) sarToggleOn(); }
    else if (c === 'debrief' && typeof dbfOpen === 'function') dbfOpen();
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
if (_iosCh) _iosCh.onmessage = e => { if (IOS_MODE) iosRender(e.data); else iosHandle(e.data); };
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
  R.innerHTML = `<h1>🧑‍✈️ 교관 화면 (IOS)</h1><div class="ios-link" data-iosv="link">교육생 창을 기다리는 중…</div>
    <div class="ios-btns"><button data-ios="rtc">📱 교육생 기기와 잇기(QR 수락)</button></div>
    <div class="ios-state" data-iosv="state"></div>
    <div class="ios-btns"><button data-ios="run">▶ 비행</button><button data-ios="pause">❚❚ 멈춤</button><button data-ios="debrief">📋 강평 열기</button></div>
    <h2>고장</h2><div class="ios-btns" data-iosv="fails"></div>
    <div data-iosv="wbsec" style="display:none"><h2>연료 · 무게 (Bell)</h2><div class="ios-state" data-iosv="wbstate"></div>
      <div class="ios-row"><span>연료</span><div>${[91, 60, 40, 20, 8].map(g => `<button data-ios="gal:${g}">${g} gal</button>`).join('')}</div></div>
      <div class="ios-row"><span>뒷자리 · 화물(lb)</span><div><input type="number" data-iosv="wbrear" min="0" max="600" placeholder="뒷자리"><input type="number" data-iosv="wbcargo" min="0" max="250" placeholder="화물"><button data-ios="wbset">적용</button></div></div>
      <div class="ios-row"><span>보기</span><div><button data-ios="wbp:aft">뒤로 쏠림(화물 250)</button><button data-ios="wbp:heavy">최대 무게</button><button data-ios="wbp:std">표준</button></div></div></div>
    <h2>바람</h2><div class="ios-row"><span>방향 · 세기</span><div><input type="number" data-iosv="wd" min="0" max="359" placeholder="°"><input type="number" data-iosv="ws" min="0" max="60" placeholder="kt"><button data-ios="wind">적용</button></div></div>
    <h2>환경</h2>` +
    grp('시간대', 'tod', [['DAY', '주간'], ['DUSK', '황혼'], ['NIGHT', '야간']]) +
    grp('시정', 'vis', [[0, '무제한'], [5, '5km'], [3, '3km'], [1.5, '1.5km'], [0.8, '800m'], [0.4, '400m']]) +
    grp('비', 'rain', [[0, '없음'], [1, '약'], [2, '강']]) + grp('NVG', 'nvg', [['false', '끔'], ['true', '켬']]) +
    grp('바다', 'sea', [0, 1, 2, 3, 4, 5, 6].map(v => [v, String(v)])) + grp('돌풍', 'gust', [0, 5, 10, 15, 20].map(v => [v, v ? '+' + v : '없음'])) +
    grp('구름 밑면', 'ceil', [0, 500, 1000, 1500, 2500].map(v => [v, v ? v + 'ft' : '없음'])) +
    grp('지면', 'surface', [['normal', '보통'], ['sand', '모래'], ['snow', '눈']]) + grp('교통량', 'traffic', [0, 1, 3, 5].map(v => [v, v ? v + '대' : '없음'])) +
    `<h2>SAR · 시나리오</h2><div class="ios-btns"><button data-ios="sar:1">요구조자 앞에 놓기</button><button data-ios="sar:0">요구조자 치우기</button></div><div class="ios-btns" data-iosv="scn"></div>
    <h2>메시지</h2><div class="ios-row"><div style="flex:1;display:flex;gap:6px"><input type="text" data-iosv="msg" placeholder="교육생 화면에 띄울 말" style="flex:1"><button data-ios="msg">보내기</button></div></div>`;
  document.body.appendChild(R);
  R.addEventListener('click', e => {
    const b = e.target.closest('[data-ios]'); if (!b) return;
    const p = b.dataset.ios.split(':');
    if (p[0] === 'env') iosCmd('env', { o: { [p[1]]: (p[1] === 'tod' || p[1] === 'surface') ? p[2] : (p[1] === 'nvg') ? p[2] === 'true' : +p[2] } });
    else if (p[0] === 'rtc') { if (typeof toggleRemoteIos === 'function') toggleRemoteIos(); }
    else if (p[0] === 'fail') iosCmd('fail', { what: p[1], on: p[2] === '1' });
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
  R.querySelector('[data-iosv="state"]').innerHTML = kv('기종', m.ac === 'b206' ? 'Bell 206' : 'KUH-1CG') + kv('상태', m.running ? '비행' : '멈춤') + kv('엔진', m.eng || '') +
    kv('고도', Math.round(m.alt) + ' ft') + kv('전파고도', Math.round(m.ra) + ' ft') + kv('속도', Math.round(m.spd) + ' kt') + kv('기수', String(Math.round(m.hdg) % 360).padStart(3, '0') + '°') +
    kv('승강률', Math.round(m.vs) + ' fpm') + kv('토크', Math.round(m.tq) + '%') + kv('NR', Math.round(m.nr) + '%') + kv('바람', `${Math.round(m.wind.dir)}° / ${Math.round(m.wind.spd)} kt`) +
    kv('자리', `${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}`);
  const F = (m.ac === 'b206' ? [['bEng', '엔진 고장'], ['bHyd', '유압 고장'], ['govHi', '거버너 HI'], ['govLo', '거버너 LO'], ['chip', 'ENG CHIP'], ['thStuck', '스로틀 고착']]
                             : [['oei', '2번 엔진 고장(OEI · SIM)'], ['idle', '두 엔진 IDLE(SIM)']])
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
  ['🧑‍✈️ IOS', '교관 화면 — 같은 기기에 교관 창을 따로 열어 고장 · 환경 · 바람 · 메시지 · 시나리오를 건다.'],
  ['🛟 SAR', '요구조자(익수자 · 육상)와 호이스트 구조 훈련. 밤에는 스트로브가 번쩍이고 서치라이트에 반사판이 빛난다.'],
  ['W&B (Bell)', 'Bell 계기판 FUEL QTY 를 누르거나 컬렉티브 창 W&B — 무게 · 무게중심 · 연료 · 호버 성능(HIGE/HOGE).'],
  ['HORN MUTE (Bell)', '계기판 왼쪽 위 — 울리는 경고음(ENG OUT · 낮은 RPM)을 끈다. 경고가 풀리면 다시 산다.'],
  ['HYD SYS (Bell)', '계기판 오른쪽 위 — 유압 BOOST. 끄면(또는 고장) 조종이 무겁고 굼뜨며 HYD PRESS 주의등.'],
  ['CAUTION LT TEST · MASTER CAUTION', '누르는 동안 등 · 경고음 점검 / 새 주의등을 알았다고 끈다.'],
  ['ENG FAIL (Bell)', '컬렉티브 큰 창 — 교관 훈련용 엔진 고장. 스로틀을 OFF 로 닫았다가 다시 시동하면 풀린다.'],
  ['STARTER (Bell)', '한 번 누르면 ON · 다시 누르면 OFF. N1 12% 넘어 스로틀 IDLE → 58% 넘어 STARTER OFF. 60초 넘기지 않는다.'],
  ['PTT (Bell 오디오 패널)', '누르는 동안 MIC 로 고른 무전기로 송신. 가까운 공항 TWR · GND · APP 주파수면 관제가 답한다.'],
  ['SOUND', '로터 소리 — 토크에 따라 크기가 바뀐다. 경고음이 울리면 반으로 줄어든다.'],
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
