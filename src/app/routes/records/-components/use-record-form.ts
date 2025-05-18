import { useCallback } from 'react';
import { useForm, type UseFormReturn } from '@tanstack/react-form';
import { RecordInsertSchema } from '@/server/db/schema';
import type { RecordGet } from '@/server/api/routers/types';
import { useCreateMedia, useDeleteMedia, useRecord, useUpsertRecord } from '@/lib/hooks/use-records';
import { readFileAsBase64 } from '@/lib/read-file';

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

export interface UseRecordFormReturn {
    form: UseFormReturn<RecordGet>;
    record: RecordGet | undefined;
    isLoading: boolean;
    isError: boolean;
    handleUpload: (file: File) => Promise<void>;
    deleteMedia: ReturnType<typeof useDeleteMedia>;
}

export const useRecordForm = (recordId: number): UseRecordFormReturn => {
    const { data: record, isLoading, isError } = useRecord(recordId);
    const updateMutation = useUpsertRecord();
    const createMediaMutation = useCreateMedia(recordId);
    const deleteMedia = useDeleteMedia();

    const handleUpload = useCallback(async (file: File) => {
        const fileData = await readFileAsBase64(file);
        await createMediaMutation.mutateAsync({
            recordId,
            fileData,
            fileName: file.name,
            fileType: file.type,
        });
    }, [recordId, createMediaMutation]);

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

    return { form, record, isLoading, isError, handleUpload, deleteMedia };
};
