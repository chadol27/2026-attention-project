import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Chat, ChatListItem } from '$lib/types';

const chatsDirectory = path.join(process.cwd(), 'chats');
const listPath = path.join(chatsDirectory, 'list.json');

async function ensureStorage() {
	await mkdir(chatsDirectory, { recursive: true });
	try {
		await readFile(listPath, 'utf8');
	} catch {
		await writeFile(listPath, '[]', 'utf8');
	}
}

async function readList(): Promise<ChatListItem[]> {
	await ensureStorage();
	return JSON.parse(await readFile(listPath, 'utf8')) as ChatListItem[];
}

async function writeList(items: ChatListItem[]) {
	await writeFile(listPath, JSON.stringify(items, null, 2), 'utf8');
}

function fileNameFor(chat: Chat) {
	const stamp = chat.createdAt.replace(/[-:TZ.]/g, '').slice(0, 14);
	return `${stamp}-${chat.id}.json`;
}

export async function listChats() {
	return (await readList()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readChat(id: string) {
	const item = (await readList()).find((chat) => chat.id === id);
	if (!item) return null;
	return JSON.parse(await readFile(path.join(chatsDirectory, item.fileName), 'utf8')) as Chat;
}

export async function saveChat(chat: Chat) {
	await ensureStorage();
	const list = await readList();
	const existing = list.findIndex((item) => item.id === chat.id);
	const fileName = existing >= 0 ? list[existing].fileName : fileNameFor(chat);
	await writeFile(path.join(chatsDirectory, fileName), JSON.stringify(chat, null, 2), 'utf8');
	const item = {
		id: chat.id,
		title: chat.title,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		fileName
	};
	if (existing >= 0) list[existing] = item;
	else list.push(item);
	await writeList(list);
}
