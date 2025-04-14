import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArchiveIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { defaultQueueOptions } from '@/server/api/routers/records.types';
import { SearchResult } from './search-result';
import {
	Button,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Separator,
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
		// Dialog opening is handled by button click and keydown
		// if (search.length > 0 && !commandOpen) {
		// 	setCommandOpen(true);
		// } else if (search.length === 0 && commandOpen) {
		// 	setCommandOpen(false);
		// }
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

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
				if (
					(e.target instanceof HTMLElement && e.target.isContentEditable) ||
					e.target instanceof HTMLInputElement ||
					e.target instanceof HTMLTextAreaElement ||
					e.target instanceof HTMLSelectElement
				) {
					return;
				}

				e.preventDefault();
				setCommandOpen((open) => !open);
			}
		};

		document.addEventListener('keydown', down);
		return () => document.removeEventListener('keydown', down);
	}, []);

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
					<Button
						variant="outline"
						className={cn(
							'text-c-muted-foreground relative h-9 w-full justify-start rounded-md text-sm font-normal shadow-none sm:pr-12 md:w-40 lg:w-64'
						)}
						onClick={() => setCommandOpen(true)}
					>
						<SearchIcon className="mr-2 h-4 w-4" />
						<span className="hidden lg:inline-flex">Search records...</span>
						<span className="inline-flex lg:hidden">Search...</span>
						<kbd className="pointer-events-none absolute top-[0.4rem] right-[0.3rem] hidden h-5 items-center gap-1 rounded border border-c-border surface px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex">
							<span className="text-xs">⌘</span>K
						</kbd>
					</Button>
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

			<CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
				<CommandInput
					placeholder="Search records..."
					value={inputValue}
					onValueChange={handleInputChange}
				/>
				<CommandList>
					<CommandEmpty>
						{recordsQuery.isLoading && debouncedValue.length > 1
							? 'Loading...'
							: 'No results found.'}
					</CommandEmpty>
					{debouncedValue.length > 1 && !recordsQuery.isLoading && recordsQuery.data && (
						<CommandGroup heading="Results">
							{recordsQuery.data.map((record) => (
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
					)}
				</CommandList>
			</CommandDialog>
		</div>
	);
};
