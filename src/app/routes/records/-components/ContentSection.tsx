import type { UseFormReturn } from '@tanstack/react-form';
import { DynamicTextarea, Label, Separator } from '@/components';
import type { RecordGet } from '@/server/api/routers/types';

interface Props {
    form: UseFormReturn<RecordGet>;
}

export const ContentSection = ({ form }: Props) => (
    <>
        <form.Field name="summary">
            {(field) => (
                <div className="flex flex-col gap-1.5">
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
                <div className="flex flex-col gap-1.5">
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

        <Separator />

        <form.Field name="notes">
            {(field) => (
                <div className="flex flex-col gap-1.5">
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
    </>
);
