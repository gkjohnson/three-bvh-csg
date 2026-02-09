// 2D Constrained Delaunay Triangulation — thin wrapper around Delaunator + Constrainautor
//
// Usage:
//   1. Call triangulate( coords, constraintEdges )
//      - coords: flat array [x0, y0, x1, y1, ...] (first 3 verts are the boundary triangle)
//      - constraintEdges: flat array [a0, b0, a1, b1, ...] of vertex index pairs
//   2. Returns the Delaunator object whose .triangles contains the CDT result

import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';

const SNAP_EPS_SQ = 1e-16;

// Add a vertex to the coords array, snapping to an existing vertex if within epsilon.
// Returns the vertex index (existing or newly added).
export function addVertex( coords, vertCount, x, y ) {

	for ( let i = 0; i < vertCount; i ++ ) {

		const dx = coords[ 2 * i ] - x;
		const dy = coords[ 2 * i + 1 ] - y;
		if ( dx * dx + dy * dy < SNAP_EPS_SQ ) return { index: i, vertCount };

	}

	coords[ 2 * vertCount ] = x;
	coords[ 2 * vertCount + 1 ] = y;
	return { index: vertCount, vertCount: vertCount + 1 };

}

// Run Delaunay triangulation then enforce constraint edges.
// coords: flat [x0,y0, x1,y1, ...] — at least 3 vertices
// constraintEdges: array of [vi, vj] pairs
// Returns { triangles, coords } from the Delaunator output (modified in-place by Constrainautor).
export function triangulate( coords, constraintEdges ) {

	const del = Delaunator.from( { length: coords.length / 2 }, i => coords[ 2 * i ], i => coords[ 2 * i + 1 ] );

	if ( constraintEdges.length > 0 ) {

		new Constrainautor( del, constraintEdges );

	}

	return del;

}
