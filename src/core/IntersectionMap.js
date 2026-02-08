export class IntersectionMap {

	constructor() {

		this.coplanarSet = new Map();
		this.intersectionSet = new Map();
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

			coplanarSet.get( id ).add( id );

		}

	}

}
