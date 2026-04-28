"use client";

import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function ParentPortalSignOut() {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="text-muted-foreground hover:text-foreground"
			onClick={async () => {
				const supabase = createClient();
				await supabase.auth.signOut();
				window.location.href = "/";
			}}
		>
			<LogOutIcon data-icon="inline-start" className="size-4" />
			Sign out
		</Button>
	);
}
