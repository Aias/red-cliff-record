import { createConnection, browsingHistoryDaily } from '@rcr/database';
import { eq, sql } from 'drizzle-orm';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';

const fetchHistoryForDate = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: date }) => {
		const db = createConnection();
		const history = await db
			.select()
			.from(browsingHistoryDaily)
			.where(eq(sql`DATE(${browsingHistoryDaily.date})`, date))
			.orderBy(browsingHistoryDaily.totalDuration);

		return { history };
	});

export const Route = createFileRoute('/history/$date')({
	loader: async ({ params: { date } }) => fetchHistoryForDate({ data: date }),
	component: DailyActivityPage,
});

function DailyActivityPage() {
	const { history } = Route.useLoaderData();

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-2xl font-bold mb-4">Browser History</h1>
			<div className="overflow-x-auto">
				<table className="min-w-full bg-white border border-gray-300">
					<thead>
						<tr className="bg-gray-100">
							<th className="px-4 py-2 text-left">URL</th>
							<th className="px-4 py-2 text-left">Page Title</th>
							<th className="px-4 py-2 text-right">Time on Page (mins)</th>
							<th className="px-4 py-2 text-right">Visit Count</th>
							<th className="px-4 py-2 text-left">First Visit</th>
							<th className="px-4 py-2 text-left">Last Visit</th>
						</tr>
					</thead>
					<tbody>
						{history.map((entry) => (
							<tr key={entry.url} className="border-t border-gray-300">
								<td className="px-4 py-2">
									<a
										href={entry.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:underline"
									>
										{new URL(entry.url).href}
									</a>
								</td>
								<td className="px-4 py-2">{entry.pageTitle}</td>
								<td className="px-4 py-2 text-right">{Math.round(entry.totalDuration / 60)}</td>
								<td className="px-4 py-2 text-right">{entry.visitCount}</td>
								<td className="px-4 py-2">{new Date(entry.firstVisit).toLocaleTimeString()}</td>
								<td className="px-4 py-2">{new Date(entry.lastVisit).toLocaleTimeString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
