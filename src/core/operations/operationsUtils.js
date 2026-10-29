import { Ray, Matrix4, DoubleSide, Line3 } from 'three';
import { IntersectionMap } from '../IntersectionMap.js';
import {
	ADDITION,
	SUBTRACTION,
	REVERSE_SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
	HOLLOW_SUBTRACTION,
	HOLLOW_INTERSECTION,
} from '../constants.js';
import { isTriDegenerate } from '../utils/triangleUtils.js';
import { getCoplanarIntersectionEdges, isTriangleCoplanar } from '../utils/intersectionUtils.js';
import { Pool } from '../utils/Pool.js';
import { CutPointRegistry } from './CutPointRegistry.js';
import { getSourceFaces, sameInvertibleFrame } from './SourceFaceProvenance.js';
import { sourceSupportOverlay } from './SourceSupportOverlay.js';

const _ray = new Ray();
const _matrix = new Matrix4();
const _edge = new Line3();
const _coplanarEdges = [];
const _edgePool = new Pool( () => new Line3() );

export const BACK_SIDE = - 1;
export const FRONT_SIDE = 1;
export const COPLANAR_OPPOSITE = - 2;
export const COPLANAR_ALIGNED = 2;

export const INVERT_TRI = 0;
export const ADD_TRI = 1;
export const SKIP_TRI = 2;

let _debugContext = null;
export function setDebugContext( debugData ) {

	_debugContext = debugData;

}

export function getHitSide( tri, bvh, matrix = null, sourceNormal = null ) {

	tri.getMidpoint( _ray.origin );
	if ( sourceNormal ) _ray.direction.copy( sourceNormal );
	else tri.getNormal( _ray.direction );

	if ( matrix ) {

		_ray.origin.applyMatrix4( matrix );
		_ray.direction.transformDirection( matrix );

	}

	const hit = bvh.raycastFirst( _ray, DoubleSide );
	const hitBackSide = Boolean( hit && _ray.direction.dot( hit.face.normal ) > 0 );
	return hitBackSide ? BACK_SIDE : FRONT_SIDE;

}

// returns the intersected triangles and returns objects mapping triangle indices to
// the other triangles intersected
export function collectIntersectingTriangles( a, b, consistentCutSeams = false ) {

	const aIntersections = new IntersectionMap();
	const bIntersections = new IntersectionMap();
	const facesA = consistentCutSeams ? getSourceFaces( a.geometry ) : null;
	const facesB = consistentCutSeams ? getSourceFaces( b.geometry ) : null;
	const supportStats = { pairs: 0, maxProjectionDistance: 0, maxHalfUlpRatio: 0 };
	const endpointFeatures = [];
	// Disjoint/contained operations have no cut graph and need no extra index.
	let cutRegistry = null;

	_edgePool.clear();

	_matrix
		.copy( a.matrixWorld )
		.invert()
		.multiply( b.matrixWorld );
	if ( consistentCutSeams && sameInvertibleFrame( a.matrixWorld, b.matrixWorld ) ) _matrix.identity();

	a.geometry.boundsTree.bvhcast( b.geometry.boundsTree, _matrix, {

		intersectsTriangles( triangleA, triangleB, ia, ib ) {

			if ( ! isTriDegenerate( triangleA ) && ! isTriDegenerate( triangleB ) ) {

				// due to floating point error it's possible that we can have two overlapping, coplanar triangles
				// that are a _tiny_ fraction of a value away from each other. If we find that case then check the
				// distance between triangles and if it's small enough consider them intersecting.
				let va, vb, support = null;
				if ( facesA && facesB ) {

					va = a.geometry.boundsTree.resolveTriangleIndex( ia );
					vb = b.geometry.boundsTree.resolveTriangleIndex( ib );
					support = sourceSupportOverlay( triangleA, triangleB, facesA[ va ], a.matrixWorld, facesB[ vb ], b.matrixWorld );

				}

				const clipA = support ? support.a : triangleA, clipB = support ? support.b : triangleB;
				const coplanar = Boolean( support ) || isTriangleCoplanar( triangleA, triangleB );
				const coplanarCount = coplanar ? getCoplanarIntersectionEdges( clipA, clipB, _coplanarEdges, support ? endpointFeatures : null ) : 0;
				const isCoplanarIntersection = coplanarCount > ( consistentCutSeams ? 0 : 2 );
				// The BVH triangle predicate does not produce a valid intersection
				// segment for coplanar contacts. Never consume its placeholder line
				// (notably (0,0,0)) when clipping yields only an edge or a point.
				const intersected = consistentCutSeams && coplanar ? coplanarCount > 0 : isCoplanarIntersection || triangleA.intersectsTriangle( triangleB, _edge, true );
				if ( intersected ) {

					if ( consistentCutSeams && ! cutRegistry ) cutRegistry = new CutPointRegistry( a, b );

					if ( va === null || va === undefined ) va = a.geometry.boundsTree.resolveTriangleIndex( ia );
					if ( vb === null || vb === undefined ) vb = b.geometry.boundsTree.resolveTriangleIndex( ib );
					if ( support ) {

						supportStats.pairs ++;
						supportStats.maxProjectionDistance = Math.max( supportStats.maxProjectionDistance, support.maxProjectionDistance );
						supportStats.maxHalfUlpRatio = Math.max( supportStats.maxHalfUlpRatio, support.maxHalfUlpRatio );
						for ( const [ map, id, other, triangle ] of [[ aIntersections, va, vb, clipB ], [ bIntersections, vb, va, clipA ]] ) {

							if ( ! map.supportCoplanars ) map.supportCoplanars = new Map();
							if ( ! map.supportCoplanars.has( id ) ) map.supportCoplanars.set( id, new Map() );
							map.supportCoplanars.get( id ).set( other, { triangle, plane: support.plane } );

						}

					}

					aIntersections.add( va, vb, isCoplanarIntersection );
					bIntersections.add( vb, va, isCoplanarIntersection );

					// cache intersection edges in geometry A's local frame
					if ( isCoplanarIntersection ) {

						// coplanar
						const count = support ? coplanarCount : getCoplanarIntersectionEdges( triangleA, triangleB, _coplanarEdges );
						for ( let i = 0; i < count; i ++ ) {

							const original = _coplanarEdges[ i ];
							const e = cutRegistry ? new Line3( cutRegistry.register( original.start, va, vb, true, support ? endpointFeatures[ i ][ 0 ] : null ), cutRegistry.register( original.end, va, vb, true, support ? endpointFeatures[ i ][ 1 ] : null ) ) : _edgePool.getInstance().copy( original );
							aIntersections.addIntersectionEdge( va, e );
							bIntersections.addIntersectionEdge( vb, e );

						}

					} else {

						// non-coplanar
						const ea = cutRegistry ? new Line3( cutRegistry.register( _edge.start, va, vb ), cutRegistry.register( _edge.end, va, vb ) ) : _edgePool.getInstance().copy( _edge );
						const eb = cutRegistry ? new Line3( ea.start, ea.end ) : _edgePool.getInstance().copy( _edge );
						aIntersections.addIntersectionEdge( va, ea );
						bIntersections.addIntersectionEdge( vb, eb );

					}

					if ( _debugContext ) {

						_debugContext.addEdge( _edge );
						_debugContext.addIntersectingTriangles( ia, triangleA, ib, triangleB );

					}

				}

			}

			return false;

		}

	} );

	if ( cutRegistry ) cutRegistry.propagate( aIntersections, bIntersections );
	return { aIntersections, bIntersections, cutRegistry, supportStats };

}

// Returns the triangle to add when performing an operation
export function getOperationAction( operation, hitSide, invert = false ) {

	switch ( operation ) {

		case ADDITION:

			if ( hitSide === FRONT_SIDE || ( hitSide === COPLANAR_ALIGNED && ! invert ) ) {

				return ADD_TRI;

			}

			break;
		case SUBTRACTION:

			if ( invert ) {

				if ( hitSide === BACK_SIDE ) {

					return INVERT_TRI;

				}

			} else {

				if ( hitSide === FRONT_SIDE || hitSide === COPLANAR_OPPOSITE ) {

					return ADD_TRI;

				}

			}

			break;
		case REVERSE_SUBTRACTION:

			if ( invert ) {

				if ( hitSide === FRONT_SIDE || hitSide === COPLANAR_OPPOSITE ) {

					return ADD_TRI;

				}

			} else {

				if ( hitSide === BACK_SIDE ) {

					return INVERT_TRI;

				}

			}

			break;
		case DIFFERENCE:

			if ( hitSide === BACK_SIDE ) {

				return INVERT_TRI;

			} else if ( hitSide === FRONT_SIDE ) {

				return ADD_TRI;

			}

			break;
		case INTERSECTION:
			if ( hitSide === BACK_SIDE || ( hitSide === COPLANAR_ALIGNED && ! invert ) ) {

				return ADD_TRI;

			}

			break;

		case HOLLOW_SUBTRACTION:
			if ( ! invert && ( hitSide === FRONT_SIDE || hitSide === COPLANAR_OPPOSITE ) ) {

				return ADD_TRI;

			}

			break;
		case HOLLOW_INTERSECTION:
			if ( ! invert && ( hitSide === BACK_SIDE || hitSide === COPLANAR_ALIGNED ) ) {

				return ADD_TRI;

			}

			break;
		default:
			throw new Error( `Unrecognized CSG operation enum "${ operation }".` );

	}

	return SKIP_TRI;

}
