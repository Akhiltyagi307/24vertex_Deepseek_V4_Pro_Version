"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = { failureId: string };

export function ActionFailureRetryButton({ failureId }: Props) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function handleRetry() {
		startTransition(async () => {
			try {
				const res = await fetch(`/api/admin/billing/action-failures/${failureId}/retry`, {
					method: "POST",
				});
				const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string } | null;
				if (res.ok && data?.ok) {
					toast.success("Retry succeeded — failure resolved.");
					router.refresh();
					return;
				}
				const message = data?.error ?? `Retry failed (${res.status})`;
				toast.error(message);
				if (res.status === 502) router.refresh();
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Retry failed");
			}
		});
	}

	return (
		<Button variant="outline" size="sm" onClick={handleRetry} disabled={pending}>
			{pending ? "Retrying…" : "Retry"}
		</Button>
	);
}
