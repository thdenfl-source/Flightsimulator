'use strict';
// ══════════════════════════════════════════════════════
// 28-debrief.js — 비행 기록(FDR) · 사후 강평(DEBRIEF)
//
// 기록: 비행 중(S.running) 시뮬레이터 시간 1초마다 자리 · 고도 · 속도 · 기수 · 승강률 · 토크 · NR · 자세 · 상위모드를 적는다(최대 3시간).
//       멈춰(PAUSE) 있으면 적지 않고, 배속이면 그만큼 시간이 빨리 흐른다.
//       아래 일들은 '사건'으로 따로 적는다 — 이륙 · 착륙 · AFCS 모드 걸림/풀림 · 엔진 상태 · 토크 한계 넘음 · VNE 넘음 · 낮은 로터 RPM
// 강평 창(지도 창 · 3D 창의 📋 DEBRIEF 단추):
//   왼쪽 항적(고도 색) · 오른쪽 고도 · 속도 · 토크 · 승강률 그래프 · 아래 시간 막대(끌면 그 순간의 값) · ▶ 다시 보기(10 · 30 · 60배)
//   요약(비행시간 · 최고 고도 · 최고 속도 · 최고 토크 · 한계 넘은 시간 · 착륙 수 · 모드 풀림) · 사건 목록(누르면 그 순간으로)
//   지도에 항적 겹치기 · CSV 저장 · 기록 끄기/켜기 · 지우기
// 기록은 이 창(탭)이 열려 있는 동안만 남는다 — 남기려면 CSV 로 저장한다.
// ══════════════════════════════════════════════════════
const FDR_MAX = 3 * 3600;                 // 최대 표본 수(1초마다 — 3시간)
const fdr = { on: true, t: 0, nextT: 0, rows: [], ev: [], prev: null, drop0: 0 };
const _fdrNum = (f, d = 0) => { try { const v = f(); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
function _fdrModes() {
  const m = [];
  try {
    if (typeof gspdOn !== 'undefined' && gspdOn) m.push('GSPD');
    if (navApOn) m.push('NAV'); else if (hdgSelOn) m.push('HDG');
    if (crhtOn) m.push('CRHT'); else if (altHoldOn) m.push('ALT');
    if (typeof simIasOn !== 'undefined' && simModeOn && simIasOn) m.push('IAS');
    if (typeof gsOn !== 'undefined' && gsOn) m.push('G/S');
  } catch (e) { _swallow(e); }
  return m.join(' ');
}
function _fdrGround() { try { return typeof sndOnGround === 'function' ? sndOnGround() : S.alt < 2; } catch (e) { return false; } }
function _fdrVne() { try { return (typeof simVne === 'function') ? simVne() : 160; } catch (e) { return 160; } }
function _fdrSample() {
  const tq = _fdrNum(() => tqShown()), nr = _fdrNum(() => engParams().nr, 100);
  return {
    t: fdr.t, lat: S.lat, lon: S.lon, alt: _fdrNum(() => S.alt), ias: _fdrNum(() => (simModeOn && typeof simAirspeed === 'function') ? simAirspeed() : S.spd),
    hdg: _fdrNum(() => (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg)), vs: _fdrNum(() => S.vs), tq, nr,
    bnk: _fdrNum(() => S.bnk), pit: _fdrNum(() => S.pit), gnd: _fdrGround(), modes: _fdrModes(),
    eng: (() => { try { return typeof engStateLabel === 'function' ? engStateLabel() : ''; } catch (e) { return ''; } })(),
    tqOver: _fdrNum(() => (tqOver() ? 1 : 0)) === 1, vneOver: _fdrNum(() => S.spd) > _fdrVne() + 0.5, nrLow: simModeOn && nr < 90,
  };
}
function _fdrEvent(r, txt, kind = '') { fdr.ev.push({ t: r.t, i: fdr.rows.length - 1, txt, kind }); }
// 한 표본 — 앞 표본과 견주어 사건을 적는다
function fdrRecord() {
  const r = _fdrSample(), p = fdr.prev;
  fdr.rows.push(r);
  if (fdr.rows.length > FDR_MAX) { fdr.rows.shift(); fdr.ev.forEach(e => e.i--); fdr.ev = fdr.ev.filter(e => e.i >= 0); }
  if (p) {
    if (p.gnd && !r.gnd) _fdrEvent(r, '이륙');
    if (!p.gnd && r.gnd) _fdrEvent(r, `착륙 (강하 ${Math.round(-Math.min(0, p.vs))} fpm)`, p.vs < -300 ? 'warn' : '');
    if (p.modes !== r.modes) {
      const a = p.modes ? p.modes.split(' ') : [], b = r.modes ? r.modes.split(' ') : [];
      const on = b.filter(x => !a.includes(x)), off = a.filter(x => !b.includes(x));
      if (on.length) _fdrEvent(r, `AFCS 걸림 — ${on.join(' · ')}`);
      if (off.length) _fdrEvent(r, `AFCS 풀림 — ${off.join(' · ')}`, 'warn');
    }
    if (p.eng !== r.eng && r.eng) _fdrEvent(r, `엔진 — ${r.eng}`, /OFF|IDLE|OEI|OUT/.test(r.eng) ? 'warn' : '');
    if (!p.tqOver && r.tqOver) _fdrEvent(r, `토크 한계 넘음 (${r.tq.toFixed(0)}%)`, 'err');
    if (!p.vneOver && r.vneOver) _fdrEvent(r, `VNE 넘음 (${r.ias.toFixed(0)} kt)`, 'err');
    if (!p.nrLow && r.nrLow) _fdrEvent(r, `낮은 로터 RPM (NR ${r.nr.toFixed(0)}%)`, 'err');
  } else _fdrEvent(r, '기록 시작');
  fdr.prev = r;
}
function fdrStep(dtSim) {
  if (!fdr.on || !(dtSim > 0)) return;
  fdr.t += dtSim;
  if (fdr.t >= fdr.nextT) { fdrRecord(); fdr.nextT = Math.floor(fdr.t) + 1; }
}
// 다른 파일이 사건을 적는다(엔진 한계 넘음 · 스타터 과열 · LTE · 마스트 범핑 …) — 기록이 꺼져 있으면 그만
function fdrNote(txt, kind = '') { if (!fdr.on) return; fdr.ev.push({ t: fdr.t, i: Math.max(0, fdr.rows.length - 1), txt, kind }); }
function fdrClear() { fdr.t = 0; fdr.nextT = 0; fdr.rows = []; fdr.ev = []; fdr.prev = null; fdr.drop0 = (typeof afcsDropCount === 'number') ? afcsDropCount : 0; }
let _fdrT = 0;
setInterval(() => {
  const now = performance.now(), dt = _fdrT ? Math.min(2, (now - _fdrT) / 1000) : 0; _fdrT = now;
  let k = 0; try { k = S.running ? (typeof simSpeed === 'number' ? simSpeed : 1) : 0; } catch (e) { k = 0; }
  fdrStep(dt * k);
  if (_dbf.open && _dbf.live) dbfRender();
}, 250);

// ── 요약 ──
function fdrSummary(rows = fdr.rows) {
  const s = { dur: 0, maxAlt: 0, maxIas: 0, maxTq: 0, tqOverS: 0, tqContS: 0, vneS: 0, nrLowS: 0, landings: 0, hardLdg: 0, airS: 0, drops: 0, exceed: 0 };
  if (!rows.length) return s;
  s.dur = rows[rows.length - 1].t - rows[0].t;
  let cont = 100; try { cont = typeof tqLimitCont === 'function' ? tqLimitCont() : 100; } catch (e) { _swallow(e); }
  rows.forEach((r, i) => {
    s.maxAlt = Math.max(s.maxAlt, r.alt); s.maxIas = Math.max(s.maxIas, r.ias); s.maxTq = Math.max(s.maxTq, r.tq);
    if (r.tqOver) s.tqOverS++; else if (r.tq > cont) s.tqContS++;
    if (r.vneOver) s.vneS++; if (r.nrLow) s.nrLowS++; if (!r.gnd) s.airS++;
    if (i && !rows[i - 1].gnd && r.gnd) { s.landings++; if (rows[i - 1].vs < -300) s.hardLdg++; }
  });
  s.drops = fdr.ev.filter(e => /AFCS 풀림/.test(e.txt)).length;
  s.exceed = fdr.ev.filter(e => /한계 넘음|과열|마스트 범핑/.test(e.txt)).length;
  return s;
}
// ── CSV ──
function fdrCsv() {
  const H = ['t_s', 'lat', 'lon', 'alt_ft', 'ias_kt', 'hdg_mag', 'vs_fpm', 'tq_pct', 'nr_pct', 'bank_deg', 'pitch_deg', 'ground', 'afcs', 'engine'];
  const L = [H.join(',')];
  fdr.rows.forEach(r => L.push([r.t.toFixed(0), r.lat.toFixed(6), r.lon.toFixed(6), r.alt.toFixed(0), r.ias.toFixed(1), r.hdg.toFixed(0), r.vs.toFixed(0),
    r.tq.toFixed(1), r.nr.toFixed(1), r.bnk.toFixed(1), r.pit.toFixed(1), r.gnd ? 1 : 0, `"${r.modes}"`, `"${r.eng}"`].join(',')));
  L.push(''); L.push('t_s,event');
  fdr.ev.forEach(e => L.push(`${e.t.toFixed(0)},"${e.txt.replace(/"/g, "'")}"`));
  return L.join('\n');
}
function fdrSaveCsv() {
  if (!fdr.rows.length) { try { uiToast('기록이 없습니다'); } catch (e) { _swallow(e); } return; }
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const name = `flight-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + fdrCsv()], { type: 'text/csv' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ══ 강평 창 ══
const _dbf = { open: false, cur: -1, live: true, play: 0, playT: null, track: null, tab: 'ev' };
const _hms = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
function _dbfBuild() {
  let w = document.getElementById('dbf-wrap');
  if (w) return w;
  w = document.createElement('div'); w.id = 'dbf-wrap';
  w.innerHTML = `<div class="dbf-box">
    <div class="dbf-bar"><b>📋 비행 강평 (DEBRIEF)</b>
      <button class="sim-btn" data-dbf="rec"></button><button class="sim-btn" data-dbf="map">지도에 항적</button>
      <button class="sim-btn" data-dbf="csv">CSV 저장</button><button class="sim-btn" data-dbf="clr">지우기</button>
      <button class="sim-btn dbf-x" data-dbf="close" title="닫기">✕</button></div>
    <div class="dbf-sum" data-dbf-v="sum"></div>
    <div class="dbf-main"><canvas class="dbf-trk" data-dbf-c="trk"></canvas><canvas class="dbf-chart" data-dbf-c="chart"></canvas></div>
    <div class="dbf-ctl"><button class="sim-btn" data-dbf="play">▶</button><button class="sim-btn" data-dbf="spd">×10</button>
      <input type="range" class="dbf-rng" min="0" max="0" value="0" data-dbf-v="rng"><button class="sim-btn" data-dbf="live">LIVE</button>
      <button class="sim-btn" data-dbf="ga" title="채점 구간 시작 = 지금 시각">A</button><button class="sim-btn" data-dbf="gb" title="채점 구간 끝 = 지금 시각">B</button>
      <button class="sim-btn" data-dbf="r3d" title="기록한 비행을 3D 화면에서 다시 본다">3D 다시 보기</button></div>
    <div class="dbf-bot"><div class="dbf-read" data-dbf-v="read"></div>
      <div class="dbf-side"><div class="dbf-tabs"><button class="sim-btn on" data-dbf="tab:ev">사건</button><button class="sim-btn" data-dbf="tab:gr">채점</button></div>
        <div class="dbf-ev" data-dbf-v="ev"></div><div class="dbf-gr" data-dbf-v="gr" style="display:none"></div></div></div></div>`;
  document.body.appendChild(w);
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-dbf]'); if (!b) { const ev = e.target.closest('[data-ev]'); if (ev) { _dbfSeek(+ev.dataset.ev); } return; }
    const k = b.dataset.dbf;
    if (k === 'close') dbfClose();
    else if (k === 'rec') { fdr.on = !fdr.on; dbfRender(); }
    else if (k === 'csv') fdrSaveCsv();
    else if (k === 'clr') Promise.resolve(typeof uiConfirm === 'function' ? uiConfirm('비행 기록을 모두 지울까요?') : true).then(ok => { if (ok) { fdrClear(); _dbf.cur = -1; _dbf.live = true; _dbfMap(false); dbfRender(); } });
    else if (k === 'map') _dbfMap(!_dbf.track);
    else if (k === 'play') _dbfPlay(!_dbf.playT);
    else if (k === 'spd') { const L = [10, 30, 60]; _dbf.play = L[(L.indexOf(_dbf.play || 10) + 1) % L.length]; dbfRender(); }
    else if (k === 'live') { _dbf.live = true; _dbf.cur = -1; _dbfPlay(false); dbfRender(); }
    else if (k === 'ga' || k === 'gb') { const ci = _dbf.live || _dbf.cur < 0 ? fdr.rows.length - 1 : _dbf.cur; _grade[k === 'ga' ? 'a' : 'b'] = ci; if (k === 'ga') _grade.tgt = { alt: null, ias: null, hdg: null }; _dbfTab('gr'); dbfRender(); }
    else if (k === 'r3d') dbfReplay(true);
    else if (k.startsWith('tab:')) _dbfTab(k.slice(4));
  });
  // 채점 — 목표 · 허용 · 쓰기
  w.addEventListener('change', e => {
    const i = e.target.closest('[data-gr]'); if (!i) return;
    const [f, key] = i.dataset.gr.split(':');
    if (f === 'use') _grade.use[key] = i.checked; else { const v = parseFloat(i.value); _grade[f][key] = Number.isFinite(v) ? v : null; }
    dbfRender();
  });
  w.querySelector('[data-dbf-v="rng"]').addEventListener('input', e => _dbfSeek(+e.target.value));
  // 그래프 · 항적을 눌러(끌어) 그 순간으로
  const chart = w.querySelector('[data-dbf-c="chart"]');
  const seekChart = e => { if (!(e.buttons & 1) && e.type !== 'pointerdown') return; const r = chart.getBoundingClientRect(), n = fdr.rows.length; if (n < 2) return;
    const L0 = 46, f = Math.max(0, Math.min(1, (e.clientX - r.left - L0) / (r.width - L0 - 8))); _dbfSeek(Math.round(f * (n - 1))); };
  chart.addEventListener('pointerdown', seekChart); chart.addEventListener('pointermove', seekChart);
  return w;
}
function _dbfSeek(i) { _dbf.live = false; _dbf.cur = Math.max(0, Math.min(fdr.rows.length - 1, i | 0)); dbfRender(); _rpApply(); }
function _dbfTab(t) {
  const w = document.getElementById('dbf-wrap'); if (!w) return; _dbf.tab = t;
  w.querySelector('[data-dbf-v="ev"]').style.display = t === 'ev' ? '' : 'none';
  w.querySelector('[data-dbf-v="gr"]').style.display = t === 'gr' ? '' : 'none';
  w.querySelectorAll('[data-dbf^="tab:"]').forEach(b => b.classList.toggle('on', b.dataset.dbf === 'tab:' + t));
  dbfRender();
}
// ── 채점(평가 구간 A ~ B) ──
// 고도 · 속도 · 기수를 목표 ± 허용 안에 지킨 시간의 몫(%)을 본다. 목표를 비우면 구간 시작 값이 목표다.
// 점수 = 고른 항목의 '허용 안' 몫의 평균 · 등급 — 90 우수 · 75 만족 · 60 보통 · 그 밑 미흡
const _grade = { a: -1, b: -1, tgt: { alt: null, ias: null, hdg: null }, tol: { alt: 100, ias: 10, hdg: 10 }, use: { alt: true, ias: true, hdg: true } };
const _GR = { alt: ['고도', 'ft', r => r.alt], ias: ['속도', 'kt', r => r.ias], hdg: ['기수', '°', r => r.hdg] };
function fdrGrade(a = _grade.a, b = _grade.b, opt = _grade) {
  const rows = fdr.rows; if (!(a >= 0 && b > a && b < rows.length)) return null;
  const seg = rows.slice(a, b + 1), out = { a, b, dur: seg[seg.length - 1].t - seg[0].t, items: [], score: 0, grade: '' };
  for (const k of Object.keys(_GR)) {
    if (!opt.use[k]) continue;
    const f = _GR[k][2], tgt = Number.isFinite(opt.tgt[k]) ? opt.tgt[k] : f(seg[0]), tol = opt.tol[k];
    let inN = 0, max = 0, sq = 0;
    seg.forEach(r => { let d = f(r) - tgt; if (k === 'hdg') d = ((d + 540) % 360) - 180; const ad = Math.abs(d); if (ad <= tol) inN++; max = Math.max(max, ad); sq += d * d; });
    out.items.push({ k, name: _GR[k][0], unit: _GR[k][1], tgt, tol, inPct: 100 * inN / seg.length, maxDev: max, rms: Math.sqrt(sq / seg.length) });
  }
  if (out.items.length) out.score = out.items.reduce((s0, x) => s0 + x.inPct, 0) / out.items.length;
  out.grade = out.score >= 90 ? '우수' : out.score >= 75 ? '만족' : out.score >= 60 ? '보통' : '미흡';
  return out;
}
function _dbfGradeHtml() {
  const rows = fdr.rows, a = _grade.a, b = _grade.b;
  const seg = a >= 0 && b > a && b < rows.length;
  let h = `<div class="gr-seg">구간 <b>A ${a >= 0 && rows[a] ? _hms(rows[a].t) : '—'}</b> ~ <b>B ${b >= 0 && rows[b] ? _hms(rows[b].t) : '—'}</b>` +
    (seg ? '' : ' <span class="dbf-m">— 시간 막대를 옮겨 A · B 를 누르십시오</span>') + '</div><table class="gr-t"><tr><th></th><th>목표</th><th>±허용</th><th>안(%)</th><th>최대</th><th>RMS</th></tr>';
  const R = seg ? fdrGrade() : null;
  for (const k of Object.keys(_GR)) {
    const it = R && R.items.find(x => x.k === k), dflt = seg ? _GR[k][2](rows[a]).toFixed(0) : '';
    h += `<tr><td><label><input type="checkbox" data-gr="use:${k}" ${_grade.use[k] ? 'checked' : ''}> ${_GR[k][0]}</label></td>` +
      `<td><input type="number" data-gr="tgt:${k}" value="${_grade.tgt[k] ?? ''}" placeholder="${dflt}"></td><td><input type="number" data-gr="tol:${k}" value="${_grade.tol[k]}"></td>` +
      (it ? `<td class="${it.inPct >= 90 ? 'ok' : it.inPct >= 60 ? '' : 'bad'}">${it.inPct.toFixed(0)}</td><td>${it.maxDev.toFixed(0)}</td><td>${it.rms.toFixed(0)}</td>` : '<td>—</td><td>—</td><td>—</td>') + '</tr>';
  }
  h += '</table>' + (R ? `<div class="gr-sum">점수 <b>${R.score.toFixed(0)}</b> · <b class="gr-${R.grade}">${R.grade}</b> · ${_hms(R.dur)}</div>` : '');
  return h;
}
function _dbfPlay(on) {
  clearInterval(_dbf.playT); _dbf.playT = null;
  if (on && fdr.rows.length > 1) {
    _dbf.live = false; if (_dbf.cur < 0 || _dbf.cur >= fdr.rows.length - 1) _dbf.cur = 0;
    _dbf.playT = setInterval(() => {
      _dbf.cur += Math.max(1, Math.round((_dbf.play || 10) / 10));
      if (_dbf.cur >= fdr.rows.length - 1) { _dbf.cur = fdr.rows.length - 1; _dbfPlay(false); }
      dbfRender(); _rpApply();
    }, 100);
  }
  dbfRender();
}
// 지도(leaflet)에 항적을 겹친다 — 고도에 따라 색
function _dbfMap(on) {
  try {
    if (_dbf.track) { leafMap.removeLayer(_dbf.track); _dbf.track = null; }
    if (on && fdr.rows.length > 1 && typeof L !== 'undefined' && typeof leafMap !== 'undefined') {
      const ll = fdr.rows.map(r => [r.lat, r.lon]);
      _dbf.track = L.polyline(ll, { color: '#ff40ff', weight: 3, opacity: 0.9, dashArray: '6 4' }).addTo(leafMap);
      leafMap.fitBounds(_dbf.track.getBounds(), { padding: [30, 30] });
    }
  } catch (e) { _swallow(e); }
  dbfRender();
}
function dbfOpen() { _dbfBuild().style.display = 'flex'; _dbf.open = true; if (_dbf.play === 0) _dbf.play = 10; dbfRender(); }
function dbfClose() { const w = document.getElementById('dbf-wrap'); if (w) w.style.display = 'none'; _dbf.open = false; _dbfPlay(false); }
function toggleDebrief() { if (_dbf.open) dbfClose(); else dbfOpen(); }
const _altCol = a => { const f = Math.max(0, Math.min(1, a / 5000)); return `hsl(${Math.round(200 - f * 200)},90%,55%)`; };   // 0ft 청록 → 5,000ft 빨강
function _cvs(c) {
  const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1, W = Math.max(10, Math.round(r.width * d)), H = Math.max(10, Math.round(r.height * d));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return { g, w: r.width, h: r.height };
}
function dbfRender() {
  const w = document.getElementById('dbf-wrap'); if (!w || !_dbf.open) return;
  const rows = fdr.rows, n = rows.length, ci = _dbf.live || _dbf.cur < 0 ? n - 1 : _dbf.cur, cur = rows[ci];
  const q = k => w.querySelector(`[data-dbf-v="${k}"]`), btn = k => w.querySelector(`[data-dbf="${k}"]`);
  btn('rec').textContent = fdr.on ? '● REC' : '○ REC 꺼짐'; btn('rec').classList.toggle('on', fdr.on);
  btn('map').classList.toggle('on', !!_dbf.track); btn('play').textContent = _dbf.playT ? '❚❚' : '▶'; btn('spd').textContent = '×' + (_dbf.play || 10);
  btn('live').classList.toggle('on', _dbf.live);
  const rng = q('rng'); rng.max = String(Math.max(0, n - 1)); rng.value = String(Math.max(0, ci));
  // 요약
  const s = fdrSummary(), kv = (k, v, warn) => `<span class="${warn ? 'warn' : ''}"><em>${k}</em>${v}</span>`;
  q('sum').innerHTML = n ? kv('기록', _hms(s.dur)) + kv('비행', _hms(s.airS)) + kv('최고 고도', s.maxAlt.toFixed(0) + ' ft') + kv('최고 속도', s.maxIas.toFixed(0) + ' kt') +
    kv('최고 TQ', s.maxTq.toFixed(0) + '%', s.tqOverS > 0) + kv('TQ 연속한계↑', _hms(s.tqContS), s.tqContS > 0) + kv('TQ 최대한계↑', _hms(s.tqOverS), s.tqOverS > 0) +
    kv('VNE↑', _hms(s.vneS), s.vneS > 0) + kv('낮은 NR', _hms(s.nrLowS), s.nrLowS > 0) + kv('착륙', `${s.landings}${s.hardLdg ? ` (거친 ${s.hardLdg})` : ''}`, s.hardLdg > 0) + kv('AFCS 풀림', String(s.drops), s.drops > 0) + (s.exceed ? kv('점검 필요', s.exceed + '건', true) : '')
    : '<span>아직 기록이 없습니다 — 비행(▶)을 시작하면 1초마다 적습니다.</span>';
  // 읽기
  q('read').innerHTML = cur ? `<b>${_hms(cur.t)}</b> · ALT ${cur.alt.toFixed(0)} ft · IAS ${cur.ias.toFixed(0)} kt · HDG ${String(Math.round(cur.hdg) % 360).padStart(3, '0')}° · VS ${cur.vs.toFixed(0)} fpm · TQ ${cur.tq.toFixed(0)}% · NR ${cur.nr.toFixed(0)}% · BANK ${cur.bnk.toFixed(0)}° · PITCH ${cur.pit.toFixed(1)}°<br>` +
    `<span class="dbf-m">AFCS ${cur.modes || '—'} · ${cur.eng || ''} · ${cur.gnd ? '지상' : '공중'}</span>` : '';
  // 사건
  const evh = fdr.ev.slice(-200).map(e => `<div data-ev="${e.i}" class="${e.kind} ${e.i <= ci && (!fdr.ev[fdr.ev.indexOf(e) + 1] || fdr.ev[fdr.ev.indexOf(e) + 1].i > ci) ? 'cur' : ''}"><b>${_hms(e.t)}</b> ${e.txt}</div>`).join('');
  const evEl = q('ev'); if (evEl.dataset.h !== evh) { evEl.dataset.h = evh; evEl.innerHTML = evh || '<div>사건 없음</div>'; }
  if (_dbf.tab === 'gr') { const gEl = q('gr'), gh = _dbfGradeHtml(); if (gEl.dataset.h !== gh && !gEl.contains(document.activeElement)) { gEl.dataset.h = gh; gEl.innerHTML = gh; } }
  _dbfTrack(w.querySelector('[data-dbf-c="trk"]'), rows, ci);
  _dbfChart(w.querySelector('[data-dbf-c="chart"]'), rows, ci);
}
function _dbfTrack(c, rows, ci) {
  const { g, w, h } = _cvs(c);
  g.fillStyle = '#0b1218'; g.fillRect(0, 0, w, h);
  if (rows.length < 2) { g.fillStyle = '#567'; g.font = '13px Arial'; g.textAlign = 'center'; g.fillText('항적', w / 2, h / 2); return; }
  let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  rows.forEach(r => { la0 = Math.min(la0, r.lat); la1 = Math.max(la1, r.lat); lo0 = Math.min(lo0, r.lon); lo1 = Math.max(lo1, r.lon); });
  const kx = Math.cos(((la0 + la1) / 2) * Math.PI / 180), sx = Math.max(1e-5, (lo1 - lo0) * kx), sy = Math.max(1e-5, la1 - la0);
  const pad = 22, sc = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy);
  const X = r => w / 2 + ((r.lon - (lo0 + lo1) / 2) * kx) * sc, Y = r => h / 2 - (r.lat - (la0 + la1) / 2) * sc;
  // 축척 막대(NM)
  const nmPx = sc / 60; let nm = 1; while (nm * nmPx < 40) nm *= nm === 1 ? 2 : nm === 2 ? 2.5 : 2; while (nm * nmPx > 140 && nm > 0.1) nm /= 2;
  g.strokeStyle = '#8aa'; g.lineWidth = 1; g.beginPath(); g.moveTo(10, h - 12); g.lineTo(10 + nm * nmPx, h - 12); g.stroke();
  g.fillStyle = '#8aa'; g.font = '11px Arial'; g.textAlign = 'left'; g.fillText(`${nm} NM`, 12 + nm * nmPx, h - 8);
  g.lineWidth = 2.5; g.lineCap = 'round';
  for (let i = 1; i < rows.length; i++) {
    g.strokeStyle = _altCol(rows[i].alt); g.globalAlpha = i <= ci ? 1 : 0.25;
    g.beginPath(); g.moveTo(X(rows[i - 1]), Y(rows[i - 1])); g.lineTo(X(rows[i]), Y(rows[i])); g.stroke();
  }
  g.globalAlpha = 1;
  // 사건 점
  fdr.ev.forEach(e => { const r = rows[e.i]; if (!r || !e.kind) return; g.fillStyle = e.kind === 'err' ? '#ff5252' : '#ffb000'; g.beginPath(); g.arc(X(r), Y(r), 3.5, 0, 7); g.fill(); });
  // 시작(S) · 지금(기체)
  g.fillStyle = '#fff'; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.fillText('S', X(rows[0]), Y(rows[0]) - 6);
  const r = rows[ci]; if (r) {
    g.save(); g.translate(X(r), Y(r)); g.rotate(((typeof toTrue === 'function' ? toTrue(r.hdg) : r.hdg) || 0) * Math.PI / 180);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 4); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  // 고도 색 띠
  for (let i = 0; i < 50; i++) { g.fillStyle = _altCol(i * 100); g.fillRect(w - 18, h - 20 - i * 2, 10, 2); }
  g.fillStyle = '#8aa'; g.font = '10px Arial'; g.textAlign = 'right'; g.fillText('5000', w - 20, h - 116); g.fillText('0 ft', w - 20, h - 18);
}
function _dbfChart(c, rows, ci) {
  const { g, w, h } = _cvs(c);
  g.fillStyle = '#0b1218'; g.fillRect(0, 0, w, h);
  const S4 = [['ALT ft', r => r.alt, '#4fc3f7'], ['IAS kt', r => r.ias, '#81c784'], ['TQ %', r => r.tq, '#ffb74d'], ['VS fpm', r => r.vs, '#ce93d8']];
  const L0 = 46, R0 = 8, n = rows.length, bh = h / S4.length;
  let cont = 100, red = 113; try { cont = tqLimitCont(); red = tqLimitRed(); } catch (e) { _swallow(e); }
  S4.forEach(([name, f, col], k) => {
    const y0 = k * bh + 4, y1 = (k + 1) * bh - 6;
    g.strokeStyle = '#1e2b36'; g.strokeRect(L0, y0, w - L0 - R0, y1 - y0);
    g.fillStyle = col; g.font = 'bold 11px Arial'; g.textAlign = 'left'; g.fillText(name, L0 + 6, y0 + 13);
    if (n < 2) return;
    let lo = Infinity, hi = -Infinity; rows.forEach(r => { const v = f(r); lo = Math.min(lo, v); hi = Math.max(hi, v); });
    if (name.startsWith('TQ')) { lo = 0; hi = Math.max(hi, red + 5); } else if (name.startsWith('VS')) { const m = Math.max(500, Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; } else { lo = Math.min(0, lo); hi = Math.max(hi, lo + 10); }
    const Y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0), X = i => L0 + i / (n - 1) * (w - L0 - R0);
    g.fillStyle = '#7d8a96'; g.font = '10px Arial'; g.textAlign = 'right'; g.fillText(hi.toFixed(0), L0 - 3, y0 + 9); g.fillText(lo.toFixed(0), L0 - 3, y1);
    if (name.startsWith('TQ')) [[cont, '#ffcc00'], [red, '#ff4444']].forEach(([v, cc]) => { g.strokeStyle = cc; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(L0, Y(v)); g.lineTo(w - R0, Y(v)); g.stroke(); g.setLineDash([]); });
    if (name.startsWith('VS')) { g.strokeStyle = '#33424f'; g.beginPath(); g.moveTo(L0, Y(0)); g.lineTo(w - R0, Y(0)); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
    const step = Math.max(1, Math.floor(n / (w - L0)));
    for (let i = 0; i < n; i += step) { const x = X(i), y = Y(f(rows[i])); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke(); g.lineWidth = 1;
  });
  // 채점 구간(A ~ B) 그늘
  if (n >= 2 && _grade.a >= 0) {
    const xa = L0 + _grade.a / (n - 1) * (w - L0 - R0), xb = _grade.b > _grade.a ? L0 + Math.min(n - 1, _grade.b) / (n - 1) * (w - L0 - R0) : xa + 2;
    g.fillStyle = 'rgba(0,229,255,0.10)'; g.fillRect(xa, 0, Math.max(2, xb - xa), h);
    g.fillStyle = '#00e5ff'; g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.fillText('A', xa, 10); if (_grade.b > _grade.a) g.fillText('B', xb, 10);
  }
  if (n >= 2 && ci >= 0) {
    const x = L0 + ci / (n - 1) * (w - L0 - R0);
    g.strokeStyle = '#fff'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#fff'; g.font = '10px Arial'; g.textAlign = 'center'; g.fillText(_hms(rows[ci].t), Math.min(w - 20, Math.max(L0 + 14, x)), h - 1);
  }
}
// ── 3D 다시 보기 — 기록한 자리 · 고도 · 자세를 비행 상태(S)에 얹어 3D 화면(조종석 · 외부)이 그대로 따라 그린다 ──
// 비행은 멈추고(PAUSE), 강평 창은 화면 아래 작은 막대로 줄어든다. 끝내면 다시 보기 전 상태로 돌아간다.
const _rp = { on: false, snap: null };
function _rpApply() {
  if (!_rp.on) return;
  const r = fdr.rows[_dbf.cur < 0 ? fdr.rows.length - 1 : _dbf.cur]; if (!r) return;
  S.lat = r.lat; S.lon = r.lon; S.alt = r.alt; S.hdg = (typeof toTrue === 'function') ? toTrue(r.hdg) : r.hdg;
  S.pit = r.pit; S.bnk = r.bnk; S.spd = r.ias; S.vs = r.vs; bankTarget = r.bnk;
  try { updateAcOnMap(); } catch (e) { _swallow(e); }
  try { drawPFD(); } catch (e) { _swallow(e); }
  _rpMini();
}
function dbfReplay(on) {
  if (on && fdr.rows.length < 2) { try { uiToast('다시 볼 기록이 없습니다'); } catch (e) { _swallow(e); } return; }
  if (on && !_rp.on) {
    _rp.snap = { lat: S.lat, lon: S.lon, alt: S.alt, hdg: S.hdg, pit: S.pit, bnk: S.bnk, spd: S.spd, vs: S.vs, running: S.running, trail: S.trail.slice() };
    S.running = false; try { updateFlyBtns(); } catch (e) { _swallow(e); }
    _rp.on = true; _dbf.live = false; if (_dbf.cur < 0) _dbf.cur = 0;
    const w = document.getElementById('dbf-wrap'); if (w) w.style.display = 'none'; _dbf.open = false;
    _rp.solo = false;
    try { if (typeof _soloActive !== 'undefined' && !_soloActive && typeof enterSolo === 'function') { enterSolo('m3d'); _rp.solo = true; } } catch (e) { _swallow(e); }
    _rpApply(); _dbfPlay(true);
  } else if (!on && _rp.on) {
    _dbfPlay(false); _rp.on = false;
    const sn = _rp.snap; if (sn) { Object.assign(S, { lat: sn.lat, lon: sn.lon, alt: sn.alt, hdg: sn.hdg, pit: sn.pit, bnk: sn.bnk, spd: sn.spd, vs: sn.vs }); S.trail = sn.trail; bankTarget = sn.bnk; S.lastT = null; }
    try { updateAcOnMap(); drawPFD(); } catch (e) { _swallow(e); }
    const m = document.getElementById('dbf-mini'); if (m) m.style.display = 'none';
    try { if (_rp.solo && typeof exitSolo === 'function' && _soloActive) exitSolo(); } catch (e) { _swallow(e); }
    _rp.solo = false;
    dbfOpen();
  }
}
function _rpMini() {
  let m = document.getElementById('dbf-mini');
  if (!m) {
    m = document.createElement('div'); m.id = 'dbf-mini';
    m.innerHTML = `<b>3D 다시 보기</b><button class="sim-btn" data-rp="play">❚❚</button><button class="sim-btn" data-rp="spd">×10</button>` +
      `<input type="range" min="0" max="0" value="0" data-rp="rng"><span data-rp="t"></span><button class="sim-btn" data-rp="ext" title="외부 시점(SIM)">EXT</button><button class="sim-btn" data-rp="end">✕ 끝내기</button>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => {
      const b = e.target.closest('button[data-rp]'); if (!b) return;
      const k = b.dataset.rp;
      if (k === 'play') _dbfPlay(!_dbf.playT);
      else if (k === 'spd') { const L = [10, 30, 60]; _dbf.play = L[(L.indexOf(_dbf.play || 10) + 1) % L.length]; }
      else if (k === 'ext') { try { if (typeof toggleExtView === 'function') toggleExtView(); else if (typeof simExtView !== 'undefined') simExtView = !simExtView; } catch (er) { _swallow(er); } }
      else if (k === 'end') dbfReplay(false);
      _rpMini();
    });
    m.querySelector('[data-rp="rng"]').addEventListener('input', e => { _dbf.cur = +e.target.value; _rpApply(); });
  }
  if (!_rp.on) { m.style.display = 'none'; return; }
  m.style.display = 'flex';
  const n = fdr.rows.length, ci = Math.max(0, _dbf.cur), r = fdr.rows[ci];
  const rng = m.querySelector('[data-rp="rng"]'); rng.max = String(Math.max(0, n - 1)); rng.value = String(ci);
  m.querySelector('[data-rp="play"]').textContent = _dbf.playT ? '❚❚' : '▶';
  m.querySelector('[data-rp="spd"]').textContent = '×' + (_dbf.play || 10);
  m.querySelector('[data-rp="t"]').textContent = r ? `${_hms(r.t)} · ${r.alt.toFixed(0)}ft · ${r.ias.toFixed(0)}kt` : '';
}
try { appRegister({ toggleDebrief, dbfOpen, dbfClose, fdrSaveCsv, dbfReplay }); } catch (e) { _swallow(e); }
