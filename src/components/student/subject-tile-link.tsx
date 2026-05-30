"use client";

import Link from "next/link";
import type { Variants } from "motion/react";
import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import { SubjectCard, type SubjectCardTopicStatusCounts } from "@/components/student/dashboard-subject-card";

type SubjectCardStatus = ComponentProps<typeof SubjectCard>["status"];

/**
 * Shared subject tile used by the student Dashboard and Performance grids: a
 * stagger-animated link wrapping a compact `SubjectCard`. Callers pass the
 * already-resolved card values + the per-grid wrapper classes (the two grids
 * size their tiles differently) and the `item` stagger variant from their own
 * `useStaggerVariants()`.
 */
export function SubjectTileLink({
	href,
	ariaLabel,
	icon,
	itemVariants,
	subjectName,
	lastTestDate,
	topicsAttempted,
	topicsTotal,
	testsTaken,
	avgScore,
	status,
	topicStatusCounts,
	motionClassName,
	linkClassName,
	cardClassName,
}: {
	href: string;
	ariaLabel: string;
	icon: ReactNode;
	itemVariants: Variants;
	subjectName: string;
	lastTestDate: string;
	topicsAttempted: number;
	topicsTotal: number;
	testsTaken: number;
	avgScore: number;
	status: SubjectCardStatus;
	topicStatusCounts?: SubjectCardTopicStatusCounts;
	motionClassName: string;
	linkClassName: string;
	cardClassName?: string;
}) {
	return (
		<motion.div className={motionClassName} variants={itemVariants}>
			<Link href={href} scroll aria-label={ariaLabel} className={linkClassName}>
				<SubjectCard
					subject={subjectName}
					lastTestDate={lastTestDate}
					topicsAttempted={topicsAttempted}
					topicsTotal={topicsTotal}
					testsTaken={testsTaken}
					avgScore={avgScore}
					status={status}
					showCta={false}
					showTileHint
					topicStatusCounts={topicStatusCounts}
					metricsIconSlot={icon}
					density="compact"
					className={cardClassName}
				/>
			</Link>
		</motion.div>
	);
}
