import type { ReactNode } from "react";

import { SegmentPageTransition } from "@/components/motion/segment-page-transition";

export default function ParentTemplate({ children }: { children: ReactNode }) {
	return <SegmentPageTransition>{children}</SegmentPageTransition>;
}
