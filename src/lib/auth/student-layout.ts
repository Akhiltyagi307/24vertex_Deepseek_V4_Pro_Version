import "server-only";

import type { AppProfileRow } from "@/lib/auth/cached-profile";

/** Maps a cached `profiles` row to student shell props (use `getCachedAppProfileRow` once per request). */

export type StudentLayoutContext = {
	fullName: string | null;
	email: string;
	schoolName: string | null;
	avatarUrl: string | null;
	grade: number | null;
	section: string | null;
	studentLinkCode: string | null;
};

export function mapAppProfileToStudentLayoutContext(
	row: AppProfileRow,
	email: string | undefined,
): StudentLayoutContext {
	return {
		fullName: row.full_name?.trim() ? row.full_name : null,
		email: email ?? "",
		schoolName: row.school_name,
		avatarUrl: row.avatar_url,
		grade: row.grade,
		section: row.section,
		studentLinkCode: row.student_link_code ?? null,
	};
}
