// ─────────────────────────────────────────────────────────────
// 06-nav.js — 항법 · 비행계획 · 홀딩 · 사용자 SID
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════
function updateNav(){
  // BRG1: FMS = active WP, VOR/LOC = selected navaid
  if (navSrc === 'FMS') {
    if (S.awp>=0&&S.awp<S.wps.length) {
      const wp=S.wps[S.awp];
      S.brg = bearing(S.lat,S.lon,wp.lat,wp.lon);
      S.dtw = distance(S.lat,S.lon,wp.lat,wp.lon);
      S.xtk = courseXtk(activeCourseLine());   // CDI·지도·AP와 같은 기준선
    } else { S.brg=0; S.dtw=0; S.xtk=0; }
  } else {
    // VOR / LOC — BRG1 points to the selected navaid station
    if (navLat !== null) {
      S.brg = bearing(S.lat,S.lon,navLat,navLon);
      S.dtw = distance(S.lat,S.lon,navLat,navLon);
    } else { S.brg=0; S.dtw=0; }
    S.xtk = 0;
  }

  // BRG2: always flight-plan waypoint
  if (S.brg2wp>=0&&S.brg2wp<S.wps.length) {
    const wp2=S.wps[S.brg2wp];
    S.brg2 = bearing(S.lat,S.lon,wp2.lat,wp2.lon);
    S.dtw2 = distance(S.lat,S.lon,wp2.lat,wp2.lon);
  } else { S.brg2=0;S.dtw2=0; }

  updateCrsLine();
  updateBrgLines();
}

// ══════════════════════════════════════════════════════
// FLIGHT PLAN STATE MACHINE
// ══════════════════════════════════════════════════════
let fpMode = 'LIST'; // 'LIST'|'ADD'|'IDENT'|'LAT'|'LON'|'IFR'|'SIDNEW'|'HOLD'|'WPT'|'WPTNUM'
let fpWptIdx  = -1;    // 상세 화면을 연 웨이포인트
let fpEditIdx = -1;    // 이름·좌표를 '새로 추가' 가 아니라 '고치는' 대상
let fpNumFld  = null;  // 상세 화면의 숫자 입력 대상 ('VALT' | 'VOFS')
let fpInputBuf = '';
let fpTempLat = null;
let fpIfrPhase = 'dep';

function fpGo(mode) { fpMode = mode; if(mode==='IDENT'||mode==='LAT'||mode==='LON') fpInputBuf=''; fpRender(); }

// FPL 자동 저장 — 새로고침해도 비행계획 유지
function _fplPersist() {
  try { localStorage.setItem('fplSave', JSON.stringify({ wps: S.wps, awp: S.awp })); } catch(e) { _swallow(e); }
}
function _fplRestore() {
  try {
    const s = JSON.parse(localStorage.getItem('fplSave') || 'null');
    if (s && Array.isArray(s.wps) && s.wps.length) {
      S.wps = s.wps;
      S.awp = (typeof s.awp === 'number' && s.awp < s.wps.length) ? s.awp : -1;
      updateWpMarkers(); updateNav();
    }
  } catch(e) { _swallow(e); }
}

function fpRender() {
  const area   = document.getElementById('fp-content-area');
  const title  = document.getElementById('fp-mode-title');
  const footer = document.getElementById('fp-footer-nav');
  _fplPersist();   // FPL 변경 경로마다 호출되므로 여기서 자동 저장
  if (!area) return;
  switch(fpMode) {
    case 'LIST':  fpRenderList(area, title, footer);  break;
    case 'ADD':   fpRenderAdd(area, title, footer);   break;
    case 'IDENT': fpRenderIdent(area, title, footer); break;
    case 'LAT':   fpRenderCoord(area, title, footer, 'LAT'); break;
    case 'LON':   fpRenderCoord(area, title, footer, 'LON'); break;
    case 'IFR':   fpRenderIfr(area, title, footer);  break;
    case 'SIDNEW': fpRenderSidNew(area, title, footer); break;
    case 'HOLD':  fpRenderHold(area, title, footer);  break;
    case 'WPT':   fpRenderWpt(area, title, footer);   break;
    case 'WPTNUM': fpRenderWptNum(area, title, footer); break;
    case 'RB':    fpRenderRadial(area, title, footer); break;
    case 'RR':    fpRenderRadial(area, title, footer); break;
    case 'REFPICK': fpRenderRefPick(area, title, footer); break;
    case 'REFNUM':  fpRenderRefNum(area, title, footer);  break;
  }
}

// ══════════════════════════════════════════════════════
// 참조점 기준 좌표 산출 (BRG/DIST · BRG/BRG)
// ══════════════════════════════════════════════════════
// 두 대권(참조점 + 방위)의 교점. 방위는 모두 진북 기준.
// (movable-type.co.uk/scripts/latlong.html 의 intersection 공식)
function radialIntersect(la1, lo1, brg13, la2, lo2, brg23) {
  const f1 = la1 * D2R, l1 = lo1 * D2R, f2 = la2 * D2R, l2 = lo2 * D2R;
  const t13 = brg13 * D2R, t23 = brg23 * D2R;
  const df = f2 - f1, dl = l2 - l1;
  const d12 = 2 * Math.asin(Math.sqrt(Math.sin(df/2)**2 +
              Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2)**2));
  if (Math.abs(d12) < 1e-12) return null;                 // 같은 지점
  let ca = (Math.sin(f2) - Math.sin(f1) * Math.cos(d12)) / (Math.sin(d12) * Math.cos(f1));
  let cb = (Math.sin(f1) - Math.sin(f2) * Math.cos(d12)) / (Math.sin(d12) * Math.cos(f2));
  const ta = Math.acos(Math.min(1, Math.max(-1, ca)));
  const tb = Math.acos(Math.min(1, Math.max(-1, cb)));
  const t12 = Math.sin(dl) > 0 ? ta : 2 * Math.PI - ta;
  const t21 = Math.sin(dl) > 0 ? 2 * Math.PI - tb : tb;
  const a1 = t13 - t12, a2 = t21 - t23;
  if (Math.sin(a1) === 0 && Math.sin(a2) === 0) return null;   // 무수히 많음
  if (Math.sin(a1) * Math.sin(a2) < 0) return null;            // 교점이 대척점 쪽
  const a3 = Math.acos(Math.min(1, Math.max(-1,
             -Math.cos(a1) * Math.cos(a2) + Math.sin(a1) * Math.sin(a2) * Math.cos(d12))));
  const d13 = Math.atan2(Math.sin(d12) * Math.sin(a1) * Math.sin(a2),
                         Math.cos(a2) + Math.cos(a1) * Math.cos(a3));
  const f3 = Math.asin(Math.min(1, Math.max(-1,
             Math.sin(f1) * Math.cos(d13) + Math.cos(f1) * Math.sin(d13) * Math.cos(t13))));
  const dl13 = Math.atan2(Math.sin(t13) * Math.sin(d13) * Math.cos(f1),
                          Math.cos(d13) - Math.sin(f1) * Math.sin(f3));
  const l3 = l1 + dl13;
  return [f3 / D2R, normA((l3 / D2R) + 540) - 180];
}

let fpRefMode = 'RB';            // 'RB' = 참조점+방위+거리, 'RR' = 두 방위 교점
let fpRefSlot = 1;               // 참조점 선택 중인 슬롯(1·2)
let fpRefQ = '';                 // 참조점 검색어
let fpRefCat = 'ALL';            // ALL | VOR | FIX | APT | FPL
let fpRef = { r1: null, b1: 360, d1: 10, r2: null, b2: 360 };

function fpRefOpen(mode) {
  fpRefMode = mode;
  if (!fpRef.r1) fpRefQ = '';
  fpGo(mode);
}
// 참조점 후보 — 비행계획 WP · VOR · 공항 · AIP 픽스
function fpRefCandidates() {
  const out = [], seen = new Set();
  const vorIds = new Set(ENR_VORS.map(v => v.id));
  const add = (ident, lat, lon, cat, name) => {
    if (!ident || lat == null || lon == null) return;
    const k = cat + ':' + ident;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ident, lat, lon, cat, name: name || '' });
  };
  S.wps.forEach(w => add(w.ident, w.lat, w.lon, 'FPL'));
  ENR_VORS.forEach(v => add(v.id, v.lat, v.lon, 'VOR', v.name + ' · ' + v.freq));
  AIRPORTS.forEach(a => add(a.ident, a.lat, a.lon, 'APT', a.name));
  Object.entries(IFR_FIXES).forEach(([k, v]) => {
    if (!vorIds.has(k)) add(k, v.lat, v.lon, 'FIX');
  });
  return out;
}
function fpRefPick(slot) { fpRefSlot = slot; fpRefQ = ''; fpGo('REFPICK'); }
function fpRefChoose(cat, ident) {
  const c = fpRefCandidates().find(x => x.cat === cat && x.ident === ident);
  if (c) fpRef[fpRefSlot === 2 ? 'r2' : 'r1'] = { ident: c.ident, lat: c.lat, lon: c.lon, cat: c.cat };
  fpGo(fpRefMode);
}
function fpRefType(ch) { if (fpRefQ.length < 6) { fpRefQ += ch; fpRender(); } }
function fpRefBksp()   { fpRefQ = fpRefQ.slice(0, -1); fpRender(); }
function fpRefSetCat(c) { fpRefCat = c; fpRender(); }
// 방위·거리도 좌표와 같은 방식으로 넣는다 — 화살표로 한 칸씩 밀지 않고,
// 값을 눌러 숫자판에 직접 친다. 입력 방식이 화면마다 다르면 손이 헷갈린다.
let fpRefNumFld = null;   // 'b1' | 'd1' | 'b2'
function fpRefNum(fld) {
  fpRefNumFld = fld; fpInputBuf = '';
  fpGo('REFNUM');
}
const FP_REF_NUM = {
  b1: { lbl: '방위 (RADIAL)',    unit: '°M', hint: '참조점에서 바깥으로 향하는 자북 방위. 0 ~ 360',
        min: 0, max: 360 },
  b2: { lbl: '방위 #2 (RADIAL)', unit: '°M', hint: '참조점 #2 에서 바깥으로 향하는 자북 방위. 0 ~ 360',
        min: 0, max: 360 },
  d1: { lbl: '거리 (DISTANCE)',  unit: 'NM', hint: '참조점에서 그 방위로 나아갈 거리. 0.1 ~ 400 NM',
        min: 0.1, max: 400 },
};
function fpRenderRefNum(area, title, footer) {
  const c = FP_REF_NUM[fpRefNumFld];
  if (!c) { fpGo(fpRefMode); return; }
  title.textContent = c.lbl;
  const cur = fpRefNumFld === 'd1' ? fpRef.d1.toFixed(1) : String(Math.round(fpRef[fpRefNumFld])).padStart(3,'0');
  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px;">
      <div style="font-size:8px;color:#87ceeb;">${c.hint}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="fp-disp-box">${fpInputBuf || `<span style="color:#222">${cur}</span>`}<span class="fp-disp-cursor">|</span></div>
        <div class="fp-bksp-btn" data-act="fpBksp">⬅<br><span style="font-size:8px;">BKSP</span></div>
      </div>
      <div class="fp-numpad-grid">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="fp-num-circ" data-act="fpType" data-arg='["${n}"]'>${n}</div>`).join('')}
        <div class="fp-num-circ" data-act="fpType" data-arg='["."]'>.</div>
        <div class="fp-num-circ" data-act="fpType" data-arg='["0"]'>0</div>
        <div class="fp-num-circ" data-act="fpRefNumClr">CLR</div>
      </div>
    </div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" onclick="fpGo('${fpRefMode}')"><span>↩</span>Cancel</div>
    <div class="fp-nav-btn fp-nav-enter" data-act="fpConfirmRefNum"><span>↩</span>Enter</div>`;
}
function fpRefNumClr() { fpInputBuf = ''; fpRender(); }
function fpConfirmRefNum() {
  const c = FP_REF_NUM[fpRefNumFld];
  if (!c) { fpGo(fpRefMode); return; }
  const v = parseFloat(fpInputBuf);
  if (isNaN(v)) { uiAlert('숫자를 입력하세요'); return; }
  if (v < c.min || v > c.max) { uiAlert(`${c.lbl} 범위: ${c.min} ~ ${c.max}${c.unit}`); return; }
  // 방위는 정수 1~360 으로 보관한다(0 은 360 과 같은 각이다)
  fpRef[fpRefNumFld] = (fpRefNumFld === 'd1')
    ? Math.round(v * 10) / 10
    : ((Math.round(v) + 359) % 360) + 1;
  fpInputBuf = ''; fpRefNumFld = null;
  fpGo(fpRefMode);
}
// 현재 입력으로 산출되는 좌표 — { lat, lon, ident } 또는 { err }
function fpRefSolve() {
  const r1 = fpRef.r1;
  if (!r1) return { err: '참조점 #1 을 고르세요' };
  if (fpRefMode === 'RB') {
    if (!(fpRef.d1 > 0)) return { err: '거리를 입력하세요' };
    const p = destPoint(r1.lat, r1.lon, toTrue(fpRef.b1), fpRef.d1);
    return { lat: p[0], lon: p[1],
             ident: `${r1.ident}${String(fpRef.b1).padStart(3,'0')}/${fpRef.d1}` };
  }
  const r2 = fpRef.r2;
  if (!r2) return { err: '참조점 #2 를 고르세요' };
  if (distance(r1.lat, r1.lon, r2.lat, r2.lon) < 0.05) return { err: '두 참조점이 같습니다' };
  const t1 = toTrue(fpRef.b1), t2 = toTrue(fpRef.b2);
  const p = radialIntersect(r1.lat, r1.lon, t1, r2.lat, r2.lon, t2);
  if (!p) return { err: '두 방위선이 만나지 않습니다 (평행하거나 같은 대권)' };
  // 대권은 지구 반대편에서도 만난다. 입력한 방위 쪽(전방)에 있고 실용 범위 안인
  // 교점만 받아들인다.
  const d1 = distance(r1.lat, r1.lon, p[0], p[1]);
  const d2 = distance(r2.lat, r2.lon, p[0], p[1]);
  const f1 = Math.abs(normAS(bearing(r1.lat, r1.lon, p[0], p[1]) - t1));
  const f2 = Math.abs(normAS(bearing(r2.lat, r2.lon, p[0], p[1]) - t2));
  if (f1 > 1 || f2 > 1)
    return { err: '두 방위선이 입력한 방향 앞쪽에서 만나지 않습니다 (반대편 교점)' };
  if (d1 > 600 || d2 > 600)
    return { err: `교점이 너무 멉니다 (${Math.round(Math.max(d1,d2))}NM) — 방위를 확인하세요` };
  // 교차각(cut angle) — 얕으면 좌표 오차가 크게 튄다
  const cut = Math.abs(normAS(bearing(p[0], p[1], r1.lat, r1.lon) -
                              bearing(p[0], p[1], r2.lat, r2.lon)));
  const cutA = Math.min(cut, 180 - cut);
  if (cutA < 10)
    return { err: `두 방위선의 교차각이 ${cutA.toFixed(0)}° 로 너무 얕습니다 (10° 이상 필요)` };
  return { lat: p[0], lon: p[1], ident: `${r1.ident}/${r2.ident}`,
           cut: cutA,
           warn: cutA < 30 ? `교차각 ${cutA.toFixed(0)}° — 얕은 각도라 좌표 오차가 커질 수 있습니다` : '' };
}
function fpRefApply() {
  const s = fpRefSolve();
  if (s.err) { uiAlert(s.err); return; }
  fpMode = 'LIST';
  pushWP({ ident: s.ident, lat: +s.lat.toFixed(6), lon: +s.lon.toFixed(6) });
  fpRender();
}

function _refBtnHtml(slot) {
  const r = slot === 2 ? fpRef.r2 : fpRef.r1;
  return `<div class="hold-btn${r ? ' on' : ''}" style="text-align:left;padding-left:8px;"
            onclick="fpRefPick(${slot})">${r ? r.cat + ' · ' + r.ident : '▸ 참조점 선택'}</div>`;
}
// 값 칸 — 누르면 숫자판이 열린다(참조점 고르는 칸과 같은 생김새)
function _refNumHtml(key) {
  const v = fpRef[key];
  const txt = key === 'd1' ? (Math.round(v*10)/10).toFixed(1) + ' NM'
                           : String(Math.round(v)).padStart(3,'0') + '°M';
  return `<div class="hold-btn on" style="text-align:left;padding-left:8px;flex:1;"
            data-act="fpRefNum" data-arg='["${key}"]'>${txt} <span style="color:#5a7484;">▸ 입력</span></div>`;
}

function fpRenderRadial(area, title, footer) {
  const rb = fpRefMode === 'RB';
  title.textContent = rb ? 'WPT — 방위/거리' : 'WPT — 방위/방위 교점';
  const s = fpRefSolve();
  const okHtml = s.err
    ? `<div style="color:#e8a;font-size:11px;padding:6px 2px;">⚠ ${s.err}</div>`
    : `<div style="color:#0f8;font-size:11px;padding:6px 2px;line-height:1.7;">
         <b style="color:#ffcc44;font-size:13px;">${s.ident}</b><br>
         ${decToDMS(s.lat, true)} ${decToDMS(s.lon, false)}<br>
         <span style="color:#678;">${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</span><br>
         <span style="color:#678;">현 위치에서 ${fmtA(toMag(bearing(S.lat,S.lon,s.lat,s.lon)))}°M ·
         ${distance(S.lat,S.lon,s.lat,s.lon).toFixed(1)}NM${s.cut ? ' · 교차각 ' + s.cut.toFixed(0) + '°' : ''}</span>
         ${s.warn ? `<br><span style="color:#e8a;">⚠ ${s.warn}</span>` : ''}
       </div>`;
  area.innerHTML = `
    <div class="fp-panel-border" style="padding:8px;">
      <div class="hold-row"><div class="hold-lbl">REF ${rb ? '' : '#1'}</div>${_refBtnHtml(1)}</div>
      <div class="hold-row"><div class="hold-lbl">BRG ${rb ? '' : '#1'}</div>${_refNumHtml('b1')}</div>
      ${rb ? `<div class="hold-row"><div class="hold-lbl">DIST</div>${_refNumHtml('d1')}</div>`
          : `<div class="hold-row"><div class="hold-lbl">REF #2</div>${_refBtnHtml(2)}</div>
             <div class="hold-row"><div class="hold-lbl">BRG #2</div>${_refNumHtml('b2')}</div>`}
      <div style="border-top:1px solid #1a2a3a;margin-top:6px;">${okHtml}</div>
      <div style="color:#567;font-size:9px;line-height:1.6;">
        방위는 <b>참조점에서 바깥으로 향하는 자북 방위</b>(라디얼)입니다.
        ${rb ? '참조점에서 그 방위로 지정 거리만큼 나아간 지점을 만듭니다.'
             : '두 참조점의 방위선이 만나는 지점을 대권 기하로 계산합니다.'}
      </div>
    </div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["ADD"]'><span>↩</span>Back</div>
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>📋</span>FP</div>
    <div class="fp-nav-btn fp-nav-enter" data-act="fpRefApply"><span>↩</span>Enter</div>`;
}

function fpRenderRefPick(area, title, footer) {
  title.textContent = `참조점 선택 ${fpRefMode === 'RR' ? '#' + fpRefSlot : ''}`;
  const q = fpRefQ.toUpperCase();
  let list = fpRefCandidates()
    .filter(c => (fpRefCat === 'ALL' || c.cat === fpRefCat) && (!q || c.ident.indexOf(q) === 0));
  list.forEach(c => c._d = distance(S.lat, S.lon, c.lat, c.lon));
  list.sort((a, b) => a._d - b._d);
  const shown = list.slice(0, 40);
  const cats = ['ALL','VOR','FIX','APT','FPL'];
  const rows = shown.map(c => `
    <div class="fp-wp-row" style="grid-template-columns:34px 1fr 60px;"
         onclick="fpRefChoose('${c.cat}','${c.ident}')">
      <span style="font-size:8px;color:#87ceeb;">${c.cat}</span>
      <span class="fp-wp-ident">${c.ident}<span style="color:#567;font-size:9px;font-weight:normal;">
        ${c.name ? ' · ' + c.name : ''}</span></span>
      <span class="fp-wp-dist">${c._d.toFixed(0)}NM</span>
    </div>`).join('') ||
    `<div style="color:#678;font-size:10px;padding:10px 4px;">일치하는 참조점이 없습니다.</div>`;
  area.innerHTML = `
    <div style="display:flex;gap:4px;margin-bottom:5px;">
      ${cats.map(c => `<div class="hold-btn${fpRefCat===c?' on':''}"
         onclick="fpRefSetCat('${c}')">${c}</div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
      <div class="fp-disp-box" style="flex:1;">${fpRefQ || '<span style="color:#222">검색</span>'}</div>
      <div class="fp-bksp-btn" data-act="fpRefBksp">⬅</div>
    </div>
    <div class="fp-key-grid" style="grid-template-columns:repeat(9,1fr);gap:3px;">
      ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map(k =>
        `<div class="fp-key" style="height:26px;font-size:11px;" onclick="fpRefType('${k}')">${k}</div>`).join('')}
    </div>
    <div class="fp-panel-border" style="padding:0;margin-top:5px;max-height:230px;overflow-y:auto;">
      ${rows}
    </div>
    <div style="color:#567;font-size:9px;padding:3px 2px;">${list.length}개 중 가까운 순 ${shown.length}개</div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" onclick="fpGo('${fpRefMode}')"><span>↩</span>Back</div>`;
}

// ══════════════════════════════════════════════════════
// 홀딩 패턴 설정 (비행계획 웨이포인트별)
// ══════════════════════════════════════════════════════
let fpHoldIdx = -1;
let fpHoldDraft = null;    // { dir, crsM, legType, legVal }
const HOLD_TIMES = [30, 60, 90, 120, 150, 180];

function fpHoldOpen(i) {
  if (i < 0 || i >= S.wps.length) return;
  const h = S.wps[i].hold;
  fpHoldIdx = i;
  fpHoldDraft = h
    ? { dir: h.dir === 'L' ? 'L' : 'R', crsM: Math.round(toMag(h.crs)),
        legType: h.legType === 'DIST' ? 'DIST' : 'TIME',
        legVal: h.legVal || (h.legType === 'DIST' ? 5 : 60) }
    : { dir: 'R', crsM: holdDefaultCrsMag(i), legType: 'TIME', legVal: 60 };
  fpGo('HOLD');
}
function fpHoldSet(k, v) {
  if (!fpHoldDraft) return;
  if (k === 'legType') {
    fpHoldDraft.legType = v;
    fpHoldDraft.legVal = (v === 'DIST') ? 5 : 60;   // 기본값으로 되돌린다
  } else fpHoldDraft[k] = v;
  fpRender();
}
function fpHoldCrsAdj(d) {
  if (!fpHoldDraft) return;
  fpHoldDraft.crsM = ((Math.round(fpHoldDraft.crsM) + d + 359) % 360) + 1;
  fpRender();
}
function fpHoldLegAdj(d) {
  if (!fpHoldDraft) return;
  if (fpHoldDraft.legType === 'DIST') {
    fpHoldDraft.legVal = Math.max(1, Math.min(20, fpHoldDraft.legVal + d));
  } else {
    const i = HOLD_TIMES.indexOf(fpHoldDraft.legVal);
    const j = Math.max(0, Math.min(HOLD_TIMES.length - 1, (i < 0 ? 1 : i) + Math.sign(d)));
    fpHoldDraft.legVal = HOLD_TIMES[j];
  }
  fpRender();
}
function fpHoldApply() {
  if (fpHoldIdx < 0 || fpHoldIdx >= S.wps.length || !fpHoldDraft) { fpGo('LIST'); return; }
  S.wps[fpHoldIdx].hold = {
    dir: fpHoldDraft.dir,
    crs: toTrue(fpHoldDraft.crsM),          // 입력은 자북, 저장은 진북
    legType: fpHoldDraft.legType,
    legVal: fpHoldDraft.legVal,
  };
  holdExit();                                // 새 설정으로 다시 무장되게 초기화
  try { updateHoldLine(); updateNav(); } catch(e) { _swallow(e); }
  fpGo('LIST');
}
function fpHoldRemove() {
  if (fpHoldIdx >= 0 && fpHoldIdx < S.wps.length) delete S.wps[fpHoldIdx].hold;
  holdExit();
  try { updateHoldLine(); updateNav(); } catch(e) { _swallow(e); }
  fpGo('LIST');
}

function fpRenderHold(area, title, footer) {
  const wp = S.wps[fpHoldIdx];
  if (!wp || !fpHoldDraft) { fpGo('LIST'); return; }
  const d = fpHoldDraft;
  title.textContent = 'HOLDING — ' + (wp.ident || 'WPT');
  const legTxt = d.legType === 'DIST' ? d.legVal + ' NM'
                                      : (d.legVal >= 60 ? (d.legVal / 60) + ':' + String(d.legVal % 60).padStart(2,'0')
                                                        : d.legVal + 's');
  // 예상 패턴 크기 — 현재 속도 기준
  const R = navTurnRadiusNM();
  const legNM = d.legType === 'DIST' ? d.legVal : Math.max(20, groundSpdKt()) / 3600 * d.legVal;
  area.innerHTML = `
    <div class="fp-panel-border" style="padding:8px;">
      <div class="hold-row">
        <div class="hold-lbl">TURN</div>
        <div class="hold-seg">
          <div class="hold-btn${d.dir==='L'?' on':''}" data-act="fpHoldSet" data-arg='["dir", "L"]'>◄ LEFT</div>
          <div class="hold-btn${d.dir==='R'?' on':''}" data-act="fpHoldSet" data-arg='["dir", "R"]'>RIGHT ►</div>
        </div>
      </div>
      <div class="hold-row">
        <div class="hold-lbl">INBD CRS</div>
        <div class="hold-spin">
          <div class="hold-btn" data-act="fpHoldCrsAdj" data-arg='[-10]'>≪</div>
          <div class="hold-btn" data-act="fpHoldCrsAdj" data-arg='[-1]'>◄</div>
          <div class="hold-val">${String(d.crsM).padStart(3,'0')}°M</div>
          <div class="hold-btn" data-act="fpHoldCrsAdj" data-arg='[1]'>►</div>
          <div class="hold-btn" data-act="fpHoldCrsAdj" data-arg='[10]'>≫</div>
        </div>
      </div>
      <div class="hold-row">
        <div class="hold-lbl">LEG</div>
        <div class="hold-seg">
          <div class="hold-btn${d.legType==='TIME'?' on':''}" data-act="fpHoldSet" data-arg='["legType", "TIME"]'>TIME</div>
          <div class="hold-btn${d.legType==='DIST'?' on':''}" data-act="fpHoldSet" data-arg='["legType", "DIST"]'>DIST</div>
        </div>
      </div>
      <div class="hold-row">
        <div class="hold-lbl">${d.legType==='DIST'?'거리':'시간'}</div>
        <div class="hold-spin">
          <div class="hold-btn" data-act="fpHoldLegAdj" data-arg='[-1]'>▼</div>
          <div class="hold-val">${legTxt}</div>
          <div class="hold-btn" data-act="fpHoldLegAdj" data-arg='[1]'>▲</div>
        </div>
      </div>
      <div style="color:#567;font-size:9px;line-height:1.6;margin-top:8px;border-top:1px solid #1a2a3a;padding-top:6px;">
        선회반경 ${R.toFixed(2)}NM · 아웃바운드 ${legNM.toFixed(1)}NM · 패턴 폭 ${(2*R).toFixed(2)}NM
        (현재 지상속도 ${Math.round(groundSpdKt())}kt 기준)<br>
        ENTER 하면 지도에 패턴이 그려지고, <b>NAV 오토파일럿</b>이 이 웨이포인트를 활성으로 잡았을 때
        <b>진입 규칙(직진 / 평행 / 눈물방울)</b>에 따라 자동으로 진입해 홀딩을 돕니다.
        홀딩을 빠져나가려면 <b>DEL HOLD</b> 로 지우세요.
      </div>
    </div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>↩</span>Cancel</div>
    ${wp.hold ? `<div class="fp-nav-btn" data-act="fpHoldRemove"><span>✕</span>Del Hold</div>` : ''}
    <div class="fp-nav-btn fp-nav-enter" data-act="fpHoldApply"><span>↩</span>Enter</div>`;
}

function fpRenderList(area, title, footer) {
  title.textContent = 'ACTIVE FLIGHT PLAN';
  if (S.wps.length === 0) {
    area.innerHTML = `<div class="fp-empty-state">
      <div class="fp-empty-label">FLIGHT PLAN EMPTY</div>
      <button class="fp-empty-btn" data-act="fpGo" data-arg='["ADD"]'>＋ Add Origin</button>
      <button class="fp-empty-btn" data-act="fpGo" data-arg='["ADD"]'>＋ Add Enroute Waypoint</button>
      <button class="fp-empty-btn" data-act="fpGo" data-arg='["ADD"]'>＋ Add Destination</button>
    </div>`;
  } else {
    let html = `<div class="fp-panel-border" style="padding:0;overflow-y:auto;">`;
    html += `<div class="fp-section-hdr"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="#87ceeb" stroke-width="1.2"/></svg>Origin – ${S.wps[0].ident}</div>`;
    S.wps.forEach((wp,i)=>{
      const isA=i===S.awp, isB2=i===S.brg2wp;
      let cls='fp-wp-row'+(isA?' active-wp':'')+(isB2?' brg2-wp':'');
      const d=distance(S.lat,S.lon,wp.lat,wp.lon), b=bearing(S.lat,S.lon,wp.lat,wp.lon);
      const badge=wp.phase?`<span class="fp-phase-badge badge-${wp.phase.toLowerCase()}">${wp.phase}</span>`:'';
      html+=`<div class="${cls}" data-act="fpWptOpen" data-arg='[${i}]'>
        <span class="fp-wp-seq">${i+1}</span>
        <span class="fp-wp-ident">${badge}${wp.ident}</span>
        <span class="fp-wp-hdg">${fmtA(toMag(b))}°</span>
        <span class="fp-wp-dist">${d.toFixed(0)}NM</span>
        <button class="fp-wp-hold${wp.hold?' active':''}" onclick="event.stopPropagation();fpHoldOpen(${i})" title="홀딩 패턴">HOLD</button>
        <button class="fp-wp-b2${isB2?' active':''}" onclick="event.stopPropagation();setBrg2(${i})">B2</button>
        <button class="fp-wp-del" onclick="event.stopPropagation();removeWP(${i})">✕</button>
      </div>`;
    });
    if(S.wps.length>1) html+=`<div class="fp-section-hdr"><svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,9 1,9" fill="none" stroke="#87ceeb" stroke-width="1.2"/></svg>Destination – ${S.wps[S.wps.length-1].ident}</div>`;
    html+=`</div>`;
    area.innerHTML = html;
  }
  const fullBtn = _soloActive
    ? `<div class="fp-nav-btn" data-act="exitSolo"><span>✥</span>Half</div>`
    : `<div class="fp-nav-btn" data-act="planFullScreen"><span>✥</span>Full</div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGoCduHome"><span>🏠</span>Home</div>
    ${fullBtn}
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["ADD"]'><span>＋</span>Add WPT</div>
    <div class="fp-nav-btn" data-act="clearFP"><span>✕</span>Clr</div>
    <div class="fp-nav-btn" data-act="resetSim"><span>⟳</span>Rst</div>
    <div class="fp-nav-btn" data-act="fpBackToCdu"><span>↩</span>Back</div>`;
}

// ══════════════════════════════════════════════════════
// 웨이포인트 상세 (목록에서 항목을 누르면 열린다)
// ══════════════════════════════════════════════════════
// 종전에는 항목을 누르면 곧바로 활성 웨이포인트가 됐다. 되돌릴 방법도 없고,
// 이름·좌표를 고치거나 VNAV 를 걸 자리도 없었다. 한 번 눌러 카드를 펴고,
// 거기서 고르게 한다 — Direct To 도 그 카드 안의 버튼 하나다.
function fpWptOpen(i) {
  if (i < 0 || i >= S.wps.length) return;
  fpWptIdx = i;
  fpGo('WPT');
}

function fpRenderWpt(area, title, footer) {
  const i = fpWptIdx, wp = S.wps[i];
  if (!wp) { fpGo('LIST'); return; }
  title.textContent = 'WAYPOINT — ' + (wp.ident || 'WPT');

  const b = bearing(S.lat, S.lon, wp.lat, wp.lon);
  const d = distance(S.lat, S.lon, wp.lat, wp.lon);
  // 이 지점으로 들어오는 레그 코스(직전 웨이포인트 기준). 첫 지점은 현재 위치에서.
  const from = i > 0 ? S.wps[i - 1] : { lat: S.lat, lon: S.lon };
  const legCrs = fmtA(toMag(bearing(from.lat, from.lon, wp.lat, wp.lon)));
  const isA = i === S.awp, isB2 = i === S.brg2wp;
  const hold = wp.hold;
  const holdTxt = hold
    ? `${String(Math.round(toMag(hold.crs))).padStart(3,'0')}° ${hold.dir === 'L' ? '좌' : '우'}`
    : '— — —';
  const vAlt = Number.isFinite(wp.vnavAlt) ? Math.round(wp.vnavAlt).toLocaleString() + ' FT' : '— — —';
  const vOfs = Number.isFinite(wp.vnavOfs) && wp.vnavOfs ? wp.vnavOfs.toFixed(1) + ' NM' : '0 NM';

  // 카드 안의 버튼 — 위 라벨(작게) + 아래 값(크게)
  const CARD = (lbl, val, act, arg, on) =>
    `<div data-act="${act}"${arg !== undefined ? ` data-arg='${arg}'` : ''} style="` +
    `padding:6px 4px;border:1px solid ${on ? '#00cfff' : '#2a3a4a'};border-radius:5px;` +
    `background:${on ? '#00252e' : '#0a1218'};cursor:pointer;text-align:center;">` +
    `<div style="color:#6a8494;font-size:8px;letter-spacing:0.5px;">${lbl}</div>` +
    `<div style="color:${on ? '#00e5ff' : '#dfeaf2'};font-size:12px;font-weight:bold;margin-top:2px;">${val}</div>` +
    `</div>`;

  area.innerHTML =
    `<div class="fp-panel-border" style="padding:8px;">` +
      // ── 이름·좌표 ──
      `<div data-act="fpWptRename" style="cursor:pointer;display:flex;align-items:baseline;gap:6px;">` +
        `<span style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px;">${wp.ident || 'WPT'}</span>` +
        `<span style="color:#00cfff;font-size:9px;">✎ 이름</span>` +
        (wp.phase ? `<span class="fp-phase-badge badge-${wp.phase.toLowerCase()}">${wp.phase}</span>` : '') +
      `</div>` +
      `<div data-act="fpWptCoord" style="cursor:pointer;color:#8fb8bf;font-size:10px;margin-top:3px;">` +
        `${decToDMS(wp.lat, true)} ${decToDMS(wp.lon, false)} <span style="color:#00cfff;">✎</span></div>` +
      `<div style="color:#6a8494;font-size:10px;margin-top:5px;">` +
        `현재 위치에서 <b style="color:#c8ff00;">${fmtA(toMag(b))}°</b>` +
        ` · <b style="color:#00ffff;">${uDist(d)}</b></div>` +

      // ── 설정 ──
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:9px;">` +
        CARD('VNAV 고도', vAlt, 'fpWptNum', '["VALT"]', Number.isFinite(wp.vnavAlt)) +
        CARD('VNAV 오프셋', vOfs, 'fpWptNum', '["VOFS"]', !!wp.vnavOfs) +
        CARD('레그 코스', legCrs + '°M', 'fpWptNoop') +
        CARD('HOLD', holdTxt, 'fpHoldOpen', `[${i}]`, !!hold) +
      `</div>` +

      // ── 동작 ──
      `<div data-act="fpWptDirect" style="margin-top:9px;padding:9px;border-radius:5px;cursor:pointer;` +
        `text-align:center;font-size:13px;font-weight:bold;letter-spacing:1px;` +
        `background:${isA ? '#0e2e0e' : '#0e2233'};border:1px solid ${isA ? '#44cc44' : '#2a6a8a'};` +
        `color:${isA ? '#7fe07f' : '#7ac6f5'};">` +
        (isA ? `✔ 활성 — ${wp.ident || 'WPT'}` : `➤ Direct To ${wp.ident || 'WPT'}`) + `</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px;">` +
        CARD('BRG2 지시침', isB2 ? '지정됨' : '지정', 'fpWptBrg2', undefined, isB2) +
        `<div data-act="fpWptDel" style="padding:6px 4px;border:1px solid #663333;border-radius:5px;` +
          `background:#1a0a0a;cursor:pointer;text-align:center;">` +
          `<div style="color:#8a6a6a;font-size:8px;letter-spacing:0.5px;">비행계획에서</div>` +
          `<div style="color:#ff6666;font-size:12px;font-weight:bold;margin-top:2px;">✕ 삭제</div></div>` +
      `</div>` +
      `<div style="color:#445;font-size:8px;line-height:1.6;margin-top:8px;border-top:1px solid #1a2a30;padding-top:6px;">` +
        `VNAV 고도를 넣으면 이 지점이 활성일 때 그 고도를 목표로 강하선을 그립니다.` +
        ` 오프셋은 <b>지점보다 몇 NM 앞에서</b> 그 고도에 닿을지입니다.</div>` +
    `</div>`;

  footer.innerHTML =
    `<div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>📋</span>FP List</div>` +
    `<div class="fp-nav-btn" data-act="fpGo" data-arg='["ADD"]'><span>＋</span>Add WPT</div>` +
    `<div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>↩</span>Back</div>`;
}

function fpWptNoop() { /* 레그 코스는 읽기 전용 — 앞뒤 지점에서 저절로 정해진다 */ }

function fpWptDirect() {
  if (fpWptIdx < 0 || fpWptIdx >= S.wps.length) return;
  selectWP(fpWptIdx);
  fpGo('LIST');
}
function fpWptBrg2() {
  if (fpWptIdx < 0 || fpWptIdx >= S.wps.length) return;
  setBrg2(fpWptIdx);
  fpGo('WPT');
}
async function fpWptDel() {
  const wp = S.wps[fpWptIdx];
  if (!wp) return;
  if (!await uiConfirm(`${wp.ident || 'WPT'} 을(를) 비행계획에서 지웁니다.`,
                       { okText: '삭제', cancelText: '취소' })) return;
  removeWP(fpWptIdx);
  fpWptIdx = -1;
  fpGo('LIST');
}
function fpWptRename() {
  if (fpWptIdx < 0) return;
  fpEditIdx = fpWptIdx; fpInputBuf = '';
  fpGo('IDENT');
}
function fpWptCoord() {
  if (fpWptIdx < 0) return;
  fpEditIdx = fpWptIdx; fpInputBuf = ''; fpTempLat = null;
  fpGo('LAT');
}

// ── VNAV 고도·오프셋 입력 ──
function fpWptNum(fld) {
  fpNumFld = fld; fpInputBuf = '';
  fpGo('WPTNUM');
}
function fpRenderWptNum(area, title, footer) {
  const wp = S.wps[fpWptIdx];
  if (!wp) { fpGo('LIST'); return; }
  const isAlt = fpNumFld === 'VALT';
  title.textContent = (isAlt ? 'VNAV ALTITUDE' : 'VNAV OFFSET') + ' — ' + (wp.ident || 'WPT');
  const cur = isAlt ? (Number.isFinite(wp.vnavAlt) ? wp.vnavAlt : '') : (wp.vnavOfs || 0);
  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px;">
      <div style="font-size:8px;color:#87ceeb;">${isAlt
        ? '이 지점에서 목표로 할 고도(ft). 비우고 ENTER 하면 해제됩니다.'
        : '지점보다 몇 NM 앞에서 그 고도에 닿을지(NM).'}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="fp-disp-box">${fpInputBuf || `<span style="color:#222">${cur === '' ? '——' : cur}</span>`}<span class="fp-disp-cursor">|</span></div>
        <div class="fp-bksp-btn" data-act="fpBksp">⬅<br><span style="font-size:8px;">BKSP</span></div>
      </div>
      <div class="fp-numpad-grid">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="fp-num-circ" data-act="fpType" data-arg='["${n}"]'>${n}</div>`).join('')}
        <div class="fp-num-circ" data-act="fpType" data-arg='["."]'>.</div>
        <div class="fp-num-circ" data-act="fpType" data-arg='["0"]'>0</div>
        <div class="fp-num-circ" data-act="fpWptNumClr">CLR</div>
      </div>
    </div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["WPT"]'><span>↩</span>Cancel</div>
    <div class="fp-nav-btn fp-nav-enter" data-act="fpConfirmWptNum"><span>↩</span>Enter</div>`;
}
function fpWptNumClr() { fpInputBuf = ''; fpRender(); }
function fpConfirmWptNum() {
  const wp = S.wps[fpWptIdx];
  if (!wp) { fpGo('LIST'); return; }
  const txt = fpInputBuf.trim();
  const v = parseFloat(txt);
  if (fpNumFld === 'VALT') {
    // 비우고 ENTER = 해제. 없는 값을 0 으로 남겨 두면 "해면으로 강하" 가 된다.
    if (txt === '') delete wp.vnavAlt;
    else if (isNaN(v) || v < -1000 || v > 45000) { uiAlert('고도 범위: -1000 ~ 45000 ft'); return; }
    else { wp.vnavAlt = v; vnavActive = true; }
  } else {
    if (txt === '') delete wp.vnavOfs;
    else if (isNaN(v) || v < 0 || v > 50) { uiAlert('오프셋 범위: 0 ~ 50 NM'); return; }
    else wp.vnavOfs = v;
  }
  fpInputBuf = ''; fpNumFld = null;
  _fplPersist();
  try { updateTerrainCut(); } catch(e) { _swallow(e); }
  fpGo('WPT');
}

// 입력 방법을 먼저 고르고, 그 다음에 값을 넣는다.
// 종전에는 여섯 가지 버튼이 한 줄에 섞여 있어 "좌표로 넣을지 방위로 넣을지"를
// 고르는 일과 "어느 공항인지" 고르는 일이 같은 무게로 보였다. 넷으로 갈라 둔다.
const FP_ADD_MODES = [
  { id:'LATLON', act:'fpGo',      arg:'["LAT"]',  icon:'📍', name:'LAT/LON',
    sub:'좌표를 직접 넣는다' },
  { id:'RADDIS', act:'fpRefOpen', arg:'["RB"]',   icon:'⌖',  name:'RAD/DIS',
    sub:'기준점 · 방위 · 거리' },
  { id:'RADRAD', act:'fpRefOpen', arg:'["RR"]',   icon:'✛',  name:'RAD/RAD',
    sub:'두 기준점 방위의 교점' },
  { id:'PPOS',   act:'fpAddPP',   arg:undefined,  icon:'✈',  name:'P.POS',
    sub:'지금 있는 자리' },
];

function fpRenderAdd(area, title, footer) {
  title.textContent = 'ADD WAYPOINT';
  const mode = m =>
    `<div data-act="${m.act}"${m.arg ? ` data-arg='${m.arg}'` : ''} style="` +
    `display:flex;flex-direction:column;align-items:center;gap:2px;` +
    `padding:9px 4px;border:1px solid #2a5a7a;border-radius:5px;background:#0a1620;cursor:pointer;">` +
    `<div style="font-size:19px;line-height:1;color:#87ceeb;">${m.icon}</div>` +
    `<div style="color:#00cfff;font-size:12px;font-weight:bold;letter-spacing:0.5px;">${m.name}</div>` +
    `<div style="color:#5a7484;font-size:8px;">${m.sub}</div>` +
    `</div>`;
  const apBtns = FP_PRESETS.map(a =>
    `<button class="fp-ap-btn" data-act="fpAddPreset" data-arg='["${a.ident}"]' title="${a.name}">${a.ident}</button>`).join('');
  area.innerHTML = `
    <div style="color:#87ceeb;font-size:9px;font-weight:bold;letter-spacing:1px;margin-bottom:5px;">입력 방법</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      ${FP_ADD_MODES.map(mode).join('')}
    </div>
    <div style="color:#87ceeb;font-size:9px;font-weight:bold;letter-spacing:1px;margin:10px 0 5px;">그 밖의 방법</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div class="fp-input-type-btn fp-cyan" data-act="fpGo" data-arg='["IDENT"]'>
        <span style="font-size:18px;">⌨</span><span>IDENT</span>
      </div>
      <div class="fp-input-type-btn" data-act="fpGo" data-arg='["IFR"]'>
        <span style="font-size:16px;">✈</span><span>IFR 절차</span>
      </div>
    </div>
    <div style="color:#87ceeb;font-size:9px;font-weight:bold;letter-spacing:1px;margin:10px 0 5px;">국내 공항</div>
    <div class="fp-ap-grid">${apBtns}</div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>📋</span>FP List</div>
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>↩</span>Back</div>`;
}

// P.POS — 지금 있는 자리를 그대로 웨이포인트로. 넣자마자 상세 카드를 열어
// 이름·좌표를 다듬을 수 있게 한다(지도의 'PP 현재위치' 와 이름 규칙을 맞춘다).
function fpAddPP() {
  const n = S.wps.filter(w => /^PP\d*$/.test(w.ident)).length + 1;
  pushWP({ ident: 'PP' + n, lat: S.lat, lon: S.lon });
  fpWptOpen(S.wps.length - 1);
}

function fpAddPreset(ident) {
  const a = AIRPORTS.find(x=>x.ident===ident);
  if(a){ fpMode='LIST'; pushWP({ident:a.ident,lat:a.lat,lon:a.lon}); }
}

function fpRenderIdent(area, title, footer) {
  title.textContent = 'IDENT ENTRY';
  const disp = fpInputBuf || '';
  area.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div class="fp-disp-box">${disp||'<span style="color:#222">——</span>'}<span class="fp-disp-cursor">|</span></div>
      <div class="fp-bksp-btn" data-act="fpBksp">⬅<br><span style="font-size:8px;">BKSP</span></div>
    </div>
    <div class="fp-key-grid">
      ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map(k=>`<div class="fp-key" onclick="fpType('${k}')">${k}</div>`).join('')}
    </div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["ADD"]'><span>↩</span>Cancel</div>
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>📋</span>FP</div>
    <div class="fp-nav-btn fp-nav-enter" data-act="fpConfirmIdent"><span>↩</span>Enter</div>`;
}

function fpRenderCoord(area, title, footer, field) {
  title.textContent = field==='LAT' ? 'LATITUDE ENTRY' : 'LONGITUDE ENTRY';
  const hint = field==='LAT' ? '예: 37.4602 (또는 지도 탭)' : '예: 126.4407';
  const disp = fpInputBuf || '';
  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px;">
      <div style="font-size:8px;color:#87ceeb;">${hint}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="fp-disp-box">${disp||'<span style="color:#222">——</span>'}<span class="fp-disp-cursor">|</span></div>
        <div class="fp-bksp-btn" data-act="fpBksp">⬅<br><span style="font-size:8px;">BKSP</span></div>
      </div>
      <div class="fp-numpad-grid">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="fp-num-circ" onclick="fpType('${n}')">${n}</div>`).join('')}
        <div class="fp-num-circ" data-act="fpType" data-arg='["."]'>.</div>
        <div class="fp-num-circ" data-act="fpType" data-arg='["0"]'>0</div>
        <div class="fp-num-circ" data-act="fpType" data-arg='["-"]'>−</div>
      </div>
    </div>`;
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["ADD"]'><span>↩</span>Cancel</div>
    <div class="fp-nav-btn fp-nav-enter" onclick="fpConfirmCoord('${field}')"><span>↩</span>Enter</div>`;
}

function fpRenderIfr(area, title, footer) {
  title.textContent = 'IFR PROCEDURES';
  const tabs = ['DEP','ENR','APP'];
  const tabsHtml = tabs.map(t=>`<div class="fp-ifr-tab${fpIfrPhase===t.toLowerCase()?' active':''}" onclick="fpSetIfrPhase('${t.toLowerCase()}')">${t}</div>`).join('');
  let panelHtml = '';
  if(fpIfrPhase==='dep'){
    panelHtml=
      `<div class="fp-ifr-lbl">Departure Airport</div>` +
      `<select class="fp-ifr-sel" id="dep-icao" onchange="loadSids()"></select>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">` +
        `<div><div class="fp-ifr-lbl">RWY 필터</div><select class="fp-ifr-sel" id="dep-rwy" onchange="loadSids()"></select></div>` +
        `<div><div class="fp-ifr-lbl">추가 방식</div><select class="fp-ifr-sel" id="dep-mode">` +
          `<option value="append">현재 플랜 뒤에</option><option value="replace">플랜 비우고</option></select></div>` +
      `</div>` +
      `<div class="fp-ifr-lbl">SID Procedure</div>` +
      `<select class="fp-ifr-sel" id="dep-sid" onchange="onSidSelect()"></select>` +
      `<div id="sid-detail"></div>` +
      `<button class="fp-ifr-add" data-act="addSidWps">＋ ADD SID TO PLAN</button>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:4px;">` +
        `<div class="fp-ifr-add" style="margin:0;font-size:9px;" data-act="sidShowOnMap">🗺 지도</div>` +
        `<div class="fp-ifr-add" style="margin:0;font-size:9px;" data-act="fpGo" data-arg='["SIDNEW"]'>＋ 사용자 SID</div>` +
        `<div class="fp-ifr-add" style="margin:0;font-size:9px;" data-act="deleteUserSid">🗑 삭제</div>` +
      `</div>`;
  } else if(fpIfrPhase==='enr'){
    panelHtml=`<div class="fp-ifr-lbl">Airway</div><select class="fp-ifr-sel" id="enr-airway" onchange="loadAirwayFixes()"></select><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;"><div><div class="fp-ifr-lbl">Entry Fix</div><select class="fp-ifr-sel" id="enr-entry"></select></div><div><div class="fp-ifr-lbl">Exit Fix</div><select class="fp-ifr-sel" id="enr-exit"></select></div></div><button class="fp-ifr-add" data-act="addAirwaySegment">＋ ADD AIRWAY SEG</button><div class="fp-ifr-lbl" style="border-top:1px solid #152515;padding-top:5px;margin-top:5px;">Single Fix</div><select class="fp-ifr-sel" id="enr-fix"></select><button class="fp-ifr-add" data-act="addSingleFix">＋ ADD FIX</button>`;
  } else {
    panelHtml=`
      <div class="fp-ifr-lbl">Arrival Airport</div>
      <select class="fp-ifr-sel" id="app-icao" onchange="loadStars();loadApproaches()"></select>
      <div class="fp-ifr-lbl">STAR Procedure</div>
      <select class="fp-ifr-sel" id="app-star"></select>
      <button class="fp-ifr-add" data-act="addStarWps">＋ ADD STAR</button>
      <div style="border-top:1px solid #152515;margin:5px 0;"></div>
      <div class="fp-ifr-lbl">Approach Procedure</div>
      <select class="fp-ifr-sel" id="app-proc"></select>
      <button class="fp-ifr-add" data-act="addAppWps">＋ ADD APPROACH</button>`;
  }
  area.innerHTML = `<div class="fp-ifr-tab-row">${tabsHtml}</div><div class="fp-panel-border" style="overflow-y:auto;">${panelHtml}</div>`;
  // Populate selects dynamically
  if(fpIfrPhase==='dep'){
    const s=document.getElementById('dep-icao');
    // AIP 공개 공항 전체를 대상으로 한다(절차 미등록 공항도 사용자 SID 저장 가능)
    if(s&&s.options.length===0){
      aipAirportList().forEach(a=>{
        const has=(IFR_DB[a.icao]&&IFR_DB[a.icao].sids||[]).length + ((customSids()[a.icao]||[]).length);
        const o=document.createElement('option');o.value=a.icao;
        o.textContent=a.icao+' – '+a.name+(has?'':' (절차 없음)');
        s.appendChild(o);
      });
      loadSids();
    }
  } else if(fpIfrPhase==='enr'){
    const aw=document.getElementById('enr-airway');
    if(aw&&aw.options.length===0){
      Object.keys(IFR_AIRWAYS).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;aw.appendChild(o);});
      const fx=document.getElementById('enr-fix');
      Object.keys(IFR_FIXES).sort().forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;fx.appendChild(o);});
      loadAirwayFixes();
    }
  } else {
    const s=document.getElementById('app-icao');
    if(s&&s.options.length===0){Object.keys(IFR_DB).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k+' – '+IFR_DB[k].name;s.appendChild(o);});loadStars();loadApproaches();}
  }
  footer.innerHTML = `
    <div class="fp-nav-btn" data-act="fpGoCduHome"><span>🏠</span>Home</div>
    ${fpFullBtn()}
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>📋</span>FP</div>
    <div class="fp-nav-btn" data-act="fpGo" data-arg='["ADD"]'><span>↩</span>Back</div>`;
}

// ══════════════════════════════════════════════════════
// 사용자 정의 SID 만들기 (AIP 절차가 없는 공항도 사용 가능)
// ══════════════════════════════════════════════════════
let _sidNew = { icao:'', name:'', rwy:'', wps:[] };
function sidNewAddFix() {
  const f = document.getElementById('sn-fix')?.value;
  if (!f || !IFR_FIXES[f]) return;
  _sidNew.wps.push(f);
  fpRender();
}
function sidNewDelFix(i) { _sidNew.wps.splice(i, 1); fpRender(); }
function sidNewSave() {
  const icao = document.getElementById('sn-icao')?.value || '';
  const name = (document.getElementById('sn-name')?.value || '').trim().toUpperCase();
  const rwy  = (document.getElementById('sn-rwy')?.value || '').trim().toUpperCase();
  if (!icao)            { uiAlert('공항을 선택하세요.'); return; }
  if (!name)            { uiAlert('절차 이름을 입력하세요.'); return; }
  if (!_sidNew.wps.length) { uiAlert('경유점을 1개 이상 추가하세요.'); return; }
  const all = customSids();
  if (!all[icao]) all[icao] = [];
  all[icao].push({ name, rwy: rwy || '-', wps: _sidNew.wps.map(id => ({ ident:id })) });
  saveCustomSids(all);
  _sidNew = { icao:'', name:'', rwy:'', wps:[] };
  fpIfrPhase = 'dep';
  fpGo('IFR');
}
function fpRenderSidNew(area, title, footer) {
  title.textContent = '사용자 SID 만들기';
  // 직전 DEP 탭에서 고른 공항을 기본값으로
  if (!_sidNew.icao) _sidNew.icao = document.getElementById('dep-icao')?.value || '';
  const aptOpts = aipAirportList().map(a =>
    `<option value="${a.icao}"${a.icao === _sidNew.icao ? ' selected' : ''}>${a.icao} – ${a.name}</option>`).join('');
  const fixOpts = Object.keys(IFR_FIXES).sort().map(k => `<option value="${k}">${k}</option>`).join('');
  const chain = _sidNew.wps.length
    ? _sidNew.wps.map((id, i) =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;margin-bottom:3px;` +
        `border:1px solid #1e3a2a;border-radius:4px;background:#08140e;">` +
        `<span style="color:#9fe6c0;font-size:11px;font-weight:bold;">${i+1}. ${id}</span>` +
        `<span onclick="sidNewDelFix(${i})" style="color:#ff8a65;font-size:12px;cursor:pointer;padding:0 4px;">✕</span></div>`).join('')
    : `<div style="color:#567;font-size:10px;padding:6px 2px;">아래에서 픽스를 골라 순서대로 추가하세요.</div>`;
  area.innerHTML =
    `<div class="fp-panel-border" style="overflow-y:auto;">` +
      `<div class="fp-ifr-lbl">공항</div><select class="fp-ifr-sel" id="sn-icao">${aptOpts}</select>` +
      `<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:4px;">` +
        `<div><div class="fp-ifr-lbl">절차 이름</div>` +
          `<input id="sn-name" placeholder="예: BOPTA1D" style="width:100%;box-sizing:border-box;background:#08140e;` +
          `border:1px solid #2a4a3a;border-radius:3px;color:#9fe6c0;font-size:12px;font-weight:bold;padding:5px 6px;"></div>` +
        `<div><div class="fp-ifr-lbl">RWY</div>` +
          `<input id="sn-rwy" placeholder="06L/06R" style="width:100%;box-sizing:border-box;background:#08140e;` +
          `border:1px solid #2a4a3a;border-radius:3px;color:#9fe6c0;font-size:12px;font-weight:bold;padding:5px 6px;"></div>` +
      `</div>` +
      `<div class="fp-ifr-lbl" style="margin-top:6px;">경유점 순서 (${_sidNew.wps.length})</div>` +
      chain +
      `<div style="display:grid;grid-template-columns:1fr auto;gap:4px;margin-top:4px;">` +
        `<select class="fp-ifr-sel" id="sn-fix" style="margin:0;">${fixOpts}</select>` +
        `<div class="fp-ifr-add" style="margin:0;padding:6px 12px;" data-act="sidNewAddFix">＋</div>` +
      `</div>` +
      `<button class="fp-ifr-add" style="margin-top:8px;" data-act="sidNewSave">💾 절차 저장</button>` +
      `<div style="color:#4a6274;font-size:9px;margin-top:5px;line-height:1.4;">` +
        `저장한 절차는 SID 목록에 <b>★</b> 표시로 나타나며 기기에 보관됩니다.<br>` +
        `좌표는 픽스 이름으로 자동 해석되므로 따로 입력할 필요가 없습니다.</div>` +
    `</div>`;
  footer.innerHTML =
    `<div class="fp-nav-btn" data-act="fpGoCduHome"><span>🏠</span>Home</div>` +
    fpFullBtn() +
    `<div class="fp-nav-btn" data-act="fpGo" data-arg='["LIST"]'><span>📋</span>FP</div>` +
    `<div class="fp-nav-btn" data-act="fpGo" data-arg='["IFR"]'><span>↩</span>Back</div>`;
}

function fpSetIfrPhase(phase) {
  fpIfrPhase = phase;
  const area=document.getElementById('fp-content-area'), title=document.getElementById('fp-mode-title'), footer=document.getElementById('fp-footer-nav');
  fpRenderIfr(area, title, footer);
}

function fpType(k) { if(fpInputBuf.length<12) fpInputBuf+=k; fpRender(); }
function fpBksp() { fpInputBuf=fpInputBuf.slice(0,-1); fpRender(); }

function fpConfirmIdent() {
  const v = fpInputBuf.trim().toUpperCase();
  if(!v) return;
  // 이름 고치기 — 좌표는 그대로 두고 부르는 이름만 바꾼다.
  // (공항 목록에 없는 이름도 허용한다. 지도에서 찍은 지점에 이름을 붙이는 자리다)
  if (fpEditIdx >= 0 && fpEditIdx < S.wps.length) {
    S.wps[fpEditIdx].ident = v;
    fpInputBuf=''; fpEditIdx=-1;
    updateWpMarkers(); updateNav(); _fplPersist();
    fpGo('WPT');
    return;
  }
  const f = AIRPORTS.find(a=>a.ident===v);
  if(f){ fpMode='LIST'; fpInputBuf=''; pushWP({ident:f.ident,lat:f.lat,lon:f.lon}); }
  else uiAlert(`"${v}" not found.\nAvailable: ${AIRPORTS.map(a=>a.ident).join(', ')}`);
}

function fpConfirmCoord(field) {
  const val = parseDegrees(fpInputBuf);
  if(isNaN(val)){ uiAlert('유효한 값을 입력하세요'); return; }
  if(field==='LAT'){
    if(val<-90||val>90){ uiAlert('위도 범위: -90 ~ 90'); return; }
    fpTempLat=val; fpInputBuf=''; fpGo('LON');
  } else {
    if(val<-180||val>180){ uiAlert('경도 범위: -180 ~ 180'); return; }
    const lat=fpTempLat, lon=val;
    if (fpEditIdx >= 0 && fpEditIdx < S.wps.length) {
      const w = S.wps[fpEditIdx];
      w.lat = lat; w.lon = lon;
      fpTempLat=null; fpInputBuf=''; fpEditIdx=-1;
      updateWpMarkers(); updateNav(); updateHoldLine(); _fplPersist();
      fpGo('WPT');
      return;
    }
    const name='WP'+(S.wps.length+1);
    fpMode='LIST'; fpTempLat=null; fpInputBuf='';
    pushWP({ident:name,lat,lon});
  }
}

// Parses decimal degrees OR DMS: 37.4602 / 37°27'36.7"N / 37 27 36.7 N / N37-27-36.7
function parseDegrees(str) {
  if (!str) return NaN;
  str = str.trim();
  if (!str) return NaN;
  // Pure decimal (possibly negative)
  if (/^-?[\d.]+$/.test(str)) return parseFloat(str);
  // Extract sign from N/S/E/W
  let sign = 1;
  if (/[Ss Ww]/.test(str.replace(/\s/g,''))) sign = -1;
  // Strip direction letters and degree/minute/second symbols
  const clean = str.replace(/[NSEWnsew°'"′″´`]/g, ' ').trim();
  const parts = clean.match(/[\d]+(?:[.,][\d]+)?/g);
  if (!parts || parts.length === 0) return NaN;
  const d = parseFloat(parts[0]) || 0;
  const m = parts.length > 1 ? parseFloat(parts[1]) || 0 : 0;
  const s = parts.length > 2 ? parseFloat(parts[2]) || 0 : 0;
  return sign * (d + m / 60 + s / 3600);
}

function pushWP(wp, phase){
  if(phase) wp.phase=phase;
  S.wps.push(wp);
  if(S.awp<0) selectWP(0);
  else{updateWpMarkers();fpRender();updateNav();}
}
function removeWP(i){
  S.wps.splice(i,1);
  if(S.awp===i)    S.awp=Math.max(-1,i-1); else if(S.awp>i)    S.awp--;
  if(S.fwp===i)    S.fwp=-1;               else if(S.fwp>i)    S.fwp--;
  if(S.brg2wp===i) S.brg2wp=-1;            else if(S.brg2wp>i) S.brg2wp--;
  updateWpMarkers();fpRender();updateNav();
}
function selectWP(i){
  S.fwp=S.awp;S.awp=i;
  if (!obsOn) {
    S.crs=bearing(S.lat,S.lon,S.wps[i].lat,S.wps[i].lon);
  }
  updateWpMarkers();fpRender();updateNav();
}
function setBrg2(i){
  S.brg2wp=(S.brg2wp===i)?-1:i;
  updateNav();fpRender();updateWpMarkers();
}
function clearFP(){
  S.wps=[];S.awp=-1;S.fwp=-1;S.brg2wp=-1;
  fpMode='LIST';
  updateWpMarkers();fpRender();updateNav();
}

