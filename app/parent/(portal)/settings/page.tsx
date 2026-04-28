import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { loadLinkedChildrenForParent } from "@/lib/parent/linked-children";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { selectParentStudentAction } from "../../select-student/actions";

export const dynamic = "force-dynamic";

export default async function ParentSettingsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "parent") redirect("/login");

	const children = await loadLinkedChildrenForParent(user.id);
	const displayName = formatPersonDisplayName(row.full_name ?? "") || "Parent";

	return (
		<div className="w-full min-w-0 p-6 sm:p-8">
			<PageStaggerRoot
				enableLift={false}
				className="mx-auto flex max-w-2xl flex-col gap-8"
				sections={[
					{
						key: "header",
						content: (
							<div className="flex items-center justify-between gap-4">
								<div>
									<h1 className="font-semibold text-2xl tracking-tight">Account</h1>
									<p className="text-muted-foreground mt-1 text-sm">Signed in as {displayName}</p>
								</div>
								<SignOutButton />
							</div>
						),
					},
					{
						key: "switch",
						content: (
							<section className="flex flex-col gap-3">
								<h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Switch child
								</h2>
								<p className="text-muted-foreground text-sm">
									View overview, progress, and test reports for another child linked to your account.
								</p>
								<ul className="flex flex-col gap-2">
									{children.map((c) => {
										const name = formatPersonDisplayName(c.full_name ?? "") || "Your child";
										return (
											<li key={c.id}>
												<form action={selectParentStudentAction}>
													<input type="hidden" name="studentId" value={c.id} />
													<button
														type="submit"
														className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40"
													>
														{name}
													</button>
												</form>
											</li>
										);
									})}
								</ul>
								<p className="text-sm">
									<Link href="/parent/select-student" className="text-primary underline underline-offset-4">
										Choose another child
									</Link>
								</p>
							</section>
						),
					},
					{
						key: "link",
						content: (
							<section className="flex flex-col gap-2 border-t pt-8">
								<h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Link a child
								</h2>
								<p className="text-sm">
									<Link href="/parent/link-child" className="text-primary underline underline-offset-4">
										Add another child with their link code
									</Link>
								</p>
							</section>
						),
					},
				]}
			/>
		</div>
	);
}
