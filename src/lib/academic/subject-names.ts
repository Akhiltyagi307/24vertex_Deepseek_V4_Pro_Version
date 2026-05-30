import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

/**
 * Resolve a set of subject ids to a `Map<subjectId, name>`. Returns an empty
 * map (no query) when the id list is empty. Used wherever assignment configs
 * carry a `subject_id` that needs a display name.
 */
export async function fetchSubjectNameMap(subjectIds: string[]): Promise<Map<string, string>> {
	if (subjectIds.length === 0) return new Map();
	const rows = await db
		.select({ id: subjects.id, name: subjects.name })
		.from(subjects)
		.where(inArray(subjects.id, subjectIds));
	return new Map(rows.map((r): [string, string] => [r.id, r.name]));
}
