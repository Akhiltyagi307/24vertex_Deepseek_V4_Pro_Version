import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { adminAckResponse, adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminOrganizationInputSchema, serializeOrganizationAdmin } from "@/lib/organizations/schemas";
import {
	deactivateOrganizationWithCleanup,
	organizationInputToDbValues,
	type DeactivateOrganizationResult,
} from "@/lib/organizations/queries";
import {
	notifyStudentOrganizationChanged,
	notifyTeacherOrganizationChanged,
} from "@/lib/notifications/organization-events";

export const runtime = "nodejs";

async function resolveOrganization(id: string) {
	const uuid = z.string().uuid().safeParse(id);
	if (!uuid.success) return { error: adminErrorResponse("Invalid id") } as const;
	const rows = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, uuid.data))
		.limit(1);
	const row = rows[0];
	if (!row) return { error: adminErrorResponse("Organization not found", { status: 404 }) } as const;
	return { id: uuid.data, row } as const;
}

/** Shared logic for PATCH (is_active: false) and DELETE — deactivates, audits, notifies. */
async function runDeactivation(
	resolvedId: string,
	request: NextRequest,
): Promise<{ result: DeactivateOrganizationResult } | { error: NextResponse }> {
	const result = await deactivateOrganizationWithCleanup(resolvedId);
	if (!result) return { error: adminErrorResponse("Organization not found", { status: 404 }) };

	await writeAdminAction({
		action: ADMIN_ACTIONS.ORGANIZATION_SOFT_DELETE,
		targetType: "organization",
		targetId: resolvedId,
		payload: {
			name: result.organization.name,
			type: result.organization.type,
			students_disconnected: result.studentIds.length,
			teachers_disconnected: result.teacherIds.length,
		},
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	await Promise.allSettled([
		...result.studentIds.map((studentId) =>
			notifyStudentOrganizationChanged({
				studentId,
				organizationId: resolvedId,
				organizationName: result.organization.name,
				action: "deactivated",
			}),
		),
		...result.teacherIds.map((teacherId) =>
			notifyTeacherOrganizationChanged({
				teacherId,
				organizationId: resolvedId,
				organizationName: result.organization.name,
				action: "deactivated",
			}),
		),
	]);

	return { result };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const resolved = await resolveOrganization(id);
		if ("error" in resolved) return resolved.error;

		return adminDetailResponse(serializeOrganizationAdmin(resolved.row));
	});
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const resolved = await resolveOrganization(id);
		if ("error" in resolved) return resolved.error;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}

		if (typeof body !== "object" || body === null) {
			return adminErrorResponse("Invalid body");
		}
		const b = body as Record<string, unknown>;
		const merged = {
			type: b.type ?? resolved.row.type,
			name: b.name ?? resolved.row.name,
			external_id: b.external_id ?? resolved.row.externalId,
			favicon_url: b.favicon_url ?? resolved.row.faviconUrl,
			is_active: b.is_active ?? resolved.row.isActive,
		};
		const parsed = adminOrganizationInputSchema.safeParse(merged);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		if (parsed.data.is_active === false && resolved.row.isActive) {
			const deactivated = await runDeactivation(resolved.id, request);
			if ("error" in deactivated) return deactivated.error;
			return adminDetailResponse(deactivated.result.organization);
		}

		const [updated] = await db
			.update(organizations)
			.set(organizationInputToDbValues(parsed.data))
			.where(eq(organizations.id, resolved.id))
			.returning();
		if (!updated) return adminErrorResponse("Update failed", { status: 500 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.ORGANIZATION_UPDATE,
			targetType: "organization",
			targetId: resolved.id,
			payload: { name: updated.name, type: updated.type, is_active: updated.isActive },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse(serializeOrganizationAdmin(updated));
	});
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const resolved = await resolveOrganization(id);
		if ("error" in resolved) return resolved.error;

		const deactivated = await runDeactivation(resolved.id, request);
		if ("error" in deactivated) return deactivated.error;

		return adminAckResponse();
	});
}
