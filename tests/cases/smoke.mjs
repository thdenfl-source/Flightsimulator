// 스모크 — 페이지 로드 오류, 주요 화면 렌더, 죽은 버튼(참조 불가 핸들러) 검출
export const name = '스모크';

import { readFileSync } from 'node:fs';
const _navSrc = readFileSync(new URL('../../js/20-navaids.js', import.meta.url), 'utf8');
const _navPart = k => (_navSrc.split('const NAVAID_' + k)[1] || '').split('];')[0];
const NAV_N = { vor: (_navPart('VOR').match(/"id":/g) || []).length, ndb: (_navPart('NDB').match(/"id":/g) || []).length, int: (_navPart('INT').match(/"id":/g) || []).length };
const APT_N = (readFileSync(new URL('../../js/04-map.js', import.meta.url), 'utf8').split('const AIRPORTS_KR')[1].split('];')[0].match(/icao:/g) || []).length;
export async function run(page, t) {
  t.eq(page.errors.length, 0, `로드 시 페이지 오류 없음${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);

  // 핵심 전역이 준비됐는가.
  // 최상위 let/const 는 window 프로퍼티가 아니지만 전역 스코프에는 있으므로,
  // 인라인 핸들러와 같은 방식(new Function)으로 확인한다.
  const globals = await page.evaluate(() => ['S', 'distance', 'bearing', 'destPoint', 'normA',
    'leafMap', 'switchMode', 'selectPanel', 'CDU_ACT']
    .filter(n => { try { return new Function('return typeof ' + n)() === 'undefined'; } catch (e) { return true; } }));
  t.eq(globals.length, 0, `핵심 전역 존재${globals.length ? ' (없음: ' + globals.join(',') + ')' : ''}`);

  // 인라인 onclick 이 부르는 함수가 전역에서 실제로 호출 가능한가
  // (CDU 캡슐화 이후 clBack 처럼 "조용히 죽은 버튼"이 생겼던 이력이 있다)
  const dead = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[onclick]').forEach(el => {
      const code = el.getAttribute('onclick') || '';
      // 점 앞에 오는 것은 메서드 호출이므로 제외한다(event.stopPropagation 등)
      [...code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].forEach(mm => {
        const fn = mm[2];
        if (['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof'].includes(fn)) return;
        // 인라인 핸들러는 전역 렉시컬 스코프(let/const 포함)에서 이름을 찾는다.
        // window[fn] 로만 보면 let 선언 함수를 죽은 것으로 오판한다.
        let ok = false;
        try { ok = new Function('return typeof ' + fn)() === 'function'; } catch (e) { ok = false; }
        if (!ok) out.push({ fn, text: (el.textContent || '').trim().slice(0, 14) });
      });
    });
    return out;
  });
  t.eq(dead.length, 0,
    `인라인 onclick 핸들러 전부 호출 가능${dead.length ? ' — 죽은 버튼: ' + dead.map(d => `${d.fn}(${d.text})`).join(', ') : ''}`);

  // data-act 이름이 전부 등록돼 있는가
  const unreg = await page.evaluate(() => {
    const names = new Set();
    document.querySelectorAll('[data-act]').forEach(el => names.add(el.dataset.act));
    const reg = n => { try { return new Function('return (typeof CDU_ACT!=="undefined"&&typeof CDU_ACT[' + JSON.stringify(n) + ']==="function")||(typeof APP_ACT!=="undefined"&&typeof APP_ACT[' + JSON.stringify(n) + ']==="function")')(); } catch (e) { return false; } };
    return [...names].filter(n => !reg(n));
  });
  t.eq(unreg.length, 0, `data-act 전부 등록됨${unreg.length ? ' (미등록: ' + unreg.join(',') + ')' : ''}`);

  // 무시된 예외 집계기가 동작하는가 + 같은 예외가 반복되지 않는가
  // (반복되면 매 프레임 던지는 실동작 문제일 가능성이 높다)
  const sw = await page.evaluate(() => {
    if (typeof _swallowSummary !== 'function') return null;
    return { top: _swallowSummary().slice(0, 3), total: _swallowed().length };
  });
  t.ok(sw !== null, '무시 예외 집계기(_swallowSummary) 존재');
  if (sw) {
    const worst = sw.top[0] ? sw.top[0][1] : 0;
    t.ok(worst < 20,
      `기동 중 같은 예외 반복 ${worst}회 (총 ${sw.total})${worst >= 20 ? ' — ' + sw.top[0][0] : ''}`);
  }

  // CDU 주요 화면이 오류 없이 렌더되는가
  await page.evaluate(() => selectPanel('right', 'cdu'));
  await page.waitForTimeout(250);
  const modes = ['HOME', 'AIRFIELD', 'CHARTS', 'UTIL', 'PERF', 'AUDIO', 'INTERCOM',
                 'XPDR_MODE', 'TRACKPOINT', 'SETTINGS', 'CHECKLIST'];
  page.errors.length = 0;
  for (const m of modes) {
    await page.evaluate(mm => { try { switchMode(mm); } catch (e) { throw e; } }, m);
    await page.waitForTimeout(90);
  }
  t.eq(page.errors.length, 0,
    `CDU ${modes.length}개 화면 렌더 오류 없음${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);

  // Back 버튼이 실제로 화면을 바꾸는가 (체크리스트 하위 → 상위)
  page.errors.length = 0;
  await page.evaluate(() => CDU_ACT.clOpen());
  await page.waitForTimeout(200);
  await page.evaluate(() => CDU_ACT.clInto(0));
  await page.waitForTimeout(200);
  const back = await page.$('#cdu-wrap .nav-btn:has-text("Back")');
  t.ok(!!back, '체크리스트 Back 버튼 존재');
  if (back) { await back.click(); await page.waitForTimeout(250); }
  const mode = await page.evaluate(() => window.currentMode);
  t.eq(mode, 'CHECKLIST', 'Back 1회 — 체크리스트 상위로 복귀');
  t.eq(page.errors.length, 0, `Back 클릭 오류 없음${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);

  await runDegenerate(page, t);
}

// 계기 캔버스가 접힌 상태(폭·높이 0)에서도 예외 없이 넘어가는가
// — 분할 전환·전체화면 직후 W·H 가 0 이 되며 ctx.arc 반지름이 음수가 되던 이력
export async function runDegenerate(page, t) {
  page.errors.length = 0;
  const thrown = await page.evaluate(() => {
    const w = cvs.width, h = cvs.height;
    const errs = [];
    for (const [W, H] of [[0, 0], [10, 10], [79, 79], [200, 40], [40, 200]]) {
      cvs.width = W; cvs.height = H;
      try { drawPFD(); } catch (e) { errs.push(`${W}x${H}: ${e.message}`); }
    }
    cvs.width = w; cvs.height = h;
    try { drawPFD(); } catch (e) { errs.push('restore: ' + e.message); }
    return errs;
  });
  t.eq(thrown.length, 0, `접힌 캔버스 5종에서 drawPFD 예외 없음${thrown.length ? ': ' + thrown.join(' | ') : ''}`);
  t.eq(page.errors.length, 0, '접힌 캔버스 렌더 중 페이지 오류 없음');

  // ── CDU 홈의 Weather 버튼 — 누르면 Windy · 저고도 날씨 · CCTV · METAR/TAF 넷이 나온다 ──
  const wx = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'cdu', true); await wait(150);
    CDU_ACT.switchMode('HOME'); await wait(80);
    const labels = () => [...document.querySelectorAll('#mainContentArea .icon-label')].map(e => e.textContent.trim());
    const title = () => document.getElementById('modeTitle').textContent.trim();
    const home = labels();
    document.querySelector('#mainContentArea [data-act="switchMode"][data-arg=\'["WEATHER"]\']').click(); await wait(80);
    const wxTitle = title(), wxLabels = labels();
    const hrefs = [...document.querySelectorAll('#mainContentArea a.home-icon-wrapper')].map(a => a.getAttribute('href'));
    document.querySelector('#mainContentArea [data-arg=\'["CCTV"]\']').click(); await wait(80);
    const cctv = title();
    [...document.querySelectorAll('#footerNav .nav-btn')].pop().click(); await wait(80);   // Back 은 늘 맨 오른쪽
    const back = title();
    CDU_ACT.switchMode('HOME'); await wait(50);
    return { home, wxTitle, wxLabels, hrefs, cctv, back };
  });
  t.eq(wx.home.join('|'),
    'MAP|AircraftSystems|PERF|Charts|Flight Plan|PROC|VNAV|WaypointInfo|NOTAM|Track &Point|Services|Utilities|SkyVector|Tideforecast|ERavailability|Wildfirestatus|Weather|Checklist',
    `CDU 홈 배열 — 4칸씩 MAP… / Flight Plan… / NOTAM… / SkyVector… / Weather · Checklist (${wx.home.join(' · ')})`);
  // Waypoint Info — 누르면 INFO, INFO 의 Back 은 Waypoint Info 로
  const wpt = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const title = () => document.getElementById('modeTitle').textContent.trim();
    CDU_ACT.switchMode('HOME'); await wait(50);
    document.querySelector('#mainContentArea [data-arg=\'["WPTINFO"]\']').click(); await wait(60);
    const t1 = title(), labels = [...document.querySelectorAll('#mainContentArea .icon-label')].map(e => e.textContent.trim());
    document.querySelector('#mainContentArea [data-arg=\'["AIRFIELD"]\']').click(); await wait(60);
    const t2 = title();
    [...document.querySelectorAll('#footerNav .nav-btn')].pop().click(); await wait(60);
    const t3 = title();
    document.querySelector('#mainContentArea [data-act="wptOpen"][data-arg=\'["wpt_vrp"]\']').click(); await wait(60);
    const t4 = title(); [...document.querySelectorAll('#footerNav .nav-btn')].pop().click(); await wait(60);
    const t5 = title();
    document.querySelector('#mainContentArea [data-act="wptOpen"][data-arg=\'["wpt_create"]\']').click(); await wait(80);
    const fpw = document.getElementById('fp-wrap');
    const add = { title: document.getElementById('fp-mode-title').textContent.trim(), shown: !!fpw && !fpw.classList.contains('page-hidden') && fpw.offsetParent !== null };
    try { fpGo('LIST'); } catch (e) {}
    // VOR · NDB 목록 — GPX 자료, 거리순 · 누르면 Flight Plan 끝에
    const keep = JSON.stringify({ wps: S.wps, awp: S.awp });
    S.wps = []; S.awp = -1; S.lat = 36.7; S.lon = 127.5;
    const nav = {};
    for (const k of ['vor', 'ndb', 'apt', 'int']) {
      CDU_ACT.switchMode('WPTINFO'); await wait(40);
      document.querySelector(`#mainContentArea [data-act="wptOpen"][data-arg='["wpt_${k}"]']`).click(); await wait(60);
      const rows = [...document.querySelectorAll('#mainContentArea .nav-row')];
      nav[k] = { title: title(), n: rows.length, first: rows[0] && rows[0].querySelector('b').textContent };
      rows[0].click(); await wait(80);
      nav[k].wp = S.wps.length && S.wps[S.wps.length - 1].ident;
      nav[k].fp = document.getElementById('fp-mode-title').textContent.trim();
    }
    const k0 = JSON.parse(keep); S.wps = k0.wps; S.awp = k0.awp; try { updateWpMarkers(); fpGo('LIST'); } catch (e) {}
    CDU_ACT.switchMode('HOME'); await wait(50);
    return { t1, labels, t2, t3, t4, t5, add, nav };
  });
  t.ok(wpt.t1 === 'Waypoint Info' && wpt.labels.join('|') === 'Airport|INT|VOR|NDB|VRP|UserWaypoint|CreateWaypoint|AirportINFO' && wpt.t2 === '비행장 정보' && wpt.t3 === 'Waypoint Info',
    `Waypoint Info → Airport·INT·VOR·NDB·VRP·User·Create·Airport INFO, Airport INFO 의 Back 은 Waypoint Info 로 (${wpt.t1} · ${wpt.labels.join(',')} · ${wpt.t2} → ${wpt.t3})`);
  t.ok(wpt.add.title === 'ADD WAYPOINT' && wpt.add.shown, `Create Waypoint 는 Flight Plan 의 ADD WAYPOINT 화면을 연다 (${wpt.add.title} · ${wpt.add.shown})`);
  t.ok(wpt.nav.vor.title === 'VOR' && wpt.nav.vor.n === NAV_N.vor && wpt.nav.vor.first === 'CHJ' && wpt.nav.vor.wp === 'CHJ',
    `VOR 목록 — ${wpt.nav.vor.n}곳, 거리순 첫째 ${wpt.nav.vor.first}(청주 근처), 누르면 Flight Plan 에 ${wpt.nav.vor.wp} (${wpt.nav.vor.fp})`);
  t.ok(wpt.nav.int.title === 'INT' && wpt.nav.int.n === NAV_N.int && wpt.nav.int.wp === wpt.nav.int.first && wpt.nav.int.first === 'VASLI',
    `INT 목록 — Fix ${wpt.nav.int.n}곳, 거리순 첫째 ${wpt.nav.int.first}(청주 근처), 누르면 Flight Plan 에 ${wpt.nav.int.wp}`);
  t.ok(wpt.nav.apt.title === 'Airport' && wpt.nav.apt.n === APT_N && wpt.nav.apt.first === 'RKTU' && wpt.nav.apt.wp === 'RKTU',
    `Airport 목록 — ICAO 비행장 ${wpt.nav.apt.n}곳, 거리순 첫째 ${wpt.nav.apt.first}(청주), 누르면 Flight Plan 에 ${wpt.nav.apt.wp}`);
  t.ok(wpt.nav.ndb.title === 'NDB' && wpt.nav.ndb.n === NAV_N.ndb && wpt.nav.ndb.wp === wpt.nav.ndb.first,
    `NDB 목록 — ${wpt.nav.ndb.n}곳, 첫째 ${wpt.nav.ndb.first} 를 누르면 Flight Plan 에 ${wpt.nav.ndb.wp}`);
  t.ok(wpt.t4 === 'VRP' && wpt.t5 === 'Waypoint Info', `VRP 등은 제 화면(준비 중) · Back 은 Waypoint Info 로 (${wpt.t4} → ${wpt.t5})`);
  t.ok(!wx.home.some(l => /Windy|CCTV|METAR/.test(l)), '날씨 버튼 넷은 홈에서 Weather 안으로 들어갔다');
  t.ok(wx.wxTitle === 'Weather' && wx.wxLabels.join('|') === 'Windy|저고도날씨|CCTV|METAR/TAF',
    `Weather 를 누르면 넷이 나온다 (${wx.wxTitle}: ${wx.wxLabels.join(' · ')})`);
  t.ok(wx.hrefs.some(h => /windy\.com/.test(h)) && wx.hrefs.some(h => /lamis/.test(h)) && wx.hrefs.some(h => /metar/.test(h)),
    'Windy · 저고도 날씨 · METAR/TAF 는 종전 사이트로 열린다');
  t.ok(wx.cctv === 'CCTV' && wx.back === 'Weather', `CCTV 가 열리고 Back 은 Weather 로 돌아온다 (${wx.cctv} → ${wx.back})`);

  // ── CDU 홈의 Aircraft Systems — 누르면 사진처럼 계통 버튼 열한 개(위 두 줄 · 아래 한 줄), 각각 제 화면(준비 중) · Back 은 Aircraft Systems 로 ──
  const sys = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    selectPanel('right', 'cdu', true); await wait(150);
    CDU_ACT.switchMode('HOME'); await wait(80);
    const labels = () => [...document.querySelectorAll('#mainContentArea .icon-label')].map(e => e.textContent.trim());
    const title = () => document.getElementById('modeTitle').textContent.trim();
    const home = labels();
    document.querySelector('#mainContentArea [data-act="switchMode"][data-arg=\'["ACSYS"]\']').click(); await wait(80);
    const sTitle = title(), sLabels = [...document.querySelectorAll('#mainContentArea [data-act="acSysOpen"]')].map(e => [...e.children].filter(c => !c.querySelector('svg')).map(c => c.textContent).join('').replace(/\s+/g, ''));
    const grids = [...document.querySelectorAll('#mainContentArea .acsys-grid')].map(g => g.children.length);
    const pages = [];
    for (const el of [...document.querySelectorAll('#mainContentArea [data-act="acSysOpen"]')].map(e => e.dataset.arg)) {
      CDU_ACT.switchMode('ACSYS'); await wait(30);
      document.querySelector(`#mainContentArea [data-act="acSysOpen"][data-arg='${el}']`).click(); await wait(30);
      pages.push(title());
    }
    [...document.querySelectorAll('#footerNav .nav-btn')].pop().click(); await wait(80);   // Back
    const back = title();
    CDU_ACT.switchMode('HOME'); await wait(50);
    return { home, sTitle, sLabels, pages, back, grids };
  });
  t.eq(sys.home[1], 'AircraftSystems', `CDU 홈 둘째 버튼이 Aircraft Systems 다 (${sys.home.slice(0, 3).join(' · ')})`);
  t.ok(sys.sTitle === 'Aircraft Systems' &&
       sys.sLabels.join('|') === 'AFCS|AircraftStatus|Electrical|Engines|Fuel|RASelfTestAllow|HOCAS|SystemTests|LightingConfig|Video|Maintenance',
    `누르면 계통 버튼 열한 개 (${sys.sLabels.join(' · ')})`);
  t.ok(sys.grids.join(',') === '8,4', `사진의 자리 — 위 두 줄 4칸(빈칸 하나) · 아래 한 줄 4칸 (${sys.grids.join(',')})`);
  t.ok(sys.pages.join('|') === 'AFCS|Aircraft Status|Electrical|Engines|Fuel|RA Self Test|HOCAS|System Tests|Lighting Config|Video|Maintenance',
    `각 버튼이 제 화면을 연다 (${sys.pages.join(' · ')})`);
  t.eq(sys.back, 'Aircraft Systems', '계통 화면의 Back 은 Aircraft Systems 로 돌아온다');
}
