# 과의존 방지 AI 서비스 MVP 계획

## 현재 상태

- 1단계 기본 AI 채팅: 완료
- 2단계 과의존 방지 기능: 완료
- 3단계 UI/UX 다듬기: 예정
- AI 답변의 문단과 줄바꿈 표시: 반영

### 검증 상태

- `pnpm lint`, `pnpm check`, `pnpm build`: 통과
- Node 프로덕션 서버 기동 및 기본 화면/API 응답: 확인
- 채팅 목록/상세 재조회와 JSON 저장: 확인
- 정보형/의사결정형 과제 생성: 확인
- 과제 실패 재제출 및 통과 저장: 확인
- 모바일 브라우저 흐름과 잘못된 AI JSON 재시도: 미확인

## 목표

프로그램 이름은 `과의존 방지 AI`로 통일한다.

완벽한 서비스가 아니라 로컬에서 실제로 사용할 수 있는 최소 기능을 만든다.
먼저 일반 AI 채팅을 완성하고, 그 위에 사용자의 직접 사고를 유도하는 과제 기능을 추가한다.

## 고정 범위

- SvelteKit, TypeScript, Tailwind CSS, JSON, OpenAI 공식 SDK 사용
- 패키지 매니저는 `pnpm`
- 로컬 단일 사용자 서비스로만 지원하며 인증은 넣지 않는다.
- OpenAI 호출은 서버에서만 수행한다.
- `OPENAI_API_KEY`와 `OPENAI_MODEL`을 환경변수로 사용한다. 둘 중 하나라도 없으면 오류를 표시한다.
- 비스트리밍 응답을 사용하고 AI 응답이 완료된 뒤에만 대화 파일을 저장한다.
- 전체 UI는 다크모드 단일 테마로 만들고, 컨트롤과 상태에 필요한 텍스트만 표시한다.
- `/` 단일 화면에서 좌측 채팅 목록과 우측 대화/과제 영역을 전환한다.

## 1단계: 사용 가능한 AI 채팅

### 사용자 흐름

1. `/` 진입 시 저장된 채팅 목록과 새 채팅 버튼을 표시한다.
2. 사용자가 질문을 보내면 첫 질문 전송 시 채팅 ID와 JSON 파일을 생성한다.
3. 서버가 저장된 전체 메시지와 새 질문을 OpenAI에 전달한다.
4. 완료된 AI 답변을 화면에 표시하고 채팅 JSON과 `list.json`을 갱신한다.
5. 목록에서 채팅을 선택하면 해당 파일을 읽어 기존 대화를 재개한다.
6. API 키, 모델 설정, OpenAI 응답 또는 파일 처리 오류는 사용자에게 오류와 재시도 동작으로 표시한다.

### 저장 구조

```text
chats/
  list.json
  YYYYMMDD-HHmmss-<chat-id>.json
```

`chats/list.json`은 다음 배열을 저장한다.

```ts
type ChatListItem = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	fileName: string;
};
```

개별 채팅 파일은 다음 구조를 사용한다.

```ts
type Chat = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messages: Message[];
};

type Message = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	createdAt: string;
	tasks?: Task[];
};
```

- ID는 `crypto.randomUUID()`로 생성한다.
- 날짜는 UTC ISO 문자열을 사용한다.
- 파일명은 UTC 시각과 ID를 결합해 같은 초의 충돌을 피한다.
- 제목은 첫 질문의 앞 40자를 공백 정리 후 사용한다.
- 목록은 `updatedAt` 내림차순으로 표시한다.
- 빈 목록에서는 긴 안내 문구 대신 새 채팅 컨트롤만 표시한다.

## 2단계: 과의존 방지 기능

### AI 응답 계약

매 요청마다 AI가 단일 JSON을 반환하도록 시스템 프롬프트와 응답 형식을 고정한다.

```ts
type RequestType = 'information' | 'generation' | 'decision' | 'problemSolving' | 'other';

type AssistantResult = {
	answer: string;
	requestType: RequestType;
	requestedDirectAnswer: boolean;
	shouldCreateTask: boolean;
	task?: {
		title: string;
		prompt: string;
		evaluationCriteria: string[];
	};
};
```

서버는 JSON 파싱과 필수 필드, 허용 enum만 검증한다. 검증 실패 시 일반 텍스트로 대체하지 않고 오류와 재시도를 제공한다.

### 요청별 응답과 과제

- 정보 검색, 질의응답, 학습: 답변 뒤 `검증하기`, `요약하기`, `자신만의 언어로 다시 설명하기` 중 하나를 서버에서 무작위 선택해 과제를 만든다.
- 판단 요청, 의사결정 지원: 특정 선택지를 추천하지 않고 선택지를 제시한다. 사용자가 직접 판단하고 근거를 2개 이상 작성하는 과제를 만든다.
- 글/코드 생성: 전체 결과를 작성하지 않고 개요, 일부, 팁만 제공한다. 과제는 만들지 않는다.
- 문제 해결: 기본적으로 정답 대신 해결 힌트만 제공한다. 사용자가 명시적으로 요청하면 정답을 제공할 수 있다. 과제는 만들지 않는다.
- 사용자가 정답 또는 전체 작성을 명시적으로 재요청하면 `requestedDirectAnswer`를 기준으로 제한을 완화한다.
- 답변, 과제, 평가 피드백은 사용자 입력 언어를 따른다.

### 과제 상태와 흐름

```ts
type Task = {
	id: string;
	title: string;
	prompt: string;
	evaluationCriteria: string[];
	status: 'pending' | 'passed';
	submissions: Submission[];
};

type Submission = {
	id: string;
	content: string;
	passed: boolean;
	feedback: string;
	createdAt: string;
};
```

1. 과제가 있는 AI 답변 아래에 과제 목록, 상태, 열기 컨트롤을 표시한다.
2. 과제가 있는 답변을 받으면 과제 화면을 자동으로 연다.
3. 대화 목록에서 기존 채팅을 열면 항상 원래 대화 화면에서 시작한다.
4. 과제는 원래 답변에 연결된 `tasks` 배열로 같은 채팅 JSON에 저장한다.
5. 과제 스레드에는 연결된 질문과 AI 답변을 함께 표시한다.
6. 과제 화면 상단 왼쪽에 `원래 대화로 돌아가기`를 표시한다.
7. 과제 스레드의 제출 입력창 위에 별도의 버튼 형태인 `과제 넘어가기`를 표시하고, 제출 내용을 입력하면 숨긴다. 버튼을 누르면 원래 대화로 돌아간다.
8. 대화에서 과제로 들어가는 버튼은 미완료 상태를 주황색, 통과 상태를 초록색으로 구분한다.
9. 제출은 텍스트 입력 하나로 처리하며 `Enter`로 제출하고 `Shift + Enter`로 줄바꿈한다.
10. 평가 요청에는 원래 AI 답변, 과제 기준, 사용자의 제출문만 포함한다.
11. 평가 결과는 통과 여부와 짧은 피드백만 반환한다.
12. 실패하면 과제 화면을 유지하고 재제출할 수 있다.
13. 통과하면 `passed`로 저장하고 원래 대화로 돌아간다.
14. 제출 내역과 평가 결과는 모두 저장한다.

## API 경계

- 채팅 목록 조회, 채팅 상세 조회, 새 채팅 로딩
- 메시지 전송 및 AI 응답 생성
- 과제 제출 및 AI 평가

API 키와 OpenAI 호출은 서버 전용 모듈에 둔다. 클라이언트에는 키를 전달하지 않는다.

## 구현 원칙

- 기능별 최소 파일과 최소 상태만 사용한다.
- 별도 데이터베이스, 인증, 전역 상태 라이브러리를 추가하지 않는다.
- 빈 채팅은 저장하지 않는다.
- 삭제, 제목 수정, 검색, 페이지네이션, 로그인, 스트리밍은 MVP 이후로 미룬다.
- UI 장식, 온보딩, 장문 설명, 유형별 입력 컴포넌트, 점수형 평가를 만들지 않는다.

## 완료 기준

- 새 질문과 AI 답변이 로컬에서 동작한다.
- 채팅이 `chats/` 아래 JSON으로 저장되고 목록에서 다시 열린다.
- 정보/학습 및 판단 요청에서만 과제가 생성된다.
- 과제 제출, 실패 재시도, 통과 후 원래 대화 복귀가 동작한다.
- `pnpm check`와 `pnpm build`가 통과한다.
- 새 채팅, 저장/재조회, 과제 생성, 평가, 재시도, 복귀를 수동으로 확인한다.
