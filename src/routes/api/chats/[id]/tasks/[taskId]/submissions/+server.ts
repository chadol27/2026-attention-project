import { error, json } from '@sveltejs/kit';
import { evaluateTask } from '$lib/server/ai';
import { readChat, saveChat } from '$lib/server/chat-store';
import type { Submission } from '$lib/types';

export async function POST({ params, request }) {
	const { content } = (await request.json()) as { content?: string };
	const submission = content?.trim();
	if (!submission) error(400, '제출 내용을 입력해 주세요.');
	const chat = await readChat(params.id);
	if (!chat) error(404, '채팅을 찾을 수 없습니다.');
	const message = chat.messages.find((item) =>
		item.tasks?.some((task) => task.id === params.taskId)
	);
	const task = message?.tasks?.find((item) => item.id === params.taskId);
	if (!task || !message) error(404, '과제를 찾을 수 없습니다.');
	try {
		const result = await evaluateTask({
			answer: message.content,
			prompt: task.prompt,
			evaluationCriteria: task.evaluationCriteria,
			submission
		});
		const record: Submission = {
			id: crypto.randomUUID(),
			content: submission,
			passed: result.passed,
			feedback: result.feedback,
			createdAt: new Date().toISOString()
		};
		task.submissions = [...task.submissions, record];
		if (result.passed) task.status = 'passed';
		chat.updatedAt = new Date().toISOString();
		await saveChat(chat);
		return json({ chat, submission: record, task });
	} catch (cause) {
		console.error(cause);
		if (cause instanceof Response) throw cause;
		error(502, cause instanceof Error ? cause.message : '과제 평가에 실패했습니다.');
	}
}
