import { redirect } from "next/navigation";

/** Teacher audience content lives on the schools landing (`#for-teachers`). */
export default function TeachersPage() {
	redirect("/schools#for-teachers");
}
