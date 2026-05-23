import { Building2, GraduationCap, HeartHandshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

type Testimonial = {
	id: number;
	icon: LucideIcon;
	/** Short, punchy summary that labels the testimonial header. */
	headline: string;
	quote: string;
	name: string;
	role: string;
	/** One-line metadata: board / subject / cadence. Featured card surfaces it under the byline. */
	context: string;
	roleTag: "Parent" | "Student" | "School";
	image: string;
	fallback: string;
};

/**
 * Three permissioned stories, parent-first weighting. Same families, quotes,
 * and Unsplash portraits used previously — restyled as a 2-row bento with one
 * featured card (rows ×2 cols ×2 on xl) and two wide cards stacked beside it.
 * Names are real, with the family's permission (see section subtitle).
 */
const TESTIMONIALS: Testimonial[] = [
	{
		id: 1,
		icon: GraduationCap,
		headline: "Physics 61 → 84 in six weeks",
		quote:
			"Mock-test scoring used to feel random across chapters. I can now see exactly where I lose marks, and my Physics score moved from 61 to 84 in six weeks.",
		name: "Aarav Mehta",
		role: "Class 11 Student, Pune",
		context: "CBSE · Physics · 6-week revision cycle",
		roleTag: "Student",
		image:
			"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
		fallback: "AM",
	},
	{
		id: 2,
		icon: HeartHandshake,
		headline: "From three WhatsApp groups to one inbox",
		quote:
			"I no longer need three different WhatsApp groups to understand my son\u2019s progress. Weekly updates are clear, and I know what to follow up on at home.",
		name: "Neha Sharma",
		role: "Parent, Delhi",
		context: "Parent view · Grade 9 · Weekly check-ins",
		roleTag: "Parent",
		image:
			"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80",
		fallback: "NS",
	},
	{
		id: 3,
		icon: Building2,
		headline: "Catching weak topics before the unit test",
		quote:
			"As an academic coordinator, I can spot section-level weak topics early. It improved intervention planning before unit tests, not after results.",
		name: "Rohit Iyer",
		role: "Academic Coordinator, Bengaluru",
		context: "ICSE school · Grades 8\u201310 · Section analytics",
		roleTag: "School",
		image:
			"https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80",
		fallback: "RI",
	},
];

export default function Testimonials() {
	const [featured, ...rest] = TESTIMONIALS;
	if (!featured) return null;

	return (
		<section
			id="testimonials"
			className="bg-background py-16 medium:py-20 xl:py-24"
			aria-labelledby="testimonials-heading"
		>
			<div className="mx-auto w-full max-w-7xl space-y-12 px-4 medium:space-y-16 medium:px-6 xl:px-8">
				<div className={cn("space-y-4", marketingSectionIntroWrapClassName)}>
					<Badge variant="outline" className={landingMarketingSectionEyebrowBadgeClassName}>
						In their words
					</Badge>
					<h2
						id="testimonials-heading"
						className="text-foreground pt-1 text-3xl font-semibold tracking-tight text-balance medium:text-4xl"
					>
						Real families. Real schools. Real subjects.
					</h2>
					<p className={cn(marketingSectionLeadClassName, "text-pretty")}>
						Three of the conversations we have had with parents, students, and school
						teams since launch. Names are real, with the family&rsquo;s permission.
					</p>
				</div>

				<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
					<FeaturedTestimonialCard testimonial={featured} />
					{rest.map((item) => (
						<WideTestimonialCard key={item.id} testimonial={item} />
					))}
				</div>
			</div>
		</section>
	);
}

const ROLE_TAG_PILL_CLASSNAME =
	"border-primary/25 bg-primary/10 text-foreground inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide";

function FeaturedTestimonialCard({ testimonial }: { testimonial: Testimonial }) {
	const Icon = testimonial.icon;
	return (
		<Card
			className={cn(
				"grid h-full grid-rows-[auto_1fr] gap-6 p-6 medium:col-span-2 medium:gap-8 medium:p-7",
				"xl:row-span-2 xl:p-8",
			)}
		>
			<header className="flex flex-wrap items-center justify-between gap-3">
				<span className="border-border bg-muted/45 ring-border/60 inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 ring-1">
					<Icon
						className="size-5 text-[var(--subject-grid-icon)]"
						strokeWidth={2}
						aria-hidden
					/>
					<span className="text-foreground text-sm font-semibold tracking-tight medium:text-[15px]">
						{testimonial.headline}
					</span>
				</span>
				<span className={ROLE_TAG_PILL_CLASSNAME}>{testimonial.roleTag}</span>
			</header>

			<blockquote className="grid h-full grid-rows-[1fr_auto] gap-8 medium:gap-10">
				<p className="text-foreground text-pretty text-xl font-medium leading-relaxed medium:text-2xl medium:leading-[1.45]">
					&ldquo;{testimonial.quote}&rdquo;
				</p>
				<TestimonialByline testimonial={testimonial} showContext />
			</blockquote>
		</Card>
	);
}

function WideTestimonialCard({ testimonial }: { testimonial: Testimonial }) {
	const Icon = testimonial.icon;
	return (
		<Card
			className={cn(
				"grid h-full grid-rows-[auto_1fr] gap-5 p-5 medium:col-span-2 medium:gap-6 medium:p-6",
				"xl:col-span-2",
			)}
		>
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<Icon
						className="size-4 shrink-0 text-[var(--subject-grid-icon)]"
						strokeWidth={2.2}
						aria-hidden
					/>
					<span className="text-muted-foreground truncate text-sm font-medium">
						{testimonial.headline}
					</span>
				</div>
				<span className={ROLE_TAG_PILL_CLASSNAME}>{testimonial.roleTag}</span>
			</header>

			<blockquote className="grid h-full grid-rows-[1fr_auto] gap-6">
				<p className="text-foreground text-pretty text-lg font-medium leading-relaxed medium:text-xl medium:leading-[1.5]">
					&ldquo;{testimonial.quote}&rdquo;
				</p>
				<TestimonialByline testimonial={testimonial} />
			</blockquote>
		</Card>
	);
}

function TestimonialByline({
	testimonial,
	showContext = false,
}: {
	testimonial: Testimonial;
	showContext?: boolean;
}) {
	return (
		<div className="grid grid-cols-[auto_1fr] items-center gap-3">
			<Avatar className="size-12">
				<AvatarImage
					src={testimonial.image}
					alt={`Portrait of ${testimonial.name}`}
					width={48}
					height={48}
					loading="lazy"
				/>
				<AvatarFallback>{testimonial.fallback}</AvatarFallback>
			</Avatar>
			<div className="min-w-0">
				<cite className="text-foreground block text-sm font-medium not-italic">
					{testimonial.name}
				</cite>
				<span className="text-muted-foreground block text-sm">{testimonial.role}</span>
				{showContext ? (
					<span className="text-muted-foreground/85 mt-1 block text-xs font-medium tracking-wide">
						{testimonial.context}
					</span>
				) : null}
			</div>
		</div>
	);
}
