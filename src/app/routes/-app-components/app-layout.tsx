import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Archive, Moon, Sun } from 'lucide-react';
import { defaultQueueOptions } from '@/server/api/routers/records.types';
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
			<menu className="z-100 flex shrink-0 basis-auto items-center justify-between gap-4 border-b border-rcr-border surface px-4 py-2">
				<li className="flex grow">
					<Link to={'/'} className="flex grow cursor-pointer items-center gap-3">
						<Archive />
						<span className="font-mono font-medium">The Red Cliff Record</span>
					</Link>
				</li>
				<li>
					<Link to={'/records'} search={defaultQueueOptions}>
						Records
					</Link>
				</li>
				<Button asChild variant="ghost" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <Sun /> : <Moon />}</li>
				</Button>
			</menu>
			{children}
		</div>
	);
};
