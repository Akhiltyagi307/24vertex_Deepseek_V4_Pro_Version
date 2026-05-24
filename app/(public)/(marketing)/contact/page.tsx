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
				<Suspense fallback={<div className="text-muted-foreground text-sm">Loading form…</div>}>
					<ContactPageForm supportEmail={supportEmail} />
				</Suspense>

				<div className="border-border/40 text-muted-foreground mt-16 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t pt-6 text-xs">
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<Link
							href={MARKETING_NAV.help.href}
							className="hover:text-foreground underline-offset-4 hover:underline"
						>
							Help centre
						</Link>
						<Link
							href={MARKETING_NAV.security.href}
							className="hover:text-foreground underline-offset-4 hover:underline"
						>
							Security
						</Link>
						<Link
							href="/legal/privacy"
							className="hover:text-foreground underline-offset-4 hover:underline"
						>
							Privacy policy
						</Link>
					</div>
					{entity || address ? (
						<p className="text-pretty leading-relaxed">
							{entity ? <span className="text-foreground/80 font-medium">{entity}</span> : null}
							{entity && address ? <span aria-hidden> · </span> : null}
							{address}
						</p>
					) : null}
				</div>
			</MarketingSection>
		</MarketingSubpageShell>
	);
}
