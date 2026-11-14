'use strict';
// ══════════════════════════════════════════════════════
// 30-scenario.js — 시나리오 저장 · 불러오기(SCN)
//
// 지금 상태를 이름 붙여 이 기기(localStorage 'scnList')에 저장하고, 교육생마다 같은 조건으로 다시 시작한다.
// 담는 것: 기종 · 자리 · 고도 · 기수 · 속도 · 땅 위인가 · 바람 · 환경(29-env.js 시간대 · 시정 · 비 · NVG · 바다 상태)
//          연료(흰수리 lbs · Bell 갤런과 W&B) · 비행계획(지점 · 활성 지점) · SAR 요구조자 · 배속
// JSON 파일로 내보내고 들여올 수 있다(다른 기기 · 교관끼리 나누기). 지도 창 · 3D 창의 🎬 SCN 단추로 연다.
// ══════════════════════════════════════════════════════
const SCN_KEY = 'scnList';
function scnList() { try { const a = JSON.parse(localStorage.getItem(SCN_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function _scnSaveList(a) { try { localStorage.setItem(SCN_KEY, JSON.stringify(a)); } catch (e) { _swallow(e); try { uiToast('저장 공간이 모자랍니다', 'err'); } catch (er) { /* 그만 */ } } }
const _scnNum = (f, d = null) => { try { const v = f(); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
// 지금 상태 → 시나리오
function scnCapture(name) {
  const b2 = typeof acB206 === 'function' && acB206();
  let gnd = false; try { gnd = typeof sndOnGround === 'function' ? sndOnGround() : false; } catch (e) { _swallow(e); }
  return {
    v: 1, name: String(name || '').trim() || '시나리오', at: Date.now(), ac: (typeof AC_TYPE !== 'undefined') ? AC_TYPE : 'aw189',
    pos: { lat: S.lat, lon: S.lon, alt: S.alt, hdg: S.hdg, spd: S.spd, vs: S.vs }, gnd,
    wind: { dir: _scnNum(() => windDir, 270), spd: _scnNum(() => windSpd, 0) },
    env: (typeof env !== 'undefined') ? { tod: env.tod, vis: env.vis, rain: env.rain, nvg: env.nvg, sea: env.sea } : null,
    fuel: b2 ? { gal: _scnNum(() => b206FuelGal()), wb: (typeof b206Wb !== 'undefined') ? Object.assign({}, b206Wb) : null }
             : { lbs: _scnNum(() => fuelLeft() + fuelRight()) },
    wps: (S.wps || []).map(w => Object.assign({}, w)), awp: S.awp,
    sar: (typeof sar !== 'undefined' && sar.on && sar.lat !== null) ? { type: sar.type, lvl: sar.lvl, lat: sar.lat, lon: sar.lon } : null,
    speed: _scnNum(() => simSpeed, 1),
  };
}
// 시나리오 → 지금 상태(멈춘 채로 둔다 — ▶ 로 시작)
function scnApply(sc) {
  if (!sc || !sc.pos) return false;
  const cur = (typeof AC_TYPE !== 'undefined') ? AC_TYPE : 'aw189';
  if (sc.ac && sc.ac !== cur) { try { uiToast(`이 시나리오는 ${sc.ac === 'b206' ? 'Bell 206' : 'KUH-1CG'} 기종입니다 — 기종이 달라 연료 · 무게는 건너뜁니다`, 'warn', 4000); } catch (e) { _swallow(e); } }
  try { S.running = false; if (typeof updateFlyBtns === 'function') updateFlyBtns(); } catch (e) { _swallow(e); }
  Object.assign(S, { lat: sc.pos.lat, lon: sc.pos.lon, alt: sc.pos.alt, hdg: sc.pos.hdg, spd: sc.pos.spd || 0, vs: sc.pos.vs || 0, bnk: 0, pit: 0 });
  S.trail = []; S.lastT = null;
  try { selHdg = ((Math.round(hdgInd()) + 359) % 360) + 1; } catch (e) { _swallow(e); }
  if (sc.wind) { try { windDir = sc.wind.dir; windSpd = sc.wind.spd; } catch (e) { _swallow(e); } }
  if (sc.env && typeof envSet === 'function') envSet(sc.env);
  if (sc.fuel && sc.ac === cur) {
    try {
      if (sc.fuel.gal != null && typeof b206FuelSet === 'function') { b206FuelSet(sc.fuel.gal); if (sc.fuel.wb && typeof b206WbSet === 'function') b206WbSet(sc.fuel.wb); }
      if (sc.fuel.lbs != null && typeof fuelSetTotal === 'function') fuelSetTotal(sc.fuel.lbs);
    } catch (e) { _swallow(e); }
  }
  try {
    S.wps = (sc.wps || []).map(w => Object.assign({}, w)); S.awp = -1;
    if (S.wps.length && typeof selectWP === 'function') selectWP(Math.max(0, Math.min(S.wps.length - 1, sc.awp >= 0 ? sc.awp : 0)));
    else { updateWpMarkers(); fpRender(); updateNav(); }
  } catch (e) { _swallow(e); }
  try {
    if (typeof sar !== 'undefined') {
      if (sc.sar && typeof sarPlaceAt === 'function') { sar.type = sc.sar.type; sar.lvl = sc.sar.lvl; sarPlaceAt(sc.sar.lat, sc.sar.lon); }
      else if (sar.on && typeof sarToggleOn === 'function') sarToggleOn();
    }
  } catch (e) { _swallow(e); }
  try { if (sc.gnd && typeof acPlaceOnGround === 'function') acPlaceOnGround(); } catch (e) { _swallow(e); }
  try { if (typeof setSimSpeed === 'function') setSimSpeed(sc.speed || 1); } catch (e) { _swallow(e); }
  try { leafMap.setView([S.lat, S.lon], leafMap.getZoom(), { animate: false }); updateAcOnMap(); updateTrail(); updateNav(); } catch (e) { _swallow(e); }
  try { if (typeof fdrClear === 'function') { fdrClear(); fdrNote(`시나리오 — ${sc.name}`); } } catch (e) { _swallow(e); }
  try { uiToast(`시나리오 "${sc.name}" — 준비되었습니다(▶ 로 시작)`); } catch (e) { _swallow(e); }
  return true;
}
function scnSave(name) {
  const a = scnList(), sc = scnCapture(name), i = a.findIndex(x => x.name === sc.name);
  if (i >= 0) a[i] = sc; else a.push(sc);
  _scnSaveList(a); scnRender(); return sc;
}
function scnDelete(i) { const a = scnList(); a.splice(i, 1); _scnSaveList(a); scnRender(); }
function scnExport() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(scnList(), null, 1)], { type: 'application/json' }));
  a.download = 'scenarios.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function scnImport(text) {
  let n = 0;
  try {
    const inc = JSON.parse(text), arr = Array.isArray(inc) ? inc : [inc], a = scnList();
    arr.forEach(sc => { if (sc && sc.pos && Number.isFinite(sc.pos.lat)) { const i = a.findIndex(x => x.name === sc.name); if (i >= 0) a[i] = sc; else a.push(sc); n++; } });
    _scnSaveList(a);
  } catch (e) { _swallow(e); }
  scnRender();
  try { uiToast(n ? `시나리오 ${n}개를 들여왔습니다` : '시나리오 파일을 읽지 못했습니다', n ? '' : 'err'); } catch (e) { _swallow(e); }
  return n;
}
// ── 창 ──
function scnRender() {
  const w = document.getElementById('scn-wrap'); if (!w) return;
  const a = scnList(), fmt = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  w.querySelector('[data-scnv="list"]').innerHTML = a.length ? a.map((sc, i) => `<div class="scn-item"><div><b>${sc.name.replace(/</g, '&lt;')}</b>` +
    `<small>${sc.ac === 'b206' ? 'Bell 206' : 'KUH-1CG'} · ${Math.round(sc.pos.alt)}ft · ${Math.round(sc.pos.spd)}kt · 바람 ${Math.round(sc.wind ? sc.wind.dir : 0)}°/${Math.round(sc.wind ? sc.wind.spd : 0)}kt · 지점 ${(sc.wps || []).length}${sc.sar ? ' · SAR' : ''} · ${fmt(sc.at)}</small></div>` +
    `<button class="sim-btn" data-scn="load:${i}">불러오기</button><button class="sim-btn" data-scn="del:${i}">✕</button></div>`).join('')
    : '<div class="scn-empty">저장한 시나리오가 없습니다 — 이름을 넣고 "지금 상태 저장"을 누르십시오.</div>';
}
function toggleScenario() {
  let w = document.getElementById('scn-wrap');
  if (w && w.style.display === 'flex') { w.style.display = 'none'; return; }
  if (!w) {
    w = document.createElement('div'); w.id = 'scn-wrap';
    w.innerHTML = `<div class="scn-box"><div class="scn-bar"><b>🎬 시나리오 (SCN)</b><button class="sim-btn" data-scn="close">✕</button></div>` +
      `<div class="scn-new"><input type="text" maxlength="40" placeholder="이름 (예: 착함 · 야간 · 해상 4)" data-scnv="name"><button class="sim-btn on" data-scn="save">지금 상태 저장</button></div>` +
      `<div class="scn-list" data-scnv="list"></div>` +
      `<div class="scn-io"><button class="sim-btn" data-scn="export">파일로 내보내기</button><label class="sim-btn">파일 들여오기<input type="file" accept=".json,application/json" data-scnv="file" hidden></label></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => {
      if (e.target === w) { w.style.display = 'none'; return; }
      const b = e.target.closest('[data-scn]'); if (!b) return;
      const [k, i] = b.dataset.scn.split(':');
      if (k === 'close') w.style.display = 'none';
      else if (k === 'save') { const inp = w.querySelector('[data-scnv="name"]'); const sc = scnSave(inp.value); inp.value = ''; try { uiToast(`"${sc.name}" 저장`); } catch (er) { /* 그만 */ } }
      else if (k === 'load') { if (scnApply(scnList()[+i])) w.style.display = 'none'; }
      else if (k === 'del') Promise.resolve(typeof uiConfirm === 'function' ? uiConfirm(`"${scnList()[+i].name}" 를 지울까요?`) : true).then(ok => { if (ok) scnDelete(+i); });
      else if (k === 'export') scnExport();
    });
    w.querySelector('[data-scnv="file"]').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(scnImport); e.target.value = '';
    });
  }
  w.style.display = 'flex'; scnRender();
}
try { appRegister({ toggleScenario }); } catch (e) { _swallow(e); }
