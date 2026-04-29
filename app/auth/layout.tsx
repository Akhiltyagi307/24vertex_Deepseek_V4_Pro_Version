import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStudioCard } from "@/components/auth/auth-studio-card";

export default function AuthSectionLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="dark auth-studio min-h-svh">
			<AuthSplitShell>
				<AuthStudioCard>{children}</AuthStudioCard>
			</AuthSplitShell>
		</div>
	);
}
