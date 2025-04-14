import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArchiveIcon, MoonIcon, SunIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { defaultQueueOptions } from '@/server/api/routers/records.types';
import { SearchResult } from './search-result';
import {
	Button,
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { setTheme } from '@/lib/server/theme';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
	children: ReactNode;
	currentTheme: 'light' | 'dark';
	onThemeChange: (newTheme: 'light' | 'dark') => void;
}

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState('');
	const [commandOpen, setCommandOpen] = useState(false);
	const debouncedValue = useDebounce(inputValue, 300);

	const recordsQuery = trpc.records.search.useQuery(
		{
			query: debouncedValue,
			limit: 10,
		},
		{
			enabled: debouncedValue.length > 1,
		}
	);

	const handleInputChange = (search: string) => {
		setInputValue(search);
		if (search.length > 0 && !commandOpen) {
			setCommandOpen(true);
		} else if (search.length === 0 && commandOpen) {
			setCommandOpen(false);
		}
	};

	const handleSelectResult = (recordId: number) => {
		setCommandOpen(false);
		setInputValue('');
		navigate({ to: '/records/$recordId', params: { recordId: recordId.toString() } });
	};

	const toggleTheme = async () => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		onThemeChange(newTheme);
		setTheme({ data: { theme: newTheme } });
	};

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<menu className="relative z-100 flex shrink-0 basis-auto items-center justify-between gap-4 border-b border-c-border surface px-4 py-2">
				<li className="flex">
					<Link to={'/'} className="flex shrink-0 cursor-pointer items-center gap-3">
						<ArchiveIcon />
						<span className="font-mono font-medium">The Red Cliff Record</span>
					</Link>
				</li>
				<li className="flex flex-grow justify-center px-4">
					<Command
						shouldFilter={false}
						className="relative w-full overflow-visible rounded-md border border-c-border shadow-none [&_[data-slot=command-input-wrapper]]:border-none"
					>
						<CommandInput
							placeholder="Search records..."
							value={inputValue}
							onValueChange={handleInputChange}
							onFocus={() => inputValue.length > 0 && setCommandOpen(true)}
							onBlur={() => setTimeout(() => setCommandOpen(false), 150)}
						/>
						<CommandList
							className={cn(
								'absolute top-full z-50 mt-1 max-h-[50vh] w-full overflow-y-auto rounded-md border border-border bg-c-background shadow-md',
								{ hidden: !commandOpen || debouncedValue.length <= 1 }
							)}
						>
							{recordsQuery.isLoading && debouncedValue.length > 1 && (
								<div className="p-2 text-center text-sm text-c-secondary">Loading...</div>
							)}
							{!recordsQuery.isLoading &&
								debouncedValue.length > 1 &&
								(recordsQuery.data?.length ?? 0) === 0 && (
									<div className="p-2 text-center text-sm text-c-secondary">No results found.</div>
								)}
							<CommandGroup>
								{recordsQuery.data?.map((record) => (
									<CommandItem
										key={record.id}
										value={record.title ?? record.id.toString()}
										onSelect={() => handleSelectResult(record.id)}
										className="flex w-full"
									>
										<SearchResult
											id={record.id}
											title={record.title ?? 'Untitled'}
											content={record.content || record.summary || record.notes || undefined}
											type="record"
											url={record.url}
											imageUrl={record.media[0]?.url}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</li>
				<li>
					<Link to={'/records'} search={defaultQueueOptions}>
						Records
					</Link>
				</li>
				<Button asChild variant="ghost" onClick={toggleTheme}>
					<li>{currentTheme === 'light' ? <SunIcon /> : <MoonIcon />}</li>
				</Button>
			</menu>
			{children}
		</div>
	);
};
