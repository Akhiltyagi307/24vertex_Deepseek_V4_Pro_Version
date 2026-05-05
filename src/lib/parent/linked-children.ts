import "server-only";

import { cache } from "react";

import { CACHED_APP_PROFILE_SELECT, type AppProfileRow } from "@/lib/auth/cached-profile";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

export type LinkedChildRow = AppProfileRow;

/**
 * Custom error thrown when the parent ↔ student link query fails (rather
 * than masquerading as "no children linked"). The previous behavior — return
 * `[]` on DB error — meant a transient Postgres hiccup rendered as a healthy
 * empty state in /parent/select-student, and the parent had no signal to
 * retry. By throwing, the page hits Next's error boundary
 * (/parent/error.tsx) and the user can refresh.
 */
export class LinkedChildrenLoadError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "LinkedChildrenLoadError";
		this.cause = cause;
	}
}

/**
 * Active linked students for the signed-in parent (RLS: parent_id = auth.uid()).
 *
 * Throws `LinkedChildrenLoadError` on DB failure. Callers MUST allow the
 * error to propagate so the parent error boundary renders a retryable UI.
 * Returning `[]` here would silently mask infrastructure issues.
 */
export const loadLinkedChildrenForParent = cache(async (parentUserId: string): Promise<LinkedChildRow[]> => {
	const supabase = await createClient();
	const { data: links, error: linkErr } = await supabase
		.from("parent_student_links")
		.select("student_id")
		.eq("parent_id", parentUserId)
		.eq("status", "active");

	if (linkErr) {
		logSupabaseError("loadLinkedChildrenForParent.links", linkErr, { parentUserId });
		throw new LinkedChildrenLoadError("Could not load linked children.", linkErr);
	}

	const ids = (links ?? []).map((r) => r.student_id as string).filter(Boolean);
	if (ids.length === 0) return [];

	const { data: profiles, error: profErr } = await supabase
		.from("profiles")
		.select(CACHED_APP_PROFILE_SELECT)
		.in("id", ids)
		.eq("role", "student");

	if (profErr) {
		logSupabaseError("loadLinkedChildrenForParent.profiles", profErr, { parentUserId });
		throw new LinkedChildrenLoadError("Could not load child profiles.", profErr);
	}

	return (profiles ?? []) as LinkedChildRow[];
});

export async function assertParentActiveLink(parentUserId: string, studentId: string): Promise<boolean> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("parent_student_links")
		.select("student_id")
		.eq("parent_id", parentUserId)
		.eq("student_id", studentId)
		.eq("status", "active")
		.maybeSingle();

	if (error) {
		logSupabaseError("assertParentActiveLink", error, { parentUserId, studentId });
		return false;
	}
	return Boolean(data);
}
