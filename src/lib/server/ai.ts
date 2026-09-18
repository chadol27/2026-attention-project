import OpenAI from 'openai';
import { randomInt } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { AssistantResult, RequestType } from '$lib/types';

const requestTypes: RequestType[] = [
	'information',
	'generation',
	'decision',
	'problemSolving',
	'other'
];

type InformationTaskStyle = 'verify' | 'summarize' | 'rephrase';

const informationTaskStyles: InformationTaskStyle[] = ['verify', 'summarize', 'rephrase'];

const classificationPrompt = `You are a request classifier for an AI assistant designed to prevent user overdependence.
Return exactly one valid JSON object with this field:
{"requestType": "information"|"generation"|"decision"|"problemSolving"|"other"}
Classify the user's primary intended outcome, not the sentence form. A question is not automatically information.
Classify only the latest user message. Use earlier messages only to resolve references or understand a follow-up.

Category rules:
- information: The user wants facts, concepts, explanations, comparisons, research, or learning material that can be answered by conveying knowledge. Examples: "What is photosynthesis?", "Explain closures", "Compare TCP and UDP".
- generation: The user wants new content or an artifact created, rewritten, translated, summarized, or transformed. This includes prose, plans, images, and code written to a specification. Examples: "Write an email", "Create a React component", "Summarize this text".
- decision: The user wants help choosing, judging, prioritizing, approving, or deciding among options for their own situation. Examples: "Which laptop should I buy?", "Should I change majors?", "Rank these options". A request that merely asks for an objective comparison is information.
- problemSolving: The user presents a concrete problem with a result, fix, diagnosis, proof, or solution to derive. This includes math exercises, logic questions, coding errors, debugging, and troubleshooting. Examples: "Solve 15x + 5324 = 0", "Why does this stack trace occur and how do I fix it?", "Find the bug in this code". A request to explain a general problem-solving concept is information; a request to write new code from requirements is generation.
- other: Social conversation, greetings, acknowledgements, unclear or meaningless input, roleplay without a concrete artifact, or anything not covered above.

When more than one category seems possible, choose the category matching the main deliverable the user expects. Apply these tie-breakers:
1. A concrete exercise, error, or malfunction to resolve is problemSolving, even if phrased as a question.
2. Choosing what the user should do is decision; objectively explaining options is information.
3. Producing or transforming an artifact is generation; explaining how or why it works is information.
4. Use other only when no actionable intent is clear.
Do not answer the request or explain the classification.`;

const directAnswerPrompt = `You are determining whether a user explicitly repeats a request for the direct answer after the assistant withheld it for the same problem.
Return exactly one valid JSON object with this field:
{"requestedDirectAnswer": boolean}
Classify only the latest user message, but use the conversation to verify that the assistant previously gave hints without the final answer for the same problem.
For each distinct problem, follow this sequence:
1. On the user's first request about that problem, always set false, even if it says "solve it", "give me the answer", or equivalent.
2. If the assistant then responds without the final answer and the user asks again for the answer to that same problem, set true.
3. Requests about a new or different problem restart at step 1 and must be false.
Do not treat repetition alone as sufficient: the repeated message must explicitly request the answer, final result, or complete solution.
Set false when the user asks for another hint, an explanation of the approach, or discusses a different problem.`;

const informationTaskStyleInstructions: Record<InformationTaskStyle, string> = {
	verify:
		'Create a task asking the user to verify one important claim from the answer with a reliable source and explain the evidence.',
	summarize: 'Create a task asking the user to summarize the answer in a few sentences.',
	rephrase: 'Create a task asking the user to explain the answer again in their own words.'
};

type GeneratedResult = Pick<AssistantResult, 'answer' | 'shouldCreateTask' | 'task'>;

function parseRequestType(value: string): RequestType {
	const result = JSON.parse(value) as { requestType?: unknown };
	if (!requestTypes.includes(result.requestType as RequestType))
		throw new Error('AI 요청 유형 형식이 올바르지 않습니다.');
	return result.requestType as RequestType;
}

function parseDirectAnswer(value: string): boolean {
	const result = JSON.parse(value) as { requestedDirectAnswer?: unknown };
	if (typeof result.requestedDirectAnswer !== 'boolean')
		throw new Error('AI 직접 답변 판정 형식이 올바르지 않습니다.');
	return result.requestedDirectAnswer;
}

function parseGeneratedResult(value: string): GeneratedResult {
	const result = JSON.parse(value) as Partial<GeneratedResult>;
	if (typeof result.answer !== 'string' || typeof result.shouldCreateTask !== 'boolean')
		throw new Error('AI 답변 형식이 올바르지 않습니다.');
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
	return result as GeneratedResult;
}

function pickInformationTaskStyle() {
	return informationTaskStyles[randomInt(informationTaskStyles.length)];
}

function createAnswerPrompt(
	requestType: RequestType,
	requestedDirectAnswer: boolean,
	informationTaskStyle?: InformationTaskStyle
) {
	const informationInstruction = informationTaskStyle
		? `The server selected this information task style. Use exactly this style: ${informationTaskStyle}. ${informationTaskStyleInstructions[informationTaskStyle]}`
		: '';

	return `You are an AI assistant designed to prevent user overdependence.
Return exactly one valid JSON object with these fields:
{"answer": string, "shouldCreateTask": boolean, "task"?: {"title": string, "prompt": string, "evaluationCriteria": string[]}}
Answer in the user's language.
The server classified the latest request as: ${requestType}.
${informationInstruction}
For information requests, answer clearly and create one short task.
For decision requests, do not recommend a specific choice. Present options and tradeoffs, then create a task requiring the user's decision and at least two reasons.
For generation requests, provide only an outline, a small example, and useful tips; do not write the entire result. Do not create a task.
For problem-solving requests, ${requestedDirectAnswer ? 'provide the direct answer or complete solution because the user explicitly requested it again after receiving hints' : 'provide only hints and the next useful step. Do not state the final answer, final result, completed proof, corrected code, or a calculation that directly reveals the final result'}. Do not create a task.
For other requests, answer normally and do not create a task.
Only set shouldCreateTask true when task is present and valid. Keep task prompts concise.`;
}

async function createCompletion(
	client: OpenAI,
	systemPrompt: string,
	messages: { role: 'user' | 'assistant'; content: string }[]
) {
	const completion = await client.chat.completions.create({
		model: env.OPENAI_MODEL!,
		messages: [{ role: 'system', content: systemPrompt }, ...messages],
		response_format: { type: 'json_object' }
	});
	const content = completion.choices[0]?.message.content?.trim();
	if (!content) throw new Error('AI가 답변을 반환하지 않았습니다.');
	return content;
}

export async function askAI(messages: { role: 'user' | 'assistant'; content: string }[]) {
	if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
		throw new Error('OPENAI_API_KEY와 OPENAI_MODEL을 설정해 주세요.');
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	const requestType = parseRequestType(
		await createCompletion(client, classificationPrompt, messages)
	);
	const hasPriorAssistantResponse = messages.slice(0, -1).some(({ role }) => role === 'assistant');
	const requestedDirectAnswer =
		requestType === 'problemSolving' && hasPriorAssistantResponse
			? parseDirectAnswer(await createCompletion(client, directAnswerPrompt, messages))
			: false;
	const informationTaskStyle =
		requestType === 'information' ? pickInformationTaskStyle() : undefined;
	const generated = parseGeneratedResult(
		await createCompletion(
			client,
			createAnswerPrompt(requestType, requestedDirectAnswer, informationTaskStyle),
			messages
		)
	);

	return { ...generated, requestType, requestedDirectAnswer } satisfies AssistantResult;
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
