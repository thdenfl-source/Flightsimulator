// 테스트용 오프라인 사본 생성
// index.html 은 CDN(Leaflet·pdf.js 등)을 참조하므로 그대로는 오프라인에서 뜨지 않는다.
// CDN 태그를 걷어내고 로컬 Leaflet 을 주입한 사본을 tmp 에 만든다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');

// Leaflet 위치 탐색: LEAFLET_DIR → node_modules → 실패 시 안내
export function findLeaflet() {
  const cands = [
    process.env.LEAFLET_DIR,
    path.join(ROOT, 'node_modules', 'leaflet', 'dist'),
    path.join(process.cwd(), 'node_modules', 'leaflet', 'dist'),
    '/tmp/node_modules/leaflet/dist',
  ].filter(Boolean);
  for (const d of cands) {
    if (fs.existsSync(path.join(d, 'leaflet.js')) && fs.existsSync(path.join(d, 'leaflet.css'))) return d;
  }
  return null;
}

export function buildEnv() {
  const leaflet = findLeaflet();
  if (!leaflet) {
    throw new Error(
      'Leaflet 을 찾지 못했습니다.\n' +
      '  npm i leaflet@1.9.4   (또는 LEAFLET_DIR=<leaflet/dist 경로>)');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfrsim-test-'));
  fs.copyFileSync(path.join(leaflet, 'leaflet.js'), path.join(dir, 'leaflet.js'));
  fs.copyFileSync(path.join(leaflet, 'leaflet.css'), path.join(dir, 'leaflet.css'));

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<link[^>]*https:\/\/[^>]*>/g, '');
  html = html.replace(/<script[^>]*src="https:\/\/[^"]*"[^>]*>\s*<\/script>/g, '');
  html = html.replace('</head>',
    '<link rel="stylesheet" href="leaflet.css"><script src="leaflet.js"></script></head>');
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html);
  return { dir, file, url: 'file://' + file };
}

// 페이지를 띄우고 도움말 오버레이를 닫은 상태로 반환
export async function openApp(browser, { cdu = false } = {}) {
  const { url } = buildEnv();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.errors = errors;
  await page.goto(url);
  // 최상위 let/const 는 window 프로퍼티가 아니므로 식별자로 직접 확인한다
  await page.waitForFunction(
    () => typeof S === 'object' && S !== null && typeof distance === 'function' && typeof leafMap === 'object',
    null, { timeout: 20000 });
  await page.getByText('시작하기').click().catch(() => {});
  await page.waitForTimeout(200);
  if (cdu) { await page.evaluate(() => selectPanel('right', 'cdu')); await page.waitForTimeout(300); }
  return page;
}
