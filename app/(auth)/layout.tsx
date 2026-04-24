import { AuthSplitShell } from "@/components/auth/auth-split-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="dark auth-studio min-h-svh">
			<AuthSplitShell>{children}</AuthSplitShell>
		</div>
	);
}
