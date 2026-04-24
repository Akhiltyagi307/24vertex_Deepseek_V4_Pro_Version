import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuthSplitShellMotionProps = {
	logo: ReactNode;
	children: ReactNode;
};

const enter =
	"motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:animate-none";

/**
 * Light enter animation without Framer (CSS via tw-animate), so the auth shell
 * does not pull motion into the client graph for this block.
 */
export function AuthSplitShellMotion({ logo, children }: AuthSplitShellMotionProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className={cn(enter, "flex shrink-0 justify-center md:justify-start")}>{logo}</div>
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto">
				<div
					className={cn(
						enter,
						"flex w-full max-w-xs flex-1 flex-col justify-center py-6 motion-safe:delay-75",
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
