import Link from "next/link";
import type { Metadata } from "next";

import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { LegalContactBlock } from "@/components/legal/legal-contact-block";

export const metadata: Metadata = {
	title: "Refund & cancellation policy — EduAI",
	description: "How refunds and subscription cancellations work for EduAI.",
};

export default function LegalRefundPage() {
	return (
		<main className="w-full min-w-0 max-w-none px-4 py-12 text-foreground sm:px-8">
			<MotionPageEnter className="flex flex-col">
				<h1 className="text-2xl font-semibold tracking-tight">Refund & cancellation</h1>
				<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
				<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
					<p>
						EduAI is billed through <strong className="text-foreground">Razorpay</strong> (cards, UPI, and
						subscription mandates). By subscribing, you agree that charges are processed by Razorpay under their terms
						and your issuing bank or UPI provider rules. Razorpay&apos;s policies apply to payment instrument storage and
						mandate management.
					</p>
					<p>
						<strong className="text-foreground">Cancellation.</strong> You can cancel renewal from your EduAI
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
				<LegalContactBlock />
				<p className="mt-10 flex flex-wrap gap-x-2 gap-y-1 text-sm">
					<Link href="/legal/shipping" className="text-primary underline-offset-4 hover:underline">
						Shipping & delivery
					</Link>
					<span className="text-muted-foreground">·</span>
					<Link href="/legal/privacy" className="text-primary underline-offset-4 hover:underline">
						Privacy policy
					</Link>
					<span className="text-muted-foreground">·</span>
					<Link href="/legal/terms" className="text-primary underline-offset-4 hover:underline">
						Terms of use
					</Link>
					<span className="text-muted-foreground">·</span>
					<Link href="/" className="text-primary underline-offset-4 hover:underline">
						Home
					</Link>
				</p>
			</MotionPageEnter>
		</main>
	);
}
