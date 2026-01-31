import { z } from 'zod';

export const mediaTypes = [
  'application', // application or binary data
  'audio', // audio files
  'font', // font/typeface files
  'image', // images (jpg, png, etc)
  'message', // message data
  'model', // 3D models
  'multipart', // multipart files
  'text', // plain text, markdown, etc.
  'video', // video files
] as const;
export const MediaTypeSchema = z.enum(mediaTypes);
export type MediaType = z.infer<typeof MediaTypeSchema>;
// Backward-compatible alias for runtime use (e.g., MediaType.enum.image)
export { MediaTypeSchema as MediaType };
