"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { PARENT_ACTIVE_STUDENT_COOKIE } from "@/lib/parent/active-student-cookie";
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

	const linked = await assertParentActiveLink(user.id, parsed.data);
	if (!linked) {
		// A parent attempting to set the cookie to an unlinked student id is
		// a notable event — RLS would prevent any actual access, but the
		// attempt itself is worth surfacing in Sentry so we can spot
		// reconnaissance patterns vs. legitimate stale-link UX.
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

	// Successful switches don't emit a Sentry event — that would burn quota
	// for a high-frequency normal action. A future `parent_audit` table is
	// the right shape if/when stronger observability is needed; we only flag
	// unusual cases (above) for now.
	revalidatePath("/parent", "layout");
	redirect("/parent/dashboard");
}
