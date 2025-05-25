import { memo, type RefObject } from 'react';
import type { ReactFormApi } from '@tanstack/react-form';
import type { RecordGet } from '@/server/api/routers/types';
import { BooleanSwitch } from '@/components/boolean-switch';
import { DynamicTextarea } from '@/components/dynamic-textarea';
import MediaGrid from '@/components/media-grid';
import { MediaUpload } from '@/components/media-upload';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export interface ContentSectionProps {
	form: ReactFormApi<
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
	onChange: () => void;
	onImmediate: () => void;
	mediaCaptionRef: RefObject<HTMLTextAreaElement | null>;
	mediaUploadRef: RefObject<HTMLDivElement | null>;
	uploadFile: (file: File) => Promise<void>;
	deleteMedia: (ids: number[]) => void;
}

export const ContentSection = memo(
	({
		form,
		onChange,
		onImmediate,
		mediaCaptionRef,
		mediaUploadRef,
		uploadFile,
		deleteMedia,
	}: ContentSectionProps) => {
		return (
			<div className="mt-4 flex flex-col gap-3">
				<div className="flex gap-4">
					<h2 className="grow-1">Content</h2>
					<form.Field name="isPrivate">
						{(field) => (
							<BooleanSwitch
								label="Is Private"
								id="isPrivate"
								value={field.state.value}
								handleChange={(value) => {
									field.handleChange(value);
									onChange();
								}}
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
									onChange();
								}}
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
									onChange();
								}}
								onBlur={() => onChange()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										onImmediate();
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
								onChange={(e) => {
									field.handleChange(e.target.value);
									onChange();
								}}
								onBlur={() => onChange()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										onImmediate();
									}
								}}
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
									onDelete={(media) => deleteMedia([media.id])}
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
													onChange();
												}}
												onBlur={() => onChange()}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && !e.shiftKey) {
														e.preventDefault();
														onImmediate();
													}
												}}
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
									onChange();
								}}
								onBlur={() => onChange()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										onImmediate();
									}
								}}
							/>
						</div>
					)}
				</form.Field>
			</div>
		);
	}
);
