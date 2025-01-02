import { SunIcon, MoonIcon, HomeIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
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
		<Flex direction="column" className="fixed overflow-hidden inset-0">
			<Flex
				align="center"
				gap="4"
				className="fixed bottom-4 right-4 inline-flex z-100 bg-panel-solid border border-gray-5 rounded-2 shadow-6 px-3 py-2"
			>
				<IconButton variant="ghost" size="2" onClick={() => navigate({ to: '/' })}>
					<HomeIcon />
				</IconButton>

				<IconButton variant="ghost" size="2" onClick={toggleTheme}>
					{currentTheme === 'light' ? <MoonIcon /> : <SunIcon />}
				</IconButton>
			</Flex>

			{children}
		</Flex>
	);
};
