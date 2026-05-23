import Link from "next/link";
import { Suspense } from "react";

import { MarketingHero } from "@/components/marketing/blocks/marketing-hero";
import { MarketingSection } from "@/components/marketing/blocks/marketing-section";
import { ContactPageForm } from "@/components/marketing/contact/contact-page-form";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { getPublicLegalEntityName, getPublicRegisteredAddress } from "@/lib/marketing/env-public";
import { MARKETING_NAV } from "@/lib/marketing/landing-copy";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import { getPublicSupportEmail } from "@/lib/env";

export const metadata = marketingPageMetadata({
	title: "Contact",
	description:
		"Reach the 24Vertex team for parent questions, school demos, billing, and press. We read every message.",
	path: "/contact",
});

export const dynamic = "force-static";
export const revalidate = 86400;

export default function ContactPage() {
	const supportEmail = getPublicSupportEmail();
	const entity = getPublicLegalEntityName();
	const address = getPublicRegisteredAddress();

	return (
		<MarketingSubpageShell>
			<MarketingHero
				eyebrow="Contact"
				title="Tell us what you need. We read every message."
				lead="Parents, schools, and press: pick the path that fits. Billing questions usually get a reply within 2 business days. School demos within 5."
			/>

			<MarketingSection className="!pt-0">
				<div className="grid gap-10 xl:grid-cols-[1fr_280px]">
					<Suspense fallback={<div className="text-muted-foreground text-sm">Loading form…</div>}>
						<ContactPageForm />
					</Suspense>

					<aside className="space-y-6 text-sm">
						{supportEmail ? (
							<div>
								<p className="font-semibold text-foreground">Email</p>
								<a
									href={`mailto:${supportEmail}`}
									className="text-link mt-1 inline-block underline-offset-4 hover:underline"
								>
									{supportEmail}
								</a>
							</div>
						) : null}
						<div>
							<p className="font-semibold text-foreground">More help</p>
							<ul className="text-muted-foreground mt-2 space-y-2">
								<li>
									<Link href={MARKETING_NAV.help.href} className="text-link hover:underline">
										Help centre
									</Link>
								</li>
								<li>
									<Link href={MARKETING_NAV.security.href} className="text-link hover:underline">
										Security
									</Link>
								</li>
								<li>
									<Link href="/legal/privacy" className="text-link hover:underline">
										Privacy policy
									</Link>
								</li>
							</ul>
						</div>
						{entity || address ? (
							<div>
								<p className="font-semibold text-foreground">Registered entity</p>
								{entity ? <p className="text-muted-foreground mt-1">{entity}</p> : null}
								{address ? (
									<p className="text-muted-foreground mt-1 text-pretty leading-relaxed">{address}</p>
								) : null}
							</div>
						) : null}
					</aside>
				</div>
			</MarketingSection>
		</MarketingSubpageShell>
	);
}
