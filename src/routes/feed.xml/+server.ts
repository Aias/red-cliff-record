import { prisma } from '$lib/server/prisma';
import markdown from '$helpers/markdown';
import { getArticle, combineAsList } from '$helpers/grammar';
import xmlFormatter from 'xml-formatter';

const feedQuery = () => {
	// First define the include structure separately
	const extractInclude = {
		format: true,
		attachments: true,
		creators: {
			select: {
				id: true,
				name: true
			}
		},
		spaces: {
			select: {
				id: true,
				topic: true
			}
		},
		parent: true,
		connectedTo: {
			include: {
				to: {
					select: {
						id: true,
						title: true
					}
				}
			}
		}
	} as const;

	// Add children with the same include structure
	const recursiveInclude = {
		...extractInclude,
		children: {
			include: extractInclude
		}
	} as const;

	// Use in query
	const query = prisma.extract.findMany({
		where: {
			publishedOn: {
				not: null
			},
			OR: [
				{
					parentId: null
				},
				{
					children: {
						some: {}
					}
				}
			]
		},
		include: recursiveInclude,
		take: 30,
		orderBy: [{ publishedOn: 'desc' }, { createdAt: 'desc' }]
	});
	return query;
};
type FeedItem = Awaited<ReturnType<typeof feedQuery>>[number];

const makeSiteLink = (relativePath: string, title: string) =>
	`<a href="${meta.url}/${relativePath}">${title}</a>`;

const generateContentMarkup = (extract: FeedItem, isChild: boolean = false) => {
	const { content, notes, format, sourceUrl, attachments, creators, connectedTo, spaces, parent } =
		extract;
	let type = (format ? format.name : 'extract').toLowerCase();
	let markup = '<article>\n';
	if (!isChild) {
		markup += '<header>\n';
		markup += '<p>';
		markup += `${getArticle(type)} <strong>${type}</strong>`;
		if (creators.length > 0) {
			const creatorsMarkup = markdown.parseInline(
				combineAsList(creators.map((c) => `[${c.name}](${meta.url}/creators/${c.id})`))
			);
			markup += ` by ${creatorsMarkup}`;
		}
		if (parent) {
			markup += ` from <em>${parent.title}</em>`;
		}
		markup += '.</p>\n';
		markup += '</header>\n';
	}
	markup += '<section>\n';
	if (attachments) {
		markup += '<figure>\n';
		markup += attachments
			.map(
				({ id, extension }) =>
					`<img src="https://assets.barnsworthburning.net/${id}${extension}" alt="Alt text for all images coming soon!" />\n`
			)
			.join('');
		const caption = attachments[0]?.caption;
		if (caption) {
			markup += `<figcaption>${markdown.parse(caption)}</figcaption>\n`;
		}
		markup += '</figure>\n';
	}
	if (content) {
		markup += '<blockquote>\n';
		markup += markdown.parse(content);
		markup += '</blockquote>\n';
	}
	if (sourceUrl) {
		markup += `<p>[<a href="${sourceUrl}">Source</a>]</p>\n`;
	}
	if (connectedTo.length > 0) {
		markup += '<p>Related:</p>\n';
		markup += '<ul>\n';
		markup += connectedTo
			.map(
				(connection) =>
					`<li>${makeSiteLink(`extracts/${connection.to.id}`, connection.to.title)}</li>\n`
			)
			.join('');
		markup += '</ul>\n';
	}
	if (spaces.length > 0) {
		markup += `<p>\n<small>`;
		markup += spaces
			.map((space) => makeSiteLink(`spaces/${space.id}`, `#${space.topic}`))
			.join(' • ');
		markup += `</small>\n</p>\n`;
	}
	if (notes) {
		markup += '<hr>\n';
		markup += `<small>${markdown.parse(notes)}</small>\n`;
	}
	markup += '</section>\n';
	markup += '</article>';

	return markup;
};

const cleanLink = (link: string) => {
	return link.replace(/&/g, '&amp;');
};

const extensionToMimeType = (extension?: string | null) => {
	if (!extension) return 'image';
	let ext = extension.toLowerCase().replace('.', '');
	switch (ext) {
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'gif':
			return 'image/gif';
		case 'bmp':
			return 'image/bmp';
		case 'webp':
			return 'image/webp';
		case 'svg':
			return 'image/svg+xml';
		case 'tiff':
		case 'tif':
			return 'image/tiff';
		case 'ico':
			return 'image/x-icon';
		case 'heic':
			return 'image/heic';
		case 'heif':
			return 'image/heif';
		default:
			return 'image';
	}
};

const meta = {
	title: 'barnsworthburning',
	description: 'A commonplace book.',
	author: {
		name: 'Nick Trombley',
		email: 'trombley.nick@gmail.com',
		url: 'https://nicktrombley.design'
	},
	tags: ['design', 'knowledge', 'making', 'architecture', 'art'],
	url: 'https://barnsworthburning.net'
};

const atom = async () => {
	const extracts = await feedQuery();

	const feedUpdated = new Date(
		Math.max(
			...extracts.map((entry) =>
				Math.max(
					entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0,
					entry.publishedOn ? new Date(entry.publishedOn).getTime() : 0,
					entry.createdAt ? new Date(entry.createdAt).getTime() : 0
				)
			)
		)
	).toISOString();
	return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <id>${meta.url}/feed</id>
    <title>${meta.title}</title>
    <subtitle>${meta.description}</subtitle>
    <link href="${meta.url}/feed.xml" rel="self" />
    <link href="${meta.url}" />
    <icon>${meta.url}/favicon.png</icon>
    <author>
        <name>${meta.author.name}</name>
        <email>${meta.author.email}</email>
        <uri>${meta.author.url}</uri>
    </author>
    <updated>${feedUpdated}</updated>
	${meta.tags.map((tag) => `<category term="${tag}" />`).join('\n')}
	${extracts
		.map((extract) => {
			const {
				title,
				id,
				creators,
				sourceUrl,
				updatedAt,
				publishedOn,
				createdAt,
				spaces,
				attachments,
				children
			} = extract;

			let entry = `<entry>`;
			entry += `<id>${meta.url}/extracts/${id}</id>`;
			entry += `<title><![CDATA[${title}]]></title>`;
			if (creators) {
				entry += creators
					.map((creator) => `<author><name><![CDATA[${creator.name}]]></name></author>`)
					.join('\n');
			}
			entry += `<published>${new Date(publishedOn ?? updatedAt ?? createdAt).toISOString()}</published>`;
			entry += `<updated>${new Date(Math.max(publishedOn ? new Date(publishedOn).getTime() : 0, updatedAt ? new Date(updatedAt).getTime() : 0)).toISOString()}</updated>`;
			entry += `<link rel="alternate" href="${meta.url}/extracts/${id}" />`;
			if (sourceUrl) {
				entry += `<link rel="via" href="${cleanLink(sourceUrl)}" />`;
			}
			if (attachments) {
				entry += attachments
					.map(
						(attachment) =>
							`<link rel="enclosure" href="${cleanLink(`https://assets.barnsworthburning.net/${attachment.id}${attachment.extension}`)}" type="${extensionToMimeType(attachment.extension)}" />`
					)
					.join('\n');
			}
			if (spaces) {
				entry += spaces.map((space) => `<category term="${space.topic}" />`).join('\n');
			}
			entry += `<content type="html"><![CDATA[`;
			entry += generateContentMarkup(extract);
			if (children.length) {
				entry += children
					.map((child) => {
						const { title } = child;
						let childMarkup = `<br><hr><br>`;
						childMarkup += `<h3>${title}</h3>`;
						childMarkup += generateContentMarkup(child as FeedItem, true);
						return childMarkup;
					})
					.join('\n');
			}
			entry += `]]></content>`;
			entry += '</entry>';
			return entry;
		})
		.join('\n')}
</feed>`.trim();
};

export async function GET() {
	const atomContent = await atom();
	const responseBody = xmlFormatter(atomContent, {
		collapseContent: true
	});
	const responseOptions = {
		status: 200,
		headers: {
			'Content-Type': 'application/atom+xml; charset=utf-8',
			'Cache-Control': `max-age=0, s-maxage=0`
		}
	};

	return new Response(responseBody, responseOptions);
}
