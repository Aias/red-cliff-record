import { useState } from 'react';
import { z } from 'zod';
import { CopyIcon } from './icons';
import { ScrollArea } from './ui/scroll-area';
import {
	Button,
	DataList,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from './';

interface MetadataListProps extends DataList.RootProps {
	metadata: Record<string, unknown>;
}

const urlSchema = z.string().url();

export const MetadataList = ({ metadata, ...props }: MetadataListProps) => {
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const copyToClipboard = (value: unknown) => {
		const stringValue = value instanceof Object ? JSON.stringify(value, null, 2) : String(value);
		navigator.clipboard.writeText(stringValue);
	};

	const handleCopy = (key: string, value: unknown) => {
		copyToClipboard(value);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	const formatValue = (value: unknown) => {
		if (!value) return null;
		if (value instanceof Date) return value.toLocaleString();
		if (value instanceof Object) {
			return (
				<pre className="block text-[0.875em] break-all whitespace-pre-wrap text-rcr-secondary">
					{JSON.stringify(value, null, 2)}
				</pre>
			);
		}
		if (value instanceof Array) return value.join(', ');

		const stringValue = String(value);
		const urlResult = urlSchema.safeParse(stringValue);
		if (urlResult.success) {
			return (
				<a href={urlResult.data} target="_blank" rel="noopener noreferrer">
					{stringValue}
				</a>
			);
		}
		return stringValue;
	};

	return (
		<DataList.Root {...props}>
			{Object.entries(metadata).map(([key, value]) => (
				<DataList.Item key={key}>
					<DataList.Label>{key}</DataList.Label>
					<DataList.Value className="group relative">
						{value ? (
							<div className="flex items-baseline gap-2">
								<div className="flex-1" onClick={() => handleCopy(key, value)}>
									{formatValue(value)}
								</div>
								{copiedKey === key ? (
									<div className="absolute top-0 right-0 text-xs text-rcr-hint">Copied!</div>
								) : (
									<CopyIcon className="absolute right-0 text-rcr-hint opacity-0 transition-opacity group-hover:opacity-100" />
								)}
							</div>
						) : (
							<span className="text-rcr-hint">—</span>
						)}
					</DataList.Value>
				</DataList.Item>
			))}
		</DataList.Root>
	);
};

interface MetadataDialogButtonProps {
	metadata: Record<string, unknown>;
	buttonText?: string;
	buttonProps?: Omit<React.ComponentProps<typeof Button>, 'onClick'>;
	description?: string;
}

export const MetadataDialogButton: React.FC<MetadataDialogButtonProps> = ({
	metadata,
	buttonText = 'Metadata',
	buttonProps,
	description = 'Metadata inspector',
}) => {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="sm" {...buttonProps}>
					{buttonText}
				</Button>
			</DialogTrigger>
			<DialogContent className="flex max-h-[90vh] max-w-[75vw] flex-col overflow-hidden px-0 py-5">
				<DialogHeader className="mb-3 border-b border-rcr-divider px-5 pb-3">
					<DialogTitle className="mb-0.5">Metadata</DialogTitle>
					<DialogDescription className="text-rcr-secondary">{description}</DialogDescription>
				</DialogHeader>
				<ScrollArea className="px-5">
					<MetadataList metadata={metadata} />
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};
