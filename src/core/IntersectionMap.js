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

		intersectionSet.get( id ).push( intersectionId );

		if ( coplanar ) {

			if ( ! coplanarSet.has( id ) ) {

				coplanarSet.set( id, new Set() );

			}

			coplanarSet.get( id ).add( intersectionId );

		}

	}

	addIntersectionEdge( id, edge ) {

		const { edgeSet } = this;
		if ( ! edgeSet.has( id ) ) {

			edgeSet.set( id, new Set() );

		}

		edgeSet.get( id ).add( edge );

	}

	getIntersectionEdges( id ) {

		return this.edgeSet.get( id ) || null;

	}

}
