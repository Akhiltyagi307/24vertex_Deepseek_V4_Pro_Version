import Link from "next/link";
import type { Metadata } from "next";

import { MotionPageEnter } from "@/components/motion/motion-page-enter";

export const metadata: Metadata = {
	title: "Refund & cancellation policy — EduAI",
	description: "How refunds and subscription cancellations work for EduAI.",
};

export default function LegalRefundPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-12 text-foreground">
			<MotionPageEnter className="flex flex-col">
			<h1 className="text-2xl font-semibold tracking-tight">Refund & cancellation</h1>
			<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
			<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
				<p>
					EduAI is billed through <strong className="text-foreground">Razorpay</strong> (cards, UPI, and
					subscription mandates). By subscribing, you agree that charges are processed by Razorpay under their
					terms and your issuing bank or UPI provider rules.
				</p>
				<p>
					<strong className="text-foreground">Cancellation.</strong> You can cancel renewal from your EduAI
					subscription page where indicated; cancellation is typically effective at the end of the current
					billing period unless your payment provider or Razorpay shows otherwise. Mandates and saved payment
					methods may be managed through Razorpay&apos;s customer flows where applicable.
				</p>
				<p>
					<strong className="text-foreground">Refunds.</strong> Refund eligibility depends on what you
					purchased, applicable law, and Razorpay / bank policies. If you believe you were charged in error,
					contact support with your payment reference and account email. We will review and coordinate with
					Razorpay where a refund is appropriate.
				</p>
				<p className="text-xs">
					This page is a general summary. Replace or extend it with counsel-reviewed terms for your entity
					before scaling production billing.
				</p>
			</div>
			<p className="mt-10 text-sm">
				<Link href="/legal/terms" className="text-primary underline-offset-4 hover:underline">
					Terms of use
				</Link>
				{" · "}
				<Link href="/" className="text-primary underline-offset-4 hover:underline">
					Home
				</Link>
			</p>
			</MotionPageEnter>
		</main>
	);
}
