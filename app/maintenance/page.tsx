export const metadata = {
	title: "Maintenance · EduAI",
	robots: { index: false, follow: false },
};

export default function MaintenancePage() {
	return (
		<div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-4 py-16 text-center">
			<h1 className="text-2xl font-semibold tracking-tight">We will be right back</h1>
			<p className="text-sm text-muted-foreground">
				The app is temporarily unavailable. Operator admin routes remain available when{" "}
				<code className="rounded bg-muted px-1 py-0.5 text-xs">MAINTENANCE_MODE</code> is enabled.
			</p>
		</div>
	);
}
