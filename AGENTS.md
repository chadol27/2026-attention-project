## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: tailwindcss

---

Plans: PLANS.md
To-dos: TODOS.md

## Documentation Rules

- 사용자가 구현, 수정, 추가를 요청한 사항은 코드 변경과 함께 `PLANS.md`에도 반영한다.
- `PLANS.md`에는 해당 기능의 범위, 사용자 흐름, 데이터/API 계약, 구현 상태를 최신 상태로 유지한다.
- 작업 완료 시 `TODOS.md`의 관련 항목도 함께 갱신한다.

## Git Workflow

- 사용자가 요청한 변경사항은 검증이 통과하면 별도 확인을 기다리지 않고 관련 파일만 자동으로 커밋한다.
- 커밋 전 `git status`, `git diff`, `git log --oneline -10`으로 변경 범위를 확인하고, 의도한 파일만 스테이징한다.
