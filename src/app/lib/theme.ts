import { ThemeProps } from '@radix-ui/themes';
import { createServerFn } from '@tanstack/start';
import { getCookie } from 'vinxi/http';
import { z } from 'zod';
import { grass } from '@radix-ui/colors';

export const ThemeCookieSchema = z.enum(['light', 'dark']).default('dark');

export const getThemeCookie = createServerFn({ method: 'GET' }).handler(() => {
	const theme = ThemeCookieSchema.parse(getCookie('theme'));
	return { theme };
});

export const defaultTheme: ThemeProps = {
	appearance: 'dark',
	radius: 'small',
	scaling: '90%',
	grayColor: 'olive',
	accentColor: 'grass',
	panelBackground: 'translucent',
};

export const themeColor = grass.grass9;
