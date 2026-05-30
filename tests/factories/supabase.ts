/**
 * Configurable mock for the supabase server / service-role clients.
 *
 * Why a custom mock instead of `@supabase/supabase-js` test utilities:
 *   The Supabase JS chain (`from(t).select().eq().maybeSingle()`) returns a
 *   query builder that's both chainable AND awaitable at any point. There's
 *   no first-party fixture for this, and `vi.fn()` on a single method
 *   doesn't compose. This factory uses a Proxy-shaped chain object that
 *   answers every method by returning itself, with terminal methods
 *   (`maybeSingle`, `single`) and `await chain` resolving to a per-table
 *   configurable response.
 *
 * Pattern in tests:
 *   const mockSupabase = makeMockSupabase({ user: { id: "stud-1" } });
 *   vi.mock("@/lib/supabase/server", () => ({
 *     createClient: async () => mockSupabase,
 *   }));
 *   beforeEach(() => mockSupabase.__reset({ user: { id: "stud-1" } }));
 */

export type MockUser = { id: string; email?: string };

export type MockTableResult = { data?: unknown; error?: unknown; count?: number | null };
export type MockRpcResult = { data?: unknown; error?: unknown };

export type MockTableProvider =
	| MockTableResult
	| ((table: string) => MockTableResult)
	| ((table: string) => Promise<MockTableResult>);

export type MockRpcProvider =
	| MockRpcResult
	| ((args: unknown) => MockRpcResult)
	| ((args: unknown) => Promise<MockRpcResult>);

export interface MockStorageOptions {
	uploadResult?: { data?: unknown; error?: { message: string } | null };
	signedUrlResult?: {
		data?: { signedUrl: string } | null;
		error?: { message: string } | null;
	};
}

export interface MockSupabaseOptions {
	user?: MockUser | null;
	authError?: { message: string } | null;
	tables?: Record<string, MockTableProvider>;
	rpcs?: Record<string, MockRpcProvider>;
	storage?: MockStorageOptions;
}

export interface MockSupabaseClient {
	auth: {
		getUser: () => Promise<{
			data: { user: MockUser | null };
			error: { message: string } | null;
		}>;
	};
	from: (table: string) => unknown;
	rpc: (name: string, args?: unknown) => Promise<MockRpcResult>;
	storage: {
		from: (bucket: string) => {
			upload: (path: string, content: unknown, opts?: unknown) => Promise<{ data?: unknown; error?: { message: string } | null }>;
			createSignedUrl: (
				path: string,
				ttl: number,
			) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
		};
	};
	__reset: (next?: MockSupabaseOptions) => void;
	__opts: () => MockSupabaseOptions;
}

function resolveTable(opts: MockSupabaseOptions, table: string): MockTableResult | Promise<MockTableResult> {
	const v = opts.tables?.[table];
	if (v == null) return { data: null, error: null };
	if (typeof v === "function") return (v as (t: string) => MockTableResult | Promise<MockTableResult>)(table);
	return v;
}

function resolveRpc(opts: MockSupabaseOptions, name: string, args: unknown): MockRpcResult | Promise<MockRpcResult> {
	const v = opts.rpcs?.[name];
	if (v == null) return { data: null, error: null };
	if (typeof v === "function") return (v as (a: unknown) => MockRpcResult | Promise<MockRpcResult>)(args);
	return v;
}

export function makeMockSupabase(initial: MockSupabaseOptions = {}): MockSupabaseClient {
	let opts: MockSupabaseOptions = { ...initial };

	function makeChain(table: string): unknown {
		// All chain methods (`select`, `eq`, `in`, `order`, `limit`, `insert`,
		// `update`, `delete`, `upsert`, `returning`) return the chain itself so
		// arbitrary chains compose. Terminals (`maybeSingle`, `single`) resolve
		// to the configured per-table response. Awaiting the chain directly also
		// resolves to that response — supports patterns like
		// `await supabase.from(t).update(x).eq("id", y)`.
		const chain: Record<string, unknown> = {};
		const ret = () => chain;
		const chainMethods = [
			"select",
			"eq",
			"neq",
			"gt",
			"gte",
			"lt",
			"lte",
			"in",
			"contains",
			"like",
			"ilike",
			"is",
			// M-5: these were missing — calling them returned `undefined`, breaking
			// the chain and producing confusing failures / false-greens for routes
			// that use `.not()` (e.g. auto-submit-expired), `.filter()`
			// (weekly-digest), `.match()`, `.overlaps()`.
			"not",
			"filter",
			"match",
			"overlaps",
			"or",
			"order",
			"limit",
			"range",
			"insert",
			"update",
			"delete",
			"upsert",
			"returning",
		];
		for (const m of chainMethods) chain[m] = ret;
		chain.maybeSingle = async () => resolveTable(opts, table);
		chain.single = async () => resolveTable(opts, table);
		chain.then = (
			onFulfilled?: (v: MockTableResult) => unknown,
			onRejected?: (e: unknown) => unknown,
		) => Promise.resolve(resolveTable(opts, table)).then(onFulfilled, onRejected);
		return chain;
	}

	return {
		auth: {
			getUser: async () => ({
				data: { user: opts.user ?? null },
				error: opts.authError ?? null,
			}),
		},
		from: (table: string) => makeChain(table),
		rpc: async (name: string, args?: unknown) => resolveRpc(opts, name, args),
		storage: {
			from: () => ({
				upload: async () => {
					const r = opts.storage?.uploadResult;
					return {
						data: (r?.data ?? { path: "ok" }) as unknown,
						error: (r?.error ?? null) as { message: string } | null,
					};
				},
				createSignedUrl: async () => {
					const r = opts.storage?.signedUrlResult;
					return {
						data: (r?.data ?? { signedUrl: "https://example.test/signed" }) as { signedUrl: string } | null,
						error: (r?.error ?? null) as { message: string } | null,
					};
				},
			}),
		},
		__reset: (next?: MockSupabaseOptions) => {
			opts = next ? { ...next } : { ...initial };
		},
		__opts: () => opts,
	};
}
