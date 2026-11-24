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
  // ── ⌂ 처음 화면 · ⟳ 새로고침 — 먼저 묻고(취소하면 그대로), 처음 화면은 비밀번호 없이 화면 · 기종 고르기 ──
  {
    const tb = await browser.newPage();
    await tb.addInitScript(() => { try { sessionStorage.setItem('vfrUnlocked', '1'); sessionStorage.setItem('vfrStartApt', '1'); } catch (e) {} });
    await tb.goto(url); await ready(tb);
    const q = await tb.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      // 병렬 부하에서는 대화상자가 200ms 안에 안 뜰 수 있다 — 정해진 시간 대신 될 때까지(최대 5초) 기다린다
      const until = async (f, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (f()) return true; } catch (e) { /* 아직 */ } await w(40); } return false; };
      const dlg = () => document.querySelector('.ui-dlg'), gone = () => !document.querySelector('.ui-dlg');
      const hb = document.getElementById('home-btn'), rb = document.getElementById('reload-btn');
      o.btns = !!hb && !!rb && hb.nextElementSibling === rb && getComputedStyle(hb).display !== 'none';
      const r3 = document.getElementById('reload3d-btn'); o.ck = !!r3 && r3.parentElement.id === 'ctl3d-body' && r3 === r3.parentElement.lastElementChild;
      window._reloaded = 0; const keep = hardReloadNow; window.hardReloadNow = () => { window._reloaded++; };
      hb.click(); o.askHome = await until(dlg);
      const cancel = [...document.querySelectorAll('.ui-dlg button')].find(b => /취소/.test(b.textContent)); if (cancel) cancel.click(); await until(gone); await w(100);
      o.cancelHome = window._reloaded === 0 && sessionStorage.getItem('vfrChooseAgain') !== '1';
      rb.click(); o.askReload = await until(() => dlg() && /새로고침/.test(dlg().textContent));
      const okb = document.querySelector('.ui-dlg .ui-dlg-ok'); if (okb) okb.click();
      o.okReload = await until(() => window._reloaded === 1); await until(gone);
      // 저장 후 새로고침 — 지금 상태를 시나리오로 남기고 새로 고친다
      const n0 = scnList().length;
      rb.click(); await until(() => document.querySelector('.ui-dlg .ui-dlg-extra'));
      const ex = document.querySelector('.ui-dlg .ui-dlg-extra'); o.extraBtn = !!ex && /저장 후 새로고침/.test(ex.textContent);
      if (ex) ex.click(); await until(() => window._reloaded === 2);
      const L = scnList(); o.saved = L.length === n0 + 1 && /^새로고침 전/.test(L[L.length - 1].name) && window._reloaded === 2;
      if (L.length > n0) scnDelete(L.length - 1);
      window.hardReloadNow = keep;
      return o;
    });
    await tb.close();
    // 처음 화면을 고르면 — 다시 열 때 비밀번호 없이 화면 · 기종 고르기(새 탭에서 — 위 확인창 검사와 섞이지 않게)
    const tb2 = await browser.newPage();
    await tb2.addInitScript(() => { try { sessionStorage.setItem('vfrUnlocked', '1'); sessionStorage.setItem('vfrStartApt', '1'); } catch (e) {} });
    await tb2.goto(url); await ready(tb2);
    // ⌂ 처음 화면 — 실제 단추 길(goStartScreen · 확인창은 '처음 화면')로. 표시는 sessionStorage 와 주소(?choose=1) 둘 다에 남는다
    //   (새로 고치기 직전에 적은 sessionStorage 는 부하가 있으면 사라질 수 있어 — 종전 이 검사가 가끔 실패한 까닭 — 주소에도 단다)
    await Promise.all([tb2.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      tb2.evaluate(() => { window.uiConfirm = () => Promise.resolve(true); goStartScreen(); }).catch(() => {})]);
    await ready(tb2);
    const gateUp = () => tb2.waitForFunction(() => window.gateLocked === true && getComputedStyle(document.getElementById('gate-mode')).display !== 'none', null, { timeout: 10000 }).catch(() => {});
    await gateUp();
    const g = await tb2.evaluate(() => ({ locked: window.gateLocked, shown: getComputedStyle(document.getElementById('gate-overlay')).display !== 'none',
      choose: getComputedStyle(document.getElementById('gate-mode')).display !== 'none', pwHidden: getComputedStyle(document.getElementById('gate-pw')).display === 'none',
      flag: sessionStorage.getItem('vfrChooseAgain'), url: /[?&]choose=1/.test(location.search) }));
    await tb2.reload(); await ready(tb2); await gateUp();   // 고르기 전에 한 번 더 새로 불러도(서비스 워커 갱신 등) 처음 화면 그대로
    g.again = await tb2.evaluate(() => window.gateLocked && getComputedStyle(document.getElementById('gate-mode')).display !== 'none');
    await tb2.evaluate(() => document.getElementById('gate-mode-pc').click());   // (병렬 부하에서 playwright 의 '보일 때까지' 기다림이 늦게 풀려 직접 누른다)
    const open = await tb2.waitForFunction(() => !window.gateLocked, null, { timeout: 8000 }).then(() => true, () => false);
    g.flagAfter = await tb2.evaluate(() => sessionStorage.getItem('vfrChooseAgain'));
    g.urlAfter = await tb2.evaluate(() => /[?&]choose=1/.test(location.search));
    // 주소의 표시만 남고 sessionStorage 가 사라진 경우(새로 고침 경합)에도 처음 화면이 뜬다 · 잠금이 안 풀린 탭에서는 주소만으로 비밀번호를 건너뛰지 않는다
    const lost = await tb2.evaluate(() => { const u = new URL(location.href); u.searchParams.set('choose', '1'); sessionStorage.removeItem('vfrChooseAgain'); return u.toString(); });
    await tb2.goto(lost); await ready(tb2); await gateUp();
    g.urlOnly = await tb2.evaluate(() => window.gateLocked && getComputedStyle(document.getElementById('gate-mode')).display !== 'none');
    const tb3 = await browser.newPage();   // 잠금이 안 풀린 새 탭 — 주소에 ?choose=1 을 붙여 열어도
    await tb3.goto(lost); await tb3.waitForFunction(() => typeof window.gateLocked === 'boolean', null, { timeout: 20000 });
    g.noBypass = await tb3.evaluate(() => (typeof APP_EDITION !== 'undefined' && APP_EDITION === 'proc') ? 'proc' : (window.gateLocked && getComputedStyle(document.getElementById('gate-pw')).display !== 'none'));
    await tb3.close();
    await tb2.close();
    t.ok(q.btns && q.ck, '창 위 탭에 ⌂ 처음 화면 · ⟳ 새로고침 · 3D(Cockpit) 버튼 줄 맨 아래에 ⟳ 새로고침');
    t.ok(q.askHome && q.cancelHome && q.askReload && q.okReload, '처음 화면 · 새로고침은 먼저 묻는다 — 취소하면 그대로 · 확인하면 새로고침');
    t.ok(q.extraBtn && q.saved, '저장 후 새로고침 — 지금 상태를 시나리오(새로고침 전 …)로 남기고 새로 고친다');
    t.ok(g.locked && g.shown && g.choose && g.pwHidden && g.flag === '1' && g.url && g.again && open && g.flagAfter === null && !g.urlAfter, `처음 화면 — 비밀번호 없이 화면 · 기종 고르기가 뜨고, 고르면 열린다(표시도 거둔다) (${JSON.stringify(g)} · ${open})`);
    t.ok(g.urlOnly && (g.noBypass === true || g.noBypass === 'proc'), `sessionStorage 표시가 사라져도 주소(?choose=1)로 처음 화면이 뜬다 · 잠기지 않은 탭은 주소만으로 비밀번호를 건너뛰지 못한다 (${g.urlOnly} · ${g.noBypass})`);
  }
  // 절차 훈련판(Flightsimulator)은 비밀번호가 없다 — 처음 열면 곧바로 화면 · 기종 고르기
  const procEd = await page.evaluate(() => typeof APP_EDITION !== 'undefined' && APP_EDITION === 'proc');
  if (procEd) {
    const tb = await browser.newPage();
    await tb.goto(url); await ready(tb);
    const s = await tb.evaluate(() => ({ locked: window.gateLocked, shown: getComputedStyle(document.getElementById('gate-overlay')).display !== 'none',
      choose: getComputedStyle(document.getElementById('gate-mode')).display !== 'none', pwHidden: getComputedStyle(document.getElementById('gate-pw')).display === 'none',
      ac: document.querySelectorAll('.gate-ac-btn').length }));
    t.ok(s.shown && s.choose && s.pwHidden && s.ac === 3, `절차 훈련판 — 비밀번호 없이 처음부터 화면 · 기종 고르기(기종 ${s.ac} — 흰수리 · Bell · R22)`);
    await tb.click('#gate-mode-pc'); await tb.waitForTimeout(500);
    const e = await tb.evaluate(() => ({ locked: window.gateLocked, shown: getComputedStyle(document.getElementById('gate-overlay')).display !== 'none', mode: sessionStorage.getItem('vfrStartMode') }));
    t.ok(!e.locked && !e.shown && e.mode === 'pc', '절차 훈련판 — 화면을 고르면 바로 열린다');
    await tb.close();
    return;
  }
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

  // 비밀번호가 맞으면 화면을 고른다 — PC 모드는 지금처럼, Cockpit Mode 는 3D 조종석으로 바로
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
                                          lbl3d: (document.querySelector('#simlay [data-scr="m3d"] b') || {}).textContent,
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
  // (3D 단독 모드는 Cockpit Mode 로 합쳤다 — 두 판 모두 Cockpit Mode 가 있다)
  const mc = await pick('cockpit'), mp = await pick('pc'), ms = simEd ? await pick('sim') : null, mq = await pick('simple');
  t.ok(mc.mid.locked && mc.mid.choose && mc.mid.pwHidden, '비밀번호가 맞으면 화면 고르기가 뜨고, 고르기 전에는 열리지 않는다');
  t.ok(!(await page.evaluate(() => !!document.getElementById('gate-mode-3d'))), '화면 고르기에 3D 단독 모드는 없다(Cockpit Mode 로 합쳤다)');
  t.ok(!mc.end.locked && !mc.end.shown && mc.end.solo && mc.end.cur === 'm3d' && mc.end.mode === 'cockpit',
    'Cockpit Mode 를 고르면 3D 조종석(3D 를 화면 가득)으로 바로 열린다');
  t.ok(mc.end.reload.solo && mc.end.reload.cur === 'm3d', '같은 탭에서 새로고침해도 Cockpit Mode 로 열린다');
  t.ok(!mp.end.locked && !mp.end.solo && mp.end.mode === 'pc' && !mp.end.lay, 'PC 모드를 고르면 지금처럼(분할) 열린다');
  if (simEd) t.ok(!ms.end.locked && ms.end.mode === 'sim' && ms.end.lay && ms.end.sim && ms.end.btns === 'pfd,m3d,map,cdu,ovhd,lcon,sysp' && ms.end.lbl3d === 'COCKPIT MODE',
    `SIM Mode 를 고르면 SIM 조종이 켜지고 창 배치판(화면마다 새 창 버튼)이 뜬다 (${ms.end.btns})`);
  else t.ok(await page.evaluate(() => { const b = document.getElementById('gate-mode-sim'); return !b || getComputedStyle(b).display === 'none'; }),
    '절차 훈련판 — 화면 고르기에 SIM Mode 가 없다');
  t.ok(!mq.end.locked && mq.end.mode === 'simple' && mq.end.simple && mq.end.sbar === 'PFD,COCKPIT,MAP,CDU,UPPER,LOWER,SYSTEM,CONTROL,Vendor' && mq.end.pfdIn === 'simple-host',
    `Simple Mode 를 고르면 위 막대(창 이름 아홉 · 흰수리는 Vendor 까지)와 PFD 하나만 화면 가득 (${mq.end.sbar} · ${mq.end.pfdIn})`);

  // 비밀번호 글자는 앱 파일 어디에도 없다(SHA-256 값만 둔다)
  if (PW) {
    const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
    t.ok(files.every(f => !fs.readFileSync(path.join(ROOT, f), 'utf8').includes(PW)),
      '비밀번호 글자는 앱 파일에 적혀 있지 않다(SHA-256 값만)');
  }
}
