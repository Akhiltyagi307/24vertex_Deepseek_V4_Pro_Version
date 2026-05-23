import { notFound } from "next/navigation";

import { EmailPreviewGallery } from "@/components/dev/email-preview-gallery";
import { primeEmailLogoForPreview } from "@/lib/email/email-brand-logo";
import { buildEmailPreviewSamples } from "@/lib/email/email-preview-samples";

export const metadata = {
	title: "Email template preview (dev only) · 24Vertex",
};

/**
 * Dev-only gallery of every transactional email (notifications, billing,
 * org events, admin ops) plus representative Supabase Auth messages.
 */
export default function EmailTemplatesPreviewPage(): React.ReactElement {
	if (process.env.NODE_ENV === "production") {
		notFound();
	}

	primeEmailLogoForPreview();

	const samples = buildEmailPreviewSamples();
	const appCount = samples.filter((s) => s.source === "app").length;
	const authCount = samples.filter((s) => s.source === "supabase").length;
	const adminCount = samples.filter((s) => s.source === "admin").length;

	return (
		<main className="mx-auto max-w-[1400px] px-6 py-10">
			<header className="mb-8">
				<p className="text-xs uppercase tracking-wider text-muted-foreground">Dev only</p>
				<h1 className="mt-1 text-3xl font-semibold tracking-tight">Email template preview</h1>
				<p className="mt-3 max-w-3xl text-sm text-muted-foreground">
					Live HTML from <code>renderEmailShell()</code> and the same builders used in production senders.
					App templates can be overridden by active rows in <code>email_templates</code> (admin
					Communications). Supabase Auth mail is configured in each Supabase project dashboard. Previews
					here show branded stand-ins for layout review.
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					<strong>{samples.length}</strong> templates: {appCount} app, {authCount} auth, {adminCount}{" "}
					admin. Static export:{" "}
					<code className="text-xs">pnpm exec tsx scripts/preview-emails.ts</code>
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Other dev galleries:{" "}
					<a className="underline" href="/dev/practice/visuals/fixture-gallery">
						practice visual fixtures
					</a>
					{" · "}
					<a className="underline" href="/dev/marketing/portals">
						marketing portal mocks
					</a>
				</p>
			</header>

			<EmailPreviewGallery samples={samples} />
		</main>
	);
}
