/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/render-hook";

type ChannelHandler = (payload: { new?: { body?: string } | null }) => void;

const channelStore: { current: { channelName: string; handler: ChannelHandler | null } | null } = {
	current: null,
};

const removeChannelMock = vi.fn(async () => undefined);

vi.mock("@/lib/supabase/client", () => ({
	createClient: () => ({
		channel(name: string) {
			channelStore.current = { channelName: name, handler: null };
			const chain = {
				on: (
					_event: string,
					_filter: unknown,
					cb: (payload: { new?: { body?: string } | null }) => void,
				) => {
					if (channelStore.current) channelStore.current.handler = cb;
					return chain;
				},
				subscribe: () => chain,
			};
			return chain;
		},
		removeChannel: removeChannelMock,
	}),
}));

import { useAdminTestMessageChannel } from "@/hooks/use-admin-test-message-channel";

const TEST_ID = "abc-123";

beforeEach(() => {
	channelStore.current = null;
	removeChannelMock.mockClear();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("useAdminTestMessageChannel", () => {
	it("subscribes to a channel scoped by testId", () => {
		const onMessage = vi.fn();
		const h = renderHook(() => useAdminTestMessageChannel({ testId: TEST_ID, onMessage }));
		expect(channelStore.current?.channelName).toBe(`admin-test-messages-${TEST_ID}`);
		h.cleanup();
	});

	it("calls onMessage with the row body for a string payload", () => {
		const onMessage = vi.fn();
		const h = renderHook(() => useAdminTestMessageChannel({ testId: TEST_ID, onMessage }));
		channelStore.current?.handler?.({ new: { body: "Reminder: 5 min remaining" } });
		expect(onMessage).toHaveBeenCalledWith("Reminder: 5 min remaining");
		h.cleanup();
	});

	it("ignores payloads with non-string body", () => {
		const onMessage = vi.fn();
		const h = renderHook(() => useAdminTestMessageChannel({ testId: TEST_ID, onMessage }));
		channelStore.current?.handler?.({ new: { body: undefined } });
		channelStore.current?.handler?.({ new: null });
		expect(onMessage).not.toHaveBeenCalled();
		h.cleanup();
	});

	it("removes the channel on unmount", async () => {
		const h = renderHook(() => useAdminTestMessageChannel({ testId: TEST_ID, onMessage: vi.fn() }));
		h.cleanup();
		expect(removeChannelMock).toHaveBeenCalledTimes(1);
	});

	it("ignores late callbacks delivered after unmount (cancelled flag)", () => {
		const onMessage = vi.fn();
		const h = renderHook(() => useAdminTestMessageChannel({ testId: TEST_ID, onMessage }));
		const handler = channelStore.current?.handler;
		h.cleanup();
		// A stale callback fires after unmount.
		handler?.({ new: { body: "late" } });
		expect(onMessage).not.toHaveBeenCalled();
	});
});
