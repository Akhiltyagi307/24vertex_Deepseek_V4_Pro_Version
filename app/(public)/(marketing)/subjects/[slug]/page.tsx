import { notFound } from "next/navigation";

import { SeoLandingTemplate } from "@/components/marketing/seo/seo-landing-template";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { getAllSubjectSlugs, getSubjectBySlug } from "@/lib/marketing/seo/registry";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import type { MarketingFaqItem } from "@/lib/marketing/pages/types";

export const dynamic = "force-static";
export const revalidate = 86400;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
	return getAllSubjectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	const subject = getSubjectBySlug(slug);
	if (!subject) return {};
	return marketingPageMetadata({
		title: `${subject.name} practice for grades 6 to 10`,
		description: subject.shortDescription,
		path: `/subjects/${slug}`,
	});
}

function subjectFaq(name: string): MarketingFaqItem[] {
	return [
		{
			id: "1",
			question: `How does ${name} practice adapt?`,
			answer: "Sets focus on chapters flagged weak in your child's heatmap, with difficulty that responds to correct and incorrect attempts.",
		},
		{
			id: "2",
			question: "Can the AI tutor help with homework?",
			answer: "Explain mode clarifies concepts. Solve-with-me coaches through steps without dumping full answers immediately.",
		},
		{
			id: "3",
			question: "Which boards?",
			answer: "CBSE, ICSE, and major state boards for grades 6 to 10.",
		},
	];
}

export default async function SubjectSeoPage({ params }: PageProps) {
	const { slug } = await params;
	const subject = getSubjectBySlug(slug);
	if (!subject) notFound();

	return (
		<MarketingSubpageShell>
			<SeoLandingTemplate
				eyebrow={subject.name}
				title={`${subject.name} practice with chapter-level tracking`}
				lead={subject.shortDescription}
				coverageTitle={`${subject.name} across grades 6 to 10`}
				coverageBody="Practice and tutor support follow the chapters in your child's school books."
				exampleChapters={subject.exampleChapters}
				mapTitle="Subject-specific help"
				mapBody={`Weak ${subject.name.toLowerCase()} chapters show on the parent dashboard the same week they appear in school.`}
				faq={subjectFaq(subject.name)}
				relatedLinks={[
					{ href: "/adaptive-practice", label: "Adaptive practice" },
					{ href: "/ai-tutor", label: "AI tutor" },
					{ href: "/grades/9", label: "Class 9" },
				]}
				utmContent={`subject-${slug}`}
			/>
		</MarketingSubpageShell>
	);
}
