import { openApp, buildEnv } from './lib/env.mjs';
const env = await buildEnv(); const { page, browser } = await openApp(env);
await page.getByText('시작하기').click().catch(()=>{}); await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const out = {};
  for (const wt of [16000, 18000, 19200]) {
    perfData.weight = String(wt); perfData.alt = '1500'; perfData.temp = '20'; try { calcPerf && calcPerf(); } catch (e) {}
    S.alt = 1500;
    const row = {}; for (const v of [0, 20, 40, 60, 70, 80, 100, 120, 140, 150]) row[v] = +tqRequiredAt(v, 0).toFixed(1);
    out[wt] = { row, vy: perfVy(), hov: hoverTqRef(), mta: mtaNow(1500) };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
