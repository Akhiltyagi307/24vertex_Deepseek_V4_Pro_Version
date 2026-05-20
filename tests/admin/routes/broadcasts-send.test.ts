import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const consumeAdminActionRateLimit = vi.fn(async () => ({
	allowed: true,
	remaining: 2,
	resetAt: new Date(Date.now() + 60_000),
	degraded: false,
}));

const broadcastSelectLimit = vi.fn();
const broadcastUpdateWhere = vi.fn(async () => undefined);
const listBroadcastRecipients = vi.fn(async () => [] as { id: string; email: string }[]);
const filterAllowedBroadcastRecipients = vi.fn(() => ({ inAppAllowed: [], emailAllowed: [] }));
const getNotificationPrefsForUsers = vi.fn(async () => ({}));
const sendHtmlEmailLogged = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { BROADCAST_SEND: "broadcast_send" },
}));
vi.mock("@/lib/admin/rate-limit-action", () => ({
	consumeAdminActionRateLimit,
	adminActionScope: ({ jti }: { jti?: string }) => `jti:${jti ?? "anon"}`,
}));
vi.mock("@/lib/admin/broadcast-markdown", () => ({
	broadcastBodyToEmailHtml: (md: string) => `<p>${md}</p>`,
}));
vi.mock("@/lib/admin/broadcast-audience", () => ({ listBroadcastRecipients }));
vi.mock("@/lib/admin/broadcast-recipient-filter", () => ({ filterAllowedBroadcastRecipients }));
vi.mock("@/lib/notifications/prefs", () => ({ getNotificationPrefsForUsers }));
vi.mock("@/lib/notifications/insert", () => ({ MAX_NOTIFICATION_BODY_LEN: 1000 }));
vi.mock("@/lib/email/send-html-email", () => ({ sendHtmlEmailLogged }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: broadcastSelectLimit }) }) }),
		update: () => ({ set: () => ({ where: broadcastUpdateWhere }) }),
		insert: () => ({ values: vi.fn(async () => undefined) }),
	},
}));

const BROADCAST_ID = "bcast-2";

const broadcastRow = {
	id: BROADCAST_ID,
	status: "draft",
	subject: "Subject",
	bodyMd: "Body",
	audienceJson: { kind: "all" },
	channelsJson: { in_app: true, email: false, priority_urgent: false },
};

describe("D32 Sprint B · POST /api/admin/broadcasts/[id]/send", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		broadcastSelectLimit.mockReset();
		broadcastUpdateWhere.mockClear();
		consumeAdminActionRateLimit.mockClear();
		consumeAdminActionRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 2,
			resetAt: new Date(Date.now() + 60_000),
			degraded: false,
		});
		listBroadcastRecipients.mockReset();
		listBroadcastRecipients.mockResolvedValue([]);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/send/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/send`),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(401);
		expect(consumeAdminActionRateLimit).not.toHaveBeenCalled();
	});

	it("429 when rate limited; broadcast not loaded", async () => {
		consumeAdminActionRateLimit.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 30_000),
			degraded: false,
		});
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/send/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/send`),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(429);
		expect(broadcastSelectLimit).not.toHaveBeenCalled();
	});

	it("404 when broadcast not found", async () => {
		broadcastSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/send/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/send`),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects already-sent broadcasts (idempotency at status level)", async () => {
		broadcastSelectLimit.mockResolvedValueOnce([{ ...broadcastRow, status: "sent" }]);
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/send/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/send`),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("happy path: strict audit then sends (zero recipients)", async () => {
		broadcastSelectLimit.mockResolvedValueOnce([broadcastRow]);
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/send/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/send`),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("broadcast_send");
		expect(audit.targetId).toBe(BROADCAST_ID);
	});
});
