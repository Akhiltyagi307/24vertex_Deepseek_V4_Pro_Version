"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PARENT_ACTIVE_STUDENT_COOKIE } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { createClient } from "@/lib/supabase/server";

const studentIdSchema = z.string().uuid();

export async function selectParentStudentAction(formData: FormData): Promise<void> {
	const raw = formData.get("studentId");
	const parsed = studentIdSchema.safeParse(typeof raw === "string" ? raw : "");
	if (!parsed.success) {
		redirect("/parent/select-student");
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		redirect("/login");
	}

	const linked = await assertParentActiveLink(user.id, parsed.data);
	if (!linked) {
		redirect("/parent/select-student");
	}

	const jar = await cookies();
	jar.set(PARENT_ACTIVE_STUDENT_COOKIE, parsed.data, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * 60 * 24 * 400,
	});

	revalidatePath("/parent", "layout");
	redirect("/parent/dashboard");
}
