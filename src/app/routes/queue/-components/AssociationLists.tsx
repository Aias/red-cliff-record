import { type PropsWithChildren } from 'react';
import { Badge, Spinner, Text } from '@radix-ui/themes';
import { IntegrationAvatar } from '~/app/components/IntegrationAvatar';
import { Placeholder } from '~/app/components/Placeholder';
import { toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { IntegrationType } from '~/server/db/schema';

interface RecordCategoriesProps {
	categoryId: number;
}

const Loader = () => (
	<Placeholder className="shrink-0 basis-auto">
		<Spinner />
	</Placeholder>
);

const Empty = ({ label }: { label: string }) => (
	<div className="flex shrink-0 grow-0 justify-center overflow-hidden rounded border border-divider bg-tint p-2 align-middle opacity-75">
		<Text>{label}</Text>
	</div>
);

const RecordList = ({ children }: PropsWithChildren) => (
	<ol className="flex flex-col rounded border border-border">{children}</ol>
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
	<li className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0">
		<Badge color="gray" size="1" className="capitalize">
			{badge}
		</Badge>
		<Text size="2" weight="medium" wrap="nowrap" truncate>
			{title ? title : sources ? sources.map(toTitleCase).join(', ') : 'Untitled'}
		</Text>
		{content && (
			<Text size="2" color="gray" truncate wrap="nowrap" className="shrink-1 grow-1 basis-0">
				{content}
			</Text>
		)}
		{sources && sources.length > 0 ? (
			<div className="flex shrink grow-0 basis-auto items-center justify-end gap-2">
				{sources.map((source) => (
					<IntegrationAvatar key={source} integration={source} size="1" className="size-4" />
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
