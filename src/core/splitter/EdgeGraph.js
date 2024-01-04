import { Vector3, Line3, Triangle } from 'three';
import { lineIntersect } from './utils';

class GraphTriangle extends Triangle {

	constructor( ...args ) {

		super( ...args );

		this.edges = [ null, null, null ];
		this.points = [ this.a, this.b, this.c ];

	}

	setEdge( index, edge, reversed ) {

		this.edges[ index ] = { edge, reversed };

		if ( reversed ) {

			edge.reverseTriangle = this;
			this.points[ index ].copy( edge.end );

		} else {

			edge.triangle = this;
			this.points[ index ].copy( edge.start );

		}

	}

	getEdgeIndex( edge ) {

		return this.edges.findIndex( info => info.edge === edge );

	}

	getVertexIndex( index ) {

		const info = this.edges[ index ];
		return info.reversed ? info.edge.endIndex : info.edge.startIndex;

	}

}

class GraphEdge extends Line3 {

	constructor( ...args ) {

		super( ...args );
		this.startIndex = - 1;
		this.endIndex = - 1;

		this.triangle = null;
		this.reverseTriangle = null;

		this.required = false;

	}

}

const EPSILON = 1e-10;
export class EdgeGraph {

	constructor() {

		this.points = [];
		this.edges = [];
		this.triangles = [];

	}

	initialize( tri ) {

		const arr = [ tri.a, tri.b, tri.c ];
		const { triangles, points, edges } = this;

		// initialize the first triangle if we find three points
		const newTriangle = new GraphTriangle();
		for ( let i = 0; i < 3; i ++ ) {

			const ni = ( i + 1 ) % 3;
			const p0 = arr[ i ];
			const p1 = arr[ ni ];
			const line = new GraphEdge();
			line.start.copy( p0 );
			line.startIndex = i;
			line.end.copy( p1 );
			line.endIndex = ni;

			newTriangle.setEdge( i, line, false );
			edges.push( line );

		}

		triangles.push( newTriangle );
		points.push( tri.a.clone(), tri.b.clone(), tri.c.clone() );

	}

	insertEdge( edge ) {

		const { points, edges } = this;
		const { start, end } = edge;
		const startIndex = this.insertPoint( start );
		const endIndex = this.insertPoint( end );

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
						console.error( 'FAILURE' );

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
		let index = this.findClosestPointIndex( point );

		if ( index === null ) {

			const vec = new Vector3();
			const intersectingEdge = edges.findIndex( e => {

				e.closestPointToPoint( point, true, vec );
				return vec.distanceTo( point ) < EPSILON;

			} );

			if ( intersectingEdge === - 1 ) {

				index = points.length;
				points.push( point.clone() );

				const containingTriangle = triangles.findIndex( t => t.containsPoint( point ) );
				if ( containingTriangle === - 1 ) {

					// TODO: this should never happen

				} else {

					// TODO: split into three triangles
					const triangle = triangles[ containingTriangle ];
					const newEdges = [ null, null, null ];
					for ( let i = 0; i < 3; i ++ ) {

						const other = triangle.points[ i ];
						const edge = new GraphEdge();
						edge.start.copy( point );
						edge.startIndex = index;
						edge.end.copy( other );
						edge.endIndex = triangle.getVertexIndex( i );

						newEdges[ i ] = edge;

					}

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

				index = points.length;
				points.push( point.clone() );

				// NOTE: if the edge is required here then we have a problem - it shouldn't have to be split
				const e = edges[ intersectingEdge ];
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

	findClosestPointIndex( p ) {

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

		const e0Index = triangle.getEdgeIndex( edge );
		const e1Index = reverseTriangle.getEdgeIndex( edge );

		const v0Index = ( e0Index + 2 ) % 3;
		const v1Index = ( e1Index + 2 ) % 3;

		const v0 = triangle.points[ v0Index ];
		const v1 = reverseTriangle.points[ v1Index ];

		edge.start.copy( v0 );
		edge.startIndex = triangle.getVertexIndex( v0Index );
		edge.end.copy( v1 );
		edge.endIndex = reverseTriangle.getVertexIndex( v1Index );

		triangle.setEdge( e0Index, edge, triangle.edges[ e0Index ].reversed );
		reverseTriangle.setEdge( e1Index, edge, reverseTriangle.edges[ e0Index ].reversed );

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

			foundTriangleSet.add( edge.triangle );
			foundTriangleSet.add( edge.reverseTriangle );

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
