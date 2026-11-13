// NAT NPX138 FM 무전기(js/22-npx138.js) — 하부 콘솔 ⑧ 칸. 듀얼 라벨 조작 · DISP · CH/ST 편집 · 스캔 · 가드 · 전원을 본다.
export const name = 'NPX138 무전기';

export async function run(page, t) {
  await page.evaluate(() => { localStorage.removeItem('npx138'); npx = _npxFresh(); selectPanel('right', 'lcon', true); });
  await page.waitForTimeout(250);
  const lcd = () => page.evaluate(() => [...document.querySelectorAll('#npx-lcd .npx-row')].map(r => r.textContent.replace(/ /g, ' ')));
  // 스위치 누르기 — fx/fy 는 그 조작 칸 안의 자리(0~1)
  const tap = async (id, fx = 0.5, fy = 0.5, hold = 0) => {
    const b = await page.locator(`[data-npx="${id}"]`).boundingBox();
    await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy); await page.mouse.down();
    if (hold) await page.waitForTimeout(hold);
    await page.mouse.up(); await page.waitForTimeout(30);
  };
  const plus = id => tap(id, 0.85), minus = id => tap(id, 0.15);
  const dom = await page.evaluate(() => ({ n: document.querySelectorAll('#npx [data-npx]').length, txt: document.getElementById('npx').textContent }));
  t.ok(dom.n === 9 && /NPX/.test(dom.txt) && /TRANSCEIVER/.test(dom.txt) && /SELECT/.test(dom.txt) && /HELP/.test(dom.txt),
    `패널이 그려진다 — 조작 ${dom.n}개(DISP·CHAN·BRIGHT·EDIT·SQ·MN·GD·SCAN·GD1/2)`);
  let L = await lcd();
  const cells = await page.evaluate(() => [...document.querySelectorAll('#npx-lcd .npx-row')].map(r => r.children.length));
  t.ok(L[1].length === 16 && cells.every(n => n === 16) && /^01 MARINE 16  scP1$/.test(L[0]) && L[1].startsWith('PWR=HI TONES=ON'),
    `ID 화면 — 채널 · 이름 · sc · P1 / PWR=HI TONES=ON (${L.join(' | ')})`);
  // DISP RX · TX
  await tap('disp', 0.5, 0.9); L = await lcd(); const rx = L[0];
  await tap('disp', 0.9, 0.5); L = await lcd(); const tx = L[0];
  t.ok(rx === '01 156.8000s    ' && /^01 156\.8000s/.test(tx), `DISP RX · TX — 주파수와 심플렉스 s (${rx} / ${tx})`);
  // CHAN + · −  (KCG OPS 는 톤 91)
  await tap('disp', 0.5, 0.9);
  for (let i = 0; i < 5; i++) await plus('chan');
  L = await lcd(); t.ok(L[0] === '06 158.2500s  91', `CHAN + 다섯 번 → 6번 채널, 수신 톤 91 (${L[0]})`);
  await minus('chan'); L = await lcd(); t.ok(/^05 156\.4500/.test(L[0]), `CHAN − (${L[0]})`);
  // BRIGHT
  await minus('bright'); const br = await page.evaluate(() => npx.bright); t.eq(br, 4, 'BRIGHT − → 밝기 4');
  // TONE DISP 바꾸기(ST 편집) — MCODES 면 91.5 Hz 가 ZZ
  await tap('edit', 0.9); L = await lcd(); const st0 = L[1];
  await plus('bright'); await plus('bright'); await plus('bright'); L = await lcd(); const st3 = L[1];
  await minus('chan'); L = await lcd(); const mc = L[1];
  await tap('edit', 0.5); await plus('chan'); L = await lcd();
  t.ok(st0.startsWith('TX MODE=SIMPLEX') && st3.startsWith('TONE DISP=FREQ') && mc.startsWith('TONE DISP=MCODES') && L[0] === '06 158.2500s  ZZ',
    `ST 편집 — NEXT 로 항목, SELECT 로 값 (${st0.trim()} → ${st3.trim()} → ${mc.trim()} · ${L[0]})`);
  // CH 편집 — 이름 첫 글자를 SELECT + 로 바꾸고, NEXT 로 옮기고, EDIT 를 끄면 저장
  await tap('disp', 0.1, 0.5); await tap('edit', 0.1);
  const curOn = await page.evaluate(() => !!document.querySelector('#npx-lcd .npx-cur'));
  await plus('chan'); L = await lcd(); const e1 = L[0];
  await minus('chan'); await minus('chan'); L = await lcd(); const e2 = L[0];
  await plus('chan');
  for (let i = 0; i < 11; i++) await plus('bright');          // 커서 → 스캔(sc) 칸
  await plus('chan'); L = await lcd(); const e3 = L[0];
  await tap('edit', 0.5);
  const saved = await page.evaluate(() => npxChan(6));
  t.ok(curOn && /^06 LCG OPS/.test(e1) && /^06 JCG OPS/.test(e2) && /-$/.test(e3) && saved.sc === false && saved.name === 'KCG OPS',
    `CH 편집 — 깜빡이는 커서 · 글자 바퀴(K→L, K→J) · sc 끄기 · EDIT 끄면 저장 (${e1} / ${e2} / ${e3})`);
  // 주파수 편집 — 유효 눈금으로
  await page.evaluate(() => npxEditSw('NORM'));
  await tap('disp', 0.5, 0.9); await tap('edit', 0.1);
  for (let i = 0; i < 6; i++) await plus('bright');            // 마지막 숫자(0.0001)
  for (let i = 0; i < 3; i++) await plus('chan');
  L = await lcd(); const fe = L[0];
  await tap('edit', 0.5); L = await lcd();
  t.ok(/158\.2503/.test(fe) && /^06 158\.2500/.test(L[0]), `주파수 숫자 편집 뒤 5/6.25 kHz 눈금으로 맞춘다 (${fe} → ${L[0]})`);
  // HELP(편집 중 SQ)
  await tap('edit', 0.9); await tap('sq'); L = await lcd();
  t.ok(/NEXT=NEXT ITEM/.test(L[0]), `편집 중 SQ = HELP (${L.join(' | ')})`);
  await tap('edit', 0.5); await page.evaluate(() => { npx.msg = null; npxRender(); });
  // SQ — 누르는 동안 수신 표시등 호박색
  const b = await page.locator('[data-npx="sq"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(40);
  const ledOn = await page.evaluate(() => document.querySelector('#npx .npx-led.main').classList.contains('rx'));
  await page.mouse.up(); await page.waitForTimeout(40);
  const ledOff = await page.evaluate(() => !document.querySelector('#npx .npx-led.main').classList.contains('rx'));
  t.ok(ledOn && ledOff, 'SQ — 누르는 동안 RX/TX 표시등이 호박색');
  // SCAN · GD TX · GD2
  await tap('scan', 0.5, 0.1); L = await lcd(); const sc = L[0];
  await tap('scan', 0.5, 0.9); await tap('gdsel', 0.5, 0.9); L = await lcd(); const gd = L[1];
  await tap('scan', 0.5, 0.5);
  t.ok(/^L-SCANNING/.test(sc) && gd.startsWith('GD2 TX 156.3000'), `SCAN → L-SCANNING · GD TX/GD2 → 가드 송신 (${sc.trim()} / ${gd})`);
  // MN — 왼쪽 끝 OFF, 오른쪽으로 돌리면 켜지고 켠 직후 도움말(SQ=HELP)
  await page.evaluate(() => { npx.mn = 1; npxRender(); });
  await minus('mn'); await minus('mn'); const off = await page.evaluate(() => npx.on);
  await plus('mn'); L = await lcd(); const pu = L.join('|');
  await tap('sq'); L = await lcd(); const hp = L.join('|');
  t.ok(off === false && /NAT NPX138/.test(pu) && /SQ=HELP/.test(pu) && /CHAN=SEL CHANNEL/.test(hp), `MN 노브 OFF → 켜기 · 켠 직후 SQ 로 도움말 (${pu} → ${hp})`);
}
