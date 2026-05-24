import { formatStreamLabel } from "@/lib/academic/stream-labels";

export type SubjectCatalogRow = {
	id: string;
	name: string;
	grade: number;
	stream: string | null;
};

/** Option label for subject pickers; includes stream for grades 11–12. */
export function formatSubjectCatalogOptionLabel(subject: SubjectCatalogRow): string {
	const gradePrefix = `Grade ${subject.grade}`;
	if (subject.grade >= 11 && subject.grade <= 12) {
		const streamLabel = formatStreamLabel(subject.stream);
		if (streamLabel) return `${gradePrefix} · ${streamLabel} · ${subject.name}`;
	}
	return `${gradePrefix} · ${subject.name}`;
}
