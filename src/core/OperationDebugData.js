import { Triangle } from 'three';

class TriangleIntersectData {

	constructor( tri ) {

		this.triangle = new Triangle().copy( tri );
		this.intersects = {};

	}

	addTriangle( index, tri ) {

		this.intersects[ index ] = new Triangle().copy( tri );

	}

	getIntersectArray() {

		const array = [];
		const { intersects } = this;
		for ( const key in intersects ) {

			array.push( intersects[ key ] );

		}

		return array;

	}

}

class TriangleIntersectionSets {

	constructor() {

		this.data = {};

	}

	addTriangleIntersection( ia, triA, ib, triB ) {

		const { data } = this;
		if ( ! data[ ia ] ) {

			data[ ia ] = new TriangleIntersectData( triA );

		}

		data[ ia ].addTriangle( ib, triB );

	}

	getTrianglesAsArray() {

		const { data } = this;
		const arr = [];
		for ( const key in data ) {

			arr.push( data[ key ].triangle );

		}

		return arr;

	}

	getIntersectionTrianglesAsArray() {

		const { data } = this;
		const triSet = new Set();
		const arr = [];
		for ( const key in data ) {

			const intersects = data[ key ].intersects;
			for ( const key2 in intersects ) {

				if ( ! triSet.has( key2 ) ) {

					triSet.add( key2 );
					arr.push( intersects[ key2 ] );

				}

			}

		}

		return arr;

	}

	reset() {

		this.data = {};

	}

}

export class OperationDebugData {

	constructor() {

		this.enabled = false;
		this.triangleIntersectsA = new TriangleIntersectionSets();
		this.triangleIntersectsB = new TriangleIntersectionSets();
		this.intersectionEdges = [];

	}

	addIntersectingTriangles( ia, triA, ib, triB ) {

		const { triangleIntersectsA, triangleIntersectsB } = this;
		triangleIntersectsA.addTriangleIntersection( ia, triA, ib, triB );
		triangleIntersectsB.addTriangleIntersection( ib, triB, ia, triA );

	}

	addEdge( edge ) {

		this.intersectionEdges.push( edge.clone() );

	}

	reset() {

		this.triangleIntersectsA.reset();
		this.triangleIntersectsB.reset();
		this.intersectionEdges = [];

	}

}
