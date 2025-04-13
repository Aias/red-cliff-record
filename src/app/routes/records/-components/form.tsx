import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import {
	MediaSelectSchema,
	RecordInsertSchema,
	RecordTypeSchema,
	type MediaSelect,
	type RecordInsert,
	type RecordType,
} from '@/server/db/schema';
import { recordTypeIcons } from './type-icons';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Avatar,
	DynamicTextarea,
	ExternalLink,
	GhostInput,
	MetadataList,
} from '@/components';
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
	TableRow,
	ToggleGroup,
	ToggleGroupItem,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components';
import MediaGrid from '@/components/media-grid';
import { MediaUpload } from '@/components/media-upload';
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
	nextRecordId?: number;
}

// Helper function to read file as base64
const readFileAsBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			// Result is Data URL (e.g., "data:image/png;base64,iVBOR..."), remove prefix
			const base64String = (reader.result as string).split(',')[1];
			if (base64String) {
				resolve(base64String);
			} else {
				reject(new Error('Failed to read file as base64: result is empty'));
			}
		};
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(file);
	});
};

export function RecordForm({ recordId, nextRecordId }: RecordFormProps) {
	const navigate = useNavigate();
	const utils = trpc.useUtils();
	const [record] = trpc.records.get.useSuspenseQuery(recordId);
	const mediaCaptionRef = useRef<HTMLTextAreaElement>(null);
	const mediaUploadRef = useRef<HTMLDivElement>(null);

	const recordFormData: RecordInsert & { media: MediaSelect[] } = useMemo(() => {
		return { ...record };
	}, [record]);

	const updateMutation = trpc.records.upsert.useMutation({
		onSuccess: () => {
			utils.records.invalidate();
			embedMutation.mutate(recordId);
		},
	});

	const embedMutation = trpc.records.embed.useMutation({
		onSuccess: (record) => {
			utils.records.get.invalidate(record.id);
			utils.records.similaritySearch.invalidate();
		},
	});

	const deleteMutation = trpc.records.delete.useMutation({
		onSuccess: () => {
			navigate({ to: '/records', search: true });
			utils.records.invalidate();
		},
	});

	const deleteMediaMutation = trpc.media.delete.useMutation({
		onSuccess: (_data, variables) => {
			const deletedMediaIds = new Set(variables);
			const updatedMedia =
				form.getFieldValue('media')?.filter((m) => !deletedMediaIds.has(m.id)) ?? [];
			form.setFieldValue('media', updatedMedia);

			if (updatedMedia.length === 0) {
				setTimeout(() => {
					mediaUploadRef.current?.focus();
				}, 0);
			}
		},
	});

	const createMediaMutation = trpc.media.create.useMutation({
		onSuccess: (createdMedia) => {
			if (createdMedia) {
				form.setFieldValue('media', [...(form.getFieldValue('media') ?? []), createdMedia]);
				setTimeout(() => {
					mediaCaptionRef.current?.focus();
				}, 0);
			}
		},
		onError: (error) => {
			console.error('Media upload failed:', error);
		},
	});

	const form = useForm({
		defaultValues: {
			...recordFormData,
		},
		onSubmit: async ({ value }) => {
			const {
				title,
				url,
				avatarUrl,
				abbreviation,
				sense,
				summary,
				content,
				notes,
				mediaCaption,
				...rest
			} = value;
			await updateMutation.mutateAsync({
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
			onSubmit: RecordInsertSchema.extend({
				media: z.array(MediaSelectSchema),
			}),
		},
	});

	const curateAndNextHandler = useCallback(
		async (e?: React.KeyboardEvent<HTMLFormElement>) => {
			if (e) {
				e.preventDefault();
			}

			form.setFieldValue('isCurated', true);

			await form.handleSubmit();

			if (nextRecordId) {
				navigate({
					to: '/records/$recordId',
					params: { recordId: nextRecordId.toString() },
					search: true,
				});
			}
		},
		[form, navigate, nextRecordId]
	);

	useEffect(() => {
		form.reset({
			...record,
		});
	}, [recordId, record, form]);

	const { sources } = useMemo(() => record, [record]);

	return (
		<form
			key={recordId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					(document.activeElement as HTMLElement)?.blur();
				}

				if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'Enter' || e.key === 'Return')) {
					curateAndNextHandler(e);
				}
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

			<div className="@container">
				<form.Field name="type">
					{(field) => (
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
					)}
				</form.Field>
			</div>

			<form.Field name="rating">
				{(field) => (
					<div className="mx-5 mb-1.5 flex flex-col gap-3">
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

			<div className="rounded-md border border-border">
				<Table>
					<TableBody>
						<TableRow>
							<TableCell className="w-20">
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

						<TableRow>
							<TableCell className="w-20">
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

						<TableRow>
							<TableCell className="w-20">
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

						<TableRow>
							<TableCell className="w-20">
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

			<div className="flex flex-col gap-3">
				<h2>Content</h2>

				<form.Field name="summary">
					{(field) => (
						<div className="flex flex-col gap-1">
							<Label htmlFor="summary">Summary</Label>
							<DynamicTextarea
								id="summary"
								value={field.state.value ?? ''}
								placeholder="A brief summary of this record"
								onChange={(e) => field.handleChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										form.handleSubmit();
									}
								}}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="content">
					{(field) => (
						<div className="flex flex-col gap-1">
							<Label htmlFor="content">Content</Label>
							<DynamicTextarea
								id="content"
								value={field.state.value ?? ''}
								placeholder="Main content"
								onChange={(e) => field.handleChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										form.handleSubmit();
									}
								}}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="notes">
					{(field) => (
						<div className="flex flex-col gap-1">
							<Label htmlFor="notes">Notes</Label>
							<DynamicTextarea
								id="notes"
								value={field.state.value ?? ''}
								placeholder="Additional notes"
								onChange={(e) => field.handleChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										form.handleSubmit();
									}
								}}
							/>
						</div>
					)}
				</form.Field>
			</div>

			<form.Field name="media">
				{(field) =>
					field.state.value && field.state.value.length > 0 ? (
						<>
							<Separator />
							<div className="flex flex-col gap-3">
								<h2>Media</h2>
								<MediaGrid
									media={field.state.value}
									onDelete={(media) => deleteMediaMutation.mutateAsync([media.id])}
								/>

								<form.Field name="mediaCaption">
									{(captionField) => (
										<div className="flex flex-col gap-1">
											<Label htmlFor="mediaCaption">Caption</Label>
											<DynamicTextarea
												ref={mediaCaptionRef}
												id="mediaCaption"
												value={captionField.state.value ?? ''}
												placeholder="Media caption"
												onChange={(e) => captionField.handleChange(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && !e.shiftKey) {
														e.preventDefault();
														form.handleSubmit();
													}
												}}
											/>
										</div>
									)}
								</form.Field>
							</div>
						</>
					) : (
						<>
							<Separator />
							<div className="flex flex-col gap-3">
								<h2>Media</h2>
								<MediaUpload
									ref={mediaUploadRef}
									onUpload={async (file) => {
										try {
											const fileData = await readFileAsBase64(file);
											await createMediaMutation.mutateAsync({
												recordId,
												fileData,
												fileName: file.name,
												fileType: file.type,
											});
										} catch (error) {
											console.error('Error processing or uploading file:', error);
										}
									}}
								/>
							</div>
						</>
					)
				}
			</form.Field>

			<div className="flex flex-col gap-3">
				<h2>Metadata</h2>
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
				<MetadataList
					metadata={{
						ID: record.id,
						Created: record.recordCreatedAt,
						Updated: record.recordUpdatedAt,
						'Has Embedding': record.textEmbedding ? 'Yes' : 'No',
						'Content Created': record.contentCreatedAt,
						'Content Updated': record.contentUpdatedAt,
					}}
				/>
			</div>

			<Separator />

			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
				{([canSubmit, isSubmitting]) => (
					<div className="flex gap-2">
						<span className="grow-1">
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="outline" type="button">
										<Trash2Icon />
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete this record.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<Button variant="destructive" asChild>
											<AlertDialogAction
												onClick={async () => {
													await deleteMutation.mutateAsync([recordId]);
												}}
											>
												Continue
											</AlertDialogAction>
										</Button>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</span>
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
						<Button
							variant="default"
							className="themed"
							type="submit"
							disabled={!canSubmit || isSubmitting}
						>
							{isSubmitting ? 'Saving...' : 'Save Changes'}
						</Button>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
}
