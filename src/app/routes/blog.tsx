import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import type { RouterOutputs } from '@/server/api/root';

function euclideanDistance(a: number[], b: number[]) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		const diff = a[i]! - b[i]!;
		sum += diff * diff;
	}
	return Math.sqrt(sum);
}

function kmeans(points: number[][], k: number, maxIter = 100) {
	if (points.length === 0) {
		return [] as number[];
	}
	const centroids = points.slice(0, k).map((p) => [...p]);
	const assignments = new Array(points.length).fill(0);

	for (let iter = 0; iter < maxIter; iter++) {
		let changed = false;
		for (let i = 0; i < points.length; i++) {
			let min = Infinity;
			let best = 0;
			for (let j = 0; j < k; j++) {
				const dist = euclideanDistance(points[i]!, centroids[j]!);
				if (dist < min) {
					min = dist;
					best = j;
				}
			}
			if (assignments[i] !== best) {
				assignments[i] = best;
				changed = true;
			}
		}
		const sums = Array.from({ length: k }, () => new Array(points[0]!.length).fill(0));
		const counts = Array(k).fill(0);
		for (let i = 0; i < points.length; i++) {
			const cluster = assignments[i];
			counts[cluster]++;
			const p = points[i]!;
			const sum = sums[cluster]!;
			for (let d = 0; d < p.length; d++) {
				sum[d] += p[d];
			}
		}
		for (let j = 0; j < k; j++) {
			if (counts[j] > 0) {
				const sum = sums[j]!;
				centroids[j] = sum.map((v) => v / counts[j]!);
			}
		}
		if (!changed) break;
	}
	return assignments;
}

export const Route = createFileRoute('/blog')({
	component: BlogClusters,
});

function BlogClusters() {
	const { data, isLoading, isError } = trpc.feedEntries.latest.useQuery();
	const summarize = trpc.feedEntries.summarize.useMutation();
	type Entry = RouterOutputs['feedEntries']['latest'][number];
	const [clusters, setClusters] = useState<Entry[][]>([]);
	const [summaries, setSummaries] = useState<Record<number, string>>({});

	useEffect(() => {
		if (!data || data.length === 0) return;
		const desired = Math.max(2, Math.min(10, Math.round(Math.sqrt(data.length / 5))));
		const k = Math.min(desired, data.length);
		const vectors = data.map((e) => e.textEmbedding as number[]);
		const assignments = kmeans(vectors, k);
		const groups = Array.from({ length: k }, () => [] as Entry[]);
		assignments.forEach((c, i) => {
			groups[c]!.push(data[i]!);
		});
		setClusters(groups);
	}, [data]);

	return (
		<main className="flex flex-col gap-4 p-4">
			{isLoading && <p>Loading…</p>}
			{isError && <p>Error loading entries.</p>}
			{!isLoading &&
				clusters.map((group, idx) => (
					<div key={idx} className="rounded-sm border border-c-divider p-2">
						<div className="mb-2 flex items-center justify-between">
							<h2 className="font-bold">Cluster {idx + 1}</h2>
							<button
								className="rounded bg-c-primary px-2 py-1 text-white disabled:opacity-50"
								onClick={() =>
									summarize.mutate(
										{ ids: group.map((e) => e.id) },
										{
											onSuccess: (res) =>
												setSummaries((s) => ({
													...s,
													[idx]: res.summary,
												})),
										}
									)
								}
								disabled={summarize.isPending}
							>
								Summarize
							</button>
						</div>
						{summaries[idx] && <p className="mb-2 whitespace-pre-wrap">{summaries[idx]}</p>}
						<ul className="list-disc space-y-1 pl-5">
							{group.map((e) => (
								<li key={e.id}>
									<a
										href={e.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-c-link underline"
									>
										{e.title ?? e.url}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
		</main>
	);
}
