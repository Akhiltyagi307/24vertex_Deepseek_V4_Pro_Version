"use client";

import { useCallback, useEffect, useState } from "react";

import { ADMIN_IMPERSONATION_COOKIE } from "@/lib/admin/constants";
import { Button } from "@/components/ui/button";

function readFlag(): boolean {
	if (typeof document === "undefined") return false;
	return document.cookie.split("; ").some((c) => c.startsWith(`${ADMIN_IMPERSONATION_COOKIE}=`));
}

export function AdminImpersonationBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const id = requestAnimationFrame(() => setVisible(readFlag()));
		return () => cancelAnimationFrame(id);
	}, []);

	const dismiss = useCallback(() => {
		document.cookie = `${ADMIN_IMPERSONATION_COOKIE}=; path=/; max-age=0`;
		setVisible(false);
	}, []);

	if (!visible) return null;

	return (
		<div
			role="status"
			className="flex flex-wrap items-center justify-center gap-3 border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-center text-sm font-medium text-destructive"
		>
			<span>ADMIN VIEW — impersonation session</span>
			<Button type="button" size="sm" variant="outline" className="border-destructive/40" onClick={dismiss}>
				Dismiss banner
			</Button>
		</div>
	);
}
