import { z } from 'zod';

// A coordinate is a tuple of exactly 2 numbers (longitude, latitude)
const Coordinate = z.tuple([
	z.number().min(-180).max(180), // longitude
	z.number().min(-90).max(90), // latitude
]);

// A ring is an array of coordinates, minimum 4 points (to close the shape)
// First and last points must be identical
const Ring = z
	.array(Coordinate)
	.min(4)
	.refine((points) => {
		const first = points[0];
		const last = points[points.length - 1];
		return first[0] === last[0] && first[1] === last[1];
	}, 'Ring must be closed (first and last points must be identical)');

// A polygon is an array of rings
// First ring is outer boundary, rest are holes
const Polygon = z
	.array(Ring)
	.min(1)
	.refine((rings) => rings.length >= 1, 'Polygon must have at least one ring (outer boundary)');

// A MultiPolygon is an array of polygons
export const MultiPolygonCoordinates = z
	.array(Polygon)
	.min(1)
	.refine((polygons) => polygons.length >= 1, 'MultiPolygon must have at least one polygon');

// The full GeoJSON MultiPolygon object
export const MultiPolygonSchema = z.object({
	type: z.literal('MultiPolygon'),
	coordinates: MultiPolygonCoordinates,
});

// Helper function with type checking
export const createBoundingBox = (coordinates: z.infer<typeof MultiPolygonCoordinates>) => {
	// Validate the coordinates
	MultiPolygonCoordinates.parse(coordinates);

	return JSON.stringify({
		type: 'MultiPolygon',
		coordinates,
	});
};

// Type export
export type MultiPolygon = z.infer<typeof MultiPolygonSchema>;
