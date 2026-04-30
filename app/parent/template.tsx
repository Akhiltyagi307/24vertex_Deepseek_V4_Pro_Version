import type { ReactNode } from "react";

import { SegmentPageTransition } from "@/components/motion/segment-page-transition";

export default function ParentTemplate({ children }: { children: ReactNode }) {
	return (
		<SegmentPageTransition className="flex min-h-0 min-w-0 max-w-none flex-1 basis-0 flex-col">
			{children}
		</SegmentPageTransition>
	);
}
