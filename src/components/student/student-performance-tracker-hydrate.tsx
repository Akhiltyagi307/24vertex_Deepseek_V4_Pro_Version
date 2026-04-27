"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { syncPerformanceTrackerFromSession } from "@/lib/student/sync-performance-tracker-action";

/**
 * When the server skipped blocking tracker sync, runs the same RPC once with the session
 * client, then refreshes RSC data.
 */
export function StudentPerformanceTrackerHydrate({ needsHydration }: { needsHydration: boolean }) {
	const router = useRouter();
	const ran = React.useRef(false);

	React.useEffect(() => {
		if (!needsHydration || ran.current) return;
		ran.current = true;
		void (async () => {
			const result = await syncPerformanceTrackerFromSession();
			if (result.ok) {
				router.refresh();
			}
		})();
	}, [needsHydration, router]);

	return null;
}
