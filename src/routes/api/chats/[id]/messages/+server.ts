import OpenAI from 'openai';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { readChat, saveChat } from '$lib/server/chat-store';
import type { Chat, Message } from '$lib/types';

export async function POST({ params, request }) {
	const { content } = (await request.json()) as { content?: string };
	const question = content?.trim();
	if (!question) error(400, '질문을 입력해 주세요.');
	if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
		error(500, 'OPENAI_API_KEY와 OPENAI_MODEL을 설정해 주세요.');

	const existing = await readChat(params.id);
	const now = new Date().toISOString();
	const userMessage: Message = {
		id: crypto.randomUUID(),
		role: 'user',
		content: question,
		createdAt: now
	};
	const history = existing?.messages ?? [];
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	try {
		const completion = await client.chat.completions.create({
			model: env.OPENAI_MODEL,
			messages: [...history, userMessage].map(({ role, content: message }) => ({
				role,
				content: message
			}))
		});
		const answer = completion.choices[0]?.message.content?.trim();
		if (!answer) error(502, 'AI가 답변을 반환하지 않았습니다.');

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
				content: answer,
				createdAt: new Date().toISOString()
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
