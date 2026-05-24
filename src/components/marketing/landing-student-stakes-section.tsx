import { BookX, MessageCircleOff, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type StudentStake = {
	icon: LucideIcon;
	tag: string;
	title: string;
	body: string;
};

const STUDENT_STAKES: StudentStake[] = [
	{
		icon: MessageCircleOff,
		tag: "Silent doubts",
		title: "You have a question, but the room is not the place to ask it.",
		body: "By class 7, most of us stop raising our hand. Wrong answers feel expensive when everyone is watching. The doubt does not go away. It waits until you are alone with the textbook.",
	},
	{
		icon: Target,
		tag: "Wrong chapters",
		title: "You revise what feels familiar, not what is actually weak.",
		body: "Without a chapter-level map, it is easy to re-read the topics you already know and skip the two chapters that will show up on Thursday's test.",
	},
	{
		icon: BookX,
		tag: "Too late",
		title: "The unit test is often the first honest signal.",
		body: "School moves on whether you caught up or not. Finding out you were shaky on electrostatics after the paper is graded means revising backwards under time pressure.",
	},
];

export function LandingStudentStakesSection() {
	return (
		<section
			id="why-it-feels-hard"
			className="bg-background py-16 medium:py-20 xl:py-24"
			aria-labelledby="student-stakes-title"
		>
			<div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
				<div className={cn("mb-12 medium:mb-16", marketingSectionIntroWrapClassName)}>
					<Badge variant="outline" className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}>
						Not your fault
					</Badge>
					<h2
						id="student-stakes-title"
						className="text-3xl font-semibold tracking-tight text-foreground text-balance medium:text-4xl"
					>
						Three reasons studying harder does not always move your marks.
					</h2>
					<p className={cn(marketingSectionLeadClassName, "text-pretty")}>
						The classroom is built for the median. Your doubts are private. The syllabus does not wait.
						24Vertex is the layer that meets you where you actually study.
					</p>
				</div>

				<ul className="grid gap-4 medium:grid-cols-3 medium:gap-6">
					{STUDENT_STAKES.map((stake) => {
						const Icon = stake.icon;
						return (
							<li
								key={stake.tag}
								className={cn("flex flex-col gap-4 px-5 py-6 medium:px-6 medium:py-7", featureBentoCardSurfaceClassName)}
							>
								<div className="flex items-center gap-3">
									<span
										className="border-border bg-muted/45 ring-border/60 flex size-10 shrink-0 items-center justify-center rounded-xl border ring-1"
										aria-hidden
									>
										<Icon className="size-5 text-[var(--subject-grid-icon)]" strokeWidth={2} />
									</span>
									<span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
										{stake.tag}
									</span>
								</div>
								<h3 className="text-foreground text-pretty text-lg font-semibold tracking-tight medium:text-xl">
									{stake.title}
								</h3>
								<p className="text-muted-foreground text-pretty text-sm leading-relaxed medium:text-[15px]">
									{stake.body}
								</p>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}
