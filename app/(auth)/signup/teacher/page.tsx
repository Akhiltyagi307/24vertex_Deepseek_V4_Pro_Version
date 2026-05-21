import type { Metadata } from "next";

import { TeacherSignupForm } from "./teacher-signup-form";

export const metadata: Metadata = {
	title: "Teacher sign up",
	description: "Apply for an 24Vertex teacher account. Approval typically arrives within 24–48 hours.",
};

export default function TeacherSignupPage() {
	return <TeacherSignupForm />;
}
