// ─────────────────────────────────────────────────────────────
// 00-gate.js — 시작 잠금(비밀번호)
//
// 앱을 열면 먼저 비밀번호를 묻는다. 맞으면 그 탭에서는 다시 묻지 않는다
// (sessionStorage — 새로고침해도 그대로, 앱을 새로 열면 다시 묻는다).
// 잠겨 있는 동안에는 화면을 덮고, 키보드·조이스틱이 뒤의 앱에 닿지 않게 한다.
//
// 비밀번호 글자는 코드에 두지 않고 SHA-256 값만 둔다. 다만 이것은 화면 앞에서 막는
// 잠금일 뿐 보안 장치가 아니다 — 정적 사이트라 파일을 직접 받아 보면 앱 코드는 보인다.
//
// 다른 앱 파일보다 먼저(덮개 바로 뒤에서) 불러야 한다 — 그래야 키보드를 먼저 붙잡는다.
// (앱에는 이와 다른 '화면 잠금'(#lock-overlay · 07-sim.js)이 따로 있다 — 이름을 gate 로 가른다)
// ─────────────────────────────────────────────────────────────
(function () {
  const LOCK_HASH = '8b3923f7aa11169b84db0436811860d348a5bd64000e93dfe6070ef72fd269d6';
  const LOCK_KEY  = 'vfrUnlocked';

  // SHA-256(UTF-8) → 16진 문자열. 보안 맥락(https)이 아니어도 돌도록 직접 셈한다.
  function sha256Hex(str) {
    const bytes = new TextEncoder().encode(str);
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(bytes); m[len] = 0x80;
    const bits = len * 8;
    m[total - 4] = bits >>> 24; m[total - 3] = bits >>> 16; m[total - 2] = bits >>> 8; m[total - 1] = bits;
    const w = new Uint32Array(64), ror = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  const el = id => document.getElementById(id);
  function setUnlocked() {
    window.gateLocked = false;
    document.body.classList.add('gate-open');
    try { sessionStorage.setItem(LOCK_KEY, '1'); } catch (e) { /* 저장소를 못 쓰면 이번만 연다 */ }
  }

  let ok = false;
  try { ok = sessionStorage.getItem(LOCK_KEY) === '1'; } catch (e) { ok = false; }
  window.gateLocked = !ok;
  window.lockCheck = pw => sha256Hex(String(pw)) === LOCK_HASH;
  if (ok) { document.body.classList.add('gate-open'); return; }

  // 잠겨 있는 동안 키보드는 비밀번호 칸에만 — 뒤의 앱(단축키·트림 등)에 닿지 않게 붙잡는다
  const guard = e => {
    if (!window.gateLocked) return;
    const pw = el('gate-pw');
    if (pw && (e.target === pw || e.target === el('gate-ok'))) return;
    if (e.target && e.target.classList && e.target.classList.contains('gate-mode-btn')) return;   // 화면 고르기 버튼(Enter·Tab)
    e.stopImmediatePropagation();
    if (pw && e.type === 'keydown') pw.focus();
  };
  ['keydown', 'keyup', 'keypress'].forEach(k => window.addEventListener(k, guard, true));

  const form = el('gate-box'), pw = el('gate-pw'), msg = el('gate-msg');
  if (!form || !pw) { setUnlocked(); return; }      // 덮개가 없으면 막을 것도 없다
  // 비밀번호가 맞으면 화면을 고른다(PC 모드 · 3D 단독 모드) — 고른 뒤에 연다.
  // 고른 화면은 그 탭에 적어 두고(vfrStartMode), 3D 단독이면 앱이 뜬 뒤 3D Only 로 바로 들어간다(14-simmode.js).
  const chooseMode = () => {
    form.classList.add('choose');
    const pick = mode => {
      try { sessionStorage.setItem('vfrStartMode', mode); } catch (e) { /* 이번만 */ }
      window.vfrStartMode = mode;
      setUnlocked();
    };
    form.querySelectorAll('.gate-mode-btn').forEach(b => b.addEventListener('click', () => pick(b.dataset.mode)));
    const first = el('gate-mode-pc'); try { if (first) first.focus(); } catch (e) { /* 누르면 된다 */ }
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (form.classList.contains('choose')) return;
    if (window.lockCheck(pw.value)) {
      pw.value = '';
      if (el('gate-mode')) chooseMode(); else setUnlocked();
      return;
    }
    if (msg) msg.textContent = '비밀번호가 맞지 않습니다';
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    pw.value = ''; pw.focus();
  });
  try { pw.focus(); } catch (e) { /* 포커스를 못 잡아도 누르면 된다 */ }
})();
