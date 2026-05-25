import { NonceProviders } from "@/components/nonce-providers";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
	return (
		<NonceProviders>
			<div className="min-h-screen bg-background">{children}</div>
		</NonceProviders>
	);
}
