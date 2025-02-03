import { useMemo } from 'react';
import { DataList, Heading, Link as ExternalLink, Spinner, Text } from '@radix-ui/themes';
import { createFileRoute, Link, type LinkOptions, type ReactNode } from '@tanstack/react-router';
import type { IntegrationService } from '~/server/db/schema/operations';
import { ServiceAvatar } from '../components/IntegrationAvatar';
import { trpc } from '../trpc';

export const Route = createFileRoute('/')({
	component: Home,
});

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
	linkOptions: LinkOptions;
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
	linkOptions,
	...props
}: IntegrationListProps<T>) {
	return (
		<div className={`flex shrink-0 overflow-hidden card ${className}`} {...props}>
			<Heading
				size="2"
				as="h3"
				color="gray"
				className="mr-4 flex shrink-0 grow-0 basis-32 flex-col items-center justify-center rounded-md border border-divider bg-background p-3 font-mono decoration-transparent hover:bg-tint hover:text-theme-text"
				truncate
				asChild
			>
				<Link {...linkOptions}>{label}</Link>
			</Heading>
			<ol className="-mb-3 flex shrink-0 grow-0 basis-full overflow-x-auto overflow-y-hidden pb-3">
				{data.length > 0 ? (
					data.map((item, index) => (
						<li key={index} className="mr-4 w-72 shrink-0 grow-0 border-r border-divider pr-4">
							<DataList.Root size="1" trim="normal" className="gap-1">
								{config.map(({ label, accessor, href }) => (
									<DataList.Item key={label}>
										<DataList.Label className="w-20 min-w-20">
											<Text truncate>{label}</Text>
										</DataList.Label>
										<DataList.Value>
											{!accessor(item) ? (
												<Text className="text-hint">—</Text>
											) : href && href(item) ? (
												<ExternalLink href={href(item)!} target="_blank" truncate>
													{accessor(item)}
												</ExternalLink>
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
				<IntegrationList
					label="Lightroom"
					data={adobeLightroomImages}
					config={config}
					linkOptions={{
						to: '/queue/media/lightroom-images',
					}}
				/>
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};

const AirtableSection = () => {
	const { data: airtableSpaces } = trpc.airtable.getSpaces.useQuery();
	const { data: airtableCreators } = trpc.airtable.getCreators.useQuery();
	const { data: airtableExtracts } = trpc.airtable.getExtracts.useQuery({
		limit: 100,
	});
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
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-spaces',
					}}
					label="Spaces"
					data={airtableSpaces}
					config={spacesConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{airtableCreators ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Creators"
					data={airtableCreators}
					config={creatorsConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{airtableExtracts ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Extracts"
					data={airtableExtracts}
					config={extractsConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{airtableAttachments ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Images"
					data={airtableAttachments}
					config={attachmentsConfig}
				/>
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
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Stars"
					data={githubStars}
					config={starsConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{githubUsers ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/github-users',
					}}
					label="Users"
					data={githubUsers}
					config={usersConfig}
				/>
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
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Collections"
					data={raindropCollections}
					config={collectionsConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{raindropBookmarks ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Bookmarks"
					data={raindropBookmarks}
					config={bookmarksConfig}
				/>
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
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Documents"
					data={readwiseDocuments}
					config={documentsConfig}
				/>
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
			{ label: 'URL', accessor: (item) => item.tweetUrl, href: (item) => item.tweetUrl },
			{ label: 'Media URL', accessor: (item) => item.mediaUrl, href: (item) => item.mediaUrl },
			{ label: 'Tweet', accessor: (item) => item.tweet?.text },
		],
		[]
	);

	return (
		<IntegrationQueueSection service="twitter">
			{twitterTweets ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/airtable-creators',
					}}
					label="Tweets"
					data={twitterTweets}
					config={tweetsConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{twitterUsers ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/index/twitter-users',
					}}
					label="Users"
					data={twitterUsers}
					config={usersConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
			{twitterMedia ? (
				<IntegrationList
					linkOptions={{
						to: '/queue/media/twitter-media',
					}}
					label="Media"
					data={twitterMedia}
					config={mediaConfig}
				/>
			) : (
				<LoadingPlaceholder />
			)}
		</IntegrationQueueSection>
	);
};
