import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { PARENT_ACTIVE_STUDENT_COOKIE } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";

const uuid = z.string().uuid();

/**
 * Sets the parent portal active-student cookie, then redirects to Test reports
 * with the given practice test. Used by parent notification CTAs so the
 * correct child is selected before opening a report.
 */
export async function GET(request: Request) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const url = new URL(request.url);
	const studentRaw = url.searchParams.get("student");
	const testRaw = url.searchParams.get("test");
	const studentParsed = uuid.safeParse(studentRaw ?? "");
	const testParsed = uuid.safeParse(testRaw ?? "");
	if (!studentParsed.success || !testParsed.success) {
		redirect("/parent/notifications");
	}

	const linked = await assertParentActiveLink(user.id, studentParsed.data);
	if (!linked) {
		redirect("/parent/select-student");
	}

	const jar = await cookies();
	jar.set(PARENT_ACTIVE_STUDENT_COOKIE, studentParsed.data, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * 60 * 24 * 400,
	});

	redirect(`/parent/reports?test=${encodeURIComponent(testParsed.data)}`);
}
