import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/admin";

const CURRICULUM_TOPICS_TAG = "curriculum-topics";
const PAGE_SIZE = 1000;

/**
 * Topic counts per subject for a grade (active topics only). Uses the Supabase
 * service client (same project as auth) with `unstable_cache` — avoids a
 * separate `DATABASE_URL` Postgres session, which often misconfigures locally
 * (pooler user/password) while `SUPABASE_SERVICE_ROLE_KEY` is already required.
 * Call from server loaders only.
 */
export async function getCachedTopicCountsBySubjectForGrade(
	grade: number,
	subjectIds: string[],
): Promise<Map<string, number>> {
	const sorted = [...subjectIds].sort();
	if (sorted.length === 0) {
		return new Map();
	}

	const record = await unstable_cache(
		async () => {
			const supabase = createServiceRoleClient();
			const out: Record<string, number> = {};
			let from = 0;

			for (;;) {
				const { data, error } = await supabase
					.from("topics")
					.select("subject_id")
					.eq("grade", grade)
					.eq("is_active", true)
					.in("subject_id", sorted)
					.range(from, from + PAGE_SIZE - 1);

				if (error) {
					throw new Error(`topic counts: ${error.message}`);
				}

				const batch = data ?? [];
				for (const row of batch) {
					const sid = row.subject_id;
					out[sid] = (out[sid] ?? 0) + 1;
				}

				if (batch.length < PAGE_SIZE) {
					break;
				}
				from += PAGE_SIZE;
			}

			return out;
		},
		["curriculum-topic-counts", String(grade), sorted.join(",")],
		{ revalidate: 3600, tags: [CURRICULUM_TOPICS_TAG] },
	)();

	return new Map(Object.entries(record).map(([k, v]) => [k, v]));
}

/** Call from trusted admin/server actions when curriculum rows change (optional). */
export function revalidateCurriculumTopicCaches(): void {
	revalidateTag(CURRICULUM_TOPICS_TAG, "max");
}
