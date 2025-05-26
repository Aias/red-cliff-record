import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArchiveIcon, MoonIcon, SunIcon } from 'lucide-react';
import { SiteSearch } from './site-search';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { setTheme } from '@/lib/server/theme';
import { defaultQueueOptions } from '@/shared/types';

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
			<menu className="relative z-100 flex shrink-0 basis-auto items-center justify-between gap-4 border-b border-c-border surface px-4 py-2">
				<li className="flex items-center gap-4">
					<Link to={'/'} className="flex shrink-0 cursor-pointer items-center gap-3">
						<ArchiveIcon />
						<span className="font-mono font-medium">The Red Cliff Record</span>
					</Link>
					<Separator orientation="vertical" className="h-5! border-c-border" />
					<Link to={'/records'} search={defaultQueueOptions}>
						Records
					</Link>
				</li>
				<li className="flex items-center gap-2">
					<SiteSearch />
					<Button variant="ghost" onClick={toggleTheme} className="h-9 w-9 p-0">
						{currentTheme === 'light' ? (
							<SunIcon className="h-5 w-5" />
						) : (
							<MoonIcon className="h-5 w-5" />
						)}
						<span className="sr-only">Toggle theme</span>
					</Button>
				</li>
			</menu>

			{children}
		</div>
	);
};
