import { useEffect } from 'react';
import { Button, SegmentedControl, Text, TextArea, TextField } from '@radix-ui/themes';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckboxWithLabel } from '@/app/components/CheckboxWithLabel';
import { MetadataList } from '@/app/components/MetadataList';
import type { AirtableSpaceSelect } from '@/db/schema/integrations';
import { IndicesSelectSchema, type IndexMainType, type IndicesSelect } from '@/db/schema/main';
import { updateIndexEntry } from '../-queries';

export const IndexEntryForm = ({
	indexEntry,
	space,
}: {
	indexEntry: IndicesSelect;
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
			onChange: IndicesSelectSchema,
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
