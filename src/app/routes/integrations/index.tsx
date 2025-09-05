import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircleIcon, CheckCircleIcon, PlayIcon, XCircleIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/card';
import { Spinner } from '@/components/spinner';

const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			const base64 = result.split(',')[1] ?? '';
			resolve(base64);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
};

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
	const [arcData, setArcData] = useState<string | undefined>(undefined);
	const [diaData, setDiaData] = useState<string | undefined>(undefined);
	const [twitterFiles, setTwitterFiles] = useState<string[]>([]);

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

	const handleRunRaindrop = () => {
		setMessages([]);
		raindropMutation.mutate();
	};

	const airtableMutation = trpc.integrations.runAirtable.useMutation({
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

	const handleRunAirtable = () => {
		setMessages([]);
		airtableMutation.mutate();
	};

	const adobeMutation = trpc.integrations.runAdobe.useMutation({
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

	const handleRunAdobe = () => {
		setMessages([]);
		adobeMutation.mutate();
	};

	const readwiseMutation = trpc.integrations.runReadwise.useMutation({
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

	const handleRunReadwise = () => {
		setMessages([]);
		readwiseMutation.mutate();
	};

	const feedbinMutation = trpc.integrations.runFeedbin.useMutation({
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

	const handleRunFeedbin = () => {
		setMessages([]);
		feedbinMutation.mutate();
	};

	const githubMutation = trpc.integrations.runGithub.useMutation({
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

	const handleRunGithub = () => {
		setMessages([]);
		githubMutation.mutate();
	};

	const browsingMutation = trpc.integrations.runBrowsing.useMutation({
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

	const handleRunBrowsing = () => {
		setMessages([]);
		browsingMutation.mutate({ arc: arcData, dia: diaData });
	};

	const twitterMutation = trpc.integrations.runTwitter.useMutation({
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

	const handleRunTwitter = () => {
		setMessages([]);
		twitterMutation.mutate({ files: twitterFiles });
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Airtable</CardTitle>
						<CardDescription>Sync data from your Airtable base</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleRunAirtable}
							disabled={airtableMutation.isPending}
							className="flex items-center gap-2"
						>
							{airtableMutation.isPending ? (
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Adobe Lightroom</CardTitle>
						<CardDescription>Sync photos from your Lightroom album</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleRunAdobe}
							disabled={adobeMutation.isPending}
							className="flex items-center gap-2"
						>
							{adobeMutation.isPending ? (
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Readwise</CardTitle>
						<CardDescription>Sync highlights from Readwise</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleRunReadwise}
							disabled={readwiseMutation.isPending}
							className="flex items-center gap-2"
						>
							{readwiseMutation.isPending ? (
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Feedbin</CardTitle>
						<CardDescription>Sync RSS entries from Feedbin</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleRunFeedbin}
							disabled={feedbinMutation.isPending}
							className="flex items-center gap-2"
						>
							{feedbinMutation.isPending ? (
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Browser History</CardTitle>
						<CardDescription>Sync history from Arc and Dia</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="mb-2 flex flex-col gap-2">
							<input
								type="file"
								onChange={async (e) => {
									const f = e.target.files?.[0];
									if (f) setArcData(await fileToBase64(f));
								}}
							/>
							<input
								type="file"
								onChange={async (e) => {
									const f = e.target.files?.[0];
									if (f) setDiaData(await fileToBase64(f));
								}}
							/>
						</div>
						<Button
							onClick={handleRunBrowsing}
							disabled={browsingMutation.isPending}
							className="flex items-center gap-2"
						>
							{browsingMutation.isPending ? (
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Twitter</CardTitle>
						<CardDescription>Import local Twitter bookmarks</CardDescription>
					</CardHeader>
					<CardContent>
						<input
							type="file"
							multiple
							onChange={async (e) => {
								const files = e.target.files ? [...e.target.files] : [];
								const bases = await Promise.all(files.map(fileToBase64));
								setTwitterFiles(bases);
							}}
							className="mb-2"
						/>
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
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>GitHub</CardTitle>
						<CardDescription>Sync repositories and activity from GitHub</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleRunGithub}
							disabled={githubMutation.isPending}
							className="flex items-center gap-2"
						>
							{githubMutation.isPending ? (
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
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
