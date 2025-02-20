import { useMemo, useRef, useState } from 'react';
import type { ColumnDef, RowData } from '@tanstack/react-table';
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from '@tanstack/react-table';
import { Checkbox } from './Checkbox';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';

// Add custom meta type for column alignment
declare module '@tanstack/react-table' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ColumnMeta<TData extends RowData, TValue> {
		columnProps?: React.ComponentProps<typeof TableCell>;
	}
}

export type DataGridProps<T> = {
	data: T[];
	columns: ColumnDef<T>[];
	sorting?: boolean;
	selection?: {
		enabled: boolean;
		selectedIds: Set<string>;
		onSelectionChange: (selectedIds: Set<string>) => void;
	};
	onRowClick?: (row: T) => void;
	getRowId: (row: T) => string;
	className?: string;
	rootProps?: React.ComponentProps<typeof Table>;
	headerProps?: React.ComponentProps<typeof TableHeader>;
	headerRowProps?: React.ComponentProps<typeof TableRow>;
	headerCellProps?: React.ComponentProps<typeof TableHead>;
	bodyProps?: React.ComponentProps<typeof TableBody>;
	rowProps?:
		| React.ComponentProps<typeof TableRow>
		| ((row: T) => React.ComponentProps<typeof TableRow>);
	cellProps?:
		| React.ComponentProps<typeof TableCell>
		| ((row: T, columnId: string) => React.ComponentProps<typeof TableCell>);
};

export function DataGrid<T>({
	data,
	columns: userColumns,
	sorting = false,
	selection,
	onRowClick,
	getRowId,
	className,
	rootProps,
	headerProps,
	headerRowProps,
	headerCellProps,
	bodyProps,
	rowProps,
	cellProps,
}: DataGridProps<T>) {
	const [sortingState, setSortingState] = useState<SortingState>([]);

	const columns = useMemo(
		() =>
			selection?.enabled
				? [
						{
							id: 'select',
							header: '',
							meta: {
								align: 'center',
							},
							cell: ({ row }) => (
								<Checkbox
									title="Select"
									checked={selection.selectedIds.has(getRowId(row.original))}
									onClick={(e) => {
										e.stopPropagation();
										const id = getRowId(row.original);
										const newSelection = new Set(selection.selectedIds);
										if (newSelection.has(id)) {
											newSelection.delete(id);
										} else {
											newSelection.add(id);
										}
										selection.onSelectionChange(newSelection);
									}}
									className="mt-[0.1em]"
								/>
							),
						} as ColumnDef<T>,
						...userColumns,
					]
				: userColumns,
		[selection?.enabled, userColumns, selection?.selectedIds, getRowId]
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: sorting ? getSortedRowModel() : undefined,
		state: {
			sorting: sortingState,
		},
		onSortingChange: setSortingState,
		getRowId,
	});

	return (
		<Table className={className} {...rootProps}>
			<TableHeader {...headerProps}>
				{table.getHeaderGroups().map((headerGroup) => (
					<TableRow key={headerGroup.id} {...headerRowProps}>
						{headerGroup.headers.map((header) => (
							<TableHead
								key={header.id}
								onClick={
									header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined
								}
								className={header.column.getCanSort() ? 'cursor-pointer' : undefined}
								{...header.column.columnDef.meta?.columnProps}
								{...headerCellProps}
							>
								{flexRender(header.column.columnDef.header, header.getContext())}
							</TableHead>
						))}
					</TableRow>
				))}
			</TableHeader>
			<TableBody {...bodyProps}>
				{table.getRowModel().rows.length > 0 ? (
					table.getRowModel().rows.map((row) => {
						const { className: customClass = '', ...rest } =
							(typeof rowProps === 'function' ? rowProps(row.original) : rowProps) ?? {};

						return (
							<TableRow
								key={row.id}
								data-active={selection?.selectedIds.has(getRowId(row.original))}
								data-selectable={onRowClick !== undefined}
								className={cn('data-active:active data-selectable:selectable', customClass)}
								onClick={() => onRowClick?.(row.original)}
								{...rest}
							>
								{row.getVisibleCells().map((cell) => {
									const customCellProps =
										typeof cellProps === 'function'
											? cellProps(row.original, cell.column.id)
											: cellProps;

									return (
										<TableCell
											key={cell.id}
											{...cell.column.columnDef.meta?.columnProps}
											{...customCellProps}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									);
								})}
							</TableRow>
						);
					})
				) : (
					<TableRow>
						<TableCell colSpan={table.getAllColumns().length} align="center">
							<p className="text-rcr-secondary">No Rows</p>
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	);
}

export function EditableCell({
	value: initialValue,
	onSave,
}: {
	value: string;
	onSave: (oldValue: string, newValue: string) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(initialValue);
	const inputRef = useRef<HTMLInputElement>(null);

	const onBlur = () => {
		setIsEditing(false);
		if (value !== initialValue) {
			onSave(initialValue, value);
		}
	};

	if (!isEditing) {
		return (
			<div
				onClick={() => {
					setIsEditing(true);
					setTimeout(() => inputRef.current?.focus(), 0);
				}}
				className="cursor-pointer p-1"
			>
				{value}
			</div>
		);
	}

	return (
		<Input
			ref={inputRef}
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={onBlur}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					onBlur();
				}
				if (e.key === 'Escape') {
					setIsEditing(false);
					setValue(initialValue);
				}
			}}
		/>
	);
}
