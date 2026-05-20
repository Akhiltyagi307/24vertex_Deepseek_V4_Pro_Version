import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Shipping & delivery — EduAI",
	description: "How EduAI delivers access to digital practice and AI features after purchase.",
	alternates: {
		canonical: "/legal/shipping",
	},
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function LegalShippingPage() {
	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight">Shipping & delivery</h1>
			<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
			<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
				<p>
					EduAI provides <strong className="text-foreground">digital educational services</strong> (practice
					content, AI-assisted features, and related tools). We do not ship physical goods as part of the standard
					subscription.
				</p>
				<p>
					<strong className="text-foreground">Delivery of access.</strong> After Razorpay confirms a successful
					payment or trial setup as applicable, paid features are tied to your logged-in account. Access usually
					updates within minutes; in some cases (for example bank holds, risk review, or downtime) activation can take
					longer or require a page refresh or sign-in again. You use the service with the email or account you
					registered with.
				</p>
				<p>
					<strong className="text-foreground">Notifications.</strong> We may send service or billing-related email
					(for example payment receipts or access changes) to the address on your account.
				</p>
				<p>
					<strong className="text-foreground">Physical materials.</strong> If we ever offer printed or shipped items
					as a separate purchase, delivery timelines, carriers, and any applicable fees will be stated at checkout.
					Unless otherwise specified, the subscription product remains digital-only.
				</p>
				<p className="text-xs">
					This page describes how &quot;delivery&quot; works for a digital product. Align timelines and operational
					SLAs with your support runbook and counsel-reviewed text before formal commercial launch.
				</p>
			</div>
		</>
	);
}
