import type { UIMessage } from "ai";
import type { AttachmentRow } from "@/lib/doubt/attachments/types";

export type Enrolled = { id: string; name: string; subject_group: string | null; sort_order: number };

export type IconComponent = React.ComponentType<{
	className?: string;
	strokeWidth?: number;
	"aria-hidden"?: boolean;
}>;

export type UsageSummary = {
	totalPromptTokens: number;
	totalCompletionTokens: number;
	lastPromptTokens: number | null;
	lastCompletionTokens: number | null;
};

export type EntitlementSummary = {
	tokensUsed: number;
	tokensQuota: number;
	tokensLeft: number;
};

export type MessageAttachmentsByMessageId = Record<string, AttachmentRow[]>;

export type DoubtChatThreadProps = {
	conversationId: string;
	subjectId: string;
	topicId: string | null;
	subjectName: string | null;
	topicName: string | null;
	chapterName: string | null;
	initialMessages: UIMessage[];
	initialMessageAttachments: MessageAttachmentsByMessageId;
	initialUsage: UsageSummary;
	initialTutorMode: import("@/lib/doubt/doubt-tutor-mode").DoubtTutorMode;
	initialEntitlement: EntitlementSummary;
	/** Mobile: opens past-chats sheet from thread header */
	onOpenChats?: () => void;
	/**
	 * Called after an assistant turn finishes so the parent can bump this
	 * conversation to the top of the sidebar client-side, instead of a full
	 * `router.refresh()` that re-runs the whole doubt page bundle each turn.
	 */
	onConversationActivity?: (conversationId: string) => void;
};

/**
 * Suggested prompts shown in the empty state of a fresh chat.
 *
 * Mode-scoped because each mode has a different contract: showing
 * "Ask me 5 practice questions" while Explain mode is selected actively
 * contradicts the explain-mode system prompt, which is instructed not to
 * quiz the student.
 */
export const SUGGESTED_PROMPTS_BY_MODE = {
	explain: [
		"Give me a 3-line summary",
		"Explain the main idea in simple words",
		"What's a common exam trap here?",
	],
	solve_with_me: [
		"I have a problem to work through",
		"Where do I start with this?",
		"Check my approach",
	],
	quiz_me: [
		"Quiz me — 5 questions",
		"Mixed difficulty set, please",
		"Just MCQs to warm up",
	],
} as const satisfies Record<import("@/lib/doubt/doubt-tutor-mode").DoubtTutorMode, readonly string[]>;

/** @deprecated Use SUGGESTED_PROMPTS_BY_MODE keyed on the active tutor mode. */
export const SUGGESTED_PROMPTS = SUGGESTED_PROMPTS_BY_MODE.explain;

export function extractText(m: UIMessage): string {
	if (!m.parts) return "";
	return m.parts
		.map((p) => (p.type === "text" ? p.text : ""))
		.join("")
		.trim();
}
