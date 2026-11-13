'use strict';
// ══════════════════════════════════════════════════════
// Wulfsberg C-5000 Communication Management Controller(CMC) — 하부 콘솔 ⑦ 칸(19-lower.js 의 'html' 자리 #c5k)
// 무전기 두 대(RT1 윗줄 · RT2 아랫줄)를 2줄 × 20자 LCD 로 다룬다.
//   UPPER / LOWER SOFT key · VOL 노브(안 = RT1 음량 · 바깥 = RT2 음량 · 가운데 PUSH ON) ·
//   SEL 노브(바깥 = CURSOR · 안 = VALUE · 가운데 PUSH ENTER) · 12키(1 DIR · 2 MODE · 3 EDIT · 4 DIM · 5 OTAR · 6 KEY ·
//   7 TEST · 8 SCAN · * HOME · 9 PVTφ · 0 PROG · # NUM)
// 노브는 칸(바깥 고리 · 안 원판)의 왼쪽을 누르면 −, 오른쪽을 누르면 +(누르고 있으면 계속), 마우스 휠도 듣는다.
// 화면(page): OFF · HOME · EDIT · DIM · NUM · MODE · KEY · OTAR · PROG_PW · PROG_MENU · PWR_WARN
// 상태는 이 기기(localStorage 'c5000')에 남는다. 실제 무전 송수신은 하지 않는다(제어기 화면 · 조작 연습용).

const C5_KEY = 'c5000';
const C5_W = 20;
// 미리 넣어 둔 채널(해상 VHF-FM · 항공) — 0 은 매뉴얼 채널(..M, 주파수를 직접 바꾼다)
const C5_DEFAULT_CH = [
  { n: 0, id: '', rx: 156.800, tx: 156.800, rxT: '', txT: '', mod: 'FM', bw: 'S', pwr: 'HI', key: 0 },
  { n: 1, id: 'MARINE 16', rx: 156.800, tx: 156.800, rxT: '', txT: '', mod: 'FM', bw: 'S', pwr: 'HI', key: 0 },
  { n: 2, id: 'MARINE 06', rx: 156.300, tx: 156.300, rxT: '', txT: '', mod: 'FM', bw: 'S', pwr: 'HI', key: 0 },
  { n: 3, id: 'MARINE 67', rx: 156.375, tx: 156.375, rxT: '', txT: '', mod: 'FM', bw: 'S', pwr: 'HI', key: 0 },
  { n: 4, id: 'MARINE 73', rx: 156.675, tx: 156.675, rxT: '', txT: '', mod: 'FM', bw: 'S', pwr: 'HI', key: 0 },
  { n: 5, id: 'KCG OPS', rx: 158.250, tx: 158.250, rxT: 'T.17', txT: 'T.17', mod: 'FM', bw: 'N', pwr: 'HI', key: 1 },
  { n: 6, id: 'KCG SAR', rx: 159.125, tx: 159.125, rxT: 'T.17', txT: 'T.17', mod: 'FM', bw: 'N', pwr: 'HI', key: 1 },
  { n: 7, id: 'AIR GUARD', rx: 121.500, tx: 121.500, rxT: '', txT: '', mod: 'AM', bw: 'W', pwr: 'HI', key: 0 },
  { n: 8, id: 'SAR 123.1', rx: 123.100, tx: 123.100, rxT: '', txT: '', mod: 'AM', bw: 'W', pwr: 'HI', key: 0 },
];
const C5_TONES = ['', 'T.17', 'T.21', 'T.23', 'D.023', 'D.754'];
const C5_MODS = ['FM', 'AM', 'P', 'TK'], C5_BWS = ['N', 'S', 'W', 'X'], C5_PWRS = ['HI', 'LO'];
const C5_MODES = ['SIMULCAST', 'RELAY', 'RELAY/SIMULCAST', 'REPEATER'];
const C5_PHI = 'φ', C5_ARROW = '→';

// 전원 — DC 버스(상부 콘솔 전기 계통 · 18-system.js pwrDc). 전원이 없으면 화면이 꺼지고 조작이 듣지 않는다
function _c5Pwr() { try { return typeof pwrDc === 'function' ? pwrDc() : true; } catch (e) { return true; } }
let c5 = null;
function _c5Fresh() {
  return {
    on: true, page: 'HOME', line: 0, dim: 6,
    ch: C5_DEFAULT_CH.map(c => Object.assign({}, c)),
    r: [0, 1].map(i => ({ ch: i ? 7 : 1, dir: false, pvt: false, key: 'PSET', guard: false, sq: false, vol: 6 })),
    mode: '',            // 켜 둔 강화 모드(SIMULCAST …) · '' 이면 보통
    modeSel: 0, keySel: 'PSET', num: '', pw: '', otar: '', edit: null, editF: 0, msg: '', msgT: 0, volShow: null,
  };
}
try { const v = JSON.parse(localStorage.getItem(C5_KEY) || 'null'); if (v && Array.isArray(v.ch) && Array.isArray(v.r)) c5 = Object.assign(_c5Fresh(), v, { page: v.on ? 'HOME' : 'OFF' }); } catch (e) { _swallow(e); }
if (!c5) c5 = _c5Fresh();
function _c5Save() {
  try { localStorage.setItem(C5_KEY, JSON.stringify({ on: c5.on, dim: c5.dim, ch: c5.ch, r: c5.r, mode: c5.mode, line: c5.line })); } catch (e) { _swallow(e); }
}
const _c5pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
const _c5rpad = (s, n) => (' '.repeat(n) + String(s)).slice(-n);
const _c5ch = n => c5.ch.find(c => c.n === n) || c5.ch[0];
const _c5f = f => (f + 1e-9).toFixed(3);
function _c5chNo(n) { return n === 0 ? '..M' : _c5rpad(n, 3).replace(/ /g, '.'); }

// ── 화면 두 줄(20자씩)과 커서 자리 [줄, 시작, 길이] ──
function c5Lines() {
  if (!c5.on || !_c5Pwr()) return { l: ['', ''], cur: null };
  const p = c5.page;
  if (c5.msg && performance.now() < c5.msgT) return { l: c5.msg, cur: null };
  if (p === 'PWR_WARN') return { l: _c5Blank ? ['', ''] : ['!!! USE CAUTION !!!', 'TURNING SYSTEM OFF'], cur: null };
  if (p === 'DIM') return { l: ['←UP   CHANGE DISPLAY', '←DOWN  BRIGHTNESS ' + c5.dim], cur: null };
  if (p === 'NUM') { const o = homeLine(1 - c5.line); const l = ['', '']; l[c5.line] = `${c5.line + 1} CHAN=${_c5rpad(c5.num, 3).replace(/ /g, '.')} <ENTER>`; l[1 - c5.line] = o; return { l, cur: [c5.line, 7, 3] }; }
  if (p === 'MODE') return { l: ['PRESS ENTER BUTTON', 'FOR ' + C5_MODES[c5.modeSel] + (C5_MODES[c5.modeSel].length > 11 ? '' : ' MODE')], cur: null };
  if (p === 'MODE_ON') return { l: [c5.mode + (c5.mode.length > 11 ? '' : ' MODE'), c5.mode === 'REPEATER' ? '1..1 2 RCV' : '1..1 2..2'], cur: null };
  if (p === 'KEY') return { l: [`TX KEY=${_c5pad(c5.keySel, 4)} <ENTER>`, homeLine(1 - c5.line)], cur: [0, 7, 4] };
  if (p === 'OTAR') return { l: [`${c5.line + 1} ` + (c5.otar === '' ? 'ENTER=START OTAR' : c5.otar === 'RUN' ? 'OTAR IN PROGRESS' : 'OTAR COMPLETE'), homeLine(1 - c5.line)], cur: null };
  if (p === 'PROG_PW') return { l: ['ENTER PASSWORD ' + (c5.line + 1), ' #=' + _c5pad('*'.repeat(c5.pw.length) + '....', 4) + ' <ENTER>'], cur: [1, 3, 4] };
  if (p === 'PROG_MENU') return { l: ['PROG: CHANNEL', '2=ADD 3=CHG 4=DEL'], cur: null };
  if (p === 'EDIT') return editLines();
  // HOME
  const l = [homeLine(0), homeLine(1)];
  if (c5.volShow && performance.now() < c5.volShow.t) {
    const i = c5.volShow.i, v = c5.r[i].vol;
    l[i] = _c5pad(`${i + 1} VOL ` + '#'.repeat(v) + '-'.repeat(10 - v), C5_W);
  }
  return { l, cur: [c5.line, 5, 3] };
}
function homeLine(i) {
  const r = c5.r[i], c = _c5ch(r.ch);
  const st = r.sq ? 'SQ.' : r.guard ? 'G..' : '...';                 // R/T 상태(스켈치 열림 · GUARD 수신기 · 대기)
  const name = r.ch === 0 ? _c5f(c.rx) : c.id;
  return _c5pad(`${i + 1}${st}${r.pvt ? C5_PHI : ' '}${_c5chNo(r.ch)}${r.dir ? C5_ARROW : ' '}${_c5pad(name, 11)}`, C5_W);
}
// EDIT — 윗줄: 채널 · Direct · 수신 주파수 R 수신톤 변조 / 아랫줄: 대역폭 · 출력 · 송신 주파수 T 송신톤 · 암호 키
const C5_EF = [   // 고칠 칸: [줄, 시작, 길이, 이름]
  [0, 3, 1, 'dir'], [0, 4, 7, 'rx'], [0, 12, 4, 'rxT'], [0, 17, 2, 'mod'],
  [1, 0, 1, 'bw'], [1, 1, 2, 'pwr'], [1, 4, 7, 'tx'], [1, 12, 4, 'txT'], [1, 17, 2, 'key'],
];
function editLines() {
  const e = c5.edit, r = c5.r[c5.line];
  const l0 = `${_c5chNo(e.n)}${r.dir ? C5_ARROW : '.'}${_c5f(e.rx)}R${_c5pad(e.rxT || '....', 4)} ${_c5pad(e.mod, 2)} `;
  const l1 = `${e.bw}${e.pwr} ${_c5f(e.tx)}T${_c5pad(e.txT || '....', 4)} ${_c5rpad(e.key ? e.key : '..', 2)} `;
  const f = C5_EF[c5.editF];
  return { l: [_c5pad(l0, C5_W), _c5pad(l1, C5_W)], cur: [f[0], f[1], f[2]] };
}
function _c5flash(l0, l1, ms = 1500) { c5.msg = [_c5pad(l0, C5_W), _c5pad(l1, C5_W)]; c5.msgT = performance.now() + ms; setTimeout(c5Render, ms + 20); }

// ── 누름 · 돌림 ──
function c5Key(k) {
  if (!c5.on || !_c5Pwr()) return;
  c5.msg = '';                                        // 잠깐 띄운 알림은 다음 조작에서 걷힌다
  const p = c5.page, r = c5.r[c5.line];
  // 숫자를 받는 화면 — NUM · PROG 비밀번호 · PROG 메뉴
  if (/^\d$/.test(k) && p === 'NUM') { c5.num = (c5.num + k).slice(-3); return c5Render(); }
  if (/^\d$/.test(k) && p === 'PROG_PW') { if (c5.pw.length < 4) c5.pw += k; return c5Render(); }
  if (p === 'PROG_MENU' && /^[234]$/.test(k)) return c5ProgMenu(k);
  switch (k) {
    case '*': c5.page = 'HOME'; c5.edit = null; break;                                   // HOME
    case '1': if (p === 'HOME') { r.dir = !r.dir; _c5Save(); } break;                     // DIR — Direct(심플렉스) ⇄ Repeat
    case '2':                                                                             // MODE — SIMULCAST → RELAY → RELAY/SIMULCAST → REPEATER
      if (p === 'MODE') c5.modeSel = (c5.modeSel + 1) % C5_MODES.length;
      else { c5.page = 'MODE'; c5.modeSel = c5.mode ? (C5_MODES.indexOf(c5.mode) + 1) % C5_MODES.length : 0; }
      break;
    case '3': c5.edit = Object.assign({}, _c5ch(r.ch)); c5.editF = 0; c5.page = 'EDIT'; break;   // EDIT
    case '4': c5.page = p === 'DIM' ? 'HOME' : 'DIM'; break;                               // DIM
    case '5': c5.page = 'OTAR'; c5.otar = ''; break;                                       // OTAR
    case '6': c5.page = 'KEY'; c5.keySel = r.key; break;                                   // KEY — 송신 암호 키 오버라이드
    case '7': r.sq = !r.sq; break;                                                         // TEST — 스켈치 오버라이드
    case '8': _c5flash('SCAN', 'NOT AVAILABLE'); break;                                    // SCAN — 이 기체에는 없다
    case '9': if (p === 'HOME') { r.pvt = !r.pvt; _c5Save(); } break;                     // PVTφ — 암호 송신
    case '0': c5.page = 'PROG_PW'; c5.pw = ''; break;                                      // PROG — 비밀번호 뒤 채널 프로그래밍
    case '#': if (p === 'NUM') c5.page = 'HOME'; else { c5.page = 'NUM'; c5.num = ''; } break;   // NUM — 채널 번호 직접
  }
  c5Render();
}
function c5ProgMenu(k) {
  const r = c5.r[c5.line];
  if (k === '2') {                       // ADD — 빈 번호에 새 채널(매뉴얼 채널을 본떠) → EDIT
    let n = 1; while (c5.ch.some(c => c.n === n) && n < 999) n++;
    const c = Object.assign({}, _c5ch(0), { n, id: 'CHAN ' + n });
    c5.ch.push(c); c5.ch.sort((a, b) => a.n - b.n); r.ch = n;
    c5.edit = Object.assign({}, c); c5.editF = 1; c5.page = 'EDIT';
  } else if (k === '3') { c5.edit = Object.assign({}, _c5ch(r.ch)); c5.editF = 1; c5.page = 'EDIT'; }
  else if (k === '4') {                 // DEL — 매뉴얼 채널(0)은 지우지 않는다
    if (r.ch !== 0) { const n = r.ch; c5.ch = c5.ch.filter(c => c.n !== n); c5.r.forEach(x => { if (x.ch === n) x.ch = 0; }); _c5flash(`CHAN ${n}`, 'DELETED'); }
    c5.page = 'HOME';
  }
  _c5Save(); c5Render();
}
// ENTER(SEL 노브 누름) — 화면마다 확정 · HOME 에서는 RT1 ⇄ RT2 줄 바꾸기
function c5Enter() {
  if (!c5.on || !_c5Pwr()) return;
  c5.msg = '';                                        // 잠깐 띄운 알림은 다음 조작에서 걷힌다
  const p = c5.page, r = c5.r[c5.line];
  if (p === 'HOME') c5.line = 1 - c5.line;
  else if (p === 'NUM') { const n = parseInt(c5.num || '0', 10); if (c5.ch.some(c => c.n === n)) { r.ch = n; c5.page = 'HOME'; } else _c5flash(`${c5.line + 1} CHAN ${n}`, 'NOT PROGRAMMED'); }
  else if (p === 'MODE') { c5.mode = C5_MODES[c5.modeSel]; c5.page = 'MODE_ON'; }
  else if (p === 'MODE_ON') { c5.mode = ''; c5.page = 'HOME'; _c5flash('ENHANCED MODE', 'OFF'); }
  else if (p === 'KEY') { r.key = c5.keySel; c5.page = 'HOME'; }
  else if (p === 'OTAR' && c5.otar === '') {
    c5.otar = 'RUN'; setTimeout(() => { c5.otar = 'DONE'; c5Render(); setTimeout(() => { if (c5.page === 'OTAR') c5.page = 'HOME'; c5Render(); }, 1500); }, 2000);
  }
  else if (p === 'PROG_PW') { if (c5.pw.length === 4) { c5.page = 'PROG_MENU'; c5.pw = ''; } }
  else if (p === 'EDIT') {               // 고친 값을 그 채널에 넣고 HOME
    const i = c5.ch.findIndex(c => c.n === c5.edit.n);
    if (i >= 0) c5.ch[i] = Object.assign({}, c5.edit);
    c5.edit = null; c5.page = 'HOME'; _c5flash('CHANNEL', 'SAVED', 900);
  }
  _c5Save(); c5Render();
}
// CURSOR 노브 — EDIT 에서는 고칠 칸을 옮기고, HOME 에서는 RT1 ⇄ RT2 줄
function c5Cursor(d) {
  if (!c5.on || !_c5Pwr()) return;
  c5.msg = '';                                        // 잠깐 띄운 알림은 다음 조작에서 걷힌다
  if (c5.page === 'EDIT') c5.editF = (c5.editF + d + C5_EF.length) % C5_EF.length;
  else if (c5.page === 'HOME') c5.line = 1 - c5.line;
  c5Render();
}
// VALUE 노브 — 커서 자리의 값을 돌린다(HOME: 채널 · EDIT: 칸 값 · MODE · KEY · DIM)
function c5Value(d) {
  if (!c5.on || !_c5Pwr()) return;
  c5.msg = '';                                        // 잠깐 띄운 알림은 다음 조작에서 걷힌다
  const p = c5.page, r = c5.r[c5.line];
  const cyc = (arr, v) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
  if (p === 'HOME') { const ns = c5.ch.map(c => c.n); r.ch = cyc(ns, r.ch); _c5Save(); }
  else if (p === 'MODE') c5.modeSel = (c5.modeSel + d + C5_MODES.length) % C5_MODES.length;
  else if (p === 'KEY') { const ks = ['PSET', ...Array.from({ length: 16 }, (_, i) => String(i + 1))]; c5.keySel = cyc(ks, String(c5.keySel)); }
  else if (p === 'DIM') c5.dim = Math.max(1, Math.min(10, c5.dim + d));
  else if (p === 'EDIT') {
    const e = c5.edit, f = C5_EF[c5.editF][3];
    if (f === 'dir') r.dir = !r.dir;
    else if (f === 'rx' || f === 'tx') { e[f] = Math.round(Math.max(30, Math.min(512, e[f] + d * 0.0125)) * 10000) / 10000; if (f === 'rx' && e.n === 0) e.tx = e.rx; }
    else if (f === 'rxT' || f === 'txT') e[f] = cyc(C5_TONES, e[f]);
    else if (f === 'mod') e.mod = cyc(C5_MODS, e.mod);
    else if (f === 'bw') e.bw = cyc(C5_BWS, e.bw);
    else if (f === 'pwr') e.pwr = cyc(C5_PWRS, e.pwr);
    else if (f === 'key') e.key = (e.key + d + 17) % 17;
  }
  c5Render();
}
// 소프트키 — DIM 화면: 밝기 ▲▼ · 그 밖: 그 줄 무전기의 GUARD 수신기 ⇄ MAIN
function c5Soft(i) {
  if (!c5.on || !_c5Pwr()) return;
  c5.msg = '';                                        // 잠깐 띄운 알림은 다음 조작에서 걷힌다
  if (c5.page === 'DIM') c5.dim = Math.max(1, Math.min(10, c5.dim + (i === 0 ? 1 : -1)));
  else { c5.r[i].guard = !c5.r[i].guard; _c5Save(); }
  c5Render();
}
// VOL 노브 — 안 = RT1 · 바깥 = RT2 (0 … 10)
function c5Vol(i, d) {
  if (!c5.on || !_c5Pwr()) return;
  c5.r[i].vol = Math.max(0, Math.min(10, c5.r[i].vol + d));
  c5.volShow = { i, t: performance.now() + 1200 }; setTimeout(c5Render, 1250);
  _c5Save(); c5Render();
}
// PUSH ON — 꺼져 있으면 1초 누르면 켜진다 · 켜져 있으면 누르는 동안 경고, 2초 넘게 누르면 꺼진다
// 끄기: 켜진 채로 PUSH ON 을 누르면 삑 소리와 함께 '!!! USE CAUTION !!! / TURNING SYSTEM OFF' 가
//        켜짐 0.4초 · 꺼짐 0.2초로 다섯 번 깜빡인 뒤 꺼진다(손을 떼도 멈추지 않는다). 켜기는 1초 누르기 그대로.
// 실기 영상대로 — 켜짐 0.4초 · 꺼짐 0.2초를 다섯 번(약 3초)
const C5_OFF_ON_MS = 400, C5_OFF_OFF_MS = 200, C5_OFF_N = 5;
let _c5PwrT = null, _c5OffT = null, _c5Blank = false, _c5Ac = null;
function _c5Beep(ms = 120, hz = 2000) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    _c5Ac = _c5Ac || new AC(); if (_c5Ac.state === 'suspended') _c5Ac.resume();
    const o = _c5Ac.createOscillator(), g = _c5Ac.createGain(), t = _c5Ac.currentTime;
    o.type = 'square'; o.frequency.value = hz; g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0, t + ms / 1000);
    o.connect(g); g.connect(_c5Ac.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch (e) { _swallow(e); }
}
function c5PwrDown() {
  if (!_c5Pwr() || _c5OffT) return;
  if (!c5.on) { _c5PwrT = setTimeout(() => { c5.on = true; c5.page = 'HOME'; _c5flash('WULFSBERG C-5000', 'SELF TEST OK', 1200); _c5Save(); c5Render(); }, 1000); return; }
  c5.msg = null; c5.page = 'PWR_WARN';
  let k = 0;
  const step = () => {
    if (k >= C5_OFF_N * 2) { _c5OffT = null; _c5Blank = false; c5.on = false; c5.page = 'OFF'; _c5Save(); c5Render(); return; }
    _c5Blank = k % 2 === 1; if (!_c5Blank) _c5Beep();
    k++; c5Render(); _c5OffT = setTimeout(step, _c5Blank ? C5_OFF_OFF_MS : C5_OFF_ON_MS);
  };
  step();
}
function c5PwrUp() { clearTimeout(_c5PwrT); _c5PwrT = null; }

// ── 그리기 ──
function c5Render() {
  const lcd = document.getElementById('c5-lcd');
  if (!lcd) return;
  const { l, cur } = c5Lines();
  const esc = ch => ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch === ' ' ? '&nbsp;' : ch;
  lcd.innerHTML = l.map((line, li) => '<div class="c5-row">' + [..._c5pad(line, C5_W)].map((ch, ci) =>
    `<span${cur && cur[0] === li && ci >= cur[1] && ci < cur[1] + cur[2] ? ' class="c5-cur"' : ''}>${esc(ch)}</span>`).join('') + '</div>').join('');
  lcd.classList.toggle('off', !c5.on || !_c5Pwr());
  lcd.style.setProperty('--c5-dim', (0.35 + c5.dim * 0.065).toFixed(2));
  lcd.dataset.page = c5.on ? c5.page : 'OFF';
}
function c5Build() {
  const host = document.getElementById('c5k');
  if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  const KEYS = [['1', 'DIR'], ['2', 'MODE'], ['3', 'EDIT'], ['4', 'DIM'], ['5', 'OTAR'], ['6', 'KEY'], ['7', 'TEST'], ['8', 'SCAN'],
                ['*', 'HOME'], ['9', 'PVT' + C5_PHI], ['0', 'PROG'], ['#', 'NUM']];
  host.innerHTML =
    `<div class="c5-brand">WULFSBERG</div>` +
    `<button class="c5-soft up" data-c5="soft0" title="UPPER SOFT key — DIM: 밝기 ▲ · 그 밖: RT1 GUARD ⇄ MAIN"></button>` +
    `<button class="c5-soft dn" data-c5="soft1" title="LOWER SOFT key — DIM: 밝기 ▼ · 그 밖: RT2 GUARD ⇄ MAIN"></button>` +
    `<div class="c5-lcd" id="c5-lcd"></div>` +
    `<div class="c5-pad">` + KEYS.map(([n, f]) => `<button class="c5-key" data-c5="k${n}"><b>${n}</b><i>${f}</i></button>`).join('') + `</div>` +
    `<div class="c5-tag vol">VOL</div><div class="c5-tag sel">SEL</div>` +
    `<div class="c5-knob vol" data-c5k="vol" title="VOL — 바깥 고리: RT2 음량 · 안 원판: RT1 음량 (왼쪽 −, 오른쪽 +) · 가운데 PUSH ON(1초 켜기 · 2초 끄기)"><div class="c5-inner"><div class="c5-push">PUSH ON</div></div></div>` +
    `<div class="c5-knob sel" data-c5k="sel" title="SEL — 바깥 고리: CURSOR · 안 원판: VALUE (왼쪽 −, 오른쪽 +) · 가운데 PUSH ENTER"><div class="c5-inner"><div class="c5-push">PUSH ENTER</div></div></div>`;
  host.querySelectorAll('[data-c5]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const a = b.dataset.c5;
    if (a === 'soft0') c5Soft(0); else if (a === 'soft1') c5Soft(1); else c5Key(a.slice(1));
  }));
  // 노브 — 누른 자리로 안 원판 · 바깥 고리 · 가운데를 가린다(누르고 있으면 계속)
  host.querySelectorAll('[data-c5k]').forEach(kn => {
    let rep = null, t0 = null, isPwr = false;
    const stop = () => { clearTimeout(t0); clearInterval(rep); t0 = rep = null; if (isPwr) c5PwrUp(); isPwr = false; };
    const zone = e => {
      const rc = kn.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy, rr = Math.hypot(dx, dy) / (rc.width / 2);
      return { part: rr < 0.32 ? 'push' : rr < 0.68 ? 'inner' : 'outer', d: dx < 0 ? -1 : 1 };
    };
    const act = (kind, part, d) => {
      if (kind === 'vol') { if (part === 'inner') c5Vol(0, d); else c5Vol(1, d); }
      else { if (part === 'inner') c5Value(d); else c5Cursor(d); }
    };
    kn.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const z = zone(e), kind = kn.dataset.c5k;
      if (z.part === 'push') { if (kind === 'vol') { isPwr = true; c5PwrDown(); } else c5Enter(); return; }
      act(kind, z.part, z.d);
      t0 = setTimeout(() => { rep = setInterval(() => act(kind, z.part, z.d), 140); }, 400);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => kn.addEventListener(ev, stop));
    kn.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      const z = zone(e), d = e.deltaY > 0 ? -1 : 1;
      if (z.part !== 'push') act(kn.dataset.c5k, z.part, d);
    }, { passive: false });
  });
  c5Render();
}
// 하부 콘솔이 보일 때(19-lower.js lconShow → consoleBuild 뒤) c5Build 가 불린다 — 이미 그려져 있으면 바로 꾸민다
if (document.getElementById('c5k')) c5Build();
