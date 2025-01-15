import { useMemo } from 'react';
import { DataList, Heading, Link, Spinner, Text } from '@radix-ui/themes';
import { createFileRoute, type ReactNode } from '@tanstack/react-router';
import type { IntegrationService } from '~/server/db/schema/operations';
import { ServiceAvatar } from '../components/IntegrationAvatar';
import { trpc } from '../trpc';

export const Route = createFileRoute('/')({
	component: Home,
});

const LABEL_WIDTH = '64px';

function Home() {
	return (
		<main className="flex basis-full flex-col gap-4 overflow-hidden p-3">
			<Heading size="5">Integrations</Heading>
			<div className="flex grow-0 basis-full flex-col gap-5 overflow-y-auto">
				<AdobeSection />
				<AirtableSection />
				<GithubSection />
				<RaindropSection />
				<ReadwiseSection />
				<TwitterSection />
			</div>
		</main>
	);
}

interface IntegrationQueueSectionProps {
	service: IntegrationService;
	label?: string;
	children?: React.ReactNode;
}

const IntegrationQueueSection = ({ service, label, children }: IntegrationQueueSectionProps) => {
	return (
		<section className="flex flex-col gap-3">
			<header className="flex items-center gap-3">
				<ServiceAvatar service={service} size="1" radius="none" />
				<Heading size="3" as="h2" className="capitalize">
					{label ?? service}
				</Heading>
			</header>
			{children}
		</section>
	);
};

type IntegrationListConfig<T> = {
	label: string;
	accessor: (item: T) => ReactNode | null | undefined;
	href?: (item: T) => string | null | undefined;
};

interface IntegrationListProps<T> extends React.HTMLAttributes<HTMLDivElement> {
	label: string;
	data: T[];
	config: IntegrationListConfig<T>[];
}

const LoadingPlaceholder = () => (
	<div className="flex grow items-center justify-center card">
		<Spinner />
	</div>
);

export function IntegrationList<T>({
	data,
	config,
	className = '',
	label,
	...props
}: IntegrationListProps<T>) {
	return (
		<div className={`flex shrink-0 overflow-hidden card ${className}`} {...props}>
			<Heading
				size="2"
				as="h3"
				color="gray"
				className="mr-4 flex shrink-0 grow-0 flex-col items-center justify-center rounded-md border border-divider bg-background p-3 font-mono"
				truncate
				style={{
					flexBasis: '96px',
				}}
			>
				{label}
			</Heading>
			<ol className="-mb-3 flex shrink-0 grow-0 basis-full overflow-x-auto overflow-y-hidden pb-3">
				{data.length > 0 ? (
					data.map((item, index) => (
						<li key={index} className="mr-4 w-xs shrink-0 grow-0 border-r border-divider pr-4">
							<DataList.Root size="1" trim="both" className="gap-1">
								{config.map(({ label, accessor, href }) => (
									<DataList.Item key={label}>
										<DataList.Label width={LABEL_WIDTH} minWidth={LABEL_WIDTH}>
											<Text truncate>{label}</Text>
										</DataList.Label>
										<DataList.Value>
											{!accessor(item) ? (
												<Text className="text-hint">—</Text>
											) : href && href(item) ? (
												<Link href={href(item)!} target="_blank" truncate>
													{accessor(item)}
												</Link>
											) : (
												<Text truncate>{accessor(item)}</Text>
											)}
										</DataList.Value>
									</DataList.Item>
								))}
							</DataList.Root>
						</li>
					))
				) : (
					<Text size="2" color="gray" className="grow self-center text-center" as="p">
						Nothing in queue.
					</Text>
				)}
			</ol>
		</div>
	);
}

export type SingleRecord<T> = NonNullable<T> extends (infer U)[] ? U : never;

const AdobeSection = () => {
	const { data: adobeLightroomImages } = trpc.adobe.getLightroomImages.useQuery();

	const config = useMemo<IntegrationListConfig<SingleRecord<typeof adobeLightroomImages>>[]>(
		() => [
			{
				label: 'URL',
				accessor: (item) => {
					const url = new URL(item.url2048);
					return `${url.origin}${url.pathname}`;
				},
				href: (item) => item.url2048,
			},
			{
				label: 'Camera',
				accessor: (item) => `${item.cameraModel} (${item.cameraLens})`,
			},
			{ label: 'Captured', accessor: (item) => item.captureDate.toLocaleString() },
		],
		[]
	);

	return (
		<IntegrationQueueSection service="adobe">
			{adobeLightroomImages ? (
				<IntegrationList label="Lightroom" data={adobeLightroomImages} config={config} />
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};

const AirtableSection = () => {
	const { data: airtableSpaces } = trpc.airtable.getSpaces.useQuery();
	const { data: airtableCreators } = trpc.airtable.getCreators.useQuery();
	const { data: airtableExtracts } = trpc.airtable.getExtracts.useQuery();
	const { data: airtableAttachments } = trpc.airtable.getAttachments.useQuery();

	const spacesConfig: IntegrationListConfig<SingleRecord<typeof airtableSpaces>>[] = useMemo(
		() => [
			{ label: 'Name', accessor: (item) => item.name },
			{ label: 'Full Name', accessor: (item) => item.fullName },
			{ label: 'Icon', accessor: (item) => item.icon },
		],
		[]
	);

	const creatorsConfig: IntegrationListConfig<SingleRecord<typeof airtableCreators>>[] = useMemo(
		() => [
			{ label: 'Name', accessor: (item) => item.name, href: (item) => item.website },
			{ label: 'Type', accessor: (item) => item.type },
			{ label: 'Professions', accessor: (item) => item.professions?.join(', ') },
		],
		[]
	);

	const extractsConfig: IntegrationListConfig<SingleRecord<typeof airtableExtracts>>[] = useMemo(
		() => [
			{ label: 'Title', accessor: (item) => item.title, href: (item) => item.source },
			{ label: 'Format', accessor: (item) => item.format },
			{
				label: 'Source',
				accessor: (item) => item.source,
				href: (item) => item.source,
			},
		],
		[]
	);

	const attachmentsConfig: IntegrationListConfig<SingleRecord<typeof airtableAttachments>>[] =
		useMemo(
			() => [
				{ label: 'Filename', accessor: (item) => item.filename, href: (item) => item.url },
				{ label: 'Size', accessor: (item) => item.size },
				{
					label: 'Dimensions',
					accessor: (item) => (item.width && item.height ? `${item.width}x${item.height}` : null),
				},
			],
			[]
		);

	return (
		<IntegrationQueueSection service="airtable">
			{airtableSpaces ? (
				<IntegrationList label="Spaces" data={airtableSpaces} config={spacesConfig} />
			) : (
				<LoadingPlaceholder />
			)}
			{airtableCreators ? (
				<IntegrationList label="Creators" data={airtableCreators} config={creatorsConfig} />
			) : (
				<LoadingPlaceholder />
			)}
			{airtableExtracts ? (
				<IntegrationList label="Extracts" data={airtableExtracts} config={extractsConfig} />
			) : (
				<LoadingPlaceholder />
			)}
			{airtableAttachments ? (
				<IntegrationList label="Images" data={airtableAttachments} config={attachmentsConfig} />
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};

const GithubSection = () => {
	const { data: githubStars } = trpc.github.getStars.useQuery();
	const { data: githubUsers } = trpc.github.getUsers.useQuery();

	const starsConfig: IntegrationListConfig<SingleRecord<typeof githubStars>>[] = useMemo(
		() => [
			{ label: 'Name', accessor: (item) => item.name, href: (item) => item.htmlUrl },
			{ label: 'Owner', accessor: (item) => item.owner.login },
			{ label: 'Description', accessor: (item) => item.description },
		],
		[]
	);

	const usersConfig: IntegrationListConfig<SingleRecord<typeof githubUsers>>[] = useMemo(
		() => [
			{ label: 'Login', accessor: (item) => item.login, href: (item) => item.htmlUrl },
			{ label: 'Name', accessor: (item) => item.name },
			{ label: 'Website', accessor: (item) => item.blog, href: (item) => item.blog },
		],
		[]
	);

	return (
		<IntegrationQueueSection service="github">
			{githubStars ? (
				<IntegrationList label="Stars" data={githubStars} config={starsConfig} />
			) : (
				<LoadingPlaceholder />
			)}
			{githubUsers ? (
				<IntegrationList label="Users" data={githubUsers} config={usersConfig} />
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};

const RaindropSection = () => {
	const { data: raindropCollections } = trpc.raindrop.getCollections.useQuery();
	const { data: raindropBookmarks } = trpc.raindrop.getBookmarks.useQuery();

	const collectionsConfig: IntegrationListConfig<SingleRecord<typeof raindropCollections>>[] =
		useMemo(
			() => [
				{ label: 'Title', accessor: (item) => item.title },
				{ label: 'Count', accessor: (item) => item.raindropCount },
				{ label: 'Parent', accessor: (item) => item.parent && item.parent.title },
			],
			[]
		);

	const bookmarksConfig: IntegrationListConfig<SingleRecord<typeof raindropBookmarks>>[] = useMemo(
		() => [
			{ label: 'Title', accessor: (item) => item.title, href: (item) => item.linkUrl },
			{ label: 'Type', accessor: (item) => item.type },
			{ label: 'Excerpt', accessor: (item) => item.excerpt },
		],
		[]
	);

	return (
		<IntegrationQueueSection service="raindrop">
			{raindropCollections ? (
				<IntegrationList
					label="Collections"
					data={raindropCollections}
					config={collectionsConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{raindropBookmarks ? (
				<IntegrationList label="Bookmarks" data={raindropBookmarks} config={bookmarksConfig} />
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};

const ReadwiseSection = () => {
	const { data: readwiseDocuments } = trpc.readwise.getDocuments.useQuery();

	const documentsConfig: IntegrationListConfig<SingleRecord<typeof readwiseDocuments>>[] = useMemo(
		() => [
			{ label: 'Title', accessor: (item) => item.title, href: (item) => item.sourceUrl },
			{ label: 'Author', accessor: (item) => item.author },
			{ label: 'Summary', accessor: (item) => item.summary },
		],
		[]
	);

	return (
		<IntegrationQueueSection service="readwise">
			{readwiseDocuments ? (
				<IntegrationList label="Documents" data={readwiseDocuments} config={documentsConfig} />
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};

const TwitterSection = () => {
	const { data: twitterTweets } = trpc.twitter.getTweets.useQuery();
	const { data: twitterUsers } = trpc.twitter.getUsers.useQuery();
	const { data: twitterMedia } = trpc.twitter.getMedia.useQuery();

	const tweetsConfig: IntegrationListConfig<SingleRecord<typeof twitterTweets>>[] = useMemo(
		() => [
			{ label: 'Text', accessor: (item) => item.text },
			{ label: 'Quoting', accessor: (item) => item.quotedTweet?.text },
			{ label: 'User', accessor: (item) => item.user?.displayName },
		],
		[]
	);

	const usersConfig: IntegrationListConfig<SingleRecord<typeof twitterUsers>>[] = useMemo(
		() => [
			{ label: 'Name', accessor: (item) => item.displayName, href: (item) => item.externalUrl },
			{ label: 'Username', accessor: (item) => item.username },
			{ label: 'Description', accessor: (item) => item.description },
		],
		[]
	);

	const mediaConfig: IntegrationListConfig<SingleRecord<typeof twitterMedia>>[] = useMemo(
		() => [
			{ label: 'URL', accessor: (item) => item.url, href: (item) => item.url },
			{ label: 'Media URL', accessor: (item) => item.mediaUrl, href: (item) => item.mediaUrl },
			{ label: 'Tweet', accessor: (item) => item.tweet?.text },
		],
		[]
	);

	return (
		<IntegrationQueueSection service="twitter">
			{twitterTweets ? (
				<IntegrationList label="Tweets" data={twitterTweets} config={tweetsConfig} />
			) : (
				<LoadingPlaceholder />
			)}
			{twitterUsers ? (
				<IntegrationList label="Users" data={twitterUsers} config={usersConfig} />
			) : (
				<LoadingPlaceholder />
			)}
			{twitterMedia ? (
				<IntegrationList label="Media" data={twitterMedia} config={mediaConfig} />
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};
