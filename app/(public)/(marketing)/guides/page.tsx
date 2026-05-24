import Link from "next/link";

import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { BOARD_ENTRIES, GRADE_ENTRIES } from "@/lib/marketing/seo/registry";
import { featureBentoCardSurfaceClassName } from "@/lib/marketing/landing-feature-surface";
import { LANDING_PARENT_PRIMARY_CTA_HREF, LANDING_PARENT_PRIMARY_CTA_LABEL, MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { cn } from "@/lib/utils";

export const metadata = marketingPageMetadata({
	title: "Guides",
	description:
		"Chapter practice by board and class. Start a free trial to unlock adaptive sets on your child's actual syllabus.",
	path: "/guides",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const FEATURED_BOARDS = BOARD_ENTRIES.filter((b) =>
	["cbse", "icse", "maharashtra-state-board", "karnataka-state-board"].includes(b.slug),
);

export default function GuidesPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Guides"
				title="Sample chapter checks by board and class"
				lead="We do not ship generic PDF dumps. Start a free trial to practise on the chapters your child's school is teaching, with a radar chart you can read."
			/>

			<MarketingSection title="Pick your board and class">
				<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-3">
					{FEATURED_BOARDS.flatMap((board) =>
						GRADE_ENTRIES.map((grade) => (
							<Link
								key={`${board.slug}-${grade.grade}`}
								href={`${LANDING_PARENT_PRIMARY_CTA_HREF}?utm_content=guide-${board.slug}-g${grade.grade}`}
								className={cn(
									"flex flex-col gap-1 px-4 py-4 transition-shadow hover:shadow-md",
									featureBentoCardSurfaceClassName,
								)}
							>
								<span className="font-semibold text-foreground">
									{board.name} · {grade.classLabel}
								</span>
								<span className="text-muted-foreground text-sm">
									{LANDING_PARENT_PRIMARY_CTA_LABEL}
								</span>
							</Link>
						)),
					)}
				</div>
				<p className="text-muted-foreground mt-8 text-center text-sm">
					More boards: browse{" "}
					<Link href="/boards/cbse" className="text-link font-medium hover:underline">
						all board pages
					</Link>
					.
				</p>
			</MarketingSection>

			<MarketingSection title="Articles">
				<p className="text-muted-foreground text-center text-base">
					Long-form guides will live on the{" "}
					<Link href={MARKETING_NAV.blog.href} className="text-link font-medium hover:underline">
						blog
					</Link>{" "}
					when we publish them.
				</p>
			</MarketingSection>

			<MarketingSection>
				<div className="flex justify-center">
					<LandingPrimaryCtaButton render={<Link href={LANDING_PARENT_PRIMARY_CTA_HREF} />} />
				</div>
			</MarketingSection>
		</MarketingSubpageShell>
	);
}
