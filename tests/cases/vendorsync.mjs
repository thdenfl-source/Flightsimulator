// Vendor 를 다른 기기에서 — 교관 화면(?ios=1)의 위 막대 Vendor 가 조종석 창의 전탐석을 그대로 받아 그리고, 누른 조작은 조종석 창으로 보낸다
//   (같은 브라우저는 BroadcastChannel · 다른 기기는 WebRTC/중계 — 같은 길이다. 여기서는 같은 브라우저의 두 창으로 본다)
export const name = 'Vendor 다른 기기';

export async function run(page, t) {
  const [ios] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => document.getElementById('map-ios-btn').click())]);
  await ios.waitForFunction(() => !!document.getElementById('ios-root') && typeof msnSyncApply === 'function', null, { timeout: 20000 });
  await page.evaluate(() => { msnVslClear(); Object.assign(eo, { pwr: true, sensor: 'EOW', mode: 'MAN', az: 0, el: -5 }); rdr.rng = 20; rdr.cmd = 'SHARED'; });   // 레이더 권한 — 전탐석도 다룰 수 있게
  const tab = await ios.evaluate(() => [...document.querySelectorAll('#ios-pages [data-iosp]')].map(b => b.textContent).join(','));
  await ios.evaluate(() => iosPageSet('msn'));
  await ios.waitForFunction(() => iosMirrorN > 2 && msnOpen, null, { timeout: 8000 }).catch(() => {});
  const a = await ios.evaluate(() => ({ open: msnOpen, remote: MSN_REMOTE, root: !!document.querySelector('#simple-host #msn-root.on') }));
  t.ok(/Vendor/.test(tab) && a.open && a.remote && a.root, `교관 화면 위 막대 Vendor — 전탐석이 화면 가득 (${tab})`);

  // 조종석 창 → Vendor: 터릿 방위 · 선박
  await page.evaluate(() => { eo.az = 77; msnSpawn(3); });
  await ios.waitForFunction(() => Math.round(eo.az) === 77 && msnVsl.length === 3, null, { timeout: 4000 }).catch(() => {});
  const b = await ios.evaluate(() => ({ az: Math.round(eo.az), n: msnVsl.length, pcv: rdr.pcv === null || rdr.pcv instanceof HTMLCanvasElement }));
  t.ok(b.az === 77 && b.n === 3 && b.pcv, `조종석 창의 상태가 Vendor 로 — 터릿 방위 ${b.az}° · 선박 ${b.n}척 (레이더 그림은 제 것)`);

  // Vendor → 조종석 창: HCU(VIC 센서) · 레이더 거리 · 조이스틱
  const s0 = await page.evaluate(() => eo.sensor);
  await ios.evaluate(() => { hcuPress('vic:up', true); hcuPress('vic:up', false); msnAct('rng+'); eo.joy.x = 1; });
  await page.waitForFunction(s => eo.sensor !== s && rdr.rng === 50 && eo.joy.x === 1, s0, { timeout: 4000 }).catch(() => {});
  const c = await page.evaluate(() => ({ s: eo.sensor, rng: rdr.rng, jx: eo.joy.x }));
  await ios.evaluate(() => { eo.joy.x = 0; });
  await page.waitForFunction(() => eo.joy.x === 0, null, { timeout: 3000 }).catch(() => {});
  const jx0 = await page.evaluate(() => eo.joy.x);
  t.ok(c.s !== s0 && c.rng === 50 && c.jx === 1 && jx0 === 0, `Vendor 조작이 조종석 창으로 — VIC ${s0}→${c.s} · RNG 20→${c.rng} · 조이스틱 ${c.jx}→${jx0}`);
  await ios.waitForFunction(s => eo.sensor === s, c.s, { timeout: 3000 }).catch(() => {});
  t.eq(await ios.evaluate(() => eo.sensor), c.s, 'Vendor 화면도 조종석 창과 같은 센서');

  // 정해진 조작만 듣는다 · 소식이 끊기면 조이스틱은 가운데로
  const d = await page.evaluate(async () => {
    const run0 = S.running;
    msnRemoteCmd({ f: 'toggleSim', a: [] }); msnRemoteCmd({ f: 'msnAct', a: ['fly'] });
    msnRemoteCmd({ f: '_joy', a: [0.5, 0, 0, 0] }); const j1 = eo.joy.x;
    await new Promise(r => setTimeout(r, 1400));
    return { same: S.running === run0, j1, j2: eo.joy.x };
  });
  t.ok(d.same && d.j1 === 0.5 && d.j2 === 0, `정해진 조작만(비행 시작/멈춤은 안 받는다) · 조이스틱 소식이 1초 끊기면 가운데 (${JSON.stringify(d)})`);
  // 연결 상태(위 막대) — 왕복 시간 · 소식이 끊기면 빨갛게
  await ios.waitForFunction(() => iosLink.rtt !== null, null, { timeout: 4000 }).catch(() => {});
  await ios.waitForTimeout(400);
  const L = await ios.evaluate(async () => {
    const lk = () => { const e = document.querySelector('#msn-root [data-m="link"]'); return { c: e.className, t: e.textContent, d: getComputedStyle(e).display }; };
    const ok = lk(); iosLink.lastT = Date.now() - 2500; msnRenderPanels(); const slow = lk(); iosLink.lastT = Date.now() - 6000; msnRenderPanels(); const lost = lk();
    return { ok, slow, lost, rtt: iosLink.rtt };
  });
  const mainLk = await page.evaluate(() => { msnShow(true); msnRenderPanels(); const d = getComputedStyle(document.querySelector('#msn-root [data-m="link"]')).display; msnShow(false); return d; });
  t.ok(/ok/.test(L.ok.c) && /조종석 연결 \d+ms/.test(L.ok.t) && L.ok.d !== 'none' && /slow/.test(L.slow.c) && /응답 늦음/.test(L.slow.t) && /lost/.test(L.lost.c) && /연결 끊김 6초/.test(L.lost.t) && mainLk === 'none',
    `Vendor 위 막대에 조종석 연결 상태 — ${L.ok.t} · ${L.slow.t} · ${L.lost.t} (조종석 창에는 없음)`);
  await ios.close();
  await page.evaluate(() => { msnVslClear(); eo.joy.x = eo.joy.y = 0; rdr.rng = 20; rdr.cmd = 'CKPT'; msnShow(false); });
}
