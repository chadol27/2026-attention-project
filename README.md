# 과의존 방지 AI

로컬 단일 사용자를 위한 SvelteKit AI 채팅 MVP입니다.

## 실행

```sh
pnpm install
cp .env.example .env
pnpm dev --open
```

`.env`에 `OPENAI_API_KEY`와 `OPENAI_MODEL`을 설정해야 질문을 보낼 수 있습니다.

## 검증

```sh
pnpm lint
pnpm check
pnpm build
```

채팅은 실행 중 프로젝트의 `chats/` 디렉터리에 JSON으로 저장됩니다.

## Node 배포

```sh
pnpm install --prod=false
pnpm build
pnpm start
```

Node 서버는 기본적으로 `0.0.0.0:3000`에서 실행됩니다. `PORT` 환경변수로 포트를 변경할 수 있습니다.
