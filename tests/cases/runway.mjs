// 활주로 평탄화 — 지도의 ICAO 공항 활주로 면을 공항표고로 편다(04-map.js rwyFlatM · data/runways.js).
// 3D 지형 타일 · SIM 의 땅 · 전파고도가 같은 규칙을 쓴다.
import { pngOf } from './map3d.mjs';

export const name = '활주로 평탄화';

// 들쑥날쑥한 지형 — 30m 언저리에서 칸마다 0~8m 씩 다르다(terrarium 부호)
const BUMPY = (x, y) => 30 + ((x * 7 + y * 13) % 9);
const enc = m => { const v = m + 32768, vi = Math.floor(v); return [vi >> 8, vi & 255, Math.round((v - vi) * 256)]; };

export async function run(page, t) {
  await page.route('**/elevation-tiles-prod/terrarium/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: pngOf(256, 256, (x, y) => enc(BUMPY(x, y))) }));

  // ── 자료 — 지도의 ICAO 공항마다 공항표고와 활주로(없으면 기준점 둘레) ──
  const data = await page.evaluate(() => ({
    apts: AIRPORTS_KR.map(a => a.icao),
    have: RUNWAYS.map(r => r.apt),
    elevOk: RUNWAYS.every(r => Number.isFinite(r.elev)),
    rwys: RUNWAYS.reduce((n, r) => n + (r.rwys ? r.rwys.length : 0), 0),
    disks: RUNWAYS.filter(r => r.disk).map(r => r.apt),
    // 활주로 양끝이 그 공항 기준점에서 5km 안에 있다(자료가 엉뚱한 곳을 가리키지 않는다)
    near: RUNWAYS.every(r => !r.rwys || r.rwys.every(w => {
      const a = AIRPORTS_KR.find(x => x.icao === r.apt);
      return distance(a.lat, a.lon, w.a[0], w.a[1]) < 2.7 && distance(a.lat, a.lon, w.b[0], w.b[1]) < 2.7;
    })),
  }));
  t.ok(data.apts.every(a => data.have.includes(a)) && data.elevOk,
    `지도의 ICAO 공항 ${data.apts.length}곳 모두 공항표고가 있다 (활주로 ${data.rwys}개 · 기준점 둘레만 ${data.disks.join('·') || '없음'})`);
  t.ok(data.near, '활주로 양끝은 모두 그 공항 기준점 5km 안에 있다');

  // ── 어디를 얼마나 펴는가 ──
  const at = await page.evaluate(() => {
    const ap = RUNWAYS.find(r => r.apt === 'RKSS'), r = ap.rwys[0];
    const mid = [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2];
    const end = [r.a[0] + (r.a[0] - r.b[0]) * 0.01, r.a[1] + (r.a[1] - r.b[1]) * 0.01];   // 끝 너머 약 35m
    const off = destPoint(mid[0], mid[1], 0, 1.5);                                     // 2.8km 밖
    const f = p => rwyFlatAt(p[0], p[1]);
    // 옆으로 비켜 가며 — 활주로 안은 다(1), 밖으로 갈수록 줄어 150m 너머는 그대로(0)
    // (김포는 나란한 활주로가 옆에 있어 활주로가 하나인 군산에서 잰다)
    const one = RUNWAYS.find(x => x.apt === 'RKJK').rwys[0];
    const m1 = [(one.a[0] + one.b[0]) / 2, (one.a[1] + one.b[1]) / 2];
    const brg = (bearing(one.a[0], one.a[1], one.b[0], one.b[1]) + 90) % 360;
    const side = [0, 80, 150, 250, 400].map(m => { const p = destPoint(m1[0], m1[1], brg, m / 1852); const v = f(p); return v ? +v.w.toFixed(3) : 0; });
    return { elevFt: ap.elev, mid: f(mid), end: f(end), off: f(off), side };
  });
  t.ok(at.mid && at.mid.w === 1 && Math.abs(at.mid.elevM - at.elevFt * 0.3048) < 1e-9,
    `김포 활주로 가운데는 공항표고(${at.elevFt}ft)로 편다`);
  t.ok(at.end && at.end.w === 1, '활주로 끝 너머(오버런)도 편다');
  t.ok(at.side[0] === 1 && at.side[1] < 1 && at.side[1] > at.side[2] && at.side[3] === 0 && at.side[4] === 0 && !at.off,
    `옆으로 벗어나면 부드럽게 원래 땅으로 잇는다 (0·80·150·250·400m → ${at.side.join(' · ')})`);

  // ── SIM 의 땅 · 전파고도 ──
  const gnd = await page.evaluate(() => {
    const ap = RUNWAYS.find(r => r.apt === 'RKSS'), r = ap.rwys[0];
    const mid = [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2];
    const was = window._tcElev;
    window._tcElev = (la, lo) => 30 + 6 * Math.sin(la * 4000) * Math.cos(lo * 4000);   // 들쑥날쑥(m)
    const pts = [0, 0.2, 0.4, 0.6, 0.8].map(k => [r.a[0] + (r.b[0] - r.a[0]) * (0.1 + k), r.a[1] + (r.b[1] - r.a[1]) * (0.1 + k)]);
    const run = pts.map(p => simTerrainFt(p[0], p[1]));
    const ra = terrainFtAt(mid[0], mid[1]);
    const far = destPoint(mid[0], mid[1], 0, 2);
    const raw = (30 + 6 * Math.sin(far[0] * 4000) * Math.cos(far[1] * 4000)) / 0.3048;
    const off = simTerrainFt(far[0], far[1]);
    window._tcElev = was;
    return { elevFt: ap.elev, run, ra, off, raw };
  });
  t.ok(gnd.run.every(v => Math.abs(v - gnd.elevFt) < 1e-6),
    `SIM 의 땅 — 활주로를 따라 어디서나 공항표고다 (${gnd.run.map(v => v.toFixed(1)).join(' · ')}ft)`);
  t.ok(Math.abs(gnd.ra - gnd.elevFt) < 1e-6, `전파고도도 활주로 위에서는 공항표고에서 잰다 (${gnd.ra.toFixed(1)}ft)`);
  t.ok(Math.abs(gnd.off - gnd.raw) < 1e-6, '활주로에서 먼 곳의 땅은 그대로다');

  // ── 3D 지형 타일 — 활주로 칸은 공항표고, 먼 칸은 받은 그대로 ──
  const tile = await page.evaluate(async () => {
    const ap = RUNWAYS.find(r => r.apt === 'RKSS'), r = ap.rwys[0];
    const mid = [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2];
    const z = 14, n = 1 << z;
    const xf = (mid[1] + 180) / 360 * n, latR = mid[0] * Math.PI / 180;
    const yf = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
    const x = Math.floor(xf), y = Math.floor(yf);
    const buf = await _demTile(z, x, y);
    const bmp = await createImageBitmap(new Blob([buf]), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, 256, 256).data;
    const m = (px, py) => { const i = (py * 256 + px) * 4; return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768; };
    const px = Math.floor((xf - x) * 256), py = Math.floor((yf - y) * 256);
    // 활주로 가운데 둘레 3×3 칸 · 타일 모서리(활주로에서 먼 칸)
    const center = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) center.push(m(px + dx, py + dy));
    const corners = [[0, 0], [255, 0], [0, 255], [255, 255]].map(([cx, cy]) => {
      const lon = (x + (cx + 0.5) / 256) / n * 360 - 180;
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + (cy + 0.5) / 256) / n))) * 180 / Math.PI;
      return { v: m(cx, cy), raw: 30 + ((cx * 7 + cy * 13) % 9), flat: rwyFlatAt(lat, lon) };
    });
    return { elevM: ap.elev * 0.3048, center, corners };
  });
  t.ok(tile.center.every(v => Math.abs(v - tile.elevM) < 0.01),
    `3D 지형 — 활주로 칸은 들쑥날쑥하지 않고 공항표고(${tile.elevM.toFixed(1)}m)로 평평하다 (${[...new Set(tile.center.map(v => v.toFixed(2)))].join(' · ')}m)`);
  const far = tile.corners.filter(c => !c.flat);
  t.ok(far.length > 0 && far.every(c => Math.abs(c.v - c.raw) < 0.01),
    `활주로에서 먼 칸은 받은 지형 그대로다 (${far.map(c => c.v.toFixed(0)).join(' · ')}m)`);
}
