import { useEffect, useMemo } from 'react';
import { ExternalLinkIcon, ImageIcon } from '@radix-ui/react-icons';
import { Button, Link, SegmentedControl, Text, TextArea, TextField } from '@radix-ui/themes';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { CheckboxWithLabel } from '~/app/components/CheckboxWithLabel';
import { trpc } from '~/app/trpc';
import type { RecordSelect } from '~/server/db/schema';
import {
	IndicesSelectSchema,
	type IndexMainType,
	type IndicesSelect,
} from '~/server/db/schema/indices';

type IndexEntryFormProps = {
	indexEntryId: string | number;
	defaults: Partial<IndicesSelect>;
	updateCallback?: (data: IndicesSelect) => Promise<void>;
};

export const IndexEntryForm = ({
	indexEntryId,
	defaults: _defaults,
	updateCallback,
}: IndexEntryFormProps) => {
	const utils = trpc.useUtils();
	const [indexEntry] = trpc.indices.get.useSuspenseQuery(z.coerce.number().parse(indexEntryId));
	const relatedRecords: RecordSelect[] = useMemo(() => {
		const { recordsByCreator, recordsWithFormat, recordsInCategory } = indexEntry;
		return [
			...recordsByCreator.map((record) => record.record),
			...recordsWithFormat,
			...recordsInCategory.map((record) => record.record),
		];
	}, [indexEntry]);

	const associatedDomains = useMemo(() => {
		const uniqueDomains = new Set<string>();
		relatedRecords.forEach((r) => {
			if (r.url) {
				try {
					if (!/^https?:\/\//.test(r.url)) {
						return;
					}
					const url = new URL(r.url);
					uniqueDomains.add(url.origin);
				} catch (error) {
					console.error('Invalid URL:', r.url, error);
				}
			}
		});
		return Array.from(uniqueDomains)
			.filter((origin): origin is string => typeof origin === 'string')
			.map((origin) => {
				try {
					return new URL(origin);
				} catch (error) {
					console.error('Invalid URL:', origin, error);
					return null;
				}
			})
			.filter((url): url is URL => url !== null);
	}, [relatedRecords]);

	const updateIndexEntryMutation = trpc.indices.upsert.useMutation({
		onSuccess: async () => {
			utils.indices.get.invalidate();
			if (updateCallback) {
				await updateCallback(form.state.values);
			}
		},
	});

	const form = useForm({
		defaultValues: indexEntry,
		onSubmit: async ({ value }) => {
			updateIndexEntryMutation.mutate(value);
		},
		validators: {
			onChange: IndicesSelectSchema,
		},
	});

	useEffect(() => {
		form.reset(indexEntry);
	}, [indexEntry]);

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="flex gap-3">
				<form.Field name="mainType">
					{(field) => (
						<label className="flex grow flex-col gap-1">
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
				<form.Field name="subType">
					{(field) => (
						<label className="shrink-0 basis-1/4">
							<Text size="2" color="gray">
								Subtype
							</Text>
							<TextField.Root
								type="text"
								placeholder="e.g., 'Company'"
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value || null)}
							/>
						</label>
					)}
				</form.Field>
			</div>

			<div className="flex gap-4">
				<form.Field name="name">
					{(field) => (
						<label className="grow">
							<Text size="2" color="gray">
								Name (Required)
							</Text>
							<TextField.Root
								type="text"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>
				<form.Field name="shortName">
					{(field) => (
						<label className="shrink-0 basis-1/4">
							<Text size="2" color="gray">
								Short Name
							</Text>
							<TextField.Root
								type="text"
								placeholder="e.g., 'ABC'"
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value || null)}
							/>
						</label>
					)}
				</form.Field>
			</div>

			<form.Field name="sense">
				{(field) => (
					<label>
						<Text size="2" color="gray">
							Sense
						</Text>
						<TextField.Root
							type="text"
							placeholder="Differentiate between homonyms"
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						/>
					</label>
				)}
			</form.Field>

			<form.Field name="canonicalUrl">
				{(field) => (
					<label>
						<div className="flex items-center gap-2">
							<Text size="2" color="gray" className="flex-1">
								Canonical URL
							</Text>
							{field.state.value && (
								<Link
									href={field.state.value}
									target="_blank"
									rel="noopener noreferrer"
									size="1"
									className="flex items-center gap-1"
								>
									<ExternalLinkIcon className="size-3.5" />
									Open
								</Link>
							)}
						</div>
						<TextField.Root
							type="url"
							placeholder="e.g., https://www.example.com"
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						>
							<TextField.Slot>
								<ExternalLinkIcon className="text-hint" />
							</TextField.Slot>
						</TextField.Root>
						{associatedDomains.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{associatedDomains.map((url) => (
									<Button
										key={url.origin}
										size="1"
										variant="soft"
										type="button"
										onClick={() => field.handleChange(url.origin)}
									>
										{url.hostname}
									</Button>
								))}
							</div>
						)}
					</label>
				)}
			</form.Field>

			<form.Field name="canonicalMediaUrl">
				{(field) => (
					<label>
						<div className="flex items-center gap-2">
							<Text size="2" color="gray" className="flex-1">
								Image URL
							</Text>
							{field.state.value && (
								<Link
									href={field.state.value}
									target="_blank"
									rel="noopener noreferrer"
									size="1"
									className="flex items-center gap-1"
								>
									<ExternalLinkIcon className="size-3.5" />
									Open
								</Link>
							)}
						</div>
						<TextField.Root
							type="url"
							placeholder="e.g., https://www.example.com/image.jpg"
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						>
							<TextField.Slot>
								<ImageIcon className="text-hint" />
							</TextField.Slot>
						</TextField.Root>
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
							rows={4}
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						/>
						{field.state.value && (
							<Button
								size="1"
								variant="soft"
								className="mt-1"
								onClick={() => field.handleChange(null)}
							>
								Clear
							</Button>
						)}
					</label>
				)}
			</form.Field>

			<div className="mt-1 flex gap-4">
				<form.Field name="isPrivate">
					{(field) => (
						<CheckboxWithLabel
							className="mt-2"
							label="Private"
							checked={field.state.value || false}
							onCheckedChange={(checked) => field.handleChange(!!checked)}
						/>
					)}
				</form.Field>
				<form.Field name="needsCuration">
					{(field) => (
						<CheckboxWithLabel
							className="mt-2"
							label="Needs Curation"
							checked={field.state.value || false}
							onCheckedChange={(checked) => field.handleChange(!!checked)}
						/>
					)}
				</form.Field>
			</div>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
				children={([canSubmit, isSubmitting]) => (
					<div className="mt-2 border-t border-divider pt-4">
						<Button type="submit" disabled={!canSubmit}>
							{isSubmitting ? '...Saving' : 'Save Changes'}
						</Button>
					</div>
				)}
			/>
		</form>
	);
};
