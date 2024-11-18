export interface StarredRepo {
	starred_at: string;
	repo: Repository;
}

interface Repository {
	id: number;
	node_id: string;
	name: string;
	full_name: string;
	private: boolean;
	owner: Owner;
	html_url: string;
	description: string | null;
	fork: boolean;
	url: string;
	homepage: string | null;
	size: number;
	stargazers_count: number;
	watchers_count: number;
	language: string | null;
	has_issues: boolean;
	has_projects: boolean;
	has_downloads: boolean;
	has_wiki: boolean;
	has_pages: boolean;
	has_discussions: boolean;
	forks_count: number;
	mirror_url: string | null;
	archived: boolean;
	disabled: boolean;
	open_issues_count: number;
	license: License | null;
	allow_forking: boolean;
	is_template: boolean;
	web_commit_signoff_required: boolean;
	topics: string[];
	visibility: 'public' | 'private';
	forks: number;
	open_issues: number;
	watchers: number;
	default_branch: string;
	permissions: Permissions;
}

interface Owner {
	login: string;
	id: number;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: 'User' | 'Organization';
	user_view_type: string;
	site_admin: boolean;
}

interface License {
	key: string;
	name: string;
	spdx_id: string;
	url: string;
	node_id: string;
}

interface Permissions {
	admin: boolean;
	maintain: boolean;
	push: boolean;
	triage: boolean;
	pull: boolean;
}
