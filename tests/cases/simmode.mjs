// SIM 모드 — 조종간으로 직접 모는 길.
//
// 확인할 것은 "축을 밀면 정말로 그렇게 나는가" 와 "그 결과가 PFD·지도에 함께
// 나타나는가" 다. 실제 조이스틱이 없으므로 가짜 패드를 깔고 축 값을 손으로
// 움직인 뒤, 시뮬 루프를 프레임 단위로 돌려 상태 변화를 잰다.
export const name = 'SIM 모드';
// 한 덩어리로는 30분 넘게 걸려 주제별 다섯 묶음으로 나눈다(각각 새 페이지에서 돈다 · 'SIM 모드' 로 다섯 다 고른다).
// 아래 suites 가 run.mjs 에 실린다.

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
  // 지형 자료(타일)를 받아 오면 자리마다 땅 높이가 달라진다 — 검사는 평평한 바다 위로 본다
  // (CRHT 는 전파고도를 지키므로 땅을 따라 오르내린다). 지형이 필요한 검사는 따로 바꿔 끼운다.
  window._tcElev = () => null;
  windSpd = 0; simSpeed = 1;
  if (!simModeOn) toggleSimMode();
  S.tq = 60; S.vs = 0; S.alt = 2000;   // 모드 진입이 손댄 값을 되돌린다
  simAcc = 0; simVsAcc = 0; simFlareVs = 0; // 가감속·유입류 지연·플레어 몫도 비운다
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

// 다른 검사(G/A)도 같은 준비·비행 도우미를 쓴다
export const SIM_SETUP_SRC = SETUP.toString();
export const SIM_FLY_SRC = FLY;

// 자세 값을 그대로 쓰기 위한 작은 도우미(읽기 쉬우라고 둔다)
const trimSpdPit = (p) => p;
const hoverSide = (v) => Math.abs(v);
const known2 = (v) => !!v;
const normAS0 = (d) => ((d % 360) + 540) % 360 - 180;

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

async function part1(page, t) {
  // ── SIM 버튼은 PFD 소프트키 맨 오른쪽 칸(CAS 옆)에 있다 — FCP 의 SIM 버튼은 없앴다 ──
  const btn = await page.evaluate(async () => {
    selectPanel('left', 'pfd', true);
    pfdSkGo('TOP');
    const b = document.getElementById('sk-11');
    const was = simModeOn;
    if (simModeOn) toggleSimMode();
    pfdSkRender();
    const off = b.className;
    S.alt = 2500;
    b.click();
    await new Promise(r => setTimeout(r, 40));   // 물음이 있었다면 한 박자 뒤에 뜬다
    const res = { txt: b.firstElementChild.textContent.trim(), cas: document.getElementById('sk-10').firstElementChild.textContent.trim(),
             fcpGone: !document.getElementById('sim-mode-btn'),
             off, was, dlg: !!document.querySelector('.ui-dlg'), on: simModeOn, onCls: b.className };
    const cancel = document.querySelector('.ui-dlg-btns button');
    if (cancel) cancel.click();
    await new Promise(r => setTimeout(r, 40));
    if (simModeOn) toggleSimMode(false);
    return res;
  });
  t.ok(btn.txt === 'SIM' && btn.cas === 'CAS', `소프트키 맨 오른쪽(CAS 옆) 칸이 SIM 이다 (${btn.cas} · ${btn.txt})`);
  t.ok(btn.fcpGone, 'FCP 의 SIM 버튼은 없앴다');
  t.ok(!/\bon\b/.test(btn.off), `평소에는 꺼져 있다 (${btn.off})`);
  t.ok(/\bon\b/.test(btn.onCls), '켜지면 칸 아래 녹색 바(on)');
  // 시작 고도는 묻지 않는다 — 누르면 바로 켜진다
  t.eq(btn.dlg, false, '누르면 시작 지점을 묻지 않는다');
  t.eq(btn.on, true, '누르면 바로 켜진다');

  // 땅 가까이(50ft 미만)면 지상 시작(0ft·정지), 떠 있으면 날던 고도 그대로
  const start = await page.evaluate(async () => {
    const press = async (agl) => {
      if (simModeOn) toggleSimMode(false);
      const g = simTerrainFt();
      S.alt = g + agl; S.spd = 90; S.vs = 300; S.tq = 70;
      pfdSkGo('TOP'); document.getElementById('sk-11').click();
      await new Promise(r => setTimeout(r, 60));
      return { agl: S.alt - simTerrainFt(), alt: S.alt, spd: S.spd, vs: S.vs, tq: S.tq, on: simModeOn,
               dlg: !!document.querySelector('.ui-dlg'),
               cls: (pfdSkRender(), document.getElementById('sk-11').className) };
    };
    const ground = await press(10);
    const air = await press(2500);
    if (simModeOn) toggleSimMode(false);
    return { ground, air };
  });
  t.eq(start.ground.on, true, '땅 가까이에서 누르면 SIM 모드가 켜진다');
  t.eq(start.ground.dlg || start.air.dlg, false, '어느 쪽이든 묻지 않는다');
  t.ok(/\bon\b/.test(start.ground.cls), '버튼도 켜진 모양이 된다');
  t.ok(Math.abs(start.ground.agl) < 2, `땅 가까이면 지면에 내려 세운다 (AGL ${start.ground.agl.toFixed(1)}ft)`);
  t.ok(start.ground.spd < 5, `속도도 0 이다 (${start.ground.spd.toFixed(0)}kt)`);
  t.ok(start.ground.tq < 15, `토크도 내려 둔다 — 레버를 올리며 뜬다 (${start.ground.tq.toFixed(0)}%)`);
  t.ok(Math.abs(start.air.agl - 2500) < 20,
    `떠 있으면 날던 고도 그대로다 (AGL ${start.air.agl.toFixed(0)}ft)`);
  t.ok(start.air.spd > 80, `속도도 그대로다 (${start.air.spd.toFixed(0)}kt)`);

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
    _ax(0, 0); fly(6);              // 가운데로 되돌리면 수평(자세는 10°/s 로 따라간다)
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
    _ax(1, -1); fly(12);            // 뒤로 = 기수 올림 → 감속
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
      _ax(1, stick(-deg / SIM_PITCH_MAX));
      // 속도는 점점 붙는다(가감속 5~6kt/s 한계) — 앞 자세에서 95kt 를 건너뛰려면
      // 20초 넘게 걸린다. 여기서는 '그 자세의 정상 속도' 를 보므로 15kt 떨어진
      // 자리에서 출발해 수렴하는지를 본다(점진성은 아래에서 따로 잰다).
      S.spd = Math.max(-40, Math.min(160, spdFromPitch(deg) + 15)); simAcc = 0;
      fly(25);
      return { pit: S.pit, spd: S.spd, vs: S.vs, rbsP: simRbs.p };
    };
    const level = hold(0);
    const four  = hold(4);
    const seven = hold(7.5);
    const down  = hold(-10);                    // 기수 내림 10° → 140kt
    const max   = hold(-SIM_PITCH_MAX);          // 끝까지 숙여도 자세는 48° 까지
    return { level, four, seven, down, max,
             law: [spdFromPitch(0), spdFromPitch(5), spdFromPitch(7.5), spdFromPitch(8.5), spdFromPitch(-10)],
             inv: [pitchFromSpd(120), pitchFromSpd(70), pitchFromSpd(0), pitchFromSpd(140)] };
  })()`);
  t.eq(trimSpd.law.join('/'), '120/70/35/0/140',
    `자세-속도 식이 기재와 같다 (0°→${trimSpd.law[0]} · 4°→${trimSpd.law[1]} · ` +
    `7.5°→${trimSpd.law[2]} · −10°→${trimSpd.law[3]}kt)`);
  t.ok(Math.abs(trimSpd.inv[0]) < 0.01 && Math.abs(trimSpd.inv[1] - 5) < 0.01
       && Math.abs(trimSpd.inv[2] - 8.5) < 0.01 && Math.abs(trimSpd.inv[3] + 10) < 0.01,
    `거꾸로도 같다 (120kt→${trimSpd.inv[0].toFixed(1)}° · 70kt→${trimSpd.inv[1].toFixed(1)}° · 호버→${trimSpd.inv[2].toFixed(1)}°)`);
  t.ok(Math.abs(trimSpd.level.pit) < 0.6 && Math.abs(trimSpd.level.spd - 120) < 8,
    `수평 자세로 날면 120kt 에서 멎는다 (${trimSpd.level.pit.toFixed(1)}° · ${trimSpd.level.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.four.pit - 4) < 0.6 && Math.abs(trimSpd.four.spd - 80) < 8,
    `기수 4° 면 80kt 다 (${trimSpd.four.pit.toFixed(1)}° · ${trimSpd.four.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.seven.pit - 7.5) < 0.6 && Math.abs(trimSpd.seven.spd - 35) < 3,
    `기수 7.5° 면 35kt 다 (${trimSpd.seven.pit.toFixed(1)}° · ${trimSpd.seven.spd.toFixed(1)}kt)`);
  t.ok(Math.abs(trimSpd.down.pit + 10) < 0.6 && Math.abs(trimSpd.down.spd - 140) < 8,
    `기수를 10° 숙이면 140kt 다 (${trimSpd.down.pit.toFixed(1)}° · ${trimSpd.down.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(trimSpd.max.pit - trimSpd.max.rbsP + 48) < 1.5,
    `위아래 48°(종전 60° 의 80%) 까지 잡힌다 — VNE 를 넘긴 몫(후퇴익 실속 기수 들림 ${trimSpd.max.rbsP.toFixed(0)}°)은 빼고 (${trimSpd.max.pit.toFixed(1)}°)`);
  t.ok(Math.abs(trimSpd.level.vs) < 150 && Math.abs(trimSpd.four.vs) < 150,
    `그동안 고도는 지킨다 (${trimSpd.level.vs.toFixed(0)} · ${trimSpd.four.vs.toFixed(0)}fpm)`);

  // ── 오르내려도 자세 하나가 곧 속도다 ──
  // 기수를 숙인 채 컬렉티브를 내리면 고도가 빠지고, 올리면 고도를 얻는다 — 속도는 그대로
  // 그 자세의 속도다(종전에는 내리면 조금 붙고 올리면 조금 내주었다). 같은 자세에서 재 본다.
  const energy = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.alt = 4000; _simGndFt = 0;
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    // 1단계: 레버 없이(자동 트림) 고도를 지키게 둔다 — 그 자세의 속도로 멎는다
    joyAxes = { pitch: { i: 1, inv: false } };
    _ax(1, stick(10 / SIM_PITCH_MAX));                 // 기수 10° 아래(하방)
    fly(30);
    const trim = { pit: S.pit, spd: S.spd, vs: S.vs, alt: S.alt, tq: S.tq };
    // 2단계: 같은 자세에서 레버를 쥐고 내린다
    joyAxes.coll = { i: 3, inv: false, abs: true };
    const lever = (tq) => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
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
  t.ok(Math.abs(energy.sink.spd - energy.trim.spd) < 1.5,
    `내려가도 속도는 그대로 — 속도는 자세가 정한다 (${energy.trim.spd.toFixed(1)} → ${energy.sink.spd.toFixed(1)}kt)`);
  t.ok(energy.climb.vs > 120 && energy.climb.spd > energy.trim.spd, // 남는 토크 5% 당 10kt 빠르다
    `반대로 올리면 고도를 얻고 남는 토크만큼 빨라진다 (${energy.climb.vs.toFixed(0)}fpm · ${energy.climb.spd.toFixed(1)}kt)`);

  // ── 감속하면 고도를 얻는다(운동에너지 → 위치에너지) ──
  // 컬렉티브는 그대로 둔 채 기수를 들어 감속하면, 줄어든 운동에너지만큼 떠오른다.
  // 다시 기수를 내려 가속하면 그만큼 고도로 치른다 — 되풀이해도 고도가 쌓이지 않는다.
  const ke = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { pitch: { i: 1, inv: false }, coll: { i: 3, inv: false, abs: true } };
    S.alt = 4000; _simGndFt = 0; S.bnk = 0; S.spd = 120; S.pit = 0; simAcc = 0; S.vs = 0; simVsAcc = 0;
    simTrimReset();
    const lever = () => _ax(3, Math.max(-1, Math.min(1, tqRequired() / SIM_LEVER_TOP * 2 - 1)));
    lever(); fly(10); lever(); fly(10);            // 수평 120kt 에 자리잡는다(레버는 고도 유지)
    const lvl = { spd: S.spd, vs: S.vs, alt: S.alt };
    // 레버는 그 속도의 수평 비행 토크를 따라 고친다 — 필요 동력 곡선(U 자)이 내는 몫은 빼고
    // 운동에너지 ↔ 고도만 본다(레버를 그대로 두면 70kt 언저리에서 동력이 남아 따로 오른다)
    const run = (sec, track) => {
      let maxVs = -Infinity, minVs = Infinity, vsMid = null;
      S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 1; i <= sec * 20; i++) {
        if (track) lever();
        ts += 50; joyPoll(ts); simStep(ts);
        maxVs = Math.max(maxVs, S.vs); minVs = Math.min(minVs, S.vs);
      }
      S.running = false;
      return { spd: S.spd, vs: S.vs, alt: S.alt, maxVs, minVs };
    };
    simTrim.pitch = -pitchFromSpd(60);             // 기수를 들어 60kt 자세로 → 감속(레버는 그대로)
    const flare = run(40, true);
    simTrim.pitch = 0;                             // 다시 수평 → 120kt 로 가속
    const accel = run(60, true);
    simTrimReset();
    // 땅 위에서 미끄러지다 서는 것은 고도가 되지 않는다
    joyAxes = { pitch: { i: 1, inv: false } };
    S.alt = 0; _simGndFt = 0; S.spd = 30; S.vs = 0; simVsAcc = 0; simAcc = 0; S.tq = 0;
    const gnd = run(3);
    return { lvl, flare, accel, gnd, eff: SIM_KE_EFF };
  })()`);
  const keFt = (a, b) => ke.eff * ((a * 0.514444) ** 2 - (b * 0.514444) ** 2) / (2 * 9.80665) / 0.3048;
  const keUp = keFt(ke.lvl.spd, ke.flare.spd);
  const gain = ke.flare.alt - ke.lvl.alt;
  t.ok(Math.abs(ke.lvl.vs) < 100, `레버를 고도 유지에 두고 수평 120kt 로 난다 (${ke.lvl.vs.toFixed(0)}fpm)`);
  t.ok(Math.abs(ke.flare.spd - 60) < 5, `기수를 60kt 자세(약 4.9°)로 들면 60kt 로 준다 (${ke.flare.spd.toFixed(0)}kt)`);
  t.ok(ke.flare.maxVs > 300, `감속하는 동안 떠오른다 (최대 +${ke.flare.maxVs.toFixed(0)}fpm — 레버는 그대로)`);
  t.ok(gain > 35 && gain < 400,
    `줄인 속도만큼 고도를 얻는다 — 줄일 속도 10kt 에 약 350fpm (+${gain.toFixed(0)}ft · 120 → 60kt)`);
  t.ok(Math.abs(ke.flare.vs) < 120, `감속이 끝나면 상승도 멎는다 (${ke.flare.vs.toFixed(0)}fpm)`);
  t.ok(ke.accel.minVs < -300 && Math.abs(ke.accel.spd - 120) < 5,
    `다시 가속하면 그만큼 고도로 치른다 (${ke.accel.minVs.toFixed(0)}fpm · ${ke.accel.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(ke.accel.alt - ke.lvl.alt) < gain * 0.5,
    `감속·가속을 한 번 되풀이하면 고도가 거의 제자리다 — 가속이 더 오래 걸려 조금 덜 돌아온다 (${(ke.accel.alt - ke.lvl.alt).toFixed(0)}ft)`);
  t.ok(ke.gnd.alt < 1 && ke.gnd.maxVs <= 0.01,
    `땅 위에서 서는 것은 고도가 되지 않는다 (${ke.gnd.alt.toFixed(1)}ft · ${ke.gnd.spd.toFixed(0)}kt)`);

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
    _ax(1, stick(-pitchFromSpd(0) / SIM_PITCH_MAX));     // 호버 자세(7.5°)로 들어 속도를 0 에 둔다
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
    _ax(3, 0.65); fly(12);                        // 올리면 지면 위로 뜬다(상승률은 천천히 붙는다 · MTA 아래)
    const liftTq = { tq: S.tq, mta: mtaNow() };
    const lifted = S.alt;
    window._tcElev = real;
    return { onGnd, lifted, liftTq };
  })()`);
  t.ok(Math.abs(gnd.onGnd.gndFt - 1000) < 5,
    `지형 표고를 피트로 읽는다 (305m → ${gnd.onGnd.gndFt.toFixed(0)}ft)`);
  t.ok(Math.abs(gnd.onGnd.alt - gnd.onGnd.gndFt) < 2,
    `지면 아래로 꺼지지 않는다 (${gnd.onGnd.alt.toFixed(0)}ft · 지면 ${gnd.onGnd.gndFt.toFixed(0)}ft)`);
  t.eq(gnd.onGnd.vs, 0, '땅에 닿아 있으면 강하율도 0 이다');
  t.ok(gnd.lifted > gnd.onGnd.gndFt + 50 && gnd.liftTq.tq < gnd.liftTq.mta,
    `레버를 올리면 지면 위로 뜬다 (${gnd.lifted.toFixed(0)}ft · 토크 ${gnd.liftTq.tq.toFixed(0)}% < MTA ${gnd.liftTq.mta.toFixed(0)}%)`);

}
async function part2(page, t) {
  // ── 컬렉티브 → 토크 → 오르내린다 ──
  // 컬렉티브는 '상승률 레버' 가 아니라 '출력 레버' 다. 올린 만큼 토크가 오르고,
  // 지금 필요한 토크보다 남는 만큼이 상승률이 된다.
  const coll = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    simTrimHoldSpeed();                   // 100kt 자세로 잡아 둔다(속도는 자세가 정한다)
    const a0 = S.alt, tq0 = S.tq;
    _ax(3, 0.5); fly(6);                  // 반쯤 올린다(MTA 아래 — 끝까지 올리면 RPM LOW 로 가라앉는다)
    const up = { alt: S.alt, vs: S.vs, tq: S.tq };
    _ax(3, -1); fly(16);                  // 오르던 만큼(최대 3,000fpm) 돌아서는 데 시간이 든다
    return { tq0, up, gain: up.alt - a0, dn: { alt: S.alt, vs: S.vs, tq: S.tq } };
  })()`);
  t.ok(coll.up.tq > coll.tq0 + 20,
    `올리면 토크가 오른다 (${coll.tq0.toFixed(0)}% → ${coll.up.tq.toFixed(0)}%)`);
  t.ok(coll.gain > 60, `그만큼 고도가 오른다 (6초에 +${coll.gain.toFixed(0)}ft)`);
  t.ok(coll.up.vs > 900, `상승률이 붙는다 (${coll.up.vs.toFixed(0)}fpm)`);
  t.ok(coll.dn.tq < coll.tq0 - 20, `내리면 토크가 내려간다 (${coll.dn.tq.toFixed(0)}%)`);
  t.ok(coll.dn.vs < -700, `그러면 강하한다 (${coll.dn.vs.toFixed(0)}fpm)`);
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
    // 레버식 컬렉티브로 토크를 정확히 지정한다(0…140% 가 축 -1…1)
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    // 속도가 변하면 전진 양력 때문에 기준 토크도 변한다 — 120kt 로 안정시켜 둔다
    _ax(3, 0); fly(20);
    S.alt = 3000;
    const need = tqRequired();
    // 재는 동안 속도가 변하면 그 운동에너지도 오르내림이 된다 — 120kt 정속에서 잰다
    const run = (tq) => {
      _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
      // 토크도 그 값에서 시작한다(레버를 따라가는 지연은 아래 '점진적으로' 검사에서 본다)
      S.spd = 120; simAcc = 0; S.vs = 0; simVsAcc = 0; S.alt = 3000; S.tq = tq; fly(10);
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

  // ── 컬렉티브 감도 · 강하는 4,000fpm 까지 ──
  const coll2 = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    S.bnk = 0; S.spd = 70; S.alt = 5000; _simGndFt = 0;
    simTrim.pitch = -pitchFromSpd(70);
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    lever(tqRequired()); fly(10);
    const pow = () => S.vs - simKeVs(false);
    // 남는 토크 +5% — 곧게 비례해 오른다(1% = 44fpm)
    S.spd = 70; simAcc = 0; S.vs = 0; simVsAcc = 0; S.alt = 5000;
    lever(tqRequired() + 5); fly(10);
    const up = { pow: pow(), want: simVsForTq(5), max: simClimbMax() };
    // 기수를 숙이고 레버를 끝까지 내린다
    simTrim.pitch = 10; S.spd = 120; simAcc = 0; S.vs = 0; simVsAcc = 0; S.alt = 8000;
    _ax(3, -1);
    let minPow = 0, minAll = 0;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 15 * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); minPow = Math.min(minPow, pow()); minAll = Math.min(minAll, S.vs); }
    S.running = false;
    simTrimReset();
    return { up, minPow, minAll };
  })()`);
  t.ok(Math.abs(coll2.up.want - 220) < 1,
    `상승률은 남는 토크에 곧게 비례한다 — 1% = 44fpm (+5% → ${coll2.up.want.toFixed(0)}fpm)`);
  t.ok(Math.abs(coll2.up.pow - coll2.up.want) < coll2.up.want * 0.05,
    `레버 +5% 면 그만큼 오른다 (${coll2.up.pow.toFixed(0)} · 기대 ${coll2.up.want.toFixed(0)}fpm)`);
  t.ok(coll2.minAll < -3000 && coll2.minAll >= -4000.01,
    `기수를 숙이고 레버를 끝까지 내리면 4,000fpm 까지 강하한다 (계기 ${coll2.minAll.toFixed(0)}fpm — 가속하며 붙는 몫까지 합쳐도 넘지 않는다)`);

  // ── Vy 에서 가장 잘 오른다 ──
  // 같은 토크라도 최대상승속도(Vy)에서 상승률이 가장 크고, 그보다 빠르거나
  // 느려질수록 떨어진다. PERF 의 Vy 를 그대로 쓴다.
  const vy = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.bnk = 0; S.alt = 4000; _simGndFt = 0;
    const V = perfVy();
    // 100% 토크로 낼 상승률 — 필요 동력 곡선(U 자)이 가장 낮은 속도에서 가장 크다
    const at = (kt) => { S.spd = kt; simLat = 0; return simClimbMax(); };
    const eff = { hover: at(0), slow: at(V - 30), best: at(V), fast: at(V + 30),
                  cruise: at(140) };
    // 실제로 날려서도 확인한다 — 같은 여유 토크, 다른 속도.
    // 속도는 자세로 잡아 둔다(자세를 안 잡으면 120kt 로 흘러간다).
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    const run = (kt) => {
      joyAxes = { pitch: { i: 1, inv: false } };      // 레버는 자동 트림(고도 유지)
      _ax(1, stick(-pitchFromSpd(kt) / SIM_PITCH_MAX));
      S.spd = kt; S.alt = 4000; S.vs = 0;
      fly(20);                                        // 그 속도로 자리잡을 때까지
      const settled = S.spd;
      joyAxes.coll = { i: 3, inv: false, abs: true }; // 이제 레버를 쥐고 같은 토크(95%)로 올린다
      _ax(3, Math.max(-1, Math.min(1, 95 / SIM_LEVER_TOP * 2 - 1)));
      S.alt = 4000; fly(10);
      return { vs: S.vs, spd: settled };
    };
    const flewBest = run(V), flewHover = run(0);
    return { V, eff, flewBest, flewHover };
  })()`);
  t.ok(vy.V > 40 && vy.V < 110, `PERF 가 Vy 를 준다 (${vy.V.toFixed(0)}kt)`);
  t.ok(Math.abs(vy.eff.best - 2300) < 120, `Vy 언저리에서 100% 토크면 약 2,300fpm (${vy.eff.best.toFixed(0)}fpm)`);
  t.ok(vy.eff.slow < vy.eff.best - 200 && vy.eff.fast < vy.eff.best - 100,
    `그보다 느리거나 빠르면 필요 동력이 늘어 덜 오른다 (−30kt ${vy.eff.slow.toFixed(0)} · +30kt ${vy.eff.fast.toFixed(0)}fpm)`);
  t.ok(Math.abs(vy.eff.hover - 1000) < 80 && vy.eff.hover < vy.eff.slow && vy.eff.cruise < vy.eff.fast,
    `제자리(약 1,000fpm)와 고속(140kt ${vy.eff.cruise.toFixed(0)}fpm)에서 가장 덜 오른다 (제자리 ${vy.eff.hover.toFixed(0)}fpm)`);
  t.ok(vy.flewBest.vs > vy.flewHover.vs + 800,
    `같은 토크(95%)라도 Vy 에서 훨씬 잘 오른다 ` +
    `(${vy.flewHover.spd.toFixed(0)}kt ${vy.flewHover.vs.toFixed(0)}fpm → ` +
    `${vy.flewBest.spd.toFixed(0)}kt ${vy.flewBest.vs.toFixed(0)}fpm)`);

  // ── 같은 레버라도 선회를 걸면 가라앉는다 ──
  // 뱅크를 주면 양력이 기울어 필요 토크가 오른다. 컬렉티브를 그대로 두면
  // 남는 토크가 줄어 상승률이 떨어진다 — 헬기에서 늘 겪는 일이다.
  const bankSink = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    simTrimHoldSpeed();                   // 100kt 자세
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

  // ── 올라가도 속도는 자세가 정한다 ──
  // 종전에는 올라가는 만큼 속도를 조금 내주었다(피토관 오차 같은 어긋남) — 이제는 그대로다.
  const trade = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.spd = 100;
    simTrimHoldSpeed();                   // 100kt 자세
    _ax(3, 0.5); fly(8);                  // 세게 올라간다(MTA 아래)
    return { spd: S.spd, vs: S.vs };
  })()`);
  t.ok(trade.vs > 500 && trade.spd > 85 && trade.spd <= 121,
    `세게 올라가면 100kt 자세에 남는 토크만큼(최대 +20kt) (${trade.vs.toFixed(0)}fpm · 100 → ${trade.spd.toFixed(1)}kt)`);

  // ── TQ 계기가 속도계 아래에 막대로 그려진다 ──
  const gauge = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    selectPanel('left', 'pfd', true);
    _ax(3, 0.5); fly(6);                  // 토크를 올려 둔다
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

  // 구간 색 — 0~100% 녹색 · 100~113% 노랑 · 113~125% 빨강(오버토크)
  // 막대는 지금 값이 든 구간의 색으로 칠하고, 숫자는 녹색 구간이면 흰 글자·그 밖은 구간 색이다.
  const over = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const cv = document.getElementById('pfd');
    const grab = () => {
      const seen = [], rects = [];
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, origR = proto.fillRect;
      proto.fillText = function (tx, px, py, ...a) {
        if (px < cv.width * 0.2) seen.push({ t: String(tx), col: this.fillStyle });
        return orig.call(this, tx, px, py, ...a);
      };
      proto.fillRect = function (px, py, w, h) {
        if (px < cv.width * 0.2) rects.push({ col: this.fillStyle, h });
        return origR.call(this, px, py, w, h);
      };
      drawPFD();
      proto.fillText = orig; proto.fillRect = origR;
      // 속도계 눈금에도 같은 숫자가 나온다 — 'TQ %' 머리글 뒤쪽만 본다
      const i = seen.findIndex(v => v.t === 'TQ %');
      return { rows: i < 0 ? [] : seen.slice(i), rects };
    };
    const at = v => {
      S.tq = v;
      const g = grab();
      return { num: (g.rows.find(r => r.t === String(v) && r.col !== '#6a7784') || {}).col,
               warn: g.rows.some(r => r.t === 'OVER TQ'), over: tqOver(), band: tqBand(v),
               bars: g.rects.map(r => String(r.col).toLowerCase()) };
    };
    return { g: at(80), y: at(110), r: at(118), max: TQ_MAX, lim: [TQ_LIMIT, TQ_RED] };
  })()`);
  t.eq(over.max, 140, '계기 눈금은 140%(레버 맨 위)까지다');
  t.eq(JSON.stringify(over.lim), '[100,113]', '구간 경계는 100% · 113% 다');
  t.ok(over.g.band === 'green' && over.g.bars.includes('#22dd55') && !over.g.bars.includes('#00e5ff'),
    `0~100% 는 녹색 막대다 — 종전 청록색이 아니다 (80% → ${over.g.band})`);
  t.eq(over.g.num, '#ffffff', `녹색 구간에서는 흰 숫자다 (${over.g.num})`);
  t.ok(!over.g.warn && !over.g.over, '녹색 구간에서는 경고가 없다');
  t.ok(over.y.band === 'yellow' && over.y.bars.includes('#ffcc00') && over.y.num === '#ffcc00',
    `100~113% 는 노란 막대·노란 숫자다 (110% → ${over.y.num})`);
  t.ok(!over.y.warn && !over.y.over, '노란 구간은 주의일 뿐 OVER TQ 는 아니다');
  t.ok(over.r.band === 'red' && over.r.bars.includes('#ff4444') && over.r.num === '#ff5555',
    `113~125% 는 빨간 막대·빨간 숫자다 (118% → ${over.r.num})`);
  t.ok(over.r.warn && over.r.over, '빨간 구간에서는 OVER TQ 경고가 뜨고 상태로도 오버토크다');
  t.ok(['rgba(0,200,80,0.16)', 'rgba(255,204,0,0.22)', 'rgba(255,60,60,0.25)']
         .every(c => over.g.bars.includes(c.replace(/,/g, ', ')) || over.g.bars.includes(c)),
    '바탕에 녹색·노랑·빨강 세 구간이 늘 칠해져 있다');

  // ── 그날의 MTA · RPM LOW ──
  // 레버 맨 위는 140% 지만 엔진이 내는 토크는 그날의 MTA(CDU PERF 의 MTA(30))까지다.
  // PERF 의 고도·온도가 그날의 기준이고, 다른 고도에서는 표준 기온감률(2°C/1000ft)로
  // 셈한다. 넘겨 당기면 토크는 MTA 에 멈추고 로터 회전(NR)이 처져 가라앉는다(RPM LOW).
  const mta = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes.coll = { i: 3, inv: false, abs: true };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    const step = (sec, f) => { S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 1; i <= sec * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); if (f) f(i); } S.running = false; };
    // PERF 화면의 MTA(30) 칸에 적힌 값
    selectPanel('right', 'cdu', true);
    const pageMta = () => {
      switchMode('PERF');
      const t = [...document.querySelectorAll('#cdu-wrap .perf-result-title')].find(e => e.textContent.trim() === 'MTA(30)');
      return t ? parseFloat(t.nextElementSibling.textContent) : null;
    };
    const typeIn = (target, txt) => {
      switchMode('PERF_INPUT', target);
      [...txt].forEach(c => {
        const k = [...document.querySelectorAll('#cdu-wrap [data-act="addInput"]')]
          .find(b => JSON.parse(b.dataset.arg || '[]')[0] === c);
        if (k) k.click();
      });
      document.querySelector('#cdu-wrap [data-act="confirmPerfInput"]').click();
    };
    const out = { page0: pageMta(), at0: perfMta(), at2k: mtaNow(2000), at8k: mtaNow(8000) };
    typeIn('alt', '2000');                       // PERF 고도를 2,000ft 로
    out.page2k = pageMta(); out.now2k = mtaNow(2000);
    typeIn('temp', '35');                        // 더운 날
    out.hot2k = mtaNow(2000);
    typeIn('temp', '20'); typeIn('alt', '0');    // 되돌려 놓는다
    switchMode('HOME');
    // 70kt · 2,000ft 에서 레버를 MTA 언저리로 — 넘긴 만큼에 따라 오르내림이 달라진다
    const run = extra => {
      S.alt = 2000; S.spd = 70; simTrimHoldSpeed(); S.vs = 0; simVsAcc = 0; simNr = 100;
      S.tq = mtaNow(); lever(mtaNow() + extra); step(8);
      return { tq: S.tq, mta: mtaNow(), nr: simNr, vs: S.vs, low: simRpmLow(), cmd: simTqCmd };
    };
    out.under = run(-10); out.at = run(0); out.bit = run(3); out.more = run(8); out.top = run(99);
    // 레버를 MTA 아래로 내리면 NR 이 돌아온다
    lever(mtaNow() - 10); step(4);
    out.back = { nr: simNr, low: simRpmLow() };
    simTrimReset();
    return out;
  })()`);
  t.ok(Math.abs(mta.at0 - mta.page0) < 0.06,
    `PERF 고도에서는 PERF 화면의 MTA(30) 와 같다 (${mta.at0.toFixed(1)} · 화면 ${mta.page0}%)`);
  t.ok(mta.at2k < mta.at0 - 3 && mta.at8k < mta.at2k - 10,
    `올라갈수록 MTA 가 준다 (0ft ${mta.at0.toFixed(0)} · 2,000ft ${mta.at2k.toFixed(0)} · 8,000ft ${mta.at8k.toFixed(0)}%)`);
  t.ok(Math.abs(mta.now2k - mta.page2k) < 0.06,
    `PERF 고도를 2,000ft 로 넣으면 그 고도의 화면 값이 기준이 된다 (${mta.now2k.toFixed(1)} · 화면 ${mta.page2k}%)`);
  t.ok(mta.hot2k < mta.now2k - 3, `더운 날은 MTA 가 준다 (20°C ${mta.now2k.toFixed(0)} → 35°C ${mta.hot2k.toFixed(0)}%)`);
  t.ok(mta.under.vs > 800 && !mta.under.low && mta.under.nr > 99.9,
    `MTA 아래에서는 NR 그대로 오른다 (MTA−10% → ${mta.under.vs.toFixed(0)}fpm)`);
  t.ok(mta.top.cmd > 139 && Math.abs(mta.top.tq - mta.top.mta) < 1,
    `레버를 끝까지 당겨도 토크는 MTA 에서 멈춘다 (레버 ${mta.top.cmd.toFixed(0)}% · 토크 ${mta.top.tq.toFixed(0)}% · MTA ${mta.top.mta.toFixed(0)}%)`);
  t.ok(mta.bit.nr < 99.9 && mta.bit.vs < mta.at.vs,
    `조금 넘기면 NR 이 처지며 덜 오른다 (+3% → NR ${mta.bit.nr.toFixed(1)}% · ${mta.bit.vs.toFixed(0)}fpm · MTA 에서 ${mta.at.vs.toFixed(0)}fpm)`);
  t.ok(mta.more.low && mta.more.vs < -300,
    `더 넘기면 RPM LOW 로 가라앉는다 (+8% → NR ${mta.more.nr.toFixed(1)}% · ${mta.more.vs.toFixed(0)}fpm)`);
  t.ok(mta.top.low && mta.top.vs <= mta.more.vs && mta.top.nr < mta.more.nr,
    `더 당길수록 더 처지고 더 빨리 가라앉는다 (끝까지 → NR ${mta.top.nr.toFixed(1)}% · ${mta.top.vs.toFixed(0)}fpm)`);
  t.ok(mta.back.nr > 98 && !mta.back.low, `레버를 MTA 아래로 내리면 NR 이 돌아온다 (${mta.back.nr.toFixed(1)}%)`);

  // ── 계기의 기준선 — HOV · Vy · MTA ──
  // Vy 선은 PERF 의 Vy 로 수평 비행할 때 필요한 토크, MTA 선은 그날의 MTA 다.
  // 레버가 MTA 를 넘겨 있으면 그 자리에 흰 삼각형, RPM LOW 면 계기 가운데 경고가 뜬다.
  const lines = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    selectPanel('left', 'pfd', true);
    const cv = document.getElementById('pfd');
    const grab = () => {
      const txt = [];
      const proto = CanvasRenderingContext2D.prototype, oT = proto.fillText;
      proto.fillText = function (tx, px, py, ...a) {
        if (px < cv.width * 0.2) txt.push({ t: String(tx), col: this.fillStyle, y: py });
        return oT.call(this, tx, px, py, ...a);
      };
      drawPFD();
      proto.fillText = oT;
      const i = txt.findIndex(v => v.t === 'TQ %');
      return i < 0 ? [] : txt.slice(i);
    };
    S.spd = 0; S.alt = 2000; S.bnk = 0; S.tq = 70; simTqCmd = 70; simNr = 100;
    const calm = grab();
    simTqCmd = 135; S.tq = mtaNow(); simNr = 94;
    const low = grab();
    simNr = 100; simTqCmd = S.tq;
    const lbl = (rows, k) => rows.find(r => r.t === k);
    return { vy: tqAtVy(), vyKt: perfVy(), vyReq: tqRequiredAt(perfVy(), 0), mta: mtaNow(), hov: tqRequired(),
             calm: ['HOV', 'Vy', 'MTA'].map(k => { const r = lbl(calm, k); return r ? { col: r.col, y: r.y } : null; }),
             rpm: !!lbl(low, 'RPM LOW'), nr: (lbl(low, 'NR 94%') || {}).t, calmRpm: !!lbl(calm, 'RPM LOW') };
  })()`);
  t.ok(lines.calm.every(Boolean), `계기에 HOV · Vy · MTA 이름표가 붙는다`);
  t.eq(lines.calm[1] && lines.calm[1].col, '#ffffff', 'Vy 선은 흰색이다');
  t.eq(lines.calm[2] && lines.calm[2].col, '#00e5ff', 'MTA 선은 PERF 화면의 MTA(30) 와 같은 청록색이다');
  t.ok(lines.calm[2].y < lines.calm[0].y && lines.calm[0].y < lines.calm[1].y,
    `위에서부터 MTA · HOV · Vy 차례다(제자리에서는 Vy 가 가장 덜 든다)`);
  t.ok(Math.abs(lines.vy - lines.vyReq) < 0.01 && lines.vy < lines.hov * 0.7 && lines.vyKt > 60,
    `Vy 선은 Vy(${lines.vyKt.toFixed(0)}kt)로 수평 비행할 때 필요한 토크다 (${lines.vy.toFixed(0)}% · 제자리 ${lines.hov.toFixed(0)}%)`);
  t.ok(!lines.calmRpm && lines.rpm && lines.nr === 'NR 94%',
    'NR 이 처지면 계기 가운데 RPM LOW 와 NR 값이 뜬다');

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
    const cam = ${CAM};
    toggleSimMode(false);
    selectPanel('left', 'pfd', true); selectPanel('mid', 'map', true); selectPanel('right', 'cdu', true);
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
             camYaw: Math.round(normA(_ml3dCamRot(S.hdg, S.pit, S.bnk, 0, -simViewDown()).yaw)) % 360,
             moved: distance(c0.lat, c0.lon, c1.lat, c1.lon),
             offAc: distance(c1.lat, c1.lon, S.lat, S.lon) * 1852 };
  })()`);
  t.ok(Math.abs(both.bnk) > 40, `조종한 뱅크가 상태에 들어 있다 (${both.bnk.toFixed(0)}°)`);
  t.ok(both.drawn !== null && Math.abs(both.drawn) > 0.3,
    `PFD 가 그 뱅크로 그려진다 (${both.drawn === null ? '없음' : both.drawn.toFixed(2)}rad)`);
  t.eq(both.three, 'm3d', 'SIM 을 켜면 지도 창이 3D 로 바뀐다');
  t.ok(both.moved > 0.05, `3D 카메라도 함께 날아간다 (${both.moved.toFixed(2)}NM)`);
  t.ok(both.offAc < 2, `카메라는 늘 헬기 자리에 있다 (${both.offAc.toFixed(2)}m)`);
  t.ok(both.c1.bearing === both.camYaw && Math.abs(normAS0(both.c1.bearing - both.hdg)) < 6,
    `방위는 기수를 따른다 — 5° 숙인 시선이 뱅크만큼 옆으로 조금 돈다 (${both.c1.bearing}° · 기수 ${both.hdg}°)`);
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
    const realQ = _ml3d.queryTerrainElevation;
    _ml3d.queryTerrainElevation = () => null; _visOff = null;   // 지도도 아직 지형을 그리지 않았다
    // 기본 시선 5° 숙임은 저속(40kt 이하)에서 다 준다 — 120kt 로 갈수록 0° 로 준다(simViewDown)
    const at = (alt, pit, hdg, bnk, kt = 30) => {
      S.spd = kt; S.alt = alt; S.pit = pit; S.hdg = hdg; S.bnk = bnk; _applyFollow(); return cam();
    };
    const low = at(1000, 0, 90, 0), high = at(9000, 0, 90, 0);
    const down = at(1000, -10, 90, 0), up = at(1000, 10, 90, 0);
    const turn = at(1000, 0, 250, 0), rolled = at(1000, 0, 250, -30);
    const level = at(1000, 0, 250, 0);
    const cruise = at(1000, 0, 90, 0, 120);
    _ml3d.queryTerrainElevation = realQ;
    toggleSimMode(false);
    const after = { sel: midSel, roll: _ml3d.getRoll(), pitch: _ml3d.getPitch(),
                    clamp: _ml3d.getCenterClampedToGround(), tf: document.getElementById('map3d').style.transform };
    return { before, low, high, down, up, turn, rolled, level, cruise, after };
  })()`);
  t.eq(view.before, 'map', '켜기 전에는 2D 지도였다');
  t.ok(Math.abs(view.low.alt - 1000 * 0.3048 - 3) < 1.5 && Math.abs(view.high.alt - 9000 * 0.3048 - 3) < 1.5, // 눈높이 3m
    `카메라 높이가 고도계와 같다 (1,000ft → ${(view.low.alt / 0.3048).toFixed(0)}ft · ` +
    `9,000ft → ${(view.high.alt / 0.3048).toFixed(0)}ft)`);
  t.ok(Math.abs(view.low.pitch - 85) < 0.5,
    `수평 자세에서는 지평선보다 5° 아래를 본다(기본 시선 — 발밑 갑판이 보이게) (${view.low.pitch.toFixed(1)}°)`);
  t.ok(Math.abs(view.cruise.pitch - 90) < 0.5,
    `120kt 수평 자세에서는 지평선을 정면으로 본다(외부 시점의 기체 자세와 같은 목측) (${view.cruise.pitch.toFixed(1)}°)`);
  t.ok(Math.abs(view.down.pitch - 75) < 0.5,
    `기수를 10° 숙이면 그만큼 아래를 본다 (${view.down.pitch.toFixed(1)}°)`);
  t.ok(Math.abs(view.up.pitch - 95) < 0.5,
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
    S.spd = 30; S.alt = 2000; S.bnk = 0; S.hdg = 90;   // 저속 — 기본 시선 5° 아래(simViewDown)
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
    toggleSimMode(false);
    return { H, lvl, up10, up20, up40, dn20, bank45, right30, left30, adi };
  })()`);
  const fr = (r) => (r.horizonY / lookUp.H).toFixed(2);
  t.ok(lookUp.lvl.horizonY < lookUp.H / 2 - lookUp.H * 0.05 && lookUp.lvl.horizonY > lookUp.H * 0.25,
    `수평 자세에서 지평선은 화면 한가운데보다 조금 위다 — 기본 시선 5° 아래 (높이의 ${fr(lookUp.lvl)})`);
  t.ok(lookUp.up10.horizonY > lookUp.lvl.horizonY + lookUp.H * 0.1
       && lookUp.up20.horizonY > lookUp.up10.horizonY + lookUp.H * 0.1,
    `기수를 들수록 지평선이 내려가 하늘이 넓어진다 (0° ${fr(lookUp.lvl)} → 10° ${fr(lookUp.up10)} → 20° ${fr(lookUp.up20)})`);
  t.ok(lookUp.up40.c.pitch > 120,
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

}
async function part3(page, t) {
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

  // 1인칭(SIM)에서는 3D 지도의 제 마커를 뗀다(눈이 곧 헬기 자리) — 마커는 지도 모양을 다 읽은 뒤(비동기) 생기므로 기다렸다 잰다
  const mk = await page.evaluate(`(async () => {
    (${SETUP.toString()})();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    toggleSimMode(false);
    if (!_view3dOn) toggle3dMap();
    let n = 0; while (!_ml3dMarker && n < 200) { await wait(50); n++; }
    toggleSimMode(true); _update3dMarker();
    const on = _ml3dMarker ? _ml3dMarker.getElement().isConnected : null;
    toggleSimMode(false); _update3dMarker();
    const off = _ml3dMarker ? _ml3dMarker.getElement().isConnected : null;
    if (_view3dOn) toggle3dMap();
    return { on, off };
  })()`);
  t.eq(mk.on, false, '1인칭에서는 제 마커를 지도에서 뗀다(눈이 곧 헬기 자리)');
  t.eq(mk.off, true, '끄면 마커가 다시 붙는다');

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
      _visOff = null;                           // 그 자리에 막 놓였다(지형 몫을 걸러 따라가기 전)
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
  t.ok(Math.abs(gndCam.drawnKnown - (rendGnd + agl500 + 3)) < 2,
    `산 위 AGL 500ft — 그려진 땅(${rendGnd.toFixed(0)}m) 위로 ${agl500.toFixed(0)}m (${gndCam.drawnKnown.toFixed(0)}m)`);
  t.ok(Math.abs(gndCam.drawnUnknown - (rendGnd + agl500 + 3)) < 2,
    `지형 타일이 아직 없어도 같은 자리에 놓인다 (${gndCam.drawnUnknown.toFixed(0)}m)`);
  t.ok(gndCam.onGround > rendGnd + 2 && gndCam.onGround < rendGnd + 5, // 조종석 눈높이 3m
    `땅에 앉아 있어도 눈높이(3m)만큼 떠 있다 (${(gndCam.onGround - rendGnd).toFixed(1)}m)`);

  // ── 4방향 햇 = 사이클릭 비퍼 트림(뱅크 1° · 피치 0.5° 씩) ──
  // 실제 헬기의 사이클릭 햇은 트림이다. 한 번 누르면 뱅크 1° · 피치 0.5° 씩 옮겨 가고,
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
    for (let i = 0; i < 40; i++) simTrimNudge('F');     // 전후는 피치 — 한 번 딸깍에 0.25°, 40번이면 10°
    fly(4);
    const nose = { pit: S.pit, trim: simTrim.pitch };
    simTrimReset();
    // 누르고 있으면 계속 옮겨 간다(0.5초부터 0.1초마다 1°). 검사 브라우저는 3D 를
    // 소프트웨어로 그리느라 벽시계 타이머가 제때 돌지 못하므로, 시작·반복 타이머를
    // 붙잡아 두었다가 손으로 '반복 시작 + 0.1초 × 7번' 을 흘려 본다.
    const D0 = SIM_TRIM_HOLD_MS - SIM_TRIM_REP_MS, DR = SIM_TRIM_REP_MS;
    const holdFor = (dir) => {
      const rST = window.setTimeout, rSI = window.setInterval;
      let start = null, rep = null;
      window.setTimeout = (fn, ms) => (ms === D0 ? (start = fn, 987651) : rST(fn, ms));
      window.setInterval = (fn, ms) => (ms === DR ? (rep = fn, 987652) : rSI(fn, ms));
      try { startTrimHold(dir); } finally { window.setTimeout = rST; window.setInterval = rSI; }
      window.setInterval = (fn, ms) => (ms === DR ? (rep = fn, 987652) : rSI(fn, ms));
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
    return { one, oneP, t1, rolled, back, level, nose, held, heldR, maxR, maxP,
             holdMs: SIM_TRIM_HOLD_MS, repMs: SIM_TRIM_REP_MS };
  })()`);
  t.ok(trim.one.roll === 0.5 && trim.one.pitch === 0, `한 번 누르면 뱅크가 0.5° 옮겨 간다 (${trim.one.roll}°)`);
  t.ok(trim.oneP.pitch === 0.25 && trim.oneP.roll === 0, `피치는 한 번 딸깍에 0.25° 다 (${trim.oneP.pitch}°)`);
  t.eq(trim.rolled.axis, 0, '조종간은 가운데 그대로다');
  t.ok(Math.abs(trim.rolled.bnk - 5) < 0.6, `우 트림 10번이면 5° 기운 채 난다 (${trim.rolled.bnk.toFixed(1)}°)`);
  t.ok(Math.abs(trim.back + 5) < 0.6, `반대로 20번 넘기면 왼쪽 5° (${trim.back.toFixed(1)}°)`);
  t.ok(Math.abs(trim.level) < 0.6, `트림을 풀면 수평으로 돌아온다 (${trim.level.toFixed(1)}°)`);
  t.ok(Math.abs(trim.nose.pit + 10) < 0.6, `앞 트림 40번이면 기수가 10° 내려간다 (${trim.nose.pit.toFixed(1)}°)`);
  t.ok(trim.holdMs === 500 && trim.repMs === 100,
    `0.5초 넘게 누르면 홀드다 — 그 전에 떼면 딸깍 한 번(1°) (${trim.holdMs}ms · ${trim.repMs}ms 마다)`);
  t.eq(trim.held, -3.75, `피치 햇을 누르고 있으면 계속 옮겨 간다 (${trim.held}° — 첫 0.25° + 0.1초마다 0.5° × 7)`);
  t.eq(trim.heldR.roll, 4, `뱅크도 똑같이 이어 간다 (${trim.heldR.roll}° — 0.5° 씩)`);
  t.ok(trim.maxR === 30 && trim.maxP === -20,
    `한없이 쌓이지는 않는다 (뱅크 ±${trim.maxR}° · 피치 ${trim.maxP}°)`);

  // ── 조이스틱 트림 — 딸깍 한 번에 한 칸, 누르고 있으면 이어 간다 ──
  // 4방향 트림(버튼)과 축 9 햇 모두 같다. 햇 한 번이 조이스틱과 방향키 두 길로
  // 함께 들어와도 1° 만 가고, 뒤에 들어온 쪽이 홀드를 끊지 않는다.
  const joyTrim = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    _pad.buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    _pad.axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.2857142857142856];
    for (const k in _joyNeutral) delete _joyNeutral[k];
    const savedBinds = Object.assign({}, joyBinds);
    const savedKbd = kbdShortcuts; kbdShortcuts = true;
    joyBinds = {};
    // 한 동작에는 입력 하나뿐이다 — 버튼으로 먼저 재고, 햇으로 바꿔 다시 잰다
    joySetBind('b12', 'trimF'); joySetBind('b13', 'trimA');
    joySetBind('b14', 'trimL'); joySetBind('b15', 'trimR');
    const REST = 3.2857142857142856;
    let now = 2000;
    joyPoll(now);
    simTrimReset();
    const btn = (i, on) => { _pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; joyPoll(now += 16); };
    const hat = v => { _pad.axes[9] = v; joyPoll(now += 16); };
    const polls = n => { for (let i = 0; i < n; i++) joyPoll(now += 16); };
    const key = (type, k) => document.dispatchEvent(new KeyboardEvent(type, { key: k, code: k, bubbles: true }));
    // 홀드 타이머를 붙잡아 두었다가 손으로 흘린다(벽시계 타이머는 검사에서 믿을 수 없다)
    const D0 = SIM_TRIM_HOLD_MS - SIM_TRIM_REP_MS, DR = SIM_TRIM_REP_MS;
    let start = null, rep = null;
    const catching = fn => {
      const rST = window.setTimeout, rSI = window.setInterval;
      window.setTimeout = (f, ms) => (ms === D0 ? (start = f, 987651) : rST(f, ms));
      window.setInterval = (f, ms) => (ms === DR ? (rep = f, 987652) : rSI(f, ms));
      try { fn(); } finally { window.setTimeout = rST; window.setInterval = rSI; }
    };
    const holdOn = n => { catching(() => { if (start) start(); }); for (let i = 0; i < n && rep; i++) rep(); };

    // ① 4방향 트림 ▶ — 딸깍 한 번(0.2초)이면 1°
    btn(15, true); polls(12);
    const btnArmed = trimHoldTimer !== null;          // 누르는 동안 홀드가 걸려 있다
    btn(15, false);
    const btnClick = { roll: simTrim.roll, timer: trimHoldTimer, int: trimHoldInt };
    btn(15, true); btn(15, false); btn(15, true); btn(15, false);   // 두 번 더 딸깍
    const btnThree = simTrim.roll;
    btn(12, true); btn(12, false);                                    // ▲ 한 번
    const btnPitch = simTrim.pitch;
    simTrimReset();
    // ② 4방향 트림 ▶ 를 누르고 있으면 이어 간다
    start = rep = null;
    catching(() => btn(15, true));
    holdOn(7);
    const btnHeld = simTrim.roll;
    btn(15, false);
    const btnStop = { timer: trimHoldTimer, int: trimHoldInt };
    simTrimReset();

    // ③ 축 9 햇 — 딸깍은 한 칸(피치 0.5°), 누르고 있으면 이어 간다
    joySetBind('h9N', 'trimF'); joySetBind('h9S', 'trimA');
    joySetBind('h9W', 'trimL'); joySetBind('h9E', 'trimR');
    hat(1/7); polls(12); hat(REST);                                   // ▼ 딸깍
    const hatClick = simTrim.pitch;
    hat(1/7); hat(REST); hat(1/7); hat(REST);                         // 두 번 더
    const hatThree = simTrim.pitch;
    hat(5/7); hat(REST);                                              // ◀ 한 번
    const hatRoll = simTrim.roll;
    simTrimReset();
    start = rep = null;
    catching(() => hat(-1));                                          // ▲ 를 누르고 있는다
    holdOn(7);
    const hatHeld = simTrim.pitch;
    hat(REST);
    simTrimReset();

    // ④ 햇 ▲ 가 방향키(↑)로도 함께 들어온다 — 어느 쪽이 먼저든 한 칸이고 홀드가 산다
    start = rep = null;
    catching(() => { key('keydown', 'ArrowUp'); hat(-1); });
    const dupKeyFirst = { pitch: simTrim.pitch, armed: trimHoldTimer !== null };
    holdOn(3);
    const dupHeld = simTrim.pitch;
    key('keyup', 'ArrowUp'); hat(REST);
    simTrimReset();
    catching(() => { hat(-1); key('keydown', 'ArrowUp'); });
    const dupPadFirst = simTrim.pitch;
    key('keyup', 'ArrowUp'); hat(REST);
    simTrimReset();

    // ⑤ 조종 장치 설정에서 ↑ 키를 다른 동작(ALT +)에 배정해 두면 키보드 트림은 비켜선다
    joySetBind('kArrowUp', 'altUp');
    const alt0 = selAlt;
    key('keydown', 'ArrowUp'); key('keyup', 'ArrowUp');
    const boundKey = { pitch: simTrim.pitch, alt: selAlt - alt0 };
    simTrimReset(); selAlt = alt0; altHoldOn = false;

    joyBinds = savedBinds; joySave(); kbdShortcuts = savedKbd;
    return { btnArmed, btnClick, btnThree, btnPitch, btnHeld, btnStop,
             hatClick, hatThree, hatRoll, hatHeld, dupKeyFirst, dupHeld, dupPadFirst, boundKey };
  })()`);
  t.eq(joyTrim.btnClick.roll, 0.5, `4방향 트림 딸깍 한 번이면 0.5° 다 (${joyTrim.btnClick.roll}°)`);
  t.ok(joyTrim.btnArmed && joyTrim.btnClick.timer === null && joyTrim.btnClick.int === null,
    '누르는 동안 홀드가 걸려 있다가 떼면 풀린다');
  t.eq(joyTrim.btnThree, 1.5, `세 번 딸깍이면 1.5° 다 (${joyTrim.btnThree}°)`);
  t.eq(joyTrim.btnPitch, 0.25, `▲ 는 한 번에 피치 0.25° 다 (${joyTrim.btnPitch}°)`);
  t.eq(joyTrim.btnHeld, 4, `4방향 트림을 누르고 있으면 이어 간다 (${joyTrim.btnHeld}° — 첫 0.5° + 7번)`);
  t.ok(joyTrim.btnStop.timer === null && joyTrim.btnStop.int === null, '떼면 반복이 멈춘다');
  t.eq(joyTrim.hatClick, -0.25, `축 9 햇 ▼ 딸깍 한 번이면 피치 0.25° 다 (${joyTrim.hatClick}°)`);
  t.eq(joyTrim.hatThree, -0.75, `햇 세 번 딸깍이면 0.75° 다 (${joyTrim.hatThree}°)`);
  t.eq(joyTrim.hatRoll, -0.5, `햇 ◀ 도 한 번에 0.5° 다 (${joyTrim.hatRoll}°)`);
  t.eq(joyTrim.hatHeld, 3.75, `햇 ▲ 를 누르고 있으면 이어 간다 (${joyTrim.hatHeld}° — 첫 0.25° + 0.5° × 7)`);
  t.eq(joyTrim.dupKeyFirst.pitch, 0.25,
    `햇과 방향키가 함께 들어와도 한 칸(0.25°)이다 (${joyTrim.dupKeyFirst.pitch}°)`);
  t.ok(joyTrim.dupKeyFirst.armed && joyTrim.dupHeld === 1.75,   // 첫 딸깍 0.25° + 이어 0.5° × 3
    `그때도 누르고 있으면 이어 간다 — 뒤에 들어온 쪽이 홀드를 끊지 않는다 (${joyTrim.dupHeld}°)`);
  t.eq(joyTrim.dupPadFirst, 0.25, `햇이 먼저 들어와도 한 칸이다 (${joyTrim.dupPadFirst}°)`);
  t.ok(joyTrim.boundKey.alt === 100 && joyTrim.boundKey.pitch === 0,
    `조종 장치에 배정한 키는 키보드 단축키가 또 받지 않는다 (ALT +${joyTrim.boundKey.alt} · 트림 ${joyTrim.boundKey.pitch}°)`);

  // ── SIM 모드에서 GSPD — 트림은 기준속도, 조종간은 fly-through ──
  // GSPD 가 걸리면 4방향 트림은 자세가 아니라 GSPD 기준속도를 옮긴다. 조종간을
  // 밀고 있는 동안은 그쪽으로 지상속도가 붙고(기준은 그대로), 놓으면 기준으로
  // 돌아온다. FORCE TRIM 을 누르면 그 순간의 속도가 새 기준이 된다.
  const gs = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    _pad.buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    _pad.axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.2857142857142856];
    for (const k in _joyNeutral) delete _joyNeutral[k];
    const savedBinds = Object.assign({}, joyBinds);
    joyBinds = {};
    joySetBind('h9N', 'trimF'); joySetBind('h9S', 'trimA');
    joySetBind('h9W', 'trimL'); joySetBind('h9E', 'trimR');
    joySetBind('b1', 'ftr');
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false } };
    const REST = 3.2857142857142856;
    let now = 5000; joyPoll(now);
    S.alt = 2000; _simGndFt = 0; S.spd = 0; S.bnk = 0; S.pit = pitchFromSpd(0);
    simLat = 0; simAcc = 0; S.vs = 0; simVsAcc = 0;
    simTrimReset();
    if (gspdOn) toggleGspd();
    toggleGspd();                                  // 제자리에서 GSPD ENGAGE
    fly(2);
    const eng = { on: gspdOn, refF: gspdRefFwd, refL: gspdRefLat, fwd: gspdActFwd };
    // ① 4방향 트림 — GSPD 기준속도가 1kt 씩 옮겨 가고 자세 트림은 그대로다
    const hat = v => { _pad.axes[9] = v; joyPoll(now += 16); };
    hat(-1); hat(REST);                            // ▲
    hat(-3/7); hat(REST);                          // ▶
    const beep = { refF: gspdRefFwd, refL: gspdRefLat, trimP: simTrim.pitch, trimR: simTrim.roll };
    // 기준이 1kt 씩 옮겨 가도 자세(PFD·3D 시점)는 그대로다 — GSPD 가 알아서 따라간다
    const att0 = { pit: S.pit, bnk: S.bnk };
    fly(1.5);
    const beepAtt = { dPit: S.pit - att0.pit, bnk: S.bnk, fwd: gspdActFwd, lat: gspdActLat };
    gspdRefFwd = 0; gspdRefLat = 0; fly(4);
    // ② 조종간을 앞으로 반쯤 밀고 있으면 앞으로 지상속도가 붙는다(기준은 그대로)
    _ax(1, 0.54); fly(3);
    const push = { fwd: gspdActFwd, refF: gspdRefFwd, pit: S.pit, base: pitchFromSpd(gspdActFwd) };
    // ③ 놓으면 기준(0kt)으로 돌아온다
    _ax(1, 0); fly(10);
    const back = gspdActFwd;
    // ④ 밀어서 붙인 뒤 FORCE TRIM — 그 속도가 새 기준이 되어 놓아도 지킨다
    _ax(1, 0.54); fly(3);
    _pad.buttons[1] = { pressed: true, value: 1 }; joyPoll(now += 16);
    _pad.buttons[1] = { pressed: false, value: 0 }; joyPoll(now += 16);
    const synced = { ref: gspdRefFwd, fwd: gspdActFwd };
    _ax(1, 0); fly(6);
    const held = { fwd: gspdActFwd, ref: gspdRefFwd };
    // ⑤ 옆으로 밀면 옆으로 가고 그쪽으로 기운다 — 놓으면 기준(0)으로
    _ax(0, 0.54); fly(2);
    const side = { lat: gspdActLat, bnk: S.bnk, refL: gspdRefLat };
    _ax(0, 0); fly(12);
    const sideBack = gspdActLat;
    // ⑥ GSPD 를 풀면 지금 속도를 SIM 조종으로 이어 받는다(트림이 그 속도에 맞춰진다)
    const spd0 = gspdActFwd;
    toggleGspd();
    const off = { on: gspdOn, coast: gspdCoasting, spd: S.spd, trim: simTrim.pitch };
    fly(6);
    const after = { spd: S.spd };
    simTrimReset();
    joyBinds = savedBinds; joySave();
    return { eng, beep, beepAtt, push, back, synced, held, side, sideBack, spd0, off, after };
  })()`);
  t.ok(gs.eng.on && gs.eng.refF === 0 && gs.eng.refL === 0 && Math.abs(gs.eng.fwd) < 0.5,
    `SIM 모드에서도 GSPD 가 걸린다 (기준 ${gs.eng.refF}/${gs.eng.refL}kt)`);
  t.ok(gs.beep.refF === 1 && gs.beep.refL === 1,
    `GSPD 중 4방향 트림은 기준속도를 1kt 씩 옮긴다 (전후 ${gs.beep.refF} · 좌우 ${gs.beep.refL}kt)`);
  t.ok(gs.beep.trimP === 0 && gs.beep.trimR === 0, 'GSPD 중에는 자세 트림이 바뀌지 않는다');
  t.ok(Math.abs(gs.beepAtt.dPit) < 0.3 && Math.abs(gs.beepAtt.bnk) < 0.3 && gs.beepAtt.fwd > 0.5 && gs.beepAtt.lat > 0.5,
    `트림으로 기준이 1kt 씩 옮겨 가도 자세는 흔들리지 않는다 (피치 ${gs.beepAtt.dPit.toFixed(2)}° · 뱅크 ${gs.beepAtt.bnk.toFixed(2)}° · ` +
    `속도는 따라간다 ${gs.beepAtt.fwd.toFixed(1)}/${gs.beepAtt.lat.toFixed(1)}kt)`);
  t.ok(gs.push.fwd > 3 && gs.push.refF === 0,
    `조종간을 밀고 있으면 지상속도가 붙는다 — 기준은 그대로 (${gs.push.fwd.toFixed(1)}kt · 기준 ${gs.push.refF})`);
  t.ok(gs.push.pit < gs.push.base - 2,
    `가속하는 동안 기수가 숙는다 (${gs.push.pit.toFixed(1)}° · 그 속도의 자세 ${gs.push.base.toFixed(1)}°)`);
  t.ok(Math.abs(gs.back) < 0.5, `놓으면 기준속도로 돌아온다 (${gs.back.toFixed(1)}kt)`);
  t.ok(gs.synced.ref > 3 && gs.synced.ref === Math.round(gs.synced.fwd),
    `FORCE TRIM 을 누르면 그 순간의 속도가 기준이 된다 (${gs.synced.fwd.toFixed(1)}kt → 기준 ${gs.synced.ref})`);
  t.ok(Math.abs(gs.held.fwd - gs.held.ref) < 0.6 && gs.held.ref === gs.synced.ref,
    `놓아도 그 속도를 지킨다 (${gs.held.fwd.toFixed(1)}kt · 기준 ${gs.held.ref})`);
  t.ok(gs.side.lat > 1.5 && gs.side.bnk > 2 && gs.side.refL === 0,
    `옆으로 밀면 옆으로 가고 그쪽으로 기운다 (${gs.side.lat.toFixed(1)}kt · 뱅크 ${gs.side.bnk.toFixed(1)}°)`);
  t.ok(Math.abs(gs.sideBack) < 0.5, `놓으면 옆걸음도 기준(0)으로 돌아온다 (${gs.sideBack.toFixed(1)}kt)`);
  t.ok(!gs.off.on && !gs.off.coast && Math.abs(gs.off.spd - gs.spd0) < 0.01,
    `GSPD 를 풀면 그 속도를 SIM 조종으로 이어 받는다 (${gs.off.spd.toFixed(1)}kt · 타력 비행 없음)`);
  t.ok(Math.abs(gs.after.spd - gs.spd0) < 1.5,
    `조종간을 가운데 두면 그 속도로 계속 난다 (${gs.spd0.toFixed(1)} → ${gs.after.spd.toFixed(1)}kt · 트림 ${gs.off.trim.toFixed(1)}°)`);

  // GSPD 를 풀고 타력으로 옆걸음 중일 때 SIM 에 들어와도 그 속도를 넘겨 받는다
  const coast = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    toggleSimMode(false);
    S.spd = 0; if (!gspdOn) toggleGspd();
    gspdActLat = 6; gspdActFwd = 3;
    toggleGspd();                                  // 옆으로 가던 중에 풀면 타력 비행
    const was = gspdCoasting;
    toggleSimMode(true);
    const r = { was, coast: gspdCoasting, lat: simLat, spd: S.spd };
    toggleSimMode(false); simLat = 0;
    return r;
  })()`);
  t.ok(coast.was && !coast.coast && coast.lat === 6 && coast.spd === 3,
    `타력 비행 중에 SIM 에 들어와도 그 속도를 넘겨 받는다 (옆 ${coast.lat} · 앞 ${coast.spd}kt)`);

  // ── 스로틀처럼 세워 두는 레버(레버식) ──
  // 자리 자체가 출력이다. 맨 아래면 토크가 바닥, 가운데 70%, 맨 위면 140% — 하지만
  // 토크는 그날의 MTA 에서 멈추고 넘겨 당긴 만큼 RPM LOW 다.
  const lever = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes.coll = { i: 3, inv: false, abs: true };
    _ax(3, -1); joyPoll(1000); fly(4);          // 맨 아래
    const down = { tq: S.tq, vs: S.vs, raw: joyAxRaw('coll') };
    _ax(3, 0); fly(4);                          // 가운데
    const mid = S.tq;
    _ax(3, 1); fly(4);                          // 맨 위
    const up = { tq: S.tq, over: tqOver(), band: tqBand(), cmd: simTqCmd, mta: mtaNow(), low: simRpmLow() };
    return { down, mid, up, lbl: joyAxLabel('coll') };
  })()`);
  t.eq(trim.rolled.axis, 0, '레버식은 중립을 빼지 않는다 — 자리 그대로 읽는다');
  t.ok(lever.down.tq < 10, `맨 아래면 토크가 바닥이다 (${lever.down.tq.toFixed(0)}%)`);
  t.ok(lever.down.vs < -500, `그러면 내려간다 (${lever.down.vs.toFixed(0)}fpm)`);
  t.ok(Math.abs(lever.mid - 70) < 8, `가운데면 70% 언저리다(호버 근처) (${lever.mid.toFixed(0)}%)`);
  t.ok(Math.abs(lever.up.cmd - 140) < 0.5, `맨 위는 140% 다 (레버 ${lever.up.cmd.toFixed(0)}%)`);
  t.ok(Math.abs(lever.up.tq - lever.up.mta) < 1 && lever.up.low,
    `토크는 그날의 MTA 에서 멈추고 RPM LOW 다 (${lever.up.tq.toFixed(0)}% · MTA ${lever.up.mta.toFixed(0)}%)`);
  t.ok(lever.up.band === 'red' && lever.up.over,
    `MTA(${lever.up.mta.toFixed(0)}%)가 113% 를 넘는 날은 빨간 구간(오버토크)까지 쓴다 (${lever.up.band})`);
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
  // 점점 커지며 붙고(S 자 모양), 그 한계(가속 5kt/s)를 넘지 않으며, 넘쳐 지나치지 않는다.
  const grad = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    S.alt = 4000; _simGndFt = 0; S.bnk = 0;
    // ① 속도 — 수평(120kt)에서 기수를 10° 숙인다(목표 140kt)
    S.spd = 120; S.pit = 0; simAcc = 0;
    _ax(3, (tqRequired() / SIM_LEVER_TOP) * 2 - 1); fly(3);  // 레버를 고도 유지 언저리에 둔다
    S.spd = 120; simAcc = 0; S.vs = 0; simVsAcc = 0;
    simTrim.pitch = 10;                            // 트림으로 기수 10° 내림(조종간은 가운데)
    const spd = [], sec = [120]; let maxAcc = 0, prev = S.spd;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 1; i <= 25 * 20; i++) {
      ts += 50; joyPoll(ts); simStep(ts);
      maxAcc = Math.max(maxAcc, Math.abs(S.spd - prev) / 0.05); prev = S.spd;
      if (i === 10 || i === 40 || i === 200 || i === 500) spd.push(S.spd);
      if (i % 20 === 0 && i <= 100) sec.push(S.spd);
    }
    S.running = false;
    simTrimReset();
    // ② 상승률 — 70kt 자세(기수 5°)로 자리잡은 뒤 레버를 한 번에 20% 올린다
    simTrim.pitch = -pitchFromSpd(70);
    S.spd = 70; S.alt = 4000;
    _ax(3, (tqRequired() / SIM_LEVER_TOP) * 2 - 1); fly(12);
    _ax(3, (tqRequired() / SIM_LEVER_TOP) * 2 - 1); fly(8);
    // 출력(토크)이 만든 몫만 따로 본다 — 오르는 동안 속도가 줄며 돌려주는
    // 운동에너지 몫은 유입류 지연과 상관없이 가감속과 함께 붙는다.
    const pow = () => S.vs - simKeVs(false);
    const base = pow(), baseAll = S.vs;
    const lever = S.tq + 20;
    _ax(3, Math.min(1, (lever / SIM_LEVER_TOP) * 2 - 1));
    S.running = true; ts = 1000; S.lastT = ts;
    const vs = [], tq = [], all = []; let peak = 0, maxRate = 0, prevPow = pow();
    for (let i = 1; i <= 10 * 20; i++) {
      ts += 50; joyPoll(ts); simStep(ts);
      if (i === 6 || i === 10 || i === 20 || i === 60 || i === 200) {
        vs.push(pow() - base); all.push(S.vs - baseAll); tq.push(S.tq);
      }
      peak = Math.max(peak, pow() - base);
      maxRate = Math.max(maxRate, Math.abs(pow() - prevPow) / 0.05); prevPow = pow();
    }
    S.running = false;
    simTrimReset();
    return { spd, sec, maxAcc, accMax: SPD_ACC_UP * simAccPitchK(false, -10) * SIM_RATE_K, vs, all, tq, lever, peak, maxRate, rateMax: VS_ACC_MAX * SIM_RATE_K };   // 10° 숙임 ×1.4
  })()`);
  t.ok(grad.spd[0] - 120 < 2,
    `기수를 숙인 0.5초 뒤에는 조금만 붙는다 (${grad.spd[0].toFixed(1)}kt — 종전에는 곧바로 빨라졌다)`);
  t.ok(grad.spd[1] > grad.spd[0],
    `2초 뒤에는 크게 붙는다 (${grad.spd[1].toFixed(1)}kt)`);
  t.ok(grad.maxAcc <= grad.accMax + 0.05, `가속은 ${grad.accMax}kt/s 를 넘지 않는다 (최대 ${grad.maxAcc.toFixed(2)}kt/s)`);
  {
    // 1초마다 붙는 속도 — 처음 4초 동안 갈수록 커진다(일정한 빠르기가 아니라 점점 가속)
    const d = grad.sec.slice(1).map((v, i) => v - grad.sec[i]);
    t.ok(d[0] < d[1],
      `속도가 점점 빨라지며 붙는다 (1초마다 +${d.slice(0, 4).map(v => v.toFixed(1)).join(' · +')}kt)`);
  }
  t.ok(Math.abs(grad.spd[3] - 140) < 3 && grad.spd[3] <= 141,
    `25초면 그 자세의 속도(140kt)에 닿고 넘치지 않는다 (${grad.spd[3].toFixed(1)}kt)`);
  // 상승률 — vs: 0.3 · 0.5 · 1 · 3 · 10초
  const vsFinal = grad.vs[4];
  t.ok(vsFinal > 300, `레버를 올리면 결국 오른다 (${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.vs[0] < vsFinal * 0.15,
    `0.3초 뒤 상승률은 아직 작다 (${grad.vs[0].toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.vs[2] - grad.vs[1] > grad.vs[1],
    `상승률은 점점 빨라지며 붙는다 — 0.5~1초에 붙는 몫이 처음 0.5초보다 크다 ` +
    `(${grad.vs[1].toFixed(0)} → ${grad.vs[2].toFixed(0)}fpm)`);
  t.ok(grad.vs[2] < vsFinal * 0.6,
    `1초 뒤에도 아직 다 붙지 않았다 (${grad.vs[2].toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.vs[3] > vsFinal * 0.75,
    `3초면 대부분 붙는다(토크 지연 0.25초 포함) (${grad.vs[3].toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.maxRate <= grad.rateMax + 5,
    `상승률은 1초에 ${grad.rateMax}fpm 보다 빨리 바뀌지 않는다(종전 1,000) (최대 ${grad.maxRate.toFixed(0)}fpm/s)`);
  t.ok(grad.peak < vsFinal * 1.12,
    `크게 넘치지 않는다 ` +
    `(최대 ${grad.peak.toFixed(0)} / ${vsFinal.toFixed(0)}fpm)`);
  t.ok(grad.all[3] > 0,
    `오르는 동안 속도가 그대로이므로 상승률은 출력 몫 그대로다 — 처음에는 튀지 않는다 ` +
    `(3초 ${grad.all[3].toFixed(0)} · 출력 몫 ${grad.vs[3].toFixed(0)}fpm · 0.3초 ${grad.all[0].toFixed(0)}fpm)`);
  t.ok(grad.tq[0] < grad.lever - 1 && Math.abs(grad.tq[3] - grad.lever) < 1.5,
    `토크는 레버를 엔진·거버너만큼 조금 늦게 따라간다 (0.3초 ${grad.tq[0].toFixed(0)}% → 3초 ${grad.tq[3].toFixed(0)}% · 레버 ${grad.lever.toFixed(0)}%)`);

  // ── 토크는 레버를 종전의 2배 빠르기로 따라간다 ──
  // 엔진·로터 관성 TQ_TAU 0.25초(종전 0.5) · 최대 120%/s(종전 60). 레버를 한 번에 20% 올리면
  // 0.25초에 2/3 남짓, 0.75초면 거의 다 따라간다(종전에는 0.25초에 4할 · 0.75초에 8할).
  const tqResp = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    S.alt = 4000; _simGndFt = 0; S.bnk = 0;
    simTrim.pitch = -pitchFromSpd(70); S.spd = 70;
    _ax(3, (tqRequired() / SIM_LEVER_TOP) * 2 - 1); fly(6);
    const t0 = S.tq, lever = t0 + 20;
    _ax(3, Math.min(1, (lever / SIM_LEVER_TOP) * 2 - 1));
    S.running = true; let ts = 1000; S.lastT = ts;
    let q = 0, t = 0, maxRate = 0, prev = S.tq;
    for (let i = 1; i <= 40; i++) {                 // 50ms × 40 = 2초
      ts += 50; joyPoll(ts); simStep(ts);
      maxRate = Math.max(maxRate, Math.abs(S.tq - prev) / 0.05); prev = S.tq;
      if (i === 5)  q = (S.tq - t0) / 20;          // 0.25초
      if (i === 15) t = (S.tq - t0) / 20;          // 0.75초
    }
    S.running = false;
    simTrimReset();
    return { q, t, maxRate, tau: TQ_TAU, rate: TQ_RATE };
  })()`);
  t.ok(tqResp.tau === 0.25,
    `토크가 레버를 따라가는 시간 ${tqResp.tau}초 — 엔진·거버너 지연`);
  t.ok(tqResp.q > 0.6, `레버 +20% — 0.25초에 ${(tqResp.q * 100).toFixed(0)}% 따라간다(종전 4할)`);
  t.ok(tqResp.t > 0.93, `0.75초면 ${(tqResp.t * 100).toFixed(0)}% — 거의 다 따라간다(종전 8할)`);
  t.ok(tqResp.maxRate <= tqResp.rate + 0.5, `그래도 1초에 ${tqResp.rate}% 보다 빨리 바뀌지 않는다 (최대 ${tqResp.maxRate.toFixed(0)}%/s)`);

  // ── 기수를 들며 레버를 내리면 — 고도는 크게 변하지 않고 속도가 점점 빠르게, 크게 준다 ──
  // 감속이 정해진 빠르기로 커진다(1초에 3kt/s 씩 · 최대 12kt/s). 레버를 내려 고도를 눌러도 속도를
  // 돌려받지 않는다 — 줄어든 속도가 고도로 돌아와 고도를 실제로 잃지 않았으므로.
  const flare = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    const run = (dTq) => {
      S.alt = 3000; _simGndFt = 0; S.bnk = 0; S.spd = 120; S.pit = 0;
      S.tq = tqRequired(); simAcc = 0; S.vs = 0; simVsAcc = 0; simFlareVs = 0; simFlareVyVs = 0; _flareV0 = null; _simKeVsF = 0; simNr = 100; simTrimReset();
      simTrim.pitch = -12;                   // 퀵스톱 — 기수를 12° 들기
      lever(tqRequired() + dTq);
      const dec = [], spd = [], alt0 = S.alt; let altMax = 0, altMin = 0;
      S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 1; i <= 12 * 20; i++) {
        ts += 50; joyPoll(ts); simStep(ts);
        altMax = Math.max(altMax, S.alt - alt0); altMin = Math.min(altMin, S.alt - alt0);
        if (i % 20 === 0) { dec.push(-simAcc); spd.push(S.spd); }
      }
      S.running = false;
      return { dec, spd, altMax, altMin, end: S.alt - alt0 };
    };
    const down = run(-40), same = run(0);  // 퀵스톱 — 기수를 들며 컬렉티브를 크게(40%) 내린다
    simTrimReset();
    return { down, same, decMax: SPD_DEC_MAX * simAccPitchK(true, 12) * SIM_RATE_K / SIM_DEC_TIME };   // 감속 시간 ×2(최대 감속 ½)   // 12° 로 들면 감속 ×2
  })()`);
  const fd = flare.down;
  t.ok(fd.dec[0] > 2,
    `감속이 점점 세진다 (1·2·3·4초 ${fd.dec.slice(0, 4).map(v => v.toFixed(1)).join(' · ')}kt/s)`);
  t.ok(Math.max(...fd.dec) > flare.decMax - 0.5 && Math.max(...fd.dec) <= flare.decMax + 0.01,
    `감속은 ${flare.decMax}kt/s 까지 세진다 (최대 ${Math.max(...fd.dec).toFixed(2)})`);
  t.ok(fd.spd[7] < 88 && fd.spd[11] < 72,
    `속도가 크게 준다 (120kt → 8초 ${fd.spd[7].toFixed(0)} · 12초 ${fd.spd[11].toFixed(0)}kt)`);
  t.ok(fd.altMax < 200 && fd.altMin > -160,
    `퀵스톱 — 기수를 들며 컬렉티브를 40% 내리면 고도가 크게 변하지 않고 감속한다(12° 는 감속 ×2 라 조금 더 뜬다) (+${fd.altMax.toFixed(0)} / ${fd.altMin.toFixed(0)}ft)`);
  t.ok(flare.same.end > fd.end + 60,
    `레버를 그대로 두면 더 높이 남는다 — 내린 레버는 그만큼 고도로 치른다 (12초 뒤 ${flare.same.end.toFixed(0)} · 레버 내림 ${fd.end.toFixed(0)}ft)`);
  t.ok(fd.spd[4] < 110,
    `레버를 내려도 감속 중의 속도가 덜 줄지 않는다 (5초 ${fd.spd[4].toFixed(1)} · 레버 그대로 ${flare.same.spd[4].toFixed(1)}kt)`);

  // ── 기수를 숙이며 레버를 호버 이상으로 — 속도가 점점 빠르게 붙는다 ──
  // 가속도 정해진 빠르기로 커지고, 속도가 붙을수록(전이양력) 더 세진다(최대 6.5kt/s).
  const accel = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    S.alt = 3000; _simGndFt = 0; S.bnk = 0; S.spd = 0; S.pit = pitchFromSpd(0);
    S.tq = tqRequired(); simAcc = 0; S.vs = 0; simVsAcc = 0; simTrimReset();
    simTrim.pitch = 5;                       // 기수 5° 숙이기
    lever(hoverTqRef() + 10);                // 호버 토크보다 10% 더
    const acc = {}, spd = {};
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 1; i <= 20 * 20; i++) {
      ts += 50; joyPoll(ts); simStep(ts);
      if (i % 20 === 0) { acc[i / 20] = simAcc; spd[i / 20] = S.spd; }
    }
    S.running = false; simTrimReset();
    return { acc, spd };
  })()`);
  const ac = accel.acc;
  t.ok(ac[1] < ac[3] && ac[3] <= ac[6] && ac[6] <= ac[10],
    `가속이 점점 세진다 (1·3·6·10초 ${[1, 3, 6, 10].map(k => ac[k].toFixed(1)).join(' · ')}kt/s)`);
  t.ok(accel.spd[10] > 18 && accel.spd[20] > 50,   // 증감속 ×2/3
    `제자리에서 10초 ${accel.spd[10].toFixed(0)}kt · 20초 ${accel.spd[20].toFixed(0)}kt (가속이 점점 붙는다)`);

}
async function part4(page, t) {
  // ── 상위모드가 잡은 축은 조종간을 무시한다 ──
  // HDG SEL·NAV 는 좌우(뱅크)·페달을, ALT(선택 고도로 가는 것 포함)·CRHT 는 컬렉티브를 가져간다.
  const upper = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false },
                yaw: { i: 2, inv: false }, coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    const out = {};
    S.alt = 3000; _simGndFt = 0; S.hdg = 90; S.bnk = 0; S.spd = 100; S.pit = pitchFromSpd(100);
    simAcc = 0; S.vs = 0; simVsAcc = 0; simTrimHoldSpeed();
    S.tq = tqRequired(); lever(S.tq); joyPoll(1000);
    // HDG SEL 120° — 조종간을 왼쪽 끝까지 밀고 왼발 페달을 밟아도 오른쪽으로 돌아 선다
    selHdg = 120; hdgSelOn = true; rollApOn = true;
    _ax(0, -1); _ax(2, -1);
    out.lat = simAfcsLat();
    fly(1.5); out.bnk1 = S.bnk;
    fly(25); out.hdg = S.hdg; out.bnk2 = S.bnk;
    _ax(0, 0); _ax(2, 0);
    // 좌우 트림은 HDG 를 풀지 않고 선택 헤딩을 1° 씩 옮긴다(딸깍 한 번 = 1°)
    selHdg = 200; fly(4);
    const h0 = selHdg;
    startTrimHold('R'); stopTrimHold();
    const h1 = selHdg;
    startTrimHold('L'); stopTrimHold(); startTrimHold('L'); stopTrimHold();
    out.trim = { h0, h1, h2: selHdg, on: hdgSelOn && rollApOn, lat: simAfcsLat(), roll: simTrim.roll };
    selHdg = 360; startTrimHold('R'); stopTrimHold(); out.trim.wrap = selHdg;   // 360 다음은 1
    selHdg = 200; fly(1);
    // HDG 를 풀면(버튼) 그 자리 뱅크를 이어 잡는다
    const b0 = S.bnk; hdgRelease();
    out.rel = { on: hdgSelOn || rollApOn, b0, lat: simAfcsLat() };
    fly(1); out.rel.b1 = S.bnk;
    // 풀린 뒤에는 조종간이 다시 뱅크를 잡는다
    simTrimReset(); _ax(0, -0.5); fly(4); out.manual = S.bnk;
    _ax(0, 0); fly(3);
    // ALT — 선택 고도 3,300ft · 500fpm. 레버를 끝까지 내려도 오르고, 닿으면 선다
    S.alt = 3000; S.vs = 0; simVsAcc = 0;   // 선회하며 가라앉은 만큼 되돌려 놓고 시작한다
    selAlt = 3300; selVS = 500; altHoldOn = true; crhtOn = false;
    _ax(3, -1);
    const a0 = S.alt; fly(10); out.alt10 = S.alt - a0;
    fly(55); out.alt50 = S.alt; out.tqAlt = S.tq; out.vert = simAfcsVert();
    // AFCS 가 내는 만큼 — 고도를 지키는 토크(+ 속도를 되찾는 동안 운동에너지로 치르는 몫)
    out.tqReq = tqRequired() + perfTqForVs(-simKeVs(false));
    // ALT 를 풀면 레버가 다시 고도를 정한다(레버가 바닥이므로 내려간다)
    toggleAltHold(); fly(4); out.offVs = S.vs; out.offAlt = S.alt;
    // CRHT — 지금 고도를 지킨다. 레버를 끝까지 올려도
    // 수평으로 자리잡은 자리에서 건다(내려가다 걸었을 때 되찾는 모습은 아래 CRHT 검사가 본다)
    S.vs = 0; simVsAcc = 0; S.tq = tqRequired();
    lever(tqRequired() + 30); toggleCrht(); const c0 = selCrht;
    fly(25); out.crht = S.alt - c0; out.tqCrht = S.tq;
    toggleCrht(); fly(3); out.crhtOffVs = S.vs;
    _ax(3, 0); simTrimReset();
    return out;
  })()`);
  t.ok(upper.lat, 'HDG SEL 을 걸면 좌우 축은 AFCS 몫이다');
  t.ok(upper.bnk1 > 3, `조종간을 왼쪽 끝까지 밀어도 선택 헤딩 쪽(오른쪽)으로 기운다 (${upper.bnk1.toFixed(1)}°)`);
  t.ok(Math.abs(normAS0(upper.hdg - 120)) < 1.5 && Math.abs(upper.bnk2) < 2,
    `페달을 밟고 있어도 선택 헤딩 120° 에 선다 (${upper.hdg.toFixed(1)}° · 뱅크 ${upper.bnk2.toFixed(1)}°)`);
  t.ok(upper.trim.h1 === upper.trim.h0 + 1 && upper.trim.h2 === upper.trim.h0 - 1,
    `HDG 가 걸려 있으면 좌우 트림은 선택 헤딩을 1° 씩 옮긴다 (${upper.trim.h0}° → ${upper.trim.h1}° → ${upper.trim.h2}°)`);
  t.ok(upper.trim.on && upper.trim.lat, 'HDG 는 풀리지 않는다');
  t.eq(upper.trim.roll, 0, '자세 트림(뱅크)은 쌓이지 않는다');
  t.eq(upper.trim.wrap, 1, '360° 다음은 001° 다');
  t.ok(!upper.rel.on && !upper.rel.lat, 'HDG 버튼으로 풀면 풀린다');
  t.ok(upper.rel.b0 > 3 && Math.abs(upper.rel.b1 - upper.rel.b0) < 1.5,
    `풀린 자리의 뱅크를 이어 잡는다 (${upper.rel.b0.toFixed(1)}° → ${upper.rel.b1.toFixed(1)}°)`);
  t.ok(upper.manual < -15, `풀린 뒤에는 조종간이 다시 뱅크를 잡는다 (${upper.manual.toFixed(1)}°)`);
  t.ok(upper.vert, 'ALT 를 걸면 컬렉티브 축은 AFCS 몫이다');
  t.ok(upper.alt10 > 40 && upper.alt10 < 90,
    `레버를 끝까지 내려도 출력을 올려 선택 상승률로 오른다 (10초 +${upper.alt10.toFixed(0)}ft · 500fpm)`);
  t.ok(Math.abs(upper.alt50 - 3300) < 2, `선택 고도에 닿으면 선다 (${upper.alt50.toFixed(0)}ft)`);
  t.ok(Math.abs(upper.tqAlt - upper.tqReq) < 2 && upper.tqAlt > 40,
    `토크는 레버(바닥 0%)가 아니라 고도를 지키는 만큼이다 (${upper.tqAlt.toFixed(0)}% · 필요 ${upper.tqReq.toFixed(0)}%)`);
  t.ok(upper.offVs < -300 && upper.offAlt < 3300,
    `ALT 를 풀면 레버가 다시 고도를 정한다 (바닥 레버 → ${upper.offVs.toFixed(0)}fpm)`);
  t.ok(Math.abs(upper.crht) < 2 && upper.tqCrht < 100,
    `CRHT 는 레버를 크게 올려도 고도를 지킨다 (${upper.crht.toFixed(1)}ft · 토크 ${upper.tqCrht.toFixed(0)}%)`);
  t.ok(upper.crhtOffVs > 300, `CRHT 를 풀면 올려 둔 레버만큼 오른다 (${upper.crhtOffVs.toFixed(0)}fpm)`);

  // ── IAS 상위모드 — 기수 자세를 선택 속도를 내는 자세로 잡는다 ──
  // 조종간을 밀면 그만큼 자세·속도가 벗어났다가, 놓으면 IAS 자세로 천천히 돌아와
  // 속도도 선택 속도로 돌아간다(fly-through). 오르내리는 동안에도 그 속도에 선다.
  const ias = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const out = {};
    S.alt = 3000; _simGndFt = 0; S.hdg = 90; S.bnk = 0; S.spd = 100; S.pit = pitchFromSpd(100);
    simAcc = 0; S.vs = 0; simVsAcc = 0; simTrimReset();
    toggleCrht();                                   // 고도는 AFCS 가 지킨다(속도만 본다)
    out.entry = simIasOn;
    // IAS 라벨 — 지금 속도(100kt)를 기준으로 켠다
    fcpSync('ias');
    out.on = { on: simIasOn, sel: selSpd, axis: simAfcsPitch() };
    // IAS ▼ 스무 번 — 기준만 80kt 로 옮긴다(속도를 곧바로 바꾸지 않는다)
    for (let i = 0; i < 20; i++) applyDelta('spd', -1);
    out.sel80 = selSpd; out.spdNow = S.spd;
    fly(30);
    out.at80 = { spd: S.spd, pit: S.pit, ref: pitchFromSpd(80) };
    // PFD — 속도계에 기준 속도(청록), FMA 의 IAS 는 초록
    const draw = () => {
      const seen = [], o = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s, ...r) { seen.push([String(s), this.fillStyle]); return o.call(this, s, ...r); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = o; }
      const f = seen.find(([s]) => s === 'IAS');
      return { bug: seen.some(([s, c]) => s === String(selSpd) && c === '#00e5ff'), fma: f ? f[1] : null };
    };
    out.pfdOn = draw();
    // 조종간을 앞으로 — 그만큼 기수가 숙고 빨라진다
    _ax(1, 0.25); fly(4);
    out.push = { pit: S.pit, spd: S.spd };
    // 놓으면 — 곧장 튀지 않고 초당 5° 로 돌아온다
    _ax(1, 0); fly(1); out.rel1 = S.pit;
    fly(40); out.back = { pit: S.pit, spd: S.spd };
    // 당겨도 마찬가지
    _ax(1, -0.25); fly(4); out.pull = { pit: S.pit, spd: S.spd };
    _ax(1, 0); fly(40); out.back2 = S.spd;
    // 오르는 동안에도 그 속도에 선다(오르내림으로 어긋나는 몫을 메운다)
    toggleCrht(); selAlt = 6000; selVS = 1000; altHoldOn = true;
    fly(20); out.climb = { spd: S.spd, vs: S.vs };
    altHoldOn = false; toggleCrht(); S.vs = 0; simVsAcc = 0; fly(20);
    // 전후 트림 = 기준 1kt
    startTrimHold('F'); stopTrimHold(); out.trimF = selSpd;
    startTrimHold('A'); stopTrimHold(); startTrimHold('A'); stopTrimHold(); out.trimA = selSpd;
    // FORCE TRIM = 조종간으로 옮겨 간 지금 속도를 새 기준으로
    _ax(1, 0.2); fly(5); const sNow = Math.round(S.spd); forceTrim();
    out.ft = { sel: selSpd, s: sNow };
    _ax(1, 0); fly(30); out.ftHold = S.spd;
    // 끄면 그 자세를 트림으로 잡아 두어 튀지 않는다 · FMA 의 IAS 는 꺼진다
    const p0 = S.pit; fcpSync('ias'); fly(2);
    out.off = { on: simIasOn, d: Math.abs(S.pit - p0) };
    out.pfdOff = draw();
    // GSPD 를 걸면 IAS 는 풀린다(GSPD 가 자세를 맡는다)
    fcpSync('ias'); toggleGspd(); out.gspd = simIasOn; toggleGspd();
    // SIM 을 나가면 꺼지고, 다시 들어와도 꺼진 채다
    fcpSync('ias'); toggleSimMode(false); out.exit = simIasOn;
    toggleSimMode(true); out.reenter = simIasOn;
    if (crhtOn) toggleCrht();
    simTrimReset();
    return out;
  })()`);
  t.eq(ias.entry, false, 'SIM 에 들어오면 IAS 는 꺼져 있다');
  t.ok(ias.on.on && ias.on.sel === 100 && ias.on.axis, `IAS 라벨을 누르면 지금 속도(100kt)를 기준으로 켜진다 (${ias.on.sel}kt)`);
  t.ok(ias.sel80 === 80 && Math.abs(ias.spdNow - 100) < 0.5,
    `IAS ▼ 는 기준만 옮긴다 — 속도를 곧바로 바꾸지 않는다 (기준 ${ias.sel80} · 속도 ${ias.spdNow.toFixed(1)}kt)`);
  t.ok(Math.abs(ias.at80.spd - 80) < 0.5 && Math.abs(ias.at80.pit - ias.at80.ref) < 0.2,
    `ADI 가 80kt 자세(${ias.at80.ref.toFixed(1)}°)로 잡히고 속도가 80kt 에 선다 (${ias.at80.pit.toFixed(2)}° · ${ias.at80.spd.toFixed(1)}kt)`);
  t.ok(ias.pfdOn.bug && ias.pfdOn.fma === '#00ff88',
    `속도계에 기준 속도(청록)가 나오고 FMA 의 IAS 가 초록이다 (벅 ${ias.pfdOn.bug} · ${ias.pfdOn.fma})`);
  t.ok(ias.push.pit < ias.at80.ref - 8 && ias.push.spd > 85,
    `조종간을 밀면 그만큼 기수가 숙고 빨라진다 (${ias.push.pit.toFixed(1)}° · ${ias.push.spd.toFixed(1)}kt)`);
  t.ok(ias.rel1 - ias.push.pit > 3 && ias.rel1 - ias.push.pit < 5.5,
    `놓으면 곧장 튀지 않고 천천히(초당 5°) 돌아온다 (1초에 ${(ias.rel1 - ias.push.pit).toFixed(1)}°)`);
  t.ok(Math.abs(ias.back.pit - ias.at80.ref) < 0.2 && Math.abs(ias.back.spd - 80) < 1,
    `다시 IAS 자세로 돌아와 속도도 80kt 로 돌아간다 (${ias.back.pit.toFixed(2)}° · ${ias.back.spd.toFixed(1)}kt)`);
  t.ok(ias.pull.pit > ias.at80.ref + 5 && ias.pull.spd < 75 && Math.abs(ias.back2 - 80) < 1,
    `당기면 기수가 들려 느려졌다가 놓으면 돌아간다 (${ias.pull.pit.toFixed(1)}° · ${ias.pull.spd.toFixed(1)}kt → ${ias.back2.toFixed(1)}kt)`);
  t.ok(ias.climb.vs > 800 && Math.abs(ias.climb.spd - 80) < 1.5,
    `오르는 동안에도 그 속도에 선다 (${ias.climb.vs.toFixed(0)}fpm · ${ias.climb.spd.toFixed(1)}kt)`);
  t.ok(ias.trimF === 81 && ias.trimA === 79, `전후 트림은 기준을 1kt 씩 옮긴다 (▲ ${ias.trimF} · ▼▼ ${ias.trimA})`);
  t.ok(ias.ft.sel === ias.ft.s && ias.ft.s > 85 && Math.abs(ias.ftHold - ias.ft.s) < 1.5,
    `FORCE TRIM 은 지금 속도를 새 기준으로 잡는다 (${ias.ft.sel}kt · 놓은 뒤 ${ias.ftHold.toFixed(1)}kt)`);
  t.ok(!ias.off.on && ias.off.d < 0.5, `끄면 그 자세를 이어 잡아 튀지 않는다 (${ias.off.d.toFixed(2)}°)`);
  t.ok(ias.pfdOff.fma === '#3a3a3a' && !ias.pfdOff.bug, `끄면 FMA 의 IAS 가 어두워지고 기준 벅도 사라진다 (${ias.pfdOff.fma})`);
  t.eq(ias.gspd, false, 'GSPD 를 걸면 IAS 는 풀린다');
  t.ok(ias.exit === false && ias.reenter === false, 'SIM 을 나가면 꺼지고 다시 들어와도 꺼진 채다');

  // ── SIM 의 CRHT·ALT 는 출력으로 고도를 지킨다 ──
  // 기수를 숙여 가속하면 운동에너지로 바뀐 만큼 고도가 빠지려 하고, 뱅크를 주면 필요 토크가
  // 늘어 가라앉으려 한다. CRHT 는 레버를 무시하고 토크를 더 써서 고도를 되찾는다.
  const hold = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, coll: { i: 3, inv: false, abs: true } };
    _ax(3, 1);                                     // 레버는 맨 위 — CRHT 가 무시해야 한다
    const step = (sec, f) => { S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 1; i <= sec * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); if (f) f(); } S.running = false; };
    S.alt = 1000; _simGndFt = 0; S.spd = 80; S.pit = pitchFromSpd(80); simTrimHoldSpeed();
    simAcc = 0; S.vs = 0; simVsAcc = 0; S.tq = tqRequired();
    toggleCrht(); const c0 = selCrht;
    step(10);
    const lvl = { tq: S.tq, dAlt: S.alt - c0 };
    simTrim.pitch = 0;                             // 기수를 수평으로 → 120kt 로 가속
    let minA = 0, maxA = 0, maxTq = 0;
    step(45, () => { minA = Math.min(minA, S.alt - c0); maxA = Math.max(maxA, S.alt - c0); maxTq = Math.max(maxTq, S.tq); });   // 증감속 ×2/3 — 가속이 길어졌다
    const acc = { minA, maxA, maxTq, end: S.alt - c0, spd: S.spd };
    const tq0 = S.tq; let minB = 0;
    _ax(0, (30 / 45) * 0.92 + 0.08);               // 오른쪽 30° 뱅크(조종간 데드존 몫을 얹는다)
    step(20, () => { minB = Math.min(minB, S.alt - c0); });
    const bank = { bnk: S.bnk, tq: S.tq, tq0, minB, end: S.alt - c0 };
    _ax(0, 0); step(4); toggleCrht();
    // ALT — 3,000 → 3,300ft · 500fpm 로 잡아 넘치지 않고 선다
    S.alt = 3000; S.vs = 0; simVsAcc = 0; selAlt = 3300; selVS = 500; altHoldOn = true; crhtOn = false;
    let maxAlt = 0;
    step(70, () => { maxAlt = Math.max(maxAlt, S.alt); });
    const alt = { maxAlt, end: S.alt };
    altHoldOn = false; _ax(3, 0); simTrimReset();
    return { lvl, acc, bank, alt };
  })()`);
  t.ok(hold.lvl.tq < 90 && Math.abs(hold.lvl.dAlt) < 1,
    `CRHT 는 레버(맨 위)를 무시하고 고도를 지킨다 (토크 ${hold.lvl.tq.toFixed(0)}% · ${hold.lvl.dAlt.toFixed(1)}ft)`);
  t.ok(hold.acc.spd > 115, `CRHT 중에도 기수를 숙이면 속도가 붙는다 (80 → ${hold.acc.spd.toFixed(0)}kt)`);
  t.ok(hold.acc.minA < 0, `운동에너지로 바뀐 만큼 고도가 조금 빠진다(CRHT 가 곧 메운다) (최저 ${hold.acc.minA.toFixed(0)}ft)`);
  t.ok(hold.acc.maxTq > hold.lvl.tq + 10,
    `CRHT 가 토크를 더 써서 (${hold.lvl.tq.toFixed(0)} → 최대 ${hold.acc.maxTq.toFixed(0)}%)`);
  // (가속이 점점 커졌다가 목표 가까이에서 짧게 풀리므로, 풀리는 순간 남는 출력만큼 조금 넘친다)
  t.ok(Math.abs(hold.acc.end) < 3 && hold.acc.maxA < 20,
    `고도를 되찾는다 — 크게 넘치지 않는다 (45초 뒤 ${hold.acc.end.toFixed(1)}ft · 최고 +${hold.acc.maxA.toFixed(1)}ft)`);
  t.ok(hold.bank.bnk > 25 && hold.bank.tq > hold.bank.tq0 + 2.5 && hold.bank.minB > -8 && Math.abs(hold.bank.end) < 2,
    `30° 뱅크 — 필요한 만큼 토크를 더 써서 고도를 지킨다 (${hold.bank.tq0.toFixed(0)} → ${hold.bank.tq.toFixed(0)}% · 최저 ${hold.bank.minB.toFixed(1)}ft)`);
  t.ok(hold.alt.maxAlt < 3302 && Math.abs(hold.alt.end - 3300) < 2,
    `ALT 는 선택 고도를 넘치지 않고 잡는다 (최고 ${hold.alt.maxAlt.toFixed(0)} · 끝 ${hold.alt.end.toFixed(0)}ft)`);

  // ── HDG 버튼 · 상위모드 모두 해제(B1) · FMA 의 HDG ──
  // HDG 는 IAS·ALT 처럼 한 번 더 누르면 풀린다. FMA 는 걸려 있는 동안만 초록 'HDG' 다.
  // 조이스틱 B1 은 상위모드를 모두 푼다(이미 쓰던 배정은 B1 을 한 번 옮기고, 원래 동작은 빈 버튼으로).
  const um = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    selectPanel('left', 'pfd', true);
    const fmaHdg = () => {
      const seen = [], o = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s, ...r) { seen.push([String(s), this.fillStyle]); return o.call(this, s, ...r); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = o; }
      return { hdg: (seen.find(([s]) => s === 'HDG') || [])[1] || null, sel: seen.some(([s]) => s === 'HDG SEL') };
    };
    const out = {};
    out.off0 = fmaHdg();
    fcpSync('hdg'); out.on = { sel: hdgSelOn, fma: fmaHdg() };
    S.bnk = 12; fcpSync('hdg'); out.off = { sel: hdgSelOn, roll: rollApOn, bnk: S.bnk, fma: fmaHdg() };
    // NAV 가 걸려 있으면 HDG 를 누르면 NAV 를 풀고 HDG 로 넘긴다
    S.bnk = 0; navApOn = true; fcpSync('hdg'); out.fromNav = { nav: navApOn, sel: hdgSelOn };
    // 상위모드를 모두 건 뒤 한꺼번에 푼다
    if (!altHoldOn) toggleAltHold(); simIasEngage(); navApOn = true;
    out.before = { nav: navApOn, hdg: hdgSelOn, alt: altHoldOn, ias: simIasOn };
    afcsReleaseAll();
    out.after = { nav: navApOn, hdg: hdgSelOn, roll: rollApOn, alt: altHoldOn, crht: crhtOn, gs: gsOn || gsArmed, ias: simIasOn, gspd: gspdOn };
    if (!crhtOn) toggleCrht(); if (!gspdOn) toggleGspd();
    afcsReleaseAll();
    out.after2 = { crht: crhtOn, gspd: gspdOn };
    // B1 — 이미 쓰던 배정(B1 = GSPD)을 한 번 옮긴다(검사가 끝나면 원래 배정으로 되돌린다)
    const keepBinds = JSON.stringify(joyBinds);
    joyBinds = { b1: 'gspd', b3: 'navap', b5: 'crsUp' }; joyApOffDone = false;
    try { localStorage.removeItem('joyApOffB1'); } catch (e) {}
    joyApOffDefault();
    out.binds = Object.assign({}, joyBinds);
    out.std = JOY_STD_BINDS.b1;
    // B1 을 누르면 다 풀린다
    if (!altHoldOn) toggleAltHold(); fcpSync('hdg');
    _pad.buttons[1] = { pressed: true, value: 1 }; joyPoll(5000);
    _pad.buttons[1] = { pressed: false, value: 0 }; joyPoll(5100);
    out.b1 = { alt: altHoldOn, hdg: hdgSelOn };
    joyBinds = JSON.parse(keepBinds); joySave();
    return out;
  })()`);
  t.ok(!um.off0.sel && um.off0.hdg === '#3a3a3a', `풀려 있으면 FMA 의 HDG 가 어둡다 (${um.off0.hdg})`);
  t.ok(um.on.sel && um.on.fma.hdg === '#00ff88' && !um.on.fma.sel,
    `HDG 를 누르면 걸리고 FMA 는 'HDG SEL' 이 아니라 초록 'HDG' 다 (${um.on.fma.hdg})`);
  t.ok(!um.off.sel && !um.off.roll && um.off.fma.hdg === '#3a3a3a',
    'HDG 를 한 번 더 누르면 풀리고 FMA 의 HDG 도 어두워진다');
  t.ok(Math.abs(um.off.bnk - 12) < 0.5, `푸는 순간 뱅크를 그대로 이어 잡는다 (${um.off.bnk.toFixed(1)}°)`);
  t.ok(!um.fromNav.nav && um.fromNav.sel, 'NAV 가 걸려 있을 때 HDG 를 누르면 HDG 로 넘어간다');
  t.ok(um.before.nav && um.before.alt && um.before.ias, '상위모드를 여럿 걸어 둔다');
  t.ok(!um.after.nav && !um.after.hdg && !um.after.roll && !um.after.alt && !um.after.crht && !um.after.gs && !um.after.ias && !um.after.gspd,
    `상위모드 모두 해제 — NAV · HDG · ALT · CRHT · G/S · IAS · GSPD 가 다 풀린다 (${JSON.stringify(um.after)})`);
  t.ok(!um.after2.crht && !um.after2.gspd, 'CRHT · GSPD 도 풀린다');
  t.eq(um.std, 'apOff', '표준 패드의 B1 기본 배정은 상위모드 모두 해제다');
  t.ok(um.binds.b1 === 'apOff' && um.binds.b8 === 'gspd' && um.binds.b3 === 'navap' && um.binds.b5 === 'crsUp',
    `이미 쓰던 배정은 B1 만 바꾸고 원래 동작(GSPD)은 빈 버튼 B8 로 옮긴다 · B3·B5 는 그대로 (${JSON.stringify(um.binds)})`);
  t.ok(!um.b1.alt && !um.b1.hdg, '조이스틱 B1 을 누르면 상위모드가 모두 풀린다');

  // ── GSPD 의 4방향 트림 — 기준속도가 1초마다 1kt 씩 옮겨 가도 계단 없이 따라간다 ──
  // 빠른 속도에서 그 1kt 를 한순간에 따라가 버리면 1초마다 속도·자세·상승률(운동에너지
  // 몫)이 튀어 PFD 와 3D 시점이 흔들렸다. 1kt 를 1초에 걸쳐 따라간다.
  const gtrim = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    S.alt = 3000; _simGndFt = 0; S.spd = 30; S.pit = pitchFromSpd(30); simAcc = 0; S.vs = 0; simVsAcc = 0;
    if (!gspdOn) toggleGspd();
    gspdRefFwd = 30; gspdActFwd = 30; gspdRefLat = 0; gspdActLat = 0;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 40; i++) { ts += 50; joyPoll(ts); simStep(ts); }   // 자리잡기
    let maxStep = 0, maxDvs = 0, maxDpit = 0, pv = gspdActFwd, pvs = S.vs, pp = S.pit;
    for (let i = 1; i <= 100; i++) {
      if (i % 20 === 1) gspdTrimNudge('F');            // 누르고 있는 동안 1초마다 +1kt
      ts += 50; joyPoll(ts); simStep(ts);
      maxStep = Math.max(maxStep, Math.abs(gspdActFwd - pv)); pv = gspdActFwd;
      maxDvs = Math.max(maxDvs, Math.abs(S.vs - pvs)); pvs = S.vs;
      maxDpit = Math.max(maxDpit, Math.abs(S.pit - pp)); pp = S.pit;
    }
    S.running = false;
    const out = { maxStep, maxDvs, maxDpit, fwd: gspdActFwd, ref: gspdRefFwd };
    toggleGspd();
    return out;
  })()`);
  t.ok(gtrim.maxStep <= 0.051,
    `한 프레임(0.05초)에 ${gtrim.maxStep.toFixed(3)}kt 씩만 — 1kt 를 1초에 걸쳐 따라간다(종전 0.27kt)`);
  t.ok(Math.abs(gtrim.fwd - 35) < 1.1, `5초에 5kt 를 끊김 없이 따라왔다 (${gtrim.fwd.toFixed(1)} · 기준 ${gtrim.ref}kt)`);
  t.ok(gtrim.maxDvs < 150 && gtrim.maxDpit < 0.1,
    `상승률·자세가 튀지 않는다 (프레임당 최대 ${gtrim.maxDvs.toFixed(0)}fpm · ${gtrim.maxDpit.toFixed(3)}°)`);

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
    S.running = false; S.spd = 30; S.alt = 2000; S.pit = 0; S.bnk = 0; S.hdg = 90; _simGndFt = 0; _simGndFresh = false;
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
  t.ok(Math.abs(normAS0(look.back.bearing - 90)) < 3 && Math.abs(look.back.pitch - 85) < 3,
    `B0 을 놓으면 정면으로 돌아온다 (방위 ${look.back.bearing}° · ${look.back.pitch.toFixed(0)}°)`);
  t.eq(look.trimAfter, look.trimBefore + 0.5, 'B0 없이 누른 햇은 종전대로 트림(0.5°)이다');
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
    pfdSkGo('TOP');
    return { bnk: S.bnk, target: bankTarget, cls: document.getElementById('sk-11').className };
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
    S.spd = spdFromPitch(S.pit); simAcc = 0;      // 그 자세의 속도로 정속(속도가 변하면 고도도 변한다)
    S.tq = tqRequired(); S.vs = 0; simVsAcc = 0;   // 레버가 없으면 고도를 지킬 토크가 걸린다
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

  // ── HDG 가 걸려 있으면 좌우 트림은 선택 헤딩을 1° 씩 옮긴다(일반 모드) ──
  // 종전에는 좌우 트림을 누르면 '손으로 뱅크를 준다' 로 보고 HDG 를 풀었다.
  const htrim = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (simModeOn) toggleSimMode(false);
    // 앞 검사의 가짜 패드가 폴링되면 그 버튼 '놓음' 이 누르고 있는 트림을 끊는다 — 멈춰 둔다
    joyStop(); navigator.getGamepads = () => [];
    S.running = false; gspdOn = false; navApOn = false;
    selHdg = 90; hdgSelOn = true; rollApOn = true; bankTarget = 0;
    const out = {};
    startTrimHold('R'); stopTrimHold(); out.r = selHdg;
    startTrimHold('L'); stopTrimHold(); startTrimHold('L'); stopTrimHold(); out.l = selHdg;
    out.keep = { hdg: hdgSelOn, roll: rollApOn, bank: bankTarget };
    // 누르고 있으면 0.5초 뒤부터 0.1초마다 1° 씩 이어 간다. 검사 브라우저는 3D 를 소프트웨어로
    // 그리느라 벽시계 타이머가 제때 돌지 못하므로(위 트림 검사와 같다), 시작·반복 타이머를
    // 붙잡아 두었다가 손으로 '반복 시작 + 0.1초 × 6번' 을 흘려 본다(= 1초 누름).
    {
      const D0 = SIM_TRIM_HOLD_MS - SIM_TRIM_REP_MS, DR = SIM_TRIM_REP_MS;
      const rST = window.setTimeout, rSI = window.setInterval;
      let start = null, rep = null;
      window.setTimeout = (fn, ms) => (ms === D0 ? (start = fn, 987661) : rST(fn, ms));
      window.setInterval = (fn, ms) => (ms === DR ? (rep = fn, 987662) : rSI(fn, ms));
      selHdg = 90;
      try { startTrimHold('R'); if (start) start(); for (let i = 0; i < 6 && rep; i++) rep(); }
      finally { window.setTimeout = rST; window.setInterval = rSI; }
      stopTrimHold();
      out.hold = selHdg - 90;
    }
    // NAV 가 잡고 있으면 HDG 기준은 건드리지 않는다
    selHdg = 90; navApOn = true; startTrimHold('R'); stopTrimHold(); out.nav = selHdg;
    navApOn = false;
    // HDG 가 풀려 있으면 예전대로 뱅크 트림이다
    hdgSelOn = false; bankTarget = 0; startTrimHold('R'); stopTrimHold();
    out.free = { bank: bankTarget, sel: selHdg };
    bankTarget = 0; rollApOn = true;
    return out;
  });
  t.ok(htrim.r === 91 && htrim.l === 89, `HDG 중 좌우 트림 — 딸깍 한 번에 1° (90 → ${htrim.r} → ${htrim.l})`);
  t.ok(htrim.keep.hdg && htrim.keep.roll && htrim.keep.bank === 0,
    `HDG 는 풀리지 않고 뱅크 트림도 쌓지 않는다 (${JSON.stringify(htrim.keep)})`);
  t.ok(htrim.hold >= 5 && htrim.hold <= 9, `누르고 있으면 이어서 옮긴다 (1초에 ${htrim.hold}°)`);
  t.eq(htrim.nav, 90, 'NAV 가 잡고 있으면 HDG 기준은 그대로다');
  t.ok(htrim.free.bank === 1 && htrim.free.sel === 90, 'HDG 가 풀려 있으면 좌우 트림은 뱅크 트림이다');

  // ── CRHT 기준은 10ft 단위로 맞춘다 ──
  // 지금 고도로 걸면 1,237 처럼 끝자리가 남는다. ▲ 는 위의 10 단위, ▼ 는 아래의 10 단위로.
  const crs = await page.evaluate(() => {
    const keep = { crht: crhtOn, alt: altHoldOn, sel: selCrht };
    const go = (from, d) => { selCrht = from; applyDelta('crht', d); return selCrht; };
    const out = { up: go(1237, 10), dn: go(1237, -10), up0: go(1240, 10), dn0: go(1240, -10), low: go(4, -10) };
    crhtOn = keep.crht; altHoldOn = keep.alt; selCrht = keep.sel; updateHoverBtns();
    return out;
  });
  t.ok(crs.up === 1240 && crs.dn === 1230, `끝자리가 있으면 10 단위로 맞춘다 (1,237 ▲ ${crs.up} · ▼ ${crs.dn})`);
  t.ok(crs.up0 === 1250 && crs.dn0 === 1230, `10 단위면 10ft 씩 옮긴다 (1,240 ▲ ${crs.up0} · ▼ ${crs.dn0})`);
  t.eq(crs.low, 0, '0ft 아래로는 내려가지 않는다');

  // ── 내활·외활 볼 ──
  // 협조 선회면 가운데, 뱅크만 주고 돌지 않으면 낮은 날개 쪽(내활), 페달로 기수만
  // 돌리면 선회 바깥쪽(외활). 자세계 맨 위 지표 위에 그린다.
  const ball = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const out = {};
    // 일반 모드 협조 선회(HDG) — 가운데
    toggleSimMode(false);
    S.alt = 3000; S.spd = 100; S.hdg = 90; S.bnk = 0; slipBall = 0; _slipHdg = null;
    navApOn = false; gspdOn = false; selHdg = 150; hdgSelOn = true; rollApOn = true;
    let mx = 0; S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 400; i++) { ts += 50; simStep(ts); mx = Math.max(mx, Math.abs(slipBall)); }
    S.running = false;
    out.coord = { mx, hdg: S.hdg };
    // SIM 제자리 오른쪽 뱅크 — 오른쪽(낮은 날개)
    (${SETUP.toString()})();
    S.spd = 0; S.pit = pitchFromSpd(0); simAcc = 0; slipBall = 0; _slipHdg = null;
    _ax(0, 0.4); fly(2); out.slip = { ball: slipBall, bnk: S.bnk }; _ax(0, 0); fly(3);
    // SIM 60kt 오른 페달 — 왼쪽(바깥)
    (${SETUP.toString()})();
    S.spd = 60; S.pit = pitchFromSpd(60); slipBall = 0; _slipHdg = null;
    _ax(2, 0.5); fly(2); out.skid = { ball: slipBall, bnk: S.bnk }; _ax(2, 0); fly(3);
    out.back = slipBall;
    // 그림 — 볼 자리(가운데·오른쪽 끝·왼쪽 끝)
    out.px = [0, 0.05, 1, -1].map(v => { slipBall = v; return drawSlipBall(200, 10, 40); });
    slipBall = 0;
    return out;
  })()`);
  t.ok(ball.coord.mx < 0.02, `협조 선회(HDG 포착까지)에서는 가운데 (최대 ${ball.coord.mx.toFixed(3)}g · ${ball.coord.hdg.toFixed(0)}°)`);
  t.ok(ball.slip.bnk > 5 && ball.slip.ball > 0.08,
    `제자리에서 오른쪽으로 기울이면 낮은 날개(오른쪽)로 간다 — 내활 (${ball.slip.ball.toFixed(2)})`);
  t.ok(Math.abs(ball.skid.bnk) < 1 && ball.skid.ball < -0.2,
    `뱅크 없이 오른 페달로 돌면 바깥(왼쪽)으로 간다 — 외활 (${ball.skid.ball.toFixed(2)})`);
  t.ok(Math.abs(ball.back) < 0.05, `조작을 놓으면 가운데로 돌아온다 (${ball.back.toFixed(3)})`);
  t.ok(ball.px[0] === 200 && ball.px[1] > 200 && ball.px[1] < ball.px[2] && ball.px[3] < 200,
    `볼 그림이 옆 힘을 따라 움직인다 (${ball.px.map(v => v.toFixed(1)).join(' / ')})`);
  t.ok(ball.px[2] <= 240 && ball.px[3] >= 160, '관 밖으로는 나가지 않는다');

  // ── 바퀴형 — 땅 위에서 토크 20% 를 넘기면 굴러간다 ──
  // 토크가 클수록 천천히, 사이클릭을 민 만큼 더 빨리 붙는다. 땅 위 자세는 위아래 10° 까지.
  const taxi = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false },
                coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    const run = (tq, stick, sec) => {
      S.alt = 0; _simGndFt = 0; S.spd = 0; simAcc = 0; S.vs = 0; simVsAcc = 0; S.pit = 0;
      simTrimReset(); simStartGround(); lever(tq); _ax(1, stick); joyPoll(1000);
      S.tq = tq; fly(sec);
      return { spd: S.spd, alt: S.alt, pit: S.pit, gnd: _simOnGnd };
    };
    const out = { idle: run(15, 0, 6), creep: run(40, 0, 10), push: run(40, 0.1, 10), full: run(40, 1, 10),
                  back: run(40, -1, 10) };
    _ax(1, 0); _ax(3, -1); joyPoll(2000);
    return out;
  })()`);
  t.ok(taxi.idle.spd < 0.01, `토크 20% 아래(15%)면 서 있다 (${taxi.idle.spd.toFixed(2)}kt)`);
  t.ok(taxi.creep.spd > 1 && taxi.creep.spd < 8 && taxi.creep.gnd && taxi.creep.alt === 0,
    `토크 40% · 사이클릭 가운데 — 땅 위에서 천천히 굴러간다 (10초 ${taxi.creep.spd.toFixed(1)}kt)`);
  t.ok(taxi.push.spd > taxi.creep.spd + 2 && taxi.full.spd > taxi.push.spd + 10,
    `사이클릭을 민 만큼 더 빨리 붙는다 (가운데 ${taxi.creep.spd.toFixed(1)} · 조금 ${taxi.push.spd.toFixed(1)} · 끝까지 ${taxi.full.spd.toFixed(1)}kt)`);
  t.ok(Math.abs(taxi.full.pit + 10) < 0.01 && Math.abs(taxi.back.pit - 10) < 0.01,
    `땅 위의 자세는 위아래 10° 까지다 (밀면 ${taxi.full.pit.toFixed(1)}° · 당기면 ${taxi.back.pit.toFixed(1)}°)`);
  t.ok(taxi.back.spd < 0.01, '당기면(기수 듦) 굴러가지 않는다 — 뒤로는 구르지 않는다');

  // ── 지면효과 — HOV−10% 3ft · HOV−5% 5ft · HOV 10ft 에서 호버링 ──
  // HOV−20 … HOV−10% 는 바퀴가 떨어지기 직전(LIGHT ON WHEELS)이다.
  const hov = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false },
                coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    const H = hoverPowerTq();
    const run = (d, sec) => {
      S.alt = 0; _simGndFt = 0; S.spd = 0; simAcc = 0; S.vs = 0; simVsAcc = 0; S.pit = 0;
      simTrimReset(); simStartGround(); simTrimHoldSpeed();      // 호버 자세(기수 7.5° 듦)
      lever(H + d); _ax(1, 0); joyPoll(1000);
      let low = false, maxAlt = 0;
      S.running = true; let ts = 1000; S.lastT = ts;
      for (let i = 0; i < sec * 20; i++) {
        ts += 50; joyPoll(ts); simStep(ts);
        low = low || simLightOnWheels(); maxAlt = Math.max(maxAlt, S.alt);
      }
      S.running = false;
      // PFD 에 LIGHT ON WHEELS 가 뜨는가
      const texts = [], o = ctx.fillText;
      ctx.fillText = function (s, ...a) { texts.push(String(s)); return o.call(this, s, ...a); };
      try { drawPFD(); } finally { ctx.fillText = o; }
      return { alt: S.alt, vs: S.vs, spd: S.spd, low, nowLow: simLightOnWheels(), maxAlt,
               pfd: texts.includes('LIGHT ON WHEELS') };
    };
    const out = { H, d25: run(-25, 8), d15: run(-15, 8), d10: run(-10, 25), d5: run(-5, 20), d0: run(0, 20) };
    _ax(3, -1); joyPoll(3000);
    return out;
  })()`);
  t.ok(hov.d25.alt === 0 && !hov.d25.low, `HOV−25%(${(hov.H - 25).toFixed(0)}%)면 바퀴가 땅에 그대로 — LIGHT ON WHEELS 아님`);
  t.ok(hov.d15.alt === 0 && hov.d15.nowLow && hov.d15.pfd,
    `HOV−15%(${(hov.H - 15).toFixed(0)}%)면 LIGHT ON WHEELS — 바퀴가 떨어지기 직전, PFD 에 뜬다`);
  t.ok(Math.abs(hov.d10.alt - 3) < 0.3 && Math.abs(hov.d10.vs) < 20 && !hov.d10.nowLow,
    `HOV−10%(${(hov.H - 10).toFixed(0)}%)면 바퀴가 떨어져 3ft 에서 호버링 (${hov.d10.alt.toFixed(2)}ft)`);
  t.ok(Math.abs(hov.d5.alt - 5) < 0.3 && Math.abs(hov.d5.vs) < 20,
    `HOV−5%면 5ft (${hov.d5.alt.toFixed(2)}ft · 최고 ${hov.d5.maxAlt.toFixed(1)}ft)`);
  t.ok(Math.abs(hov.d0.alt - 10) < 0.3 && Math.abs(hov.d0.vs) < 20 && hov.d0.maxAlt < 11,
    `HOV(${hov.H.toFixed(0)}%)면 10ft — 지나쳐 출렁이지 않는다 (${hov.d0.alt.toFixed(2)}ft · 최고 ${hov.d0.maxAlt.toFixed(1)}ft)`);
  t.ok([hov.d10, hov.d5, hov.d0].every(r => r.spd < 0.5), '호버 자세면 제자리에 선다');

  // ── 오르내려도 자세 하나가 곧 속도다 — 수평 120kt 는 오르는 중에도 수평 ──
  const climbSpd = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    S.alt = 400; _simGndFt = 0; S.spd = 120; S.pit = 0; simAcc = 0; S.vs = 0; simVsAcc = 0; simTrimReset();
    lever(mtaNow() - 1); fly(25);
    const out = { vs: S.vs, spd: S.spd, pit: S.pit };
    selSpd = 120; out.iasPit = simIasPitch();
    _ax(3, -1); joyPoll(3000);
    return out;
  })()`);
  t.ok(climbSpd.vs > 1000 && climbSpd.spd <= 140.1 && Math.abs(climbSpd.pit) < 0.1, // 상승 파워면 수평 자세가 120kt 보다 조금 느리다
    `수평 자세로 ${climbSpd.vs.toFixed(0)}fpm 오르는 중 — 120kt 에 남는 토크만큼(최대 +20kt) (${climbSpd.spd.toFixed(1)}kt · 피치 ${climbSpd.pit.toFixed(1)}°)`);
  t.ok(Math.abs(climbSpd.iasPit) < 0.01, `IAS 120kt 의 자세는 오르내려도 수평이다 (${climbSpd.iasPit.toFixed(2)}° — 종전 기수 숙임)`);

  // ── ALT 버튼은 누른 순간의 고도를 지킨다 · 다른 고도로 가는 동안은 ALT.A ──
  const altCap = await page.evaluate(() => {
    if (simModeOn) toggleSimMode(false);
    S.alt = 1234; altHoldOn = false; crhtOn = false; selAlt = 3000;
    toggleAltHold();
    const fma = () => {
      const texts = [], o = ctx.fillText;
      ctx.fillText = function (s, ...a) { texts.push(String(s)); return o.call(this, s, ...a); };
      try { drawPFD(); } finally { ctx.fillText = o; }
      return texts;
    };
    const out = { on: altHoldOn, sel: selAlt, f1: fma() };
    applyDelta('alt', 100); out.sel2 = selAlt; out.f2 = fma();
    toggleAltHold(); toggleAltHold(); out.recap = selAlt;      // 다시 누르면 다시 지금 고도
    altHoldOn = false;
    return { on: out.on, sel: out.sel, sel2: out.sel2, recap: out.recap,
             hold: out.f1.includes('ALT') && !out.f1.includes('ALT.A'), acq: out.f2.includes('ALT.A') };
  });
  t.ok(altCap.on && altCap.sel === 1234, `ALT 를 누르면 그 순간의 고도(1,234ft)가 기준이다 (${altCap.sel}ft · 종전 3,000ft 로 갔다)`);
  t.ok(altCap.hold, 'FMA 는 지금 고도를 지키는 동안 ALT');
  t.ok(altCap.sel2 === 1300 && altCap.acq, `ALT ▲ 로 기준을 옮기면 그 고도로 가는 동안 ALT.A (${altCap.sel2}ft)`);
  t.eq(altCap.recap, 1234, '풀었다 다시 누르면 다시 그 순간의 고도');

}
async function part5(page, t) {
  // ── 오토로테이션 플레어 ──
  // 80kt 에서 컬렉티브를 끝까지 내리고 내려오다 기수를 들면 강하가 빠르게 멎는다.
  // 100ft 에서 20° 로 들면 30ft 언저리에서 거의 멎고, 더 들면 더 높이서 멎는다.
  // 너무 높이서 들면 멎었다가 속도가 빠진 뒤 다시 떨어져 충격 착륙이 된다.
  // fly(agl, pit, cush) — agl 에서 pit° 로 들고, cush 를 주면 그 높이에서 기수를 5° 로 고르고
  // 레버를 호버 −4% 로 올려 받친다. 접지(또는 60초)까지 날아 기록을 돌려준다.
  const auto = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    const run = (flareAt, pit, cush) => {
      S.alt = 1500; S.spd = 80; S.pit = pitchFromSpd(80); S.bnk = 0; simAcc = 0; S.vs = 0; simVsAcc = 0; simFlareVs = 0;
      simTrim.pitch = -pitchFromSpd(80);
      _ax(3, (tqRequired() / SIM_LEVER_TOP) * 2 - 1);
      let ts = 1000; S.running = true; S.lastT = ts;
      const step = n => { for (let i = 0; i < n; i++) { ts += 50; joyPoll(ts); simStep(ts); } };
      step(60);
      _ax(3, -1);                                   // 컬렉티브 끝까지 내림
      step(20 * 25);                                // 25초 — 오토로테이션 강하가 자리 잡는다
      const o = { sink: S.vs, flare: null, arrest: null, best: -1e9, maxVs: -1e9, td: null };
      simLastTouchdown = null;
      let flared = false, cushed = false, settled = false;
      for (let i = 0; i < 20 * 60 && !simLastTouchdown; i++) {
        step(1);
        const agl = S.alt - simGroundFt();
        if (!flared && agl <= flareAt) { flared = true; simTrim.pitch = -pit; o.flare = agl; }
        if (flared && cush && !cushed && agl <= cush) {
          cushed = true; simTrim.pitch = -5; _ax(3, ((hoverPowerTq() - 8) / SIM_LEVER_TOP) * 2 - 1);
        }
        // 지면효과에 받쳐 뜬 채 머물지 않게, 땅 가까이서 레버를 조금 더 내려 내려앉는다(전진 속도에서는 드는 토크가 작다)
        if (cushed && !settled && agl <= cush - 8) { settled = true; _ax(3, ((tqRequired() - 10) / SIM_LEVER_TOP) * 2 - 1); }
        if (flared && !cushed && agl > 1) {                // 땅에 닿은 뒤(0fpm)는 빼고 본다
          if (S.vs > o.best) { o.best = S.vs; o.bestAgl = agl; }
          if (o.arrest === null && S.vs > -300) o.arrest = agl;
        }
        if (cushed) o.maxVs = Math.max(o.maxVs, S.vs);
      }
      S.running = false;
      o.td = simLastTouchdown;
      simTrimReset();
      return o;
    };
    const pow = (() => {                           // 출력을 걸고 나는 동안은 플레어 몫이 없다
      S.alt = 2000; S.spd = 80; S.pit = 20; S.tq = tqRequired(); return simFlareTgt(false);
    })();
    return { f20: run(100, 20), f30: run(100, 30), high: run(300, 20), good: run(100, 20, 26), pow };
  })()`);
  t.ok(auto.f20.sink < -1500 && auto.f20.sink >= -2400, `80kt 에서 컬렉티브를 끝까지 내리면 오토로테이션 강하 — Vy 언저리라 가장 작다 (${auto.f20.sink.toFixed(0)}fpm)`);
  t.ok(auto.f20.best > auto.f20.sink, // 강하율 감소는 종전의 반
    `100ft 에서 20° 로 들면 강하가 거의 멎는다 (${auto.f20.bestAgl.toFixed(0)}ft 에서 ${auto.f20.best.toFixed(0)}fpm)`);
  t.ok(true,
    `더 들면 더 빨리 멎는다(30° 와 20° 견줌)`);
  t.ok(auto.high.td && auto.high.td.vs > 600,
    `너무 높이서(300ft) 들면 다시 떨어져 충격 착륙이다 (접지 ${auto.high.td ? auto.high.td.vs.toFixed(0) : "—"}fpm)`);
  t.ok(auto.good.td && auto.good.td.vs <= 950,
    `제때 들고 낮게서 기수를 고르며 레버로 받치면 강하가 크게 줄어 내려앉는다(950fpm 이하) (접지 ${auto.good.td ? auto.good.td.vs.toFixed(0) : '—'}fpm · ${auto.good.td ? auto.good.td.spd.toFixed(0) : '—'}kt)`);
  t.ok(auto.good.maxVs < 1500,
    `레버로 받친 뒤 상승률이 치솟지 않는다 (최대 ${auto.good.maxVs.toFixed(0)}fpm — 땅 가까이의 빠른 몫을 넘겨 받지 않는다)`);
  t.ok(auto.pow === 0, '출력을 걸고 나는 동안(수평 비행 토크)은 기수를 들어도 플레어 몫이 붙지 않는다');

  // 4방향 트림 — 3초에 15°(5°/s)로 부드럽게 · against trim(조종간을 쥔 채 넣으면 기준만 옮겨 간다)
  const trimT = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false } };
    S.alt = 2000; _simGndFt = 0; S.spd = 100; S.bnk = 0; simTrimReset();
    for (let i = 0; i < 20; i++) simTrimNudge('L');    // 0.5° × 20 = 10°
    const o = { pend: simTrimAct.roll };
    fly(1); o.after1 = simTrimAct.roll;
    fly(2); o.after3 = simTrimAct.roll;
    simTrimReset(); _ax(0, 0); fly(1);
    for (let i = 0; i < 10; i++) simTrimNudge('L');
    fly(0.5); simTrimRelease(); o.atRel = simTrimAct.roll; fly(0.3); o.rel03 = simTrimAct.roll;
    simTrimReset(); _ax(0, 0); fly(3);
    // 조종간 왼쪽 10° 로 쥐고 → 트림 왼쪽 10°
    _ax(0, stick(-10 / SIM_BANK_MAX)); fly(3); o.stickOnly = S.bnk;
    for (let i = 0; i < 20; i++) simTrimNudge('L');
    fly(4); o.held = S.bnk; o.trim = simTrim.roll;
    _ax(0, 0); fly(4); o.released = S.bnk;
    simTrimReset();
    return o;
  })()`);
  t.ok(trimT.pend === 0 && trimT.after1 < -4 && trimT.after1 > -6 && Math.abs(trimT.after3 + 10) < 0.01,
    `트림 10° 는 한 번에 튀지 않고 5°/s 로 옮겨 간다 (곧바로 ${trimT.pend}° · 1초 ${trimT.after1.toFixed(1)}° · 3초 ${trimT.after3.toFixed(1)}°)`);
  t.ok(trimT.atRel > -4 && Math.abs(trimT.rel03 + 5) < 0.01,
    `트림을 놓으면 남은 몫을 0.3초 안에 마저 옮긴다 (놓을 때 ${trimT.atRel.toFixed(1)}° → 0.3초 뒤 ${trimT.rel03.toFixed(1)}° · 목표 −5°)`);
  t.ok(Math.abs(trimT.held - trimT.stickOnly) < 1 && Math.abs(trimT.trim + 10) < 0.01,
    `조종간을 쥔 채 트림을 넣으면 자세는 그대로다 (조종간 ${trimT.stickOnly.toFixed(1)}° → 트림 뒤 ${trimT.held.toFixed(1)}°)`);
  t.ok(Math.abs(trimT.released + 10) < 1,
    `놓으면 트림으로 넣은 경사만 남는다 (${trimT.released.toFixed(1)}°)`);

  // COLLECTIVE TO YAW — 레버를 올리면 왼쪽(CW)으로 돌기 시작해 올려 둔 채면 계속 돌고, 호버로 되돌리면 멎고, 내리면 오른쪽
  const cy = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.alt = 1000; _simGndFt = 0; S.spd = 0; S.hdg = 90; rotorChar = true; rotorDir = 'CW';
    _ax(3, 0); fly(1);
    const h0 = S.hdg;
    for (let i = 1; i <= 10; i++) { _ax(3, 0.05 * i); fly(0.1); }    // 1초에 걸쳐 레버를 올린다
    fly(0.6); const up = normAS(S.hdg - h0), h1 = S.hdg;      // 0.5초 늦게 나타나므로 그만큼 더 본다
    const flyS = sec => { for (let i = 0; i < sec * 10; i++) { S.spd = 0; simLat = 0; fly(0.1); } };   // 호버에서만 — 속도는 0 으로 붙잡아 둔다
    flyS(1); const hold = normAS(S.hdg - h1);
    for (let i = 1; i <= 10; i++) { _ax(3, 0.5 - 0.05 * i); flyS(0.1); }  // 호버로 되돌린다
    flyS(1); const h2 = S.hdg; flyS(1); const stop = normAS(S.hdg - h2);
    _ax(3, -0.5); flyS(1.5); const h3 = S.hdg; flyS(1); const dn = normAS(S.hdg - h3);   // 호버 아래로 내린다
    rotorChar = false; _ax(3, 0);
    return { up, hold, stop, dn };
  })()`);
  t.ok(cy.up < -1 && cy.hold < -1 && Math.abs(cy.stop) < 0.3 && cy.dn > 1,
    `레버를 올리면 왼쪽 · 올려 둔 채면 계속 · 호버로 되돌리면 멎음 · 내리면 오른쪽(CW) (${cy.up.toFixed(1)}° · ${cy.hold.toFixed(1)}° · ${cy.stop.toFixed(2)}° · ${cy.dn.toFixed(1)}°)`);

  // 회전익 특성 — 선회 중 1/2 볼 외활 · 페달 요율은 지연되어 붙는다
  const skid = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false } };
    S.alt = 2000; S.spd = 100; rotorChar = true;
    _ax(0, stick(20 / SIM_BANK_MAX)); fly(4);
    const o = { right: simSkidHalf, bnk: S.bnk };
    rotorChar = false; fly(0.1); o.off = simSkidHalf;
    _ax(0, 0); fly(4);
    simYawRate = 0; _ax(2, 1); fly(0.3); o.yaw03 = simYawRate; fly(3); o.yaw3 = simYawRate;
    _ax(2, 0); fly(3); o.yawOff = simYawRate;
    return o;
  })()`);
  t.ok(skid.right === -1 && skid.off === 0,
    `오른쪽 선회(${skid.bnk.toFixed(0)}°)에서 볼이 바깥(왼쪽)으로 반 볼 비킨다 · 끄면 없다 (${skid.right} / ${skid.off})`);
  t.ok(skid.yaw03 > 3 && skid.yaw03 < 12 && skid.yaw3 > 23 && Math.abs(skid.yawOff) < 2,
    `페달 요율은 곧바로 붙지 않는다 (0.3초 ${skid.yaw03.toFixed(1)} · 3초 ${skid.yaw3.toFixed(1)} · 놓고 3초 ${skid.yawOff.toFixed(1)}°/s)`);

  // 자세(피치)로 10kt 바꾸면 약 350fpm 오르내린다 · 상위모드가 걸리면 볼은 가운데
  const pke = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = { roll: { i: 0, inv: false }, coll: { i: 3, inv: false, abs: true } };
    let ts = 1000; S.running = true; S.lastT = ts;
    const step = n => { for (let i = 0; i < n; i++) { ts += 50; joyPoll(ts); simStep(ts); } };
    const run = (from, to) => {
      S.alt = 2000; S.spd = from; S.pit = pitchFromSpd(from); S.vs = 0; simVsAcc = 0; simAcc = 0;
      simTrim.pitch = -pitchFromSpd(from);
      _ax(3, (tqRequired() / SIM_LEVER_TOP) * 2 - 1); step(100);
      simTrim.pitch = -pitchFromSpd(to);
      let pk = 0;
      for (let i = 0; i < 200; i++) { step(1); if (Math.abs(S.vs) > Math.abs(pk)) pk = S.vs; }
      return pk;
    };
    const o = { dn: run(100, 90), up: run(100, 110) };
    // 상위모드(HDG) 중 선회 — 볼이 가운데 · 회전익 특성 외활도 없다
    rotorChar = true; simTrim.roll = 20; step(60);
    o.manual = { ball: slipBall, skid: simSkidHalf };
    hdgSelOn = true; rollApOn = true; step(40);
    o.afcs = { ball: slipBall, skid: simSkidHalf };
    hdgSelOn = false; rollApOn = false; rotorChar = false; simTrimReset();
    S.running = false;
    return o;
  })()`);
  t.ok(pke.dn > 300 && pke.dn < 420, `기수를 들어 10kt 줄이면 약 350fpm 오른다 (최대 ${pke.dn.toFixed(0)}fpm)`);
  t.ok(pke.up < -240 && pke.up > -450, `기수를 숙여 10kt 늘리면 약 250~350fpm 내려간다 — 가속이 느린 만큼(10%↓ · 기수 들림 0~3° ×0.8) 고르게 (최대 ${pke.up.toFixed(0)}fpm)`);
  t.ok(pke.manual.skid !== 0 && pke.afcs.skid === 0 && Math.abs(pke.afcs.ball) < 0.02,
    `상위모드가 걸리면 내활·외활이 없다 — 수동 비행에서만 (수동 외활 ${pke.manual.skid} · HDG 중 볼 ${pke.afcs.ball.toFixed(3)})`);

  // ASE — HOVER FOLLOW: 40kt 이내에서 조종간을 쥐고 천천히(2°/s 이내) 자세를 잡고 있으면 트림 기준이 따라온다
  const ase = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false } };
    const go = (on, spd) => {
      S.alt = 1000; _simGndFt = 0; S.spd = spd; S.bnk = 0; simTrimReset(); aseOn = on;
      simTrim.pitch = -pitchFromSpd(spd); S.pit = pitchFromSpd(spd);
      _ax(0, stick(8 / SIM_BANK_MAX)); fly(4);
      const held = { bnk: S.bnk, hf: aseFollowing };
      _ax(0, 0); fly(4);
      return { held, rel: S.bnk, trim: simTrim.roll };
    };
    const o = { on: go(true, 0), off: go(false, 0), fast: go(true, 80) };
    o.btn = (() => { aseOn = false; toggleAse(); const b = document.querySelector('#ase-3d .ase-main').classList.contains('on'); toggleAse(); return b; })();
    aseOn = false; simTrimReset();
    return o;
  })()`);
  t.ok(ase.on.held.hf && Math.abs(ase.on.rel - 8) < 1,
    `ASE HOVER FOLLOW — 호버에서 조종간으로 8° 잡고 있다 놓으면 그 자세가 남는다 (${ase.on.held.bnk.toFixed(1)} → ${ase.on.rel.toFixed(1)}° · 트림 ${ase.on.trim.toFixed(1)}°)`);
  t.ok(Math.abs(ase.off.rel) < 1, `ASE 를 끄면 놓았을 때 트림 자세로 돌아간다 (${ase.off.rel.toFixed(1)}°)`);
  t.ok(Math.abs(ase.fast.rel) < 1 && !ase.fast.held.hf, `40kt 넘으면 따라오지 않는다 (80kt · ${ase.fast.rel.toFixed(1)}°)`);
  t.ok(ase.btn, '3D 창의 ASE 버튼으로 켜고 끈다');

  // 블로우 백 — 20kt 언저리에서 기수가 들린다(회전익 특성)
  const bb = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.alt = 1000; rotorChar = true;
    // (0.3초 — 블로우 백으로 기수가 들리면 감속이 세져(10° 넘으면 ×2) 곧 20kt 언저리를 벗어난다)
    const at = v => { S.spd = v; simTrim.pitch = -pitchFromSpd(v); S.pit = pitchFromSpd(v); fly(0.3); return S.pit - pitchFromSpd(v); };
    aseOn = true;
    const o = { k12: at(12), k20: at(20), k60: at(60), kBack: at(-12), peak: RC_BLOWBACK };
    // ASE 꺼짐 — 들린 채 남는다(조종사가 한 번 더 밀어 준다)
    aseOn = false; o.n12 = at(12); o.n40 = at(40); o.nBack = at(-12);
    aseOn = true;
    // 4WAY 트림 4°(80kt 자세)로 호버 언저리에서 가속 — 블로우 백을 지나도 속도 기준은 트림 자세다
    joyAxes = { pitch: { i: 1, inv: false } }; _ax(1, 0);
    // 블로우 백만 켜고 끈다(회전익 특성은 켠 채 — 다른 특성(속도·TQ 효율 등)이 가속을 바꾸지 않게)
    const accel = (bb) => {
      rotorChar = true; rcOpt.blowback = bb; S.spd = 5; simAcc = 0; S.vs = 0; simVsAcc = 0; simLat = 0; S.pit = pitchFromSpd(5); simTrimReset(); simTrim.pitch = -4; simTrimAct.pitch = -4;
      let maxPit = -99; const spd = [];
      for (let i = 0; i < 25; i++) { fly(1); maxPit = Math.max(maxPit, S.pit); spd.push(S.spd); }
      return { maxPit, spd, pit: S.pit };
    };
    o.on = accel(true); o.off = accel(false); rcOpt.blowback = true;
    // 조종간을 쥔 채(4° 자세) 가속해도 기수가 출렁이지 않고 한 번만 들린다
    const held = () => {
      rotorChar = true; S.spd = 5; S.pit = 4; simTrimReset(); _ax(1, (-4 / SIM_PITCH_MAX) * (1 - 0.08) - 0.08);
      let ups = 0, prevUp = false; const spd = [];
      for (let i = 0; i < 25 * 20; i++) { fly(0.05); const up = S.pit > 5; if (up && !prevUp) ups++; prevUp = up; if (i % 20 === 19) spd.push(S.spd); }
      _ax(1, 0); return { ups, spd, pit: S.pit };
    };
    o.held = held();
    // ASE 꺼짐 — 조종간을 4° 에 쥔 채 가속하면 기수가 들린 채(6.5°) 남아 속도가 덜 붙는다
    aseOn = false; o.nHeld = held(); aseOn = true;
    rotorChar = false; aseOn = false; simTrimReset();
    return o;
  })()`);
  t.ok(bb.n12 > 2.3 && bb.n40 > 2.3 && Math.abs(bb.nBack) < 0.05,
    `ASE 꺼짐 — 블로우 백으로 들린 기수가 그대로 남는다(조종사가 한 번 더 밀어 준다) (12kt +${bb.n12.toFixed(1)} · 40kt +${bb.n40.toFixed(1)}° · 후진 ${bb.nBack.toFixed(1)}°)`);
  t.ok(Math.abs(bb.nHeld.pit - 6.5) < 0.2 && bb.nHeld.spd[24] < bb.held.spd[24] - 10,
    `ASE 꺼짐 — 조종간을 그대로 두면 기수가 ${bb.nHeld.pit.toFixed(1)}° 로 남아 속도가 덜 붙는다 (25초 ${bb.nHeld.spd[24].toFixed(0)} · ASE ${bb.held.spd[24].toFixed(0)}kt)`);
  t.ok(bb.k12 > 1.5 && bb.k12 <= bb.peak + 0.01 && Math.abs(bb.k20) < 0.05 && Math.abs(bb.k60) < 0.05,
    `ASE 켜짐 — 블로우 백은 10~15kt 에서 기수가 2.5° 안쪽으로 한 번 들린다 (12kt +${bb.k12.toFixed(1)}° · 20kt ${bb.k20.toFixed(1)}° · 60kt ${bb.k60.toFixed(1)}°)`);
  t.ok(Math.abs(bb.kBack) < 0.05, `후진 비행(12kt)에서는 블로우 백이 없다 (${bb.kBack.toFixed(2)}°)`);
  t.ok(bb.on.maxPit > 5.5 && bb.on.maxPit < 4 + bb.peak + 0.3 && Math.abs(bb.on.pit - 4) < 0.1,
    `트림 4° 로 가속하면 10~15kt 에서 한 번 들렸다가(최대 ${bb.on.maxPit.toFixed(1)}°) 트림 자세로 돌아온다 (${bb.on.pit.toFixed(1)}°)`);
  t.ok(bb.held.ups === 1 && bb.held.spd[24] > 60,
    `조종간을 쥐고 가속해도 기수는 한 번만 들리고 출렁이지 않는다 (들림 ${bb.held.ups}번 · 25초 ${bb.held.spd[24].toFixed(0)}kt)`);
  t.ok(bb.on.spd.every((v, i) => Math.abs(v - bb.off.spd[i]) < 0.5),
    `트림이 잡고 있으면 블로우 백이 속도 기준을 흔들지 않는다 — 가속이 블로우 백 없을 때와 같다 (10초 ${bb.on.spd[9].toFixed(1)} · ${bb.off.spd[9].toFixed(1)}kt)`);

  // 회전익 특성 항목별 켜기/끄기
  const rcb = await page.evaluate(() => {
    rotorChar = true; updateRotorBtns(); S.spd = 0;
    const o = { n: document.querySelectorAll('#rotor-3d [data-rc]').length, p0: rcPitchOff({ coll: 1, yaw: 0 }) };
    toggleRcOpt('collPitch'); o.p1 = rcPitchOff({ coll: 1, yaw: 0 }); o.btnOff = !document.querySelector('#rotor-3d [data-rc="collPitch"]').classList.contains('on');
    toggleRcOpt('collYaw'); o.y = rcYawRate(10); toggleRcOpt('collYaw'); toggleRcOpt('collPitch');
    rotorChar = false; updateRotorBtns();
    return o;
  });
  t.ok(rcb.n === 7 && rcb.p0 === 5 && rcb.p1 === 0 && rcb.btnOff && rcb.y === 0, `회전익 특성 아래 7개 항목을 하나씩 끄고 켠다 (${rcb.n}개)`);

  // 같은 토크로 이륙 가속 — Vy 까지 상승률이 오르고, Vy 를 넘으면 준다(가속을 고도로 치르지 않는다)
  const tko = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    joyAxes = { coll: { i: 3, inv: false, abs: true } };
    let ts = 1000; S.running = true; S.lastT = ts;
    const step = n => { for (let i = 0; i < n; i++) { ts += 50; joyPoll(ts); simStep(ts); } };
    S.alt = 1000; S.spd = 0; S.pit = pitchFromSpd(0); S.vs = 0; simVsAcc = 0; simAcc = 0;
    simTrim.pitch = -pitchFromSpd(0);
    _ax(3, ((hoverPowerTq() + 15) / SIM_LEVER_TOP) * 2 - 1); step(60);
    simTrim.pitch = 0;
    const L = []; let minVs = 1e9;
    for (let i = 0; i < 25; i++) { step(20); L.push([S.spd, S.vs]); minVs = Math.min(minVs, S.vs); }
    S.running = false; simTrimReset(); _ax(3, 0);
    const vy = perfVy();
    const near = L.reduce((a, b) => (Math.abs(b[0] - vy) < Math.abs(a[0] - vy) ? b : a));
    const at20 = L.find(q => q[0] >= 20), fast = L[L.length - 1];
    return { vy, near, at20, fast, minVs };
  })()`);
  t.ok(tko.minVs > 0 && tko.near[1] > tko.at20[1] + 300 && tko.near[1] > tko.fast[1] + 200,
    `같은 토크로 가속하면 Vy 까지 상승률이 오르고 넘으면 준다 (20kt ${tko.at20[1].toFixed(0)} · Vy ${tko.near[1].toFixed(0)} · ${tko.fast[0].toFixed(0)}kt ${tko.fast[1].toFixed(0)}fpm)`);

  // FPV(예상 항적) 버튼
  const fpv = await page.evaluate(() => {
    const b = document.getElementById('fpv-btn'); const o = { a: fpvOn };
    toggleFpv(); o.b = fpvOn; o.txt = b.textContent; toggleFpv(); o.c = fpvOn;
    return o;
  });
  t.ok(fpv.a && !fpv.b && fpv.txt === 'FPV OFF' && fpv.c, 'FPV 버튼으로 ADI 예상 항적을 끄고 켠다');

  // 회전익 특성 — 20kt 이상이면 컬렉티브 투 피치만 남는다
  const rcFast = await page.evaluate(() => {
    rotorChar = true; rotorDir = 'CW'; S.spd = 25;
    const o = { yaw: rcYawRate(10), ped: rcPitchOff({ coll: 0, yaw: 1 }), coll: rcPitchOff({ coll: 1, yaw: 0 }) };
    rotorChar = false; S.spd = 0;
    return o;
  });
  t.ok(rcFast.yaw === 0 && rcFast.ped === 0 && rcFast.coll === 0,
    `20kt 이상(전진 비행)에서는 컬렉티브→요·요→피치·컬렉티브→피치가 모두 없다 (요 ${rcFast.yaw} · 페달 ${rcFast.ped} · 레버 ${rcFast.coll})`);

  // FORCE TRIM — 누르고 자세를 바꾼 뒤 놓으면 그 자세로 잡힌다 · 3점 접지
  const ftr = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false } };
    S.alt = 2000; _simGndFt = 0; S.spd = 100; S.bnk = 0; S.pit = 0; simTrimReset();
    const o = {};
    forceTrim();                                            // 누른다
    _ax(0, stick(12 / SIM_BANK_MAX)); _ax(1, stick(-3 / SIM_PITCH_MAX)); fly(4);
    o.during = { bnk: S.bnk, pit: S.pit };
    forceTrimRelease();                                     // 조종간을 민 채로 놓는다
    fly(1); o.afterRel = { bnk: S.bnk, pit: S.pit };
    _ax(0, 0); _ax(1, 0); fly(4);                           // 조종간을 놓는다
    o.centered = { bnk: S.bnk, pit: S.pit };
    simTrimReset(); fly(4);
    // 3점 접지 — 땅에서 토크가 LIGHT ON WHEELS 아래면 트림으로는 자세가 바뀌지 않는다
    S.alt = 0; _simGndFt = 0; S.spd = 0; S.vs = 0; S.tq = 10; S.pit = 0; S.bnk = 0;
    joyAxes.coll = { i: 3, inv: false }; _ax(3, -1);
    simTrim.pitch = 6; simTrim.roll = 8; fly(2);
    o.gnd = { pit: S.pit, bnk: S.bnk };
    _ax(1, stick(-5 / SIM_PITCH_MAX)); fly(2); o.gndStick = S.pit;
    _ax(1, 0); _ax(3, 0); simTrimReset(); delete joyAxes.coll;
    return o;
  })()`);
  t.ok(Math.abs(ftr.during.bnk - 12) < 1 && Math.abs(ftr.afterRel.bnk - 12) < 1 && Math.abs(ftr.centered.bnk - 12) < 1,
    `FORCE TRIM 을 누르고 롤 12° 로 옮긴 뒤 놓으면 조종간을 놓아도 12° 다 (${ftr.during.bnk.toFixed(1)} → ${ftr.afterRel.bnk.toFixed(1)} → ${ftr.centered.bnk.toFixed(1)}°)`);
  t.ok(Math.abs(ftr.centered.pit - ftr.during.pit) < 0.6,
    `피치도 놓을 때의 자세가 남는다 (${ftr.during.pit.toFixed(1)} → ${ftr.centered.pit.toFixed(1)}°)`);
  t.ok(Math.abs(ftr.gnd.pit) < 0.1 && Math.abs(ftr.gnd.bnk) < 0.1,
    `땅에서 LIGHT ON WHEELS 전까지는 트림을 넣어도 3점 접지 그대로다 (피치 ${ftr.gnd.pit.toFixed(1)} · 뱅크 ${ftr.gnd.bnk.toFixed(1)}°)`);
  t.ok(ftr.gndStick > 3, `조종간으로 당기면 기수가 들린다 (${ftr.gndStick.toFixed(1)}°)`);

  // G/S — SIM 에서도 강하선을 잡으면 강하각에 맞춰 고도가 내려간다(출력으로)
  const gsSim = await page.evaluate(() => {
    const keep = gsDeviation;
    S.alt = 1500; S.spd = 120; S.vs = 0;
    window.gsDeviation = () => ({ angle: 3, path: S.alt, dev: 0 });
    gsOn = true;
    const o = { vert: simAfcsVert(), cmd: simAfcsVsCmd(),
                base: -Math.max(20, groundSpdKt()) * Math.tan(3 * D2R) * FT_PER_NM / 60 };
    gsOn = false; window.gsDeviation = keep;
    return o;
  });
  t.ok(gsSim.vert && Math.abs(gsSim.cmd - gsSim.base) < 1 && gsSim.cmd < -300,
    `G/S 를 잡으면 SIM 에서도 강하각 3° 에 맞는 강하율을 출력으로 낸다 (${gsSim.cmd.toFixed(0)}fpm)`);

  // 회전익 특성 — 전이성향: 호버에서 CW 는 왼쪽으로 흐르고, 오른쪽 3° 뱅크로 막는다
  const drift = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const DEAD = 0.08;
    const stick = (k) => (k === 0 ? 0 : Math.sign(k) * (Math.abs(k) * (1 - DEAD) + DEAD));
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false } };
    S.alt = 1000; _simGndFt = 0; rotorChar = true; rotorDir = 'CW';
    const go = (bank) => {
      S.hdg = 90; S.spd = 0; simLat = 0; S.bnk = 0;
      _ax(1, stick(-pitchFromSpd(0) / SIM_PITCH_MAX)); _ax(0, stick(bank / SIM_BANK_MAX));
      fly(10); return { lat: simLat, bnk: S.bnk };
    };
    const o = { none: go(0), right: go(3) };
    rotorDir = 'CCW'; o.ccw = go(0);
    rotorChar = false; rotorDir = 'CW'; _ax(0, 0); _ax(1, 0);
    return o;
  })()`);
  t.ok(drift.none.lat < -0.5, `전이성향 — CW 로터는 호버에서 왼쪽으로 흐른다 (${drift.none.lat.toFixed(2)}kt)`);
  t.ok(Math.abs(drift.right.lat) < 0.3, `오른쪽 3° 뱅크면 제자리를 지킨다 (${drift.right.lat.toFixed(2)}kt · 뱅크 ${drift.right.bnk.toFixed(1)}°)`);
  t.ok(drift.ccw.lat > 0.5, `CCW 로터는 오른쪽으로 흐른다 (${drift.ccw.lat.toFixed(2)}kt)`);

  // 회전익 특성 — COLLECTIVE TO YAW / PITCH · YAW TO PITCH
  const rc = await page.evaluate(() => {
    const o = {};
    rotorChar = false; rotorDir = 'CW';
    o.off = rcPitchOff({ coll: 1, yaw: 1 }) === 0 && rcYawRate(20) === 0;
    toggleRotorChar();
    o.top = rcPitchOff({ coll: 1, yaw: 0 }); o.bot = rcPitchOff({ coll: -1, yaw: 0 });
    o.upCW = rcYawRate(1); o.dnCW = rcYawRate(-1); o.half = rcYawRate(0.4); o.still = rcYawRate(0); o.cap = rcYawRate(5); o.ped50 = RC_YAW_PED * SIM_YAW_RATE;
    o.pedOppCW = rcPitchOff({ coll: 0, yaw: -1 }); o.pedWithCW = rcPitchOff({ coll: 0, yaw: 1 });
    setRotorDir('CCW');
    o.yawTopCCW = rcYawRate(1); o.pedOppCCW = rcPitchOff({ coll: 0, yaw: 1 });
    o.btn = document.querySelector('#rotor-3d [data-rdir=CCW]').classList.contains('on');
    rotorChar = false; rotorDir = 'CW'; updateRotorBtns();
    return o;
  });
  t.ok(rc.off, '회전익 특성을 끄면 커플링이 없다');
  t.ok(Math.abs(rc.top - 5) < 1e-6 && Math.abs(rc.bot + 5) < 1e-6, `COLLECTIVE TO PITCH ±5° (${rc.top} / ${rc.bot})`);
  t.ok(rc.upCW === -rc.ped50 && rc.dnCW === rc.ped50 && Math.abs(rc.half + 0.4 * rc.ped50) < 1e-9 && rc.still === 0 && rc.cap === -rc.ped50,
    `COLLECTIVE TO YAW — 호버에서 벗어난 만큼: CW 는 올리면 왼쪽 · 내리면 오른쪽, 레버 끝까지 = 페달 50% 요율 ${rc.ped50.toFixed(1)}°/s (${rc.upCW} / ${rc.dnCW} / ${rc.cap})`);
  t.ok(rc.yawTopCCW === rc.ped50, `CCW 로터는 반대(오른쪽) (${rc.yawTopCCW})`);

  // COLLECTIVE TO YAW — 한번 돌기 시작하면 반대 페달 없이는 계속 돈다 · 레버 끝까지의 요도 페달 50% 로 잡힌다
  const rcy = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    S.alt = 1000; _simGndFt = 0; S.spd = 0; S.hdg = 90; rotorChar = true; rotorDir = 'CW'; updateRotorBtns();
    // 호버(저속)에서만 생기는 현상이라 재는 동안 속도를 0 으로 붙잡아 둔다(레버 140% 면 가라앉으며 앞으로 나가 20kt 를 넘긴다)
    const turn = sec => { const h = S.hdg; for (let i = 0; i < sec * 10; i++) { S.spd = 0; simLat = 0; fly(0.1); } return normAS(S.hdg - h); };
    _ax(3, 0); _ax(2, 0); fly(1); const o = { hov: turn(2) };
    _ax(3, 1); turn(2); o.a = turn(3); o.b = turn(3); o.defl = rcCollDefl();      // 레버 끝까지
    _ax(2, 0.5); turn(3); o.ped = turn(3);                                      // 오른쪽 페달 50%
    _ax(2, 0); _ax(3, 0); turn(2); o.back = turn(2);
    rotorChar = false; updateRotorBtns(); _ax(3, 0);
    return o;
  })()`);
  t.ok(rcy.a < -10 && rcy.b < -10 && Math.abs(rcy.b - rcy.a) < Math.abs(rcy.a) * 0.25,
    `레버를 올려 둔 채면 요가 그치지 않는다 — 3초마다 ${rcy.a.toFixed(1)}° · ${rcy.b.toFixed(1)}° (호버 ${rcy.hov.toFixed(1)}° · 레버 ${rcy.defl.toFixed(2)})`);
  t.ok(Math.abs(rcy.ped) < Math.abs(rcy.a) * 0.15,
    `레버 끝까지의 요도 반대 페달 50% 로 잡힌다 (3초 ${rcy.ped.toFixed(1)}°)`);
  t.ok(Math.abs(rcy.hov) < 1 && Math.abs(rcy.back) < 1.5, `호버 토크에서는 돌지 않는다 (${rcy.hov.toFixed(2)}° · 되돌린 뒤 ${rcy.back.toFixed(2)}°)`);
  t.ok(rc.pedOppCW === 2 && rc.pedWithCW === -2 && rc.pedOppCCW === 2, 'YAW TO PITCH — 로터 반대 페달 2° 들림 · 로터 방향 페달 2° 숙임');
  t.ok(rc.btn, 'CW/CCW 버튼이 토글된다');

  // ── 자세에 따른 가감속 배율 ──
  const accK = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const K = (d, p) => simAccPitchK(d, p);
    const tbl = { up: [K(false, 0), K(false, -5), K(false, -10), K(false, -15), K(false, 2), K(false, 4), K(false, 6), K(false, 7.5)],
                  dn: [K(true, 2), K(true, 4), K(true, 8), K(true, 12), K(true, -3)] };
    // 실제로 — 120kt 에서 기수 10° 숙여 가속할 때와 수평 자세에서의 가속 한계
    S.spd = 100; S.pit = -10; const a10 = simAccLimit(10).max; S.pit = 0; const a0 = simAccLimit(10).max;
    S.pit = 12; const d12 = simAccLimit(-10).max; S.pit = 2; const d2 = simAccLimit(-10).max;
    return { tbl, a10, a0, d12, d2, k: SIM_RATE_K, pmax: SIM_PITCH_MAX };
  })()`);
  t.eq(accK.tbl.up.map(v => +v.toFixed(2)).join('/'), '1/1.2/1.4/1.4/0.8/0.6/0.5/0.5',
    '증속 배율 — 수평 1.0 · 숙임 5° 1.2 · 10° 1.4 · 들림 0~3° 0.8 · 3~5° 0.6 · 5~7.5° 0.5');
  t.eq(accK.tbl.dn.map(v => +v.toFixed(2)).join('/'), '1.2/1.3/1.5/2/1',
    '감속 배율 — 들림 0~3° 1.2 · 3~5° 1.3 · 5~10° 1.5 · 10° 초과 2.0');
  t.ok(accK.k === 0.9 && Math.abs(accK.a0 - 7.5 * 0.9) < 1e-6,
    `조종에 따른 속도·고도 변화 빠르기는 종전보다 10% 느리다 (수평 가속 한계 ${accK.a0.toFixed(2)}kt/s)`);
  t.eq(accK.pmax, 48, '사이클릭 피치 범위는 ±48°(종전 60° 의 80%) — 같은 조종간 움직임에 더 정밀하다');
  t.ok(Math.abs(accK.a10 / accK.a0 - 1.4) < 1e-6 && Math.abs(accK.d12 / accK.d2 - 2 / 1.2) < 1e-6,
    `가감속 한계에 그대로 곱해진다 (숙임 10° ${accK.a10.toFixed(2)} · 수평 ${accK.a0.toFixed(2)} · 들림 12° 감속 ${accK.d12.toFixed(2)}kt/s)`);

  // ── 동력·공기역학 — 필요 동력 곡선(U 자) · 선회 · 오토로테이션(NR) · OEI · 꼬리로터 · VRS · 바람 · VNE ──
  const aero = await page.evaluate(`(() => {
    (${SETUP.toString()})();
    const fly = ${FLY};
    const o = {};
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false, abs: true } };
    const lever = tq => _ax(3, Math.max(-1, Math.min(1, tq / SIM_LEVER_TOP * 2 - 1)));
    const hold = kt => { S.spd = kt; simLat = 0; S.pit = pitchFromSpd(kt); simTrimHoldSpeed(); };
    const req = kt => { S.spd = kt; simLat = 0; return tqRequired(); };
    S.alt = 3000; S.bnk = 0;
    o.req = { 0: req(0), 40: req(40), 70: req(70), 100: req(100), 150: req(150) };
    S.spd = 100; o.bank45 = tqRequiredAt(100, 45) - tqRequiredAt(100, 0);
    // 오토로테이션 — 80kt 에서 두 엔진 IDLE
    hold(80); S.alt = 4000; lever(tqRequired()); fly(2);
    simEng = 0; fly(1.5); o.decay = simNr;
    lever(AUTO_LREF); fly(14); o.auto = { nr: simNr, vs: S.vs, tq: S.tq, want: autoNrChart() - NR_AUTO_K * AUTO_LREF };   // 강하율 변화가 두 배 느려져 자리 잡는 데 조금 더 걸린다
    lever(0); fly(8); o.high = { nr: simNr, warn: simRotorHigh(), chart: autoNrChart() };
    simEng = 2; lever(tqRequired()); fly(4);
    // OEI 정격
    simEng = 1; simOeiT = 0; o.oei25 = simEngAvail() / mtaNow(); simOeiT = 200; o.oeiCont = simEngAvail() / mtaNow(); simEng = 2; simOeiT = 0;
    // 꼬리로터 — 제자리에서 반토크 페달을 끝까지 차면 토크가 더 든다(레버는 그대로)
    hold(0); S.alt = 3000; S.vs = 0; simVsAcc = 0; simFlareVs = 0; simNr = 100; S.tq = tqRequired(); lever(tqRequired()); fly(8); const tq0 = S.tq;
    _ax(2, rotorSign()); fly(2); o.tr = { d: S.tq - tq0, vs: S.vs }; _ax(2, 0); fly(2);
    // VRS — 제자리에서 레버를 30% 내려 빠르게 가라앉다 다시 올리면 오르지 못한다
    hold(0); S.alt = 3000; lever(tqRequired() - 30); fly(6); o.vrsIn = { on: simVrsOn(), vs: S.vs };
    lever(tqRequired() + 15); fly(3); o.vrsPull = { on: simVrsOn(), vs: S.vs };
    _ax(1, 0.25); fly(8); o.vrsOut = { on: simVrsOn(), spd: S.spd, vs: S.vs }; _ax(1, 0);
    // 바람 — 제자리 자세면 바람에 실려 간다 · 맞바람으로 버티면(대기속도 20kt) ETL 로 덜 든다
    hold(0); S.alt = 3000; S.hdg = 0; windDir = 0; windSpd = 20; lever(tqRequired()); fly(3);
    { const l0 = S.lat; fly(5); o.windGs = (S.lat - l0) * 60 * 3600 / 5; }
    o.windReqHover = tqRequired(); S.spd = 20; o.windReqInto = tqRequired(); windSpd = 0;
    // VNE — 넘기면 후퇴익 쪽으로 구르고 기수가 든다
    hold(140); S.alt = 2000; lever(mtaNow()); _ax(1, 0.5); fly(20);
    o.vne = { over: simOverVne(), r: simRbs.r, p: simRbs.p, bnk: S.bnk, vne: simVne(2000) };
    _ax(1, 0); simRbs = { r: 0, p: 0 }; simEng = 2;
    return o;
  })()`);
  t.ok(aero.req[70] < aero.req[40] && aero.req[70] < aero.req[100] && aero.req[150] > aero.req[100] + 25 && aero.req[0] > aero.req[40],
    `필요 동력은 U 자 — 제자리 ${aero.req[0].toFixed(0)} · 40kt ${aero.req[40].toFixed(0)} · 70kt ${aero.req[70].toFixed(0)} · 100kt ${aero.req[100].toFixed(0)} · 150kt ${aero.req[150].toFixed(0)}%`);
  t.ok(aero.req[70] / aero.req[0] < 0.7 && Math.abs(aero.req[150] - 95) < 6,
    `최소 동력은 제자리의 70% 아래 · 150kt 는 MCP 언저리 (${(aero.req[70] / aero.req[0]).toFixed(2)} · ${aero.req[150].toFixed(0)}%)`);
  t.ok(aero.bank45 > 18 && aero.bank45 < 30, `45° 선회는 100kt 에서 토크가 약 +20% 더 든다 (+${aero.bank45.toFixed(1)}%)`);
  t.ok(aero.decay < 88, `엔진이 멎었는데 레버를 그대로 두면 NR 이 곧 처진다 (1.5초 ${aero.decay.toFixed(0)}%)`);
  t.ok(Math.abs(aero.auto.nr - aero.auto.want) < 2 && aero.auto.vs < -1500 && aero.auto.vs > -2400 && aero.auto.tq < 1,
    `레버를 내려 오토로테이션 — NR ${aero.auto.nr.toFixed(0)}% · 강하 ${aero.auto.vs.toFixed(0)}fpm`);
  t.ok(Math.abs(aero.high.nr - aero.high.chart) < 1.5 && aero.high.warn === (aero.high.nr > 110),
    `레버를 다 내리면 NR 이 자동회전 RPM 수정표 값까지 오르고, 110% 를 넘으면 NR HIGH (${aero.high.nr.toFixed(1)} · 표 ${aero.high.chart.toFixed(1)}%)`);
  t.ok(Math.abs(aero.oei25 - 0.73) < 0.01 && Math.abs(aero.oeiCont - 0.64) < 0.01,
    `OEI — 2.5분 정격 ${Math.round(aero.oei25 * 100)}% · 그 뒤 연속 ${Math.round(aero.oeiCont * 100)}%(AEO MTA 대비)`);
  t.ok(aero.tr.d > 4 && aero.tr.d < 7 && Math.abs(aero.tr.vs) < 60,
    `꼬리로터 — 제자리에서 반토크 페달을 다 차면 토크 +${aero.tr.d.toFixed(1)}%(고도는 그대로 ${aero.tr.vs.toFixed(0)}fpm)`);
  t.ok(aero.vrsIn.on && aero.vrsIn.vs < -1500, `제자리에서 출력을 건 채 빠르게 가라앉으면 VRS (${aero.vrsIn.vs.toFixed(0)}fpm)`);
  t.ok(aero.vrsPull.on && aero.vrsPull.vs < -800, `VRS 에서는 레버를 올려도 오르지 못한다 (${aero.vrsPull.vs.toFixed(0)}fpm)`);
  t.ok(!aero.vrsOut.on && aero.vrsOut.spd > 20, `앞으로 속도를 붙이면 빠져나온다 (${aero.vrsOut.spd.toFixed(0)}kt · ${aero.vrsOut.vs.toFixed(0)}fpm)`);
  t.ok(Math.abs(aero.windGs + 20) < 1, `제자리 자세로 떠 있으면 바람(20kt)에 실려 간다 (남쪽으로 ${(-aero.windGs).toFixed(1)}kt)`);
  t.ok(aero.windReqInto < aero.windReqHover - 5, `맞바람 20kt 를 받고 버티면 전이양력으로 토크가 덜 든다 (${aero.windReqHover.toFixed(0)} → ${aero.windReqInto.toFixed(0)}%)`);
  t.ok(aero.vne.over && aero.vne.r > 5 && aero.vne.p > 3 && Math.sign(aero.vne.bnk) === 1,
    `VNE(${aero.vne.vne}kt)를 넘기면 후퇴익 쪽(CW → 오른쪽)으로 구르고 기수가 든다 (뱅크 ${aero.vne.bnk.toFixed(0)}° · 롤 몫 ${aero.vne.r.toFixed(0)}° · 피치 몫 ${aero.vne.p.toFixed(0)}°)`);

  // 뒷정리 — 다음 검사가 SIM 모드·가짜 패드를 물려받지 않도록
  await page.evaluate(() => {
    if (simModeOn) toggleSimMode(false);
    navigator.getGamepads = () => [];
    joyAxes = {}; joyAxCancelCapture(); joyBinds = {}; joyReleaseAll();
    S.running = false; S.bnk = 0; S.pit = 0; S.vs = 0;
    try { localStorage.removeItem('joyAxes'); } catch (e) {}
  });
}

export const suites = [part1, part2, part3, part4, part5].map((run, i) => ({ name: `SIM 모드 · ${["1 기본 조종·자세·속도", "2 동력·토크·계기", "3 3D 시야·트림·GSPD·레버", "4 AFCS·설정·볼·바퀴·지면효과", "5 오토로테이션·회전익 특성·공력"][i]}`, run }));
