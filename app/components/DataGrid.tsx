import { Table, Checkbox, Text } from '@radix-ui/themes';
import type { ColumnDef, RowData } from '@tanstack/react-table';
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	getSortedRowModel,
	type SortingState,
} from '@tanstack/react-table';
import { useSelection } from '@/app/lib/useSelection';
import { cn } from '@/app/lib/classNames';
import { useEffect, useMemo, useState } from 'react';

// Add custom meta type for column alignment
declare module '@tanstack/react-table' {
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
		onRowToggle?: (id: string) => void;
		onSelectionChange?: (selectedIds: Set<string>) => void;
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
	const { selectedIds, toggleSelection } = useSelection(data.map((row) => ({ id: getRowId(row) })));

	// Prepend selection column if enabled
	const columns = useMemo(
		() =>
			selection?.enabled
				? [
						{
							id: 'select',
							header: 'Select',
							meta: {
								align: 'center',
							},
							cell: ({ row }) => (
								<Checkbox
									checked={selectedIds.has(getRowId(row.original))}
									onClick={(e) => {
										e.stopPropagation();
										const id = getRowId(row.original);
										toggleSelection(id);
										selection.onRowToggle?.(id);
									}}
								/>
							),
						} as ColumnDef<T>,
						...userColumns,
					]
				: userColumns,
		[
			selection?.enabled,
			userColumns,
			selectedIds,
			getRowId,
			toggleSelection,
			selection?.onRowToggle,
		]
	);

	useEffect(() => {
		selection?.onSelectionChange?.(selectedIds);
	}, [selectedIds]);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: sorting ? getSortedRowModel() : undefined,
		state: {
			sorting: sortingState,
		},
		onSortingChange: setSortingState,
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
								className={cn(header.column.getCanSort() && 'cursor-pointer')}
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
						const customRowProps =
							typeof rowProps === 'function' ? rowProps(row.original) : rowProps;

						return (
							<Table.Row
								key={row.id}
								className={cn(
									onRowClick && 'selectable',
									selectedIds.has(getRowId(row.original)) && 'active',
									customRowProps?.className
								)}
								onClick={() => onRowClick?.(row.original)}
								{...customRowProps}
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
							<Text color="gray">No Rows</Text>
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table.Root>
	);
}
