import Link from "next/link";

import { LandingRadarPreview } from "@/components/marketing/landing-radar-preview";
import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingFeatureSpotlight } from "@/components/marketing/blocks/marketing-feature-spotlight";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { landingMasteryPreviewDotClassNames } from "@/lib/marketing/landing-mastery-preview-styles";
import {
	LANDING_PARENT_PRIMARY_CTA_HREF,
	LANDING_TRIAL_LEAD_FULL,
	MARKETING_NAV,
} from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";
import { BookOpen, GraduationCap, MessagesSquare } from "lucide-react";

export const metadata = marketingPageMetadata({
	title: "Parent dashboard",
	description:
		"Chapter-level mastery radar chart and weekly signals so Indian parents see weak chapters before report-card day.",
	path: "/parent-dashboard",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const SHARED_ACCOUNTABILITY = [
	{
		icon: GraduationCap,
		audience: "Your child",
		body: "Opens the app and sees the same chapter list. Knows what to practise tonight without you asking.",
	},
	{
		icon: BookOpen,
		audience: "You",
		body: "Read the radar on Sunday morning. The amber chapters this week are the conversation, not the marks from last term.",
	},
	{
		icon: MessagesSquare,
		audience: "The class teacher",
		body: "Sees the same signal for the section. Pushes a practice set on the chapter that cost the most marks last test.",
	},
] as const;

const LEGEND = [
	{ tone: "green", label: "Green", body: "Chapter is in a good place for now." },
	{ tone: "amber", label: "Amber", body: "Needs attention this week." },
	{ tone: "red", label: "Red", body: "Priority before the next school assessment." },
] as const;

const LEGEND_DOT_CLASSNAMES = landingMasteryPreviewDotClassNames;

export default function ParentDashboardPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Parent dashboard"
				title="The Sunday report you do not have to interrogate your child for."
				lead="A chapter mastery radar chart that students, parents, and linked teachers all read from the same view. Updated as practice lands, not only when marks arrive."
				actions={<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />}
				tone="tinted"
			/>

			<LandingRadarPreview />

			<MarketingSection
				eyebrow="Shared accountability"
				title="One chapter map. Three people reading it."
				lead="Home, school, and the student looking at the same list every week. No more parallel WhatsApp threads about who said what."
				pad="default"
				surface="muted"
			>
				<div
					className={cn(
						"mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-card",
						featureBentoCardSurfaceClassName,
					)}
				>
					<ul className="divide-y divide-border/70 medium:grid medium:grid-cols-3 medium:divide-x medium:divide-y-0">
						{SHARED_ACCOUNTABILITY.map((item) => {
							const Icon = item.icon;
							return (
								<li
									key={item.audience}
									className="flex flex-col gap-2.5 px-5 py-5 medium:gap-3 medium:px-6 medium:py-6"
								>
									<div className="flex items-center gap-2.5">
										<Icon className="size-5 shrink-0 text-[var(--subject-grid-icon)]" strokeWidth={2} aria-hidden />
										<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
											{item.audience}
										</p>
									</div>
									<p className="min-w-0 text-pretty text-[13px] leading-relaxed text-card-foreground medium:text-sm">
										{item.body}
									</p>
								</li>
							);
						})}
					</ul>
				</div>
			</MarketingSection>

			<MarketingSection
				eyebrow="Reading the radar"
				title="Three states, no jargon."
				pad="tight"
			>
				<ul className="mx-auto grid max-w-4xl gap-3 medium:grid-cols-3 medium:gap-4">
					{LEGEND.map((entry) => (
						<li
							key={entry.label}
							className="border-border/70 rounded-xl border bg-card/60 px-4 py-3.5"
						>
							<div className="flex items-center gap-2">
								<span
									className={cn("inline-block size-2 rounded-full ring-2", LEGEND_DOT_CLASSNAMES[entry.tone])}
									aria-hidden
								/>
								<p className="text-sm font-semibold text-card-foreground">{entry.label}</p>
							</div>
							<p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{entry.body}</p>
						</li>
					))}
				</ul>
			</MarketingSection>

			<MarketingSection pad="tight">
				<MarketingFeatureSpotlight
					icon={MessagesSquare}
					title="Private to your child, visible to you and their teacher in the right slices."
					body="The tutor chat stays private to your child. You and their linked teacher see what they practised and how often, not the words they used to ask. Full visibility rules are on the security page."
				/>
				<p className="mt-3 text-center text-[12px] text-muted-foreground medium:text-[13px]">
					<Link
						href={`${MARKETING_NAV.security.href}#tutor-chat`}
						className="text-link font-medium hover:underline"
					>
						Read the visibility rules on the security page
					</Link>
				</p>
			</MarketingSection>

			<MarketingCtaBand
				title="Get the first weak-chapter report this Sunday."
				lead={LANDING_TRIAL_LEAD_FULL}
				actions={
					<LandingPrimaryCtaButton
						render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
						visual="on-committed"
					/>
				}
				tone="committed"
			/>
		</MarketingSubpageShell>
	);
}
