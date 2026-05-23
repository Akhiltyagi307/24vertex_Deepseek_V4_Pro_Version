import { MARKETING_SECTION_LEAD_MAX_CLASSNAME } from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

/**
 * Indian school boards covered by the 24Vertex content engine. Used as a
 * scrolling trust strip under the hero; replaces the previous static list of
 * named independent schools so the marquee never reads as a partner-school
 * endorsement.
 */
const INDIAN_SCHOOL_BOARDS = [
	"CBSE",
	"ICSE",
	"ISC",
	"IB MYP",
	"IGCSE",
	"Cambridge",
	"NCERT",
	"Maharashtra State Board",
	"Karnataka State Board",
	"Tamil Nadu State Board",
	"Gujarat State Board",
	"Rajasthan State Board",
	"Madhya Pradesh State Board",
	"Uttar Pradesh State Board",
	"West Bengal State Board",
	"Haryana State Board",
	"Punjab State Board",
	"Andhra Pradesh State Board",
	"Telangana State Board",
	"Kerala State Board",
] as const;

type SchoolsMarqueeProps = {
	className?: string;
	/** Optional line below the track (e.g. hero trust line). */
	caption?: string;
};

export function SchoolsMarquee({ className, caption }: SchoolsMarqueeProps) {
	const looped = [...INDIAN_SCHOOL_BOARDS, ...INDIAN_SCHOOL_BOARDS];

	return (
		<div
			className={cn(
				"relative w-full pt-12 medium:pt-14",
				caption == null && "border-t border-border/40",
				className,
			)}
			role="region"
			aria-label="Indian school boards covered by 24Vertex content"
		>
			<p
				className={cn(
					"text-muted-foreground/80 mx-auto mb-6 px-4 text-center text-xs font-medium uppercase tracking-[0.2em] medium:mb-8 medium:text-[0.75rem]",
					MARKETING_SECTION_LEAD_MAX_CLASSNAME,
				)}
			>
				Built for every Indian school board
			</p>
			<div
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent medium:w-20"
				aria-hidden
			/>
			<div
				className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent medium:w-20"
				aria-hidden
			/>
			<div className="overflow-hidden">
				{/* Margin between items (not only gap): some engines under-animate flex gap when transform runs on the same box. */}
				<div className="landing-schools-marquee-track flex w-max flex-nowrap flex-row items-center pr-10">
					{looped.map((name, index) => (
						<span
							key={`${name}-${index}`}
							className="me-8 shrink-0 whitespace-nowrap rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium tracking-tight text-muted-foreground/80 medium:me-10 medium:px-4 medium:py-1.5 medium:text-[0.8125rem]"
						>
							{name}
						</span>
					))}
				</div>
			</div>
			{caption != null && caption.length > 0 ? (
				<p
					className={cn(
						"text-muted-foreground mx-auto mt-8 px-4 text-center text-xs leading-relaxed medium:text-[0.8125rem]",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
					)}
				>
					{caption}
				</p>
			) : null}
		</div>
	);
}
