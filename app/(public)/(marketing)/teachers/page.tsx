import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingTrustBullets } from "@/components/marketing/blocks/marketing-trust-bullets";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { Button } from "@/components/ui/button";
import {
	LANDING_ROLE_SIGNUP_HREF,
	LANDING_SCHOOLS_CTA_LABEL,
	MARKETING_SCHOOL_DEMO_CTA_HREF,
	MARKETING_SCHOOL_DEMO_CTA_LABEL,
} from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";

export const metadata = marketingPageMetadata({
	title: "For teachers",
	description:
		"Chapter heatmaps, targeted assignments, and practice visibility for classroom and coaching-centre teachers on 24Vertex.",
	path: "/teachers",
});

export const dynamic = "force-static";
export const revalidate = 86400;

export default function TeachersPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="For teachers"
				title="The chapter heatmap you wish you had after every class test."
				lead="Mark weak topics, assign targeted practice, and see who attempted before the next period. Tutor chat stays private to the student."
				actions={
					<Button
						variant="outline"
						className="h-11 rounded-full"
						render={<Link href={LANDING_ROLE_SIGNUP_HREF} />}
					>
						{LANDING_SCHOOLS_CTA_LABEL}
					</Button>
				}
			/>

			<MarketingSection title="A Tuesday after the class test">
				<p className="text-muted-foreground mx-auto max-w-2xl text-pretty text-base leading-relaxed medium:text-lg">
					You graded 40 papers. Three chapters caused most of the lost marks. Instead of re-teaching
					everything, you assign a 15-question practice set on those chapters only. Before Thursday&apos;s
					class, you see who attempted and who needs a nudge. Parents see the same chapter signal at home.
				</p>
			</MarketingSection>

			<MarketingSection eyebrow="Coaching centres" title="Multiple batches, one workspace">
				<p className="text-muted-foreground mx-auto max-w-2xl text-center text-pretty text-base leading-relaxed">
					Run separate sections for Class 8 CBSE morning and Class 9 state board evening without mixing
					analytics.
				</p>
			</MarketingSection>

			<MarketingSection title="What you do not see">
				<MarketingTrustBullets
					items={[
						"Tutor chat message text (student privacy)",
						"Other teachers' classes unless your admin grants access",
						"Parent billing details",
					]}
				/>
			</MarketingSection>

			<MarketingCtaBand
				title="Bring 24Vertex to your school or centre"
				lead="Forward this page to your coordinator, or book a walkthrough."
				actions={
					<>
						<Button
							className="h-11 rounded-full font-semibold"
							render={<Link href={MARKETING_SCHOOL_DEMO_CTA_HREF} />}
						>
							{MARKETING_SCHOOL_DEMO_CTA_LABEL}
						</Button>
						<Button
							variant="outline"
							className="h-11 rounded-full"
							render={<Link href={LANDING_ROLE_SIGNUP_HREF} />}
						>
							{LANDING_SCHOOLS_CTA_LABEL}
						</Button>
					</>
				}
			/>
		</MarketingSubpageShell>
	);
}
