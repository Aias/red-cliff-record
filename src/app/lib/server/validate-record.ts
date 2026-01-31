import { RecordInsertSchema } from '@hozo/schema/records';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export type ValidationResult =
  | { success: true }
  | { success: false; formError?: string; fieldErrors: Record<string, string[]> };

const inputSchema = z.record(z.string(), z.unknown());

export const validateRecord = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(({ data }): ValidationResult => {
    const parsed = RecordInsertSchema.safeParse(data);

    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      const fieldErrors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(flat.fieldErrors)) {
        if (Array.isArray(value)) {
          fieldErrors[key] = value;
        }
      }
      return {
        success: false,
        formError: flat.formErrors.length > 0 ? flat.formErrors.join(', ') : undefined,
        fieldErrors,
      };
    }

    return { success: true };
  });
