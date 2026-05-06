"use client";

import type { UIMessage } from "ai";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	createDoubtConversation,
	deleteDoubtConversationAction,
	getDoubtTopicsForSubjectAction,
} from "@/lib/doubt/doubt-actions";
import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import { chapterKeyFromRow, groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import type { DoubtChatTopicRow, DoubtChatConversationRow, DoubtChatEntitlement } from "@/lib/doubt/loaders";
import { parseDoubtChatListLabel } from "@/lib/doubt/doubt-conversation-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { ConversationSidebar } from "./doubt-chat-view/conversation-sidebar";
import { DeleteConversationDialog } from "./doubt-chat-view/delete-conversation-dialog";
import { MessageThread } from "./doubt-chat-view/message-thread";
import { ScopePicker } from "./doubt-chat-view/scope-picker";
import type { Enrolled, UsageSummary } from "./doubt-chat-view/types";

export function DoubtChatView(props: {
	enrolledSubjects: Enrolled[];
	subjectsLoadError: string | null;
	conversations: DoubtChatConversationRow[];
	initialFromUrl: null | {
		conversation: {
			id: string;
			subjectId: string;
			topicId: string;
			title: string | null;
			subjectName: string | null;
			topicName: string | null;
			chapterName: string | null;
		};
		messages: UIMessage[];
		usage: UsageSummary;
		initialTutorMode: DoubtTutorMode;
	};
	entitlement: DoubtChatEntitlement;
}) {
	const router = useRouter();
	const sp = useSearchParams();
	const c = sp.get("c");

	const [createError, setCreateError] = useState<string | null>(null);
	const [loadTopicsPending, setLoadTopicsPending] = useState(false);
	const [topicRows, setTopicRows] = useState<DoubtChatTopicRow[]>([]);
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const [chapterKey, setChapterKey] = useState<string | null>(null);
	const [topicId, setTopicId] = useState<string | null>(null);
	const [startPending, setStartPending] = useState(false);

	const [conversations, setConversations] = useState(props.conversations);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	useEffect(() => {
		setConversations(props.conversations);
	}, [props.conversations]);

	const confirmDeleteRow = useMemo(() => {
		if (!confirmDeleteId) return null;
		return conversations.find((r) => r.id === confirmDeleteId) ?? null;
	}, [confirmDeleteId, conversations]);

	const performDeleteConversation = useCallback(
		async (id: string) => {
			setDeletingId(id);
			try {
				const res = await deleteDoubtConversationAction({ conversationId: id });
				if (!res.ok) {
					toast.error(res.message);
					return;
				}
				setConversations((prev) => prev.filter((r) => r.id !== id));
				setConfirmDeleteId(null);
				if (c === id) {
					router.push("/student/doubt-chat");
				}
				router.refresh();
				toast.success("Chat deleted");
			} finally {
				setDeletingId(null);
			}
		},
		[c, router],
	);

	const showThread =
		Boolean(c) && props.initialFromUrl != null && props.initialFromUrl.conversation.id === c;
	const showPicker = !c;
	const notFound = Boolean(c) && props.initialFromUrl == null;
	const reduceMotion = useReducedMotion();
	const panelDuration = reduceMotion ? 0 : 0.2;

	const chapters = useMemo(() => groupTopicRowsByChapter(topicRows), [topicRows]);

	const topicsInChapter = useMemo(() => {
		if (!chapterKey) return [] as DoubtChatTopicRow[];
		const g = chapters.find((x) => x.key === chapterKey);
		return g?.topics ?? [];
	}, [chapters, chapterKey]);

	const loadTopics = useCallback(async (sid: string) => {
		setLoadTopicsPending(true);
		setCreateError(null);
		try {
			const res = await getDoubtTopicsForSubjectAction({ subjectId: sid });
			if (res.ok) {
				setTopicRows(res.topics);
			} else {
				setCreateError(res.message);
				setTopicRows([]);
			}
		} finally {
			setLoadTopicsPending(false);
		}
	}, []);

	useEffect(() => {
		if (!subjectId) {
			setTopicRows([]);
			setChapterKey(null);
			setTopicId(null);
			return;
		}
		if (showPicker) {
			void loadTopics(subjectId);
		}
	}, [subjectId, loadTopics, showPicker]);

	useEffect(() => {
		if (!showPicker) return;
		if (topicRows.length === 0) {
			setChapterKey(null);
			setTopicId(null);
			return;
		}
		if (!chapterKey) {
			const first = topicRows[0];
			setChapterKey(chapterKeyFromRow(first));
		}
	}, [topicRows, chapterKey, showPicker]);

	useEffect(() => {
		if (!showPicker) return;
		if (topicsInChapter.length === 0) {
			setTopicId(null);
			return;
		}
		const stillIn = topicId && topicsInChapter.some((t) => t.id === topicId);
		if (!stillIn) {
			setTopicId(topicsInChapter[0].id);
		}
	}, [topicsInChapter, topicId, showPicker]);

	const onStartChat = useCallback(async () => {
		if (!subjectId || !topicId) {
			setCreateError("Select a subject, chapter, and topic first.");
			return;
		}
		setStartPending(true);
		setCreateError(null);
		try {
			const res = await createDoubtConversation({ subjectId, topicId });
			if (!res.ok) {
				setCreateError(res.message);
				return;
			}
			router.push(`/student/doubt-chat?c=${res.conversationId}`);
		} finally {
			setStartPending(false);
		}
	}, [subjectId, topicId, router]);

	const sortedSubjects = useMemo(() => {
		return [...props.enrolledSubjects].sort((a, b) => {
			const ga = a.subject_group ?? "￿";
			const gb = b.subject_group ?? "￿";
			if (ga !== gb) return ga.localeCompare(gb);
			if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
			return a.name.localeCompare(b.name);
		});
	}, [props.enrolledSubjects]);

	const deleteInProgress = confirmDeleteId != null && deletingId === confirmDeleteId;
	const deleteHeadline = confirmDeleteRow
		? parseDoubtChatListLabel(confirmDeleteRow).headline
		: "this chat";

	const onPickSubject = useCallback((id: string | null) => {
		setSubjectId(id);
		setChapterKey(null);
		setTopicId(null);
	}, []);

	return (
		<>
			<div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden medium:flex-row">
				<ConversationSidebar
					conversations={conversations}
					activeConversationId={c}
					deletingId={deletingId}
					showPicker={showPicker}
					onConfirmDelete={setConfirmDeleteId}
				/>

				<div
					className={cn(
						"flex min-h-0 min-w-0 flex-1 flex-col",
						showPicker ? "overflow-y-auto overscroll-contain" : "overflow-hidden",
					)}
				>
					{props.subjectsLoadError ? (
						<Alert variant="destructive" className="m-4 shrink-0">
							<AlertTitle>Subjects</AlertTitle>
							<AlertDescription>{props.subjectsLoadError}</AlertDescription>
						</Alert>
					) : null}

					{notFound ? (
						<Alert variant="destructive" className="m-4 shrink-0">
							<AlertTitle>Chat not found</AlertTitle>
							<AlertDescription>
								This link may be invalid, or the chat is no longer available.{" "}
								<Link href="/student/doubt-chat" className="text-primary font-medium underline">
									Start a new chat
								</Link>
								.
							</AlertDescription>
						</Alert>
					) : null}

					<AnimatePresence mode="wait" initial={false}>
						{showPicker ? (
							<motion.div
								key="picker"
								className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10 medium:py-14"
								initial={reduceMotion ? false : { opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
								transition={{ duration: panelDuration, ease: "easeOut" }}
							>
								<ScopePicker
									sortedSubjects={sortedSubjects}
									chapters={chapters}
									topicsInChapter={topicsInChapter}
									subjectId={subjectId}
									chapterKey={chapterKey}
									topicId={topicId}
									loadTopicsPending={loadTopicsPending}
									startPending={startPending}
									createError={createError}
									onPickSubject={onPickSubject}
									onPickChapter={setChapterKey}
									onPickTopic={setTopicId}
									onStartChat={() => void onStartChat()}
								/>
							</motion.div>
						) : showThread && props.initialFromUrl ? (
							<motion.div
								key={props.initialFromUrl.conversation.id}
								className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
								initial={reduceMotion ? false : { opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
								transition={{ duration: panelDuration, ease: "easeOut" }}
							>
								<MessageThread
									key={props.initialFromUrl.conversation.id}
									conversationId={props.initialFromUrl.conversation.id}
									subjectId={props.initialFromUrl.conversation.subjectId}
									topicId={props.initialFromUrl.conversation.topicId}
									subjectName={props.initialFromUrl.conversation.subjectName}
									topicName={props.initialFromUrl.conversation.topicName}
									chapterName={props.initialFromUrl.conversation.chapterName}
									initialMessages={props.initialFromUrl.messages}
									initialUsage={props.initialFromUrl.usage}
									initialTutorMode={props.initialFromUrl.initialTutorMode}
									initialEntitlement={props.entitlement}
								/>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</div>

			<DeleteConversationDialog
				open={confirmDeleteId != null}
				onOpenChange={(open) => {
					if (!open) {
						if (deleteInProgress) return;
						setConfirmDeleteId(null);
					}
				}}
				deleteHeadline={deleteHeadline}
				deleteInProgress={deleteInProgress}
				canDelete={Boolean(confirmDeleteId)}
				onCancel={() => setConfirmDeleteId(null)}
				onConfirm={() => {
					if (confirmDeleteId) void performDeleteConversation(confirmDeleteId);
				}}
			/>
		</>
	);
}
