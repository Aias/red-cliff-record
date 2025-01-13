import { createServerFn } from '@tanstack/start';
import { setCookie } from 'vinxi/http';
import { z } from 'zod';

export const setTheme = createServerFn({ method: 'POST' })
	.validator((data: unknown) => {
		const schema = z.object({
			theme: z.enum(['light', 'dark']),
		});
		return schema.parse(data);
	})
	.handler(async ({ data }) => {
		// Set cookie for one year
		setCookie('theme', data.theme, { path: '/', maxAge: 60 * 60 * 24 * 365 });
		return { theme: data.theme };
	});
