/**
 * Mocks for the `ai` package (vercel/ai SDK) and the OpenAI provider.
 *
 * `streamText` returns an object with `toUIMessageStreamResponse(...)` that
 * yields a real `Response` object (no streaming required for handler tests —
 * tests assert status + headers rather than the wire bytes).
 *
 * `streamObject` returns the shape the practice pipeline awaits: an
 * `object` and `usage`. We don't stream partials by default; the pipeline
 * tests for that surface live separately.
 *
 * `generateObject` returns `{ object, usage }`.
 */

export interface MockAiOptions {
	streamText?: {
		text?: string;
		usage?: { inputTokens: number; outputTokens: number };
		throws?: unknown;
	};
	streamObject?: {
		object?: unknown;
		usage?: { inputTokens: number; outputTokens: number };
		throws?: unknown;
	};
	generateObject?: {
		object?: unknown;
		usage?: { inputTokens: number; outputTokens: number };
		throws?: unknown;
	};
}

export interface MockAiBindings {
	streamText: (...args: unknown[]) => unknown;
	streamObject: (...args: unknown[]) => unknown;
	generateObject: (...args: unknown[]) => Promise<unknown>;
	convertToModelMessages: (m: unknown) => Promise<unknown>;
	__reset: (next?: MockAiOptions) => void;
}

export function makeMockAi(initial: MockAiOptions = {}): MockAiBindings {
	let opts = { ...initial };

	return {
		streamText: () => {
			if (opts.streamText?.throws) throw opts.streamText.throws;
			const text = opts.streamText?.text ?? "Mock answer.";
			const usage = opts.streamText?.usage ?? { inputTokens: 10, outputTokens: 20 };
			return {
				toUIMessageStreamResponse: (init?: { headers?: HeadersInit }) =>
					new Response(text, {
						status: 200,
						headers: init?.headers ?? { "content-type": "text/plain" },
					}),
				// Some callers also access `text` / `usage` directly.
				text,
				usage,
				totalUsage: usage,
				finishReason: "stop" as const,
			};
		},
		streamObject: () => {
			if (opts.streamObject?.throws) throw opts.streamObject.throws;
			const object = opts.streamObject?.object ?? {};
			const usage = opts.streamObject?.usage ?? { inputTokens: 10, outputTokens: 20 };
			return {
				object: Promise.resolve(object),
				partialObjectStream: (async function* () {
					yield object;
				})(),
				usage: Promise.resolve(usage),
			};
		},
		generateObject: async () => {
			if (opts.generateObject?.throws) throw opts.generateObject.throws;
			return {
				object: opts.generateObject?.object ?? {},
				usage: opts.generateObject?.usage ?? { inputTokens: 10, outputTokens: 20 },
			};
		},
		convertToModelMessages: async (m: unknown) => m,
		__reset: (next?: MockAiOptions) => {
			opts = next ? { ...next } : { ...initial };
		},
	};
}
