import { isNull } from 'drizzle-orm';
import { Table, Heading, ScrollArea } from '@radix-ui/themes';
import { airtableSpaces } from '@schema';
import { createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { db } from '@/db/connections';
import classNames from 'classnames';

const getAirtableSpaces = createServerFn({ method: 'GET' }).handler(async () => {
	const spaces = await db.query.airtableSpaces.findMany({
		with: {
			indexEntry: true,
		},
		where: isNull(airtableSpaces.archivedAt),
		limit: 100,
		orderBy: airtableSpaces.contentCreatedAt,
	});
	return spaces;
});

export const Route = createFileRoute('/(index)/queue')({
	loader: () => getAirtableSpaces(),
	component: RouteComponent,
});

function RouteComponent() {
	const spaces = Route.useLoaderData();
	const navigate = useNavigate();
	const { airtableId } = useParams({
		strict: false,
	});

	return (
		<main className="p-3 basis-full grow-0 h-full flex gap-2">
			<section className="flex flex-col gap-2 grow-0 shrink min-w-sm">
				<Heading size="4">Index Queue</Heading>
				<ScrollArea>
					<Table.Root variant="surface">
						<Table.Body>
							<Table.Row>
								<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Icon</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Full Name</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Source ID</Table.ColumnHeaderCell>
							</Table.Row>
							{spaces.map((space) => (
								<Table.Row
									key={space.id}
									className={classNames(
										'cursor-pointer',
										airtableId === space.id ? 'bg-accent-a2 hover:bg-accent-a3' : 'hover:bg-gray-a2'
									)}
									onClick={() =>
										navigate({
											to: '/queue/$airtableId',
											params: { airtableId: space.id },
										})
									}
								>
									<Table.RowHeaderCell>{space.name}</Table.RowHeaderCell>
									<Table.Cell>{space.icon}</Table.Cell>
									<Table.Cell>{space.fullName}</Table.Cell>
									<Table.Cell>{space.id}</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
				</ScrollArea>
			</section>
			<Outlet />
		</main>
	);
}
