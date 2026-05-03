"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-loaded WebGL background. three.js is ~180KB; we don't want it in the
 * initial marketing-page bundle. ssr:false skips the server pass entirely
 * (DottedSurface is decorative — there's nothing meaningful to render server-
 * side). Loading shows nothing while the chunk fetches.
 *
 * Wrapping in a client component is required because `ssr: false` is no longer
 * supported in dynamic() calls from server components.
 */
export const DottedSurfaceLazy = dynamic(
	() => import("@/components/ui/dotted-surface").then((m) => ({ default: m.DottedSurface })),
	{ ssr: false, loading: () => null },
);
