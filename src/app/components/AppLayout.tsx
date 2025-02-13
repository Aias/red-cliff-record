import type { ReactNode } from 'react';
import { ArchiveIcon, MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { Button, DropdownMenu, IconButton, Separator, Text } from '@radix-ui/themes';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/start';
import { setTheme } from '../lib/server/setTheme';
import { AppLink } from './AppLink';
import { IconWrapper } from './IconWrapper';

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
				<AppLink to={'/'} asChild>
					<li className="flex grow cursor-pointer items-center gap-3">
						<IconWrapper>
							<ArchiveIcon />
						</IconWrapper>
						<Text className="font-mono uppercase" weight="medium" size="2">
							The Red Cliff Record
						</Text>
					</li>
				</AppLink>

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
								Queue
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</li>
				<li>
					<Separator orientation="vertical" />
				</li>
				<IconButton asChild variant="ghost" size="2" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <MoonIcon /> : <SunIcon />}</li>
				</IconButton>
			</menu>
			{children}
		</div>
	);
};
