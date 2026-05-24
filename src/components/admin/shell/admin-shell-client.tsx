"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminCommandPalette } from "@/components/admin/command-palette";
import { AdminKeyboardShortcuts } from "@/components/admin/keyboard-shortcuts";
import { AdminBreadcrumbs, buildAdminBreadcrumbs } from "@/components/admin/shell/breadcrumbs";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/shell/sidebar";
import { AdminTopbar } from "@/components/admin/shell/topbar";

export function AdminShellClient({ children }: { children: React.ReactNode }) {
	const pathname = usePathname() ?? "/admin/dashboard";
	const [commandOpen, setCommandOpen] = useState(false);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const breadcrumbs = buildAdminBreadcrumbs(pathname);

	const openCommand = useCallback(() => setCommandOpen(true), []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setCommandOpen(true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<div className="flex min-h-screen w-full">
			<AdminSidebar pathname={pathname} />
			<AdminMobileNav pathname={pathname} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
			<div className="flex min-w-0 flex-1 flex-col">
				<AdminTopbar
					onOpenCommandPalette={openCommand}
					onOpenMobileNav={() => setMobileNavOpen(true)}
				/>
				<div className="border-b border-border px-4 py-3">
					<AdminBreadcrumbs items={breadcrumbs} />
				</div>
				<main id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none medium:p-6">
					{children}
				</main>
			</div>
			<AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
			<AdminKeyboardShortcuts />
		</div>
	);
}
