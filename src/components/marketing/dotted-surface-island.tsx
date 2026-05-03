"use client";

import dynamic from "next/dynamic";

import { LazyVisible } from "@/components/util/lazy-visible";

/** Three.js (~600 KB) only loads when the CTA section approaches the viewport. */
const DottedSurface = dynamic(
	() => import("@/components/ui/dotted-surface").then((m) => ({ default: m.DottedSurface })),
	{ ssr: false, loading: () => null },
);

export function DottedSurfaceIsland({ className }: { className?: string }) {
	return (
		<LazyVisible className={className}>
			<DottedSurface className={className} />
		</LazyVisible>
	);
}
