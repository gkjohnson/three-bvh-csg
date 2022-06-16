import { Matrix4, Vector3, Vector4, Ray, DoubleSide, Line3, BufferGeometry, BufferAttribute, Triangle } from 'three';
import { ADDITION, SUBTRACTION, DIFFERENCE, INTERSECTION, PASSTHROUGH } from './constants.js';
import { TriangleSplitter } from './TriangleSplitter.js';

const _matrix = new Matrix4();
const _v0 = new Vector3();
const _v1 = new Vector3();
const _v2 = new Vector3();
const _vec = new Vector3();
const _vec4 = new Vector4();
const _vec4a = new Vector4();
const _vec4b = new Vector4();
const _vec4c = new Vector4();
const _ray = new Ray();
const _triA = new Triangle();
const _triB = new Triangle();
const _tri = new Triangle();
const _barycoordTri = new Triangle();
const _edge = new Line3();
const _splitter = new TriangleSplitter();

// TODO: take a target geometry so we don't have to create a new one every time
export function performOperation( a, b, operation ) {

	const attributeData = {
		position: [],
		uv: [],
		normal: [],
	};

	const { aToB, bToA } = collectIntersectingTriangles( a, b );

	// TODO: use the half edge structure to find siblings
	accumulateTriangles( a, b, aToB, operation, false, attributeData );
	accumulateTriangles( b, a, bToA, operation, true, attributeData );

	// TODO: clip and trim triangles
	clipTriangles( a, b, aToB, operation, false, attributeData );
	clipTriangles( b, a, bToA, operation, true, attributeData );

	const result = new BufferGeometry();
	result.setAttribute( 'position', new BufferAttribute( new Float32Array( attributeData.position ), 3 ) );
	result.setAttribute( 'normal', new BufferAttribute( new Float32Array( attributeData.normal ), 3 ) );
	result.setAttribute( 'uv', new BufferAttribute( new Float32Array( attributeData.uv ), 2 ) );

	return result;

}

function clipTriangles( a, b, triSets, operation, invert, attributeData ) {

	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );


	const aIndex = a.geometry.index;
	const aPosition = a.geometry.attributes.position;

	const bBVH = b.geometry.boundsTree;
	const bIndex = b.geometry.index;
	const bPosition = b.geometry.attributes.position;

	for ( const key in triSets ) {

		const triIndices = triSets[ key ];
		const ia = parseInt( key );
		const ia3 = 3 * ia;

		// get the triangle in the geometry B local frame
		const ia0 = aIndex.getX( ia3 + 0 );
		const ia1 = aIndex.getX( ia3 + 1 );
		const ia2 = aIndex.getX( ia3 + 2 );
		_triA.a.fromBufferAttribute( aPosition, ia0 ).applyMatrix4( _matrix );
		_triA.b.fromBufferAttribute( aPosition, ia1 ).applyMatrix4( _matrix );
		_triA.c.fromBufferAttribute( aPosition, ia2 ).applyMatrix4( _matrix );

		_splitter.initialize( _triA );

		for ( let ib = 0, l = triIndices.length; ib < l; ib ++ ) {

			const ib3 = 3 * triIndices[ ib ];
			const ib0 = bIndex.getX( ib3 + 0 );
			const ib1 = bIndex.getX( ib3 + 1 );
			const ib2 = bIndex.getX( ib3 + 2 );
			_triB.a.fromBufferAttribute( bPosition, ib0 );
			_triB.b.fromBufferAttribute( bPosition, ib1 );
			_triB.c.fromBufferAttribute( bPosition, ib2 );
			_splitter.splitByTriangle( _triB );

		}

		const triangles = _splitter.triangles;
		for ( let ib = 0, l = triangles.length; ib < l; ib ++ ) {

			const clippedTri = triangles[ ib ];
			const hitBackSide = isTriangleInside( clippedTri, bBVH, invert );

			_triA.getBarycoord( clippedTri.a, _barycoordTri.a );
			_triA.getBarycoord( clippedTri.b, _barycoordTri.b );
			_triA.getBarycoord( clippedTri.c, _barycoordTri.c );

			switch ( operation ) {

				case ADDITION:
					if ( hitBackSide === false ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData );

					}

					break;
				case SUBTRACTION:
					if ( invert ) {

						if ( hitBackSide === true ) {

							appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData, true );

						}

					} else {

						if ( hitBackSide === false ) {

							appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData );

						}

					}

					break;
				case DIFFERENCE:
					if ( hitBackSide ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData, true );

					} else {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData );

					}

					break;
				case INTERSECTION:
					if ( hitBackSide === true ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData );

					}

					break;
				case PASSTHROUGH:
					appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, attributeData );
					break;

			}

		}


	}

}

function accumulateTriangles( a, b, skipTriSet, operation, invert, attributeData ) {

	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	const bBVH = b.geometry.boundsTree;
	const aIndex = a.geometry.index;
	const aAttributes = a.geometry.attributes;
	const aPosition = aAttributes.position;
	for ( let i = 0, l = aIndex.count / 3; i < l; i ++ ) {

		if ( i in skipTriSet ) continue;

		const i3 = 3 * i;
		const i0 = aIndex.getX( i3 + 0 );
		const i1 = aIndex.getX( i3 + 1 );
		const i2 = aIndex.getX( i3 + 2 );

		_v0.fromBufferAttribute( aPosition, i0 );
		_v1.fromBufferAttribute( aPosition, i1 );
		_v2.fromBufferAttribute( aPosition, i2 );

		_ray.origin.copy( _v0 ).add( _v1 ).add( _v2 ).multiplyScalar( 1 / 3 ).applyMatrix4( _matrix );
		_tri.a.copy( _v0 ).applyMatrix4( _matrix );
		_tri.b.copy( _v1 ).applyMatrix4( _matrix );
		_tri.c.copy( _v2 ).applyMatrix4( _matrix );

		const hitBackSide = isTriangleInside( _tri, bBVH, invert );
		switch ( operation ) {

			case ADDITION:
				if ( hitBackSide === false ) {

					appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, attributeData );

				}

				break;
			case SUBTRACTION:
				if ( invert ) {

					if ( hitBackSide === true ) {

						appendAttributesFromIndices( i2, i1, i0, aAttributes, a.matrixWorld, attributeData, invert );

					}

				} else {

					if ( hitBackSide === false ) {

						appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, attributeData );

					}

				}

				break;
			case DIFFERENCE:
				if ( hitBackSide ) {

					appendAttributesFromIndices( i2, i1, i0, aAttributes, a.matrixWorld, attributeData, invert );

				} else {

					appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, attributeData );

				}

				break;
			case INTERSECTION:
				if ( hitBackSide === true ) {

					appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, attributeData );


				}

				break;
			case PASSTHROUGH:
				appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, attributeData );
				break;

		}

	}

}

function appendAttributeFromTriangle( triIndex, baryCoordTri, geometry, matrixWorld, info, invert ) {

	const attributes = geometry.attributes;
	const indexAttr = geometry.index;
	const i3 = triIndex * 3;
	const i0 = indexAttr.getX( i3 + 0 );
	const i1 = indexAttr.getX( i3 + 1 );
	const i2 = indexAttr.getX( i3 + 2 );

	for ( const key in info ) {

		const attr = attributes[ key ];
		const arr = info[ key ];
		if ( ! ( key in attributes ) ) {

			throw new Error();

		}

		const itemSize = attr.itemSize;
		if ( key === 'position' ) {

			_tri.a.fromBufferAttribute( attr, i0 ).applyMatrix4( matrixWorld );
			_tri.b.fromBufferAttribute( attr, i1 ).applyMatrix4( matrixWorld );
			_tri.c.fromBufferAttribute( attr, i2 ).applyMatrix4( matrixWorld );

			pushBarycoordValues( _tri.a, _tri.b, _tri.c, baryCoordTri, 3, invert, arr );

		} else if ( key === 'normal' ) {

			_tri.a.fromBufferAttribute( attr, i0 ).transformDirection( matrixWorld );
			_tri.b.fromBufferAttribute( attr, i1 ).transformDirection( matrixWorld );
			_tri.c.fromBufferAttribute( attr, i2 ).transformDirection( matrixWorld );

			if ( invert ) {

				_tri.a.multiplyScalar( - 1 );
				_tri.b.multiplyScalar( - 1 );
				_tri.c.multiplyScalar( - 1 );

			}

			pushBarycoordValues( _tri.a, _tri.b, _tri.c, baryCoordTri, 3, invert, arr );

		} else {

			_vec4a.fromBufferAttribute( attr, i0 );
			_vec4b.fromBufferAttribute( attr, i1 );
			_vec4c.fromBufferAttribute( attr, i2 );

			pushBarycoordValues( _vec4a, _vec4b, _vec4c, baryCoordTri, itemSize, invert, arr );

		}

	}

}

function pushBarycoordValues( a, b, c, baryCoordTri, count, invert, arr ) {

	const addValues = v => {

		arr.push( v.x );
		if ( count > 1 ) arr.push( v.y );
		if ( count > 2 ) arr.push( v.z );
		if ( count > 3 ) arr.push( v.w );

	};

	_vec4.set( 0, 0, 0, 0 )
		.addScaledVector( a, baryCoordTri.a.x )
		.addScaledVector( b, baryCoordTri.a.y )
		.addScaledVector( c, baryCoordTri.a.z );
	addValues( _vec4 );

	if ( invert ) {

		_vec4.set( 0, 0, 0, 0 )
			.addScaledVector( a, baryCoordTri.c.x )
			.addScaledVector( b, baryCoordTri.c.y )
			.addScaledVector( c, baryCoordTri.c.z );
		arr.push( _vec4.x, _vec4.y, _vec4.z );


		_vec4.set( 0, 0, 0, 0 )
			.addScaledVector( a, baryCoordTri.b.x )
			.addScaledVector( b, baryCoordTri.b.y )
			.addScaledVector( c, baryCoordTri.b.z );
		arr.push( _vec4.x, _vec4.y, _vec4.z );

	} else {

		_vec4.set( 0, 0, 0, 0 )
			.addScaledVector( a, baryCoordTri.b.x )
			.addScaledVector( b, baryCoordTri.b.y )
			.addScaledVector( c, baryCoordTri.b.z );
		arr.push( _vec4.x, _vec4.y, _vec4.z );

		_vec4.set( 0, 0, 0, 0 )
			.addScaledVector( a, baryCoordTri.c.x )
			.addScaledVector( b, baryCoordTri.c.y )
			.addScaledVector( c, baryCoordTri.c.z );
		arr.push( _vec4.x, _vec4.y, _vec4.z );

	}


}

function appendAttributesFromIndices( i0, i1, i2, attributes, matrixWorld, info, invert = false ) {

	appendAttributeFromIndex( i0, attributes, matrixWorld, info, invert );
	appendAttributeFromIndex( i1, attributes, matrixWorld, info, invert );
	appendAttributeFromIndex( i2, attributes, matrixWorld, info, invert );

}

function appendAttributeFromIndex( index, attributes, matrixWorld, info, invert ) {

	for ( const key in info ) {

		const attr = attributes[ key ];
		const arr = info[ key ];
		if ( ! ( key in attributes ) ) {

			throw new Error();

		}

		const itemSize = attr.itemSize;

		if ( key === 'position' ) {

			_vec.fromBufferAttribute( attr, index ).applyMatrix4( matrixWorld );
			arr.push( _vec.x, _vec.y, _vec.z );

		} else if ( key === 'normal' ) {

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

function collectIntersectingTriangles( a, b ) {

	const aToB = {};
	const bToA = {};

	window.TRIS = [];

	window.SET = {};
	window.SET2 = {};

	window.EDGES = [];

	_matrix
		.copy( a.matrixWorld )
		.invert()
		.multiply( b.matrixWorld );

	a.geometry.boundsTree.bvhcast( b.geometry.boundsTree, _matrix, {

		intersectsTriangles( triangle1, triangle2, ia, ib ) {

			if ( triangle1.intersectsTriangle( triangle2, _edge ) ) {

				if ( ! aToB[ ia ] ) aToB[ ia ] = [];
				if ( ! bToA[ ib ] ) bToA[ ib ] = [];
				if ( ! window.SET[ ia ] ) window.SET[ ia ] = { tri: triangle1.clone(), intersects: [] };
				if ( ! window.SET2[ ib ] ) window.SET2[ ib ] = { tri: triangle2.clone(), intersects: [] };

				aToB[ ia ].push( ib );
				bToA[ ib ].push( ia );

				window.SET[ ia ].intersects.push( triangle2.clone() );
				window.SET2[ ib ].intersects.push( triangle1.clone() );

				window.TRIS.push( triangle1.clone(), triangle2.clone() );

				window.EDGES.push( _edge.clone() );

			}

			return false;

		}

	} );

	return { aToB, bToA };

}

function isTriangleInside( tri, bvh, invert ) {

	function rand() {

		return Math.random() - 0.5;

	}

	tri.getNormal( _ray.direction );
	_ray.origin.copy( tri.a ).add( tri.b ).add( tri.c ).multiplyScalar( 1 / 3 );

	const total = 3;
	let count = 0;
	for ( let i = 0; i < total; i ++ ) {

		_ray.direction.x += rand() * 1e-4;
		_ray.direction.y += rand() * 1e-4;
		_ray.direction.z += rand() * 1e-4;

		const hit = bvh.raycastFirst( _ray, DoubleSide );
		let hitBackSide = Boolean( hit && _ray.direction.dot( hit.face.normal ) > 0 );
		if ( invert && hit !== null ) {

			hitBackSide = hitBackSide && hit.distance > 0;

		}

		if ( hitBackSide ) {

			count ++;

		}

	}

	return count / total > 0.5;

}
