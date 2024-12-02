import { createConnection, browsingHistoryOmitList } from '@rcr/database';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Container, Heading, Table, Button, TextField } from '@radix-ui/themes';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { eq } from 'drizzle-orm';

type OmitPattern = {
	pattern: string;
	createdAt: Date;
	updatedAt: Date | null;
};

const fetchOmitList = createServerFn({ method: 'GET' }).handler(async () => {
	const db = createConnection();
	const patterns = await db.select().from(browsingHistoryOmitList);
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

function OmitListPage() {
	const { response: initialData } = Route.useLoaderData();
	const [data, setData] = useState<OmitPattern[]>(initialData);
	const [newPattern, setNewPattern] = useState('');

	const columns: ColumnDef<OmitPattern>[] = [
		{
			accessorKey: 'pattern',
			header: 'Pattern',
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
	});

	const handleAdd = async () => {
		if (!newPattern) return;
		await addPattern({ data: { pattern: newPattern } });
		const { response } = await fetchOmitList();
		setData(response);
		setNewPattern('');
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
					style={{ flex: 1 }}
					placeholder="Enter URL pattern to omit..."
					value={newPattern}
					onChange={(e) => setNewPattern(e.target.value)}
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
