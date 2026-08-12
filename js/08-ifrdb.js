// ─────────────────────────────────────────────────────────────
// 08-ifrdb.js — IFR 데이터베이스(터미널 픽스·SID/STAR/접근)
// index.html 에서 분리한 조각. 클래식 스크립트라 전역 스코프를 공유하므로
// 로드 순서가 곧 실행 순서다. 순서를 바꾸면 동작이 달라진다.
// ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════
// IFR DATABASE
// ══════════════════════════════════════════════════════
// ── SID 터미널 픽스(AIP 코딩 테이블) — 항로 픽스에 없어 별도 등록 ──
const TERMINAL_FIXES = {ANUBA:[35.12942,127.58967], BEMGA:[35.17053,126.38239], GUMAM:[35.36642,127.42603], IGBEM:[35.12861,127.21286], JB801:[35.09764,126.38208], JB802:[35.09672,126.22161], JB803:[34.97986,126.22272], JB804:[34.90556,126.30428], JB805:[34.67767,126.55303], JB806:[34.59247,126.64553], JB807:[34.50075,126.63592], JB808:[35.3815,126.89281], JB809:[35.30478,126.78522], JB851:[34.85025,126.38372], JB852:[34.85089,126.53469], JB853:[34.97758,126.68611], JB854:[34.84936,126.2035], JB855:[34.97789,126.20242], JB856:[34.54506,126.53933], JB857:[34.4425,126.62981], JB858:[35.19036,126.60672], JB859:[35.33669,126.88792], JISUN:[35.12756,127.01539], JJ221:[34.98522,126.85189], JJ222:[35.26794,126.88039], JJ223:[35.21489,127.03753], JJ224:[34.93858,126.68192], JJ401:[35.22253,126.97664], JJ402:[35.17878,127.08692], JJ403:[34.82403,126.66983], JY801:[34.65153,127.71381], JY802:[34.60903,127.83017], JY803:[34.74031,127.90056], JY804:[34.81547,127.50625], JY805:[35.03942,127.36936], JY806:[34.42017,127.72517], LILVI:[35.21878,126.87503], MARYO:[35.03517,126.74639], NAKZY:[35.21494,126.65961], POVOR:[34.25547,127.73325], PUMEG:[35.22572,127.06514], RELEX:[34.71978,126.38453], AROKU:[37.66499,127.93747], ARUNA:[37.39502,127.77061], GANAM:[37.11113,127.66447], IKILA:[37.61324,128.06913], JY851:[34.94392,127.56747], JY852:[34.99197,127.71231], JY853:[34.89364,127.76031], JY854:[34.71314,127.65761], JY857:[34.78486,127.69833], JY865:[34.79958,127.51753], JY866:[34.68389,127.56364], RULRU:[37.19389,127.68693], SANUV:[37.34346,127.90192], AKPON:[33.78044,127.33139], ATIMO:[33.39792,126.73089], CJU:[33.38461,126.62411], IPDAS:[34.25408,126.71706], KAMIT:[34.25392,126.77158], LEDIN:[33.54503,126.17081], LIMDI:[33.55369,125.83139], MEXER:[33.45778,126.38667], OLLEH:[33.96172,126.74069], PALRI:[33.64089,126.74372], PANSI:[33.004,126.20697], PAPLU:[33.57814,127.06014], PC811:[33.70336,126.71356], PC813:[33.49875,126.84722], PC814:[33.26011,126.48708], PC816:[33.44903,126.32522], PC832:[33.67944,126.23108], PC833:[33.83578,126.51244], PC834:[33.9295,126.68214], PC841:[33.42853,126.32994], PC842:[33.29397,126.35481], PC845:[33.41756,126.89], PC846:[33.321,126.59128], PC861:[33.56217,126.40947], PC871:[33.65147,126.40889], PC872:[33.72136,126.52186], PC874:[33.81056,127.18578], TAMNA:[33.47097,127.33139], TOREN:[33.81022,126.66603], PD801:[33.43869,126.71128], PD802:[33.41642,126.83819], PD803:[33.34019,126.88167], PD804:[33.27681,126.78347], PD811:[33.24339,126.71239], PD812:[33.20139,126.60483], PD813:[33.25122,126.52022], PD814:[33.33772,126.52925], CG050:[37.37178,126.58528], CG100:[37.27119,126.62883], CP101:[37.10561,126.48267], ATNER:[37.10442,126.31458], HP121:[37.1025,126.09786], BELTU:[37.205,125.79972], BINIL:[37.397,125.23314], CD120:[37.12439,126.62533], VIMER:[36.98411,126.62358], EXUTO:[36.88572,126.62472], BOPTA:[36.73511,126.61622], CG101:[37.28525,126.88953], CG130:[37.16825,126.97861], SOT:[37.09436,127.03167], CG200:[36.92478,127.16211], OSPOT:[36.83836,127.34858], CK100:[37.30631,127.12261], CK099:[37.33922,127.24778], EGOBA:[37.48742,127.37942], HD050:[37.38572,126.48436], HD100:[37.27972,126.52028], AD020:[37.57919,126.35528], AD050:[37.57964,126.2085], AP140:[37.40469,125.75594], NOPIK:[37.40333,125.65139], YD070:[37.40872,126.13583], YD100:[37.32639,126.25389], YD130:[37.19436,126.44225], YD160:[37.03878,126.51617], YD190:[36.87731,126.56944], YG160:[37.12181,126.62914], YK130:[37.32461,126.45864], YK170:[37.32172,126.71078], YK210:[37.31814,127.00872], EG020:[37.55878,126.37347], EG040:[37.64094,126.34419], ASIDI:[37.67019,126.44736], EG070:[37.64144,126.54683], EG140:[37.41319,126.80736], EG160:[37.31989,126.89572], YD020:[37.50369,126.36881], YD040:[37.50822,126.18247], YP080:[37.40736,125.99011], UD050:[37.50053,126.86631], UD060:[37.37128,126.91794], UD080:[37.23425,127.03572], UG100:[37.10669,127.13719], UG130:[36.96269,127.25033], UP050:[37.39506,126.90814], UP060:[37.35847,126.76914], UP059:[37.41217,126.59381], UP100:[37.41075,126.37328], UD100:[37.09067,126.98069], UPDET:[36.931,126.91981], BULTI:[36.72286,126.82492], ZD080:[37.2295,127.09531], ZD100:[37.14089,127.19503], ZD120:[37.03728,127.19475], ZD119:[36.82508,126.94467], ZG130:[36.98386,127.27489], TD040:[37.63417,126.69269], TD050:[37.56142,126.59364], TP080:[37.52158,126.53953], TP120:[37.40986,126.25814], TD100:[37.40522,126.57256], TD120:[37.32356,126.59464], TD130:[37.22239,126.62803], TD180:[37.01761,126.69531], TD200:[36.90239,126.73314], QD040:[37.63417,126.69269], QD050:[37.56142,126.59364], QP080:[37.52158,126.53953], QP079:[37.48447,126.44575], QP120:[37.40986,126.25814], QD080:[37.47814,126.58997], QD090:[37.37178,126.58528], QD110:[37.27119,126.62883], QD150:[37.04433,126.81461], QD160:[36.88969,126.81958], MEESA:[37.57886,127.24578], MUGAR:[37.29597,127.31906], PINEV:[37.25278,127.31778], BIDBA:[37.34258,127.32069], YEOJU:[37.41289,127.44719], VEMUM:[37.53925,127.33678], UPTAD:[37.45592,127.1845], SEL:[37.41361,126.92836], ELAPI:[36.33722,128.8475], LOSTO:[36.33778,129.43], BULGA:[35.93583,129.82333], APARU:[35.41167,129.15889], LAPAL:[35.90361,129.08111], NPH:[35.98636,129.40883], KPO:[35.97722,129.47444], USN:[35.59861,129.35333], NOBUT:[37.12083,129.3325], UJN:[36.77639,129.4575], BUKIL:[36.80644,127.64269], TUTAE:[36.91233,127.5415], OWING:[36.72883,127.24567], OLMEN:[36.73706,126.991], UPTIL:[36.64992,127.38994], TU521:[36.7555,127.28864], CHO:[36.71806,127.49417], TGU:[35.80972,128.59083], DOC:[35.90378,128.64139], BITUX:[36.27914,128.02997], OPEDA:[35.86347,127.61444], MASTA:[35.47972,128.561], KALOD:[35.50336,128.77403], DOVUR:[35.83025,128.77275], TN131:[35.68058,128.68208], TN132:[35.71217,128.50206], VETUP:[36.11742,128.33928], PEDVA:[35.63694,128.13172], KABAS:[35.9475,128.56097], TN311:[35.83908,128.4105], TN312:[35.71414,128.54631], PK521:[35.22833,128.64228], PK522:[35.12508,128.74683], PK513:[34.90897,129.03328], PK514:[34.97897,129.1395]};
const IFR_FIXES = {
  'BOPTA': { lat: 36.7350, lon: 126.6161 },
  'AGAVO': { lat: 37.1667, lon: 124.0000 },
  // RKPK Gimhae
  'KMH':   { lat: 35.19917, lon: 128.93556 },
  'IKHE':  { lat: 35.1967, lon: 128.9371 },
  'GAYHA': { lat: 35.2229, lon: 128.6318 },
  'GEOJE': { lat: 35.0154, lon: 128.7283 },
  'NARAE': { lat: 35.0024, lon: 129.1243 },
  'PEDLO': { lat: 34.9897, lon: 129.0043 },
  'KEVOX': { lat: 35.1380, lon: 128.8230 },
  'BOSPI': { lat: 35.0900, lon: 128.9370 },
  'PK712': { lat: 35.1270, lon: 128.9370 },
  'IDIVU': { lat: 35.1780, lon: 128.9370 },
  'NEIAN': { lat: 35.1400, lon: 128.9371 },
  'OVTUS': { lat: 35.0306, lon: 128.6525 },
  'NOORI': { lat: 35.0764, lon: 128.6687 },
  'WAYBI': { lat: 35.1430, lon: 128.7300 },
  'ZIKKO': { lat: 35.1960, lon: 128.7790 },
  'DUBUN': { lat: 38.0874, lon: 128.8705 },
  'YAG':   { lat: 38.0633, lon: 128.6615 },
  'KAE':   { lat: 37.7008, lon: 128.7538 },
  'BIKSI': { lat: 37.6756, lon: 128.5844 },
  'NIMAL': { lat: 38.0714, lon: 128.7638 },
  'PILIT': { lat: 37.4419, lon: 129.2919 },
  'NY000': { lat: 38.0958, lon: 128.6472 },
  'NY040': { lat: 38.0408, lon: 128.7542 },
  'NY049': { lat: 37.7527, lon: 128.6738 },
  'NY042': { lat: 37.8742, lon: 128.6738 },
  'NY031': { lat: 38.0594, lon: 128.6738 },
  'NY050': { lat: 37.9781, lon: 128.7542 },
  'NY070': { lat: 37.9025, lon: 128.7539 },
  'NY090': { lat: 37.8231, lon: 128.7539 },
  'NY015': { lat: 37.9753, lon: 128.8927 },
  'NY010': { lat: 37.9228, lon: 128.8108 },
  'NY004': { lat: 37.9947, lon: 128.7375 },
  'NY003': { lat: 38.0025, lon: 128.7431 },
  // RKPK Gimhae – additional
  'IKMA':  { lat: 35.1971, lon: 128.9348 },
  'PSN':   { lat: 35.12264, lon: 128.99958 },
  'ULSUK': { lat: 35.00667, lon: 128.74056 },
  'MASTA': { lat: 35.4797, lon: 128.5611 },
  'KALOD': { lat: 35.5033, lon: 128.7739 },
  'SAPDI': { lat: 35.12694, lon: 128.49778 },
  'TOPAX': { lat: 34.76528, lon: 128.49778 },
  'ENGOT': { lat: 34.80958, lon: 128.49769 },
  'BESNA': { lat: 34.62167, lon: 129.13083 },
  'APELA': { lat: 34.72306, lon: 129.23333 },
  'INVOK': { lat: 34.78861, lon: 129.32306 },
  'KALEK': { lat: 35.20889, lon: 129.88472 },
  'SARAM': { lat: 35.12675, lon: 128.52964 },
  'SOORO': { lat: 35.29167, lon: 128.71889 },
  'BEVSI': { lat: 35.30667, lon: 128.72944 },
  'ATLAX': { lat: 35.36361, lon: 129.075 },
  'OPONO': { lat: 35.30672, lon: 128.7295 },
  'AKEVI': { lat: 34.9750, lon: 128.9330 },
  'OLMOG': { lat: 35.0900, lon: 128.9370 },
  'APARU': { lat: 35.4117, lon: 129.1589 },
  'BAHDA': { lat: 34.89289, lon: 128.95161 },
  'ARECO': { lat: 35.3800, lon: 128.6300 },
  'ANROD': { lat: 34.6328, lon: 128.4978 },
  'BURIM': { lat: 34.99786, lon: 128.94669 },
  'HAEUN': { lat: 35.0500, lon: 129.1500 },
  'IKESI': { lat: 35.1600, lon: 128.9370 },
  'NUKBA': { lat: 35.2500, lon: 128.8000 },
  // RKPC Jeju
  'LAXIP': { lat: 34.083, lon: 126.900 },
  'OBTAN': { lat: 34.633, lon: 126.333 },
  'GUGDA': { lat: 33.100, lon: 126.250 },
  'DOTLO': { lat: 33.300, lon: 126.750 },
  'PC010': { lat: 33.568, lon: 126.681 },
  'PC007': { lat: 33.551, lon: 126.625 },
  'PC005': { lat: 33.539, lon: 126.587 },
  'PC250': { lat: 33.455, lon: 126.305 },
  'PC251': { lat: 33.483, lon: 126.399 },
  // RKJK Gunsan (actual AIP coordinates)
  'KUZ':   { lat: 35.9104, lon: 126.6114 },  // GUNSAN VORTAC 112.8
  'LINTA': { lat: 35.5211, lon: 126.8553 },
  'ENTEL': { lat: 36.3864, lon: 126.9514 },
  'PORIX': { lat: 35.6742, lon: 126.7614 },
  'MANGI': { lat: 35.5031, lon: 126.7421 },
  // Korea AIP En-Route Fixes
  'AGSUS': { lat: 36.7558, lon: 130.0789 },
  'AKPON': { lat: 33.7806, lon: 127.3308 },
  'ANDOL': { lat: 37.6661, lon: 133.0000 },
  'ANKUS': { lat: 35.1250, lon: 128.7711 },
  'ANSIM': { lat: 37.3897, lon: 124.8358 },
  'ANUBA': { lat: 35.1294, lon: 127.5897 },
  'ATASO': { lat: 35.8956, lon: 126.9492 },
  'ATINA': { lat: 33.7222, lon: 127.0731 },
  'ATOTI': { lat: 30.0036, lon: 125.1983 },
  'BASEM': { lat: 36.8436, lon: 127.9528 },
  'BEDAR': { lat: 31.9003, lon: 126.4861 },
  'BEDES': { lat: 36.1514, lon: 126.8122 },
  'BEDOM': { lat: 35.4203, lon: 129.2983 },
  'BELTU': { lat: 37.2050, lon: 125.7997 },
  'BEPKO': { lat: 33.6528, lon: 126.9206 },
  'BIDRI': { lat: 36.3353, lon: 124.4147 },
  'BIGOB': { lat: 36.7236, lon: 128.1644 },
  'BILUM': { lat: 33.7703, lon: 127.0775 },
  'BINIL': { lat: 37.3969, lon: 125.2331 },
  'BITUX': { lat: 36.2792, lon: 128.0300 },
  'BODOL': { lat: 37.1894, lon: 124.8317 },
  'BOGAN': { lat: 37.2114, lon: 126.4700 },
  'BONSO': { lat: 30.4778, lon: 125.1475 },
  'BULGA': { lat: 35.9358, lon: 129.8233 },
  'BULTI': { lat: 36.7228, lon: 126.8250 },
  'BUSKO': { lat: 37.6758, lon: 130.2694 },
  'DABIK': { lat: 36.2953, lon: 130.1953 },
  'DALPO': { lat: 36.9764, lon: 124.4147 },
  'DANPA': { lat: 35.5100, lon: 124.4147 },
  'DANTI': { lat: 37.3017, lon: 124.6581 },
  'DOMKO': { lat: 32.4800, lon: 125.9831 },
  'DOTOL': { lat: 34.2542, lon: 126.6103 },
  'EGOBA': { lat: 37.4875, lon: 127.3794 },
  'ELAPI': { lat: 36.3372, lon: 128.8475 },
  'ELGEP': { lat: 31.7814, lon: 125.9381 },
  'ELPOS': { lat: 35.9028, lon: 126.7853 },
  'ENSAL': { lat: 36.9317, lon: 127.7964 },
  'ENSUM': { lat: 32.2172, lon: 124.7764 },
  'ESNEG': { lat: 37.1706, lon: 129.8475 },
  'GOGET': { lat: 37.4117, lon: 126.5100 },
  'GONAV': { lat: 37.1800, lon: 124.4147 },
  'GONAX': { lat: 36.3864, lon: 126.8378 },
  'GOSBO': { lat: 34.2547, lon: 127.8261 },
  'GUKDO': { lat: 37.0197, lon: 127.6397 },
  'GUKSU': { lat: 33.8808, lon: 126.7325 },
  'GUNKU': { lat: 36.5706, lon: 126.9969 },
  'IGDOK': { lat: 35.5178, lon: 127.8186 },
  'IGRAS': { lat: 37.3128, lon: 132.7364 },
  'IKEDO': { lat: 31.7206, lon: 125.6633 },
  'IPDAS': { lat: 34.2542, lon: 126.7169 },
  'KAKSO': { lat: 37.1292, lon: 127.4436 },
  'KALMA': { lat: 37.3125, lon: 127.1125 },
  'KAMIT': { lat: 34.2539, lon: 126.7717 },
  'KANKA': { lat: 31.5319, lon: 125.5844 },
  'KANSU': { lat: 38.6333, lon: 132.4750 },
  'KARBU': { lat: 37.5331, lon: 127.6644 },
  'KIDOS': { lat: 33.8411, lon: 126.5672 },
  'LAMEN': { lat: 31.6100, lon: 124.0000 },
  'LANAT': { lat: 36.3733, lon: 131.4283 },
  'LAPAL': { lat: 35.9036, lon: 129.0811 },
  'LESBU': { lat: 37.6878, lon: 129.6844 },
  'LIMDI': { lat: 33.5536, lon: 125.8314 },
  'LOSNI': { lat: 33.5542, lon: 126.6981 },
  'LOSTO': { lat: 36.3378, lon: 129.4300 },
  'MAKDU': { lat: 36.4533, lon: 127.8192 },
  'MAKET': { lat: 33.9144, lon: 127.3314 },
  'MAKSA': { lat: 35.5031, lon: 126.9061 },
  'MALSO': { lat: 37.9111, lon: 131.8178 },
  'MANOL': { lat: 33.6081, lon: 126.9206 },
  'MEKIL': { lat: 36.5561, lon: 126.8314 },
  'MELES': { lat: 35.8808, lon: 127.2617 },
  'MONSI': { lat: 37.2131, lon: 126.8375 },
  'MOXID': { lat: 36.3864, lon: 126.7331 },
  'MUGUS': { lat: 30.0017, lon: 124.9533 },
  'NIRAT': { lat: 32.0650, lon: 126.0581 },
  'NISAV': { lat: 34.2553, lon: 127.9764 },
  'NOBUT': { lat: 37.1208, lon: 129.3325 },
  'NOGON': { lat: 37.3806, lon: 124.4181 },
  'NONOS': { lat: 36.6794, lon: 124.4147 },
  'NOPIK': { lat: 37.4033, lon: 125.6514 },
  'NULDI': { lat: 34.4206, lon: 126.6275 },
  'OLBIM': { lat: 37.2364, lon: 124.1308 },
  'OLMEN': { lat: 36.7369, lon: 126.9911 },
  'OLMUD': { lat: 35.0403, lon: 128.8211 },
  'OMKIM': { lat: 33.2222, lon: 126.6872 },
  'OMOTU': { lat: 35.0092, lon: 128.8394 },
  'ONATA': { lat: 38.4756, lon: 132.1006 },
  'ONIKU': { lat: 32.1950, lon: 126.6547 },
  'OPEDA': { lat: 35.8636, lon: 127.6144 },
  'OROGA': { lat: 36.7489, lon: 127.4550 },
  'OSPOT': { lat: 36.8383, lon: 127.3486 },
  'OSVOM': { lat: 36.6456, lon: 129.3919 },
  'PALDU': { lat: 37.9703, lon: 132.6069 },
  'PALSA': { lat: 34.0253, lon: 124.4147 },
  'PANSI': { lat: 33.0039, lon: 126.2069 },
  'PAPLU': { lat: 33.5781, lon: 127.0603 },
  'PEBRI': { lat: 36.3864, lon: 127.0036 },
  'POLEG': { lat: 37.2136, lon: 126.9931 },
  'PONIK': { lat: 32.0058, lon: 125.7831 },
  'POSAN': { lat: 36.9375, lon: 127.2211 },
  'POVEM': { lat: 34.9231, lon: 128.9044 },
  'POVOR': { lat: 34.2556, lon: 127.7333 },
  'REBIT': { lat: 37.2008, lon: 125.4869 },
  'REMOS': { lat: 33.4347, lon: 126.3914 },
  'RILRO': { lat: 37.1758, lon: 124.2450 },
  'RIMPO': { lat: 35.1275, lon: 127.5839 },
  'RINBO': { lat: 35.8978, lon: 126.8969 },
  'RUGMA': { lat: 32.5033, lon: 126.9647 },
  'RUNIT': { lat: 35.1261, lon: 128.4978 },
  'SABET': { lat: 37.6414, lon: 132.6719 },
  'SADLI': { lat: 31.8300, lon: 125.0000 },
  'SAKTI': { lat: 36.8500, lon: 127.7667 },
  'SAMDO': { lat: 33.5842, lon: 128.3158 },
  'SAMLO': { lat: 32.5397, lon: 126.2600 },
  'SAMUL': { lat: 35.1267, lon: 126.8650 },
  'SAPRA': { lat: 35.8239, lon: 130.7236 },
  'SELPA': { lat: 37.9208, lon: 130.8197 },
  'SOSDO': { lat: 33.0033, lon: 126.4597 },
  'TAMNA': { lat: 33.4708, lon: 127.3314 },
  'TEBEX': { lat: 36.5614, lon: 127.9914 },
  'TEDAN': { lat: 35.1289, lon: 127.3144 },
  'TENAS': { lat: 37.6389, lon: 131.5742 },
  'TESIM': { lat: 31.5906, lon: 125.8578 },
  'TOLIS': { lat: 33.8417, lon: 124.4147 },
  'TORUS': { lat: 37.6069, lon: 128.1353 },
  'TOSAN': { lat: 33.0033, lon: 126.7719 },
  'UGOVI': { lat: 37.6847, lon: 129.8475 },
  'UPGOS': { lat: 33.9592, lon: 127.3314 },
  'VASLI': { lat: 36.7144, lon: 127.5008 },
};

// 항로망은 AIP ENR 3.1/3.2 기반 ENR_ROUTES(53개)로 런타임에 채워진다.
// (syncIfrDbFromAip에서 이 객체를 비우고 다시 채우므로 초기값은 비어 있어야 한다)
const IFR_AIRWAYS = {};

const IFR_DB = {
  // ── AIP AD 2 SID 코딩 테이블 기반(2025~2026 AMDT) ──
  RKPD: {
    name: '정석',
    stars: [], approaches: [],
    sids: [
      { name:'CJU1N', rwy:'01', wps:[{ident:'PD801',lat:33.43869,lon:126.71128}, {ident:'PD802',lat:33.41642,lon:126.83819}, {ident:'PD803',lat:33.34019,lon:126.88167}, {ident:'PD804',lat:33.27681,lon:126.78347}, {ident:'CJU',lat:33.38461,lon:126.62411}] },
      { name:'CJU1S', rwy:'19', wps:[{ident:'PD811',lat:33.24339,lon:126.71239}, {ident:'PD812',lat:33.20139,lon:126.60483}, {ident:'PD813',lat:33.25122,lon:126.52022}, {ident:'PD814',lat:33.33772,lon:126.52925}, {ident:'CJU',lat:33.38461,lon:126.62411}] },
    ],
  },
  RKNW: {
    name: '원주',
    stars: [], approaches: [],
    sids: [
      { name:'IKILA1 · KARBU', rwy:'03', wps:[{ident:'IKILA',lat:37.61324,lon:128.06913}, {ident:'AROKU',lat:37.66499,lon:127.93747}, {ident:'KARBU',lat:37.53306,lon:127.66444}] },
      { name:'IKILA1 · BIKSI', rwy:'03', wps:[{ident:'IKILA',lat:37.61324,lon:128.06913}, {ident:'BIKSI',lat:37.67556,lon:128.58444}] },
      { name:'SANUV2 · KARBU', rwy:'21', wps:[{ident:'SANUV',lat:37.34346,lon:127.90192}, {ident:'ARUNA',lat:37.39502,lon:127.77061}, {ident:'KARBU',lat:37.53306,lon:127.66444}] },
      { name:'SANUV2 · BIKSI', rwy:'21', wps:[{ident:'SANUV',lat:37.34346,lon:127.90192}, {ident:'ARUNA',lat:37.39502,lon:127.77061}, {ident:'AROKU',lat:37.66499,lon:127.93747}, {ident:'BIKSI',lat:37.67556,lon:128.58444}] },
      { name:'SANUV2 · GUKDO', rwy:'21', wps:[{ident:'SANUV',lat:37.34346,lon:127.90192}, {ident:'RULRU',lat:37.19389,lon:127.68693}, {ident:'GANAM',lat:37.11113,lon:127.66447}, {ident:'GUKDO',lat:37.0197,lon:127.63968}] },
    ],
  },
  RKJB: {
    name: '무안',
    stars: [], approaches: [],
    sids: [
      { name:'DOTOL1N', rwy:'01', wps:[{ident:'JB801',lat:35.09764,lon:126.38208}, {ident:'JB802',lat:35.09672,lon:126.22161}, {ident:'JB803',lat:34.97986,lon:126.22272}, {ident:'JB804',lat:34.90556,lon:126.30428}, {ident:'JB805',lat:34.67767,lon:126.55303}, {ident:'JB806',lat:34.59247,lon:126.64553}, {ident:'JB807',lat:34.50075,lon:126.63592}, {ident:'DOTOL',lat:34.25428,lon:126.61017}] },
      { name:'MAKSA1N', rwy:'01', wps:[{ident:'BEMGA',lat:35.17053,lon:126.38239}, {ident:'NAKZY',lat:35.21494,lon:126.65961}, {ident:'JB809',lat:35.30478,lon:126.78522}, {ident:'JB808',lat:35.3815,lon:126.89281}, {ident:'MAKSA',lat:35.50314,lon:126.90611}] },
      { name:'MAKSA1S', rwy:'19', wps:[{ident:'JB851',lat:34.85025,lon:126.38372}, {ident:'JB852',lat:34.85089,lon:126.53469}, {ident:'JB853',lat:34.97758,lon:126.68611}, {ident:'SAMUL',lat:35.12653,lon:126.86511}, {ident:'MAKSA',lat:35.50314,lon:126.90611}] },
      { name:'MAKSA6S', rwy:'19', wps:[{ident:'JB851',lat:34.85025,lon:126.38372}, {ident:'JB854',lat:34.84936,lon:126.2035}, {ident:'JB855',lat:34.97789,lon:126.20242}, {ident:'JB858',lat:35.19036,lon:126.60672}, {ident:'JB859',lat:35.33669,lon:126.88792}, {ident:'MAKSA',lat:35.50314,lon:126.90611}] },
      { name:'DOTOL1S', rwy:'19', wps:[{ident:'JB851',lat:34.85025,lon:126.38372}, {ident:'RELEX',lat:34.71978,lon:126.38453}, {ident:'JB856',lat:34.54506,lon:126.53933}, {ident:'JB857',lat:34.4425,lon:126.62981}, {ident:'DOTOL',lat:34.25428,lon:126.61017}] },
    ],
  },
  RKJJ: {
    name: '광주',
    stars: [], approaches: [],
    sids: [
      { name:'LILVI1 · MAKSA', rwy:'04L/04R', wps:[{ident:'LILVI',lat:35.21878,lon:126.87503}, {ident:'MAKSA',lat:35.50314,lon:126.90611}] },
      { name:'LILVI1 · IGDOK', rwy:'04L/04R', wps:[{ident:'LILVI',lat:35.21878,lon:126.87503}, {ident:'JJ401',lat:35.22253,lon:126.97664}, {ident:'PUMEG',lat:35.22572,lon:127.06514}, {ident:'GUMAM',lat:35.36642,lon:127.42603}, {ident:'IGDOK',lat:35.51767,lon:127.8185}] },
      { name:'LILVI1 · TEDAN', rwy:'04L/04R', wps:[{ident:'LILVI',lat:35.21878,lon:126.87503}, {ident:'JJ401',lat:35.22253,lon:126.97664}, {ident:'JJ402',lat:35.17878,lon:127.08692}, {ident:'IGBEM',lat:35.12861,lon:127.21286}, {ident:'TEDAN',lat:35.12883,lon:127.31447}] },
      { name:'LILVI1 · DOTOL', rwy:'04L/04R', wps:[{ident:'LILVI',lat:35.21878,lon:126.87503}, {ident:'JJ401',lat:35.22253,lon:126.97664}, {ident:'JISUN',lat:35.12756,lon:127.01539}, {ident:'JJ403',lat:34.82403,lon:126.66983}, {ident:'DOTOL',lat:34.25428,lon:126.61017}] },
      { name:'MARYO1 · DOTOL', rwy:'22L/22R', wps:[{ident:'MARYO',lat:35.03517,lon:126.74639}, {ident:'JJ224',lat:34.93858,lon:126.68192}, {ident:'DOTOL',lat:34.25428,lon:126.61017}] },
      { name:'MARYO1 · TEDAN', rwy:'22L/22R', wps:[{ident:'MARYO',lat:35.03517,lon:126.74639}, {ident:'JJ221',lat:34.98522,lon:126.85189}, {ident:'JISUN',lat:35.12756,lon:127.01539}, {ident:'TEDAN',lat:35.12883,lon:127.31447}] },
      { name:'MARYO1 · IGDOK', rwy:'22L/22R', wps:[{ident:'MARYO',lat:35.03517,lon:126.74639}, {ident:'JJ221',lat:34.98522,lon:126.85189}, {ident:'JISUN',lat:35.12756,lon:127.01539}, {ident:'JJ223',lat:35.21489,lon:127.03753}, {ident:'GUMAM',lat:35.36642,lon:127.42603}, {ident:'IGDOK',lat:35.51767,lon:127.8185}] },
      { name:'MARYO1 · MAKSA', rwy:'22L/22R', wps:[{ident:'MARYO',lat:35.03517,lon:126.74639}, {ident:'JJ221',lat:34.98522,lon:126.85189}, {ident:'JISUN',lat:35.12756,lon:127.01539}, {ident:'JJ222',lat:35.26794,lon:126.88039}, {ident:'MAKSA',lat:35.50314,lon:126.90611}] },
    ],
  },
  RKJY: {
    name: '여수',
    stars: [], approaches: [],
    sids: [
      { name:'ANUBA1M', rwy:'17', wps:[{ident:'JY801',lat:34.65153,lon:127.71381}, {ident:'JY802',lat:34.60903,lon:127.83017}, {ident:'JY803',lat:34.74031,lon:127.90056}, {ident:'YSU',lat:34.84286,lon:127.61908}, {ident:'ANUBA',lat:35.12942,lon:127.58967}] },
      { name:'POVOR1M', rwy:'17', wps:[{ident:'JY801',lat:34.65153,lon:127.71381}, {ident:'JY806',lat:34.42017,lon:127.72517}, {ident:'POVOR',lat:34.25547,lon:127.73325}] },
      { name:'TEDAN1M', rwy:'17', wps:[{ident:'JY804',lat:34.81547,lon:127.50625}, {ident:'JY805',lat:35.03942,lon:127.36936}, {ident:'TEDAN',lat:35.12883,lon:127.31447}] },
      { name:'POVOR1R', rwy:'35', wps:[{ident:'JY851',lat:34.94392,lon:127.56747}, {ident:'JY852',lat:34.99197,lon:127.71231}, {ident:'JY853',lat:34.89364,lon:127.76031}, {ident:'JY857',lat:34.78486,lon:127.69833}, {ident:'JY854',lat:34.71314,lon:127.65761}, {ident:'POVOR',lat:34.25547,lon:127.73325}] },
      { name:'ANUBA1R', rwy:'35', wps:[{ident:'JY851',lat:34.94392,lon:127.56747}, {ident:'ANUBA',lat:35.12942,lon:127.58967}] },
      { name:'TEDAN1R', rwy:'35', wps:[{ident:'TEDAN',lat:35.12883,lon:127.31447}] },
      { name:'POVOR6R', rwy:'35', wps:[{ident:'JY865',lat:34.79958,lon:127.51753}, {ident:'JY866',lat:34.68389,lon:127.56364}, {ident:'POVOR',lat:34.25547,lon:127.73325}] },
      { name:'ANUBA5S (VOR)', rwy:'17', wps:[{ident:'YSU',lat:34.84286,lon:127.61908}, {ident:'ANUBA',lat:35.12942,lon:127.58967}] },
      { name:'GOSBO4S (VOR)', rwy:'17', wps:[{ident:'YSU',lat:34.84286,lon:127.61908}, {ident:'GOSBO',lat:34.25472,lon:127.79278}] },
    ],
  },
  RKSI: {
    name: '인천국제',
    stars: [],
    sids: [
      { name:'BINIL3C', rwy:'15L/15R', wps:[{ident:'CG050'}, {ident:'CG100'}, {ident:'CP101'}, {ident:'ATNER'}, {ident:'HP121'}, {ident:'BELTU'}, {ident:'BINIL'}] },
      { name:'BOPTA3C', rwy:'15L/15R', wps:[{ident:'CG050'}, {ident:'CG100'}, {ident:'CD120'}, {ident:'VIMER'}, {ident:'EXUTO'}, {ident:'BOPTA'}] },
      { name:'OSPOT2C', rwy:'15L/15R', wps:[{ident:'CG050'}, {ident:'CG100'}, {ident:'CG101'}, {ident:'CG130'}, {ident:'SOT'}, {ident:'CG200'}, {ident:'OSPOT'}] },
      { name:'EGOBA2C', rwy:'15L/15R', wps:[{ident:'CG050'}, {ident:'CG100'}, {ident:'CG101'}, {ident:'CK100'}, {ident:'CK099'}, {ident:'EGOBA'}] },
      { name:'BINIL3H', rwy:'16L/16R', wps:[{ident:'HD050'}, {ident:'HD100'}, {ident:'ATNER'}, {ident:'HP121'}, {ident:'BELTU'}, {ident:'BINIL'}] },
      { name:'BOPTA3H', rwy:'16L/16R', wps:[{ident:'HD050'}, {ident:'HD100'}, {ident:'CD120'}, {ident:'VIMER'}, {ident:'EXUTO'}, {ident:'BOPTA'}] },
      { name:'OSPOT2H', rwy:'16L/16R', wps:[{ident:'HD050'}, {ident:'HD100'}, {ident:'CG100'}, {ident:'CG101'}, {ident:'CG130'}, {ident:'SOT'}, {ident:'CG200'}, {ident:'OSPOT'}] },
      { name:'EGOBA2H', rwy:'16L/16R', wps:[{ident:'HD050'}, {ident:'HD100'}, {ident:'CG100'}, {ident:'CG101'}, {ident:'CK100'}, {ident:'CK099'}, {ident:'EGOBA'}] },
      { name:'NOPIK2A', rwy:'33L/33R', wps:[{ident:'AD020'}, {ident:'AD050'}, {ident:'AP140'}, {ident:'NOPIK'}] },
      { name:'BOPTA2A', rwy:'33L/33R', wps:[{ident:'AD020'}, {ident:'AD050'}, {ident:'YD070'}, {ident:'YD100'}, {ident:'YD130'}, {ident:'YD160'}, {ident:'YD190'}, {ident:'BOPTA'}] },
      { name:'OSPOT2A', rwy:'33L/33R', wps:[{ident:'AD020'}, {ident:'AD050'}, {ident:'YD070'}, {ident:'YD100'}, {ident:'YD130'}, {ident:'YG160'}, {ident:'OSPOT'}] },
      { name:'EGOBA2A', rwy:'33L/33R', wps:[{ident:'AD020'}, {ident:'AD050'}, {ident:'YD070'}, {ident:'YD100'}, {ident:'YK130'}, {ident:'YK170'}, {ident:'YK210'}, {ident:'EGOBA'}] },
      { name:'OSPOT2E', rwy:'33L/33R', wps:[{ident:'EG020'}, {ident:'EG040'}, {ident:'ASIDI'}, {ident:'EG070'}, {ident:'EG140'}, {ident:'EG160'}, {ident:'OSPOT'}] },
      { name:'EGOBA2E', rwy:'33L/33R', wps:[{ident:'EG020'}, {ident:'EG040'}, {ident:'ASIDI'}, {ident:'EG070'}, {ident:'EG140'}, {ident:'SEL'}, {ident:'EGOBA'}] },
      { name:'NOPIK2Y', rwy:'34L/34R', wps:[{ident:'YD020'}, {ident:'YD040'}, {ident:'YP080'}, {ident:'NOPIK'}] },
      { name:'BOPTA2Y', rwy:'34L/34R', wps:[{ident:'YD020'}, {ident:'YD040'}, {ident:'YD070'}, {ident:'YD100'}, {ident:'YD130'}, {ident:'YD160'}, {ident:'YD190'}, {ident:'BOPTA'}] },
      { name:'OSPOT2Y', rwy:'34L/34R', wps:[{ident:'YD020'}, {ident:'YD040'}, {ident:'YD070'}, {ident:'YD100'}, {ident:'YD130'}, {ident:'YG160'}, {ident:'OSPOT'}] },
      { name:'EGOBA2Y', rwy:'34L/34R', wps:[{ident:'YD020'}, {ident:'YD040'}, {ident:'YD070'}, {ident:'YD100'}, {ident:'YK130'}, {ident:'YK170'}, {ident:'YK210'}, {ident:'EGOBA'}] },
    ],
    approaches: [],
  },
  RKSS: {
    name: '김포',
    stars: [],
    sids: [
      { name:'OSPOT2U', rwy:'14L/14R', wps:[{ident:'UD050'}, {ident:'UD060'}, {ident:'UD080'}, {ident:'UG100'}, {ident:'UG130'}, {ident:'OSPOT'}] },
      { name:'EGOBA2U', rwy:'14L/14R', wps:[{ident:'UD050'}, {ident:'SEL'}, {ident:'EGOBA'}] },
      { name:'NOPIK2U', rwy:'14L/14R', wps:[{ident:'UD050'}, {ident:'UP050'}, {ident:'UP060'}, {ident:'UP059'}, {ident:'UP100'}, {ident:'NOPIK'}] },
      { name:'BULTI2U', rwy:'14L/14R', wps:[{ident:'UD050'}, {ident:'UD060'}, {ident:'UD080'}, {ident:'UD100'}, {ident:'UPDET'}, {ident:'BULTI'}] },
      { name:'BULTI2Z', rwy:'14L/14R', wps:[{ident:'UD050'}, {ident:'UP050'}, {ident:'ZD080'}, {ident:'ZD100'}, {ident:'ZD120'}, {ident:'ZD119'}, {ident:'BULTI'}] },
      { name:'OSPOT2Z', rwy:'14L/14R', wps:[{ident:'UD050'}, {ident:'UP050'}, {ident:'ZD080'}, {ident:'ZD100'}, {ident:'ZG130'}, {ident:'OSPOT'}] },
      { name:'NOPIK2T', rwy:'32L/32R', wps:[{ident:'TD040'}, {ident:'TD050'}, {ident:'TP080'}, {ident:'TP120'}, {ident:'NOPIK'}] },
      { name:'BULTI2T', rwy:'32L/32R', wps:[{ident:'TD040'}, {ident:'TD050'}, {ident:'TD100'}, {ident:'TD120'}, {ident:'TD130'}, {ident:'TD180'}, {ident:'TD200'}, {ident:'BULTI'}] },
      { name:'NOPIK2Q', rwy:'32L/32R', wps:[{ident:'QD040'}, {ident:'QD050'}, {ident:'QP080'}, {ident:'QP079'}, {ident:'QP120'}, {ident:'NOPIK'}] },
      { name:'BULTI2Q', rwy:'32L/32R', wps:[{ident:'QD040'}, {ident:'QD050'}, {ident:'QD080'}, {ident:'QD090'}, {ident:'QD110'}, {ident:'QD150'}, {ident:'QD160'}, {ident:'BULTI'}] },
    ],
    approaches: [],
  },
  RKPK: {
    name: '김해',
    stars: [
      { name:'GAYHA 3', rwy:'18L/18R', wps:[
        {ident:'ARECO', lat:35.3800, lon:128.6300},
        {ident:'GAYHA', lat:35.2229, lon:128.6318},
      ]},
      { name:'KEVOX 3', rwy:'36L/36R', wps:[
        {ident:'OVTUS', lat:35.0306, lon:128.6525},
        {ident:'KEVOX', lat:35.1380, lon:128.8230},
      ]},
      { name:'PEDLO 2', rwy:'36L/36R', wps:[
        {ident:'PEDLO', lat:34.9897, lon:129.0043},
      ]},
    ],
    sids: [
      { name:'RNAV OPONO 3 · KALOD', rwy:'36L/36R', wps:[{ident:'OPONO'}, {ident:'KALOD'}] },
      { name:'RNAV OPONO 3 · MASTA', rwy:'36L/36R', wps:[{ident:'OPONO'}, {ident:'MASTA'}] },
      { name:'RNAV OPONO 3 · ENGOT', rwy:'36L/36R', wps:[{ident:'OPONO'}, {ident:'PK521'}, {ident:'SARAM'}, {ident:'ENGOT'}] },
      { name:'RNAV OPONO 3 · BESNA', rwy:'36L/36R', wps:[{ident:'OPONO'}, {ident:'PK521'}, {ident:'PK522'}, {ident:'BESNA'}] },
      { name:'RNAV OPONO 3 · BUSAN(PSN)', rwy:'36L/36R', wps:[{ident:'OPONO'}, {ident:'PK521'}, {ident:'PK522'}, {ident:'PSN'}] },
      { name:'BEVSI 3 · KALOD (VOR)', rwy:'36L/36R', wps:[{ident:'BEVSI'}, {ident:'KALOD'}] },
      { name:'BEVSI 3 · BUSAN(PSN) (VOR)', rwy:'36L/36R', wps:[{ident:'BEVSI'}, {ident:'PSN'}] },
      { name:'BEVSI 3 · MASTA (VOR)', rwy:'36L/36R', wps:[{ident:'BEVSI'}, {ident:'MASTA'}] },
      { name:'BEVSI 3 · TOPAX (VOR)', rwy:'36L/36R', wps:[{ident:'BEVSI'}, {ident:'SARAM'}, {ident:'TOPAX'}] },
      { name:'SOORO 2 · KALOD (VOR)', rwy:'36L/36R', wps:[{ident:'SOORO'}, {ident:'KALOD'}] },
      { name:'SOORO 2 · BUSAN(PSN) (VOR)', rwy:'36L/36R', wps:[{ident:'SOORO'}, {ident:'PSN'}] },
      { name:'SOORO 2 · MASTA (VOR)', rwy:'36L/36R', wps:[{ident:'SOORO'}, {ident:'MASTA'}] },
      { name:'SOORO 2 · TOPAX (VOR)', rwy:'36L/36R', wps:[{ident:'SOORO'}, {ident:'SARAM'}, {ident:'TOPAX'}] },
      { name:'SOORO 2 · BESNA (VOR)', rwy:'36L/36R', wps:[{ident:'SOORO'}, {ident:'PSN'}, {ident:'BESNA'}] },
      { name:'SOORO 2 · ENGOT (VOR)', rwy:'36L/36R', wps:[{ident:'SOORO'}, {ident:'SARAM'}, {ident:'ENGOT'}] },
      { name:'ATLAX 2 (VOR)', rwy:'36L/36R', wps:[{ident:'ATLAX'}] },
      { name:'RNAV BURIM 3 · ENGOT', rwy:'18L/18R', wps:[{ident:'BURIM'}, {ident:'BAHDA'}, {ident:'ENGOT'}] },
      { name:'RNAV BURIM 3 · BESNA', rwy:'18L/18R', wps:[{ident:'BURIM'}, {ident:'BAHDA'}, {ident:'BESNA'}] },
      { name:'RNAV BURIM 3 · INVOK', rwy:'18L/18R', wps:[{ident:'BURIM'}, {ident:'BAHDA'}, {ident:'INVOK'}] },
      { name:'RNAV BURIM 3 · BUSAN(PSN)', rwy:'18L/18R', wps:[{ident:'BURIM'}, {ident:'PK513'}, {ident:'PK514'}, {ident:'PSN'}] },
      { name:'ULSUK 3 · KALOD (VOR)', rwy:'18L/18R', wps:[{ident:'ULSUK'}, {ident:'KALOD'}] },
      { name:'ULSUK 3 · MASTA (VOR)', rwy:'18L/18R', wps:[{ident:'ULSUK'}, {ident:'MASTA'}] },
      { name:'ULSUK 3 · SAPDI (VOR)', rwy:'18L/18R', wps:[{ident:'ULSUK'}, {ident:'SAPDI'}] },
      { name:'ULSUK 3 · BUSAN(PSN) (VOR)', rwy:'18L/18R', wps:[{ident:'ULSUK'}, {ident:'PSN'}] },
      { name:'ULSUK 3 · TOPAX (VOR)', rwy:'18L/18R', wps:[{ident:'ULSUK'}, {ident:'TOPAX'}] },
      { name:'BAHDA 2 · KALEK (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'KALEK'}] },
      { name:'BAHDA 2 · INVOK (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'INVOK'}] },
      { name:'BAHDA 2 · APELA (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'APELA'}] },
      { name:'BAHDA 2 · BUSAN(PSN) (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'PSN'}] },
      { name:'BAHDA 2 · TOPAX (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'TOPAX'}] },
      { name:'BAHDA 2 · ENGOT (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'ENGOT'}] },
      { name:'BAHDA 2 · BESNA (VOR)', rwy:'18L/18R', wps:[{ident:'BAHDA'}, {ident:'BESNA'}] },
    ],
    approaches: [
      { name:'ILS Z RWY 36R', wps:[
        {ident:'PEDLO', lat:34.9897, lon:129.0043},
        {ident:'BOSPI', lat:35.0900, lon:128.9370},
        {ident:'NEIAN', lat:35.1400, lon:128.9371},
        {ident:'IKHE',  lat:35.1967, lon:128.9371},
        {ident:'RW36R', lat:35.1082, lon:128.9384},
      ]},
      { name:'ILS Y RWY 36R', wps:[
        {ident:'GEOJE', lat:35.0154, lon:128.7283},
        {ident:'KMH',   lat:35.1992, lon:128.9356},
        {ident:'IKHE',  lat:35.1967, lon:128.9371},
        {ident:'RW36R', lat:35.1082, lon:128.9384},
      ]},
      { name:'VOR RWY 36R', wps:[
        {ident:'GEOJE', lat:35.0154, lon:128.7283},
        {ident:'KMH',   lat:35.1992, lon:128.9356},
        {ident:'RW36R', lat:35.1082, lon:128.9384},
      ]},
      { name:'RNP RWY 36R', wps:[
        {ident:'KEVOX', lat:35.1380, lon:128.8230},
        {ident:'BOSPI', lat:35.0900, lon:128.9370},
        {ident:'PK712', lat:35.1270, lon:128.9370},
        {ident:'IDIVU', lat:35.1780, lon:128.9370},
        {ident:'RW36R', lat:35.1082, lon:128.9384},
      ]},
      { name:'LOC Z RWY 36R', wps:[
        {ident:'PEDLO', lat:34.9897, lon:129.0043},
        {ident:'BOSPI', lat:35.0900, lon:128.9370},
        {ident:'NEIAN', lat:35.1400, lon:128.9371},
        {ident:'IKHE',  lat:35.1967, lon:128.9371},
        {ident:'RW36R', lat:35.1082, lon:128.9384},
      ]},
      { name:'ILS RWY 36L', wps:[
        {ident:'AKEVI', lat:34.9750, lon:128.9330},
        {ident:'OLMOG', lat:35.0900, lon:128.9370},
        {ident:'IKMA',  lat:35.1971, lon:128.9348},
        {ident:'RW36L', lat:35.1082, lon:128.9340},
      ]},
      { name:'RNP RWY 36L', wps:[
        {ident:'AKEVI', lat:34.9750, lon:128.9330},
        {ident:'OLMOG', lat:35.0900, lon:128.9370},
        {ident:'IKESI', lat:35.1600, lon:128.9370},
        {ident:'RW36L', lat:35.1082, lon:128.9340},
      ]},
      { name:'RNP-B RWY 18R', wps:[
        {ident:'GAYHA', lat:35.2229, lon:128.6318},
        {ident:'OVTUS', lat:35.0306, lon:128.6525},
        {ident:'NOORI', lat:35.0764, lon:128.6687, arc:{clat:35.0045,clon:128.8833,dir:'R'}},
        {ident:'WAYBI', lat:35.1430, lon:128.7300, arc:{clat:35.0045,clon:128.8833,dir:'R'}},
        {ident:'ZIKKO', lat:35.1960, lon:128.7790},
        {ident:'RW18R', lat:35.2508, lon:128.9380},
      ]},
      { name:'VOR-A RWY 18L', wps:[
        {ident:'GAYHA', lat:35.2229, lon:128.6318},
        {ident:'KMH',   lat:35.1992, lon:128.9356},
        {ident:'RW18L', lat:35.2508, lon:128.9336},
      ]},
    ],
  },
  RKPC: {
    name: '제주',
    stars: [], approaches: [],
    sids: [
      { name:'KAMIT2E', rwy:'07', wps:[{ident:'PC811',lat:33.70336,lon:126.71356}, {ident:'OLLEH',lat:33.96172,lon:126.74069}, {ident:'KAMIT',lat:34.25392,lon:126.77158}] },
      { name:'AKPON1E', rwy:'07', wps:[{ident:'PALRI',lat:33.64089,lon:126.74372}, {ident:'AKPON',lat:33.78044,lon:127.33139}] },
      { name:'TAMNA2E', rwy:'07', wps:[{ident:'PALRI',lat:33.64089,lon:126.74372}, {ident:'TAMNA',lat:33.47097,lon:127.33139}] },
      { name:'PANSI2E', rwy:'07', wps:[{ident:'PALRI',lat:33.64089,lon:126.74372}, {ident:'PC813',lat:33.49875,lon:126.84722}, {ident:'CJU',lat:33.38461,lon:126.62411}, {ident:'PC814',lat:33.26011,lon:126.48708}, {ident:'PANSI',lat:33.004,lon:126.20697}] },
      { name:'LIMDI1E', rwy:'07', wps:[{ident:'PALRI',lat:33.64089,lon:126.74372}, {ident:'PC813',lat:33.49875,lon:126.84722}, {ident:'CJU',lat:33.38461,lon:126.62411}, {ident:'PC816',lat:33.44903,lon:126.32522}, {ident:'LIMDI',lat:33.55369,lon:125.83139}] },
      { name:'KAMIT1W', rwy:'25', wps:[{ident:'MEXER',lat:33.45778,lon:126.38667}, {ident:'PC832',lat:33.67944,lon:126.23108}, {ident:'PC833',lat:33.83578,lon:126.51244}, {ident:'OLLEH',lat:33.96172,lon:126.74069}, {ident:'KAMIT',lat:34.25392,lon:126.77158}] },
      { name:'IPDAS1W', rwy:'25', wps:[{ident:'MEXER',lat:33.45778,lon:126.38667}, {ident:'PC832',lat:33.67944,lon:126.23108}, {ident:'PC833',lat:33.83578,lon:126.51244}, {ident:'PC834',lat:33.9295,lon:126.68214}, {ident:'IPDAS',lat:34.25408,lon:126.71706}] },
      { name:'AKPON1W', rwy:'25', wps:[{ident:'PC841',lat:33.42853,lon:126.32994}, {ident:'PC842',lat:33.29397,lon:126.35481}, {ident:'PC846',lat:33.321,lon:126.59128}, {ident:'ATIMO',lat:33.39792,lon:126.73089}, {ident:'PAPLU',lat:33.57814,lon:127.06014}, {ident:'AKPON',lat:33.78044,lon:127.33139}] },
      { name:'TAMNA3W', rwy:'25', wps:[{ident:'PC841',lat:33.42853,lon:126.32994}, {ident:'PC842',lat:33.29397,lon:126.35481}, {ident:'PC846',lat:33.321,lon:126.59128}, {ident:'ATIMO',lat:33.39792,lon:126.73089}, {ident:'PC845',lat:33.41756,lon:126.89}, {ident:'TAMNA',lat:33.47097,lon:127.33139}] },
      { name:'PANSI2W', rwy:'25', wps:[{ident:'PC841',lat:33.42853,lon:126.32994}, {ident:'PANSI',lat:33.004,lon:126.20697}] },
      { name:'LIMDI1W', rwy:'25', wps:[{ident:'MEXER',lat:33.45778,lon:126.38667}, {ident:'LEDIN',lat:33.54503,lon:126.17081}, {ident:'LIMDI',lat:33.55369,lon:125.83139}] },
      { name:'KAMIT2N', rwy:'31', wps:[{ident:'PC861',lat:33.56217,lon:126.40947}, {ident:'PC871',lat:33.65147,lon:126.40889}, {ident:'PC872',lat:33.72136,lon:126.52186}, {ident:'TOREN',lat:33.81022,lon:126.66603}, {ident:'OLLEH',lat:33.96172,lon:126.74069}, {ident:'KAMIT',lat:34.25392,lon:126.77158}] },
      { name:'AKPON1N', rwy:'31', wps:[{ident:'PC861',lat:33.56217,lon:126.40947}, {ident:'PC871',lat:33.65147,lon:126.40889}, {ident:'PC872',lat:33.72136,lon:126.52186}, {ident:'TOREN',lat:33.81022,lon:126.66603}, {ident:'PC874',lat:33.81056,lon:127.18578}, {ident:'AKPON',lat:33.78044,lon:127.33139}] },
    ],
  },
  RKNY: {
    name: '양양',
    sids: [
      { name:'KAE 2E',   rwy:'15', wps:[
        {ident:'NY050',lat:37.9781,lon:128.7542},
        {ident:'NY070',lat:37.9025,lon:128.7539},
        {ident:'NY090',lat:37.8231,lon:128.7539},
        {ident:'KAE',  lat:37.7008,lon:128.7538},
      ]},
      { name:'BIKSI 2E', rwy:'15', wps:[
        {ident:'NY050',lat:37.9781,lon:128.7542},
        {ident:'NY070',lat:37.9025,lon:128.7539},
        {ident:'NY090',lat:37.8231,lon:128.7539},
        {ident:'KAE',  lat:37.7008,lon:128.7538},
        {ident:'BIKSI',lat:37.6756,lon:128.5844},
      ]},
      { name:'PILIT 2E', rwy:'15', wps:[
        {ident:'NY050',lat:37.9781,lon:128.7542},
        {ident:'NY070',lat:37.9025,lon:128.7539},
        {ident:'NY090',lat:37.8231,lon:128.7539},
        {ident:'KAE',  lat:37.7008,lon:128.7538},
        {ident:'PILIT',lat:37.4419,lon:129.2919},
      ]},
      { name:'KAE 2N',   rwy:'33', wps:[
        {ident:'NY000',lat:38.0958,lon:128.6472},
        {ident:'NY040',lat:38.0408,lon:128.7542},
        {ident:'NY050',lat:37.9781,lon:128.7542},
        {ident:'NY070',lat:37.9025,lon:128.7539},
        {ident:'NY090',lat:37.8231,lon:128.7539},
        {ident:'KAE',  lat:37.7008,lon:128.7538},
      ]},
      { name:'BIKSI 2N', rwy:'33', wps:[
        {ident:'NY000',lat:38.0958,lon:128.6472},
        {ident:'NY040',lat:38.0408,lon:128.7542},
        {ident:'NY050',lat:37.9781,lon:128.7542},
        {ident:'NY070',lat:37.9025,lon:128.7539},
        {ident:'NY090',lat:37.8231,lon:128.7539},
        {ident:'KAE',  lat:37.7008,lon:128.7538},
        {ident:'BIKSI',lat:37.6756,lon:128.5844},
      ]},
      { name:'PILIT 2N', rwy:'33', wps:[
        {ident:'NY000',lat:38.0958,lon:128.6472},
        {ident:'NY040',lat:38.0408,lon:128.7542},
        {ident:'NY050',lat:37.9781,lon:128.7542},
        {ident:'NY070',lat:37.9025,lon:128.7539},
        {ident:'NY090',lat:37.8231,lon:128.7539},
        {ident:'KAE',  lat:37.7008,lon:128.7538},
        {ident:'PILIT',lat:37.4419,lon:129.2919},
      ]},
    ],
    stars: [
      { name:'KAE 2H',   rwy:'33', wps:[
        {ident:'KAE',  lat:37.7008,lon:128.7538},
        {ident:'NY049',lat:37.7527,lon:128.6738},
        {ident:'NY042',lat:37.8742,lon:128.6738},
        {ident:'NY031',lat:38.0594,lon:128.6738},
        {ident:'NIMAL',lat:38.0714,lon:128.7638},
        {ident:'DUBUN',lat:38.0874,lon:128.8705},
      ]},
      { name:'BIKSI 2H', rwy:'33', wps:[
        {ident:'BIKSI',lat:37.6756,lon:128.5844},
        {ident:'NY049',lat:37.7527,lon:128.6738},
        {ident:'NY042',lat:37.8742,lon:128.6738},
        {ident:'NY031',lat:38.0594,lon:128.6738},
        {ident:'NIMAL',lat:38.0714,lon:128.7638},
        {ident:'DUBUN',lat:38.0874,lon:128.8705},
      ]},
    ],
    approaches: [
      { name:'ILS Z RWY 33', wps:[
        {ident:'DUBUN', lat:38.0874,lon:128.8705},
        {ident:'NY015', lat:37.9753,lon:128.8927, arc:{clat:38.0188,clon:128.7798,dir:'R'}},
        {ident:'NY010', lat:37.9228,lon:128.8108, arc:{clat:38.0188,clon:128.7798,dir:'R'}},
        {ident:'NY004', lat:37.9947,lon:128.7375},
        {ident:'NY003', lat:38.0025,lon:128.7431},
        {ident:'RW33',  lat:38.0526,lon:128.6781},
      ]},
      { name:'ILS Y RWY 33', wps:[
        {ident:'DUBUN',   lat:38.0874,lon:128.8705},
        {ident:'IYAN D9', lat:37.9358,lon:128.7975, arc:{clat:38.0633,clon:128.6615,dir:'R'}},
        {ident:'IYAN D7', lat:37.9638,lon:128.7690},
        {ident:'IYAN D4', lat:37.9955,lon:128.7365},
        {ident:'IYAN D3', lat:38.0144,lon:128.7173},
        {ident:'IYAN D1', lat:38.0416,lon:128.6894},
        {ident:'RW33',    lat:38.0526,lon:128.6781},
      ]},
      { name:'VOR RWY 33', wps:[
        {ident:'DUBUN',   lat:38.0874,lon:128.8705},
        {ident:'YAG D10', lat:37.9471,lon:128.8129, arc:{clat:38.0633,clon:128.6615,dir:'R'}},
        {ident:'YAG D5',  lat:38.0052,lon:128.7373},
        {ident:'YAG D2',  lat:38.0401,lon:128.6919},
        {ident:'RW33',    lat:38.0526,lon:128.6781},
      ]},
      { name:'RNP RWY 33', wps:[
        {ident:'DUBUN', lat:38.0874,lon:128.8705},
        {ident:'NY015', lat:37.9753,lon:128.8927, arc:{clat:38.0188,clon:128.7798,dir:'R'}},
        {ident:'NY010', lat:37.9228,lon:128.8108, arc:{clat:38.0188,clon:128.7798,dir:'R'}},
        {ident:'NY004', lat:37.9947,lon:128.7375},
        {ident:'NY003', lat:38.0025,lon:128.7431},
        {ident:'RW33',  lat:38.0526,lon:128.6781},
      ]},
    ],
  },
  RKJK: {
    name: '군산',
    sids: [
      { name:'ENTEL 1', rwy:'18/36', wps:[
        {ident:'KUZ',   lat:35.9104, lon:126.6114},
        {ident:'ENTEL', lat:36.3864, lon:126.9514},
      ]},
      { name:'LINTA 1', rwy:'18/36', wps:[
        {ident:'KUZ',   lat:35.9104, lon:126.6114},
        {ident:'LINTA', lat:35.5211, lon:126.8553},
      ]},
      { name:'PORIX 2', rwy:'18/36', wps:[
        {ident:'PORIX', lat:35.6742, lon:126.7614},
        {ident:'MANGI', lat:35.5031, lon:126.7421},
      ]},
    ],
    stars: [],
    approaches: [],
  },
  RKSM: {
    name: '서울공항(성남)',
    stars: [], approaches: [],
    sids: [
      { name:'RNAV MEESA 1', rwy:'01/02', wps:[{ident:'MEESA'}] },
      { name:'MEESA 1 · KARBU', rwy:'01/02', wps:[{ident:'MEESA'}, {ident:'KARBU'}] },
      { name:'MEESA 1 · PINEV', rwy:'01/02', wps:[{ident:'MEESA'}, {ident:'EGOBA'}, {ident:'MUGAR'}, {ident:'PINEV'}] },
      { name:'RNAV MUGAR 1', rwy:'19/20', wps:[{ident:'MUGAR'}] },
      { name:'RNAV SONGTAN 1', rwy:'19/20', wps:[{ident:'SOT'}] },
      { name:'RNAV YEOJU 1', rwy:'19/20', wps:[{ident:'BIDBA'}, {ident:'YEOJU'}] },
      { name:'YEOJU 1 · SEL', rwy:'19/20', wps:[{ident:'BIDBA'}, {ident:'YEOJU'}, {ident:'VEMUM'}, {ident:'UPTAD'}, {ident:'SEL'}] },
      { name:'YEOJU 1 · KARBU', rwy:'19/20', wps:[{ident:'BIDBA'}, {ident:'YEOJU'}, {ident:'KARBU'}] },
    ],
  },
  RKPU: {
    name: '울산',
    stars: [], approaches: [],
    sids: [
      { name:'RNAV KPO 1M', rwy:'18', wps:[{ident:'PU851'}, {ident:'PU852'}, {ident:'PU853'}, {ident:'KPO'}] },
      { name:'RNAV APARU 1M', rwy:'18', wps:[{ident:'PU851'}, {ident:'APARU'}] },
      { name:'KPO 1A (VOR)', rwy:'18', wps:[{ident:'KPO'}] },
      { name:'KPO 7S (VOR)', rwy:'18', wps:[{ident:'KPO'}] },
      { name:'APARU 7S (VOR)', rwy:'18', wps:[{ident:'APARU'}] },
      { name:'RNAV KPO 1R', rwy:'36', wps:[{ident:'PU801'}, {ident:'PU802'}, {ident:'KPO'}] },
      { name:'RNAV APARU 1R', rwy:'36', wps:[{ident:'PU801'}, {ident:'PU802'}, {ident:'PU803'}, {ident:'APARU'}] },
      { name:'KPO 8N (VOR)', rwy:'36', wps:[{ident:'KPO'}] },
      { name:'APARU 1A (VOR)', rwy:'36', wps:[{ident:'APARU'}] },
      { name:'APARU 8N (VOR)', rwy:'36', wps:[{ident:'APARU'}] },
    ],
  },
  RKTH: {
    name: '포항경주',
    stars: [], approaches: [],
    sids: [
      { name:'POHANG 5 · ELAPI (VOR)', rwy:'10', wps:[{ident:'NPH'}, {ident:'ELAPI'}] },
      { name:'POHANG 5 · LOSTO (VOR)', rwy:'10', wps:[{ident:'NPH'}, {ident:'LOSTO'}] },
      { name:'POHANG 5 · BULGA (VOR)', rwy:'10', wps:[{ident:'NPH'}, {ident:'BULGA'}] },
      { name:'POHANG 5 · APARU (VOR)', rwy:'10', wps:[{ident:'NPH'}, {ident:'APARU'}] },
      { name:'POHANG 5 · LAPAL (VOR)', rwy:'10', wps:[{ident:'NPH'}, {ident:'LAPAL'}] },
      { name:'RNAV DORTI 1 · ELAPI', rwy:'10', wps:[{ident:'DORTI'}, {ident:'TH801'}, {ident:'TH802'}, {ident:'TH803'}, {ident:'ELAPI'}] },
      { name:'RNAV DORTI 1 · LOSTO', rwy:'10', wps:[{ident:'DORTI'}, {ident:'TH801'}, {ident:'LOSTO'}] },
      { name:'RNAV DORTI 1 · BULGA', rwy:'10', wps:[{ident:'DORTI'}, {ident:'TH804'}, {ident:'BULGA'}] },
      { name:'RNAV DORTI 1 · APARU', rwy:'10', wps:[{ident:'DORTI'}, {ident:'TH805'}, {ident:'MAKUN'}, {ident:'APARU'}] },
      { name:'RNAV DORTI 1 · LAPAL', rwy:'10', wps:[{ident:'DORTI'}, {ident:'TH805'}, {ident:'TH806'}, {ident:'LAPAL'}] },
      { name:'POHANG 4 · ELAPI (VOR)', rwy:'28', wps:[{ident:'NPH'}, {ident:'ELAPI'}] },
      { name:'POHANG 4 · LOSTO (VOR)', rwy:'28', wps:[{ident:'NPH'}, {ident:'LOSTO'}] },
      { name:'POHANG 4 · BULGA (VOR)', rwy:'28', wps:[{ident:'NPH'}, {ident:'BULGA'}] },
      { name:'POHANG 4 · APARU (VOR)', rwy:'28', wps:[{ident:'NPH'}, {ident:'APARU'}] },
      { name:'POHANG 4 · LAPAL (VOR)', rwy:'28', wps:[{ident:'NPH'}, {ident:'LAPAL'}] },
      { name:'RNAV MARMI 1 · ELAPI', rwy:'28', wps:[{ident:'MARMI'}, {ident:'TH903'}, {ident:'ELAPI'}] },
      { name:'RNAV MARMI 1 · LOSTO', rwy:'28', wps:[{ident:'MARMI'}, {ident:'TH901'}, {ident:'TH902'}, {ident:'LOSTO'}] },
      { name:'RNAV MARMI 1 · BULGA', rwy:'28', wps:[{ident:'MARMI'}, {ident:'TH904'}, {ident:'TH905'}, {ident:'TH906'}, {ident:'BULGA'}] },
      { name:'RNAV MARMI 1 · APARU', rwy:'28', wps:[{ident:'MARMI'}, {ident:'TH904'}, {ident:'MAKUN'}, {ident:'APARU'}] },
      { name:'RNAV MARMI 1 · LAPAL', rwy:'28', wps:[{ident:'MARMI'}, {ident:'LAPAL'}] },
    ],
  },
  RKTL: {
    name: '울진',
    stars: [], approaches: [],
    sids: [
      { name:'RNAV NOBUT 2M', rwy:'17', wps:[{ident:'TL121'}, {ident:'TL222'}, {ident:'TL223'}, {ident:'TL024'}, {ident:'TL025'}, {ident:'NOBUT'}] },
      { name:'RNAV LOSTO 1M', rwy:'17', wps:[{ident:'TL121'}, {ident:'TL026'}, {ident:'LOSTO'}] },
      { name:'NOBUT 2S (VOR)', rwy:'17', wps:[{ident:'UJN'}, {ident:'NOBUT'}] },
      { name:'LOSTO 2S (VOR)', rwy:'17', wps:[{ident:'UJN'}, {ident:'LOSTO'}] },
      { name:'LOSTO 6S (VOR)', rwy:'17', wps:[{ident:'UJN'}, {ident:'LOSTO'}] },
      { name:'RNAV NOBUT 1R', rwy:'35', wps:[{ident:'TL131'}, {ident:'TL025'}, {ident:'NOBUT'}] },
      { name:'RNAV LOSTO 2R', rwy:'35', wps:[{ident:'TL131'}, {ident:'TL232'}, {ident:'TL233'}, {ident:'TL034'}, {ident:'TL035'}, {ident:'LOSTO'}] },
      { name:'NOBUT 3N (VOR)', rwy:'35', wps:[{ident:'UJN'}, {ident:'NOBUT'}] },
      { name:'LOSTO 2N (VOR)', rwy:'35', wps:[{ident:'UJN'}, {ident:'LOSTO'}] },
      { name:'LOSTO 2A (VOR)', rwy:'35', wps:[{ident:'UJN'}, {ident:'LOSTO'}] },
    ],
  },
  RKTU: {
    name: '청주',
    stars: [], approaches: [],
    sids: [
      { name:'RNAV BUKIL 2 · GUKDO', rwy:'06L', wps:[{ident:'BUKIL'}, {ident:'GUKDO'}] },
      { name:'RNAV BUKIL 2 · OLMEN', rwy:'06L', wps:[{ident:'BUKIL'}, {ident:'TUTAE'}, {ident:'OWING'}, {ident:'OLMEN'}] },
      { name:'RNAV BUKIL 2 · BULTI', rwy:'06L', wps:[{ident:'BUKIL'}, {ident:'TUTAE'}, {ident:'OWING'}, {ident:'BULTI'}] },
      { name:'RNAV UPTIL 1 · GUKDO', rwy:'24R', wps:[{ident:'UPTIL'}, {ident:'TU521'}, {ident:'TUTAE'}, {ident:'GUKDO'}] },
      { name:'RNAV UPTIL 1 · OLMEN', rwy:'24R', wps:[{ident:'UPTIL'}, {ident:'OLMEN'}] },
      { name:'RNAV UPTIL 1 · BULTI', rwy:'24R', wps:[{ident:'UPTIL'}, {ident:'BULTI'}] },
      { name:'CHEONGJU 4 · GUKDO (VOR)', rwy:'06L/06R', wps:[{ident:'CHO'}, {ident:'GUKDO'}] },
      { name:'CHEONGJU 4 · MAKDU (VOR)', rwy:'06L/06R', wps:[{ident:'CHO'}, {ident:'MAKDU'}] },
      { name:'CHEONGJU 4 · OSPOT (VOR)', rwy:'06L/06R', wps:[{ident:'CHO'}, {ident:'OSPOT'}] },
      { name:'CHEONGJU 4 · OLMEN (VOR)', rwy:'06L/06R', wps:[{ident:'CHO'}, {ident:'OLMEN'}] },
      { name:'CHEONGJU 4 · BULTI (VOR)', rwy:'06L/06R', wps:[{ident:'CHO'}, {ident:'BULTI'}] },
      { name:'CHEONGJU 5 · BULTI (VOR)', rwy:'24L/24R', wps:[{ident:'CHO'}, {ident:'BULTI'}] },
      { name:'CHEONGJU 5 · OLMEN (VOR)', rwy:'24L/24R', wps:[{ident:'CHO'}, {ident:'OLMEN'}] },
      { name:'CHEONGJU 5 · OSPOT (VOR)', rwy:'24L/24R', wps:[{ident:'CHO'}, {ident:'OSPOT'}] },
      { name:'CHEONGJU 5 · GUKDO (VOR)', rwy:'24L/24R', wps:[{ident:'CHO'}, {ident:'GUKDO'}] },
      { name:'CHEONGJU 5 · MAKDU (VOR)', rwy:'24L/24R', wps:[{ident:'CHO'}, {ident:'MAKDU'}] },
    ],
  },
  RKTN: {
    name: '대구',
    stars: [], approaches: [],
    sids: [
      { name:'RNAV DOVUR 1 · BITUX', rwy:'13R/13L', wps:[{ident:'DOVUR'}, {ident:'TN131'}, {ident:'TN132'}, {ident:'VETUP'}, {ident:'BITUX'}] },
      { name:'RNAV DOVUR 1 · OPEDA', rwy:'13R/13L', wps:[{ident:'DOVUR'}, {ident:'TN131'}, {ident:'TN132'}, {ident:'OPEDA'}] },
      { name:'RNAV DOVUR 1 · IGDOK', rwy:'13R/13L', wps:[{ident:'DOVUR'}, {ident:'TN131'}, {ident:'PEDVA'}, {ident:'IGDOK'}] },
      { name:'RNAV DOVUR 1 · MASTA', rwy:'13R/13L', wps:[{ident:'DOVUR'}, {ident:'TN131'}, {ident:'MASTA'}] },
      { name:'RNAV DOVUR 1 · KALOD', rwy:'13R/13L', wps:[{ident:'DOVUR'}, {ident:'KALOD'}] },
      { name:'RNAV DOVUR 1 · LAPAL', rwy:'13R/13L', wps:[{ident:'DOVUR'}, {ident:'LAPAL'}] },
      { name:'RNAV KABAS 1 · BITUX', rwy:'31L/31R', wps:[{ident:'KABAS'}, {ident:'VETUP'}, {ident:'BITUX'}] },
      { name:'RNAV KABAS 1 · OPEDA', rwy:'31L/31R', wps:[{ident:'KABAS'}, {ident:'OPEDA'}] },
      { name:'RNAV KABAS 1 · IGDOK', rwy:'31L/31R', wps:[{ident:'KABAS'}, {ident:'TN311'}, {ident:'PEDVA'}, {ident:'IGDOK'}] },
      { name:'RNAV KABAS 1 · MASTA', rwy:'31L/31R', wps:[{ident:'KABAS'}, {ident:'TN311'}, {ident:'MASTA'}] },
      { name:'RNAV KABAS 1 · KALOD', rwy:'31L/31R', wps:[{ident:'KABAS'}, {ident:'TN311'}, {ident:'TN312'}, {ident:'KALOD'}] },
      { name:'RNAV KABAS 1 · LAPAL', rwy:'31L/31R', wps:[{ident:'KABAS'}, {ident:'TN311'}, {ident:'TN312'}, {ident:'LAPAL'}] },
      { name:'DONGCHON 7 · BITUX (VOR)', rwy:'13R/13L, 31R/31L', wps:[{ident:'DOC'}, {ident:'BITUX'}] },
      { name:'DONGCHON 7 · OPEDA (VOR)', rwy:'13R/13L, 31R/31L', wps:[{ident:'DOC'}, {ident:'OPEDA'}] },
      { name:'DONGCHON 7 · IGDOK (VOR)', rwy:'13R/13L, 31R/31L', wps:[{ident:'DOC'}, {ident:'IGDOK'}] },
      { name:'DONGCHON 7 · MASTA (VOR)', rwy:'13R/13L, 31R/31L', wps:[{ident:'DOC'}, {ident:'MASTA'}] },
      { name:'DONGCHON 7 · KALOD (VOR)', rwy:'13R/13L, 31R/31L', wps:[{ident:'DOC'}, {ident:'KALOD'}] },
      { name:'DONGCHON 7 · LAPAL (VOR)', rwy:'13R/13L, 31R/31L', wps:[{ident:'DOC'}, {ident:'LAPAL'}] },
      { name:'DALSEONG 3A (VOR)', rwy:'13R/13L, 31L/31R', wps:[{ident:'TGU'}] },
    ],
  },
};

// ── Korean airports providing METAR/TAF (single source of truth) ─────────────
// Used for: always-visible map weather icons, background METAR refresh, and the
// WX panel quick-select buttons. Covers civil airports plus military/joint-use
// air bases (Osan, Gunsan, Seoul, Suwon, Pyeongtaek, Yecheon, Wonju) which
// report METAR/TAF to aviationweather.gov / NOAA.
// 마스터 데이터에서 파생
const WX_AIRPORTS = AIRPORTS_KR.map(a => ({ icao: a.icao, name: a.name, lat: a.lat, lon: a.lon }));
const APT_LATLNG  = Object.fromEntries(AIRPORTS_KR.map(a => [a.icao, [a.lat, a.lon]]));
const APT_NAME    = Object.fromEntries(AIRPORTS_KR.map(a => [a.icao, a.name]));

// ── 공항 기본정보 (차트탭에 업로드된 AIP TEXT PDF에서 추출·캐시) ──
//  ELEV / ARP / 활주로 / 주파수(TWR·GND·APP·ATIS 등) → METAR 팝업에 표시
async function _getAptInfo(icao) {
  try {
    const cache = JSON.parse(localStorage.getItem('aptInfoDB2') || '{}');
    if (cache[icao]) return cache[icao];
    // 차트 저장소에서 해당 공항 TEXT PDF 탐색
    const keys = await idbGetAllKeys();
    const key = keys.find(k => typeof k === 'string' && k.startsWith(icao + '|') && /TEXT/i.test(k));
    if (!key) return null;
    const blob = await idbGet(key);
    if (!blob) return null;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    const info = { elevM: null, arp: '', rwys: [], freqs: {} };
    let sec = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const rows = _pdfPageRows(await doc.getPage(p).then(pg => pg.getTextContent()));
      for (const r of rows) {
        const T = r.text;
        // 섹션 헤더만 인정: 'AD 2.n 제목' 형태 + 참조 문구(REFER/SEE 등) 제외 + 번호 역행 금지
        const sm = T.match(/\bAD 2\.(\d+)\b\s+[A-Z]/);
        if (sm && !/REFER|SEE |PARAGRAPH|ITEM/.test(T) && (+sm[1]) >= (+sec || 0)) sec = sm[1];
        if (sec === '2') {
          let m = T.match(/ARP COORDINATES[^0-9]*(\d{6})N\s*(\d{7})E/);
          if (m && !info.arp) info.arp = m[1] + 'N ' + m[2] + 'E';
          m = T.match(/ELEVATION[^0-9]{0,40}?([\d.]+)\s*M\b/);
          if (m && info.elevM == null) info.elevM = parseFloat(m[1]);
        } else if (sec === '12') {
          const dm = T.match(/^(\d{2}[LRC]?)\b/);
          const sz = T.match(/(\d[\d ]{2,4})\s*[X×]\s*(\d{2,3})\b/);
          if (dm && sz && info.rwys.length < 8)
            info.rwys.push(dm[1] + ' ' + sz[1].replace(/ /g, '') + '×' + sz[2] + 'm');
        } else if (sec === '18') {
          const kw = T.match(/\b(TWR|TOWER|GND|GROUND|APP|APPROACH|ATIS|DEL|DELIVERY|DEP|RADAR|PMSV|OPS)\b/);
          if (kw) {
            const fr = T.match(/\b(1[0-3]\d\.\d{1,3}|[23]\d{2}\.\d{1,3})\b/g) || [];
            if (fr.length) {
              const k = { TOWER: 'TWR', GROUND: 'GND', APPROACH: 'APP', DELIVERY: 'DEL' }[kw[1]] || kw[1];
              info.freqs[k] = (info.freqs[k] || []);
              fr.forEach(f => { if (!info.freqs[k].includes(f) && info.freqs[k].length < 4) info.freqs[k].push(f); });
            }
          }
        }
      }
      // (조기 종료 제거 — 참조 문구로 인한 섹션 오인 시 데이터 누락 방지)
    }
    if (info.elevM == null && !info.arp && !info.rwys.length && !Object.keys(info.freqs).length) return null;
    cache[icao] = info;
    try { localStorage.setItem('aptInfoDB2', JSON.stringify(cache)); } catch(e) { _swallow(e); }
    return info;
  } catch(e) { return null; }
}
function _aptInfoHtml(info) {
  if (!info) return '';
  const li = [];
  if (info.elevM != null) li.push(`ELEV ${Math.round(info.elevM * 3.28084)} ft (${info.elevM} m)`);
  if (info.arp) li.push(`ARP ${info.arp}`);
  if (info.rwys.length) li.push('RWY ' + info.rwys.join(' · '));
  const order = ['ATIS', 'DEL', 'GND', 'TWR', 'APP', 'DEP', 'RADAR', 'PMSV', 'OPS'];
  order.forEach(k => { if (info.freqs[k]) li.push(`${k} ${info.freqs[k].join(' ')}`); });
  Object.keys(info.freqs).forEach(k => { if (!order.includes(k)) li.push(`${k} ${info.freqs[k].join(' ')}`); });
  if (!li.length) return '';
  return `<div style="border-top:1px solid #1e3a2a;margin-top:8px;padding-top:6px;">
    <div style="color:#ffcc00;font-size:20px;font-weight:bold;margin-bottom:5px;letter-spacing:0.5px;">공항 정보 (AIP)</div>` +
    li.map(x => `<div style="color:#cfe8dc;font-size:18px;line-height:1.6;margin-bottom:4px;">${x}</div>`).join('') + '</div>';
}

let _aptWxCtl = null;

async function showAptWx(icao, name, latlng) {
  if (_aptWxCtl) _aptWxCtl.abort();
  _aptWxCtl = new AbortController();
  const ctl = _aptWxCtl;

  const div = document.createElement('div');
  div.style.cssText = 'background:#0a1a0a;padding:10px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;';
  div.innerHTML = `<div style="color:#00ff88;font-size:15px;font-weight:bold;margin-bottom:6px;">${icao} — ${name}</div><div style="color:#888;font-size:13px;">조회 중...</div>`;

  const popup = L.popup({ maxWidth: 340, className: 'apt-wx-popup', closeButton: true, autoClose: false })
    .setLatLng(latlng).setContent(div).openOn(leafMap);

  const AMO_LINK = `<div style="margin-top:4px;font-size:12px;"><a href="https://global.amo.go.kr/observation/metar.do" target="_blank" style="color:#66aaff;">AMO METAR 조회</a></div>`;
  const sig = ctl.signal;

  try {
    let raw = '';
    try {
      raw = await raceValid(
        [_ivaoMetar(icao, sig), _vatsimMetar(icao, sig), _metarTafScrape(icao, sig)],
        v => typeof v === 'string' && v.length >= 8 && v.toUpperCase().includes(icao)
      );
    } catch { raw = ''; }
    if (ctl.signal.aborted) return;
    if (raw.length >= 8) {
      renderWxMetar(raw, div, icao);
    } else {
      div.innerHTML = `<div style="color:#00ff88;font-size:15px;font-weight:bold;">${icao} — ${name}</div><div style="color:#ff8800;font-size:13px;margin-top:4px;">METAR 없음</div>${AMO_LINK}`;
    }
    popup.update();
    // 공항 기본정보 섹션(차트탭 AIP TEXT에서 추출) — 비동기 로드 후 팝업에 덧붙임
    _getAptInfo(icao).then(info => {
      if (ctl.signal.aborted) return;
      const html = _aptInfoHtml(info);
      if (!html) return;
      const sec = document.createElement('div');
      sec.innerHTML = html;
      div.appendChild(sec);
      popup.update();
    }).catch(() => {});
  } catch (e) {
    if (ctl.signal.aborted) return;
    div.innerHTML = `<div style="color:#ff5544;font-size:13px;padding:4px;">${icao}: 조회 실패</div>`;
    popup.update();
  }
}

function initAirportLayer() {
  Object.entries(APT_LATLNG).forEach(([icao, latlng]) => {
    const name = APT_NAME[icao] || IFR_DB[icao]?.name || '';
    const icon = L.divIcon({
      html: `<div style="text-align:center;cursor:pointer;">
        <div style="width:14px;height:14px;background:#ffcc00;border:2px solid #000;margin:0 auto;transform:rotate(45deg);box-shadow:0 0 5px rgba(255,204,0,0.7);"></div>
        <div style="color:#ffcc00;font:bold 10px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;white-space:nowrap;margin-top:3px;text-shadow:1px 1px 2px #000,-1px -1px 2px #000;">${icao}</div>
      </div>`,
      iconSize: [52, 28], iconAnchor: [26, 8], className: ''
    });
    L.marker(latlng, { icon, title: `${icao} ${name}`, zIndexOffset: 200 })
      .bindPopup(() => {   // 열 때 생성: AIRFIELD_INFO·잠금해제 상태를 그 시점에 확인
        const extra = [{ label: '☁ METAR/TAF',
                         onclick: `mapAptWx('${icao}',${latlng[0]},${latlng[1]})`,
                         fg: '#0b6b8a', bg: '#e6f4f9' }];
        if (_aptInfoAvailable(icao))
          extra.push({ label: 'ℹ 공항 정보', onclick: `_mapOpenAirfield('${icao}')`,
                       fg: '#7a5b00', bg: '#fff6e0' });
        return _mapSymPopup({ title: `◆ ${icao}`, color: '#a86b00', name: icao,
                              lat: latlng[0], lon: latlng[1], sub: name, extra });
      }, { maxWidth: 300 })
      .on('click', (e) => L.DomEvent.stopPropagation(e))
      .addTo(leafMap);
  });
}
initAirportLayer();

// Populate WX panel quick-select buttons from the same WX_AIRPORTS source,
// keeping the map weather icons and the WX panel list in sync.
function initWxButtons() {
  const grid = document.getElementById('wx-ap-grid');
  if (!grid) return;
  grid.innerHTML = WX_AIRPORTS.map(a =>
    `<button class="wx-ap-btn" onclick="setWxIcao('${a.icao}',this)">${a.icao}<br>` +
    `<span style="color:#ffcc00;font-weight:normal;">${a.name}</span></button>`
  ).join('');
}
initWxButtons();

// ══════════════════════════════════════════════════════
// SID: AIP 등록 절차 + 사용자 정의 절차
// ══════════════════════════════════════════════════════
function customSids() {
  try { return JSON.parse(localStorage.getItem('customSids') || '{}'); } catch(e) { return {}; }
}
function saveCustomSids(o) {
  try { localStorage.setItem('customSids', JSON.stringify(o)); } catch(e) { _swallow(e); }
}
// 해당 공항의 SID 목록(AIP + 사용자). 표시 순서 = 인덱스
function allSids(icao) {
  const aip  = (IFR_DB[icao] && IFR_DB[icao].sids) || [];
  const user = customSids()[icao] || [];
  return aip.map(s => Object.assign({}, s, { _src: 'AIP' }))
     .concat(user.map((s, i) => Object.assign({}, s, { _src: 'USER', _ui: i })));
}
// AIP 공개 공항 목록(ICAO, 이름) — 사용자 SID는 모든 AIP 공항에서 만들 수 있다
function aipAirportList() {
  const out = [];
  try {
    AIRFIELD_INFO.forEach(a => {
      if (!a.pub || !a.code || a.code.length !== 2) return;
      out.push({ icao: 'RK' + a.code, name: a.name });
    });
  } catch(e) { _swallow(e); }
  Object.keys(IFR_DB).forEach(k => {
    if (!out.some(o => o.icao === k)) out.push({ icao: k, name: IFR_DB[k].name || '' });
  });
  return out.sort((a, b) => a.icao.localeCompare(b.icao));
}
// 절차 경유점 중 좌표를 해석하지 못한 이름 목록(입력 오류 검증용)
function procUnresolved(proc) {
  return (proc && proc.wps || []).filter(w => {
    if (IFR_FIXES[w.ident]) return false;
    return !(typeof w.lat === 'number' && typeof w.lon === 'number' && !isNaN(w.lat));
  }).map(w => w.ident);
}
// 경유점 좌표 해석(픽스 DB 우선)
function _resolveWp(w) {
  const f = IFR_FIXES[w.ident];
  if (f) return { ident: w.ident, lat: f.lat, lon: f.lon, arc: w.arc };
  return { ident: w.ident, lat: w.lat, lon: w.lon, arc: w.arc };
}

function loadSids() {
  const icao = document.getElementById('dep-icao').value;
  const sel  = document.getElementById('dep-sid');
  const rwyEl = document.getElementById('dep-rwy');
  if (!sel) return;
  const list = allSids(icao);

  // ── RWY 필터 옵션 채우기(현재 선택 유지) ──
  if (rwyEl) {
    const cur = rwyEl.value;
    const rwys = [];
    list.forEach(s => String(s.rwy || '').split('/').forEach(r => {
      r = r.trim(); if (r && !rwys.includes(r)) rwys.push(r);
    }));
    rwys.sort();
    rwyEl.innerHTML = '<option value="">전체</option>' +
      rwys.map(r => `<option value="${r}">${r}</option>`).join('');
    if (rwys.includes(cur)) rwyEl.value = cur;
  }
  const rwyF = rwyEl ? rwyEl.value : '';

  sel.innerHTML = '';
  list.forEach((sid, i) => {
    if (rwyF && !String(sid.rwy || '').split('/').map(x => x.trim()).includes(rwyF)) return;
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = (sid._src === 'USER' ? '★ ' : '') + sid.name + ' (' + (sid.rwy || '-') + ')';
    sel.appendChild(opt);
  });
  if (!sel.options.length) sel.innerHTML = '<option value="">— 해당 RWY 절차 없음 —</option>';
  onSidSelect();
}

// SID 선택 시: 경유점·검증 결과 표시 + 지도 미리보기 갱신
function onSidSelect() {
  const icao = document.getElementById('dep-icao')?.value;
  const sel  = document.getElementById('dep-sid');
  const box  = document.getElementById('sid-detail');
  if (!box) return;
  const sid = (sel && sel.value !== '') ? allSids(icao)[parseInt(sel.value)] : null;
  if (!sid) { box.innerHTML = ''; clearProcPreview(); return; }
  const bad = procUnresolved(sid);
  const chain = (sid.wps || []).map(w => {
    const ok = !bad.includes(w.ident);
    return `<span style="color:${ok ? '#9fe6c0' : '#ff8a65'};font-weight:bold;">${w.ident}${ok ? '' : ' ⚠'}</span>`;
  }).join('<span style="color:#456;"> › </span>');
  box.innerHTML =
    `<div style="border:1px solid #1e3a2a;border-radius:4px;background:#08140e;padding:5px 7px;margin:4px 0;">` +
      `<div style="color:#6a8494;font-size:8px;letter-spacing:0.5px;margin-bottom:3px;">` +
        `${sid._src === 'USER' ? '★ 사용자 절차' : 'AIP 절차'} · ${(sid.wps || []).length}개 경유점</div>` +
      `<div style="font-size:10px;line-height:1.6;">${chain || '—'}</div>` +
      (bad.length
        ? `<div style="color:#ff8a65;font-size:9px;margin-top:4px;">⚠ 좌표 미해석: ${bad.join(', ')} — 픽스 DB에 없는 이름입니다.</div>`
        : '') +
    `</div>`;
  procPreview((sid.wps || []).map(_resolveWp));
}

// ── 절차 지도 미리보기 ──
let _procPreviewLayer = null;
function clearProcPreview() {
  if (_procPreviewLayer) { try { leafMap.removeLayer(_procPreviewLayer); } catch(e) { _swallow(e); } _procPreviewLayer = null; }
}
function procPreview(wps) {
  clearProcPreview();
  const pts = (wps || []).filter(w => typeof w.lat === 'number' && !isNaN(w.lat)).map(w => [w.lat, w.lon]);
  if (!pts.length) return;
  const g = L.layerGroup();
  if (pts.length > 1) {
    L.polyline(pts, { color:'#ffd54f', weight:2.5, opacity:0.95, dashArray:'8 5', interactive:false }).addTo(g);
  }
  wps.filter(w => typeof w.lat === 'number' && !isNaN(w.lat)).forEach((w, i) => {
    L.circleMarker([w.lat, w.lon], { radius:4, color:'#ffd54f', weight:2, fillColor:'#000', fillOpacity:1, interactive:false }).addTo(g);
    L.marker([w.lat, w.lon], { interactive:false, icon: L.divIcon({ className:'', iconSize:[0,0],
      html:`<div style="transform:translate(7px,-15px);color:#ffd54f;font-size:9px;font-weight:bold;white-space:nowrap;text-shadow:1px 1px 2px #000;">${i+1}. ${w.ident}</div>` }) }).addTo(g);
  });
  _procPreviewLayer = g.addTo(leafMap);
}
// 미리보기를 지도 화면으로 열고 범위 맞추기
function sidShowOnMap() {
  if (!_procPreviewLayer) return;
  try {
    const b = L.latLngBounds([]);
    _procPreviewLayer.eachLayer(l => { if (l.getLatLng) b.extend(l.getLatLng()); });
    cduOpenMap();
    setTimeout(() => { try { leafMap.invalidateSize(); if (b.isValid()) leafMap.fitBounds(b, { padding:[45,45] }); } catch(e) { _swallow(e); } }, 120);
  } catch(e) { _swallow(e); }
}

function addSidWps() {
  const icao   = document.getElementById('dep-icao').value;
  const selEl  = document.getElementById('dep-sid');
  const sidIdx = parseInt(selEl && selEl.value);
  if (isNaN(sidIdx)) return;
  const sid = allSids(icao)[sidIdx];
  if (!sid) return;
  const mode = document.getElementById('dep-mode')?.value || 'append';
  if (mode === 'replace') clearFP();
  const ap = AIRPORTS.find(a => a.ident === icao);
  if (ap && S.wps.length === 0) pushWP({ident:ap.ident, lat:ap.lat, lon:ap.lon}, 'DEP');
  (sid.wps || []).forEach(wp => {
    const r = _resolveWp(wp);
    if (typeof r.lat !== 'number' || isNaN(r.lat)) return;   // 좌표 미해석 경유점은 제외
    pushWP({ident:r.ident, lat:r.lat, lon:r.lon, arc:r.arc}, 'DEP');
  });
  clearProcPreview();
  fpGo('LIST');
}

// 사용자 SID 삭제
function deleteUserSid() {
  const icao = document.getElementById('dep-icao').value;
  const sel  = document.getElementById('dep-sid');
  const sid  = (sel && sel.value !== '') ? allSids(icao)[parseInt(sel.value)] : null;
  if (!sid || sid._src !== 'USER') { alert('사용자가 만든 절차만 삭제할 수 있습니다.'); return; }
  if (!confirm(`사용자 절차 "${sid.name}" 을(를) 삭제할까요?`)) return;
  const all = customSids();
  (all[icao] || []).splice(sid._ui, 1);
  saveCustomSids(all);
  loadSids();
}

function loadAirwayFixes() {
  const awy    = document.getElementById('enr-airway').value;
  const fixes  = IFR_AIRWAYS[awy];
  const entryEl = document.getElementById('enr-entry');
  const exitEl  = document.getElementById('enr-exit');
  entryEl.innerHTML = ''; exitEl.innerHTML = '';
  if (!fixes) return;
  fixes.forEach(f => {
    const o1 = document.createElement('option'); o1.value = f; o1.textContent = f; entryEl.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = f; o2.textContent = f; exitEl.appendChild(o2);
  });
  if (fixes.length > 1) exitEl.selectedIndex = fixes.length - 1;
}

function addAirwaySegment() {
  const awy   = document.getElementById('enr-airway').value;
  const fixes = IFR_AIRWAYS[awy];
  const entry = document.getElementById('enr-entry').value;
  const exit  = document.getElementById('enr-exit').value;
  if (!fixes) return;
  const i1 = fixes.indexOf(entry), i2 = fixes.indexOf(exit);
  if (i1 < 0 || i2 < 0 || i1 >= i2) return;
  for (let i = i1; i <= i2; i++) {
    const f = fixes[i], fix = IFR_FIXES[f];
    if (fix) pushWP({ident:f, lat:fix.lat, lon:fix.lon}, 'ENR');
  }
  fpGo('LIST');
}

function addSingleFix() {
  const f   = document.getElementById('enr-fix').value;
  const fix = IFR_FIXES[f];
  if (fix) { pushWP({ident:f, lat:fix.lat, lon:fix.lon}, 'ENR'); fpGo('LIST'); }
}

function loadStars() {
  const icao = document.getElementById('app-icao').value;
  const sel  = document.getElementById('app-star');
  if (!sel) return;
  sel.innerHTML = '';
  const db = IFR_DB[icao];
  if (!db || !db.stars || db.stars.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '(없음)';
    sel.appendChild(opt);
    return;
  }
  db.stars.forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = s.name + ' (' + s.rwy + ')';
    sel.appendChild(opt);
  });
}

function addStarWps() {
  const icao = document.getElementById('app-icao').value;
  const idx  = parseInt(document.getElementById('app-star').value);
  const db   = IFR_DB[icao];
  if (!db || !db.stars || isNaN(idx)) return;
  const star = db.stars[idx];
  if (!star) return;
  star.wps.forEach(wp => pushWP({ident:wp.ident, lat:wp.lat, lon:wp.lon, arc:wp.arc}, 'APP'));
  fpGo('LIST');
}

function loadApproaches() {
  const icao = document.getElementById('app-icao').value;
  const sel  = document.getElementById('app-proc');
  if (!sel) return;
  sel.innerHTML = '';
  const db = IFR_DB[icao];
  if (!db) return;
  db.approaches.forEach((ap, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = ap.name;
    sel.appendChild(opt);
  });
}

function addAppWps() {
  const icao = document.getElementById('app-icao').value;
  const idx  = parseInt(document.getElementById('app-proc').value);
  const db   = IFR_DB[icao];
  if (!db || isNaN(idx)) return;
  const app = db.approaches[idx];
  if (!app) return;
  app.wps.forEach(wp => pushWP({ident:wp.ident, lat:wp.lat, lon:wp.lon, arc:wp.arc}, 'APP'));
  fpGo('LIST');
}

// ── 시작 안내 오버레이 ──
// 안내 내용이 크게 바뀌면 이 버전을 올린다 → '다시 보지 않기'를 했어도 한 번 더 표시
const HELP_VERSION = '2';
function closeHelp() {
  if (document.getElementById('help-dontshow')?.checked) {
    try { localStorage.setItem('helpDismissed', HELP_VERSION); } catch(e) { _swallow(e); }
  }
  document.getElementById('help-overlay').style.display = 'none';
}
function showHelpOnLaunch() {
  let dismissed = null;
  try { dismissed = localStorage.getItem('helpDismissed'); } catch(e) { _swallow(e); }
  if (dismissed !== HELP_VERSION) document.getElementById('help-overlay').style.display = 'flex';
}

