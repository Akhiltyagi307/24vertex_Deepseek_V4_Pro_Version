import Link from "next/link";

import {
	formatScheduleInterval,
	getAdminJobSchedules,
	isAdminOperatorQueueName,
} from "@/lib/admin/jobs/schedules";

export function AdminJobSchedulesTable() {
	const schedules = getAdminJobSchedules();

	return (
		<div className="overflow-x-auto rounded-md border border-border">
			<table className="w-full min-w-[720px] text-left text-sm">
				<caption className="sr-only">Supabase pg_cron schedules calling internal admin routes</caption>
				<thead className="border-b border-border bg-muted/40">
					<tr>
						<th scope="col" className="px-3 py-2 font-medium">
							Id
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							Queue
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							Name
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							Interval
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							Description
						</th>
					</tr>
				</thead>
				<tbody>
					{schedules.length === 0 ?
						<tr>
							<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
								No schedules documented.
							</td>
						</tr>
					:	schedules.map((s) => (
							<tr key={s.id} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{s.id}</td>
								<td className="px-3 py-2 font-mono text-xs">
									{isAdminOperatorQueueName(s.queue) ?
										<Link className="text-primary underline" href="/admin/system/jobs/queues">
											{s.queue}
										</Link>
									:	s.queue}
								</td>
								<td className="px-3 py-2">{s.name}</td>
								<td className="px-3 py-2 text-muted-foreground">{formatScheduleInterval(s.interval_ms)}</td>
								<td className="px-3 py-2 text-muted-foreground">{s.description}</td>
							</tr>
						))
					}
				</tbody>
			</table>
		</div>
	);
}
