import { db } from '@/db/connections';
import { arcBrowsingHistory, arcBrowsingHistoryOmitList } from '@/db/schema';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Heading, Table, Button, TextField, ScrollArea } from '@radix-ui/themes';
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	ColumnDef,
	getSortedRowModel,
	SortingState,
} from '@tanstack/react-table';
import { useState, useRef } from 'react';
import { eq, ilike, count } from 'drizzle-orm';
import { z } from 'zod';

type OmitPattern = {
	pattern: string;
	createdAt: Date;
	updatedAt: Date | null;
	matchCount: number;
};

const fetchOmitList = createServerFn({ method: 'GET' }).handler(async () => {
	const patterns = await db
		.select({
			pattern: arcBrowsingHistoryOmitList.pattern,
			createdAt: arcBrowsingHistoryOmitList.createdAt,
			updatedAt: arcBrowsingHistoryOmitList.updatedAt,
			matchCount: count(arcBrowsingHistory.id),
		})
		.from(arcBrowsingHistoryOmitList)
		.leftJoin(arcBrowsingHistory, ilike(arcBrowsingHistory.url, arcBrowsingHistoryOmitList.pattern))
		.groupBy(
			arcBrowsingHistoryOmitList.pattern,
			arcBrowsingHistoryOmitList.createdAt,
			arcBrowsingHistoryOmitList.updatedAt
		);
	return { response: patterns };
});

const addPattern = createServerFn({ method: 'POST' })
	.validator(z.string())
	.handler(async ({ data }) => {
		await db.insert(arcBrowsingHistoryOmitList).values({
			pattern: data,
		});
		return { success: true };
	});

const updatePattern = createServerFn({ method: 'POST' })
	.validator(z.object({ oldPattern: z.string(), newPattern: z.string() }))
	.handler(async ({ data }) => {
		await db
			.update(arcBrowsingHistoryOmitList)
			.set({
				pattern: data.newPattern,
				updatedAt: new Date(),
			})
			.where(eq(arcBrowsingHistoryOmitList.pattern, data.oldPattern));
		return { success: true };
	});

const deletePattern = createServerFn({ method: 'POST' })
	.validator(z.string())
	.handler(async ({ data }) => {
		await db.delete(arcBrowsingHistoryOmitList).where(eq(arcBrowsingHistoryOmitList.pattern, data));
		return { success: true };
	});

export const Route = createFileRoute('/omit-list')({
	loader: async () => fetchOmitList(),
	component: OmitListPage,
});

function EditableCell({
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
			cell: ({ getValue }) => (
				<EditableCell value={getValue() as string} onSave={handleUpdatePattern} />
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
		await addPattern({ data: newPattern });
		const { response } = await fetchOmitList();
		setData(response);
		setNewPattern('');
		// Maintain focus on the input
		inputRef.current?.focus();
	};

	const handleDelete = async (pattern: string) => {
		await deletePattern({ data: pattern });
		const { response } = await fetchOmitList();
		setData(response);
	};

	return (
		<main className="p-4 flex flex-col h-full">
			<Heading size="7" mb="4" as="h1">
				Browsing History Omit List
			</Heading>

			<div className="flex gap-2 mb-4">
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
			<ScrollArea>
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
			</ScrollArea>
		</main>
	);
}
