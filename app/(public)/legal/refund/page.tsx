import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Refund & cancellation policy · 24Vertex",
	description: "How refunds and subscription cancellations work for 24Vertex.",
	alternates: {
		canonical: "/legal/refund",
	},
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function LegalRefundPage() {
	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight">Refund & cancellation</h1>
			<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
			<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
				<p>
					24Vertex is billed through <strong className="text-foreground">Razorpay</strong> (cards, UPI, and
					subscription mandates). By subscribing, you agree that charges are processed by Razorpay under their terms
					and your issuing bank or UPI provider rules. Razorpay&apos;s policies apply to payment instrument storage and
					mandate management.
				</p>
				<p>
					<strong className="text-foreground">Cancellation.</strong> You can cancel renewal from your 24Vertex
					subscription page where indicated; cancellation is typically effective at the end of the current billing
					period so you keep access you already paid for unless your payment provider or Razorpay shows otherwise.
					Autopay mandates and saved payment methods may be managed through Razorpay&apos;s customer flows where
					applicable.
				</p>
				<p>
					<strong className="text-foreground">Refunds.</strong> Refund eligibility depends on what you purchased,
					<strong className="text-foreground"> applicable law</strong> (including consumer protection rules in
					India where they apply), and Razorpay or bank policies. If you believe you were charged in error, contact
					us using the details below with your payment reference and account email. Where a refund is approved, it is
					typically processed back to the original method; settlement often appears within roughly{" "}
					<strong className="text-foreground">7–14 business days</strong> depending on banks, UPI, or card networks,
					and may take longer in edge cases.
				</p>
				<p>
					<strong className="text-foreground">Chargebacks.</strong> If you dispute a charge with your bank, we may
					receive limited information from Razorpay to investigate. Contact us first where possible so we can
					resolve billing issues quickly.
				</p>
				<p className="text-xs">
					This page is a general summary. Replace or extend it with counsel-reviewed terms for your entity before
					scaling production billing.
				</p>
			</div>
		</>
	);
}
