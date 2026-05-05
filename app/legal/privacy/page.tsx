import Link from "next/link";
import type { Metadata } from "next";

import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { LegalContactBlock } from "@/components/legal/legal-contact-block";

export const metadata: Metadata = {
	title: "Privacy policy — EduAI",
	description: "How EduAI collects, uses, and protects your information.",
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function LegalPrivacyPage() {
	return (
		<main className="w-full min-w-0 max-w-none px-4 py-12 text-foreground medium:px-8">
			<MotionPageEnter className="flex flex-col">
				<h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
				<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
				<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
					<p>
						For this policy, <strong className="text-foreground">&quot;we&quot;, &quot;us&quot;, and &quot;our&quot;</strong>{" "}
						refer to the operator of the EduAI service. <strong className="text-foreground">&quot;You&quot;</strong> means
						anyone who uses the website or app or purchases a subscription.
					</p>
					<p>
						This policy is a <strong className="text-foreground">practical summary</strong> for transparency and payment
						partner requirements. It is not legal advice. Have it reviewed by qualified counsel for your entity and
						jurisdiction before scaling.
					</p>
					<p>
						<strong className="text-foreground">Students, parents, and schools.</strong> EduAI is built for learners.
						Accounts may include profile and guardian or school contact details supplied by you or your institution.
						Where a student is a child, a parent, guardian, or school may create, pay for, or administer access. We
						treat guardian and school-provided information as part of the account relationship described below.
					</p>
					<p>
						<strong className="text-foreground">Information we collect.</strong> We collect account and profile
						information you provide (for example name, email, phone where collected, grade or school context where
						applicable), guardian or school contact fields when present, content you submit in the product (including
						practice answers, uploads where supported, and messages in AI chat), usage and technical data needed to run
						the service (for example device or browser type, approximate location from IP where standard for hosting,
						logs, and security signals), and communications you send to support.
					</p>
					<p>
						<strong className="text-foreground">AI features and model providers.</strong> To provide AI tutoring,
						automated grading assistance, practice generation, and similar features, we send relevant text and answers
						to third-party model providers (for example{" "}
						<a
							href="https://platform.openai.com/docs/guides/your-data"
							className="font-medium text-link underline-offset-4 hover:underline"
							rel="noopener noreferrer"
							target="_blank"
						>
							OpenAI
						</a>
						{") "}
						for processing to generate outputs. Those providers handle input and output under their published policies
						and our commercial terms with them. Do not submit highly sensitive data you are not comfortable having
						processed by such providers.
					</p>
					<p>
						<strong className="text-foreground">Payments.</strong> Card, UPI, and subscription mandate data are
						collected and processed by <strong className="text-foreground">Razorpay</strong> and your bank or UPI app.
						See also Razorpay&apos;s{" "}
						<a
							href="https://razorpay.com/privacy/"
							className="font-medium text-link underline-offset-4 hover:underline"
							rel="noopener noreferrer"
							target="_blank"
						>
							privacy policy
						</a>
						. We receive limited transaction metadata (such as status, amount, and references) needed to activate and
						manage your plan—not your full card number or UPI PIN.
					</p>
					<p>
						<strong className="text-foreground">Cookies and similar technologies.</strong> We and our vendors may use
						cookies, local storage, or similar technologies that your browser allows for sign-in sessions, security,
						preferences, and product analytics. You can control many of these through your browser settings.
					</p>
					<p>
						<strong className="text-foreground">How we use information.</strong> We use data to provide and improve
						EduAI, personalize practice where the product supports it, secure accounts, comply with law, operate billing
						and entitlements, and communicate about your subscription or the service.
					</p>
					<p>
						<strong className="text-foreground">Sharing.</strong> We share data with subprocessors that help us run the
						product (for example hosting, email, analytics, and AI inference), and with payment providers as needed to
						complete billing. We do not sell your personal information. Data may be stored or processed in India and in
						other countries where our providers operate, subject to our agreements and applicable law.
					</p>
					<p>
						<strong className="text-foreground">Retention & security.</strong> We retain information as long as needed
						for the purposes above and as required by law. We apply reasonable technical and organizational measures;
						no method of transmission over the Internet is perfectly secure.
					</p>
					<p>
						<strong className="text-foreground">Your choices and rights.</strong> You may access or update certain
						profile fields in the product where available, and contact us using the details below for access, correction,
						deletion, or objection requests where applicable law allows. If the{" "}
						<strong className="text-foreground">Digital Personal Data Protection Act, 2023</strong> (India) applies to
						our processing, you may have additional rights (such as grievance escalation); we will respond in line with
						that framework where it applies.
					</p>
					<p>
						<strong className="text-foreground">Links & updates.</strong> The service may link to third-party sites or
						payment flows with their own policies. We may update this page from time to time; the &quot;Last
						updated&quot; date will change when we do.
					</p>
					<p>
						<strong className="text-foreground">Governing law.</strong> This policy is governed by the laws of the{" "}
						<strong className="text-foreground">Republic of India</strong>, without prejudice to mandatory protections
						in your place of residence where those cannot be waived.
					</p>
				</div>
				<LegalContactBlock />
				<p className="mt-10 flex flex-wrap gap-x-2 gap-y-1 text-sm">
					<Link href="/legal/shipping" className="text-link underline-offset-4 hover:underline">
						Shipping & delivery
					</Link>
					<span className="text-muted-foreground">·</span>
					<Link href="/legal/refund" className="text-link underline-offset-4 hover:underline">
						Refund & cancellation
					</Link>
					<span className="text-muted-foreground">·</span>
					<Link href="/legal/terms" className="text-link underline-offset-4 hover:underline">
						Terms of use
					</Link>
					<span className="text-muted-foreground">·</span>
					<Link href="/" className="text-link underline-offset-4 hover:underline">
						Home
					</Link>
				</p>
			</MotionPageEnter>
		</main>
	);
}
