import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { AssistantResult, RequestType } from '$lib/types';

const requestTypes: RequestType[] = [
	'information',
	'generation',
	'decision',
	'problemSolving',
	'other'
];

const systemPrompt = `You are an AI assistant designed to prevent user overdependence.
Return exactly one valid JSON object with these fields:
{"answer": string, "requestType": "information"|"generation"|"decision"|"problemSolving"|"other", "requestedDirectAnswer": boolean, "shouldCreateTask": boolean, "task"?: {"title": string, "prompt": string, "evaluationCriteria": string[]}}
Answer in the user's language.
Classify the request as information, generation, decision, problemSolving, or other.
For information, questions, and learning requests, answer clearly and create one short task asking the user to verify, summarize, or explain the idea in their own words. Randomly choose one of those three task styles.
For decision requests, do not recommend a specific choice. Present options and tradeoffs, then create a task requiring the user's decision and at least two reasons.
For generation requests, provide only an outline, a small example, and useful tips; do not write the entire result. Do not create a task.
For problem-solving requests, provide hints rather than the final answer unless the user explicitly asks again for the direct answer or complete solution. Set requestedDirectAnswer true when they explicitly request it. Do not create a task.
Only set shouldCreateTask true when task is present and valid. Keep task prompts concise.`;

function parseResult(value: string): AssistantResult {
	const result = JSON.parse(value) as Partial<AssistantResult>;
	if (
		typeof result.answer !== 'string' ||
		!requestTypes.includes(result.requestType as RequestType) ||
		typeof result.requestedDirectAnswer !== 'boolean' ||
		typeof result.shouldCreateTask !== 'boolean'
	)
		throw new Error('AI 응답 형식이 올바르지 않습니다.');
	if (result.shouldCreateTask) {
		const task = result.task;
		if (
			!task ||
			typeof task.title !== 'string' ||
			typeof task.prompt !== 'string' ||
			!Array.isArray(task.evaluationCriteria) ||
			!task.evaluationCriteria.every((criterion) => typeof criterion === 'string')
		)
			throw new Error('AI 과제 형식이 올바르지 않습니다.');
	}
	return result as AssistantResult;
}

export async function askAI(messages: { role: 'user' | 'assistant'; content: string }[]) {
	if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
		throw new Error('OPENAI_API_KEY와 OPENAI_MODEL을 설정해 주세요.');
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	const completion = await client.chat.completions.create({
		model: env.OPENAI_MODEL,
		messages: [{ role: 'system', content: systemPrompt }, ...messages],
		response_format: { type: 'json_object' }
	});
	const content = completion.choices[0]?.message.content?.trim();
	if (!content) throw new Error('AI가 답변을 반환하지 않았습니다.');
	return parseResult(content);
}

export async function evaluateTask(input: {
	answer: string;
	prompt: string;
	evaluationCriteria: string[];
	submission: string;
}): Promise<{ passed: boolean; feedback: string }> {
	if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
		throw new Error('OPENAI_API_KEY와 OPENAI_MODEL을 설정해 주세요.');
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	const completion = await client.chat.completions.create({
		model: env.OPENAI_MODEL,
		messages: [
			{
				role: 'system',
				content:
					'Evaluate the submission in the user language. Return exactly JSON: {"passed": boolean, "feedback": string}. Pass only when the criteria are meaningfully addressed. Keep feedback short and constructive.'
			},
			{
				role: 'user',
				content: JSON.stringify(input)
			}
		],
		response_format: { type: 'json_object' }
	});
	const content = completion.choices[0]?.message.content?.trim();
	if (!content) throw new Error('AI가 평가를 반환하지 않았습니다.');
	const result = JSON.parse(content) as { passed?: boolean; feedback?: string };
	if (typeof result.passed !== 'boolean' || typeof result.feedback !== 'string')
		throw new Error('AI 평가 형식이 올바르지 않습니다.');
	return { passed: result.passed, feedback: result.feedback };
}
