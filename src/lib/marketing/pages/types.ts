export type MarketingFaqItem = {
	id: string;
	question: string;
	answer: string;
};

export type MarketingPageHero = {
	eyebrow?: string;
	title: string;
	lead: string;
};

export type MarketingBeliefCard = {
	title: string;
	body: string;
};

export type MarketingTeamMember = {
	name: string;
	role: string;
	bio: string;
	initials: string;
};
