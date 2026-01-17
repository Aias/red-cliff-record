import { z } from 'zod';

const robotsEnum = z.enum([
  'all',
  'index',
  'noindex',
  'follow',
  'nofollow',
  'none',
  'nosnippet',
  'indexifembedded',
  'notranslate',
  'noimageindex',
]);

const metaTypeEnum = z.enum(['website', 'article', 'blog']);

const seoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.url().optional(),
  keywords: z.array(z.string()).optional(),
  author: z.string().optional(),
  twitterCreator: z.string().regex(/^@/, 'Twitter handle must start with @').optional(),
  robots: z.array(robotsEnum).optional(),
  locale: z.string().optional(),
  canonicalUrl: z.url().optional(),
  publishedTime: z.iso.datetime().optional(),
  type: metaTypeEnum.optional(),
});

type SeoProps = z.input<typeof seoSchema>;

export const seo = (props: SeoProps) => {
  const result = seoSchema.safeParse(props);

  if (!result.success) {
    console.error('SEO props validation failed:', z.treeifyError(result.error));
    // Fall back to using the props as-is
    return createTags(props);
  }

  return createTags(result.data);
};

const TWITTER_SITE = '@redcliffrecord';
export const SITE_NAME = 'Red Cliff Record';

function createTags({
  title,
  description,
  imageUrl,
  keywords,
  author = 'Nick Trombley',
  twitterCreator = '@redcliffrecord',
  robots = [robotsEnum.enum.index, robotsEnum.enum.follow],
  locale = 'en_US',
  canonicalUrl,
  publishedTime,
  type = metaTypeEnum.enum.website,
}: SeoProps) {
  const tags = [
    // Basic meta tags
    { title },
    ...(description ? [{ name: 'description', content: description }] : []),
    ...(keywords ? [{ name: 'keywords', content: keywords.join(', ') }] : []),
    ...(author ? [{ name: 'author', content: author }] : []),
    { name: 'robots', content: robots.join(', ') },
    ...(canonicalUrl ? [{ rel: 'canonical', href: canonicalUrl }] : []),

    // Twitter Card tags
    { name: 'twitter:card', content: imageUrl ? 'summary_large_image' : 'summary' },
    { name: 'twitter:site', content: TWITTER_SITE },
    ...(twitterCreator ? [{ name: 'twitter:creator', content: twitterCreator }] : []),
    { name: 'twitter:title', content: title },
    ...(description ? [{ name: 'twitter:description', content: description }] : []),
    ...(imageUrl ? [{ name: 'twitter:image', content: imageUrl }] : []),

    // Open Graph tags
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: type },
    { property: 'og:title', content: title },
    { property: 'og:locale', content: locale },
    ...(description ? [{ property: 'og:description', content: description }] : []),
    ...(imageUrl
      ? [
          { property: 'og:image', content: imageUrl },
          { property: 'og:image:alt', content: title },
        ]
      : []),
    ...(canonicalUrl ? [{ property: 'og:url', content: canonicalUrl }] : []),
    ...(publishedTime ? [{ property: 'article:published_time', content: publishedTime }] : []),
  ];

  return tags;
}
