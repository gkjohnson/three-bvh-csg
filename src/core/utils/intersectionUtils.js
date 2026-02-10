import { Line3 } from 'three';

// tolerance for considering a clipped segment degenerate (zero-length)
const CLIP_EPSILON = 1e-10;

// tolerance for treating a denominator as zero (segment parallel to edge)
const PARALLEL_EPSILON = 1e-15;

const _tempLine = new Line3();

// Clips a line segment (segStart > segEnd) to the interior of a coplanar triangle.
// Returns the target Line3 with clipped endpoints, or null if entirely outside.
function clipSegmentToTriangle( segStart, segEnd, tri, normal, target ) {

	let tMin = 0;
	let tMax = 1;

	const dx = segEnd.x - segStart.x;
	const dy = segEnd.y - segStart.y;
	const dz = segEnd.z - segStart.z;

	const verts = [ tri.a, tri.b, tri.c ];
	for ( let i = 0; i < 3; i ++ ) {

		const v0 = verts[ i ];
		const v1 = verts[ ( i + 1 ) % 3 ];

		// inward-pointing edge normal: cross( triNormal, edge )
		const ex = v1.x - v0.x;
		const ey = v1.y - v0.y;
		const ez = v1.z - v0.z;
		const nx = normal.y * ez - normal.z * ey;
		const ny = normal.z * ex - normal.x * ez;
		const nz = normal.x * ey - normal.y * ex;

		// signed distance of segment start from the edge half-plane
		const dist = nx * ( segStart.x - v0.x ) + ny * ( segStart.y - v0.y ) + nz * ( segStart.z - v0.z );

		// rate of change of distance along segment direction
		const denom = nx * dx + ny * dy + nz * dz;

		if ( Math.abs( denom ) < PARALLEL_EPSILON ) {

			// segment parallel to edge — entirely inside or outside this half-plane
			if ( dist < - CLIP_EPSILON ) return null;
			continue;

		}

		const t = - dist / denom;

		if ( denom > 0 ) {

			// segment enters the half-plane at t
			tMin = Math.max( tMin, t );

		} else {

			// segment exits the half-plane at t
			tMax = Math.min( tMax, t );

		}

		if ( tMin > tMax + CLIP_EPSILON ) return null;

	}

	if ( tMax - tMin < CLIP_EPSILON ) return null;

	target.start.set(
		segStart.x + tMin * dx,
		segStart.y + tMin * dy,
		segStart.z + tMin * dz
	);

	target.end.set(
		segStart.x + tMax * dx,
		segStart.y + tMax * dy,
		segStart.z + tMax * dz
	);

	return target;

}

// Computes the segments of triB's edges that lie inside triA. Both triangles
// must be coplanar. These segments are the constraint edges needed to split
// triA by coplanar triB in a constrained triangulation.
export function getCoplanarIntersectionEdges( triA, triB, normal, target ) {

	let count = 0;
	const bVerts = [ triB.a, triB.b, triB.c ];
	for ( let i = 0; i < 3; i ++ ) {

		// the edge vertices
		const v0 = bVerts[ i ];
		const v1 = bVerts[ ( i + 1 ) % 3 ];

		// clip the segment
		const result = clipSegmentToTriangle( v0, v1, triA, normal, _tempLine );
		if ( result !== null ) {

			// expand the list of necessary
			if ( count >= target.length ) {

				target.push( new Line3() );

			}

			target[ count ].copy( result );
			count ++;

		}

	}

	// returns the number of segments generated
	return count;

}
