import "server-only";

import { redirect } from "next/navigation";

import {
	getVerifiedTeacherSession,
	type VerifiedTeacherSession,
} from "@/lib/auth/require-verified-teacher";

/**
 * Layout guard for teacher portal pages. Mirrors `requireParent` / `requireVerifiedStudent`.
 */
export async function requireVerifiedTeacher(): Promise<VerifiedTeacherSession> {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		if (session.code === "not_signed_in") {
			redirect("/login");
		}
		if (session.code === "suspended") {
			redirect("/login?suspended=1");
		}
		if (session.code === "not_verified") {
			redirect("/teacher/pending");
		}
		redirect("/login");
	}
	return session;
}
