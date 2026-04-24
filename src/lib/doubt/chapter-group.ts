import type { DoubtChatTopicRow } from "@/lib/doubt/loaders";

export const chapterKeyFromRow = (t: DoubtChatTopicRow) => `${t.unitNumber}:${t.chapterNumber}`;

/**
 * Group flat topic rows into chapter groups for select UI.
 */
export function groupTopicRowsByChapter(topics: DoubtChatTopicRow[]) {
	const map = new Map<
		string,
		{
			key: string;
			label: string;
			unitNumber: number;
			chapterNumber: number;
			topics: DoubtChatTopicRow[];
		}
	>();
	for (const t of topics) {
		const key = chapterKeyFromRow(t);
		const label = `Ch ${t.chapterNumber}: ${t.chapterName}`;
		const g = map.get(key);
		if (g) {
			g.topics.push(t);
		} else {
			map.set(key, {
				key,
				label,
				unitNumber: t.unitNumber,
				chapterNumber: t.chapterNumber,
				topics: [t],
			});
		}
	}
	for (const g of map.values()) {
		g.topics.sort((a, b) => a.topicNumber - b.topicNumber);
	}
	return [...map.values()].sort((a, b) =>
		a.unitNumber !== b.unitNumber
			? a.unitNumber - b.unitNumber
			: a.chapterNumber - b.chapterNumber,
	);
}
