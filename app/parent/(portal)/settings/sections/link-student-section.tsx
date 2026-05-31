"use client";

import Link from "next/link";

import {
	settingsCardCtaButtonClass,
	settingsCardCtaRowClass,
} from "@/app/student/settings/_settings-form-styles";
import { Button } from "@/components/ui/button";

const settingsNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 medium:p-5";

export function LinkStudentSection() {
	return (
		<div className="space-y-8">
			<div>
				<h2 className="font-semibold text-lg tracking-tight text-foreground">Link a student</h2>
				<p className="mt-1 text-foreground/75 text-sm leading-relaxed dark:text-muted-foreground">
					Add another student with the link code from their Profile, or their account id.
				</p>
			</div>
			<div className={settingsNestedWellClass}>
				<p className="text-foreground text-sm font-semibold">Connect a student</p>
				<p className="mt-3 text-foreground/80 text-sm leading-relaxed dark:text-muted-foreground">
					You&apos;ll confirm the link on the next screen. The student must generate the code
					from their 24Vertex profile.
				</p>
				<div className={settingsCardCtaRowClass}>
					<Button
						className={settingsCardCtaButtonClass}
						size="lg"
						render={<Link href="/parent/link-child" />}
					>
						Link another student account
					</Button>
				</div>
			</div>
		</div>
	);
}
