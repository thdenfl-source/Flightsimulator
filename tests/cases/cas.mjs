// CAS(KUH-1CG CWS — SDS 31-50-04) — 등급 정렬 · 최근 것 위 · 경고 고정 넘기기 · 점멸 · 승인(MWP · 소프트키 12 · MEP/RST · CDU) ·
// 음성(되풀이 · 한 번) · 원인이 풀리면 지움 · Checklist > CAS · 시스템 메시지(MSG)
export const name = 'CAS';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const o = {}, keep = window.pfdMsgs;
    let raw = [];
    window.pfdMsgs = () => raw.slice();
    const R = '#ff3030', A = '#ffb000', G = PFD_MSG_GREEN;
    const shot = () => { const seen = [], f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (x, ...a) { seen.push([String(x), String(this.fillStyle), this.globalAlpha]); return f.call(this, x, ...a); };
      try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = f; } return seen; };
    casAct.clear(); casScroll = 0; speakLog.length = 0; casVoiceOn = true;
    // 정렬 — 조언 · 주의 · 경고를 섞어 차례로 띄운다
    raw = [{ t: 'PRK ON', c: G }]; casUpdate();
    raw.push({ t: 'PITOT HEAT', c: A }); casUpdate();
    raw.push({ t: '1 GEN', c: A }); casUpdate();
    raw.push({ t: 'AFCS FAIL', c: R }); casUpdate();
    o.order = casSorted().map(m => m.t).join(',');
    o.lvls = casSorted().map(m => m.lvl).join('');
    // 승인 대기 — 경고가 있으면 W, 소프트키 12 는 WARN ACK
    o.pend = casAckPending(); pfdSkGo('TOP'); pfdSkRender();
    const k12 = document.getElementById('sk-11'); o.k12 = k12.textContent; o.k12cls = k12.classList.contains('ackw');
    // 점멸 — 승인 전 경고 · 주의는 흐려지는 때가 있고(색은 그대로), 조언은 늘 또렷
    o.blinkW = casBlinkAlpha(casAct.get('AFCS FAIL')) <= 1 && casAct.get('AFCS FAIL').ack === false && casBlinkAlpha(casAct.get('PRK ON')) === 1;
    // MWP 램프 — WARN · CAUT 켜짐(글자색이 켜진 색)
    const s0 = shot(); const lamp = n => (s0.find(x => x[0] === n) || [])[1];
    o.lampW = lamp('WARN'); o.lampC = lamp('CAUT'); o.lampRev = lamp('REV');
    // 음성 — 가장 높은 것(경고 AFCS FAIL)부터, 3.5 초마다 되풀이
    casVoiceStep(10000); casVoiceStep(11000); casVoiceStep(13600);
    o.voice = speakLog.slice();
    // 소프트키 12 로 승인 — 점멸 · 램프 · 음성 멈춤, 메시지는 남는다
    pfdSkPress(11); o.after = { pend: casAckPending(), n: casAct.size, k12: document.getElementById('sk-11').textContent };
    const s1 = shot(); o.lampOff = (s1.find(x => x[0] === 'CAUT') || [])[1];
    speakLog.length = 0; casVoiceStep(20000); o.voiceAfter = speakLog.length;
    // 새 주의 — 다시 CAUT ACK · "CAUTION, CAUTION" · MWP 램프를 누르면 승인
    raw.push({ t: 'HYD TEMP', c: A }); casUpdate(); o.pend2 = casAckPending();
    casVoiceStep(30000); o.voice2 = speakLog.slice();
    drawPFD(); const c = _mwpR.CAUT; o.mwpHit = pfdMwpHit(c.x + 3, c.y + 3); o.pend3 = casAckPending();
    // 원인이 풀리면 바로 지운다
    raw = raw.filter(m => m.t !== '1 GEN'); casUpdate(); o.gone = !casAct.has('1 GEN');
    // 전용 음성 — IAS "AIRSPEED" · LOW ALTITUDE 는 한 번만
    speakLog.length = 0; raw.push({ t: 'LOW ALTITUDE', c: R }); casUpdate();
    casVoiceStep(40000); casVoiceStep(44000); casVoiceStep(48000); o.lowAlt = speakLog.slice();
    casAckAll('MEP'); o.mep = casMepT > 0 && casAckPending() === '';
    raw.push({ t: 'IAS', c: A }); casUpdate(); speakLog.length = 0; casVoiceStep(60000); o.ias = speakLog.slice(); casAckAll();
    // 경고 고정 — 경고 3 + 주의 40 이면 넘겨도 경고 셋은 늘 맨 위
    raw = [{ t: '1 ENG OUT', c: R }, { t: '2 ENG OUT', c: R }, { t: 'LOW ROTOR RPM', c: R }, ...Array.from({ length: 40 }, (_, i) => ({ t: 'CAUT ' + (i + 1), c: A }))];
    casUpdate(); casScroll = 0;
    const v0 = casView(12); casScroll = 5; const v1 = casView(12);
    o.pin = [v0.list.slice(0, 3).every(m => m.lvl === 1), v1.list.slice(0, 3).every(m => m.lvl === 1), v1.up === 5, v0.list.length === 11, v1.tag];
    o.cap = casView(40).list.length;   // 최대 20줄(메시지 19 + 넘김 표시)
    // Checklist > CAS — 청색 테두리 · ACK
    selectPanel('mid', 'cdu', true); CDU_ACT.switchMode('CHECKLIST'); await new Promise(r => setTimeout(r, 30));
    o.clBtn = !!document.querySelector('#mainContentArea [data-arg=\'["CAS_LIST"]\']');
    CDU_ACT.switchMode('CAS_LIST'); await new Promise(r => setTimeout(r, 30));
    const rows = () => [...document.querySelectorAll('#mainContentArea .cas-row')];
    o.cdu = { n: rows().length, un: rows().filter(e => e.dataset.un === '1').length, first: rows()[0] && rows()[0].dataset.lvl };
    document.querySelector('#footerNav [data-act="casAckAll"]').click(); await new Promise(r => setTimeout(r, 300));
    o.cduAck = rows().filter(e => e.dataset.un === '1').length;
    CDU_ACT.switchMode('HOME');
    // 시스템 메시지 — CAS 창이 아니라 MSG
    raw = []; casUpdate(); cduKeyStuck = true; const s2 = shot(); o.msg = s2.some(x => x[0] === 'MSG') && !s2.some(x => x[0] === 'CDU KEY STUCK'); cduKeyStuck = false;
    window.pfdMsgs = keep; casAct.clear(); casScroll = 0; speakLog.length = 0; pfdSkGo('TOP');
    return o;
  });
  t.eq(r.order, 'AFCS FAIL,1 GEN,PITOT HEAT,PRK ON', '정렬 — 경고 > 주의 > 조언, 같은 등급은 최근 것이 위');
  t.eq(r.lvls, '1223', '등급 — 적(경고) · 황(주의) · 녹(조언)');
  t.ok(r.pend === 'W' && /WARN\s*ACK/.test(r.k12) && r.k12cls, `승인 전 경고 — 소프트키 12 WARN ACK 점멸 (${r.k12})`);
  t.ok(r.blinkW, '승인 전 경고는 점멸 · 조언은 점멸하지 않는다');
  t.ok(r.lampW === '#ffffff' && r.lampC === '#000000' && !!r.lampRev, `MWP — WARN · CAUT 램프 켜짐 (${r.lampW} · ${r.lampC} · REV ${r.lampRev})`);
  t.ok(r.voice.length === 2 && r.voice.every(v => v === 'AFCS FAIL, AFCS FAIL'), `음성 — 가장 높은 경고부터 3.5 초마다 되풀이 (${r.voice.join(' / ')})`);
  t.ok(r.after.pend === '' && r.after.n === 4 && !/ACK/.test(r.after.k12), `소프트키 12 로 승인 — 점멸 · ACK 끝, 메시지는 남는다 (${r.after.n})`);
  t.ok(r.lampOff !== '#000000' && r.voiceAfter === 0, '승인하면 램프가 꺼지고 음성이 멈춘다');
  t.ok(r.pend2 === 'C' && r.voice2.includes('CAUTION, CAUTION'), `새 주의 — CAUT ACK · "CAUTION, CAUTION" (${r.voice2.join(' / ')})`);
  t.ok(r.mwpHit && r.pend3 === '', 'MWP 램프를 누르면 승인');
  t.ok(r.gone, '원인이 풀리면 CAS 창에서 바로 지운다');
  t.ok(r.lowAlt.length === 1 && r.lowAlt[0] === 'ALTITUDE, ALTITUDE', `LOW ALTITUDE — "ALTITUDE, ALTITUDE" 한 번만 (${r.lowAlt.join(' / ')})`);
  t.ok(r.mep, '사이클릭 MEP/RST 로 승인');
  t.ok(r.ias[0] === 'AIRSPEED, AIRSPEED', `IAS — 전용 음성 "AIRSPEED, AIRSPEED" (${r.ias[0]})`);
  t.ok(r.pin.slice(0, 4).every(Boolean) && r.pin[4] === '5↑  27↓', `경고는 넘기지 않고 맨 위 고정 · 주의만 넘어간다 (${r.pin[4]})`);
  t.eq(r.cap, 19, '창은 최대 20줄 — 메시지 19 + 맨 아래 넘김 표시');
  t.ok(r.clBtn && r.cdu.n === 43 && r.cdu.un === 43 && r.cdu.first === '1', `Checklist > CAS — 전부 · 승인 전은 청색 테두리 (${r.cdu.n} · ${r.cdu.un})`);
  t.eq(r.cduAck, 0, 'CDU CAS 의 ACK 로 승인 — 청색 테두리 사라짐');
  t.ok(r.msg, 'CDU KEY STUCK 은 CAS 가 아니라 시스템 메시지 — PFD MSG');
}
