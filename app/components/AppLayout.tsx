import { SunIcon, MoonIcon, HomeIcon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import { ReactNode } from 'react';
import { useServerFn } from '@tanstack/start';
import { setTheme } from '../lib/server/setTheme';
import { useNavigate } from '@tanstack/react-router';

interface AppLayoutProps {
	children: ReactNode;
	currentTheme: 'light' | 'dark';
	onThemeChange: (newTheme: 'light' | 'dark') => void;
}

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
	const callSetTheme = useServerFn(setTheme);
	const navigate = useNavigate();
	const toggleTheme = async () => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		await callSetTheme({ data: { theme: newTheme } });
		onThemeChange(newTheme);
	};

	return (
		<div className="flex flex-col fixed overflow-hidden inset-0">
			<menu className="items-center gap-4 fixed bottom-3 right-3 inline-flex z-100 bg-panel-solid border border-gray-5 rounded-2 shadow-6 px-3 py-2">
				<IconButton asChild variant="ghost" size="2" onClick={() => navigate({ to: '/' })}>
					<li>
						<HomeIcon />
					</li>
				</IconButton>
				<IconButton asChild variant="ghost" size="2" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <MoonIcon /> : <SunIcon />}</li>
				</IconButton>
			</menu>
			{children}
		</div>
	);
};
