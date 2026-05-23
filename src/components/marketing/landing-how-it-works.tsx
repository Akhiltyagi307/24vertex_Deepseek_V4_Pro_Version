import Link from "next/link";
import {
	BarChart3,
	BrainCircuit,
	MessageCircleQuestion,
	type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GlowCard } from "@/components/ui/spotlight-card";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type HowItWorksPillar = {
	icon: LucideIcon;
	step: string;
	title: string;
	body: string;
	bullets: string[];
	answersTo: string;
	deepLink?: { href: string; label: string };
};

const PILLARS: HowItWorksPillar[] = [
	{
		icon: BrainCircuit,
		step: "01",
		title: "Adaptive AI practice",
		body: "Questions get harder when your child is ready and easier when they are not. Built for the chapters in their actual textbook, not a generic syllabus.",
		bullets: [
			"Tuned to CBSE, ICSE, and state boards",
			"Targets the chapters your school is teaching this term",
			"5 practice tests in the free trial alone",
		],
		answersTo: "Solves: every child is taught the same way",
		deepLink: { href: "/adaptive-practice", label: "How adaptive practice works" },
	},
	{
		icon: BarChart3,
		step: "02",
		title: "Live performance analytics",
		body: "After every test, you, your child, and their teacher see the same chapter-by-chapter heatmap. Strong, weak, and guessing, in plain language. No more screenshots in WhatsApp groups.",
		bullets: [
			"Topic-level mastery, not just an overall percentage",
			"Refreshed within minutes of every practice session",
			"One source of truth across home and classroom",
		],
		answersTo: "Solves: you find out too late",
		deepLink: { href: "/parent-dashboard", label: "See the parent dashboard" },
	},
	{
		icon: MessageCircleQuestion,
		step: "03",
		title: "A private AI tutor that does not roll its eyes",
		body: "Two modes: Explain, when your child wants the chapter broken down. Solve with me, when they want to be coached through a sum step by step. Available the moment a doubt shows up.",
		bullets: [
			"Private chats. Nobody in their class is watching",
			"Patient with wrong answers, never sarcastic",
			"Trained on the way Indian boards actually ask questions",
		],
		answersTo: "Solves: questions they will not ask out loud",
		deepLink: { href: "/ai-tutor", label: "See both tutor modes in action" },
	},
];

const sectionTitle =
	"text-3xl font-semibold tracking-tight text-foreground medium:text-4xl";
const sectionLead = marketingSectionLeadClassName;

export function LandingHowItWorks() {
	return (
		<section
			id="how-it-works"
			className="bg-background py-16 medium:py-20 xl:py-24"
			aria-labelledby="how-it-works-title"
		>
			<div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
				<div className={cn("mb-12 medium:mb-14", marketingSectionIntroWrapClassName)}>
					<Badge
						variant="outline"
						className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}
					>
						The fix
					</Badge>
					<h2 id="how-it-works-title" className={cn(sectionTitle, "text-balance")}>
						Three things 24Vertex does every week that no school can.
					</h2>
					<p className={cn(sectionLead, "text-pretty")}>
						Not a coaching class. Not another PDF. A working layer that sits beside your
						child&rsquo;s school and quietly catches what the school does not have time to.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 medium:gap-5 xl:grid-cols-3">
					{PILLARS.map((pillar) => {
						const Icon = pillar.icon;
						return (
							<GlowCard
								key={pillar.title}
								glowColor="green"
								customSize
								className={cn(
									"h-full overflow-hidden rounded-[12px] border p-6 medium:p-7",
									featureBentoCardSurfaceClassName,
								)}
							>
								<div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
									<div className="flex items-center justify-between gap-3">
										<span
											className="border-border bg-muted/45 ring-border/60 flex size-11 shrink-0 items-center justify-center rounded-xl border ring-1"
											aria-hidden
										>
											<Icon
												className="size-5 text-[var(--subject-grid-icon)]"
												strokeWidth={2}
											/>
										</span>
										<span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground/70">
											{pillar.step}
										</span>
									</div>
									<h3 className="text-xl font-semibold tracking-tight text-card-foreground medium:text-2xl">
										{pillar.title}
									</h3>
									<p className="text-muted-foreground text-pretty text-[0.9375rem] leading-relaxed medium:text-base">
										{pillar.body}
									</p>
									<ul className="mt-1 space-y-2 text-sm text-foreground/85 medium:text-[0.9375rem]">
										{pillar.bullets.map((bullet) => (
											<li key={bullet} className="flex items-start gap-2.5">
												<span
													className="mt-[7px] inline-block size-1.5 shrink-0 rounded-full bg-[var(--subject-grid-icon)]"
													aria-hidden
												/>
												<span>{bullet}</span>
											</li>
										))}
									</ul>
									<div className="mt-auto flex flex-col gap-3 pt-4">
										<p className="text-[11px] font-medium uppercase tracking-wide text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
											{pillar.answersTo}
										</p>
										{pillar.deepLink ? (
											<Link
												href={pillar.deepLink.href}
												className="text-link hover:text-link/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
											>
												{pillar.deepLink.label}
												<span aria-hidden>&rarr;</span>
											</Link>
										) : null}
									</div>
								</div>
							</GlowCard>
						);
					})}
				</div>
			</div>
		</section>
	);
}
