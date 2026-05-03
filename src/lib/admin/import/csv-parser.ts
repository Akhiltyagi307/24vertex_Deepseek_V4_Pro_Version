import Papa from "papaparse";

export type ParsedCsv<T extends Record<string, string>> = {
	rows: T[];
	errors: string[];
};

/**
 * Parses CSV with header row. Values are trimmed strings; dialect is inferred by Papa.
 */
export function parseCsvWithHeader<T extends Record<string, string>>(raw: string): ParsedCsv<T> {
	const parsed = Papa.parse<Record<string, string>>(raw, {
		header: true,
		skipEmptyLines: "greedy",
		transformHeader: (h) => h.trim(),
		transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
	});
	const errors = (parsed.errors ?? []).map((e) => e.message ?? "parse error");
	const rows = (parsed.data ?? []).filter((r) => Object.keys(r).some((k) => (r[k] ?? "").length > 0)) as T[];
	return { rows, errors };
}
