import { Building2, GraduationCap, HeartHandshake, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const testimonials = [
	{
		icon: GraduationCap,
		iconLabel: "Student outcomes",
		quote:
			"Mock-test scoring used to feel random across chapters. I can now see exactly where I lose marks, and my Physics score moved from 61 to 84 in six weeks.",
		name: "Aarav Mehta",
		role: "Class 11 Student, Pune",
		context: "CBSE · Physics · 6-week revision cycle",
		roleTag: "Student",
		accentClassName: "text-blue-300",
		chipClassName: "border-blue-400/35 bg-blue-500/10 text-blue-200",
		image:
			"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
		fallback: "AM",
		className: "xl:col-span-2",
		featured: true,
	},
	{
		icon: HeartHandshake,
		iconLabel: "Parent confidence",
		quote:
			"I no longer need three different WhatsApp groups to understand my son's progress. Weekly updates are clear, and I know what to follow up on at home.",
		name: "Neha Sharma",
		role: "Parent, Delhi",
		context: "Parent view · Grade 9 · Weekly check-ins",
		roleTag: "Parent",
		accentClassName: "text-amber-300",
		chipClassName: "border-amber-400/35 bg-amber-500/10 text-amber-200",
		image:
			"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80",
		fallback: "NS",
		className: "xl:col-span-2",
	},
	{
		icon: Building2,
		iconLabel: "School operations",
		quote:
			"As an academic coordinator, I can spot section-level weak topics early. It improved intervention planning before unit tests, not after results.",
		name: "Rohit Iyer",
		role: "Academic Coordinator, Bengaluru",
		context: "ICSE school · Grades 8-10 · Section analytics",
		roleTag: "School",
		accentClassName: "text-violet-300",
		chipClassName: "border-violet-400/35 bg-violet-500/10 text-violet-200",
		image:
			"https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80",
		fallback: "RI",
	},
	{
		icon: ShieldCheck,
		iconLabel: "Teacher workflow",
		quote:
			"Assignment tracking and doubt resolution are finally in one place. I spend less time chasing submissions and more time on actual teaching.",
		name: "Priya Nair",
		role: "Math Teacher, Kochi",
		context: "State board · Grade 10 Math · Daily assignments",
		roleTag: "Teacher",
		accentClassName: "text-emerald-300",
		chipClassName: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
		image:
			"https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
		fallback: "PN",
	},
	{
		icon: HeartHandshake,
		iconLabel: "Exam readiness",
		quote:
			"My daughter now follows a weekly revision plan without constant reminders. Her confidence before tests is noticeably better.",
		name: "Ananya Kulkarni",
		role: "Parent, Nashik",
		context: "SSC board · Grade 8 · Weekly test prep",
		roleTag: "Parent",
		accentClassName: "text-amber-300",
		chipClassName: "border-amber-400/35 bg-amber-500/10 text-amber-200",
		image:
			"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80",
		fallback: "AK",
		className: "xl:col-span-2",
	},
];

export default function Testimonials() {
	return (
		<section id="testimonials" className="border-b border-foreground/20 bg-background py-16 sm:py-20">
			<div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8 md:space-y-14">
				<div className="mx-auto max-w-2xl space-y-4 text-center">
					<Badge variant="outline">Voices</Badge>
					<h2 className="pt-1 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						Built for Indian classrooms, trusted by students, parents, and teachers
					</h2>
					<p className="mx-auto max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
						Representative stories from students, parents, and school teams across boards and
						grade levels.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
					{testimonials.map((item) => (
						<Card
							key={item.name}
							className={`${item.className ?? ""} min-h-[280px] ${item.featured ? "border-primary/35 bg-primary/5" : ""}`}
						>
							<CardHeader className="flex-row items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<item.icon
										aria-hidden="true"
										className={`size-4 ${item.featured ? "text-primary" : item.accentClassName}`}
										strokeWidth={2.2}
									/>
									<p className="text-sm font-medium text-muted-foreground">
										{item.iconLabel}
									</p>
								</div>
								<div className="flex flex-wrap items-center justify-end gap-1.5">
									<span
										className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${item.chipClassName}`}
									>
										{item.roleTag}
									</span>
									<span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
										Verified user
									</span>
								</div>
							</CardHeader>
							<CardContent className="grid h-full grid-rows-[1fr_auto] gap-6">
								<blockquote
									className={`leading-relaxed text-foreground ${item.featured ? "text-lg font-semibold" : "text-base font-medium"} line-clamp-5 md:line-clamp-none`}
								>
									{item.quote}
								</blockquote>
								<div className="space-y-3">
									<p className="text-xs font-medium tracking-wide text-muted-foreground">
										{item.context}
									</p>
									<div className="grid grid-cols-[auto_1fr] items-center gap-3">
										<Avatar className="size-12">
											<AvatarImage src={item.image} alt={item.name} loading="lazy" />
											<AvatarFallback>{item.fallback}</AvatarFallback>
										</Avatar>
										<div>
											<cite className="block text-sm font-medium not-italic">{item.name}</cite>
											<span className="block text-sm text-muted-foreground">{item.role}</span>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}
