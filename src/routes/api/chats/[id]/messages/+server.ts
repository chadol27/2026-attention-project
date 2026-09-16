import { error, json } from '@sveltejs/kit';
import { readChat, saveChat } from '$lib/server/chat-store';
import { askAI } from '$lib/server/ai';
import type { Chat, Message, Task } from '$lib/types';

export async function POST({ params, request }) {
	const { content } = (await request.json()) as { content?: string };
	const question = content?.trim();
	if (!question) error(400, '질문을 입력해 주세요.');
	const existing = await readChat(params.id);
	const now = new Date().toISOString();
	const userMessage: Message = {
		id: crypto.randomUUID(),
		role: 'user',
		content: question,
		createdAt: now
	};
	const history = existing?.messages ?? [];
	try {
		const result = await askAI([...history, userMessage]);
		const tasks: Task[] =
			result.shouldCreateTask && result.task
				? [{ ...result.task, id: crypto.randomUUID(), status: 'pending', submissions: [] }]
				: [];

		const chat: Chat = existing ?? {
			id: params.id,
			title: question.slice(0, 40),
			createdAt: now,
			updatedAt: now,
			messages: []
		};
		chat.messages = [
			...chat.messages,
			userMessage,
			{
				id: crypto.randomUUID(),
				role: 'assistant',
				content: result.answer,
				createdAt: new Date().toISOString(),
				tasks
			}
		];
		chat.updatedAt = new Date().toISOString();
		await saveChat(chat);
		return json(chat);
	} catch (cause) {
		console.error(cause);
		if (cause instanceof Response) throw cause;
		error(502, 'AI 요청에 실패했습니다.');
	}
}
