import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { generateOrganizationLinkingCode } from "@/lib/organizations/linking-code";
import { listAdminOrganizations, organizationInputToDbValues } from "@/lib/organizations/queries";
import { adminOrganizationInputSchema, serializeOrganizationAdmin } from "@/lib/organizations/schemas";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const data = await listAdminOrganizations();
		return adminDetailResponse(data);
	});
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}

		const parsed = adminOrganizationInputSchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		const baseValues = organizationInputToDbValues(parsed.data);
		let row: typeof organizations.$inferSelect | undefined;
		for (let attempt = 0; attempt < 24; attempt++) {
			const linkingCode = generateOrganizationLinkingCode();
			try {
				const inserted = await db
					.insert(organizations)
					.values({
						...baseValues,
						linkingCode,
					})
					.returning();
				row = inserted[0];
				break;
			} catch (e) {
				const code = (e as { code?: string }).code;
				if (code === "23505") continue;
				throw e;
			}
		}
		if (!row) return adminErrorResponse("Could not allocate organization linking code.", { status: 500 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.ORGANIZATION_CREATE,
			targetType: "organization",
			targetId: row.id,
			payload: { name: row.name, type: row.type },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse(serializeOrganizationAdmin(row), { status: 201 });
	});
}
