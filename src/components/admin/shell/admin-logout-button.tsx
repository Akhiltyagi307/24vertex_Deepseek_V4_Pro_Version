"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AdminLogoutButton() {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function logout() {
		setPending(true);
		try {
			await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" });
			router.replace("/admin/login");
			router.refresh();
		} finally {
			setPending(false);
		}
	}

	return (
		<Button type="button" variant="outline" size="sm" onClick={() => void logout()} disabled={pending}>
			{pending ? "Signing out…" : "Sign out"}
		</Button>
	);
}
