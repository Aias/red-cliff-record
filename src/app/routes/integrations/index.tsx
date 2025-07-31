import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircleIcon, CheckCircleIcon, PlayIcon, XCircleIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { Spinner } from '@/components/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { readFileAsBase64 } from '@/lib/read-file';

export const Route = createFileRoute('/integrations/')({
	component: RouteComponent,
});

interface LogMessage {
	type: 'info' | 'error' | 'warn' | 'success';
	message: string;
	timestamp: Date;
}

function RouteComponent() {
	const [messages, setMessages] = useState<LogMessage[]>([]);

	const [browser, setBrowser] = useState<'arc' | 'dia'>('arc');
	const [historyFile, setHistoryFile] = useState<File | null>(null);
	const [twitterFiles, setTwitterFiles] = useState<FileList | null>(null);

	const raindropMutation = trpc.integrations.runRaindrop.useMutation({
		onSuccess: (data) => {
			setMessages(data.messages);
		},
		onError: (error) => {
			setMessages((prev) => [
				...prev,
				{
					type: 'error',
					message: error.message,
					timestamp: new Date(),
				},
			]);
		},
	});

	const browserMutation = trpc.integrations.runBrowserHistory.useMutation({
		onSuccess: (data) => {
			setMessages(data.messages);
		},
		onError: (error) => {
			setMessages([{ type: 'error', message: error.message, timestamp: new Date() }]);
		},
	});

	const twitterMutation = trpc.integrations.runTwitter.useMutation({
		onSuccess: (data) => {
			setMessages(data.messages);
		},
		onError: (error) => {
			setMessages([{ type: 'error', message: error.message, timestamp: new Date() }]);
		},
	});

	const handleRunRaindrop = () => {
		setMessages([]);
		raindropMutation.mutate();
	};

	const handleRunBrowser = async () => {
		setMessages([]);
		let fileData: string | undefined;
		let fileName: string | undefined;
		if (historyFile) {
			fileData = await readFileAsBase64(historyFile);
			fileName = historyFile.name;
		}
		browserMutation.mutate({ browser, fileData, fileName });
	};

	const handleRunTwitter = async () => {
		setMessages([]);
		const files: { fileName: string; fileData: string }[] = [];
		if (twitterFiles) {
			for (const f of Array.from(twitterFiles)) {
				files.push({ fileName: f.name, fileData: await readFileAsBase64(f) });
			}
		}
		twitterMutation.mutate({ files });
	};

	const getMessageIcon = (type: LogMessage['type']) => {
		switch (type) {
			case 'success':
				return <CheckCircleIcon className="size-4" />;
			case 'error':
				return <XCircleIcon className="size-4" />;
			case 'warn':
				return <AlertCircleIcon className="size-4" />;
			default:
				return <AlertCircleIcon className="size-4" />;
		}
	};

	const getAlertVariant = (type: LogMessage['type']): 'default' | 'destructive' | 'success' => {
		switch (type) {
			case 'success':
				return 'success';
			case 'error':
				return 'destructive';
			case 'warn':
			case 'info':
			default:
				return 'default';
		}
	};

	return (
		<div className="container mx-auto max-w-4xl p-6">
			<h1 className="mb-6 text-3xl font-bold">Integrations</h1>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Raindrop.io</CardTitle>
						<CardDescription>
							Sync bookmarks and collections from your Raindrop.io account
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<Button
								onClick={handleRunRaindrop}
								disabled={raindropMutation.isPending}
								className="flex items-center gap-2"
							>
								{raindropMutation.isPending ? (
									<>
										<Spinner className="size-4" />
										Running...
									</>
								) : (
									<>
										<PlayIcon className="size-4" />
										Run Sync
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Browser History</CardTitle>
						<CardDescription>Sync a browser history SQLite file</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center gap-2">
								<select
									value={browser}
									onChange={(e) => setBrowser(e.target.value as 'arc' | 'dia')}
									className="rounded border px-2 py-1"
								>
									<option value="arc">Arc</option>
									<option value="dia">Dia</option>
								</select>
								<input
									type="file"
									onChange={(e) => setHistoryFile(e.target.files?.[0] ?? null)}
									className="flex-1"
								/>
							</div>
							<Button
								onClick={handleRunBrowser}
								disabled={browserMutation.isPending}
								className="flex items-center gap-2"
							>
								{browserMutation.isPending ? (
									<>
										<Spinner className="size-4" />
										Running...
									</>
								) : (
									<>
										<PlayIcon className="size-4" />
										Run Sync
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Twitter Bookmarks</CardTitle>
						<CardDescription>
							Upload bookmarks JSON files from your Twitter data export
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<input type="file" multiple onChange={(e) => setTwitterFiles(e.target.files)} />
							<Button
								onClick={handleRunTwitter}
								disabled={twitterMutation.isPending}
								className="flex items-center gap-2"
							>
								{twitterMutation.isPending ? (
									<>
										<Spinner className="size-4" />
										Running...
									</>
								) : (
									<>
										<PlayIcon className="size-4" />
										Run Sync
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>

				{messages.length > 0 && (
					<div className="mt-4 space-y-2">
						<h3 className="text-sm font-medium text-c-secondary">Sync Log:</h3>
						<div className="max-h-96 space-y-1 overflow-y-auto">
							{messages.map((msg, index) => (
								<Alert key={index} variant={getAlertVariant(msg.type)}>
									{getMessageIcon(msg.type)}
									<AlertDescription className="flex items-center gap-2">
										<span className="font-mono text-sm font-medium">
											{msg.timestamp.toLocaleTimeString()}
										</span>
										{' - '}
										<span className="whitespace-pre-wrap">{msg.message}</span>
									</AlertDescription>
								</Alert>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
