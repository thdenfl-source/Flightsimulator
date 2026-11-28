'use strict';
// ══════════════════════════════════════════════════════
// PWR — 동력-속도 곡선(회전익 · 흰수리 FLM Part 2 성능표 · Bell 206 · R22 도 제 성능으로)
//   위 창 탭(왼쪽 · 가운데 · 오른쪽 · 아래)에서 고른다. 비행 모델이 쓰는 바로 그 값을 실시간으로 그린다:
//   · 수평 비행 요구 토크 곡선(U 자) — tqRequiredAt(유도 · 형상 · 유해 동력 · 01-state.js) · 로터 착빙(iceTqK)
//   · 최대 가용 토크 MTA — CDU PERF(고도 · 온도 · 중량) − 블리드 에어(ENG ANTI ICE −14% · HEATER −4% · 둘 다 −18%)
//   · 연속 한계(녹색 끝) · 오버토크(빨강) · Vy(최소 동력 · 최대 상승) · ETL(전이양력 15~25kt) · Vh(MTA 로 낼 수 있는 최대 수평속도)
//   · 지금 점(IAS · 인가 토크) — 곡선과의 차 ΔTQ 가 상승률(+) · 강하율(−) 이 된다(FLM 상승 · 강하 토크 증분표 · perfVsForTq)
// ══════════════════════════════════════════════════════
const PWR_ON = typeof acScrOk !== 'function' || acScrOk('pwr');
if (PWR_ON) {
  window.EXTRA_WRAPS = Object.assign(window.EXTRA_WRAPS || {}, { pwr: 'pwr-wrap' });
  const R = document.getElementById('right-panel');
  if (R && !document.getElementById('pwr-wrap')) {
    const d = document.createElement('div'); d.id = 'pwr-wrap'; d.className = 'page-content page-hidden cnp-wrap';
    d.innerHTML = '<canvas class="pwr-cv"></canvas>'; R.appendChild(d);
  }
  [['left-tabs', 'left'], ['mid-tabs', 'mid'], ['page-tabs', 'right'], ['bot-tabs', 'bot']].forEach(([id, side]) => {
    const row = document.getElementById(id); if (!row || row.querySelector('.page-tab[data-sel="pwr"]')) return;
    const b = document.createElement('button'); b.className = 'page-tab'; b.dataset.sel = 'pwr'; b.dataset.short = 'PWR';
    b.dataset.act = 'selectPanel'; b.dataset.arg = JSON.stringify([side, 'pwr']); b.textContent = 'PWR'; b.title = '동력-속도 곡선 — 요구 토크 · MTA · ΔTQ 상승/강하율';
    row.insertBefore(b, row.querySelector('.tab-act') || null);
  });
  try { if (typeof SIMPLE_SCREENS !== 'undefined' && !SIMPLE_SCREENS.some(x => x[0] === 'pwr')) SIMPLE_SCREENS.push(['pwr', 'PWR']); } catch (e) { _swallow(e); }
  try { if (typeof applyPanels === 'function') applyPanels(); } catch (e) { _swallow(e); }
}
const _pv = (f, d) => { try { const v = f(); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
// 지금 값 한 묶음 — 그림과 검사가 함께 쓴다
function pwrState() {
  const ias = _pv(() => (simModeOn && typeof simAirspeed === 'function') ? simAirspeed() : S.spd, 0);
  const iceK = _pv(() => typeof iceTqK === 'function' ? iceTqK() : 1, 1);
  const req = _pv(() => tqRequired(), 0);
  const applied = _pv(() => simModeOn ? S.tq : tqShown(), req);
  const dTq = applied - req;
  const mta = _pv(() => mtaNow(S.alt), TQ_MAX), bleed = _pv(() => mtaBleedPenalty(), 0);
  const vy = _pv(() => perfVy(), 70), wt = _pv(() => perfWeightLb(), 16000), oat = _pv(() => oatNowC(), 15);
  const curve = v => _pv(() => tqRequiredAt(v, 0), 0) * iceK;
  const reqVy = curve(vy);
  let vh = null; for (let v = vy; v <= 175; v += 0.5) if (curve(v) >= mta) { vh = v; break; }
  return {
    ias, req, applied, dTq, mta, bleed, vy, reqVy, vh, wt, oat, curve,
    alt: S.alt || 0, da: _pv(() => densityAltFt(S.alt || 0, oat), 0), vs: S.vs || 0,
    predVs: _pv(() => perfVsForTq(dTq), 0), rocMax: _pv(() => perfVsForTq(mta - reqVy), 0),
    cont: _pv(() => tqLimitCont(), 100), red: _pv(() => tqLimitRed(), 113), bank: S.bnk || 0,
    heat: _pv(() => ovhdGet('ecsMode') === 'HEAT' ? 1 : 0, 0), ai: _pv(() => (ovhdGet('engAi1') === 'ON' ? 1 : 0) + (ovhdGet('engAi2') === 'ON' ? 1 : 0), 0),
  };
}
function pwrDraw(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height; if (!(W > 40 && H > 40)) return;
  // 넓은 창 — 그래프 왼쪽 · 수치 오른쪽 / 좁은(세로) 창 — 그래프 위 · 수치 아래 두 줄
  const st = pwrState(), port = W / H < 1.15, k = port ? Math.min(W / 520, H / 760) : Math.min(W / 900, H / 560);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, H);
  g.save(); g.scale(k, k); const w = W / k, h = H / k;
  const fs = n => `${n}px Helvetica, Arial, sans-serif`;
  // 그래프 칸
  const L = 58, T = 34, Rg = port ? w - 64 : w - 250, B = port ? Math.max(260, h - 330) : h - 46, VX = 160, TY = 140;
  const x = v => L + (Rg - L) * v / VX, y = t => B - (B - T) * Math.max(0, Math.min(TY, t)) / TY;
  g.fillStyle = '#e6edf3'; g.font = 'bold ' + fs(15); g.textAlign = 'left'; g.fillText('POWER REQUIRED vs IAS', L, 22);
  if (!port) { g.fillStyle = '#8aa0b4'; g.font = fs(11); g.fillText('수평 비행 요구 토크 · MTA · ΔTQ → 상승/강하율 (FLM 성능표)', L + 200, 22); }
  // 구간 띠 — 녹색(연속) · 노랑(주의) · 빨강(오버토크)
  g.globalAlpha = 0.10; g.fillStyle = '#1ec95a'; g.fillRect(L, y(st.cont), Rg - L, B - y(st.cont));
  g.fillStyle = '#f2c418'; g.fillRect(L, y(st.red), Rg - L, y(st.cont) - y(st.red)); g.fillStyle = '#e33'; g.fillRect(L, T, Rg - L, y(st.red) - T);
  g.fillStyle = '#4aa3ff'; g.fillRect(x(15), T, x(25) - x(15), B - T); g.globalAlpha = 1;   // ETL
  // 눈금
  g.strokeStyle = '#223040'; g.lineWidth = 1; g.font = fs(11); g.fillStyle = '#8aa0b4';
  for (let v = 0; v <= VX; v += 20) { g.beginPath(); g.moveTo(x(v), T); g.lineTo(x(v), B); g.stroke(); g.textAlign = 'center'; g.fillText(String(v), x(v), B + 15); }
  for (let t = 0; t <= TY; t += 20) { g.beginPath(); g.moveTo(L, y(t)); g.lineTo(Rg, y(t)); g.stroke(); g.textAlign = 'right'; g.fillText(t + '%', L - 6, y(t) + 4); }
  g.textAlign = 'center'; g.fillText('IAS (kt)', (L + Rg) / 2, B + 32); g.fillStyle = '#4aa3ff'; g.fillText('ETL', x(20), T + 12);
  // 요구 토크 곡선
  g.strokeStyle = '#e6edf3'; g.lineWidth = 2.5; g.beginPath();
  for (let v = 0; v <= VX; v += 2) { const yy = y(st.curve(v)); if (v) g.lineTo(x(v), yy); else g.moveTo(x(v), yy); } g.stroke();
  // MTA · 한계 선
  const hl = (t, col, txt, dash) => { g.save(); g.strokeStyle = col; g.lineWidth = 2; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(L, y(t)); g.lineTo(Rg, y(t)); g.stroke(); g.restore(); g.fillStyle = col; g.textAlign = 'left'; g.font = 'bold ' + fs(11); g.fillText(txt, Rg + 4, y(t) + 4); };
  hl(st.red, '#ff5050', `RED ${st.red.toFixed(0)}%`, [4, 4]); hl(st.cont, '#1ec95a', `MCP ${st.cont.toFixed(0)}%`, [4, 4]);
  hl(st.mta, '#00e5ff', `MTA ${st.mta.toFixed(0)}%`);
  // Vy · Vh
  g.save(); g.setLineDash([3, 4]); g.strokeStyle = '#ffb000'; g.beginPath(); g.moveTo(x(st.vy), T); g.lineTo(x(st.vy), B); g.stroke();
  if (st.vh) { g.strokeStyle = '#00e5ff'; g.beginPath(); g.moveTo(x(st.vh), T); g.lineTo(x(st.vh), B); g.stroke(); } g.restore();
  g.fillStyle = '#ffb000'; g.font = 'bold ' + fs(11); g.textAlign = 'center'; g.fillText(`Vy ${st.vy.toFixed(0)}`, x(st.vy), T - 2 + 14);
  if (st.vh) { g.fillStyle = '#00e5ff'; g.fillText(`Vh ${st.vh.toFixed(0)}`, x(st.vh), T + 26); }
  // 지금 점 — 곡선 위 요구 점과 인가 토크 점 · 그 사이 화살(ΔTQ)
  const px = x(Math.max(0, Math.min(VX, st.ias))), up = st.dTq >= 0, col = Math.abs(st.dTq) < 1 ? '#e6edf3' : up ? '#3cff6a' : '#ffb000';
  g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(px, y(st.req)); g.lineTo(px, y(st.applied)); g.stroke();
  g.fillStyle = '#e6edf3'; g.beginPath(); g.arc(px, y(st.req), 4, 0, 7); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(px, y(st.applied), 7, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
  // 오른쪽 수치 칸
  // 수치 — 넓으면 오른쪽 한 줄 · 좁으면 그래프 아래 두 칸(0~6 왼쪽 · 8~12 오른쪽)
  const cell = i => port ? (i < 7 ? [12, w / 2 - 8, B + 66 + i * 22] : [w / 2 + 8, w - 12, B + 66 + (i - 8) * 22]) : [Rg + 74, w - 12, 64 + i * 22];
  const row = (i, a, b, c2) => { const [x0, x1, yy] = cell(i); g.textAlign = 'left'; g.font = fs(12); g.fillStyle = '#8aa0b4'; g.fillText(a, x0, yy); g.textAlign = 'right'; g.font = 'bold ' + fs(13); g.fillStyle = c2 || '#e6edf3'; g.fillText(b, x1, yy); };
  g.fillStyle = '#e6edf3'; g.font = 'bold ' + fs(13); g.textAlign = 'left'; g.fillText('지금', cell(0)[0], cell(0)[2] - 20);
  const sg = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0);
  row(0, 'IAS', `${st.ias.toFixed(0)} kt`);
  row(1, '요구 TQ', `${st.req.toFixed(1)} %`);
  row(2, '인가 TQ', `${st.applied.toFixed(1)} %`, col);
  row(3, 'ΔTQ', `${st.dTq >= 0 ? '+' : '−'}${Math.abs(st.dTq).toFixed(1)} %`, col);
  row(4, up ? '예상 ROC' : '예상 ROD', `${sg(st.predVs)} fpm`, col);
  row(5, '실제 V/S', `${sg(st.vs)} fpm`);
  row(6, 'Vy 최대 ROC', `${sg(st.rocMax)} fpm`, '#ffb000');
  row(8, '총중량', `${Math.round(st.wt).toLocaleString()} lb`);
  row(9, '고도 · 밀도고도', `${Math.round(st.alt)} · ${Math.round(st.da)} ft`);
  row(10, 'OAT', `${st.oat.toFixed(0)} °C`);
  row(11, 'BLEED', st.bleed > 0 ? `−${st.bleed.toFixed(0)}% ${[st.ai ? `AI×${st.ai}` : '', st.heat ? 'HTR' : ''].filter(Boolean).join('·')}` : 'OFF', st.bleed > 0 ? '#ffb000' : '#e6edf3');
  if (Math.abs(st.bank) > 5) row(12, '뱅크(n²)', `${st.bank.toFixed(0)}°`, '#ffb000');
  g.fillStyle = '#6f8396'; g.font = fs(10); g.textAlign = 'left';
  g.fillText(port ? 'ΔTQ(+) 상승 · (−) 강하 · Vy 에서 가장 적게 든다' : '컬렉티브를 올려 요구 토크보다 높이면 남는 토크가 상승률, 낮추면 강하율이 된다 · Vy 에서 가장 적게 든다', port ? 12 : L, h - 8);
  g.restore();
}
function pwrScreensDraw() {
  if (!PWR_ON) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  document.querySelectorAll('#pwr-wrap:not(.page-hidden) > canvas.pwr-cv').forEach(c => {
    const w = c.clientWidth, h = c.clientHeight; if (!(w > 20 && h > 20)) return;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    try { pwrDraw(c); } catch (e) { _swallow(e); }
  });
}
if (PWR_ON) setInterval(() => { try { pwrScreensDraw(); } catch (e) { _swallow(e); } }, 200);
