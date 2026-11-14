'use strict';
// ══════════════════════════════════════════════════════
// 32-callout.js — 음성: 전파고도 콜아웃(흰수리) · 관제 응답(Bell PTT) · 체크리스트 자동 확인
//
// ① RA 콜아웃 — 흰수리(KUH-1CG)가 내려가며 전파고도 500 · 100 · 50 · 20 · 10ft 를 지날 때 음성으로 부른다
//    (브라우저 음성 합성 · 영어). 오르면 다시 건다. ENV 창의 'RA 콜아웃'으로 끄고 켠다.
// ② 관제 응답 — Bell 오디오 패널 PTT 로 송신하고 놓으면, 그 주파수가 가까운 공항(AIRFIELD_INFO)의 TWR · GND · APP 면
//    1.5초 뒤 정해진 말로 답한다(음성 + 알림 · 비행 기록):
//      GND — 활주로 앞까지 지상 이동 허가 · TWR — 땅 위면 이륙 허가, 10NM 안 공중이면 착륙 허가, 그 밖이면 5마일 최종 보고
//      APP — 처음엔 트랜스폰더 코드를 준다 · 그 코드(ALT)로 맞추면 레이더 포착 · 다르면 코드 확인 요청
//    TWR · GND 는 25NM, APP 는 60NM 안에서만 답한다. 바람으로 활주로를 고른다.
// ③ 체크리스트 자동 확인 — CDU CHECKLIST 항목 'NAME – VALUE' 가운데 상부 · 하부 콘솔 스위치로 확인할 수 있는 것은
//    지금 상태를 보고 ✓(맞음) · 지금 값(다름)을 곁에 적는다(09-cdu.js renderChecklistScreen).
// ══════════════════════════════════════════════════════

// ── 말하기 ──
function speak(text, lang = 'en-US', rate = (typeof appSet !== 'undefined' ? appSet.rate : 1.05)) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate; u.volume = 1;
    window.speechSynthesis.speak(u); return true;
  } catch (e) { _swallow(e); return false; }
}
let speakLog = [];          // 검사 · 강평용 — 마지막 말들
function _say(text, atc) { speakLog.push(text); if (speakLog.length > 20) speakLog.shift(); if (atc && typeof appSet !== 'undefined' && !appSet.atcVoice) return; speak(text); }

// ── ① RA 콜아웃 ──
const RA_CALLS = [500, 100, 50, 20, 10];
const RA_WORDS = { 500: 'five hundred', 100: 'one hundred', 50: 'fifty', 20: 'twenty', 10: 'ten' };
const _raArm = {};
let _raPrev = null;
function raCalloutStep() {
  if (typeof acB206 === 'function' && acB206()) return;
  if (typeof env !== 'undefined' && !env.raCall) { _raPrev = null; return; }
  let ra; try { ra = radarAltFt(); } catch (e) { return; }
  if (!S.running || !Number.isFinite(ra)) { _raPrev = ra; return; }
  if (_raPrev != null) {
    for (const h of RA_CALLS) {
      if (ra > h * 1.15 + 5) _raArm[h] = true;                                // 다시 건다
      if (_raArm[h] && _raPrev > h && ra <= h) { _raArm[h] = false; _say(RA_WORDS[h]); }
    }
  }
  _raPrev = ra;
}
setInterval(() => { try { raCalloutStep(); } catch (e) { _swallow(e); } }, 150);

// ── ② 관제 응답 ──
// 콜사인 — ⚙ 설정에서 바꾼다(33-train4.js appSet.callsign)
const atcCs = () => (typeof appSet !== 'undefined' && appSet.callsign) || 'Coastguard zero one';
const _apEn = { 인천: 'Incheon', 김포: 'Gimpo', 김해: 'Gimhae', 제주: 'Jeju', 광주: 'Gwangju', 목포: 'Mokpo', 무안: 'Muan', 군산: 'Gunsan', 여수: 'Yeosu',
  사천: 'Sacheon', 울산: 'Ulsan', 포항: 'Pohang', 대구: 'Daegu', 청주: 'Cheongju', 원주: 'Wonju', 양양: 'Yangyang', 서산: 'Seosan', 수원: 'Suwon',
  오산: 'Osan', 평택: 'Pyeongtaek', 강릉: 'Gangneung', 예천: 'Yecheon', 속초: 'Sokcho', 울진: 'Uljin', 태안: 'Taean', 정석: 'Jeongseok', 성무: 'Seongmu',
  서울: 'Seoul', 이천: 'Icheon', 논산: 'Nonsan', 진해: 'Jinhae', 포천: 'Pocheon', 용인: 'Yongin', 고양: 'Goyang', 양구: 'Yanggu', 춘천: 'Chuncheon' };
const _fr = s => (String(s || '').match(/\b1[1-3]\d\.\d{1,3}\b/g) || []).map(Number);
// 주파수 → 시설(가까운 공항의 TWR · GND · APP)
function atcFacility(freq) {
  if (!(freq > 0) || typeof AIRFIELD_INFO === 'undefined') return null;
  let best = null;
  for (const a of AIRFIELD_INFO) {
    const icao = 'RK' + a.code, ap = (typeof AIRPORTS_KR !== 'undefined') ? AIRPORTS_KR.find(x => x.icao === icao) : null;
    if (!ap) continue;
    const d = distance(S.lat, S.lon, ap.lat, ap.lon);
    for (const [kind, txt, lim] of [['TWR', a.twr, 25], ['GND', a.gnd, 25], ['APP', a.app, 60]]) {
      if (!_fr(txt).some(f => Math.abs(f - freq) < 0.006) || d > lim) continue;
      if (!best || d < best.d) {
        const appName = kind === 'APP' ? (String(txt).match(/^([가-힣]+)APP/) || [])[1] || a.name : a.name;
        best = { kind, icao, name: a.name, en: _apEn[appName] || _apEn[a.name] || icao.split('').join(' '), d, ap, rwy: a.rwy };
      }
    }
  }
  return best;
}
// 바람에 맞는 활주로(문자열 '04R-22R / 04L-22L' 의 첫 쌍)
function atcRunway(rwyStr) {
  const m = String(rwyStr || '').match(/(\d{2})([LRC]?)\s*-\s*(\d{2})([LRC]?)/); if (!m) return null;
  const ends = [m[1] + m[2], m[3] + m[4]], hd = ends.map(e => parseInt(e, 10) * 10);
  let wd = 0; try { wd = windSpd > 0 ? windDir : (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg); } catch (e) { _swallow(e); }
  const diff = h => Math.abs(((wd - h) % 360 + 540) % 360 - 180);
  return diff(hd[0]) <= diff(hd[1]) ? ends[0] : ends[1];
}
const _say3 = s => String(s).split('').map(c => ({ L: ' left', R: ' right', C: ' center' }[c] || ' ' + c)).join('').trim();
let atcSquawk = null, atcLast = null;
function atcReply(fac) {
  let gnd = false; try { gnd = typeof sndOnGround === 'function' ? sndOnGround() : S.alt < 5; } catch (e) { _swallow(e); }
  const nm = fac.en, wind = (() => { try { return windSpd > 0 ? `wind ${_say3(String(Math.round(windDir)).padStart(3, '0'))} at ${Math.round(windSpd)}` : 'wind calm'; } catch (e) { return 'wind calm'; } })();
  const rwy = atcRunway(fac.rwy), rw = rwy ? `runway ${_say3(rwy)}` : 'the active runway';
  let txt;
  if (fac.kind === 'GND') { txt = `${atcCs()}, ${nm} Ground, taxi to holding point ${rw}.`; atcExpect = { t: Date.now(), items: [['holding', 'hold'], rwy ? _rwyTokens(rwy) : []] }; }
  else if (fac.kind === 'TWR') {
    if (gnd) { txt = `${atcCs()}, ${nm} Tower, ${wind}, ${rw}, cleared for takeoff.`; atcExpect = { t: Date.now(), items: [['cleared'], ['takeoff', 'take off'], rwy ? _rwyTokens(rwy) : []] }; }
    else if (fac.d <= 10) { txt = `${atcCs()}, ${nm} Tower, ${wind}, ${rw}, cleared to land.`; atcExpect = { t: Date.now(), items: [['cleared'], ['land'], rwy ? _rwyTokens(rwy) : []] }; }
    else txt = `${atcCs()}, ${nm} Tower, report five miles final ${rw}.`;
  } else {
    const code = (typeof b206r !== 'undefined') ? b206r.xpdr.code : null, mode = (typeof b206r !== 'undefined') ? b206r.xpdr.mode : 'ALT';
    if (!atcSquawk) {
      atcSquawk = String(Math.floor(Math.random() * 8)) + [0, 0, 0].map(() => Math.floor(Math.random() * 8)).join('');
      if (atcSquawk === '7700' || atcSquawk === '7600' || atcSquawk === '7500' || atcSquawk === '1200') atcSquawk = '4521';
      txt = `${atcCs()}, ${nm} Approach, squawk ${_say3(atcSquawk)}.`;
      atcExpect = { t: Date.now(), items: [['squawk'], atcSquawk.split('')] };
    } else if (code === atcSquawk && (mode === 'ALT' || mode === 'ON')) {
      const brg = Math.round((Math.atan2((S.lon - fac.ap.lon) * Math.cos(S.lat * Math.PI / 180), S.lat - fac.ap.lat) * 180 / Math.PI + 360) % 360);
      const dir = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(brg / 45) % 8];
      const malt = Math.max(1000, Math.round((S.alt || 0) / 500) * 500);
      txt = `${atcCs()}, ${nm} Approach, radar contact, ${Math.round(fac.d)} miles ${dir} of ${nm}, maintain ${_altWords(malt)} feet.` + atcTrafficInfo();
      atcExpect = { t: Date.now(), items: [['maintain'], _altWords(malt).split(' ')] };
    } else txt = `${atcCs()}, ${nm} Approach, verify squawk ${_say3(atcSquawk)}.`;
  }
  atcLast = { kind: fac.kind, icao: fac.icao, txt };
  _say(txt, true);
  try { uiToast(`📻 ${fac.name} ${fac.kind} — ${txt}`, '', 6000); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function') fdrNote(`관제 ${fac.name} ${fac.kind}: ${txt}`); } catch (e) { _swallow(e); }
  return txt;
}
// ── 리드백 확인 — 관제 지시 뒤 30초 안의 다음 송신은 리드백으로 듣는다(브라우저 음성 인식 · ⚙ 설정 '리드백 확인') ──
//   빠진 것(활주로 · 코드 · 고도 · 허가 말)이 있으면 "Negative, read back …" · 다 있으면 알림으로 '리드백 정확'
let atcExpect = null, _atcRec = null, _atcHeard = '';
const _NUMW = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', niner: '9', tree: '3', fife: '5' };
const _altWords = ft => { const th = Math.floor(ft / 1000), h = Math.round((ft % 1000) / 100); return (th ? `${th === 1 ? 'one' : ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][th]} thousand` : '') + (h ? ` ${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][h]} hundred` : ''); };
const _rwyTokens = r => { const m = String(r).match(/^(\d)(\d)([LRC]?)$/); return m ? [m[1] + m[2], ({ L: 'left', R: 'right', C: 'center' })[m[3]]].filter(Boolean) : [r]; };
function _normHeard(t) {
  let s = ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
  for (const [w, d] of Object.entries(_NUMW)) s = s.replace(new RegExp(' ' + w + ' ', 'g'), ' ' + d + ' ');
  return s.replace(/(\d) (?=\d)/g, '$1').replace(/\s+/g, ' ');
}
// 들은 말이 지시를 다 담았나 — 항목마다 그 가운데 하나라도 들리면 된다(숫자는 이어 붙여 견준다)
function atcCheckReadback(heard, exp = atcExpect) {
  if (!exp) return null;
  const h = _normHeard(heard), hn = h.replace(/ /g, '');
  const missing = [];
  for (const alts of exp.items) {
    if (!alts.length) continue;
    const ok = alts.some(a => { const n = _normHeard(a).trim(); return n && (h.includes(' ' + n + ' ') || (/^\d+$/.test(n.replace(/ /g, '')) && hn.includes(n.replace(/ /g, '')))); });
    if (!ok) missing.push(alts[0]);
  }
  // 숫자 낱자(코드 · 고도 자리)는 한데 모아 다시 본다
  const digits = exp.items.filter(a => a.length === 1 && /^\d$/.test(a[0])).map(a => a[0]).join('');
  if (digits.length >= 3 && hn.includes(digits)) for (let i = missing.length - 1; i >= 0; i--) if (/^\d$/.test(missing[i])) missing.splice(i, 1);
  return { ok: !missing.length, missing };
}
function atcReadbackResult(heard) {
  const r = atcCheckReadback(heard); atcExpect = null; if (!r) return null;
  if (r.ok) { try { uiToast('📻 리드백 정확', '', 2500); } catch (e) { _swallow(e); } try { if (typeof fdrNote === 'function') fdrNote('리드백 정확'); } catch (e) { _swallow(e); } }
  else {
    const txt = `${atcCs()}, negative, read back ${r.missing.join(' ')}.`;
    _say(txt, true); try { uiToast(`📻 리드백 틀림 — 빠진 것: ${r.missing.join(' · ')}`, 'warn', 4000); } catch (e) { _swallow(e); }
    try { if (typeof fdrNote === 'function') fdrNote(`리드백 틀림(${r.missing.join(' · ')})`, 'warn'); } catch (e) { _swallow(e); }
  }
  return r;
}
function atcPttStart() {
  _atcHeard = '';
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!atcExpect || Date.now() - atcExpect.t > 30000 || !R || (typeof appSet !== 'undefined' && !appSet.readback)) return false;
  try { _atcRec = new R(); _atcRec.lang = 'en-US'; _atcRec.interimResults = false; _atcRec.onresult = e => { for (const x of e.results) _atcHeard += ' ' + x[0].transcript; }; _atcRec.start(); return true; } catch (e) { _swallow(e); _atcRec = null; return false; }
}
// 둘레의 교통(33-train4.js) — "traffic, 2 o'clock, 4 miles, 1500 feet"
function atcTrafficInfo() {
  const T = (typeof traffic !== 'undefined') ? traffic.filter(t => t.r < 8).sort((a, b) => a.r - b.r) : [];
  if (!T.length) return '';
  const t = T[0], v = { n: (t.lat - S.lat) * 60, e: (t.lon - S.lon) * 60 * Math.cos(S.lat * Math.PI / 180) };
  const rel = ((Math.atan2(v.e, v.n) * 180 / Math.PI - S.hdg) % 360 + 360) % 360, clock = Math.round(rel / 30) || 12;
  return ` Traffic, ${clock} o'clock, ${Math.max(1, Math.round(t.r))} miles, ${_altWords(Math.max(500, Math.round(t.alt / 100) * 100))} feet.`;
}
// PTT 를 놓았을 때(26-b206radio.js b206Ptt) — 송신한 주파수
let _atcT = null;
function atcOnTx(freq, delayMs = 1500) {
  // 지시 뒤 30초 안 — 리드백(음성 인식이 있으면 들은 것으로 견주고, 없으면 그냥 받는다)
  if (atcExpect && Date.now() - atcExpect.t < 30000) {
    if (_atcRec) { const rec = _atcRec; _atcRec = null; rec.onend = () => atcReadbackResult(_atcHeard); try { rec.stop(); } catch (e) { _swallow(e); atcReadbackResult(_atcHeard); } }
    else atcExpect = null;
    return null;
  }
  const fac = atcFacility(freq); if (!fac) return null;
  clearTimeout(_atcT); _atcT = setTimeout(() => atcReply(fac), delayMs);
  return fac;
}

// ── ③ 체크리스트 자동 확인 ──
// 'NAME – VALUE' 의 NAME → 콘솔 스위치(ovhdGet) · VALUE 를 그 스위치의 값으로 바꾸는 규칙
const CL_RULES = [
  [/^BATT( 스위치)?$/, ['batt']], [/^PITOT HEAT$/, ['pitotHeat']], [/^BATT HEAT$/, ['battHeat']], [/^EMERG PUMP$/, ['emergPump']],
  [/^ENG ANTI ICE$/, ['engAi1', 'engAi2']], [/^AIR SOUR$/, ['airSour']], [/^APU CONTR$/, ['apuContr']], [/^APU\/GPU$/, ['apuGen']],
  [/^PCD$/, ['pcd1', 'pcd2']], [/^GEN ?1$/, ['gen1']], [/^GEN ?2$/, ['gen2']], [/^TRU ?1$/, ['tru1']], [/^TRU ?2$/, ['tru2']],
  [/^PARKING BRAKE$/, ['parkBrake']], [/^ENG FUEL SYS 레버$/, ['fuel1', 'fuel2']], [/^WINDSLD WIPER|^WIPER$/, ['wiper']],
];
const CL_VAL = { ON: ['ON', 'SET', 'OPEN', 'IN'], OFF: ['OFF', 'RELEASE', 'OUT'], 'FUEL OPEN': ['OPEN'], AUTO: ['AUTO'], APU: ['APU'], 'APU GEN': ['APU GEN'], FLY: ['FLY'], IDLE: ['IDLE'] };
// 항목 글 → { ok: true/false, now: '지금 값' } · 확인할 수 없는 항목은 null
function clAutoState(text) {
  if (typeof ovhdGet !== 'function') return null;
  const m = String(text).match(/^(.+?)\s*[–-]\s*([A-Z][A-Z /]*?)(?:[.(]|$)/); if (!m) return null;
  const name = m[1].trim().toUpperCase(), want = m[2].trim();
  const rule = CL_RULES.find(([re]) => re.test(name)); if (!rule) return null;
  const okVals = CL_VAL[want] || [want];
  let now = [];
  try { now = rule[1].map(id => ovhdGet(id)); } catch (e) { return null; }
  if (now.some(v => v === undefined || v === null)) return null;
  return { ok: now.every(v => okVals.includes(String(v))), now: [...new Set(now)].join('/') };
}
setInterval(() => { try { if (typeof clAutoRefresh === 'function') clAutoRefresh(); } catch (e) { _swallow(e); } }, 1000);

// ── 흰수리(KUH-1CG) PTT — CDU AUDIO 의 MIC 로 고른 무전기로 송신한다 ──
//   COM1 · COM2(VHF-AM) — 놓으면 그 주파수의 관제 시설이 답한다(atcOnTx · 리드백 확인도 Bell 과 같다)
//   U/VHF(C-5000 RT1) · VHF-FM(NPX138) — 송신만(해상 · 경비 채널은 관제 응답이 없다) · PA · OFF 는 송신 안 됨
let _kuhTx = false, _kuhTxSnd = null, _kuhTxTgt = null;
function kuhTxTarget() {
  const mic = typeof cduMic === 'function' ? cduMic() : 'COM1';
  const dc = (() => { try { return typeof pwrDc === 'function' ? pwrDc() : true; } catch (e) { return true; } })();
  if (!mic || mic === 'OFF') return { name: 'OFF', ok: false, why: 'MIC 가 꺼져 있습니다(CDU AUDIO 에서 MIC 를 고르십시오)' };
  if (!dc) return { name: mic, ok: false, why: '전원(DC 버스)이 없습니다' };
  if (mic === 'COM1' || mic === 'COM2') { const r = typeof cduRadio === 'function' ? cduRadio(mic.toLowerCase()) : null; return r ? { name: mic, f: +r.act, ok: true } : { name: mic, ok: false, why: `${mic} 주파수를 읽지 못했습니다` }; }
  if (mic === 'U/VHF') {
    try { if (typeof c5 !== 'undefined' && c5 && c5.on) { const ch = c5.ch[c5.r[0].ch] || {}; return { name: 'U/VHF', f: +ch.tx || null, ok: true, noAtc: true }; } } catch (e) { _swallow(e); }
    return { name: 'U/VHF', ok: false, why: 'C-5000 이 꺼져 있습니다' };
  }
  if (mic === 'VHF-FM') {
    try { if (typeof npx !== 'undefined' && npx && npx.on) { const ch = npx.chans.find(c => c.n === npx.ch) || {}; return { name: 'VHF-FM', f: +ch.tx || null, ok: true, noAtc: true }; } } catch (e) { _swallow(e); }
    return { name: 'VHF-FM', ok: false, why: 'NPX138 이 꺼져 있습니다' };
  }
  if (mic === 'PA') return { name: 'PA', ok: true, noAtc: true };
  return { name: mic, ok: false, why: `${mic} 로는 송신하지 않습니다` };
}
function kuhPtt(on) {
  on = !!on; if (on === _kuhTx) return;
  if (on) {
    const t = kuhTxTarget();
    if (!t.ok) { try { uiToast(`송신 안 됨 — ${t.why}`, 'warn', 2000); } catch (e) { _swallow(e); } return; }
    _kuhTx = true; _kuhTxTgt = t;
    try { atcPttStart(); } catch (e) { _swallow(e); }
    try { const ac = typeof _adfAudioCtx === 'function' ? _adfAudioCtx() : null; if (ac && ac.state === 'running' && typeof _b206TxNoise === 'function') _kuhTxSnd = _b206TxNoise(ac, 0.01); } catch (e) { _swallow(e); }
  } else {
    _kuhTx = false; const t = _kuhTxTgt; _kuhTxTgt = null;
    try { if (_kuhTxSnd) { const s0 = _kuhTxSnd, ac = s0.src.context; _kuhTxSnd = null; s0.g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.15); s0.src.stop(ac.currentTime + 0.16); } } catch (e) { _swallow(e); }
    if (t && t.f && !t.noAtc) try { atcOnTx(t.f); } catch (e) { _swallow(e); }
    else if (t && t.noAtc && atcExpect) try { atcOnTx(0); } catch (e) { _swallow(e); }      // 리드백을 다른 무전기로 했어도 듣기는 마친다
  }
  try { document.querySelectorAll('[data-ptt-kuh]').forEach(b => b.classList.toggle('on', _kuhTx)); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function' && on) fdrNote(`송신 ${_kuhTxTgt ? _kuhTxTgt.name : ''}${_kuhTxTgt && _kuhTxTgt.f ? ' ' + _kuhTxTgt.f.toFixed(3) : ''}`); } catch (e) { _swallow(e); }
}
function kuhTxOn() { return _kuhTx; }
// 두 기종 함께 — 조이스틱 · 키 PTT
function radioPtt(on) {
  if (typeof acB206 === 'function' && acB206()) { if (typeof b206Ptt === 'function') b206Ptt(on); }
  else kuhPtt(on);
}
// CDU AUDIO 의 🎙 PTT 단추 — 누르는 동안(다시 그려져도 듣도록 문서에서 받는다)
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('[data-ptt-kuh]'); if (!b) return;
  e.preventDefault(); e.stopPropagation(); kuhPtt(true);
}, true);
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { if (_kuhTx) kuhPtt(false); }, true));
