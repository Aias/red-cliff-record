import React from 'react';
import type { MediaSelect } from '@/server/db/schema/media';
import { DeleteIcon } from './icons';
import { Button } from './ui/button';

interface ImageGridProps {
	media: MediaSelect[];
	className?: string;
	onDelete?: (media: MediaSelect) => void;
}

const ImageGrid: React.FC<ImageGridProps> = ({ media, className = '', onDelete }) => {
	// Limit to 8 images maximum
	const displayMedia = media.slice(0, 8);
	const count = displayMedia.length;

	if (count === 0) return null;

	return (
		<div
			className={`relative aspect-[3/2] w-full overflow-hidden rounded-md bg-rcr-background ${className}`}
			style={{
				display: 'grid',
				gridTemplateColumns: getGridColumns(count),
				gridTemplateRows: getGridRows(count),
			}}
		>
			{displayMedia.map((item, index) => (
				<div
					key={item.id}
					className="group relative overflow-hidden"
					style={{ gridArea: getGridArea(count, index) }}
				>
					{/* Gradient overlay that appears on hover */}
					<div className="absolute inset-0 z-10 bg-gradient-to-b from-black/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

					{/* Image */}
					<img
						src={item.url}
						alt={item.altText || `Image ${index + 1}`}
						className="h-full w-full object-cover"
					/>

					{/* Toolbar */}
					{onDelete && (
						<div className="absolute top-2 right-2 z-20 flex justify-end gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
							<Button
								onClick={() => onDelete(item)}
								size="icon"
								variant="ghost"
								aria-label="Delete image"
							>
								<DeleteIcon />
							</Button>
						</div>
					)}
				</div>
			))}
		</div>
	);
};

// Helper functions to determine grid layout
function getGridColumns(count: number): string {
	switch (count) {
		case 1:
			return '1fr';
		case 2:
			return '1fr 1fr';
		case 3:
			return '1fr 1fr';
		default:
			return '1fr 1fr';
	}
}

function getGridRows(count: number): string {
	switch (count) {
		case 1:
			return '1fr';
		case 2:
			return '1fr';
		case 3:
			return '1fr 1fr';
		default:
			return '1fr 1fr';
	}
}

function getGridArea(count: number, index: number): string {
	// Single image
	if (count === 1) return '1 / 1 / 2 / 2';

	// Two images - divide vertically
	if (count === 2) {
		return index === 0 ? '1 / 1 / 2 / 2' : '1 / 2 / 2 / 3';
	}

	// Three images - left column and right column divided horizontally
	if (count === 3) {
		if (index === 0) return '1 / 1 / 3 / 2'; // Left full height
		if (index === 1) return '1 / 2 / 2 / 3'; // Top right
		return '2 / 2 / 3 / 3'; // Bottom right
	}

	// Four images - divide in quarters
	if (count === 4) {
		if (index === 0) return '1 / 1 / 2 / 2'; // Top left
		if (index === 1) return '1 / 2 / 2 / 3'; // Top right
		if (index === 2) return '2 / 1 / 3 / 2'; // Bottom left
		return '2 / 2 / 3 / 3'; // Bottom right
	}

	// Five images - quarters plus bottom right divided
	if (count === 5) {
		if (index === 0) return '1 / 1 / 2 / 2'; // Top left
		if (index === 1) return '1 / 2 / 2 / 3'; // Top right
		if (index === 2) return '2 / 1 / 3 / 2'; // Bottom left
		if (index === 3) return '2 / 2 / 2.5 / 3'; // Bottom right top
		return '2.5 / 2 / 3 / 3'; // Bottom right bottom
	}

	// Six images - quarters plus both right cells divided
	if (count === 6) {
		if (index === 0) return '1 / 1 / 2 / 2'; // Top left
		if (index === 1) return '1 / 2 / 1.5 / 3'; // Top right top
		if (index === 2) return '1.5 / 2 / 2 / 3'; // Top right bottom
		if (index === 3) return '2 / 1 / 3 / 2'; // Bottom left
		if (index === 4) return '2 / 2 / 2.5 / 3'; // Bottom right top
		return '2.5 / 2 / 3 / 3'; // Bottom right bottom
	}

	// Seven images - quarters plus both right cells and bottom left divided
	if (count === 7) {
		if (index === 0) return '1 / 1 / 2 / 2'; // Top left
		if (index === 1) return '1 / 2 / 1.5 / 3'; // Top right top
		if (index === 2) return '1.5 / 2 / 2 / 3'; // Top right bottom
		if (index === 3) return '2 / 1 / 2.5 / 2'; // Bottom left top
		if (index === 4) return '2.5 / 1 / 3 / 2'; // Bottom left bottom
		if (index === 5) return '2 / 2 / 2.5 / 3'; // Bottom right top
		return '2.5 / 2 / 3 / 3'; // Bottom right bottom
	}

	// Eight images - all cells divided
	if (count === 8) {
		if (index === 0) return '1 / 1 / 1.5 / 2'; // Top left top
		if (index === 1) return '1.5 / 1 / 2 / 2'; // Top left bottom
		if (index === 2) return '1 / 2 / 1.5 / 3'; // Top right top
		if (index === 3) return '1.5 / 2 / 2 / 3'; // Top right bottom
		if (index === 4) return '2 / 1 / 2.5 / 2'; // Bottom left top
		if (index === 5) return '2.5 / 1 / 3 / 2'; // Bottom left bottom
		if (index === 6) return '2 / 2 / 2.5 / 3'; // Bottom right top
		return '2.5 / 2 / 3 / 3'; // Bottom right bottom
	}

	return '';
}

export default ImageGrid;
