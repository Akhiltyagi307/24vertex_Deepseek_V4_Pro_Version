import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStudioCardGate } from "@/components/auth/auth-studio-card-gate";

export default function AuthSectionLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="dark auth-studio min-h-svh">
			<AuthSplitShell>
				<AuthStudioCardGate>{children}</AuthStudioCardGate>
			</AuthSplitShell>
		</div>
	);
}
