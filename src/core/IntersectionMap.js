export class IntersectionMap {

	constructor() {

		this.coplanarSet = new Map();
		this.intersectionSet = new Map();
		this.edgeSet = new Map();
		this.ids = [];

	}

	add( id, intersectionId, coplanar = false ) {

		const { intersectionSet, edgeSet, coplanarSet, ids } = this;
		if ( ! intersectionSet.has( id ) ) {

			intersectionSet.set( id, [] );
			edgeSet.set( id, [] );
			ids.push( id );

		}

		const arr = intersectionSet.get( id );
		arr.push( intersectionId );
		edgeSet.get( id ).push( null );

		if ( coplanar ) {

			if ( ! coplanarSet.has( id ) ) {

				coplanarSet.set( id, new Set() );

			}

			coplanarSet.get( id ).add( intersectionId );

		}

		return arr.length - 1;

	}

	addEdge( id, index, edge ) {

		const edges = this.edgeSet.get( id );
		if ( edges[ index ] === null ) {

			edges[ index ] = [];

		}

		edges[ index ].push( edge );

	}

	getEdges( id, index ) {

		return this.edgeSet.get( id )[ index ];

	}

}
