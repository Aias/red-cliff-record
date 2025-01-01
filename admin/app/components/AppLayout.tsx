// app/components/AppLayout.tsx
import { SunIcon, MoonIcon, HomeIcon } from '@radix-ui/react-icons';
import { Flex, IconButton } from '@radix-ui/themes';
import { ReactNode } from 'react';
import { useServerFn } from '@tanstack/start';
import { setTheme } from '../lib/server/setTheme';
import { useNavigate } from '@tanstack/react-router';
import styles from '../styles/app.module.css';

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
		// Update theme on server
		await callSetTheme({ data: { theme: newTheme } });
		// Update theme locally without reloading
		onThemeChange(newTheme);
	};

	return (
		<Flex
			className={styles.app}
			direction="column"
			style={{ position: 'fixed', inset: 0 }}
			overflow="hidden"
		>
			<Flex align="center" gap="3" className={styles.appHeader} flexGrow="0">
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
