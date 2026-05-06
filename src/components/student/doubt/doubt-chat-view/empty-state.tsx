import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { cn } from "@/lib/utils";

import { SUGGESTED_PROMPTS } from "./types";

export function EmptyState({
	topicName,
	onPick,
}: {
	topicName: string | null;
	onPick: (text: string) => void;
}) {
	return (
		<div className="flex w-full flex-col items-center gap-4 pt-4 medium:pt-8">
			<div className="flex w-full min-w-0 flex-col items-center gap-4 text-center">
				<div className="min-w-0 w-full space-y-1.5">
					<h3 className="text-foreground text-[17px] font-semibold tracking-tight">
						{topicName ? `Let's unpack ${topicName}` : "Let's unpack this topic together"}
					</h3>
					<PageHeaderSubtext variant="wrap" className="text-center">
						Ask about concepts, worked examples, or practice questions. Answers stay scoped to your
						curriculum for this chapter.
					</PageHeaderSubtext>
				</div>
				<div className="flex flex-wrap justify-center gap-2">
					{SUGGESTED_PROMPTS.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => onPick(p)}
							className={cn(
								"text-foreground/85 hover:text-foreground hover:bg-muted/70 border-border/70 bg-background rounded-full border px-3 py-1.5 text-[13px] transition-colors",
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
