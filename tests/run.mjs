#!/usr/bin/env node
// VFR Flight Simulator — 회귀 테스트 러너
//   실행:  node tests/run.mjs            (전체)
//          node tests/run.mjs 홀딩 NAV   (이름으로 일부만)
// 필요:   npm i -D playwright   (라이브러리는 vendor/ 사본을 그대로 쓴다)
import { chromium } from 'playwright';
import { openApp, buildEnv } from './lib/env.mjs';
import * as smoke from './cases/smoke.mjs';
import * as coords from './cases/coords.mjs';
import * as chartcal from './cases/chartcal.mjs';
import * as hold from './cases/hold.mjs';
import * as nav from './cases/nav.mjs';
import * as actions from './cases/actions.mjs';
import * as gspd from './cases/gspd.mjs';
import * as dialog from './cases/dialog.mjs';
import * as chartview from './cases/chartview.mjs';
import * as procdata from './cases/procdata.mjs';
import * as simspd from './cases/simspd.mjs';

const SUITES = [smoke, actions, coords, chartcal, hold, nav, gspd, dialog, chartview, procdata, simspd];
const filter = process.argv.slice(2);

function makeT() {
  const rows = [];
  const T = {
    ok(cond, msg) { rows.push({ pass: !!cond, msg }); },
    eq(a, b, msg) { rows.push({ pass: a === b, msg: msg + (a === b ? '' : `  (실제 ${JSON.stringify(a)} ≠ 기대 ${JSON.stringify(b)})`) }); },
  };
  return [T, rows];
}

const EXE = process.env.CHROMIUM_PATH;   // 시스템 크로미움을 쓸 때
const browser = await chromium.launch({
  ...(EXE ? { executablePath: EXE } : {}),
  args: ['--no-sandbox'],
});

let total = 0, failed = 0;
try {
  buildEnv();   // Leaflet 등 사전 점검(문제가 있으면 여기서 명확히 실패)
  for (const s of SUITES) {
    if (filter.length && !filter.some(f => s.name.includes(f))) continue;
    const page = await openApp(browser, {});
    const [T, rows] = makeT();
    let err = null;
    try { await s.run(page, T); } catch (e) { err = e; }
    await page.close();

    const bad = rows.filter(r => !r.pass).length + (err ? 1 : 0);
    total += rows.length + (err ? 1 : 0); failed += bad;
    console.log(`\n${bad ? '✗' : '✓'} ${s.name}  (${rows.length - rows.filter(r => !r.pass).length}/${rows.length})`);
    rows.forEach(r => { if (!r.pass) console.log(`    ✗ ${r.msg}`); });
    if (process.env.VERBOSE) rows.forEach(r => { if (r.pass) console.log(`    ✓ ${r.msg}`); });
    if (err) console.log(`    ✗ 예외: ${err.message}`);
  }
} finally {
  await browser.close();
}

console.log(`\n${failed ? '실패' : '통과'}: ${total - failed}/${total}`);
process.exit(failed ? 1 : 0);
