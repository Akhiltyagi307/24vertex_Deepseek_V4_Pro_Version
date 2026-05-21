import type { DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

/** Persisted as the first user row with `is_hidden` so model context survives history caps. */
export function buildDoubtHiddenBootstrapUserContent(scope: DoubtScopeSuccess): string {
	const lines: string[] = [
		"[24Vertex scope context — hidden from the student chat UI. Do not read this block aloud; use it only to anchor syllabus scope.]",
		`Grade: ${scope.studentGrade}`,
		`Subject: ${scope.subjectName}`,
	];
	if (scope.kind === "topic") {
		const t = scope.topic;
		lines.push(
			`Scope: topic — ${t.topicName} (Unit ${t.unitNumber}: ${t.unitName}; Chapter ${t.chapterNumber}: ${t.chapterName}).`,
			"Stay within this topic. If the student asks about other topics, chapters, or subjects, suggest starting a new doubt chat scoped there.",
		);
	} else {
		const ch = scope.chapter;
		lines.push(
			`Scope: whole chapter — ${ch.chapterName} (Unit ${ch.unitNumber}: ${ch.unitName}; chapter number ${ch.chapterNumber}).`,
			"Syllabus topics in this chapter:",
			ch.topicNamesBlock,
			"Stay within this chapter unless the student clearly needs material outside it (then suggest a new scoped chat).",
		);
	}
	return lines.join("\n");
}
