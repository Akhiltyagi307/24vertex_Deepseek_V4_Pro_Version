import Link from "next/link";

import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { Button } from "@/components/ui/button";
import {
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
	LANDING_PARENT_PRIMARY_CTA_HREF,
	LANDING_STUDENT_FEATURE_PARENT_CTA_LABEL,
	LANDING_STUDENT_FEATURE_PARENT_CTA_NOTE,
} from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

type LandingStudentFeatureCtaActionsProps = {
	visual?: "rich" | "minimal" | "on-committed";
	className?: string;
};

/** Parent-signup primary + log in. For student-voiced feature pages only. */
export function LandingStudentFeatureCtaActions({
	visual = "rich",
	className,
}: LandingStudentFeatureCtaActionsProps) {
	const onCommitted = visual === "on-committed";

	return (
		<div
			className={cn(
				"flex w-full max-w-sm flex-col items-stretch gap-3 min-[400px]:max-w-none min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center min-[400px]:justify-center medium:gap-4",
				className,
			)}
		>
			<LandingPrimaryCtaButton
				label={LANDING_STUDENT_FEATURE_PARENT_CTA_LABEL}
				render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />}
				visual={visual}
				className="w-full min-[400px]:w-fit"
			/>
			<Button
				variant="outline"
				className={cn(
					"w-full min-[400px]:w-fit",
					onCommitted
						? "h-11 rounded-full border-white/50 bg-white/10 px-5 text-sm font-semibold text-white shadow-none transition-colors duration-200 ease-out hover:bg-white/20 hover:text-white"
						: LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
				)}
				render={<Link href="/login" />}
			>
				Log in
			</Button>
		</div>
	);
}

type LandingStudentFeatureHeroCtaBlockProps = {
	className?: string;
};

/** Hero CTA row plus the parent-pays bridge line. */
export function LandingStudentFeatureHeroCtaBlock({ className }: LandingStudentFeatureHeroCtaBlockProps) {
	return (
		<div className={cn("flex w-full flex-col items-center gap-2.5", className)}>
			<LandingStudentFeatureCtaActions />
			<p className="max-w-md text-pretty text-center text-sm leading-relaxed text-muted-foreground medium:text-[15px]">
				{LANDING_STUDENT_FEATURE_PARENT_CTA_NOTE}
			</p>
		</div>
	);
}
