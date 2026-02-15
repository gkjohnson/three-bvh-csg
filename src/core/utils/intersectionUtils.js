import { Line3, Vector3, Plane } from 'three';

// tolerance for considering a clipped segment degenerate (zero-length)
const CLIP_EPSILON = 1e-10;

// tolerance for treating a denominator as zero (segment parallel to edge)
const PARALLEL_EPSILON = 1e-15;

// tolerance for considering two triangle normals as parallel
const COPLANAR_NORMAL_EPSILON = 1e-10;

// tolerance for considering two parallel triangles as lying on the same plane
const COPLANAR_DISTANCE_EPSILON = 1e-10;

const _tempLine = new Line3();
const _inputSeg = new Line3();
const _dir = new Vector3();
const _edgeDelta = new Vector3();
const _edgeNormal = new Vector3();
const _edgePlane = new Plane();
const _normalA = new Vector3();
const _normalB = new Vector3();

// returns true if two triangles are coplanar (parallel normals and same plane distance)
export function isTriangleCoplanar( triA, triB ) {

	triA.getNormal( _normalA );
	triB.getNormal( _normalB );

	const dot = _normalA.dot( _normalB );
	if ( Math.abs( 1.0 - Math.abs( dot ) ) >= COPLANAR_NORMAL_EPSILON ) {

		return false;

	}

	// test if plane constant is within tolerance
	const dA = _normalA.dot( triA.a );
	const dB = _normalA.dot( triB.a );
	return Math.abs( dA - dB ) < COPLANAR_DISTANCE_EPSILON;

}

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
		_edgeDelta.subVectors( v1, v0 );
		_edgeNormal.crossVectors( normal, _edgeDelta );
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

// Computes the edges of the intersection polygon between two coplanar triangles.
// The boundary consists of segments from both triangles' edges clipped to the other's interior.
// Returns the number of segments written into target.
export function getCoplanarIntersectionEdges( triA, triB, target ) {

	let count = 0;

	triA.getNormal( _normalA );
	triB.getNormal( _normalB );

	// clip triB's edges against triA
	const bVerts = [ triB.a, triB.b, triB.c ];
	for ( let i = 0; i < 3; i ++ ) {

		_inputSeg.start.copy( bVerts[ i ] );
		_inputSeg.end.copy( bVerts[ ( i + 1 ) % 3 ] );

		const result = clipSegmentToTriangle( _inputSeg, triA, _normalA, _tempLine );
		if ( result !== null ) {

			if ( count >= target.length ) {

				target.push( new Line3() );

			}

			target[ count ].copy( result );
			count ++;

		}

	}

	// clip triA's edges against triB
	const aVerts = [ triA.a, triA.b, triA.c ];
	for ( let i = 0; i < 3; i ++ ) {

		_inputSeg.start.copy( aVerts[ i ] );
		_inputSeg.end.copy( aVerts[ ( i + 1 ) % 3 ] );

		const result = clipSegmentToTriangle( _inputSeg, triB, _normalB, _tempLine );
		if ( result !== null ) {

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
