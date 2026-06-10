import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { tests } from "@/db/schema/assessment";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { getServerUser } from "@/lib/auth/get-server-user";
import { PARENT_ACTIVE_STUDENT_COOKIE } from "@/lib/parent/active-student-cookie";
import { writeParentAudit } from "@/lib/parent/audit";
import { PARENT_ACTIONS } from "@/lib/parent/audit-actions";
import { assertParentActiveLink } from "@/lib/parent/linked-children";

const ALL_ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const uuid = z
	.string()
	.uuid()
	.refine((s) => s !== ALL_ZERO_UUID, { message: "UUID must not be all-zero." });

/**
 * Sets the parent portal active-student cookie, then redirects to the test
 * reports view. Invoked from parent notification CTAs so the correct child
 * is selected before opening a report.
 *
 * Stale or malformed links fall through to /parent/notifications; obviously
 * adversarial inputs (all-zero UUID, missing UUID shape) get a 400.
 */
export async function GET(request: Request) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const url = new URL(request.url);
	const studentRaw = url.searchParams.get("student");
	const testRaw = url.searchParams.get("test");

	if (!studentRaw || !testRaw) {
		return NextResponse.json(
			{ error: "Missing student or test parameter." },
			{ status: 400 },
		);
	}

	const studentParsed = uuid.safeParse(studentRaw);
	const testParsed = uuid.safeParse(testRaw);
	if (!studentParsed.success || !testParsed.success) {
		// Likely a stale or copy-pasted link — bounce to notifications, not 400,
		// so the user sees something useful rather than a dead end.
		redirect("/parent/notifications");
	}

	return Sentry.startSpan(
		{ name: "parent.open_report", op: "function" },
		async () => {
			const linked = await assertParentActiveLink(user.id, studentParsed.data);
			if (!linked) {
				redirect("/parent/select-student");
			}

			// Confirm the test belongs to the linked student before writing the
				// audit row / redirecting — otherwise a linked parent could poison
				// `parent_audit` with an arbitrary test id. The link is already
				// verified above; this is a pure ownership check.
				const [testRow] = await db
					.select({ id: tests.id })
					.from(tests)
					.where(and(eq(tests.id, testParsed.data), eq(tests.studentId, studentParsed.data)))
					.limit(1);
				if (!testRow) {
					redirect("/parent/notifications");
				}

				const jar = await cookies();
			jar.set(PARENT_ACTIVE_STUDENT_COOKIE, studentParsed.data, {
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
				// 90-day TTL. Mirrors the value in `select-student/actions.ts` —
				// rewritten on each open-report so active parents stay logged-in.
				maxAge: 60 * 60 * 24 * 90,
			});

			const reqHeaders = await headers();
			await writeParentAudit({
				action: PARENT_ACTIONS.REPORT_OPENED,
				parentId: user.id,
				targetType: "test",
				targetId: testParsed.data,
				payload: { student_id: studentParsed.data, source: "open_report_route" },
				ipAddress: clientIpFromHeaders(reqHeaders),
				userAgent: reqHeaders.get("user-agent") ?? null,
			});

			redirect(`/parent/reports?test=${encodeURIComponent(testParsed.data)}`);
		},
	);
}
