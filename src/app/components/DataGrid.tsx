import { useMemo, useRef, useState } from 'react';
import { Checkbox, Table, TextField } from '@radix-ui/themes';
import type { ColumnDef, RowData } from '@tanstack/react-table';
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from '@tanstack/react-table';
import { cn } from '~/lib/utils';

// Add custom meta type for column alignment
declare module '@tanstack/react-table' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ColumnMeta<TData extends RowData, TValue> {
		columnProps?: React.ComponentProps<typeof Table.Cell>;
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
	rootProps?: React.ComponentProps<typeof Table.Root>;
	headerProps?: React.ComponentProps<typeof Table.Header>;
	headerRowProps?: React.ComponentProps<typeof Table.Row>;
	headerCellProps?: React.ComponentProps<typeof Table.ColumnHeaderCell>;
	bodyProps?: React.ComponentProps<typeof Table.Body>;
	rowProps?:
		| React.ComponentProps<typeof Table.Row>
		| ((row: T) => React.ComponentProps<typeof Table.Row>);
	cellProps?:
		| React.ComponentProps<typeof Table.Cell>
		| ((row: T, columnId: string) => React.ComponentProps<typeof Table.Cell>);
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
		<Table.Root variant="surface" className={className} {...rootProps}>
			<Table.Header {...headerProps}>
				{table.getHeaderGroups().map((headerGroup) => (
					<Table.Row key={headerGroup.id} {...headerRowProps}>
						{headerGroup.headers.map((header) => (
							<Table.ColumnHeaderCell
								key={header.id}
								onClick={
									header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined
								}
								className={header.column.getCanSort() ? 'cursor-pointer' : undefined}
								{...header.column.columnDef.meta?.columnProps}
								{...headerCellProps}
							>
								{flexRender(header.column.columnDef.header, header.getContext())}
							</Table.ColumnHeaderCell>
						))}
					</Table.Row>
				))}
			</Table.Header>
			<Table.Body {...bodyProps}>
				{table.getRowModel().rows.length > 0 ? (
					table.getRowModel().rows.map((row) => {
						const { className: customClass = '', ...rest } =
							(typeof rowProps === 'function' ? rowProps(row.original) : rowProps) ?? {};

						return (
							<Table.Row
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
										<Table.Cell
											key={cell.id}
											{...cell.column.columnDef.meta?.columnProps}
											{...customCellProps}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</Table.Cell>
									);
								})}
							</Table.Row>
						);
					})
				) : (
					<Table.Row>
						<Table.Cell colSpan={table.getAllColumns().length} align="center">
							<p className="text-secondary">No Rows</p>
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table.Root>
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
		<TextField.Root
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
