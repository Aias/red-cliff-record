import { createConnection, browsingHistoryOmitList, browsingHistory } from '@rcr/database';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Container, Heading, Table, Button, TextField } from '@radix-ui/themes';
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	ColumnDef,
	getSortedRowModel,
	SortingState,
} from '@tanstack/react-table';
import { useState, useRef } from 'react';
import { eq, sql, ilike, count } from 'drizzle-orm';

type OmitPattern = {
	pattern: string;
	createdAt: Date;
	updatedAt: Date | null;
	matchCount: number;
};

const fetchOmitList = createServerFn({ method: 'GET' }).handler(async () => {
	const db = createConnection();
	const patterns = await db
		.select({
			pattern: browsingHistoryOmitList.pattern,
			createdAt: browsingHistoryOmitList.createdAt,
			updatedAt: browsingHistoryOmitList.updatedAt,
			matchCount: count(browsingHistory.id),
		})
		.from(browsingHistoryOmitList)
		.leftJoin(browsingHistory, ilike(browsingHistory.url, browsingHistoryOmitList.pattern))
		.groupBy(
			browsingHistoryOmitList.pattern,
			browsingHistoryOmitList.createdAt,
			browsingHistoryOmitList.updatedAt
		);
	return { response: patterns };
});

const addPattern = createServerFn({ method: 'POST' })
	.validator((data: { pattern: string }) => data)
	.handler(async ({ data }) => {
		const db = createConnection();
		await db.insert(browsingHistoryOmitList).values({
			pattern: data.pattern,
		});
		return { success: true };
	});

const updatePattern = createServerFn({ method: 'POST' })
	.validator((data: { oldPattern: string; newPattern: string }) => data)
	.handler(async ({ data }) => {
		const db = createConnection();
		await db
			.update(browsingHistoryOmitList)
			.set({
				pattern: data.newPattern,
				updatedAt: new Date(),
			})
			.where(eq(browsingHistoryOmitList.pattern, data.oldPattern));
		return { success: true };
	});

const deletePattern = createServerFn({ method: 'POST' })
	.validator((data: { pattern: string }) => data)
	.handler(async ({ data }) => {
		const db = createConnection();
		await db
			.delete(browsingHistoryOmitList)
			.where(eq(browsingHistoryOmitList.pattern, data.pattern));
		return { success: true };
	});

export const Route = createFileRoute('/omit-list')({
	loader: async () => fetchOmitList(),
	component: OmitListPage,
});

function EditableCell({
	value: initialValue,
	row,
	column,
	onSave,
}: {
	value: string;
	row: any;
	column: any;
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
				style={{ cursor: 'pointer', padding: '4px' }}
				onClick={() => {
					setIsEditing(true);
					// Focus the input on next render
					setTimeout(() => inputRef.current?.focus(), 0);
				}}
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

function OmitListPage() {
	const { response: initialData } = Route.useLoaderData();
	const [data, setData] = useState<OmitPattern[]>(initialData);
	const [newPattern, setNewPattern] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);
	const [sorting, setSorting] = useState<SortingState>([
		{
			id: 'pattern',
			desc: false,
		},
	]);

	const handleUpdatePattern = async (oldPattern: string, newPattern: string) => {
		await updatePattern({ data: { oldPattern, newPattern } });
		const { response } = await fetchOmitList();
		setData(response);
	};

	const columns: ColumnDef<OmitPattern>[] = [
		{
			accessorKey: 'pattern',
			header: 'Pattern',
			cell: ({ getValue, row, column }) => (
				<EditableCell
					value={getValue() as string}
					row={row}
					column={column}
					onSave={handleUpdatePattern}
				/>
			),
		},
		{
			accessorKey: 'matchCount',
			header: 'Matches',
			cell: (info) => info.getValue(),
		},
		{
			accessorKey: 'createdAt',
			header: 'Created',
			cell: (info) => new Date(info.getValue() as string).toLocaleString(),
		},
		{
			accessorKey: 'updatedAt',
			header: 'Last Updated',
			cell: (info) => {
				const value = info.getValue() as string | null;
				return value ? new Date(value).toLocaleString() : 'Never';
			},
		},
		{
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) => (
				<Button color="red" variant="soft" onClick={() => handleDelete(row.original.pattern)}>
					Delete
				</Button>
			),
		},
	];

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		state: {
			sorting,
		},
		onSortingChange: setSorting,
	});

	const handleAdd = async () => {
		if (!newPattern) return;
		await addPattern({ data: { pattern: newPattern } });
		const { response } = await fetchOmitList();
		setData(response);
		setNewPattern('');
		// Maintain focus on the input
		inputRef.current?.focus();
	};

	const handleDelete = async (pattern: string) => {
		await deletePattern({ data: { pattern } });
		const { response } = await fetchOmitList();
		setData(response);
	};

	return (
		<Container p="4">
			<Heading size="7" mb="4" as="h1">
				Browsing History Omit List
			</Heading>

			<div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
				<TextField.Root
					ref={inputRef}
					style={{ flex: 1 }}
					placeholder="Enter URL pattern to omit..."
					value={newPattern}
					onChange={(e) => setNewPattern(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							handleAdd();
						}
					}}
				/>
				<Button onClick={handleAdd}>Add Pattern</Button>
			</div>

			<Table.Root variant="surface">
				<Table.Header>
					{table.getHeaderGroups().map((headerGroup) => (
						<Table.Row key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<Table.ColumnHeaderCell key={header.id}>
									{flexRender(header.column.columnDef.header, header.getContext())}
								</Table.ColumnHeaderCell>
							))}
						</Table.Row>
					))}
				</Table.Header>
				<Table.Body>
					{table.getRowModel().rows.map((row) => (
						<Table.Row key={row.id}>
							{row.getVisibleCells().map((cell) => (
								<Table.Cell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</Table.Cell>
							))}
						</Table.Row>
					))}
				</Table.Body>
			</Table.Root>
		</Container>
	);
}