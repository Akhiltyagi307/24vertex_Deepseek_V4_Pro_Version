"use client";

import { useEffect } from "react";

import { reportWebVitals } from "@/lib/observability/web-vitals";

export function WebVitalsIsland(): null {
	useEffect(() => {
		reportWebVitals();
	}, []);
	return null;
}
