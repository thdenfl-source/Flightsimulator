// CDU 아래 노브 셋(KUH-1CG FLM 7.15 · 7.16) — 왼쪽 조이스틱(지도 범위 · 포인터 · 8방향 · Pane) · 가운데(볼륨 · 스켈치 · NAV ID) ·
// 오른쪽 이중 노브(COM 대기 1 MHz · 25 kHz · Push:1-2 · Hold:↕ · Data Entry) · 라벨 바 · 키 고착 · 노브 간격
export const name = 'CDU 노브';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    const o = {};
    selectPanel('mid', 'cdu', true); CDU_ACT.switchMode('HOME'); await w(50);
    // 노브 간격 — 세 노브 가운데 사이가 같다
    const xs = [...document.querySelectorAll('#cdu-knobs .cdu-knob')].map(e => { const b = e.getBoundingClientRect(); return b.left + b.width / 2; });
    o.gap = [xs[1] - xs[0], xs[2] - xs[1]];
    o.lbl = ['L', 'C', 'R'].map(k => document.getElementById('cdu-lbl-' + k).textContent);
    // 왼쪽 — 지도 범위
    const z0 = leafMap.getZoom(); cduKnobOp('L', 'rot', 1); o.zIn = leafMap.getZoom() - z0; cduKnobOp('L', 'rot', -1); o.zBack = leafMap.getZoom() === z0;
    // 포인터 — 켜고 8방향 · 공항 위면 ID
    cduKnobOp('L', 'push'); o.ptrOn = knobPtr.on && document.getElementById('knob-ptr').style.display === 'block';
    o.lblPan = document.getElementById('cdu-lbl-L').textContent;
    cduKnobOp('L', 'tilt', { x: 1, y: -1 }); o.ptrXY = [knobPtr.x, knobPtr.y];
    const ap = AIRPORTS[0]; leafMap.setView([ap.lat, ap.lon], 11, { animate: false }); knobPtr.x = 0; knobPtr.y = 0; knobPtrDraw();
    o.ptrId = knobPtrInfo().id; o.ptrTxt = document.querySelector('#knob-ptr .kp-info').textContent; o.apId = ap.ident;
    // 가장자리면 지도를 민다
    const c0 = leafMap.getCenter(); for (let i = 0; i < 80; i++) cduKnobOp('L', 'tilt', { x: 1, y: 0 }); o.panned = leafMap.getCenter().lng > c0.lng;
    cduKnobOp('L', 'push'); o.ptrOff = !knobPtr.on && document.getElementById('knob-ptr').style.display === 'none';
    // 포인터 꺼짐 — 좌우는 Pane(HALF)
    sysLayout = 'HALF'; sysSel = 'L'; cduKnobOp('L', 'tilt', { x: 1, y: 0 }); o.pane = sysSel; cduKnobOp('L', 'tilt', { x: -1, y: 0 }); o.pane2 = sysSel;
    sysLayout = 'FULL'; localStorage.removeItem('sysLayout');
    // 가운데 — MIC(COM1) 볼륨 · 스켈치
    const R = cduKnobRadio; const v0 = R.state().vol.com1;
    cduKnobOp('C', 'rot', -1); cduKnobOp('C', 'rot', -1); o.vol = [v0, R.state().vol.com1];
    cduKnobOp('C', 'push'); o.sq = R.state().sq.com1; o.lblC = document.getElementById('cdu-lbl-C').textContent;
    cduKnobOp('C', 'push');
    // NAV 탭 — 누르면 NAV ID · 오른쪽은 NAV 주파수
    CDU_ACT.switchMode('AUDIO'); CDU_ACT.switchAudioTab && CDU_ACT.switchAudioTab('NAV'); await w(30);
    o.navTab = /NAV/.test(document.getElementById('cdu-lbl-R').textContent);
    cduKnobOp('C', 'push'); o.navId = R.state().navId.nav1 && !!document.querySelector('#mainContentArea .knob-navid');
    cduKnobOp('C', 'push');
    const n0 = R.state().freqs.nav1.act; cduKnobOp('R', 'rotIn', 1); o.nav = [n0, R.state().freqs.nav1.act];
    cduKnobOp('R', 'rotIn', -1);
    CDU_ACT.switchMode('HOME'); await w(20);
    // 오른쪽 — COM1 대기 1 MHz · 25 kHz, 누름 COM2, 길게 대기 ⇄ 활성
    const s0 = R.state().freqs.com1.stb;
    cduKnobOp('R', 'rot', 1); o.mhz = [s0, R.state().freqs.com1.stb];
    cduKnobOp('R', 'rotIn', -1); o.khz = R.state().freqs.com1.stb;
    o.tuned = document.getElementById('h-com1-stb').classList.contains('knob-tuned') && document.getElementById('h-com1-stb').textContent === o.khz;
    // 136.975 → 118.000 둘러 감기
    for (let i = 0; i < 40; i++) cduKnobOp('R', 'rotIn', 1);
    o.lblR = document.getElementById('cdu-lbl-R').textContent;
    const a1 = R.state().freqs.com1.act, b1 = R.state().freqs.com1.stb; cduKnobOp('R', 'hold'); o.swap = R.state().freqs.com1.act === b1 && R.state().freqs.com1.stb === a1;
    cduKnobOp('R', 'push'); o.tune2 = R.state().tune; o.lblR2 = document.getElementById('cdu-lbl-R').textContent;
    cduKnobOp('R', 'rot', 1); o.com2Moved = R.state().freqs.com2.stb;
    cduKnobOp('R', 'push');
    // Data Entry — XPDR 코드: 큰 노브 커서 · 작은 노브 숫자(0~7) · 누름 Enter
    CDU_ACT.switchMode('XPDR_CODE'); await w(20);
    o.lblDE = document.getElementById('cdu-lbl-R').textContent;
    const code0 = R.state().xpdr;
    cduKnobOp('R', 'rot', -1); cduKnobOp('R', 'rot', -1); cduKnobOp('R', 'rot', -1);   // 맨 앞 자리
    o.cur = R.state().cur; o.curMark = !!document.querySelector('#xpdr-code-box .knob-cur');
    cduKnobOp('R', 'rotIn', 1); o.buf = R.state().buf;
    cduKnobOp('R', 'push'); o.xpdr = [code0, R.state().xpdr, R.state().mode];
    // 키 고착 — 10 초 넘게 누르면 PFD 메시지
    cduKeyStuck = true; o.stuck = pfdSysMsgs().includes('CDU KEY STUCK') && !pfdMsgs().some(m => m.t === 'CDU KEY STUCK'); cduKeyStuck = false;
    CDU_ACT.switchMode('HOME');
    return o;
  });
  t.ok(Math.abs(r.gap[0] - r.gap[1]) < 1.5, `노브 간격이 일정하다 (${r.gap.map(Math.round).join(' · ')}px)`);
  t.ok(/Range/.test(r.lbl[0]) && /Pane/.test(r.lbl[0]) && /Volum/.test(r.lbl[1]) && /FREQ/.test(r.lbl[2]), `라벨 바 (${r.lbl.join(' | ')})`);
  t.ok(r.zIn === 1 && r.zBack, '조이스틱을 돌리면 지도 범위');
  t.ok(r.ptrOn && /Pan ON/.test(r.lblPan), '누르면 지도 포인터 · 라벨 Push:Pan ON');
  t.ok(r.ptrXY[0] === 12 && r.ptrXY[1] === -12, `8방향 — 오른쪽 위 대각선 (${r.ptrXY})`);
  t.ok(r.ptrId === r.apId && r.ptrTxt.includes(r.apId) && /NM/.test(r.ptrTxt), `포인터가 공항 위면 ID · 방위 · 거리 (${r.ptrTxt})`);
  t.ok(r.panned, '가장자리에 닿으면 지도를 민다');
  t.ok(r.ptrOff, '다시 누르면 포인터가 꺼진다');
  t.ok(r.pane === 'R' && r.pane2 === 'L', '포인터가 꺼져 있으면 좌우가 SYSTEM HALF 판 고르기');
  t.ok(r.vol[1] === Math.max(0, r.vol[0] - 10), `가운데 노브 — COM1 볼륨 5 % 씩 (${r.vol})`);
  t.ok(r.sq === false && /Squelch OFF/.test(r.lblC), `누르면 스켈치 (${r.lblC})`);
  t.ok(r.navTab && r.navId, 'Audio & Radios NAV 탭 — 누르면 NAV ID(흰 ID)');
  t.ok(r.nav[0] !== r.nav[1] && /^1[01]\d\.\d\d$/.test(r.nav[1]), `NAV 탭 — 작은 노브는 NAV1 50 kHz (${r.nav})`);
  t.ok(+r.mhz[1].split('.')[0] === ((+r.mhz[0].split('.')[0] - 118 + 1) % 19) + 118, `큰 노브 1 MHz (${r.mhz})`);
  t.ok(r.khz.split('.')[1] === String((+r.mhz[1].split('.')[1] - 25 + 1000) % 1000).padStart(3, '0'), `작은 노브 25 kHz (${r.khz})`);
  t.ok(r.tuned, '돌린 대기 주파수는 위 막대에서 옅은 청색');
  t.ok(/COM1 FREQ/.test(r.lblR) && /Push:1-2 Hold:↕/.test(r.lblR), `라벨 (${r.lblR})`);
  t.ok(r.swap, '1.5 초 길게 누르면 대기 ⇄ 활성');
  t.ok(r.tune2 === 'com2' && /COM2/.test(r.lblR2), '짧게 누르면 COM2 로');
  t.ok(/Data Entry/.test(r.lblDE) && /Enter/.test(r.lblDE), `입력 화면이면 Data Entry (${r.lblDE})`);
  t.ok(r.cur === 0 && r.curMark, '큰 노브 — 커서(청록 바탕)');
  t.ok(r.buf[0] === String((+r.xpdr[0][0] + 1) % 8) && r.xpdr[1] === r.buf && r.xpdr[2] === 'XPDR_MODE', `작은 노브 숫자 · 누르면 Enter (${r.xpdr})`);
  t.ok(r.stuck, '10 초 넘게 누르면 CDU KEY STUCK — CAS 가 아니라 시스템 메시지(PFD MSG)');
}
