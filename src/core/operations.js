import { Matrix4, Matrix3, BufferGeometry, BufferAttribute, Triangle } from 'three';
import { ADDITION, SUBTRACTION, DIFFERENCE, INTERSECTION, PASSTHROUGH } from './constants.js';
import {
	getHitSide,
	collectIntersectingTriangles,
	appendAttributeFromTriangle,
	appendAttributesFromIndices,
	COPLANAR, BACK_SIDE, FRONT_SIDE,
} from './operationsUtils.js';

const _matrix = new Matrix4();
const _normalMatrix = new Matrix3();
const _triA = new Triangle();
const _triB = new Triangle();
const _tri = new Triangle();
const _barycoordTri = new Triangle();

// TODO: take a target geometry so we don't have to create a new one every time
export function performOperation( a, b, operation, splitter, typedAttributeData ) {

	const attributeInfo = typedAttributeData.attributes;
	const { aToB, bToA } = collectIntersectingTriangles( a, b );
	performWholeTriangleOperations( a, b, aToB, operation, false, attributeInfo );
	performWholeTriangleOperations( b, a, bToA, operation, true, attributeInfo );

	performSplitTriangleOperations( a, b, aToB, operation, false, splitter, attributeInfo );
	performSplitTriangleOperations( b, a, bToA, operation, true, splitter, attributeInfo );

	const result = new BufferGeometry();
	const { position, normal, uv } = attributeInfo;
	result.setAttribute( 'position', new BufferAttribute( position.array.slice( 0, position.length ), 3 ) );
	result.setAttribute( 'normal', new BufferAttribute( normal.array.slice( 0, normal.length ), 3 ) );
	result.setAttribute( 'uv', new BufferAttribute( uv.array.slice( 0, uv.length ), 2 ) );

	return result;

}

// perform triangle splitting and CSG operations on the set of split triangles
function performSplitTriangleOperations( a, b, triSets, operation, invert, splitter, attributeInfo ) {

	// transforms into the local frame of matrix b
	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	_normalMatrix.getNormalMatrix( a.matrixWorld );

	const aIndex = a.geometry.index;
	const aPosition = a.geometry.attributes.position;

	const bBVH = b.geometry.boundsTree;
	const bIndex = b.geometry.index;
	const bPosition = b.geometry.attributes.position;

	// iterate over all split triangle indices
	for ( const key in triSets ) {

		const intersectingIndices = triSets[ key ];

		// get the triangle in the geometry B local frame
		const ia = parseInt( key );
		const ia3 = 3 * ia;
		const ia0 = aIndex.getX( ia3 + 0 );
		const ia1 = aIndex.getX( ia3 + 1 );
		const ia2 = aIndex.getX( ia3 + 2 );
		_triA.a.fromBufferAttribute( aPosition, ia0 ).applyMatrix4( _matrix );
		_triA.b.fromBufferAttribute( aPosition, ia1 ).applyMatrix4( _matrix );
		_triA.c.fromBufferAttribute( aPosition, ia2 ).applyMatrix4( _matrix );

		// initialize the splitter with the triangle from geometry A
		splitter.initialize( _triA );

		// split the triangle with the intersecting triangles from B
		for ( let ib = 0, l = intersectingIndices.length; ib < l; ib ++ ) {

			const ib3 = 3 * intersectingIndices[ ib ];
			const ib0 = bIndex.getX( ib3 + 0 );
			const ib1 = bIndex.getX( ib3 + 1 );
			const ib2 = bIndex.getX( ib3 + 2 );
			_triB.a.fromBufferAttribute( bPosition, ib0 );
			_triB.b.fromBufferAttribute( bPosition, ib1 );
			_triB.c.fromBufferAttribute( bPosition, ib2 );
			splitter.splitByTriangle( _triB );

		}

		// for all triangles in the split result
		const triangles = splitter.triangles;
		for ( let ib = 0, l = triangles.length; ib < l; ib ++ ) {

			// get the barycentric coordinates of the clipped triangle to add
			const clippedTri = triangles[ ib ];
			_triA.getBarycoord( clippedTri.a, _barycoordTri.a );
			_triA.getBarycoord( clippedTri.b, _barycoordTri.b );
			_triA.getBarycoord( clippedTri.c, _barycoordTri.c );

			// TODO: consolidate this operations logic into a helper function that returns whether to append,
			// invert, or skip. Then we can avoid performing barycentric interpolation when it's unneeded
			const hitSide = getHitSide( clippedTri, bBVH );
			switch ( operation ) {

				case ADDITION:
					if ( hitSide === FRONT_SIDE || ( hitSide === COPLANAR && invert ) ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo );

					}

					break;
				case SUBTRACTION:
					if ( invert ) {

						if ( hitSide === BACK_SIDE ) {

							appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo, true );

						}

					} else {

						if ( hitSide === FRONT_SIDE ) {

							appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo );

						}

					}

					break;
				case DIFFERENCE:
					if ( hitSide === BACK_SIDE ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo, true );

					} else if ( hitSide === FRONT_SIDE ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo );

					}

					break;
				case INTERSECTION:
					if ( hitSide === BACK_SIDE || ( hitSide === COPLANAR && invert ) ) {

						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo );

					}

					break;
				case PASSTHROUGH:
					appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo );
					break;

			}

		}


	}

}

// perform CSG operations on the set of whole triangles
function performWholeTriangleOperations( a, b, splitTriSet, operation, invert, attributeInfo ) {

	// matrix for transforming into the local frame of geometry b
	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	_normalMatrix.getNormalMatrix( a.matrixWorld );


	const bBVH = b.geometry.boundsTree;
	const aIndex = a.geometry.index;
	const aAttributes = a.geometry.attributes;
	const aPosition = aAttributes.position;
	for ( let i = 0, l = aIndex.count / 3; i < l; i ++ ) {

		// if we find the index in the set of triangles that is supposed to be clipped
		// then ignore it because it will be handled separately
		if ( i in splitTriSet ) {

			continue;

		}

		// get the vertex indices
		const i3 = 3 * i;
		const i0 = aIndex.getX( i3 + 0 );
		const i1 = aIndex.getX( i3 + 1 );
		const i2 = aIndex.getX( i3 + 2 );

		// get the vertex position in the frame of geometry b so we can
		// perform hit testing
		_tri.a.fromBufferAttribute( aPosition, i0 ).applyMatrix4( _matrix );
		_tri.b.fromBufferAttribute( aPosition, i1 ).applyMatrix4( _matrix );
		_tri.c.fromBufferAttribute( aPosition, i2 ).applyMatrix4( _matrix );

		// get the side and decide if we need to cull the triangle based on the operation
		const hitSide = getHitSide( _tri, bBVH );
		switch ( operation ) {

			case ADDITION:
				if ( hitSide === FRONT_SIDE ) {

					appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo );

				}

				break;
			case SUBTRACTION:
				if ( invert ) {

					if ( hitSide === BACK_SIDE ) {

						appendAttributesFromIndices( i2, i1, i0, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo, invert );

					}

				} else {

					if ( hitSide === FRONT_SIDE ) {

						appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo );

					}

				}

				break;
			case DIFFERENCE:
				if ( hitSide === BACK_SIDE ) {

					appendAttributesFromIndices( i2, i1, i0, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo, invert );

				} else {

					appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo );

				}

				break;
			case INTERSECTION:
				if ( hitSide === BACK_SIDE ) {

					appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo );


				}

				break;
			case PASSTHROUGH:
				appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo );
				break;

		}

	}

}

