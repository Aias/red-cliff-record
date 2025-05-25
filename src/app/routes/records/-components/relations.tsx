import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon, MergeIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { RecordGet } from '@/server/api/routers/types';
import { RecordLink } from './record-link';
import { RelationshipSelector } from './record-lookup';
import type { LinkSelect, PredicateSelect } from '@/db/schema';
import {
	useDeleteLinks,
	useMergeRecords,
	usePredicateMap,
	useRecordLinks,
} from '@/lib/hooks/use-records';
import { cn } from '@/lib/utils';

interface RelationsListProps {
	id: DbId;
}

interface RecordLink extends LinkSelect {
	predicate: PredicateSelect;
	record: RecordGet;
	direction: 'outgoing' | 'incoming';
}

export const RelationsList = ({ id }: RelationsListProps) => {
	const { data: recordLinks } = useRecordLinks(id);
	const predicates = usePredicateMap();
	const mergeRecordsMutation = useMergeRecords();
	const deleteLinkMutation = useDeleteLinks();
	const navigate = useNavigate();
	const addRelationshipButtonRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey && event.altKey && (event.key === '+' || event.code === 'Equal')) {
				event.preventDefault();
				addRelationshipButtonRef.current?.click();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	const outgoingLinks = useMemo(() => recordLinks?.outgoingLinks ?? [], [recordLinks]);
	const incomingLinks = useMemo(
		() =>
			recordLinks?.incomingLinks.filter(
				(link) => predicates[link.predicateId]?.type !== 'containment'
			) ?? [],
		[recordLinks]
	);
	const totalLinks = useMemo(
		() => outgoingLinks.length + incomingLinks.length,
		[outgoingLinks, incomingLinks]
	);

	return (
		<section>
			<header className="flex items-center justify-between overflow-hidden">
				<h3 className="mb-2">
					Relations <span className="text-sm text-c-secondary">({totalLinks})</span>
				</h3>
				<RelationshipSelector
					sourceId={id}
					label={
						<span>
							<PlusIcon /> Add
						</span>
					}
					buttonProps={{
						ref: addRelationshipButtonRef,
						size: 'sm',
						variant: 'outline',
						className: 'h-[1.5lh]',
					}}
					buildActions={({ sourceId, targetId }) => {
						return [
							{
								key: 'merge-records',
								label: (
									<>
										<MergeIcon /> Merge
									</>
								),
								onSelect: () => {
									navigate({
										to: '/records/$recordId',
										params: { recordId: targetId.toString() },
										search: true,
									});
									mergeRecordsMutation.mutate({
										sourceId,
										targetId,
									});
								},
							},
						];
					}}
				/>
			</header>
			{outgoingLinks.length > 0 && (
				<>
					<h4 className="mb-2 flex items-center gap-2 font-mono text-sm font-semibold text-c-hint uppercase">
						<ArrowRightIcon className="h-4 w-4" /> Outgoing
					</h4>
					<ul className="flex flex-col gap-2 text-xs">
						{outgoingLinks.map((link) => (
							<li
								key={`${link.sourceId}-${link.targetId}-${link.predicateId}`}
								className="flex items-center gap-2"
							>
								<RelationshipSelector
									label={predicates[link.predicateId]?.name ?? 'Unknown'}
									sourceId={id}
									link={link}
									buttonProps={{
										className: 'w-30',
									}}
									buildActions={({ sourceId, targetId }) => {
										return [
											{
												key: 'merge-records',
												label: (
													<>
														<MergeIcon /> Merge
													</>
												),
												onSelect: () => {
													navigate({
														to: '/records/$recordId',
														params: { recordId: targetId.toString() },
														search: true,
													});
													mergeRecordsMutation.mutate({
														sourceId,
														targetId,
													});
												},
											},
											{
												key: 'delete-link',
												label: (
													<>
														<TrashIcon /> Delete
													</>
												),
												onSelect: () => {
													deleteLinkMutation.mutate([link.id]);
												},
											},
										];
									}}
								/>
								<RecordLink
									id={link.targetId}
									linkOptions={{
										to: '/records/$recordId',
										search: true,
										params: { recordId: link.targetId.toString() },
									}}
								/>
							</li>
						))}
					</ul>
				</>
			)}
			{incomingLinks.length > 0 && (
				<>
					<h4
						className={cn(
							'mb-2 flex items-center gap-2 font-mono text-sm font-semibold text-c-hint uppercase',
							outgoingLinks.length > 0 && 'mt-3'
						)}
					>
						<ArrowLeftIcon className="h-4 w-4" /> Incoming
					</h4>
					<ul className="flex flex-col gap-2 text-xs">
						{incomingLinks.map((link) => (
							<li
								key={`${link.sourceId}-${link.targetId}-${link.predicateId}`}
								className="flex items-center gap-2"
							>
								<RelationshipSelector
									label={predicates[link.predicateId]?.name ?? 'Unknown'}
									sourceId={id}
									link={link}
									buttonProps={{
										className: 'w-30',
									}}
									buildActions={() => {
										return [
											{
												key: 'merge-records',
												label: (
													<>
														<MergeIcon /> Merge
													</>
												),
												onSelect: () => {
													navigate({
														to: '/records/$recordId',
														params: { recordId: link.sourceId.toString() },
														search: true,
													});
													mergeRecordsMutation.mutate({
														sourceId: link.targetId,
														targetId: link.sourceId,
													});
												},
											},
											{
												key: 'delete-link',
												label: (
													<>
														<TrashIcon /> Delete
													</>
												),
												onSelect: () => {
													deleteLinkMutation.mutate([link.id]);
												},
											},
										];
									}}
								/>
								<RecordLink
									id={link.sourceId}
									linkOptions={{
										to: '/records/$recordId',
										search: true,
										params: { recordId: link.sourceId.toString() },
									}}
								/>
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
};

export const SimilarRecords = ({ id }: { id: DbId }) => {
	const navigate = useNavigate();
	const mergeRecordsMutation = useMergeRecords();

	// Fetch similar records only if textEmbedding exists
	const { data: similarRecords, isLoading } = trpc.search.byRecordId.useQuery(
		{
			id: id,
			limit: 10,
		},
		{
			trpc: {
				context: {
					skipBatch: true,
				},
			},
		}
	);

	return (
		<section className="text-xs">
			<h3 className="mb-2">Similar Records</h3>
			{isLoading ? (
				<p>Loading...</p>
			) : similarRecords && similarRecords.length > 0 ? (
				<ul>
					{similarRecords.map((record) => (
						<li key={record.id} className="mb-2 flex items-center gap-4">
							<RelationshipSelector
								sourceId={id}
								initialTargetId={record.id}
								label={`${Math.round(record.similarity * 100)}%`}
								buttonProps={{
									size: 'sm',
									variant: 'outline',
									className: 'h-[1.5lh] font-mono text-xs text-c-secondary',
								}}
								popoverProps={{ side: 'left' }}
								buildActions={({ sourceId, targetId }) => {
									return [
										{
											key: 'merge-records',
											label: (
												<>
													<MergeIcon /> Merge
												</>
											),
											onSelect: () => {
												navigate({
													to: '/records/$recordId',
													params: { recordId: targetId.toString() },
													search: true,
												});
												mergeRecordsMutation.mutate({
													sourceId,
													targetId,
												});
											},
										},
									];
								}}
							/>
							<RecordLink
								id={record.id}
								className="flex-1"
								linkOptions={{
									to: '/records/$recordId',
									search: true,
									params: {
										recordId: record.id.toString(),
									},
								}}
							/>
						</li>
					))}
				</ul>
			) : (
				<p>No similar records found.</p>
			)}
		</section>
	);
};
