import type { VisualTemplateDefinition } from "./shared";
import { template } from "./shared";

export const ENGLISH_VISUAL_TEMPLATES: VisualTemplateDefinition[] = [
	template({
		id: "english-line-source-extract",
		title: "Line-numbered passage",
		description: "Short passage, poem, dialogue, or case stimulus with line numbers.",
		subjects: ["English"],
		topicTags: ["passage", "poem", "dialogue", "comprehension", "source", "line"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "english_passage",
		priority: "essential",
		slotContract: {
			requiredSlots: ["lines"],
			optionalSlots: ["title", "source"],
			constraints: ["Line references in the stem must exist in the passage."],
		},
	}),
	template({
		id: "english-9-beehive-prose-extract",
		title: "Beehive prose extract",
		description: "Line-numbered extract from a Beehive prose chapter for 'with reference to the story…' comprehension stems.",
		subjects: ["English"],
		topicTags: ["beehive", "prose", "extract", "comprehension", "reference to the story", "narrative", "dialogue", "biography"],
		gradeBands: ["9-10"],
		kind: "english_passage",
		priority: "essential",
		slotContract: {
			requiredSlots: ["lines"],
			optionalSlots: ["title", "source"],
			constraints: [
				"Line numbers must match those referenced in the stem.",
				"Do not summarise the answer in caption or altText.",
			],
		},
		fallbackKind: "source_extract",
	}),
	template({
		id: "english-9-moments-story-extract",
		title: "Moments short-story extract",
		description: "Line-numbered extract from a Moments (supplementary reader) short story.",
		subjects: ["English"],
		topicTags: ["moments", "supplementary reader", "short story", "extract", "narrative", "lost child", "happy prince", "last leaf", "iswaran"],
		gradeBands: ["9-10"],
		kind: "english_passage",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["lines"],
			optionalSlots: ["title", "source"],
			constraints: [
				"Line numbers must match those referenced in the stem.",
				"Do not name the story's resolution in caption when that is the question.",
			],
		},
		fallbackKind: "source_extract",
	}),
];
