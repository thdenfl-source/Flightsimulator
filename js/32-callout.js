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
// 목소리를 고르지 않으면 브라우저 · 기기 기본 목소리가 나온다(PC 에 따라 거친 남성 합성음). 그래서 영어 목소리 가운데
// 자연스러운 여성 목소리를 먼저 고른다 — ⚙ 설정 '관제 목소리'에서 직접 고르면(appSet.voice) 그것을 쓴다.
const VOICE_PREF = [/Google US English/i, /Aria.*Natural|Jenny.*Natural|Ava.*Natural|Emma.*Natural|Michelle.*Natural/i, /Natural.*\(English/i,
  /Samantha|Karen|Moira|Tessa|Serena|Allison|Ava|Susan|Victoria|Fiona/i, /Zira|Hazel|Aria|Jenny|Libby|Sonia|Clara|Catherine|Heera/i, /female|woman/i, /Google UK English Female/i];
const VOICE_BAD = /espeak|eSpeak|mbrola|robot|whisper|novelty|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Fred|Hysterical|Junior|Ralph|Trinoids|Zarvox|Jester|Organ|Superstar|Wobble|Grandpa|Grandma|Rocko|Shelley|Reed|Eddy|Flo/i;
let _voices = [];
function speakVoices() {
  try { const v = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; if (v && v.length) _voices = v; } catch (e) { _swallow(e); }
  return _voices.filter(v => /^en(-|_|$)/i.test(v.lang || ''));
}
try { if (window.speechSynthesis) { speakVoices(); window.speechSynthesis.addEventListener('voiceschanged', speakVoices); } } catch (e) { _swallow(e); }
// 쓸 목소리 — 설정에서 고른 것 · 없으면 VOICE_PREF 순서로 · 그래도 없으면 이상한 것을 뺀 첫 영어 목소리
function speakVoice() {
  const en = speakVoices(); if (!en.length) return null;
  const want = typeof appSet !== 'undefined' && appSet.voice;
  if (want) { const v = en.find(x => x.name === want); if (v) return v; }
  const ok = en.filter(v => !VOICE_BAD.test(v.name));
  for (const re of VOICE_PREF) { const v = ok.find(x => re.test(x.name) && /^en-(US|GB|AU|IE|CA)/i.test(x.lang)) || ok.find(x => re.test(x.name)); if (v) return v; }
  return ok.find(v => /en-US/i.test(v.lang)) || ok[0] || en[0];
}
// 비행장 ICAO(RKSS 등)는 음성 문자로 읽는다 — "Romeo Kilo Sierra Sierra"
function atcIcaoWords(text) { return String(text).replace(/\b(RK[A-Z]{2})\b/g, m => [...m].map(c => (typeof _NATO !== 'undefined' && _NATO[c]) ? _NATO[c][0].toUpperCase() + _NATO[c].slice(1) : c).join(' ')); }
function speak(text, lang = 'en-US', rate = (typeof appSet !== 'undefined' ? appSet.rate : 1.05)) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(atcIcaoWords(text)), v = speakVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang;
    u.rate = rate; u.pitch = 1; u.volume = 1;
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
  if (atcIsWatchman(freq)) return { kind: 'WATCHMAN', name: 'Watchman', en: 'Watchman', icao: 'WATCHMAN', d: 0, ap: null, rwy: null };
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
// ── 타워 교신 흐름(실제 관제 교신 순서대로) — 놓았을 때의 자리 · 움직임으로 조종사가 할 말을 고르고 타워가 답한다 ──
//   지상 · 활주로 밖  → P: "<공항> Tower, <콜사인>, request taxi to runway for departure VFR <방향> bound"(또는 for pattern flight)
//                       T: "<콜사인>, runway 06, taxi to runway 06, altimeter 2992, report ready"
//   지상 · 활주로 위  → P: "… ready for departure VFR <방향> bound"(또는 ready for departure for pattern flight)
//                       T: "<콜사인>, wind 060 at 8, runway 06, cleared for takeoff"
//   공중 · 멀어지며 관제권(5NM) 언저리 → P: "… 060 radial 5 miles, leaving your control zone"   T: "<콜사인>, frequency change approved"
//   공중 · 다가오며    → P: "… 240 radial 12 miles, request inbound for landing"            T: "<콜사인>, report five miles from final"
//   그 뒤 6NM 안      → P: "… five miles from final"                                       T: "<콜사인>, wind …, runway 06, cleared to land"
//   방향(north · east · south · west bound)은 비행계획에서 공항 5NM 밖 첫 웨이포인트 쪽 — 비행계획이 없으면 장주(pattern) 비행으로 본다.
const atcTwr = { icao: null, phase: null };            // phase: 'taxi' · 'ready' · 'left' · 'inbound' · 'final'
const _atcTrack = [];                                  // 2초마다 자리 — 다가오나 멀어지나
setInterval(() => { try { _atcTrack.push({ t: Date.now(), lat: S.lat, lon: S.lon }); while (_atcTrack.length > 12) _atcTrack.shift(); } catch (e) { _swallow(e); } }, 2000);
function atcTrend(ap) {                                 // + 멀어진다 · − 다가온다(NM · 약 10초 사이)
  const old = _atcTrack.find(p => Date.now() - p.t >= 8000) || _atcTrack[0];
  if (!old) return 0;
  return distance(S.lat, S.lon, ap.lat, ap.lon) - distance(old.lat, old.lon, ap.lat, ap.lon);
}
function atcOnRunway() { try { const f = typeof rwyFlatAt === 'function' ? rwyFlatAt(S.lat, S.lon) : null; return !!f && f.w >= 0.99; } catch (e) { return false; } }
function atcRadial(ap) {
  let b = (Math.atan2((S.lon - ap.lon) * Math.cos(S.lat * Math.PI / 180), S.lat - ap.lat) * 180 / Math.PI + 360) % 360;
  try { if (typeof toMag === 'function') b = toMag(b); } catch (e) { _swallow(e); }
  return String(Math.round(b) % 360 || 360).padStart(3, '0');
}
function atcAltimeter() { const h = (typeof window._qnhHpa === 'number' && Number.isFinite(window._qnhHpa)) ? window._qnhHpa : 1013.25; return String(Math.round(h * 2.953)).padStart(4, '0'); }
// 떠날 방향 — 비행계획에서 공항 5NM 밖 첫 웨이포인트 쪽 · 없으면 null(장주 비행)
function atcDepBound(ap) {
  const w = (S.wps || []).find(x => x && Number.isFinite(x.lat) && distance(ap.lat, ap.lon, x.lat, x.lon) > 5);
  if (!w) return null;
  const b = (Math.atan2((w.lon - ap.lon) * Math.cos(ap.lat * Math.PI / 180), w.lat - ap.lat) * 180 / Math.PI + 360) % 360;
  return ['north', 'east', 'south', 'west'][Math.round(b / 90) % 4];
}
function atcTwrCall(fac, gnd, c) {
  const cs = atcCs(), tw = `${c.nm} Tower`, d = fac.d, dd = Math.max(1, Math.round(d));
  if (atcTwr.icao !== fac.icao) { atcTwr.icao = fac.icao; atcTwr.phase = null; }
  const bound = atcDepBound(fac.ap), dep = bound ? `for departure VFR to ${bound} bound` : 'for pattern flight';
  const rwT = c.rwy ? _rwyTokens(c.rwy) : [];
  let pilot, tower;
  if (gnd && !atcOnRunway()) {
    pilot = `${tw}, ${cs}, request taxi to runway ${dep}.`;
    tower = `${cs}, ${c.rw}, taxi to ${c.rw}, altimeter ${_say3(atcAltimeter())}, report ready.`;
    atcTwr.phase = 'taxi'; atcExpect = { t: Date.now(), items: [['taxi'], rwT, ['report ready', 'ready']] };
  } else if (gnd) {
    pilot = bound ? `${tw}, ${cs}, ready for departure VFR to ${bound} bound.` : `${tw}, ${cs}, ready for departure for pattern flight.`;
    tower = `${cs}, ${c.wind}, ${c.rw}, cleared for takeoff.`;
    atcTwr.phase = 'ready'; atcExpect = { t: Date.now(), items: [['cleared'], ['takeoff', 'take off'], rwT] };
  } else {
    const tr = atcTrend(fac.ap), out = tr > 0.05, inb = tr < -0.05;
    if (atcTwr.phase === 'inbound' && d <= 6.5) {
      pilot = `${tw}, ${cs}, five miles from final.`;
      tower = `${cs}, ${c.wind}, ${c.rw}, cleared to land.`;
      atcTwr.phase = 'final'; atcExpect = { t: Date.now(), items: [['cleared'], ['land'], rwT] };
    } else if (out && d >= 3 && d <= 10 && atcTwr.phase !== 'inbound') {
      pilot = `${tw}, ${cs}, ${_say3(atcRadial(fac.ap))} radial ${dd} miles, leaving your control zone.`;
      tower = `${cs}, frequency change approved.`;
      atcTwr.phase = 'left'; atcExpect = null;
    } else if (d > 6.5 || (inb && atcTwr.phase !== 'final')) {
      pilot = `${tw}, ${cs}, ${_say3(atcRadial(fac.ap))} radial ${dd} miles, request inbound for landing.`;
      tower = `${cs}, report five miles from final.`;
      atcTwr.phase = 'inbound'; atcExpect = { t: Date.now(), items: [['report'], ['five', '5'], ['final']] };
    } else {                                                            // 관제권 안 · 처음 부름(장주 · 다시 접근) — 착륙 허가
      pilot = `${tw}, ${cs}, five miles from final.`;
      tower = `${cs}, ${c.wind}, ${c.rw}, cleared to land.`;
      atcTwr.phase = 'final'; atcExpect = { t: Date.now(), items: [['cleared'], ['land'], rwT] };
    }
  }
  return { pilot, tower };
}
// 조종사가 할 말(안내) — 알림과 강평 기록에 남긴다(조종사는 이 말을 스스로 한다)
function atcPilotShow(fac, pilot) {
  if (!pilot) return;
  atcPilotLast = pilot;
  const ph = (String(pilot).match(/\bRK[A-Z]{2}\b/) || [])[0];
  try { uiToast(`🎙 PILOT — ${pilot}${ph ? ` (${ph} = ${atcIcaoWords(ph)})` : ''}`, '', 6000); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function') fdrNote(`조종사 ${fac.name} ${fac.kind}: ${pilot}`); } catch (e) { _swallow(e); }
}
let atcPilotLast = null;
// 접근 관제 — 레이더 포착 뒤 유도 단계 · 주파수 읽기(118.1 → "one one eight decimal one")
const atcApp = { contact: false, icao: null };
const _sayF = f => { const t = (+f).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''); return t.split('').map(c => c === '.' ? 'decimal' : ({ 0: 'zero', 1: 'one', 2: 'two', 3: 'tree', 4: 'four', 5: 'fife', 6: 'six', 7: 'seven', 8: 'eight', 9: 'niner' })[c]).join(' '); };
// 레이더 유도 — 활주로 연장선 위 5NM 지점(최종 진입 시작)으로 가는 기수 · 그쪽으로 도는 방향
function atcVector(fac, rwy) {
  const rh = rwy ? parseInt(rwy, 10) * 10 : 0, back = (rh + 180) % 360;
  const tgt = { lat: fac.ap.lat + 5 / 60 * Math.cos(back * Math.PI / 180), lon: fac.ap.lon + 5 / 60 * Math.sin(back * Math.PI / 180) / Math.cos(fac.ap.lat * Math.PI / 180) };
  let h = (Math.atan2((tgt.lon - S.lon) * Math.cos(S.lat * Math.PI / 180), tgt.lat - S.lat) * 180 / Math.PI + 360) % 360;
  try { if (typeof toMag === 'function') h = toMag(h); } catch (e) { _swallow(e); }
  h = Math.round(h / 10) * 10 % 360 || 360;
  const cur = (typeof toMag === 'function' ? toMag(S.hdg) : S.hdg), d = ((h - cur) % 360 + 540) % 360 - 180;
  return { hdg: String(h).padStart(3, '0'), turn: d < 0 ? 'left' : 'right' };
}

// ── Watchman(VHF 125.3 · UHF 278.4) — 관제 전담 기관은 아니지만 APP · TMA 밖 VFR 항공기에 레이더 조력을 준다 ──
//   관제권을 벗어나 레이더 조력 요청
//     P: "Watchman, <콜사인>, 240 radial 12 miles from RKSS, direct to <다음 지점> for sea patrol(MEDEVAC · search and rescue)"
//     W: "<콜사인>, radar contact, maintain VFR"
//   관제권(공항 10NM 안)에 들어가며 끝냄(termination)
//     P: "Watchman, <콜사인>, landing assured to RKSS, request frequency change"
//     W: "<콜사인>, radar frequency change approved. Have a good day!"
//   임무(sea patrol · MEDEVAC · search and rescue)는 ⚙ 설정에서 고른다(appSet.mission).
const WATCHMAN_FREQ = [125.3, 278.4];
const ATC_MISSIONS = { patrol: 'sea patrol', medevac: 'MEDEVAC', sar: 'search and rescue' };
const atcWm = { contact: false };
function atcIsWatchman(f) { return f > 0 && WATCHMAN_FREQ.some(x => Math.abs(x - f) < 0.006); }
const _NATO = { A: 'alpha', B: 'bravo', C: 'charlie', D: 'delta', E: 'echo', F: 'foxtrot', G: 'golf', H: 'hotel', I: 'india', J: 'juliett', K: 'kilo', L: 'lima', M: 'mike',
  N: 'november', O: 'oscar', P: 'papa', Q: 'quebec', R: 'romeo', S: 'sierra', T: 'tango', U: 'uniform', V: 'victor', W: 'whiskey', X: 'x-ray', Y: 'yankee', Z: 'zulu' };
function _nearestAp(maxNm = 999) {
  if (typeof AIRPORTS_KR === 'undefined') return null;
  let best = null;
  for (const a of AIRPORTS_KR) { const d = distance(S.lat, S.lon, a.lat, a.lon); if (d <= maxNm && (!best || d < best.d)) best = { a, d }; }
  return best;
}
// 다음에 갈 곳 — 활성 웨이포인트(없으면 비행계획 마지막)
function atcNextFix() {
  const w = (S.wps || [])[S.awp >= 0 ? S.awp : 0] || null;
  return w ? (w.ident || w.name || 'next waypoint') : null;
}
// 끝낼 공항 — 비행계획 마지막 지점이 공항이면 그곳, 아니면 가장 가까운 공항
function atcLandingAp() {
  const last = (S.wps || [])[S.wps ? S.wps.length - 1 : -1];
  if (last && typeof AIRPORTS_KR !== 'undefined') { const a = AIRPORTS_KR.find(x => x.icao === last.ident || distance(last.lat, last.lon, x.lat, x.lon) < 1); if (a) return a; }
  const n = _nearestAp(); return n ? n.a : null;
}
function atcWatchmanCall() {
  const cs = atcCs(), mis = ATC_MISSIONS[(typeof appSet !== 'undefined' && appSet.mission) || 'patrol'] || 'sea patrol';
  const near = _nearestAp(10), land = atcLandingAp();
  let pilot, tower;
  if (atcWm.contact && near) {                                         // 관제권(공항 10NM 안)으로 들어간다 — 끝냄
    const ap = land && distance(S.lat, S.lon, land.lat, land.lon) <= 15 ? land : near.a;
    pilot = `Watchman, ${cs}, landing assured to ${ap.icao}, request frequency change.`;
    tower = `${cs}, radar frequency change approved. Have a good day!`;
    atcWm.contact = false; atcExpect = null;
  } else {
    const ref = _nearestAp(), fix = atcNextFix();
    const where = ref ? `${atcRadial(ref.a)} radial ${Math.max(1, Math.round(ref.d))} miles from ${ref.a.icao}` : 'position unknown';
    pilot = `Watchman, ${cs}, ${where}${fix ? `, direct to ${fix}` : ''} for ${mis}.`;
    tower = `${cs}, radar contact, maintain VFR.`;
    atcWm.contact = true; atcExpect = { t: Date.now(), items: [['radar contact', 'contact'], ['VFR', 'V F R', 'vfr']] };
  }
  return { pilot, tower };
}
const _say3 = s => String(s).split('').map(c => ({ L: ' left', R: ' right', C: ' center' }[c] || ' ' + c)).join('').trim();
let atcSquawk = null, atcLast = null;
function atcReply(fac) {
  let gnd = false; try { gnd = typeof sndOnGround === 'function' ? sndOnGround() : S.alt < 5; } catch (e) { _swallow(e); }
  const nm = fac.en, wind = (() => { try { return windSpd > 0 ? `wind ${_say3(String(Math.round(windDir)).padStart(3, '0'))} at ${Math.round(windSpd)}` : 'wind calm'; } catch (e) { return 'wind calm'; } })();
  const rwy = atcRunway(fac.rwy), rw = rwy ? `runway ${_say3(rwy)}` : 'the active runway';
  let txt;
  if (fac.kind === 'WATCHMAN') {
    const r = atcWatchmanCall(); txt = r.tower; atcPilotShow(fac, r.pilot);
  } else if (fac.kind === 'GND') {
    // 지상 관제 — 땅 위면 지상 이동(활주로 앞 대기점까지) · 떠 있으면 타워로 넘긴다
    const twrF = (_fr(((typeof AIRFIELD_INFO !== 'undefined' ? AIRFIELD_INFO.find(a => 'RK' + a.code === fac.icao) : null) || {}).twr) || [])[0];
    const bound = atcDepBound(fac.ap);
    if (gnd) {
      atcPilotShow(fac, `${nm} Ground, ${atcCs()}, request taxi ${bound ? `for departure VFR to ${bound} bound` : 'for pattern flight'}.`);
      txt = `${atcCs()}, ${nm} Ground, taxi to holding point ${rw}, altimeter ${_say3(atcAltimeter())}${twrF ? `, contact tower ${_sayF(twrF)} when ready` : ''}.`;
      atcExpect = { t: Date.now(), items: [['holding', 'hold'], rwy ? _rwyTokens(rwy) : [], ['tower', 'ready']] };
    } else {
      atcPilotShow(fac, `${nm} Ground, ${atcCs()}, airborne.`);
      txt = `${atcCs()}, ${nm} Ground, contact tower${twrF ? ' ' + _sayF(twrF) : ''}.`;
      atcExpect = { t: Date.now(), items: [['tower']] };
    }
  }
  else if (fac.kind === 'TWR') {
    const r = atcTwrCall(fac, gnd, { nm, wind, rwy, rw });
    txt = r.tower; atcPilotShow(fac, r.pilot);
  } else {
    const code = (typeof b206r !== 'undefined') ? b206r.xpdr.code : null, mode = (typeof b206r !== 'undefined') ? b206r.xpdr.mode : 'ALT';
    if (!atcSquawk) {
      atcApp.contact = false;
      atcSquawk = String(Math.floor(Math.random() * 8)) + [0, 0, 0].map(() => Math.floor(Math.random() * 8)).join('');
      if (atcSquawk === '7700' || atcSquawk === '7600' || atcSquawk === '7500' || atcSquawk === '1200') atcSquawk = '4521';
      txt = `${atcCs()}, ${nm} Approach, squawk ${_say3(atcSquawk)}.`;
      atcExpect = { t: Date.now(), items: [['squawk'], atcSquawk.split('')] };
    } else if (code === atcSquawk && (mode === 'ALT' || mode === 'ON') && atcApp.contact && atcApp.icao === fac.icao) {
      // 레이더 포착 뒤 — 들어오면 레이더 유도(기수 · 고도 · 접근 예상) · 10NM 안이면 타워로 넘긴다
      const twrF = (_fr(((typeof AIRFIELD_INFO !== 'undefined' ? AIRFIELD_INFO.find(a => 'RK' + a.code === fac.icao) : null) || {}).twr) || [])[0];
      if (fac.d <= 10) {
        atcPilotShow(fac, `${nm} Approach, ${atcCs()}, ${Math.round(fac.d)} miles, field in sight.`);
        txt = `${atcCs()}, ${nm} Approach, contact tower${twrF ? ' ' + _sayF(twrF) : ''}.`;
        atcExpect = { t: Date.now(), items: [['tower']] }; atcApp.contact = false; atcSquawk = null;
      } else {
        const vec = atcVector(fac, rwy), alt = Math.max(1500, Math.min(4000, Math.round(fac.d * 300 / 500) * 500));
        atcPilotShow(fac, `${nm} Approach, ${atcCs()}, request vectors for ${rwy ? 'runway ' + rwy : 'landing'}.`);
        txt = `${atcCs()}, ${nm} Approach, turn ${vec.turn} heading ${_say3(vec.hdg)}, ${S.alt > alt + 100 ? 'descend and maintain' : 'maintain'} ${_altWords(alt)} feet, expect ${rwy ? `runway ${_say3(rwy)}` : 'visual approach'}.`;
        atcExpect = { t: Date.now(), items: [['heading'], vec.hdg.split(''), _altWords(alt).split(' ')] };
      }
    } else if (code === atcSquawk && (mode === 'ALT' || mode === 'ON')) {
      atcApp.contact = true; atcApp.icao = fac.icao;
      const brg = Math.round((Math.atan2((S.lon - fac.ap.lon) * Math.cos(S.lat * Math.PI / 180), S.lat - fac.ap.lat) * 180 / Math.PI + 360) % 360);
      const dir = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(brg / 45) % 8];
      const malt = Math.max(1000, Math.round((S.alt || 0) / 500) * 500);
      txt = `${atcCs()}, ${nm} Approach, radar contact, ${Math.round(fac.d)} miles ${dir} of ${nm}, maintain ${_altWords(malt)} feet.` + atcTrafficInfo();
      atcExpect = { t: Date.now(), items: [['maintain'], _altWords(malt).split(' ')] };
    } else txt = `${atcCs()}, ${nm} Approach, verify squawk ${_say3(atcSquawk)}.`;
  }
  atcLast = { kind: fac.kind, icao: fac.icao, txt };
  _say(txt, true);
  try { uiToast(`📻 ${fac.kind === 'WATCHMAN' ? 'Watchman' : fac.name + ' ' + fac.kind} — ${txt}`, '', 6000); } catch (e) { _swallow(e); }
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
    try { if (typeof c5 !== 'undefined' && c5 && c5.on) { const ch = c5.ch[c5.r[0].ch] || {}; return { name: 'U/VHF', f: +ch.tx || null, ok: true, noAtc: !atcIsWatchman(+ch.tx) }; } } catch (e) { _swallow(e); }   // UHF 278.4 는 Watchman
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
    try { uiToast(`🎙 송신 — ${t.name}${t.f ? ' ' + t.f.toFixed(3) : ''}`, '', 1500); } catch (e) { _swallow(e); }
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
