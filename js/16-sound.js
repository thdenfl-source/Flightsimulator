// ─────────────────────────────────────────────────────────────
// 16-sound.js — 로터 소리 (3D 창의 SOUND 버튼)
//
// 땅에 있으면 '이륙 전' 소리, 바퀴가 떨어지면 '이륙 후' 소리가 난다. 뜨고 내려앉을 때는
// 두 소리가 SND_XFADE 초에 걸쳐 겹쳐 바뀐다(같은 힘 곡선 — 바뀌는 동안 크기가 꺼지지 않게).
// 바퀴가 떨어지기 직전(LIGHT ON WHEELS)에는 이륙 후 소리를 조금 미리 섞어 둔다.
// 멈춰(PAUSE) 있으면 소리도 잦아든다.
// 크기는 토크를 따른다 — 토크 0% 에서 최대의 70%, 100% 이상이면 100%(그 사이는 곧게).
//
// 소리 파일(sounds/)은 사용자가 준 녹음을 끊김 없이 되풀이되게 다듬은 것이다 —
// 음량을 고르게 하고 끝 2.5초를 처음에 겹쳐 섞었다. 압축(AAC·MP3) 파일은 앞에 짧은
// 무음이 붙어 되풀이할 때마다 틱 소리가 나므로 WAV(22.05kHz 모노)로 둔다.
//
// 브라우저는 사용자가 누르기 전에는 소리를 내지 못하게 한다. 그래서 버튼을 누를 때
// 소리 장치(AudioContext)를 연다. 켜 둔 채 새로 열면 첫 터치·키 입력 때 이어서 켠다.
// ─────────────────────────────────────────────────────────────
const SND_FILES_AW = { gnd: 'sounds/heli-ground.wav', air: 'sounds/heli-flight.wav' };
// Bell 206 — 단발(Allison 250 한 대) · 두 날개 주로터의 낮은 'whop'(13Hz) · 꼬리로터 버즈를 합성한 소리
// (같은 6초 되풀이 · 끝과 처음이 끊김 없이 이어진다)
const SND_FILES_B206 = { gnd: 'sounds/b206-ground.wav', air: 'sounds/b206-flight.wav' };
function sndFiles() { return (typeof acIs === 'function' && acIs('b206')) ? SND_FILES_B206 : SND_FILES_AW; }
const SND_XFADE = 2.5;    // 땅 ↔ 공중 소리가 겹쳐 바뀌는 시간(s)
const SND_LIGHT = 0.3;    // LIGHT ON WHEELS — 바퀴가 떨어지기 직전 미리 섞는 이륙 후 소리의 몫
const SND_VOL   = 0.8;    // 전체 크기(100% — 두 소리가 겹쳐도 넘치지 않게 조금 낮춰 둔다)
const SND_TQ_MIN = 0.7;   // 토크 0% 일 때의 크기(100% 의 몫) — 토크 100% 에서 1.0
const SND_PREF  = 'simSound';
let sndOn  = false;       // SOUND 버튼
let sndMix = 0;           // 지금 섞인 몫 — 0 = 이륙 전(땅) · 1 = 이륙 후(공중)
let _snd   = null;        // { ctx, master, gGnd, gAir, buf: {gnd, air}, src: [] }
let _sndT  = 0;
// 소리 크기(SOUND 아래 − / +) — 0~100%, 이 기기에 적어 둔다. 로터 · APU · 엔진 소리 모두에 곱한다
const SND_VOL_PREF = 'simSoundVol';
let sndVol = 100;
try { const v = parseInt(localStorage.getItem(SND_VOL_PREF), 10); if (Number.isFinite(v)) sndVol = Math.max(0, Math.min(100, v)); } catch (e) { sndVol = 100; }
function sndVolGain() { return sndVol / 100; }
function sndVolStep(d) {
  sndVol = Math.max(0, Math.min(100, Math.round((sndVol + (Number(d) || 0)) / 10) * 10));
  try { localStorage.setItem(SND_VOL_PREF, String(sndVol)); } catch (e) { _swallow(e); }
  updateSoundBtn();
  try { sndTick(0); } catch (e) { _swallow(e); }
}

// 땅에 있는가 — SIM 모드는 비행 모델의 착지 판정 그대로, 아니면 지면 위 높이(전파고도)로
function sndOnGround() {
  if (typeof simModeOn !== 'undefined' && simModeOn) return typeof _simOnGnd !== 'undefined' && !!_simOnGnd;
  try { if (typeof radarAltFt === 'function') return radarAltFt() < 1.5; } catch (e) { _swallow(e); }
  return S.alt < 1.5;
}
// 섞을 몫의 목표 — 땅 0 · 바퀴가 가벼워지면 SND_LIGHT · 공중 1
function sndMixTarget() {
  if (!sndOnGround()) return 1;
  return (typeof simLightOnWheels === 'function' && simLightOnWheels()) ? SND_LIGHT : 0;
}
// 토크에 따른 크기(0.7 … 1.0) — 계기에 보이는 토크 그대로(SIM 모드가 아니어도)
function sndTqGain(tq) {
  const v = Number.isFinite(tq) ? tq : 0;
  return SND_TQ_MIN + (1 - SND_TQ_MIN) * Math.max(0, Math.min(1, v / 100));
}
// 로터 회전(NR)에 따른 크기 · 빠르기 — 엔진을 모두 끄면 NR 이 내려가며 소리도 낮아지고 잦아든다(NR 5% 아래 무음)
function sndNr() {
  try { if (typeof engParams === 'function') { const n = engParams().nr; if (Number.isFinite(n)) return n; } } catch (e) { _swallow(e); }
  return 100;
}
function sndNrGain(nr) {
  const f = Math.max(0, Math.min(1, (nr - 5) / 95));
  return f <= 0 ? 0 : Math.pow(f, 1.3);
}
function sndNrRate(nr) { return 0.55 + 0.45 * Math.max(0, Math.min(1, nr / 100)); }   // 되풀이 빠르기 — NR 이 낮으면 낮고 느린 소리
// 같은 힘 곡선 — 두 소리의 크기(이륙 전, 이륙 후)
function sndGains(mix) {
  const m = Math.max(0, Math.min(1, mix));
  return [Math.cos(m * Math.PI / 2), Math.sin(m * Math.PI / 2)];
}

// 소리 장치를 열고 두 소리를 받아 되풀이로 건다(버튼을 누른 그 순간에 불러야 한다)
function sndStart() {
  try {
    if (!_snd) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { uiToast('이 브라우저는 소리를 낼 수 없습니다.', 'warn'); return; }
      const ctx = new AC();
      const master = ctx.createGain(), gGnd = ctx.createGain(), gAir = ctx.createGain();
      master.gain.value = 0;
      const [a, b] = sndGains(sndMix);
      gGnd.gain.value = a; gAir.gain.value = b;
      gGnd.connect(master); gAir.connect(master);
      // Bell 206 — 2kHz 위는 덜어 낸다(귀가 아픈 고주파를 막는 안전장치 · 소리 파일도 1.8kHz 아래로 만들었다)
      if (typeof acIs === 'function' && acIs('b206')) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.7; master.connect(lp); lp.connect(ctx.destination); }
      else master.connect(ctx.destination);
      _snd = { ctx, master, gGnd, gAir, buf: {}, src: [] };
      _sndLoad();
    }
    if (_snd.ctx.state === 'suspended') _snd.ctx.resume().catch(e => _swallow(e));
  } catch (e) { _swallow(e); }
}
function _sndLoad() {
  const s = _snd;
  const files = sndFiles(), get = k => fetch(files[k])
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    // 옛 사파리는 decodeAudioData 가 약속(Promise)을 돌려주지 않는다 — 콜백으로 받는다
    .then(ab => new Promise((ok, no) => s.ctx.decodeAudioData(ab, ok, no)))
    .then(b => { s.buf[k] = b; });
  Promise.all([get('gnd'), get('air')]).then(() => {
    if (_snd !== s) return;
    [['gnd', s.gGnd], ['air', s.gAir]].forEach(([k, g]) => {
      const src = s.ctx.createBufferSource();
      src.buffer = s.buf[k]; src.loop = true;
      src.connect(g); src.start();
      s.src.push(src);
    });
  }).catch(e => { _swallow(e); uiToast('소리 파일을 불러오지 못했습니다.', 'warn'); });
}
function sndStop() {
  if (!_snd) return;
  try { _snd.master.gain.setTargetAtTime(0, _snd.ctx.currentTime, 0.08); } catch (e) { _swallow(e); }
  const s = _snd;
  setTimeout(() => { if (!sndOn && _snd === s) { try { s.ctx.suspend(); } catch (e) { _swallow(e); } } }, 400);
}

function toggleSound() {
  sndOn = !sndOn;
  try { localStorage.setItem(SND_PREF, sndOn ? '1' : '0'); } catch (e) { _swallow(e); }
  if (sndOn) sndStart(); else sndStop();
  updateSoundBtn();
}
function updateSoundBtn() {
  const b = document.getElementById('snd-btn');
  if (!b) return;
  b.textContent = sndOn ? '🔊 SOUND' : '🔇 SOUND';
  b.classList.toggle('on', sndOn);
  const v = document.getElementById('snd-vol-v'); if (v) v.textContent = sndVol + '%';
  const r = document.getElementById('snd-vol'); if (r) r.classList.toggle('on', sndOn);
}

// 매 프레임(07-sim.js simStep) — 섞는 몫을 목표로 옮기고 크기를 건다. dt 는 실제 시간(s)
// (배속을 걸어도 소리가 겹쳐 바뀌는 빠르기는 그대로다)
function sndTick(dt) {
  const tgt = sndMixTarget();
  const step = Math.max(0, dt) / SND_XFADE;
  sndMix = tgt > sndMix ? Math.min(tgt, sndMix + step) : Math.max(tgt, sndMix - step);
  if (!_snd) return;
  const t = _snd.ctx.currentTime, [a, b] = sndGains(sndMix);
  try {
    _snd.gGnd.gain.setTargetAtTime(a, t, 0.05);
    _snd.gAir.gain.setTargetAtTime(b, t, 0.05);
    let tq = S.tq;
    try { if (typeof tqShown === 'function') tq = tqShown(); } catch (e) { _swallow(e); }
    // 경고음(Bell 206 ENG OUT · RPM)이 울리는 동안은 로터 소리를 반으로 줄여 경고음이 들리게 한다
    const duck = (typeof b206HornOn === 'function' && b206HornOn()) ? 0.5 : 1;
    const nr = sndNr();
    _snd.master.gain.setTargetAtTime(sndOn && (S.running || sndOnGround()) ? SND_VOL * sndVolGain() * sndTqGain(tq) * duck * sndNrGain(nr) : 0, t, 0.15);
    _snd.src.forEach(s => { try { s.playbackRate.setTargetAtTime(sndNrRate(nr), t, 0.3); } catch (e) { _swallow(e); } });
  } catch (e) { _swallow(e); }
}
function sndFrame() {
  const now = performance.now();
  const dt = _sndT ? Math.min(0.5, (now - _sndT) / 1000) : 0;
  _sndT = now;
  sndTick(dt);
}

// 켜 둔 채 새로 열었으면 — 버튼은 켜진 모습으로 두고, 첫 터치·키 입력 때 소리를 연다
(function sndRestore() {
  let pref = false;
  try { pref = localStorage.getItem(SND_PREF) === '1'; } catch (e) { pref = false; }
  if (!pref) return;
  sndOn = true;
  const go = () => {
    document.removeEventListener('pointerdown', go, true);
    document.removeEventListener('keydown', go, true);
    if (sndOn) sndStart();
  };
  document.addEventListener('pointerdown', go, true);
  document.addEventListener('keydown', go, true);
})();

// Cockpit Mode 가 시작되면 소리를 켠다(07-sim.js cockpitStart) — 누른 그 순간이면 바로, 아니면 첫 터치 · 키 입력 때 연다
function sndAutoOn() {
  if (!sndOn) {
    sndOn = true;
    try { localStorage.setItem(SND_PREF, '1'); } catch (e) { _swallow(e); }
    updateSoundBtn();
  }
  sndStart();
  if (_snd && _snd.ctx.state === 'suspended') {
    const go = () => { document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true); if (sndOn) sndStart(); };
    document.addEventListener('pointerdown', go, true); document.addEventListener('keydown', go, true);
  }
}
try { appRegister({ toggleSound, sndVolStep }); } catch (e) { _swallow(e); }
try { updateSoundBtn(); } catch (e) { _swallow(e); }

// ══════════ 계통 소리 — APU 시동 · 작동 · 엔진 시동(16-sound.js · 실시간 합성, 파일 없음) ══════════
//   SOUND 가 켜져 있으면(비행 PAUSE 와 상관없이 — 시동은 땅에서 멈춰 있을 때 한다)
//   APU: 상부 콘솔 APU CONTR ON → 17초 동안 시동(시동기 윙 · 점화 뒤 터빈이 차오르는 소리) → 작동(고른 터빈 휘파람) · OFF → 곧바로 꺼짐
//   엔진: TQS PCD OFF → IDLE/FLY(36-kuhsys.js 시동 약 25초) → 시동기 윙 · 점화 딸깍 · 연소 울림 · 터빈이 NG 따라 오름 →
//         시동이 끝나면(RUN) 8초에 걸쳐 잦아들고 그동안 로터 소리가 NR 따라 차오른다 · PCD OFF(또는 시동 실패) → 잦아듦
//   크기는 로터 소리와 따로 — 계통 소리 버스(sysBus)
const SYS_SND_VOL = 0.55;
let _ss = null;   // { bus, apu: voice, e: {1: voice, 2: voice}, noise }
function _ssNoise(ctx) {
  const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// 소리 한 묶음 — 터빈 휘파람(sine) · 시동기 윙(sawtooth→저역) · 연소/공기 울림(잡음→대역)
function _ssVoice(ctx, bus, noiseBuf) {
  const out = ctx.createGain(); out.gain.value = 0; out.connect(bus);
  const whine = ctx.createOscillator(); whine.type = 'sine'; const gW = ctx.createGain(); gW.gain.value = 0; whine.connect(gW); gW.connect(out); whine.start();
  const st = ctx.createOscillator(); st.type = 'sawtooth'; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const gS = ctx.createGain(); gS.gain.value = 0; st.connect(lp); lp.connect(gS); gS.connect(out); st.start();
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.8;
  const gN = ctx.createGain(); gN.gain.value = 0; nz.connect(bp); bp.connect(gN); gN.connect(out); nz.start();
  return { out, whine, gW, st, gS, bp, gN };
}
function _ssEnsure() {
  if (!_snd || _ss) return _ss;
  const ctx = _snd.ctx, bus = ctx.createGain(); bus.gain.value = SYS_SND_VOL;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500; bus.connect(lp); lp.connect(ctx.destination);
  const noise = _ssNoise(ctx);
  _ss = { bus, noise, apu: _ssVoice(ctx, bus, noise), e: { 1: _ssVoice(ctx, bus, noise), 2: _ssVoice(ctx, bus, noise) }, apuSpool: 0, eSpool: { 1: 0, 2: 0 }, post: { 1: 0, 2: 0 }, clickT: { 1: 0, 2: 0 } };
  return _ss;
}
// 지금 낼 소리 — 검사도 이것을 본다(소리 장치 없이)
let _ssApu = 0;
function sysSndState() {
  const o = { apu: { on: false, phase: 'OFF', spool: 0 }, eng: {} };
  try {
    const on = typeof ovhdGet === 'function' && ovhdGet('apuContr') === 'ON';
    const t = on && typeof _apuOnT !== 'undefined' && _apuOnT !== null ? (performance.now() - _apuOnT) / 1000 : 0;
    o.apu.on = on;
    o.apu.phase = !on ? 'OFF' : t < 17 ? 'START' : 'RUN';
    // 시동 — 처음 4초는 시동기만(0 → 0.3), 점화 뒤 17초까지 1 로 차오름
    o.apu.spool = !on ? 0 : t < 4 ? 0.3 * t / 4 : Math.min(1, 0.3 + 0.7 * (t - 4) / 13);
  } catch (e) { _swallow(e); }
  [1, 2].forEach(n => {
    let ph = 'RUN', ng = 0;
    try { const f = typeof fadec !== 'undefined' ? fadec.e[n] : null; ph = f && f.ph ? f.ph : 'RUN'; const P = engParams(); ng = (n === 1 ? P.e1 : P.e2).ng || 0; } catch (e) { _swallow(e); }
    try { if (ph === 'RUN' && typeof simEngSt !== 'undefined' && simEngSt[n] === 'OFF') ph = 'OFF'; } catch (e) { _swallow(e); }
    o.eng[n] = { ph, ng, starter: ph === 'CRANK' || ph === 'IGN', ign: ph === 'IGN', starting: ph === 'CRANK' || ph === 'IGN' };
  });
  return o;
}
// 크기 셈(소리 장치 없이도 — 검사가 이것을 본다). mem = { apuSpool, eSpool: {1,2}, post: {1,2} }
//   APU — 켜면 17초에 걸쳐 차오르고, 끄면 곧바로(0.5초) 꺼진다
//   엔진 — 시동 동안 소리가 나고, 시동이 끝나(RUN) 면 SYS_ENG_FADE 초에 걸쳐 잦아들어 없어진다.
//          그동안 로터 소리가 NR 을 따라 차오른다(NR 12%/s — 약 8초) · 시동 없이 처음부터 돌던 엔진은 소리가 없다
//          PCD OFF · 시동 중지면 3초에 걸쳐 잦아든다
const SYS_ENG_FADE = 8, SYS_APU_OFF = 0.5;
function sysSndLevels(st, mem, dt) {
  const aTgt = st.apu.spool;
  mem.apuSpool = aTgt >= mem.apuSpool ? aTgt : Math.max(aTgt, mem.apuSpool - dt / SYS_APU_OFF);
  const out = { apu: mem.apuSpool, eng: {} };
  [1, 2].forEach(n => {
    const E = st.eng[n];
    if (E.starting) mem.post[n] = 1;
    else if (E.ph === 'RUN') mem.post[n] = Math.max(0, mem.post[n] - dt / SYS_ENG_FADE);
    else mem.post[n] = 0;
    const tgt = E.starting ? 1 : E.ph === 'RUN' ? mem.post[n] : 0;
    mem.eSpool[n] = tgt >= mem.eSpool[n] || E.ph === 'RUN' ? tgt : Math.max(tgt, mem.eSpool[n] - dt / 3);
    const f = Math.max(0, Math.min(1, E.ng / 100));
    out.eng[n] = Math.min(1, mem.eSpool[n] * Math.max(0.25, Math.min(1, f * 1.4)));
  });
  return out;
}
function sysSndTick(dt) {
  if (typeof acIs === 'function' && acIs('b206')) return;          // Bell 은 제 소리(27-b206coll.js)
  if (!_snd || !sndOn) { if (_ss) { try { _ss.bus.gain.setTargetAtTime(0, _snd.ctx.currentTime, 0.1); } catch (e) { _swallow(e); } } return; }
  const ss = _ssEnsure(); if (!ss) return;
  const ctx = _snd.ctx, t = ctx.currentTime, st = sysSndState();
  try { ss.bus.gain.setTargetAtTime(SYS_SND_VOL * sndVolGain(), t, 0.2); } catch (e) { _swallow(e); }
  // APU — 끄면 곧바로 꺼진다
  const L = sysSndLevels(st, ss, dt);
  const a = L.apu, A = ss.apu;
  try {
    A.out.gain.setTargetAtTime(a > 0.01 ? 1 : 0, t, 0.3);
    A.whine.frequency.setTargetAtTime(500 + 2300 * a, t, 0.2); A.gW.gain.setTargetAtTime(0.05 + 0.10 * a * (a > 0.01 ? 1 : 0), t, 0.2);
    A.st.frequency.setTargetAtTime(90 + 260 * Math.min(1, a / 0.3), t, 0.2); A.gS.gain.setTargetAtTime(st.apu.phase === 'START' && a < 0.45 ? 0.10 : 0, t, 0.4);
    A.bp.frequency.setTargetAtTime(600 + 1400 * a, t, 0.3); A.gN.gain.setTargetAtTime(0.22 * Math.max(0, a - 0.25), t, 0.3);
  } catch (e) { _swallow(e); }
  // 엔진 — 시동 중 소리 · 시동이 끝나면 8초에 걸쳐 잦아들고 로터 소리(NR)가 차오른다 · 멎으면 잦아듦
  [1, 2].forEach(n => {
    const E = st.eng[n], V = ss.e[n], f = Math.max(0, Math.min(1, E.ng / 100));
    const lv = L.eng[n];
    try {
      V.out.gain.setTargetAtTime(Math.min(1, lv), t, 0.3);
      V.whine.frequency.setTargetAtTime(350 + 2600 * f, t, 0.15); V.gW.gain.setTargetAtTime(0.03 + 0.09 * f, t, 0.2);
      V.st.frequency.setTargetAtTime(70 + 380 * Math.min(1, E.ng / 54), t, 0.15); V.gS.gain.setTargetAtTime(E.starter ? 0.12 : 0, t, 0.25);
      V.bp.frequency.setTargetAtTime(250 + 900 * f, t, 0.3); V.gN.gain.setTargetAtTime(E.ign || E.ph === 'RUN' ? 0.10 + 0.18 * f : 0.02, t, 0.3);
    } catch (e) { _swallow(e); }
    // 점화 딸깍(초당 약 3번) — 점화기가 도는 동안
    if (E.ign) {
      ss.clickT[n] -= dt;
      if (ss.clickT[n] <= 0) {
        ss.clickT[n] = 0.33;
        try {
          const src = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
          src.buffer = ss.noise; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
          src.connect(hp); hp.connect(g); g.connect(ss.bus); src.start(t, Math.random()); src.stop(t + 0.04);
        } catch (e) { _swallow(e); }
      }
    } else ss.clickT[n] = 0;
  });
}
let _ssT = performance.now();
setInterval(() => { const now = performance.now(), dt = Math.min(0.5, (now - _ssT) / 1000); _ssT = now; try { sysSndTick(dt); } catch (e) { _swallow(e); } }, 60);
