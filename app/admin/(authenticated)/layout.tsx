import { AdminShellClient } from "@/components/admin/shell/admin-shell-client";
import { requireAdmin } from "@/lib/admin/guards";

/** Admin console hits DB + session; never prerender at build (avoids CI timeouts without a live DB). */
export const dynamic = "force-dynamic";

export default async function AdminAuthenticatedLayout({ children }: { children: React.ReactNode }) {
	await requireAdmin();
	return (
		<AdminShellClient
			breadcrumbs={[
				{ label: "Admin", href: "/admin/dashboard" },
				{ label: "Console" },
			]}
		>
			{children}
		</AdminShellClient>
	);
}
