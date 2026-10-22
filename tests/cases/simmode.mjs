// SIM 모드 — 조종간으로 직접 모는 길.
//
// 확인할 것은 "축을 밀면 정말로 그렇게 나는가" 와 "그 결과가 PFD·지도에 함께
// 나타나는가" 다. 실제 조이스틱이 없으므로 가짜 패드를 깔고 축 값을 손으로
// 움직인 뒤, 시뮬 루프를 프레임 단위로 돌려 상태 변화를 잰다.
export const name = 'SIM 모드';

// 가짜 패드 + 네 축 배정(0:롤 1:피치 2:요 3:컬렉티브)
const SETUP = () => {
  window._pad = {
    index: 0, id: 'SIM STICK', mapping: '',
    buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
  navigator.getGamepads = () => [window._pad];
  window._ax = (i, v) => { _pad.axes[i] = v; };
  joyStop();
  joyOn = true; joyCancelCapture(); joyAxCancelCapture();
  for (const k in _joyNeutral) delete _joyNeutral[k];
  for (const k in _joyHat) delete _joyHat[k];
  joyActiveIdx = -1;
  joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false },
              yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } };
  joyPoll(1000);                       // 중립 학습
  // 늘 같은 자리에서 시작한다
  S.lat = 37.5; S.lon = 127.0; S.hdg = 90; S.spd = 100; S.alt = 2000;
  S.bnk = 0; S.pit = 0; S.vs = 0; S.wps = []; S.awp = -1; S.fwp = -1;
  windSpd = 0; simSpeed = 1;
  if (!simModeOn) toggleSimMode();
};

// 시뮬 루프를 손으로 돌린다 — 실제 경과시간 대신 정해진 간격으로.
const FLY = `(sec) => {
  S.running = true;
  let ts = 1000; S.lastT = ts;
  const frames = Math.round(sec * 20);
  for (let i = 0; i < frames; i++) { ts += 50; joyPoll(ts); simStep(ts); }
  S.running = false;
}`;

export async function run(page, t) {
  // ── 버튼이 스톱워치 오른쪽에 있다 ──
  const btn = await page.evaluate(() => {
    selectPanel('left', 'pfd', true);
    const b = document.getElementById('sim-mode-btn');
    const sw = document.getElementById('sw-display');
    const lbl = b.closest('.ctrl-group').querySelector('.ctrl-lbl');
    const bb = b.getBoundingClientRect(), sb = sw.getBoundingClientRect();
    const was = simModeOn;
    if (simModeOn) toggleSimMode();
    const off = b.className;
    b.click();
    const on = { cls: b.className, state: simModeOn };
    toggleSimMode(false);
    if (was) toggleSimMode(true);
    return { txt: b.textContent.trim(), lbl: lbl.textContent.trim(),
             right: bb.left >= sb.right - 1, sameRow: Math.abs(bb.top - sb.top) < 60,
             off, on };
  });
  t.eq(btn.lbl, 'SIM', `버튼 위에 SIM 이름표가 있다 (${btn.lbl})`);
  t.eq(btn.right, true, '스톱워치 오른쪽에 있다');
  t.eq(btn.sameRow, true, '같은 줄이다');
  t.ok(!/\bon\b/.test(btn.off), `평소에는 꺼져 있다 (${btn.off})`);
  t.eq(btn.on.state, true, '누르면 SIM 모드가 켜진다');
  t.ok(/\bon\b/.test(btn.on.cls), `버튼도 켜진 모양이 된다 (${btn.on.cls})`);

  // ── 켜면 AFCS 를 놓는다 ── (두 곳에서 같은 축을 몰면 싸운다)
  const afcs = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    toggleSimMode(false);
    navApOn = true; hdgSelOn = true; altHoldOn = true; crhtOn = true; rollApOn = true;
    toggleSimMode(true);
    return { nav: navApOn, hdg: hdgSelOn, alt: altHoldOn, crht: crhtOn, running: S.running };
  })()`);
  t.eq(afcs.nav, false, 'NAV 가 풀린다');
  t.eq(afcs.hdg, false, 'HDG SEL 이 풀린다');
  t.eq(afcs.alt, false, 'ALT 유지가 풀린다');
  t.eq(afcs.crht, false, 'CRHT 유지도 풀린다');
  t.eq(afcs.running, true, '멈춰 있었으면 바로 날기 시작한다');

  // ── 사이클릭을 오른쪽으로 → 뱅크가 서고 오른쪽으로 돈다 ──
  const roll = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const hdg0 = S.hdg;
    _ax(0, 1);                      // 오른쪽 끝까지
    fly(6);
    const r = { bnk: S.bnk, hdg: S.hdg, turned: normAS(S.hdg - hdg0),
                lat: S.lat, lon: S.lon };
    _ax(0, 0); fly(3);              // 가운데로 되돌리면 수평
    r.level = S.bnk;
    return r;
  })()`);
  t.ok(Math.abs(roll.bnk - 45) < 2, `끝까지 밀면 45° 뱅크가 선다 (${roll.bnk.toFixed(1)}°)`);
  t.ok(roll.turned > 20, `오른쪽으로 돈다 (6초에 ${roll.turned.toFixed(0)}°)`);
  t.ok(Math.abs(roll.level) < 2, `가운데로 되돌리면 수평이 된다 (${roll.level.toFixed(1)}°)`);
  t.ok(roll.lon > 127.0, '지도상 위치도 그만큼 옮겨 간다');

  // 반대로 밀면 반대로 돈다
  const left = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const hdg0 = S.hdg;
    _ax(0, -1); fly(6);
    return { bnk: S.bnk, turned: normAS(S.hdg - hdg0) };
  })()`);
  t.ok(left.bnk < -40, `왼쪽으로 밀면 왼쪽 뱅크다 (${left.bnk.toFixed(1)}°)`);
  t.ok(left.turned < -20, `왼쪽으로 돈다 (${left.turned.toFixed(0)}°)`);

  // ── 사이클릭을 앞으로 → 기수가 내려가고 빨라진다 ──
  const pitch = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.spd = 80;
    _ax(1, 1); fly(5);              // 앞으로(+) = 기수 내림
    const fwd = { pit: S.pit, spd: S.spd };
    _ax(1, -1); fly(8);             // 뒤로 = 기수 올림 → 감속
    return { fwd, aft: { pit: S.pit, spd: S.spd } };
  })()`);
  t.ok(pitch.fwd.pit < -10, `앞으로 밀면 기수가 내려간다 (${pitch.fwd.pit.toFixed(1)}°)`);
  t.ok(pitch.fwd.spd > 82, `그러면 빨라진다 (80 → ${pitch.fwd.spd.toFixed(0)}kt)`);
  t.ok(pitch.aft.pit > 10, `뒤로 당기면 기수가 올라간다 (${pitch.aft.pit.toFixed(1)}°)`);
  t.ok(pitch.aft.spd < pitch.fwd.spd - 5,
    `그러면 느려진다 (${pitch.fwd.spd.toFixed(0)} → ${pitch.aft.spd.toFixed(0)}kt)`);

  // ── 컬렉티브 → 오르내린다 ──
  const coll = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const a0 = S.alt;
    _ax(3, 1); fly(6);
    const up = { alt: S.alt, vs: S.vs };
    _ax(3, -1); fly(10);
    return { up, gain: up.alt - a0, dn: { alt: S.alt, vs: S.vs } };
  })()`);
  t.ok(coll.gain > 60, `올리면 고도가 오른다 (6초에 +${coll.gain.toFixed(0)}ft)`);
  t.ok(coll.up.vs > 900, `상승률이 붙는다 (${coll.up.vs.toFixed(0)}fpm)`);
  t.ok(coll.dn.vs < -900, `내리면 강하한다 (${coll.dn.vs.toFixed(0)}fpm)`);
  t.ok(coll.dn.alt < coll.up.alt, '고도도 다시 내려온다');

  // ── 페달 → 기수만 돌아간다(뱅크 없이) ──
  const ped = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.spd = 0;
    const hdg0 = S.hdg;
    _ax(2, 1); fly(4);
    return { turned: normAS(S.hdg - hdg0), bnk: S.bnk };
  })()`);
  t.ok(ped.turned > 60, `페달을 밟으면 기수가 돈다 (4초에 ${ped.turned.toFixed(0)}°)`);
  t.ok(Math.abs(ped.bnk) < 1, `뱅크는 서지 않는다 (${ped.bnk.toFixed(1)}°)`);

  // ── 반전 배정도 그대로 듣는다 ──
  const inv = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes.roll.inv = true;
    _ax(0, 1); fly(4);
    return S.bnk;
  })()`);
  t.ok(inv < -30, `반전으로 잡아 두면 반대로 선다 (${inv.toFixed(1)}°)`);

  // ── PFD 와 지도가 함께 움직인다 ──
  // 같은 상태(S)를 두 화면이 읽으므로, 조종한 결과가 둘 다에 나타나야 한다.
  const both = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    if (!followMode) toggleFollow();
    const c0 = leafMap.getCenter();
    // PFD 캔버스에 그려진 뱅크 지시(ADI 회전각)를 가로채 본다
    let drawn = null;
    const proto = CanvasRenderingContext2D.prototype, orig = proto.rotate;
    _ax(0, 1); fly(5);
    proto.rotate = function (a) { if (drawn === null) drawn = a; return orig.call(this, a); };
    drawPFD();
    proto.rotate = orig;
    const c1 = leafMap.getCenter();
    if (followMode) toggleFollow();
    return { bnk: S.bnk, drawn,
             moved: Math.hypot(c1.lat - c0.lat, c1.lng - c0.lng),
             nearAc: Math.hypot(c1.lat - S.lat, c1.lng - S.lon) };
  })()`);
  t.ok(Math.abs(both.bnk) > 40, `조종한 뱅크가 상태에 들어 있다 (${both.bnk.toFixed(0)}°)`);
  t.ok(both.drawn !== null && Math.abs(both.drawn) > 0.3,
    `PFD 가 그 뱅크로 그려진다 (${both.drawn === null ? '없음' : both.drawn.toFixed(2)}rad)`);
  t.ok(both.moved > 0.002, `지도도 함께 따라 움직인다 (${both.moved.toFixed(4)}°)`);
  t.ok(both.nearAc < 0.25, `지도 중심이 항공기를 따라온다 (${both.nearAc.toFixed(3)}°)`);

  // ── 끄면 종전 방식으로 돌아온다 ──
  const off = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    _ax(0, 1); fly(4);
    toggleSimMode(false);
    _ax(0, 1);                      // 조종간을 밀어 둔 채로 꺼 본다
    fly(4);
    return { bnk: S.bnk, target: bankTarget, cls: document.getElementById('sim-mode-btn').className };
  })()`);
  t.ok(Math.abs(off.bnk) < 2, `끄면 수평으로 돌아온다 (${off.bnk.toFixed(1)}°)`);
  t.eq(off.target, 0, '뱅크 목표도 풀린다 — 조종간을 밀어 둬도 듣지 않는다');
  t.ok(!/\bon\b/.test(off.cls), '버튼도 꺼진 모양이 된다');

  // ── 축을 배정하지 않았으면 조종간이 없는 것과 같다 ──
  const none = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = {};
    _ax(0, 1); _ax(3, 1);
    const a0 = S.alt;
    fly(4);
    return { bnk: S.bnk, dAlt: S.alt - a0 };
  })()`);
  t.ok(Math.abs(none.bnk) < 1, '배정하지 않은 축은 아무 일도 하지 않는다');
  t.ok(Math.abs(none.dAlt) < 1, '고도도 그대로다');

  // ── 설정 화면에서 축을 잡는다 ──
  const bind = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = {};
    selectPanel('right', 'cdu', true);
    switchMode('JOYSTICK');
    const rows = document.querySelectorAll('[data-act="joyAxPick"]');
    const txt = document.getElementById('mainContentArea').innerText;
    rows[0].click();                       // 첫 역할(롤) 배정 대기
    const waiting = joyAxCapture;
    _ax(0, -1); joyPoll(2000);             // 그 축을 왼쪽으로 민다
    const got = joyAxes[waiting ? 'roll' : ''] || joyAxes.roll;
    _ax(0, 0); joyPoll(2050);
    switchMode('HOME');
    return { n: rows.length, waiting, i: got && got.i, inv: got && got.inv,
             cap: joyAxCapture, hasLbl: txt.includes('컬렉티브') };
  })()`);
  t.eq(bind.n, 4, `조종간 네 축을 배정할 수 있다 (${bind.n}개)`);
  t.ok(bind.hasLbl, '컬렉티브까지 목록에 있다');
  t.eq(bind.waiting, 'roll', '행을 누르면 그 역할이 입력 대기가 된다');
  t.eq(bind.i, 0, '움직인 축이 잡힌다');
  t.eq(bind.inv, true, '민 방향이 + 가 되도록 반전까지 맞춰 둔다');
  t.eq(bind.cap, null, '한 번 잡으면 대기가 풀린다');

  // 뒷정리 — 다음 검사가 SIM 모드·가짜 패드를 물려받지 않도록
  await page.evaluate(() => {
    if (simModeOn) toggleSimMode(false);
    navigator.getGamepads = () => [];
    joyAxes = {}; joyAxCancelCapture(); joyBinds = {}; joyReleaseAll();
    S.running = false; S.bnk = 0; S.pit = 0; S.vs = 0;
    try { localStorage.removeItem('joyAxes'); } catch (e) {}
  });
}
