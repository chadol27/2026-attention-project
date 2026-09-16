export type RequestType = 'information' | 'generation' | 'decision' | 'problemSolving' | 'other';

export type Submission = {
	id: string;
	content: string;
	passed: boolean;
	feedback: string;
	createdAt: string;
};

export type Task = {
	id: string;
	title: string;
	prompt: string;
	evaluationCriteria: string[];
	status: 'pending' | 'passed';
	submissions: Submission[];
};

export type Message = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	createdAt: string;
	tasks?: Task[];
};

export type AssistantResult = {
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
