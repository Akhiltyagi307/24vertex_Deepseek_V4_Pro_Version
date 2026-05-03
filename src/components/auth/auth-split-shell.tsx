import Image from "next/image";
import Link from "next/link";

import { AuthSplitShellMotion } from "@/components/auth/auth-split-shell-motion";
import { Boxes } from "@/components/ui/background-boxes";

export function AuthSplitShell({ children }: { children: React.ReactNode }) {
	const logo = (
		<Link
			href="/"
			aria-label="24VERTEX home"
			className="inline-flex h-10 max-w-full shrink-0 items-center gap-3 rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
		>
			<span className="relative size-10 shrink-0">
				<Image
					src="/brand/logo-icon.avif"
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
		<div className="relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
			<div
				className="absolute inset-0 z-0 overflow-hidden opacity-[0.42] motion-reduce:opacity-[0.18]"
				aria-hidden
			>
				<Boxes />
			</div>
			<div className="relative z-10 flex min-h-0 flex-1 flex-col p-6 medium:p-10 pointer-events-none">
				<AuthSplitShellMotion logo={logo}>{children}</AuthSplitShellMotion>
			</div>
		</div>
	);
}
