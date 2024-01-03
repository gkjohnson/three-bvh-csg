import { Ray, Matrix4, DoubleSide, Vector3, Vector4, Triangle, Line3 } from 'three';
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

const _ray = new Ray();
const _matrix = new Matrix4();
const _tri = new Triangle();
const _vec3 = new Vector3();
const _vec4a = new Vector4();
const _vec4b = new Vector4();
const _vec4c = new Vector4();
const _vec4_0 = new Vector4();
const _vec4_1 = new Vector4();
const _vec4_2 = new Vector4();
const _edge = new Line3();
const _normal = new Vector3();
const JITTER_EPSILON = 1e-8;
const OFFSET_EPSILON = 1e-15;

export const BACK_SIDE = - 1;
export const FRONT_SIDE = 1;
export const COPLANAR_OPPOSITE = - 2;
export const COPLANAR_ALIGNED = 2;

export const INVERT_TRI = 0;
export const ADD_TRI = 1;
export const SKIP_TRI = 2;

const FLOATING_COPLANAR_EPSILON = 1e-14;

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
				let intersected = triangleA.intersectsTriangle( triangleB, _edge, true );
				if ( ! intersected ) {

					const pa = triangleA.plane;
					const pb = triangleB.plane;
					const na = pa.normal;
					const nb = pb.normal;

					if ( na.dot( nb ) === 1 && Math.abs( pa.constant - pb.constant ) < FLOATING_COPLANAR_EPSILON ) {

						intersected = true;

					}

				}

				if ( intersected ) {

					let va = a.geometry.boundsTree.resolveTriangleIndex( ia );
					let vb = b.geometry.boundsTree.resolveTriangleIndex( ib );
					aIntersections.add( va, vb );
					bIntersections.add( vb, va );

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

// Add the barycentric interpolated values fro the triangle into the new attribute data
export function appendAttributeFromTriangle(
	triIndex,
	baryCoordTri,
	geometry,
	matrixWorld,
	normalMatrix,
	attributeData,
	invert = false,
) {

	const attributes = geometry.attributes;
	const indexAttr = geometry.index;
	const i3 = triIndex * 3;
	const i0 = indexAttr.getX( i3 + 0 );
	const i1 = indexAttr.getX( i3 + 1 );
	const i2 = indexAttr.getX( i3 + 2 );

	for ( const key in attributeData ) {

		// check if the key we're asking for is in the geometry at all
		const attr = attributes[ key ];
		const arr = attributeData[ key ];
		if ( ! ( key in attributes ) ) {

			throw new Error( `CSG Operations: Attribute ${ key } not available on geometry.` );

		}

		// handle normals and positions specially because they require transforming
		// TODO: handle tangents
		const itemSize = attr.itemSize;
		if ( key === 'position' ) {

			_tri.a.fromBufferAttribute( attr, i0 ).applyMatrix4( matrixWorld );
			_tri.b.fromBufferAttribute( attr, i1 ).applyMatrix4( matrixWorld );
			_tri.c.fromBufferAttribute( attr, i2 ).applyMatrix4( matrixWorld );

			pushBarycoordInterpolatedValues( _tri.a, _tri.b, _tri.c, baryCoordTri, 3, arr, invert );

		} else if ( key === 'normal' ) {

			_tri.a.fromBufferAttribute( attr, i0 ).applyNormalMatrix( normalMatrix );
			_tri.b.fromBufferAttribute( attr, i1 ).applyNormalMatrix( normalMatrix );
			_tri.c.fromBufferAttribute( attr, i2 ).applyNormalMatrix( normalMatrix );

			if ( invert ) {

				_tri.a.multiplyScalar( - 1 );
				_tri.b.multiplyScalar( - 1 );
				_tri.c.multiplyScalar( - 1 );

			}

			pushBarycoordInterpolatedValues( _tri.a, _tri.b, _tri.c, baryCoordTri, 3, arr, invert, true );

		} else {

			_vec4a.fromBufferAttribute( attr, i0 );
			_vec4b.fromBufferAttribute( attr, i1 );
			_vec4c.fromBufferAttribute( attr, i2 );

			pushBarycoordInterpolatedValues( _vec4a, _vec4b, _vec4c, baryCoordTri, itemSize, arr, invert );

		}

	}

}

// Append all the values of the attributes for the triangle onto the new attribute arrays
export function appendAttributesFromIndices(
	i0,
	i1,
	i2,
	attributes,
	matrixWorld,
	normalMatrix,
	attributeData,
	invert = false,
) {

	appendAttributeFromIndex( i0, attributes, matrixWorld, normalMatrix, attributeData, invert );
	appendAttributeFromIndex( invert ? i2 : i1, attributes, matrixWorld, normalMatrix, attributeData, invert );
	appendAttributeFromIndex( invert ? i1 : i2, attributes, matrixWorld, normalMatrix, attributeData, invert );

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

// takes a set of barycentric values in the form of a triangle, a set of vectors, number of components,
// and whether to invert the result and pushes the new values onto the provided attribute array
function pushBarycoordInterpolatedValues( v0, v1, v2, baryCoordTri, itemSize, attrArr, invert = false, normalize = false ) {

	// adds the appropriate number of values for the vector onto the array
	const addValues = v => {

		attrArr.push( v.x );
		if ( itemSize > 1 ) attrArr.push( v.y );
		if ( itemSize > 2 ) attrArr.push( v.z );
		if ( itemSize > 3 ) attrArr.push( v.w );

	};

	// barycentric interpolate the first component
	_vec4_0.set( 0, 0, 0, 0 )
		.addScaledVector( v0, baryCoordTri.a.x )
		.addScaledVector( v1, baryCoordTri.a.y )
		.addScaledVector( v2, baryCoordTri.a.z );

	_vec4_1.set( 0, 0, 0, 0 )
		.addScaledVector( v0, baryCoordTri.b.x )
		.addScaledVector( v1, baryCoordTri.b.y )
		.addScaledVector( v2, baryCoordTri.b.z );

	_vec4_2.set( 0, 0, 0, 0 )
		.addScaledVector( v0, baryCoordTri.c.x )
		.addScaledVector( v1, baryCoordTri.c.y )
		.addScaledVector( v2, baryCoordTri.c.z );

	if ( normalize ) {

		_vec4_0.normalize();
		_vec4_1.normalize();
		_vec4_2.normalize();

	}

	// if the face is inverted then add the values in an inverted order
	addValues( _vec4_0 );

	if ( invert ) {

		addValues( _vec4_2 );
		addValues( _vec4_1 );

	} else {

		addValues( _vec4_1 );
		addValues( _vec4_2 );

	}

}

// Adds the values for the given vertex index onto the new attribute arrays
function appendAttributeFromIndex(
	index,
	attributes,
	matrixWorld,
	normalMatrix,
	attributeData,
	invert = false,
) {

	for ( const key in attributeData ) {

		// check if the key we're asking for is in the geometry at all
		const attr = attributes[ key ];
		const arr = attributeData[ key ];
		if ( ! ( key in attributes ) ) {

			throw new Error( `CSG Operations: Attribute ${ key } no available on geometry.` );

		}

		// specially handle the position and normal attributes because they require transforms
		// TODO: handle tangents
		const itemSize = attr.itemSize;
		if ( key === 'position' ) {

			_vec3.fromBufferAttribute( attr, index ).applyMatrix4( matrixWorld );
			arr.push( _vec3.x, _vec3.y, _vec3.z );

		} else if ( key === 'normal' ) {

			_vec3.fromBufferAttribute( attr, index ).applyNormalMatrix( normalMatrix );
			if ( invert ) {

				_vec3.multiplyScalar( - 1 );

			}

			arr.push( _vec3.x, _vec3.y, _vec3.z );

		} else {

			arr.push( attr.getX( index ) );
			if ( itemSize > 1 ) arr.push( attr.getY( index ) );
			if ( itemSize > 2 ) arr.push( attr.getZ( index ) );
			if ( itemSize > 3 ) arr.push( attr.getW( index ) );

		}

	}

}
