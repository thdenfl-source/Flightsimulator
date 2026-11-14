'use strict';
// ══════════════════════════════════════════════════════
// 타이머 하나로(스케줄러) — 앱 곳곳의 setInterval(60개 가까이)을 한 박자(50ms)로 모아 돌린다.
//   · 200ms 이상 주기만 모은다(더 빠른 것은 화면 그리기라 그대로 둔다).
//   · 다음 차례는 '앞 차례 + 주기'로 잡아 밀리지 않는다(박자 탓에 늦어도 50ms 안).
//   · 한 작업이 예외를 내도 다른 작업은 돈다 — 예외는 진단 기록(_swallow)에 남는다.
//   · 창이 숨겨지면(다른 탭) 1초 이상 주기 작업은 쉰다 — 비행 계산(짧은 주기)은 그대로.
//   · clearInterval 은 그대로 쓴다(번호가 겹치지 않게 큰 수부터 매긴다).
// 이 파일은 <head> 맨 앞쪽(00-params.js 뒤)에 읽혀 다른 파일보다 먼저 setInterval 을 갈아 끼운다.
// schedStats() — 돌고 있는 작업 수 · 작업마다 부른 횟수 · 걸린 시간(진단 기록 화면)
// ══════════════════════════════════════════════════════
const SCHED_TICK = 50, SCHED_MIN = 200, SCHED_IDLE_MS = 1000;
const _sched = { tasks: new Map(), id: 9e8, timer: null, nativeSet: window.setInterval.bind(window), nativeClear: window.clearInterval.bind(window), runs: 0 };
function _schedName(fn) { return (fn && fn.name) || (String(fn).slice(0, 40).replace(/\s+/g, ' ')); }
function _schedTick() {
  const now = performance.now(), hidden = typeof document !== 'undefined' && document.hidden;
  _sched.runs++;
  for (const [id, t] of _sched.tasks) {
    if (now < t.next) continue;
    t.next += t.ms;
    if (t.next < now) t.next = now + t.ms;                 // 오래 멈췄으면(창 숨김 · 디버거) 따라잡지 않고 다시 잡는다
    if (hidden && t.ms >= SCHED_IDLE_MS) continue;
    const t0 = performance.now();
    try { t.fn.apply(window, t.args); }
    catch (e) { t.err++; try { if (typeof _swallow === 'function') _swallow(e); } catch (_) { /* 무시 */ } setTimeout(() => { throw e; }, 0); }   // 다른 작업은 계속 돌고, 예외는 그대로 드러낸다
    t.n++; t.cost += performance.now() - t0;
  }
  if (!_sched.tasks.size && _sched.timer != null) { _sched.nativeClear(_sched.timer); _sched.timer = null; }
}
window.setInterval = function (fn, ms, ...args) {
  ms = Number(ms) || 0;
  if (typeof fn !== 'function' || ms < SCHED_MIN) return _sched.nativeSet(fn, ms, ...args);
  const id = ++_sched.id;
  _sched.tasks.set(id, { fn, ms, args, next: performance.now() + ms, n: 0, cost: 0, err: 0, name: _schedName(fn) });
  if (_sched.timer == null) _sched.timer = _sched.nativeSet(_schedTick, SCHED_TICK);
  return id;
};
window.clearInterval = function (id) {
  if (_sched.tasks.delete(id)) return;
  _sched.nativeClear(id);
};
function schedStats() {
  return { tasks: _sched.tasks.size, ticks: _sched.runs,
    list: [..._sched.tasks.values()].map(t => ({ name: t.name, ms: t.ms, n: t.n, avgMs: t.n ? +(t.cost / t.n).toFixed(2) : 0, err: t.err })) };
}
