import { Line3, Vector3, Plane } from 'three';
import { exactEndpointSide } from './exactEndpointSide.js';

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
function clipSegmentToTriangle( segment, tri, normal, target, interval = null ) {

	let tMin = 0;
	let tMax = 1;
	let enter = - 1, exit = - 1;

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
		let denom = _edgePlane.normal.dot( _dir );
		// The optional support-feature path is opt-in. Equality proves incidence;
		// a small parameter or rounded projection does not. Determine the other
		// endpoint's side exactly before applying any parallel threshold.
		const sharedStart = interval && ( segment.start.equals( v0 ) || segment.start.equals( v1 ) );
		const sharedEnd = interval && ( segment.end.equals( v0 ) || segment.end.equals( v1 ) );
		let cornerT = null;
		if ( sharedStart || sharedEnd ) {

			const side = exactEndpointSide( normal, v0, v1, sharedStart ? segment.end : segment.start );
			if ( side === 0 ) continue; // genuine collinearity, not a point crossing
			denom = sharedStart ? side : - side;
			cornerT = sharedStart ? 0 : 1;

		}

		if ( Math.abs( denom ) < PARALLEL_EPSILON ) {

			// segment parallel to edge — entirely inside or outside this half-plane
			if ( dist < - CLIP_EPSILON ) {

				return null;

			} else {

				continue;

			}

		}

		const t = cornerT ?? - dist / denom;
		if ( denom > 0 ) {

			// segment enters the plane at t from the negative side
			if ( t >= tMin ) enter = i;
			tMin = Math.max( tMin, t );

		} else {

			// segment exits the plane at t from the positive side
			if ( t <= tMax ) exit = i;
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
	// Do not reconstruct even t=1 with start + (end-start): that can lose bits.
	if ( interval ) {

		if ( tMin === 0 ) target.start.copy( segment.start );
		if ( tMin === 1 ) target.start.copy( segment.end );
		if ( tMax === 0 ) target.end.copy( segment.start );
		if ( tMax === 1 ) target.end.copy( segment.end );

	}

	if ( interval ) interval.splice( 0, interval.length, tMin, tMax, enter, exit );

	return target;

}

// Computes the edges of the intersection polygon between two coplanar triangles.
// The boundary consists of segments from both triangles' edges clipped to the other's interior.
// Returns the number of segments written into target.
export function getCoplanarIntersectionEdges( triA, triB, target, targetFeatures = null ) {

	let count = 0;
	const interval = targetFeatures ? [] : null;
	// These are construction decisions, not features recovered by a spatial
	// search on a differently rounded triangle. Corner/edge numbers are local
	// to the original input triangle and survive projection unchanged.
	function endpointFeatures( edge, reverse ) {

		return [ 0, 1 ].map( endpoint => {

			const t = interval[ endpoint ], bound = interval[ endpoint + 2 ];
			const origin = t === 0 ? { vertex: edge } : t === 1 ? { vertex: ( edge + 1 ) % 3 } : { edge };
			const clipped = bound === - 1 ? {} : { edge: bound };
			return reverse ? [ clipped, origin ] : [ origin, clipped ];

		} );

	}

	triA.getNormal( _normalA );
	triB.getNormal( _normalB );

	// clip triB's edges against triA
	const bVerts = [ triB.a, triB.b, triB.c ];
	for ( let i = 0; i < 3; i ++ ) {

		_inputSeg.start.copy( bVerts[ i ] );
		_inputSeg.end.copy( bVerts[ ( i + 1 ) % 3 ] );

		const result = clipSegmentToTriangle( _inputSeg, triA, _normalA, _tempLine, interval );
		if ( result !== null ) {

			if ( count >= target.length ) {

				target.push( new Line3() );

			}

			target[ count ].copy( result );
			if ( targetFeatures ) targetFeatures[ count ] = endpointFeatures( i, true );
			count ++;

		}

	}

	// clip triA's edges against triB
	const aVerts = [ triA.a, triA.b, triA.c ];
	for ( let i = 0; i < 3; i ++ ) {

		_inputSeg.start.copy( aVerts[ i ] );
		_inputSeg.end.copy( aVerts[ ( i + 1 ) % 3 ] );

		const result = clipSegmentToTriangle( _inputSeg, triB, _normalB, _tempLine, interval );
		if ( result !== null ) {

			if ( count >= target.length ) {

				target.push( new Line3() );

			}

			target[ count ].copy( result );
			if ( targetFeatures ) targetFeatures[ count ] = endpointFeatures( i, false );
			count ++;

		}

	}

	if ( targetFeatures ) targetFeatures.length = count;
	// returns the number of segments generated
	return count;

}
