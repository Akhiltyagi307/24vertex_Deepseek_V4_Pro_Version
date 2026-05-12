/** UTC label for practice report titles (bell + email). */
export function formatPracticeReportSubmittedLabel(iso: string | null | undefined): string | null {
	if (!iso) return null;
	try {
		let normalized = iso.trim();
		// Postgres sometimes emits offsets without minutes (+00). ECMA Date parsing is flaky there.
		if (/[+-]\d{2}$/.test(normalized)) {
			normalized = `${normalized}:00`;
		}
		const d = new Date(normalized);
		if (Number.isNaN(d.getTime())) return null;
		return new Intl.DateTimeFormat("en-GB", {
			month: "short",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		}).format(d);
	} catch {
		return null;
	}
}
