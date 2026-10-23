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

  // ── 뒤로도 난다 ──
  // 헬기는 후방 비행을 한다. 기수를 들고 있으면 뒤로 가속되어야 하고,
  // 그 속도로 실제로 뒷걸음질해야 한다(지도상 위치가 기수 반대쪽으로 간다).
  const back = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.spd = 0; S.hdg = 90; S.alt = 2000;          // 동쪽을 보고 제자리
    const lon0 = S.lon;
    _ax(1, -1); fly(20);                          // 끝까지 당겨 둔다
    const r = { spd: S.spd, lon: S.lon, pit: S.pit };
    fly(30);                                      // 더 당겨도 한계에서 멈춘다
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
  t.ok(back.idle > back.limit + 5,
    `놓으면 항력으로 멈춰 간다 (${back.limit.toFixed(0)} → ${back.idle.toFixed(0)}kt)`);

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
    _ax(3, 1); fly(8);                            // 올리면 지면 위로 뜬다
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

  // ── PFD 와 지도가 함께 움직인다 ──
  // 같은 상태(S)를 두 화면이 읽으므로, 조종한 결과가 둘 다에 나타나야 한다.
  const both = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    toggleSimMode(false);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    toggleSimMode(true);                 // 켜면 지도 창이 3D 로 바뀐다
    const c0 = (_ml3d ? _ml3d.getCenter() : leafMap.getCenter());
    // PFD 캔버스에 그려진 뱅크 지시(ADI 회전각)를 가로채 본다
    let drawn = null;
    const proto = CanvasRenderingContext2D.prototype, orig = proto.rotate;
    _ax(0, 1); fly(5);
    proto.rotate = function (a) { if (drawn === null) drawn = a; return orig.call(this, a); };
    drawPFD();
    proto.rotate = orig;
    const c1 = (_ml3d ? _ml3d.getCenter() : leafMap.getCenter());
    const el = document.getElementById('map3d');
    return { bnk: S.bnk, drawn, three: midSel,
             tf: el.style.transform, pitch: _ml3d ? _ml3d.getPitch() : null,
             bearing: _ml3d ? Math.round(normA(_ml3d.getBearing())) % 360 : null,
             hdg: Math.round(S.hdg) % 360,
             moved: Math.hypot(c1.lat - c0.lat, c1.lng - c0.lng),
             nearAc: Math.hypot(c1.lat - S.lat, c1.lng - S.lon) };
  })()`);
  t.ok(Math.abs(both.bnk) > 40, `조종한 뱅크가 상태에 들어 있다 (${both.bnk.toFixed(0)}°)`);
  t.ok(both.drawn !== null && Math.abs(both.drawn) > 0.3,
    `PFD 가 그 뱅크로 그려진다 (${both.drawn === null ? '없음' : both.drawn.toFixed(2)}rad)`);
  t.eq(both.three, 'm3d', 'SIM 을 켜면 지도 창이 3D 로 바뀐다');
  t.ok(both.moved > 0.002, `3D 지도도 함께 따라 움직인다 (${both.moved.toFixed(4)}°)`);
  t.ok(both.nearAc < 0.25, `지도 중심이 항공기를 따라온다 (${both.nearAc.toFixed(3)}°)`);
  t.eq(both.bearing, both.hdg, `방위는 기수를 따른다 (${both.bearing}° · 기수 ${both.hdg}°)`);
  t.ok(/rotate\(-?\d/.test(both.tf || ''),
    `뱅크만큼 화면이 기운다 (${both.tf || '없음'})`);

  // ── 바깥 그림이 계기를 따른다 ──
  // 고도계(높이) · 방향지시계(방위) · 자세계(카메라 각도와 기울기).
  const view = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    toggleSimMode(false);
    toggleTriple(true);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    const before = midSel;
    toggleSimMode(true);
    const el = document.getElementById('map3d');
    const read = () => ({ pitch: _ml3d.getPitch(), zoom: _ml3d.getZoom(),
                          bearing: Math.round(normA(_ml3d.getBearing())) % 360,
                          tf: el.style.transform });
    S.alt = 1000; S.pit = 0; S.bnk = 0; S.hdg = 90;
    _applyFollow(); const low = read();
    S.alt = 9000;
    _applyFollow(); const high = read();
    S.alt = 1000; S.pit = -10;              // 기수를 숙이면 더 아래를 본다
    _applyFollow(); const down = read();
    S.pit = 10;
    _applyFollow(); const up = read();
    S.pit = 0; S.hdg = 250;
    _applyFollow(); const turn = read();
    S.bnk = -30;
    _applyFollow(); const rolled = read();
    S.bnk = 0;
    _applyFollow(); const levelTf = el.style.transform;
    toggleSimMode(false);
    const after = { sel: midSel, tf: el.style.transform };
    return { before, low, high, down, up, turn, rolled, levelTf, after };
  })()`);
  t.eq(view.before, 'map', '켜기 전에는 2D 지도였다');
  t.ok(view.high.zoom < view.low.zoom - 1,
    `고도가 높아지면 시야가 멀어진다 (1,000ft z${view.low.zoom.toFixed(1)} → 9,000ft z${view.high.zoom.toFixed(1)})`);
  t.ok(view.down.pitch < view.low.pitch - 5,
    `기수를 숙이면 카메라가 더 아래를 본다 (${view.low.pitch.toFixed(0)}° → ${view.down.pitch.toFixed(0)}°)`);
  t.ok(view.up.pitch > view.low.pitch + 5,
    `기수를 들면 더 멀리 본다 (${view.up.pitch.toFixed(0)}°)`);
  t.eq(view.turn.bearing, 250, `기수를 돌리면 시야도 돈다 (${view.turn.bearing}°)`);
  t.ok(/rotate\(30/.test(view.rolled.tf),
    `좌로 기울이면 화면이 반대로 돈다 (${view.rolled.tf})`);
  t.ok(/scale\(1\.[1-9]/.test(view.rolled.tf),
    '돌려서 비는 모서리를 덮을 만큼 키운다');
  t.eq(view.levelTf, '', '수평으로 돌아오면 기울임도 풀린다');
  t.eq(view.after.sel, 'map', '끄면 지도 창이 2D 로 되돌아온다');

  // ── 1인칭: 눈이 헬기 자리에 있다 ──
  // 뒤에서 따라가는 3인칭이면 헬기가 화면 안(아래쪽 1/4 즈음)에 보인다.
  // 1인칭이면 헬기는 화면 아래 끝(또는 그 밖)이고, 화면에 보이는 것은 '앞' 이다.
  // 카메라 높이가 고도계와 맞는지는 지도 축척에서 거꾸로 셈해 확인한다.
  const fpv = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    toggleSimMode(false);
    toggleTriple(true);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true);
    selectPanel('right', 'cdu', true);
    toggleSimMode(true);
    S.hdg = 90; S.pit = 0; S.bnk = 0; S.alt = 1000;
    _applyFollow();
    const el = _ml3d.getContainer();
    const H = el.clientHeight, W = el.clientWidth;
    const pAc = _ml3d.project([S.lon, S.lat]);          // 헬기가 화면 어디에 찍히나
    // 지도 중심은 기수 앞쪽이어야 한다
    const c = _ml3d.getCenter();
    const ahead = distance(S.lat, S.lon, c.lat, c.lng) * 1852;   // m
    const brgToC = normAS(bearing(S.lat, S.lon, c.lat, c.lng) - S.hdg);
    // zoom 에서 카메라 높이를 거꾸로 셈한다(512px 타일)
    const mpp = 78271.51696 * Math.cos(S.lat * D2R) / Math.pow(2, _ml3d.getZoom());
    const pr = _ml3d.getPitch() * D2R;
    const eye = (H / 2 / _ml3dHalfFovTan()) * Math.cos(pr) * mpp;
    S.alt = 4000; _applyFollow();
    const mpp2 = 78271.51696 * Math.cos(S.lat * D2R) / Math.pow(2, _ml3d.getZoom());
    const eye2 = (H / 2 / _ml3dHalfFovTan()) * Math.cos(_ml3d.getPitch() * D2R) * mpp2;
    toggleSimMode(false);
    return { H, W, acX: pAc.x, acY: pAc.y, ahead, brgToC,
             eyeFt: eye / 0.3048, eyeFt2: eye2 / 0.3048,
             tanPitch: Math.tan(pr) };
  })()`);
  t.ok(fpv.acY > fpv.H * 0.92,
    `헬기는 화면 아래 끝에 있다 — 눈이 그 자리다 (y ${fpv.acY.toFixed(0)} / 높이 ${fpv.H})`);
  t.ok(Math.abs(fpv.acX - fpv.W / 2) < 8,
    `좌우로는 한가운데다 (x ${fpv.acX.toFixed(0)} / 폭 ${fpv.W})`);
  t.ok(Math.abs(fpv.brgToC) < 2,
    `보는 곳은 기수 정면이다 (기수에서 ${fpv.brgToC.toFixed(1)}°)`);
  t.ok(Math.abs(fpv.eyeFt - 1000) < 60,
    `카메라 높이가 고도계와 같다 (${fpv.eyeFt.toFixed(0)}ft · 고도 1,000ft)`);
  t.ok(Math.abs(fpv.eyeFt2 - 4000) < 240,
    `고도를 올리면 눈높이도 따라 오른다 (${fpv.eyeFt2.toFixed(0)}ft · 고도 4,000ft)`);
  t.ok(Math.abs(fpv.ahead - 1000 * 0.3048 * fpv.tanPitch) < 60,
    `중심은 눈 아래에서 앞으로 꼭 그만큼 밀려 있다 (${fpv.ahead.toFixed(0)}m)`);
  t.eq(view.after.tf, '', '화면 기울임도 남지 않는다');

  // ── 4방향 햇 = 사이클릭 비퍼 트림 ──
  // 실제 헬기의 사이클릭 햇은 트림이다. 좌우는 롤, 전후는 피치 중립을 옮겨 둬서
  // 조종간을 가운데 두어도 그 자세로 날게 한다.
  const trim = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    simTrimReset();
    for (let i = 0; i < 10; i++) simTrimNudge('R');     // 우 트림
    const t1 = JSON.parse(JSON.stringify(simTrim));
    fly(4);                                             // 조종간은 가운데 그대로
    const rolled = { bnk: S.bnk, axis: joyAxVal('roll') };
    for (let i = 0; i < 20; i++) simTrimNudge('L');     // 반대로 넘겨 본다
    fly(5);
    const back = S.bnk;
    simTrimReset(); fly(4);
    const level = S.bnk;
    // 전후는 피치
    for (let i = 0; i < 10; i++) simTrimNudge('F');
    fly(4);
    const nose = { pit: S.pit, trim: simTrim.pitch };
    simTrimReset();
    return { t1, rolled, back, level, nose, max: (() => {
      for (let i = 0; i < 200; i++) simTrimNudge('R');
      const m = simTrim.roll; simTrimReset(); return m;
    })() };
  })()`);
  t.ok(trim.t1.roll > 0.2, `우 트림을 넣으면 롤 중립이 옮겨 간다 (${trim.t1.roll.toFixed(2)})`);
  t.eq(trim.rolled.axis, 0, '조종간은 가운데 그대로다');
  t.ok(trim.rolled.bnk > 8, `그래도 오른쪽으로 기운 채 난다 (${trim.rolled.bnk.toFixed(1)}°)`);
  t.ok(trim.back < -8, `반대로 넘기면 왼쪽으로 기운다 (${trim.back.toFixed(1)}°)`);
  t.ok(Math.abs(trim.level) < 2, `트림을 풀면 수평으로 돌아온다 (${trim.level.toFixed(1)}°)`);
  t.ok(trim.nose.pit < -3, `앞 트림은 기수를 내린다 (${trim.nose.pit.toFixed(1)}°)`);
  t.ok(trim.max <= 0.8 + 1e-9, `한없이 쌓이지는 않는다 (최대 ${trim.max.toFixed(2)})`);

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
    return { tq: S.tq, hover: TQ_HOVER };
  })()`);
  t.ok(Math.abs(spring.tq - spring.hover) < 3,
    `가운데면 호버 토크다 (${spring.tq.toFixed(0)}% · 호버 ${spring.hover}%)`);

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
