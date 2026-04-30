import { SignOutButton } from "@/components/auth/sign-out-button";

export default function AdminHomePage() {
	return (
		<div className="w-full min-w-0 space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
					<p className="text-sm text-muted-foreground">
						Signed in with an admin role. Extend this area when admin tooling ships.
					</p>
				</div>
				<SignOutButton />
			</div>
		</div>
	);
}
