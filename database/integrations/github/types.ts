export interface StarredRepo {
  starred_at: string;
  repo: {
    html_url: string;
    name: string;
    owner: {
      login: string;
      avatar_url: string;
    };
    description: string | null;
    topics: string[];
  };
}

export interface GitHubResponse {
	data: StarredRepo[];
}