import Image from "next/image";
import Link from "next/link";

import { AuthSplitShellMotion } from "@/components/auth/auth-split-shell-motion";

export function AuthSplitShell({ children }: { children: React.ReactNode }) {
	const logo = (
		<Link href="/" className="inline-flex h-10 max-w-full shrink-0 items-center gap-3">
			<span className="relative size-10 shrink-0">
				<Image
					src="/brand/logo-icon.png"
					alt=""
					fill
					className="object-contain"
					priority
					sizes="40px"
				/>
			</span>
			<span className="text-lg font-bold tracking-wide text-foreground">24VERTEX</span>
		</Link>
	);

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex min-h-0 flex-col bg-background p-6 text-foreground md:p-10 lg:border-r lg:border-border">
				<AuthSplitShellMotion logo={logo}>{children}</AuthSplitShellMotion>
			</div>
			{/* Decorative panel: no `priority` — column is hidden below lg; avoids preloading a large asset on mobile. */}
			<div className="relative hidden overflow-hidden lg:block">
				<Image
					src="/brand/auth-fractal-glass.png"
					alt=""
					fill
					className="object-cover"
					loading="lazy"
					sizes="50vw"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-black/15"
				/>
			</div>
		</div>
	);
}
