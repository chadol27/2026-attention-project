import { json } from '@sveltejs/kit';
import { listChats } from '$lib/server/chat-store';

export async function GET() {
	return json(await listChats());
}
