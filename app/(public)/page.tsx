import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import { resolvePostAuthPath } from "@/lib/auth/routing";
import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { HomeMarketingShell } from "@/components/marketing/home-marketing-shell";
import { LandingMarketingBody } from "@/components/marketing/landing-marketing-body";
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

export default async function HomePage() {
	// Schema.org JSON-LD: declares the organization + the canonical website.
	// Stamped on the landing page only (not the (public) layout) so we emit a
	// single Organization node for the site root, not one per legal subpath.
	const landingBaseUrl = resolveLandingBaseUrl();
	const supportEmail = getPublicSupportEmail();
	// Root must be a single object with `@context` — Safari throws when the
	// document is a top-level array (`r["@context"]` is undefined on Array).
	const landingJsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				name: "24Vertex",
				url: landingBaseUrl,
				logo: `${landingBaseUrl}/brand/logo-icon.png`,
				description:
					"Adaptive assessment, parent visibility, and class-level signals — one product for students, parents, and teachers.",
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
			},
		],
	};

	// `getServerUser` is React-cached so `resolvePostAuthPath` (also calls it)
	// dedupes against this read — one Supabase round-trip total when logged in.
	const user = await getServerUser();
	if (user) {
		const path = await resolvePostAuthPath();
		// `resolvePostAuthPath` sends legacy `profiles.role === "admin"` users to "/".
		// Redirecting "/" → "/" would loop; show marketing for that case instead.
		if (path !== "/") {
			redirect(path);
		}
	}

	return (
		<HomeMarketingShell className="min-h-screen w-full bg-background">
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
			<div
				className="box-border min-h-screen min-w-0 w-full"
				style={{ paddingInline: "10%" }}
			>
				<div className="box-border min-h-screen min-w-0 w-full bg-background">
					<MotionPageEnter>
						<main id="main-content" tabIndex={-1} className="min-w-0 outline-none">
							<LandingMarketingBody />
						</main>
					</MotionPageEnter>
				</div>
			</div>
		</HomeMarketingShell>
	);
}
