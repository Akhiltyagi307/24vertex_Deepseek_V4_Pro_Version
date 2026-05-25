"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import {
	notifyParentChildLinkConfirmed,
	notifyParentLinkedToStudent,
} from "@/lib/notifications/account-security";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

const linkIdSchema = z.object({ linkId: z.string().uuid() }).strict();

export type ParentLinkActionState = { error?: string; success?: boolean };

export async function confirmParentLinkAction(
	_prev: ParentLinkActionState,
	formData: FormData,
): Promise<ParentLinkActionState> {
	const parsed = linkIdSchema.safeParse({ linkId: formData.get("linkId") });
	if (!parsed.success) {
		return { error: "Invalid link request." };
	}

	const user = await getServerUser();
	if (!user) {
		return { error: "Sign in again to continue." };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("confirm_parent_link", {
		p_link_id: parsed.data.linkId,
	});

	if (error) {
		logSupabaseError("confirmParentLinkAction.confirm_parent_link", error, {
			linkId: parsed.data.linkId,
			userId: user.id,
		});
		return { error: "We could not approve this link. It may have expired or already been handled." };
	}

	const { data: linkRow } = await supabase
		.from("parent_student_links")
		.select("parent_id")
		.eq("id", parsed.data.linkId)
		.maybeSingle();

	const parentId = linkRow?.parent_id as string | undefined;
	if (parentId) {
		try {
			await notifyParentLinkedToStudent({ studentId: user.id, parentId });
			await notifyParentChildLinkConfirmed({ studentId: user.id, parentId });
		} catch {
			// Notifications are best-effort after the link is active.
		}
	}

	revalidatePath("/student/settings");
	return { success: true };
}

export async function rejectParentLinkAction(
	_prev: ParentLinkActionState,
	formData: FormData,
): Promise<ParentLinkActionState> {
	const parsed = linkIdSchema.safeParse({ linkId: formData.get("linkId") });
	if (!parsed.success) {
		return { error: "Invalid link request." };
	}

	const user = await getServerUser();
	if (!user) {
		return { error: "Sign in again to continue." };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("reject_parent_link", {
		p_link_id: parsed.data.linkId,
	});

	if (error) {
		logSupabaseError("rejectParentLinkAction.reject_parent_link", error, {
			linkId: parsed.data.linkId,
			userId: user.id,
		});
		return { error: "We could not decline this link. It may have already been handled." };
	}

	revalidatePath("/student/settings");
	return { success: true };
}
