export type OrganizationRosterStudentRow = {
	id: string;
	fullName: string;
	grade: number | null;
	section: string | null;
	studentLinkCode: string | null;
};

export type OrganizationRosterFilterOptions = {
	grades: number[];
	sections: string[];
};
