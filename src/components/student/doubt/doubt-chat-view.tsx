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
import type {
	DoubtChatTopicRow,
	DoubtChatConversationRow,
	DoubtChatEntitlement,
	DoubtPickerPerformance,
} from "@/lib/doubt/loaders";
import { parseDoubtChatListLabel } from "@/lib/doubt/doubt-conversation-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { ConversationSidebar } from "./doubt-chat-view/conversation-sidebar";
import { DeleteConversationDialog } from "./doubt-chat-view/delete-conversation-dialog";
import { MessageThread } from "./doubt-chat-view/message-thread";
import { ScopePicker } from "./doubt-chat-view/scope-picker";
import type { Enrolled, MessageAttachmentsByMessageId, UsageSummary } from "./doubt-chat-view/types";

export function DoubtChatView(props: {
	enrolledSubjects: Enrolled[];
	subjectsLoadError: string | null;
	conversations: DoubtChatConversationRow[];
	initialFromUrl: null | {
		conversation: {
			id: string;
			subjectId: string;
			topicId: string | null;
			title: string | null;
			subjectName: string | null;
			topicName: string | null;
			chapterName: string | null;
		};
		messages: UIMessage[];
		messageAttachmentsByMessageId: MessageAttachmentsByMessageId;
		usage: UsageSummary;
		initialTutorMode: DoubtTutorMode;
	};
	entitlement: DoubtChatEntitlement;
	doubtPickerPerformance: DoubtPickerPerformance;
	performanceLoadError: string | null;
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
	const [chatsOpen, setChatsOpen] = useState(false);

	useEffect(() => {
		setConversations(props.conversations);
	}, [props.conversations]);

	useEffect(() => {
		setChatsOpen(false);
	}, [c]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia("(min-width: 48rem)");
		const onChange = () => {
			if (mq.matches) setChatsOpen(false);
		};
		mq.addEventListener("change", onChange);
		onChange();
		return () => mq.removeEventListener("change", onChange);
	}, []);

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

	// Move a conversation to the top of the sidebar after it sees activity
	// (an assistant turn finishing). Mirrors the server's `updated_at DESC`
	// ordering without re-running the page's server data load on every turn.
	const onConversationActivity = useCallback((conversationId: string) => {
		setConversations((prev) => {
			const idx = prev.findIndex((r) => r.id === conversationId);
			if (idx < 0) return prev;
			const bumped = { ...prev[idx]!, updatedAt: new Date().toISOString() };
			return idx === 0
				? [bumped, ...prev.slice(1)]
				: [bumped, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
		});
	}, []);

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
			setChapterKey(chapterKeyFromRow(first!));
		}
	}, [topicRows, chapterKey, showPicker]);

	useEffect(() => {
		if (!showPicker || !topicId || topicsInChapter.length === 0) return;
		if (!topicsInChapter.some((t) => t.id === topicId)) {
			setTopicId(null);
		}
	}, [topicsInChapter, topicId, showPicker]);

	const onPickChapter = useCallback((key: string | null) => {
		setChapterKey(key);
		setTopicId(null);
	}, []);

	const onStartChat = useCallback(async () => {
		if (!subjectId || !chapterKey) {
			setCreateError("Pick a subject and chapter first.");
			return;
		}
		setStartPending(true);
		setCreateError(null);
		try {
			const res = topicId
				? await createDoubtConversation({ subjectId, topicId })
				: await createDoubtConversation({ subjectId, chapterKey });
			if (!res.ok) {
				setCreateError(res.message);
				return;
			}
			router.push(`/student/doubt-chat?c=${res.conversationId}`);
		} finally {
			setStartPending(false);
		}
	}, [subjectId, chapterKey, topicId, router]);

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

	const conversationSidebarProps = {
		conversations,
		activeConversationId: c,
		deletingId,
		showPicker,
		onConfirmDelete: setConfirmDeleteId,
	} as const;

	const openChats = useCallback(() => setChatsOpen(true), []);
	const threadKey =
		props.initialFromUrl == null
			? "empty-thread"
			: `${props.initialFromUrl.conversation.id}:${props.initialFromUrl.messages.length}:${props.initialFromUrl.messages.at(-1)?.id ?? "none"}`;

	return (
		<>
			<div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden medium:flex-row">
				<div className="hidden h-full min-h-0 medium:flex">
					<ConversationSidebar {...conversationSidebarProps} layout="rail" />
				</div>

				<Sheet open={chatsOpen} onOpenChange={setChatsOpen}>
					<SheetContent
						side="left"
						className="medium:hidden flex h-full max-h-[100dvh] min-h-0 w-[min(100%,20rem)] flex-col gap-0 overflow-hidden p-0"
					>
						<SheetHeader className="border-border shrink-0 border-b px-4 py-3">
							<SheetTitle>Past chats</SheetTitle>
							<SheetDescription className="sr-only">
								Open a previous conversation or start a new chat.
							</SheetDescription>
						</SheetHeader>
						<ConversationSidebar {...conversationSidebarProps} layout="drawer" />
					</SheetContent>
				</Sheet>

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

					{props.performanceLoadError ? (
						<Alert variant="destructive" className="m-4 shrink-0">
							<AlertTitle>Performance data</AlertTitle>
							<AlertDescription>{props.performanceLoadError}</AlertDescription>
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
								<div className="w-full max-w-full shrink-0 pb-4 medium:hidden">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="w-full"
										onClick={openChats}
									>
										Past chats
									</Button>
								</div>
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
									doubtPickerPerformance={props.doubtPickerPerformance}
									onPickSubject={onPickSubject}
									onPickChapter={onPickChapter}
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
									key={threadKey}
									conversationId={props.initialFromUrl.conversation.id}
									subjectId={props.initialFromUrl.conversation.subjectId}
									topicId={props.initialFromUrl.conversation.topicId}
									subjectName={props.initialFromUrl.conversation.subjectName}
									topicName={props.initialFromUrl.conversation.topicName}
									chapterName={props.initialFromUrl.conversation.chapterName}
									initialMessages={props.initialFromUrl.messages}
									initialMessageAttachments={props.initialFromUrl.messageAttachmentsByMessageId}
									initialUsage={props.initialFromUrl.usage}
									initialTutorMode={props.initialFromUrl.initialTutorMode}
									initialEntitlement={props.entitlement}
									onOpenChats={openChats}
									onConversationActivity={onConversationActivity}
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
