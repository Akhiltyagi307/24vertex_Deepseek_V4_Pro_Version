"use client";

import { useEffect, useRef } from "react";

/**
 * Toggles `style.animationPlayState` to "paused" when the target element is
 * offscreen, "running" when it intersects. Avoids burning a compositor frame
 * on never-visible CSS animations (marquees, decorative loops).
 */
export function usePauseAnimationOffscreen<T extends HTMLElement>(): React.RefObject<T | null> {
	const ref = useRef<T | null>(null);
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		if (typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					node.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
				}
			},
			{ rootMargin: "0px" },
		);
		io.observe(node);
		return () => io.disconnect();
	}, []);
	return ref;
}
