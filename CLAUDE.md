# Flightsimulator — Claude 작업 지침

## 항상 따를 규칙

### 코드 수정 시 자동 Push + PR 생성
코드를 수정할 때마다 **반드시** 아래 순서를 자동으로 실행한다:

1. 변경 파일을 `git add` → `git commit`
2. `git push -u origin claude/keen-darwin-9c4ek`
3. GitHub MCP(`mcp__github__create_pull_request`)로 PR 자동 생성
   - owner: `thdenfl-source`
   - repo: `Flightsimulator`
   - head: `claude/keen-darwin-9c4ek`
   - base: `main`

사용자가 "PR 생성해줘"라고 별도로 요청하지 않아도, 코드 개선·수정이 완료될 때마다 push와 PR을 자동으로 수행한다.
