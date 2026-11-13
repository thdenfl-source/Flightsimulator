# Flightsimulator — Claude 작업 지침

## 저장소 구분 (요청을 받으면 먼저 확인)
사용자는 두 저장소를 목적별로 나눠 쓴다. 요청이 **어느 저장소의 일인지 먼저 가린다.**

| 저장소 | 목적 | 해당 작업 예 |
|---|---|---|
| **thdenfl-source/Flightsimulator** (이 저장소) | **절차 훈련** | AIP 절차·공항 자료, CDU·FPL, HOVER PAGE, SHIP 접근 훈련 등 |
| **thdenfl-source/shinesong** | **모든 걸 합친 종합 시뮬레이터** | 조이스틱 직접 조종(SIM 모드), 비행 모델(토크·NR), 3D 조종석 시야·CHIN BUBBLE, 함정 착함 등 |

- 이 저장소는 **shinesong 의 사본**이다 — 같은 파일을 쓰고, 판(js/00-edition.js)만 절차 훈련판으로 돌아 SIM 모드가 없다.
- 요청한 기능이 이 저장소에 없으면 shinesong 에 있는지 확인하고 그쪽에서 작업한다
  (사용자가 저장소를 잘못 짚어 말하는 일이 있다).
- **이 저장소의 앱 파일은 직접 고치지 않는다.** shinesong 에서 고친 뒤 이리로 복사한다(아래).

## 두 저장소는 같은 코드다 — shinesong 에서만 고친다
- 앱 파일(js · index.html · sw.js · tests · data · vendor · 그림)은 **두 저장소가 같다.** 판(edition)만 다르다:
  `js/00-edition.js` 가 주소에 `flightsimulator` 가 들어 있으면 **절차 훈련판(proc)** — SIM 모드를 켤 수 없고
  SIM 조작 버튼(3D 창 SIM · 회전익 특성 · ASE · 엔진 · SOUND · STICK · GYRO, 지도 창 SIM, PFD 소프트키 SIM)을 감춘다.
  그 밖(PFD · FCP · CDU · 지도 · 3D · 상부/하부 콘솔 · SYSTEM 창 · 무전기 · 연료 · AFCS)은 모두 같다.
- **고칠 일은 shinesong 에서 한다.** 끝나면 Flightsimulator 로 그대로 복사해 PR 을 하나 더 올린다
  (`.git` · `.github` · `.nojekyll` · `.gitignore` · `CLAUDE.md` · `node_modules` 만 그 저장소 것을 둔다).
- SIM 기능은 SIM 파일(14-simmode · 15-heli3d · 16-sound) 안에 두고, 다른 파일에서 부를 때는 '있으면 부른다'로 짠다.
  SIM 에서만 쓰는 새 버튼은 `index.html` 의 `html.ed-proc …{ display:none }` 목록에 넣는다.
- 검사: Flightsimulator 경로(또는 `EDITION=proc`)에서는 SIM 을 켜는 검사 파일(toggleSimMode(true) · SIM_SETUP ·
  simModeOn = true)을 건너뛴다. 절차 훈련판을 shinesong 에서 미리 보려면 `EDITION=proc node tests/run.mjs` · 주소 `?edition=proc`.

## 항상 따를 규칙

### 작업 단위 완료 시 Push + PR 생성
**하나의 작업 단위(기능/수정 요청)가 끝났을 때** 아래 순서를 실행한다:

1. 변경 파일을 `git add` → `git commit` (의미 있는 단위로 커밋)
2. `git push -u origin claude/keen-darwin-9c4ek`
3. GitHub MCP(`mcp__github__create_pull_request`)로 PR 생성
   - owner: `thdenfl-source`
   - repo: `Flightsimulator`
   - head: `claude/keen-darwin-9c4ek`
   - base: `main`
4. **PR 머지는 사용자가 직접 GitHub에서 수행한다. Claude는 절대 머지하지 않는다.**
   - 사용자가 GitHub에서 머지 → Actions 정상 트리거 → GitHub Pages 배포
   - Claude가 API로 머지하면 Actions가 트리거되지 않아 사이트에 미반영됨

#### PR 분할 기준 (남발 방지)
- **한 작업 요청 = 1 PR** 을 원칙으로 한다. 같은 요청에 대한 후속 미세 수정
  (오타·색상·굵기 조정 등)은 **새 PR을 만들지 말고 같은 브랜치에 커밋을 추가**한다.
- 직전 PR이 아직 머지되지 않았다면, 이어지는 수정은 그 PR에 커밋을 쌓는다.
- 서로 무관한 별개 기능일 때만 새 PR로 분리한다.

#### 후속 커밋 주의 (반영 누락 방지)
- 새 커밋을 푸시하기 전, **직전 PR이 이미 머지·종료됐는지 먼저 확인**한다.
  머지됐으면 **반드시 새 PR을 만든다.** (브랜치에만 쌓으면 main에 안 들어감)

### 캐시 버전 · 검사
- 캐시 번호(`sw.js` CACHE · `index.html` `?v=`)는 shinesong 과 같은 번호를 그대로 가져온다(복사본이므로).
- 검사는 `node tests/run.mjs` — 이 경로에서는 절차 훈련판으로 돌고 SIM 검사 파일은 건너뛴다.
