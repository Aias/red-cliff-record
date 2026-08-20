import { emptyStringToNull } from '@hozo';
import { z } from 'zod';

/**
 * GitHub's OpenAPI schema types resource ids as `number | bigint`, while every
 * GitHub id column in the database is a 32-bit integer.
 */
export const toGithubId = (id: number | bigint): number => Number(id);

export const GithubEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  actor: z.any(),
  repo: z.any(),
  payload: z.any(),
  public: z.boolean(),
  created_at: z.coerce.date(),
});

const GithubLicenseSchema = z.object({
  key: z.string(),
  name: z.string(),
  spdx_id: z.string(),
  url: z.url().nullable(),
  node_id: z.string(),
});

const GithubOwnerSchema = z.object({
  id: z.number().int().positive(),
  login: z.string(),
  node_id: z.string(),
  avatar_url: z.url(),
  html_url: z.url(),
  type: z.enum(['User', 'Organization']),
});

const GithubRepositoryDetailsSchema = z.object({
  id: z.number().int().positive(),
  node_id: z.string(),
  html_url: z.url(),
  name: z.string(),
  full_name: z.string(),
  description: emptyStringToNull(z.string()),
  homepage: emptyStringToNull(
    z
      .string()
      .transform((str) => {
        if (!str.startsWith('http://') && !str.startsWith('https://')) {
          return `https://${str}`;
        }
        return str;
      })
      .pipe(z.url())
  ),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  pushed_at: z.coerce.date(),
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
