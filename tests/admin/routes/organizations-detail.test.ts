import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const updateReturning = vi.fn();
const deactivateOrganizationWithCleanup = vi.fn<
	(id: string) => Promise<{
		organization: { name: string; type: string };
		studentIds: string[];
		teacherIds: string[];
	} | null>
>();
const notifyStudent = vi.fn(async () => {});
const notifyTeacher = vi.fn(async () => {});

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		ORGANIZATION_UPDATE: "organization_update",
		ORGANIZATION_SOFT_DELETE: "organization_soft_delete",
	},
}));
vi.mock("@/lib/organizations/queries", () => ({
	deactivateOrganizationWithCleanup,
	organizationInputToDbValues: (input: Record<string, unknown>) => input,
}));
vi.mock("@/lib/organizations/schemas", () => ({
	adminOrganizationInputSchema: z
		.object({
			type: z.enum(["school", "coaching", "other"]),
			name: z.string().min(1),
			external_id: z.string().nullable().optional(),
			favicon_url: z.string().nullable().optional(),
			is_active: z.boolean().optional(),
		})
		.strict(),
	serializeOrganizationAdmin: (row: unknown) => row,
}));
vi.mock("@/lib/notifications/organization-events", () => ({
	notifyStudentOrganizationChanged: notifyStudent,
	notifyTeacherOrganizationChanged: notifyTeacher,
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({
			set: () => ({ where: () => ({ returning: updateReturning }) }),
		}),
	},
}));

const ORG_UUID = "55555555-5555-4555-8555-555555555555";

describe("D32 Sprint C · organizations/[id] (GET + PATCH + DELETE)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		updateReturning.mockReset();
		deactivateOrganizationWithCleanup.mockReset();
		notifyStudent.mockClear();
		notifyTeacher.mockClear();
	});

	it("GET: 400 invalid UUID", async () => {
		const { GET } = await import("@/app/api/admin/organizations/[id]/route");
		const res = await GET(adminRequest("/api/admin/organizations/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res!.status).toBe(400);
	});

	it("GET: 404 when org not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/organizations/[id]/route");
		const res = await GET(adminRequest(`/api/admin/organizations/${ORG_UUID}`), {
			params: Promise.resolve({ id: ORG_UUID }),
		});
		expect(res!.status).toBe(404);
	});

	it("PATCH: 404 when org not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { PATCH } = await import("@/app/api/admin/organizations/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/organizations/${ORG_UUID}`, {
				body: { name: "New" },
			}),
			{ params: Promise.resolve({ id: ORG_UUID }) },
		);
		expect(res!.status).toBe(404);
	});

	it("PATCH: regular update + audits", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: ORG_UUID, name: "Old", type: "school", externalId: null, faviconUrl: null, isActive: true },
		]);
		updateReturning.mockResolvedValueOnce([
			{ id: ORG_UUID, name: "New", type: "school", isActive: true },
		]);
		const { PATCH } = await import("@/app/api/admin/organizations/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/organizations/${ORG_UUID}`, {
				body: { name: "New" },
			}),
			{ params: Promise.resolve({ id: ORG_UUID }) },
		);
		expect(res!.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("organization_update");
	});

	it("PATCH: is_active=false triggers deactivation path + audit + notifications", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: ORG_UUID, name: "Old", type: "school", externalId: null, faviconUrl: null, isActive: true },
		]);
		deactivateOrganizationWithCleanup.mockResolvedValueOnce({
			organization: { name: "Old", type: "school" },
			studentIds: ["stu-1", "stu-2"],
			teacherIds: ["tea-1"],
		});
		const { PATCH } = await import("@/app/api/admin/organizations/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/organizations/${ORG_UUID}`, {
				body: { is_active: false },
			}),
			{ params: Promise.resolve({ id: ORG_UUID }) },
		);
		expect(res!.status).toBe(200);
		expect(notifyStudent).toHaveBeenCalledTimes(2);
		expect(notifyTeacher).toHaveBeenCalledTimes(1);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { students_disconnected: number; teachers_disconnected: number };
		};
		expect(audit.action).toBe("organization_soft_delete");
		expect(audit.payload.students_disconnected).toBe(2);
		expect(audit.payload.teachers_disconnected).toBe(1);
	});

	it("DELETE: happy path deactivates + audits", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: ORG_UUID, name: "Old", type: "school" },
		]);
		deactivateOrganizationWithCleanup.mockResolvedValueOnce({
			organization: { name: "Old", type: "school" },
			studentIds: [],
			teacherIds: [],
		});
		const { DELETE } = await import("@/app/api/admin/organizations/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/organizations/${ORG_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: ORG_UUID }) },
		);
		expect(res!.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("organization_soft_delete");
	});
});
