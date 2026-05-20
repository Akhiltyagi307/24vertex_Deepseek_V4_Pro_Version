"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Lazy-loaded WebGL background. three.js is ~180KB; we don't want it in the
 * initial marketing-page bundle. ssr:false skips the server pass entirely
 * (DottedSurface is decorative — there's nothing meaningful to render server-
 * side). Loading shows nothing while the chunk fetches.
 *
 * Wrapping in a client component is required because `ssr: false` is no longer
 * supported in dynamic() calls from server components.
 *
 * When `prefers-reduced-motion: reduce` is set, three.js is never fetched —
 * we render a static gradient backdrop instead. This honors the user's
 * preference, saves the bundle download, and avoids ~60Hz canvas redraws on
 * battery-constrained devices.
 */
const DottedSurfaceAnimated = dynamic(
	() => import("@/components/ui/dotted-surface").then((m) => ({ default: m.DottedSurface })),
	{ ssr: false, loading: () => null },
);

type DottedSurfaceLazyProps = Omit<React.ComponentProps<"div">, "ref">;

export function DottedSurfaceLazy({ className, ...props }: DottedSurfaceLazyProps) {
	const reduceMotion = useReducedMotion();
	if (reduceMotion) {
		return (
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none fixed inset-0 -z-1 bg-gradient-to-br from-background via-background to-muted/20",
					className,
				)}
				{...props}
			/>
		);
	}
	return <DottedSurfaceAnimated className={className} {...props} />;
}
