import "server-only";

import { redirect } from "next/navigation";

import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { requireParent, type VerifiedParentSession } from "@/lib/auth/require-parent";
import {
	requireVerifiedStudent,
	type VerifiedStudentSession,
} from "@/lib/auth/require-verified-student";

export type RequireUserRole = "student" | "parent" | "teacher";

export type RequireUserResult =
	| { role: "student"; session: VerifiedStudentSession }
	| { role: "parent"; session: VerifiedParentSession }
	| { role: "teacher"; session: Awaited<ReturnType<typeof getVerifiedTeacherSession>> & { ok: true } };

/**
 * Thin dispatcher over role-specific guards. Layouts should pass `redirect: true`
 * (default); route handlers can use `getVerifiedTeacherSession` directly when they
 * need typed failure codes.
 */
export async function requireUser(args: {
	role: RequireUserRole;
	redirect?: boolean;
}): Promise<RequireUserResult> {
	const shouldRedirect = args.redirect !== false;

	if (args.role === "student") {
		const session = await requireVerifiedStudent();
		return { role: "student", session };
	}

	if (args.role === "parent") {
		const session = await requireParent();
		return { role: "parent", session };
	}

	const teacher = await getVerifiedTeacherSession();
	if (!teacher.ok) {
		if (shouldRedirect) {
			if (teacher.code === "not_signed_in") {
				redirect("/login");
			}
			if (teacher.code === "suspended") {
				redirect("/login?suspended=1");
			}
			if (teacher.code === "not_verified") {
				redirect("/teacher/pending");
			}
			redirect("/login");
		}
		throw new Error(teacher.message);
	}

	return { role: "teacher", session: teacher };
}
