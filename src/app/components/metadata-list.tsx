import { CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { css, cx } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
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
        <styled.pre
          css={{
            display: 'block',
            fontSize: '[0.875em]',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            color: 'secondary',
          }}
        >
          {JSON.stringify(value, null, 2)}
        </styled.pre>
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
          <DataListValue
            className={cx(
              'group',
              css({
                position: 'relative',
              })
            )}
          >
            {value === null || value === undefined ? (
              <styled.span css={{ color: 'muted' }}>—</styled.span>
            ) : (
              <styled.div
                css={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '2',
                }}
              >
                <styled.div css={{ flex: '1' }} onClick={() => handleCopy(key, value)}>
                  {formatValue(value)}
                </styled.div>
                {copiedKey === key ? (
                  <styled.div
                    css={{
                      position: 'absolute',
                      insetBlockStart: '1/2',
                      translateCenter: 'y',
                      insetInlineEnd: '0',
                      textStyle: 'xs',
                      color: 'muted',
                    }}
                  >
                    Copied!
                  </styled.div>
                ) : (
                  <styled.span
                    data-slot="copy-icon"
                    css={{
                      position: 'absolute',
                      insetInlineEnd: '0',
                      insetBlockStart: '1/2',
                      translateCenter: 'y',
                      color: 'muted',
                      opacity: 0,
                      transitionProperty: '[opacity]',
                      transitionDuration: '150',
                      transitionTimingFunction: 'easeOut.quad',
                      _groupHover: {
                        opacity: 1,
                      },
                    }}
                  >
                    <CopyIcon aria-label="Copy to clipboard" />
                  </styled.span>
                )}
              </styled.div>
            )}
          </DataListValue>
        </DataListItem>
      ))}
    </DataListRoot>
  );
};
