import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import { resolvePostAuthPath } from "@/lib/auth/routing";
import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { HomeMarketingShell } from "@/components/marketing/home-marketing-shell";
import { LandingMarketingBody } from "@/components/marketing/landing-marketing-body";

export default async function HomePage() {
	// `getServerUser` is React-cached so `resolvePostAuthPath` (also calls it)
	// dedupes against this read — one Supabase round-trip total when logged in.
	const user = await getServerUser();
	if (user) {
		const path = await resolvePostAuthPath();
		redirect(path);
	}

	return (
		<HomeMarketingShell className="min-h-screen w-full bg-background">
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
