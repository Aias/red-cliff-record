import { SunIcon, MoonIcon, HomeIcon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import { ReactNode } from 'react';
import { useServerFn } from '@tanstack/start';
import { setTheme } from '../lib/server/setTheme';
import { AppLink } from './AppLink';

interface AppLayoutProps {
	children: ReactNode;
	currentTheme: 'light' | 'dark';
	onThemeChange: (newTheme: 'light' | 'dark') => void;
}

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
	const callSetTheme = useServerFn(setTheme);
	const toggleTheme = async () => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		await callSetTheme({ data: { theme: newTheme } });
		onThemeChange(newTheme);
	};

	return (
		<div className="flex flex-col fixed overflow-hidden inset-0">
			<menu className="items-center gap-4 fixed bottom-3 right-3 inline-flex z-100 bg-panel-solid border border-gray-5 rounded-2 shadow-6 px-3 py-2">
				<AppLink to={'/'} asChild>
					<IconButton asChild variant="ghost" size="2">
						<li>
							<HomeIcon />
						</li>
					</IconButton>
				</AppLink>

				<IconButton asChild variant="ghost" size="2" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <MoonIcon /> : <SunIcon />}</li>
				</IconButton>
			</menu>
			{children}
		</div>
	);
};
