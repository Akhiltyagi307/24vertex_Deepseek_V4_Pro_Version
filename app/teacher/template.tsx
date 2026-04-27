import type { ReactNode } from "react";

import { SegmentPageTransition } from "@/components/motion/segment-page-transition";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
	return <SegmentPageTransition>{children}</SegmentPageTransition>;
}
