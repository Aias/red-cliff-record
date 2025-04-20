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

	// GIF: ASCII “GIF”
	if (view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46) {
		const width = view.getUint16(6, true);
		const height = view.getUint16(8, true);
		return { format: 'gif', width, height, size };
	}

	// BMP: ASCII “BM”
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
		const chunk = String.fromCharCode(
			view.getUint8(12),
			view.getUint8(13),
			view.getUint8(14),
			view.getUint8(15)
		);
		if (chunk === 'VP8X') {
			const w = getUint24LE(21) + 1;
			const h = getUint24LE(24) + 1;
			return { format: 'webp', width: w, height: h, size };
		}
		if (chunk === 'VP8L') {
			const bits = view.getUint32(20, true);
			const w = (bits & 0x3fff) + 1;
			const h = ((bits >> 14) & 0x3fff) + 1;
			return { format: 'webp', width: w, height: h, size };
		}
		throw new Error('Unsupported WebP variant (only VP8X & VP8L supported)');
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
