import { requireVerifiedTeacher } from "@/lib/auth/require-verified-teacher-layout";

export default async function ProtectedTeacherLayout({ children }: { children: React.ReactNode }) {
	await requireVerifiedTeacher();
	return children;
}
