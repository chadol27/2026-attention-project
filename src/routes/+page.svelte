<script lang="ts">
	import { onMount } from 'svelte';
	import type { Chat, ChatListItem, Task } from '$lib/types';

	let chats = $state<ChatListItem[]>([]);
	let activeChat = $state<Chat | null>(null);
	let input = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let activeTask = $state<Task | null>(null);
	let taskInput = $state('');
	let taskLoading = $state(false);
	let taskContext = $derived(
		activeChat?.messages.find((message) =>
			message.tasks?.some((task) => task.id === activeTask?.id)
		)
	);

	onMount(loadChats);

	async function loadChats() {
		const response = await fetch('/api/chats');
		if (response.ok) chats = await response.json();
	}

	function newChat() {
		activeChat = null;
		activeTask = null;
		errorMessage = '';
	}

	async function openChat(id: string) {
		const response = await fetch(`/api/chats/${id}`);
		if (response.ok) {
			activeChat = await response.json();
			activeTask =
				activeChat?.messages
					.flatMap((message) => message.tasks ?? [])
					.find((task) => task.status === 'pending') ?? null;
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
			if (body.submission.passed) activeTask = null;
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
			activeChat = chat;
			activeTask = chat.messages.at(-1)?.tasks?.[0] ?? null;
			await loadChats();
		} else {
			const body = await response.json().catch(() => null);
			errorMessage = body?.message ?? '요청에 실패했습니다.';
			input = content;
		}
		loading = false;
	}
</script>

<svelte:head><title>과의존 방지 AI</title></svelte:head>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
		<aside class="border-b border-zinc-800 p-4 md:w-72 md:border-r md:border-b-0">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-sm font-semibold tracking-wide text-zinc-300">채팅</h1>
				<button
					class="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900"
					onclick={newChat}>새 채팅</button
				>
			</div>
			<div class="space-y-1">
				{#each chats as chat}
					<button
						class:active={activeChat?.id === chat.id}
						class="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900"
						onclick={() => openChat(chat.id)}>{chat.title}</button
					>
				{/each}
			</div>
		</aside>

		<section class="flex min-h-[calc(100vh-97px)] flex-1 flex-col md:min-h-screen">
			<header class="border-b border-zinc-800 px-5 py-4">
				<div class="flex items-center justify-between gap-4">
					<h2 class="text-sm font-medium text-zinc-400">
						{activeTask ? '과제' : (activeChat?.title ?? '새 대화')}
					</h2>
					{#if activeTask}<button
							class="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
							onclick={returnToChat}>원래 대화로 돌아가기</button
						>{/if}
				</div>
			</header>
			<div class="flex-1 space-y-5 overflow-y-auto p-5">
				{#if activeTask}
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
									<p class="mb-1 text-xs text-zinc-500">질문</p>
									<p class="text-sm leading-6 whitespace-pre-wrap text-zinc-400">
										{activeChat?.messages[activeChat.messages.indexOf(taskContext) - 1]?.content ??
											''}
									</p>
								</div>
								<div>
									<p class="mb-1 text-xs text-zinc-500">AI 답변</p>
									<p class="text-sm leading-6 whitespace-pre-wrap text-zinc-300">
										{taskContext.content}
									</p>
								</div>
							</div>
						{/if}
						<div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
							<p class="mb-2 text-xs text-zinc-500">통과 기준</p>
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
										<p class="text-sm text-zinc-300">{submission.content}</p>
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
				{:else if activeChat}
					{#each activeChat.messages as message}
						<div class="max-w-2xl {message.role === 'user' ? 'ml-auto' : ''}">
							<div
								class="rounded-2xl px-4 py-3 text-sm leading-6 {message.role === 'user'
									? 'bg-indigo-600 text-white'
									: 'bg-zinc-900 text-zinc-200'}"
							>
								{message.content}
							</div>
							{#if message.tasks?.length}
								<div class="mt-2 flex flex-wrap gap-2">
									{#each message.tasks as task}
										<button
											class="rounded-lg border border-indigo-800 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-950"
											onclick={() => openTask(task)}
										>
											{task.status === 'passed' ? '통과한 과제' : '과제 열기'}: {task.title}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-zinc-600">
						질문을 입력하세요
					</div>
				{/if}
			</div>
			{#if errorMessage}<p class="px-5 pb-2 text-sm text-red-400">{errorMessage}</p>{/if}
			{#if activeTask}
				<form
					class="border-t border-zinc-800 p-4"
					onsubmit={(event) => {
						event.preventDefault();
						submitTask();
					}}
				>
					{#if !taskInput.trim()}
						<div class="mx-auto mb-3 max-w-2xl">
							<button
								class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
								onclick={returnToChat}>과제 넘어가기</button
							>
						</div>
					{/if}
					<div
						class="mx-auto flex max-w-2xl gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-2 focus-within:border-zinc-400"
					>
						<textarea
							bind:value={taskInput}
							rows="3"
							placeholder="내 생각과 근거를 작성하세요"
							class="min-h-20 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-600"
							disabled={taskLoading}
							onkeydown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey) {
									event.preventDefault();
									submitTask();
								}
							}}></textarea>
						<button
							class="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
							disabled={taskLoading || !taskInput.trim()}
							>{taskLoading ? '평가 중...' : '제출'}</button
						>
					</div>
				</form>
			{:else}<form
					class="border-t border-zinc-800 p-4"
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
							rows="1"
							placeholder="질문을 입력하세요"
							class="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-600"
							disabled={loading}
							onkeydown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey) {
									event.preventDefault();
									sendMessage();
								}
							}}></textarea>
						<button
							class="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
							disabled={loading || !input.trim()}>{loading ? '...' : '전송'}</button
						>
					</div>
				</form>{/if}
		</section>
	</div>
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
