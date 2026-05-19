"use client";

import { settingsPrimarySubmitClass } from "./_shared";
import { LoginEmailChangeForm } from "@/components/auth/login-email-change-form";

export function TeacherLoginEmailSection({ loginEmail }: { loginEmail: string }) {
	return (
		<LoginEmailChangeForm
			currentEmail={loginEmail}
			inputIdPrefix="teacherLoginEmail"
			variant="embedded"
			ctaButtonClassName={settingsPrimarySubmitClass}
		/>
	);
}
