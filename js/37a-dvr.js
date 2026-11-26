'use strict';
// ══════════════════════════════════════════════════════
// 37a-dvr.js — 흰수리 전탐석 녹화기(DVR · FLM 5.19) — 37-mission.js 에서 나눈 조각(같은 전역 이름을 쓴다)
//   차례: 37-mission.js(EO/IR · 레이더 · 탐조등 · 표시기) → 37a-dvr.js(녹화기) → 37b-msnview.js(조작기 · 영상 · 지도 칸 · Vendor 창 · 원격)
// ══════════════════════════════════════════════════════
// ══ 녹화기(DVR · FLM 5.19) — 호이스트 카메라 · 탐색레이더 · EO/IR · 지도 화면을 SSD 에 녹화(.MUX) · 재생 · USB 로 AVI 내보내기 ══
//   POWER(빨강 표시등) · REC(전체 녹화 — 녹화 중 초록 깜박 · 멈춤 초록) · PLAYBACK(파랑 — 재생 0.5~256배 · 앞 · 뒤)
//   CH1 EO/IR · CH2 탐색레이더 · CH3 호이스트 카메라(12V) · CH4 DMM 지도 — 표시기 채널(DISP_CH)과 같은 번호 · 채널 단추로 그 채널 녹화를 켜고 끈다
//     채널 표시등: 녹화 중 초록 깜박 · 멈춤 초록 · 연결 안 됨(기체 전원 꺼짐 · 센서 꺼짐) 꺼짐
//   ▲▼◀▶ · ENTER — 메뉴 · 날짜/시간 검색 / 재생 중: ◀▶ 10초 앞뒤 · ▲▼ 속도 · ENTER 멈춤/재생 · ↩ 뒤로(메뉴 닫기 · 재생 끝)
//   ◀◀/◀ · ❙❙▶ · ▶/▶▶ — 뒤로 빨리(누를 때마다 2 · 4 · … 256배) · 재생/멈춤 · 앞으로 빨리
//   (시뮬레이터 — 채널마다 2초에 한 장(320×240 JPEG)을 메모리에 담는다. 가장 오래된 것부터 지워 1시간 분량까지 둔다. 실기 SSD 는 5시간 넘게)
const DVR_CH = { 1: 'EO/IR', 2: 'RADAR', 3: 'HOIST CAM', 4: 'DMM MAP' };
const DVR_CELL = { 1: 'eo', 2: 'rdr', 3: 'hoist', 4: 'map' };       // 표시기 칸(DISP_CH 와 같은 번호)
const DVR_W = 320, DVR_H = 240, DVR_DT = 2000, DVR_KEEP = 1800, DVR_BOOT_S = 3, DVR_SSD_H = 5.5;
const DVR_SPEEDS = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
const DVR_MENU = ['SEARCH — 날짜 · 시간', 'PLAYBACK VIEW', 'EXPORT → USB (AVI)', 'SSD INFO', 'SSD FORMAT'];
const DVR_VIEWS = ['QUAD', 'CH1', 'CH2', 'CH3', 'CH4'];
const dvr = { pwr: false, boot: 0, rec: false, play: false, ch: { 1: true, 2: true, 3: true, 4: true },
  fr: [], seg: [], capT: 0, pb: { t: 0, si: 1, dir: 1, pause: false }, menu: null, menuI: 0, view: 0,
  srch: { t: 0, f: 3 }, fmtArm: false, exp: null, info: '' };
// 채널이 연결(신호가 들어오는가) — CH3 호이스트 카메라는 기체 전원(DC)이 있으면 들어온다
//   (종전에는 상부 콘솔 HOIST ENABLE 까지 켜야 했다 — 표시기 CH3 칸에는 영상이 보이는데 녹화기만 '신호 없음'이라 헷갈렸다)
function dvrConn(n) {
  if (n === 1) return eo.pwr;
  if (n === 2) return rdr.pwr;
  if (n === 3) { try { return typeof pwrDc !== 'function' || !!pwrDc(); } catch (e) { return false; } }
  return true;
}
function dvrRecCh(n) { return dvr.pwr && dvr.boot <= 0 && dvr.rec && dvr.ch[n] && dvrConn(n); }
const _dvrT = t => { const d = new Date(t), p = v => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const _dvrHm = s => `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m`;
function dvrSpeed() { return DVR_SPEEDS[dvr.pb.si]; }
// 채널 한 장 그리기(320×240)
let _dvrCv = null;
function _dvrGrab(n) {
  if (!_dvrCv) { _dvrCv = document.createElement('canvas'); _dvrCv.width = DVR_W; _dvrCv.height = DVR_H; }
  const g = _dvrCv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.fillStyle = '#000'; g.fillRect(0, 0, DVR_W, DVR_H);
  try {
    if (n === 1) eoirVideoDrawTo(g, 0, 0, DVR_W, DVR_H);
    else if (n === 2) { g.save(); _rdrPaint(g, DVR_W, DVR_H); g.restore(); }
    else if (n === 3) { if (typeof sarHoistCamDrawTo === 'function') sarHoistCamDrawTo(g, 0, 0, DVR_W, DVR_H); }
    else if (n === 4) {
      const cell = _msnEl && _msnEl.querySelector('.c-map');
      const mc = _nvMap && _cellVis(cell) ? _nvMap.getCanvas() : null, ov = cell && cell.querySelector('.nv-ov');
      if (mc && mc.width) { g.drawImage(mc, 0, 0, DVR_W, DVR_H); if (ov && ov.width) g.drawImage(ov, 0, 0, DVR_W, DVR_H); }
      else { g.fillStyle = '#5a6a75'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('DMM MAP — NO VIDEO', DVR_W / 2, DVR_H / 2); }
    }
  } catch (e) { _swallow(e); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
  g.font = 'bold 10px Arial'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
  const s = `CH${n} ${DVR_CH[n]}  ${_dvrT(Date.now())}`; g.strokeText(s, 4, DVR_H - 5); g.fillText(s, 4, DVR_H - 5);
  try { return _dvrCv.toDataURL('image/jpeg', 0.6); } catch (e) { return null; }
}
function dvrCapture(now) {
  const c = {}; let any = false;
  for (const n of [1, 2, 3, 4]) if (dvrRecCh(n)) { const u = _dvrGrab(n); if (u) { c[n] = u; any = true; } }
  if (!any) return;
  dvr.fr.push({ t: now, c });
  const sg = dvr.seg[dvr.seg.length - 1];
  if (sg && now - sg.t1 <= DVR_DT * 3) sg.t1 = now; else dvr.seg.push({ t0: now, t1: now });
  while (dvr.fr.length > DVR_KEEP) { dvr.fr.shift(); const s0 = dvr.seg[0]; if (s0 && dvr.fr[0]) { if (s0.t1 < dvr.fr[0].t) dvr.seg.shift(); else s0.t0 = Math.max(s0.t0, dvr.fr[0].t); } }
}
// 재생 자리 pb.t 에 맞는 장(그 시각 이전의 마지막 장)
function dvrFrameAt(t) {
  const F = dvr.fr; if (!F.length) return -1;
  let lo = 0, hi = F.length - 1; if (t < F[0].t) return 0;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (F[m].t <= t) lo = m; else hi = m - 1; }
  return lo;
}
function dvrSeek(t) {
  const F = dvr.fr; if (!F.length) return;
  t = _mClamp(t, F[0].t, F[F.length - 1].t);
  // 녹화가 끊긴 틈에 들면 가는 쪽의 다음 녹화로 건너뛴다
  const i = dvrFrameAt(t);
  if (t - F[i].t > DVR_DT * 3) t = dvr.pb.dir > 0 && F[i + 1] ? F[i + 1].t : F[i].t;
  dvr.pb.t = t;
}
function dvrPlay(on, t) {
  if (on && !dvr.fr.length) { _mToast('녹화기 — 녹화된 영상이 없습니다'); dvr.play = false; return; }
  dvr.play = !!on;
  if (dvr.play) { dvr.pb.pause = false; dvr.pb.si = 1; dvr.pb.dir = 1; dvrSeek(t != null ? t : (dvr.seg.length ? dvr.seg[dvr.seg.length - 1].t0 : dvr.fr[0].t)); _mNote('녹화기 PLAYBACK'); }
  dvrView();
}
// 재생 화면 차림 — QUAD(4분할) · 한 채널 전체
function dvrView() {
  if (!dvr.play) return;
  const v = DVR_VIEWS[dvr.view];
  if (v === 'QUAD') dispSet({ lay: 'quad' });
  else { const cell = DVR_CELL[+v[2]], ch = +Object.keys(DISP_CH).find(k => DISP_CH[k] === cell); dispSet({ lay: 'one', ch }); }
}
function dvrStep(dt) {
  if (!dvr.pwr) return;
  if (!msnDmmPwr()) { dvr.pwr = false; dvr.rec = false; dvr.play = false; dvr.menu = null; dvr.boot = 0; _mNote('DMM 전원 꺼짐 — 녹화기 · 표시기 꺼짐'); try { dvrRender(); } catch (e) { _swallow(e); } return; }
  if (dvr.boot > 0) { dvr.boot -= dt; return; }
  const now = Date.now();
  if (dvr.rec && now - dvr.capT >= DVR_DT) { dvr.capT = now; try { dvrCapture(now); } catch (e) { _swallow(e); } }
  if (dvr.play && !dvr.pb.pause && dvr.fr.length) {
    const F = dvr.fr, t = dvr.pb.t + dt * 1000 * dvrSpeed() * dvr.pb.dir;
    if (t >= F[F.length - 1].t && dvr.pb.dir > 0) { dvr.pb.t = F[F.length - 1].t; dvr.pb.pause = true; }
    else if (t <= F[0].t && dvr.pb.dir < 0) { dvr.pb.t = F[0].t; dvr.pb.pause = true; }
    else dvrSeek(t);
  }
}
function _dvrSpeedStep(dir) {
  const pb = dvr.pb;
  if (pb.pause) { pb.pause = false; pb.dir = dir; pb.si = dir > 0 ? 1 : 2; return; }
  if (pb.dir !== dir) { pb.dir = dir; pb.si = dir > 0 ? 1 : 2; return; }
  pb.si = Math.min(DVR_SPEEDS.length - 1, pb.si + 1);
}
function dvrPress(k) {
  if (k === 'power') {
    if (!dvr.pwr && !msnDmmPwr()) { _mToast('DMM 전원이 없습니다 — 하부 콘솔 MPP 패널 DMM ON'); return; }
    dvr.pwr = !dvr.pwr;
    if (dvr.pwr) dvr.boot = DVR_BOOT_S; else { dvr.rec = false; dvr.play = false; dvr.menu = null; dvr.boot = 0; }
    _mNote(`녹화기 POWER ${dvr.pwr ? 'ON' : 'OFF'}`); dvrRender(); return;
  }
  if (!dvr.pwr) { _mToast('녹화기 POWER 가 꺼져 있습니다'); return; }
  if (dvr.boot > 0) { _mToast(`녹화기 시동 중 — ${Math.ceil(dvr.boot)}초`); return; }
  const pb = dvr.pb;
  if (k === 'rec') { dvr.rec = !dvr.rec; dvr.capT = 0; _mNote(`녹화기 REC ${dvr.rec ? '시작' : '멈춤'}`); }
  else if (k === 'playback') dvrPlay(!dvr.play);
  else if (/^ch[1-4]$/.test(k)) { const n = +k[2]; if (!dvrConn(n)) _mToast(`CH${n} ${DVR_CH[n]} — 신호 없음(연결 안 됨)`); dvr.ch[n] = !dvr.ch[n]; }
  else if (k === 'menu') { dvr.menu = dvr.menu ? null : 'MAIN'; dvr.menuI = 0; dvr.fmtArm = false; }
  else if (k === 'back') { if (dvr.menu === 'MAIN') dvr.menu = null; else if (dvr.menu) { dvr.menu = 'MAIN'; dvr.fmtArm = false; } else if (dvr.play) dvrPlay(false); }
  else if (dvr.menu) _dvrMenuKey(k);
  else if (k === 'play') { if (!dvr.play) dvrPlay(true); else if (pb.si !== 1 || pb.dir < 0) { pb.si = 1; pb.dir = 1; pb.pause = false; } else pb.pause = !pb.pause; }
  else if (!dvr.play) { if (['rew', 'ff', 'left', 'right', 'up', 'down', 'enter'].includes(k)) _mToast('녹화기 — PLAYBACK 이나 MENU 에서 씁니다'); }
  else if (k === 'ff') _dvrSpeedStep(1);
  else if (k === 'rew') _dvrSpeedStep(-1);
  else if (k === 'left' || k === 'right') dvrSeek(pb.t + (k === 'right' ? 10000 : -10000));
  else if (k === 'up') { pb.si = Math.min(DVR_SPEEDS.length - 1, pb.si + 1); pb.pause = false; }
  else if (k === 'down') { pb.si = Math.max(0, pb.si - 1); pb.pause = false; }
  else if (k === 'enter') pb.pause = !pb.pause;
  dvrRender();
}
function _dvrMenuKey(k) {
  if (dvr.menu === 'MAIN') {
    if (k === 'up' || k === 'down') { dvr.menuI = (dvr.menuI + (k === 'down' ? 1 : -1) + DVR_MENU.length) % DVR_MENU.length; dvr.fmtArm = false; }
    else if (k === 'enter' || k === 'right') {
      const i = dvr.menuI;
      if (i === 0) { dvr.menu = 'SEARCH'; dvr.srch.t = dvr.fr.length ? (dvr.play ? dvr.pb.t : dvr.seg[dvr.seg.length - 1].t0) : Date.now(); dvr.srch.f = 3; }
      else if (i === 1) { dvr.view = (dvr.view + 1) % DVR_VIEWS.length; dvrView(); }
      else if (i === 2) dvrExport();
      else if (i === 3) dvr.menu = 'INFO';
      else if (i === 4) { if (!dvr.fmtArm) { dvr.fmtArm = true; _mToast('SSD FORMAT — ENTER 를 한 번 더 누르면 모든 녹화를 지웁니다'); } else { dvr.fr = []; dvr.seg = []; dvr.play = false; dvr.fmtArm = false; _mNote('녹화기 SSD FORMAT'); } }
    }
    return;
  }
  if (dvr.menu === 'SEARCH') {
    // 칸: 0 년 · 1 월 · 2 일 · 3 시 · 4 분 · 5 초 — ◀▶ 칸 · ▲▼ 값 · ENTER 그 시각부터 재생
    const s = dvr.srch;
    if (k === 'left') s.f = Math.max(0, s.f - 1);
    else if (k === 'right') s.f = Math.min(5, s.f + 1);
    else if (k === 'up' || k === 'down') {
      const d = new Date(s.t), v = k === 'up' ? 1 : -1;
      [() => d.setFullYear(d.getFullYear() + v), () => d.setMonth(d.getMonth() + v), () => d.setDate(d.getDate() + v),
       () => d.setHours(d.getHours() + v), () => d.setMinutes(d.getMinutes() + v), () => d.setSeconds(d.getSeconds() + v)][s.f]();
      s.t = d.getTime();
    } else if (k === 'enter') {
      if (!dvr.fr.length) { _mToast('녹화기 — 녹화된 영상이 없습니다'); return; }
      const F = dvr.fr; let t = s.t;
      if (t < F[0].t || t > F[F.length - 1].t) { _mToast('그 시각에는 녹화가 없습니다 — 가장 가까운 녹화부터'); }
      dvr.menu = null; dvrPlay(true, t);
    }
    return;
  }
  if (dvr.menu === 'INFO' && (k === 'enter' || k === 'left')) dvr.menu = 'MAIN';
}
// SSD 사용량 — 실기 용량(5.5시간)에 견준다
function dvrSsd() {
  let sec = 0; for (const s of dvr.seg) sec += (s.t1 - s.t0 + DVR_DT) / 1000;
  return { sec, pct: Math.min(100, sec / (DVR_SSD_H * 3600) * 100), left: Math.max(0, DVR_SSD_H * 3600 - sec), clips: dvr.seg.length };
}
// ── USB 내보내기 — 지금 재생 중인 녹화(없으면 마지막 녹화)를 채널마다 MJPEG AVI 로 묶어 ZIP 으로 내려받는다 ──
function _dvrB64(u) { const b = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function dvrAvi(jpegs, frameMs, w, h) {
  const n = jpegs.length, pad = x => x + (x & 1);
  let movi = 4; for (const j of jpegs) movi += 8 + pad(j.length);
  const hdrl = 4 + (8 + 56) + (8 + 4 + (8 + 56) + (8 + 40)), idx = 16 * n;
  const total = 12 + (8 + hdrl) + (8 + movi) + (8 + idx), buf = new ArrayBuffer(total), v = new DataView(buf), u8 = new Uint8Array(buf);
  let p = 0; const S4 = s => { for (let i = 0; i < 4; i++) v.setUint8(p++, s.charCodeAt(i)); }, U32 = x => { v.setUint32(p, x, true); p += 4; }, U16 = x => { v.setUint16(p, x, true); p += 2; };
  const maxJ = jpegs.reduce((m, j) => Math.max(m, j.length), 0);
  S4('RIFF'); U32(total - 8); S4('AVI ');
  S4('LIST'); U32(hdrl); S4('hdrl');
  S4('avih'); U32(56); U32(Math.round(frameMs * 1000)); U32(Math.ceil(maxJ * 1000 / frameMs)); U32(0); U32(0x10); U32(n); U32(0); U32(1); U32(maxJ); U32(w); U32(h); U32(0); U32(0); U32(0); U32(0);
  S4('LIST'); U32(4 + 64 + 48); S4('strl');
  S4('strh'); U32(56); S4('vids'); S4('MJPG'); U32(0); U16(0); U16(0); U32(0); U32(frameMs); U32(1000); U32(0); U32(n); U32(maxJ); U32(0xFFFFFFFF); U32(0); U16(0); U16(0); U16(w); U16(h);
  S4('strf'); U32(40); U32(40); U32(w); U32(h); U16(1); U16(24); S4('MJPG'); U32(w * h * 3); U32(0); U32(0); U32(0); U32(0);
  S4('LIST'); U32(movi); const m0 = p; S4('movi');
  const offs = [];
  for (const j of jpegs) { offs.push(p - m0); S4('00dc'); U32(j.length); u8.set(j, p); p += pad(j.length); }
  S4('idx1'); U32(idx);
  jpegs.forEach((j, i) => { S4('00dc'); U32(0x10); U32(offs[i]); U32(j.length); });
  return buf;
}
async function dvrExport() {
  if (!dvr.fr.length) { _mToast('녹화기 — 내보낼 녹화가 없습니다'); return null; }
  const t = dvr.play ? dvr.pb.t : dvr.seg[dvr.seg.length - 1].t0;
  const sg = dvr.seg.find(s => t >= s.t0 - 1 && t <= s.t1 + 1) || dvr.seg[dvr.seg.length - 1];
  const fr = dvr.fr.filter(f => f.t >= sg.t0 && f.t <= sg.t1), stamp = _dvrT(sg.t0).replace(/[-: ]/g, '').replace(/^(\d{8})/, '$1_');
  const files = {};
  for (const n of [1, 2, 3, 4]) {
    const js = fr.filter(f => f.c[n]).map(f => _dvrB64(f.c[n]));
    if (js.length) files[`DVR_${stamp}_CH${n}_${DVR_CH[n].replace(/[^A-Z]/g, '')}.avi`] = dvrAvi(js, DVR_DT, DVR_W, DVR_H);
  }
  dvr.exp = { name: `DVR_${stamp}.zip`, n: Object.keys(files).length, frames: fr.length };
  _mNote(`녹화기 USB 내보내기 ${dvr.exp.name}`);
  try {
    if (typeof JSZip === 'undefined') throw new Error('zip');
    const z = new JSZip(); for (const [f, b] of Object.entries(files)) z.file(f, b);
    const blob = await z.generateAsync({ type: 'blob' });
    dvr.exp.size = blob.size;
    if (!window.__dvrNoDl) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = dvr.exp.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
    _mToast(`USB — ${dvr.exp.name} (AVI ${dvr.exp.n}개 · ${fr.length}장)`);
  } catch (e) { _swallow(e); _mToast('USB 내보내기 실패'); }
  dvrRender();
  return files;
}
// ── 표시 — 표시등 · 재생 화면(칸마다 그 채널) · 메뉴 OSD ──
const _dvrImg = new Map();
function _dvrImgOf(u) {
  let im = _dvrImg.get(u);
  if (!im) { im = new Image(); im.src = u; _dvrImg.set(u, im); if (_dvrImg.size > 40) _dvrImg.delete(_dvrImg.keys().next().value); }
  return im;
}
function dvrRender() {
  if (!_msnEl) return;
  const blink = Math.floor(performance.now() / 500) % 2 === 0, on = dvr.pwr && dvr.boot <= 0;
  const L = (n, c) => { const e = _msnEl.querySelector(`[data-dvl="${n}"]`); if (e) e.className = 'dvr-led' + (c ? ' ' + c : ''); };
  L('pwr', dvr.pwr ? 'red' : ''); L('rec', on ? (dvr.rec ? (blink ? 'on' : '') : 'on') : ''); L('play', on && dvr.play ? 'blue' : '');
  [1, 2, 3, 4].forEach(n => L('ch' + n, on && dvrConn(n) && dvr.ch[n] ? (dvr.rec ? (blink ? 'on' : '') : 'on') : ''));
  const sl = _msnEl.querySelector('[data-m="dvrst"]');
  if (sl) { const s = dvrSsd(); sl.textContent = !dvr.pwr ? '' : dvr.boot > 0 ? 'BOOT…' : `${dvr.rec ? '●REC ' : ''}${dvr.play ? (dvr.pb.pause ? '❙❙ ' : (dvr.pb.dir < 0 ? '◀' : '▶') + dvrSpeed() + 'x ') : ''}SSD ${s.pct.toFixed(1)}%`; }
  _dvrOsd();
}
function _dvrOsd() {
  const scr = _msnEl.querySelector('.msn-scr'); if (!scr) return;
  let o = scr.querySelector('.dvr-osd');
  if (!o) { o = document.createElement('div'); o.className = 'dvr-osd'; scr.appendChild(o); }
  const show = dvr.pwr && dvr.boot <= 0 && dvr.menu;
  o.style.display = show ? '' : 'none';
  if (!show) return;
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  let h = '';
  if (dvr.menu === 'MAIN') h = `<h4>DVR MENU</h4>` + DVR_MENU.map((m, i) => `<p class="${i === dvr.menuI ? 'sel' : ''}">${esc(m)}${i === 1 ? ` : <b>${DVR_VIEWS[dvr.view]}</b>` : ''}${i === 4 && dvr.fmtArm ? ' — ENTER 다시' : ''}</p>`).join('') + `<small>▲▼ 고르기 · ENTER · ↩ 닫기</small>`;
  else if (dvr.menu === 'SEARCH') {
    const d = new Date(dvr.srch.t), p = v => String(v).padStart(2, '0');
    const fld = [d.getFullYear(), p(d.getMonth() + 1), p(d.getDate()), p(d.getHours()), p(d.getMinutes()), p(d.getSeconds())].map((v, i) => `<span class="${i === dvr.srch.f ? 'sel' : ''}">${v}</span>`);
    // 달력 — 녹화가 있는 날은 초록
    const y = d.getFullYear(), mo = d.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    const has = new Set(dvr.seg.filter(s => { const a = new Date(s.t0); return a.getFullYear() === y && a.getMonth() === mo; }).map(s => new Date(s.t0).getDate()));
    let cal = '<div class="dvr-cal">' + '일월화수목금토'.split('').map(x => `<i>${x}</i>`).join('') + '<i></i>'.repeat(first);
    for (let i = 1; i <= days; i++) cal += `<i class="${has.has(i) ? 'rec' : ''}${i === d.getDate() ? ' cur' : ''}">${i}</i>`;
    cal += '</div>';
    const list = dvr.seg.slice(-5).reverse().map(s => `<p>● ${_dvrT(s.t0)} ~ ${_dvrT(s.t1).slice(11)}</p>`).join('') || '<p>녹화 없음</p>';
    h = `<h4>SEARCH — 날짜 · 시간</h4><div class="dvr-dt">${fld[0]}-${fld[1]}-${fld[2]} ${fld[3]}:${fld[4]}:${fld[5]}</div>${cal}${list}<small>◀▶ 칸 · ▲▼ 값 · ENTER 재생 · ↩ 뒤로</small>`;
  } else if (dvr.menu === 'INFO') {
    const s = dvrSsd();
    h = `<h4>SSD INFO</h4><p>사용 ${_dvrHm(s.sec)} / ${DVR_SSD_H}h (${s.pct.toFixed(1)}%)</p><p>남은 녹화 ${_dvrHm(s.left)}</p><p>녹화 ${s.clips}개 · ${dvr.fr.length}장 (.MUX)</p>` +
      [1, 2, 3, 4].map(n => `<p>CH${n} ${DVR_CH[n]} — ${dvrConn(n) ? (dvr.ch[n] ? 'REC ON' : 'REC OFF') : 'NO SIGNAL'}</p>`).join('') +
      (dvr.exp ? `<p>USB: ${esc(dvr.exp.name)}</p>` : '') + `<small>↩ 뒤로</small>`;
  }
  if (o._h !== h) { o.innerHTML = h; o._h = h; }
}
// 재생 — 보이는 칸마다 그 채널의 녹화 장을 덮어 그린다
function dvrPlayDraw() {
  if (!_msnEl) return;
  const on = dvr.pwr && dvr.boot <= 0 && dvr.play && dvr.fr.length;
  const i = on ? dvrFrameAt(dvr.pb.t) : -1, f = i >= 0 ? dvr.fr[i] : null;
  for (const n of [1, 2, 3, 4]) {
    const cell = _msnEl.querySelector('.c-' + DVR_CELL[n]); if (!cell) continue;
    let cv = cell.querySelector('canvas.dvr-pb');
    if (!on) { if (cv) cv.style.display = 'none'; continue; }
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'dvr-pb'; cell.appendChild(cv); }
    cv.style.display = '';
    if (!_cellVis(cell)) continue;
    const d = _msnFit(cv), g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, d.W, d.H);
    const u = f && f.c[n];
    if (u) { const im = _dvrImgOf(u); if (im.complete && im.naturalWidth) { const s = Math.min(d.W / DVR_W, d.H / DVR_H); g.drawImage(im, (d.W - DVR_W * s) / 2, (d.H - DVR_H * s) / 2, DVR_W * s, DVR_H * s); } }
    else { g.fillStyle = '#667'; g.font = `bold ${Math.round(d.H / 14)}px Arial`; g.textAlign = 'center'; g.fillText(`CH${n} — NO RECORD`, d.W / 2, d.H / 2); }
    const k = Math.max(1, d.H / 300); g.font = `bold ${Math.round(12 * k)}px Arial`; g.textAlign = 'left';
    const pb = dvr.pb, st = pb.pause ? '❙❙ PAUSE' : `${pb.dir < 0 ? '◀◀' : '▶'} ${dvrSpeed()}x`;
    g.fillStyle = '#4aa8ff'; g.fillText(`PLAYBACK  ${st}`, 8 * k, 16 * k);
    g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(_dvrT(pb.t), d.W - 8 * k, 16 * k);
    // 시간 막대 — 처음 ~ 끝 · 녹화 구간 · 지금 자리
    const F = dvr.fr, a = F[0].t, b = Math.max(a + 1, F[F.length - 1].t), x0 = 8 * k, x1 = d.W - 8 * k, y = d.H - 10 * k, X = t => x0 + (x1 - x0) * (t - a) / (b - a);
    g.fillStyle = '#333'; g.fillRect(x0, y, x1 - x0, 4 * k); g.fillStyle = '#2f8f4f'; for (const s of dvr.seg) g.fillRect(X(s.t0), y, Math.max(2, X(s.t1) - X(s.t0)), 4 * k);
    g.fillStyle = '#4aa8ff'; g.fillRect(X(pb.t) - 2 * k, y - 4 * k, 4 * k, 12 * k);
  }
}
