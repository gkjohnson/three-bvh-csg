import { Matrix4, Matrix3, Triangle, Vector3 } from 'three';
import {
	getHitSide,
	collectIntersectingTriangles,
	getOperationAction,
	SKIP_TRI, INVERT_TRI,
	COPLANAR_ALIGNED,
	COPLANAR_OPPOSITE,
} from './operationsUtils.js';
import { getTriCount } from '../utils/geometryUtils.js';
import { HOLLOW_INTERSECTION, HOLLOW_SUBTRACTION } from '../constants.js';
import { isTriDegenerate } from '../utils/triangleUtils.js';
import { Pool } from '../utils/Pool.js';

const _matrix = new Matrix4();
const _inverseMatrix = new Matrix4();
const _builderMatrix = new Matrix4();
const _normalMatrix = new Matrix3();
const _triA = new Triangle();
const _triB = new Triangle();
const _tri = new Triangle();
const _barycoordTri = new Triangle();
const _actions = [];
const _builders = [];
const _traversed = new Set();
const _midpoint = new Vector3();
const _normal = new Vector3();
const _coplanarTrianglePool = new Pool( () => new Triangle() );
const _coplanarNormal = new Vector3();
const _coplanarTriangles = [];

// runs the given operation against a and b using the splitter and appending data to the
// geometry builder.
export function performOperation(
	a,
	b,
	operations,
	splitter,
	builders,
	options = {},
) {

	const { useGroups = true } = options;
	const { aIntersections, bIntersections } = collectIntersectingTriangles( a, b );

	const resultGroups = [];
	let resultMaterials = null;

	let groupOffset;
	groupOffset = useGroups ? 0 : - 1;
	performWholeTriangleOperations( a, b, aIntersections, operations, false, builders, groupOffset );
	performSplitTriangleOperations( a, b, aIntersections, operations, false, splitter, builders, groupOffset );

	// find whether the set of operations contains a non-hollow operations. If it does then we need
	// to perform the second set of triangle additions
	const nonHollow = operations
		.findIndex( op => op !== HOLLOW_INTERSECTION && op !== HOLLOW_SUBTRACTION ) !== - 1;

	if ( nonHollow ) {

		// clear the index map so for the new geometry being used
		builders.forEach( builder => builder.clearIndexMap() );

		groupOffset = useGroups ? a.geometry.groups.length || 1 : - 1;
		performWholeTriangleOperations( b, a, bIntersections, operations, true, builders, groupOffset );
		performSplitTriangleOperations( b, a, bIntersections, operations, true, splitter, builders, groupOffset );

	}

	// clear the shared info
	builders.forEach( builder => builder.clearIndexMap() );
	_actions.length = 0;

	return {
		groups: resultGroups,
		materials: resultMaterials
	};

}

// perform triangle splitting and CSG operations on the set of split triangles
function performSplitTriangleOperations(
	a,
	b,
	intersectionMap,
	operations,
	invert,
	splitter,
	builders,
	groupOffset = 0,
) {

	// transform from a frame -> b frame. When "invert" is true the "b" is the first argument (brush A).
	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	_inverseMatrix
		.copy( _matrix )
		.invert();

	// matrix for geometry construction to transform vertices in the brush A's frame
	if ( invert ) {

		_builderMatrix.copy( _matrix );

	} else {

		_builderMatrix.identity();

	}

	const invertedGeometry = _builderMatrix.determinant() < 0;
	_normalMatrix
		.getNormalMatrix( _builderMatrix )
		.multiplyScalar( invertedGeometry ? - 1 : 1 );

	const groupIndices = a.geometry.groupIndices;
	const aIndex = a.geometry.index;
	const aPosition = a.geometry.attributes.position;

	const bBVH = b.geometry.boundsTree;
	const bIndex = b.geometry.index;
	const bPosition = b.geometry.attributes.position;
	const splitIds = intersectionMap.ids;

	// iterate over all split triangle indices
	for ( let i = 0, l = splitIds.length; i < l; i ++ ) {

		const ia = splitIds[ i ];
		const groupIndex = groupOffset === - 1 ? 0 : groupIndices[ ia ] + groupOffset;

		// get the triangle in the common frame (brush A's local)
		const ia3 = 3 * ia;
		let ia0 = ia3 + 0;
		let ia1 = ia3 + 1;
		let ia2 = ia3 + 2;
		if ( aIndex ) {

			ia0 = aIndex.getX( ia0 );
			ia1 = aIndex.getX( ia1 );
			ia2 = aIndex.getX( ia2 );

		}

		_triA.a.fromBufferAttribute( aPosition, ia0 );
		_triA.b.fromBufferAttribute( aPosition, ia1 );
		_triA.c.fromBufferAttribute( aPosition, ia2 );
		if ( invert ) {

			_triA.a.applyMatrix4( _matrix );
			_triA.b.applyMatrix4( _matrix );
			_triA.c.applyMatrix4( _matrix );

		}

		// initialize the splitter with the triangle from geometry A
		splitter.reset();
		splitter.initialize( _triA, ia0, ia1, ia2 );

		// add coplanar triangles from B to the splitter for later classification
		_coplanarTriangles.length = 0;
		_coplanarTrianglePool.clear();
		_triA.getNormal( _normal );

		const coplanarIndices = intersectionMap.coplanarSet.get( ia );
		if ( coplanarIndices ) {

			for ( const index of coplanarIndices ) {

				const ib3 = 3 * index;
				let ib0 = ib3 + 0;
				let ib1 = ib3 + 1;
				let ib2 = ib3 + 2;

				if ( bIndex ) {

					ib0 = bIndex.getX( ib0 );
					ib1 = bIndex.getX( ib1 );
					ib2 = bIndex.getX( ib2 );

				}

				const inst = _coplanarTrianglePool.getInstance();
				inst.a.fromBufferAttribute( bPosition, ib0 );
				inst.b.fromBufferAttribute( bPosition, ib1 );
				inst.c.fromBufferAttribute( bPosition, ib2 );

				// transform into the common frame when needed
				if ( ! invert ) {

					inst.a.applyMatrix4( _inverseMatrix );
					inst.b.applyMatrix4( _inverseMatrix );
					inst.c.applyMatrix4( _inverseMatrix );

				}

				_coplanarTriangles.push( inst );

			}

		}

		// split the triangle using cached edges from the bvhcast phase
		if ( splitter.addConstraintEdge ) {

			// edges are already in the common frame (brush A's local) — no transform needed
			const edges = intersectionMap.getIntersectionEdges( ia );
			if ( edges ) {

				for ( const edge of edges ) {

					splitter.addConstraintEdge( edge );

				}

			}

			splitter.triangulate();

		} else {

			// split the triangle with the intersecting triangles from B
			const intersectionSet = intersectionMap.intersectionSet;
			const intersectingIndices = intersectionSet.get( ia );
			for ( let ib = 0, l = intersectingIndices.length; ib < l; ib ++ ) {

				const index = intersectingIndices[ ib ];
				const isCoplanar = coplanarIndices && coplanarIndices.has( index );
				const ib3 = 3 * index;
				let ib0 = ib3 + 0;
				let ib1 = ib3 + 1;
				let ib2 = ib3 + 2;

				if ( bIndex ) {

					ib0 = bIndex.getX( ib0 );
					ib1 = bIndex.getX( ib1 );
					ib2 = bIndex.getX( ib2 );

				}

				_triB.a.fromBufferAttribute( bPosition, ib0 );
				_triB.b.fromBufferAttribute( bPosition, ib1 );
				_triB.c.fromBufferAttribute( bPosition, ib2 );

				// transform splitting tris into the common frame when needed
				if ( ! invert ) {

					_triB.a.applyMatrix4( _inverseMatrix );
					_triB.b.applyMatrix4( _inverseMatrix );
					_triB.c.applyMatrix4( _inverseMatrix );

				}

				splitter.splitByTriangle( _triB, isCoplanar );

			}

		}


		// cache all the attribute data in origA's local frame
		const { triangles, triangleIndices = [], triangleConnectivity = [] } = splitter;
		for ( let i = 0, l = builders.length; i < l; i ++ ) {

			builders[ i ].initInterpolatedAttributeData( a.geometry, _builderMatrix, _normalMatrix, ia0, ia1, ia2 );

		}

		// for all triangles in the split result
		_traversed.clear();
		for ( let ib = 0, l = triangles.length; ib < l; ib ++ ) {

			// skip the triangle if we've already traversed
			if ( _traversed.has( ib ) ) {

				continue;

			}

			// try to use the side derived from the clipping but if it turns out to be
			// uncertain then fall back to the raycasting approach.
			// If checking the sided ness against brush B's BVH then we need to transform
			// into the appropriate frame
			const clippedTri = triangles[ ib ];
			const raycastMatrix = invert ? null : _matrix;
			let hitSide = null;

			// check against the set of coplanar triangles to see if we can easily determine what to do
			clippedTri.getMidpoint( _midpoint );
			for ( let cp = 0, cpl = _coplanarTriangles.length; cp < cpl; cp ++ ) {

				const cpt = _coplanarTriangles[ cp ];
				if ( cpt.containsPoint( _midpoint ) ) {

					cpt.getNormal( _coplanarNormal );
					hitSide = _normal.dot( _coplanarNormal ) > 0 ? COPLANAR_ALIGNED : COPLANAR_OPPOSITE;
					break;

				}

			}

			// if the clipped triangle is no coplanar then fall back to raycasting
			if ( hitSide === null ) {

				hitSide = getHitSide( clippedTri, bBVH, raycastMatrix );

			}

			_actions.length = 0;
			_builders.length = 0;

			// determine action to take for each builder
			for ( let o = 0, lo = operations.length; o < lo; o ++ ) {

				const op = getOperationAction( operations[ o ], hitSide, invert );
				if ( op !== SKIP_TRI ) {

					_actions.push( op );
					_builders.push( builders[ o ] );

				}

			}

			if ( _builders.length !== 0 ) {

				// traverse the connectivity of the triangles to add them to the geometry
				const stack = [ ib ];
				while ( stack.length > 0 ) {

					const index = stack.pop();
					if ( _traversed.has( index ) ) {

						continue;

					}

					// mark this triangle as traversed
					_traversed.add( index );

					// TODO: this is being skipped for now due to the connectivity graph not
					// including small connections due to floating point error. Adding support
					// for symmetric vertices across half edges may help this.
					// push the connected triangle ids onto the stack
					// const connected = triangleConnectivity[ index ] || [];
					// for ( let c = 0, l = connected.length; c < l; c ++ ) {

					// 	const connectedIndex = connected[ c ];
					// 	if ( triangles[ connectedIndex ] !== null ) {

					// 		stack.push( connectedIndex );

					// 	}

					// }

					// get the triangle indices
					const indices = triangleIndices[ index ];
					let t0 = null, t1 = null, t2 = null;
					if ( indices ) {

						t0 = indices[ 0 ];
						t1 = indices[ 1 ];
						t2 = indices[ 2 ];

					}

					// get the barycentric coordinates relative to the base triangle
					const tri = triangles[ index ];
					_triA.getBarycoord( tri.a, _barycoordTri.a );
					_triA.getBarycoord( tri.b, _barycoordTri.b );
					_triA.getBarycoord( tri.c, _barycoordTri.c );

					// append the triangle to all builders
					for ( let k = 0, lk = _builders.length; k < lk; k ++ ) {

						const builder = _builders[ k ];
						const action = _actions[ k ];
						const invertTri = action === INVERT_TRI;
						const invert = invertedGeometry !== invertTri;

						builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.a, t0, invert );
						if ( invert ) {

							builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.c, t2, invert );
							builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.b, t1, invert );

						} else {

							builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.b, t1, invert );
							builder.appendInterpolatedAttributeData( groupIndex, _barycoordTri.c, t2, invert );

						}

					}

				}

			}

		}

	}

	return splitIds.length;

}

// perform CSG operations on the set of whole triangles using a half edge structure
// at the moment this isn't always faster due to overhead of building the half edge structure
// and degraded connectivity due to split triangles.
function performWholeTriangleOperations(
	a,
	b,
	splitTriSet,
	operations,
	invert,
	builders,
	groupOffset = 0,
) {

	// _matrix transforms from a's local frame into the common frame (brush A's local)
	_matrix
		.copy( b.matrixWorld )
		.invert()
		.multiply( a.matrixWorld );

	if ( invert ) {

		_builderMatrix.copy( _matrix );

	} else {

		_builderMatrix.identity();

	}

	const invertedGeometry = _builderMatrix.determinant() < 0;
	_normalMatrix
		.getNormalMatrix( _builderMatrix )
		.multiplyScalar( invertedGeometry ? - 1 : 1 );

	const bBVH = b.geometry.boundsTree;
	const groupIndices = a.geometry.groupIndices;
	const aIndex = a.geometry.index;
	const aAttributes = a.geometry.attributes;
	const aPosition = aAttributes.position;

	const stack = [];
	const halfEdges = a.geometry.halfEdges;

	// iterate over every whole triangle, skipping those that are clipped
	const traversedSet = new Set( splitTriSet.ids );
	const triCount = getTriCount( a.geometry );
	for ( let id = 0; id < triCount; id ++ ) {

		// if we've iterated over every triangle then stop
		if ( traversedSet.size === triCount ) {

			break;

		}

		// skip this triangle if we've already traversed it
		if ( traversedSet.has( id ) ) {

			continue;

		}

		// track the traversal
		traversedSet.add( id );
		stack.push( id );

		// get the vertex indices
		const i3 = 3 * id;
		let i0 = i3 + 0;
		let i1 = i3 + 1;
		let i2 = i3 + 2;
		if ( aIndex ) {

			i0 = aIndex.getX( i0 );
			i1 = aIndex.getX( i1 );
			i2 = aIndex.getX( i2 );

		}

		// get the vertex position in the common frame (origA's local) for hit testing
		_tri.a.fromBufferAttribute( aPosition, i0 );
		_tri.b.fromBufferAttribute( aPosition, i1 );
		_tri.c.fromBufferAttribute( aPosition, i2 );
		if ( invert ) {

			_tri.a.applyMatrix4( _matrix );
			_tri.b.applyMatrix4( _matrix );
			_tri.c.applyMatrix4( _matrix );

		}

		// get the side and decide if we need to cull the triangle based on the operation.
		// When !invert, pass _matrix to transform the ray into brush B's BVH frame.
		const hitSide = getHitSide( _tri, bBVH, invert ? null : _matrix );

		// find all attribute sets to append the triangle to
		_actions.length = 0;
		_builders.length = 0;
		for ( let o = 0, lo = operations.length; o < lo; o ++ ) {

			const op = getOperationAction( operations[ o ], hitSide, invert );
			if ( op !== SKIP_TRI ) {

				_actions.push( op );
				_builders.push( builders[ o ] );

			}

		}

		// continue to iterate on the stack until every triangle has been handled
		while ( stack.length > 0 ) {

			const currId = stack.pop();
			for ( let i = 0; i < 3; i ++ ) {

				const sid = halfEdges.getSiblingTriangleIndex( currId, i );
				if ( sid !== - 1 && ! traversedSet.has( sid ) ) {

					stack.push( sid );
					traversedSet.add( sid );

				}

			}

			if ( _builders.length !== 0 ) {

				const i3 = 3 * currId;
				let i0 = i3 + 0;
				let i1 = i3 + 1;
				let i2 = i3 + 2;
				if ( aIndex ) {

					i0 = aIndex.getX( i0 );
					i1 = aIndex.getX( i1 );
					i2 = aIndex.getX( i2 );

				}

				const groupIndex = groupOffset === - 1 ? 0 : groupIndices[ currId ] + groupOffset;

				_tri.a.fromBufferAttribute( aPosition, i0 );
				_tri.b.fromBufferAttribute( aPosition, i1 );
				_tri.c.fromBufferAttribute( aPosition, i2 );
				if ( ! isTriDegenerate( _tri ) ) {

					for ( let k = 0, lk = _builders.length; k < lk; k ++ ) {

						const builder = _builders[ k ];
						const action = _actions[ k ];
						const invertTri = action === INVERT_TRI;
						const invert = invertTri !== invertedGeometry;
						builder.appendIndexFromGeometry( a.geometry, _builderMatrix, _normalMatrix, groupIndex, i0, invert );

						if ( invert ) {

							builder.appendIndexFromGeometry( a.geometry, _builderMatrix, _normalMatrix, groupIndex, i2, invert );
							builder.appendIndexFromGeometry( a.geometry, _builderMatrix, _normalMatrix, groupIndex, i1, invert );

						} else {

							builder.appendIndexFromGeometry( a.geometry, _builderMatrix, _normalMatrix, groupIndex, i1, invert );
							builder.appendIndexFromGeometry( a.geometry, _builderMatrix, _normalMatrix, groupIndex, i2, invert );

						}

					}

				}

			}

		}

	}

}

