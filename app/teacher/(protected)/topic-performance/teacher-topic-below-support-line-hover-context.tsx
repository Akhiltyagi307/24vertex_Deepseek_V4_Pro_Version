"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
	type RefObject,
} from "react";

type HoverContextValue = {
	openTopicId: string | null;
	openForTopic: (topicId: string) => void;
	closeTopic: (topicId: string) => void;
	closeAll: () => void;
};

const TeacherTopicBelowSupportLineHoverContext = createContext<HoverContextValue | null>(null);

export function TeacherTopicBelowSupportLineHoverProvider({
	children,
	scrollRootRef,
	resetKey,
}: {
	children: ReactNode;
	scrollRootRef?: RefObject<HTMLElement | null>;
	resetKey?: string;
}) {
	const [openTopicId, setOpenTopicId] = useState<string | null>(null);

	const openForTopic = useCallback((topicId: string) => {
		setOpenTopicId(topicId);
	}, []);

	const closeTopic = useCallback((topicId: string) => {
		setOpenTopicId((current) => (current === topicId ? null : current));
	}, []);

	const closeAll = useCallback(() => {
		setOpenTopicId(null);
	}, []);

	// Reset the open topic when `resetKey` changes — during render, not in an
	// effect, to avoid the cascading re-render the set-state-in-effect rule flags.
	const [prevResetKey, setPrevResetKey] = useState(resetKey);
	if (prevResetKey !== resetKey) {
		setPrevResetKey(resetKey);
		setOpenTopicId(null);
	}

	useEffect(() => {
		const root = scrollRootRef?.current;
		if (!root) return;
		const onScroll = () => closeAll();
		root.addEventListener("scroll", onScroll, { passive: true });
		return () => root.removeEventListener("scroll", onScroll);
	}, [scrollRootRef, closeAll]);

	const value = useMemo(
		() => ({ openTopicId, openForTopic, closeTopic, closeAll }),
		[openTopicId, openForTopic, closeTopic, closeAll],
	);

	return (
		<TeacherTopicBelowSupportLineHoverContext.Provider value={value}>
			{children}
		</TeacherTopicBelowSupportLineHoverContext.Provider>
	);
}

export function useTeacherTopicBelowSupportLineHover() {
	const value = useContext(TeacherTopicBelowSupportLineHoverContext);
	if (value == null) {
		throw new Error(
			"useTeacherTopicBelowSupportLineHover must be used within TeacherTopicBelowSupportLineHoverProvider",
		);
	}
	return value;
}

export const belowSupportHoverSurfaceAttr = "data-below-support-hover-surface";
