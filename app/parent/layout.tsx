import { redirect } from "next/navigation";
// KaTeX CSS is loaded only on parent-portal pages (the read-only doubt
// history view renders the same LaTeX-aware markdown). Public pages don't
// need it, so we avoid the ~25KB on cold loads outside the authed surface.
import "katex/dist/katex.min.css";

import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AuthSignedOutListener } from "@/components/auth/auth-signed-out-listener";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getProfile } from "@/lib/auth/routing";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const profile = await getProfile();
	if (!profile || profile.role !== "parent") {
		redirect("/login");
	}
	if (profile.is_suspended) {
		redirect("/login?suspended=1");
	}
	return (
		<>
			<SkipToContent />
			<AuthSignedOutListener />
			<AdminImpersonationBanner />
			{children}
		</>
	);
}
