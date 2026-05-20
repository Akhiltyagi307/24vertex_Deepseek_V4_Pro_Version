import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const setOperatorQueuePaused = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		OPERATOR_QUEUE_PAUSE: "operator_queue_pause",
		OPERATOR_QUEUE_RESUME: "operator_queue_resume",
	},
}));
vi.mock("@/lib/jobs/operator-queue-pause", () => ({ setOperatorQueuePaused }));

describe("D32 Sprint C · jobs/queues/[name]/pause + resume", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		setOperatorQueuePaused.mockClear();
	});

	it("pause: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/pause/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/practice/pause", { method: "POST" }), {
			params: Promise.resolve({ name: "practice" }),
		});
		expect(res.status).toBe(401);
	});

	it("pause: happy path pauses + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/pause/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/practice/pause", { method: "POST" }), {
			params: Promise.resolve({ name: "practice" }),
		});
		expect(res.status).toBe(200);
		expect(setOperatorQueuePaused).toHaveBeenCalledWith("practice", true);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("operator_queue_pause");
		expect(audit.targetId).toBe("practice");
	});

	it("resume: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/resume/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/practice/resume", { method: "POST" }), {
			params: Promise.resolve({ name: "practice" }),
		});
		expect(res.status).toBe(401);
	});

	it("resume: happy path resumes + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/jobs/queues/[name]/resume/route");
		const res = await POST(adminRequest("/api/admin/jobs/queues/practice/resume", { method: "POST" }), {
			params: Promise.resolve({ name: "practice" }),
		});
		expect(res.status).toBe(200);
		expect(setOperatorQueuePaused).toHaveBeenCalledWith("practice", false);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("operator_queue_resume");
	});
});
