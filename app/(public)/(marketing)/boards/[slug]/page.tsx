import { notFound } from "next/navigation";

import { SeoLandingTemplate } from "@/components/marketing/seo/seo-landing-template";
import { MarketingSubpageShell } from "@/components/marketing/marketing-subpage-shell";
import { getAllBoardSlugs, getBoardBySlug } from "@/lib/marketing/seo/registry";
import { marketingPageMetadata } from "@/lib/marketing/pages/metadata";
import type { MarketingFaqItem } from "@/lib/marketing/pages/types";

export const dynamic = "force-static";
export const revalidate = 86400;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
	return getAllBoardSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	const board = getBoardBySlug(slug);
	if (!board) return {};
	return marketingPageMetadata({
		title: `${board.name} practice for grades 6 to 10`,
		description: board.shortDescription,
		path: `/boards/${slug}`,
	});
}

function boardFaq(boardName: string): MarketingFaqItem[] {
	return [
		{
			id: "1",
			question: `Does 24Vertex follow ${boardName} textbooks?`,
			answer: `Yes. Practice and explanations use chapter structures aligned to ${boardName} and NCERT-style pacing for grades 6 to 10.`,
		},
		{
			id: "2",
			question: "Can my child use this without their school on 24Vertex?",
			answer: "Yes. Parent and student accounts work without a school link. Progress is kept if the school joins later.",
		},
		{
			id: "3",
			question: "Is the AI tutor included?",
			answer: "Explain and Solve-with-me modes are included in the 14-day free trial.",
		},
	];
}

export default async function BoardSeoPage({ params }: PageProps) {
	const { slug } = await params;
	const board = getBoardBySlug(slug);
	if (!board) notFound();

	return (
		<MarketingSubpageShell>
			<SeoLandingTemplate
				eyebrow={board.name}
				title={`${board.name} practice that follows the textbook`}
				lead={board.shortDescription}
				coverageTitle={`Built for ${board.name} classes 6 to 10`}
				coverageBody="Adaptive sets, parent radar charts, and tutor modes use the chapter names your child sees in school."
				exampleChapters={["Fractions", "Light", "The French Revolution"]}
				mapTitle={`How we map to ${board.name}`}
				mapBody={`Questions reflect ${board.name} terminology and typical unit-test patterns.`}
				faq={boardFaq(board.name)}
				relatedLinks={[
					{ href: "/parents", label: "For parents" },
					{ href: "/grades/8", label: "Class 8" },
					{ href: "/subjects/maths", label: "Maths" },
				]}
				utmContent={`board-${slug}`}
			/>
		</MarketingSubpageShell>
	);
}
