// ── UPPER CONSOLE (상부 콘솔) ──
// 실기 상부 콘솔(오버헤드 패널)의 스위치를 창 하나에 그대로 옮긴 것. 탭의 'UPPER' 로 연다.
// 지금은 스위치 상태만 갖고 바뀔 때 알린다 — 시뮬레이터와의 연동은 ovhdOn() 으로 하나씩 붙인다.
//
//   ovhdGet(id)          지금 값(위치 이름 — 예 'OFF' · 'ON' · 'A/C LOW', 연속 노브는 0~10 의 수)
//   ovhdSet(id, v)       값을 바꾼다(그림·저장·알림까지)
//   ovhdOn(fn)           바뀔 때마다 fn(id, value, prev) — 연동은 여기에 건다
//   window 'ovhd' 이벤트  같은 내용(detail: { id, value, prev })
//
// 화면은 1000×1240 의 설계 크기로(아래 TQS 포함) 그리고 창에 맞춰 통째로 줄이고 키운다(사진의 비율 그대로).
// 조작: 토글은 레버 위쪽을 누르면 한 칸 위로, 아래쪽은 아래로 · 노브는 왼쪽 절반을 누르면
// 반시계, 오른쪽 절반은 시계 방향(마우스 휠도 된다) · 덮개 스위치는 덮개를 먼저 연다.

const OVHD_W = 1000, OVHD_H = 1240;
const OVHD_KEY = 'ovhdState';

// 연속 노브(밝기 · 온도) — 0~10, 양 끝만 글자
const DIM = { steps: 11, from: -135, to: 135 };

// ── 패널 구성 ── 판(plate) 여섯 장 · 좌표는 판 안에서(px, 설계 크기)
//   t: 'tg' 토글(pos 위→아래 · side 는 가운데 위치 글자를 옆에) · 'rot' 노브 · 'dim' 연속 노브
//      'guard' 덮개 토글 · 'pb' 누름 버튼 · 'th' T-핸들 · 'mom' 스프링 복귀 토글 · 'br' 묶음 머리글 · 'lbl' 글자
const OVHD_PLATES = [
  { x: 10, y: 10, w: 290, h: 300, items: [
    { t: 'rot', id: 'wiper', x: 140, y: 165, title: 'WINDSLD\nWIPER',
      pos: ['WASH', 'OFF', 'LOW', 'HI'], ang: [-55, 0, 45, 85], def: 'OFF' },
  ]},
  { x: 310, y: 10, w: 330, h: 300, items: [
    { t: 'br', x: 18, y: 42, w: 135, text: 'VAPOR VENT' },
    { t: 'tg', id: 'vapor1', x: 45, y: 112, title: 'NO1 ENG', pos: ['OFF', 'ON'], def: 'OFF', topLbl: '' },
    { t: 'tg', id: 'vapor2', x: 125, y: 112, title: 'NO2 ENG', pos: ['OFF', 'ON'], def: 'OFF', topLbl: '' },
    { t: 'lbl', x: 85, y: 88, text: 'OFF', small: true },
    { t: 'mom', id: 'chipTest', x: 85, y: 228, title: 'CHIP DETECTOR', pos: ['NORM', 'TEST'], def: 'NORM', red: true, topLbl: '' },
    { t: 'br', x: 172, y: 42, w: 145, text: 'TRAINING' },
    { t: 'guard', id: 'trng1', x: 208, y: 165, title: 'NO1 ENG', sub: 'TRNG', num: '1', pos: ['NORM', 'TRNG'], def: 'NORM' },
    { t: 'guard', id: 'trng2', x: 282, y: 165, title: 'NO2 ENG', sub: 'TRNG', num: '2', pos: ['NORM', 'TRNG'], def: 'NORM' },
  ]},
  { x: 650, y: 10, w: 340, h: 300, items: [
    { t: 'br', x: 20, y: 30, w: 300, text: 'ECS' },
    { t: 'rot', id: 'ecsMode', x: 110, y: 112, pos: ['A/C HI', 'A/C LOW', 'OFF', 'VENT', 'HEAT'],
      ang: [-95, -55, 0, 55, 95], def: 'OFF' },
    { t: 'dim', id: 'heatTemp', x: 265, y: 127, title: 'HEAT TEMP', lo: 'LOW', mid: 'MED', hi: 'HI', def: 5 },
    { t: 'br', x: 20, y: 192, w: 300, text: 'AIR FLOW' },
    { t: 'tg', id: 'acSel', x: 75, y: 265, title: 'A/C', pos: ['CKPT', 'ALL', 'CABIN'], side: true, def: 'ALL' },
    { t: 'tg', id: 'heatVent', x: 175, y: 265, title: 'HEAT/VENT', pos: ['CKPT', 'ALL'], def: 'ALL' },
    { t: 'tg', id: 'airSel', x: 275, y: 265, title: 'AIR SEL', pos: ['EXT AIR', 'CABIN AIR'], def: 'EXT AIR' },
  ]},
  { x: 10, y: 320, w: 320, h: 620, items: [
    { t: 'dim', id: 'instLtsCplt', x: 75, y: 112, title: 'INST LTS\nCPLT', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'rot', id: 'formLts', x: 235, y: 112, title: 'FORMATION\nLTS', pos: ['OFF', '1', '2', '3', '4', '5'],
      ang: [-120, -80, -40, 0, 40, 80], def: 'OFF' },
    { t: 'tg', id: 'cabinLts', x: 170, y: 228, title: 'CABIN LTS', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'heels', x: 265, y: 228, title: 'HEELS', pos: ['OFF', 'ARM', 'ON'], side: true, def: 'OFF' },
    { t: 'tg', id: 'stowSel', x: 55, y: 332, title: 'STOW SEL', pos: ['LDG', 'SRCH'], def: 'LDG' },
    { t: 'tg', id: 'srchLt', x: 160, y: 332, title: 'SRCH LT', pos: ['NORM', 'IR'], def: 'NORM' },
    { t: 'tg', id: 'navLts', x: 265, y: 332, title: 'NAV LTS', pos: ['NORM', 'IR'], def: 'NORM' },
    { t: 'br', x: 105, y: 388, w: 175, text: 'POSITION LTS' },
    { t: 'tg', id: 'display', x: 50, y: 445, title: 'DISPLAY', pos: ['DAY', 'NIGHT', 'NVG'], side: true, def: 'DAY' },
    { t: 'rot', id: 'posLts', x: 160, y: 450, small: true, pos: ['1', '2', '3', '4', '5'],
      ang: [-80, -40, 0, 40, 80], def: '3' },
    { t: 'tg', id: 'posMode', x: 265, y: 445, pos: ['STEADY', 'OFF', 'FLASH'], side: true, red: true, def: 'STEADY' },
    { t: 'br', x: 20, y: 518, w: 280, text: 'ANTI COLLISION LTS' },
    { t: 'tg', id: 'acolSel', x: 65, y: 572, pos: ['UPPER', 'BOTH', 'LOWER'], side: true, red: true, def: 'BOTH' },
    { t: 'tg', id: 'acolMode', x: 165, y: 572, pos: ['DIM', 'OFF', 'BRT'], side: true, red: true, def: 'OFF' },
    { t: 'tg', id: 'acolNorm', x: 265, y: 572, pos: ['NORM', 'IR'], def: 'NORM' },
  ]},
  { x: 340, y: 320, w: 310, h: 620, items: [
    { t: 'br', x: 20, y: 22, w: 270, text: 'APU' },
    { t: 'tg', id: 'apuContr', x: 60, y: 100, title: 'CONTR', pos: ['OFF', 'ON'], def: 'OFF', big: true },
    { t: 'th', id: 'apuFire', x: 200, y: 128, title: 'FIRE EXTGH' },
    { t: 'tg', id: 'gen1', x: 60, y: 248, title: 'GEN1', pos: ['OFF', 'ON'], def: 'ON' },
    { t: 'tg', id: 'gen2', x: 155, y: 248, title: 'GEN2', pos: ['OFF', 'ON'], def: 'ON' },
    { t: 'tg', id: 'apuGen', x: 250, y: 248, title: 'APU/GPU', pos: ['GPU', 'OFF', 'APU GEN'], side: true, def: 'OFF' },
    { t: 'tg', id: 'tru1', x: 60, y: 350, title: 'TRU1', pos: ['OFF', 'ON'], def: 'ON' },
    { t: 'tg', id: 'tru2', x: 155, y: 350, title: 'TRU2', pos: ['OFF', 'ON'], def: 'ON' },
    { t: 'tg', id: 'batt', x: 250, y: 350, title: 'BATT', pos: ['OFF', 'ON'], def: 'ON' },
    { t: 'pb', id: 'embRst1', x: 60, y: 448, title: 'EMB RST1' },
    { t: 'pb', id: 'embRst2', x: 155, y: 448, title: 'EMB RST2' },
    { t: 'tg', id: 'airSour', x: 250, y: 445, title: 'AIR SOUR', pos: ['ENG', 'OFF', 'APU'], side: true, red: true, def: 'ENG' },
    { t: 'guard', id: 'fireExtRes', x: 72, y: 568, title: 'FIRE EXTGH', sub: 'RESERVE', hazard: true, pos: ['OFF', 'MAIN'], def: 'OFF' },
    { t: 'rot', id: 'fireDet', x: 220, y: 572, small: true, title: 'FIRE DETECTOR',
      pos: ['OPER', 'ENG1', 'MGB', 'ENG2', 'APU'], ang: [-100, -50, 0, 50, 100], def: 'OPER' },
  ]},
  { x: 660, y: 320, w: 330, h: 620, items: [
    { t: 'br', x: 25, y: 20, w: 280, text: 'CONSOLE LTS' },
    { t: 'dim', id: 'consUpper', x: 95, y: 100, small: true, title: 'UPPER', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'dim', id: 'consLower', x: 235, y: 100, small: true, title: 'LOWER', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'br', x: 25, y: 152, w: 280, text: 'INST LTS' },
    { t: 'dim', id: 'instStby', x: 95, y: 234, small: true, title: 'STBY', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'dim', id: 'instPlt', x: 235, y: 234, small: true, title: 'PLT', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'br', x: 25, y: 288, w: 280, text: 'ENG ANTI ICE' },
    { t: 'tg', id: 'engAi1', x: 95, y: 348, title: 'NO1', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'engAi2', x: 235, y: 348, title: 'NO2', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'br', x: 25, y: 398, w: 190, text: 'WINDSHIELD ANTI ICE' },
    { t: 'tg', id: 'wsCplt', x: 65, y: 464, title: 'CPLT', pos: ['OFF', 'ON'], def: 'OFF', paddle: true },
    { t: 'tg', id: 'wsPlt', x: 170, y: 464, title: 'PLT', pos: ['OFF', 'ON'], def: 'OFF', paddle: true },
    { t: 'tg', id: 'wireCutter', x: 275, y: 464, title: 'WIRE\nCUTTER', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'emergPump', x: 65, y: 580, title: 'EMERG\nPUMP', pos: ['OFF', 'AUTO', 'ON'], side: true, red: true, def: 'AUTO', tiny: true },
    { t: 'tg', id: 'pitotHeat', x: 170, y: 580, title: 'PITOT\nHEAT', pos: ['OFF', 'AUTO', 'ON'], side: true, paddle: true, def: 'AUTO', tiny: true },
    { t: 'tg', id: 'battHeat', x: 275, y: 580, title: 'BATT\nHEAT', pos: ['OFF', 'AUTO', 'ON'], side: true, red: true, def: 'AUTO', tiny: true },
  ]},
  // ── TQS(엔진 출력 조절장치 · 그림 7) ── PCD 레버 둘(OFF · IDLE · FLY), 모터링 버튼, 엔진마다 FUEL(OPEN · CLOSE)과 T HANDLE(UNARMED · ARM).
  // PCD 는 FLY 에서 내리면 IDLE 에서 한 번 멈춘다(누름쇠 — 한 번 더 눌러야 OFF).
  { x: 290, y: 950, w: 420, h: 285, items: [
    { t: 'br', x: 20, y: 18, w: 380, text: 'TQS' },
    { t: 'pb', id: 'mtr1', x: 150, y: 58, title: 'MTRING 1' },
    { t: 'pb', id: 'mtr2', x: 270, y: 58, title: 'MTRING 2' },
    { t: 'lbl', x: 210, y: 112, text: 'OFF' }, { t: 'lbl', x: 210, y: 167, text: 'IDLE' }, { t: 'lbl', x: 210, y: 222, text: 'FLY' },
    { t: 'lv', id: 'pcd1', x: 150, y: 112, ys: [0, 55, 110], pos: ['OFF', 'IDLE', 'FLY'], def: 'FLY' , latch: true },
    { t: 'lv', id: 'pcd2', x: 270, y: 112, ys: [0, 55, 110], pos: ['OFF', 'IDLE', 'FLY'], def: 'FLY' , latch: true },
    { t: 'lbl', x: 150, y: 266, text: 'No.1 PCD', small: true }, { t: 'lbl', x: 270, y: 266, text: 'No.2 PCD', small: true },
    { t: 'tg', id: 'fuel1', x: 55, y: 108, title: 'ENG1 FUEL', pos: ['OPEN', 'CLOSE'], def: 'OPEN' },
    { t: 'tg', id: 'fuel2', x: 365, y: 108, title: 'ENG2 FUEL', pos: ['OPEN', 'CLOSE'], def: 'OPEN' },
    { t: 'tg', id: 'fire1', x: 55, y: 242, title: 'ENG1\nT HANDLE', pos: ['UNARMED', 'ARM'], red: true, tiny: true, def: 'UNARMED' },
    { t: 'tg', id: 'fire2', x: 365, y: 242, title: 'ENG2\nT HANDLE', pos: ['UNARMED', 'ARM'], red: true, tiny: true, def: 'UNARMED' },
  ]},
];

// ── 상태 ── 콘솔(UPPER · LOWER)이 여럿이어도 스위치 id 는 서로 달라 한 저장소를 함께 쓴다
const _ovhdDefs = {};
const ovhdState = {};     // id → 값
const _ovhdGuard = {};    // 덮개 열림(id → true)
const _ovhdFns = [];
const _ovhdLamps = [];    // 표시등(lamp) — 스위치가 바뀔 때마다 다시 칠한다(lit 함수)
// 손을 떼면 돌아오는 것(누름 버튼 · 스프링 스위치 · 키) — 저장하지 않는다
const _ovhdMomentary = t => t === 'pb' || t === 'mom' || t === 'key';
function _ovhdDefault(d) { return (d.t === 'pb' || d.t === 'key') ? 0 : d.t === 'th' ? 'IN' : d.def; }
function _ovhdAddPlates(plates) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(OVHD_KEY) || '{}') || {}; } catch (e) { _swallow(e); }
  plates.forEach(p => p.items.forEach(it => {
    if (it.t === 'lamp') { it._lamp = _ovhdLamps.length; _ovhdLamps.push(it); return; }
    if (!it.id) return;
    if (it.t === 'lpb') { it.pos = ['OUT', 'IN']; if (!it.def) it.def = 'OUT'; }   // 눌러 두는 버튼 — 들어가 있으면 IN
    _ovhdDefs[it.id] = it;
    ovhdState[it.id] = _ovhdDefault(it);
    const v = saved[it.id];
    if (v !== undefined && !_ovhdMomentary(it.t) &&
        (it.t === 'dim' ? (Number.isFinite(v) && v >= 0 && v <= 10)
                        : it.t === 'th' ? ['IN', 'PULLED'].includes(v) : (it.pos || []).includes(v))) ovhdState[it.id] = v;
    // 덮개 스위치가 올라간 채 저장돼 있으면 덮개는 열려 있다(닫힌 덮개는 스위치를 내려 둔다)
    if (it.t === 'guard' && ovhdState[it.id] !== it.pos[0]) _ovhdGuard[it.id] = true;
  }));
}
_ovhdAddPlates(OVHD_PLATES);
function _ovhdSave() {
  try {
    const o = {};
    Object.keys(ovhdState).forEach(k => { const d = _ovhdDefs[k]; if (!_ovhdMomentary(d.t)) o[k] = ovhdState[k]; });
    localStorage.setItem(OVHD_KEY, JSON.stringify(o));
  } catch (e) { _swallow(e); }
}
function ovhdGet(id) { return ovhdState[id]; }
function ovhdOn(fn) { if (typeof fn === 'function') _ovhdFns.push(fn); }
function ovhdSet(id, v) {
  const d = _ovhdDefs[id];
  if (!d) return;
  const prev = ovhdState[id];
  if (prev === v) return;
  ovhdState[id] = v;
  _ovhdSave();
  _ovhdPaint(id);
  _ovhdFns.forEach(fn => { try { fn(id, v, prev); } catch (e) { _swallow(e); } });
  _ovhdLampsPaint();
  try { window.dispatchEvent(new CustomEvent('ovhd', { detail: { id, value: v, prev } })); } catch (e) { _swallow(e); }
}
// 모두 처음 값으로(덮개도 닫는다) — 콘솔 이름을 주면 그 콘솔의 스위치만
function ovhdReset(key) {
  const ids = key && OVHD_CONSOLES[key]
    ? OVHD_CONSOLES[key].plates.flatMap(p => p.items.filter(it => it.id && _ovhdDefs[it.id]).map(it => it.id))
    : Object.keys(_ovhdDefs);
  ids.forEach(id => { delete _ovhdGuard[id]; const d = _ovhdDefs[id]; ovhdSet(id, _ovhdDefault(d)); _ovhdPaint(id); });
}
// 표시등 — 칸마다 lit() 이 참이면 켠다
function _ovhdLampsPaint() {
  _ovhdLamps.forEach(l => {
    const el = document.querySelector(`[data-lamp="${l._lamp}"]`);
    if (!el) return;
    let on = false;
    try { on = typeof l.lit === 'function' ? !!l.lit() : false; } catch (e) { _swallow(e); }
    el.classList.toggle('on', on);
  });
}

// ── 그리기 ──
const _esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _nl = s => _esc(s).replace(/\n/g, '<br>');
function _ovhdItemHtml(it) {
  const at = `left:${it.x}px;top:${it.y}px`;
  const title = it.title ? `<div class="ov-title">${_nl(it.title)}${it.sub ? `<div class="ov-sub">${_esc(it.sub)}</div>` : ''}</div>` : '';
  switch (it.t) {
    case 'br':
      return `<div class="ov-br" style="left:${it.x}px;top:${it.y}px;width:${it.w}px"><span>${_esc(it.text)}</span></div>`;
    case 'lbl':
      return `<div class="ov-lbl${it.small ? ' sm' : ''}" style="${at}">${_esc(it.text)}</div>`;
    case 'tg': case 'mom': {
      const n = it.pos.length;
      const top = it.topLbl !== undefined ? it.topLbl : it.pos[0];
      const cls = ['ov-tg', it.red ? 'red' : '', it.big ? 'big' : '', it.paddle ? 'paddle' : '', it.tiny ? 'tiny' : ''].join(' ');
      return `<div class="${cls}" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-pl top">${_esc(top)}</div>` +
        `<div class="ov-bez"><div class="ov-lever"></div></div>` +
        (n === 3 && it.side ? `<div class="ov-pl side">${_esc(it.pos[1])}</div>` : '') +
        `<div class="ov-pl bot">${_esc(it.pos[n - 1])}</div>${_ovhdZones(it)}</div>`;
    }
    case 'guard': {
      return `<div class="ov-guard${it.hazard ? ' hazard' : ''}" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-gbody"><div class="ov-pl top">${_esc(it.pos[0])}</div>` +
        `<div class="ov-bez"><div class="ov-lever"></div></div><div class="ov-pl bot">${_esc(it.pos[1])}</div>${_ovhdZones(it)}` +
        `<div class="ov-cover" data-ov-cover="${it.id}">${it.num ? `<b>${_esc(it.num)}</b>` : ''}</div></div></div>`;
    }
    case 'rot': case 'dim': {
      const lbls = it.t === 'rot'
        ? it.pos.map((p, i) => _ovhdRotLbl(p, it.ang[i], it.small ? 44 : 58, p)).join('')
        : [[it.lo, DIM.from, 0], [it.mid, 0, (DIM.steps - 1) / 2], [it.hi, DIM.to, DIM.steps - 1]].filter(a => a[0])
            .map(a => _ovhdRotLbl(a[0], a[1], it.small ? 38 : 50, a[2])).join('');
      return `<div class="ov-rot${it.small ? ' sm' : ''}${it.t === 'dim' ? ' dim' : ''}" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-knob"><div class="ov-ptr"></div></div>${lbls}</div>`;
    }
    case 'lv': {                                       // 미끄럼 레버(TQS PCD) — 위치마다 터치 칸
      const h = it.ys[it.ys.length - 1];
      return `<div class="ov-lv" data-ov="${it.id}" style="${at}">` +
        `<div class="ov-slot" style="height:${h + 30}px"></div><div class="ov-lvh"><i></i></div>` +
        it.ys.map((y, i) => `<div class="ov-hit" data-hz="p${i}" style="left:-34px;top:${y - 27}px;width:68px;height:54px"></div>`).join('') +
        `</div>`;
    }
    case 'lpb': case 'key': {                          // 눌러 두는 사각 버튼(글씨가 켜진다) · 누르는 동안만 들어가는 키
      const w = it.w || 52, h = it.h || 34;
      return `<div class="ov-${it.t}" data-ov="${it.id}" style="${at}">${title ? title.replace('class="ov-title"', `class="ov-title" style="bottom:${h / 2 + 4}px"`) : ''}` +
        `<div class="ov-sq" style="left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px">${_nl(it.legend || it.label || '')}</div>` +
        `<div class="ov-hit" style="left:${-w / 2 - 4}px;top:${-h / 2 - 4}px;width:${w + 8}px;height:${h + 8}px"></div></div>`;
    }
    case 'lamp': {                                     // 표시등(누르지 않는다)
      const w = it.w || 26, h = it.h || 20;
      return `<div class="ov-lamp" data-lamp="${it._lamp}" style="${at}"><div class="ov-sq" style="left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px">${_nl(it.label || '')}</div></div>`;
    }
    case 'html':                                       // 맞춤 장치 자리 — 다른 파일이 그 안을 꾸민다(예: 21-c5000.js 무전기 제어기)
      return `<div class="ov-html" id="${it.hid}" style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px"></div>`;
    case 'disp':                                       // 표시창(글자만)
      return `<div class="ov-disp" style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px">${_nl(it.text || '')}</div>`;
    case 'pb':
      return `<div class="ov-pb" data-ov="${it.id}" style="${at}">${title}<div class="ov-btn"></div>` +
        `<div class="ov-hit" style="left:-36px;top:-40px;width:72px;height:62px"></div></div>`;
    case 'th':
      return `<div class="ov-th" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-thbar"><i></i><span>APU</span><i></i></div></div>`;
  }
  return '';
}
// 노브의 위치 글자 — 누르면 그 위치로 바로 돈다(data-ov-pos)
function _ovhdRotLbl(txt, ang, r, val) {
  const a = ang * Math.PI / 180;
  return `<div class="ov-rl" data-ov-pos="${_esc(val)}" style="left:${(Math.sin(a) * r).toFixed(1)}px;top:${(-Math.cos(a) * r).toFixed(1)}px">${_esc(txt)}</div>`;
}
// ── 터치 영역 ── 토글은 글자 쪽을 누르면 그 위치로 간다:
//   위 칸(윗글자 + 레버 위쪽) → 맨 위 위치 · 아래 칸(레버 아래쪽 + 아랫글자) → 맨 아래 위치
//   가운데 띠(3단은 옆 글자까지) → 가운데 위치 — 2단에서는 누를 때마다 바꾼다
function _ovhdZones(it) {
  const mid3 = it.pos.length === 3;
  const side = mid3 && it.side;
  return `<div class="ov-hit" data-hz="top" style="left:-30px;top:-50px;width:60px;height:43px"></div>` +
         `<div class="ov-hit" data-hz="mid" style="left:${side ? -64 : -30}px;top:-7px;width:${side ? 94 : 60}px;height:14px"></div>` +
         `<div class="ov-hit" data-hz="bot" style="left:-30px;top:7px;width:60px;height:36px"></div>`;
}
// ── 콘솔 창 ── 같은 엔진으로 여러 창(UPPER · LOWER)을 그린다. 설계 크기를 창에 맞춰 통째로 줄이고 키운다.
const OVHD_CONSOLES = { ovhd: { wrap: 'ovhd-wrap', plates: OVHD_PLATES, W: OVHD_W, H: OVHD_H } };
function consoleRegister(key, cfg) { OVHD_CONSOLES[key] = cfg; _ovhdAddPlates(cfg.plates); }
function consoleBuild(key) {
  const C = OVHD_CONSOLES[key];
  const wrap = C && document.getElementById(C.wrap);
  if (!wrap || wrap.dataset.built) return;
  wrap.dataset.built = '1';
  wrap.innerHTML = `<div id="${key}-stage" class="ov-stage" style="width:${C.W}px;height:${C.H}px">` +
    C.plates.map(p => `<div class="ov-plate" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">` +
      '<i class="ov-screw a"></i><i class="ov-screw b"></i><i class="ov-screw c"></i><i class="ov-screw d"></i>' +
      p.items.map(_ovhdItemHtml).join('') + '</div>').join('') +
    `</div><button id="${key}-reset" class="ov-reset-btn" type="button" title="이 콘솔의 스위치를 처음 위치로">RESET</button>` +
    `<button id="${key}-zones" class="ov-zones-btn" type="button" title="터치 영역을 테두리로 보이기/감추기">ZONES</button>`;
  C.plates.forEach(p => p.items.forEach(it => { if (it.id) _ovhdPaint(it.id); }));
  _ovhdLampsPaint();
  wrap.addEventListener('pointerdown', _ovhdDown);
  wrap.addEventListener('pointerup', _ovhdUp);
  wrap.addEventListener('pointercancel', _ovhdUp);
  wrap.addEventListener('pointerleave', _ovhdUp);
  wrap.addEventListener('wheel', _ovhdWheel, { passive: false });
  wrap.querySelector('.ov-reset-btn').addEventListener('click', () => ovhdReset(key));
  wrap.querySelector('.ov-zones-btn').addEventListener('click', () => {
    const on = wrap.classList.toggle('ov-zones');
    wrap.querySelector('.ov-zones-btn').classList.toggle('on', on);
  });
  const fit = () => consoleFit(key);
  try { new ResizeObserver(fit).observe(wrap); } catch (e) { window.addEventListener('resize', fit); }
  fit();
}
function consoleFit(key) {
  const C = OVHD_CONSOLES[key];
  const wrap = C && document.getElementById(C.wrap), st = document.getElementById(`${key}-stage`);
  if (!wrap || !st) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!(W > 0 && H > 0)) return;
  const k = Math.min(W / C.W, H / C.H);
  st.style.transform = `translate(${((W - C.W * k) / 2).toFixed(1)}px, ${((H - C.H * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
}
function ovhdBuild() { consoleBuild('ovhd'); }
function ovhdFit() { consoleFit('ovhd'); }
function _ovhdEl(id) { return document.querySelector(`.ov-stage [data-ov="${id}"]`); }
function _ovhdPaint(id) {
  const el = _ovhdEl(id), d = _ovhdDefs[id];
  if (!el || !d) return;
  const v = ovhdState[id];
  if (d.t === 'tg' || d.t === 'mom' || d.t === 'guard') {
    const n = d.pos.length, i = d.pos.indexOf(v);
    el.dataset.p = n === 2 ? (i === 0 ? 'up' : 'dn') : (i === 0 ? 'up' : i === 1 ? 'mid' : 'dn');
    if (d.t === 'guard') el.classList.toggle('open', !!_ovhdGuard[id]);
  } else if (d.t === 'rot') {
    el.querySelector('.ov-knob').style.transform = `rotate(${d.ang[Math.max(0, d.pos.indexOf(v))]}deg)`;
  } else if (d.t === 'dim') {
    el.querySelector('.ov-knob').style.transform = `rotate(${DIM.from + (DIM.to - DIM.from) * v / (DIM.steps - 1)}deg)`;
  } else if (d.t === 'lv') {
    el.querySelector('.ov-lvh').style.top = `${d.ys[Math.max(0, d.pos.indexOf(v))] - 18}px`;
    el.dataset.p = v;
  } else if (d.t === 'lpb') {
    el.classList.toggle('in', v === 'IN');
  } else if (d.t === 'pb' || d.t === 'key') {
    el.classList.toggle('pressed', !!v);
  } else if (d.t === 'th') {
    el.classList.toggle('pulled', v === 'PULLED');
  }
}

// ── 조작 ──
let _ovhdMom = null;      // 누르고 있는 스프링 스위치·누름 버튼
function _ovhdDown(e) {
  const cover = e.target.closest('[data-ov-cover]');
  if (cover) {                                        // 덮개 — 열고 닫는다(닫으면 스위치를 제자리로 밀어 넣는다)
    const id = cover.dataset.ovCover;
    _ovhdGuard[id] = !_ovhdGuard[id];
    if (!_ovhdGuard[id]) ovhdSet(id, _ovhdDefs[id].pos[0]);
    _ovhdPaint(id);
    e.preventDefault(); return;
  }
  const el = e.target.closest('[data-ov]');
  if (!el) return;
  const id = el.dataset.ov, d = _ovhdDefs[id];
  if (!d) return;
  e.preventDefault();
  const v = ovhdState[id];
  if (d.t === 'tg' || d.t === 'mom' || d.t === 'guard') {
    if (d.t === 'guard' && !_ovhdGuard[id]) return;   // 덮개가 닫혀 있으면 스위치에 손이 닿지 않는다
    const n = d.pos.length, i = d.pos.indexOf(v);
    const hz = e.target.dataset && e.target.dataset.hz;
    let j;
    if (hz === 'top') j = 0;                            // 윗글자 쪽 → 맨 위 위치
    else if (hz === 'bot') j = n - 1;                   // 아랫글자 쪽 → 맨 아래 위치
    else if (hz === 'mid') j = n === 3 ? 1 : (i === 0 ? 1 : 0);   // 가운데(옆 글자) → 가운데 · 2단은 바꾼다
    else {                                              // 레버 그 자체 — 누른 쪽으로 한 칸
      const bez = el.querySelector('.ov-bez').getBoundingClientRect();
      const up = e.clientY < bez.top + bez.height / 2;
      j = Math.max(0, Math.min(n - 1, i + (up ? -1 : 1)));
    }
    if (d.t === 'mom' && j === 0) return;               // 스프링 스위치는 아래(TEST)로만 누른다
    ovhdSet(id, d.pos[j]);
    if (d.t === 'mom') _ovhdMom = id;
  } else if (d.t === 'lv') {
    const m = /^p(\d)$/.exec((e.target.dataset && e.target.dataset.hz) || '');
    if (!m) return;
    let j = Number(m[1]);
    const i = d.pos.indexOf(v);
    if (d.latch && i === d.pos.length - 1 && j === 0) j = 1;   // 누름쇠(PCD) — FLY 에서 한 번에 OFF 로 가지 않고 IDLE 에서 멈춘다
    ovhdSet(id, d.pos[j]);
  } else if ((d.t === 'rot' || d.t === 'dim') && e.target.closest('[data-ov-pos]')) {
    const pv = e.target.closest('[data-ov-pos]').dataset.ovPos;   // 위치 글자를 누르면 그 위치로 바로
    ovhdSet(id, d.t === 'dim' ? Number(pv) : pv);
  } else if (d.t === 'rot' || d.t === 'dim') {
    const kb = el.querySelector('.ov-knob').getBoundingClientRect();
    _ovhdTurn(id, e.clientX < kb.left + kb.width / 2 ? -1 : 1);
  } else if (d.t === 'lpb') {
    ovhdSet(id, v === 'IN' ? 'OUT' : 'IN');
  } else if (d.t === 'pb' || d.t === 'key') {
    ovhdSet(id, 1); _ovhdMom = id;
  } else if (d.t === 'th') {
    ovhdSet(id, v === 'PULLED' ? 'IN' : 'PULLED');
  }
}
function _ovhdUp() {
  if (!_ovhdMom) return;
  const id = _ovhdMom, d = _ovhdDefs[id];
  _ovhdMom = null;
  ovhdSet(id, (d.t === 'pb' || d.t === 'key') ? 0 : d.def);   // 손을 떼면 스프링으로 돌아온다
}
function _ovhdTurn(id, dir) {
  const d = _ovhdDefs[id], v = ovhdState[id];
  if (d.t === 'dim') ovhdSet(id, Math.max(0, Math.min(DIM.steps - 1, v + dir)));
  else {
    const i = d.pos.indexOf(v);
    ovhdSet(id, d.pos[Math.max(0, Math.min(d.pos.length - 1, i + dir))]);
  }
}
function _ovhdWheel(e) {
  const el = e.target.closest('.ov-rot');
  if (!el) return;
  e.preventDefault();
  _ovhdTurn(el.dataset.ov, e.deltaY > 0 ? -1 : 1);
}

// 창이 처음 보일 때 만든다(applyPanels 가 부른다)
function ovhdShow() { ovhdBuild(); ovhdFit(); }
// 저장된 배치로 이미 떠 있으면(이 파일이 applyPanels 보다 늦게 읽힌다) 곧바로 만든다
try {
  const w = document.getElementById('ovhd-wrap');
  if (w && !w.classList.contains('page-hidden')) ovhdShow();
} catch (e) { _swallow(e); }

// ── 시뮬레이터 연동 ──
// TRAINING NO1/NO2 ENG TRNG → SIM 의 OEI 훈련
// TQS PCD · 연료차단 · 화재소화 레버 → 엔진마다의 상태(14-simmode.js simEngApply)
const OVHD_ENG_IDS = ['trng1', 'trng2', 'pcd1', 'pcd2', 'fuel1', 'fuel2', 'fire1', 'fire2'];
ovhdOn(id => {
  if (OVHD_ENG_IDS.includes(id) && typeof simEngApply === 'function') simEngApply();
});
try { if (typeof simEngApply === 'function') simEngApply(true); } catch (e) { _swallow(e); }   // 저장된 위치대로 처음 상태
