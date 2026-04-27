import type { ReactNode } from "react";

import { SegmentPageTransition } from "@/components/motion/segment-page-transition";

export default function StudentTemplate({ children }: { children: ReactNode }) {
	return (
		<SegmentPageTransition className="flex min-h-0 min-w-0 flex-1 flex-col">
			{children}
		</SegmentPageTransition>
	);
}
