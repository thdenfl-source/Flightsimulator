// CDU Aircraft Systems — Fuel Configuration · Video Settings(실기 GTC 화면, 18-system.js)
export const name = 'CDU 계통 설정 화면';

export async function run(page, t) {
  const R = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    localStorage.removeItem('fuelCfg'); localStorage.removeItem('videoCfg');
    fuelCfg = { type: 'JET A-1', eaux: true, ret: 0 }; videoCfg = Object.assign({}, VIDEO_DEF); fuelReset();
    selectPanel('mid', 'cdu', true);
    const open = async id => { CDU_ACT.switchMode('ACSYS'); await wait(50); document.querySelector(`#mainContentArea [data-act="acSysOpen"][data-arg='["${id}"]']`).click(); await wait(80); };
    const click = sel => { document.querySelector('#mainContentArea ' + sel).click(); };
    const txt = id => (document.getElementById(id) || {}).textContent;
    const o = {};
    // Fuel Configuration
    await open('asys_fuel');
    o.head = document.querySelector('#mainContentArea .gtc-head').textContent;
    o.type0 = txt('fuelc-type'); click('[data-act="fuelTypeCycle"]'); await wait(30); o.type1 = txt('fuelc-type');
    o.bar0 = document.getElementById('fuelc-eaux').classList.contains('on');
    click('[data-act="fuelEauxToggle"]'); await wait(30);
    const seen = [], proto = CanvasRenderingContext2D.prototype, oT = proto.fillText;
    proto.fillText = function (x, ...a) { seen.push(String(x)); return oT.call(this, x, ...a); };
    sysPage = 'asys_fuel'; try { sysDraw(); } finally { proto.fillText = oT; }
    o.eauxOff = !document.getElementById('fuelc-eaux').classList.contains('on') && fuelAux() === 0 && !seen.includes('EXT AUX1') && fuelTotal() === 1914;
    click('[data-act="fuelEauxToggle"]'); await wait(30); o.eauxOn = fuelAux() === 1050;
    const end0 = txt('fuelc-end'); fuelCfg.ret = 1000; _fuelCduRefresh(); o.ret = txt('fuelc-ret'); o.endShort = txt('fuelc-end') !== end0;
    o.sim = !!document.querySelector('#mainContentArea [data-act="fuelAdjust"]') && txt('fuelc-t') === '2964 LBS';
    // 칸이 모자라면 위아래로 밀어 아래 RESET 까지 닿는다(스크롤 칸 · 세로 터치 이동 허용)
    { const m = document.getElementById('mainContentArea'), r = m.querySelector('[data-act="fuelReset"]');
      m.scrollTop = m.scrollHeight; await wait(30);
      o.scroll = getComputedStyle(m).overflowY === 'auto' && getComputedStyle(m).touchAction === 'pan-y' && r.getBoundingClientRect().bottom <= m.getBoundingClientRect().bottom + 1;
      m.scrollTop = 0; }
    // Video Settings
    await open('asys_video');
    o.vHead = document.querySelector('#mainContentArea .gtc-head').textContent;
    o.vCh = document.querySelector('#mainContentArea [data-act="videoChanOpen"] .gtc-v').textContent;
    click('[data-act="videoChanOpen"]'); await wait(30);
    o.list = [...document.querySelectorAll('#mainContentArea .gtc-opt')].map(e => e.textContent);
    o.pickHead = document.querySelector('#mainContentArea .gtc-head').textContent;
    click('[data-act="videoChanSet"][data-arg=\'["EO/IR"]\']'); await wait(30);
    o.vCh2 = document.querySelector('#mainContentArea [data-act="videoChanOpen"] .gtc-v').textContent;
    click('[data-act="videoAdj"][data-arg=\'["bri",5]\']'); click('[data-act="videoAdj"][data-arg=\'["sat",-5]\']'); await wait(30);
    o.adj = [videoCfg.bri, videoCfg.con, videoCfg.sat].join('/');
    click('[data-act="videoSrcToggle"]'); await wait(30); o.src = videoCfg.src;
    click('[data-act="videoDefault"]'); await wait(30); o.def = JSON.stringify(videoCfg) === JSON.stringify(VIDEO_DEF);
    fuelCfg = { type: 'JET A-1', eaux: true, ret: 0 }; _fuelCfgSave(); fuelReset();
    localStorage.removeItem('fuelCfg'); localStorage.removeItem('videoCfg');
    CDU_ACT.switchMode('HOME');
    return o;
  });
  t.ok(R.head === 'Fuel Configuration' && R.type0 === 'JET A-1' && R.type1 === 'JET A', `Fuel — Fuel Configuration 화면 · Fuel Type 누르면 바뀐다 (${R.type0} → ${R.type1})`);
  t.ok(R.bar0 && R.eauxOff && R.eauxOn, 'Fuel E-AUX Tank — 녹색 막대(장착) · 끄면 AUX 0 · Fuel 화면에서 EXT AUX 사라짐 · 다시 켜면 1050');
  t.ok(R.ret === '1000LB' && R.endShort, `Return Fuel — ${R.ret} 만큼 빼고 END 를 셈한다`);
  t.ok(R.sim && R.scroll, '아래 시뮬 연료(훈련용) 칸은 그대로 · 칸이 모자라면 밀어서 RESET 까지 본다');
  t.ok(R.vHead === 'Video Settings' && R.vCh === 'RADAR', 'Video — Video Settings 화면 · Channel RADAR');
  t.eq(R.list.join(','), 'RADAR,DMM,EO/IR,HOIST', 'Channel 을 누르면 RADAR · DMM · EO/IR · HOIST (EXPD 없음)');
  t.ok(R.pickHead === 'Channel Select' && R.vCh2 === 'EO/IR', `채널을 고르면 그 채널 (${R.vCh2})`);
  t.ok(R.adj === '55/50/45' && R.src === 'Analog' && R.def, `Brightness · Contrast · Saturation −/+ 5% · Source · Default Settings (${R.adj})`);
}
