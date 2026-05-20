import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const revalidateCurriculumTopicCaches = vi.fn();
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TOPIC_BULK: "topic_bulk" },
}));
vi.mock("@/lib/cache/curriculum-topic-counts", () => ({ revalidateCurriculumTopicCaches }));
vi.mock("@/db", () => ({
	db: {
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const VALID_UUID_1 = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("D32 Sprint B · POST /api/admin/topics/bulk", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		revalidateCurriculumTopicCaches.mockClear();
		updateWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/topics/bulk/route");
		const res = await POST(
			adminRequest("/api/admin/topics/bulk", {
				body: { action: "deactivate", ids: [VALID_UUID_1] },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects unknown action (discriminated union)", async () => {
		const { POST } = await import("@/app/api/admin/topics/bulk/route");
		const res = await POST(
			adminRequest("/api/admin/topics/bulk", {
				body: { action: "totally-fake", ids: [VALID_UUID_1] },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects empty ids array (min(1))", async () => {
		const { POST } = await import("@/app/api/admin/topics/bulk/route");
		const res = await POST(
			adminRequest("/api/admin/topics/bulk", {
				body: { action: "activate", ids: [] },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys on union member (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/topics/bulk/route");
		const res = await POST(
			adminRequest("/api/admin/topics/bulk", {
				body: { action: "activate", ids: [VALID_UUID_1], extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("activate happy path: updates + audits + revalidates", async () => {
		const { POST } = await import("@/app/api/admin/topics/bulk/route");
		const res = await POST(
			adminRequest("/api/admin/topics/bulk", {
				body: { action: "activate", ids: [VALID_UUID_1, VALID_UUID_2] },
			}),
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { action: string; count: number };
		};
		expect(audit.action).toBe("topic_bulk");
		expect(audit.payload.action).toBe("activate");
		expect(audit.payload.count).toBe(2);
	});

	it("deactivate happy path", async () => {
		const { POST } = await import("@/app/api/admin/topics/bulk/route");
		const res = await POST(
			adminRequest("/api/admin/topics/bulk", {
				body: { action: "deactivate", ids: [VALID_UUID_1] },
			}),
		);
		expect(res.status).toBe(200);
		expect(writeAdminAction).toHaveBeenCalled();
	});
});
