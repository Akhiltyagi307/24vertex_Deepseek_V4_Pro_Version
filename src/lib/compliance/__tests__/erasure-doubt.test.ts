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
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { aiCalls } from "@/db/schema/ai-calls";
import { adminActionLog } from "@/db/schema/admin-action-log";
import {
	adminTestMessages,
	performanceTracker,
	questionFlags,
	questions,
	studentAnswers,
	testReports,
	tests,
} from "@/db/schema/assessment";
import { assignmentSubmissions } from "@/db/schema/teaching";
import { couponRedemptions, freeTrialClaims, payments, subscriptions, usagePeriods } from "@/db/schema/billing";
import { complianceRequests } from "@/db/schema/compliance-requests";
import { auditLogs, emailLog, notifications, userPreferences } from "@/db/schema/comms-audit";
import { doubtConversations, doubtMessageAttachments, doubtMessages } from "@/db/schema/doubt";
import { parentalConsents } from "@/db/schema/parental-consents";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { userFeedbackReports } from "@/db/schema/user-feedback-reports";

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

/** Map Drizzle table refs to planned select results (order-independent). */
function installTableSelectResponses(byTable: Record<string, unknown[]>): void {
	selectMock.mockImplementation(() => ({
		from: (table: unknown) => {
			const name = getTableName(table as Parameters<typeof getTableName>[0]);
			return makeChain(byTable[name] ?? [{ c: 0 }]);
		},
	}));
}

/** Empty export fixture for every slice `buildComplianceExportZip` may select. */
function emptyExportSelectFixture(): Record<string, unknown[]> {
	return {
		[getTableName(profiles)]: [],
		[getTableName(performanceTracker)]: [],
		[getTableName(tests)]: [],
		[getTableName(questions)]: [],
		[getTableName(studentAnswers)]: [],
		[getTableName(testReports)]: [],
		[getTableName(adminTestMessages)]: [],
		[getTableName(questionFlags)]: [],
		[getTableName(userFeedbackReports)]: [],
		[getTableName(assignmentSubmissions)]: [],
		[getTableName(notifications)]: [],
		[getTableName(userPreferences)]: [],
		[getTableName(parentStudentLinks)]: [],
		[getTableName(subscriptions)]: [],
		[getTableName(usagePeriods)]: [],
		[getTableName(payments)]: [],
		[getTableName(couponRedemptions)]: [],
		[getTableName(freeTrialClaims)]: [],
		[getTableName(auditLogs)]: [],
		[getTableName(adminActionLog)]: [],
		[getTableName(parentalConsents)]: [],
		[getTableName(complianceRequests)]: [],
		[getTableName(emailLog)]: [],
		[getTableName(aiCalls)]: [],
		[getTableName(doubtConversations)]: [],
		[getTableName(doubtMessages)]: [],
		[getTableName(doubtMessageAttachments)]: [],
	};
}

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
		installTableSelectResponses({
			[getTableName(tests)]: [],
			[getTableName(profiles)]: [{ c: 1 }],
			[getTableName(questionFlags)]: [{ c: 0 }],
			[getTableName(userFeedbackReports)]: [{ c: 0 }],
			[getTableName(performanceTracker)]: [{ c: 0 }],
			[getTableName(assignmentSubmissions)]: [{ c: 0 }],
			[getTableName(notifications)]: [{ c: 0 }],
			[getTableName(userPreferences)]: [{ c: 0 }],
			[getTableName(parentStudentLinks)]: [{ c: 0 }],
			[getTableName(doubtConversations)]: [
				{ id: "11111111-1111-1111-1111-111111111111" },
				{ id: "22222222-2222-2222-2222-222222222222" },
			],
			[getTableName(doubtMessages)]: [{ c: 7 }],
			[getTableName(doubtMessageAttachments)]: [{ c: 3 }],
			[getTableName(aiCalls)]: [{ c: 0 }],
		});

		const counts = await countErasureImpact("00000000-0000-0000-0000-0000000000aa");

		expect(counts.doubt_conversations_deleted, JSON.stringify(counts)).toBe(2);
		expect(counts.doubt_messages_deleted).toBe(7);
		expect(counts.doubt_message_attachments_deleted).toBe(3);
	});

	it("reports zero when the student has no doubt conversations", async () => {
		installTableSelectResponses({
			[getTableName(tests)]: [],
			[getTableName(profiles)]: [{ c: 1 }],
			[getTableName(questionFlags)]: [{ c: 0 }],
			[getTableName(userFeedbackReports)]: [{ c: 0 }],
			[getTableName(performanceTracker)]: [{ c: 0 }],
			[getTableName(assignmentSubmissions)]: [{ c: 0 }],
			[getTableName(notifications)]: [{ c: 0 }],
			[getTableName(userPreferences)]: [{ c: 0 }],
			[getTableName(parentStudentLinks)]: [{ c: 0 }],
			[getTableName(doubtConversations)]: [],
			[getTableName(aiCalls)]: [{ c: 0 }],
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
		const doubtMsgs = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
		const doubtAtts = [
			{
				id: "a1",
				conversationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				messageId: "m1",
				kind: "image",
				mime: "image/png",
				sizeBytes: 100,
				storagePath: "student/x.png",
			},
		];

		installTableSelectResponses({
			...emptyExportSelectFixture(),
			[getTableName(doubtConversations)]: doubtConvos,
			[getTableName(doubtMessages)]: doubtMsgs,
			[getTableName(doubtMessageAttachments)]: doubtAtts,
		});

		const { manifest } = await buildComplianceExportZip({
			subjectUserId: "00000000-0000-0000-0000-0000000000cc",
			complianceRequestId: "11111111-1111-1111-1111-111111111111",
		});

		expect(manifest["doubt_conversations.json"]).toBe(2);
		expect(manifest["doubt_messages.json"]).toBe(3);
		expect(manifest["doubt_message_attachments.json"]).toBe(1);
		expect(manifest["doubt_attachments_downloads.json"]).toBe(1);
		expect(manifest["index.html"]).toBe(1);
	});

	it("emits doubt_messages.json with 0 rows when the student has no doubt conversations", async () => {
		installTableSelectResponses(emptyExportSelectFixture());

		const { manifest } = await buildComplianceExportZip({
			subjectUserId: "00000000-0000-0000-0000-0000000000dd",
			complianceRequestId: "11111111-1111-1111-1111-111111111111",
		});

		expect(manifest["doubt_conversations.json"]).toBe(0);
		expect(manifest["doubt_messages.json"]).toBe(0);
		expect(manifest["doubt_message_attachments.json"]).toBe(0);
	});
});
