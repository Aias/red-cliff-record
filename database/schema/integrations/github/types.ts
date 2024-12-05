import { z } from 'zod';
import { emptyStringToNull } from '../../utils/schema-helpers';

const GithubLicenseSchema = z.object({
	key: z.string(),
	name: z.string(),
	spdx_id: z.string(),
	url: z.string().url().nullable(),
	node_id: z.string(),
});

const GithubOwnerSchema = z.object({
	id: z.number().int().positive(),
	login: z.string(),
	node_id: z.string(),
	avatar_url: z.string().url(),
	html_url: z.string().url(),
	type: z.enum(['User', 'Organization']),
});

const GithubRepositoryDetailsSchema = z.object({
	id: z.number().int().positive(),
	html_url: z.string().url(),
	homepage: emptyStringToNull(
		z
			.string()
			.transform((str) => {
				if (!str.startsWith('http://') && !str.startsWith('https://')) {
					return `https://${str}`;
				}
				return str;
			})
			.pipe(z.string().url())
	),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
	pushed_at: z.coerce.date(),
	name: z.string(),
	full_name: z.string(),
	description: emptyStringToNull(z.string()),
	language: z.string().nullable(),
	topics: z.array(z.string()),
	private: z.boolean(),
	owner: GithubOwnerSchema,
	license: GithubLicenseSchema.nullable(),
});

const GithubStarredRepoSchema = z.object({
	starred_at: z.coerce.date(),
	repo: GithubRepositoryDetailsSchema,
});

export const GithubStarredReposResponseSchema = z.object({
	data: z.array(GithubStarredRepoSchema),
});

export type StarredRepo = z.infer<typeof GithubStarredRepoSchema>;
