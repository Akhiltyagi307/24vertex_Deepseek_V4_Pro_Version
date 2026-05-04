/** Formats an ISO timestamp as a short "2h ago" style label. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
	const t = new Date(iso).getTime();
	if (!Number.isFinite(t)) return "";
	const deltaSeconds = Math.max(0, Math.round((now.getTime() - t) / 1000));
	if (deltaSeconds < 45) return "just now";
	const minutes = Math.round(deltaSeconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days}d ago`;
	const weeks = Math.round(days / 7);
	if (weeks < 5) return `${weeks}w ago`;
	const months = Math.round(days / 30);
	if (months < 12) return `${months}mo ago`;
	const years = Math.round(days / 365);
	return `${years}y ago`;
}
