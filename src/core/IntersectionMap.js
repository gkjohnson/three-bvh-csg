export class IntersectionMap {

	constructor() {

		this.intersectionSet = {};
		this.ids = [];

	}

	add( id, intersectionId ) {

		const { intersectionSet, ids } = this;
		if ( ! intersectionSet[ id ] ) {

			intersectionSet[ id ] = [];
			ids.push( id );

		}

		intersectionSet[ id ].push( intersectionId );

	}

}
