import type { UIMessage } from "ai";

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

export type DoubtChatThreadProps = {
	conversationId: string;
	subjectId: string;
	topicId: string;
	subjectName: string | null;
	topicName: string | null;
	chapterName: string | null;
	initialMessages: UIMessage[];
	initialUsage: UsageSummary;
	initialTutorMode: import("@/lib/doubt/doubt-tutor-mode").DoubtTutorMode;
	initialEntitlement: EntitlementSummary;
	/** Mobile: opens past-chats sheet from thread header */
	onOpenChats?: () => void;
};

export const SUGGESTED_PROMPTS = [
	"Give me a 3-line summary",
	"Explain the main idea in simple words",
	"Ask me 5 practice questions",
] as const;

export function extractText(m: UIMessage): string {
	if (!m.parts) return "";
	return m.parts
		.map((p) => (p.type === "text" ? p.text : ""))
		.join("")
		.trim();
}
