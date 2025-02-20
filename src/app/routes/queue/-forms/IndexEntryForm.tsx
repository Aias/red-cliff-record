import { useEffect, useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { Flag, type RecordSelect } from '@/server/db/schema';
import {
	FLAGS,
	IndicesSelectSchema,
	type IndexMainType,
	type IndicesSelect,
} from '@/server/db/schema';
import {
	Button,
	CheckboxWithLabel,
	ExternalLink,
	Input,
	Textarea,
	ToggleGroup,
	ToggleGroupItem,
} from '@/components';

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
	const { data: subTypes } = trpc.indices.getSubtypes.useQuery();
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
			className="flex flex-col gap-2 text-sm"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			{subTypes && (
				<datalist id="index-subtypes">
					{subTypes.map((subType) => (
						<option key={subType} value={subType}>
							{subType}
						</option>
					))}
				</datalist>
			)}
			<div className="flex gap-3">
				<form.Field name="mainType">
					{(field) => (
						<label className="flex grow flex-col gap-1">
							<span className="text-rcr-secondary">Main Type</span>
							<ToggleGroup
								type="single"
								value={field.state.value}
								onValueChange={(value) => field.handleChange(value as IndexMainType)}
							>
								<ToggleGroupItem value="entity">Entity</ToggleGroupItem>
								<ToggleGroupItem value="category">Category</ToggleGroupItem>
								<ToggleGroupItem value="format">Format</ToggleGroupItem>
							</ToggleGroup>
						</label>
					)}
				</form.Field>
				<form.Field name="subType">
					{(field) => (
						<label className="shrink-0 basis-1/4">
							<span className="text-rcr-secondary">Subtype</span>
							<Input
								type="text"
								list="index-subtypes"
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
							<span className="text-rcr-secondary">Name (Required)</span>
							<Input
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
							<span className="text-rcr-secondary">Short Name</span>
							<Input
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
						<span className="text-rcr-secondary">Sense</span>
						<Input
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
							<span className="flex-1 text-rcr-secondary">Canonical URL</span>
							{field.state.value && <ExternalLink href={field.state.value} />}
						</div>
						<Input
							type="url"
							placeholder="e.g., https://www.example.com"
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						/>
						{associatedDomains.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{associatedDomains.slice(0, 5).map((url) => (
									<Button
										key={url.origin}
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
							<span className="flex-1 text-rcr-secondary">Image URL</span>
							{field.state.value && <ExternalLink href={field.state.value} />}
						</div>
						<Input
							type="url"
							placeholder="e.g., https://www.example.com/image.jpg"
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						/>
					</label>
				)}
			</form.Field>

			<form.Field name="notes">
				{(field) => (
					<label>
						<span className="text-rcr-secondary">Notes</span>
						<Textarea
							rows={4}
							value={field.state.value || ''}
							onChange={(e) => field.handleChange(e.target.value || null)}
						/>
						{field.state.value && (
							<Button className="mt-1" type="button" onClick={() => field.handleChange(null)}>
								Clear
							</Button>
						)}
					</label>
				)}
			</form.Field>

			<form.Field name="flags">
				{(field) => (
					<label className="flex flex-col justify-start gap-1">
						<span className="text-rcr-secondary">Flags</span>
						<ToggleGroup
							type="multiple"
							onValueChange={(values) => {
								field.handleChange(Flag.array().parse(values));
							}}
							value={field.state.value ?? []}
						>
							{Object.entries(FLAGS).map(([key, flag]) => (
								<ToggleGroupItem key={key} value={key as Flag}>
									{flag.emoji} {flag.name}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</label>
				)}
			</form.Field>

			<div className="mt-2 flex gap-4">
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

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
				children={([canSubmit, isSubmitting]) => (
					<div className="mt-2 border-t border-rcr-divider pt-4">
						<Button type="submit" disabled={!canSubmit}>
							{isSubmitting ? '...Saving' : 'Save Changes'}
						</Button>
					</div>
				)}
			/>
		</form>
	);
};
