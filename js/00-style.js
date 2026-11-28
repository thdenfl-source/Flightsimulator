// 00-style.js — 앱 화면 꾸밈(CSS). index.html 이 너무 커서 따로 뺐다 — <head> 에서 곧바로 <style> 로 넣는다
//   (<link rel=stylesheet> 로 따로 읽으면 새 창 · 늘 위 창(Document PiP)으로 꾸밈을 옮겨 붙일 때 파일로 연 앱(file://)이 멈추기도 했다 —
//    <style> 이면 예전 index.html 안의 꾸밈과 똑같이 돈다)
// 고칠 때: 아래 CSS 안에 역따옴표(`) · 역빗금(\) · '${' 를 쓰지 않는다(글 묶음이 깨진다 — 필요하면 \5C 같은 CSS 이스케이프로)
(function () {
  const st = document.createElement('style'); st.id = 'app-style';
  st.textContent = String.raw`
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  background: #000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-user-select: none; user-select: none;
  touch-action: none;
  position: relative;
}
#app {
  position: absolute;
  inset: 0;
  display: grid;
  overflow: hidden;
}
/* Divider between the two panels — 가운데 그립을 드래그해 분할 비율 조절 */
#panel-divider {
  background: #2a2a2a;
  z-index: 2000;
  flex-shrink: 0;
  position: relative;
}
#divider-grip, #divider-grip-2 {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  z-index: 2001; cursor: col-resize; touch-action: none; user-select: none;
  background: rgba(15,20,28,0.92); border: 1px solid #4a90d9; border-radius: 6px;
  color: #7ab8f5; font-size: 12px; font-weight: bold; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
#divider-grip:active, #divider-grip-2:active { background: #1a3a5a; color: #fff; }
@media (orientation: landscape) {
  #divider-grip, #divider-grip-2 { width: 26px; height: 56px; }
  #divider-grip::before, #divider-grip-2::before { content: '◀▶'; letter-spacing: -2px; }
}
@media (orientation: portrait) {
  #divider-grip, #divider-grip-2 { width: 56px; height: 26px; cursor: row-resize; }
  #divider-grip::before, #divider-grip-2::before { content: '▲▼'; }
}
@media (orientation: landscape) {
  #app { display: flex; flex-direction: row; }
  #left-panel  { flex: 1 1 0; min-width: 100px; overflow: hidden; }
  #right-panel { flex: 1 1 0; min-width: 80px; overflow: hidden; }
  /* PFD를 표시하는 패널은 FCP 버튼이 전부 보이도록 넓은 쪽(55%)을 차지 */
  #left-panel.pfd-host, #right-panel.pfd-host { flex: 0 0 55%; }
  #panel-divider { width: 2px; height: 100%; }
}
@media (orientation: portrait) {
  #app { display: flex; flex-direction: column; }
  #left-panel  { flex: 1 1 0; min-height: 100px; overflow: hidden; }
  #right-panel { flex: 1 1 0; min-height: 80px; overflow: hidden; }
  #left-panel.pfd-host, #right-panel.pfd-host { flex: 0 0 55%; }
  #panel-divider { height: 2px; width: 100%; }
}
/* 사용자가 분할 비율을 지정하면 좌측만 고정폭이 되고 우측은 남은 공간을 채운다.
   (PFD 호스트의 flex:0 0 55%가 함께 걸리면 합이 100%를 넘어 우측이 잘리므로 무효화) */
#app.split-custom #right-panel { flex: 1 1 0; }

/* ── 3분할(PFD·MAP·CDU) ─────────────────────────────────────────── */
#mid-panel { display: none; flex-direction: column; overflow: hidden; }
#divider-2 { display: none; background: #2a2a2a; z-index: 2000; flex-shrink: 0; position: relative; }
#divider-grip-2 { display: none; }
#app.triple #mid-panel { display: flex; }
#app.triple #divider-2 { display: block; }
#app.triple #divider-grip-2 { display: flex; }
/* 3분할 배분 — 좌·중은 --tri-l/--tri-m 로 고정하고 우측이 남은 공간을 채운다.
   기본값은 PFD 호스트가 1.4배 넓은 배분으로 JS가 계산해 넣고,
   그립을 드래그하면 그 값만 바뀐다(2분할의 splitRatio 와 같은 방식). */
#app.triple #left-panel  { flex: 0 0 var(--tri-l, 33.333%) !important; }
#app.triple #mid-panel   { flex: 0 0 var(--tri-m, 33.333%) !important; }
#app.triple #right-panel { flex: 1 1 0 !important; }
@media (orientation: landscape) { #divider-2 { width: 2px; height: 100%; } }
@media (orientation: portrait)  { #divider-2 { height: 2px; width: 100%; } }
/* ── 패널 새 창(00-popout.js) — 새 창으로 옮긴 패널 자리의 구분선을 감추고 남은 패널이 나눠 갖는다 ── */
#app.po-left #panel-divider { display: none; }
#app.po-mid #divider-2, #app.po-right #divider-2 { display: none; }
#app.po-right:not(.triple) #panel-divider, #app.po-mid.po-right #panel-divider { display: none; }
#app.po-any > #left-panel, #app.po-any > #mid-panel, #app.po-any > #right-panel { flex: 1 1 0 !important; }
#app.po-any > #left-panel.po-a, #app.po-any > #mid-panel.po-a, #app.po-any > #right-panel.po-a { flex: 0 0 var(--po-a, 50%) !important; }   /* 둘 남으면 경계를 끌어 비율을 고른다 */
/* 화면 배치 — 단독 화면 버튼은 탭에서 뺀다(기능은 남김) */
#pfd-solo-btn, #m3d-solo-btn, #map-solo-btn, #cdu-solo-btn { display: none !important; }
/* 3D Only 는 우측 창 탭에 — 2분할·3분할 어느 쪽이든 보인다 */
/* Top(늘 위 창) 버튼 — 본 창에서 누르면 그 패널을 곧바로 늘 위 창으로, 새 창에서 누르면 새 창의 패널을 늘 위 창으로 */
/* ── 4분할 — 왼쪽 두 창(PFD · 3D)은 높이를 다 쓰고, 오른쪽 열을 위(MAP)·아래(CDU)로 나눈다 ──
   비율은 --q1(1열 폭) · --q2(2열 폭) · --q3(3열 위 창 높이) — 경계 그립(.qgrip)을 끌어 바꾼다 */
#bot-panel { display: none; flex-direction: column; overflow: hidden; }
#app.quad { display: grid !important; grid-template-columns: var(--q1, 36%) var(--q2, 32%) minmax(0, 1fr);
            grid-template-rows: var(--q3, 55%) minmax(0, 1fr); gap: 2px; background: #2a2a2a; }
#app.quad > #panel-divider, #app.quad > #divider-2 { display: none !important; }
#app.quad > #left-panel  { grid-area: 1 / 1 / 3 / 2; min-width: 0; min-height: 0; }
#app.quad > #mid-panel   { grid-area: 1 / 2 / 3 / 3; min-width: 0; min-height: 0; display: flex; }
#app.quad > #right-panel { grid-area: 1 / 3 / 2 / 4; min-width: 0; min-height: 0; }
#app.quad > #bot-panel   { grid-area: 2 / 3 / 3 / 4; display: flex; min-width: 0; min-height: 0; }
.qgrip { display: none; position: absolute; z-index: 2001; touch-action: none; user-select: none;
         background: rgba(15,20,28,0.92); border: 1px solid #4a90d9; border-radius: 6px; color: #7ab8f5;
         font: bold 12px 'Helvetica Neue', Arial, sans-serif; align-items: center; justify-content: center; }
#app.quad > .qgrip { display: flex; }
.qgrip.v { width: 22px; height: 56px; transform: translate(-50%, -50%); top: 50%; cursor: col-resize; }
.qgrip.v::before { content: '◀▶'; letter-spacing: -2px; }
.qgrip.h { width: 56px; height: 22px; transform: translate(-50%, -50%); cursor: row-resize; }
.qgrip.h::before { content: '▲▼'; }
#qgrip-1 { left: var(--q1, 36%); }
#qgrip-2 { left: calc(var(--q1, 36%) + var(--q2, 32%)); }
#qgrip-3 { top: var(--q3, 55%); left: calc((var(--q1, 36%) + var(--q2, 32%) + 100%) / 2); }
#left-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#left-tabs, #mid-tabs {
  display: flex;
  background: #080808;
  border-bottom: 1px solid #1e1e1e;
  flex-shrink: 0;
}
#pfd-wrap {
  position: relative; background: #000; overflow: hidden;
  flex: 1;
}
#pfd { display: block; }
#right-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#page-tabs {
  display: flex;
  background: #080808;
  border-bottom: 1px solid #1e1e1e;
  flex-shrink: 0;
}
/* 탭 바(좌·중·우 공통): 버튼 동일 크기 + 흰 테두리 */
/* iOS 상태바(시계·배터리)와 겹치지 않도록 상단 safe-area 여백 추가 */

#left-tabs { padding-left: calc(4px + env(safe-area-inset-left)); }
#page-tabs { padding-right: calc(4px + env(safe-area-inset-right)); }
.page-tab {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.75);
  border-radius: 0;
  color: #ccc;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap; overflow: hidden;
  transition: color 0.15s, background 0.15s;
}
/* 탭 버튼 높이 고정 — 라벨에 한글·기호가 섞이면 줄 상자 높이가 달라져
   패널마다 탭 바 높이가 어긋나고, 3분할에서 상단선이 안 맞는다 */
.page-tab, #reload-btn, #home-btn {
  height: 28px; padding: 0 2px; line-height: 1; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
}
#reload-btn {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.75);
  border-radius: 0;
  color: #5aaefd;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  touch-action: manipulation;
  transition: color 0.15s, background 0.15s;
}
#reload-btn:hover { color: #fff; background: #06141f; }
#home-btn { flex: 1; min-width: 0; background: transparent; border: 1px solid rgba(255,255,255,0.75); border-radius: 0;
            color: #ffd23a; font-size: 14px; font-weight: bold; cursor: pointer; touch-action: manipulation; }
#home-btn:hover { color: #fff; background: #06141f; }
#ctl3d #reload3d-btn { color: #5aaefd; }
#reload-btn:active { transform: rotate(180deg); }
.page-tab.active {
  color: #00ff88;
  background: #081808;
  box-shadow: inset 0 -2px 0 #00ff88;
}
/* ── 창 위 탭 줄 — 왼쪽 · 가운데 · 오른쪽 · 아래 넷이 모두 같은 모양 · 같은 차례 ──
   ① 화면 탭(누르면 이 창에 그 화면): CDU · MAP · UPPER · LOWER · SYSTEM · CONTROL(왼쪽 창은 PFD · SYSTEM)
      화면마다 제 색 — 어느 줄에서나 같다. 고른 화면은 그 색 바탕 + 밑줄
   ② 동작 단추(오른쪽 끝에 모아): ⛶ Cockpit · 분할 · 창 배치 · ⧉ POP UP · 📌 Top · ⌂ · ⟳ — 둥근 작은 단추로 화면 탭과 구분
   ③ 그 줄에 이름이 다 안 들어가면 화면 탭은 줄임말(UPR · LWR · SYS · CTRL), 동작 단추는 기호만(이름은 마우스를 올리면) */
#left-tabs, #mid-tabs, #page-tabs, #bot-tabs {
  display: flex; align-items: center; gap: 4px; padding: 4px; padding-top: calc(4px + env(safe-area-inset-top));
  background: #080808; border-bottom: 1px solid #1e1e1e; flex-shrink: 0;
}
.page-tab[data-sel] { --tc: #ccc; color: var(--tc); flex: 1 1 0; letter-spacing: 1px; }
.page-tab[data-sel="pfd"]  { --tc: #5aaefd; }
.page-tab[data-sel="map"]  { --tc: #00e07a; }
.page-tab[data-sel="cdu"]  { --tc: #c084fc; }
.page-tab[data-sel="ovhd"] { --tc: #f5b942; }
.page-tab[data-sel="lcon"] { --tc: #2fd3c3; }
.page-tab[data-sel="sysp"] { --tc: #d5dde6; }
.page-tab[data-sel="grip"] { --tc: #ff8a50; }
.page-tab[data-sel].active { color: var(--tc); background: #111; background: color-mix(in srgb, var(--tc) 16%, #000); box-shadow: inset 0 -2px 0 var(--tc); }
.page-tab[data-sel]:hover:not(.active) { background: color-mix(in srgb, var(--tc) 8%, #000); }
.page-tab.tab-act, #home-btn.tab-act, #reload-btn.tab-act {
  flex: 0 0 auto !important; min-width: 28px; padding: 0 8px !important; border: 1px solid #2c4a66; border-radius: 5px;
  background: #0a1520; color: #7ab8f5 !important; letter-spacing: 0.5px; font-size: 11px;
}
.page-tab.tab-act:hover, #home-btn.tab-act:hover, #reload-btn.tab-act:hover { background: #12263a; color: #fff !important; }
.page-tab.tab-act.active { background: #12263a; box-shadow: inset 0 -2px 0 #7ab8f5; }
.page-tab.po-top-btn { display: flex !important; color: #ffd200 !important; }
.po-top-btn.on { background: #3a3000 !important; }
#home-btn.tab-act { color: #ffd23a !important; font-size: 14px; }
#reload-btn.tab-act { color: #5aaefd !important; font-size: 14px; }
/* 첫 동작 단추 앞에 사이를 조금 더 — 화면 탭 묶음과 동작 단추 묶음을 눈으로 가른다 */
.page-tab[data-sel] ~ .tab-act { margin-left: 2px; }
/* 줄마다 제 폭에 다 들어가는지 재어(07-sim.js tabsFit) 넘치면 .tabs-compact → 그래도 넘치면 .tabs-tight */
.tabs-measure > * { flex: 0 0 auto !important; }
.tabs-compact > .page-tab[data-short] { font-size: 0 !important; letter-spacing: 0 !important; }
.tabs-compact > .page-tab[data-short]::after { content: attr(data-short); font-size: 11px; letter-spacing: 0.5px; }
.tabs-compact > .page-tab.tab-act { padding: 0 6px !important; }
.tabs-compact > .page-tab.tab-act[data-short]::after { font-size: 13px; }
.tabs-tight > .page-tab[data-sel] { padding: 0 1px; }
.tabs-tight > .page-tab[data-short]::after { font-size: 10px; letter-spacing: 0; }
.tabs-tight > .page-tab.tab-act { padding: 0 4px !important; min-width: 24px; }
#left-tabs.tabs-tight, #mid-tabs.tabs-tight, #page-tabs.tabs-tight, #bot-tabs.tabs-tight { gap: 2px; }
.tabs-tight > #home-btn.tab-act, .tabs-tight > #reload-btn.tab-act { min-width: 22px; padding: 0 3px !important; font-size: 12px; }
/* 촘촘하게 해도 넘치면(아주 좁은 창) 이름을 자르지 않고 줄을 옆으로 밀어 본다(스크롤 막대는 감춤) */
.tabs-scroll { overflow-x: auto; scrollbar-width: none; }
.tabs-scroll::-webkit-scrollbar { display: none; }
.tabs-scroll > * { flex: 0 0 auto !important; }
.tabs-scroll > .page-tab[data-sel] { min-width: 30px; }
.page-tab.fullscreen-tab { color: #facc15; }
.page-tab.fullscreen-tab:hover { color: #fff; background: #1a1500; }
.page-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
}
.page-hidden { display: none !important; }
#cdu-wrap {
  background: #111;
  overflow: hidden;
}

.ctrl-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0,0,0,0.88);
  border-top: 1px solid #2a2a2a;
  z-index: 20;
}
/* ── PFD 소프트키(터치바, 07-sim.js) — 실기 PFD 아래 12칸 · 켜진 칸은 아래 녹색 바 ── */
#pfd-sk { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; padding: 3px 4px; background: #111418; border-bottom: 1px solid #2a2f35; }
.pfd-sk { position: relative; min-width: 0; height: 34px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(#5b6168, #33383e 55%, #262a2f); border: 1px solid #0b0c0e; border-radius: 3px; cursor: pointer;
  color: #fff; font: bold 9px/1.05 'Helvetica Neue', Arial, sans-serif; text-align: center; user-select: none; -webkit-user-select: none; overflow: hidden; }
.pfd-sk span { pointer-events: none; }
.pfd-sk em { font-style: normal; color: #00e5ff; font-size: 9px; pointer-events: none; }
.pfd-sk i { position: absolute; left: 22%; right: 22%; bottom: 2px; height: 3px; border-radius: 1px; background: transparent; pointer-events: none; }
.pfd-sk.on i { background: #22e022; }
.pfd-sk.ackw { animation: skAckW 1s steps(1) infinite; } .pfd-sk.ackc { animation: skAckC 1s steps(1) infinite; }
@keyframes skAckW { 0% { background: #c01010; color: #fff; } 50% { background: #222; color: #ff5050; } }
@keyframes skAckC { 0% { background: #ffb000; color: #000; } 50% { background: #222; color: #ffb000; } }
.pfd-sk:active { background: linear-gradient(#2a6a8a, #1a3a52); }
.pfd-sk.none { cursor: default; }
.pfd-sk.none:active { background: linear-gradient(#5b6168, #33383e 55%, #262a2f); }
.pfd-sk.dim, .pfd-sk.off { color: #7d848b; }
.pfd-sk.off { pointer-events: none; }
/* ── FCP(07-sim.js) — 실기 AFCS 조작 패널 모양 + 오른쪽 사용자 기능 영역. 옛 FCP 줄은 모두 없앴다 ──
   폭이 모자라면 오른쪽 영역(fks-x)이 아래 줄로 내려간다 */
#fcp-simple { display: flex; flex-wrap: wrap; align-items: stretch; justify-content: center; gap: 8px; padding: 6px 10px 6px;
  background: linear-gradient(#1a1d21, #0e1013); border-top: 1px solid #3a3f46; }
.fks-l { display: grid; grid-template-columns: repeat(6, minmax(44px, 62px)); row-gap: 4px; column-gap: 4px; }
.fks-r { display: grid; grid-template-columns: repeat(2, minmax(44px, 62px)); row-gap: 4px; column-gap: 4px; }
.fks-div { width: 2px; background: #9aa3ad; margin: 4px 2px; border-radius: 1px; }
.fks-main { display: flex; gap: 8px; align-items: stretch; }
.fks-x { display: flex; gap: 8px; align-items: stretch; }
.fks-xw { display: flex; flex-direction: column; justify-content: space-between; gap: 4px; }
.fks-xr { display: flex; flex-direction: column; justify-content: space-between; gap: 6px; }
.fks-xr1, .fks-xr2 { display: flex; align-items: center; justify-content: center; gap: 10px; }
.fks-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; user-select: none; -webkit-user-select: none; }
.fks-lbl { color: #e8edf2; font: bold 10px 'Helvetica Neue', Arial, sans-serif; letter-spacing: .3px; white-space: nowrap; height: 12px; }
.fks-knob { position: relative; width: 38px; height: 38px; border-radius: 50%; touch-action: none;
  background: radial-gradient(circle at 40% 35%, #4a5058, #1c1f23 70%); border: 2px solid #8d969f; box-shadow: 0 0 0 3px #22262b, 0 2px 4px #000; }
.fks-cell.on .fks-knob { border-color: #22e022; box-shadow: 0 0 0 3px #123a12, 0 0 6px #22e022; }
.fks-dn, .fks-up { position: absolute; top: 0; bottom: 0; width: 50%; display: flex; align-items: center; color: #cfd6dc; font-size: 15px; cursor: pointer; }
.fks-dn { left: 0; justify-content: flex-start; padding-left: 3px; border-radius: 19px 0 0 19px; }
.fks-up { right: 0; justify-content: flex-end; padding-right: 3px; border-radius: 0 19px 19px 0; }
.fks-dn:active, .fks-up:active { background: rgba(0, 200, 255, 0.22); }
.fks-push { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; z-index: 1;
  background: radial-gradient(circle at 40% 35%, #8b939b, #3a3f45); border: 1px solid #0a0a0a; cursor: pointer; }
.fks-push:active { background: #00b4e6; }
.fks-sq { width: 40px; height: 30px; margin-top: 4px; border: 2px solid #8d969f; border-radius: 3px; background: linear-gradient(#26292d, #121417); cursor: pointer; }
.fks-sq.framed { box-shadow: 0 0 0 3px #1a1d21, 0 0 0 4px #6b737b; }
.fks-sq:active { background: #00b4e6; }
.fks-sq.on { border-color: #22e022; background: linear-gradient(#1d4a1d, #0f2a0f); box-shadow: 0 0 6px #22e022; }
.fks-sq.arm { border-color: #ffffff; box-shadow: 0 0 5px #ffffffaa; }   /* NAVD CPL 무장(흰) — 조건에 들면 녹색으로 */
.fks-none { opacity: .45; cursor: default; pointer-events: none; }
.fks-val { color: #00e5ff; font: bold 9px 'Helvetica Neue', Arial, sans-serif; height: 11px; }
.ctrl-sub-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
}
.ctrl-group { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.ctrl-lbl { color: #bbb; font-size: 10px; letter-spacing: 0.5px; font-family: 'Helvetica Neue', Arial, sans-serif; }
/* 누를 수 있는 FCP 라벨(IAS/HDG/CRS): 현재값 동기화 버튼 */
.ctrl-lbl-btn {
  cursor: pointer; color: #8ac6ff; border: 1px solid #2a4a6a; border-radius: 3px;
  padding: 0 6px; background: rgba(20,35,55,0.6); touch-action: manipulation; user-select: none;
}
.ctrl-lbl-btn:active { background: #2a4a7a; color: #fff; }
.ctrl-lbl-btn.flash { background: #1a5a2a; border-color: #00cc66; color: #7fffb0; }
.ctrl-row { display: flex; gap: 2px; }
.cbtn {
  background: #1c2c1c; border: 1px solid #2a5a2a; color: #fff;
  font-size: 14px; width: 34px; height: 28px; cursor: pointer;
  border-radius: 3px; display: flex; align-items: center; justify-content: center;
  touch-action: manipulation; -webkit-user-select: none;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
.cbtn:active { background: #2e4a2e; }

/* ── Stopwatch ── */
.sw-group {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  border: 1px solid #2a3a2a; border-radius: 4px; padding: 3px 6px;
}
.sw-display {
  color: #00ff88; font-size: 15px; letter-spacing: 2px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; min-width: 76px; text-align: center;
}
.sw-btns { display: flex; gap: 3px; }
.sw-btn {
  background: #1a2e1a; border: 1px solid #2a6a2a; color: #fff;
  font-size: 11px; padding: 3px 8px; cursor: pointer; border-radius: 3px;
  touch-action: manipulation; font-family: 'Helvetica Neue', Arial, sans-serif;
}
.sw-btn:active { background: #264426; }
.sw-btn.run { border-color: #00ff88; color: #00ff88; }
/* 스톱워치 ↔ 현재 시각 전환 버튼 */
.sw-btn-time { border-color: #2a4a6a; color: #7ab8f5; }
.sw-btn-time:active { background: #1a2c44; }
/* ── SIM 모드 버튼 ── ALT 유지 버튼 무리 오른쪽. 켜짐은 AFCS 계열과 구분되게 호박색. */
.sim-mode-group { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-left: 6px; }
.sim-mode-btn {
  background: #111; border: 1px solid #333; color: #555;
  font-size: 11px; font-weight: bold; letter-spacing: 1px;
  min-width: 44px; padding: 5px 10px; cursor: pointer; border-radius: 3px;
  touch-action: manipulation; font-family: 'Helvetica Neue', Arial, sans-serif;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sim-mode-btn.on {
  background: #2a1a00; border-color: #ffb74d; color: #ffcc66;
  box-shadow: 0 0 6px rgba(255,183,77,0.45);
}
.sw-display.clock-mode { color: #7ab8f5; }

/* ── BRG Toggle ── */
.brg-tog-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.brg-tog-btns { display: flex; gap: 2px; }
.brg-tog-btn {
  background: #1a1a1a; border: 1px solid #333; color: #888;
  font-size: 10px; padding: 3px 6px; cursor: pointer; border-radius: 2px;
  touch-action: manipulation; white-space: nowrap; font-family: 'Helvetica Neue', Arial, sans-serif;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.brg-tog-btn.brg1-on { background: #0e1e3a; border-color: #44aaff; color: #44aaff; }
.brg-tog-btn.brg2-on { background: #001a00; border-color: #00cc44; color: #00cc44; }
/* 이름표 토글(#1BDP·#2BDP) — 니들 토글보다 한 단계 작게 두어 종속 관계를 보인다 */
.brg-tog-btn.brg-bdp { font-size: 8px; padding: 2px 5px; letter-spacing: 0.3px; }
.brg-tog-btn.brg-bdp.brg1-on { background: #0e1e3a; border-color: #44aaff; color: #44aaff; }
.brg-tog-btn.brg-bdp.brg2-on { background: #001a00; border-color: #00cc44; color: #00cc44; }

/* ── NAV Source ── */
.nav-src-group { display: flex; flex-direction: column; align-items: center; gap: 1px; }
/* NAV SRC 와 RNP 는 한 덩어리로 붙여 둔다 — 사이가 벌어지면 다른 그룹처럼 보인다.
   튜닝 VOR 라벨(빈 줄일 때가 대부분)이 사이를 벌리던 자리도 같이 줄인다. */
.nav-src-group .nav-icao-lbl { margin-top: 0; min-height: 10px; line-height: 10px; }
.nav-src-group .rnp-lbl { margin-top: -1px; font-size: 9px; line-height: 10px; }
.nav-src-group .rnp-btns { margin-top: 1px; }
.nav-src-btns { display: flex; gap: 2px; }
.nav-src-btn {
  background: #1a1a2e; border: 1px solid #2a2a5a; color: #ccc;
  font-size: 11px; padding: 3px 6px; cursor: pointer; border-radius: 2px;
  touch-action: manipulation; white-space: nowrap;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
.nav-src-btn.active { background: #0e1e3e; border-color: #4488ff; color: #fff; }
.nav-icao-sel {
  background: #0e1e2e; border: 1px solid #1a4a6a; color: #fff;
  font-size: 10px; padding: 1px 3px; border-radius: 2px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 70px;
}
/* NAV1/NAV2 튜닝 VOR 표시 라벨(PFD NAV SRC 하단) */
.nav-icao-lbl {
  color: #44aaff; font-size: 10px; font-weight: bold; letter-spacing: 0.5px;
  text-align: center; margin-top: 1px; min-height: 12px; line-height: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ── RNP ── */
.rnp-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.rnp-btns { display: flex; gap: 2px; }
.rnp-btn {
  background: #1a2a1a; border: 1px solid #2a4a2a; color: #ccc;
  font-size: 11px; padding: 3px 5px; cursor: pointer; border-radius: 2px;
  touch-action: manipulation; font-family: 'Helvetica Neue', Arial, sans-serif;
}
.rnp-btn.active { background: #0e2e0e; border-color: #44aa44; color: #fff; }

/* ── SIM SPD (배속) ── */
.simspd-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
/* ×1 ×2 / ×4 ×8 두 줄로 접는다 — 옆의 SUSP 와 높이를 맞추기 위해서다 */
.simspd-grid { display: grid; grid-template-columns: repeat(2, auto); gap: 2px; }
.simspd-btns { display: flex; gap: 2px; }
.simspd-btn {
  background: #2a1a2a; border: 1px solid #4a2a4a; color: #ccc;
  font-size: 11px; padding: 3px 5px; cursor: pointer; border-radius: 2px;
  touch-action: manipulation; font-family: 'Helvetica Neue', Arial, sans-serif;
}
/* 실시간(×1)은 평상시라 눈에 띄지 않게, 빨라진 상태는 확실히 보이게 */
.simspd-btn.active { background: #2e0e2e; border-color: #cc66ff; color: #fff; }
#simspd-1.active { background: #1e1e1e; border-color: #666; color: #aaa; box-shadow: none; }
#simspd-2.active, #simspd-4.active, #simspd-8.active { box-shadow: 0 0 6px rgba(204,102,255,0.45); }

/* ── SUSP (시퀀싱 보류) ──
   켜져 있으면 활성 웨이포인트를 지나도 다음으로 넘어가지 않는다.
   배속과는 상관없는 기능이라 이름표(SUSP)를 따로 세우고, 버튼에는 'On' 만 적는다.
   켜짐/꺼짐은 AP 의 NAV·OBS 버튼과 같은 색으로 보인다(꺼지면 회색, 켜지면 녹색) —
   같은 뜻의 표시는 같은 색이어야 눈이 헷갈리지 않는다.
   홀딩·미스드어프로치에서 저절로 켜지면(auto) '자동' 을 덧붙여 구분한다. */
.susp-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.susp-btn {
  background: #111; border: 1px solid #333; color: #555;
  font-size: 11px; font-weight: bold; letter-spacing: 1px;
  min-width: 46px; padding: 5px 10px; cursor: pointer; border-radius: 3px;
  touch-action: manipulation; font-family: 'Helvetica Neue', Arial, sans-serif;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  line-height: 1.15;
}
.susp-btn:active { background: #0a1a0a; }
/* NAV·OBS 버튼(.obs-btn.on)과 같은 녹색 */
.susp-btn.on, .susp-btn.auto {
  background: #001a00; border-color: #00cc44; color: #00ee66;
  box-shadow: 0 0 6px rgba(0,200,68,0.45);
}
/* 저절로 걸린 것은 '자동' 을 덧붙여 손으로 켠 것과 구분한다 */
.susp-btn .susp-auto { display: block; font-size: 7px; letter-spacing: 0; opacity: 0.85; }

/* ── divider ── */
.ctrl-div { width: 1px; height: 34px; background: #2a2a2a; margin: 0 2px; }

/* ── Hover Page / GSPD / Trim ── */
.hover-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
/* HOVER PAGE / HOVER POS 는 두 줄로 쌓아 폭을 줄인다 */
.hover-btns { display: flex; flex-direction: column; gap: 2px; align-items: stretch; }
.hover-btns > button { width: 100%; padding: 2px 6px; }
/* 모드 토글 버튼 공통(HOVER PAGE·HOVER POS·CRHT·ALT HOLD) */
.hover-btn, .hover-pos-btn, .crht-btn, .alt-hold-btn {
  background: #1a1a1a; border: 1px solid #333; color: #555;
  font-size: 10px; font-weight: bold; padding: 3px 6px; cursor: pointer; border-radius: 2px;
  touch-action: manipulation; white-space: nowrap; font-family: 'Helvetica Neue', Arial, sans-serif;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.hover-btn:disabled, .hover-pos-btn:disabled {
  opacity: 0.35; cursor: not-allowed;
}
.hover-btn.on     { background: #1a0e2e; border-color: #cc66ff; color: #cc66ff; }
.hover-pos-btn.on { background: #2e2a0e; border-color: #ffcc00; color: #ffcc00;
                    box-shadow: 0 0 6px rgba(255,204,0,0.45); }
.crht-btn.on     { background: #0e2e1a; border-color: #44ff88; color: #44ff88;
                   box-shadow: 0 0 6px rgba(44,255,100,0.4); }
.alt-hold-btn.on { background: #0e1a2e; border-color: #00cfff; color: #00cfff;
                   box-shadow: 0 0 6px rgba(0,200,255,0.4); }
/* FCP 라벨 겸 모드 버튼(ALT·CRHT) — 걸려 있으면 그 모드 색 */
.mode-lbl-btn.on { background: #0e2e1a; border-color: #44ff88; color: #44ff88; box-shadow: 0 0 6px rgba(44,255,100,0.4); }
#alt-hold-btn.on { background: #0e1a2e; border-color: #00cfff; color: #00cfff; box-shadow: 0 0 6px rgba(0,200,255,0.4); }
.td-col { gap: 3px; justify-content: center; }
.td-col > button { width: 100%; }
.tdown-btn.flash { background: #0e2e1a; border-color: #44ff88; color: #44ff88; }
.tdown-btn.on    { background: #0e2e1a; border-color: #44ff88; color: #44ff88; box-shadow: 0 0 6px rgba(44,255,100,0.4); }
.alt-hold-group  { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.alt-hold-btns   { display: flex; gap: 2px; }

.trim-group { display: flex; align-items: center; gap: 6px; }
.trim-pad {
  /* 좌측에 COLLECTIVE TRIM을 두기 위해 폭을 2/3로 (160 → 107px) */
  position: relative; width: 107px; height: 54px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
}
.trim-cell {
  background: #1a1a2a; border: 1px solid #333; color: #aaa;
  font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 2px;
  touch-action: manipulation; display: flex; align-items: center; justify-content: center;
  user-select: none; -webkit-user-select: none;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  transition: background 0.1s;
}
.trim-cell:active { background: #2a2a4a; color: #fff; }
.trim-cell.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.trim-cell.tc-fwd { grid-column: 2; grid-row: 1; }
.trim-cell.tc-aft { grid-column: 2; grid-row: 2; }
.trim-cell.tc-l   { grid-column: 1; grid-row: 1 / span 2; }
.trim-cell.tc-r   { grid-column: 3; grid-row: 1 / span 2; }
/* 원형 모드 버튼 공통(FORCE TRIM·GSPD) — 실제 조종간 배치에 맞춘 자리 */
.force-trim-btn, .gspd-btn {
  width: 48px; height: 48px; border-radius: 50%;
  background: #1a1a1a; border: 2px solid #555; color: #888;
  font-size: 9px; font-weight: bold; cursor: pointer;
  touch-action: manipulation; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.force-trim-btn:active { background: #2a2a4a; }
.ftr-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ga-btn { width: 40px; height: 22px; border-radius: 11px; background: #1a1a1a; border: 2px solid #555; color: #9aa4ae;
          font: bold 10px 'Helvetica Neue', Arial, sans-serif; cursor: pointer; touch-action: manipulation; padding: 0; }
.ga-btn:active { background: #1a2a1a; }
.ga-btn.on { border-color: #00ff88; color: #00ff88; box-shadow: 0 0 6px rgba(0,255,136,0.4); }
.force-trim-btn.active { border-color: #cc66ff; color: #cc66ff; }
.force-trim-btn.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.gspd-btn:active { background: #2a1a1e; }
.gspd-btn.on     { background: #2e0e1a; border-color: #ff6688; color: #ff8899;
                   box-shadow: 0 0 6px rgba(255,80,120,0.4); }

/* ── COLLECTIVE TRIM (파워 조작) ── */
/* 지금은 VS ▲▼와 같은 동작. 상위모드 해제 기능이 들어가면 파워(출력) 직접 제어로 확장한다. */
/* 조작부 이름표 공통(4-WAY TRIM · COLLECTIVE TRIM · ANTI-TORQUE PEDAL) */
.coll-lbl, .pedal-lbl, .trim-lbl {
  color: #7a8a99; font-size: 8px; font-weight: bold; letter-spacing: 0.3px;
  text-align: center; line-height: 1.1; white-space: nowrap;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
/* 이름표가 붙는 조작부 3종은 같은 높이로 두고 이름표는 위, 본체는 아래에 붙인다.
   → 이름 줄과 조작부 아랫변이 각각 한 줄로 맞는다 */
.trim-padgroup, .coll-group, .pedal-group {
  display: flex; flex-direction: column; align-items: center;
  height: 74px; justify-content: space-between;
}
.coll-btns { display: flex; flex-direction: column; gap: 2px; }
.coll-btn {
  width: 34px; height: 25px; border-radius: 4px;
  background: #12181e; border: 2px solid #3a4a5a; color: #9fb4c4;
  font-size: 13px; font-weight: bold; cursor: pointer;
  touch-action: manipulation; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
.coll-btn:active { background: #1e3040; border-color: #4dd0e1; color: #4dd0e1; }

/* ── ANTI-TORQUE PEDAL (요 조작) ── */
.pedal-btns { display: flex; gap: 3px; }
.pedal-btn {
  width: 34px; height: 34px; border-radius: 6px;
  background: #12181e; border: 2px solid #3a4a5a; color: #9fb4c4;
  font-size: 14px; font-weight: bold; cursor: pointer;
  touch-action: manipulation; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}
.pedal-btn:active { background: #1e3040; border-color: #4dd0e1; color: #4dd0e1; }

/* ── OBS button ── */
.obs-btn {
  background: #111; border: 1px solid #333; color: #555;
  font-size: 11px; font-weight: bold; padding: 5px 10px;
  border-radius: 3px; cursor: pointer; touch-action: manipulation;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1px; transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.obs-btn:active { background: #0a1a0a; }
.obs-btn.on {
  background: #001a00; border-color: #00cc44; color: #00ee66;
  box-shadow: 0 0 6px rgba(0,200,68,0.45);
}
/* GSPD 작동 중 — 조향 지령이 먹지 않는 상태. 켜짐 색은 유지하되 빗금으로 표시 */
.obs-btn.ap-inh {
  opacity: 0.45; border-style: dashed; box-shadow: none;
  background-image: repeating-linear-gradient(135deg,
    rgba(255,255,255,0.12) 0 3px, transparent 3px 6px);
}

/* ── Map area ── */
#map-wrap {
  position: relative; overflow: hidden;
  flex: 1;
}
/* 지도는 상단 80%, 하단 20%는 TERRAIN CUT 패널이 차지(겹침 없음) */
#map { width: 100%; height: 80%; transform-origin: center center; }
/* HDG↑ — 회전해도 모서리가 비지 않도록 '보이는 영역의 대각선' 을 한 변으로 하는
   정사각형으로 키운다(크기·위치는 JS 가 재서 넣는다). 확대(scale)가 아니라서
   축척이 그대로다. 넘치는 부분은 #map-wrap 이 잘라 낸다. */
#map.hdg-rot { position: absolute; }
#map-wrap { overflow: hidden; }
#map3d {
  position: absolute; top: 0; left: 0; right: 0; height: 80%;
  display: none; z-index: 800;   /* above Leaflet panes (~700), below top bars (1000) */
}
#map3d.active { display: block; }
/* 창 하나를 통째로 쓰는 3D — 지도 위에 겹치는 모드와 달리 창을 가득 채운다 */
#map3d-wrap { overflow: hidden; position: relative; }
#map3d.panel-3d {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  height: 100%; display: block; z-index: 1;
}
#map3d.panel-3d .maplibregl-ctrl-bottom-right { bottom: 10px; }
#map3d.panel-3d .vfr-scale { bottom: 10px; }
/* 확대·나침반 · 기울기 버튼은 축척(왼쪽 아래 · 축척은 bottom 62px 로 직접 놓인다 — 04-map.js) 바로 위 — 아래 #map3d 규칙 그대로 */
#ext-btn { display: none; position: absolute; top: 72px; right: 8px; z-index: 900; padding: 5px 10px; }
/* SIM 1인칭 — 화면 아래 가운데의 기수(높이 1/10 · 둘러보기를 하면 그만큼 비켜 간다) */
#sim-nose { display: none; position: absolute; left: 50%; bottom: 0; width: 34%; height: 10%;
            transform: translateX(-50%); z-index: 3; pointer-events: none; }
#sim-nose.show { display: block; }
#sim-nose svg { display: block; width: 100%; height: 100%; }
#ext-btn.show { display: block; }
#ext-btn.on { color: #00e5ff; border-color: #00e5ff; }
#fly3d-btn { position: absolute; top: 104px; right: 8px; z-index: 900; padding: 5px 10px; }
/* MG(Slaved)/DG — 방향 기준(07-sim.js toggleHdgRef). 3D 창(FLY 아래)·지도 창(툴바 아래)에 같은 버튼.
   누를 때마다 바뀌고, DG 일 때만 −/+(HSI 1°)가 살아 있고 자기 나침반(COMP)이 보인다 */
.hdgref { position: absolute; right: 8px; z-index: 900; width: 86px;
          display: flex; flex-direction: column; gap: 3px; }
.hdgref .sim-btn { flex: none; }
.hdgref .hdgref-btn { padding: 5px 4px; }
.hdgref.dg .hdgref-btn { color: #ffb000; border-color: #ffb000; }
.hdgref-adj { display: flex; gap: 3px; }
.hdgref-adj .sim-btn { flex: 1; padding: 3px 0; font-size: 15px; line-height: 1; }
.hdgref-adj .sim-btn:disabled { opacity: 0.35; cursor: default; }
.hdgref-comp { display: none; padding: 2px 0; border-radius: 3px; text-align: center;
               background: rgba(0,0,0,0.75); color: #ffb000;
               font: bold 10px 'Helvetica Neue', Arial, sans-serif; }
.hdgref.dg .hdgref-comp { display: block; }
#snd-btn { position: absolute; top: 136px; right: 8px; z-index: 900; padding: 5px 10px; }
#pfdov-btn { position: absolute; top: 168px; right: 8px; z-index: 900; padding: 5px 10px; }
#hdgref-3d { top: 200px; }
#rotor-3d { position: absolute; right: 8px; top: 310px; z-index: 900; width: 86px; display: flex; flex-direction: column; gap: 3px; }
#rotor-3d .sim-btn { flex: none; padding: 4px 2px; font-size: 11px; }
#rotor-3d .sim-btn.on { color: #00e07a; border-color: #00e07a; }
#rotor-3d .rotor-dir { display: flex; gap: 3px; }
#rotor-3d .rotor-dir .sim-btn { flex: 1; }
#rotor-3d .rotor-dir .sim-btn:disabled { opacity: 0.35; cursor: default; }
#rotor-3d .rc-opts { display: flex; flex-direction: column; gap: 2px; }
#rotor-3d .rc-opt { padding: 2px 2px !important; font-size: 9px !important; color: #777; }
#rotor-3d .rc-opt.on { color: #00e07a; border-color: #00e07a; }
#rotor-3d .rc-opt:disabled { opacity: 0.35; cursor: default; }
#ase-3d { display: flex; flex-direction: column; gap: 3px; }
#ctl3d #eng-3d.warn { color: #ffb000; border-color: #ffb000; }
#ctl3d #eng-3d.fail { color: #ff4040; border-color: #ff4040; }
#ase-3d .sim-btn.on { color: #00e07a; border-color: #00e07a; }
#ase-3d .ase-hf { padding: 2px 0; border: 1px solid #333; border-radius: 3px; text-align: center;
                  background: rgba(0,0,0,0.75); color: #555; font: bold 9px 'Helvetica Neue', Arial, sans-serif; }
#ase-3d .ase-hf.avail { color: #9aa4ae; border-color: #556; }
#ase-3d .ase-hf.on { color: #00e07a; border-color: #00e07a; }
#hdgref-map { top: 48px; }
#simmap-btn { position: absolute; right: 8px; top: 140px; width: 86px; z-index: 900; padding: 5px 4px; }
#map-wrap.map3d-on #simmap-btn { display: none; }
.sim-side-btn.on { color: #00e07a !important; border-color: #00e07a !important; }
#ctl3d #solo-half-btn { position: static !important; transform: none !important; width: 100%; display: block; margin-top: 3px; padding: 5px 4px; font-size: 11px; }
/* 출발 공항 고르기(09-cdu.js openStartAirportPicker) */
.ui-dlg.start-apt { width: min(560px, 94vw); max-width: min(560px, 94vw); }
.start-apt-sub { font-size: 12px; color: #9aa4ae; }
.start-apt-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px;
                  max-height: min(52vh, 420px); overflow-y: auto; margin: 0 18px 12px; }
.start-apt-btn { padding: 8px 6px; background: #10161d; border: 1px solid #2c3a48; color: #d6dde4;
                 border-radius: 6px; text-align: left; cursor: pointer; font-size: 13px; }
.start-apt-btn b { color: #7fd4ff; margin-right: 4px; }
.start-apt-btn:hover, .start-apt-btn:focus { border-color: #4aa8ff; background: #14212e; }
.start-apt-skip { padding: 7px 12px; }
/* 2D 위에 겹쳐 쓸 때는 지도 툴바 아래로 */
#map-wrap #q3d-btn { top: 48px; }
#map-wrap #ext-btn { top: 112px; }
#map-wrap #fly3d-btn { top: 144px; }
#map-wrap #snd-btn { top: 176px; }
#map-wrap #pfdov-btn { top: 208px; }
#map-wrap #hdgref-3d { top: 240px; }
#map-wrap #rotor-3d { top: 350px; }

/* ── 3D 조작 버튼 묶음(#ctl3d) — 오른쪽 한 줄, 너비는 가장 넓은 버튼(MG (Slaved)·회전익 특성)에 맞춘다 ── */
#ctl3d { position: absolute; top: 8px; right: 8px; z-index: 900; width: 96px;
         display: flex; flex-direction: column; gap: 3px;
         max-height: calc(100% - 16px); box-sizing: border-box; }
#map-wrap #ctl3d { top: 48px; max-height: calc(100% - 56px); }
/* 창이 낮아 버튼이 아래로 넘치면 묶음 안에서 위아래로 밀어 올려 누른다(터치 · 휠) */
#ctl3d-body { display: flex; flex-direction: column; gap: 3px;
              flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
              overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y;
              scrollbar-width: thin; }
#ctl3d-body > * { flex-shrink: 0; }
#ctl3d.collapsed #ctl3d-body { display: none; }
#ctl3d-tog { padding: 3px 4px; font-size: 11px; color: #9aa4ae; }
#ctl3d .sim-btn, #ctl3d .hdgref, #ctl3d #rotor-3d, #ctl3d #ase-3d {
  position: static !important; top: auto !important; right: auto !important;
  width: 100%; box-sizing: border-box; margin: 0; }
#ctl3d > #ctl3d-body > .sim-btn, #ctl3d-tog { padding: 5px 4px; text-align: center; }
#ctl3d .fcp-btn-row { display: flex; gap: 3px; }
#ctl3d .snd-vol-row { align-items: center; }
#ctl3d .snd-vol-row .sim-btn { flex: 0 0 26px; padding: 3px 0; font-size: 14px; line-height: 1; }
#snd-vol-v { flex: 1; text-align: center; font: bold 11px 'Helvetica Neue', Arial, sans-serif; color: #9aa4ae;
             background: rgba(0,0,0,0.75); border: 1px solid #333; border-radius: 3px; padding: 3px 0; }
#snd-vol.on #snd-vol-v { color: #00e07a; border-color: #00e07a; }
#ctl3d .fcp-btn-row .sim-btn { flex: 1; width: auto; padding: 5px 0; }
#ctl3d .fcp-btn-row .sim-btn.on { color: #ffb000; border-color: #ffb000; }
#ctl3d .fcp-btn-row .sim-btn.dim { opacity: 0.45; }
/* 3D 화면의 FCP — 왼쪽 아래 한 창 */
.fcp3d { display: none; position: absolute; bottom: 0; z-index: 802;   /* 크기는 04-map.js _fcpFit(너비 ≤ 1/2 · 높이 ≤ 45%) */
         background: rgba(10,12,15,0.92); border: 2px solid #1d232b; border-radius: 10px 10px 0 0;
         box-shadow: 0 0 10px rgba(0,0,0,0.6); overflow: hidden; box-sizing: border-box; }
.fcp3d.show { display: block; }
.fcp3d-l { left: 0; } .fcp3d-r { right: 0; }
.fcp3d .fcp3d-in { position: absolute; top: 0; bottom: auto; left: auto; right: auto; width: max-content; padding: 2px 4px; border-top: none; background: transparent; }
.fcp3d-l .fcp3d-in { left: 0; transform-origin: top left; }
.fcp3d-r .fcp3d-in { right: 0; transform-origin: top right; }
.fcp3d .ctrl-sub-row { flex-wrap: nowrap; }
.fcp3d .ctrl-sub-row > #pfd-sk { flex: 1 1 100%; min-width: 0; }   /* 소프트키 줄은 FCP 패널 폭에 맞춘다 */
#ctl3d #ckpit-btn { display: none; }
#ctl3d #ckpit-op { display: none; align-items: center; }
#ctl3d #ckpit-op.show { display: flex; }
#ctl3d #ckpit-op span { flex: 1.2; text-align: center; font: bold 11px Helvetica, Arial, sans-serif; color: #9fe8ff; }
#ctl3d #ckpit-btn.show { display: block; }
#ctl3d #ckpit-btn.on { color: #00e5ff; border-color: #00e5ff; }
/* 조종석 패널(15-heli3d.js) — 3D 지도 안에 겹친다(버튼 줄 아래). 바닥 쪽은 비어 땅이 보인다 */
#sim-ckpit { display: none; position: absolute; inset: 0; z-index: 4; pointer-events: none; }
#sim-ckpit.show { display: block; }
#sim-ckpit > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0.45; }   /* 틀·구조는 반투명 — 스크린(canvas)만 또렷하다 */
#ck-heels { position: absolute; inset: 0; display: none; pointer-events: none; }   /* HEELS 등 — 조종석 테두리 녹색 띠(15-heli3d.js _ckHeelsSync) */
#ck-heels.on { display: block; }
#ck-heels svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#ck-heels path { fill: none; stroke: #39ff6a; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 6px #39ff6a) drop-shadow(0 0 14px rgba(57,255,106,0.7)); }
#sim-ckpit canvas.ck-scr { position: absolute; display: block; background: #000; }
#ctl3d #lconc-btn, #ctl3d #upperc-btn { display: none; }
#ctl3d #lconc-btn.show, #ctl3d #upperc-btn.show { display: block; }
#ctl3d #lconc-btn.on, #ctl3d #upperc-btn.on { color: #00e5ff; border-color: #00e5ff; }
/* 조종석 안의 작은 콘솔(상부 · 하부) — 누르면 크게 띄운다. 작은 콘솔 자체는 조작하지 않는다 */
#sim-ckpit { overflow: hidden; }
#sim-ckpit .ck-con { position: absolute; pointer-events: auto; cursor: zoom-in; overflow: hidden;
                     border: 1px solid #0a0b0c; border-radius: 3px; background: #15171a; }
#sim-ckpit .ck-con > * { pointer-events: none; }
/* CDU — 하부 콘솔 오른쪽 칸(작아도 그대로 누른다) */
/* 조종석 CDU(작은 칸 · 팝아웃) — #cdu-ov 를 칸에 꼭 맞춘다 */
.ck-con > #cdu-ov.ck-in, #ck-pop-host > #cdu-ov.ck-in { position: absolute; inset: 0; width: auto; height: auto; min-height: 0;
                     aspect-ratio: auto; border: 0; border-radius: 0; box-shadow: none; z-index: auto; }
/* 조종석 안 작은 CDU — CDU 를 제 크기(354×567)로 그린 뒤 통째로 줄인다(작은 칸에 맞춰 다시 배치하면 그림이 엉킨다).
   줄이는 배율 --ckk 는 15-heli3d.js 가 칸 너비로 정한다. 작은 칸은 누르면 팝아웃이라 그대로 조작하지는 않는다 */
.ck-con > #cdu-ov.ck-in { right: auto; bottom: auto; width: 354px; height: 567px; min-width: 0;
                          transform: scale(var(--ckk, 0.25)); transform-origin: 0 0; }
/* 팝아웃 층 — 3D 지도 바로 뒤, 3D 지도 칸에 꼭 맞춘다(15-heli3d.js _ckLayer) */
/* 조종석 와이퍼(15-heli3d.js) — 밑동을 축으로 쓸어 움직인다. LOW 1.6초 · HI 0.9초 한 번 왕복 · WASH 는 LOW 로 쓸며 물이 나온다 */
#sim-ckpit .ck-wipe { transform-box: view-box; }
#ck-wipe-l { transform-origin: 742px 512px; }
#ck-wipe-r { transform-origin: 858px 512px; }
@keyframes ckWipeL { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-48deg); } }
@keyframes ckWipeR { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(48deg); } }
#sim-ckpit.wipe-low #ck-wipe-l, #sim-ckpit.wipe-wash #ck-wipe-l { animation: ckWipeL 1.6s ease-in-out infinite; }
#sim-ckpit.wipe-low #ck-wipe-r, #sim-ckpit.wipe-wash #ck-wipe-r { animation: ckWipeR 1.6s ease-in-out infinite; }
#sim-ckpit.wipe-hi #ck-wipe-l { animation: ckWipeL 0.9s ease-in-out infinite; }
#sim-ckpit.wipe-hi #ck-wipe-r { animation: ckWipeR 0.9s ease-in-out infinite; }
#sim-ckpit .ck-water { display: none; }
#sim-ckpit.wipe-wash .ck-water { display: inline; }
#sim-ckpit .ck-jet { stroke: #d8f1ff; stroke-width: 16; stroke-linecap: round; fill: none; opacity: 0.55;
                     stroke-dasharray: 4 10; animation: ckJet 0.4s linear infinite; }
#sim-ckpit .ck-drop { fill: #e6f6ff; animation: ckDrop 0.6s ease-out infinite; }
@keyframes ckJet { to { stroke-dashoffset: -28; } }
@keyframes ckDrop { 0% { opacity: 0.95; } 100% { opacity: 0.1; } }
#ck-layer { position: absolute; z-index: 960; pointer-events: none; }   /* 겹친 계기(#pfd-ov 950)보다 위 */
#ck-layer.ck-off { display: none; }
.ck-con > #ovhd-wrap, .ck-con > #lcon-wrap, #ck-pop-host > .page-content:not(.page-hidden), #ck-pop-host > #pfd-wrap:not(.page-hidden) {
  display: block !important; position: absolute; inset: 0; width: auto; height: auto; }
.ck-con .ov-reset-btn, .ck-con .ov-zones-btn { display: none; }
/* 콘솔 팝아웃 — 3D 화면 가운데에 크게(버튼 줄은 가리지 않게) */
#ck-pop { display: none; position: absolute; z-index: 1; flex-direction: column; pointer-events: auto;
          background: #101214; border: 1px solid #3a3e43; border-radius: 6px; box-shadow: 0 4px 24px rgba(0,0,0,0.7); }
#ck-pop.show { display: flex; }
/* PFD 팝아웃 — 옆으로 편다: 계기는 왼쪽(HSI 까지), FCP 는 오른쪽 세로 칸(03-pfd.js pfdFcpSide) */
#pfd-wrap.fcp-side .ctrl-bar { left: auto; top: 0; bottom: auto; right: 0; width: 44%; max-height: 100%; overflow-y: auto;
                               border-top: 0; border-left: 1px solid #2a2a2a; }
/* PFD 팝아웃 — FCP 아래 남는 칸에 2D 지도(MAP 창 그대로 · 15-heli3d.js ckPopMapSync) — 지도만 남기고 위아래 버튼 줄은 감춘다 */
#ck-pop-mapslot { display: none; position: absolute; z-index: 25; overflow: hidden; background: #000; border-left: 1px solid #2a2a2a; border-top: 1px solid #2a2a2a; }
#ck-pop-mapslot.show { display: block; }
#ck-pop-mapslot > #map-wrap { display: block !important; position: absolute; inset: 0; width: auto; height: auto; }
#ck-pop-mapslot > #map-wrap > *:not(#map) { display: none !important; }
#ck-pop-mapslot > #map-wrap > #map { position: absolute; inset: 0; width: 100%; height: 100%; }
/* MFD 화면도 누르면 크게 띄운다 */
#sim-ckpit canvas.ck-scr { pointer-events: auto; cursor: zoom-in; }
#ck-pop .ck-pop-sz, #kg-pop .ck-pop-sz { margin-left: auto; margin-right: 6px; display: flex; gap: 3px; }   /* 팝아웃 크기 − · + (15-heli3d.js ckPopScale) */
#ck-pop .ck-pop-sz .sim-btn, #kg-pop .ck-pop-sz .sim-btn { padding: 1px 9px; min-width: 0; }
#ck-pop .ck-pop-bar { flex: none; display: flex; align-items: center; justify-content: space-between;
                      padding: 3px 6px 3px 10px; color: #cfd6dc; font: bold 12px Arial, sans-serif; letter-spacing: 1px; }
#ck-pop .ck-pop-bar .sim-btn { position: static; flex: none; width: auto !important; min-width: 0; padding: 2px 12px; }
#ck-pop-host { flex: 1; position: relative; min-height: 0; }
#ctl3d #ext-btn { display: none; }
#ctl3d #ext-btn.show { display: block; }
#ctl3d #extcam-3d { display: none; flex-direction: column; gap: 3px; width: 100%; }
#ctl3d #extcam-3d.show { display: flex; }
#extcam-3d .extcam-row { display: flex; gap: 3px; }
#ctl3d #extcam-3d .extcam-row .sim-btn { flex: 1; width: auto; padding: 4px 0; font-size: 11px; }
#extcam-info { text-align: center; font: bold 9px 'Helvetica Neue', Arial, sans-serif; color: #00e5ff;
               background: rgba(0,0,0,0.7); border-radius: 3px; padding: 2px 0; }
/* SIM 이 켜지면 축척과 우하단 3D 확대·기울기 버튼을 감춘다 */
#map3d.sim3d .vfr-scale, #map3d.sim3d .maplibregl-ctrl-bottom-right,
#map3d.sim3d .maplibregl-ctrl-bottom-left, #map3d.sim3d #tilt-ctrl { display: none !important; }
/* 3D 를 지도 위에 겹쳐 쓰면 3D 쪽 버튼만 둔다 */
#map-wrap.map3d-on #hdgref-map { display: none; }
/* When 3D is on, hide the 2D Leaflet map so its panes never paint through */
#map-wrap.map3d-on #map { visibility: hidden; }
#layer-btn-3d { background: rgba(0,10,30,0.82); border: 1px solid #333; color: #aaa; }
#layer-btn-3d.active { background: rgba(0,30,80,0.92); border-color: #4488ff; color: #88ccff; box-shadow: 0 0 8px rgba(68,136,255,0.4); }
#follow-btn.active { background: rgba(60,30,0,0.92); border-color: #ffaa00; color: #ffcc44; box-shadow: 0 0 8px rgba(255,170,0,0.4); }
#tilt-ctrl {
  position: absolute; bottom: 118px; left: 48px; right: auto; z-index: 900;   /* 확대·나침반 버튼 오른쪽, 축척 위 */
  display: none; flex-direction: column; gap: 0;
}
#tilt-ctrl.active { display: flex; }
#tilt-ctrl button {
  width: 29px; height: 29px; background: #fff;
  border: 0; border-bottom: 1px solid #ddd; color: #333;
  font-size: 15px; line-height: 1; cursor: pointer; padding: 0;
}
#tilt-ctrl button:first-child { border-radius: 4px 4px 0 0; }
#tilt-ctrl button:last-child { border-radius: 0 0 4px 4px; border-bottom: 0; }
#tilt-ctrl button:hover { background: #f0f0f0; }
/* Lift the 3D zoom/tilt controls above the bottom SHIP/sim bar */
/* #map3d 는 높이 80%라 하단 가장자리가 이미 terrain-cut 위에 있음 → px만 올림 */
#map3d .maplibregl-ctrl-bottom-right { bottom: 44px; }
/* 좌하단: 축척(bottom 62px) 바로 위에 확대·나침반 버튼 */
#map3d .maplibregl-ctrl-bottom-left { bottom: 108px; }
/* 3D 축척(.vfr-scale)은 #map3d에 직접 절대배치(left:10px, bottom:62px).
   maplibre 기본값이 섞이지 않도록 박스 스타일을 2D와 동일하게 명시 */
#map3d .vfr-scale {
  box-shadow: none;
  background: rgba(0,0,0,0.65); padding: 4px 7px 3px; border-radius: 3px;
  display: inline-block;
}
/* 3D 모드: 우하단 FDR/REC 버튼을 zoom/tilt 컨트롤 위로 올려 겹침 방지 */
#map-wrap.map3d-on #fdr-btn-wrap { bottom: calc(20% + 175px); }
/* Dual-unit map scale bar (km + NM) */
.vfr-scale {
  background: rgba(0,0,0,0.65);
  padding: 4px 7px 3px;
  border-radius: 3px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  line-height: 1.5;
  pointer-events: none;
}
.vfr-scale-row { display: flex; align-items: center; gap: 5px; }
.vfr-scale-bar {
  height: 4px;
  border: 1px solid;
  border-top: none;
  flex-shrink: 0;
}
.vfr-scale-km  { border-color: #fff;    background: #fff; }
.vfr-scale-nm  { border-color: #00cfff; background: #00cfff; }
/* Push Leaflet bottom controls above the sim bar.
   #map 높이가 80%라 하단 가장자리가 이미 terrain-cut(하단 20%) 위에 있으므로
   bottom:0 기준 + margin 만 준다(20%를 또 더하면 축척이 좌표 위로 밀려 올라감). */
/* 좌하단 세로 순서: 축척 → 좌표(20%+44px) */
#map-wrap .leaflet-bottom.leaflet-left  { margin-bottom: 62px; bottom: 0; }
#map-wrap .leaflet-bottom.leaflet-right { margin-bottom: 44px; bottom: 0; }
/* ── Solo (single-screen) mode ── */
#solo-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 3000;
  display: flex;
  background: rgba(0,0,0,0.88);
  border-bottom: 1px solid #333;
  height: calc(36px + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  align-items: stretch;
}
#solo-bar button {
  flex: 1;
  background: transparent;
  border: none;
  border-right: 1px solid #222;
  color: #555;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  touch-action: manipulation;
  transition: color 0.15s, background 0.15s;
}
#solo-bar button:last-child { border-right: none; }
#solo-bar button.solo-active {
  color: #00ff88;
  background: #081808;
  box-shadow: inset 0 -2px 0 #00ff88;
}
/* ✕(분할화면 복귀)는 우측 상단 끝에 배치 */
#solo-bar button.solo-exit {
  flex: 0 0 40px;
  color: #ff4444;
  font-size: 15px;
  font-weight: bold;
  border-left: 2px solid #ff4444;
  border-right: none;
  background: rgba(80,0,0,0.5);
}
#solo-bar button.solo-exit:hover { color: #fff; background: #aa0000; }
/* solo-bar tab colors (PFD/MAP/PLAN/CDU가 1~4번째, ✕는 마지막) */
#solo-bar button:nth-child(1)        { color: #5aaefd; }
#solo-bar button:nth-child(1).solo-active { color: #5aaefd; box-shadow: inset 0 -2px 0 #5aaefd; }
#solo-bar button:nth-child(2)        { color: #00e07a; }
#solo-bar button:nth-child(2).solo-active { color: #00e07a; box-shadow: inset 0 -2px 0 #00e07a; }
#solo-bar button:nth-child(3)        { color: #ffaa33; }
#solo-bar button:nth-child(3).solo-active { color: #ffaa33; box-shadow: inset 0 -2px 0 #ffaa33; }
#solo-bar button:nth-child(4)        { color: #c084fc; }
#solo-bar button:nth-child(4).solo-active { color: #c084fc; box-shadow: inset 0 -2px 0 #c084fc; }
/* 전체화면(solo)에서는 상단 바를 모두 숨기고 계기가 화면을 꽉 채움
   (내비게이션은 하단 푸터 Home/Half/Plan 으로) */
body.solo-mode #app {
  position: fixed;
  top: env(safe-area-inset-top); bottom: 0; left: 0; right: 0;
}
/* solo 모드에서 패널 자체 탭바(page-tabs/left-tabs) 숨김 — solo-bar와 중복 */
body.solo-mode #page-tabs,
body.solo-mode #left-tabs { display: none !important; }
/* solo 전용 상단 스위처 바도 숨김(하단 푸터로 대체) */
body.solo-mode #solo-bar { display: none !important; }
/* 전체화면에서 MAP/PFD 등 하단 푸터가 없는 화면용 떠 있는 HALF 버튼 */
#solo-half-btn {
  display: none;
  position: fixed;
  top: calc(env(safe-area-inset-top) + 58px);   /* 상단 툴바(공역 등) 아래로 */
  right: calc(env(safe-area-inset-right) + 10px);
  z-index: 3500;
  background: rgba(10,15,22,0.92);
  border: 1px solid #4a90d9;
  border-radius: 7px;
  color: #7ab8f5;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px; font-weight: bold; letter-spacing: 1px;
  padding: 7px 12px;
  cursor: pointer; touch-action: manipulation;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5);
}
#solo-half-btn:active { background: #1a3a5a; color: #fff; }
body.solo-mode #solo-half-btn.show { display: block; }
/* 3D 단독 — 오른쪽 위는 3D 버튼(화질·EXT·FLY·SOUND·MG/DG) 자리라 위 가운데에 띄운다 */
body.solo-mode #solo-half-btn.show.m3d { top: calc(env(safe-area-inset-top) + 8px); right: auto; left: 50%; transform: translateX(-50%); }
/* Solo mode: one panel fills everything */
body.solo-mode #left-panel,
body.solo-mode #right-panel {
  display: none;
}
body.solo-mode #panel-divider { display: none; }
/* 3분할이 기본이므로 단독 화면에서는 가운데 창과 두 번째 경계선도 접는다 */
body.solo-mode #mid-panel,
body.solo-mode #app.triple #mid-panel,
body.solo-mode #divider-2,
body.solo-mode #app.triple #divider-2 { display: none; }
/* 3분할은 창 폭을 #app.triple #left-panel 처럼 세게 지정한다. 단독 화면에서는
   남은 한 창이 전부를 차지해야 하므로 여기서 그보다 세게 다시 잡는다. */
body.solo-mode #app.triple #left-panel,
body.solo-mode #app.triple #mid-panel,
body.solo-mode #app.triple #right-panel { flex: 1 1 0 !important; width: 100% !important; }
body.solo-mode .solo-panel-visible {
  display: flex !important;
  flex-direction: column;
  width: 100% !important;
  height: 100% !important;
  flex: 1 !important;
}

/* ── 지도 중앙 십자마크 ──
   지도(#map)는 높이 80%(하단 20%는 terrain-cut)이므로 지도의 실제 세로 중앙은
   맵랩의 40% 지점이다. leafMap.getCenter()(좌표 표시 기준)와 일치하도록 top:40%. */
#map-crosshair {
  position: absolute; left: 50%; top: 40%;
  width: 0; height: 0; z-index: 500; pointer-events: none;   /* 마커 페인(600)보다 아래 → 헬기 아이콘이 위에 표시 */
}
#map-crosshair .ch-h, #map-crosshair .ch-v {
  position: absolute; background: #ff1744;
  box-shadow: 0 0 2px rgba(0,0,0,0.8);
}
#map-crosshair .ch-h { left: -11px; top: -1px; width: 22px; height: 2px; }
#map-crosshair .ch-v { left: -1px; top: -11px; width: 2px; height: 22px; }
/* ── 중앙 좌표 표시 (좌하단 최하단: 축척 → 좌표) ── */
#center-coord {
  position: absolute; bottom: calc(20% + 44px); left: 10px; z-index: 1100;
  background: rgba(0,0,0,0.72); border: 1px solid #444; border-radius: 4px;
  padding: 3px 7px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 10px; font-weight: bold; line-height: 1.4; color: #ffd54f; white-space: nowrap;
  pointer-events: none;
}
/* FDR upload button — above Leaflet zoom control (bottom-right) */
#fdr-btn-wrap {
  position: absolute; bottom: calc(20% + 120px); right: 10px; z-index: 1000;
}
#fdr-btn {
  display: block; width: 36px;
  background: rgba(20,20,20,0.88); border: 1px solid #444; border-radius: 4px;
  color: #ccc; font-size: 10px; font-weight: bold; font-family: 'Helvetica Neue', Arial, sans-serif;
  padding: 6px 2px; text-align: center; cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
#fdr-btn:hover    { background: rgba(0,30,60,0.92); border-color: #4488ff; color: #88ccff; }
#rec-btn {
  display: block; width: 36px; margin-bottom: 4px;
  background: rgba(20,20,20,0.88); border: 1px solid #444; border-radius: 4px;
  color: #ccc; font-size: 10px; font-weight: bold; font-family: 'Helvetica Neue', Arial, sans-serif;
  padding: 6px 2px; text-align: center; cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
#rec-btn:hover  { background: rgba(60,0,0,0.92); border-color: #ff4444; color: #ff8888; }
#rec-btn.active {
  background: rgba(90,0,0,0.92); border-color: #ff4444; color: #ff6666;
  animation: recblink 1.2s infinite;
}
@keyframes recblink { 0%,100%{ box-shadow: 0 0 6px rgba(255,68,68,0.7);} 50%{ box-shadow: none;} }
#fdr-btn.active   { background: rgba(0,30,80,0.92); border-color: #4488ff; color: #88ccff;
                    box-shadow: 0 0 8px rgba(68,136,255,0.4); }
/* FDR panel */
#fdr-panel {
  display: none; position: absolute; bottom: calc(20% + 165px); right: 10px; z-index: 1100;
  width: 220px; background: rgba(8,12,20,0.96); border: 1px solid #2a4a7a;
  border-radius: 6px; padding: 8px; color: #ccc;
  font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px;
}
#fdr-panel.open { display: block; }
#fdr-panel-title {
  color: #7ab8f5; font-size: 10px; font-weight: bold; letter-spacing: 1px;
  border-bottom: 1px solid #1a3050; padding-bottom: 5px; margin-bottom: 7px;
  display: flex; justify-content: space-between; align-items: center;
}
#fdr-file-row { display: flex; gap: 4px; margin-bottom: 6px; }
#fdr-file-row label {
  flex: 1; background: rgba(0,20,50,0.9); border: 1px solid #2a4a7a;
  border-radius: 4px; padding: 5px 6px; cursor: pointer; text-align: center;
  color: #88ccff; font-size: 10px;
}
#fdr-file-row label:hover { border-color: #4488ff; }
#fdr-status {
  font-size: 10px; color: #aaa; min-height: 14px; margin-bottom: 5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#fdr-track-info {
  font-size: 10px; color: #7ab8f5; margin-bottom: 6px; display: none;
}
#fdr-controls { display: none; gap: 4px; }
#fdr-controls button {
  flex: 1; background: rgba(0,20,50,0.9); border: 1px solid #2a4a7a;
  border-radius: 4px; padding: 4px 2px; color: #88ccff;
  font-size: 11px; cursor: pointer;
}
#fdr-controls button:hover  { border-color: #4488ff; }
#fdr-controls button.active { background: rgba(0,40,100,0.9); border-color: #4488ff; }
#fdr-speed { display: none; align-items: center; gap: 4px; margin-top: 5px; font-size: 10px; }
#fdr-speed label { color: #aaa; }
#fdr-speed select {
  background: rgba(0,20,50,0.9); border: 1px solid #2a4a7a;
  border-radius: 3px; color: #88ccff; font-size: 10px; padding: 2px;
}
#fdr-timeline { display: none; margin-top: 5px; }
#fdr-timeline input[type=range] { width: 100%; accent-color: #4488ff; }
/* ── Map top button bar ── */
/* 3D 화면에 겹쳐 띄우는 계기 — 3D 화면 왼쪽 위(가로 1/4 · 높이 3/5). 좁은 창에서는 읽을 만큼은
   키우되(가로 300px) 오른쪽 3D 버튼 줄(화질·FLY·SOUND·계기·MG/DG)은 가리지 않는다.
   FCP 없이 계기만 — 비행에 몰입하도록. 3D 창의 '계기' 버튼으로 켜고 끈다(07-sim.js pfdOverlayDraw).
   지도를 끌거나 확대하는 손이 막히지 않게 눌림은 3D 지도로 흘려보낸다 */
#pfd-ov { display: none; position: absolute; left: 8px; top: 46px; width: 25%; height: 60%;
          min-width: min(300px, calc(100% - 120px)); min-height: min(360px, 85%);
          z-index: 950; background: #000; border: 1px solid #333; border-radius: 4px;
          overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.6); pointer-events: none; }
#pfd-ov.show { display: block; }
/* Bell 206 무게 · 연료(25-b206panel.js b206WbOpen) */
#wb-wrap { display: none; position: fixed; inset: 0; z-index: 30001; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
#wb-wrap .wb-box { width: min(380px, 94vw); background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; padding: 0 0 10px; color: #dfe6ec; font-size: 14px; }
#wb-wrap .wb-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1b2731; border-radius: 8px 8px 0 0; margin-bottom: 6px; }
#wb-wrap .sim-btn { width: auto; flex: none; padding: 4px 12px; margin: 0; }
#wb-wrap label { display: flex; align-items: center; gap: 8px; padding: 4px 12px; }
#wb-wrap label span { flex: 1; } #wb-wrap label em { font-style: normal; color: #8aa0b0; width: 92px; font-size: 12px; }
#wb-wrap input { width: 90px; background: #0b1218; color: #fff; border: 1px solid #3a4a58; border-radius: 4px; padding: 4px 6px; font-size: 14px; text-align: right; }
#wb-wrap .wb-sum { padding: 8px 12px; } #wb-wrap .wb-sum .over { color: #ff5252; }
#wb-wrap .wb-cg { margin-top: 4px; } #wb-wrap .wb-hv { margin-top: 6px; font-size: 13px; }
#wb-wrap .wb-cgbar { position: relative; height: 10px; margin-top: 4px; background: #3a1a1a; border-radius: 3px; }
#wb-wrap .wb-cgbar i { position: absolute; top: 0; bottom: 0; background: #2e7d32; border-radius: 3px; }
#wb-wrap .wb-cgbar b { position: absolute; top: -3px; width: 3px; height: 16px; margin-left: -1px; background: #fff; } #wb-wrap .wb-cgbar b.over { background: #ff5252; }
#wb-wrap .wb-btns { display: flex; justify-content: flex-end; gap: 8px; padding: 0 12px; }
/* 환경(29-env.js) — 시간대 · 시정 · 비 · NVG */
html.env-dusk .maplibregl-canvas { filter: brightness(0.62) sepia(0.25) saturate(0.9); }
html.env-night .maplibregl-canvas { filter: brightness(0.22) saturate(0.5) contrast(1.1); }
html.env-nvg .maplibregl-canvas { filter: grayscale(1) brightness(1.5) contrast(1.25) sepia(1) hue-rotate(55deg) saturate(3.5) !important; }
.env-rain { display: none; position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background-image: repeating-linear-gradient(105deg, rgba(200,215,230,0.0) 0 9px, rgba(200,215,230,0.35) 9px 10px, rgba(200,215,230,0) 10px 23px);
  background-size: 200px 200px; animation: env-rain 0.35s linear infinite; }
#map3d .env-fx { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
/* NVG — 관 시야(40° 둥근 시야 · 3D 지도의 세로 시야 ≈ 37° 라 화면 높이만큼) · 알갱이(scintillation) · 불빛 번짐.
   조종석 계기(#sim-ckpit z 4)는 고글 아래로 보므로 그 밑(z 3)에 깐다 */
#map3d .env-nvg { display: none; position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background: radial-gradient(circle closest-side at 50% 50%, rgba(0,0,0,0) 86%, rgba(0,8,0,0.82) 97%, #000 100%); }
#map3d .env-nvg::after { content: ''; position: absolute; inset: 0; opacity: 0.22; mix-blend-mode: screen;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 1  0 0 0 0 0.5  0 0 0 1.6 -0.55'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>");
  animation: env-nvg-grain 0.5s steps(5) infinite; }
@keyframes env-nvg-grain { 0% { background-position: 0 0; } 20% { background-position: -37px 23px; } 40% { background-position: 51px -61px; } 60% { background-position: -83px -17px; } 80% { background-position: 29px 77px; } 100% { background-position: 0 0; } }
html.env-nvg #map3d .env-nvg { display: block; }
html.env-nvg #map3d .env-fx { filter: grayscale(1) sepia(1) hue-rotate(55deg) saturate(3) brightness(1.35); }
#map3d .env-cloud { position: absolute; inset: 0; pointer-events: none; z-index: 1; opacity: 0; background: radial-gradient(ellipse at 50% 40%, #e8ecef 0%, #c9d0d6 60%, #b3bcc4 100%); }
html.env-night #map3d .env-cloud { background: #10141a; } html.env-dusk #map3d .env-cloud { background: #5a5560; }
html.env-rain1 .env-rain { display: block; opacity: 0.45; } html.env-rain2 .env-rain { display: block; opacity: 0.9; animation-duration: 0.22s; }
@keyframes env-rain { from { background-position: 0 0; } to { background-position: -50px 200px; } }
#env-wrap { display: none; position: fixed; inset: 0; z-index: 30001; background: rgba(0,0,0,0.45); align-items: center; justify-content: center; }
#env-wrap .env-box { width: min(560px, 96vw); background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; padding-bottom: 10px; color: #dfe6ec; font-size: 14px; }
#env-wrap .env-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1b2731; border-radius: 8px 8px 0 0; margin-bottom: 6px; }
#env-wrap .env-row { display: flex; align-items: center; gap: 8px; padding: 5px 12px; }
#env-wrap .env-row > span { width: 72px; flex: none; color: #8aa0b0; } #env-wrap .env-row > div { display: flex; flex-wrap: wrap; gap: 4px; }
#env-wrap .sim-btn { width: auto; flex: none; padding: 4px 10px; margin: 0; } #env-wrap .sim-btn.on { border-color: #00e5ff; color: #00e5ff; }
#env-wrap .env-note { padding: 6px 12px 0; color: #8aa0b0; font-size: 12px; }
/* 훈련 보강 4(33-train4.js) — 브라운아웃 · 도구 메뉴 · 설정 · 다른 기기 연결 · 교통 표식 */
#map3d .env-dust { position: absolute; inset: 0; pointer-events: none; z-index: 2; opacity: 0;
  background: radial-gradient(circle at 30% 70%, rgba(255,255,255,0.25) 0 12%, transparent 30%), radial-gradient(circle at 70% 40%, rgba(255,255,255,0.2) 0 10%, transparent 28%), #c8a76a;
  background-size: 220px 220px, 300px 300px, auto; animation: env-dust 1.6s linear infinite; }
#map3d .env-dust.snow { background-color: #eef1f4; }
@keyframes env-dust { from { background-position: 0 0, 0 0, 0 0; } to { background-position: 220px -60px, -300px 80px, 0 0; } }
/* 훈련 단추(시나리오 · 환경 · 강평 · 교관 화면 · 설정 · 도움말)는 🧰 도구 하나로 모은다 —
   지도 창 아래 단추 줄에 늘어놓으니 칸이 모자라 손톱만 하게 찌그러져 보이지 않았다. 낱 단추는 남겨 두되(검사 · 바로가기) 감춘다 */
.tools-btn { display: inline-block !important; }
#map-scn-btn, #map-env-btn, #map-dbf-btn, #map-ios-btn, #map-help-btn, #map-set-btn, #scn3d-btn, #env3d-btn, #dbf3d-btn { display: none !important; }
#map-tools-btn { flex: none !important; min-width: 64px; padding-left: 8px; padding-right: 8px; white-space: nowrap; }
#tools-menu { display: none; position: fixed; z-index: 30003; background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; padding: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.5); }
#tools-menu .sim-btn { display: block; width: 100%; margin: 3px 0; text-align: left; padding: 8px 12px; font-size: 14px; }
#set-wrap, #rtc-wrap, #diag-wrap, #tileprep-wrap, #iimc-wrap, #bingo-wrap, #radio-wrap, #pm-wrap, #asset-wrap, #wing-wrap { display: none; position: fixed; inset: 0; z-index: 30002; background: rgba(0,0,0,0.45); align-items: center; justify-content: center; }
#set-wrap .set-box, #rtc-wrap .set-box, #diag-wrap .set-box, #tileprep-wrap .set-box, #iimc-wrap .set-box, #bingo-wrap .set-box, #radio-wrap .set-box, #pm-wrap .set-box, #asset-wrap .set-box, #wing-wrap .set-box { width: min(520px, 96vw); max-height: 88vh; overflow-y: auto; background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; color: #dfe6ec; font-size: 14px; padding-bottom: 10px; }
.set-box .set-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1b2731; margin-bottom: 4px; }
.set-box .set-row { display: flex; align-items: center; gap: 8px; padding: 5px 12px; } .set-box .set-row > span { width: 150px; flex: none; color: #8aa0b0; }
.set-box .set-row > div { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; align-items: center; } .set-box .set-gap { width: 10px; } .set-box .set-sum { color: #8aa0b0; font-size: 12px; margin-left: 6px; } .set-box .sim-btn { width: auto; flex: none; padding: 4px 10px; margin: 0; }
.set-box .sim-btn.on { border-color: #00e5ff; color: #00e5ff; } .set-box .set-note { padding: 6px 12px; color: #8aa0b0; font-size: 12px; }
.set-box select { flex: 1; min-width: 0; max-width: 100%; background: #0b1218; color: #fff; border: 1px solid #3a4a58; border-radius: 4px; padding: 5px 6px; font-size: 13px; }
.set-box input[type=text] { flex: 1; min-width: 0; background: #0b1218; color: #fff; border: 1px solid #3a4a58; border-radius: 4px; padding: 5px 8px; font-size: 14px; }
.set-box textarea { width: 100%; height: 70px; background: #0b1218; color: #cfe; border: 1px solid #3a4a58; border-radius: 4px; font: 11px monospace; }
.tfc-mk { pointer-events: none; }
#rtc-wrap .rtc-box { width: min(560px, 96vw); }
/* 교관 기기 연결 요청 — 수락 · 거절(33-train4.js rtcAsk) */
#rtc-ask { display: none; position: fixed; inset: 0; z-index: 30010; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
#rtc-ask .rtc-askbox { width: min(420px, 94vw); background: #121a21; border: 1px solid #00e5ff; border-radius: 8px; color: #dfe6ec; font-size: 15px; padding-bottom: 10px; box-shadow: 0 6px 30px rgba(0,0,0,0.7); }
#rtc-ask .rtc-steps { padding: 10px 14px; line-height: 1.6; }
#rtc-ask .rtc-btns { display: flex; gap: 10px; padding: 6px 12px; }
#rtc-ask .rtc-big { flex: 1 1 0 !important; padding: 12px 10px !important; font-size: 17px !important; margin: 0; width: auto; }
#rtc-wrap .rtc-steps { padding: 6px 14px; line-height: 1.7; font-size: 14px; } #rtc-wrap .rtc-steps b { color: #00e5ff; }
#rtc-wrap .rtc-btns { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 12px; }
#rtc-wrap .rtc-big { flex: 1 1 200px !important; padding: 12px 10px !important; font-size: 16px !important; }
#rtc-wrap .rtc-view { display: flex; flex-direction: column; align-items: center; padding: 6px 12px; }
#rtc-wrap .rtc-qr { background: #fff; padding: 8px; border-radius: 6px; line-height: 0; } #rtc-wrap .rtc-qr svg { width: min(320px, 80vw); height: auto; }
#rtc-wrap .rtc-cam { width: min(360px, 86vw); border-radius: 6px; background: #000; }
#rtc-wrap .rtc-st { font-size: 14px; } #rtc-wrap .rtc-st.ok { color: #7dff3a; }
#rtc-wrap .rtc-txt { padding: 4px 12px; color: #8aa0b0; } #rtc-wrap .rtc-txt summary { cursor: pointer; padding: 4px 0; }
/* 교관 화면(31-ios.js · ?ios=1) — 앱은 감추고 교관 화면만 */
html.ios-mode body > *:not(#ios-root):not(.ui-toast-wrap):not(#rtc-wrap):not(#ios-pages) { display: none !important; }
/* 교관 창 페이지 막대(31-ios.js ⑧) — 교관 · PFD · UPPER · LOWER · CYC · COLL · MAP · COCKPIT */
#ios-pages { display: none; }
html.ios-win #ios-pages { display: flex; position: fixed; left: 0; right: 0; top: 0; height: calc(40px + env(safe-area-inset-top)); z-index: 30005;
  padding-top: env(safe-area-inset-top); background: #0b0f14; border-bottom: 1px solid #1e2732; }
#ios-pages button { flex: 1 1 0; min-width: 0; background: transparent; border: none; border-right: 1px solid #1e2732; color: #9fb4c6; font: bold 13px Arial, sans-serif; cursor: pointer; }
#ios-pages button.on { color: #00e5ff; background: rgba(0,229,255,0.10); box-shadow: inset 0 -3px 0 #00e5ff; }
html.ios-win #simple-bar { display: none !important; }
html.ios-win #gate-overlay, html.ios-win #help-overlay, html.ios-win .ui-dlg-back:has(.start-apt) { display: none !important; }
html.ios-win body.solo-mode #map3d-wrap, html.ios-win body.solo-mode .solo-panel-visible { top: calc(40px + env(safe-area-inset-top)) !important; }
html.ios-win #ios-root { padding-top: 50px; }
html.ios-obs #ios-root [data-ios]:not([data-ios="rtc"]), html.ios-obs #msn-root [data-mact]:not([data-mact="help"]) { opacity: 0.45; pointer-events: none; } html.ios-obs #ios-root::before { content: '👀 관찰 기기 — 보기만 합니다'; display: block; padding: 4px 10px; background: #1d3a52; color: #cfe8ff; font-size: 13px; }
html.ios-win:not(.ios-mode) #ios-root { display: none !important; }
#ios-root .ios-grip { display: none; }
#ios-root.ios-grip-on > :not(.ios-grip) { display: none !important; }
#ios-root.ios-grip-on .ios-grip { display: flex; gap: 16px; justify-content: center; align-items: flex-start; flex-wrap: wrap; touch-action: none; user-select: none; -webkit-user-select: none; }
#ios-root.ios-grip-on { max-width: none; }
.ios-grip .ios-gcell { height: calc(100vh - 80px); max-height: 760px; aspect-ratio: 200 / 400; display: flex; flex-direction: column; }
.ios-grip .ios-gt { color: #8aa0b0; font: bold 12px Arial; letter-spacing: 1px; text-align: center; margin-bottom: 4px; }
.ios-grip svg { flex: 1; min-height: 0; }
@media (orientation: portrait) { .ios-grip .ios-gcell { height: calc(50vh - 56px); } }   /* 태블릿 세로 — 컬렉티브 · 사이클릭을 위아래로 한 화면에 */
/* 태블릿 세로 — 조종석의 컬렉티브 · 사이클릭 큰 창도 화면 폭 안에 */
@media (orientation: portrait) { #kg-pop, #b206-coll-pop { max-width: calc(100vw - 130px); } }
html.ios-mode body { background: #0b1218; overflow: auto; }
#ios-root { color: #dfe6ec; font: 14px -apple-system, 'Segoe UI', Arial, sans-serif; padding: 12px; max-width: 640px; margin: 0 auto; }
#ios-root h1 { font-size: 18px; margin: 4px 0 8px; } #ios-root h2 { font-size: 14px; color: #8aa0b0; margin: 14px 0 6px; border-bottom: 1px solid #22313d; }
#ios-root .ios-link { color: #ffb000; margin-bottom: 8px; } #ios-root .ios-link.ok { color: #7dff3a; }
#ios-root .ios-state { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px 10px; background: #121a21; padding: 8px; border-radius: 6px; }
#ios-root .ios-state em { font-style: normal; color: #8aa0b0; margin-right: 6px; font-size: 12px; }
#ios-root button { background: #1b2731; color: #dfe6ec; border: 1px solid #3a4a58; border-radius: 5px; padding: 6px 10px; margin: 2px; font-size: 13px; cursor: pointer; }
#ios-root button.on { border-color: #00e5ff; color: #00e5ff; } #ios-root .ios-btns button.on { border-color: #ff5252; color: #ff5252; }
#ios-root .ios-row { display: flex; align-items: center; gap: 8px; } #ios-root .ios-row > span { width: 80px; flex: none; color: #8aa0b0; }
#ios-root input { background: #0b1218; color: #fff; border: 1px solid #3a4a58; border-radius: 4px; padding: 5px 6px; width: 70px; font-size: 14px; }
#ios-root .ios-dim { color: #667; }
/* 도움말(31-ios.js) */
#help-wrap { display: none; position: fixed; inset: 0; z-index: 30001; background: rgba(0,0,0,0.45); align-items: center; justify-content: center; }
#help-wrap .help-box { width: min(640px, 96vw); max-height: 86vh; display: flex; flex-direction: column; background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; color: #dfe6ec; font-size: 14px; }
#help-wrap .help-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1b2731; border-radius: 8px 8px 0 0; }
#help-wrap .sim-btn { width: auto; flex: none; padding: 4px 10px; margin: 0; }
#help-wrap .help-list { overflow-y: auto; padding: 6px 12px 12px; } #help-wrap .help-list div { padding: 6px 0; border-bottom: 1px solid #22313d; }
#help-wrap .help-list b { display: block; color: #00e5ff; margin-bottom: 2px; }
/* 시나리오(30-scenario.js) */
#scn-wrap { display: none; position: fixed; inset: 0; z-index: 30001; background: rgba(0,0,0,0.45); align-items: center; justify-content: center; }
#scn-wrap .scn-box { width: min(560px, 96vw); max-height: 86vh; display: flex; flex-direction: column; background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; color: #dfe6ec; font-size: 14px; }
#scn-wrap .scn-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #1b2731; border-radius: 8px 8px 0 0; }
#scn-wrap .sim-btn { width: auto; flex: none; padding: 4px 10px; margin: 0; } #scn-wrap .sim-btn.on { border-color: #00e5ff; color: #00e5ff; }
#scn-wrap .scn-new, #scn-wrap .scn-io { display: flex; gap: 6px; padding: 8px 10px; }
#scn-wrap .scn-new input { flex: 1; min-width: 0; background: #0b1218; color: #fff; border: 1px solid #3a4a58; border-radius: 4px; padding: 5px 8px; font-size: 14px; }
#scn-wrap .scn-list { flex: 1; overflow-y: auto; padding: 0 10px; }
#scn-wrap .scn-item { display: flex; align-items: center; gap: 6px; padding: 6px 0; border-bottom: 1px solid #22313d; }
#scn-wrap .scn-item > div { flex: 1; min-width: 0; } #scn-wrap .scn-item small { display: block; color: #8aa0b0; font-size: 11px; }
#scn-wrap .scn-empty { color: #8aa0b0; padding: 10px 0; }
/* 비행 강평(28-debrief.js) */
#dbf-wrap { display: none; position: fixed; inset: 0; z-index: 30000; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; }
#dbf-wrap .dbf-box { width: min(1200px, 96vw); height: min(820px, 94vh); background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; display: flex; flex-direction: column; color: #dfe6ec; font-size: 13px; overflow: hidden; }
#dbf-wrap .dbf-bar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: #1b2731; flex-wrap: wrap; }
#dbf-wrap .dbf-bar b { margin-right: auto; font-size: 15px; }
#dbf-wrap .sim-btn { width: auto; flex: none; padding: 4px 10px; margin: 0; }
#dbf-wrap .sim-btn.on { border-color: #00e5ff; color: #00e5ff; }
#dbf-wrap .dbf-sum { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 6px 10px; border-bottom: 1px solid #22313d; }
#dbf-wrap .dbf-sum em { font-style: normal; color: #8aa0b0; margin-right: 4px; } #dbf-wrap .dbf-sum .warn { color: #ffb000; }
#dbf-wrap .dbf-main { flex: 1; display: flex; min-height: 0; gap: 6px; padding: 6px; }
#dbf-wrap .dbf-trk { flex: 1 1 40%; min-width: 0; height: 100%; border-radius: 4px; }
#dbf-wrap .dbf-chart { flex: 1 1 60%; min-width: 0; height: 100%; border-radius: 4px; touch-action: none; cursor: crosshair; }
#dbf-wrap .dbf-ctl { display: flex; align-items: center; gap: 6px; padding: 0 8px; }
#dbf-wrap .dbf-rng { flex: 1; }
#dbf-wrap .dbf-bot { display: flex; gap: 8px; padding: 6px 8px 8px; height: 120px; }
#dbf-wrap .dbf-read { flex: 1 1 50%; line-height: 1.6; } #dbf-wrap .dbf-read .dbf-m { color: #8aa0b0; }
#dbf-wrap .dbf-side { flex: 1 1 50%; display: flex; flex-direction: column; min-height: 0; }
#dbf-wrap .dbf-tabs { display: flex; gap: 4px; margin-bottom: 3px; } #dbf-wrap .dbf-tabs .sim-btn { padding: 2px 10px; }
#dbf-wrap .dbf-ev, #dbf-wrap .dbf-gr { flex: 1; overflow-y: auto; background: #0b1218; border-radius: 4px; padding: 4px 6px; }
#dbf-wrap .gr-t { border-collapse: collapse; width: 100%; font-size: 12px; } #dbf-wrap .gr-t th, #dbf-wrap .gr-t td { padding: 1px 4px; text-align: center; }
#dbf-wrap .gr-t td:first-child { text-align: left; } #dbf-wrap .gr-t input[type=number] { width: 58px; background: #121a21; color: #fff; border: 1px solid #3a4a58; border-radius: 3px; font-size: 12px; }
#dbf-wrap .gr-t .ok { color: #7dff3a; } #dbf-wrap .gr-t .bad { color: #ff5252; } #dbf-wrap .gr-sum { margin-top: 4px; font-size: 14px; }
#dbf-wrap .gr-우수 { color: #7dff3a; } #dbf-wrap .gr-만족 { color: #4fc3f7; } #dbf-wrap .gr-보통 { color: #ffb000; } #dbf-wrap .gr-미흡 { color: #ff5252; }
#dbf-list { display: none; position: fixed; inset: 0; z-index: 30002; background: rgba(0,0,0,0.45); align-items: center; justify-content: center; }
#dbf-list .dbf-lbox { width: min(520px, 94vw); max-height: 80vh; overflow-y: auto; background: #121a21; border: 1px solid #3a4a58; border-radius: 8px; color: #dfe6ec; }
#dbf-list .dbf-bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #1b2731; }
#dbf-list .sim-btn { width: auto; flex: none; padding: 4px 10px; margin: 0; }
#dbf-list .dbf-litem { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid #22313d; }
#dbf-list .dbf-litem > div { flex: 1; min-width: 0; } #dbf-list small { display: block; color: #8aa0b0; font-size: 11px; }
#dbf-mini { display: none; position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 30000; gap: 6px; align-items: center; padding: 6px 10px;
  background: rgba(18,26,33,0.92); border: 1px solid #3a4a58; border-radius: 8px; color: #dfe6ec; font-size: 13px; width: min(720px, 94vw); }
#dbf-mini .sim-btn { width: auto; flex: none; padding: 3px 8px; margin: 0; } #dbf-mini input { flex: 1; min-width: 60px; }
#dbf-mini { width: min(940px, 96vw); flex-wrap: wrap; } #dbf-mini .rp-bar { position: relative; flex: 1; min-width: 120px; display: flex; } #dbf-mini .rp-bar input { width: 100%; }
#dbf-mini .rp-marks { position: absolute; left: 8px; right: 8px; top: -3px; height: 6px; pointer-events: none; }
#dbf-mini .rp-mk { position: absolute; width: 2px; height: 8px; background: #8fd3ff; transform: translateX(-1px); } #dbf-mini .rp-mk.warn { background: #ffb000; } #dbf-mini .rp-mk.err { background: #ff5252; }
#dbf-mini .rp-seg { position: absolute; top: 2px; height: 3px; background: rgba(120,255,160,0.55); }
#dbf-mini .rp-ev { position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); margin-bottom: 6px; padding: 3px 10px; border-radius: 6px; background: rgba(18,26,33,0.92); border: 1px solid #3a4a58; white-space: nowrap; opacity: 0; transition: opacity .3s; pointer-events: none; }
#dbf-mini .rp-ev.show { opacity: 1; } #dbf-mini .rp-ev.warn { color: #ffb000; } #dbf-mini .rp-ev.err { color: #ff5252; }
#dbf-mini .sim-btn.on { background: #2e7d32; }
#dbf-wrap .dbf-ev div { cursor: pointer; padding: 1px 0; } #dbf-wrap .dbf-ev .warn { color: #ffb000; } #dbf-wrap .dbf-ev .err { color: #ff5252; }
#dbf-wrap .dbf-ev .cur { background: #22384a; }
@media (max-width: 700px) { #dbf-wrap .dbf-main { flex-direction: column; } #dbf-wrap .dbf-bot { flex-direction: column; height: 200px; } }
/* 흰수리 컬렉티브 · 사이클릭(35-kuhgrip.js) — 조종석의 작은 그림 · 누르면 큰 창(#ck-layer 위) */
#sim-ckpit .kg-mini > svg { pointer-events: none; }
#kg-pop { display: none; position: absolute; z-index: 2; flex-direction: column; pointer-events: auto; background: #101214;
  border: 1px solid #3a3e43; border-radius: 6px; box-shadow: 0 4px 24px rgba(0,0,0,0.7); }
#kg-pop .kgp-bar { height: 26px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 4px 0 10px;
  color: #cfd6dc; font: bold 12px Arial, sans-serif; letter-spacing: 1px; border-bottom: 1px solid #2a2e33; }
#kg-pop .kgp-x { width: 34px !important; min-width: 0; flex: none; padding: 2px 0; margin: 0; }
#kg-pop-body { flex: 1; min-height: 0; padding: 4px; touch-action: none; user-select: none; -webkit-user-select: none; }
/* Bell 206 컬렉티브 큰 창(27-b206coll.js) — 다른 팝아웃처럼 #ck-layer 위 */
#b206-coll-pop { display: none; position: absolute; z-index: 2; flex-direction: column; pointer-events: auto; background: #101214;
  border: 1px solid #3a3e43; border-radius: 6px; box-shadow: 0 4px 24px rgba(0,0,0,0.7); }
#b206-coll-pop .bcp-bar { height: 26px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 4px 0 10px;
  color: #cfd6dc; font: bold 12px Arial, sans-serif; letter-spacing: 1px; border-bottom: 1px solid #2a2e33; }
#b206-coll-pop .bcp-x { width: 34px !important; min-width: 0; flex: none; padding: 2px 0; margin: 0; }
#b206-coll-pop .bcp-wb { width: auto !important; min-width: 0; flex: none; margin: 0 0 0 auto; padding: 2px 6px; font-size: 10px; }
#b206-coll-pop .bcp-fail { width: auto !important; min-width: 0; flex: none; margin: 0 4px 0 4px; padding: 2px 6px; font-size: 10px; color: #ff8a80; border-color: #7a2a2a; }
#b206-coll-pop-body { flex: 1; min-height: 0; padding: 4px; touch-action: none; }
/* Bell 206 — 겹친 계기는 다섯 계기 판(25-b206panel.js b206OverlayDraw) · 판이 살짝 비친다 */
html.ac-b206 #pfd-ov { background: transparent; border: 0; box-shadow: none; min-height: 0; min-width: min(260px, calc(100% - 120px)); }
#pfd-ov canvas { display: block; width: 100%; height: 100%; }
/* 3D 가 제 창(3D 탭 · 3D 단독) — 툴바가 없으므로 위에 붙인다 */
#map3d-wrap > #pfd-ov { top: 8px; }
/* 3D 단독 화면의 CDU — 3D 버튼 줄(오른쪽 8px · 너비 96px) 바로 왼쪽, 높이는 계기 칸과 같고 너비는 CDU 비율 */
#cdu-ov { display: none; position: absolute; right: 112px; top: 8px; height: 60%; width: auto;
          aspect-ratio: 354 / 567;                 /* 높이만 계기 칸에 맞추고 너비는 CDU 비율대로 — 좌우 빈 여백 없이 */
          min-height: min(380px, 85%);
          z-index: 950; background: #000; border: 1px solid #333; border-radius: 4px;
          overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.6); }
#cdu-ov.show { display: block; }
#cdu-ov > #cdu-wrap, #cdu-ov > #cdu-wrap.page-hidden,
#cdu-ov > #fp-wrap, #cdu-ov > #fp-wrap.page-hidden { display: block !important; position: absolute; inset: 0; width: auto; height: auto; }
#ctl3d #cduov-btn.on { color: #00e5ff; border-color: #00e5ff; }
/* 3D 단독 화면의 MAP — 계기 칸과 같은 크기, CDU 칸(또는 3D 버튼 줄) 바로 왼쪽(자리는 07-sim.js 가 잰다) */
#map-ov { display: none; position: absolute; right: 112px; top: 8px; width: 25%; height: 60%;
          min-width: min(300px, calc(100% - 120px)); min-height: min(360px, 85%);
          z-index: 950; background: #000; border: 1px solid #333; border-radius: 4px;
          overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.6); }
#map-ov.show { display: block; }
#map-ov > #map-wrap, #map-ov > #map-wrap.page-hidden { display: block !important; position: absolute; inset: 0; width: auto; height: auto; }
#ctl3d #mapov-btn.on { color: #00e5ff; border-color: #00e5ff; }
#ctl3d #vstick-btn.on { color: #ffb000; border-color: #ffb000; }
#ctl3d #vstick-btn.dim { opacity: 0.45; }
#ctl3d #gyro-btn.on, #ctl3d #gyro-align-btn.on { color: #ffb000; border-color: #ffb000; }
#ctl3d #gyro-btn.dim { opacity: 0.45; }
/* 화면 조종간 — 오른쪽 아래(너비 1/3) */
#vstick { display: none; position: absolute; right: 0; bottom: 0; width: calc((100% - 18px) / 3);
          height: max(calc(100% * 2 / 9), 170px); z-index: 803; box-sizing: border-box; padding: 10px 12px 8px;
          background: rgba(10,12,15,0.82); border: 2px solid #1d232b; border-radius: 10px 10px 0 0;
          gap: 12px; align-items: stretch; touch-action: none; user-select: none; -webkit-user-select: none; }
#vstick.show { display: flex; }
/* 조종간이 떠 있으면 오른쪽 3D 버튼 줄은 그 위에서 끝나고 스크롤된다 */
#map3d.vstick-on #ctl3d { max-height: calc(100% - max(calc(100% * 2 / 9), 170px) - 24px); }
/* 컬렉티브 — 왼쪽 아래 끝 */
#vstick-coll { display: none; position: absolute; left: 0; bottom: 0; width: 84px; height: max(calc(100% * 2 / 9), 170px);
               z-index: 803; box-sizing: border-box; padding: 10px 10px 8px; background: rgba(10,12,15,0.82);
               border: 2px solid #1d232b; border-radius: 10px 10px 0 0; touch-action: none; user-select: none; -webkit-user-select: none; }
#vstick-coll.show { display: flex; }
#vstick-coll .vs-coll { flex: 1 1 auto; }
/* 조종간이 떠 있으면 FCP 창은 컬렉티브 오른쪽으로 비킨다 */
#map3d.vstick-on .fcp3d-l { left: 88px; }
#vstick .vs-track, #vstick .vs-cyc, #vstick-coll .vs-track { position: relative; background: #11161c; border: 1px solid #2f3a46; border-radius: 8px; touch-action: none; }
#vstick .vs-left { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 0; }
#vstick .vs-ped { flex: 0 0 auto; height: 34px; }
/* 시야 판 — 사이클릭처럼 둥근 판(끌어 간 쪽으로 고개를 돌린다 · 놓으면 정면) */
#vstick .vs-look { position: relative; flex: 1 1 0; min-height: 0; align-self: center; aspect-ratio: 1; max-width: 100%;
                   background: #11161c; border: 1px solid #2f3a46; border-radius: 50%; touch-action: none; }
#vstick .vs-look .vs-knob { width: 22px; height: 22px; background: #9fe8ff; }
#vstick .vs-look.held .vs-knob { background: #ffb000; }
#vstick .vs-cyc { flex: 0 0 auto; aspect-ratio: 1; height: 100%; border-radius: 50%; }
#vstick .vs-ring { position: absolute; inset: 22%; border: 1px dashed #2f3a46; border-radius: 50%; pointer-events: none; }
#vstick .vs-knob, #vstick-coll .vs-knob { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #9aa4ae;
                   border: 2px solid #e8edf2; box-sizing: border-box; pointer-events: none; }
#vstick-coll .vs-coll .vs-knob { left: calc(50% - 9px); width: 18px; border-radius: 4px; }
#vstick .vs-ped .vs-knob { top: calc(50% - 9px); }
#vstick .vs-cyc .vs-knob { width: 28px; height: 28px; background: #00e5ff; }
#vstick .held .vs-knob, #vstick-coll .held .vs-knob { background: #ffb000; }
#vstick .vs-lbl, #vstick-coll .vs-lbl { position: absolute; left: 0; right: 0; bottom: -2px; text-align: center; font: 600 9px Helvetica, Arial, sans-serif;
                  color: #8a96a3; pointer-events: none; }
#vstick-coll .vs-coll .vs-lbl { bottom: auto; top: 2px; font-size: 8px; }
#ctl3d #mapov-btn.dim { opacity: 0.45; }
#ctl3d #cduov-btn.dim { opacity: 0.45; }
#map-top-bar {
  position: absolute; top: 8px; left: 8px; right: 8px; z-index: 1000;
  display: flex; gap: 4px;
}
#map-top-bar button {
  flex: 1; min-width: 0;
  background: rgba(20,20,20,0.88); border: 1px solid #444; color: #fff;
  font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: bold;
  padding: 7px 2px; border-radius: 5px; cursor: pointer;
  touch-action: manipulation; text-align: center;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
#orient-btn.hdg-up {
  background: rgba(40,20,0,0.92); border-color: #ff8844; color: #ffaa66;
  box-shadow: 0 0 8px rgba(255,136,68,0.4);
}
#layer-btn.sat {
  background: rgba(0,20,60,0.92); border-color: #4488ff; color: #88ccff;
  box-shadow: 0 0 8px rgba(68,136,255,0.4);
}
#gps-btn.active {
  background: rgba(0,40,0,0.92); border-color: #00dd44; color: #00ff88;
  box-shadow: 0 0 8px rgba(0,220,80,0.4);
}
/* MAP 상단 FULL/HALF 토글 버튼 — 눈에 띄는 노랑, 폭은 콤팩트 */
#map-full-btn {
  flex: 0 0 auto; min-width: 58px;
  border-color: #b8860b; color: #facc15;
}
#map-full-btn:active { background: rgba(40,32,0,0.92); }
/* ── 화면 터치 잠금 ── */
#lock-btn.locked { background: rgba(60,45,0,0.92); border-color: #ffaa00; color: #ffcc44; }
#lock-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.12);
  flex-direction: column; align-items: center; justify-content: flex-end;
  padding-bottom: calc(env(safe-area-inset-bottom) + 26px);
  touch-action: none; -webkit-user-select: none; user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
#lock-overlay.on { display: flex; }
#lock-badge {
  position: absolute; top: calc(env(safe-area-inset-top) + 10px); left: 50%; transform: translateX(-50%);
  background: rgba(10,10,14,0.9); border: 1px solid #ffaa00; border-radius: 6px;
  color: #ffcc44; font-size: 12px; font-weight: bold; letter-spacing: 1px; padding: 5px 14px;
}
#lock-unlock {
  position: relative; overflow: hidden;
  width: 210px; height: 46px; border-radius: 23px;
  background: rgba(10,10,14,0.92); border: 1.5px solid #ffaa00;
  display: flex; align-items: center; justify-content: center;
  color: #ffcc44; font-size: 13px; font-weight: bold; letter-spacing: 1px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.6);
}
#lock-unlock-fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
  background: rgba(255,170,0,0.28); transition: width 0.08s linear;
}
#lock-unlock-txt { position: relative; z-index: 1; pointer-events: none; }
/* 거리·방위 측정자(Ruler) */
#map-ruler-btn { flex: 0 0 auto; min-width: 40px; font-size: 14px; padding: 5px 2px; }
#map-ruler-btn.ruler-active {
  background: rgba(60,45,0,0.92); border-color: #ffd54f; color: #ffd54f;
  box-shadow: 0 0 8px rgba(255,213,79,0.4);
}
#ruler-readout {
  display: none;
  position: absolute; top: 46px; left: 8px; z-index: 1260;
  background: rgba(8,10,14,0.94); border: 1px solid #ffd54f; border-radius: 6px;
  padding: 7px 9px; min-width: 168px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
#ruler-readout .rr-row { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; padding: 2px 0; }
#ruler-readout .rr-lbl { color: #8a9aa8; }
#ruler-readout .rr-val { color: #ffd54f; font-weight: bold; }
#ruler-readout .rr-btns { display: flex; gap: 5px; margin-top: 6px; }
#ruler-readout .rr-btns button {
  flex: 1; background: rgba(25,25,25,0.9); border: 1px solid #444; border-radius: 4px;
  color: #cfe; font-size: 10px; font-weight: bold; padding: 5px 0; cursor: pointer;
}
#notam-btn.active {
  background: rgba(40,25,0,0.92); border-color: #ff9800; color: #ffb74d;
  box-shadow: 0 0 8px rgba(255,152,0,0.4);
}
#fix-btn.active {
  background: rgba(0,35,40,0.92); border-color: #26c6da; color: #4dd0e1;
  box-shadow: 0 0 8px rgba(38,198,218,0.4);
}
#awy-btn.active {
  background: rgba(20,35,0,0.92); border-color: #8bc34a; color: #aed581;
  box-shadow: 0 0 8px rgba(139,195,74,0.4);
}
#aspc-btn.active {
  background: rgba(35,20,40,0.92); border-color: #ba68c8; color: #ce93d8;
  box-shadow: 0 0 8px rgba(186,104,200,0.4);
}
#aspc-panel {
  display: none;
  position: absolute; top: 44px; right: 8px; z-index: 1100;
  width: 290px; max-height: 62%; overflow-y: auto;
  background: rgba(8,8,14,0.94); border: 1px solid #ba68c8; border-radius: 8px;
  padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-overflow-scrolling: touch;
}
#aspc-panel.open { display: block; }
#fix-panel {
  display: none;
  position: absolute; top: 44px; right: 8px; z-index: 1100;
  width: 240px; max-height: 62%; overflow-y: auto;
  background: rgba(6,14,16,0.94); border: 1px solid #26c6da; border-radius: 8px;
  padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-overflow-scrolling: touch;
}
#fix-panel.open { display: block; }
#fix-panel label {
  display: flex; align-items: center; gap: 6px; color: #cfe8ec; font-size: 10px;
  padding: 5px 3px; border-bottom: 1px solid #14343a; cursor: pointer;
}
#fix-panel .fixp-hdr { color:#4dd0e1; font-size:9px; font-weight:bold; letter-spacing:0.5px; padding:2px 3px 5px; }
#awy-panel {
  display: none;
  position: absolute; top: 44px; right: 8px; z-index: 1100;
  width: 210px; background: rgba(8,14,8,0.94);
  border: 1px solid #8bc34a; border-radius: 8px; padding: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
#awy-panel.open { display: block; }
#pp-menu {
  display: none;
  position: absolute; top: 44px; z-index: 1200;
  background: rgba(8,8,14,0.95); border: 1px solid #00ff88; border-radius: 6px;
  padding: 4px; flex-direction: column; gap: 4px;
}
#pp-menu.open { display: flex; }
/* ── 주소·지명 검색 패널 ── */
#geo-panel {
  display: none; position: absolute; top: 80px; left: 8px; z-index: 1200;
  width: min(340px, calc(100% - 16px));
  background: rgba(5,10,16,0.97); border: 1.5px solid #2a5a7a; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.85);
}
#geo-panel.open { display: block; }
#geo-panel-hdr {
  color: #00cfff; font-size: 12px; font-weight: bold; letter-spacing: 1px;
  border-bottom: 1px solid #14324a; padding: 7px 10px 6px; position: relative;
}
#geo-close { position: absolute; right: 8px; top: 5px; color: #8a97a5; cursor: pointer; font-size: 13px; }
#geo-panel-body { padding: 8px; display: flex; flex-direction: column; gap: 7px; }
#geo-row { display: flex; gap: 5px; }
#geo-q {
  flex: 1; min-width: 0; background: #0a1116; border: 1px solid #2a3a4a; border-radius: 4px;
  color: #cdd6df; font-size: 12px; padding: 7px 8px;
}
#geo-go {
  flex: 0 0 auto; background: #0a1620; border: 1px solid #2a5a7a; border-radius: 4px;
  color: #00cfff; font-size: 11px; font-weight: bold; padding: 7px 12px; cursor: pointer;
}
#geo-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
.geo-item {
  background: #0a1116; border: 1px solid #1e2630; border-radius: 4px;
  padding: 6px 8px; cursor: pointer;
}
.geo-item:active { border-color: #00cfff; }
.geo-item b { color: #cdd6df; font-size: 11px; font-weight: bold; display: block; }
.geo-item span { color: #6a7784; font-size: 9px; line-height: 1.35; display: block; margin-top: 1px; }
#geo-msg { color: #8a97a5; font-size: 10px; padding: 4px 2px; }
#geo-note { color: #4a5563; font-size: 9px; line-height: 1.45; }
#pp-menu button {
  background: rgba(20,20,20,0.9); border: 1px solid #444; border-radius: 4px;
  color: #cfe; font-size: 11px; font-weight: bold; padding: 7px 12px;
  cursor: pointer; white-space: nowrap; text-align: left;
}
#pp-menu button:active { border-color: #00ff88; color: #00ff88; }
.aspc-grp {
  color: #ce93d8; font-size: 10px; font-weight: bold; letter-spacing: 1px;
  border-bottom: 1px solid #2a1a30; padding: 6px 2px 3px; margin-top: 2px;
  display: flex; justify-content: space-between; align-items: center;
}
.aspc-grp span {
  cursor: pointer; color: #aaa; font-size: 9px;
  border: 1px solid #555; border-radius: 4px;
  padding: 2px 8px; margin-left: 4px;
  background: rgba(255,255,255,0.05);
}
.aspc-grp span:active { background: rgba(186,104,200,0.25); border-color: #ba68c8; color: #fff; }
.aspc-item {
  display: flex; align-items: center; gap: 6px; padding: 4px 2px;
  color: #ccc; font-size: 10px; cursor: pointer; user-select: none;
}
.aspc-item input { accent-color: #ba68c8; margin: 0; }
/* ── 경보 INHIBIT 메뉴 ── */
#inhib-menu {
  display: none;
  position: absolute; bottom: calc(20% + 40px); left: 8px; z-index: 1250;
  background: rgba(8,8,14,0.95); border: 1px solid #ffaa00; border-radius: 6px;
  padding: 5px; flex-direction: column; gap: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
#map-wrap.tcut-off #inhib-menu { bottom: 40px; }
#inhib-menu.open { display: flex; }
#inhib-menu button {
  background: rgba(20,20,20,0.9); border: 1px solid #444; border-radius: 4px;
  color: #cfe; font-size: 11px; font-weight: bold; padding: 7px 12px;
  cursor: pointer; white-space: nowrap; text-align: left;
  display: flex; justify-content: space-between; gap: 12px;
}
#inhib-menu button span { color: #00e07a; }
#inhib-menu button.inhibited { border-color: #ffaa00; }
#inhib-menu button.inhibited span { color: #ffaa00; }
#inhib-btn.inhib-active { background: rgba(60,45,0,0.92); border-color: #ffaa00; color: #ffcc44; }
/* ── SHIP 선택 메뉴(INHIBIT식) ── */
#ship-menu {
  display: none;
  position: absolute; bottom: calc(20% + 40px); left: 8px; z-index: 1250;
  background: rgba(8,8,14,0.95); border: 1px solid #7ab8f5; border-radius: 6px;
  padding: 5px; flex-direction: column; gap: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
#map-wrap.tcut-off #ship-menu { bottom: 40px; }
#ship-menu.open { display: flex; }
/* 3D 창의 SHIP — 3D 가 제 창을 쓸 때만 보인다(2D 위에 겹쳐 쓸 때는 지도 아래 막대의 SHIP 을 쓴다).
   메뉴·설정창은 이 창으로 옮겨 와 열린다(shipUiHome). */
#ship3d-btn { display: none; position: absolute; top: 8px; left: 8px; z-index: 900; padding: 5px 10px; }
#map3d.panel-3d #ship3d-btn { display: block; }
/* 3D 창 — 확장 메뉴처럼 펼친다: 오른쪽 버튼 묶음 | 그 왼쪽에 SHIP 메뉴 | 다시 그 왼쪽에 SHIP CONTROL(설정창).
   버튼 묶음(폭 96 + 여백 8)과 겹치지 않는다 */
#map3d #ship-menu { top: 40px; bottom: auto; left: auto; right: 112px; width: 100px; }
#map3d #ship-panel { top: 40px; right: 220px; bottom: auto; }
#map-wrap #map3d #ship-menu, #map-wrap #map3d #ship-panel { top: 80px; }
#ship-menu button {
  background: rgba(20,20,20,0.9); border: 1px solid #444; border-radius: 4px;
  color: #cfe; font-size: 11px; font-weight: bold; padding: 7px 12px;
  cursor: pointer; white-space: nowrap; text-align: left;
  display: flex; justify-content: space-between; gap: 12px;
}
#ship-menu button span { color: #888; }
#ship-menu button.on { border-color: #33cc55; }
#ship-menu button.on span { color: #4ade80; }

/* ── 공역 접근/진입 경보 배너 ── */
#aspc-alert {
  display: none;
  position: absolute; top: 46px; left: 50%; transform: translateX(-50%);
  z-index: 1300; max-width: 86%;
  padding: 6px 14px; border-radius: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  pointer-events: none;
}
#aspc-alert.near { display: block; background: rgba(60,45,0,0.92); border: 1px solid #ffaa00; color: #ffcc44; }
#aspc-alert.inside { display: block; background: rgba(70,0,0,0.94); border: 1px solid #ff3322; color: #ff7766; animation: aspcBlink 1s step-end infinite; }
@keyframes aspcBlink { 50% { opacity: 0.45; } }
/* ── 지형 접근 경고(T-CUT 기반) ── */
#terrain-alert {
  display: none;
  position: absolute; top: 78px; left: 50%; transform: translateX(-50%);
  z-index: 1300; padding: 5px 16px; border-radius: 6px;
  background: rgba(70,0,0,0.94); border: 1px solid #ff3322; color: #ff7766;
  font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: bold;
  letter-spacing: 2px; pointer-events: none;
  animation: aspcBlink 1s step-end infinite;
}
#terrain-alert.on { display: block; }
/* ── VNAV 강하 알림 ── */
#vnav-alert {
  display: none;
  position: absolute; top: 110px; left: 50%; transform: translateX(-50%);
  z-index: 1300; padding: 5px 16px; border-radius: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px; font-weight: bold; letter-spacing: 1px; white-space: nowrap; pointer-events: none;
}
#vnav-alert.pre   { display: block; background: rgba(60,45,0,0.92); border: 1px solid #ffaa00; color: #ffd24d; }
#vnav-alert.begin { display: block; background: rgba(50,0,50,0.94); border: 1px solid #ff4dd2; color: #ff9de8; animation: aspcBlink 1s step-end infinite; }

/* GPS 상태창: 하단 좌표창(#center-coord, left:10px) 오른쪽에 나란히 배치 */
#gps-status {
  position: absolute; bottom: calc(20% + 44px); left: 235px; z-index: 1100;
  background: rgba(0,20,0,0.80); border: 1px solid #226622; color: #00cc66;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 9px;
  padding: 3px 7px; border-radius: 3px; display: none;
  text-align: left; line-height: 1.5; white-space: nowrap;
}
#map-wrap.tcut-off #gps-status { bottom: 44px; }
#wx-btn.wx-active {
  background: rgba(0,20,40,0.92); border-color: #00aaff; color: #66ccff;
  box-shadow: 0 0 8px rgba(0,170,255,0.4);
}
#rain-btn.rain-active {
  background: rgba(0,10,40,0.92); border-color: #4488ff; color: #88bbff;
  box-shadow: 0 0 8px rgba(68,136,255,0.4);
}
#wind-btn.wind-active {
  background: rgba(0,30,20,0.92); border-color: #44cc88; color: #88ffcc;
  box-shadow: 0 0 8px rgba(68,204,136,0.4);
}

#map-sim-bar {
  position: absolute; bottom: 20%; left: 0; right: 0; z-index: 1000;
  display: flex; gap: 3px; padding: 5px 6px;
  background: rgba(0,0,0,0.82); border-top: 1px solid #2a2a2a;
}
/* 심바로 옮긴 지도 버튼들의 활성 스타일이 sim-btn 그라데이션 위에서도 보이게 */
#map-sim-bar #layer-btn.sat {
  background: rgba(0,20,60,0.92); border-color: #4488ff; color: #88ccff;
}
#map-sim-bar .sim-btn { flex: 1; }

/* 진단 기록(34-infra.js) */
#diag-wrap .diag-box { width: min(680px, 96vw); }
#tileprep-wrap .tp-area { display: inline-flex; gap: 2px; } #tileprep-wrap .tp-none, #radio-wrap .tp-none { color: #8aa0b0; }
#iimc-wrap .set-box, #radio-wrap .set-box { width: min(620px, 96vw); } #iimc-wrap .gr-t { border-collapse: collapse; width: calc(100% - 24px); margin: 6px 12px; font-size: 13px; }
#iimc-wrap .gr-t th, #iimc-wrap .gr-t td { padding: 3px 6px; border-bottom: 1px solid #26323c; text-align: left; } #iimc-wrap .gr-sum { padding: 6px 12px; font-size: 15px; }
#iimc-wrap .ok, #bingo-wrap .ok, #radio-wrap .ok { color: #7dff3a; } #iimc-wrap .bad, #bingo-wrap .bad, #radio-wrap .bad { color: #ff5252; } #bingo-wrap .warn { color: #ffb000; }
#iimc-wrap .gr-우수 { color: #7dff3a; } #iimc-wrap .gr-만족 { color: #4fc3f7; } #iimc-wrap .gr-보통 { color: #ffb000; } #iimc-wrap .gr-미흡, #iimc-wrap .gr-불만족 { color: #ff5252; }
#iimc-wrap .sim-btn.on, #bingo-wrap .sim-btn.on, #radio-wrap .sim-btn.on { background: #1d5a7a; color: #fff; }
#radio-wrap textarea { width: 100%; background: #0d1318; color: #dfe6ec; border: 1px solid #3a4a58; border-radius: 4px; font-size: 13px; } #radio-wrap .radio-ex { flex: 1; color: #bfe3ff; font-size: 13px; }
#pm-wrap .set-box, #wing-wrap .set-box, #asset-wrap .set-box { width: min(640px, 96vw); }
.crew-wrap .sim-btn.on { background: #1d5a7a; color: #fff; } .crew-wrap .tp-none { color: #8aa0b0; } .crew-wrap .warn { color: #ffb000; } .crew-wrap .err { color: #ff5252; } .crew-wrap .ok { color: #7dff3a; }
.crew-wrap input[type=text] { flex: 1; min-width: 120px; background: #0d1318; color: #dfe6ec; border: 1px solid #3a4a58; border-radius: 4px; padding: 3px 6px; }
#pm-wrap .pm-cls { flex-direction: column; align-items: stretch !important; } #pm-wrap .pm-cl-h { color: #8fd3ff; font-weight: bold; } #pm-wrap .pm-cl-it { font-size: 16px; margin: 6px 0; }
#pm-wrap .pm-big { font-size: 15px; padding: 6px 18px !important; } #pm-wrap .pm-cl-n { font-size: 12px; color: #8aa0b0; display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 6px; } #pm-wrap .pm-cl-n .cur { color: #fff; }
.crew-wrap .as-list { flex-direction: column; align-items: stretch !important; } .crew-wrap .as-row { font-size: 13px; padding: 1px 0; } .crew-wrap .as-chk { font-size: 12px; color: #cfe; display: inline-flex; gap: 4px; align-items: center; }
#wing-wrap .wg-qr svg { width: 140px; height: 140px; background: #fff; padding: 4px; } #wing-wrap .wg-code code { font-size: 11px; word-break: break-all; color: #bfe3ff; display: block; margin-bottom: 4px; }
.asset-tip { background: rgba(10,20,28,0.85); color: #e8f4ff; border: 1px solid #456; font-size: 11px; padding: 1px 5px; box-shadow: none; }
#radio-wrap .radio-chk { font-size: 13px; line-height: 1.6; } #radio-wrap .radio-chk span { margin-right: 6px; white-space: nowrap; }
#tileprep-wrap .sim-btn.on { background: #1d5a7a; color: #fff; } #tileprep-wrap .tp-bar { height: 8px; background: #26323c; border-radius: 4px; overflow: hidden; margin-bottom: 4px; } #tileprep-wrap .tp-bar i { display: block; height: 100%; background: #3fb950; }
.diag-box .diag-h { padding: 8px 12px 2px; color: #ffcc66; font-weight: bold; font-size: 13px; }
.diag-box .diag-list { margin: 0 12px; max-height: 150px; overflow-y: auto; background: #0b1218; border: 1px solid #2a3a48; border-radius: 4px; padding: 4px 6px; font: 11px/1.45 monospace; color: #cfd8df; }
.diag-box .diag-list i { color: #7f95a5; } .diag-box .diag-ok { color: #4f8; }
/* 새 버전 알림 띠 */
#sw-update { position: fixed; left: 50%; top: 8px; transform: translateX(-50%); z-index: 40000; background: #0d3a5a; border: 1px solid #4cb3ff; color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 14px; display: flex; gap: 8px; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
#sw-update .sim-btn { width: auto; flex: none; padding: 3px 10px; margin: 0; }
/* 지도 단추줄 — 좁으면 덜 쓰는 단추를 ⋯ 뒤로(34-infra.js mapBarFit) */
#map-sim-bar .sim-btn { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#map-sim-bar #msb-more, #map-sim-bar .msb-br { display: none; }
#map-sim-bar.compact .msb-2 { display: none; }
#map-sim-bar.compact #msb-more { display: block; flex: 0 0 34px; }
#map-sim-bar.compact #msb-more.on { border-color: #00e5ff; color: #00e5ff; }
#map-sim-bar.compact.more { flex-wrap: wrap; row-gap: 4px; }
#map-sim-bar.compact.more .msb-br { display: block; flex: 0 0 100%; height: 0; order: 1; }
#map-sim-bar.compact.more .msb-2 { display: block; order: 2; }
/* ── TERRAIN CUT (전방 20NM 지형 단면, 맵 높이의 1/5) ── */
#terrain-cut {
  position: absolute; left: 0; right: 0; bottom: 0; height: 20%;
  background: #06090d; border-top: 1px solid #2a3a4a; z-index: 990;
}
/* T-CUT 꺼짐: 지도 100% 높이, 20% 기반 오프셋 전부 0 기준으로.
   ★ 십자마크는 지도 세로 중앙(=leafMap.getCenter, 좌표 입력 기준)과 일치해야 함:
   패널 켜짐(지도 80%) → top:40%, 꺼짐(지도 100%) → top:50% */
#map-wrap.tcut-off #terrain-cut { display: none; }
#map-wrap.tcut-off #map, #map-wrap.tcut-off #map3d { height: 100%; }
#map-wrap.tcut-off #map-crosshair { top: 50%; }
#map-wrap.tcut-off #map-sim-bar { bottom: 0; }
#map-wrap.tcut-off #center-coord { bottom: 44px; }
#map-wrap.tcut-off #fdr-btn-wrap { bottom: 120px; }
#map-wrap.tcut-off #fdr-panel { bottom: 165px; }
#map-wrap.tcut-off.map3d-on #fdr-btn-wrap { bottom: 175px; }
#map-tcut-btn.active { color: #00e5ff; border-color: #00e5ff; box-shadow: 0 0 6px rgba(0,229,255,0.35); }
/* ── HOLD ENTRY (홀딩 진입 판정 레이어) ── */
#map-hold-btn.active { color: #ffb74d; border-color: #ffb74d; box-shadow: 0 0 6px rgba(255,183,77,0.35); }
#hold-entry {
  display: none; position: absolute; right: 8px; top: 48px; z-index: 996;
  width: 226px; max-width: 52%;   /* 분할 화면에서 지도를 덮지 않게 — 창이 아니라 지도 폭 기준 */
  background: rgba(8,12,18,0.94); border: 1px solid #2a3a4a; border-radius: 6px;
  font: 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
}
#map-wrap.hold-entry-on #hold-entry { display: block; }
#hold-entry-head {
  position: relative; color: #ffb74d; font-weight: bold; letter-spacing: .5px;
  padding: 5px 22px 5px 8px; border-bottom: 1px solid #22303c;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#hold-entry-head button {
  position: absolute; top: 50%; right: 5px; transform: translateY(-50%);
  background: none; border: none; color: #667; font-size: 12px; line-height: 1;
  cursor: pointer; padding: 2px 4px;
}
#hold-entry-canvas { display: block; width: calc(100% - 16px); aspect-ratio: 1; margin: 4px auto 0; }
#hold-entry-info { padding: 4px 8px 7px; color: #8fa6bb; line-height: 1.5; }
#hold-entry-info b { color: #e8eaed; }

#terrain-cut canvas { width: 100%; height: 100%; display: block; }
#tcut-title {
  position: absolute; top: 3px; left: 8px; color: #7fa8c9;
  font: bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1px; pointer-events: none;
}
.as-tip {
  background: rgba(10,10,20,0.92) !important; border: 1px solid #555 !important;
  color: #ccc !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  font-size: 11px !important; border-radius: 4px !important;
}
/* Tap-to-add waypoint confirm popup */
.tap-confirm-popup .leaflet-popup-content-wrapper {
  background: #0d1a0d; border: 1.5px solid #00ff88; border-radius: 6px;
  padding: 0; box-shadow: 0 4px 16px rgba(0,0,0,0.8);
}
.tap-confirm-popup .leaflet-popup-tip { background: #0d1a0d; }
.tap-confirm-popup .leaflet-popup-content { margin: 0; }
.apt-wx-popup .leaflet-popup-content-wrapper {
  background: #0a1a0a; border: 1.5px solid #00ff88; border-radius: 6px;
  padding: 0; color: #ccffcc; box-shadow: 0 4px 16px rgba(0,0,0,0.8);
}
.apt-wx-popup .leaflet-popup-tip { background: #0a1a0a; }
.apt-wx-popup .leaflet-popup-content { margin: 0; min-width: 240px; }
.apt-wx-popup .leaflet-popup-close-button { color: #00ff88 !important; font-size: 18px !important; top: 4px !important; right: 6px !important; }
#wx-panel {
  display: none; position: absolute; top: 80px; right: 8px; z-index: 1100;
  width: 380px; background: rgba(5,14,5,0.97); border: 1.5px solid #226622;
  border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  box-shadow: 0 8px 24px rgba(0,0,0,0.85);
}
#wx-panel-header {
  color: #00cc88; font-size: 18px; font-weight: bold; text-align: center;
  letter-spacing: 1px; border-bottom: 1px solid #1a3a1a; padding: 7px 10px 6px;
  position: relative; cursor: grab; user-select: none;
}
#wx-panel-body {
  padding: 8px 10px; display: flex; flex-direction: column; gap: 8px;
  max-height: 520px; overflow-y: auto;
}
.wx-ap-btn {
  background: #0e1e0e; border: 1px solid #1a3a1a; color: #559955;
  border-radius: 3px; padding: 6px 2px; font-size: 16px; font-weight: bold;
  cursor: pointer; letter-spacing: 0.3px; font-family: 'Helvetica Neue', Arial, sans-serif;
  touch-action: manipulation; text-align: center; line-height: 1.4;
  transition: background 0.1s, border-color 0.1s;
}
.wx-ap-btn.wx-ap-sel { background: #002a10; border-color: #00ff88; color: #00ff88; }
#wx-fetch-row { display: flex; gap: 5px; align-items: center; }
#wx-icao {
  flex: 1; background: #050e05; border: 1px solid #226622; color: #00ff88;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 18px; font-weight: bold;
  padding: 5px 6px; border-radius: 3px; outline: none; min-width: 0;
  text-transform: uppercase; letter-spacing: 3px;
}
.wx-fetch-btn {
  background: #0d2010; border: 1px solid #226622; color: #00cc88;
  font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 18px; font-weight: bold;
  padding: 5px 10px; border-radius: 3px; cursor: pointer; letter-spacing: 0.5px;
  touch-action: manipulation; white-space: nowrap;
  transition: background 0.1s, border-color 0.1s;
}
.wx-fetch-btn:active { background: #003a18; border-color: #00ff88; }
#wx-result {
  font-size: 18px; line-height: 1.6; color: #aaa;
  border-top: 1px solid #1a3a1a; padding-top: 6px;
}

/* ── Flight Plan (Garmin CDU Style) ── */
#fp-wrap {
  /* CDU와 같은 프레임을 쓰므로 배경·정렬은 #cdu-wrap과 동일하게 */
  background: #111;
  position: relative;
  overflow: hidden;
  font-family: 'Arial', sans-serif;
  color: white;
}
.fp-mode-title {
  background: linear-gradient(to bottom, #555, #111);
  text-align: center; padding: 4px 8px;
  font-size: 9px; font-weight: bold; letter-spacing: 1px;
  border-bottom: 1px solid #000; color: #eee; flex-shrink: 0;
}
.fp-content-area {
  flex: 1; display: flex; flex-direction: column;
  padding: 6px; overflow-y: auto; gap: 5px; min-height: 0;
}
.fp-panel-border {
  border: 1.5px solid #87ceeb; border-radius: 5px;
  padding: 6px; background: #000;
  display: flex; flex-direction: column; overflow-y: auto; gap: 3px;
}
.fp-footer-nav {
  height: 50px; display: flex; justify-content: space-around;
  align-items: center; background: #111;
  border-top: 1.5px solid #333; padding: 0 3px; flex-shrink: 0;
}
.fp-nav-btn {
  background: linear-gradient(to bottom, #444, #111, #000);
  border: 1px solid #444; border-radius: 5px;
  padding: 4px 2px; flex: 1; max-width: 68px;
  height: 40px; box-sizing: border-box;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
  cursor: pointer; font-size: 7px; color: white;
  touch-action: manipulation; transition: transform 0.05s;
  text-align: center; line-height: 9px; margin: 0 2px;
}
.fp-nav-btn:active { background: linear-gradient(to bottom, #555, #222, #111); transform: scale(0.95); }
/* 아이콘 줄 상자 고정 — nav-btn과 같은 이유 */
.fp-nav-btn span { font-size: 13px; line-height: 16px; height: 16px; display: block; pointer-events: none; }
.fp-nav-btn.fp-nav-enter { background: #1a2a4a; border-color: #87ceeb; }
.fp-nav-btn.fp-nav-active { background: linear-gradient(to bottom, #0e2a0e, #050d05); border-color: #00cc00; color: #00ff88; }
.fp-wp-row {
  display: grid;
  grid-template-columns: 14px 18px 1fr 34px 38px 30px 26px;
  align-items: center; gap: 2px;
  padding: 5px 4px; border-bottom: 1px solid #0e0e0e;
  cursor: pointer; touch-action: manipulation;
}
.fp-wp-row:active { background: #0a1510; }
.fp-wp-row.active-wp { background: #081a08; border-left: 3px solid #00ff88; }
.fp-wp-seq { color: #333; font-size: 8px; }
/* 순서 바꾸기 손잡이 — 여기만 끌면 목록이 스크롤되지 않고 행이 따라온다 */
.fp-wp-grip {
  color: #4a5a6a; font-size: 12px; line-height: 1; text-align: center;
  cursor: grab; touch-action: none; user-select: none;
}
.fp-wp-grip:active { cursor: grabbing; color: #87ceeb; }
.fp-wp-row.fp-dragging {
  background: #0d1b2a; opacity: 0.9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.6); border-bottom-color: #87ceeb;
}
.fp-wp-ident { color: #fff; font-weight: bold; font-size: 12px; }
.fp-wp-hdg { color: #c8ff00; font-size: 10px; font-weight: bold; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
.fp-wp-dist { color: #00ffff; font-size: 10px; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
.fp-wp-hold {
  background: transparent; border: 1px solid #2a2a2a; color: #555;
  width: 28px; height: 22px; font-size: 8px; font-weight: bold;
  cursor: pointer; border-radius: 2px;
  display: flex; align-items: center; justify-content: center; touch-action: manipulation;
}
.fp-wp-hold.active { border-color: #ffcc44; color: #ffcc44; background: #201a06; }
/* ── 홀딩 설정 화면 ── */
.hold-row { display: grid; grid-template-columns: 62px 1fr; align-items: center; gap: 6px; margin-bottom: 7px; }
.hold-lbl { color: #87ceeb; font-size: 9px; font-weight: bold; letter-spacing: 0.5px; }
.hold-seg { display: flex; gap: 4px; }
.hold-btn {
  flex: 1; background: #0d0d0d; border: 1px solid #2a2a2a; color: #777;
  font-size: 10px; font-weight: bold; padding: 6px 0; border-radius: 3px;
  cursor: pointer; touch-action: manipulation; text-align: center;
}
.hold-btn.on { border-color: #ffcc44; color: #ffcc44; background: #201a06; }
.hold-spin { display: flex; align-items: center; gap: 4px; }
.hold-spin .hold-btn { flex: 0 0 30px; }
.hold-val {
  flex: 1; text-align: center; color: #ffcc44; font-weight: bold; font-size: 15px;
  background: #080808; border: 1px solid #222; border-radius: 3px; padding: 5px 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
.fp-wp-del {
  background: transparent; border: 1px solid #442222; color: #cc4444;
  width: 24px; height: 22px; font-size: 11px; cursor: pointer; border-radius: 2px;
  display: flex; align-items: center; justify-content: center; touch-action: manipulation;
}
.fp-section-hdr {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 4px; background: #0c1520;
  border-bottom: 1px solid #1a2a3a;
  color: #87ceeb; font-size: 8px; font-weight: bold; letter-spacing: 0.5px;
}
.fp-empty-state {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; padding: 16px 8px; flex: 1;
}
.fp-empty-label { color: #2a4a3a; font-size: 8px; letter-spacing: 1px; margin-bottom: 4px; }
.fp-empty-btn {
  width: 100%; padding: 10px;
  background: linear-gradient(to bottom, #1a2a3a, #0a1520);
  border: 1.5px solid #2a4a6a; border-radius: 5px;
  color: #87ceeb; font-size: 10px; font-weight: bold;
  text-align: center; cursor: pointer; touch-action: manipulation;
  letter-spacing: 0.5px;
}
.fp-empty-btn:active { background: #1a2a4a; }
.fp-ap-grid { display: flex; flex-wrap: wrap; gap: 4px; }
.fp-ap-btn {
  background: linear-gradient(to bottom, #1a2a3a, #0a1520);
  border: 1px solid #2a4a6a; color: #00ffff;
  padding: 6px 4px; font-size: 11px; cursor: pointer;
  border-radius: 4px; touch-action: manipulation;
  font-weight: bold; min-width: 42px; text-align: center; flex: 1;
}
.fp-ap-btn:active { background: #0a1a2a; }
.fp-input-type-btn {
  height: 48px;
  background: linear-gradient(to bottom, #444, #111, #000);
  border: 1px solid #444; border-radius: 4px;
  color: #fff; font-size: 10px; font-weight: bold;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px;
  cursor: pointer; touch-action: manipulation;
  transition: transform 0.05s;
}
.fp-input-type-btn:active { transform: scale(0.95); background: linear-gradient(to bottom, #555, #222, #111); }
.fp-input-type-btn.fp-cyan { border-color: #87ceeb; color: #87ceeb; }
.fp-disp-box {
  flex: 1; height: 42px;
  background: #000; border: 1.5px solid #555; border-radius: 4px;
  color: #c8ff00; font-size: 20px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; letter-spacing: 2px; padding: 0 10px;
}
.fp-disp-cursor { font-size: 16px; color: #87ceeb; animation: fp-blink 0.9s step-start infinite; }
@keyframes fp-blink { 50% { opacity: 0; } }
.fp-key-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
.fp-key {
  height: 44px;   /* CDU item-btn 높이 수준 */
  background: radial-gradient(circle at 30% 30%, #444, #111);
  border: 0.7px solid #555; border-radius: 5px;
  color: white; font-size: 15px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; touch-action: manipulation;
  transition: transform 0.05s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.fp-key:active { background: radial-gradient(circle at 30% 30%, #666, #222); transform: scale(0.92); }
.fp-numpad-grid { display: grid; grid-template-columns: repeat(3, 44px); gap: 8px; justify-content: center; margin: 6px auto; }
/* 화면 안에 함께 놓는 숫자판 — 값 칸 바로 아래에 붙여 두느라 5열로 낮게 만든다.
   (종전에는 숫자판만 있는 화면으로 넘어갔다 돌아왔다) */
.fp-pad5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-top: 7px; }
.fp-pad-key {
  height: 38px; background: radial-gradient(circle at 30% 30%, #3a3a3a, #111);
  border: 0.7px solid #555; border-radius: 6px;
  color: #fff; font-size: 15px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; touch-action: manipulation; box-shadow: 0 2px 4px rgba(0,0,0,0.6);
}
.fp-pad-key:active { transform: scale(0.95); box-shadow: inset 0 2px 5px rgba(0,0,0,0.8); }
.fp-pad-key.wide { grid-column: span 2; }
.fp-pad-key.ent  { background: #00252e; border-color: #00e5ff; color: #00e5ff; font-size: 13px; }
.fp-pad-key.clr  { background: #2a0e0e; border-color: #663333; color: #ff6666; font-size: 13px; }
.fp-num-circ {
  width: 42px; height: 42px;
  background: radial-gradient(circle at 30% 30%, #444, #111);
  border: 0.7px solid #555; border-radius: 50%;
  color: white; font-size: 16px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; touch-action: manipulation;
  box-shadow: 0 3px 5px rgba(0,0,0,0.6);
  transition: transform 0.05s;
}
.fp-num-circ:active { background: radial-gradient(circle at 30% 30%, #666, #222); transform: scale(0.95); box-shadow: inset 0 3px 6px rgba(0,0,0,0.8); }
.fp-bksp-btn {
  flex-shrink: 0; width: 42px; height: 42px;
  background: linear-gradient(to bottom, #444, #111, #000);
  border: 0.7px solid #555; border-radius: 6px;
  color: white; font-size: 9px; font-weight: bold;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; touch-action: manipulation;
}
.fp-bksp-btn:active { background: linear-gradient(to bottom, #555, #222, #111); }
.fp-ifr-tab-row { display: flex; gap: 3px; margin-bottom: 5px; }
.fp-ifr-tab {
  flex: 1; height: 30px;
  background: #2c2c2c; border: 0.7px solid #444;
  border-radius: 4px 4px 0 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; cursor: pointer; color: #aaa; touch-action: manipulation;
}
.fp-ifr-tab.active { background: #eee; color: black; font-weight: bold; }
.fp-ifr-sel {
  background: #0a0a0a; border: 1px solid #1a5a1a; color: #c8ff00;
  padding: 6px; font-size: 11px; border-radius: 3px; width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
.fp-ifr-lbl { color: #87ceeb; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin-top: 4px; }
.fp-ifr-add {
  background: linear-gradient(to bottom, #1a3a1a, #0a1a0a);
  border: 1px solid #2a6a2a; color: #00ff88;
  padding: 8px; font-size: 10px; cursor: pointer; border-radius: 4px;
  font-weight: bold; text-align: center; touch-action: manipulation;
  margin-top: 6px;
}
.fp-ifr-add:active { background: #0e1a0e; }
.fp-phase-badge {
  font-size: 7px; padding: 0 2px; border-radius: 2px;
  vertical-align: middle; margin-right: 2px; font-weight: bold; display: inline-block;
}
.badge-dep { background: #0d280d; color: #00cc44; border: 1px solid #226622; }
.badge-enr { background: #0d1a2e; color: #4488ff; border: 1px solid #224466; }
.badge-app { background: #2e1a0d; color: #ff8844; border: 1px solid #664422; }
.sim-btn.on { background: linear-gradient(to bottom, #0e2a0e, #050d05, #000); border-color: #00cc00; color: #00ee00; }
.sim-btn {
  flex: 1; min-width: 0; background: linear-gradient(to bottom, #333, #111, #000);
  border: 1px solid #444; color: #fff;
  padding: 6px 2px; font-size: 10px; cursor: pointer; border-radius: 4px;
  text-align: center; touch-action: manipulation; font-weight: bold;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  white-space: nowrap; overflow: hidden;
}
.sim-btn:active { background: linear-gradient(to bottom, #555, #222, #111); }
.sim-btn.clr { border-color: #552222; color: #ee7777; }
.ac-marker svg { display: block; }
        :root {
            --bg-dark: #050505;
            --text-green: #c8ff00; 
            --text-cyan: #00ffff;
            --active-blue: #87ceeb;
            --btn-grad: linear-gradient(to bottom, #444, #111, #000);
            --border-3d: 1px solid #444;
        }


        .cdu-frame {
            width: 354px;
            height: 567px;
            box-sizing: border-box;
            background-color: #111; padding: 8px; border-radius: 12px; border: 3px solid #000;
            display: flex; flex-direction: column;
            box-shadow: 0 13px 33px rgba(0,0,0,0.9);
            font-family: 'Arial', sans-serif; color: white; touch-action: manipulation;
        }
        
        .touch-display { background-color: var(--bg-dark);
            flex: 1; display: flex; flex-direction: column; border: 1.5px solid #000; overflow: hidden;
        }

        /* Header (CNS Bar) */
        .header-grid { display: grid;
            grid-template-columns: 0.9fr 1.2fr 0.8fr 1.2fr 0.8fr; background: #111; padding: 4px; gap: 3px; border-bottom: 1.5px solid #333; height: 63px;
        }
        .header-box { background: #0a0a0a; border: 0.7px solid #444; display: flex; flex-direction: column;
            align-items: center; justify-content: center; position: relative; overflow: hidden; }
        .header-label { font-size: 6px; color: #888; text-align: center; width: 100%; pointer-events: none; }
        .freq-act { color: white; font-size: 11px; font-weight: bold; }
        .freq-stby { color: var(--text-cyan); font-size: 10px; font-weight: bold; }
        .swap-arrow { font-size: 10px; color: #777; cursor: pointer; padding: 2px; z-index: 10;}
        .green-ind { color: var(--text-green); font-size: 8px; font-weight: bold; text-align: center; line-height: 1.1; }

        /* --- 기능 활성화 버튼 시각적 강조 스타일 --- */
        .func-active {
            background: linear-gradient(to bottom, rgba(135, 206, 235, 0.25) 0%, #444 40%, #1a1a1a 100%) !important;
            border-top: 1px solid rgba(135, 206, 235, 0.6) !important;
            transition: background 0.1s ease;
        }
        .func-active:active {
            background: linear-gradient(to bottom, rgba(135, 206, 235, 0.4) 0%, #555 40%, #222 100%) !important;
        }
        .top-func-btn {
            background: linear-gradient(to bottom, rgba(135, 206, 235, 0.2) 0%, transparent 80%);
            transition: background 0.1s ease;
        }
        .top-func-btn:active {
            background: rgba(135, 206, 235, 0.35);
        }

        /* Titles and Sub-headers */
        .mode-title-bar { background: linear-gradient(to bottom, #3a5f86 0%, #1b3654 55%, #0d1d30 100%);
            text-align: center; padding: 3px; font-size: 10px; font-weight: bold; border-bottom: 1px solid #000; color: #e8f3ff;
            border-radius: 0 0 12px 12px; margin: 0 18%; box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.6);
        }
        .sub-header { display: flex; align-items: flex-end; padding: 4px 7px 0 7px;
            gap: 5px; background: #1a1a1a; }
        .user-3d-btn { height: 37px; background: var(--btn-grad);
            border: var(--border-3d); border-radius: 4px 4px 0 0; font-size: 7px; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0 5px;
        }
        
        .tab-container { display: flex; flex: 1; gap: 3px; }
        .tab { flex: 1; height: 30px; background: #2c2c2c; border: 0.7px solid #444;
            border-radius: 4px 4px 0 0; display: flex; align-items: center; justify-content: center; font-size: 7px; cursor: pointer; color: #aaa;
        }
        .tab.active { background: #eee; color: black; font-weight: bold; height: 32px; margin-top: -2px; }

        /* Main Content */
        #mainContentArea { flex: 1; display: flex; flex-direction: column; padding: 7px; overflow-y: auto; }
        .panel-border { flex: 1; border: 1.5px solid var(--active-blue); border-radius: 5px; padding: 8px; background: black; display: flex; flex-direction: column; }

        /* Common Buttons with enhanced active states for touch feedback */
        .item-btn { height: 32px;   /* CDU 버튼 90 % (노브 줄 자리) */ background: var(--btn-grad); border: var(--border-3d);
            color: white; font-size: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; border-radius: 4px; position: relative; text-align: center;
            transition: transform 0.05s, background 0.1s;
        }
        .item-btn:active {
            background: linear-gradient(to bottom, #555, #222, #111); 
            transform: scale(0.96);
        }
        .status-line { position: absolute; bottom: 3px; width: 70%; height: 2px; background: #333; border-radius: 1.5px; }
        /* CDU TCAS(Traffic Settings · Transponder — 09b-cdu-screens.js renderTcasScreen) — 세 칸 · 칸마다 머리글 · 아래 Transponder · System Test */
        .tcas-wrap { display: flex; gap: 6px; padding: 4px 2px 0; }
        .tcas-col { flex: 1; display: flex; flex-direction: column; gap: 5px; border: 1px solid #333; border-radius: 4px; padding: 4px; min-width: 0; }
        .tcas-hd { color: #fff; font-size: 9px; text-align: center; padding-bottom: 3px; border-bottom: 1px solid #555; white-space: nowrap; }
        .tcas-btn span { display: block; margin-top: 1px; }
        .tcas-foot { display: flex; gap: 6px; padding: 6px 2px 0; }
        .tcas-foot .item-btn { flex: 1; }
        .on .status-line { background: var(--text-green); box-shadow: 0 0 3px var(--text-green); }

        /* Sliders */
        .volume-row { display: grid; grid-template-columns: 50px 43px 1fr 63px; align-items: center; margin-bottom: 7px; gap: 5px; }
        .wedge-slider { height: 28px; background: #111; border: 0.7px solid #444; position: relative; overflow: hidden; cursor: ew-resize; border-radius: 3px; }
        .wedge-fill { height: 100%; background: linear-gradient(to right, #1a3a4a, #00d2ff); clip-path: polygon(0% 100%, 100% 0%, 100% 100%); pointer-events: none; }
        .wedge-text { position: absolute; left: 7px; top: 8px; font-size: 8px; color: var(--active-blue); font-weight: bold; z-index: 3; pointer-events: none; }

        /* Audio Radios */
        .freq-display-box { height: 35px; background: #0a0a0a; border: 0.7px solid #444; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; padding-right: 5px; border-radius: 4px; cursor: pointer; transition: background 0.1s; }
        .freq-display-box:active { background: #1a1a1a; }

        /* Intercom Grid */
        .intercom-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 5px; }
        .loop-row { display: flex; gap: 8px; margin-top: 10px; }

        /* Numpad with optimized touch targets */
        .input-row { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 10px 0 20px 0; }
        .freq-box-main { width: 120px; height: 40px; background: #000; border: 1.5px solid #555; border-radius: 4px; color: var(--text-green); font-size: 22px; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        .numpad-grid { display: grid; grid-template-columns: repeat(3, 65px); gap: 12px; justify-content: center; }
        .xpdr-numpad-grid { display: grid; grid-template-columns: repeat(4, 55px); gap: 10px; justify-content: center; margin-bottom: 15px;}
        .selcal-grid { display: grid; grid-template-columns: repeat(5, 45px); gap: 8px; justify-content: center; }
        
        .num-circle { 
            width: 55px; height: 55px; /* Increased touch target */
            background: radial-gradient(circle at 30% 30%, #444, #111); border: 0.7px solid #555; border-radius: 50%; color: white; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 3px 5px rgba(0,0,0,0.6); 
            transition: transform 0.05s, background 0.1s;
        }
        .num-circle:active {
            background: radial-gradient(circle at 30% 30%, #666, #222);
            box-shadow: inset 0 3px 6px rgba(0,0,0,0.8);
            transform: scale(0.95);
        }

        /* Footer */
        /* 노브 셋 — 세 칸을 같은 너비로 나눠 노브 간격이 일정하다 · 노브 옆은 라벨 바 */
        #cdu-knobs { display: grid; grid-template-columns: repeat(3, 1fr); align-items: center; height: 44px; background: #0b0b0b; border-top: 1px solid #2a2a2a; flex-shrink: 0; padding: 0 4px; }
        .cdu-kcell { display: flex; align-items: center; gap: 5px; min-width: 0; padding-left: 6px; }
        .cdu-klbl { font: 7.5px/1.2 Helvetica Neue, Arial, sans-serif; color: #e8e8e8; white-space: nowrap; overflow: hidden; min-width: 0; }
        .cdu-klbl b { color: #2fe0e0; }
        .cdu-knob { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; cursor: pointer; position: relative; touch-action: none; user-select: none;
                    background: radial-gradient(circle at 35% 30%, #666, #222 60%, #111); border: 2px solid #444; box-shadow: 0 2px 4px #000, inset 0 1px 2px #888; box-sizing: border-box; }
        .cdu-knob i { position: absolute; left: 50%; top: 2px; width: 3px; height: 9px; margin-left: -1.5px; background: #ddd; border-radius: 2px; pointer-events: none; }
        .cdu-knob::after { content: ''; position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px; border-radius: 50%; pointer-events: none;
                    background: radial-gradient(circle at 40% 35%, #777, #2a2a2a 70%); border: 1px solid #555; }
        .cdu-knob.kj::after { width: 14px; height: 14px; margin: -7px; background: radial-gradient(circle at 40% 35%, #aaa, #333 70%); border-color: #888; }
        .cdu-knob.kd::after { width: 20px; height: 20px; margin: -10px; border: 2px solid #666; }
        .cdu-knob.pressed { box-shadow: 0 1px 2px #000, inset 0 0 4px #2fe0e0; }
        #h-com1-stb.knob-tuned, #h-com2-stb.knob-tuned { background: #9ff3ff; color: #000; border-radius: 2px; }
        #knob-ptr { position: absolute; z-index: 1200; pointer-events: none; width: 0; height: 0; }
        #knob-ptr .kp-x { position: absolute; left: -11px; top: -11px; width: 22px; height: 22px; animation: kpBlink 1s steps(1) infinite;
                    background: linear-gradient(#fff,#fff) center/2px 100% no-repeat, linear-gradient(#fff,#fff) center/100% 2px no-repeat; filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 1px #000); }
        @keyframes kpBlink { 50% { filter: invert(1) drop-shadow(0 0 1px #fff); } }
        #knob-ptr .kp-info { position: absolute; left: 14px; top: 10px; background: rgba(0,0,0,.78); color: #fff; font: 10px/1.25 Helvetica Neue, Arial, sans-serif; padding: 2px 5px; border: 1px solid #2fe0e0; border-radius: 3px; white-space: nowrap; }
        #knob-ptr .kp-info b { color: #2fe0e0; } #knob-ptr .kp-info span { color: #9ab; font-size: 9px; }
        .footer-nav { height: 48px; display: flex; justify-content: space-around; align-items: center; background: #111; border-top: 1.5px solid #333; padding: 0 5px; }
        .nav-btn { background: var(--btn-grad); border: var(--border-3d); border-radius: 5px; padding: 4px 4px;
                   /* 개수와 라벨 길이에 상관없이 모두 같은 크기 — Flight Plan 푸터와 동일한 규칙 */
                   flex: 1 1 0; min-width: 0; max-width: 61px; margin: 0 2px;
                   height: 38px; box-sizing: border-box;
                   display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
                   cursor: pointer; font-size: 7px; line-height: 9px; color: white; transition: transform 0.05s, background 0.1s; }
        .nav-btn:active { background: linear-gradient(to bottom, #555, #222, #111); transform: scale(0.95); }
        /* 아이콘 줄 상자를 고정 — 이모지/기호의 글리프 높이 차이로 버튼 크기가 달라지지 않게 */
        .nav-btn span { font-size: 14px; line-height: 17px; height: 17px; display: block; pointer-events: none; }
        .enter-btn-blue { background: #1a2a4a; border: 1px solid var(--active-blue); }
        .enter-btn-blue:active { background: #2a4a7a; }

        
        /* Home Grid */
        .home-grid { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 7px 5px; padding: 4px; }
        .home-icon-wrapper { width: 23%; display: flex; flex-direction: column; align-items: center; cursor: pointer; text-decoration: none; color: inherit; }
        .icon-box { width: 44px; height: 44px; background: linear-gradient(to bottom, #444, #1a1a1a); border-radius: 8px; border: 1px solid #555; display: flex; align-items: center; justify-content: center; margin-bottom: 3px; overflow: hidden; box-shadow: 0 3px 5px rgba(0,0,0,0.6); transition: transform 0.05s; }
        .icon-box:active { transform: scale(0.92); }
        .icon-box svg { width: 70%; height: 70%; }
        .icon-label { font-size: 8px; color: #eee; text-align: center; font-weight: bold; line-height: 1.1; pointer-events: none; min-height: 18px; display: flex; align-items: flex-start; justify-content: center; }
        /* ── CDU 버튼 디자인(실기 CDU 사진 · 크기·글씨 90 %) — 회색 바탕 위 검은 사각 버튼 · 밝은 테두리 · 아이콘 위 · 글자는 버튼 안 아래 ── */
        #mainContentArea:has(> .home-grid), #mainContentArea:has(> .acsys-page > .home-grid) {
            background: radial-gradient(ellipse at 30% 20%, #8a8c8e 0%, #6f7173 45%, #5d5f61 100%); }
        .home-grid { gap: 7px 6px; padding: 6px 2px; }
        .home-icon-wrapper { width: 19%; height: 60px; box-sizing: border-box; justify-content: space-between; padding: 5.4px 2.7px 4.5px;
            background: linear-gradient(to bottom, #20262c 0%, #07090b 55%, #000 100%); border: 2px solid #d4d8db; border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12); transition: transform 0.05s, border-color 0.1s; }
        .home-icon-wrapper:active { transform: scale(0.95); border-color: #2fe0e0; }
        .home-icon-wrapper .icon-box, .home-icon-wrapper .icon-box.func-active { width: 100%; height: 31px; margin: 0; border: none !important;
            background: none !important; box-shadow: none; border-radius: 0; overflow: visible; }
        .home-icon-wrapper .icon-box:active { transform: none; }
        .home-icon-wrapper .icon-box svg { width: auto; height: 100%; max-width: 80%; }
        .home-icon-wrapper .icon-label { font-size: 9px; line-height: 1.05; color: #fff; min-height: 0; align-items: center;
            font-family: 'Helvetica Neue', Arial, sans-serif; text-shadow: 0 1px 1px #000; }
        /* Waypoint Info — 사진처럼 3칸씩(마지막 줄 Create Waypoint · Airport INFO 는 가운데) */
        .wpt-grid { gap: 9px 8px; padding-top: 10px; }
        .wpt-grid .home-icon-wrapper { width: 26%; }
        /* Aircraft Systems — 사진의 자리: 4칸 격자 두 줄(빈칸 하나) · 아래 한 줄은 바닥에 */
        #mainContentArea:has(> .acsys-grid) { display: flex; flex-direction: column; }
        .acsys-grid { display: grid; grid-template-columns: repeat(4, 19%); justify-content: center; gap: 7px 6px; }
        .acsys-grid .home-icon-wrapper { width: 100%; }
        .acsys-grid.acsys-bot { margin-top: auto; }
        .acsys-empty { height: 60px; }
        .acsys-iconly .icon-box, .acsys-iconly .icon-box.func-active { height: 100%; }
        .acsys-iconly .icon-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        .acsys-txtbtn { justify-content: center; gap: 4px; }
        .acsys-txt { font: bold 9px/1.1 'Helvetica Neue', Arial, sans-serif; color: #fff; text-align: center; text-shadow: 0 1px 1px #000; pointer-events: none; }
        .acsys-txtbtn .acsys-sub { color: #2fe0ff; font-size: 11px; font-weight: bold; }
        
        /* PERF Page Styles */
        .perf-row { display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center; }
        .perf-label { font-size: 8px; color: #ccc; margin-bottom: 2px; }
        .perf-val-box { border: 1px solid var(--active-blue); background: #000; padding: 4px 8px; border-radius: 4px; color: var(--text-green); font-size: 12px; font-weight: bold; min-width: 50px; text-align: center; cursor: pointer; transition: background 0.1s; }
        .perf-val-box:active { background: #222; }
        .perf-result-box { background: #1a1a1a; border: 1px solid #555; padding: 3px 2px; border-radius: 4px; color: white; font-size: 11px; font-weight: bold; min-width: 45px; text-align: center; display: flex; align-items: center; justify-content: center; }
        .perf-result-title { font-size: 6.5px; color: var(--text-cyan); text-align: center; margin-bottom: 2px; line-height: 1.1; }
        
        /* Error/Warning Animation */
        @keyframes blink { 50% { opacity: 0.4; } }

/* Ship Control */
#ship-panel {
  display: none; position: absolute; bottom: 55px; right: 8px; z-index: 1100;
  width: 196px; background: #111; border: 1.5px solid #2a2a2a; border-radius: 10px;
  padding: 10px; font-family: 'Arial', sans-serif;
  box-shadow: 0 8px 24px rgba(0,0,0,0.85);
}
.ship-tab {
  flex: 1; background: #1a1a1a; border: 1px solid #3a3a3a; color: #666;
  border-radius: 4px; padding: 5px 0; font-size: 9px; font-weight: bold;
  cursor: pointer; letter-spacing: 0.5px; transition: background 0.1s;
}
.ship-tab.ship-tab-active { background: #0d2040; border-color: #7ab8f5; color: #7ab8f5; }
/* 난이도 — 상·중·하를 색으로 가른다 */
.ship-lvl { font-size: 11px; padding: 4px 0 3px; line-height: 1.2; }
.ship-lvl small { display: block; font-size: 6.5px; font-weight: normal; letter-spacing: 0; opacity: 0.85; }
.ship-lvl.ship-tab-active[data-lvl="HI"]  { background: #3a0f0f; border-color: #ff6b6b; color: #ff8a8a; }
.ship-lvl.ship-tab-active[data-lvl="MID"] { background: #3a2a00; border-color: #ffb74d; color: #ffcc66; }
.ship-lvl.ship-tab-active[data-lvl="LO"]  { background: #0d2a14; border-color: #4ade80; color: #6ee79a; }
.ship-num {
  background: radial-gradient(circle at 35% 35%, #3c3c3c, #111);
  border: 0.7px solid #555; border-radius: 50%; color: #fff;
  font-size: 15px; font-weight: bold; width: 100%; aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.6);
  transition: transform 0.05s, background 0.1s;
}
.ship-num:active { transform: scale(0.91); background: radial-gradient(circle at 35% 35%, #555, #222); }
.ship-clr { background: radial-gradient(circle at 35% 35%, #3a1010, #1a0000) !important; border-color: #772222 !important; font-size: 9px !important; }
.ship-ent { background: radial-gradient(circle at 35% 35%, #0d1f4a, #060e20) !important; border-color: #3355bb !important; color: #88aaff !important; font-size: 9px !important; }
.sim-btn.ship-active { background: #1a3050; border-color: #7ab8f5; color: #7ab8f5; }
/* ── 야간(Night) 모드: 밝은 지도/차트를 어둡게, 붉은 딤 오버레이 ── */
body.night-mode #map, body.night-mode #map3d { filter: brightness(0.5) contrast(1.05); }
body.night-mode #pfd { filter: brightness(0.72); }
body.night-mode #pdfViewArea, body.night-mode #cdu-wrap { filter: brightness(0.72); }
body.night-mode::after {
  content: ''; position: fixed; inset: 0; z-index: 4000; pointer-events: none;
  background: rgba(40,0,0,0.16); mix-blend-mode: multiply;
}

/* ── 시작 안내 오버레이 ── */
/* ── 시작 잠금(비밀번호) — 무엇보다 위에서 앱 전체를 덮는다 ── */
#gate-overlay {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 40%, #102030 0%, #05080c 70%);
}
body.gate-open #gate-overlay { display: none; }
#gate-box {
  display: flex; flex-direction: column; align-items: stretch; gap: 10px;
  width: min(300px, calc(100vw - 32px)); padding: 24px 20px;
  background: #0d151d; border: 1px solid #2a3a4a; border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.6);
}
#gate-box .gate-title { color: #00e5ff; font: bold 17px Helvetica, Arial, sans-serif; text-align: center; letter-spacing: 1px; }
#gate-box .gate-sub { color: #9fb0c0; font-size: 13px; text-align: center; }
#gate-pw {
  font-size: 16px; padding: 10px 12px; border-radius: 6px;
  border: 1px solid #3a4a5a; background: #05080c; color: #fff; outline: none;
}
#gate-pw:focus { border-color: #00e5ff; }
#gate-ok {
  font-size: 15px; font-weight: bold; padding: 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid #00e5ff; background: rgba(0,229,255,0.15); color: #00e5ff;
}
#gate-msg { min-height: 16px; color: #ff6666; font-size: 12px; text-align: center; }
#gate-mode { display: none; flex-direction: column; gap: 10px; }
#gate-box.choose > :not(#gate-mode):not(.gate-title) { display: none; }
#gate-box.choose #gate-mode { display: flex; }
.gate-mode-btn { display: flex; flex-direction: column; gap: 3px; align-items: center; padding: 12px 10px; border-radius: 8px; cursor: pointer;
                 border: 1px solid #2f5a6a; background: rgba(0,229,255,0.08); color: #e8f6ff; font-size: 15px; }
.gate-mode-btn span { font-size: 11px; color: #8fa6b6; }
#gate-ac { display: flex; gap: 8px; flex-wrap: wrap; }
.gate-ac-btn { flex: 1 1 140px; display: flex; flex-direction: column; gap: 3px; align-items: center; padding: 10px 8px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,0.04); border: 1px solid #3a4a58; color: #d8e4ee; font-size: 14px; }
.gate-ac-btn span { font-size: 11px; color: #8fa6b6; }
.gate-ac-btn.on { border-color: #ffd23a; background: rgba(255,210,58,0.16); color: #fff; }
.gate-mode-btn:hover, .gate-mode-btn:focus { border-color: #00e5ff; background: rgba(0,229,255,0.18); outline: none; }
#gate-box.shake { animation: gate-shake 0.35s; }
@keyframes gate-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
#help-overlay {
  position: fixed; inset: 0; z-index: 5000;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: center; justify-content: center;
}
#help-panel {
  width: min(560px, 92vw); max-height: 86vh;
  background: #0c1118; border: 1px solid #3a6ea5; border-radius: 10px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.8);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
#help-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: #101a28; border-bottom: 1px solid #24405e;
  color: #7ab8f5; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;
}
#help-head button {
  background: none; border: none; color: #ff6655; font-size: 16px; font-weight: bold;
  cursor: pointer; padding: 0 4px;
}
#help-body {
  padding: 10px 16px; overflow-y: auto; -webkit-overflow-scrolling: touch;
  color: #ccc; font-size: 12px; line-height: 1.55;
}
#help-body h3 { color: #8ac6ff; font-size: 12px; margin: 10px 0 4px; letter-spacing: 0.5px; }
#help-body ul { margin: 0 0 4px; padding-left: 18px; }
#help-body li { margin-bottom: 2px; }
#help-body b { color: #ffd54f; font-weight: bold; }
#help-body table {
  width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 11px;
}
#help-body td { border: 1px solid #223349; padding: 3px 7px; }
#help-body td b { color: #7fffb0; }
#help-body .help-note { color: #778; font-size: 10px; margin-top: 4px; }
#help-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 14px; background: #101a28; border-top: 1px solid #24405e;
}
#help-foot label { color: #99a; font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
#help-foot button {
  background: #14324f; border: 1px solid #4a90d9; color: #8ac6ff;
  font-size: 12px; font-weight: bold; padding: 7px 20px; border-radius: 5px; cursor: pointer;
}
#help-foot button:active { background: #1e4a75; color: #fff; }

/* ── UPPER CONSOLE(상부 콘솔 · js/17-upper.js) — 1000×950 설계 크기를 창에 맞춰 통째로 줄이고 키운다 ── */
#ovhd-wrap, #lcon-wrap { position: relative; overflow: hidden; background: #15171a; }
/* SYSTEM 창(js/18-system.js) — 캔버스 하나에 MFD 계통 화면 */
#sysp-wrap { position: relative; overflow: hidden; background: #000; }
#grip-wrap { position: relative; overflow: auto; background: #0b0e12; }
#grip-wrap .grip-row { display: flex; gap: 10px; justify-content: center; align-items: stretch; height: 100%; padding: 8px; box-sizing: border-box; }
#grip-wrap .grip-cell { flex: 1 1 0; min-width: 0; max-width: 460px; display: flex; flex-direction: column; align-items: center; }
#grip-wrap .grip-t { color: #8fa6b6; font: bold 11px 'Helvetica Neue', Arial, sans-serif; letter-spacing: 1px; margin: 2px 0 4px; }
#grip-wrap .grip-cell > div:last-child { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; justify-content: center; }
#grip-wrap svg { height: 100%; width: auto; max-width: 100%; touch-action: none; user-select: none; }
#sysp-wrap canvas { display: block; }
/* SYSTEM 창 Map 화면(18-system.js) — 큰 칸에 얹은 2D 지도 */
/* SAR CONTROL(24-sar.js) — 함정 설정창과 같은 꼴 */
#sar-panel { display: none; position: fixed; top: 70px; right: 130px; z-index: 1200; width: 214px; background: #111;
  border: 1.5px solid #2a2a2a; border-radius: 10px; padding: 10px; font-family: Arial, sans-serif; color: #cde;
  box-shadow: 0 8px 24px rgba(0,0,0,0.85); }
#sar-panel .sar-hd { color: #ff9a3c; font-size: 10px; font-weight: bold; text-align: center; letter-spacing: 1px;
  border-bottom: 1px solid #222; padding-bottom: 6px; margin-bottom: 8px; position: relative; cursor: grab; user-select: none; touch-action: none; }
#sar-panel .sar-in { display: flex; gap: 3px; } #sar-panel .sar-in input { flex: 1; min-width: 0; background: #0b0b0b; color: #eee; border: 1px solid #3a3a3a; border-radius: 3px; font-size: 11px; padding: 3px 4px; } #sar-panel .sar-in .ship-tab { flex: none; width: auto; padding: 3px 7px; }
#sar-panel .sar-hint { color: #777; font-size: 9px; line-height: 1.3; margin: 2px 0 4px; } #sar-panel .sar-pos { color: #ffcc66; font-size: 10px; font-family: monospace; margin: 3px 0; }
#sar-panel .sar-geo { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #aaa; } #sar-panel .sar-geo-it { text-align: left; background: #1a1a1a; border: 1px solid #333; color: #ddd; border-radius: 3px; padding: 3px 5px; cursor: pointer; font-size: 10px; }
#sar-panel .sar-geo-it b { display: block; color: #fff; } #sar-panel .sar-geo-it span { display: block; color: #889; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#sar-panel { width: 250px; }
#sar-panel .sar-x { position: absolute; right: -2px; top: -4px; background: none; border: 0; color: #888; font-size: 13px; cursor: pointer; }
#sar-panel .sar-on { width: 100%; background: #1a1a1a; border: 1px solid #3a3a3a; color: #ccc; border-radius: 4px; padding: 6px 0; font-size: 11px; font-weight: bold; cursor: pointer; }
#sar-panel .sar-on span { color: #888; } #sar-panel .sar-on.on { border-color: #33cc55; } #sar-panel .sar-on.on span { color: #4ade80; }
#sar-panel .sar-lbl { color: #666; font-size: 8px; letter-spacing: .5px; margin: 8px 0 4px; }
#sar-panel .sar-lbl b { font-size: 8px; }
#sar-panel .sar-row { display: flex; gap: 4px; }
#sar-panel .sar-row .ship-tab { font-size: 10px; padding: 6px 0; touch-action: none; }
#sar-panel .sar-h { font-size: 12px !important; padding: 9px 0 !important; }
#sar-panel .sar-st { margin: 8px 0; padding-top: 6px; border-top: 1px solid #1e1e1e; font-size: 10px; line-height: 16px; }
#sar-panel .sar-st b { color: #fff; }
#sar-panel .sar-bar { height: 6px; background: #222; border-radius: 3px; overflow: hidden; margin: 3px 0; }
#sar-panel .sar-bar i { display: block; height: 100%; }
/* HOIST CAM — SYSTEM 창 Video(HOIST) 큰 칸 */
#sysp-hoist { position: absolute; z-index: 3; overflow: hidden; background: #000; }
#sysp-hoist .hcam-map { position: absolute; inset: 0; }
#sysp-hoist .hcam-hud { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#sysp-map { display: none; position: absolute; z-index: 2; overflow: hidden; background: #000; }
#sysp-map > #map-wrap { position: absolute; inset: 0; width: 100%; height: 100%; }
#ovhd-stage, .ov-stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; user-select: none; -webkit-user-select: none; touch-action: none;
  font-family: 'Helvetica Neue', Arial, sans-serif; color: #eef0f2; }
.ov-reset-btn { position: absolute; right: 6px; bottom: 6px; z-index: 2; background: #22262b; color: #9ab; border: 1px solid #3a4250;
  border-radius: 4px; font-size: 10px; padding: 3px 8px; cursor: pointer; }
.ov-plate { position: absolute; background: linear-gradient(#35383c, #2a2d30); border: 2px solid #111; border-radius: 6px;
  box-shadow: inset 0 0 0 1px #474b50, 0 2px 6px #000; }
.ov-screw { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #777, #222);
  box-shadow: inset 0 0 0 1px #111; }
.ov-screw::after { content: ''; position: absolute; left: 2px; right: 2px; top: 5px; height: 2px; background: #111; }
.ov-screw.a { left: 8px; top: 8px; } .ov-screw.b { right: 8px; top: 8px; } .ov-screw.c { left: 8px; bottom: 8px; } .ov-screw.d { right: 8px; bottom: 8px; }
.ov-plate > div { position: absolute; width: 0; height: 0; }
.ov-title, .ov-pl, .ov-rl, .ov-lbl { position: absolute; left: 0; transform: translateX(-50%); white-space: nowrap; text-align: center;
  font-weight: bold; letter-spacing: .3px; pointer-events: none; }
.ov-title { bottom: 42px; font-size: 13px; line-height: 1.05; }
.ov-sub { font-size: 9px; font-weight: bold; }
.ov-pl { font-size: 10px; }
.ov-pl.top { top: -40px; } .ov-pl.bot { top: 27px; }
.ov-pl.side { left: -18px; top: -6px; transform: translateX(-100%); }
.ov-lbl { transform: translate(-50%, -50%); font-size: 13px; } .ov-lbl.sm { font-size: 10px; }
.ov-br { height: 8px !important; border: 2px solid #dde; border-bottom: none; }
.ov-br span { position: absolute; left: 50%; top: -9px; transform: translateX(-50%); background: #32353a; padding: 0 6px;
  font-size: 13px; font-weight: bold; white-space: nowrap; }
/* 토글 */
.ov-tg, .ov-guard, .ov-rot, .ov-pb, .ov-th { cursor: pointer; }
.ov-bez { position: absolute; left: -12px; top: -12px; width: 24px; height: 24px; border-radius: 50%;
  background: radial-gradient(circle, #6a6d70 30%, #2a2c2e 70%); box-shadow: 0 0 0 2px #0e0f10, 0 2px 3px #000; }
.ov-lever { position: absolute; left: 7px; width: 10px; height: 19px; border-radius: 5px;
  background: linear-gradient(90deg, #8d9095, #f2f3f4 45%, #9a9da1); box-shadow: 0 2px 3px rgba(0,0,0,.6); transition: all .08s; }
[data-p="up"] .ov-lever { bottom: 10px; }
[data-p="dn"] .ov-lever { top: 10px; }
[data-p="mid"] .ov-lever { top: 5px; left: 5px; width: 14px; height: 14px; border-radius: 50%; }
.ov-tg.red .ov-lever { background: linear-gradient(90deg, #5c1010, #d43a32 45%, #6b1512); }
.ov-tg.big .ov-lever { left: 6px; width: 12px; height: 22px; }
.ov-tg.paddle .ov-lever { left: 5px; width: 14px; border-radius: 2px; background: linear-gradient(90deg, #6a5e4c, #c9b89a 45%, #6a5e4c); }
.ov-tg.tiny .ov-title { font-size: 11px; }
/* 덮개 스위치 */
.ov-cover { z-index: 2; position: absolute; left: -24px; top: -66px; width: 48px; height: 118px; border-radius: 6px 6px 4px 4px;
  background: linear-gradient(90deg, #6d0f0f, #d0302a 45%, #7a1210); box-shadow: 0 4px 6px #000; transform-origin: 50% 0;
  transition: transform .15s; display: flex; align-items: flex-end; justify-content: center; cursor: pointer; }
.ov-cover b { color: #f4f4f4; font-size: 40px; line-height: 1; margin-bottom: 14px; }
.ov-guard.open .ov-cover { transform: translateY(-28px) scaleY(.32); }
.ov-guard .ov-title { bottom: 74px; }
.ov-guard.hazard .ov-cover { left: -46px; top: -24px; width: 92px; height: 56px; border-radius: 3px;
  background: repeating-linear-gradient(135deg, #e8b012 0 9px, #1a1a1a 9px 18px); border: 3px solid #e8b012; }
.ov-guard.hazard .ov-title { bottom: 30px; font-size: 11px; color: #111; background: #e8b012; padding: 1px 4px; z-index: 1; }
.ov-guard.hazard.open .ov-cover { transform: translateY(-34px) scaleY(.25); }
/* 노브 */
.ov-knob { position: absolute; left: -30px; top: -30px; width: 60px; height: 60px; border-radius: 50%;
  background: radial-gradient(circle at 42% 35%, #e4e6e8, #9a9ea2 55%, #5a5d60); box-shadow: 0 4px 8px #000, 0 0 0 3px #1c1d1f;
  transition: transform .12s; }
.ov-ptr { position: absolute; left: 27px; top: 3px; width: 5px; height: 27px; border-radius: 3px; background: #fbfbfb; box-shadow: 0 0 0 1px #333; }
.ov-rot.sm .ov-knob { left: -22px; top: -22px; width: 44px; height: 44px; }
.ov-rot.sm .ov-ptr { left: 19px; height: 20px; }
.ov-rot.dim .ov-knob { box-shadow: 0 4px 8px #000, 0 0 0 3px #1c1d1f, 0 0 0 6px #d8d8d8; }
.ov-rl { transform: translate(-50%, -50%); font-size: 10.5px; pointer-events: auto; cursor: pointer; padding: 5px 6px; border-radius: 4px; }
/* 터치 영역 — 글자 쪽을 누르면 그 위치로(17-upper.js _ovhdZones). 누르는 동안 살짝 밝힌다 · ZONES 로 테두리를 본다 */
.ov-hit { position: absolute; border-radius: 4px; cursor: pointer; z-index: 1; -webkit-tap-highlight-color: transparent; }
.ov-hit:active, .ov-rl:active { background: rgba(255, 255, 255, 0.10); }
.ov-zones .ov-hit { outline: 1px dashed rgba(0, 229, 255, 0.75); background: rgba(0, 229, 255, 0.06); }
.ov-zones .ov-rl { outline: 1px dashed rgba(255, 210, 0, 0.8); }
.ov-zones-btn { position: absolute; right: 62px; bottom: 6px; z-index: 2; background: #22262b; color: #9ab; border: 1px solid #3a4250;
  border-radius: 4px; font-size: 10px; padding: 3px 8px; cursor: pointer; }
.ov-zones-btn.on { color: #00e5ff; border-color: #00e5ff; }
.ov-rot .ov-title { bottom: 72px; }
.ov-rot.sm .ov-title { bottom: 56px; }
/* 누름 버튼 · T-핸들 */
.ov-btn { position: absolute; left: -13px; top: -13px; width: 26px; height: 26px; border-radius: 4px;
  background: linear-gradient(#f4f2ea, #c9c6bc); box-shadow: 0 3px 0 #77756d, 0 4px 5px #000; transition: all .05s; }
.ov-lv .ov-slot { position: absolute; left: -9px; top: -15px; width: 18px; border-radius: 9px; background: #0d0e10; box-shadow: inset 0 0 0 2px #1d1f22; }
.ov-lvh { position: absolute; left: -24px; width: 48px; height: 36px; border-radius: 7px; transition: top .12s;
  background: linear-gradient(#e6e8ea, #9fa3a7 55%, #6e7276); box-shadow: 0 4px 6px #000; }
.ov-lvh i { position: absolute; left: 6px; right: 6px; top: 16px; height: 4px; background: #333; border-radius: 2px; }
.ov-lv[data-p="OFF"] .ov-lvh { background: linear-gradient(#ffb3a8, #d9473a 55%, #8a2018); }
/* 하부 콘솔 조작(19-lower.js) — 눌러 두는 사각 버튼 · 키 · 표시등 · 표시창 */
.ov-lpb, .ov-key { cursor: pointer; }
.ov-sq { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box;
  border-radius: 4px; font-weight: bold; font-size: 11px; line-height: 1.1; color: #6a6e72; pointer-events: none;
  background: linear-gradient(#2c2f33, #1c1e21); box-shadow: 0 0 0 2px #0e0f10, 0 3px 4px #000, inset 0 0 0 1px #4a4f55; transition: all .06s; }
.ov-lpb.in .ov-sq { color: #ffb000; text-shadow: 0 0 6px rgba(255,176,0,.7); box-shadow: 0 0 0 2px #0e0f10, 0 1px 2px #000, inset 0 0 0 1px #806020; transform: translateY(1px); }
.ov-lpb.grn.in .ov-sq { color: #5cf07e; text-shadow: 0 0 6px rgba(92,240,126,.7); box-shadow: 0 0 0 2px #0e0f10, 0 1px 2px #000, inset 0 0 0 1px #206030; }   /* 녹색 ON(MPP · AVCS) — 무전기 글씨 빛 */
.ov-key .ov-sq { background: linear-gradient(#e9e7df, #bdbab2); color: #222; box-shadow: 0 3px 0 #77756d, 0 4px 5px #000; }
.ov-key.pressed .ov-sq { transform: translateY(2px); box-shadow: 0 1px 0 #77756d; }
.ov-lamp .ov-sq { font-size: 10px; color: #3c4a3c; background: #111; }
.ov-lamp.on .ov-sq { color: #001a00; background: #3ad13a; box-shadow: 0 0 8px #3ad13a, 0 0 0 2px #0e0f10; }
/* CDU 꺼짐 — 배터리 단독이면 CDU2(기장)는 전원이 없다(36-kuhsys.js) */
#cdu-nopwr { position: absolute; inset: 0; z-index: 50; background: #000; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #445; font: bold 14px Helvetica Neue, Arial, sans-serif; }
#cdu-nopwr b { font-size: 22px; color: #556; }
/* HOCAS MEP CTL — DOI(제어 대상 화면) 표시(36-kuhsys.js) */
#pfd-wrap.hocas-doi, #sysp-wrap.hocas-doi, #map-wrap.hocas-doi { outline: 3px solid #2fe0e0; outline-offset: -3px; }
/* CDU System Tests — Lamp Test: 콘솔 램프 · 눌러 두는 버튼 글씨를 모두 켠다(36-kuhsys.js) */
.lamptest .ov-lamp .ov-sq { color: #001a00; background: #3ad13a; box-shadow: 0 0 8px #3ad13a, 0 0 0 2px #0e0f10; }
.lamptest .ov-lpb .ov-sq { color: #ffb000; text-shadow: 0 0 6px rgba(255,176,0,.7); }
/* 절차 훈련판(js/00-edition.js · Flightsimulator) — SIM 모드와 그 조작 버튼을 감춘다 */
/* 절차 훈련판(html.ed-proc) — SIM 조작 버튼도 종합판과 같다. 사이클릭 피치 · 롤만 잠긴다(00-edition.js CYCLIC_LOCK) —
   화면 STICK 의 원형 사이클릭은 흐리게 · 누르지 못하게(GYRO 도 사이클릭이라 감춘다) */
html.ed-proc #vstick .vs-cyc { opacity: 0.3; pointer-events: none; }
html.ed-proc #gyro-btn, html.ed-proc #gyro-align-btn { display: none !important; }
/* CDU 실기 GTC 화면(18-system.js — Fuel Configuration · Video Settings) */
/* 칸이 넘치면 위아래로 밀어 본다(터치 · 휠) — 스크롤 막대를 보여 넘친 칸이 있음을 알린다 */
#mainContentArea { touch-action: pan-y; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
#mainContentArea::-webkit-scrollbar { width: 6px; }
#mainContentArea::-webkit-scrollbar-thumb { background: #3f5b70; border-radius: 3px; }
#mainContentArea::-webkit-scrollbar-track { background: transparent; }
.gtc-page .nav-btn { flex: 1; width: auto; max-width: none; height: 32px; min-height: 32px; font-size: 12px; padding: 2px 4px; white-space: nowrap; }
.gtc-sim { padding: 8px 6px 4px; color: #cde; font-size: 12px; border-top: 1px solid #1e2a33; margin-top: 10px; }
.gtc-page { position: relative; padding: 8px 8px 10px; color: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; }
.gtc-head { margin: 0 auto 10px; width: fit-content; padding: 2px 18px; border-radius: 0 0 10px 10px; background: linear-gradient(#1d3b52, #0d2234);
  color: #9fe7ff; font-weight: bold; font-size: 13px; letter-spacing: .3px; }
.gtc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.gtc-grid.three { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.gtc-btn { min-height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; text-align: center;
  background: linear-gradient(#262b30, #08090a 40%); border: 1px solid #3a4652; border-top: 3px solid #4f6a82; border-radius: 4px;
  box-shadow: 0 2px 4px #000; padding: 6px 4px; user-select: none; }
.gtc-btn:active { filter: brightness(1.4); }
.gtc-t { font-size: 13px; font-weight: bold; color: #fff; }
.gtc-v { font-size: 16px; font-weight: bold; color: #4fe3d0; letter-spacing: .5px; }
.gtc-bar { width: 60%; height: 7px; border-radius: 4px; background: #555; box-shadow: inset 0 1px 2px #000; }
.gtc-bar.on { background: linear-gradient(#b7f27a, #6ccf2a); }
.gtc-rows { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.gtc-row { display: grid; grid-template-columns: 78px 34px 1fr 34px; gap: 4px; align-items: stretch; padding: 4px; border: 1px solid #3a4652; border-radius: 4px; background: #0b0d0f; }
.gtc-rl { font-size: 12px; font-weight: bold; display: flex; flex-direction: column; justify-content: center; }
.gtc-rl b { font-size: 12px; color: #fff; margin-top: 2px; }
.gtc-pm { display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; color: #cfd8df; cursor: pointer;
  background: linear-gradient(#2a3036, #0b0d0f); border: 1px solid #3a4652; border-top: 2px solid #4f6a82; border-radius: 3px; user-select: none; }
.gtc-pm:active { filter: brightness(1.5); }
.gtc-slide { position: relative; background: #050607; border: 1px solid #2a323a; border-radius: 3px; overflow: hidden; min-height: 34px; }
.gtc-slide i { position: absolute; left: 0; bottom: 0; height: 100%; background: linear-gradient(to top right, #1d6fa8 50%, transparent 50%); }
.gtc-slide u { position: absolute; top: 2px; bottom: 2px; width: 8px; margin-left: -4px; border-radius: 2px; background: linear-gradient(90deg, #2f8f63, #6fe3a7, #2f8f63); }
.gtc-pick { position: absolute; left: 50%; top: 40px; transform: translateX(-30%); width: 42%; display: flex; flex-direction: column; gap: 4px;
  padding: 4px; background: #000; border: 2px solid #5b6b78; border-radius: 4px; box-shadow: 0 6px 16px #000; z-index: 5; }
.gtc-opt { min-height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; cursor: pointer;
  background: linear-gradient(#262b30, #08090a 40%); border: 1px solid #3a4652; border-top: 3px solid #4f6a82; border-radius: 3px; }
.gtc-opt.sel { color: #4fe3d0; }
/* 하부 콘솔 전원 없음(19-lower.js lconPowerSync) — 버튼 글씨 · 표시등이 꺼진다 */
.lcon-nopwr .ov-lpb.in .ov-sq { color: #555 !important; text-shadow: none !important; }
.lcon-nopwr .ov-lamp.on .ov-sq { color: #3c4a3c !important; background: #111 !important; box-shadow: none !important; }
.lcon-nopwr .npx-led { background: radial-gradient(circle at 40% 35%, #c7c9cc, #6c6f73) !important; box-shadow: 0 0 0 2px #222, 0 0 0 3px #888 !important; }
/* Bell 206 항공전자 스택(js/26-b206radio.js) — 하부 콘솔 자리(980×1400) */
/* Bell 206 — CDU · UPPER CONSOLE 이 없다(00-aircraft.js acScrOk) — 탭 · 단독 · 조종석 버튼을 감춘다 */
html.ac-b206 .page-tab[data-sel="cdu"], html.ac-b206 .page-tab[data-sel="ovhd"], html.ac-b206 .page-tab[data-sel="sysp"], html.ac-b206 #cdu-solo-btn,
html.ac-b206 #ctl3d #cduov-btn, html.ac-b206 #ctl3d #upperc-btn, html.ac-b206 #ctl3d #upperc-btn.show { display: none !important; }
html:not(.ac-aw189) .page-tab.msn-tab { display: none !important; }   /* Vendor(전탐석) — 흰수리만 */
/* ATC 관제석(41-atc.js) */
#atc-wrap { position: relative; } #atc-root { position: absolute; inset: 0; display: flex; flex-direction: column; background: #0b1210; color: #cfe8d8; font-family: "Helvetica Neue", Arial, sans-serif; }
#atc-root .atc-top { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 4px 8px; background: #050906; border-bottom: 1px solid #1f3a2a; font-size: 12px; }
#atc-root .atc-top b { color: #7dffa8; margin-right: 4px; } #atc-root select, #atc-root input { background: #0d1a13; color: #dff; border: 1px solid #2c4a38; border-radius: 3px; font-size: 12px; padding: 2px 4px; }
#atc-root .atc-sp { flex: 1; } #atc-root .atc-b { background: #12251a; border: 1px solid #2c4a38; color: #cfe; border-radius: 4px; padding: 3px 7px; font-size: 11px; cursor: pointer; } #atc-root .atc-b.on { background: #1f6f3f; color: #fff; border-color: #3fd07a; }
#atc-root .atc-body { flex: 1; min-height: 0; display: flex; } #atc-root .atc-scopes { flex: 1; min-width: 0; display: flex; gap: 2px; } #atc-root .atc-scopes canvas { flex: 1; min-width: 0; width: 100%; height: 100%; display: block; }
#atc-root .atc-side { width: 300px; flex: none; overflow-y: auto; border-left: 1px solid #1f3a2a; padding: 6px; font-size: 12px; }
#atc-root .atc-h { color: #7dffa8; font-weight: bold; margin: 6px 0 3px; } #atc-root .atc-list { display: flex; flex-direction: column; gap: 2px; }
#atc-root .atc-t { text-align: left; background: #0d1a13; border: 1px solid #1f3a2a; color: #cfe; border-radius: 3px; padding: 3px 6px; font-size: 11px; cursor: pointer; } #atc-root .atc-t.on { border-color: #ffd23a; color: #ffd23a; }
#atc-root .atc-par-rd { margin-top: 4px; padding: 4px; background: #08140d; border: 1px solid #1f3a2a; border-radius: 3px; font-size: 11px; } #atc-root .atc-cmd { display: flex; flex-wrap: wrap; gap: 3px; }
#atc-root .atc-in { display: flex; gap: 3px; width: 100%; } #atc-root .atc-in input { flex: 1; min-width: 0; } #atc-root .atc-log { font-size: 11px; font-family: monospace; } #atc-root .atc-log .in { color: #ffd23a; }
@media (max-width: 760px) { #atc-root .atc-body { flex-direction: column; } #atc-root .atc-side { width: auto; max-height: 45%; border-left: 0; border-top: 1px solid #1f3a2a; } }
#atc-root .atc-scopes.v-both { flex-direction: row; } @container (max-width: 700px) { #atc-root .atc-scopes.v-both { flex-direction: column; } }
#atc-reply { display: none; position: fixed; left: 50%; top: 64px; transform: translateX(-50%); z-index: 30010; flex-direction: column; gap: 4px; max-width: min(560px, 94vw); padding: 8px 12px; background: rgba(8,20,13,0.95); border: 1px solid #3fd07a; border-radius: 8px; color: #e8fff0; font-size: 13px; }
#atc-reply b { color: #7dffa8; } #atc-reply div { display: flex; gap: 4px; } #atc-reply .sim-btn { width: auto; flex: none; padding: 3px 10px; margin: 0; }

#msn-wrap { position: relative; overflow: hidden; background: #1b2026; }
html.ac-b206 #lcon-wrap .ov-reset-btn, html.ac-b206 #lcon-wrap .ov-zones-btn { display: none; }   /* 스위치 판이 없다 */
#b206rad { display: flex; flex-direction: column; gap: 6px; background: #121314; font-family: Arial, sans-serif; color: #c9cdd1; }
#b206rad button { font-family: Arial, sans-serif; cursor: pointer; }
.b2r-unit { position: relative; background: linear-gradient(#26292c, #16181a); border: 2px solid #3a3f44; border-radius: 6px; box-shadow: inset 0 0 0 3px #0d0e0f; flex: none; }
.b2r-aud { height: 190px; } .b2r-gns { height: 396px; } .b2r-rad { height: 190px; } .b2r-adf { height: 200px; } .b2r-xp { height: 200px; }
.b2r-brand { position: absolute; left: 28px; top: 12px; font-size: 15px; font-weight: bold; color: #b9bec3; letter-spacing: 1px; }
.b2r-model { position: absolute; right: 30px; top: 12px; font-size: 14px; font-weight: bold; color: #b9bec3; }
.b2r-tag { position: absolute; right: 30px; top: 8px; font-size: 15px; font-weight: bold; color: #b9bec3; letter-spacing: 1px; }
.b2r-knob { position: absolute; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #3a3e42, #0b0c0d 70%); border: 3px solid #5c6166; touch-action: none; cursor: pointer; }
.b2r-knob .b2r-kin { position: absolute; inset: 24%; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #44494e, #111 70%); border: 3px solid #6d7378; }
.b2r-knob.sm { width: 92px; height: 92px; left: 34px; top: 46px; }
.b2r-knob.mic { width: 104px; height: 104px; right: 70px; top: 44px; }
.b2r-knob.big { width: 128px; height: 128px; right: 40px; top: 28px; }
.b2r-knob.big.gl { left: 26px; right: auto; top: auto; bottom: 22px; }
.b2r-knob.big.gr2 { right: 26px; top: auto; bottom: 22px; }
.b2r-knob.mode { width: 92px; height: 92px; right: 60px; top: 26px; }
.b2r-knob.mode .b2r-kin::after { content: ''; position: absolute; left: 50%; top: 6%; width: 4px; height: 40%; margin-left: -2px; background: #ddd; transform-origin: 50% 110%; transform: rotate(var(--a, 0deg)); }
.b2r-knob.xd { position: relative; width: 76px; height: 76px; display: inline-block; margin: 0 46px; }
.b2r-ivl, .b2r-micl { position: absolute; font-size: 13px; font-weight: bold; color: #ff9a3a; }
.b2r-ivl { left: 30px; bottom: 16px; } .b2r-micl { right: 64px; bottom: 16px; } .b2r-ivl b, .b2r-micl b { color: #fff; }
.b2r-cdim { margin-left: 4px; color: #fff; } .b2r-cdim.term { color: #4fc3f7; } .b2r-cdim.apr { color: #7dff3a; }
.b2r-ptt { position: absolute; right: 186px; bottom: 10px; width: 54px; height: 30px; border-radius: 6px; border: 2px solid #5c6166; background: #1b1d1f; color: #ddd; font-weight: bold; font-size: 13px; touch-action: none; cursor: pointer; }
.b2r-ptt.on { background: #b71c1c; border-color: #ff5252; color: #fff; }
.b2r-txl { position: absolute; right: 250px; bottom: 16px; font-size: 13px; font-weight: bold; color: #ff5252; }
.b2r-gns.tx::after, .b2r-rad.tx::after { content: 'TX'; position: absolute; left: 12px; top: 8px; padding: 1px 6px; border-radius: 3px; background: #b71c1c; color: #fff; font-size: 13px; font-weight: bold; }
.b2r-arow { position: absolute; left: 160px; right: 200px; display: flex; justify-content: space-between; }
.b2r-arow.t { top: 30px; } .b2r-arow.b { top: 112px; }
.b2r-ab { width: 46px; height: 52px; border-radius: 4px; background: #1d1f21; border: 2px solid #4a4f54; display: flex; align-items: center; justify-content: center; padding: 0; }
.b2r-ab i { width: 22px; height: 30px; border-radius: 3px; background: #3a2a22; box-shadow: inset 0 0 4px #000; }
.b2r-ab.on i { background: #ff7a3a; box-shadow: 0 0 10px #ff6a2a, inset 0 0 4px #ffd0a0; }
.b2r-alab { position: absolute; left: 160px; right: 200px; top: 88px; font-size: 15px; font-weight: bold; color: #ff9a3a; text-align: center; letter-spacing: 1px; white-space: nowrap; }
.b2r-sl { position: absolute; left: 160px; font-size: 10px; color: #8a8f94; } .b2r-sl.t { top: 16px; } .b2r-sl.b { top: 168px; }
.b2r-scr { position: absolute; left: 200px; right: 200px; top: 40px; bottom: 70px; background: #1f6fd0; border: 4px solid #0b0c0d; border-radius: 4px; color: #fff; overflow: hidden; font-family: 'Courier New', monospace; font-weight: bold; }
.b2r-scr.off { background: #050607; }
.b2r-boot { position: absolute; inset: 0; padding: 10px 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font-size: 22px; color: #ffe27a; }
.b2r-boot b { color: #ffe27a; } .b2r-boot i { font-style: normal; color: #9df5c8; font-size: 19px; }
.b2r-ok { position: absolute; right: 14px; bottom: 10px; background: #ffb300; color: #6b3d00; padding: 2px 10px; border-radius: 3px; font-size: 18px; animation: b2rBlink 1s steps(2) infinite; }
.b2r-globe { position: absolute; right: 18px; top: 22px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #8fe64a 0 26%, #2a72d0 27%); border: 3px solid #9df5c8; }
@keyframes b2rBlink { 50% { opacity: 0.25; } }
.b2r-gl { position: absolute; left: 0; top: 0; bottom: 0; width: 34%; background: #000; padding: 8px 6px; box-sizing: border-box; }
.b2r-gf { margin-bottom: 14px; font-size: 22px; } .b2r-gf em { display: block; font-style: normal; font-size: 13px; color: #9aa; }
.b2r-gf b { display: block; color: #3ef; } .b2r-gf span { display: block; color: #fff; } .b2r-gf.foc span { outline: 2px solid #3ef; outline-offset: 1px; }
.b2r-gcdi { position: absolute; left: 6px; bottom: 6px; font-size: 16px; color: #3f3; }
.b2r-gr { position: absolute; left: 34%; right: 0; top: 0; bottom: 0; background: #000; padding: 8px 10px; box-sizing: border-box; }
.b2r-gnav > div { display: flex; justify-content: space-between; font-size: 21px; } .b2r-gnav em { font-style: normal; color: #9aa; } .b2r-gnav b { color: #f6f; }
.b2r-gwpt { color: #fff; font-size: 20px; margin-bottom: 4px; } .b2r-gwpt b { color: #f6f; }
.b2r-cdi { position: absolute; left: 12px; right: 12px; bottom: 10px; height: 18px; border: 2px solid #fff; border-radius: 3px; }
.b2r-cdi.off { text-align: center; font-size: 13px; color: #888; border-color: #555; }
.b2r-cdi i { position: absolute; top: -4px; width: 5px; height: 22px; margin-left: -2px; background: #f6f; }
.b2r-gfpl { font-size: 18px; } .b2r-gfpl em { display: block; font-style: normal; color: #3ef; font-size: 14px; margin-bottom: 4px; } .b2r-gfpl .act { color: #f6f; }
.b2r-gk { position: absolute; width: 56px; height: 56px; border-radius: 6px; background: #1d1f21; border: 2px solid #4a4f54; color: #ddd; font-size: 15px; font-weight: bold; }
.b2r-gk.cflip { left: 120px; top: 60px; } .b2r-gk.vflip { left: 120px; top: 136px; } .b2r-gk.cv { left: 160px; bottom: 30px; width: 40px; height: 40px; font-size: 11px; }
.b2r-gbtm { position: absolute; left: 200px; right: 200px; bottom: 16px; display: flex; justify-content: space-around; }
.b2r-gb { background: #1d1f21; border: 2px solid #4a4f54; border-radius: 5px; color: #ddd; font-size: 15px; font-weight: bold; padding: 8px 12px; }
.b2r-gright { position: absolute; right: 22px; top: 40px; width: 160px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.b2r-gright .b2r-gb { padding: 12px 4px; }
.b2r-pwr { position: absolute; width: 40px; height: 40px; border-radius: 50%; background: radial-gradient(circle, #555, #111); border: 3px solid #777; }
.b2r-pwr.on { border-color: #3c3; }
.b2r-gns .b2r-pwr { left: 40px; top: 50px; }
.b2r-rad .b2r-pwr { right: 236px; top: 80px; }
.b2r-pl { position: absolute; right: 178px; top: 76px; font-size: 12px; font-weight: bold; color: #aaa; text-align: center; }
.b2r-disp { position: absolute; left: 50px; right: 300px; top: 34px; height: 92px; background: #080606; border-radius: 4px; border: 2px solid #2a2d30;
  display: flex; align-items: center; justify-content: space-around; }
.b2r-seg { font-family: 'Courier New', monospace; font-weight: bold; font-size: 64px; color: #ff4a22; text-shadow: 0 0 10px #ff3a10; letter-spacing: 4px; font-style: italic; }
.b2r-disp small { font-size: 16px; font-weight: bold; color: #ff4a22; }
.b2r-ann { position: absolute; left: 8px; top: 8px; } .b2r-fl { position: absolute; left: 10px; bottom: 10px; } .b2r-alt { position: absolute; left: 41%; top: 6px; } .b2r-r { position: absolute; left: 55%; top: 6px; }
.b2r-ul, .b2r-sl2 { position: absolute; top: 132px; font-size: 13px; font-weight: bold; color: #aaa; }
.b2r-ul { left: 170px; } .b2r-sl2 { left: 420px; }
.b2r-flip { position: absolute; left: 270px; bottom: 8px; width: 66px; height: 32px; background: #e8e4da; border: 0; border-radius: 3px; font-size: 18px; font-weight: bold; color: #333; }
.b2r-abtn { position: absolute; left: 120px; bottom: 6px; display: flex; gap: 20px; }
.b2r-wb { background: #e8e4da; border: 0; border-radius: 3px; font-size: 13px; font-weight: bold; color: #333; padding: 8px 12px; }
.b2r-wb.on { background: #ffd27a; }
.b2r-xp .b2r-disp { left: 150px; right: 220px; top: 20px; }
.b2r-wb.idt { position: absolute; left: 24px; top: 46px; padding: 14px 16px; }
.b2r-wb.vfr { position: absolute; right: 40px; bottom: 16px; padding: 12px 16px; }
.b2r-xk { position: absolute; left: 70px; bottom: 6px; }
.b2r-xml { position: absolute; right: 30px; top: 122px; font-size: 10px; font-weight: bold; color: #aaa; }
.b2r-xmv { position: absolute; right: 86px; top: 4px; font-size: 13px; font-weight: bold; color: #ff9a3a; }
.b2r-xptag { left: 30px; right: auto; top: auto; bottom: 8px; }
/* NAT NPX138 FM TRANSCEIVER(js/22-npx138.js) — 하부 콘솔 ⑧ */
#npx { background: linear-gradient(#2a2c2f, #1b1c1f); border-radius: 4px; box-shadow: inset 0 0 0 2px #0c0d0f, inset 0 0 0 3px #3a3e44; color: #e8e8e8; font-family: Arial, sans-serif; }
.npx-title { position: absolute; left: 14px; width: 290px; top: 1px; text-align: center; font: bold 9px Arial; letter-spacing: .5px; }
.npx-lcd { position: absolute; left: 14px; top: 12px; width: 290px; height: 50px; box-sizing: border-box; padding: 2px 5px;
  background: #0a1a0c; border: 3px solid #08090a; border-radius: 3px; box-shadow: inset 0 0 12px #000;
  color: #66e07a; font: bold 19px 'Courier New', monospace; line-height: 22px; opacity: var(--npx-dim, 1); text-shadow: 0 0 3px rgba(102,224,122,.5); }
.npx-lcd.off { color: transparent; text-shadow: none; }
.npx-row { display: flex; white-space: pre; }
.npx-row span { width: 17.4px; text-align: center; }
.npx-row span.npx-cur { animation: npxBlink .8s steps(1) infinite; }
@keyframes npxBlink { 50% { color: transparent; text-shadow: none; } }
.npx-g { font-style: normal; font-size: 9px; line-height: 9px; display: inline-block; width: 10px; word-break: break-all; vertical-align: middle; }
.npx-l { position: absolute; width: 60px; text-align: center; font: bold 7.5px Arial; color: #ddd; pointer-events: none; }
.npx-l.s { font-size: 8px; }
#npx.edit .npx-l { opacity: .55; }
.npx-line { position: absolute; height: 1px; background: #bbb; pointer-events: none; }
.npx-tog, .npx-rock { position: absolute; width: 30px; height: 30px; cursor: pointer; touch-action: none; }
.npx-rock { height: 26px; }
.npx-tog::before { content: ''; position: absolute; left: 7px; top: 7px; width: 16px; height: 16px; border-radius: 50%;
  background: radial-gradient(#d8dadc, #7d8085); box-shadow: 0 0 0 1px #000, 0 2px 3px #000; }
.npx-tog b { position: absolute; left: 10px; top: 10px; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #a9adb2); box-shadow: 0 0 0 1px #333; transition: transform .08s; }
.npx-tog[data-pos="ID"] b, .npx-tog[data-pos="CH"] b { transform: translateX(-6px); }
.npx-tog[data-pos="TX"] b, .npx-tog[data-pos="ST"] b { transform: translateX(6px); }
.npx-tog[data-pos="RX"] b, .npx-tog[data-pos="GDTX"] b, .npx-tog[data-pos="GD2"] b { transform: translateY(6px); }
.npx-tog[data-pos="SCAN"] b, .npx-tog[data-pos="GD1"] b { transform: translateY(-6px); }
.npx-rock b { position: absolute; left: 7px; top: 2px; width: 16px; height: 22px; border-radius: 8px; background: linear-gradient(90deg, #8d9095, #e9ebed 45%, #8d9095);
  box-shadow: 0 0 0 1px #000, 0 2px 3px #000; }
.npx-rock b::after { content: ''; position: absolute; left: 6px; top: 4px; width: 4px; height: 14px; border-left: 1px solid #555; border-right: 1px solid #555; }
.npx-rock:active b { filter: brightness(.85); }
.npx-sq { position: absolute; width: 26px; height: 26px; border-radius: 50%; border: 0; cursor: pointer; padding: 0;
  background: radial-gradient(circle at 40% 35%, #fff, #c9cbce 60%, #8d9095); box-shadow: 0 0 0 1px #000, 0 3px 4px #000; }
.npx-sq:active { transform: translateY(1px); filter: brightness(.9); }
.npx-knob { position: absolute; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; touch-action: none;
  background: #111; box-shadow: 0 0 0 2px #050505, 0 3px 5px #000; }
.npx-cap { position: absolute; inset: 3px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #6a6d72, #33363a); transition: transform .1s; }
.npx-cap i { position: absolute; left: 14px; top: 1px; width: 2px; height: 7px; background: #fff; }
.npx-cap span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: bold 9px Arial; color: #eee; }
.npx-led { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #c7c9cc, #6c6f73); box-shadow: 0 0 0 2px #222, 0 0 0 3px #888; }
.npx-led.rx { background: radial-gradient(circle at 40% 35%, #ffe08a, #ff9d00); box-shadow: 0 0 0 2px #222, 0 0 8px #ffa000; }
.npx-led.tx { background: radial-gradient(circle at 40% 35%, #b7ffb7, #20d020); box-shadow: 0 0 0 2px #222, 0 0 8px #30e030; }
.npx-logo { position: absolute; left: 436px; top: 96px; font: bold italic 14px Arial; color: #eee; letter-spacing: -.5px; pointer-events: none; }
/* Wulfsberg C-5000 CMC(js/21-c5000.js) — 하부 콘솔 ⑦ */
.ov-html { position: absolute; }
#c5k { background: linear-gradient(#26292d, #17191c); border-radius: 6px; box-shadow: inset 0 0 0 2px #0c0d0f, inset 0 0 0 3px #3a3e44; color: #eee; font-family: Arial, sans-serif; }
.c5-brand { position: absolute; left: 0; right: 0; top: 4px; text-align: center; font: bold 13px Arial; letter-spacing: 4px; color: #e8e8e8; }
.c5-lcd { position: absolute; left: 62px; top: 24px; width: 372px; height: 78px; box-sizing: border-box; padding: 8px 10px;
  background: #061309; border: 4px solid #0b0c0d; border-radius: 3px; box-shadow: inset 0 0 14px #000;
  color: #5cf07e; font: bold 21px 'Courier New', monospace; line-height: 29px; opacity: var(--c5-dim, 1); text-shadow: 0 0 4px rgba(92,240,126,.5); }
.c5-lcd.off { color: transparent; text-shadow: none; }
.c5-row { white-space: pre; display: flex; }
.c5-row span { width: 17.6px; text-align: center; }
.c5-row span.c5-cur { background: #5cf07e; color: #061309; text-shadow: none; }
/* C-5000 NORMAL/GUARD 고르기 — _ 커서(밑줄) · 첫 1 위의 ‾ 표시 */
.c5-row span { box-sizing: border-box; border-top: 2px solid transparent; border-bottom: 2px solid transparent; }
.c5-row span.c5-ul { border-bottom-color: #5cf07e; }
.c5-row span.c5-ovl { border-top-color: #5cf07e; }
.c5-soft { position: absolute; left: 18px; width: 34px; height: 28px; border-radius: 4px; border: 0; cursor: pointer;
  background: linear-gradient(#e9e7df, #bdbab2); box-shadow: 0 3px 0 #77756d, 0 4px 5px #000; }
.c5-soft.up { top: 32px; } .c5-soft.dn { top: 68px; }
.c5-soft:active, .c5-key:active { transform: translateY(2px); box-shadow: 0 1px 0 #77756d; }
.c5-pad { position: absolute; left: 132px; top: 114px; width: 216px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
.c5-key { height: 37px; border: 0; border-radius: 4px; cursor: pointer; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(#e9e7df, #bdbab2); color: #222; box-shadow: 0 3px 0 #77756d, 0 4px 5px #000; line-height: 1; }
.c5-key b { font-size: 15px; } .c5-key i { font-style: normal; font-size: 9px; font-weight: bold; margin-top: 2px; }
.c5-tag { position: absolute; top: 112px; width: 110px; text-align: center; font: bold 11px Arial; color: #ddd; }
.c5-tag.vol { left: 12px; } .c5-tag.sel { left: 358px; }
.c5-knob { position: absolute; top: 128px; width: 110px; height: 110px; border-radius: 50%; cursor: pointer; touch-action: none;
  background: repeating-conic-gradient(#2a2c30 0 6deg, #15171a 6deg 12deg); box-shadow: 0 0 0 3px #0c0d0f, 0 4px 8px #000; }
.c5-knob.vol { left: 12px; } .c5-knob.sel { left: 358px; }
.c5-inner { position: absolute; left: 18%; top: 18%; width: 64%; height: 64%; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: repeating-conic-gradient(#3a3d42 0 8deg, #26282c 8deg 16deg); box-shadow: 0 0 0 2px #0c0d0f, 0 2px 4px #000; }
.c5-push { width: 50%; height: 50%; border-radius: 50%; background: radial-gradient(#55595f, #2a2c30); box-shadow: 0 0 0 1px #0c0d0f;
  display: flex; align-items: center; justify-content: center; text-align: center; font: bold 7.5px Arial; color: #eee; line-height: 1.1; }
.ov-disp { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box;
  background: #0b1a10; border: 3px solid #0e0f10; border-radius: 3px; box-shadow: inset 0 0 12px #000;
  color: #59e07a; font: bold 18px 'Courier New', monospace; letter-spacing: 1px; white-space: pre; }
.ov-pb.pressed .ov-btn { transform: translateY(2px); box-shadow: 0 1px 0 #77756d; }
.ov-pb .ov-title { bottom: 22px; }
.ov-thbar { position: absolute; left: -78px; top: -22px; width: 156px; height: 44px; border-radius: 22px;
  background: linear-gradient(#9da1a5, #f2f3f4 30%, #d0d3d6 65%, #7d8085); box-shadow: 0 4px 8px #000;
  display: flex; align-items: center; justify-content: space-between; padding: 0 6px; box-sizing: border-box; transition: transform .12s; }
.ov-thbar::before { content: ''; position: absolute; left: 58px; top: -40px; width: 40px; height: 44px; background: #16171a; border-radius: 4px 4px 0 0; z-index: -1; }
.ov-thbar span { background: #121316; color: #ff3b30; font-weight: bold; font-size: 26px; padding: 1px 12px; border-radius: 3px; letter-spacing: 1px; }
.ov-thbar i { width: 14px; height: 30px; border-radius: 5px; background: #5a1515; box-shadow: inset 0 0 3px #000; }
.ov-th .ov-title { bottom: 58px; }
.ov-th.pulled .ov-thbar { transform: translateY(18px) scale(1.04); }
.ov-th.pulled .ov-thbar i { background: #ff3b30; box-shadow: 0 0 10px #ff3b30; }

/* SIM Mode 창 배치판(07-sim.js simLayoutShow) · 화면 하나만 담는 그릇(본 창에서는 숨긴다) */
.po-screen-host { display: none; }
#simlay { display: none; position: fixed; inset: 0; z-index: 30000; background: rgba(0,0,0,0.72); align-items: center; justify-content: center; }
#simlay.show { display: flex; }
.simlay-box { background: #11161c; border: 1px solid #2c3a48; border-radius: 10px; padding: 18px 20px; width: min(560px, 92vw); color: #cde; font-family: 'Helvetica Neue', Arial, sans-serif; }
.simlay-title { font-size: 17px; font-weight: bold; color: #00e5ff; margin-bottom: 6px; }
.simlay-note { font-size: 12px; color: #8fa6b6; line-height: 1.5; margin-bottom: 12px; }
.simlay-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.simlay-btn { display: flex; flex-direction: column; gap: 3px; align-items: center; padding: 12px 8px; border-radius: 8px; cursor: pointer;
  background: #1a2129; border: 1px solid #34465a; color: #e8f2f8; font-size: 14px; }
.simlay-btn span { font-size: 10px; color: #8fa6b6; }
.simlay-btn.on { border-color: #3ad13a; background: rgba(58,209,58,0.12); }
.simlay-btn.on span { color: #3ad13a; }
.simlay-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.simlay-sm { background: #22262b; color: #9ab; border: 1px solid #3a4250; border-radius: 5px; padding: 6px 12px; cursor: pointer; font-size: 12px; }

/* Simple mode(07-sim.js) — 위 막대에서 고른 창 하나만 화면 가득 */
#simple-bar, #simple-view { display: none; }
body.simple-mode #app, body.simple-mode #solo-bar, body.simple-mode #solo-half-btn { display: none !important; }
/* iPad·iPhone 홈 화면 앱은 상태바(시계·배터리)가 화면 위에 겹친다(black-translucent) — 그만큼 내려 둔다 */
body.simple-mode #simple-bar { display: flex; position: fixed; left: 0; right: 0; top: 0; height: calc(40px + env(safe-area-inset-top)); z-index: 20000;
  padding-top: env(safe-area-inset-top); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); box-sizing: border-box;
  background: #0b0e12; border-bottom: 1px solid #263240; }
#simple-bar button { flex: 1 1 0; min-width: 0; background: transparent; border: none; border-right: 1px solid #1e2732; color: #9fb4c6;
  font: bold 12px 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.5px; cursor: pointer; }
#simple-bar button.on { color: #00e5ff; background: rgba(0,229,255,0.10); box-shadow: inset 0 -3px 0 #00e5ff; }
#simple-bar button.simple-exit { flex: 0 0 auto; padding: 0 12px; color: #ffb000; border-right: none; }
body.simple-mode #simple-view { display: flex; position: fixed; left: 0; right: 0; top: calc(40px + env(safe-area-inset-top)); bottom: 0; background: #000; }
#simple-host { flex: 1 1 0; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
#simple-host > .page-content, #simple-host > #pfd-wrap { flex: 1 1 0; }
#pfdov-size { position: static; align-items: center; }
#pfdov-size span { flex: 0 0 auto; min-width: 34px; text-align: center; color: #9fb4c6; font: bold 10px 'Helvetica Neue', Arial, sans-serif; }
`;
  (document.head || document.documentElement).appendChild(st);
})();
