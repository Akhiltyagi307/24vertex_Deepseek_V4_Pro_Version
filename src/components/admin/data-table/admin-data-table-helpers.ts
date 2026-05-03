/** Escape CSV field per RFC-style (quotes + double quotes). */
export function escapeCsvCell(value: unknown): string {
	if (value == null) return "";
	const s = String(value);
	if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

export function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
	const lines = [headers.map(escapeCsvCell).join(",")];
	for (const row of rows) {
		lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
	}
	return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
	downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json");
}
