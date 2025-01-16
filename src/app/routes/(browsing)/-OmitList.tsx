import { useCallback, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { Button, ScrollArea, Spinner, TextField } from '@radix-ui/themes';
import type { ColumnDef } from '@tanstack/react-table';
import { DataGrid } from '~/app/components/DataGrid';
import { EditableCell } from '~/app/components/DataGrid';
import { Placeholder } from '~/app/components/Placeholder';
import { trpc } from '~/app/trpc';

type OmitPattern = {
	pattern: string;
	createdAt: Date;
	updatedAt: Date | null;
	matchCount: number;
};

export const OmitList = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => {
	const { data: patterns } = trpc.history.getOmitList.useQuery();
	const trpcUtils = trpc.useUtils();
	const { data: counts, isFetching: isFetchingCounts } = trpc.history.getOmittedCounts.useQuery();

	const tableData = useMemo(
		() =>
			patterns?.map((pattern) => ({
				...pattern,
				matchCount: counts?.find((c) => c.pattern === pattern.pattern)?.matchCount ?? 0,
			})),
		[patterns, counts]
	);

	const [newPattern, setNewPattern] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const addPatternMutation = trpc.history.createOmitPattern.useMutation({
		onSuccess: async () => {
			setNewPattern('');
			trpcUtils.history.getOmitList.refetch();
			trpcUtils.history.getOmittedCounts.refetch();
		},
	});

	const updatePatternMutation = trpc.history.updateOmitPattern.useMutation({
		onSuccess: async () => {
			trpcUtils.history.getOmitList.refetch();
			trpcUtils.history.getOmittedCounts.refetch();
		},
	});

	const deletePatternMutation = trpc.history.deleteOmitPattern.useMutation({
		onSuccess: () => {
			trpcUtils.history.getOmitList.refetch();
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
					if (isFetchingCounts) return <Spinner size="2" />;
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
		[isFetchingCounts]
	);

	const handleAdd = useCallback(() => {
		if (!newPattern) return;
		addPatternMutation.mutate(newPattern);
	}, [newPattern, addPatternMutation]);

	return (
		<div className={`flex flex-col ${className}`} {...props}>
			{!tableData ? (
				<Placeholder>Loading patterns...</Placeholder>
			) : (
				<>
					<form className="mb-4 flex gap-2">
						<TextField.Root
							ref={inputRef}
							className="flex-1"
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
							rootProps={{
								variant: 'ghost',
							}}
						/>
					</ScrollArea>
				</>
			)}
		</div>
	);
};
