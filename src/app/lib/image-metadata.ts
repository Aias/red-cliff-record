type ImageFormat = 'png' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'svg';

export interface ImageMetadata {
	format: ImageFormat;
	width: number;
	height: number;
	size: number;
}

export async function getImageMetadata(buffer: ArrayBuffer): Promise<ImageMetadata> {
	const view = new DataView(buffer);
	const size = buffer.byteLength;

	// helper to read 24‑bit little‑endian
	const getUint24LE = (off: number) =>
		view.getUint8(off) | (view.getUint8(off + 1) << 8) | (view.getUint8(off + 2) << 16);

	// PNG: signature 0x89 'PNG'
	if (view.getUint32(0) === 0x89504e47) {
		const width = view.getUint32(16, false);
		const height = view.getUint32(20, false);
		return { format: 'png', width, height, size };
	}

	// JPEG: SOI marker 0xFFD8
	if (view.getUint16(0) === 0xffd8) {
		let offset = 2;
		while (offset < view.byteLength) {
			if (view.getUint8(offset) !== 0xff) break;
			const marker = view.getUint8(offset + 1);
			const length = view.getUint16(offset + 2, false);
			// SOF0–SOF3 carry dimensions
			if (marker >= 0xc0 && marker <= 0xc3) {
				const height = view.getUint16(offset + 5, false);
				const width = view.getUint16(offset + 7, false);
				return { format: 'jpeg', width, height, size };
			}
			offset += 2 + length;
		}
		throw new Error('Invalid or unsupported JPEG');
	}

	// GIF: ASCII "GIF"
	if (view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46) {
		const width = view.getUint16(6, true);
		const height = view.getUint16(8, true);
		return { format: 'gif', width, height, size };
	}

	// BMP: ASCII "BM"
	if (view.getUint8(0) === 0x42 && view.getUint8(1) === 0x4d) {
		const width = view.getUint32(18, true);
		const height = view.getUint32(22, true);
		return { format: 'bmp', width, height, size };
	}

	// WebP: RIFF…WEBP
	const riff = String.fromCharCode(
		view.getUint8(0),
		view.getUint8(1),
		view.getUint8(2),
		view.getUint8(3)
	);
	const webp = String.fromCharCode(
		view.getUint8(8),
		view.getUint8(9),
		view.getUint8(10),
		view.getUint8(11)
	);
	if (riff === 'RIFF' && webp === 'WEBP') {
		let offset = 12; // Start scanning chunks after 'WEBP' identifier

		// First pass: Look for VP8X chunk, as it defines the canonical canvas dimensions
		while (offset + 8 <= view.byteLength) {
			// Ensure chunk header can be read
			const chunkId = String.fromCharCode(
				view.getUint8(offset),
				view.getUint8(offset + 1),
				view.getUint8(offset + 2),
				view.getUint8(offset + 3)
			);
			const chunkSize = view.getUint32(offset + 4, true);
			const payloadOffset = offset + 8;

			if (payloadOffset + chunkSize > view.byteLength) {
				throw new Error('WebP chunk size exceeds file bounds');
			}

			if (chunkId === 'VP8X') {
				if (chunkSize < 10) throw new Error('Invalid VP8X chunk size');
				const width = getUint24LE(payloadOffset + 4) + 1;
				const height = getUint24LE(payloadOffset + 7) + 1;
				return { format: 'webp', width, height, size }; // VP8X provides definitive dimensions
			}

			const padding = chunkSize % 2 === 1 ? 1 : 0;
			offset += 8 + chunkSize + padding; // Move to the next chunk
		}

		// Second pass: If VP8X wasn't found, look for VP8 (lossy) or VP8L (lossless)
		offset = 12; // Reset offset
		while (offset + 8 <= view.byteLength) {
			// Ensure chunk header can be read
			const chunkId = String.fromCharCode(
				view.getUint8(offset),
				view.getUint8(offset + 1),
				view.getUint8(offset + 2),
				view.getUint8(offset + 3)
			);
			const chunkSize = view.getUint32(offset + 4, true);
			const payloadOffset = offset + 8;

			if (payloadOffset + chunkSize > view.byteLength) {
				throw new Error('WebP chunk size exceeds file bounds');
			}

			if (chunkId === 'VP8 ') {
				// Simple lossy format
				if (chunkSize < 10) throw new Error('Invalid VP8 chunk size');
				// Dimensions are at offset 6 & 8 within the payload, lower 14 bits
				const width = view.getUint16(payloadOffset + 6, true) & 0x3fff;
				const height = view.getUint16(payloadOffset + 8, true) & 0x3fff;
				return { format: 'webp', width, height, size };
			} else if (chunkId === 'VP8L') {
				// Lossless format
				if (chunkSize < 5) throw new Error('Invalid VP8L chunk size');
				if (view.getUint8(payloadOffset) !== 0x2f) {
					// Check signature byte
					throw new Error('Invalid VP8L signature byte');
				}
				const bits = view.getUint32(payloadOffset + 1, true); // Read 4 bytes after signature
				const width = (bits & 0x3fff) + 1; // Low 14 bits
				const height = ((bits >> 14) & 0x3fff) + 1; // Next 14 bits
				return { format: 'webp', width, height, size };
			}

			const padding = chunkSize % 2 === 1 ? 1 : 0;
			offset += 8 + chunkSize + padding; // Move to the next chunk
		}

		// If no dimension-containing chunk (VP8X, VP8 , VP8L) was found
		throw new Error('WebP dimension chunk not found or file invalid');
	}

	// SVG: look for an <svg> tag in the first 2KB
	{
		const head = buffer.byteLength < 2048 ? buffer.byteLength : 2048;
		const text = new TextDecoder().decode(buffer.slice(0, head));
		const svgTag = /<svg[^>]*>/i.exec(text);
		if (svgTag) {
			const tag = svgTag[0];
			// try width/height attributes
			const wMatch = /width\s*=\s*["']?([\d.]+)(?:px)?["']?/i.exec(tag);
			const hMatch = /height\s*=\s*["']?([\d.]+)(?:px)?["']?/i.exec(tag);
			if (wMatch && hMatch) {
				const wStr = wMatch[1]!;
				const hStr = hMatch[1]!;
				return {
					format: 'svg',
					width: parseFloat(wStr),
					height: parseFloat(hStr),
					size,
				};
			}
			// fallback to viewBox
			const vbMatch = /viewBox\s*=\s*["']?([\d.\s]+)["']?/i.exec(tag);
			if (vbMatch) {
				const parts = vbMatch[1]!.trim().split(/\s+/).map(Number);
				const [, , wNum, hNum] = parts;
				if (wNum !== undefined && hNum !== undefined) {
					return {
						format: 'svg',
						width: wNum,
						height: hNum,
						size,
					};
				}
			}
			throw new Error('SVG missing explicit width/height or viewBox');
		}
	}

	throw new Error('Unsupported image format');
}
