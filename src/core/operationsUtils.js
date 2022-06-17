import { Ray, Matrix4, DoubleSide, Vector3, Vector4, Triangle } from 'three';

const _ray = new Ray();
const _matrix = new Matrix4();
const _vec = new Vector3();
const _vec4 = new Vector4();
const _vec4a = new Vector4();
const _vec4b = new Vector4();
const _vec4c = new Vector4();

const _vec4_0 = new Vector4();
const _vec4_1 = new Vector4();
const _vec4_2 = new Vector4();
const _tri = new Triangle();

export const COPLANAR = 0;
export const BACK_SIDE = - 1;
export const FRONT_SIDE = 1;

export function getHitSide( tri, bvh ) {

	// random function that returns [ - 0.5, 0.5 ];
	function rand() {

		return Math.random() - 0.5;

	}

	// get the ray the check the triangle for
	_ray.origin.copy( tri.a ).add( tri.b ).add( tri.c ).multiplyScalar( 1 / 3 );
	tri.getNormal( _ray.direction );

	const total = 3;
	let count = 0;
	let minDistance = Infinity;
	for ( let i = 0; i < total; i ++ ) {

		// jitter the ray slightly
		_ray.direction.x += rand() * 1e-8;
		_ray.direction.y += rand() * 1e-8;
		_ray.direction.z += rand() * 1e-8;

		// check if the ray hit the backside
		const hit = bvh.raycastFirst( _ray, DoubleSide );
		let hitBackSide = Boolean( hit && _ray.direction.dot( hit.face.normal ) > 0 );
		if ( hitBackSide ) {

			count ++;

		}

		if ( hit !== null ) {

			minDistance = Math.min( minDistance, hit.distance );

		}

	}

	// if we're right up against another face then we're coplanar
	if ( minDistance === 0 ) {

		return COPLANAR;

	} else {

		return count / total > 0.5 ? BACK_SIDE : FRONT_SIDE;

	}

}

// returns the intersected triangles and returns objects mapping triangle indices to
// the other triangles intersected
export function collectIntersectingTriangles( a, b ) {

	const aToB = {};
	const bToA = {};

	_matrix
		.copy( a.matrixWorld )
		.invert()
		.multiply( b.matrixWorld );

	a.geometry.boundsTree.bvhcast( b.geometry.boundsTree, _matrix, {

		intersectsTriangles( triangle1, triangle2, ia, ib ) {

			if ( triangle1.intersectsTriangle( triangle2 ) ) {

				if ( ! aToB[ ia ] ) aToB[ ia ] = [];
				if ( ! bToA[ ib ] ) bToA[ ib ] = [];

				aToB[ ia ].push( ib );
				bToA[ ib ].push( ia );

			}

			return false;

		}

	} );

	return { aToB, bToA };

}

// Add the barycentric interpolated values fro the triangle into the new attribute data
export function appendAttributeFromTriangle( triIndex, baryCoordTri, geometry, matrixWorld, attributeInfo, invert ) {

	const attributes = geometry.attributes;
	const indexAttr = geometry.index;
	const i3 = triIndex * 3;
	const i0 = indexAttr.getX( i3 + 0 );
	const i1 = indexAttr.getX( i3 + 1 );
	const i2 = indexAttr.getX( i3 + 2 );

	for ( const key in attributeInfo ) {

		// check if the key we're asking for is in the geometry at all
		const attr = attributes[ key ];
		const arr = attributeInfo[ key ];
		if ( ! ( key in attributes ) ) {

			throw new Error();

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

			// TODO: apply normal matrix here, not direction
			_tri.a.fromBufferAttribute( attr, i0 ).transformDirection( matrixWorld );
			_tri.b.fromBufferAttribute( attr, i1 ).transformDirection( matrixWorld );
			_tri.c.fromBufferAttribute( attr, i2 ).transformDirection( matrixWorld );

			if ( invert ) {

				_tri.a.multiplyScalar( - 1 );
				_tri.b.multiplyScalar( - 1 );
				_tri.c.multiplyScalar( - 1 );

			}

			pushBarycoordInterpolatedValues( _tri.a, _tri.b, _tri.c, baryCoordTri, 3, arr, invert );

		} else {

			_vec4a.fromBufferAttribute( attr, i0 );
			_vec4b.fromBufferAttribute( attr, i1 );
			_vec4c.fromBufferAttribute( attr, i2 );

			pushBarycoordInterpolatedValues( _vec4a, _vec4b, _vec4c, baryCoordTri, itemSize, arr, invert );

		}

	}

}

// Append all the values of the attributes for the triangle onto the new attribute arrays
export function appendAttributesFromIndices( i0, i1, i2, attributes, matrixWorld, attributeInfo, invert = false ) {

	appendAttributeFromIndex( i0, attributes, matrixWorld, attributeInfo, invert );
	appendAttributeFromIndex( i1, attributes, matrixWorld, attributeInfo, invert );
	appendAttributeFromIndex( i2, attributes, matrixWorld, attributeInfo, invert );

}

// takes a set of barycentric values in the form of a triangle, a set of vectors, number of components,
// and whether to invert the result and pushes the new values onto the provided attribute array
function pushBarycoordInterpolatedValues( v0, v1, v2, baryCoordTri, itemSize, attrArr, invert = false ) {

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
function appendAttributeFromIndex( index, attributes, matrixWorld, info, invert = false ) {

	for ( const key in info ) {

		// check if the key we're asking for is in the geometry at all
		const attr = attributes[ key ];
		const arr = info[ key ];
		if ( ! ( key in attributes ) ) {

			throw new Error();

		}

		// specially handle the position and normal attributes because they require transforms
		// TODO: handle tangents
		const itemSize = attr.itemSize;
		if ( key === 'position' ) {

			_vec.fromBufferAttribute( attr, index ).applyMatrix4( matrixWorld );
			arr.push( _vec.x, _vec.y, _vec.z );

		} else if ( key === 'normal' ) {

			// TODO: apply normal matrix here, not direction
			_vec.fromBufferAttribute( attr, index ).transformDirection( matrixWorld	);
			if ( invert ) {

				_vec.multiplyScalar( - 1 );

			}

			arr.push( _vec.x, _vec.y, _vec.z );

		} else {

			arr.push( attr.getX( index ) );
			if ( itemSize > 1 ) arr.push( attr.getY( index ) );
			if ( itemSize > 2 ) arr.push( attr.getZ( index ) );
			if ( itemSize > 3 ) arr.push( attr.getW( index ) );

		}

	}

}
