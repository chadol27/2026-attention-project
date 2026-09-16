import { error, json } from '@sveltejs/kit';
import { readChat } from '$lib/server/chat-store';

export async function GET({ params }) {
	const chat = await readChat(params.id);
	if (!chat) error(404, '채팅을 찾을 수 없습니다.');
	return json(chat);
}
