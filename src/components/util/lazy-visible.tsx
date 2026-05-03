"use client";

import * as React from "react";

type LazyVisibleProps = {
	children: React.ReactNode;
	/** IntersectionObserver rootMargin — preload before strictly entering viewport. */
	rootMargin?: string;
	/** Optional placeholder rendered before children mount. Should match final layout to avoid CLS. */
	fallback?: React.ReactNode;
	/** Optional class on the wrapper. Use to give the placeholder a height so layout is stable. */
	className?: string;
};

/**
 * Mounts `children` only after the wrapper enters the viewport (with rootMargin lookahead).
 * Use to defer heavy components (WebGL, charts, animations) until they're about to be visible.
 */
export function LazyVisible({ children, rootMargin = "200px", fallback = null, className }: LazyVisibleProps) {
	const ref = React.useRef<HTMLDivElement>(null);
	const [show, setShow] = React.useState(false);

	React.useEffect(() => {
		const node = ref.current;
		if (!node) return;
		if (typeof IntersectionObserver === "undefined") {
			setShow(true);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setShow(true);
						io.disconnect();
						return;
					}
				}
			},
			{ rootMargin },
		);
		io.observe(node);
		return () => io.disconnect();
	}, [rootMargin]);

	return (
		<div ref={ref} className={className}>
			{show ? children : fallback}
		</div>
	);
}
