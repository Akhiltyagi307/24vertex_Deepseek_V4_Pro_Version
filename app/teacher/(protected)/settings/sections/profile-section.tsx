"use client";

import { settingsPrimarySubmitClass } from "./_shared";
import { panelRaisedInputClass } from "@/app/student/settings/_settings-form-styles";
import { SubmitButton } from "@/components/auth/submit-button";
import { StudentAvatarUpload } from "@/components/student/student-avatar-upload";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { TeacherAccountProfile } from "../teacher-account-settings-form-types";

export function TeacherProfileSection({
	userId,
	profile,
	formAction,
}: {
	userId: string;
	profile: TeacherAccountProfile;
	formAction: (formData: FormData) => void;
}) {
	return (
		<form action={formAction} className="space-y-6">
			<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
				<CardHeader className="px-0 pt-0">
					<CardTitle className="text-lg">Profile</CardTitle>
					<CardDescription className="text-base">
						Name, photo, and phone shown where your educator account appears.
					</CardDescription>
				</CardHeader>
				<CardContent className="px-0">
					<FieldSet className="gap-6 border-0 p-0">
						<FieldLegend className="sr-only">Editable profile</FieldLegend>
						<FieldGroup className="gap-6">
							<Field>
								<FieldLabel className="text-base" htmlFor="teacherFullName">
									Display name
								</FieldLabel>
								<FieldContent>
									<Input
										id="teacherFullName"
										name="fullName"
										required
										className={panelRaisedInputClass}
										defaultValue={profile.full_name}
										autoComplete="name"
									/>
								</FieldContent>
							</Field>
							<StudentAvatarUpload
								userId={userId}
								displayName={profile.full_name}
								initialAvatarUrl={profile.avatar_url}
							/>
							<Field>
								<FieldLabel className="text-base" htmlFor="teacherPhone">
									Phone
								</FieldLabel>
								<FieldContent>
									<Input
										id="teacherPhone"
										name="phone"
										type="tel"
										className={panelRaisedInputClass}
										autoComplete="tel"
										defaultValue={profile.phone ?? ""}
									/>
								</FieldContent>
							</Field>
						</FieldGroup>
					</FieldSet>
				</CardContent>
			</Card>
			<SubmitButton label="Save profile" pendingLabel="Saving…" className={settingsPrimarySubmitClass} />
		</form>
	);
}
