import { TriangleAlertIcon } from "lucide-react";

/**
 * Dev-only banner surfacing the SAAS_ENFORCEMENT=false flag.
 *
 * Rendering is gated server-side on NODE_ENV so production bundles never
 * include this chrome, regardless of the entitlement payload.
 */
export function DevEnforcementBanner({ enforcementActive }: { enforcementActive: boolean }) {
	if (process.env.NODE_ENV === "production") return null;
	if (enforcementActive) return null;

	return (
		<div
			role="status"
			className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
		>
			<TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
			<div className="flex flex-col gap-0.5">
				<span className="font-medium">Dev environment</span>
				<span className="text-amber-900/80 dark:text-amber-200/80">
					Quota enforcement is off (<code className="font-mono">SAAS_ENFORCEMENT=false</code>). This
					banner never ships to production.
				</span>
			</div>
		</div>
	);
}
