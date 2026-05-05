/**
 * Shared mock factories for AI / billing / rate-limit / supabase route
 * handler tests. Each factory exposes a `__reset` (or `__set`) hook so a
 * single `vi.mock` call at module load can be re-configured per test.
 *
 * Why a shared factory layer:
 *   The AI routes and adjacent admin/billing handlers all need the same
 *   `from(table).select().eq().maybeSingle()` chain mock and the same
 *   AI-SDK shape. Factoring once means the next route-handler test file
 *   doesn't reinvent it.
 */

export { makeMockSupabase } from "./supabase";
export type {
	MockSupabaseClient,
	MockSupabaseOptions,
	MockTableResult,
	MockRpcResult,
	MockUser,
	MockTableProvider,
	MockRpcProvider,
	MockStorageOptions,
} from "./supabase";

export { makeMockAi } from "./ai";
export type { MockAiBindings, MockAiOptions } from "./ai";

export { makeMockRateLimit } from "./rate-limit";
export type { MockRateLimitBindings, MockRateLimitState, RateLimitVerdict } from "./rate-limit";

export { makeMockBilling } from "./billing";
export type { MockBillingBindings, MockBillingState, BillingVerdict } from "./billing";

/** NDJSON reader for streaming-route tests. */
export async function readNdjson<T = unknown>(res: Response): Promise<T[]> {
	const reader = res.body?.getReader();
	if (!reader) return [];
	const decoder = new TextDecoder();
	let buf = "";
	const lines: T[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (value) buf += decoder.decode(value, { stream: true });
		const parts = buf.split("\n");
		buf = parts.pop() ?? "";
		for (const p of parts) {
			const trimmed = p.trim();
			if (trimmed) lines.push(JSON.parse(trimmed) as T);
		}
		if (done) break;
	}
	if (buf.trim()) lines.push(JSON.parse(buf) as T);
	return lines;
}
