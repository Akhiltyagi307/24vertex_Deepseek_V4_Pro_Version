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
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { serializeOrganizationAdmin } from "@/lib/organizations/schemas";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "organization-favicons";
const MAX_FAVICON_BYTES = 512 * 1024;
const MIME_TO_EXT: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		const existing = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, uuid.data))
			.limit(1);
		if (!existing[0]) return adminErrorResponse("Organization not found", { status: 404 });

		let form: FormData;
		try {
			form = await request.formData();
		} catch {
			return adminErrorResponse("Invalid form data");
		}

		const file = form.get("file");
		if (!(file instanceof File)) {
			return adminErrorResponse("Missing favicon file");
		}
		if (file.size <= 0 || file.size > MAX_FAVICON_BYTES) {
			return adminErrorResponse("Favicon must be 512 KB or smaller");
		}

		const ext = MIME_TO_EXT[file.type];
		if (!ext) {
			return adminErrorResponse("Unsupported favicon type");
		}

		const supabase = createServiceRoleClient();
		const newPath = `${uuid.data}/favicon.${ext}`;

		// Delete any existing favicon files for this org before uploading so stale
		// files from a previous format (e.g. favicon.png when uploading favicon.webp)
		// are not left orphaned in storage.
		const { data: existingFiles } = await supabase.storage.from(BUCKET).list(uuid.data);
		if (existingFiles && existingFiles.length > 0) {
			const pathsToDelete = existingFiles.map((f) => `${uuid.data}/${f.name}`);
			await supabase.storage.from(BUCKET).remove(pathsToDelete);
		}

		const { error: uploadError } = await supabase.storage
			.from(BUCKET)
			.upload(newPath, file, {
				cacheControl: "31536000",
				contentType: file.type,
				upsert: true,
			});

		if (uploadError) {
			return adminErrorResponse("Favicon upload failed", { status: 502, details: uploadError.message });
		}

		const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
		const [updated] = await db
			.update(organizations)
			.set({ faviconUrl: data.publicUrl, updatedAt: new Date() })
			.where(eq(organizations.id, uuid.data))
			.returning();
		if (!updated) return adminErrorResponse("Update failed", { status: 500 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.ORGANIZATION_UPDATE,
			targetType: "organization",
			targetId: uuid.data,
			payload: { favicon_url: data.publicUrl },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse(serializeOrganizationAdmin(updated));
	});
}
