import { useEffect } from 'react';
import { Button, Heading, ScrollArea, Text, TextArea, TextField } from '@radix-ui/themes';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { CheckboxWithLabel } from '~/app/components/CheckboxWithLabel';
import { MetadataList } from '~/app/components/MetadataList';
import { trpc } from '~/app/trpc';
import { RecordSelectSchema, type RecordSelect } from '~/server/db/schema/records';

type RecordEntryFormProps = {
	recordId: string | number;
	defaults?: Partial<RecordSelect>;
	updateCallback?: (data: RecordSelect) => Promise<void>;
};

export const RecordEntryForm: React.FC<RecordEntryFormProps> = ({
	recordId,
	defaults: _defaults,
	updateCallback,
}) => {
	// Coerce the provided recordId to a number before querying.
	const id = z.coerce.number().parse(recordId);
	const [record] = trpc.records.get.useSuspenseQuery(id);
	const utils = trpc.useUtils();

	const updateRecordMutation = trpc.records.upsert.useMutation({
		onSuccess: async () => {
			utils.records.get.invalidate();
			if (updateCallback) {
				await updateCallback(form.state.values);
			}
		},
	});

	// Merge the fetched record and any provided default values.
	const form = useForm({
		defaultValues: record,
		onSubmit: async ({ value }) => {
			updateRecordMutation.mutate(value);
		},
		validators: {
			onChange: RecordSelectSchema,
		},
	});

	useEffect(() => {
		form.reset(record);
	}, [record]);

	return (
		<div className="flex basis-full flex-col gap-3 overflow-hidden">
			<Heading size="3" as="h2">
				Edit Record Entry
			</Heading>
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="grid grid-cols-1 gap-3">
					{/* Title Text Field */}
					<form.Field name="title">
						{(field) => (
							<label className="flex flex-col gap-1">
								<Text size="2" color="gray">
									Title
								</Text>
								<TextField.Root
									type="text"
									value={field.state.value || ''}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</label>
						)}
					</form.Field>

					{/* Content TextArea */}
					<form.Field name="content">
						{(field) => (
							<label className="flex flex-col gap-1">
								<Text size="2" color="gray">
									Content
								</Text>
								<TextArea
									rows={4}
									value={field.state.value || ''}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</label>
						)}
					</form.Field>

					{/* URL Text Field */}
					<form.Field name="url">
						{(field) => (
							<label className="flex flex-col gap-1">
								<Text size="2" color="gray">
									URL
								</Text>
								<TextField.Root
									type="url"
									placeholder="https://example.com"
									value={field.state.value || ''}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</label>
						)}
					</form.Field>

					{/* Checkboxes for "private" and "needsCuration" */}
					<div className="mt-3 flex flex-wrap gap-4">
						<form.Field name="isPrivate">
							{(field) => (
								<CheckboxWithLabel
									label="Private"
									checked={field.state.value || false}
									onCheckedChange={(checked) => field.handleChange(!!checked)}
								/>
							)}
						</form.Field>
						<form.Field name="needsCuration">
							{(field) => (
								<CheckboxWithLabel
									label="Needs Curation"
									checked={field.state.value || false}
									onCheckedChange={(checked) => field.handleChange(!!checked)}
								/>
							)}
						</form.Field>
					</div>
				</div>

				{/* Form submit button */}
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<div className="mt-4 border-t border-divider pt-4">
							<Button type="submit" disabled={!canSubmit}>
								{isSubmitting ? '...Saving' : 'Save Changes'}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>

			{/* Metadata review (optional) */}
			<ScrollArea scrollbars="vertical">
				<MetadataList metadata={record} />
			</ScrollArea>
		</div>
	);
};
