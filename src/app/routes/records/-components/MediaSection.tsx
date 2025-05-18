import { useCallback, useRef } from 'react';
import type { UseFormReturn } from '@tanstack/react-form';
import { DynamicTextarea, Label } from '@/components';
import MediaGrid from '@/components/media-grid';
import { MediaUpload } from '@/components/media-upload';
import { useCreateMedia, useDeleteMedia } from '@/lib/hooks/use-records';
import { readFileAsBase64 } from '@/lib/read-file';
import type { RecordGet } from '@/server/api/routers/types';

interface Props {
    recordId: number;
    form: UseFormReturn<RecordGet>;
}

export const MediaSection = ({ recordId, form }: Props) => {
    const mediaCaptionRef = useRef<HTMLTextAreaElement>(null);
    const mediaUploadRef = useRef<HTMLDivElement>(null);

    const createMedia = useCreateMedia(recordId);
    const deleteMedia = useDeleteMedia();

    const handleUpload = useCallback(async (file: File) => {
        const fileData = await readFileAsBase64(file);
        await createMedia.mutateAsync({
            recordId,
            fileData,
            fileName: file.name,
            fileType: file.type,
        });
    }, [recordId, createMedia]);

    return (
        <form.Field name="media">
            {(field) =>
                field.state.value && field.state.value.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        <MediaGrid
                            media={field.state.value}
                            onDelete={(media) => deleteMedia.mutate([media.id])}
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
                ) : (
                    <MediaUpload ref={mediaUploadRef} onUpload={handleUpload} />
                )
            }
        </form.Field>
    );
};
