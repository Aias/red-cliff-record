import { useEffect, useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import {
	RecordInsertSchema,
	RecordTypeSchema,
	type RecordInsert,
	type RecordType,
} from '@/server/db/schema';
import { recordTypeIcons } from './type-icons';
import { Avatar, DynamicTextarea, ExternalLink, GhostInput, MetadataList } from '@/components';
import {
	Button,
	IntegrationLogo,
	Label,
	Separator,
	Slider,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	ToggleGroup,
	ToggleGroupItem,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components';
import ImageGrid from '@/components/media-grid';
import { cn } from '@/lib/utils';

interface BooleanSwitchProps extends React.ComponentProps<typeof Label> {
	label: string;
	value: boolean | undefined;
	handleChange: (value: boolean) => void;
}

export const BooleanSwitch = ({
	label,
	value,
	handleChange,
	className,
	...props
}: BooleanSwitchProps) => {
	return (
		<Label className={cn('inline-flex items-center gap-2', className)} {...props}>
			<Switch checked={value} onCheckedChange={handleChange} />
			<span>{label}</span>
		</Label>
	);
};

interface RecordFormProps {
	recordId: number;
}

export function RecordForm({ recordId }: RecordFormProps) {
	const utils = trpc.useUtils();
	const [record] = trpc.records.get.useSuspenseQuery(Number(recordId));

	const recordFormData: RecordInsert = useMemo(() => {
		return { ...record };
	}, [record]);

	const handleUpdate = trpc.records.upsert.useMutation({
		onSuccess: () => {
			utils.records.get.invalidate(Number(recordId));
			utils.records.list.invalidate();
			utils.records.findDuplicates.invalidate(Number(recordId));
		},
	});

	const form = useForm({
		defaultValues: {
			...recordFormData,
		},
		onSubmit: async ({ value }) => {
			const {
				title,
				sense,
				abbreviation,
				url,
				avatarUrl,
				summary,
				content,
				notes,
				mediaCaption,
				...rest
			} = value;
			await handleUpdate.mutateAsync({
				...rest,
				title: title || null,
				url: url || null,
				avatarUrl: avatarUrl || null,
				abbreviation: abbreviation || null,
				sense: sense || null,
				summary: summary || null,
				content: content || null,
				notes: notes || null,
				mediaCaption: mediaCaption || null,
			});
		},
		validators: {
			onSubmit: RecordInsertSchema,
		},
	});

	useEffect(() => {
		form.reset({
			...record,
		});
	}, [recordId, record, form]);

	// Extract related data for display
	const { media, sources } = useMemo(() => record, [record]);

	return (
		<form
			key={recordId} // Add key prop to force re-render when recordId changes
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<h1 className="flex items-center gap-3">
				{record.avatarUrl && (
					<Avatar src={record.avatarUrl} fallback={record.title?.charAt(0) ?? '?'} />
				)}
				<form.Field name="title">
					{(field) => (
						<div className="grow-1">
							<GhostInput
								value={field.state.value ?? ''}
								placeholder="Untitled Record"
								onChange={(e) => field.handleChange(e.target.value)}
							/>
							{field.state.meta.errors && (
								<p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
							)}
						</div>
					)}
				</form.Field>
				{sources && sources.length > 0 && (
					<div className="flex items-center gap-2">
						{sources.map((source) => (
							<IntegrationLogo key={source} integration={source} className="text-base" />
						))}
					</div>
				)}
			</h1>

			{/* Type selector with toggle group */}
			<div className="@container">
				<form.Field name="type">
					{(field) => (
						<TooltipProvider>
							<ToggleGroup
								type="single"
								value={field.state.value}
								onValueChange={(value) => {
									if (value) field.handleChange(value as RecordType);
								}}
								variant="outline"
								className="w-full"
							>
								{RecordTypeSchema.options.map((type) => {
									const { icon: Icon, description } = recordTypeIcons[type];
									return (
										<Tooltip key={type}>
											<TooltipTrigger asChild>
												<ToggleGroupItem
													value={type}
													aria-label={type}
													data-state={field.state.value === type ? 'on' : 'off'}
													className="flex grow-1 items-center gap-1"
												>
													<Icon />
													<span className="hidden capitalize @[480px]:inline">{type}</span>
												</ToggleGroupItem>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>
													<strong className="mr-1 capitalize">{type}</strong>
													{description}
												</p>
											</TooltipContent>
										</Tooltip>
									);
								})}
							</ToggleGroup>
						</TooltipProvider>
					)}
				</form.Field>
			</div>

			{/* Rating slider */}
			<form.Field name="rating">
				{(field) => (
					<div className="mx-5 flex flex-col gap-3">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<Label htmlFor="rating" className="inline-flex w-[0px] justify-center">
								Rating
							</Label>
							<span className="inline-flex w-[0px] justify-center text-[0.875em]">⭐</span>
							<span className="inline-flex w-[0px] justify-center text-[0.875em]">⭐⭐</span>
							<span className="inline-flex w-[0px] justify-center text-[0.875em]">⭐⭐⭐</span>
						</div>
						<Slider
							id="rating"
							min={0}
							max={3}
							step={1}
							value={[field.state.value ?? 0]}
							onValueChange={(values) => field.handleChange(values[0] ?? 0)}
						/>
					</div>
				)}
			</form.Field>

			{/* Metadata section with editable label-value table */}
			<div className="flex flex-col gap-3">
				<h2>Record Metadata</h2>
				<div className="rounded-md border border-border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-20">Field</TableHead>
								<TableHead>Value</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{/* URL field */}
							<TableRow>
								<TableCell>
									<Label className="flex w-full" htmlFor="url">
										URL
									</Label>
								</TableCell>
								<TableCell>
									<form.Field
										name="url"
										validators={{
											onChange: z
												.string()
												.url('Must be a valid URL')
												.or(z.string().length(0))
												.nullable(),
										}}
									>
										{(field) => (
											<>
												<div className="flex items-center gap-1">
													<GhostInput
														id="url"
														className="w-full"
														value={field.state.value ?? ''}
														placeholder="https://example.com"
														onChange={(e) => field.handleChange(e.target.value)}
													/>
													{field.state.value && (
														<ExternalLink href={field.state.value} children={null} />
													)}
												</div>
												{field.state.meta.errors && (
													<p className="text-sm text-destructive">
														{field.state.meta.errors.join(', ')}
													</p>
												)}
											</>
										)}
									</form.Field>
								</TableCell>
							</TableRow>

							{/* Avatar URL field */}
							<TableRow>
								<TableCell>
									<Label className="flex w-full" htmlFor="avatarUrl">
										Avatar URL
									</Label>
								</TableCell>
								<TableCell>
									<form.Field
										name="avatarUrl"
										validators={{
											onChange: z
												.string()
												.url('Must be a valid URL')
												.or(z.string().length(0))
												.nullable(),
										}}
									>
										{(field) => (
											<>
												<div className="flex items-center gap-1">
													<GhostInput
														id="avatarUrl"
														className="w-full"
														value={field.state.value ?? ''}
														placeholder="https://example.com/image.jpg"
														onChange={(e) => field.handleChange(e.target.value)}
													/>
													{field.state.value && (
														<ExternalLink href={field.state.value} children={null} />
													)}
												</div>
												{field.state.meta.errors && (
													<p className="text-sm text-destructive">
														{field.state.meta.errors.join(', ')}
													</p>
												)}
											</>
										)}
									</form.Field>
								</TableCell>
							</TableRow>

							{/* Abbreviation field */}
							<TableRow>
								<TableCell>
									<Label className="flex w-full" htmlFor="abbreviation">
										Abbreviation
									</Label>
								</TableCell>
								<TableCell>
									<form.Field name="abbreviation">
										{(field) => (
											<GhostInput
												id="abbreviation"
												className="w-full"
												value={field.state.value ?? ''}
												placeholder="Short form"
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										)}
									</form.Field>
								</TableCell>
							</TableRow>

							{/* Sense field */}
							<TableRow>
								<TableCell>
									<Label className="flex w-full" htmlFor="sense">
										Sense
									</Label>
								</TableCell>
								<TableCell>
									<form.Field name="sense">
										{(field) => (
											<GhostInput
												id="sense"
												className="w-full"
												value={field.state.value ?? ''}
												placeholder="Meaning or definition"
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										)}
									</form.Field>
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Content section */}
			<div className="flex flex-col gap-3">
				<h2>Content</h2>

				{/* Summary field */}
				<form.Field name="summary">
					{(field) => (
						<div className="flex flex-col gap-1">
							<Label htmlFor="summary">Summary</Label>
							<DynamicTextarea
								id="summary"
								value={field.state.value ?? ''}
								placeholder="A brief summary of this record"
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</div>
					)}
				</form.Field>

				{/* Content field */}
				<form.Field name="content">
					{(field) => (
						<div className="flex flex-col gap-1">
							<Label htmlFor="content">Content</Label>
							<DynamicTextarea
								id="content"
								value={field.state.value ?? ''}
								placeholder="Main content"
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</div>
					)}
				</form.Field>

				{/* Notes field */}
				<form.Field name="notes">
					{(field) => (
						<div className="flex flex-col gap-1">
							<Label htmlFor="notes">Notes</Label>
							<DynamicTextarea
								id="notes"
								value={field.state.value ?? ''}
								placeholder="Additional notes"
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</div>
					)}
				</form.Field>
			</div>

			{/* Media section */}
			{media && media.length > 0 && (
				<>
					<Separator />
					<div className="flex flex-col gap-3">
						<h2>Media</h2>
						<ImageGrid media={media} />

						{/* Media caption field */}
						<form.Field name="mediaCaption">
							{(field) => (
								<div className="flex flex-col gap-1">
									<Label htmlFor="mediaCaption">Caption</Label>
									<DynamicTextarea
										id="mediaCaption"
										value={field.state.value ?? ''}
										placeholder="Media caption"
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</div>
							)}
						</form.Field>
					</div>
				</>
			)}

			{/* Settings section */}
			<div className="flex flex-col gap-4">
				<h2>Settings</h2>
				{/* Toggle switches */}
				<div className="flex justify-between">
					<form.Field name="isIndexNode">
						{(field) => (
							<BooleanSwitch
								label="Indexable"
								id="isIndexNode"
								value={field.state.value}
								handleChange={field.handleChange}
							/>
						)}
					</form.Field>

					<form.Field name="isFormat">
						{(field) => (
							<BooleanSwitch
								label="Is Format"
								id="isFormat"
								value={field.state.value}
								handleChange={field.handleChange}
							/>
						)}
					</form.Field>

					<form.Field name="isPrivate">
						{(field) => (
							<BooleanSwitch
								label="Is Private"
								id="isPrivate"
								value={field.state.value}
								handleChange={field.handleChange}
							/>
						)}
					</form.Field>

					<form.Field name="isCurated">
						{(field) => (
							<BooleanSwitch
								label="Is Curated"
								id="isCurated"
								value={field.state.value}
								handleChange={field.handleChange}
							/>
						)}
					</form.Field>
				</div>
			</div>

			{/* Metadata section */}
			<Separator />
			<div className="flex flex-col gap-3">
				<h2 className="text-xl font-semibold">System Metadata</h2>
				<MetadataList
					metadata={{
						ID: record.id,
						Created: record.recordCreatedAt,
						Updated: record.recordUpdatedAt,
						'Content Created': record.contentCreatedAt,
						'Content Updated': record.contentUpdatedAt,
					}}
				/>
			</div>

			{/* Form actions */}
			<Separator />
			<div className="flex justify-end gap-2">
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<div className="flex gap-2">
							<Button
								type="button"
								disabled={!canSubmit || isSubmitting}
								variant="outline"
								onClick={async () => {
									form.setFieldValue('isCurated', true);
									await form.handleSubmit();
								}}
							>
								{isSubmitting ? 'Saving...' : 'Save As Curated'}
							</Button>
							<Button type="submit" disabled={!canSubmit || isSubmitting}>
								{isSubmitting ? 'Saving...' : 'Save Changes'}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
