import { Vector3, Line3, Triangle } from 'three';
import { lineIntersect } from './utils.js';
import { ObjectPool } from './ObjectPool.js';

class GraphTriangle extends Triangle {

	constructor( ...args ) {

		super( ...args );

		// the set of points and edge info associated with this triangle
		this.edges = [ null, null, null ];
		this.points = [ this.a, this.b, this.c ];

	}

	// add the edge to the triangle at the given index and store whether
	// this triangle is attached to the reversed half-edge
	setEdge( index, edge, reversed ) {

		const { edges, points } = this;
		if ( edges[ index ] === null ) {

			edges[ index ] = { edge, reversed };

		} else {

			const info = edges[ index ];
			info.edge = edge;
			info.reversed = reversed;

		}

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

		this.pointsPool = new ObjectPool(
			() => new Vector3(),
		);

		this.edgesPool = new ObjectPool(
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

	}

	initialize( tri ) {

		const arr = [ tri.a, tri.b, tri.c ];
		const { triangles, points, edges } = this;

		// initialize the first triangle that we will be splitting
		const newTriangle = new GraphTriangle();
		for ( let i = 0; i < 3; i ++ ) {

			const ni = ( i + 1 ) % 3;
			const p0 = arr[ i ];
			const p1 = arr[ ni ];
			const edge = new GraphEdge();
			edge.start.copy( p0 );
			edge.startIndex = i;
			edge.end.copy( p1 );
			edge.endIndex = ni;

			newTriangle.setEdge( i, edge, false );
			edges.push( edge );

		}

		triangles.push( newTriangle );
		points.push( tri.a.clone(), tri.b.clone(), tri.c.clone() );

	}

	insertEdge( edge ) {

		const { points, edges } = this;
		const { start, end } = edge;

		// insert the edge points into the graph
		const startIndex = this.insertPoint( start );
		const endIndex = this.insertPoint( end );

		// the edge we're trying to insert
		const inserting = new GraphEdge();
		inserting.start.copy( points[ startIndex ] );
		inserting.startIndex = startIndex;
		inserting.end.copy( points[ endIndex ] );
		inserting.endIndex = endIndex;

		for ( let i = 0, l = edges.length; i < l; i ++ ) {

			// swap the edge if we don't emanate from the same point
			const other = edges[ i ];
			if (
				other.startIndex !== inserting.startIndex &&
				other.startIndex !== inserting.endIndex &&
				other.endIndex !== inserting.startIndex &&
				other.endIndex !== inserting.endIndex
			) {

				const point = new Vector3();
				if ( lineIntersect( inserting, other, point ) ) {

					if ( other.required ) {

						// TODO
						// THESE ARE NOT INTERSECTING?!
						console.error( 'FAILURE' );
						console.log(
							inserting.clone(),
							other.clone(),
							point.clone(),

							inserting.closestPointToPointParameter( point, false ),
							other.closestPointToPointParameter( point, false ),
						);

					} else {

						this.swapEdge( other );

					}

				}

			}

			// if we found the edge that matches the target edge then mark it as required and continue
			if ( (
				other.startIndex === inserting.startIndex &&
				other.endIndex === inserting.endIndex
			) || (
				other.startIndex === inserting.endIndex &&
				other.endIndex === inserting.startIndex
			) ) {

				other.required = true;

			}

		}

	}

	insertPoint( point ) {

		const { edges, points, triangles } = this;
		let index = this.findMatchingPointIndex( point );

		if ( index === null ) {

			// if we haven't been able to match a point see if we can find an existing edge it sits on
			const vec = new Vector3();
			const intersectingEdge = edges.findIndex( e => {

				e.closestPointToPoint( point, true, vec );
				return vec.distanceTo( point ) < EPSILON;

			} );

			if ( intersectingEdge === - 1 ) {

				// if we didn't find an edge then try to find the triangle the point is in
				index = points.length;
				points.push( point.clone() );

				const containingTriangle = triangles.findIndex( t => t.containsPoint( point ) );
				if ( containingTriangle === - 1 ) {

					// TODO: this should never happen
					console.error( 'CANT FIND TRIANGLE' );

				} else {

					// split into three triangles
					const triangle = triangles[ containingTriangle ];
					const newEdges = [ null, null, null ];

					// construct the new edges emanating from the point
					for ( let i = 0; i < 3; i ++ ) {

						const other = triangle.points[ i ];
						const edge = new GraphEdge();
						edge.start.copy( point );
						edge.startIndex = index;
						edge.end.copy( other );
						edge.endIndex = triangle.getVertexIndex( i );

						newEdges[ i ] = edge;

					}

					// construct the triangles
					for ( let i = 0; i < 3; i ++ ) {

						const ni = ( i + 1 ) % 3;
						const e0 = newEdges[ i ];
						const e1 = triangle.edges[ i ].edge;
						const e2 = newEdges[ ni ];

						const newTriangle = new GraphTriangle();
						const reversed = triangle.edges[ i ].reversed;
						newTriangle.setEdge( 0, e0, false );
						newTriangle.setEdge( 1, e1, reversed );
						newTriangle.setEdge( 2, e2, true );

						triangles.push( newTriangle );

					}

					edges.push( ...newEdges );
					triangles.splice( triangles.indexOf( triangle ), 1 );

				}

			} else {

				// if we are sitting on an edge
				index = points.length;
				points.push( point.clone() );

				// NOTE: if the edge is required here then we have a problem - it shouldn't have to be split
				const e = edges[ intersectingEdge ];
				if ( e.required ) {

					console.error( 'WE ARE ON A REQUIRED EDGE' );

				}

				// construct the edges
				const l0 = new GraphEdge();
				l0.start.copy( e.start );
				l0.startIndex = e.startIndex;
				l0.end.copy( point );
				l0.endIndex = index;
				l0.required = e.required;

				const l1 = new GraphEdge();
				l1.start.copy( point );
				l1.startIndex = index;
				l1.end.copy( e.end );
				l1.endIndex = e.endIndex;
				l1.required = e.required;

				edges.push( l0, l1 );
				edges.splice( intersectingEdge, 1 );

				// split the forward side triangle
				if ( e.triangle ) {

					const triangle = e.triangle;
					const edgeIndex = triangle.getEdgeIndex( e );
					const nextEdgeIndex = ( edgeIndex + 2 ) % 3;

					const insertedEdge = new GraphEdge();
					insertedEdge.start.copy( point );
					insertedEdge.startIndex = index;
					insertedEdge.end.copy( triangle.points[ nextEdgeIndex ] );
					insertedEdge.endIndex = triangle.getVertexIndex( nextEdgeIndex );

					const finalEdgeIndex0 = ( edgeIndex + 2 ) % 3;
					const newTri0 = new GraphTriangle();
					newTri0.setEdge( 0, l0, triangle.edges[ edgeIndex ].reversed );
					newTri0.setEdge( 1, insertedEdge, false );
					newTri0.setEdge( 2, triangle.edges[ finalEdgeIndex0 ].edge, triangle.edges[ finalEdgeIndex0 ].reversed );

					const finalEdgeIndex1 = ( edgeIndex + 1 ) % 3;
					const newTri1 = new GraphTriangle();
					newTri1.setEdge( 0, l1, triangle.edges[ edgeIndex ].reversed );
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

					const insertedEdge = new GraphEdge();
					insertedEdge.start.copy( point );
					insertedEdge.startIndex = index;
					insertedEdge.end.copy( triangle.points[ nextEdgeIndex ] );
					insertedEdge.endIndex = triangle.getVertexIndex( nextEdgeIndex );

					const finalEdgeIndex0 = ( edgeIndex + 2 ) % 3;
					const newTri0 = new GraphTriangle();
					newTri0.setEdge( 0, l0, triangle.edges[ edgeIndex ].reversed );
					newTri0.setEdge( 1, insertedEdge, true );
					newTri0.setEdge( 2, triangle.edges[ finalEdgeIndex0 ].edge, triangle.edges[ finalEdgeIndex0 ].reversed );

					const finalEdgeIndex1 = ( edgeIndex + 1 ) % 3;
					const newTri1 = new GraphTriangle();
					newTri1.setEdge( 0, l1, triangle.edges[ edgeIndex ].reversed );
					newTri1.setEdge( 1, triangle.edges[ finalEdgeIndex1 ].edge, triangle.edges[ finalEdgeIndex1 ].reversed );
					newTri1.setEdge( 2, insertedEdge, true );

					triangles.splice( triangles.indexOf( triangle ), 1 );
					triangles.push( newTri0, newTri1 );
					edges.push( insertedEdge );

				}

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

		edges.forEach( edge => {

			const { start, end, startIndex, endIndex } = edge;
			if ( ! start.equals( points[ startIndex ] ) || ! end.equals( points[ endIndex ] ) ) {

				throw new Error( 'Edge indices do not match' );

			}

			if ( edge.triangle ) {

				foundTriangleSet.add( edge.triangle );

			}

			if ( edge.reverseTriangle ) {

				foundTriangleSet.add( edge.reverseTriangle );

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

					throw new Error( 'Edge triangles do not match' );

				}

				const ni = ( i + 1 ) % 3;
				let start = triangle.points[ i ];
				let end = triangle.points[ ni ];
				if ( reversed ) {

					[ start, end ] = [ end, start ];

				}

				if ( ! edge.start.equals( start ) || ! edge.end.equals( end ) ) {

					throw new Error( 'Edges incorrectly assigned' );

				}

			} );

		} );

		if ( foundEdgeSet.size !== edges.length ) {

			throw new Error( 'Edge counts do not match' );

		}

		if ( foundTriangleSet.size !== triangles.length ) {

			throw new Error( 'Triangle counts do not match' );

		}

	}

}
