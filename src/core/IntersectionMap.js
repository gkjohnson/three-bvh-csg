export class IntersectionMap {

	constructor() {

		this.coplanarSet = new Map();
		this.intersectionSet = new Map();
		this.edgeSet = new Map();
		this.ids = [];

	}

	add( id, intersectionId, coplanar = false ) {

		const { intersectionSet, coplanarSet, ids } = this;
		if ( ! intersectionSet.has( id ) ) {

			intersectionSet.set( id, [] );
			ids.push( id );

		}

		const arr = intersectionSet.get( id );
		arr.push( intersectionId );

		if ( coplanar ) {

			if ( ! coplanarSet.has( id ) ) {

				coplanarSet.set( id, new Set() );

			}

			coplanarSet.get( id ).add( intersectionId );

		}

		return arr.length - 1;

	}

	addEdge( id, index, edge ) {

		const { edgeSet } = this;
		if ( ! edgeSet.has( id ) ) {

			edgeSet.set( id, new Map() );

		}

		if ( ! edgeSet.get( id ).has( index ) ) {

			edgeSet.get( id ).set( index, new Set() );

		}

		edgeSet.get( id ).get( index ).add( edge );

	}

	getEdges( id, index ) {

		return Array.from( this.edgeSet.get( id ).get( index ) );

	}

}
