import type { ReactNode } from "react";

import { SegmentPageTransition } from "@/components/motion/segment-page-transition";

// Intentional template (not folded into layout): SegmentPageTransition's CSS
// enter animation needs the subtree to remount on each in-portal navigation,
// which is exactly what App Router template.tsx provides. Moving this into
// layout.tsx would mount the animation once and stop it from re-firing.
export default function ParentTemplate({ children }: { children: ReactNode }) {
	return (
		<SegmentPageTransition className="flex min-h-0 min-w-0 max-w-none flex-1 basis-0 flex-col">
			{children}
		</SegmentPageTransition>
	);
}
