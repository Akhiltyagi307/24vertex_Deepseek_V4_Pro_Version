import { notFound } from "next/navigation";

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
		<div className="space-y-6 px-4 py-8 md:px-8">
			<div className="space-y-2">
				<h1 className="text-foreground text-2xl font-semibold tracking-tight">AI study tips</h1>
				<p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
					Example flow: your input is sent to the server, validated, and answered as structured JSON
					via the Vercel AI SDK. Use this route as a reference when wiring real product features.
				</p>
			</div>
			<StudyTipsForm />
		</div>
	);
}
