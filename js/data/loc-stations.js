// ─────────────────────────────────────────────────────────────
// loc-stations.js — 로컬라이저(ILS LOC) 표지소
//
// 출처: AIP Republic of Korea, 각 공항 AD 2.19 RADIO NAVIGATION AND LANDING AIDS
// 좌표는 그 표의 '송신 안테나 위치' 를 그대로 옮긴 값이다(도분초 → 십진도).
// 접근 코스(crs)는 자북 기준이며 AIP 게재 ILS 접근 코스다.
//
// 검증: LOC 안테나에서 GP 안테나를 본 방위가 '접근 코스의 반대' 와 ±4.5° 안에서
// 맞는다. GP 안테나가 활주로 옆으로 100m 남짓 비켜 있어 그만큼 차이가 난다 —
// 좌표와 코스가 서로 어긋나지 않았다는 뜻이다.
//
// dme.elev 는 ft. AIP 는 m 로 싣는다(30m = 98ft).
// ─────────────────────────────────────────────────────────────
const LOC_STATIONS = [
  // ── RKSS 김포 (AIP AMDT 8/25 · 1/26) ──
  { apt:'RKSS', name:'김포', rwy:'14R', id:'IOFR', freq:'108.70', lat:37.545972, lon:126.803583, crs:143, cat:'II/III',
    gp:{ freq:'330.5', lat:37.567167, lon:126.778889 },
    dme:{ freq:'985', ch:'24X', lat:37.567194, lon:126.778944, elev:98 } },
  { apt:'RKSS', name:'김포', rwy:'14L', id:'ISEL', freq:'109.90', lat:37.545722, lon:126.809639, crs:143, cat:'I',
    gp:{ freq:'333.8', lat:37.56775, lon:126.780056 },
    dme:{ freq:'997', ch:'36X', lat:37.567722, lon:126.780028, elev:98 } },
  { apt:'RKSS', name:'김포', rwy:'32R', id:'ISKP', freq:'110.70', lat:37.572694, lon:126.775778, crs:323, cat:'I',
    gp:{ freq:'330.2', lat:37.549, lon:126.803639 },
    dme:{ freq:'1005', ch:'44X', lat:37.548972, lon:126.803583, elev:98 } },
  { apt:'RKSS', name:'김포', rwy:'32L', id:'IKMO', freq:'108.30', lat:37.570389, lon:126.772944, crs:323, cat:'I',
    gp:{ freq:'334.1', lat:37.54925, lon:126.797556 },
    dme:{ freq:'981', ch:'20X', lat:37.549222, lon:126.797556, elev:98 } },

  // ── RKTU 청주 (AIP AMDT 1/26) ──
  { apt:'RKTU', name:'청주', rwy:'24R', id:'ICHG', freq:'111.70', lat:36.708333, lon:127.484056, crs:240,
    gp:{ freq:'333.5', lat:36.724278, lon:127.507694 },
    dme:{ freq:'1015', ch:'54X', lat:36.724278, lon:127.507694, elev:295 } },
  { apt:'RKTU', name:'청주', rwy:'24L', id:'ICHL', freq:'109.35', lat:36.706139, lon:127.484694, crs:240,
    gp:{ freq:'331.85', lat:36.720556, lon:127.509833 },
    dme:{ freq:'1054', ch:'30Y', lat:36.720583, lon:127.509778, elev:295 } },
  { apt:'RKTU', name:'청주', rwy:'06L', id:'ICHJ', freq:'110.30', lat:36.726833, lon:127.513917, crs:60,
    gp:{ freq:'335.0', lat:36.711, lon:127.490167 },
    dme:{ freq:'1001', ch:'40X', lat:36.710944, lon:127.490194, elev:295 } },
  { apt:'RKTU', name:'청주', rwy:'06R', id:'ICHR', freq:'109.15', lat:36.724639, lon:127.514556, crs:60,
    gp:{ freq:'331.25', lat:36.708806, lon:127.490778 },
    dme:{ freq:'1052', ch:'28Y', lat:36.708806, lon:127.490778, elev:295 } },

  // ── RKTN 대구 (AIP AMDT 9/25) ──
  // 31L 과 13R 은 같은 주파수(108.7)를 쓴다 — 한쪽만 운용된다.
  { apt:'RKTN', name:'대구', rwy:'31L', id:'ITAG', freq:'108.70', lat:35.90225, lon:128.642861, crs:312, cat:'I',
    gp:{ freq:'330.5', lat:35.887583, lon:128.667472 },
    dme:{ freq:'985', ch:'24X', lat:35.887556, lon:128.667444 } },
  { apt:'RKTN', name:'대구', rwy:'31R', id:'IDAG', freq:'111.90', lat:35.903222, lon:128.643611, crs:312,
    dme:{ freq:'1017', ch:'56X', lat:35.903833, lon:128.644083 } },
  { apt:'RKTN', name:'대구', rwy:'13R', id:'ITGL', freq:'108.70', lat:35.885, lon:128.674056, crs:132, cat:'I',
    gp:{ freq:'330.5', lat:35.898306, lon:128.647972 },
    dme:{ freq:'985', ch:'24X', lat:35.898278, lon:128.647917 } },

  // ── RKTL 울진 (AIP AMDT 3/26) ──
  { apt:'RKTL', name:'울진', rwy:'17', id:'IUJS', freq:'111.15', lat:36.76675, lon:129.46575, crs:171, cat:'I',
    gp:{ freq:'331.55', lat:36.781778, lon:129.458528 },
    dme:{ freq:'1135', ch:'48Y', lat:36.781778, lon:129.4585, elev:197 } },
  { apt:'RKTL', name:'울진', rwy:'35', id:'IUJN', freq:'108.10', lat:36.787333, lon:129.457778, crs:351, cat:'I',
    gp:{ freq:'334.7', lat:36.771306, lon:129.462583 },
    dme:{ freq:'979', ch:'18X', lat:36.771306, lon:129.462528, elev:197 } },

  // ── RKTH 포항 (AIP AMDT 10/25) ──
  { apt:'RKTH', name:'포항', rwy:'10', id:'IKPO', freq:'110.90', lat:35.988083, lon:129.434, crs:97,
    dme:{ freq:'1007', ch:'46X', lat:35.987694, lon:129.4345, elev:98 } },
];
