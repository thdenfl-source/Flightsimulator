'use strict';
// ══════════════════════════════════════════════════════
// 39-train5.js — 훈련 보강 5
//   ① IIMC(뜻하지 않은 계기비행 기상) 연습 · 회복 자동 판정
//   ② 연료 계획 · BINGO 경고(귀환 연료)
//   ③ 무선 교신 연습 — 표준 문구 · 녹음 · 다시 듣기 · MAYDAY / PAN-PAN 형식 점검
// ══════════════════════════════════════════════════════

// ── ① IIMC — 지금 고도를 구름 속에 넣고(시정 400m · 구름 밑면을 발밑으로), 회복 조작을 잰다 ──
//   교관이 ENV(⚠ IIMC) · IOS(⚠ IIMC 걸기)에서 건다. 판정(합 100점):
//     날개 수평(뱅크 10° 안) — 5초 안 25 · 10초 안 15        상승 시작(승강률 +300fpm) — 10초 안 25 · 20초 안 15
//     자세 한계(뱅크 30° · 피치 −5~+15° 안) 20 · 조금 넘음(45° · −10~+20°) 10
//     속도(최저 속도가 기종 기준 이상 · VNE 아래) 15 · 기준 −10kt 까지 8      안전고도(구름 위) 도달 15
//   바로 실패: 전파고도 100ft 아래(지면 근접) · 뱅크 60° · 피치 −20° 넘음(공간정위 상실). 4분이 지나도 못 오르면 끝낸다.
//   끝나면 결과 창 · 강평(FDR) 사건 · 강평 채점 구간(A ~ B)을 그 구간으로 맞춘다 — 3D 다시 보기의 ⟲ A~B 로 돌려 본다.
const IIMC_TIMEOUT = 240;
const iimc = { on: false, t: 0, snap: null, alt0: 0, hdg0: 0, safeAlt: 0, lvlT: null, climbT: null, maxBnk: 0, minPit: 0, maxPit: 0, minIas: 999, maxIas: 0, minRa: 99999, i0: -1, res: null, fail: '' };
function _iimcVmin() { try { return acB206() ? 50 : 70; } catch (e) { return 60; } }
function _iimcRa() { try { return typeof radarAltFt === 'function' ? radarAltFt() : S.alt; } catch (e) { return S.alt; } }
function iimcStart(opt = {}) {
  if (iimc.on) return false;
  if (typeof env === 'undefined' || typeof envSet !== 'function') return false;
  const alt = S.alt || 0;
  iimc.snap = { vis: env.vis, ceil: env.ceil, ctop: env.ctop || 0, rain: env.rain };
  const ceil = Math.max(100, Math.floor((alt - 300) / 100) * 100);
  envSet({ vis: 0.4, ceil, ctop: 0, rain: Math.max(env.rain, 1) });
  Object.assign(iimc, { on: true, t: 0, alt0: alt, hdg0: S.hdg, safeAlt: opt.safeAlt || (typeof envCloudTop === 'function' ? envCloudTop() : ceil + 1500) + 100, lvlT: null, climbT: null,
    maxBnk: 0, minPit: 0, maxPit: 0, minIas: 999, maxIas: 0, minRa: 99999, res: null, fail: '',
    i0: (typeof fdr !== 'undefined' && fdr.rows) ? Math.max(0, fdr.rows.length - 1) : -1 });
  try { if (typeof fdrNote === 'function') fdrNote(`IIMC 시작 — ${Math.round(alt)}ft · 안전고도 ${iimc.safeAlt}ft`, 'warn'); } catch (e) { _swallow(e); }
  try { uiToast(`⚠ IIMC — 구름 속입니다. 자세(수평) · 출력(상승) · 속도 · ${iimc.safeAlt}ft 까지`, 'warn', 6000); } catch (e) { _swallow(e); }
  return true;
}
// dt — 시뮬 초
function iimcStep(dt) {
  if (!iimc.on || !(dt > 0)) return;
  iimc.t += dt;
  const b = Math.abs(S.bnk || 0), p = S.pit || 0, v = S.spd || 0, vs = S.vs || 0, ra = _iimcRa();
  iimc.maxBnk = Math.max(iimc.maxBnk, b); iimc.minPit = Math.min(iimc.minPit, p); iimc.maxPit = Math.max(iimc.maxPit, p);
  iimc.minIas = Math.min(iimc.minIas, v); iimc.maxIas = Math.max(iimc.maxIas, v); iimc.minRa = Math.min(iimc.minRa, ra);
  if (iimc.lvlT === null && b <= 10) iimc.lvlT = iimc.t;
  if (iimc.climbT === null && vs >= 300) iimc.climbT = iimc.t;
  if (ra < 100 && iimc.alt0 > 150) return iimcEnd('지면 근접(전파고도 100ft 아래)');
  if (b > 60 || p < -20) return iimcEnd('자세 상실(공간정위 상실)');
  if (S.alt >= iimc.safeAlt) return iimcEnd('');
  if (iimc.t >= IIMC_TIMEOUT) return iimcEnd('시간 넘김(4분 안에 안전고도 못 감)');
}
function iimcScore(o = iimc) {
  const it = [];
  const add = (name, pts, max, txt) => it.push({ name, pts, max, txt });
  add('날개 수평', o.lvlT !== null && o.lvlT <= 5 ? 25 : o.lvlT !== null && o.lvlT <= 10 ? 15 : 0, 25, o.lvlT === null ? '못 함' : `${o.lvlT.toFixed(1)}초`);
  add('상승 시작', o.climbT !== null && o.climbT <= 10 ? 25 : o.climbT !== null && o.climbT <= 20 ? 15 : 0, 25, o.climbT === null ? '못 함' : `${o.climbT.toFixed(1)}초`);
  const att = o.maxBnk <= 30 && o.minPit >= -5 && o.maxPit <= 15 ? 20 : o.maxBnk <= 45 && o.minPit >= -10 && o.maxPit <= 20 ? 10 : 0;
  add('자세 한계', att, 20, `뱅크 최대 ${o.maxBnk.toFixed(0)}° · 피치 ${o.minPit.toFixed(0)}~${o.maxPit.toFixed(0)}°`);
  let vne = 160; try { if (typeof simVne === 'function') vne = simVne(); } catch (e) { _swallow(e); }
  const vm = _iimcVmin();
  const spd = o.maxIas > vne ? 0 : o.minIas >= vm ? 15 : o.minIas >= vm - 10 ? 8 : 0;
  add('속도', spd, 15, `최저 ${o.minIas === 999 ? '—' : o.minIas.toFixed(0)}kt (기준 ${vm}kt) · 최고 ${o.maxIas.toFixed(0)}kt`);
  add('안전고도', !o.fail ? 15 : 0, 15, !o.fail ? `${o.safeAlt}ft · ${o.t.toFixed(0)}초` : o.fail);
  const score = o.fail && o.fail.indexOf('시간') < 0 ? 0 : it.reduce((s, x) => s + x.pts, 0);
  const grade = o.fail && o.fail.indexOf('시간') < 0 ? '불만족' : score >= 85 ? '우수' : score >= 70 ? '만족' : score >= 55 ? '보통' : '미흡';
  return { items: it, score, grade, fail: o.fail, t: o.t };
}
function iimcEnd(fail, opt = {}) {
  if (!iimc.on) return null;
  iimc.on = false; iimc.fail = fail || '';
  const R = iimcScore(); iimc.res = R;
  try { if (typeof fdrNote === 'function') fdrNote(`IIMC 끝 — ${R.fail ? R.fail + ' · ' : '안전고도 도달 · '}${R.score}점 ${R.grade}`, R.fail ? 'err' : ''); } catch (e) { _swallow(e); }
  // 강평 채점 구간을 이 IIMC 로 — 3D 다시 보기 ⟲ A~B
  try { if (typeof _grade !== 'undefined' && iimc.i0 >= 0 && fdr.rows.length - 1 > iimc.i0) { _grade.a = iimc.i0; _grade.b = fdr.rows.length - 1; } } catch (e) { _swallow(e); }
  if (opt.quiet !== true) iimcResShow();
  return R;
}
function iimcRestoreEnv() { if (iimc.snap && typeof envSet === 'function') { envSet(iimc.snap); iimc.snap = null; } }
function iimcResShow() {
  const R = iimc.res; if (!R) return;
  let w = document.getElementById('iimc-wrap');
  if (!w) {
    w = document.createElement('div'); w.id = 'iimc-wrap'; w.className = 'diag-like'; document.body.appendChild(w);
    w.addEventListener('click', e => {
      const b = e.target.closest('[data-iimc]'); if (e.target !== w && !b) return;
      const k = b ? b.dataset.iimc : 'x';
      if (k === 'env') iimcRestoreEnv();
      else if (k === 'dbf' && typeof dbfOpen === 'function') dbfOpen();
      w.style.display = 'none';
    });
  }
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>⚠ IIMC 회복 판정</b><button class="sim-btn" data-iimc="x">✕</button></div>
    <table class="gr-t iimc-t"><tr><th>항목</th><th>결과</th><th>점수</th></tr>${R.items.map(x => `<tr><td>${x.name}</td><td>${esc(x.txt)}</td><td class="${x.pts === x.max ? 'ok' : x.pts ? '' : 'bad'}">${x.pts} / ${x.max}</td></tr>`).join('')}</table>
    <div class="gr-sum">${R.fail ? `<b class="bad">${esc(R.fail)}</b> · ` : ''}점수 <b>${R.score}</b> · <b class="gr-${R.grade}">${R.grade}</b> · ${R.t.toFixed(0)}초</div>
    <div class="set-row"><span></span><div><button class="sim-btn" data-iimc="env">환경 되돌리기(구름 · 시정)</button><button class="sim-btn" data-iimc="dbf">📋 강평에서 다시 보기</button><button class="sim-btn" data-iimc="x">닫기</button></div></div>
    <div class="set-note">회복 순서 — 자세(날개 수평 · 기수 약간 위) → 출력(상승 토크) → 속도(Vy 근처) → 기수 유지 · 안전고도까지 상승 → 관제 연락</div></div>`;
  w.style.display = 'flex';
}
let _iimcLast = 0;
setInterval(() => {
  const now = performance.now(), dt = Math.min(1, (now - (_iimcLast || now)) / 1000); _iimcLast = now;
  if (iimc.on && S.running) iimcStep(dt * (typeof simSpeed === 'number' && simSpeed > 0 ? simSpeed : 1));
}, 250);

// ── ② 연료 계획 · BINGO — 기지(출발 공항 · 가장 가까운 공항 · 함정 · 정한 곳)로 돌아갈 연료 + 예비 ──
//   돌아갈 연료 = 거리 ÷ (순항 속도 − 맞바람) × 순항 연료 흐름.  BINGO = 돌아갈 연료 + 예비(분 × 순항 흐름).
//   흰수리 — 연료 lbs(18-system.js fuelTotal) · 순항 120kt · 순항 흐름 = 지금 흐름과 990pph(토크 70%) 가운데 큰 것
//   Bell 206 — 갤런(25-b206panel.js) 을 lb(6.7)로 · 순항 100kt · 순항 27gph
//   남은 여유가 150 lb 아래면 'BINGO 가까움'(노랑) · 0 이하면 'BINGO FUEL'(빨강 · 음성) — 각각 한 번씩 알리고 강평에 남긴다.
const bingoCfg = Object.assign({ home: 'start', resMin: 20, ptLat: null, ptLon: null, on: true },
  (() => { try { return JSON.parse(localStorage.getItem('bingoCfg') || 'null') || {}; } catch (e) { return {}; } })());
function _bingoSave() { try { localStorage.setItem('bingoCfg', JSON.stringify(bingoCfg)); } catch (e) { _swallow(e); } }
const bingoSt = { lvl: 0 };   // 0 여유 · 1 가까움 · 2 BINGO
function bingoHome() {
  try {
    if (bingoCfg.home === 'ship' && typeof shipLat !== 'undefined' && shipLat !== null) return { lat: shipLat, lon: shipLon, name: '함정' };
    if (bingoCfg.home === 'pt' && Number.isFinite(bingoCfg.ptLat)) return { lat: bingoCfg.ptLat, lon: bingoCfg.ptLon, name: '정한 곳' };
    const A = typeof AIRPORTS !== 'undefined' ? AIRPORTS : [];
    if (bingoCfg.home === 'near' && A.length) {
      let best = null, bd = 1e9; for (const a of A) { const d = distance(S.lat, S.lon, a.lat, a.lon); if (d < bd) { bd = d; best = a; } }
      if (best) return { lat: best.lat, lon: best.lon, name: best.ident };
    }
    const id = typeof START_APT_DEF !== 'undefined' ? START_APT_DEF : 'RKSS', a = A.find(x => x.ident === id);
    if (a) return { lat: a.lat, lon: a.lon, name: a.ident };
  } catch (e) { _swallow(e); }
  return null;
}
function bingoCalc() {
  const H = bingoHome(); if (!H) return null;
  const b206 = (() => { try { return acB206(); } catch (e) { return false; } })();
  let fuel = 0, ffNow = 0;
  if (b206) { try { fuel = b206FuelGal() * 6.7; } catch (e) { fuel = 0; } }
  else { try { fuel = fuelTotal(); const F = fuelFlow(); ffNow = (F.f1 || 0) + (F.f2 || 0); } catch (e) { fuel = 0; } }
  const tas = b206 ? 100 : 120, ffCr = b206 ? 27 * 6.7 : Math.max(990, ffNow);
  const dist = distance(S.lat, S.lon, H.lat, H.lon), brg = typeof bearing === 'function' ? bearing(S.lat, S.lon, H.lat, H.lon) : 0;
  const ws = typeof windSpd === 'number' ? windSpd : 0, wd = typeof windDir === 'number' ? windDir : 0;
  const head = ws * Math.cos((wd - brg) * Math.PI / 180);           // 바람이 오는 쪽이 가는 쪽이면 맞바람(+)
  const gs = Math.max(40, tas - head), hrs = dist / gs;
  const ret = hrs * ffCr, res = bingoCfg.resMin / 60 * ffCr, bingo = ret + res, margin = fuel - bingo;
  const ff = b206 ? ffCr : (ffNow || ffCr);
  return { home: H, dist, brg, gs, head, hrs, ret, res, bingo, fuel, margin, ff, toBingoMin: ff > 0 ? margin / ff * 60 : null, unit: 'lb', b206 };
}
function bingoStep() {
  if (!bingoCfg.on || !S.running) return;
  const B = bingoCalc(); if (!B || !(B.fuel > 0)) return;
  const lvl = B.margin <= 0 ? 2 : B.margin < 150 ? 1 : 0;
  if (lvl > bingoSt.lvl) {
    const txt = lvl === 2 ? `BINGO FUEL — ${B.home.name} 귀환 ${Math.round(B.bingo)}lb · 남은 ${Math.round(B.fuel)}lb` : `BINGO 가까움 — 여유 ${Math.round(B.margin)}lb(약 ${Math.max(0, B.toBingoMin || 0).toFixed(0)}분)`;
    try { uiToast('⛽ ' + txt, lvl === 2 ? 'err' : 'warn', 7000); } catch (e) { _swallow(e); }
    try { if (typeof fdrNote === 'function') fdrNote(txt, lvl === 2 ? 'err' : 'warn'); } catch (e) { _swallow(e); }
    if (lvl === 2) try { if (typeof speak === 'function') speak('Bingo fuel, bingo fuel'); } catch (e) { _swallow(e); }
  }
  bingoSt.lvl = lvl;
  _bingoRender(B);
}
setInterval(bingoStep, 1000);
function toggleBingo() {
  let w = document.getElementById('bingo-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'bingo-wrap'; w.className = 'diag-like'; document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-bg]'); if (!b) return;
      const [k, v] = b.dataset.bg.split(':');
      if (k === 'x') { w.style.display = 'none'; return; }
      if (k === 'home') { bingoCfg.home = v; if (v === 'pt') { bingoCfg.ptLat = S.lat; bingoCfg.ptLon = S.lon; } }
      else if (k === 'res') bingoCfg.resMin = +v;
      else if (k === 'on') bingoCfg.on = v === '1';
      bingoSt.lvl = 0; _bingoSave(); _bingoRender(bingoCalc(), true);
    });
  }
  w.style.display = 'flex'; _bingoRender(bingoCalc(), true);
}
function _bingoRender(B, full) {
  const w = document.getElementById('bingo-wrap'); if (!w || w.style.display !== 'flex') return;
  const row = (a, b) => `<div class="set-row"><span>${a}</span><div>${b}</div></div>`;
  const btn = (k, v, l, cur) => `<button class="sim-btn ${cur ? 'on' : ''}" data-bg="${k}:${v}">${l}</button>`;
  const hm = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const body = B ? `${row('기지', `${B.home.name} · ${B.dist.toFixed(1)}NM · ${Math.round(B.brg)}° · 지상속도 ${Math.round(B.gs)}kt(${B.head >= 0 ? '맞바람' : '뒷바람'} ${Math.abs(B.head).toFixed(0)}kt) · ${hm(B.hrs)}`)}
    ${row('연료', `남은 <b>${Math.round(B.fuel)}</b>lb · 지금 흐름 ${Math.round(B.ff)}pph`)}
    ${row('BINGO', `<b class="${B.margin <= 0 ? 'bad' : B.margin < 150 ? 'warn' : 'ok'}">${Math.round(B.bingo)}lb</b> = 귀환 ${Math.round(B.ret)} + 예비 ${Math.round(B.res)}(${bingoCfg.resMin}분)`)}
    ${row('여유', `<b class="${B.margin <= 0 ? 'bad' : B.margin < 150 ? 'warn' : 'ok'}">${Math.round(B.margin)}lb</b>${B.toBingoMin !== null && B.margin > 0 ? ` · BINGO 까지 약 ${B.toBingoMin.toFixed(0)}분` : B.margin <= 0 ? ' · 지금 귀환하십시오' : ''}`)}` : row('기지', '기지를 찾지 못했습니다');
  if (!full) { const el = w.querySelector('[data-bgv="body"]'); if (el) { el.innerHTML = body; return; } }
  w.innerHTML = `<div class="set-box diag-box"><div class="set-bar"><b>⛽ 연료 계획 · BINGO</b><button class="sim-btn" data-bg="x">✕</button></div>
    ${row('돌아갈 곳', btn('home', 'start', '출발 공항', bingoCfg.home === 'start') + btn('home', 'near', '가장 가까운 공항', bingoCfg.home === 'near') + btn('home', 'ship', '함정', bingoCfg.home === 'ship') + btn('home', 'pt', bingoCfg.home === 'pt' ? '정한 곳(다시 정하기)' : '지금 자리를 기지로', bingoCfg.home === 'pt'))}
    ${row('예비 연료', [10, 20, 30, 45].map(m => btn('res', m, m + '분', bingoCfg.resMin === m)).join(''))}
    ${row('경고', btn('on', 1, '켬', bingoCfg.on) + btn('on', 0, '끔', !bingoCfg.on))}
    <div data-bgv="body">${body}</div>
    <div class="set-note">순항 ${B && B.b206 ? '100kt · 27gph' : '120kt · 990pph(토크 70%) 또는 지금 흐름'}로 셈합니다. 여유 150lb 아래에서 노랑 · 0 이하에서 'BINGO FUEL'(음성) — 강평에 남습니다.</div></div>`;
}

// ── ③ 무선 교신 연습 — 표준 문구(들어 보기) · 내 목소리 녹음 · 다시 듣기 · MAYDAY / PAN-PAN 형식 점검 ──
function _rpPos() {
  try {
    const A = typeof AIRPORTS !== 'undefined' ? AIRPORTS : []; let best = null, bd = 1e9;
    for (const a of A) { const d = distance(S.lat, S.lon, a.lat, a.lon); if (d < bd) { bd = d; best = a; } }
    if (!best) return `${S.lat.toFixed(2)} north ${S.lon.toFixed(2)} east`;
    const b = Math.round(bearing(best.lat, best.lon, S.lat, S.lon)) % 360;
    return `${Math.round(bd)} miles ${['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(b / 45) % 8]} of ${best.ident}`;
  } catch (e) { return 'position unknown'; }
}
function _rpCs() { try { return appSet.callsign || 'Coastguard zero one'; } catch (e) { return 'Coastguard zero one'; } }
function _rpEnd() { try { const E = fuelEndurance(); if (E && E.toZeroH) return `${Math.floor(E.toZeroH)} hours ${Math.round((E.toZeroH % 1) * 60)} minutes`; } catch (e) { _swallow(e); } return 'one hour'; }
const RADIO_PHRASES = [
  ['관제', [
    ['지상 이동 요청', () => `Ground, ${_rpCs()}, at the ramp, request taxi for departure, VFR to the south.`],
    ['이륙 준비', () => `Tower, ${_rpCs()}, holding short, ready for departure.`],
    ['위치 보고', () => `${_rpCs()}, ${_rpPos()}, ${Math.round(S.alt / 100) * 100} feet, heading ${String(Math.round(S.hdg) % 360).padStart(3, '0')}.`],
    ['착륙 요청', () => `Tower, ${_rpCs()}, ${_rpPos()}, inbound for landing, information alpha.`],
  ]],
  ['해경 임무', [
    ['현장 도착(SAR)', () => `${_rpCs()}, on scene, commencing expanding square search, ${Math.round(S.alt / 100) * 100} feet.`],
    ['요구조자 발견', () => `${_rpCs()}, survivor in sight, ${_rpPos()}, preparing for hoist recovery.`],
    ['호이스트 시작', () => `${_rpCs()}, commencing hoist operation, one person to be recovered.`],
    ['환자 이송', () => `${_rpCs()}, MEDEVAC, one patient on board, request priority landing, ETA one five minutes.`],
  ]],
  ['비상', [
    ['MAYDAY', () => `MAYDAY MAYDAY MAYDAY, ${_rpCs()}, ${_rpPos()}, ${Math.round(S.alt / 100) * 100} feet, engine failure, intending to ditch, four persons on board, endurance ${_rpEnd()}.`],
    ['PAN-PAN', () => `PAN PAN, PAN PAN, PAN PAN, ${_rpCs()}, ${_rpPos()}, ${Math.round(S.alt / 100) * 100} feet, chip light, returning to base, four persons on board.`],
  ]],
];
// MAYDAY · PAN-PAN 형식 — 들어가야 할 것: 머리말 3번 · 콜사인 · 위치 · 고도 · 상황 · 의도 · 탑승 인원 · 남은 시간(연료)
function radioCheckDistress(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[,.\-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const may = (t.match(/\bmayday\b/g) || []).length, pan = (t.match(/\bpan\b/g) || []).length;
  const kind = may ? 'MAYDAY' : pan ? 'PAN-PAN' : '';
  const cs = _rpCs().toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const items = [
    ['머리말 3번', kind === 'MAYDAY' ? may >= 3 : pan >= 6],
    ['콜사인', cs.length ? cs.some(w => t.includes(' ' + w + ' ')) : /coastguard|shine/.test(t)],
    ['위치', /\b(miles?|nm|north|south|east|west|of [a-z]{4}|position|bearing|radial)\b/.test(t)],
    ['고도', /\b(feet|ft|flight level|altitude)\b/.test(t)],
    ['상황(고장)', /\b(fail|failure|fire|chip|smoke|loss|lost|engine|hydraulic|ditch|emergency|warning|light)\w*/.test(t)],
    ['의도', /\b(intend|intending|ditch|returning|return|divert|landing|land|request)\w*/.test(t)],
    ['탑승 인원', /\b(persons?|souls?|pob|people|on board)\b/.test(t)],
    ['남은 시간(연료)', /\b(endurance|fuel|minutes|hours?)\b/.test(t)],
  ];
  const n = items.filter(x => x[1]).length;
  return { kind, items, n, total: items.length, ok: !!kind && n === items.length };
}
const radio = { rec: null, chunks: [], clips: [], stream: null, recog: null };
async function radioRecStart() {
  if (radio.rec) return false;
  try {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('녹음을 지원하지 않습니다');
    radio.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    radio.rec = new MediaRecorder(radio.stream); radio.chunks = [];
    radio.rec.ondataavailable = e => { if (e.data && e.data.size) radio.chunks.push(e.data); };
    radio.rec.onstop = () => {
      const blob = new Blob(radio.chunks, { type: radio.rec ? radio.rec.mimeType : 'audio/webm' });
      radio.clips.unshift({ url: URL.createObjectURL(blob), at: new Date(), text: (document.querySelector('#radio-wrap [data-rdv="txt"]') || {}).value || '' });
      while (radio.clips.length > 6) { const c = radio.clips.pop(); try { URL.revokeObjectURL(c.url); } catch (e) { _swallow(e); } }
      try { radio.stream.getTracks().forEach(t => t.stop()); } catch (e) { _swallow(e); }
      radio.rec = null; radio.stream = null; _radioRender();
    };
    radio.rec.start();
    // 받아쓰기(있으면) — 말한 내용을 글로 받아 형식 점검에 쓴다
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { try { const r = new SR(); r.lang = 'en-US'; r.continuous = true; r.interimResults = false; r.onresult = e => { const ta = document.querySelector('#radio-wrap [data-rdv="txt"]'); if (ta) { ta.value = Array.from(e.results).map(x => x[0].transcript).join(' '); _radioCheck(); } }; r.start(); radio.recog = r; } catch (e) { _swallow(e); } }
    _radioRender(); return true;
  } catch (e) { radio.rec = null; try { uiToast('마이크를 쓸 수 없습니다 — 브라우저 마이크 권한을 확인하십시오. 아래 칸에 직접 적어 형식 점검은 할 수 있습니다.', 'warn', 6000); } catch (er) { _swallow(er); } return false; }
}
function radioRecStop() { try { if (radio.recog) { radio.recog.stop(); radio.recog = null; } } catch (e) { _swallow(e); } try { if (radio.rec && radio.rec.state !== 'inactive') radio.rec.stop(); } catch (e) { _swallow(e); } }
function toggleRadioPractice() {
  let w = document.getElementById('radio-wrap');
  if (w && w.style.display === 'flex') { radioRecStop(); w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'radio-wrap'; w.className = 'diag-like'; document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { radioRecStop(); w.style.display = 'none'; return; }
      const b = e.target.closest('[data-rd]'); if (!b) return;
      const [k, a, c] = b.dataset.rd.split(':');
      if (k === 'x') { radioRecStop(); w.style.display = 'none'; return; }
      if (k === 'ph') { const txt = RADIO_PHRASES[+a][1][+c][1](); const ex = w.querySelector('[data-rdv="ex"]'); ex.textContent = txt; try { if (typeof speak === 'function') speak(txt); } catch (er) { _swallow(er); } }
      else if (k === 'rec') { if (radio.rec) radioRecStop(); else radioRecStart(); }
      else if (k === 'play') { const cl = radio.clips[+a]; if (cl) { try { new Audio(cl.url).play(); } catch (er) { _swallow(er); } } }
      else if (k === 'chk') _radioCheck();
      else if (k === 'copy') { const ta = w.querySelector('[data-rdv="txt"]'), ex = w.querySelector('[data-rdv="ex"]'); ta.value = ex.textContent; _radioCheck(); }
    });
    w.addEventListener('input', e => { if (e.target.dataset.rdv === 'txt') _radioCheck(); });
  }
  w.style.display = 'flex'; _radioRender(true);
}
function _radioCheck() {
  const w = document.getElementById('radio-wrap'); if (!w) return null;
  const ta = w.querySelector('[data-rdv="txt"]'), out = w.querySelector('[data-rdv="chk"]'); if (!ta || !out) return null;
  const R = radioCheckDistress(ta.value);
  out.innerHTML = ta.value.trim() ? `<b>${R.kind || '비상 호출 아님'}</b> ${R.n}/${R.total} — ` + R.items.map(([n, ok]) => `<span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${n}</span>`).join(' ') : '';
  return R;
}
function _radioRender(full) {
  const w = document.getElementById('radio-wrap'); if (!w) return;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const clips = radio.clips.length ? radio.clips.map((c, i) => `<button class="sim-btn" data-rd="play:${i}">▶ ${String(c.at.getHours()).padStart(2, '0')}:${String(c.at.getMinutes()).padStart(2, '0')}:${String(c.at.getSeconds()).padStart(2, '0')}</button>`).join('') : '<span class="tp-none">아직 없음</span>';
  if (!full && w.querySelector('[data-rdv="clips"]')) {
    w.querySelector('[data-rdv="clips"]').innerHTML = clips;
    const rb = w.querySelector('[data-rd="rec"]'); rb.textContent = radio.rec ? '■ 녹음 멈춤' : '● 녹음'; rb.classList.toggle('on', !!radio.rec);
    return;
  }
  const keep = (w.querySelector('[data-rdv="txt"]') || {}).value || '';
  w.innerHTML = `<div class="set-box diag-box radio-box"><div class="set-bar"><b>📻 무선 교신 연습</b><button class="sim-btn" data-rd="x">✕</button></div>
    ${RADIO_PHRASES.map(([g, L], gi) => `<div class="set-row"><span>${g}</span><div>${L.map(([n], i) => `<button class="sim-btn" data-rd="ph:${gi}:${i}">${n}</button>`).join('')}</div></div>`).join('')}
    <div class="set-row"><span>본보기</span><div><span class="radio-ex" data-rdv="ex">위 단추를 누르면 지금 자리 · 고도 · 콜사인(${esc(_rpCs())})을 넣은 표준 문구를 읽어 줍니다.</span><button class="sim-btn" data-rd="copy" title="본보기를 아래 칸으로">↓</button></div></div>
    <div class="set-row"><span>내 교신</span><div><button class="sim-btn ${radio.rec ? 'on' : ''}" data-rd="rec">${radio.rec ? '■ 녹음 멈춤' : '● 녹음'}</button><span data-rdv="clips">${clips}</span></div></div>
    <div class="set-row"><span>받아쓰기 · 점검</span><div><textarea data-rdv="txt" rows="3" placeholder="녹음하면 받아쓰기(지원하는 브라우저)가 채웁니다. 직접 적어도 됩니다.">${esc(keep)}</textarea></div></div>
    <div class="set-row"><span></span><div class="radio-chk" data-rdv="chk"></div></div>
    <div class="set-note">MAYDAY / PAN-PAN 형식: 머리말 3번 → 콜사인 → 위치 → 고도 → 상황 → 의도 → 탑승 인원 → 남은 시간. 녹음은 이 창에만 남고(최근 6개) 앱을 닫으면 사라집니다.</div></div>`;
  _radioCheck();
}

try { appRegister({ toggleBingo, toggleRadioPractice, iimcStart }); } catch (e) { _swallow(e); }
