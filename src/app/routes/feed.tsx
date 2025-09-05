import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import type { RouterOutputs } from '@/server/api/root';
import { Button } from '@/components/button';
import { Label } from '@/components/label';
import { Slider } from '@/components/slider';
import { Spinner } from '@/components/spinner';

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

export const Route = createFileRoute('/feed')({
	component: FeedClusters,
});

function FeedClusters() {
	const [targetClusters, setTargetClusters] = useState(6);
	const [entryLimit, setEntryLimit] = useState(250);
	const { data, isLoading, isError } = trpc.feedEntries.latest.useQuery({ limit: entryLimit });
	const summarize = trpc.feedEntries.summarize.useMutation();
	type Entry = RouterOutputs['feedEntries']['latest'][number];
	const [clusters, setClusters] = useState<Entry[][]>([]);
	const [summaries, setSummaries] = useState<string[]>([]);

	useEffect(() => {
		if (!data || data.length === 0) return;
		const k = Math.min(targetClusters, data.length);
		const vectors = data.map((e) => e.textEmbedding as number[]);
		const assignments = kmeans(vectors, k);
		const groups = Array.from({ length: k }, () => [] as Entry[]);
		assignments.forEach((c, i) => {
			groups[c]!.push(data[i]!);
		});
		setClusters(groups);
		// Reset summaries when clusters change
		setSummaries([]);
	}, [data, targetClusters]);

	const handleSummarizeAll = () => {
		if (clusters.length === 0) return;
		summarize.mutate(
			{ clusters: clusters.map((group) => group.map((e) => e.id)) },
			{
				onSuccess: (res) => setSummaries(res.summaries),
			}
		);
	};

	return (
		<main className="flex flex-col gap-4 overflow-y-auto p-4">
			<div className="bg-c-surface flex flex-wrap gap-6 rounded-sm border border-c-divider p-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="clusters-slider" className="text-sm">
						Number of Clusters: {targetClusters}
					</Label>
					<Slider
						id="clusters-slider"
						value={[targetClusters]}
						onValueChange={(value) => setTargetClusters(value[0] ?? targetClusters)}
						min={2}
						max={12}
						step={1}
						className="w-48"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="entries-slider" className="text-sm">
						Feed Entries: {entryLimit}
					</Label>
					<Slider
						id="entries-slider"
						value={[entryLimit]}
						onValueChange={(value) => setEntryLimit(value[0] ?? entryLimit)}
						min={50}
						max={1000}
						step={10}
						className="w-48"
					/>
				</div>
				{!isLoading && clusters.length > 0 && (
					<div className="ml-auto">
						<Button onClick={handleSummarizeAll} disabled={summarize.isPending}>
							{summarize.isPending ? <Spinner /> : 'Summarize All Clusters'}
						</Button>
					</div>
				)}
			</div>
			{isLoading && <Spinner />}
			{isError && <p>Error loading entries.</p>}
			{!isLoading && data && data.length > 0 && (
				<div className="text-sm text-c-secondary">
					Showing {data.length} entries in {clusters.length} clusters
				</div>
			)}
			{!isLoading &&
				clusters.map((group, idx) => (
					<div key={idx} className="rounded-sm border border-c-divider p-2">
						<h2 className="mb-2 font-bold">Cluster {idx + 1}</h2>
						{summaries[idx] && <p className="mb-2 whitespace-pre-wrap">{summaries[idx]}</p>}
						<div
							className="grid gap-x-4 gap-y-3 text-sm"
							style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(30ch, 1fr))' }}
						>
							{group.map((e) => {
								const dateToShow = e.publishedAt || e.recordCreatedAt;
								let formattedDate = '';

								if (dateToShow) {
									const date = typeof dateToShow === 'string' ? new Date(dateToShow) : dateToShow;
									formattedDate = date.toLocaleDateString('en-US', {
										year: 'numeric',
										month: 'short',
										day: 'numeric',
									});
								}

								return (
									<div key={e.id} className="min-w-0">
										<a
											href={e.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-c-link line-clamp-2 underline"
											title={e.title ?? e.url}
										>
											{e.title ?? e.url}
										</a>
										<div className="text-c-dim mt-1 text-xs">
											{formattedDate && <div>{formattedDate}</div>}
											{e.author && <div>{e.author}</div>}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
		</main>
	);
}
