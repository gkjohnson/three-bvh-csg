import { Line3, Vector3, Plane } from 'three';

// tolerance for considering a clipped segment degenerate (zero-length)
const CLIP_EPSILON = 1e-10;

// tolerance for treating a denominator as zero (segment parallel to edge)
const PARALLEL_EPSILON = 1e-15;

const _tempLine = new Line3();
const _inputSeg = new Line3();
const _dir = new Vector3();
const _edge = new Vector3();
const _edgeNormal = new Vector3();
const _edgePlane = new Plane();

// Clips a line segment to the interior of a coplanar triangle using the Cyrus–Beck algorithm
// generalized to 3D half-planes.
// Reference: Cyrus & Beck, "Generalized two- and three-dimensional clipping"
// Returns the target Line3 with clipped endpoints, or null if entirely outside.
function clipSegmentToTriangle( segment, tri, normal, target ) {

	let tMin = 0;
	let tMax = 1;

	segment.delta( _dir );

	const verts = [ tri.a, tri.b, tri.c ];
	for ( let i = 0; i < 3; i ++ ) {

		const v0 = verts[ i ];
		const v1 = verts[ ( i + 1 ) % 3 ];

		// build the inward-facing edge plane
		_edge.subVectors( v1, v0 );
		_edgeNormal.crossVectors( normal, _edge );
		_edgePlane.setFromNormalAndCoplanarPoint( _edgeNormal, v0 );

		// signed distance of segment start from the edge plane
		const dist = _edgePlane.distanceToPoint( segment.start );

		// rate of change of distance along segment direction
		const denom = _edgePlane.normal.dot( _dir );
		if ( Math.abs( denom ) < PARALLEL_EPSILON ) {

			// segment parallel to edge — entirely inside or outside this half-plane
			if ( dist < - CLIP_EPSILON ) {

				return null;

			} else {

				continue;

			}

		}

		const t = - dist / denom;
		if ( denom > 0 ) {

			// segment enters the plane at t from the negative side
			tMin = Math.max( tMin, t );

		} else {

			// segment exits the plane at t from the positive side
			tMax = Math.min( tMax, t );

		}

		// edge is outside the triangle
		if ( tMin > tMax + CLIP_EPSILON ) {

			return null;

		}

	}

	// segment is degenerate
	if ( tMax - tMin < CLIP_EPSILON ) {

		return null;

	}

	segment.at( tMin, target.start );
	segment.at( tMax, target.end );

	return target;

}

// Computes the segments of triB's edges that lie inside triA. Both triangles must be coplanar.
// These segments are the constraint edges needed to split triA by coplanar triB in a constrained
// triangulation.
export function getCoplanarIntersectionEdges( triA, triB, normal, target ) {

	let count = 0;
	const bVerts = [ triB.a, triB.b, triB.c ];
	for ( let i = 0; i < 3; i ++ ) {

		// the edge vertices
		_inputSeg.start.copy( bVerts[ i ] );
		_inputSeg.end.copy( bVerts[ ( i + 1 ) % 3 ] );

		// clip the segment
		const result = clipSegmentToTriangle( _inputSeg, triA, normal, _tempLine );
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
