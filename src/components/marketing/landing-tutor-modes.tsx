"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpenCheck, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GlowCard } from "@/components/ui/spotlight-card";
import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	MARKETING_SECTION_LEAD_MAX_CLASSNAME,
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type ChatTurn = {
	speaker: "student" | "tutor";
	body: string;
	/** Optional emphasised italics for an inline action (e.g. "checks step 1"). */
	annotation?: string;
};

type TutorModeTab = {
	id: DoubtTutorMode;
	label: string;
	tagline: string;
	icon: LucideIcon;
	useCase: string;
	bestFor: string;
	subjectChip: string;
	conversation: ChatTurn[];
};

/**
 * Marketing samples are illustrative only, but the mode IDs and labels match
 * the in-product tutor modes (`src/lib/doubt/doubt-tutor-mode.ts`) so a parent
 * who lands inside the app sees the same names they read on the homepage.
 */
const TUTOR_TABS: TutorModeTab[] = [
	{
		id: "explain",
		label: "Explain",
		tagline: "When they want it broken down.",
		icon: BookOpenCheck,
		useCase: "Reading-heavy chapters: theory, definitions, derivations, history, biology.",
		bestFor: "Theoretical and concept-first chapters",
		subjectChip: "Class 9 · Biology · Photosynthesis",
		conversation: [
			{
				speaker: "student",
				body: "I keep forgetting what photosynthesis actually means. Can you explain it like you are talking to my grandmother?",
			},
			{
				speaker: "tutor",
				body: "Of course. Plants are like tiny kitchens that cook their own food. Sunlight is the gas stove, water from the soil is the dough, and carbon dioxide from the air is the spice. The kitchen room is called a chloroplast.",
			},
			{
				speaker: "tutor",
				body: "When the stove is on, the kitchen makes glucose (the food) and breathes out oxygen (the smell from a good kitchen). That whole cooking process is called photosynthesis.",
			},
			{
				speaker: "student",
				body: "Okay that actually helped. Will this come in my unit test?",
			},
			{
				speaker: "tutor",
				body: "Very likely. Your NCERT chapter has a 3-mark question on the inputs and outputs. Want me to make a quick 5-question quiz on just this chapter?",
				annotation: "Offers practice next",
			},
		],
	},
	{
		id: "solve_with_me",
		label: "Solve with me",
		tagline: "When they want to be coached, not given the answer.",
		icon: Wand2,
		useCase: "Numerical sums: math, physics numericals, chemistry stoichiometry.",
		bestFor: "Solution-based chapters where method matters",
		subjectChip: "Class 10 · Maths · Trigonometry",
		conversation: [
			{
				speaker: "student",
				body: "Solve this with me, do not give me the answer. If sin θ = 3/5, find cos θ and tan θ.",
			},
			{
				speaker: "tutor",
				body: "Good call. Step 1: which identity links sin and cos for the same angle? Tell me what you remember.",
			},
			{
				speaker: "student",
				body: "sin² θ + cos² θ = 1?",
			},
			{
				speaker: "tutor",
				body: "Exactly that. Substitute sin θ = 3/5 in your head and tell me what cos² θ becomes.",
				annotation: "Coaches step 1",
			},
			{
				speaker: "student",
				body: "1 minus 9/25 so cos² θ = 16/25.",
			},
			{
				speaker: "tutor",
				body: "Correct. So cos θ = 4/5 (taking the positive root since θ is acute). Now tan θ = sin θ / cos θ. What do you get?",
			},
			{
				speaker: "student",
				body: "(3/5) / (4/5) = 3/4.",
			},
			{
				speaker: "tutor",
				body: "Beautifully done. You did the whole problem. I just held the torch. Want to try one without help?",
				annotation: "Builds confidence",
			},
		],
	},
];

const REASSURANCE_POINTS: Array<{ icon: LucideIcon; title: string; body: string }> = [
	{
		icon: ShieldCheck,
		title: "Private to your child",
		body: "Tutor chats are never shown to classmates. The room cannot laugh at a question your child asks here.",
	},
	{
		icon: Sparkles,
		title: "Patient by design",
		body: "Wrong answers are met with a question, not a sigh. The tutor will explain the same thing five different ways if it has to.",
	},
	{
		icon: BookOpenCheck,
		title: "Knows the textbook",
		body: "Tuned to NCERT and ICSE chapter structures, with state board variants. The vocabulary matches what your child sees in class.",
	},
];

const sectionTitle =
	"text-3xl font-semibold tracking-tight text-foreground medium:text-4xl";
const sectionLead = marketingSectionLeadClassName;

function ChatBubble({ turn }: { turn: ChatTurn }) {
	const isStudent = turn.speaker === "student";
	return (
		<div className={cn("flex w-full", isStudent ? "justify-end" : "justify-start")}>
			<div className={cn("max-w-[88%] medium:max-w-[80%]", isStudent ? "items-end" : "items-start")}>
				<p
					className={cn(
						"text-[10px] font-semibold uppercase tracking-[0.14em]",
						isStudent ? "text-right text-muted-foreground/80" : "text-left text-[var(--subject-grid-icon)]",
					)}
				>
					{isStudent ? "Your child" : "AI tutor"}
				</p>
				<div
					className={cn(
						"mt-1 rounded-2xl border px-4 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm",
						isStudent
							? "border-border/70 bg-muted/45 text-foreground"
							: "border-[var(--subject-grid-icon)]/35 bg-[var(--subject-grid-icon)]/[0.07] text-card-foreground dark:bg-[var(--subject-grid-icon)]/[0.1]",
					)}
				>
					<p className="text-pretty whitespace-pre-line">{turn.body}</p>
					{turn.annotation ? (
						<p className="mt-2 text-[11px] italic tracking-tight text-muted-foreground">
							{turn.annotation}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}

export function LandingTutorModes() {
	const [activeTabIdx, setActiveTabIdx] = React.useState(0);
	const prefersReducedMotion = useReducedMotion();
	const activeTab = TUTOR_TABS[activeTabIdx];

	return (
		<section
			id="ai-tutor"
			className="bg-background py-16 medium:py-20 xl:py-24"
			aria-labelledby="ai-tutor-title"
		>
			<div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
				<div className={cn("mb-10 medium:mb-12", marketingSectionIntroWrapClassName)}>
					<Badge
						variant="outline"
						className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}
					>
						AI tutor
					</Badge>
					<h2 id="ai-tutor-title" className={cn(sectionTitle, "text-balance")}>
						A tutor your child will actually use, because it does not make them feel stupid.
					</h2>
					<p className={cn(sectionLead, "text-pretty")}>
						Two modes, one promise: never just hand over the answer when your child wanted to learn, and never hold back when they just need it explained. Your child picks the mode in one tap.
					</p>
				</div>

				<div
					className="mx-auto mb-8 flex w-full max-w-md items-center gap-2 rounded-full border border-border/70 bg-muted/30 p-1 medium:max-w-lg"
					role="tablist"
					aria-label="AI tutor modes"
				>
					{TUTOR_TABS.map((tab, index) => {
						const Icon = tab.icon;
						const isActive = index === activeTabIdx;
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={isActive}
								aria-controls={`tutor-mode-panel-${tab.id}`}
								id={`tutor-mode-tab-${tab.id}`}
								onClick={() => setActiveTabIdx(index)}
								className={cn(
									"relative flex-1 rounded-full px-3 py-2 text-[0.8125rem] font-semibold transition-colors duration-200 ease-out medium:px-4 medium:py-2.5 medium:text-sm",
									isActive
										? "bg-card text-card-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<span className="inline-flex items-center justify-center gap-1.5">
									<Icon className="size-4 shrink-0 text-[var(--subject-grid-icon)]" aria-hidden />
									<span>{tab.label}</span>
								</span>
							</button>
						);
					})}
				</div>

				<p className="mx-auto -mt-4 mb-8 max-w-xl text-center text-sm text-muted-foreground medium:mb-10">
					{activeTab.tagline}
				</p>

				<div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr] xl:gap-6">
					<GlowCard
						glowColor="green"
						customSize
						className={cn(
							"min-h-[480px] overflow-hidden rounded-[16px] border p-5 medium:p-7",
							featureBentoCardSurfaceClassName,
						)}
					>
						<div
							role="tabpanel"
							id={`tutor-mode-panel-${activeTab.id}`}
							aria-labelledby={`tutor-mode-tab-${activeTab.id}`}
							className="relative z-10 flex h-full min-h-0 flex-col gap-4"
						>
							<div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
								<div className="flex items-center gap-2.5">
									<span
										className="border-border bg-muted/45 ring-border/60 flex size-9 shrink-0 items-center justify-center rounded-xl border ring-1"
										aria-hidden
									>
										<activeTab.icon className="size-4 text-[var(--subject-grid-icon)]" strokeWidth={2} />
									</span>
									<div>
										<p className="text-sm font-semibold text-card-foreground">
											{activeTab.label} mode
										</p>
										<p className="text-[11px] text-muted-foreground">
											{activeTab.bestFor}
										</p>
									</div>
								</div>
								<span className="border-border bg-muted/35 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
									{activeTab.subjectChip}
								</span>
							</div>

							<AnimatePresence mode="wait">
								<motion.div
									key={activeTab.id}
									className="flex flex-col gap-3 medium:gap-4"
									initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
									transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
								>
									{activeTab.conversation.map((turn, idx) => (
										<ChatBubble key={`${activeTab.id}-${idx}`} turn={turn} />
									))}
								</motion.div>
							</AnimatePresence>
						</div>
					</GlowCard>

					<div className="flex flex-col gap-4 medium:gap-5">
						<GlowCard
							glowColor="green"
							customSize
							className={cn(
								"overflow-hidden rounded-[16px] border p-5 medium:p-6",
								featureBentoCardSurfaceClassName,
							)}
						>
							<div className="relative z-10 flex flex-col gap-3">
								<p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									What this mode is for
								</p>
								<p className="text-foreground text-pretty text-[0.9375rem] leading-relaxed medium:text-base">
									{activeTab.useCase}
								</p>
							</div>
						</GlowCard>
						{REASSURANCE_POINTS.map((item) => {
							const Icon = item.icon;
							return (
								<div
									key={item.title}
									className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 medium:p-5"
								>
									<span
										className="bg-card border-border/70 flex size-9 shrink-0 items-center justify-center rounded-xl border"
										aria-hidden
									>
										<Icon
											className="size-4 text-[var(--subject-grid-icon)]"
											strokeWidth={2}
										/>
									</span>
									<div className="min-w-0">
										<p className="text-card-foreground text-sm font-semibold medium:text-[0.9375rem]">
											{item.title}
										</p>
										<p className="text-muted-foreground mt-1 text-pretty text-[0.8125rem] leading-relaxed medium:text-sm">
											{item.body}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<p
					className={cn(
						"text-muted-foreground mx-auto mt-10 text-balance text-center text-sm medium:mt-12 medium:text-base",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
					)}
				>
					Every conversation is private to your child. You and their teacher see what they
					practised and how often, never the words they used to ask.
				</p>
			</div>
		</section>
	);
}
