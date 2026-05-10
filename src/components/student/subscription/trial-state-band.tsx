import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { formatDateLongDMYInAppTimeZone } from "@/lib/datetime/app-timezone";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

import { TrialRing } from "./trial-ring";

type Props = {
	entitlement: EntitlementSnapshot;
	className?: string;
};

const TRIAL_TOTAL_DAYS = 14;

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}\u00A0M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}\u00A0k`;
	return n.toLocaleString("en-IN");
}

function formatEndDate(iso: string): string {
	const s = formatDateLongDMYInAppTimeZone(iso);
	return s === "—" ? "" : s;
}

function MiniMeter({
	label,
	used,
	quota,
	formatter = (n: number) => n.toLocaleString("en-IN"),
}: {
	label: string;
	used: number;
	quota: number;
	formatter?: (n: number) => string;
}) {
	const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
	return (
		<div className="grid gap-1.5">
			<div className="flex items-baseline justify-between text-xs">
				<span className="font-medium text-foreground">{label}</span>
				<span className="text-muted-foreground tabular-nums">
					{formatter(used)} / {formatter(quota)}
				</span>
			</div>
			<Progress value={pct} className="gap-0">
				<ProgressTrack className="h-1.5">
					<ProgressIndicator />
				</ProgressTrack>
			</Progress>
		</div>
	);
}

export function TrialStateBand({ entitlement, className }: Props) {
	const daysLeft = entitlement.trialDaysLeft ?? 0;
	const endsLabel = formatEndDate(entitlement.currentPeriodEnd);

	return (
		<section
			aria-labelledby="trial-state-title"
			className={cn(
				"relative overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.04] p-5 medium:p-6",
				className,
			)}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primary/[0.08] blur-2xl"
			/>

			<div className="flex flex-col gap-4 medium:flex-row medium:items-center medium:justify-between medium:gap-8">
				<div className="flex min-w-0 flex-col gap-1">
					<p className="font-mono text-[11px] uppercase tracking-wider text-primary/80">
						Free trial
					</p>
					<h2
						id="trial-state-title"
						className="font-heading text-lg font-medium tracking-tight text-balance"
					>
						You&rsquo;re on the free trial
					</h2>
					<p className="text-sm text-muted-foreground">
						{`14-day full access${endsLabel ? ` \u00B7 ends ${endsLabel}` : ""} \u00B7 no card on file`}
					</p>
				</div>
				<TrialRing
					daysLeft={daysLeft}
					daysTotal={TRIAL_TOTAL_DAYS}
					className="text-foreground medium:mr-2"
				/>
			</div>

			<div className="mt-5 grid gap-4 medium:grid-cols-2">
				<MiniMeter
					label="Practice tests"
					used={entitlement.testsUsed}
					quota={entitlement.testsQuota}
				/>
				<MiniMeter
					label="AI output (doubt chat)"
					used={entitlement.tokensUsed}
					quota={entitlement.tokensQuota}
					formatter={formatTokens}
				/>
			</div>
		</section>
	);
}
