"use client";

import { useEffect, useRef } from "react";

type BatteryManagerLike = {
	level: number;
	charging: boolean;
};

type Options = {
	/** Skip the check entirely if the session is shorter than this. */
	minSessionSeconds: number;
	/** Battery level (0–1) at or below which the warning fires. */
	thresholdLevel?: number;
	/** Called once if the device is unplugged and below threshold. */
	onLowBattery: (level: number) => void;
};

/**
 * One-shot battery check for long practice sessions. Fires `onLowBattery`
 * exactly once per mount when the device is unplugged and at/below the level
 * threshold. No-op on UAs without `navigator.getBattery` (Safari, FF
 * desktop). Re-mounts re-arm.
 */
export function useLowBatteryWarning({
	minSessionSeconds,
	thresholdLevel = 0.25,
	onLowBattery,
}: Options): void {
	const firedRef = useRef(false);

	useEffect(() => {
		if (firedRef.current) return;
		if (minSessionSeconds < 60 * 60) return;
		const nav = navigator as Navigator & {
			getBattery?: () => Promise<BatteryManagerLike>;
		};
		if (typeof nav.getBattery !== "function") return;
		firedRef.current = true;
		void nav.getBattery().then((b) => {
			if (b.charging) return;
			if (b.level <= thresholdLevel) onLowBattery(b.level);
		});
	}, [minSessionSeconds, thresholdLevel, onLowBattery]);
}
