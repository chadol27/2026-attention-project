<script lang="ts">
	import { onMount } from 'svelte';
	import type { Chat, ChatListItem } from '$lib/types';

	let chats = $state<ChatListItem[]>([]);
	let activeChat = $state<Chat | null>(null);
	let input = $state('');
	let loading = $state(false);
	let errorMessage = $state('');

	onMount(loadChats);

	async function loadChats() {
		const response = await fetch('/api/chats');
		if (response.ok) chats = await response.json();
	}

	function newChat() {
		activeChat = null;
		errorMessage = '';
	}

	async function openChat(id: string) {
		const response = await fetch(`/api/chats/${id}`);
		if (response.ok) activeChat = await response.json();
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
			activeChat = await response.json();
			await loadChats();
		} else {
			const body = await response.json().catch(() => null);
			errorMessage = body?.message ?? '요청에 실패했습니다.';
			input = content;
		}
		loading = false;
	}
</script>

<svelte:head><title>의존하지 않는 AI</title></svelte:head>

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
				<h2 class="text-sm font-medium text-zinc-400">{activeChat?.title ?? '새 대화'}</h2>
			</header>
			<div class="flex-1 space-y-5 overflow-y-auto p-5">
				{#if activeChat}
					{#each activeChat.messages as message}
						<div
							class:ml-auto={message.role === 'user'}
							class:max-w-2xl={true}
							class="rounded-2xl px-4 py-3 text-sm leading-6 {message.role === 'user'
								? 'bg-indigo-600 text-white'
								: 'bg-zinc-900 text-zinc-200'}"
						>
							{message.content}
						</div>
					{/each}
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-zinc-600">
						질문을 입력하세요
					</div>
				{/if}
			</div>
			{#if errorMessage}<p class="px-5 pb-2 text-sm text-red-400">{errorMessage}</p>{/if}
			<form
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
			</form>
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
