import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArchiveIcon, DayModeIcon, NightModeIcon } from '@/app/components/icons';
import { Button } from '../../components';
import { setTheme } from '@/lib/server/theme';

interface AppLayoutProps {
	children: ReactNode;
	currentTheme: 'light' | 'dark';
	onThemeChange: (newTheme: 'light' | 'dark') => void;
}

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
	const toggleTheme = async () => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		onThemeChange(newTheme);
		setTheme({ data: { theme: newTheme } });
	};

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<menu className="z-100 flex items-center justify-between gap-4 border-b border-rcr-border surface px-4 py-2">
				<li className="flex grow">
					<Link to={'/'} className="flex grow cursor-pointer items-center gap-3">
						<ArchiveIcon />
						<span className="font-mono text-sm font-medium">The Red Cliff Record</span>
					</Link>
				</li>
				<Button asChild variant="ghost" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <DayModeIcon /> : <NightModeIcon />}</li>
				</Button>
			</menu>
			{children}
		</div>
	);
};
