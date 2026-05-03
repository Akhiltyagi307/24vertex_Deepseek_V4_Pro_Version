export type RowDiff = { key: string; action: "insert" | "update" | "skip"; before?: Record<string, string>; after?: Record<string, string> };

/**
 * Compare incoming CSV rows to existing rows keyed by `keyField`.
 * `getExisting` returns a map key -> current row (string fields).
 */
export function previewTopicCsvDiff(
	keyField: string,
	incoming: Record<string, string>[],
	existing: Map<string, Record<string, string>>,
): RowDiff[] {
	const out: RowDiff[] = [];
	for (const row of incoming) {
		const key = (row[keyField] ?? "").trim();
		if (!key) {
			out.push({ key: "(empty)", action: "skip", after: row });
			continue;
		}
		const cur = existing.get(key);
		if (!cur) {
			out.push({ key, action: "insert", after: row });
			continue;
		}
		const changed = Object.keys(row).some((k) => (row[k] ?? "") !== (cur[k] ?? ""));
		if (changed) out.push({ key, action: "update", before: cur, after: row });
		else out.push({ key, action: "skip", after: row });
	}
	return out;
}
