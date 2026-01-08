import { Link } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import { ExternalLink } from '@/components/external-link';
import { IntegrationLogo } from '@/components/integration-logo';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';
import { recordTypeIcons } from './type-icons';

type RecordTreePreviewProps = {
	recordId: DbId;
	className?: string;
};

type MetadataItem = {
	label: string;
	value: string;
	dateTime?: string;
};

const formatDate = (date: Date) => {
	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	}).format(date);
};

const buildMetadataItems = ({
	recordCreatedAt,
	recordUpdatedAt,
	contentCreatedAt,
	contentUpdatedAt,
	rating,
	reminderAt,
}: {
	recordCreatedAt: Date;
	recordUpdatedAt: Date;
	contentCreatedAt: Date;
	contentUpdatedAt: Date;
	rating: number;
	reminderAt: Date | null;
}): MetadataItem[] => {
	const items: MetadataItem[] = [
		{
			label: 'Record created',
			value: formatDate(recordCreatedAt),
			dateTime: recordCreatedAt.toISOString(),
		},
		{
			label: 'Record updated',
			value: formatDate(recordUpdatedAt),
			dateTime: recordUpdatedAt.toISOString(),
		},
		{
			label: 'Content created',
			value: formatDate(contentCreatedAt),
			dateTime: contentCreatedAt.toISOString(),
		},
		{
			label: 'Content updated',
			value: formatDate(contentUpdatedAt),
			dateTime: contentUpdatedAt.toISOString(),
		},
	];

	if (rating > 0) {
		items.push({
			label: 'Rating',
			value: `${rating}`,
		});
	}

	if (reminderAt) {
		items.push({
			label: 'Reminder',
			value: formatDate(reminderAt),
			dateTime: reminderAt.toISOString(),
		});
	}

	return items;
};

export function RecordTreePreview({ recordId, className }: RecordTreePreviewProps) {
	const { data: record, isLoading, isError } = useRecord(recordId);

	if (isLoading) {
		return (
			<div className={cn('card flex items-center justify-center py-6', className)}>
				<Spinner />
			</div>
		);
	}

	if (isError || !record) {
		return (
			<div className={cn('card flex items-center gap-2 py-4 text-c-hint italic', className)}>
				<RectangleEllipsisIcon className="size-4" />
				<span>Record not found (ID: {recordId})</span>
			</div>
		);
	}

	const {
		type,
		title,
		abbreviation,
		sense,
		summary,
		content,
		notes,
		url,
		sources,
		media,
		mediaCaption,
		avatarUrl,
		recordCreatedAt,
		recordUpdatedAt,
		contentCreatedAt,
		contentUpdatedAt,
		rating,
		isPrivate,
		isCurated,
		reminderAt,
	} = record;

	const TypeIcon = recordTypeIcons[type].icon;
	const recordMedia = media ?? [];
	const recordSources = sources ?? [];
	const metadataItems = buildMetadataItems({
		recordCreatedAt,
		recordUpdatedAt,
		contentCreatedAt,
		contentUpdatedAt,
		rating,
		reminderAt,
	});
	const hasMedia = recordMedia.length > 0;
	const showAvatar = !hasMedia && Boolean(avatarUrl);

	return (
		<article
			className={cn('card flex flex-col gap-4 px-4 py-3 text-sm', className)}
			data-slot="record-tree-preview"
		>
			<header className="flex flex-wrap items-start gap-3" data-slot="record-tree-preview-header">
				<div className="flex items-start gap-2">
					<TypeIcon className="mt-0.5 size-4 text-c-hint" />
					<div className="flex flex-col gap-1">
						<Link
							to="/records/$recordId"
							params={{ recordId: recordId.toString() }}
							search={true}
							className="text-base font-semibold text-c-primary underline-offset-4 hover:underline"
						>
							{title ?? 'Untitled'}
						</Link>
						{abbreviation && <span className="text-xs text-c-hint">({abbreviation})</span>}
						{sense && <em className="text-xs text-c-secondary">{sense}</em>}
					</div>
				</div>

				{recordSources.length > 0 && (
					<ul className="ml-auto flex flex-wrap items-center gap-2 text-xs text-c-secondary">
						{recordSources.map((source) => (
							<li key={source}>
								<IntegrationLogo integration={source} />
							</li>
						))}
					</ul>
				)}
			</header>

			{url && (
				<div className="flex flex-wrap items-center gap-2 text-xs text-c-secondary">
					<span className="text-c-hint">Source</span>
					<ExternalLink href={url} className="inline-flex items-center gap-2 break-all">
						{url}
					</ExternalLink>
				</div>
			)}

			{(isPrivate || isCurated) && (
				<ul className="flex flex-wrap gap-2 text-xs text-c-secondary">
					{isPrivate && <li className="rounded-full bg-c-mist px-2 py-1">Private</li>}
					{isCurated && <li className="rounded-full bg-c-mist px-2 py-1">Curated</li>}
				</ul>
			)}

			{hasMedia && (
				<figure className="flex flex-col gap-2">
					<MediaGrid media={recordMedia} />
					{mediaCaption && (
						<figcaption className="text-xs text-c-secondary">{mediaCaption}</figcaption>
					)}
				</figure>
			)}

			{showAvatar && (
				<figure className="flex flex-col gap-2">
					<img
						src={avatarUrl ?? ''}
						alt={title ?? 'Record avatar'}
						className="h-auto w-full rounded-md border border-c-divider object-cover"
						loading="lazy"
						decoding="async"
					/>
					{mediaCaption && (
						<figcaption className="text-xs text-c-secondary">{mediaCaption}</figcaption>
					)}
				</figure>
			)}

			{mediaCaption && !hasMedia && !showAvatar && (
				<section className="flex flex-col gap-1" data-slot="record-tree-preview-media-caption">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">
						Media caption
					</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{mediaCaption}</p>
				</section>
			)}

			{summary && (
				<section className="flex flex-col gap-1" data-slot="record-tree-preview-summary">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">Summary</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{summary}</p>
				</section>
			)}

			{content && (
				<section className="flex flex-col gap-1" data-slot="record-tree-preview-content">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">Content</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{content}</p>
				</section>
			)}

			{notes && (
				<section className="flex flex-col gap-1" data-slot="record-tree-preview-notes">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">Notes</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{notes}</p>
				</section>
			)}

			<dl className="grid gap-3 text-xs text-c-secondary md:grid-cols-2">
				{metadataItems.map((item) => (
					<div key={item.label} className="flex flex-col gap-1">
						<dt className="text-c-hint">{item.label}</dt>
						<dd className="text-c-primary">
							{item.dateTime ? <time dateTime={item.dateTime}>{item.value}</time> : item.value}
						</dd>
					</div>
				))}
			</dl>
		</article>
	);
}
