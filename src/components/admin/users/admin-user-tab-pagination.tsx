import Link from "next/link";

type ListTab = "tests" | "assignments" | "notifications";

export function AdminUserTabPagination({
	userId,
	tab,
	page,
	pageSize,
	total,
}: {
	userId: string;
	tab: ListTab;
	page: number;
	pageSize: number;
	total: number;
}) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	if (totalPages <= 1) return null;
	const href = (p: number) => `/admin/users/${userId}?tab=${tab}&page=${p}`;

	return (
		<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
			<span>
				Page {page} of {totalPages} ({total} total)
			</span>
			{page > 1 ?
				<Link href={href(page - 1)} className="font-medium text-primary underline-offset-4 hover:underline">
					Previous
				</Link>
			:	null}
			{page < totalPages ?
				<Link href={href(page + 1)} className="font-medium text-primary underline-offset-4 hover:underline">
					Next
				</Link>
			:	null}
		</div>
	);
}
