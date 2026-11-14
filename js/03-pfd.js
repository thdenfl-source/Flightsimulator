// ── 승강계(VSI) 지시 지연 ──
// 실제 상승률(S.vs)은 매 순간 출렁일 수 있다 — 계기 바늘·숫자는 시간상수 VSI_TAU 로
// 천천히 따라가 널뛰지 않게 한다(실제 VSI 의 지연과 같다). 고도·비행은 그대로다.
const VSI_TAU = 3.0;   // 종전 1.5초의 반 빠르기
let _vsiDisp = null, _vsiT = 0;
function vsiSmoothed() {
  const now = performance.now();
  if (_vsiDisp === null || !Number.isFinite(_vsiDisp)) { _vsiDisp = S.vs || 0; _vsiT = now; return _vsiDisp; }
  const dt = Math.min(1, Math.max(0, (now - _vsiT) / 1000));
  _vsiT = now;
  _vsiDisp += ((S.vs || 0) - _vsiDisp) * (1 - Math.exp(-dt / VSI_TAU));
  return _vsiDisp;
}
// ─────────────────────────────────────────────────────────────
// 03-pfd.js — PFD 캔버스(자세·속도·고도·HSI)
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════
// PFD CANVAS
// ══════════════════════════════════════════════════════
// 그리는 함수들은 이 둘(전역)에 그린다 — 3D 화면에 겹친 계기에 그릴 때는 drawPfdTo 가 잠깐 바꿔 끼운다
let cvs = document.getElementById('pfd');
let ctx = cvs.getContext('2d');

function resizePFD() {
  const el = document.getElementById('pfd-wrap');
  cvs.width  = pfdCanvasW();
  cvs.height = el.clientHeight;
}
// FCP 를 PFD 오른쪽에 나란히 둔 배치(#pfd-wrap.fcp-side — SIM 조종석 PFD 팝아웃 · 15-heli3d.js).
// 그때 계기는 FCP 를 뺀 왼쪽 칸을 다 쓰고, 아래에 FCP 높이를 비우지 않는다.
function pfdFcpSide() { const w = document.getElementById('pfd-wrap'); return !!w && w.classList.contains('fcp-side'); }
function pfdCanvasW() {
  const el = document.getElementById('pfd-wrap');
  if (!el) return 0;
  if (!pfdFcpSide()) return el.clientWidth;
  const bar = el.querySelector('.ctrl-bar');
  return Math.max(80, el.clientWidth - (bar ? bar.offsetWidth : 0));
}

// ── PFD 배치 ── (실기 PFD 처럼) 자세계 하늘·땅이 위쪽 전체를 덮고, 그 위에 속도계(왼쪽)·고도계+승강계(오른쪽)가
// 반투명으로 얹힌다. 속도계 아래 GS 칸, 고도계 위 RA 칸·아래 QNH 칸. 아래쪽은 왼쪽 엔진 파라미터 · 가운데 HSI ·
// 오른쪽 레이더 고도계(CRHT) 테이프. drawPFD 와 PFD 탭(09-cdu.js onPfdTap)이 이 한 곳의 셈을 같이 쓴다.
// 대체 모드(Reversionary) EIS — SYSTEM 창이 화면에 없으면(18-system.js sysScreenShown) PFD 왼쪽 위에
// MFD EIS 의 숫자 칸(EOT · EOP · MGB · Fuel F · Fuel P · HYD P · Fuel QTY · Battery · ACCP)을 띄운다.
// 그 아래 엔진 칸(TGT · NG · TQ · NP/NR)과 이어져 왼쪽 한 줄이 실기 대체 모드 EIS 가 된다.
// 실기 PFD 처럼 속도계 · 고도계는 가운데 쪽으로 모아(왼쪽 EIS 칸 폭만큼 안쪽 · 좌우 대칭) 자세계는 늘 화면 전체 폭이다 —
// 자세계 가운데와 HSI 가운데가 한 세로줄(화면 가운데)에 선다. 대체 모드 EIS 는 자세계 왼쪽 위 하늘에 얹힌다.
function pfdRevMode() { try { return typeof sysScreenShown === 'function' && !sysScreenShown(); } catch (e) { return false; } }
function pfdLayout(W, H, ctrlH) {
  const usableH = H - ctrlH;
  const tapW = Math.max(56, Math.min(80, W * 0.075));
  const vsiW = Math.max(26, Math.min(36, W * 0.04));
  const aiH  = Math.floor(usableH * 0.5);                  // 자세계 · HSI 반반
  const hsiH = usableH - aiH;
  const FMA_H = FMA_MARGIN + FMA_BOX_H;
  const pad  = Math.round(4 + Math.max(0, W - 700) * 0.12);   // 넓은 화면에서는 테이프를 안쪽으로
  const raBoxH = 16, botH = 20;
  const tY = FMA_H + 4, tH = aiH - tY - botH - 6;
  const altY = tY + raBoxH + 2, altH = tH - raBoxH - 2;
  const engW = Math.round(Math.max(140, Math.min(300, W * 0.27)));
  const raW  = tapW + vsiW;
  // 속도계는 왼쪽 엔진(EIS) 칸 바로 안쪽, 고도계는 그 거울 자리(좁은 화면은 종전처럼 양끝) — 자세 사이는 140px 이상 남긴다
  const inward = W >= 420;
  const spdX = inward ? Math.max(pad, Math.min(engW + pad, Math.round(W / 2 - tapW - 70))) : pad;
  const altX = inward ? W - spdX - tapW : W - pad - vsiW - tapW;
  // 자세계 오른쪽(고도계+승강계 바깥) 칸 — 메시지 시현창 · HOCAS · 스톱워치(넓이 420 이상 · 폭 90 이상)
  const sideX = altX + tapW + vsiW + 6;
  const sideOn = inward && (W - pad - sideX) >= 90;
  // 오른쪽 아래 — CRHT · NAV 칸은 HSI 바로 옆으로 붙이고(나침반 반지름만큼 비켜), 남은 오른쪽 끝에 MAP · TCAS 창(inset)
  // HSI 는 늘 다 보이고 높이로 정한 크기 그대로(반지름 = HSI 칸 높이의 46%) — CRHT · NAV 칸은 그 나침반 바로 옆에,
  // 남는 오른쪽 끝이 100px 이상이면 MAP · TCAS 창. 모자라면 창을 빼고 CRHT · NAV 칸을 오른쪽 끝에(나침반은 그대로 다 보인다)
  const rH = hsiH * 0.46;
  const crX0 = Math.round(W / 2 + rH / 0.8 + 4);
  const fitsInset = sideOn && (W - pad - (crX0 + raW + 4)) >= 100;
  const crX2 = fitsInset ? crX0 : W - pad - raW;
  const insetX = crX2 + raW + 4, insetOn = fitsInset;
  // 대체 모드 — 왼쪽 엔진 칸 폭만큼 위쪽(자세계 왼쪽 위 하늘)에도 EIS 를 얹는다(좁은 화면에서는 하지 않는다)
  const rev = inward && aiH >= 200 && pfdRevMode();
  return {
    usableH, tapW, vsiW, aiH, hsiH, pad, revOn: rev, sideOn, insetOn,
    side:  { x: sideX, y: FMA_H + 4, w: W - pad - sideX, h: aiH - FMA_H - 8 },
    inset: { x: insetX, y: aiH + 4, w: W - pad - insetX, h: hsiH - 8 },
    rev:  { x: 0, y: 0, w: engW, h: aiH },
    ai:   { x: 0, y: 0, w: W, h: aiH },
    spd:  { x: spdX, y: tY, w: tapW, h: tH },
    gs:   { x: spdX, y: tY + tH + 3, w: tapW, h: botH },
    ra:   { x: altX, y: tY, w: tapW + vsiW, h: raBoxH },
    alt:  { x: altX, y: altY, w: tapW, h: altH },
    vsi:  { x: altX + tapW, y: altY, w: vsiW, h: altH },
    baro: { x: altX, y: tY + tH + 3, w: tapW, h: botH },
    eng:  { x: 0, y: aiH, w: engW, h: hsiH },
    // 오른쪽 아래 CRHT·NAV 칸은 고도계+승강계와 같은 폭으로 오른쪽 끝에(넓이 420 미만이면 고도계와 한 세로줄)
    hsi:  { x: engW, y: aiH, w: crX2 - engW, h: hsiH },
    crht: { x: crX2, y: aiH, w: raW, h: Math.round(hsiH * 2 / 3) },                       // 위 2/3 — 레이더 고도계
    navs: { x: crX2, y: aiH + Math.round(hsiH * 2 / 3), w: raW, h: hsiH - Math.round(hsiH * 2 / 3) },   // 아래 1/3 — FMS·NAV1·NAV2
  };
}

function drawPFD() {
  const W = cvs.width, H = cvs.height;
  // 패널이 접혀 있거나(전체화면 MAP·분할 전환 직후) 아직 레이아웃 전이면 W·H 가
  // 0 이 되고, usableH = H - 조작부높이 가 음수가 되어 계기 반지름까지 음수로
  // 내려간다. 그러면 ctx.arc 가 예외를 던지며 그 프레임의 계기 그리기가 통째로
  // 중단된다. 그릴 수 없는 크기면 조용히 건너뛴다.
  if (!(W >= 80) || !(H >= 80)) return;
  const ctrlEl = document.querySelector('.ctrl-bar');
  // 3D 화면에 겹친 계기(drawPfdTo)는 FCP 가 없다 — 칸을 다 계기에 쓴다
  const CTRL_H = (cvs.dataset.noFcp || pfdFcpSide()) ? 0 : (ctrlEl ? ctrlEl.offsetHeight : 80);
  const L = pfdLayout(W, H, CTRL_H);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // 위: 자세계가 바탕 전체 — 그 위에 속도계·고도계·승강계를 반투명으로 얹는다
  drawAI(L.ai.x, L.ai.y, L.ai.w, L.ai.h);
  drawSpeedTape(L.spd.x, L.spd.y, L.spd.w, L.spd.h);
  drawGsBox(L.gs.x, L.gs.y, L.gs.w, L.gs.h);
  _pfdAltFs = { tick: Math.max(9, L.tapW * 0.16), box: Math.max(12, L.tapW * 0.17) };   // 승강계 숫자를 고도계와 같은 크기로
  drawRaBox(L.ra.x, L.ra.y, L.ra.w, L.ra.h);
  drawAltTape(L.alt.x, L.alt.y, L.alt.w, L.alt.h);
  drawVSI(L.vsi.x, L.vsi.y, L.vsi.w, L.vsi.h);
  drawBaroBox(L.baro.x, L.baro.y, L.baro.w, L.baro.h);
  if (L.revOn) drawEisRev(L.rev.x, L.rev.y, L.rev.w, L.rev.h);

  // 아래: 땅 빛이 아래까지 이어지고(실기처럼), 그 위에 엔진 파라미터 · HSI · 레이더 고도계(CRHT)를 반투명으로 얹는다.
  // HSI 나침반 중심은 자세계 중심과 같은 세로선(화면 가운데)이다.
  ctx.fillStyle = '#654321'; ctx.fillRect(0, L.aiH, W, L.usableH - L.aiH);
  if (!cvs.dataset.noFcp) _pfdInsetR = null;   // 이번에 그리지 않으면 누름 자리도 없다
  _pfdSideMsgs = L.sideOn;                 // 메시지는 자세계 오른쪽 칸에(drawPfdSide) — HSI 에는 바람만
  drawHSI(L.hsi.x, L.hsi.y, L.hsi.w, L.hsi.h, W / 2);
  drawEnginePanel(L.eng.x, L.eng.y, L.eng.w, L.eng.h);
  drawCrhtDisplay(L.crht.x, L.crht.y, L.crht.w, L.crht.h);
  drawNavSrcBox(L.navs.x, L.navs.y, L.navs.w, L.navs.h);
  ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, L.aiH); ctx.lineTo(W, L.aiH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L.hsi.x + 0.5, L.aiH); ctx.lineTo(L.hsi.x + 0.5, L.usableH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L.crht.x + 0.5, L.aiH); ctx.lineTo(L.crht.x + 0.5, L.usableH); ctx.stroke();
  if (L.sideOn) drawPfdSideMsgs(L.side);
  if (L.insetOn) drawPfdInset(L.inset);
  const RC = pfdRightCol(L, W);
  if (hocasOn) drawHocas(L.hsi.x, L.hsi.y, L.hsi.w, L.hsi.h, W / 2, RC);
  drawStopwatch(L.hsi.x, L.hsi.y, L.hsi.w, L.hsi.h, W / 2, RC);
}

// ── FMS · NAV1 · NAV2 목적지(명칭·방위·거리) ── 오른쪽 아래, CRHT 계기 밑 칸(높이 1/3).
// 칸이 좁아 소스마다 두 줄: 윗줄 소스·식별자 · 아랫줄 방위·거리(VOR/DME 는 경사거리, FMS 는 GPS 수평거리).
function drawNavSrcBox(x, y, w, h) {
  if (!(w > 30) || !(h > 30)) return;
  const rows = [];
  {   // FMS — 비행계획 활성 웨이포인트
    const ok = S.awp >= 0 && S.awp < S.wps.length;
    const wp = ok ? S.wps[S.awp] : null;
    rows.push({ src: 'FMS', ident: ok ? (wp.ident || 'WPT') : '----',
                lat: ok ? wp.lat : null, lon: ok ? wp.lon : null, color: '#00cc44' });
  }
  ['NAV1', 'NAV2'].forEach(id => {
    const rr = navRadios[id] || {};
    const ok = rr.lat !== null && rr.lat !== undefined && rr.lon !== null && rr.lon !== undefined;
    rows.push({ src: id, ident: ok ? (rr.id || '----') : '----',
                lat: ok ? rr.lat : null, lon: ok ? rr.lon : null, color: '#44aaff', dme: true, elev: rr.elev || 0 });
  });
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(18,30,48,0.55)'; ctx.fillRect(x, y, w, h);   // 땅 위에 반투명
  ctx.strokeStyle = '#3a4653'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const cellH = (h - 4) / 3;
  const valFs = Math.max(8, Math.min(13, cellH * 0.34, w * 0.13));
  const lblFs = Math.max(7, Math.min(10, valFs * 0.78));
  const lblFont = `${lblFs}px Helvetica Neue, Arial, sans-serif`;
  const valFont = `bold ${valFs}px Helvetica Neue, Arial, sans-serif`;
  rows.forEach((rw, i) => {
    const cy = y + 2 + cellH * i;
    const has = rw.lat !== null;
    const brg = has ? fmtA(toMag(bearing(S.lat, S.lon, rw.lat, rw.lon))) + '°' : '---°';
    const dNM = !has ? 0 : rw.dme ? dmeDist(rw.lat, rw.lon, rw.elev) : distance(S.lat, S.lon, rw.lat, rw.lon);
    const dst = has ? uDist(dNM, 1) : '--.-';
    // 선택된 소스는 은은한 배경으로 강조
    if (navSrc === rw.src) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 2, cy + 1, w - 4, cellH - 2); }
    const y1 = cy + cellH * 0.44, y2 = cy + cellH * 0.86;
    ctx.textAlign = 'left';
    ctx.font = lblFont; ctx.fillStyle = navSrc === rw.src ? rw.color : '#888';
    ctx.fillText(rw.src, x + 4, y1);
    ctx.textAlign = 'right';
    ctx.font = valFont; ctx.fillStyle = has ? '#fff' : '#666';
    ctx.fillText(rw.ident, x + w - 4, y1);
    ctx.textAlign = 'left';
    ctx.fillStyle = has ? rw.color : '#666';
    ctx.fillText(brg, x + 4, y2);
    ctx.textAlign = 'right';
    ctx.fillStyle = has ? '#cccc66' : '#666';
    ctx.fillText(dst, x + w - 4, y2);
  });
  ctx.restore();
}

// ── 속도계 아래 GS 칸 · 고도계 위 RA 칸 · 아래 QNH 칸 ──
function _pfdSmallBox(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,14,24,0.78)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3a4653'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function drawGsBox(x, y, w, h) {
  if (!(w > 10) || !(h > 8)) return;
  let gs = S.spd;
  try { gs = gspdOn || gspdCoasting ? Math.hypot(gspdActFwd, gspdActLat) : groundSpdKt(); } catch (e) { _swallow(e); }
  ctx.save(); _pfdSmallBox(x, y, w, h);
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(8, h * 0.42)}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillStyle = '#aab4bf'; ctx.textAlign = 'left'; ctx.fillText('GS', x + 3, y + h / 2 + 1);
  ctx.font = `bold ${Math.max(10, h * 0.6)}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right'; ctx.fillText(String(Math.round(gs * S_CV())), x + w - 3, y + h / 2 + 1);
  ctx.restore();
}
// 레이더 고도 — 2,500ft 위면 'RA UP'(전파고도계 측정 범위 밖)
const RA_MAX_FT = 2500;
function drawRaBox(x, y, w, h) {
  if (!(w > 10) || !(h > 8)) return;
  let ra = null;
  try { ra = radarAltFt(); } catch (e) { _swallow(e); }
  ctx.save(); _pfdSmallBox(x, y, w, h);
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(8, h * 0.6)}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('RA', x + 3, y + h / 2 + 1);
  ctx.textAlign = 'right';
  if (ra == null || ra > RA_MAX_FT) { ctx.fillStyle = '#ffffff'; ctx.fillText('UP', x + w - 3, y + h / 2 + 1); }
  else { ctx.fillStyle = '#7fd4ff'; ctx.fillText(String(Math.round(ra * A_CV())) + (unitAlt === 'm' ? 'M' : 'FT'), x + w - 3, y + h / 2 + 1); }
  ctx.restore();
}
// 기압 설정 — METAR 의 QNH(없으면 표준 1013.25 hPa = 29.92 inHg)
function drawBaroBox(x, y, w, h) {
  if (!(w > 10) || !(h > 8)) return;
  const q = (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa)) ? window._qnhHpa : 1013.25;   // 표준 29.92 inHg
  ctx.save(); _pfdSmallBox(x, y, w, h);
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(10, h * 0.55)}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillStyle = '#7fd4ff'; ctx.textAlign = 'center';
  // UNITS 소프트키 — IN(inHg) · HPA
  const inHg = typeof pfdBaroUnit !== 'undefined' && pfdBaroUnit === 'IN';
  ctx.fillText(inHg ? (q / 33.8639).toFixed(2) + ' IN' : String(Math.round(q)) + ' HPA', x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

// ── 엔진 파라미터 (TGT · NG · TQ · NP/NR) ──
// 값의 셈(엔진 모델)은 차차 갖춘다 — 지금은 토크·NR·엔진 상태(AEO/OEI/IDLE)에서 그럴듯하게 이어 둔다.
//   TQ  : 엔진마다(AEO 는 둘 다 지금 토크 · OEI 는 살아 있는 1번이 다 · IDLE 은 0)
//   NR  : 로터 회전(SIM 의 simNr) · NP : 엔진이 로터를 돌리면 NR 과 같고, IDLE 이면 아래로 갈라진다(needle split)
//   NG·TGT : 토크를 따라 오르는 자리 표시값
// 엔진 상태로 정해지는 로터 회전(NR %) — 한 엔진이라도 FLY 면 100 · 두 엔진 IDLE 53 · 한 엔진 IDLE(다른 쪽 OFF) 47 · 둘 다 OFF 0
// (SIM 땅 위 · SIM 이 아닐 때의 NR. SIM 으로 날고 있으면 14-simmode.js 의 로터 운동(오토로테이션)이 정한다)
const NR_IDLE2 = 53, NR_IDLE1 = 47, NR_SPOOL_UP = 12, NR_SPOOL_DN = 6;   // 오르내리는 빠르기(%/s)
function engNrTarget(st) {
  st = st || (typeof simEngSt !== 'undefined' ? simEngSt : { 1: 'FLY', 2: 'FLY' });
  const fly = [1, 2].some(n => st[n] === 'FLY'), idle = [1, 2].filter(n => st[n] === 'IDLE' || st[n] === 'TRNG').length;
  return fly ? 100 : idle >= 2 ? NR_IDLE2 : idle === 1 ? NR_IDLE1 : 0;
}
let _nrNs = null, _nrNsT = 0;
function _nrNoSim() {   // SIM 이 아닐 때 — 엔진 상태의 NR 로 천천히 따라간다
  const now = performance.now(), tg = engNrTarget();
  if (_nrNs === null) _nrNs = tg;
  const dt = Math.min(1, Math.max(0, (now - _nrNsT) / 1000)); _nrNsT = now;
  const r = (tg > _nrNs ? NR_SPOOL_UP : NR_SPOOL_DN) * dt;
  _nrNs = tg > _nrNs ? Math.min(tg, _nrNs + r) : Math.max(tg, _nrNs - r);
  return _nrNs;
}
function engParams() {
  let tq = 0, nr = 100, st = { 1: 'FLY', 2: 'FLY' };
  try { tq = tqShown(); } catch (e) { _swallow(e); }
  if (simModeOn) { try { nr = simNr; } catch (e) { _swallow(e); } }
  else { try { nr = _nrNoSim(); } catch (e) { _swallow(e); } }
  // 엔진마다의 상태(14-simmode.js simEngSt — TQS · 연료/화재 레버 · TRAINING · ENG 버튼): FLY 는 돈다 · IDLE/TRNG 는 IDLE · OFF 는 0
  try { if (typeof simEngSt !== 'undefined') st = simEngSt; } catch (e) { _swallow(e); }
  const run = [st[1] === 'FLY', st[2] === 'FLY'];
  const idleOf = i => st[i + 1] === 'IDLE' || st[i + 1] === 'TRNG';
  const one = (on, idle) => {
    const t = on ? tq : 0;
    // NP 는 거버너가 100% 를 지킨다 — NR 이 위로 넘치면(자동회전 · 레버 최하단) 바늘이 갈라져 NP 는 100 그대로,
    // 출력을 넘겨 당겨 NR 이 처지면(RPM LOW) 함께 처진다
    if (on) return { tq: t, ng: Math.min(105, 62 + 0.33 * t), tgt: Math.round(420 + 3.4 * t), np: Math.min(100, nr) };
    if (idle) return { tq: 0, ng: 62, tgt: 450, np: Math.min(nr, 70) };
    return { tq: 0, ng: 0, tgt: 0, np: 0 };
  };
  const e1 = one(run[0], idleOf(0)), e2 = one(run[1], idleOf(1));
  return { e1, e2, nr };
}
function _engBox(x, y, w, h, title) {
  ctx.strokeStyle = '#5a6672'; ctx.lineWidth = 1;
  const r = 5;
  // 제목 자리만큼 위 테두리를 비운다(바탕을 칠해 가리면 반투명 바탕이 얼룩진다)
  let gap = 0;
  if (title) { ctx.font = 'bold 9px Helvetica Neue, Arial, sans-serif'; gap = ctx.measureText(title).width + 8; }
  ctx.beginPath();
  ctx.moveTo(x + w / 2 + gap / 2, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w / 2 - gap / 2, y);
  ctx.stroke();
  if (title) {
    ctx.font = 'bold 9px Helvetica Neue, Arial, sans-serif';
    ctx.fillStyle = '#e8edf2'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, x + w / 2, y + 3);
  }
}
function drawEnginePanel(x, y, w, h) {
  if (!(w > 60) || !(h > 80)) return;
  const P = engParams();
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(18,30,48,0.55)'; ctx.fillRect(x, y, w, h);   // 땅 위에 반투명(속도계·고도계와 같은 빛)
  const m = 4, half = (w - m * 3) / 2;
  // 위: TGT · NG 숫자
  const th = Math.max(36, Math.min(50, h * 0.2));
  const num = (bx, title, l1, l2, v1, v2, dec) => {
    _engBox(bx, y + 9, half, th, title);
    ctx.font = 'bold 8px Helvetica Neue, Arial, sans-serif'; ctx.fillStyle = '#c6ced6';
    ctx.textAlign = 'left'; ctx.fillText(l1, bx + 3, y + 22);
    ctx.textAlign = 'right'; ctx.fillText(l2, bx + half - 3, y + 22);
    ctx.font = `bold ${Math.max(10, Math.min(14, half * 0.17))}px Helvetica Neue, Arial, sans-serif`; ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left'; ctx.fillText(v1.toFixed(dec), bx + 3, y + 9 + th - 6);
    ctx.textAlign = 'right'; ctx.fillText(v2.toFixed(dec), bx + half - 3, y + 9 + th - 6);
  };
  num(x + m, 'TGT °C', 'TGT1', 'TGT2', P.e1.tgt, P.e2.tgt, 0);
  num(x + m * 2 + half, 'NG %', 'NG1', 'NG2', P.e1.ng, P.e2.ng, 1);
  // 아래: TQ(엔진마다) · NP1/NR/NP2 막대
  const by = y + 9 + th + 12, bh = h - (by - y) - 4;
  drawTqGauge(x + m, by, half, bh, [P.e1.tq, P.e2.tq]);
  drawNpNr(x + m * 2 + half, by, half, bh, P);
  ctx.restore();
}
// 대체 모드 EIS 의 위쪽 숫자 칸 — 그림 10 '대체 모드 EIS'의 배치(세 칸 두 줄 + Fuel QTY · Battery · ACCP)
function drawEisRev(x, y, w, h) {
  if (!(w > 100) || !(h > 120) || typeof eisData !== 'function') return;
  let D;
  try { D = eisData(); } catch (e) { return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const m = 4, G = 11;                                       // 칸 사이 · 제목 자리
  const fsL = Math.max(8, Math.min(11, w * 0.04)), fsV0 = Math.max(10, Math.min(16, w * 0.058));
  const r0 = v => String(Math.round(v));
  // 칸 폭에 맞춰 숫자 크기를 줄인다(4자리 HYD 3000 이 서로 닿지 않게)
  const fit = (txt, maxW, fs) => { ctx.font = `bold ${fs}px Helvetica Neue, Arial, sans-serif`; const tw = ctx.measureText(txt).width; return tw > maxW ? Math.max(7, Math.floor(fs * maxW / tw)) : fs; };
  const cw = (w - m * 4) / 3, narrow = cw < 62;
  const H3 = Math.min((h - G * 3 - m * 2) * 0.3, fsL + fsV0 + 16);
  const cell = (bx, by, bw, bh, title, l1, l2, v1, v2) => {
    _engBox(bx, by, bw, bh, title);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.font = `bold ${fsL}px Helvetica Neue, Arial, sans-serif`; ctx.fillStyle = '#c6ced6';
    ctx.fillText(l1, bx + bw * 0.27, by + 4 + fsL); ctx.fillText(l2, bx + bw * 0.73, by + 4 + fsL);
    const fv = Math.min(fit(v1, bw * 0.44, fsV0), fit(v2, bw * 0.44, fsV0));
    ctx.font = `bold ${fv}px Helvetica Neue, Arial, sans-serif`; ctx.fillStyle = '#ffffff';
    ctx.fillText(v1, bx + bw * 0.27, by + bh - 5); ctx.fillText(v2, bx + bw * 0.73, by + bh - 5);
  };
  // 바탕 — 숫자 칸이 차지하는 만큼만 어둡게(그 아래는 자세계 하늘 · 땅이 보인다)
  {
    const bh0 = Math.round(fsL * 2 + 22), ah0 = Math.round(fsL + 14);
    const yEnd = Math.min(y + h, y + G + (H3 + G) * 2 + bh0 + G + ah0 + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(x, y, w, yEnd - y);
  }
  const row = (by, items) => items.forEach((it, i) => cell(x + m + i * (cw + m), by, cw, H3, ...it));
  const t = (a, u) => narrow ? a : `${a} ${u}`;
  let by = y + G;
  row(by, [[t('EOT', '°C'), 'T1', 'T2', r0(D.eot[0]), r0(D.eot[1])], [t('EOP', 'PSID'), 'P1', 'P2', r0(D.eop[0]), r0(D.eop[1])], ['MGB', 'T', 'P', r0(D.mgb[0]), r0(D.mgb[1])]]);
  by += H3 + G;
  row(by, [[t('Fuel F', 'PPH'), 'F1', 'F2', r0(D.ff[0]), r0(D.ff[1])], [t('Fuel P', 'PSI'), 'P1', 'P2', r0(D.fp[0]), r0(D.fp[1])], [t('HYD P', 'PSI'), 'P1', 'P2', r0(D.hyd[0]), r0(D.hyd[1])]]);
  by += H3 + G;
  // 아래: Fuel QTY(왼쪽) · Battery · ACCP(오른쪽)
  const hw = (w - m * 3) / 2, lx = x + m, rxx = x + m * 2 + hw;
  const bh = Math.round(fsL * 2 + 22), ah = Math.round(fsL + 14);
  const H4 = Math.min(y + h - by - 4, bh + G + ah);
  if (H4 > 40) {
    _engBox(lx, by, hw, H4, narrow ? 'Fuel QTY' : 'Fuel QTY LBS');
    ctx.textAlign = 'center'; ctx.font = `bold ${fsL}px Helvetica Neue, Arial, sans-serif`; ctx.fillStyle = '#c6ced6';
    ctx.fillText('L', lx + hw * 0.27, by + 4 + fsL); ctx.fillText('R', lx + hw * 0.73, by + 4 + fsL);
    const fq = Math.min(fit(r0(D.qty.l), hw * 0.44, fsV0), fit(r0(D.qty.r), hw * 0.44, fsV0));
    ctx.font = `bold ${fq}px Helvetica Neue, Arial, sans-serif`; ctx.fillStyle = '#fff';
    ctx.fillText(r0(D.qty.l), lx + hw * 0.27, by + 6 + fsL + fq); ctx.fillText(r0(D.qty.r), lx + hw * 0.73, by + 6 + fsL + fq);
    ctx.font = `bold ${fsL}px Helvetica Neue, Arial, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('Total', lx + 4, by + H4 - 6);
    ctx.font = `bold ${fq}px Helvetica Neue, Arial, sans-serif`; ctx.textAlign = 'right'; ctx.fillText(r0(D.qty.tot), lx + hw - 4, by + H4 - 6);
    const kv = (yy, k, v) => {
      ctx.font = `bold ${fsL}px Helvetica Neue, Arial, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(k, rxx + 4, yy);
      ctx.font = `bold ${fit(v, hw * 0.45, fsV0 - 1)}px Helvetica Neue, Arial, sans-serif`; ctx.textAlign = 'right'; ctx.fillText(v, rxx + hw - 4, yy);
    };
    const bh2 = Math.min(bh, H4 - G - ah);
    _engBox(rxx, by, hw, bh2, 'Battery');
    kv(by + 4 + fsL + 2, 'AMPS', String(D.bat.a)); kv(by + bh2 - 5, 'Volts', String(D.bat.v));
    _engBox(rxx, by + bh2 + G, hw, H4 - bh2 - G, 'ACCP');
    kv(by + H4 - 5, 'PSI', String(D.accp));
  }
  ctx.restore();
}
// NP1 · NR · NP2 막대 — 0~120%. 빨간 선 106%(넘침) · NR 은 90%(처짐)에도 빨간 선
const NPNR_MAX = 120;
function drawNpNr(x, y, w, h, P) {
  _engBox(x, y, w, h, 'NP/NR %');
  const vals = [['NP1', P.e1.np], ['NR', P.nr], ['NP2', P.e2.np]];
  const n = vals.length, colW = (w - 8) / n, barW = Math.max(6, Math.min(14, colW * 0.45));
  const top = y + 30, bot = y + h - 6, bh = bot - top;
  const vToY = v => bot - bh * Math.max(0, Math.min(NPNR_MAX, v)) / NPNR_MAX;
  vals.forEach(([lbl, v], i) => {
    const cx = x + 4 + colW * (i + 0.5);
    ctx.font = 'bold 8px Helvetica Neue, Arial, sans-serif'; ctx.fillStyle = '#c6ced6'; ctx.textAlign = 'center';
    ctx.fillText(lbl, cx, y + 13);
    ctx.font = `bold ${Math.max(9, Math.min(13, colW * 0.38))}px Helvetica Neue, Arial, sans-serif`;
    // NR 은 자동회전 RPM 수정표의 띠(녹 88~110 · 황 84~88/110~114 · 적) · NP 는 106% 넘으면 빨강
    const band = lbl === 'NR' ? (v > NR_HIGH_RED || v < NR_LOW_RED ? 'red' : v > NR_HIGH || v < NR_LOW_YEL ? 'yel' : 'ok') : (v > 106 ? 'red' : 'ok');
    const warn = band === 'red';
    ctx.fillStyle = band === 'red' ? '#ff5555' : band === 'yel' ? '#ffcc00' : '#ffffff';
    ctx.fillText(Math.round(v), cx, y + 26);
    if (bh > 10) {
      const bx = cx - barW / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, top, barW, bh);
      ctx.strokeStyle = '#3a4653'; ctx.strokeRect(bx + 0.5, top + 0.5, barW - 1, bh - 1);
      ctx.fillStyle = band === 'red' ? '#ff4444' : band === 'yel' ? '#ffcc00' : '#22dd55';
      ctx.fillRect(bx + 1, vToY(v), barW - 2, bot - vToY(v));
      const line = (lv, c) => { const ly = Math.round(vToY(lv)) + 0.5; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx - 2, ly); ctx.lineTo(bx + barW + 2, ly); ctx.stroke(); ctx.lineWidth = 1; };
      if (lbl === 'NR') { line(NR_HIGH_RED, '#ff4444'); line(NR_HIGH, '#ffcc00'); line(NR_LOW_YEL, '#ffcc00'); line(NR_LOW_RED, '#ff4444'); }
      else { line(106, '#ff4444'); line(100, '#ffffff'); }
    }
  });
}

// ── 스톱워치(HSI 오른쪽 아래 — 메시지 시현창 · HOCAS 창 아래, HOCAS 와 같은 폭) ── FCP 의 STOP WATCH 를 옮겼다
// 시계 모드: 현재 시각 + [STOP WATCH] · 스톱워치 모드: 경과 시간 + [GO/STP] [RST] [TIME]. 칸을 누르면 그 동작(_swHit · onPfdTap)
let _swHit = [];
let _pfdMsgBottom = NaN;   // 메시지 시현창의 아래끝(drawHSI 가 그 프레임에 적는다) — HOCAS 가 그 아래로
function drawStopwatch(x, y, w, h, cxC, RC0) {
  if (!(w >= 40) || !(h >= 40)) return;
  const RC = RC0 || hsiRightCol(x, y, w, h, cxC);
  const bx = RC.left, bw = RC.width, by = RC.swY, bh = RC.swH, fs = RC.fs;
  const sw = typeof _swMode !== 'undefined' && _swMode === 'sw';
  const run = sw && typeof SW !== 'undefined' && SW.running;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#446688'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  // 윗줄 — 이름표 · 시각
  ctx.textBaseline = 'alphabetic';
  // 칸이 좁으면(3D 에 겹친 작은 계기) 이름표를 빼고 시각만 — 글자가 겹치지 않게
  const tTxt = typeof swText === 'function' ? swText() : '';
  ctx.font = `bold ${fs * 1.25}px Helvetica Neue, Arial, sans-serif`;
  const tW = ctx.measureText(tTxt).width;
  ctx.font = `bold ${fs * 0.8}px Helvetica Neue, Arial, sans-serif`;
  const lbl = sw ? 'SW' : 'TIME';
  if (ctx.measureText(lbl).width + tW + 14 <= bw) {
    ctx.fillStyle = '#8ac6ff'; ctx.textAlign = 'left';
    ctx.fillText(lbl, bx + 4, by + fs * 1.45);
  }
  ctx.font = `bold ${fs * 1.25}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillStyle = sw ? (run ? '#22e022' : '#ffffff') : '#ffffff'; ctx.textAlign = 'right';
  ctx.fillText(tTxt, bx + bw - 4, by + fs * 1.55);
  // 아랫줄 — 버튼
  const btns = sw ? [[run ? 'STP' : 'GO', 'swToggle', run], ['RST', 'swReset', false], ['TIME', 'swSetMode:clock', false]]
                  : [['STOP WATCH', 'swSetMode:sw', false]];
  const gy = by + fs * 2.0, gh = bh - fs * 2.0 - 4, gap = 3, gw = (bw - 8 - gap * (btns.length - 1)) / btns.length;
  const hits = [];
  btns.forEach(([t, act, on], i) => {
    const gx = bx + 4 + i * (gw + gap);
    ctx.fillStyle = on ? '#14451a' : '#1c232b'; ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = on ? '#22e022' : '#5a6672'; ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
    ctx.fillStyle = on ? '#7fffb0' : '#cfd6dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.min(fs * 0.85, gw / Math.max(3, t.length) * 1.6)}px Helvetica Neue, Arial, sans-serif`;
    ctx.fillText(t, gx + gw / 2, gy + gh / 2 + 1);
    hits.push({ x: gx, y: gy, w: gw, h: gh, act });
  });
  ctx.restore();
  // 본 PFD 캔버스에서만 누름 자리를 기억한다(3D 에 겹친 계기는 그림만)
  if (!cvs.dataset.noFcp) _swHit = hits;
}
// PFD 를 누른 자리(캔버스 px)가 스톱워치 버튼이면 그 동작 — 09-cdu.js onPfdTap 이 먼저 묻는다
function swHitTest(px, py) {
  const b = _swHit.find(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  if (!b) return false;
  if (b.act === 'swToggle') swToggle();
  else if (b.act === 'swReset') swReset();
  else if (b.act.startsWith('swSetMode:')) swSetMode(b.act.split(':')[1]);
  return true;
}

// ── PFD 메시지 시현창(HSI 오른쪽 위 바람 정보 아래) ──
// UPPER · LOWER 콘솔 스위치와 엔진 상태를 따라 켜진다. 황색은 주의, 녹색은 상태 알림.
//   PITOT OFF(황) — PITOT HEAT 가 OFF 일 때(AUTO · ON 이면 없음)
//   1 · 2 GEN OFF(황) — 그 GEN 스위치 OFF(또는 엔진이 멎어 발전기가 버스에 없음)
//   PARKING BRAKE SET(녹) — 파킹 브레이크 SET
//   1 · 2 ENG A/I ON(녹) — 그 엔진 ANTI ICE 스위치 ON, 또는 NgR 87.5 % 이하면 늘
//   NLG LOCK(녹) — NOSE WHEEL LOCK
//   EMER FLOATS ARMED(녹) — 비상부주 FLOATS 스위치 ARMED
const PFD_MSG_AMBER = '#ffb000', PFD_MSG_GREEN = '#22e022', PFD_AI_NGR = 87.5;
function pfdMsgs() {
  const ov = (id, d) => { try { const v = typeof ovhdGet === 'function' ? ovhdGet(id) : undefined; return v === undefined ? d : v; } catch (e) { return d; } };
  let P = null;
  try { P = engParams(); } catch (e) { _swallow(e); }
  const out = [];
  if (ov('pitotHeat', 'AUTO') === 'OFF') out.push({ t: 'PITOT OFF', c: PFD_MSG_AMBER });
  // 1 · 2 GEN OFF(황) — 그 발전기가 버스에 없을 때(UPPER GEN 스위치 OFF, 또는 엔진이 멎어 발전하지 못함 — 18-system.js elecState)
  let E = null;
  try { if (typeof elecState === 'function') E = elecState(); } catch (e) { _swallow(e); }
  [1, 2].forEach(n => {
    const on = E ? E['gen' + n] : ov('gen' + n, 'ON') === 'ON';
    if (!on) out.push({ t: `${n} GEN OFF`, c: PFD_MSG_AMBER });
  });
  // AFCS CAS(23-afcs.js afcsCas) — AFCS FAIL(적) · 1 · 2 APM OFF · AFCS DEGRADED · BOTH ON AHRS/ADC(황)
  try { if (typeof afcsCas === 'function') out.unshift(...afcsCas()); } catch (e) { _swallow(e); }
  // 연료 계통 CAS(18-system.js fuelCas) — 1 · 2 F/L PRES · FUEL IMBALANCE · FUEL 1 · 2 LOW(황) · FUEL XFEED(녹)
  try { if (typeof fuelCas === 'function') fuelCas().forEach(m => out.push({ t: m.t, c: m.amber ? PFD_MSG_AMBER : PFD_MSG_GREEN })); } catch (e) { _swallow(e); }
  // 하부 콘솔 레버 SET, 또는 SIM 스페이스 두 번(simParkBrakeOn). 걸린 채 활주 착륙하면 빨갛게(simParkWarnOn)
  let park = ov('parkBrake', 'RELEASE') === 'SET', parkWarn = false;
  try { if (typeof simParkBrakeOn === 'function' && simParkBrakeOn()) park = true; } catch (e) { _swallow(e); }
  try { parkWarn = park && typeof simParkWarnOn === 'function' && simParkWarnOn(); } catch (e) { _swallow(e); }
  if (park) out.push({ t: 'PARKING BRAKE SET', c: parkWarn ? '#ff3030' : PFD_MSG_GREEN });
  [1, 2].forEach(n => {
    const ng = P ? (n === 1 ? P.e1 : P.e2).ng : 100;
    if (ov('engAi' + n, 'OFF') === 'ON' || ng <= PFD_AI_NGR) out.push({ t: `${n} ENG A/I ON`, c: PFD_MSG_GREEN });
  });
  // APU — CONTR ON 뒤 약 17초에 'APU ON', 그 뒤 APU/GPU 스위치 APU GEN 이면 'APU GEN'(18-system.js apuRunning)
  try {
    if (typeof apuRunning === 'function' && apuRunning()) {
      out.push({ t: 'APU ON', c: PFD_MSG_GREEN });
      if (ov('apuGen', 'OFF') === 'APU GEN') out.push({ t: 'APU GEN', c: PFD_MSG_GREEN });
    }
  } catch (e) { _swallow(e); }
  if (ov('noseLock', 'UNLOCK') === 'LOCK') out.push({ t: 'NLG LOCK', c: PFD_MSG_GREEN });
  if (ov('fltArmSw', 'OFF') === 'ARMED') out.push({ t: 'EMER FLOATS ARMED', c: PFD_MSG_GREEN });
  return out;
}

// ── HOCAS 표시 ── FCP 의 HOCAS 버튼으로 켠다. HSI 왼쪽(바람 표시와 TAS 줄 사이)에
// 사이클릭(전후·좌우)과 페달이 가운데(중립)인지, 한쪽으로 얼마나 치우쳤는지 보여 준다.
//   ● 조종 장치(조이스틱·화면 조종간)가 지금 밀려 있는 자리 — 가운데면 초록, 치우치면 호박색
//   ○ (SIM) 트림이 잡고 있는 자리 — 손을 놓으면 기체는 이 자세로 간다
// 사이클릭은 위가 앞(밀기)·오른쪽이 오른쪽, 페달은 오른쪽이 오른 페달이다.
let hocasOn = false;
const HOCAS_DEAD = 0.05;          // 이 안이면 가운데(중립)로 본다
// (켜기 · CTR · DEFAULT 는 CDU 의 Aircraft Systems → HOCAS 칸 — 18-system.js)
function toggleHocas() {
  hocasOn = !hocasOn;
  try { drawPFD(); } catch (e) { _swallow(e); }
  try { if (typeof _hocasCduRefresh === 'function') _hocasCduRefresh(); } catch (e) { _swallow(e); }
}
// CTR — 손을 뗀 지금 자리를 조종간·페달의 가운데로(12-joystick.js joyRecenter)
function hocasCenter() {
  let ok = false;
  try { ok = typeof joyRecenter === 'function' && joyRecenter(); } catch (e) { _swallow(e); }
  try { drawPFD(); } catch (e) { _swallow(e); }
  try { if (typeof _hocasCduRefresh === 'function') _hocasCduRefresh(); } catch (e) { _swallow(e); }
  return ok;
}
// DEFAULT — 저장한 가운데를 지우고 기본값으로(12-joystick.js joyNeutralDefault)
function hocasDefault() {
  let ok = false;
  try { ok = typeof joyNeutralDefault === 'function' && joyNeutralDefault(); } catch (e) { _swallow(e); }
  try { drawPFD(); } catch (e) { _swallow(e); }
  try { if (typeof _hocasCduRefresh === 'function') _hocasCduRefresh(); } catch (e) { _swallow(e); }
  return ok;
}
function hocasAxes() {
  let a = { roll: 0, pitch: 0, yaw: 0 };
  try { if (typeof simModeAxes === 'function') a = simModeAxes(); } catch (e) { _swallow(e); }
  const trim = (simModeOn && typeof simTrimAct !== 'undefined')
    ? { roll: simTrimAct.roll / SIM_BANK_MAX, pitch: simTrimAct.pitch / SIM_PITCH_MAX } : null;
  // 컬렉티브 — SIM 에서는 레버가 요구하는 토크(%, 0…140 · AFCS 가 몰면 그 값), 아니면 레버 자리
  let coll = null;
  try {
    const cfg = (typeof joyAxes === 'object' && joyAxes) ? joyAxes.coll : null;
    const hov = () => { try { return hoverTqRef() / SIM_LEVER_TOP; } catch (e) { return null; } };
    if (simModeOn && typeof simTqCmd === 'number') coll = { frac: simTqCmd / SIM_LEVER_TOP, tq: simTqCmd, hov: hov() };
    else if (cfg) coll = { frac: cfg.abs ? (joyAxRaw('coll') + 1) / 2 : ((a.coll || 0) + 1) / 2, tq: null, hov: null };
    // SIM 조종을 켜기 전(레버 배정도 없을 때)에도 막대가 비지 않게 — 지금 걸린 토크를 레버 자리로 보인다
    // (종전에는 3D Only 에서 FLY 로 SIM 을 켠 뒤에야 컬렉티브가 나타났다)
    else { const tq = Math.max(0, +S.tq || 0); coll = { frac: tq / SIM_LEVER_TOP, tq, hov: hov() }; }
  } catch (e) { _swallow(e); }
  return { roll: a.roll || 0, pitch: a.pitch || 0, yaw: a.yaw || 0, trim, coll };
}
// HSI 오른쪽 아래 칸의 자리 — HOCAS 창과 그 아래 스톱워치가 같은 왼쪽 · 폭으로 선다
// ── 자세계 오른쪽 칸(실기 PFD 의 오른쪽 위) — 메시지 시현창(위) · HOCAS · 스톱워치(아래) ──
let _pfdSideMsgs = false;
function drawPfdSideMsgs(S0) {
  const msgs = pfdMsgs();
  _pfdMsgBottom = S0.y;
  if (!msgs.length) return;
  ctx.save();
  let mfs = Math.max(8, Math.min(11, S0.w * 0.085));
  ctx.font = `bold ${mfs}px Helvetica Neue, Arial, sans-serif`;
  const widest = Math.max(...msgs.map(m => ctx.measureText(m.t).width));
  if (widest > S0.w - 8) { mfs = Math.max(6, mfs * (S0.w - 8) / widest); ctx.font = `bold ${mfs}px Helvetica Neue, Arial, sans-serif`; }
  const bh = msgs.length * mfs * 1.3 + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(S0.x, S0.y, S0.w, bh);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let my = S0.y + 3 + mfs;
  msgs.forEach(m => { ctx.fillStyle = m.c; ctx.fillText(m.t, S0.x + 4, my); my += mfs * 1.3; });
  _pfdMsgBottom = S0.y + bh;
  ctx.restore();
}
// HOCAS · 스톱워치 자리 — 자세계 오른쪽 칸이 있으면 그 칸 아래쪽, 없으면 종전대로 HSI 오른쪽 아래(hsiRightCol)
function pfdRightCol(L, W) {
  if (!L.sideOn) return hsiRightCol(L.hsi.x, L.hsi.y, L.hsi.w, L.hsi.h, W / 2);
  const S0 = L.side;
  const fs = Math.max(8, Math.min(11, S0.w * 0.085));
  const colW = 8, colGap = 6;
  const swH = Math.round(fs * 3.6 + 8), swY = S0.y + S0.h - swH;
  const box0 = Math.max(30, Math.min(S0.w - 8 - colW - colGap, S0.h * 0.40));
  let box = box0;
  if (Number.isFinite(_pfdMsgBottom)) box = Math.max(30, Math.min(box0, (swY - 4) - (_pfdMsgBottom + 4) - (fs * 4.8 + 18)));
  const bx = S0.x + 4 + Math.max(0, (S0.w - 8 - colW - colGap - box) / 2);
  return { fs, colW, colGap, box, bx, left: S0.x, width: S0.w, swH, swY };
}
// ── 오른쪽 아래 창(inset) — MAP(기수 위 움직이는 지도) · TCAS(TA ONLY 거리 고리). 누르거나 소프트키 Traffic Map 으로 바꾼다 ──
let _pfdInsetR = null;
function pfdInsetTcas() { try { return typeof skState !== 'undefined' && !!skState.tfcMap; } catch (e) { return false; } }
function pfdInsetToggle() {
  try { if (typeof skState !== 'undefined') { skState.tfcMap = !skState.tfcMap; if (typeof _skSave === 'function') _skSave(); } } catch (e) { _swallow(e); }
  try { if (typeof pfdSkRender === 'function') pfdSkRender(); } catch (e) { _swallow(e); }
  try { drawPFD(); } catch (e) { _swallow(e); }
}
function drawPfdInset(R0) {
  if (!(R0.w > 40 && R0.h > 60)) return;
  const tcas = pfdInsetTcas();
  ctx.save();
  ctx.beginPath(); ctx.rect(R0.x, R0.y, R0.w, R0.h); ctx.clip();
  ctx.fillStyle = '#05101a'; ctx.fillRect(R0.x, R0.y, R0.w, R0.h);
  const fs = Math.max(8, Math.min(11, R0.w * 0.07));
  if (!tcas && typeof ckMapDraw === 'function') {
    try { ckMapDraw(ctx, R0.x, R0.y, R0.w, R0.h); } catch (e) { _swallow(e); }
  } else {
    // TCAS — 기수 위 · 안쪽 2NM 점 고리 · 바깥 6NM 고리 · 내 기체
    const cx = R0.x + R0.w / 2, cy = R0.y + R0.h * 0.56, r = Math.min(R0.w, R0.h) * 0.40;
    ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = '#d8dde2'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r / 3, cy + Math.sin(a) * r / 3, 1.4, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 36; i++) {                    // 바깥 고리 눈금(30° 마다 길게)
      const a = i / 36 * Math.PI * 2 - (S.hdg || 0) * Math.PI / 180, l = i % 3 === 0 ? 7 : 3;
      ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); ctx.lineTo(cx + Math.sin(a) * (r - l), cy - Math.cos(a) * (r - l)); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';                        // 내 기체
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 6, cy + 6); ctx.lineTo(cx, cy + 3); ctx.lineTo(cx - 6, cy + 6); ctx.closePath(); ctx.fill();
    ctx.font = `bold ${fs}px Helvetica Neue, Arial, sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#00e5ff';
    ctx.fillText('6 NM', cx + r * 0.72 + 2, cy + r * 0.72);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
    ctx.fillText('TCAS: TA ONLY', R0.x + R0.w - 4, R0.y + fs + 3);
    ctx.textAlign = 'left'; ctx.fillStyle = '#00e5ff'; ctx.fillText('HDG UP', R0.x + 4, R0.y + fs + 3);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9aa5b0'; ctx.fillText('NO TRAFFIC', R0.x + R0.w - 4, R0.y + R0.h - 5);
  }
  ctx.restore();
  ctx.strokeStyle = '#5a6672'; ctx.lineWidth = 1; ctx.strokeRect(R0.x + 0.5, R0.y + 0.5, R0.w - 1, R0.h - 1);
  if (!cvs.dataset.noFcp) _pfdInsetR = R0;   // 본 PFD 에서만 누름 자리(09-cdu.js onPfdTap)
}
function pfdInsetHit(px, py) {
  const r = _pfdInsetR;
  if (!r || px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) return false;
  pfdInsetToggle(); return true;
}
function hsiRightCol(x, y, w, h, cxC) {
  const G = hsiGeom(x, y, w, h, cxC);
  const sideW = Math.max(60, G.rightW);
  const fs = Math.max(8, Math.min(11, sideW * 0.10));
  const colW = 8, colGap = 6;                      // HOCAS 오른쪽에 컬렉티브 막대
  const swH = Math.round(fs * 3.6 + 8);            // 스톱워치 칸 높이(시각 한 줄 + 버튼 한 줄)
  const box0 = Math.min(sideW - 8 - colW - colGap, h * 0.40);
  const bx = Math.min(x + w - 8 - box0 - colW - colGap, G.cx + G.r + 4 + (sideW - box0 - colW - colGap) / 2);
  // 메시지 시현창(바람 아래)을 가리지 않게 — 그 아래 남는 높이에 맞춰 HOCAS 만 줄인다(왼쪽 끝은 그대로 · 스톱워치는 제 폭)
  let box = box0;
  if (Number.isFinite(_pfdMsgBottom)) {
    const room = (y + h - 6 - swH - 4) - (_pfdMsgBottom + 4) - (fs * 4.8 + 18);
    box = Math.max(30, Math.min(box0, room));
  }
  return { G, sideW, fs, colW, colGap, box, bx, left: bx - 4, width: box0 + colW + colGap + 8, swH, swY: y + h - 6 - swH };
}
function drawHocas(x, y, w, h, cxC, RC0) {
  if (!(w >= 40) || !(h >= 40)) return;
  // HSI 오른쪽 아래(또는 자세계 오른쪽 칸) — 그 아래에는 스톱워치(drawStopwatch)
  const RC = RC0 || hsiRightCol(x, y, w, h, cxC);
  const { fs, colW, colGap, box, bx } = RC;
  const ax = hocasAxes();
  const clamp = v => Math.max(-1, Math.min(1, v));
  const col = v => Math.abs(v) <= HOCAS_DEAD ? '#00ff88' : '#ffb74d';
  const by = RC.swY - 4 - (box + fs * 3.8 + 12);   // 바탕 아래끝이 스톱워치 칸 위에서 4px
  ctx.save();
  // 바탕
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(bx - 4, by - fs - 6, box + colW + colGap + 8, box + fs * 4.8 + 18);
  ctx.strokeStyle = '#446688'; ctx.lineWidth = 1;
  ctx.strokeRect(bx - 4 + 0.5, by - fs - 6 + 0.5, box + colW + colGap + 7, box + fs * 4.8 + 17);
  ctx.font = `bold ${fs}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8ac6ff';
  ctx.fillText('HOCAS', bx + box / 2, by - 3);
  // ── 사이클릭 ──
  const c = box / 2, cx = bx + c, cy = by + c;
  ctx.strokeStyle = '#555'; ctx.strokeRect(bx + 0.5, by + 0.5, box - 1, box - 1);
  ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, by + box); ctx.moveTo(bx, cy); ctx.lineTo(bx + box, cy); ctx.stroke();
  // 가운데(중립) 칸
  const dz = Math.max(3, HOCAS_DEAD * c);
  ctx.strokeStyle = '#2f6f4f'; ctx.strokeRect(cx - dz, cy - dz, dz * 2, dz * 2);
  if (ax.trim) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx + clamp(ax.trim.roll) * (c - 4), cy - clamp(ax.trim.pitch) * (c - 4), 4.5, 0, Math.PI * 2); ctx.stroke();
  }
  const dev = Math.max(Math.abs(ax.roll), Math.abs(ax.pitch));
  ctx.fillStyle = col(dev);
  ctx.beginPath(); ctx.arc(cx + clamp(ax.roll) * (c - 4), cy - clamp(ax.pitch) * (c - 4), 3.8, 0, Math.PI * 2); ctx.fill();
  // 수치(% · 앞 F / 뒤 A · 좌 L / 우 R)
  const pct = (v, p, n) => Math.abs(v) <= HOCAS_DEAD ? '0' : (v > 0 ? p : n) + Math.round(Math.abs(v) * 100);
  ctx.font = `${fs * 0.95}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillStyle = col(dev);
  ctx.fillText(`CYC ${pct(ax.pitch, 'F', 'A')} · ${pct(ax.roll, 'R', 'L')}`, cx, by + box + fs * 1.15);
  // ── 페달 ──
  const py = by + box + fs * 1.8, pw = box;
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, py + 0.5, pw - 1, 7);
  ctx.beginPath(); ctx.moveTo(cx, py - 2); ctx.lineTo(cx, py + 10); ctx.stroke();
  ctx.fillStyle = col(ax.yaw);
  ctx.fillRect(cx + clamp(ax.yaw) * (pw / 2 - 3) - 3, py - 1, 6, 10);
  ctx.fillText(`PED ${pct(ax.yaw, 'R', 'L')}`, cx, py + 8 + fs * 1.15);
  // ── 컬렉티브 막대 ── 아래가 0 · 위가 끝(SIM 140%). 흰 눈금은 호버 토크, 아래 숫자는 레버가 요구하는 토크(%)
  if (ax.coll) {
    const kx = bx + box + colGap, f = Math.max(0, Math.min(1, ax.coll.frac));
    ctx.strokeStyle = '#555'; ctx.strokeRect(kx + 0.5, by + 0.5, colW - 1, box - 1);
    ctx.fillStyle = '#8ac6ff'; ctx.fillRect(kx + 1, by + box - 1 - f * (box - 2), colW - 2, f * (box - 2));
    if (ax.coll.hov != null) {
      const hy = by + box - 1 - Math.max(0, Math.min(1, ax.coll.hov)) * (box - 2);
      ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(kx - 2, hy); ctx.lineTo(kx + colW + 2, hy); ctx.stroke();
    }
    ctx.fillStyle = '#8ac6ff'; ctx.textAlign = 'center';
    ctx.fillText(`COL ${Math.round(ax.coll.tq != null ? ax.coll.tq : f * 100)}%`, bx + (box + colGap + colW) / 2, py + 8 + fs * 1.15 + fs * 1.15);
  }
  ctx.restore();
}

// 같은 PFD 를 다른 캔버스에도 그린다 — 3D 화면에 겹쳐 띄우는 계기(07-sim.js pfdOverlayDraw).
// 그리는 함수들이 전역 cvs·ctx 에 그리므로 잠깐 바꿔 끼웠다가 되돌린다(그리기는 상태를 남기지
// 않으므로 한 프레임에 두 번 그려도 된다). 그 캔버스에는 data-no-fcp 를 달아 둔다.
function drawPfdTo(canvas) {
  const c0 = cvs, x0 = ctx;
  cvs = canvas; ctx = canvas.getContext('2d');
  try { drawPFD(); } finally { cvs = c0; ctx = x0; }
}

// ────────────────────────────────────────
// FLIGHT MODE ANNUNCIATOR (FMA)
// Three rectangular boxes at top of AI:  Left=Collective | Mid=Yaw/Roll | Right=Pitch
// ────────────────────────────────────────
// ── FMA geometry constants (used by drawFMA + click handler) ──
// FMA shows axis engagement state only; per-axis target values are drawn
// inside the right-column ALT tape and CRHT display headers instead.
const FMA_BOX_H  = 20;
const FMA_MARGIN = 2;
const FMA_GAP    = 3;
// AFCS 상태 띠(FMA)의 세 칸 — 칸 폭은 자세계 폭을 셋으로 나눈 것의 절반, 세 칸을 묶어 가운데에 둔다
// (그리기 drawFMA 와 PFD 누름 09-cdu.js onPfdTap 이 같은 자리를 쓴다)
function fmaCells(x, w) {
  let cellW = Math.floor((w - FMA_MARGIN * 2 - FMA_GAP * 2) / 3 / 2);
  // 속도계 · 고도계를 가운데로 모은 배치(pfdLayout — 넓이 420 이상)에서는 왼쪽 EIS 칸과 닿지 않게 그 사이에 둔다
  if (w >= 420) {
    const engW = Math.round(Math.max(140, Math.min(300, w * 0.27)));
    cellW = Math.min(cellW, Math.floor((w - engW * 2 - 12 - FMA_GAP * 2) / 3));
  }
  const total = cellW * 3 + FMA_GAP * 2;
  return { cellW, x0: x + (w - total) / 2, total };
}

// ────────────────────────────────────────
// FLIGHT MODE ANNUNCIATOR  (mode labels only)
// ────────────────────────────────────────
function drawFMA(x, y, w) {
  const MARGIN = FMA_MARGIN, GAP = FMA_GAP, BOX_H = FMA_BOX_H;
  const { cellW, x0: FX0 } = fmaCells(x, w);
  const Y0     = y + MARGIN;
  // Determine active mode per axis.  Default ALT | HDG | IAS — each axis
  // gets its own distinct label, never duplicating ALT on two axes.
  //   Left   (collective): ALT or CRHT (or dim ALT when both holds are off)
  //   Middle (yaw/roll)  : HDG or GS when GSPD
  //   Right  (pitch)     : IAS — or GS when GSPD engaged
  let left, leftOn,
      mid = navApOn
        ? (holdOn && _holdPhase !== 'TOFIX'
             ? 'HOLD ' + (_holdEntry ? _holdEntry[0] : '')     // D=직진 P=평행 T=눈물방울
             : (holdOn ? 'HOLD ARM' : (_navDirectTo ? 'NAV DIR' : 'NAV')))
        : 'HDG',
      // HDG 는 걸려 있는 동안만 켜진다(풀려 있으면 어둡게 — IAS·ALT 와 같다)
      midOn = hdgSelOn || navApOn, right, rightOn;

  if (gspdOn) {
    // GSPD engaged: both yaw/roll (mid) and pitch (right) are driven by
    // body-frame ground speed; capture GS on both axes.
    left   = crhtOn ? 'CRHT' : 'ALT'; leftOn = true;
    // GSPD 는 요/롤 축을 가져간다. NAV·HDG SEL 이 켜져 있어도 조향하지 못하므로
    // 켜진 채 방치하지 말고 "대기"임을 분명히 적는다.
    // (버튼은 초록인데 기체가 안 도는 상황을 화면만 보고 알 수 있어야 한다)
    mid    = navApOn ? 'GS/NAV' : (hdgSelOn ? 'GS/HDG' : 'GS');
    midOn  = true;
    right  = 'GS'; rightOn = true;
  } else {
    // ALT 가 선택 고도로 가는 중이면(기준이 지금 고도와 20ft 넘게 떨어져 있으면) ALT.A
    left   = crhtOn ? 'CRHT' : (altHoldOn && Math.abs(selAlt - S.alt) > 20 ? 'ALT.A' : 'ALT');
    leftOn = altHoldOn || crhtOn;     // dim ALT if both collective holds off
    right  = 'IAS';
    // SIM 모드에서는 IAS 를 건 동안만 켜진다(풀려 있으면 기수 자세는 조종간 몫)
    rightOn = (typeof iasModeOn === 'function') ? iasModeOn() : (!simModeOn || simIasOn);   // FCP IAS 를 누르면 꺼진다(SIM 이 꺼져 있어도 — 07-sim.js iasNsOn)
    // G/A — 컬렉티브·피치 축이 GA, 끝나면 컬렉티브 VS(선택 상승률) · 피치 IAS
    const ga = (typeof gaOn !== 'undefined') && simModeOn && gaOn, vsm = (typeof vsModeOn !== 'undefined') && simModeOn && vsModeOn;
    const td = (typeof tdOn !== 'undefined') && simModeOn && tdOn;
    if (td) { left = 'TDH'; leftOn = true; right = 'TDH'; rightOn = true; }   // T/D to H
    else if (ga) { left = 'GA'; leftOn = true; right = 'GA'; rightOn = true; }
    else if (vsm && !altHoldOn && !crhtOn) { left = 'VS ' + Math.round(selVS); leftOn = true; }
  }

  // ── G/S (ILS 강하선) ──
  // 세로축을 잡으면 그 칸의 주 모드가 G/S 가 된다(승강계 마름모·버튼과 같은 자홍색).
  // 아직 무장만 한 상태는 실제 FMA 처럼 '흰 글씨로 옆에' 적어 둔다 —
  // 지금 잡고 있는 모드와 곧 잡을 모드를 한눈에 갈라 보기 위해서다.
  let leftArm = '';
  if (typeof gsOn !== 'undefined' && gsOn) { left = 'G/S'; leftOn = true; }
  else if (typeof gsArmed !== 'undefined' && gsArmed) { leftArm = 'G/S'; }

  const modes  = [left,   mid,    right  ];
  const active = [leftOn, midOn,  rightOn];
  const armed  = [leftArm, '',    ''      ];
  // AFCS 가용성(23-afcs.js afcsAxes) — AP1·AP2 모두 OFF · TRIM FEEL REL · AUTO TRIM OFF · AHRS BACKUP 이면
  // 그 축이 기본 안정 증대(SAS)로 내려가 황색 SAS. AFCS FAIL(DC 전원 없음)이면 세 칸 모두 꺼진다.
  try {
    if (typeof afcsAxes === 'function') {
      const A = afcsAxes();
      for (let i = 0; i < 3; i++) {
        if (A.fail) { active[i] = false; armed[i] = ''; }
        else if (A.sas[i]) { modes[i] = 'SAS'; active[i] = true; armed[i] = ''; }
      }
    }
  } catch (e) { _swallow(e); }

  // T/D to H 중 45kt 밑 — 롤 축(HDG·NAV)이 성능이 줄었다는 주의(황색)
  const midAmber = (typeof tdRollAmber === 'function') && tdRollAmber();
  const modeColor = (lbl, on, i) => {
    if (!on) return '#3a3a3a';
    if (lbl === 'SAS') return '#ffb000';     // 기본 안정 증대로 내려간 축 — 황색
    if (i === 1 && midAmber) return '#ffcc00';
    // GS/NAV · GS/HDG = GSPD 가 축을 잡고 있어 NAV·HDG 가 조향하지 못하는 대기 상태.
    // 초록(정상 작동)과 구분되게 호박색으로 표시한다.
    // G/S 도 빗금이 있으므로 대기 상태(GS/NAV)보다 먼저 가려낸다.
    if (lbl === 'G/S') return '#ff66ff';   // 강하선을 잡은 상태 — 승강계 마름모와 같은 색
    if (lbl.indexOf('/') >= 0) return '#ffb74d';
    return '#00ff88';  // all active AFCS modes in green
  };

  ctx.save();
  ctx.font = `bold ${Math.max(8, Math.min(11, w * 0.030))}px 'Helvetica Neue', 'Arial', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  for (let i = 0; i < 3; i++) {
    const bx = FX0 + i * (cellW + GAP);
    const on = active[i];
    ctx.strokeStyle = on ? '#446688' : '#1a1a1a';
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx + 0.5, Y0 + 0.5, cellW - 1, BOX_H - 1);
    if (on) {
      ctx.fillStyle = 'rgba(0,25,50,0.85)';
      ctx.fillRect(bx + 1, Y0 + 1, cellW - 2, BOX_H - 2);
    }
    const ty = Y0 + BOX_H / 2 + 0.5;
    if (armed[i]) {
      // 주 모드 + 무장 모드를 한 칸에 나란히. 둘을 합친 폭을 재어 가운데 맞춘다.
      const mainF = ctx.font;
      const smallF = `bold ${Math.max(7, Math.min(9, w * 0.024))}px 'Helvetica Neue', 'Arial', sans-serif`;
      ctx.font = mainF;  const w1 = ctx.measureText(modes[i]).width;
      ctx.font = smallF; const w2 = ctx.measureText(armed[i]).width;
      const gap2 = 4, total = w1 + gap2 + w2;
      let px = bx + (cellW - total) / 2;
      ctx.textAlign = 'left';
      ctx.font = mainF;  ctx.fillStyle = modeColor(modes[i], on, i);
      ctx.fillText(modes[i], px, ty);
      px += w1 + gap2;
      // 무장은 흰색 — 아직 잡지 않았다는 뜻이다
      ctx.font = smallF; ctx.fillStyle = '#ffffff';
      ctx.fillText(armed[i], px, ty);
      ctx.font = mainF; ctx.textAlign = 'center';
    } else {
      ctx.fillStyle = modeColor(modes[i], on, i);
      // 칸이 좁아졌으니 넘치는 글자(GS/NAV · TDOWN 등)는 칸에 맞춰 조금 줄인다
      const f0 = ctx.font, mw = ctx.measureText(modes[i]).width, room = cellW - 4;
      if (mw > room) { const px0 = parseFloat(f0.match(/(\d+(?:\.\d+)?)px/)[1]); ctx.font = f0.replace(/\d+(?:\.\d+)?px/, Math.max(6, px0 * room / mw).toFixed(1) + 'px'); }
      ctx.fillText(modes[i], bx + cellW / 2, ty);
      ctx.font = f0;
    }
    // 모드가 바뀌어 걸리면 10초 동안 네 귀퉁이 상자가 깜빡인다 — 녹색(걸림) · 황색(SAS · 성능 저하)
    const key = modes[i] + '|' + (on ? 1 : 0) + armed[i], now = performance.now();
    if (_fmaPrev[i] !== undefined && _fmaPrev[i] !== key && on) {
      const c = modeColor(modes[i], on, i);
      _fmaFlash[i] = { t: now, col: c === '#00ff88' || c === '#ff66ff' ? '#00ff88' : '#ffb000' };
    }
    _fmaPrev[i] = key;
    const F = _fmaFlash[i];
    if (F && on && now - F.t < FMA_FLASH_MS) {
      if (Math.floor((now - F.t) / 500) % 2 === 0) {
        const L = 6, x0 = bx + 1.5, y0 = Y0 + 1.5, x1 = bx + cellW - 1.5, y1 = Y0 + BOX_H - 1.5;
        ctx.strokeStyle = F.col; ctx.lineWidth = 2; ctx.beginPath();
        [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([cx, cy, dx, dy]) => {
          ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L);
        });
        ctx.stroke();
      }
    } else if (F) _fmaFlash[i] = null;
  }
  ctx.restore();
}
const FMA_FLASH_MS = 10000;
const _fmaPrev = [], _fmaFlash = [null, null, null];

// ────────────────────────────────────────
// CRHT ALTITUDE DISPLAY  (bottom-right of PFD)
// Mini altitude tape centred on selCrht, showing the current RADAR altitude on it
// (전파고도 — 지형 자료로 잰 지면 위 높이 AGL, 05-gps.js radarAltFt).
// 기압고도(ALT 테이프)와 달리 산 위에서는 그만큼 낮게, 바다 위에서는 같게 읽힌다.
// ────────────────────────────────────────
function drawCrhtDisplay(x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(18,30,48,0.55)'; ctx.fillRect(x, y, w, h);   // 땅 위에 반투명

  // ── Target/VS header box (top) ──
  const HEAD_H = 26;
  const tapeY  = y + HEAD_H;
  const tapeH  = h - HEAD_H;
  // T/D to H 중에는 같은 창이 HHT(내려가 멈출 호버 높이)를 보여 준다
  const tdv    = (typeof tdOn !== 'undefined') && tdOn;
  const target = tdv ? selHht : selCrht;
  const cy     = tapeY + tapeH / 2;
  const pp100  = tapeH / 20;
  const on     = crhtOn || tdv;
  const tickColor = on ? '#44ff88' : '#555';
  let ra = S.alt;
  try { ra = radarAltFt(); } catch (e) { _swallow(e); }

  // Tape ticks centred on target (within moving-scale region only)
  const ccv = A_CV(), cMin = unitAlt === 'm' ? 50 : 100, cMaj = unitAlt === 'm' ? 100 : 500;
  const dTgt = target * ccv;
  const a0 = Math.floor((dTgt - 1100 * ccv) / cMin) * cMin;
  for (let a = a0; a <= dTgt + 1200 * ccv; a += cMin) {
    const ty = cy - (a / ccv - target) * pp100 / 100;
    if (ty < tapeY || ty > tapeY + tapeH) continue;
    const maj = Math.abs(a % cMaj) < 1e-6;
    ctx.strokeStyle = maj ? tickColor : '#282828';
    ctx.lineWidth   = maj ? 1.5 : 0.8;
    ctx.beginPath(); ctx.moveTo(x + 7, ty); ctx.lineTo(x + (maj ? 16 : 10), ty); ctx.stroke();
    if (maj) {
      ctx.fillStyle  = tickColor;
      ctx.font       = `${Math.max(8, w * 0.14)}px Helvetica Neue, Arial, sans-serif`;
      ctx.textAlign  = 'left';
      ctx.fillText(Math.round(a), x + 18, ty + 4);
    }
  }

  // Current altitude marker (triangle on left edge)
  const altY = cy - (ra - target) * pp100 / 100;
  if (altY >= tapeY + 3 && altY <= tapeY + tapeH - 3) {
    ctx.fillStyle = on ? '#00cfff' : '#555';
    ctx.beginPath();
    ctx.moveTo(x + 1, altY);
    ctx.lineTo(x + 7, altY - 5);
    ctx.lineTo(x + 7, altY + 5);
    ctx.closePath(); ctx.fill();
  }

  // Current altitude readout box (centre of tape) — mirrors ALT tape style
  const bh = 22;
  ctx.fillStyle   = '#000';
  ctx.fillRect(x, cy - bh / 2, w, bh);
  ctx.strokeStyle = on ? '#44ff88' : '#333';
  ctx.lineWidth   = on ? 1.5 : 1;
  ctx.strokeRect(x, cy - bh / 2, w, bh);
  ctx.fillStyle   = on ? '#44ff88' : '#555';
  ctx.font        = `bold ${Math.max(10, w * 0.16)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign   = 'center';
  ctx.fillText(Math.round(ra * ccv), x + w / 2 + 5, cy + 5);
  // 이 값이 전파고도임을 적어 둔다
  ctx.font      = `bold ${Math.max(7, w * 0.10)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = on ? '#44ff88' : '#666';
  ctx.fillText('RA', x + 3, cy + 4);

  // ── CRHT setting + change-rate box (top header) — same style as ALT header ──
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 1, y + 1, w - 2, HEAD_H - 2);
  ctx.strokeStyle = on ? '#44ff88' : '#333';
  ctx.lineWidth   = on ? 1.5 : 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, HEAD_H - 2);

  // Line 1: "CRHT" label + selCrht setting value
  ctx.font      = `bold ${Math.max(9, w * 0.14)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = on ? '#44ff88' : '#555';
  ctx.fillText((tdv ? 'HHT ' : 'CRHT ') + A_LBL(), x + 4, y + 11);
  ctx.font      = `bold ${Math.max(10, w * 0.16)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = on ? '#fff' : '#666';
  ctx.fillText(Math.round(target * ccv), x + w - 4, y + 11);

  // Line 2: VS change rate (500 fpm during convergence)
  let vsStr = '---';
  if (tdv) vsStr = String(Math.round(S.vs || 0));
  else if (on) {
    const d = selCrht - ra;
    vsStr = Math.abs(d) < 1 ? '0' : (d > 0 ? '+' : '−') + '500';
  }
  ctx.font      = `${Math.max(8, w * 0.13)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = on ? '#ffaa44' : '#444';
  ctx.fillText('VS', x + 4, y + 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = on ? '#ffaa44' : '#444';
  ctx.fillText(vsStr, x + w - 4, y + 22);

  ctx.restore();
}

// ────────────────────────────────────────
// ATTITUDE INDICATOR
// ────────────────────────────────────────
// ── 내활·외활 볼(slip/skid) ── 롤 눈금 맨 위 지표 바로 위에 둔다.
// 볼이 가운데 두 선 사이에 있으면 협조 비행이다. 낮은 날개 쪽으로 가면 내활(slip),
// 선회 바깥쪽으로 가면 외활(skid) — 볼 쪽 페달을 밟으면 가운데로 돌아온다.
// 볼은 기체가 느끼는 옆 힘의 각(atan, slipBall 07-sim.js)만큼 구르고, 관 끝이 SLIP_BALL_FS°.
const SLIP_ROOM     = 15;   // 볼 관이 차지하는 높이(롤 눈금을 이만큼 내려 그린다)
const SLIP_BALL_FS  = 12;   // 볼이 관 끝에 닿는 옆 힘의 각(°)
function drawSlipBall(cx, top, half) {
  const th = SLIP_ROOM - 4, r = th / 2, cy = top + r;
  const sb = (gpsMode || _fdrPlaying) ? 0 : slipBall;
  const k = Math.max(-1, Math.min(1, Math.atan(sb) / D2R / SLIP_BALL_FS));
  // 회전익 특성의 선회 외활 — 볼을 반 볼(반지름)만큼 바깥쪽으로(14-simmode.js simSkidHalf)
  const skid = (typeof simSkidHalf !== 'undefined' && simModeOn && !gpsMode && !_fdrPlaying) ? simSkidHalf : 0;
  const bx = Math.max(cx - half + r, Math.min(cx + half - r, cx + k * (half - r) + skid * r));
  ctx.save();
  // 관(가로로 누운 캡슐)
  ctx.beginPath();
  ctx.arc(cx - half + r, cy, r, Math.PI / 2, Math.PI * 1.5);
  ctx.arc(cx + half - r, cy, r, Math.PI * 1.5, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1; ctx.stroke();
  // 볼
  ctx.beginPath(); ctx.arc(bx, cy, r - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  // 가운데 기준선 두 줄 — 볼 지름만큼 벌려 둔다(볼이 그 사이에 들면 협조)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    const lx = cx + s * (r - 0.5);
    ctx.beginPath(); ctx.moveTo(lx, top - 1); ctx.lineTo(lx, top + th + 1); ctx.stroke();
  }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    const lx = cx + s * (r - 0.5);
    ctx.beginPath(); ctx.moveTo(lx, top - 1); ctx.lineTo(lx, top + th + 1); ctx.stroke();
  }
  ctx.restore();
  return bx;
}
function drawAI(x, y, w, h) {
  // 하늘·땅은 넓게(w) 칠하되, 피치 사다리·심볼·글자 크기는 화면이 넓어도 커지지 않게(wS — 높이에 맞춘 폭)
  const wS = Math.min(w, (h - FMA_MARGIN - FMA_BOX_H) * 1.6);
  const FMA_H = FMA_MARGIN + FMA_BOX_H;  // AFCS strip height
  const aiY   = y + FMA_H;               // AI content starts below AFCS strip
  const aiH   = h - FMA_H;
  const cx = x + w/2, cy = aiY + aiH * 0.47;
  const ppd = aiH / 28;

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  // Inner clip: restrict all sky/horizon/bank-scale drawing to below the AFCS strip.
  // Without this the sky fillRect paints over the AFCS strip area.
  ctx.save();
  ctx.beginPath(); ctx.rect(x, aiY, w, aiH); ctx.clip();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-S.bnk * D2R);
  const skyY = S.pit * ppd;
  const sg = ctx.createLinearGradient(0,-h,0,0);
  sg.addColorStop(0,'#1e5f9e'); sg.addColorStop(1,'#4a90c8');
  ctx.fillStyle = sg;
  ctx.fillRect(-w*2,-h*2,w*4,h*2+skyY);
  const gg = ctx.createLinearGradient(0,skyY,0,skyY+h);
  gg.addColorStop(0,'#654321'); gg.addColorStop(1,'#654321');
  ctx.fillStyle = gg;
  ctx.fillRect(-w*2,skyY,w*4,h*2);
  ctx.strokeStyle='#fff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-w*2,skyY); ctx.lineTo(w*2,skyY); ctx.stroke();

  ctx.font=`${Math.max(8,wS*0.022)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign='center'; ctx.fillStyle='#fff';
  // 2.5° minor ticks (drawn first, thinner)
  for (let p=-25;p<=25;p+=2.5) {
    if (Math.round(p*10)%50===0) continue; // skip multiples of 5°
    const py=skyY-p*ppd;
    if (Math.abs(py)>h*1.1) continue;
    const lw=wS*0.05;
    ctx.strokeStyle='#aaa'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-lw/2,py); ctx.lineTo(lw/2,py); ctx.stroke();
  }
  for (let p=-25;p<=25;p+=5) {
    if (p===0) continue;
    const py=skyY-p*ppd;
    if (Math.abs(py)>h*1.1) continue;
    const lw=(p%10===0)?wS*0.17:wS*0.09;
    ctx.strokeStyle='#fff'; ctx.lineWidth=p%10===0?1.5:1;
    ctx.beginPath(); ctx.moveTo(-lw/2,py); ctx.lineTo(lw/2,py); ctx.stroke();
    if (p%10===0) {
      ctx.fillText(Math.abs(p),-lw/2-15,py+4);
      ctx.fillText(Math.abs(p), lw/2+15,py+4);
    }
  }
  ctx.restore();

  // Bank/roll scale — arc centre sits BELOW the panel top edge so the arc
  // appears within the clip region (old y+br*0.13+4 placed centre above clip,
  // making all tick marks and the pointer invisible).
  // 맨 위에는 내활·외활 볼 자리(SLIP_ROOM)를 비워 두고 그 아래에 그린다.
  const br=Math.min(w,aiH)*0.44;
  const arcR=br*0.88;
  ctx.save(); ctx.translate(cx, aiY + SLIP_ROOM + arcR + 4);
  ctx.strokeStyle='#bbb'; ctx.lineWidth=1;
  for (const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]) {
    const r=(a-90)*D2R;
    const r2=arcR*(Math.abs(a)%30===0?0.84:0.91);
    ctx.beginPath(); ctx.moveTo(Math.cos(r)*arcR,Math.sin(r)*arcR);
    ctx.lineTo(Math.cos(r)*r2,Math.sin(r)*r2); ctx.stroke();
  }
  // Fixed roll reference index at 0° bank (cyan, does not rotate — aircraft reference)
  ctx.fillStyle='#00cfff';
  ctx.beginPath();
  ctx.moveTo(0,-arcR+1); ctx.lineTo(-4,-arcR+9); ctx.lineTo(4,-arcR+9);
  ctx.closePath(); ctx.fill();
  // Rotating bank pointer (white, moves with aircraft bank)
  ctx.save(); ctx.rotate(-S.bnk*D2R);
  ctx.fillStyle='#fff'; ctx.beginPath();
  ctx.moveTo(0,-arcR); ctx.lineTo(-6,-arcR+11); ctx.lineTo(6,-arcR+11);
  ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.restore();

  drawSlipBall(cx, aiY + 3, Math.max(26, arcR * 0.3));

  ctx.save(); ctx.translate(cx,cy);
  const ws=wS*0.14;
  ctx.strokeStyle='#fff'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(-ws,0); ctx.lineTo(-ws*0.35,0); ctx.lineTo(-ws*0.12,ws*0.22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( ws,0); ctx.lineTo( ws*0.35,0); ctx.lineTo( ws*0.12,ws*0.22); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
  ctx.restore();


  // ── Flight Path Vector (FPV) ── — 3D 창의 FPV 버튼으로 켜고 끈다(07-sim.js toggleFpv)
  if (typeof fpvOn === 'undefined' || fpvOn) {
    const driftDeg = normAS(computeTrack() - S.hdg);
    // 비행경로각(오르면 +) — 수평선(cy + 피치)에서 그만큼 위. 예전에는 부호가 뒤집혀 오를 때 아래로 갔고 피치를 빼지 않아
    // 저속 · 호버에서 크게 오르내리면 자세계 밖으로 나가 보이지 않았다
    const fpaDeg = Math.atan2(S.vs / 60, Math.max(5, S.spd) * 1.6878) / D2R;
    const fpvX = cx + driftDeg * ppd;
    const fpvY = cy + (S.pit - fpaDeg) * ppd;
    const fr = Math.max(7, wS * 0.038);
    // 자세계 밖으로 나가면(저속 · 호버에서 오르내릴 때, 바람에 크게 밀릴 때) 가장자리에 붙여 점선으로 그린다
    // — 예전에는 아예 그리지 않아 FPV ON 인데도 안 보이는 때가 있었다
    const x0 = x + fr * 2.4 + 2, x1 = x + w - fr * 2.4 - 2, y0 = aiY + fr * 1.8 + 2, y1 = aiY + aiH - fr - 10;
    const fx = Math.max(x0, Math.min(x1, fpvX)), fy = Math.max(y0, Math.min(y1, fpvY));
    const clamped = Math.abs(fx - fpvX) > 0.5 || Math.abs(fy - fpvY) > 0.5;
    if (x1 > x0 && y1 > y0) {
      const fpvX = fx, fpvY = fy;
      ctx.save();
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
      if (clamped) { ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.85; }
      ctx.beginPath(); ctx.arc(fpvX, fpvY, fr, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fpvX - fr * 2.3, fpvY); ctx.lineTo(fpvX - fr, fpvY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fpvX + fr, fpvY); ctx.lineTo(fpvX + fr * 2.3, fpvY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fpvX, fpvY - fr); ctx.lineTo(fpvX, fpvY - fr * 1.7); ctx.stroke();
      ctx.restore();
    }
  }
  // LIGHT ON WHEELS — 땅에 붙은 채 바퀴가 떨어지기 직전(SIM · 14-simmode.js simLightOnWheels)
  if (typeof simLightOnWheels === 'function' && simLightOnWheels()) {
    const txt = 'LIGHT ON WHEELS';
    ctx.font = `bold ${Math.max(10, wS * 0.032)}px Helvetica Neue, Arial, sans-serif`;
    const tw = ctx.measureText(txt).width + 14, th = Math.max(16, wS * 0.045);
    const ty = aiY + aiH - th - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(cx - tw / 2, ty, tw, th);
    ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - tw / 2, ty, tw, th);
    ctx.fillStyle = '#ffb000'; ctx.textAlign = 'center';
    ctx.fillText(txt, cx, ty + th * 0.72);
  }
  // EMER BRAKE — 비상 브레이크(SIM). 파킹 브레이크는 자세계에 띄우지 않고 메시지 시현창(pfdMsgs)에만 보인다
  const emerBrk = typeof simEmerBrakeOn === 'function' && simEmerBrakeOn();
  if (emerBrk) {
    const txt = 'EMER BRAKE', col = '#ffb000';
    ctx.font = `bold ${Math.max(10, wS * 0.032)}px Helvetica Neue, Arial, sans-serif`;
    const tw = ctx.measureText(txt).width + 14, th = Math.max(16, wS * 0.045);
    const ty = aiY + aiH - 2 * th - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(cx - tw / 2, ty, tw, th);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(cx - tw / 2, ty, tw, th);
    ctx.fillStyle = col; ctx.textAlign = 'center';
    ctx.fillText(txt, cx, ty + th * 0.72);
  }
  // SIM 경고(위쪽 가운데) — 엔진 · VRS · VNE
  {
    const warns = [];
    try {
      if (typeof simEng !== 'undefined' && simModeOn) {
        if (simEng === 1) {
          const left = Math.max(0, OEI_25_SEC - simOeiT);
          warns.push([left > 0 ? `OEI 2.5MIN ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'OEI CONT', '#ffb000']);
          if (simEngTrng) warns.push([`ENG ${simEngFail} TRNG`, '#00e5ff']);   // 상부 콘솔 TRAINING 으로 든 OEI 훈련
        } else if (simEng === 0) warns.push([simEngSt[1] === 'OFF' && simEngSt[2] === 'OFF' ? 'ENG OFF' : 'ENG IDLE', '#ff3030']);
        if (simVrsOn()) warns.push(['VRS', '#ff3030']);
        if (simOverVne()) warns.push(['VNE', '#ff3030']);
      }
    } catch (e) { _swallow(e); }
    ctx.font = `bold ${Math.max(10, wS * 0.032)}px Helvetica Neue, Arial, sans-serif`;
    const th = Math.max(16, wS * 0.045);
    warns.forEach(([txt, col], i) => {
      const tw = ctx.measureText(txt).width + 14, ty = aiY + 8 + i * (th + 4);
      const blink = col === '#ff3030' && Math.floor(performance.now() / 400) % 2 === 0;
      ctx.fillStyle = blink ? 'rgba(200,20,20,0.85)' : 'rgba(0,0,0,0.75)'; ctx.fillRect(cx - tw / 2, ty, tw, th);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(cx - tw / 2, ty, tw, th);
      ctx.fillStyle = blink ? '#ffffff' : col; ctx.textAlign = 'center';
      ctx.fillText(txt, cx, ty + th * 0.72);
    });
  }
  ctx.restore();  // end inner clip (AI content area)

  // AFCS strip drawn last in outer clip — sky/horizon cannot overwrite it
  drawFMA(x, y, w);

  ctx.restore();
}

// ────────────────────────────────────────
// SPEED TAPE
// ────────────────────────────────────────
// ── TQ(토크) 계기 ──
// 헬기에서 제일 많이 보는 계기다. 컬렉티브를 올린 만큼 토크가 오르고,
// 지금 필요한 토크(호버 기준 + 뱅크 − 전진양력)보다 남으면 그만큼 올라간다.
// 그래서 막대 위의 '필요 토크' 표식과 지금 값의 차이가 곧 상승·강하다.
// 구간별 색 — 막대(fill)·막대 끝(edge)·숫자(text)·바탕(tint)
const TQ_COLORS = {
  green:  { fill: '#22dd55', edge: '#8af0a8', text: '#ffffff', tint: 'rgba(0,200,80,0.16)' },
  yellow: { fill: '#ffcc00', edge: '#ffe36a', text: '#ffcc00', tint: 'rgba(255,204,0,0.22)' },
  red:    { fill: '#ff4444', edge: '#ff8888', text: '#ff5555', tint: 'rgba(255,60,60,0.25)' },
};
// TQ % — 엔진마다 막대 하나(TQ1·TQ2). 구간 색(0~100 녹 · 100~113 노 · 113~ 빨)과 기준선(HOV·Vy·MTA)은 두 막대에 같이.
function drawTqGauge(x, y, w, h, vals) {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 1, y - 8, w + 2, h + 9); ctx.clip();
  _engBox(x, y, w, h, 'TQ %');

  let tq = 0, need = 60, over = false;
  try { tq = tqShown(); need = tqRequired(); over = tqOver(); } catch (e) { _swallow(e); }
  vals = Array.isArray(vals) && vals.length ? vals : [tq];
  const n = vals.length;
  const labW = 18;                                     // 오른쪽 이름표(HOV·Vy·MTA) 자리
  const colW = (w - 8 - labW) / n, barW = Math.max(6, Math.min(14, colW * 0.5));
  const barY = y + 30, barH = h - 36;
  const vToY = v => barY + barH * (1 - Math.max(0, Math.min(TQ_MAX, v)) / TQ_MAX);
  const cxs = vals.map((_, i) => x + 4 + colW * (i + 0.5));

  // 엔진 이름 · 숫자(든 구간의 색 — 녹색 구간이면 흰 글자)
  vals.forEach((v, i) => {
    const c = TQ_COLORS[tqBand(v)];
    ctx.textAlign = 'center';
    ctx.font = 'bold 8px Helvetica, Arial'; ctx.fillStyle = '#c6ced6';
    ctx.fillText(n > 1 ? 'TQ' + (i + 1) : 'TQ', cxs[i], y + 13);
    ctx.font = `bold ${Math.max(10, Math.min(13, colW * 0.42))}px Helvetica, Arial`; ctx.fillStyle = c.text;
    ctx.fillText(v.toFixed(0), cxs[i], y + 26);
  });

  if (barH > 10) {
    const x0 = cxs[0] - barW / 2, x1 = cxs[n - 1] + barW / 2;
    vals.forEach((v, i) => {
      const bx = cxs[i] - barW / 2, c = TQ_COLORS[tqBand(v)];
      // 바탕 + 구간 — 0~100 녹색 · 100~113 노랑 · 113~ 빨강
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, barY, barW, barH);
      [[0, TQ_LIMIT, 'green'], [TQ_LIMIT, TQ_RED, 'yellow'], [TQ_RED, TQ_MAX, 'red']].forEach(([lo, hi, k]) => {
        ctx.fillStyle = TQ_COLORS[k].tint;
        ctx.fillRect(bx, vToY(hi), barW, vToY(lo) - vToY(hi));
      });
      // 지금 토크 — 아래에서 채운다. 든 구간의 색으로 칠한다
      const topY = vToY(v);
      ctx.fillStyle = c.fill; ctx.fillRect(bx, topY, barW, barY + barH - topY);
      ctx.strokeStyle = c.edge; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, topY + 0.5); ctx.lineTo(bx + barW, topY + 0.5); ctx.stroke();
    });

    // 기준선 세 개 — 두 막대를 가로질러 긋고 이름표는 오른쪽에(겹치면 아래로 비켜 적는다)
    //   HOV(노랑) : 지금 수평 비행에 필요한 토크 — 여기에 맞추면 고도가 유지된다
    //   Vy (흰색) : PERF 의 Vy 로 수평 비행할 때 필요한 토크 — 가장 적게 드는 토크
    //   MTA(청록) : 그날 엔진이 낼 수 있는 최대 토크(PERF 의 MTA(30)) — 넘겨 당기면 RPM LOW
    let vyTq = null, mta = null;
    try { vyTq = tqAtVy(); mta = mtaNow(); } catch (e) { _swallow(e); }
    const marks = [{ v: need, txt: 'HOV', col: '#ffcc44', w: 1.5 }];
    if (Number.isFinite(vyTq)) marks.push({ v: vyTq, txt: 'Vy', col: '#ffffff', w: 1.2 });
    if (Number.isFinite(mta) && mta < TQ_MAX) marks.push({ v: mta, txt: 'MTA', col: '#00e5ff', w: 2 });
    marks.forEach(mk => {
      mk.y = Math.round(vToY(mk.v)) + 0.5;
      ctx.strokeStyle = mk.col; ctx.lineWidth = mk.w;
      ctx.beginPath(); ctx.moveTo(x0 - 2, mk.y); ctx.lineTo(x1 + 3, mk.y); ctx.stroke();
    });
    ctx.textAlign = 'left';
    ctx.font = 'bold 7px Helvetica, Arial';
    marks.slice().sort((a, b) => a.y - b.y).forEach((mk, i, arr) => {
      mk.ly = i ? Math.max(mk.y, arr[i - 1].ly + 8) : mk.y;
      ctx.fillStyle = mk.col;
      ctx.fillText(mk.txt, x1 + 4, mk.ly + 2.5);
    });

    // 레버 표식(SIM) — 레버가 MTA 를 넘겨 토크보다 위에 있으면 그 자리를 흰 삼각형으로
    const cmd = (simModeOn && typeof simTqCmd === 'number') ? simTqCmd : null;
    if (cmd != null && cmd > tq + 1) {
      const cy = Math.round(vToY(cmd)) + 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(x0 - 1, cy); ctx.lineTo(x0 - 7, cy - 4); ctx.lineTo(x0 - 7, cy + 4);
      ctx.closePath(); ctx.fill();
    }

    // 구간 경계 — 연속 사용 한계(100%) 노란 선 · 오버토크(113%) 붉은 선
    [[TQ_LIMIT, '#ffcc00'], [TQ_RED, '#ff4444']].forEach(([v, c]) => {
      const ly = Math.round(vToY(v)) + 0.5;
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0 - 2, ly); ctx.lineTo(x1 + 3, ly); ctx.stroke();
    });
  }

  ctx.textAlign = 'center';
  if (over) {
    ctx.font = 'bold 8px Helvetica, Arial';
    ctx.fillStyle = '#ff5555';
    ctx.fillText('OVER TQ', x + w / 2, y + h - 8);
  }
  // RPM LOW(SIM) — 레버를 MTA 넘게 당겨 로터 회전이 처졌다. 칸 가운데에 띄우고 바탕을 붉게 깜박인다(글자는 늘 보인다)
  let rpmLow = false, rotorHigh = false;
  try { rpmLow = (typeof simRpmLow === 'function') && simRpmLow(); rotorHigh = !rpmLow && (typeof simRotorHigh === 'function') && simRotorHigh(); } catch (e) { _swallow(e); }
  if (rotorHigh) {                       // 오토로테이션에서 레버를 너무 내려 NR 이 넘쳤다 — 노랑
    const cy = y + h * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(x + 2, cy - 15, w - 4, 26);
    ctx.font = 'bold 8px Helvetica, Arial'; ctx.fillStyle = '#ffb000';
    ctx.fillText('NR HIGH', x + w / 2, cy - 4);
    ctx.fillStyle = '#ffffff'; ctx.fillText('NR ' + simNr.toFixed(0) + '%', x + w / 2, cy + 7);
  }
  if (rpmLow) {
    const cy = y + h * 0.55, blink = Math.floor(performance.now() / 400) % 2 === 0;
    ctx.fillStyle = blink ? 'rgba(220,30,30,0.9)' : 'rgba(0,0,0,0.85)';
    ctx.fillRect(x + 2, cy - 15, w - 4, 26);
    ctx.font = 'bold 8px Helvetica, Arial';
    ctx.fillStyle = blink ? '#ffffff' : '#ff5555';
    ctx.fillText('RPM LOW', x + w / 2, cy - 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NR ' + simNr.toFixed(0) + '%', x + w / 2, cy + 7);
  }
  ctx.restore();
}

function drawSpeedTape(x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.fillStyle='rgba(18,30,48,0.55)'; ctx.fillRect(x,y,w,h);   // 자세계 위에 반투명으로 얹는다
  const cy=y+h/2, ppk=h/80;
  // Existing V-speed bands (right edge) — structural airspeed limits.
  const bands=[[0,65,'rgba(255,255,255,0.1)'],[65,125,'rgba(0,180,0,0.18)'],
    [125,165,'rgba(0,180,0,0.12)'],[165,200,'rgba(255,210,0,0.17)'],[200,250,'rgba(255,50,50,0.22)']];
  for(const[f,t,c]of bands){
    const y1=cy-(t-S.spd)*ppk,y2=cy-(f-S.spd)*ppk;
    ctx.fillStyle=c; ctx.fillRect(x+w-6,Math.max(y,y1),5,Math.min(h,y2-y1));
  }
  // ASE/wind reference bands (left edge) — show where motion is ASE-protected
  // (hover) and where wind starts to drift the aircraft (transition). Above
  // WIND_HI the helicopter is in full cruise (no band).
  const aseBands = [
    [0,        WIND_LO,  'rgba(180,100,220,0.28)'], // hover: ASE on
    [WIND_LO,  WIND_HI,  'rgba(255,200,0,0.25)' ],  // transition: wind ramps in
  ];
  for (const [f, t, c] of aseBands) {
    const y1 = cy - (t - S.spd) * ppk;
    const y2 = cy - (f - S.spd) * ppk;
    ctx.fillStyle = c;
    ctx.fillRect(x + 1, Math.max(y, y1), 5, Math.min(h, y2 - y1));
  }
  // Boundary tick marks at WIND_LO and WIND_HI (small notches on left edge)
  ctx.strokeStyle = 'rgba(200,200,200,0.6)';
  ctx.lineWidth = 1;
  for (const sBound of [WIND_LO, WIND_HI]) {
    const ty = cy - (sBound - S.spd) * ppk;
    if (ty < y + 1 || ty > y + h - 1) continue;
    ctx.beginPath(); ctx.moveTo(x + 1, ty); ctx.lineTo(x + 8, ty); ctx.stroke();
  }
  // 눈금은 표시 단위(kt 또는 km/h) 기준의 라운드 값으로 그린다
  const scv = S_CV(), sMin = unitSpd === 'kmh' ? 10 : 5, sMaj = unitSpd === 'kmh' ? 20 : 10;
  const dSpd = S.spd * scv;                       // 현재 속도(표시 단위)
  const d0 = Math.floor((dSpd - 44 * scv) / sMin) * sMin;
  for (let d = d0; d <= dSpd + 52 * scv; d += sMin) {
    if (d < 0) continue;
    const ty = cy - (d / scv - S.spd) * ppk;      // 위치는 내부(kt) 기준 유지
    if (ty < y || ty > y + h) continue;
    const maj = Math.abs(d % sMaj) < 1e-6;
    ctx.strokeStyle = maj ? '#fff' : '#555'; ctx.lineWidth = maj ? 1.5 : 0.8;
    ctx.beginPath(); ctx.moveTo(x+w-6,ty); ctx.lineTo(x+w-(maj?15:10),ty); ctx.stroke();
    if (maj) {
      ctx.fillStyle='#fff'; ctx.font=`${Math.max(9,w*0.17)}px Helvetica Neue, Arial, sans-serif`;
      ctx.textAlign='right'; ctx.fillText(Math.round(d),x+w-17,ty+4);
    }
  }
  const bh=22;
  ctx.fillStyle='#000'; ctx.fillRect(x,cy-bh/2,w,bh);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.strokeRect(x,cy-bh/2,w,bh);
  ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(13,w*0.2)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign='center'; ctx.fillText(Math.round(S.spd*scv),x+w/2,cy+6);
  ctx.fillStyle='#aaa'; ctx.font='bold 8px Helvetica Neue, Arial, sans-serif';
  ctx.fillText(S_LBL(),x+w/2,y+11);
  // SIM 모드 IAS 상위모드 — 선택 속도 벅(청록, 오른쪽 가장자리)과 그 값(맨 위)
  if (simModeOn && simIasOn && !gspdOn) {
    const by = Math.max(y + 4, Math.min(y + h - 4, cy - (selSpd - S.spd) * ppk));
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(x + w, by - 6); ctx.lineTo(x + w - 7, by - 6); ctx.lineTo(x + w - 7, by - 2);
    ctx.lineTo(x + w - 3, by); ctx.lineTo(x + w - 7, by + 2); ctx.lineTo(x + w - 7, by + 6);
    ctx.lineTo(x + w, by + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(x + 2, y + 14, w - 4, 14);
    ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 11px Helvetica Neue, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(Math.round(selSpd * scv), x + w / 2, y + 25);
  }
  // Speed trend vector (magenta, 6-second extrapolation)
  if (Math.abs(spdTrend) > 0.5) {
    const trendY = cy - spdTrend * ppk;
    const clampedY = Math.max(y + 2, Math.min(y + h - 2, trendY));
    ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w - 22, cy); ctx.lineTo(x + w - 22, clampedY); ctx.stroke();
    const arrowDir = spdTrend > 0 ? -1 : 1;
    ctx.fillStyle = '#ff44ff';
    ctx.beginPath();
    ctx.moveTo(x + w - 22, clampedY);
    ctx.lineTo(x + w - 26, clampedY + arrowDir * 6);
    ctx.lineTo(x + w - 18, clampedY + arrowDir * 6);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ────────────────────────────────────────
// ALTITUDE TAPE
// ────────────────────────────────────────
function drawAltTape(x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.fillStyle='rgba(18,30,48,0.55)'; ctx.fillRect(x,y,w,h);   // 자세계 위에 반투명으로 얹는다

  // ── Target/VS box at the top — shows the AFCS ALT setting + change rate ──
  // Height is reserved at the top of the tape so the moving scale starts below it.
  const HEAD_H = 26;
  const tapeY  = y + HEAD_H;
  const tapeH  = h - HEAD_H;
  const cy     = tapeY + tapeH / 2;
  const pp100  = tapeH / 20;

  // Tape ticks within the moving-scale region only (표시 단위 기준 라운드 눈금)
  const acv = A_CV(), aMin = unitAlt === 'm' ? 50 : 100, aMaj = unitAlt === 'm' ? 100 : 500;
  const dAlt = S.alt * acv;
  const d0 = Math.floor((dAlt - 1100 * acv) / aMin) * aMin;
  for (let d = d0; d <= dAlt + 1200 * acv; d += aMin) {
    const ty = cy - (d / acv - S.alt) * pp100 / 100;
    if (ty < tapeY || ty > tapeY + tapeH) continue;
    const maj = Math.abs(d % aMaj) < 1e-6;
    ctx.strokeStyle = maj ? '#fff' : '#555'; ctx.lineWidth = maj ? 1.5 : 0.8;
    ctx.beginPath(); ctx.moveTo(x + 7, ty); ctx.lineTo(x + (maj ? 16 : 10), ty); ctx.stroke();
    if (maj) {
      ctx.fillStyle = '#fff'; ctx.font = `${Math.max(9, w * 0.16)}px Helvetica Neue, Arial, sans-serif`;
      ctx.textAlign = 'left'; ctx.fillText(Math.round(d), x + 18, ty + 4);
    }
  }

  // selAlt target bug — cyan triangle on left edge when ALT hold active
  if (altHoldOn) {
    const tay = cy - (selAlt - S.alt) * pp100 / 100;
    if (tay >= tapeY + 3 && tay <= tapeY + tapeH - 3) {
      ctx.fillStyle = '#00cfff';
      ctx.beginPath();
      ctx.moveTo(x + 1, tay);
      ctx.lineTo(x + 7, tay - 5);
      ctx.lineTo(x + 7, tay + 5);
      ctx.closePath(); ctx.fill();
    }
  }

  // Current altitude readout (centre of moving scale)
  const bh = 22;
  ctx.fillStyle = '#000'; ctx.fillRect(x, cy - bh/2, w, bh);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x, cy - bh/2, w, bh);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(12, w * 0.17)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.fillText(Math.round(S.alt * acv), x + w/2, cy + 5);

  // ── ALT setting + change-rate box (top header) ──
  // Active when ALT hold is engaged; dim otherwise. Tappable for selAlt edit.
  const on = altHoldOn;
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 1, y + 1, w - 2, HEAD_H - 2);
  ctx.strokeStyle = on ? '#00cfff' : '#333';
  ctx.lineWidth   = on ? 1.5 : 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, HEAD_H - 2);

  // Line 1: "ALT" label + selAlt value
  ctx.font      = `bold ${Math.max(9, w * 0.14)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = on ? '#00cfff' : '#666';
  ctx.fillText('ALT ' + A_LBL(), x + 4, y + 11);
  ctx.font      = `bold ${Math.max(10, w * 0.16)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = on ? '#fff' : '#777';
  ctx.fillText(Math.round(selAlt * acv), x + w - 4, y + 11);

  // Line 2: VS preselect (selVS) — pilot-settable rate for ALT hold mode.
  // When ALT hold is active, shows signed rate matching convergence direction.
  // When idle/off, shows the preselected magnitude (so the pilot can confirm
  // their setting before engaging). Tap the VS row to change selVS.
  let vsStr;
  if (on) {
    const d = selAlt - S.alt;
    vsStr = Math.abs(d) < 1 ? '0' : (d > 0 ? '+' : '−') + Math.abs(selVS);
  } else {
    vsStr = String(Math.abs(selVS));
  }
  ctx.font      = `${Math.max(8, w * 0.13)}px Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = on ? '#ffaa44' : '#665533';
  ctx.fillText('VS', x + 4, y + 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = on ? '#ffaa44' : '#665533';
  ctx.fillText(vsStr, x + w - 4, y + 22);

  // Altitude trend vector (magenta, 6-second VS extrapolation)
  if (Math.abs(vsiSmoothed()) > 10) {
    const altTrend6s = vsiSmoothed() * 0.1;  // ft change in 6 seconds
    const trendY = cy - altTrend6s * pp100 / 100;
    const clampedY = Math.max(tapeY + 2, Math.min(tapeY + tapeH - 2, trendY));
    ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 2, cy); ctx.lineTo(x + 2, clampedY); ctx.stroke();
    const arrowDir = vsiSmoothed() > 0 ? -1 : 1;
    ctx.fillStyle = '#ff44ff';
    ctx.beginPath();
    ctx.moveTo(x + 2, clampedY);
    ctx.lineTo(x - 2, clampedY + arrowDir * 6);
    ctx.lineTo(x + 6, clampedY + arrowDir * 6);
    ctx.closePath(); ctx.fill();
  }

  ctx.restore();
}

// ────────────────────────────────────────
// VSI (Vertical Speed Indicator)
// ────────────────────────────────────────
const VSI_UP = 3000, VSI_DN = 4000;   // 승강계가 읽는 최대 상승·강하율(fpm)
const VSI_KNEE = 1000;                // 이 아래(±1,000fpm)는 반 칸에 넓게 — 그 위는 좁힌다
// 승강률(fpm) → 눈금 위 자리(가운데 0 · 위 끝 +1 · 아래 끝 −1). 끝을 넘으면 끝에 붙는다.
function vsiFrac(fpm) {
  const mx = fpm >= 0 ? VSI_UP : VSI_DN, a = Math.min(Math.abs(fpm), mx);
  const f = a <= VSI_KNEE ? 0.5 * a / VSI_KNEE : 0.5 + 0.5 * (a - VSI_KNEE) / (mx - VSI_KNEE);
  return Math.sign(fpm) * f;
}
let _pfdAltFs = null;   // 고도계 숫자 크기(눈금 · 값 칸) — drawPFD 가 채운다
function drawVSI(x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.fillStyle='rgba(10,18,30,0.6)'; ctx.fillRect(x,y,w,h);   // 고도계 오른쪽에 붙은 반투명 승강계
  // 고도 단위가 m이면 수직속도는 m/s로 표시(눈금도 라운드 m/s 기준)
  // 위로 3,000fpm · 아래로 4,000fpm 까지 읽는다(VSI_UP · VSI_DN). 눈금은 1,000fpm 까지를
  // 반 칸에 넓게 두고 그 위는 좁힌다 — 자주 쓰는 작은 상승률을 잘 읽고, 큰 강하도 담는다.
  const met = unitAlt === 'm';
  const vsD     = fpm => met ? fpm * 0.00508 : fpm;   // fpm → 표시 단위
  const upMax   = vsD(VSI_UP), dnMax = vsD(VSI_DN);   // 표시 단위 최대치 (m/s | fpm)
  const vsStep  = met ? 2.5 : 500;            // 눈금 간격
  const vsMaj   = met ? 5   : 1000;           // 큰 눈금
  const cy=y+h/2, half=h*0.44;
  const vY = v => cy - vsiFrac(met ? v / 0.00508 : v) * half;   // 표시 단위 → 화면 y

  // scale ticks
  for(let v=-Math.floor(dnMax/vsStep+1e-6)*vsStep;v<=upMax+1e-6;v+=vsStep){
    const ty=vY(v);
    if(ty<y+2||ty>y+h-2) continue;
    const maj=Math.abs(v)>1e-6 && Math.abs(v%vsMaj)<1e-6;
    ctx.strokeStyle=maj?'#888':'#444'; ctx.lineWidth=maj?1.5:0.8;
    const tfs = _pfdAltFs ? _pfdAltFs.tick : Math.max(7, w * 0.17);   // 고도계 눈금 숫자와 같은 크기
    const tw=maj?Math.min(w*0.55, w - tfs * 0.75 - 3):w*0.32;
    ctx.beginPath(); ctx.moveTo(x,ty); ctx.lineTo(x+tw,ty); ctx.stroke();
    if(maj){
      ctx.fillStyle='#ccc'; ctx.font=`${tfs}px Helvetica Neue, Arial, sans-serif`;
      ctx.textAlign='left'; ctx.fillText(met?Math.abs(v):Math.abs(v/1000),x+tw+1,ty+tfs*0.36);
    }
  }

  // zero line
  ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x,cy); ctx.lineTo(x+w*0.65,cy); ctx.stroke();

  // pointer triangle — 값 칸에는 실제 값을, 지시침은 눈금 끝까지만
  const vsS=vsiSmoothed();
  const vs=vsD(vsS);
  const py=Math.max(y+8,Math.min(y+h-24,vY(vs)));
  const pc=vsS>50?'#00cc44':vsS<-50?'#ff6644':'#aaa';
  ctx.fillStyle=pc;
  ctx.beginPath(); ctx.moveTo(x+w,py); ctx.lineTo(x+w-9,py-5); ctx.lineTo(x+w-9,py+5); ctx.closePath(); ctx.fill();

  // value box at bottom
  // 값 칸 — 고도계 값과 같은 크기로(칸이 좁아 넘치면 그만큼만 줄인다)
  const vtxt = String(met ? vs.toFixed(1) : Math.round(vs));
  let vfs = _pfdAltFs ? _pfdAltFs.box : Math.max(9, w * 0.2);
  ctx.font = `bold ${vfs}px Helvetica Neue, Arial, sans-serif`;
  const tw0 = ctx.measureText(vtxt).width;
  if (tw0 > w - 2) { vfs = Math.max(8, vfs * (w - 2) / tw0); ctx.font = `bold ${vfs}px Helvetica Neue, Arial, sans-serif`; }
  const bh = Math.max(18, vfs + 6);
  ctx.fillStyle='#000'; ctx.fillRect(x,y+h-bh,w,bh);
  ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.strokeRect(x,y+h-bh,w,bh);
  ctx.fillStyle=pc;
  ctx.textAlign='center'; ctx.fillText(vtxt,x+w/2,y+h-(bh-vfs*0.72)/2);

  // label at top
  ctx.fillStyle='#aaa'; ctx.font='bold 7px Helvetica Neue, Arial, sans-serif';
  ctx.fillText(met?'M/S':'FPM',x+w/2,y+9);

  // ── 글라이드 패스 지시(ILS) ──
  // ILS 를 잡았을 때만 승강계 왼편에 눈금과 마름모가 뜬다. 마름모가 가운데
  // 기준선 위에 있으면 강하선보다 높다는 뜻이다(계기와 같은 읽기).
  // 승강계 지시침은 오른쪽 끝을 쓰므로 왼쪽 끝에 두어 서로 가리지 않는다.
  let gsv = null;
  try { gsv = (typeof gsDeviation === 'function') ? gsDeviation() : null; } catch(e) { _swallow(e); }
  if (gsv) {
    const gx = x + 3.5;                    // 눈금 중심선
    const span = h * 0.30;                 // 최대편위(2점)까지의 길이
    const capt = (typeof gsOn !== 'undefined' && gsOn);
    // 눈금: 가운데 기준선 + 위아래 1·2점
    ctx.strokeStyle = '#7a7a7a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx - 3, cy); ctx.lineTo(gx + 3, cy); ctx.stroke();
    ctx.fillStyle = '#9a9a9a';
    [-2, -1, 1, 2].forEach(n => {
      const dy = cy - n * span / 2;
      if (dy < y + 12 || dy > y + h - 22) return;
      ctx.beginPath(); ctx.arc(gx, dy, 1.6, 0, Math.PI * 2); ctx.fill();
    });
    // 마름모 — 최대편위를 넘으면 끝에 붙이고 속을 비운다(신뢰 구간 밖)
    const dots = Math.max(-2.4, Math.min(2.4, gsv.dots));
    const py2 = Math.max(y + 12, Math.min(y + h - 22, cy - dots * span / 2));
    const col = capt ? '#ff44ff' : '#dd88ff';
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6;
    const r2 = 4.5;
    ctx.beginPath();
    ctx.moveTo(gx, py2 - r2); ctx.lineTo(gx + r2, py2);
    ctx.lineTo(gx, py2 + r2); ctx.lineTo(gx - r2, py2); ctx.closePath();
    if (Math.abs(gsv.dots) > 2) ctx.stroke(); else ctx.fill();
    // 머리글 G/S — 붙잡았으면 밝게
    ctx.fillStyle = capt ? '#ff88ff' : '#996699';
    ctx.font = 'bold 7px Helvetica Neue, Arial, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('G/S', x + 1, y + 18);
  }
  ctx.restore();
}

// ────────────────────────────────────────
// HSI
// ────────────────────────────────────────
// HSI 의 중심·반지름·좌우 남는 폭. 중심(cxC)을 주면 그 세로선에 맞춘다(자세계와 한 줄 — drawPFD)
function hsiGeom(x, y, w, h, cxC) {
  const cx = Number.isFinite(cxC) ? Math.max(x + 40, Math.min(x + w - 40, cxC)) : x + w / 2;
  const hw = Math.min(cx - x, x + w - cx);                       // 중심에서 가까운 가장자리까지
  const r  = Math.max(20, Math.min(hw * (hw < 210 ? 0.80 : 0.76), h * 0.46));
  return { cx, cy: y + h * 0.50, r, leftW: cx - r - x - 8, rightW: x + w - (cx + r) - 8 };
}
function drawHSI(x, y, w, h, cxC) {
  if (!(w >= 40) || !(h >= 40)) return;   // 반지름이 음수가 되는 것을 원천 차단
  ctx.save();  // outer save — ensure lineWidth/strokeStyle don't bleed into drawPFD
  ctx.fillStyle='#654321';
  ctx.fillRect(x,y,w,h);

  const G = hsiGeom(x, y, w, h, cxC);
  const cx   = G.cx;
  const r    = G.r;
  const cy   = G.cy;
  const arrowR = r * 0.84;

  // ── Hover Page mode: simplified HSI + GPS speed readouts ──
  if (hoverPageOn) {
    drawHsiHoverPage(x, y, w, h, cx, cy, r);
    ctx.restore();   // 위의 outer save와 짝 — 없으면 캔버스 상태 스택이 프레임마다 쌓여 시현이 깨진다
    return;
  }

  // ── side panel widths ── (중심을 자세계에 맞추면 좌우 폭이 다르다)
  const sideW = Math.max(30, G.leftW);       // 왼쪽(바람 · TAS/OAT/GS/ISA)
  const sideWR = Math.max(30, G.rightW);     // 오른쪽(NAV SOURCE 3줄)
  const leftX  = x + 4;
  const rightX = cx + r + 4;

  // ── BRG1·BRG2 좌우 패널은 아래 NAV SOURCE 3줄이 대신한다 ──
  // 그 3줄에 FMS·NAV1·NAV2 의 식별자·방위·거리가 이미 다 있어서, 좌측 BRG1
  // 패널은 같은 값을 한 번 더 적는 자리였다. 나침반의 BRG1·BRG2 니들은
  // brg1Visible·brg2Visible 토글로 그대로 유지된다 — 지우는 것은 숫자판뿐이다.

  // ── Wind display (HSI top-right) ── 왼쪽 위에 두면 HDG 칸과 겹쳐 오른쪽 위로 옮겼다
  {
    const wdirFmt = fmtA(toMag(windDir));   // 바람도 자북 기준으로 표기
    const wspdFmt = String(Math.round(windSpd)).padStart(2,'0');
    let wdX = rightX + sideWR / 2;
    const wdY = y + h * 0.10;
    const fs  = Math.max(9, r * 0.105);
    ctx.save();
    ctx.font = `bold ${fs}px Helvetica Neue, Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    // 오른쪽 칸이 좁으면 글자가 CRHT 칸으로 넘지 않게 안쪽으로 물린다
    const wTxt = `${wdirFmt}°/${wspdFmt}kt`;
    wdX = Math.min(wdX, x + w - ctx.measureText(wTxt).width / 2 - 4);
    ctx.fillText(wTxt, wdX, wdY + fs * 1.1);

    // Wind arrow: points in direction wind is blowing TO (windDir + 180)
    const aLen = Math.min(sideWR * 0.32, 14);
    const wto  = normA(windDir + 180) * D2R;
    const ax   = Math.sin(wto) * aLen;
    const ay   = -Math.cos(wto) * aLen;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(wdX, wdY); ctx.lineTo(wdX + ax, wdY + ay); ctx.stroke();
    // arrowhead
    const hs = 4, ba = wto + Math.PI;
    ctx.beginPath();
    ctx.moveTo(wdX + ax, wdY + ay);
    ctx.lineTo(wdX + ax + Math.sin(ba + 0.45)*hs, wdY + ay - Math.cos(ba + 0.45)*hs);
    ctx.lineTo(wdX + ax + Math.sin(ba - 0.45)*hs, wdY + ay - Math.cos(ba - 0.45)*hs);
    ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
    // ── 메시지 시현창(바람 정보 아래) ── 콘솔 스위치 · 엔진 상태를 따른다(pfdMsgs)
    const msgs = _pfdSideMsgs ? [] : pfdMsgs();   // 자세계 오른쪽 칸이 있으면 거기에(drawPfdSideMsgs)
    if (!_pfdSideMsgs) _pfdMsgBottom = wdY + fs * 1.1 + 4;    // 바람 글자 아래끝(메시지가 없을 때)
    if (msgs.length) {
      ctx.save();
      const mx0 = rightX, mw = Math.max(20, x + w - 4 - rightX);
      let mfs = Math.max(7, Math.min(10, r * 0.085));
      ctx.font = `bold ${mfs}px Helvetica Neue, Arial, sans-serif`;
      const widest = Math.max(...msgs.map(m => ctx.measureText(m.t).width));
      if (widest > mw - 4) { mfs = Math.max(6, mfs * (mw - 4) / widest); ctx.font = `bold ${mfs}px Helvetica Neue, Arial, sans-serif`; }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      let my = wdY + fs * 1.1 + 6 + mfs * 1.25;
      msgs.forEach(m => { ctx.fillStyle = m.c; ctx.fillText(m.t, mx0 + 2, my); my += mfs * 1.3; });
      _pfdMsgBottom = my - mfs * 1.3 + mfs * 0.35;
      ctx.restore();
    }
  }

  // (FMS · NAV1 · NAV2 목적지 줄은 오른쪽 아래 칸으로 옮겼다 — drawNavSrcBox · HSI 와 겹치지 않게)

  // ── 좌하단 2줄 정보: ①TAS·OAT ②GS·ISA ──
  {
    // TAS: altitude-corrected from displayed speed (~+2% per 1000 ft)
    const tas = simModeOn ? tasKt(S.spd) : S.spd * (1 + 0.02 * S.alt / 1000);   // SIM 은 실제로 움직이는 TAS 그대로
    // GS: TAS vector + (effective) wind vector. Wind is gated by the
    // speed-dependent effect factor — 0 in hover/low-speed, full at cruise.
    const wto = normA(windDir + 180) * D2R;
    const wEff = effectiveWindSpd();
    const gsN = tas * Math.cos(S.hdg * D2R) + wEff * Math.cos(wto);
    const gsE = tas * Math.sin(S.hdg * D2R) + wEff * Math.sin(wto);
    const gs  = Math.sqrt(gsN*gsN + gsE*gsE);
    // ISA: 표준대기 온도, OAT: 지면 METAR 온도 기준 감률 보정(-1.98°C/1000ft)
    const isaC = 15 - 1.98 * S.alt / 1000;
    const oatC = _oatSurfaceC - 1.98 * S.alt / 1000;

    // 한 줄에 한 가지씩 네 줄 — 왼쪽 아래 구석(둥근 나침반이 비우는 자리)에 붙여, 나침반을 자세계 중심에 맞출 수 있게 한다
    const valFs = Math.max(10, Math.min(16, r * 0.115));
    const lblFs = Math.max(8, Math.min(12, r * 0.08));
    const lblFont = `${lblFs}px Helvetica Neue, Arial, sans-serif`;
    const valFont = `bold ${valFs}px Helvetica Neue, Arial, sans-serif`;
    const _sl = S_LBL().toLowerCase();
    const rows4 = [
      ['TAS', `${Math.round(tas*S_CV())}${_sl}`, '#88ccff'],
      ['OAT', uTemp(oatC), '#ffd54f'],
      ['GS',  `${Math.round(gs*S_CV())}${_sl}`, '#00cc44'],
      ['ISA', uTemp(isaC), '#aaa'],
    ];
    ctx.save();
    ctx.font = lblFont; const lw = Math.max(...rows4.map(q => ctx.measureText(q[0] + ' ').width));
    const sp = valFs * 1.25, y0 = y + h - 6 - sp * 3;
    rows4.forEach((q, k) => {
      const yy = y0 + sp * k;
      ctx.textAlign = 'left';
      ctx.font = lblFont; ctx.fillStyle = '#888'; ctx.fillText(q[0], leftX + 2, yy);
      ctx.font = valFont; ctx.fillStyle = q[2]; ctx.fillText(q[1], leftX + 2 + lw, yy);
    });
    ctx.restore();
  }

  // ── compass ──
  // HSI 카드는 계기 헤딩(MG = 실제 기수, DG = 방향 자이로 — 오차를 품는다)을 따른다.
  // 카드 위의 HDG bug·코스·방위 바늘·지상 항적도 카드 기준으로 그린다.
  const Hi = hdgInd();
  ctx.save(); ctx.translate(cx, cy);

  ctx.beginPath(); ctx.arc(0,0,r+3,0,Math.PI*2);
  ctx.strokeStyle='#1a0e04'; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle='#654321'; ctx.fill();

  // rotating rose
  ctx.save();
  ctx.rotate(-toMag(Hi) * D2R);   // 카드 눈금이 자북(°M)을 가리키게
  for (let a=0;a<360;a+=5) {
    const rad=a*D2R, is30=a%30===0, is10=a%10===0;
    const rOut=r*0.97, rIn=r*(is30?0.87:is10?0.915:0.955);
    ctx.strokeStyle=is30?'#bbb':is10?'#777':'#3a3a3a';
    ctx.lineWidth=is30?2:is10?1.5:0.8;
    ctx.beginPath();
    ctx.moveTo(Math.sin(rad)*rOut,-Math.cos(rad)*rOut);
    ctx.lineTo(Math.sin(rad)*rIn, -Math.cos(rad)*rIn);
    ctx.stroke();
  }
  const ROSE={0:'N',30:'3',60:'6',90:'E',120:'12',150:'15',180:'S',210:'21',240:'24',270:'W',300:'30',330:'33'};
  const fs=Math.max(9,r*0.115);
  for (const [ang,label] of Object.entries(ROSE)) {
    const a=Number(ang), rad=a*D2R, lr=r*0.82;
    ctx.save();
    ctx.translate(Math.sin(rad)*lr,-Math.cos(rad)*lr);
    ctx.rotate(rad);
    ctx.fillStyle=a===0?'#ff5555':'#ddd';
    ctx.font=`bold ${fs}px Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(label,0,0);
    ctx.restore();
  }
  ctx.restore(); // end rose rotation

  // Ground track diamond (magenta, on compass ring)
  {
    const trk = computeTrack();
    const trkRelRad = normAS(trk - Hi) * D2R;
    const gtR = r * 0.97;
    const gtX = Math.sin(trkRelRad) * gtR;
    const gtY = -Math.cos(trkRelRad) * gtR;
    const gs2 = 6;
    ctx.fillStyle = '#ff44ff';
    ctx.beginPath();
    ctx.moveTo(gtX, gtY - gs2);
    ctx.lineTo(gtX + gs2 * 0.55, gtY);
    ctx.lineTo(gtX, gtY + gs2);
    ctx.lineTo(gtX - gs2 * 0.55, gtY);
    ctx.closePath(); ctx.fill();
  }

  // ── HDG bug (선택 헤딩) — 컴퍼스 링 위 청록 노치 ──
  {
    const bugRel = normAS(selHdg - Hi) * D2R;
    const bR = r * 0.99, bw = 5, bh = 7;
    ctx.save();
    ctx.rotate(bugRel);
    ctx.fillStyle = hdgSelOn ? '#00e5ff' : '#4a6a72';
    ctx.beginPath();
    ctx.moveTo(-bw, -bR);        ctx.lineTo(bw, -bR);
    ctx.lineTo(bw, -bR + bh);    ctx.lineTo(bw * 0.35, -bR + bh);
    ctx.lineTo(0, -bR + bh * 0.45);
    ctx.lineTo(-bw * 0.35, -bR + bh); ctx.lineTo(-bw, -bR + bh);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // 선택 헤딩 수치(컴퍼스 상단)
    ctx.fillStyle = hdgSelOn ? '#00e5ff' : '#4a6a72';
    ctx.font = `bold ${Math.max(9, r * 0.115)}px Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtA(toMag(selHdg)) + '°', -r + 2, -r + 6);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  }

  // ── CRS arrow + CDB (Course Deviation Bar) ──
  const dotGap = r * 0.248;
  let cdiOff = 0, cdbActive = false, cdbWp = null;

  if (navSrc === 'FMS' && S.awp >= 0 && S.awp < S.wps.length) {
    // FMS: cross-track error from fwp→awp leg (positive = right of course)
    // CDI deflects opposite: right of course → needle left (negative cdiOff)
    cdbWp = S.wps[S.awp];
    const xtk = courseXtk(activeCourseLine());   // updateNav·지도·AP와 동일 기준선
    cdiOff = Math.max(-1, Math.min(1, -xtk / rnp)) * 2 * dotGap;
    cdbActive = true;
  } else if ((navSrc !== 'FMS') && navLat !== null && navLon !== null) {
    cdbWp = { lat: navLat, lon: navLon };
    const brgFromNav = bearing(navLat, navLon, S.lat, S.lon);
    const devDeg     = normAS(brgFromNav - normA(vorObsCrs + 180));
    const fullScale  = 15;   // NAV1/NAV2 = VOR full-scale
    cdiOff = Math.max(-1, Math.min(1,
      Math.sin(devDeg * D2R) / Math.sin(fullScale * D2R))) * 2 * dotGap;
    cdbActive = true;
  }
  const CG = '#ffffff';
  const dispCrs = activeCrs(); // 현재 navSrc 에 맞는 표시 코스

  ctx.save();
  ctx.rotate((dispCrs - Hi) * D2R);

  // CRS course arrow — 머리: 화살촉, 꼬리: 선만
  ctx.strokeStyle = CG; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -r*0.23); ctx.lineTo(0, -arrowR+14); ctx.stroke();
  ctx.fillStyle = CG; ctx.beginPath();
  ctx.moveTo(0, -arrowR); ctx.lineTo(-6, -arrowR+14); ctx.lineTo(6, -arrowR+14);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, r*0.23); ctx.lineTo(0, arrowR); ctx.stroke();

  // Deviation scale dots ±1, ±2
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    ctx.beginPath(); ctx.arc(i * dotGap, 0, 3.5, 0, Math.PI*2);
    ctx.fillStyle = '#333'; ctx.fill();
    ctx.beginPath(); ctx.arc(i * dotGap, 0, 3.5, 0, Math.PI*2);
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.stroke();
  }

  // CDB needle — vertical bar that moves laterally
  if (cdbActive) {
    ctx.strokeStyle = CG; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cdiOff, -r * 0.38);
    ctx.lineTo(cdiOff,  r * 0.38);
    ctx.stroke();
    // TO / FROM flag
    const brgRef = bearing(S.lat, S.lon, cdbWp.lat, cdbWp.lon);
    const diff = normA(brgRef - dispCrs);
    const toFlag = diff < 90 || diff > 270;
    ctx.fillStyle = CG;
    ctx.font = `bold ${Math.max(8, r*0.095)}px Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(toFlag ? 'TO' : 'FROM', 0, toFlag ? -r*0.34 : r*0.34);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // ── BRG1 needle (VOR/ILS → 파란 단선, 머리 화살촉·꼬리 선) ──
  const _b1st = brgTarget(1);   // 소프트키 Bearing1 이 고른 국(처음은 튜닝된 VOR/ILS)
  if (_b1st) {
    const brg1 = bearing(S.lat, S.lon, _b1st.lat, _b1st.lon);
    ctx.save(); ctx.rotate((brg1 - Hi) * D2R);
    const C1 = '#44aaff';
    ctx.strokeStyle = C1; ctx.fillStyle = C1; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0,-r*0.23); ctx.lineTo(0,-arrowR+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-arrowR); ctx.lineTo(-6,-arrowR+14); ctx.lineTo(6,-arrowR+14); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,r*0.23); ctx.lineTo(0,arrowR); ctx.stroke();
    ctx.restore();
  }

  // ── BRG2 needle (FMS active WP → 녹색 복선, 머리 화살촉·꼬리 선) ──
  const _b2st = brgTarget(2);   // 소프트키 Bearing2 가 고른 국(처음은 FMS 활성 지점)
  if (_b2st) {
    const brg2fms = bearing(S.lat, S.lon, _b2st.lat, _b2st.lon);
    ctx.save(); ctx.rotate((brg2fms - Hi) * D2R);
    const C2 = '#00cc44', g = 5.5;
    ctx.strokeStyle = C2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-g,-r*0.23); ctx.lineTo(-g,-arrowR+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( g,-r*0.23); ctx.lineTo( g,-arrowR+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-g,-arrowR+14); ctx.lineTo(0,-arrowR); ctx.lineTo(g,-arrowR+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-g,r*0.23); ctx.lineTo(-g,arrowR); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( g,r*0.23); ctx.lineTo( g,arrowR); ctx.stroke();
    ctx.restore();
  }

  // ── Ground track indicator (purple diamond at compass edge) ──
  if (windSpd > 0) {
    const trk = computeTrack();
    ctx.save(); ctx.rotate((trk - Hi) * D2R);
    const dR = arrowR + 2;
    const ds = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, -dR);        // top
    ctx.lineTo(ds, -dR + ds);  // right
    ctx.lineTo(0, -dR + ds*2); // bottom
    ctx.lineTo(-ds, -dR + ds); // left
    ctx.closePath();
    ctx.fillStyle = '#cc44cc'; ctx.fill();
    ctx.strokeStyle = '#000';  ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  // ── center aircraft ──
  const mw=r*0.12;
  ctx.strokeStyle='#fff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-mw,0); ctx.lineTo(-mw*0.35,0); ctx.lineTo(-mw*0.12,mw*0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( mw,0); ctx.lineTo( mw*0.35,0); ctx.lineTo( mw*0.12,mw*0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-mw*0.85); ctx.lineTo(0,mw*0.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();

  // ── heading index ──
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.moveTo(0,-r-1); ctx.lineTo(-9,-r+13); ctx.lineTo(9,-r+13); ctx.closePath(); ctx.fill();

  ctx.restore(); // end translate cx,cy

  // ── HDG / CRS readout boxes (Garmin 스타일: 시안 라벨 + 흰 숫자) ──
  // HSI 윗 테두리(y)에 박스 아랫변이 맞닿도록 위로 올려 컴퍼스 로즈와 겹치지 않게 함
  const bw=64, bh=20, gap=4;
  const boxY = y - bh;              // 박스 아랫변 = HSI 윗 테두리
  const txtY = boxY + 14;          // 텍스트 베이스라인(박스 상단 기준 +14)
  const hdgX = cx - bw - gap/2;
  const crsX = cx + gap/2;
  ctx.lineWidth=1;
  // HDG box
  ctx.fillStyle='#000'; ctx.strokeStyle='#555';
  ctx.fillRect(hdgX,boxY,bw,bh); ctx.strokeRect(hdgX,boxY,bw,bh);
  ctx.textAlign='left';
  ctx.fillStyle='#00cfff'; ctx.font='bold 11px Helvetica Neue, Arial, sans-serif';
  ctx.fillText('HDG', hdgX+4, txtY);
  ctx.fillStyle='#fff'; ctx.font='bold 13px Helvetica Neue, Arial, sans-serif'; ctx.textAlign='right';
  ctx.fillText(fmtA(toMag(Hi))+'°', hdgX+bw-4, txtY);
  // DG — 방향 자이로로만 나는 중(자기장에 맞추지 않음). HDG 칸 왼쪽에 호박색으로
  if (hdgRef === 'DG') {
    ctx.fillStyle='#ffb000'; ctx.font='bold 12px Helvetica Neue, Arial, sans-serif';
    ctx.fillText('DG', hdgX-6, txtY);
  }
  // CRS box
  ctx.fillStyle='#000'; ctx.strokeStyle='#555';
  ctx.fillRect(crsX,boxY,bw,bh); ctx.strokeRect(crsX,boxY,bw,bh);
  ctx.textAlign='left';
  ctx.fillStyle='#00cfff'; ctx.font='bold 11px Helvetica Neue, Arial, sans-serif';
  ctx.fillText('CRS', crsX+4, txtY);
  ctx.fillStyle='#fff'; ctx.font='bold 13px Helvetica Neue, Arial, sans-serif'; ctx.textAlign='right';
  ctx.fillText(fmtA(toMag(activeCrs()))+'°', crsX+bw-4, txtY);
  ctx.restore();  // outer restore — matches save at function entry
}

// ── Hover Page HSI: Garmin-style compass rose + GPS speed readouts ──
// HOVER PAGE 전 반경(ft) — 위치 지시자·SHIP·WPT가 모두 이 축척을 공유한다
const HOVER_FT = 50;
// 어떤 좌표의 기체 기준(body frame) 상대 위치를 ft로 반환.
// HOVER PAGE의 세 지시자(호버 위치·SHIP·WPT)가 같은 계산을 각자 갖고 있던 것을 통합.
function bodyRelFt(lat, lon) {
  const M_PER_DEG = 111320, FT_PER_M = 3.28084;
  const relN = (lat - S.lat) * M_PER_DEG * FT_PER_M;
  const relE = (lon - S.lon) * M_PER_DEG * Math.cos(S.lat * D2R) * FT_PER_M;
  const c = Math.cos(S.hdg * D2R), sn = Math.sin(S.hdg * D2R);
  const fwd =  relN * c + relE * sn;
  const lt  = -relN * sn + relE * c;
  return { fwd, lat: lt, dist: Math.hypot(fwd, lt) };
}

function drawHsiHoverPage(x, y, w, h, cx, cy, rFull) {
  const r      = rFull;                        // same radius as normal HSI
  const sideW  = (w - r * 2) / 2 - 6;
  const leftX  = x + 4;
  const rightX = cx + r + 4;

  // ── Compass rose (same position/size as normal HSI) ──
  ctx.save();
  ctx.translate(cx, cy);

  // Dark-brown inner fill (Garmin style)
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fillStyle = '#654321'; ctx.fill();

  // Outer bezel
  ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI*2);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5; ctx.stroke();

  // ── Rotating rose (heading-up) ──
  ctx.save();
  ctx.rotate(-toMag(hdgInd()) * D2R);   // 카드 눈금이 자북(°M)을 가리키게
  for (let a = 0; a < 360; a += 5) {
    const rad = a * D2R, is30 = a % 30 === 0, is10 = a % 10 === 0;
    const rOut = r * 0.97;
    const rIn  = r * (is30 ? 0.87 : is10 ? 0.915 : 0.955);
    ctx.strokeStyle = is30 ? '#ddd' : is10 ? '#888' : '#555';
    ctx.lineWidth   = is30 ? 2 : is10 ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.sin(rad)*rOut, -Math.cos(rad)*rOut);
    ctx.lineTo(Math.sin(rad)*rIn,  -Math.cos(rad)*rIn);
    ctx.stroke();
  }
  // Garmin-style compass labels
  const ROSE_H = {'0':'N','30':'3','60':'6','90':'E','120':'12','150':'15',
                  '180':'S','210':'21','240':'24','270':'W','300':'30','330':'33'};
  const rosFs = Math.max(9, r * 0.115);
  for (const [ang, lbl] of Object.entries(ROSE_H)) {
    const a = Number(ang), rad = a * D2R, lr = r * 0.82;
    ctx.save();
    ctx.translate(Math.sin(rad)*lr, -Math.cos(rad)*lr);
    ctx.rotate(rad);
    ctx.fillStyle = a === 0 ? '#ff5555' : '#ddd';
    ctx.font = `bold ${rosFs}px Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, 0, 0);
    ctx.restore();
  }
  ctx.restore(); // end rose rotation

  // Fixed heading index (top triangle)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -r + 1); ctx.lineTo(-6, -r + 13); ctx.lineTo(6, -r + 13);
  ctx.closePath(); ctx.fill();

  // Center crosshair
  const ch = r * 0.11;
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-ch, 0); ctx.lineTo(ch, 0);
  ctx.moveTo(0, -ch); ctx.lineTo(0, ch);
  ctx.stroke();

  // ── Speed vector + position marker (clipped) ──
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, Math.PI*2); ctx.clip();

  const SCL_KT = 10;            // full radius = 10 kt
  const pxPerKt = r / SCL_KT;
  const vx = gspdActLat * pxPerKt;
  const vy = -gspdActFwd * pxPerKt;

  if (Math.hypot(vx, vy) > 1) {
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(vx, vy); ctx.stroke();
    const ang = Math.atan2(vy, vx), ah = 8;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx - ah*Math.cos(ang - Math.PI/7), vy - ah*Math.sin(ang - Math.PI/7));
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx - ah*Math.cos(ang + Math.PI/7), vy - ah*Math.sin(ang + Math.PI/7));
    ctx.stroke();
  }

  // Hover-position marker in body frame
  if (hoverPosOn && hoverPosLat !== null) {
    const b = bodyRelFt(hoverPosLat, hoverPosLon);
    const pxPerFt = r / HOVER_FT;
    const mX =  b.lat * pxPerFt;
    const mY = -b.fwd * pxPerFt;
    const sqSize = Math.max(10, r * 0.16);
    ctx.fillStyle   = 'rgba(255,204,0,0.2)';
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.rect(mX - sqSize/2, mY - sqSize/2, sqSize, sqSize);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore(); // end clip

  // ── SHIP 상대 위치 지시자 — 따로 그리지 않는다 ──
  // 함정은 TACAN(I-SHP)으로 잡는다. 그 무선이 NAV 소스면 아래 붉은 지시(FMS 웨이포인트와 같은 표시)가
  // 함정을 가리킨다 — FMS · 붉은 표시 · 함정이 한 묶음이다.
  let _shipRel = null;
  // ── 활성 비행계획 웨이포인트 상대 위치 (SHIP과 동일 방식, 빨간 삼각형) ──
  let _wpRel = null, _wpDistNM = null, _wpBrgT = null, _wpDistFt = null, _wpNear = false, _wpName = '';
  // 붉은 지시의 표적 — NAV 소스가 함정 TACAN(I-SHP)이면 함정, 아니면 활성 비행계획 웨이포인트
  const _tac = (typeof navRadios !== 'undefined' && navRadios[navSrc] && navRadios[navSrc].ship &&
                navRadios[navSrc].lat !== null && navRadios[navSrc].lat !== undefined) ? navRadios[navSrc] : null;
  const _tgt = _tac ? { ident: 'I-SHP', lat: _tac.lat, lon: _tac.lon }
             : (S.awp >= 0 && S.awp < S.wps.length) ? S.wps[S.awp] : null;
  if (_tgt) {
    const wp = _tgt;
    _wpName   = wp.ident || 'WPT';
    _wpDistNM = distance(S.lat, S.lon, wp.lat, wp.lon);
    _wpBrgT   = bearing(S.lat, S.lon, wp.lat, wp.lon);
    _wpRel    = normA(_wpBrgT - S.hdg);

    const b = bodyRelFt(wp.lat, wp.lon);
    _wpDistFt = b.dist;
    _wpNear   = _wpDistFt <= HOVER_FT;

    const tri = sz => {   // 위(-Y)를 향한 삼각형
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz * 0.72, sz * 0.6);
      ctx.lineTo(-sz * 0.72, sz * 0.6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,45,45,0.4)'; ctx.fill();
      ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 1.6; ctx.stroke();
    };

    if (_wpNear) {
      // 반경 내: 호버 위치 지시자와 동일 축척으로 실제 상대위치에 표시
      const pxPerFt = r / HOVER_FT;
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, Math.PI*2); ctx.clip();
      ctx.translate(b.lat * pxPerFt, -b.fwd * pxPerFt);
      tri(Math.max(8, r * 0.12));
      ctx.restore();
    } else {
      // 반경 밖: 로즈 안쪽 니들 + 중심→웨이포인트 점선
      const rad = _wpRel * D2R, pr = r * 0.58;
      const px = Math.sin(rad) * pr, py = -Math.cos(rad) * pr;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,45,45,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.translate(px, py); ctx.rotate(rad);   // 바깥쪽(웨이포인트 방향)을 향함
      tri(Math.max(7, r * 0.10));
      ctx.restore();
    }
  }

  ctx.restore(); // end translate(cx, cy)

  // ── 하단 WPT 판독: 상대방위 · 자방위 · 거리 ──
  if (_wpRel !== null) {
    const fs = Math.max(9, r * 0.115);
    const magB = ((Math.round(_wpBrgT - RULER_VAR) % 360) + 360) % 360;
    const relTxt = String(Math.round(_wpRel) % 360).padStart(3,'0');
    const distTxt = _wpNear ? uAlt(_wpDistFt) : uDist(_wpDistNM, 2);
    const txt = `${_wpName}  R${relTxt}°  ${String(magB % 360).padStart(3,'0')}°M  ${distTxt}`;
    ctx.save();
    ctx.font = `bold ${fs}px Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // SHIP 판독이 함께 나오면 그 위 줄에 배치
    const shipShown = (typeof _shipRel !== 'undefined' && _shipRel !== null);
    const ty = Math.min(y + h - 3, cy + r + fs * 1.6) - (shipShown ? fs + 7 : 0);
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(20,0,0,0.75)';
    ctx.fillRect(cx - tw/2 - 5, ty - fs - 2, tw + 10, fs + 6);
    ctx.strokeStyle = '#ff2d2d66'; ctx.lineWidth = 1;
    ctx.strokeRect(cx - tw/2 - 5, ty - fs - 2, tw + 10, fs + 6);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillText(txt, cx, ty);
    ctx.restore();
  }

  // (하단 SHIP 판독은 없앴다 — 함정은 I-SHP 로 붉은 판독에 나온다)


  // ── Side panels: speed readouts left (actual) / right (reference) ──
  if (sideW < 20) return;

  const refColor = gspdOn ? '#cc44ff' : '#aa33cc';
  const latDir   = gspdActLat >= 0 ? '→' : '←';
  const fwdDir   = gspdActFwd >= 0 ? '↑' : '↓';
  const rLatDir  = (gspdRefLat || 0) >= 0 ? '→' : '←';
  const rFwdDir  = (gspdRefFwd || 0) >= 0 ? '↑' : '↓';
  const refLatTxt = gspdRefLat === null ? '--' : `${Math.round(Math.abs(gspdRefLat))}KT`;
  const refFwdTxt = gspdRefFwd === null ? '--' : `${Math.round(Math.abs(gspdRefFwd))}KT`;

  const valFs  = Math.max(11, sideW * 0.22);
  const lblFs  = Math.max(8,  sideW * 0.16);
  const baseY  = cy - valFs * 1.2;   // vertically centred around compass centre
  const row1Y  = baseY;
  const row2Y  = baseY + valFs * 1.6 + lblFs;

  ctx.save();
  ctx.textBaseline = 'middle';

  // ── Left panel: actual GS ──
  const lCx = leftX + sideW / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#aaa'; ctx.font = `bold ${lblFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText('GS', lCx, row1Y - lblFs * 1.1);
  // lateral
  ctx.fillStyle = '#00ff88'; ctx.font = `${lblFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(latDir, lCx - valFs * 0.9, row1Y);
  ctx.font = `bold ${valFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(`${Math.round(Math.abs(gspdActLat))}KT`, lCx + valFs * 0.2, row1Y);
  // forward
  ctx.font = `${lblFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(fwdDir, lCx - valFs * 0.9, row2Y);
  ctx.font = `bold ${valFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(`${Math.round(Math.abs(gspdActFwd))}KT`, lCx + valFs * 0.2, row2Y);

  // ── Right panel: reference GS ──
  const rCx = rightX + sideW / 2;
  ctx.fillStyle = '#aaa'; ctx.font = `bold ${lblFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText('REF', rCx, row1Y - lblFs * 1.1);
  // lateral
  ctx.fillStyle = refColor; ctx.font = `${lblFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(rLatDir, rCx - valFs * 0.9, row1Y);
  ctx.font = `bold ${valFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(refLatTxt, rCx + valFs * 0.2, row1Y);
  // forward
  ctx.font = `${lblFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(rFwdDir, rCx - valFs * 0.9, row2Y);
  ctx.font = `bold ${valFs}px Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(refFwdTxt, rCx + valFs * 0.2, row2Y);

  ctx.restore();
}


