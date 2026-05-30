"use client";

import {
	type ComponentPropsWithoutRef,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	AnimatePresence,
	animate,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
} from "motion/react";
import { GraduationCap, Presentation, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import {
	MARKETING_SECTION_LEAD_MAX_CLASSNAME,
	marketingSectionIntroWrapClassName,
	marketingSectionLeadClassName,
} from "@/lib/marketing/marketing-section-rhythm";
import { cn } from "@/lib/utils";

const PORTAL_PREVIEW_SIZES = "(max-width: 1280px) 100vw, 1280px";

function PortalPreviewImage({
	base,
	width,
	height,
	alt,
	priority = false,
}: {
	base: string;
	width: number;
	height: number;
	alt: string;
	priority?: boolean;
}) {
	const avifSrcSet = `${base}-1280.avif 1280w, ${base}-2560.avif 2560w`;
	const webpSrcSet = `${base}-1280.webp 1280w, ${base}-2560.webp 2560w`;

	return (
		<picture>
			<source type="image/avif" srcSet={avifSrcSet} sizes={PORTAL_PREVIEW_SIZES} />
			<source type="image/webp" srcSet={webpSrcSet} sizes={PORTAL_PREVIEW_SIZES} />
			<img
				src={`${base}.png`}
				width={width}
				height={height}
				alt={alt}
				decoding="async"
				fetchPriority={priority ? "high" : "auto"}
				draggable={false}
				className="border-border block w-full h-auto rounded-lg border"
			/>
		</picture>
	);
}

const tabs = [
	{
		icon: UserRound,
		title: "Parent view",
		description:
			"See exactly what your child practised, where they are improving, and what to revise this weekend. Updated within minutes of every test. No chasing, no screenshots, no guesswork.",
		isNew: false,
		previewBase: "/marketing/parent-portal-dashboard",
		previewWidth: 3420,
		previewHeight: 1968,
	},
	{
		icon: GraduationCap,
		title: "Student view",
		description:
			"A daily focus list of the chapters that need attention, plus the AI tutor for the questions they would never bring to class. Built for short, sharp study sessions.",
		isNew: false,
		previewBase: "/marketing/student-portal-dashboard",
		previewWidth: 3414,
		previewHeight: 1970,
	},
	{
		icon: Presentation,
		title: "Teacher view",
		description:
			"For the teacher in the loop. Class-level signals, not just one student's snapshot, so the school sees what is going well and what is slipping, in time to do something about it.",
		isNew: false,
		previewBase: "/marketing/teacher-portal-dashboard",
		previewWidth: 3414,
		previewHeight: 1970,
	},
] as const;

const FeatureTab = (
	props: (typeof tabs)[number] &
		ComponentPropsWithoutRef<"button"> & { selected: boolean },
) => {
	const tabRef = useRef<HTMLButtonElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const xPercent = useMotionValue(100);
	const yPercent = useMotionValue(0);
	const maskImage = useMotionTemplate`radial-gradient(100px 50px at ${xPercent}% ${yPercent}%, black, transparent)`;

	useEffect(() => {
		if (!tabRef.current || !props.selected || prefersReducedMotion) return;

		xPercent.set(0);
		yPercent.set(0);
		const { height, width } = tabRef.current.getBoundingClientRect();
		const circumference = height * 2 + width * 2;
		const times = [
			0,
			width / circumference,
			(width + height) / circumference,
			(width * 2 + height) / circumference,
			1,
		];

		const xControls = animate(xPercent, [0, 100, 100, 0, 0], {
			duration: 4,
			times,
			ease: "linear",
			repeat: Infinity,
			repeatType: "loop",
		});
		const yControls = animate(yPercent, [0, 0, 100, 100, 0], {
			times,
			duration: 4,
			ease: "linear",
			repeat: Infinity,
			repeatType: "loop",
		});

		return () => {
			xControls.stop();
			yControls.stop();
		};
	}, [props.selected, prefersReducedMotion, xPercent, yPercent]);

	return (
		<button
			type="button"
			ref={tabRef}
			className={cn(
				"border-border bg-card/60 relative flex cursor-pointer items-center gap-1 rounded-lg border py-1 pr-4 text-left transition-colors",
				props.selected && "bg-card",
			)}
			onClick={props.onClick}
			aria-pressed={props.selected}
		>
			{props.selected && !prefersReducedMotion && (
				<motion.div
					style={{ maskImage }}
					className="absolute inset-0 -m-px rounded-lg border border-[var(--subject-grid-icon)]"
					aria-hidden
				/>
			)}

			<div className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-lg px-2 py-1">
				<props.icon className="size-4 text-[var(--subject-grid-icon)]" strokeWidth={2} />
			</div>
			<div className="text-foreground text-sm font-medium">{props.title}</div>
			{props.isNew && (
				<div className="rounded-lg bg-[var(--subject-grid-icon)] p-2 text-xs font-semibold text-[var(--link)]">
					new
				</div>
			)}
		</button>
	);
};

export default function RuixenFeaturedImageSection() {
	const [selectedTab, setSelectedTab] = useState(0);
	const prefersReducedMotion = useReducedMotion();
	const activeTab = tabs[selectedTab];

	return (
		<section id="portals" className="bg-background py-16 medium:py-20 xl:py-24">
			<div className="mx-auto w-full max-w-7xl px-4 medium:px-6 xl:px-8">
				<div className={marketingSectionIntroWrapClassName}>
					<Badge
						variant="outline"
						className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}
					>
						One product, three views
					</Badge>
					<h2 className="text-3xl font-semibold tracking-tight text-foreground medium:text-4xl text-balance">
						One truth, three views. No more screenshots in WhatsApp groups.
					</h2>
					<p className={cn(marketingSectionLeadClassName, "text-pretty")}>
						You, your child, and their teacher finally look at the same picture, tuned to
						what each of you needs to see, and nothing more.
					</p>
				</div>

				<div className="relative mt-10 flex justify-center">
					<div className="flex flex-row flex-wrap items-center justify-center gap-3 xl:gap-5">
						{tabs.map((tab, tabIndex) => (
							<FeatureTab
								{...tab}
								selected={selectedTab === tabIndex}
								onClick={() => setSelectedTab(tabIndex)}
								key={tab.title}
							/>
						))}
					</div>
				</div>

				<div className="border-border mt-10 rounded-2xl border-2 p-2.5">
					<div className="relative w-full overflow-hidden rounded-lg">
						<AnimatePresence mode="wait">
							<motion.div
								key={activeTab.title}
								className="relative w-full"
								initial={prefersReducedMotion ? false : { opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={prefersReducedMotion ? undefined : { opacity: 0 }}
								transition={{ duration: 0.25 }}
							>
								<PortalPreviewImage
									base={activeTab.previewBase}
									width={activeTab.previewWidth}
									height={activeTab.previewHeight}
									alt={`${activeTab.title} preview`}
									priority={selectedTab === 0}
								/>
							</motion.div>
						</AnimatePresence>
					</div>
					<p className="text-muted-foreground sr-only">{activeTab.description}</p>
				</div>

				<p
					className={cn(
						"text-muted-foreground mx-auto mt-6 text-center text-sm medium:text-base",
						MARKETING_SECTION_LEAD_MAX_CLASSNAME,
					)}
				>
					{activeTab.description}
				</p>
			</div>
		</section>
	);
}
