import type { SearchResult } from '@/server/api/routers/search';
import { recordTypeIcons } from './type-icons';
import { IntegrationLogo } from '@/components/integration-logo';
import type { MediaType } from '@/db/schema';
import { toTitleCase } from '@/lib/formatting';
import { usePredicateMap } from '@/lib/hooks/use-records';

export const SearchResultItem = ({ result }: { result: SearchResult }) => {
	const predicates = usePredicateMap();
	const {
		type,
		title,
		abbreviation,
		sense,
		content,
		summary,
		url,
		outgoingLinks,
		media,
		avatarUrl,
		mediaCaption,
		sources,
	} = result;

	let creatorTitle: string | undefined | null;
	let parentTitle: string | undefined | null;

	for (const edge of outgoingLinks) {
		const kind = predicates[edge.predicate.id]?.type;
		if (kind === 'creation' && !creatorTitle) {
			creatorTitle = edge.target.title;
		}
		if (kind === 'containment' && !parentTitle) {
			parentTitle = edge.target.title;
		}
		if (creatorTitle && parentTitle) break;
	}

	const preview = summary ?? content ?? url;

	const labelElement = (
		<>
			<strong className="text-c-accent">
				{title ??
					creatorTitle ??
					(parentTitle ? `↳ ${parentTitle}` : `Untitled ${toTitleCase(type)}`)}
			</strong>
			{abbreviation && <span className="ml-1 text-c-hint">({abbreviation})</span>}
		</>
	);

	let mediaItem: { type: MediaType; url: string; altText?: string | null } | null = null;
	if (media?.[0]) {
		mediaItem = media[0];
	} else if (avatarUrl) {
		mediaItem = { type: 'image', url: avatarUrl };
	}

	const TypeIcon = recordTypeIcons[type].icon;

	return (
		<div className="flex w-full grow items-center gap-2">
			<TypeIcon className="size-[1lh] text-c-hint" />
			<div className="line-clamp-1 flex grow items-center gap-1 truncate overflow-ellipsis whitespace-nowrap">
				<div className="min-w-0 shrink-0">{labelElement}</div>
				{sense && <span className="shrink-0 truncate text-c-hint italic">{sense}</span>}
				<div className="ml-2 line-clamp-1 shrink truncate text-c-secondary">{preview}</div>
			</div>
			{mediaItem && (
				<div className="relative aspect-[3/2] h-[1lh] shrink-0 self-center overflow-hidden rounded-md border border-c-divider bg-c-mist">
					{mediaItem.type === 'image' ? (
						<img
							src={mediaItem.url}
							alt={mediaItem.altText ?? mediaCaption ?? ''}
							className="absolute inset-0 size-full object-cover"
						/>
					) : (
						<video src={mediaItem.url} className="absolute inset-0 object-cover" />
					)}
				</div>
			)}
			{sources ? (
				<ul className="flex items-center gap-1.5 text-[0.75em] opacity-50">
					{sources.map((s) => (
						<li key={s}>
							<IntegrationLogo integration={s} />
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
};
