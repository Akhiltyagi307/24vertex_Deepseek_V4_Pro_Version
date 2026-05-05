/** @vitest-environment jsdom */

/**
 * Render tests for the PasswordChangeForm extracted in Phase 1.4. Verifies:
 *   - Empty / mismatched / short passwords surface validation errors inline
 *   - Wrong current-password (Supabase signIn rejects) surfaces a helpful copy
 *   - Successful flow calls supabase.auth.updateUser then recordPasswordChangedAction
 *   - Disabled state during pending updates
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

type AuthErrorShape = { message: string } | null;
const { signInMock, updateUserMock, recordMock } = vi.hoisted(() => ({
	signInMock: {
		current: vi.fn(async (): Promise<{ error: AuthErrorShape }> => ({ error: null })),
	},
	updateUserMock: {
		current: vi.fn(async (): Promise<{ error: AuthErrorShape }> => ({ error: null })),
	},
	recordMock: { current: vi.fn(async () => ({ ok: true })) },
}));

vi.mock("@/lib/supabase/client", () => ({
	createClient: () => ({
		auth: {
			signInWithPassword: (creds: { email: string; password: string }) =>
				(signInMock.current as (c: unknown) => Promise<{ error: unknown }>)(creds),
			updateUser: (patch: { password: string }) =>
				(updateUserMock.current as (p: unknown) => Promise<{ error: unknown }>)(patch),
		},
	}),
}));
vi.mock("@/app/student/settings/account-security-actions", () => ({
	recordPasswordChangedAction: () => recordMock.current(),
}));

import { PasswordChangeForm } from "@/app/student/settings/password-change-form";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
	signInMock.current = vi.fn(async () => ({ error: null }));
	updateUserMock.current = vi.fn(async () => ({ error: null }));
	recordMock.current = vi.fn(async () => ({ ok: true }));
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	if (container.parentNode) container.parentNode.removeChild(container);
});

function render(loginEmail = "ada@test.com") {
	act(() => {
		root.render(<PasswordChangeForm loginEmail={loginEmail} />);
	});
}

function setValue(el: HTMLInputElement | null, value: string) {
	if (!el) throw new Error("input not found");
	const proto = window.HTMLInputElement.prototype;
	const desc = Object.getOwnPropertyDescriptor(proto, "value");
	desc?.set?.call(el, value);
	el.dispatchEvent(new Event("input", { bubbles: true }));
}

function getInput(id: string): HTMLInputElement | null {
	return container.querySelector<HTMLInputElement>(`#${id}`);
}

function getSubmit(): HTMLButtonElement {
	const buttons = Array.from(container.querySelectorAll("button"));
	// Match either the idle copy ("Update password") or the loading copy ("Updating…").
	const btn = buttons.find((b) => /update password|updating/i.test(b.textContent ?? ""));
	if (!btn) throw new Error("submit button not found");
	return btn as HTMLButtonElement;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("PasswordChangeForm", () => {
	it("surfaces an error when fields are empty", async () => {
		render();
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(container.textContent).toMatch(/could not update password/i);
	});

	it("rejects when newPassword is too short", async () => {
		render();
		setValue(getInput("studentCurrentPassword"), "OldGoodPass!");
		setValue(getInput("studentNewPassword"), "short");
		setValue(getInput("studentConfirmPassword"), "short");
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(container.textContent).toMatch(/at least 8/i);
	});

	it("rejects when newPassword and confirmPassword don't match", async () => {
		render();
		setValue(getInput("studentCurrentPassword"), "OldGoodPass!");
		setValue(getInput("studentNewPassword"), "NewGoodPass!");
		setValue(getInput("studentConfirmPassword"), "DifferentPass!");
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(container.textContent).toMatch(/could not update password/i);
	});

	it("surfaces a helpful message when the current password is wrong", async () => {
		signInMock.current = vi.fn(async () => ({ error: { message: "Invalid login credentials" } }));
		render();
		setValue(getInput("studentCurrentPassword"), "WrongPass!");
		setValue(getInput("studentNewPassword"), "NewGoodPass!");
		setValue(getInput("studentConfirmPassword"), "NewGoodPass!");
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(container.textContent).toMatch(/current password is incorrect/i);
	});

	it("calls updateUser then recordPasswordChangedAction on success and shows the success alert", async () => {
		render();
		setValue(getInput("studentCurrentPassword"), "OldGoodPass!");
		setValue(getInput("studentNewPassword"), "NewGoodPass!");
		setValue(getInput("studentConfirmPassword"), "NewGoodPass!");
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(signInMock.current).toHaveBeenCalledWith({
			email: "ada@test.com",
			password: "OldGoodPass!",
		});
		expect(updateUserMock.current).toHaveBeenCalledWith({ password: "NewGoodPass!" });
		expect(recordMock.current).toHaveBeenCalledTimes(1);
		expect(container.textContent).toMatch(/password updated/i);
	});

	it("shows the loading copy on the submit button while the request is in flight", async () => {
		let resolveSignIn: (v: { error: null }) => void = () => undefined;
		signInMock.current = vi.fn(
			() => new Promise<{ error: null }>((r) => (resolveSignIn = r)),
		);
		render();
		setValue(getInput("studentCurrentPassword"), "OldGoodPass!");
		setValue(getInput("studentNewPassword"), "NewGoodPass!");
		setValue(getInput("studentConfirmPassword"), "NewGoodPass!");
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(getSubmit().textContent).toMatch(/updating/i);
		await act(async () => {
			resolveSignIn({ error: null });
			await flush();
		});
		expect(getSubmit().textContent).toMatch(/update password/i);
	});

	it("rejects when loginEmail is empty (account email missing)", async () => {
		render("");
		setValue(getInput("studentCurrentPassword"), "OldGoodPass!");
		setValue(getInput("studentNewPassword"), "NewGoodPass!");
		setValue(getInput("studentConfirmPassword"), "NewGoodPass!");
		await act(async () => {
			getSubmit().click();
			await flush();
		});
		expect(container.textContent).toMatch(/account email is missing/i);
	});
});
