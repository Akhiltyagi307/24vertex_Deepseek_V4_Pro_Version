import Link from "next/link";
import { Fragment } from "react";

import { LegalContactBlock } from "@/components/legal/legal-contact-block";
import { Providers } from "@/components/providers";

const SIBLING_LINKS = [
	{ href: "/legal/privacy", label: "Privacy policy" },
	{ href: "/legal/terms", label: "Terms of use" },
	{ href: "/legal/refund", label: "Refund & cancellation" },
	{ href: "/legal/shipping", label: "Shipping & delivery" },
] as const;

export default function LegalLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<Providers>
		<main className="w-full min-w-0 max-w-none px-4 py-12 text-foreground medium:px-8">
			{/* Not MotionPageEnter: the legal layout puts ALL content inside the
			    wrapper, and the `.motion-page-enter` opacity:0 entrance animation
			    doesn't advance in Lighthouse's headless Chrome → page never paints
			    (NO_FCP). Legal docs don't need an entrance; render them directly. */}
			<div className="flex flex-col">
				<nav aria-label="Legal section header" className="mb-6 flex items-center justify-between text-sm">
					<Link
						href="/"
						className="font-semibold text-foreground underline-offset-4 hover:underline"
					>
						24Vertex
					</Link>
					<Link
						href="/"
						className="text-link underline-offset-4 hover:underline"
					>
						← Back to home
					</Link>
				</nav>
				{children}
				<LegalContactBlock />
				<nav aria-label="Other legal pages" className="mt-10 flex flex-wrap gap-x-2 gap-y-1 text-sm">
					{SIBLING_LINKS.map((link, i) => (
						<Fragment key={link.href}>
							<Link
								href={link.href}
								className="text-link underline-offset-4 hover:underline"
							>
								{link.label}
							</Link>
							{i < SIBLING_LINKS.length - 1 && <span aria-hidden="true" className="text-muted-foreground">·</span>}
						</Fragment>
					))}
					<span aria-hidden="true" className="text-muted-foreground">·</span>
					<Link href="/" className="text-link underline-offset-4 hover:underline">
						Home
					</Link>
				</nav>
			</div>
		</main>
		</Providers>
	);
}
