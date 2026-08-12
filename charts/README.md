# 공용 차트 — 저장소에서 가져오기

이 폴더에 차트 파일을 넣고 `index.json` 에 목록을 등록하면,
웹앱의 **CDU → CHART → ☁ 저장소** 버튼에서 한 번에 가져올 수 있습니다.

## 왜 필요한가

차트 가져오기는 브라우저의 IndexedDB 에 저장되고, **그것은 기기·브라우저마다
따로**입니다. 폰에서 AIRAC ZIP 을 넣었어도 태블릿 브라우저에는 하나도 없어서,
기기를 바꿀 때마다 원본 ZIP 을 찾아 다시 넣어야 했습니다.

외부 eAIP 에서 앱이 직접 받아오는 방법도 시도하지만 대개 CORS 로 막힙니다.
저장소에 올려 두면 **같은 출처**라 막히지 않고, 새 기기에서도 버튼 한 번이면
끝납니다.

## 사용 방법

1. 이 `charts/` 폴더에 파일을 커밋합니다. 두 가지 형태를 지원합니다.
   - **AIRAC ZIP 통째로** — AIM Korea 에서 받은 ZIP 을 그대로 올립니다.
   - **PDF 낱장** — 필요한 차트만 골라 올립니다.
2. `charts/index.json` 에 목록을 추가합니다.

```json
[
  { "file": "RKSI-2601.zip", "name": "인천 AIRAC 2601" },
  { "file": "RKTU/(1) AD CHART.pdf", "icao": "RKTU", "num": "1", "name": "AD CHART", "cat": "AD" }
]
```

### 필드 설명
| 필드 | 필수 | 설명 |
|---|---|---|
| `file` | ✅ | `charts/` 안의 파일 경로. `.zip` 이면 압축을 풀어 안의 차트 PDF 를 모두 가져옵니다 |
| `name` | 선택 | 앱 목록에 보일 이름(없으면 파일명) |
| `icao` | ZIP 은 선택 | 공항 4코드. PDF 낱장인데 경로에서 못 찾으면 필수 |
| `num` | ZIP 은 선택 | 차트 번호. PDF 낱장인데 경로에서 못 찾으면 필수 |
| `cat` | 선택 | 분류(`AD` · `SID` · `STAR` · `IAP` 등) |

ZIP 안의 경로가 `.../AD/<ICAO4>/(번호) 차트명.pdf` 형태면 공항·번호·이름을
자동으로 알아냅니다. AIM Korea 패키지가 이 형태입니다.

## ⚠ 올리기 전에 확인할 것

**이 저장소는 공개(public)입니다.** 여기에 올린 파일은 인터넷의 누구나 받을 수
있습니다. 올리기 전에 반드시 확인하세요.

- AIP 차트의 **재배포가 허용되는지**(저작권·이용약관)
- **군 관련 자료가 섞여 있지 않은지**. AIP 공개 자료만 올립니다.
- ZIP 을 통째로 올릴 때는 그 안에 무엇이 들었는지 먼저 열어 봅니다.

판단이 서지 않으면 올리지 말고, 기기마다 [ZIP 가져오기]로 넣는 방식을
그대로 쓰시면 됩니다. 앱 기능은 어느 쪽이든 똑같이 동작합니다.

---

# 차트 중계 (권장) — 파일을 올리지 않고 모든 공항 받기

위 방식은 차트를 이 저장소에 **올려야** 합니다. GitHub 은 웹 업로드 25MB,
Pages 사이트 1GB 한도가 있어 전국 차트를 다 올리기 어렵고, AIRAC 주기(28일)마다
다시 올려야 합니다.

중계를 하나 두면 그 일이 통째로 없어집니다.

## 왜 중계가 필요한가

eAIP(aim.koca.go.kr)는 **CORS 를 허용하지 않습니다.** 앱에서 [🔌 eAIP 연결 점검]
을 눌러 확인한 결과입니다. 브라우저 주소창으로 직접 열면 보이지만, 앱이 `fetch`
로 받아오는 것은 브라우저가 막습니다. 남의 서버라 우리가 어쩔 수 없습니다.

중계는 그 사이에 서는 아주 작은 프로그램입니다. eAIP 에서 받아 **CORS 헤더를
붙여** 돌려주기만 합니다. 그러면 앱이 여느 파일처럼 받을 수 있습니다.

```
앱 → 중계 → eAIP → 중계(+CORS 헤더) → 앱
```

## 만드는 방법 (Cloudflare Workers · 무료 · 10분)

1. https://dash.cloudflare.com 가입 후 **Workers & Pages → Create → Worker**
2. 이름을 정하고 **Deploy**, 그다음 **Edit code**
3. 편집기 내용을 전부 지우고 아래를 붙여 넣은 뒤 **Deploy**

```js
export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': '*',
      }});
    }
    const target = new URL(req.url).searchParams.get('u');
    // eAIP 만 중계한다 — 아무 주소나 받아 주면 공개 프록시가 되어 버린다
    if (!target || !target.startsWith('https://aim.koca.go.kr/')) {
      return new Response('eAIP 주소만 중계합니다', { status: 400 });
    }
    const r = await fetch(target, { headers: { 'user-agent': req.headers.get('user-agent') || '' } });
    const h = new Headers();
    h.set('access-control-allow-origin', '*');
    h.set('content-type', r.headers.get('content-type') || 'application/octet-stream');
    h.set('cache-control', 'public, max-age=86400');
    return new Response(r.body, { status: r.status, headers: h });
  },
};
```

4. 배포되면 주소가 나옵니다. 예: `https://eaip-relay.<계정>.workers.dev`
5. 앱에서 **CDU → CHART → 📡 중계** 를 눌러 그 주소를 붙여 넣습니다
6. **🔌 eAIP 연결 점검** 을 눌러 `✅ 중계를 통해 받아올 수 있습니다` 가 뜨면 끝입니다

이제 차트를 누르면 공식 사이트에서 받아와 앱 안에서 열리고, 그 기기에 저장돼
다음부터는 즉시 열립니다. AIRAC 주기가 바뀌어도 주소를 앱이 계산하므로
할 일이 없습니다.

## 알아 둘 것

- **트래픽이 그 계정을 거칩니다.** 무료 한도는 하루 10만 요청이라 개인 사용에는
  넉넉합니다.
- 위 코드는 `aim.koca.go.kr` 외의 주소를 거부합니다. 이 줄을 지우면 누구나 쓸 수
  있는 공개 프록시가 되니 **그대로 두세요.**
- 원본 사이트 이용약관에 자동 수집·중계 제한이 있는지 확인해 보시는 게 좋습니다.
- 중계를 비워 두면 앱은 종전과 똑같이 동작합니다(차트를 누르면 새 탭 안내).
