import { redirect } from "next/navigation";
import type { ComponentProps } from "react";

import { DoubtChatView } from "@/components/student/doubt/doubt-chat-view";
import {
	loadDoubtConversationForStudent,
	loadDoubtMessageAttachmentsByMessageId,
	loadDoubtMessagesForConversation,
	loadDoubtPageBundle,
	loadDoubtTokenSummaryForConversation,
	loadLastDoubtTutorModeForConversation,
} from "@/lib/doubt/loaders";
import { getServerUser } from "@/lib/auth/get-server-user";

export const metadata = {
	title: "Ask about a topic",
};

type PageProps = { searchParams: Promise<{ c?: string }> };

export default async function StudentDoubtChatPage({ searchParams }: PageProps) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const sp = await searchParams;
	const cParam = typeof sp.c === "string" ? sp.c : null;

	const bundle = await loadDoubtPageBundle(user.id);
	if (!bundle.ok) {
		redirect("/login");
	}

	let initialFromUrl: ComponentProps<typeof DoubtChatView>["initialFromUrl"] = null;

	if (cParam) {
		const conv = await loadDoubtConversationForStudent(cParam, user.id);
		if (conv) {
			const [messages, usage, lastTutorMode, messageAttachmentsByMessageId] = await Promise.all([
				loadDoubtMessagesForConversation(conv.id),
				loadDoubtTokenSummaryForConversation(conv.id),
				loadLastDoubtTutorModeForConversation(conv.id),
				loadDoubtMessageAttachmentsByMessageId(conv.id),
			]);
			initialFromUrl = {
				conversation: {
					id: conv.id,
					subjectId: conv.subjectId,
					topicId: conv.topicId,
					title: conv.title,
					subjectName: conv.subjectName,
					topicName: conv.topicName,
					chapterName: conv.chapterName,
				},
				messages,
				messageAttachmentsByMessageId,
				usage,
				initialTutorMode: lastTutorMode ?? "explain",
			};
		}
	}

	const enrolledSubjects = bundle.subjects.map((s) => ({
		id: s.id,
		name: s.name,
		subject_group: s.subject_group,
		sort_order: s.sort_order ?? 0,
	}));

	return (
		<div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
			<DoubtChatView
				enrolledSubjects={enrolledSubjects}
				subjectsLoadError={bundle.subjectsLoadError}
				conversations={bundle.conversations}
				initialFromUrl={initialFromUrl}
				entitlement={bundle.entitlement}
				doubtPickerPerformance={bundle.doubtPickerPerformance}
				performanceLoadError={bundle.performanceLoadError}
			/>
		</div>
	);
}
