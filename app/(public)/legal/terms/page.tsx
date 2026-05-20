import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Terms of use — EduAI",
	description: "Terms of use for the EduAI service.",
	alternates: {
		canonical: "/legal/terms",
	},
};

export const dynamic = "force-static";
export const revalidate = 86400;

export default function LegalTermsPage() {
	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight">Terms of use</h1>
			<p className="mt-2 text-sm text-muted-foreground">Last updated April 2026</p>
			<div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
				<p>
					These terms govern your access to EduAI. They are a <strong className="text-foreground">working draft</strong>{" "}
					for early use and payment integration—they are <strong className="text-foreground">not legal advice</strong>.
					Before accepting payments at scale, publish terms reviewed by qualified counsel for your jurisdiction and
					entity. By using EduAI or subscribing, you agree to these terms and to our{" "}
					<Link href="/legal/privacy" className="font-medium text-link underline-offset-4 hover:underline">
						privacy policy
					</Link>
					.
				</p>
				<p>
					<strong className="text-foreground">Service.</strong> EduAI provides educational practice and related
					tools, including optional AI-assisted features. Outputs are generated automatically and may be inaccurate or
					incomplete; they are <strong className="text-foreground">assistive</strong>, not a substitute for classroom
					instruction, professional tutoring, or official exam guidance. Features and availability may change. Some
					capabilities require an active plan or trial as shown in the product.
				</p>
				<p>
					<strong className="text-foreground">Eligibility.</strong> You may use EduAI only if you can form a binding
					agreement under applicable law. Where accounts are used by minors, a parent, guardian, or school that
					controls billing or access should review these terms and our privacy policy.
				</p>
				<p>
					<strong className="text-foreground">Accounts.</strong> You are responsible for activity under your account
					and for keeping credentials secure. Notify us promptly using the contact below if you suspect unauthorized
					use.
				</p>
				<p>
					<strong className="text-foreground">Acceptable use.</strong> Do not misuse the service, attempt
					unauthorized access, interfere with other users or our systems, scrape at unreasonable scale without
					permission, or use outputs in ways that violate applicable law or school or exam rules. We may suspend or
					terminate access for material violations or legal risk.
				</p>
				<p>
					<strong className="text-foreground">Intellectual property.</strong> We and our licensors own the service,
					branding, and underlying materials subject to applicable licenses. You retain rights in content you submit;
					you grant us a limited licence to host, process, and display that content to operate and improve the service,
					consistent with our privacy policy.
				</p>
				<p>
					<strong className="text-foreground">Third-party services.</strong> The service relies on vendors including{" "}
					<strong className="text-foreground">Razorpay</strong> for payments and model providers for AI features.
					Their terms and outages may affect the product. Razorpay&apos;s checkout and mandate flows are subject to
					their published terms and privacy policy.
				</p>
				<p>
					<strong className="text-foreground">Payments.</strong> Paid plans are processed via Razorpay. Pricing, taxes,
					and invoicing follow Razorpay and your selected payment method. See our{" "}
					<Link href="/legal/refund" className="font-medium text-link underline-offset-4 hover:underline">
						refund & cancellation
					</Link>
					,{" "}
					<Link href="/legal/shipping" className="font-medium text-link underline-offset-4 hover:underline">
						shipping & delivery
					</Link>
					, and{" "}
					<Link href="/legal/privacy" className="font-medium text-link underline-offset-4 hover:underline">
						privacy policy
					</Link>
					.
				</p>
				<p>
					<strong className="text-foreground">Disclaimer.</strong> The service is provided&nbsp;
					<strong className="text-foreground">&quot;as is&quot; and &quot;as available&quot;</strong> without
					warranties of any kind, whether express or implied, to the maximum extent permitted by law, including
					implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
				</p>
				<p>
					<strong className="text-foreground">Limitation of liability.</strong> To the maximum extent permitted by
					applicable law (including mandatory consumer rights that cannot be waived), we and our affiliates,
					directors, and employees are not liable for any indirect, incidental, special, consequential, or punitive
					damages, or loss of profits, data, or goodwill, arising from your use of the service. Our aggregate liability
					for claims arising out of or related to the service in any twelve-month period is limited to the greater of
					(a) the amount you paid us for the service in that period or (b) <strong className="text-foreground">
						INR 5,000
					</strong>
					, except where law requires otherwise.
				</p>
				<p>
					<strong className="text-foreground">Indemnity.</strong> You will defend and indemnify us against claims
					arising from your misuse of the service, your content, or your breach of these terms, to the extent
					permitted by law.
				</p>
				<p>
					<strong className="text-foreground">Governing law & disputes.</strong> These terms are governed by the laws
					of the <strong className="text-foreground">Republic of India</strong>. Subject to non-waivable consumer rights
					where you reside, courts in India shall have jurisdiction. Nothing limits your right to pursue remedies
					under applicable consumer protection law.
				</p>
			</div>
		</>
	);
}
