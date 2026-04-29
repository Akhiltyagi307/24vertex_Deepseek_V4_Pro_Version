import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthPath } from "@/lib/auth/routing";
import { MotionPageEnter } from "@/components/motion/motion-page-enter";
import { LandingMarketingBody } from "@/components/marketing/landing-marketing-body";
import { LandingSiteHeader } from "@/components/marketing/landing-site-header";

export default async function HomePage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (user) {
		const path = await resolvePostAuthPath();
		redirect(path);
	}

	return (
		<div className="min-h-screen bg-background">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
			>
				Skip to main content
			</a>
			<LandingSiteHeader />
			<MotionPageEnter>
				<main id="main-content" tabIndex={-1} className="outline-none">
					<LandingMarketingBody />
				</main>
			</MotionPageEnter>
		</div>
	);
}
