import Link from "next/link";

import { MarketingCtaBand } from "@/components/marketing/blocks/marketing-cta-band";
import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { Button } from "@/components/ui/button";
import { MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";

export const metadata = marketingPageMetadata({
	title: "Security and student data",
	description:
		"Who can see practice scores, chapter mastery, and tutor chat on 24Vertex. Privacy for parents, students, teachers, and schools.",
	path: "/security",
});

export const dynamic = "force-static";
export const revalidate = 86400;

const VISIBILITY_ROWS = [
	{
		data: "Practice scores and attempts",
		parent: "Yes",
		child: "Yes",
		teacher: "If linked",
		school: "If enrolled",
		staff: "Ops only",
		ai: "No",
	},
	{
		data: "Chapter mastery radar chart",
		parent: "Yes",
		child: "Yes",
		teacher: "If linked",
		school: "If enrolled",
		staff: "Ops only",
		ai: "No",
	},
	{
		data: "Tutor chat message text",
		parent: "No",
		child: "Yes",
		teacher: "No",
		school: "No",
		staff: "No",
		ai: "Processing only",
	},
	{
		data: "Uploaded images (where enabled)",
		parent: "No",
		child: "Yes",
		teacher: "No",
		school: "No",
		staff: "Ops only",
		ai: "Processing only",
	},
	{
		data: "Billing and subscription",
		parent: "Yes",
		child: "No",
		teacher: "No",
		school: "Admin",
		staff: "Billing ops",
		ai: "No",
	},
] as const;

export default function SecurityPage() {
	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Security"
				title="Your child's practice is visible. Their doubts stay private."
				lead="Parents and linked teachers see chapter mastery and effort. Tutor conversations stay between your child and the AI tutor unless you export or share them yourself."
			/>

			<MarketingSection
				id="visibility"
				eyebrow="Visibility"
				title="Who can see what"
				centered={false}
			>
				<div className="overflow-x-auto rounded-xl border border-border/60">
					<table className="w-full min-w-[48rem] text-left text-sm">
						<thead>
							<tr className="border-b border-border/60 bg-muted/20">
								<th className="px-3 py-3 font-semibold">Data</th>
								<th className="px-3 py-3 font-semibold">Parent</th>
								<th className="px-3 py-3 font-semibold">Student</th>
								<th className="px-3 py-3 font-semibold">Linked teacher</th>
								<th className="px-3 py-3 font-semibold">School admin</th>
								<th className="px-3 py-3 font-semibold">24Vertex staff</th>
								<th className="px-3 py-3 font-semibold">AI providers</th>
							</tr>
						</thead>
						<tbody>
							{VISIBILITY_ROWS.map((row) => (
								<tr key={row.data} className="border-b border-border/40 last:border-0">
									<th scope="row" className="text-muted-foreground px-3 py-3 font-medium">
										{row.data}
									</th>
									<td className="px-3 py-3">{row.parent}</td>
									<td className="px-3 py-3">{row.child}</td>
									<td className="px-3 py-3">{row.teacher}</td>
									<td className="px-3 py-3">{row.school}</td>
									<td className="px-3 py-3">{row.staff}</td>
									<td className="px-3 py-3">{row.ai}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</MarketingSection>

			<MarketingSection id="tutor-chat" title="How the AI tutor uses data">
				<p className="text-muted-foreground mx-auto max-w-3xl text-pretty text-base leading-relaxed">
					To answer doubts, we send relevant question text and your child&apos;s messages to third-party
					model providers under our commercial terms. We do not use tutor chats for advertising. Read
					the{" "}
					<Link href="/legal/privacy" className="text-link font-medium underline-offset-4 hover:underline">
						privacy policy
					</Link>{" "}
					for provider names and retention.
				</p>
			</MarketingSection>

			<MarketingSection title="Security practices">
				<ul className="text-muted-foreground mx-auto max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed">
					<li>HTTPS for data in transit</li>
					<li>Authenticated sessions; portals are not indexed by search engines</li>
					<li>No ad networks or student data sales</li>
					<li>Payments handled by Razorpay; we do not store full card or UPI secrets</li>
				</ul>
			</MarketingSection>

			<MarketingSection title="For schools">
				<p className="text-muted-foreground mx-auto max-w-3xl text-pretty text-base leading-relaxed">
					School workspaces use teacher approval before classroom access. Rosters come from your
					administrator. When a school ends a contract, contact us for offboarding and data handling per
					your agreement and our privacy policy.
				</p>
			</MarketingSection>

			<MarketingCtaBand
				title="Questions about data or security?"
				lead="We will walk through visibility and retention for your family or school."
				actions={
					<Button
						className="h-11 rounded-full font-semibold"
						render={<Link href={MARKETING_NAV.contact.href} />}
					>
						Contact us
					</Button>
				}
			/>
		</MarketingSubpageShell>
	);
}
