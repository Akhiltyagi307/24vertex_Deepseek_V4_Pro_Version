"use client";

import type { StudentProfileSettingsRow } from "../student-profile-settings-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function ParentPanel({
	profile,
}: {
	profile: StudentProfileSettingsRow;
}) {
	return (
		<div>
			<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
				<CardHeader className="px-0 pt-0">
					<CardTitle className="text-lg">Guardian &amp; parent connection</CardTitle>
					<CardDescription className="text-base leading-relaxed">
						After a parent connects using your link code, we show their contact here.
						You cannot change these fields.
					</CardDescription>
				</CardHeader>
				<CardContent className="px-0">
					<div className="flex flex-col gap-4">
						<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed">
							<span className="text-muted-foreground font-medium">Guardian name</span>
							<span className="text-muted-foreground"> - </span>
							<span className="min-w-0 text-foreground">
								{profile.parent_name?.trim() || "—"}
							</span>
						</p>
						<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed">
							<span className="text-muted-foreground font-medium">Guardian email</span>
							<span className="text-muted-foreground"> - </span>
							<span className="min-w-0 break-all text-foreground">
								{profile.parent_email?.trim() || "—"}
							</span>
						</p>
					</div>
					<p className="mt-6 text-muted-foreground text-sm leading-relaxed">
						These values are set when your parent links their account with your link
						code.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
