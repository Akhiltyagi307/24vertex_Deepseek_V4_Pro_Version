/**
 * Compliance coverage for doubt-chat data — both erasure (delete) and export (ZIP).
 *
 * The erasure pipeline (`src/lib/compliance/erasure.ts`) and the export pipeline
 * (`src/lib/compliance/export-user-data.ts`) both already wire `doubt_conversations`
 * and `doubt_messages`. These tests pin that wiring so a future refactor can't
 * silently drop them.
 *
 * Strategy: stub `@/db` Drizzle as in `events.test.ts`, then drive
 * `countErasureImpact` and `buildComplianceExportZip` and assert their
 * doubt-chat side effects (counts in the manifest, presence of the right
 * filenames in the export, the right where-clause shape on counts).
 */
import { describe, expect, it, vi } from "vitest";

const {
	selectMock,
	deleteMock,
	updateMock,
	executeMock,
	transactionMock,
} = vi.hoisted(() => ({
	selectMock: vi.fn(),
	deleteMock: vi.fn(),
	updateMock: vi.fn(),
	executeMock: vi.fn(),
	transactionMock: vi.fn(),
}));

vi.mock("@/db", () => ({
	db: {
		select: selectMock,
		delete: deleteMock,
		update: updateMock,
		execute: executeMock,
		transaction: transactionMock,
	},
}));

vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		auth: {
			admin: { updateUserById: async () => ({ error: null }) },
		},
		storage: {
			from: () => ({
				// Erasure path uses `.remove(paths)`. Export path uses
				// `.createSignedUrl(path, ttl)`. Both are stubbed as no-ops
				// returning success shapes the real client would.
				remove: async () => ({ data: [], error: null }),
				createSignedUrl: async () => ({
					data: { signedUrl: "https://example.invalid/signed" },
					error: null,
				}),
			}),
		},
	}),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
}));

vi.mock("@/lib/compliance/events", () => ({
	recordComplianceEvent: vi.fn(async () => undefined),
}));

import { countErasureImpact } from "@/lib/compliance/erasure";
import { buildComplianceExportZip } from "@/lib/compliance/export-user-data";

/**
 * Minimal chainable Drizzle-shaped builder. Each call records a row in
 * `rpcInvocations` and resolves to the next planned result. The `from`/`where`
 * methods return the same chainable, and `limit` resolves the promise.
 */
type ChainMock = {
	from: () => ChainMock;
	where: () => ChainMock;
	limit: () => Promise<unknown[]>;
	orderBy: () => ChainMock;
	then: (res: (v: unknown[]) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>;
};

function makeChain(rows: unknown[]): ChainMock {
	// Build the chain so each call returns the same object; .limit and the
	// thenable both resolve to the rows. Drizzle queries either `await
	// builder` directly (uses `.then`) or terminate with `.limit(n)`.
	const chain: ChainMock = {
		from: () => chain,
		where: () => chain,
		orderBy: () => chain,
		limit: () => Promise.resolve(rows),
		then: (res, rej) => Promise.resolve(rows).then(res, rej),
	};
	return chain;
}

describe("countErasureImpact — doubt rows", () => {
	it("reports doubt_conversations_deleted and doubt_messages_deleted", async () => {
		// `countErasureImpact` issues many `select(...)` calls. We respond with
		// generic empty/zero shapes for all OTHER tables and inject realistic
		// values when the call shape matches doubt-chat. The simplest robust
		// approach: every select returns a chain. Each `.limit()` (or thenable)
		// resolves to whatever the next planned response is. We track the order
		// strictly here by re-assigning `selectMock.mockImplementation`.
		const responses: unknown[][] = [];
		// Rows for `loadTestIdsForStudent` (first select)
		responses.push([]); // no tests
		// `count(*) profiles` → `[{ c: 1 }]`
		responses.push([{ c: 1 }]);
		// student_answers count (skipped if no testIds — replaced by 0 path)
		// counts.question_flags_deleted
		responses.push([{ c: 0 }]);
		// performance_tracker
		responses.push([{ c: 0 }]);
		// assignment_submissions
		responses.push([{ c: 0 }]);
		// notifications
		responses.push([{ c: 0 }]);
		// user_preferences
		responses.push([{ c: 0 }]);
		// parent_student_links
		responses.push([{ c: 0 }]);
		// doubt convos list — drive the count through here
		responses.push([{ id: "11111111-1111-1111-1111-111111111111" }, { id: "22222222-2222-2222-2222-222222222222" }]);
		// doubt_messages count for those two convos
		responses.push([{ c: 7 }]);
		// doubt_message_attachments count
		responses.push([{ c: 3 }]);
		// ai_calls count
		responses.push([{ c: 0 }]);

		let i = 0;
		selectMock.mockImplementation(() => {
			const rows = responses[i] ?? [];
			i++;
			return makeChain(rows);
		});

		const counts = await countErasureImpact("00000000-0000-0000-0000-0000000000aa");

		expect(counts.doubt_conversations_deleted, JSON.stringify(counts)).toBe(2);
		expect(counts.doubt_messages_deleted).toBe(7);
		expect(counts.doubt_message_attachments_deleted).toBe(3);
	});

	it("reports zero when the student has no doubt conversations", async () => {
		const responses: unknown[][] = [
			[], // tests
			[{ c: 1 }], // profiles
			[{ c: 0 }], // q_flags
			[{ c: 0 }], // perf
			[{ c: 0 }], // submissions
			[{ c: 0 }], // notifications
			[{ c: 0 }], // user_preferences
			[{ c: 0 }], // parent_student_links
			[], // doubt convos
			[{ c: 0 }], // ai_calls
		];

		let i = 0;
		selectMock.mockImplementation(() => {
			const rows = responses[i] ?? [];
			i++;
			return makeChain(rows);
		});

		const counts = await countErasureImpact("00000000-0000-0000-0000-0000000000bb");
		expect(counts.doubt_conversations_deleted).toBe(0);
		expect(counts.doubt_messages_deleted).toBe(0);
		expect(counts.doubt_message_attachments_deleted).toBe(0);
	});
});

describe("buildComplianceExportZip — doubt slices in the manifest", () => {
	it("includes doubt_conversations.json and doubt_messages.json in the manifest with row counts", async () => {
		const doubtConvos = [
			{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
			{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
		];
		const doubtMsgs = [
			{ id: "m1" },
			{ id: "m2" },
			{ id: "m3" },
		];
		const doubtAtts = [{ id: "a1" }];

		// Each top-level select call in `buildComplianceExportZip` runs sequentially.
		// We provide responses in the exact ORDER they're queried. The doubt slices
		// are near the end. Most other slices return empty arrays.
		const orderedResponses: unknown[][] = [
			[], // profiles
			[], // perf
			[], // tests
			// no testIds → skip questionRows/answerRows/reportRows/adminMsgRows branch
			[], // qFlags
			[], // submissions
			[], // notifs
			[], // prefs
			[], // links
			[], // subs
			// no subIds → skip usagePeriods branch
			[], // payments
			[], // redemption
			[], // trial
			[], // audit
			[], // adminLog
			[], // consent
			[], // dsr
			[], // emailLog
			[], // aiCalls
			doubtConvos, // doubtConvos
			doubtMsgs, // doubtMessages (because convoIds is non-empty)
			doubtAtts, // doubtMessageAttachments (because convoIds is non-empty)
		];

		let i = 0;
		selectMock.mockImplementation(() => {
			const rows = orderedResponses[i] ?? [];
			i++;
			return makeChain(rows);
		});

		const { manifest } = await buildComplianceExportZip({
			subjectUserId: "00000000-0000-0000-0000-0000000000cc",
			complianceRequestId: "11111111-1111-1111-1111-111111111111",
		});

		expect(manifest["doubt_conversations.json"]).toBe(2);
		expect(manifest["doubt_messages.json"]).toBe(3);
		expect(manifest["doubt_message_attachments.json"]).toBe(1);
		// One downloads sidecar entry per attachment row (URL + metadata).
		expect(manifest["doubt_attachments_downloads.json"]).toBe(1);
		// Sanity: index file always present.
		expect(manifest["index.html"]).toBe(1);
	});

	it("emits doubt_messages.json with 0 rows when the student has no doubt conversations", async () => {
		const orderedResponses: unknown[][] = [
			[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [],
			[], // aiCalls
			[], // doubtConvos — empty, so doubtMessages branch is skipped entirely
		];

		let i = 0;
		selectMock.mockImplementation(() => {
			const rows = orderedResponses[i] ?? [];
			i++;
			return makeChain(rows);
		});

		const { manifest } = await buildComplianceExportZip({
			subjectUserId: "00000000-0000-0000-0000-0000000000dd",
			complianceRequestId: "11111111-1111-1111-1111-111111111111",
		});

		expect(manifest["doubt_conversations.json"]).toBe(0);
		expect(manifest["doubt_messages.json"]).toBe(0);
		expect(manifest["doubt_message_attachments.json"]).toBe(0);
	});
});
