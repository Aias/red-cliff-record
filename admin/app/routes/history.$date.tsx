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
			.orderBy(browsingHistoryDaily.url);

		return { response: history };
	});

export const Route = createFileRoute('/history/$date')({
	loader: async ({ params: { date } }) => fetchHistoryForDate({ data: date }),
	component: DailyActivityPage,
});

function DailyActivityPage() {
	const { response } = Route.useLoaderData();
	const history = response.map((entry) => ({
		...entry,
		durationMinutes: entry.totalDuration / 60,
		url: new URL(entry.url),
	}));

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
						{history.map(
							({ pageTitle, durationMinutes, url, visitCount, firstVisit, lastVisit }) => (
								<tr key={`${url.href}-${pageTitle}`} className="border-t border-gray-300">
									<td className="px-4 py-2">
										<a
											href={url.href}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-600 hover:underline"
										>
											{`${url.hostname}${url.pathname}`}
										</a>
									</td>
									<td className="px-4 py-2">{pageTitle}</td>
									<td className="px-4 py-2 text-right">{Math.round(durationMinutes / 60)}</td>
									<td className="px-4 py-2 text-right">{visitCount}</td>
									<td className="px-4 py-2">{new Date(firstVisit).toLocaleTimeString()}</td>
									<td className="px-4 py-2">{new Date(lastVisit).toLocaleTimeString()}</td>
								</tr>
							)
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
