# Flightsimulator — Claude 작업 지침

## 항상 따를 규칙

### 작업 단위 완료 시 Push + PR 생성 + 머지
**하나의 작업 단위(기능/수정 요청)가 끝났을 때** 아래 순서를 실행한다:

1. 변경 파일을 `git add` → `git commit` (의미 있는 단위로 커밋)
2. `git push -u origin claude/keen-darwin-9c4ek`
3. GitHub MCP(`mcp__github__create_pull_request`)로 PR 생성
   - owner: `thdenfl-source`
   - repo: `Flightsimulator`
   - head: `claude/keen-darwin-9c4ek`
   - base: `main`
4. **`mcp__github__merge_pull_request`로 그 PR을 즉시 main에 머지**한다 (squash).
   - GitHub Pages는 `main`만 배포하므로, 머지해야 실제 사이트에 반영된다.
   - 머지 후 사용자에게 "머지 완료 → 사이트 반영됨"을 알린다.

#### 후속 커밋 주의 (반영 누락 방지)
- 새 커밋을 푸시하기 전, **직전 PR이 이미 머지·종료됐는지 먼저 확인**한다.
  머지됐으면 **반드시 새 PR을 만들어 머지**한다. (브랜치에만 쌓으면 main에 안 들어감)

#### PR 분할 기준 (남발 방지)
- **한 작업 요청 = 1 PR** 을 원칙으로 한다. 같은 요청에 대한 후속 미세 수정
  (오타·색상·굵기 조정 등)은 **새 PR을 만들지 말고 같은 브랜치에 커밋을 추가**한다.
- 직전 PR이 아직 머지되지 않았다면, 이어지는 수정은 그 PR에 커밋을 쌓는다.
- 서로 무관한 별개 기능일 때만 새 PR로 분리한다.

push 자체는 작업이 끝날 때마다 수행해도 되지만, PR은 위 기준에 따라 신중히 생성한다.
