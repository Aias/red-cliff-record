import { useState } from 'react';
import { Button, DataList, Dialog, IconButton, Link, ScrollArea } from '@radix-ui/themes';
import { z } from 'zod';
import { CopyIcon } from './icons';

interface MetadataListProps extends DataList.RootProps {
	metadata: Record<string, unknown>;
}

const urlSchema = z.string().url();

export const MetadataList = ({ metadata, className = '', ...props }: MetadataListProps) => {
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
				<pre className="block break-all whitespace-pre-wrap">
					<span className="text-sm text-secondary">{JSON.stringify(value, null, 2)}</span>
				</pre>
			);
		}
		if (value instanceof Array) return value.join(', ');

		const stringValue = String(value);
		const urlResult = urlSchema.safeParse(stringValue);
		if (urlResult.success) {
			return (
				<Link href={urlResult.data} target="_blank" rel="noopener noreferrer">
					{stringValue}
				</Link>
			);
		}
		return stringValue;
	};

	return (
		<DataList.Root className={`gap-2 ${className}`} {...props}>
			{Object.entries(metadata).map(([key, value]) => (
				<DataList.Item key={key}>
					<DataList.Label>{key}</DataList.Label>
					<DataList.Value className="group relative">
						{value ? (
							<div className="flex items-start gap-2">
								<div className="flex-1">{formatValue(value)}</div>
								<IconButton
									onClick={() => handleCopy(key, value)}
									className="opacity-0 transition-opacity group-hover:opacity-100"
									aria-label="Copy to clipboard"
									variant="ghost"
									size="1"
								>
									<CopyIcon className="text-hint" />
								</IconButton>
							</div>
						) : (
							<span className="text-hint">—</span>
						)}
						{copiedKey === key && (
							<div className="absolute top-0 right-0 text-xs text-hint">Copied!</div>
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
		<Dialog.Root>
			<Dialog.Trigger>
				<Button variant="soft" size="1" {...buttonProps}>
					{buttonText}
				</Button>
			</Dialog.Trigger>
			<Dialog.Content className="flex max-h-[90vh] max-w-[75vw] flex-col overflow-hidden p-5">
				<div className="mb-2 border-b border-divider pb-2">
					<Dialog.Title className="mb-2">Metadata</Dialog.Title>
					<Dialog.Description color="gray">{description}</Dialog.Description>
				</div>
				<ScrollArea scrollbars="vertical">
					<MetadataList metadata={metadata} />
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
};
