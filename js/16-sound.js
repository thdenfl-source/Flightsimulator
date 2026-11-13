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
const SND_FILES = { gnd: 'sounds/heli-ground.wav', air: 'sounds/heli-flight.wav' };
const SND_XFADE = 2.5;    // 땅 ↔ 공중 소리가 겹쳐 바뀌는 시간(s)
const SND_LIGHT = 0.3;    // LIGHT ON WHEELS — 바퀴가 떨어지기 직전 미리 섞는 이륙 후 소리의 몫
const SND_VOL   = 0.8;    // 전체 크기(100% — 두 소리가 겹쳐도 넘치지 않게 조금 낮춰 둔다)
const SND_TQ_MIN = 0.7;   // 토크 0% 일 때의 크기(100% 의 몫) — 토크 100% 에서 1.0
const SND_PREF  = 'simSound';
let sndOn  = false;       // SOUND 버튼
let sndMix = 0;           // 지금 섞인 몫 — 0 = 이륙 전(땅) · 1 = 이륙 후(공중)
let _snd   = null;        // { ctx, master, gGnd, gAir, buf: {gnd, air}, src: [] }
let _sndT  = 0;

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
      gGnd.connect(master); gAir.connect(master); master.connect(ctx.destination);
      _snd = { ctx, master, gGnd, gAir, buf: {}, src: [] };
      _sndLoad();
    }
    if (_snd.ctx.state === 'suspended') _snd.ctx.resume().catch(e => _swallow(e));
  } catch (e) { _swallow(e); }
}
function _sndLoad() {
  const s = _snd;
  const get = k => fetch(SND_FILES[k])
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
    _snd.master.gain.setTargetAtTime(sndOn && S.running ? SND_VOL * sndTqGain(tq) : 0, t, 0.15);
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

try { appRegister({ toggleSound }); } catch (e) { _swallow(e); }
try { updateSoundBtn(); } catch (e) { _swallow(e); }
