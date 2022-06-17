import { TypeBackedArray } from './TypeBackedArray.js';

// utility class for for tracking attribute data in type-backed arrays
export class TypedAttributeData {

	constructor() {

		this.attributes = {};

	}

	getType( name ) {

		return this.attributes[ name ].type;

	}

	// initializes an attribute array with the given name, type, and size
	initializeArray( name, type, initialSize = undefined ) {

		const { attributes } = this;
		if ( name in attributes ) {

			if ( attributes[ name ].type !== type ) {

				throw new Error( `TypedAttributeData: Array ${ name } already initialized with a different type.` );

			}

		} else {

			attributes[ name ] = new TypeBackedArray( type, initialSize );

		}

	}

	clear() {

		const { attributes } = this;
		for ( const key in attributes ) {

			attributes[ key ].reset();

		}

	}

	delete( key ) {

		delete this.attributes[ key ];

	}

	reset() {

		this.attributes = {};

	}

}
