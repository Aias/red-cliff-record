import { useMemo, useRef, useState } from 'react';
import { Button, Heading, ScrollArea, Spinner, TextField } from '@radix-ui/themes';
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { createServerFn } from '@tanstack/start';
import { eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DataGrid } from '~/app/components/DataGrid';
import { db } from '~/db/connections';
import { arcBrowsingHistory, arcBrowsingHistoryOmitList } from '~//db/schema/integrations';

type OmitPattern = {
	pattern: string;
	createdAt: Date;
	updatedAt: Date | null;
};

const fetchOmitList = createServerFn({ method: 'GET' }).handler(async () => {
	const patterns = await db
		.select({
			pattern: arcBrowsingHistoryOmitList.pattern,
			createdAt: arcBrowsingHistoryOmitList.createdAt,
			updatedAt: arcBrowsingHistoryOmitList.updatedAt,
		})
		.from(arcBrowsingHistoryOmitList)
		.orderBy(arcBrowsingHistoryOmitList.pattern);

	return patterns;
});

const fetchPatternCounts = createServerFn({ method: 'GET' }).handler(async () => {
	const counts = await db
		.select({
			pattern: arcBrowsingHistoryOmitList.pattern,
			matchCount: db.$count(
				arcBrowsingHistory,
				ilike(arcBrowsingHistory.url, sql`${arcBrowsingHistoryOmitList.pattern}`)
			),
		})
		.from(arcBrowsingHistoryOmitList)
		.orderBy(arcBrowsingHistoryOmitList.pattern);

	return Object.fromEntries(counts.map(({ pattern, matchCount }) => [pattern, matchCount]));
});

export const omitListQueryOptions = () =>
	queryOptions({
		queryKey: ['omitList'],
		queryFn: () => fetchOmitList(),
	});

const addPattern = createServerFn({ method: 'POST' })
	.validator(z.string())
	.handler(async ({ data }) => {
		const [result] = await db
			.insert(arcBrowsingHistoryOmitList)
			.values({
				pattern: data,
			})
			.returning();
		return result;
	});

const updatePattern = createServerFn({ method: 'POST' })
	.validator(z.object({ oldPattern: z.string(), newPattern: z.string() }))
	.handler(async ({ data }) => {
		const [result] = await db
			.update(arcBrowsingHistoryOmitList)
			.set({
				pattern: data.newPattern,
				updatedAt: new Date(),
			})
			.where(eq(arcBrowsingHistoryOmitList.pattern, data.oldPattern))
			.returning();
		return result;
	});

const deletePattern = createServerFn({ method: 'POST' })
	.validator(z.string())
	.handler(async ({ data }) => {
		await db.delete(arcBrowsingHistoryOmitList).where(eq(arcBrowsingHistoryOmitList.pattern, data));
		return { success: true };
	});

export const Route = createFileRoute('/omit-list')({
	loader: ({ context }) => context.queryClient.ensureQueryData(omitListQueryOptions()),
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
	const queryClient = useQueryClient();
	const { data: patterns } = useSuspenseQuery(omitListQueryOptions());
	const { data: counts, isFetching: isLoadingCounts } = useQuery({
		queryKey: ['omitListCounts'],
		queryFn: () => fetchPatternCounts(),
	});
	const [newPattern, setNewPattern] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const addPatternMutation = useMutation({
		mutationFn: (pattern: string) => addPattern({ data: pattern }),
		onSuccess: (newPattern) => {
			queryClient.setQueryData(['omitList'], (old: typeof patterns) => [...old, newPattern]);
			queryClient.invalidateQueries({ queryKey: ['omitListCounts'] });
			setNewPattern('');
			inputRef.current?.focus();
		},
	});

	const updatePatternMutation = useMutation({
		mutationFn: (params: { oldPattern: string; newPattern: string }) =>
			updatePattern({ data: params }),
		onSuccess: (updatedPattern, variables) => {
			queryClient.setQueryData(['omitList'], (old: typeof patterns) =>
				old.map((p) => (p.pattern === variables.oldPattern ? updatedPattern : p))
			);
			queryClient.invalidateQueries({ queryKey: ['omitListCounts'] });
		},
	});

	const deletePatternMutation = useMutation({
		mutationFn: (pattern: string) => deletePattern({ data: pattern }),
		onSuccess: (_, deletedPattern) => {
			queryClient.setQueryData(['omitList'], (old: typeof patterns) =>
				old.filter((p) => p.pattern !== deletedPattern)
			);
			queryClient.invalidateQueries({ queryKey: ['omitListCounts'] });
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
							updatePatternMutation.mutate({ oldPattern: oldValue, newPattern: newValue })
						}
					/>
				),
			},
			{
				accessorKey: 'matchCount',
				header: 'Matches',
				cell: ({ row }) => {
					if (isLoadingCounts) return <Spinner size="2" />;
					return counts?.[row.original.pattern] ?? 0;
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
		[counts, isLoadingCounts]
	);

	const handleAdd = () => {
		if (!newPattern) return;
		addPatternMutation.mutate(newPattern);
	};

	return (
		<main className="flex basis-full flex-col overflow-hidden p-4">
			<Heading size="7" mb="4" as="h1">
				Browsing History Omit List
			</Heading>

			<div className="mb-4 flex gap-2">
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
				<DataGrid
					data={patterns}
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
