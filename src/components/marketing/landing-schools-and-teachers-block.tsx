import Link from "next/link";
import { Building2, Presentation } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
	MARKETING_NAV,
	MARKETING_SCHOOL_DEMO_CTA_HREF,
} from "@/lib/marketing/landing-copy";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { cn } from "@/lib/utils";

type LandingSchoolsAndTeachersBlockProps = {
	/** @deprecated Reserved for future mailto fallback; CTAs route to /schools and /contact. */
	contactEmail?: string | null;
};

export function LandingSchoolsAndTeachersBlock(
	_props: LandingSchoolsAndTeachersBlockProps = {},
) {
	return (
		<section
			id="for-schools"
			// Intentionally smaller than the major-section rhythm — this is a
			// reassurance band that sits between two louder sections, so it earns
			// less vertical space (~70% of a major section at every breakpoint).
			className="bg-background px-4 py-12 medium:px-6 medium:py-16 xl:px-8 xl:py-20"
			aria-labelledby="for-schools-title"
		>
			<div
				className={cn(
					"relative mx-auto flex w-full max-w-7xl flex-col items-start gap-6 overflow-hidden rounded-2xl px-5 py-7 medium:flex-row medium:items-center medium:justify-between medium:gap-10 medium:px-8 medium:py-8",
					landingFeatureBentoShell,
				)}
			>
				<div className="flex w-full max-w-4xl flex-col gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant="outline"
							className={landingMarketingSectionEyebrowBadgeClassName}
						>
							For schools and teachers
						</Badge>
						<span className="border-border bg-muted/35 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
							<Presentation
								aria-hidden
								className="size-3 text-[var(--subject-grid-icon)]"
							/>
							Coaching centres welcome too
						</span>
					</div>
					<h2
						id="for-schools-title"
						className="text-card-foreground text-pretty text-2xl font-semibold tracking-tight medium:text-3xl"
					>
						Bringing 24Vertex into a classroom or coaching centre?
					</h2>
					<p className="text-muted-foreground text-pretty text-[0.9375rem] leading-relaxed medium:text-base">
						Get a workspace for your students with section-level analytics, assignment
						flow, and the same chapter-level signals parents see, tuned for the teacher
						who wants to act on a class, not chase one student at a time.
					</p>
				</div>
				<div className="flex w-full shrink-0 flex-col items-stretch gap-3 medium:w-auto medium:items-end">
					<Button
						className="h-11 rounded-full bg-[var(--subject-grid-icon)] px-5 text-sm font-semibold text-white shadow-none hover:bg-[var(--link)] dark:bg-[var(--subject-grid-icon)] dark:hover:bg-[var(--link)]"
						render={<Link href={MARKETING_NAV.schools.href} />}
					>
						<Building2 aria-hidden className="size-4" />
						See school workspace
					</Button>
					<Button
						variant="marketingSecondary"
						className={cn(
							"text-foreground/85",
							LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
						)}
						render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
					>
						Book a walkthrough
					</Button>
				</div>
			</div>
		</section>
	);
}
