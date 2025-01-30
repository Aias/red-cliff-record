import { useState } from 'react';
import { CopyIcon } from '@radix-ui/react-icons';
import { DataList, IconButton, Link, Text } from '@radix-ui/themes';
import { z } from 'zod';

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
					<Text as="span" color="gray" size="1">
						{JSON.stringify(value, null, 2)}
					</Text>
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
							<Text color="gray" className="text-hint">
								—
							</Text>
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
