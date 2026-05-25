import "server-only";

import { cache } from "react";

import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

export type PendingParentLinkRow = {
	id: string;
	parent_id: string;
	parent_name: string | null;
	parent_email: string | null;
	created_at: string | null;
};

export const loadPendingParentLinksForStudent = cache(
	async (studentUserId: string): Promise<PendingParentLinkRow[]> => {
		const supabase = await createClient();
		const { data: links, error: linkErr } = await supabase
			.from("parent_student_links")
			.select("id, parent_id, created_at")
			.eq("student_id", studentUserId)
			.eq("status", "pending")
			.order("created_at", { ascending: false });

		if (linkErr) {
			logSupabaseError("loadPendingParentLinksForStudent.links", linkErr, { studentUserId });
			return [];
		}

		const rows = links ?? [];
		if (rows.length === 0) return [];

		const parentIds = rows.map((r) => r.parent_id as string).filter(Boolean);
		const { data: profiles, error: profErr } = await supabase
			.from("profiles")
			.select("id, full_name")
			.in("id", parentIds);

		if (profErr) {
			logSupabaseError("loadPendingParentLinksForStudent.profiles", profErr, { studentUserId });
			return rows.map((r) => ({
				id: r.id as string,
				parent_id: r.parent_id as string,
				parent_name: null,
				parent_email: null,
				created_at: (r.created_at as string | null) ?? null,
			}));
		}

		const byId = new Map(
			(profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]),
		);

		return rows.map((r) => {
			const parentId = r.parent_id as string;
			return {
				id: r.id as string,
				parent_id: parentId,
				parent_name: byId.get(parentId) ?? null,
				parent_email: null,
				created_at: (r.created_at as string | null) ?? null,
			};
		});
	},
);
