// 시작 잠금 — 비밀번호를 넣어야 시뮬을 쓸 수 있다.
//
// 다른 검사는 잠금을 풀어 둔 채로 연다(lib/env.mjs). 여기서는 새 탭으로 처음 여는 것처럼
// 열어, 덮개가 앱을 막는지·틀리면 안 열리는지·맞으면 열리고 그 탭에서는 다시 묻지 않는지 본다.
export const name = '시작 잠금';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';

const ready = p => p.waitForFunction(
  () => typeof S === 'object' && S !== null && typeof leafMap === 'object', null, { timeout: 20000 });
const state = p => p.evaluate(() => {
  const ov = document.getElementById('gate-overlay');
  let saved = null;
  try { saved = sessionStorage.getItem('vfrUnlocked'); } catch (e) { saved = null; }
  return { locked: window.gateLocked, shown: getComputedStyle(ov).display !== 'none',
           z: +getComputedStyle(ov).zIndex, msg: document.getElementById('gate-msg').textContent, saved };
});

export async function run(page, t) {
  const url = page.url();
  const browser = page.context().browser();
  const tab = await browser.newPage();
  await tab.goto(url); await ready(tab);
  const s0 = await state(tab);
  t.ok(s0.locked && s0.shown && s0.z > 100000, `처음 열면 비밀번호 화면이 앱을 덮는다 (z ${s0.z})`);

  // 잠겨 있는 동안 키보드는 뒤의 앱에 닿지 않는다(트림·단축키 등)
  const leak = await tab.evaluate(() => {
    let got = 0; const f = () => got++;
    document.addEventListener('keydown', f);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    document.removeEventListener('keydown', f);
    return got;
  });
  t.eq(leak, 0, '잠겨 있는 동안 키보드는 앱에 닿지 않는다');

  await tab.fill('#gate-pw', 'wrong-pass'); await tab.press('#gate-pw', 'Enter');
  const s1 = await state(tab);
  t.ok(s1.locked && s1.shown && /맞지 않습니다/.test(s1.msg) && s1.saved !== '1',
    `틀리면 열리지 않는다 (${s1.msg})`);
  t.eq(await tab.inputValue('#gate-pw'), '', '틀린 글자는 지운다');

  // 맞는 비밀번호는 저장소에 적지 않는다 — 돌리는 사람이 환경 변수로 준다(VFR_GATE_PW).
  // 없으면 그 탭이 열린 것처럼 표시만 해 두고 그다음(새로고침·새로 열기)을 본다.
  const PW = process.env.VFR_GATE_PW;
  if (PW) {
    await tab.fill('#gate-pw', PW); await tab.click('#gate-ok');
    await tab.click('#gate-mode-pc');                    // 비밀번호 다음 화면 고르기 — PC 모드
    const s2 = await state(tab);
    t.ok(!s2.locked && !s2.shown && s2.saved === '1', '맞는 비밀번호면 열린다');
  } else {
    await tab.evaluate(() => sessionStorage.setItem('vfrUnlocked', '1'));
  }

  await tab.reload(); await ready(tab);
  const s3 = await state(tab);
  t.ok(!s3.locked && !s3.shown, '같은 탭에서 새로고침하면 다시 묻지 않는다');
  await tab.close();

  const tab2 = await browser.newPage();
  await tab2.goto(url); await ready(tab2);
  const s4 = await state(tab2);
  t.ok(s4.locked && s4.shown, '앱을 새로 열면 다시 묻는다');
  await tab2.close();

  // 비밀번호가 맞으면 화면을 고른다 — PC 모드는 지금처럼, 3D 단독 모드는 3D Only 로 바로
  // (맞는 비밀번호 대신 검사가 lockCheck 를 '맞음' 으로 바꿔 끼운다)
  const pick = async (which) => {
    const tb = await browser.newPage();
    await tb.goto(url); await ready(tb);
    await tb.evaluate(() => { window.lockCheck = () => true; });
    await tb.fill('#gate-pw', 'x'); await tb.click('#gate-ok');
    const mid = await tb.evaluate(() => ({ locked: window.gateLocked, choose: getComputedStyle(document.getElementById('gate-mode')).display !== 'none',
                                          pwHidden: getComputedStyle(document.getElementById('gate-pw')).display === 'none' }));
    await tb.click('#gate-mode-' + which);
    await tb.waitForTimeout(1500);
    const end = await tb.evaluate(() => ({ locked: window.gateLocked, shown: getComputedStyle(document.getElementById('gate-overlay')).display !== 'none',
                                          solo: _soloActive, cur: _soloCurrent, mode: sessionStorage.getItem('vfrStartMode'),
                                          lay: !!document.querySelector('#simlay.show'), sim: simModeOn,
                                          btns: [...document.querySelectorAll('#simlay .simlay-btn')].map(b => b.dataset.scr).join(','),
                                          simple: document.body.classList.contains('simple-mode'),
                                          sbar: [...document.querySelectorAll('#simple-bar [data-scr]')].map(b => b.textContent).join(','),
                                          pfdIn: !!document.getElementById('pfd-wrap') && document.getElementById('pfd-wrap').parentElement.id }));
    await tb.reload(); await ready(tb); await tb.waitForTimeout(1500);
    end.reload = await tb.evaluate(() => ({ solo: _soloActive, cur: _soloCurrent }));
    await tb.close();
    return { mid, end };
  };
  // 절차 훈련판(js/00-edition.js — Flightsimulator)에는 SIM Mode 가 없다 — 고르기 버튼이 감춰진다
  const simEd = await page.evaluate(() => typeof SIM_ENABLED === 'undefined' || SIM_ENABLED);
  // (절차 훈련판에는 3D 단독 모드도 없다 — 고르기 버튼이 감춰진다)
  const m3 = simEd ? await pick('3d') : null, mp = await pick('pc'), ms = simEd ? await pick('sim') : null, mq = await pick('simple');
  const m0 = m3 || mp;
  t.ok(m0.mid.locked && m0.mid.choose && m0.mid.pwHidden, '비밀번호가 맞으면 화면 고르기(PC 모드 · 3D 단독 모드)가 뜨고, 고르기 전에는 열리지 않는다');
  if (simEd) {
    t.ok(!m3.end.locked && !m3.end.shown && m3.end.solo && m3.end.cur === 'm3d' && m3.end.mode === '3d',
      '3D 단독 모드를 고르면 3D Only 로 바로 열린다');
    t.ok(m3.end.reload.solo && m3.end.reload.cur === 'm3d', '같은 탭에서 새로고침해도 3D Only 로 열린다');
  } else t.ok(await page.evaluate(() => { const b = document.getElementById('gate-mode-3d'); return !b || getComputedStyle(b).display === 'none'; }),
    '절차 훈련판 — 화면 고르기에 3D 단독 모드가 없다');
  t.ok(!mp.end.locked && !mp.end.solo && mp.end.mode === 'pc' && !mp.end.lay, 'PC 모드를 고르면 지금처럼(분할) 열린다');
  if (simEd) t.ok(!ms.end.locked && ms.end.mode === 'sim' && ms.end.lay && ms.end.sim && ms.end.btns === 'pfd,m3d,map,cdu,ovhd,lcon,sysp',
    `SIM Mode 를 고르면 SIM 조종이 켜지고 창 배치판(화면마다 새 창 버튼)이 뜬다 (${ms.end.btns})`);
  else t.ok(await page.evaluate(() => { const b = document.getElementById('gate-mode-sim'); return !b || getComputedStyle(b).display === 'none'; }),
    '절차 훈련판 — 화면 고르기에 SIM Mode 가 없다');
  t.ok(!mq.end.locked && mq.end.mode === 'simple' && mq.end.simple && mq.end.sbar === 'PFD,3D,MAP,CDU,UPPER,LOWER,SYSTEM' && mq.end.pfdIn === 'simple-host',
    `Simple Mode 를 고르면 위 막대(창 이름 일곱)와 PFD 하나만 화면 가득 (${mq.end.sbar} · ${mq.end.pfdIn})`);

  // 비밀번호 글자는 앱 파일 어디에도 없다(SHA-256 값만 둔다)
  if (PW) {
    const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
    t.ok(files.every(f => !fs.readFileSync(path.join(ROOT, f), 'utf8').includes(PW)),
      '비밀번호 글자는 앱 파일에 적혀 있지 않다(SHA-256 값만)');
  }
}
