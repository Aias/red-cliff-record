import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type AirtableSpaceSelect } from '@schema/integrations';
import {
	Text,
	Heading,
	Card,
	Button,
	TextField,
	SegmentedControl,
	TextArea,
	IconButton,
} from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { IndexEntrySelectSchema, IndexEntrySelect } from '@/db/schema/main';
import { IndexMainType } from '@/db/schema/main/types';
import { CheckboxWithLabel } from '@/app/components/CheckboxWithLabel';
import { AppLink } from '@/app/components/AppLink';
import { MetadataList } from '@/app/components/MetadataList';
import {
	airtableSpaceByIdQueryOptions,
	createIndexEntryFromAirtableSpace,
	archiveSpaces,
	updateIndexEntry,
} from './-queries';
import { Cross1Icon } from '@radix-ui/react-icons';
import { invalidateQueries } from '@/app/lib/query-helpers';

export const Route = createFileRoute('/(index)/queue/$airtableId')({
	component: RouteComponent,
	loader: ({ params, context }) =>
		context.queryClient.ensureQueryData(airtableSpaceByIdQueryOptions(params.airtableId)),
});

function RouteComponent() {
	const { airtableId } = Route.useParams();
	const { data: space } = useSuspenseQuery(airtableSpaceByIdQueryOptions(airtableId));
	const queryClient = useQueryClient();

	return (
		<Card className="flex gap-2 shrink basis-full">
			<div className="flex flex-col w-sm gap-4">
				<Heading size="4">Selected Space</Heading>
				{!space ? <Text>Not Found.</Text> : <MetadataList metadata={space} />}
				<Button
					variant="soft"
					onClick={() =>
						archiveSpaces({ data: [space.id] }).then(() => {
							invalidateQueries(queryClient, [
								['archiveQueueLength'],
								['airtableSpaceById', space.id],
								['airtableSpaces'],
							]);
						})
					}
				>
					Archive
				</Button>
			</div>
			<div className="flex flex-col gap-4 grow pl-3 ml-3 border-l border-divider">
				<div className="flex justify-between items-center">
					<Heading size="4">Index Entry</Heading>
					<AppLink asChild to={'/queue'}>
						<IconButton size="1" variant="soft">
							<Cross1Icon />
						</IconButton>
					</AppLink>
				</div>
				{space.indexEntry ? (
					<IndexEntryForm indexEntry={space.indexEntry} space={space} />
				) : (
					<NoIndexEntry space={space} />
				)}
			</div>
		</Card>
	);
}

const IndexEntryForm = ({
	indexEntry,
	space,
}: {
	indexEntry: IndexEntrySelect;
	space: AirtableSpaceSelect;
}) => {
	const queryClient = useQueryClient();
	const entryMutation = useMutation({
		mutationFn: updateIndexEntry,
		onSuccess: (data) => {
			queryClient.setQueryData(['airtableSpaceById', space.id], {
				...space,
				indexEntryId: data.id,
				indexEntry: data,
			});
			queryClient.setQueryData(['airtableSpaces'], (oldData: AirtableSpaceSelect[]) => {
				return oldData.map((space) =>
					space.indexEntryId === data.id ? { ...space, indexEntry: data } : space
				);
			});
		},
	});

	const form = useForm({
		defaultValues: indexEntry,
		onSubmit: async ({ value }) => {
			entryMutation.mutate({ data: value });
		},
		validators: {
			onChange: IndexEntrySelectSchema,
		},
	});

	useEffect(() => {
		form.reset(indexEntry);
	}, [indexEntry]);

	return (
		<>
			<form
				className="flex flex-col gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="mainType">
					{(field) => (
						<label className="flex flex-col gap-1">
							<Text size="2" color="gray">
								Main Type
							</Text>
							<SegmentedControl.Root
								variant="classic"
								value={field.state.value}
								onValueChange={(value) => field.handleChange(value as IndexMainType)}
							>
								<SegmentedControl.Item value="entity">Entity</SegmentedControl.Item>
								<SegmentedControl.Item value="category">Category</SegmentedControl.Item>
								<SegmentedControl.Item value="format">Format</SegmentedControl.Item>
							</SegmentedControl.Root>
						</label>
					)}
				</form.Field>

				<form.Field name="name">
					{(field) => (
						<label>
							<Text size="2" color="gray">
								Name
							</Text>
							<TextField.Root
								type="text"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>

				<form.Field name="sense">
					{(field) => (
						<label>
							<Text size="2" color="gray">
								Sense
							</Text>
							<TextField.Root
								type="text"
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>

				<form.Field name="shortName">
					{(field) => (
						<label>
							<Text size="2" color="gray">
								Short Name
							</Text>
							<TextField.Root
								type="text"
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>

				<form.Field name="notes">
					{(field) => (
						<label>
							<Text size="2" color="gray">
								Notes
							</Text>
							<TextArea
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>

				<form.Field name="private">
					{(field) => (
						<CheckboxWithLabel
							className="mt-2"
							label="Private"
							checked={field.state.value || false}
							onCheckedChange={(checked) => field.handleChange(!!checked)}
						/>
					)}
				</form.Field>

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
					children={([canSubmit, isSubmitting]) => (
						<div className="border-t border-divider pt-4 mt-4">
							<Button type="submit" disabled={!canSubmit}>
								{isSubmitting ? '...Saving' : 'Save Changes'}
							</Button>
						</div>
					)}
				/>
			</form>
			<MetadataList metadata={indexEntry} />
		</>
	);
};

const NoIndexEntry = ({ space }: { space: AirtableSpaceSelect }) => {
	const queryClient = useQueryClient();
	return (
		<div className="rounded-2 p-4 align-center justify-center flex flex-col border border-gray-a4 text-center gap-2">
			<Text>No index entry found for this space.</Text>
			<Button
				onClick={async () => {
					const { indexEntry: newIndexEntry, airtableSpace: updatedAirtableSpace } =
						await createIndexEntryFromAirtableSpace({ data: space });
					queryClient.setQueryData(['airtableSpaceById', space.id], {
						...updatedAirtableSpace,
						indexEntryId: newIndexEntry.id,
						indexEntry: newIndexEntry,
					});
					queryClient.setQueryData(['airtableSpaces'], (oldData: AirtableSpaceSelect[]) => {
						return oldData.map((oldSpace) =>
							oldSpace.id === space.id
								? {
										...updatedAirtableSpace,
										indexEntryId: newIndexEntry.id,
										indexEntry: newIndexEntry,
									}
								: oldSpace
						);
					});
				}}
			>
				Create Index Entry
			</Button>
		</div>
	);
};
