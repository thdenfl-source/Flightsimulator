// ─────────────────────────────────────────────────────────────
// 13-joyhid.js — 조종 장치 직접 열기(WebHID)
//
// 브라우저가 장치를 '게임패드' 로 보여 주지 않는 경우가 있다. 특히 맥에서
// 흔한데(장치는 붙어 있으나 navigator.getGamepads() 가 빈 손), 그러면
// Gamepad API 만으로는 손을 쓸 수 없다. WebHID 로 장치를 직접 열면 원시
// 리포트를 그대로 받을 수 있다 — 사용자가 한 번 골라 주면 그 뒤로는
// 권한이 남아 다음에 자동으로 다시 열린다.
//
// 받은 바이트를 사람이 손으로 해석하지는 않는다. WebHID 가 리포트 서술자를
// 풀어 준 것(collections[].inputReports[].items)을 그대로 따라가며 비트를
// 잘라 낸다. 그래서 기종별 하드코딩이 없다.
//
// 잘라 낸 값은 Gamepad API 와 같은 모양(buttons/axes)으로 만들어 12-joystick.js
// 에 넘긴다. 그래서 배정·햇 풀이·진단이 모두 그대로 쓰인다.
// ─────────────────────────────────────────────────────────────

const HID_PAD_INDEX = 100;        // 게임패드 번호와 겹치지 않게
const HID_PAGE_BUTTON = 0x09, HID_PAGE_DESKTOP = 0x01;
const HID_USAGE_HAT = 0x39;
// 축으로 쓰는 Generic Desktop 사용처: X Y Z Rx Ry Rz Slider Dial Wheel
const HID_AXIS_USAGES = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38];

let hidDev = null;                // 열려 있는 HIDDevice
let hidName = '';
let _hidBtn = [];                 // 버튼 눌림(0/1)
let _hidAx = [];                  // 축 값(-1…1 · 햇은 게임패드 관례값)
let _hidSeen = false;             // 리포트를 한 번이라도 받았는가

// 12-joystick.js 가 패드처럼 집어 가는 모양
function joyHidPad() {
  if (!hidDev || !_hidSeen) return null;
  return {
    index: HID_PAD_INDEX,
    id: hidName + ' (HID)',
    mapping: 'hid',
    buttons: _hidBtn.map(v => ({ pressed: v > 0.5, value: v })),
    axes: _hidAx.slice(),
  };
}

// ── 비트 잘라 내기 ──
// HID 리포트는 바이트 경계를 지키지 않는다(버튼 1비트씩 등). 리틀엔디언으로
// 필요한 비트만 모은다.
function hidBits(view, bitOff, bits) {
  let v = 0;
  for (let i = 0; i < bits; i++) {
    const b = bitOff + i;
    const byte = view.getUint8(b >> 3);
    v |= ((byte >> (b & 7)) & 1) << i;
  }
  return v;
}
function hidSigned(v, bits) {
  const half = 1 << (bits - 1);
  return (bits < 32 && v >= half) ? v - (1 << bits) : v;
}

// 리포트 하나를 풀어 { btn:{index:0|1}, ax:{index:값} } 로 돌려준다.
// items 는 WebHID 가 준 그대로다.
function hidParseReport(items, view) {
  const out = { btn: {}, ax: {} };
  let bit = 0;
  (items || []).forEach(it => {
    const size = it.reportSize || 0, count = it.reportCount || 0;
    const total = size * count;
    if (it.isConstant) { bit += total; return; }     // 자리 채우기(패딩)
    const lmin = (it.logicalMinimum != null) ? it.logicalMinimum : 0;
    const lmax = (it.logicalMaximum != null) ? it.logicalMaximum : 1;
    for (let j = 0; j < count; j++) {
      const off = bit + j * size;
      const usage = _hidUsage(it, j);
      const page = usage >>> 16, u = usage & 0xffff;
      let raw = hidBits(view, off, size);
      if (lmin < 0) raw = hidSigned(raw, size);
      if (page === HID_PAGE_BUTTON) {
        out.btn[u - 1] = raw ? 1 : 0;                // 버튼 사용처는 1부터
      } else if (page === HID_PAGE_DESKTOP && u === HID_USAGE_HAT) {
        // 햇 — 범위를 벗어난 값이 '가운데'다. 게임패드 관례에 맞춰
        // 가운데는 1 밖(3.2857), 방향은 -1…1 의 8등분으로 실어 보낸다.
        const i = raw - lmin;
        out.ax[_hidAxisSlot(usage)] = (i < 0 || i > 7 || raw < lmin || raw > lmax)
          ? 3.2857142857142856 : (i / 3.5 - 1);
      } else if (page === HID_PAGE_DESKTOP && HID_AXIS_USAGES.indexOf(u) >= 0) {
        const span = (lmax - lmin) || 1;
        out.ax[_hidAxisSlot(usage)] = ((raw - lmin) / span) * 2 - 1;
      }
    }
    bit += total;
  });
  return out;
}
function _hidUsage(it, j) {
  const us = it.usages;
  if (us && us.length) return us[Math.min(j, us.length - 1)];
  if (it.usageMinimum != null) return it.usageMinimum + j;
  return 0;
}
// 사용처마다 고정된 축 번호를 준다 — 리포트가 바뀌어도 배정이 흔들리지 않게
const _hidSlots = [];
function _hidAxisSlot(usage) {
  let i = _hidSlots.indexOf(usage);
  if (i < 0) { _hidSlots.push(usage); i = _hidSlots.length - 1; }
  return i;
}

function _hidItemsFor(dev, reportId) {
  const items = [];
  (dev.collections || []).forEach(c => {
    (c.inputReports || []).forEach(r => {
      if ((r.reportId || 0) === (reportId || 0)) items.push.apply(items, r.items || []);
    });
  });
  return items;
}

function _hidOnReport(e) {
  try {
    const items = _hidItemsFor(hidDev, e.reportId);
    if (!items.length) return;
    const r = hidParseReport(items, e.data);
    Object.keys(r.btn).forEach(i => { _hidBtn[i] = r.btn[i]; });
    Object.keys(r.ax).forEach(i => { _hidAx[i] = r.ax[i]; });
    for (let i = 0; i < _hidBtn.length; i++) if (_hidBtn[i] == null) _hidBtn[i] = 0;
    for (let i = 0; i < _hidAx.length; i++) if (!Number.isFinite(_hidAx[i])) _hidAx[i] = 0;
    _hidSeen = true;
  } catch (err) { _swallow(err); }
}

function joyHidSupported() { return !!(navigator.hid && navigator.hid.requestDevice); }

async function _hidUse(dev) {
  if (!dev) return false;
  try {
    if (!dev.opened) await dev.open();
    hidDev = dev;
    hidName = dev.productName || 'HID 장치';
    _hidBtn = []; _hidAx = []; _hidSeen = false;
    dev.addEventListener('inputreport', _hidOnReport);
    try { joyStart(); } catch (e) { _swallow(e); }
    return true;
  } catch (err) { _swallow(err); return false; }
}

// 사용자가 누르는 버튼 — 브라우저의 장치 선택 창을 띄운다(사용자 동작 필요)
async function joyHidConnect() {
  if (!joyHidSupported()) return false;
  try {
    const list = await navigator.hid.requestDevice({ filters: [] });
    return await _hidUse(list && list[0]);
  } catch (err) { _swallow(err); return false; }
}
function joyHidDisconnect() {
  try { if (hidDev) { hidDev.removeEventListener('inputreport', _hidOnReport); hidDev.close(); } }
  catch (e) { _swallow(e); }
  hidDev = null; hidName = ''; _hidBtn = []; _hidAx = []; _hidSeen = false;
}
function joyHidStatus() {
  return { supported: joyHidSupported(), name: hidName,
           open: !!hidDev, data: _hidSeen };
}

// 한 번 허락한 장치는 권한이 남는다 — 다음에 열 때 조용히 다시 잇는다
(function hidAutoReopen() {
  if (!navigator.hid || !navigator.hid.getDevices) return;
  navigator.hid.getDevices().then(ds => {
    if (!hidDev && ds && ds.length) _hidUse(ds[0]);
  }).catch(e => _swallow(e));
  navigator.hid.addEventListener('disconnect', e => {
    if (hidDev && e.device === hidDev) joyHidDisconnect();
  });
})();
