import Link from "next/link";

import type { LinkedStudent, UserDetailRow } from "./types";

interface ProfileTabProps {
	row: UserDetailRow;
	linkedStudents: LinkedStudent[];
}

export function ProfileTab({ row, linkedStudents }: ProfileTabProps) {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 rounded-lg border border-border p-4 medium:grid-cols-2">
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Role</h2>
					<p className="mt-1">{row.role}</p>
				</div>
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Grade / section</h2>
					<p className="mt-1">
						{row.grade ?? "—"} / {row.section ?? "—"}
					</p>
				</div>
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Stream</h2>
					<p className="mt-1">{row.stream ?? "—"}</p>
				</div>
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Verified</h2>
					<p className="mt-1">{row.is_verified ? "Yes" : "No"}</p>
				</div>
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Suspended</h2>
					<p className="mt-1">{row.is_suspended ? "Yes" : "No"}</p>
				</div>
				{row.is_suspended || row.suspended_reason ? (
					<div className="medium:col-span-2">
						<h2 className="text-sm font-medium text-muted-foreground">Suspension</h2>
						<p className="mt-1 text-sm">
							{row.suspended_at ? (
								<span className="text-muted-foreground">Since {row.suspended_at} · </span>
							) : null}
							{row.suspended_reason ?? "—"}
						</p>
					</div>
				) : null}
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Deleted</h2>
					<p className="mt-1">{row.deleted_at ? row.deleted_at : "No"}</p>
				</div>
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Phone</h2>
					<p className="mt-1">{row.phone ?? "—"}</p>
				</div>
				<div className="medium:col-span-2">
					<h2 className="text-sm font-medium text-muted-foreground">School</h2>
					<p className="mt-1">{row.school_name ?? "—"}</p>
				</div>
				<div>
					<h2 className="text-sm font-medium text-muted-foreground">Last active</h2>
					<p className="mt-1">{row.last_active_at ?? "—"}</p>
				</div>
			</div>

			{row.role === "parent" && linkedStudents.length > 0 ? (
				<div className="rounded-lg border border-border p-4">
					<h2 className="text-sm font-semibold">Linked students</h2>
					<ul className="mt-3 space-y-2 text-sm">
						{linkedStudents.map((s) => (
							<li key={s.student_id} className="flex flex-wrap items-baseline gap-2">
								<Link
									className="font-medium text-primary underline-offset-4 hover:underline"
									href={`/admin/users/${s.student_id}`}
								>
									{s.full_name}
								</Link>
								<span className="text-muted-foreground">
									{s.grade ?? "—"} / {s.section ?? "—"} · {s.link_status ?? "—"}
									{s.linked_at ? ` · linked ${s.linked_at}` : ""}
								</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
			{row.role === "parent" && linkedStudents.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No linked student profiles for this parent.
				</p>
			) : null}
		</div>
	);
}
