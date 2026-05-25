"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

type HoverContextValue = {
	openCellKey: string | null;
	openForCell: (cellKey: string) => void;
	closeCell: (cellKey: string) => void;
	closeAll: () => void;
};

const AssignmentTopicBandHoverContext = createContext<HoverContextValue | null>(null);

export function AssignmentTopicBandHoverProvider({
	children,
	resetKey,
}: {
	children: ReactNode;
	resetKey?: string;
}) {
	const [openCellKey, setOpenCellKey] = useState<string | null>(null);

	const openForCell = useCallback((cellKey: string) => {
		setOpenCellKey(cellKey);
	}, []);

	const closeCell = useCallback((cellKey: string) => {
		setOpenCellKey((current) => (current === cellKey ? null : current));
	}, []);

	const closeAll = useCallback(() => {
		setOpenCellKey(null);
	}, []);

	useEffect(() => {
		setOpenCellKey(null);
	}, [resetKey]);

	const value = useMemo(
		() => ({ openCellKey, openForCell, closeCell, closeAll }),
		[openCellKey, openForCell, closeCell, closeAll],
	);

	return (
		<AssignmentTopicBandHoverContext.Provider value={value}>
			{children}
		</AssignmentTopicBandHoverContext.Provider>
	);
}

export function useAssignmentTopicBandHover() {
	const value = useContext(AssignmentTopicBandHoverContext);
	if (value == null) {
		throw new Error("useAssignmentTopicBandHover must be used within AssignmentTopicBandHoverProvider");
	}
	return value;
}

export const assignmentTopicBandHoverSurfaceAttr = "data-assignment-topic-band-hover-surface";
