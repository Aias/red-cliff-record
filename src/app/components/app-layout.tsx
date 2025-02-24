import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/start';
import { ArchiveIcon, DayModeIcon, ExpandIcon, NightModeIcon } from '@/app/components/icons';
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '.';
import { setTheme } from '@/lib/server/theme';

interface AppLayoutProps {
	children: ReactNode;
	currentTheme: 'light' | 'dark';
	onThemeChange: (newTheme: 'light' | 'dark') => void;
}

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
	const navigate = useNavigate();
	const callSetTheme = useServerFn(setTheme);
	const toggleTheme = async () => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		await callSetTheme({ data: { theme: newTheme } });
		onThemeChange(newTheme);
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

				<li>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button>
								Activities
								<ExpandIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem
								onClick={() =>
									navigate({
										to: '/history/$date',
										params: { date: new Date().toLocaleDateString('en-CA') },
									})
								}
							>
								Browsing History
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									navigate({
										to: '/commits',
									})
								}
							>
								Github Commits
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									navigate({
										to: '/queue/records',
									})
								}
							>
								Records Queue
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</li>
				<li className="vr py-1" />
				<Button asChild variant="ghost" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <DayModeIcon /> : <NightModeIcon />}</li>
				</Button>
			</menu>
			{children}
		</div>
	);
};
