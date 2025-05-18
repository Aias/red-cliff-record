import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { SaveIcon, Trash2Icon } from 'lucide-react';
import { z } from 'zod';
import { RecordTypeSchema, type RecordType } from '@/server/db/schema';
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
	BooleanSwitch,
	Button,
	DynamicTextarea,
	ExternalLink,
	GhostInput,
        IntegrationLogo,
        Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Slider,
	Spinner,
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
import { cn } from '@/lib/utils';
import { MetadataSection } from './MetadataSection';
import { MediaSection } from './MediaSection';
import { ContentSection } from './ContentSection';
import { useRecordForm } from './use-record-form';

interface RecordFormProps extends React.HTMLAttributes<HTMLFormElement> {
	recordId: number;
	onFinalize: () => void;
	onDelete: () => void;
}


export function RecordForm({
	recordId,
	onFinalize,
	onDelete,
	className,
	...props
}: RecordFormProps) {
	const navigate = useNavigate();
	const params = useParams({ from: '/records/$recordId' });
	const urlRecordId = useMemo(() => Number(params.recordId), [params.recordId]);
        const { form, record, isLoading, isError } = useRecordForm(recordId);

	const curateAndNextHandler = useCallback(
		async (e: React.KeyboardEvent<HTMLFormElement>) => {
			e.preventDefault();
			await form.handleSubmit();
			onFinalize();
		},
		[form, onFinalize]
	);

	if (isLoading || !record) return <Spinner />;
	if (isError) return <div>Error loading record</div>;

	return (
		<form
			key={recordId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			onClickCapture={(e) => {
				if (!isNaN(urlRecordId) && urlRecordId !== recordId) {
					e.stopPropagation();
					navigate({
						to: '/records/$recordId',
						params: { recordId: recordId.toString() },
						search: true,
					});
				}
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					(document.activeElement as HTMLElement)?.blur();
				}

				if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'Enter' || e.key === 'Return')) {
					curateAndNextHandler(e);
				}
			}}
			className={cn('flex flex-col', className)}
			{...props}
		>
			<div className="flex flex-col gap-4">
				<h1 className="flex items-center gap-3">
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
			</div>

			<div className="mt-4 flex flex-col gap-3">
				<div className="flex gap-4">
					<h2 className="grow-1">Content</h2>
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
        <ContentSection form={form} />
        <MediaSection recordId={recordId} form={form} />
			</div>
			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
				{([canSubmit, isSubmitting]) => (
					<div className="order-first -mt-1 mb-3 flex items-center border-b border-c-divider pb-1">
						<Popover>
							<PopoverTrigger asChild>
								<Avatar
									src={record.avatarUrl ?? undefined}
									fallback={(record.title?.charAt(0) ?? record.type.charAt(0)).toUpperCase()}
									className="mr-2 cursor-pointer"
								/>
							</PopoverTrigger>
							<PopoverContent className="min-w-84">
								<MetadataSection record={record} />
							</PopoverContent>
						</Popover>
						<Link
							to="/records/$recordId"
							params={{ recordId: recordId.toString() }}
							search={true}
							className="mr-auto truncate font-mono text-sm text-c-secondary capitalize"
						>
							{`${record.type} #${record.id}, ${record.recordCreatedAt.toLocaleString()}`}
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
