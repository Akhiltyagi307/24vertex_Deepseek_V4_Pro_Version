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
const authMax = "mx-auto w-full min-w-0 max-w-none";

/**
 * Cap the split card at half the viewport on md+ so the panel does not span the full width.
 * Mobile stays full width so the form column remains readable.
 */
const authHitMax = "mx-auto w-full min-w-0 md:max-w-[50dvw]";

export function AuthSplitShellMotion({ logo, children }: AuthSplitShellMotionProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
			<div
				className={cn(
					enter,
					authMax,
					"flex shrink-0 justify-center md:justify-start",
					"pointer-events-none",
				)}
			>
				<div className="pointer-events-auto w-fit max-w-full">{logo}</div>
			</div>
			<div className="pointer-events-none flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
				<div
					className={cn(
						enter,
						authHitMax,
						"pointer-events-auto flex max-h-full min-w-0 w-full shrink-0 flex-col overflow-y-auto",
						"pb-6 pt-0 motion-safe:delay-75 md:pb-10 md:pt-1",
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
