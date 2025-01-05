import { z } from 'zod';

export const emptyStringToNull = <T extends z.ZodType>(schema: T) =>
	z
		.string()
		.nullable()
		.transform((str) => (str === '' ? null : str))
		.pipe(schema.nullable());
