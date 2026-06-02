import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerUser } from "@/lib/auth/get-server-user";
import { resolvePostAuthPath } from "@/lib/auth/routing";
import { NonceProviders } from "@/components/nonce-providers";
import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { HomeMarketingShell } from "@/components/marketing/home-marketing-shell";
import { LandingMarketingBody } from "@/components/marketing/landing-marketing-body";
import { MarketingSiteHeader } from "@/components/marketing/marketing-site-header";
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer";
import { rupeesFromPaise, PLAN_CATALOG } from "@/lib/billing/plans";
import { getAppUrl, getPublicSupportEmail } from "@/lib/env";

export const metadata: Metadata = {
	alternates: {
		canonical: "/",
	},
};

// `getAppUrl()` throws on a loopback host in `NODE_ENV=production` (CI bundle-budget
// case). Fall back to the raw env so JSON-LD still renders something sensible
// during the static prerender; real deploys get the live origin.
function resolveLandingBaseUrl(): string {
	try {
		return getAppUrl();
	} catch {
		return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
	}
}

const PARENT_FIRST_DESCRIPTION =
	"24Vertex helps Indian families catch weak chapters before report-card day, with adaptive AI practice, a private Explain and Solve-with-me tutor, and a chapter-level parent dashboard. Built for grades 6 to 10, aligned to CBSE, ICSE, and state boards.";

export default async function HomePage() {
	const landingBaseUrl = resolveLandingBaseUrl();
	const supportEmail = getPublicSupportEmail();
	const monthlyPriceInr = String(rupeesFromPaise(PLAN_CATALOG.pro_monthly.pricePaise));
	const yearlyPriceInr = String(rupeesFromPaise(PLAN_CATALOG.pro_annual.pricePaise));
	// Root must be a single object with `@context` — Safari throws when the
	// document is a top-level array (`r["@context"]` is undefined on Array).
	const landingJsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "EducationalOrganization",
				name: "24Vertex",
				url: landingBaseUrl,
				logo: `${landingBaseUrl}/brand/logo-icon.png`,
				description: PARENT_FIRST_DESCRIPTION,
				sameAs: [],
				...(supportEmail
					? {
							contactPoint: {
								"@type": "ContactPoint",
								contactType: "customer support",
								email: supportEmail,
								availableLanguage: ["English", "Hindi"],
							},
						}
					: {}),
			},
			{
				"@type": "WebSite",
				name: "24Vertex",
				url: landingBaseUrl,
				inLanguage: "en-IN",
				description: PARENT_FIRST_DESCRIPTION,
			},
			{
				"@type": "Product",
				name: "24Vertex student subscription",
				description:
					"Adaptive AI practice, private Explain and Solve-with-me tutor, and chapter mastery radar charts for grades 6 to 10. 14-day free trial. Only student accounts are paid.",
				brand: { "@type": "Brand", name: "24Vertex" },
				offers: [
					{
						"@type": "Offer",
						name: "Monthly",
						price: monthlyPriceInr,
						priceCurrency: "INR",
						priceSpecification: {
							"@type": "UnitPriceSpecification",
							price: monthlyPriceInr,
							priceCurrency: "INR",
							referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
						},
						availability: "https://schema.org/InStock",
						url: `${landingBaseUrl}/signup/parent`,
					},
					{
						"@type": "Offer",
						name: "Yearly",
						price: yearlyPriceInr,
						priceCurrency: "INR",
						priceSpecification: {
							"@type": "UnitPriceSpecification",
							price: yearlyPriceInr,
							priceCurrency: "INR",
							referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "ANN" },
						},
						availability: "https://schema.org/InStock",
						url: `${landingBaseUrl}/signup/parent`,
					},
				],
			},
		],
	};

	// Skip the Supabase client construction + getUser for the vast majority of
	// landing traffic that arrives with no auth cookie; only logged-in visitors
	// (cookie present) pay for the post-auth redirect check. `getServerUser` is
	// React-cached so `resolvePostAuthPath` (also calls it) dedupes — one
	// Supabase round-trip total when logged in.
	const hasSupabaseAuthCookie = (await cookies())
		.getAll()
		.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
	if (hasSupabaseAuthCookie) {
		const user = await getServerUser();
		if (user) {
			const path = await resolvePostAuthPath();
			// `resolvePostAuthPath` sends legacy `profiles.role === "admin"` users to "/".
			// Redirecting "/" → "/" would loop; show marketing for that case instead.
			if (path !== "/") {
				redirect(path);
			}
		}
	}

	return (
		<NonceProviders>
		<HomeMarketingShell className="flex min-h-screen w-full flex-col bg-background">
			{/* JSON-LD is not executable JS — CSP `script-src` does not apply, and
			    attaching a per-request `nonce` causes a React hydration mismatch
			    because browsers hide nonce values from DOM APIs during hydration. */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(landingJsonLd),
				}}
			/>
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
			>
				Skip to main content
			</a>
			<MarketingSiteHeader />
			<div
				className="box-border flex min-h-0 w-full min-w-0 flex-1 flex-col"
				style={{ paddingInline: "10%" }}
			>
				<MotionPageEnter className="flex min-h-0 flex-1 flex-col">
					<main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
						<LandingMarketingBody supportEmail={supportEmail} />
					</main>
				</MotionPageEnter>
			</div>
			<MarketingSiteFooter />
		</HomeMarketingShell>
		</NonceProviders>
	);
}
