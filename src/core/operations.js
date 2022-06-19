import { Matrix4, Matrix3, Triangle } from 'three';
import {
	getHitSide,
	collectIntersectingTriangles,
	appendAttributeFromTriangle,
	appendAttributesFromIndices,
	getOperationAction,
	SKIP_TRI, ADD_TRI, INVERT_TRI,
} from './operationsUtils.js';

const _matrix = new Matrix4();
const _normalMatrix = new Matrix3();
const _triA = new Triangle();
const _triB = new Triangle();
const _tri = new Triangle();
const _barycoordTri = new Triangle();

// runs the given operation against a and b using the splitter and appending data to the
// typedAttributeData object.
export function performOperation( a, b, operation, splitter, typedAttributeData, options ) {

	const { useGroups = true } = options;
	const attributeInfo = typedAttributeData.attributes;
	const { aToB, bToA } = collectIntersectingTriangles( a, b );

	const resultGroups = [];
	let resultMaterials = null;

	if ( useGroups ) {

		resultMaterials = [];
		processWithGroups( a, b, aToB, false );
		processWithGroups( b, a, bToA, true );

	} else {

		performWholeTriangleOperations( a, b, aToB, operation, false, attributeInfo );
		performSplitTriangleOperations( a, b, aToB, operation, false, splitter, attributeInfo );

		performWholeTriangleOperations( b, a, bToA, operation, true, attributeInfo );
		performSplitTriangleOperations( b, a, bToA, operation, true, splitter, attributeInfo );

	}

	return {
		groups: resultGroups,
		materials: resultMaterials
	};

	function processWithGroups( a, b, triSet, invert ) {

		const groups = [ ...a.geometry.groups ];
		if ( groups.length === 0 ) {

			groups.push( {
				start: 0,
				count: Infinity,
				materialIndex: 0
			} );

		}

		const mats = a.material;
		groups.sort( ( a, b ) => a.start - b.start );
		for ( let i = 0, l = groups.length; i < l; i ++ ) {

			const group = groups[ i ];
			const startLength = attributeInfo.position.length / 3;
			performWholeTriangleOperations( a, b, triSet, operation, invert, attributeInfo, group );
			performSplitTriangleOperations( a, b, triSet, operation, invert, splitter, attributeInfo, group );

			const endLength = attributeInfo.position.length / 3;
			if ( startLength !== endLength ) {

				if ( Array.isArray( mats ) ) {

					resultMaterials.push( mats[ i ] );

				} else {

					resultMaterials.push( mats );

				}

				resultGroups.push( {
					start: startLength,
					count: endLength - startLength,
					materialIndex: resultMaterials.length - 1,
				} );

			}

		}

	}

}

// perform triangle splitting and CSG operations on the set of split triangles
function performSplitTriangleOperations( a, b, triSets, operation, invert, splitter, attributeInfo, group = null ) {

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
		const ia = parseInt( key );

		// skip triangles outside of this group
		// TODO: improve this
		if ( group ) {

			const relativeIndex = 3 * ia - group.start;
			if ( relativeIndex < 0 || relativeIndex >= group.count ) {

				continue;

			}

		}

		// get the triangle in the geometry B local frame
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

			const hitSide = getHitSide( clippedTri, bBVH );
			const action = getOperationAction( operation, hitSide, invert );
			if ( action !== SKIP_TRI ) {

				_triA.getBarycoord( clippedTri.a, _barycoordTri.a );
				_triA.getBarycoord( clippedTri.b, _barycoordTri.b );
				_triA.getBarycoord( clippedTri.c, _barycoordTri.c );
				switch ( action ) {

					case ADD_TRI:
						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo );
						break;

					case INVERT_TRI:
						appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attributeInfo, true );
						break;

				}

			}

		}


	}

}

// perform CSG operations on the set of whole triangles
function performWholeTriangleOperations( a, b, splitTriSet, operation, invert, attributeInfo, group ) {

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

		// skip triangles outside of this group
		// TODO: we could make this a lot faster
		if ( group ) {

			const relativeIndex = 3 * i - group.start;
			if ( relativeIndex < 0 || relativeIndex >= group.count ) {

				continue;

			}

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
		const action = getOperationAction( operation, hitSide, invert );
		switch ( action ) {

			case ADD_TRI:
				appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo );
				break;

			case INVERT_TRI:
				appendAttributesFromIndices( i2, i1, i0, aAttributes, a.matrixWorld, _normalMatrix, attributeInfo, invert );
				break;

		}

	}

}

