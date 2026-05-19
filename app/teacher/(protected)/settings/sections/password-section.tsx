"use client";

import { PasswordChangeForm } from "@/app/student/settings/password-change-form";

export function TeacherPasswordSection({ loginEmail }: { loginEmail: string }) {
	return <PasswordChangeForm loginEmail={loginEmail} fieldIdPrefix="teacher" />;
}
