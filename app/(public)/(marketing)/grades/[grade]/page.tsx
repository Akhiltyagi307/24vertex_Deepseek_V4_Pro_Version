import { notFound } from "next/navigation";

import { SeoLandingTemplate } from "@/components/marketing/seo/seo-landing-template";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { getAllGradeSlugs, getGradeBySlug } from "@/lib/marketing/seo/registry";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import type { MarketingFaqItem } from "@/lib/marketing/pages/types";

export const dynamic = "force-static";
export const revalidate = 86400;

type PageProps = { params: Promise<{ grade: string }> };

export async function generateStaticParams() {
	return getAllGradeSlugs().map((grade) => ({ grade }));
}

export async function generateMetadata({ params }: PageProps) {
	const { grade } = await params;
	const entry = getGradeBySlug(grade);
	if (!entry) return {};
	return marketingPageMetadata({
		title: `Class ${grade} adaptive practice and parent dashboard`,
		description: entry.shortDescription,
		path: `/grades/${grade}`,
	});
}

function gradeFaq(classLabel: string): MarketingFaqItem[] {
	return [
		{
			id: "1",
			question: `Is 24Vertex only for ${classLabel}?`,
			answer: `This page is for ${classLabel}. The product supports grades 6 to 10 across CBSE, ICSE, and major state boards.`,
		},
		{
			id: "2",
			question: "How much time per day?",
			answer: "Most families aim for about 20 minutes of targeted practice on weak chapters, not marathon sessions.",
		},
		{
			id: "3",
			question: "What do parents see?",
			answer: "A chapter mastery heatmap updated as your child practises.",
		},
	];
}

export default async function GradeSeoPage({ params }: PageProps) {
	const { grade } = await params;
	const entry = getGradeBySlug(grade);
	if (!entry) notFound();

	const prev = Number(grade) > 6 ? String(Number(grade) - 1) : null;
	const next = Number(grade) < 10 ? String(Number(grade) + 1) : null;
	const related = [
		{ href: "/boards/cbse", label: "CBSE" },
		{ href: "/subjects/science", label: "Science" },
		...(prev ? [{ href: `/grades/${prev}`, label: `Class ${prev}` }] : []),
		...(next ? [{ href: `/grades/${next}`, label: `Class ${next}` }] : []),
	];

	return (
		<MarketingSubpageShell>
			<SeoLandingTemplate
				eyebrow={entry.classLabel}
				title={`${entry.classLabel} practice aligned to school chapters`}
				lead={entry.shortDescription}
				coverageTitle={`What ${entry.classLabel} families get`}
				coverageBody="Weak-chapter practice, private AI tutor, and parent-readable reports."
				exampleChapters={["Algebra basics", "Cell structure", "Democracy"]}
				mapTitle="Middle school to secondary"
				mapBody={`${entry.classLabel} is where chapter gaps compound. Catching them before unit tests matters more than cramming the night before.`}
				faq={gradeFaq(entry.classLabel)}
				relatedLinks={related}
				utmContent={`grade-${grade}`}
			/>
		</MarketingSubpageShell>
	);
}
