import { Vector3, Line3, Triangle } from 'three';

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
		const i0 = this.insertPoint( start );
		const i1 = this.insertPoint( end );

		const line = new GraphEdge();
		line.start.copy( points[ i0 ] );
		line.startIndex = i0;
		line.end.copy( points[ i1 ] );
		line.endIndex = i1;

		// edges.push( line );

		// TODO: check for intersections and swap triangle orientations, then add
		// a required edge
		// TODO: after swapping and making way for new edges we may want to mark edges as "required"

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

				const containingTriangle = triangles.findIndex( t => t.containsPoint( point ) );
				if ( containingTriangle === - 1 ) {

					// TODO: this should never happen
					index = points.length;
					points.push( point.clone() );

				} else {

					// TODO: split into three triangles

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

				if ( e.triangle ) {

					const edgeIndex = e.triangle.getEdgeIndex( e );
					const nextEdgeIndex = ( edgeIndex + 2 ) % 3;

					const insertedEdge = new GraphEdge();
					insertedEdge.start.copy( point );
					insertedEdge.startIndex = index;
					insertedEdge.end.copy( e.triangle.points[ nextEdgeIndex ] );
					insertedEdge.endIndex = e.triangle.getVertexIndex( nextEdgeIndex );
					edges.push( insertedEdge );

					const finalEdgeIndex0 = ( edgeIndex + 2 ) % 3;
					const newTri0 = new GraphTriangle();
					newTri0.setEdge( 0, l0, e.triangle.edges[ edgeIndex ].reversed );
					newTri0.setEdge( 1, insertedEdge, false );
					newTri0.setEdge( 2, e.triangle.edges[ finalEdgeIndex0 ].edge, e.triangle.edges[ finalEdgeIndex0 ].reversed );

					const finalEdgeIndex1 = ( edgeIndex + 1 ) % 3;
					const newTri1 = new GraphTriangle();
					newTri1.setEdge( 0, l1, e.triangle.edges[ edgeIndex ].reversed );
					newTri1.setEdge( 1, e.triangle.edges[ finalEdgeIndex1 ].edge, e.triangle.edges[ finalEdgeIndex1 ].reversed );
					newTri1.setEdge( 2, insertedEdge, true );

					triangles.splice( triangles.indexOf( e.triangle ), 1 );
					triangles.push( newTri0, newTri1 );
					edges.push( insertedEdge );

				}

				if ( e.reverseTriangle ) {

					// TODO: insert the other side

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

	validateState() {

		// TODO: validate state

	}

}
