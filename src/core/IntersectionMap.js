export class IntersectionMap {

	constructor() {

		this.intersectionSet = new Map();
		this.ids = [];

	}

	add( id, intersectionId ) {

		const { intersectionSet, ids } = this;
		if ( ! intersectionSet.has( id ) ) {

			intersectionSet.set( id, [] );
			ids.push( id );

		}

		intersectionSet.get( id ).push( intersectionId );

	}

}
