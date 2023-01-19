import { Matrix4, Matrix3, Triangle } from 'three';
import {
	getHitSide,
	collectIntersectingTriangles,
	appendAttributeFromTriangle,
	appendAttributesFromIndices,
	getOperationAction,
	SKIP_TRI, INVERT_TRI,
} from './operationsUtils.js';

const _matrix = new Matrix4();
const _normalMatrix = new Matrix3();
const _triA = new Triangle();
const _triB = new Triangle();
const _tri = new Triangle();
const _barycoordTri = new Triangle();

function getFirstIdFromSet( set ) {

	for ( const id of set ) return id;

}

// runs the given operation against a and b using the splitter and appending data to the
// typedAttributeData object.
export function performOperation( a, b, operation, splitter, typedAttributeData, options ) {

	const { useGroups = true } = options;
	const { aIntersections, bIntersections } = collectIntersectingTriangles( a, b );

	const resultGroups = [];
	let resultMaterials = null;

	let groupOffset;
	groupOffset = useGroups ? 0 : - 1;
	performWholeTriangleOperations( a, b, aIntersections, operation, false, typedAttributeData, groupOffset );
	performSplitTriangleOperations( a, b, aIntersections, operation, false, splitter, typedAttributeData, groupOffset );

	groupOffset = useGroups ? a.geometry.groups.length || 1 : - 1;
	performWholeTriangleOperations( b, a, bIntersections, operation, true, typedAttributeData, groupOffset );
	performSplitTriangleOperations( b, a, bIntersections, operation, true, splitter, typedAttributeData, groupOffset );

	return {
		groups: resultGroups,
		materials: resultMaterials
	};

}

// perform triangle splitting and CSG operations on the set of split triangles
function performSplitTriangleOperations( a, b, intersectionMap, operation, invert, splitter, attributeInfo, groupOffset = 0 ) {

	const invertedGeometry = a.matrixWorld.determinant() < 0;

	// transforms into the local frame of matrix b
	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	_normalMatrix
		.getNormalMatrix( a.matrixWorld )
		.multiplyScalar( invertedGeometry ? - 1 : 1 );

	const groupIndices = a.geometry.groupIndices;
	const aIndex = a.geometry.index;
	const aPosition = a.geometry.attributes.position;

	const bBVH = b.geometry.boundsTree;
	const bIndex = b.geometry.index;
	const bPosition = b.geometry.attributes.position;
	const splitIds = intersectionMap.ids;
	const intersectionSet = intersectionMap.intersectionSet;

	// iterate over all split triangle indices
	for ( let i = 0, l = splitIds.length; i < l; i ++ ) {

		const ia = splitIds[ i ];
		const groupIndex = groupOffset === - 1 ? 0 : groupIndices[ ia ] + groupOffset;
		const attrSet = attributeInfo.getGroupSet( groupIndex );

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
		const intersectingIndices = intersectionSet[ ia ];
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

			// try to use the side derived from the clipping but if it turns out to be
			// uncertain then fall back to the raycasting approach
			const hitSide = getHitSide( clippedTri, bBVH );
			const action = getOperationAction( operation, hitSide, invert );
			if ( action !== SKIP_TRI ) {

				_triA.getBarycoord( clippedTri.a, _barycoordTri.a );
				_triA.getBarycoord( clippedTri.b, _barycoordTri.b );
				_triA.getBarycoord( clippedTri.c, _barycoordTri.c );

				const invertTri = action === INVERT_TRI;
				appendAttributeFromTriangle( ia, _barycoordTri, a.geometry, a.matrixWorld, _normalMatrix, attrSet, invertedGeometry !== invertTri );

			}

		}

	}

	return splitIds.length;

}

// perform CSG operations on the set of whole triangles using a half edge structure
// at the moment this isn't always faster due to overhead of building the half edge structure
// and degraded connectivity due to split triangles.

function performWholeTriangleOperations( a, b, splitTriSet, operation, invert, attributeInfo, groupOffset = 0 ) {

	const invertedGeometry = a.matrixWorld.determinant() < 0;

	// matrix for transforming into the local frame of geometry b
	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	_normalMatrix
		.getNormalMatrix( a.matrixWorld )
		.multiplyScalar( invertedGeometry ? - 1 : 1 );

	const bBVH = b.geometry.boundsTree;
	const groupIndices = a.geometry.groupIndices;
	const aIndex = a.geometry.index;
	const aAttributes = a.geometry.attributes;
	const aPosition = aAttributes.position;

	const stack = [];
	const halfEdges = a.geometry.halfEdges;
	const traverseSet = new Set();
	for ( let i = 0, l = aIndex.count / 3; i < l; i ++ ) {

		if ( ! ( i in splitTriSet.intersectionSet ) ) {

			traverseSet.add( i );

		}

	}

	while ( traverseSet.size > 0 ) {

		const id = getFirstIdFromSet( traverseSet );
		traverseSet.delete( id );

		stack.push( id );

		// get the vertex indices
		const i3 = 3 * id;
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

		while ( stack.length > 0 ) {

			const currId = stack.pop();
			const groupIndex = groupOffset === - 1 ? 0 : groupIndices[ currId ] + groupOffset;
			const attrSet = attributeInfo.getGroupSet( groupIndex );

			for ( let i = 0; i < 3; i ++ ) {

				const sid = halfEdges.getSiblingTriangleIndex( currId, i );
				if ( sid !== - 1 && traverseSet.has( sid ) ) {

					stack.push( sid );
					traverseSet.delete( sid );

				}

			}

			if ( action === SKIP_TRI ) {

				continue;

			}

			const i3 = 3 * currId;
			const i0 = aIndex.getX( i3 + 0 );
			const i1 = aIndex.getX( i3 + 1 );
			const i2 = aIndex.getX( i3 + 2 );
			const invertTri = action === INVERT_TRI;
			appendAttributesFromIndices( i0, i1, i2, aAttributes, a.matrixWorld, _normalMatrix, attrSet, invertTri !== invertedGeometry );

		}

	}

}

