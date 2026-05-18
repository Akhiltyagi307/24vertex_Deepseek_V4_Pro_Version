import type { Metadata } from "next";

import { ParentSignupForm } from "./parent-signup-form";

export const metadata: Metadata = {
	title: "Parent sign up",
	description: "Create a parent EduAI account and link it to your child's profile.",
};

export default function ParentSignupPage() {
	return <ParentSignupForm />;
}
