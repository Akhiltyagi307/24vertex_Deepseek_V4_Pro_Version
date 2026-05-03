import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { topics } from "@/db/schema/academic";

/** Duplicate topics into a new grade in one transaction (same subject + hierarchy). */
export async function cloneTopicsToGrade(sourceTopicIds: string[], targetGrade: number): Promise<number> {
	if (sourceTopicIds.length === 0) return 0;

	return await db.transaction(async (tx) => {
		const src = await tx.select().from(topics).where(inArray(topics.id, sourceTopicIds));
		if (src.length !== sourceTopicIds.length) {
			throw new Error("One or more topic ids were not found");
		}
		const subjects = new Set(src.map((t) => t.subjectId));
		if (subjects.size !== 1) {
			throw new Error("All topics must belong to the same subject");
		}

		let inserted = 0;
		for (const t of src) {
			await tx.insert(topics).values({
				subjectId: t.subjectId,
				grade: targetGrade,
				unitName: t.unitName,
				unitNumber: t.unitNumber,
				chapterName: t.chapterName,
				chapterNumber: t.chapterNumber,
				topicName: t.topicName,
				topicNumber: t.topicNumber,
				description: t.description,
				learningObjectives: t.learningObjectives,
				metadata: t.metadata ?? {},
				isActive: t.isActive ?? true,
			});
			inserted += 1;
		}
		return inserted;
	});
}
