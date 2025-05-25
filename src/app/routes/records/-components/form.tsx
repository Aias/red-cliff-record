import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { RecordGet } from '@/server/api/routers/types';
import { RecordInsertSchema } from '@/server/db/schema';
import { ContentSection } from './content-section';
import { FormFooter } from './form-footer';
import { RecordFormHeader } from './form-header';
import { Spinner } from '@/components/spinner';
import { useAutosave } from '@/lib/hooks/use-autosave';
import { useRecordUpload } from '@/lib/hooks/use-record-upload';
import { useDeleteMedia, useRecord, useUpsertRecord } from '@/lib/hooks/use-records';
import { cn } from '@/lib/utils';

interface RecordFormProps extends React.HTMLAttributes<HTMLFormElement> {
	recordId: number;
	onFinalize: () => void;
	onDelete: () => void;
}

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
	const navigate = useNavigate();
	const params = useParams({ from: '/records/$recordId' });
	const urlRecordId = useMemo(() => Number(params.recordId), [params.recordId]);
	const { data: record, isLoading, isError } = useRecord(recordId);

	const mediaCaptionRef = useRef<HTMLTextAreaElement>(null);
	const mediaUploadRef = useRef<HTMLDivElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const deleteMediaMutation = useDeleteMedia();
	const { uploadFile } = useRecordUpload(recordId);

	const form = useForm({
		defaultValues: record ?? defaultData,
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
					return parsed.error.flatten().fieldErrors;
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
	}, [record?.media]);

	const { debouncedSave, immediateSave } = useAutosave(() => form.handleSubmit());

	const curateAndNextHandler = useCallback(
		async (e: React.KeyboardEvent<HTMLFormElement>) => {
			e.preventDefault();
			// Save immediately before navigation and wait for completion
			await immediateSave();
			// Navigate after save completes
			onFinalize();
		},
		[immediateSave, onFinalize]
	);

	if (isLoading || !record) return <Spinner />;
	if (isError) return <div>Error loading record</div>;

	return (
		<form
			ref={formRef}
			key={recordId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			onBlur={(e) => {
				// If focus is leaving the form entirely, save immediately
				if (!e.currentTarget.contains(e.relatedTarget as Node)) {
					immediateSave();
				}
			}}
			onClickCapture={(e) => {
				// Only navigate on actual mouse clicks, not synthetic/keyboard events
				if (e.detail === 0 || e.detail === undefined || !e.detail) {
					return;
				}

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
			<RecordFormHeader form={form} onChange={debouncedSave} />
			<ContentSection
				form={form}
				onChange={debouncedSave}
				onImmediate={immediateSave}
				mediaCaptionRef={mediaCaptionRef}
				mediaUploadRef={mediaUploadRef}
				uploadFile={uploadFile}
				deleteMedia={(ids) => deleteMediaMutation.mutate(ids)}
			/>
			<FormFooter form={form} record={record} onDelete={onDelete} />
		</form>
	);
}
