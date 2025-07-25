import { Vector3, Line3, Triangle } from 'three';
import { lineIntersect } from './utils.js';
import { ObjectPool } from './ObjectPool.js';

const _vec = new Vector3();
const _triangleVertices = new Array( 3 );
const _edgesToAdd = new Array( 3 );
const _edgesToSwap = [];
const SWAP_ITERATIONS = 3;

function doEdgesMatch( a, b ) {

	const forwardMatch = b.startIndex === a.startIndex && b.endIndex === a.endIndex;
	const reverseMatch = b.startIndex === a.endIndex && b.endIndex === a.startIndex;
	return forwardMatch || reverseMatch;

}

class GraphTriangle extends Triangle {

	constructor( ...args ) {

		super( ...args );

		// the set of points and edge info associated with this triangle
		this.edges = [ { edge: null, reversed: false }, { edge: null, reversed: false }, { edge: null, reversed: false } ];
		this.points = [ this.a, this.b, this.c ];

	}

	// add the edge to the triangle at the given index and store whether
	// this triangle is attached to the reversed half-edge
	setEdge( index, edge, reversed ) {

		const { edges, points } = this;
		const info = edges[ index ];
		info.edge = edge;
		info.reversed = reversed;

		if ( reversed ) {

			edge.reverseTriangle = this;
			points[ index ].copy( edge.end );

		} else {

			edge.triangle = this;
			points[ index ].copy( edge.start );

		}

	}

	// Returns the index of the given edge
	getEdgeIndex( edge ) {

		return this.edges.findIndex( info => info.edge === edge );

	}

	// Returns the vertex index associated with the vertex at the given
	// point in the range [0, 2]
	getVertexIndex( index ) {

		const info = this.edges[ index ];
		return info.reversed ? info.edge.endIndex : info.edge.startIndex;

	}

}

class GraphEdge extends Line3 {

	constructor( ...args ) {

		super( ...args );

		// store the vertex index associated with the start, end points
		this.startIndex = - 1;
		this.endIndex = - 1;

		// stores the half edge triangle connections
		this.triangle = null;
		this.reverseTriangle = null;

		// whether this edge is required to stay in the graph
		this.required = false;

	}

}

const EPSILON = 1e-10;
export class EdgeGraph {

	constructor() {

		this.points = [];
		this.edges = [];
		this.triangles = [];

		this.pointPool = new ObjectPool(
			() => new Vector3(),
		);

		this.edgePool = new ObjectPool(
			() => new GraphEdge(),
			e => {

				e.startIndex = - 1;
				e.endIndex = - 1;

				e.triangle = null;
				e.reverseTriangle = null;

				e.required = false;

			},
		);

		this.trianglePool = new ObjectPool(
			() => new GraphTriangle(),
			t => {

				const edges = t.edges;
				for ( let i = 0; i < 3; i ++ ) {

					const info = edges[ i ];
					info.reversed = false;
					info.edge = null;

				}

			},
		);

	}

	reset() {

		this.points.length = 0;
		this.edges.length = 0;
		this.triangles.length = 0;

		this.pointPool.reset();
		this.edgePool.reset();
		this.trianglePool.reset();

	}

	initialize( tri ) {

		const { triangles, points, edges, trianglePool, edgePool, pointPool } = this;

		_triangleVertices[ 0 ] = tri.a;
		_triangleVertices[ 1 ] = tri.b;
		_triangleVertices[ 2 ] = tri.c;

		// initialize the first triangle that we will be splitting
		const newTriangle = trianglePool.getInstance();
		for ( let i = 0; i < 3; i ++ ) {

			const ni = ( i + 1 ) % 3;
			const p0 = _triangleVertices[ i ];
			const p1 = _triangleVertices[ ni ];
			const edge = edgePool.getInstance();
			edge.start.copy( p0 );
			edge.startIndex = i;
			edge.end.copy( p1 );
			edge.endIndex = ni;
			edge.required = true;

			newTriangle.setEdge( i, edge, false );
			edges.push( edge );

		}

		triangles.push( newTriangle );
		points.push(
			pointPool.getInstance().copy( tri.a ),
			pointPool.getInstance().copy( tri.b ),
			pointPool.getInstance().copy( tri.c ),
		);

	}

	insertEdge( edge ) {

		if ( edge.distance() < EPSILON ) {

			return;

		}

		const { points, edgePool } = this;
		const { start, end } = edge;

		// insert the edge points into the graph
		const startIndex = this.insertPoint( start );
		const endIndex = this.insertPoint( end );

		// we've aligned on the same point
		if ( startIndex === endIndex ) {

			return;

		}

		// the edge we're trying to insert
		const inserting = edgePool.getInstance();
		inserting.start.copy( points[ startIndex ] );
		inserting.startIndex = startIndex;
		inserting.end.copy( points[ endIndex ] );
		inserting.endIndex = endIndex;

		// swap the edges
		if ( ! this.markMatchingEdgeRequired( inserting ) ) {

			// TODO
			console.error( 'Matching edge could not be found' );

		}

	}

	insertPoint( point ) {

		const { edges, points, triangles, edgePool, pointPool, trianglePool } = this;
		let index = this.findMatchingPointIndex( point );

		if ( index === null ) {

			// if we haven't been able to match a point see if we can find an existing edge it sits on
			const intersectingEdge = edges.findIndex( e => {

				e.closestPointToPoint( point, true, _vec );
				const found = _vec.distanceTo( point ) < EPSILON;
				if ( found ) {

					point.copy( _vec );

				}

				return found;

			} );

			if ( intersectingEdge === - 1 ) {

				// if we didn't find an edge then try to find the triangle the point is in
				index = points.length;
				points.push( pointPool.getInstance().copy( point ) );

				const containingTriangle = triangles.findIndex( t => {

					return t.getArea() !== 0 && t.containsPoint( point );

				} );
				if ( containingTriangle === - 1 ) {

					// TODO: this should never happen
					console.error( 'CANT FIND TRIANGLE' );

				} else {

					// split into three triangles
					const triangle = triangles[ containingTriangle ];
					_edgesToAdd.fill( null );

					// construct the new edges emanating from the point
					for ( let i = 0; i < 3; i ++ ) {

						const other = triangle.points[ i ];
						const edge = edgePool.getInstance();
						edge.start.copy( point );
						edge.startIndex = index;
						edge.end.copy( other );
						edge.endIndex = triangle.getVertexIndex( i );

						_edgesToAdd[ i ] = edge;

					}

					// construct the triangles
					for ( let i = 0; i < 3; i ++ ) {

						const ni = ( i + 1 ) % 3;
						const e0 = _edgesToAdd[ i ];
						const e1 = triangle.edges[ i ].edge;
						const e2 = _edgesToAdd[ ni ];

						const newTriangle = trianglePool.getInstance();
						const reversed = triangle.edges[ i ].reversed;
						newTriangle.setEdge( 0, e0, false );
						newTriangle.setEdge( 1, e1, reversed );
						newTriangle.setEdge( 2, e2, true );

						triangles.push( newTriangle );

					}

					edges.push( ..._edgesToAdd );
					triangles.splice( triangles.indexOf( triangle ), 1 );

				}

			} else {

				// if we are sitting on an edge
				index = points.length;
				points.push( pointPool.getInstance().copy( point ) );

				// NOTE: it's possible for use to land on a required edge here to split but this is the sad reality of
				// floating point math :(
				const e = edges[ intersectingEdge ];

				// construct the edges
				const l0 = edgePool.getInstance();
				l0.start.copy( e.start );
				l0.startIndex = e.startIndex;
				l0.end.copy( point );
				l0.endIndex = index;
				l0.required = e.required;

				const l1 = edgePool.getInstance();
				l1.start.copy( point );
				l1.startIndex = index;
				l1.end.copy( e.end );
				l1.endIndex = e.endIndex;
				l1.required = e.required;

				// split the forward side triangle
				if ( e.triangle ) {

					const triangle = e.triangle;
					const edgeIndex = triangle.getEdgeIndex( e );
					const nextEdgeIndex = ( edgeIndex + 2 ) % 3;

					const insertedEdge = edgePool.getInstance();
					insertedEdge.start.copy( point );
					insertedEdge.startIndex = index;
					insertedEdge.end.copy( triangle.points[ nextEdgeIndex ] );
					insertedEdge.endIndex = triangle.getVertexIndex( nextEdgeIndex );

					const finalEdgeIndex0 = ( edgeIndex + 2 ) % 3;
					const newTri0 = trianglePool.getInstance();
					newTri0.setEdge( 0, l0, false );
					newTri0.setEdge( 1, insertedEdge, false );
					newTri0.setEdge( 2, triangle.edges[ finalEdgeIndex0 ].edge, triangle.edges[ finalEdgeIndex0 ].reversed );

					const finalEdgeIndex1 = ( edgeIndex + 1 ) % 3;
					const newTri1 = trianglePool.getInstance();
					newTri1.setEdge( 0, l1, false );
					newTri1.setEdge( 1, triangle.edges[ finalEdgeIndex1 ].edge, triangle.edges[ finalEdgeIndex1 ].reversed );
					newTri1.setEdge( 2, insertedEdge, true );

					triangles.splice( triangles.indexOf( triangle ), 1 );
					triangles.push( newTri0, newTri1 );
					edges.push( insertedEdge );

				}

				// split the reverse side triangle
				if ( e.reverseTriangle ) {

					const triangle = e.reverseTriangle;
					const edgeIndex = triangle.getEdgeIndex( e );
					const nextEdgeIndex = ( edgeIndex + 2 ) % 3;

					const insertedEdge = edgePool.getInstance();
					insertedEdge.start.copy( point );
					insertedEdge.startIndex = index;
					insertedEdge.end.copy( triangle.points[ nextEdgeIndex ] );
					insertedEdge.endIndex = triangle.getVertexIndex( nextEdgeIndex );

					const finalEdgeIndex0 = ( edgeIndex + 1 ) % 3;
					const newTri0 = trianglePool.getInstance();
					newTri0.setEdge( 0, l0, true );
					newTri0.setEdge( 1, triangle.edges[ finalEdgeIndex0 ].edge, triangle.edges[ finalEdgeIndex0 ].reversed );
					newTri0.setEdge( 2, insertedEdge, true );

					const finalEdgeIndex1 = ( edgeIndex + 2 ) % 3;
					const newTri1 = trianglePool.getInstance();
					newTri1.setEdge( 0, l1, true );
					newTri1.setEdge( 1, insertedEdge, false );
					newTri1.setEdge( 2, triangle.edges[ finalEdgeIndex1 ].edge, triangle.edges[ finalEdgeIndex1 ].reversed );

					triangles.splice( triangles.indexOf( triangle ), 1 );
					triangles.push( newTri0, newTri1 );
					edges.push( insertedEdge );

				}

				edges.push( l0, l1 );
				edges.splice( intersectingEdge, 1 );

			}

		}

		return index;

	}

	findMatchingPointIndex( p ) {

		// find the matching vertex for the give point if it exists in the graph
		const points = this.points;
		let closestIndex = null;
		let closestDist = Infinity;
		for ( let i = 0, l = points.length; i < l; i ++ ) {

			const d = p.distanceTo( points[ i ] );
			if ( d < EPSILON && d < closestDist ) {

				closestIndex = i;
				closestDist = d;

			}

		}

		return closestIndex;

	}

	markMatchingEdgeRequired( inserting ) {

		const { edges } = this;

		_edgesToSwap.length = 0;
		for ( let i = 0, l = edges.length; i < l; i ++ ) {

			// swap the edge if we don't emanate from the same point
			const other = edges[ i ];
			if (
				other.startIndex !== inserting.startIndex &&
				other.startIndex !== inserting.endIndex &&
				other.endIndex !== inserting.startIndex &&
				other.endIndex !== inserting.endIndex
			) {

				// TODO
				// if ( areEdgesParallel( inserting, other ) ) {

				// 	let sp = inserting.closestPointToPointParameter( other.start, false );
				// 	let ep = inserting.closestPointToPointParameter( other.end, false );

				// 	if ( ! (
				// 		sp < 0 && ep < 0 ||
				// 		sp > 1 && ep > 1
				// 	) ) {

				// 		// TODO: but do they overlap
				// 		// console.log( 'THEYRE PARALLEL', sp, ep );

				// 	}

				// }

				// TODO: make sure we account for parallel scenarios
				if ( lineIntersect( inserting, other, _vec ) ) {

					_edgesToSwap.push( other );

				}

			} else {

				// if we found an edge that matches without swapping then theres no need
				// to continue
				if ( doEdgesMatch( inserting, other ) ) {

					other.required = true;
					return true;

				}

			}

		}

		// try for a few iterations to swap edges until they work
		for ( let i = 0; i < SWAP_ITERATIONS; i ++ ) {

			for ( let j = 0, l = _edgesToSwap.length; j < l; j ++ ) {

				const other = _edgesToSwap[ j ];
				this.swapEdge( other );

				// check if the edge swapped into the form we needed
				if ( doEdgesMatch( inserting, other ) ) {

					other.required = true;
					return true;

				}

			}

		}

		return false;

	}

	swapEdge( edge ) {

		const { triangle, reverseTriangle } = edge;
		if ( ! triangle || ! reverseTriangle ) {

			return false;

		}

		// get the vertices to swap to
		const t0EdgeIndex = triangle.getEdgeIndex( edge );
		const t1EdgeIndex = reverseTriangle.getEdgeIndex( edge );

		const t0SwapIndex = ( t0EdgeIndex + 2 ) % 3;
		const t1SwapIndex = ( t1EdgeIndex + 2 ) % 3;

		// swap the edge direction
		edge.start.copy( triangle.points[ t0SwapIndex ] );
		edge.startIndex = triangle.getVertexIndex( t0SwapIndex );
		edge.end.copy( reverseTriangle.points[ t1SwapIndex ] );
		edge.endIndex = reverseTriangle.getVertexIndex( t1SwapIndex );

		// adjust both triangles in place
		const t0a = edge;
		const t0ar = false;
		const t0b = reverseTriangle.edges[ t1SwapIndex ].edge;
		const t0br = reverseTriangle.edges[ t1SwapIndex ].reversed;

		const t1a = edge;
		const t1ar = true;
		const t1b = triangle.edges[ t0SwapIndex ].edge;
		const t1br = triangle.edges[ t0SwapIndex ].reversed;

		// one edge on each triangle can remain in place
		triangle.setEdge( t0SwapIndex, t0a, t0ar );
		triangle.setEdge( ( t0SwapIndex + 1 ) % 3, t0b, t0br );

		reverseTriangle.setEdge( t1SwapIndex, t1a, t1ar );
		reverseTriangle.setEdge( ( t1SwapIndex + 1 ) % 3, t1b, t1br );

		return true;

	}

	validate() {

		const { points, edges, triangles } = this;
		const foundTriangleSet = new Set();
		const foundEdgeSet = new Set();
		const messages = [];

		edges.forEach( edge => {

			const { start, end, startIndex, endIndex } = edge;
			if ( ! start.equals( points[ startIndex ] ) || ! end.equals( points[ endIndex ] ) ) {

				messages.push( 'Edge indices do not match' );

			}

			if ( edge.triangle ) {

				foundTriangleSet.add( edge.triangle );

				if ( triangles.indexOf( edge.triangle ) === - 1 ) {

					messages.push( 'Incorrect triangle assigned.' );

				}

			}

			if ( edge.reverseTriangle ) {

				foundTriangleSet.add( edge.reverseTriangle );

				if ( triangles.indexOf( edge.reverseTriangle ) === - 1 ) {

					messages.push( 'Incorrect triangle assigned.' );

				}

			}

		} );

		triangles.forEach( triangle => {

			triangle.edges.forEach( ( info, i ) => {

				const { edge, reversed } = info;

				foundEdgeSet.add( edge );

				if (
					reversed && edge.reverseTriangle !== triangle ||
					! reversed && edge.triangle !== triangle
				) {

					messages.push( 'Edge triangles do not match' );

				}

				const ni = ( i + 1 ) % 3;
				let start = triangle.points[ i ];
				let end = triangle.points[ ni ];
				if ( reversed ) {

					[ start, end ] = [ end, start ];

				}

				if ( ! edge.start.equals( start ) || ! edge.end.equals( end ) ) {

					messages.push( 'Edges incorrectly assigned' );

				}

			} );

		} );

		if ( foundEdgeSet.size !== edges.length ) {

			messages.push( 'Edge counts do not match' );

		}

		if ( foundTriangleSet.size !== triangles.length ) {

			messages.push( 'Triangle counts do not match' );

		}

		return messages;

	}

	removeTriangle( t ) {

		const { points, edges, triangles } = this;
		triangles.splice( triangles.indexOf( t ), 1 );

		triangles.edges.forEach( info => {

			if ( info.reversed ) info.edge.reverseTriangle = null;
			else info.edge.triangle = null;

			if ( info.edge.triangle === null && info.edge.reverseTriangle ) {

				edges.splice( edges.indexOf( info.edge ), 1 );

			}

		} );

	}

	sync() {

		const { points, edges, triangles } = this;

		edges.forEach( e => {

			e.start.copy( points[ e.startIndex ] );
			e.end.copy( points[ e.endIndex ] );

		} );

		triangles.forEach( t => {

			t.edges.forEach( ( info, i ) => {

				t.setEdge( i, info.edge, info.reversed );

			} );

		} );

	}

}
