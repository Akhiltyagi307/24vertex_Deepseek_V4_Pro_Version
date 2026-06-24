import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { createAnonClient } from "@/lib/supabase/anon";
import { SUBJECTS_CATALOG_CACHE_TAG } from "@/lib/teachers/subjects-catalog";

const CURRICULUM_TOPICS_TAG = "curriculum-topics";
const PAGE_SIZE = 1000;

/**
 * Topic counts per subject for a grade (active topics only).
 *
 * `unstable_cache` work-units cannot read request cookies, so the per-request
 * `@/lib/supabase/server` client is unusable here. Previously this used the
 * service-role client, but `public.topics` is anon-readable via RLS — the
 * service role added no security benefit and tied the cache to the
 * service-role key. Switched to anon-key (`createAnonClient`) so the cache
 * runs at the lowest privilege that can still see the data.
 *
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
			const supabase = createAnonClient();
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
	// Subject create/edit/activate/reorder also changes the cached active-subjects
	// catalog (teacher roster filters). Bust it here so the same admin mutations
	// that already call this helper refresh both caches in one place.
	revalidateTag(SUBJECTS_CATALOG_CACHE_TAG, "max");
}
