import Link from "next/link";
import type { Metadata } from "next";

import { MotionPageEnter } from "@/components/motion/motion-page-enter";

export const metadata: Metadata = {
	title: "Terms of use — EduAI",
	description: "Terms of use for the EduAI service.",
};

export default function LegalTermsPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-12 text-foreground">
			<MotionPageEnter className="flex flex-col">
			<h1 className="text-2xl font-semibold tracking-tight">Terms of use</h1>
			<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
			<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
				<p>
					These terms are a <strong className="text-foreground">placeholder summary</strong> for EduAI. They
					are not legal advice. Before accepting payments at scale, publish terms reviewed by qualified counsel
					for your jurisdiction and entity.
				</p>
				<p>
					<strong className="text-foreground">Service.</strong> EduAI provides educational practice and
					related tools. Features and availability may change. Some capabilities require an active plan or
					trial as shown in the product.
				</p>
				<p>
					<strong className="text-foreground">Accounts.</strong> You are responsible for activity under your
					account and for keeping credentials secure.
				</p>
				<p>
					<strong className="text-foreground">Payments.</strong> Paid plans are processed via Razorpay.
					Pricing, taxes, and invoicing follow Razorpay and your selected payment method. See also the{" "}
					<Link href="/legal/refund" className="text-primary underline-offset-4 hover:underline">
						refund & cancellation
					</Link>{" "}
					page.
				</p>
				<p>
					<strong className="text-foreground">Acceptable use.</strong> Do not misuse the service, attempt
					unauthorized access, or use outputs in ways that violate applicable law or school or exam rules.
				</p>
			</div>
			<p className="mt-10 text-sm">
				<Link href="/legal/refund" className="text-primary underline-offset-4 hover:underline">
					Refund & cancellation
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
