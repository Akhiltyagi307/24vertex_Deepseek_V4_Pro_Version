import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStudioCardGate } from "@/components/auth/auth-studio-card-gate";
import { NonceProviders } from "@/components/nonce-providers";

export default async function AuthSectionLayout({ children }: { children: React.ReactNode }) {
	return (
		<NonceProviders>
			<div className="dark auth-studio min-h-svh">
				<AuthSplitShell>
					<AuthStudioCardGate>{children}</AuthStudioCardGate>
				</AuthSplitShell>
			</div>
		</NonceProviders>
	);
}
