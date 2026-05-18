import type { Metadata } from "next";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStudioCardGate } from "@/components/auth/auth-studio-card-gate";

export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="dark auth-studio min-h-svh">
			<AuthSplitShell>
				<AuthStudioCardGate>{children}</AuthStudioCardGate>
			</AuthSplitShell>
		</div>
	);
}
