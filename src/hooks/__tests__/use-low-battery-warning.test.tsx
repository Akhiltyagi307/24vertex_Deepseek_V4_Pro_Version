/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLowBatteryWarning } from "@/hooks/use-low-battery-warning";
import { renderHook } from "@/test/render-hook";

type BatteryShape = { level: number; charging: boolean };

let getBatterySpy: ReturnType<typeof vi.fn> | null = null;

function installBatteryApi(result: BatteryShape | "missing") {
	if (result === "missing") {
		Object.defineProperty(window.navigator, "getBattery", {
			value: undefined,
			configurable: true,
		});
		getBatterySpy = null;
		return;
	}
	const fn = vi.fn(async () => result);
	getBatterySpy = fn;
	Object.defineProperty(window.navigator, "getBattery", {
		value: fn,
		configurable: true,
	});
}

beforeEach(() => {
	getBatterySpy = null;
});

afterEach(() => {
	delete (window.navigator as Navigator & { getBattery?: unknown }).getBattery;
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("useLowBatteryWarning", () => {
	it("does nothing when minSessionSeconds is below 1 hour", async () => {
		installBatteryApi({ level: 0.1, charging: false });
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 30, onLowBattery: onLow }),
		);
		await flush();
		expect(getBatterySpy).not.toHaveBeenCalled();
		expect(onLow).not.toHaveBeenCalled();
		h.cleanup();
	});

	it("does nothing when getBattery is not available", async () => {
		installBatteryApi("missing");
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 60, onLowBattery: onLow }),
		);
		await flush();
		expect(onLow).not.toHaveBeenCalled();
		h.cleanup();
	});

	it("does nothing when the device is plugged in (charging=true)", async () => {
		installBatteryApi({ level: 0.1, charging: true });
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 60, onLowBattery: onLow }),
		);
		await flush();
		expect(getBatterySpy).toHaveBeenCalledTimes(1);
		expect(onLow).not.toHaveBeenCalled();
		h.cleanup();
	});

	it("does nothing when battery level is above the default threshold (25%)", async () => {
		installBatteryApi({ level: 0.5, charging: false });
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 60, onLowBattery: onLow }),
		);
		await flush();
		expect(onLow).not.toHaveBeenCalled();
		h.cleanup();
	});

	it("fires onLowBattery once when unplugged and at-or-below threshold", async () => {
		installBatteryApi({ level: 0.2, charging: false });
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 60, onLowBattery: onLow }),
		);
		await flush();
		expect(onLow).toHaveBeenCalledTimes(1);
		expect(onLow).toHaveBeenCalledWith(0.2);
		h.cleanup();
	});

	it("respects a custom thresholdLevel", async () => {
		installBatteryApi({ level: 0.5, charging: false });
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({
				minSessionSeconds: 60 * 60,
				thresholdLevel: 0.7,
				onLowBattery: onLow,
			}),
		);
		await flush();
		expect(onLow).toHaveBeenCalledWith(0.5);
		h.cleanup();
	});

	it("only fires once per mount even across multiple renders", async () => {
		installBatteryApi({ level: 0.2, charging: false });
		const onLow = vi.fn();
		const h = renderHook(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 60, onLowBattery: onLow }),
		);
		await flush();
		h.rerender(() =>
			useLowBatteryWarning({ minSessionSeconds: 60 * 60, onLowBattery: onLow }),
		);
		await flush();
		expect(onLow).toHaveBeenCalledTimes(1);
		h.cleanup();
	});
});
