import { db } from '@/db/connections';
import { eq } from 'drizzle-orm';
import {
	AirtableSpaceSelectSchema,
	airtableSpaces,
	type AirtableSpaceSelect,
} from '@schema/integrations';
import {
	DataList,
	Text,
	Heading,
	Card,
	Button,
	TextField,
	SegmentedControl,
	TextArea,
} from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { useEffect, useState } from 'react';
import { indexEntries, IndexEntrySelect } from '@/db/schema/main';
import { IndexMainType } from '@/db/schema/main/types';
import { CheckboxWithLabel } from '@/app/components/CheckboxWithLabel';

export const Route = createFileRoute('/(index)/queue/$airtableId')({
	component: RouteComponent,
	loader: ({ params }) => fetchSpaceById({ data: params.airtableId }),
});

const createIndexEntryFromAirtableSpace = createServerFn({ method: 'POST' })
	.validator(AirtableSpaceSelectSchema)
	.handler(async ({ data }) => {
		const { id, name, contentCreatedAt, contentUpdatedAt, createdAt, updatedAt } = data;

		const titleCaseName = name.replace(/\b\w/g, (char) => char.toUpperCase());

		const [indexEntry] = await db
			.insert(indexEntries)
			.values({
				name: titleCaseName,
				mainType: 'category',
				createdAt: contentCreatedAt ?? createdAt,
				updatedAt: contentUpdatedAt ?? updatedAt,
			})
			.returning();

		await db
			.update(airtableSpaces)
			.set({
				indexEntryId: indexEntry.id,
			})
			.where(eq(airtableSpaces.id, id));

		return indexEntry;
	});

const fetchSpaceById = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: airtableId }) => {
		const space = await db.query.airtableSpaces.findFirst({
			where: eq(airtableSpaces.id, airtableId),
			with: {
				indexEntry: true,
			},
		});

		if (!space) {
			throw new Error('Record not found');
		}

		return space;
	});

const archiveSpace = createServerFn({ method: 'POST' })
	.validator((data: { spaceId: string }) => data)
	.handler(async ({ data: { spaceId } }) => {
		await db
			.update(airtableSpaces)
			.set({ archivedAt: new Date() })
			.where(eq(airtableSpaces.id, spaceId));
	});

function RouteComponent() {
	const space = Route.useLoaderData();
	const [indexEntry, setIndexEntry] = useState<IndexEntrySelect | null>(space.indexEntry);

	useEffect(() => {
		setIndexEntry(space.indexEntry);
	}, [space]);

	return (
		<Card className="flex gap-2 shrink basis-full">
			<div className="flex flex-col max-w-sm gap-4">
				<Heading size="4">Selected Space</Heading>
				{!space ? (
					<Text>Not Found.</Text>
				) : (
					<DataList.Root className="border-y border-gray-a4 py-4">
						{Object.entries(space).map(([key, value]) => (
							<DataList.Item key={key}>
								<DataList.Label>{key}</DataList.Label>
								<DataList.Value>
									{value ? (
										value instanceof Date ? (
											value.toLocaleString()
										) : (
											String(value)
										)
									) : (
										<Text color="gray">—</Text>
									)}
								</DataList.Value>
							</DataList.Item>
						))}
					</DataList.Root>
				)}
				<Button variant="soft" onClick={() => archiveSpace({ data: { spaceId: space.id } })}>
					Archive
				</Button>
			</div>
			<div className="flex flex-col gap-4 grow pl-3 ml-3 border-l border-gray-a4">
				<Heading size="4">Index Entry</Heading>
				{indexEntry ? (
					<IndexEntryForm indexEntry={indexEntry} space={space} />
				) : (
					<NoIndexEntry space={space} setIndexEntry={setIndexEntry} />
				)}
			</div>
		</Card>
	);
}

const IndexEntryForm = ({
	indexEntry,
	space,
}: {
	indexEntry: IndexEntrySelect;
	space: AirtableSpaceSelect;
}) => {
	const [{ private: isPrivate, name, shortName, notes, sense, mainType, subType }, setIndexEntry] =
		useState(indexEntry);
	return (
		<form className="flex flex-col gap-2">
			<label className="flex flex-col gap-1">
				<Text size="2" color="gray">
					Main Type
				</Text>
				<SegmentedControl.Root
					variant="classic"
					value={mainType}
					onValueChange={(value) =>
						setIndexEntry({ ...indexEntry, mainType: value as IndexMainType })
					}
				>
					<SegmentedControl.Item value="entity">Entity</SegmentedControl.Item>
					<SegmentedControl.Item value="category">Category</SegmentedControl.Item>
					<SegmentedControl.Item value="format">Format</SegmentedControl.Item>
				</SegmentedControl.Root>
			</label>
			<label>
				<Text size="2" color="gray">
					Name
				</Text>
				<TextField.Root
					value={name}
					onChange={(e) => setIndexEntry({ ...indexEntry, name: e.target.value })}
				/>
			</label>
			<label>
				<Text size="2" color="gray">
					Short Name
				</Text>
				<TextField.Root
					value={shortName || ''}
					onChange={(e) => setIndexEntry({ ...indexEntry, shortName: e.target.value })}
				/>
			</label>
			<label>
				<Text size="2" color="gray">
					Sense
				</Text>
				<TextField.Root
					value={sense || ''}
					onChange={(e) => setIndexEntry({ ...indexEntry, sense: e.target.value })}
				/>
			</label>
			<label>
				<Text size="2" color="gray">
					Notes
				</Text>
				<TextArea
					value={notes || ''}
					onChange={(e) => setIndexEntry({ ...indexEntry, notes: e.target.value })}
				/>
			</label>
			<CheckboxWithLabel
				className="mt-2"
				label="Private"
				checked={isPrivate}
				onChange={() => setIndexEntry({ ...indexEntry, private: !isPrivate })}
			/>
		</form>
	);
};

const NoIndexEntry = ({
	space,
	setIndexEntry,
}: {
	space: AirtableSpaceSelect;
	setIndexEntry: (indexEntry: IndexEntrySelect) => void;
}) => {
	return (
		<div className="rounded-2 p-4 align-center justify-center flex flex-col border border-gray-a4 text-center gap-2">
			<Text>No index entry found for this space.</Text>
			<Button
				onClick={async () => {
					const indexEntry = await createIndexEntryFromAirtableSpace({ data: space });
					setIndexEntry(indexEntry);
				}}
			>
				Create Index Entry
			</Button>
		</div>
	);
};
