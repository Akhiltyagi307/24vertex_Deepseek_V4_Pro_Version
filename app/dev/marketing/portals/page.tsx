import Link from "next/link";

export const metadata = {
	title: "Marketing portal mocks (dev only) · 24Vertex",
};

export default function MarketingPortalsIndexPage() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<p className="text-xs uppercase tracking-wider text-muted-foreground">Dev only · Marketing screenshots</p>
			<h1 className="mt-1 text-3xl font-semibold tracking-tight">Portal dashboard mocks</h1>
			<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
				Full-fidelity portal shells with fictional data. Open each route at desktop width (1280px+) and capture a
				screenshot for marketing. Student <strong>Aanya Sharma</strong> is shown doing well overall with weak Physics
				and Chemistry topics.
			</p>
			<ul className="mt-8 flex flex-col gap-3">
				<li>
					<Link
						href="/dev/marketing/portals/student"
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/40"
					>
						Student portal dashboard
					</Link>
				</li>
				<li>
					<Link
						href="/dev/marketing/portals/parent"
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/40"
					>
						Parent portal dashboard
					</Link>
				</li>
				<li>
					<Link
						href="/dev/marketing/portals/teacher"
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/40"
					>
						Teacher portal dashboard
					</Link>
				</li>
			</ul>
			<p className="mt-8 text-xs text-muted-foreground">
				Tip: hide the browser chrome, use light mode for consistency with the landing page, and crop to the app shell.
			</p>
		</main>
	);
}
