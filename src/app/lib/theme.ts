import { createServerFn } from '@tanstack/start';
import { getCookie } from 'vinxi/http';
import { z } from 'zod';

export const ThemeCookieSchema = z.enum(['light', 'dark']).default('dark');

export type Theme = z.infer<typeof ThemeCookieSchema>;

export const getThemeCookie = createServerFn({ method: 'GET' }).handler(() => {
	const theme = ThemeCookieSchema.parse(getCookie('theme'));
	return { theme };
});
