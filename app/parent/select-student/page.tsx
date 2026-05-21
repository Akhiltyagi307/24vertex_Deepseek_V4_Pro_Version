import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	ChevronRightIcon,
	InfoIcon,
	UserPlusIcon,
	UsersRoundIcon,
} from "lucide-react";

import { selectParentStudentAction } from "./actions";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { ParentPortalStandaloneShell } from "@/components/parent/parent-portal-standalone-shell";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getProfile } from "@/lib/auth/routing";
import { loadLinkedChildrenForParent } from "@/lib/parent/linked-children";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Choose a child · Parent",
	description: "Pick which linked child to open the parent overview for.",
	robots: { index: false, follow: false },
};

function gradeLabel(grade: number | null, section: string | null): string {
	if (grade == null) return "Grade not set";
	const sec = section ? ` · ${section}` : "";
	return `Grade ${grade}${sec}`;
}

function initialsFromName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
	return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

export default async function ParentSelectStudentPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const profile = await getProfile();
	if (!profile || profile.role !== "parent") {
		redirect("/login");
	}

	const children = await loadLinkedChildrenForParent(user.id);
	const linkedSummary =
		children.length === 0
			? null
			: children.length === 1
				? "1 linked child"
				: `${children.length} linked children`;

	const staggerSections = [
		{
			key: "header",
			content: (
				<header className="flex flex-col gap-3">
					<div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:bg-muted/25">
						<UsersRoundIcon className="size-5" aria-hidden />
					</div>
					<div className="flex flex-col gap-1.5">
						<h1 className="text-balance font-semibold text-2xl tracking-tight">
							Which child are you viewing?
						</h1>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Choose a linked child to open their parent overview. You can switch anytime from Account.
						</p>
						{linkedSummary ? (
							<p className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.06em]">
								{linkedSummary}
							</p>
						) : null}
					</div>
				</header>
			),
		},
		{
			key: "list",
			content:
				children.length === 0 ? (
					<div className="rounded-xl border border-border bg-card p-8 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
						<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border">
							<UsersRoundIcon className="size-7 text-muted-foreground" aria-hidden />
						</div>
						<p className="text-foreground text-sm leading-relaxed">
							You haven&apos;t linked a child yet. Ask them for their six-character link code from their 24Vertex
							Profile (student app).
						</p>
						<div className="mt-6">
							<Button variant="default" render={<Link href="/parent/link-child" />}>
								<UserPlusIcon data-icon="inline-start" />
								Link a child
							</Button>
						</div>
					</div>
				) : (
					<ul className="flex flex-col gap-3">
						{children.map((c) => {
										const name = formatPersonDisplayName(c.full_name ?? "") || "Your child";
							const label = gradeLabel(c.grade, c.section);
							const code = c.student_link_code ?? "";
							const initials = initialsFromName(name);
							return (
								<li key={c.id}>
									<form action={selectParentStudentAction}>
										<input type="hidden" name="studentId" value={c.id} />
										<button
											type="submit"
											aria-label={`Open parent overview for ${name}`}
											className="group flex w-full items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-[background-color,border-color,transform] duration-150 hover:border-primary/45 hover:bg-muted/45 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
										>
											<span
												className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 text-sm font-semibold text-primary tabular-nums ring-1 ring-primary/20"
												aria-hidden
											>
												{initials}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate font-medium text-foreground">{name}</span>
												<span className="mt-0.5 block truncate text-muted-foreground text-xs">
													{label}
													{code ? (
														<>
															{" "}
															<span className="text-muted-foreground/80">·</span>{" "}
															<span className="font-mono text-[11px] text-muted-foreground">{code}</span>
														</>
													) : null}
												</span>
											</span>
											<ChevronRightIcon
												className="size-5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
												aria-hidden
											/>
										</button>
									</form>
								</li>
							);
						})}
					</ul>
				),
		},
		...(children.length > 0
			? [
					{
						key: "footer",
						content: (
							<div className="flex flex-col gap-4 border-t border-border pt-8">
								<Button variant="outline" className="w-full medium:w-auto" render={<Link href="/parent/link-child" />}>
									<UserPlusIcon data-icon="inline-start" />
									Link another child
								</Button>
								<div className="flex gap-3 rounded-lg border border-border/80 bg-muted/25 p-3.5 text-muted-foreground text-xs leading-relaxed">
									<InfoIcon className="mt-0.5 size-4 shrink-0 text-primary/90" aria-hidden />
									<p>
										Use their link code from the student Profile—if they already had a guardian email saved,
										yours must match it.
									</p>
								</div>
							</div>
						),
					},
				]
			: []),
	];

	return (
		<ParentPortalStandaloneShell>
			<PageStaggerRoot enableLift={false} className="flex flex-1 flex-col gap-9" sections={staggerSections} />
		</ParentPortalStandaloneShell>
	);
}
