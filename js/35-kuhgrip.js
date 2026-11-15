'use strict';
// ══════════════════════════════════════════════════════
// 35-kuhgrip.js — 흰수리(KUH-1CG) 컬렉티브 머리 · 사이클릭 그립 — Cockpit Mode(15-heli3d.js #sim-ckpit)
//   컬렉티브: CDU 오른쪽에 Bell 컬렉티브와 같은 크기로 작게 → 누르면 크게 띄워 조작한다.
//     HOOK EMER REL · CURSOR(표시만) · OEI(한 엔진일 때 누를 때마다 HI 2.5분 ↔ LOW 10분 정격) · LDG LT(EXT · ON/OFF · RET) ·
//     SRCH CTR(4방향 — 서치라이트 방향) · COLL TRIM(DN · UP — 누르는 동안 VS ±100fpm 씩) · SRCH LT(누르면 ON/OFF · 위아래로 광도)
//   사이클릭: 좌 · 우 사이클릭 자리에 실기 모양으로(두 좌석 같은 방향) 그리고, 누르면 크게 띄워 조작한다.
//     DISENGAG(AP 상위모드 해제) · 빨간 단추(AP FAST CUT OFF — AP1 · AP2 끊음) · 4-WAY BEEP(4방향 트림 · 실기처럼 왼쪽 30° 틀어짐) ·
//     손잡이 앞 위부터 PTT(실기는 뒤편) · FORCE TRIM RELEASE(누르는 동안) · G/SPEED · DMS · BEEP CTL · 검은 단추(표시만)
//   빛: 착륙등은 ENV 의 착륙등(env.ldg)과 같은 것 — 펼친 만큼(EXT) 아래로 비춘다. 서치라이트는 SRCH CTR 로 돌린 쪽을 비춘다(29-env.js envBeams).
// ══════════════════════════════════════════════════════
const KG_SRCH = { azMax: 120, elMin: 5, elMax: 80, azRate: 45, elRate: 25 };
const kgLt = { ext: 0, srch: false, az: 0, el: 30, br: 1 };     // 착륙등 펼침(0 접힘 ~ 1 다 펼침) · 서치라이트 켬 · 방향(기수 기준 ° · 아래로 °) · 광도(0.2~1)
function kgOn() { return !(typeof acB206 === 'function' && acB206()); }
function _kgToast(t, k) { try { uiToast(t, k || '', 2200); } catch (e) { _swallow(e); } }
function _kgLdg() { return typeof env !== 'undefined' && !!env.ldg; }
function kgLdgSet(on) { try { if (typeof envSet === 'function') envSet({ ldg: !!on }); else env.ldg = !!on; } catch (e) { _swallow(e); } kgRender(); }
function kgSrchSet(on) {
  kgLt.srch = !!on;
  try { if (typeof fdrNote === 'function') fdrNote(`서치라이트 ${kgLt.srch ? 'ON' : 'OFF'}`); } catch (e) { _swallow(e); }
  kgRender();
}
// 착륙등 · 서치라이트 빛 무리(29-env.js envBeams 가 부른다) — [{ az(°) · down(°) · k }]
function kgBeams() {
  if (!kgOn()) return [];
  const out = [];
  if (_kgLdg()) out.push({ az: 0, down: 14 + 31 * kgLt.ext, k: 1 });
  if (kgLt.srch) out.push({ az: kgLt.az, down: kgLt.el, k: 0.9 * kgLt.br });
  return out;
}

// AP FAST CUT OFF(사이클릭 빨간 단추) — AP1 · AP2 를 한 번에 끊는다(하부 콘솔 AFCAU 의 AP1 · AP2 OFF 와 같다 — 상위모드 · 자세 유지 모두 풀리고 세 축 SAS)
function kgApCut() {
  try { if (typeof afcsReleaseAll === 'function') afcsReleaseAll(); } catch (e) { _swallow(e); }
  try { if (typeof ovhdSet === 'function') { ovhdSet('ap1', 'IN'); ovhdSet('ap2', 'IN'); } } catch (e) { _swallow(e); }
  try { if (typeof afcsGuard === 'function') afcsGuard(); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function') fdrNote('AP FAST CUT OFF — AP1 · AP2 끊음', 'warn'); } catch (e) { _swallow(e); }
  _kgToast('AP CUT OFF — AP1 · AP2 끊음(다시 켜려면 하부 콘솔 AFCAU 의 AP1 · AP2)', 'warn');
}
// ── 누르는 동안 이어지는 조작(COLL TRIM · SRCH CTR · 4-WAY BEEP · FORCE TRIM · PTT · LDG EXT/RET) ──
let _kgHold = null;
function _kgHoldStop() {
  const h = _kgHold; _kgHold = null; if (!h) return;
  clearTimeout(h.t0); clearInterval(h.iv); clearTimeout(h.guard);
  try { if (h.end) h.end(); } catch (e) { _swallow(e); }
  kgRender();
}
function _kgHoldStart(k, step, end, first = 350, every = 80) {
  _kgHoldStop();
  const h = _kgHold = { k, end, step };
  try { step(); } catch (e) { _swallow(e); }
  h.t0 = setTimeout(() => { h.iv = setInterval(() => { try { step(); } catch (e) { _swallow(e); } }, every); }, first);
  h.guard = setTimeout(_kgHoldStop, 20000);                 // 놓친 손 떼기 — 20초면 멈춘다
  kgRender();
}
// 누르는 동안 움직이는 것은 흐른 시간만큼(화면이 바빠 타이머가 드문드문 와도 같은 빠르기)
function _kgDt() { const now = performance.now(), h = _kgHold; if (!h) return 0; const dt = h.tl ? Math.min(0.3, (now - h.tl) / 1000) : 0.05; h.tl = now; return dt; }
function _kgSrchMove(dir) {
  const dt = _kgDt();
  if (dir === 'L') kgLt.az = Math.max(-KG_SRCH.azMax, kgLt.az - KG_SRCH.azRate * dt);
  if (dir === 'R') kgLt.az = Math.min(KG_SRCH.azMax, kgLt.az + KG_SRCH.azRate * dt);
  if (dir === 'U') kgLt.el = Math.max(KG_SRCH.elMin, kgLt.el - KG_SRCH.elRate * dt);
  if (dir === 'D') kgLt.el = Math.min(KG_SRCH.elMax, kgLt.el + KG_SRCH.elRate * dt);
}
// 조작 하나 — 누름(down) · 놓음은 _kgHoldStop
function kgPress(k) {
  switch (k) {
    // 컬렉티브
    case 'collDn': return _kgHoldStart(k, () => applyDelta('vs', -100));
    case 'collUp': return _kgHoldStart(k, () => applyDelta('vs', 100));
    case 'ldgExt': return _kgHoldStart(k, () => { if (!_kgLdg()) kgLdgSet(true); kgLt.ext = Math.min(1, kgLt.ext + _kgDt() / 1.5); }, 0, 50);   // 1.5초에 다 펼친다
    case 'ldgRet': return _kgHoldStart(k, () => { kgLt.ext = Math.max(0, kgLt.ext - _kgDt() / 1.5); }, 0, 50);
    case 'ldgOn': return kgLdgSet(!_kgLdg());
    case 'srchLt': return kgSrchSet(!kgLt.srch);                                   // 누르면(PUSH) ON · OFF
    case 'srchBrt': case 'srchDim': { const s = k === 'srchBrt' ? 0.1 : -0.1;        // 위아래로 밀면 광도
      return _kgHoldStart(k, () => { kgLt.br = Math.round(Math.max(0.2, Math.min(1, kgLt.br + s)) * 10) / 10; }, 350, 150); }
    case 'oei': {                                                                   // 한 엔진 상황 — 누를 때마다 OEI HI(2.5분) ↔ LOW(10분)
      if (typeof simOeiToggle !== 'function') return _kgToast('OEI 출력 전환은 SIM 모드에서 씁니다');
      simOeiToggle(); return kgRender(); }
    case 'apCut': try { kgApCut(); } catch (e) { _swallow(e); } return kgRender();
    case 'srchL': case 'srchR': case 'srchU': case 'srchD': { const d = k.slice(-1); return _kgHoldStart(k, () => _kgSrchMove(d), 0, 50); }
    // 사이클릭
    case 'apDis': try { afcsReleaseAll(); _kgToast('AP DISENGAGE — 상위 모드 모두 해제'); } catch (e) { _swallow(e); } return kgRender();
    // FORCE TRIM RELEASE — 누르는 동안 트림을 풀고, 놓으면 그 자세가 새 트림
    case 'ftr': return _kgHoldStart(k, () => { if (!_kgHold || !_kgHold.on) { forceTrim(); if (_kgHold) _kgHold.on = true; } }, () => forceTrimRelease(), 1e9);
    case 'beepL': case 'beepR': case 'beepF': case 'beepA': { const d = k.slice(-1); return _kgHoldStart(k, () => { if (!_kgHold || !_kgHold.on) { startTrimHold(d); if (_kgHold) _kgHold.on = true; } }, () => stopTrimHold(), 1e9); }
    case 'ptt': return _kgHoldStart(k, () => { if (!_kgHold || !_kgHold.on) { if (typeof radioPtt === 'function') radioPtt(true); if (_kgHold) _kgHold.on = true; } }, () => { if (typeof radioPtt === 'function') radioPtt(false); }, 1e9);
    case 'gspd': try { toggleGspd(); } catch (e) { _swallow(e); } return kgRender();
    default: {
      const nm = { hook: 'HOOK EMER REL', cursor: 'CURSOR', cross: '조절 노브', dms: 'DMS', beepCtl: 'BEEP CTL', blk: '검은 단추' }[k] || k;
      return _kgToast(`${nm} — 이 시뮬레이터에서는 아직 연결되지 않은 단추입니다`);
    }
  }
}

// ── 그림 ──
const _kgLab = (x, y, t, s = 7, a = 'middle', c = '#e9ecef', rot = 0) =>
  `<text x="${x}" y="${y}" font-size="${s}" fill="${c}" text-anchor="${a}" font-family="Arial" font-weight="bold"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`;
const _kgOnK = k => _kgHold && _kgHold.k === k;
function _kgScrew(x, y) { return `<circle cx="${x}" cy="${y}" r="3.2" fill="#9aa0a6" stroke="#444"/><line x1="${x - 2}" y1="${y}" x2="${x + 2}" y2="${y}" stroke="#444"/>`; }
function _kgRibbed(x, y, r, id) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#kg-knob${id})" stroke="#000" stroke-width="1.2"/>` + [0.75, 0.5, 0.25].map(f => `<circle cx="${x}" cy="${y}" r="${r * f}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1"/>`).join(''); }
const _kgDefs = id => `<defs>
    <linearGradient id="kg-plate${id}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#3d4247"/><stop offset="1" stop-color="#16181b"/></linearGradient>
    <linearGradient id="kg-tube${id}" x1="0" x2="1"><stop offset="0" stop-color="#0c0d0e"/><stop offset="0.4" stop-color="#4b5056"/><stop offset="0.6" stop-color="#2a2d30"/><stop offset="1" stop-color="#08090a"/></linearGradient>
    <radialGradient id="kg-knob${id}" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#5a5e63"/><stop offset="1" stop-color="#0b0c0d"/></radialGradient>
    <radialGradient id="kg-red${id}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ff6a5a"/><stop offset="1" stop-color="#8a0d0d"/></radialGradient>
    <radialGradient id="kg-white${id}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9bec3"/></radialGradient>
  </defs>`;
// 컬렉티브 머리(첫 사진) — 175×380
function kgCollSvg(id = '') {
  const ldg = _kgLdg(), ext = kgLt.ext, srch = kgLt.srch, oeiOn = typeof simEng !== 'undefined' && simEng === 1 && typeof simOeiMode !== 'undefined';
  const hot = k => _kgOnK(k) ? '#5d636a' : '#222528';
  const arrow = (k, pts) => `<polygon data-kg="${k}" points="${pts}" fill="${_kgOnK(k) ? '#7dff3a' : '#e9ecef'}" style="cursor:pointer"/>`;
  return `<svg viewBox="0 0 175 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible">${_kgDefs(id)}
  <!-- 목(관) -->
  <path d="M52 160 H123 C122 200 112 215 108 236 L108 380 H68 L68 236 C64 215 53 200 52 160 Z" fill="url(#kg-tube${id})" stroke="#000"/>
  <ellipse cx="88" cy="300" rx="21" ry="4" fill="#0a0b0c" opacity="0.7"/>${_kgScrew(88, 300)}
  <!-- 스위치 판 -->
  <path d="M22 8 H153 Q168 8 168 24 L164 150 Q162 166 146 166 H29 Q13 166 11 150 L7 24 Q7 8 22 8 Z" fill="url(#kg-plate${id})" stroke="#000" stroke-width="2"/>
  <path d="M22 11 H153 Q165 11 165 24 L161 149 Q159 163 146 163 H29 Q16 163 14 149 L10 24 Q10 11 22 11 Z" fill="none" stroke="#5a6067" stroke-width="1"/>
  ${[[18, 154], [157, 154], [64, 58], [118, 58]].map(([x, y]) => _kgScrew(x, y)).join('')}
  <!-- 윗줄: HOOK EMER REL · 조절 노브 · CURSOR · OEI CONT -->
  <rect x="13" y="15" width="28" height="15" rx="2" fill="#f2c200" opacity="0.92"/>${_kgLab(27, 21, 'HOOK', 6, 'middle', '#111')}${_kgLab(27, 28, 'EMER REL', 5, 'middle', '#111')}
  <g data-kg="hook" style="cursor:pointer"><circle cx="27" cy="44" r="10" fill="#111" stroke="#000"/><circle cx="27" cy="44" r="7.5" fill="url(#kg-red${id})"/></g>
  <g data-kg="cross" style="cursor:pointer"><circle cx="55" cy="38" r="11" fill="url(#kg-knob${id})" stroke="#000"/><rect x="51" y="29" width="8" height="18" rx="2" fill="#0e0f10"/><rect x="46" y="34" width="18" height="8" rx="2" fill="#0e0f10"/></g>
  ${_kgLab(98, 19, 'CURSOR', 7)}<g data-kg="cursor" style="cursor:pointer">${_kgRibbed(98, 42, 17, id)}</g>
  ${_kgLab(148, 19, 'OEI', 7)}${_kgLab(148, 27, 'CONT', 7)}<g data-kg="oei" style="cursor:pointer"><circle cx="148" cy="44" r="10" fill="#111" stroke="${oeiOn ? '#ffd23a' : '#000'}" stroke-width="${oeiOn ? 2.5 : 1}"/><circle cx="148" cy="44" r="7.5" fill="url(#kg-red${id})"/></g>
  ${oeiOn ? _kgLab(148, 64, 'OEI ' + simOeiMode, 6.5, 'middle', '#ffd23a') : ''}
  <!-- LDG LT(EXT · ON/OFF · RET) -->
  ${_kgLab(27, 76, 'LDG LT', 7)}${_kgLab(27, 84, 'EXT', 6.5)}${_kgLab(27, 150, 'RET', 6.5)}
  <rect x="15" y="88" width="24" height="54" rx="3" fill="#0b0c0d" stroke="#666"/>
  <rect data-kg="ldgExt" x="17" y="90" width="20" height="16" rx="2" fill="${hot('ldgExt')}" style="cursor:pointer"/>
  <rect data-kg="ldgOn" x="17" y="107" width="20" height="16" rx="2" fill="${ldg ? '#3a5a2a' : '#222528'}" style="cursor:pointer"/>
  ${_kgLab(27, 118, ldg ? 'ON' : 'OFF', 6.5, 'middle', ldg ? '#7dff3a' : '#9aa0a6')}
  <rect data-kg="ldgRet" x="17" y="124" width="20" height="16" rx="2" fill="${hot('ldgRet')}" style="cursor:pointer"/>
  ${[0, 1, 2].map(i => `<line x1="20" y1="${95 + i * 3}" x2="34" y2="${95 + i * 3}" stroke="#555"/><line x1="20" y1="${129 + i * 3}" x2="34" y2="${129 + i * 3}" stroke="#555"/>`).join('')}
  ${_kgLab(46, 112, 'ON', 5.5)}${_kgLab(46, 119, 'OFF', 5.5)}
  <!-- SRCH CTR(4방향) -->
  ${_kgLab(80, 78, 'SRCH', 7)}${_kgLab(80, 86, 'CTR', 7)}
  <circle cx="80" cy="113" r="22" fill="#141618" stroke="#000"/>
  ${arrow('srchU', '80,90 75,97 85,97')}${arrow('srchD', '80,136 75,129 85,129')}${arrow('srchL', '57,113 64,108 64,118')}${arrow('srchR', '103,113 96,108 96,118')}
  <g style="cursor:pointer">${_kgRibbed(80, 113, 12, id)}
    <rect data-kg="srchU" x="70" y="100" width="20" height="10" fill="transparent"/><rect data-kg="srchD" x="70" y="116" width="20" height="10" fill="transparent"/>
    <rect data-kg="srchL" x="66" y="104" width="10" height="18" fill="transparent"/><rect data-kg="srchR" x="84" y="104" width="10" height="18" fill="transparent"/></g>
  <!-- COLL TRIM(DN 위 · UP 아래) -->
  ${_kgLab(115, 74, 'COLL', 6.5)}${_kgLab(115, 82, 'TRIM', 6.5)}${_kgLab(129, 96, 'DN', 6, 'start')}${_kgLab(129, 138, 'UP', 6, 'start')}
  <rect x="104" y="86" width="22" height="56" rx="3" fill="#0b0c0d" stroke="#666"/>
  <rect data-kg="collDn" x="106" y="88" width="18" height="25" rx="2" fill="${hot('collDn')}" style="cursor:pointer"/>
  <rect data-kg="collUp" x="106" y="115" width="18" height="25" rx="2" fill="${hot('collUp')}" style="cursor:pointer"/>
  ${[0, 1, 2, 3].map(i => `<line x1="109" y1="${94 + i * 4}" x2="121" y2="${94 + i * 4}" stroke="#555"/><line x1="109" y1="${120 + i * 4}" x2="121" y2="${120 + i * 4}" stroke="#555"/>`).join('')}
  <!-- SRCH LT(ON · OFF) -->
  ${_kgLab(153, 74, 'SRCH', 6.5)}${_kgLab(153, 82, 'LT', 6.5)}
  <rect data-kg="srchBrt" x="141" y="93" width="22" height="12" rx="3" fill="${_kgOnK('srchBrt') ? '#5d636a' : '#222528'}" stroke="#555" style="cursor:pointer"/>${_kgLab(152, 102, '▲ BRT', 5.5, 'middle', '#cfd4d9')}
  <g data-kg="srchLt" style="cursor:pointer"><circle cx="152" cy="116" r="10" fill="url(#kg-knob${id})" stroke="${srch ? '#ffd23a' : '#000'}" stroke-width="${srch ? 2.5 : 1}"/>${_kgLab(152, 118, 'PUSH', 4.5, 'middle', srch ? '#ffd23a' : '#9aa0a6')}</g>
  <rect data-kg="srchDim" x="141" y="127" width="22" height="12" rx="3" fill="${_kgOnK('srchDim') ? '#5d636a' : '#222528'}" stroke="#555" style="cursor:pointer"/>${_kgLab(152, 136, '▼ DIM', 5.5, 'middle', '#cfd4d9')}
  <!-- 상태 -->
  ${_kgLab(88, 186, `LDG ${ldg ? 'ON' : 'OFF'} · EXT ${Math.round(ext * 100)}%`, 7.5, 'middle', ldg ? '#7dff3a' : '#9aa0a6')}
  ${_kgLab(88, 198, `SRCH ${srch ? 'ON' : 'OFF'} ${Math.round(kgLt.br * 100)}% · ${Math.abs(Math.round(kgLt.az))}°${kgLt.az >= 0 ? 'R' : 'L'} · ${Math.round(kgLt.el)}°↓`, 7.5, 'middle', srch ? '#ffd23a' : '#9aa0a6')}
</svg>`;
}
// 사이클릭 그립(둘째 사진) — 200×380 · flip 이면 좌우 뒤집어(왼쪽 좌석)
function kgCyclicSvg(id = '', flip = false) {
  const hot = (k, c0) => _kgOnK(k) ? '#7dff3a' : c0;
  const gs = typeof gspdOn !== 'undefined' && gspdOn;
  const beep = (k, pts) => `<polygon data-kg="${k}" points="${pts}" fill="${hot(k, '#cfd4d9')}" style="cursor:pointer"/>`;
  return `<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;overflow:visible">${_kgDefs(id)}
  <g${flip ? ' transform="translate(200 0) scale(-1 1)"' : ''}>
  <!-- 손잡이(앞으로 굽은 몸통) -->
  <path d="M70 120 C64 170 70 205 92 232 C112 258 116 300 108 380 H150 C156 300 150 250 140 222 C130 192 136 150 150 108 Z" fill="url(#kg-tube${id})" stroke="#000" stroke-width="1.5"/>
  <path d="M86 140 C84 175 92 205 108 228" fill="none" stroke="#5a6067" stroke-width="1" opacity="0.6"/>
  <!-- 손잡이 앞 — 위에서부터 PTT(실기는 뒤편 · 쓰기 좋게 앞으로) · FORCE TRIM RELEASE · G/SPEED -->
  <g data-kg="ptt" style="cursor:pointer"><circle cx="124" cy="158" r="12" fill="#0b0c0d" stroke="${hot('ptt', '#444')}" stroke-width="${_kgOnK('ptt') ? 3 : 1.5}"/><circle cx="124" cy="158" r="8" fill="url(#kg-knob${id})"/></g>
  ${_kgLab(106, 161, 'PTT', 6.5, 'end', '#cfd4d9')}
  <g data-kg="ftr" style="cursor:pointer"><circle cx="128" cy="198" r="12" fill="#0b0c0d" stroke="${hot('ftr', '#444')}" stroke-width="${_kgOnK('ftr') ? 3 : 1.5}"/><circle cx="128" cy="198" r="8" fill="url(#kg-knob${id})"/></g>
  ${_kgLab(110, 197, 'FTR', 6.5, 'end', '#cfd4d9')}${_kgLab(110, 204, 'REL', 6.5, 'end', '#cfd4d9')}
  <g data-kg="gspd" style="cursor:pointer"><circle cx="138" cy="240" r="13" fill="#0b0c0d" stroke="${gs ? '#00e5ff' : '#444'}" stroke-width="${gs ? 3 : 1.5}"/><circle cx="138" cy="240" r="8.5" fill="url(#kg-knob${id})"/></g>
  ${_kgLab(140, 268, 'G/SPEED', 6.5, 'middle', gs ? '#00e5ff' : '#cfd4d9', -70)}
  <!-- 머리판 -->
  <path d="M12 128 C6 82 30 50 82 40 C120 32 160 26 184 44 C196 56 196 80 182 90 C158 104 122 106 92 120 C66 132 46 156 28 156 C17 155 13 142 12 128 Z" fill="url(#kg-plate${id})" stroke="#000" stroke-width="2"/>
  <path d="M18 127 C14 86 36 57 84 47 C120 39 156 34 178 50 C188 59 188 77 177 84" fill="none" stroke="#5a6067" stroke-width="1"/>
  ${[[30, 92], [70, 58], [104, 46], [96, 108]].map(([x, y]) => _kgScrew(x, y)).join('')}
  <!-- DISENGAG(흰) · 검은 단추 -->
  ${_kgLab(30, 108, 'DISENGAG', 6, 'middle', '#cfd4d9', -60)}
  <g data-kg="apDis" style="cursor:pointer"><circle cx="44" cy="118" r="12" fill="#0b0c0d" stroke="#000"/><circle cx="44" cy="118" r="9" fill="url(#kg-white${id})"/></g>
  <g data-kg="blk" style="cursor:pointer"><circle cx="32" cy="142" r="10" fill="#0b0c0d" stroke="#333" stroke-width="1.5"/><circle cx="32" cy="142" r="6.5" fill="url(#kg-knob${id})"/></g>
  <!-- 4-WAY BEEP -->
  ${_kgLab(70, 66, '4-WAY BEEP', 6.5, 'middle', '#cfd4d9', -28)}
  <!-- 화살표는 실기처럼 왼쪽으로 30° 틀어져 있다(손가락 방향) -->
  <g style="cursor:pointer">${_kgRibbed(82, 88, 15, id)}<g transform="rotate(-30 82 88)">
    ${beep('beepF', '82,70 77,76 87,76')}${beep('beepA', '82,106 77,100 87,100')}${beep('beepL', '64,88 70,83 70,93')}${beep('beepR', '100,88 94,83 94,93')}
    <rect data-kg="beepF" x="72" y="74" width="20" height="10" fill="transparent"/><rect data-kg="beepA" x="72" y="92" width="20" height="10" fill="transparent"/>
    <rect data-kg="beepL" x="67" y="78" width="10" height="20" fill="transparent"/><rect data-kg="beepR" x="87" y="78" width="10" height="20" fill="transparent"/></g></g>
  <!-- DMS · 빨간 단추 · BEEP CTL -->
  ${_kgLab(124, 52, 'DMS', 6.5, 'middle', '#cfd4d9')}<g data-kg="dms" style="cursor:pointer">${_kgRibbed(124, 70, 11, id)}<rect x="119" y="65" width="10" height="10" rx="2" fill="#0e0f10"/></g>
  ${_kgLab(156, 22, 'AP CUT', 5.5, 'middle', '#ff8a80')}<g data-kg="apCut" style="cursor:pointer"><circle cx="156" cy="40" r="10" fill="#111" stroke="#000"/><circle cx="156" cy="40" r="7.5" fill="url(#kg-red${id})"/></g>
  ${_kgLab(170, 60, 'BEEP CTL', 6, 'middle', '#cfd4d9')}<g data-kg="beepCtl" style="cursor:pointer">${_kgRibbed(164, 74, 12, id)}</g>
  </g>
</svg>`;
}

// ── 조종석 자리(1600×900 그림 좌표) — 컬렉티브는 CDU 오른쪽(Bell 컬렉티브와 같은 크기) · 사이클릭은 좌 · 우 사이클릭 자리 ──
// 컬렉티브 — 기장석(오른쪽) 은 CDU 오른쪽 · 부조종사석(왼쪽)은 왼쪽 사이클릭에서 같은 거리만큼 왼쪽(기능은 같다)
const KG_MINI = { coll: { x: 986, y: 808, w: 80, h: 165 }, collL: { x: 198, y: 808, w: 80, h: 165 }, cycR: { x: 1146, y: 742, w: 96, h: 182 }, cycL: { x: 358, y: 742, w: 96, h: 182 } };
const KG_AR = { coll: 175 / 380, cyc: 200 / 380 };
let kgPopK = null;               // 'coll' | 'cyc' | null
function kgRender() {
  const set = (id, h) => { const el = document.getElementById(id); if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
  set('kg-mini-coll', kgCollSvg('m'));
  set('kg-mini-collL', kgCollSvg('n'));
  set('kg-mini-cycR', kgCyclicSvg('r'));
  set('kg-mini-cycL', kgCyclicSvg('l'));          // 왼쪽 좌석 사이클릭도 같은 방향(실기와 같다)
  const b = document.getElementById('kg-pop-body');
  if (b && kgPopK) set('kg-pop-body', kgPopK === 'coll' ? kgCollSvg('p') : kgCyclicSvg('p'));
}
function _kgMount() {
  const ck = document.getElementById('sim-ckpit');
  if (!ck || !kgOn()) return;
  for (const [k, m] of Object.entries(KG_MINI)) {
    if (document.getElementById('kg-mini-' + k)) continue;
    const el = document.createElement('div'); el.id = 'kg-mini-' + k; el.className = 'kg-mini';
    el.style.cssText = `position:absolute;left:${m.x / 16}%;top:${m.y / 9}%;width:${m.w / 16}%;height:${m.h / 9}%;pointer-events:auto;cursor:zoom-in;z-index:2`;
    el.title = k.startsWith('coll') ? 'COLLECTIVE — 눌러 크게(LDG LT · SRCH LT · COLL TRIM)' : 'CYCLIC — 눌러 크게(DISENGAG · FORCE TRIM · 4-WAY BEEP · PTT · G/SPEED)';
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); kgPop(k.startsWith('coll') ? 'coll' : 'cyc'); });
    ck.appendChild(el);
  }
  kgRender();
}
function kgPop(k) { kgPopK = (k === undefined || k === kgPopK) ? null : k; const p = document.getElementById('kg-pop'); if (p) p.dataset.k = ''; _kgPopSync(); }
function _kgPopSync() {
  const ck = document.getElementById('sim-ckpit');
  const show = !!kgPopK && kgOn() && !!ck && ck.classList.contains('show') && ck.offsetWidth > 0;
  let p = document.getElementById('kg-pop');
  if (!show) { if (p) p.style.display = 'none'; if (!ck || !ck.classList.contains('show')) kgPopK = null; return; }
  const L = typeof _ckLayer === 'function' ? _ckLayer() : null;
  if (!L) return;
  if (!p) {
    p = document.createElement('div'); p.id = 'kg-pop';
    p.innerHTML = '<div class="kgp-bar"><span class="kgp-t"></span><button type="button" class="sim-btn kgp-x" title="닫기">✕</button></div><div id="kg-pop-body"></div>';
    p.querySelector('.kgp-x').addEventListener('click', e => { e.stopPropagation(); kgPop(null); });
    const body = p.querySelector('#kg-pop-body');
    body.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-kg]'); if (!t) return;
      e.preventDefault(); e.stopPropagation();
      try { body.setPointerCapture(e.pointerId); } catch (er) { /* 그만 */ }
      kgPress(t.dataset.kg);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => body.addEventListener(ev, _kgHoldStop));
  }
  if (p.parentElement !== L) L.appendChild(p);
  if (p.dataset.k !== kgPopK) { p.dataset.k = kgPopK; p.querySelector('.kgp-t').textContent = kgPopK === 'coll' ? 'COLLECTIVE' : 'CYCLIC'; document.getElementById('kg-pop-body').dataset.h = ''; kgRender(); }
  // 크기 — 3D 창 높이의 80%(버튼을 누르기 좋게) · 오른쪽 3D 버튼 줄 왼쪽 · 세로 가운데
  const bar = 26, H = L.clientHeight, a = KG_AR[kgPopK];
  let h = Math.max(160, H * 0.8 - bar), w = h * a;
  const lr = L.getBoundingClientRect(), btn = document.getElementById('ctl3d');
  const br = btn && btn.offsetWidth > 0 ? btn.getBoundingClientRect() : null;
  const rightEdge = br ? br.left - lr.left - 12 : L.clientWidth - 140;
  if (w > rightEdge - 12) { w = Math.max(120, rightEdge - 12); h = w / a; }
  const st = { display: 'flex', width: Math.round(w) + 'px', height: Math.round(h + bar) + 'px',
               left: Math.round(Math.max(6, rightEdge - w)) + 'px', top: Math.round(Math.max(6, (H - h - bar) / 2)) + 'px' };
  for (const kk in st) if (p.style[kk] !== st[kk]) p.style[kk] = st[kk];
}
// 다시 그림 · 자리 — 조종석은 켜고 끌 때마다 새로 만들어진다
let _kgLastH = '';
setInterval(() => {
  if (!kgOn()) return;
  try { _kgMount(); _kgPopSync(); } catch (e) { _swallow(e); }
  // 바깥(ENV · GSPD)에서 바뀐 상태도 따라 그린다
  const sig = `${_kgLdg()}|${typeof gspdOn !== 'undefined' && gspdOn}`;
  if (sig !== _kgLastH) { _kgLastH = sig; kgRender(); }
}, 100);
setInterval(() => { if (_kgHold && /^srch|^ldg/.test(_kgHold.k)) kgRender(); }, 120);
// 큰 창 바깥을 누르면 닫는다(✕ 를 찾지 않아도) — 조종석의 작은 그림을 누른 것은 빼고(그것은 열거나 바꾼다)
document.addEventListener('pointerdown', e => {
  const t = e.target;
  const kg = document.getElementById('kg-pop'), bc = document.getElementById('b206-coll-pop');
  const open = el => el && el.style.display !== 'none' && el.offsetParent !== null;
  if (open(kg) && !kg.contains(t) && !(t.closest && t.closest('.kg-mini'))) kgPop(null);
  if (open(bc) && !bc.contains(t) && !(t.closest && t.closest('#b206-coll')) && typeof b206cPop === 'function') b206cPop(false);
}, true);
try { appRegister({ kgPop }); } catch (e) { _swallow(e); }
