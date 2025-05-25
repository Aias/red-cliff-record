import { memo } from 'react';
import type { ReactFormApi } from '@tanstack/react-form';
import { z } from 'zod/v4';
import type { RecordGet } from '@/server/api/routers/types';
import { RecordTypeSchema, type RecordType } from '@/server/db/schema';
import { recordTypeIcons } from './type-icons';
import { ExternalLink } from '@/components/external-link';
import { GhostInput } from '@/components/ghost-input';
import { IntegrationLogo } from '@/components/integration-logo';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type RecordFormInstance = ReactFormApi<
	RecordGet,
	unknown,
	unknown,
	unknown,
	unknown,
	unknown,
	unknown,
	unknown,
	unknown,
	void
>;

interface RecordFormHeaderProps {
	form: RecordFormInstance;
	onChange: () => void;
}

export const RecordFormHeader = memo(({ form, onChange }: RecordFormHeaderProps) => {
	return (
		<div className="flex flex-col gap-4">
			<h1 className="flex items-center gap-3">
				<form.Field name="title">
					{(field) => (
						<div className="grow-1">
							<GhostInput
								value={field.state.value ?? ''}
								placeholder="Untitled Record"
								onChange={(e) => {
									field.handleChange(e.target.value);
									onChange();
								}}
								onBlur={() => onChange()}
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
								if (value) {
									field.handleChange(value as RecordType);
									onChange();
								}
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
							onValueChange={(values) => {
								field.handleChange(values[0] ?? 0);
								onChange();
							}}
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
													onChange={(e) => {
														field.handleChange(e.target.value);
														onChange();
													}}
													onBlur={() => onChange()}
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
													onChange={(e) => {
														field.handleChange(e.target.value);
														onChange();
													}}
													onBlur={() => onChange()}
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
											onChange={(e) => {
												field.handleChange(e.target.value);
												onChange();
											}}
											onBlur={() => onChange()}
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
											onChange={(e) => {
												field.handleChange(e.target.value);
												onChange();
											}}
											onBlur={() => onChange()}
										/>
									)}
								</form.Field>
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>
		</div>
	);
});
