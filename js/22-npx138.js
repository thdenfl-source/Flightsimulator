'use strict';
// ══════════════════════════════════════════════════════
// NAT NPX138 FM TRANSCEIVER — 하부 콘솔 ⑧ 칸(19-lower.js 의 'html' 자리 #npx)
// 2줄 × 16자 LCD · 듀얼 라벨 조작(EDIT 스위치가 가운데면 위 라벨, CH/ST 면 아래 라벨):
//   DISP(ID · RX · TX) · CHAN/SELECT(− +) · BRIGHT/NEXT(− +) · EDIT(CH · 가운데 · ST) · SQ/HELP
//   MN 노브(전원 겸 주 수신 음량, 왼쪽 끝 OFF) · GD 노브(가드 수신 음량) · RX/TX 표시등(송신 녹색 · 수신 호박색) · GD 표시등
//   SCAN · NORM · GD TX 스위치 · GD1/GD2 스위치
// 화면: 윗줄 = 채널(DISP 에 따라 이름 · 수신 주파수 · 송신 주파수) · 아랫줄 = 상태(PWR · TONES) 또는 ST 편집 항목
// 상태는 이 기기(localStorage 'npx138')에 남는다. 실제 송수신은 하지 않는다(조작 연습용).

const NPX_KEY = 'npx138';
const NPX_W = 16;
// CTCSS 38톤(EIA 1~38) · 모토로라 코드
const NPX_CT = [67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
  131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3];
const NPX_MOT = ['XZ', 'XA', 'WA', 'XB', 'SP', 'YZ', 'YA', 'YB', 'ZZ', 'ZA', 'ZB', '1Z', '1A', '1B', '2Z', '2A', '2B', '3Z', '3A',
  '3B', '4Z', '4A', '4B', '5Z', '5A', '5B', '6Z', '6A', '6B', '7Z', '7A', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
// 채널 이름 글자 바퀴(SELECT + 방향): 빈칸 → A … Z → 0 … 9 → # → . → - → / → 빈칸
const NPX_ALPH = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#.-/';
const NPX_GUARD = { GD1: 156.8, GD2: 156.3 };              // 가드 수신기 — GD1 해상 16번(조난) · GD2 해상 06번(선박-항공기 수색구조)
const NPX_FMIN = 138, NPX_FMAX = 173.995;
const NPX_PRESET = [
  { n: 1, name: 'MARINE 16', rx: 156.8, tx: 156.8, rxT: 0, txT: 0, nb: false, sc: true },
  { n: 2, name: 'MARINE 06', rx: 156.3, tx: 156.3, rxT: 0, txT: 0, nb: false, sc: true },
  { n: 3, name: 'MARINE 67', rx: 156.375, tx: 156.375, rxT: 0, txT: 0, nb: false, sc: false },
  { n: 4, name: 'MARINE 73', rx: 156.675, tx: 156.675, rxT: 0, txT: 0, nb: false, sc: false },
  { n: 5, name: 'MARINE 09', rx: 156.45, tx: 156.45, rxT: 0, txT: 0, nb: false, sc: false },
  { n: 6, name: 'KCG OPS', rx: 158.25, tx: 158.25, rxT: 9, txT: 9, nb: true, sc: true },
  { n: 7, name: 'KCG SAR', rx: 159.125, tx: 159.125, rxT: 9, txT: 9, nb: true, sc: true },
];
const NPX_ST = [   // 상태 편집(EDIT = ST) 항목 — [화면 이름, 상태 키, 값들(함수면 그때 만든다)]
  ['TX MODE', 'txMode', ['DUPLEX', 'SIMPLEX']],
  ['POWER', 'pwr', ['HI', 'LO']],
  ['TONES', 'tones', ['ON', 'OFF', 'TX ONLY']],
  ['TONE DISP', 'toneDisp', ['FREQ', 'EIA', 'WCODES', 'MCODES']],
  ['SCAN', 'scan', ['LIST', 'PRIORITY', 'LIST+PRI']],
  ['P1', 'p1', () => ['NONE', ...Array.from({ length: 99 }, (_, i) => i + 1)]],
  ['PWR-UP HELP', 'help', ['ON', 'OFF']],
  ['PWR-UP CHAN', 'puCh', () => ['PDC', ...Array.from({ length: 99 }, (_, i) => i + 1)]],
];

// 전원 — DC 버스(18-system.js pwrDc). 전원이 없으면 화면 · 표시등이 꺼지고 조작이 듣지 않는다
function _npxPwr() { try { return typeof pwrDc === 'function' ? pwrDc() : true; } catch (e) { return true; } }
let npx = null;
function _npxFresh() {
  return {
    on: true, mn: 6, gd: 4, ch: 1, chans: NPX_PRESET.map(c => Object.assign({}, c)),
    disp: 'ID', edit: 'NORM', scanSw: 'NORM', gdSel: 'GD1', bright: 5,
    st: { txMode: 'SIMPLEX', pwr: 'HI', tones: 'ON', toneDisp: 'FREQ', scan: 'LIST', p1: 1, help: 'ON', puCh: 'PDC' },
    // 잠깐 쓰는 것
    cur: 0, stItem: 0, msg: null, msgT: 0, sq: false, scanPtr: 0, scanSkip: [], helpUntil: 0, helpPg: -1,
  };
}
try {
  const v = JSON.parse(localStorage.getItem(NPX_KEY) || 'null');
  if (v && Array.isArray(v.chans)) {
    npx = Object.assign(_npxFresh(), v, { edit: 'NORM', scanSw: v.scanSw === 'SCAN' ? 'NORM' : (v.scanSw || 'NORM') });
    npx.st = Object.assign(_npxFresh().st, v.st || {});
    npx.bright = Math.min(5, npx.bright || 5);                       // 다시 켜면 밝기는 5단계까지
  }
} catch (e) { _swallow(e); }
if (!npx) npx = _npxFresh();
function _npxSave() {
  const { on, mn, gd, ch, chans, disp, scanSw, gdSel, bright, st } = npx;
  try { localStorage.setItem(NPX_KEY, JSON.stringify({ on, mn, gd, ch, chans, disp, scanSw, gdSel, bright, st })); } catch (e) { _swallow(e); }
}
const _npxPad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
const _npxR = (s, n) => (' '.repeat(n) + String(s)).slice(-n);
const _npx2 = n => String(n).padStart(2, '0');
const _npxF = f => (f + 1e-9).toFixed(4);
function npxChan(n) {
  let c = npx.chans.find(x => x.n === n);
  if (!c) c = { n, name: '', rx: 150, tx: 150, rxT: 0, txT: 0, nb: false, sc: false };   // 아직 안 넣은 채널
  return c;
}
function _npxPut(c) {
  const i = npx.chans.findIndex(x => x.n === c.n);
  if (i >= 0) npx.chans[i] = c; else { npx.chans.push(c); npx.chans.sort((a, b) => a.n - b.n); }
}
function npxTone(i) {
  if (!i) return '';
  const f = npx.st.toneDisp;
  if (f === 'EIA') return String(i);
  if (f === 'MCODES') return NPX_MOT[i - 1];
  if (f === 'WCODES') return i.toString(8).padStart(2, '0');
  return String(Math.floor(NPX_CT[i - 1]));
}
// 유효 주파수 — 138.000 ~ 173.995 MHz, 5 kHz 또는 6.25 kHz 눈금
function npxSnap(f) {
  f = Math.max(NPX_FMIN, Math.min(NPX_FMAX, f));
  const a = Math.round(f / 0.005) * 0.005, b = Math.round(f / 0.00625) * 0.00625;
  return Math.round((Math.abs(a - f) <= Math.abs(b - f) ? a : b) * 1e5) / 1e5;
}

// ── 화면 두 줄(16자) · 커서 칸 ──
// 특수 글자: '§' = 스캔 목록(sc) · '¶' = 우선 채널(P1) — 그릴 때 작은 두 글자로 바꾼다
function npxTop(c, which = npx.disp) {
  const simplex = npx.st.txMode === 'SIMPLEX' || Math.abs(c.rx - c.tx) < 1e-6;
  if (which === 'RX') return _npx2(c.n) + ' ' + _npxF(c.rx) + (simplex ? 's' : 'r') + _npxR(npxTone(c.rxT), 4);
  if (which === 'TX') return _npx2(c.n) + ' ' + _npxF(simplex ? c.rx : c.tx) + (simplex ? 's' : 't') + _npxR(npxTone(c.txT), 4);
  const p1 = npx.st.p1 === c.n;
  return _npx2(c.n) + ' ' + _npxPad(c.name, 10) + (c.nb ? 'n' : ' ') + (c.sc ? '§' : ' ') + (p1 ? '¶' : c.sc ? ' ' : '-');
}
function npxBottom() {
  if (npx.scanSw === 'GDTX') return `${npx.gdSel} TX ${_npxF(NPX_GUARD[npx.gdSel])}`;
  return `PWR=${npx.st.pwr} TONES=${npx.st.tones === 'TX ONLY' ? 'TX' : npx.st.tones}`;
}
function _npxStVals(i) { const v = NPX_ST[i][2]; return typeof v === 'function' ? v() : v; }
function _npxStText(i) { const [lbl, k] = NPX_ST[i], v = npx.st[k]; return `${lbl}=${typeof v === 'number' ? _npx2(v) : v}`; }
// CH 편집 커서 칸(윗줄 글자 자리) — ID: 이름 10자 · 대역폭 · sc · P1 / RX·TX: 주파수 숫자 7개 · 톤
function _npxFields() {
  if (npx.disp === 'ID') return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(c => [c, 1]);
  return [[3, 1], [4, 1], [5, 1], [7, 1], [8, 1], [9, 1], [10, 1], [12, 4]];
}
const _npxCh = () => npx._ed || npxChan(npx.ch);
function npxLines() {
  if (!npx.on || !_npxPwr()) return { l: ['', ''], cur: null };
  const now = performance.now();
  if (npx.msg && now < npx.msgT) return { l: npx.msg, cur: null };
  if (npx.helpPg >= 0) return { l: NPX_HELP_PG[npx.helpPg], cur: null };
  if (now < npx.helpUntil) return { l: ['NAT NPX138', 'SQ=HELP'], cur: null };
  if (npx.scanSw === 'SCAN' && npx.edit === 'NORM') {
    const pre = npx.st.scan === 'LIST' ? 'L' : npx.st.scan === 'PRIORITY' ? 'P' : 'LP';
    return { l: [pre + '-SCANNING', npxBottom()], cur: null };
  }
  const c = _npxCh(), top = npxTop(c);
  if (npx.edit === 'CH') { const f = _npxFields()[npx.cur] || _npxFields()[0]; return { l: [top, npxBottom()], cur: [0, f[0], f[1]] }; }
  if (npx.edit === 'ST') { const t = _npxStText(npx.stItem), at = t.indexOf('=') + 1; return { l: [top, t], cur: [1, at, t.length - at] }; }
  return { l: [top, npxBottom()], cur: null };
}
const NPX_HELP_PG = [
  ['CHAN=SEL CHANNEL', 'BRIGHT=DISPLAY'],
  ['DISP=ID/RX/TX', 'SQ=SQUELCH OPEN'],
  ['EDIT CH=CHANNEL', 'EDIT ST=STATUS'],
];
function _npxFlash(a, b, ms = 1800) { npx.msg = [_npxPad(a, NPX_W), _npxPad(b, NPX_W)]; npx.msgT = performance.now() + ms; setTimeout(npxRender, ms + 20); npxRender(); }

// ── 조작 ──
// CHAN(평소) · SELECT(편집)
function npxChanSw(d) {
  if (!npx.on || !_npxPwr()) return;
  npx.msg = null;
  if (npx.edit === 'CH') return _npxSelCh(d);
  if (npx.edit === 'ST') {
    const k = NPX_ST[npx.stItem][1], vs = _npxStVals(npx.stItem);
    npx.st[k] = vs[(vs.indexOf(npx.st[k]) + d + vs.length) % vs.length];
    _npxSave(); return npxRender();
  }
  if (npx.scanSw === 'SCAN') {                       // 스캔 중 '−' — 지금 채널을 잠깐 목록에서 뺀다(Nuisance delete)
    if (d < 0) { const n = npxScanList()[npx.scanPtr]; if (n) { npx.scanSkip.push(n); _npxFlash(`CH ${_npx2(n)} DELETED`, 'FROM SCAN', 1200); } }
    return npxRender();
  }
  npx.ch = ((npx.ch - 1 + d + 99) % 99) + 1;
  _npxSave(); npxRender();
}
function _npxSelCh(d) {
  const c = npx._ed, f = _npxFields()[npx.cur][0];
  if (npx.disp === 'ID') {
    if (f <= 12) {
      const s = _npxPad(c.name, 10).split(''), i = f - 3;
      s[i] = NPX_ALPH[(NPX_ALPH.indexOf(s[i]) + d + NPX_ALPH.length) % NPX_ALPH.length];
      c.name = s.join('').replace(/\s+$/, '');
    } else if (f === 13) c.nb = !c.nb;
    else if (f === 14) c.sc = !c.sc;
    else if (f === 15) npx.st.p1 = npx.st.p1 === c.n ? 'NONE' : c.n;
  } else {
    const k = npx.disp === 'RX' ? 'rx' : 'tx', tk = npx.disp === 'RX' ? 'rxT' : 'txT';
    if (f === 12) c[tk] = (c[tk] + d + 39) % 39;
    else {
      const s = _npxF(c[k]).split(''), i = f - 3;
      s[i] = String((+s[i] + d + 10) % 10);
      c[k] = parseFloat(s.join(''));
      if (npx.st.txMode === 'SIMPLEX' && k === 'rx') c.tx = c.rx;
    }
  }
  npxRender();
}
// BRIGHT(평소) · NEXT(편집)
function npxBrightSw(d) {
  if (!npx.on || !_npxPwr()) return;
  npx.msg = null;
  if (npx.edit === 'CH') { const n = _npxFields().length; npx.cur = (npx.cur + d + n) % n; return npxRender(); }
  if (npx.edit === 'ST') { npx.stItem = (npx.stItem + d + NPX_ST.length) % NPX_ST.length; return npxRender(); }
  npx.bright = Math.max(1, Math.min(7, npx.bright + d)); _npxSave(); npxRender();
}
// EDIT — CH · NORM · ST (CH 를 떠나면 고친 채널을 저장 · 주파수는 유효 눈금으로)
function npxEditSw(pos) {
  if (npx.edit === pos) return;
  if (npx.edit === 'CH' && npx._ed) {
    const c = npx._ed; c.rx = npxSnap(c.rx); c.tx = npxSnap(c.tx);
    if (npx.st.txMode === 'SIMPLEX') c.tx = c.rx;
    _npxPut(c); npx._ed = null;
  }
  npx.edit = pos; npx.msg = null;
  if (pos === 'CH') { npx._ed = Object.assign({}, npxChan(npx.ch)); npx.cur = 0; }
  if (pos === 'ST') npx.stItem = 0;
  _npxSave(); npxRender();
}
function npxDispSw(pos) {
  npx.disp = pos;
  if (npx.edit === 'CH') npx.cur = 0;
  _npxSave(); npxRender();
}
// SQ(평소 — 누르는 동안 스켈치 열림) · HELP(편집) · 켠 직후 HELP
function npxSq(down) {
  if (!npx.on || !_npxPwr()) return;
  if (!down) { npx.sq = false; return npxRender(); }
  npx.msg = null;
  if (npx.edit === 'CH') return _npxFlash('NEXT=MOVE CURSOR', 'SELECT=CHANGE');
  if (npx.edit === 'ST') return _npxFlash('NEXT=NEXT ITEM', 'SELECT=CHG VALUE');
  if (performance.now() < npx.helpUntil || npx.helpPg >= 0) return _npxHelpRun();
  npx.sq = true; npxRender();
}
function _npxHelpRun() {
  npx.helpUntil = 0; npx.helpPg = 0; npxRender();
  const step = () => { if (npx.helpPg < 0) return; npx.helpPg++; if (npx.helpPg >= NPX_HELP_PG.length) npx.helpPg = -1; npxRender(); if (npx.helpPg >= 0) setTimeout(step, 1800); };
  setTimeout(step, 1800);
}
// MN 노브 — 왼쪽 끝 OFF(멈춤쇠) · 돌리면 켜지고 주 수신 음량 1~10
function npxMn(d) {
  if (!_npxPwr()) return;
  if (!npx.on) { if (d > 0) _npxPowerUp(); return; }
  if (npx.mn <= 0 && d < 0) { npx.on = false; npx.edit = 'NORM'; npx._ed = null; npx.helpPg = -1; npx.sq = false; _npxSave(); return npxRender(); }
  npx.mn = Math.max(0, Math.min(10, npx.mn + d)); _npxSave(); npxRender();
}
function _npxPowerUp() {
  npx.on = true; npx.mn = 1; npx.bright = Math.min(5, npx.bright);
  if (npx.st.puCh !== 'PDC') npx.ch = npx.st.puCh;
  npx.helpPg = -1; npx.helpUntil = npx.st.help === 'ON' ? performance.now() + 3000 : 0;
  if (npx.helpUntil) setTimeout(npxRender, 3020);
  _npxSave(); npxRender();
}
function npxGd(d) {
  if (!_npxPwr()) return;
  npx.gd = Math.max(0, Math.min(10, npx.gd + d)); _npxSave(); npxRender(); }
// SCAN · NORM · GD TX
function npxScanSw(pos) {
  npx.scanSw = pos; npx.scanSkip = []; npx.scanPtr = 0;
  _npxSave(); npxRender();
}
function npxGdSel(pos) { npx.gdSel = pos; _npxSave(); npxRender(); }
function npxScanList() {
  const list = npx.chans.filter(c => c.sc && !npx.scanSkip.includes(c.n)).map(c => c.n);
  if (npx.st.scan === 'PRIORITY') return typeof npx.st.p1 === 'number' ? [npx.st.p1] : [];
  if (npx.st.scan === 'LIST+PRI' && typeof npx.st.p1 === 'number' && !list.includes(npx.st.p1)) list.unshift(npx.st.p1);
  return list;
}
setInterval(() => {                                   // 스캔 — 목록 채널을 차례로 훑는다(신호는 흉내 내지 않는다)
  if (!npx.on || npx.scanSw !== 'SCAN') return;
  const L = npxScanList(); npx.scanPtr = L.length ? (npx.scanPtr + 1) % L.length : 0;
}, 300);

// ── 그리기 ──
function npxRender() {
  const lcd = document.getElementById('npx-lcd');
  if (!lcd) return;
  const { l, cur } = npxLines();
  const esc = ch => ch === '§' ? '<i class="npx-g">sc</i>' : ch === '¶' ? '<i class="npx-g">P1</i>' :
    ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch === ' ' ? '&nbsp;' : ch;
  lcd.innerHTML = l.map((line, li) => '<div class="npx-row">' + [..._npxPad(line, NPX_W)].map((ch, ci) => {
    const on = cur && cur[0] === li && ci >= cur[1] && ci < cur[1] + cur[2];
    return `<span${on ? ' class="npx-cur"' : ''}>${on && ch === ' ' ? '_' : esc(ch)}</span>`;
  }).join('') + '</div>').join('');
  lcd.classList.toggle('off', !npx.on || !_npxPwr());
  lcd.style.setProperty('--npx-dim', (0.3 + npx.bright * 0.1).toFixed(2));
  const host = document.getElementById('npx');
  const set = (sel, attr, v) => { const e = host.querySelector(sel); if (e) e.dataset[attr] = v; };
  set('[data-npx="disp"]', 'pos', npx.disp); set('[data-npx="edit"]', 'pos', npx.edit);
  set('[data-npx="scan"]', 'pos', npx.scanSw); set('[data-npx="gdsel"]', 'pos', npx.gdSel);
  const rot = (sel, a) => { const e = host.querySelector(sel + ' .npx-cap'); if (e) e.style.transform = `rotate(${a}deg)`; };
  rot('[data-npx="mn"]', npx.on ? -120 + npx.mn * 24 : -150);
  rot('[data-npx="gd"]', -120 + npx.gd * 24);
  const led = host.querySelector('.npx-led.main');
  if (led) led.className = 'npx-led main' + (npx.on && npx.sq && _npxPwr() ? ' rx' : '');
  host.classList.toggle('edit', npx.edit !== 'NORM');
}
function npxBuild() {
  const host = document.getElementById('npx');
  if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  const tog = (id, x, y, title) => `<div class="npx-tog" data-npx="${id}" style="left:${x - 15}px;top:${y - 15}px" title="${title}"><b></b></div>`;
  const rock = (id, x, y, title) => `<div class="npx-rock" data-npx="${id}" style="left:${x - 15}px;top:${y - 13}px" title="${title}"><b></b></div>`;
  const lbl = (x, y, t, cls = '') => `<div class="npx-l ${cls}" style="left:${x - 30}px;top:${y}px">${t}</div>`;
  host.innerHTML =
    `<div class="npx-title">NPX&nbsp; FM&nbsp; TRANSCEIVER</div><div class="npx-lcd" id="npx-lcd"></div>` +
    lbl(38, 64, 'DISP') + lbl(102, 64, 'CHAN') + lbl(160, 64, 'BRIGHT') + lbl(218, 64, 'EDIT') + lbl(276, 64, 'SQ') +
    lbl(17, 80, 'ID', 's') + lbl(60, 80, 'TX', 's') + lbl(38, 104, 'RX') +
    lbl(84, 80, '−', 's') + lbl(120, 80, '+', 's') + lbl(142, 80, '−', 's') + lbl(178, 80, '+', 's') +
    lbl(196, 80, 'CH', 's') + lbl(240, 80, 'ST', 's') +
    lbl(102, 104, 'SELECT') + lbl(160, 104, 'NEXT') + lbl(276, 104, 'HELP') +
    `<div class="npx-line" style="left:126px;top:110px;width:16px"></div><div class="npx-line" style="left:180px;top:110px;width:76px"></div>` +
    tog('disp', 38, 86, 'DISP — 왼쪽 ID · 아래 RX · 오른쪽 TX') +
    rock('chan', 102, 86, 'CHAN − + (평소: 채널 · 누르고 있으면 빨리) / SELECT(편집: 커서 자리 값 바꾸기)') +
    rock('bright', 160, 86, 'BRIGHT − + (평소: 밝기 1~7) / NEXT(편집: 커서 옮기기 · ST 항목 넘기기)') +
    tog('edit', 218, 86, 'EDIT — 왼쪽 CH(채널 편집) · 가운데 끔 · 오른쪽 ST(상태 편집)') +
    `<button class="npx-sq" data-npx="sq" style="left:263px;top:75px" title="SQ(누르는 동안 스켈치 열림) / HELP(편집 중 · 켠 직후)"></button>` +
    `<div class="npx-knob" data-npx="mn" style="left:312px;top:12px" title="MN — 전원 겸 주 수신 음량(왼쪽 −, 오른쪽 + · 왼쪽 끝 OFF)"><div class="npx-cap"><i></i><span>MN</span></div></div>` +
    `<div class="npx-knob" data-npx="gd" style="left:312px;top:70px" title="GD — 가드 수신 음량(왼쪽 −, 오른쪽 +)"><div class="npx-cap"><i></i><span>GD</span></div></div>` +
    lbl(330, 51, 'OFF') + lbl(352, 106, 'MIN') +
    `<div class="npx-line" style="left:348px;top:30px;width:52px"></div><div class="npx-line" style="left:348px;top:88px;width:52px"></div>` +
    `<div class="npx-led main" style="left:365px;top:23px" title="RX/TX — 송신 녹색 · 수신 호박색"></div>` +
    `<div class="npx-led gd" style="left:365px;top:81px" title="GUARD RX — 호박색"></div>` +
    tog('scan', 412, 31, 'SCAN(위) · NORM(가운데) · GD TX(아래)') + tog('gdsel', 412, 89, 'GD1(위) · GD2(아래)') +
    lbl(412, 5, 'SCAN') + lbl(449, 27, 'NORM', 's') + lbl(412, 49, 'GD TX') + lbl(412, 63, 'GD1') + lbl(412, 106, 'GD2') +
    `<div class="npx-logo">✻nat</div>`;
  // 3자리 스위치 — 누른 자리로 위치를 고른다
  const zone3 = (e, el, vertical) => {
    const r = el.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const f = vertical ? fy : fx; return f < 0.38 ? 0 : f > 0.62 ? 2 : 1;
  };
  const on = (id, fn) => { const el = host.querySelector(`[data-npx="${id}"]`); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(e, el); }); return el; };
  on('disp', (e, el) => {
    const r = el.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    npxDispSw(fy > 0.6 && fx > 0.3 && fx < 0.7 ? 'RX' : fx < 0.5 ? 'ID' : 'TX');
  });
  on('edit', (e, el) => npxEditSw(['CH', 'NORM', 'ST'][zone3(e, el, false)]));
  on('scan', (e, el) => npxScanSw(['SCAN', 'NORM', 'GDTX'][zone3(e, el, true)]));
  on('gdsel', (e, el) => npxGdSel(zone3(e, el, true) < 1 ? 'GD1' : zone3(e, el, true) > 1 ? 'GD2' : npx.gdSel));
  // 누르고 있으면 되풀이(CHAN 은 빨리 넘긴다)
  const hold = (id, fn) => {
    let t0 = null, rep = null;
    const el = on(id, (e, el2) => {
      const r = el2.getBoundingClientRect(), d = e.clientX < r.left + r.width / 2 ? -1 : 1;
      fn(d); t0 = setTimeout(() => { rep = setInterval(() => fn(d), id === 'chan' ? 90 : 160); }, 450);
    });
    const stop = () => { clearTimeout(t0); clearInterval(rep); t0 = rep = null; };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, stop));
    el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); fn(e.deltaY > 0 ? -1 : 1); }, { passive: false });
  };
  hold('chan', npxChanSw); hold('bright', npxBrightSw); hold('mn', npxMn); hold('gd', npxGd);
  const sq = on('sq', () => npxSq(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => sq.addEventListener(ev, () => { if (npx.sq) npxSq(false); }));
  npxRender();
}
if (document.getElementById('npx')) npxBuild();
