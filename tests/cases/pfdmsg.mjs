// PFD 메시지 시현창 — HSI 오른쪽 위 바람 정보 아래. 콘솔 스위치 · 엔진 NgR 을 따라 켜진다(03-pfd.js pfdMsgs).
export const name = 'PFD 메시지';

export async function run(page, t) {
  const r = await page.evaluate(() => {
    const shot = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (tx, ...a) { seen.push([String(tx), String(this.fillStyle)]); return orig.call(this, tx, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen;
    };
    const has = (s, txt) => s.find(x => x[0] === txt);
    const o = {};
    localStorage.removeItem('ovhdState'); ovhdReset();
    // 엔진이 힘차게 돌아 NgR 이 87.5 % 위 — 기본 스위치(PITOT AUTO · 브레이크 RELEASE · A/I OFF · FLOATS OFF)
    const keep = engParams;
    const fake = (n1, n2) => () => { const P = keep(); return { ...P, e1: { ...P.e1, ng: n1 }, e2: { ...P.e2, ng: n2 } }; };
    window.engParams = fake(95, 95);
    ovhdSet('noseLock', 'UNLOCK');
    o.none = pfdMsgs().length;
    ovhdSet('pitotHeat', 'OFF'); ovhdSet('parkBrake', 'SET'); ovhdSet('engAi1', 'ON'); ovhdSet('noseLock', 'LOCK'); ovhdSet('fltArmSw', 'ARMED');
    const s = shot();
    o.pitot = has(s, 'PITOT OFF'); o.park = has(s, 'PARKING BRAKE SET'); o.ai1 = has(s, '1 ENG A/I ON'); o.ai2 = has(s, '2 ENG A/I ON');
    o.nlg = has(s, 'NLG LOCK'); o.flt = has(s, 'EMER FLOATS ARMED');
    // 파킹 브레이크는 자세계 상자로는 띄우지 않는다(메시지 시현창에만)
    o.parkOnce = s.filter(x => /PARKING BRAKE/.test(x[0])).length;
    ovhdSet('pitotHeat', 'ON'); o.pitotOn = !!has(shot(), 'PITOT OFF');
    // GEN 스위치 OFF — 그 번호의 GEN OFF 황색
    ovhdSet('gen1', 'OFF'); const g = shot(); o.gen1 = has(g, '1 GEN OFF'); o.gen2a = !!has(g, '2 GEN OFF');
    ovhdSet('gen2', 'OFF'); o.gen2 = has(shot(), '2 GEN OFF');
    ovhdSet('gen1', 'ON'); ovhdSet('gen2', 'ON'); o.genBack = pfdMsgs().some(m => /GEN OFF/.test(m.t));
    // NgR 87.5 % 이하 — 스위치가 OFF 여도 A/I ON
    ovhdSet('engAi1', 'OFF');
    window.engParams = fake(87.5, 80);
    o.lowNg = pfdMsgs().filter(m => /ENG A\/I ON/.test(m.t)).map(m => m.t).join(',');
    window.engParams = keep;
    ovhdReset(); localStorage.removeItem('ovhdState');
    return o;
  });
  const AMB = '#ffb000', GRN = '#22e022';
  t.eq(r.none, 0, '스위치가 모두 평소 자리이고 NgR 이 높으면 메시지가 없다');
  t.ok(r.pitot && r.pitot[1] === AMB, `PITOT HEAT OFF — PITOT OFF 황색 (${r.pitot && r.pitot[1]})`);
  t.ok(!r.pitotOn, 'PITOT HEAT ON 이면 PITOT OFF 가 사라진다');
  t.ok(r.gen1 && r.gen1[1] === AMB && !r.gen2a && r.gen2 && r.gen2[1] === AMB && !r.genBack,
    `GEN1 · GEN2 스위치 OFF — 1 GEN OFF · 2 GEN OFF 황색, ON 이면 사라진다`);
  t.ok(r.park && r.park[1] === GRN, 'PARKING BRAKE SET — 녹색');
  t.eq(r.parkOnce, 1, '파킹 브레이크는 메시지 시현창에만 — 자세계에는 따로 띄우지 않는다');
  t.ok(r.ai1 && r.ai1[1] === GRN && !r.ai2, '1번 ANTI ICE 스위치 ON — 1 ENG A/I ON 녹색(2번은 없음)');
  t.ok(r.nlg && r.nlg[1] === GRN, 'NOSE WHEEL LOCK — NLG LOCK 녹색');
  t.ok(r.flt && r.flt[1] === GRN, 'EMER FLOATS ARMED — 녹색');
  t.eq(r.lowNg, '1 ENG A/I ON,2 ENG A/I ON', 'NgR 87.5 % 이하면 스위치가 OFF 여도 ENG A/I ON 이 늘 보인다');

  // ── 스톱워치 — HSI 오른쪽 아래(메시지 시현창 · HOCAS 아래, HOCAS 와 같은 폭). FCP 의 STOP WATCH 는 없앴다 ──
  const sw = await page.evaluate(() => {
    const o = { fcpGone: !document.getElementById('sw-display') };
    const shot = () => { const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (tx, ...a) { seen.push(String(tx)); return orig.call(this, tx, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; } return seen; };
    hocasOn = true; swSetMode('clock'); const s0 = shot();
    o.clock = s0.includes('TIME') && s0.some(x => /^\d\d:\d\d:\d\d$/.test(x)) && s0.includes('STOP WATCH');
    // HOCAS 창 아래 · 같은 폭 — HOCAS 바탕과 왼쪽 끝이 같고 스톱워치가 그 아래
    const W = cvs.width, H = cvs.height, ctrl = document.querySelector('.ctrl-bar');
    const L = pfdLayout(W, H, ctrl ? ctrl.offsetHeight : 80), RC = hsiRightCol(L.hsi.x, L.hsi.y, L.hsi.w, L.hsi.h, W / 2);
    const hit = _swHit[0];
    o.align = Math.abs(hit.x - (RC.left + 4)) < 1 && hit.y > RC.swY && hit.y + hit.h <= L.hsi.y + L.hsi.h;
    // STOP WATCH 칸을 누르면(PFD 를 누른 자리) 스톱워치 — GO · RST · TIME
    swHitTest(hit.x + 2, hit.y + 2); const s1 = shot();
    o.sw = _swMode === 'sw' && ['GO', 'RST', 'TIME'].every(x => s1.includes(x)) && s1.includes('00:00.0');
    const go = _swHit.find(h => h.act === 'swToggle'); swHitTest(go.x + 2, go.y + 2); o.run = SW.running && shot().includes('STP');
    swHitTest(go.x + 2, go.y + 2); const rst = _swHit.find(h => h.act === 'swReset'); SW.accMs = 5000; swHitTest(rst.x + 2, rst.y + 2); o.rst = SW.accMs === 0 && !SW.running;
    const tm = _swHit.find(h => h.act === 'swSetMode:clock'); swHitTest(tm.x + 2, tm.y + 2); o.back = _swMode === 'clock';
    hocasOn = false;
    return o;
  });
  t.ok(sw.fcpGone, 'FCP 의 STOP WATCH 는 없앴다');
  t.ok(sw.clock, 'PFD 에 현재 시각(TIME)과 STOP WATCH 칸');
  t.ok(sw.align, 'HOCAS 창 아래 · 같은 왼쪽 끝(같은 폭)');
  t.ok(sw.sw && sw.run && sw.rst && sw.back, 'STOP WATCH → GO/STP · RST · TIME 이 PFD 를 눌러 동작한다');
}
