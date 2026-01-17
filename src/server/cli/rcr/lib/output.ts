/**
 * Output formatting for the CLI
 * JSON by default, table format for human debugging
 */

import { formatErrorResult } from './errors';
import type { OutputFormat, ResultMeta, ResultValue, SuccessResult } from './types';

type RecordValue = { [key: string]: ResultValue };

function isRecordValue(value: ResultValue): value is RecordValue {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

export function formatOutput<T extends ResultValue>(
  result: SuccessResult<T>,
  format: OutputFormat,
  raw = false
): string {
  if (format === 'table') {
    return formatTable(result.data, raw ? undefined : result.meta);
  }
  // Raw mode: output just the data without wrapper
  if (raw) {
    return JSON.stringify(result.data);
  }
  return JSON.stringify(result);
}

export function formatError(error: Error | string, format: OutputFormat): string {
  const result = formatErrorResult(error);
  if (format === 'table') {
    return `ERROR [${result.error.code}]: ${result.error.message}`;
  }
  return JSON.stringify(result);
}

function formatTable(data: ResultValue, meta?: ResultMeta): string {
  const lines: string[] = [];

  if (Array.isArray(data)) {
    if (data.length === 0) {
      lines.push('(no results)');
    } else {
      const recordValues = data.filter((item): item is RecordValue => isRecordValue(item));
      if (recordValues.length === data.length) {
        lines.push(formatArrayAsTable(recordValues));
      } else {
        lines.push(data.map((item) => formatCellValue(item, 80)).join('\n'));
      }
    }
  } else if (isRecordValue(data)) {
    lines.push(formatObjectAsTable(data));
  } else {
    lines.push(String(data));
  }

  if (meta) {
    const metaParts: string[] = [];
    if (meta.count !== undefined) metaParts.push(`count: ${meta.count}`);
    if (meta.total !== undefined) metaParts.push(`total: ${meta.total}`);
    if (meta.limit !== undefined) metaParts.push(`limit: ${meta.limit}`);
    if (meta.offset !== undefined) metaParts.push(`offset: ${meta.offset}`);
    if (meta.duration !== undefined) metaParts.push(`duration: ${meta.duration}ms`);
    if (metaParts.length > 0) {
      lines.push('');
      lines.push(`[${metaParts.join(', ')}]`);
    }
  }

  return lines.join('\n');
}

function formatArrayAsTable(data: RecordValue[]): string {
  if (data.length === 0) return '(empty)';

  // Get all keys from all objects
  const keys = new Set<string>();
  for (const item of data) {
    for (const key of Object.keys(item)) {
      keys.add(key);
    }
  }

  // Prioritize common fields for display
  const priorityKeys = ['id', 'type', 'title', 'name', 'slug', 'rating', 'similarity', 'url'];
  const orderedKeys = [
    ...priorityKeys.filter((k) => keys.has(k)),
    ...[...keys].filter((k) => !priorityKeys.includes(k)).slice(0, 3), // Add up to 3 more
  ];

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const key of orderedKeys) {
    widths[key] = key.length;
    for (const item of data) {
      const value = formatCellValue(key in item ? item[key] : null);
      widths[key] = Math.max(widths[key]!, value.length);
    }
    widths[key] = Math.min(widths[key]!, 40); // Max width
  }

  // Build table
  const lines: string[] = [];

  // Header
  const header = orderedKeys.map((k) => k.padEnd(widths[k]!)).join('  ');
  lines.push(header);
  lines.push(orderedKeys.map((k) => '-'.repeat(widths[k]!)).join('  '));

  // Rows
  for (const item of data) {
    const row = orderedKeys
      .map((k) => {
        const value = formatCellValue(k in item ? item[k] : null);
        return value.slice(0, widths[k]).padEnd(widths[k]!);
      })
      .join('  ');
    lines.push(row);
  }

  return lines.join('\n');
}

function formatObjectAsTable(data: RecordValue): string {
  const lines: string[] = [];
  const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    const formattedValue = formatCellValue(value, 80);
    lines.push(`${key.padEnd(maxKeyLen)}  ${formattedValue}`);
  }

  return lines.join('\n');
}

function formatCellValue(value: ResultValue, maxLen = 40): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0] ?? '';
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') return '{...}';

  const str = String(value);
  if (str.length > maxLen) {
    return str.slice(0, maxLen - 3) + '...';
  }
  return str;
}

/**
 * Wrap a successful result
 */
export function success<T extends ResultValue>(data: T, meta?: ResultMeta): SuccessResult<T> {
  return { data, meta };
}
