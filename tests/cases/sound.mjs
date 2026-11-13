// 로터 소리 — 3D 창의 SOUND 버튼. 땅에서는 이륙 전, 바퀴가 떨어지면 이륙 후 소리가 나고
// 뜨고 내려앉을 때 겹쳐 바뀐다(16-sound.js).
//
// 검사 브라우저는 파일(file://)을 fetch 로 받지 못해 소리 자체는 내지 못한다 — 소리 파일은
// 여기(Node)에서 직접 읽어 보고, 섞는 셈은 가짜 소리 장치로 본다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';

export const name = '로터 소리';

// 16비트 모노 WAV 를 읽는다(머리말 · 표본)
function readWav(file) {
  const b = fs.readFileSync(file);
  const riff = b.toString('ascii', 0, 4), wave = b.toString('ascii', 8, 12);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), len = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') data = b.subarray(off + 8, off + 8 + len);
    off += 8 + len + (len & 1);
  }
  const n = data ? data.length / 2 : 0, x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = data.readInt16LE(i * 2) / 32768;
  return { riff, wave, fmt, x };
}
const rmsDb = a => 20 * Math.log10(Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length));

export async function run(page, t) {
  // ── 소리 파일 — 끊김 없이 되풀이되게 다듬은 WAV ──
  for (const [f, want] of [['heli-ground.wav', '이륙 전'], ['heli-flight.wav', '이륙 후']]) {
    const w = readWav(path.join(ROOT, 'sounds', f));
    const sr = w.fmt ? w.fmt.sr : 0, dur = w.x.length / (sr || 1);
    t.ok(w.riff === 'RIFF' && w.wave === 'WAVE' && w.fmt && w.fmt.ch === 1 && w.fmt.bits === 16 && sr === 22050,
      `${want} 소리(${f}) — 16비트 모노 22.05kHz WAV (${dur.toFixed(1)}초)`);
    const head = w.x.subarray(0, sr / 2), tail = w.x.subarray(w.x.length - sr / 2);
    const d = Math.abs(rmsDb(head) - rmsDb(tail));
    t.ok(dur > 5 && d < 1.5 && Math.abs(w.x[0] - w.x[w.x.length - 1]) < 0.05,
      `${want} 소리는 끝과 처음이 이어진다 — 되풀이해도 크기가 튀지 않는다 (끝·처음 ${d.toFixed(1)}dB 차)`);
  }

  // ── 버튼 — 3D 창의 FLY 아래 ──
  const btn = await page.evaluate(() => {
    const b = document.getElementById('snd-btn'), f = document.getElementById('fly3d-btn');
    return { inside: !!(b && b.closest('#map3d')), txt: b ? b.textContent : '', on: sndOn,
             below: b && f ? parseFloat(getComputedStyle(b).top) > parseFloat(getComputedStyle(f).top) : false };
  });
  t.ok(btn.inside && btn.below, '3D 창 FLY 버튼 아래에 SOUND 버튼이 있다');
  t.ok(!btn.on && /SOUND/.test(btn.txt) && /🔇/.test(btn.txt), `처음에는 꺼져 있다 (${btn.txt})`);

  // ── 땅 · 바퀴가 가벼울 때 · 공중 — 섞는 몫의 목표 ──
  const tgt = await page.evaluate(() => {
    if (!simModeOn) toggleSimMode(true);
    if (S.running) toggleSim();
    const o = {};
    _simOnGnd = true; simLow = false; o.gnd = sndMixTarget();
    simLow = true; o.low = sndMixTarget();
    _simOnGnd = false; simLow = false; o.air = sndMixTarget();
    return o;
  });
  t.ok(tgt.gnd === 0 && tgt.air === 1, '땅에서는 이륙 전 소리, 공중에서는 이륙 후 소리다');
  t.ok(tgt.low > 0 && tgt.low < 0.5, `바퀴가 떨어지기 직전(LIGHT ON WHEELS)에는 이륙 후 소리를 조금 미리 섞는다 (${tgt.low})`);

  // ── 겹쳐 바뀐다 — 2.5초에 걸쳐, 같은 힘 곡선 ──
  const fade = await page.evaluate(() => {
    const g = () => ({ value: 0, setTargetAtTime(v) { this.value = v; } });
    const fake = { ctx: { currentTime: 0 }, master: { gain: g() }, gGnd: { gain: g() }, gAir: { gain: g() }, src: [], buf: {} };
    const was = { snd: _snd, on: sndOn, run: S.running };
    _snd = fake; sndOn = true; S.running = true;
    _simOnGnd = true; simLow = false; sndMix = 0; sndTick(0.016);
    const o = { gnd: [fake.gGnd.gain.value, fake.gAir.gain.value], vol: fake.master.gain.value };
    _simOnGnd = false;                                  // 바퀴가 떨어졌다
    sndTick(1.0); o.t1 = sndMix;
    const [a, b] = [fake.gGnd.gain.value, fake.gAir.gain.value]; o.pow1 = a * a + b * b; o.both1 = a > 0.1 && b > 0.1;
    sndTick(1.5); o.t25 = sndMix; o.air = [fake.gGnd.gain.value, fake.gAir.gain.value];
    _simOnGnd = true;                                    // 내려앉았다
    sndTick(1.25); o.back = sndMix;
    S.running = false; sndTick(0.016); o.paused = fake.master.gain.value;
    S.running = true; sndOn = false; sndTick(0.016); o.off = fake.master.gain.value;
    _snd = was.snd; sndOn = was.on; S.running = was.run; sndMix = 0;
    return o;
  });
  t.ok(fade.gnd[0] === 1 && fade.gnd[1] === 0 && fade.vol > 0, '땅에서 날면 이륙 전 소리만 난다');
  t.ok(Math.abs(fade.t1 - 0.4) < 1e-6 && fade.both1 && Math.abs(fade.pow1 - 1) < 1e-6,
    `바퀴가 떨어지면 두 소리가 겹쳐 바뀐다 — 1초에 ${(fade.t1 * 100).toFixed(0)}% (크기는 그대로 · 같은 힘 곡선)`);
  t.ok(fade.t25 === 1 && fade.air[0] < 1e-9 && fade.air[1] === 1, '2.5초면 이륙 후 소리만 난다');
  t.ok(Math.abs(fade.back - 0.5) < 1e-6, `내려앉으면 거꾸로 겹쳐 이륙 전 소리로 돌아간다 (1.25초에 ${(fade.back * 100).toFixed(0)}%)`);
  t.ok(fade.paused === 0 && fade.off === 0, 'PAUSE 이거나 SOUND 를 끄면 소리가 잦아든다');

  // ── 크기는 토크를 따른다 — 토크 0% 에서 70%, 100% 이상이면 100% ──
  const vol = await page.evaluate(() => {
    const g = () => ({ value: 0, setTargetAtTime(v) { this.value = v; } });
    const fake = { ctx: { currentTime: 0 }, master: { gain: g() }, gGnd: { gain: g() }, gAir: { gain: g() }, src: [], buf: {} };
    const was = { snd: _snd, on: sndOn, run: S.running, tq: S.tq };
    _snd = fake; sndOn = true; S.running = true; _simOnGnd = false;
    const at = tq => { S.tq = tq; sndTick(0.016); return fake.master.gain.value / SND_VOL; };
    const o = { t0: at(0), t50: at(50), t100: at(100), t130: at(130), shown: tqShown() };
    _snd = was.snd; sndOn = was.on; S.running = was.run; S.tq = was.tq; sndMix = 0;
    return o;
  });
  t.ok(Math.abs(vol.t0 - 0.7) < 1e-9 && Math.abs(vol.t50 - 0.85) < 1e-9 && Math.abs(vol.t100 - 1) < 1e-9 && Math.abs(vol.t130 - 1) < 1e-9,
    `소리 크기는 토크를 따른다 — 0% → ${(vol.t0 * 100).toFixed(0)}% · 50% → ${(vol.t50 * 100).toFixed(0)}% · 100% → ${(vol.t100 * 100).toFixed(0)}% · 130% → ${(vol.t130 * 100).toFixed(0)}%`);

  // ── 버튼을 누르면 켜지고, 이 기기에 적어 둔다 ──
  const tog = await page.evaluate(() => {
    const b = document.getElementById('snd-btn');
    b.click();
    const on = { on: sndOn, txt: b.textContent, cls: b.classList.contains('on'), pref: localStorage.getItem('simSound'), ctx: !!_snd };
    b.click();
    const off = { on: sndOn, txt: b.textContent, pref: localStorage.getItem('simSound') };
    return { on, off };
  });
  t.ok(tog.on.on && tog.on.cls && /🔊/.test(tog.on.txt) && tog.on.pref === '1' && tog.on.ctx,
    `누르면 켜진다 — 소리 장치를 열고 이 기기에 적어 둔다 (${tog.on.txt})`);
  t.ok(!tog.off.on && /🔇/.test(tog.off.txt) && tog.off.pref === '0', '다시 누르면 꺼진다');
  t.ok(page.errors.length === 0, `소리를 켜고 끄는 동안 오류가 없다${page.errors.length ? ' — ' + page.errors.join(' / ') : ''}`);
}
