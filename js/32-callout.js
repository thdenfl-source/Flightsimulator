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
function speak(text, lang = 'en-US', rate = 1.05) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate; u.volume = 1;
    window.speechSynthesis.speak(u); return true;
  } catch (e) { _swallow(e); return false; }
}
let speakLog = [];          // 검사 · 강평용 — 마지막 말들
function _say(text) { speakLog.push(text); if (speakLog.length > 20) speakLog.shift(); speak(text); }

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
const ATC_CS = 'Coastguard zero one';
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
  if (fac.kind === 'GND') txt = `${ATC_CS}, ${nm} Ground, taxi to holding point ${rw}.`;
  else if (fac.kind === 'TWR') {
    if (gnd) txt = `${ATC_CS}, ${nm} Tower, ${wind}, ${rw}, cleared for takeoff.`;
    else if (fac.d <= 10) txt = `${ATC_CS}, ${nm} Tower, ${wind}, ${rw}, cleared to land.`;
    else txt = `${ATC_CS}, ${nm} Tower, report five miles final ${rw}.`;
  } else {
    const code = (typeof b206r !== 'undefined') ? b206r.xpdr.code : null, mode = (typeof b206r !== 'undefined') ? b206r.xpdr.mode : 'ALT';
    if (!atcSquawk) {
      atcSquawk = String(Math.floor(Math.random() * 8)) + [0, 0, 0].map(() => Math.floor(Math.random() * 8)).join('');
      if (atcSquawk === '7700' || atcSquawk === '7600' || atcSquawk === '7500' || atcSquawk === '1200') atcSquawk = '4521';
      txt = `${ATC_CS}, ${nm} Approach, squawk ${_say3(atcSquawk)}.`;
    } else if (code === atcSquawk && (mode === 'ALT' || mode === 'ON')) {
      const brg = Math.round((Math.atan2((S.lon - fac.ap.lon) * Math.cos(S.lat * Math.PI / 180), S.lat - fac.ap.lat) * 180 / Math.PI + 360) % 360);
      const dir = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(brg / 45) % 8];
      txt = `${ATC_CS}, ${nm} Approach, radar contact, ${Math.round(fac.d)} miles ${dir} of ${nm}, maintain VFR.`;
    } else txt = `${ATC_CS}, ${nm} Approach, verify squawk ${_say3(atcSquawk)}.`;
  }
  atcLast = { kind: fac.kind, icao: fac.icao, txt };
  _say(txt);
  try { uiToast(`📻 ${fac.name} ${fac.kind} — ${txt}`, '', 6000); } catch (e) { _swallow(e); }
  try { if (typeof fdrNote === 'function') fdrNote(`관제 ${fac.name} ${fac.kind}: ${txt}`); } catch (e) { _swallow(e); }
  return txt;
}
// PTT 를 놓았을 때(26-b206radio.js b206Ptt) — 송신한 주파수
let _atcT = null;
function atcOnTx(freq, delayMs = 1500) {
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
