// ─────────────────────────────────────────────────────────────
// 09a-start.js — 시작 위치 · 출발 공항(09-cdu.js 에서 나눈 조각)
// 09-cdu.js 보다 먼저 읽힌다 — 09-cdu.js 의 init() 이 읽는 도중 _startPosInit 을 부르기 때문(전에는 같은 파일 안 함수 끌어올림으로 됐다).
// 여기에는 선언(var · function)만 있어 먼저 읽어도 다른 파일을 부르지 않는다.
// ─────────────────────────────────────────────────────────────

// ── 시작 위치 · 출발 공항 ──
// 시작할 때 GPS(기기 위치)는 쓰지 않는다 — GPS 는 꺼진 채 시작하고, 필요하면 지도의 GPS
// 버튼으로 켠다. 처음 열면(비밀번호 화면이 걷힌 뒤) 출발 공항을 고르는 창을 띄운다 —
// 지도의 ICAO 공항 목록이다. 고르면 그 공항의 활주로 가운데 지면에 활주로 방향으로 세운다
// (data/runways.js — 가장 긴 활주로 · 첫 번호 쪽 방향, 자료가 없으면 공항 기준점). 고르기
// 전·건너뛰면 김포(START_APT_DEF) 활주로에서 시작한다. 같은 탭에서 새로고침하면(자동 리로드
// 포함) 다시 묻지 않는다(sessionStorage). 브라우저를 새로 열면 묻는다 — 지난번 상태가 남아
// 있어 되살렸더라도(localStorage 의 스냅숏은 6시간 남는다) 묻고, 건너뛰면 되살린 자리에서 이어 간다.
// 공항에서 새로 시작하면 시동 · 전기 · 전자장비는 모두 켜고 AFCAU 의 AUTO TRIM(YAW · ROLL ·
// PITCH)만 꺼 둔다(startStateApply) — AUTO TRIM 은 HOVER FOLLOW 만 맡는다(14-simmode.js).
var START_APT_DEF = (() => { try { return localStorage.getItem('vfrStartAptLast') || 'RKSS'; } catch (e) { return 'RKSS'; } })();   // 지난번에 고른 출발 공항(없으면 김포)   // var — init()(이 파일 앞쪽)이 먼저 부른다
var _startPicked = false;          // 창에서 공항을 골랐으면 load 때 기본 공항으로 되돌리지 않는다
function _startPosInit(restored) {
  // init() 은 이 파일을 읽는 도중에 돈다 — 콘솔(17-upper) · SIM(14-simmode) · 무전기(21-c5000)가
  // 아직 없으므로 자리만 먼저 옮기고, 스위치 · 지면 세우기는 모두 읽은 뒤(load) 다시 한다
  // 브라우저를 새로 열면(같은 탭 새로고침이 아니면) 지난 상태가 남아 있어도 늘 출발 공항 활주로 바닥에서 시작한다 —
  // 지난번 비행의 자리 · 상위모드(IAS 등)를 이어 받지 않는다. 같은 탭 새로고침(자동 리로드)만 그 자리에서 이어 간다.
  let asked = false;
  try { asked = sessionStorage.getItem('vfrStartApt') === '1'; } catch (e) { asked = false; }
  if (!restored || !asked) {
    startAirportSet(START_APT_DEF, { quiet: true });
    const again = () => { if (!_startPicked) startAirportSet(START_APT_DEF, { quiet: true }); };
    if (document.readyState === 'complete') setTimeout(again, 0);
    else window.addEventListener('load', again, { once: true });
  }
  if (asked) return;
  // 비밀번호 화면(00-gate.js)이 걷힌 뒤에 묻는다
  const t = setInterval(() => {
    if (window.gateLocked) return;
    clearInterval(t);
    openStartAirportPicker(restored);
  }, 250);
}
// 그 공항의 활주로 가운데 · 방향 — { lat, lon, hdg(진방위), id } · 활주로 자료가 없으면 null
function startRunwayOf(icao) {
  const ap = (typeof RUNWAYS === 'undefined' ? [] : RUNWAYS).find(r => r.apt === icao);
  if (!ap || !ap.rwys || !ap.rwys.length) return null;
  let best = null;
  for (const r of ap.rwys) {
    const lat0 = (r.a[0] + r.b[0]) / 2, lon0 = (r.a[1] + r.b[1]) / 2;
    const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
    const dx = (r.b[1] - r.a[1]) * kx, dy = (r.b[0] - r.a[0]) * ky, L = Math.hypot(dx, dy);
    if (!best || L > best.L) {
      const hdg = ((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360;   // a(첫 번호 쪽 시단) → b
      best = { lat: lat0, lon: lon0, hdg, id: r.id.split('/')[0], L };
    }
  }
  return best;
}
// 공항에서 새로 시작할 때의 스위치 — 시동(두 엔진 FLY · 연료 OPEN) · 전기(GEN · TRU · BATT) ·
// 전자장비(AFCAU AP · AVCS · MPP RADAR/EGPWS/DMM · C-5000) 모두 켜고, AUTO TRIM 세 버튼만 OFF
function startStateApply() {
  if (typeof ovhdSet !== 'function') return;
  // 상부 · 하부 콘솔을 모두 처음 위치로 되돌린 뒤 시동 상태를 얹는다(지난번에 바꿔 둔 스위치를 이어 받지 않는다)
  try { if (typeof ovhdReset === 'function') ovhdReset(); } catch (e) { _swallow(e); }
  const set = (id, v) => { try { if (ovhdGet(id) !== v) ovhdSet(id, v); } catch (e) { _swallow(e); } };
  [['trng1', 'NORM'], ['trng2', 'NORM'], ['fire1', 'UNARMED'], ['fire2', 'UNARMED'],
   ['fuel1', 'OPEN'], ['fuel2', 'OPEN'], ['pcd1', 'FLY'], ['pcd2', 'FLY'],
   ['gen1', 'ON'], ['gen2', 'ON'], ['tru1', 'ON'], ['tru2', 'ON'], ['batt', 'ON'],
   ['ahrs1Cut', 'OUT'], ['ahrs2Cut', 'OUT'],
   ['ap1', 'OUT'], ['ap2', 'OUT'], ['tfCol', 'OUT'], ['tfCyc', 'OUT'],
   ['atYaw', 'IN'], ['atRoll', 'IN'], ['atPitch', 'IN'],                  // AUTO TRIM 만 OFF
   ['avcsPower', 'IN'], ['mpp0', 'IN'], ['mpp1', 'IN'], ['mpp2', 'IN'],
   ['parkBrake', 'SET'], ['noseLock', 'LOCK'], ['fltArmSw', 'ARMED']].forEach(([id, v]) => set(id, v));   // 활주로에 세워 둔 상태 — 파킹 브레이크 SET · 앞바퀴 LOCK · 비상 부주 ARMED
  // 상위모드는 모두 풀고 시작한다(IAS 가 걸린 채로 시작하던 일 — 07-sim.js afcsReleaseAll)
  try { if (typeof afcsReleaseAll === 'function') afcsReleaseAll(); } catch (e) { _swallow(e); }
  try {
    if (typeof c5 !== 'undefined' && !c5.on) { c5.on = true; c5.page = 'HOME'; _c5Save(); c5Render(); }
  } catch (e) { _swallow(e); }
  try { if (typeof fadecSync === 'function') fadecSync(); } catch (e) { _swallow(e); }   // 시작 상태는 이미 돌고 있다(시동 절차 없이)
  try { if (typeof simModeOn !== 'undefined' && simModeOn && typeof simEngApply === 'function') simEngApply(true); } catch (e) { _swallow(e); }
}
// 그 공항 활주로 가운데 지면에 활주로 방향으로 세운다 — 출발 공항을 고를 때(AIRPORTS)
function startAirportSet(icao, opt = {}) {
  const a = AIRPORTS.find(x => x.ident === icao);
  if (!a) return false;
  const rw = startRunwayOf(icao);
  S.lat = rw ? rw.lat : a.lat; S.lon = rw ? rw.lon : a.lon; S.lastT = null;
  if (rw) S.hdg = rw.hdg;
  S.trail = []; try { updateTrail(); } catch (e) { _swallow(e); }
  try { startStateApply(); } catch (e) { _swallow(e); }
  try { if (typeof acPlaceOnGround === 'function') acPlaceOnGround(); } catch (e) { _swallow(e); }
  try { leafMap.setView([S.lat, S.lon], 13, { animate: false }); } catch (e) { _swallow(e); }
  try { updateAcOnMap(); updateNav(); updateCenterCoord(); } catch (e) { _swallow(e); }
  if (!opt.quiet) try { uiToast(`${a.ident} ${a.name} ${rw ? 'RWY ' + rw.id + ' 가운데' : ''}에서 시작합니다 — 시동 · 전자장비 ON · AUTO TRIM OFF`); } catch (e) { _swallow(e); }
  return true;
}
// 출발 공항 고르기 창 — ICAO · 이름으로 걸러 찾을 수 있다. 닫으면(건너뛰기) 이미 세워 둔 기본 공항(지난번에 고른 곳 · 처음은 김포) 활주로 그대로
// (되살린 상태가 있으면 그 자리에서 이어서, 아니면 송도).
function openStartAirportPicker(resume) {
  if (document.querySelector('.start-apt')) return;
  const back = document.createElement('div');
  back.className = 'ui-dlg-back';
  const dlg = document.createElement('div');
  dlg.className = 'ui-dlg start-apt';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.innerHTML = `
    <div class="ui-dlg-msg"><b>출발 공항을 고르세요</b><br><span class="start-apt-sub">고른 공항 활주로 가운데에 활주로 방향으로 섭니다 · 시동 · 전자장비 ON · AUTO TRIM OFF · GPS 는 꺼진 채</span></div>
    <input class="ui-dlg-in start-apt-q" type="text" placeholder="ICAO 또는 이름 (예: RKSI · 김포)" autocomplete="off">
    <div class="start-apt-list">${AIRPORTS.map(a =>
      `<button type="button" class="start-apt-btn" data-icao="${a.ident}"><b>${a.ident}</b> ${a.name}</button>`).join('')}</div>
    <div class="ui-dlg-btns"><button type="button" class="start-apt-skip">건너뛰기(${START_APT_DEF} 활주로)</button></div>`;
  const close = () => {
    try { sessionStorage.setItem('vfrStartApt', '1'); } catch (e) { _swallow(e); }
    document.removeEventListener('keydown', onKey, true);
    try { back.remove(); } catch (e) { _swallow(e); }
  };
  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
    else if (ev.key === 'Enter') {
      const first = [...dlg.querySelectorAll('.start-apt-btn')].find(b => b.style.display !== 'none');
      if (first) { ev.preventDefault(); ev.stopPropagation(); first.click(); }
    }
  }
  dlg.addEventListener('click', ev => {
    const b = ev.target.closest('.start-apt-btn');
    if (b) { close(); _startPicked = true; try { localStorage.setItem('vfrStartAptLast', b.dataset.icao); } catch (e) { _swallow(e); } startAirportSet(b.dataset.icao); return; }
    if (ev.target.closest('.start-apt-skip')) close();
  });
  const q = dlg.querySelector('.start-apt-q');
  q.addEventListener('input', () => {
    const k = q.value.trim().toUpperCase();
    dlg.querySelectorAll('.start-apt-btn').forEach(b => {
      b.style.display = (!k || b.textContent.toUpperCase().includes(k)) ? '' : 'none';
    });
  });
  document.addEventListener('keydown', onKey, true);
  back.appendChild(dlg);
  document.body.appendChild(back);
}
