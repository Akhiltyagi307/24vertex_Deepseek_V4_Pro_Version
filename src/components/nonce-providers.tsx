import { headers } from "next/headers";

import { Providers } from "@/components/providers";
import { CSP_NONCE_REQUEST_HEADER } from "@/lib/security/csp";

/**
 * Portal/auth provider shell: reads the per-request CSP nonce from `proxy.ts`
 * so `next-themes` pre-hydration scripts satisfy `strict-dynamic`.
 */
export async function NonceProviders({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const nonce = (await headers()).get(CSP_NONCE_REQUEST_HEADER) ?? undefined;
	return <Providers nonce={nonce}>{children}</Providers>;
}
