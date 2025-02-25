import { useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { RecordInsertSchema, RecordTypeSchema, type RecordType } from '@/server/db/schema';
import { trpc } from '../trpc';
import { Avatar, Badge, DynamicTextarea, GhostInput, MetadataList } from '@/components';
import {
	Button,
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
import {
	ArtifactIcon,
	ConceptIcon,
	EntityIcon,
	EventIcon,
	PlaceIcon,
	SystemIcon,
} from '@/components/icons';
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
			id: record.id,
			title: record.title ?? '',
			type: record.type,
			summary: record.summary ?? '',
			content: record.content ?? '',
			notes: record.notes ?? '',
			url: record.url ?? '',
			avatarUrl: record.avatarUrl ?? '',
			abbreviation: record.abbreviation ?? '',
			sense: record.sense ?? '',
			mediaCaption: record.mediaCaption ?? '',
			isIndexNode: record.isIndexNode ?? false,
			isFormat: record.isFormat ?? false,
			isPrivate: record.isPrivate ?? false,
			needsCuration: record.needsCuration ?? false,
			rating: record.rating ?? 0,
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
	const { media, children, parent, creators, format } = useMemo(() => record, [record]);

	// Map record types to their corresponding icons and descriptions
	const typeIcons = {
		entity: { icon: EntityIcon, description: 'An actor in the world, has will' },
		concept: { icon: ConceptIcon, description: 'A category, idea, or abstraction' },
		artifact: { icon: ArtifactIcon, description: 'Physical or digital objects, content, or media' },
		event: { icon: EventIcon, description: 'An event or occurrence' },
		place: { icon: PlaceIcon, description: 'A geographic location' },
		system: { icon: SystemIcon, description: 'A physical or conceptual system or network' },
	};

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
				{/* Single card containing all sections */}
				{/* Header section with title and avatar */}
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
									className="justify-start"
								>
									{RecordTypeSchema.options.map((type) => {
										const { icon: Icon, description } = typeIcons[type as keyof typeof typeIcons];
										return (
											<Tooltip key={type}>
												<TooltipTrigger asChild>
													<ToggleGroupItem
														value={type}
														aria-label={type}
														data-state={field.state.value === type ? 'on' : 'off'}
													>
														<Icon className="mr-1 size-4" />
														<span className="capitalize">{type}</span>
													</ToggleGroupItem>
												</TooltipTrigger>
												<TooltipContent>
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
					<h2 className="text-xl font-semibold">Record Metadata</h2>

					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-1/3">Field</TableHead>
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
					<h2 className="text-xl font-semibold">Content</h2>

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
									className="min-h-20"
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
									className="min-h-32"
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
									className="min-h-20"
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
							<h2 className="text-xl font-semibold">Media</h2>
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

				{/* Related records section */}
				{(parent || children?.length > 0 || format || creators?.length > 0) && (
					<>
						<Separator />
						<div className="flex flex-col gap-3">
							<h2 className="text-xl font-semibold">Related Records</h2>

							{/* Parent record */}
							{parent && (
								<div className="flex flex-col gap-1">
									<Label>Parent</Label>
									<div className="flex items-center gap-2 rounded-md border border-input p-2">
										{parent.avatarUrl && (
											<Avatar
												inline
												className="!size-6"
												src={parent.avatarUrl}
												fallback={parent.title?.charAt(0) ?? '?'}
											/>
										)}
										<span>{parent.title}</span>
									</div>
								</div>
							)}

							{/* Format */}
							{format && (
								<div className="flex flex-col gap-1">
									<Label>Format</Label>
									<div className="flex items-center gap-2 rounded-md border border-input p-2">
										{format.avatarUrl && (
											<Avatar
												inline
												className="!size-6"
												src={format.avatarUrl}
												fallback={format.title?.charAt(0) ?? '?'}
											/>
										)}
										<span>{format.title}</span>
									</div>
								</div>
							)}

							{/* Child records */}
							{children && children.length > 0 && (
								<div className="flex flex-col gap-1">
									<Label>Children ({children.length})</Label>
									<div className="flex flex-wrap gap-2">
										{children.slice(0, 5).map((child) => (
											<Badge key={child.id} variant="outline">
												{child.title || 'Untitled'}
											</Badge>
										))}
										{children.length > 5 && (
											<Badge variant="outline">+{children.length - 5} more</Badge>
										)}
									</div>
								</div>
							)}

							{/* Creators */}
							{creators && creators.length > 0 && (
								<div className="flex flex-col gap-1">
									<Label>Creators ({creators.length})</Label>
									<div className="flex flex-wrap gap-2">
										{creators.map((creatorRel) => (
											<Badge key={creatorRel.id} variant="outline">
												{creatorRel.creator.title || 'Untitled'}
												<span className="ml-1 text-muted-foreground">
													({creatorRel.creatorRole})
												</span>
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>
					</>
				)}

				{/* Settings section */}
				<Separator />
				<div className="flex flex-col gap-3">
					<h2 className="text-xl font-semibold">Settings</h2>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{/* Toggle switches */}
						<div className="flex flex-col gap-3">
							<form.Field name="isIndexNode">
								{(field) => (
									<div className="flex items-center justify-between">
										<Label htmlFor="isIndexNode" className="cursor-pointer">
											Is Index Node
										</Label>
										<Switch
											id="isIndexNode"
											checked={field.state.value}
											onCheckedChange={field.handleChange}
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="isFormat">
								{(field) => (
									<div className="flex items-center justify-between">
										<Label htmlFor="isFormat" className="cursor-pointer">
											Is Format
										</Label>
										<Switch
											id="isFormat"
											checked={field.state.value}
											onCheckedChange={field.handleChange}
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="isPrivate">
								{(field) => (
									<div className="flex items-center justify-between">
										<Label htmlFor="isPrivate" className="cursor-pointer">
											Is Private
										</Label>
										<Switch
											id="isPrivate"
											checked={field.state.value}
											onCheckedChange={field.handleChange}
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="needsCuration">
								{(field) => (
									<div className="flex items-center justify-between">
										<Label htmlFor="needsCuration" className="cursor-pointer">
											Needs Curation
										</Label>
										<Switch
											id="needsCuration"
											checked={field.state.value}
											onCheckedChange={field.handleChange}
										/>
									</div>
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
									<div className="flex justify-between text-xs text-muted-foreground">
										<span>-2</span>
										<span>-1</span>
										<span>0</span>
										<span>1</span>
										<span>2</span>
									</div>
								</div>
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
							ID: record.id.toString(),
							Created: record.recordCreatedAt?.toLocaleString(),
							Updated: record.recordUpdatedAt?.toLocaleString(),
							'Content Created': record.contentCreatedAt?.toLocaleString(),
							'Content Updated': record.contentUpdatedAt?.toLocaleString(),
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
