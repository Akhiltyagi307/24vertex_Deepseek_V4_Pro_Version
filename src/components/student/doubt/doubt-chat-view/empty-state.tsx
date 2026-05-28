import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { cn } from "@/lib/utils";

import { SUGGESTED_PROMPTS_BY_MODE } from "./types";

const HEADLINE_BY_MODE: Record<DoubtTutorMode, (scope: string) => string> = {
	explain: (scope) => `Let's unpack ${scope}`,
	solve_with_me: (scope) => `Solve a problem on ${scope}`,
	quiz_me: (scope) => `Quiz yourself on ${scope}`,
};

const SUBTEXT_BY_MODE: Record<DoubtTutorMode, string> = {
	explain:
		"Ask about concepts, worked examples, or definitions. Answers stay scoped to your curriculum for this chapter.",
	solve_with_me:
		"Paste or describe a problem and I'll coach you through it step by step — not just hand you the answer.",
	quiz_me:
		"Active recall practice. I ask one question at a time, grade your answer, and tell you where you're weak.",
};

export function EmptyState({
	topicName,
	chapterName,
	tutorMode,
	onPick,
}: {
	topicName: string | null;
	chapterName: string | null;
	tutorMode: DoubtTutorMode;
	onPick: (text: string) => void;
}) {
	const scopeLabel = topicName ?? chapterName ?? "this chapter";
	const prompts = SUGGESTED_PROMPTS_BY_MODE[tutorMode];
	const headline = HEADLINE_BY_MODE[tutorMode](scopeLabel);
	const subtext = SUBTEXT_BY_MODE[tutorMode];
	return (
		<div className="flex w-full flex-col items-center gap-4 pt-4 medium:pt-8">
			<div className="flex w-full min-w-0 flex-col items-center gap-4 text-center medium:w-1/2">
				<div className="min-w-0 w-full space-y-1.5">
					<h3 className="text-foreground text-[17px] font-semibold tracking-tight">
						{headline}
					</h3>
					<PageHeaderSubtext variant="wrap" className="text-center">
						{subtext}
					</PageHeaderSubtext>
				</div>
				<div
					className={cn(
						"flex w-full min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
						"snap-x snap-mandatory px-1",
						"medium:flex-wrap medium:justify-center medium:overflow-visible medium:px-0 medium:pb-0 medium:snap-none",
					)}
				>
					{prompts.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => onPick(p)}
							className={cn(
								"text-foreground/85 hover:text-foreground hover:bg-muted/70 border-border/70 bg-background shrink-0 snap-start rounded-full border px-3 py-2 text-left text-[13px] transition-colors",
								"min-h-10 medium:min-h-0 medium:py-1.5",
								"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
							)}
						>
							{p}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
