import { useEffect, useRef } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { RecordSelectSchema, type RecordSelect } from '@/server/db/schema/records';
import { Button, CheckboxWithLabel, Input, Textarea } from '@/components';

type RecordEntryFormProps = {
	recordId: string | number;
	defaults?: Partial<RecordSelect>;
	updateCallback?: (data: RecordSelect) => Promise<void>;
};

const MarkdownTextArea = ({
	label,
	value,
	onChange,
	rows = 4,
}: {
	label: string;
	value: string | null;
	onChange: (value: string) => void;
	rows?: number;
}) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Auto-resize textarea based on content
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const adjustHeight = () => {
			textarea.style.height = 'auto';
			textarea.style.height = `${textarea.scrollHeight}px`;
		};

		adjustHeight();
		// Also adjust on window resize in case text reflows
		window.addEventListener('resize', adjustHeight);
		return () => window.removeEventListener('resize', adjustHeight);
	}, [value]);

	// Handle special key combinations for markdown editing
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Auto-close markdown syntax pairs
		const pairs: Record<string, string> = {
			'*': '*',
			_: '_',
			'`': '`',
			'[': ']',
		};

		if (e.key in pairs && !e.ctrlKey && !e.metaKey) {
			const target = e.currentTarget;
			const start = target.selectionStart;
			const end = target.selectionEnd;

			// Only auto-close if text is selected or we're not inside a word
			const isSelection = start !== end;
			const isWordBoundary = !value?.[start]?.match(/\w/);

			if (isSelection || isWordBoundary) {
				e.preventDefault();
				const selectedText = value?.slice(start, end) || '';
				const newValue =
					(value?.slice(0, start) || '') +
					e.key +
					selectedText +
					pairs[e.key] +
					(value?.slice(end) || '');
				onChange(newValue);
				// Reset cursor position after React re-renders
				requestAnimationFrame(() => {
					if (isSelection) {
						target.selectionStart = start + 1;
						target.selectionEnd = end + 1;
					} else {
						target.selectionStart = target.selectionEnd = start + 1;
					}
				});
			}
		}
	};

	return (
		<label className="flex flex-col gap-1">
			<span className="text-rcr-secondary">{label}</span>
			<Textarea
				ref={textareaRef}
				rows={rows}
				value={value || ''}
				onChange={(e) => {
					onChange(e.target.value);
					// Ensure height is adjusted on every change
					e.currentTarget.style.height = 'auto';
					e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
				}}
				onKeyDown={handleKeyDown}
				className="min-h-[theme(spacing.24)] resize-none overflow-hidden font-mono text-xs leading-relaxed tracking-tight"
				placeholder={`Enter ${label.toLowerCase()} using markdown formatting...`}
			/>
		</label>
	);
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
			utils.records.getQueue.invalidate();
			utils.records.getQueueCount.invalidate();
			utils.records.search.invalidate();

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
		<form
			className="flex flex-col gap-3 text-sm"
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
							<span className="text-rcr-secondary">Title</span>
							<Input
								type="text"
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>

				{/* Summary TextArea with Markdown Support */}
				<form.Field name="summary">
					{(field) => (
						<MarkdownTextArea
							label="Summary"
							value={field.state.value}
							onChange={field.handleChange}
							rows={2}
						/>
					)}
				</form.Field>

				{/* Content TextArea with Markdown Support */}
				<form.Field name="content">
					{(field) => (
						<MarkdownTextArea
							label="Content"
							value={field.state.value}
							onChange={field.handleChange}
							rows={4}
						/>
					)}
				</form.Field>

				{/* Notes TextArea with Markdown Support */}
				<form.Field name="notes">
					{(field) => (
						<MarkdownTextArea
							label="Notes"
							value={field.state.value}
							onChange={field.handleChange}
							rows={2}
						/>
					)}
				</form.Field>

				{/* Media Caption with Markdown Support */}
				<form.Field name="mediaCaption">
					{(field) => (
						<MarkdownTextArea
							label="Media Caption"
							value={field.state.value}
							onChange={field.handleChange}
							rows={2}
						/>
					)}
				</form.Field>

				{/* URL Text Field */}
				<form.Field name="url">
					{(field) => (
						<label className="flex flex-col gap-1">
							<span className="text-rcr-secondary">URL</span>
							<Input
								type="url"
								placeholder="https://example.com"
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>

				{/* Checkboxes for "private" and "needsCuration" */}
				<div className="mt-2 flex flex-wrap gap-4">
					<form.Field name="isPrivate">
						{(field) => (
							<CheckboxWithLabel
								label="Private"
								checked={field.state.value || false}
								onCheckedChange={(checked) => field.handleChange(!!checked)}
							/>
						)}
					</form.Field>
					<form.Field name="curatedAt">
						{(field) => (
							<Button variant="outline" onClick={() => field.handleChange(new Date())}>
								Mark as Curated
							</Button>
						)}
					</form.Field>
				</div>
			</div>

			{/* Form submit button */}
			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
				{([canSubmit, isSubmitting]) => (
					<div className="mt-4 border-t border-rcr-divider pt-4">
						<Button type="submit" disabled={!canSubmit}>
							{isSubmitting ? '...Saving' : 'Save Changes'}
						</Button>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
};
