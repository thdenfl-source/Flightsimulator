// 인앱 다이얼로그 — 브라우저 기본 alert/confirm/prompt 를 대체한 uiAlert/uiConfirm/uiPrompt.
// 기본 모달은 시뮬레이션 루프를 통째로 멈추기 때문에 전부 걷어냈다. 여기서는
// (1) 소스에 기본 모달이 다시 새어들지 않는지, (2) 대체 구현이 실제로
// 확인/취소/Esc/Enter 를 옳게 돌려주는지 확인한다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';

export const name = '인앱 다이얼로그';

export async function run(page, t) {
  // ── 정적: 기본 모달 호출이 남아 있지 않은가 ──
  // `.prompt(` 처럼 메서드 호출은 제외한다(PWA 설치 배너 _deferredPrompt.prompt()).
  const RE = /(?<![A-Za-z0-9_.$])(alert|confirm|prompt)\s*\(/g;
  const leftovers = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;   // 설명 주석은 봐준다
      for (const m of line.matchAll(RE)) leftovers.push(`${f}:${i + 1} ${m[1]}`);
    });
  }
  t.eq(leftovers.length, 0,
    `기본 alert/confirm/prompt 호출 없음${leftovers.length ? ' (' + leftovers.slice(0, 5).join(', ') + ')' : ''}`);

  // 기본 모달이 뜨면 테스트가 멈추므로, 떠 버리면 즉시 잡아낸다.
  let nativeDialog = null;
  page.on('dialog', d => { nativeDialog = d.type(); d.dismiss().catch(() => {}); });

  // ── 동적: 확인 다이얼로그 ──
  const clickBtn = async (label) => {
    await page.waitForSelector('.ui-dlg', { timeout: 3000 });
    await page.locator('.ui-dlg-btns button', { hasText: label }).click();
  };

  let p = page.evaluate(() => uiConfirm('테스트 물음'));
  await clickBtn('확인');
  t.eq(await p, true, 'uiConfirm 확인 → true');

  p = page.evaluate(() => uiConfirm('테스트 물음'));
  await clickBtn('취소');
  t.eq(await p, false, 'uiConfirm 취소 → false');

  // Esc = 취소
  p = page.evaluate(() => uiConfirm('테스트 물음'));
  await page.waitForSelector('.ui-dlg');
  await page.keyboard.press('Escape');
  t.eq(await p, false, 'uiConfirm Esc → false');

  // 버튼 문구는 호출부가 바꿀 수 있다
  p = page.evaluate(() => uiConfirm('삭제할까요?', { okText: '삭제', cancelText: '그만' }));
  await clickBtn('삭제');
  t.eq(await p, true, 'okText/cancelText 반영');

  // ── 입력 다이얼로그 ──
  p = page.evaluate(() => uiPrompt('이름', '기본값'));
  await page.waitForSelector('.ui-dlg-in');
  t.eq(await page.inputValue('.ui-dlg-in'), '기본값', 'uiPrompt 기본값이 채워짐');
  await page.fill('.ui-dlg-in', 'RKSI');
  await page.keyboard.press('Enter');                     // Enter = 확인
  t.eq(await p, 'RKSI', 'uiPrompt Enter → 입력값');

  p = page.evaluate(() => uiPrompt('이름', 'x'));
  await page.waitForSelector('.ui-dlg-in');
  await page.keyboard.press('Escape');
  t.eq(await p, null, 'uiPrompt Esc → null');

  // 숫자/비밀 옵션
  p = page.evaluate(() => uiPrompt('고도', 3000, { numeric: true }));
  await page.waitForSelector('.ui-dlg-in');
  t.eq(await page.getAttribute('.ui-dlg-in', 'inputmode'), 'decimal', 'numeric → 숫자 키패드');
  await page.keyboard.press('Escape'); await p;

  p = page.evaluate(() => uiPrompt('코드', '', { password: true }));
  await page.waitForSelector('.ui-dlg-in');
  t.eq(await page.getAttribute('.ui-dlg-in', 'type'), 'password', 'password → 가려진 입력');
  await page.keyboard.press('Escape'); await p;

  // ── 알림 ──
  p = page.evaluate(() => uiAlert('알림'));
  await page.waitForSelector('.ui-dlg');
  t.eq(await page.locator('.ui-dlg-btns button').count(), 1, 'uiAlert 는 버튼이 하나');
  await clickBtn('확인');
  await p;
  t.eq(await page.locator('.ui-dlg').count(), 0, '닫으면 DOM 에서 사라짐');

  // ── 겹쳐 띄우면 줄을 선다(뒤에 있는 화면이 클릭에 새지 않게) ──
  const both = page.evaluate(async () => {
    const a = uiConfirm('첫째'), b = uiConfirm('둘째');
    return [await a, await b];
  });
  await page.waitForSelector('.ui-dlg');
  t.eq(await page.locator('.ui-dlg').count(), 1, '동시에 뜨는 다이얼로그는 하나뿐');
  await clickBtn('확인');
  await page.waitForTimeout(50);
  await clickBtn('취소');
  t.eq(JSON.stringify(await both), '[true,false]', '줄 선 순서대로 각자의 답을 받음');

  // ── 토스트 ──
  await page.evaluate(() => uiToast('저장했습니다'));
  t.eq(await page.locator('.ui-toast').count(), 1, 'uiToast 표시');

  // ── 시뮬레이션이 멈추지 않는가 ──
  // 기본 모달이었다면 여기서 시각이 정지한다.
  p = page.evaluate(() => uiConfirm('비행 중'));
  await page.waitForSelector('.ui-dlg');
  const frames = await page.evaluate(() => new Promise(res => {
    let n = 0;
    const t0 = performance.now();
    (function tick() {
      n++;
      if (performance.now() - t0 < 400) requestAnimationFrame(tick); else res(n);
    })();
  }));
  t.ok(frames > 5, `다이얼로그가 떠 있어도 렌더 루프가 계속 돈다 (400ms 동안 ${frames}프레임)`);
  await clickBtn('취소'); await p;

  t.eq(nativeDialog, null, `브라우저 기본 모달이 뜨지 않음${nativeDialog ? ' (' + nativeDialog + ')' : ''}`);
}
