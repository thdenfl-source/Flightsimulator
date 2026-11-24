#!/usr/bin/env node
// 캐시 번호 올리기 — sw.js 의 CACHE(vfr-flight-vNNN)와 index.html 의 스크립트 꼬리표(?v=NNN)를 같은 번호로 함께 올린다.
//   node tools/bump-cache.mjs        → 하나 올림
//   node tools/bump-cache.mjs 700    → 그 번호로
// (tests/check-swver.mjs 가 둘이 다르면 실패시킨다)
import fs from 'node:fs';
const sw = fs.readFileSync('sw.js', 'utf8'), html = fs.readFileSync('index.html', 'utf8');
const cur = +((sw.match(/vfr-flight-v(\d+)/) || [])[1]);
if (!cur) { console.error('sw.js 에서 CACHE 번호를 찾지 못했습니다'); process.exit(1); }
const next = process.argv[2] ? +process.argv[2] : cur + 1;
fs.writeFileSync('sw.js', sw.replace(/vfr-flight-v\d+/, 'vfr-flight-v' + next));
const n = (html.match(/\.js\?v=\d+"/g) || []).length;
fs.writeFileSync('index.html', html.replace(/\.js\?v=\d+"/g, `.js?v=${next}"`));
console.log(`캐시 v${cur} → v${next} (index.html 스크립트 ${n}개)`);
