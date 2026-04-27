import { notFound } from "next/navigation";

import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";

import { StudyTipsForm } from "./study-tips-form";

export const metadata = {
	title: "Study tips (AI)",
};

/** Demo page for one-shot structured output (Vercel AI SDK) + Server Action pattern. */
export default function StudentAiStudyTipsPage() {
	if (process.env.NODE_ENV === "production") {
		notFound();
	}
	return (
		<PageStaggerRoot
			enableLift={false}
			className="flex flex-col gap-6 px-4 py-8 md:px-8"
			sections={[
				{
					key: "intro",
					content: (
						<div className="space-y-2">
							<h1 className="text-foreground text-2xl font-semibold tracking-tight">AI study tips</h1>
							<PageHeaderSubtext>
								Your input is validated on the server and returned as structured JSON via the Vercel AI SDK
								as a reference for wiring product features.
							</PageHeaderSubtext>
						</div>
					),
				},
				{ key: "form", content: <StudyTipsForm /> },
			]}
		/>
	);
}
