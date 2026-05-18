"use client";

import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/lib/auth/sign-out";

export function ParentPortalSignOut() {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="text-muted-foreground hover:text-foreground"
			onClick={() => void signOutEverywhere()}
		>
			<LogOutIcon data-icon="inline-start" className="size-4" />
			Sign out
		</Button>
	);
}
