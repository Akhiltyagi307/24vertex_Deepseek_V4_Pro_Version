"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client island for the teacher "verification pending" page. The parent page is a
 * server component that redirects to /teacher/dashboard once `is_verified` flips
 * true. We poll with `router.refresh()` so that re-run happens automatically while
 * the educator waits — no realtime subscription needed.
 */
export function PendingStatus() {
	const router = useRouter();

	useEffect(() => {
		const id = window.setInterval(() => {
			router.refresh();
		}, 20_000);
		return () => window.clearInterval(id);
	}, [router]);

	return (
		<p className="text-sm text-muted-foreground" aria-live="polite">
			Most accounts are reviewed within a day. This page refreshes itself, so you can leave it
			open — it&apos;ll move you forward the moment your access is approved.
		</p>
	);
}
