import { Ray, Matrix4, DoubleSide, Vector3, Line3 } from 'three';
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

const _ray = new Ray();
const _matrix = new Matrix4();
const _edge = new Line3();
const _normal = new Vector3();
const _coplanarEdges = [];
const _edgePool = new Pool( () => new Line3() );

const JITTER_EPSILON = 1e-8;
const OFFSET_EPSILON = 1e-15;

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

export function getHitSide( tri, bvh ) {

	tri.getMidpoint( _ray.origin );
	tri.getNormal( _ray.direction );

	const hit = bvh.raycastFirst( _ray, DoubleSide );
	const hitBackSide = Boolean( hit && _ray.direction.dot( hit.face.normal ) > 0 );
	return hitBackSide ? BACK_SIDE : FRONT_SIDE;

}

export function getHitSideWithCoplanarCheck( tri, bvh ) {

	// random function that returns [ - 0.5, 0.5 ];
	function rand() {

		return Math.random() - 0.5;

	}

	// get the ray the check the triangle for
	tri.getNormal( _normal );
	_ray.direction.copy( _normal );
	tri.getMidpoint( _ray.origin );

	const total = 3;
	let count = 0;
	let minDistance = Infinity;
	for ( let i = 0; i < total; i ++ ) {

		// jitter the ray slightly
		_ray.direction.x += rand() * JITTER_EPSILON;
		_ray.direction.y += rand() * JITTER_EPSILON;
		_ray.direction.z += rand() * JITTER_EPSILON;

		// and invert it so we can account for floating point error by checking both directions
		// to catch coplanar distances
		_ray.direction.multiplyScalar( - 1 );

		// check if the ray hit the backside
		const hit = bvh.raycastFirst( _ray, DoubleSide );
		let hitBackSide = Boolean( hit && _ray.direction.dot( hit.face.normal ) > 0 );
		if ( hitBackSide ) {

			count ++;

		}

		if ( hit !== null ) {

			minDistance = Math.min( minDistance, hit.distance );

		}

		// if we're right up against another face then we're coplanar
		if ( minDistance <= OFFSET_EPSILON ) {

			return hit.face.normal.dot( _normal ) > 0 ? COPLANAR_ALIGNED : COPLANAR_OPPOSITE;

		}

		// if our current casts meet our requirements then early out
		if ( count / total > 0.5 || ( i - count + 1 ) / total > 0.5 ) {

			break;

		}

	}

	return count / total > 0.5 ? BACK_SIDE : FRONT_SIDE;

}

// returns the intersected triangles and returns objects mapping triangle indices to
// the other triangles intersected
export function collectIntersectingTriangles( a, b ) {

	const aIntersections = new IntersectionMap();
	const bIntersections = new IntersectionMap();

	_edgePool.clear();

	_matrix
		.copy( a.matrixWorld )
		.invert()
		.multiply( b.matrixWorld );

	a.geometry.boundsTree.bvhcast( b.geometry.boundsTree, _matrix, {

		intersectsTriangles( triangleA, triangleB, ia, ib ) {

			if ( ! isTriDegenerate( triangleA ) && ! isTriDegenerate( triangleB ) ) {

				// due to floating point error it's possible that we can have two overlapping, coplanar triangles
				// that are a _tiny_ fraction of a value away from each other. If we find that case then check the
				// distance between triangles and if it's small enough consider them intersecting.
				let coplanarCount = isTriangleCoplanar( triangleA, triangleB ) ? getCoplanarIntersectionEdges( triangleA, triangleB, _coplanarEdges ) : 0;
				let intersected = coplanarCount > 0 || triangleA.intersectsTriangle( triangleB, _edge, true );
				if ( intersected ) {

					const va = a.geometry.boundsTree.resolveTriangleIndex( ia );
					const vb = b.geometry.boundsTree.resolveTriangleIndex( ib );
					aIntersections.add( va, vb, coplanarCount );
					bIntersections.add( vb, va, coplanarCount );

					// cache intersection edges in geometry A's local frame
					if ( coplanarCount > 0 ) {

						// coplanar
						const count = getCoplanarIntersectionEdges( triangleA, triangleB, _coplanarEdges );
						for ( let i = 0; i < count; i ++ ) {

							const e = _edgePool.getInstance().copy( _coplanarEdges[ i ] );
							aIntersections.addIntersectionEdge( va, e );
							bIntersections.addIntersectionEdge( vb, e );

						}

					} else {

						// non-coplanar
						const ea = _edgePool.getInstance().copy( _edge );
						const eb = _edgePool.getInstance().copy( _edge );
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

	return { aIntersections, bIntersections };

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
