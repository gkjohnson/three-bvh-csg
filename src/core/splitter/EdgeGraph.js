import { Vector3, Line3, Triangle } from 'three';

class GraphTriangle extends Triangle {

	constructor( ...args ) {

		super( ...args );

		this.ab = null;
		this.bc = null;
		this.ca = null;
		this.edges = [ null, null, null ];

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

		edges.push( line );

		// TODO: check and swap intersections

	}

	insertPoint( point ) {

		const { edges, points } = this;
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

			} else {

				index = points.length;
				points.push( point.clone() );

				const e = edges[ intersectingEdge ];
				edges.splice( intersectingEdge, 1 );

				const l0 = new GraphEdge();
				l0.start.copy( e.start );
				l0.startIndex = e.startIndex;
				l0.end.copy( point );
				l0.endIndex = index;
				l0.required = true;

				const l1 = new GraphEdge();
				l1.start.copy( point );
				l1.startIndex = index;
				l1.end.copy( e.end );
				l1.endIndex = e.endIndex;
				l1.required = true;

				edges.push( l0, l1 );

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

}
