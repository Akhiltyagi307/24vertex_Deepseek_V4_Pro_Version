"use client";

import { useActionState } from "react";

import {
	confirmParentLinkAction,
	rejectParentLinkAction,
	type ParentLinkActionState,
} from "../parent-link-actions";
import type { PendingParentLinkRow } from "@/lib/parent/pending-parent-links";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";

function LinkActionButtons({ link }: { link: PendingParentLinkRow }) {
	const [confirmState, confirmAction] = useActionState<ParentLinkActionState, FormData>(
		confirmParentLinkAction,
		{},
	);
	const [rejectState, rejectAction] = useActionState<ParentLinkActionState, FormData>(
		rejectParentLinkAction,
		{},
	);

	const error = confirmState.error ?? rejectState.error;
	const done = confirmState.success || rejectState.success;

	if (done) {
		return (
			<p className="text-sm text-muted-foreground">
				{confirmState.success ? "Approved." : "Declined."} Refresh if this card still appears.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				<form action={confirmAction}>
					<input type="hidden" name="linkId" value={link.id} />
					<Button type="submit" size="sm">
						Approve
					</Button>
				</form>
				<form action={rejectAction}>
					<input type="hidden" name="linkId" value={link.id} />
					<Button type="submit" size="sm" variant="outline">
						Decline
					</Button>
				</form>
			</div>
		</div>
	);
}

export function PendingParentLinksPanel({ links }: { links: PendingParentLinkRow[] }) {
	if (links.length === 0) return null;

	return (
		<Alert className="mb-6 border-primary/25 bg-primary/5">
			<AlertTitle>Parent link requests</AlertTitle>
			<AlertDescription>
				<div className="flex flex-col gap-4 pt-1">
					<p className="text-sm leading-relaxed">
						These parents asked to connect using your link code. Approve only if you recognize them.
					</p>
					<ul className="flex flex-col gap-4">
						{links.map((link) => (
							<li
								key={link.id}
								className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background/80 p-3"
							>
								<p className="font-medium text-foreground text-sm">
									{formatPersonDisplayName(link.parent_name ?? "") || "Parent account"}
								</p>
								<LinkActionButtons link={link} />
							</li>
						))}
					</ul>
				</div>
			</AlertDescription>
		</Alert>
	);
}
