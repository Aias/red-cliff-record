import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from 'vinxi/http';
import { z } from 'zod';

export const ThemeCookieSchema = z.enum(['light', 'dark']).default('dark');

export type Theme = z.infer<typeof ThemeCookieSchema>;

export const getTheme = createServerFn({ method: 'GET' }).handler(() => {
	const theme = ThemeCookieSchema.parse(getCookie('theme'));
	return { theme };
});

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
