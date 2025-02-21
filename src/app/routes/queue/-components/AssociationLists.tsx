import { type PropsWithChildren } from 'react';
import { trpc } from '@/app/trpc';
import type { IntegrationType } from '@/server/db/schema';
import { Badge, IntegrationLogo, Placeholder, Spinner } from '@/components';
import { toTitleCase } from '@/lib/formatting';

interface RecordCategoriesProps {
	categoryId: number;
}

const Loader = () => (
	<Placeholder className="shrink-0 basis-auto">
		<Spinner />
	</Placeholder>
);

const Empty = ({ label }: { label: string }) => (
	<div className="flex shrink-0 grow-0 justify-center overflow-hidden rounded border border-rcr-divider bg-rcr-tint p-2 align-middle opacity-75">
		{label}
	</div>
);

const RecordList = ({ children }: PropsWithChildren) => (
	<ol className="flex flex-col rounded border border-rcr-border">{children}</ol>
);

const RecordListItem = ({
	badge,
	title,
	content,
	sources,
}: {
	badge: string;
	title?: string | null;
	content?: string | null;
	sources?: IntegrationType[] | null;
}) => (
	<li className="flex items-center gap-2 border-b border-rcr-border px-2 py-1.5 text-sm last:border-b-0">
		<Badge className="capitalize">{badge}</Badge>
		<span className="truncate text-sm font-medium">
			{title ? title : sources ? sources.map(toTitleCase).join(', ') : 'Untitled'}
		</span>
		{content && (
			<span className="shrink-1 grow-1 basis-0 truncate text-sm text-nowrap text-rcr-secondary">
				{content}
			</span>
		)}
		{sources && sources.length > 0 ? (
			<div className="flex shrink grow-0 basis-auto items-center justify-end gap-2">
				{sources.map((source) => (
					<IntegrationLogo key={source} integration={source} className="size-4" inline />
				))}
			</div>
		) : null}
	</li>
);

export const RecordCategories = ({ categoryId }: RecordCategoriesProps) => {
	const { data: records } = trpc.relations.getRecordsForCategory.useQuery(categoryId);

	return records ? (
		records.length > 0 ? (
			<RecordList>
				{records.map((record) => (
					<RecordListItem
						key={record.record.id}
						badge={record.type.replaceAll('_', ' ')}
						title={record.record.title}
						content={record.record.content ?? record.record.summary ?? ' '}
						sources={record.record.sources}
					/>
				))}
			</RecordList>
		) : (
			<Empty label="No records filed under this category." />
		)
	) : (
		<Loader />
	);
};

interface RecordCreatorsProps {
	creatorId: number;
}

export const RecordCreators = ({ creatorId }: RecordCreatorsProps) => {
	const { data: records } = trpc.relations.getRecordsByCreator.useQuery(creatorId);

	return records ? (
		records.length > 0 ? (
			<RecordList>
				{records.map((record) => (
					<RecordListItem
						key={record.record.id}
						badge={record.role}
						title={record.record.title}
						content={record.record.content ?? record.record.summary ?? ' '}
						sources={record.record.sources}
					/>
				))}
			</RecordList>
		) : (
			<Empty label="No records associated with this creator" />
		)
	) : (
		<Loader />
	);
};
