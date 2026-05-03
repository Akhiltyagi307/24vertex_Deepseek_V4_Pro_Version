import { Suspense } from "react";

import { AdminLoginForm } from "./admin-login-form";

export const metadata = {
	title: "Admin sign in · EduAI",
	robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
	return (
		<div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-12">
			<div className="mb-8 space-y-1 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">Operator sign in</h1>
				<p className="text-sm text-muted-foreground">Founder admin panel (env credentials).</p>
			</div>
			<Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
				<AdminLoginForm />
			</Suspense>
		</div>
	);
}
