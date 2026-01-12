import { useCallback, useEffect, useRef } from 'react';
import { RecordInsertSchema, RecordTypeSchema, type RecordType } from '@aias/hozo';
import { useForm } from '@tanstack/react-form';
import { Link, useRouterState } from '@tanstack/react-router';
import { SaveIcon, Trash2Icon } from 'lucide-react';
import { z } from 'zod';
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
} from '@/components/alert-dialog';
import { Avatar } from '@/components/avatar';
import { BooleanSwitch } from '@/components/boolean-switch';
import { Button } from '@/components/button';
import { DynamicTextarea } from '@/components/dynamic-textarea';
import { ExternalLink } from '@/components/external-link';
import { GhostInput } from '@/components/ghost-input';
import { IntegrationLogo } from '@/components/integration-logo';
import { Label } from '@/components/label';
import MediaGrid from '@/components/media-grid';
import { MediaUpload } from '@/components/media-upload';
import { MetadataList } from '@/components/metadata-list';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import { Separator } from '@/components/separator';
import { Slider } from '@/components/slider';
import { Spinner } from '@/components/spinner';
import { Table, TableBody, TableCell, TableRow } from '@/components/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip';
import { useDeleteMedia } from '@/lib/hooks/media-mutations';
import { useUpsertRecord } from '@/lib/hooks/record-mutations';
import { useRecord } from '@/lib/hooks/record-queries';
import { useRecordUpload } from '@/lib/hooks/use-record-upload';
import { cn } from '@/lib/utils';
import type { RecordGet } from '@/shared/types';

interface RecordFormProps extends React.HTMLAttributes<HTMLFormElement> {
	recordId: number;
	onFinalize: () => void;
	onDelete: () => void;
}

function getErrorMessage(error: unknown): string {
	if (typeof error === 'string') return error;
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message;
	}
	return String(error);
}

const MetadataSection = ({ record }: { record: RecordGet }) => {
	return (
		<div className="flex flex-col gap-3">
			<h2>Record Metadata</h2>
			<MetadataList
				metadata={{
					ID: record.id,
					Slug: record.slug,
					Created: record.recordCreatedAt,
					Updated: record.recordUpdatedAt,
					'Content Created': record.contentCreatedAt,
					'Content Updated': record.contentUpdatedAt,
				}}
			/>
		</div>
	);
};

const defaultData: RecordGet = {
	id: 0,
	slug: null,
	type: 'artifact',
	title: null,
	sense: null,
	abbreviation: null,
	url: null,
	avatarUrl: null,
	summary: null,
	content: null,
	notes: null,
	mediaCaption: null,
	isCurated: false,
	isPrivate: false,
	rating: 0,
	reminderAt: null,
	sources: [],
	media: [],
	recordCreatedAt: new Date(),
	recordUpdatedAt: new Date(),
	contentCreatedAt: new Date(),
	contentUpdatedAt: new Date(),
} as const;

export function RecordForm({
	recordId,
	onFinalize,
	onDelete,
	className,
	...props
}: RecordFormProps) {
	const routerState = useRouterState({ select: (s) => s.location.state });
	const { data: record, isLoading, isError } = useRecord(recordId);

	const titleInputRef = useRef<HTMLInputElement>(null);
	const mediaCaptionRef = useRef<HTMLTextAreaElement>(null);
	const mediaUploadRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Auto-focus title input when navigating with focusForm state
	const shouldFocus = routerState?.focusForm;

	useEffect(() => {
		if (shouldFocus && !isLoading && titleInputRef.current) {
			// Use double rAF to ensure DOM is ready after loading state clears
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					titleInputRef.current?.focus();
				});
			});
		}
	}, [shouldFocus, isLoading]);

	const formData = record ?? defaultData;
	const isFormLoading = isLoading || !record;

	const updateMutation = useUpsertRecord();
	const deleteMediaMutation = useDeleteMedia();
	const { uploadFile, isUploading } = useRecordUpload(recordId);

	const form = useForm({
		defaultValues: formData,
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
			onSubmit: ({ value }) => {
				const parsed = RecordInsertSchema.safeParse(value);
				if (!parsed.success) {
					const flat = z.flattenError(parsed.error);
					return {
						formError: flat.formErrors.join(', '),
						fieldErrors: flat.fieldErrors,
					};
				}
				return undefined;
			},
		},
	});

	useEffect(() => {
		if (record) {
			form.setFieldValue('media', record.media ?? [], {
				dontUpdateMeta: true,
			});
		}
	}, [record, form]);

	// Auto-save functionality
	const debouncedSave = useCallback(() => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = setTimeout(() => {
			void form.handleSubmit();
		}, 1000); // Save after 1 second of inactivity
	}, [form]);

	const immediateSave = useCallback(async () => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		await form.handleSubmit();
	}, [form]);

	// Save immediately before navigation or form blur
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (saveTimeoutRef.current) {
				// Note: beforeunload can't wait for async operations, so we trigger it but can't guarantee completion
				void immediateSave();
			}
		};

		// Save when navigating away or closing
		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, [immediateSave]);

	const curateAndNextHandler = useCallback(
		async (e: React.KeyboardEvent<HTMLFormElement>) => {
			e.preventDefault();
			// Set curated flag before saving to avoid race condition with bulkUpsert
			form.setFieldValue('isCurated', true);
			// Save immediately before navigation and wait for completion
			await immediateSave();
			// Navigate after save completes
			onFinalize();
		},
		[form, immediateSave, onFinalize]
	);

	// Form-level paste handler for media uploads
	// Works regardless of whether MediaUpload component is visible
	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLFormElement>) => {
			if (isUploading) return;

			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (
					item.kind === 'file' &&
					(item.type.startsWith('image/') || item.type.startsWith('video/'))
				) {
					const file = item.getAsFile();
					if (file) {
						e.preventDefault();
						void uploadFile(file);
						return;
					}
				}
			}
		},
		[uploadFile, isUploading]
	);

	if (isError) return <div>Error loading record</div>;

	return (
		<form
			ref={formRef}
			key={recordId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				void form.handleSubmit();
			}}
			onBlur={(e) => {
				// If focus is leaving the form entirely, save immediately
				if (!e.currentTarget.contains(e.relatedTarget as Node)) {
					void immediateSave();
				}
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					(document.activeElement as HTMLElement)?.blur();
				}

				if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'Enter' || e.key === 'Return')) {
					void curateAndNextHandler(e);
				}
			}}
			onPaste={handlePaste}
			className={cn('relative flex flex-col', className)}
			{...props}
		>
			{isFormLoading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-c-app/50 backdrop-blur-sm">
					<Spinner />
				</div>
			)}
			<div className="flex flex-col gap-4">
				<h1 className="flex items-center gap-3">
					<form.Field name="title">
						{(field) => (
							<div className="grow">
								<GhostInput
									ref={titleInputRef}
									value={field.state.value ?? ''}
									placeholder="Untitled Record"
									onChange={(e) => {
										field.handleChange(e.target.value);
										debouncedSave();
									}}
									onBlur={() => debouncedSave()}
									readOnly={isFormLoading}
									className="text-c-display"
								/>
								{field.state.meta.errors && (
									<p className="text-sm text-c-destructive">
										{field.state.meta.errors.map(getErrorMessage).join(', ')}
									</p>
								)}
							</div>
						)}
					</form.Field>
					<form.Field name="sources">
						{(field) => (
							<div className="flex items-center gap-2">
								{field.state.value &&
									field.state.value.length > 0 &&
									field.state.value.map((source) => (
										<IntegrationLogo key={source} integration={source} className="text-base" />
									))}
							</div>
						)}
					</form.Field>
				</h1>

				<div className="@container">
					<form.Field name="type">
						{(field) => (
							<ToggleGroup
								type="single"
								value={field.state.value}
								onValueChange={(value) => {
									if (value) {
										field.handleChange(value as RecordType);
										debouncedSave();
									}
								}}
								variant="outline"
								className="w-full"
								disabled={isFormLoading}
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
													className="flex grow items-center gap-1"
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
							<div className="flex items-center justify-between text-xs text-c-secondary">
								<Label htmlFor="rating" className="inline-flex w-0 justify-center">
									Rating
								</Label>
								<span className="inline-flex w-0 justify-center text-[0.875em]">⭐</span>
								<span className="inline-flex w-0 justify-center text-[0.875em]">⭐⭐</span>
								<span className="inline-flex w-0 justify-center text-[0.875em]">⭐⭐⭐</span>
							</div>
							<Slider
								id="rating"
								min={0}
								max={3}
								step={1}
								value={[field.state.value ?? 0]}
								onValueChange={(values) => {
									field.handleChange(values[0] ?? 0);
									debouncedSave();
								}}
								disabled={isFormLoading}
							/>
						</div>
					)}
				</form.Field>

				<div className="rounded-md border border-c-divider">
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
											onChange: z.url().or(z.string().length(0)).nullable(),
										}}
									>
										{(field) => (
											<>
												<div className="flex items-center gap-1">
													<GhostInput
														id="url"
														className="w-full text-c-display"
														value={field.state.value ?? ''}
														placeholder="https://example.com"
														onChange={(e) => {
															field.handleChange(e.target.value);
															debouncedSave();
														}}
														onBlur={() => debouncedSave()}
														readOnly={isFormLoading}
													/>
													{field.state.value && (
														<ExternalLink href={field.state.value} children={null} />
													)}
												</div>
												{field.state.meta.errors && (
													<p className="text-sm text-c-destructive">
														{field.state.meta.errors.map(getErrorMessage).join(', ')}
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
											onChange: z.url().or(z.string().length(0)).nullable(),
										}}
									>
										{(field) => (
											<>
												<div className="flex items-center gap-1">
													<GhostInput
														id="avatarUrl"
														className="w-full text-c-display"
														value={field.state.value ?? ''}
														placeholder="https://example.com/image.jpg"
														onChange={(e) => {
															field.handleChange(e.target.value);
															debouncedSave();
														}}
														onBlur={() => debouncedSave()}
														readOnly={isFormLoading}
													/>
													{field.state.value && (
														<ExternalLink href={field.state.value} children={null} />
													)}
												</div>
												{field.state.meta.errors && (
													<p className="text-sm text-c-destructive">
														{field.state.meta.errors.map(getErrorMessage).join(', ')}
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
												className="w-full text-c-display"
												value={field.state.value ?? ''}
												placeholder="Short form"
												onChange={(e) => {
													field.handleChange(e.target.value);
													debouncedSave();
												}}
												onBlur={() => debouncedSave()}
												readOnly={isFormLoading}
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
												className="w-full text-c-display"
												value={field.state.value ?? ''}
												placeholder="Meaning or definition"
												onChange={(e) => {
													field.handleChange(e.target.value);
													debouncedSave();
												}}
												onBlur={() => debouncedSave()}
												readOnly={isFormLoading}
											/>
										)}
									</form.Field>
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</div>
			</div>

			<div className="mt-4 flex flex-col gap-3">
				<div className="flex gap-4">
					<h2 className="grow">Content</h2>
					<form.Field name="isPrivate">
						{(field) => (
							<BooleanSwitch
								label="Is Private"
								id="isPrivate"
								value={field.state.value}
								handleChange={(value) => {
									field.handleChange(value);
									debouncedSave();
								}}
								switchProps={{ disabled: isFormLoading }}
							/>
						)}
					</form.Field>

					<form.Field name="isCurated">
						{(field) => (
							<BooleanSwitch
								label="Is Curated"
								id="isCurated"
								value={field.state.value}
								handleChange={(value) => {
									field.handleChange(value);
									debouncedSave();
								}}
								switchProps={{ disabled: isFormLoading }}
							/>
						)}
					</form.Field>
				</div>

				<form.Field name="summary">
					{(field) => (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="summary">Summary</Label>
							<DynamicTextarea
								id="summary"
								value={field.state.value ?? ''}
								placeholder="A brief summary of this record"
								onChange={(e) => {
									field.handleChange(e.target.value);
									debouncedSave();
								}}
								onBlur={() => debouncedSave()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										void immediateSave();
									}
								}}
								disabled={isFormLoading}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="content">
					{(field) => (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="content">Content</Label>
							<DynamicTextarea
								id="content"
								value={field.state.value ?? ''}
								placeholder="Main content"
								onChange={(e) => {
									field.handleChange(e.target.value);
									debouncedSave();
								}}
								onBlur={() => debouncedSave()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										void immediateSave();
									}
								}}
								disabled={isFormLoading}
							/>
						</div>
					)}
				</form.Field>

				<form.Field name="media">
					{(field) =>
						field.state.value && field.state.value.length > 0 ? (
							<div className="flex flex-col gap-3">
								<MediaGrid
									media={field.state.value}
									onDelete={(media) => deleteMediaMutation.mutate([media.id])}
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
												onChange={(e) => {
													captionField.handleChange(e.target.value);
													debouncedSave();
												}}
												onBlur={() => debouncedSave()}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && !e.shiftKey) {
														e.preventDefault();
														void immediateSave();
													}
												}}
												disabled={isFormLoading}
											/>
										</div>
									)}
								</form.Field>
							</div>
						) : (
							<MediaUpload ref={mediaUploadRef} onUpload={uploadFile} />
						)
					}
				</form.Field>

				<Separator />

				<form.Field name="notes">
					{(field) => (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="notes">Notes</Label>
							<DynamicTextarea
								id="notes"
								value={field.state.value ?? ''}
								placeholder="Additional notes"
								onChange={(e) => {
									field.handleChange(e.target.value);
									debouncedSave();
								}}
								onBlur={() => debouncedSave()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										void immediateSave();
									}
								}}
								disabled={isFormLoading}
							/>
						</div>
					)}
				</form.Field>
			</div>
			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
				{([canSubmit, isSubmitting]) => (
					<div className="order-first -mt-1 mb-3 flex items-center border-b border-c-divider pb-1">
						<Popover>
							<PopoverTrigger asChild>
								<Avatar
									src={formData.avatarUrl ?? undefined}
									fallback={(formData.title?.charAt(0) ?? formData.type.charAt(0)).toUpperCase()}
									className="mr-2 cursor-pointer"
								/>
							</PopoverTrigger>
							<PopoverContent className="min-w-84">
								<MetadataSection record={formData} />
							</PopoverContent>
						</Popover>
						<Link
							to="/records/$recordId"
							params={{ recordId }}
							search={true}
							className="mr-auto truncate font-mono text-sm text-c-secondary capitalize"
						>
							{`${formData.type} #${formData.id}, ${formData.recordCreatedAt.toLocaleString()}`}
						</Link>
						<Button size="icon" variant="ghost" type="submit" disabled={!canSubmit || isSubmitting}>
							{isSubmitting ? <Spinner /> : <SaveIcon />}
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button size="icon" variant="ghost" type="button">
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
										<AlertDialogAction onClick={onDelete}>Continue</AlertDialogAction>
									</Button>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
}
