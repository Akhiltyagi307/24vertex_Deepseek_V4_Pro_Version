import { AdminCurriculumImportClient } from "./curriculum-import-client";

export const metadata = {
	title: "Curriculum import · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default function AdminCurriculumImportPage() {
	return <AdminCurriculumImportClient />;
}
