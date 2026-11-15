#!/usr/bin/env node
// shinesong → Flightsimulator 복사 — 두 저장소는 같은 앱 파일이다(CLAUDE.md '두 저장소는 같은 코드다').
//   node tools/sync-fs.mjs ../flightsimulator           → 다른 파일만 복사 · shinesong 에 없는 파일은 지운다
//   node tools/sync-fs.mjs ../flightsimulator --dry     → 무엇이 바뀔지만 보인다
// 그 저장소 것을 그대로 두는 것: .git · .github · .nojekyll · .gitignore · CLAUDE.md · node_modules · package-lock.json
import fs from 'node:fs';
import path from 'node:path';
const SRC = process.cwd(), DST = path.resolve(process.argv[2] || '../flightsimulator'), DRY = process.argv.includes('--dry');
const KEEP = new Set(['.git', '.github', '.nojekyll', '.gitignore', 'CLAUDE.md', 'node_modules', 'package-lock.json']);
if (!fs.existsSync(path.join(DST, '.git'))) { console.error('대상이 git 저장소가 아닙니다: ' + DST); process.exit(1); }
const walk = (root, rel = '') => fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap(d => {
  const r = path.join(rel, d.name);
  if (!rel && KEEP.has(d.name)) return [];
  return d.isDirectory() ? walk(root, r) : [r];
});
const same = (a, b) => { try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch (e) { return false; } };
const src = walk(SRC), srcSet = new Set(src);
let copied = 0, deleted = 0;
for (const r of src) {
  const a = path.join(SRC, r), b = path.join(DST, r);
  if (same(a, b)) continue;
  copied++; console.log('  복사 ' + r);
  if (!DRY) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); }
}
for (const r of walk(DST)) if (!srcSet.has(r)) { deleted++; console.log('  지움 ' + r); if (!DRY) fs.unlinkSync(path.join(DST, r)); }
console.log(`${DRY ? '(미리보기) ' : ''}복사 ${copied} · 지움 ${deleted} → ${DST}`);
