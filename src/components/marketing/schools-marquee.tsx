import { cn } from "@/lib/utils";

/** Well-known independent and legacy Indian schools (public names only; decorative marquee). */
const INDIAN_SCHOOLS = [
	"The Doon School",
	"Mayo College, Ajmer",
	"Welham Boys' School",
	"Welham Girls' School",
	"Scindia School, Gwalior",
	"The Lawrence School, Sanawar",
	"Bishop Cotton School, Shimla",
	"Cathedral and John Connon School, Mumbai",
	"Campion School, Mumbai",
	"La Martiniere for Boys, Kolkata",
	"La Martiniere for Girls, Kolkata",
	"Modern School, Barakhamba Road",
	"The Shri Ram School, Moulsari",
	"Sanskriti School, Chanakyapuri",
	"Bombay Scottish School, Mahim",
	"St. Columba's School, Delhi",
	"The Valley School, Bangalore",
	"National Public School, Indiranagar",
	"Delhi Public School, R.K. Puram",
	"Step by Step School, Noida",
	"Pathways World School, Aravali",
] as const;

type SchoolsMarqueeProps = {
	className?: string;
	/** Optional line below the track (e.g. hero trust line). */
	caption?: string;
};

export function SchoolsMarquee({ className, caption }: SchoolsMarqueeProps) {
	const looped = [...INDIAN_SCHOOLS, ...INDIAN_SCHOOLS];

	return (
		<div
			className={cn(
				"relative w-full pt-12 sm:pt-14",
				caption == null && "border-t border-border/40",
				className,
			)}
			role="region"
			aria-label="Illustrative names of well-known Indian schools"
		>
			<span className="sr-only">
				Scrolling illustrative names only. These schools are not shown as partners or endorsements of EduAI.
			</span>
			<div
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-20"
				aria-hidden
			/>
			<div
				className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-20"
				aria-hidden
			/>
			<div className="overflow-hidden">
				{/* Margin between items (not only gap): some engines under-animate flex gap when transform runs on the same box. */}
				<div className="landing-schools-marquee-track flex w-max flex-nowrap flex-row items-center pr-10">
					{looped.map((name, index) => (
						<span
							key={`${name}-${index}`}
							className="me-10 shrink-0 whitespace-nowrap text-sm font-medium tracking-tight text-muted-foreground/50 sm:me-14 sm:text-[0.9375rem]"
						>
							{name}
						</span>
					))}
				</div>
			</div>
			{caption != null && caption.length > 0 ? (
				<p className="text-muted-foreground/75 mx-auto mt-8 max-w-2xl px-4 text-center text-xs leading-relaxed sm:text-[0.8125rem]">
					{caption}
				</p>
			) : null}
		</div>
	);
}
