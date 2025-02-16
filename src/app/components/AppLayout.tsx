import type { ReactNode } from 'react';
import { Button, DropdownMenu, IconButton } from '@radix-ui/themes';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/start';
import { ArchiveIcon, DayModeIcon, NightModeIcon } from '~/app/components/icons';
import { setTheme } from '../lib/server/setTheme';

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
			<menu className="z-100 flex items-center justify-between gap-4 border-b border-border surface px-4 py-2">
				<li className="flex grow">
					<Link to={'/'} className="flex grow cursor-pointer items-center gap-3">
						<ArchiveIcon />
						<span className="font-mono text-sm font-medium">The Red Cliff Record</span>
					</Link>
				</li>

				<li>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="soft" size="2">
								Activities
								<DropdownMenu.TriggerIcon />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							<DropdownMenu.Item
								onClick={() =>
									navigate({
										to: '/history/$date',
										params: { date: new Date().toLocaleDateString('en-CA') },
									})
								}
							>
								Browsing History
							</DropdownMenu.Item>
							<DropdownMenu.Item
								onClick={() =>
									navigate({
										to: '/commits',
									})
								}
							>
								Github Commits
							</DropdownMenu.Item>
							<DropdownMenu.Item
								onClick={() =>
									navigate({
										to: '/queue/indices',
									})
								}
							>
								Index Queue
							</DropdownMenu.Item>
							<DropdownMenu.Item
								onClick={() =>
									navigate({
										to: '/queue/records',
									})
								}
							>
								Records Queue
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</li>
				<li className="vr py-1" />
				<IconButton asChild variant="ghost" size="2" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <DayModeIcon /> : <NightModeIcon />}</li>
				</IconButton>
			</menu>
			{children}
		</div>
	);
};
