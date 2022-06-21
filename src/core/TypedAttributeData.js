import { TypeBackedArray } from './TypeBackedArray.js';

// utility class for for tracking attribute data in type-backed arrays
export class TypedAttributeData {

	constructor() {

		this.attributes = {};

	}

	getType( name ) {

		return this.attributes[ name ].type;

	}

	getGroupArray( name, index = 0 ) {

		const { attributes } = this;
		if ( ! attributes[ name ] ) {

			throw new Error();

		}

		const groups = attributes[ name ];
		while ( index >= groups.length ) {

			const ogAttr = groups[ 0 ];
			const newAttr = new TypeBackedArray( ogAttr.type );
			groups.push( newAttr );

		}

		return groups[ index ];

	}

	// initializes an attribute array with the given name, type, and size
	initializeArray( name, type ) {

		const { attributes } = this;
		if ( name in attributes ) {

			if ( attributes[ name ][ 0 ].type !== type ) {

				throw new Error( `TypedAttributeData: Array ${ name } already initialized with a different type.` );

			}

		} else {

			attributes[ name ] = [ new TypeBackedArray( type ) ];

		}

	}

	clear() {

		const { attributes } = this;
		for ( const key in attributes ) {

			attributes[ key ].forEach( a => a.clear() );

		}

	}

	delete( key ) {

		delete this.attributes[ key ];

	}

	reset() {

		this.attributes = {};

	}

}
