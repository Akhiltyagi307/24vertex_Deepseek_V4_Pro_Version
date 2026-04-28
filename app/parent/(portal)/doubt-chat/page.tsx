import { redirect } from "next/navigation";

import { ParentDoubtHistoryView } from "@/components/parent/parent-doubt-history-view";
import {
	loadDoubtConversationForStudent,
	loadDoubtMessagesForConversation,
	loadDoubtPageBundleForStudentProfile,
	loadDoubtTokenSummaryForConversation,
} from "@/lib/doubt/loaders";
import { getServerUser } from "@/lib/auth/get-server-user";
import type { UIMessage } from "ai";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ c?: string }> };

export default async function ParentDoubtChatPage({ searchParams }: PageProps) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) {
		redirect("/parent/select-student");
	}
	const ok = await assertParentActiveLink(user.id, activeId);
	if (!ok) {
		redirect("/parent/select-student");
	}

	const sp = await searchParams;
	const cParam = typeof sp.c === "string" ? sp.c : null;

	const bundle = await loadDoubtPageBundleForStudentProfile(activeId);
	if (!bundle.ok) {
		redirect("/parent/select-student");
	}

	let initialConversationId: string | null = null;
	let initialMessages: UIMessage[] = [];

	if (cParam) {
		const conv = await loadDoubtConversationForStudent(cParam, activeId);
		if (conv) {
			initialConversationId = conv.id;
			initialMessages = await loadDoubtMessagesForConversation(conv.id);
			void loadDoubtTokenSummaryForConversation(conv.id);
		}
	} else if (bundle.conversations[0]) {
		initialConversationId = bundle.conversations[0]!.id;
		initialMessages = await loadDoubtMessagesForConversation(bundle.conversations[0]!.id);
	}

	return (
		<div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
			<ParentDoubtHistoryView
				conversations={bundle.conversations}
				initialConversationId={initialConversationId}
				initialMessages={initialMessages}
				subjectsLoadError={bundle.subjectsLoadError}
			/>
		</div>
	);
}