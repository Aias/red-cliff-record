import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Heading, ScrollArea, Spinner, TextField } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { DataGrid } from '~/app/components/DataGrid';
import { EditableCell } from '~/app/components/DataGrid';
import { trpc } from '~/app/trpc';

type OmitPattern = {
	pattern: string;
	createdAt: Date;
	updatedAt: Date | null;
	matchCount: number;
};

export const Route = createFileRoute('/omit-list')({
	loader: ({ context: { queryClient, trpc } }) =>
		queryClient.ensureQueryData(trpc.omitList.getList.queryOptions()),
	component: OmitListPage,
});

function OmitListPage() {
	const [patterns] = trpc.omitList.getList.useSuspenseQuery();
	const trpcUtils = trpc.useUtils();
	const { data: counts, isFetching: isLoadingCounts } = trpc.omitList.getCounts.useQuery();

	const tableData = useMemo(
		() =>
			patterns.map((pattern) => ({
				...pattern,
				matchCount: counts?.find((c) => c.pattern === pattern.pattern)?.matchCount ?? 0,
			})),
		[patterns, counts]
	);

	const [newPattern, setNewPattern] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const addPatternMutation = trpc.omitList.createPattern.useMutation({
		onSuccess: async () => {
			setNewPattern('');
			trpcUtils.omitList.getList.refetch();
			trpcUtils.omitList.getCounts.refetch();
		},
	});

	const updatePatternMutation = trpc.omitList.updatePattern.useMutation({
		onSuccess: async () => {
			trpcUtils.omitList.getList.refetch();
			trpcUtils.omitList.getCounts.refetch();
		},
	});

	const deletePatternMutation = trpc.omitList.deletePattern.useMutation({
		onSuccess: () => {
			trpcUtils.omitList.getList.refetch();
		},
	});

	const columns = useMemo<ColumnDef<OmitPattern>[]>(
		() => [
			{
				accessorKey: 'pattern',
				header: 'Pattern',
				cell: ({ getValue }) => (
					<EditableCell
						value={getValue() as string}
						onSave={(oldValue, newValue) =>
							updatePatternMutation.mutate({
								oldPattern: oldValue,
								newPattern: newValue,
							})
						}
					/>
				),
			},
			{
				accessorKey: 'matchCount',
				header: 'Matches',
				cell: ({ row }) => {
					if (isLoadingCounts) return <Spinner size="2" />;
					return row.original.matchCount ?? 0;
				},
				meta: {
					columnProps: {
						align: 'right',
					},
				},
			},
			{
				accessorKey: 'createdAt',
				header: 'Created',
				cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
			},
			{
				accessorKey: 'updatedAt',
				header: 'Last Updated',
				cell: ({ getValue }) => {
					const value = getValue() as string | null;
					return value ? new Date(value).toLocaleString() : 'Never';
				},
			},
			{
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => (
					<Button
						color="red"
						variant="soft"
						onClick={() => deletePatternMutation.mutate(row.original.pattern)}
					>
						Delete
					</Button>
				),
				meta: {
					columnProps: {
						align: 'center',
					},
				},
			},
		],
		[isLoadingCounts]
	);

	const handleAdd = useCallback(() => {
		if (!newPattern) return;
		addPatternMutation.mutate(newPattern);
	}, [newPattern, addPatternMutation]);

	return (
		<main className="flex basis-full flex-col overflow-hidden p-4">
			<Heading size="7" mb="4" as="h1">
				Browsing History Omit List
			</Heading>

			<form className="mb-4 flex gap-2">
				<TextField.Root
					ref={inputRef}
					style={{ flex: 1 }}
					type="text"
					placeholder="Enter URL pattern to omit..."
					value={newPattern}
					onChange={(e) => setNewPattern(e.target.value)}
				/>
				<Button
					type="submit"
					onClick={(e) => {
						e.preventDefault();
						handleAdd();
					}}
				>
					Add Pattern
				</Button>
			</form>
			<ScrollArea>
				<DataGrid
					data={tableData}
					columns={columns}
					sorting={true}
					getRowId={(row) => row.pattern}
					rowProps={{
						align: 'center',
					}}
				/>
			</ScrollArea>
		</main>
	);
}
