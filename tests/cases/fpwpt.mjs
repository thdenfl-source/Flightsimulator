// 웨이포인트 상세 화면 — 목록에서 항목을 누르면 열리는 카드.
//
// 종전에는 항목을 누르면 곧바로 활성 웨이포인트가 됐다(되돌릴 방법 없음).
// 이제 카드가 열리고, 활성 지정(Direct To)·이름·좌표·VNAV·HOLD 를 거기서 고른다.
// VNAV 는 숫자만 저장하면 반쪽이다 — 실제 강하 계산이 그 값을 쓰는지까지 본다.
export const name = '웨이포인트 상세';

export async function run(page, t) {
  const setup = () => page.evaluate(() => {
    S.wps = []; S.awp = -1; S.fwp = -1; S.brg2wp = -1;
    pushWP({ ident: 'WP1', lat: 37.5, lon: 127.0 });
    pushWP({ ident: 'WP2', lat: 37.8, lon: 127.6 });
    S.awp = 0; fpWptIdx = -1; fpEditIdx = -1;
    fpGo('LIST');
  });
  await setup();

  // ── 니들 정보 바가 없어졌는가 ──
  // PFD 와 CDU 양쪽에 같은 BRG/CRS/DTW 를 적고 있었다.
  const gone = await page.evaluate(() => ({
    box: !!document.querySelector('.fp-nav-box'),
    cell: !!document.getElementById('nav-brg1'),
    fn: typeof renderNavBox,
  }));
  t.ok(!gone.box && !gone.cell, 'CDU 하단 니들 정보 바가 없다');
  t.eq(gone.fn, 'undefined', '그리던 함수도 남아 있지 않다');

  // ── 항목을 누르면 상세가 열린다(곧바로 활성이 되지 않는다) ──
  const open = await page.evaluate(() => {
    const before = S.awp;
    document.querySelectorAll('.fp-wp-row')[1].click();
    return { before, after: S.awp, mode: fpMode, idx: fpWptIdx,
             title: document.getElementById('fp-mode-title').textContent,
             body: document.getElementById('fp-content-area').textContent };
  });
  t.eq(open.mode, 'WPT', '목록의 항목을 누르면 상세 화면이 열린다');
  t.eq(open.after, open.before, '누르는 것만으로 활성 웨이포인트가 바뀌지는 않는다');
  t.ok(/WP2/.test(open.title) && /Direct To WP2/.test(open.body),
    `그 지점의 카드가 열린다 (${open.title})`);
  t.ok(/VNAV 고도/.test(open.body) && /레그 코스/.test(open.body) && /HOLD/.test(open.body),
    '이름·좌표·VNAV·레그 코스·HOLD 가 한 화면에 있다');

  // ── Direct To ──
  const direct = await page.evaluate(() => {
    document.querySelector('[data-act="fpWptDirect"]').click();
    const awp = S.awp, mode = fpMode;
    fpWptOpen(1);
    return { awp, mode, body: document.getElementById('fp-content-area').textContent };
  });
  t.eq(direct.awp, 1, 'Direct To 를 누르면 그 지점이 활성이 된다');
  t.eq(direct.mode, 'LIST', '누르고 나면 목록으로 돌아온다');
  t.ok(/활성 — WP2/.test(direct.body), '이미 활성이면 버튼이 그렇게 알려 준다');

  // ── VNAV 고도·오프셋 ──
  const vnav = await page.evaluate(() => {
    const type = (act, txt) => {
      document.querySelector(`[data-act="fpWptNum"][data-arg='["${act}"]']`).click();
      const m = fpMode;
      String(txt).split('').forEach(c => fpType(c));
      fpConfirmWptNum();
      return m;
    };
    const m1 = type('VALT', 2500);
    const m2 = type('VOFS', 3);
    return { m1, m2, alt: S.wps[1].vnavAlt, ofs: S.wps[1].vnavOfs, active: vnavActive,
             shown: document.getElementById('fp-content-area').textContent };
  });
  t.ok(vnav.m1 === 'WPTNUM' && vnav.m2 === 'WPTNUM', 'VNAV 칸을 누르면 숫자 입력 화면이 열린다');
  t.ok(vnav.alt === 2500 && vnav.ofs === 3, `VNAV 고도·오프셋이 들어간다 (${vnav.alt}ft / ${vnav.ofs}NM)`);
  t.eq(vnav.active, true, 'VNAV 고도를 넣으면 VNAV 가 걸린다');
  t.ok(/2,500 FT/.test(vnav.shown) && /3\.0 NM/.test(vnav.shown), '넣은 값이 카드에 보인다');

  // 강하 계산이 이 값을 실제로 쓰는가 — 저장만 하고 안 쓰면 숫자 장식이다
  const calc = await page.evaluate(() => {
    S.lat = 37.8; S.lon = 126.0; S.alt = 6000; S.spd = 120; windSpd = 0;
    // WP1 → WP2 레그를 나는 중으로 놓는다(fwp 가 awp 와 같으면 코스선이 한 점이 된다)
    S.fwp = 0; S.awp = 1; obsOn = false; navSrc = 'FMS';
    updateNav(); vnavAngle = -3; vnavActive = true;
    const d0 = distance(S.lat, S.lon, S.wps[1].lat, S.wps[1].lon);
    const withOfs = vnavCalc();
    delete S.wps[1].vnavOfs;
    const noOfs = vnavCalc();
    delete S.wps[1].vnavAlt;
    const noAlt = vnavCalc();
    S.wps[1].vnavAlt = 2500; S.wps[1].vnavOfs = 3;
    return { d0, withOfs, noOfs, noAlt, globalTgt: vnavTgtAlt };
  });
  t.eq(calc.withOfs.tgtAlt, 2500, '웨이포인트 VNAV 고도가 강하 타깃이 된다');
  t.ok(Math.abs((calc.noOfs.d - calc.withOfs.d) - 3) < 0.05,
    `오프셋만큼 목표 지점이 앞당겨진다 (${(calc.noOfs.d - calc.withOfs.d).toFixed(2)}NM)`);
  t.eq(calc.noAlt.tgtAlt, calc.globalTgt,
    '웨이포인트 고도를 지우면 UTIL 의 전역 VNAV 값으로 돌아간다');

  // 비우고 ENTER = 해제. 0 으로 남기면 "해면으로 강하" 가 되어 위험하다.
  const clear = await page.evaluate(() => {
    fpWptOpen(1);
    fpWptNum('VALT'); fpInputBuf = ''; fpConfirmWptNum();
    return { has: 'vnavAlt' in S.wps[1], txt: document.getElementById('fp-content-area').textContent };
  });
  t.eq(clear.has, false, '비우고 ENTER 하면 VNAV 고도가 해제된다(0 으로 남지 않는다)');

  // ── 이름·좌표 고치기 ──
  const edit = await page.evaluate(() => {
    fpWptOpen(1);
    document.querySelector('[data-act="fpWptRename"]').click();
    const m1 = fpMode;
    fpInputBuf = 'ALPHA'; fpConfirmIdent();
    const named = S.wps[1].ident, back1 = fpMode;
    document.querySelector('[data-act="fpWptCoord"]').click();
    const m2 = fpMode;
    fpInputBuf = '38.0'; fpConfirmCoord('LAT');
    fpInputBuf = '128.0'; fpConfirmCoord('LON');
    return { m1, m2, named, back1, lat: S.wps[1].lat, lon: S.wps[1].lon, back2: fpMode,
             n: S.wps.length };
  });
  t.ok(edit.m1 === 'IDENT' && edit.named === 'ALPHA' && edit.back1 === 'WPT',
    `이름을 고치면 그 지점의 이름만 바뀐다 (${edit.named})`);
  t.ok(edit.m2 === 'LAT' && edit.lat === 38 && edit.lon === 128 && edit.back2 === 'WPT',
    `좌표를 고치면 그 지점이 옮겨간다 (${edit.lat}, ${edit.lon})`);
  t.eq(edit.n, 2, '고치기가 새 웨이포인트를 만들지 않는다');

  // ── BRG2 지정 · 삭제 ──
  const rest = await page.evaluate(async () => {
    fpWptOpen(1);
    document.querySelector('[data-act="fpWptBrg2"]').click();
    const b2 = S.brg2wp;
    fpWptOpen(1);
    const p = fpWptDel();                       // 확인 다이얼로그가 뜬다
    await new Promise(r => setTimeout(r, 60));
    const asked = !!document.querySelector('.ui-dlg');
    [...document.querySelectorAll('.ui-dlg-btns button, .ui-dlg-btns .ui-dlg-ok')]
      .find(b => b.textContent.trim() === '삭제')?.click();
    await p;
    return { b2, asked, n: S.wps.length, mode: fpMode };
  });
  t.eq(rest.b2, 1, 'BRG2 지시침을 그 지점으로 지정한다');
  t.eq(rest.asked, true, '삭제는 되묻고 나서 지운다');
  t.ok(rest.n === 1 && rest.mode === 'LIST', `지우면 목록으로 돌아온다 (남은 ${rest.n}개)`);

  // ── 입력 방법을 먼저 고른다 ──
  // 값을 넣는 화면으로 곧장 들어가는 대신, 네 가지 방법을 먼저 보여 준다.
  const add = await page.evaluate(() => {
    S.wps = []; S.awp = -1; S.brg2wp = -1;
    fpGo('ADD');
    const txt = document.getElementById('fp-content-area').textContent;
    const go = sel => { fpGo('ADD'); document.querySelector(sel).click(); return fpMode; };
    const r = {
      shown: ['LAT/LON', 'RAD/DIS', 'RAD/RAD', 'P.POS'].filter(m => txt.includes(m)),
      latlon: go(`[data-act="fpGo"][data-arg='["LAT"]']`),
      raddis: go(`[data-act="fpRefOpen"][data-arg='["RB"]']`),
      radrad: go(`[data-act="fpRefOpen"][data-arg='["RR"]']`),
    };
    S.lat = 37.1; S.lon = 127.2;
    r.ppos = go(`[data-act="fpAddPP"]`);
    r.wp = S.wps[0] && { id: S.wps[0].ident, lat: +S.wps[0].lat.toFixed(4), lon: +S.wps[0].lon.toFixed(4) };
    r.idx = fpWptIdx;
    fpGo('ADD');
    document.querySelector('[data-act="fpAddPreset"]').click();
    r.preset = S.wps[S.wps.length - 1].ident;
    return r;
  });
  t.eq(add.shown.join(','), 'LAT/LON,RAD/DIS,RAD/RAD,P.POS', '네 가지 입력 방법이 먼저 보인다');
  t.eq(add.latlon, 'LAT', 'LAT/LON → 좌표 입력');
  t.eq(add.raddis, 'RB', 'RAD/DIS → 기준점·방위·거리');
  t.eq(add.radrad, 'RR', 'RAD/RAD → 두 방위의 교점');
  t.ok(add.wp && add.wp.id === 'PP1' && add.wp.lat === 37.1 && add.wp.lon === 127.2,
    `P.POS 는 지금 있는 자리로 만든다 (${add.wp && add.wp.id})`);
  t.ok(add.ppos === 'WPT' && add.idx === 0,
    'P.POS 로 만들면 바로 그 지점의 상세 카드가 열린다(이름을 다듬으라고)');
  t.eq(add.preset, 'RKSI', '공항 프리셋도 그대로 동작한다');
}
