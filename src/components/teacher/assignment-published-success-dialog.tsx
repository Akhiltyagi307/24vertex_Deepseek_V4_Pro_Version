"use client";

import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	studentCount: number;
	onCreateAnother: () => void;
};

export function AssignmentPublishedSuccessDialog({
	open,
	onOpenChange,
	title,
	studentCount,
	onCreateAnother,
}: Props) {
	const studentLabel = studentCount === 1 ? "1 student" : `${studentCount} students`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md gap-0 p-0" showCloseButton>
				<DialogHeader className="space-y-4 border-border border-b px-6 py-6 text-left">
					<div
						className="flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary dark:bg-primary/16"
						aria-hidden
					>
						<CheckCircle2Icon className="size-6" />
					</div>
					<div className="space-y-2">
						<DialogTitle className="text-xl tracking-tight">Assignment published</DialogTitle>
						<DialogDescription className="text-sm leading-relaxed">
							<span className="font-medium text-foreground">{title}</span> is assigned to {studentLabel}.
							Each learner gets a generated test from your topic selection. Tests usually appear within a few
							minutes.
						</DialogDescription>
					</div>
				</DialogHeader>
				<DialogFooter className="flex-col gap-2 px-6 py-5 sm:flex-col sm:items-stretch">
					<Button render={<Link href="/teacher/submissions?tab=ongoing" />} nativeButton={false}>
						View submissions
					</Button>
					<Button type="button" variant="outline" onClick={onCreateAnother}>
						Create another
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
