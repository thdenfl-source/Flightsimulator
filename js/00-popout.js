// ─────────────────────────────────────────────────────────────
// 00-popout.js — 패널을 따로 창(팝업)으로 띄운다(다중 모니터 배치)
//
// 화면의 세 패널(좌·중·우)을 각각 '⧉' 버튼으로 새 창에 옮겨 띄울 수 있다. 새 창은 앱을
// 하나 더 여는 것이 아니라 그 패널(의 DOM)을 그대로 옮겨 간 것이다 — 시뮬·상태·조이스틱은
// 이 창(본 창) 하나가 돌리고, 새 창은 그 화면을 보여 주고 입력을 받을 뿐이다. 그래서 창이
// 몇 개든 비행 상태가 어긋나지 않는다. 새 창을 닫거나 '⧉ 복귀' 를 누르면 패널이 제자리로 돌아온다.
//
// 그러려면 세 가지를 이어 준다.
//  1) 이벤트 — 앱·라이브러리가 document·window 에 건 입력 이벤트(키·클릭·포인터·휠·리사이즈)를
//     새 창의 document·window 에도 똑같이 건다(아래에서 등록을 받아 적어 둔다 — 그래서 이 파일은
//     라이브러리보다 먼저 불러야 한다).
//  2) 요소 찾기 — document.getElementById·querySelector(All) 가 새 창으로 옮겨 간 요소도 찾게 한다.
//  3) 화면 — 이 창의 스타일을 새 창에 그대로 옮겨 싣는다.
// 한계: 시뮬·3D 지도의 그리기 주기는 본 창이 돈다 — 본 창을 최소화하면 브라우저가 멈춰 세운다.
// 본 창은 다른 모니터에 띄워 두거나 한 패널을 남겨 두고 쓴다.
// ─────────────────────────────────────────────────────────────
(function () {
  const W = window, D = document;
  const wins = [];                       // { side, win, panel, ph, timer }
  const MIRROR = new Set(['keydown', 'keyup', 'keypress', 'click', 'dblclick', 'contextmenu',
    'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
    'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'touchcancel',
    'wheel', 'resize']);
  const reg = { doc: [], win: [] };
  const capOf = o => !!(o === true || (o && o.capture));

  // 1) document·window 에 거는 입력 이벤트를 받아 적고, 열린 새 창에도 똑같이 건다
  function patch(target, list, popTarget) {
    const add = target.addEventListener, rem = target.removeEventListener;
    target.addEventListener = function (type, fn, opt) {
      add.call(this, type, fn, opt);
      if (!fn || !MIRROR.has(type)) return;
      list.push([type, fn, opt]);
      wins.forEach(w => { try { popTarget(w).addEventListener(type, fn, opt); } catch (e) { /* 닫히는 중 */ } });
    };
    target.removeEventListener = function (type, fn, opt) {
      rem.call(this, type, fn, opt);
      if (!MIRROR.has(type)) return;
      const i = list.findIndex(r => r[0] === type && r[1] === fn && capOf(r[2]) === capOf(opt));
      if (i >= 0) list.splice(i, 1);
      wins.forEach(w => { try { popTarget(w).removeEventListener(type, fn, opt); } catch (e) { /* 닫히는 중 */ } });
    };
  }
  patch(D, reg.doc, w => w.win.document);
  patch(W, reg.win, w => w.win);

  // 2) 새 창으로 옮겨 간 요소도 찾는다(본 창을 먼저 본다)
  const gid = D.getElementById.bind(D), qs = D.querySelector.bind(D), qsa = D.querySelectorAll.bind(D);
  const live = () => wins.filter(w => !w.win.closed);
  D.getElementById = function (id) {
    const el = gid(id); if (el || !wins.length) return el;
    for (const w of live()) { const e = w.win.document.getElementById(id); if (e) return e; }
    return null;
  };
  D.querySelector = function (sel) {
    const el = qs(sel); if (el || !wins.length) return el;
    for (const w of live()) { const e = w.win.document.querySelector(sel); if (e) return e; }
    return null;
  };
  D.querySelectorAll = function (sel) {
    const list = qsa(sel); if (!wins.length) return list;
    const out = Array.from(list);
    live().forEach(w => out.push(...w.win.document.querySelectorAll(sel)));
    return out;
  };

  const PANEL_ID = { left: 'left-panel', mid: 'mid-panel', right: 'right-panel', bot: 'bot-panel' };
  const TITLE = { left: '좌측 패널', mid: '가운데 패널', right: '우측 패널', bot: '아래 패널' };

  function syncAppClasses() {
    const app = gid('app'); if (!app) return;
    ['left', 'mid', 'right', 'bot'].forEach(s => app.classList.toggle('po-' + s, wins.some(w => w.side === s)));
    app.classList.toggle('po-any', wins.length > 0);
    wins.forEach(w => {
      try {
        const root = w.win.document.getElementById('app');
        if (root) root.className = app.className + ' po-root';
      } catch (e) { /* 닫히는 중 */ }
      const b = w.panel.querySelector('.po-btn');
      if (b) { b.textContent = '⧉ 복귀'; b.title = '이 패널을 본 창으로 되돌린다'; }
      const tb = w.panel.querySelector('.po-top-btn'); if (tb) { tb.classList.toggle('on', !!w.pip); tb.textContent = w.pip ? '📌 복귀' : '📌 Top'; }
    });
    ['left', 'mid', 'right', 'bot'].forEach(s => {
      if (wins.some(w => w.side === s)) return;
      const p = gid(PANEL_ID[s]); const b = p && p.querySelector('.po-btn');
      if (b) { b.textContent = '⧉ POP UP'; b.title = '이 패널을 새 창으로 띄운다(다중 모니터에 따로 배치)'; }
      const tb = p && p.querySelector('.po-top-btn'); if (tb) { tb.classList.remove('on'); tb.textContent = '📌 Top'; }
    });
  }
  function relayout() {
    try { if (typeof applyPanels === 'function') applyPanels(); } catch (e) { console.warn('[popout]', e); }
    const kick = () => { try { W.dispatchEvent(new Event('resize')); } catch (e) { /* 무시 */ } };
    kick(); setTimeout(kick, 60); setTimeout(kick, 300);
  }

  // 새 창(또는 Top 창)의 문서를 꾸민다 — 스타일을 그대로 옮겨 싣는다
  function _popDocSetup(win, side, write) {
    const doc = win.document;
    if (write) {
      doc.open();
      doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<base href="' + String(location.href).replace(/"/g, '&quot;') + '">' +
        '<title>' + TITLE[side] + ' — Flight Simulator</title></head>' +
        '<body><div id="app"></div></body></html>');
      doc.close();
    } else {
      const base = doc.createElement('base'); base.href = String(location.href); doc.head.appendChild(base);
      doc.title = TITLE[side] + ' — Flight Simulator (Top)';
      const app = doc.createElement('div'); app.id = 'app'; doc.body.appendChild(app);
    }
    Array.from(D.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach(n => doc.head.appendChild(doc.importNode(n, true)));
    const st = doc.createElement('style');
    st.textContent =
      'html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#000;}' +
      '#app.po-root{position:absolute;inset:0;display:flex !important;flex-direction:row;}' +
      '#app.po-root > #left-panel,#app.po-root > #mid-panel,#app.po-root > #right-panel,#app.po-root > #bot-panel' +
      '{display:flex !important;flex:1 1 0 !important;width:100% !important;min-width:0;}' +
      '.po-top-btn{display:inline-block !important;}' +
      // 화면 하나만 띄운 창(SIM Mode 의 창 배치판) — 그 화면이 창을 가득 채운다
      '#app.po-root > .po-screen-host{display:flex !important;flex-direction:column;flex:1 1 0;width:100%;min-width:0;height:100%;}' +
      '#app.po-root > .po-screen-host > .page-content, #app.po-root > .po-screen-host > #pfd-wrap{display:block;flex:1 1 0;}';
    doc.head.appendChild(st);
    doc.body.className = D.body.className;
  }
  // 패널을 그 창으로 옮겨 붙이고 이벤트·주기를 잇는다
  function _popAttach(rec) {
    const { side, win, panel } = rec;
    const doc = win.document;
    doc.getElementById('app').appendChild(panel);
    wins.push(rec);
    reg.doc.forEach(([t, f, o]) => doc.addEventListener(t, f, o));
    reg.win.forEach(([t, f, o]) => win.addEventListener(t, f, o));
    win.addEventListener('pagehide', () => { if (wins.includes(rec)) popoutClose(side); });
    rec.timer = setInterval(() => { if (win.closed && wins.includes(rec)) popoutClose(side); }, 500);
    // 본 창이 가려지면(새 창을 전체화면으로 키우면 그 아래에 깔린다) 브라우저가 본 창의 그리기 주기(rAF)를
    // 멈춰 세운다 — 시뮬·3D 지도가 멈춘다. 그때는 새 창의 그리기 주기로 시뮬 한 프레임을 대신 돌리고
    // 3D 지도를 곧바로 그린다(본 창이 다시 돌기 시작하면 손을 뗀다).
    const pump = () => {
      if (win.closed || !wins.includes(rec)) return;
      try {
        const now = W.performance.now();
        if (typeof simStep === 'function' && typeof _simLastTick !== 'undefined' && now - _simLastTick > 120) {
          simStep(now, true);
          popoutRedrawMaps(win);
        }
      } catch (e) { console.warn('[popout] pump', e); }
      try { win.requestAnimationFrame(pump); } catch (e) { /* 닫히는 중 */ }
    };
    try { win.requestAnimationFrame(pump); } catch (e) { /* 무시 */ }
  }

  // ── Top — 다른 창들보다 늘 위에 뜨는 창(문서 PIP · 크롬·엣지 116 이상) ──
  // 누른 창(본 창 또는 새 창)에서 '항상 위' 창을 열고 패널을 그리로 옮긴다. 한 번 더 누르면 본 창으로 돌아온다.
  // 새 창에서 연 Top 창은 그 새 창에 딸려 있어(닫으면 Top 창도 닫힌다) 새 창을 작게 접어 둔다.
  function popoutTop(side, el) {
    if (!PANEL_ID[side]) return false;
    const cur = wins.find(w => w.side === side);
    if (cur && cur.pip) return popoutClose(side);
    const host = (el && el.ownerDocument && el.ownerDocument.defaultView) || W;
    const dpip = host.documentPictureInPicture;
    if (!dpip || typeof dpip.requestWindow !== 'function') {
      try { uiAlert('이 브라우저는 늘 위에 뜨는 창(Top)을 지원하지 않습니다 — 크롬·엣지 최신 판에서 쓸 수 있습니다.'); }
      catch (e) { _swallow(e); }   // (앱 대화창이 없을 때 — 기본 alert 는 쓰지 않는다)
      return false;
    }
    const panel = cur ? cur.panel : gid(PANEL_ID[side]);
    if (!panel) return false;
    const r = panel.getBoundingClientRect();
    let req;
    try { req = dpip.requestWindow({ width: Math.max(420, Math.round(r.width)), height: Math.max(360, Math.round(r.height)) }); }
    catch (e) { console.warn('[popout] Top', e); return false; }
    req.then(pip => {
      let ph, base = null;
      if (cur) {                                     // 새 창에 떠 있던 패널 — 그 창은 바탕으로 접어 둔다
        const i = wins.indexOf(cur); if (i >= 0) wins.splice(i, 1);
        clearInterval(cur.timer);
        ph = cur.ph; base = (host !== W) ? host : null;
        if (base) {
          // 바탕 창은 건드리지 않는다(크기를 바꾸거나 문서를 갈아엎으면 브라우저가 Top 창을 닫아 버린다) — 안내만 얹는다
          try {
            const note = base.document.createElement('div');
            note.textContent = 'Top 창을 띄운 바탕 창입니다 — 이 창을 닫으면 Top 창도 닫힙니다(최소화는 괜찮습니다).';
            note.style.cssText = 'color:#7ab8f5;font:12px sans-serif;padding:10px';
            base.document.getElementById('app').appendChild(note);
          } catch (e) { /* 무시 */ }
        } else { try { if (!cur.win.closed) cur.win.close(); } catch (e) { /* 무시 */ } }
      } else {
        ph = D.createComment('popout:' + side);
        panel.parentNode.insertBefore(ph, panel);
      }
      _popDocSetup(pip, side, false);
      _popAttach({ side, win: pip, panel, ph, timer: null, base, pip: true });
      syncAppClasses();
      relayout();
    }).catch(e => {
      console.warn('[popout] Top', e);
      try { uiAlert('Top 창을 열지 못했습니다: ' + ((e && (e.name + ' ' + e.message)) || e)); } catch (_) { /* 무시 */ }
    });
    return true;
  }

  function popoutOpen(side) {
    if (!PANEL_ID[side]) return false;
    const have = wins.find(w => w.side === side);
    if (have) { try { have.win.focus(); } catch (e) { /* 무시 */ } return true; }
    if (side === 'mid' && typeof tripleMode !== 'undefined' && !tripleMode) return false;
    if (side === 'bot' && typeof quadMode !== 'undefined' && !quadMode) return false;
    const panel = gid(PANEL_ID[side]);
    if (!panel) return false;
    const r = panel.getBoundingClientRect();
    const sz = SCR_SIZE[side.replace(/^scr-/, '')];          // 화면 하나만 띄울 때는 그 화면에 맞는 크기로
    const feat = sz ? `popup=yes,width=${sz[0]},height=${sz[1]}`
                    : `popup=yes,width=${Math.max(480, Math.round(r.width))},height=${Math.max(420, Math.round(r.height))}`;
    const win = W.open('', 'shinesong-' + side, feat);
    if (!win) {
      try { uiAlert('새 창이 막혔습니다 — 브라우저 주소창 오른쪽의 팝업 차단을 이 사이트에 허용해 주세요.'); }
      catch (e) { _swallow(e); }   // (앱 대화창이 없을 때 — 기본 alert 는 쓰지 않는다)
      return false;
    }
    _popDocSetup(win, side, true);
    // 패널을 옮긴다(제자리 표시를 남겨 두고)
    const ph = D.createComment('popout:' + side);
    panel.parentNode.insertBefore(ph, panel);
    _popAttach({ side, win, panel, ph, timer: null, base: null, pip: false });
    syncAppClasses();
    relayout();
    return true;
  }

  function popoutClose(side) {
    const i = wins.findIndex(w => w.side === side);
    if (i < 0) return false;
    const rec = wins[i];
    wins.splice(i, 1);
    clearInterval(rec.timer);
    try {
      if (rec.ph.parentNode) { rec.ph.parentNode.insertBefore(rec.panel, rec.ph); rec.ph.remove(); }
      else { const app = gid('app'); if (app) app.appendChild(rec.panel); }
    } catch (e) { console.warn('[popout] 되돌리기 실패', e); }
    try { if (!rec.win.closed) rec.win.close(); } catch (e) { /* 무시 */ }
    try { if (rec.base && !rec.base.closed) rec.base.close(); } catch (e) { /* 무시 */ }
    if (side.indexOf('scr-') === 0 && W._scrHost) delete W._scrHost[side.slice(4)];   // 그 화면은 다시 분할 패널로
    syncAppClasses();
    relayout();
    try { if (typeof simLayoutSync === 'function') simLayoutSync(); } catch (e) { /* 무시 */ }
    return true;
  }

  // ── 화면 하나씩 새 창으로(SIM Mode 의 창 배치판) ──
  // 패널(좌·중·우·하) 대신 화면(PFD · 3D · MAP · CDU · UPPER · LOWER · SYSTEM) 하나를 그 화면만 담은 그릇에 옮겨 새 창으로 띄운다.
  // 브라우저는 한 번 누를 때 새 창을 하나만 열어 주므로, 배치판의 버튼을 하나씩 누른다.
  const SCR_TITLE = { pfd: 'PFD · FCP', m3d: '3D', map: 'MAP', cdu: 'CDU', ovhd: 'UPPER CONSOLE', lcon: 'LOWER CONSOLE', sysp: 'SYSTEM' };
  const SCR_SIZE = { pfd: [640, 900], m3d: [1280, 760], map: [900, 760], cdu: [460, 860], ovhd: [760, 940], lcon: [680, 940], sysp: [900, 600] };
  function popoutScreen(k) {
    if (!SCR_TITLE[k]) return false;
    const side = 'scr-' + k;
    if (wins.some(w => w.side === side)) return popoutClose(side);
    let host = gid('po-host-' + k);
    if (!host) {
      host = D.createElement('div'); host.id = 'po-host-' + k; host.className = 'po-screen-host';
      const app = gid('app'); if (!app) return false;
      app.appendChild(host);
    }
    PANEL_ID[side] = host.id; TITLE[side] = SCR_TITLE[k];
    W._scrHost = W._scrHost || {};
    W._scrHost[k] = true;
    try { if (typeof applyPanels === 'function') applyPanels(); } catch (e) { console.warn('[popout]', e); }
    const ok = popoutOpen(side);
    if (!ok) { delete W._scrHost[k]; relayout(); }
    try { if (typeof simLayoutSync === 'function') simLayoutSync(); } catch (e) { /* 무시 */ }
    return ok;
  }
  function popoutScreens() { return wins.filter(w => w.side.indexOf('scr-') === 0).map(w => w.side.slice(4)); }
  function popoutCloseAll() { wins.slice().forEach(w => popoutClose(w.side)); }

  // 새 창 안에 있는 3D 지도(본 화면·CHIN 창)를 곧바로 다시 그린다
  function popoutRedrawMaps(win) {
    const maps = [];
    try { if (typeof _ml3d !== 'undefined' && _ml3d) maps.push(_ml3d); } catch (e) { /* 무시 */ }
    try { if (typeof _chinMaps !== 'undefined') _chinMaps.forEach(c => maps.push(c.map)); } catch (e) { /* 무시 */ }
    maps.forEach(m => {
      try { const c = m.getContainer(); if (c && c.ownerDocument === win.document && m.redraw) m.redraw(); }
      catch (e) { /* 무시 */ }
    });
  }
  function popoutToggle(side) {
    return wins.some(w => w.side === side) ? popoutClose(side) : popoutOpen(side);
  }

  // 3분할을 끄면 가운데 패널은 본 창으로 되돌린다(2분할에는 가운데 자리가 없다)
  setInterval(() => {
    if (typeof tripleMode !== 'undefined' && !tripleMode && wins.some(w => w.side === 'mid')) popoutClose('mid');
    if (typeof quadMode !== 'undefined' && !quadMode && wins.some(w => w.side === 'bot')) popoutClose('bot');
  }, 500);
  // 본 창을 닫으면 새 창도 닫는다(혼자 남은 새 창은 움직이지 않는다)
  W.addEventListener('pagehide', () => { wins.slice().forEach(w => { try { w.win.close(); } catch (e) { /* 무시 */ } }); });

  // 조이스틱 — 새 창에 포커스가 있으면 본 창에 패드가 안 올라오는 브라우저가 있어 새 창 쪽도 본다
  function popoutGamepads() {
    const out = [];
    live().forEach(w => {
      try { const g = w.win.navigator.getGamepads && w.win.navigator.getGamepads(); if (g) out.push(...Array.from(g).filter(Boolean)); }
      catch (e) { /* 무시 */ }
    });
    return out;
  }
  function popoutSides() { return wins.map(w => w.side); }

  W.popoutOpen = popoutOpen; W.popoutTop = popoutTop; W.popoutClose = popoutClose; W.popoutToggle = popoutToggle;
  W.popoutGamepads = popoutGamepads; W.popoutSides = popoutSides;
  W.popoutScreen = popoutScreen; W.popoutScreens = popoutScreens; W.popoutCloseAll = popoutCloseAll; W.POPOUT_SCREENS = SCR_TITLE;
})();
