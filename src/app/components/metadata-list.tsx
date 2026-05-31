import { CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import {
  DataListItem,
  DataListLabel,
  DataListRoot,
  DataListValue,
  type DataListRootProps,
} from './data-list';
import { ExternalLink } from './external-link';

interface MetadataListProps extends DataListRootProps {
  metadata: Record<string, unknown>;
}

const urlSchema = z.url();

export const MetadataList = ({ metadata, ...props }: MetadataListProps) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (value: unknown) => {
    const stringValue = value instanceof Object ? JSON.stringify(value, null, 2) : String(value);
    void navigator.clipboard.writeText(stringValue);
  };

  const handleCopy = (key: string, value: unknown) => {
    copyToClipboard(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toLocaleString();
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
      return (
        <pre className="block text-[0.875em] break-all whitespace-pre-wrap text-c-secondary">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    // At this point value is a primitive (string, number, boolean, symbol, bigint, function)
    if (typeof value === 'string') {
      const urlResult = urlSchema.safeParse(value);
      if (urlResult.success) {
        return <ExternalLink href={urlResult.data}>{value}</ExternalLink>;
      }
      return value;
    }
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'bigint') return value.toString();

    return null;
  };

  return (
    <DataListRoot {...props}>
      {Object.entries(metadata).map(([key, value]) => (
        <DataListItem key={key}>
          <DataListLabel>{key}</DataListLabel>
          <DataListValue className="group relative">
            {value === null || value === undefined ? (
              <span className="text-c-hint">—</span>
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="flex-1" onClick={() => handleCopy(key, value)}>
                  {formatValue(value)}
                </div>
                {copiedKey === key ? (
                  <div className="absolute top-0 right-0 text-xs text-c-hint">Copied!</div>
                ) : (
                  <CopyIcon
                    className="absolute right-0 text-c-hint opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Copy to clipboard"
                  />
                )}
              </div>
            )}
          </DataListValue>
        </DataListItem>
      ))}
    </DataListRoot>
  );
};
