import { Triangle } from 'three';
import { setDebugContext } from '../operations/operationsUtils.js';

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

	getTrianglesAsArray( id = null ) {

		const { data } = this;
		const arr = [];

		if ( id !== null ) {

			if ( id in data ) {

				arr.push( data[ id ].triangle );

			}

		} else {

			for ( const key in data ) {

				arr.push( data[ key ].triangle );

			}

		}

		return arr;

	}

	getTriangleIndices() {

		return Object.keys( this.data ).map( i => parseInt( i ) );

	}

	getIntersectionIndices( id ) {

		const { data } = this;
		if ( ! data[ id ] ) {

			return [];

		} else {

			return Object.keys( data[ id ].intersects ).map( i => parseInt( i ) );


		}

	}

	getIntersectionsAsArray( id = null, id2 = null ) {

		const { data } = this;
		const triSet = new Set();
		const arr = [];

		const addTriangles = key => {

			if ( ! data[ key ] ) return;

			if ( id2 !== null ) {

				if ( data[ key ].intersects[ id2 ] ) {

					arr.push( data[ key ].intersects[ id2 ] );

				}

			} else {

				const intersects = data[ key ].intersects;
				for ( const key2 in intersects ) {

					if ( ! triSet.has( key2 ) ) {

						triSet.add( key2 );
						arr.push( intersects[ key2 ] );

					}

				}

			}

		};

		if ( id !== null ) {

			addTriangles( id );

		} else {

			for ( const key in data ) {

				addTriangles( key );

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

	init() {

		if ( this.enabled ) {

			this.reset();
			setDebugContext( this );

		}

	}

	complete() {

		if ( this.enabled ) {

			setDebugContext( null );

		}

	}

}
