/** Title-case each whitespace-delimited segment for display (e.g. "akhil tyagi" → "Akhil Tyagi"). */
export function formatPersonDisplayName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "";
	return trimmed
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}
