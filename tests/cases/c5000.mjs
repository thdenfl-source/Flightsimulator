// C-5000 무전기 제어기(js/21-c5000.js) — 하부 콘솔 ⑦ 칸. 2×20 LCD · 소프트키 · VOL/SEL 노브 · 12키 화면 전환을 본다.
export const name = 'C-5000 무전기';

export async function run(page, t) {
  await page.evaluate(() => { localStorage.removeItem('c5000'); c5 = _c5Fresh(); selectPanel('right', 'lcon', true); });
  await page.waitForTimeout(250);
  const lcd = () => page.evaluate(() => [...document.querySelectorAll('#c5-lcd .c5-row')].map(r => r.textContent.replace(/ /g, ' ')));
  const key = async k => { await page.locator(`[data-c5="k${k}"]`).click(); await page.waitForTimeout(30); };
  // 노브 — 가운데(push) · 안 원판(inner) · 바깥 고리(outer), 왼쪽 − / 오른쪽 +
  const knob = async (kind, part, side = 1, hold = 0) => {
    const b = await page.locator(`[data-c5k="${kind}"]`).boundingBox(), r = b.width / 2;
    const off = part === 'push' ? 0 : part === 'inner' ? r * 0.5 : r * 0.85;
    await page.mouse.move(b.x + r + side * off, b.y + r); await page.mouse.down();
    if (hold) await page.waitForTimeout(hold);
    await page.mouse.up(); await page.waitForTimeout(40);
  };
  const dom = await page.evaluate(() => ({
    keys: document.querySelectorAll('#c5k .c5-key').length, soft: document.querySelectorAll('#c5k .c5-soft').length,
    knobs: document.querySelectorAll('#c5k .c5-knob').length, txt: document.getElementById('c5k').textContent }));
  t.ok(dom.keys === 12 && dom.soft === 2 && dom.knobs === 2 && /WULFSBERG/.test(dom.txt) && /PVTφ/.test(dom.txt),
    `제어기가 그려진다 — 12키 · 소프트키 둘 · 노브 둘 (${dom.keys}/${dom.soft}/${dom.knobs})`);
  let L = await lcd();
  t.ok(L.length === 2 && L.every(l => l.length === 20) && /^11 {3}\.\.M→278\.400R/.test(L[0]) && L[1].trim() === '',
    `HOME — 실기 기본 화면: 11(NORMAL · GUARD) · ..M → 278.400R · 아랫줄 비움 (${L.join(' | ')})`);
  // VALUE 노브 — 채널(ENTER 는 줄을 바꾸지 않는다)
  await knob('sel', 'push'); const line = await page.evaluate(() => c5.line);
  await knob('sel', 'inner', 1); L = await lcd();
  t.ok(line === 0 && /^11 {3}\.\.1→MARINE 16/.test(L[0]), `VALUE 로 채널을 올린다 (${L[0]})`);
  // PVTφ · DIR
  await key('9'); await key('1'); L = await lcd();
  t.ok(/^11  φ\.\.1 MARINE 16/.test(L[0]), `PVTφ · DIR(→ 끔)이 윗줄에 나온다 (${L[0]})`);
  await key('9'); await key('1');
  // UPPER 소프트키 — 누를 때마다 ‾ 가 첫 1(NORMAL) ⇄ 둘째 1(GUARD)
  //   첫 1: 1 과 ..M 이 함께 골라져(‾ 첫 1 · _ ..M) VALUE 로 채널 · 둘째 1: 오른쪽 #1 GUARD VHF → VALUE 로 #2 GUARD UHF
  //   CURSOR 로 _ 를 그 1 로 옮기면 VALUE 로 1 이 사라졌다 나타났다
  const spans = () => page.evaluate(() => [...document.querySelectorAll('#c5-lcd .c5-row:first-child span')].map(s => s.className));
  const has = (c, i, k) => (c[i] || '').split(' ').includes(k);
  await page.evaluate(() => { c5.r[0].ch = 0; c5Render(); });            // 매뉴얼 채널 ..M 에서
  await page.locator('[data-c5="soft0"]').click(); const s0 = await spans(); L = await lcd(); const n0 = L[0];
  await knob('sel', 'inner', 1); L = await lcd(); const nCh = L[0];
  await knob('sel', 'inner', -1);
  await page.locator('[data-c5="soft0"]').click(); const s1 = await spans(); L = await lcd(); const g0 = L[0];
  await knob('sel', 'inner', 1); L = await lcd(); const g1 = L[0];
  const gf = await page.evaluate(() => c5UvhfInfo().gf);
  await knob('sel', 'inner', 1);                                           // 다시 #1 GUARD VHF
  await page.locator('[data-c5="soft0"]').click(); const s2 = await spans();
  t.ok(has(s0, 0, 'c5-ovl') && !has(s0, 1, 'c5-ovl') && [5, 6, 7].every(i => has(s0, i, 'c5-ul')) && /\.\.M/.test(n0),
    `UPPER 한 번 — 첫 1 위에 ‾ · ..M 에 _ (1 과 ..M 이 함께 골라진다) (${n0})`);
  t.ok(/^11 {3}\.\.1→MARINE 16/.test(nCh), `그때 VALUE 로 채널을 고른다 (${nCh})`);
  t.ok(has(s1, 1, 'c5-ovl') && !has(s1, 0, 'c5-ovl') && /^11 {2}#1 GUARD VHF/.test(g0) && has(s1, 4, 'c5-ul'),
    `UPPER 한 번 더 — 둘째 1 위에 ‾ · 오른쪽에 #1 GUARD VHF (${g0})`);
  t.ok(/^11 {2}#2 GUARD UHF/.test(g1) && gf === '243.000', `그때 VALUE 로 #2 GUARD UHF(243.000) (${g1})`);
  t.ok(has(s2, 0, 'c5-ovl') && !has(s2, 1, 'c5-ovl'), 'UPPER 를 또 누르면 다시 첫 1 — 번갈아 간다');
  // CURSOR 로 _ 를 그 1 로 → VALUE 로 끄고 켠다
  await knob('sel', 'outer', 1); const c0 = await spans();
  await knob('sel', 'inner', 1); L = await lcd(); const nOff = L[0];
  await knob('sel', 'inner', 1);
  await page.locator('[data-c5="soft0"]').click(); await knob('sel', 'outer', 1);
  await knob('sel', 'inner', 1); L = await lcd(); const gOff = L[0];
  const g = await page.evaluate(() => ({ nrm: c5.r[0].nrm, guard: c5.r[0].guard }));
  await knob('sel', 'inner', 1);                                           // 다시 켠다
  await knob('sel', 'push'); const ngEnd = await page.evaluate(() => c5.ng); L = await lcd();
  t.ok(has(c0, 0, 'c5-ul') && !has(c0, 5, 'c5-ul'), `CURSOR 로 _ 를 첫 1 로 옮긴다 (${c0.slice(0, 2).join(',')})`);
  t.ok(/^ 1/.test(nOff) && /^1 /.test(gOff) && g.nrm === true && g.guard === false,
    `VALUE 로 그 자리 1 이 사라졌다 나타났다 — NORMAL · GUARD 쓰고 안 쓰고 (${nOff.slice(0, 4)} · ${gOff.slice(0, 4)})`);
  t.ok(ngEnd === null && /^11 {3}\.\.M/.test(L[0]), `ENTER 로 고르기를 끝낸다 — 다시 켠 11 · ..M (${L[0].slice(0, 8)})`);
  // NUM — 번호로 채널
  await key('#'); await key('6'); L = await lcd(); const numPg = L[0];
  await knob('sel', 'push'); L = await lcd();
  t.ok(/CHAN=\.\.6 <ENTER>/.test(numPg) && /KCG SAR/.test(L[0]), `NUM 6 ENTER → 6번 채널 (${numPg} → ${L[0]})`);
  // EDIT — CURSOR 로 칸 옮기고 VALUE 로 수신 주파수
  await key('3'); L = await lcd(); const ed0 = L[0];
  await knob('sel', 'outer', 1); await knob('sel', 'inner', 1); L = await lcd();
  t.ok(/159\.125R/.test(ed0) && /159\.138R/.test(L[0]) && /^N/.test(L[1]), `EDIT — 수신 주파수를 12.5 kHz 올린다 (${ed0} → ${L[0]} / ${L[1]})`);
  await knob('sel', 'push'); const saved = await page.evaluate(() => _c5ch(6).rx);
  t.ok(Math.abs(saved - 159.1375) < 1e-6, `ENTER 로 채널에 저장 (${saved})`);
  // DIM — 소프트키로 밝기
  await key('4'); const d0 = await page.evaluate(() => c5.dim); await page.locator('[data-c5="soft1"]').click(); L = await lcd();
  t.ok(/CHANGE DISPLAY/.test(L[0]) && /BRIGHTNESS 5/.test(L[1]) && d0 === 6, `DIM — LOWER 소프트키로 밝기 ▼ (${L[1]})`);
  await key('*');
  // MODE — SIMULCAST → RELAY 고르고 ENTER, 다시 ENTER 로 끈다
  await key('2'); L = await lcd(); const m0 = L.join('|'); await key('2'); L = await lcd(); const m1 = L.join('|');
  await knob('sel', 'push'); const on = await page.evaluate(() => c5.mode); await knob('sel', 'push');
  t.ok(/PRESS ENTER BUTTON\s*\|FOR SIMULCAST MODE/.test(m0) && /FOR RELAY MODE/.test(m1) && on === 'RELAY' && await page.evaluate(() => c5.mode) === '',
    `MODE — SIMULCAST · RELAY 를 고르고 ENTER 로 켜고 끈다 (${on})`);
  await page.waitForTimeout(1600);
  // KEY · SCAN · PROG
  await key('6'); await knob('sel', 'inner', 1); await knob('sel', 'push'); const k = await page.evaluate(() => c5.r[0].key);
  t.eq(k, '1', 'KEY — VALUE 로 1번 키 · ENTER 로 확정');
  await key('8'); L = await lcd(); t.ok(/NOT AVAILABLE/.test(L[1]), `SCAN — NOT AVAILABLE (${L[1]})`);
  await page.waitForTimeout(1600);
  await key('0'); for (const d of '1234') await key(d); L = await lcd(); const pw = L.join('|');
  await knob('sel', 'push'); L = await lcd();
  t.ok(/ENTER PASSWORD/.test(pw) && /#=\*\*\*\*/.test(pw) && /PROG: CHANNEL/.test(L[0]), `PROG — 비밀번호 네 자리 뒤 메뉴 (${L.join('|')})`);
  await key('*'); L = await lcd(); t.ok(/MARINE 16|KCG SAR/.test(L[0]), 'HOME 키로 돌아온다');
  // VOL — 안 원판 RT1 음량, 바깥 고리 RT2 음량
  await knob('vol', 'inner', -1); await knob('vol', 'outer', 1);
  const v = await page.evaluate(() => c5.r.map(r => r.vol));
  t.ok(v[0] === 5 && v[1] === 7, `VOL — 안 = RT1 −, 바깥 = RT2 + (${v.join('/')})`);
  // CDU Audio & Radios 의 U/VHF — C-5000 의 주파수 · 음량(VOL 과 같다)
  const uv = await page.evaluate(() => { const i = c5UvhfInfo(); c5SetVolPct(80); return { i, v: c5.r[0].vol }; });
  t.ok(uv.i.vol === 50 && uv.i.f === '159.138' && uv.v === 8, `CDU U/VHF — C-5000 주파수 ${uv.i.f} · 음량 ${uv.i.vol}% · CDU 에서 80% → C-5000 VOL ${uv.v}`);
  // PUSH ON — 켜진 채로 누르면 경고가 켜짐 0.4초 · 꺼짐 0.2초로 다섯 번 깜빡인 뒤 꺼지고, 1초 누르면 다시 켜진다
  await page.evaluate(() => { window._c5beeps = 0; const f = _c5Beep; _c5Beep = (...a) => { window._c5beeps++; return f(...a); }; });
  await knob('vol', 'push', 1, 100); L = await lcd(); const warn = L.join('|');
  await page.waitForTimeout(220); L = await lcd(); const still = /USE CAUTION/.test(L.join('|'));   // 0.4초 동안은 켜져 있다
  await page.waitForTimeout(170); L = await lcd(); const blank = L.join('').trim() === '';           // 0.4 ~ 0.6초는 꺼짐
  const mid = await page.evaluate(() => c5.on);
  await page.waitForTimeout(2700);
  const off = await page.evaluate(() => c5.on), beeps = await page.evaluate(() => window._c5beeps);
  await knob('vol', 'push', 1, 1150); const on2 = await page.evaluate(() => c5.on);
  t.ok(/USE CAUTION/.test(warn) && /TURNING SYSTEM OFF/.test(warn) && still && blank && mid === true && off === false && beeps === 5 && on2 === true,
    `PUSH ON — 경고 다섯 번 깜빡임(삑 ${beeps}회) 뒤 꺼지고 다시 켜진다 (깜빡 ${blank} · ${mid} → ${off} → ${on2})`);
}
