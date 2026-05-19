import "server-only";

import { redirect } from "next/navigation";

import type {
	VerifiedTeacherSessionFailureCode,
	VerifiedTeacherSessionResult,
} from "@/lib/auth/require-verified-teacher";

const redirectForCode: Record<VerifiedTeacherSessionFailureCode, string> = {
	not_signed_in: "/login",
	not_teacher: "/login",
	suspended: "/login?suspended=1",
	not_verified: "/teacher/pending",
};

/**
 * Server-only redirect router for `getVerifiedTeacherSession` failures.
 * Centralizes the layout/page redirect map so individual teacher pages
 * cannot drift on the `is_suspended` branch the root layout currently
 * catches separately.
 */
export function handleVerifiedTeacherSessionFailure(
	result: Extract<VerifiedTeacherSessionResult, { ok: false }>,
): never {
	redirect(redirectForCode[result.code]);
}
