<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Chat, ChatListItem, Task } from '$lib/types';

	let chats = $state<ChatListItem[]>([]);
	let activeChat = $state<Chat | null>(null);
	let input = $state('');
	let pendingMessage = $state<string | null>(null);
	let loading = $state(false);
	let chatsLoading = $state(true);
	let chatLoading = $state(false);
	let errorMessage = $state('');
	let activeTask = $state<Task | null>(null);
	let taskInput = $state('');
	let taskLoading = $state(false);
	let mobileView = $state<'list' | 'chat'>('list');
	let messagesContainer = $state<HTMLDivElement>();
	let taskContext = $derived(
		activeChat?.messages.find((message) =>
			message.tasks?.some((task) => task.id === activeTask?.id)
		)
	);

	$effect(() => {
		activeChat?.messages.length;
		pendingMessage;
		activeTask?.id;
		loading;
		taskLoading;
		chatLoading;
		void scrollToBottom();
	});

	onMount(loadChats);

	async function loadChats() {
		chatsLoading = true;
		try {
			const response = await fetch('/api/chats');
			if (response.ok) chats = await response.json();
		} finally {
			chatsLoading = false;
		}
	}

	function newChat() {
		activeChat = null;
		pendingMessage = null;
		activeTask = null;
		errorMessage = '';
		mobileView = 'chat';
	}

	function showChatList() {
		mobileView = 'list';
	}

	async function openChat(id: string) {
		pendingMessage = null;
		chatLoading = true;
		errorMessage = '';
		try {
			const response = await fetch(`/api/chats/${id}`);
			if (response.ok) {
				activeChat = await response.json();
				activeTask = null;
				mobileView = 'chat';
			} else {
				errorMessage = '대화를 불러오지 못했습니다.';
			}
		} finally {
			chatLoading = false;
		}
	}

	function openTask(task: Task) {
		activeTask = task;
		taskInput = '';
		errorMessage = '';
	}

	function returnToChat() {
		activeTask = null;
		taskInput = '';
		errorMessage = '';
	}

	function formatChatDate(date: string) {
		return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
			new Date(date)
		);
	}

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	async function submitTask() {
		if (!activeChat || !activeTask || !taskInput.trim() || taskLoading) return;
		const content = taskInput.trim();
		taskLoading = true;
		errorMessage = '';
		const response = await fetch(`/api/chats/${activeChat.id}/tasks/${activeTask.id}/submissions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content })
		});
		if (response.ok) {
			const body = await response.json();
			activeChat = body.chat;
			activeTask = body.task;
			taskInput = '';
			if (body.submission.passed) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				activeTask = null;
			}
		} else {
			const body = await response.json().catch(() => null);
			errorMessage = body?.message ?? '평가에 실패했습니다.';
		}
		taskLoading = false;
	}

	async function sendMessage() {
		if (!input.trim() || loading) return;
		const content = input.trim();
		input = '';
		pendingMessage = content;
		loading = true;
		errorMessage = '';
		const id = activeChat?.id ?? crypto.randomUUID();
		const response = await fetch(`/api/chats/${id}/messages`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content })
		});
		if (response.ok) {
			const chat: Chat = await response.json();
			pendingMessage = null;
			activeChat = chat;
			activeTask = chat.messages.at(-1)?.tasks?.[0] ?? null;
			await loadChats();
		} else {
			pendingMessage = null;
			const body = await response.json().catch(() => null);
			errorMessage = body?.message ?? '요청에 실패했습니다.';
			input = content;
		}
		loading = false;
	}
</script>

<svelte:head><title>과의존 방지 AI</title></svelte:head>

<main
	class="grid h-screen min-h-screen grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-zinc-950 text-zinc-100"
>
	<div class="mx-auto flex min-h-0 w-full max-w-6xl min-w-0 flex-col md:flex-row">
		<aside
			class="{mobileView === 'chat'
				? 'hidden'
				: 'flex'} max-h-full w-full flex-col overflow-y-auto border-b border-zinc-800 p-4 md:flex md:w-72 md:border-r md:border-b-0"
		>
			<div class="mb-6 flex items-start justify-between gap-3">
				<div>
					<p class="text-lg font-semibold tracking-tight text-indigo-300">과의존 방지 AI</p>
				</div>
				{#if activeChat}
					<button
						type="button"
						class="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
						onclick={newChat}>새 채팅</button
					>
				{/if}
			</div>
			{#if chatsLoading}
				<p class="px-3 py-2 text-sm text-zinc-400" aria-live="polite">대화 목록을 불러오는 중...</p>
			{:else if !chats.length}
				<p class="px-3 py-2 text-sm text-zinc-400">저장된 대화가 없습니다.</p>
			{:else}
				<nav class="space-y-1" aria-label="저장된 대화">
					{#each chats as chat}
						<button
							type="button"
							class:active={activeChat?.id === chat.id}
							class="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
							aria-current={activeChat?.id === chat.id ? 'page' : undefined}
							onclick={() => openChat(chat.id)}
						>
							<span class="block truncate">{chat.title}</span>
							<time class="mt-1 block text-xs text-zinc-400" datetime={chat.updatedAt}
								>{formatChatDate(chat.updatedAt)}</time
							>
						</button>
					{/each}
				</nav>
			{/if}
		</aside>

		<section
			class="{mobileView === 'list'
				? 'hidden'
				: 'flex'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex"
		>
			<header
				class="sticky top-0 z-10 shrink-0 border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur"
			>
				<div class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						class="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none md:hidden"
						onclick={showChatList}>대화 목록</button
					>
					{#if activeTask}<button
							type="button"
							class="shrink-0 rounded-lg border border-indigo-400 bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:border-indigo-300 hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
							onclick={returnToChat}>원래 대화로 돌아가기</button
						>{/if}
					{#if activeTask}
						<div
							class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm whitespace-nowrap"
						>
							<span class="truncate text-zinc-400">{activeChat?.title ?? '원래 대화'}</span>
							<span class="shrink-0 text-zinc-400" aria-hidden="true">&gt;</span>
							<span class="truncate font-medium text-zinc-100">{activeTask.title}</span>
						</div>
					{:else}
						<div class="min-w-0 flex-1">
							<h2 class="truncate text-sm font-medium text-zinc-300">
								{activeChat?.title ?? '새 대화'}
							</h2>
						</div>
					{/if}
				</div>
			</header>
			<div bind:this={messagesContainer} class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
				{#if chatLoading}
					<div
						class="flex h-full items-center justify-center text-sm text-zinc-400"
						aria-live="polite"
					>
						대화를 불러오는 중...
					</div>
				{:else if activeTask}
					<div class="mx-auto max-w-2xl space-y-6">
						<div>
							<h3 class="text-xl font-semibold text-zinc-100">{activeTask.title}</h3>
							<p class="mt-4 text-sm leading-7 whitespace-pre-wrap text-zinc-300">
								{activeTask.prompt}
							</p>
						</div>
						{#if taskContext}
							<div class="space-y-4 border-l-2 border-zinc-800 pl-4">
								<div>
									<p class="text-sm leading-6 whitespace-pre-wrap text-zinc-400">
										{activeChat?.messages[activeChat.messages.indexOf(taskContext) - 1]?.content ??
											''}
									</p>
								</div>
								<div>
									<p class="text-sm leading-6 whitespace-pre-wrap text-zinc-300">
										{taskContext.content}
									</p>
								</div>
							</div>
						{/if}
						<div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
							<ul class="list-inside list-disc space-y-1 text-sm text-zinc-400">
								{#each activeTask.evaluationCriteria as criterion}<li>{criterion}</li>{/each}
							</ul>
						</div>
						{#if activeTask.submissions.length}
							<div class="space-y-3">
								{#each activeTask.submissions as submission}
									<div
										class="rounded-xl border p-4 {submission.passed
											? 'border-emerald-800 bg-emerald-950/30'
											: 'border-red-900 bg-red-950/20'}"
									>
										<p class="text-sm break-words whitespace-pre-wrap text-zinc-300">
											{submission.content}
										</p>
										<p
											class="mt-2 text-sm {submission.passed ? 'text-emerald-300' : 'text-red-300'}"
										>
											{submission.feedback}
										</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if activeChat || pendingMessage}
					{#if activeChat}
						{#each activeChat.messages as message}
							<div
								class="w-fit max-w-[min(42rem,85%)] min-w-20 {message.role === 'user'
									? 'ml-auto'
									: ''}"
							>
								<div
									class="rounded-2xl px-4 py-3 text-sm leading-6 break-words whitespace-pre-wrap {message.role ===
									'user'
										? 'bg-indigo-600 text-white'
										: 'bg-zinc-900 text-zinc-200'}"
								>
									{message.content}
								</div>
								{#if message.tasks?.length}
									<div class="mt-2 flex flex-wrap gap-2">
										{#each message.tasks as task}
											<button
												type="button"
												class="rounded-lg border px-3 py-2 text-xs {task.status === 'passed'
													? 'border-emerald-800 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/50'
													: 'border-amber-800 bg-amber-950/20 text-amber-300 hover:bg-amber-950/50'} focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
												aria-label={`${task.status === 'passed' ? '통과한 과제' : '과제 열기'}: ${task.title}`}
												onclick={() => openTask(task)}
											>
												{task.status === 'passed' ? '통과한 과제' : '과제 열기'}: {task.title}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
					{#if pendingMessage}
						<div class="ml-auto w-fit max-w-[min(42rem,85%)] min-w-20">
							<div
								class="rounded-2xl bg-indigo-600 px-4 py-3 text-sm leading-6 break-words whitespace-pre-wrap text-white"
							>
								{pendingMessage}
							</div>
						</div>
					{/if}
					{#if loading}
						<div class="w-fit max-w-[min(42rem,85%)] min-w-20" aria-live="polite">
							<div class="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
								답변을 준비하는 중...
							</div>
						</div>
					{/if}
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-zinc-400">
						질문을 입력하세요
					</div>
				{/if}
			</div>
			{#if errorMessage}
				<p class="px-5 pb-2 text-sm text-red-400" role="alert">{errorMessage}</p>
			{/if}
			{#if activeTask}
				<form
					class="shrink-0 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur"
					onsubmit={(event) => {
						event.preventDefault();
						submitTask();
					}}
				>
					{#if !taskInput.trim()}
						<div class="mx-auto mb-3 max-w-2xl">
							<button
								type="button"
								class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
								onclick={returnToChat}>과제 넘어가기</button
							>
						</div>
					{/if}
					<div
						class="mx-auto flex max-w-2xl gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-2 focus-within:border-zinc-400"
					>
						<textarea
							bind:value={taskInput}
							aria-label="과제 답변 입력"
							rows="3"
							placeholder="내 생각과 근거를 작성하세요"
							class="min-h-20 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-400"
							disabled={taskLoading || chatLoading}
							onkeydown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey) {
									event.preventDefault();
									submitTask();
								}
							}}></textarea>
						<button
							class="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none disabled:opacity-50"
							disabled={taskLoading || chatLoading || !taskInput.trim()}
							>{taskLoading ? '평가 중...' : '제출'}</button
						>
					</div>
				</form>
			{:else}<form
					class="shrink-0 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur"
					onsubmit={(event) => {
						event.preventDefault();
						sendMessage();
					}}
				>
					<div
						class="flex gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-2 focus-within:border-zinc-400"
					>
						<textarea
							bind:value={input}
							aria-label="질문 입력"
							rows="1"
							placeholder="질문을 입력하세요"
							class="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-400"
							disabled={loading || chatLoading}
							onkeydown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey) {
									event.preventDefault();
									sendMessage();
								}
							}}></textarea>
						<button
							class="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none disabled:opacity-50"
							disabled={loading || chatLoading || !input.trim()}
							>{loading ? '전송 중...' : '전송'}</button
						>
					</div>
				</form>{/if}
		</section>
	</div>
	<footer class="shrink-0 border-t border-zinc-800 px-5 py-3 text-center text-xs text-zinc-400">
		2026 와부고등학교 ATTENTION 프로젝트 활동 &copy; 황순건 (chadol.xyz).
		<a
			class="ml-1 text-indigo-300 underline decoration-indigo-300/60 underline-offset-2 hover:text-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
			href="https://github.com/chadol27/2026-attention-project"
			target="_blank"
			rel="noreferrer">소스코드 보기</a
		>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
	}
	:global(button.active) {
		background: rgb(24 24 27);
		color: white;
	}
</style>
