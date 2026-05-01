/** Shared doubt conversation list grouping + labels (client-safe; no server-only imports). */

export type DoubtConversationListRow = {
	id: string;
	title: string | null;
	updatedAt: string;
	subjectName: string;
};

export type ConversationGroup = { label: string; rows: DoubtConversationListRow[] };

/** Titles are stored as "TopicName — Subject name" (see createDoubtConversation). Split for hierarchy in the list. */
export function parseDoubtChatListLabel(row: DoubtConversationListRow): {
	headline: string;
	subjectMeta: string | null;
} {
	const title = (row.title ?? "").trim();
	const subject = (row.subjectName ?? "").trim();

	if (!title) {
		return { headline: "Chat", subjectMeta: subject || null };
	}

	const parts = title.split(/\s[—–]\s/);
	if (parts.length >= 2) {
		const left = parts[0] ?? "";
		const right = parts.slice(1).join(" — ").trim();
		return {
			headline: left.trim() || title,
			subjectMeta: right || null,
		};
	}

	if (subject && !title.toLowerCase().includes(subject.toLowerCase())) {
		return { headline: title, subjectMeta: subject };
	}
	return { headline: title, subjectMeta: null };
}

export function groupConversationsByRecency(
	rows: readonly DoubtConversationListRow[],
): ConversationGroup[] {
	if (rows.length === 0) return [];
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const oneDay = 86_400_000;
	const startOfYesterday = startOfToday - oneDay;
	const startOfLast7 = startOfToday - 6 * oneDay;
	const startOfLast30 = startOfToday - 29 * oneDay;

	const buckets: Record<string, DoubtConversationListRow[]> = {
		Today: [],
		Yesterday: [],
		"Previous 7 days": [],
		"Previous 30 days": [],
		Older: [],
	};

	for (const row of rows) {
		const t = new Date(row.updatedAt).getTime();
		if (Number.isNaN(t)) {
			buckets.Older.push(row);
			continue;
		}
		if (t >= startOfToday) buckets.Today.push(row);
		else if (t >= startOfYesterday) buckets.Yesterday.push(row);
		else if (t >= startOfLast7) buckets["Previous 7 days"].push(row);
		else if (t >= startOfLast30) buckets["Previous 30 days"].push(row);
		else buckets.Older.push(row);
	}

	const order = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];
	return order
		.map((label) => ({ label, rows: buckets[label] }))
		.filter((g) => g.rows.length > 0);
}
