// ─────────────────────────────────────────────────────────────
// 15-heli3d.js — 흰수리(해양경찰 헬기) 3D 모형 · SIM 외부 시점
//
// 3D 지도에 실제 크기로 그린다 — 전장 20m(주로터 앞 끝에서 꼬리로터 뒤 끝까지).
// 입면도·평면도·측면도의 비율을 따랐다(주로터 지름 14.1m · 꼬리로터 3m · 동체 18.8m).
// 도색: 흰 동체 · 위쪽 붉은 엔진 덮개 · 뒤로 노랑 → 파랑 띠(비스듬히) · 붉은 꼬리날개.
//
// 좌표(m): X 앞 + · Y 오른쪽 + · Z 위 +.
// 원점 = 전장의 한가운데 · 바퀴 바닥(지면). 함정 착함 판정(14-simmode.js 의
// SIM_AC_LEN 20m — 원점에서 앞뒤 10m)과 같은 원점이다.
//
// 그리기는 maplibre 의 사용자 레이어(WebGL)다. 지도 엔진이 그 프레임의 카메라
// 행렬(mainMatrix)을 넘겨 주면 그 위에 '자리 · 높이 · 기수 · 자세' 를 얹어 그린다.
// 동체 도색(띠·창)은 조각마다 모형 좌표로 셈해 경계가 번지지 않게 한다.
//
// 보이는 때:
//   · SIM 이 아닐 때 3D 지도 — 초록 삼각형 대신 이 모형(멀어서 너무 작으면 삼각형도 같이)
//   · SIM 외부 시점(EXT) — 뒤에서 따라가며 내 헬기를 본다. 1인칭에서는 그리지 않는다.
// ─────────────────────────────────────────────────────────────

const HELI3D_LEN = 20;                       // 전장(m)
const HELI3D_ROTOR = { x: 2.95, z: 5.45, r: 7.05, blades: 4 };          // 주로터
const HELI3D_TAIL  = { x: -8.55, y: 0.42, z: 4.35, r: 1.45, blades: 4 };  // 꼬리로터(오른쪽)
const HELI3D_RPS   = 4.4;                    // 주로터 회전(초당, 265rpm)
const HELI3D_TAIL_RPS = 3.1;                 // 꼬리로터 — 눈에 도는 것이 보이게 늦춰 그린다
const HELI3D_MARKER_PX = 14;                 // 모형이 이보다 작게 보이면 삼각형 표식도 띄운다

// 도색
const H3C = {
  white:  [0.955, 0.958, 0.962],
  red:    [0.850, 0.150, 0.170],
  yellow: [0.950, 0.760, 0.110],
  blue:   [0.140, 0.250, 0.580],
  dark:   [0.230, 0.245, 0.270],
  black:  [0.105, 0.112, 0.125],
  gray:   [0.560, 0.575, 0.600],
  blade:  [0.290, 0.305, 0.330],
  glass:  [0.160, 0.215, 0.270],
};

// ── 모형 만들기 ──
// 꼭짓점 하나 = 자리(3) · 법선(3) · 색(3) · 재질(1: 0 = 그 색 · 1 = 동체 도색)
function _h3New() { return []; }
function _h3Put(m, p, n, c, mat) { m.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], mat); }
const _h3Sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _h3Add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const _h3Mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const _h3Dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const _h3Cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function _h3Norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// 격자(줄 i × 둘레 j, 둘레는 닫힘)로 매끈한 면을 만든다. 법선은 둘레 면들의 평균이고,
// 줄마다 준 가운데(ctr[i])에서 바깥을 보게 맞춘다. caps 면 양 끝을 막는다.
function _h3Grid(m, P, ctr, col, mat, caps) {
  const I = P.length, J = P[0].length;
  const N = P.map(row => row.map(() => [0, 0, 0]));
  for (let i = 0; i < I - 1; i++) {
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j2], d = P[i][j2];
      const n = _h3Cross(_h3Sub(c, a), _h3Sub(d, b));
      [[i, j], [i + 1, j], [i + 1, j2], [i, j2]].forEach(([u, v]) => { N[u][v] = _h3Add(N[u][v], n); });
    }
  }
  for (let i = 0; i < I; i++) {
    for (let j = 0; j < J; j++) {
      let n = N[i][j];
      if (Math.hypot(n[0], n[1], n[2]) < 1e-9) n = _h3Sub(P[i][j], ctr[i]);
      n = _h3Norm(n);
      if (_h3Dot(n, _h3Sub(P[i][j], ctr[i])) < 0) n = _h3Mul(n, -1);
      N[i][j] = n;
    }
  }
  for (let i = 0; i < I - 1; i++) {
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      _h3Put(m, P[i][j], N[i][j], col, mat); _h3Put(m, P[i + 1][j], N[i + 1][j], col, mat); _h3Put(m, P[i + 1][j2], N[i + 1][j2], col, mat);
      _h3Put(m, P[i][j], N[i][j], col, mat); _h3Put(m, P[i + 1][j2], N[i + 1][j2], col, mat); _h3Put(m, P[i][j2], N[i][j2], col, mat);
    }
  }
  if (caps) {
    [[0, -1], [I - 1, 1]].forEach(([i, s]) => {
      const c = ctr[i];
      const ax = _h3Norm(_h3Sub(ctr[i === 0 ? 0 : I - 1], ctr[i === 0 ? 1 : I - 2]));
      for (let j = 0; j < J; j++) {
        _h3Put(m, c, ax, col, mat); _h3Put(m, P[i][j], ax, col, mat); _h3Put(m, P[i][(j + 1) % J], ax, col, mat);
      }
      void s;
    });
  }
}

// 단면을 이어 붙인 몸통(X 축을 따라). 단면 = 둥근 사각형(초타원)
//   st: [x, 반폭 w, 아래 zb, 위 zt, 모서리 지수 n(2 = 타원 · 클수록 각진다), 가운데 y(기본 0)]
const H3_SEG = 32;
function _h3Loft(m, st, col, mat, caps) {
  const P = [], C = [];
  st.forEach(([x, w, zb, zt, n, yc = 0]) => {
    const zc = (zt + zb) / 2, h = (zt - zb) / 2, e = 2 / n, row = [];
    for (let j = 0; j < H3_SEG; j++) {
      const t = j / H3_SEG * 2 * Math.PI, cy = Math.cos(t), sz = Math.sin(t);
      row.push([x, yc + w * Math.sign(cy) * Math.pow(Math.abs(cy), e), zc + h * Math.sign(sz) * Math.pow(Math.abs(sz), e)]);
    }
    P.push(row); C.push([x, yc, zc]);
  });
  _h3Grid(m, P, C, col, mat, caps);
}
// 앞뒤가 둥근 통(연료탱크·스폰슨·엔진 나셀) — 길이 x0..x1, 가운데 (y, z), 반폭·반높이
function _h3Pod(m, x0, x1, y, z, w, h, col, k = 3, n = 2.2) {
  const st = [], K = 14;
  for (let i = 0; i <= K; i++) {
    const u = -1 + 2 * i / K;                       // −1(뒤) … 1(앞)
    const s = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), k)), 1 / k);
    const x = (x0 + x1) / 2 + u * (x1 - x0) / 2;
    st.push([x, Math.max(0.01, w * s), z - Math.max(0.01, h * s), z + Math.max(0.01, h * s), n, y]);
  }
  _h3Loft(m, st, col, 0, false);
}
// 축을 도는 회전체 — prof: [[반지름, 축 위 거리] …], 축 a(단위), 가운데 c
function _h3Lathe(m, c, a, prof, col, segs = 20) {
  a = _h3Norm(a);
  const ref = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = _h3Norm(_h3Cross(a, ref)), v = _h3Cross(a, u);
  const P = [], C = [];
  prof.forEach(([r, s]) => {
    const row = [], cc = _h3Add(c, _h3Mul(a, s));
    for (let j = 0; j < segs; j++) {
      const t = j / segs * 2 * Math.PI;
      row.push(_h3Add(cc, _h3Add(_h3Mul(u, r * Math.cos(t)), _h3Mul(v, r * Math.sin(t)))));
    }
    P.push(row); C.push(cc);
  });
  _h3Grid(m, P, C, col, 0, false);
}
// 두 점 사이의 둥근 막대(다리·버팀대)
function _h3Rod(m, p0, p1, r, col) {
  const d = _h3Sub(p1, p0), L = Math.hypot(d[0], d[1], d[2]);
  _h3Lathe(m, p0, d, [[0, 0], [r, 0], [r, L], [0, L]], col, 10);
}
// 볼록 다각형(평면 좌표 [s, t])을 두께 th 로 세운 판 — 평면 = o + s·U + t·V, 두께 방향 W
function _h3Plate(m, poly, o, U, V, W, th, col) {
  const pt = ([s, t], k) => _h3Add(_h3Add(o, _h3Add(_h3Mul(U, s), _h3Mul(V, t))), _h3Mul(W, k * th / 2));
  const n = poly.length;
  [1, -1].forEach(k => {
    const nn = _h3Mul(_h3Norm(W), k);
    for (let i = 1; i < n - 1; i++) {
      _h3Put(m, pt(poly[0], k), nn, col, 0); _h3Put(m, pt(poly[i], k), nn, col, 0); _h3Put(m, pt(poly[i + 1], k), nn, col, 0);
    }
  });
  let cx = 0, cy = 0; poly.forEach(([s, t]) => { cx += s / n; cy += t / n; });
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const e = _h3Sub(pt(b, 0), pt(a, 0));
    let nn = _h3Norm(_h3Cross(e, W));
    const mid = _h3Mul(_h3Add(pt(a, 0), pt(b, 0)), 0.5);
    if (_h3Dot(nn, _h3Sub(mid, pt([cx, cy], 0))) < 0) nn = _h3Mul(nn, -1);
    const a1 = pt(a, 1), a0 = pt(a, -1), b1 = pt(b, 1), b0 = pt(b, -1);
    _h3Put(m, a0, nn, col, 0); _h3Put(m, b0, nn, col, 0); _h3Put(m, b1, nn, col, 0);
    _h3Put(m, a0, nn, col, 0); _h3Put(m, b1, nn, col, 0); _h3Put(m, a1, nn, col, 0);
  }
}
const H3X = [1, 0, 0], H3Y = [0, 1, 0], H3Z = [0, 0, 1];

// 동체 — 측면도에서 잰 단면(전장 20m 기준)
const H3_FUSE = [
  //  X      반폭   아래    위    지수
  [ 9.52, 0.02, 1.58, 1.62, 2.0],      // 레이돔 끝
  [ 9.40, 0.30, 1.30, 1.90, 2.0],
  [ 9.15, 0.44, 1.16, 2.04, 2.0],
  [ 8.85, 0.56, 1.09, 2.13, 2.2],      // 레이돔 뿌리
  [ 8.40, 0.78, 1.00, 2.36, 2.4],
  [ 7.80, 1.00, 0.92, 2.66, 2.6],      // 앞유리 아래
  [ 7.20, 1.15, 0.89, 3.05, 2.8],
  [ 6.70, 1.25, 0.88, 3.35, 3.0],
  [ 6.20, 1.30, 0.88, 3.45, 3.0],
  [ 5.50, 1.32, 0.88, 3.50, 3.2],      // 객실
  [-0.40, 1.32, 0.88, 3.50, 3.2],
  [-1.20, 1.22, 1.05, 3.50, 3.0],
  [-2.00, 1.00, 1.35, 3.48, 2.6],
  [-2.80, 0.80, 1.63, 3.45, 2.4],      // 꼬리 붐
  [-4.00, 0.60, 1.90, 3.42, 2.2],
  [-5.50, 0.45, 2.15, 3.40, 2.2],
  [-7.00, 0.33, 2.40, 3.38, 2.2],
  [-8.40, 0.26, 2.60, 3.40, 2.2],
  [-9.10, 0.18, 2.75, 3.38, 2.2],
  [-9.25, 0.02, 2.95, 3.15, 2.0],      // 꼬리 끝
];
// 엔진 덮개(위쪽 붉은 부분) — 객실 지붕 위
const H3_COWL = [
  [ 6.60, 0.55, 3.30, 3.46, 3.0],
  [ 6.10, 0.78, 3.30, 3.85, 3.0],
  [ 5.40, 0.92, 3.30, 4.45, 3.2],
  [ 4.80, 0.95, 3.30, 4.85, 3.4],
  [ 4.00, 0.92, 3.30, 4.97, 3.4],
  [ 1.50, 0.85, 3.30, 4.97, 3.4],
  [ 0.20, 0.80, 3.30, 4.80, 3.2],
  [-0.80, 0.70, 3.30, 4.30, 3.0],
  [-1.60, 0.55, 3.30, 3.80, 2.8],
  [-2.30, 0.35, 3.30, 3.45, 2.5],
  [-2.60, 0.10, 3.30, 3.36, 2.0],
];

function _h3BuildBody() {
  const m = _h3New();
  _h3Loft(m, H3_FUSE, H3C.white, 1, false);
  _h3Loft(m, H3_COWL, H3C.white, 1, false);
  // 엔진 나셀(좌우, 짙은 회색) · 앞 흡입구 · 덮개 앞면의 흡입구 두 개
  [-1, 1].forEach(s => {
    _h3Pod(m, -0.9, 3.6, s * 0.95, 3.95, 0.38, 0.45, H3C.dark, 4, 2.4);
    _h3Lathe(m, [3.25, s * 0.95, 3.95], H3X, [[0, 0.42], [0.30, 0.42], [0.34, 0.36]], H3C.black, 16);
    _h3Lathe(m, [5.55, s * 0.38, 4.05], H3X, [[0.18, 0], [0.18, 0.42], [0, 0.42]], H3C.black, 14);
  });
  // 바깥 연료탱크(흰색, 좌우) · 아래 바퀴 스폰슨과 동체에 이어 붙이는 받침
  [-1, 1].forEach(s => {
    _h3Pod(m, -1.20, 1.80, s * 1.80, 2.40, 0.45, 0.70, H3C.white, 2.6, 2.1);
    _h3Pod(m, -1.70, 1.90, s * 1.72, 1.15, 0.30, 0.26, H3C.white, 3, 2.4);
    const y0 = s * 1.25, y1 = s * 1.55;
    _h3Plate(m, [[-0.6, y0], [0.9, y0], [0.7, y1], [-0.4, y1]], [0, 0, 1.05], H3X, H3Y, H3Z, 0.10, H3C.white);
  });
  // 주바퀴(좌우) · 다리
  [-1, 1].forEach(s => {
    const y = s * 1.82;
    _h3Lathe(m, [0.84, y, 0.38], H3Y, [[0, -0.12], [0.24, -0.12], [0.36, -0.11], [0.38, -0.06], [0.38, 0.06],
                                        [0.36, 0.11], [0.24, 0.12], [0, 0.12]], H3C.black, 18);
    _h3Lathe(m, [0.84, y, 0.38], H3Y, [[0, -0.135], [0.17, -0.135], [0.17, 0.135], [0, 0.135]], H3C.gray, 12);
    _h3Rod(m, [0.84, s * 1.72, 0.95], [0.84, y - s * 0.16, 0.38], 0.07, H3C.gray);
    _h3Rod(m, [1.45, s * 1.62, 0.95], [0.84, y - s * 0.16, 0.42], 0.05, H3C.gray);
  });
  // 앞바퀴(두 개) · 다리
  [-1, 1].forEach(s => {
    _h3Lathe(m, [6.29, s * 0.21, 0.30], H3Y, [[0, -0.09], [0.20, -0.09], [0.30, -0.06], [0.30, 0.06],
                                              [0.20, 0.09], [0, 0.09]], H3C.black, 16);
  });
  _h3Rod(m, [6.29, 0, 0.92], [6.29, 0, 0.30], 0.07, H3C.gray);
  _h3Rod(m, [6.29, -0.24, 0.30], [6.29, 0.24, 0.30], 0.05, H3C.gray);
  // 기수 아래 FLIR · 오른쪽 위 구조용 호이스트
  _h3Lathe(m, [7.70, 0, 0.62], H3Z, [[0, 0], [0.16, 0.02], [0.22, 0.14], [0.20, 0.28], [0.08, 0.34], [0, 0.34]], H3C.gray, 16);
  _h3Pod(m, 4.20, 5.20, 1.48, 3.78, 0.21, 0.21, H3C.dark, 3, 2);
  _h3Plate(m, [[4.4, 1.15], [5.0, 1.15], [5.0, 1.42], [4.4, 1.42]], [0, 0, 3.86], H3X, H3Y, H3Z, 0.10, H3C.dark);
  // 마스트 · 꼬리로터 기어 덮개
  _h3Lathe(m, [HELI3D_ROTOR.x, 0, 4.85], H3Z, [[0.24, 0], [0.18, 0.12], [0.18, HELI3D_ROTOR.z - 4.85 - 0.05]], H3C.dark, 14);
  _h3Pod(m, HELI3D_TAIL.x - 0.35, HELI3D_TAIL.x + 0.35, Math.sign(HELI3D_TAIL.y) * 0.16, HELI3D_TAIL.z, 0.18, 0.24, H3C.blue, 3, 2);
  // 수직 꼬리날개(파랑) — 뒷전에 붉은 띠, 그 아래 붉은 꼬리 범퍼
  const fin = [[-6.40, 3.30], [-8.45, 4.70], [-9.30, 4.62], [-7.70, 2.10], [-7.00, 2.45]];
  _h3Plate(m, fin, [0, 0, 0], H3X, H3Z, H3Y, 0.24, H3C.blue);
  const C = [-9.30, 4.62], D = [-7.70, 2.10];
  const dir = _h3Norm([D[0] - C[0], D[1] - C[1], 0]), inn = [-dir[1], dir[0]];
  const w = 0.30;
  _h3Plate(m, [C, D, [D[0] + inn[0] * w, D[1] + inn[1] * w], [C[0] + inn[0] * w, C[1] + inn[1] * w]],
           [0, 0, 0], H3X, H3Z, H3Y, 0.27, H3C.red);
  _h3Rod(m, [-7.62, 0, 2.15], [-8.42, 0, 1.50], 0.06, H3C.red);
  _h3Rod(m, [-8.42, 0, 1.50], [-8.62, 0, 1.50], 0.05, H3C.red);
  // 수평 꼬리날개(붉은색) — 왼쪽에만 있다(꼬리로터는 오른쪽)
  _h3Plate(m, [[-7.00, -0.20], [-7.15, -2.25], [-7.90, -2.25], [-8.00, -0.20]], [0, 0, 3.05], H3X, H3Y, H3Z, 0.12, H3C.red);
  return m;
}
// 주로터(허브 가운데가 원점, Z 축으로 돈다)
function _h3BuildRotor() {
  const m = _h3New(), R = HELI3D_ROTOR.r;
  _h3Lathe(m, [0, 0, -0.10], H3Z, [[0, 0], [0.55, 0], [0.55, 0.14], [0, 0.14]], H3C.dark, 18);        // 허브 판
  _h3Lathe(m, [0, 0, 0.10], H3Z, [[0.56, 0], [0.50, 0.12], [0.34, 0.24], [0, 0.30]], H3C.dark, 18);   // 덮개
  for (let k = 0; k < HELI3D_ROTOR.blades; k++) {
    const a = k / HELI3D_ROTOR.blades * 2 * Math.PI;
    const U = [Math.cos(a), Math.sin(a), 0], V = [-Math.sin(a), Math.cos(a), 0];
    _h3Plate(m, [[0.45, -0.20], [1.10, -0.27], [R - 0.15, -0.24], [R, -0.12], [R, 0.18], [1.10, 0.27], [0.45, 0.20]],
             [0, 0, 0], U, V, H3Z, 0.08, H3C.blade);
  }
  return m;
}
// 꼬리로터(허브 가운데가 원점, Y 축으로 돈다). 꼬리날개 바깥쪽(s: 오른쪽 +1)에 붙는다.
function _h3BuildTail() {
  const m = _h3New(), R = HELI3D_TAIL.r, s = Math.sign(HELI3D_TAIL.y) || 1;
  _h3Lathe(m, [0, -0.12 * s, 0], [0, s, 0], [[0, 0], [0.20, 0], [0.20, 0.16], [0, 0.20]], H3C.dark, 14);
  for (let k = 0; k < HELI3D_TAIL.blades; k++) {
    const a = k / HELI3D_TAIL.blades * 2 * Math.PI;
    const U = [Math.cos(a), 0, Math.sin(a)], V = [-Math.sin(a), 0, Math.cos(a)];
    _h3Plate(m, [[0.15, -0.13], [R, -0.11], [R, 0.11], [0.15, 0.13]], [0, 0.06 * s, 0], U, V, H3Y, 0.05, H3C.blade);
  }
  return m;
}
// 도는 로터의 흐린 원판(반투명) — 한 프레임에 크게 도는 날개 사이를 메워 '돌고 있음' 을 보인다
function _h3BuildDisc(r, axis) {
  const m = _h3New(), N = 48;
  for (let j = 0; j < N; j++) {
    const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI;
    const pt = a => axis === 'z' ? [r * Math.cos(a), r * Math.sin(a), 0] : [r * Math.cos(a), 0, r * Math.sin(a)];
    const n = axis === 'z' ? H3Z : H3Y;
    _h3Put(m, [0, 0, 0], n, H3C.blade, 0); _h3Put(m, pt(a0), n, H3C.blade, 0); _h3Put(m, pt(a1), n, H3C.blade, 0);
  }
  return m;
}

// ── 그리기(WebGL) ──
const H3_VS = `
attribute vec3 a_pos; attribute vec3 a_nrm; attribute vec3 a_col; attribute float a_mat;
uniform mat4 u_mvp; uniform mat3 u_rot;
varying vec3 v_pos; varying vec3 v_nm; varying vec3 v_nw; varying vec3 v_col; varying float v_mat;
void main() {
  v_pos = a_pos; v_nm = a_nrm; v_nw = u_rot * a_nrm; v_col = a_col; v_mat = a_mat;
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`;
// 동체 도색 — 측면도의 띠·창 자리(모형 좌표 m)
const H3_FS = `
precision mediump float;
varying vec3 v_pos; varying vec3 v_nm; varying vec3 v_nw; varying vec3 v_col; varying float v_mat;
uniform vec3 u_light; uniform float u_alpha;
const vec3 WHITE  = vec3(${H3C.white.join(',')});
const vec3 RED    = vec3(${H3C.red.join(',')});
const vec3 YELLOW = vec3(${H3C.yellow.join(',')});
const vec3 BLUE   = vec3(${H3C.blue.join(',')});
const vec3 GLASS  = vec3(${H3C.glass.join(',')});
const vec3 RADOME = vec3(0.20, 0.215, 0.235);
bool inR(vec3 p, float x0, float x1, float z0, float z1) { return p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1; }
vec3 livery(vec3 p, vec3 n) {
  if (p.x > 8.86) return RADOME;                                   // 기수 레이돔
  if (abs(n.y) > 0.5) {                                            // 옆 창
    if (inR(p, 6.80, 7.70, 2.32, 3.18) || inR(p, 5.92, 6.72, 2.26, 3.14) ||
        inR(p, 5.06, 5.70, 2.06, 3.18) || inR(p, 7.08, 7.86, 1.32, 1.90)) return GLASS;
    if (inR(p, 2.22, 4.10, 2.08, 3.08)) {                          // 객실 큰 창 둘 — 파란 테
      if (inR(p, 2.30, 3.08, 2.16, 3.00) || inR(p, 3.24, 4.02, 2.16, 3.00)) return GLASS;
      return BLUE;
    }
  }
  if (n.x > 0.3 && p.x > 7.15 && p.z > 2.42 && p.z < 3.42 && abs(p.y) < 1.05) {   // 앞유리
    return abs(p.y) < 0.045 ? WHITE : GLASS;
  }
  float b1 = -1.6 + (3.45 - p.z) * 0.922;                          // 노랑 띠 앞 경계(비스듬히)
  float b2 = -3.73 + (3.45 - p.z) * 0.5;                           // 파랑 띠 앞 경계
  if (p.x < b2) return BLUE;
  if (p.x < b1) return YELLOW;
  if (p.z > 3.47 && p.x < 6.62) return RED;                        // 지붕 위 엔진 덮개
  return WHITE;
}
void main() {
  if (v_mat < -0.5) { gl_FragColor = vec4(v_col * u_alpha, u_alpha); return; }   // 스스로 빛나는 등(함정 수평 지시등)
  vec3 c = v_mat > 0.5 ? livery(v_pos, normalize(v_nm)) : v_col;
  vec3 nw = normalize(v_nw);
  float d = max(dot(nw, u_light), 0.0);
  float sky = 0.5 + 0.5 * nw.z;
  vec3 lit = c * (0.36 + 0.22 * sky + 0.52 * d);
  gl_FragColor = vec4(lit * u_alpha, u_alpha);
}`;
const H3_LIGHT = _h3Norm([0.32, -0.56, 0.77]);   // 해(남남동 · 높이 50°) — 동·북·위

let _h3 = null;          // { gl, prog, loc, parts: { body, rotor, tail, disc, tdisc }, vao }
let _h3Phase = 0, _h3TPhase = 0, _h3T = 0;
function _h3Upload(gl, arr) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
  return { buf, n: arr.length / 10 };
}
function _h3Shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('heli3d shader: ' + gl.getShaderInfoLog(s));
  return s;
}
function _h3Init(gl) {
  if (_h3 && _h3.gl === gl) return _h3;
  const prog = gl.createProgram();
  gl.attachShader(prog, _h3Shader(gl, gl.VERTEX_SHADER, H3_VS));
  gl.attachShader(prog, _h3Shader(gl, gl.FRAGMENT_SHADER, H3_FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('heli3d link: ' + gl.getProgramInfoLog(prog));
  const loc = {
    pos: gl.getAttribLocation(prog, 'a_pos'), nrm: gl.getAttribLocation(prog, 'a_nrm'),
    col: gl.getAttribLocation(prog, 'a_col'), mat: gl.getAttribLocation(prog, 'a_mat'),
    mvp: gl.getUniformLocation(prog, 'u_mvp'), rot: gl.getUniformLocation(prog, 'u_rot'),
    light: gl.getUniformLocation(prog, 'u_light'), alpha: gl.getUniformLocation(prog, 'u_alpha'),
  };
  // 지도 엔진은 제 VAO 로 그린다 — 우리 것은 따로 두어 그 상태를 건드리지 않는다
  let vao = null;
  if (typeof gl.createVertexArray === 'function') {
    vao = { create: () => gl.createVertexArray(), bind: v => gl.bindVertexArray(v) };
  } else {
    const ext = gl.getExtension('OES_vertex_array_object');
    if (ext) vao = { create: () => ext.createVertexArrayOES(), bind: v => ext.bindVertexArrayOES(v) };
  }
  const parts = {
    body: _h3Upload(gl, _h3BuildBody()), rotor: _h3Upload(gl, _h3BuildRotor()), tail: _h3Upload(gl, _h3BuildTail()),
    disc: _h3Upload(gl, _h3BuildDisc(HELI3D_ROTOR.r, 'z')), tdisc: _h3Upload(gl, _h3BuildDisc(HELI3D_TAIL.r, 'y')),
  };
  Object.values(parts).forEach(p => {
    if (vao) { p.vao = vao.create(); vao.bind(p.vao); }
    gl.bindBuffer(gl.ARRAY_BUFFER, p.buf);
    const S4 = 40;
    [[loc.pos, 3, 0], [loc.nrm, 3, 12], [loc.col, 3, 24], [loc.mat, 1, 36]].forEach(([l, n, o]) => {
      if (l < 0) return;
      gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, S4, o);
    });
    if (vao) vao.bind(null);
  });
  _h3 = { gl, prog, loc, parts, vao };
  return _h3;
}
function _h3Draw(h, part, mvp, rot, alpha) {
  const gl = h.gl, loc = h.loc;
  if (h.vao) h.vao.bind(part.vao);
  else {
    gl.bindBuffer(gl.ARRAY_BUFFER, part.buf);
    [[loc.pos, 3, 0], [loc.nrm, 3, 12], [loc.col, 3, 24], [loc.mat, 1, 36]].forEach(([l, n, o]) => {
      if (l < 0) return;
      gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 40, o);
    });
  }
  gl.uniformMatrix4fv(loc.mvp, false, mvp);
  gl.uniformMatrix3fv(loc.rot, false, rot);
  gl.uniform1f(loc.alpha, alpha);
  gl.drawArrays(gl.TRIANGLES, 0, part.n);
  if (h.vao) h.vao.bind(null);
  else [loc.pos, loc.nrm, loc.col, loc.mat].forEach(l => { if (l >= 0) gl.disableVertexAttribArray(l); });
}

// 4×4 행렬(열 우선 — WebGL 과 같다)
function _m4Mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
// 3×3(행 우선 배열 [[..],[..],[..]]) + 이동 → 4×4
function _m4From(R, t) {
  return Float64Array.from([R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0,
                            R[0][2], R[1][2], R[2][2], 0, t[0], t[1], t[2], 1]);
}
function _m3Mul(A, B) {
  return [0, 1, 2].map(r => [0, 1, 2].map(c => A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c]));
}
// 모형(X 앞 · Y 오른쪽 · Z 위) → 동·북·위. 롤(오른쪽 날개 내림 +) → 피치(기수 듦 +) → 기수(북에서 시계)
function heli3dRot(hdg, pit, bnk) {
  const p = hdg * D2R, t = pit * D2R, f = bnk * D2R;
  const cp = Math.cos(p), sp = Math.sin(p), ct = Math.cos(t), st = Math.sin(t), cf = Math.cos(f), sf = Math.sin(f);
  const Rz = [[cp, sp, 0], [-sp, cp, 0], [0, 0, 1]];
  const Rx = [[1, 0, 0], [0, ct, -st], [0, st, ct]];
  const Ry = [[cf, 0, sf], [0, 1, 0], [-sf, 0, cf]];
  const P  = [[0, 1, 0], [1, 0, 0], [0, 0, 1]];   // (X, Y, Z) → (동 = Y, 북 = X, 위 = Z)
  return _m3Mul(_m3Mul(_m3Mul(Rz, Rx), Ry), P);
}

// 지금 그릴 자리 — 화면 속 기체 높이(05-gps.js simVisAlt: 그려진 땅 + AGL, 공중에서는
// 지형의 기복·타일 바뀜을 걸러서). SIM 1인칭 카메라와 같은 셈이라 함정 갑판·지면에 그대로
// 앉고, 산 위를 지나도 튀지 않는다.
// 외부 시점은 카메라를 잡을 때 잰 값을 그 프레임의 그림에도 그대로 쓴다(_h3PoseNow) —
// 둘을 따로 재면 그 사이 지형 타일이 바뀐 프레임에서 모형만 홀로 튄다.
let _h3PoseNow = null;      // { t, pose } — 외부 시점 카메라가 이번 프레임에 쓴 자리
function heli3dPose(map) {
  const v = simVisAlt(map);
  return { lon: S.lon, lat: S.lat, alt: v.alt, agl: v.agl, hdg: S.hdg, pit: S.pit || 0, bnk: S.bnk || 0 };
}

// 지금 이 모형을 그리는가 — SIM 1인칭에서는 눈이 기체 안에 있으므로 그리지 않는다
function heli3dShown() {
  if (typeof _ml3d === 'undefined' || !_ml3d || !_ml3dReady) return false;
  if (typeof simModeOn !== 'undefined' && simModeOn) return !!simExtView || !!simCamTx;   // 시점이 바뀌는 동안에도 보인다
  return true;
}

const HELI3D_LAYER = {
  id: 'heli-3d', type: 'custom', renderingMode: '3d',
  onAdd(map, gl) { this.map = map; try { _h3Init(gl); } catch (e) { console.warn('[3D] heli model:', e); } },
  render(gl, args) {
    if (!heli3dShown()) return;
    let h;
    try { h = _h3Init(gl); } catch (e) { _swallow(e); return; }
    const main = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix)
              || (args && args.modelViewProjectionMatrix) || args;
    if (!main || main.length !== 16) return;
    // 로터는 시뮬 시간으로 돈다(멈추면 멈춘다 · 배속이면 빨리). GPS·리플레이는 실제 시간.
    const now = performance.now();
    const dt = _h3T ? Math.min(0.25, (now - _h3T) / 1000) : 0;
    _h3T = now;
    let k = 0;
    try {
      if (gpsMode || _fdrPlaying) k = 1;
      else if (S.running) k = simSpeed * ((typeof simModeOn !== 'undefined' && simModeOn) ? Math.max(0, simNr) / 100 : 1);
    } catch (e) { k = S.running ? 1 : 0; }
    _h3Phase  = (_h3Phase  + dt * k * HELI3D_RPS * 2 * Math.PI) % (2 * Math.PI);
    _h3TPhase = (_h3TPhase + dt * k * HELI3D_TAIL_RPS * 2 * Math.PI) % (2 * Math.PI);

    const pc = _h3PoseNow;
    const pose = (pc && simExtView && now - pc.t < 60) ? pc.pose : heli3dPose(this.map);
    const mc = maplibregl.MercatorCoordinate.fromLngLat([pose.lon, pose.lat], pose.alt);
    const s = mc.meterInMercatorCoordinateUnits();
    const R = heli3dRot(pose.hdg, pose.pit, pose.bnk);
    const toMerc = [[s, 0, 0], [0, -s, 0], [0, 0, s]];
    const base = _m4Mul(main, _m4From(_m3Mul(toMerc, R), [mc.x, mc.y, mc.z]));
    const rot3 = new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
    const ca = Math.cos(-_h3Phase), sa = Math.sin(-_h3Phase);   // 위에서 볼 때 시계 방향
    const rotorM = _m4Mul(base, _m4From([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]], [HELI3D_ROTOR.x, 0, HELI3D_ROTOR.z]));
    const discM  = _m4Mul(base, _m4From([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [HELI3D_ROTOR.x, 0, HELI3D_ROTOR.z + 0.01]));
    const cb = Math.cos(_h3TPhase), sb = Math.sin(_h3TPhase);
    const tailM  = _m4Mul(base, _m4From([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], [HELI3D_TAIL.x, HELI3D_TAIL.y, HELI3D_TAIL.z]));
    const tdiscM = _m4Mul(base, _m4From([[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                                        [HELI3D_TAIL.x, HELI3D_TAIL.y + 0.06 * Math.sign(HELI3D_TAIL.y), HELI3D_TAIL.z]));
    const rotR = (Rm) => {   // 부품의 회전까지 얹은 법선 회전
      const M = _m3Mul(R, Rm);
      return new Float32Array([M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]]);
    };
    gl.useProgram(h.prog);
    gl.uniform3fv(h.loc.light, H3_LIGHT);
    const f32 = a => new Float32Array(a);
    _h3Draw(h, h.parts.body, f32(base), rot3, 1);
    _h3Draw(h, h.parts.rotor, f32(rotorM), rotR([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]]), 1);
    _h3Draw(h, h.parts.tail, f32(tailM), rotR([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]]), 1);
    // 도는 원판은 흐리게 — 깊이는 쓰지 않는다(뒤의 것을 가리지 않게)
    if (k > 0) {
      gl.depthMask(false);
      _h3Draw(h, h.parts.disc, f32(discM), rot3, 0.08);
      _h3Draw(h, h.parts.tdisc, f32(tdiscM), rot3, 0.16);
      gl.depthMask(true);
    }
  },
};

// 3D 지도가 뜨면(04-map.js 의 load) 한 번 얹는다
function heli3dAddTo(map) {
  if (!map || map.getLayer('heli-3d')) return;
  try { map.addLayer(Object.assign({}, HELI3D_LAYER)); } catch (e) { console.warn('[3D] heli layer:', e); }
}
// 화면에 보이는 모형의 길이(px) — 너무 작으면 삼각형 표식을 같이 띄운다
function heli3dScreenLen(map) {
  map = map || _ml3d;
  try {
    const h = S.hdg * D2R, half = HELI3D_LEN / 2, cl = Math.cos(S.lat * D2R);
    const at = d => [S.lon + d * Math.sin(h) / (111320 * cl), S.lat + d * Math.cos(h) / 111320];
    const a = map.project(at(half)), b = map.project(at(-half));
    return Math.hypot(a.x - b.x, a.y - b.y);
  } catch (e) { return 0; }
}
// 매 프레임(04-map.js _update3dMarker) — 모형이 화면에 있으면 다시 그리게 한다
// (기체가 움직이거나 로터가 도는 동안 지도 카메라가 가만히 있어도 그림이 따라오게)
function heli3dTick() {
  if (!heli3dShown() || !_map3dShown()) return;
  const sim = (typeof simModeOn !== 'undefined') && simModeOn;
  if (!(S.running || gpsMode || _fdrPlaying || sim)) return;
  // 화면 밖에 있으면 다시 그릴 까닭이 없다(지도를 손으로 옮겨 다른 곳을 볼 때)
  if (!sim) {
    try {
      const p = _ml3d.project([S.lon, S.lat]), c = _ml3d.getContainer();
      if (p.x < -200 || p.y < -200 || p.x > c.clientWidth + 200 || p.y > c.clientHeight + 200) return;
    } catch (e) { _swallow(e); }
  }
  try { _ml3d.triggerRepaint(); } catch (e) { _swallow(e); }
}

// ── SIM 외부 시점 ──
// 뒤에서 따라가며 내 헬기를 본다. 시야 둘러보기(B0 + 햇)는 헬기를 축으로 카메라를 돌린다
// — ◀▶ 로 둘레를 돌고 ▲▼ 로 위아래로 오르내린다. 놓으면 다시 뒤로 돌아온다.
let simExtView = false;
const EXT_DIST = 40;     // 헬기 가운데까지의 거리(m) — 전장의 두 배(가로로 넓은 창)
const EXT_SPAN = 44;     // 화면 가로에 들어올 폭(m) — 좁은(세로로 긴) 창이면 그만큼 물러선다
const EXT_ELEV = 12;     // 내려다보는 각(°)
const EXT_TGT_Z = 2.5;   // 바라보는 곳 — 바닥에서 2.5m(동체 가운데)
let _extFloor = null, _extFloorT = 0;
// 외부 시점 카메라 조작(3D 창 EXT 아래 버튼) — 헬기를 축으로 1° 씩 돌고(◀▶), 위아래(▲▼),
// 거리(− 가까이 · + 멀리), DEFAULT(뒤에서 기본 거리·각). 누르고 있으면 이어 간다.
const EXT_ZOOM_STEP = 1.1, EXT_ZOOM_MIN = 0.5, EXT_ZOOM_MAX = 25;
let extCam = { yaw: 0, elev: 0, zoom: 1 };
function extCamStep(dir) {
  if (dir === 'L') extCam.yaw = normAS(extCam.yaw - 1);
  else if (dir === 'R') extCam.yaw = normAS(extCam.yaw + 1);
  else if (dir === 'U') extCam.elev = Math.min(85 - EXT_ELEV, extCam.elev + 1);
  else if (dir === 'D') extCam.elev = Math.max(-5 - EXT_ELEV, extCam.elev - 1);
  else if (dir === 'IN') extCam.zoom = Math.max(EXT_ZOOM_MIN, extCam.zoom / EXT_ZOOM_STEP);
  else if (dir === 'OUT') extCam.zoom = Math.min(EXT_ZOOM_MAX, extCam.zoom * EXT_ZOOM_STEP);
  try { if (_ml3d) _applyFollow(); } catch (e) { _swallow(e); }
  updateExtCamInfo();
}
function extCamDefault() { extCam = { yaw: 0, elev: 0, zoom: 1 }; try { if (_ml3d) _applyFollow(); } catch (e) { _swallow(e); } updateExtCamInfo(); }
let _extHoldT = null, _extHoldI = null;
function extCamHold(dir) {
  extCamStop();
  extCamStep(dir);
  _extHoldT = setTimeout(() => { _extHoldI = setInterval(() => extCamStep(dir), 50); }, 350);
}
function extCamStop() {
  if (_extHoldT) { clearTimeout(_extHoldT); _extHoldT = null; }
  if (_extHoldI) { clearInterval(_extHoldI); _extHoldI = null; }
}
function updateExtCamInfo() {
  const el = document.getElementById('extcam-info');
  if (el) el.textContent = `${Math.round((extCam.yaw + 360) % 360)}° · ${EXT_ELEV + extCam.elev}° · ×${extCam.zoom.toFixed(1)}`;
}
document.addEventListener('pointerup', extCamStop);
document.addEventListener('pointercancel', extCamStop);   // 외부 시점 카메라의 바닥(그려진 땅 + 3m, 걸러서)
// ── 1인칭 ⇄ 외부 시점 전환 효과 ── 같은 시선에서 뒤로 쑥 물러나며 헬기가 앞으로 나오고(→ EXT),
// 거꾸로 헬기 조종석으로 쑥 빨려 들어간다(→ 1인칭). 시점(simExtView)은 곧바로 바뀌고, 카메라만
// SIM_CAM_TX_MS 동안 두 자리 사이를 부드럽게 옮긴다(05-gps.js _ml3dSimCamera).
const SIM_CAM_TX_MS = 900;
let simCamTx = null;            // { toExt, t0 }
function simCamTxK() {
  if (!simCamTx) return 1;
  const x = Math.min(1, (performance.now() - simCamTx.t0) / SIM_CAM_TX_MS);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;   // 천천히 시작해 천천히 멎는다
}
function _simCamTxStart(toExt) {
  if (!(typeof simModeOn !== 'undefined' && simModeOn && _ml3d && (typeof _map3dShown !== 'function' || _map3dShown()))) { simCamTx = null; return; }
  simCamTx = { toExt, t0: performance.now() };
  const tick = () => {
    if (!simCamTx) return;
    try { _applyFollow(); } catch (e) { _swallow(e); }
    if (performance.now() - simCamTx.t0 >= SIM_CAM_TX_MS) {
      simCamTx = null;
      try { syncChinView(); } catch (e) { _swallow(e); }          // 조종석에 들어선 뒤에 CHIN 창·기수
      try { _applyFollow(); } catch (e) { _swallow(e); }
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function toggleExtView(on) {
  const was = simExtView;
  simExtView = (typeof on === 'boolean') ? on : !simExtView;
  if (simExtView !== was) _simCamTxStart(simExtView);
  try { if (typeof simLookReset === 'function') simLookReset(); } catch (e) { _swallow(e); }
  try { syncChinView(); } catch (e) { _swallow(e); }
  try { if (typeof pfdOverlaySync === 'function') pfdOverlaySync(); } catch (e) { _swallow(e); }
  try { if (_ml3d) _ml3d.triggerRepaint(); } catch (e) { _swallow(e); }
  requestAnimationFrame(() => { try { if (_ml3d) _applyFollow(); } catch (e) { _swallow(e); } });
}
function heli3dExtCamera() {
  if (!_ml3d) return;
  try { if (_ml3d.getCenterClampedToGround && _ml3d.getCenterClampedToGround()) _ml3d.setCenterClampedToGround(false); }
  catch (e) { _swallow(e); }
  const p = heli3dExtPose();
  if (!p) return;
  try { _ml3d.jumpTo(_ml3dCamOptions(p.lon, p.lat, p.alt, p.bearing, p.pitch, p.roll, p.dist)); }
  catch (e) { _swallow(e); }
}
// 외부 시점 카메라 자리·방향(헬기 뒤 조금 위에서 헬기를 겨눈다) — 시점 전환 효과도 쓴다
function heli3dExtPose() {
  if (!_ml3d) return null;
  const pose = heli3dPose();
  _h3PoseNow = { t: performance.now(), pose };
  let look = { yaw: 0, pitch: 0 };
  try { if (typeof simLookStep === 'function') look = simLookStep(); } catch (e) { _swallow(e); }
  const az = normA(pose.hdg + look.yaw + extCam.yaw);
  let el = Math.max(-5, Math.min(85, EXT_ELEV + extCam.elev - look.pitch));   // 햇 ▲ = 올려다본다(카메라가 내려간다)
  const tgtAlt = pose.alt + EXT_TGT_Z;
  // 창의 가로 시야각으로 거리를 정한다 — 헬기 전체(와 앞뒤 여유)가 가로에 들어오게
  const box = _ml3d.getContainer();
  let fov = 36.87;
  try { if (Number.isFinite(_ml3d.transform.fov)) fov = _ml3d.transform.fov; } catch (e) { _swallow(e); }
  const hHalf = Math.atan(Math.tan(fov / 2 * D2R) * (box.clientWidth || 1) / (box.clientHeight || 1));
  const R = Math.max(EXT_DIST, EXT_SPAN / 2 / Math.tan(hHalf)) * extCam.zoom;
  let horiz = R * Math.cos(el * D2R), up = R * Math.sin(el * D2R);
  const cl = Math.cos(pose.lat * D2R);
  const camLon = pose.lon - horiz * Math.sin(az * D2R) / (111320 * cl);
  const camLat = pose.lat - horiz * Math.cos(az * D2R) / 111320;
  // 카메라가 땅(그려진 지형) 아래로 들어가지 않게 — 그만큼 들어 올리고 다시 헬기를 겨눈다.
  // 그 바닥은 부드럽게 따라간다(능선을 넘는 순간 카메라가 덜컥 뛰지 않게 — 오를 때는
  // 빨리, 내릴 때는 천천히).
  let gnd = null;
  try { gnd = _ml3d.queryTerrainElevation([camLon, camLat]); } catch (e) { gnd = null; }
  const now = performance.now();
  const dt = _extFloorT ? Math.min(0.25, (now - _extFloorT) / 1000) : 0;
  _extFloorT = now;
  const fTgt = Number.isFinite(gnd) ? gnd + 3 : -Infinity;
  if (_extFloor === null || !Number.isFinite(_extFloor) || !(dt > 0) || !Number.isFinite(fTgt)) _extFloor = fTgt;
  else _extFloor += (fTgt - _extFloor) * Math.min(1, dt / (fTgt > _extFloor ? 0.25 : 1.0));
  let camAlt = tgtAlt + up;
  if (Number.isFinite(_extFloor) && camAlt < _extFloor) {
    camAlt = _extFloor;
    el = Math.atan2(camAlt - tgtAlt, horiz) / D2R;
  }
  const dist = Math.hypot(horiz, camAlt - tgtAlt);
  const pitch = Math.max(0, Math.min(180, 90 - el));
  return { lon: camLon, lat: camLat, alt: camAlt, bearing: az, pitch, roll: 0, dist };
}

// ── 1인칭의 기수(nose) ──
// 조종석에서 앞을 보면 앞유리 아래 가운데로 내 헬기의 기수가 보인다. 1인칭 화면 아래
// 가운데에 높이 1/10 만큼 그린다(index.html #sim-nose). 기수는 기체에 붙어 있으므로
// 자세·뱅크가 바뀌어도 화면에서 그 자리 그대로다(카메라가 기체와 함께 기운다).
// 둘러보기(B0 + 햇)로 고개를 돌리면 그만큼 화면 밖으로 비켜 간다.
function heli3dNoseSync(look) {
  const el = document.getElementById('sim-nose');
  if (!el) return;
  const want = (typeof simModeOn !== 'undefined') && simModeOn && !simExtView && !simCamTx &&
               !!_ml3d && (typeof _map3dShown !== 'function' || _map3dShown());
  const ck = want && ckpitWanted();                       // 조종석 패널이 덮으면 기수는 감춘다(패널 아래에 가려 보이지 않는다)
  const showNose = want && !ck;
  if (el.classList.contains('show') !== showNose) el.classList.toggle('show', showNose);
  if (!want) { ckpitSync(null); return; }
  const H = (_ml3d && _ml3d.getContainer().clientHeight) || 600;
  let fov = 36.87;
  try { if (Number.isFinite(_ml3d.transform.fov)) fov = _ml3d.transform.fov; } catch (e) { _swallow(e); }
  const ppd = H / fov;                                    // 1° 가 화면에서 몇 px
  const dx = -((look && look.yaw) || 0) * ppd, dy = ((look && look.pitch) || 0) * ppd;
  const tf = `translate(calc(-50% + ${dx.toFixed(1)}px), ${dy.toFixed(1)}px)`;
  if (el.style.transform !== tf) el.style.transform = tf;
  ckpitSync(`translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`);
}

// ── 조종석 패널(1인칭 · SIM) ── 3D 화면 아래쪽에 흰수리 조종석(차양 · MFD 넷 · 가운데 콘솔 · 사이클릭 ·
// 앞유리 틀)을 겹쳐 그린다. 3D 창의 '조종석' 버튼으로 켜고 끈다(이 기기에 적어 둔다). 외부 시점(EXT)·시점이
// 바뀌는 동안은 숨기고, 시야를 둘러보면(B0 + 햇) 기수처럼 함께 움직인다(heli3dNoseSync).
// 바닥 쪽은 비워 두어 땅이 보이고, CHIN 창은 패널 아래(발밑) 좌·우로 줄여 내린다. MFD 넷은 살아 있는 화면이다 —
// 모니터 번호는 왼쪽부터 1 · 3 · 4 · 2 번이다(실기 배치):
// 1 · 2 = PFD(03-pfd.js drawPfdTo) · 3 = 움직이는 지도(기수 위 · ckMapDraw) ·
// 4 = CDU Aircraft Systems 에서 고른 SYSTEM 화면(18-system.js sysDrawTo · sysPage — Map 이면 그 큰 칸에 지도).
// 스크린을 뺀 틀·구조는 반투명이라 그 너머 바깥이 비쳐 보인다(index.html #sim-ckpit svg).
// 그림 좌표는 1600×900(화면을 가득 채워 늘린다).
const CKPIT_PREF = 'ckpitOv';
let ckpitOn = false;
try { ckpitOn = localStorage.getItem(CKPIT_PREF) === '1'; } catch (e) { _swallow(e); }
// MFD 화면 자리(그림 좌표) — 테두리 안쪽
const CKPIT_SCR = [
  { k: 'pfd', x: 229, y: 580, w: 242, h: 146 },    // 1번
  { k: 'map', x: 527, y: 580, w: 242, h: 146 },    // 3번
  { k: 'sys', x: 831, y: 580, w: 242, h: 146 },    // 4번
  { k: 'pfd', x: 1129, y: 580, w: 242, h: 146 },   // 2번(부조종사 PFD)
];
function _ckpitSvg() {
  const bez = CKPIT_SCR.map(s => {
    const x = s.x - 14, y = s.y - 12, w = s.w + 28, h = s.h + 40;
    let keys = '';
    for (let i = 0; i < 7; i++) keys += `<rect x="${(x + 22 + i * 34).toFixed(0)}" y="${y + h - 19}" width="22" height="9" rx="2" fill="#3a3e43"/>`;
    for (let i = 0; i < 4; i++) keys += `<rect x="${x + 4}" y="${y + 22 + i * 30}" width="6" height="16" rx="1.5" fill="#33373c"/><rect x="${x + w - 10}" y="${y + 22 + i * 30}" width="6" height="16" rx="1.5" fill="#33373c"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#ck-bez)" stroke="#0c0d0f" stroke-width="2"/>
      <rect x="${s.x - 2}" y="${s.y - 2}" width="${s.w + 4}" height="${s.h + 4}" fill="#050607"/>${keys}`;
  }).join('');
  let knobs = '';
  for (const x0 of [222, 1124]) for (let i = 0; i < 8; i++) {
    const cx = x0 + 18 + i * 33;
    knobs += `<circle cx="${cx}" cy="772" r="9" fill="#2c3035" stroke="#0e0f11" stroke-width="2"/><circle cx="${cx}" cy="772" r="3.5" fill="#55595e"/>`;
  }
  let pkeys = '';
  for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++)
    pkeys += `<rect x="${708 + i * 21}" y="${866 + r * 13}" width="15" height="8" rx="1.5" fill="#34383d"/>`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ck-hood" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a3d42"/><stop offset="0.35" stop-color="#202226"/><stop offset="1" stop-color="#121315"/></linearGradient>
    <linearGradient id="ck-face" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1a1c1f"/><stop offset="1" stop-color="#25282c"/></linearGradient>
    <linearGradient id="ck-bez" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2f3337"/><stop offset="1" stop-color="#1d2023"/></linearGradient>
    <linearGradient id="ck-ped" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2a2d31"/><stop offset="1" stop-color="#16181a"/></linearGradient>
    <linearGradient id="ck-post" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#0f1012"/><stop offset="0.5" stop-color="#2b2e32"/><stop offset="1" stop-color="#0f1012"/></linearGradient>
    <linearGradient id="ck-grip" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#16181a"/><stop offset="0.45" stop-color="#3b3f44"/><stop offset="1" stop-color="#121315"/></linearGradient>
  </defs>
  <!-- 앞유리 틀 — 위 띠 · 가운데 기둥 · 좌우 문 기둥 · 와이퍼 -->
  <path d="M0 0 H1600 V20 Q800 36 0 20 Z" fill="#141518"/>
  <path d="M786 0 H814 L820 520 H780 Z" fill="url(#ck-post)"/>
  <path d="M0 150 L0 250 L196 600 L246 570 Z" fill="url(#ck-post)"/>
  <path d="M1600 150 L1600 250 L1404 600 L1354 570 Z" fill="url(#ck-post)"/>
  <path d="M742 512 L700 300" stroke="#16181a" stroke-width="7" stroke-linecap="round"/>
  <path d="M858 512 L900 300" stroke="#16181a" stroke-width="7" stroke-linecap="round"/>
  <!-- 계기판 앞면 -->
  <path d="M168 556 H1432 L1446 792 Q800 812 154 792 Z" fill="url(#ck-face)" stroke="#0b0c0e" stroke-width="2"/>
  ${bez}
  ${knobs}
  <!-- 차양(glareshield) — 가운데가 조금 솟은 덮개 -->
  <path d="M140 618 C150 548 214 520 300 516 L690 512 C736 492 864 492 910 512 L1300 516 C1386 520 1450 548 1460 618 L1432 566 C1400 560 1340 562 1300 562 L300 562 C260 562 200 560 168 566 Z" fill="url(#ck-hood)" stroke="#0a0b0c" stroke-width="2"/>
  <path d="M300 516 L690 512 C736 492 864 492 910 512 L1300 516" fill="none" stroke="#4a4e54" stroke-width="1.5" opacity="0.7"/>
  <!-- 주의·경고등 · 대기 계기 -->
  <rect x="566" y="530" width="64" height="20" rx="3" fill="#3a2a06" stroke="#0a0b0c"/><text x="598" y="544" font-size="10" font-family="Arial" font-weight="bold" fill="#8a6a1a" text-anchor="middle">CAUTION</text>
  <rect x="970" y="530" width="64" height="20" rx="3" fill="#3a0c0c" stroke="#0a0b0c"/><text x="1002" y="544" font-size="10" font-family="Arial" font-weight="bold" fill="#8a2a2a" text-anchor="middle">WARNING</text>
  <rect x="756" y="522" width="88" height="36" rx="4" fill="#0d0f11" stroke="#3a3e43" stroke-width="2"/>
  <rect x="764" y="528" width="72" height="24" fill="#123a5a"/><rect x="764" y="540" width="72" height="12" fill="#5a3a1a"/><line x1="764" y1="540" x2="836" y2="540" stroke="#fff" stroke-width="1.2"/>
  <!-- 가운데 콘솔(pedestal) -->
  <path d="M686 796 L914 796 L968 900 L632 900 Z" fill="url(#ck-ped)" stroke="#0b0c0e" stroke-width="2"/>
  <rect x="704" y="808" width="100" height="50" rx="3" fill="#0b0d0e" stroke="#3a3e43"/>
  <rect x="710" y="813" width="88" height="40" fill="#0e3a3a"/>
  <line x1="716" y1="822" x2="788" y2="822" stroke="#3ad1a0" stroke-width="2"/><line x1="716" y1="832" x2="770" y2="832" stroke="#3ad1a0" stroke-width="2"/><line x1="716" y1="842" x2="780" y2="842" stroke="#2fe0e0" stroke-width="2"/>
  <rect x="816" y="808" width="82" height="50" rx="3" fill="#0b0d0e" stroke="#3a3e43"/><rect x="822" y="813" width="70" height="40" fill="#101a16"/>
  ${pkeys}
  <!-- 사이클릭(좌 · 우) -->
  <g><path d="M418 900 C418 868 400 852 404 826" stroke="url(#ck-grip)" stroke-width="26" fill="none" stroke-linecap="round"/>
     <path d="M372 808 C372 788 440 784 446 806 C450 822 436 834 404 834 C380 834 372 824 372 808 Z" fill="url(#ck-grip)" stroke="#0a0b0c" stroke-width="2"/>
     <circle cx="430" cy="800" r="5" fill="#b01818"/><circle cx="398" cy="804" r="4" fill="#55595e"/></g>
  <g><path d="M1182 900 C1182 868 1200 852 1196 826" stroke="url(#ck-grip)" stroke-width="26" fill="none" stroke-linecap="round"/>
     <path d="M1228 808 C1228 788 1160 784 1154 806 C1150 822 1164 834 1196 834 C1220 834 1228 824 1228 808 Z" fill="url(#ck-grip)" stroke="#0a0b0c" stroke-width="2"/>
     <circle cx="1170" cy="800" r="5" fill="#b01818"/><circle cx="1202" cy="804" r="4" fill="#55595e"/></g>
</svg>`;
}
function _ckpitEl() {
  let el = document.getElementById('sim-ckpit');
  if (el) return el;
  const d3 = document.getElementById('map3d');
  if (!d3) return null;
  el = document.createElement('div');
  el.id = 'sim-ckpit'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = _ckpitSvg() + CKPIT_SCR.map((s, i) =>
    `<canvas class="ck-scr" data-i="${i}" data-no-fcp="1" style="left:${(s.x / 16).toFixed(3)}%;top:${(s.y / 9).toFixed(3)}%;width:${(s.w / 16).toFixed(3)}%;height:${(s.h / 9).toFixed(3)}%"></canvas>`).join('');
  d3.appendChild(el);
  return el;
}
// 지금 보여야 하나 — 기수와 같은 조건(SIM 1인칭 · 3D 가 떠 있음) + 버튼
function ckpitWanted() {
  return ckpitOn && (typeof simModeOn !== 'undefined') && simModeOn && !simExtView && !simCamTx &&
         !!_ml3d && (typeof _map3dShown !== 'function' || _map3dShown());
}
// 보이기·감추기와 시야 둘러보기 이동(heli3dNoseSync 가 매 프레임 부른다)
function ckpitSync(tf) {
  const want = ckpitWanted();
  const el = want ? _ckpitEl() : document.getElementById('sim-ckpit');
  const b = document.getElementById('ckpit-btn');
  if (b) {
    const sim = (typeof simModeOn !== 'undefined') && simModeOn;
    if (b.classList.contains('show') !== sim) b.classList.toggle('show', sim);
    if (b.classList.contains('on') !== ckpitOn) { b.classList.toggle('on', ckpitOn); }
    const t = ckpitOn ? '조종석 ON' : '조종석 OFF';
    if (b.textContent !== t) b.textContent = t;
  }
  // CHIN 창은 패널 아래(발밑)로 줄여 내린다(index.html #map3d.ckpit-on + #chin-row) — 줄면 그 지도들을 다시 잰다
  const d3 = document.getElementById('map3d');
  if (d3 && d3.classList.contains('ckpit-on') !== want) {
    d3.classList.toggle('ckpit-on', want);
    setTimeout(() => { try { (typeof _chinMaps !== 'undefined' ? _chinMaps : []).forEach(m => m && m.resize && m.resize()); } catch (e) { _swallow(e); } }, 30);
  }
  if (!el) return;
  if (el.classList.contains('show') !== want) { el.classList.toggle('show', want); if (want) ckpitDraw(); }
  if (want && tf != null && el.style.transform !== tf) el.style.transform = tf;
}
// MFD 화면 그리기 — 1초에 열 번(PFD 창·계통 창과 따로 그린다)
function ckpitDraw() {
  const el = document.getElementById('sim-ckpit');
  if (!el || !el.classList.contains('show')) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  el.querySelectorAll('canvas.ck-scr').forEach(c => {
    const s = CKPIT_SCR[+c.dataset.i];
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!(cw > 4 && ch > 4)) return;
    // 칸이 작으면 큰 크기로 그려 줄여 보인다(글자가 겹치지 않게 · 07-sim.js PFD_OV_MINW 와 같은 생각)
    const k = Math.max(dpr, (s.k === 'pfd' ? 420 : 520) / cw);
    const W = Math.round(cw * k), H = Math.round(ch * k);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    try {
      if (s.k === 'pfd') { if (typeof drawPfdTo === 'function') drawPfdTo(c); }
      else if (s.k === 'map') { const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); ckMapDraw(g, 0, 0, W, H); }
      else if (s.k === 'sys') {
        const pg = typeof sysPage !== 'undefined' ? sysPage : 'asys_fuel';
        if (typeof sysDrawTo === 'function') sysDrawTo(c, pg);
        if (pg === 'map') {                         // SYSTEM 창과 같은 자리(큰 칸 안쪽 227,49 · 766×574)
          const g = c.getContext('2d'), kk = Math.min(W / SYS_W, H / SYS_H);
          const ox = (W - SYS_W * kk) / 2, oy = (H - SYS_H * kk) / 2;
          g.setTransform(1, 0, 0, 1, 0, 0);
          ckMapDraw(g, ox + 227 * kk, oy + 49 * kk, 766 * kk, 574 * kk);
        }
      }
      else if (typeof sysDrawTo === 'function') sysDrawTo(c, s.k);
    } catch (e) { _swallow(e); }
  });
}
// ── MFD 움직이는 지도(기수 위) ── 2D 지도에서 쓰는 바탕(위성 · OSM)을 그대로 받아(같은 타일 주소) 캔버스에 돌려 그린다.
// 축척은 2D 지도 확대 단계보다 한 단계 넓게(7~14). 비행계획(마젠타 · 활성 구간 굵게) · 거리 고리 · 내 헬기.
const _ckTiles = new Map();
function _ckTile(z, x, y) {
  const n = 1 << z; x = ((x % n) + n) % n;
  if (y < 0 || y >= n) return null;
  const sat = !(typeof osmLayer !== 'undefined' && typeof leafMap !== 'undefined' && leafMap.hasLayer(osmLayer));
  const key = `${sat ? 's' : 'o'}/${z}/${x}/${y}`;
  let im = _ckTiles.get(key);
  if (!im) {
    im = new Image(); im.crossOrigin = 'anonymous';
    im.src = sat ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
                 : `https://${'abc'[(x + y) % 3]}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
    _ckTiles.set(key, im);
    if (_ckTiles.size > 300) _ckTiles.delete(_ckTiles.keys().next().value);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
function _ckWorld(lat, lon, z) {
  const s = 256 * Math.pow(2, z), r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * s, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s];
}
function ckMapDraw(g, x, y, w, h) {
  if (!(w > 4 && h > 4)) return;
  let z = 11;
  try { z = Math.max(7, Math.min(14, Math.round(leafMap.getZoom()) - 1)); } catch (e) { _swallow(e); }
  const hdg = (Number(S.hdg) || 0) * Math.PI / 180, ca = Math.cos(-hdg), sa = Math.sin(-hdg);
  const cx = x + w / 2, cy = y + h * 0.66;
  const [ax, ay] = _ckWorld(S.lat, S.lon, z);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#0b1f14'; g.fillRect(x, y, w, h);
  // 바탕 타일 — 내 자리를 축으로 기수 방향이 위로 오게 돌린다
  g.save(); g.translate(cx, cy); g.rotate(-hdg);
  const R = Math.hypot(w, h), t0x = Math.floor((ax - R) / 256), t1x = Math.floor((ax + R) / 256);
  const t0y = Math.floor((ay - R) / 256), t1y = Math.floor((ay + R) / 256);
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
    const im = _ckTile(z, tx, ty);
    if (im) g.drawImage(im, tx * 256 - ax, ty * 256 - ay, 256.5, 256.5);
  }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y, w, h);
  const P = (lat, lon) => { const [px, py] = _ckWorld(lat, lon, z), dx = px - ax, dy = py - ay; return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca]; };
  // 거리 고리 — 화면 높이의 절반쯤에 맞춘 둥근 NM
  const mpp = 156543.03 * Math.cos(S.lat * Math.PI / 180) / Math.pow(2, z), pxNm = 1852 / mpp;
  const want = h * 0.5 / pxNm, nm = [0.5, 1, 2, 5, 10, 20, 40, 80].find(v => v >= want * 0.7) || 80, rr = nm * pxNm;
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2; g.setLineDash([5, 5]);
  g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  const fs = Math.max(10, h * 0.045);
  g.font = `bold ${fs}px Arial`; g.fillStyle = '#fff'; g.textAlign = 'left';
  g.fillText(`${nm} NM`, cx + rr * 0.72 + 4, cy - rr * 0.72);
  // 고리 위 방위 눈금(30° 마다 · N 은 노랑)
  for (let b = 0; b < 360; b += 30) {
    const a = (b * Math.PI / 180) - hdg, ex = cx + Math.sin(a) * rr, ey = cy - Math.cos(a) * rr;
    g.fillStyle = b === 0 ? '#ffe14a' : '#cfe'; g.textAlign = 'center';
    g.fillText(b === 0 ? 'N' : String(b / 10), ex, ey - 4);
  }
  // 비행계획
  const wps = (S.wps || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (wps.length) {
    const pts = wps.map(p => P(p.lat, p.lon));
    g.strokeStyle = '#ff40ff'; g.lineWidth = 2; g.beginPath();
    pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
    const ai = S.awp;
    if (ai > 0 && ai < pts.length) { g.lineWidth = 4; g.beginPath(); g.moveTo(...pts[ai - 1]); g.lineTo(...pts[ai]); g.stroke(); }
    g.font = `bold ${fs * 0.9}px Arial`; g.textAlign = 'left';
    pts.forEach(([px, py], i) => {
      g.fillStyle = i === ai ? '#ff40ff' : '#fff';
      g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px + 5, py); g.lineTo(px, py + 5); g.lineTo(px - 5, py); g.closePath(); g.fill();
      const id = wps[i].ident || wps[i].name || '';
      if (id) g.fillText(String(id).slice(0, 7), px + 7, py - 6);
    });
  }
  // 내 헬기(가운데 · 기수 위)
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx + 7, cy + 8); g.lineTo(cx, cy + 4); g.lineTo(cx - 7, cy + 8); g.closePath(); g.fill(); g.stroke();
  // 위 가운데 방위 상자
  const ht = `${String(Math.round(((Number(S.hdg) || 0) % 360 + 360) % 360) || 360).padStart(3, '0')}°`;
  g.font = `bold ${fs * 1.1}px Arial`; g.textAlign = 'center';
  const bw = g.measureText(ht).width + 12;
  g.fillStyle = '#000'; g.fillRect(cx - bw / 2, y + 4, bw, fs * 1.5);
  g.strokeStyle = '#fff'; g.strokeRect(cx - bw / 2 + 0.5, y + 4.5, bw - 1, fs * 1.5 - 1);
  g.fillStyle = '#fff'; g.fillText(ht, cx, y + 4 + fs * 1.15);
  g.font = `bold ${fs * 0.85}px Arial`; g.textAlign = 'left'; g.fillStyle = '#2fe0e0';
  g.fillText('MAP', x + 6, y + fs * 1.2);
  g.restore();
}
setInterval(() => { try { ckpitDraw(); } catch (e) { _swallow(e); } }, 100);
function toggleCockpitView() {
  ckpitOn = !ckpitOn;
  try { localStorage.setItem(CKPIT_PREF, ckpitOn ? '1' : '0'); } catch (e) { _swallow(e); }
  try { heli3dNoseSync(null); } catch (e) { _swallow(e); }
  ckpitSync(null);
}
try { appRegister({ toggleCockpitView }); } catch (e) { _swallow(e); }

// 화면 버튼(data-act) 연결 — 11-charts.js 보다 나중에 로드되므로 여기서 직접 등록한다
try { appRegister({ toggleExtView, extCamHold, extCamDefault }); } catch (e) { _swallow(e); }
