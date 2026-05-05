"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { getServerUser } from "@/lib/auth/get-server-user";
import { PARENT_ACTIVE_STUDENT_COOKIE } from "@/lib/parent/active-student-cookie";
import { writeParentAudit } from "@/lib/parent/audit";
import { PARENT_ACTIONS } from "@/lib/parent/audit-actions";
import { assertParentActiveLink } from "@/lib/parent/linked-children";

const studentIdSchema = z.string().uuid();

export async function selectParentStudentAction(formData: FormData): Promise<void> {
	const raw = formData.get("studentId");
	const parsed = studentIdSchema.safeParse(typeof raw === "string" ? raw : "");
	if (!parsed.success) {
		redirect("/parent/select-student");
	}

	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const reqHeaders = await headers();
	const ip = clientIpFromHeaders(reqHeaders);
	const ua = reqHeaders.get("user-agent") ?? null;

	const linked = await assertParentActiveLink(user.id, parsed.data);
	if (!linked) {
		// A parent attempting to set the cookie to an unlinked student id is
		// a notable event — RLS would prevent any actual access, but the
		// attempt itself is worth recording in `parent_audit` for forensics
		// and surfaced to Sentry so operators can spot reconnaissance
		// patterns vs. legitimate stale-link UX.
		await writeParentAudit({
			action: PARENT_ACTIONS.SELECT_STUDENT_UNAUTHORIZED,
			parentId: user.id,
			targetType: "student",
			targetId: parsed.data,
			ipAddress: ip,
			userAgent: ua,
		});
		Sentry.captureMessage("parent.select_student.unauthorized", {
			level: "warning",
			tags: { feature: "parent.select_student", outcome: "unauthorized" },
		});
		redirect("/parent/select-student");
	}

	const jar = await cookies();
	jar.set(PARENT_ACTIVE_STUDENT_COOKIE, parsed.data, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * 60 * 24 * 400,
	});

	await writeParentAudit({
		action: PARENT_ACTIONS.SELECT_STUDENT,
		parentId: user.id,
		targetType: "student",
		targetId: parsed.data,
		ipAddress: ip,
		userAgent: ua,
	});

	revalidatePath("/parent", "layout");
	redirect("/parent/dashboard");
}
