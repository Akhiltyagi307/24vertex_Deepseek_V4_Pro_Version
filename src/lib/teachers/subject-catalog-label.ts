import { STREAM_LABEL_OPTIONS, formatStreamLabel } from "@/lib/academic/stream-labels";

export type SubjectCatalogRow = {
	id: string;
	name: string;
	grade: number;
	stream: string | null;
};

export type SubjectCatalogPillOption = {
	value: string;
	label: string;
};

export type SubjectCatalogPillOptionGroup = {
	heading: string;
	options: SubjectCatalogPillOption[];
};

export type SubjectCatalogPillSelectModel = {
	/** Flat list for value lookup (trigger label uses full labels). */
	options: SubjectCatalogPillOption[];
	/** Grouped menu sections (grades 11–12 split by stream). */
	optionGroups: SubjectCatalogPillOptionGroup[];
};

const STREAM_SORT_INDEX = new Map(STREAM_LABEL_OPTIONS.map((o, i) => [o.value, i]));

function subjectCatalogGroupKey(subject: SubjectCatalogRow): string {
	if (subject.grade >= 11 && subject.grade <= 12) {
		return `${subject.grade}|${subject.stream ?? ""}`;
	}
	return String(subject.grade);
}

function subjectCatalogGroupHeading(grade: number, stream: string | null): string {
	if (grade >= 11 && grade <= 12) {
		const streamLabel = formatStreamLabel(stream);
		return streamLabel ? `Grade ${grade} · ${streamLabel}` : `Grade ${grade} · Common subjects`;
	}
	return `Grade ${grade}`;
}

function compareSubjectCatalogGroupKeys(a: string, b: string): number {
	const [gradeA, streamA = ""] = a.split("|");
	const [gradeB, streamB = ""] = b.split("|");
	const gradeDiff = Number(gradeA) - Number(gradeB);
	if (gradeDiff !== 0) return gradeDiff;

	const streamIndexA = streamA === "" ? -1 : (STREAM_SORT_INDEX.get(streamA) ?? 999);
	const streamIndexB = streamB === "" ? -1 : (STREAM_SORT_INDEX.get(streamB) ?? 999);
	if (streamIndexA !== streamIndexB) return streamIndexA - streamIndexB;
	return streamA.localeCompare(streamB);
}

/** Grouped subject options for teacher filter pills and wide dropdown menus. */
export function buildSubjectCatalogPillSelectModel(
	subjects: SubjectCatalogRow[],
	{ includeAll = true }: { includeAll?: boolean } = {},
): SubjectCatalogPillSelectModel {
	const byGroup = new Map<string, SubjectCatalogRow[]>();
	for (const subject of subjects) {
		const key = subjectCatalogGroupKey(subject);
		const list = byGroup.get(key) ?? [];
		list.push(subject);
		byGroup.set(key, list);
	}

	const optionGroups: SubjectCatalogPillOptionGroup[] = [...byGroup.keys()]
		.sort(compareSubjectCatalogGroupKeys)
		.map((key) => {
			const items = byGroup.get(key) ?? [];
			const first = items[0];
			return {
				heading: first ? subjectCatalogGroupHeading(first.grade, first.stream) : key,
				options: items.map((s) => ({ value: s.id, label: s.name })),
			};
		});

	const leading: SubjectCatalogPillOption[] = includeAll ? [{ value: "", label: "All subjects" }] : [];
	const options: SubjectCatalogPillOption[] = [
		...leading,
		...subjects.map((s) => ({ value: s.id, label: formatSubjectCatalogOptionLabel(s) })),
	];

	return { options, optionGroups };
}

/** Option label for subject pickers; includes stream for grades 11–12. */
export function formatSubjectCatalogOptionLabel(subject: SubjectCatalogRow): string {
	const gradePrefix = `Grade ${subject.grade}`;
	if (subject.grade >= 11 && subject.grade <= 12) {
		const streamLabel = formatStreamLabel(subject.stream);
		if (streamLabel) return `${gradePrefix} · ${streamLabel} · ${subject.name}`;
	}
	return `${gradePrefix} · ${subject.name}`;
}
