import { useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { RecordInsertSchema, RecordTypeSchema, type RecordType } from '@/server/db/schema';
import { trpc } from '../../trpc';
import { BooleanSwitch } from './-components/form-components';
import { typeIcons } from './-components/type-icons';
import { Avatar, DynamicTextarea, GhostInput, MetadataList } from '@/components';
import {
	Button,
	Label,
	Separator,
	Slider,
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

export const Route = createFileRoute('/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions(Number(recordId)));
	},
});

function RouteComponent() {
	const utils = trpc.useUtils();
	const { recordId } = Route.useParams();
	const [record] = trpc.records.get.useSuspenseQuery(Number(recordId));

	const handleUpdate = trpc.records.upsert.useMutation({
		onSuccess: () => {
			utils.records.get.invalidate(Number(recordId));
			utils.records.list.invalidate();
			utils.records.search.invalidate();
		},
	});

	// Create a form with Tanstack Form
	// Using recordId as a key to force re-creation of the form when recordId changes
	const form = useForm({
		defaultValues: {
			...record,
		},
		onSubmit: async ({ value }) => {
			await handleUpdate.mutateAsync({
				...value,
				id: record.id,
			});
		},
		validators: {
			onSubmit: RecordInsertSchema,
		},
	});

	// Extract related data for display
	const { media } = useMemo(() => record, [record]);

	return (
		<div className="basis-full overflow-y-auto p-4">
			<form
				key={recordId} // Add key prop to force re-render when recordId changes
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					void form.handleSubmit();
				}}
				className="card flex max-w-150 flex-col gap-4 p-4"
			>
				<div className="flex items-center gap-3">
					{record.avatarUrl && (
						<Avatar
							inline
							className="size-12"
							src={record.avatarUrl}
							fallback={record.title?.charAt(0) ?? '?'}
						/>
					)}
					<form.Field
						name="title"
						validators={{
							onChange: z.string().min(1, 'Title is required'),
						}}
					>
						{(field) => (
							<div className="w-full">
								<GhostInput
									className="text-2xl font-semibold"
									value={field.state.value}
									placeholder="Untitled Record"
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors && (
									<p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
								)}
							</div>
						)}
					</form.Field>
				</div>

				{/* Type selector with toggle group */}
				<div>
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
										const { icon: Icon, description } = typeIcons[type];
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
														<span className="capitalize">{type}</span>
													</ToggleGroupItem>
												</TooltipTrigger>
												<TooltipContent side="bottom">
													<p>{description}</p>
												</TooltipContent>
											</Tooltip>
										);
									})}
								</ToggleGroup>
							</TooltipProvider>
						)}
					</form.Field>
				</div>

				<Separator />

				{/* Metadata section with editable label-value table */}
				<div className="flex flex-col gap-3">
					<h2>Record Metadata</h2>

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
								<TableCell className="font-medium">URL</TableCell>
								<TableCell>
									<form.Field
										name="url"
										validators={{
											onChange: z
												.string()
												.url('Must be a valid URL')
												.or(z.string().length(0))
												.optional()
												.nullable(),
										}}
									>
										{(field) => (
											<>
												<GhostInput
													id="url"
													className="w-full"
													value={field.state.value ?? ''}
													placeholder="https://example.com"
													onChange={(e) => field.handleChange(e.target.value)}
												/>
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
								<TableCell className="font-medium">Avatar URL</TableCell>
								<TableCell>
									<form.Field
										name="avatarUrl"
										validators={{
											onChange: z
												.string()
												.url('Must be a valid URL')
												.or(z.string().length(0))
												.optional()
												.nullable(),
										}}
									>
										{(field) => (
											<>
												<GhostInput
													id="avatarUrl"
													className="w-full"
													value={field.state.value ?? ''}
													placeholder="https://example.com/image.jpg"
													onChange={(e) => field.handleChange(e.target.value)}
												/>
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
								<TableCell className="font-medium">Abbreviation</TableCell>
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
								<TableCell className="font-medium">Sense</TableCell>
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

				<Separator />

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
				<Separator />
				<div className="flex flex-col gap-4">
					<h2>Settings</h2>
					{/* Toggle switches */}
					<div className="flex justify-between">
						<form.Field name="isIndexNode">
							{(field) => (
								<BooleanSwitch
									label="In Index"
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

					{/* Rating slider */}
					<form.Field name="rating">
						{(field) => (
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="rating">Rating</Label>
									<span className="text-sm font-medium">{field.state.value}</span>
								</div>
								<Slider
									id="rating"
									min={-2}
									max={2}
									step={1}
									value={[field.state.value ?? 0]}
									onValueChange={(values: number[]) => field.handleChange(values[0])}
								/>
								<div className="flex justify-between font-mono text-xs text-muted-foreground">
									<pre>-2 </pre>
									<pre>-1 </pre>
									<pre> 0 </pre>
									<pre> 1 </pre>
									<pre> 2 </pre>
								</div>
							</div>
						)}
					</form.Field>
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
							<Button type="submit" disabled={!canSubmit || isSubmitting}>
								{isSubmitting ? 'Saving...' : 'Save Changes'}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
