import { Menu, Search } from "lucide-react";

import { AdminLogoutButton } from "@/components/admin/shell/admin-logout-button";
import { Button } from "@/components/ui/button";
import { isProductionDeployment } from "@/lib/env";

export function AdminTopbar({
	onOpenCommandPalette,
	onOpenMobileNav,
}: {
	onOpenCommandPalette: () => void;
	onOpenMobileNav: () => void;
}) {
	const envLabel = isProductionDeployment() ? "production" : "non-production";
	return (
		<header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4">
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="shrink-0 medium:hidden"
					aria-label="Open navigation menu"
					onClick={onOpenMobileNav}
				>
					<Menu className="size-4" aria-hidden />
				</Button>
				<span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
					{envLabel}
				</span>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="hidden h-9 max-w-md flex-1 justify-start gap-2 text-muted-foreground medium:flex"
					onClick={onOpenCommandPalette}
				>
					<Search className="size-4 shrink-0" aria-hidden />
					<span className="truncate">Search or jump to…</span>
					<kbd className="pointer-events-none ml-auto hidden shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground medium:inline">
						⌘K
					</kbd>
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="medium:hidden"
					aria-label="Open command palette"
					onClick={onOpenCommandPalette}
				>
					<Search className="size-4" />
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Operator</span>
				<AdminLogoutButton />
			</div>
		</header>
	);
}
