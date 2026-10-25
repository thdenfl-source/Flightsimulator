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
  for (const k in _joyNoHat) delete _joyNoHat[k];
  for (const k in _joyOdd) delete _joyOdd[k];
  joyActiveIdx = -1;
  joyAxSaved = true;
  joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false },
              yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } };
  joyPoll(1000);                       // 중립 학습
  // 늘 같은 자리에서 시작한다
  S.lat = 37.5; S.lon = 127.0; S.hdg = 90; S.spd = 100; S.alt = 2000;
  S.bnk = 0; S.pit = 0; S.vs = 0; S.tq = 60; S.wps = []; S.awp = -1; S.fwp = -1;
  _simGndFt = 0;                       // 지형 캐시도 비운다(검사끼리 물려받지 않게)
  windSpd = 0; simSpeed = 1;
  if (!simModeOn) toggleSimMode();
  S.tq = 60; S.vs = 0; S.alt = 2000;   // 모드 진입이 손댄 값을 되돌린다
  simAcc = 0; _simVs1 = 0;             // 가감속·유입류 지연도 비운다
  simLookHold(false); simLookReset(); simTrimReset();
};

// 시뮬 루프를 손으로 돌린다 — 실제 경과시간 대신 정해진 간격으로.
const FLY = `(sec) => {
  S.running = true;
  let ts = 1000; S.lastT = ts;
  const frames = Math.round(sec * 20);
  for (let i = 0; i < frames; i++) { ts += 50; joyPoll(ts); simStep(ts); }
  S.running = false;
}`;

// 자세 값을 그대로 쓰기 위한 작은 도우미(읽기 쉬우라고 둔다)
const trimSpdPit = (p) => p;
const hoverSide = (v) => Math.abs(v);
const known2 = (v) => !!v;
const normAS0 = (d) => ((d % 360) + 540) % 360 - 180;

export async function run(page, t) {
  // ── 버튼이 스톱워치 오른쪽에 있다 ──
  const btn = await page.evaluate(async () => {
    selectPanel('left', 'pfd', true);
    const b = document.getElementById('sim-mode-btn');
    const sw = document.getElementById('sw-display');
    const lbl = b.closest('.ctrl-group').querySelector('.ctrl-lbl');
    const bb = b.getBoundingClientRect(), sb = sw.getBoundingClientRect();
    const was = simModeOn;
    if (simModeOn) toggleSimMode();
    const off = b.className;
    b.click();
    await new Promise(r => setTimeout(r, 40));   // 다이얼로그는 한 박자 뒤에 뜬다
    const res = { txt: b.textContent.trim(), lbl: lbl.textContent.trim(),
             right: bb.left >= sb.right - 1, sameRow: Math.abs(bb.top - sb.top) < 60,
             off, was, dlg: !!document.querySelector('.ui-dlg'),
             asks: (document.querySelector('.ui-dlg-msg') || {}).textContent,
             btns: [...document.querySelectorAll('.ui-dlg-btns button')].map(x => x.textContent) };
    // 물음을 닫아 둔다(다음 검사가 가려지지 않게)
    const cancel = document.querySelector('.ui-dlg-btns button');
    if (cancel) cancel.click();
    await new Promise(r => setTimeout(r, 40));
    if (simModeOn) toggleSimMode(false);
    return res;
  });
  t.eq(btn.lbl, 'SIM', `버튼 위에 SIM 이름표가 있다 (${btn.lbl})`);
  t.eq(btn.right, true, '스톱워치 오른쪽에 있다');
  t.eq(btn.sameRow, true, '같은 줄이다');
  t.ok(!/\bon\b/.test(btn.off), `평소에는 꺼져 있다 (${btn.off})`);
  // 누르면 바로 켜지는 게 아니라 '어디서 시작할지' 를 먼저 묻는다
  t.eq(btn.dlg, true, '누르면 시작 지점을 묻는다');
  t.ok((btn.asks || '').includes('어디서'), `무엇을 묻는지 분명하다 (${btn.asks})`);
  t.ok(btn.btns.some(x => x.includes('지상')) && btn.btns.some(x => x.includes('공중')),
    `지상·공중 중에 고른다 (${btn.btns.join(' / ')})`);

  // 지상을 고르면 0ft·정지, 공중을 고르면 날던 고도 그대로
  const start = await page.evaluate(async () => {
    const pick = async (txt) => {
      if (simModeOn) toggleSimMode(false);
      S.alt = 2500; S.spd = 90; S.vs = 300; S.tq = 70;
      document.getElementById('sim-mode-btn').click();
      await new Promise(r => setTimeout(r, 30));
      const b = [...document.querySelectorAll('.ui-dlg-btns button')]
        .find(x => x.textContent.includes(txt));
      b.click();
      await new Promise(r => setTimeout(r, 60));
      return { alt: S.alt, spd: S.spd, vs: S.vs, tq: S.tq, on: simModeOn,
               cls: document.getElementById('sim-mode-btn').className };
    };
    const ground = await pick('지상');
    const air = await pick('공중');
    // 거의 땅에 있는데 '공중' 을 고르면 띄워 준다
    if (simModeOn) toggleSimMode(false);
    S.alt = 0;
    document.getElementById('sim-mode-btn').click();
    await new Promise(r => setTimeout(r, 30));
    [...document.querySelectorAll('.ui-dlg-btns button')]
      .find(x => x.textContent.includes('공중')).click();
    await new Promise(r => setTimeout(r, 60));
    const lifted = S.alt;
    if (simModeOn) toggleSimMode(false);
    return { ground, air, lifted };
  });
  t.eq(start.ground.on, true, '지상을 고르면 SIM 모드가 켜진다');
  t.ok(/\bon\b/.test(start.ground.cls), '버튼도 켜진 모양이 된다');
  t.ok(start.ground.alt < 20, `지상은 0ft 에서 시작한다 (${start.ground.alt.toFixed(0)}ft)`);
  t.ok(start.ground.spd < 5, `속도도 0 이다 (${start.ground.spd.toFixed(0)}kt)`);
  t.ok(start.ground.tq < 15, `토크도 내려 둔다 — 레버를 올리며 뜬다 (${start.ground.tq.toFixed(0)}%)`);
  t.ok(Math.abs(start.air.alt - 2500) < 20,
    `공중은 날던 고도 그대로다 (${start.air.alt.toFixed(0)}ft)`);
  t.ok(Math.abs(start.lifted - 500) < 30,
    `땅에 붙어 있는데 공중을 고르면 띄워 준다 (${start.lifted.toFixed(0)}ft)`);

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

  // ── 자세 하나가 곧 속도다 ──
  // 고도를 지키며 날 때: 수평 120kt · 기수 4° 80kt · 7.5° 45kt (1° = 10kt).
  // 실제 기재의 자세-속도 관계다. 조종간을 잡아 자세를 만들고 멎는 속도를 잰다.
  const trimSpd = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.alt = 3000; _simGndFt = 0;
    // 고도를 지키도록 토크는 필요한 만큼만 자동으로 걸리게 둔다(컬렉티브 미배정)
    joyAxes = { pitch: { i: 1, inv: false } };
    // 조종간은 중립 근처 8% 를 죽은 구간으로 두고 나머지를 폈다 — 그 역을 쓴다
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    const hold = (deg) => {
      // 그 자세가 되도록 조종간을 잡는다(앞으로 밀면 기수가 내려간다)
      _ax(1, stick(-deg / 60));
      // 속도는 이제 천천히(≈3.5kt/s 한계) 붙는다 — 앞 자세에서 95kt 를 건너뛰려면
      // 30초가 넘게 걸린다. 여기서는 '그 자세의 정상 속도' 를 보므로 15kt 떨어진
      // 자리에서 출발해 수렴하는지를 본다(점진성은 아래에서 따로 잰다).
      S.spd = Math.max(-40, Math.min(160, spdFromPitch(deg) + 15)); simAcc = 0;
      fly(25);
      return { pit: S.pit, spd: S.spd, vs: S.vs };
    };
    const level = hold(0);
    const four  = hold(4);
    const seven = hold(7.5);
    const down  = hold(-10);                    // 기수 내림 10° → 140kt
    const max   = hold(-60);                    // 끝까지 숙여도 자세는 60° 까지
    return { level, four, seven, down, max,
             law: [spdFromPitch(0), spdFromPitch(4), spdFromPitch(7.5), spdFromPitch(-10)],
             inv: [pitchFromSpd(120), pitchFromSpd(80), pitchFromSpd(45), pitchFromSpd(140)] };
  })()`);
  t.eq(trimSpd.law.join('/'), '120/80/45/140',
    `자세-속도 식이 기재와 같다 (0°→${trimSpd.law[0]} · 4°→${trimSpd.law[1]} · ` +
    `7.5°→${trimSpd.law[2]} · −10°→${trimSpd.law[3]}kt)`);
  t.ok(Math.abs(trimSpd.inv[0]) < 0.01 && Math.abs(trimSpd.inv[1] - 4) < 0.01
       && Math.abs(trimSpd.inv[2] - 7.5) < 0.01 && Math.abs(trimSpd.inv[3] + 10) < 0.01,
    `거꾸로도 같다 (120kt→${trimSpd.inv[0].toFixed(1)}° · 80kt→${trimSpd.inv[1].toFixed(1)}° · 45kt→${trimSpd.inv[2].toFixed(1)}°)`);
  t.ok(Math.abs(trimSpd.level.pit) < 0.6 && Math.abs(trimSpd.level.spd - 120) < 8,
    `수평 자세로 날면 120kt 에서 멎는다 (${trimSpd.level.pit.toFixed(1)}° · ${trimSpd.level.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.four.pit - 4) < 0.6 && Math.abs(trimSpd.four.spd - 80) < 8,
    `기수 4° 면 80kt 다 (${trimSpd.four.pit.toFixed(1)}° · ${trimSpd.four.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.seven.pit - 7.5) < 0.6 && Math.abs(trimSpd.seven.spd - 45) < 8,
    `기수 7.5° 면 45kt 다 (${trimSpd.seven.pit.toFixed(1)}° · ${trimSpd.seven.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.down.pit + 10) < 0.6 && Math.abs(trimSpd.down.spd - 140) < 8,
    `기수를 10° 숙이면 140kt 다 (${trimSpd.down.pit.toFixed(1)}° · ${trimSpd.down.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.max.pit + 60) < 1.5,
    `위아래 60° 까지 잡힌다 (${trimSpd.max.pit.toFixed(1)}°)`);
  t.ok(Math.abs(trimSpd.level.vs) < 150 && Math.abs(trimSpd.four.vs) < 150,
    `그동안 고도는 지킨다 (${trimSpd.level.vs.toFixed(0)} · ${trimSpd.four.vs.toFixed(0)}fpm)`);

  // ── 위치에너지 ↔ 운동에너지 ──
  // 기수를 숙인 채 컬렉티브를 내리면 고도가 빠지면서 속도가 붙고,
  // 반대로 올리면 고도를 얻는 대신 속도를 내준다. 같은 자세에서 재 본다.
  const energy = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.alt = 4000; _simGndFt = 0;
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    // 1단계: 레버 없이(자동 트림) 고도를 지키게 둔다 — 그 자세의 속도로 멎는다
    joyAxes = { pitch: { i: 1, inv: false } };
    _ax(1, stick(10 / 60));                 // 기수 10° 아래(하방)
    fly(30);
    const trim = { pit: S.pit, spd: S.spd, vs: S.vs, alt: S.alt, tq: S.tq };
    // 2단계: 같은 자세에서 레버를 쥐고 내린다
    joyAxes.coll = { i: 3, inv: false, abs: true };
    const lever = (tq) => _ax(3, Math.max(-1, Math.min(1, tq / 110 * 2 - 1)));
    lever(trim.tq - 20);
    fly(25);
    const sink = { pit: S.pit, spd: S.spd, vs: S.vs, alt: S.alt };
    lever(trim.tq + 20);                    // 이번에는 올린다
    fly(25);
    const climb = { pit: S.pit, spd: S.spd, vs: S.vs };
    return { trim, sink, climb };
  })()`);
  t.ok(Math.abs(trimSpdPit(energy.trim.pit) + 10) < 1.5,
    `기수를 10° 숙인 채로 잡아 둔다 (${energy.trim.pit.toFixed(1)}°)`);
  t.ok(Math.abs(energy.trim.spd - 140) < 10 && Math.abs(energy.trim.vs) < 200,
    `그 자세·고도유지에서 140kt 다 (${energy.trim.spd.toFixed(0)}kt · ${energy.trim.vs.toFixed(0)}fpm)`);
  t.ok(energy.sink.vs < -300 && energy.sink.alt < energy.trim.alt,
    `레버를 내리면 고도가 빠진다 (${energy.sink.vs.toFixed(0)}fpm)`);
  t.ok(energy.sink.spd > energy.trim.spd + 5,
    `그만큼 속도가 붙는다 — 위치에너지가 운동에너지로 (${energy.trim.spd.toFixed(0)} → ${energy.sink.spd.toFixed(0)}kt)`);
  t.ok(energy.climb.vs > 120 && energy.climb.spd < energy.sink.spd - 10,
    `반대로 올리면 고도를 얻고 속도를 내준다 (${energy.climb.vs.toFixed(0)}fpm · ${energy.climb.spd.toFixed(0)}kt)`);

  // ── 저속에서는 뱅크가 '옆걸음' 이 된다 ──
  // 헬기는 제자리에서 기울이면 선회하지 않고 옆으로 간다. 속도가 붙으면
  // 그 성분이 사라지고 보통의 선회가 된다. 기수와 실제 이동 방향으로 가른다.
  const side = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false } };
    S.alt = 1000; _simGndFt = 0;

    // ① 제자리(0kt)에서 오른쪽으로 기울인다
    S.hdg = 90; S.spd = 0; simLat = 0; S.bnk = 0;
    _ax(1, stick(-12 / 60));                  // 기수를 들어 속도를 0 근처로 눌러 둔다
    _ax(0, 1);
    fly(8);                                   // 자세·속도가 자리잡을 때까지
    const p0 = [S.lat, S.lon], h0 = S.hdg;
    fly(12);
    const hover = { lat: simLat, bnk: S.bnk, dHdg: normAS(S.hdg - h0),
                    moveBrg: toMag(bearing(p0[0], p0[1], S.lat, S.lon)),
                    hdgM: toMag(S.hdg), spd: S.spd,
                    moved: distance(p0[0], p0[1], S.lat, S.lon) };

    // ② 순항(120kt)에서는 그대로 선회한다
    (${SETUP.toString()})();
    joyAxes = { roll: { i: 0, inv: false } };
    S.alt = 1000; _simGndFt = 0; S.hdg = 90; S.spd = 120; simLat = 0;
    _ax(0, 1);
    const h1 = S.hdg;
    fly(12);
    const cruise = { lat: simLat, dHdg: normAS(S.hdg - h1), spd: S.spd };
    return { hover, cruise, frac: [simTurnFrac()] };
  })()`);
  t.ok(hoverSide(side.hover.lat) > 15,
    `제자리에서 기울이면 옆방향 속도가 붙는다 (${side.hover.lat.toFixed(0)}kt)`);
  t.ok(Math.abs(side.hover.dHdg) < 12,
    `그동안 기수는 거의 그대로다 (${side.hover.dHdg.toFixed(0)}°)`);
  t.ok(side.hover.moved > 0.02,
    `실제로 자리를 옮긴다 (${side.hover.moved.toFixed(2)}NM)`);
  t.ok(Math.abs(((side.hover.moveBrg - side.hover.hdgM - 90 + 540) % 360) - 180) < 25,
    `간 방향은 기수의 오른쪽 옆이다 (이동 ${side.hover.moveBrg.toFixed(0)}°M · 기수 ${side.hover.hdgM.toFixed(0)}°M)`);
  t.ok(Math.abs(side.cruise.lat) < 6,
    `순항에서는 옆걸음이 사라진다 (${side.cruise.lat.toFixed(1)}kt)`);
  t.ok(side.cruise.dHdg > 60,
    `그때는 뱅크가 그대로 선회가 된다 (${side.cruise.dHdg.toFixed(0)}°)`);

  // ── 뒤로도 난다 ──
  // 헬기는 후방 비행을 한다. 기수를 들고 있으면 뒤로 가속되어야 하고,
  // 그 속도로 실제로 뒷걸음질해야 한다(지도상 위치가 기수 반대쪽으로 간다).
  const back = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.spd = 0; S.hdg = 90; S.alt = 2000;          // 동쪽을 보고 제자리
    const lon0 = S.lon;
    _ax(1, -1); fly(25);                          // 끝까지 당겨 둔다
    const r = { spd: S.spd, lon: S.lon, pit: S.pit };
    fly(20);                                      // 더 당겨도 한계에서 멈춘다
    r.limit = S.spd;
    _ax(1, 0); fly(15);                           // 놓으면 항력으로 되돌아온다
    r.idle = S.spd;
    r.wentBack = S.lon < lon0;
    return r;
  })()`);
  t.ok(back.spd < -20, `기수를 들면 뒤로 간다 (${back.spd.toFixed(0)}kt)`);
  t.ok(back.limit >= -41 && back.limit <= -35,
    `뒤로는 40kt 가 한계다 (${back.limit.toFixed(0)}kt)`);
  t.eq(back.wentBack, true, '지도상 위치도 기수 반대쪽으로 간다');
  t.ok(back.idle > back.limit + 2,
    `놓으면 항력으로 멈춰 간다 (${back.limit.toFixed(0)} → ${back.idle.toFixed(0)}kt)`);

  // ── 발밑을 모를 때 묵은 값을 땅으로 믿지 않는다 ──
  // 지형 타일이 아직 안 온 자리에서 예전 값(예: 산 위 1,000ft)을 땅으로 믿으면,
  // 공중에 있는데도 땅에 닿은 줄 알고 속도를 0 으로 눌러 버린다
  // — '기수를 숙여도 가속되지 않는' 증상이 그것이다.
  const stale = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const real = window._tcElev;
    window._tcElev = () => 305;                 // 산 위(1,000ft)를 한 번 읽어 둔다
    simTerrainFt();
    const known = { ft: _simGndFt, fresh: _simGndFresh, gnd: simGroundFt() };
    window._tcElev = () => null;                // 다른 자리로 옮겨 아직 모르는 상태
    simTerrainFt();
    const unknown = { ft: _simGndFt, fresh: _simGndFresh, gnd: simGroundFt() };
    // 그 상태에서 기수를 숙이면 제대로 가속돼야 한다
    joyAxes = { pitch: { i: 1, inv: false } };
    S.alt = 500; S.spd = 40; S.vs = 0;
    _ax(1, 0.3);                                 // 기수를 숙인다
    fly(15);
    const flown = { spd: S.spd, pit: S.pit };
    window._tcElev = real;
    return { known, unknown, flown };
  })()`);
  t.eq(known2(stale.known.fresh), true, '발밑을 읽으면 그 값을 쓴다');
  t.ok(Math.abs(stale.known.gnd - 1000) < 5, `산 위에서는 1,000ft 가 바닥이다 (${stale.known.gnd.toFixed(0)}ft)`);
  t.eq(stale.unknown.fresh, false, '모르는 자리로 가면 그렇다고 표시한다');
  t.eq(stale.unknown.gnd, 0, '그때는 묵은 값을 땅으로 믿지 않는다(해수면만 바닥)');
  t.ok(stale.flown.pit < -2 && stale.flown.spd > 60,
    `그 상태에서 기수를 숙이면 제대로 가속된다 (${stale.flown.pit.toFixed(1)}° · 40 → ${stale.flown.spd.toFixed(0)}kt)`);

  // ── 바닥은 해수면이 아니라 '발밑의 지면' 이다 ──
  // 0 ft 로 시작한다는 것은 AGL 0 — 지형 표고를 모르면 땅속에서 시작하거나
  // 공중에 떠서 시작해 3D 그림이 깨진다.
  const gnd = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    // 지형 자료가 있는 것처럼 꾸민다(검사 중에는 타일을 받지 않는다)
    const real = window._tcElev;
    window._tcElev = () => 305;                   // 1,000ft 쯤 되는 산 위
    const g = simTerrainFt();
    S.alt = g; S.vs = 0; S.tq = 0;
    _ax(3, -1); fly(8);                           // 레버를 바닥까지 내려도
    const onGnd = { alt: S.alt, vs: S.vs, gndFt: g };
    _ax(3, 1); fly(12);                           // 올리면 지면 위로 뜬다(상승률은 천천히 붙는다)
    const lifted = S.alt;
    window._tcElev = real;
    return { onGnd, lifted };
  })()`);
  t.ok(Math.abs(gnd.onGnd.gndFt - 1000) < 5,
    `지형 표고를 피트로 읽는다 (305m → ${gnd.onGnd.gndFt.toFixed(0)}ft)`);
  t.ok(Math.abs(gnd.onGnd.alt - gnd.onGnd.gndFt) < 2,
    `지면 아래로 꺼지지 않는다 (${gnd.onGnd.alt.toFixed(0)}ft · 지면 ${gnd.onGnd.gndFt.toFixed(0)}ft)`);
  t.eq(gnd.onGnd.vs, 0, '땅에 닿아 있으면 강하율도 0 이다');
  t.ok(gnd.lifted > gnd.onGnd.gndFt + 50,
    `레버를 올리면 지면 위로 뜬다 (${gnd.lifted.toFixed(0)}ft)`);

  // ── 컬렉티브 → 토크 → 오르내린다 ──
  // 컬렉티브는 '상승률 레버' 가 아니라 '출력 레버' 다. 올린 만큼 토크가 오르고,
  // 지금 필요한 토크보다 남는 만큼이 상승률이 된다.
  const coll = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const a0 = S.alt, tq0 = S.tq;
    _ax(3, 1); fly(6);
    const up = { alt: S.alt, vs: S.vs, tq: S.tq };
    _ax(3, -1); fly(10);
    return { tq0, up, gain: up.alt - a0, dn: { alt: S.alt, vs: S.vs, tq: S.tq } };
  })()`);
  t.ok(coll.up.tq > coll.tq0 + 20,
    `올리면 토크가 오른다 (${coll.tq0.toFixed(0)}% → ${coll.up.tq.toFixed(0)}%)`);
  t.ok(coll.gain > 60, `그만큼 고도가 오른다 (6초에 +${coll.gain.toFixed(0)}ft)`);
  t.ok(coll.up.vs > 900, `상승률이 붙는다 (${coll.up.vs.toFixed(0)}fpm)`);
  t.ok(coll.dn.tq < coll.tq0 - 20, `내리면 토크가 내려간다 (${coll.dn.tq.toFixed(0)}%)`);
  t.ok(coll.dn.vs < -900, `그러면 강하한다 (${coll.dn.vs.toFixed(0)}fpm)`);
  t.ok(coll.dn.alt < coll.up.alt, '고도도 다시 내려온다');

  // ── 기준 토크는 CDU PERF 자료에서 온다 ──
  // 호버에 필요한 토크는 고도·온도·중량에 따라 달라진다. 그 값을 PERF 화면이
  // 뽑아 주므로, 계기의 기준선(HOV)과 비행 모델이 같은 값을 써야 한다.
  const perf = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const read = () => { const p = perfHoverTq(); return { oge: p.oge, ige: p.ige, wt: p.wt }; };
    S.bnk = 0; S.spd = 0; S.alt = 5000; _simGndFt = 0;     // 지면효과 밖(OGE)
    const light = { perf: read(), need: tqRequired(), hov: hoverTqRef() };
    // 무겁게 하면 더 든다 — CDU 화면에서 실제로 쳐 넣는다
    const typeWeight = (txt) => {
      selectPanel('right', 'cdu', true);
      switchMode('PERF_INPUT', 'weight');
      // 한 글자 누를 때마다 화면을 다시 그리므로, 누를 때마다 다시 찾아야 한다
      [...txt].forEach(c => {
        const k = [...document.querySelectorAll('#cdu-wrap [data-act=\"addInput\"]')]
          .find(b => JSON.parse(b.dataset.arg || '[]')[0] === c);
        if (k) k.click();
      });
      document.querySelector('#cdu-wrap [data-act=\"confirmPerfInput\"]').click();
    };
    typeWeight('19000');
    const heavy = { perf: read(), need: tqRequired() };
    // 지면 가까이에서는 지면효과로 덜 든다
    S.alt = 5; _simGndFt = 0;
    const ige = { hov: hoverTqRef() };
    S.alt = 5000;
    const oge = { hov: hoverTqRef() };
    typeWeight('16000');          // 되돌려 놓는다
    switchMode('HOME');
    return { light, heavy, ige, oge };
  })()`);
  t.ok(perf.light.perf.oge > 40 && perf.light.perf.oge < 110,
    `PERF 가 호버 토크를 준다 (OGE ${perf.light.perf.oge}%)`);
  t.ok(perf.light.perf.ige < perf.light.perf.oge,
    `지면효과 안이 밖보다 덜 든다 (IGE ${perf.light.perf.ige}% < OGE ${perf.light.perf.oge}%)`);
  t.ok(Math.abs(perf.light.need - perf.light.perf.oge) < 1,
    `제자리·수평에서 필요 토크 = PERF 의 OGE (${perf.light.need.toFixed(1)}%)`);
  t.ok(perf.heavy.perf.wt === 19000 && perf.heavy.need > perf.light.need + 2,
    `무거우면 더 든다 (16,000lb ${perf.light.need.toFixed(1)}% → 19,000lb ${perf.heavy.need.toFixed(1)}%)`);
  t.ok(perf.ige.hov < perf.oge.hov - 1,
    `땅 가까이에서는 기준 토크가 내려간다 (${perf.ige.hov.toFixed(1)}% · 공중 ${perf.oge.hov.toFixed(1)}%)`);

  // ── 기준보다 높으면 상승, 낮으면 강하 ──
  // 상승률은 PERF 의 상승·강하 토크표를 그대로 되짚어 정한다.
  const law = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.bnk = 0; S.spd = 120; S.alt = 3000; _simGndFt = 0;
    // 레버식 컬렉티브로 토크를 정확히 지정한다(0…110% 가 축 -1…1)
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    // 속도가 변하면 전진 양력 때문에 기준 토크도 변한다 — 120kt 로 안정시켜 둔다
    _ax(3, 0); fly(20);
    S.alt = 3000;
    const need = tqRequired();
    const run = (tq) => {
      _ax(3, Math.max(-1, Math.min(1, tq / 110 * 2 - 1)));
      S.vs = 0; _simVs1 = 0; S.alt = 3000; fly(10);
      return S.vs;
    };
    const same = run(need);
    const up   = run(need + 12.2);                 // 표에서 +500fpm 인 값(16,000lb)
    const dn   = run(need - 11.0);                 // 표에서 -500fpm 인 값
    const big  = run(need + 24.8);                 // +1,000fpm
    return { need, same, up, dn, big,
             tbl: [perfTqForVs(500), perfTqForVs(1000), perfTqForVs(-500)],
             inv: [perfVsForTq(12.2), perfVsForTq(-11.0)] };
  })()`);
  t.ok(Math.abs(law.same) < 60, `기준과 같으면 고도를 지킨다 (${law.same.toFixed(0)}fpm)`);
  // 120kt 는 Vy 에서 멀어 상승 효율이 절반쯤이다(강하는 효율과 무관하다)
  t.ok(law.up > 150, `기준보다 높으면 상승한다 (+12.2% → ${law.up.toFixed(0)}fpm · Vy 효율 반영)`);
  t.ok(law.dn < -350, `낮으면 강하한다 (−11.0% → ${law.dn.toFixed(0)}fpm)`);
  t.ok(law.big > law.up + 150, `더 올리면 더 빨리 오른다 (+24.8% → ${law.big.toFixed(0)}fpm)`);
  t.ok(Math.abs(law.tbl[0] - 12.2) < 0.2 && Math.abs(law.tbl[1] - 24.8) < 0.2,
    `상승 토크는 PERF 표 그대로다 (500fpm ${law.tbl[0].toFixed(1)}% · 1,000fpm ${law.tbl[1].toFixed(1)}%)`);
  t.ok(Math.abs(law.tbl[2] + 11.0) < 0.2, `강하 쪽도 표 그대로다 (−500fpm ${law.tbl[2].toFixed(1)}%)`);
  t.ok(Math.abs(law.inv[0] - 500) < 15 && Math.abs(law.inv[1] + 500) < 15,
    `토크 → 상승률 되짚기도 맞는다 (${law.inv[0].toFixed(0)} · ${law.inv[1].toFixed(0)}fpm)`);

  // ── Vy 에서 가장 잘 오른다 ──
  // 같은 토크라도 최대상승속도(Vy)에서 상승률이 가장 크고, 그보다 빠르거나
  // 느려질수록 떨어진다. PERF 의 Vy 를 그대로 쓴다.
  const vy = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.bnk = 0; S.alt = 4000; _simGndFt = 0;
    const V = perfVy();
    const at = (kt) => { S.spd = kt; return simClimbEff(); };
    const eff = { hover: at(0), slow: at(V - 30), best: at(V), fast: at(V + 30),
                  cruise: at(140) };
    // 실제로 날려서도 확인한다 — 같은 여유 토크, 다른 속도.
    // 속도는 자세로 잡아 둔다(자세를 안 잡으면 120kt 로 흘러간다).
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    const run = (kt) => {
      joyAxes = { pitch: { i: 1, inv: false } };      // 레버는 자동 트림(고도 유지)
      _ax(1, stick(-pitchFromSpd(kt) / 60));
      S.spd = kt; S.alt = 4000; S.vs = 0;
      fly(20);                                        // 그 속도로 자리잡을 때까지
      const settled = S.spd;
      joyAxes.coll = { i: 3, inv: false, abs: true }; // 이제 레버를 쥐고 25% 더 준다
      _ax(3, Math.max(-1, Math.min(1, (tqRequired() + 25) / 110 * 2 - 1)));
      S.alt = 4000; fly(10);
      return { vs: S.vs, spd: settled };
    };
    const flewBest = run(V), flewHover = run(0);
    return { V, eff, flewBest, flewHover };
  })()`);
  t.ok(vy.V > 40 && vy.V < 110, `PERF 가 Vy 를 준다 (${vy.V.toFixed(0)}kt)`);
  t.ok(Math.abs(vy.eff.best - 1) < 0.01, `Vy 에서 상승 효율이 가장 높다 (${vy.eff.best.toFixed(2)})`);
  t.ok(vy.eff.slow < 0.95 && vy.eff.fast < 0.95,
    `그보다 느리거나 빠르면 떨어진다 (−30kt ${vy.eff.slow.toFixed(2)} · +30kt ${vy.eff.fast.toFixed(2)})`);
  t.ok(Math.abs(vy.eff.slow - vy.eff.fast) < 0.01, '양쪽으로 고르게 떨어진다');
  t.ok(vy.eff.hover >= 0.3 && vy.eff.hover < vy.eff.slow,
    `제자리에서는 가장 낮다 (${vy.eff.hover.toFixed(2)})`);
  t.ok(vy.flewBest.vs > vy.flewHover.vs + 150,
    `같은 여유 토크라도 Vy 에서 더 잘 오른다 ` +
    `(${vy.flewHover.spd.toFixed(0)}kt ${vy.flewHover.vs.toFixed(0)}fpm → ` +
    `${vy.flewBest.spd.toFixed(0)}kt ${vy.flewBest.vs.toFixed(0)}fpm)`);

  // ── 같은 레버라도 선회를 걸면 가라앉는다 ──
  // 뱅크를 주면 양력이 기울어 필요 토크가 오른다. 컬렉티브를 그대로 두면
  // 남는 토크가 줄어 상승률이 떨어진다 — 헬기에서 늘 겪는 일이다.
  const bankSink = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    _ax(3, 0.25); fly(5);                 // 적당히 올려 상승 중
    const level = { vs: S.vs, need: tqRequired(), tq: S.tq };
    _ax(0, 1); fly(5);                    // 레버는 그대로 두고 선회만 건다
    return { level, turn: { vs: S.vs, need: tqRequired(), tq: S.tq, bnk: S.bnk } };
  })()`);
  t.ok(bankSink.turn.need > bankSink.level.need + 3,
    `선회를 걸면 필요 토크가 오른다 (${bankSink.level.need.toFixed(0)}% → ${bankSink.turn.need.toFixed(0)}%)`);
  t.ok(Math.abs(bankSink.turn.tq - bankSink.level.tq) < 2,
    '컬렉티브는 그대로다(레버를 움직이지 않았다)');
  t.ok(bankSink.turn.vs < bankSink.level.vs - 150,
    `그래서 같은 레버인데 가라앉는다 (${bankSink.level.vs.toFixed(0)} → ${bankSink.turn.vs.toFixed(0)}fpm)`);

  // ── 속도가 붙으면 필요 토크가 줄어든다(전진 양력) ──
  const tlift = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    S.bnk = 0; S.spd = 0;
    const hover = tqRequired();
    S.spd = 90;
    const cruise = tqRequired();
    return { hover, cruise };
  })()`);
  t.ok(tlift.cruise < tlift.hover - 5,
    `제자리보다 전진 중에 덜 든다 (${tlift.hover.toFixed(0)}% → ${tlift.cruise.toFixed(0)}%)`);

  // ── 오르내림과 속도를 맞바꾼다 ──
  // 출력이 정해져 있으면 올라가는 만큼 속도를 내준다.
  const trade = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.spd = 100;
    _ax(3, 1); fly(8);                    // 세게 올라간다
    return { spd: S.spd, vs: S.vs };
  })()`);
  t.ok(trade.vs > 500 && trade.spd < 100,
    `올라가면 속도를 내준다 (${trade.vs.toFixed(0)}fpm · 100 → ${trade.spd.toFixed(0)}kt)`);

  // ── TQ 계기가 속도계 아래에 막대로 그려진다 ──
  const gauge = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    selectPanel('left', 'pfd', true);
    _ax(3, 1); fly(6);                    // 토크를 올려 둔다
    // 그려진 글자와 자리(세로)를 가로채 본다
    const seen = [];
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText;
    const cv = document.getElementById('pfd');
    proto.fillText = function (tx, px, py, ...a) {
      if (px < cv.width * 0.2) seen.push({ t: String(tx), x: px, y: py });
      return orig.call(this, tx, px, py, ...a);
    };
    drawPFD();
    proto.fillText = orig;
    const head = seen.find(v => v.t === 'TQ %');
    const hi = seen.findIndex(v => v.t === 'TQ %');
    const val  = seen.slice(hi + 1).some(v => v.t === String(Math.round(S.tq)));
    // 속도계 눈금(현재 속도)이 TQ 머리글보다 위에 있어야 한다
    const spdTick = seen.find(v => v.t === String(Math.round(S.spd / 10) * 10));
    return { head: !!head, headY: head && head.y, val,
             spdAbove: spdTick ? spdTick.y < head.y : null,
             tq: S.tq, h: cv.height };
  })()`);
  t.eq(gauge.head, true, 'TQ % 머리글이 그려진다');
  t.eq(gauge.val, true, `지금 토크 값이 숫자로 나온다 (${gauge.tq.toFixed(0)}%)`);
  t.eq(gauge.spdAbove, true, '속도계가 TQ 계기보다 위에 있다(속도계 아래가 TQ 다)');

  // 한계를 넘으면 붉게 — 오버토크를 눈으로 알 수 있어야 한다
  const over = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const cv = document.getElementById('pfd');
    const grab = () => {
      const seen = [];
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText;
      proto.fillText = function (tx, px, py, ...a) {
        if (px < cv.width * 0.2) seen.push({ t: String(tx), col: this.fillStyle });
        return orig.call(this, tx, px, py, ...a);
      };
      drawPFD();
      proto.fillText = orig;
      // 속도계 눈금에도 같은 숫자가 나온다 — 'TQ %' 머리글 뒤쪽만 본다
      const i = seen.findIndex(v => v.t === 'TQ %');
      return i < 0 ? [] : seen.slice(i);
    };
    S.tq = 80;
    const okCol = (grab().find(v => v.t === '80' && v.col !== '#6a7784') || {}).col;
    S.tq = 110;
    const rows = grab();
    const hiCol = (rows.find(v => v.t === '110') || {}).col;
    return { okCol, hiCol, warn: rows.some(v => v.t === 'OVER TQ'), over: tqOver() };
  })()`);
  t.eq(over.okCol, '#ffffff', `한계 안에서는 흰 숫자다 (${over.okCol})`);
  t.eq(over.hiCol, '#ff5555', `100% 를 넘으면 붉어진다 (${over.hiCol})`);
  t.eq(over.warn, true, 'OVER TQ 경고가 함께 뜬다');
  t.eq(over.over, true, '상태로도 오버토크다');

  // SIM 모드가 아니어도 계기는 지금 비행 상태에 맞는 값을 보여 준다
  const idle = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    toggleSimMode(false);
    S.bnk = 0; S.spd = 100; S.vs = 0;
    const level = tqShown();
    S.vs = 500;
    const climb = tqShown();
    return { level, climb };
  })()`);
  t.ok(idle.level > 40 && idle.level < 70,
    `SIM 모드가 아닐 때도 수평이면 그럴듯한 값이다 (${idle.level.toFixed(0)}%)`);
  t.ok(idle.climb > idle.level + 5,
    `올라가고 있으면 더 높게 나온다 (${idle.climb.toFixed(0)}%)`);

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

  // 3D 카메라를 그대로 읽는다 — 자리·높이·방위·기울기·롤.
  // (maplibre 5 는 카메라를 헬기 자리에 직접 놓으므로 화면을 돌리거나 미는
  //  흉내가 없다. 그래서 카메라 값을 곧바로 잰다.)
  const CAM = `() => {
    const tr = _ml3d.transform, ll = tr.getCameraLngLat();
    return { lat: ll.lat, lon: ll.lng, alt: tr.getCameraAltitude(),
             pitch: _ml3d.getPitch(), roll: _ml3d.getRoll(),
             bearing: Math.round(normA(_ml3d.getBearing())) % 360,
             tf: document.getElementById('map3d').style.transform };
  }`;

  // ── PFD 와 지도가 함께 움직인다 ──
  // 같은 상태(S)를 두 화면이 읽으므로, 조종한 결과가 둘 다에 나타나야 한다.
  const both = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const cam = ${CAM};
    toggleSimMode(false);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    toggleSimMode(true);                 // 켜면 지도 창이 3D 로 바뀐다
    const c0 = cam();
    // PFD 캔버스에 그려진 뱅크 지시(ADI 회전각)를 가로채 본다
    let drawn = null;
    const proto = CanvasRenderingContext2D.prototype, orig = proto.rotate;
    _ax(0, 1); fly(5);
    proto.rotate = function (a) { if (drawn === null) drawn = a; return orig.call(this, a); };
    drawPFD();
    proto.rotate = orig;
    const c1 = cam();
    return { bnk: S.bnk, drawn, three: midSel, c1,
             hdg: Math.round(S.hdg) % 360,
             moved: distance(c0.lat, c0.lon, c1.lat, c1.lon),
             offAc: distance(c1.lat, c1.lon, S.lat, S.lon) * 1852 };
  })()`);
  t.ok(Math.abs(both.bnk) > 40, `조종한 뱅크가 상태에 들어 있다 (${both.bnk.toFixed(0)}°)`);
  t.ok(both.drawn !== null && Math.abs(both.drawn) > 0.3,
    `PFD 가 그 뱅크로 그려진다 (${both.drawn === null ? '없음' : both.drawn.toFixed(2)}rad)`);
  t.eq(both.three, 'm3d', 'SIM 을 켜면 지도 창이 3D 로 바뀐다');
  t.ok(both.moved > 0.05, `3D 카메라도 함께 날아간다 (${both.moved.toFixed(2)}NM)`);
  t.ok(both.offAc < 2, `카메라는 늘 헬기 자리에 있다 (${both.offAc.toFixed(2)}m)`);
  t.eq(both.c1.bearing, both.hdg, `방위는 기수를 따른다 (${both.c1.bearing}° · 기수 ${both.hdg}°)`);
  t.ok(Math.abs(both.c1.roll - both.bnk) < 0.5,
    `카메라가 뱅크만큼, 같은 쪽으로 기운다 (롤 ${both.c1.roll.toFixed(1)}° · 뱅크 ${both.bnk.toFixed(1)}°)`);
  t.eq(both.c1.tf, '', '화면을 돌리는 흉내는 쓰지 않는다(카메라가 직접 기운다)');

  // ── 바깥 그림이 계기를 따른다 ──
  // 고도계(높이) · 방향지시계(방위) · 자세계(기울기·롤).
  const view = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const cam = ${CAM};
    toggleSimMode(false);
    toggleTriple(true);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    const before = midSel;
    toggleSimMode(true);
    _simGndFt = 0; _simGndFresh = false;     // 지형을 모르는 바다 위로 둔다
    const at = (alt, pit, hdg, bnk) => {
      S.alt = alt; S.pit = pit; S.hdg = hdg; S.bnk = bnk; _applyFollow(); return cam();
    };
    const low = at(1000, 0, 90, 0), high = at(9000, 0, 90, 0);
    const down = at(1000, -10, 90, 0), up = at(1000, 10, 90, 0);
    const turn = at(1000, 0, 250, 0), rolled = at(1000, 0, 250, -30);
    const level = at(1000, 0, 250, 0);
    toggleSimMode(false);
    const after = { sel: midSel, roll: _ml3d.getRoll(), pitch: _ml3d.getPitch(),
                    clamp: _ml3d.getCenterClampedToGround(), tf: document.getElementById('map3d').style.transform };
    return { before, low, high, down, up, turn, rolled, level, after };
  })()`);
  t.eq(view.before, 'map', '켜기 전에는 2D 지도였다');
  t.ok(Math.abs(view.low.alt - 1000 * 0.3048) < 1.5 && Math.abs(view.high.alt - 9000 * 0.3048) < 1.5,
    `카메라 높이가 고도계와 같다 (1,000ft → ${(view.low.alt / 0.3048).toFixed(0)}ft · ` +
    `9,000ft → ${(view.high.alt / 0.3048).toFixed(0)}ft)`);
  t.ok(Math.abs(view.low.pitch - 90) < 0.5,
    `수평 자세에서는 지평선을 정면으로 본다 (${view.low.pitch.toFixed(1)}°)`);
  t.ok(Math.abs(view.down.pitch - 80) < 0.5,
    `기수를 10° 숙이면 그만큼 아래를 본다 (${view.down.pitch.toFixed(1)}°)`);
  t.ok(Math.abs(view.up.pitch - 100) < 0.5,
    `기수를 10° 들면 지평선 위(하늘)를 본다 (${view.up.pitch.toFixed(1)}° — 종전 엔진은 85° 가 끝이었다)`);
  t.eq(view.turn.bearing, 250, `기수를 돌리면 시야도 돈다 (${view.turn.bearing}°)`);
  t.ok(Math.abs(view.rolled.roll + 30) < 0.5,
    `좌로 30° 기울이면 카메라도 왼쪽으로 30° 기운다 (롤 ${view.rolled.roll.toFixed(1)}°)`);
  t.ok(Math.abs(view.level.roll) < 0.5, '수평으로 돌아오면 기울임도 풀린다');
  t.eq(view.after.sel, 'map', '끄면 지도 창이 2D 로 되돌아온다');
  t.ok(Math.abs(view.after.roll) < 0.5 && view.after.pitch <= 85.5,
    `끄면 롤과 90° 너머 기울기도 되돌아온다 (롤 ${view.after.roll.toFixed(1)}° · ${view.after.pitch.toFixed(0)}°)`);
  t.eq(view.after.clamp, true, '끄면 지도 중심을 다시 지면에 묶는다(평소 3D 추종용)');

  // ── 기수를 들면 하늘을 본다 — 앞으로 나가지 않는다 ──
  // 종전 엔진(maplibre 4)은 카메라를 85° 위로 들 수 없어, 기수를 더 들면 시선을
  // 앞으로 보내 흉내 냈다 — 그래서 하늘 대신 '전진' 하는 그림이 됐다.
  // 이제는 카메라가 정말로 들린다. 정면 먼 곳(지평선)이 화면 어디에 찍히는지,
  // 그리고 카메라 자리가 그대로인지를 본다.
  const lookUp = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const cam = ${CAM};
    toggleSimMode(false);
    toggleTriple(true);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    toggleSimMode(true);
    _simGndFt = 0; _simGndFresh = false;
    S.alt = 2000; S.bnk = 0; S.hdg = 90;
    const H = _ml3d.getContainer().clientHeight;
    const read = (pit, bnk) => {
      S.pit = pit; S.bnk = bnk || 0; _applyFollow();
      const far = destPoint(S.lat, S.lon, S.hdg, 40);           // 정면 40NM — 지평선 근처
      const c = cam();
      return { horizonY: _ml3d.project([far[1], far[0]]).y, c,
               offAc: distance(c.lat, c.lon, S.lat, S.lon) * 1852 };
    };
    const lvl = read(0), up10 = read(10), up20 = read(20), up40 = read(40),
          dn20 = read(-20), bank45 = read(0, 45);
    // 정면 먼 곳의 왼쪽·오른쪽 점 — 오른쪽 뱅크면 오른쪽이 화면에서 위로(작은 y) 간다
    const side = (bnk) => {
      S.pit = 0; S.bnk = bnk; _applyFollow();
      const far = destPoint(S.lat, S.lon, S.hdg, 40);
      const L = destPoint(far[0], far[1], S.hdg - 90, 6), R = destPoint(far[0], far[1], S.hdg + 90, 6);
      return { L: _ml3d.project([L[1], L[0]]).y, R: _ml3d.project([R[1], R[0]]).y };
    };
    const right30 = side(30), left30 = side(-30);
    // PFD 의 ADI 가 같은 뱅크에서 어느 쪽으로 도는지(캔버스 회전각의 부호)
    let adi = null;
    const proto = CanvasRenderingContext2D.prototype, orig = proto.rotate;
    S.bnk = 30;
    proto.rotate = function (a) { if (adi === null) adi = a; return orig.call(this, a); };
    drawPFD(); proto.rotate = orig;
    const marker = _ml3dMarker ? _ml3dMarker.getElement().isConnected : null;
    toggleSimMode(false);
    _update3dMarker();
    const markerAfter = _ml3dMarker ? _ml3dMarker.getElement().isConnected : null;
    return { H, lvl, up10, up20, up40, dn20, bank45, marker, markerAfter, right30, left30, adi };
  })()`);
  const fr = (r) => (r.horizonY / lookUp.H).toFixed(2);
  t.ok(Math.abs(lookUp.lvl.horizonY - lookUp.H / 2) < lookUp.H * 0.08,
    `수평 자세에서 지평선은 화면 한가운데다 (높이의 ${fr(lookUp.lvl)})`);
  t.ok(lookUp.up10.horizonY > lookUp.lvl.horizonY + lookUp.H * 0.1
       && lookUp.up20.horizonY > lookUp.up10.horizonY + lookUp.H * 0.1,
    `기수를 들수록 지평선이 내려가 하늘이 넓어진다 (0° ${fr(lookUp.lvl)} → 10° ${fr(lookUp.up10)} → 20° ${fr(lookUp.up20)})`);
  t.ok(lookUp.up40.c.pitch > 125,
    `40° 들면 하늘을 올려다본다 (카메라 ${lookUp.up40.c.pitch.toFixed(0)}°)`);
  t.ok(lookUp.dn20.horizonY < lookUp.lvl.horizonY - lookUp.H * 0.1,
    `숙이면 지평선이 올라가 땅이 넓어진다 (${fr(lookUp.dn20)})`);
  t.ok([lookUp.lvl, lookUp.up10, lookUp.up20, lookUp.up40, lookUp.dn20].every(r => r.offAc < 2),
    `어느 자세에서도 카메라는 헬기 자리 그대로다 — '전진' 하지 않는다 ` +
    `(최대 ${Math.max(...[lookUp.lvl, lookUp.up10, lookUp.up20, lookUp.up40, lookUp.dn20].map(r => r.offAc)).toFixed(2)}m)`);
  t.ok(Math.abs(lookUp.bank45.c.alt - lookUp.lvl.c.alt) < 0.5 && lookUp.bank45.c.tf === '',
    `기울여도 확대되지 않는다 — 카메라 높이 그대로, 화면 배율 없음`);
  t.ok(lookUp.right30.R < lookUp.right30.L - 20,
    `오른쪽 뱅크면 지평선의 오른쪽이 올라간다 (왼쪽 y ${lookUp.right30.L.toFixed(0)} · 오른쪽 ${lookUp.right30.R.toFixed(0)})`);
  t.ok(lookUp.left30.L < lookUp.left30.R - 20,
    `왼쪽 뱅크면 왼쪽이 올라간다 (왼쪽 y ${lookUp.left30.L.toFixed(0)} · 오른쪽 ${lookUp.left30.R.toFixed(0)})`);
  // ADI 는 캔버스를 rotate(−뱅크) 로 돌린다 — 음수(반시계)면 지평선 오른쪽이 올라간다
  t.ok(lookUp.adi < 0,
    `PFD 의 ADI 도 같은 쪽으로 기운다 (회전 ${lookUp.adi === null ? '없음' : lookUp.adi.toFixed(2)}rad · 오른쪽 뱅크 30°)`);
  t.eq(lookUp.marker, false, '1인칭에서는 제 마커를 지도에서 뗀다(눈이 곧 헬기 자리)');
  t.eq(lookUp.markerAfter, true, '끄면 마커가 다시 붙는다');

  // ── 카메라가 움직여도 GPU 에서 화면을 읽어 오지 않는다(버벅거림) ──
  // readPixels 는 GPU 가 그리기를 다 끝낼 때까지 기다리게 한다. 종전에는 3D 축척이
  // 매 프레임 unproject()(지형을 켜면 readPixels)를 불렀고, 숨긴 마커도 지형에
  // 가렸는지 보려고 readPixels 를 불렀다 — 그래서 SIM 에서 3D 가 버벅거렸다.
  const stall = await page.evaluate(`(async () => {
    (${SETUP.toString()})();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleSimMode(false);
    toggleTriple(true);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    toggleSimMode(true);
    await wait(400);
    S.running = false;
    let reads = 0;
    const hook = (P) => { if (!P) return null; const o = P.readPixels;
      P.readPixels = function (...a) { reads++; return o.apply(this, a); }; return () => { P.readPixels = o; }; };
    const u1 = hook(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
    const u2 = hook(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
    const t0 = performance.now();
    for (let i = 0; i < 12; i++) { S.hdg = 90 + i; S.bnk = (i % 3) * 10; S.pit = (i % 4) * 3; updateAcOnMap(); }
    const per = (performance.now() - t0) / 12;
    await wait(400);                         // 마커 가림 검사는 잠시 뒤에 돈다
    const sim = reads;
    toggleSimMode(false);
    u1 && u1(); u2 && u2();
    return { sim, per };
  })()`);
  t.eq(stall.sim, 0, `SIM 에서 카메라를 움직여도 GPU 화면 읽기가 없다 (${stall.sim}회 — 종전에는 매 프레임)`);

  // 3D 축척은 카메라 기하로 셈한다 — 땅 위 두 점을 집던 종전 값과 맞아야 한다
  const scale = await page.evaluate(`(async () => {
    (${SETUP.toString()})();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleSimMode(false);
    if (!_view3dOn) toggle3dMap();
    await wait(300);
    const m = _ml3d, sc = window._ml3dScale;
    const byUnproject = () => {
      const y = Math.max(1, m.getContainer().clientHeight - 60);
      const p0 = m.unproject([20, y]), p1 = m.unproject([120, y]);
      return distance(p0.lat, p0.lng, p1.lat, p1.lng) * 1852 / 100;
    };
    const ter = m.getTerrain(); m.setTerrain(null);   // 평평한 땅에서 비교
    const out = {};
    for (const pt of [0, 45, 70]) {
      m.jumpTo({ center: [127, 37.5], zoom: 12, pitch: pt, bearing: 0, roll: 0 });
      out['p' + pt] = { calc: sc._mpp(), ref: byUnproject() };
    }
    m.setTerrain(ter);
    if (_view3dOn) toggle3dMap();
    return out;
  })()`);
  for (const k of ['p0', 'p45', 'p70']) {
    const r = scale[k], err = Math.abs(r.calc / r.ref - 1);
    t.ok(err < 0.06, `3D 축척(${k.slice(1)}°)이 실제 땅 위 거리와 맞는다 (${r.calc.toFixed(2)} · 실측 ${r.ref.toFixed(2)} m/px)`);
  }

  // ── 땅 위에서는 고도계만큼, 앉아 있으면 눈높이만큼 떠 있다 ──
  // 지면 위 높이(AGL)는 비행 모델의 땅에서 재고, 카메라는 '화면에 그려진 땅' 위에
  // 그만큼 놓는다. 그려진 땅은 표고를 부풀려 그린다(과장비). 지형 타일이 아직
  // 안 왔으면 그려진 땅은 우리 DEM 값을 부풀린 높이로 본다.
  const gndCam = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const cam = ${CAM};
    const realElev = window._tcElev, realQ = _ml3d.queryTerrainElevation;
    window._tcElev = () => 305;                 // 비행 모델: 1,000ft 산 위
    simTerrainFt();
    const run = (q, alt) => {
      _ml3d.queryTerrainElevation = q;
      S.alt = alt; S.pit = 0; S.bnk = 0; _applyFollow(); return cam().alt;
    };
    // ① 지도가 그 산을 이미 그렸다(그려진 땅 = 305 × 과장비)
    const drawnKnown = run(() => 305 * MAP3D_EXAG, 1500);
    // ② 아직 못 그렸다 — 우리 DEM 을 부풀린 높이를 그려진 땅으로 본다
    const drawnUnknown = run(() => null, 1500);
    // ③ 땅에 앉음(AGL 0)
    const onGround = run(() => 305 * MAP3D_EXAG, simTerrainFt());
    _ml3d.queryTerrainElevation = realQ;
    window._tcElev = realElev;
    return { drawnKnown, drawnUnknown, onGround, exag: MAP3D_EXAG };
  })()`);
  const rendGnd = 305 * gndCam.exag, agl500 = 500 * 0.3048;
  t.ok(Math.abs(gndCam.drawnKnown - (rendGnd + agl500)) < 2,
    `산 위 AGL 500ft — 그려진 땅(${rendGnd.toFixed(0)}m) 위로 ${agl500.toFixed(0)}m (${gndCam.drawnKnown.toFixed(0)}m)`);
  t.ok(Math.abs(gndCam.drawnUnknown - (rendGnd + agl500)) < 2,
    `지형 타일이 아직 없어도 같은 자리에 놓인다 (${gndCam.drawnUnknown.toFixed(0)}m)`);
  t.ok(gndCam.onGround > rendGnd + 5 && gndCam.onGround < rendGnd + 12,
    `땅에 앉아 있어도 눈높이(8m)만큼 떠 있다 (${(gndCam.onGround - rendGnd).toFixed(1)}m)`);

  // ── 4방향 햇 = 사이클릭 비퍼 트림(1° 씩) ──
  // 실제 헬기의 사이클릭 햇은 트림이다. 한 번 누르면 뱅크·피치가 1° 씩 옮겨 가고,
  // 누르고 있으면 계속 옮겨 간다. 조종간을 가운데 두어도 그 자세로 난다.
  const trim = await page.evaluate(`(async () => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const wait = ms => new Promise(r => setTimeout(r, ms));
    simTrimReset();
    simTrimNudge('R');
    const one = { roll: simTrim.roll, pitch: simTrim.pitch };
    simTrimReset();
    simTrimNudge('F');
    const oneP = { roll: simTrim.roll, pitch: simTrim.pitch };
    simTrimReset();
    for (let i = 0; i < 10; i++) simTrimNudge('R');     // 우 트림 10번
    const t1 = JSON.parse(JSON.stringify(simTrim));
    fly(4);                                             // 조종간은 가운데 그대로
    const rolled = { bnk: S.bnk, axis: joyAxVal('roll') };
    for (let i = 0; i < 20; i++) simTrimNudge('L');     // 반대로 넘겨 본다
    fly(5);
    const back = S.bnk;
    simTrimReset(); fly(4);
    const level = S.bnk;
    for (let i = 0; i < 10; i++) simTrimNudge('F');     // 전후는 피치 — 10번이면 10°
    fly(4);
    const nose = { pit: S.pit, trim: simTrim.pitch };
    simTrimReset();
    // 누르고 있으면 계속 옮겨 간다(0.3초 뒤부터 0.1초마다 1°). 검사 브라우저는 3D 를
    // 소프트웨어로 그리느라 벽시계 타이머가 제때 돌지 못하므로, 시작·반복 타이머를
    // 붙잡아 두었다가 손으로 '0.3초 뒤 + 0.1초 × 7번' 을 흘려 본다.
    const holdFor = (dir) => {
      const rST = window.setTimeout, rSI = window.setInterval;
      let start = null, rep = null;
      window.setTimeout = (fn, ms) => (ms === 300 ? (start = fn, 987651) : rST(fn, ms));
      window.setInterval = (fn, ms) => (ms === 100 ? (rep = fn, 987652) : rSI(fn, ms));
      try { startTrimHold(dir); } finally { window.setTimeout = rST; window.setInterval = rSI; }
      window.setInterval = (fn, ms) => (ms === 100 ? (rep = fn, 987652) : rSI(fn, ms));
      try { if (start) start(); } finally { window.setInterval = rSI; }
      for (let i = 0; i < 7 && rep; i++) rep();
      stopTrimHold();
      return { pitch: simTrim.pitch, roll: simTrim.roll, started: !!start, repeated: !!rep };
    };
    simTrimReset(); const heldP = holdFor('A');
    simTrimReset(); const heldR = holdFor('R');
    simTrimReset();
    const held = heldP.pitch;
    const maxR = (() => { for (let i = 0; i < 200; i++) simTrimNudge('R'); const m = simTrim.roll; simTrimReset(); return m; })();
    const maxP = (() => { for (let i = 0; i < 200; i++) simTrimNudge('A'); const m = simTrim.pitch; simTrimReset(); return m; })();
    return { one, oneP, t1, rolled, back, level, nose, held, heldR, maxR, maxP };
  })()`);
  t.ok(trim.one.roll === 1 && trim.one.pitch === 0, `한 번 누르면 뱅크가 1° 옮겨 간다 (${trim.one.roll}°)`);
  t.ok(trim.oneP.pitch === 1 && trim.oneP.roll === 0, `피치도 한 번에 1° 다 (${trim.oneP.pitch}°)`);
  t.eq(trim.rolled.axis, 0, '조종간은 가운데 그대로다');
  t.ok(Math.abs(trim.rolled.bnk - 10) < 0.6, `우 트림 10번이면 10° 기운 채 난다 (${trim.rolled.bnk.toFixed(1)}°)`);
  t.ok(Math.abs(trim.back + 10) < 0.6, `반대로 20번 넘기면 왼쪽 10° (${trim.back.toFixed(1)}°)`);
  t.ok(Math.abs(trim.level) < 0.6, `트림을 풀면 수평으로 돌아온다 (${trim.level.toFixed(1)}°)`);
  t.ok(Math.abs(trim.nose.pit + 10) < 0.6, `앞 트림 10번이면 기수가 10° 내려간다 (${trim.nose.pit.toFixed(1)}°)`);
  t.eq(trim.held, -8, `피치 햇을 누르고 있으면 계속 옮겨 간다 (1초에 ${trim.held}° — 첫 1° + 0.1초마다 1°)`);
  t.eq(trim.heldR.roll, 8, `뱅크도 똑같이 이어 간다 (1초에 ${trim.heldR.roll}°)`);
  t.ok(trim.maxR === 30 && trim.maxP === -20,
    `한없이 쌓이지는 않는다 (뱅크 ±${trim.maxR}° · 피치 ${trim.maxP}°)`);

  // ── 스로틀처럼 세워 두는 레버(레버식) ──
  // 자리 자체가 출력이다. 맨 아래면 토크가 바닥, 맨 위면 110%.
  const lever = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes.coll = { i: 3, inv: false, abs: true };
    _ax(3, -1); joyPoll(1000); fly(4);          // 맨 아래
    const down = { tq: S.tq, vs: S.vs, raw: joyAxRaw('coll') };
    _ax(3, 0); fly(4);                          // 가운데
    const mid = S.tq;
    _ax(3, 1); fly(4);                          // 맨 위
    const up = { tq: S.tq, over: tqOver() };
    return { down, mid, up, lbl: joyAxLabel('coll') };
  })()`);
  t.eq(trim.rolled.axis, 0, '레버식은 중립을 빼지 않는다 — 자리 그대로 읽는다');
  t.ok(lever.down.tq < 10, `맨 아래면 토크가 바닥이다 (${lever.down.tq.toFixed(0)}%)`);
  t.ok(lever.down.vs < -500, `그러면 내려간다 (${lever.down.vs.toFixed(0)}fpm)`);
  t.ok(Math.abs(lever.mid - 55) < 8, `가운데면 호버 언저리다 (${lever.mid.toFixed(0)}%)`);
  t.ok(lever.up.tq > 100, `맨 위면 연속한계를 넘는다 (${lever.up.tq.toFixed(0)}%)`);
  t.eq(lever.up.over, true, '오버토크로 뜬다');
  t.ok(lever.lbl.includes('레버식'), `설정에도 그렇게 적힌다 (${lever.lbl})`);

  // 가운데로 돌아오는 축이면 종전대로 호버 토크 기준이다
  const spring = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes.coll = { i: 3, inv: false, abs: false };
    _ax(3, 0); fly(3);
    return { tq: S.tq, hover: hoverTqRef() };
  })()`);
  t.ok(Math.abs(spring.tq - spring.hover) < 3,
    `가운데면 호버 토크다 (${spring.tq.toFixed(0)}% · PERF 호버 ${spring.hover.toFixed(0)}%)`);

  // ── 속도·고도는 점진적으로 바뀐다 ──
  // 자세나 출력을 바꿔도 속도·상승률이 그 자리에서 튀지 않는다. 가감속이 먼저
  // 천천히 붙고(S 자 모양), 그 한계(≈3.5kt/s)를 넘지 않으며, 넘쳐 지나치지 않는다.
  const grad = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    S.alt = 4000; _simGndFt = 0; S.bnk = 0;
    // ① 속도 — 수평(120kt)에서 기수를 10° 숙인다(목표 140kt)
    S.spd = 120; S.pit = 0; simAcc = 0;
    _ax(3, (tqRequired() / 110) * 2 - 1); fly(3);  // 레버를 고도 유지 언저리에 둔다
    S.spd = 120; simAcc = 0; S.vs = 0; _simVs1 = 0;
    simTrim.pitch = 10;                            // 트림으로 기수 10° 내림(조종간은 가운데)
    const spd = []; let maxAcc = 0, prev = S.spd;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 1; i <= 25 * 20; i++) {
      ts += 50; joyPoll(ts); simStep(ts);
      maxAcc = Math.max(maxAcc, Math.abs(S.spd - prev) / 0.05); prev = S.spd;
      if (i === 10 || i === 40 || i === 200 || i === 500) spd.push(S.spd);
    }
    S.running = false;
    simTrimReset();
    // ② 상승률 — 70kt 자세(기수 5°)로 자리잡은 뒤 레버를 한 번에 20% 올린다
    simTrim.pitch = -pitchFromSpd(70);
    S.spd = 70; S.alt = 4000;
    _ax(3, (tqRequired() / 110) * 2 - 1); fly(12);
    _ax(3, (tqRequired() / 110) * 2 - 1); fly(8);
    const base = S.vs;
    const lever = S.tq + 20;
    _ax(3, Math.min(1, (lever / 110) * 2 - 1));
    S.running = true; ts = 1000; S.lastT = ts;
    const vs = [], tq = [];
    for (let i = 1; i <= 10 * 20; i++) {
      ts += 50; joyPoll(ts); simStep(ts);
      if (i === 6 || i === 20 || i === 60 || i === 200) { vs.push(S.vs - base); tq.push(S.tq); }
    }
    S.running = false;
    simTrimReset();
    return { spd, maxAcc, vs, tq, lever };
  })()`);
  t.ok(grad.spd[0] - 120 < 0.8,
    `기수를 숙인 0.5초 뒤에는 거의 그대로다 (${grad.spd[0].toFixed(1)}kt — 종전에는 곧바로 빨라졌다)`);
  t.ok(grad.spd[1] - 120 < 6 && grad.spd[1] > grad.spd[0],
    `2초 뒤에도 조금씩 붙는다 (${grad.spd[1].toFixed(1)}kt)`);
  t.ok(grad.maxAcc <= 3.6, `가감속은 3.5kt/s 를 넘지 않는다 (최대 ${grad.maxAcc.toFixed(2)}kt/s)`);
  t.ok(Math.abs(grad.spd[3] - 140) < 3 && grad.spd[3] <= 141,
    `25초면 그 자세의 속도(140kt)에 닿고 넘치지 않는다 (${grad.spd[3].toFixed(1)}kt)`);
  const vsFinal = grad.vs[3];
  t.ok(vsFinal > 300, `레버를 올리면 결국 오른다 (${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.vs[0] < vsFinal * 0.2,
    `0.3초 뒤 상승률은 아직 작다 (${grad.vs[0].toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.vs[1] < vsFinal * 0.35,
    `1초 뒤에도 아직 덜 붙었다 (${grad.vs[1].toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.vs[2] > vsFinal * 0.6 && grad.vs[2] < vsFinal * 0.9,
    `3초면 대부분 붙되 다 붙지는 않았다 (${grad.vs[2].toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.tq[0] < grad.lever - 3 && Math.abs(grad.tq[2] - grad.lever) < 1.5,
    `토크도 레버를 천천히 따라간다 (0.3초 ${grad.tq[0].toFixed(0)}% → 3초 ${grad.tq[2].toFixed(0)}% · 레버 ${grad.lever.toFixed(0)}%)`);

  // ── 시야 둘러보기 — B0 을 누르고 햇으로 눈을 돌린다 ──
  // 둘러보기 버튼을 누르고 있는 동안 햇은 트림이 아니라 시선이다. 놓으면 정면으로
  // 돌아온다. 시선은 기체 자세 위에 얹힌다(오른쪽 뱅크에서 오른쪽을 보면 땅 쪽).
  const look = await page.evaluate(`(async () => {
    (${SETUP.toString()})();
    const cam = ${CAM};
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleSimMode(false);
    toggleTriple(true);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    toggleSimMode(true);
    S.running = false; S.alt = 2000; S.pit = 0; S.bnk = 0; S.hdg = 90; _simGndFt = 0; _simGndFresh = false;
    // 시선은 실시간으로 돈다. 검사 브라우저는 3D 를 소프트웨어로 그려 한 프레임이
    // 느리므로, 시간을 0.05초씩 정확히 밀어 본다(앱은 실제 경과시간을 쓴다).
    const hold = async (ms) => { for (let i = 0; i < ms / 50; i++) simLookStep(0.05); _applyFollow(); };
    const binds = { b0: joyBinds.b0 };
    // 장치로 누른다: B0 + 햇 ▶(축 9)
    _pad.buttons = Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }));
    _pad.axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.2857142857142856];
    for (const k in _joyNeutral) delete _joyNeutral[k];
    joySetBind('b0', 'lookMod'); joySetBind('h9E', 'trimR'); joySetBind('h9N', 'trimF');
    joyPoll(10);
    _pad.buttons[0] = { pressed: true, value: 1 }; joyPoll(20);
    _pad.axes[9] = -3/7; joyPoll(30);                    // 햇 ▶
    const trimBefore = simTrim.roll;
    await hold(1000);
    const right = cam();
    _pad.axes[9] = 3.2857142857142856; joyPoll(40);      // 햇을 놓는다(B0 은 그대로)
    _pad.axes[9] = -1; joyPoll(50);                      // 햇 ▲ — 올려다본다
    await hold(500);
    const upRight = cam();
    _pad.axes[9] = 3.2857142857142856; joyPoll(60);
    const trimDuring = simTrim.roll;
    _pad.buttons[0] = { pressed: false, value: 0 }; joyPoll(70);   // B0 을 놓는다
    await hold(1500);
    const back = cam();
    // B0 없이 햇 ▶ 는 종전대로 트림이다
    _pad.axes[9] = -3/7; joyPoll(80); _pad.axes[9] = 3.2857142857142856; joyPoll(90);
    const trimAfter = simTrim.roll;
    simTrimReset();
    // 오른쪽 뱅크에서 오른쪽을 보면 땅 쪽을 본다(시선이 자세 위에 얹힌다)
    const comp = _ml3dCamRot(90, 0, 30, 90, 0);
    toggleSimMode(false);
    return { binds, right, upRight, back, trimBefore, trimDuring, trimAfter, comp };
  })()`);
  t.eq(look.binds.b0, 'lookMod', `B0 이 '시야 둘러보기' 로 잡혀 있다`);
  t.ok(normAS0(look.right.bearing - 90) > 60,
    `B0 을 누른 채 햇 ▶ 를 1초 누르면 오른쪽을 본다 (방위 ${look.right.bearing}° · 기수 90°)`);
  t.ok(look.upRight.pitch > 110,
    `햇 ▲ 를 누르면 올려다본다 (카메라 ${look.upRight.pitch.toFixed(0)}°)`);
  t.eq(look.trimDuring, look.trimBefore, '둘러보는 동안에는 트림이 바뀌지 않는다');
  t.ok(Math.abs(normAS0(look.back.bearing - 90)) < 3 && Math.abs(look.back.pitch - 90) < 3,
    `B0 을 놓으면 정면으로 돌아온다 (방위 ${look.back.bearing}° · ${look.back.pitch.toFixed(0)}°)`);
  t.eq(look.trimAfter, look.trimBefore + 1, 'B0 없이 누른 햇은 종전대로 트림(1°)이다');
  t.ok(Math.abs(look.comp.pitch + 30) < 0.5 && Math.abs(look.comp.yaw - 180) < 0.5,
    `오른쪽 30° 뱅크에서 오른쪽을 보면 30° 내려다본다 (${look.comp.pitch.toFixed(1)}° · 방위 ${look.comp.yaw.toFixed(0)}°)`);

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
    S.tq = tqRequired(); S.vs = 0; _simVs1 = 0;   // 레버가 없으면 고도를 지킬 토크가 걸린다
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
