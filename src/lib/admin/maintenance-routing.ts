import { isAdminAreaPath } from "@/lib/admin/proxy-guard";

/**
 * Pure predicate: should this pathname be redirected to /maintenance?
 * Admin and API-admin paths are never redirected so operators can work during outages.
 */
export function shouldRedirectToMaintenance(
	pathname: string,
	maintenanceModeEnv: string | undefined,
): boolean {
	if (maintenanceModeEnv !== "true") return false;
	if (pathname.startsWith("/maintenance")) return false;
	if (isAdminAreaPath(pathname)) return false;
	return true;
}
