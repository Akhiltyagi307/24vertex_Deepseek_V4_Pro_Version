// KaTeX CSS is loaded only on parent-portal pages (the read-only doubt
// history view renders the same LaTeX-aware markdown). Public pages don't
// need it, so we avoid the ~25KB on cold loads outside the authed surface.
import "katex/dist/katex.min.css";

import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AuthSignedOutListener } from "@/components/auth/auth-signed-out-listener";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { requireParent } from "@/lib/auth/require-parent";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
	await requireParent();
	return (
		<>
			<SkipToContent />
			<AuthSignedOutListener />
			<AdminImpersonationBanner />
			{children}
		</>
	);
}
