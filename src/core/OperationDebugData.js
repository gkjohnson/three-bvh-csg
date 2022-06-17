import { Triangle } from 'three';

class TriangleIntersectData {

	constructor( tri ) {

		this.triangle = new Triangle().copy( tri );
		this.intersects = {};

	}

	addTriangle( index, tri ) {

		this.intersects[ index ] = new Triangle().copy( tri );

	}

}

export class OperationDebugData {

	constructor() {

		this.triangleIntersectsA = {};
		this.triangleIntersectsB = {};
		this.intersectionEdges = [];

	}

	addIntersectingTriangles( ia, triA, ib, triB ) {

		const { triangleIntersectsA, triangleIntersectsB } = this;
		if ( ! triangleIntersectsA[ ia ] ) {

			triangleIntersectsA[ ia ] = new TriangleIntersectData( triA );

		}

		if ( ! triangleIntersectsB[ ib ] ) {

			triangleIntersectsB[ ib ] = new TriangleIntersectData( triB );

		}

		triangleIntersectsA[ ia ].addTriangle( ib, triB );
		triangleIntersectsB[ ib ].addTriangle( ia, triA );

	}

	addEdge( edge ) {

		this.intersectionEdges.push( edge.clone() );

	}

	reset() {

		this.triangleIntersectsA = {};
		this.triangleIntersectsB = {};
		this.intersectionEdges = [];

	}

}
