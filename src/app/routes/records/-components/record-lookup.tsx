import { useEffect, useState } from 'react';
import { RecordTypeIcon } from './type-icons';
import {
	Button,
	CheckIcon,
	ChevronUpDownIcon,
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	DeleteIcon,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components';
import type { RecordSelect } from '@/db/schema';

// Create a custom empty component since CommandEmpty doesn't work properly
// when there are other items in the list
const CustomEmpty = ({ children }: { children: React.ReactNode }) => {
	return <div className="py-6 text-center text-sm">{children}</div>;
};

interface RecordLookupProps {
	defaultRecord: RecordSelect | null;
	onRecordSelected: (record: RecordSelect | null) => void;
	handleSearch: (search: string) => Promise<RecordSelect[]>;
}

export function RecordLookup({ defaultRecord, onRecordSelected, handleSearch }: RecordLookupProps) {
	const [open, setOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [records, setRecords] = useState<RecordSelect[]>([]);
	const [selectedRecord, setSelectedRecord] = useState<RecordSelect | null>(defaultRecord);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (searchTerm.trim() === '') {
			setRecords([]);
			return;
		}

		setIsLoading(true);
		const handler = setTimeout(async () => {
			try {
				const results = await handleSearch(searchTerm);
				setRecords(results);
			} finally {
				setIsLoading(false);
			}
		}, 250);

		return () => clearTimeout(handler);
	}, [searchTerm, handleSearch]);

	const handleSelect = (record: RecordSelect | null) => {
		setSelectedRecord(record);
		onRecordSelected(record);
		setOpen(false);
	};

	const handleClear = () => {
		setSelectedRecord(null);
		onRecordSelected(null);
		setSearchTerm('');
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					{selectedRecord ? selectedRecord.title : 'Select record...'}
					<ChevronUpDownIcon className="ml-2 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0" align="start" sideOffset={4}>
				<Command shouldFilter={false}>
					<CommandInput
						value={searchTerm}
						onValueChange={setSearchTerm}
						placeholder="Search records..."
					/>
					<CommandList>
						{/* Clear selection section */}
						{selectedRecord && (
							<CommandGroup>
								<CommandItem
									onSelect={handleClear}
									className="text-destructive data-selected:text-destructive!"
								>
									<DeleteIcon />
									Clear selection
								</CommandItem>
							</CommandGroup>
						)}
						{/* Custom empty states */}
						{searchTerm.trim() === '' && !selectedRecord && (
							<CustomEmpty>Search for a record.</CustomEmpty>
						)}

						{searchTerm.trim() !== '' && records.length === 0 && !isLoading && (
							<CustomEmpty>No records found.</CustomEmpty>
						)}

						{/* Results section */}
						{records.length > 0 && (
							<CommandGroup heading="Results">
								{records.map((record) => (
									<CommandItem
										key={record.id}
										onSelect={() => handleSelect(record)}
										value={record.id.toString()}
										className={
											selectedRecord?.id === record.id ? 'bg-accent font-medium themed' : ''
										}
									>
										<RecordTypeIcon
											type={record.type}
											className={selectedRecord?.id === record.id ? 'opacity-100' : 'opacity-50'}
										/>
										<span className="flex flex-1 flex-wrap gap-1 leading-none">
											<span>{record.title ?? 'Untitled'}</span>
											{record.abbreviation && <span>({record.abbreviation})</span>}
											{record.sense && <em className="text-rcr-secondary">{record.sense}</em>}
										</span>
										{selectedRecord?.id === record.id && <CheckIcon className="ml-auto" />}
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
