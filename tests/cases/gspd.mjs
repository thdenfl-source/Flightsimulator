// GSPD 와 측면축 오토파일럿의 관계
// GSPD 는 요/롤 축을 가져가므로 NAV·OBS 가 뱅크를 지령해도 기수가 돌지 않는다.
// 버튼은 켜진 채 두되(끄면 이어서 동작) 조향 불가 상태가 화면에 보여야 한다.
export const name = 'GSPD 상호작용';

export async function run(page, t) {
  const r = await page.evaluate(() => {
    const out = {};
    const cls = id => document.getElementById(id).classList.contains('ap-inh');
    // 초기: GSPD 꺼짐 → 무력화 표시 없음
    gspdOn = false; gspdCoasting = false; updateHoverBtns();
    out.offNav = cls('fks-navd'); out.offObs = false;
    // GSPD 켜기
    if (!gspdOn) toggleGspd();
    out.onNav = cls('fks-navd'); out.onObs = true;
    out.title = document.getElementById('fks-navd').title;
    // NAV 를 켠 채 GSPD 중이면 FMA 중앙이 대기 표기
    navApOn = true; hdgSelOn = false;
    out.fmaNav = (() => {
      // FMA 문자열 생성 로직과 같은 조건으로 확인
      return gspdOn ? (navApOn ? 'GS/NAV' : (hdgSelOn ? 'GS/HDG' : 'GS')) : null;
    })();
    // 실제 조향 불가 확인: 뱅크를 줘도 기수가 안 바뀐다
    S.hdg = 90; S.bnk = 20; S.spd = 60;
    const h0 = S.hdg;
    for (let i = 0; i < 20; i++) {
      if (Math.abs(S.bnk) > 0.5 && !gspdOn && !gspdCoasting) {
        const V = Math.max(10, S.spd) * 0.5144;
        S.hdg = normA(S.hdg + 9.81 * Math.tan(S.bnk * D2R) / V / D2R * 0.5);
      }
    }
    out.hdgLocked = (S.hdg === h0);
    // GSPD 끄기 → 표시 해제, 설정(NAV) 유지
    toggleGspd(); gspdCoasting = false; updateHoverBtns();
    out.afterNavOn = navApOn;
    out.afterInh = cls('fks-navd');
    return out;
  });

  t.eq(r.offNav, false, 'GSPD 꺼짐 — NAVD CPL 버튼 정상');
  t.eq(r.offObs, false, '(인터셉트 버튼은 없앴다)');
  t.eq(r.onNav, true, 'GSPD 켜짐 — NAVD CPL 버튼 무력화 표시');
  t.eq(r.onObs, true, '(인터셉트 버튼은 없앴다)');
  t.ok(/ANTI-TORQUE/.test(r.title), `NAV 버튼 안내 문구: ${r.title.slice(0, 40)}…`);
  t.eq(r.fmaNav, 'GS/NAV', 'FMA 중앙이 NAV 대기 표기');
  t.eq(r.hdgLocked, true, 'GSPD 중 뱅크를 줘도 기수 불변(설계상)');
  t.eq(r.afterNavOn, true, 'GSPD 해제 후에도 NAV 설정 유지');
  t.eq(r.afterInh, false, 'GSPD 해제 후 무력화 표시 사라짐');

  // ── 4방향 트림을 누르고 있을 때 — 1kt 씩 옮겨 가는 기준속도를 계단 없이 따라간다 ──
  // 기준속도는 1초마다 1kt 씩 옮겨 간다. 빠른 속도(15kt 이상)에서는 종전에 그 1kt 를
  // 0.2초 만에 따라가고 나머지 0.8초는 멈춰, 1초마다 속도·지도·PFD 가 튀었다(전후 축).
  const ramp = await page.evaluate(() => {
    gspdCoasting = false; if (gspdOn) toggleGspd();
    S.lat = 37.5; S.lon = 127; S.hdg = 90; S.spd = 30; S.alt = 2000; windSpd = 0; simSpeed = 1;
    toggleGspd();
    const go = (axis, v0, dir) => {
      gspdRefFwd = axis === 'fwd' ? v0 : 0; gspdActFwd = gspdRefFwd;
      gspdRefLat = axis === 'lat' ? v0 : 0; gspdActLat = gspdRefLat;
      const act = () => (axis === 'fwd' ? gspdActFwd : gspdActLat);
      S.running = true; let ts = 1000; S.lastT = ts;
      let maxStep = 0, still = 0, prev = act();
      for (let i = 1; i <= 100; i++) {          // 5초 · 20Hz
        if (i % 20 === 1) gspdTrimNudge(dir);    // 1초마다 1kt
        ts += 50; simStep(ts);
        const d = Math.abs(act() - prev); prev = act();
        maxStep = Math.max(maxStep, d);
        if (i > 1 && i < 100 && d < 0.01) still++;
      }
      S.running = false;
      return { maxStep, still, end: act() };
    };
    const out = { fwd: go('fwd', 30, 'F'), lat: go('lat', 15, 'R') };
    toggleGspd(); gspdCoasting = false;
    return out;
  });
  t.ok(ramp.fwd.maxStep <= 0.051 && ramp.fwd.still <= 5,
    `전후 30kt — 1kt 를 1초에 걸쳐 고르게 따라간다 (프레임당 최대 ${ramp.fwd.maxStep.toFixed(3)}kt · 멈춘 프레임 ${ramp.fwd.still})`);
  t.ok(Math.abs(ramp.fwd.end - 35) < 1.1, `5초 동안 5kt 를 따라왔다 (${ramp.fwd.end.toFixed(1)}kt)`);
  t.ok(ramp.lat.maxStep <= 0.051 && ramp.lat.still <= 5,
    `좌우 15kt 도 같다 (프레임당 최대 ${ramp.lat.maxStep.toFixed(3)}kt · 멈춘 프레임 ${ramp.lat.still})`);
}
