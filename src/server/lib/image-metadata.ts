export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  size: number;
}

const SVG_TAG_PATTERN = /<svg[^>]*>/i;
const SVG_WIDTH_PATTERN = /width\s*=\s*["']?([\d.]+)(?:px)?["']?/i;
const SVG_HEIGHT_PATTERN = /height\s*=\s*["']?([\d.]+)(?:px)?["']?/i;
const SVG_VIEWBOX_PATTERN = /viewBox\s*=\s*["']?([\d.\s]+)["']?/i;

// Bun.Image only handles raster formats; SVG needs a separate path.
function readSvgDimensions(
  buffer: ArrayBuffer
): { width: number; height: number } | null {
  const head = Math.min(buffer.byteLength, 2048);
  const text = new TextDecoder().decode(buffer.slice(0, head));
  const tagMatch = SVG_TAG_PATTERN.exec(text);
  if (!tagMatch) return null;

  const tag = tagMatch[0];
  const widthMatch = SVG_WIDTH_PATTERN.exec(tag);
  const heightMatch = SVG_HEIGHT_PATTERN.exec(tag);
  if (widthMatch && heightMatch) {
    return {
      width: parseFloat(widthMatch[1]!),
      height: parseFloat(heightMatch[1]!),
    };
  }

  const viewBoxMatch = SVG_VIEWBOX_PATTERN.exec(tag);
  if (viewBoxMatch) {
    const [, , width, height] = viewBoxMatch[1]!.trim().split(/\s+/).map(Number);
    if (width !== undefined && height !== undefined) {
      return { width, height };
    }
  }

  throw new Error('SVG missing explicit width/height or viewBox');
}

export async function getImageMetadata(buffer: ArrayBuffer): Promise<ImageMetadata> {
  const size = buffer.byteLength;

  const svgDimensions = readSvgDimensions(buffer);
  if (svgDimensions) {
    return { format: 'svg', ...svgDimensions, size };
  }

  const { width, height, format } = await new Bun.Image(buffer).metadata();
  return { format, width, height, size };
}
