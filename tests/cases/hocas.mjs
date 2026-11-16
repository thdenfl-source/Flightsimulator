// HOCAS — CDU 의 Aircraft Systems → HOCAS 칸(켜기 · CTR · DEFAULT). 켜면 SYSTEM 창에 HOCAS 화면(Cyclic Stick Position · 페달 · 컬렉티브 · Co-Pilot/Pilot 표)이 뜬다.
// SYSTEM 창 FULL/HALF(CDU 푸터) · HALF 에서 HOCAS 옆 TCAS · CDU 아래 노브 셋(가운데 = 왼쪽 ⇄ 오른쪽 고르기)
import { SIM_SETUP_SRC } from './simmode.mjs';
export const name = 'HOCAS';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    // FCP 의 HOVER 칸(HOVER PAGE · HOVER POS)은 PFD 소프트키로 옮겨 없앴다
    const o = { hoverGone: !document.querySelector('.hover-group') && !document.getElementById('hover-btn') };
    const shot = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (tx, ...a) { seen.push([String(tx), String(this.fillStyle)]); return orig.call(this, tx, ...a); };
      try { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; sysDrawTo(cv); } finally { proto.fillText = orig; }
      return seen;
    };
    o.fcpBtn = !!document.getElementById('hocas-btn') || !!document.getElementById('hocas-ctr-btn');
    localStorage.removeItem('sysLayout'); sysLayout = 'FULL'; sysPageSet('asys_fuel');
    o.off = shot().some(x => x[0] === 'HOCAS');
    // CDU — Aircraft Systems → HOCAS 칸
    selectPanel('mid', 'cdu', true); CDU_ACT.switchMode('ACSYS'); CDU_ACT.acSysOpen('asys_hocas');
    const btn = act => document.querySelector('#mainContentArea [data-act="' + act + '"]');
    o.cduBtns = ['hocasCenter', 'hocasDefault'].every(a => !!btn(a)) && !btn('toggleHocas') && !/SYSTEM 표시/.test(document.getElementById('mainContentArea').textContent);
    o.opened = sysPage === 'asys_hocas';   // HOCAS 칸을 열면 SYSTEM 창에 HOCAS
    sysPageSet('asys_fuel'); toggleHocas(); o.on = hocasOn && sysPage === 'asys_hocas'; o.cls = true;
    _ax(0, 0); _ax(1, 0); _ax(2, 0); joyPoll(2000);
    const c = shot(); o.title = c.some(x => x[0] === 'HOCAS');
    o.cyc0 = c.find(x => x[0].startsWith('CYC')); o.ped0 = c.find(x => x[0].startsWith('PED'));
    o.col0 = c.find(x => x[0].startsWith('COL')); o.col0v = simTqCmd;
    _ax(1, 0.5); _ax(0, -0.3); _ax(2, 0.6); joyPoll(2100);
    const d = shot(); o.cyc1 = d.find(x => x[0].startsWith('CYC')); o.ped1 = d.find(x => x[0].startsWith('PED'));
    _ax(0, 0); _ax(1, 0); _ax(2, 0); joyPoll(2200);
    // CTR — 가운데가 밀린 자리로 잡혀(손을 떼도 A49) 있을 때 누르면 0 으로
    const pi = joyAxes.pitch.i; _joyNeutral[_pad.index][pi] = 0.55; _ax(1, 0); joyPoll(2300);
    o.skew = shot().find(x => x[0].startsWith('CYC'));
    btn('hocasCenter').click(); joyPoll(2350);
    o.ctr = shot().find(x => x[0].startsWith('CYC'));
    const store = () => JSON.parse(localStorage.getItem('joyNeutral') || '{}');
    o.saved = !!store()[_pad.id]; _hocasCduRefresh(); o.savedTxt = document.getElementById('hocasc').textContent;
    // DEFAULT — 저장한 가운데를 지운다
    btn('hocasDefault').click(); joyPoll(2400);
    o.cleared = !store()[_pad.id]; _hocasCduRefresh(); o.clearedTxt = document.getElementById('hocasc').textContent;
    localStorage.removeItem('joyNeutral');
    toggleHocas(); o.after = hocasOn; o.offAgain = shot().some(x => x[0] === 'HOCAS');
    CDU_ACT.switchMode('HOME');
    toggleSimMode(false);
    // SIM 을 켜기 전(레버 배정 없이)에도 컬렉티브 막대가 보인다 — 지금 토크를 레버 자리로
    const keep = joyAxes.coll; delete joyAxes.coll; S.tq = 62; hocasOn = true; sysPageSet('asys_hocas');
    o.nsCol = shot().find(x => x[0].startsWith('COL')); o.table = ['Cyclic Stick Position', 'Co-Pilot', 'Pilot', 'MEPCTL', 'Cursor Enable', 'PTT- SEL(2nd)'].every(n => shot().some(x => x[0] === n));
    hocasOn = false; if (keep) joyAxes.coll = keep;
    // FULL/HALF — Aircraft Systems 푸터 단추 · HALF 면 왼쪽 HOCAS · 오른쪽 TCAS
    o.pageAfterOff = sysPage;
    CDU_ACT.switchMode('ACSYS');
    const lb = document.querySelector('#footerNav [data-act="sysLayoutToggle"]'); o.layoutBtn = !!lb && lb.textContent.includes('FULL/HALF');
    sysPageSet('asys_hocas'); lb.click(); o.half = sysLayout; o.halves = sysHalf.L + '|' + sysHalf.R;
    const own = []; { const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText; proto.fillText = function (tx, ...a) { own.push(String(tx)); return orig.call(this, tx, ...a); };
      try { const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 630; _sysPaint(cv.getContext('2d'), cv, 1000, 630, 1, true); } finally { proto.fillText = orig; } }
    o.halfDraw = own.includes('HOCAS') && own.includes('TCAS') && own.includes('Cyclic Stick Position') && own.some(x => /^TCAS : /.test(x));
    // 노브 셋 — 가운데는 왼쪽 ⇄ 오른쪽
    o.knobs = document.querySelectorAll('#cdu-knobs .cdu-knob').length;
    o.sel0 = sysSel; cduKnobOp('L', 'tilt', { x: 1, y: 0 }); o.sel1 = sysSel; o.selTxt = document.getElementById('cdu-lbl-L').textContent;
    sysPageSet('asys_fuel'); o.halves2 = sysHalf.L + '|' + sysHalf.R;
    cduKnobOp('L', 'tilt', { x: 0, y: 1 }); o.selKeep = sysSel;
    document.querySelector('#footerNav [data-act="sysLayoutToggle"]').click(); o.full = sysLayout;
    localStorage.removeItem('sysLayout'); sysSel = 'L'; sysHalf = { L: 'asys_hocas', R: 'tcas' }; sysPageSet('asys_fuel'); CDU_ACT.switchMode('HOME');
    return o;
  })()`);
  t.ok(r.hoverGone && !r.fcpBtn, 'FCP 에 HOCAS · CTR 버튼이 없다(CDU 로 옮겼다) — HOVER 칸도 소프트키로 옮겨 없앴다');
  t.ok(r.cduBtns, 'CDU HOCAS 칸 — CTR · DEFAULT 만(SYSTEM 표시 버튼 · 설명 글은 없앴다)');
  t.eq(r.off, false, '평소(Fuel 화면)에는 HOCAS 를 그리지 않는다');
  t.ok(r.opened, 'CDU HOCAS 칸을 열면 SYSTEM 창에 HOCAS 화면');
  t.ok(r.on && r.cls && r.title, '누르면 켜지고 SYSTEM 창에 HOCAS 화면이 뜬다');
  t.ok(r.cyc0 && r.cyc0[0] === 'CYC 0 · 0' && r.cyc0[1] === '#00ff88', `가운데면 0 · 초록 (${r.cyc0 && r.cyc0.join(' ')})`);
  t.ok(r.ped0 && r.ped0[0] === 'PED 0', `페달 가운데 (${r.ped0 && r.ped0[0]})`);
  t.ok(r.cyc1 && /^CYC F\d+ · L\d+$/.test(r.cyc1[0]) && r.cyc1[1] === '#ffb74d', `밀고 왼쪽으로 치우치면 F·L 과 호박색 (${r.cyc1 && r.cyc1.join(' ')})`);
  t.ok(r.ped1 && /^PED R\d+$/.test(r.ped1[0]), `오른 페달 (${r.ped1 && r.ped1[0]})`);
  t.ok(r.skew && /^CYC A\d+/.test(r.skew[0]), `가운데가 밀린 자리로 잡히면 손을 떼도 치우쳐 보인다 (${r.skew && r.skew[0]})`);
  t.ok(r.ctr && r.ctr[0] === 'CYC 0 · 0', `CTR 을 누르면 지금 자리가 가운데가 된다 (${r.ctr && r.ctr[0]})`);
  t.ok(r.saved && /있음/.test(r.savedTxt), 'CTR 은 그 장치의 가운데를 저장한다(칸에 "있음")');
  t.ok(r.cleared && /없음\(기본값\)/.test(r.clearedTxt), 'DEFAULT 는 저장한 가운데를 지운다(칸에 "없음(기본값)")');
  t.ok(r.col0 && r.col0[0] === `COL ${Math.round(r.col0v)}%`, `컬렉티브 막대 — 레버가 요구하는 토크를 함께 보인다 (${r.col0 && r.col0[0]})`);
  t.ok(!r.after && !r.offAgain, '다시 누르면 꺼지고 앞 화면으로 돌아간다');
  t.ok(r.nsCol && r.nsCol[0] === 'COL 62%', `SIM 을 켜기 전에도 컬렉티브가 보인다 — 지금 토크 (${r.nsCol && r.nsCol[0]})`);
  t.ok(r.table, 'HOCAS 화면 — Cyclic Stick Position · Co-Pilot/Pilot 표(MEPCTL · Cursor Enable · PTT-SEL)');
  t.ok(r.layoutBtn, 'Aircraft Systems 푸터에 SYSTEM FULL/HALF 단추');
  t.ok(r.half === 'HALF' && r.halves === 'asys_hocas|tcas', `HALF — 왼쪽 HOCAS · 오른쪽 TCAS (${r.half} ${r.halves})`);
  t.ok(r.halfDraw, 'HALF 그림 — 두 반쪽 이름표(HOCAS · TCAS)와 TCAS 머리글');
  t.ok(r.knobs === 3 && r.sel0 === 'L' && r.sel1 === 'R' && /Pane R▶/.test(r.selTxt), `CDU 아래 노브 셋 — 조이스틱 좌우가 판(Pane) 왼쪽 ⇄ 오른쪽 (${r.knobs} ${r.sel0}→${r.sel1} ${r.selTxt})`);
  t.eq(r.halves2, 'asys_hocas|asys_fuel', '고른 쪽(오른쪽)에 다음 계통 화면이 들어간다');
  t.eq(r.selKeep, 'R', '조이스틱을 위 · 아래로 기울이면 판은 그대로');
  t.eq(r.full, 'FULL', '다시 누르면 FULL');
}
