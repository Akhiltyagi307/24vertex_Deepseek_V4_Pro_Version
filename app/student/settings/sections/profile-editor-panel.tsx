"use client";

import { panelRaisedInputClass } from "../_settings-form-styles";
import type { StudentProfileSettingsRow } from "../student-profile-settings-form";
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
import { StudentAvatarUpload } from "@/components/student/student-avatar-upload";

export function ProfileEditorPanel({
	userId,
	profile,
}: {
	userId: string;
	profile: StudentProfileSettingsRow;
}) {
	return (
		<div>
			<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
				<CardHeader className="px-0 pt-0">
					<CardTitle className="text-lg">Profile</CardTitle>
					<CardDescription className="text-base">
						Name, photo, and phone—what classmates and reports see as you.
					</CardDescription>
				</CardHeader>
				<CardContent className="px-0">
					<FieldSet className="gap-6 border-0 p-0">
						<FieldLegend className="sr-only">Editable profile</FieldLegend>
						<FieldGroup className="gap-6">
							<Field>
								<FieldLabel className="text-base" htmlFor="fullName">
									Display name
								</FieldLabel>
								<FieldContent>
									<Input
										id="fullName"
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
								<FieldLabel className="text-base" htmlFor="phone">
									Phone
								</FieldLabel>
								<FieldContent>
									<Input
										id="phone"
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
		</div>
	);
}
