export type Message = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	createdAt: string;
};

export type Chat = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messages: Message[];
};

export type ChatListItem = Pick<Chat, 'id' | 'title' | 'createdAt' | 'updatedAt'> & {
	fileName: string;
};
