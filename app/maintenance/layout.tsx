import { NonceProviders } from "@/components/nonce-providers";

export default async function MaintenanceLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <NonceProviders>{children}</NonceProviders>;
}
